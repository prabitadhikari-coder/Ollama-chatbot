import time
import httpx
from typing import List, Literal, Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator

from .config import settings
from .security import (
    PromptInjectionScanner,
    SlidingWindowRateLimiter,
    telemetry
)

# Pydantic Schemas
class ChatMessageModel(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(..., max_length=10000)

class ChatRequestModel(BaseModel):
    message: str = Field(..., min_length=1, max_length=settings.MAX_MESSAGE_LENGTH)
    history: List[ChatMessageModel] = Field(default_factory=list, max_length=settings.MAX_HISTORY_ITEMS)
    role: Literal["chat", "reading"] = "chat"

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Message cannot be empty or whitespace only.")
        return trimmed

# Global Rate Limiter
rate_limiter = SlidingWindowRateLimiter(limit_per_minute=settings.RATE_LIMIT_REQUESTS_PER_MINUTE)

# HTTP Client for upstream Node.js backend
http_client: Optional[httpx.AsyncClient] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient(
        base_url=settings.UPSTREAM_NODE_URL,
        timeout=httpx.Timeout(connect=5.0, read=120.0, write=10.0, pool=30.0),
        headers={"ngrok-skip-browser-warning": "true"}
    )
    print(f"[FastAPI Gateway] Initialized and pointing to upstream: {settings.UPSTREAM_NODE_URL}")
    yield
    if http_client:
        await http_client.aclose()

app = FastAPI(
    title="NexusAI Security Gateway",
    description="Enterprise Security Gateway, Prompt Injection Shield, and Rate Limiting Proxy for Ollama Chatbot",
    version="1.0.0",
    lifespan=lifespan
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    telemetry.total_requests += 1
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Gateway-Protection"] = "FastAPI-DefenseShield-v1"
    return response

# CORS Middleware with regex support for Cloudflare Pages and ngrok
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=r"^https://([a-zA-Z0-9-]+\.)*(pages\.dev|ngrok-free\.dev|ngrok\.app)$|^http://(localhost|127\.0\.0\.1):(3000|5173)$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

def get_client_ip(request: Request) -> str:
    # Check X-Forwarded-For from ngrok/proxies
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

@app.get("/health")
@app.get("/api/health")
async def health_check():
    upstream_ok = False
    try:
        if http_client:
            res = await http_client.get("/api/health", timeout=3.0)
            upstream_ok = res.status_code == 200
    except Exception:
        upstream_ok = False

    return {
        "status": "healthy",
        "gateway": "FastAPI Security Gateway",
        "upstream_node_server": "connected" if upstream_ok else "unreachable",
        "upstream_url": settings.UPSTREAM_NODE_URL,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

@app.get("/security/stats")
async def security_stats():
    return telemetry.to_dict()

@app.get("/api/status")
async def get_model_status():
    if not http_client:
        raise HTTPException(status_code=503, detail="Gateway client not ready")
    try:
        resp = await http_client.get("/api/status")
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            media_type="application/json"
        )
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "connected": False,
                "error": f"Cannot reach upstream Node.js application ({str(e)})"
            }
        )

@app.post("/api/chat")
async def secure_chat(payload: ChatRequestModel, request: Request):
    client_ip = get_client_ip(request)

    # 1. Rate Limiting Check
    allowed, retry_after = rate_limiter.is_allowed(client_ip)
    if not allowed:
        telemetry.rate_limited_requests += 1
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"error": "Rate limit exceeded. Please wait a moment before sending more messages."},
            headers={"Retry-After": str(retry_after)}
        )

    # 2. Prompt Injection & Adversarial Attack Scanner
    is_suspicious, reason = PromptInjectionScanner.scan(payload.message)
    if is_suspicious:
        telemetry.record_threat(client_ip, reason or "Threat detected", payload.message)
        if settings.BLOCK_PROMPT_INJECTIONS:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "error": "Security Shield: Request rejected by AI safety guardrail.",
                    "reason": reason
                }
            )

    if not http_client:
        raise HTTPException(status_code=503, detail="Gateway client uninitialized")

    # 3. Transparent Streaming Proxy to Upstream Node Server / Ollama
    req_body = payload.model_dump()

    try:
        upstream_req = http_client.build_request(
            method="POST",
            url="/api/chat",
            json=req_body,
            headers={
                "Content-Type": "application/json",
                "X-Forwarded-For": client_ip,
                "ngrok-skip-browser-warning": "true"
            }
        )
        upstream_resp = await http_client.send(upstream_req, stream=True)

        if upstream_resp.status_code != 200:
            error_content = await upstream_resp.aread()
            return Response(
                content=error_content,
                status_code=upstream_resp.status_code,
                media_type="application/json"
            )

        telemetry.successful_proxied_requests += 1

        async def stream_generator():
            try:
                async for chunk in upstream_resp.aiter_bytes():
                    if await request.is_disconnected():
                        print("[Gateway] Client disconnected, closing upstream stream.")
                        break
                    yield chunk
            finally:
                await upstream_resp.aclose()

        return StreamingResponse(
            stream_generator(),
            media_type="text/event-stream; charset=utf-8",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive"
            }
        )

    except httpx.TimeoutException:
        return JSONResponse(
            status_code=504,
            content={"error": "Upstream application took too long to respond (timeout)."}
        )
    except Exception as e:
        return JSONResponse(
            status_code=502,
            content={"error": f"Failed to communicate with upstream server: {str(e)}"}
        )

@app.get("/{full_path:path}")
async def proxy_all_other_routes(full_path: str, request: Request):
    """
    Proxies static assets or other routes back to Node.js backend.
    """
    if not http_client:
        raise HTTPException(status_code=503, detail="Gateway client uninitialized")
    
    url = f"/{full_path}"
    try:
        req = http_client.build_request(
            method=request.method,
            url=url,
            headers=dict(request.headers)
        )
        resp = await http_client.send(req)
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            headers=dict(resp.headers)
        )
    except Exception as e:
        return JSONResponse(
            status_code=502,
            content={"error": f"Proxy routing error: {str(e)}"}
        )

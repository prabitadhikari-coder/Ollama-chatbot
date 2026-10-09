import re
import time
from typing import Dict, List, Tuple
from collections import defaultdict

class PromptInjectionScanner:
    """
    Heuristic and regex security scanner for detecting adversarial jailbreaks,
    system prompt override attempts, and delimiter exfiltration.
    """
    
    INJECTION_PATTERNS = [
        # Instruction disregard/override
        (
            re.compile(r"(?i)\b(ignore|disregard|forget|bypass)\s+(all\s+)?(previous|prior|past|above)\s+(instructions|directives|rules|prompts)\b"),
            "Adversarial instruction disregard pattern detected"
        ),
        # Persona hijacking / DAN mode
        (
            re.compile(r"(?i)\b(you\s+are\s+now|act\s+as)\s+(an?\s+)?(unrestricted|jailbroken|dan|developer\s+mode|evil|unaligned)\b"),
            "Jailbreak persona hijacking pattern detected"
        ),
        # System prompt exfiltration
        (
            re.compile(r"(?i)\b(print|output|display|show|reveal|repeat)\s+(the\s+)?(exact\s+)?(system\s+prompt|initial\s+prompt|system\s+instructions)\b"),
            "System prompt exfiltration attempt detected"
        ),
        # Chat template delimiter injection (Ollama / Llama / Qwen delimiters)
        (
            re.compile(r"(<\|\s*im_(start|end)\s*\|>|<\|\s*system\s*\|>|\[INST\]|<<SYS>>|<\/?system>)"),
            "Chat template delimiter injection detected"
        ),
    ]

    @classmethod
    def scan(cls, text: str) -> Tuple[bool, str | None]:
        if not text:
            return False, None
            
        # Check for null byte injection
        if "\x00" in text:
            return True, "Null byte payload injection detected"

        for pattern, reason in cls.INJECTION_PATTERNS:
            if pattern.search(text):
                return True, reason

        return False, None


class SlidingWindowRateLimiter:
    """
    In-memory sliding-window rate limiter per client IP.
    """
    def __init__(self, limit_per_minute: int = 30):
        self.limit = limit_per_minute
        self.window_seconds = 60
        self.requests: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, client_ip: str) -> Tuple[bool, int]:
        now = time.time()
        cutoff = now - self.window_seconds
        
        # Clean older timestamps
        self.requests[client_ip] = [t for t in self.requests[client_ip] if t > cutoff]
        
        if len(self.requests[client_ip]) >= self.limit:
            oldest = self.requests[client_ip][0]
            retry_after = max(1, int(self.window_seconds - (now - oldest)))
            return False, retry_after

        self.requests[client_ip].append(now)
        return True, 0


class SecurityTelemetry:
    """
    Maintains gateway telemetry metrics.
    """
    def __init__(self):
        self.total_requests = 0
        self.blocked_injections = 0
        self.rate_limited_requests = 0
        self.successful_proxied_requests = 0
        self.threat_log: List[dict] = []

    def record_threat(self, client_ip: str, reason: str, sample_snippet: str):
        self.blocked_injections += 1
        self.threat_log.append({
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "client_ip": client_ip,
            "reason": reason,
            "snippet": sample_snippet[:100]
        })
        if len(self.threat_log) > 50:
            self.threat_log.pop(0)

    def to_dict(self) -> dict:
        return {
            "total_requests": self.total_requests,
            "blocked_injections": self.blocked_injections,
            "rate_limited_requests": self.rate_limited_requests,
            "successful_proxied_requests": self.successful_proxied_requests,
            "recent_threats": self.threat_log[-10:]
        }

telemetry = SecurityTelemetry()

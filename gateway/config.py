import os
from typing import List

class Settings:
    GATEWAY_PORT: int = int(os.getenv("GATEWAY_PORT", "8000"))
    GATEWAY_HOST: str = os.getenv("GATEWAY_HOST", "0.0.0.0")
    
    # Upstream Node.js application server
    UPSTREAM_NODE_URL: str = os.getenv("UPSTREAM_NODE_URL", "http://localhost:3000").rstrip("/")
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "30"))
    
    # Security caps
    MAX_MESSAGE_LENGTH: int = int(os.getenv("MAX_MESSAGE_LENGTH", "10000"))
    MAX_HISTORY_ITEMS: int = int(os.getenv("MAX_HISTORY_ITEMS", "40"))
    BLOCK_PROMPT_INJECTIONS: bool = os.getenv("BLOCK_PROMPT_INJECTIONS", "true").lower() in ("true", "1", "yes")

    # Allowed CORS Origins
    RAW_ORIGINS: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173,https://steadfast-luminance-praying.ngrok-free.dev"
    )

    @property
    def allowed_origins(self) -> List[str]:
        return [o.strip() for o in self.RAW_ORIGINS.split(",") if o.strip()]

settings = Settings()

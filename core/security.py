import time
import math
import uuid
import secrets
from flask import session, request
from core.errors import AppError
from config import Config

# In-memory token bucket rate limiter: key -> (tokens, last_time)
_rate_limits: dict[str, tuple[float, float]] = {}

def get_csrf_token() -> str:
    """Retrieve or generate CSRF token stored in the session."""
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(24)
    return session["csrf_token"]

def verify_csrf():
    """Verify CSRF token for non-safe HTTP methods."""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    token = request.headers.get("X-CSRF-Token") or request.form.get("csrf_token")
    expected = session.get("csrf_token")
    if not expected or not token or not secrets.compare_digest(token, expected):
        raise AppError("csrf", "Invalid or missing CSRF token.", 403)

def check_rate_limit(key: str, max_tokens: int, refill_rate_per_sec: float):
    """
    Token bucket rate limiter.
    Raises AppError("rate_limited") if rate is exceeded.
    """
    now = time.time()
    tokens, last_time = _rate_limits.get(key, (float(max_tokens), now))
    elapsed = max(0.0, now - last_time)
    tokens = min(float(max_tokens), tokens + elapsed * refill_rate_per_sec)

    if tokens < 1.0:
        retry_after = int(math.ceil((1.0 - tokens) / max(0.001, refill_rate_per_sec)))
        raise AppError("rate_limited", f"Rate limit reached. Please wait {retry_after}s.", 429)

    _rate_limits[key] = (tokens - 1.0, now)

def validate_pdf_upload(file_storage) -> tuple[bytes, str]:
    """Validate uploaded PDF magic bytes and size."""
    if not file_storage or not file_storage.filename:
        raise AppError("no_doc", "No file selected for upload.", 400)

    filename = file_storage.filename
    if not filename.lower().endswith(".pdf"):
        raise AppError("not_pdf", "Only PDF documents are supported.", 400)

    # Read bytes safely
    data = file_storage.read()
    if len(data) > Config.MAX_UPLOAD_MB * 1024 * 1024:
        raise AppError("too_large", f"PDF exceeds maximum {Config.MAX_UPLOAD_MB}MB size limit.", 400)

    # Magic byte verification (%PDF-)
    if not data.startswith(b"%PDF-"):
        raise AppError("not_pdf", "Uploaded file is not a valid PDF binary.", 400)

    safe_name = f"{uuid.uuid4().hex}.pdf"
    return data, safe_name

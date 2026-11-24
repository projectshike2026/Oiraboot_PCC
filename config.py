import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "oiraboot-academic-intelligence-suite-secret-2026")
    CHOSEN_TRACK = os.getenv("CHOSEN_TRACK", "all").strip().lower()

    # LLM Settings (OpenAI-compatible)
    LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai").rstrip("/")
    LLM_API_KEY = os.getenv("LLM_API_KEY", "").strip()
    LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.0-flash").strip()
    LLM_FALLBACK_MODEL = os.getenv("LLM_FALLBACK_MODEL", "").strip()
    LLM_JSON_MODE = int(os.getenv("LLM_JSON_MODE", "1"))
    LLM_TIMEOUT_S = int(os.getenv("LLM_TIMEOUT_S", "40"))
    
    # Auto-enable mock LLM if no API key is provided, preventing crashes
    MOCK_LLM = int(os.getenv("MOCK_LLM", "1" if not os.getenv("LLM_API_KEY") else "0"))

    # Database & Storage
    DB_PATH = os.getenv("DB_PATH", str(BASE_DIR / "instance" / "app.db"))
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "instance" / "uploads"))
    MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))
    MAX_PDF_PAGES = int(os.getenv("MAX_PDF_PAGES", "150"))
    FULL_CONTEXT_CHARS = int(os.getenv("FULL_CONTEXT_CHARS", "48000"))
    RETENTION_HOURS = int(os.getenv("RETENTION_HOURS", "24"))

    # Security & Limits
    RATE_LIMIT_CHAT = 30     # reqs per min per session
    RATE_LIMIT_QUIZ = 10     # reqs per min per session
    RATE_LIMIT_UPLOAD = 10   # reqs per min per session
    RATE_LIMIT_GLOBAL = 120  # reqs per min global

    # Data paths
    ADMISSION_DATA_PATH = str(BASE_DIR / "data" / "admission.txt")
    SCHOLARSHIPS_DATA_PATH = str(BASE_DIR / "data" / "scholarships.csv")

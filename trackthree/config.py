import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY_1") or ""
SECRET_KEY = os.getenv("SECRET_KEY", "track1-secret-key-pciu-computer-club")
PORT = int(os.getenv("PORT", 8080))

UPLOAD_FOLDER = BASE_DIR / "uploads"
UPLOAD_FOLDER.mkdir(exist_ok=True)
MAX_CONTENT_LENGTH = 32 * 1024 * 1024  # 32 MB max upload
ALLOWED_EXTENSIONS = {"pdf"}

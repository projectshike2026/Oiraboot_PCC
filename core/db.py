import sqlite3
import time
import uuid
import os
from pathlib import Path
from flask import g, session
from config import Config

_last_purge_time = 0.0

def get_db() -> sqlite3.Connection:
    """Get request-scoped SQLite connection with WAL mode and row factory."""
    if "db" not in g:
        Path(Config.DB_PATH).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(Config.DB_PATH, timeout=20.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        g.db = conn
    return g.db

def close_db(e=None):
    """Close request-scoped database connection."""
    db = g.pop("db", None)
    if db is not None:
        db.close()

def get_session_id() -> str:
    """Retrieve or initialize persistent anonymous session ID."""
    if "sid" not in session:
        session["sid"] = str(uuid.uuid4())
    return session["sid"]

def init_db(track_schemas: list[str] = None):
    """Initialize shared tables and optional track schemas."""
    Path(Config.DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(Config.DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    
    # Shared tables
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS sessions(
        sid TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        lang TEXT DEFAULT 'en'
    );
    CREATE TABLE IF NOT EXISTS kv(
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL
    );
    """)

    if track_schemas:
        for schema_sql in track_schemas:
            if schema_sql and schema_sql.strip():
                conn.executescript(schema_sql)

    conn.commit()
    conn.close()

def touch_session(sid: str, lang: str = "en"):
    """Update last_seen timestamp and trigger periodic retention purge."""
    global _last_purge_time
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    db = get_db()
    db.execute("""
    INSERT INTO sessions (sid, created_at, last_seen, lang)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(sid) DO UPDATE SET last_seen=excluded.last_seen, lang=excluded.lang;
    """, (sid, now, now, lang))
    db.commit()

    # Opportunistically purge stale sessions every 10 minutes
    if time.time() - _last_purge_time > 600:
        _last_purge_time = time.time()
        purge_old_sessions()

def purge_old_sessions():
    """Delete session records and uploaded files older than RETENTION_HOURS."""
    try:
        cutoff = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(time.time() - Config.RETENTION_HOURS * 3600))
        db = get_db()
        stale_docs = db.execute("SELECT stored_name FROM documents WHERE sid IN (SELECT sid FROM sessions WHERE last_seen < ?)", (cutoff,)).fetchall()
        for doc in stale_docs:
            fpath = Path(Config.UPLOAD_FOLDER) / doc["stored_name"]
            if fpath.exists():
                try:
                    fpath.unlink()
                except OSError:
                    pass
        db.execute("DELETE FROM sessions WHERE last_seen < ?", (cutoff,))
        db.commit()
    except Exception:
        pass

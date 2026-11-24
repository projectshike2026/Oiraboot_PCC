import json
from pathlib import Path
from flask import session, request
from config import BASE_DIR

_TRANSLATIONS: dict[str, dict[str, str]] = {}

def load_translations():
    global _TRANSLATIONS
    i18n_dir = BASE_DIR / "i18n"
    for lang in ("en", "bn"):
        fpath = i18n_dir / f"{lang}.json"
        if fpath.exists():
            with open(fpath, "r", encoding="utf-8") as f:
                _TRANSLATIONS[lang] = json.load(f)
        else:
            _TRANSLATIONS[lang] = {}

load_translations()

def get_current_lang() -> str:
    """Determine user's active language from cookie or session."""
    cookie_lang = request.cookies.get("lang")
    if cookie_lang in ("en", "bn"):
        return cookie_lang
    session_lang = session.get("lang")
    if session_lang in ("en", "bn"):
        return session_lang
    return "en"

def t(key: str, lang: str | None = None, **kwargs) -> str:
    """Translate key to current or requested language."""
    selected_lang = lang or get_current_lang()
    catalog = _TRANSLATIONS.get(selected_lang, {})
    text = catalog.get(key)
    if text is None:
        text = _TRANSLATIONS.get("en", {}).get(key, key)
    if kwargs:
        try:
            return text.format(**kwargs)
        except Exception:
            return text
    return text

def get_translations_json(lang: str | None = None) -> str:
    selected_lang = lang or get_current_lang()
    return json.dumps(_TRANSLATIONS.get(selected_lang, _TRANSLATIONS.get("en", {})))

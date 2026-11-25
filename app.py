import os
import re
import sys
import time
import socket
import atexit
import subprocess
import requests
from pathlib import Path
from flask import Flask, render_template, request, jsonify, redirect, url_for, make_response, session, Response
from config import Config, BASE_DIR
from core.errors import AppError
from core.db import get_db, close_db, init_db, get_session_id, touch_session
from core.security import get_csrf_token
from core.i18n import get_current_lang, t, get_translations_json
from tracks.track1.routes import bp as track1_bp
from tracks.track2.routes import bp as track2_bp
from tracks.track3.routes import bp as track3_bp
from tracks.track3.loader import load_scholarships_into_db
from tracks.track2.kb import kb

TRACK_PROCESSES = []

def _is_port_listening(port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.35)
            return s.connect_ex(("127.0.0.1", port)) == 0
    except Exception:
        return False

def _wait_for_port(port: int, max_wait: float = 3.5) -> bool:
    start = time.time()
    while time.time() - start < max_wait:
        if _is_port_listening(port):
            return True
        time.sleep(0.15)
    return False

def ensure_track_services():
    """Auto-spawns Trackone (port 5050) and trackthree (port 8080) background servers if not running."""
    global TRACK_PROCESSES
    track1_dir = BASE_DIR / "Trackone"
    track3_dir = BASE_DIR / "trackthree"

    # 1. Track 1: AI Engine & RAG Studio (port 5050)
    if track1_dir.exists() and not _is_port_listening(5050):
        try:
            env1 = dict(os.environ, PORT="5050", PYTHONUNBUFFERED="1")
            p1 = subprocess.Popen(
                [sys.executable, "app.py"],
                cwd=str(track1_dir),
                env=env1,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            TRACK_PROCESSES.append(p1)
            _wait_for_port(5050, 8.0)
            print(f"🚀 Trackone service launched on port 5050 (PID: {p1.pid})")
        except Exception as e:
            print(f"Warning: Failed to auto-launch Trackone: {e}")

    # 2. Track 3: Scholarship Atlas (port 8080)
    if track3_dir.exists() and not _is_port_listening(8080):
        try:
            env3 = dict(os.environ, PORT="8080", PYTHONUNBUFFERED="1")
            p3 = subprocess.Popen(
                [sys.executable, "app.py"],
                cwd=str(track3_dir),
                env=env3,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            TRACK_PROCESSES.append(p3)
            _wait_for_port(8080, 8.0)
            print(f"🚀 trackthree service launched on port 8080 (PID: {p3.pid})")
        except Exception as e:
            print(f"Warning: Failed to auto-launch trackthree: {e}")

def _cleanup_track_processes():
    for p in TRACK_PROCESSES:
        try:
            if p.poll() is None:
                p.terminate()
        except Exception:
            pass

atexit.register(_cleanup_track_processes)

def create_app():
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config["SECRET_KEY"] = Config.SECRET_KEY
    app.config["TEMPLATES_AUTO_RELOAD"] = True
    app.jinja_env.auto_reload = True
    app.teardown_appcontext(close_db)

    # Initialize DB with schemas on app creation
    with app.app_context():
        t1_schema = (BASE_DIR / "tracks" / "track1" / "schema.sql").read_text(encoding="utf-8")
        t2_schema = (BASE_DIR / "tracks" / "track2" / "schema.sql").read_text(encoding="utf-8")
        t3_schema = (BASE_DIR / "tracks" / "track3" / "schema.sql").read_text(encoding="utf-8")
        init_db([t1_schema, t2_schema, t3_schema])
        
        # Preload scholarships from CSV if table is empty
        db = get_db()
        count = db.execute("SELECT COUNT(*) as c FROM scholarships").fetchone()["c"]
        if count == 0:
            load_scholarships_into_db(db)

    # Register blueprints
    app.register_blueprint(track1_bp)
    app.register_blueprint(track2_bp)
    app.register_blueprint(track3_bp)

    # Context processors
    @app.context_processor
    def inject_globals():
        return {
            "csrf_token": get_csrf_token,
            "current_lang": get_current_lang(),
            "t": t,
            "chosen_track": Config.CHOSEN_TRACK
        }

    # Error Handlers
    @app.errorhandler(AppError)
    def handle_app_error(e):
        if request.path.startswith("/api/"):
            return jsonify(e.to_dict()), e.status_code
        return render_template("500.html", error=e.message, code=e.code), e.status_code

    @app.errorhandler(404)
    def handle_404(e):
        if request.path.startswith("/api/"):
            return jsonify({"error": {"code": "not_found", "message": "Endpoint not found."}}), 404
        return render_template("404.html"), 404

    @app.errorhandler(500)
    def handle_500(e):
        if request.path.startswith("/api/"):
            return jsonify({"error": {"code": "internal_error", "message": "An unexpected server error occurred."}}), 500
        return render_template("500.html", error="Internal server error", code="internal_error"), 500

    # Shared Routes
    @app.route("/")
    def index():
        sid = get_session_id()
        lang = get_current_lang()
        touch_session(sid, lang)
        return render_template("index.html", lang=lang, translations_json=get_translations_json(lang), active_nav="overview")

    @app.route("/documents")
    def documents():
        sid = get_session_id()
        lang = get_current_lang()
        touch_session(sid, lang)
        return render_template("documents.html", lang=lang, translations_json=get_translations_json(lang), active_nav="documents")

    @app.route("/admissions")
    def admissions():
        sid = get_session_id()
        lang = get_current_lang()
        touch_session(sid, lang)
        return render_template("admissions.html", lang=lang, translations_json=get_translations_json(lang), active_nav="admissions")

    @app.route("/scholarships")
    def scholarships():
        sid = get_session_id()
        lang = get_current_lang()
        touch_session(sid, lang)
        return render_template("scholarships.html", lang=lang, translations_json=get_translations_json(lang), active_nav="scholarships")

    @app.route("/healthz")
    def healthz():
        return jsonify({
            "ok": True,
            "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "track": Config.CHOSEN_TRACK,
            "mock_llm": bool(Config.MOCK_LLM)
        })

    @app.route("/lang/<lang_code>", methods=["GET", "POST"])
    def set_language(lang_code):
        lang = "bn" if lang_code == "bn" else "en"
        sid = get_session_id()
        touch_session(sid, lang)
        session["lang"] = lang
        if request.method == "POST" or request.headers.get("X-Requested-With") == "XMLHttpRequest":
            resp = jsonify({"ok": True, "lang": lang})
            resp.set_cookie("lang", lang, max_age=365*24*3600, path="/", samesite="Lax")
            return resp
        ref = request.referrer
        if not ref or "/lang/" in ref:
            ref = url_for("index")
        resp = redirect(ref)
        resp.set_cookie("lang", lang, max_age=365*24*3600, path="/", samesite="Lax")
        return resp

    @app.route("/trackone")
    @app.route("/track1")
    def open_trackone():
        ensure_track_services()
        return redirect("/track1-studio/")

    @app.route("/trackthree")
    @app.route("/track3")
    def open_trackthree():
        ensure_track_services()
        return redirect("/track3-atlas/")

    def _proxy_to_track(target_port: int, prefix: str, subpath: str):
        ensure_track_services()
        target_url = f"http://127.0.0.1:{target_port}/{subpath}"
        if request.query_string:
            target_url += "?" + request.query_string.decode("utf-8", errors="ignore")

        hop_by_hop = {"host", "content-length", "transfer-encoding", "connection", "accept-encoding"}
        fwd_headers = {k: v for k, v in request.headers.items() if k.lower() not in hop_by_hop}
        fwd_headers["Accept-Encoding"] = "identity"

        try:
            upstream = requests.request(
                method=request.method,
                url=target_url,
                headers=fwd_headers,
                data=request.get_data(),
                allow_redirects=False,
                timeout=60,
            )
        except Exception as e:
            return render_template("500.html", error=f"Workspace service warming up: {e}", code="service_unavailable"), 503

        content = upstream.content
        content_type = upstream.headers.get("Content-Type", "")

        if "text/html" in content_type.lower():
            html = content.decode("utf-8", errors="replace")
            # Rewrite static asset URLs so CSS, JS, and logos resolve through the single-port proxy
            html = html.replace('href="/static/', f'href="{prefix}/static/')
            html = html.replace("href='/static/", f"href='{prefix}/static/")
            html = html.replace('src="/static/', f'src="{prefix}/static/')
            html = html.replace("src='/static/", f"src='{prefix}/static/")
            # Inject lightweight fetch + window.open prefixer for proxied sub-app API calls
            interceptor = (
                f"<script>(function(){{var P='{prefix}';"
                "var of=window.fetch;window.fetch=function(u,o){"
                "if(typeof u==='string'&&u.startsWith('/')&&!u.startsWith(P+'/')&&!u.startsWith('/track1-studio/')&&!u.startsWith('/track3-atlas/')){u=P+u;}"
                "return of.call(this,u,o);};"
                "var oo=window.open;window.open=function(u,t,f){"
                "if(typeof u==='string'&&u.startsWith('/')&&!u.startsWith(P+'/')){u=P+u;}"
                "return oo.call(this,u,t,f);};"
                "})();</script>"
            )
            html = re.sub(r"(<head[^>]*>)", r"\1\n" + interceptor, html, count=1, flags=re.IGNORECASE)
            content = html.encode("utf-8")

        resp = Response(content, status=upstream.status_code)
        excluded_resp = {"content-encoding", "content-length", "transfer-encoding", "connection", "set-cookie"}
        for k, v in upstream.headers.items():
            if k.lower() in excluded_resp:
                continue
            if k.lower() == "location" and v.startswith("/") and not v.startswith(prefix):
                v = prefix + v
            resp.headers[k] = v

        # Preserve multiple Set-Cookie headers cleanly
        try:
            raw_cookies = upstream.raw.headers.getlist("Set-Cookie")
        except Exception:
            raw_cookies = [upstream.headers["Set-Cookie"]] if "Set-Cookie" in upstream.headers else []
        for cookie_val in raw_cookies:
            resp.headers.add("Set-Cookie", cookie_val)

        return resp

    PROXY_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

    @app.route("/track1-studio", methods=PROXY_METHODS)
    def proxy_track1_root_noslash():
        return redirect("/track1-studio/")

    @app.route("/track1-studio/", defaults={"subpath": ""}, methods=PROXY_METHODS)
    @app.route("/track1-studio/<path:subpath>", methods=PROXY_METHODS)
    def proxy_track1(subpath):
        return _proxy_to_track(5050, "/track1-studio", subpath)

    @app.route("/track3-atlas", methods=PROXY_METHODS)
    def proxy_track3_root_noslash():
        return redirect("/track3-atlas/")

    @app.route("/track3-atlas/", defaults={"subpath": ""}, methods=PROXY_METHODS)
    @app.route("/track3-atlas/<path:subpath>", methods=PROXY_METHODS)
    def proxy_track3(subpath):
        return _proxy_to_track(8080, "/track3-atlas", subpath)

    @app.route("/about")
    def about():
        return render_template("about.html", active_nav="about")

    # Auto-start Track 1 & Track 3 background services under WSGI servers (e.g. Gunicorn on Render),
    # while skipping during pytest test runs.
    if "pytest" not in sys.modules and os.getenv("OIRABOOT_SKIP_SUBSERVICES") != "1":
        ensure_track_services()

    return app

app = create_app()

if __name__ == "__main__":
    ensure_track_services()
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "0").lower() in ("1", "true")
    print(f"Starting Oiraboot Academic Intelligence Suite on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=debug, use_reloader=False)

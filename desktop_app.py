import importlib
import os
import sys
import threading
import time
import urllib.request
import webbrowser

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS


def get_base_path():
    if getattr(sys, "frozen", False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


def import_backend():
    backend_path = os.path.join(base_path, "backend")
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)

    backend_app = importlib.import_module("app")
    backend_api = importlib.import_module("app.api")
    return backend_app.db, backend_api


base_path = get_base_path()
db, backend_api = import_backend()

flask_app = Flask(__name__, static_folder=os.path.join(base_path, "frontend", "dist"))
CORS(flask_app)

db_dir = os.path.join(
    os.path.dirname(os.path.abspath(sys.argv[0])) if getattr(sys, "frozen", False) else base_path,
    "instance",
)
os.makedirs(db_dir, exist_ok=True)
db_path = os.path.join(db_dir, "calendar.db")
flask_app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
flask_app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(flask_app)

flask_app.register_blueprint(backend_api.events_bp)
flask_app.register_blueprint(backend_api.calendars_bp)
flask_app.register_blueprint(backend_api.reminders_bp)
flask_app.register_blueprint(backend_api.todos_bp)
flask_app.register_blueprint(backend_api.voice_bp)
flask_app.register_blueprint(backend_api.weather_bp)

with flask_app.app_context():
    try:
        db.create_all()
        print(f"DB path: {db_path}")
        print(f"DB exists: {os.path.exists(db_path)}")

        from sqlalchemy import text

        result = db.session.execute(text("PRAGMA table_info(events)"))
        columns = [row[1] for row in result]
        print(f"Events columns: {columns}")
        if "progress" not in columns:
            db.session.execute(text("ALTER TABLE events ADD COLUMN progress INTEGER DEFAULT 0"))
            db.session.commit()
            print("Migration: added progress column")
        else:
            print("Migration: progress column exists")

        models = importlib.import_module("app.models")
        count = models.Event.query.count()
        print(f"Events count: {count}")
    except Exception as e:
        print(f"DB init error: {e}")
        import traceback

        traceback.print_exc()
        db.session.rollback()


@flask_app.route("/")
def serve_frontend():
    return send_from_directory(flask_app.static_folder, "index.html")


@flask_app.route("/<path:path>")
def serve_static(path):
    if os.path.exists(os.path.join(flask_app.static_folder, path)):
        return send_from_directory(flask_app.static_folder, path)
    return send_from_directory(flask_app.static_folder, "index.html")


@flask_app.route("/api/health")
def health_check():
    return jsonify({"status": "healthy"})


APP_URL = "http://127.0.0.1:8000"
HEALTH_URL = f"{APP_URL}/api/health"


def is_existing_app_running():
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=1) as response:
            return response.status == 200
    except Exception:
        return False


def open_browser():
    webbrowser.open(APP_URL)


def open_browser_when_ready():
    for _ in range(20):
        if is_existing_app_running():
            open_browser()
            return
        time.sleep(0.25)
    open_browser()


def run_server():
    flask_app.run(debug=False, host="0.0.0.0", port=8000, use_reloader=False)


def wait_until_ready(timeout_seconds=10):
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if is_existing_app_running():
            return True
        time.sleep(0.2)
    return False


def open_desktop_window():
    try:
        import webview

        webview.create_window(
            "语音日历工具",
            APP_URL,
            width=1280,
            height=820,
            min_size=(960, 640),
        )
        webview.start()
        return True
    except Exception as e:
        print(f"WebView unavailable, fallback to browser: {e}")
        return False


def keep_process_alive():
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        return


if __name__ == "__main__":
    if is_existing_app_running():
        if not open_desktop_window():
            open_browser()
        sys.exit(0)

    try:
        import webview  # noqa: F401

        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        wait_until_ready()
        if not open_desktop_window():
            open_browser()
            keep_process_alive()
    except Exception:
        if getattr(sys, "frozen", False):
            threading.Thread(target=open_browser_when_ready, daemon=True).start()
        run_server()

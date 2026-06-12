import importlib
import ctypes
import logging
import os
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from datetime import datetime
from ctypes import wintypes

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
backup_dir = os.path.join(db_dir, "backups")
os.makedirs(backup_dir, exist_ok=True)
log_path = os.path.join(db_dir, "voice_calendar.log")

log_handlers = [logging.FileHandler(log_path, encoding="utf-8")]
if getattr(sys, "stdout", None):
    log_handlers.append(logging.StreamHandler(sys.stdout))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=log_handlers,
)
logger = logging.getLogger("voice_calendar")

flask_app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
flask_app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
flask_app.config["VOICE_CALENDAR_BACKUP_DIR"] = backup_dir
flask_app.config["VOICE_CALENDAR_LOG_PATH"] = log_path
flask_app.config["VOICE_CALENDAR_EXECUTABLE"] = sys.executable
flask_app.config["VOICE_CALENDAR_REMINDERS_ENABLED"] = True
flask_app.config["VOICE_CALENDAR_TRAY_ENABLED"] = sys.platform.startswith("win")

db.init_app(flask_app)

flask_app.register_blueprint(backend_api.events_bp)
flask_app.register_blueprint(backend_api.calendars_bp)
flask_app.register_blueprint(backend_api.reminders_bp)
flask_app.register_blueprint(backend_api.todos_bp)
flask_app.register_blueprint(backend_api.voice_bp)
flask_app.register_blueprint(backend_api.weather_bp)
flask_app.register_blueprint(backend_api.sync_bp)
flask_app.register_blueprint(backend_api.backup_bp)
flask_app.register_blueprint(backend_api.desktop_bp)
flask_app.register_blueprint(backend_api.assistant_bp)

with flask_app.app_context():
    try:
        db.create_all()
        logger.info("DB path: %s", db_path)
        logger.info("DB exists: %s", os.path.exists(db_path))

        from sqlalchemy import text

        result = db.session.execute(text("PRAGMA table_info(events)"))
        columns = [row[1] for row in result]
        logger.info("Events columns: %s", columns)
        if "progress" not in columns:
            db.session.execute(text("ALTER TABLE events ADD COLUMN progress INTEGER DEFAULT 0"))
            db.session.commit()
            logger.info("Migration: added progress column")
        else:
            logger.info("Migration: progress column exists")

        models = importlib.import_module("app.models")
        count = models.Event.query.count()
        logger.info("Events count: %s", count)
    except Exception as e:
        logger.exception("DB init error: %s", e)
        import traceback

        traceback.print_exc()
        db.session.rollback()


def backup_sqlite(source_path, target_path):
    source = sqlite3.connect(source_path)
    target = sqlite3.connect(target_path)
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()


def ensure_daily_backup():
    if not os.path.exists(db_path):
        return

    today = datetime.now().strftime("%Y%m%d")
    target_path = os.path.join(backup_dir, f"calendar_auto_{today}.db")
    if os.path.exists(target_path):
        return

    try:
        backup_sqlite(db_path, target_path)
        logger.info("Daily backup created: %s", target_path)
    except Exception:
        logger.exception("Daily backup failed")


def show_native_reminder(title, message):
    try:
        if sys.platform.startswith("win"):
            flags = 0x40 | 0x1000 | 0x40000
            ctypes.windll.user32.MessageBoxW(None, message, title, flags)
        else:
            logger.info("Reminder: %s - %s", title, message)
    except Exception:
        logger.exception("Native reminder failed")


def format_reminder_message(reminder):
    event = reminder.event
    if not event:
        return "日程提醒", "有一个日程提醒已到时间。"

    time_text = event.start_time.strftime("%Y-%m-%d %H:%M") if event.start_time else ""
    lines = [event.title]
    if time_text:
        lines.append(f"时间：{time_text}")
    if event.location:
        lines.append(f"地点：{event.location}")
    if event.description:
        lines.append(f"备注：{event.description}")

    return "语音日历提醒", "\n".join(lines)


def reminder_loop(stop_event):
    logger.info("Background reminder loop started")
    models = importlib.import_module("app.models")

    while not stop_event.is_set():
        try:
            with flask_app.app_context():
                due_reminders = models.Reminder.query.filter(
                    models.Reminder.is_sent == False,
                    models.Reminder.reminder_time <= datetime.utcnow(),
                ).all()

                for reminder in due_reminders:
                    title, message = format_reminder_message(reminder)
                    reminder.is_sent = True
                    db.session.commit()
                    logger.info("Reminder sent: %s", message.replace("\n", " | "))
                    threading.Thread(
                        target=show_native_reminder,
                        args=(title, message),
                        daemon=True,
                    ).start()
        except Exception:
            logger.exception("Background reminder check failed")
            with flask_app.app_context():
                db.session.rollback()

        stop_event.wait(30)

    logger.info("Background reminder loop stopped")


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


def launch_app_window():
    try:
        if getattr(sys, "frozen", False):
            subprocess.Popen(
                [sys.executable],
                cwd=os.path.dirname(os.path.abspath(sys.executable)),
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform.startswith("win") else 0,
            )
        else:
            subprocess.Popen(
                [sys.executable, os.path.abspath(__file__)],
                cwd=base_path,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform.startswith("win") else 0,
            )
    except Exception:
        logger.exception("Failed to launch app window, fallback to browser")
        open_browser()


def open_browser_when_ready():
    for _ in range(20):
        if is_existing_app_running():
            open_browser()
            return
        time.sleep(0.25)
    open_browser()


def run_server():
    logger.info("Starting server on 0.0.0.0:8000")
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

        logger.info("Opening desktop window")
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
        logger.exception("WebView unavailable, fallback to browser: %s", e)
        return False


class WindowsTray:
    WM_TRAYICON = 0x0400 + 20
    WM_COMMAND = 0x0111
    WM_DESTROY = 0x0002
    WM_LBUTTONUP = 0x0202
    WM_LBUTTONDBLCLK = 0x0203
    WM_RBUTTONUP = 0x0205
    WM_CONTEXTMENU = 0x007B

    NIM_ADD = 0x00000000
    NIM_DELETE = 0x00000002
    NIF_MESSAGE = 0x00000001
    NIF_ICON = 0x00000002
    NIF_TIP = 0x00000004
    NIF_INFO = 0x00000010

    ID_OPEN = 1001
    ID_BACKUP = 1002
    ID_EXIT = 1003

    MF_STRING = 0x00000000
    MF_SEPARATOR = 0x00000800
    TPM_RIGHTBUTTON = 0x00000002
    IDI_APPLICATION = 32512

    def __init__(self, on_exit):
        self.on_exit = on_exit
        self.hwnd = None
        self.hicon = None
        self._notify_data = None
        self._wnd_proc = None
        self._class_name = "VoiceCalendarTrayWindow"
        self._thread = None
        self._ready = threading.Event()

    def start(self):
        if not sys.platform.startswith("win"):
            return

        self._thread = threading.Thread(target=self._message_loop, daemon=True)
        self._thread.start()
        self._ready.wait(3)

    def _message_loop(self):
        try:
            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32

            WNDPROC = ctypes.WINFUNCTYPE(
                wintypes.LPARAM,
                wintypes.HWND,
                wintypes.UINT,
                wintypes.WPARAM,
                wintypes.LPARAM,
            )

            class WNDCLASS(ctypes.Structure):
                _fields_ = [
                    ("style", wintypes.UINT),
                    ("lpfnWndProc", WNDPROC),
                    ("cbClsExtra", ctypes.c_int),
                    ("cbWndExtra", ctypes.c_int),
                    ("hInstance", wintypes.HINSTANCE),
                    ("hIcon", wintypes.HICON),
                    ("hCursor", wintypes.HANDLE),
                    ("hbrBackground", wintypes.HBRUSH),
                    ("lpszMenuName", wintypes.LPCWSTR),
                    ("lpszClassName", wintypes.LPCWSTR),
                ]

            self._wnd_proc = WNDPROC(self._handle_message)
            hinstance = kernel32.GetModuleHandleW(None)
            wnd_class = WNDCLASS()
            wnd_class.lpfnWndProc = self._wnd_proc
            wnd_class.hInstance = hinstance
            wnd_class.lpszClassName = self._class_name
            user32.RegisterClassW(ctypes.byref(wnd_class))

            self.hwnd = user32.CreateWindowExW(
                0,
                self._class_name,
                "Voice Calendar Tray",
                0,
                0,
                0,
                0,
                0,
                None,
                None,
                hinstance,
                None,
            )
            if not self.hwnd:
                logger.warning("Tray hidden window was not created")
                self._ready.set()
                return

            self._add_icon()
            self._ready.set()

            msg = wintypes.MSG()
            while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
                user32.TranslateMessage(ctypes.byref(msg))
                user32.DispatchMessageW(ctypes.byref(msg))
        except Exception:
            logger.exception("Tray loop failed")
            self._ready.set()

    def _handle_message(self, hwnd, msg, wparam, lparam):
        user32 = ctypes.windll.user32

        if msg == self.WM_TRAYICON:
            if lparam in (self.WM_LBUTTONUP, self.WM_LBUTTONDBLCLK):
                launch_app_window()
                return 0
            if lparam in (self.WM_RBUTTONUP, self.WM_CONTEXTMENU):
                self._show_menu(hwnd)
                return 0

        if msg == self.WM_COMMAND:
            command_id = int(wparam) & 0xFFFF
            if command_id == self.ID_OPEN:
                launch_app_window()
                return 0
            if command_id == self.ID_BACKUP:
                self._create_backup_from_menu()
                return 0
            if command_id == self.ID_EXIT:
                self._remove_icon()
                self.on_exit()
                return 0

        if msg == self.WM_DESTROY:
            self._remove_icon()
            user32.PostQuitMessage(0)
            return 0

        return user32.DefWindowProcW(hwnd, msg, wparam, lparam)

    def _add_icon(self):
        user32 = ctypes.windll.user32
        shell32 = ctypes.windll.shell32

        class NOTIFYICONDATA(ctypes.Structure):
            _fields_ = [
                ("cbSize", wintypes.DWORD),
                ("hWnd", wintypes.HWND),
                ("uID", wintypes.UINT),
                ("uFlags", wintypes.UINT),
                ("uCallbackMessage", wintypes.UINT),
                ("hIcon", wintypes.HICON),
                ("szTip", wintypes.WCHAR * 128),
                ("dwState", wintypes.DWORD),
                ("dwStateMask", wintypes.DWORD),
                ("szInfo", wintypes.WCHAR * 256),
                ("uTimeoutOrVersion", wintypes.UINT),
                ("szInfoTitle", wintypes.WCHAR * 64),
                ("dwInfoFlags", wintypes.DWORD),
            ]

        self.hicon = user32.LoadIconW(None, wintypes.LPCWSTR(self.IDI_APPLICATION))
        notify_data = NOTIFYICONDATA()
        notify_data.cbSize = ctypes.sizeof(NOTIFYICONDATA)
        notify_data.hWnd = self.hwnd
        notify_data.uID = 1
        notify_data.uFlags = self.NIF_MESSAGE | self.NIF_ICON | self.NIF_TIP | self.NIF_INFO
        notify_data.uCallbackMessage = self.WM_TRAYICON
        notify_data.hIcon = self.hicon
        notify_data.szTip = "语音日历工具"
        notify_data.szInfoTitle = "语音日历工具"
        notify_data.szInfo = "已在后台运行，日程提醒会继续生效。"
        notify_data.dwInfoFlags = 1
        self._notify_data = notify_data
        shell32.Shell_NotifyIconW(self.NIM_ADD, ctypes.byref(notify_data))
        logger.info("Windows tray icon added")

    def _remove_icon(self):
        if not self._notify_data:
            return

        try:
            ctypes.windll.shell32.Shell_NotifyIconW(self.NIM_DELETE, ctypes.byref(self._notify_data))
            logger.info("Windows tray icon removed")
        except Exception:
            logger.exception("Failed to remove tray icon")
        finally:
            self._notify_data = None

    def _show_menu(self, hwnd):
        user32 = ctypes.windll.user32
        menu = user32.CreatePopupMenu()
        user32.AppendMenuW(menu, self.MF_STRING, self.ID_OPEN, "打开日历")
        user32.AppendMenuW(menu, self.MF_STRING, self.ID_BACKUP, "立即备份")
        user32.AppendMenuW(menu, self.MF_SEPARATOR, 0, None)
        user32.AppendMenuW(menu, self.MF_STRING, self.ID_EXIT, "退出后台")

        point = wintypes.POINT()
        user32.GetCursorPos(ctypes.byref(point))
        user32.SetForegroundWindow(hwnd)
        user32.TrackPopupMenu(menu, self.TPM_RIGHTBUTTON, point.x, point.y, 0, hwnd, None)
        user32.DestroyMenu(menu)

    def _create_backup_from_menu(self):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        target_path = os.path.join(backup_dir, f"calendar_manual_{timestamp}.db")
        try:
            backup_sqlite(db_path, target_path)
            show_native_reminder("语音日历工具", f"备份已创建：\n{target_path}")
            logger.info("Manual backup created from tray: %s", target_path)
        except Exception as exc:
            show_native_reminder("语音日历工具", f"备份失败：{exc}")
            logger.exception("Manual backup from tray failed")


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

    ensure_daily_backup()
    reminder_stop_event = threading.Event()
    threading.Thread(target=reminder_loop, args=(reminder_stop_event,), daemon=True).start()
    tray = WindowsTray(lambda: os._exit(0))
    tray.start()

    try:
        import webview  # noqa: F401

        server_thread = threading.Thread(target=run_server, daemon=True)
        server_thread.start()
        wait_until_ready()
        if not open_desktop_window():
            open_browser()
        keep_process_alive()
    except Exception:
        logger.exception("Desktop window startup failed, running server directly")
        if getattr(sys, "frozen", False):
            threading.Thread(target=open_browser_when_ready, daemon=True).start()
        run_server()

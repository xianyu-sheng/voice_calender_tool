import os
import sys

from flask import Blueprint, current_app, jsonify, request

desktop_bp = Blueprint("desktop", __name__)

RUN_KEY_PATH = r"Software\Microsoft\Windows\CurrentVersion\Run"
RUN_VALUE_NAME = "VoiceCalendar"


def _is_windows():
    return sys.platform.startswith("win")


def _app_executable():
    if getattr(sys, "frozen", False):
        return sys.executable
    return current_app.config.get("VOICE_CALENDAR_EXECUTABLE") or sys.executable


def _read_autostart():
    if not _is_windows():
        return False

    import winreg

    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY_PATH, 0, winreg.KEY_READ) as key:
            value, _ = winreg.QueryValueEx(key, RUN_VALUE_NAME)
            return bool(value)
    except FileNotFoundError:
        return False
    except OSError:
        return False


def _set_autostart(enabled):
    if not _is_windows():
        raise RuntimeError("开机自启仅支持 Windows")

    import winreg

    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY_PATH, 0, winreg.KEY_SET_VALUE) as key:
        if enabled:
            winreg.SetValueEx(key, RUN_VALUE_NAME, 0, winreg.REG_SZ, f'"{_app_executable()}"')
        else:
            try:
                winreg.DeleteValue(key, RUN_VALUE_NAME)
            except FileNotFoundError:
                pass


@desktop_bp.route("/api/desktop/status", methods=["GET"])
def desktop_status():
    log_path = current_app.config.get("VOICE_CALENDAR_LOG_PATH")
    return jsonify(
        {
            "success": True,
            "data": {
                "platform": sys.platform,
                "is_windows": _is_windows(),
                "is_packaged": bool(getattr(sys, "frozen", False)),
                "executable": _app_executable(),
                "autostart_enabled": _read_autostart(),
                "background_reminders": current_app.config.get("VOICE_CALENDAR_REMINDERS_ENABLED", False),
                "tray_enabled": current_app.config.get("VOICE_CALENDAR_TRAY_ENABLED", False),
                "log_path": log_path if log_path and os.path.exists(log_path) else log_path,
            },
        }
    )


@desktop_bp.route("/api/desktop/autostart", methods=["POST"])
def update_autostart():
    data = request.get_json(silent=True) or {}
    enabled = bool(data.get("enabled"))
    try:
        _set_autostart(enabled)
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    return jsonify({"success": True, "data": {"autostart_enabled": _read_autostart()}})

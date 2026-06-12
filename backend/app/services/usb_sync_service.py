from __future__ import annotations

import shutil
import subprocess
import threading
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any


ADB_REMOTE = "tcp:8000"
ADB_LOCAL = "tcp:8000"


@dataclass
class UsbSyncState:
    adb_available: bool = False
    adb_path: str | None = None
    devices: list[dict[str, str]] | None = None
    reverse_enabled: bool = False
    last_checked: str | None = None
    last_error: str | None = None
    phone_url: str = "http://127.0.0.1:8000"


_state = UsbSyncState(devices=[])
_lock = threading.Lock()
_stop_event = threading.Event()
_thread: threading.Thread | None = None


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _run_adb(args: list[str], timeout: int = 8) -> subprocess.CompletedProcess[str]:
    adb_path = shutil.which("adb")
    if not adb_path:
        raise FileNotFoundError("未找到 adb，请先安装 Android platform-tools 并加入 PATH")

    return subprocess.run(
        [adb_path, *args],
        capture_output=True,
        text=True,
        timeout=timeout,
        creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
    )


def _parse_devices(output: str) -> list[dict[str, str]]:
    devices: list[dict[str, str]] = []
    for line in output.splitlines()[1:]:
        line = line.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) >= 2:
            devices.append({"serial": parts[0], "state": parts[1]})
    return devices


def check_usb_sync(enable_reverse: bool = True) -> dict[str, Any]:
    adb_path = shutil.which("adb")
    next_state = UsbSyncState(
        adb_available=bool(adb_path),
        adb_path=adb_path,
        devices=[],
        reverse_enabled=False,
        last_checked=_now(),
        phone_url="http://127.0.0.1:8000",
    )

    if not adb_path:
        next_state.last_error = "未找到 adb，请先安装 Android platform-tools"
        _save_state(next_state)
        return get_usb_sync_state()

    try:
        devices_result = _run_adb(["devices"], timeout=8)
        if devices_result.returncode != 0:
            next_state.last_error = (devices_result.stderr or devices_result.stdout or "adb devices 失败").strip()
            _save_state(next_state)
            return get_usb_sync_state()

        next_state.devices = _parse_devices(devices_result.stdout)
        online_devices = [device for device in next_state.devices if device.get("state") == "device"]

        if not online_devices:
            unauthorized = [device for device in next_state.devices if device.get("state") == "unauthorized"]
            if unauthorized:
                next_state.last_error = "手机未授权 USB 调试，请在手机弹窗中允许这台电脑"
            else:
                next_state.last_error = "未检测到已授权 Android 手机"
            _save_state(next_state)
            return get_usb_sync_state()

        if enable_reverse:
            reverse_result = _run_adb(["reverse", ADB_REMOTE, ADB_LOCAL], timeout=8)
            if reverse_result.returncode == 0:
                next_state.reverse_enabled = True
                next_state.last_error = None
            else:
                next_state.last_error = (reverse_result.stderr or reverse_result.stdout or "adb reverse 失败").strip()

        _save_state(next_state)
        return get_usb_sync_state()
    except Exception as exc:
        next_state.last_error = str(exc)
        _save_state(next_state)
        return get_usb_sync_state()


def _save_state(next_state: UsbSyncState) -> None:
    global _state
    with _lock:
        _state = next_state


def get_usb_sync_state() -> dict[str, Any]:
    with _lock:
        return {
            "adb_available": _state.adb_available,
            "adb_path": _state.adb_path,
            "devices": _state.devices or [],
            "reverse_enabled": _state.reverse_enabled,
            "last_checked": _state.last_checked,
            "last_error": _state.last_error,
            "phone_url": _state.phone_url,
        }


def start_usb_sync_monitor(interval_seconds: int = 20) -> None:
    global _thread
    if _thread and _thread.is_alive():
        return

    _stop_event.clear()

    def _loop() -> None:
        while not _stop_event.is_set():
            check_usb_sync(enable_reverse=True)
            _stop_event.wait(interval_seconds)

    _thread = threading.Thread(target=_loop, daemon=True)
    _thread.start()


def stop_usb_sync_monitor() -> None:
    _stop_event.set()

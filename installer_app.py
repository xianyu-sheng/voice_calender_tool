import base64
import ctypes
import os
import shutil
import subprocess
import sys
from pathlib import Path


APP_NAME = "".join(chr(code) for code in (35821, 38899, 26085, 21382, 24037, 20855))
INSTALL_DIR_NAME = "VoiceCalendar"
PAYLOAD_EXE_NAME = "VoiceCalendar.exe"


def get_base_path():
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent


def get_payload_path():
    base_path = get_base_path()
    candidates = [
        base_path / "payload" / PAYLOAD_EXE_NAME,
        base_path / "build" / "installer_payload" / PAYLOAD_EXE_NAME,
        base_path / "dist" / f"{APP_NAME}.exe",
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return candidates[0]


def show_message(title, message, icon=0x40):
    if sys.platform == "win32":
        ctypes.windll.user32.MessageBoxW(None, message, title, icon)
    else:
        print(f"{title}: {message}")


def powershell_quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def create_shortcuts(target_path):
    programs_dir = "[Environment]::GetFolderPath('Programs')"
    desktop_dir = "[Environment]::GetFolderPath('Desktop')"
    app_chars = ",".join(f"[char]{ord(char)}" for char in APP_NAME)
    target = powershell_quote(target_path)

    script = f"""
$app = [string]::Concat({app_chars})
$target = {target}
$shell = New-Object -ComObject WScript.Shell
$programs = {programs_dir}
$desktop = {desktop_dir}
$folder = Join-Path $programs $app
New-Item -ItemType Directory -Force -Path $folder | Out-Null
$startShortcut = $shell.CreateShortcut((Join-Path $folder ($app + '.lnk')))
$startShortcut.TargetPath = $target
$startShortcut.WorkingDirectory = Split-Path $target
$startShortcut.Save()
$desktopShortcut = $shell.CreateShortcut((Join-Path $desktop ($app + '.lnk')))
$desktopShortcut.TargetPath = $target
$desktopShortcut.WorkingDirectory = Split-Path $target
$desktopShortcut.Save()
"""
    encoded = base64.b64encode(script.encode("utf-16le")).decode("ascii")
    subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
        check=True,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
    )


def main():
    if sys.platform != "win32":
        show_message(APP_NAME, "This installer is only available on Windows.", 0x30)
        return 1

    payload_path = get_payload_path()
    if not payload_path.exists():
        show_message(APP_NAME, "The installer payload is missing.", 0x10)
        return 1

    local_app_data = os.environ.get("LOCALAPPDATA")
    if not local_app_data:
        show_message(APP_NAME, "LOCALAPPDATA is not available.", 0x10)
        return 1

    install_dir = Path(local_app_data) / INSTALL_DIR_NAME
    target_path = install_dir / PAYLOAD_EXE_NAME

    try:
        install_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(payload_path, target_path)
        create_shortcuts(str(target_path))
        subprocess.Popen([str(target_path)], cwd=str(install_dir))
        show_message(APP_NAME, "Installation completed. Shortcuts were created on Desktop and Start Menu.")
    except Exception as exc:
        show_message(APP_NAME, f"Installation failed: {exc}", 0x10)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

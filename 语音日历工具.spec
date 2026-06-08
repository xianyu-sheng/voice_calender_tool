# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_dynamic_libs

binaries = []
binaries += collect_dynamic_libs('vosk')


a = Analysis(
    ['desktop_app.py'],
    pathex=['backend'],
    binaries=binaries,
    datas=[('frontend/dist', 'frontend/dist'), ('backend', 'backend')],
    hiddenimports=['flask', 'flask_cors', 'flask_sqlalchemy', 'sqlalchemy', 'vosk', 'requests', 'urllib3', 'certifi', 'charset_normalizer', 'idna', 'dotenv', 'json', 'wave'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='语音日历工具',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

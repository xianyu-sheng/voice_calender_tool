# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_dynamic_libs

block_cipher = None

a = Analysis(
    ['desktop_app.py'],
    pathex=['backend'],
    binaries=collect_dynamic_libs('vosk'),
    datas=[
        ('frontend/dist', 'frontend/dist'),
        ('backend', 'backend'),
    ],
    hiddenimports=[
        'flask',
        'flask_cors',
        'flask_sqlalchemy',
        'sqlalchemy',
        'sqlalchemy.sql.default_comparator',
        'vosk',
        'dotenv',
        'python_dotenv',
        'requests',
        'urllib3',
        'certifi',
        'charset_normalizer',
        'idna',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='语音日历工具',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

@echo off
echo ========================================
echo 语音日历工具 - 打包脚本
echo ========================================
echo.

echo [1/3] 构建前端...
cd frontend
call npm run build
if errorlevel 1 (
    echo 前端构建失败！
    pause
    exit /b 1
)
cd ..

echo.
echo [2/3] 打包成exe（使用 Python 3.12 venv）...
D:\voice_cal_venv\Scripts\python.exe -m PyInstaller --onefile --noconsole --name "语音日历工具" ^
    --add-data "frontend/dist;frontend/dist" ^
    --add-data "backend;backend" ^
    --collect-binaries "vosk" ^
    --hidden-import "flask" ^
    --hidden-import "flask_cors" ^
    --hidden-import "flask_sqlalchemy" ^
    --hidden-import "sqlalchemy" ^
    --hidden-import "vosk" ^
    --hidden-import "requests" ^
    --hidden-import "urllib3" ^
    --hidden-import "certifi" ^
    --hidden-import "charset_normalizer" ^
    --hidden-import "idna" ^
    --hidden-import "dotenv" ^
    --hidden-import "json" ^
    --hidden-import "wave" ^
    app.py

if errorlevel 1 (
    echo 打包失败！
    pause
    exit /b 1
)

echo.
echo [3/3] 完成！
echo.
echo ========================================
echo 打包成功！
echo 可执行文件位置: dist\语音日历工具.exe
echo ========================================
echo.
pause

@echo off
echo Starting Voice Calendar Tool...
echo.

echo Starting Backend Server...
start "Backend" cmd /k "cd backend && python main.py"

echo Starting Frontend Server...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
pause

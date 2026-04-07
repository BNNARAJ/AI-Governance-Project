@echo off
echo Starting AI Governance Agent...

:: Check if .env exists
if not exist "backend\.env" (
    echo [ERROR] backend\.env not found! Please create it with your GOOGLE_API_KEY.
    pause
    exit /b
)

:: Start backend in a new window
echo [INFO] Starting Backend Server on http://localhost:8000...
start "AI Governance Backend" cmd /k "cd backend && .\venv\Scripts\python.exe -m app.main"

:: Start frontend server in a new window
echo [INFO] Starting Frontend Server on http://localhost:3000...
start "AI Governance Frontend" cmd /k "cd frontend && python -m http.server 3000"

:: Wait a moment for servers to start
timeout /t 4 /nobreak > nul

:: Open frontend in browser
echo [INFO] Opening Frontend Dashboard...
start http://localhost:3000

echo.
echo [SUCCESS] App is running! 
echo Close the backend terminal window to stop the server.
pause

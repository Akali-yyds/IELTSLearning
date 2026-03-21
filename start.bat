@echo off
echo ========================================
echo   IELTSLearning Start Script
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] Starting backend...
start "IELTS Backend" cmd /k "cd backend && .venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo [2/2] Starting frontend...
start "IELTS Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Opening browser...
start http://localhost:5173

echo.
echo ========================================
echo   Services starting...
echo ========================================
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo.
echo   Close the opened windows to stop services.
echo.

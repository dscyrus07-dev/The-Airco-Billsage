@echo off
title BillSage Docker Launcher
color 0A

echo.
echo ===================================================
echo           BillSage Docker Launcher
echo ===================================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH
    echo Please install Docker Desktop and try again
    pause
    exit /b 1
)

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
)

echo [INFO] Docker is ready
echo.

REM Check if docker-compose.yml exists
if not exist "docker-compose.yml" (
    echo [ERROR] docker-compose.yml not found
    echo Please ensure you're running this from the project root
    pause
    exit /b 1
)

REM Menu
:menu
echo.
echo Please select an option:
echo 1. Start BillSage (First time setup)
echo 2. Start BillSage (Quick start)
echo 3. Stop BillSage
echo 4. Restart BillSage
echo 5. View logs
echo 6. Clean up (Remove containers and volumes)
echo 7. Exit
echo.
set /p choice="Enter your choice (1-7): "

if "%choice%"=="1" goto first_time
if "%choice%"=="2" goto quick_start
if "%choice%"=="3" goto stop
if "%choice%"=="4" goto restart
if "%choice%"=="5" goto logs
if "%choice%"=="6" goto cleanup
if "%choice%"=="7" goto exit
echo Invalid choice, please try again
goto menu

:first_time
echo.
echo [INFO] Starting BillSage for the first time...
echo This will build all containers and start the services
echo.
docker-compose down --volumes --remove-orphans
docker-compose build --no-cache
docker-compose up -d
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start services
    pause
    goto menu
)
goto show_status

:quick_start
echo.
echo [INFO] Starting BillSage services...
docker-compose up -d
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start services
    pause
    goto menu
)
goto show_status

:stop
echo.
echo [INFO] Stopping BillSage services...
docker-compose down
echo [SUCCESS] Services stopped
pause
goto menu

:restart
echo.
echo [INFO] Restarting BillSage services...
docker-compose restart
echo [SUCCESS] Services restarted
pause
goto menu

:logs
echo.
echo [INFO] Showing logs (Press Ctrl+C to exit)...
docker-compose logs -f
pause
goto menu

:cleanup
echo.
echo [WARNING] This will remove all containers and data
echo Are you sure you want to continue? (y/N)
set /p confirm=
if /i not "%confirm%"=="y" (
    echo [INFO] Cleanup cancelled
    pause
    goto menu
)
echo.
echo [INFO] Cleaning up Docker containers and volumes...
docker-compose down --volumes --remove-orphans
docker system prune -f
echo [SUCCESS] Cleanup completed
pause
goto menu

:show_status
echo.
echo [INFO] Waiting for services to start...
timeout /t 10 /nobreak >nul

echo.
echo ===================================================
echo              Service Status
echo ===================================================
docker-compose ps

echo.
echo ===================================================
echo              Service URLs
echo ===================================================
echo Frontend:  http://localhost:3000
echo Backend:   http://localhost:8000
echo API Docs:  http://localhost:8000/docs
echo Database:  localhost:5432
echo ===================================================

echo.
echo [SUCCESS] BillSage is now running!
echo.
echo Useful commands:
echo - View logs: docker-compose logs -f
echo - Stop services: docker-compose down
echo - Restart: docker-compose restart
echo.
pause
goto menu

:exit
echo.
echo [INFO] Goodbye!
exit /b 0

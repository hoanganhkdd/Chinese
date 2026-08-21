@echo off
:: HA.py — One-click dependency installer for Windows
:: Double-click this file to install all required packages.

echo.
echo ============================================================
echo   HA.py — Installing dependencies
echo ============================================================
echo.

pip install -r HA_requirements.txt

echo.
echo ============================================================
echo   Done!  You can now run:
echo.
echo   python HA.py "https://www.youtube.com/watch?v=VIDEO_ID"
echo ============================================================
echo.
pause

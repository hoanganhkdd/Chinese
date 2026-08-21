@echo off
setlocal
chcp 65001 >nul 2>&1
title HA_video - YouTube to Excel
cd /d "%~dp0"

echo ============================================================
echo   HA_video v2 : YouTube  --^>  Tu vung  --^>  Excel
echo ============================================================
echo.

set PY=
python --version >nul 2>&1 && set PY=python
if not defined PY py -3 --version >nul 2>&1 && set PY=py -3
if not defined PY (
  echo [X] Chua cai Python. Tai tai: https://www.python.org/downloads/
  echo     Nho tick "Add Python to PATH" khi cai.
  pause
  exit /b 1
)

%PY% -c "import jieba, pypinyin, openpyxl, youtube_transcript_api, yt_dlp, zhconv" >nul 2>&1
if errorlevel 1 (
  echo [!] Dang cai thu vien lan dau, cho 1-2 phut...
  %PY% -m pip install --upgrade pip
  %PY% -m pip install -U youtube-transcript-api jieba pypinyin openpyxl yt-dlp zhconv
  echo.
)

%PY% "%~dp0HA_video.py" %*

echo.
echo ============================================================
pause
endlocal

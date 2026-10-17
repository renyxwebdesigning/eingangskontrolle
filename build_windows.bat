@echo off
setlocal
cd /d "%~dp0"
echo ============================================
echo  Eingangskontrolle - Windows-Programm bauen
echo ============================================
where python >nul 2>nul
if errorlevel 1 (
    echo FEHLER: Python wurde nicht gefunden.
    echo Python 3 von python.org installieren und "Add python.exe to PATH" anhaken.
    pause
    exit /b 1
)
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 ( echo FEHLER beim Installieren der Pakete. & pause & exit /b 1 )
python -m PyInstaller --noconfirm --distpath dist --workpath build desktop\eingangskontrolle.spec
if errorlevel 1 ( echo FEHLER beim Bauen. & pause & exit /b 1 )
echo.
echo Fertig: dist\Eingangskontrolle.exe
echo Die Datei kann auf jeden Windows-10/11-PC kopiert werden.
pause

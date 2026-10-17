@echo off
setlocal

echo ============================================
echo  Eingangskontrolle Baumaschinen - Windows Build
echo ============================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo FEHLER: Python wurde nicht gefunden.
    echo Bitte zuerst Python 3 installieren ^(python.org^) und beim
    echo Installieren das Haekchen "Add python.exe to PATH" setzen.
    pause
    exit /b 1
)

echo Installiere benoetigte Python-Pakete ^(pyinstaller, pillow, reportlab^)...
python -m pip install --upgrade pip
python -m pip install pyinstaller pillow reportlab
if errorlevel 1 (
    echo FEHLER beim Installieren der Pakete.
    pause
    exit /b 1
)

echo.
echo Baue Eingangskontrolle_App.exe ...
python -m PyInstaller --onefile --windowed ^
    --name "Eingangskontrolle_App" ^
    --add-data "eberhard_logo.png;." ^
    --hidden-import "PIL._tkinter_finder" ^
    --distpath "." ^
    --workpath "build_tmp" ^
    --specpath "build_tmp" ^
    --noconfirm ^
    eingangskontrolle.py

if errorlevel 1 (
    echo.
    echo FEHLER beim Bauen der Anwendung.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Fertig! Eingangskontrolle_App.exe liegt in
echo  diesem Ordner und kann auf beliebige
echo  Windows-PCs kopiert werden ^(kein Python
echo  auf dem Zielrechner noetig^).
echo ============================================
pause

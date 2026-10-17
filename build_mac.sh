#!/usr/bin/env bash
# Baut Eingangskontrolle.app auf einem Mac.  Aufruf: ./build_mac.sh
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv-mac
.venv-mac/bin/pip install --upgrade pip
.venv-mac/bin/pip install -r requirements.txt
.venv-mac/bin/python -m PyInstaller --noconfirm --distpath dist --workpath build desktop/eingangskontrolle.spec
echo "Fertig: dist/Eingangskontrolle.app"
echo "Beim ersten Start: Rechtsklick auf die App > Öffnen (App ist nicht von Apple signiert)."

#!/usr/bin/env bash
# Installiert die Eingangskontrolle auf Linux als Programm im Startmenü.
# Aufruf: ./install_linux.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

if ! python3 -c "import gi; gi.require_version('WebKit2', '4.1')" 2>/dev/null &&
   ! python3 -c "import gi; gi.require_version('WebKit2', '4.0')" 2>/dev/null; then
  echo "Es fehlt WebKitGTK für Python. Bitte zuerst installieren:"
  echo "  Debian/Ubuntu/Kali:  sudo apt install python3-gi gir1.2-webkit2-4.1"
  echo "  Fedora:              sudo dnf install python3-gobject webkit2gtk4.1"
  exit 1
fi

python3 -m venv --system-site-packages "$DIR/.venv"
"$DIR/.venv/bin/pip" install --quiet --upgrade pywebview

APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$APPS"
cat > "$APPS/eingangskontrolle.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Eingangskontrolle
Comment=Eingangskontrolle Baumaschinen – Eberhard
Exec="$DIR/.venv/bin/python" "$DIR/desktop/main.py"
Icon=$DIR/desktop/icon.png
Terminal=false
Categories=Office;
StartupWMClass=Eingangskontrolle
DESKTOP
update-desktop-database "$APPS" 2>/dev/null || true
echo "Fertig. „Eingangskontrolle“ ist jetzt im Startmenü."

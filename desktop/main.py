"""Eingangskontrolle – Desktop-App (Windows, macOS, Linux).

Zeigt die Web-Oberfläche aus ../app in einem eigenen Programmfenster
(pywebview) und stellt ihr eine kleine Python-API bereit:
Kontrollen als JSON-Dateien speichern, PDFs über den Speichern-Dialog des
Systems ablegen und PDFs zum Drucken im PDF-Betrachter öffnen.

Start aus dem Quellcode:  python desktop/main.py
"""
import base64
import functools
import http.server
import json
import os
import re
import socketserver
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

import webview

APP_NAME = "Eingangskontrolle"
PORT = 47731  # fixed so the page origin (and its small preferences) stays the same


def resource_dir():
    """Folder with the web app, both from source and inside a PyInstaller build."""
    if hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS) / "app"
    return Path(__file__).resolve().parent.parent / "app"


def data_dir():
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
        d = base / APP_NAME
    elif sys.platform == "darwin":
        d = Path.home() / "Library" / "Application Support" / APP_NAME
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
        d = base / "eingangskontrolle"
    (d / "kontrollen").mkdir(parents=True, exist_ok=True)
    (d / "papierkorb").mkdir(parents=True, exist_ok=True)
    return d


def documents_dir():
    home = Path.home()
    if sys.platform.startswith("linux"):
        try:
            out = subprocess.run(["xdg-user-dir", "DOCUMENTS"], capture_output=True, text=True, timeout=3)
            p = Path(out.stdout.strip())
            if out.returncode == 0 and p.is_dir() and p != home:
                return p
        except (OSError, subprocess.SubprocessError):
            pass
    for name in ("Documents", "Dokumente"):
        if (home / name).is_dir():
            return home / name
    return home


def open_with_system(path):
    if sys.platform == "win32":
        os.startfile(str(path))  # noqa: S606 – opens the user's PDF viewer
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


SAVE_DIALOG = webview.FileDialog.SAVE if hasattr(webview, "FileDialog") else webview.SAVE_DIALOG
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class Api:
    def __init__(self):
        self._window = None
        self._dir = data_dir()
        self._records = self._dir / "kontrollen"
        self._settings_file = self._dir / "einstellungen.json"
        self._settings = self._read_json(self._settings_file) or {}

    # ---------- helpers (underscore = not exposed to JavaScript) ----------

    @staticmethod
    def _read_json(path):
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None

    @staticmethod
    def _write_atomic(path, data: bytes):
        tmp = path.with_name(path.name + ".tmp")
        with open(tmp, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)

    def _save_settings(self):
        self._write_atomic(self._settings_file, json.dumps(self._settings, indent=2).encode("utf-8"))

    # ---------- records ----------

    def list_records(self):
        out = []
        for p in self._records.glob("*.json"):
            rec = self._read_json(p)
            if isinstance(rec, dict) and rec.get("id"):
                out.append(rec)
        return out

    def save_record(self, record):
        try:
            rid = str(record.get("id", ""))
            if not SAFE_ID.match(rid):
                return "Ungültige Kontroll-ID"
            data = json.dumps(record, ensure_ascii=False).encode("utf-8")
            self._write_atomic(self._records / f"{rid}.json", data)
            return True
        except Exception as exc:  # reported back to the UI
            return str(exc)

    def delete_record(self, rid):
        # Never really delete: move into the "papierkorb" folder instead.
        if not SAFE_ID.match(str(rid)):
            return False
        src = self._records / f"{rid}.json"
        if src.exists():
            os.replace(src, self._dir / "papierkorb" / src.name)
        return True

    # ---------- PDF ----------

    def save_pdf(self, filename, b64):
        try:
            start = self._settings.get("pdf_dir")
            if not start or not Path(start).is_dir():
                start = str(documents_dir())
            result = self._window.create_file_dialog(
                SAVE_DIALOG,
                directory=start,
                save_filename=filename,
                file_types=("PDF-Dokument (*.pdf)",),
            )
            if not result:
                return {"path": None}
            path = Path(result if isinstance(result, str) else result[0])
            if path.suffix.lower() != ".pdf":
                path = path.with_suffix(".pdf")
            self._write_atomic(path, base64.b64decode(b64))
            self._settings["pdf_dir"] = str(path.parent)
            self._save_settings()
            return {"path": str(path)}
        except Exception as exc:
            return {"error": str(exc)}

    def print_pdf(self, filename, b64):
        try:
            folder = Path(tempfile.gettempdir()) / "eingangskontrolle-druck"
            folder.mkdir(exist_ok=True)
            path = folder / filename
            path.write_bytes(base64.b64decode(b64))
            open_with_system(path)
            key = "⌘P" if sys.platform == "darwin" else "Strg+P"
            return {"message": f"PDF geöffnet – mit {key} drucken"}
        except Exception as exc:
            return {"error": str(exc)}

    def open_data_folder(self):
        open_with_system(self._dir)
        return True


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".webmanifest": "application/manifest+json",
        ".woff2": "font/woff2",
    }

    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def start_server():
    handler = functools.partial(QuietHandler, directory=str(resource_dir()))
    socketserver.TCPServer.allow_reuse_address = True
    for port in (PORT, 0):
        try:
            httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), handler)
            break
        except OSError:
            continue
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd.server_address[1]


def main():
    if sys.platform == "win32":
        try:  # sharp text on high-DPI screens
            import ctypes

            ctypes.windll.shcore.SetProcessDpiAwareness(2)
        except Exception:
            pass

    api = Api()
    port = start_server()
    window = webview.create_window(
        "Eingangskontrolle – Eberhard",
        f"http://127.0.0.1:{port}/index.html?desktop=1",
        js_api=api,
        width=1120,
        height=860,
        min_size=(420, 560),
        background_color="#F4F4F1",
        text_select=True,
    )
    api._window = window

    def on_closing():
        # Flush the debounced autosave before the window goes away.
        try:
            window.evaluate_js("window.__flushBeforeClose && window.__flushBeforeClose()")
        except Exception:
            pass

    window.events.closing += on_closing
    icon = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)) / "icon.png"
    webview.start(
        private_mode=False,
        storage_path=str(api._dir / "webview"),
        icon=str(icon) if icon.exists() else None,
        debug="--debug" in sys.argv,
    )


if __name__ == "__main__":
    main()

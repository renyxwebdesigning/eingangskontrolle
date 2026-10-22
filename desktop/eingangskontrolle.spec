# PyInstaller-Bauplan für Windows, macOS und Linux.
# Bauen (aus dem Projektordner):  pyinstaller desktop/eingangskontrolle.spec
import sys
from pathlib import Path

HERE = Path(SPECPATH)
ROOT = HERE.parent
NAME = "Eingangskontrolle"

EXCLUDES = ["tkinter", "PyQt5", "PyQt6", "PySide2", "PySide6", "qtpy", "numpy", "PIL", "matplotlib", "cryptography"]
if sys.platform != "win32":
    # Windows needs cffi for pythonnet (the .NET window of pywebview).
    EXCLUDES += ["pycparser", "cffi"]

a = Analysis(
    [str(HERE / "main.py")],
    datas=[(str(ROOT / "app"), "app"), (str(HERE / "icon.png"), ".")],
    hiddenimports=["clr_loader", "cffi", "_cffi_backend"] if sys.platform == "win32" else [],
    excludes=EXCLUDES,
)
pyz = PYZ(a.pure)

if sys.platform == "darwin":
    exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name=NAME, console=False, icon=None)
    coll = COLLECT(exe, a.binaries, a.datas, name=NAME)
    app = BUNDLE(
        coll,
        name=f"{NAME}.app",
        icon=str(HERE / "icon.png"),  # PyInstaller wandelt PNG mit Pillow in .icns um
        bundle_identifier="ch.eberhard.eingangskontrolle",
        info_plist={"NSHighResolutionCapable": True, "CFBundleDisplayName": "Eingangskontrolle"},
    )
else:
    # One single file to copy onto any PC.
    exe = EXE(
        pyz, a.scripts, a.binaries, a.datas, [],
        name=NAME,
        console=False,
        icon=str(HERE / "icon.ico") if sys.platform == "win32" else None,
        upx=False,
    )

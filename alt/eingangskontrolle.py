import json
import os
import subprocess
import sys
from datetime import date, datetime

import tkinter as tk
from tkinter import ttk, filedialog, messagebox

from PIL import Image, ImageTk


def resource_path(relative_path):
    base_path = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_path, relative_path)


APP_DIR = os.path.dirname(os.path.abspath(__file__))
LOGO_PATH = resource_path("eberhard_logo.png")


def get_documents_dir():
    home = os.path.expanduser("~")
    for name in ("Documents", "Dokumente"):
        candidate = os.path.join(home, name)
        if os.path.isdir(candidate):
            return candidate
    return home

TEAL = "#0f5c66"
TEAL_DARK = "#0b464e"
YELLOW = "#f2c230"
BG = "#f2f4f5"
CARD = "#ffffff"
BORDER = "#e0e3e6"
TEXT = "#20262b"
MUTED = "#6b7580"
OK_GREEN = "#1e9e5a"
MANGEL_RED = "#d84343"
ROW_ALT = "#f7f9fa"

FONT_UI = "Cantarell"
FONT_MONO = "DejaVu Sans"

WINDOW_WIDTH = 1020
CHECKLIST_HEIGHT = 360
CHIP_SIZE = 34
NR_COL_W = 40
CHIP_COL_W = CHIP_SIZE + 6

ITEMS = [
    ("01", "Allgemeiner Zustand / sichtbare Schäden"),
    ("02", "Sauberkeit Maschine / Fahrerplatz / Kabine"),
    ("03", "Motoröl – Ölstand / sichtbare Leckagen"),
    ("04", "Hydrauliköl – Ölstand / sichtbare Leckagen"),
    ("05", "Kühlmittel – Stand / Zustand / Leckagen"),
    ("06", "Kraftstoff – Stand / Tank / Leckagen"),
    ("07", "AdBlue – Stand / Anlage (falls vorhanden)"),
    ("08", "Hydraulikschläuche / Leitungen / Anschlüsse"),
    ("09", "Motorraum – Leitungen, Riemen, Kabel, Leckagen"),
    ("10", "Batterie / Batteriepole / Hauptschalter"),
    ("11", "Luftfilter / Ansaugsystem"),
    ("12", "Bremsanlage / Feststellbremse"),
    ("13", "Reifen / Räder / Radmuttern"),
    ("14", "Raupen / Laufwerk / Ketten / Rollen (falls vorhanden)"),
    ("15", "Beleuchtung / Warnleuchten / Rundumleuchte"),
    ("16", "Scheiben / Spiegel / Scheibenwischer / Waschanlage"),
    ("17", "Sicherheitsgurte / Türen / Notausstieg"),
    ("18", "Hupe / Rückfahrwarner / Kamera (falls vorhanden)"),
    ("19", "Instrumente / Kontrolllampen / Fehlermeldungen"),
    ("20", "Fahr- und Lenkfunktion / ungewöhnliche Geräusche"),
    ("21", "Arbeitsfunktion / Hydraulikfunktion / Anbaugerät"),
    ("22", "Flüssigkeits- und Ölaustritte unter der Maschine"),
    ("23", "Werkzeug / Zubehör / vorgeschriebene Ausrüstung"),
    ("24", "Probefahrt / Funktionstest durchgeführt"),
    ("25", "Fehler / Mängel dokumentiert und weitergemeldet"),
    ("26", "Vibration – Funktion, Antrieb, Lager"),
]

MACHINE_TYPES = [
    "Bagger",
    "Pneubagger",
    "Radlader",
    "Walze",
    "Dumper",
    "Kleingerät",
    "Spezialmaschinen",
]

# Which checklist items apply to which machine type. Items not listed for a
# type are hidden for that type's checklist (e.g. a Bagger has tracks, not
# tires, so "13 Reifen" is dropped and "14 Raupen" kept, and vice versa for
# wheeled machines). "Spezialmaschinen" is the catch-all for equipment that
# doesn't fit the other categories, so it keeps every item.
_ALL_NRS = {nr for nr, _ in ITEMS}
MACHINE_ITEM_FILTER = {
    # Tracked excavator: no tires, and no vibration/compaction drum.
    "Bagger": _ALL_NRS - {"13", "26"},
    # Wheeled excavator: tires instead of tracks, no vibration drum.
    "Pneubagger": _ALL_NRS - {"14", "26"},
    "Radlader": _ALL_NRS - {"14", "26"},
    # Rollers: usually an open platform, not a full cabin (no windshield/wiper),
    # no tracks, but they do have a vibration/compaction drum.
    "Walze": _ALL_NRS - {"14", "16"},
    # Site dumpers are typically wheeled, open ROPS platforms without a full
    # cabin (no windshield/wiper), no vibration drum.
    "Dumper": _ALL_NRS - {"14", "16", "26"},
    # Small/handheld equipment (plate compactors, cut-off saws, pumps, ...):
    # no hydraulics, cabin, tires/tracks, brakes, steering, or lighting to
    # check.
    "Kleingerät": {"01", "02", "03", "06", "09", "10", "11", "19", "21", "22", "23", "24", "25"},
    # Catch-all for anything else – show the full checklist.
    "Spezialmaschinen": set(_ALL_NRS),
}


def rounded_rect(canvas, x1, y1, x2, y2, r, **kwargs):
    points = [
        x1 + r, y1, x2 - r, y1, x2, y1, x2, y1 + r,
        x2, y2 - r, x2, y2, x2 - r, y2, x1 + r, y2,
        x1, y2, x1, y2 - r, x1, y1 + r, x1, y1,
    ]
    return canvas.create_polygon(points, smooth=True, **kwargs)


class ToggleChip(tk.Canvas):
    def __init__(self, parent, glyph, active_color, on_click, bg, size=CHIP_SIZE):
        super().__init__(
            parent, width=size, height=size, bg=bg, highlightthickness=0, cursor="hand2",
        )
        self.size = size
        self.glyph = glyph
        self.active_color = active_color
        self.on_click_cb = on_click
        self.selected = False
        self.bind("<Button-1>", lambda e: self.on_click_cb())
        self.render()

    def render(self):
        self.delete("all")
        s = self.size
        if self.selected:
            fill, outline = self.active_color, self.active_color
        else:
            fill, outline = "#ffffff", "#c7ccd1"
        rounded_rect(self, 3, 3, s - 3, s - 3, 9, fill=fill, outline=outline, width=2)
        if self.selected:
            self.create_text(s / 2, s / 2, text=self.glyph, fill="white", font=(FONT_UI, 16, "bold"))

    def set_selected(self, value):
        self.selected = value
        self.render()


class ChecklistRow:
    def __init__(self, parent, row_index, nr, text, on_change):
        self.nr = nr
        self.text = text
        self.on_change = on_change
        self.status_val = None
        self.bemerkung_var = tk.StringVar(value="")

        bg = CARD if row_index % 2 == 0 else ROW_ALT

        self.frame = tk.Frame(parent, bg=bg)
        self.frame.grid(row=row_index * 2, column=0, sticky="ew")
        self.frame.columnconfigure(0, minsize=NR_COL_W)
        self.frame.columnconfigure(1, weight=0, minsize=300)
        self.frame.columnconfigure(2, minsize=CHIP_COL_W)
        self.frame.columnconfigure(3, minsize=CHIP_COL_W)
        self.frame.columnconfigure(4, weight=2)

        tk.Label(
            self.frame, text=nr, bg=bg, fg=MUTED, font=(FONT_MONO, 10, "bold")
        ).grid(row=0, column=0, padx=(14, 0), pady=4, sticky="w")

        tk.Label(
            self.frame, text=text, bg=bg, fg=TEXT, font=(FONT_UI, 10),
            anchor="w", justify="left", wraplength=290,
        ).grid(row=0, column=1, padx=6, pady=4, sticky="w")

        self.ok_chip = ToggleChip(self.frame, "✓", OK_GREEN, self._toggle_ok, bg=bg)
        self.ok_chip.grid(row=0, column=2, padx=(6, 0), pady=4, sticky="w")

        self.mangel_chip = ToggleChip(self.frame, "!", MANGEL_RED, self._toggle_mangel, bg=bg)
        self.mangel_chip.grid(row=0, column=3, padx=(6, 0), pady=4, sticky="w")

        entry = tk.Entry(
            self.frame, textvariable=self.bemerkung_var, font=(FONT_UI, 10),
            relief="flat", bg="#fbfbfc", highlightthickness=1,
            highlightbackground=BORDER, highlightcolor=TEAL,
        )
        entry.grid(row=0, column=4, padx=(6, 14), pady=4, sticky="ew", ipady=3)

    def _toggle_ok(self):
        self.status_val = None if self.status_val == "ok" else "ok"
        self._refresh()

    def _toggle_mangel(self):
        self.status_val = None if self.status_val == "mangel" else "mangel"
        self._refresh()

    def _refresh(self):
        self.ok_chip.set_selected(self.status_val == "ok")
        self.mangel_chip.set_selected(self.status_val == "mangel")
        self.on_change()

    def status(self):
        return self.status_val

    def set_status(self, status):
        self.status_val = status
        self._refresh()

    def to_dict(self):
        return {
            "nr": self.nr,
            "text": self.text,
            "status": self.status_val,
            "bemerkung": self.bemerkung_var.get(),
        }

    def load(self, data):
        self.set_status(data.get("status"))
        self.bemerkung_var.set(data.get("bemerkung", ""))

    def reset(self):
        self.set_status(None)
        self.bemerkung_var.set("")


class KontrolleTab(tk.Frame):
    def __init__(self, parent, app, machine_type):
        super().__init__(parent, bg=BG)
        self.app = app
        self.machine_type = machine_type
        self.rows = []
        self.current_file = None
        self.draft_file = None

        self._build_machine_fields()
        # Pack the bottom-pinned, fixed-height sections BEFORE the expanding
        # checklist area. Tk's packer reserves cavity space in call order, so
        # side="bottom" widgets packed after an expand=True/fill="both"
        # widget can end up with no space left and render outside the
        # window (the action bar was getting cut off on smaller screens).
        self._build_actionbar()
        self._build_abschluss()
        self._build_checklist()

        self._reset_fields()

    def _section_label(self, parent, text):
        tk.Label(
            parent, text=text, bg=TEAL, fg="white", font=(FONT_UI, 9, "bold"),
            anchor="w", padx=14, pady=5,
        ).pack(fill="x")

    def _build_machine_fields(self):
        card = tk.Frame(self, bg=CARD, highlightbackground=BORDER, highlightthickness=1)
        card.pack(fill="x", padx=16, pady=(12, 6))

        self._section_label(card, "BESCHREIBUNG DER MASCHINE")

        self.machine_type_label = tk.Label(
            card, text=self._machine_type_label_text(), bg=CARD, fg=TEAL,
            font=(FONT_UI, 10, "bold"), anchor="w",
        )
        self.machine_type_label.pack(fill="x", padx=12, pady=(8, 0))

        grid = tk.Frame(card, bg=CARD)
        grid.pack(fill="x", padx=12, pady=8)
        grid.columnconfigure(1, weight=1)
        grid.columnconfigure(3, weight=1)

        self.fields = {}
        field_layout = [
            ("Inventarnummer", "inventarnummer", 0, 0),
            ("Stunden", "stunden", 0, 2),
            ("Stunden SAP", "stunden_sap", 1, 0),
            ("Letzter Service", "letzter_service", 1, 2),
            ("Letzter Abgastest", "letzter_abgastest", 2, 0),
            ("Datum Kontrolle", "datum", 2, 2),
            ("Geprüft durch", "geprueft_durch", 3, 0),
        ]
        for label, key, r, c in field_layout:
            tk.Label(
                grid, text=label, bg=CARD, fg=MUTED, font=(FONT_UI, 8, "bold"), anchor="w"
            ).grid(row=r * 2, column=c, columnspan=2, sticky="w", padx=6, pady=(4, 0))
            var = tk.StringVar()
            tk.Entry(
                grid, textvariable=var, font=(FONT_UI, 10), relief="flat", bg="#fbfbfc",
                highlightthickness=1, highlightbackground=BORDER, highlightcolor=TEAL,
            ).grid(row=r * 2 + 1, column=c, columnspan=2, sticky="ew", padx=6, pady=(1, 4), ipady=3)
            self.fields[key] = var

        self.fields["inventarnummer"].trace_add("write", lambda *a: self.app.rename_tab(self))

    def _build_checklist(self):
        outer = tk.Frame(self, bg=BG)
        outer.pack(fill="both", expand=True, padx=16, pady=4)

        card_top = tk.Frame(outer, bg=CARD, highlightbackground=BORDER, highlightthickness=1)
        card_top.pack(fill="both", expand=True)

        header = tk.Frame(card_top, bg=TEAL_DARK)
        header.pack(fill="x")
        header.columnconfigure(0, minsize=NR_COL_W)
        header.columnconfigure(1, weight=0, minsize=300)
        header.columnconfigure(2, minsize=CHIP_COL_W)
        header.columnconfigure(3, minsize=CHIP_COL_W)
        header.columnconfigure(4, weight=2)
        tk.Label(header, text="Nr", bg=TEAL_DARK, fg="white", font=(FONT_UI, 9, "bold"), anchor="w").grid(
            row=0, column=0, padx=(14, 0), pady=7, sticky="w"
        )
        tk.Label(
            header, text="Kontrollpunkt", bg=TEAL_DARK, fg="white", font=(FONT_UI, 9, "bold"), anchor="w"
        ).grid(row=0, column=1, padx=6, sticky="w")
        tk.Label(
            header, text="OK", bg=TEAL_DARK, fg="white", font=(FONT_UI, 9, "bold"), anchor="w"
        ).grid(row=0, column=2, padx=(6, 0), sticky="w")
        tk.Label(
            header, text="Mangel", bg=TEAL_DARK, fg="white", font=(FONT_UI, 9, "bold"), anchor="w"
        ).grid(row=0, column=3, padx=(6, 0), sticky="w")
        tk.Label(
            header, text="Bemerkung / Feststellung", bg=TEAL_DARK, fg="white", font=(FONT_UI, 9, "bold"), anchor="w"
        ).grid(row=0, column=4, sticky="w", padx=(6, 14))

        canvas = tk.Canvas(card_top, bg=CARD, highlightthickness=0, height=CHECKLIST_HEIGHT)
        scrollbar = ttk.Scrollbar(card_top, orient="vertical", command=canvas.yview)
        self.list_frame = tk.Frame(canvas, bg=CARD)

        self.list_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas_window = canvas.create_window((0, 0), window=self.list_frame, anchor="nw")
        canvas.bind("<Configure>", lambda e: canvas.itemconfig(canvas_window, width=e.width))
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        self.canvas = canvas

        def _on_mousewheel(event):
            if event.num == 4:
                canvas.yview_scroll(-3, "units")
            elif event.num == 5:
                canvas.yview_scroll(3, "units")
            else:
                canvas.yview_scroll(int(-1 * (event.delta / 120)) * 3, "units")

        self._mousewheel_handler = _on_mousewheel

        self._populate_rows()

    def _machine_type_label_text(self):
        return f"Maschinentyp: {self.machine_type}"

    def _visible_items(self):
        allowed = MACHINE_ITEM_FILTER.get(self.machine_type)
        if allowed is None:
            return list(ITEMS)
        return [(nr, text) for nr, text in ITEMS if nr in allowed]

    def _populate_rows(self):
        for child in self.list_frame.winfo_children():
            child.destroy()
        self.rows = []
        items = self._visible_items()
        for i, (nr, text) in enumerate(items):
            row = ChecklistRow(self.list_frame, i, nr, text, self._update_status)
            self.rows.append(row)
            if i < len(items) - 1:
                tk.Frame(self.list_frame, bg=BORDER, height=1).grid(row=i * 2 + 1, column=0, sticky="ew")

    def _rebuild_for_machine_type(self, machine_type):
        self.machine_type = machine_type
        self.machine_type_label.config(text=self._machine_type_label_text())
        self._populate_rows()
        self._update_status()

    def bind_scroll(self):
        self.canvas.bind_all("<MouseWheel>", self._mousewheel_handler)
        self.canvas.bind_all("<Button-4>", self._mousewheel_handler)
        self.canvas.bind_all("<Button-5>", self._mousewheel_handler)

    def _build_abschluss(self):
        card = tk.Frame(self, bg=CARD, highlightbackground=BORDER, highlightthickness=1)
        card.pack(fill="x", padx=16, pady=6, side="bottom")
        self._section_label(card, "ABSCHLUSS")
        tk.Label(
            card, text="Festgestellte Mängel / notwendige Arbeiten:", bg=CARD, fg=MUTED,
            font=(FONT_UI, 8, "bold"), anchor="w",
        ).pack(fill="x", padx=12, pady=(6, 3))
        self.abschluss_text = tk.Text(
            card, height=4, font=(FONT_UI, 10), relief="flat", bg="#fbfbfc",
            highlightthickness=1, highlightbackground=BORDER, highlightcolor=TEAL,
        )
        self.abschluss_text.pack(fill="x", padx=12, pady=(0, 10))

    def _build_actionbar(self):
        bar = tk.Frame(self, bg=CARD, highlightbackground=BORDER, highlightthickness=1)
        bar.pack(fill="x", side="bottom")

        info = tk.Frame(bar, bg=CARD)
        info.pack(side="left", padx=16, pady=10)
        self.progress_label = tk.Label(info, text="", bg=CARD, fg=MUTED, font=(FONT_UI, 9))
        self.progress_label.pack(anchor="w")
        self.result_label = tk.Label(info, text="", bg=CARD, font=(FONT_UI, 11, "bold"))
        self.result_label.pack(anchor="w")

        btns = tk.Frame(bar, bg=CARD)
        btns.pack(side="right", padx=12, pady=10)

        ttk.Button(btns, text="Entwurf laden", style="Secondary.TButton", command=self._load_draft).pack(side="left", padx=3)
        ttk.Button(btns, text="Entwurf speichern", style="Secondary.TButton", command=self._save_draft).pack(side="left", padx=3)
        ttk.Button(btns, text="Drucken", style="Secondary.TButton", command=self._print).pack(side="left", padx=3)
        ttk.Button(btns, text="Speichern", style="Primary.TButton", command=self._save).pack(side="left", padx=(8, 0))

    # ---------- behaviour ----------

    def _update_status(self):
        checked = sum(1 for r in self.rows if r.status() is not None)
        mangel_count = sum(1 for r in self.rows if r.status() == "mangel")
        self.progress_label.config(text=f"{checked} / {len(self.rows)} Punkte geprüft")

        if checked < len(self.rows):
            self.result_label.config(text="Kontrolle unvollständig", fg=MUTED)
        elif mangel_count == 0:
            self.result_label.config(text="Keine Mängel festgestellt", fg=OK_GREEN)
        else:
            self.result_label.config(text=f"{mangel_count} Mangel/Mängel festgestellt", fg=MANGEL_RED)

    def _collect(self):
        maschine = {k: v.get() for k, v in self.fields.items()}
        maschine["typ"] = self.machine_type
        return {
            "maschine": maschine,
            "items": [r.to_dict() for r in self.rows],
            "abschluss": self.abschluss_text.get("1.0", "end").strip(),
            "gespeichert_am": datetime.now().isoformat(timespec="seconds"),
        }

    def _reset_fields(self):
        for var in self.fields.values():
            var.set("")
        self.fields["datum"].set(date.today().strftime("%d.%m.%Y"))
        for row in self.rows:
            row.reset()
        self.abschluss_text.delete("1.0", "end")
        self.current_file = None
        self._update_status()

    def _save_draft(self):
        inv = self.fields["inventarnummer"].get().strip() or "Kontrolle"
        inv_safe = "".join(c for c in inv if c.isalnum() or c in "-_ ").strip() or "Kontrolle"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        default_name = f"Eingangskontrolle_{inv_safe}_{timestamp}.json"
        path = filedialog.asksaveasfilename(
            title="Entwurf speichern unter",
            defaultextension=".json",
            initialfile=default_name,
            initialdir=get_documents_dir(),
            filetypes=[("JSON-Datei", "*.json"), ("Alle Dateien", "*.*")],
        )
        if not path:
            return
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(self._collect(), f, ensure_ascii=False, indent=2)
        except Exception as exc:
            messagebox.showerror("Fehler", f"Entwurf konnte nicht gespeichert werden:\n{exc}")
            return
        self.draft_file = path
        messagebox.showinfo("Gespeichert", f"Entwurf gespeichert unter:\n{path}")

    def _load_draft(self):
        path = filedialog.askopenfilename(
            title="Entwurf laden",
            initialdir=get_documents_dir(),
            filetypes=[("JSON-Datei", "*.json"), ("Alle Dateien", "*.*")],
        )
        if not path:
            return
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as exc:
            messagebox.showerror("Fehler", f"Entwurf konnte nicht geladen werden:\n{exc}")
            return

        m = data.get("maschine", {})
        loaded_type = m.get("typ")
        if loaded_type and loaded_type in MACHINE_ITEM_FILTER and loaded_type != self.machine_type:
            self._rebuild_for_machine_type(loaded_type)

        for key, var in self.fields.items():
            var.set(m.get(key, ""))

        items_by_nr = {item.get("nr"): item for item in data.get("items", [])}
        for row in self.rows:
            item = items_by_nr.get(row.nr)
            if item:
                row.load(item)
            else:
                row.reset()

        self.abschluss_text.delete("1.0", "end")
        self.abschluss_text.insert("1.0", data.get("abschluss", ""))

        self.draft_file = path
        self._update_status()

    def _save(self):
        inv = self.fields["inventarnummer"].get().strip() or "Kontrolle"
        inv_safe = "".join(c for c in inv if c.isalnum() or c in "-_ ").strip() or "Kontrolle"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        default_name = f"Eingangskontrolle_{inv_safe}_{timestamp}.pdf"
        path = filedialog.asksaveasfilename(
            title="Kontrolle speichern unter",
            defaultextension=".pdf",
            initialfile=default_name,
            initialdir=get_documents_dir(),
            filetypes=[("PDF-Dokument", "*.pdf"), ("Alle Dateien", "*.*")],
        )
        if not path:
            return
        try:
            self._build_pdf(path)
        except Exception as exc:
            messagebox.showerror("Fehler", f"PDF konnte nicht erstellt werden:\n{exc}")
            return
        self.current_file = path
        messagebox.showinfo("Gespeichert", f"Kontrolle gespeichert unter:\n{path}")

    def _build_pdf(self, path):
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib import colors
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage,
        )

        data = self._collect()
        cell = ParagraphStyle("cell", fontName="Helvetica", fontSize=7.6, leading=9)
        heading = ParagraphStyle("heading", fontName="Helvetica-Bold", fontSize=13, leading=15)
        small = ParagraphStyle("small", fontName="Helvetica", fontSize=6.5, textColor=colors.HexColor(MUTED))
        abschluss_style = ParagraphStyle("abschluss", fontName="Helvetica", fontSize=8, leading=10)

        doc = SimpleDocTemplate(
            path, pagesize=A4,
            topMargin=9 * mm, bottomMargin=9 * mm, leftMargin=10 * mm, rightMargin=10 * mm,
        )
        story = []

        try:
            logo_w, logo_h = Image.open(LOGO_PATH).size
            logo = RLImage(LOGO_PATH, width=28 * mm, height=28 * mm * logo_h / logo_w)
        except Exception:
            logo = Paragraph("<b>Eberhard</b>", heading)
        title_tbl = Table(
            [[logo, Paragraph("Eingangskontrolle Baumaschinen", heading)]],
            colWidths=[30 * mm, 150 * mm],
        )
        title_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(title_tbl)
        story.append(Spacer(1, 5))

        m = data["maschine"]
        machine_rows = [
            ["Inventarnummer:", m.get("inventarnummer", ""), "Stunden:", m.get("stunden", "")],
            ["Stunden SAP:", m.get("stunden_sap", ""), "Letzter Service:", m.get("letzter_service", "")],
            ["Letzter Abgastest:", m.get("letzter_abgastest", ""), "Datum:", m.get("datum", "")],
            ["Geprüft durch:", m.get("geprueft_durch", ""), "Maschinentyp:", m.get("typ", "")],
        ]
        mtable = Table(machine_rows, colWidths=[30 * mm, 55 * mm, 30 * mm, 55 * mm])
        mtable.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor(BORDER)),
        ]))
        story.append(mtable)
        story.append(Spacer(1, 6))

        table_data = [["Nr", "Kontrollpunkt", "Status", "Bemerkung / Feststellung"]]
        for item in data["items"]:
            if item["status"] == "ok":
                status = "OK"
            elif item["status"] == "mangel":
                status = "Mangel"
            else:
                status = "–"
            table_data.append([
                item["nr"], Paragraph(item["text"], cell), status,
                Paragraph(item["bemerkung"] or "", cell),
            ])

        ctable = Table(table_data, colWidths=[7 * mm, 98 * mm, 15 * mm, 70 * mm], repeatRows=1)
        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(TEAL_DARK)),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 7.6),
            ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 1), (0, -1), 7.6),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor(BORDER)),
            ("TOPPADDING", (0, 0), (-1, -1), 1.6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.6),
        ]
        for i, item in enumerate(data["items"], start=1):
            if item["status"] == "mangel":
                style_cmds.append(("TEXTCOLOR", (2, i), (2, i), colors.HexColor(MANGEL_RED)))
                style_cmds.append(("FONTNAME", (2, i), (2, i), "Helvetica-Bold"))
            elif item["status"] == "ok":
                style_cmds.append(("TEXTCOLOR", (2, i), (2, i), colors.HexColor(OK_GREEN)))
            if i % 2 == 0:
                style_cmds.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor(ROW_ALT)))
        ctable.setStyle(TableStyle(style_cmds))
        story.append(ctable)
        story.append(Spacer(1, 6))

        abschluss_tbl = Table(
            [[Paragraph(
                "<b>Festgestellte Mängel / notwendige Arbeiten:</b><br/>" +
                (data["abschluss"] or "–").replace("\n", "<br/>"),
                abschluss_style,
            )]],
            colWidths=[190 * mm], rowHeights=[22 * mm],
        )
        abschluss_tbl.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor(BORDER)),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(abschluss_tbl)
        story.append(Spacer(1, 6))
        story.append(Paragraph(f"Ausgedruckt am {datetime.now().strftime('%d.%m.%Y %H:%M')}", small))

        doc.build(story)

    @staticmethod
    def _list_printers():
        try:
            result = subprocess.run(
                ["lpstat", "-p"], capture_output=True, text=True, timeout=5
            )
        except Exception:
            return []
        printers = []
        for line in result.stdout.splitlines():
            parts = line.strip().split()
            if len(parts) >= 2 and parts[0] in ("Drucker", "printer"):
                printers.append(parts[1])
        return printers

    @staticmethod
    def _default_printer():
        try:
            result = subprocess.run(
                ["lpstat", "-d"], capture_output=True, text=True, timeout=5
            )
        except Exception:
            return None
        line = result.stdout.strip()
        if ":" in line:
            name = line.split(":", 1)[1].strip()
            return name or None
        return None

    def _ask_printer(self, printers):
        default = self._default_printer()
        dialog = tk.Toplevel(self)
        dialog.title("Drucker auswählen")
        dialog.configure(bg=CARD)
        dialog.transient(self.winfo_toplevel())
        dialog.resizable(False, False)

        tk.Label(
            dialog, text="Drucker auswählen:", bg=CARD, fg=TEXT,
            font=(FONT_UI, 11, "bold"),
        ).pack(padx=20, pady=(16, 8), anchor="w")

        selected = tk.StringVar(value=default if default in printers else printers[0])
        for p in printers:
            tk.Radiobutton(
                dialog, text=p, variable=selected, value=p, bg=CARD, fg=TEXT,
                font=(FONT_UI, 10), anchor="w", selectcolor=CARD, activebackground=CARD,
            ).pack(fill="x", padx=24, pady=2, anchor="w")

        result = {"value": None}

        def on_print():
            result["value"] = selected.get()
            dialog.destroy()

        def on_cancel():
            dialog.destroy()

        btns = tk.Frame(dialog, bg=CARD)
        btns.pack(fill="x", padx=16, pady=(12, 16))
        ttk.Button(btns, text="Abbrechen", style="Secondary.TButton", command=on_cancel).pack(
            side="right"
        )
        ttk.Button(btns, text="Drucken", style="Primary.TButton", command=on_print).pack(
            side="right", padx=(0, 8)
        )

        dialog.protocol("WM_DELETE_WINDOW", on_cancel)
        dialog.update_idletasks()
        top = self.winfo_toplevel()
        px, py = top.winfo_rootx(), top.winfo_rooty()
        pw, ph = top.winfo_width(), top.winfo_height()
        dw, dh = dialog.winfo_reqwidth(), dialog.winfo_reqheight()
        dialog.geometry(f"+{px + max(0, (pw - dw) // 2)}+{py + max(0, (ph - dh) // 2)}")

        dialog.grab_set()
        dialog.wait_window()
        return result["value"]

    def _print(self):
        inv = self.fields["inventarnummer"].get().strip() or "Kontrolle"
        default_name = f"Ausdruck_{inv}.pdf".replace(" ", "_")
        pdf_path = filedialog.asksaveasfilename(
            title="Als PDF drucken – Speicherort wählen",
            defaultextension=".pdf",
            initialfile=default_name,
            initialdir=get_documents_dir(),
            filetypes=[("PDF-Dokument", "*.pdf")],
        )
        if not pdf_path:
            return

        try:
            self._build_pdf(pdf_path)
        except Exception as exc:
            messagebox.showerror("Fehler", f"PDF konnte nicht erstellt werden:\n{exc}")
            return

        printers = self._list_printers()
        if not printers:
            try:
                subprocess.Popen(["xdg-open", pdf_path])
                messagebox.showinfo(
                    "PDF geöffnet",
                    "Kein Netzwerkdrucker gefunden – die PDF wurde zum manuellen Drucken geöffnet.",
                )
            except Exception:
                messagebox.showinfo("PDF erstellt", f"PDF gespeichert unter:\n{pdf_path}")
            return

        if len(printers) == 1:
            chosen = printers[0]
        else:
            chosen = self._ask_printer(printers)
            if not chosen:
                return

        try:
            subprocess.run(
                ["lp", "-d", chosen, pdf_path], check=True, capture_output=True, timeout=15
            )
            messagebox.showinfo(
                "Gedruckt", f"An „{chosen}“ gesendet:\n{os.path.basename(pdf_path)}"
            )
        except Exception as exc:
            messagebox.showerror("Fehler", f"Drucken fehlgeschlagen:\n{exc}")


class EingangskontrolleApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Eingangskontrolle Baumaschinen – Eberhard")
        self.configure(bg=BG)

        self._setup_style()
        self._build_header()

        self.notebook = ttk.Notebook(self, style="Tabs.TNotebook")
        self.notebook.pack(fill="both", expand=True)

        self.plus_tab = tk.Frame(self.notebook, bg=BG)
        self.notebook.add(self.plus_tab, text=" + ")

        self.tab_count = 0
        self._adding_tab = False
        self.notebook.bind("<<NotebookTabChanged>>", self._on_tab_changed)
        self.notebook.bind("<Button-1>", self._on_tab_click, add="+")

        self._add_tab()

    def _setup_style(self):
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TScrollbar", troughcolor=BG, background="#c7ccd1", bordercolor=BG, arrowsize=12)
        style.configure(
            "Primary.TButton", font=(FONT_UI, 11, "bold"), foreground="white",
            background=TEAL, borderwidth=0, padding=(18, 10),
        )
        style.map("Primary.TButton", background=[("active", TEAL_DARK)])
        style.configure(
            "Secondary.TButton", font=(FONT_UI, 10), foreground=TEXT,
            background="#e7e9eb", borderwidth=0, padding=(14, 9),
        )
        style.map("Secondary.TButton", background=[("active", "#d7dadd")])

        style.configure("Tabs.TNotebook", background=BG, borderwidth=0, tabmargins=(8, 6, 8, 0))
        style.configure(
            "Tabs.TNotebook.Tab", background="#dfe3e5", foreground=TEXT,
            font=(FONT_UI, 10), padding=(16, 8), borderwidth=0,
        )
        style.map(
            "Tabs.TNotebook.Tab",
            background=[("selected", CARD)],
            foreground=[("selected", TEAL)],
        )

    def _build_header(self):
        bar = tk.Frame(self, bg=CARD, height=78)
        bar.pack(fill="x")
        bar.pack_propagate(False)

        try:
            img = Image.open(LOGO_PATH)
            target_h = 52
            ratio = target_h / img.height
            img = img.resize((int(img.width * ratio), target_h), Image.LANCZOS)
            self.logo_img = ImageTk.PhotoImage(img)
            tk.Label(bar, image=self.logo_img, bg=CARD).pack(side="left", padx=(20, 16), pady=13)
        except Exception:
            tk.Label(bar, text="EBERHARD", bg=CARD, fg=TEAL, font=(FONT_UI, 18, "bold")).pack(
                side="left", padx=20
            )

        title_box = tk.Frame(bar, bg=CARD)
        title_box.pack(side="left")
        tk.Label(
            title_box, text="Eingangskontrolle", bg=CARD, fg=TEXT, font=(FONT_UI, 16, "bold")
        ).pack(anchor="w")
        tk.Label(
            title_box, text="Baumaschinen", bg=CARD, fg=MUTED, font=(FONT_UI, 10)
        ).pack(anchor="w")

        tk.Frame(self, bg=YELLOW, height=3).pack(fill="x")
        tk.Frame(self, bg=TEAL, height=2).pack(fill="x")

    @staticmethod
    def _tab_label(text):
        return f"{text}   ✕"

    def _add_tab(self):
        # Guard against re-entrancy: creating the plus_tab auto-selects it
        # (before any <<NotebookTabChanged>> handler is bound), which queues
        # a stale tab-changed event. Tk only dispatches it once a nested
        # event loop runs - which happens as soon as the machine-type dialog
        # below calls wait_window(). That dispatch would otherwise re-enter
        # _add_tab() while the first dialog is still open, showing it twice
        # and leaving the first one stuck open after a type is picked.
        if self._adding_tab:
            return None
        self._adding_tab = True
        try:
            existing = [t for t in self.notebook.tabs() if t != str(self.plus_tab)]
            machine_type = self._ask_machine_type(allow_cancel=bool(existing))
            if machine_type is None:
                if existing:
                    self.notebook.select(existing[-1])
                return None

            self.tab_count += 1
            tab = KontrolleTab(self.notebook, self, machine_type)
            idx = self.notebook.index(self.plus_tab)
            self.notebook.insert(idx, tab, text=self._tab_label(f"Kontrolle {self.tab_count}"))
            self.notebook.select(tab)
        finally:
            self._adding_tab = False
        if self.tab_count == 1:
            self._set_initial_geometry()
        return tab

    def _ask_machine_type(self, allow_cancel=True):
        dialog = tk.Toplevel(self)
        dialog.title("Maschinentyp auswählen")
        dialog.configure(bg=BG)
        dialog.transient(self)
        dialog.resizable(False, False)
        if not allow_cancel:
            dialog.protocol("WM_DELETE_WINDOW", lambda: None)

        bar = tk.Frame(dialog, bg=CARD, height=78)
        bar.pack(fill="x")
        bar.pack_propagate(False)
        try:
            img = Image.open(LOGO_PATH)
            target_h = 44
            ratio = target_h / img.height
            img = img.resize((int(img.width * ratio), target_h), Image.LANCZOS)
            logo_img = ImageTk.PhotoImage(img)
            logo_lbl = tk.Label(bar, image=logo_img, bg=CARD)
            logo_lbl.image = logo_img
            logo_lbl.pack(side="left", padx=(20, 16), pady=17)
        except Exception:
            tk.Label(bar, text="EBERHARD", bg=CARD, fg=TEAL, font=(FONT_UI, 16, "bold")).pack(
                side="left", padx=20
            )
        title_box = tk.Frame(bar, bg=CARD)
        title_box.pack(side="left")
        tk.Label(
            title_box, text="Maschinentyp auswählen", bg=CARD, fg=TEXT, font=(FONT_UI, 14, "bold")
        ).pack(anchor="w")
        tk.Label(
            title_box, text="Eingangskontrolle Baumaschinen", bg=CARD, fg=MUTED, font=(FONT_UI, 9)
        ).pack(anchor="w")

        tk.Frame(dialog, bg=YELLOW, height=3).pack(fill="x")
        tk.Frame(dialog, bg=TEAL, height=2).pack(fill="x")

        body = tk.Frame(dialog, bg=BG)
        body.pack(fill="both", expand=True, padx=24, pady=20)
        tk.Label(
            body, text="Welche Maschine wird kontrolliert?", bg=BG, fg=MUTED,
            font=(FONT_UI, 10, "bold"),
        ).pack(anchor="w", pady=(0, 12))

        grid = tk.Frame(body, bg=BG)
        grid.pack()

        result = {"value": None}

        def choose(t):
            result["value"] = t
            dialog.destroy()

        cols = 3
        for i, t in enumerate(MACHINE_TYPES):
            r, c = divmod(i, cols)
            tile = tk.Frame(
                grid, bg=CARD, highlightbackground=BORDER, highlightthickness=1,
                cursor="hand2", width=190, height=92,
            )
            tile.grid(row=r, column=c, padx=8, pady=8)
            tile.grid_propagate(False)
            lbl = tk.Label(
                tile, text=t, bg=CARD, fg=TEXT, font=(FONT_UI, 11, "bold"),
                wraplength=170, justify="center",
            )
            lbl.place(relx=0.5, rely=0.5, anchor="center")

            def on_enter(_e, f=tile):
                f.configure(highlightbackground=TEAL, highlightthickness=2)

            def on_leave(_e, f=tile):
                f.configure(highlightbackground=BORDER, highlightthickness=1)

            for w in (tile, lbl):
                w.bind("<Button-1>", lambda e, t=t: choose(t))
                w.bind("<Enter>", on_enter)
                w.bind("<Leave>", on_leave)

        if allow_cancel:
            ttk.Button(
                body, text="Abbrechen", style="Secondary.TButton", command=dialog.destroy
            ).pack(pady=(16, 0))

        dialog.update_idletasks()
        sw, sh = dialog.winfo_screenwidth(), dialog.winfo_screenheight()
        dw, dh = dialog.winfo_reqwidth(), dialog.winfo_reqheight()
        dialog.geometry(f"+{max(0, (sw - dw) // 2)}+{max(0, (sh - dh) // 3)}")

        dialog.grab_set()
        dialog.wait_window()
        return result["value"]

    def rename_tab(self, tab):
        try:
            idx = self.notebook.index(tab)
        except tk.TclError:
            return
        label = tab.fields["inventarnummer"].get().strip()
        self.notebook.tab(idx, text=self._tab_label(label if label else f"Kontrolle {idx + 1}"))

    def _on_tab_changed(self, event):
        current = self.notebook.select()
        if current == str(self.plus_tab):
            self._add_tab()
            return
        tab = self.notebook.nametowidget(current)
        tab.bind_scroll()

    def _on_tab_click(self, event):
        try:
            idx = self.notebook.index(f"@{event.x},{event.y}")
        except tk.TclError:
            return
        tabs = self.notebook.tabs()
        if idx >= len(tabs) or tabs[idx] == str(self.plus_tab):
            return
        bbox = self.notebook.bbox(idx)
        if not bbox:
            return
        x, _y, w, _h = bbox
        if event.x >= x + w - 22:
            self._close_tab(idx)

    def _close_tab(self, idx):
        tabs = self.notebook.tabs()
        tab = self.notebook.nametowidget(tabs[idx])
        self.notebook.forget(idx)
        tab.destroy()
        remaining = [t for t in self.notebook.tabs() if t != str(self.plus_tab)]
        if not remaining:
            self._add_tab()
        else:
            self.notebook.select(remaining[-1])

    def _set_initial_geometry(self):
        # Defer by one event-loop tick: right after the machine-type dialog
        # closes and the first tab is selected, the window may not be fully
        # mapped/settled yet, which can make winfo_screenwidth/height (and
        # thus the computed size) unreliable and produce a tiny window.
        # Giving Tk a moment first makes the measurement reliable.
        self.after(100, self._apply_initial_geometry)

    def _apply_initial_geometry(self):
        # The checklist canvas has a fixed, scrollable height (CHECKLIST_HEIGHT),
        # so the window's natural size no longer depends on the number of
        # checklist items. That keeps this a one-shot, predictable computation
        # instead of a reactive shrink that could push the action bar (packed
        # with side="bottom") outside the visible window.
        self.update_idletasks()
        total_natural_w = max(self.winfo_reqwidth(), WINDOW_WIDTH)
        total_natural_h = self.winfo_reqheight()

        # Guard against a not-yet-settled display reporting a bogus tiny size.
        screen_w = self.winfo_screenwidth()
        screen_h = self.winfo_screenheight()
        if screen_w < 400:
            screen_w = 1280
        if screen_h < 300:
            screen_h = 800

        # Generous margins for window-manager chrome (title bar, panels/taskbar).
        avail_w = screen_w - 100
        avail_h = screen_h - 170

        final_w = min(total_natural_w, avail_w)
        final_h = min(total_natural_h, avail_h)

        # Never end up with a window too small to actually use.
        final_w = max(final_w, 760)
        final_h = max(final_h, 560)

        x = max(20, (screen_w - final_w) // 2)
        y = max(20, (screen_h - final_h) // 3)

        self.geometry(f"{final_w}x{final_h}+{x}+{y}")
        self.minsize(min(760, final_w), min(600, final_h))


if __name__ == "__main__":
    app = EingangskontrolleApp()
    app.mainloop()

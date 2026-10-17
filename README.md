# Eingangskontrolle Baumaschinen – Eberhard

Kontrolle einer Baumaschine, wenn sie von der Baustelle in den Werkhof zurückkommt.
Ergebnis ist ein PDF mit allen Kontrollpunkten, Fotos der Mängel, Gesamturteil und Unterschrift.

Eine Oberfläche (`app/`) läuft überall:

| Gerät | So läuft es |
|---|---|
| **Windows-PC** | `Eingangskontrolle.exe` (Desktop-Programm) |
| **Mac** | `Eingangskontrolle.app` (Desktop-Programm) |
| **Linux** | `./install_linux.sh` → Programm im Startmenü |
| **Tablet / Handy** | Webseite öffnen → „Zum Home-Bildschirm hinzufügen“. Funktioniert danach auch offline. |

## Bedienung

1. Maschinentyp wählen. Jeder Typ hat seine eigene Liste (z. B. Dumper: Mulde, Knickgelenk; Walze: Bandagen, Berieselung).
2. Maschinendaten eintragen. Abweichungen zu den SAP-Stunden und die Stunden seit dem letzten Service werden automatisch berechnet.
3. Jeden Punkt mit **OK**, **Mangel** oder **n.v.** (nicht vorhanden) bewerten. n.v. gibt es nur dort, wo eine Maschine die Baugruppe nicht haben muss.
   Bei einem Mangel muss eine Bemerkung stehen, Fotos sind möglich (auf dem Tablet direkt mit der Kamera).
4. Abschluss: Mängel als gemeldet bestätigen, Gesamturteil (*einsatzbereit / mit Einschränkung / gesperrt*) wählen, unterschreiben.
5. **Abschliessen & PDF** prüft, ob alles vollständig ist, und erstellt das PDF.

Alles wird automatisch gespeichert. Angefangene Kontrollen erscheinen auf der Startseite unter „In Arbeit“.

**Wo liegen die Daten?** Nur auf dem jeweiligen Gerät:
- Windows: `%APPDATA%\Eingangskontrolle\kontrollen`
- Mac: `~/Library/Application Support/Eingangskontrolle/kontrollen`
- Linux: `~/.local/share/eingangskontrolle/kontrollen`
- Tablet/Browser: im Browser-Speicher. **Deshalb das PDF immer speichern oder teilen.**

Gelöschte Kontrollen landen in der Desktop-App im Ordner `papierkorb` daneben.

## Kontrollpunkte ändern

Alle Punkte stehen in `app/js/checklist.js`. Neuer Punkt = neue Zeile mit eindeutiger `id`.
Die `id` eines bestehenden Punktes nie ändern, sonst verlieren offene Kontrollen ihre Bewertung.
Nach Änderungen in `app/sw.js` die `VERSION` erhöhen, damit Tablets die neue Version laden.

## Programme bauen

PyInstaller baut immer nur für das System, auf dem es läuft:

- **Windows:** `build_windows.bat` doppelklicken → `dist\Eingangskontrolle.exe`
- **Mac:** `./build_mac.sh` → `dist/Eingangskontrolle.app` (erster Start: Rechtsklick → Öffnen)
- **Linux:** `.venv/bin/python -m PyInstaller desktop/eingangskontrolle.spec` → `dist/Eingangskontrolle`

Liegt das Projekt auf GitHub, baut `.github/workflows/build.yml` bei jedem Push alle drei Programme
(unter „Actions“ herunterladen) und stellt die Tablet-Version auf GitHub Pages.
Ein Tag wie `v1.0` erzeugt ein Release mit allen Downloads.

Starten aus dem Quellcode: `python desktop/main.py` (braucht `pip install pywebview`).

## Aufbau

```
app/                 Oberfläche (HTML/CSS/JS), läuft im Programmfenster und im Browser
  js/checklist.js    Maschinentypen und Kontrollpunkte
  js/app.js          Bedienung, Prüfung auf Vollständigkeit
  js/pdf.js          PDF-Bericht
  js/storage.js      Speichern (Dateien in der Desktop-App, IndexedDB im Browser)
desktop/main.py      Desktop-Programm (pywebview), Speichern-Dialog, Drucken
tools/make_assets.py Erzeugt Logo-Ausschnitt und App-Icons aus eberhard_logo.png
alt/                 Alte Tkinter-Version
```

Schrift: Barlow (SIL Open Font License, `app/fonts/OFL.txt`). PDF: jsPDF + AutoTable (MIT).

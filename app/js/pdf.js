// PDF-Bericht einer Kontrolle (jsPDF + AutoTable, Schrift Barlow eingebettet).

import { machineType, VERDICTS } from "./checklist.js";

const BLUE = [2, 126, 153];
const BLUE_TINT = [230, 242, 245];
const YELLOW = [255, 212, 0];
const INK = [24, 26, 28];
const MUTED = [108, 114, 120];
const RULE = [214, 218, 222];
const GREEN = [24, 128, 78];
const RED = [196, 40, 40];
const AMBER = [176, 112, 0];
const VERDICT_COLOR = { ok: GREEN, bedingt: AMBER, gesperrt: RED };

const M = 12; // page margin, mm
const PAGE_W = 210;
const PAGE_H = 297;

let assets = null;

async function fetchBase64(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

async function loadAssets() {
  if (!assets) {
    const [regular, bold, logo] = await Promise.all([
      fetchBase64("fonts/Barlow-Regular.pdf.ttf"),
      fetchBase64("fonts/Barlow-Bold.pdf.ttf"),
      fetchBase64("img/logo-plate.png"),
    ]);
    assets = { regular, bold, logo: "data:image/png;base64," + logo };
  }
  return assets;
}

export const statusLabel = (s) => ({ ok: "OK", mangel: "Mangel", nv: "n.v." })[s] || "–";

function fmtDate(iso) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

export function pdfFilename(rec) {
  const inv = (rec.maschine.inventarnummer || "ohne-Nr").replace(/[^\w.-]+/g, "_");
  const d = (rec.maschine.datum || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  return `Eingangskontrolle_${inv}_${d}${rec.status === "abgeschlossen" ? "" : "_Entwurf"}.pdf`;
}

export async function buildPdf(rec) {
  const { jsPDF } = window.jspdf;
  const a = await loadAssets();
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.addFileToVFS("Barlow-Regular.ttf", a.regular);
  doc.addFont("Barlow-Regular.ttf", "Barlow", "normal");
  doc.addFileToVFS("Barlow-Bold.ttf", a.bold);
  doc.addFont("Barlow-Bold.ttf", "Barlow", "bold");
  doc.setFont("Barlow", "normal");
  doc.setTextColor(...INK);

  const m = rec.maschine;
  const verdict = VERDICTS.find((v) => v.id === rec.abschluss.urteil);
  const sections = rec.checklist;
  const items = sections.flatMap((s) => s.items);
  const final = rec.status === "abgeschlossen";

  // Empty tick box (the Barlow font has no ballot-box glyph).
  const box = (x, y, size = 2.6) => {
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.25);
    doc.rect(x, y, size, size);
  };

  // ---------- Kopf ----------
  const logoProps = doc.getImageProperties(a.logo);
  const logoH = 12;
  const logoW = (logoProps.width / logoProps.height) * logoH;
  doc.addImage(a.logo, "PNG", M, M, logoW, logoH);
  doc.setFont("Barlow", "bold");
  doc.setFontSize(18);
  doc.text("Eingangskontrolle", M + logoW + 6, M + 5.6);
  doc.setFont("Barlow", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(`${machineType(rec.typ).label}  ·  Rückkehr von der Baustelle`, M + logoW + 6, M + 10.6);

  if (verdict) {
    const label = verdict.label.toUpperCase();
    doc.setFont("Barlow", "bold");
    doc.setFontSize(9);
    const w = doc.getTextWidth(label) + 8;
    doc.setFillColor(...VERDICT_COLOR[verdict.id]);
    doc.roundedRect(PAGE_W - M - w, M + 2.5, w, 7.5, 1.2, 1.2, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(label, PAGE_W - M - w / 2, M + 7.4, { align: "center" });
  }
  let y = M + logoH + 4;
  doc.setFillColor(...BLUE);
  doc.rect(M, y, PAGE_W - 2 * M, 0.8, "F");
  doc.setFillColor(...YELLOW);
  doc.rect(M, y + 0.8, PAGE_W - 2 * M, 0.8, "F");
  y += 4;

  // ---------- Maschine ----------
  const diffSap = m.stunden && m.stunden_sap ? Number(m.stunden) - Number(m.stunden_sap) : null;
  const seitService = m.stunden && m.letzter_service ? Number(m.stunden) - Number(m.letzter_service) : null;
  const h = (v) => (v === "" || v == null ? "" : `${v} h`);
  const machineRows = [
    ["Inventarnummer", m.inventarnummer, "Datum Kontrolle", fmtDate(m.datum)],
    ["Hersteller / Modell", m.modell, "Zurück von Baustelle", m.baustelle],
    ["Betriebsstunden", h(m.stunden), "Stunden SAP", h(m.stunden_sap) + (diffSap ? `  (Diff. ${diffSap > 0 ? "+" : ""}${diffSap} h)` : "")],
    ["Letzter Service", h(m.letzter_service) + (seitService != null && m.letzter_service ? `  (vor ${seitService} h)` : ""), "Letzter Abgastest", fmtDate(m.letzter_abgastest)],
    ["Geprüft durch", m.geprueft_durch, "Maschinentyp", machineType(rec.typ).label],
  ];
  doc.autoTable({
    startY: y,
    margin: { left: M, right: M },
    theme: "plain",
    body: machineRows,
    styles: { font: "Barlow", fontSize: 8.8, cellPadding: { top: 0.9, bottom: 0.9, left: 1.5, right: 1.5 }, textColor: INK },
    columnStyles: {
      0: { textColor: MUTED, cellWidth: 34 },
      1: { fontStyle: "bold", cellWidth: 59 },
      2: { textColor: MUTED, cellWidth: 34 },
      3: { fontStyle: "bold" },
    },
    didDrawCell: (d) => {
      if (d.section === "body" && d.column.index === 3) {
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.2);
        doc.line(M, d.cell.y + d.cell.height, PAGE_W - M, d.cell.y + d.cell.height);
      }
    },
  });
  y = doc.lastAutoTable.finalY + 4;

  // ---------- Checkliste ----------
  const body = [];
  for (const s of sections) {
    body.push([{ content: s.title.toUpperCase(), colSpan: 4, styles: { fillColor: BLUE_TINT, textColor: BLUE, fontStyle: "bold", fontSize: 7.6, cellPadding: { top: 1.0, bottom: 0.7, left: 1.5 } } }]);
    for (const it of s.items) {
      const r = rec.items[it.id] || {};
      const photos = (r.photos || []).length;
      const note = (r.note || "") + (photos ? `${r.note ? "  " : ""}[${photos} Foto${photos > 1 ? "s" : ""}]` : "");
      const row = [String(it.nr), it.text, r.status ? statusLabel(r.status) : "", note];
      if (!r.status) row.blank = it.nv ? 3 : 2; // tick boxes to fill in by hand
      body.push(row);
    }
  }
  doc.autoTable({
    startY: y,
    margin: { left: M, right: M, bottom: 16 },
    head: [["Nr", "Kontrollpunkt", "Status", "Bemerkung / Feststellung"]],
    body,
    theme: "plain",
    styles: { font: "Barlow", fontSize: 8.4, textColor: INK, cellPadding: { top: 0.85, bottom: 0.85, left: 1.5, right: 1.5 }, valign: "top" },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.2 },
    columnStyles: { 0: { cellWidth: 8, textColor: MUTED }, 1: { cellWidth: 66 }, 2: { cellWidth: 24, fontStyle: "bold" } },
    didParseCell: (d) => {
      if (d.section !== "body") return;
      if (d.row.raw.blank) d.cell.styles.minCellHeight = 6.4;
      if (d.column.index !== 2) return;
      const v = d.cell.raw;
      d.cell.styles.textColor = v === "Mangel" ? RED : v === "OK" ? GREEN : MUTED;
    },
    didDrawCell: (d) => {
      if (d.section === "body" && d.column.index === 2 && d.row.raw.blank) {
        const labels = ["OK", "M", "n.v."].slice(0, d.row.raw.blank);
        let x = d.cell.x + 1.5;
        const y0 = d.cell.y + (d.cell.height - 2.6) / 2;
        doc.setFont("Barlow", "normal");
        doc.setFontSize(6.6);
        doc.setTextColor(...MUTED);
        for (const l of labels) {
          box(x, y0);
          doc.text(l, x + 3.3, y0 + 2.2);
          x += 3.3 + doc.getTextWidth(l) + 1.8;
        }
      }
      if (d.section === "body" && d.row.raw.length === 4 && d.column.index === 0) {
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.15);
        doc.line(M, d.cell.y + d.cell.height, PAGE_W - M, d.cell.y + d.cell.height);
      }
    },
  });
  y = doc.lastAutoTable.finalY + 6;

  // ---------- Abschluss ----------
  const maengel = items.filter((it) => (rec.items[it.id] || {}).status === "mangel");
  const blockH = (final && rec.abschluss.urteil ? 52 : 68) + (rec.abschluss.notiz ? doc.splitTextToSize(rec.abschluss.notiz, PAGE_W - 2 * M).length * 4 : 0);
  if (y + blockH > PAGE_H - 16) {
    doc.addPage();
    y = M;
  }
  doc.setFont("Barlow", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Abschluss", M, y + 4);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("Barlow", "normal");
  const ok = items.filter((it) => (rec.items[it.id] || {}).status === "ok").length;
  const nv = items.filter((it) => (rec.items[it.id] || {}).status === "nv").length;
  const rated = ok + maengel.length + nv;
  const missing = (final && rec.abschluss.unvollstaendig) || [];
  if (missing.length) {
    doc.setFont("Barlow", "bold");
    doc.setTextColor(...RED);
    const lines = doc.splitTextToSize(`Unvollständig abgeschlossen – es fehlte: ${missing.join(", ")}.`, PAGE_W - 2 * M);
    doc.text(lines, M, y);
    y += lines.length * 4.2 + 1;
    doc.setFont("Barlow", "normal");
    doc.setTextColor(...INK);
  }
  doc.text(
    rated === items.length
      ? `${items.length} Punkte geprüft: ${ok} OK, ${maengel.length} Mangel, ${nv} nicht vorhanden.`
      : `${rated} von ${items.length} Punkten bewertet${rated ? `: ${ok} OK, ${maengel.length} Mangel, ${nv} nicht vorhanden` : ""}.`,
    M, y
  );
  y += 5;
  if (final ? maengel.length : true) {
    if (final) {
      doc.text(`Mängel an Werkstatt gemeldet: ${rec.abschluss.gemeldet ? "Ja" : "Nein"}`, M, y);
    } else {
      box(M, y - 2.4);
      if (rec.abschluss.gemeldet) doc.text("x", M + 0.6, y - 0.1);
      doc.text("Mängel an Werkstattleitung / Disposition gemeldet", M + 4.4, y);
    }
    y += 5;
  }
  if (!rec.abschluss.notiz && (!final || missing.length)) {
    doc.setTextColor(...MUTED);
    doc.text("Notwendige Arbeiten / Bemerkungen", M, y);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.25);
    for (let i = 1; i <= 3; i++) doc.line(M, y + i * 7, PAGE_W - M, y + i * 7);
    doc.setTextColor(...INK);
    y += 24;
  }
  if (rec.abschluss.notiz) {
    doc.setTextColor(...MUTED);
    doc.text("Notwendige Arbeiten / Bemerkungen", M, y);
    y += 4.4;
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(rec.abschluss.notiz, PAGE_W - 2 * M);
    doc.text(lines, M, y);
    y += lines.length * 4 + 2;
  }

  // Unterschrift
  y += 3;
  const sigW = 62;
  const sigH = 20;
  if (rec.abschluss.signatur) {
    const p = doc.getImageProperties(rec.abschluss.signatur);
    const scale = Math.min(sigW / p.width, sigH / p.height);
    doc.addImage(rec.abschluss.signatur, "PNG", M, y, p.width * scale, p.height * scale);
  }
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.25);
  doc.line(M, y + sigH + 1, M + sigW + 10, y + sigH + 1);
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(m.geprueft_durch ? `${m.geprueft_durch}, ${fmtDate(m.datum)}` : "Name, Datum, Unterschrift", M, y + sigH + 5);

  if (!verdict) {
    const bx = PAGE_W - M - 80;
    doc.setFontSize(8.5);
    doc.text("Gesamturteil", bx, y + 4);
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    VERDICTS.forEach((v, i) => {
      box(bx, y + 7 + i * 6.2, 3);
      doc.text(v.label, bx + 5, y + 9.5 + i * 6.2);
    });
  } else {
    const bx = PAGE_W - M - 80;
    doc.setFontSize(8.5);
    doc.text("Gesamturteil", bx, y + 4);
    doc.setFont("Barlow", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...VERDICT_COLOR[verdict.id]);
    doc.text(verdict.label, bx, y + 11);
    doc.setFont("Barlow", "normal");
  }

  // ---------- Fotos ----------
  const photos = [];
  for (const it of items) {
    const r = rec.items[it.id] || {};
    (r.photos || []).forEach((src, i, arr) => photos.push({ src, it, r, i, n: arr.length }));
  }
  if (photos.length) {
    doc.addPage();
    doc.setTextColor(...INK);
    doc.setFont("Barlow", "bold");
    doc.setFontSize(13);
    doc.text("Fotodokumentation", M, M + 5);
    const colW = (PAGE_W - 2 * M - 6) / 2;
    const imgH = 66;
    let col = 0;
    let py = M + 11;
    for (const ph of photos) {
      if (py + imgH + 14 > PAGE_H - 16) {
        doc.addPage();
        py = M;
        col = 0;
      }
      const x = M + col * (colW + 6);
      const p = doc.getImageProperties(ph.src);
      const s = Math.min(colW / p.width, imgH / p.height);
      doc.setFillColor(242, 243, 244);
      doc.rect(x, py, colW, imgH, "F");
      doc.addImage(ph.src, "JPEG", x + (colW - p.width * s) / 2, py + (imgH - p.height * s) / 2, p.width * s, p.height * s);
      doc.setFont("Barlow", "bold");
      doc.setFontSize(8.6);
      doc.setTextColor(...INK);
      doc.text(`${ph.it.nr}. ${ph.it.text}${ph.n > 1 ? ` (${ph.i + 1}/${ph.n})` : ""}`, x, py + imgH + 4.2, { maxWidth: colW });
      if (ph.r.note) {
        doc.setFont("Barlow", "normal");
        doc.setTextColor(...MUTED);
        doc.text(doc.splitTextToSize(ph.r.note, colW).slice(0, 2), x, py + imgH + 8.2);
      }
      col = 1 - col;
      if (col === 0) py += imgH + 16;
    }
  }

  // ---------- Fusszeile ----------
  const pages = doc.getNumberOfPages();
  const stamp = new Date((final && rec.abschluss.abgeschlossen_am) || Date.now()).toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("Barlow", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      `Eberhard · Eingangskontrolle ${m.inventarnummer || ""} · ${final ? `erstellt ${stamp}` : `Ausdruck ${stamp} – nicht abgeschlossen`}`,
      M, PAGE_H - 8
    );
    doc.text(`Seite ${i} / ${pages}`, PAGE_W - M, PAGE_H - 8, { align: "right" });
  }
  return doc.output("blob");
}

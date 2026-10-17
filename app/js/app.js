import { MACHINE_TYPES, VERDICTS, checklistFor, machineType } from "./checklist.js";
import { buildPdf, pdfFilename } from "./pdf.js";
import * as store from "./storage.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const main = $("#main");
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => (iso ? iso.split("-").reverse().join(".") : "");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const FIELDS = [
  { key: "inventarnummer", label: "Inventarnummer", required: true, mode: "numeric", autofocus: true },
  { key: "modell", label: "Hersteller / Modell", placeholder: "z. B. Liebherr A 914" },
  { key: "baustelle", label: "Zurück von Baustelle", placeholder: "Ort / Projekt" },
  { key: "datum", label: "Datum Kontrolle", required: true, type: "date" },
  { key: "stunden", label: "Betriebsstunden", required: true, mode: "decimal", unit: "h" },
  { key: "stunden_sap", label: "Stunden SAP", mode: "decimal", unit: "h" },
  { key: "letzter_service", label: "Letzter Service bei", mode: "decimal", unit: "h" },
  { key: "letzter_abgastest", label: "Letzter Abgastest", type: "date" },
  { key: "geprueft_durch", label: "Geprüft durch", required: true, placeholder: "Vor- und Nachname" },
];

// ---------------------------------------------------------------- toast

let toastTimer;
function toast(msg, kind = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), kind === "error" ? 6000 : 3200);
}

// ---------------------------------------------------------------- records

function newRecord(typ) {
  return {
    id: uid(),
    version: 1,
    typ,
    status: "offen",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    maschine: { datum: today(), geprueft_durch: store.pref("pruefer") },
    items: {},
    checklist: checklistFor(typ),
    abschluss: { notiz: "", gemeldet: false, urteil: "", signatur: "" },
  };
}

function counts(rec) {
  const items = rec.checklist.flatMap((s) => s.items);
  const st = items.map((it) => (rec.items[it.id] || {}).status);
  return {
    total: items.length,
    done: st.filter(Boolean).length,
    mangel: st.filter((s) => s === "mangel").length,
  };
}

let saveTimer = null;
let saving = Promise.resolve();
function scheduleSave(rec) {
  rec.updated = new Date().toISOString();
  setSaveState("pending");
  if (rec === current) updateSummary();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => flushSave(rec), 500);
}
function flushSave(rec) {
  clearTimeout(saveTimer);
  saveTimer = null;
  saving = saving
    .then(() => store.saveRecord(rec))
    .then(() => setSaveState("saved"))
    .catch((e) => {
      setSaveState("error");
      toast(`Speichern fehlgeschlagen: ${e.message || e}`, "error");
    });
  return saving;
}
function setSaveState(s) {
  const el = $("#savestate");
  if (!el) return;
  el.dataset.state = s;
  el.textContent = { pending: "Speichert …", saved: "Gespeichert", error: "Nicht gespeichert" }[s];
}

// ---------------------------------------------------------------- header

function setHeader({ back = false, title = "", sub = "" } = {}) {
  $("#toast").className = "toast";
  $("#hdr-back").hidden = !back;
  $("#hdr-title").textContent = title || "Eingangskontrolle";
  $("#hdr-sub").textContent = sub || "Baumaschinen · Rückkehr von der Baustelle";
  $("#hdr-status").innerHTML = back ? `<span id="savestate" data-state="saved">Gespeichert</span>` : "";
}

// ---------------------------------------------------------------- home

async function showHome() {
  if (saveTimer && current) await flushSave(current);
  current = null;
  history.replaceState(null, "", location.pathname + location.search);
  setHeader();
  let records = [];
  try {
    records = await store.listRecords();
  } catch (e) {
    toast(`Kontrollen konnten nicht geladen werden: ${e.message || e}`, "error");
  }
  const open = records.filter((r) => r.status !== "abgeschlossen");
  const done = records.filter((r) => r.status === "abgeschlossen").slice(0, 30);

  main.innerHTML = `
    <section class="start">
      <h1 class="start-title">Neue Kontrolle</h1>
      <p class="start-lead">Welche Maschine kommt zurück?</p>
      <ul class="types" role="list">
        ${MACHINE_TYPES.map((t) => {
          const n = checklistFor(t.id).reduce((a, s) => a + s.items.length, 0);
          return `<li><button class="type" data-type="${t.id}">
            <span class="type-name">${esc(t.label)}</span>
            <span class="type-hint">${esc(t.hint)}</span>
            <span class="type-count">${n} Punkte</span>
            <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
          </button></li>`;
        }).join("")}
      </ul>
    </section>
    ${listSection("In Arbeit", open, "Keine offenen Kontrollen.")}
    ${listSection("Abgeschlossen", done, "Noch keine abgeschlossenen Kontrollen.")}
    <p class="appinfo">${store.isDesktop() ? "Desktop-App" : "Web-App"} · Daten bleiben auf diesem Gerät</p>
  `;

  $$(".type", main).forEach((b) =>
    b.addEventListener("click", async () => {
      const rec = newRecord(b.dataset.type);
      await store.saveRecord(rec).catch(() => {});
      showKontrolle(rec);
    })
  );
  const byId = Object.fromEntries(records.map((r) => [r.id, r]));
  $$("[data-open]", main).forEach((b) => b.addEventListener("click", () => showKontrolle(byId[b.dataset.open])));
  $$("[data-pdf]", main).forEach((b) => b.addEventListener("click", () => exportPdf(byId[b.dataset.pdf], "save", b)));
  $$("[data-print]", main).forEach((b) => b.addEventListener("click", () => exportPdf(byId[b.dataset.print], "print", b)));
  $$("[data-del]", main).forEach((b) =>
    b.addEventListener("click", async () => {
      if (b.dataset.armed !== "1") {
        b.dataset.armed = "1";
        b.textContent = "Wirklich löschen?";
        setTimeout(() => {
          b.dataset.armed = "";
          b.textContent = "Löschen";
        }, 3500);
        return;
      }
      await store.deleteRecord(b.dataset.del);
      toast("Kontrolle gelöscht");
      showHome();
    })
  );
}

function listSection(title, recs, empty) {
  return `
    <section class="list">
      <h2 class="eyebrow">${title}<span class="count">${recs.length || ""}</span></h2>
      ${
        recs.length
          ? `<ul role="list" class="rows">${recs.map(rowHtml).join("")}</ul>`
          : `<p class="empty">${empty}</p>`
      }
    </section>`;
}

function rowHtml(r) {
  const m = r.maschine || {};
  const c = counts(r);
  const doneRec = r.status === "abgeschlossen";
  const v = VERDICTS.find((x) => x.id === r.abschluss.urteil);
  const meta = [machineType(r.typ).label, m.modell, m.baustelle, fmtDate(m.datum)].filter(Boolean).map(esc).join(" · ");
  const state = doneRec
    ? `<span class="pill v-${v ? v.id : ""}">${v ? esc(v.short) : "–"}</span>`
    : `<span class="mini-progress" aria-label="${c.done} von ${c.total} geprüft"><i style="width:${(c.done / c.total) * 100}%"></i></span><span class="row-count">${c.done}/${c.total}</span>`;
  return `<li class="row">
    <button class="row-main" data-open="${r.id}">
      <span class="row-inv">${esc(m.inventarnummer) || "Ohne Inventarnummer"}</span>
      <span class="row-meta">${meta}</span>
    </button>
    <span class="row-state">${state}</span>
    <span class="row-actions">
      ${doneRec ? `<button class="btn ghost sm" data-pdf="${r.id}">PDF</button><button class="btn ghost sm" data-print="${r.id}">Drucken</button>` : ""}
      <button class="btn ghost sm danger" data-del="${r.id}">Löschen</button>
    </span>
  </li>`;
}

// ---------------------------------------------------------------- kontrolle

let current = null;

function showKontrolle(rec) {
  current = rec;
  history.pushState({ id: rec.id }, "", "#k");
  const locked = rec.status === "abgeschlossen";
  const t = machineType(rec.typ);
  setHeader({ back: true, title: rec.maschine.inventarnummer || "Neue Kontrolle", sub: t.label });
  const m = rec.maschine;

  main.innerHTML = `
    ${locked ? `<div class="locked-banner">
        <span>Abgeschlossen am ${new Date(rec.abschluss.abgeschlossen_am).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" })}</span>
        <span class="locked-actions">
          <button class="btn ghost sm" id="lk-pdf">PDF speichern</button>
          <button class="btn ghost sm" id="lk-print">Drucken</button>
          <button class="btn ghost sm" id="lk-reopen">Wieder bearbeiten</button>
        </span></div>` : ""}
    <form id="kform" novalidate autocomplete="off">
    <fieldset ${locked ? "disabled" : ""}>
      <section class="block" aria-labelledby="h-maschine">
        <h2 class="eyebrow" id="h-maschine">Maschine</h2>
        <div class="fields">
          ${FIELDS.map((f) => `
            <label class="field ${f.key}" data-field="${f.key}" id="f-${f.key}">
              <span class="lbl">${f.label}${f.required ? `<span class="req" aria-hidden="true">*</span>` : ""}</span>
              <span class="inp">
                <input name="${f.key}" type="${f.type || "text"}" ${f.mode ? `inputmode="${f.mode}"` : ""}
                  value="${esc(m[f.key])}" placeholder="${esc(f.placeholder || "")}" ${f.required ? "required aria-required=\"true\"" : ""}>
                ${f.unit ? `<span class="unit">${f.unit}</span>` : ""}
              </span>
            </label>`).join("")}
        </div>
        <p class="calc" id="calc" aria-live="polite"></p>
      </section>

      <section class="block checklist" aria-label="Kontrollpunkte">
        <div class="legend"><span>Kontrollpunkt</span><span>Bewertung</span></div>
        ${rec.checklist.map((s, si) => `
          <div class="sec" id="sec-${si}">
            <h2 class="sec-title"><span>${esc(s.title)}</span><span class="sec-count" data-sec="${si}"></span></h2>
            <ul role="list">${s.items.map((it) => itemHtml(rec, it)).join("")}</ul>
          </div>`).join("")}
      </section>

      <section class="block abschluss" aria-labelledby="h-abschluss">
        <h2 class="eyebrow" id="h-abschluss">Abschluss</h2>
        <div id="mangelliste"></div>
        <label class="field wide">
          <span class="lbl">Notwendige Arbeiten / weitere Bemerkungen</span>
          <textarea name="notiz" rows="3">${esc(rec.abschluss.notiz)}</textarea>
        </label>
        <label class="check" id="gemeldet-wrap">
          <input type="checkbox" name="gemeldet" ${rec.abschluss.gemeldet ? "checked" : ""}>
          <span>Mängel an Werkstattleitung / Disposition gemeldet</span>
        </label>

        <fieldset class="verdict" id="verdict">
          <legend class="lbl">Gesamturteil<span class="req" aria-hidden="true">*</span></legend>
          ${VERDICTS.map((v) => `
            <label class="v v-${v.id}">
              <input type="radio" name="urteil" value="${v.id}" ${rec.abschluss.urteil === v.id ? "checked" : ""}>
              <span class="v-dot" aria-hidden="true"></span><span>${v.label}</span>
            </label>`).join("")}
        </fieldset>
        <p class="hint-warn" id="verdict-warn" hidden></p>

        <div class="sig" id="sig-wrap">
          <div class="sig-head"><span class="lbl">Unterschrift<span class="req" aria-hidden="true">*</span></span>
            <button type="button" class="btn ghost sm" id="sig-clear">Löschen</button></div>
          <canvas id="sig" aria-label="Unterschriftsfeld – mit Maus oder Finger unterschreiben"></canvas>
          <span class="sig-name" id="sig-name"></span>
        </div>
        <div id="problems" class="problems" hidden tabindex="-1"></div>
      </section>
    </fieldset>
    </form>
    ${locked ? "" : `<div class="actionbar">
      <div class="ab-progress">
        <span class="bar"><i id="pbar"></i></span>
        <span id="ptext"></span>
      </div>
      <button class="btn" id="print-draft" type="button" aria-label="Drucken" title="Aktuellen Stand drucken – leere Punkte zum Ausfüllen von Hand">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M7 14h10v7H7z"/></svg>
        <span class="lbl-text">Drucken</span>
      </button>
      <button class="btn primary" id="finish" type="button">Abschliessen & PDF</button>
    </div>`}
  `;

  const form = $("#kform");
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='#']");
    if (!a) return;
    e.preventDefault();
    const el = $(a.getAttribute("href"));
    el?.scrollIntoView({ block: "center" });
    el?.querySelector("input, textarea")?.focus({ preventScroll: true });
  });

  // Maschine fields
  FIELDS.forEach((f) => {
    const input = form.elements[f.key];
    input.addEventListener("input", () => {
      m[f.key] = input.value.trim();
      $(`[data-field="${f.key}"]`).classList.remove("invalid");
      if (f.key === "inventarnummer") $("#hdr-title").textContent = m.inventarnummer || "Neue Kontrolle";
      if (f.key === "geprueft_durch") store.pref("pruefer", m.geprueft_durch);
      updateSummary();
      scheduleSave(rec);
    });
  });

  // Checklist
  $$(".item", form).forEach((row) => wireItem(rec, row));

  // Abschluss
  form.elements.notiz.addEventListener("input", (e) => {
    rec.abschluss.notiz = e.target.value;
    scheduleSave(rec);
  });
  form.elements.gemeldet.addEventListener("change", (e) => {
    rec.abschluss.gemeldet = e.target.checked;
    $("#gemeldet-wrap").classList.remove("invalid");
    scheduleSave(rec);
  });
  $$("input[name=urteil]", form).forEach((r) =>
    r.addEventListener("change", () => {
      rec.abschluss.urteil = r.value;
      $("#verdict").classList.remove("invalid");
      updateSummary();
      scheduleSave(rec);
    })
  );
  initSignature(rec, locked);

  if (locked) {
    $("#lk-pdf").addEventListener("click", (e) => exportPdf(rec, "save", e.currentTarget));
    $("#lk-print").addEventListener("click", (e) => exportPdf(rec, "print", e.currentTarget));
    $("#lk-reopen").addEventListener("click", () => {
      rec.status = "offen";
      flushSave(rec).then(() => showKontrolle(rec));
    });
  } else {
    $("#finish").addEventListener("click", () => finish(rec));
    $("#print-draft").addEventListener("click", (e) => exportPdf(rec, "print", e.currentTarget));
  }

  updateSummary();
  window.scrollTo(0, 0);
  if (!locked && !m.inventarnummer) form.elements.inventarnummer.focus();
}

function itemHtml(rec, it) {
  const r = rec.items[it.id] || {};
  const name = `st-${it.id}`;
  const hasDetail = r.status === "mangel" || r.note || (r.photos || []).length;
  const opt = (val, label) => `
    <label class="opt opt-${val}">
      <input type="radio" name="${name}" value="${val}" ${r.status === val ? "checked" : ""}>
      <span>${label}</span>
    </label>`;
  return `<li class="item ${r.status ? "is-" + r.status : ""}" data-id="${it.id}" id="it-${it.id}">
    <div class="item-main">
      <span class="nr" aria-hidden="true">${it.nr}</span>
      <div class="item-text">
        <span class="t" id="t-${it.id}">${esc(it.text)}</span>
        <span class="h">${esc(it.hint)}</span>
      </div>
      <button type="button" class="addnote" aria-label="Bemerkung zu ${esc(it.text)} hinzufügen" title="Bemerkung / Foto" ${hasDetail ? "hidden" : ""}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>
      </button>
      <div class="seg" role="radiogroup" aria-labelledby="t-${it.id}">
        ${opt("ok", "OK")}${opt("mangel", "Mangel")}${it.nv ? opt("nv", "n.v.") : `<span class="opt-spacer"></span>`}
      </div>
    </div>
    <div class="item-detail" ${hasDetail ? "" : "hidden"}>
      <label class="note">
        <span class="sr">Bemerkung zu ${esc(it.text)}</span>
        <textarea rows="1" placeholder="${r.status === "mangel" ? "Was ist defekt? (Pflicht)" : "Bemerkung"}">${esc(r.note)}</textarea>
      </label>
      <div class="photos">
        ${(r.photos || []).map((p, i) => photoHtml(p, i)).join("")}
        <label class="addphoto btn ghost sm">
          <input type="file" accept="image/*" capture="environment" multiple hidden>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
          Foto
        </label>
      </div>
    </div>
  </li>`;
}

const photoHtml = (src, i) =>
  `<span class="ph"><img src="${src}" alt="Foto ${i + 1}"><button type="button" class="ph-del" data-i="${i}" aria-label="Foto ${i + 1} entfernen">×</button></span>`;

function wireItem(rec, row) {
  const id = row.dataset.id;
  const get = () => (rec.items[id] ||= { status: null, note: "", photos: [] });
  const detail = $(".item-detail", row);
  const ta = $("textarea", row);
  const addnote = $(".addnote", row);

  const autosize = () => {
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + 2 + "px";
  };

  $$("input[type=radio]", row).forEach((radio) => {
    radio.addEventListener("change", () => {
      const r = get();
      r.status = radio.value;
      row.className = `item is-${r.status}`;
      ta.placeholder = r.status === "mangel" ? "Was ist defekt? (Pflicht)" : "Bemerkung";
      if (r.status === "mangel") {
        detail.hidden = false;
        addnote.hidden = true;
        autosize();
        if (!r.note) ta.focus();
      }
      updateSummary();
      scheduleSave(rec);
    });
    // Clicking the already-selected option clears it again.
    radio.addEventListener("click", () => {
      const r = get();
      if (radio.dataset.was === "1") {
        radio.checked = false;
        r.status = null;
        row.className = "item";
        updateSummary();
        scheduleSave(rec);
      }
      $$("input[type=radio]", row).forEach((x) => (x.dataset.was = x.checked ? "1" : ""));
    });
    radio.dataset.was = radio.checked ? "1" : "";
  });

  addnote.addEventListener("click", () => {
    detail.hidden = false;
    addnote.hidden = true;
    ta.focus();
  });
  ta.addEventListener("input", () => {
    get().note = ta.value;
    row.classList.remove("invalid");
    autosize();
    updateSummary();
    scheduleSave(rec);
  });
  requestAnimationFrame(autosize);

  const photos = $(".photos", row);
  $("input[type=file]", row).addEventListener("change", async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    for (const f of files) {
      try {
        const src = await compressImage(f);
        const r = get();
        r.photos.push(src);
        $(".addphoto", photos).insertAdjacentHTML("beforebegin", photoHtml(src, r.photos.length - 1));
      } catch {
        toast(`Bild „${f.name}“ konnte nicht gelesen werden`, "error");
      }
    }
    scheduleSave(rec);
  });
  photos.addEventListener("click", (e) => {
    const del = e.target.closest(".ph-del");
    if (!del) return;
    get().photos.splice(Number(del.dataset.i), 1);
    del.parentElement.remove();
    $$(".ph-del", photos).forEach((b, i) => (b.dataset.i = i));
    scheduleSave(rec);
  });
}

function compressImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}

function updateSummary() {
  const rec = current;
  if (!rec) return;
  const c = counts(rec);
  const m = rec.maschine;

  if ($("#pbar")) {
    $("#pbar").style.width = `${(c.done / c.total) * 100}%`;
    $("#ptext").innerHTML = `<b>${c.done}</b> / ${c.total} geprüft${c.mangel ? ` · <span class="m">${c.mangel} ${c.mangel > 1 ? "Mängel" : "Mangel"}</span>` : ""}`;
  }

  rec.checklist.forEach((s, si) => {
    const done = s.items.filter((it) => (rec.items[it.id] || {}).status).length;
    const el = $(`[data-sec="${si}"]`);
    el.textContent = `${done}/${s.items.length}`;
    el.classList.toggle("full", done === s.items.length);
  });

  const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
  const parts = [];
  if (num(m.stunden) != null && num(m.stunden_sap) != null) {
    const d = num(m.stunden) - num(m.stunden_sap);
    parts.push(d === 0 ? "Stunden stimmen mit SAP überein" : `<b>${d > 0 ? "+" : ""}${d} h</b> gegenüber SAP${d > 0 ? " – SAP nachführen" : " – Zählerstand prüfen"}`);
  }
  if (num(m.stunden) != null && num(m.letzter_service) != null) {
    parts.push(`<b>${num(m.stunden) - num(m.letzter_service)} h</b> seit dem letzten Service`);
  }
  $("#calc").innerHTML = parts.join('<span class="sep">·</span>');

  // Mängel summary in Abschluss
  const maengel = rec.checklist.flatMap((s) => s.items).filter((it) => (rec.items[it.id] || {}).status === "mangel");
  $("#mangelliste").innerHTML = maengel.length
    ? `<p class="lbl">Festgestellte Mängel</p><ul class="mangel-list" role="list">${maengel
        .map((it) => `<li><a href="#it-${it.id}">${it.nr}. ${esc(it.text)}</a><span>${esc(rec.items[it.id].note) || "<em>Bemerkung fehlt</em>"}</span></li>`)
        .join("")}</ul>`
    : `<p class="ok-note">Keine Mängel festgestellt.</p>`;
  $("#gemeldet-wrap").hidden = !maengel.length;

  const warn = $("#verdict-warn");
  if (rec.abschluss.urteil === "ok" && maengel.length) {
    warn.hidden = false;
    warn.textContent = `Es sind ${maengel.length} Mängel erfasst. Ist die Maschine wirklich uneingeschränkt einsatzbereit?`;
  } else if (rec.abschluss.urteil && rec.abschluss.urteil !== "ok" && !maengel.length) {
    warn.hidden = false;
    warn.textContent = "Keine Mängel erfasst – bitte den Grund unter „Notwendige Arbeiten“ festhalten.";
  } else warn.hidden = true;

  const box = $("#problems");
  if (box && !box.hidden) showProblems(validate(rec), false);

  const sn = $("#sig-name");
  if (sn) sn.textContent = [m.geprueft_durch, fmtDate(m.datum)].filter(Boolean).join(", ");
}

// ---------------------------------------------------------------- signature

function initSignature(rec, locked) {
  const canvas = $("#sig");
  const ctx = canvas.getContext("2d");
  let drawing = false;
  let last = null;

  function size() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.2;
    if (rec.abschluss.signatur) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height);
      img.src = rec.abschluss.signatur;
    }
  }
  size();
  new ResizeObserver(() => size()).observe(canvas);
  if (locked) return;

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    last = pos(e);
    canvas.setPointerCapture(e.pointerId);
    ctx.beginPath();
    ctx.arc(last.x, last.y, 1, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
  });
  const end = () => {
    if (!drawing) return;
    drawing = false;
    rec.abschluss.signatur = canvas.toDataURL("image/png");
    $("#sig-wrap").classList.remove("invalid");
    scheduleSave(rec);
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  $("#sig-clear").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    rec.abschluss.signatur = "";
    scheduleSave(rec);
  });
}

// ---------------------------------------------------------------- finish

function validate(rec) {
  const problems = [];
  const m = rec.maschine;
  FIELDS.filter((f) => f.required && !m[f.key]).forEach((f) =>
    problems.push({ el: `#f-${f.key}`, text: `${f.label} fehlt` })
  );
  const items = rec.checklist.flatMap((s) => s.items);
  const open = items.filter((it) => !(rec.items[it.id] || {}).status);
  if (open.length)
    problems.push({ el: `#it-${open[0].id}`, mark: open.map((it) => `#it-${it.id}`), text: `${open.length} Kontrollpunkt${open.length > 1 ? "e" : ""} nicht bewertet` });
  const noNote = items.filter((it) => (rec.items[it.id] || {}).status === "mangel" && !(rec.items[it.id].note || "").trim());
  if (noNote.length)
    problems.push({ el: `#it-${noNote[0].id}`, mark: noNote.map((it) => `#it-${it.id}`), text: `Bemerkung fehlt bei Mangel: ${noNote.map((it) => it.nr).join(", ")}` });
  const anyMangel = items.some((it) => (rec.items[it.id] || {}).status === "mangel");
  if (anyMangel && !rec.abschluss.gemeldet) problems.push({ el: "#gemeldet-wrap", text: "Mängel noch nicht als gemeldet bestätigt" });
  if (!rec.abschluss.urteil) problems.push({ el: "#verdict", text: "Gesamturteil fehlt" });
  if (!rec.abschluss.signatur) problems.push({ el: "#sig-wrap", text: "Unterschrift fehlt" });
  return problems;
}

/** Show (or clear) the list of missing things; `jump` scrolls to the first one. */
function showProblems(problems, jump) {
  const box = $("#problems");
  $$(".invalid").forEach((el) => el.classList.remove("invalid"));
  if (!problems.length) {
    box.hidden = true;
    return;
  }
  problems.forEach((p) => (p.mark || [p.el]).forEach((sel) => $(sel)?.classList.add("invalid")));
  box.hidden = false;
  box.innerHTML = `<p><b>Noch nicht vollständig:</b></p><ul role="list">${problems
    .map((p) => `<li><a href="${p.el}">${esc(p.text)}</a></li>`)
    .join("")}</ul>`;
  if (jump) {
    $(problems[0].el)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    toast(problems.length > 1 ? `${problems[0].text} (+${problems.length - 1} weitere)` : problems[0].text, "error");
  }
}

async function finish(rec) {
  const problems = validate(rec);
  showProblems(problems, true);
  if (problems.length) return;
  rec.status = "abgeschlossen";
  rec.abschluss.abgeschlossen_am = new Date().toISOString();
  await flushSave(rec);
  showDone(rec);
}

function showDone(rec) {
  const v = VERDICTS.find((x) => x.id === rec.abschluss.urteil);
  const c = counts(rec);
  history.replaceState(null, "", "#fertig");
  setHeader({ back: true, title: rec.maschine.inventarnummer, sub: machineType(rec.typ).label });
  $("#hdr-status").innerHTML = "";
  main.innerHTML = `
    <section class="done">
      <span class="done-mark v-${v.id}" aria-hidden="true"></span>
      <h1>Kontrolle abgeschlossen</h1>
      <p class="done-verdict v-${v.id}">${esc(v.label)}</p>
      <p class="done-meta">${c.total} Punkte · ${c.mangel} Mängel · ${esc(rec.maschine.geprueft_durch)}</p>
      <div class="done-actions">
        <button class="btn primary" id="d-pdf">PDF speichern</button>
        <button class="btn" id="d-print">Drucken</button>
      </div>
      <div class="done-actions">
        <button class="btn ghost" id="d-home">Zur Übersicht</button>
        <button class="btn ghost" id="d-view">Kontrolle ansehen</button>
      </div>
    </section>`;
  $("#d-pdf").addEventListener("click", (e) => exportPdf(rec, "save", e.currentTarget));
  $("#d-print").addEventListener("click", (e) => exportPdf(rec, "print", e.currentTarget));
  $("#d-home").addEventListener("click", showHome);
  $("#d-view").addEventListener("click", () => showKontrolle(rec));
  $("#d-pdf").focus();
}

async function exportPdf(rec, mode, btn) {
  const label = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "PDF wird erstellt …";
  }
  if (rec === current && saveTimer) await flushSave(rec);
  try {
    const blob = await buildPdf(rec);
    const name = pdfFilename(rec);
    const msg = mode === "print" ? await store.printPdf(blob, name) : await store.savePdf(blob, name);
    if (msg) toast(msg, "ok");
  } catch (e) {
    console.error(e);
    toast(`PDF fehlgeschlagen: ${e.message || e}`, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  }
}

// ---------------------------------------------------------------- boot

$("#hdr-back").addEventListener("click", () => showHome());
window.addEventListener("popstate", () => {
  if (current) showHome();
});
// Save immediately when the window is hidden or closed.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && saveTimer && current) flushSave(current);
});
window.addEventListener("pagehide", () => {
  if (saveTimer && current) flushSave(current);
});
window.__flushBeforeClose = () => (current && saveTimer ? flushSave(current) : saving);

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

store.waitForPlatform().then(showHome);

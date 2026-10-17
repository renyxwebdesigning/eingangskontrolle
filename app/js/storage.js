// Speicher für Kontrollen.
//
// Desktop-App (pywebview): Python legt jede Kontrolle als JSON-Datei im
// Benutzerordner ab (siehe desktop/main.py) und speichert PDFs über den
// normalen Speichern-Dialog des Systems.
// Browser / Tablet: IndexedDB im Browser, PDFs werden geteilt oder
// heruntergeladen.

const DB_NAME = "eingangskontrolle";
const STORE = "records";

function desktopApi() {
  return window.pywebview && window.pywebview.api ? window.pywebview.api : null;
}

/** pywebview injects its API asynchronously; wait briefly for it. */
export function waitForPlatform() {
  // desktop/main.py opens the page with ?desktop=1.
  if (desktopApi() || !new URLSearchParams(location.search).has("desktop")) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    window.addEventListener("pywebviewready", () => resolve(), { once: true });
    setTimeout(resolve, 4000);
  });
}

export const isDesktop = () => !!desktopApi();

let dbPromise = null;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    // Ask the browser not to evict our data when storage runs low.
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }
  return dbPromise;
}

function tx(mode, fn) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(req && req.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error("Speichern abgebrochen (Speicher voll?)"));
      })
  );
}

export async function listRecords() {
  const api = desktopApi();
  const all = api ? await api.list_records() : await tx("readonly", (s) => s.getAll());
  return (all || []).sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
}

export async function saveRecord(record) {
  const api = desktopApi();
  if (api) {
    const res = await api.save_record(record);
    if (res !== true) throw new Error(res || "Speichern fehlgeschlagen");
    return;
  }
  await tx("readwrite", (s) => s.put(record));
}

export async function deleteRecord(id) {
  const api = desktopApi();
  if (api) return api.delete_record(id);
  return tx("readwrite", (s) => s.delete(id));
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Save a PDF. Returns a short message for the user, or null if cancelled.
 */
export async function savePdf(blob, filename) {
  const api = desktopApi();
  if (api) {
    const res = await api.save_pdf(filename, await blobToBase64(blob));
    if (res && res.error) throw new Error(res.error);
    return res && res.path ? `Gespeichert: ${res.path}` : null;
  }
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "PDF geteilt";
    } catch (e) {
      if (e.name === "AbortError") return null;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return "PDF heruntergeladen";
}

/** Open the PDF for printing (system PDF viewer on desktop, new tab in the browser). */
export async function printPdf(blob, filename) {
  const api = desktopApi();
  if (api) {
    const res = await api.print_pdf(filename, await blobToBase64(blob));
    if (res && res.error) throw new Error(res.error);
    return res && res.message;
  }
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    await savePdf(blob, filename);
    return "Pop-up blockiert – PDF wurde heruntergeladen";
  }
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60000);
  return "PDF geöffnet – dort drucken";
}

// Small per-device preferences (e.g. last inspector name).
export function pref(key, value) {
  const k = `ek.${key}`;
  try {
    if (value === undefined) return localStorage.getItem(k) || "";
    localStorage.setItem(k, value);
  } catch {
    return "";
  }
  return value;
}

/** Where the data lives (desktop app only). */
export async function info() {
  const api = desktopApi();
  return api && api.info ? api.info() : null;
}

export function openDataFolder() {
  const api = desktopApi();
  if (api) api.open_data_folder();
}

// Kontrollpunkte der Eingangskontrolle (Rückkehr von der Baustelle).
//
// Jeder Punkt gilt für die Maschinentypen in `types`. `nv: true` heisst, der
// Punkt darf mit "n.v." (nicht vorhanden) bewertet werden, weil nicht jede
// Maschine dieses Typs die Baugruppe hat. Bei Kleingeräten und
// Spezialmaschinen ist n.v. immer erlaubt, weil diese Gruppen zu
// unterschiedlich sind.
//
// Die `id` eines Punktes darf nie geändert werden: offene Kontrollen speichern
// ihre Bewertungen unter dieser id.

export const MACHINE_TYPES = [
  { id: "raupenbagger", label: "Raupenbagger", hint: "inkl. Minibagger" },
  { id: "pneubagger", label: "Pneubagger", hint: "Mobilbagger auf Rädern" },
  { id: "radlader", label: "Radlader", hint: "inkl. Kompaktlader" },
  { id: "walze", label: "Walze", hint: "Tandem- und Walzenzüge" },
  { id: "dumper", label: "Dumper", hint: "Rad- und Drehmulden-Dumper" },
  { id: "kleingeraet", label: "Kleingerät", hint: "Vibroplatte, Stampfer, Trennschleifer, Pumpe …" },
  { id: "spezial", label: "Spezialmaschine", hint: "Alles andere – volle Liste" },
];

const ALL = MACHINE_TYPES.map((t) => t.id);
const MACH = ALL.filter((t) => t !== "kleingeraet");
const BAGGER = ["raupenbagger", "pneubagger"];

const SECTIONS = [
  {
    title: "Allgemein",
    items: [
      { id: "zustand", text: "Allgemeiner Zustand, sichtbare Schäden", hint: "Karosserie, Verkleidungen, Abdeckungen, Beschriftung", types: ALL },
      { id: "reinigung", text: "Maschine gereinigt", hint: "Fahrerplatz sauber, Kühler frei, kein Material in Gelenken und Laufwerk", types: ALL },
      { id: "zubehoer", text: "Zubehör vollständig", hint: "Schlüssel, Betriebsanleitung, Bordwerkzeug, mitgegebene Anbauteile", types: ALL },
      { id: "feuerloescher", text: "Feuerlöscher", hint: "Vorhanden, plombiert, Prüfdatum gültig", types: MACH, nv: true },
      { id: "strasse", text: "Strassenzulassung", hint: "Kontrollschild, Fahrzeugausweis, Kennleuchten", types: ["pneubagger", "radlader", "spezial"], nv: true },
    ],
  },
  {
    title: "Motor & Betriebsstoffe",
    items: [
      { id: "motoroel", text: "Motoröl", hint: "Stand zwischen Min. und Max., nicht milchig oder verdünnt", types: ALL },
      { id: "kuehlmittel", text: "Kühlmittel", hint: "Stand im Ausgleichsbehälter, Frostschutz ausreichend", types: MACH },
      { id: "kraftstoff", text: "Kraftstoff", hint: "Füllstand, Tankdeckel, Wasserabscheider entleert", types: ALL },
      { id: "adblue", text: "AdBlue", hint: "Füllstand, keine Kristallbildung an Leitungen", types: MACH, nv: true },
      { id: "riemen", text: "Keil- und Rippenriemen", hint: "Risse, Spannung, Riemenspanner", types: ALL },
      { id: "luftfilter", text: "Luftfilter, Ansaugsystem", hint: "Wartungsanzeige, Schläuche und Schellen dicht", types: ALL },
      { id: "abgas", text: "Abgasanlage, Partikelfilter", hint: "Befestigung, Russspuren, Regenerations- oder Warnanzeige", types: MACH, nv: true },
      { id: "batterie", text: "Batterie, Batteriehauptschalter", hint: "Pole fest und sauber, Halterung, Schalter funktioniert", types: MACH },
      { id: "dichtheit", text: "Dichtheit", hint: "Keine Öl-, Kraftstoff- oder Kühlmittelspuren an Motor, Getriebe, Achsen und unter der Maschine", types: ALL },
    ],
  },
  {
    title: "Hydraulik",
    items: [
      { id: "hydoel", text: "Hydrauliköl", hint: "Stand im Schauglas, Maschine in Grundstellung", types: MACH },
      { id: "schlaeuche", text: "Hydraulikschläuche und Leitungen", hint: "Scheuerstellen, Risse, feuchte Verschraubungen", types: MACH },
      { id: "zylinder", text: "Hydraulikzylinder", hint: "Kolbenstangen ohne Riefen und Rost, Dichtungen dicht", types: MACH },
    ],
  },
  {
    title: "Fahrwerk",
    items: [
      { id: "laufwerk", text: "Laufwerk", hint: "Kettenspannung, Bodenplatten, Lauf- und Stützrollen, Turas, Leitrad", types: ["raupenbagger", "spezial"] },
      { id: "reifen", text: "Reifen und Räder", hint: "Profil, Schnitte, Luftdruck, Radmuttern fest", types: ["pneubagger", "radlader", "walze", "dumper", "spezial"], nv: true },
      { id: "bremsen", text: "Betriebs- und Feststellbremse", hint: "Bremswirkung, Feststellbremse hält", types: ["pneubagger", "radlader", "walze", "dumper", "spezial"] },
      { id: "knick", text: "Knickgelenk, Pendelachse", hint: "Lagerspiel, Bolzensicherungen, Knicksicherung vorhanden", types: ["radlader", "walze", "dumper", "spezial"], nv: true },
    ],
  },
  {
    title: "Kabine & Sicherheit",
    items: [
      { id: "rops", text: "Kabine / Schutzdach (ROPS, FOPS)", hint: "Keine Risse, Verformungen oder nachträglichen Bohrungen", types: MACH },
      { id: "scheiben", text: "Scheiben, Spiegel, Scheibenwischer", hint: "Keine Risse, Spiegel vollständig, Waschanlage gefüllt", types: MACH, nv: true },
      { id: "sitz", text: "Fahrersitz, Sicherheitsgurt", hint: "Gurt rollt auf und rastet ein, Sitz verstellbar", types: MACH },
      { id: "aufstieg", text: "Aufstieg, Türen, Notausstieg", hint: "Trittstufen und Haltegriffe fest, Türen verriegeln, Nothammer vorhanden", types: MACH },
      { id: "sperre", text: "Bedienungssperre", hint: "Hydraulik gesperrt bei hochgeklappter Konsole bzw. Sicherheitshebel", types: ["raupenbagger", "pneubagger", "radlader", "spezial"], nv: true },
      { id: "licht", text: "Beleuchtung, Rundumleuchte", hint: "Arbeits- und Fahrlicht, Blinker, Brems- und Rücklicht", types: MACH },
      { id: "warn", text: "Hupe, Rückfahrwarner, Kamera", hint: "Alles vorhandene funktioniert", types: MACH },
      { id: "anzeigen", text: "Instrumente, Kontrolllampen", hint: "Keine Warnungen oder Fehlercodes – Codes in der Bemerkung notieren", types: MACH },
    ],
  },
  {
    title: "Gerät & Sicherheit",
    items: [
      { id: "kg_schutz", text: "Schutzeinrichtungen", hint: "Riemenschutz, Schutzhaube, Führungsbügel vollständig und fest", types: ["kleingeraet"] },
      { id: "kg_bedienung", text: "Bedienelemente, Stopp-Schalter", hint: "Gashebel, Stopp-Schalter, Totmannschaltung funktionieren", types: ["kleingeraet"] },
      { id: "kg_elektro", text: "Kabel, Stecker, Schalter", hint: "Elektrogeräte: Isolation unbeschädigt, Stecker ganz", types: ["kleingeraet"] },
      { id: "kg_puffer", text: "Gummipuffer, Schwingungsdämpfer", hint: "Keine Risse oder Ablösungen", types: ["kleingeraet"] },
      { id: "kg_platte", text: "Grundplatte, Stampffuss", hint: "Verschleiss, Risse, Schrauben fest", types: ["kleingeraet"] },
      { id: "kg_erreger", text: "Erreger, Kupplung", hint: "Ölstand im Erreger, Fliehkraftkupplung, vorwärts und rückwärts", types: ["kleingeraet"] },
    ],
  },
  {
    title: "Arbeitsausrüstung",
    items: [
      { id: "loeffel", text: "Löffel, Anbaugeräte", hint: "Zähne, Schneide, Seitenmesser, Verschleiss, Risse", types: BAGGER },
      { id: "schaufel", text: "Schaufel, Anbaugeräte", hint: "Schneide, Zähne, Verschleiss; Gabelzinken falls dabei", types: ["radlader"] },
      { id: "anbau", text: "Arbeitsausrüstung, Anbaugeräte", hint: "Zustand, Verschleiss, Befestigung", types: ["spezial"] },
      { id: "schnellwechsler", text: "Schnellwechsler", hint: "Verriegelung, Sicherungsbolzen, Anzeige – sicherheitsrelevant", types: ["raupenbagger", "pneubagger", "radlader", "spezial"], nv: true },
      { id: "ausleger", text: "Ausleger, Stiel, Bolzen", hint: "Risse an Schweissnähten, Bolzen- und Buchsenspiel, Sicherungen", types: BAGGER },
      { id: "hubgeruest", text: "Hubgerüst, Kinematik", hint: "Risse, Bolzen- und Buchsenspiel, Sicherungen", types: ["radlader"] },
      { id: "drehkranz", text: "Drehkranz, Schwenkwerk", hint: "Spiel, Geräusche, Befestigungsschrauben", types: BAGGER },
      { id: "schild", text: "Planierschild, Pratzen", hint: "Funktion, Zylinder dicht, Schneide", types: BAGGER, nv: true },
      { id: "hebezeug", text: "Lasthaken, Rohrbruchsicherungen", hint: "Haken mit Sicherung, Überlastwarnung funktioniert", types: BAGGER, nv: true },
      { id: "mulde", text: "Mulde", hint: "Schäden, Verriegelung, Kipp- und Drehfunktion", types: ["dumper"] },
      { id: "muldenstuetze", text: "Muldenstütze, Wartungssicherung", hint: "Vorhanden und funktionsfähig", types: ["dumper"] },
      { id: "bandage", text: "Bandagen", hint: "Oberfläche, Schweissnähte, Gummipuffer", types: ["walze"] },
      { id: "abstreifer", text: "Abstreifer", hint: "Zustand und Einstellung", types: ["walze"] },
      { id: "beriesel", text: "Berieselungsanlage", hint: "Tank, Düsen, Filter, Pumpe – bei Frostgefahr entleert", types: ["walze"], nv: true },
      { id: "vibration", text: "Vibration, Oszillation", hint: "Beide Amplituden, keine Schläge oder Geräusche", types: ["walze"] },
      { id: "schmierung", text: "Schmierung", hint: "Alle Schmierstellen abgeschmiert, Zentralschmierung gefüllt", types: ["raupenbagger", "pneubagger", "radlader", "dumper", "spezial"] },
    ],
  },
  {
    title: "Funktionstest",
    items: [
      { id: "ft_motor", text: "Motor: Start und Lauf", hint: "Startet sauber, läuft rund, kein blauer oder schwarzer Rauch", types: ALL },
      { id: "ft_fahren", text: "Fahren und Lenken", hint: "Beide Richtungen, gerader Lauf, keine ungewöhnlichen Geräusche", types: MACH },
      { id: "ft_arbeit", text: "Arbeitsfunktionen", hint: "Alle Bewegungen ruckfrei, keine Drift unter Last", types: ALL },
    ],
  },
];

export function machineType(id) {
  return MACHINE_TYPES.find((t) => t.id === id) || MACHINE_TYPES[MACHINE_TYPES.length - 1];
}

/** Sections with only the items for `typeId`, numbered 1..n across sections. */
export function checklistFor(typeId) {
  const nvAlways = typeId === "kleingeraet" || typeId === "spezial";
  let nr = 0;
  return SECTIONS.map((s) => ({
    title: s.title,
    items: s.items
      .filter((it) => it.types.includes(typeId))
      .map((it) => ({ id: it.id, text: it.text, hint: it.hint, nv: nvAlways || !!it.nv, nr: ++nr })),
  })).filter((s) => s.items.length);
}

export const VERDICTS = [
  { id: "ok", label: "Einsatzbereit", short: "Einsatzbereit" },
  { id: "bedingt", label: "Einsatzbereit mit Einschränkung", short: "Eingeschränkt" },
  { id: "gesperrt", label: "Gesperrt – Reparatur nötig", short: "Gesperrt" },
];

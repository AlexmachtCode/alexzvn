import type { AnhangOrdnerStand, OrdnerProblem, SideEventOrdnerStand } from '@shared/types';

// Kopfzeile und Zeilen der Ordner-Ablage im Side-Events-Panel (iveo-Paket Teil E, Spec 9.13, 11.1, 11.2; E51) als reine
// Funktionen. Der Renderer bewertet mit seiner eigenen Uhr („überfällig“, „kein Fortschritt“), auch wenn der Takt im Main
// steht; keine Zeile verspricht „spätestens“. Jede Zeile wird über das Kreuzprodukt ihrer Achsen getestet.
// Nur `import type`: test/selftest.ts lädt diese Datei per strip-types ohne Alias (G5).

/** „überfällig“ = Uhr mehr als ein Takt (45 s) nach „gegen“ (11.1). */
const UEBERFAELLIG_NACH_MS = 45_000;
/** „kein Fortschritt“ = mehr als 105 s seit letzterFortschritt: Leerlauf-Grenze 60 s plus ein Takt (11.1). */
const KEIN_FORTSCHRITT_NACH_MS = 105_000;
/** Ein anderer Rechner übernimmt eine fremde Sperre 15 min nach ihrem Lebenszeichen (9.2 Regel 6, SPERRE_ABLAUF_MS). */
const UEBERNAHME_NACH_MS = 900_000;

/** Texte der Ablage im Panel (Spec 11.6: T26, T30, T32–T48, T52, T57–T68, T72, T73, T76; T78 neu, OFP6; Problem-Formen 11.2). */
export const ORDNER_ZEILEN_TEXTE = {
  schalter: 'Anhänge in Side-Event-Ordnern ablegen', // T26
  ordnerOeffnen: 'Ordner öffnen', // T30
  rolleSlave: 'Dieser Rechner hat die Rolle „Mit Master verbinden“ und legt keine Anhänge ab.', // T32
  keinToken: 'Anhänge lädt nur der Launcher mit dem iveo-Token dieser Show.', // T33
  ausgeschaltet: 'Ablage in Side-Event-Ordnern ausgeschaltet.', // T34
  showDateiFehlt: 'Show-Datei am Öffnungspfad nicht gefunden oder nicht lesbar. Ablage pausiert, bis sie wieder da ist.', // T35
  nichtAnlegbar: (name: string, code: string, gegen: string): string => `Ordner „${name}“ nicht anlegbar (${code}). Nächster Versuch gegen ${gegen}.`, // T36
  sperreFehler: (name: string, wie: 'lesbar' | 'schreibbar', code: string, gegen: string): string =>
    `Sperrdatei in „${name}“ nicht ${wie} (${code}). Nächster Versuch gegen ${gegen}.`, // T78 (neu, OFP6)
  laeuft: (name: string, i: number, n: number): string => `Ablage: „${name}“ · Abgleich läuft (${i} von ${n})`, // T37
  bereit: (name: string, gegen: string): string => `Ablage: „${name}“ · nächster Abgleich gegen ${gegen}`, // T38
  bereitLeer: (name: string, gegen: string): string => `Ablage: „${name}“ · noch nichts abgelegt · nächster Abgleich gegen ${gegen}`, // T39
  nichtInAblage: 'Nicht in der Ablage dieser Show, kein Ordner.', // T40
  neueresFormat: 'Ordner stammt von einem neueren Launcher und wird hier nicht verändert.', // T41
  nochNichtAbgeglichen: 'Anhänge: noch nicht abgeglichen', // T42
  laedt: (datei: string, x: string, y: string | null): string =>
    (y === null ? `Anhänge: lädt „${datei}“ (${x} MB) …` : `Anhänge: lädt „${datei}“ (${x} von ${y} MB) …`), // T43
  gestoert: (k: number, n: number, stand: string, text: string, seit: string): string =>
    `Anhänge: ${k} von ${n} im Ordner · Stand ${stand} · Abgleich gestört: ${text} (seit ${seit})`, // T44
  gestoertNie: (text: string, seit: string): string => `Anhänge: Abgleich gestört: ${text} (seit ${seit})`, // T45
  keineAnhaenge: (stand: string): string => `Keine Anhänge · Stand ${stand}`, // T46
  vollstaendig: (n: number, stand: string): string => `Anhänge: ${n} im Ordner · Stand ${stand}`, // T47
  mitProblem: (k: number, n: number, stand: string, problem: string): string => `Anhänge: ${k} von ${n} im Ordner · Stand ${stand} · ${problem}`, // T48
  teilweise: (k: number, n: number, stand: string): string => `Anhänge: ${k} von ${n} im Ordner · Stand ${stand}`, // T48 ohne ‹Problem› (nur k < n)
  keineShow: 'Anhänge werden erst mit einer geöffneten Show-Datei in Ordnern neben ihr abgelegt.', // T52
  fremdeSperre: (rechner: string, lebenszeichen: string, uebernahme: string): string =>
    `Ablage liegt bei Rechner „${rechner}“ (letztes Lebenszeichen ${lebenszeichen}); dieser Rechner legt nichts ab und übernimmt gegen ${uebernahme}, wenn kein neues Lebenszeichen kommt.`, // T57
  ersteRunde: (name: string): string => `Ablage: „${name}“ · erster Abgleich folgt`, // T58
  ueberfaellig: (name: string, seit: string): string => `Ablage: „${name}“ · Abgleich überfällig seit ${seit}`, // T59
  nichtMehrInAblage: 'Nicht mehr in der Ablage dieser Show, Ordner bleibt unverändert.', // T60
  fruehereSitzung: (k: number, stand: string): string => `Anhänge: ${k} im Ordner · Stand ${stand} (frühere Sitzung) · Abgleich folgt`, // T61
  wartet: (datei: string): string => `Anhänge: wartet auf den laufenden Download „${datei}“ (anderes Side Event)`, // T62
  ordnerNichtAnlegbar: (grund: string): string => `Anhänge: Ordner nicht anlegbar: ${grund}`, // T63
  gestoerteZusatz: (m: number): string => ` · ${m} Side Events gestört`, // T64
  weitere: 'Weitere Side Events der Ablage', // T65
  weitererOrdner: (name: string): string => ` · weiterer Ordner „${name}“ mit derselben Kennung wird nicht gepflegt`, // T66
  bedienerGeaendert: (m: number): string => ` · ${m} vom Bediener geändert`, // T67
  gesperrteEndungen: (m: number): string => ` · ${m} Dateien mit gesperrter Endung umbenannt`, // T68
  indexNeu: ' · Index war beschädigt und ist neu aufgebaut', // T72
  namensgleich: (rechner: string): string =>
    `Ablage von einem zweiten Launcher mit demselben Rechnernamen „${rechner}“ übernommen (anderer Benutzer an diesem Rechner oder Rechner mit gleichem Namen); dieser Launcher legt nichts ab, bis die Show neu geöffnet wird.`, // T73
  keinFortschritt: (name: string, i: number, n: number, seit: string): string =>
    `Ablage: „${name}“ · Abgleich läuft (${i} von ${n}) · kein Fortschritt seit ${seit}`, // T76
  problemGrund: (datei: string, grund: string): string => `${datei}: ${grund}`,
  problemGrundVersuch: (datei: string, grund: string, gegen: string): string => `${datei}: ${grund} · nächster Versuch gegen ${gegen}`,
  problemNeueFassung: (datei: string): string => `${datei}: neue Fassung wartet, Datei ist geöffnet`,
  problemUmbenennen: (datei: string): string => `${datei}: Umbenennen wartet, Datei ist geöffnet`,
  problemOrdnerUmbenennen: 'Ordner-Umbenennen wartet, Inhalt ist geöffnet',
  problemIndex: (code: string): string => `Index nicht schreibbar (${code})`,
  problemWeitere: (m: number): string => ` (und ${m} weitere)`,
} as const;

const zeitVon = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : Number.NaN);

/** „hh:mm“ (Ortszeit); „--:--“, wenn der Zeitpunkt fehlt oder nicht lesbar ist. */
function uhrzeit(ms: number): string {
  if (!Number.isFinite(ms)) return '--:--';
  return new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/** ‹Stand› (11.2): „hh:mm“ von heute, sonst „TT.MM. hh:mm“. */
function standText(iso: string | null, jetztMs: number): string {
  const t = zeitVon(iso);
  if (!Number.isFinite(t)) return '--:--';
  const d = new Date(t);
  const j = new Date(jetztMs);
  if (d.getFullYear() === j.getFullYear() && d.getMonth() === j.getMonth() && d.getDate() === j.getDate()) return uhrzeit(t);
  const z = (n: number): string => String(n).padStart(2, '0');
  return `${z(d.getDate())}.${z(d.getMonth() + 1)}. ${uhrzeit(t)}`;
}

/** Megabyte wie im Main (side-event-ordner.ts `megabyte`): MiB, höchstens eine Nachkommastelle, ohne Tausenderpunkt. */
function megabyte(b: number): string {
  return (b / 1_048_576).toLocaleString('de-DE', { maximumFractionDigits: 1, useGrouping: false });
}

export type KopfFall = 'K0' | 'K1' | 'K2' | 'K3' | 'K4' | 'K5' | 'K6' | 'K7' | 'K8' | 'K9' | 'K10';
export type ZeilenFall = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'S9' | 'S10' | 'S11' | 'S12' | 'S13';

const WARTEND: ReadonlySet<OrdnerProblem['art']> = new Set(['neue-fassung-wartet', 'umbenennen-wartet', 'ordner-umbenennen-wartet']);

/** Erste zutreffende Zeile nach 11.2 (ohne Uhr: die Klasse hängt nicht von der Zeit ab). */
function zeilenFall(se: SideEventOrdnerStand): ZeilenFall {
  if (!se.inMenge) return se.existiert ? 'S2' : 'S1';
  if (se.indexFormat === 'neuer') return 'S3';
  if (se.anlegbar !== null) return 'S4';
  if (se.laedt !== null) return 'S5';
  if (se.aktiv && se.wartetHinter !== null) return 'S6';
  if (se.abruf === 'keiner') return se.indexFormat === 'eins' && se.stand !== null ? 'S8' : 'S7';
  if (se.abruf === 'gescheitert') return se.stand !== null ? 'S9' : 'S10';
  if (se.n === 0 && !se.probleme.some((p) => !WARTEND.has(p.art))) return 'S11';
  if (se.k === se.n && se.probleme.length === 0) return 'S12';
  return 'S13';
}

/** Gestörte Side Events für T64 (9.13): S4, S9, S10 und S13 mit einem Problem, das kein Warten ist. */
export function gestoerteSideEvents(stand: AnhangOrdnerStand): number {
  return stand.sideEvents.filter((se) => {
    const f = zeilenFall(se);
    return f === 'S4' || f === 'S9' || f === 'S10' || (f === 'S13' && se.probleme.some((p) => !WARTEND.has(p.art)));
  }).length;
}

/**
 * Kopfzeile (11.1), erste zutreffende Bedingung: K0 keine Show (keine Zeile; das Panel zeigt T52) · K1 Rolle slave ·
 * K2 kein Token · K3 Schalter aus · K4 Show-Datei fehlt oder nicht lesbar · K5 fremde (T57) bzw. namensgleiche (T73)
 * Sperre · K6 Basisordner nicht anlegbar (T36) bzw. Sperrdatei nicht lesbar oder schreibbar (T78), beide nach Ablauf wie K9/K10 T59 · K7 Runde läuft
 * (nach mehr als 105 s ohne Fortschritt T76) · K8 erste Runde
 * ausstehend · K9 bereit, Basisordner da · K10 bereit, Basisordner fehlt (K9/K10 mehr als 45 s nach „gegen“: T59).
 * T64 hängt an K7 und K9, wenn ein Side Event gestört ist. Ohne bekannten Basisordner (basis null) gibt es keinen ‹Name›:
 * K7, K8 und K10 dann ohne Zeile statt „Ablage: „“ …“, „Ordner öffnen“ nur mit Basisordner (G8; der Lauf setzt ihn ab dem
 * Öffnen der Show ohne Dateizugriff, Gesamtprüfung Befund 2).
 */
export function kopfzeile(
  stand: AnhangOrdnerStand | null,
  jetztMs: number,
): { fall: KopfFall; text: string | null; schalter: boolean; ordnerOeffnen: boolean; tooltip: string | null } {
  const T = ORDNER_ZEILEN_TEXTE;
  if (stand === null || !stand.showOffen) return { fall: 'K0', text: null, schalter: false, ordnerOeffnen: false, tooltip: null };
  if (stand.rolle === 'slave') return { fall: 'K1', text: T.rolleSlave, schalter: false, ordnerOeffnen: false, tooltip: null };
  if (!stand.tokenDa) return { fall: 'K2', text: T.keinToken, schalter: false, ordnerOeffnen: false, tooltip: null };
  const bekannt = stand.basis !== null && stand.basis !== undefined;
  const name = stand.basis?.name ?? '';
  const mitName = (text: string): string | null => (bekannt ? text : null);
  const existiert = stand.basis?.existiert === true;
  const tooltip = stand.basis?.pfad ?? null;
  if (!stand.schalterAn) return { fall: 'K3', text: T.ausgeschaltet, schalter: true, ordnerOeffnen: existiert, tooltip };
  if (stand.showDatei !== 'da') return { fall: 'K4', text: T.showDateiFehlt, schalter: true, ordnerOeffnen: false, tooltip };
  if (stand.sperre !== null) {
    const s = stand.sperre;
    const text = s.art === 'fremd'
      ? T.fremdeSperre(s.rechner, uhrzeit(zeitVon(s.lebenszeichen)), uhrzeit(zeitVon(s.lebenszeichen) + UEBERNAHME_NACH_MS))
      : T.namensgleich(s.rechner);
    return { fall: 'K5', text, schalter: true, ordnerOeffnen: bekannt, tooltip };
  }
  const gegen = zeitVon(stand.naechsteRundeGegen);
  if (stand.basis?.fehler) {
    // K6: die Zeit nennt der Fehler selbst (nächster Versuch); an der Sperrdatei ist der Ordner meist da (OFP6, 9.13)
    const f = stand.basis.fehler;
    const versuchMs = zeitVon(f.naechsterVersuch);
    const versuch = uhrzeit(versuchMs);
    // Nach Ablauf (mehr als 45 s nach dem Versuch, ohne dass ein neuer Stand kam: der Takt hängt) wie K9/K10 T59 mit dieser Zeit (11.1)
    if (Number.isFinite(versuchMs) && jetztMs - versuchMs > UEBERFAELLIG_NACH_MS) {
      return { fall: 'K6', text: T.ueberfaellig(name, versuch), schalter: true, ordnerOeffnen: f.sperre ? existiert : false, tooltip };
    }
    if (f.sperre) return { fall: 'K6', text: T.sperreFehler(name, f.sperre === 'lesen' ? 'lesbar' : 'schreibbar', f.code, versuch), schalter: true, ordnerOeffnen: existiert, tooltip };
    return { fall: 'K6', text: T.nichtAnlegbar(name, f.code, versuch), schalter: true, ordnerOeffnen: false, tooltip };
  }
  const m = gestoerteSideEvents(stand);
  const zusatz = m > 0 ? T.gestoerteZusatz(m) : '';
  if (stand.runde !== null) {
    const lf = zeitVon(stand.letzterFortschritt);
    const steht = Number.isFinite(lf) && jetztMs - lf > KEIN_FORTSCHRITT_NACH_MS;
    const text = steht ? T.keinFortschritt(name, stand.runde.i, stand.runde.n, uhrzeit(lf)) : T.laeuft(name, stand.runde.i, stand.runde.n);
    return { fall: 'K7', text: mitName(text + zusatz), schalter: true, ordnerOeffnen: existiert, tooltip };
  }
  if (!stand.ersteRundeGestartet) return { fall: 'K8', text: mitName(T.ersteRunde(name)), schalter: true, ordnerOeffnen: existiert, tooltip };
  const ueberfaellig = Number.isFinite(gegen) && jetztMs - gegen > UEBERFAELLIG_NACH_MS;
  if (existiert) {
    const text = ueberfaellig ? T.ueberfaellig(name, uhrzeit(gegen)) : T.bereit(name, uhrzeit(gegen));
    return { fall: 'K9', text: text + zusatz, schalter: true, ordnerOeffnen: true, tooltip };
  }
  return { fall: 'K10', text: mitName(ueberfaellig ? T.ueberfaellig(name, uhrzeit(gegen)) : T.bereitLeer(name, uhrzeit(gegen))), schalter: true, ordnerOeffnen: false, tooltip };
}

function problemText(p: OrdnerProblem): string {
  const T = ORDNER_ZEILEN_TEXTE;
  switch (p.art) {
    case 'grund':
      return p.naechsterVersuch ? T.problemGrundVersuch(p.datei, p.grund, uhrzeit(zeitVon(p.naechsterVersuch))) : T.problemGrund(p.datei, p.grund);
    case 'neue-fassung-wartet':
      return T.problemNeueFassung(p.datei);
    case 'umbenennen-wartet':
      return T.problemUmbenennen(p.datei);
    case 'ordner-umbenennen-wartet':
      return T.problemOrdnerUmbenennen;
    case 'index-nicht-schreibbar':
      return T.problemIndex(p.code);
  }
}

/** ‹Problem› in T48: das erste nach Dateiname (Vergleichsform; Formen ohne Datei zuerst), bei mehreren „ (und ‹m› weitere)“. */
function erstesProblem(probleme: readonly OrdnerProblem[]): string | null {
  if (probleme.length === 0) return null;
  const schluessel = (p: OrdnerProblem): string => ('datei' in p ? p.datei : '').normalize('NFC').toLowerCase();
  const erstes = [...probleme].sort((a, b) => (schluessel(a) < schluessel(b) ? -1 : schluessel(a) > schluessel(b) ? 1 : 0))[0];
  return problemText(erstes) + (probleme.length > 1 ? ORDNER_ZEILEN_TEXTE.problemWeitere(probleme.length - 1) : '');
}

function zusaetze(se: SideEventOrdnerStand): string {
  const T = ORDNER_ZEILEN_TEXTE;
  const z = se.zusaetze;
  return (z.indexNeuAufgebaut ? T.indexNeu : '')
    + (z.weitererOrdner !== null ? T.weitererOrdner(z.weitererOrdner) : '')
    + (z.bedienerGeaendert > 0 ? T.bedienerGeaendert(z.bedienerGeaendert) : '')
    + (z.gesperrteEndungen > 0 ? T.gesperrteEndungen(z.gesperrteEndungen) : '');
}

/**
 * Zeile je Side Event (11.2), nur in K7–K10; `se` undefined (nicht im Stand) = S1. Erste zutreffende Bedingung:
 * S1/S2 nicht in der Menge (ohne/mit Ordner) · S3 neueres Indexformat · S4 nicht anlegbar · S5 lädt · S6 aktives wartet
 * hinter dem Download eines anderen · S7/S8 noch kein Abruf (ohne/mit Index und Stand) · S9/S10 gescheitert (mit/ohne
 * früheren Stand) · S11 n = 0 (nur ohne Problem, das kein Warten ist: 9.13) · S12 vollständig · S13 sonst. Zusätze T72, T66, T67, T68 hängen an der Zeile.
 * Ohne Problem (nur k < n) zeigt S13 T48 ohne den Teil „ · ‹Problem›“.
 */
export function ordnerZeile(
  se: SideEventOrdnerStand | undefined,
  jetztMs: number,
): { fall: ZeilenFall; text: string; ordnerOeffnen: boolean; tooltip: string | null } {
  const T = ORDNER_ZEILEN_TEXTE;
  if (se === undefined) return { fall: 'S1', text: T.nichtInAblage, ordnerOeffnen: false, tooltip: null };
  const fall = zeilenFall(se);
  const stand = standText(se.stand, jetztMs);
  const fehler = se.fehler?.text ?? '';
  const seit = uhrzeit(zeitVon(se.fehler?.seit));
  let text: string;
  let oeffnen = se.existiert;
  switch (fall) {
    case 'S1': text = T.nichtInAblage; oeffnen = false; break;
    case 'S2': text = T.nichtMehrInAblage; oeffnen = true; break;
    case 'S3': text = T.neueresFormat; oeffnen = true; break;
    case 'S4': text = T.ordnerNichtAnlegbar(se.anlegbar?.grund ?? ''); oeffnen = false; break;
    case 'S5': {
      const l = se.laedt;
      text = T.laedt(l?.datei ?? '', megabyte(l?.bytes ?? 0), l?.groesse === null || l?.groesse === undefined ? null : megabyte(l.groesse));
      break;
    }
    case 'S6': text = T.wartet(se.wartetHinter ?? ''); break;
    case 'S7': text = T.nochNichtAbgeglichen; break;
    case 'S8': text = T.fruehereSitzung(se.k, stand); break;
    case 'S9': text = T.gestoert(se.k, se.n, stand, fehler, seit); break;
    case 'S10': text = T.gestoertNie(fehler, seit); break;
    case 'S11': text = T.keineAnhaenge(stand); break;
    case 'S12': text = T.vollstaendig(se.n, stand); break;
    case 'S13': {
      const p = erstesProblem(se.probleme);
      text = p === null ? T.teilweise(se.k, se.n, stand) : T.mitProblem(se.k, se.n, stand, p);
      break;
    }
  }
  return { fall, text: text + zusaetze(se), ordnerOeffnen: oeffnen, tooltip: se.pfad };
}

/**
 * Zeile eines Side Events der Panel-Liste (G8). Solange die erste Runde aussteht (K8: nach neuer Sitzung oder Neubinden) oder
 * die erste Durchsicht des Basisordners nicht fertig ist (durchsichtFertig), sind Ablage-Menge und Ordner außerhalb der Menge
 * unbekannt: ein Side Event ohne Eintrag bekommt dann keine Zeile (null), weil S1 „kein Ordner“ dort falsch sein kann.
 * Danach gilt ordnerZeile (kein Eintrag = S1).
 */
export function listenZeile(
  stand: AnhangOrdnerStand,
  programId: string,
  jetztMs: number,
): ReturnType<typeof ordnerZeile> | null {
  const se = stand.sideEvents.find((s) => s.programId === programId);
  if (se === undefined && (!stand.ersteRundeGestartet || !stand.durchsichtFertig)) return null;
  return ordnerZeile(se, jetztMs);
}

/** Block „Weitere Side Events der Ablage“ (T65, 9.13): Side Events der Menge, die die Panel-Liste nicht zeigt. */
export function weitereSideEvents(stand: AnhangOrdnerStand, panelIds: readonly string[]): SideEventOrdnerStand[] {
  return stand.sideEvents.filter((se) => se.inMenge && !panelIds.includes(se.programId));
}

// ── Ende des Moduls ──

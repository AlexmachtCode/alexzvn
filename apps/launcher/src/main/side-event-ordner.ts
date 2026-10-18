// Reine Regeln der Side-Event-Ordner (iveo-Paket Teil E, Spec 9.1–9.15): Namen und Pfade (9.12), Vergleichsform (9.9),
// Links (9.7), Panel-Entscheidungen (8.6), Fehlertexte (9.13), Index (9.8), Ablage-Menge (9.3), Sperre (9.2),
// Rückhaltung (9.6). Ohne Electron und ohne Dateizugriff, per tsx getestet (test/side-event-ordner.test.ts). Den Ablauf mit
// eingereichtem Dateisystem führt side-event-ordner-lauf.ts aus.
//
// SICHERHEIT (E20, G4): Asset-Referenz, Weiterleitungsadresse und Token erscheinen in keinem Ergebnis dieses Moduls.
import { createHash } from 'node:crypto';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import { IveoApiError, IveoAssetAdresseError, type IveoMaterial } from '@jm/iveo';
import { istGeloescht } from './iveo-anhaenge';

/** Endung je MIME-Typ (aus `iveo-sync.ts:602-616` übernommen; die alte Kopie und `extFor` entfernt Task 30, EP18). */
export const MIME_EXT: Readonly<Record<string, string>> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/zip': '.zip',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'text/plain': '.txt',
  'video/mp4': '.mp4',
};

/**
 * Sperrliste (9.12 Regel 9, E49): ausführbare Endungen unter Windows und macOS, Kleinschreibung. Die ersten vier Zeilen
 * sind die Liste der Spec wörtlich (Windows 41, macOS 10); die letzte trägt die Startformate, die sie offen lässt (Owner-Frage
 * OFP4, Vorgabe; ohne Herkunftsmarkierung, OF9, greifen weder SmartScreen noch Gatekeeper).
 */
export const GESPERRTE_ENDUNGEN: ReadonlySet<string> = new Set([
  'exe', 'com', 'scr', 'pif', 'bat', 'cmd', 'msi', 'msp', 'mst', 'msc', 'cpl', 'hta', 'js', 'jse', 'vbs', 'vbe', 'wsf', 'wsh',
  'wsc', 'ps1', 'psm1', 'psd1', 'ps1xml', 'reg', 'inf', 'lnk', 'url', 'scf', 'library-ms', 'searchconnector-ms',
  'settingcontent-ms', 'appref-ms', 'application', 'gadget', 'chm', 'jar', 'diagcab', 'vhd', 'vhdx', 'iso', 'img',
  'app', 'command', 'tool', 'terminal', 'scpt', 'workflow', 'pkg', 'mpkg', 'dmg', 'sh',
  ...'py pyw jnlp msix msixbundle appx appxbundle appinstaller rdp xll wsb website sct shb shs mde ade adp ins isp fileloc inetloc webloc applescript scptd'.split(' '),
]);

/** Pfadbudget in UTF-16-Einheiten (Windows, Explorer, Office; 9.12 Regel 10). */
const PFAD_BUDGET = 250;
/** Jeder Name höchstens 120 Codepunkte und 240 Bytes UTF-8 (9.12 Regel 10), samt Zusatz „ (99)“ (9.9). */
const NAME_MAX_CP = 120;
const NAME_MAX_BYTES = 240;
const ZUSATZ_RESERVE = ' (99)';
/** Reserve hinter `‹Ordnerpfad›\entfernt\` für die längste Dateiform (9.12 Regel 10: 8 + 33 + 5 + 6 = 52 ≤ 60). */
const ORDNER_RESERVE = 60;
const MIN_STAMM = 8;
const ENTFERNT = 'entfernt';
/** Längster Zusatz einer Datei in `entfernt/` (NR1): „ (unvollständig JJJJ-MM-TT hh-mm)“, 33 Einheiten. */
const LAENGSTER_ZUSATZ = ' (unvollständig JJJJ-MM-TT hh-mm)';
/** Zusatz des Basisordners (9.1): Trenner U+0020 U+2013 U+0020. */
const BASIS_ZUSATZ = ' – Side Events';

/** Vergleichsform jedes Namensvergleichs (9.9): NFC, dann Kleinschreibung. */
export function vergleichsform(name: string): string {
  return name.normalize('NFC').toLowerCase();
}

/** Regel 2: Steuerzeichen (C0, DEL, C1), jedes Zeichen der Kategorie Cf und `<>:"/\|?*` → `_`. */
const ERSETZEN = /[\u0000-\u001f\u007f-\u009f<>:"/\\|?*]|\p{Cf}/gu;
/** Regel 7: reservierte Windows-Namen (Teil vor dem ersten Punkt, ohne Leerzeichen am Ende, Groß/klein egal). */
const RESERVIERT: ReadonlySet<string> = new Set([
  'CON', 'PRN', 'AUX', 'NUL', 'CONIN$', 'CONOUT$',
  ...Array.from({ length: 10 }, (_, i) => `COM${i}`), 'COM¹', 'COM²', 'COM³',
  ...Array.from({ length: 10 }, (_, i) => `LPT${i}`), 'LPT¹', 'LPT²', 'LPT³',
]);

/** Regeln 3–8 aus 9.12 (laufen nach dem Kürzen erneut, Regel 10). */
function regeln3bis8(name: string, leer: 'Anhang' | 'Side Event'): string {
  let s = name.replace(/\s+/g, ' ').trim(); // 3
  s = s.replace(/[. ]+$/, ''); // 4
  if (s.startsWith('.')) s = `_${s}`; // 5
  if (s === '.' || s === '..') s = '_'; // 6
  if (RESERVIERT.has(s.split('.')[0].replace(/ +$/, '').toUpperCase())) s = `_${s}`; // 7
  return s === '' ? leer : s; // 8
}

/** Regeln 1–8 aus 9.12: NFC, Ersetzen, Leerraum, Ende, Punkt vorn, `.`/`..`, reservierte Namen, leer → `leer`. */
export function bereinigeName(roh: string, leer: 'Anhang' | 'Side Event'): string {
  return regeln3bis8((typeof roh === 'string' ? roh : '').normalize('NFC').replace(ERSETZEN, '_'), leer);
}

const codepunkte = (s: string): number => Array.from(s).length;
const bytes = (s: string): number => Buffer.byteLength(s, 'utf8');

/**
 * Regel 10: an Codepunkt-Grenzen kürzen, bis Einheiten, Codepunkte und Bytes passen; danach laufen die Regeln 3–8 erneut
 * (ein gekürzter Name endet sonst auf Leerzeichen oder Punkt).
 */
function kuerze(s: string, maxEinheiten: number, maxCp: number, maxBytes: number, leer: 'Anhang' | 'Side Event'): string {
  const passt = (t: string): boolean => t.length <= maxEinheiten && codepunkte(t) <= maxCp && bytes(t) <= maxBytes;
  if (passt(s)) return s;
  const zeichen = Array.from(s);
  for (let n = Math.min(zeichen.length, maxCp); n > 0; n--) {
    const t = regeln3bis8(zeichen.slice(0, n).join(''), leer);
    if (passt(t)) return t;
  }
  return leer;
}

/** Endung eines Namens nach Regel 9: Punkt + 2–5 Buchstaben oder Ziffern mit mindestens einem Buchstaben, sonst null. */
function endungAusName(name: string): string | null {
  const m = /\.([A-Za-z0-9]{2,5})$/.exec(name);
  return m !== null && m.index > 0 && /[A-Za-z]/.test(m[1]) ? m[0] : null;
}

/** Letzte Endung (Text nach dem letzten Punkt, Kleinschreibung, beliebige Länge), ohne Punkt: ''. */
function letzteEndung(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

function mimeEndung(mime: string | null): string {
  return (mime && MIME_EXT[mime.toLowerCase()]) || '';
}

/** Sperrliste (Regel 9): Ist die letzte Endung gesperrt, wird ihr Punkt zu `_` und die MIME-Endung, sonst `.bin`, folgt. */
function sperre(stamm: string, endung: string, mime: string | null): { stamm: string; endung: string; gesperrt: string | null } {
  const voll = stamm + endung;
  const letzte = letzteEndung(voll);
  if (!GESPERRTE_ENDUNGEN.has(letzte)) return { stamm, endung, gesperrt: null };
  const i = voll.lastIndexOf('.');
  return { stamm: `${voll.slice(0, i)}_${voll.slice(i + 1)}`, endung: mimeEndung(mime) || '.bin', gesperrt: letzte };
}

/** „JJJJ-MM-TT hh-mm“ in Ortszeit (9.10). */
function zeitText(d: Date): string {
  const z = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}-${z(d.getMinutes())}`;
}

/** „JJJJMMTT-hhmmss“ in Ortszeit (9.8, `.kaputt`-Datei). */
function stempel(d: Date): string {
  const z = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
}

/**
 * Anhang-Kennung in Zwischennamen (9.12 Regel 10): Regel 1 und 2 (kein Pfadtrenner aus iveo), höchstens 40 Codepunkte;
 * länger → die ersten 31, „-“ und 8 Hex-Zeichen des SHA-256 der Kennung.
 */
export function zwischenKennung(id: string): string {
  const s = id.normalize('NFC').replace(ERSETZEN, '_');
  const z = Array.from(s);
  if (z.length <= 40) return s;
  return `${z.slice(0, 31).join('')}-${createHash('sha256').update(id, 'utf8').digest('hex').slice(0, 8)}`;
}

/** Was `ordnerPfad` bauen soll (9.12: eine Funktion für jeden Namen und Pfad des Ordner-Teils). */
export type PfadArt =
  | { art: 'basis'; showPfad: string }
  | { art: 'seitenOrdner'; basisPfad: string; titel: string }
  /** seitenOrdner null = ohne Pfadbudget (Vorschlag im Panel, 8.6). */
  | { art: 'datei'; seitenOrdner: string | null; label: string; kind: 'file' | 'link'; mime: string | null }
  | { art: 'entfernt'; seitenOrdner: string; datei: string; zusatz: null | { art: 'ersetzt' | 'unvollstaendig'; zeit: Date } }
  | { art: 'zwischen'; seitenOrdner: string; kennung: string; pid: number; endung: 'jm-laden' | 'jm-neu' }
  | { art: 'kaputt'; seitenOrdner: string; zeit: Date };

/** `name` = letzter Teil; `gesperrt` = gesperrte Endung (nur Datei-Anhänge), sonst null. */
export type PfadErgebnis = { ok: true; pfad: string; name: string; gesperrt: string | null } | { ok: false; grund: 'Pfad zu lang' };

const PFAD_ZU_LANG: PfadErgebnis = { ok: false, grund: 'Pfad zu lang' };

/**
 * Die eine Funktion aus 9.12: baut jeden Namen und Pfad des Ordner-Teils nach den Regeln 1–10.
 * - basis: `‹Stamm› – Side Events` neben der Show (9.1).
 * - seitenOrdner: Titel nach 1–8, gekürzt, sodass `‹Ordnerpfad›\entfernt\` plus 60 Einheiten ins Budget passt; bleiben
 *   weniger als 8 Einheiten, „Pfad zu lang“.
 * - datei: Label nach 1–9 (Links: Stamm + `.url`), Stamm so gekürzt, dass die längste Form
 *   `entfernt\‹Stamm› (unvollständig JJJJ-MM-TT hh-mm) (99)‹.Endung›` ins Budget passt (ohne Budget bei seitenOrdner null).
 * - entfernt: `entfernt\‹Stamm›‹Zusatz›‹.Endung›` (9.10); zwischen: `.‹Kennung›.‹pid›.jm-laden|jm-neu` (9.6);
 *   kaputt: `.jm-anhaenge.kaputt-JJJJMMTT-hhmmss.json` (9.8).
 * Jeder Name bleibt samt „ (99)“ bei höchstens 120 Codepunkten und 240 Bytes.
 */
export function ordnerPfad(p: PfadArt): PfadErgebnis {
  switch (p.art) {
    case 'basis': {
      const stamm = kuerze(bereinigeName(basename(p.showPfad).replace(/\.jmshow$/i, ''), 'Side Event'), Infinity,
        NAME_MAX_CP - codepunkte(BASIS_ZUSATZ), NAME_MAX_BYTES - bytes(BASIS_ZUSATZ), 'Side Event');
      const name = `${stamm}${BASIS_ZUSATZ}`;
      return { ok: true, pfad: join(dirname(p.showPfad), name), name, gesperrt: null };
    }
    case 'seitenOrdner': {
      const max = PFAD_BUDGET - ORDNER_RESERVE - (1 + ENTFERNT.length + 1) - (p.basisPfad.length + 1);
      if (max < MIN_STAMM) return PFAD_ZU_LANG;
      const name = kuerze(bereinigeName(p.titel, 'Side Event'), max, NAME_MAX_CP - codepunkte(ZUSATZ_RESERVE),
        NAME_MAX_BYTES - bytes(ZUSATZ_RESERVE), 'Side Event');
      return { ok: true, pfad: join(p.basisPfad, name), name, gesperrt: null };
    }
    case 'datei': {
      const roh = bereinigeName(p.label, 'Anhang');
      const ausLabel = p.kind === 'file' ? endungAusName(roh) : null;
      let teil = p.kind === 'link'
        ? { stamm: roh, endung: '.url', gesperrt: null as string | null }
        : sperre(ausLabel ? roh.slice(0, -ausLabel.length) : roh, ausLabel ?? mimeEndung(p.mime), p.mime);
      const baue = (t: typeof teil): typeof teil | null => {
        const vorEndung = p.seitenOrdner === null ? Infinity
          : PFAD_BUDGET - (p.seitenOrdner.length + 1 + ENTFERNT.length + 1) - LAENGSTER_ZUSATZ.length - ZUSATZ_RESERVE.length;
        const max = vorEndung - t.endung.length;
        if (max < MIN_STAMM) return null;
        const stamm = kuerze(t.stamm, max, NAME_MAX_CP - codepunkte(ZUSATZ_RESERVE + t.endung),
          NAME_MAX_BYTES - bytes(ZUSATZ_RESERVE + t.endung), 'Anhang');
        return { ...t, stamm };
      };
      const gekuerzt = baue(teil);
      if (gekuerzt === null) return PFAD_ZU_LANG;
      teil = gekuerzt;
      if (p.kind === 'file' && teil.endung === '' && teil.gesperrt === null) {
        // Ohne Endung kann erst die Kürzung eine gesperrte letzte Endung freilegen („x.exeeeee“ → „x.exe“).
        const nach = sperre(teil.stamm, '', p.mime);
        if (nach.gesperrt !== null) {
          const neu = baue(nach);
          if (neu === null) return PFAD_ZU_LANG;
          teil = neu;
        }
      }
      const name = `${teil.stamm}${teil.endung}`;
      return { ok: true, pfad: p.seitenOrdner === null ? name : join(p.seitenOrdner, name), name, gesperrt: teil.gesperrt };
    }
    case 'entfernt': {
      const endung = endungAusName(p.datei) ?? '';
      const zusatz = p.zusatz === null ? '' : ` (${p.zusatz.art === 'ersetzt' ? 'ersetzt' : 'unvollständig'} ${zeitText(p.zusatz.zeit)})`;
      const ordner = join(p.seitenOrdner, ENTFERNT);
      const rest = zusatz + ZUSATZ_RESERVE + endung;
      const max = PFAD_BUDGET - (ordner.length + 1) - rest.length;
      if (max < MIN_STAMM) return PFAD_ZU_LANG;
      const stamm = kuerze(endung ? p.datei.slice(0, -endung.length) : p.datei, max, NAME_MAX_CP - codepunkte(rest),
        NAME_MAX_BYTES - bytes(rest), 'Anhang');
      const name = `${stamm}${zusatz}${endung}`;
      return { ok: true, pfad: join(ordner, name), name, gesperrt: null };
    }
    case 'zwischen': {
      const name = `.${zwischenKennung(p.kennung)}.${p.pid}.${p.endung}`;
      const pfad = join(p.seitenOrdner, name);
      return pfad.length > PFAD_BUDGET ? PFAD_ZU_LANG : { ok: true, pfad, name, gesperrt: null };
    }
    case 'kaputt': {
      const name = `.jm-anhaenge.kaputt-${stempel(p.zeit)}.json`;
      const pfad = join(p.seitenOrdner, name);
      return pfad.length > PFAD_BUDGET ? PFAD_ZU_LANG : { ok: true, pfad, name, gesperrt: null };
    }
  }
}

/**
 * Kollision (9.9): Ist `wunsch` in Vergleichsform belegt, kommt „ (2)“, „ (3)“ … vor die Endung. `belegt` enthält
 * Vergleichsformen (fremde Dateien, andere Index-Einträge, Zwischendateien, Index, Sperrdatei, `entfernt`).
 */
export function freierName(wunsch: string, belegt: ReadonlySet<string>): string {
  if (!belegt.has(vergleichsform(wunsch))) return wunsch;
  const endung = endungAusName(wunsch) ?? '';
  const stamm = endung ? wunsch.slice(0, -endung.length) : wunsch;
  for (let n = 2; ; n++) {
    const name = `${stamm} (${n})${endung}`;
    if (!belegt.has(vergleichsform(name))) return name;
  }
}

/** Wächter gegen Pfad-Traversal (9.12 Regel 11): `pfad` liegt im Side-Event-Ordner (nicht der Ordner selbst). */
export function imOrdner(seitenOrdner: string, pfad: string): boolean {
  const r = relative(seitenOrdner, pfad);
  return r !== '' && !r.startsWith('..') && !isAbsolute(r);
}

// ── Links, Panel-Entscheidungen, Fehlertexte (Spec 9.7, 8.6, 9.13) ──

/**
 * Linkprüfer (9.7, auch für das Öffnen im Panel, 8.6): ein String; U+0020 am Anfang und Ende fallen weg; danach kein
 * Zeichen U+0000–U+001F oder U+007F (der WHATWG-Parser entfernte CR, LF und Tab still, gemessen); `new URL` gelingt mit
 * `http:` oder `https:`; `href` höchstens 2048 Zeichen. Ergebnis ist `href`, nie der Rohtext.
 */
export function pruefeLink(roh: unknown): { ok: true; href: string } | { ok: false } {
  if (typeof roh !== 'string') return { ok: false };
  const s = roh.replace(/^ +| +$/g, '');
  if (/[\u0000-\u001f\u007f]/.test(s)) return { ok: false };
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { ok: false };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false };
  return u.href.length <= 2048 ? { ok: true, href: u.href } : { ok: false };
}

/** Inhalt einer `.url`-Datei (9.7, EP11): genau zwei Zeilen mit CRLF, UTF-8 ohne BOM. */
export function urlDateiInhalt(href: string): string {
  return `[InternetShortcut]\r\nURL=${href}\r\n`;
}

const hatAsset = (m: IveoMaterial): boolean => typeof m.asset?.url === 'string' && m.asset.url !== '';

/** Link-Anhang (9.7, wie `iveo-sync.ts:681`): Kind `link` oder ohne Asset mit `external_url`. */
export function istLinkAnhang(m: IveoMaterial): boolean {
  return m.kind === 'link' || (!hatAsset(m) && !!m.external_url);
}

/** Notices beim Öffnen und Speichern im Panel (Spec 11.6: T15, T53, T54; „Kein Link vorhanden.“ wie `iveo-sync.ts:682`). */
export const PANEL_TEXTE = {
  geloescht: 'Anhang wurde in iveo gelöscht.', // T15
  keinLink: 'Kein Link vorhanden.',
  linkUngueltig: 'Link ohne gültige Adresse, nicht geöffnet.', // T53
  ohneDatei: 'Kein Datei-Anhang vorhanden.', // T54
} as const;

/** Megabyte für Gründe und Logzeilen: MiB, höchstens eine Nachkommastelle, ohne Tausenderpunkt („2048“, „2,5“). */
export function megabyte(b: number): string {
  return (b / 1_048_576).toLocaleString('de-DE', { maximumFractionDigits: 1, useGrouping: false });
}

/** Gründe in Zeile und Log (Spec 11.6 T22 (a)–(s); (r) ist die Meldung des Fehlers, (s) = T77 (a)). */
export const ORDNER_GRUENDE = {
  zuGross: (b: number): string => `zu groß (${megabyte(b)} MB, Grenze 2048 MB)`, // (a)
  mehrDaten: (b: number): string => `mehr Daten als angekündigt (${megabyte(b)} MB)`, // (b)
  wenigPlatz: (frei: number): string => `zu wenig Speicherplatz (frei ${megabyte(frei)} MB)`, // (c)
  platzNichtPruefbar: (code: string): string => `Speicherplatz nicht prüfbar (${code})`, // (d)
  leerlauf: 'keine Daten seit 60 s, abgebrochen', // (e)
  unvollstaendig: (x: number, y: number): string => `unvollständig (${x} von ${y} Bytes)`, // (f)
  ohneDatei: 'in iveo ohne Datei', // (g)
  linkUngueltig: 'Link ohne gültige Adresse', // (h)
  ungueltigerAnhang: (feld: string): string => `ungültiger Anhang in iveo (${feld})`, // (i)
  pfadZuLang: 'Pfad zu lang', // (j)
  schreibfehler: (code: string): string => `Schreibfehler (${code})`, // (k)
  entferntKeinOrdner: '„entfernt“ ist kein Ordner', // (l)
  agendaFehlt: 'Agenda in iveo nicht gefunden (404)', // (m)
  dateiFehlt: 'Datei in iveo nicht gefunden (404)', // (n)
  token: 'Token ungültig/abgelaufen oder API-Zugang deaktiviert (401).', // (o)
  server: (status: number): string => `iveo-Server-Fehler (HTTP ${status})`, // (p)
  zeitgrenze: 'iveo antwortet nicht innerhalb von 15 s', // (q)
  adresse: 'Datei-Adresse auf anderem Server ohne https', // (s) = T77 (a)
} as const;

/** Was das Panel mit einem Anhang tut (8.6). Den Wert von `asset.url` gibt der Helfer nie heraus. */
export type PanelSchritt = { art: 'link'; href: string } | { art: 'datei'; vorschlag: string; gesperrt: string | null } | { art: 'fehler'; text: string };

/**
 * Entscheidung beim Öffnen bzw. Speichern im Panel (8.6), in dieser Reihenfolge: gelöscht → T15; Link ohne `external_url`
 * → „Kein Link vorhanden.“, sonst `pruefeLink` (ungültig → T53); Datei ohne Asset → T54; sonst `datei` mit dem Namen, den
 * der Ordner bekäme (9.12 Regeln 1–10, ohne Pfadbudget), und der gesperrten Endung.
 */
export function panelAnhangSchritt(m: IveoMaterial): PanelSchritt {
  if (istGeloescht(m)) return { art: 'fehler', text: PANEL_TEXTE.geloescht };
  if (istLinkAnhang(m)) {
    if (!m.external_url) return { art: 'fehler', text: PANEL_TEXTE.keinLink };
    const l = pruefeLink(m.external_url);
    return l.ok ? { art: 'link', href: l.href } : { art: 'fehler', text: PANEL_TEXTE.linkUngueltig };
  }
  if (!hatAsset(m)) return { art: 'fehler', text: PANEL_TEXTE.ohneDatei };
  const mime = m.asset?.mime_type;
  const r = ordnerPfad({ art: 'datei', seitenOrdner: null, label: m.label, kind: 'file', mime: typeof mime === 'string' ? mime : null });
  return r.ok ? { art: 'datei', vorschlag: r.name, gesperrt: r.gesperrt } : { art: 'fehler', text: ORDNER_GRUENDE.pfadZuLang };
}

/**
 * Darf der Launcher die im Panel gespeicherte Datei öffnen (8.6)? Nur ohne gesperrte Endung aus dem Label und nur, wenn
 * die letzte Endung des im Dialog gewählten Namens nicht auf der Sperrliste steht. Punkte und Leerzeichen am Ende zählen
 * nicht (Windows entfernt sie beim Anlegen, „Bericht.exe.“ wäre sonst „Bericht.exe“).
 */
export function panelDateiOeffnen(gewaehlterName: string, gesperrt: string | null): boolean {
  if (gesperrt !== null) return false;
  const name = (String(gewaehlterName).split(/[\\/]/).pop() ?? '').replace(/[. ]+$/, '');
  return !GESPERRTE_ENDUNGEN.has(letzteEndung(name));
}

/** Abbruchgrund des Laufs (9.6): `leerlauf` ist ein Fehler, `bedienung` (Generationswechsel, 9.4) keiner. */
export type AbbruchGrund = 'leerlauf' | 'bedienung';

/** Jede Adresse ab `http://` oder `https://` bis zum nächsten Leerraum → „‹Adresse›“ (9.13, 12.4 Nr. 41). */
export function ohneAdressen(text: string): string {
  return text.replace(/https?:\/\/\S+/gi, '‹Adresse›');
}

/**
 * Fehlertext des Ordner-Teils (9.13), für Zeile und Log; null = kein Fehler (Grund `bedienung`). `wo` unterscheidet
 * die 404-Texte (bei `datei` gilt der Download-Text). Dateisystemfehler = Fehler mit Node-Code `E…`. Sonst die Meldung des
 * Fehlers: Adressen ersetzt, dann ohne Zeilenumbrüche auf 200 Codepunkte gekürzt (in dieser Reihenfolge, sonst bliebe
 * der Anfang einer gekürzten Adresse stehen).
 */
export function ordnerFehlerText(e: unknown, wo: 'agenda' | 'download' | 'datei', grund?: AbbruchGrund): string | null {
  if (grund === 'bedienung') return null;
  if (grund === 'leerlauf') return ORDNER_GRUENDE.leerlauf;
  if (e instanceof IveoAssetAdresseError) return ORDNER_GRUENDE.adresse;
  if (e instanceof IveoApiError) {
    if (e.status === 404) return wo === 'agenda' ? ORDNER_GRUENDE.agendaFehlt : ORDNER_GRUENDE.dateiFehlt;
    if (e.status === 401) return ORDNER_GRUENDE.token;
    if (e.status >= 500) return ORDNER_GRUENDE.server(e.status);
  }
  const x = e as { name?: unknown; code?: unknown; message?: unknown } | null | undefined;
  if (x?.name === 'TimeoutError' || x?.name === 'AbortError') return ORDNER_GRUENDE.zeitgrenze;
  if (typeof x?.code === 'string' && /^E[A-Z0-9]+$/.test(x.code)) return ORDNER_GRUENDE.schreibfehler(x.code);
  const roh = typeof x?.message === 'string' ? x.message : typeof e === 'string' ? e : '';
  const text = ohneAdressen(roh).replace(/\s*[\r\n]+\s*/g, ' ').trim();
  return text === '' ? 'iveo: unbekannter Fehler.' : Array.from(text).slice(0, 200).join('');
}

// ── Ende des Moduls ──

// Zoom-Statustexte: EINE Quelle für Tray, Kopfzeile, Zoom-Karte und STATE (Spec 7).
// Grundsatz „Eine dauerhafte Statuszeile lügt leichter“: jeder Text muss in JEDEM Zustand wahr
// sein, in dem er steht. Darum feste Zeilen je Zustand (Z0–Z13, Spec 7.1) und eine einzige
// Zuordnung zoomZ(), aus der alle Funktionen hier lesen.
//
// Rein: keine Laufzeit-Importe, keine node:-Module. Der Renderer-tsconfig prüft diese Datei mit,
// und die Karte (ZoomCard.tsx) nutzt sie direkt.
import type { AudioReason, VideoReason } from '@jm/zoom-bridge/protocol';
import type {
  AppStatus, ProxyKeySource, ZoomAbbild, ZoomBefehlKennung, ZoomErgebnis, ZoomErlaubnis, ZoomKurz, ZoomMangel, ZoomQuelle, ZoomSollEintrag,
} from './types';

/** Die Zeilen der Zustandstabelle Spec 7.1. */
export type ZoomZ =
  | 'Z0' | 'Z1a' | 'Z1b' | 'Z2' | 'Z3' | 'Z4' | 'Z5a' | 'Z5b' | 'Z6'
  | 'Z7' | 'Z7b' | 'Z8' | 'Z9' | 'Z9b' | 'Z10' | 'Z11' | 'Z12' | 'Z13';

/** Wie A4, aber ehrlich, wenn der Schlüsselbund da war und nur die Einstellungsdatei nicht schreibbar ist. */
export const TEXT_A4_SCHREIBFEHLER = 'Nur für diese Sitzung gemerkt — die Einstellungsdatei ließ sich nicht schreiben.';
/**
 * Kein Spec-Text (Gesamtprüfung 2026-10-06, Muster TEXT_A4_SCHREIBFEHLER): „Entfernen“, wenn die Einstellungsdatei
 * nicht schreibbar ist. Für diese Sitzung ist der Wert weg, nach einem Neustart gilt er wieder.
 */
export const TEXT_ZUGANG_NUR_SITZUNG_ENTFERNT =
  'Die Zugangsdaten sind nur für diese Sitzung entfernt — die Einstellungsdatei ließ sich nicht schreiben. Nach einem Neustart gelten sie wieder.';
export const TEXT_SDK_SCHLUESSEL_NUR_SITZUNG_ENTFERNT =
  'Der SDK-Schlüssel ist nur für diese Sitzung entfernt — die Einstellungsdatei ließ sich nicht schreiben. Nach einem Neustart gilt er wieder.';

/** Text A4 (Spec 8.1). Steht hier, weil Karte und Kern ihn beide brauchen; klartext.ts übernimmt ihn. */
export const TEXT_A4 = 'Nur für diese Sitzung gemerkt — auf diesem Rechner gibt es keinen Schlüsselbund.';
/** Text A6 (Spec 8.1). */
export const TEXT_A6 = 'Kommt aus Umgebungsvariablen (ZOOM_SDK_…) und hat Vorrang.';

/** Text S11 (Spec SDK nachladen, Abschnitt 5): Tooltip des gesperrten Knopfs „Zoom-SDK laden“; klartext.ts übernimmt ihn. */
export const TEXT_S11 = 'Für „Zoom-SDK laden“ fehlt der SDK-Schlüssel. Bitte unter „SDK-Schlüssel“ eintragen.';
/** Text S17: Ergebnis eines Abbruchs. Die Karte zeigt ihn als Hinweis, nicht rot (Spec SDK nachladen 4.3). */
export const TEXT_S17 = 'Laden abgebrochen. Die bisherige Einrichtung bleibt unverändert.';

/** Betriebsgröße (Owner-Entscheidung, Spec 5.2): mehr Zoom-Quellen gleichzeitig sind nicht gemessen. Main und Karte teilen sie (L16). */
export const BETRIEBSGROESSE = 5;
/** Höchstens so viele Wiederbeitritts-Versuche nach einem Abriss (Spec 6.4); die Wartezeiten stehen in main/zoom/fristen.ts. */
export const WIEDERBEITRITT_VERSUCHE = 5;

/** Anfang von Q9: Main (klartext.ts) und Karte teilen ihn; die Karte macht daraus den zweiten Klick „trotzdem laden“. */
export const Q9_ANFANG = `Mehr als ${BETRIEBSGROESSE} Zoom-Quellen sind nicht gemessen.`;

/** Gründe im Kartentext Z1a (Spec 7.2), je Mangel einer. */
export const MANGEL_GRUND: Record<ZoomMangel, string> = {
  sdk_fehlt: 'SDK-Ordner fehlt',
  sdk_defekt: 'Zoom-Laufzeit unvollständig, bitte den SDK-Ordner erneut wählen',
  bridge_fehlt: 'Zoom-Bridge fehlt in dieser Installation, bitte JM Connect neu installieren',
  zugang_fehlt: 'Zugangsdaten fehlen',
  zugang_unlesbar: 'Zugangsdaten lassen sich nicht entschlüsseln, bitte erneut eintragen oder die Datei erneut wählen',
};

/** Spec 7.1: Zustand + Erlaubnis + n + k → Zeile der Tabelle. */
export function zoomZ(k: ZoomKurz): ZoomZ {
  switch (k.zustand) {
    case 'nicht_verfuegbar':
      return 'Z0';
    case 'einrichtung':
      return k.kopieLaeuft ? 'Z1b' : 'Z1a';
    case 'bereit':
      return 'Z2';
    case 'startet':
      return 'Z3';
    case 'tritt_bei':
      return 'Z4';
    case 'warteraum':
      return k.warten === 'host' ? 'Z5b' : 'Z5a';
    case 'im_meeting': {
      // erlaubnis ist in im_meeting immer gesetzt (Spec 5.4); null zählt wie „ausstehend“.
      const e = k.erlaubnis ?? 'offen';
      if (e === 'ja') return k.quellen === 0 ? 'Z8' : k.ohneBild === 0 ? 'Z9' : 'Z9b';
      if (k.quellen > 0) return 'Z7b';
      return e === 'offen' ? 'Z6' : 'Z7';
    }
    case 'abriss':
      return k.versuch === null ? 'Z10' : 'Z11';
    case 'verlaesst':
      return 'Z12';
    case 'fehler':
      return 'Z13';
  }
}

/** „1 Quelle“ / „2 Quellen“ (Spec 7.2: Singular bei 1). */
function quellenText(n: number): string {
  return n === 1 ? '1 Quelle' : `${n} Quellen`;
}

/**
 * Zoom-Zeile für Tray-Menü UND Kopfzeile (Spec 7.2, linke Spalte). null = keine Zeile
 * (kein Zoom auf dieser Plattform).
 */
export function zoomZeile(k: ZoomKurz | null): string | null {
  if (k === null) return null;
  switch (zoomZ(k)) {
    case 'Z0':
      return null;
    case 'Z1a':
      return '△ Zoom: Einrichtung unvollständig';
    case 'Z1b':
      return '◌ Zoom: Einrichtung läuft';
    case 'Z2':
      return '○ Zoom: kein Meeting';
    case 'Z3':
      return '◌ Zoom: meldet sich an …';
    case 'Z4':
      return '◌ Zoom: tritt dem Meeting bei …';
    case 'Z5a':
      return '◌ Zoom: im Warteraum';
    case 'Z5b':
      return '◌ Zoom: wartet auf den Host';
    case 'Z6':
      return '◌ Zoom: im Meeting, Aufnahme-Erlaubnis ausstehend';
    case 'Z7':
      // N4b.1: Beim Entzug baut die Bridge alle Abos ab; nach der Wiedererteilung lädt Connect die gemerkten Quellen selbst
      // neu. Ohne gemerkte Quelle (nichts lief, alles vergessen) stimmt „Quellen gestoppt“ nicht: dann der bisherige Text.
      return k.erlaubnis === 'entzogen' && k.sollOffen > 0
        ? '△ Zoom: Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt'
        : '△ Zoom: im Meeting ohne Aufnahme-Erlaubnis';
    case 'Z7b':
      return `△ Zoom: ${quellenText(k.quellen)}, Aufnahme-Erlaubnis fehlt`;
    case 'Z8':
      return '○ Zoom: im Meeting, keine Quelle geladen';
    case 'Z9':
      return `● Zoom: ${quellenText(k.quellen)} geladen`;
    case 'Z9b':
      return `● Zoom: ${quellenText(k.quellen)} geladen, ${k.ohneBild} ohne Bild`;
    case 'Z10':
      return '△ Zoom: Verbindung unterbrochen, Zoom verbindet neu';
    case 'Z11':
      return `△ Zoom: Verbindung verloren, Wiederbeitritt ${k.versuch} von ${WIEDERBEITRITT_VERSUCHE}`;
    case 'Z12':
      return '◌ Zoom: verlässt das Meeting …';
    case 'Z13':
      return '✕ Zoom: Fehler, siehe Connect-Fenster';
  }
}

/**
 * Z7 (n = 0): der ganze Satz zum Grund. 'offen' ist dort Z6, 'ja' ist Z8. 'entzogen' mit gemerkten Quellen hat einen
 * eigenen Text (Z7_ENTZOGEN); ohne gemerkte Quelle gilt der Satz hier.
 */
const Z7_GRUND: Record<'abgelehnt' | 'abgelaufen' | 'entzogen', string> = {
  abgelehnt: 'Der Host hat abgelehnt.',
  abgelaufen: 'Zoom hat keine Antwort bekommen.',
  entzogen: 'Der Host hat sie entzogen.',
};

/** Z7b (n > 0): der Grund in Klammern. 'ja' ist dort Z9/Z9b, 'entzogen' hat einen eigenen Text (kartenZeile). */
const Z7B_GRUND: Record<Exclude<ZoomErlaubnis, 'ja' | 'entzogen'>, string> = {
  offen: 'angefragt, noch keine Antwort',
  abgelehnt: 'vom Host abgelehnt',
  abgelaufen: 'keine Antwort bekommen',
};

/**
 * Entzug (N4b.1, Texttabelle 4b): Die Bridge baut alle Abos ab, Connect behält die Soll-Liste und lädt nach
 * der Wiedererteilung selbst neu. n > 0 gibt es dabei nur, solange die Bridge noch abbaut (Z7b); danach steht Z7,
 * und zwar mit diesem Text nur, solange es gemerkte Quellen gibt (sollOffen > 0).
 */
const Z7_ENTZOGEN =
  'Aufnahme-Erlaubnis vom Host entzogen, Quellen gestoppt. Erteilt der Host sie im Zoom-Client wieder, lädt Connect die gemerkten Quellen von selbst.';

/** Bytes → MB für Z1b, gerundet (MiB, wie Windows rechnet). */
function mb(bytes: number): number {
  return Math.round(bytes / 1024 / 1024);
}

/**
 * Statuszeile der Zoom-Karte (Spec 7.2, rechte Spalte). `jetztMs` nur für den Countdown in Z11.
 * null = keine Karte (Z0).
 */
export function kartenZeile(a: ZoomAbbild, jetztMs: number): string | null {
  const k = a.kurz;
  const e = k.erlaubnis ?? 'offen';
  switch (zoomZ(k)) {
    case 'Z0':
      return null;
    case 'Z1a':
      return `Zoom ist nicht vollständig eingerichtet: ${k.maengel.map((m) => MANGEL_GRUND[m]).join(' · ')}.`;
    case 'Z1b': {
      // Spec SDK nachladen 4.4: Tray und Kopfzeile bleiben bei „Einrichtung läuft“, nur die Karte zeigt die Phase.
      const l = a.einrichtung.sdk.laden;
      if (l) return sdkLadenZeile(l);
      const c = a.einrichtung.sdk.kopie ?? { dateien: 0, dateienGesamt: 0, bytes: 0, bytesGesamt: 0 };
      return `Zoom-SDK wird kopiert: ${c.dateien} von ${c.dateienGesamt} Dateien (${mb(c.bytes)} von ${mb(c.bytesGesamt)} MB).`;
    }
    case 'Z2':
      return a.pruefungLaeuft
        ? 'Prüfe die Einrichtung (Anmeldung bei Zoom, ohne Meeting) …'
        : 'Bereit. Meeting-Nummer und Kenncode eingeben.';
    case 'Z3':
      return 'Melde mich bei Zoom an …';
    case 'Z4':
      return 'Trete dem Meeting bei …';
    case 'Z5a':
      return `Im Warteraum. Der Host muss „${a.anzeigename}“ zulassen.`;
    case 'Z5b':
      return 'Das Meeting hat noch nicht begonnen. Warte auf den Host.';
    case 'Z6':
      return `Im Meeting. Warte auf die Aufnahme-Erlaubnis: Der Host muss sie im Zoom-Client für „${a.anzeigename}“ erteilen.`;
    case 'Z7':
      // zoomZ liefert Z7 nur für abgelehnt/abgelaufen/entzogen. „Quellen gestoppt“ nur, wenn es gemerkte Quellen gibt.
      if (e === 'entzogen' && k.sollOffen > 0) return Z7_ENTZOGEN;
      return `Im Meeting ohne Aufnahme-Erlaubnis. ${Z7_GRUND[e as keyof typeof Z7_GRUND]} Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.`;
    case 'Z7b':
      if (e === 'entzogen') return `Aufnahme-Erlaubnis vom Host entzogen. Connect stoppt ${quellenText(k.quellen)} …`;
      return `Die Aufnahme-Erlaubnis fehlt (${Z7B_GRUND[e as keyof typeof Z7B_GRUND]}). ${quellenText(k.quellen)} ${k.quellen === 1 ? 'besteht' : 'bestehen'} noch. Der Host kann sie im Zoom-Client erteilen.`;
    case 'Z8':
      return 'Im Meeting. Personen unten als Quelle laden.';
    case 'Z9':
      return `Im Meeting. ${quellenText(k.quellen)} geladen.`;
    case 'Z9b':
      return `Im Meeting. ${quellenText(k.quellen)} geladen, ${k.ohneBild} davon ohne Bild (Kamera aus, Person weg oder erstes Bild steht noch aus).`;
    case 'Z10':
      return 'Verbindung unterbrochen. Zoom versucht selbst, neu zu verbinden …';
    case 'Z11': {
      const naechsterUm = a.abriss?.naechsterUm ?? null;
      if (naechsterUm === null) return `Verbindung zum Meeting verloren. Wiederbeitritt ${k.versuch} von ${WIEDERBEITRITT_VERSUCHE} läuft …`;
      const s = Math.max(0, Math.ceil((naechsterUm - jetztMs) / 1000));
      return `Verbindung zum Meeting verloren. Wiederbeitritt ${k.versuch} von ${WIEDERBEITRITT_VERSUCHE} in ${s} s.`;
    }
    case 'Z12':
      return 'Verlasse das Meeting …';
    case 'Z13':
      return a.meldung?.text ?? '';
  }
}

/** Gäste-Zeile im Tray (Spec 7.3, berichtigt): g = NDI-Sender der Gäste inklusive Bildschirm. */
export function gaesteZeile(s: AppStatus): string {
  const g = s.ndiSenders;
  if (g > 0) return `● Gäste: ${g} ${g === 1 ? 'NDI-Quelle' : 'NDI-Quellen'}`;
  if (s.configured) return '○ Gäste: keine NDI-Quelle';
  return '△ Gäste: Cloud nicht eingerichtet';
}

/** Tooltip des Tray-Symbols, das einzige kombinierte Feld (Spec 7.4, Code wörtlich). */
export function trayTooltip(s: AppStatus): string {
  const teile: string[] = [];
  if (s.ndiSenders > 0 || (s.zoom?.quellen ?? 0) > 0) teile.push('Zuschaltungen aktiv');
  if (s.zoom?.zustand === 'abriss') teile.push('Zoom-Verbindung unterbrochen');
  if (s.zoom?.zustand === 'fehler') teile.push('Zoom-Fehler');
  return teile.length ? `JM Connect — ${teile.join(' · ')}` : 'JM Connect';
}

/** Tray „Zoom-Meeting verlassen“ ist aktiv in Z3–Z11 (Spec 7.3). */
export function trayVerlassenAktiv(k: ZoomKurz | null): boolean {
  if (k === null) return false;
  return (
    k.zustand === 'startet' ||
    k.zustand === 'tritt_bei' ||
    k.zustand === 'warteraum' ||
    k.zustand === 'im_meeting' ||
    k.zustand === 'abriss'
  );
}

/** Werte von `zoom_status` (Spec 7.5). Z3 meldet bewusst `tritt_bei`. */
export type ZoomStatusWert = 'einrichtung' | 'bereit' | 'tritt_bei' | 'warteraum' | 'im_meeting' | 'abriss' | 'verlaesst' | 'fehler';

/** Die sieben Zoom-Schlüssel im STATE (Spec 7.5, 11.1). Keiner führt einen Namen (G5). */
export interface ZoomStateKv {
  zoom_status: ZoomStatusWert;
  zoom_sources: number;
  zoom_live: 0 | 1;
  zoom_privilege: 0 | 1;
  zoom_alarm: 0 | 1;
  /** Ergebnis des letzten zoom_*-Befehls (8.6, 11.2): leer vor dem ersten, sonst 'ok' oder 'f1' … 'f8'. */
  zoom_cmd: '' | ZoomBefehlKennung;
  /** 1 bei F1–F7, sonst 0 (F8 ist eine Warnung, der Befehl wurde ausgeführt). */
  zoom_cmd_rejected: 0 | 1;
}

/**
 * Tabelle 7.5 wörtlich: `alarm[0]` gilt bei o = 0, `alarm[1]` bei o > 0 (o = offene Soll-Einträge).
 * In Z1a, Z1b und Z2 ist o immer 0 (ein Mangel bzw. jeder Weg nach Z2 leert die Soll-Liste).
 */
const STATE_JE_Z: Record<Exclude<ZoomZ, 'Z0'>, { status: ZoomStatusWert; privilege: 0 | 1; alarm: readonly [0 | 1, 0 | 1] }> = {
  Z1a: { status: 'einrichtung', privilege: 0, alarm: [0, 0] },
  Z1b: { status: 'einrichtung', privilege: 0, alarm: [0, 0] },
  Z2: { status: 'bereit', privilege: 0, alarm: [0, 0] },
  Z3: { status: 'tritt_bei', privilege: 0, alarm: [0, 1] },
  Z4: { status: 'tritt_bei', privilege: 0, alarm: [0, 1] },
  Z5a: { status: 'warteraum', privilege: 0, alarm: [0, 1] },
  Z5b: { status: 'warteraum', privilege: 0, alarm: [0, 1] },
  Z6: { status: 'im_meeting', privilege: 0, alarm: [0, 1] },
  Z7: { status: 'im_meeting', privilege: 0, alarm: [1, 1] },
  Z7b: { status: 'im_meeting', privilege: 0, alarm: [1, 1] },
  Z8: { status: 'im_meeting', privilege: 1, alarm: [0, 1] },
  Z9: { status: 'im_meeting', privilege: 1, alarm: [0, 1] },
  Z9b: { status: 'im_meeting', privilege: 1, alarm: [0, 1] },
  Z10: { status: 'abriss', privilege: 0, alarm: [1, 1] },
  Z11: { status: 'abriss', privilege: 0, alarm: [1, 1] },
  Z12: { status: 'verlaesst', privilege: 0, alarm: [0, 0] },
  Z13: { status: 'fehler', privilege: 0, alarm: [1, 1] },
};

/** STATE-Werte aus der Kurzform (Spec 7.5). null unter macOS: dort fehlen die zoom_*-Schlüssel ganz. */
export function stateKvAus(k: ZoomKurz): ZoomStateKv | null {
  const z = zoomZ(k);
  if (z === 'Z0') return null;
  const s = STATE_JE_Z[z];
  return {
    zoom_status: s.status,
    zoom_sources: k.quellen,
    zoom_live: k.quellen > 0 ? 1 : 0,
    zoom_privilege: s.privilege,
    zoom_alarm: s.alarm[k.sollOffen > 0 ? 1 : 0],
    // Hängen nicht am Zustand (7.5): der letzte Befehl bleibt stehen, bis der nächste kommt.
    zoom_cmd: k.befehl?.kennung ?? '',
    zoom_cmd_rejected: k.befehl?.abgelehnt ? 1 : 0,
  };
}

/**
 * SDK-Zeile im Einrichtungsbereich der Karte (Spec 9 Punkt 3). Die Fassung kommt aus dem Abbild: Der Kern setzt sie
 * aus SDK_FASSUNG (N4b.3 Nr. 8, kein Literal; `shared/*` lädt `@jm/zoom-bridge/sdk` nicht, G8).
 */
export function sdkZeile(a: ZoomAbbild): string {
  if (a.kurz.maengel.includes('sdk_fehlt')) return 'Zoom-SDK: nicht eingerichtet';
  if (a.kurz.maengel.includes('sdk_defekt')) return 'Zoom-SDK: Laufzeit unvollständig';
  const f = a.einrichtung.sdk.fassung;
  return f ? `Zoom-SDK ${f} eingerichtet` : 'Zoom-SDK eingerichtet';
}

/** Fortschritt von „Zoom-SDK laden“ in der Zeile „Zoom-SDK“ und in der Statuszeile der Karte (Spec SDK nachladen 4.5). */
export function sdkLadenZeile(l: NonNullable<ZoomAbbild['einrichtung']['sdk']['laden']>): string {
  switch (l.phase) {
    case 'link':
      return 'Zoom-SDK wird geladen …';
    case 'download':
      return `Zoom-SDK wird geladen … ${mb(l.bytes)} von ${mb(l.bytesGesamt)} MB`;
    case 'pruefen':
      return 'Zoom-SDK wird geprüft …';
    case 'entpacken':
      return 'Zoom-SDK wird entpackt …';
  }
}

/** Zeile „SDK-Schlüssel“ im Einrichtungsbereich (Spec SDK nachladen 4.5): nur die Herkunft, nie ein Wert. */
export function sdkSchluesselZeile(a: ZoomAbbild): string {
  const je: Record<ProxyKeySource, string> = {
    stored: 'SDK-Schlüssel: hinterlegt',
    session: 'SDK-Schlüssel: hinterlegt (nur für diese Sitzung)',
    env: 'SDK-Schlüssel: aus der Umgebung',
    none: 'SDK-Schlüssel: fehlt',
  };
  return je[a.einrichtung.sdkSchluessel.herkunft];
}

/** Ein Balken für Download und Kopie (Spec SDK nachladen 4.5): Prozent 0–100, `null` = kein Balken. */
export function sdkBalken(sdk: ZoomAbbild['einrichtung']['sdk']): number | null {
  const anteil = (teil: number, ganz: number): number => (ganz > 0 ? Math.min(100, Math.round((teil / ganz) * 100)) : 0);
  if (sdk.kopie) return anteil(sdk.kopie.bytes, sdk.kopie.bytesGesamt);
  if (sdk.laden?.phase === 'download') return anteil(sdk.laden.bytes, sdk.laden.bytesGesamt);
  return null;
}

/** S17 (Laden abgebrochen) ist ein Hinweis und steht grau, jeder andere Einrichtungstext ist ein Fehler (rot). */
export function einrichtungsTextArt(text: string): 'hinweis' | 'fehler' {
  return text === TEXT_S17 ? 'hinweis' : 'fehler';
}

/** Beschriftung des SDK-Knopfs (Spec 9 Punkt 3). */
export function sdkKnopf(a: ZoomAbbild): 'SDK-Ordner wählen …' | 'Neu wählen …' {
  return a.kurz.maengel.includes('sdk_fehlt') ? 'SDK-Ordner wählen …' : 'Neu wählen …';
}

/** Zugangsdaten-Zeile je Herkunft (Spec 9 Punkt 3); `unlesbar` geht vor. */
export function zugangZeile(a: ZoomAbbild): string {
  if (a.kurz.maengel.includes('zugang_unlesbar')) return 'Zugangsdaten: lassen sich nicht entschlüsseln';
  const z = a.einrichtung.zugang;
  const je: Record<ProxyKeySource, string> = {
    stored: `Zugangsdaten: hinterlegt (Client-ID endet auf ${z.clientIdEnde ?? ''})`,
    session: z.grund === 'schreibfehler' ? TEXT_A4_SCHREIBFEHLER : TEXT_A4,
    env: TEXT_A6,
    none: 'Zugangsdaten: fehlen',
  };
  return je[z.herkunft];
}

/** Welche Knöpfe die Karte zeigt bzw. freigibt (Spec 9 Punkte 2–6, Sperre 6.1). */
export interface ZoomKnoepfe {
  /** Knöpfe im Meldungsbereich; null ohne Meldung. */
  meldung: { erneut: boolean; schliessen: boolean; ok: boolean; logordner: boolean } | null;
  /** SDK-Ordner/Zugangsdaten wählen oder entfernen: nur Z1a, Z2 ohne Prüfung, Z13 und nie während eines Abbaus (sonst Tooltip S10). */
  einrichtungAenderbar: boolean;
  /** „Zoom-SDK laden“ (Spec SDK nachladen 4.5): frei, gesperrt wie die Ordnerwahl (Tooltip S10) oder ohne Schlüssel (Tooltip S11). */
  sdkLaden: 'frei' | 'gesperrt' | 'ohneSchluessel';
  /** „Abbrechen“ neben dem Ladefortschritt: solange `einrichtung.sdk.laden` steht, nicht während der Kopie. */
  sdkLadenAbbrechen: boolean;
  /** „Entfernen“ beim SDK-Schlüssel: bei hinterlegt oder Sitzung; nicht aus der Umgebung, nicht ohne Schlüssel. */
  sdkSchluesselEntfernbar: boolean;
  /** „Einrichtung prüfen“: nur in `bereit`; während der Prüfung „Prüfe …“. */
  pruefen: 'aus' | 'bereit' | 'laeuft';
  /** Beitrittsfelder in `bereit` und `fehler`. */
  beitrittSichtbar: boolean;
  /** „Beitreten“ gesperrt, solange „Einrichtung prüfen“ läuft. */
  beitretenGesperrt: boolean;
  /** „Meeting verlassen“ in Z3–Z11. */
  verlassen: boolean;
  /** „Abbrechen“ nur in Z11 (der Knopf selbst kommt mit Plan 4b). */
  abbrechen: boolean;
  /** Einrichtung aufgeklappt, solange Mängel bestehen. */
  einrichtungOffen: boolean;
  /** „Zoom ist gesperrt, bis …“ solange Mängel bestehen. */
  sperrHinweis: boolean;
}

export function zoomKnoepfe(a: ZoomAbbild): ZoomKnoepfe {
  const k = a.kurz;
  const z = zoomZ(k);
  let meldung: ZoomKnoepfe['meldung'] = null;
  if (a.meldung) {
    const logordner = a.meldung.text.includes('Details im Log');
    if (z === 'Z13') meldung = { erneut: a.erneutMoeglich, schliessen: true, ok: false, logordner };
    // Spec 9 Punkt 2: in Z2 nur zur Meldung des Meeting-Endes (R6/C61, 6.5) — sie ist in Z2 die einzige
    // Warnung. Das Ergebnis von „Einrichtung prüfen“ (info/fehler) bekommt „OK“, auch wenn danach
    // Nummer und Kenncode noch im Speicher stehen (erneutMoeglich).
    else if (z === 'Z2' && a.erneutMoeglich && a.meldung.art === 'warnung') meldung = { erneut: true, schliessen: true, ok: false, logordner };
    else meldung = { erneut: false, schliessen: false, ok: true, logordner };
  }
  const mangel = k.maengel.length > 0;
  // L13: S10 gilt auch, solange eine gestoppte Bridge noch abbaut.
  const einrichtungAenderbar = (z === 'Z1a' || (z === 'Z2' && !a.pruefungLaeuft) || z === 'Z13') && !a.abbauLaeuft;
  const schluessel = a.einrichtung.sdkSchluessel.herkunft;
  return {
    meldung,
    einrichtungAenderbar,
    sdkLaden: !einrichtungAenderbar ? 'gesperrt' : schluessel === 'none' ? 'ohneSchluessel' : 'frei',
    sdkLadenAbbrechen: a.einrichtung.sdk.laden !== null,
    sdkSchluesselEntfernbar: schluessel === 'stored' || schluessel === 'session',
    pruefen: k.zustand === 'bereit' ? (a.pruefungLaeuft ? 'laeuft' : 'bereit') : 'aus',
    beitrittSichtbar: k.zustand === 'bereit' || k.zustand === 'fehler',
    beitretenGesperrt: a.pruefungLaeuft,
    verlassen: trayVerlassenAktiv(k),
    abbrechen: z === 'Z11',
    einrichtungOffen: mangel,
    sperrHinweis: mangel,
  };
}

/** Gemerkte Quellen (Spec 9 Punkt 9, Texttabelle 4b): Text je Stand eines offenen Soll-Eintrags. */
const SOLL_STAND: Record<ZoomSollEintrag['stand'], string> = {
  wartet: 'wartet auf die Person',
  // Gesamtprüfung 4b („Statuszeile lügt“): Die Person ist da. Texte vom Owner freigegeben 08.10.2026.
  erlaubnis: 'wartet auf die Aufnahme-Erlaubnis',
  laedt: 'wird geladen …',
  // Connect selbst ist nicht im Meeting (jeder Zustand außer im_meeting, etwa Z10, Z11, fehler, „Erneut beitreten“);
  // Vorrang vor allen Ständen außer verwaist.
  wiederbeitritt: 'wartet auf den Wiederbeitritt',
  // Owner 08.10.2026 (freigegeben): Die Person ist eindeutig da, an ihrer Zeile steht Q8 bzw. ein Ladefehler der Bridge
  // (nicht Q1, das wartet auf die Aufnahme-Erlaubnis, und nicht Q2, das wartet auf die Person; Ruling 08.10.2026).
  // Kein automatischer neuer Versuch; ein geplanter Abgleich („wird geladen …“) und alle übrigen Stände haben Vorrang.
  keineAntwort: 'keine Antwort der Zoom-Bridge, bitte von Hand laden',
  gescheitert: 'Laden gescheitert, bitte von Hand laden',
  doppelname: 'Name doppelt, bitte von Hand laden',
  verwaist: 'Person weg, Quelle schwarz',
  grenze: `nicht automatisch geladen (mehr als ${BETRIEBSGROESSE} Zoom-Quellen), bitte von Hand laden`,
};

/** Eine Zeile unter „Gemerkte Quellen“: „{Name} — {Stand}“. */
export function sollZeile(e: ZoomSollEintrag): string {
  return `${e.name} — ${SOLL_STAND[e.stand]}`;
}

/**
 * Farbe einer Zeile unter „Gemerkte Quellen“ (die Karte setzt sie in Klassen um). Rot: Name doppelt, auch „Person weg, Quelle
 * schwarz“ bei Doppelname (Q11). Gelb: die übrigen Stände mit „…, bitte von Hand laden“, also 'grenze' (L7) und, Ruling
 * 08.10.2026 (R3), 'keineAntwort' und 'gescheitert'. Sonst grau.
 */
export function sollFarbe(e: ZoomSollEintrag): 'rot' | 'gelb' | 'grau' {
  if (e.stand === 'doppelname' || (e.stand === 'verwaist' && e.doppelname)) return 'rot';
  return e.stand === 'grenze' || e.stand === 'keineAntwort' || e.stand === 'gescheitert' ? 'gelb' : 'grau';
}

/** Bild `black` je Grund (Texttabelle 4b). Record über alle Gründe: ein neuer Grund scheitert im Typcheck. */
const BILD_SCHWARZ: Record<VideoReason, string> = {
  command: 'kein Bild von Zoom',
  frames: 'kein Bild von Zoom',
  cameraOff: 'Kamera aus',
  participantLeft: 'Person weg',
  rebound: 'kein Bild von Zoom',
  bufferMismatch: 'fehlerhafte Bilder',
  meetingEnded: 'kein Bild von Zoom',
  reboundByName: 'kein Bild von Zoom',
  privilegeRevoked: 'kein Bild von Zoom',
};

/** Bild-Zustand einer Quelle im Klartext statt Rohwert (N4b.3 Nr. 8). */
export function bildText(bild: ZoomQuelle['bild'], grund: VideoReason): string {
  if (bild === 'subscribed') return 'Bild: erstes Bild steht aus';
  if (bild === 'live') return 'Bild läuft';
  return `Bild schwarz: ${BILD_SCHWARZ[grund]}`;
}

/** Ton `off` je Grund (Texttabelle 4b); nur zwei Gründe haben einen eigenen Text. */
const TON_AUS: Record<AudioReason, string> = {
  command: 'Ton aus',
  audioUnavailable: 'Ton nicht verfügbar',
  packets: 'Ton aus',
  gap: 'Ton aus',
  participantLeft: 'Ton aus: Person weg',
  meetingEnded: 'Ton aus',
  rebound: 'Ton aus',
  reboundByName: 'Ton aus',
  privilegeRevoked: 'Ton aus',
};

/** Ton-Zustand einer Quelle im Klartext; 'aus' = ohne Ton geladen (kein Fehler). */
export function tonText(ton: ZoomQuelle['ton'], grund: AudioReason | null): string {
  switch (ton) {
    case 'aus':
      return 'ohne Ton';
    case 'waiting':
      return 'Ton: wartet auf das erste Paket';
    case 'live':
      return 'Ton läuft';
    case 'silent':
      return 'Ton: Stille';
    case 'off':
      return grund === null ? 'Ton aus' : TON_AUS[grund];
  }
}

/** Bild und Ton einer Quelle in einer Zeile der Teilnehmerliste (Spec 9 Punkt 8). */
export function quellenZustandText(q: ZoomQuelle): string {
  return `${bildText(q.bild, q.bildGrund)} · ${tonText(q.ton, q.tonGrund)}`;
}

/** Zeilen unter dem Feld „Bild-Versatz (ms)“ (Spec 9 Punkt 7); bei `nurSitzung` zusätzlich TEXT_A4_SCHREIBFEHLER (L14). */
export function versatzZeile(a: ZoomAbbild): string[] {
  const zeilen = [a.versatz.bestaetigtMs !== null ? `bestätigt: ${a.versatz.bestaetigtMs} ms` : 'gilt ab dem nächsten Beitritt'];
  if (a.versatz.nurSitzung) zeilen.push(TEXT_A4_SCHREIBFEHLER);
  return zeilen;
}

/**
 * Antwort auf „Bild-Versatz“: Übernimmt die Karte den Wert? Ja bei ok und bei „nur für diese Sitzung gemerkt“ (L14:
 * der Wert gilt, versatzZeile zeigt den Hinweis dauerhaft). Jede andere Antwort ist ein Fehler am Feld.
 */
export function versatzUebernommen(r: ZoomErgebnis): boolean {
  return r.ok || r.text === TEXT_A4_SCHREIBFEHLER;
}

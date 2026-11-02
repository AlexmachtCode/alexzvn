// Zoom-Statustexte: EINE Quelle für Tray, Kopfzeile, Zoom-Karte und STATE (Spec 7).
// Grundsatz „Eine dauerhafte Statuszeile lügt leichter“: jeder Text muss in JEDEM Zustand wahr
// sein, in dem er steht. Darum feste Zeilen je Zustand (Z0–Z13, Spec 7.1) und eine einzige
// Zuordnung zoomZ(), aus der alle Funktionen hier lesen.
//
// Rein: keine node:-Module; zur Laufzeit lädt sie nur `@jm/zoom-bridge/protocol` (importfrei; SLOT_NR_MAX, Plan B Task B8).
// Der Renderer-tsconfig prüft diese Datei mit, und die Karte (ZoomCard.tsx) nutzt sie direkt.
import type {
  AppStatus, ProxyKeySource, ZoomAbbild, ZoomBefehlKennung, ZoomErgebnis, ZoomErlaubnis, ZoomKurz, ZoomMangel,
} from './types';

// Zoom-Slots (Plan B, Block b2): eigene Importzeilen; die Typen der alten Quellen fallen mit dem Kern-Umstieg (Task B12) weg.
import { SLOT_NR_MAX } from '@jm/zoom-bridge/protocol';
import type { AudioState, SlotAudioReason, SlotReason, SlotSent } from '@jm/zoom-bridge/protocol';
import type {
  TonQuelle, ZoomBefehlErgebnis, ZoomSlotAufloesung, ZoomSlotErsatzbild, ZoomSlotModus, ZoomSlotTonArt, ZoomSlotZustand, ZoomSprecherSignal,
  ZoomZustand,
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

/** Höchstlänge eines NDI-Namens in Code-Punkten (Spec E26, 0.22); T43 und die Prüfregel (main/zoom/einstellungen.ts) teilen sie. */
export const NDI_NAME_MAX = 60;
/** Spec 9.3, T43–T47: Prüfung des NDI-Namens eines Slots (E26). T46 ist eine Warnung, das Speichern gelingt (ersetzt Q10 für Slots). */
export const NDI_NAME_TEXT = {
  /** T43 */
  laenge: `Der NDI-Name muss 1 bis ${NDI_NAME_MAX} Zeichen lang sein.`,
  /** T44 */
  doppelpunkt: 'Ein Doppelpunkt ist im NDI-Namen nicht erlaubt (NDI macht daraus ein Leerzeichen).',
  /** T45 */
  doppelt: (nr: number): string => `Diesen NDI-Namen trägt schon Slot ${nr}.`,
  /** T46 */
  gast: (ndiName: string): string =>
    `NDI-Name doppelt: Ein Browser-Gast sendet ebenfalls als „${ndiName}“. Im Switcher ist nicht sicher, welche Quelle ankommt. Einen der beiden umbenennen.`,
  /** T47 */
  steuerzeichen: 'Steuerzeichen sind im NDI-Namen nicht erlaubt.',
};
/** Spec 9.4, T74: Haltezeit des Sprecher-Slots ungültig (Prüfregel KF7 in main/zoom/einstellungen.ts; 5 s = SPEAKER_HOLD_MAX_MS). */
export const HALTEZEIT_UNGUELTIG = 'Haltezeit: erlaubt sind 0 bis 5 Sekunden.';

/** Spec 9.6, T90 und T91: Lage der Einstellungsdatei (7.2). T92 ist TEXT_A4_SCHREIBFEHLER (oben). */
export const EINSTELLUNG_TEXT = {
  /** T90 */
  unlesbar: (datei: string): string =>
    `Die Einstellungen von Connect waren unlesbar. Die Datei liegt gesichert als „${datei}“; Connect arbeitet mit den Vorgaben weiter, auch für die Zoom-Slots.`,
  /** T91, Singular bei 1 */
  verworfen: (x: number): string =>
    x === 1
      ? '1 gespeicherter Slot war unvollständig oder doppelt und wurde nicht übernommen.'
      : `${x} gespeicherte Slots waren unvollständig oder doppelt und wurden nicht übernommen.`,
};

/**
 * Eingabe der Teilnehmerliste je Person (Spec 10.10; Task B21) für teilnehmerSlotAngabe: laufendMitZiel = die Slots, deren
 * Ziel diese Person ist (`slotNrn`, vom Kern); suchend = Teilnehmer-Slots, die ihren Namen suchen (eingestellte Person oder
 * gezeigter bzw. erwarteter Name `zielName`, also auch `personJetzt`, 7.3 Nr. 5, 6), ohne die schon laufenden, nach Nummer.
 * Verglichen wird der normierte Name wie `normName` im Kern (main/zoom/teilnehmer.ts; ein Test hält beide gleich).
 */
export function teilnehmerSlotEingabe(
  t: Pick<import('./types').ZoomParticipant, 'name' | 'imWarteraum' | 'slotNrn'>,
  slots: readonly import('./types').ZoomSlotLage[],
): TeilnehmerSlotEingabe {
  const norm = (s: string): string => s.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
  const name = norm(t.name);
  const suchend = slots
    .filter((l) => l.einstellung.modus === 'teilnehmer' && !t.slotNrn.includes(l.einstellung.nr))
    .filter((l) => (l.einstellung.person !== '' && norm(l.einstellung.person) === name) || (l.zielName !== null && norm(l.zielName) === name))
    .sort((a, b) => a.einstellung.nr - b.einstellung.nr)
    .map((l) => ({ nr: l.einstellung.nr, an: l.einstellung.an, doppelt: l.doppelt, zweifel: l.zweifel }));
  return { laufendMitZiel: [...t.slotNrn].sort((a, b) => a - b), suchend, imWarteraum: t.imWarteraum };
}

/** Gründe im Kartentext Z1a (Spec 7.2), je Mangel einer. */
export const MANGEL_GRUND: Record<ZoomMangel, string> = {
  sdk_fehlt: 'SDK-Ordner fehlt',
  sdk_defekt: 'Zoom-Laufzeit unvollständig, bitte den SDK-Ordner erneut wählen',
  bridge_fehlt: 'Zoom-Bridge fehlt in dieser Installation, bitte JM Connect neu installieren',
  zugang_fehlt: 'Zugangsdaten fehlen',
  zugang_unlesbar: 'Zugangsdaten lassen sich nicht entschlüsseln, bitte erneut eintragen oder die Datei erneut wählen',
};

/** Spec 7.1: Zustand + Erlaubnis + n + k → Zeile der Tabelle; n = laufende Slots, k = Slots mit Ersatzbild (Slot-Spec 10.3). */
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
      if (e === 'ja') return k.slotsLaufen === 0 ? 'Z8' : k.slotsErsatz === 0 ? 'Z9' : 'Z9b';
      if (k.slotsLaufen > 0) return 'Z7b';
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

/** Eingabe der Slot-Statuszeilen T82–T86 (slotTrayZeile, slotKartenZeile, Plan B, Task B9) aus der Kurzform. */
function slotStatus(k: ZoomKurz): SlotStatusEingabe {
  const e = k.erlaubnis ?? 'offen';
  return {
    z: zoomZ(k),
    erlaubnis: k.erlaubnis,
    grund: e === 'ja' || e === 'entzogen' ? null : Z7B_GRUND[e],
    zahlen: { n: k.slotsLaufen, k: k.slotsErsatz, o: k.slotsOffen, e: k.slotsAn, a: k.slotKurz.length, gestopptEntzug: k.slotsGestopptEntzug },
  };
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
    case 'Z7b':
    case 'Z8':
    case 'Z9':
    case 'Z9b':
      // Slot-Spec 9.5 (T82–T86). Z7 ohne gestoppte Slots (nichts lief, oder nicht entzogen) behält die Zeile aus ST4 7.2.
      return slotTrayZeile(slotStatus(k)) ?? '△ Zoom: im Meeting ohne Aufnahme-Erlaubnis';
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
 * Z7 (n = 0): der ganze Satz zum Grund. 'offen' ist dort Z6, 'ja' ist Z8. 'entzogen' mit gestoppten Slots hat einen eigenen
 * Text (T82, slotKartenZeile); ohne gestoppten Slot gilt der Satz hier.
 */
const Z7_GRUND: Record<'abgelehnt' | 'abgelaufen' | 'entzogen', string> = {
  abgelehnt: 'Der Host hat abgelehnt.',
  abgelaufen: 'Zoom hat keine Antwort bekommen.',
  entzogen: 'Der Host hat sie entzogen.',
};

/** Z7b (n > 0): der Grund in Klammern ({Grund} in T83). 'ja' ist dort Z9/Z9b, 'entzogen' hat einen eigenen Text (T83). */
const Z7B_GRUND: Record<Exclude<ZoomErlaubnis, 'ja' | 'entzogen'>, string> = {
  offen: 'angefragt, noch keine Antwort',
  abgelehnt: 'vom Host abgelehnt',
  abgelaufen: 'keine Antwort bekommen',
};

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
      // zoomZ liefert Z7 nur für abgelehnt/abgelaufen/entzogen. „Slots gestoppt“ (T82) nur, wenn ein Slot durch den Entzug stoppte.
      return slotKartenZeile(slotStatus(k))
        ?? `Im Meeting ohne Aufnahme-Erlaubnis. ${Z7_GRUND[e as keyof typeof Z7_GRUND]} Der Host kann sie im Zoom-Client jederzeit erteilen; Connect merkt das von selbst.`;
    case 'Z7b':
    case 'Z8':
    case 'Z9':
    case 'Z9b':
      // Slot-Spec 9.5 (T83–T86); slotKartenZeile liefert für diese Zeilen immer einen Text.
      return slotKartenZeile(slotStatus(k)) ?? '';
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

/**
 * Tray-Gästezeile und Tooltip mit der NDI-Lage (Spec 22.5 Regel R und Regel TT, 22.9 T129–T132; Ergänzung FR13). Die Zeilen
 * für e = 0 und die übrigen Tooltip-Teile stehen wörtlich wie in 7.3/7.4 (gaesteZeile und trayTooltip unten; beide
 * delegieren ab Plan C Task C9 hierher).
 */
export const TRAY_NDI_TEXT = {
  /** 7.3, unverändert: e = 0, Cloud eingerichtet */
  keineQuelle: '○ Gäste: keine NDI-Quelle',
  /** 7.3, unverändert: e = 0, Cloud nicht eingerichtet */
  keineCloud: '△ Gäste: Cloud nicht eingerichtet',
  t129: (a: number, e: number): string => (e === 1 ? '△ Gäste: NDI-Quelle ausgefallen' : `△ Gäste: ${a} von ${e} NDI-Quellen ausgefallen`),
  t130: (s: number): string => (s === 1 ? '○ Gäste: NDI-Quelle startet …' : `○ Gäste: ${s} NDI-Quellen starten …`),
  t131: (g: number): string => (g === 1 ? '● Gäste: 1 NDI-Quelle' : `● Gäste: ${g} NDI-Quellen`),
  t131OhneBild: (b: number): string => `, ${b} ohne Bild`,
  t131Startet: (s: number): string => (s === 1 ? ', 1 startet …' : `, ${s} starten …`),
  /** 7.4, unverändert */
  titel: 'JM Connect',
  /** 7.4, unverändert */
  zuschaltungen: 'Zuschaltungen aktiv',
  t132: 'NDI-Ausfall',
} as const;

/**
 * Zählweise der Gast-NDI-Quellen (E42): e Einträge, g bestehend (davon b ohne Bild), s startend, a ausgefallen. Dieselbe Form
 * wie NdiZahlen aus main/ndi-lage.ts; zoom-text.ts lädt nichts aus main/ (Linie von Plan B, der Renderer-tsconfig prüft
 * diese Datei mit).
 */
export interface NdiZahlenAnzeige { e: number; g: number; b: number; s: number; a: number }

/** Regel R (22.5), erste passende Zeile: e = 0 wie 7.3; a > 0 → T129; g > 0 → T131 samt Zusätzen; sonst (nur s) → T130. */
export function gaesteZeileNdi(z: NdiZahlenAnzeige & { cloud: boolean }): string {
  if (z.e === 0) return z.cloud ? TRAY_NDI_TEXT.keineQuelle : TRAY_NDI_TEXT.keineCloud;
  if (z.a > 0) return TRAY_NDI_TEXT.t129(z.a, z.e);
  if (z.g > 0) {
    return TRAY_NDI_TEXT.t131(z.g) + (z.b > 0 ? TRAY_NDI_TEXT.t131OhneBild(z.b) : '') + (z.s > 0 ? TRAY_NDI_TEXT.t131Startet(z.s) : '');
  }
  return TRAY_NDI_TEXT.t130(z.s);
}

/**
 * Regel TT (22.5): „Zuschaltungen aktiv“ bei e > 0 oder n > 0 (n = laufende Slots, 9.5), „NDI-Ausfall“ bei ndi_alarm = 1
 * (22.6), dann die Zoom-Teile unverändert (7.4); T132.
 */
export function trayTooltipNdi(e: { e: number; n: number; ndiAlarm: boolean; zoomTeile: string[] }): string {
  const teile: string[] = [];
  if (e.e > 0 || e.n > 0) teile.push(TRAY_NDI_TEXT.zuschaltungen);
  if (e.ndiAlarm) teile.push(TRAY_NDI_TEXT.t132);
  teile.push(...e.zoomTeile);
  return teile.length ? `${TRAY_NDI_TEXT.titel} — ${teile.join(' · ')}` : TRAY_NDI_TEXT.titel;
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
  if (s.ndiSenders > 0 || (s.zoom?.slotsLaufen ?? 0) > 0) teile.push('Zuschaltungen aktiv');
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
 * Tabelle 7.5 wörtlich: `alarm[0]` gilt bei o = 0, `alarm[1]` bei o > 0 (o = offene Slots, Slot-Spec 10.1, 10.4).
 * In Z1a, Z1b und Z2 ist o immer 0: Ein Mangel bzw. jeder Weg nach Z2 leert `liefSchon`, `zeigteSchon` und die
 * Fehlerstände (Slot-Spec 7.3 Nr. 2, Nr. 7; RR1).
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
export function stateKvAus(k: ZoomKurz): ZoomSlotStateKv | null {
  // Connect 0.4.0 (Spec 8.2, Task B18): die sieben Schlüssel von 0.3.0 und je Slot sieben, 7 + 16 × 7 = 119, in jedem Zustand
  // außer macOS (Z0). Die Werte je Slot stehen fertig in der Kurzform (slotKurz, Spec 7.1; Regeln 8.2/10.4 in stateKvSlots).
  const sieben = stateKvSieben(k);
  return sieben === null ? null : { ...sieben, ...slotStateTeil(k.slotKurz) };
}

/** Die sieben Schlüssel je Slot (Spec 8.2), in der Reihenfolge der Companion-Variablen. */
export const ZOOM_SLOT_STATE_TEILE = ['on', 'live', 'alarm', 'audio', 'mode', 'target', 'state'] as const;
/** Die 16 × 7 Schlüssel je Slot im STATE. */
export type ZoomSlotTeilKv = { [s: `zoom_slot${number}_${(typeof ZOOM_SLOT_STATE_TEILE)[number]}`]: string | number };
/** STATE von Connect 0.4.0: die sieben Schlüssel von 0.3.0 und die 112 je Slot. */
export type ZoomSlotStateKv = ZoomStateKv & ZoomSlotTeilKv;

/**
 * Die 112 Schlüssel je Slot aus der Kurzform (Spec 8.2), für jede Nummer 1 … SLOT_NR_MAX, auch für nicht angelegte Slots
 * (on/live/alarm/audio 0, mode und target leer, state „fehlt“). Ein Name steht nur in `_target` (B.4), und nur bei `_live` = 1
 * (Prädikat 10.4, hier an der Grenze zum STATE festgehalten).
 */
export function slotStateTeil(slotKurz: ZoomKurz['slotKurz']): ZoomSlotTeilKv {
  const kv: ZoomSlotTeilKv = {};
  for (let nr = 1; nr <= SLOT_NR_MAX; nr++) {
    const s = slotKurz.find((x) => x.nr === nr);
    kv[`zoom_slot${nr}_on` as const] = s?.an ? 1 : 0;
    kv[`zoom_slot${nr}_live` as const] = s?.live ? 1 : 0;
    kv[`zoom_slot${nr}_alarm` as const] = s?.alarm ? 1 : 0;
    kv[`zoom_slot${nr}_audio` as const] = s?.tonEin ? 1 : 0;
    kv[`zoom_slot${nr}_mode` as const] = s ? s.modus : '';
    kv[`zoom_slot${nr}_target` as const] = s?.live ? s.ziel : '';
    kv[`zoom_slot${nr}_state` as const] = s ? s.zustandWort : 'fehlt';
  }
  return kv;
}

/** Die sieben Schlüssel von 0.3.0 (Spec 7.5), Teil von stateKvAus; n und o aus den Slot-Zahlen (B12). */
function stateKvSieben(k: ZoomKurz): ZoomStateKv | null {
  const z = zoomZ(k);
  if (z === 'Z0') return null;
  const s = STATE_JE_Z[z];
  return {
    zoom_status: s.status,
    zoom_sources: k.slotsLaufen,
    zoom_live: k.slotsLaufen > 0 ? 1 : 0,
    zoom_privilege: s.privilege,
    zoom_alarm: s.alarm[k.slotsOffen > 0 ? 1 : 0],
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

// ── Zoom-Slots (Connect 0.4.0): Anzeige-Regeln (Spec 10) ──
// Jede dauerhaft sichtbare Zeile der Slots (Kachel, Slot-Bereich, Kopf, Tray, Karte, STATE) ist hier eine reine Funktion
// über einen kleinen Eingabetyp; Grundsatz oben: jeder Text in JEDEM Zustand wahr. Keine Funktion liest ZoomKurz oder
// ZoomAbbild (die ändern sich erst mit dem Kern-Umstieg, Plan B Task B12). Texte wörtlich aus Spec 9 mit T-Nummer (E31).

/** T1–T3 (Spec 9.1): Name des Modus. */
export const MODUS_NAME: Record<ZoomSlotModus, string> = {
  teilnehmer: 'Teilnehmer',
  sprecher: 'Aktiver Sprecher',
  freigabe: 'Bildschirmfreigabe',
};

/**
 * Arten mit einem Namen aus T4: die Einstellung und das, was die Bridge als Ersatzbild sendet (`sent`, Spec 6.12).
 * `none` (Bild von Zoom) und `held` (gehaltene Kopie der Freigabe) sind kein Ersatzbild und haben in T4 keinen Namen.
 */
export type ErsatzbildArt = Exclude<SlotSent, 'none' | 'held'> | ZoomSlotErsatzbild;

/** T4 (Spec 9.1): „Ersatzbild {art}“ nennt `sent` (10.2 Regel 9), die Einstellungen nennen die Einstellung. */
export const ERSATZBILD_NAME: Record<ErsatzbildArt, string> = {
  transparent: 'transparent',
  freeze: 'eingefroren',
  black: 'schwarz',
  white: 'weiß',
  eingefroren: 'eingefroren',
  schwarz: 'schwarz',
  weiss: 'weiß',
};

/** T4, Feldname (Spec 9.1). */
export const ERSATZBILD_FELD = 'Ersatzbild';

/** Spec 9.2: Zustandszeile der Kachel je T-Nummer. `ersatz` ist der fertige Teil „Ersatzbild {art}“ bzw. T60 (10.2 Regel 9). */
export const KACHEL_TEXT = {
  T10: 'Ausgeschaltet.',
  T11a: 'Wartet: Zoom ist auf diesem Rechner noch nicht eingerichtet.',
  T11b: 'Wartet auf den Beitritt zu einem Meeting.',
  T11c: 'Wartet: Connect tritt dem Meeting bei.',
  T11h: 'Wartet: Connect ist im Warteraum des Meetings.',
  T11d: 'Verbindung zum Meeting unterbrochen, Zoom verbindet neu.',
  T11e: 'Verbindung zum Meeting verloren, Connect tritt neu bei.',
  T11f: 'Connect verlässt das Meeting.',
  T11g: 'Läuft nicht: Zoom meldet einen Fehler (siehe oben).',
  T12a: 'Wartet auf die Aufnahme-Erlaubnis des Hosts.',
  T12b: 'Gestoppt: Der Host hat die Aufnahme-Erlaubnis entzogen. Erteilt er sie wieder, startet der Slot von selbst.',
  T12d: 'Wartet: Der Host hat die Aufnahme-Erlaubnis entzogen. Erteilt er sie wieder, startet der Slot von selbst.',
  T12c: 'Wartet: Ohne Aufnahme-Erlaubnis startet kein Slot.',
  T13: (person: string, d: number, ersatz: string): string =>
    `Name doppelt: „${person}“ ist ${d}-mal im Meeting. Bitte unten die richtige Person wählen. · ${ersatz}`,
  T13b: (person: string, ersatz: string): string =>
    `„${person}“ hat das Meeting verlassen; eine andere Person mit diesem Namen ist noch da. Ist sie gemeint, unten wählen. · ${ersatz}`,
  T14: 'Startet …',
  T15: (person: string): string => `Zeigt ${person}.`,
  T16: (person: string, ersatz: string): string => `Wartet auf ${person} · ${ersatz}`,
  T17: (person: string, ersatz: string): string => `Wartet auf ${person} (im Warteraum) · ${ersatz}`,
  T18: (ersatz: string): string => `Keine Person gewählt · ${ersatz}`,
  T19: (person: string, ersatz: string): string => `${person}: Kamera aus · ${ersatz}`,
  T19b: (person: string, ersatz: string): string => `${person}: Zoom liefert gerade kein Bild · ${ersatz}`,
  /** {Ziel} in T20, T20b, T20c bei Freigabe-Slots; sonst ist {Ziel} der Name der Person. */
  zielFreigabe: (person: string): string => `Freigabe von ${person}`,
  T20: (ziel: string, ersatz: string): string => `${ziel}: erstes Bild steht noch aus · ${ersatz}`,
  T20b: (ziel: string, ersatz: string): string => `${ziel}: fehlerhafte Bilder verworfen · ${ersatz}`,
  T20c: (ziel: string, name: string, ersatz: string): string =>
    `${ziel}: Zoom hat das Abo abgelehnt (${name}) · ${ersatz}. Für einen neuen Versuch „Stopp“ und wieder „Start“.`,
  T21: 'Keine Antwort der Zoom-Bridge. Für einen neuen Versuch „Stopp“ und wieder „Start“.',
  T22: `Nicht gestartet: mehr als ${BETRIEBSGROESSE} Slots ohne Bestätigung. Für die Bestätigung einmal „Stopp“ und wieder „Start“.`,
  /** {Klartext} aus 9.6 (T101–T103, B5); ohne ihn (kommt nicht vor, der Kern setzt ihn) fehlt nur dieser Teil. */
  T23: (klartext: string): string => `Gescheitert: ${klartext ? `${klartext} ` : ''}Für einen neuen Versuch „Stopp“ und wieder „Start“.`,
  T24: 'Wird gestoppt …',
  T25: (person: string): string => `Zeigt ${person} (Sprecher).`,
  T26: (ersatz: string): string => `Wartet auf eine sprechende Person · ${ersatz}`,
  T27: (person: string, ersatz: string): string => `${person} (Sprecher): Kamera aus · ${ersatz}`,
  T27b: (person: string, ersatz: string): string => `${person} (Sprecher): Zoom liefert gerade kein Bild · ${ersatz}`,
  T28: (person: string): string => `Zeigt die Freigabe von ${person}.`,
  T28b: (person: string, m: number, namen: string): string => `Zeigt die Freigabe von ${person} (die neueste von ${m}: ${namen}).`,
  T29: (person: string): string => `Freigabe von ${person} pausiert · letztes Bild gehalten`,
  T29b: (person: string): string => `Freigabe von ${person} unverändert · letztes Bild gehalten`,
  T29d: (person: string, ersatz: string): string => `Freigabe von ${person} pausiert · noch kein Bild · ${ersatz}`,
  T29e: (person: string, ersatz: string): string => `Freigabe von ${person}: Zoom liefert gerade kein Bild · ${ersatz}`,
  T29c: (ersatz: string): string => `Wartet auf eine Bildschirmfreigabe · ${ersatz}`,
  /** „Ersatzbild {art}“ (Regel 9). */
  ersatzbild: (art: string): string => `Ersatzbild ${art}`,
  T60: 'Ersatzbild eingefroren (kein gespeichertes Bild, darum transparent)',
  T97: (m: number): string => ` · Slot ${m} zeigt dieselbe Quelle; ob Zoom zwei Abos derselben Quelle zugleich beliefert, ist noch nicht gemessen.`,
};

/**
 * Spec 10.2 Regel 2: Zeile außerhalb des Meetings, auch mit einem Sender der aktiven Bridge (Z4, Z5, Z10, Z12), denn dort ist
 * ungewiss, ob Bild kommt; `null` = im Meeting (Z6–Z9b). Z0 gibt es nur unter macOS, und dort steht keine Kachel (7.11).
 */
const OHNE_MEETING: Record<ZoomZ, string | null> = {
  Z0: KACHEL_TEXT.T11a,
  Z1a: KACHEL_TEXT.T11a,
  Z1b: KACHEL_TEXT.T11a,
  Z2: KACHEL_TEXT.T11b,
  Z3: KACHEL_TEXT.T11c,
  Z4: KACHEL_TEXT.T11c,
  Z5a: KACHEL_TEXT.T11h,
  Z5b: KACHEL_TEXT.T11h,
  Z6: null,
  Z7: null,
  Z7b: null,
  Z8: null,
  Z9: null,
  Z9b: null,
  Z10: KACHEL_TEXT.T11d,
  Z11: KACHEL_TEXT.T11e,
  Z12: KACHEL_TEXT.T11f,
  Z13: KACHEL_TEXT.T11g,
};

/** Z6–Z9b: Connect ist im Meeting (`im_meeting`, Spec 7.1). Zustandszeile (10.2 Regel 2) und STATE (10.4) hängen daran. */
export function imMeetingZ(z: ZoomZ): boolean {
  return OHNE_MEETING[z] === null;
}

/** Fälle der Regeln 6–8 (Spec 10.2) im Zustand `ersatz`. */
type ErsatzFall = 'ohneZiel' | 'kameraAus' | 'keinBild' | 'pausiert' | 'fehlerhaft' | 'abgelehnt' | 'erstesBild';
const ALLE_MODI = (f: ErsatzFall): Record<ZoomSlotModus, ErsatzFall> => ({ teilnehmer: f, sprecher: f, freigabe: f });

/**
 * Je Grund und Modus der Fall der Regeln 6–8; ein neuer Grund ohne Eintrag scheitert im Typcheck (10.5). Die vier
 * Ziel-0-Gründe (6.10 Schritt 3) führen in jedem Modus auf dessen Text ohne Ziel (Nachfix W7): „sonst → T20“ trifft nur
 * Slots mit Ziel. Freigabe meldet nie `cameraOff` (6.12), `speakerNoVideo` gibt es nur im Modus Sprecher.
 */
const ERSATZ_FALL: Record<SlotReason, Record<ZoomSlotModus, ErsatzFall>> = {
  command: ALLE_MODI('erstesBild'),
  frames: ALLE_MODI('erstesBild'),
  noTarget: ALLE_MODI('ohneZiel'),
  participantLeft: ALLE_MODI('ohneZiel'),
  cameraOff: { teilnehmer: 'kameraAus', sprecher: 'kameraAus', freigabe: 'erstesBild' },
  noFrames: ALLE_MODI('keinBild'),
  speakerNone: ALLE_MODI('ohneZiel'),
  speakerNoVideo: { teilnehmer: 'erstesBild', sprecher: 'kameraAus', freigabe: 'erstesBild' },
  speakerChanged: ALLE_MODI('erstesBild'),
  shareNone: ALLE_MODI('ohneZiel'),
  sharePaused: { teilnehmer: 'erstesBild', sprecher: 'erstesBild', freigabe: 'pausiert' },
  shareStill: ALLE_MODI('erstesBild'),
  shareChanged: ALLE_MODI('erstesBild'),
  targetChanged: ALLE_MODI('erstesBild'),
  modeChanged: ALLE_MODI('erstesBild'),
  resolutionChanged: ALLE_MODI('erstesBild'),
  bufferMismatch: ALLE_MODI('fehlerhaft'),
  subscribeFailed: ALLE_MODI('abgelehnt'),
  meetingEnded: ALLE_MODI('erstesBild'),
  privilegeRevoked: ALLE_MODI('erstesBild'),
};

/**
 * Eingaben der Zustandszeile einer Kachel (Spec 10.2).
 * - `zielName`: gezeigte bzw. erwartete Person (Teilnehmer: `personJetzt` oder `person`; Sprecher: die erkannte sprechende
 *   Person; Freigabe: die teilende Person); `null` ohne Ziel.
 * - `person`: die eingestellte Person ('' = keine gewählt, T18).
 * - `freigaben`: laufende Bild-Freigaben (ohne reine Ton-Freigaben, 6.9) für T28b.
 * - `aboFehlerName`: Name des Fehlers zu `subscribeFailed` (T20c). `gescheitertText`: Klartext T101–T103 (B5) für T23.
 */
export interface KachelEingabe {
  zustand: ZoomSlotZustand; z: ZoomZ; erlaubnis: ZoomErlaubnis | null; modus: ZoomSlotModus;
  grund: SlotReason | null; gesendet: SlotSent | null; ersatzbild: ZoomSlotErsatzbild; zielName: string | null;
  person: string; doppelt: number; zweifel: boolean; imWarteraum: boolean; liefSchon: boolean; andererSlot: number | null;
  freigaben: { zahl: number; namen: string[] }; aboFehlerName: string | null; gescheitertText: string | null;
}

/** „Ersatzbild {art}“ (Regel 9): nennt `sent`; „eingefroren“ eingestellt und transparent gesendet → T60. */
function ersatzTeil(gesendet: SlotSent | null, ersatzbild: ZoomSlotErsatzbild): string {
  if (ersatzbild === 'eingefroren' && gesendet === 'transparent') return KACHEL_TEXT.T60;
  // In SZ6 sendet die Bridge immer eine Ersatzbild-Art (6.12); ohne sie (kommt nicht vor) nennt die Zeile die Einstellung.
  const art: ErsatzbildArt = gesendet === null || gesendet === 'none' || gesendet === 'held' ? ersatzbild : gesendet;
  return KACHEL_TEXT.ersatzbild(ERSATZBILD_NAME[art]);
}

/** SZ6 (Regeln 6–10): der Sender besteht, Zoom liefert kein Bild; die Zeile nennt den Grund und das gesendete Ersatzbild. */
function ersatzZeile(e: KachelEingabe, person: string): string {
  const ersatz = ersatzTeil(e.gesendet, e.ersatzbild);
  if (e.modus === 'teilnehmer') {
    // Regel 6, zuerst was eine Wahl braucht oder fehlt (nur ohne Ziel, 7.3 Nr. 5)
    if (e.doppelt > 1) return KACHEL_TEXT.T13(person, e.doppelt, ersatz);
    if (e.zweifel) return KACHEL_TEXT.T13b(person, ersatz);
    if (e.person === '') return KACHEL_TEXT.T18(ersatz);
    if (e.imWarteraum) return KACHEL_TEXT.T17(person, ersatz);
  }
  const ziel = e.modus === 'freigabe' ? KACHEL_TEXT.zielFreigabe(person) : person;
  const anderer = e.andererSlot !== null ? KACHEL_TEXT.T97(e.andererSlot) : '';   // Regel 10
  const fall: ErsatzFall = e.grund === null ? 'erstesBild' : ERSATZ_FALL[e.grund][e.modus];
  switch (fall) {
    case 'ohneZiel':
      if (e.modus === 'teilnehmer') return KACHEL_TEXT.T16(person, ersatz);
      return e.modus === 'sprecher' ? KACHEL_TEXT.T26(ersatz) : KACHEL_TEXT.T29c(ersatz);
    case 'kameraAus':
      return e.modus === 'sprecher' ? KACHEL_TEXT.T27(person, ersatz) : KACHEL_TEXT.T19(person, ersatz);
    case 'keinBild':
      if (e.modus === 'teilnehmer') return KACHEL_TEXT.T19b(person, ersatz) + anderer;
      return (e.modus === 'sprecher' ? KACHEL_TEXT.T27b(person, ersatz) : KACHEL_TEXT.T29e(person, ersatz)) + anderer;
    case 'pausiert':
      return KACHEL_TEXT.T29d(person, ersatz);
    case 'fehlerhaft':
      return KACHEL_TEXT.T20b(ziel, ersatz);
    case 'abgelehnt':
      return KACHEL_TEXT.T20c(ziel, e.aboFehlerName ?? 'slotSubscribeFailed', ersatz) + anderer;
    case 'erstesBild':
      return KACHEL_TEXT.T20(ziel, ersatz);
  }
}

/** Zustandszeile der Kachel (Spec 10.2): erste passende Regel gewinnt. */
export function kachelZeile(e: KachelEingabe): string {
  // Regel 1
  if (e.zustand === 'aus') return KACHEL_TEXT.T10;
  if (e.zustand === 'stoppt') return KACHEL_TEXT.T24;
  // Regel 2
  const ohneMeeting = OHNE_MEETING[e.z];
  if (ohneMeeting !== null) return ohneMeeting;
  const person = e.zielName ?? e.person;
  switch (e.zustand) {
    // Regel 3
    case 'wartet_erlaubnis': {
      const erlaubnis = e.erlaubnis ?? 'offen';
      if (erlaubnis === 'entzogen') return e.liefSchon ? KACHEL_TEXT.T12b : KACHEL_TEXT.T12d;
      if (erlaubnis === 'abgelehnt' || erlaubnis === 'abgelaufen') return KACHEL_TEXT.T12c;
      return KACHEL_TEXT.T12a;   // offen; „ja“ gibt es in SZ2 nicht (Vorrang 7.3 Zeile 5)
    }
    case 'ohne_meeting':   // SZ1 gibt es im Meeting nicht (Vorrang 7.3 Zeile 4)
    case 'startet':
    case 'geplant':
      return KACHEL_TEXT.T14;
    case 'keine_antwort':
      return KACHEL_TEXT.T21;
    case 'gescheitert':
      return KACHEL_TEXT.T23(e.gescheitertText ?? '');
    case 'zurueckgestellt':
      return KACHEL_TEXT.T22;
    // Regel 4
    case 'zeigt':
      if (e.modus === 'teilnehmer') return KACHEL_TEXT.T15(person);
      if (e.modus === 'sprecher') return KACHEL_TEXT.T25(person);
      return e.freigaben.zahl > 1
        ? KACHEL_TEXT.T28b(person, e.freigaben.zahl, e.freigaben.namen.join(', '))
        : KACHEL_TEXT.T28(person);
    // Regel 5
    case 'gehalten':
      return e.grund === 'sharePaused' ? KACHEL_TEXT.T29(person) : KACHEL_TEXT.T29b(person);
    // Regeln 6–10
    case 'ersatz':
      return ersatzZeile(e, person);
  }
}

/** Fehlerzeile der Kachel (Spec 10.9): in SZ8 steht der Klartext schon in T23 (nie doppelt); nach `live` fällt sie. */
export function kachelFehlerZeile(e: { zustand: ZoomSlotZustand; letzterSlotFehler: string | null; seitDemLive: boolean }): string | null {
  if (e.zustand === 'gescheitert' || e.seitDemLive) return null;
  return e.letzterSlotFehler;
}

/** Wort für einen fehlenden Wert (Spec 9.4, T62b: „fehlende Werte: „unbekannt““); auch in T58c (OFP4). */
export const UNBEKANNT = 'unbekannt';

/** Zahl für die Anzeige: ganzzahlig ohne Nachkommastelle, sonst eine Nachkommastelle mit Komma ({fps}, Haltezeit). */
export function dezimal(x: number): string {
  const r = Math.round(x * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
}

/** Spec 9.3: Tonzeile der Kachel (10.6) je T-Nummer; `q` ist der fertige Name der Quelle. */
export const TON_TEXT = {
  T58a: 'Ton: aus',
  T58b: (q: string): string => `Ton: ${q} · wartet auf das erste Paket`,
  T58c: (q: string, rate: string, kanaele: string): string => `Ton: ${q} · läuft (${rate} kHz, ${kanaele})`,
  T58d: (q: string): string => `Ton: ${q} · Stille (keine Pakete)`,
  T58e: (person: string): string => `Ton: ${person} · aus, die Person ist nicht im Meeting`,
  T58f: 'Ton: Computerton · wartet auf eine Bildschirmfreigabe',
  T58g: ' · Computerton kommt nicht an',
  T58h: (q: string): string => `Ton: ${q}, sobald der Slot läuft`,
  T58i: 'Ton: Person-Ton · aus, bis eine Person gewählt ist',
  T75: 'Ton: Person-Ton gibt es nur im Modus Teilnehmer. Der Slot sendet keinen Meeting-Ton.',
  T75b: 'Ton: Person-Ton gibt es nur im Modus Teilnehmer; es läuft nur der Computerton.',
  T76: (r1: string, r2: string): string => `Ton: Mischton und Computerton passen nicht zusammen (${r1} und ${r2}). Es läuft nur der Computerton.`,
  /** {Quelle} in T58b, T58c, T58d, T58h; Person-Ton nennt die Person, ohne gewählte Person „Person-Ton“ (RN12). */
  quelle: { mix: 'Mischton', share: 'Computerton', mixShare: 'Mischton + Computerton', personOhneWahl: 'Person-Ton' },
  /** {kanäle} in T58c (und T63). */
  mono: 'mono',
  kanaele: (c: number): string => `${c} Kanäle`,
};

/** {rate} in T58c (und T63): kHz mit einer Nachkommastelle. */
export function khzText(rateKhz: number): string {
  return rateKhz.toFixed(1).replace('.', ',');
}

/** {kanäle} in T58c (und T63): „mono“ bzw. „{c} Kanäle“. */
export function kanaeleText(c: number): string {
  return c === 1 ? TON_TEXT.mono : TON_TEXT.kanaele(c);
}

/** Spec 10.1, 10.6, 10.7: läuft der Sender des Slots (SZ4–SZ6), baut er ab (SZ9) oder fehlt er? Neuer Zustand: Typcheck. */
const SENDER: Record<ZoomSlotZustand, 'laeuft' | 'abbau' | 'keiner'> = {
  aus: 'keiner',
  ohne_meeting: 'keiner',
  wartet_erlaubnis: 'keiner',
  startet: 'keiner',
  zeigt: 'laeuft',
  gehalten: 'laeuft',
  ersatz: 'laeuft',
  keine_antwort: 'keiner',
  gescheitert: 'keiner',
  stoppt: 'abbau',
  zurueckgestellt: 'keiner',
  geplant: 'keiner',
};

/**
 * Eingaben der Tonzeile einer Kachel (Spec 10.6).
 * - `ziel`: Ziel der Bridge (Kennung bzw. bei Freigabe die teilende Person), 0 ohne Ziel; die Regeln 6 und 7 hängen daran.
 * - `grund`: Grund der Bridge zur Zustandszeile (die Tonzeile liest ihn nicht; 10.6 Regel 7 hängt am Ziel, nicht am Grund).
 * - `person`: die eingestellte Person ('' = keine gewählt); `doppelt`, `zweifel`, `imWarteraum` wie an der Zustandszeile.
 * - `ton`, `tonGrund`, `quelle`, `eingestellt`: `slotAudio` der Bridge (`state`, `reason`, `source`, `configured`, 6.3);
 *   `ton` = 'aus', solange keine Meldung kam; `eingestellt` = 'none', solange die Bridge keinen Weg meldet.
 * - `rateKhz`, `kanaele`: gemessen (`sampleRate`/1000, `channels`), sonst `null`.
 * - `tonAboFehler`: fertiger Text T104 (B5 `tonAboFehlerText`). Der Kern legt ihn an jede Kachel mit eingeschaltetem Ton,
 *   solange der Merker steht, und an einen Slot mit eigenem Ton `off/audioUnavailable` mit dem zuletzt gemeldeten Namen
 *   (7.1, Nachfix W6). Diese Datei lädt `klartext.ts` nicht (das lädt diese Datei).
 * - `rateMismatch`: die beiden Formate bei `rateMismatch` (T76), sonst `null`.
 */
export interface TonEingabe {
  zustand: ZoomSlotZustand; modus: ZoomSlotModus; ziel: number; grund: SlotReason | null;
  tonAn: boolean; tonArt: ZoomSlotTonArt; computerton: boolean; person: string; doppelt: number; zweifel: boolean;
  imWarteraum: boolean; ton: AudioState | 'aus'; tonGrund: SlotAudioReason | null; quelle: TonQuelle; eingestellt: TonQuelle;
  rateKhz: number | null; kanaele: number | null; tonAboFehler: string | null; rateMismatch: { r1: string; r2: string } | null;
}

/** Tonweg laut Einstellung (Ton-Abbildung 7.1 und `tonWeg` 6.13), solange die Bridge keinen meldet. */
function wegLautEinstellung(e: Pick<TonEingabe, 'modus' | 'tonAn' | 'tonArt' | 'computerton'>): TonQuelle {
  const computerton = e.modus === 'freigabe' && e.computerton;
  if (e.tonAn && e.tonArt === 'mischton') return computerton ? 'mixShare' : 'mix';
  if (e.tonAn && e.modus === 'teilnehmer') return 'person';
  return computerton ? 'share' : 'none';
}

const mitComputerton = (q: TonQuelle): boolean => q === 'share' || q === 'mixShare';

/** {Quelle}: Name eines Tonwegs; Person-Ton nennt die Person bzw. ohne gewählte Person „Person-Ton“ (RN12). */
function quelleName(q: Exclude<TonQuelle, 'none'>, person: string): string {
  if (q === 'person') return person === '' ? TON_TEXT.quelle.personOhneWahl : person;
  return TON_TEXT.quelle[q];
}

/** Tonzeile der Kachel (Spec 10.6): erste passende Regel gewinnt; `null` nur in SZ9 mit eingestelltem Ton. */
export function slotTonZeile(e: TonEingabe): string | null {
  // Regel 1: nichts eingestellt
  if (!e.tonAn && !(e.modus === 'freigabe' && e.computerton)) return TON_TEXT.T58a;
  const personAusserhalb = e.tonAn && e.tonArt === 'person' && e.modus !== 'teilnehmer';
  const eingestellt = e.eingestellt !== 'none' ? e.eingestellt : wegLautEinstellung(e);
  // Regel 2: kein Sender bzw. Sender im Abbau. Ohne Weg laut Einstellung ist es Person-Ton außerhalb von Teilnehmer (T75).
  const sender = SENDER[e.zustand];
  if (sender === 'abbau') return null;
  if (sender === 'keiner') return eingestellt === 'none' ? TON_TEXT.T75 : TON_TEXT.T58h(quelleName(eingestellt, e.person));
  // Regel 3: Ton-Abo-Fehler (Text T104 vom Kern)
  if (e.tonAboFehler !== null) return e.tonAboFehler;
  // Regel 4: Person-Ton außerhalb von Teilnehmer; T75b nur, wenn der Computerton gemessen hinausgeht
  if (personAusserhalb) return e.modus === 'freigabe' && e.computerton && mitComputerton(e.quelle) ? TON_TEXT.T75b : TON_TEXT.T75;
  // Regel 5
  if (e.rateMismatch !== null) return TON_TEXT.T76(e.rateMismatch.r1, e.rateMismatch.r2);
  // Regel 6: Person-Ton ohne Ziel, in der Folge der Zustandszeile (RN12)
  if (e.modus === 'teilnehmer' && e.tonAn && e.tonArt === 'person' && e.ziel === 0) {
    return e.doppelt > 1 || e.zweifel || e.person === '' ? TON_TEXT.T58i : TON_TEXT.T58e(e.person);
  }
  // Regel 7: nur Computerton, keine gezeigte Freigabe (noShare)
  if (e.modus === 'freigabe' && !e.tonAn && e.computerton && e.ziel === 0) return TON_TEXT.T58f;
  // Nach den Regeln 1 und 4 ergibt die Einstellung immer einen Weg (7.1); sonst sagt T75, was zutrifft.
  if (eingestellt === 'none') return TON_TEXT.T75;
  // Regeln 8–11
  switch (e.ton) {
    case 'waiting':
      return TON_TEXT.T58b(quelleName(eingestellt, e.person));
    case 'live': {
      // „läuft“ nennt die gemessene Quelle. Ging im letzten Fenster nichts hinaus (source none, kommt nach 6.3 nicht vor),
      // sagt T58d, was zutrifft.
      if (e.quelle === 'none') return TON_TEXT.T58d(quelleName(eingestellt, e.person));
      const rate = e.rateKhz !== null ? khzText(e.rateKhz) : UNBEKANNT;
      const kanaele = e.kanaele !== null ? kanaeleText(e.kanaele) : UNBEKANNT;
      const fehlt = mitComputerton(eingestellt) && !mitComputerton(e.quelle) ? TON_TEXT.T58g : '';
      return TON_TEXT.T58c(quelleName(e.quelle, e.person), rate, kanaele) + fehlt;
    }
    case 'silent':
      return TON_TEXT.T58d(quelleName(eingestellt, e.person));
    case 'off':
    case 'aus':
      return TON_TEXT.T58h(quelleName(eingestellt, e.person));
  }
}

/** Spec 9.3: Messzeile der Kachel (10.7); `res` ist die Stufe (T5), `fps` schon formatiert (`dezimal`). */
export const MESS_ZEILE = {
  T50: (res: string, b: number, h: number, fps: string): string => `${res} · Zoom liefert ${b}×${h} · ${fps} Bilder/s`,
  T51: (res: string, b: number, h: number, fps: string): string => `${res} gewünscht · Zoom liefert ${b}×${h} · ${fps} Bilder/s`,
  T51b: (res: string): string => `${res} gewünscht · noch kein Bild`,
  T51c: (res: string, b: number, h: number): string => `${res} · zuletzt ${b}×${h} · jetzt kein Bild`,
};

/** Nennhöhe je Stufe (10.7): verglichen wird die kürzere Seite des gelieferten Bildes. */
const NENNHOEHE: Record<ZoomSlotAufloesung, number> = { '360p': 360, '720p': 720, '1080p': 1080 };

/**
 * Eingaben der Messzeile (Spec 10.7). `geliefert`: Größe und Bildrate aus dem laufenden 2-s-Fenster dieses Ziels;
 * `zuletzt`: letzte Größe dieses Ziels (B55). Der Kern löscht beide bei Stopp, Abbau, Meeting-Ende und jedem Umhängen.
 */
export interface MessEingabe {
  zustand: ZoomSlotZustand; modus: ZoomSlotModus; stufe: ZoomSlotAufloesung;
  geliefert: { b: number; h: number; fps: number } | null; zuletzt: { b: number; h: number } | null;
}

/** Messzeile der Kachel (Spec 10.7); `null` ohne laufenden Sender, auch in SZ9 (Restrunde RR6). */
export function slotMessZeile(e: MessEingabe): string | null {
  if (SENDER[e.zustand] !== 'laeuft') return null;
  const g = e.geliefert;
  if (g !== null) {
    const unter = e.modus !== 'freigabe' && Math.min(g.b, g.h) < NENNHOEHE[e.stufe];
    return (unter ? MESS_ZEILE.T51 : MESS_ZEILE.T50)(e.stufe, g.b, g.h, dezimal(g.fps));
  }
  if (e.zuletzt !== null) return MESS_ZEILE.T51c(e.stufe, e.zuletzt.b, e.zuletzt.h);
  return MESS_ZEILE.T51b(e.stufe);
}

/** Spec 9.3: Texte des Slot-Bereichs und der Kachel. Die Höchstzahl kommt aus SLOT_NR_MAX (B-EP7). */
export const SLOT_TEXT = {
  /** T30 */
  keineSlots: 'Noch keine Slots. „Slot hinzufügen“ oder, sobald Connect im Meeting ist, in der Teilnehmerliste eine Person „Als Slot laden“.',
  /** T32, Tooltip am gesperrten „Slot hinzufügen“ */
  hoechstens: `Höchstens ${SLOT_NR_MAX} Slots. Zuerst einen Slot löschen.`,
  /** T33 */
  start: 'Start',
  /** T34 */
  stopp: 'Stopp',
  /** T35, Tooltip am gesperrten NDI-Namen */
  nameGesperrt: 'Den NDI-Namen erst ändern, wenn der Slot ausgeschaltet ist.',
  /** T36, Tooltip am gesperrten „Löschen“ */
  loeschenGesperrt: 'Zum Löschen den Slot erst ausschalten.',
  /** T38 */
  alsSlotLaden: 'Als Slot laden',
  /** T98 (übernimmt Q15 wörtlich), Tooltip an „Als Slot laden“ bei einer Person im Warteraum */
  warteraumTooltip: 'Erst im Zoom-Client zulassen.',
  /** T41 */
  trotzdem: 'Trotzdem einschalten',
  /** T42 */
  abbrechen: 'Abbrechen',
};

/** T31 (Spec 9.3, 10.11): Kopf des Slot-Bereichs; a angelegt, e eingeschaltet, n laufen. */
export function slotKopfZeile(a: number, e: number, n: number): string {
  return `${a} von ${SLOT_NR_MAX} Slots · ${e} eingeschaltet · ${n === 1 ? '1 läuft' : `${n} laufen`}`;
}

/** T37 (Spec 9.3): Rückfrage vor dem Löschen; die Knöpfe heißen BEDIEN_TEXT.loeschen (Task B9) und SLOT_TEXT.abbrechen. */
export function loeschenFrage(nr: number, ndiName: string): string {
  return `Slot ${nr} „${ndiName}“ löschen? Seine Einstellungen gehen verloren.`;
}

/** T40 (Spec 9.3, 7.4): Nachfrage, bevor mehr Slots eingeschaltet sind als die Betriebsgröße (B-EP7). */
export function nachfrageText(n: number): string {
  return `Mehr als ${BETRIEBSGROESSE} Zoom-Slots gleichzeitig sind nicht gemessen. Den ${n}. Slot trotzdem einschalten? Ob dieser Rechner es schafft, zeigen die Messwerte.`;
}

/** T96, T96b (Spec 9.2): Kennzeichen und Tooltip; der Knopf daneben heißt „Behalten“ (BEDIEN_TEXT.behalten, Task B9). */
export const KENNZEICHEN_TEXT = {
  T96: { text: 'vorübergehend', tooltip: 'Per Companion geladen; gilt bis zum Ende dieses Meetings.' },
  T96b: {
    text: 'nur dieses Meeting an',
    tooltip: 'Per Companion eingeschaltet; nach dem Ende dieses Meetings wieder aus. „Behalten“ lässt ihn eingeschaltet.',
  },
};

/** Spec 10.11: T96 nur an vorübergehenden Slots, T96b nur an dauerhaften mit `anNurMeeting`; danach (RR7) keins. */
export function slotKennzeichen(s: { voruebergehend: boolean; anNurMeeting: boolean }): { text: string; tooltip: string } | null {
  if (s.voruebergehend) return { ...KENNZEICHEN_TEXT.T96 };
  if (s.anNurMeeting) return { ...KENNZEICHEN_TEXT.T96b };
  return null;
}

/** „{nr1} und {nr2}“ bzw. „{nr1}, {nr2} und {nr3}“ (T39); ab vier Nummern ebenso weiter (Vorgabe OFP4 f). */
function aufzaehlung(nrn: readonly number[]): string {
  if (nrn.length <= 1) return nrn.join('');
  return `${nrn.slice(0, -1).join(', ')} und ${nrn[nrn.length - 1]}`;
}

/** T39–T39d (Spec 9.3): Angaben an einer Zeile der Teilnehmerliste. */
export const TEILNEHMER_SLOT_TEXT = {
  T39: (nrn: readonly number[]): string => `läuft in Slot ${aufzaehlung(nrn)}`,
  T39b: (nr: number): string => `Slot ${nr} einschalten`,
  T39c: (nr: number): string => `Slot ${nr} ist an und zeigt die Person nicht (siehe Kachel)`,
  T39d: (nr: number): string => `Slot ${nr}: Name doppelt, bitte an der Kachel wählen`,
};

/**
 * Eingaben einer Zeile der Teilnehmerliste (Spec 10.10).
 * - `laufendMitZiel`: laufende Slots (SZ4–SZ6, jeder Modus), deren Ziel in der Bridge diese Person ist bzw. deren gezeigte
 *   Freigabe sie teilt.
 * - `suchend`: Teilnehmer-Slots, die ihren Namen suchen (`person`, `personJetzt`, 7.3 Nr. 5).
 * - `imWarteraum`: die Person ist im Warteraum.
 */
export interface TeilnehmerSlotEingabe {
  laufendMitZiel: number[];
  suchend: { nr: number; an: boolean; doppelt: number; zweifel: boolean }[];
  imWarteraum: boolean;
}

/**
 * Spec 10.10: T39 mit allen Nummern; sonst ein suchender Teilnehmer-Slot nach Nummer, in der Folge der Regel (Name doppelt
 * oder Zweifel T39d, eingeschaltet T39c, ausgeschaltet T39b); sonst der Knopf T38, bei einer Person im Warteraum mit dem
 * Tooltip T98 (die Karte sperrt den Knopf dann). `knopf`: an der Zeile steht „Als Slot laden“.
 */
export function teilnehmerSlotAngabe(e: TeilnehmerSlotEingabe): { text: string; knopf: boolean; tooltip: string | null } {
  if (e.laufendMitZiel.length > 0) {
    return { text: TEILNEHMER_SLOT_TEXT.T39([...e.laufendMitZiel].sort((a, b) => a - b)), knopf: false, tooltip: null };
  }
  const suchend = [...e.suchend].sort((a, b) => a.nr - b.nr);
  const zweifel = suchend.find((s) => s.doppelt > 1 || s.zweifel);
  if (zweifel) return { text: TEILNEHMER_SLOT_TEXT.T39d(zweifel.nr), knopf: false, tooltip: null };
  const an = suchend.find((s) => s.an);
  if (an) return { text: TEILNEHMER_SLOT_TEXT.T39c(an.nr), knopf: false, tooltip: null };
  if (suchend.length > 0) return { text: TEILNEHMER_SLOT_TEXT.T39b(suchend[0].nr), knopf: false, tooltip: null };
  return { text: SLOT_TEXT.alsSlotLaden, knopf: true, tooltip: e.imWarteraum ? SLOT_TEXT.warteraumTooltip : null };
}

/** T87 (Spec 9.5): Hinweis nach einem Wiederbeitritt, je Teil mit Singular; die Grenze aus BETRIEBSGROESSE. */
export const R5_TEXT = {
  gestartet: (n: number): string => (n === 1 ? 'Wieder im Meeting. 1 Slot läuft wieder.' : `Wieder im Meeting. ${n} Slots laufen wieder.`),
  zweifel: (n: number): string => (n === 1 ? ' 1 wartet auf eine eindeutige Person.' : ` ${n} warten auf eine eindeutige Person.`),
  nicht: (n: number): string => ` ${n} nicht gestartet (siehe Kachel).`,
  grenze: (n: number): string => ` ${n} über der Grenze von ${BETRIEBSGROESSE} nicht gestartet.`,
};

/** T87 (Spec 10.11): gestartet = SZ4–SZ6, zweifel = Teilnehmer-Slots mit Name doppelt oder Zweifel, nicht = SZ7 und SZ8, grenze = SZ10; Zusätze mit 0 entfallen. */
export function r5Text(z: { gestartet: number; zweifel: number; nicht: number; grenze: number }): string {
  return R5_TEXT.gestartet(z.gestartet)
    + (z.zweifel > 0 ? R5_TEXT.zweifel(z.zweifel) : '')
    + (z.nicht > 0 ? R5_TEXT.nicht(z.nicht) : '')
    + (z.grenze > 0 ? R5_TEXT.grenze(z.grenze) : '');
}

/**
 * Zählung der Slots (Spec 10.1), dieselbe Form wie `SlotZahlen` in `main/zoom/slots.ts` (Task B1): n laufen, k mit
 * Ersatzbild, o offen, e eingeschaltet, a angelegt, `gestopptEntzug` = SZ2 mit Erlaubnis entzogen und `liefSchon`. Eigener
 * Name, weil `shared/` nichts aus `main/` lädt (der Renderer-tsconfig prüft diese Datei mit); ein `SlotZahlen` passt.
 */
export interface SlotZahlenAnzeige { n: number; k: number; o: number; e: number; a: number; gestopptEntzug: number }

/**
 * Eingaben von Tray-, Kopf- und Kartenzeile (Spec 10.3). `grund`: {Grund} in T83 (Karte, Z7b ohne Entzug); `null` = aus
 * `erlaubnis` nach der Tabelle Z7B_GRUND (wie 0.3.0).
 */
export interface SlotStatusEingabe { z: ZoomZ; erlaubnis: ZoomErlaubnis | null; grund: string | null; zahlen: SlotZahlenAnzeige }

/** Spec 9.5: Tray- und Kopfzeile bzw. Statuszeile der Karte, die sich mit den Slots ändern (je Singular bei n = 1). */
export const STATUS_TEXT = {
  T82: {
    tray: '△ Zoom: Aufnahme-Erlaubnis vom Host entzogen, Slots gestoppt',
    karte: 'Aufnahme-Erlaubnis vom Host entzogen, Slots gestoppt. Erteilt der Host sie im Zoom-Client wieder, startet Connect die eingeschalteten Slots von selbst.',
  },
  T83: {
    tray: (n: number): string => (n === 1 ? '△ Zoom: 1 Slot läuft, Aufnahme-Erlaubnis fehlt' : `△ Zoom: ${n} Slots laufen, Aufnahme-Erlaubnis fehlt`),
    karte: (grund: string, n: number): string =>
      `Die Aufnahme-Erlaubnis fehlt (${grund}). ${n === 1 ? '1 Slot läuft noch' : `${n} Slots laufen noch`}. Der Host kann sie im Zoom-Client erteilen.`,
    karteEntzogen: (n: number): string => `Aufnahme-Erlaubnis vom Host entzogen. Connect stoppt ${n === 1 ? '1 Slot' : `${n} Slots`} …`,
  },
  T84: {
    tray: '○ Zoom: im Meeting, kein Slot läuft',
    karteOhneEingeschaltete: 'Im Meeting. Kein Slot läuft: Slots unten einschalten oder eine Person als Slot laden.',
    karteMitEingeschalteten: 'Im Meeting. Kein Slot läuft; die Kacheln unten nennen den Grund.',
  },
  T85: {
    tray: (n: number): string => (n === 1 ? '● Zoom: 1 Slot läuft' : `● Zoom: ${n} Slots laufen`),
    karte: (n: number): string => (n === 1 ? 'Im Meeting. 1 Slot läuft.' : `Im Meeting. ${n} Slots laufen.`),
  },
  T86: {
    tray: (n: number, k: number): string => (n === 1 ? '● Zoom: 1 Slot läuft, mit Ersatzbild' : `● Zoom: ${n} Slots laufen, ${k} mit Ersatzbild`),
    karte: (n: number, k: number): string => (n === 1
      ? 'Im Meeting. 1 Slot läuft, mit Ersatzbild; die Kachel nennt den Grund.'
      : `Im Meeting. ${n} Slots laufen, ${k} davon mit Ersatzbild; die Kacheln nennen den Grund.`),
  },
};

/**
 * Tray- und Kopfzeile (Spec 9.5 linke Spalte, 10.3) für die Zeilen, die sich mit den Slots ändern. `null`: Hier gilt die
 * bisherige Zeile wörtlich (Z0–Z6, Z7 ohne gestoppten Slot, Z10–Z13; 9.5 letzter Absatz).
 */
export function slotTrayZeile(e: SlotStatusEingabe): string | null {
  const z = e.zahlen;
  switch (e.z) {
    case 'Z7':
      // „Slots gestoppt“ nur, wenn ein Slot in diesem Meeting lief und durch den Entzug nicht mehr läuft (10.3)
      return e.erlaubnis === 'entzogen' && z.gestopptEntzug > 0 ? STATUS_TEXT.T82.tray : null;
    case 'Z7b':
      return STATUS_TEXT.T83.tray(z.n);
    case 'Z8':
      return STATUS_TEXT.T84.tray;
    case 'Z9':
      return STATUS_TEXT.T85.tray(z.n);
    case 'Z9b':
      return STATUS_TEXT.T86.tray(z.n, z.k);
    case 'Z0':
    case 'Z1a':
    case 'Z1b':
    case 'Z2':
    case 'Z3':
    case 'Z4':
    case 'Z5a':
    case 'Z5b':
    case 'Z6':
    case 'Z10':
    case 'Z11':
    case 'Z12':
    case 'Z13':
      return null;
  }
}

/** Statuszeile der Karte (Spec 9.5 rechte Spalte, 10.3); `null` wie bei `slotTrayZeile`. */
export function slotKartenZeile(e: SlotStatusEingabe): string | null {
  const z = e.zahlen;
  const erlaubnis = e.erlaubnis ?? 'offen';
  switch (e.z) {
    case 'Z7':
      return erlaubnis === 'entzogen' && z.gestopptEntzug > 0 ? STATUS_TEXT.T82.karte : null;
    case 'Z7b':
      if (erlaubnis === 'entzogen') return STATUS_TEXT.T83.karteEntzogen(z.n);
      // zoomZ liefert Z7b nur ohne „ja“ (Spec 7.1)
      return STATUS_TEXT.T83.karte(e.grund ?? Z7B_GRUND[erlaubnis as keyof typeof Z7B_GRUND], z.n);
    case 'Z8':
      return z.e > 0 ? STATUS_TEXT.T84.karteMitEingeschalteten : STATUS_TEXT.T84.karteOhneEingeschaltete;
    case 'Z9':
      return STATUS_TEXT.T85.karte(z.n);
    case 'Z9b':
      return STATUS_TEXT.T86.karte(z.n, z.k);
    case 'Z0':
    case 'Z1a':
    case 'Z1b':
    case 'Z2':
    case 'Z3':
    case 'Z4':
    case 'Z5a':
    case 'Z5b':
    case 'Z6':
    case 'Z10':
    case 'Z11':
    case 'Z12':
    case 'Z13':
      return null;
  }
}

/** Werte von `zoom_slot{n}_state` je Slot-Zustand (Spec 8.2); nicht angelegte Slots melden `fehlt`. */
export const ZOOM_STATE_ZUSTANDSWORT: Record<ZoomSlotZustand, string> = {
  aus: 'aus',
  ohne_meeting: 'wartet',
  wartet_erlaubnis: 'wartet',
  startet: 'startet',
  zeigt: 'zeigt',
  gehalten: 'gehalten',
  ersatz: 'ersatz',
  keine_antwort: 'fehler',
  gescheitert: 'fehler',
  stoppt: 'stoppt',
  zurueckgestellt: 'zurueckgestellt',
  geplant: 'startet',
};

/**
 * Eingaben des STATE (Spec 8.2, 10.4). `z`: Zeile Z0–Z13 (Tabelle ST4 7.5); `zahlen`: n und o; `kurz.befehl`: letzter
 * `zoom_*`-Befehl; `slots`: je angelegtem Slot die Werte seiner sieben Schlüssel (`zielName`: wen der Slot gerade zeigt,
 * bei Freigabe die teilende Person). `kurz.zustand` und `kurz.erlaubnis` liest die Funktion nicht (Z kommt fertig).
 */
export interface SlotStateEingabe {
  kurz: { zustand: ZoomZustand; erlaubnis: ZoomErlaubnis | null; befehl: ZoomBefehlErgebnis | null };
  z: ZoomZ;
  zahlen: SlotZahlenAnzeige;
  slots: { nr: number; an: boolean; zustand: ZoomSlotZustand; offen: boolean; tonEin: boolean; modus: ZoomSlotModus; zielName: string | null }[];
}

/**
 * STATE (Spec 8.2, 10.4): die sieben bisherigen Schlüssel (ST4 7.5 mit n = laufende und o = offene Slots), dazu je Slot 1–16
 * sieben, zusammen 119. Unter macOS (Z0) keiner (7.11).
 */
export function stateKvSlots(e: SlotStateEingabe): Record<string, string | number> {
  if (e.z === 'Z0') return {};
  const s = STATE_JE_Z[e.z];
  const kv: Record<string, string | number> = {
    zoom_status: s.status,
    zoom_sources: e.zahlen.n,
    zoom_live: e.zahlen.n > 0 ? 1 : 0,
    zoom_privilege: s.privilege,
    zoom_alarm: s.alarm[e.zahlen.o > 0 ? 1 : 0],
    zoom_cmd: e.kurz.befehl?.kennung ?? '',
    zoom_cmd_rejected: e.kurz.befehl?.abgelehnt ? 1 : 0,
  };
  const imMeeting = imMeetingZ(e.z);
  for (let nr = 1; nr <= SLOT_NR_MAX; nr++) {
    const sl = e.slots.find((x) => x.nr === nr);
    const zeigt = sl !== undefined && imMeeting && (sl.zustand === 'zeigt' || sl.zustand === 'gehalten');
    // SZ4–SZ6 außerhalb von Z6–Z9b: Ein Sender kann bestehen, ob Bild kommt, ist ungewiss (RR5)
    const sender = sl !== undefined && (sl.zustand === 'zeigt' || sl.zustand === 'gehalten' || sl.zustand === 'ersatz');
    kv[`zoom_slot${nr}_on`] = sl?.an ? 1 : 0;
    kv[`zoom_slot${nr}_live`] = zeigt ? 1 : 0;
    kv[`zoom_slot${nr}_alarm`] = sl?.offen ? 1 : 0;
    kv[`zoom_slot${nr}_audio`] = sl?.tonEin ? 1 : 0;
    kv[`zoom_slot${nr}_mode`] = sl?.modus ?? '';
    kv[`zoom_slot${nr}_target`] = zeigt ? sl.zielName ?? '' : '';
    kv[`zoom_slot${nr}_state`] = sl === undefined ? 'fehlt' : sender && !imMeeting ? 'wartet' : ZOOM_STATE_ZUSTANDSWORT[sl.zustand];
  }
  return kv;
}

/** T80 (Spec 9.3): Knopf der Verlassen-Rückfrage; n = laufende Slots (7.5 Nr. 5/6). */
export function verlassenFrage(n: number): string {
  return n === 1 ? 'Ja, verlassen (1 Slot läuft)' : `Ja, verlassen (${n} Slots laufen)`;
}

/** T5 (Spec 9.1): Stufen der Auflösung. */
const AUFLOESUNG_NAME: Record<ZoomSlotAufloesung, string> = { '360p': '360p', '720p': '720p', '1080p': '1080p' };
/** T6 (Spec 9.1): Tonart. */
const TONART_NAME: Record<ZoomSlotTonArt, string> = { mischton: 'Mischton', person: 'Person' };

/** Spec 9.1, 9.3: Feldnamen der Einstellungen und Vorgaben (T5–T9, T48, T49, T77, T81); T4 steht bei ERSATZBILD_FELD. */
export const SLOT_FELD = {
  /** T5, Feldname und Stufen */
  aufloesung: 'Auflösung',
  aufloesungen: AUFLOESUNG_NAME,
  /** T6, Feldname, Schalter, Tonart */
  ton: 'Ton',
  an: 'an',
  aus: 'aus',
  tonArt: TONART_NAME,
  /** T7 */
  computerton: 'Computerton der Freigabe',
  /** T8 */
  ohneKamera: 'Teilnehmer ohne Kamera zeigen',
  /** T9 */
  ndiName: 'NDI-Name',
  modus: 'Modus',
  person: 'Person',
  einstellungen: 'Einstellungen',
  /** T48, Platzhalter im leeren Feld „Person“ */
  personPlatzhalter: 'Anzeigename in Zoom',
  /** T49, Kopf der Doppelname-Auswahl */
  welchePerson: 'Welche Person?',
  /** T77, Kopf der Vorgaben */
  vorgaben: (res: ZoomSlotAufloesung, tonAn: boolean): string => `Vorgaben für neue Slots: ${res}, Ton ${tonAn ? 'an' : 'aus'}.`,
  /** T81, unter dem Bild-Versatz */
  versatzZusatz: 'Gilt für Teilnehmer- und Sprecher-Slots, nicht für Bildschirmfreigaben.',
};

/** Ein Messwert, wie ihn der Aufrufer formatiert (Task B16: `dezimal`, `khzText`, `kanaeleText`). */
type Messwert = number | string;
/** „an“/„aus“ (T6) für HD-Video und Originalgröße in T62b (OFP4); fehlt der Wert, „unbekannt“ (9.4). */
const anAus = (w: boolean | null): string => (w === null ? UNBEKANNT : w ? SLOT_FELD.an : SLOT_FELD.aus);
/** Empfang laut Zoom in T62b: „{b}×{h}, {fps} Bilder/s“ wie in T62 (OFP4); fehlt der Wert, „unbekannt“ (9.4). */
const empfang = (r: { w: number; h: number; fps: number } | null): string => (r === null ? UNBEKANNT : `${r.w}×${r.h}, ${dezimal(r.fps)} Bilder/s`);

/** Spec 9.4: Messwerte (T61–T69) als Funktionen mit Platzhaltern; Slots heißen „Slot {nr} ({Modus})“, nie mit Namen (0.23). */
export const MESS_TEXT = {
  T61: (p: { cpu: Messwert; sys: Messwert; mem: Messwert; q: Messwert; d: Messwert; mv: Messwert; hl: Messwert }): string =>
    `Zoom-Bridge: ${p.cpu} % eines Kerns · System ${p.sys} % · Arbeitsspeicher ${p.mem} MB · Ton-Warteschlange höchstens ${p.q} Pakete, ${p.d} verworfen · Zoom-Ereignisse verworfen ${p.mv} · zurückgehaltene Renderer ${p.hl}`,
  /** T62; `resSetName` über `sdkErrorName`, nie als nackte Zahl (9.4). */
  T62: (p: { nr: number; modus: ZoomSlotModus; b: Messwert; h: Messwert; fps: Messwert; ffps: Messwert; work: Messwert; copy: Messwert;
    prev: Messwert; mem: Messwert; res: Messwert; resSetName: string; resGot: Messwert; pps: Messwert; md: Messwert; ms: Messwert }): string =>
    `Slot ${p.nr} (${MODUS_NAME[p.modus]}): ${p.b}×${p.h}, ${p.fps} Bilder/s, Ersatzbilder ${p.ffps}/s · Bridge-Anteil ${p.work} ms/s (davon Kopie ${p.copy}, Vorschau ${p.prev}) · Speicher ${p.mem} MB · Auflösung ${p.res}: ${p.resSetName}, Renderer meldet ${p.resGot} · Ton ${p.pps} Pakete/s, Mischer verworfen ${p.md} ms, Stille eingefügt ${p.ms} ms`,
  /** T62b; fehlende Werte „unbekannt“. */
  T62b: (p: { nr: number; ub: number | null; uh: number | null; hd: boolean | null; og: boolean | null;
    rv: { w: number; h: number; fps: number } | null; rs: { w: number; h: number; fps: number } | null }): string =>
    `Slot ${p.nr}: Zoom nennt als Videogröße ${p.ub !== null && p.uh !== null ? `${p.ub}×${p.uh}` : UNBEKANNT} · HD-Video ${anAus(p.hd)} · Originalgröße ${anAus(p.og)} · Meeting empfängt Video ${empfang(p.rv)}, Freigabe ${empfang(p.rs)}`,
  /** T62c (zu MS16). */
  T62c: (nr: number, vergleich: 'gleich' | 'verschieden' | 'fehlt'): string => `Rückkehr in Slot ${nr}: persistentId ${vergleich}`,
  /** T63; `p` = Pausen der gezeigten Freigabe, `g` = gehaltene Bilder. */
  T63: (p: { b: Messwert; h: Messwert; fps: Messwert; rate: Messwert; kanaele: string; p: Messwert; g: Messwert }): string =>
    `Freigabe: ${p.b}×${p.h}, ${p.fps} Bilder/s · Computerton ${p.rate} kHz, ${p.kanaele} · Pausen ${p.p}, gehaltene Bilder ${p.g}`,
  /** T63c (zu MS6). */
  T63c: { titel: 'Freigabe-Rückrufe (letzte 10)', spalten: ['Uhrzeit', 'Rückruf', 'Zustand', 'Person (Kennung)', 'Freigabe-Kennung', 'Typ'] },
  /** T64: kein Freigabe-Ton angekommen. */
  T64: (p: { b: Messwert; h: Messwert; fps: Messwert }): string => `Freigabe: ${p.b}×${p.h}, ${p.fps} Bilder/s · kein Computerton angekommen`,
  /** T64c: Freigabe-Ton angekommen, keiner Freigabe zuzuordnen. */
  T64c: (p: { b: Messwert; h: Messwert; fps: Messwert; x: Messwert; k: Messwert }): string =>
    `Freigabe: ${p.b}×${p.h}, ${p.fps} Bilder/s · Computerton kommt an (${p.x} Pakete), lässt sich aber keiner Freigabe zuordnen (Kennung ${p.k})`,
  /** T64b je `seeded`. */
  T64b: {
    ok: 'Laufende Freigaben beim Befüllen: erkannt',
    empty: 'Laufende Freigaben beim Befüllen: keine gemeldet',
    unavailable: 'Laufende Freigaben beim Befüllen: Zoom hat die Liste nicht geliefert',
  } as Record<'ok' | 'empty' | 'unavailable', string>,
  /** T65 */
  T65: { titel: 'Sprecher-Signale (letzte 20)', spalten: ['Uhrzeit', 'Video-Sprecher', 'Aktives Video', 'Ton-Aktivität'] },
  /** T66; „(1 Wechsel)“ bei w = 1; mit `gapUngeprueft` der Zusatz. */
  T66: (p: { a: Messwert; m: Messwert; x: Messwert; w: number; ungeprueft: boolean }): string =>
    `Lücke beim Wechsel: zuletzt ${p.a} ms · Median ${p.m} ms · höchstens ${p.x} ms (${p.w} Wechsel)${p.ungeprueft ? ' (ohne Prüfung der Quelle)' : ''}`,
  /** T67 */
  T67: (r: Messwert): string => `Wechsel pro Minute: ${r}`,
  /** T68: Rückmeldung nach „Messwerte kopieren“. */
  T68: 'Messwerte kopiert (ohne Namen).',
  /** T69 */
  T69: (p: { f: Messwert; l: Messwert; t: Messwert; nsd: Messwert; r: Messwert; rl: Messwert; typ: Messwert }): string =>
    `Zähler: fremde Bilder ${p.f} · beim Umhängen verworfen ${p.l} · zu häufige Aufrufe ${p.t} · noch keine Freigabe-Daten ${p.nsd} · neue Renderer ${p.r} · vom SDK abgebaute Renderer ${p.rl} · Renderer-Typ ${p.typ}`,
};

/** T70–T72 (Spec 9.4): Name je Sprecher-Signal. */
const SIGNAL_NAME: Record<ZoomSprecherSignal, string> = {
  sprecherVideo: 'Video-Sprecher (onActiveSpeakerVideoUserChanged, Vorgabe)',
  aktivesVideo: 'Aktives Video (onActiveVideoUserChanged)',
  tonAktiv: 'Ton-Aktivität (onUserActiveAudioChange)',
};

/** Spec 9.4: Sprecher-Einstellungen (T70–T73); T74 (ungültige Haltezeit) steht bei Task B3. */
export const SPRECHER_TEXT = {
  signal: SIGNAL_NAME,
  /** T73: Haltezeit in Sekunden („1“, „1,5“). */
  T73: (haltezeitMs: number): string =>
    `Haltezeit: ${dezimal(haltezeitMs / 1000)} s. So lange muss jemand sprechen, bevor der Sprecher-Slot wechselt.`,
};

/** T95 (Spec 9.6, 7.11): steht unter macOS an der Stelle der Zoom-Karte. */
export const MAC_ZEILE = 'Zoom-Slots gibt es nur unter Windows: Die Zoom-Bridge läuft nur dort.';

/** Bedientexte, die Spec 7.5/7.8 wörtlich zitiert (OFP2, Vorgabe: wörtlich übernehmen); „Behalten“ und „Löschen“ sind die Knöpfe aus T96/T96b und T37. */
export const BEDIEN_TEXT = {
  zoomSlots: 'Zoom-Slots',
  slotHinzufuegen: 'Slot hinzufügen',
  vorgaben: 'Vorgaben …',
  vorschau: 'Vorschau',
  sprecherEinstellungen: 'Sprecher-Einstellungen …',
  messwerte: 'Messwerte',
  messwerteKopieren: 'Messwerte kopieren',
  behalten: 'Behalten',
  loeschen: 'Löschen',
};

/** Kennzeichen je Kandidat der Doppelname-Auswahl (7.5): die Bestandstexte der Teilnehmerliste (OFP3, `ZoomCard.tsx:388-393`). */
export const KANDIDAT_KENNZEICHEN = { kameraAus: 'Kamera aus', host: 'Host', imWarteraum: 'im Warteraum' };

// ── ENDE DER SLOT-ANZEIGEN (neue Regeln direkt darüber einfügen) ──

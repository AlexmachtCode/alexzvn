// NDI-Texte von JM Connect: EINE Quelle für Gastzeile, Programm-Abzeichen, Grundzeilen, Link, Fußzeile, Untertitel und die
// Raum-Texte (Spec 22.9: T107–T128, T133, T134, T138–T146; T129–T132 stehen in zoom-text.ts). Dazu die Regeln, die aus der
// NDI-Lage ein Abzeichen machen (22.5 Regel G und Regel P), die Öffnen-Meldung T143 (E35) und der Tooltip T113.
// Grundsatz wie zoom-text.ts: Jeder Text muss in JEDEM Zustand wahr sein, in dem er steht (22.10, Kreuzprodukt in
// test/ndi-text.test.ts). App.tsx und der Main importieren die Texte nur von hier (PK56).
//
// Rein: kein electron, keine node:-Module, keine Uhr (G-C2). Die Zeit ohne Eintrag (T140) misst der Renderer monoton und
// gibt sie hinein (C-EP16). Typen der Lage kommen nur als `import type` aus main/ndi-lage.ts, das selbst nichts importiert;
// der Renderer-tsconfig prüft diese Datei samt ndi-lage.ts mit. Zur Laufzeit lädt sie nur ndiGastName aus @jm/rtc/state.
import { ndiGastName } from '@jm/rtc/state';
import type {
  NdiArt, NdiGastGrund, NdiProgrammGrund, NdiProgrammLage, NdiProgrammZustand, NdiQuelleLage, NdiQuelleZustand,
} from '../main/ndi-lage';

/** Texte aus Spec 22.9, je mit T-Nummer (E31: nur mit Owner-OK zu ändern). */
export const NDI_TEXT = {
  t107: 'NDI startet …',
  t108: 'NDI ●',
  t108Empfaenger: (c: number): string => (c === 0 ? 'NDI ● kein Empfänger' : c === 1 ? 'NDI ● 1 Empfänger' : `NDI ● ${c} Empfänger`),
  t108TooltipMac:
    'Kein Empfänger verbunden. Unter macOS braucht Connect für NDI den Zugriff auf das lokale Netzwerk (Systemeinstellungen › Datenschutz & Sicherheit › Lokales Netzwerk).',
  t109: 'NDI: kein Bild',
  t109Tooltip: 'Die NDI-Quelle besteht, aber seit über 3 s kam kein Bild für sie an.',
  t110: (k: number): string => `NDI ausgefallen · Neustart ${k} von 3 …`,
  t111: 'NDI ausgefallen',
  t111ArtKamera: 'NDI-Quelle Kamera',
  t111ArtBildschirm: 'NDI-Quelle Bildschirm',
  t111Zeile: (art: string, grund: string): string => `${art}: ${grund} Details im Log.`,
  t111Knopf: 'NDI neu starten',
  t112: 'Bildschirm: ',
  t113: (name: string): string =>
    `Teilt seinen Bildschirm. Den Zustand der NDI-Quelle „JM Connect – ${name} (Bildschirm)“ zeigt das Abzeichen „Bildschirm: …“ daneben.`,
  t114: 'NDI fehlt in diesem Paket oder ließ sich nicht laden (Addon oder NDI-Laufzeit).',
  t115: 'Die NDI-Laufzeit ließ sich nicht starten.',
  t116: 'Der NDI-Sender ließ sich nicht anlegen.',
  /** `{code}` ohne Exit-Code (kommt nach den Electron-Typen nicht vor): „unbekannt“, Owner-Frage OFC1 (Vorgabe). */
  t117: (code: number | null): string => `Der NDI-Prozess endete beim Start (Code ${code === null ? 'unbekannt' : code}).`,
  t118: 'Der NDI-Prozess fiel nach drei Neustarts erneut aus.',
  t119: 'Das interne Medienfenster von Connect fehlt. Bitte Connect neu starten.',
  t120: 'Programm: aus',
  t121: 'Programm sucht …',
  t122: 'Programm: keine Quelle',
  t122Tooltip: (hinweis: string): string => `Connect sucht laufend eine NDI-Quelle mit „${hinweis}“ im Namen.`,
  t122TooltipMac:
    ' Unter macOS braucht Connect dafür den Zugriff auf das lokale Netzwerk (Systemeinstellungen › Datenschutz & Sicherheit › Lokales Netzwerk).',
  t123: (quelle: string): string => `Programm ● ${quelle}`,
  t124: (quelle: string): string => `Programm: kein Bild von ${quelle}`,
  t124Tooltip: 'Von dieser NDI-Quelle kommt seit über 3 s kein Bild an (Switcher-Ausgang, Netz oder NDI-Verbindung).',
  t125: 'Programm kommt an, die Weitergabe an die Gäste hängt',
  t126: (quelle: string): string => `Programm: Öffnen gescheitert (${quelle}) · neuer Versuch folgt`,
  t127: (k: number): string => `Programm-Empfang ausgefallen · Neustart ${k} von 3 …`,
  t128: 'Programm-Empfang ausgefallen',
  t128Zeile: (grund: string): string => `Programm-Empfang: ${grund} Details im Log.`,
  t128Knopf: 'Programm neu starten',
  t133: 'ndi.video',
  t133Tooltip: 'NDI-Website öffnen (ndi.video)',
  /** die einzige Adresse, die `jmc:ndi-seite` öffnet (T133) */
  t133Adresse: 'https://ndi.video/',
  t134: 'NDI® is a registered trademark of Vizrt NDI AB.',
  t138: 'Der NDI-Prozess meldete sich nicht binnen 10 s.',
  t139: 'Der NDI-Prozess meldete einen unbekannten Fehler.',
  t140: 'NDI: keine Quelle',
  t140Tooltip: 'Für diesen Gast besteht in Connect keine NDI-Quelle, etwa nach einem Neustart von Connect bei offenem Raum.',
  t141:
    'Keine Verbindung zum Raum; Connect versucht laufend, neu zu verbinden. Die Gästeliste zeigt den letzten Stand, die NDI-Abzeichen den aktuellen; Gäste steuern, Talkback, Folien und Einladen gehen erst wieder mit der Verbindung.',
  /** Knopf der Fußzeile und der Grundzeilen (T111, T128) */
  t142Logordner: 'Logordner öffnen',
  t142Lizenz: 'Lizenzbedingungen',
  t143Logordner: (pfad: string): string => `Logordner ließ sich nicht öffnen: ${pfad}`,
  t143Lizenz: (pfad: string): string => `Lizenzbedingungen ließen sich nicht öffnen: ${pfad}`,
  t143NdiSeite: 'ndi.video ließ sich nicht öffnen: https://ndi.video/',
  t144:
    'Verbindung zum Raum beendet: Die Anmeldung von Connect gilt 8 Stunden ab dem letzten „Raum öffnen“ und ist abgelaufen, Connect versucht es für die Bedienung nicht mehr. „Raum öffnen“ meldet Connect neu an, ohne einen verteilten Link ungültig zu machen; Bilder und Programm-Rückkanal können dabei kurz aussetzen.',
  /** nur bei bekanntem Raum-Zustand an T144 angehängt */
  t144Zusatz: ' Die Gästeliste zeigt den letzten Stand, die NDI-Abzeichen den aktuellen.',
  t145: 'Remote-Zuschaltungen als NDI®-Quellen — Green Room',
  t146: (raum: string): string => `Keine Verbindung zum Raum „${raum}“. Adresse und Proxy-Key prüfen — im Hintergrund wird weiter versucht.`,
} as const;

/** Regel G: ein eingelassener Gast ohne Eintrag zeigt T140 erst nach so vielen ms ohne Eintrag (monotone Uhr, C-EP16). */
export const T140_NACH_MS = 3000;

/** Ein Abzeichen samt Grundzeile; `title` ist der volle Text (das Abzeichen kann abgeschnitten werden). */
export interface Abzeichen {
  text: string;
  title: string;
  tooltip: string | null;
  grundzeile: string | null;
  knopfNeustart: boolean;
  knopfLogordner: boolean;
}

/**
 * Eingabe der Regel G. `eingelassen`: Gast freigegeben oder auf Sendung; bei `art: 'bildschirm'` zusätzlich „teilt“.
 * `ohneEintragSeitMs`: monotone Zeit seit dem ersten Raum-Zustand ohne Eintrag (null = nicht gemessen oder Eintrag da).
 * `raumverbunden` ändert nichts: Abzeichen und NDI-Knöpfe stehen in beiden Lagen gleich (E53, die Knöpfe gehen per IPC).
 */
export interface GastAbzeichenEingabe {
  lage: NdiQuelleLage | null;
  eingelassen: boolean;
  ohneEintragSeitMs: number | null;
  art: NdiArt;
  plattform: 'win32' | 'darwin';
  raumverbunden: boolean;
}

/** Stellen, an denen T143 erscheinen kann (E35). */
export type OeffnenStelle = 'logordnerGrundzeile' | 'logordnerFusszeile' | 'lizenz' | 'linkGaeste' | 'linkSlots';

const nurText = (text: string, tooltip: string | null): Abzeichen =>
  ({ text, title: text, tooltip, grundzeile: null, knopfNeustart: false, knopfLogordner: false });

/** Grund in der Grundzeile (T114–T119, T138, T139). Record über alle Gründe: ein neuer Grund scheitert im Typcheck. */
const GAST_GRUND: Record<NdiGastGrund, (code: number | null) => string> = {
  addon: () => NDI_TEXT.t114,
  init: () => NDI_TEXT.t115,
  sender: () => NDI_TEXT.t116,
  startAbbruch: (code) => NDI_TEXT.t117(code),
  absturz: () => NDI_TEXT.t118,
  keinPeer: () => NDI_TEXT.t119,
  keinStart: () => NDI_TEXT.t138,
  unbekannt: () => NDI_TEXT.t139,
};
const PROGRAMM_GRUND: Record<NdiProgrammGrund, (code: number | null) => string> = {
  addon: () => NDI_TEXT.t114,
  init: () => NDI_TEXT.t115,
  startAbbruch: (code) => NDI_TEXT.t117(code),
  absturz: () => NDI_TEXT.t118,
  keinPeer: () => NDI_TEXT.t119,
  keinStart: () => NDI_TEXT.t138,
  unbekannt: () => NDI_TEXT.t139,
};

/** Regel G je Zustand (22.5); ohne Präfix T112. Record: ein Zustand ohne Text scheitert im Typcheck (22.10). */
const GAST_ABZEICHEN: Record<NdiQuelleZustand, (l: NdiQuelleLage, e: GastAbzeichenEingabe) => Abzeichen> = {
  startet: () => nurText(NDI_TEXT.t107, null),
  sendet: (l, e) => nurText(
    l.empfaenger === null ? NDI_TEXT.t108 : NDI_TEXT.t108Empfaenger(l.empfaenger),
    l.empfaenger === 0 && e.plattform === 'darwin' ? NDI_TEXT.t108TooltipMac : null,
  ),
  ohneBild: () => nurText(NDI_TEXT.t109, NDI_TEXT.t109Tooltip),
  neustart: (l) => nurText(NDI_TEXT.t110(l.k), null),
  gescheitert: (l, e) => {
    const grund = l.grund ?? 'unbekannt';
    return {
      text: NDI_TEXT.t111,
      title: NDI_TEXT.t111,
      tooltip: null,
      grundzeile: NDI_TEXT.t111Zeile(e.art === 'kamera' ? NDI_TEXT.t111ArtKamera : NDI_TEXT.t111ArtBildschirm, GAST_GRUND[grund](l.code)),
      knopfNeustart: grund !== 'keinPeer',
      knopfLogordner: true,
    };
  },
};

/**
 * Regel G (22.5), erste passende Zeile: ohne Eintrag und nicht eingelassen bzw. nicht teilend → kein Abzeichen; ohne Eintrag,
 * eingelassen bzw. teilend: unter 3 s (oder nicht gemessen) kein Abzeichen, sonst T140; mit Eintrag der Text des Zustands.
 * Die Bildschirm-Quelle trägt vor dem Text das Präfix T112; die Grundzeile nennt die Art statt des Präfixes.
 */
export function gastAbzeichen(e: GastAbzeichenEingabe): Abzeichen | null {
  const praefix = e.art === 'bildschirm' ? NDI_TEXT.t112 : '';
  const mitPraefix = (a: Abzeichen): Abzeichen => ({ ...a, text: praefix + a.text, title: praefix + a.title });
  if (e.lage === null) {
    if (!e.eingelassen || e.ohneEintragSeitMs === null || e.ohneEintragSeitMs < T140_NACH_MS) return null;
    return mitPraefix(nurText(NDI_TEXT.t140, NDI_TEXT.t140Tooltip));
  }
  return mitPraefix(GAST_ABZEICHEN[e.lage.zustand](e.lage, e));
}

/** Regel P je Zustand (22.5). Die Quelle ist in verbunden, ohneBild, staut und fehler immer gesetzt (Leser, 22.4). */
const PROGRAMM_ABZEICHEN: Record<NdiProgrammZustand, (l: NdiProgrammLage, plattform: 'win32' | 'darwin') => Abzeichen> = {
  aus: () => nurText(NDI_TEXT.t120, null),
  sucht: () => nurText(NDI_TEXT.t121, null),
  keineQuelle: (l, plattform) => nurText(NDI_TEXT.t122, NDI_TEXT.t122Tooltip(l.hinweis) + (plattform === 'darwin' ? NDI_TEXT.t122TooltipMac : '')),
  verbunden: (l) => nurText(NDI_TEXT.t123(l.quelle ?? ''), null),
  ohneBild: (l) => nurText(NDI_TEXT.t124(l.quelle ?? ''), NDI_TEXT.t124Tooltip),
  staut: () => nurText(NDI_TEXT.t125, null),
  fehler: (l) => nurText(NDI_TEXT.t126(l.quelle ?? ''), null),
  neustart: (l) => nurText(NDI_TEXT.t127(l.k), null),
  gescheitert: (l) => {
    const grund = l.grund ?? 'unbekannt';
    return {
      text: NDI_TEXT.t128,
      title: NDI_TEXT.t128,
      tooltip: null,
      grundzeile: NDI_TEXT.t128Zeile(PROGRAMM_GRUND[grund](l.code)),
      knopfNeustart: grund !== 'keinPeer',
      knopfLogordner: true,
    };
  },
};

/** Regel P (22.5): ein Text je Zustand (T120–T128); T122 mit `hinweis` und unter macOS dem Zusatz zum lokalen Netzwerk (E49). */
export function programmAbzeichen(e: { lage: NdiProgrammLage; plattform: 'win32' | 'darwin' }): Abzeichen {
  return PROGRAMM_ABZEICHEN[e.lage.zustand](e.lage, e.plattform);
}

/**
 * 22.5 Ort 2, E53: Die Kopfzeile der Gästeliste (Programm-Abzeichen, Link T133, in `gescheitert` die Grundzeile T128 mit ihren
 * Knöpfen) steht mit Raumverbindung immer und ohne sie, sobald der Empfang nicht `aus` ist. Das Abzeichen selbst hängt nicht an
 * der Raumverbindung (Regel P; seine Knöpfe gehen per IPC). Eine reine Regel, damit das Kreuzprodukt sie prüft (22.10, GG22).
 */
export function kopfzeileSichtbar(e: { programm: NdiProgrammZustand; raumverbunden: boolean }): boolean {
  return e.raumverbunden || e.programm !== 'aus';
}

/**
 * T143 neben dem Knopf bzw. Link (E35): steht genau dann, wenn das letzte Öffnen an dieser Stelle scheiterte; der Knopf bleibt
 * bedienbar (das zeigt der Aufrufer). Beim Link immer die feste Adresse aus T133, nie eine fremde.
 */
export function oeffnenMeldung(stelle: OeffnenStelle, letztes: 'keines' | 'gescheitert' | 'gelungen', pfad: string): string | null {
  if (letztes !== 'gescheitert') return null;
  switch (stelle) {
    case 'logordnerGrundzeile':
    case 'logordnerFusszeile':
      return NDI_TEXT.t143Logordner(pfad);
    case 'lizenz':
      return NDI_TEXT.t143Lizenz(pfad);
    case 'linkGaeste':
    case 'linkSlots':
      return NDI_TEXT.t143NdiSeite;
  }
}

/** T113: nennt die Bildschirm-Quelle mit dem bereinigten Namen, wie der Raum sie anlegt (C-EP5, ndiGastName aus @jm/rtc). */
export function bildschirmTooltip(name: string): string {
  return NDI_TEXT.t113(ndiGastName(name));
}

// ── Ende des Moduls ──

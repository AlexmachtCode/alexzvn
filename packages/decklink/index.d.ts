/** Natives DeckLink-Addon (nur SDI-AUSGABE, nur Bild). Alle Aufrufe sind synchron. */

// DisplayMode lebt in src/modes.ts, damit die reine Logik und ihr Selbsttest ohne
// .d.ts-Import auskommen. Hier nur weitergereicht.
export type { DisplayMode } from './src/modes.ts';
import type { DisplayMode } from './src/modes.ts';

export interface DeckLinkDevice {
  index: number;
  /** Anzeigename der Karte, wie Desktop Video ihn nennt. */
  name: string;
  /** Hat die Karte einen Ausgang? Reine Eingangskarten melden false. */
  hasOutput: boolean;
}

/** COM hochfahren. Muss vor allem anderen laufen. */
export function init(): boolean;

/** Alle Karten auflisten. Leere Liste = keine Karte, das ist KEIN Fehler. */
export function listDevices(): DeckLinkDevice[];

/** Alle Ausgabe-Normen einer Karte. Beschreibt nur — das Urteil faellt judgeModes(). */
export function listOutputModes(deviceIndex: number): DisplayMode[];

/** Ausgang oeffnen. prerollFrames: 2–6, Vorgabe 2. */
export function openOutput(deviceIndex: number, mode: string, prerollFrames?: number): boolean;

/** Ein BGRA-Vollbild einreihen (tight packed, stride = width*4). */
export function scheduleFrameBGRA(buf: Uint8Array, width: number, height: number): boolean;

export interface OutputStats {
  /** Bilder, die die Karte noch vor sich hat. */
  queued: number;
  /** Von der KARTE als zu spät gemeldet — deutet auf zu kleinen Vorlauf. */
  late: number;
  /** Von der KARTE verworfen. */
  dropped: number;
  /**
   * Leerlauf-Ereignisse: die Warteschlange lief leer. Wir schicken dabei ausdrücklich
   * KEIN Bild erneut — das zählt nur den Leerlauf. Was währenddessen auf dem SDI-Kabel
   * liegt, entscheidet die KARTE selbst: sie hält von sich aus ihr zuletzt angezeigtes
   * Bild (Hardware-Verhalten, keine Zusage dieses Addons). Deutet auf Drift oder
   * stockenden Zulieferer.
   */
  repeated: number;
  /** Von UNS abgewiesen, weil die Warteschlange volllief. */
  rejected: number;
  /** Insgesamt eingereiht (erfolgreich). */
  scheduled: number;
  /**
   * Jedes Scheitern von scheduleFrameBGRA (und des Schwarzbild-Vorlaufs), das NICHT
   * schon in `rejected` steckt — z. B. wenn die Karte im Betrieb gezogen wird. Ohne
   * diesen Zähler frieren bei so einem Ausfall ALLE anderen Zähler ein und `stats()`
   * meldet eine makellose Bilanz, während nichts mehr hinausgeht.
   */
  failed: number;
  /**
   * Der WIRKSAME Vorlauf (2–6, nach dem Klemmen in openOutput).
   * `0` heißt: kein Ausgang offen — es gibt gerade keinen Vorlauf.
   */
  preroll: number;
}
export function stats(): OutputStats;

export function closeOutput(): void;

/** Ausgang schliessen und COM herunterfahren. */
export function destroy(): void;

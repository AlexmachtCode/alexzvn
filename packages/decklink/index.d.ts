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
  /** Von der KARTE als zu spaet gemeldet — deutet auf zu kleinen Vorlauf. */
  late: number;
  /** Von der KARTE verworfen. */
  dropped: number;
  /** Von UNS gezaehlt, weil die Warteschlange leerlief — deutet auf Drift oder stockenden Zulieferer. */
  repeated: number;
  /** Von UNS abgewiesen, weil die Warteschlange volllief. */
  rejected: number;
  /** Insgesamt eingereiht. */
  scheduled: number;
}
export function stats(): OutputStats;

export function closeOutput(): void;

/** Ausgang schliessen und COM herunterfahren. */
export function destroy(): void;

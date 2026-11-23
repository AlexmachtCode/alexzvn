import type { AusgabeZustand } from '@jm/output-window/zustand';
import type { FernsteuerungMeldung } from './fernsteuerung';

// --- Prompter-Konfiguration + Transport ---
//
// Die Scroll-Position wird in *em* (Vielfachen der Schriftgröße) geführt, NICHT
// in Pixeln. So sehen die kleine Operator-Vorschau und das Vollbild-Ausgabe-
// fenster trotz unterschiedlicher Auflösung exakt denselben logischen Stand:
// translateY(-pos·1em) ist proportional identisch, und die Schrift wird per
// Container-Query (cqh) relativ zur jeweiligen Höhe skaliert.

export interface PrompterColors {
  background: string;
  text: string;
  /** Lesemarken-/Akzentfarbe (Marker-Zeilen, Lese-Linie). */
  accent: string;
}

export const DEFAULT_COLORS: PrompterColors = {
  background: '#000000',
  text: '#FFFFFF',
  accent: '#FFE819',
};

export interface PrompterConfig {
  /** Der vollständige Skripttext (Zeilen mit `#`/`##` werden zu Markern). */
  script: string;
  /** Schriftgröße als Anteil der Ausgabehöhe (in cqh = % der Containerhöhe). */
  fontScale: number;
  /** Zeilenabstand (Multiplikator). */
  lineHeight: number;
  /** Lesetempo in Zeilen pro Sekunde. */
  speed: number;
  /** Horizontale Spiegelung (für Beamsplitter-Glas-Prompter). */
  mirrorH: boolean;
  /** Vertikale Spiegelung (Deckenspiegel-Rigs). */
  mirrorV: boolean;
  /** Seitlicher Innenabstand in % der Breite (zentriert die Blickachse). */
  marginXPct: number;
  /** Feste Lese-Linie einblenden (Markierung auf fixer Höhe). */
  readingLine: boolean;
  /** Position der Lese-Linie in % der Höhe von oben. */
  readingLinePct: number;
  /** Fettschrift. */
  bold: boolean;
  colors: PrompterColors;
  /** Gewählter Ausgabe-Bildschirm (null = primär). */
  outputDisplayId: number | null;
  /** Handy-Fernbedienung (HTTP/SSE) aktiv. */
  remoteEnabled: boolean;
}

export const DEFAULT_CONFIG: PrompterConfig = {
  script:
    '# Willkommen\n\nWillkommen beim JM Prompter.\n\n' +
    'Tippe dein Skript links ein. Zeilen, die mit # beginnen, werden zu Marken — ' +
    'so springst du schnell zum nächsten Abschnitt.\n\n' +
    '## Abschnitt 2\n\n' +
    'Mit GO startet der Lauf, Leertaste pausiert. Tempo, Schriftgröße und Spiegelung ' +
    'stellst du live ein. Die Ausgabe läuft im Vollbild auf dem Talent-Monitor.\n\n' +
    '## Abschnitt 3\n\n' +
    'Viel Erfolg bei der Sendung!\n',
  fontScale: 7,
  lineHeight: 1.45,
  speed: 1.6,
  mirrorH: false,
  mirrorV: false,
  marginXPct: 8,
  readingLine: true,
  readingLinePct: 42,
  bold: true,
  colors: DEFAULT_COLORS,
  outputDisplayId: null,
  remoteEnabled: false,
};

/**
 * Transport-Zustand (gehört dem Main-Prozess). Statt jede Frame-Position per IPC
 * zu schicken, beschreibt er nur einen Anker — die Renderer interpolieren lokal:
 *   pos(now) = anchorEm + (playing ? (now - anchorAtMs)/1000 · emPerSec : 0)
 * IPC fließt also nur bei echten Änderungen (Play/Pause/Seek/Tempo).
 */
export interface PrompterTransport {
  playing: boolean;
  /** Position in em zum Ankerzeitpunkt. */
  anchorEm: number;
  /** Date.now() des Ankers. */
  anchorAtMs: number;
  /** em pro Sekunde im Lauf (= speed · lineHeight). */
  emPerSec: number;
}

export const INITIAL_TRANSPORT: PrompterTransport = {
  playing: false,
  anchorEm: 0,
  anchorAtMs: 0,
  emPerSec: DEFAULT_CONFIG.speed * DEFAULT_CONFIG.lineHeight,
};

/** Aktuelle interpolierte Position in em. */
export function positionEm(t: PrompterTransport, now: number = Date.now()): number {
  if (!t.playing) return t.anchorEm;
  return t.anchorEm + ((now - t.anchorAtMs) / 1000) * t.emPerSec;
}

export interface RemoteInfo {
  running: boolean;
  /** Erreichbare LAN-URLs der Fernbedienung. */
  urls: string[];
}

export interface PrompterState {
  config: PrompterConfig;
  transport: PrompterTransport;
  remote: RemoteInfo;
}

export interface DisplayInfo {
  id: number;
  label: string;
  primary: boolean;
  width: number;
  height: number;
}

/** Teil-Update der Konfiguration (verschachtelte Objekte werden in Main gemerged). */
export interface PartialPrompterConfig {
  script?: string;
  fontScale?: number;
  lineHeight?: number;
  speed?: number;
  mirrorH?: boolean;
  mirrorV?: boolean;
  marginXPct?: number;
  readingLine?: boolean;
  readingLinePct?: number;
  bold?: boolean;
  colors?: Partial<PrompterColors>;
  outputDisplayId?: number | null;
  remoteEnabled?: boolean;
}

/**
 * Master-Link-Zustand für die Statusleiste (Spec 3.9). Spiegel von MasterLinkMeldung aus @jm/app-runtime, das im Renderer
 * nicht importierbar ist (Main-Code). Den Gleichlauf prüft die Typprüfung des Preloads.
 */
export type MasterLinkMeldungZeile =
  | { art: 'aus' }
  | { art: 'sucht' }
  | { art: 'verbindet'; adresse: string }
  | { art: 'verbunden'; adresse: string; seit: number; masterName: string; suite: string }
  | { art: 'fehler'; code: string; text: string; errCode?: string }
  | { art: 'ohne-client' };

/** Shape, die der Preload auf `window.jmprompt` legt. */
export interface JmpromptApi {
  platform: NodeJS.Platform;
  getState: () => Promise<PrompterState>;
  setConfig: (patch: PartialPrompterConfig) => Promise<PrompterState>;
  /** Skript aus Datei laden (.docx/.txt/.md) und in die Config übernehmen (#28). */
  importScript: () => Promise<PrompterState>;
  onState: (cb: (s: PrompterState) => void) => () => void;
  transport: {
    play: () => Promise<PrompterState>;
    pause: () => Promise<PrompterState>;
    toggle: () => Promise<PrompterState>;
    /** Auf absolute Position (em) springen. */
    seek: (em: number) => Promise<PrompterState>;
    /** Relativ verschieben (em, +/-). */
    nudge: (deltaEm: number) => Promise<PrompterState>;
    /** An den Anfang zurücksetzen und pausieren. */
    reset: () => Promise<PrompterState>;
  };
  /** Handy-Fernbedienung an/aus; liefert den neuen Gesamt-State (inkl. URLs). */
  setRemote: (enabled: boolean) => Promise<PrompterState>;
  /** Master-Link-Zustand (Spec 3.9): Meldung oder null (Brücke fehlt oder lehnt ab → „unbekannt“). */
  masterLink: () => Promise<MasterLinkMeldungZeile | null>;
  onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;
  /** Lage des Steuerservers (Port 8727), nur lesend; null, solange Main nichts gemeldet hat. */
  fernsteuerung: () => Promise<FernsteuerungMeldung | null>;
  onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => () => void;
  output: {
    displays: () => Promise<DisplayInfo[]>;
    open: (displayId?: number) => Promise<void>;
    close: () => Promise<void>;
    isOpen: () => Promise<boolean>;
    /** Gemessener Zustand des Ausgabefensters (W2-2); null, wenn Main ablehnt. */
    zustand: () => Promise<AusgabeZustand | null>;
    onZustand: (cb: (z: AusgabeZustand) => void) => () => void;
  };
}

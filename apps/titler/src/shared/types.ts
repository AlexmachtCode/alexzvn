// --- JM Titler: Konfiguration + Status ---
//
// Der CG (Bauchbinde/Banner/Ticker) wird im Renderer auf einen Offscreen-Canvas
// in Programmauflösung gezeichnet, pro Frame als BGRA ausgelesen und über
// Main → utilityProcess als transparente NDI-Quelle gesendet (FourCC BGRA trägt
// den Alpha — siehe packages/ndi). Take/Clear (on-air) ist Live-Zustand im
// Renderer; die hier persistierte Konfiguration ist nur Inhalt/Stil/Ausgabe.

export type TemplateKind = 'lowerthird' | 'banner' | 'ticker';

export interface TitlerColors {
  /** Balken-/Hintergrundfarbe des CG. */
  bar: string;
  /** Textfarbe. */
  text: string;
  /** Akzent (Stripe, Linien). */
  accent: string;
}

export const DEFAULT_COLORS: TitlerColors = {
  bar: '#101316',
  text: '#FFFFFF',
  accent: '#FFE819',
};

export interface TitlerConfig {
  template: TemplateKind;
  /** Bauchbinde: Hauptzeile (Name). */
  name: string;
  /** Bauchbinde: Unterzeile (Funktion/Ort). */
  subtitle: string;
  /** Banner: einzeiliger Text. */
  bannerText: string;
  /** Ticker: durchlaufender Text. */
  tickerText: string;
  /** Ticker-Tempo in CG-Breiten pro Sekunde. */
  tickerSpeed: number;
  colors: TitlerColors;
  /** Vertikale Lage. */
  position: 'bottom' | 'top';
  /** Gesamtgröße (Multiplikator). */
  scale: number;
  // --- Ausgabe (NDI) ---
  /** Sichtbarer NDI-Quellname. */
  ndiName: string;
  /** Programmauflösung der NDI-Ausgabe. */
  width: number;
  height: number;
  /** Bildrate der NDI-Ausgabe. */
  fps: number;
}

export const DEFAULT_CONFIG: TitlerConfig = {
  template: 'lowerthird',
  name: 'Max Mustermann',
  subtitle: 'Geschäftsführer · Jakobs Medien',
  bannerText: 'Live aus dem Studio',
  tickerText: 'Willkommen bei Jakobs Medien  ·  Heute live  ·  ',
  tickerSpeed: 0.08,
  colors: DEFAULT_COLORS,
  position: 'bottom',
  scale: 1,
  ndiName: 'JM Titler',
  width: 1920,
  height: 1080,
  fps: 30,
};

export interface TitlerStatus {
  /** NDI-Sender (utilityProcess) läuft. */
  ndiActive: boolean;
  /** Anzahl verbundener NDI-Empfänger. */
  connections: number;
  /** Anzahl verbundener Suite-Steuerclients (Companion/QA/Battle/Health-Dashboard). */
  suiteClients: number;
}

export interface TitlerState {
  config: TitlerConfig;
  status: TitlerStatus;
}

/** Teil-Update der Konfiguration (verschachtelte colors werden in Main gemerged). */
export interface PartialTitlerConfig {
  template?: TemplateKind;
  name?: string;
  subtitle?: string;
  bannerText?: string;
  tickerText?: string;
  tickerSpeed?: number;
  colors?: Partial<TitlerColors>;
  position?: 'bottom' | 'top';
  scale?: number;
  ndiName?: string;
  width?: number;
  height?: number;
  fps?: number;
}

/**
 * Befehl der TCP-Fernsteuerung (Bitfocus Companion), vom Main an den Renderer
 * gepusht. Take/Clear ist Live-Zustand im Renderer (engine.ts), daher der Push.
 */
export type TitlerRemoteCommand =
  | { t: 'take' } // CG einblenden (On Air)
  | { t: 'clear' } // CG ausblenden
  | { t: 'toggle' } // On Air umschalten
  | { t: 'template'; kind: TemplateKind }; // Vorlage wechseln

/** Live-Zustand, vom Renderer an den Main gemeldet (für Companion-STATE). */
export interface TitlerRemoteState {
  /** CG ist eingeblendet (On Air). */
  onAir: boolean;
  /** Aktive Vorlage. */
  template: TemplateKind;
  /** NDI-Sender läuft. */
  ndiActive: boolean;
  /** Verbundene NDI-Empfänger. */
  connections: number;
}

/** Shape, die der Preload auf `window.jmtitler` legt. */
export interface JmtitlerApi {
  platform: NodeJS.Platform;
  getState: () => Promise<TitlerState>;
  setConfig: (patch: PartialTitlerConfig) => Promise<TitlerState>;
  onStatus: (cb: (s: TitlerStatus) => void) => () => void;
  ndi: {
    /** NDI-Sender starten (forkt den utilityProcess, übergibt den Frame-Port). */
    start: (name: string) => Promise<void>;
    stop: () => Promise<void>;
    status: () => Promise<TitlerStatus>;
  };
  /** TCP-Fernsteuerung (Bitfocus Companion) ↔ Renderer. */
  remote: {
    /** Auf Fernsteuer-Befehle hören (Main → Renderer). Liefert Unsubscribe. */
    onCommand: (cb: (cmd: TitlerRemoteCommand) => void) => () => void;
    /** Live-Zustand an den Main melden (Renderer → Steuerserver). */
    reportState: (state: TitlerRemoteState) => Promise<void>;
  };
}

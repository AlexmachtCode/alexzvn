// --- JM Titler: Konfiguration + Status ---
//
// Der CG (Bauchbinde/Banner/Ticker) wird im Renderer auf einen Offscreen-Canvas
// in Programmauflösung gezeichnet, pro Frame als BGRA ausgelesen und über
// Main → utilityProcess als transparente NDI-Quelle gesendet (FourCC BGRA trägt
// den Alpha — siehe packages/ndi). Take/Clear (on-air) ist Live-Zustand im
// Renderer; die hier persistierte Konfiguration ist nur Inhalt/Stil/Ausgabe.

export type TemplateKind = 'lowerthird' | 'banner' | 'ticker' | 'graphic';

// --- Grafik-Vorlagen (#162): importierte Bauchbinden aus PSD / jm Grafiktool ---
//
// Nicht-Text-Ebenen werden zu EINEM flachen Hintergrund-PNG gerechnet; Text-Ebenen
// werden zu benannten „Slots" (Position/Font/Farbe aus der Quelle). Der Slot-Text
// darf `{{schlüssel}}`-Platzhalter tragen und wird per DataLink/`TITLER TEXT` gefüllt
// — so bleiben Variablen nutzbar, ohne die ganze Layer-Engine mitzuschleppen.

/** Ein füllbares Textfeld einer Grafik-Vorlage (aus einer PSD-/Grafiktool-Textebene). */
export interface TitlerSlot {
  /** Stabiler Schlüssel (bereinigter Ebenenname) — Adresse für `TITLER SLOT`/`slotText`. */
  key: string;
  /** Ursprünglicher Ebenenname (Anzeige im Editor). */
  label: string;
  /** Geometrie in Vorlagen-Pixeln (bezogen auf width/height der Vorlage). */
  x: number;
  y: number;
  w: number;
  h: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  /** Vorbelegter Text — literal oder ein `{{schlüssel}}`-Platzhalter (Auto-Mapping). */
  defaultText: string;
}

/** Eine importierte Grafik-Vorlage (Metadaten; Hintergrund-PNG liegt als `<id>.png`). */
export interface GraphicTemplate {
  id: string;
  name: string;
  /** Autoren-Auflösung der Vorlage (Hintergrund-PNG-Maße). */
  width: number;
  height: number;
  slots: TitlerSlot[];
  createdAt: number;
  /** Optionale Thumbnail-Data-URL (nur in Listenantworten gefüllt). */
  thumbDataUrl?: string;
}

/** Anfrage zum Speichern einer neuen Vorlage in der Library (Renderer → Main). */
export interface TitlerTemplateAddRequest {
  name: string;
  width: number;
  height: number;
  slots: TitlerSlot[];
  /** Hintergrund als PNG-Bytes. */
  pngBytes: Uint8Array;
  /** Optionales Thumbnail als PNG-Bytes. */
  thumbBytes?: Uint8Array;
}

/** Vom Main gelesene Datei (Import-Dialog / Drag&Drop). */
export interface OpenedImportFile {
  fileName: string;
  bytes: Uint8Array;
}

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
  /**
   * DataLink-Watchfolder (#86): Ordner mit `schlüssel=wert`-Datendateien
   * (.txt/.env/.csv/.tsv). Textfelder dürfen `{{schlüssel}}`-Platzhalter
   * enthalten, die hieraus aufgelöst werden. Leer = deaktiviert.
   */
  dataFolder: string;
  colors: TitlerColors;
  /** Vertikale Lage. */
  position: 'bottom' | 'top';
  /** Gesamtgröße (Multiplikator). */
  scale: number;
  // --- Grafik-Vorlage (#162) ---
  /** Aktive Grafik-Vorlage (Library-ID) bei `template === 'graphic'`. '' = keine. */
  activeGraphicId: string;
  /** Pro-Slot-Text (Schlüssel = TitlerSlot.key) — hier leben die `{{}}`-Platzhalter. */
  slotText: Record<string, string>;
  // --- Ausgabe (NDI) ---
  /** Sichtbarer NDI-Quellname. */
  ndiName: string;
  /** Programmauflösung der NDI-Ausgabe. */
  width: number;
  height: number;
  /** Bildrate der NDI-Ausgabe. */
  fps: number;
  // --- Ausgabe (2. Bildschirm, #161) ---
  /** Zweitbildschirm-Ausgabe (CG auf Chroma-Green für externe Keyer) aktiv. */
  secondScreenEnabled: boolean;
  /** Electron `display.id` des Zielmonitors (0 = keiner/primär). */
  secondScreenDisplay: number;
  /** Chroma-Hintergrundfarbe der Zweitbildschirm-Ausgabe (Greenscreen). */
  chromaColor: string;
}

export const DEFAULT_CONFIG: TitlerConfig = {
  template: 'lowerthird',
  name: 'Max Mustermann',
  subtitle: 'Geschäftsführer · Jakobs Medien',
  bannerText: 'Live aus dem Studio',
  tickerText: 'Willkommen bei Jakobs Medien  ·  Heute live  ·  ',
  tickerSpeed: 0.08,
  dataFolder: '',
  colors: DEFAULT_COLORS,
  position: 'bottom',
  scale: 1,
  activeGraphicId: '',
  slotText: {},
  ndiName: 'JM Titler',
  width: 1920,
  height: 1080,
  fps: 30,
  secondScreenEnabled: false,
  secondScreenDisplay: 0,
  chromaColor: '#00B140',
};

export interface TitlerStatus {
  /** NDI-Sender (utilityProcess) läuft. */
  ndiActive: boolean;
  /** Anzahl verbundener NDI-Empfänger. */
  connections: number;
  /** Anzahl verbundener Suite-Steuerclients (Companion/QA/Battle/Health-Dashboard). */
  suiteClients: number;
  /** DataLink (#86): Variablen des AKTIVEN Eintrags (für die {{}}-Auflösung). */
  variables: Record<string, string>;
  /** Dateinamen, die zu den Variablen beigetragen haben. */
  dataSources: string[];
  /** Fehler beim Lesen des Watchfolders (z. B. nicht gefunden) — sonst undefined. */
  dataError?: string;
  /** Labels aller abrufbaren DataLink-Einträge (Recall-Liste). */
  entries: string[];
  /** Index des aktiven Eintrags, -1 wenn keiner. */
  activeEntry: number;
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
  dataFolder?: string;
  colors?: Partial<TitlerColors>;
  position?: 'bottom' | 'top';
  scale?: number;
  activeGraphicId?: string;
  /** Ganzes Objekt ersetzen (kein tiefer Merge). */
  slotText?: Record<string, string>;
  ndiName?: string;
  width?: number;
  height?: number;
  fps?: number;
  secondScreenEnabled?: boolean;
  secondScreenDisplay?: number;
  chromaColor?: string;
}

/** Monitor-Info für die Zweitbildschirm-Auswahl (#161). */
export interface DisplayInfo {
  /** Electron `display.id`. */
  id: number;
  /** Lesbares Label für die Auswahl (Auflösung + primär/intern). */
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  size: { width: number; height: number };
  scaleFactor: number;
  primary: boolean;
  internal: boolean;
}

/**
 * Befehl der TCP-Fernsteuerung (Bitfocus Companion), vom Main an den Renderer
 * gepusht. Take/Clear ist Live-Zustand im Renderer (engine.ts), daher der Push.
 */
export type TitlerRemoteCommand =
  | { t: 'take' } // CG einblenden (On Air)
  | { t: 'clear' } // CG ausblenden
  | { t: 'toggle' } // On Air umschalten
  | { t: 'template'; kind: TemplateKind } // Vorlage wechseln
  | { t: 'text'; name: string; subtitle: string } // Bauchbinden-Text setzen (#93, z. B. Q&A)
  | { t: 'graphic'; ref: string } // Grafik-Vorlage wählen (#162, Nr./Name/ID)
  | { t: 'slot'; key: string; text: string } // Slot-Text einer Grafik-Vorlage setzen (#162)
  | { t: 'recall'; ref: string } // DataLink-Eintrag abrufen (Nr. oder Name)
  | { t: 'next' } // nächster DataLink-Eintrag
  | { t: 'prev' }; // vorheriger DataLink-Eintrag

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
  /** Nativen Ordner-Dialog für den DataLink-Watchfolder (#86) öffnen. '' = abgebrochen. */
  pickDataFolder: () => Promise<string>;
  /** DataLink-Eintrag abrufen (Nr. oder Name). */
  recallEntry: (ref: string) => Promise<void>;
  /** Aktiven DataLink-Eintrag verschieben (+1 / -1). */
  stepEntry: (delta: number) => Promise<void>;
  /** Verfügbare Monitore für die Zweitbildschirm-Auswahl (#161). */
  listDisplays: () => Promise<DisplayInfo[]>;
  /** Auf Monitor-Änderungen (an-/abgesteckt) hören (#161). Liefert Unsubscribe. */
  onDisplaysChanged: (cb: () => void) => () => void;
  onStatus: (cb: (s: TitlerStatus) => void) => () => void;
  /** Auf Config-Änderungen hören (Main → alle Fenster, #161). Liefert Unsubscribe. */
  onConfig: (cb: (config: TitlerConfig) => void) => () => void;
  /** Auf On-Air-Änderungen hören (Main → Output-Fenster, #161). Liefert Unsubscribe. */
  onOnAir: (cb: (onAir: boolean) => void) => () => void;
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
  /** Grafik-Vorlagen-Library (#162): importierte Bauchbinden verwalten. */
  tpl: {
    /** Alle Vorlagen auflisten (mit Thumbnail-Data-URLs). */
    list: () => Promise<GraphicTemplate[]>;
    /** Neue Vorlage speichern → gibt die gespeicherte Vorlage zurück. */
    add: (req: TitlerTemplateAddRequest) => Promise<GraphicTemplate>;
    /** Vorlage löschen. */
    remove: (id: string) => Promise<void>;
    /** Hintergrund-PNG-Bytes einer Vorlage lesen (zum Dekodieren im Renderer). */
    readBg: (id: string) => Promise<Uint8Array | null>;
  };
  /** Auf Library-Änderungen hören (#162, Main → alle Fenster). Liefert Unsubscribe. */
  onTplChanged: (cb: () => void) => () => void;
  /** Import-Datei per Dialog wählen (.psd / .jmtitler). null = abgebrochen. */
  pickImportFile: () => Promise<OpenedImportFile | null>;
  /** Datei per Pfad lesen (Drag&Drop). null = Fehler. */
  readFile: (path: string) => Promise<OpenedImportFile | null>;
  /** Datei-Systempfad eines gedroppten File-Objekts ermitteln (webUtils). */
  pathForFile: (file: File) => string;
}

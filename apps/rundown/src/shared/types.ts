// Datenmodell + IPC-Typen für JM Rundown (Welle 3a, Slice 1).
//
// Der „autoritative" Zustand (Dokument + scharfe Zeile) lebt im Main-Prozess —
// so kann auch der spätere RUNDOWN-Steuerserver (Companion, Slice 3) navigieren.
// Der Renderer ist Ansicht + Editor und schickt Änderungen per IPC zurück.

/** Eine Aktion, die beim GO an ein Tool gesendet wird. */
export interface RundownAction {
  id: string;
  /** Ziel-Rolle (CAPABILITIES), z. B. 'timer', 'presenter', 'switcher'. */
  role: string;
  /** Protokoll-Verb, z. B. 'start', 'goto', 'take'. */
  verb: string;
  /** Positions-Argumente (Token nach dem Verb). */
  args: (string | number)[];
  /** Deaktivierte Aktionen werden beim GO übersprungen. */
  enabled: boolean;
  /**
   * Verzögerung in Millisekunden VOR dem Feuern dieser Aktion, relativ zur
   * vorherigen Aktion derselben GO-Sequenz (Issue #80). 0/undefined = sofort.
   * So lassen sich Multi-Aktionen einer Zeile zeitlich staffeln.
   */
  delayMs?: number;
}

/** Eine Zeile/Segment im Ablaufplan. */
export interface RundownRow {
  id: string;
  label: string;
  note?: string;
  actions: RundownAction[];
  /**
   * Geplante Dauer des Blocks in Millisekunden (Issue #85, Austausch mit dem JM
   * Timer). Rundown selbst feuert zeitlich nicht danach — das Feld wird beim
   * Regieplan-Import übernommen, im Editor pflegbar und beim Export mitgeschrieben,
   * damit ein Ablauf zwischen Rundown und Timer synchron bleibt. 0/undefined = ohne.
   */
  durationMs?: number;
}

/** Das Rundown-Dokument (Speicherformat `.jmrundown`). */
export interface RundownDoc {
  schemaVersion: 1;
  name: string;
  rows: RundownRow[];
}

/** Navigationsbefehl (vom UI oder später vom RUNDOWN-Steuerserver). */
export type RundownNav =
  | { t: 'go' }
  | { t: 'next' }
  | { t: 'prev' }
  | { t: 'goto'; n: number };

/** Host/Port eines Tool-Steuer-Endpunkts. */
export interface Endpoint {
  host: string;
  port: number;
}

/** Verbindungsstatus eines vom Conductor entdeckten/konfigurierten Tools. */
export interface ToolLink {
  role: string;
  label: string;
  host: string;
  port: number;
  connected: boolean;
  /** Woher kommt der Endpunkt: mDNS-Fund oder manuelle Eingabe. */
  source: 'mdns' | 'manual';
  /** Letzter STATE-Push des Tools (Tally/Status) — Schlüssel=Wert als Strings. */
  state: Record<string, string> | null;
}

/** Was beim letzten GO tatsächlich an die Tools ging (für die UI-Quittung). */
export interface FireReport {
  rowId: string;
  rowLabel: string;
  /** Pro Aktion: Protokollzeile + ob ein verbundenes Tool sie bekam. */
  sent: { role: string; line: string; delivered: boolean }[];
}

/** Vollständiger Zustand, den der Renderer (und das Ausgabe-/Companion-Bild) sieht. */
export interface RundownState {
  doc: RundownDoc;
  /** Index der scharfen Zeile. */
  index: number;
  filePath: string | null;
  dirty: boolean;
  /** Vom Conductor entdeckte/verbundene Tools. */
  links: ToolLink[];
  /** Manuelle Endpunkt-Overrides je Rolle (Cross-Subnet, mDNS aus). */
  overrides: Record<string, Endpoint>;
  lastFired: FireReport | null;
}

// ── Preload-API (window.jmrundown) ───────────────────────────────────────────
export interface JmRundownApi {
  platform: string;
  getState: () => Promise<RundownState>;
  onState: (cb: (s: RundownState) => void) => () => void;
  /** Nur die Tool-Verbindungen/Tally (häufige Updates, ohne den ganzen Doc). */
  onLinks: (cb: (links: ToolLink[]) => void) => () => void;
  /** Navigation/Conductor (GO feuert die scharfe Zeile). */
  nav: (cmd: RundownNav) => Promise<RundownState>;
  /** Eine einzelne Aktion sofort feuern (Test im Editor). Liefert „zugestellt". */
  fireAction: (role: string, verb: string, args: (string | number)[]) => Promise<boolean>;
  /** Manuellen Endpunkt setzen (host leer = Override entfernen → wieder mDNS). */
  setEndpoint: (role: string, host: string, port: number) => Promise<RundownState>;
  /** Nativen Datei-Dialog öffnen (für Pfad-Argumente, z. B. PRESENTER OPEN). Liefert den gewählten Pfad oder null. */
  pickFile: () => Promise<string | null>;
  /** Regieplan-Datei (XLSX/CSV) wählen + Bytes lesen (Issue #82). null bei Abbruch. */
  importRegieplan: () => Promise<{ name: string; bytes: Uint8Array } | null>;
  /** Dokument ersetzen (Editor speichert den ganzen Doc zurück). */
  setDoc: (doc: RundownDoc) => Promise<RundownState>;
  /** Datei-Operationen. */
  newDoc: () => Promise<RundownState>;
  open: () => Promise<RundownState>;
  save: () => Promise<RundownState>;
  saveAs: () => Promise<RundownState>;
}

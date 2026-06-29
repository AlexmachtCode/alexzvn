import type { AppChangelog, ToolManifest, ToolState } from '@jm/suite-manifest';
import type { Recipe, CookbookCategory } from '@jm/cookbook';
import type { Show } from '@jm/show';

export type {
  ToolManifest,
  ToolState,
  ToolCategory,
  InstallStatus,
  AppChangelog,
  ChangelogEntry,
} from '@jm/suite-manifest';

export type {
  Recipe,
  Cookbook,
  CookbookCategory,
  Difficulty,
  EquipmentOwner,
  RecipeBlocks,
  IngredientGroup,
  RecipeSteps,
  TroubleshootingRow,
  Checklist,
} from '@jm/cookbook';

/** Ergebnis einer Launcher-Aktion (öffnen/installieren/aktualisieren). */
export interface ActionResult {
  ok: boolean;
  message?: string;
}

/** Fortschritts-/Statusmeldung während Download & Installation. */
export interface InstallProgress {
  id: string;
  phase: 'download' | 'install' | 'done' | 'error';
  received?: number;
  total?: number;
  /** 0–100, falls die Gesamtgröße bekannt ist. */
  pct?: number;
  message?: string;
}

/** Eingabe zum Speichern der Einstellungen (Token wird nie zurückgegeben). */
export interface SuiteSettingsInput {
  githubToken?: string;
  proxyUrl?: string;
  /** Remote-Katalog (suite.json) — leer = gebündelten Katalog nutzen. */
  manifestUrl?: string;
}

/** Zustand der sicheren Steuerebene (P1-Adoption, geteilte control.json). */
export interface ControlPlaneStatus {
  mode: 'open' | 'secure';
  hasToken: boolean;
  hasTls: boolean;
  /** SHA-256-Fingerprint des TLS-Zertifikats (Clients pinnen ihn). */
  tlsFingerprint?: string;
  /** Suite-Token — nur direkt nach dem Provisionieren gesetzt (zum Anzeigen/Kopieren). */
  token?: string;
}

/** Für die UI sichtbarer Einstellungs-Zustand (ohne Klartext-Token). */
export interface SuiteSettingsView {
  hasToken: boolean;
  proxyUrl?: string;
  /** Welche Release-Quelle aktuell aktiv ist. */
  source: 'github' | 'proxy' | 'none';
  /** Quelle (Token/Proxy) stammt aus Umgebungsvariable (read-only in der UI). */
  fromEnv: boolean;
  /** Aktive Remote-Katalog-URL (suite.json), falls gesetzt. */
  manifestUrl?: string;
  /** Manifest-URL stammt aus Umgebungsvariable (read-only in der UI). */
  manifestFromEnv: boolean;
}

/** Verfügbares Launcher-Update (Self-Update). */
export interface LauncherUpdate {
  current: string;
  latest: string;
}

/** Bug-Report / Feature-Wunsch aus dem Launcher (→ GitHub-Issue). */
export interface FeedbackInput {
  type: 'bug' | 'feature';
  title: string;
  description: string;
  /** Aktuelle Logs (Launcher + gemeldete Tools) dem Issue beilegen. */
  includeLogs?: boolean;
}

/**
 * Neues Rezept aus dem Launcher einreichen (Pfad B = KI). Der KI-Agent macht aus
 * Titel + Stichpunkten ein schema-treues Rezept, das als PR landet — das feste
 * Format ist strukturell erzwungen (Schema + Compiler + CI + Review), die KI
 * füllt nur Inhalt. Welcher KI-Agent das übernimmt (Release-Proxy/Anthropic oder
 * der lokale Polaris-Agent) ist Sache des Main-Prozesses, nicht der UI.
 */
export interface RecipeDraftInput {
  title: string;
  category: CookbookCategory;
  /** Roh-Stichpunkte/Notizen, aus denen das Rezept entsteht. */
  notes: string;
}

/** Ergebnis einer Rezept-Einreichung — bei Erfolg mit Link zum geöffneten PR. */
export interface RecipeDraftResult extends ActionResult {
  /** URL des geöffneten Pull Requests, falls erstellt. */
  url?: string;
}

/** Laufzeit-Zustand eines Tools, gemeldet per Heartbeat an den Presence-Hub. */
export interface PresenceRecord {
  /** Stabile Tool-ID (entspricht ToolManifest.id, z. B. "jm-timer"). */
  appId: string;
  name: string;
  version: string;
  pid: number;
  /** Port eines tooleigenen Servers (z. B. Timer 7777), falls vorhanden. */
  servicePort?: number;
  /** Läuft das Tool gerade (frischer Heartbeat, kein "bye")? */
  running: boolean;
  /** Zeitpunkt des letzten Heartbeats (epoch ms). */
  lastSeen: number;
  /** Zuletzt aufgezeichneter Absturz (aus einem früheren Lauf), falls vorhanden. */
  lastCrash?: { kind: string; at: string } | null;
}

/** Live-Zustand eines im LAN entdeckten Steuer-Endpunkts (für das Dashboard). */
export interface HealthEntry {
  /** Tool-ID aus dem mDNS-TXT (z. B. "jm-timer", "jm-studio-control"). */
  appId: string;
  /** Rolle (z. B. "timer", "switcher", "studio"). */
  role: string;
  host: string;
  port: number;
  /** TCP-Verbindung zum Steuer-Endpunkt steht. */
  connected: boolean;
  /** Letzter STATE-Push (Schlüssel→Wert, Werte als Strings). */
  kv: Record<string, string>;
}

/** Ein in einer Show referenziertes Tool (für das Start-Feedback, #76). */
export interface ShowLaunchTool {
  appId: string;
  name: string;
}

/** Dezente Hintergrund-Ereignisse vom Main-Prozess an die UI. */
export type AppEvent =
  | { type: 'notice'; message: string }
  | { type: 'manifest-changed' }
  | { type: 'changelog-changed' }
  | { type: 'cookbook-changed' }
  | { type: 'presence-changed' }
  | { type: 'health-changed' }
  // Show-Start-Feedback (#76): Beim Öffnen einer Show startet der Launcher mehrere
  // Tools (Kaltstart dauert) — die UI zeigt dazu ein Lade-Overlay.
  | { type: 'show-launch-start'; name: string; tools: ShowLaunchTool[] }
  | { type: 'show-launch-done'; launched: number; total: number; missing: string[] };

/** Die unter `window.jmps` bereitgestellte Launcher-API. */
export interface JmpsApi {
  platform: NodeJS.Platform;
  /** Eigene Version des Launchers (z. B. "0.1.12"). */
  getVersion: () => Promise<string>;
  listTools: () => Promise<ToolManifest[]>;
  /** App-Patchnotes (live geladen, sonst gebündelter Fallback). */
  getChangelog: () => Promise<AppChangelog[]>;
  /** Kochbuch-Rezepte (live geladen, sonst gebündelter Fallback). */
  getCookbook: () => Promise<Recipe[]>;
  getState: () => Promise<ToolState[]>;
  checkUpdates: () => Promise<ToolState[]>;
  /** Laufzeit-Zustand aller Tools, die einen Heartbeat senden. */
  getPresence: () => Promise<PresenceRecord[]>;
  /** Live-Zustand aller im LAN entdeckten Steuer-Endpunkte (REC/On-Air/…). */
  getHealth: () => Promise<HealthEntry[]>;
  open: (id: string) => Promise<ActionResult>;
  /** Show-Datei (.jmshow) wählen und ihre Tools koordiniert starten. */
  openShow: () => Promise<ActionResult>;
  /** Zusammengestellte Show als .jmshow speichern (Save-Dialog). */
  saveShow: (show: Show) => Promise<ActionResult>;
  /** Datei-Dialog für ein Tool-Dokument (z. B. .jmpres) — liefert den Pfad. */
  pickShowDocument: () => Promise<string | null>;
  install: (id: string) => Promise<ActionResult>;
  update: (id: string) => Promise<ActionResult>;
  uninstall: (id: string) => Promise<ActionResult>;
  getLauncherUpdate: () => Promise<LauncherUpdate | null>;
  updateLauncher: () => Promise<ActionResult>;
  openExternal: (url: string) => Promise<void>;
  getSettings: () => Promise<SuiteSettingsView>;
  setSettings: (settings: SuiteSettingsInput) => Promise<SuiteSettingsView>;
  /** Zustand der sicheren Steuerebene lesen. */
  getControlStatus: () => Promise<ControlPlaneStatus>;
  /** Sichere Steuerebene aktivieren/neu provisionieren (Token + Cert erzeugen). */
  provisionControl: () => Promise<ControlPlaneStatus>;
  /** Zurück auf offene Steuerebene. */
  disableControl: () => Promise<ControlPlaneStatus>;
  submitFeedback: (input: FeedbackInput) => Promise<ActionResult>;
  /** Neues Rezept einreichen (Pfad B = KI) — öffnet bei Erfolg einen PR. */
  submitRecipeDraft: (input: RecipeDraftInput) => Promise<RecipeDraftResult>;
  onProgress: (cb: (p: InstallProgress) => void) => () => void;
  onAppEvent: (cb: (e: AppEvent) => void) => () => void;
}

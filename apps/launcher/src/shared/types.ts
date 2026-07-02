import type { AppChangelog, ToolManifest, ToolState } from '@jm/suite-manifest';
import type { Recipe, CookbookCategory } from '@jm/cookbook';
import type { Show, ShowAblaufItem, ShowIveoSpeaker } from '@jm/show';

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
  /** iveo-Basis-URL (kein Secret; leer = Staging-Default). #11 */
  iveoBaseUrl?: string;
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
  /** Aktive iveo-Basis-URL (kein Secret). #11 */
  iveoBaseUrl?: string;
  /** iveo-Basis-URL stammt aus Umgebungsvariable (read-only in der UI). */
  iveoBaseUrlFromEnv: boolean;
}

// ── iveo (#11) ────────────────────────────────────────────────────────────────

/** Kurz-Referenz eines iveo-Events (aus der Discovery `GET /`). */
export interface IveoEventStub {
  id: string;
  slug: string;
  name: string;
}

/** Token EINMAL prüfen und lesbare Events auflisten (Token wird nicht persistiert). */
export interface IveoDiscoverInput {
  /** Optional; leer = konfigurierte/Default-Basis-URL. */
  baseUrl?: string;
  /** Per-Event-Bearer-Token (`iveo_live_…`). */
  token: string;
}
export interface IveoDiscoverResult {
  ok: boolean;
  events?: IveoEventStub[];
  /** Stabiler Fehlercode (z. B. "unauthorized"), nie rohe Upstream-Antwort. */
  code?: string;
  error?: string;
}

/**
 * Event an eine Show binden: Token (verschlüsselt, pro Event) ablegen und den
 * Ablauf holen. Der zurückgegebene `ablauf` wird vom Show-Editor in die Show
 * eingebettet; das Token verlässt den Main-Prozess NIE.
 */
export interface IveoBindInput {
  baseUrl?: string;
  token: string;
  /** Event-Slug oder UUID. */
  event: string;
  /** Optionaler Ablauf-Filter (#11): nur diesen Programmtyp übernehmen (z. B. Side Events). */
  typeSlug?: string;
  /** Optionaler Ablauf-Filter: nur dieses Programmformat übernehmen. */
  formatSlug?: string;
  /** Optionaler Ablauf-Filter: nur Programme dieses Kalendertags (YYYY-MM-DD). */
  day?: string;
  /** Optionaler Ablauf-Filter: „Blocker"/Platzhalter-Einträge weglassen. */
  excludeBlockers?: boolean;
  /**
   * Ein einzelnes Side Event „im Detail" (#11 Phase 3b): Ablauf aus dessen Agenda,
   * Speaker auf dieses Programm eingegrenzt. Leer = Tages-/Listenmodus.
   */
  programId?: string;
}

/** Leichte Programm-Referenz für die Side-Event-Auswahl im Editor (token-frei, keine PII). */
export interface IveoProgramRef {
  id: string;
  title: string;
  /** Kalendertag (YYYY-MM-DD) oder leer, für die Gruppierung nach Tag im Picker. */
  day: string;
}

/** Verteilung der Programmtypen/-formate/-tage eines Events (für die Filter-Auswahl). */
export interface IveoProgramTaxonomy {
  types: Array<{ value: string; count: number }>;
  formats: Array<{ value: string; count: number }>;
  /** Kalendertage mit Anzahl (chronologisch) — Basis fürs „nur dieser Tag"-Filter. */
  days: Array<{ value: string; count: number }>;
  /** Anzahl als „Blocker"/Platzhalter erkannter Programme. */
  blockerCount: number;
}
export interface IveoBindResult {
  ok: boolean;
  code?: string;
  error?: string;
  /** Soft-Warnung bei Teilerfolg (z. B. iveo-Server-Fehler auf einer Ressource). */
  warning?: string;
  /** Materialisierter zentraler Ablauf zum Einbetten in die Show. */
  ablauf?: ShowAblaufItem[];
  /** Sanitisierte Speaker-Liste (Phase 3, für Titler) — token-frei, ohne PII. */
  speakers?: ShowIveoSpeaker[];
  /** Slug + Anzeigename für die token-freie Show-Bindung. */
  event?: { slug: string; name: string };
  /** Vorhandene Programmtypen/-formate (aus ALLEN Programmen) für die Filter-Auswahl. */
  programTypes?: IveoProgramTaxonomy;
  /** Anzahl Programmpunkte nach aktuell angewandtem Filter (Info für die UI). */
  programCount?: number;
  /** Alle Programme (id/title/day) für die Side-Event-Auswahl im Editor. */
  programList?: IveoProgramRef[];
  /** true, wenn der Ablauf aus den Agenda-Punkten EINES Side Events gebildet wurde. */
  agenda?: boolean;
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
  /** iveo (#11): Token prüfen + lesbare Events auflisten (Token nicht gespeichert). */
  discoverIveoEvents: (input: IveoDiscoverInput) => Promise<IveoDiscoverResult>;
  /** iveo (#11): Event an Show binden — Token verschlüsselt ablegen, Ablauf holen. */
  bindIveoEvent: (input: IveoBindInput) => Promise<IveoBindResult>;
  onProgress: (cb: (p: InstallProgress) => void) => () => void;
  onAppEvent: (cb: (e: AppEvent) => void) => () => void;
}

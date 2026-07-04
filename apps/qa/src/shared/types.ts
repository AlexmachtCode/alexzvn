// Datenmodell + IPC-Typen für JM Q&A (Welle 3c).
//
// Q&A verwaltet eine Wortmeldungs-/Frage-Queue (Pressekonferenz, Townhall). Der
// autoritative Zustand lebt im Main (damit auch der QA-Steuerserver/Companion und
// die Saal-Einreichung per Handy darauf wirken). Wird ein Sprecher scharf
// geschaltet, koppelt Q&A automatisch an den **Timer** (Redezeit) und den
// **Titler** (Name/Funktion als Bauchbinde) über das suite-weite Steuerprotokoll.

export type QaStatus = 'waiting' | 'active' | 'done';
export type QaSource = 'operator' | 'remote';
/**
 * Herkunftskanal einer Einreichung (#166): am Pult (operator), Saal-WLAN (lan),
 * anonym per Livestream-QR (stream) oder von akkreditierter Presse (press). `source`
 * bleibt zur Abwärtskompatibilität (operator vs. remote); `channel` verfeinert.
 */
export type QaChannel = 'operator' | 'lan' | 'stream' | 'press';

/** Eine Wortmeldung/Frage in der Queue. */
export interface QaEntry {
  id: string;
  /** Name des Sprechers/Fragestellers (Bauchbinde-Hauptzeile). */
  name: string;
  /** Funktion/Medium/Fraktion (Bauchbinde-Unterzeile). */
  affiliation: string;
  /** Optionaler Fragetext. */
  question: string;
  status: QaStatus;
  source: QaSource;
  /** Herkunftskanal (#166). */
  channel: QaChannel;
  /** Optionaler Kontakt für Rückfragen — nur Presse-Kanal (#166, PII). */
  contact?: string;
  /** Remote-Einreichungen müssen bei Moderation erst freigegeben werden. */
  approved: boolean;
  at: number;
}

export interface QaConfig {
  /** Redezeit-Limit in Sekunden (Timer-Kopplung). */
  speakSeconds: number;
  /** Bei Aktivierung den Timer auf speakSeconds setzen + starten. */
  autoTimer: boolean;
  /** Bei Aktivierung die Bauchbinde (Titler) mit Name/Funktion einblenden. */
  autoTitler: boolean;
  /** Remote-Einreichungen erst nach Freigabe in die Queue. */
  moderation: boolean;
  /** Saal-Einreichung per Handy (QR) aktiv. */
  remoteEnabled: boolean;
  /** Titler-Vorlage, die bei der Einblendung gewählt wird. */
  titlerTemplate: 'lowerthird' | 'banner' | 'ticker';

  // ── Externe Einreichung über den Cloud-Relay (#166) ──────────────────────────
  /** Externe Einreichung (Stream/Presse) aktiv — pollt den Worker. */
  cloudEnabled: boolean;
  /** Basis-URL des Q&A-Relays (Cloudflare-Worker), z. B. https://…workers.dev */
  proxyUrl: string;
  /** Event-ID im Relay (bestimmt die öffentlichen Einreich-URLs). */
  eventId: string;
  /** Presse-Zugangscode (Klartext, lokal — der Worker erhält nur den SHA-256-Hash). */
  pressCode: string;
  /** Anonymen Stream-Kanal offen halten. */
  streamOpen: boolean;
  /** Presse-Kanal offen halten. */
  pressOpen: boolean;
}

export interface QaRemoteInfo {
  running: boolean;
  /** Erreichbare LAN-URLs der Saal-Einreichung. */
  urls: string[];
}

/** Status der externen Einreichung über den Cloud-Relay (#166). */
export interface QaCloudInfo {
  /** Polling aktiv (Einreichungen werden abgeholt). */
  enabled: boolean;
  /** Grundkonfiguration vollständig (Proxy-URL + Key + Event-ID + Schlüssel). */
  configured: boolean;
  eventId: string;
  proxyUrl: string;
  /** Öffentliche Einreich-URL (Stream) — für QR im Livestream. */
  streamUrl: string;
  /** Öffentliche Einreich-URL (Presse) — mit Zugangscode zu teilen. */
  pressUrl: string;
  pressCode: string;
  streamOpen: boolean;
  pressOpen: boolean;
  /** Ob ein Proxy-Key hinterlegt ist (Wert wird NIE an den Renderer gegeben). */
  hasKey: boolean;
  lastError: string | null;
  lastPollAt: number | null;
}

/** Host/Port eines Tool-Steuer-Endpunkts. */
export interface Endpoint {
  host: string;
  port: number;
}

/** Verbindungsstatus eines vom Coupling entdeckten/konfigurierten Tools. */
export interface ToolLink {
  role: string;
  label: string;
  host: string;
  port: number;
  connected: boolean;
  source: 'mdns' | 'manual';
  /** Letzter STATE-Push (Tally) — Schlüssel=Wert als Strings. */
  state: Record<string, string> | null;
}

/** Vollständiger Zustand, den der Renderer sieht. */
export interface QaState {
  entries: QaEntry[];
  /** Id des aktiven Sprechers (abgeleitet: Eintrag mit status 'active'). */
  activeId: string | null;
  config: QaConfig;
  remote: QaRemoteInfo;
  /** Status der externen Einreichung (Cloud-Relay, #166). */
  cloud: QaCloudInfo;
  /** Gekoppelte Tools (titler/timer) inkl. Verbindung/Tally. */
  links: ToolLink[];
  /** Manuelle Endpunkt-Overrides je Rolle. */
  overrides: Record<string, Endpoint>;
}

/** Eingabe für eine neue Wortmeldung (Operator oder Handy). */
export interface QaSubmission {
  name: string;
  affiliation?: string;
  question?: string;
  /** Optionaler Kontakt (nur Presse-Kanal, #166). */
  contact?: string;
}

// ── Preload-API (window.jmqa) ────────────────────────────────────────────────
export interface JmQaApi {
  platform: string;
  getState: () => Promise<QaState>;
  onState: (cb: (s: QaState) => void) => () => void;
  /** Nur die Tool-Verbindungen/Tally (häufige Updates). */
  onLinks: (cb: (links: ToolLink[]) => void) => () => void;

  // Queue-Operationen
  addEntry: (sub: QaSubmission) => Promise<QaState>;
  updateEntry: (id: string, patch: QaSubmission) => Promise<QaState>;
  removeEntry: (id: string) => Promise<QaState>;
  moveEntry: (id: string, dir: -1 | 1) => Promise<QaState>;
  approveEntry: (id: string, approved: boolean) => Promise<QaState>;

  // Ablauf
  activate: (id: string) => Promise<QaState>;
  next: () => Promise<QaState>;
  endActive: () => Promise<QaState>;
  clearDone: () => Promise<QaState>;
  clearAll: () => Promise<QaState>;

  // Konfiguration + Saal-Einreichung + Endpunkte
  setConfig: (patch: Partial<QaConfig>) => Promise<QaState>;
  setRemote: (enabled: boolean) => Promise<QaState>;
  setEndpoint: (role: string, host: string, port: number) => Promise<QaState>;

  // Externe Einreichung (Cloud-Relay, #166)
  /** Nicht-geheime Cloud-Config setzen (Proxy-URL, Presse-Code, Offen-Flags). */
  setCloudConfig: (patch: Partial<QaConfig>) => Promise<QaState>;
  /** Proxy-Key (Secret) hinterlegen — verschlüsselt at-rest, nie zurückgegeben. */
  setProxyKey: (key: string) => Promise<QaState>;
  /** Neues Event erzeugen (frische Event-ID + Schlüsselpaar). */
  cloudGenerateEvent: () => Promise<QaState>;
  /** Externe Einreichung starten/stoppen (öffnet das Event + startet Polling). */
  cloudEnable: (enabled: boolean) => Promise<QaState>;
  /** Event-Daten im Relay löschen (Ende des Events, DSGVO). */
  cloudPurge: () => Promise<QaState>;
}

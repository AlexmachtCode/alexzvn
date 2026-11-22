// Datenmodell + IPC-Typen für JM Battle (Welle 3d, BattleRap-Toolkit).
//
// Zwei Kontrahenten A/B, mehrere Runden. Pro Runde entscheidet die Jury (A/B/
// Unentschieden) und das Publikum stimmt per QR/Handy ab (@jm/remote). Die
// VS-Bauchbinde wird über den Titler eingeblendet; Instant-Replay-Clips schneidet
// FFmpeg (@jm/media) aus einer Aufnahmedatei. Autoritativer Zustand im Main →
// auch per BATTLE-Steuerserver/Companion bedienbar.

import type { FernsteuerungMeldung } from './fernsteuerung';

export type Side = 'A' | 'B';

export interface Competitor {
  /** Künstlername. */
  name: string;
  /** Crew/Stadt (Bauchbinden-Unterzeile). */
  crew: string;
}

export interface RoundResult {
  /** 1-basiert. */
  round: number;
  /** Jury-Entscheid der Runde. */
  juryWinner: Side | 'tie' | null;
  votesA: number;
  votesB: number;
}

export interface BattleConfig {
  /** Anzahl Runden. */
  rounds: number;
  /** Publikums-Voting per QR möglich. */
  votingEnabled: boolean;
  /** VS-Bauchbinde (Titler) automatisch ein-/ausblenden. */
  autoTitler: boolean;
  /** Instant-Replay-Länge (letzte N Sekunden). */
  clipSeconds: number;
  /** Quell-Aufnahme für Clips (Operator wählt). */
  recordingPath: string;
  /** Ausgabeordner für Clips. */
  clipDir: string;
}

export interface ClipJob {
  id: string;
  status: 'running' | 'done' | 'error';
  outputPath: string;
  seconds: number;
  at: number;
  error?: string;
}

export interface BattleRemoteInfo {
  running: boolean;
  urls: string[];
}

/** Host/Port eines Tool-Steuer-Endpunkts. */
export interface Endpoint {
  host: string;
  port: number;
}

/** Verbindungsstatus eines gekoppelten Tools (titler). */
export interface ToolLink {
  role: string;
  label: string;
  host: string;
  port: number;
  connected: boolean;
  source: 'mdns' | 'manual';
  state: Record<string, string> | null;
}

export interface BattleState {
  config: BattleConfig;
  competitors: { A: Competitor; B: Competitor };
  /** Aktuelle Runde (1-basiert). */
  round: number;
  rounds: RoundResult[];
  /** Publikums-Voting der aktuellen Runde offen. */
  votingOpen: boolean;
  /** VS-Bauchbinde ist on air (Titler). */
  live: boolean;
  remote: BattleRemoteInfo;
  links: ToolLink[];
  overrides: Record<string, Endpoint>;
  /** Letzte Instant-Replay-Clips. */
  clips: ClipJob[];
}

/**
 * Master-Link-Meldung über die Preload-Brücke (UX Welle 1, Spec 3.9): Zustand des Clients oder `ohne-client`.
 * Strukturgleich mit `MasterLinkMeldung` aus `@jm/app-runtime`; eigener Typ, damit der Renderer kein Main-Paket lädt.
 * Den Gleichlauf prüft die Typprüfung des Preloads.
 */
export type MasterLinkMeldungZeile =
  | { art: 'aus' }
  | { art: 'sucht' }
  | { art: 'verbindet'; adresse: string }
  | { art: 'verbunden'; adresse: string; seit: number; masterName: string; suite: string }
  | { art: 'fehler'; code: string; text: string; errCode?: string }
  | { art: 'ohne-client' };

// ── Preload-API (window.jmbattle) ────────────────────────────────────────────
export interface JmBattleApi {
  platform: string;
  getState: () => Promise<BattleState>;
  onState: (cb: (s: BattleState) => void) => () => void;
  onLinks: (cb: (links: ToolLink[]) => void) => () => void;

  setCompetitor: (side: Side, patch: Partial<Competitor>) => Promise<BattleState>;
  swapCompetitors: () => Promise<BattleState>;

  nextRound: () => Promise<BattleState>;
  prevRound: () => Promise<BattleState>;
  gotoRound: (n: number) => Promise<BattleState>;
  setJuryWinner: (round: number, winner: Side | 'tie' | null) => Promise<BattleState>;
  setVotingOpen: (open: boolean) => Promise<BattleState>;
  clearVotes: (round: number) => Promise<BattleState>;
  setLive: (live: boolean) => Promise<BattleState>;
  reset: () => Promise<BattleState>;

  setConfig: (patch: Partial<BattleConfig>) => Promise<BattleState>;
  setRemote: (enabled: boolean) => Promise<BattleState>;
  setEndpoint: (role: string, host: string, port: number) => Promise<BattleState>;

  // Instant-Replay (FFmpeg-Clip aus der Aufnahmedatei)
  pickRecording: () => Promise<BattleState>;
  pickClipDir: () => Promise<BattleState>;
  clip: (seconds?: number) => Promise<BattleState>;

  // Status-Brücken (UX Welle 1, Spec 3.9), nur lesend
  /** Master-Link-Zustand; null, wenn der Handler fehlt oder ablehnt. */
  masterLink: () => Promise<MasterLinkMeldungZeile | null>;
  onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => () => void;
  /** Meldung des Steuerservers (Port 8734): null, solange Main noch nichts gemeldet hat. */
  fernsteuerung: () => Promise<FernsteuerungMeldung | null>;
  onFernsteuerung: (cb: (m: FernsteuerungMeldung | null) => void) => () => void;
}

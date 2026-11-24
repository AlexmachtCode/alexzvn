// TCP-Steuerserver des Players über das suite-weite Zeilenprotokoll
// (@jm/suite-control-protocol) — getrieben z. B. vom Bitfocus-Companion-Modul.
//
//   Client → Player:  PLAYER GO|PLAY|STOP|PAUSE|PANIC | PLAYER CUE <n> |
//                     PLAYER STANDBY <n> | PLAYER NEXT|PREV | PLAYER PAD <slot> |
//                     STATE?
//   Player → Client:  STATE ns=player playing=0|1 paused=0|1 standby=<n>
//                     standby_label=… cues=<n> playing_count=<n>
//
// Die Wiedergabe lebt im Renderer (Cue-Show + Soundboard, WebAudio). Befehle
// werden als RemoteCommand per IPC ('remote:cmd') ins Hauptfenster gepusht; der
// Renderer meldet seinen Zustand via IPC ('remote:reportState') zurück, den wir
// cachen + an alle Steuer-Clients broadcasten.
//
// mDNS: als Steuer-Endpunkt annonciert (controlEndpoint:true → TXT ctl=1, Name
// jm-player-ctl). Das Companion-Modul findet den Steuerport so per Auto-Discovery
// (manuelle Host:Port-Eingabe bleibt möglich).
import type { BrowserWindow } from 'electron';
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import { app } from 'electron';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import type { RemoteCommand, RemotePlayerState } from '@shared/types';
import type { FernsteuerungEreignis } from '@shared/fernsteuerung';

/** Eigener TCP-Steuerport (getrennt vom jmedia://-Protokoll/Output). */
export const CONTROL_PORT = 8725;

let server: SuiteControlServer | null = null;
let getWindow: (() => BrowserWindow | null) | null = null;
let lastState: RemotePlayerState = {
  playing: false,
  paused: false,
  standby: 0,
  standbyLabel: '-',
  cues: 0,
  playingCount: 0,
};

function toSuiteState(s: RemotePlayerState = lastState): SuiteState {
  return {
    ns: 'player',
    kv: {
      playing: s.playing,
      paused: s.paused,
      standby: s.standby,
      standby_label: s.standbyLabel,
      cues: s.cues,
      playing_count: s.playingCount,
    },
  };
}

/**
 * SuiteCommand (ns=player) → RemoteCommand für den Renderer. null bei Unbekanntem.
 * `raw` = ungeparste Zeile (für `show`, dessen Argument ein Show-Name mit
 * Leerzeichen sein kann — der Token-Parser würde ihn sonst zerlegen).
 */
function toRemoteCommand(cmd: SuiteCommand, raw: string): RemoteCommand | null {
  const num = (i: number): number => Number(cmd.args[i]);
  switch (cmd.verb) {
    case 'go':
    case 'play':
      return { t: 'go' };
    case 'stop':
      return { t: 'stop' };
    case 'pause':
      return { t: 'pause' };
    case 'panic':
      return { t: 'panic' };
    case 'cue':
      return Number.isFinite(num(0)) ? { t: 'cue', n: Math.trunc(num(0)) } : null;
    case 'standby':
      return Number.isFinite(num(0)) ? { t: 'standby', n: Math.trunc(num(0)) } : null;
    case 'next':
      return { t: 'next' };
    case 'prev':
      return { t: 'prev' };
    case 'pad':
      return Number.isFinite(num(0)) ? { t: 'pad', slot: Math.trunc(num(0)) } : null;
    case 'show': {
      // Show-Name (oder DB-ID) aus der rohen Zeile — kann Leerzeichen enthalten.
      const show = raw.replace(/^\s*player\s+show\s+/i, '').trim();
      return show ? { t: 'loadShow', show } : null;
    }
    default:
      return null;
  }
}

export function startControlServer(
  getWin: () => BrowserWindow | null,
  /**
   * UX Welle 2a (Spec 3.9): Statusmeldung des Servers (läuft, Port, Clients) mit wirksamem Modus, nur lesend.
   * Der Main macht daraus die Fernsteuerungs-Meldung für die Statusleiste.
   */
  onMeldung?: (e: FernsteuerungEreignis) => void,
): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopControlServer();
  getWindow = getWin;
  // Der Modus der Meldung kommt aus der meldenden Instanz (Rückspiel Task 26, Regel aus Task 21), nicht aus der Modulvariable.
  const srv = new SuiteControlServer({
    appDataDir: app.getPath('appData'),
    role: 'player',
    appId: 'jm-player',
    controlEndpoint: true,
    getState: () => toSuiteState(),
    onStatus: (st) => {
      onMeldung?.({ art: 'status', ...st, modus: srv.modus() });
    },
    onCommand: (cmd, ctx) => {
      if (cmd.ns !== 'player') return;
      const rc = toRemoteCommand(cmd, ctx.raw);
      if (!rc) return;
      const win = getWindow?.();
      if (win && !win.isDestroyed()) win.webContents.send('remote:cmd', rc);
    },
  });
  server = srv;
  return server.start(CONTROL_PORT);
}

export function stopControlServer(): void {
  if (server) {
    server.stop();
    server = null;
  }
}

/** Renderer meldet neuen Wiedergabe-Zustand → cachen + an alle Clients broadcasten. */
export function updatePlayerState(state: RemotePlayerState): void {
  lastState = state;
  server?.pushState(toSuiteState(state));
}

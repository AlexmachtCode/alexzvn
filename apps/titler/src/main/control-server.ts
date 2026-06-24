// TCP-Steuerserver des Titlers über das suite-weite Zeilenprotokoll
// (@jm/suite-control-protocol) — getrieben z. B. vom Bitfocus-Companion-Modul.
//
//   Client → Titler:  TITLER TAKE | TITLER CLEAR | TITLER TOGGLE |
//                     TITLER TEMPLATE lowerthird|banner|ticker | STATE?
//   Titler → Client:  STATE ns=titler on_air=0|1 template=… ndi=0|1 connections=<n>
//
// Take/Clear ist Live-Zustand im Renderer (engine.ts). Befehle werden per IPC
// ('titler:remote-cmd') ins Hauptfenster gepusht; der Renderer meldet seinen
// Zustand via IPC ('titler:report-state') zurück, den wir cachen + broadcasten.
//
// mDNS: als Steuer-Endpunkt annonciert (controlEndpoint:true → TXT ctl=1, Name
// jm-titler-ctl). Das Companion-Modul findet den Steuerport so per Auto-Discovery
// (manuelle Host:Port-Eingabe bleibt möglich).
import type { BrowserWindow } from 'electron';
import { getLog } from '@jm/app-runtime';
import { SuiteControlServer } from '@jm/suite-control-protocol/server';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import type { TemplateKind, TitlerRemoteCommand, TitlerRemoteState } from '@shared/types';

/** Eigener TCP-Steuerport. */
export const CONTROL_PORT = 8726;

const TEMPLATES = new Set<TemplateKind>(['lowerthird', 'banner', 'ticker']);

let server: SuiteControlServer | null = null;
let getWindow: (() => BrowserWindow | null) | null = null;
let lastState: TitlerRemoteState = {
  onAir: false,
  template: 'lowerthird',
  ndiActive: false,
  connections: 0,
};

function toSuiteState(s: TitlerRemoteState = lastState): SuiteState {
  return {
    ns: 'titler',
    kv: { on_air: s.onAir, template: s.template, ndi: s.ndiActive, connections: s.connections },
  };
}

/** SuiteCommand (ns=titler) → TitlerRemoteCommand. null bei Unbekanntem. */
function toRemoteCommand(cmd: SuiteCommand): TitlerRemoteCommand | null {
  switch (cmd.verb) {
    case 'take':
      return { t: 'take' };
    case 'clear':
      return { t: 'clear' };
    case 'toggle':
      return { t: 'toggle' };
    case 'template': {
      const kind = (cmd.args[0] ?? '').toLowerCase() as TemplateKind;
      return TEMPLATES.has(kind) ? { t: 'template', kind } : null;
    }
    default:
      return null;
  }
}

export function startControlServer(
  getWin: () => BrowserWindow | null,
  onClients?: (clients: number) => void,
): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopControlServer();
  getWindow = getWin;
  server = new SuiteControlServer({
    role: 'titler',
    appId: 'jm-titler',
    controlEndpoint: true,
    getState: () => toSuiteState(),
    onCommand: (cmd) => {
      if (cmd.ns !== 'titler') return;
      const rc = toRemoteCommand(cmd);
      if (!rc) return;
      const win = getWindow?.();
      if (win && !win.isDestroyed()) win.webContents.send('titler:remote-cmd', rc);
    },
    // Verbundene Suite-Steuerclients (Companion/QA/Battle/Health-Dashboard) → UI.
    onStatus: (st) => onClients?.(st.clients),
    onAdvertiseError: (err) =>
      getLog().warn(`Titler-Steuerserver: mDNS-Annoncierung fehlgeschlagen: ${err.message}`),
  });
  return server.start(CONTROL_PORT);
}

export function stopControlServer(): void {
  if (server) {
    server.stop();
    server = null;
  }
}

/** Renderer meldet neuen Live-Zustand → cachen + an alle Clients broadcasten. */
export function updateTitlerState(state: TitlerRemoteState): void {
  lastState = state;
  server?.pushState(toSuiteState(state));
}

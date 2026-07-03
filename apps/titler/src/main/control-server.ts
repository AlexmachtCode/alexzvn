// TCP-Steuerserver des Titlers über das suite-weite Zeilenprotokoll
// (@jm/suite-control-protocol) — getrieben z. B. vom Bitfocus-Companion-Modul.
//
//   Client → Titler:  TITLER TAKE | TITLER CLEAR | TITLER TOGGLE |
//                     TITLER TEMPLATE lowerthird|banner|ticker|graphic | TITLER TEXT … |
//                     TITLER GRAPHIC <nr|name> | TITLER SLOT <key> <text> |
//                     TITLER RECALL <nr|name> | TITLER NEXT|PREV | STATE?
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
import { app } from 'electron';
import type { SuiteCommand, SuiteState } from '@jm/suite-control-protocol';
import type { TemplateKind, TitlerRemoteCommand, TitlerRemoteState } from '@shared/types';

/** Eigener TCP-Steuerport. */
export const CONTROL_PORT = 8726;

const TEMPLATES = new Set<TemplateKind>(['lowerthird', 'banner', 'ticker', 'graphic']);

/**
 * Token aus dem `TITLER TEXT`-Verb dekodieren: das Zeilenprotokoll trennt an
 * Leerzeichen, daher kodiert der Sender (z. B. Q&A) Leerzeichen als `_` und ein
 * leeres Feld als `-`. Vgl. apps/qa encodeToken().
 */
function decodeToken(s: string): string {
  if (!s || s === '-') return '';
  return s.replace(/_/g, ' ').trim();
}

let server: SuiteControlServer | null = null;
let getWindow: (() => BrowserWindow | null) | null = null;
let lastState: TitlerRemoteState = {
  onAir: false,
  template: 'lowerthird',
  ndiActive: false,
  connections: 0,
};
/** DataLink-Eintragsinfo (Main-Zustand) → in den STATE-Push für Companion. */
let dataInfo = { entry: '', entryIndex: 0, entryCount: 0 };

function toSuiteState(): SuiteState {
  return {
    ns: 'titler',
    kv: {
      on_air: lastState.onAir,
      template: lastState.template,
      ndi: lastState.ndiActive,
      connections: lastState.connections,
      entry: dataInfo.entry,
      entry_index: dataInfo.entryIndex,
      entry_count: dataInfo.entryCount,
    },
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
    case 'text':
      // TITLER TEXT <name> <untertitel> — Tokens whitespace-frei (siehe decodeToken).
      return { t: 'text', name: decodeToken(cmd.args[0] ?? ''), subtitle: decodeToken(cmd.args[1] ?? '') };
    case 'graphic':
      // TITLER GRAPHIC <nr|name|id> — Grafik-Vorlage wählen (#162). Name darf Leerzeichen tragen.
      return { t: 'graphic', ref: cmd.args.join(' ').trim() };
    case 'slot':
      // TITLER SLOT <key> <text> — Slot-Text setzen (#162). Text-Token whitespace-frei.
      return { t: 'slot', key: (cmd.args[0] ?? '').trim(), text: decodeToken(cmd.args[1] ?? '') };
    case 'recall':
      // TITLER RECALL <nr|name> — Name darf Leerzeichen enthalten (Args wieder fügen).
      return { t: 'recall', ref: cmd.args.join(' ').trim() };
    case 'next':
      return { t: 'next' };
    case 'prev':
      return { t: 'prev' };
    default:
      return null;
  }
}

export function startControlServer(
  getWin: () => BrowserWindow | null,
  onClients?: (clients: number) => void,
  // Im Main behandelte Befehle (DataLink-Recall/Next/Prev): liefert true, wenn
  // erledigt → dann NICHT zusätzlich an den Renderer pushen.
  onLocal?: (rc: TitlerRemoteCommand) => boolean,
): Promise<{ ok: boolean; error?: string; port?: number }> {
  stopControlServer();
  getWindow = getWin;
  server = new SuiteControlServer({
    appDataDir: app.getPath('appData'),
    role: 'titler',
    appId: 'jm-titler',
    controlEndpoint: true,
    getState: () => toSuiteState(),
    onCommand: (cmd) => {
      if (cmd.ns !== 'titler') return;
      const rc = toRemoteCommand(cmd);
      if (!rc) return;
      if (onLocal?.(rc)) return;
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
  server?.pushState(toSuiteState());
}

/** DataLink-Eintragsinfo (aktiver Eintrag) → cachen + broadcasten (Companion-STATE). */
export function updateTitlerData(info: { entry: string; entryIndex: number; entryCount: number }): void {
  dataInfo = info;
  server?.pushState(toSuiteState());
}

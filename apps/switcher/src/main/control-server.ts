// TCP-Steuerserver (Slice 6): Fernsteuerung des Switchers über das suite-weite
// Zeilenprotokoll @jm/suite-control-protocol — getrieben z. B. vom Bitfocus-
// Companion-Modul.
//
//   Client → Switcher: PREVIEW/PROGRAM/CUT/AUTO/RECORD/STREAM/STATE?
//   Switcher → Client: STATE ns=switcher … (auf Verbindung, bei jeder Änderung)
//
// Der eigentliche Zustand lebt im Renderer (Engine/Output). Befehle werden per
// IPC dorthin geschickt; der Renderer meldet seinen Zustand via pushState()
// zurück, den wir cachen + an alle Clients broadcasten.
//
// Implementiert als dünner Wrapper um SuiteControlServer (geteilte Server-Logik
// für die ganze Suite). Die exportierten Funktionen bleiben unverändert, damit
// ipc.ts und index.ts nicht angefasst werden müssen. Das gesendete STATE-Format
// (`ns=switcher` + program/preview/…) ist rückwärtskompatibel zum alten
// Companion-Modul (liest die Felder per Schlüssel, ignoriert ns).
import type { BrowserWindow } from 'electron';
import { app } from 'electron';
import { naechsteFernsteuerung, meldungZuControlStatus, type FernsteuerungEreignis, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { ControlStatus } from '@shared/types';
import {
  parseCommand,
  switcherStateToSuite,
  type ControlCommand,
  type SwitcherStateMsg,
} from '@jm/suite-control-protocol';
import { erzeugeHalter } from './steuerserver-halter';

/** Der Steuerserver (Start, Stopp, aktueller Server); nur sein aktueller Server meldet Statuswechsel. */
const halter = erzeugeHalter();
let targetWindow: BrowserWindow | null = null;
let lastState: SwitcherStateMsg = {
  program: 0,
  preview: 0,
  recording: false,
  streaming: false,
  scenes: 0,
};

// UX Welle 1 (Spec 3.9, nur lesend): Die aktuelle Fernsteuerungs-Meldung. Sie wird aus jedem Statuswechsel des Servers,
// dem Start-Ergebnis und einem Wurf fortgeschrieben und als erweiterte ControlStatus (mit modus/fehler) gesendet.
let meldung: FernsteuerungMeldung | undefined;

export function attachControlWindow(win: BrowserWindow): void {
  targetWindow = win;
}

/** Aktueller Status; solange nichts gemeldet wurde, der Grundwert (der Renderer liest ihn als „unbekannt“). */
export function controlStatus(): ControlStatus {
  if (meldung) return meldungZuControlStatus(meldung);
  return halter.aktuell()?.status() ?? { running: false, port: 0, clients: 0 };
}

/** Meldung fortschreiben und an den Renderer senden. */
export function meldeFernsteuerung(e: FernsteuerungEreignis): void {
  meldung = naechsteFernsteuerung(meldung, e);
  send('control:status', meldungZuControlStatus(meldung));
}

// Beim Beenden räumt stopControlServer() auf, während das Fenster schon zerstört
// ist (Socket-close/notifyStatus feuern dann noch). `?.` schützt nur gegen null,
// nicht gegen ein zerstörtes webContents → sonst „Object has been destroyed".
function send(channel: string, payload: unknown): void {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  const wc = targetWindow.webContents;
  if (!wc.isDestroyed()) wc.send(channel, payload);
}

function startControlServer(
  port: number,
  // UX Welle 1 (Spec 3.9): ganze Statusmeldung mit wirksamem Modus, nur lesend.
  onMeldung: (e: FernsteuerungEreignis) => void,
): Promise<{ ok: boolean; error?: string; port?: number }> {
  return halter.starte({
    appDataDir: app.getPath('appData'),
    role: 'switcher',
    appId: 'jm-switcher',
    getState: () => switcherStateToSuite(lastState),
    onCommand: (_cmd, ctx) => {
      // Auf die bestehende, vom Renderer erwartete ControlCommand-Form mappen
      // (Legacy-Parser auf der Rohzeile). STATE? beantwortet der Server selbst.
      const legacy = parseCommand(ctx.raw);
      if (legacy && legacy.type !== 'queryState') send('control:command', legacy as ControlCommand);
    },
  }, port, onMeldung);
}

/**
 * Start mit Meldung: Status jedes Wechsels, danach das Start-Ergebnis, bei einem Wurf der Fehlertext (der Wurf wird
 * weitergereicht wie bisher). Ablauf und Rückgabe von startControlServer bleiben gleich.
 */
export async function startControlServerGemeldet(port: number): Promise<{ ok: boolean; error?: string; port?: number }> {
  try {
    const r = await startControlServer(port, meldeFernsteuerung);
    meldeFernsteuerung({ art: 'start', ok: r.ok, error: r.error, port });
    return r;
  } catch (err) {
    meldeFernsteuerung({ art: 'wurf', text: (err as Error).message });
    throw err;
  }
}

export function stopControlServer(): void {
  halter.stoppe();
}

/** Renderer meldet neuen Zustand → cachen + an alle Clients broadcasten. */
export function pushState(state: SwitcherStateMsg): void {
  lastState = state;
  halter.aktuell()?.pushState(switcherStateToSuite(state));
}

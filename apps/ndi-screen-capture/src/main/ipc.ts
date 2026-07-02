import { ipcMain, type BrowserWindow } from 'electron';
import { hostname } from 'node:os';
import type { JmNdiSource, JmNdiStartOptions, JmNdiStatus, TraySettings } from '@shared/types';
import { IPC } from '@shared/ipc';
import { listSources } from './sources';
import { armCapture, disarmCapture } from './capture-handler';
import { startSender, stopSender } from './ndi/sender-process';
import { setTrayStatus, setTraySettings } from './tray';

let status: JmNdiStatus = { sendState: 'idle', audioEnabled: false };

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const pushStatus = (): void => {
    getWindow()?.webContents.send(IPC.status, status);
    setTrayStatus(status); // #104: Tray-Menü spiegelt den Status
  };

  // #104: Renderer meldet seine aktuellen Einstellungen fürs Tray-Menü.
  ipcMain.on(IPC.traySync, (_e, settings: TraySettings) => setTraySettings(settings));

  ipcMain.handle(IPC.listSources, (): Promise<JmNdiSource[]> => listSources());

  ipcMain.handle(IPC.start, async (_event, opts: JmNdiStartOptions): Promise<void> => {
    // Quelle für getDisplayMedia() im Renderer vormerken …
    armCapture(opts);
    const name = (await listSources()).find((s) => s.id === opts.sourceId)?.name ?? 'Aufnahme';
    const ndiSourceName = `JM Capture (${hostname()}) - ${name}`;

    // … und den nativen NDI-Sender (utilityProcess) starten. Lädt @jm/ndi; ohne
    // gebautes Addon bleibt er still (kein Crash) → Renderer-Vorschau läuft trotzdem.
    // Der Stat-Callback aktualisiert laufend die Empfängerzahl in der Statusleiste.
    const win = getWindow();
    if (win) {
      startSender(win, ndiSourceName, (connections) => {
        status = { ...status, connections };
        pushStatus();
      });
    }

    status = { sendState: 'sending', audioEnabled: opts.audio, ndiSourceName };
    pushStatus();
  });

  ipcMain.handle(IPC.stop, async (): Promise<void> => {
    disarmCapture();
    stopSender();
    status = { sendState: 'idle', audioEnabled: status.audioEnabled };
    pushStatus();
  });

  ipcMain.handle(IPC.getStatus, (): Promise<JmNdiStatus> => Promise.resolve(status));
}

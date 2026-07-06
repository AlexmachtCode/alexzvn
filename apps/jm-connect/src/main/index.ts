import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { initAppRuntime } from '@jm/app-runtime';
import { createMainWindow, getMainWindow, resourcePath, setupSingleInstance } from '@jm/electron-kit';
import { IPC } from '@shared/ipc';
import type { TrayCommand } from '@shared/types';
import { registerIpc, notifyStatusChanged, currentStatus } from './ipc';
import { initNdiGuests, tearDownAll } from './ndi-guests';
import { createPeerWindow, destroyPeerWindow, getPeerWindow } from './peer-window';
import { startControlServer, stopControlServer } from './control-server';
import { createTray, destroyTray, setTrayStatus } from './tray';

declare const __dirname: string;

let isQuitting = false;

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
initAppRuntime({ csp: true, appId: 'jm-connect', appName: 'JM Connect' });

const preloadPath = join(__dirname, '../preload/index.cjs');

function iconPath(): string {
  return resourcePath('icon.png', join(__dirname, '..', '..', 'resources'));
}

function createWindow(): BrowserWindow {
  const win = createMainWindow({
    title: 'JM Connect',
    preloadPath,
    sandbox: true,
    iconPath: iconPath(),
    rendererUrl: process.env['ELECTRON_RENDERER_URL'],
    rendererFile: join(__dirname, '../renderer/index.html'),
  });
  // Schließen versteckt nur ins Tray (Zuschaltungen/NDI laufen weiter), außer beim Beenden.
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
  return win;
}

function showOrCreateWindow(): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  } else {
    createWindow();
  }
}

if (setupSingleInstance(() => showOrCreateWindow())) {
  app.whenReady().then(async () => {
    // Versteckter WebRTC-Peer (Medien) — vor dem NDI-Pool, der ihm Frame-Ports gibt.
    createPeerWindow(preloadPath);
    initNdiGuests({ getPeer: () => getPeerWindow(), onChange: () => notifyStatusChanged() });

    registerIpc({
      getWindow: () => getMainWindow(),
      getPeer: () => getPeerWindow(),
      onStatusChange: (s) => setTrayStatus(s),
    });

    // Steuerprotokoll (Companion/Rundown): Befehle an den Operator-Renderer relayen,
    // der sie über die Raum-WS an den DO schickt.
    const res = await startControlServer({
      onCommand: (cmd) => getMainWindow()?.webContents.send(IPC.controlCommand, { verb: cmd.verb, args: cmd.args }),
    });
    if (!res.ok) console.error('[control] Steuerserver-Start fehlgeschlagen:', res.error);

    createWindow();
    createTray({
      iconPath: iconPath(),
      getWindow: () => getMainWindow(),
      sendCommand: (cmd: TrayCommand) => getMainWindow()?.webContents.send(IPC.trayCommand, cmd),
      onQuit: () => {
        isQuitting = true;
        app.quit();
      },
    });
    setTrayStatus(currentStatus());

    app.on('activate', () => showOrCreateWindow());
  });

  // Fenster-Schließen beendet die App NICHT — sie läuft im Tray weiter (NDI-Versand).
  app.on('window-all-closed', () => {
    // absichtlich leer: Hintergrundbetrieb via Tray
  });

  app.on('before-quit', () => {
    isQuitting = true;
    tearDownAll();
    destroyPeerWindow();
    stopControlServer();
    destroyTray();
  });
}

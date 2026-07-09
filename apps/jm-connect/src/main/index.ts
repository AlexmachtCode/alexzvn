import { app, BrowserWindow, session } from 'electron';
import { join } from 'node:path';
import { initAppRuntime } from '@jm/app-runtime';
import { createMainWindow, getMainWindow, resourcePath, setupSingleInstance } from '@jm/electron-kit';
import { IPC } from '@shared/ipc';
import type { TrayCommand } from '@shared/types';
import { registerIpc, notifyStatusChanged, currentStatus } from './ipc';
import { initNdiGuests, tearDownAll } from './ndi-guests';
import { initNdiProgram, stopProgram } from './ndi-program';
import { createPeerWindow, destroyPeerWindow, getPeerWindow } from './peer-window';
import { startControlServer, stopControlServer } from './control-server';
import { createTray, destroyTray, setTrayStatus } from './tray';
import { handleShowDeepLink } from './show-open';
import { startPresenterLink, stopPresenterLink } from './presenter-link';

declare const __dirname: string;

let isQuitting = false;

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence. Ein Show-Deep-Link liefert
// die Sprecher-Liste der Veranstaltung (iveo, Welle 6.3b) → Join-Links/QR mit einem Klick.
const runtime = initAppRuntime({
  csp: true,
  appId: 'jm-connect',
  appName: 'JM Connect',
  onDeepLink: (url) => void handleShowDeepLink(url),
});

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
    // Der versteckte Peer öffnet fürs Talkback (6.2c) das Regie-Mikro. Ohne diese Freigabe lehnt
    // Chromium getUserMedia im file://-Kontext des gepackten Builds ab (wie in caption/sync).
    // Nur `media` — alles andere bleibt verwehrt.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media'));
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

    // Versteckter WebRTC-Peer (Medien) — vor dem NDI-Pool, der ihm Frame-Ports gibt.
    createPeerWindow(preloadPath);
    initNdiGuests({ getPeer: () => getPeerWindow(), onChange: () => notifyStatusChanged() });
    // Programm-Rückkanal-Empfang (Welle 6.2a): Status-Änderungen an die Operator-UI/Tray.
    initNdiProgram({ getPeer: () => getPeerWindow(), onStatus: () => notifyStatusChanged() });

    registerIpc({
      getWindow: () => getMainWindow(),
      getPeer: () => getPeerWindow(),
      onStatusChange: (s) => setTrayStatus(s),
    });

    // Folien-Kopplung (6.3c): JM Presenter im LAN suchen, damit ein freigegebener Remote-Sprecher
    // seine Folien selbst weiterblättern kann.
    startPresenterLink({ onChange: () => notifyStatusChanged() });

    // Steuerprotokoll (Companion/Rundown): Befehle an den Operator-Renderer relayen,
    // der sie über die Raum-WS an den DO schickt.
    const res = await startControlServer({
      onCommand: (cmd) => getMainWindow()?.webContents.send(IPC.controlCommand, { verb: cmd.verb, args: cmd.args }),
    });
    if (!res.ok) console.error('[control] Steuerserver-Start fehlgeschlagen:', res.error);

    createWindow();
    // Kaltstart: die App wurde direkt mit einem Show-Deep-Link geöffnet.
    if (runtime.initialDeepLink) void handleShowDeepLink(runtime.initialDeepLink);
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
    stopProgram();
    destroyPeerWindow();
    stopControlServer();
    stopPresenterLink();
    destroyTray();
  });
}

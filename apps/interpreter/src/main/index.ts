// JM Interpreter (#164): Floor/Dolmetscher-Ducking, Einspeisung in Zoom/Webex.
//
// Der Main-Prozess ist bewusst dünn — die gesamte Audio-Kette lebt im Renderer (Web Audio).
// Keine nativen Abhängigkeiten: die App ist dadurch in CI baubar, anders als die NDI-/Audio-Tools.
import { app, session } from 'electron';
import { join } from 'node:path';
import { initAppRuntime } from '@jm/app-runtime';
import { createMainWindow, getMainWindow, resourcePath, setupSingleInstance } from '@jm/electron-kit';

declare const __dirname: string;

initAppRuntime({ csp: true, appId: 'jm-interpreter', appName: 'JM Interpreter' });

const preloadPath = join(__dirname, '../preload/index.cjs');

function iconPath(): string {
  return resourcePath('icon.png', join(__dirname, '..', '..', 'resources'));
}

function createWindow(): void {
  createMainWindow({
    title: 'JM Interpreter',
    preloadPath,
    sandbox: true,
    iconPath: iconPath(),
    rendererUrl: process.env['ELECTRON_RENDERER_URL'],
    rendererFile: join(__dirname, '../renderer/index.html'),
    width: 1100,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    // Die Ducking-Regelschleife läuft im Renderer. Chromium würde ihren Timer drosseln, sobald
    // das Fenster verdeckt oder minimiert ist — der O-Ton bliebe dann abgesenkt (oder offen)
    // stehen, während die Konferenz weiterläuft. Ein Live-Pfad darf nicht schlafen.
    backgroundThrottling: false,
  });
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
  app.whenReady().then(() => {
    // Mikrofon-Zugriff für getUserMedia im Renderer (Muster aus caption/sync). Nur `media`.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media'));
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

    createWindow();
    app.on('activate', () => showOrCreateWindow());
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

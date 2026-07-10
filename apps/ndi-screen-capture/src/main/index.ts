import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { initAppRuntime } from '@jm/app-runtime';
import { createMainWindow, getMainWindow, resourcePath, setupSingleInstance } from '@jm/electron-kit';
import { IPC } from '@shared/ipc';
import type { TrayCommand } from '@shared/types';
import { registerIpc } from './ipc';
import { installDisplayMediaHandler } from './capture-handler';
import { createTray, destroyTray } from './tray';

declare const __dirname: string;

// #104: Beim Fenster-Schließen läuft die App im System-Tray weiter (NDI-Versand
// bleibt aktiv). Nur „Beenden" im Tray beendet wirklich — dann muss das Fenster
// schließen dürfen (isQuitting).
let isQuitting = false;

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
initAppRuntime({ csp: true, appId: 'jm-ndi-screen-capture', appName: 'JM NDI Screen Capture' });

// Windows: Das neue Windows-Graphics-Capture-Backend (WGC) scheitert auf manchen
// Systemen (Hybrid-GPU/Treiber/Sitzung) mit E_FAIL/E_INVALIDARG → die Aufnahme
// liefert keine Frames und Bild (Vorschau + NDI) bleibt schwarz. Wir schalten WGC
// ab (Chromium fällt auf DXGI/GDI zurück) und deaktivieren zusätzlich die GPU-
// Beschleunigung, damit der robuste Software-Desktop-Capturer greift. Die WGC-
// Feature-Namen variieren je Chromium-Version → alle bekannten Varianten setzen.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch(
    'disable-features',
    [
      'WebRtcAllowWgcScreenCapturer',
      'WebRtcAllowWgcWindowCapturer',
      'WebRtcAllowWgcDesktopCapturer',
      'AllowWgcScreenCapturer',
      'AllowWgcWindowCapturer',
    ].join(','),
  );
  app.disableHardwareAcceleration();
}

const preloadPath = join(__dirname, '../preload/index.cjs');

function iconPath(): string {
  return resourcePath('icon.png', join(__dirname, '..', '..', 'resources'));
}

function createWindow(): BrowserWindow {
  const win = createMainWindow({
    title: 'JM NDI Screen Capture',
    preloadPath,
    // P2 (#60): Renderer-Sandbox. Preload nutzt contextBridge/ipcRenderer + reicht
    // den NDI-Frame-MessagePort per window.postMessage(…, e.ports) durch — dieser
    // Transfer ist der unter Sandbox zu prüfende Punkt.
    sandbox: true,
    iconPath: iconPath(),
    // Diese App ist auf Hintergrundbetrieb ausgelegt (Schließen versteckt ins Tray, s. u.) und sendet
    // dabei weiter NDI. Der Capture-Strom selbst ist medien- statt timer-getrieben, aber der Weg
    // onFrame → copyTo → postMessage läuft im Renderer-Loop; ohne diesen Flag könnte Chromium ihn im
    // verborgenen Fenster drosseln. Hält die dokumentierte Zusage „läuft weiter" ein.
    backgroundThrottling: false,
    rendererUrl: process.env['ELECTRON_RENDERER_URL'],
    rendererFile: join(__dirname, '../renderer/index.html'),
  });
  // #104: Schließen versteckt nur ins Tray (Hintergrundbetrieb), außer beim Beenden.
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
  return win;
}

/** Fenster zeigen (aus dem Tray heraus) oder erstmalig erstellen. */
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
    installDisplayMediaHandler();
    registerIpc(() => getMainWindow());
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

    app.on('activate', () => showOrCreateWindow());
  });

  // #104: Fenster-Schließen beendet die App NICHT — sie läuft im Tray weiter.
  // Beendet wird nur über das Tray-Menü („Beenden").
  app.on('window-all-closed', () => {
    // absichtlich leer: Hintergrundbetrieb via Tray
  });

  app.on('before-quit', () => {
    isQuitting = true;
    destroyTray();
  });
}

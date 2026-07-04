import { app, BrowserWindow, protocol } from 'electron';
import { join } from 'node:path';
import { createMainWindow, getMainWindow, resourcePath, setupSingleInstance } from '@jm/electron-kit';
import { initAppRuntime } from '@jm/app-runtime';
import { MEDIA_SCHEME } from '@shared/media-url';
import { registerIpc } from './ipc';
import { registerMediaProtocol } from './media-protocol';
import { startControlServer, stopControlServer } from './control-server';
import { setupMixerWindow, closeMixerWindow } from './mixer-window';
import { handleShowDeepLink } from './show-open';

declare const __dirname: string;

const preloadPath = join(__dirname, '../preload/index.cjs');

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
const runtime = initAppRuntime({
  appId: 'jm-daw',
  appName: 'JM DAW',
  // P2 (#60): CSP. Medien laufen über das privilegierte jm-media://-Schema
  // (bypassCSP) — wir whitelisten es zusätzlich explizit, damit auch der
  // fetch(mediaUrl())-Pfad (connect-src) unabhängig vom bypassCSP-Verhalten trägt.
  csp: { connectSrc: ['jm-media:'], imgSrc: ['jm-media:'], mediaSrc: ['jm-media:'] },
  // Per Show gestartet? Das referenzierte .jmdaw-Projekt automatisch laden (C3).
  onDeepLink: (url) => void handleShowDeepLink(url),
});

// Schema vor app.whenReady() freischalten (Pflicht für protocol.handle).
protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
      bypassCSP: true,
    },
  },
]);

function createWindow(): BrowserWindow {
  return createMainWindow({
    title: 'JM DAW',
    preloadPath,
    // P2 (#60): Renderer-Sandbox. Preload nutzt nur contextBridge/ipcRenderer/webUtils.
    sandbox: true,
    iconPath: resourcePath('icon.png', join(__dirname, '..', '..', 'resources')),
    rendererUrl: process.env['ELECTRON_RENDERER_URL'],
    rendererFile: join(__dirname, '../renderer/index.html'),
    width: 1480,
    height: 920,
    minWidth: 1120,
    minHeight: 700,
  });
}

if (setupSingleInstance(() => createWindow())) {
  app.whenReady().then(() => {
    registerMediaProtocol();
    registerIpc(() => getMainWindow());
    // Mixer-Popout-Fenster (#95) + Relais Host↔Popout.
    setupMixerWindow({
      getHost: () => getMainWindow(),
      preloadPath,
      rendererUrl: process.env['ELECTRON_RENDERER_URL'],
      rendererFile: join(__dirname, '../renderer/index.html'),
      iconPath: resourcePath('icon.png', join(__dirname, '..', '..', 'resources')),
    });
    createWindow();
    // Kaltstart: App direkt mit Show-Deep-Link geöffnet → Projekt jetzt laden.
    if (runtime.initialDeepLink) void handleShowDeepLink(runtime.initialDeepLink);
    // TCP-Steuerserver (suite-weites Protokoll) für Companion u. a. — Befehle
    // gehen per IPC an den Renderer, der seinen Zustand zurückmeldet.
    void startControlServer(() => getMainWindow());

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('before-quit', () => {
    stopControlServer();
    closeMixerWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

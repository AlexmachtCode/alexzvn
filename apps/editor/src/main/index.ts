import { app, BrowserWindow, protocol } from 'electron';
import { join } from 'node:path';
import { initAppRuntime } from '@jm/app-runtime';
import { createMainWindow, getMainWindow, resourcePath, setupSingleInstance } from '@jm/electron-kit';
import { MEDIA_SCHEME } from '@shared/media-url';
import { registerIpc } from './ipc';
import { registerMediaProtocol } from './media-protocol';
import { handleShowDeepLink } from './show-open';

declare const __dirname: string;

const preloadPath = join(__dirname, '../preload/index.cjs');

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
    title: 'JM Editor',
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

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
// onDeepLink fängt Show-Links bei laufender App (second-instance/open-url) ab;
// den Start-Link verarbeiten wir unten über runtime.initialDeepLink.
const runtime = initAppRuntime({
  appId: 'jm-editor',
  appName: 'JM Editor',
  // P2 (#60): CSP. Medien laufen über das privilegierte jm-media://-Schema
  // (bypassCSP) — wir whitelisten es zusätzlich explizit, damit auch der
  // fetch(mediaUrl())-Pfad (connect-src) unabhängig vom bypassCSP-Verhalten trägt.
  csp: { connectSrc: ['jm-media:'], imgSrc: ['jm-media:'], mediaSrc: ['jm-media:'] },
  onDeepLink: (url) => void handleShowDeepLink(url),
});

if (setupSingleInstance(() => createWindow())) {
  app.whenReady().then(() => {
    registerMediaProtocol();
    registerIpc(() => getMainWindow());
    createWindow();
    // Start-Deep-Link (App per Show gestartet) verarbeiten — lädt das in der
    // .jmshow referenzierte .jmedit-Dokument.
    if (runtime.initialDeepLink) void handleShowDeepLink(runtime.initialDeepLink);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

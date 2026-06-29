import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { createMainWindow, getMainWindow, resourcePath, setupSingleInstance } from '@jm/electron-kit';
import { initAppRuntime } from '@jm/app-runtime';
import { parseShowDeepLink } from '@jm/show';
import type { AppEvent } from '@shared/types';
import { registerIpc } from './ipc';
import { initManifest, refreshManifest } from './manifest';
import { initChangelog, refreshChangelog } from './changelog';
import { initCookbook, refreshCookbook } from './cookbook';
import { startPresenceHub } from './presence';
import { startHealth } from './health';
import { openShow } from './show';

declare const __dirname: string;

const preloadPath = join(__dirname, '../preload/index.cjs');

// Geteilter Runtime-Layer. Der Launcher ist der Hub: er besitzt das
// jmps://-Protokoll (registerProtocol) und sendet selbst keinen Heartbeat.
const runtime = initAppRuntime({ csp: true,
  appId: 'jm-launcher',
  appName: 'JM Production Suite',
  registerProtocol: true,
  presence: false,
  onDeepLink: (url) => handleDeepLink(url),
});

// jmps://open?show=<pfad> → Show öffnen und ihre Tools koordiniert starten.
function handleDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) {
    runtime.log.info(`deep-link (ohne Show) empfangen: ${url}`);
    return;
  }
  void openShow(showPath).then((res) => {
    if (res.message) emitAppEvent({ type: 'notice', message: res.message });
  });
}

function emitAppEvent(event: AppEvent): void {
  getMainWindow()?.webContents.send('app:event', event);
}

function createWindow(): BrowserWindow {
  return createMainWindow({
    title: 'JM Production Suite',
    preloadPath,
    // P2 (#60): Renderer-Sandbox. Preload nutzt nur @jm/electron-kit/preload
    // (contextBridge/ipcRenderer) — sandbox-sicher; IPC-Fläche groß → gründlich testen.
    sandbox: true,
    iconPath: resourcePath('icon.png', join(__dirname, '..', '..', 'resources')),
    rendererUrl: process.env['ELECTRON_RENDERER_URL'],
    rendererFile: join(__dirname, '../renderer/index.html'),
  });
}

if (setupSingleInstance(() => createWindow())) {
  app.whenReady().then(() => {
    initManifest(); // lokalen Manifest-Cache laden, bevor das Fenster Tools abfragt
    initChangelog(); // dito für die App-Patchnotes
    initCookbook(); // dito für die Kochbuch-Rezepte
    // Presence-Hub: empfängt die Heartbeats der Tools und meldet Änderungen an
    // die UI (Health-Dashboard). Best-effort — fällt der Port aus, läuft alles weiter.
    startPresenceHub(() => emitAppEvent({ type: 'presence-changed' }));
    // Health-Aggregator: browst per mDNS nach Steuer-Endpunkten und liest deren
    // Live-Zustand (REC/On-Air/…) — auch von Tools auf anderen Rechnern.
    startHealth(() => emitAppEvent({ type: 'health-changed' }), app.getPath('appData'));
    registerIpc();
    createWindow();

    // Hintergrund: remote suite.json holen
    refreshManifest()
      .then((changed) => {
        if (changed) emitAppEvent({ type: 'manifest-changed' });
      })
      .catch(() => {});
    // … und die remote changelog.json (App-Patchnotes ohne Launcher-Release).
    refreshChangelog()
      .then((changed) => {
        if (changed) emitAppEvent({ type: 'changelog-changed' });
      })
      .catch(() => {});
    // … und die remote cookbook.json (neue Rezepte ohne Launcher-Release).
    refreshCookbook()
      .then((changed) => {
        if (changed) emitAppEvent({ type: 'cookbook-changed' });
      })
      .catch(() => {});
    // Launcher-Self-Update läuft über den Renderer (loadLauncherUpdate → Banner
    // mit „Aktualisieren"), siehe updates.ts/installer.ts. Den früheren
    // electron-updater-Pfad gibt es nicht mehr: er konnte mangels Feed (private
    // Releases via Proxy/Token) nur fehlschlagen und blendete dabei beim Start
    // eine nicht-handlungsrelevante Fehler-Notice ein (Issue #8).

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

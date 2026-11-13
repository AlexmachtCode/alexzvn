import { app, BrowserWindow } from 'electron';
import { initAppRuntime } from '@jm/app-runtime';
import { registerIpc } from './ipc';
import { createEditorWindow, getEditorWindow } from './windows';
import { handleShowDeepLink, flushPendingShowProject } from './show-open';
import { startControlServer, stopControlServer } from './control-server';
import { oeffneStartDateien, registriereDateiOeffnen } from './datei-oeffnen';

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence.
// onDeepLink fängt Show-Links bei laufender App (second-instance/open-url) ab;
// den Start-Link verarbeiten wir unten über runtime.initialDeepLink.
const runtime = initAppRuntime({ csp: true,
  appId: 'jm-presenter',
  appName: 'JM Presenter',
  onDeepLink: (url) => void handleShowDeepLink(url),
});

// Single-instance lock — a second launch focuses the existing editor window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Bevorzugt den Editor: während einer Show ist das erste Fenster oft Referent oder Publikum.
    const editor = getEditorWindow();
    const win = editor && !editor.isDestroyed() ? editor : BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    } else {
      createEditorWindow();
    }
  });
  // Doppelklick / „Öffnen mit“ (#299): Dateipfade aus argv bzw. open-file (Mac, auch vor ready).
  registriereDateiOeffnen();

  app.whenReady().then(() => {
    registerIpc();
    createEditorWindow();
    oeffneStartDateien();
    // Show-Dokument nachliefern bzw. Start-Deep-Link (App per Show gestartet)
    // verarbeiten — lädt das in der .jmshow referenzierte .jmpres.
    flushPendingShowProject();
    if (runtime.initialDeepLink) void handleShowDeepLink(runtime.initialDeepLink);
    // TCP-Steuerserver (suite-weites Protokoll) für Companion u. a.
    void startControlServer();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createEditorWindow();
    });
  });

  app.on('before-quit', () => stopControlServer());

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

import { app, BrowserWindow, ipcMain } from 'electron';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { beobachteBildschirme } from '@jm/output-window';
import { naechsteFernsteuerung, type FernsteuerungEreignis, type FernsteuerungMeldung } from '../shared/fernsteuerung';
import { registerIpc } from './ipc';
import { broadcastAll, createEditorWindow, getEditorWindow, istNdiFenster } from './windows';
import { handleShowDeepLink, flushPendingShowProject } from './show-open';
import { startControlServer, stopControlServer } from './control-server';
import { shutdownGastKlicker } from './gast-klicker';
import { oeffneStartDateien, registriereDateiOeffnen } from './datei-oeffnen';

/**
 * UX Welle 2b (Spec 3.9, B2): die zuletzt gemeldete Lage des Steuerservers (Port 8728), nur lesend. null, solange nichts
 * gemeldet wurde (der Renderer zeigt dann „unbekannt“). Jede Meldung geht über broadcastAll an alle Fenster; Publikum und
 * NDI-Fenster hören nicht zu.
 */
let fernsteuerung: FernsteuerungMeldung | null = null;
function meldeFernsteuerung(e: FernsteuerungEreignis): void {
  fernsteuerung = naechsteFernsteuerung(fernsteuerung ?? undefined, e);
  broadcastAll('presenter:fernsteuerung', fernsteuerung);
}

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
    // Nie ein verstecktes NDI-Fenster (#303), auch kein schließendes oder hängendes – das ist kein Bedienfenster;
    // ist sonst keins offen, kommt ein Editor.
    const editor = getEditorWindow();
    const win =
      editor && !editor.isDestroyed()
        ? editor
        : BrowserWindow.getAllWindows().find((w) => !istNdiFenster(w));
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
    ipcMain.handle('presenter:fernsteuerung', () => fernsteuerung);
    // UX Welle 2b (B11): Bildschirm angesteckt, abgezogen oder geändert → Editor und Referent lesen die Liste neu. Nur ein
    // Ereignis ohne Nutzlast, nur lesend; erst nach app.ready, weil es `screen` vorher nicht gibt. Dazu meldet das
    // Publikumsfenster jede Bewegung (windows.ts).
    beobachteBildschirme(() => broadcastAll('present:bildschirme', undefined));
    createEditorWindow();
    oeffneStartDateien();
    // Show-Dokument nachliefern bzw. Start-Deep-Link (App per Show gestartet)
    // verarbeiten — lädt das in der .jmshow referenzierte .jmpres.
    flushPendingShowProject();
    if (runtime.initialDeepLink) void handleShowDeepLink(runtime.initialDeepLink);
    // TCP-Steuerserver (suite-weites Protokoll) für Companion u. a. Das bisher verworfene Ergebnis wird für die
    // Fernsteuerungs-Meldung gelesen (UX Welle 2b); der Ablauf bleibt gleich, niemand wartet auf den Start. Startfehler
    // gehen auch ins Protokoll (2a M1): ein Start mit ok:false (z. B. Port belegt) und ein Wurf.
    startControlServer(meldeFernsteuerung)
      .then((r) => {
        meldeFernsteuerung({ art: 'start', ok: r.ok, error: r.error });
        if (!r.ok) getLog().warn(`Presenter-Steuerserver nicht gestartet: ${r.error ?? 'unbekannt'}`);
      })
      .catch((err) => {
        getLog().warn(`Presenter-Steuerserver fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
        meldeFernsteuerung({ art: 'wurf', text: err instanceof Error ? err.message : String(err) });
      });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createEditorWindow();
    });
  });

  app.on('before-quit', () => {
    stopControlServer();
    shutdownGastKlicker();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

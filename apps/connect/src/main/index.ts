import { app, BrowserWindow, session } from 'electron';
import { join } from 'node:path';
import { getLog, initAppRuntime } from '@jm/app-runtime';
import { createMainWindow, getMainWindow, resourcePath, setupSingleInstance } from '@jm/electron-kit';
import { IPC } from '@shared/ipc';
import type { TrayCommand } from '@shared/types';
import { registerIpc, notifyStatusChanged, currentStatus } from './ipc';
import { erzeugeNdiLage, ndiStateKv, type NdiHandlung } from './ndi-lage';
import { gastHandlung, initNdiGuests, tearDownAll } from './ndi-guests';
import { initNdiProgram, programmHandlung, stopProgram } from './ndi-program';
import { createPeerWindow, destroyPeerWindow, getPeerWindow } from './peer-window';
import { setNdiControlState, startControlServer, stopControlServer } from './control-server';
import { createTray, destroyTray, setTrayStatus } from './tray';
import { handleShowDeepLink } from './show-open';
import { startPresenterLink, stopPresenterLink } from './presenter-link';
import { startZoom, verdrahteZoomFenster, zoomBeenden, zoomGastLabelsGeaendert, zoomLaeuft, zoomSteuerbefehl, zoomVerlassen } from './zoom';
import { aenderungsMelder, leiteSteuerbefehl } from './control-state';
import { BEENDEN_FRIST_MS } from './zoom/kern';

declare const __dirname: string;

let isQuitting = false;
/** Zoom ist abgebaut (Spec 6.6): der zweite before-quit-Durchlauf räumt den Rest ab. */
let zoomAbgebaut = false;

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence. Ein Show-Deep-Link liefert
// die Sprecher-Liste der Veranstaltung (iveo, Welle 6.3b) → Join-Links/QR mit einem Klick.
const runtime = initAppRuntime({
  // Anders als der Rest der Suite spricht dieser Renderer SELBST mit der Cloud: der Operator hält die
  // WebSocket zum ConnectRoom-DO, der versteckte Peer holt zusätzlich seine ICE-Credentials per fetch.
  // Die strenge Default-CSP erlaubt im gepackten Build nur `connect-src 'self'` und blockiert damit
  // beides — im Dev fällt das nie auf, weil dort ws:/wss:/http:/https: gelockert sind.
  // Schemenweit freigeben statt Origin-Pinning: die Proxy-Adresse gibt der Operator zur Laufzeit ein.
  // `script-src` bleibt 'self', es wird kein Fremdcode geladen.
  csp: { connectSrc: ['https:', 'wss:'] },
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
  // Windows-Abmeldung oder Herunterfahren: das Zoom-Meeting noch sauber verlassen (Spec 6.6).
  // Ob Windows so lange wartet, ist ungemessen (Spec 17.1).
  win.on('session-end', () => void zoomBeenden(BEENDEN_FRIST_MS));
  // Vorschau (Spec 7.7, GEP14): show, hide, minimize, restore und ready-to-show an den Zoom-Kern. Hier, damit auch ein von
  // showOrCreateWindow neu angelegtes Fenster verdrahtet ist.
  verdrahteZoomFenster(win);
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

    // Eine NDI-Lage für alle Gast-Quellen und den Programm-Empfang (Plan C, C-EP1, E52), auf der monotonen Uhr (E50, PK55).
    // onLage: jede Änderung der öffentlichen Lage (und einmal beim Start) → Status an Fenster und Tray.
    // onNamen: die Namensliste für T46 hat sich geändert → die Kollisionsprüfung Gast ↔ Zoom neu rechnen (Spec 6.3, E42).
    // STATE-Teil `ndi` (22.6, E52): nur bei Änderung; der erste onLage beim Start meldet ihn immer, auch unter macOS.
    const meldeNdi = aenderungsMelder(setNdiControlState);
    const ndiLage = erzeugeNdiLage({
      jetzt: () => performance.now(),
      peerDa: () => {
        const p = getPeerWindow();
        return p !== null && !p.webContents.isCrashed();
      },
      onLage: () => {
        notifyStatusChanged();
        meldeNdi(ndiStateKv(ndiLage.quellen(), ndiLage.programmLage()));
      },
      onNamen: () => zoomGastLabelsGeaendert(),
    });
    // Führt die Handlungen der Lage aus (C-EP1): Logzeilen, Neustart-Wecker (C-EB1), Gast- und Programm-Prozesse.
    const ndiAusfuehren = (h: NdiHandlung[]): void => {
      for (const x of h) {
        if (x.art === 'log') getLog().info(x.zeile);
        else if (x.art === 'neustartPlanen') setTimeout(() => ndiAusfuehren(ndiLage.tick()), x.inMs + 5);
        else if (x.teil === 'gast') gastHandlung(x);
        else programmHandlung(x);
      }
    };
    // Versteckter WebRTC-Peer (Medien) — vor dem NDI-Pool, der ihm Frame-Ports gibt. Stürzt sein Renderer ab oder schließt
    // er, gehen alle Gast-Quellen und der Programm-Empfang nach gescheitert/keinPeer (E50, T119).
    createPeerWindow(preloadPath, () => ndiAusfuehren(ndiLage.peerWeg()));
    // Gast-Quellen (Plan C, 22.3): Die Hülle startet und beendet Prozesse, wie die Lage es sagt.
    initNdiGuests({ getPeer: () => getPeerWindow(), lage: ndiLage, ausfuehren: ndiAusfuehren });
    // Zeitgeber der Lage (22.3 Nr. 7, E50): jede Sekunde, für Gast-Quellen und Programm-Empfang.
    setInterval(() => ndiAusfuehren(ndiLage.tick()), 1000);
    // Programm-Rückkanal-Empfang (Welle 6.2a, Plan C 22.4): Die Hülle startet und beendet den Prozess, wie die Lage es sagt;
    // jede Änderung meldet onLage.
    initNdiProgram({ getPeer: () => getPeerWindow(), lage: ndiLage, ausfuehren: ndiAusfuehren });

    registerIpc({
      getWindow: () => getMainWindow(),
      getPeer: () => getPeerWindow(),
      onStatusChange: (s) => setTrayStatus(s),
    });

    // Zoom (Stage 4, nur Windows) – unabhängig vom Cloud-Raum (E4). Jede Änderung der Kurzform geht
    // als AppStatus an Tray und Kopfzeile.
    startZoom({ getWindow: () => getMainWindow(), logDir: runtime.logDir, onKurz: () => notifyStatusChanged() });

    // Folien-Kopplung (6.3c): JM Presenter im LAN suchen, damit ein freigegebener Remote-Sprecher
    // seine Folien selbst weiterblättern kann.
    startPresenterLink({ onChange: () => notifyStatusChanged() });

    // Steuerprotokoll (Companion/Rundown): zoom_*-Verben gehen an die Zoom-Hülle im Main, nie an den
    // Renderer oder den DO (Spec 11.2, Ergänzung 0.3). Alle anderen Befehle an den Operator-Renderer
    // relayen, der sie über die Raum-WS an den DO schickt.
    const res = await startControlServer({
      onCommand: (cmd) =>
        leiteSteuerbefehl(cmd, {
          zoom: zoomSteuerbefehl,
          renderer: (c) => getMainWindow()?.webContents.send(IPC.controlCommand, { verb: c.verb, args: c.args }),
        }),
    });
    if (!res.ok) getLog().error('[control] Steuerserver-Start fehlgeschlagen:', res.error);

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
      onZoomVerlassen: () => zoomVerlassen(),
    });
    setTrayStatus(currentStatus());

    app.on('activate', () => showOrCreateWindow());
  });

  // Fenster-Schließen beendet die App NICHT — sie läuft im Tray weiter (NDI-Versand).
  app.on('window-all-closed', () => {
    // absichtlich leer: Hintergrundbetrieb via Tray
  });

  // Spec 6.1/6.6: Läuft Zoom (Kopie, Prüfung oder Bridge), wartet das Beenden höchstens
  // BEENDEN_FRIST_MS darauf, dass die Kopie abbricht und `.teil` löscht bzw. die Bridge das Meeting
  // verlässt; erst der zweite Durchlauf räumt ab.
  app.on('before-quit', (e) => {
    isQuitting = true;
    if (!zoomAbgebaut && zoomLaeuft()) {
      e.preventDefault();
      // Ein zweiter Aufruf während des Wartens bekommt dasselbe Versprechen (kern.beenden).
      void zoomBeenden(BEENDEN_FRIST_MS).finally(() => {
        zoomAbgebaut = true;
        app.quit();
      });
      return;
    }
    tearDownAll();
    stopProgram();
    destroyPeerWindow();
    stopControlServer();
    stopPresenterLink();
    destroyTray();
  });
}

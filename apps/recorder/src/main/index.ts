import { app, BrowserWindow, dialog, ipcMain, powerMonitor, shell } from 'electron';
import path, { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { initAppRuntime, getLog } from '@jm/app-runtime';
import { parseShow, parseShowDeepLink } from '@jm/show';
import type { RecShowSettings } from '@shared/types';
import { naechsteFernsteuerung, type FernsteuerungEreignis, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import { pruefeShowOrdner } from '@shared/netzordner';
import { saeubereAnzeige } from '@shared/presets';
import { SCHLIESSEN_TEXTE, SchliessenSteuerung } from '@shared/schliessen';
import { netzordnerListe, registerIpc } from './ipc';
import { getState, shutdown } from './recorder';
import { startControlServer, stopControlServer } from './control-server';

declare const __dirname: string;

let mainWindow: BrowserWindow | null = null;

/**
 * Altfehler RE-7a (D4): die App soll beenden (Mac Cmd+Q, app.quit). Fragt das Schließen des Fensters nach, wartet der Wunsch auf die Antwort:
 * „Aufnahme beenden“ beendet danach die App, „Weiter aufnehmen“ verwirft ihn.
 */
let beendenWunsch = false;
/** Altfehler RE-7a: die Rückfrage des Hauptfensters (Antworten aus recorder:schliessenAntwort, powerMonitor); null ohne Fenster. */
let schliessenSteuerung: SchliessenSteuerung | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Show-Integration (C3): Wird der Recorder per Show-Deep-Link gestartet, übernimmt
// er den `settings`-Block seines Eintrags aus der .jmshow (Ordner/Dateiname/
// Spuren/Kanäle/Samplerate). Der Config lebt im Renderer-Store, daher schiebt der
// Main die geprüften Werte dorthin: läuft der Renderer schon, per Push; beim
// Kaltstart merken wir sie und der Renderer holt sie NACH der Geräte-Vorauswahl ab
// (sonst überschriebe refreshDevices channels/sampleRate wieder).
// ─────────────────────────────────────────────────────────────────────────────
let pendingShowSettings: RecShowSettings | null = null;

function applyShowFromDeepLink(url: string): void {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return;
  try {
    const show = parseShow(readFileSync(showPath, 'utf8'));
    const s = show.tools.find((t) => t.appId === 'jm-recorder')?.settings;
    if (!s) return;
    const out: RecShowSettings = {};
    // Altfehler RE-7b (B4): der Ordner geht durch dieselbe Prüfung wie beim Import. Gesetzt wird nur ein Laufwerksordner oder ein schon
    // bestätigter Netzwerkordner; ein neuer Netzwerkordner wartet auf „Übernehmen“ im Fenster (nie ein Dialog), ein ungültiger kommt
    // nicht durch. Die Liste ist eine lokale Datei, geprüft wird im Speicher. Ein leeres Feld fehlt wie beim Import.
    if (typeof s.dir === 'string' && s.dir !== '') {
      const o = pruefeShowOrdner(s.dir, (p) => netzordnerListe().enthaelt(p));
      const anzeige = saeubereAnzeige(o.dir).slice(0, 500);
      if (o.art === 'setzen') {
        out.dir = o.dir;
      } else if (o.art === 'bestaetigen') {
        out.netzordnerOffen = o.dir;
        getLog().warn(`Show-Zielordner wartet auf Bestätigung: ${anzeige}`);
      } else {
        out.ordnerUngueltig = o.dir;
        getLog().warn(`Show-Zielordner ungültig, nicht übernommen: ${anzeige}`);
      }
    }
    if (typeof s.fileName === 'string') out.fileName = s.fileName;
    if (typeof s.separateTracks === 'boolean') out.separateTracks = s.separateTracks;
    if (typeof s.channels === 'number' && Number.isFinite(s.channels)) out.channels = s.channels;
    if (typeof s.sampleRate === 'number' && Number.isFinite(s.sampleRate)) out.sampleRate = s.sampleRate;
    if (!Object.keys(out).length) return;
    // Läuft der Renderer schon (Deep-Link zur Laufzeit)? Direkt pushen; sonst für
    // den Kaltstart-Pull (rec:takeShowSettings) merken.
    if (mainWindow && !mainWindow.webContents.isLoading()) {
      mainWindow.webContents.send('recorder:show-settings', out);
    } else {
      pendingShowSettings = out;
    }
  } catch (err) {
    getLog().error(`Show-Einstellungen konnten nicht geladen werden: ${(err as Error).message}`);
  }
}

/**
 * UX Welle 2a (Spec 3.9): die zuletzt gemeldete Lage des Steuerservers, nur lesend. null, solange nichts gemeldet wurde
 * (der Renderer zeigt dann „unbekannt“). Jede Meldung geht an alle offenen Fenster.
 */
let fernsteuerung: FernsteuerungMeldung | null = null;
function meldeFernsteuerung(e: FernsteuerungEreignis): void {
  fernsteuerung = naechsteFernsteuerung(fernsteuerung ?? undefined, e);
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('recorder:fernsteuerung', fernsteuerung);
  }
}

// Geteilter Runtime-Layer: Logging, Crash-Handler, Deep-Links, Presence. Per Show
// gestartet? settings-Block übernehmen (C3).
const runtime = initAppRuntime({
  csp: true,
  appId: 'jm-recorder',
  appName: 'JM Audio Recorder',
  onDeepLink: (url) => applyShowFromDeepLink(url),
});

const preloadPath = join(__dirname, '../preload/index.cjs');

function resourcePath(filename: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, filename);
  }
  return path.join(__dirname, '..', '..', 'resources', filename);
}

function loadMain(win: BrowserWindow): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl) {
    win.loadURL(rendererUrl);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function createMainWindow(): BrowserWindow {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return mainWindow;
  }
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 920,
    minHeight: 620,
    backgroundColor: '#121212',
    show: false,
    title: 'JM Audio Recorder',
    icon: resourcePath('icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Altfehler RE-7a (B3, D4): läuft eine Aufnahme, fragt das Schließen nach. Die Frage steht im Fenster (SchliessenFrage) und hält den
  // Hauptprozess nicht an (Audioblöcke, IPC, Steuerserver laufen weiter). Meldet das Fenster sie nicht binnen 1 s als gezeigt (hängender
  // Renderer), fragt der Hauptprozess mit einem nicht blockierenden nativen Dialog, nie mit showMessageBoxSync. Die erste Antwort gilt.
  // Den Ablauf führt SchliessenSteuerung (shared/schliessen.ts); hier stehen nur Fenster, Dialog und App als Ports. Fix-Runde 1 (Befund 1):
  // geht die Frage im Fenster verloren (Neuladen mit Strg+R, Absturz), fragt ein weiteres Schließen erneut, ein Neuladen stellt sie erneut,
  // und ist der Renderer weg, fragt sofort der native Dialog. Ein close bleibt so nie ohne Antwortweg.
  const steuerung = new SchliessenSteuerung({
    status: () => getState().status,
    sendeFrage: (offen) => {
      // Ein abgestürzter Renderer darf den Rückfall nicht aufhalten: nach dem Senden fragt der native Dialog in jedem Fall.
      try {
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('recorder:schliessenFrage', offen);
      } catch {
        // das Fenster ist weg; der native Dialog (Rückfall) fragt trotzdem
      }
    },
    frageNativ: () =>
      win.isDestroyed()
        ? Promise.reject(new Error('Fenster zu'))
        : dialog
            .showMessageBox(win, {
              type: 'warning',
              message: SCHLIESSEN_TEXTE.frage,
              detail: SCHLIESSEN_TEXTE.detail,
              buttons: [SCHLIESSEN_TEXTE.beenden, SCHLIESSEN_TEXTE.weiter],
              defaultId: 1,
              cancelId: 1,
            })
            .then((r) => r.response),
    schliesse: () => {
      if (!win.isDestroyed()) win.close();
    },
    beendenGewuenscht: () => beendenWunsch,
    wunschVerwerfen: () => {
      beendenWunsch = false;
    },
    beende: () => app.quit(),
  });
  schliessenSteuerung = steuerung;
  win.on('close', (e) => {
    if (steuerung.beimSchliessen()) e.preventDefault();
  });
  win.webContents.on('did-finish-load', () => steuerung.geladen());
  win.webContents.on('render-process-gone', () => steuerung.rendererWeg());
  // Abmelden oder Herunterfahren (Windows): ohne Frage; die Datei wird sauber abgeschlossen, bevor das System den Prozess beendet.
  win.on('session-end', () => {
    steuerung.ohneFrage();
    shutdown();
  });

  win.on('closed', () => {
    shutdown(); // geplante Aufnahme-Timer lösen + Eingang schließen
    schliessenSteuerung = null;
    mainWindow = null;
  });

  loadMain(win);
  mainWindow = win;
  return win;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });

  app.whenReady().then(() => {
    // Kaltstart-Abholung der Show-Voreinstellungen (C3) — der Renderer ruft das
    // nach der Geräte-Vorauswahl auf und leert damit den Puffer.
    ipcMain.handle('rec:takeShowSettings', () => {
      const s = pendingShowSettings;
      pendingShowSettings = null;
      return s;
    });
    ipcMain.handle('recorder:fernsteuerung', () => fernsteuerung);
    // Altfehler RE-7a: das Fenster meldet die Rückfrage als gezeigt (die 1-s-Frist für den nativen Rückfall endet) oder antwortet.
    ipcMain.handle('recorder:schliessenAntwort', (e, a: unknown): void => {
      if (!mainWindow || e.sender !== mainWindow.webContents) return;
      if (a === 'gezeigt' || a === 'beenden' || a === 'weiter') schliessenSteuerung?.antwortFenster(a);
    });
    // Ruling R15 (B3, macOS und Linux): session-end gibt es nur unter Windows. Meldet das System Herunterfahren, Neustart oder (macOS)
    // Abmelden, schließt der Recorder ohne Frage und die Datei sauber ab. Nicht auf dem Mac gemessen.
    powerMonitor.on('shutdown', () => {
      schliessenSteuerung?.ohneFrage();
      shutdown();
    });
    registerIpc(() => mainWindow);
    createMainWindow();
    // TCP-Steuerserver (suite-weites Protokoll) für Companion u. a. — Befehle
    // gehen per IPC an den Renderer, STATE wird direkt aus dem Main gepusht.
    startControlServer(() => mainWindow, meldeFernsteuerung)
      .then((r) => {
        meldeFernsteuerung({ art: 'start', ok: r.ok, error: r.error });
        if (!r.ok) getLog().warn(`Recorder-Steuerserver nicht gestartet: ${r.error ?? 'unbekannt'}`);
      })
      // Gesamtprüfung M1: Startfehler gehen auch ins Protokoll (wie beim Timer), damit sie nach der Show nachlesbar sind:
      // ein Start mit ok:false (oben, z. B. Port belegt) und ein Wurf.
      .catch((err) => {
        getLog().warn(`Recorder-Steuerserver fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
        meldeFernsteuerung({ art: 'wurf', text: err instanceof Error ? err.message : String(err) });
      });
    // Per Show gestartet (Kaltstart)? settings-Block jetzt verarbeiten.
    if (runtime.initialDeepLink) applyShowFromDeepLink(runtime.initialDeepLink);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  // Altfehler RE-7a (B3, Mac Cmd+Q): before-quit kommt vor dem close der Fenster. Hier nur den Wunsch merken; bricht jemand die Rückfrage
  // ab, läuft der Recorder mit Steuerserver weiter. Angehalten wird er erst in will-quit, wenn wirklich beendet wird.
  app.on('before-quit', () => {
    beendenWunsch = true;
  });
  app.on('will-quit', () => stopControlServer());

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

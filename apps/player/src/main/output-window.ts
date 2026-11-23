import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { AUSGABE_ZU, naechsterAusgabeZustand, type AusgabeEreignis, type AusgabeZustand } from '@jm/output-window/zustand';
import type { DisplayInfo, OutputCommand } from '@shared/types';
import { LebendeFenster } from './ausgabe-fenster';

declare const __dirname: string;

const preloadPath = join(__dirname, '../preload/index.cjs');

let outputWindow: BrowserWindow | null = null;

// UX Welle 2a (W2-2, E14): gemessener Zustand des Ausgabefensters, nur lesend. Das Fenster bleibt das eigene des Players
// (nicht die Klasse OutputWindow); es meldet seine Ereignisse an die reine Zustandsmaschine aus @jm/output-window/zustand.
let zustand: AusgabeZustand = AUSGABE_ZU;
const hoerer = new Set<(z: AusgabeZustand) => void>();
let bildschirmHoerer = false;
// Nur für die Meldung: alle noch nicht geschlossenen Ausgabefenster dieses Moduls (die outputWindow-Referenz kann veralten).
const lebende = new LebendeFenster<BrowserWindow>();

/** Gemessener Zustand des Fensters. */
export function ausgabeZustand(): AusgabeZustand {
  return zustand;
}

/** Meldet jede Änderung des Zustands; gibt die Abmeldung zurück. */
export function onAusgabeZustand(cb: (z: AusgabeZustand) => void): () => void {
  hoerer.add(cb);
  return () => {
    hoerer.delete(cb);
  };
}

function melde(e: AusgabeEreignis): void {
  const neu = naechsterAusgabeZustand(zustand, e);
  if (neu.art === zustand.art && neu.displayId === zustand.displayId) return;
  zustand = neu;
  for (const cb of [...hoerer]) cb(neu);
}

export function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: d.label || `Bildschirm ${i + 1}`,
    primary: d.id === primaryId,
    width: d.size.width,
    height: d.size.height,
  }));
}

function loadOutput(win: BrowserWindow): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl) {
    win.loadURL(`${rendererUrl}#output`);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'output' });
  }
}

export function openOutputWindow(displayId?: number): void {
  const displays = screen.getAllDisplays();
  const target =
    (displayId != null ? displays.find((d) => d.id === displayId) : undefined) ??
    screen.getPrimaryDisplay();
  const { x, y, width, height } = target.bounds;
  // `screen` gibt es erst nach app.ready, darum erst hier (einmalig) anmelden.
  if (!bildschirmHoerer) {
    bildschirmHoerer = true;
    screen.on('display-removed', (_e, d) => melde({ t: 'bildschirm-weg', displayId: d.id }));
  }

  if (outputWindow) {
    // Auf den gewünschten Bildschirm umziehen und (wieder) in den Vollbildmodus.
    outputWindow.setFullScreen(false);
    outputWindow.setBounds({ x, y, width, height });
    outputWindow.setFullScreen(true);
    outputWindow.show();
    outputWindow.focus();
    melde({ t: 'geoeffnet', displayId: target.id, neu: false });
    return;
  }

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    backgroundColor: '#000000',
    fullscreen: true,
    show: false,
    title: 'JM Player — Ausgabe',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => win.show());
  win.on('closed', () => {
    outputWindow = null;
    // „zu“ erst, wenn das letzte lebende Fenster geschlossen ist.
    if (lebende.schliesse(win)) melde({ t: 'geschlossen' });
  });
  win.webContents.on('render-process-gone', () => {
    // Nur der Absturz des neuesten lebenden Fensters zählt.
    if (lebende.istNeuestes(win)) melde({ t: 'abgestuerzt' });
  });

  lebende.hinzu(win);
  loadOutput(win);
  outputWindow = win;
  melde({ t: 'geoeffnet', displayId: target.id, neu: true });
}

export function closeOutputWindow(): void {
  if (outputWindow) {
    outputWindow.close();
    outputWindow = null;
  }
}

export function isOutputOpen(): boolean {
  return outputWindow != null && !outputWindow.isDestroyed();
}

/** Gemessenes Vollbild des Ausgabefensters (E14); null, solange kein Fenster offen ist. */
export function isOutputFullscreen(): boolean | null {
  return isOutputOpen() ? outputWindow!.isFullScreen() : null;
}

/**
 * Vollbild am Ausgabeschirm umschalten (Issue #31). Liefert den neuen Zustand.
 * Beim Verlassen des Vollbilds das Fenster sichtbar/fokussiert halten, damit es
 * nicht hinter anderen Fenstern auf dem Ausgabeschirm verschwindet.
 */
export function toggleOutputFullscreen(): boolean {
  if (!isOutputOpen()) return false;
  const next = !outputWindow!.isFullScreen();
  outputWindow!.setFullScreen(next);
  if (!next) {
    outputWindow!.show();
    outputWindow!.focus();
  }
  return next;
}

export function sendToOutput(cmd: OutputCommand): void {
  if (isOutputOpen()) outputWindow!.webContents.send('output:cmd', cmd);
}

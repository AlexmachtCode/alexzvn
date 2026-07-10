// Zweitbildschirm-Ausgabe: ein frameloses Vollbild-Fenster auf einem gewählten Monitor, das das
// Programmbild zeigt (physischer Programm-Output per HDMI an Beamer/Monitor/Encoder). Muster:
// JM Titler `createOutputWindow` (#161).
//
// Frame-Weg (BEWUSST komprimiert statt roh): der Haupt-Renderer kodiert das Programm-Canvas pro
// Tick zu WebP und schickt die kleinen Bytes per IPC `screen:frame` hierher; der Main reicht sie an
// das Ausgabefenster weiter (`onFrame` im view=output). Ein roher 1080p-Strom wäre ~200 MB/s und
// bräuchte ein Renderer-zu-Renderer-Port-Handoff — für einen Monitor-Feed unnötig teuer.
//
// Das Programm-Composite existiert nur im Haupt-Renderer (Live-Mischung), daher MUSS es zugeliefert
// werden — anders als beim Titler, dessen Ausgabefenster die Grafik selbst aus der Config rechnet.
import { BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';
import type { DisplayInfo } from '@shared/types';

declare const __dirname: string;

const preloadPath = join(__dirname, '../preload/index.cjs');

let outputWindow: BrowserWindow | null = null;
let enabled = false;
let displayId = 0;
let displayListenersBound = false;

function toDisplayInfo(d: Electron.Display, primaryId: number, index: number): DisplayInfo {
  const label = d.label && d.label.trim() ? d.label.trim() : `Monitor ${index + 1}`;
  return {
    id: d.id,
    label: `${label} · ${d.size.width}×${d.size.height}`,
    width: d.size.width,
    height: d.size.height,
    primary: d.id === primaryId,
  };
}

function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => toDisplayInfo(d, primaryId, i));
}

/** Den Ziel-Monitor auflösen: gewählte id, sonst (0/unbekannt) der Hauptmonitor. */
function resolveDisplay(): Electron.Display {
  const all = screen.getAllDisplays();
  return all.find((d) => d.id === displayId) ?? screen.getPrimaryDisplay();
}

function createOutputWindow(): void {
  if (outputWindow && !outputWindow.isDestroyed()) return;
  const target = resolveDisplay();
  const win = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    frame: false,
    fullscreen: true,
    backgroundColor: '#000000',
    show: false,
    title: 'JM Switcher · Ausgabe',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // Live-Ausgang: darf nie eingefroren werden, auch wenn er (auf dem 2. Monitor) im Hintergrund liegt.
      backgroundThrottling: false,
    },
  });
  win.on('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('closed', () => {
    if (outputWindow === win) outputWindow = null;
  });
  const url = process.env['ELECTRON_RENDERER_URL'];
  if (url) void win.loadURL(`${url}?view=output`);
  else void win.loadFile(join(__dirname, '../renderer/index.html'), { search: 'view=output' });
  outputWindow = win;
}

function closeOutputWindow(): void {
  if (outputWindow && !outputWindow.isDestroyed()) outputWindow.close();
  outputWindow = null;
}

/** Fenster nach aktuellem Zustand öffnen/schließen/auf den richtigen Monitor bringen. */
function reconcile(): void {
  if (!enabled) {
    closeOutputWindow();
    return;
  }
  if (!outputWindow || outputWindow.isDestroyed()) {
    createOutputWindow();
    return;
  }
  // Bereits offen → ggf. auf den (neu gewählten/geänderten) Monitor schieben.
  const target = resolveDisplay();
  outputWindow.setBounds(target.bounds);
  if (!outputWindow.isFullScreen()) outputWindow.setFullScreen(true);
}

export function attachSecondScreen(_win: BrowserWindow): void {
  // Monitor-Wechsel (an-/abgesteckt, Auflösung geändert) → Fenster nachführen bzw. schließen,
  // falls der gewählte Monitor verschwindet (resolveDisplay fällt dann auf den Hauptmonitor zurück).
  // Nur EINMAL binden — das Hauptfenster kann (macOS-activate) neu erzeugt werden, die screen-Listener
  // sind aber prozessglobal und dürfen sich nicht häufen.
  if (!displayListenersBound) {
    displayListenersBound = true;
    const onDisplaysChanged = (): void => {
      if (enabled) reconcile();
    };
    screen.on('display-removed', onDisplaysChanged);
    screen.on('display-added', onDisplaysChanged);
    screen.on('display-metrics-changed', onDisplaysChanged);
  }
}

export function registerSecondScreenIpc(): void {
  ipcMain.handle('screen:listDisplays', () => listDisplays());
  ipcMain.handle('screen:setSecondScreen', (_e, on: boolean, id: number) => {
    enabled = !!on;
    displayId = Number(id) || 0;
    reconcile();
  });
  // Komprimiertes Programm-Frame vom Haupt-Renderer → Ausgabefenster durchreichen.
  ipcMain.on('screen:frame', (_e, data: ArrayBuffer, w: number, h: number) => {
    if (outputWindow && !outputWindow.isDestroyed()) {
      outputWindow.webContents.send('screen:frame', data, w, h);
    }
  });
}

export function stopSecondScreen(): void {
  enabled = false;
  closeOutputWindow();
}

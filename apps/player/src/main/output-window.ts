import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import type { DisplayInfo, OutputCommand } from '@shared/types';

declare const __dirname: string;

const preloadPath = join(__dirname, '../preload/index.cjs');

let outputWindow: BrowserWindow | null = null;

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

  if (outputWindow) {
    // Auf den gewünschten Bildschirm umziehen und (wieder) in den Vollbildmodus.
    outputWindow.setFullScreen(false);
    outputWindow.setBounds({ x, y, width, height });
    outputWindow.setFullScreen(true);
    outputWindow.show();
    outputWindow.focus();
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
  });

  loadOutput(win);
  outputWindow = win;
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

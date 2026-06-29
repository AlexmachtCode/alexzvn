// Mixer als eigenes Fenster (#95): ein schlankes Popout-Fenster, das denselben
// Renderer mit `#mixer` lädt und nur den Mixer zeigt. Audio-Engine + Store
// leben im Hauptfenster (Host); dieses Modul ist das Relais zwischen beiden:
//   Host  --mixer:snapshot-->  Main  --mixer:snapshot-->  Popout
//   Popout --mixer:command-->  Main  --mixer:command-->  Host
// Zusätzlich erfährt der Host per `mixer:popout`, ob das Fenster offen ist
// (→ er startet/stoppt das periodische Pushen der Momentaufnahmen).
import { BrowserWindow, ipcMain, shell } from 'electron';

interface Setup {
  getHost: () => BrowserWindow | null;
  preloadPath: string;
  rendererUrl?: string;
  rendererFile: string;
  iconPath?: string;
}

let mixerWin: BrowserWindow | null = null;
let cfg: Setup | null = null;

function notifyHost(open: boolean): void {
  const host = cfg?.getHost();
  if (host && !host.isDestroyed()) host.webContents.send('mixer:popout', open);
}

function openMixerWindow(): void {
  if (!cfg) return;
  if (mixerWin && !mixerWin.isDestroyed()) {
    if (mixerWin.isMinimized()) mixerWin.restore();
    mixerWin.focus();
    notifyHost(true); // erneut melden, falls der Host zwischenzeitlich neu lud
    return;
  }
  const win = new BrowserWindow({
    width: 760,
    height: 560,
    minWidth: 360,
    minHeight: 320,
    backgroundColor: '#121212',
    show: false,
    title: 'JM DAW — Mixer',
    icon: cfg.iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: cfg.preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.on('ready-to-show', () => {
    win.show();
    notifyHost(true);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => {
    mixerWin = null;
    notifyHost(false);
  });
  if (cfg.rendererUrl) win.loadURL(`${cfg.rendererUrl}#mixer`);
  else win.loadFile(cfg.rendererFile, { hash: 'mixer' });
  mixerWin = win;
}

export function setupMixerWindow(setup: Setup): void {
  cfg = setup;
  ipcMain.handle('mixer:open', () => {
    openMixerWindow();
  });
  // Host → Popout (fire-and-forget, hohe Frequenz).
  ipcMain.on('mixer:snapshot', (_e, snap) => {
    if (mixerWin && !mixerWin.isDestroyed()) mixerWin.webContents.send('mixer:snapshot', snap);
  });
  // Popout → Host.
  ipcMain.on('mixer:command', (_e, cmd) => {
    const host = cfg?.getHost();
    if (host && !host.isDestroyed()) host.webContents.send('mixer:command', cmd);
  });
}

export function closeMixerWindow(): void {
  if (mixerWin && !mixerWin.isDestroyed()) mixerWin.close();
  mixerWin = null;
}

// System-Tray: hält die App im Hintergrund am Leben (NDI-Sender laufen weiter,
// während das Fenster versteckt ist) und bietet Fenster-anzeigen / Raum-schließen /
// Beenden. Spiegelt den App-Status (Raum offen? Gäste auf Sendung?).
import { Menu, Tray, nativeImage, type BrowserWindow } from 'electron';
import type { AppStatus, TrayCommand } from '@shared/types';

let tray: Tray | null = null;
let getWindow: () => BrowserWindow | null = () => null;
let sendCommand: (cmd: TrayCommand) => void = () => {};
let onQuit: () => void = () => {};
let status: AppStatus = { configured: false, proxyBase: null, controlPort: 8737, ndiSenders: 0, programState: 'off', programSource: null };

interface TrayDeps {
  iconPath: string;
  getWindow: () => BrowserWindow | null;
  sendCommand: (cmd: TrayCommand) => void;
  onQuit: () => void;
}

export function createTray(deps: TrayDeps): void {
  if (tray) return;
  getWindow = deps.getWindow;
  sendCommand = deps.sendCommand;
  onQuit = deps.onQuit;
  const img = nativeImage.createFromPath(deps.iconPath);
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
  rebuild();
}

function showWindow(): void {
  const w = getWindow();
  if (!w) return;
  if (w.isMinimized()) w.restore();
  w.show();
  w.focus();
}

export function setTrayStatus(s: AppStatus): void {
  status = s;
  rebuild();
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}

function statusLine(): string {
  if (status.ndiSenders > 0) return `● ${status.ndiSenders} Gast/Gäste auf Sendung`;
  if (status.configured) return '○ Bereit';
  return '△ Cloud nicht konfiguriert';
}

function rebuild(): void {
  if (!tray) return;
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: statusLine(), enabled: false },
    { type: 'separator' },
    { label: 'Fenster anzeigen', click: showWindow },
    { label: 'Raum schließen', enabled: status.ndiSenders > 0, click: () => sendCommand({ kind: 'closeRoom' }) },
    { type: 'separator' },
    { label: 'Beenden', click: () => onQuit() },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
  tray.setToolTip(status.ndiSenders > 0 ? 'JM Connect — Zuschaltungen aktiv' : 'JM Connect');
}

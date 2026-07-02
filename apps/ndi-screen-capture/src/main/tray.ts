// System-Tray (#104): hält die App im Hintergrund am Leben, während das Fenster
// geschlossen/versteckt ist (NDI-Versand läuft weiter), und bietet per Rechtsklick
// Status + Einstellungen (Bildrate, System-Audio) + Start/Stopp + Beenden.
// Der Renderer besitzt die Aufnahme; das Tray spiegelt dessen Einstellungen
// (traySync) und schickt Befehle zurück (trayCommand).
import { Menu, Tray, nativeImage, type BrowserWindow } from 'electron';
import type { JmNdiStatus, TrayCommand, TraySettings } from '@shared/types';

let tray: Tray | null = null;
let getWindow: () => BrowserWindow | null = () => null;
let sendCommand: (cmd: TrayCommand) => void = () => {};
let onQuit: () => void = () => {};

let status: JmNdiStatus = { sendState: 'idle', audioEnabled: false };
let settings: TraySettings = { active: false, targetFps: 30, audio: true, sourceName: null };

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

/** Aufnahme-Status ins Tray spiegeln (von der IPC-Status-Push-Stelle). */
export function setTrayStatus(s: JmNdiStatus): void {
  status = s;
  rebuild();
}

/** Renderer-Einstellungen ins Tray spiegeln. */
export function setTraySettings(s: TraySettings): void {
  settings = s;
  rebuild();
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}

function statusLine(): string {
  if (status.sendState === 'sending') {
    const parts = ['● Sendet'];
    if (settings.sourceName) parts.push(settings.sourceName);
    if (typeof status.connections === 'number') parts.push(`${status.connections} Empf.`);
    return parts.join(' · ');
  }
  if (status.sendState === 'error') return '● Fehler';
  if (status.sendState === 'starting') return '◐ Startet…';
  return '○ Bereit';
}

function rebuild(): void {
  if (!tray) return;
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: statusLine(), enabled: false },
  ];
  if (status.width && status.height) {
    const res = `   ${status.width}×${status.height}${status.fps ? ` @ ${Math.round(status.fps)} fps` : ''}`;
    template.push({ label: res, enabled: false });
  }
  template.push(
    { type: 'separator' },
    { label: 'Fenster anzeigen', click: showWindow },
    { type: 'separator' },
    {
      label: 'Bildrate',
      submenu: [
        {
          label: '30 fps',
          type: 'radio',
          checked: settings.targetFps === 30,
          click: () => sendCommand({ kind: 'setFps', fps: 30 }),
        },
        {
          label: '60 fps',
          type: 'radio',
          checked: settings.targetFps === 60,
          click: () => sendCommand({ kind: 'setFps', fps: 60 }),
        },
      ],
    },
    {
      label: 'System-Audio mitsenden',
      type: 'checkbox',
      checked: settings.audio,
      click: (item) => sendCommand({ kind: 'setAudio', audio: item.checked }),
    },
    { type: 'separator' },
    settings.active
      ? { label: 'Versand stoppen', click: () => sendCommand({ kind: 'stop' }) }
      : { label: 'Versand starten', enabled: !!settings.sourceName, click: () => sendCommand({ kind: 'start' }) },
    { type: 'separator' },
    { label: 'Beenden', click: () => onQuit() },
  );
  tray.setContextMenu(Menu.buildFromTemplate(template));
  tray.setToolTip(status.sendState === 'sending' ? 'JM NDI Screen Capture — sendet' : 'JM NDI Screen Capture');
}

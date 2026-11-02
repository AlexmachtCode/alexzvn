// System-Tray: hält die App im Hintergrund am Leben (NDI-Sender und Zoom laufen weiter,
// während das Fenster versteckt ist) und bietet Fenster anzeigen / Raum schließen /
// Zoom-Meeting verlassen / Beenden. Die beiden Statuszeilen (Gäste, Zoom) und der Tooltip
// kommen aus @shared/zoom-text, derselben Quelle wie die Kopfzeile (Spec 7.2–7.4).
import { Menu, Tray, nativeImage, type BrowserWindow } from 'electron';
import type { AppStatus, TrayCommand } from '@shared/types';
import { APP_STATUS_START } from '@shared/app-status';
import { gaesteZeile, trayTooltip, trayVerlassenAktiv, zoomZeile } from '@shared/zoom-text';

let tray: Tray | null = null;
let getWindow: () => BrowserWindow | null = () => null;
let sendCommand: (cmd: TrayCommand) => void = () => {};
let onQuit: () => void = () => {};
let onZoomVerlassen: () => void = () => {};
/** Startwert bis zum ersten Status des Mains (E44, KF10): nichts gemessen. */
let status: AppStatus = APP_STATUS_START;

interface TrayDeps {
  iconPath: string;
  getWindow: () => BrowserWindow | null;
  sendCommand: (cmd: TrayCommand) => void;
  onQuit: () => void;
  /** Tray „Zoom-Meeting verlassen“: wirkt immer als „Verlassen“ nach Spec 6.8 (ohne Fehler, ohne Alarm). */
  onZoomVerlassen: () => void;
}

export function createTray(deps: TrayDeps): void {
  if (tray) return;
  getWindow = deps.getWindow;
  sendCommand = deps.sendCommand;
  onQuit = deps.onQuit;
  onZoomVerlassen = deps.onZoomVerlassen;
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

// Menü nach Spec 7.3: Gäste-Zeile, Zoom-Zeile (nur Windows), Trenner, „Fenster anzeigen“,
// „Raum schließen“ (unverändert), „Zoom-Meeting verlassen“ (aktiv in Z3–Z11), Trenner, „Beenden“.
function rebuild(): void {
  if (!tray) return;
  const template: Electron.MenuItemConstructorOptions[] = [{ label: gaesteZeile(status), enabled: false }];
  const zoomText = zoomZeile(status.zoom);
  if (zoomText !== null) template.push({ label: zoomText, enabled: false });
  template.push(
    { type: 'separator' },
    { label: 'Fenster anzeigen', click: showWindow },
    // „Raum schließen“ hängt wie bisher an e (jeder Eintrag, jeder Zustand, E42); es wirkt über das Hauptfenster (E58).
    { label: 'Raum schließen', enabled: status.ndiGaeste.length > 0, click: () => sendCommand({ kind: 'closeRoom' }) },
  );
  if (status.zoom !== null) {
    template.push({
      label: 'Zoom-Meeting verlassen',
      enabled: trayVerlassenAktiv(status.zoom),
      click: () => onZoomVerlassen(),
    });
  }
  template.push({ type: 'separator' }, { label: 'Beenden', click: () => onQuit() });
  tray.setContextMenu(Menu.buildFromTemplate(template));
  tray.setToolTip(trayTooltip(status));
}

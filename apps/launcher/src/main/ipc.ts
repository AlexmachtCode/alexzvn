import { app, ipcMain, shell } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import type {
  ActionResult,
  FeedbackInput,
  InstallProgress,
  RecipeDraftInput,
  SuiteSettingsInput,
} from '@shared/types';
import type { ToolManifest } from '@jm/suite-manifest';
import type { Show } from '@jm/show';
import { getTool, getTools } from './manifest';
import { getChangelog } from './changelog';
import { getCookbook } from './cookbook';
import { getAllStates } from './install-state';
import { getPresence } from './presence';
import { getHealth } from './health';
import { checkToolUpdates, checkLauncherUpdate } from './updates';
import { openTool } from './launch';
import { openShowDialog, saveShow, pickShowDocument } from './show';
import { installTool, updateLauncher } from './installer';
import { uninstallTool } from './uninstall';
import { getSettingsView, setSettings } from './settings';
import { getControlStatus, provisionControl, disableControl } from './control-provision';
import { submitFeedback } from './feedback';
import { submitRecipeDraft } from './cookbook-draft';

function withTool(
  id: string,
  fn: (tool: ToolManifest) => Promise<ActionResult>,
): Promise<ActionResult> {
  const tool = getTool(id);
  if (!tool) return Promise.resolve({ ok: false, message: 'Unbekanntes Tool.' });
  return fn(tool);
}

export function registerIpc(): void {
  // Eigene Launcher-Version (für die Anzeige im Header, Issue #12).
  ipcMain.handle('app:version', () => app.getVersion());

  ipcMain.handle('suite:list', () => getTools());
  // App-Patchnotes (live geladen, sonst gebündelter Fallback) — Issue #19.
  ipcMain.handle('changelog:get', () => getChangelog());
  // Kochbuch-Rezepte (live geladen, sonst gebündelter Fallback).
  ipcMain.handle('cookbook:get', () => getCookbook());
  ipcMain.handle('suite:state', () => getAllStates(getTools()));
  // Laufzeit-Zustand (welche Tools laufen gerade) für das Health-Dashboard.
  ipcMain.handle('presence:get', () => getPresence());
  // Live-Zustand der entdeckten Steuer-Endpunkte (REC/On-Air/…) fürs Dashboard.
  ipcMain.handle('health:get', () => getHealth());
  // Live-Update-Prüfung gegen die Releases (online, sonst unveränderte Zustände).
  ipcMain.handle('suite:check-updates', () => checkToolUpdates(getTools()));

  ipcMain.handle('tool:open', (_e, id: string) => withTool(id, openTool));

  // Show öffnen (Datei-Dialog) und die referenzierten Tools koordiniert starten.
  // Start-Feedback (#76) an das aufrufende Fenster senden.
  ipcMain.handle('show:open', (e) => openShowDialog((ev) => e.sender.send('app:event', ev)));
  // Show anlegen/bearbeiten: speichern + Dokument-Auswahl für die Authoring-UI.
  ipcMain.handle('show:save', (_e, show: Show) => saveShow(show));
  ipcMain.handle('show:pickDocument', () => pickShowDocument());

  // Download + Installation aus der konfigurierten Release-Quelle, mit
  // Fortschritt an das aufrufende Fenster. Update == Install der neuesten Version.
  const runInstall = (e: IpcMainInvokeEvent, id: string) =>
    withTool(id, (tool) =>
      installTool(tool, (p: InstallProgress) => e.sender.send('suite:progress', p)),
    );
  ipcMain.handle('tool:install', runInstall);
  ipcMain.handle('tool:update', runInstall);
  ipcMain.handle('tool:uninstall', (_e, id: string) => withTool(id, uninstallTool));

  // Launcher-Self-Update: Info abfragen + Download/Install (beendet die App).
  ipcMain.handle('launcher:update-info', () => checkLauncherUpdate(getTools()));
  ipcMain.handle('launcher:update', (e: IpcMainInvokeEvent) =>
    updateLauncher((p: InstallProgress) => e.sender.send('suite:progress', p)),
  );

  ipcMain.handle('settings:get', () => getSettingsView());
  ipcMain.handle('settings:set', (_e, input: SuiteSettingsInput) => setSettings(input));

  // Sichere Steuerebene (P1): Status lesen, provisionieren, deaktivieren.
  ipcMain.handle('control:status', () => getControlStatus());
  ipcMain.handle('control:provision', () => provisionControl());
  ipcMain.handle('control:disable', () => disableControl());

  // Bug-/Wunsch-Meldung → GitHub-Issue (via Proxy, sonst Token-Fallback).
  ipcMain.handle('feedback:submit', (_e, input: FeedbackInput) => submitFeedback(input));

  // Neues Rezept einreichen (Pfad B = KI) → Proxy erzeugt das Rezept und öffnet einen PR.
  ipcMain.handle('cookbook:draft', (_e, input: RecipeDraftInput) => submitRecipeDraft(input));

  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));
}

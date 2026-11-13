import { app, dialog, ipcMain } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  GeladeneDateien,
  ImportedFile,
  OfficeImportResult,
  PresentationPayload,
  RemoteConfig,
  ScreenMode,
  SourceKind,
  TimerSyncConfig,
} from '@shared/types';
import { IMAGE_EXT, OFFICE_EXT } from '@shared/dateien';
import { ladeDateien, pruefeImportPfade } from './dateien-laden';
import { importOfficeFile } from './office/import';
import {
  broadcastAll,
  getDisplays,
  getEditorWindow,
  moveAudienceToDisplay,
  toggleAudienceFullscreen,
} from './windows';
import {
  getPayload,
  getState,
  goto,
  next,
  prev,
  setSchleife,
  setScreen,
  startPresentation,
  stopPresentation,
} from './present';
import {
  applyRemoteConfig,
  getRemoteStatus,
  listInterfaces,
  setRemoteStatusHandler,
  shutdownRemote,
} from './remote';
import { loadRemoteConfig, saveRemoteConfig } from './remote-config';
import {
  applyTimerConfig,
  getTimerConfig,
  getTimerState,
  setTimerStateHandler,
  shutdownTimer,
} from './timer-sync';
import { loadTimerConfig, saveTimerConfig } from './timer-config';

function kindFor(filePath: string): SourceKind {
  return path.extname(filePath).toLowerCase() === '.pdf' ? 'pdf' : 'image';
}

async function readImported(filePath: string): Promise<ImportedFile> {
  const bytes = new Uint8Array(await readFile(filePath));
  return { name: path.basename(filePath), kind: kindFor(filePath), bytes };
}

export function registerIpc(): void {
  const editor = (): Electron.BrowserWindow | null => getEditorWindow();

  // ---- File import / project IO ----

  ipcMain.handle('files:importDocs', async (): Promise<ImportedFile[]> => {
    const win = editor();
    const options: Electron.OpenDialogOptions = {
      title: 'PDF oder Bilder importieren',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Präsentationen & Bilder', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled) return [];
    return Promise.all(result.filePaths.map(readImported));
  });

  ipcMain.handle('files:importImage', async (): Promise<ImportedFile | null> => {
    const win = editor();
    const options: Electron.OpenDialogOptions = {
      title: 'Bild / Logo wählen',
      properties: ['openFile'],
      filters: [{ name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    const [filePath] = result.filePaths;
    if (!IMAGE_EXT.has(path.extname(filePath).toLowerCase())) return null;
    return readImported(filePath);
  });

  ipcMain.handle(
    'files:importOffice',
    async (_e, expandBuilds?: boolean): Promise<OfficeImportResult> => {
      const win = editor();
      const options: Electron.OpenDialogOptions = {
        title: 'Office-Dokument importieren (LibreOffice nötig)',
        properties: ['openFile'],
        filters: [
          {
            name: 'Office-Dokumente',
            extensions: [...OFFICE_EXT].map((e) => e.slice(1)),
          },
        ],
      };
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, error: 'Abgebrochen.' };
      }
      return importOfficeFile(result.filePaths[0], !!expandBuilds);
    },
  );

  ipcMain.handle(
    'files:importPaths',
    (e, pfade: unknown, expandBuilds: unknown): Promise<GeladeneDateien> => {
      const leer = { files: [], projekt: null, hinweise: [] };
      // Nur das Editor-Fenster darf Dateien per Pfad laden (alle Fenster teilen den Preload).
      if (e.sender !== getEditorWindow()?.webContents) return Promise.resolve(leer);
      const geprueft = pruefeImportPfade(pfade);
      if (!geprueft) return Promise.resolve(leer);
      return ladeDateien(geprueft, { expandBuilds: expandBuilds === true });
    },
  );

  ipcMain.handle('files:openProject', async () => {
    const win = editor();
    const options: Electron.OpenDialogOptions = {
      title: 'Projekt öffnen',
      properties: ['openFile'],
      filters: [{ name: 'JM Presenter Projekt', extensions: ['jmpres'] }],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    const [filePath] = result.filePaths;
    const bytes = new Uint8Array(await readFile(filePath));
    return { name: path.basename(filePath), bytes };
  });

  ipcMain.handle(
    'files:saveProject',
    async (_e, suggestedName: string, bytes: Uint8Array): Promise<string | null> => {
      const win = editor();
      const options: Electron.SaveDialogOptions = {
        title: 'Projekt speichern',
        defaultPath: suggestedName.endsWith('.jmpres') ? suggestedName : `${suggestedName}.jmpres`,
        filters: [{ name: 'JM Presenter Projekt', extensions: ['jmpres'] }],
      };
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return null;
      await writeFile(result.filePath, bytes);
      return result.filePath;
    },
  );

  ipcMain.handle(
    'files:savePdf',
    async (_e, suggestedName: string, bytes: Uint8Array): Promise<string | null> => {
      const win = editor();
      const options: Electron.SaveDialogOptions = {
        title: 'Als PDF exportieren',
        defaultPath: suggestedName.endsWith('.pdf') ? suggestedName : `${suggestedName}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      };
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return null;
      await writeFile(result.filePath, bytes);
      return result.filePath;
    },
  );

  // ---- Presentation control ----

  ipcMain.handle(
    'present:start',
    (_e, payload: PresentationPayload, audienceDisplayId: number | null) => {
      startPresentation(payload, audienceDisplayId);
    },
  );
  ipcMain.handle('present:getPayload', () => getPayload());
  ipcMain.handle('present:getState', () => getState());
  ipcMain.handle('present:goto', (_e, index: number) => goto(index));
  ipcMain.handle('present:next', () => next());
  ipcMain.handle('present:prev', () => prev());
  ipcMain.handle('present:stop', () => stopPresentation());
  ipcMain.handle('present:setScreen', (_e, mode: ScreenMode) => setScreen(mode));
  ipcMain.handle('present:setSchleife', (_e, an: boolean) => setSchleife(an === true));
  ipcMain.handle('present:displays', () => getDisplays());
  ipcMain.handle('present:assignAudience', (_e, displayId: number) =>
    moveAudienceToDisplay(displayId),
  );
  ipcMain.handle('present:toggleAudienceFullscreen', () => toggleAudienceFullscreen());

  // ---- Network remote (phone clicker) ----

  // Push server status (start/stop/error) to all windows so the presenter UI's
  // toggle stays in sync even if the server stops on its own (e.g. port clash).
  setRemoteStatusHandler((status) => broadcastAll('remote:status', status));

  ipcMain.handle('remote:interfaces', () => listInterfaces());
  ipcMain.handle('remote:status', () => getRemoteStatus());
  ipcMain.handle('remote:apply', async (_e, config: RemoteConfig) => {
    saveRemoteConfig(config);
    return applyRemoteConfig(config);
  });

  // Restore the persisted remote on launch (operator enabled it once).
  const saved = loadRemoteConfig();
  if (saved.enabled) void applyRemoteConfig(saved);

  // ---- Timer sync (live countdown from JM Timer) ----

  // Push live timer state to all windows so the presenter readout updates even
  // while the operator is in the editor.
  setTimerStateHandler((state) => broadcastAll('timer:state', state));

  ipcMain.handle('timer:getState', () => getTimerState());
  ipcMain.handle('timer:getConfig', () => getTimerConfig());
  ipcMain.handle('timer:apply', (_e, config: TimerSyncConfig) => {
    saveTimerConfig(config);
    return applyTimerConfig(config);
  });

  // Restore the persisted timer connection on launch.
  applyTimerConfig(loadTimerConfig());

  app.on('will-quit', () => {
    shutdownRemote();
    shutdownTimer();
  });
}

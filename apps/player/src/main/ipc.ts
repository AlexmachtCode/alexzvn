import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import type {
  CueInput,
  OutputCommand,
  OutputTime,
  PlaylistKind,
  RemotePlayerState,
  ShowCuePatch,
} from '@shared/types';
import * as lib from './library';
import { updatePlayerState } from './control-server';
import { ensureThumb } from './thumbs';
import {
  ausgabeZustand,
  closeOutputWindow,
  isOutputFullscreen,
  isOutputOpen,
  listDisplays,
  openOutputWindow,
  sendToOutput,
  toggleOutputFullscreen,
} from './output-window';

const MEDIA_EXT = [
  'mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'mpg', 'mpeg', 'wmv',
  'mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus', 'aif', 'aiff', 'wma',
];

export function registerIpc(getWin: () => BrowserWindow | null): void {
  ipcMain.handle('dialog:pickFolders', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'multiSelections'] });
    return r.canceled ? [] : r.filePaths;
  });
  ipcMain.handle('dialog:pickFiles', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Medien', extensions: MEDIA_EXT }],
    });
    return r.canceled ? [] : r.filePaths;
  });

  ipcMain.handle('library:list', () => lib.listItems());
  ipcMain.handle('library:import', (_e, paths: string[]) => lib.importPaths(paths));
  ipcMain.handle('library:remove', (_e, id: number) => lib.removeItem(id));
  ipcMain.handle('library:thumb', (_e, id: number) => ensureThumb(id));
  ipcMain.handle('library:markPlayed', (_e, id: number) => lib.markPlayed(id));

  ipcMain.handle('playlists:list', () => lib.listPlaylists());
  ipcMain.handle('playlists:create', (_e, name: string, kind?: PlaylistKind) =>
    lib.createPlaylist(name, kind),
  );
  ipcMain.handle('playlists:rename', (_e, id: number, name: string) => lib.renamePlaylist(id, name));
  ipcMain.handle('playlists:remove', (_e, id: number) => lib.removePlaylist(id));
  ipcMain.handle('playlists:items', (_e, playlistId: number) => lib.playlistItems(playlistId));
  ipcMain.handle('playlists:addItems', (_e, playlistId: number, mediaIds: number[]) =>
    lib.addPlaylistItems(playlistId, mediaIds),
  );
  ipcMain.handle('playlists:removeItem', (_e, itemId: number) => lib.removePlaylistItem(itemId));
  ipcMain.handle('playlists:reorder', (_e, playlistId: number, ids: number[]) =>
    lib.reorderPlaylist(playlistId, ids),
  );

  ipcMain.handle('cues:list', (_e, playlistId: number) => lib.listCues(playlistId));
  ipcMain.handle('cues:assign', (_e, input: CueInput) => lib.assignCue(input));
  ipcMain.handle('cues:clear', (_e, playlistId: number, slot: number) => lib.clearCue(playlistId, slot));

  ipcMain.handle('shows:list', () => lib.listShows());
  ipcMain.handle('shows:create', (_e, name: string) => lib.createShow(name));
  ipcMain.handle('shows:rename', (_e, id: number, name: string) => lib.renameShow(id, name));
  ipcMain.handle('shows:remove', (_e, id: number) => lib.removeShow(id));
  ipcMain.handle('shows:cues', (_e, showId: number) => lib.showCues(showId));
  ipcMain.handle('shows:addCues', (_e, showId: number, mediaIds: number[]) =>
    lib.addShowCues(showId, mediaIds),
  );
  ipcMain.handle('shows:removeCue', (_e, cueId: number) => lib.removeShowCue(cueId));
  ipcMain.handle('shows:reorder', (_e, showId: number, ids: number[]) => lib.reorderShow(showId, ids));
  ipcMain.handle('shows:updateCue', (_e, cueId: number, patch: ShowCuePatch) =>
    lib.updateShowCue(cueId, patch),
  );

  // Video-Ausgabefenster (2. Screen).
  ipcMain.handle('output:displays', () => listDisplays());
  ipcMain.handle('output:open', (_e, displayId?: number) => openOutputWindow(displayId));
  ipcMain.handle('output:close', () => closeOutputWindow());
  ipcMain.handle('output:isOpen', () => isOutputOpen());
  // UX Welle 2a: gemessener Zustand und gemessenes Vollbild des Ausgabefensters, nur lesend.
  ipcMain.handle('output:zustand', () => ausgabeZustand());
  ipcMain.handle('output:isFullscreen', () => isOutputFullscreen());
  ipcMain.handle('output:toggleFullscreen', () => toggleOutputFullscreen());
  ipcMain.handle('output:command', (_e, cmd: OutputCommand) => sendToOutput(cmd));
  // Ausgabefenster meldet „Video zu Ende" → ans Hauptfenster weiterreichen.
  ipcMain.handle('output:ended', () => {
    getWin()?.webContents.send('output:ended');
  });
  // Ausgabefenster meldet die Wiedergabe-Position → ans Hauptfenster (Issue #41).
  ipcMain.handle('output:time', (_e, t: OutputTime) => {
    getWin()?.webContents.send('output:time', t);
  });

  // TCP-Fernsteuerung: Renderer meldet seinen Wiedergabe-Zustand → Steuerserver.
  ipcMain.handle('remote:reportState', (_e, state: RemotePlayerState) => updatePlayerState(state));

  ipcMain.handle('shell:reveal', (_e, p: string) => {
    shell.showItemInFolder(p);
  });
  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url));
}

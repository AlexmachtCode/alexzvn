import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import type { ArmInput, GeladeneEinstellungen, RecordInput, ScheduleInput } from '@shared/types';
import * as rec from './recorder';
import { ladeEinstellungen, speichereEinstellungen } from './einstellungen';

/** Gemerkte Einstellungen (#291) — eine Datei je Windows-Benutzer, überlebt Updates. */
function einstellungsDatei(): string {
  return join(app.getPath('userData'), 'recorder-settings.json');
}

export function registerIpc(getWin: () => BrowserWindow | null): void {
  rec.setWindowGetter(getWin);

  ipcMain.handle('rec:listDevices', () => rec.listDevices());
  ipcMain.handle('rec:arm', (_e, input: ArmInput) => rec.arm(input));
  ipcMain.handle('rec:disarm', () => rec.disarm());
  ipcMain.handle('rec:start', (_e, input: RecordInput) => rec.startRecording(input));
  ipcMain.handle('rec:stop', () => rec.stopRecording());
  ipcMain.handle('rec:schedule', (_e, input: ScheduleInput) => rec.schedule(input));
  ipcMain.handle('rec:cancelSchedule', () => rec.cancelSchedule());
  ipcMain.handle('rec:state', () => rec.getState());
  ipcMain.handle('rec:setGain', (_e, db: number) => rec.setGain(db));

  ipcMain.handle('settings:load', (): GeladeneEinstellungen => {
    const einstellungen = ladeEinstellungen(einstellungsDatei());
    return { einstellungen, ordnerDa: einstellungen.dir ? existsSync(einstellungen.dir) : null };
  });
  ipcMain.on('settings:save', (_e, raw: unknown) => {
    try {
      speichereEinstellungen(einstellungsDatei(), raw);
    } catch (err) {
      getLog().error(`Einstellungen nicht gespeichert: ${(err as Error).message}`);
    }
  });

  ipcMain.handle('dialog:pickDir', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
  });

  ipcMain.handle('shell:reveal', (_e, p: string) => {
    shell.showItemInFolder(p);
  });
}

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import type { ArmInput, GeladeneEinstellungen, KonfliktWahl, PresetDateiErgebnis, RecordInput, RecPreset, ScheduleInput } from '@shared/types';
import * as rec from './recorder';
import { ladeEinstellungen, speichereEinstellungen } from './einstellungen';
import { importiere, ladePresets, speicherePresets } from './presets';
import { baueExportDatei, EXPORT_MAX_BYTES, normierePreset } from '../shared/presets';

/** Gemerkte Einstellungen (#291) — eine Datei je Windows-Benutzer, überlebt Updates. */
function einstellungsDatei(): string {
  return join(app.getPath('userData'), 'recorder-settings.json');
}

/** Gespeicherte Presets — eine Datei je Windows-Benutzer, neben den Einstellungen. */
function presetDatei(): string {
  return join(app.getPath('userData'), 'recorder-presets.json');
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

  ipcMain.handle('fs:ordnerDa', (_e, dir: unknown) => typeof dir === 'string' && dir !== '' && existsSync(dir));

  ipcMain.handle('presets:list', (): RecPreset[] => ladePresets(presetDatei()));
  ipcMain.handle('presets:speichern', (_e, raw: unknown): RecPreset[] => {
    const liste = ladePresets(presetDatei());
    const p = normierePreset(raw);
    if (!p) return liste;
    const i = liste.findIndex((v) => v.name === p.name);
    if (i < 0) liste.push(p);
    else liste[i] = p;
    return speicherePresets(presetDatei(), liste);
  });
  ipcMain.handle('presets:loeschen', (_e, name: string): RecPreset[] =>
    speicherePresets(presetDatei(), ladePresets(presetDatei()).filter((p) => p.name !== name)),
  );
  ipcMain.handle('presets:exportieren', async (): Promise<PresetDateiErgebnis> => {
    const liste = ladePresets(presetDatei());
    if (!liste.length) return { ok: false, error: 'Keine Presets zum Exportieren.' };
    const win = getWin();
    const opts = {
      defaultPath: 'Recorder-Presets.jmrec-presets',
      filters: [{ name: 'Recorder-Presets', extensions: ['jmrec-presets'] }],
    };
    const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (r.canceled || !r.filePath) return { ok: false };
    try {
      writeFileSync(r.filePath, baueExportDatei(liste, new Date()), 'utf8');
    } catch (err) {
      return { ok: false, error: `Export fehlgeschlagen: ${(err as Error).message}` };
    }
    const n = liste.length;
    return { ok: true, meldung: `${n} ${n === 1 ? 'Preset' : 'Presets'} exportiert: ${r.filePath}` };
  });
  ipcMain.handle('presets:importieren', async (): Promise<PresetDateiErgebnis> => {
    const win = getWin();
    const opts = {
      properties: ['openFile' as const],
      filters: [
        { name: 'Recorder-Presets', extensions: ['jmrec-presets'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    };
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    if (r.canceled || r.filePaths.length === 0) return { ok: false };
    let text: string;
    try {
      if (statSync(r.filePaths[0]).size > EXPORT_MAX_BYTES) {
        return { ok: false, error: 'Die Datei ist zu groß für eine Preset-Datei.' };
      }
      text = readFileSync(r.filePaths[0], 'utf8');
    } catch (err) {
      return { ok: false, error: `Datei nicht lesbar: ${(err as Error).message}` };
    }
    const frage = async (konflikte: string[]): Promise<KonfliktWahl> => {
      const opt = {
        type: 'question' as const,
        buttons: ['Überschreiben', 'Beide behalten', 'Abbrechen'],
        defaultId: 1,
        cancelId: 2,
        message: `${konflikte.length} ${konflikte.length === 1 ? 'Preset gibt' : 'Presets gibt'} es schon: ${konflikte.map((k) => `„${k}“`).join(', ')}`,
        detail: 'Überschreiben ersetzt die vorhandenen. Beide behalten legt die neuen als „Name (2)“ an.',
      };
      const m = win ? await dialog.showMessageBox(win, opt) : await dialog.showMessageBox(opt);
      return (['ueberschreiben', 'beide', 'abbrechen'] as const)[m.response] ?? 'abbrechen';
    };
    const erg = await importiere(ladePresets(presetDatei()), text, frage);
    if (!erg.ok || !erg.presets) return erg;
    try {
      return { ...erg, presets: speicherePresets(presetDatei(), erg.presets) };
    } catch (err) {
      return { ok: false, error: `Presets nicht gespeichert: ${(err as Error).message}` };
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

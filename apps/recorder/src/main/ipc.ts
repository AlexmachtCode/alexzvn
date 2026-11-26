import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import type { ArmInput, GeladeneEinstellungen, KonfliktWahl, NetzWahl, OpResult, PresetDateiErgebnis, RecordInput, RecPreset, ScheduleInput } from '@shared/types';
import * as rec from './recorder';
import { ladeEinstellungen, speichereEinstellungen } from './einstellungen';
import { NetzordnerListe } from './netzordner';
import { PlatzAbfrage } from './platz';
import { importiere, ladePresets, netzwerkHinweis, speicherePresets } from './presets';
import { baueExportDatei, EXPORT_MAX_BYTES, istErlaubterOrdner, istNetzwerkPfad, normierePreset, saeubereAnzeige } from '../shared/presets';

/** Gemerkte Einstellungen (#291) — eine Datei je Windows-Benutzer, überlebt Updates. */
function einstellungsDatei(): string {
  return join(app.getPath('userData'), 'recorder-settings.json');
}

/** Gespeicherte Presets — eine Datei je Windows-Benutzer, neben den Einstellungen. */
function presetDatei(): string {
  return join(app.getPath('userData'), 'recorder-presets.json');
}

/** Bestätigte Netzwerkordner (Altfehler RE-7b) — eine Datei je Windows-Benutzer, neben den Einstellungen. */
function netzordnerDatei(): string {
  return join(app.getPath('userData'), 'recorder-netzordner.json');
}

let netzordner: NetzordnerListe | null = null;
/** Die Liste der bestätigten Netzwerkordner: einmal erzeugt und beim ersten Aufruf geladen (lokale Datei, kein Netzzugriff). */
export function netzordnerListe(): NetzordnerListe {
  if (netzordner === null) {
    netzordner = new NetzordnerListe(netzordnerDatei());
    netzordner.laden();
  }
  return netzordner;
}

/** Schreibfehler der Liste: ins Protokoll; im Speicher gilt die Bestätigung trotzdem (bis zum nächsten Start). */
const nichtGemerkt = (err: unknown): void => getLog().error(`Netzwerkordner nicht gemerkt: ${(err as Error).message}`);

export function registerIpc(getWin: () => BrowserWindow | null): void {
  rec.setWindowGetter(getWin);
  // Altfehler RE-3 (D3): endet eine Aufnahme mit einem Fehler, schreibt der Aufnahmekern eine Zeile ins Protokoll (500 Zeichen).
  rec.setProtokoll((zeile) => getLog().warn(zeile.slice(0, 500)));

  /**
   * Altfehler RE-2, Ruling R11: ein abgelehntes oder gescheitertes Öffnen oder Schließen des Eingangs bekommt eine Logzeile. Lehnte der
   * Wächter des Hauptprozesses einen Fernbefehl im Wettlauf ab (das Fenster hielt die Aufnahme noch nicht für laufend), steht dazu der
   * Hinweis der Store-Ablehnung bis „OK“ im Fenster (recorder:notice), wie bei jedem abgelehnten Fernbefehl.
   */
  const meldeWettlauf = (verb: 'ARM' | 'DISARM', r: OpResult): OpResult => {
    if (r.ok) return r;
    const w = rec.wettlaufAblehnung(verb, r);
    getLog().warn((w?.log ?? `${verb} fehlgeschlagen: ${r.error ?? ''}`).slice(0, 500));
    const win = getWin();
    if (w && win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('recorder:notice', w.hinweis);
    return r;
  };

  ipcMain.handle('rec:listDevices', () => rec.listDevices());
  ipcMain.handle('rec:arm', (_e, input: ArmInput) => meldeWettlauf('ARM', rec.arm(input)));
  // Altfehler RE-2: „Eingang schließen“ lehnt in der Aufnahme ab (OpResult), disarm() bleibt für shutdown() und arm().
  ipcMain.handle('rec:disarm', () => meldeWettlauf('DISARM', rec.schliesseEingang()));
  ipcMain.handle('rec:start', (_e, input: RecordInput) => rec.startRecording(input));
  ipcMain.handle('rec:stop', () => rec.stopRecording());
  ipcMain.handle('rec:schedule', (_e, input: ScheduleInput) => rec.schedule(input));
  ipcMain.handle('rec:cancelSchedule', () => rec.cancelSchedule());
  ipcMain.handle('rec:state', () => rec.getState());
  ipcMain.handle('rec:setGain', (_e, db: number) => rec.setGain(db));

  // B6 (Altfehler RE-2, RE-2b, RE-7b): ein abgelehnter Fernbefehl. Der Renderer hat schon nichts getan; hier eine Logzeile und die
  // Meldung bis „OK“ im Fenster (recorder:notice). Protokoll und Companion-Modul bleiben unverändert.
  ipcMain.handle('recorder:ablehnung', (_e, a: unknown): void => {
    const { hinweis, log } = (a ?? {}) as { hinweis?: unknown; log?: unknown };
    if (typeof log === 'string') getLog().warn(log.slice(0, 500));
    const win = getWin();
    if (typeof hinweis === 'string' && win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send('recorder:notice', hinweis.slice(0, 500));
    }
  });

  // Altfehler RE-7b: kein existsSync mehr auf den gemerkten Ordner — ein unerreichbares NAS hielte den Hauptprozess (Fenster, IPC,
  // Companion, Audioblöcke) bis zur Zeitgrenze an. Der Store fragt danach über fs:ordnerDa, ohne zu warten.
  ipcMain.handle('settings:load', (): GeladeneEinstellungen => ({ einstellungen: ladeEinstellungen(einstellungsDatei()), ordnerDa: null }));
  ipcMain.on('settings:save', (_e, raw: unknown) => {
    try {
      speichereEinstellungen(einstellungsDatei(), raw);
    } catch (err) {
      getLog().error(`Einstellungen nicht gespeichert: ${(err as Error).message}`);
    }
  });

  // Altfehler RE-7b: „Übernehmen“ im Fenster bestätigt einen Netzwerkordner aus der Show; nur ein erlaubter Netzwerkordner wird gemerkt.
  ipcMain.handle('recorder:netzordnerBestaetigen', (_e, pfad: unknown): boolean => {
    if (typeof pfad !== 'string' || !istNetzwerkPfad(pfad) || !istErlaubterOrdner(pfad)) return false;
    try {
      netzordnerListe().merke(pfad);
    } catch (err) {
      nichtGemerkt(err);
    }
    return true;
  });

  // Asynchron: ein unerreichbares NAS blockiert sonst den Hauptprozess (und damit die Aufnahme).
  ipcMain.handle('fs:ordnerDa', async (_e, dir: unknown): Promise<boolean> => {
    if (typeof dir !== 'string' || dir === '') return false;
    try {
      await stat(dir);
      return true;
    } catch {
      return false;
    }
  });

  // Altfehler RE-PLATZ (B5): freier Platz im Zielordner, asynchron über statfs; je Pfad eine Messung zugleich, nach 3 s „unbekannt“ (null).
  const platz = new PlatzAbfrage();
  ipcMain.handle('fs:platz', (_e, dir: unknown): Promise<number | null> => (typeof dir === 'string' && dir !== '' ? platz.frage(dir) : Promise.resolve(null)));

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
        message: `${konflikte.length} ${konflikte.length === 1 ? 'Preset gibt' : 'Presets gibt'} es schon: ${konflikte.map((k) => `„${saeubereAnzeige(k)}“`).join(', ')}`,
        detail: 'Überschreiben ersetzt die vorhandenen. Beide behalten legt die neuen als „Name (2)“ an.',
      };
      const m = win ? await dialog.showMessageBox(win, opt) : await dialog.showMessageBox(opt);
      return (['ueberschreiben', 'beide', 'abbrechen'] as const)[m.response] ?? 'abbrechen';
    };
    const netzFrage = async (netzwerk: { name: string; dir: string }[]): Promise<NetzWahl> => {
      const opt = {
        type: 'warning' as const,
        buttons: ['Übernehmen', 'Ohne Netzwerkordner übernehmen', 'Abbrechen'],
        defaultId: 1,
        cancelId: 2,
        ...netzwerkHinweis(netzwerk),
      };
      const m = win ? await dialog.showMessageBox(win, opt) : await dialog.showMessageBox(opt);
      const wahl = (['uebernehmen', 'ohne', 'abbrechen'] as const)[m.response] ?? 'abbrechen';
      // Altfehler RE-7b (B4): „Übernehmen“ bestätigt die genannten Netzwerkordner; eine Show mit einem davon fragt nicht mehr.
      if (wahl === 'uebernehmen') {
        try {
          for (const p of netzwerk) netzordnerListe().merke(p.dir);
        } catch (err) {
          nichtGemerkt(err);
        }
      }
      return wahl;
    };
    const erg = await importiere(ladePresets(presetDatei()), text, frage, netzFrage);
    if (!erg.ok || !erg.presets) return erg;
    let gespeichert: RecPreset[];
    try {
      gespeichert = speicherePresets(presetDatei(), erg.presets);
    } catch (err) {
      return { ok: false, error: `Presets nicht gespeichert: ${(err as Error).message}` };
    }
    return { ...erg, presets: gespeichert };
  });

  ipcMain.handle('dialog:pickDir', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
  });

  ipcMain.handle('shell:reveal', (_e, p: string) => {
    shell.showItemInFolder(p);
  });
}

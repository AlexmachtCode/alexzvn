// Projektdatei-I/O (#89): Öffnen-/Speichern-Dialoge + JSON lesen/schreiben.
// Muster wie apps/daw/src/main/project/io.ts. Renderer ist sandboxed → File-I/O
// läuft hier im Main.
import { BrowserWindow, dialog } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import {
  SWITCHER_FILE_EXT,
  migrateProject,
  type OpenSwitcherResult,
  type SaveSwitcherRequest,
  type SaveSwitcherResult,
  type SwitcherProject,
} from '@shared/project';

const FILTER = { name: 'JM-Switcher-Projekt', extensions: [SWITCHER_FILE_EXT] };

export async function openProject(win: BrowserWindow | null): Promise<OpenSwitcherResult | null> {
  const opts: Electron.OpenDialogOptions = {
    title: 'Switcher-Projekt öffnen',
    filters: [FILTER],
    properties: ['openFile'],
  };
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
  if (r.canceled || !r.filePaths[0]) return null;
  const path = r.filePaths[0];
  const raw = await readFile(path, 'utf8');
  const project = migrateProject(JSON.parse(raw));
  return { path, project };
}

function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim() || 'Switcher-Projekt';
}

export async function saveProject(
  win: BrowserWindow | null,
  req: SaveSwitcherRequest,
): Promise<SaveSwitcherResult | null> {
  let path = req.path;
  if (!path) {
    const opts: Electron.SaveDialogOptions = {
      title: 'Switcher-Projekt speichern',
      defaultPath: `${sanitize(req.project.name)}.${SWITCHER_FILE_EXT}`,
      filters: [FILTER],
    };
    const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (r.canceled || !r.filePath) return null;
    path = r.filePath;
  }
  const project: SwitcherProject = { ...req.project, updatedAt: new Date().toISOString() };
  await writeFile(path, JSON.stringify(project, null, 2), 'utf8');
  return { path };
}

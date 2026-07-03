import { app, ipcMain } from 'electron';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import type { GraphicTemplate, TitlerSlot, TitlerTemplateAddRequest } from '@shared/types';

// Grafik-Vorlagen-Library (#162): importierte Bauchbinden. Auf Platte je Vorlage
// ein Hintergrund-PNG + optionales Thumbnail; die Metadaten (inkl. Slots) stehen in
// index.json. Muster übernommen aus apps/grafiktool/src/main/library/index.ts.

/** On-Disk-Datensatz (thumbDataUrl wird beim Listen aus dem Thumb-PNG rekonstruiert). */
interface StoredTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  slots: TitlerSlot[];
  createdAt: number;
}

function libDir(): string {
  return path.join(app.getPath('userData'), 'templates');
}
function indexPath(): string {
  return path.join(libDir(), 'index.json');
}
function assetPath(id: string): string {
  return path.join(libDir(), `${id}.png`);
}
function thumbPath(id: string): string {
  return path.join(libDir(), `${id}.thumb.png`);
}

async function ensureDir(): Promise<void> {
  if (!existsSync(libDir())) await mkdir(libDir(), { recursive: true });
}

async function readIndex(): Promise<StoredTemplate[]> {
  try {
    return JSON.parse(await readFile(indexPath(), 'utf8')) as StoredTemplate[];
  } catch {
    return [];
  }
}

async function writeIndex(items: StoredTemplate[]): Promise<void> {
  await ensureDir();
  await writeFile(indexPath(), JSON.stringify(items, null, 2));
}

async function toTemplate(s: StoredTemplate): Promise<GraphicTemplate> {
  let thumbDataUrl: string | undefined;
  try {
    const buf = await readFile(thumbPath(s.id));
    thumbDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    /* kein Thumbnail */
  }
  return { ...s, thumbDataUrl };
}

/**
 * IPC der Vorlagen-Library registrieren. `broadcast` wird nach jeder Änderung
 * aufgerufen (Main sendet dann `titler:tpl-changed` an alle Fenster).
 */
export function registerTemplateIpc(broadcast: () => void): void {
  ipcMain.handle('titler:tpl-list', async (): Promise<GraphicTemplate[]> => {
    const items = await readIndex();
    items.sort((a, b) => b.createdAt - a.createdAt);
    return Promise.all(items.map(toTemplate));
  });

  ipcMain.handle('titler:tpl-add', async (_e, req: TitlerTemplateAddRequest): Promise<GraphicTemplate> => {
    await ensureDir();
    const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    await writeFile(assetPath(id), Buffer.from(req.pngBytes));
    if (req.thumbBytes) await writeFile(thumbPath(id), Buffer.from(req.thumbBytes));
    const stored: StoredTemplate = {
      id,
      name: req.name,
      width: req.width,
      height: req.height,
      slots: req.slots,
      createdAt: Date.now(),
    };
    const items = await readIndex();
    items.push(stored);
    await writeIndex(items);
    broadcast();
    return toTemplate(stored);
  });

  ipcMain.handle('titler:tpl-remove', async (_e, id: string): Promise<void> => {
    const items = (await readIndex()).filter((i) => i.id !== id);
    await writeIndex(items);
    for (const p of [assetPath(id), thumbPath(id)]) {
      try {
        await unlink(p);
      } catch {
        /* schon weg */
      }
    }
    broadcast();
  });

  ipcMain.handle('titler:tpl-read-bg', async (_e, id: string): Promise<Uint8Array | null> => {
    try {
      return new Uint8Array(await readFile(assetPath(id)));
    } catch {
      return null;
    }
  });
}

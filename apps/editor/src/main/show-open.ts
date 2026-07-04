import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseShow, parseShowDeepLink } from '@jm/show';
import { getLog } from '@jm/app-runtime';
import { getMainWindow } from '@jm/electron-kit';
import { migrateProject } from '@shared/project';
import type { OpenProjectResult } from '@shared/ipc-types';

// ─────────────────────────────────────────────────────────────────────────────
// Show-Integration (C3): Wird der Editor über einen Show-Deep-Link gestartet
// (jmps://open?show=<pfad>), lädt er das in der .jmshow referenzierte .jmedit-
// Dokument. Der Hauptprozess liest die Bytes und schiebt das (migrierte) Projekt
// dem Fenster zu — es nutzt dieselbe Lade-Logik (loadProject) wie beim manuellen
// „Öffnen". Muster gespiegelt von apps/presenter/src/main/show-open.ts.
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_OPENED_CHANNEL = 'project:opened';

/** Liest das in der Show referenzierte Editor-Dokument (oder null). */
async function resolveShowProject(url: string): Promise<OpenProjectResult | null> {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return null;
  try {
    const show = parseShow(await readFile(showPath, 'utf8'));
    const ref = show.tools.find((t) => t.appId === 'jm-editor');
    if (!ref?.document) return null;
    // Dokumentpfad relativ zur Show-Datei auflösen, falls nicht absolut.
    const docPath = path.isAbsolute(ref.document)
      ? ref.document
      : path.join(path.dirname(showPath), ref.document);
    const project = migrateProject(JSON.parse(await readFile(docPath, 'utf8')));
    return { path: docPath, project };
  } catch (e) {
    getLog().error(`Show-Dokument konnte nicht geladen werden: ${(e as Error).message}`);
    return null;
  }
}

/** Verarbeitet einen Show-Deep-Link: Dokument laden und ans Fenster geben. */
export async function handleShowDeepLink(url: string): Promise<void> {
  const result = await resolveShowProject(url);
  if (!result) return;
  const win = getMainWindow();
  if (!win) return;
  // Kaltstart: der Renderer lädt evtl. noch → nach did-finish-load senden.
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => win.webContents.send(PROJECT_OPENED_CHANNEL, result));
  } else {
    win.webContents.send(PROJECT_OPENED_CHANNEL, result);
  }
}

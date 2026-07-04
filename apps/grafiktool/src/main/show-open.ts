import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import { parseShow, parseShowDeepLink } from '@jm/show';
import { getLog } from '@jm/app-runtime';
import type { OpenedFile } from '@shared/types';

// ─────────────────────────────────────────────────────────────────────────────
// Show-Integration (C3): Wird das Grafiktool über einen Show-Deep-Link gestartet
// (jmps://open?show=<pfad>), lädt es das in der .jmshow referenzierte Dokument
// (i. d. R. ein .jmg-Projekt). Der Hauptprozess liest die Bytes und schiebt sie
// dem Fenster zu, das dieselbe Anwende-Logik wie beim manuellen „Öffnen" nutzt
// (Renderer: .jmg → controller.setDocument, sonst importBytesAsLayer).
// Muster gespiegelt von apps/presenter/src/main/show-open.ts.
// ─────────────────────────────────────────────────────────────────────────────

const FILE_OPENED_CHANNEL = 'file:opened';

/** Liest das in der Show referenzierte Grafiktool-Dokument (oder null). */
async function resolveShowFile(url: string): Promise<OpenedFile | null> {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return null;
  try {
    const show = parseShow(await readFile(showPath, 'utf8'));
    const ref = show.tools.find((t) => t.appId === 'jm-grafiktool');
    if (!ref?.document) return null;
    // Dokumentpfad relativ zur Show-Datei auflösen, falls nicht absolut.
    const docPath = path.isAbsolute(ref.document)
      ? ref.document
      : path.join(path.dirname(showPath), ref.document);
    const bytes = new Uint8Array(await readFile(docPath));
    return { path: docPath, fileName: path.basename(docPath), bytes };
  } catch (e) {
    getLog().error(`Show-Dokument konnte nicht geladen werden: ${(e as Error).message}`);
    return null;
  }
}

/** Verarbeitet einen Show-Deep-Link: Dokument laden und ans Fenster geben. */
export async function handleShowDeepLink(
  url: string,
  getWindow: () => BrowserWindow | null,
): Promise<void> {
  const file = await resolveShowFile(url);
  if (!file) return;
  const win = getWindow();
  if (!win) return;
  // Kaltstart: der Renderer lädt evtl. noch → nach did-finish-load senden.
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => win.webContents.send(FILE_OPENED_CHANNEL, file));
  } else {
    win.webContents.send(FILE_OPENED_CHANNEL, file);
  }
}

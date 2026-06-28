import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import { parseShow, parseShowDeepLink } from '@jm/show';
import { getLog } from '@jm/app-runtime';
import { getEditorWindow } from './windows';

// ─────────────────────────────────────────────────────────────────────────────
// Show-Integration (B4): Wird der Presenter über einen Show-Deep-Link gestartet
// (jmps://open?show=<pfad>), lädt er das in der Show referenzierte .jmpres-
// Dokument. Das Hauptprozess liest die Bytes und schiebt sie dem Editor-Fenster
// zu, das dieselbe Lade-Logik wie beim manuellen „Öffnen" nutzt.
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_OPEN_CHANNEL = 'project:open';

let pending: { name: string; bytes: Uint8Array } | null = null;

/** Liest das in der Show referenzierte Presenter-Dokument (oder null). */
async function resolveShowProject(
  url: string,
): Promise<{ name: string; bytes: Uint8Array } | null> {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return null;
  try {
    const show = parseShow(await readFile(showPath, 'utf8'));
    const ref = show.tools.find((t) => t.appId === 'jm-presenter');
    if (!ref?.document) return null;
    // Dokumentpfad relativ zur Show-Datei auflösen, falls nicht absolut.
    const docPath = path.isAbsolute(ref.document)
      ? ref.document
      : path.join(path.dirname(showPath), ref.document);
    const bytes = new Uint8Array(await readFile(docPath));
    return { name: path.basename(docPath), bytes };
  } catch (e) {
    getLog().error(`Show-Projekt konnte nicht geladen werden: ${(e as Error).message}`);
    return null;
  }
}

function deliver(win: BrowserWindow, project: { name: string; bytes: Uint8Array }): void {
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () =>
      win.webContents.send(PROJECT_OPEN_CHANNEL, project),
    );
  } else {
    win.webContents.send(PROJECT_OPEN_CHANNEL, project);
  }
}

/** Verarbeitet einen Show-Deep-Link: Dokument laden und ans Editor-Fenster geben. */
export async function handleShowDeepLink(url: string): Promise<void> {
  const project = await resolveShowProject(url);
  if (!project) return;
  const win = getEditorWindow();
  if (win) deliver(win, project);
  else pending = project; // Fenster noch nicht da (z. B. mac open-url vor whenReady)
}

/** Ein evtl. vor dem Fenster eingetroffenes Show-Projekt nachliefern. */
export function flushPendingShowProject(): void {
  if (!pending) return;
  const win = getEditorWindow();
  if (!win) return;
  deliver(win, pending);
  pending = null;
}

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import { parseShow, parseShowDeepLink } from '@jm/show';
import { getLog } from '@jm/app-runtime';
import { migrateProject, type OpenSwitcherResult } from '@shared/project';

// ─────────────────────────────────────────────────────────────────────────────
// Show-Integration (C3): Wird der Switcher über einen Show-Deep-Link gestartet
// (jmps://open?show=<pfad>), lädt er das in der Show referenzierte .jmswitch-
// Projekt automatisch. Der Hauptprozess liest + migriert die Datei genau wie
// beim manuellen „Öffnen" (io.ts) und schiebt das Projekt dem Fenster zu, das
// dieselbe Anwende-Logik (applyProject) nutzt.
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_OPENED_CHANNEL = 'project:opened';

let pending: OpenSwitcherResult | null = null;

/** Liest das in der Show referenzierte Switcher-Projekt (oder null). */
async function resolveShowProject(url: string): Promise<OpenSwitcherResult | null> {
  const showPath = parseShowDeepLink(url);
  if (!showPath) return null;
  try {
    const show = parseShow(await readFile(showPath, 'utf8'));
    const ref = show.tools.find((t) => t.appId === 'jm-switcher');
    if (!ref?.document) return null;
    // Dokumentpfad relativ zur Show-Datei auflösen, falls nicht absolut.
    const docPath = path.isAbsolute(ref.document)
      ? ref.document
      : path.join(path.dirname(showPath), ref.document);
    const project = migrateProject(JSON.parse(await readFile(docPath, 'utf8')));
    return { path: docPath, project };
  } catch (e) {
    getLog().error(`Show-Projekt konnte nicht geladen werden: ${(e as Error).message}`);
    return null;
  }
}

function deliver(win: BrowserWindow, result: OpenSwitcherResult): void {
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () =>
      win.webContents.send(PROJECT_OPENED_CHANNEL, result),
    );
  } else {
    win.webContents.send(PROJECT_OPENED_CHANNEL, result);
  }
}

/** Verarbeitet einen Show-Deep-Link: Projekt laden und ans Fenster geben. */
export async function handleShowDeepLink(
  url: string,
  getWin: () => BrowserWindow | null,
): Promise<void> {
  const result = await resolveShowProject(url);
  if (!result) return;
  const win = getWin();
  if (win) deliver(win, result);
  else pending = result; // Fenster noch nicht da (z. B. mac open-url vor whenReady)
}

/** Ein evtl. vor dem Fenster eingetroffenes Show-Projekt nachliefern. */
export function flushPendingShowProject(getWin: () => BrowserWindow | null): void {
  if (!pending) return;
  const win = getWin();
  if (!win) return;
  deliver(win, pending);
  pending = null;
}

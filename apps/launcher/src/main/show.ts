import { dialog } from 'electron';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { parseShow, serializeShow, showOpenUrl, SHOW_FILE_EXT, type Show } from '@jm/show';
import { getLog } from '@jm/app-runtime';
import type { ActionResult, AppEvent } from '@shared/types';
import { getTool } from './manifest';
import { openTool } from './launch';
import { onShowOpened } from './iveo-sync';
import { pushRecentShow } from './settings';

/** Sender für UI-Ereignisse (Show-Start-Feedback, #76). Optional → ohne UI lautlos. */
type EmitAppEvent = (e: AppEvent) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Show-Orchestrierung: eine .jmshow öffnen und alle referenzierten Tools
// koordiniert starten. Jedem Tool wird der Deep-Link jmps://open?show=<pfad>
// als Argument mitgegeben — die App lädt daraus später ihren eigenen Teil (B4).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liest eine Show und startet ihre installierten Tools mit dem Show-Deep-Link.
 * `emit` (optional) gibt der UI ein Start-Feedback (#76): ein `show-launch-start`
 * vor dem Starten (mit der Tool-Liste) und ein `show-launch-done` danach. Die UI
 * tickt die Tools dann via Presence auf „läuft", damit der Nutzer beim langsamen
 * Tool-Kaltstart nicht in der Luft hängt.
 */
export async function openShow(showPath: string, emit?: EmitAppEvent): Promise<ActionResult> {
  let show;
  try {
    show = parseShow(readFileSync(showPath, 'utf8'));
  } catch (e) {
    const message = `Show konnte nicht gelesen werden: ${(e as Error).message}`;
    getLog().error(message);
    return { ok: false, message };
  }

  const deepLink = showOpenUrl(showPath);
  let launched = 0;
  const missing: string[] = [];

  // Start-Feedback mit der vollständigen Tool-Liste (Name aus dem Manifest, sonst
  // die appId) — die UI zeigt das Overlay sofort, bevor die Kaltstarts laufen.
  emit?.({
    type: 'show-launch-start',
    name: show.name,
    tools: show.tools.map((ref) => ({ appId: ref.appId, name: getTool(ref.appId)?.name ?? ref.appId })),
  });

  for (const ref of show.tools) {
    const tool = getTool(ref.appId);
    if (!tool) {
      missing.push(ref.appId);
      continue;
    }
    const res = await openTool(tool, [deepLink]);
    if (res.ok) launched += 1;
    else missing.push(tool.name);
  }

  const message =
    `Show „${show.name}": ${launched}/${show.tools.length} Tools gestartet` +
    (missing.length ? ` · nicht verfügbar: ${missing.join(', ')}` : '');
  getLog().info(message);
  emit?.({ type: 'show-launch-done', launched, total: show.tools.length, missing });
  // Hat die Show eine iveo-Bindung (+ lokal ein Token), Live-Polling starten (#11).
  onShowOpened(showPath, show);
  // Erfolgreich (mindestens ein Tool gestartet) → in die Recent-Liste (#157).
  // Greift für alle Wege hierher: Dialog, Deep-Link und Öffnen-per-Pfad.
  if (launched > 0) pushRecentShow({ path: showPath, name: show.name });
  return { ok: launched > 0, message };
}

/** Öffnet einen Datei-Dialog zur Auswahl einer .jmshow und startet sie. */
export async function openShowDialog(emit?: EmitAppEvent): Promise<ActionResult> {
  const result = await dialog.showOpenDialog({
    title: 'Show öffnen',
    properties: ['openFile'],
    filters: [{ name: 'JM Show', extensions: [SHOW_FILE_EXT.replace(/^\./, '')] }],
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false };
  return openShow(result.filePaths[0], emit);
}

/**
 * Öffnet einen Datei-Dialog, um eine bestehende .jmshow zum BEARBEITEN zu laden
 * (nicht zu starten). Liefert Pfad + geparste Show, damit der Editor sie hydriert.
 */
export async function loadShowForEdit(): Promise<{ path: string; show: Show } | null> {
  const result = await dialog.showOpenDialog({
    title: 'Show bearbeiten',
    properties: ['openFile'],
    filters: [{ name: 'JM Show', extensions: [SHOW_FILE_EXT.replace(/^\./, '')] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const path = result.filePaths[0];
  try {
    return { path, show: parseShow(readFileSync(path, 'utf8')) };
  } catch (e) {
    getLog().error(`Show konnte nicht gelesen werden: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Speichert eine im Launcher zusammengestellte Show als .jmshow. Mit `targetPath`
 * (Bearbeiten) wird direkt an diese Datei zurückgeschrieben; ohne (Neu) fragt ein
 * Save-Dialog nach dem Ziel.
 */
export async function saveShow(show: Show, targetPath?: string): Promise<ActionResult> {
  let filePath = targetPath;
  if (!filePath) {
    const ext = SHOW_FILE_EXT.replace(/^\./, '');
    const safeName = (show.name || 'show').replace(/[\\/:*?"<>|]/g, '_');
    const result = await dialog.showSaveDialog({
      title: 'Show speichern',
      defaultPath: `${safeName}.${ext}`,
      filters: [{ name: 'JM Show', extensions: [ext] }],
    });
    if (result.canceled || !result.filePath) return { ok: false };
    filePath = result.filePath;
  }
  try {
    await writeFile(filePath, serializeShow(show, new Date().toISOString()), 'utf8');
  } catch (e) {
    const message = `Show konnte nicht gespeichert werden: ${(e as Error).message}`;
    getLog().error(message);
    return { ok: false, message };
  }
  return { ok: true, message: `Show „${show.name}" ${targetPath ? 'aktualisiert' : 'gespeichert'}.` };
}

/** Datei-Dialog zur Auswahl eines Tool-Dokuments (z. B. .jmpres, .jmdaw). */
export async function pickShowDocument(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Dokument wählen',
    properties: ['openFile'],
    filters: [
      { name: 'Tool-Dokumente', extensions: ['jmpres', 'jmdaw'] },
      { name: 'Alle Dateien', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
}

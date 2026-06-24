import { app, shell } from 'electron';
import { getLog } from '@jm/app-runtime';
import { createWriteStream, existsSync, statSync } from 'node:fs';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ToolManifest } from '@jm/suite-manifest';
import type { ActionResult, InstallProgress } from '@shared/types';
import { getReleaseSource } from './release-source';
import { installPathFor, recordInstalled } from './install-state';
import { launcherManifest } from './updates';
import { getTools } from './manifest';

type Emit = (progress: InstallProgress) => void;

const execFileAsync = promisify(execFile);
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Wie lange wir auf das Ende des stillen Installers warten, bevor wir den
// Versuch als „unklar" einstufen (oneClick-NSIS installiert i. d. R. < 60 s).
const SILENT_TIMEOUT_MS = 120_000;
// Fenster für die nachgelagerte Verifikation nach dem interaktiven Fallback.
const VERIFY_WINDOW_MS = 5 * 60_000;
const VERIFY_POLL_MS = 2_000;
// Schätz-Fortschritt während der Installation.
const INSTALL_TICK_MS = 450;
const INSTALL_TARGET_PCT = 95;

/**
 * Der stille NSIS-Installer (`/S`) meldet keinen echten Fortschritt. Statt eines
 * unbestimmten Pulses zeigen wir einen geschätzten, monoton steigenden Verlauf:
 * er nähert sich mit abnehmender Geschwindigkeit ~95 % an; den Rest übernimmt der
 * Abschluss (`done`) bzw. die Hintergrund-Verifikation. Liefert eine Stop-Funktion,
 * die das Intervall aufräumt (in jedem Ausgang aufzurufen).
 */
function startInstallProgress(emit: Emit, id: string): () => void {
  let pct = 4;
  emit({ id, phase: 'install', message: 'Installiere…', pct });
  const timer = setInterval(() => {
    pct = Math.min(INSTALL_TARGET_PCT, pct + Math.max(1, Math.round((INSTALL_TARGET_PCT - pct) * 0.08)));
    emit({ id, phase: 'install', message: 'Installiere…', pct });
  }, INSTALL_TICK_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}

interface BinaryStamp {
  exists: boolean;
  mtimeMs: number;
}

/** Zustand der installierten Binär-/App-Datei (für Vorher/Nachher-Vergleich). */
function binaryStamp(tool: ToolManifest): BinaryStamp {
  const p = installPathFor(tool);
  if (!p) return { exists: false, mtimeMs: 0 };
  try {
    return { exists: true, mtimeMs: statSync(p).mtimeMs };
  } catch {
    return { exists: false, mtimeMs: 0 };
  }
}

/**
 * Hat sich die Installation gegenüber `pre` real verändert? Frische Installation
 * (Datei war nicht da → jetzt da) oder Update (Datei wurde neu geschrieben →
 * mtime gewachsen). So unterscheiden wir „wirklich installiert" von „SmartScreen
 * hat geblockt, alte Version liegt noch da".
 */
function isInstalled(tool: ToolManifest, pre: BinaryStamp): boolean {
  const now = binaryStamp(tool);
  if (!now.exists) return false;
  if (!pre.exists) return true;
  return now.mtimeMs > pre.mtimeMs + 1;
}

type SilentOutcome = 'installed' | 'failed' | 'timeout';

/** Windows: stiller NSIS-Lauf via `/S`. */
function runWindowsSilent(dest: string): Promise<SilentOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (o: SilentOutcome) => {
      if (settled) return;
      settled = true;
      resolve(o);
    };
    let child: ChildProcess;
    try {
      child = spawn(dest, ['/S'], { windowsHide: true });
    } catch {
      settle('failed');
      return;
    }
    const timer = setTimeout(() => settle('timeout'), SILENT_TIMEOUT_MS);
    timer.unref?.();
    // 'error' = konnte nicht gestartet werden (z. B. von SmartScreen geblockt).
    child.on('error', () => {
      clearTimeout(timer);
      settle('failed');
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      settle(code === 0 ? 'installed' : 'failed');
    });
  });
}

/** macOS: DMG mounten, .app per ditto kopieren, wieder aushängen (best-effort). */
async function runMacSilent(dest: string, tool: ToolManifest): Promise<SilentOutcome> {
  const appPath = installPathFor(tool);
  if (!appPath) return 'failed';
  let mountPoint: string | null = null;
  try {
    const { stdout } = await execFileAsync('hdiutil', [
      'attach',
      dest,
      '-nobrowse',
      '-noverify',
      '-noautoopen',
    ]);
    const lastLine = stdout.trim().split('\n').pop() ?? '';
    // Mount-Point = letzte Spalte (z. B. "/Volumes/JM Player").
    const mp = lastLine.split('\t').pop()?.trim() || lastLine.split(/\s{2,}/).pop()?.trim();
    if (!mp) return 'failed';
    mountPoint = mp;
    const appName = appPath.split('/').pop();
    if (!appName) return 'failed';
    const src = `${mountPoint}/${appName}`;
    if (!existsSync(src)) return 'failed';
    await execFileAsync('ditto', [src, appPath]);
    return 'installed';
  } catch {
    return 'failed';
  } finally {
    if (mountPoint) {
      try {
        await execFileAsync('hdiutil', ['detach', mountPoint, '-quiet']);
      } catch {
        /* aushängen best-effort */
      }
    }
  }
}

/**
 * Im Hintergrund warten, bis die Binary tatsächlich aktualisiert wurde (User
 * bestätigt den interaktiven Dialog, oder ein noch laufender stiller Installer
 * wird fertig) — dann Version merken und der UI ein abschließendes „done"
 * melden. Der Store frischt bei „done" die Tool-Zustände nach.
 */
async function verifyInBackground(
  tool: ToolManifest,
  version: string,
  pre: BinaryStamp,
  emit: Emit,
): Promise<void> {
  const deadline = Date.now() + VERIFY_WINDOW_MS;
  while (Date.now() < deadline) {
    await delay(VERIFY_POLL_MS);
    if (isInstalled(tool, pre)) {
      recordInstalled(tool.id, version);
      try {
        emit({ id: tool.id, phase: 'done', message: `${tool.name} ${version} installiert.` });
      } catch {
        /* Fenster evtl. weg */
      }
      return;
    }
  }
}

async function download(
  url: string,
  headers: Record<string, string>,
  dest: string,
  expectedSize: number,
  onProgress: (received: number, total: number) => void,
): Promise<void> {
  const res = await fetch(url, { headers });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const total = Number(res.headers.get('content-length')) || expectedSize || 0;
  let received = 0;

  // Bytes IN der Pipeline zählen (Transform), nicht über einen separaten
  // `data`-Listener: letzterer schaltet den Stream in den flowing mode, wodurch
  // je nach Timing die ersten Chunks verloren gehen können, bevor `pipeline` die
  // Pipe verdrahtet → abgeschnittenes File und „NSIS integrity check failed".
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      received += chunk.length;
      onProgress(received, total);
      cb(null, chunk);
    },
  });

  const source = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  await pipeline(source, counter, createWriteStream(dest));

  // Unvollständige Downloads früh und klar abfangen, statt einen kaputten
  // Installer zu starten (der dann mit kryptischem NSIS-Fehler abbricht).
  if (expectedSize && received !== expectedSize) {
    throw new Error(`unvollständiger Download: ${received}/${expectedSize} Bytes`);
  }
}

/**
 * Lädt das passende Release-Artefakt aus der konfigurierten Quelle und startet
 * den lokalen Installer (win: NSIS-EXE, mac: DMG öffnen). Merkt sich die Version.
 */
export async function installTool(tool: ToolManifest, emit: Emit): Promise<ActionResult> {
  const source = getReleaseSource();
  if (!source) {
    return {
      ok: false,
      message: 'Keine Release-Quelle konfiguriert — Token oder Proxy in den Einstellungen hinterlegen.',
    };
  }

  let asset;
  try {
    asset = await source.latest(tool);
  } catch (e) {
    const message = `Release-Abfrage fehlgeschlagen: ${(e as Error).message}`;
    emit({ id: tool.id, phase: 'error', message });
    return { ok: false, message };
  }
  if (!asset) {
    const message = 'Kein passendes Artefakt für diese Plattform gefunden.';
    emit({ id: tool.id, phase: 'error', message });
    return { ok: false, message };
  }

  const dest = join(app.getPath('temp'), asset.fileName);
  try {
    emit({ id: tool.id, phase: 'download', received: 0, total: asset.size, pct: 0 });
    await download(asset.assetUrl, asset.downloadHeaders, dest, asset.size, (received, total) => {
      emit({
        id: tool.id,
        phase: 'download',
        received,
        total,
        pct: total ? Math.round((received / total) * 100) : undefined,
      });
    });
  } catch (e) {
    const message = `Download fehlgeschlagen: ${(e as Error).message}`;
    emit({ id: tool.id, phase: 'error', message });
    return { ok: false, message };
  }

  // Stille Installation versuchen und danach die Binary verifizieren. Erst bei
  // bestätigter Installation die Version merken — sonst meldete der Launcher
  // „installiert", obwohl SmartScreen blockte oder der User abbrach.
  const stopProgress = startInstallProgress(emit, tool.id);
  const pre = binaryStamp(tool);

  let outcome: SilentOutcome;
  try {
    if (process.platform === 'win32') outcome = await runWindowsSilent(dest);
    else if (process.platform === 'darwin') outcome = await runMacSilent(dest, tool);
    else outcome = 'failed';
  } finally {
    stopProgress();
  }
  getLog().info(`Update ${tool.id} → ${asset.version}: Silent-Installer-Ergebnis = ${outcome}`);

  if (outcome === 'installed' && isInstalled(tool, pre)) {
    getLog().info(`Update ${tool.id}: still installiert + Binary verifiziert`);
    recordInstalled(tool.id, asset.version);
    const message = `${tool.name} ${asset.version} installiert.`;
    emit({ id: tool.id, phase: 'done', message });
    return { ok: true, message };
  }

  if (outcome === 'installed') {
    getLog().warn(`Update ${tool.id}: Silent meldete Erfolg, aber Binary unverändert → Fallback`);
  }

  if (outcome === 'timeout') {
    getLog().info(`Update ${tool.id}: Silent-Timeout → Hintergrund-Verifikation, kein zweiter Installer`);
    // Der stille Installer läuft evtl. noch — im Hintergrund auf Abschluss
    // warten und KEINEN zweiten Installer öffnen (Doppelinstallation vermeiden).
    void verifyInBackground(tool, asset.version, pre, emit);
    const message = `${tool.name} ${asset.version}: Installation läuft … Status aktualisiert sich automatisch.`;
    emit({ id: tool.id, phase: 'install', message });
    return { ok: true, message };
  }

  // Fallback (outcome === 'failed'): interaktiv öffnen. Auf unsignierten Builds
  // blockt Windows SmartScreen den stillen Start — openPath zeigt dann den
  // „Trotzdem ausführen"-Dialog (macOS mountet das DMG zum manuellen Ziehen).
  getLog().warn(
    `Update ${tool.id}: Silent nicht möglich (${outcome}) → interaktiver Installer-Fallback ` +
      `(meist unsignierter Build/SmartScreen; echtes Silent-Update erfordert Code-Signing)`,
  );
  emit({
    id: tool.id,
    phase: 'install',
    message: 'Automatische Installation nicht möglich — Installer wird geöffnet, bitte bestätigen.',
  });
  const err = await shell.openPath(dest);
  if (err) {
    const message = `Installer-Start fehlgeschlagen: ${err}`;
    emit({ id: tool.id, phase: 'error', message });
    return { ok: false, message };
  }

  // Im Hintergrund auf den Abschluss warten und dann Version + „done" melden.
  void verifyInBackground(tool, asset.version, pre, emit);
  const message = `${tool.name} ${asset.version}: Installer geöffnet — bitte den Dialog bestätigen. Der Status aktualisiert sich automatisch.`;
  emit({ id: tool.id, phase: 'install', message });
  return { ok: true, message };
}

/**
 * Self-Update des Launchers: lädt den neuesten Launcher-Installer und startet
 * ihn, dann beendet sich der Launcher, damit der Installer die laufenden Dateien
 * ersetzen kann. Fortschritt läuft über die `id: 'launcher'` auf demselben Kanal.
 */
export async function updateLauncher(emit: Emit): Promise<ActionResult> {
  const source = getReleaseSource();
  if (!source) {
    return { ok: false, message: 'Keine Release-Quelle konfiguriert — Token in den Einstellungen hinterlegen.' };
  }
  const launcher = launcherManifest(getTools());
  if (!launcher) return { ok: false, message: 'Launcher-Quelle nicht ermittelbar.' };

  let asset;
  try {
    asset = await source.latest(launcher);
  } catch (e) {
    const message = `Update-Abfrage fehlgeschlagen: ${(e as Error).message}`;
    emit({ id: 'launcher', phase: 'error', message });
    return { ok: false, message };
  }
  if (!asset) {
    const message = 'Kein Launcher-Installer für diese Plattform gefunden.';
    emit({ id: 'launcher', phase: 'error', message });
    return { ok: false, message };
  }

  const dest = join(app.getPath('temp'), asset.fileName);
  try {
    emit({ id: 'launcher', phase: 'download', received: 0, total: asset.size, pct: 0 });
    await download(asset.assetUrl, asset.downloadHeaders, dest, asset.size, (received, total) => {
      emit({
        id: 'launcher',
        phase: 'download',
        received,
        total,
        pct: total ? Math.round((received / total) * 100) : undefined,
      });
    });
  } catch (e) {
    const message = `Download fehlgeschlagen: ${(e as Error).message}`;
    emit({ id: 'launcher', phase: 'error', message });
    return { ok: false, message };
  }

  emit({ id: 'launcher', phase: 'install', message: 'Installer wird gestartet — Launcher beendet sich…' });
  const err = await shell.openPath(dest);
  if (err) {
    const message = `Installer-Start fehlgeschlagen: ${err}`;
    emit({ id: 'launcher', phase: 'error', message });
    return { ok: false, message };
  }
  // Kurz warten, damit die UI-Meldung ankommt und der Installer startet, dann
  // beenden — sonst sind die Launcher-Dateien gesperrt und das Update schlägt fehl.
  setTimeout(() => app.quit(), 2000);
  return { ok: true, message: `Launcher-Update ${asset.version} gestartet.` };
}

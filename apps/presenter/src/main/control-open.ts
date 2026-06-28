// Steuerbefehl `PRESENTER OPEN <pfad>` (Rundown/Companion, Issue #81): legt die
// referenzierte Datei als Präsentation vor. Eine „Speaker-Präsentation" ist real
// fast immer ein PDF oder PowerPoint — NICHT das .jmpres-Projektformat. Darum
// routen wir nach Dateiendung auf dieselben Wege wie der manuelle Import:
//
//   .jmpres              → vollständiges Projekt laden  (Kanal project:open)
//   .pdf / Bilder        → wie „PDF/Bilder importieren"  (Kanal project:openFiles)
//   .pptx/.ppt/.odp/…    → via LibreOffice zu PDF, dann wie oben
//
// Geöffnet wird FRISCH (replace) — pro Speaker ein Deck, das vorliegende ersetzt.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getLog } from '@jm/app-runtime';
import type { ImportedFile, OpenFilesPayload, SourceKind } from '@shared/types';
import { getEditorWindow } from './windows';
import { convertOfficeToPdf } from './office/convert';

const PROJECT_OPEN_CHANNEL = 'project:open'; // Vertrag mit show-open.ts/Renderer
const OPEN_FILES_CHANNEL = 'project:openFiles';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
const OFFICE_EXT = new Set(['.pptx', '.ppt', '.odp', '.docx', '.doc', '.odt', '.rtf']);

/** An das Editor-Fenster senden — wartet, falls es noch lädt (z. B. direkt nach Start). */
function sendWhenReady(channel: string, payload: unknown): boolean {
  const win = getEditorWindow();
  if (!win) return false;
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => win.webContents.send(channel, payload));
  } else {
    win.webContents.send(channel, payload);
  }
  return true;
}

/**
 * Datei am `filePath` als Präsentation vorlegen. Liefert false, wenn die Datei
 * nicht gelesen/konvertiert werden kann oder kein Editor-Fenster da ist.
 */
export async function openByPath(filePath: string): Promise<boolean> {
  const log = getLog();
  const ext = path.extname(filePath).toLowerCase();
  log.info(`PRESENTER OPEN: lade „${filePath}" (Typ ${ext || '?'})`);

  try {
    // Vollständiges Presenter-Projekt → wie „Öffnen"/Show-Deep-Link (ersetzt).
    if (ext === '.jmpres') {
      const bytes = new Uint8Array(await readFile(filePath));
      const ok = sendWhenReady(PROJECT_OPEN_CHANNEL, { name: path.basename(filePath), bytes });
      log.info(ok ? `PRESENTER OPEN: Projekt „${path.basename(filePath)}" geladen` : 'PRESENTER OPEN: kein Editor-Fenster');
      return ok;
    }

    // Office → erst per LibreOffice zu PDF (langsamer; braucht installiertes soffice).
    if (OFFICE_EXT.has(ext)) {
      const res = await convertOfficeToPdf(filePath);
      if (!res.ok || !res.bytes) {
        log.error(`PRESENTER OPEN: Office-Konvertierung fehlgeschlagen: ${res.error ?? 'unbekannt'}`);
        return false;
      }
      const file: ImportedFile = {
        name: `${path.basename(filePath, path.extname(filePath))}.pdf`,
        kind: 'pdf',
        bytes: res.bytes,
      };
      return deliverImported([file], log, 'Office→PDF');
    }

    // PDF / Bild → wie „PDF/Bilder importieren".
    const kind: SourceKind | null = ext === '.pdf' ? 'pdf' : IMAGE_EXT.has(ext) ? 'image' : null;
    if (!kind) {
      log.error(`PRESENTER OPEN: nicht unterstütztes Format „${ext}" — erlaubt: .jmpres, .pdf, Bilder, Office`);
      return false;
    }
    const bytes = new Uint8Array(await readFile(filePath));
    const file: ImportedFile = { name: path.basename(filePath), kind, bytes };
    return deliverImported([file], log, kind.toUpperCase());
  } catch (e) {
    log.error(`PRESENTER OPEN: „${filePath}" konnte nicht geladen werden: ${(e as Error).message}`);
    return false;
  }
}

function deliverImported(files: ImportedFile[], log: ReturnType<typeof getLog>, what: string): boolean {
  const payload: OpenFilesPayload = { files, replace: true };
  const ok = sendWhenReady(OPEN_FILES_CHANNEL, payload);
  log.info(ok ? `PRESENTER OPEN: ${what} „${files[0]?.name}" vorgelegt` : 'PRESENTER OPEN: kein Editor-Fenster');
  return ok;
}

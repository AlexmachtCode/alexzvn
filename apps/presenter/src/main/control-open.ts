// Steuerbefehl `PRESENTER OPEN <pfad>` (Rundown/Companion, Issue #81): legt die
// referenzierte Datei als Präsentation vor. Eine „Speaker-Präsentation" ist real
// fast immer ein PDF oder PowerPoint — NICHT das .jmpres-Projektformat. Darum
// geht alles durch denselben Lade-Weg wie Drag & Drop und Doppelklick (ladeDateien):
//
//   .jmpres              → vollständiges Projekt laden
//   .pdf / Bilder        → wie „PDF/Bilder importieren"
//   .pptx/.ppt/.odp/…    → via LibreOffice zu PDF, dann wie oben
//
// Geöffnet wird FRISCH (Modus `ersetzen`, ohne Rückfrage) — pro Speaker ein Deck,
// das vorliegende ersetzt. Alles über den Kanal project:openFiles.
import { getLog } from '@jm/app-runtime';
import type { OpenFilesPayload } from '@shared/types';
import { dateiName } from '../shared/dateien';
import { ladeDateien } from './dateien-laden';
import { sendeAnEditor } from './windows';

const OPEN_FILES_CHANNEL = 'project:openFiles';

/**
 * Datei am `filePath` als Präsentation vorlegen. Liefert false, wenn die Datei
 * nicht gelesen/konvertiert werden kann oder kein Editor-Fenster da ist.
 */
export async function openByPath(filePath: string): Promise<boolean> {
  const log = getLog();
  const name = dateiName(filePath);
  const punkt = name.lastIndexOf('.');
  log.info(`PRESENTER OPEN: lade „${filePath}" (Typ ${punkt >= 0 ? name.slice(punkt).toLowerCase() : '?'})`);

  try {
    const geladen = await ladeDateien([filePath], { expandBuilds: false });
    for (const h of geladen.hinweise) log.error(`PRESENTER OPEN: ${h}`);
    if (geladen.files.length === 0 && !geladen.projekt) return false;

    const payload: OpenFilesPayload = { ...geladen, modus: 'ersetzen' };
    const ok = sendeAnEditor(OPEN_FILES_CHANNEL, payload);
    log.info(ok ? `PRESENTER OPEN: „${name}" vorgelegt` : 'PRESENTER OPEN: kein Editor-Fenster');
    return ok;
  } catch (e) {
    log.error(`PRESENTER OPEN: „${filePath}" konnte nicht geladen werden: ${(e as Error).message}`);
    return false;
  }
}

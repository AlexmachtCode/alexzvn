// Legt das Verzeichnis der NDI-Laufzeit-DLL vorn auf den PATH des KINDPROZESSES.
//
// WARUM DAS HIER STEHT UND NICHT IM PRUEFSTAND: seit Stage 2 ist
// zoom-bridge.exe zusaetzlich gegen die NDI-Importbibliothek gebunden. Der
// Windows-Lader loest ALLE eingebundenen DLLs beim Prozessstart auf, BEVOR
// main() laeuft. Fehlt Processing.NDI.Lib.x64.dll auf dem PATH, stirbt das Kind
// mit STATUS_DLL_NOT_FOUND (0xC0000135), OHNE eine einzige Zeile auf stdout
// oder stderr zu schreiben - die Bruecke kann dann nur noch
// EXITED_UNEXPECTEDLY melden, und die Suche beginnt bei der Anmeldung statt bei
// einer fehlenden DLL. GEMESSEN am 2026-08-13 gegen den echten Aufruf von
// test/join.mjs.
//
// GEMESSEN auf dem Entwicklungsrechner: das Verzeichnis der NDI-Laufzeit steht
// WEDER im Maschinen- NOCH im Benutzer-PATH. Wer die DLL braucht, muss den Pfad
// selbst setzen - es gibt keinen Rechner, auf dem das "von allein" geht.
//
// WARUM NICHT require('@jm/ndi'): dessen ensureNdiRuntimeOnPath() macht
// dasselbe, aber nur als Nebenwirkung des Ladens - man bekaeme das native
// NDI-Addon mit, das diese Bibliothek NIE benutzt (nur die .exe braucht die
// DLL). Ein kopfloser Dienst in Stage 4 muesste dann ein Addon laden, um einen
// Pfad zu setzen. Die Kandidatenliste ist daher bewusst doppelt gefuehrt; sie
// muss mit packages/ndi/index.js uebereinstimmen.
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

/** Dateiname der NDI-Laufzeit, gegen die zoom-bridge.exe gebunden ist. */
const DLL = 'Processing.NDI.Lib.x64.dll';

/**
 * Sucht das Verzeichnis, in dem die NDI-Laufzeit-DLL wirklich LIEGT.
 *
 * Prueft die Datei, nicht das Verzeichnis: eine gesetzte Umgebungsvariable auf
 * ein leeres oder falsches Verzeichnis ist der haeufigere Fall als gar keine
 * Variable, und ein Verzeichnis ohne die DLL waere ein PATH-Eintrag, der den
 * Fehler nur verschiebt.
 *
 * @returns das Verzeichnis, oder null, wenn die DLL nirgends gefunden wurde.
 */
export function findNdiRuntimeDir(): string | null {
  if (process.platform !== 'win32') return null;
  const candidates = [
    process.env.NDI_RUNTIME_DIR_V6, // vom NDI-Laufzeit-Installer gesetzt
    process.env.NDI_SDK_DIR && join(process.env.NDI_SDK_DIR, 'Bin', 'x64'),
    'C:\\Program Files\\NDI\\NDI 6 Runtime\\v6',
    'C:\\Program Files\\NDI\\NDI 6 SDK\\Bin\\x64',
  ].filter((d): d is string => Boolean(d));
  for (const dir of candidates) {
    try {
      if (existsSync(join(dir, DLL))) return dir;
    } catch {
      // Verzeichnis nicht lesbar -> naechster Kandidat
    }
  }
  return null;
}

/**
 * Gibt `env` mit der NDI-Laufzeit vorn im PATH zurueck.
 *
 * Aendert `env` NICHT an Ort und Stelle (der Aufrufer haelt oft process.env in
 * der Hand). Wird die DLL nicht gefunden, kommt `env` unveraendert zurueck:
 * dieser Helfer erfindet keinen Pfad, und ein spaeteres
 * `ndiInitFailed`/STATUS_DLL_NOT_FOUND ist die ehrlichere Meldung als ein
 * PATH-Eintrag, hinter dem nichts steht.
 *
 * @param env   die Umgebung, die an den Kindprozess geht.
 * @param dir   das Laufzeit-Verzeichnis; nur fuer Tests von aussen gesetzt.
 */
export function withNdiRuntimeOnPath(
  env: NodeJS.ProcessEnv,
  dir: string | null = findNdiRuntimeDir(),
): NodeJS.ProcessEnv {
  if (dir === null) return env;
  const current = env.PATH ?? '';
  // Schon vorhanden -> nicht ein zweites Mal davorsetzen. Ein doppelter
  // Eintrag waere harmlos, aber ein bei jedem start() weiter wachsender PATH
  // ist es nicht: die Bruecke kann in einer langen Sitzung oft neu starten.
  const parts = current.split(delimiter);
  if (parts.includes(dir)) return env;
  return { ...env, PATH: current === '' ? dir : `${dir}${delimiter}${current}` };
}

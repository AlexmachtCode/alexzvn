// #299: Dateien per Doppelklick / „Öffnen mit“. Windows liefert die Pfade in der
// Kommandozeile (Start: process.argv, App läuft schon: second-instance), der Mac per
// open-file – auch schon vor ready. Was kurz nacheinander kommt (Explorer startet je
// markierter Datei eine Instanz), wird EIN Vorgang. Der Editor fragt dann selbst, ob
// ersetzt oder angehängt wird (Modus `fragen`); ein leerer Editor lädt direkt.
//
// Die second-instance-Zuhörer in index.ts (Fenster nach vorn) und in @jm/app-runtime
// (jmps://-Show-Links) bleiben, wie sie sind. pfadeAusArgv überspringt Links und Schalter.
import { statSync } from 'node:fs';
import { app } from 'electron';
import { getLog } from '@jm/app-runtime';
import type { OpenFilesPayload } from '@shared/types';
import { erstelleSammler, pfadeAusArgv, SAMMEL_MS } from '../shared/dateien';
import { ladeDateien } from './dateien-laden';
import { createEditorWindow, sendeAnEditor } from './windows';

const istDatei = (p: string): boolean => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

async function abgabe(pfade: string[]): Promise<void> {
  const g = await ladeDateien(pfade, { expandBuilds: false });
  for (const h of g.hinweise) getLog().warn(`Datei öffnen: ${h}`);
  if (!g.files.length && !g.projekt && !g.hinweise.length) return;
  createEditorWindow();
  const payload: OpenFilesPayload = { ...g, modus: 'fragen' };
  sendeAnEditor('project:openFiles', payload);
}

const sammler = erstelleSammler(SAMMEL_MS, (pfade) => {
  getLog().info(`Datei öffnen: ${pfade.length} Datei(en)`);
  abgabe(pfade).catch((e) => getLog().error(`Datei öffnen: ${(e as Error).message}`));
});

/** Bis oeffneStartDateien: gepufferte Pfade (der Editor steht noch nicht). Danach null. */
let puffer: string[] | null = [];

function nimm(pfade: readonly string[]): void {
  if (!pfade.length) return;
  if (puffer) puffer.push(...pfade);
  else sammler(pfade);
}

/** Früh aufrufen (vor `app.whenReady()`): der Mac schickt open-file schon vor ready. */
export function registriereDateiOeffnen(): void {
  app.on('open-file', (e, pfad) => {
    e.preventDefault();
    nimm([pfad]);
  });
  app.on('second-instance', (_e, argv) => nimm(pfadeAusArgv(argv, istDatei)));
}

/** Nach dem ersten createEditorWindow: Puffer und Start-Kommandozeile öffnen, ab jetzt direkt. */
export function oeffneStartDateien(): void {
  const start = [...(puffer ?? []), ...pfadeAusArgv(process.argv, istDatei)];
  puffer = null;
  if (start.length) sammler(start);
}

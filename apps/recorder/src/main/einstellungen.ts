import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RecEinstellungen } from '@shared/types';
import { normiereEinstellungen } from '../shared/einstellungen';

/** Gemerkte Einstellungen lesen (#291). Fehlt die Datei oder ist sie kaputt: leer, die Vorgaben gelten. */
export function ladeEinstellungen(datei: string): RecEinstellungen {
  try {
    return normiereEinstellungen(JSON.parse(readFileSync(datei, 'utf8')));
  } catch {
    return {};
  }
}

/**
 * Einstellungen geprüft schreiben. Erst in eine Zwischendatei, dann umbenennen: Ein Absturz
 * mitten im Schreiben hinterlässt nie eine halbe Datei.
 */
export function speichereEinstellungen(datei: string, raw: unknown): void {
  const e = normiereEinstellungen(raw);
  mkdirSync(dirname(datei), { recursive: true });
  const tmp = `${datei}.tmp`;
  writeFileSync(tmp, JSON.stringify(e, null, 2), 'utf8');
  renameSync(tmp, datei);
}

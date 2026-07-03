// ─────────────────────────────────────────────────────────────────────────────
// iveo → Titler-DataLink (#11, Phase 3).
//
// Der Titler holt NIE selbst bei iveo (kein Token hier — single-holder liegt im
// Launcher). Stattdessen trägt die geöffnete .jmshow bereits die sanitisierte,
// token-freie Speaker-Liste (`show.iveo.speakers`). Dieses Modul schreibt sie als
// `speakers.tsv` in einen VERWALTETEN DataLink-Ordner; das bestehende DataLink-/
// Recall-System (#86/#93) macht daraus Bauchbinden-Variablen. Spalten (=Variablen):
// {{name}}, {{funktion}} und {{title}} (Alias von funktion, Abwärtskompatibilität).
// ─────────────────────────────────────────────────────────────────────────────

import { app } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ShowIveoSpeaker } from '@jm/show';

/** Verwalteter DataLink-Ordner für iveo-Speaker (getrennt von manuellen Dateien). */
export function iveoDataDir(): string {
  return join(app.getPath('userData'), 'iveo-data');
}

/** Tab/Zeilenumbruch aus einem Zellenwert entfernen (TSV-sicher). */
function cell(v: string): string {
  return (v || '').replace(/[\t\r\n]+/g, ' ').trim();
}

/**
 * iveo-Speaker als `speakers.tsv` in den verwalteten DataLink-Ordner schreiben und
 * dessen Pfad zurückgeben. Spalten: `name` (= Recall-Label), `funktion` (Rolle/
 * Titel) und `title` (Alias von funktion, für ältere Templates). Templates füllen
 * damit {{name}} / {{funktion}} / {{title}}. TSV (Tab) umgeht Komma-in-Namen.
 *
 * Hinweis: die „Funktion" ist iveos `speaker.title` — ist sie im Event leer, bleibt
 * {{funktion}} leer (Datenlage in iveo, nicht Titler).
 */
export function writeSpeakersTsv(speakers: ShowIveoSpeaker[]): string {
  const dir = iveoDataDir();
  mkdirSync(dir, { recursive: true });
  const header = 'name\tfunktion\ttitle';
  const rows = speakers.map((s) => {
    const funktion = cell(s.title ?? '');
    return `${cell(s.name)}\t${funktion}\t${funktion}`;
  });
  writeFileSync(join(dir, 'speakers.tsv'), [header, ...rows].join('\n') + '\n', 'utf8');
  return dir;
}

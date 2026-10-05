// ─────────────────────────────────────────────────────────────────────────────
// iveo → Titler-DataLink (#11, Phase 3; Master-Link Teil 2b, Spec 7.2).
//
// Der Titler holt NIE selbst bei iveo (kein Token hier — single-holder liegt im
// Launcher). Stattdessen trägt die geöffnete .jmshow bereits die sanitisierte,
// token-freie Speaker-Liste (`show.iveo.speakers`). Dieses Modul schreibt sie als
// `speakers.tsv` in einen VERWALTETEN DataLink-Ordner; das bestehende DataLink-/
// Recall-System (#86/#93) macht daraus Bauchbinden-Variablen. Spalten (=Variablen):
// {{name}}, {{funktion}} und {{title}} (Alias von funktion, Abwärtskompatibilität).
// Dazu hinten `@kennung` (Teil 2b): die iveo-Speaker-ID als Schlüssel des Eintrags,
// keine Variable.
//
// Ohne Electron (Teil 2b): Der Aufrufer reicht den userData-Ordner herein, damit der
// Selbsttest das Modul mit tsx laden kann.
// ─────────────────────────────────────────────────────────────────────────────

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ShowIveoSpeaker } from '@jm/show';
import { KENNUNG_SPALTE } from '../shared/datalink-kern';

/** Verwalteter DataLink-Ordner für iveo-Speaker (getrennt von manuellen Dateien). */
export function iveoDataDir(userData: string): string {
  return join(userData, 'iveo-data');
}

/** Tab/Zeilenumbruch aus einem Zellenwert entfernen (TSV-sicher). */
function cell(v: string): string {
  return (v || '').replace(/[\t\r\n]+/g, ' ').trim();
}

/**
 * Inhalt der `speakers.tsv`: Kopf `name\tfunktion\ttitle\t@kennung`, je Speaker eine Zeile,
 * `\n` am Ende. `name` ist das Recall-Label, `funktion` iveos `speaker.title`, `title` ein
 * Alias von funktion (ältere Templates), `@kennung` die iveo-Speaker-ID (leer ohne Kennung).
 *
 * Hinweis: die „Funktion" ist iveos `speaker.title` — ist sie im Event leer, bleibt
 * {{funktion}} leer (Datenlage in iveo, nicht Titler).
 */
export function speakersTsvText(speakers: ShowIveoSpeaker[]): string {
  const header = `name\tfunktion\ttitle\t${KENNUNG_SPALTE}`;
  const rows = speakers.map((s) => {
    const funktion = cell(s.title ?? '');
    return `${cell(s.name)}\t${funktion}\t${funktion}\t${cell(s.id ?? '')}`;
  });
  return [header, ...rows].join('\n') + '\n';
}

/**
 * iveo-Speaker als `speakers.tsv` in `dir` schreiben (Ordner wird angelegt) und `dir`
 * zurückgeben. TSV (Tab) umgeht Komma-in-Namen.
 */
export function writeSpeakersTsv(dir: string, speakers: ShowIveoSpeaker[]): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'speakers.tsv'), speakersTsvText(speakers), 'utf8');
  return dir;
}

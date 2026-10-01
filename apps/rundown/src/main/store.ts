// Persistenz des Rundown-Dokuments: Default-Ablauf, Autosave in userData und
// Lesen/Schreiben von `.jmrundown`-Dateien (JSON). Tolerantes Einlesen (migrate),
// damit alte/teilweise Dateien nicht crashen.
import { app } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { newId } from '@shared/conductor';
import { migrate as migrateFormat } from '@shared/doc-format';
import type { ShowAblaufItem } from '@jm/show';
import type { RundownAction, RundownDoc } from '@shared/types';

function autosavePath(): string {
  return join(app.getPath('userData'), 'rundown.autosave.jmrundown');
}

/** Beispiel-Ablauf, der die Mehr-Tool-Regie sofort zeigt. */
export function defaultDoc(): RundownDoc {
  const a = (role: string, verb: string, args: (string | number)[] = []): RundownAction => ({
    id: newId('a'),
    role,
    verb,
    args,
    enabled: true,
  });
  return {
    schemaVersion: 2,
    name: 'Neuer Ablauf',
    rows: [
      { id: newId('r'), label: 'Opener', actions: [a('timer', 'start'), a('titler', 'take')] },
      {
        id: newId('r'),
        label: 'Talk',
        actions: [a('presenter', 'goto', [1]), a('prompter', 'scroll', ['on'])],
      },
      { id: newId('r'), label: 'Outro', actions: [a('titler', 'clear'), a('timer', 'reset')] },
    ],
  };
}

/**
 * Beliebiges JSON tolerant in ein valides RundownDoc überführen. Die Regeln des
 * Dateiformats (Version 1 → `zuordnungOffen`, Version 2 mit quelle/entfallen/
 * kontext/archiv) stehen rein in `@shared/doc-format` und sind dort per
 * Selbsttest geprüft; hier kommt nur der ID-Geber `newId` dazu.
 */
export function migrate(raw: unknown): RundownDoc {
  return migrateFormat(raw, newId);
}

/**
 * Zentralen Show-Ablauf (#78) in ein RundownDoc überführen — jeder Programmpunkt
 * wird zu einer Zeile OHNE Aktionen (die GO-Aktionen bleiben Rundown-spezifisch
 * und ergänzt der Nutzer in Rundown). Über `migrate` normalisiert (frische IDs,
 * optionale Felder). So muss der Ablauf nur einmal zentral in der Show gepflegt
 * werden, statt in jedem Tool separat.
 */
export function docFromAblauf(name: string, items: ShowAblaufItem[]): RundownDoc {
  // Als Version 2 einlesen: Zeilen aus dem Show-Ablauf brauchen keine Titel-Zuordnung (4.9).
  return migrate({ schemaVersion: 2, name: name || 'Ablauf', rows: items.map((it) => ({ ...it, actions: [] })) });
}

export function readDoc(path: string): RundownDoc {
  return migrate(JSON.parse(readFileSync(path, 'utf8')));
}

export function writeDoc(path: string, doc: RundownDoc): void {
  writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
}

export function loadAutosave(): RundownDoc | null {
  try {
    return migrate(JSON.parse(readFileSync(autosavePath(), 'utf8')));
  } catch {
    return null;
  }
}

export function saveAutosave(doc: RundownDoc): void {
  try {
    writeFileSync(autosavePath(), JSON.stringify(doc, null, 2));
  } catch {
    /* best-effort */
  }
}

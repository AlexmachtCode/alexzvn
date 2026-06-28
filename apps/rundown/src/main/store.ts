// Persistenz des Rundown-Dokuments: Default-Ablauf, Autosave in userData und
// Lesen/Schreiben von `.jmrundown`-Dateien (JSON). Tolerantes Einlesen (migrate),
// damit alte/teilweise Dateien nicht crashen.
import { app } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { newId } from '@shared/conductor';
import type { RundownAction, RundownDoc, RundownRow } from '@shared/types';

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
    schemaVersion: 1,
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

function normAction(raw: unknown): RundownAction {
  const o = (raw ?? {}) as Partial<RundownAction>;
  const delay = typeof o.delayMs === 'number' && Number.isFinite(o.delayMs) ? Math.max(0, Math.trunc(o.delayMs)) : 0;
  return {
    id: typeof o.id === 'string' ? o.id : newId('a'),
    role: typeof o.role === 'string' ? o.role : 'timer',
    verb: typeof o.verb === 'string' ? o.verb : 'start',
    args: Array.isArray(o.args) ? o.args.filter((x) => typeof x === 'string' || typeof x === 'number') : [],
    enabled: o.enabled !== false,
    // Optionales Feld nur setzen, wenn >0 — hält cookbook-/Doc-JSON schlank und
    // alte Dateien (ohne delayMs) verhalten sich unverändert.
    ...(delay > 0 ? { delayMs: delay } : {}),
  };
}

function normRow(raw: unknown): RundownRow {
  const o = (raw ?? {}) as Partial<RundownRow>;
  return {
    id: typeof o.id === 'string' ? o.id : newId('r'),
    label: typeof o.label === 'string' ? o.label : 'Zeile',
    note: typeof o.note === 'string' ? o.note : undefined,
    actions: Array.isArray(o.actions) ? o.actions.map(normAction) : [],
  };
}

/** Beliebiges JSON tolerant in ein valides RundownDoc überführen. */
export function migrate(raw: unknown): RundownDoc {
  const o = (raw ?? {}) as Partial<RundownDoc>;
  return {
    schemaVersion: 1,
    name: typeof o.name === 'string' ? o.name : 'Ablauf',
    rows: Array.isArray(o.rows) ? o.rows.map(normRow) : [],
  };
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

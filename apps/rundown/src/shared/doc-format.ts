// Dateiformat des Rundown-Dokuments (.jmrundown, Autosave, Gedächtnis): tolerantes
// Einlesen von Version 1 und 2 (Master-Link 2a, Spec 4.1).
//
// Rein: kein electron, kein node:, keine Paket-Laufzeitimporte, zwischen Modulen
// nur `import type` — damit der Selbsttest es unter
// `node --experimental-strip-types` ohne Pfad-Aliase laden kann. Neue IDs kommen
// über den übergebenen `neueId` (in der App `newId` aus `@shared/conductor`).
import type { RundownAction, RundownDoc, RundownRow } from './types';

/** Liefert eine neue Zeilen- ('r') bzw. Aktions-ID ('a'). */
export type NeueId = (praefix: 'r' | 'a') => string;

/**
 * Gültiger Kontext-Schlüssel (Spec 4.4): `show`, `se:<programId>` oder
 * `liste:<…>`. Alles andere (auch `__proto__`) wird beim Einlesen verworfen.
 */
function istKontext(k: unknown): k is string {
  return typeof k === 'string' && /^(?:show$|se:.|liste:)/.test(k);
}

/** Eine Aktion tolerant normalisieren. */
export function normAction(raw: unknown, neueId: NeueId): RundownAction {
  const o = (raw ?? {}) as Partial<RundownAction>;
  const delay = typeof o.delayMs === 'number' && Number.isFinite(o.delayMs) ? Math.max(0, Math.trunc(o.delayMs)) : 0;
  return {
    id: typeof o.id === 'string' ? o.id : neueId('a'),
    role: typeof o.role === 'string' ? o.role : 'timer',
    verb: typeof o.verb === 'string' ? o.verb : 'start',
    args: Array.isArray(o.args) ? o.args.filter((x) => typeof x === 'string' || typeof x === 'number') : [],
    enabled: o.enabled !== false,
    // Optionales Feld nur setzen, wenn >0 — hält cookbook-/Doc-JSON schlank und
    // alte Dateien (ohne delayMs) verhalten sich unverändert.
    ...(delay > 0 ? { delayMs: delay } : {}),
    // Sprungziel (Spec 6.2) nur als nicht leerer String übernehmen.
    ...(typeof o.zielId === 'string' && o.zielId ? { zielId: o.zielId } : {}),
  };
}

/** Eine Zeile tolerant normalisieren (Version-2-Felder `quelle`/`entfallen` inklusive). */
export function normRow(raw: unknown, neueId: NeueId): RundownRow {
  const o = (raw ?? {}) as Partial<RundownRow>;
  const duration = typeof o.durationMs === 'number' && Number.isFinite(o.durationMs) ? Math.max(0, Math.trunc(o.durationMs)) : 0;
  const row: RundownRow = {
    id: typeof o.id === 'string' ? o.id : neueId('r'),
    label: typeof o.label === 'string' ? o.label : 'Zeile',
    note: typeof o.note === 'string' ? o.note : undefined,
    actions: Array.isArray(o.actions) ? o.actions.map((a) => normAction(a, neueId)) : [],
    // Optionales Feld nur bei >0 setzen — alte Dateien bleiben unverändert.
    ...(duration > 0 ? { durationMs: duration } : {}),
  };
  // `entfallen` gibt es nur an Ablaufzeilen (Spec 4.1).
  if (o.quelle === 'ablauf') {
    row.quelle = 'ablauf';
    if (o.entfallen === true) row.entfallen = true;
  }
  return row;
}

/** Version 1 kennt keine Ablaufzeilen: alles wird eigene Zeile (Spec 4.1). */
function alsEigeneZeile(row: RundownRow): RundownRow {
  const z = { ...row };
  delete z.quelle;
  delete z.entfallen;
  return z;
}

function normArchiv(raw: unknown, neueId: NeueId): Record<string, RundownRow[]> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, RundownRow[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!istKontext(k) || !Array.isArray(v)) continue;
    out[k] = v.map((r) => normRow(r, neueId));
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Beliebiges JSON tolerant in ein valides RundownDoc (Version 2) überführen.
 * - Version 1 (oder ohne Angabe): alle Zeilen werden eigene Zeilen, dazu
 *   `zuordnungOffen: true` für die einmalige Titel-Zuordnung (Spec 4.9).
 * - Version 2 und höher: `quelle`, `entfallen`, `kontext`, `archiv` und
 *   `zuordnungOffen` bleiben erhalten; unbekannte Felder fallen weg.
 * Geschrieben wird immer Version 2.
 */
export function migrate(raw: unknown, neueId: NeueId): RundownDoc {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name : 'Ablauf';
  const rohZeilen: unknown[] = Array.isArray(o.rows) ? o.rows : [];
  const version2 = typeof o.schemaVersion === 'number' && o.schemaVersion >= 2;
  if (!version2) {
    return {
      schemaVersion: 2,
      name,
      rows: rohZeilen.map((r) => alsEigeneZeile(normRow(r, neueId))),
      zuordnungOffen: true,
    };
  }
  const doc: RundownDoc = { schemaVersion: 2, name, rows: rohZeilen.map((r) => normRow(r, neueId)) };
  if (istKontext(o.kontext)) doc.kontext = o.kontext;
  const archiv = normArchiv(o.archiv, neueId);
  if (archiv) doc.archiv = archiv;
  if (o.zuordnungOffen === true) doc.zuordnungOffen = true;
  return doc;
}

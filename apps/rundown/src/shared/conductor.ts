// Reine Conductor-Logik (keine node/electron-Imports) — damit per Selftest
// (test/selftest.ts) ohne Electron prüfbar. Baut Protokollzeilen für das suite-
// weite Zeilenprotokoll (@jm/suite-control-protocol) und rechnet die Navigation
// über das Rundown-Dokument aus.
import type { Endpoint, RundownAction, RundownDoc, RundownNav, RundownRow } from './types';

/** Endpunkt + woher er stammt. */
export interface DesiredEndpoint extends Endpoint {
  source: 'mdns' | 'manual';
}

/**
 * Gewünschte Steuer-Endpunkte je Rolle aus mDNS-Funden und manuellen Overrides
 * zusammenführen — der manuelle Override gewinnt (Cross-Subnet / mDNS aus).
 */
export function mergeEndpoints(
  discovered: Record<string, Endpoint>,
  overrides: Record<string, Endpoint>,
): Record<string, DesiredEndpoint> {
  const out: Record<string, DesiredEndpoint> = {};
  for (const [role, ep] of Object.entries(discovered)) out[role] = { host: ep.host, port: ep.port, source: 'mdns' };
  for (const [role, ep] of Object.entries(overrides)) out[role] = { host: ep.host, port: ep.port, source: 'manual' };
  return out;
}

/**
 * Protokollzeile für eine Aktion bauen. Switcher-Verben haben KEINEN Namespace
 * (Rückwärtskompat), alle anderen Rollen `<ROLLE> <VERB> [args]`.
 *   buildActionLine('timer','start',[])      → 'TIMER START'
 *   buildActionLine('presenter','goto',[3])  → 'PRESENTER GOTO 3'
 *   buildActionLine('switcher','program',[2])→ 'PROGRAM 2'
 */
export function buildActionLine(role: string, verb: string, args: (string | number)[] = []): string {
  const v = verb.toUpperCase();
  const tail = args.length ? ' ' + args.map((a) => String(a)).join(' ') : '';
  return role === 'switcher' ? `${v}${tail}` : `${role.toUpperCase()} ${v}${tail}`;
}

let _idCounter = 0;
/** Kurze, eindeutige ID für Zeilen/Aktionen (Editor + Default-Dokument). */
export function newId(prefix = 'x'): string {
  return `${prefix}_${Date.now().toString(36)}${(_idCounter++).toString(36)}`;
}

/** Index in [0, len-1] klemmen (leeres Dokument → 0). */
export function clampIndex(i: number, len: number): number {
  if (len <= 0) return 0;
  return Math.max(0, Math.min(Math.trunc(i), len - 1));
}

/** Nicht entfallene Zeile: feuert und kann scharf werden (Teil 2a, Spec 4.3). */
function lebt(row: RundownRow | undefined): boolean {
  return row !== undefined && row.entfallen !== true;
}

/** Ab `i` in Richtung `schritt` die erste nicht entfallene Zeile, sonst -1. */
function sucheLebende(rows: RundownRow[], i: number, schritt: 1 | -1): number {
  for (let j = i; j >= 0 && j < rows.length; j += schritt) if (lebt(rows[j])) return j;
  return -1;
}

/**
 * Auf eine nicht entfallene Zeile stellen: `i` selbst, sonst die nächste dahinter,
 * sonst die vorige. Gibt es keine (leer oder alles entfallen), bleibt es bei `i`.
 */
function aufLebende(rows: RundownRow[], i: number): number {
  if (lebt(rows[i])) return i;
  const naechste = sucheLebende(rows, i + 1, 1);
  if (naechste >= 0) return naechste;
  const vorige = sucheLebende(rows, i - 1, -1);
  return vorige >= 0 ? vorige : i;
}

/**
 * Navigation auf dem Dokument auswerten. Liefert den neuen Index der scharfen
 * Zeile und — nur bei GO — die zu feuernden (aktivierten) Aktionen. GO rückt die
 * Markierung um eins weiter (Cue-Stack), NEXT/PREV/GOTO verschieben ohne Feuern.
 *
 * Entfallene Zeilen (Teil 2a, Spec 4.3) feuern nie: GO, NEXT und PREV springen
 * über sie hinweg; steht `index` auf einer entfallenen, gilt die nächste nicht
 * entfallene als scharf. GOTO n zählt alle sichtbaren Zeilen; landet es auf
 * einer entfallenen, wird die nächste nicht entfallene scharf, sonst die vorige.
 * `fire` enthält dieselben Aktionsobjekte wie die Zeile — keine festgeschriebenen
 * Kopien, denn ein `timer goto` wird erst beim Senden aufgelöst (5.4, 6.2).
 */
export function navigate(
  doc: RundownDoc,
  index: number,
  cmd: RundownNav,
): { index: number; fire: RundownAction[] } {
  const rows = doc.rows;
  const cur = aufLebende(rows, clampIndex(index, rows.length));
  const weiter = (schritt: 1 | -1): number => {
    const j = sucheLebende(rows, cur + schritt, schritt);
    return j >= 0 ? j : cur;
  };
  switch (cmd.t) {
    case 'go': {
      const row = rows[cur];
      const fire = lebt(row) ? row.actions.filter((a) => a.enabled) : [];
      return { index: weiter(1), fire };
    }
    case 'next':
      return { index: weiter(1), fire: [] };
    case 'prev':
      return { index: weiter(-1), fire: [] };
    case 'goto':
      return { index: aufLebende(rows, clampIndex(cmd.n - 1, rows.length)), fire: [] };
    default:
      return { index: cur, fire: [] };
  }
}

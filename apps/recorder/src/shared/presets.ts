import { normiereEinstellungen } from './einstellungen';
import type { RecEinstellungen, RecPreset } from './types';

export const PRESET_NAME_MAX = 60;
export const EXPORT_FORMAT = 'jm-recorder-presets';
export const EXPORT_MAX_BYTES = 1_000_000;

const FEHLER_FREMD = 'Die Datei ist keine Recorder-Preset-Datei.';
const FEHLER_NEU = 'Die Datei stammt aus einer neueren Recorder-Version – bitte den Recorder aktualisieren.';
const FEHLER_LEER = 'Die Datei enthält keine gültigen Presets.';

/** Einstellungen eines Presets: wie `normiereEinstellungen`, aber ohne das Feld `preset`. */
export function presetWerte(raw: unknown): RecEinstellungen {
  const { preset: _weg, ...rest } = normiereEinstellungen(raw);
  return rest;
}

/** Gelesenes Preset prüfen. Ohne brauchbaren Namen → null; fehlende Werte → leer. */
export function normierePreset(raw: unknown): RecPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== 'string') return null;
  const name = r.name.trim().slice(0, PRESET_NAME_MAX).trim();
  if (!name) return null;
  return { name, werte: presetWerte(r.werte) };
}

/** Neue Liste, nach Name sortiert (deutsch). */
export function sortiere(liste: RecPreset[]): RecPreset[] {
  return [...liste].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Gleicher Inhalt? `normiereEinstellungen` baut die Schlüssel in fester Reihenfolge. */
export function gleicheWerte(a: RecEinstellungen, b: RecEinstellungen): boolean {
  return JSON.stringify(presetWerte(a)) === JSON.stringify(presetWerte(b));
}

/** Name, der noch nicht vergeben ist: „Name“, sonst „Name (2)“, „Name (3)“ … (max. 60 Zeichen). */
export function freierPresetName(name: string, vergeben: string[]): string {
  if (!vergeben.includes(name)) return name;
  for (let n = 2; ; n++) {
    const endung = ` (${n})`;
    const kandidat = name.slice(0, PRESET_NAME_MAX - endung.length) + endung;
    if (!vergeben.includes(kandidat)) return kandidat;
  }
}

/** Neue Presets in die vorhandenen einarbeiten; Ergebnis ist sortiert. */
export function fuehreZusammen(
  vorhanden: RecPreset[],
  neu: RecPreset[],
  wahl: 'ueberschreiben' | 'beide',
): { liste: RecPreset[]; hinzu: number; ersetzt: number } {
  let liste = [...vorhanden];
  let hinzu = 0;
  let ersetzt = 0;
  for (const p of neu) {
    const i = liste.findIndex((v) => v.name === p.name);
    if (i < 0) {
      liste.push(p);
      hinzu++;
    } else if (wahl === 'ueberschreiben') {
      liste[i] = p;
      ersetzt++;
    } else {
      liste.push({ name: freierPresetName(p.name, liste.map((v) => v.name)), werte: p.werte });
      hinzu++;
    }
  }
  liste = sortiere(liste);
  return { liste, hinzu, ersetzt };
}

/** Exportdatei als JSON-Text. */
export function baueExportDatei(liste: RecPreset[], jetzt: Date): string {
  return JSON.stringify({ format: EXPORT_FORMAT, version: 1, exportiert: jetzt.toISOString(), presets: liste }, null, 2);
}

/** Exportdatei lesen. Wirft `Error` mit Nutzertext. Ungültige und doppelte Presets zählen als übersprungen. */
export function leseExportDatei(text: string): { presets: RecPreset[]; uebersprungen: number } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error(FEHLER_FREMD); }
  if (!raw || typeof raw !== 'object') throw new Error(FEHLER_FREMD);
  const r = raw as Record<string, unknown>;
  if (r.format !== EXPORT_FORMAT || typeof r.version !== 'number') throw new Error(FEHLER_FREMD);
  if (r.version > 1) throw new Error(FEHLER_NEU);
  if (!Array.isArray(r.presets)) throw new Error(FEHLER_FREMD);

  const presets: RecPreset[] = [];
  let uebersprungen = 0;
  for (const eintrag of r.presets) {
    const p = normierePreset(eintrag);
    if (!p || presets.some((v) => v.name === p.name)) uebersprungen++;
    else presets.push(p);
  }
  if (!presets.length) throw new Error(FEHLER_LEER);
  return { presets, uebersprungen };
}

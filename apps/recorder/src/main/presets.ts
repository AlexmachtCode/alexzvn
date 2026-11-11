import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { KonfliktWahl, PresetDateiErgebnis, RecPreset } from '@shared/types';
import { fuehreZusammen, istNetzwerkPfad, leseExportDatei, normierePreset, sortiere } from '../shared/presets';

/** Gemerkte Presets lesen (Datei: `{ version: 1, presets }`). Fehlt die Datei oder ist sie kaputt: leere Liste. */
export function ladePresets(datei: string): RecPreset[] {
  try {
    const raw: unknown = JSON.parse(readFileSync(datei, 'utf8'));
    const eintraege = raw && typeof raw === 'object' ? (raw as { presets?: unknown }).presets : undefined;
    if (!Array.isArray(eintraege)) return [];
    const liste: RecPreset[] = [];
    for (const eintrag of eintraege) {
      const p = normierePreset(eintrag);
      if (p && !liste.some((v) => v.name === p.name)) liste.push(p);
    }
    return sortiere(liste);
  } catch {
    return [];
  }
}

/** Presets geprüft und sortiert schreiben (Zwischendatei + Umbenennen). Gibt die gespeicherte Liste zurück. */
export function speicherePresets(datei: string, liste: RecPreset[]): RecPreset[] {
  const sauber: RecPreset[] = [];
  for (const eintrag of liste) {
    const p = normierePreset(eintrag);
    if (p && !sauber.some((v) => v.name === p.name)) sauber.push(p);
  }
  const sortiert = sortiere(sauber);
  mkdirSync(dirname(datei), { recursive: true });
  const tmp = `${datei}.tmp`;
  writeFileSync(tmp, JSON.stringify({ version: 1, presets: sortiert }, null, 2), 'utf8');
  renameSync(tmp, datei);
  return sortiert;
}

/**
 * Exportdatei in die vorhandenen Presets einarbeiten. Fasst keine Datei an: bei `ok` steht die
 * neue, sortierte Liste in `presets` und der Aufrufer speichert sie. `frage` wird nur bei
 * gleichnamigen Presets gefragt.
 */
export async function importiere(
  vorhanden: RecPreset[],
  text: string,
  frage: (konflikte: string[]) => Promise<KonfliktWahl>,
): Promise<PresetDateiErgebnis> {
  let gelesen: ReturnType<typeof leseExportDatei>;
  try {
    gelesen = leseExportDatei(text);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const konflikte = gelesen.presets.filter((p) => vorhanden.some((v) => v.name === p.name)).map((p) => p.name);
  let wahl: KonfliktWahl = 'ueberschreiben';
  if (konflikte.length) wahl = await frage(konflikte);
  if (wahl === 'abbrechen') return { ok: false };

  const { liste, hinzu, ersetzt, uebernommen } = fuehreZusammen(vorhanden, gelesen.presets, wahl);
  // Netzwerkordner: beim Anwenden meldet sich Windows bei diesem Server an → ausdrücklich nennen.
  const netzwerk = uebernommen.flatMap((p) =>
    p.werte.dir !== undefined && istNetzwerkPfad(p.werte.dir) ? [{ name: p.name, dir: p.werte.dir }] : [],
  );
  const n = hinzu + ersetzt;
  let meldung = `${n} ${n === 1 ? 'Preset' : 'Presets'} importiert`;
  if (ersetzt > 0) meldung += ` (${ersetzt} ersetzt)`;
  if (gelesen.uebersprungen > 0) meldung += `, ${gelesen.uebersprungen} ungültige übersprungen`;
  if (netzwerk.length > 0) meldung += ` – ${netzwerk.length} davon mit Netzwerkordner`;
  return { ok: true, presets: liste, meldung: `${meldung}.`, ...(netzwerk.length > 0 ? { netzwerk } : {}) };
}

/** Warnung nach dem Import: je Preset eine Zeile „Name“ → Pfad. */
export function netzwerkHinweis(netzwerk: { name: string; dir: string }[]): { message: string; detail: string } {
  const n = netzwerk.length;
  return {
    message:
      n === 1
        ? '1 importiertes Preset nimmt in einem Netzwerkordner auf'
        : `${n} importierte Presets nehmen in einem Netzwerkordner auf`,
    detail:
      netzwerk.map((p) => `„${p.name}“ → ${p.dir}`).join('\n') +
      '\n\nNur anwenden, wenn dieser Ordner bekannt ist – beim Anwenden meldet sich Windows bei diesem Server an.',
  };
}

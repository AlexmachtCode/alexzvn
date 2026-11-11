import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, win32 } from 'node:path';
import type { KonfliktWahl, NetzWahl, PresetDateiErgebnis, RecPreset } from '@shared/types';
import { fuehreZusammen, istNetzwerkPfad, leseExportDatei, netzwerkServer, normierePreset, saeubereAnzeige, sortiere } from '../shared/presets';

/** Einträge prüfen; bei doppeltem Namen gewinnt der erste. */
function eindeutig(eintraege: unknown[]): RecPreset[] {
  const liste: RecPreset[] = [];
  const namen = new Set<string>();
  for (const eintrag of eintraege) {
    const p = normierePreset(eintrag);
    if (p && !namen.has(p.name)) {
      namen.add(p.name);
      liste.push(p);
    }
  }
  return liste;
}

/** Gemerkte Presets lesen (Datei: `{ version: 1, presets }`). Fehlt die Datei oder ist sie kaputt: leere Liste. */
export function ladePresets(datei: string): RecPreset[] {
  try {
    const raw: unknown = JSON.parse(readFileSync(datei, 'utf8'));
    const eintraege = raw && typeof raw === 'object' ? (raw as { presets?: unknown }).presets : undefined;
    if (!Array.isArray(eintraege)) return [];
    return sortiere(eindeutig(eintraege));
  } catch {
    return [];
  }
}

/** Presets geprüft und sortiert schreiben (Zwischendatei + Umbenennen). Gibt die gespeicherte Liste zurück. */
export function speicherePresets(datei: string, liste: RecPreset[]): RecPreset[] {
  // Datei aus neuerer Version nicht überschreiben (lesbar + version > 1); unlesbar oder fehlend → schreiben.
  let vorhanden: unknown;
  try { vorhanden = JSON.parse(readFileSync(datei, 'utf8')); } catch { vorhanden = undefined; }
  const v = vorhanden && typeof vorhanden === 'object' ? (vorhanden as { version?: unknown }).version : undefined;
  if (typeof v === 'number' && v > 1) throw new Error('Die Preset-Datei stammt aus einer neueren Recorder-Version – nicht überschrieben.');
  const sortiert = sortiere(eindeutig(liste));
  mkdirSync(dirname(datei), { recursive: true });
  const tmp = `${datei}.tmp`;
  writeFileSync(tmp, JSON.stringify({ version: 1, presets: sortiert }, null, 2), 'utf8');
  renameSync(tmp, datei);
  return sortiert;
}

/**
 * Exportdatei in die vorhandenen Presets einarbeiten. Fasst keine Datei an: bei `ok` steht die
 * neue, sortierte Liste in `presets` und der Aufrufer speichert sie. `frage` wird nur bei
 * gleichnamigen Presets gefragt, `netzFrage` nur bei Netzwerkordnern (nach den endgültigen Namen).
 */
export async function importiere(
  vorhanden: RecPreset[],
  text: string,
  frage: (konflikte: string[]) => Promise<KonfliktWahl>,
  netzFrage: (netzwerk: { name: string; dir: string }[]) => Promise<NetzWahl>,
): Promise<PresetDateiErgebnis> {
  let gelesen: ReturnType<typeof leseExportDatei>;
  try {
    gelesen = leseExportDatei(text);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  // Relativer Zielordner aus fremder Datei hinge vom Arbeitsverzeichnis ab → Feld weg, Rest bleibt.
  const neu = gelesen.presets.map((p): RecPreset => {
    if (p.werte.dir === undefined || win32.isAbsolute(p.werte.dir)) return p;
    const { dir: _weg, ...rest } = p.werte;
    return { name: p.name, werte: rest };
  });
  const vorhandenNamen = new Set(vorhanden.map((v) => v.name));
  const konflikte = neu.filter((p) => vorhandenNamen.has(p.name)).map((p) => p.name);
  let wahl: KonfliktWahl = 'ueberschreiben';
  if (konflikte.length) wahl = await frage(konflikte);
  if (wahl === 'abbrechen') return { ok: false };

  const zusammen = fuehreZusammen(vorhanden, neu, wahl);
  const { hinzu, ersetzt, uebernommen } = zusammen;
  let liste = zusammen.liste;
  // Netzwerkordner: beim Anwenden meldet sich Windows bei diesem Server an → ausdrücklich nennen.
  const netzwerk = uebernommen.flatMap((p) =>
    p.werte.dir !== undefined && istNetzwerkPfad(p.werte.dir) ? [{ name: p.name, dir: p.werte.dir }] : [],
  );
  let ohneOrdner = false;
  if (netzwerk.length > 0) {
    const netzWahl = await netzFrage(netzwerk);
    if (netzWahl === 'abbrechen') return { ok: false };
    if (netzWahl === 'ohne') {
      // Nur die genannten Presets (endgültige Namen) verlieren den Ordner, alle anderen bleiben.
      const namen = new Set(netzwerk.map((p) => p.name));
      liste = liste.map((p) => {
        if (!namen.has(p.name)) return p;
        const { dir: _weg, ...rest } = p.werte;
        return { name: p.name, werte: rest };
      });
      ohneOrdner = true;
    }
  }
  const n = hinzu + ersetzt;
  let meldung = `${n} ${n === 1 ? 'Preset' : 'Presets'} importiert`;
  if (ersetzt > 0) meldung += ` (${ersetzt} ersetzt)`;
  if (gelesen.uebersprungen > 0) meldung += `, ${gelesen.uebersprungen} ungültige übersprungen`;
  if (netzwerk.length > 0) meldung += ohneOrdner ? ` – ${netzwerk.length} ohne Netzwerkordner übernommen` : ` – ${netzwerk.length} davon mit Netzwerkordner`;
  return { ok: true, presets: liste, meldung: `${meldung}.`, ...(netzwerk.length > 0 && !ohneOrdner ? { netzwerk } : {}) };
}

const ZEILEN_MAX = 10;
const ZEICHEN_MAX = 200;

/** Für den Dialog: gesäubert (Zeichen, die den Text fälschen könnten) und auf 200 Zeichen gekürzt. */
const kurz = (t: string): string => {
  const s = saeubereAnzeige(t);
  return s.length > ZEICHEN_MAX ? `${s.slice(0, ZEICHEN_MAX)}…` : s;
};

/** Rückfrage vor dem Übernehmen: erst die Server, dann je Preset eine Zeile „Name“ → Pfad (höchstens 10). */
export function netzwerkHinweis(netzwerk: { name: string; dir: string }[]): { message: string; detail: string } {
  const n = netzwerk.length;
  // Jeder Server einmal, in Reihenfolge des Auftretens; ohne erkennbaren Server der Pfad selbst.
  const server = [...new Set(netzwerk.map((p) => kurz(netzwerkServer(p.dir) ?? p.dir)))];
  const zeilen = netzwerk.slice(0, ZEILEN_MAX).map((p) => `„${kurz(p.name)}“ → ${kurz(p.dir)}`);
  if (n > ZEILEN_MAX) zeilen.push(`… und ${n - ZEILEN_MAX} weitere`);
  return {
    message:
      n === 1
        ? '1 importiertes Preset nimmt in einem Netzwerkordner auf'
        : `${n} importierte Presets nehmen in einem Netzwerkordner auf`,
    detail:
      `Server: ${server.join(', ')}\n${zeilen.join('\n')}` +
      '\n\nNur übernehmen, wenn dieser Ordner bekannt ist – beim Anwenden meldet sich Windows bei diesem Server an.',
  };
}

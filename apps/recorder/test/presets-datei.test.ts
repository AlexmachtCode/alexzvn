// Preset-Ablage und Import im Main (ohne Electron). npm run selftest -w @jm/recorder
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importiere, ladePresets, speicherePresets } from '../src/main/presets';
import { baueExportDatei } from '../src/shared/presets';
import type { KonfliktWahl, RecPreset } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const namen = (l?: RecPreset[]): string[] => (l ?? []).map((p) => p.name);
const preset = (name: string, channels: number): RecPreset => ({ name, werte: { channels } });

const dir = mkdtempSync(join(tmpdir(), 'rec-presets-'));
const datei = join(dir, 'recorder-presets.json');

// Laden / Speichern
ck('ladePresets: fehlende Datei -> []', gleich(ladePresets(join(dir, 'gibtsnicht.json')), []));
const muell = join(dir, 'muell.json');
writeFileSync(muell, 'kein json {', 'utf8');
ck('ladePresets: Müll -> []', gleich(ladePresets(muell), []));

const gespeichert = speicherePresets(datei, [preset('Zeta', 2), preset('Alpha', 8)]);
ck('speicherePresets: gibt sortierte Liste zurück', gleich(namen(gespeichert), ['Alpha', 'Zeta']));
ck('ladePresets: gleiche Liste wie gespeichert', gleich(ladePresets(datei), gespeichert));
ck('speicherePresets: keine .tmp übrig', !readdirSync(dir).some((f) => f.endsWith('.tmp')) && !existsSync(`${datei}.tmp`));

// Dateiformat { version, presets }
const handDatei = join(dir, 'hand.json');
writeFileSync(handDatei, JSON.stringify({ version: 1, presets: [preset('Zwei', 2), preset('Eins', 8)] }), 'utf8');
ck('ladePresets: von Hand geschriebenes { version, presets } wird gelesen', gleich(namen(ladePresets(handDatei)), ['Eins', 'Zwei']));
const geschrieben = JSON.parse(readFileSync(datei, 'utf8')) as { version?: unknown; presets?: unknown };
ck('speicherePresets: Datei ist { version: 1, presets: [...] }', geschrieben.version === 1 && Array.isArray(geschrieben.presets));

// Import
const A = preset('A', 2);
const A2 = preset('A', 16);
const B = preset('B', 4);
const C = preset('C', 6);
const datText = (l: RecPreset[]): string => baueExportDatei(l, new Date('2026-11-11T10:00:00Z'));
let gefragt: string[] | null = null;
const frageMit = (w: KonfliktWahl) => async (k: string[]): Promise<KonfliktWahl> => { gefragt = k; return w; };

gefragt = null;
let r = await importiere([A], datText([B]), frageMit('beide'));
ck('ohne Konflikt: ok, A+B', r.ok && gleich(namen(r.presets), ['A', 'B']));
ck('ohne Konflikt: frage nicht aufgerufen', gefragt === null);
ck('ohne Konflikt: Meldung „1 Preset importiert“', (r.meldung ?? '').includes('1 Preset importiert'));

gefragt = null;
r = await importiere([A], datText([A2, C]), frageMit('beide'));
ck('beide: frage bekam [A]', gleich(gefragt, ['A']));
ck('beide: Namen A, A (2), C', r.ok && gleich(namen(r.presets), ['A', 'A (2)', 'C']));

r = await importiere([A], datText([A2, C]), frageMit('ueberschreiben'));
ck('ueberschreiben: A hat Werte von A2', r.ok && r.presets?.find((p) => p.name === 'A')?.werte.channels === 16);
ck('ueberschreiben: Meldung „1 ersetzt“', (r.meldung ?? '').includes('1 ersetzt'));

r = await importiere([A], datText([A2, C]), frageMit('abbrechen'));
ck('abbrechen: ok false, kein error', !r.ok && r.error === undefined);

r = await importiere([A], 'Müll', frageMit('beide'));
ck('Müll: ok false, error nennt Preset-Datei', !r.ok && (r.error ?? '').includes('keine Recorder-Preset-Datei'));

const mitKaputt = JSON.stringify({ format: 'jm-recorder-presets', version: 1, presets: [B, { name: '' }] });
r = await importiere([A], mitKaputt, frageMit('beide'));
ck('übersprungen: Meldung nennt „übersprungen“', r.ok && (r.meldung ?? '').includes('1 ungültige übersprungen'));

console.log(`\npresets-datei: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);

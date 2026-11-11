// Preset-Ablage und Import im Main (ohne Electron). npm run selftest -w @jm/recorder
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importiere, ladePresets, netzwerkHinweis, speicherePresets } from '../src/main/presets';
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

// Netzwerkordner: der Import nennt jedes übernommene Preset mit Netzwerkpfad unter seinem endgültigen Namen.
const mitDir = (name: string, d: string): RecPreset => ({ name, werte: { dir: d } });
const NETZ_A = '\\\\srv\\a';
r = await importiere([], datText([mitDir('Netz1', NETZ_A), mitDir('Netz2', '//srv/b'), mitDir('Lokal', 'D:\\x')]), frageMit('beide'));
ck('netzwerk: genau die zwei Netzwerkpfade', r.ok && gleich(r.netzwerk, [{ name: 'Netz1', dir: NETZ_A }, { name: 'Netz2', dir: '//srv/b' }]));
ck('netzwerk: Meldung nennt sie', r.meldung === '3 Presets importiert – 2 davon mit Netzwerkordner.');

r = await importiere([preset('A', 2)], datText([mitDir('A', NETZ_A)]), frageMit('beide'));
ck('netzwerk: „Beide behalten“ nennt „A (2)“', r.ok && gleich(r.netzwerk, [{ name: 'A (2)', dir: NETZ_A }]));
r = await importiere([preset('A', 2)], datText([mitDir('A', NETZ_A)]), frageMit('ueberschreiben'));
ck('netzwerk: ersetztes Preset genannt', r.ok && gleich(r.netzwerk, [{ name: 'A', dir: NETZ_A }]));

r = await importiere([mitDir('Alt', NETZ_A)], datText([mitDir('Neu', 'D:\\x')]), frageMit('beide'));
ck('netzwerk: ohne Netzwerkpfad im Import kein Feld (vorhandene zählen nicht)', r.ok && !('netzwerk' in r) && r.meldung === '1 Preset importiert.');

r = await importiere([preset('A', 2)], datText([mitDir('A', NETZ_A)]), frageMit('abbrechen'));
ck('netzwerk: Abbrechen -> nichts', !r.ok && r.netzwerk === undefined && r.presets === undefined);

// Relativer Zielordner aus fremder Datei: das Feld fällt weg, der Rest bleibt gültig.
r = await importiere([], datText([
  { name: 'Rel', werte: { dir: 'Aufnahmen\\Tag1', channels: 4 } },
  { name: 'Punkt', werte: { dir: '.\\x' } },
  mitDir('Abs', 'D:\\x'),
]), frageMit('beide'));
const rel = r.presets?.find((p) => p.name === 'Rel');
ck('relativer dir fällt weg, Rest bleibt', r.ok && rel !== undefined && !('dir' in rel.werte) && rel.werte.channels === 4);
ck('.\\x fällt weg', r.ok && gleich(r.presets?.find((p) => p.name === 'Punkt')?.werte, {}));
ck('absoluter dir bleibt', r.presets?.find((p) => p.name === 'Abs')?.werte.dir === 'D:\\x');

// Doppelte Namen in der Ablage: der erste gewinnt (Laden wie Speichern).
const doppelt = speicherePresets(join(dir, 'doppelt.json'), [preset('X', 1), preset('X', 2), preset('Y', 3)]);
ck('speicherePresets: doppelt -> erster gewinnt', gleich(doppelt, [preset('X', 1), preset('Y', 3)]));
writeFileSync(join(dir, 'doppelt2.json'), JSON.stringify({ version: 1, presets: [preset('X', 1), preset('X', 2)] }), 'utf8');
ck('ladePresets: doppelt -> erster gewinnt', gleich(ladePresets(join(dir, 'doppelt2.json')), [preset('X', 1)]));

// Warnung im Dialog: Einzahl/Mehrzahl, je Preset eine Zeile.
const h1 = netzwerkHinweis([{ name: 'A', dir: NETZ_A }]);
ck('Hinweis Einzahl', h1.message === '1 importiertes Preset nimmt in einem Netzwerkordner auf');
ck('Hinweis nennt Name und Pfad', h1.detail === `„A“ → ${NETZ_A}\n\nNur anwenden, wenn dieser Ordner bekannt ist – beim Anwenden meldet sich Windows bei diesem Server an.`);
const h2 = netzwerkHinweis([{ name: 'A', dir: NETZ_A }, { name: 'B', dir: '//srv/b' }]);
ck('Hinweis Mehrzahl', h2.message === '2 importierte Presets nehmen in einem Netzwerkordner auf');
ck('Hinweis: eine Zeile je Preset', h2.detail.startsWith(`„A“ → ${NETZ_A}\n„B“ → //srv/b\n\n`));

console.log(`\npresets-datei: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);

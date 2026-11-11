// Preset-Ablage und Import im Main (ohne Electron). npm run selftest -w @jm/recorder
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importiere, ladePresets, netzwerkHinweis, speicherePresets } from '../src/main/presets';
import { baueExportDatei } from '../src/shared/presets';
import type { KonfliktWahl, NetzWahl, RecPreset } from '../src/shared/types';

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
let netzGefragt: { name: string; dir: string }[] | null = null;
const netzMit = (w: NetzWahl) => async (n: { name: string; dir: string }[]): Promise<NetzWahl> => { netzGefragt = n; return w; };
const frageMit = (w: KonfliktWahl) => async (k: string[]): Promise<KonfliktWahl> => { gefragt = k; return w; };

gefragt = null;
let r = await importiere([A], datText([B]), frageMit('beide'), netzMit('uebernehmen'));
ck('ohne Konflikt: ok, A+B', r.ok && gleich(namen(r.presets), ['A', 'B']));
ck('ohne Konflikt: frage nicht aufgerufen', gefragt === null);
ck('ohne Konflikt: Meldung „1 Preset importiert“', (r.meldung ?? '').includes('1 Preset importiert'));

gefragt = null;
r = await importiere([A], datText([A2, C]), frageMit('beide'), netzMit('uebernehmen'));
ck('beide: frage bekam [A]', gleich(gefragt, ['A']));
ck('beide: Namen A, A (2), C', r.ok && gleich(namen(r.presets), ['A', 'A (2)', 'C']));

r = await importiere([A], datText([A2, C]), frageMit('ueberschreiben'), netzMit('uebernehmen'));
ck('ueberschreiben: A hat Werte von A2', r.ok && r.presets?.find((p) => p.name === 'A')?.werte.channels === 16);
ck('ueberschreiben: Meldung „1 ersetzt“', (r.meldung ?? '').includes('1 ersetzt'));

r = await importiere([A], datText([A2, C]), frageMit('abbrechen'), netzMit('uebernehmen'));
ck('abbrechen: ok false, kein error', !r.ok && r.error === undefined);

r = await importiere([A], 'Müll', frageMit('beide'), netzMit('uebernehmen'));
ck('Müll: ok false, error nennt Preset-Datei', !r.ok && (r.error ?? '').includes('keine Recorder-Preset-Datei'));

const mitKaputt = JSON.stringify({ format: 'jm-recorder-presets', version: 1, presets: [B, { name: '' }] });
r = await importiere([A], mitKaputt, frageMit('beide'), netzMit('uebernehmen'));
ck('übersprungen: Meldung nennt „übersprungen“', r.ok && (r.meldung ?? '').includes('1 ungültige übersprungen'));

// Netzwerkordner: der Import nennt jedes übernommene Preset mit Netzwerkpfad unter seinem endgültigen Namen.
const mitDir = (name: string, d: string): RecPreset => ({ name, werte: { dir: d } });
const NETZ_A = '\\\\srv\\a';
const NETZ_B = '\\\\srv\\b';
r = await importiere([], datText([mitDir('Netz1', NETZ_A), mitDir('Netz2', '//srv/b'), mitDir('Lokal', 'D:\\x')]), frageMit('beide'), netzMit('uebernehmen'));
ck('netzwerk: genau die zwei Netzwerkpfade', r.ok && gleich(r.netzwerk, [{ name: 'Netz1', dir: NETZ_A }, { name: 'Netz2', dir: '//srv/b' }]));
ck('netzwerk: Meldung nennt sie', r.meldung === '3 Presets importiert – 2 davon mit Netzwerkordner.');

r = await importiere([preset('A', 2)], datText([mitDir('A', NETZ_A)]), frageMit('beide'), netzMit('uebernehmen'));
ck('netzwerk: „Beide behalten“ nennt „A (2)“', r.ok && gleich(r.netzwerk, [{ name: 'A (2)', dir: NETZ_A }]));
r = await importiere([preset('A', 2)], datText([mitDir('A', NETZ_A)]), frageMit('ueberschreiben'), netzMit('uebernehmen'));
ck('netzwerk: ersetztes Preset genannt', r.ok && gleich(r.netzwerk, [{ name: 'A', dir: NETZ_A }]));

r = await importiere([mitDir('Alt', NETZ_A)], datText([mitDir('Neu', 'D:\\x')]), frageMit('beide'), netzMit('uebernehmen'));
ck('netzwerk: ohne Netzwerkpfad im Import kein Feld (vorhandene zählen nicht)', r.ok && !('netzwerk' in r) && r.meldung === '1 Preset importiert.');

r = await importiere([preset('A', 2)], datText([mitDir('A', NETZ_A)]), frageMit('abbrechen'), netzMit('uebernehmen'));
ck('netzwerk: Abbrechen -> nichts', !r.ok && r.netzwerk === undefined && r.presets === undefined);

// Relativer Zielordner aus fremder Datei: das Feld fällt weg, der Rest bleibt gültig.
r = await importiere([], datText([
  { name: 'Rel', werte: { dir: 'Aufnahmen\\Tag1', channels: 4 } },
  { name: 'Punkt', werte: { dir: '.\\x' } },
  mitDir('Abs', 'D:\\x'),
]), frageMit('beide'), netzMit('uebernehmen'));
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
ck('Hinweis nennt Server, Name und Pfad', h1.detail === `Server: srv\n„A“ → ${NETZ_A}\n\nNur übernehmen, wenn dieser Ordner bekannt ist – beim Anwenden meldet sich Windows bei diesem Server an.`);
const h2 = netzwerkHinweis([{ name: 'A', dir: NETZ_A }, { name: 'B', dir: '//srv/b' }]);
ck('Hinweis Mehrzahl', h2.message === '2 importierte Presets nehmen in einem Netzwerkordner auf');
ck('Hinweis: eine Zeile je Preset', h2.detail.startsWith(`Server: srv\n„A“ → ${NETZ_A}\n„B“ → //srv/b\n\n`));

// Netzwerk-Rückfrage vor dem Ergebnis: Übernehmen / Ohne Ordner / Abbrechen.
netzGefragt = null;
r = await importiere([], datText([mitDir('Netz1', NETZ_A), mitDir('Lokal', 'D:\\x')]), frageMit('beide'), netzMit('uebernehmen'));
ck('netzFrage: bekam genau die Netzwerk-Presets', gleich(netzGefragt, [{ name: 'Netz1', dir: NETZ_A }]));
ck('uebernehmen: Ordner bleibt, netzwerk gesetzt', r.ok && r.presets?.find((p) => p.name === 'Netz1')?.werte.dir === NETZ_A && r.netzwerk?.length === 1);

netzGefragt = null;
r = await importiere([], datText([mitDir('Lokal', 'D:\\x'), B]), frageMit('beide'), netzMit('abbrechen'));
ck('keine Netzwerkpfade: netzFrage nicht gerufen', netzGefragt === null && r.ok);

r = await importiere([], datText([mitDir('Netz1', NETZ_A), mitDir('Lokal', 'D:\\x')]), frageMit('beide'), netzMit('abbrechen'));
ck('netz abbrechen: ok false ohne Fehler', !r.ok && r.error === undefined && r.presets === undefined);

r = await importiere([], datText([mitDir('Netz1', NETZ_A), mitDir('Lokal', 'D:\\x')]), frageMit('beide'), netzMit('ohne'));
ck('ohne: Netzwerk-Preset verliert dir, Lokal behält ihn', r.ok && !('dir' in (r.presets?.find((p) => p.name === 'Netz1')?.werte ?? {})) && r.presets?.find((p) => p.name === 'Lokal')?.werte.dir === 'D:\\x');
ck('ohne: kein netzwerk-Feld, Meldung nennt „ohne Netzwerkordner“', r.ok && !('netzwerk' in r) && r.meldung === '2 Presets importiert – 1 ohne Netzwerkordner übernommen.');

// „ohne“ + Überschreiben: das ersetzte Preset verliert den Ordner
r = await importiere([mitDir('A', 'D:\\alt'), mitDir('Z', NETZ_A)], datText([mitDir('A', NETZ_A)]), frageMit('ueberschreiben'), netzMit('ohne'));
ck('ohne+Überschreiben: A ohne dir', r.ok && !('dir' in (r.presets?.find((p) => p.name === 'A')?.werte ?? {})));
ck('ohne+Überschreiben: vorhandenes Z mit Netzwerkpfad unangetastet', r.presets?.find((p) => p.name === 'Z')?.werte.dir === NETZ_A);

// „ohne“ + Beide behalten: „A (2)“ ohne Ordner, „A“ unverändert
r = await importiere([mitDir('A', NETZ_B)], datText([mitDir('A', NETZ_A)]), frageMit('beide'), netzMit('ohne'));
ck('ohne+Beide: „A (2)“ ohne dir', r.ok && !('dir' in (r.presets?.find((p) => p.name === 'A (2)')?.werte ?? {})));
ck('ohne+Beide: „A“ unverändert', r.presets?.find((p) => p.name === 'A')?.werte.dir === NETZ_B);

// Steuerzeichen in Name/Pfad werden im Dialogtext zu Leerzeichen
const hz = netzwerkHinweis([{ name: 'A\nB\x00', dir: '\\\\srv\\a\r\nx' }]);
ck('Hinweis: kein Zeilenumbruch im Namen/Pfad', hz.detail.split('\n').length === 4 && !/[\x00-\x09\x0b-\x1f\x7f]/.test(hz.detail) && hz.detail.startsWith('Server: srv\n„A B “ → \\\\srv\\a  x\n\n'));
// Unicode-Fälschungen (Bidi, Nullbreite, Zeilentrenner) werden ebenfalls ersetzt, Zeilenzahl bleibt
{
  const cp = (c: number): string => String.fromCodePoint(c);
  const hu = netzwerkHinweis([{ name: `A${cp(0x202e)}B`, dir: `\\\\srv\\a${cp(0x200b)}${cp(0x2028)}x` }]);
  ck('Hinweis: keine Cc/Cf/Zl/Zp', !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(hu.detail.replace(/\n/g, '')));
  ck('Hinweis: Zeilenzahl unverändert (4)', hu.detail.split('\n').length === 4);
}
// Server einmal, in Reihenfolge; Pfade ohne Servernamen mit dem Pfad selbst
{
  const hs = netzwerkHinweis([{ name: 'A', dir: '\\\\srv\\a' }, { name: 'B', dir: '//srv/b' }, { name: 'C', dir: '\\\\zeta\\c' }, { name: 'D', dir: '\\\\?\\C:\\x' }]);
  ck('Hinweis: Server einmal, Reihenfolge, Pfad ohne Server', hs.detail.split('\n')[0] === 'Server: srv, zeta, \\\\?\\C:\\x');
}
// Mehr als 10 Presets: 10 Zeilen + „… und N weitere“; lange Namen/Pfade gekürzt
{
  const zwoelf = Array.from({ length: 12 }, (_, i) => ({ name: `P${i}`, dir: `\\\\srv\\d${i}` }));
  const hm = netzwerkHinweis(zwoelf);
  const zeilen = hm.detail.split('\n');
  ck('Hinweis: 12 Presets -> 10 Zeilen + „… und 2 weitere“', zeilen.filter((z) => z.startsWith('„')).length === 10 && zeilen.includes('… und 2 weitere'));
  const lang = netzwerkHinweis([{ name: 'N'.repeat(500), dir: `\\\\srv\\${'p'.repeat(500)}` }]);
  const zl = lang.detail.split('\n')[1];
  ck('Hinweis: lange Zeile gekürzt mit „…“', zl.includes('…') && zl.length < 450);
}
ck('Hinweis: neuer Schlusssatz',h1.detail.endsWith('Nur übernehmen, wenn dieser Ordner bekannt ist – beim Anwenden meldet sich Windows bei diesem Server an.'));

// Ablage-Schutz: Datei aus neuerer Version wird nicht überschrieben
const v2 = join(dir, 'v2.json');
const v2Text = JSON.stringify({ version: 2, presets: [preset('Neu', 1)] });
writeFileSync(v2, v2Text, 'utf8');
let v2Fehler = '';
try { speicherePresets(v2, [preset('X', 1)]); } catch (e) { v2Fehler = (e as Error).message; }
ck('speicherePresets: v2-Datei -> wirft', v2Fehler === 'Die Preset-Datei stammt aus einer neueren Recorder-Version – nicht überschrieben.');
ck('speicherePresets: v2-Datei unverändert', readFileSync(v2, 'utf8') === v2Text && !existsSync(`${v2}.tmp`));
speicherePresets(muell, [preset('Heil', 1)]);
ck('speicherePresets: kaputte Datei wird ersetzt', gleich(namen(ladePresets(muell)), ['Heil']));

console.log(`\npresets-datei: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);

// Prüfstand des Erzeugers der Ansagen (Plan Geführte Anleitungen P10; Spec 6; EP12, EP13, EP16, G14), ohne Piper und ohne
// ffmpeg:
//   node --experimental-strip-types test/anleitung-stimme.test.ts      (zweites Glied von npm run selftest -w @jm/launcher)
// Piper und ffmpeg ersetzt test/stimme-attrappe.mjs. Prozesse startet der Test nur mit node: die Attrappe und einmal die
// Kommandozeile des Erzeugers (G4). Alles liegt im Temp-Ordner; im Repo wird nichts geschrieben.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { erzeugeAnsagen, kommandozeile, STANDARD_PARAMETER, UMGEBUNG } from '../scripts/anleitung-stimme.mjs';
import { dateiSha256, leseOrdner, manifestText, pruefeStimme } from '../scripts/stimme-manifest.mjs';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean, detail?: string): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); if (detail !== undefined) console.log(`      ${detail || '(leer)'}`); }
}
const json = (x: unknown): string => JSON.stringify(x);
async function wirft(f: () => Promise<unknown>): Promise<string> {
  try { await f(); return ''; } catch (e) { return e instanceof Error ? e.message : String(e); }
}

const ATTRAPPE = fileURLToPath(new URL('./stimme-attrappe.mjs', import.meta.url));
const SKRIPT = fileURLToPath(new URL('../scripts/anleitung-stimme.mjs', import.meta.url));
const PIPER = [process.execPath, ATTRAPPE, 'piper'];
const FFMPEG = [process.execPath, ATTRAPPE, 'ffmpeg'];
const WERKZEUG = { piper: 'Attrappe', ffmpeg: 'Attrappe' };
const wurzel = mkdtempSync(join(tmpdir(), 'jm-stimme-test-'));
const protokoll = join(wurzel, 'aufrufe.jsonl');
process.env.JM_ATTRAPPE_PROTOKOLL = protokoll;
delete process.env.JM_ATTRAPPE_FEHLER;
type Aufruf = { werkzeug: string; args: string[]; text?: string };
const aufrufe = (): Aufruf[] => (existsSync(protokoll) ? readFileSync(protokoll, 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z) as Aufruf) : []);
const neuesProtokoll = (): void => { if (existsSync(protokoll)) unlinkSync(protokoll); };

// Zwei Test-Stimmen mit eingespeister Pin-Tabelle (eine echte .onnx gibt es hier nicht): A mit 4 Sprechern, B mit einem.
function teststimme(name: string, inhalt: string, sprecher: number): string {
  const p = join(wurzel, `${name}.onnx`);
  writeFileSync(p, inhalt);
  writeFileSync(`${p}.json`, json({ num_speakers: sprecher, audio: { sample_rate: 22050 } }));
  return p;
}
const STIMME_A = teststimme('test-a', 'Stimme A', 4);
const STIMME_B = teststimme('test-b', 'Stimme B', 1);
const PINS = {
  'test-a': { onnxSha256: dateiSha256(STIMME_A), lizenz: 'Test', namensnennung: 'Test-Stimme A', quelle: 'Fixture' },
  'test-b': { onnxSha256: dateiSha256(STIMME_B), lizenz: 'Test', namensnennung: 'Test-Stimme B', quelle: 'Fixture' },
};
const TEXTE = [
  { id: 'einleitung', text: 'Willkommen. Ich führe dich durch die Einrichtung.' },
  { id: 'k1.zugang', text: 'Trage hier den Zugang ein und klicke auf „Speichern“.' },
  { id: 'k2.erledigt', text: 'Auf diesem Rechner ist schon ein Tool installiert.' },
];
const ziel = join(wurzel, 'stimme');
const basis = { ziel, stimmePfad: STIMME_A, stimmeName: 'test-a', sprecher: 2, piper: PIPER, ffmpeg: FFMPEG, stimmen: PINS, werkzeug: WERKZEUG };
const manifestRoh = (): string => readFileSync(join(ziel, 'manifest.json'), 'utf8');
const manifest = () => JSON.parse(manifestRoh());
const pruefe = (texte = TEXTE): string[] => pruefeStimme(texte, manifest(), leseOrdner(ziel).ogg, PINS);
const piperArgs = (id: string): string[] => aufrufe().find((a) => a.werkzeug === 'piper' && a.args[3]?.endsWith(`${id}.txt`))?.args ?? [];

// --- erste Erzeugung --------------------------------------------------------------------------------------------------
neuesProtokoll();
let r = await erzeugeAnsagen({ ...basis, texte: TEXTE });
ck('P10 6: erste Erzeugung → 3 erzeugt, 0 übersprungen, 0 entfernt, Bytes = Summe der Dateien',
  r.erzeugt.length === 3 && r.uebersprungen.length === 0 && r.entfernt.length === 0
  && r.bytes === leseOrdner(ziel).ogg.reduce((s: number, d: { name: string }) => s + readFileSync(join(ziel, d.name)).length, 0), json(r));
ck('P10 6 EP13: danach besteht pruefeStimme ohne Befund (Manifest, Texte und Dateien passen)', json(pruefe()) === '[]', json(pruefe()));
const erster = aufrufe();
const p0 = piperArgs('einleitung');
ck('P10 EP12: Piper-Aufruf je Text: -m Stimme -i Text -f WAV --sentence-silence 0.3 --length-scale 1.05 -s 2',
  erster.filter((a) => a.werkzeug === 'piper').length === 3 && p0[0] === '-m' && p0[1] === STIMME_A && p0[2] === '-i' && p0[4] === '-f'
  && p0[5]?.endsWith('einleitung.wav') && json(p0.slice(6)) === json(['--sentence-silence', '0.3', '--length-scale', '1.05', '-s', '2']), json(p0));
const f0 = erster.find((a) => a.werkzeug === 'ffmpeg')?.args ?? [];
ck('P10 EP12: ffmpeg-Aufruf bitgleich: libopus 24k mono, -map_metadata -1, -fflags +bitexact, -flags:a +bitexact',
  erster.filter((a) => a.werkzeug === 'ffmpeg').length === 3
  && json([...f0.slice(0, 5), ...f0.slice(6, -1)]) === json(['-hide_banner', '-loglevel', 'error', '-y', '-i', '-c:a', 'libopus', '-b:a', '24k', '-ac', '1', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact'])
  && f0[5]?.endsWith('einleitung.wav') && f0.at(-1)?.endsWith('einleitung.ogg'), json(f0));
ck('P10 G14: Piper bekommt den Text als UTF-8-Datei (Umlaute und „ “ kommen an); Zwischendateien nur im Temp-Ordner, danach weg',
  json(erster.filter((a) => a.werkzeug === 'piper').map((a) => a.text)) === json(TEXTE.map((t) => t.text))
  && p0[3]?.startsWith(tmpdir()) && !p0[3]?.startsWith(ziel) && !existsSync(dirname(p0[3] ?? wurzel)));
ck('P10 G12: manifest.json mit LF ohne CR, zwei Leerzeichen und Schluss-LF', !manifestRoh().includes('\r') && manifestRoh() === manifestText(manifest()));
ck('P10 OFP1: das Manifest nennt Stimme, Sprecher, Lizenz, Namensnennung, Parameter und Werkzeug',
  json(manifest().stimme) === json({ name: 'test-a', onnxSha256: PINS['test-a'].onnxSha256, lizenz: 'Test', namensnennung: 'Test-Stimme A', sprecher: 2 })
  && json(manifest().parameter) === json({ lengthScale: 1.05, sentenceSilence: 0.3, opusKbps: 24 }) && json(manifest().werkzeug) === json(WERKZEUG)
  && json(STANDARD_PARAMETER) === json({ lengthScale: 1.05, sentenceSilence: 0.3, opusKbps: 24 }), json(manifest().stimme));

// --- neu nur, wenn sich der Schlüssel ändert (EP13) ----------------------------------------------------------------------
let vorher = manifestRoh();
neuesProtokoll();
r = await erzeugeAnsagen({ ...basis, texte: TEXTE });
ck('P10 EP13: zweiter Lauf erzeugt nichts (0 erzeugt, 3 übersprungen, kein Aufruf von Piper oder ffmpeg, Manifest gleich)',
  r.erzeugt.length === 0 && r.uebersprungen.length === 3 && aufrufe().length === 0 && manifestRoh() === vorher, json(r));
const TEXTE2 = TEXTE.map((t) => (t.id === 'k1.zugang' ? { ...t, text: 'Trage hier den Zugang ein und klicke auf „Speichern“!' } : t));
const altK1 = dateiSha256(join(ziel, 'k1.zugang.ogg'));
neuesProtokoll();
r = await erzeugeAnsagen({ ...basis, texte: TEXTE2 });
ck('P10 EP13: ein Text um ein Zeichen geändert → genau diese Ansage neu (k1.zugang), 2 übersprungen',
  json(r.erzeugt) === '["k1.zugang"]' && r.uebersprungen.length === 2 && aufrufe().length === 2 && dateiSha256(join(ziel, 'k1.zugang.ogg')) !== altK1, json(r));
ck('P10 EP13: … danach passt das Manifest zum neuen Text und nicht mehr zum alten',
  json(pruefe(TEXTE2)) === '[]' && json(pruefe(TEXTE)) === '["Text geändert: k1.zugang"]', json(pruefe(TEXTE2)));
neuesProtokoll();
r = await erzeugeAnsagen({ ...basis, texte: TEXTE2.map((t) => ({ ...t, text: t.text.normalize('NFD') })) });
ck('P10 EP13: derselbe Text in NFD statt NFC erzeugt nichts neu', r.erzeugt.length === 0 && aufrufe().length === 0, json(r));
neuesProtokoll();
r = await erzeugeAnsagen({ ...basis, texte: TEXTE2, sprecher: 3 });
ck('P10 EP13: Sprecher geändert (2 → 3) → alle neu, -s 3 im Aufruf',
  r.erzeugt.length === 3 && manifest().stimme.sprecher === 3 && json(piperArgs('einleitung').slice(-2)) === '["-s","3"]', json(r));
neuesProtokoll();
r = await erzeugeAnsagen({ ...basis, texte: TEXTE2, sprecher: 3, parameter: { lengthScale: 1.1 } });
ck('P10 EP13: Parameter geändert (lengthScale 1.1) → alle neu, --length-scale 1.1 im Aufruf und im Manifest',
  r.erzeugt.length === 3 && manifest().parameter.lengthScale === 1.1 && piperArgs('einleitung').includes('1.1'), json(r));
neuesProtokoll();
r = await erzeugeAnsagen({ ...basis, texte: TEXTE2, stimmePfad: STIMME_B, stimmeName: 'test-b', sprecher: null });
ck('P10 EP13: Stimme gewechselt → alle neu; bei einer Stimme mit einem Sprecher kein -s',
  r.erzeugt.length === 3 && manifest().stimme.name === 'test-b' && manifest().stimme.sprecher === null && !piperArgs('einleitung').includes('-s'), json(r));
const B = { ...basis, stimmePfad: STIMME_B, stimmeName: 'test-b', sprecher: null };

// --- verwaiste Dateien (6) --------------------------------------------------------------------------------------------
writeFileSync(join(ziel, 'alt.weg.ogg'), 'OggS alt');
neuesProtokoll();
r = await erzeugeAnsagen({ ...B, texte: TEXTE2 });
ck('P10 6: verwaiste Datei wird gelöscht und gemeldet (alt.weg.ogg), sonst nichts neu',
  json(r.entfernt) === '["alt.weg.ogg"]' && !existsSync(join(ziel, 'alt.weg.ogg')) && r.erzeugt.length === 0 && aufrufe().length === 0, json(r));
r = await erzeugeAnsagen({ ...B, texte: TEXTE2.slice(0, 2) });
ck('P10 6: gestrichener Text → seine Ansage wird entfernt (k2.erledigt.ogg), das Manifest hat 2 Einträge und passt',
  json(r.entfernt) === '["k2.erledigt.ogg"]' && manifest().eintraege.length === 2 && json(pruefe(TEXTE2.slice(0, 2))) === '[]', json(r));

// --- jeder Fehler sichtbar, der Ordner bleibt unverändert (G14) ----------------------------------------------------------
// Jeder Fall vergleicht mit dem Stand direkt davor: scheitert einer, reißt er die folgenden nicht mit.
const stand = (): string => json([manifestRoh(), readdirSync(ziel).sort().map((n) => [n, dateiSha256(join(ziel, n))])]);
async function fehlerFall(f: () => Promise<unknown>): Promise<{ m: string; gleich: boolean; aufrufe: number }> {
  const v = stand();
  neuesProtokoll();
  const m = await wirft(f);
  return { m, gleich: stand() === v, aufrufe: aufrufe().length };
}
let fall = await fehlerFall(() => erzeugeAnsagen({ ...B, texte: TEXTE2, stimmen: { ...PINS, 'test-b': { ...PINS['test-b'], onnxSha256: '0'.repeat(64) } } }));
ck('P10 G14: Stimme mit fremder Prüfsumme → Abbruch vor jedem Aufruf, Ordner unverändert',
  fall.m.startsWith('Prüfsumme der Stimme passt nicht zu test-b: ') && fall.aufrufe === 0 && fall.gleich, fall.m);
const STIMME_C = teststimme('test-c', 'Stimme C', 1);
unlinkSync(`${STIMME_C}.json`);
fall = await fehlerFall(() => erzeugeAnsagen({ ...B, texte: TEXTE2, stimmePfad: STIMME_C, stimmeName: 'test-c', stimmen: { ...PINS, 'test-c': { ...PINS['test-b'], onnxSha256: dateiSha256(STIMME_C) } } }));
ck('P10 G14: ohne <onnx>.json daneben → Abbruch mit Meldung, kein Aufruf',
  fall.m.startsWith('Konfiguration der Stimme fehlt: ') && fall.m.endsWith('test-c.onnx.json (Piper 1.8.0 liest sie nur unter diesem Namen)') && fall.aufrufe === 0 && fall.gleich, fall.m);
fall = await fehlerFall(() => erzeugeAnsagen({ ...basis, texte: TEXTE2, sprecher: undefined }));
ck('P10 OFP1: Stimme mit 4 Sprechern ohne --sprecher → Abbruch (Sprecher nach Hörprobe wählen)',
  fall.m === 'Die Stimme test-a hat 4 Sprecher: einen mit --sprecher wählen (Hörprobe, OFP1)' && fall.aufrufe === 0 && fall.gleich, fall.m);
fall = await fehlerFall(() => erzeugeAnsagen({ ...basis, texte: TEXTE2, sprecher: 4 }));
ck('P10 OFP1: Sprecher 4 bei 4 Sprechern → Abbruch (erlaubt 0 bis 3)', fall.m === 'Sprecher 4 gibt es nicht: erlaubt sind 0 bis 3' && fall.aufrufe === 0 && fall.gleich, fall.m);
fall = await fehlerFall(() => erzeugeAnsagen({ ...B, texte: [{ id: '../boese', text: 'x' }] }));
ck('P10 G14: Text-ID, die kein Dateiname sein darf (../boese) → Abbruch', fall.m === 'Ungültige Text-ID für einen Dateinamen: "../boese"' && fall.aufrufe === 0 && fall.gleich, fall.m);
process.env.JM_ATTRAPPE_FEHLER = 'piper';
fall = await fehlerFall(() => erzeugeAnsagen({ ...basis, texte: TEXTE2 }));
ck('P10 G14: Piper scheitert → Meldung mit Code und stderr, Ordner unverändert',
  fall.m === 'Piper endete mit Code 3: Attrappe: absichtlicher Fehler in piper' && fall.gleich, fall.m);
process.env.JM_ATTRAPPE_FEHLER = 'ffmpeg';
fall = await fehlerFall(() => erzeugeAnsagen({ ...basis, texte: TEXTE2 }));
ck('P10 G14: ffmpeg scheitert → Meldung mit Code und stderr, Ordner unverändert',
  fall.m === 'ffmpeg endete mit Code 3: Attrappe: absichtlicher Fehler in ffmpeg' && fall.gleich, fall.m);
// Alles oder nichts: scheitert erst die dritte Ansage, nachdem zwei fertig sind, bleibt der Ordner (Manifest, Liste, Bytes) unverändert.
const DRITTE = 'k2.erledigt';
// Alle drei Texte ändern sich → alle drei müssen neu erzeugt werden (die Attrappe macht die Bytes vom Text abhängig, nicht von Parametern).
const NEUE_TEXTE = TEXTE2.map((t) => ({ ...t, text: `${t.text} Noch ein Satz.` }));
const anzahl = (w: string): number => aufrufe().filter((a) => a.werkzeug === w).length;
process.env.JM_ATTRAPPE_FEHLER = 'piper';
process.env.JM_ATTRAPPE_FEHLER_BEI = DRITTE;
fall = await fehlerFall(() => erzeugeAnsagen({ ...B, texte: NEUE_TEXTE }));
ck('P10 G14: Piper scheitert erst an der dritten Ansage (zwei fertig) → Ordner unverändert, nichts halb übernommen',
  fall.m === `Piper endete mit Code 3: Attrappe: absichtlicher Fehler in piper (${DRITTE})` && anzahl('piper') === 3 && anzahl('ffmpeg') === 2 && fall.gleich,
  `${fall.m} / piper ${anzahl('piper')}, ffmpeg ${anzahl('ffmpeg')}`);
process.env.JM_ATTRAPPE_FEHLER = 'ffmpeg';
fall = await fehlerFall(() => erzeugeAnsagen({ ...B, texte: NEUE_TEXTE }));
ck('P10 G14: ffmpeg scheitert erst an der dritten Ansage (zwei fertig) → Ordner unverändert, nichts halb übernommen',
  fall.m === `ffmpeg endete mit Code 3: Attrappe: absichtlicher Fehler in ffmpeg (${DRITTE})` && anzahl('piper') === 3 && anzahl('ffmpeg') === 3 && fall.gleich,
  `${fall.m} / piper ${anzahl('piper')}, ffmpeg ${anzahl('ffmpeg')}`);
delete process.env.JM_ATTRAPPE_FEHLER_BEI;
delete process.env.JM_ATTRAPPE_FEHLER;
const kaputt = join(wurzel, 'kaputt');
mkdirSync(kaputt);
writeFileSync(join(kaputt, 'manifest.json'), 'kein JSON');
fall = await fehlerFall(() => erzeugeAnsagen({ ...B, ziel: kaputt, texte: TEXTE2 }));
ck('P10 G14: unlesbares Manifest → Abbruch mit Meldung, kein Aufruf, Datei unverändert',
  fall.m.startsWith('Manifest unlesbar: ') && fall.aufrufe === 0 && readFileSync(join(kaputt, 'manifest.json'), 'utf8') === 'kein JSON', fall.m);

// --- Kommandozeile (in diesem Prozess und einmal als echter Prozess) ----------------------------------------------------
const meldungen: string[] = [];
const merke = (s: string): void => { meldungen.push(s); };
const kz = async (argv: string[], env: Record<string, string>): Promise<[number, string]> => {
  meldungen.length = 0;
  const code = await kommandozeile(argv, env, merke, merke);
  return [code, meldungen.join('\n')];
};
let [code, text] = await kz(['--stimme', 'de_DE-mls-medium', '--sprecher', '12'], {});
ck('P10 G14: Kommandozeile ohne Umgebung → Exit 1, die Meldung nennt JM_PIPER_PYTHON, JM_PIPER_STIMME und JM_FFMPEG',
  code === 1 && text.startsWith('Fehler: Es fehlen Umgebungsvariablen: JM_PIPER_PYTHON, JM_PIPER_STIMME, JM_FFMPEG. ') && json(UMGEBUNG) === '["JM_PIPER_PYTHON","JM_PIPER_STIMME","JM_FFMPEG"]', text);
[code, text] = await kz([], {});
ck('P10 OFP1: Kommandozeile ohne --stimme → Exit 1 mit den gepinnten Namen', code === 1 && text === 'Fehler: --stimme fehlt (OFP1: de_DE-mls-medium oder de_DE-thorsten-medium)', text);
[code, text] = await kz(['--stimme', 'de_DE-karlsson-low'], {});
ck('P10 OFP1: Kommandozeile mit ungepinnter Stimme → Exit 1', code === 1 && text === 'Fehler: Stimme de_DE-karlsson-low ist nicht gepinnt (gepinnt: de_DE-mls-medium, de_DE-thorsten-medium)', text);
[code, text] = await kz(['--stimme', 'de_DE-mls-medium', '--sprecher', 'zwei'], {});
ck('P10 6: Kommandozeile mit --sprecher zwei → Exit 1', code === 1 && text === 'Fehler: --sprecher braucht eine ganze Zahl ab 0, nicht "zwei"', text);
neuesProtokoll();
[code, text] = await kz(['--stimme', 'de_DE-mls-medium', '--sprecher', '12'], { JM_PIPER_PYTHON: 'nicht-aufgerufen', JM_PIPER_STIMME: STIMME_A, JM_FFMPEG: 'nicht-aufgerufen' });
ck('P10 G14: Kommandozeile mit fremder Stimmen-Datei → Exit 1 vor jedem Werkzeug-Aufruf (Pin von de_DE-mls-medium)',
  code === 1 && text.startsWith('Fehler: Prüfsumme der Stimme passt nicht zu de_DE-mls-medium: ') && aufrufe().length === 0, text);
const ohne: Record<string, string | undefined> = { ...process.env };
for (const k of UMGEBUNG) delete ohne[k];
const proz = spawnSync(process.execPath, ['--experimental-strip-types', SKRIPT, '--stimme', 'de_DE-mls-medium'], { encoding: 'utf8', env: ohne });
ck('P10 G14: echter Prozess (wie npm run stimme:erzeugen) ohne Umgebung → Exit 1 mit der Meldung auf stderr',
  proz.status === 1 && proz.stderr.includes('Fehler: Es fehlen Umgebungsvariablen: JM_PIPER_PYTHON, JM_PIPER_STIMME, JM_FFMPEG.'), `status ${proz.status}: ${proz.stderr.trim().split('\n').at(-1)}`);

// --- Verdrahtung: Skripte in package.json, Importe der Skripte (EP16, G5, G14) -------------------------------------------
const paket = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
ck('P10 EP16: selftest ist die Kette selftest.ts && anleitung-stimme.test.ts (beide strip-types), stimme:erzeugen ruft den Erzeuger',
  paket.scripts.selftest === 'node --experimental-strip-types test/selftest.ts && node --experimental-strip-types test/anleitung-stimme.test.ts'
  && paket.scripts['stimme:erzeugen'] === 'node --experimental-strip-types scripts/anleitung-stimme.mjs', json(paket.scripts.selftest));
const importe = (pfad: string): string[] => [...readFileSync(new URL(pfad, import.meta.url), 'utf8').matchAll(/^import [^;]*? from '([^']+)';/gm)].map((x) => x[1]);
const erlaubt = (q: string): boolean => q.startsWith('node:') || ['@jm/ui/anleitung', '../src/renderer/src/anleitung/einrichtung.ts', './stimme-manifest.mjs'].includes(q);
const imp = [...importe('../scripts/anleitung-stimme.mjs'), ...importe('../scripts/stimme-manifest.mjs')];
const quelltext = readFileSync(SKRIPT, 'utf8').split('\n').filter((z) => !/^\s*(\/\/|\/\*|\*)/.test(z)).join('\n');
// -I: weder das Arbeitsverzeichnis (bei npm -w ist das apps/launcher) noch PYTHON*-Variablen im Suchpfad; die venv-Pakete bleiben erreichbar.
const isoliert = { piper: quelltext.includes("[env.JM_PIPER_PYTHON, '-I', '-m', 'piper']"), fassung: quelltext.includes("lauf('Python', [python], ['-I', '-c', ") };
ck('P10 G5 G14: Skripte importieren nur node:-Module, @jm/ui/anleitung, die Anleitungs-Datei und stimme-manifest.mjs; kein import piper; Python nur isoliert (-I)',
  imp.length === 11 && imp.every(erlaubt) && !/\bimport\s+piper\b|\bfrom piper\b/.test(quelltext) && isoliert.piper && isoliert.fassung, `${json(imp)} ${json(isoliert)}`);

rmSync(wurzel, { recursive: true, force: true });
// --- P11 · Bau-Prüfung der Ansagen (EP15): Fixture-Ordner im Temp statt eines echten Baus -------------------------------
{
  const { pruefeBau } = await import('../scripts/pruefe-bau-stimme.mjs');
  const bau = mkdtempSync(join(tmpdir(), 'jm-stimme-bau-'));
  writeFileSync(join(bau, 'einleitung-Ab12Cd34.ogg'), 'OggS Ansage A');
  writeFileSync(join(bau, 'k1.zugang-Ef56Gh78.ogg'), 'OggS Ansage B');
  writeFileSync(join(bau, 'index-Xy12Zw34.js'), 'const a="./einleitung-Ab12Cd34.ogg",b="./k1.zugang-Ef56Gh78.ogg";');
  const eintrag = (id: string, datei: string) => ({ id, textSha256: '0'.repeat(64), datei: `${id}.ogg`, dateiSha256: dateiSha256(join(bau, datei)), bytes: 13 });
  const mitStimme = {
    format: 1, stimme: { name: 'de_DE-mls-medium', onnxSha256: '0'.repeat(64), lizenz: 'CC BY 4.0', namensnennung: 'x', sprecher: 0 },
    werkzeug: { piper: '1.8.0', ffmpeg: '8.1.2' }, parameter: { lengthScale: 1.05, sentenceSilence: 0.3, opusKbps: 24 },
    eintraege: [eintrag('einleitung', 'einleitung-Ab12Cd34.ogg'), eintrag('k1.zugang', 'k1.zugang-Ef56Gh78.ogg')],
  };
  const ohneStimme = { format: 1, stimme: null, werkzeug: null, parameter: null, eintraege: [] };
  ck('P11 6 EP15: Bau stimmig (2 Ansagen als Datei, umbenannt von Vite, kein data:audio) → keine Befunde', json(pruefeBau(bau, mitStimme)) === '[]', json(pruefeBau(bau, mitStimme)));
  writeFileSync(join(bau, 'index-Zz98Yy76.js'), 'const k="data:audio/ogg;base64,T2dnUw==";');
  ck('P11 6 EP15: data:audio im JS → Befund mit dem Dateinamen', json(pruefeBau(bau, mitStimme)) === '["data:audio im Bau: index-Zz98Yy76.js"]', json(pruefeBau(bau, mitStimme)));
  unlinkSync(join(bau, 'index-Zz98Yy76.js'));
  const b = readFileSync(join(bau, 'k1.zugang-Ef56Gh78.ogg'));
  unlinkSync(join(bau, 'k1.zugang-Ef56Gh78.ogg'));
  ck('P11 6 EP15: eine Ansage des Manifests fehlt im Bau → Befund', json(pruefeBau(bau, mitStimme)) === '["Ansage fehlt im Bau: k1.zugang.ogg"]', json(pruefeBau(bau, mitStimme)));
  writeFileSync(join(bau, 'k1.zugang-Ef56Gh78.ogg'), b);
  writeFileSync(join(bau, 'probe-Qq11Rr22.ogg'), 'OggS fremd');
  ck('P11 6 EP15: eine .ogg ohne Eintrag im Bau → Befund', json(pruefeBau(bau, mitStimme)) === '["Ogg ohne Eintrag im Bau: probe-Qq11Rr22.ogg"]', json(pruefeBau(bau, mitStimme)));
  unlinkSync(join(bau, 'probe-Qq11Rr22.ogg'));
  unlinkSync(join(bau, 'einleitung-Ab12Cd34.ogg'));
  unlinkSync(join(bau, 'k1.zugang-Ef56Gh78.ogg'));
  ck('P11 6 EP14 P18: ohne Stimme und ohne .ogg stimmig; mit --verlange-stimme ist „ohne Stimme“ ein Befund',
    json(pruefeBau(bau, ohneStimme)) === '[]'
    && json(pruefeBau(bau, ohneStimme, { verlangeStimme: true })) === '["Manifest ohne Stimme (OFP1 „ohne Ton“? Sonst zuerst npm run stimme:erzeugen)"]');
  ck('P11 6 EP15: kein Bau-Ordner → Befund „Bau fehlt“', String(pruefeBau(join(bau, 'fehlt'), ohneStimme)[0]).startsWith('Bau fehlt: '));
  rmSync(bau, { recursive: true, force: true });
}
// --- P11 Fix-Runde 1 · Start-Wächter: ein Aufruf über Junction/Symlink darf nie stumm enden --------------------------------
{
  const wurzel2 = mkdtempSync(join(tmpdir(), 'jm-stimme-haupt-'));
  const echt = join(wurzel2, 'echt');
  const link = join(wurzel2, 'link');
  mkdirSync(echt);
  const helfer = pathToFileURL(fileURLToPath(new URL('../scripts/stimme-manifest.mjs', import.meta.url))).href;
  writeFileSync(join(echt, 'haupt.mjs'), `import { fileURLToPath } from 'node:url';
import { istHauptmodul } from ${JSON.stringify(helfer)};
if (istHauptmodul(fileURLToPath(import.meta.url), process.argv[1])) console.log('HAUPT');
`);
  symlinkSync(echt, link, 'junction');
  const lauf = (pfad: string): string => { const r = spawnSync(process.execPath, [pfad], { encoding: 'utf8' }); return `${r.status}|${r.stdout.trim()}|${r.stderr.trim()}`; };
  const direkt = lauf(join(echt, 'haupt.mjs')), ueber = lauf(join(link, 'haupt.mjs'));
  ck('P11 Fix1 EP15: der Start-Wächter erkennt das Hauptmodul auch über Junction/Symlink (sonst endet die Bau-Prüfung stumm mit Exit 0)',
    direkt === '0|HAUPT|' && ueber === '0|HAUPT|', `direkt=${direkt} ueber=${ueber}`);
  unlinkSync(link);
  rmSync(wurzel2, { recursive: true, force: true });
}
// ── Ende der Fälle ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

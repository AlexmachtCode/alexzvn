// Bauprobe des Workers ohne wrangler und ohne Netz (Anmeldung im Launcher, Plan Teil 1, P20; EP1, G15).
//   node services/release-proxy/tools/bauprobe.mjs
// Bündelt worker.js wie wrangler beim Deploy (esbuild aus dem Repo, ESM, platform neutral, Bedingungen workerd/worker/
// browser, ohne nodejs_compat: ein node:-Import scheitert hier wie dort), schreibt nichts und druckt Bytes, Warnungen und
// Exporte. Prüft, dass jede Durable-Object-Klasse aus wrangler.toml (class_name, new_sqlite_classes) vom Bündel exportiert
// wird und dass gesetzte Stichtage ALTKEY_BIS und ALTKEY_CONNECT_BIS lesbar sind (EP9). Exit 0 nur ohne Fehler, ohne
// Warnung, mit allen Klassen und lesbaren Stichtagen; sonst Exit 1 mit den Befunden.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(HIER, '..', 'worker.js');
const TOML = path.join(HIER, '..', 'wrangler.toml');

const toml = readFileSync(TOML, 'utf8')
  .split(/\r?\n/)
  .filter((z) => !z.trim().startsWith('#'))
  .join('\n');
const klassen = new Set([...toml.matchAll(/^class_name\s*=\s*"([^"]+)"/gm)].map((m) => m[1]));
for (const m of toml.matchAll(/^new_sqlite_classes\s*=\s*\[([^\]]*)\]/gm)) {
  for (const k of m[1].matchAll(/"([^"]+)"/g)) klassen.add(k[1]);
}

// EP9: Ein gesetzter, aber unlesbarer Stichtag (Tippfehler wie 2026-12-32 oder ohne Anführungszeichen) hieße im Worker still
// „unbefristet“ (alterKeyGilt: Diagnose unlesbar). Geprüft wird mit derselben Funktion; konto-kern.js kommt über esbuild und
// eine data:-Adresse, damit Node keine Typ-Warnung (MODULE_TYPELESS_PACKAGE_JSON) in die Ausgabe schreibt.
const kern = await build({ entryPoints: [path.join(HIER, '..', 'konto-kern.js')], bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent' });
const { alterKeyGilt } = await import(`data:text/javascript;base64,${Buffer.from(kern.outputFiles[0].contents).toString('base64')}`);
const fristen = [['ALTKEY_BIS', 'katalog'], ['ALTKEY_CONNECT_BIS', 'connect']].map(([name, gruppe]) => {
  const m = toml.match(new RegExp(`^${name}\\s*=\\s*(.*?)\\s*$`, 'm'));
  if (!m) return { name, ok: true, text: 'nicht gesetzt (unbefristet)' };
  const wert = /^"([^"]*)"$/.exec(m[1]);
  const g = wert ? alterKeyGilt({ [name]: wert[1] }, gruppe, Date.now()) : { diagnose: 'unlesbar' };
  if (g.diagnose === 'unlesbar') return { name, ok: false, text: `UNLESBAR (${m[1]})` };
  return { name, ok: true, text: g.diagnose === 'ohne-ende' ? 'leer (unbefristet)' : `bis ${g.bis}` };
});

let ergebnis;
try {
  ergebnis = await build({
    entryPoints: [WORKER],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    mainFields: ['workerd', 'worker', 'browser', 'module', 'main'],
    conditions: ['workerd', 'worker', 'browser'],
    outfile: 'bauprobe.js',
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
} catch (e) {
  const fehler = Array.isArray(e && e.errors) ? e.errors : [{ text: String((e && e.message) || e) }];
  console.log(`Bauprobe worker.js: ${fehler.length} Fehler`);
  for (const f of fehler) console.log(`  Fehler: ${f.text}${f.location ? ` (${f.location.file}:${f.location.line})` : ''}`);
  process.exit(1);
}

const [ausgabe] = ergebnis.outputFiles;
const meta = Object.values(ergebnis.metafile.outputs)[0];
const exporte = [...meta.exports].sort();
const fehlend = [...klassen].filter((k) => !exporte.includes(k)).sort();
console.log(`Bauprobe worker.js: ${ausgabe.contents.byteLength} Bytes, ${ergebnis.warnings.length} Warnungen, ${Object.keys(ergebnis.metafile.inputs).length} Eingabedateien`);
console.log(`Exporte: ${exporte.join(', ')}`);
console.log(`DO-Klassen aus wrangler.toml: ${[...klassen].sort().join(', ')}${fehlend.length ? ` — NICHT exportiert: ${fehlend.join(', ')}` : ' — alle exportiert'}`);
console.log(`Stichtage aus wrangler.toml: ${fristen.map((f) => `${f.name} ${f.text}`).join(', ')}`);
for (const w of ergebnis.warnings) console.log(`  Warnung: ${w.text}${w.location ? ` (${w.location.file}:${w.location.line})` : ''}`);
process.exit(ergebnis.warnings.length || fehlend.length || !exporte.includes('default') || fristen.some((f) => !f.ok) ? 1 : 0);

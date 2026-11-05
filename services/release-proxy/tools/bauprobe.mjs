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

// Kleiner TOML-Leser (Fixrunde 1): Tabellenkopf mitführen. Ein Schlüssel zählt nur in seiner Tabelle: ein ALTKEY_BIS ganz oben
// sähe der Worker nicht (alter Schlüssel unbefristet), ein deleted_classes in v2 löschte den DO beim Deploy.
const tabellen = [{ kopf: '', feld: false, kv: [] }];
for (const z of readFileSync(TOML, 'utf8').split(/\r?\n/)) {
  const s = z.trim();
  if (!s || s.startsWith('#')) continue;
  const kopf = /^(\[\[?)\s*([^\]]+?)\s*\]\]?$/.exec(s);
  if (kopf) { tabellen.push({ kopf: kopf[2], feld: kopf[1] === '[[', kv: [] }); continue; }
  const kv = /^(["']?)([A-Za-z0-9_.-]+)\1\s*=\s*(.*)$/.exec(s);
  if (kv) tabellen[tabellen.length - 1].kv.push([kv[2], kv[3].trim()]);
}
const befunde = [];
const klassen = new Set();
const migTab = tabellen.filter((t) => t.kopf === 'migrations');
const bindTab = tabellen.filter((t) => t.kopf === 'durable_objects.bindings');
const varsTab = tabellen.filter((t) => t.kopf === 'vars' && !t.feld);
const schluessel = (t) => t.kv.map(([k]) => k).join(',');
// Z1-W2 (AR70): genau diese sechs Rate-Limit-Bindungen der Anmeldung: Name, namespace_id, limit je period (Sekunden). period nur 10 oder 60.
const RL_SOLL = [
  ['KONTO_RL_VORGANG', '7301', 20, 60],
  ['KONTO_RL_ABHOLEN', '7302', 600, 60],
  ['KONTO_RL_ABBRECHEN', '7303', 60, 60],
  ['KONTO_RL_GOOGLE', '7304', 60, 60],
  ['KONTO_RL_PASSWORT', '7305', 10, 60],
  ['KONTO_RL_SELBSTUPDATE', '7306', 20, 60],
];
const rlTab = tabellen.filter((t) => t.kopf.startsWith('ratelimits'));
const rlIst = [];
let rlAufbauOk = rlTab.length === RL_SOLL.length * 2;
for (let i = 0; i + 1 < rlTab.length; i += 2) {
  const [a, s] = [rlTab[i], rlTab[i + 1]];
  if (a.kopf !== 'ratelimits' || !a.feld || schluessel(a) !== 'name,namespace_id' || s.kopf !== 'ratelimits.simple' || s.feld || schluessel(s) !== 'limit,period') { rlAufbauOk = false; continue; }
  const roh = (t, n) => t.kv.find(([k]) => k === n)[1];
  // AR79: Rohwerte prüfen: namespace_id ist ein String (Doku), name ein KONTO_RL_-Name, limit und period Zahlen.
  if (!/^"KONTO_RL_[A-Z]+"$/.test(roh(a, 'name')) || !/^"\d+"$/.test(roh(a, 'namespace_id')) || !/^\d+$/.test(roh(s, 'limit')) || !/^\d+$/.test(roh(s, 'period'))) rlAufbauOk = false;
  rlIst.push([roh(a, 'name').replace(/^"|"$/g, ''), roh(a, 'namespace_id').replace(/^"|"$/g, ''), Number(roh(s, 'limit')), Number(roh(s, 'period'))]);
}
if (migTab.length !== 2 || migTab.some((t) => !t.feld || schluessel(t) !== 'tag,new_sqlite_classes')) befunde.push('[[migrations]]: genau zwei Tabellen, je nur tag und new_sqlite_classes');
if (bindTab.some((t) => !t.feld || schluessel(t) !== 'name,class_name')) befunde.push('[[durable_objects.bindings]]: je nur name und class_name');
if (varsTab.length !== 1) befunde.push('[vars]: genau eine Tabelle');
if (!rlAufbauOk || JSON.stringify(rlIst) !== JSON.stringify(RL_SOLL) || rlIst.some(([, , l, p]) => !Number.isInteger(l) || l < 1 || (p !== 10 && p !== 60))) befunde.push('[[ratelimits]]: genau die sechs Eintraege KONTO_RL_* (je mit [ratelimits.simple] aus limit und period, period 10 oder 60)');
if (tabellen.some((t) => t.kopf !== 'vars' && t.kv.some(([k]) => k.endsWith('_JURISDICTION')))) befunde.push('*_JURISDICTION steht ausserhalb von [vars]');
for (const t of migTab) for (const [k, w] of t.kv) if (k === 'new_sqlite_classes') for (const m of w.matchAll(/"([^"]+)"/g)) klassen.add(m[1]);
for (const t of bindTab) for (const [k, w] of t.kv) if (k === 'class_name') { const m = /^"([^"]+)"$/.exec(w); if (m) klassen.add(m[1]); }

// EP9: Ein gesetzter, aber unlesbarer Stichtag (Tippfehler wie 2026-12-32 oder ohne Anführungszeichen) hieße im Worker still
// „unbefristet“ (alterKeyGilt: Diagnose unlesbar). Geprüft wird mit derselben Funktion; konto-kern.js kommt über esbuild und
// eine data:-Adresse, damit Node keine Typ-Warnung (MODULE_TYPELESS_PACKAGE_JSON) in die Ausgabe schreibt.
const kern = await build({ entryPoints: [path.join(HIER, '..', 'konto-kern.js')], bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent' });
const { alterKeyGilt } = await import(`data:text/javascript;base64,${Buffer.from(kern.outputFiles[0].contents).toString('base64')}`);
const fristen = [['ALTKEY_BIS', 'katalog'], ['ALTKEY_CONNECT_BIS', 'connect']].map(([name, gruppe]) => {
  const draussen = tabellen.find((t) => t.kopf !== 'vars' && t.kv.some(([k]) => k === name));
  if (draussen) return { name, ok: false, text: `AUSSERHALB von [vars] (Tabelle "${draussen.kopf || 'oben'}"), der Worker sähe ihn nicht` };
  const treffer = (varsTab[0] ? varsTab[0].kv : []).filter(([k]) => k === name);
  if (treffer.length > 1) return { name, ok: false, text: 'MEHRFACH gesetzt' };
  const m = treffer.length ? [null, treffer[0][1]] : null;
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
console.log(`Drosseln aus wrangler.toml: ${rlIst.map(([n, , l, p]) => `${n} ${l}/${p} s`).join(', ')}`);
console.log(`Stichtage aus wrangler.toml: ${fristen.map((f) => `${f.name} ${f.text}`).join(', ')}`);
for (const w of ergebnis.warnings) console.log(`  Warnung: ${w.text}${w.location ? ` (${w.location.file}:${w.location.line})` : ''}`);
for (const b of befunde) console.log(`  Befund wrangler.toml: ${b}`);
process.exit(befunde.length || ergebnis.warnings.length || fehlend.length || !exporte.includes('default') || fristen.some((f) => !f.ok) ? 1 : 0);

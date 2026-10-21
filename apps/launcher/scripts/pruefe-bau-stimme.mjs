// Bau-Prüfung der Ansagen (Plan Geführte Anleitungen P11; EP15; Lehre „eine CSP-Lücke legt nur den Installer lahm“).
//
//   node scripts/pruefe-bau-stimme.mjs [--verlange-stimme]      (npm run stimme:bau-pruefen -w @jm/launcher, nach dem Bau)
//
// Prüft out/renderer/assets: kein data:audio im JS oder CSS (die CSP erlaubt media-src nur 'self' blob:), jede Ansage aus
// dem Manifest liegt als Datei im Bau (Vergleich über die SHA-256, denn Vite benennt um), keine .ogg ohne Eintrag.
// --verlange-stimme: ein Manifest ohne Stimme ist ein Befund (Gesamtprüfung, außer der Owner hat bei OFP1 „ohne Ton“
// gewählt). Jeder Befund steht auf stderr, Exit 1.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dateiSha256 } from './stimme-manifest.mjs';

/** Befunde zum gebauten Renderer (leer = in Ordnung). */
export function pruefeBau(assetsOrdner, manifest, optionen = {}) {
  if (!existsSync(assetsOrdner)) return [`Bau fehlt: ${assetsOrdner} (zuerst npm run build -w @jm/launcher)`];
  const befunde = [];
  const namen = readdirSync(assetsOrdner).sort();
  for (const name of namen) {
    if (/\.(js|mjs|css)$/.test(name) && readFileSync(join(assetsOrdner, name), 'utf8').includes('data:audio/')) befunde.push(`data:audio im Bau: ${name}`);
  }
  const imBau = new Map();
  for (const name of namen.filter((n) => n.endsWith('.ogg'))) imBau.set(dateiSha256(join(assetsOrdner, name)), name);
  const erwartet = new Set();
  for (const e of manifest.eintraege) {
    erwartet.add(e.dateiSha256);
    if (!imBau.has(e.dateiSha256)) befunde.push(`Ansage fehlt im Bau: ${e.datei}`);
  }
  for (const [sha, name] of imBau) if (!erwartet.has(sha)) befunde.push(`Ogg ohne Eintrag im Bau: ${name}`);
  if (optionen.verlangeStimme && manifest.stimme === null) befunde.push('Manifest ohne Stimme (OFP1 „ohne Ton“? Sonst zuerst npm run stimme:erzeugen)');
  return befunde;
}

const direkt = process.argv[1] !== undefined && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (direkt) {
  const assets = fileURLToPath(new URL('../out/renderer/assets/', import.meta.url));
  const manifestPfad = fileURLToPath(new URL('../src/renderer/src/anleitung/stimme/manifest.json', import.meta.url));
  let manifest = null;
  try {
    manifest = JSON.parse(readFileSync(manifestPfad, 'utf8'));
  } catch (e) {
    console.error(`Fehler: Manifest unlesbar: ${manifestPfad} (${e.message})`);
    process.exit(1);
  }
  const befunde = pruefeBau(assets, manifest, { verlangeStimme: process.argv.includes('--verlange-stimme') });
  if (befunde.length > 0) {
    for (const b of befunde) console.error(`Befund: ${b}`);
    console.error(`Bau-Prüfung Stimme: ${befunde.length} Befunde.`);
    process.exitCode = 1;
  } else {
    console.log(`Bau-Prüfung Stimme: ${manifest.eintraege.length} Ansagen im Manifest, alle als Datei im Bau, kein data:audio (${manifest.stimme === null ? 'keine Stimme in dieser Fassung' : `Stimme ${manifest.stimme.name}`}).`);
  }
}

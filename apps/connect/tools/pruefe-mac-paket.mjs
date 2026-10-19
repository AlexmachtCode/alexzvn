// Prüfung „macOS ohne Zoom und ohne NDI“ am fertigen Mac-Bau von JM Connect (iveo-Paket, Spec 10.2; E39, OF1 Variante A,
// EP7). Läuft im Workflow .github/workflows/connect-mac.yml nach electron-builder und vor dem Hochladen:
//
//   node apps/connect/tools/pruefe-mac-paket.mjs <release-Ordner>
//
// Exit 0: genau zwei DMGs (eins mit arm64, eins mit x64 im Namen), genau zwei „JM Connect.app“ unter mac*/, in keiner ein
// Ordner zoom-bridge und keine Datei jm_ndi.node unter Contents/Resources. Exit 1: jede Abweichung als eigene Zeile auf
// stderr. Exit 2: Aufruf ohne Ordner. Nur node:-Module: Der Workflow holt das Skript aus seinem eigenen Commit
// (werkzeug/), auch wenn der gebaute Tag es noch nicht kennt (EP6, connect-v0.3.0). Zoom-SDK-Dateien prüft schon der
// After-Pack-Wächter (tools/after-pack.cjs), der den Bau sonst abbricht.
import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = 'JM Connect.app';

/** Alle Pfade unter `wurzel` mit dem letzten Teil `name` (Ordner bzw. Datei), ohne Verknüpfungen zu folgen. */
function finde(wurzel, name, art) {
  const treffer = [];
  const gehe = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isSymbolicLink()) continue;
      const p = join(d, e.name);
      if (e.name === name && (art === 'ordner' ? e.isDirectory() : e.isFile())) treffer.push(p);
      if (e.isDirectory()) gehe(p);
    }
  };
  gehe(wurzel);
  return treffer;
}

/** Prüft einen release-Ordner von electron-builder (Spec 10.2). */
export function pruefeMacPaket(releaseOrdner) {
  if (!existsSync(releaseOrdner) || !statSync(releaseOrdner).isDirectory()) {
    return { ok: false, fehler: [`Ordner „${releaseOrdner}“ fehlt.`] };
  }
  const fehler = [];
  const eintraege = readdirSync(releaseOrdner, { withFileTypes: true });
  const dmgs = eintraege.filter((e) => e.isFile() && e.name.endsWith('.dmg')).map((e) => e.name).sort();
  if (dmgs.length !== 2) fehler.push(`genau zwei DMGs erwartet, gefunden ${dmgs.length}${dmgs.length ? `: ${dmgs.join(', ')}` : ''}.`);
  for (const arch of ['arm64', 'x64']) {
    const n = dmgs.filter((name) => name.includes(arch)).length;
    if (n !== 1) fehler.push(`genau ein DMG mit „${arch}“ im Namen erwartet, gefunden ${n}.`);
  }
  const apps = eintraege
    .filter((e) => e.isDirectory() && e.name.startsWith('mac'))
    .map((e) => join(releaseOrdner, e.name, APP, 'Contents', 'Resources'))
    .filter((p) => existsSync(p) && statSync(p).isDirectory());
  if (apps.length !== 2) fehler.push(`genau zwei „${APP}“ unter mac*/ erwartet, gefunden ${apps.length}.`);
  for (const res of apps) {
    for (const p of finde(res, 'zoom-bridge', 'ordner')) fehler.push(`Ordner zoom-bridge im Mac-Paket: ${p}`);
    for (const p of finde(res, 'jm_ndi.node', 'datei')) fehler.push(`NDI-Addon im Mac-Paket (OF1 Variante A: ohne NDI): ${p}`);
  }
  return { ok: fehler.length === 0, fehler };
}

function hauptprogramm(argv) {
  const ordner = argv[2];
  if (!ordner) {
    console.error('Aufruf: node apps/connect/tools/pruefe-mac-paket.mjs <release-Ordner>');
    return 2;
  }
  const { ok, fehler } = pruefeMacPaket(resolve(ordner));
  if (ok) {
    console.log('pruefe-mac-paket: in Ordnung (zwei DMGs arm64 und x64, zwei JM Connect.app ohne zoom-bridge und ohne jm_ndi.node).');
    return 0;
  }
  for (const f of fehler) console.error(`pruefe-mac-paket: ${f}`);
  return 1;
}

/**
 * Läuft diese Datei als Hauptprogramm? Node löst das Hauptmodul über realpath auf, setzt argv[1] aber nur mit resolve: Unter
 * einem symbolischen Link oder einer Junction wären beide verschieden, und die Prüfung endete still mit Exit 0 (gegen den
 * sicheren Fehlschlag aus EP7). Darum beide Seiten über realpath vergleichen.
 */
function istHauptprogramm(arg) {
  if (!arg) return false;
  try {
    return realpathSync(resolve(arg)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (istHauptprogramm(process.argv[1])) process.exitCode = hauptprogramm(process.argv);

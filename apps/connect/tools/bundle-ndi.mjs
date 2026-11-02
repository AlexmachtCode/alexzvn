// Staged beim `prepackage` (vor electron-builder) die für den NDI-Versand nötigen Dateien nach resources/bin/<plat>/ —
// von dort lädt @jm/ndi sie zur Laufzeit (Spec Zoom-Slots 22.7, E46, E54, LP4, LP7):
//   Windows (resources/bin/win): das Addon jm_ndi.node, die Laufzeit Processing.NDI.Lib.x64.dll und daneben ihr
//     Lizenztext Processing.NDI.Lib.Licenses.txt (Bin\x64 des SDK; ohne ihn Abbruch, Vorbild
//     packages/zoom-bridge/scripts/build-release.mjs). Vorher die Fassungsprüfung: Dateiversion der DLL und SHA-256 von
//     Lizenz und Doku gegen NDI_LESESTAND_WINDOWS aus tools/pruefe-mac-paket.mjs (E54); weicht ein Wert ab, Abbruch.
//   macOS (resources/bin/mac, ab 0.4.0, nach dem Titler apps/titler/tools/bundle-ndi.mjs): das universelle Addon (aus
//     tools/ndi-universal.mjs) und libndi.dylib, beide mit arm64 UND x86_64 (sonst Abbruch), die Lizenzdatei(en) der
//     Laufzeit (nur Textdateien), die libndi-Referenz des Addons auf @loader_path/libndi.dylib umgebogen, danach ad hoc
//     neu signiert und beide Dateien mit codesign --verify geprüft. Die Fassung prüft hier nicht der Mac-Zweig: Seine
//     Quellen kommen im Workflow aus dem Tag; die Fassungsprüfung läuft dort vorher aus dem Commit des Workflows (E54).
// Ohne NDI_SDK_DIR Abbruch. Linux: übersprungen. Alle Dateien sind gitignored und werden pro Bau frisch bereitgestellt; beide
// Zweige leeren ihren Ordner vorher (frischerOrdner bzw. rmSync, Nachtrag C).
// Die reinen Teile (libndiReferenz, lizenzDateien, windowsNdiZeile) prüft test/bundle-ndi.test.mjs (PK51); als
// Hauptprogramm läuft die Datei nur über istHauptprogramm, ein Import hat keine Nebenwirkung.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { machOArchitekturen, NDI_LESESTAND_WINDOWS, pruefeNdiLesestand } from './pruefe-mac-paket.mjs';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(appRoot, '..', '..');

/**
 * Die libndi-Referenz eines Addons aus der Ausgabe von `otool -L` (E46): { alt, aendern } oder null ohne Referenz.
 * Die erste Zeile (die Datei selbst, endet mit „:“) zählt nicht; ein Pfad darf Leerzeichen enthalten (die Klammer
 * „(compatibility version …)“ trennt ihn ab). `aendern` ist false, wenn sie schon @loader_path/libndi.dylib ist.
 */
export function libndiReferenz(otoolAusgabe) {
  for (const zeile of String(otoolAusgabe).split(/\r?\n/)) {
    if (!/^\s/.test(zeile)) continue;
    const m = /^\s+(.+?)\s+\(compatibility version [^)]*\)\s*$/.exec(zeile);
    const pfad = m ? m[1] : zeile.trim();
    if (/^libndi[^/]*\.dylib$/.test(pfad.split('/').pop())) return { alt: pfad, aendern: pfad !== '@loader_path/libndi.dylib' };
  }
  return null;
}

/**
 * Lizenzdatei(en) der NDI-Laufzeit aus der Dateiliste eines SDK (Pfade relativ zur Wurzel, mit „/“; LP4, AN35): nur
 * Textdateien (.txt), deren Pfad „licen“ enthält (Datei oder Ordner, z. B. licenses/…), nie aus Beispielen (Ordner
 * examples); Header, PDFs und Bibliotheken fallen damit weg. Reihenfolge wie in `namen`.
 */
export function lizenzDateien(namen) {
  return namen.filter((n) => {
    const teile = n.toLowerCase().split('/');
    return teile.at(-1).endsWith('.txt') && n.toLowerCase().includes('licen') && !teile.includes('examples');
  });
}

/** Die Bauprotokoll-Zeile der Windows-Laufzeit (E54): Dateiversion, SHA-256 der DLL, SHA-256 und Datum von Lizenz und Doku. */
export function windowsNdiZeile(werte) {
  const lizenz = werte.lizenz === 'fehlt' ? 'Lizenz fehlt' : `Lizenz ${werte.lizenz} vom ${werte.lizenzDatum}`;
  const doku = werte.doku === 'fehlt' ? 'Doku fehlt' : `Doku ${werte.doku} vom ${werte.dokuDatum}`;
  return `[bundle-ndi] NDI-Laufzeit Windows: Dateiversion ${werte.dateiversion} (SHA-256: DLL ${werte.dll}, ${lizenz}, ${doku})`;
}

/**
 * Legt `ordner` frisch und leer an (Nachtrag C, I-C15-1, R23; wie der Mac-Zweig, C4E8): Dateien eines früheren Baus, etwa eine
 * Laufzeit oder Lizenzdatei unter altem Namen, dürfen nicht über extraResources mitreisen. rmSync folgt keiner Verknüpfung
 * (Junction), es entfernt nur sie selbst; der Ordner resources/bin ist ein gewöhnlicher, gitignorierter Ordner.
 */
export function frischerOrdner(ordner) {
  rmSync(ordner, { recursive: true, force: true });
  mkdirSync(ordner, { recursive: true });
}

/**
 * Läuft diese Datei als Hauptprogramm? Über realpath auf beiden Seiten, wie tools/pruefe-mac-paket.mjs (unter einem Link
 * oder einer Junction wären argv[1] und die Modul-Adresse sonst verschieden).
 */
export function istHauptprogramm(arg, modulUrl = import.meta.url) {
  if (!arg) return false;
  try {
    return realpathSync(resolve(arg)) === realpathSync(fileURLToPath(modulUrl));
  } catch {
    return false;
  }
}

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const zwei = (n) => String(n).padStart(2, '0');
/** Änderungsdatum als TT.MM.JJJJ (Ortszeit des Bau-Rechners). */
const datum = (p) => {
  const m = statSync(p).mtime;
  return `${zwei(m.getDate())}.${zwei(m.getMonth() + 1)}.${m.getFullYear()}`;
};
/** Alle Dateien unter `wurzel` als Pfade relativ dazu, mit „/“, ohne Verknüpfungen zu folgen. */
function dateienRelativ(wurzel, vorne = '') {
  const out = [];
  for (const e of readdirSync(join(wurzel, vorne), { withFileTypes: true })) {
    const rel = vorne ? `${vorne}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...dateienRelativ(wurzel, rel));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

function macZweig(sdk) {
  const destDir = join(appRoot, 'resources', 'bin', 'mac');
  const nodeSrc = join(repoRoot, 'packages', 'ndi', 'build', 'Release', 'jm_ndi.node');
  if (!existsSync(nodeSrc)) throw new Error(`[bundle-ndi] Addon nicht gefunden: ${nodeSrc} — erst \`npm run rebuild:native:mac -w @jm/connect\`.`);
  const dylibLink = join(sdk, 'lib', 'macOS', 'libndi.dylib');
  if (!existsSync(dylibLink)) throw new Error(`[bundle-ndi] libndi.dylib nicht gefunden: ${dylibLink}`);
  const dylibReal = lstatSync(dylibLink).isSymbolicLink() ? realpathSync(dylibLink) : dylibLink;
  // Beide Architekturen in beiden Dateien (E46): extraResources legt denselben Ordner in die arm64- und die x64-App.
  for (const [name, pfad] of [['jm_ndi.node', nodeSrc], ['libndi.dylib', dylibReal]]) {
    const archs = machOArchitekturen(readFileSync(pfad));
    if (!archs.includes('arm64') || !archs.includes('x86_64')) {
      throw new Error(`[bundle-ndi] ${name} enthält nicht arm64 und x86_64 (${archs.join(', ') || 'kein Mach-O'}): ${pfad}`);
    }
  }
  const lizenzen = lizenzDateien(dateienRelativ(sdk));
  if (!lizenzen.length) throw new Error(`[bundle-ndi] keine Lizenzdatei der NDI-Laufzeit (.txt mit „licen“ im Pfad) unter ${sdk}`);
  const namen = lizenzen.map((l) => basename(l));
  if (new Set(namen).size !== namen.length) throw new Error(`[bundle-ndi] Lizenzdateien mit gleichem Namen: ${lizenzen.join(', ')}`);
  // Frisch: alte Dateien eines früheren Baus (etwa eine Lizenzdatei unter altem Namen) dürfen nicht mitreisen.
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });
  const nodeDest = join(destDir, 'jm_ndi.node');
  const dylibDest = join(destDir, 'libndi.dylib');
  copyFileSync(nodeSrc, nodeDest);
  copyFileSync(dylibReal, dylibDest);
  for (const l of lizenzen) copyFileSync(join(sdk, l), join(destDir, basename(l)));
  // libndi-Referenz der .node auf @loader_path/libndi.dylib umbiegen (+ rpath @loader_path als Rückfall).
  const ref = libndiReferenz(execFileSync('otool', ['-L', nodeDest], { encoding: 'utf8' }));
  if (!ref) throw new Error(`[bundle-ndi] jm_ndi.node verweist laut otool -L auf keine libndi: ${nodeDest}`);
  if (ref.aendern) execFileSync('install_name_tool', ['-change', ref.alt, '@loader_path/libndi.dylib', nodeDest]);
  try {
    execFileSync('install_name_tool', ['-add_rpath', '@loader_path', nodeDest], { stdio: 'pipe' });
  } catch (err) {
    if (!/would duplicate|already/.test(String(err.stderr || err.message || ''))) throw err;
  }
  // install_name_tool macht die Signatur ungültig; Apple Silicon lädt keine Mach-O-Datei ohne gültige Signatur (LQ12).
  execFileSync('codesign', ['--force', '--sign', '-', nodeDest], { stdio: 'inherit' });
  try {
    execFileSync('codesign', ['--verify', dylibDest], { stdio: 'pipe' });
  } catch {
    execFileSync('codesign', ['--force', '--sign', '-', dylibDest], { stdio: 'inherit' });
  }
  for (const d of [nodeDest, dylibDest]) execFileSync('codesign', ['--verify', '--verbose', d], { stdio: 'inherit' });
  console.log(`[bundle-ndi] mac: jm_ndi.node (${machOArchitekturen(readFileSync(nodeDest)).join(', ')}, libndi ${ref.alt} → @loader_path/libndi.dylib, ad hoc signiert) → ${nodeDest}`);
  console.log(`[bundle-ndi] mac: libndi.dylib (${machOArchitekturen(readFileSync(dylibDest)).join(', ')}) → ${dylibDest}`);
  for (const l of lizenzen) console.log(`[bundle-ndi] mac: Lizenzdatei ${l} → ${join(destDir, basename(l))}`);
}

function windowsZweig(sdk) {
  const destDir = join(appRoot, 'resources', 'bin', 'win');
  const dll = join(sdk, 'Bin', 'x64', 'Processing.NDI.Lib.x64.dll');
  const sources = [
    { name: 'jm_ndi.node', src: join(repoRoot, 'packages', 'ndi', 'build', 'Release', 'jm_ndi.node') },
    { name: 'Processing.NDI.Lib.x64.dll', src: dll },
    { name: 'Processing.NDI.Lib.Licenses.txt', src: join(sdk, 'Bin', 'x64', 'Processing.NDI.Lib.Licenses.txt') },
  ];
  for (const { name, src } of sources) {
    if (!existsSync(src)) throw new Error(`[bundle-ndi] Quelle für ${name} nicht gefunden: ${src}`);
  }
  // Fassungsprüfung (E54): Dateiversion der DLL über PowerShell (VersionInfo.FileVersion), Lizenz und Doku per SHA-256.
  const ps = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const dateiversion = execFileSync(ps, ['-NoProfile', '-NonInteractive', '-Command', '(Get-Item -LiteralPath $env:JM_NDI_DLL).VersionInfo.FileVersion'], {
    encoding: 'utf8',
    env: { ...process.env, JM_NDI_DLL: dll },
  }).trim();
  const lizenz = join(sdk, 'NDI SDK License Agreement.pdf');
  const doku = join(sdk, 'Documentation', 'NDI SDK Documentation.pdf');
  const werte = {
    dateiversion,
    dll: sha256(dll),
    lizenz: existsSync(lizenz) ? sha256(lizenz) : null,
    lizenzDatum: existsSync(lizenz) ? datum(lizenz) : null,
    doku: existsSync(doku) ? sha256(doku) : 'fehlt',
    dokuDatum: existsSync(doku) ? datum(doku) : null,
  };
  console.log(windowsNdiZeile({ ...werte, lizenz: werte.lizenz ?? 'fehlt' }));
  const r = pruefeNdiLesestand({ kennzeichen: werte.dateiversion, lizenz: werte.lizenz, doku: werte.doku, datum: werte.lizenzDatum }, NDI_LESESTAND_WINDOWS);
  if (!r.weiter) throw new Error(`[bundle-ndi] ${r.meldung}`);
  console.log(`[bundle-ndi] ${r.meldung}`);
  // Frisch erst nach der Fassungsprüfung: Eine gescheiterte Prüfung lässt den Ordner, wie er war.
  frischerOrdner(destDir);
  for (const { name, src } of sources) {
    const dest = join(destDir, name);
    copyFileSync(src, dest);
    console.log(`bundled ${name} → ${dest}`);
  }
}

function hauptprogramm() {
  if (process.platform !== 'darwin' && process.platform !== 'win32') {
    console.log('[bundle-ndi] Nicht-Windows/Mac — übersprungen (Linux später).');
    return;
  }
  const sdk = process.env.NDI_SDK_DIR;
  if (!sdk) {
    throw new Error(`[bundle-ndi] NDI_SDK_DIR nicht gesetzt — kann ${process.platform === 'darwin' ? 'libndi.dylib' : 'die Runtime-DLL'} nicht finden.`);
  }
  if (process.platform === 'darwin') macZweig(sdk);
  else windowsZweig(sdk);
}

if (istHauptprogramm(process.argv[1])) hauptprogramm();

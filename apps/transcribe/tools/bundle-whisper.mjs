// Staged beim `prepackage` (vor electron-builder) die Laufzeit-Binaries:
//   1. ffmpeg/ffprobe (über @jm/media) → resources/bin/<plat>
//   2. whisper.cpp-CLI + nötige Libs (aus WHISPER_DIR) → resources/bin/<plat>
//   3. Basismodell ggml-base.bin (aus WHISPER_MODEL_BASE) → resources/models
// Alle gitignored, pro Build frisch. Windows (.exe/.dll) + macOS (Binary/.dylib).
import { bundleFfmpeg } from '@jm/media/bundle-ffmpeg.mjs';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// ffmpeg/ffprobe für die aktuelle Plattform.
bundleFfmpeg(appRoot);

// Liefert alle LC_RPATH-Einträge einer Mach-O-Datei außer @loader_path (macOS).
function otherRpaths(file) {
  const lines = execFileSync('otool', ['-l', file], { encoding: 'utf8' }).split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('LC_RPATH')) continue;
    const m = (lines[i + 2] || '').trim().match(/^path (.+?) \(offset/);
    if (m && m[1] !== '@loader_path') out.push(m[1]);
  }
  return out;
}

// Kopiert das Basismodell nach resources/models (Win + Mac identisch).
function bundleBaseModel() {
  const baseModel = process.env.WHISPER_MODEL_BASE;
  if (!baseModel || !existsSync(baseModel)) {
    throw new Error(
      '[bundle-whisper] WHISPER_MODEL_BASE nicht gefunden — Pfad zu ggml-base.bin erwartet.',
    );
  }
  const modelDest = join(appRoot, 'resources', 'models');
  mkdirSync(modelDest, { recursive: true });
  copyFileSync(baseModel, join(modelDest, 'ggml-base.bin'));
  console.log(`bundled ${basename(baseModel)} → ${join(modelDest, 'ggml-base.bin')}`);
}

// ── macOS (arm64) ─────────────────────────────────────────────────────────────
// WHISPER_DIR enthält die macOS-Binary (whisper-cli) + ihre *.dylib (libwhisper,
// libggml*). Beides nach resources/bin/mac kopieren und auf der Binary einen
// @loader_path-rpath setzen, damit die dylibs daneben ohne DYLD_* gefunden werden
// (macOS lädt Libs über @rpath/install_name, nicht über PATH wie Windows).
if (process.platform === 'darwin') {
  const whisperDir = process.env.WHISPER_DIR;
  if (!whisperDir) {
    throw new Error(
      '[bundle-whisper] WHISPER_DIR nicht gesetzt — Ordner mit whisper-cli + *.dylib erwartet ' +
        '(z. B. aus `cmake --build` von whisper.cpp; Binary + Libs zusammen in einem Ordner).',
    );
  }
  const binDest = join(appRoot, 'resources', 'bin', 'mac');
  mkdirSync(binDest, { recursive: true });
  // CLI-Kandidaten in Priorität wie locate.ts (whisper-cli > whisper > main).
  // whisper.cpp-Builds enthalten oft MEHRERE davon (z. B. whisper-cli + Stub
  // `main`) → wir reparieren JEDEN kopierten Kandidaten, nicht nur den ersten,
  // damit auch der Fallback lädt. *.dylib werden als echte Dateien kopiert
  // (Symlinks wie libwhisper.1.dylib löst copyFileSync auf), weil die Binary die
  // versionierten @rpath-Namen referenziert.
  const CLI_PRIORITY = ['whisper-cli', 'whisper', 'main'];
  let copied = 0;
  const copiedClis = [];
  const copiedDylibs = [];
  for (const name of readdirSync(whisperDir)) {
    const src = join(whisperDir, name);
    if (!statSync(src).isFile()) continue;
    const isCli = CLI_PRIORITY.includes(name);
    const isDylib = /\.dylib$/.test(name);
    if (!isCli && !isDylib) continue;
    copyFileSync(src, join(binDest, name));
    if (isCli) copiedClis.push(name);
    if (isDylib) copiedDylibs.push(name);
    copied++;
  }
  if (copiedClis.length === 0) {
    throw new Error(
      `[bundle-whisper] Keine whisper-Binary (whisper-cli/whisper/main) in WHISPER_DIR: ${whisperDir}`,
    );
  }
  // macOS findet @rpath-Libs über die rpaths der Binary; der cmake-Build setzt
  // einen ABSOLUTEN Build-Pfad → auf dem Zielrechner wertlos. @loader_path
  // ergänzen, damit die dylibs daneben gefunden werden. Idempotent: ein bereits
  // vorhandener rpath lässt install_name_tool fehlschlagen → schlucken.
  for (const name of copiedClis) {
    const cliPath = join(binDest, name);
    chmodSync(cliPath, 0o755);
    try {
      execFileSync('install_name_tool', ['-add_rpath', '@loader_path', cliPath], { stdio: 'pipe' });
    } catch (err) {
      if (!/would duplicate|already/.test(String(err.stderr || err.message || ''))) throw err;
    }
    // Alle ÜBRIGEN rpaths entfernen — der cmake-Build hinterlässt einen absoluten
    // Build-Pfad, der auf dem Zielrechner ins Leere zeigt (und den Build-Pfad ins
    // Artefakt leakt). Danach lädt die Binary die dylibs daneben rein via
    // @loader_path → self-contained.
    for (const rp of otherRpaths(cliPath)) {
      execFileSync('install_name_tool', ['-delete_rpath', rp, cliPath]);
    }
  }
  // Dieselbe Build-Pfad-Bereinigung an den dylibs (sie tragen den absoluten rpath
  // ebenfalls). Sie brauchen KEINEN @loader_path — als Teil der Ladekette werden
  // ihre @rpath-Geschwister über die rpaths der CLI gefunden. Nur den Leak weg.
  for (const name of copiedDylibs) {
    const libPath = join(binDest, name);
    for (const rp of otherRpaths(libPath)) {
      execFileSync('install_name_tool', ['-delete_rpath', rp, libPath]);
    }
  }
  const cliName = CLI_PRIORITY.find((n) => copiedClis.includes(n));
  console.log(`bundled ${copied} whisper-Dateien (CLI: ${copiedClis.join(', ')}; aktiv: ${cliName}) → ${binDest}`);
  bundleBaseModel();
  process.exit(0);
}

// ── Windows ───────────────────────────────────────────────────────────────────
if (process.platform !== 'win32') {
  console.log('[bundle-whisper] Nicht-Windows/Mac — whisper/Modell übersprungen.');
  process.exit(0);
}

const whisperDir = process.env.WHISPER_DIR;
if (!whisperDir) {
  throw new Error(
    '[bundle-whisper] WHISPER_DIR nicht gesetzt — Ordner mit whisper-cli.exe + DLLs erwartet ' +
      '(z. B. aus dem whisper.cpp-Windows-Release whisper-bin-x64).',
  );
}

// Den ganzen whisper-Ordner (Binary + DLLs) nach resources/bin/win kopieren.
const binDest = join(appRoot, 'resources', 'bin', 'win');
mkdirSync(binDest, { recursive: true });
let copied = 0;
for (const name of readdirSync(whisperDir)) {
  const src = join(whisperDir, name);
  if (!statSync(src).isFile()) continue;
  if (!/\.(exe|dll)$/i.test(name)) continue;
  copyFileSync(src, join(binDest, name));
  copied++;
}
if (copied === 0) {
  throw new Error(`[bundle-whisper] Keine .exe/.dll in WHISPER_DIR gefunden: ${whisperDir}`);
}
console.log(`bundled ${copied} whisper-Dateien → ${binDest}`);

bundleBaseModel();

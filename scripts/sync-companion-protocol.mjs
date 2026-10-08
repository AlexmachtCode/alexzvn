#!/usr/bin/env node
// Generiert die pure Protokoll-Schicht (Parser/Formatter) + die Capabilities-
// Tabelle aus @jm/suite-control-protocol in das standalone Companion-Modul
// packages/companion-jm-suite/generated/protocol.mjs.
//
// Warum: Das Companion-Modul liegt außerhalb der npm-workspaces und wird mit
// `companion-module-build` eigenständig gebaut — es darf keine @jm/*-Imports
// haben. Statt das Protokoll von Hand zu kopieren (driftet), bündeln wir die
// EINE Quelle (packages/suite-control-protocol/src/index.ts + capabilities.ts)
// per esbuild in eine dependency-freie ESM-Datei. Läuft als prebuild des Moduls.
//
//   node scripts/sync-companion-protocol.mjs
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'packages', 'suite-control-protocol', 'src');
const outFile = join(root, 'packages', 'companion-jm-suite', 'generated', 'protocol.mjs');

const indexPath = join(srcDir, 'index.ts').replace(/\\/g, '/');
const capPath = join(srcDir, 'capabilities.ts').replace(/\\/g, '/');

await build({
  stdin: {
    // Re-Export der puren Schicht + Capabilities. index.ts/capabilities.ts haben
    // bewusst keine node/electron-Imports → das Bundle ist self-contained.
    contents:
      `export * from ${JSON.stringify(indexPath)};\n` +
      `export { CAPABILITIES, KNOWN_ROLES } from ${JSON.stringify(capPath)};\n`,
    resolveDir: root,
    loader: 'ts',
    sourcefile: 'protocol-entry.ts',
  },
  // esbuild schreibt die Quellpfade als Kommentare relativ zum Arbeitsordner. Fest auf die Repo-Wurzel,
  // sonst ergäbe `npm run sync` im Modulordner „// ../suite-control-protocol/…“ statt
  // „// packages/suite-control-protocol/…“, und der CI-Schritt „Companion-Protokoll aktuell“ würde rot.
  absWorkingDir: root,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outfile: outFile,
  banner: {
    js:
      '// GENERIERT von scripts/sync-companion-protocol.mjs — NICHT BEARBEITEN.\n' +
      '// Quelle: packages/suite-control-protocol/src/{index,capabilities}.ts',
  },
});

console.log(`✓ generiert: ${outFile.replace(root + '\\', '').replace(/\\/g, '/')}`);

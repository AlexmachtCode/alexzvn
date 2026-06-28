#!/usr/bin/env node
// Lokaler Build des Companion-Moduls OHNE den yarn-Wrapper von
// `companion-module-build` — der findet Webpack im npm-Monorepo nicht (yarn löst
// auf den Workspace-Root auf, wo Webpack nicht installiert ist → „Command webpack
// not found"). Dieses Script ruft Webpack direkt mit der Tools-Config auf und
// repliziert danach die Pack-Schritte (companion/ kopieren, Manifest/Version
// überschreiben, minimale package.json, pkg/ als gzip-Tarball). Ergebnis ist
// dasselbe `pkg.tgz` wie beim offiziellen Build — importierbar in Companion über
// „Import custom module".
//
//   node build-local.mjs        (oder: npm run build:local)
import { promises as fs, createWriteStream } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as tar from 'tar';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const inMod = (...p) => path.join(moduleDir, ...p);

// 1) Alte Artefakte entfernen (wie `companion-module-build`: fs.remove('pkg')).
await fs.rm(inMod('pkg'), { recursive: true, force: true });
await fs.rm(inMod('pkg.tgz'), { force: true });

// 2) Webpack direkt aufrufen (node auf die webpack-cli, umgeht yarn). Gleiche
//    Argumente wie der offizielle Build: -c <tools>/webpack.config.cjs --env ROOT=…
const webpackCli = inMod('node_modules', 'webpack-cli', 'bin', 'cli.js');
const webpackConfig = inMod('node_modules', '@companion-module', 'tools', 'webpack.config.cjs');
const wp = spawnSync(process.execPath, [webpackCli, '--config', webpackConfig, '--env', `ROOT=${moduleDir}`], {
  stdio: 'inherit',
  cwd: moduleDir,
});
if (wp.status !== 0) {
  console.error('Webpack-Build fehlgeschlagen.');
  process.exit(wp.status ?? 1);
}

// 3) Metadaten + Manifest (exakt wie companion-module-build NACH Webpack).
async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}
await copyDir(inMod('companion'), inMod('pkg', 'companion'));

const srcPkg = JSON.parse(await fs.readFile(inMod('package.json'), 'utf8'));
const frameworkPkg = JSON.parse(await fs.readFile(inMod('node_modules', '@companion-module', 'base', 'package.json'), 'utf8'));
const manifest = JSON.parse(await fs.readFile(inMod('companion', 'manifest.json'), 'utf8'));
manifest.runtime.entrypoint = '../main.js';
manifest.version = srcPkg.version;
manifest.runtime.api = 'nodejs-ipc';
manifest.runtime.apiVersion = frameworkPkg.version;
await fs.writeFile(inMod('pkg', 'companion', 'manifest.json'), JSON.stringify(manifest));

// Minimale package.json (keine externals in diesem Modul → dependencies leer).
await fs.writeFile(
  inMod('pkg', 'package.json'),
  JSON.stringify({
    name: manifest.name,
    version: manifest.version,
    license: manifest.license,
    type: 'commonjs',
    dependencies: {},
  }),
);

// 4) pkg/ als gzip-Tarball packen → pkg.tgz.
await new Promise((resolve, reject) =>
  tar
    .create({ gzip: true, cwd: moduleDir }, ['pkg'])
    .pipe(createWriteStream(inMod('pkg.tgz')))
    .on('finish', resolve)
    .on('error', reject),
);

console.log(`\n✓ pkg.tgz erstellt (Framework-API ${frameworkPkg.version}, Modul ${manifest.version}).`);
console.log('  → In Companion über „Import custom module" importieren.');

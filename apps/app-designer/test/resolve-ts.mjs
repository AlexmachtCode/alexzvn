// Node-Resolver-Hook für Tests, die Renderer-Module (z. B. den Store) laden.
//
// Wie packages/appkit/test/resolve-ts.mjs: ergänzt die `.ts`-Endung bei
// relativen Importen ohne Endung (Bundler-Resolution). Zusätzlich löst er den
// Vite-Alias `@shared/*` auf src/shared/* auf — so, wie es electron-vite im
// Build tut, ohne den Produktionscode für den Test zu verbiegen.

import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sharedDir = resolvePath(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shared');

function withTsSuffix(base) {
  for (const suffix of ['.ts', '/index.ts']) {
    const candidate = base + suffix;
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@shared/')) {
    const hit = withTsSuffix(resolvePath(sharedDir, specifier.slice('@shared/'.length)));
    if (hit) return nextResolve(hit, context);
  }
  if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    const parentDir = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : process.cwd();
    const hit = withTsSuffix(resolvePath(parentDir, specifier));
    if (hit) return nextResolve(hit, context);
  }
  return nextResolve(specifier, context);
}

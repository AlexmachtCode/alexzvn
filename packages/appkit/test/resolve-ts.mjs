// Node-Resolver-Hook für den Selbsttest.
//
// Die Quellen nutzen Bundler-Resolution (`import './model'` ohne Endung), weil
// Vite/electron-vite sie so auflösen. Node-ESM verlangt dagegen eine Endung.
// Statt den Produktionscode für den Test zu verbiegen (das hieße
// `allowImportingTsExtensions` in jedem konsumierenden tsconfig), ergänzt dieser
// Hook die `.ts`-Endung beim Auflösen.

import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) {
    const parentDir = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : process.cwd();
    for (const suffix of ['.ts', '/index.ts']) {
      const candidate = resolvePath(parentDir, specifier + suffix);
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}

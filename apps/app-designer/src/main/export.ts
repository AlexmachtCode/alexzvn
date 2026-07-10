// Schreibt ein auslieferbares Bundle auf die Platte:
//
//   <ziel>/index.html    inline-Dokument + <script src="runtime.js">
//   <ziel>/runtime.js    die gebaute @jm/appkit-Laufzeit
//   <ziel>/assets/…      Bilder, Videos, Töne mit relativen Pfaden
//
// Läuft per Doppelklick von file:// (USB-Stick, Kundenübergabe) und von jedem
// Webserver. Die HTML entsteht mit derselben Funktion, die auch die Sandbox
// hinter jmapp://preview ausliefert — was in der Vorschau lief, läuft hier.

import { copyFileSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildIndexHtml, type AppProject } from '@jm/appkit';
import { sanitizeFileName } from '@shared/assets';
import type { AssetBlob } from '@shared/types';

export interface WriteBundleResult {
  bytes: number;
}

/**
 * Schreibt das Bundle nach `dir`. Ein vorhandener `assets/`-Ordner wird ersetzt,
 * damit gelöschte Assets nicht als Leichen zurückbleiben; alles andere im
 * Zielordner bleibt unangetastet (der Nutzer wählt oft einen eigenen Ordner).
 */
export function writeBundle(
  dir: string,
  doc: AppProject,
  assets: AssetBlob[],
  runtimePath: string,
): WriteBundleResult {
  mkdirSync(dir, { recursive: true });

  const indexHtml = buildIndexHtml({ doc });
  const indexPath = join(dir, 'index.html');
  writeFileSync(indexPath, indexHtml, 'utf8');

  const runtimeDest = join(dir, 'runtime.js');
  copyFileSync(runtimePath, runtimeDest);

  const assetDir = join(dir, 'assets');
  rmSync(assetDir, { recursive: true, force: true });

  let bytes = Buffer.byteLength(indexHtml, 'utf8') + statSync(runtimeDest).size;

  if (assets.length) {
    mkdirSync(assetDir, { recursive: true });
    for (const a of assets) {
      // Nie dem Dateinamen aus dem Dokument trauen — es kann aus einer fremden
      // .jmapp stammen und mit `../` aus dem Zielordner ausbrechen.
      writeFileSync(join(assetDir, sanitizeFileName(a.fileName)), a.bytes);
      bytes += a.bytes.byteLength;
    }
  }

  return { bytes };
}

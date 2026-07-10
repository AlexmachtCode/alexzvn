// ─────────────────────────────────────────────────────────────────────────────
// `.jmapp` — ZIP-Container aus Dokument + Assets.
//
//   project.json     das AppProject (ohne Asset-Bytes)
//   assets/<name>    die Rohdateien
//
// Exakt das Muster von apps/grafiktool/src/renderer/src/engine/io/project.ts
// (`.jmg`): fflate im Renderer, der Main schreibt nur die fertigen Bytes.
// ─────────────────────────────────────────────────────────────────────────────

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { migrateProject, serializeProject, type AppProject } from '@jm/appkit';
import { sanitizeFileName } from '@shared/assets';
import type { AssetBlob } from '@shared/types';

const DOC_ENTRY = 'project.json';
const ASSET_PREFIX = 'assets/';

export function packProject(doc: AppProject, assets: AssetBlob[]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    [DOC_ENTRY]: strToU8(serializeProject(doc)),
  };
  for (const a of assets) {
    files[ASSET_PREFIX + sanitizeFileName(a.fileName)] = a.bytes;
  }
  return zipSync(files, { level: 6 });
}

export interface UnpackedProject {
  doc: AppProject;
  assets: AssetBlob[];
}

export function unpackProject(bytes: Uint8Array): UnpackedProject {
  const files = unzipSync(bytes);
  const raw = files[DOC_ENTRY];
  if (!raw) throw new Error('Kein project.json im Archiv — keine gültige .jmapp-Datei.');
  const doc = migrateProject(JSON.parse(strFromU8(raw)));

  // Assets aus dem Dokument auflösen; Dateien ohne Eintrag werden verworfen
  // (und Einträge ohne Datei fallen beim Rendern auf den Platzhalter zurück).
  const assets: AssetBlob[] = [];
  for (const a of doc.assets) {
    const data = files[ASSET_PREFIX + a.fileName];
    if (!data) continue;
    assets.push({ id: a.id, fileName: a.fileName, mime: a.mime, bytes: data });
  }
  return { doc, assets };
}

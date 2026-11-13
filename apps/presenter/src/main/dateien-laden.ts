// #298/#299: der EINE Lade-Weg für Pfade (Drag & Drop, Doppelklick, PRESENTER OPEN).
// Kein Electron-Import, damit der Selbsttest unter reinem Node läuft.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { GeladeneDateien, ImportedFile } from '@shared/types';
import { dateiName, hinweiseAusOrdnung, ordneDateien } from '../shared/dateien';
import { importOfficeFile } from './office/import';

export const MAX_IMPORT_PFADE = 200;

/**
 * Prüft die vom Renderer gelieferten Pfade: Array aus Strings, höchstens 200
 * (sonst null); nicht absolute Einträge entfallen. UNC-/Netzpfade bleiben erlaubt.
 */
export function pruefeImportPfade(pfade: unknown): string[] | null {
  if (!Array.isArray(pfade) || pfade.length > MAX_IMPORT_PFADE) return null;
  if (!pfade.every((p) => typeof p === 'string')) return null;
  return (pfade as string[]).filter((p) => path.isAbsolute(p));
}

export async function ladeDateien(
  pfade: readonly string[],
  opts: { expandBuilds: boolean },
): Promise<GeladeneDateien> {
  const ordnung = ordneDateien(pfade);
  const hinweise = hinweiseAusOrdnung(ordnung);
  const files: ImportedFile[] = [];
  let projekt: GeladeneDateien['projekt'] = null;

  if (ordnung.projekt) {
    const name = dateiName(ordnung.projekt);
    try {
      projekt = { name, bytes: new Uint8Array(await readFile(ordnung.projekt)) };
    } catch (e) {
      hinweise.push(`„${name}“ konnte nicht geladen werden: ${(e as Error).message}`);
    }
  }

  // Der Reihe nach, nicht parallel: LibreOffice verträgt keine Parallelläufe.
  for (const { pfad, art } of ordnung.importieren) {
    const name = dateiName(pfad);
    try {
      if (art === 'office') {
        const res = await importOfficeFile(pfad, opts.expandBuilds);
        if (!res.ok || !res.bytes) {
          hinweise.push(`„${name}“: ${res.error ?? 'Umwandlung fehlgeschlagen.'}`);
          continue;
        }
        const base = path.basename(pfad, path.extname(pfad));
        files.push({
          name: res.name ?? `${base}.pdf`,
          kind: 'pdf',
          bytes: res.bytes,
          animations: res.animations,
          expanded: res.expanded,
        });
      } else {
        files.push({ name, kind: art, bytes: new Uint8Array(await readFile(pfad)) });
      }
    } catch (e) {
      hinweise.push(`„${name}“ konnte nicht geladen werden: ${(e as Error).message}`);
    }
  }

  return { files, projekt, hinweise };
}

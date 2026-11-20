import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { OfficeImportResult } from '@shared/types';
import { convertOfficeBytesToPdf, convertOfficeToPdf, countPdfPages } from './convert';
import { analyzePptxAnimations } from './pptx-animations';
import { expandPptxBuildSteps } from './pptx-expand';

/** Office-Datei zu PDF (LibreOffice), bei .pptx samt Aufbau-Animationen. */
export async function importOfficeFile(
  inputPath: string,
  expandBuilds: boolean,
): Promise<OfficeImportResult> {
  const base = path.basename(inputPath, path.extname(inputPath));

  // Flat conversion is the always-correct baseline.
  const baseline = await convertOfficeToPdf(inputPath);
  if (!baseline.ok || !/\.pptx$/i.test(inputPath)) return baseline;

  let animations;
  try {
    animations = analyzePptxAnimations(new Uint8Array(await readFile(inputPath))) ?? undefined;
  } catch {
    animations = undefined;
  }
  if (!animations || animations.animatedSlides === 0) return baseline;

  // EXPERIMENTAL: split on-click builds into per-step slides. Only adopt the
  // expanded conversion if it succeeds AND its page count matches exactly —
  // otherwise keep the flat baseline so import never silently breaks.
  if (expandBuilds) {
    try {
      const expanded = expandPptxBuildSteps(new Uint8Array(await readFile(inputPath)));
      if (expanded) {
        const conv = await convertOfficeBytesToPdf(expanded.bytes, base);
        if (conv.ok && conv.bytes && countPdfPages(conv.bytes) === expanded.pages) {
          return { ...conv, name: baseline.name, expanded: true };
        }
      }
    } catch {
      // fall through to baseline
    }
  }

  baseline.animations = animations;
  return baseline;
}

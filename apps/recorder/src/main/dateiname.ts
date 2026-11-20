import path from 'node:path';
import { folgeDatei } from './wav';

/**
 * Basisname, der nichts Vorhandenes trifft (#291): weder `Name.wav` noch die erste Folgedatei
 * `Name_002.wav` noch den Spuren-Ordner `Name-Spuren`. Sonst `Name-2`, `Name-3` … — die erste
 * freie Nummer. Der Recorder überschreibt damit nie eine Aufnahme.
 */
export function freierBasisname(dir: string, base: string, exists: (p: string) => boolean): string {
  const belegt = (b: string): boolean => {
    const wav = path.join(dir, `${b}.wav`);
    return exists(wav) || exists(folgeDatei(wav, 2)) || exists(path.join(dir, `${b}-Spuren`));
  };
  if (!belegt(base)) return base;
  for (let n = 2; ; n++) {
    const kandidat = `${base}-${n}`;
    if (!belegt(kandidat)) return kandidat;
  }
}

// whisper-cli-Argumente (Einzel-Äußerung → -otxt). Isoliert, damit ein
// whisper.cpp-Flag-Namenswechsel nur diese Datei trifft. Speed-Flags (#204):
//   -t Threads · -bs 1 -bo 1 Greedy statt Beam · -nf keine Temperatur-Rückfälle.
export interface CliArgsOpts {
  model: string;
  wav: string;
  outBase: string;
  language: string; // 'auto' | ISO-Code
  prompt: string; // '' = keiner
  threads: number; // >0 → -t
  fast: boolean; // Greedy-Decode
}

export function buildCliArgs(o: CliArgsOpts): string[] {
  const args = ['-m', o.model, '-f', o.wav, '-nt', '-otxt', '-of', o.outBase];
  if (o.language && o.language !== 'auto') args.push('-l', o.language);
  if (o.prompt) args.push('--prompt', o.prompt);
  if (o.threads > 0) args.push('-t', String(o.threads));
  if (o.fast) args.push('-bs', '1', '-bo', '1', '-nf');
  return args;
}

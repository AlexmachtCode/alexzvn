// Ausgabe-Qualitaet: Aufloesung und empfohlene Bitraten. Bewusst OHNE zustand und ohne
// Workspace-Pakete, damit der Selbsttest das Modul ohne Browser und ohne Bundler laden kann.
// `store/settings.ts` re-exportiert von hier, damit bestehende Importe unveraendert bleiben.

/** Programm-Ausgabeaufloesung. Bestimmt die Groesse, in der das Programm KOMPONIERT wird
 *  (engine-Canvas) — NDI, Aufnahme und RTMP folgen daraus. 720p kostet ~2,25x weniger
 *  Rechenlast pro Frame; 1080p ist echtes Full-HD (kein Hochskalieren). */
export type ProgramResolution = '720p' | '1080p';

export const RESOLUTIONS: Record<ProgramResolution, { w: number; h: number }> = {
  '720p': { w: 1280, h: 720 },
  '1080p': { w: 1920, h: 1080 },
};

/**
 * Empfohlene Videobitrate in kbit/s. Reine Zahlenlieferung — sie schreibt NICHTS in die
 * Einstellungen: die Bitrate ist ein vom Operator gesetzter Wert und wird beim Wechsel der
 * Aufloesung nicht ueberschrieben. Full-HD hat rund die 2,25-fache Pixelzahl, deshalb liegen
 * die 1080p-Werte deutlich hoeher; wer sie stehen laesst, bekommt Full-HD, das schlechter
 * aussieht als 720p.
 */
export function recommendedBitrate(
  resolution: ProgramResolution,
  kind: 'stream' | 'record',
): { min: number; max: number } {
  if (kind === 'record') {
    return resolution === '1080p' ? { min: 16000, max: 32000 } : { min: 8000, max: 16000 };
  }
  return resolution === '1080p' ? { min: 6000, max: 12000 } : { min: 3000, max: 6000 };
}

// Abgelehnter Fernbefehl (Altfehler CA-11, C2, D8): rein und ohne electron, damit der Main (handleSuiteCommand) und der Test dieselbe
// Regel nutzen. Auf dem Mac bleibt Caption ohne Fenster offen; ein Companion „transcribe on“ würde dann running=1 melden, ohne dass etwas
// aufnimmt (die Aufnahme lebt im Fenster). Darum wird nur ein Einschalten ohne Fenster abgelehnt; hold, ndi und clear wirken weiter.

/** Grund (steht in state.error, das Fenster zeigt ihn, sobald es wieder offen ist) und Logzeile; Entwurf für die Texttabelle (Task 10). */
export const CA11_TEXTE = {
  hinweis: (verb: string) => `Fernbefehl „${verb}“ abgelehnt: Das Fenster war geschlossen. Die Transkription läuft nicht.`,
  log: (verb: string) => `Fernbefehl abgelehnt: ${verb} (kein Fenster offen)`,
} as const;

/**
 * Lehnt `transcribe` ab, wenn es einschalten würde (ziel, nach resolveMode) und kein Fenster offen ist; sonst null (der Befehl gilt wie
 * bisher). Der Text nennt das Verb, wie Companion es schickt: TRANSCRIBE ON, ohne Argument TRANSCRIBE TOGGLE.
 */
export function transcribeAblehnung(arg: string | undefined, ziel: boolean, fensterOffen: boolean): { hinweis: string; log: string } | null {
  if (!ziel || fensterOffen) return null;
  const verb = `TRANSCRIBE ${String(arg ?? 'toggle').toUpperCase()}`;
  return { hinweis: CA11_TEXTE.hinweis(verb), log: CA11_TEXTE.log(verb) };
}

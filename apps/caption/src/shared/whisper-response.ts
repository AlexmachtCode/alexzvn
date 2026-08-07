// whisper-server /inference liefert bei response_format=json ein { text: "…" }.
// Schlägt das Parsen fehl (anderes Format / Fehlertext), den Rohtext trimmen.
export function parseInferenceText(body: string): string {
  const t = body.trim();
  if (!t) return '';
  try {
    const j = JSON.parse(t) as { text?: unknown };
    if (j && typeof j.text === 'string') return j.text.trim();
  } catch {
    /* kein JSON → Rohtext */
  }
  return t;
}

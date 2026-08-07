// Baut aus dem Fachwörter-Wörterbuch (eine Zeile = ein Begriff/Phrase) den
// Initial-Prompt für whisper.cpp. whisper.cpp kennt KEINE echten "hotwords" —
// der Initial-Prompt (--prompt) ist der einzige Bias-Hebel. Er zählt gegen das
// Text-Kontext-Budget (n_text_ctx/2 ≈ 224 Tokens), daher auf maxChars gekappt.
export function buildPrompt(dictionary: string, maxChars = 800): string {
  const terms = dictionary
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (terms.length === 0) return '';
  let out = terms.join(', ');
  if (out.length > maxChars) {
    // Am letzten vollständigen Begriff kappen (kein halber Term im Prompt).
    out = out.slice(0, maxChars).replace(/,[^,]*$/, '').trim();
  }
  return out;
}

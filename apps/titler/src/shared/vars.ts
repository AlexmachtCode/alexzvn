// --- JM Titler: DataLink-Variablen (#86) ---
//
// Textfelder (Name/Untertitel/Banner/Ticker) dürfen Platzhalter `{{schlüssel}}`
// enthalten. Die Werte kommen aus einer überwachten Datenquelle (Watchfolder,
// siehe main/datalink.ts) und werden erst beim Zeichnen aufgelöst — das Feld
// selbst behält die Vorlage, sodass der Operator sie weiter bearbeiten kann
// (vgl. NewTek/TriCaster DataLink).

import type { TitlerConfig } from './types';

/** Erlaubte Variablen-Schlüssel: Buchstaben, Ziffern, `_`, `.`, `-`. */
export const VAR_RE = /\{\{\s*([A-Za-z0-9_.\-]+)\s*\}\}/g;

/**
 * Ersetzt `{{schlüssel}}` durch den Wert aus `vars`. Unbekannte Schlüssel werden
 * zu leerem Text (damit nichts Rohes wie `{{x}}` On Air landet). Schlüsselsuche
 * ist case-insensitiv.
 */
export function resolveVars(text: string, vars: Record<string, string>): string {
  if (!text || text.indexOf('{{') < 0) return text;
  const lower: Record<string, string> = {};
  for (const k of Object.keys(vars)) lower[k.toLowerCase()] = vars[k];
  return text.replace(VAR_RE, (_m, key: string) => {
    const v = lower[key.toLowerCase()];
    return v === undefined ? '' : v;
  });
}

/** Liefert die im Text referenzierten Variablen-Schlüssel (für UI-Hinweise). */
export function usedVars(text: string): string[] {
  const out: string[] = [];
  if (!text) return out;
  for (const m of text.matchAll(VAR_RE)) {
    const k = m[1];
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

/** Enthält der Text mindestens einen Platzhalter? */
export function hasVars(text: string): boolean {
  // Eigene (nicht-globale) Regex — VAR_RE trägt `g` und wäre mit .test() stateful.
  return !!text && /\{\{\s*[A-Za-z0-9_.\-]+\s*\}\}/.test(text);
}

/**
 * Liefert eine Kopie der Config, in der die Textfelder (Name/Untertitel/Banner/
 * Ticker) aufgelöst sind. Wird zum Zeichnen (Vorschau + NDI) genutzt; die
 * gespeicherte Config behält die `{{}}`-Vorlagen.
 */
export function resolveConfigVars(c: TitlerConfig, vars: Record<string, string>): TitlerConfig {
  return {
    ...c,
    name: resolveVars(c.name, vars),
    subtitle: resolveVars(c.subtitle, vars),
    bannerText: resolveVars(c.bannerText, vars),
    tickerText: resolveVars(c.tickerText, vars),
  };
}

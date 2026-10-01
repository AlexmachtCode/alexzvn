import { randomInt } from 'node:crypto';

// Kopplungscode (Spec 3.2): 10 Zeichen aus 31 ohne Verwechsler (≈ 2^49,5).
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LAENGE = 10;
const ZEICHEN = new Set(CODE_ALPHABET);

/** `zufall(max)` liefert eine ganze Zahl in [0, max) — Vorgabe crypto.randomInt (ohne Modulo-Verzerrung). */
export function erzeugeCode(zufall: (max: number) => number = randomInt): string {
  let code = '';
  for (let i = 0; i < CODE_LAENGE; i++) code += CODE_ALPHABET[zufall(CODE_ALPHABET.length)];
  return code;
}

export function zeigeCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

export type CodePruefung =
  | { ok: true; code: string }
  | { ok: false; grund: 'zeichen'; zeichen: string }
  | { ok: false; grund: 'laenge'; laenge: number };

/** Verzeihende Eingabe: Groß/klein egal, Leerzeichen und Bindestriche fallen weg. */
export function normalisiereCode(eingabe: string): CodePruefung {
  let code = '';
  for (const zeichen of eingabe.replace(/[\s-]/g, '')) {
    const gross = zeichen.toUpperCase();
    // gross.length === 1: „ß“ → „SS“ oder „ﬆ“ → „ST“ dürfen nicht als zwei Codezeichen durchgehen.
    if (gross.length !== 1 || !ZEICHEN.has(gross)) return { ok: false, grund: 'zeichen', zeichen };
    code += gross;
  }
  if (code.length !== CODE_LAENGE) return { ok: false, grund: 'laenge', laenge: code.length };
  return { ok: true, code };
}

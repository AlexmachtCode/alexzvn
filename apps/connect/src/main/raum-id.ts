// Raum-ID (Anmeldung Teil 2, Task 12, N4): der Worker verlangt 6 bis 64 Zeichen aus [A-Za-z0-9_-] (ID_RE). Kürzere Namen
// („show“, „cop31“) werden mit sechs Hex-Zeichen eines SHA-256 des bereinigten Namens aufgefüllt: stabil, damit
// vorab verteilte Join-Links über Neustarts gültig bleiben, und für verschiedene Namen verschieden. Rein: nur node:crypto.
import { createHash } from 'node:crypto';

/** Bereinigt (nur [A-Za-z0-9_-], höchstens 64 Zeichen) und bei weniger als 6 Zeichen mit `-‹6 Hex›` aufgefüllt; leer bleibt leer. */
export function raumId(roh: string): string {
  const s = roh.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  if (s.length === 0 || s.length >= 6) return s;
  return `${s}-${createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 6)}`;
}

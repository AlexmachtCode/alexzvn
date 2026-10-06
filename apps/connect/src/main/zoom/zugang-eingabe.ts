// Prüfung der Nutzlast von „Zugangsdaten eintragen“ (IPC) — rein, ohne Electron, damit sie testbar ist.
// Hier wird nur die FORM geprüft; Trimmen und Leerzeichen-Prüfung (A7) gehören dem Kern.

/** Obergrenze je Wert; alles darüber ist keine Zugangsdaten-Eingabe. */
export const ZUGANG_EINGABE_MAX = 512;

export interface ZugangEingabe {
  clientId: string;
  clientSecret: string;
}

/** Zwei Strings `clientId` und `clientSecret`, je höchstens 512 Zeichen — sonst `null`. */
export function pruefeZugangEingabe(p: unknown): ZugangEingabe | null {
  if (typeof p !== 'object' || p === null) return null;
  const o = p as Record<string, unknown>;
  const { clientId, clientSecret } = o;
  if (typeof clientId !== 'string' || typeof clientSecret !== 'string') return null;
  if (clientId.length > ZUGANG_EINGABE_MAX || clientSecret.length > ZUGANG_EINGABE_MAX) return null;
  return { clientId, clientSecret };
}

// Prüfung der Nutzlast von „SDK-Schlüssel eintragen“ (IPC, Spec SDK nachladen 4.2) — rein, ohne Electron,
// damit sie testbar ist. Hier wird nur die FORM geprüft; Trimmen und Leerzeichen-Prüfung (S18) gehören dem Kern.

/** Obergrenze; alles darüber ist keine SDK-Schlüssel-Eingabe. */
export const SDK_SCHLUESSEL_MAX = 512;

export interface SdkSchluesselEingabe {
  schluessel: string;
}

/** `{ schluessel: string }` mit höchstens 512 Zeichen — sonst `null`. */
export function pruefeSdkSchluesselEingabe(p: unknown): SdkSchluesselEingabe | null {
  if (typeof p !== 'object' || p === null) return null;
  const { schluessel } = p as Record<string, unknown>;
  if (typeof schluessel !== 'string' || schluessel.length > SDK_SCHLUESSEL_MAX) return null;
  return { schluessel };
}

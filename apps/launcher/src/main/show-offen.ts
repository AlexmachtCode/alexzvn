// ─────────────────────────────────────────────────────────────────────────────
// Anmeldung im Launcher (Teil 1) · Nachrunde Z1: wann gilt eine iveo-Show als „offen“ (rein, ohne Electron)?
// Der Launcher hat kein Fenster „Show schließen“: Eine Show ist offen, solange eines ihrer Tools läuft. Sind alle Tools der Show
// beendet (und die Gnadenfrist nach dem Öffnen vorbei, in der die Tools noch starten und ihre erste Meldung schicken), ist sie
// geschlossen. Der Löschlauf lokaler iveo-Tokens (OFP1, IV5) wartet nur auf eine offene Show.
// ─────────────────────────────────────────────────────────────────────────────

/** So lange nach dem Öffnen zählt die Show auch ohne Meldung ihrer Tools als offen (Kaltstart der Tools, Presence-Takt). */
export const SHOW_GNADE_MS = 3 * 60_000;

export function showIstZu(a: {
  geoeffnetAm: number; jetzt: number; toolIds: readonly string[]; laufend: readonly string[]; gnadeMs?: number;
}): boolean {
  if (a.jetzt - a.geoeffnetAm < (a.gnadeMs ?? SHOW_GNADE_MS)) return false;
  return !a.toolIds.some((id) => a.laufend.includes(id));
}

// ── Ende des Moduls ──

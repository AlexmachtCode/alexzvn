// ─────────────────────────────────────────────────────────────────────────────
// Verpasstes RELOAD nachholen (Master-Link Teil 2a, A17 Fix-Runde 1).
//
// Startet ein Tool neu, verbindet sich der Launcher erst im nächsten
// Wiederverbindungsschritt (bis ~3 s). Ein RELOAD in dieser Lücke erreicht
// "0 <Tool>" und ginge verloren: das Tool bliebe bis zur nächsten iveo-Änderung
// auf altem Stand. Der Merker hält die letzte RELOAD-Zeile je Tool, die niemanden
// erreichte, und liefert sie bei der nächsten Verbindung genau einmal zurück.
// Rein (kein Electron, kein Netz) — getestet in test/reload-nachholen.test.ts.
// ─────────────────────────────────────────────────────────────────────────────
export interface ReloadMerker {
  /** Nach jedem Senden aufrufen: `erreicht` = Zahl der erreichten Endpunkte. */
  nachSenden(appId: string, zeile: string, erreicht: number): void;
  /** Bei einer neuen Verbindung zu `appId`: die nachzuholende Zeile (einmalig) oder null. */
  beiVerbindung(appId: string): string | null;
}

export function erzeugeReloadMerker(): ReloadMerker {
  const offen = new Map<string, string>();
  return {
    nachSenden(appId, zeile, erreicht) {
      if (!/ RELOAD$/.test(zeile)) return;
      if (erreicht > 0) offen.delete(appId);
      else offen.set(appId, zeile);
    },
    beiVerbindung(appId) {
      const zeile = offen.get(appId) ?? null;
      offen.delete(appId);
      return zeile;
    },
  };
}

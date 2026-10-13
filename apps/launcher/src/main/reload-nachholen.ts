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
  /**
   * Nach jedem Senden aufrufen: `erreicht` = Zahl der erreichten Endpunkte. `nurDieserRechner` (Teil 2b R2, Spec 15.3):
   * die Zeile galt nur Endpunkten dieses Rechners (Rolle Master) und wird auch nur bei einem solchen nachgeholt.
   */
  nachSenden(appId: string, zeile: string, erreicht: number, nurDieserRechner?: boolean): void;
  /**
   * Bei einer neuen Verbindung zu `appId`: die nachzuholende Zeile (einmalig) oder null. `aufDiesemRechner`: Liegt der
   * Endpunkt auf diesem Rechner? Eine Zeile mit `nurDieserRechner` geht nur dann hinaus und bleibt sonst gemerkt.
   */
  beiVerbindung(appId: string, aufDiesemRechner?: boolean): string | null;
}

export function erzeugeReloadMerker(): ReloadMerker {
  const offen = new Map<string, { zeile: string; nurDieserRechner: boolean }>();
  return {
    nachSenden(appId, zeile, erreicht, nurDieserRechner = false) {
      if (!/ RELOAD$/.test(zeile)) return;
      if (erreicht > 0) offen.delete(appId);
      else offen.set(appId, { zeile, nurDieserRechner });
    },
    beiVerbindung(appId, aufDiesemRechner = false) {
      const e = offen.get(appId);
      if (!e || (e.nurDieserRechner && !aufDiesemRechner)) return null;
      offen.delete(appId);
      return e.zeile;
    },
  };
}

/**
 * Teil 2b R2, Spec 15.3: Ziele einer Steuerzeile — die verbundenen Endpunkte der appId; mit `istHier` nur die auf diesem
 * Rechner (Rolle Master), mit `null` jeder Rechner wie bisher.
 */
export function waehleReloadZiele<T extends { appId: string; host: string; verbunden: boolean }>(
  eintraege: readonly T[],
  appId: string,
  istHier: ((host: string) => boolean) | null,
): T[] {
  return eintraege.filter((e) => e.verbunden && e.appId === appId && (istHier === null || istHier(e.host)));
}

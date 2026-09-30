// Tools einer Show starten und auswerten, was fehlt. OHNE Electron-Import,
// damit test/selftest.ts das Verhalten ohne Fenster pruefen kann; getTool und
// openTool kommen von aussen (show.ts reicht die echten herein).

export interface StartErgebnis {
  launched: number;
  /**
   * Fehlende Tools IMMER als appId - das Start-Overlay (ShowLaunchOverlay.tsx)
   * vergleicht appIds. BERICHTIGT 30.09.2026: ein installiertes, aber nicht
   * startbares Tool stand hier mit seinem ANZEIGENAMEN, fand im Overlay keinen
   * Treffer und blieb 30 s auf "startet…" statt auf "nicht verfuegbar".
   */
  missing: string[];
  /** Dieselben Tools als Anzeigenamen - fuer Menschen (Logzeile). */
  missingNames: string[];
}

export async function startShowTools<T extends { name: string }>(
  refs: ReadonlyArray<{ appId: string }>,
  getTool: (appId: string) => T | undefined,
  openTool: (tool: T) => Promise<{ ok: boolean }>,
): Promise<StartErgebnis> {
  let launched = 0;
  const missing: string[] = [];
  const missingNames: string[] = [];
  for (const ref of refs) {
    const tool = getTool(ref.appId);
    if (!tool) {
      missing.push(ref.appId);
      missingNames.push(ref.appId);   // kein Manifest-Eintrag - die appId ist der einzige Name
      continue;
    }
    const res = await openTool(tool);
    if (res.ok) launched += 1;
    else {
      missing.push(ref.appId);
      missingNames.push(tool.name);
    }
  }
  return { launched, missing, missingNames };
}

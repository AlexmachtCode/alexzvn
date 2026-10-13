// ─────────────────────────────────────────────────────────────────────────────
// Verbund der Tool-Seite: IPC zur Anzeige (Master-Link Teil 2b, Release 2, Spec 16.5).
//
// Der Renderer fragt die Zeile mit `ipcRenderer.invoke('jmps:verbund-anzeige')` ab und bekommt
// jeden Wechsel als `jmps:verbund-anzeige`. Die Netzarbeit bleibt im Main, die CSP bleibt unberührt.
// Geprüft über den Typecheck aller Workspaces und den Durchgang (G15), nicht im Selbsttest.
// ─────────────────────────────────────────────────────────────────────────────
import { BrowserWindow, ipcMain } from 'electron';
import { verbundAnzeige } from './verbund-anzeige';
import type { VerbundDaten } from './verbund-typen';

export const VERBUND_ANZEIGE_KANAL = 'jmps:verbund-anzeige';

export function registriereVerbundIpc(quelle: {
  daten(): VerbundDaten;
  on(e: 'wechsel', f: (d: VerbundDaten) => void): unknown;
}): void {
  try {
    ipcMain.handle(VERBUND_ANZEIGE_KANAL, () => verbundAnzeige(quelle.daten()));
  } catch {
    /* schon registriert (zweiter Aufruf) — der erste Handler bleibt */
  }
  quelle.on('wechsel', (d) => {
    const anzeige = verbundAnzeige(d);
    for (const w of BrowserWindow.getAllWindows()) {
      try {
        if (!w.isDestroyed()) w.webContents.send(VERBUND_ANZEIGE_KANAL, anzeige);
      } catch {
        /* Fenster schließt gerade */
      }
    }
  });
}

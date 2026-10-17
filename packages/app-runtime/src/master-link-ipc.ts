// ─────────────────────────────────────────────────────────────────────────────
// Master-Link-Brücke, Electron-Teil (Suite-UX-Update Welle 0, Spec 3.9, UO3).
//
// Abfrage `ipcRenderer.invoke('jmps:master-link')` und Ereignis `jmps:master-link` an alle Fenster, nach dem
// Muster von verbund-ipc.ts (Master-Link 2b R2). Nur lesend: derselbe Client wie Presence und Verbund, keine
// Logik; die CSP bleibt unberührt (IPC, kein Netz im Renderer). Geprüft über die Quelltext-Wächter in
// test/verbund.test.ts, die Typprüfung aller Workspaces und den Bau des Titlers, nicht im Selbsttest.
// ─────────────────────────────────────────────────────────────────────────────
import { BrowserWindow, ipcMain } from 'electron';
import type { MasterLinkClient } from '@jm/master-link';
import { MASTER_LINK_KANAL, masterLinkMeldung, type MasterLinkMeldung } from './master-link-meldung';

/**
 * Abfrage registrieren (index.ts: erste Anweisung in `los`, vor der Lock-Prüfung). `lies` läuft bei jedem
 * Aufruf neu und antwortet ohne Client mit `ohne-client`. Wirft nie; ein zweiter Aufruf lässt den ersten
 * Handler stehen.
 */
export function registriereMasterLinkAbfrage(lies: () => MasterLinkMeldung): void {
  try {
    ipcMain.handle(MASTER_LINK_KANAL, () => lies());
  } catch {
    /* schon registriert (zweiter Aufruf) — der erste Handler bleibt */
  }
}

/** Eine Meldung an alle Fenster, je Fenster mit isDestroyed und try/catch (Muster verbund-ipc.ts). Wirft nie. */
function sendeAnAlle(m: MasterLinkMeldung): void {
  try {
    for (const w of BrowserWindow.getAllWindows()) {
      try {
        if (!w.isDestroyed()) w.webContents.send(MASTER_LINK_KANAL, m);
      } catch {
        /* dieses Fenster schließt gerade; die anderen bekommen die Meldung trotzdem */
      }
    }
  } catch {
    /* keine Fensterliste (Electron beendet gerade) */
  }
}

/**
 * Hängt die Brücke an den Client (index.ts: direkt nach verbundAnClient) und sendet sofort einmal den
 * aktuellen Stand: Am Einzelplatz meldet der Client nie ein `zustand`-Ereignis (Startwert aus, Gleiches wird
 * verschluckt). Der Zuhörer wirft nie: Ein werfender Zuhörer bräche die späteren Zuhörer desselben emit ab.
 */
export function sendeMasterLinkWechsel(client: MasterLinkClient): void {
  client.on('zustand', () => sendeAnAlle(masterLinkMeldung(client)));
  sendeAnAlle(masterLinkMeldung(client));
}

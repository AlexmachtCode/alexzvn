// ─────────────────────────────────────────────────────────────────────────────
// Master-Link-Brücke, reiner Teil (Suite-UX-Update Welle 0, Spec 3.9, UO3). Ohne Electron und nur mit
// `import type`, damit test/verbund.test.ts (tsx) und auch `node --experimental-strip-types` die Datei laden.
//
// Die Meldung ist der Zustand des vorhandenen Clients UNVERÄNDERT (aus | sucht | verbindet | verbunden |
// fehler) oder `ohne-client`: In diesem Prozess läuft kein Client (Zweitinstanz ohne Single-Instance-Lock,
// Wurf beim Bau des Clients), oder zustand() warf. Bewusst nicht `aus`: das hieße „Rolle aus“.
// getMasterLinkStatus() in index.ts bleibt, wie es ist (ohne Client `aus`; die Presence hängt daran, U6).
// ─────────────────────────────────────────────────────────────────────────────
import type { ClientZustand } from '@jm/master-link';

/** IPC-Kanal der Brücke: Abfrage (invoke) und Ereignis an alle Fenster auf demselben Namen. */
export const MASTER_LINK_KANAL = 'jmps:master-link';

export type MasterLinkMeldung = ClientZustand | { art: 'ohne-client' };

/** null oder Wurf von zustand() → { art: 'ohne-client' }; sonst client.zustand() unverändert (gleiches Objekt). */
export function masterLinkMeldung(client: { zustand(): ClientZustand } | null): MasterLinkMeldung {
  if (!client) return { art: 'ohne-client' };
  try {
    return client.zustand();
  } catch {
    return { art: 'ohne-client' };
  }
}

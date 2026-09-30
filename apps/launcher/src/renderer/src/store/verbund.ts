import { create } from 'zustand';
import type { KoppelAntwort, VerbundStand } from '@shared/types';
import { ablehnungText } from '@/lib/verbund-texte';

// Zustand des Modals „Verbund“ (Master-Link Teil 1). Alles Netz läuft im Main; hier nur IPC.
interface VerbundStore {
  offen: boolean;
  stand: VerbundStand | null;
  beschaeftigt: boolean;
  meldung: string | null;
  /** Abgelehnter Aufruf (Schreibfehler, gesperrte Datei): kurzer Text mit Code, oben im Modal. */
  fehler: string | null;
  oeffne: () => void;
  schliesse: () => void;
  lade: () => Promise<void>;
  fuehreAus: (aktion: () => Promise<VerbundStand | void>) => Promise<void>;
  koppele: (adresse: string, code: string) => Promise<KoppelAntwort>;
}

export const useVerbund = create<VerbundStore>((set) => ({
  offen: false,
  stand: null,
  beschaeftigt: false,
  meldung: null,
  fehler: null,
  oeffne: () => {
    set({ offen: true, meldung: null, fehler: null });
    void useVerbund.getState().lade();
    void window.jmps.starteMasterSuche();
  },
  schliesse: () => {
    // Spec 3.2/3.3: Dialog zu → Kopplungsfenster am Master zu, laufendes Koppeln am Slave abbrechen.
    if (useVerbund.getState().stand?.master?.kopplung.offen) void window.jmps.schliesseKopplung();
    void window.jmps.brecheKoppelnAb();
    void window.jmps.stoppeMasterSuche();
    set({ offen: false, meldung: null, fehler: null });
  },
  lade: async () => {
    try {
      set({ stand: await window.jmps.getVerbund() });
    } catch {
      // Main nicht erreichbar → bestehenden Stand behalten
    }
  },
  fuehreAus: async (aktion) => {
    set({ beschaeftigt: true, fehler: null });
    try {
      const s = await aktion();
      if (s) set({ stand: s });
    } catch (e) {
      // Der Main kann ablehnen (Schreibfehler, gesperrte Datei): sichtbar machen, nie still verschlucken.
      // Der Stand bleibt, wie er ist — der Main meldet bei Bedarf selbst `verbund-changed`.
      set({ fehler: ablehnungText(e) });
    } finally {
      set({ beschaeftigt: false });
    }
  },
  koppele: async (adresse, code) => {
    set({ beschaeftigt: true, meldung: null });
    try {
      let r: KoppelAntwort;
      try {
        r = await window.jmps.koppeleMitMaster(adresse, code);
      } catch (e) {
        // Der Main liefert `{ ok: false, text }`; nur ein Ausfall der Leitung selbst landet hier.
        r = { ok: false, text: ablehnungText(e) };
      }
      if (!r.ok) set({ meldung: r.text });
      await useVerbund.getState().lade();
      return r;
    } finally {
      set({ beschaeftigt: false });
    }
  },
}));

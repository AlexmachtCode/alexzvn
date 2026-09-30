import { create } from 'zustand';
import type { KoppelAntwort, VerbundStand } from '@shared/types';
import { beimSchliessen } from '@/lib/verbund-schliessen';
import { ablehnungText } from '@/lib/verbund-texte';

// Zustand des Modals „Verbund“ (Master-Link Teil 1). Alles Netz läuft im Main; hier nur IPC.
interface VerbundStore {
  offen: boolean;
  stand: VerbundStand | null;
  beschaeftigt: boolean;
  meldung: string | null;
  /** Abgelehnter Aufruf (Schreibfehler, gesperrte Datei): kurzer Text mit Code, oben im Modal. */
  fehler: string | null;
  /** Grund der letzten Koppel-Ablehnung des Masters ('rechner-id' → „Neue Kennung“ anbieten, Endprüfung C1). */
  letzteAblehnung: string | null;
  /** C1: geklonter Rechner — neue Kennung erzeugen (Kopplung weg, danach neu koppeln). */
  neueKennung: () => Promise<boolean>;
  oeffne: () => void;
  schliesse: () => void;
  lade: () => Promise<void>;
  /** Liefert `true`, wenn der Aufruf durchging, `false` bei einer Ablehnung (Fehlertext steht dann in `fehler`). */
  fuehreAus: (aktion: () => Promise<VerbundStand | void>) => Promise<boolean>;
  koppele: (adresse: string, code: string) => Promise<KoppelAntwort>;
  /** Fire-and-forget-Aufruf an den Main: eine Ablehnung landet in `fehler`, nie als unbehandelte Ablehnung. */
  anstossen: (aufruf: () => Promise<unknown>) => void;
}

export const useVerbund = create<VerbundStore>((set) => ({
  offen: false,
  stand: null,
  beschaeftigt: false,
  meldung: null,
  fehler: null,
  letzteAblehnung: null,
  neueKennung: async (): Promise<boolean> => {
    const ok: boolean = await useVerbund.getState().fuehreAus(() => window.jmps.neueRechnerKennung());
    if (ok) set({ letzteAblehnung: null, meldung: null });
    return ok;
  },
  oeffne: () => {
    set({ offen: true, meldung: null, fehler: null, letzteAblehnung: null });
    void useVerbund.getState().lade();
    // Die Suche ist ein Wunsch des Mains (Kern): sie gilt auch für eine Rolle, die erst noch angelegt wird.
    useVerbund.getState().anstossen(() => window.jmps.starteMasterSuche());
  },
  schliesse: () => {
    // Spec 3.2/3.3: Dialog zu → Kopplungsfenster zu, Koppeln abbrechen, Suche aus — immer, unabhängig vom gespeicherten
    // Stand; Ablehnungen sähe im geschlossenen Modal niemand, daher console.warn (Endprüfung C7).
    beimSchliessen(window.jmps, (e) => console.warn(`[verbund] ${ablehnungText(e, 'anstossen')}`));
    set({ offen: false, meldung: null, fehler: null, letzteAblehnung: null });
  },
  anstossen: (aufruf) => {
    // async-Funktion: der Aufruf startet sofort, auch ein synchroner Wurf (fehlende Brücke) landet im catch.
    void (async () => {
      try {
        await aufruf();
      } catch (e) {
        set({ fehler: ablehnungText(e, 'anstossen') });
      }
    })();
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
      return true;
    } catch (e) {
      // Der Main kann ablehnen (Schreibfehler, gesperrte Datei): sichtbar machen, nie still verschlucken.
      // Der Stand bleibt, wie er ist — der Main meldet bei Bedarf selbst `verbund-changed`.
      set({ fehler: ablehnungText(e) });
      return false;
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
        // Der Main liefert `{ ok: false, text }`; nur ein Ausfall der Leitung selbst landet hier — als Koppelfehler.
        r = { ok: false, text: ablehnungText(e, 'koppeln') };
      }
      set(r.ok ? { letzteAblehnung: null } : { meldung: r.text, letzteAblehnung: r.grund ?? null });
      await useVerbund.getState().lade();
      return r;
    } finally {
      set({ beschaeftigt: false });
    }
  },
}));

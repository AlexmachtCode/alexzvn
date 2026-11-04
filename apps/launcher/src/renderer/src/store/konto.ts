import { create } from 'zustand';
import type { AnmeldeSchritt, KontoAnsicht, KontoFehlerCode } from '@shared/konto';
import { sitzungGueltig } from '@/lib/konto-anzeige';
import { useTools } from './tools';

// Anmeldung im Launcher (Plan P24–P27): Store des Kontos, dünn über IPC (10.7). Was angezeigt wird, entscheiden die reinen
// Bibliotheken (lib/konto-anzeige.ts, lib/konto-dialog.ts, lib/admin-ansicht.ts); der Store hält nur Stand und Dialoge.
// Keine Antwort des Mains enthält eine Sitzung, eine Freigabe oder ein Token (10.7) — hier liegt nie ein Geheimnis.

interface KontoStore {
  /** Ansicht aus dem Main; null bis zur ersten Antwort (G7: eine Voreinstellung zählt nie als angemeldet). */
  ansicht: KontoAnsicht | null;
  /** Letzter Schritt des Anmelde-Ablaufs (AppEvent anmeldung-changed); den Code zeigt nur der Anmelde-Dialog. */
  anmeldeSchritt: AnmeldeSchritt;
  /** Konto-Dialog offen (P25). */
  kontoOffen: boolean;
  /** Anmelde-Dialog offen (P25). */
  anmeldungOffen: boolean;
  /** Admin-Maske offen (P26) — nicht zu verwechseln mit ansicht.adminOffen (Zahl offener Zoom-Anfragen). */
  adminOffen: boolean;
  /** Einmal je Fenster: Ereignisse abonnieren, Lage bei Fensterfokus, erste Ansicht holen. */
  lade: () => Promise<void>;
  ladeAnsicht: () => Promise<void>;
  /** Klick auf den Kreis bzw. „Anmelden“ (P25 startet hier den Ablauf). */
  anmelden: () => void;
  oeffneKonto: () => void;
  schliesseKonto: () => void;
  /** P25: Anmelde-Ablauf im Main abbrechen (AA5) und den Dialog schließen. */
  anmeldenAbbrechen: () => Promise<void>;
  /** P25: Anmelde-Dialog schließen, ohne den Ablauf anzufassen (nach einem Endzustand). */
  schliesseAnmeldung: () => void;
  /** P25: Adresse der Anmeldeseite in die Zwischenablage (Spec 4.1); true = kopiert. */
  adresseKopieren: () => Promise<boolean>;
  /** P25: abmelden (EP26); die Rückfrage K27 stellt der Dialog vorher. */
  abmelden: () => Promise<void>;
  /** P25: Zoom anfragen (Spec 8); bei Erfolg kommt die Ansicht mit dem Stand der Anfrage. */
  zoomAnfragen: (a: { zweck: string; von: number; bis: number }) => Promise<{ ok: true } | { ok: false; code: KontoFehlerCode }>;
  // ── weitere Felder (P25–P27) ──
}

/** React StrictMode ruft load() im Dev zweimal: die Abos entstehen nur einmal je Fenster. */
let abonniert = false;

export const useKonto = create<KontoStore>((set, get) => ({
  ansicht: null,
  anmeldeSchritt: { art: 'ruhe' },
  kontoOffen: false,
  anmeldungOffen: false,
  adminOffen: false,

  lade: async () => {
    if (!abonniert) {
      abonniert = true;
      window.jmps.onAppEvent((e) => {
        if (e.type === 'konto-changed') void get().ladeAnsicht();
        else if (e.type === 'anmeldung-changed') set({ anmeldeSchritt: e.schritt });
      });
      // EP15: Lage bei Fensterfokus; der Main fragt höchstens einmal je Minute beim Worker.
      window.addEventListener('focus', () => {
        void window.jmps.kontoLage().then((ansicht) => set({ ansicht })).catch(() => {});
      });
    }
    await get().ladeAnsicht();
  },

  ladeAnsicht: async () => {
    try {
      const vorher = get().ansicht;
      const ansicht = await window.jmps.kontoAnsicht();
      set({ ansicht });
      // Wechsel zwischen „mit“ und „ohne gültige Sitzung“: Quelle in den Einstellungen und Update-Hinweise neu holen
      // (sonst zeigte der Werkzeugkasten F5 bzw. keine Updates nach dem Stand vor der Anmeldung).
      if (sitzungGueltig(vorher) !== sitzungGueltig(ansicht)) {
        void window.jmps.getSettings().then((settings) => useTools.setState({ settings })).catch(() => {});
        void useTools.getState().checkUpdates();
        void useTools.getState().loadLauncherUpdate();
      }
    } catch {
      // Main nicht erreichbar → bisherige Ansicht behalten
    }
  },

  // P25 (Spec 4.1): Dialog öffnen und den Ablauf im Main starten; der Fortschritt kommt als anmeldung-changed.
  anmelden: () => {
    set({ anmeldungOffen: true, kontoOffen: false, anmeldeSchritt: { art: 'startet' } });
    void window.jmps.kontoAnmelden().then((anmeldeSchritt) => set({ anmeldeSchritt })).catch(() => set({ anmeldeSchritt: { art: 'fehler', code: 'server' } }));
  },
  oeffneKonto: () => set({ kontoOffen: true }),
  schliesseKonto: () => set({ kontoOffen: false }),
  anmeldenAbbrechen: async () => {
    try {
      set({ anmeldeSchritt: await window.jmps.kontoAnmeldenAbbrechen() });
    } catch {
      // Main nicht erreichbar: der Dialog geht trotzdem zu.
    }
    set({ anmeldungOffen: false });
  },
  schliesseAnmeldung: () => set({ anmeldungOffen: false }),
  adresseKopieren: async () => {
    try {
      return await window.jmps.kontoAdresseKopieren();
    } catch {
      return false;
    }
  },
  abmelden: async () => {
    try {
      await window.jmps.kontoAbmelden();
    } catch {
      // Main nicht erreichbar → die nächste konto-changed bringt den Stand
    }
    await get().ladeAnsicht();
  },
  zoomAnfragen: async (a) => {
    try {
      const r = await window.jmps.kontoZoomAnfragen(a);
      if (!r.ok) return { ok: false, code: r.code };
      set({ ansicht: r.ansicht });
      return { ok: true };
    } catch {
      return { ok: false, code: 'netz' };
    }
  },
  // ── weitere Aktionen (P25–P27) ──
}));

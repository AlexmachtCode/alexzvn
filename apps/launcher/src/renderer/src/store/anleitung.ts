import { create } from 'zustand';
import {
  anleitungSchritt,
  beimStart,
  leererFortschritt,
  leseFortschritt,
  schreibeFortschritt,
  type AnleitungSpeicher,
  type AnleitungsEreignis,
  type AnleitungsFortschritt,
  type SpeicherZustand,
  type Zustand,
} from '@jm/ui/anleitung';
import { ANLEITUNG_SCHLUESSEL, EINRICHTUNG, STIMME_SCHLUESSEL } from '@/anleitung/einrichtung';
import { anleitungsEingang, erzeugeAnleitungsTreiber, type AnleitungsEingang } from '@/lib/anleitung-zustand';
import { useTools } from './tools';
import { useVerbund } from './verbund';

// Geführte Anleitung „Einrichtung“ im Launcher (Spec 3–8, Plan P12): Store der Anleitung. Was er entscheidet (Start,
// Ereignisse, Merken, Abgleich, Produktion), steht im reinen Treiber erzeugeAnleitungsTreiber (lib/anleitung-zustand.ts), den
// der Launcher-Selbsttest mit dem echten Ablaufkern und Attrappen prüft. Der Store reicht ihm Ablaufkern, Speicher, Uhr, Wecker
// und seinen Zustand und verdrahtet Abos und die Lese-IPC getControlStatus. Er bedient nichts (G3: keine handelnde Aktion,
// kein Dialog).
//
// Zyklischer Import: tools.ts ruft starte() und meldet showGespeichert, dieser Store liest useTools. Darum greift er auf
// Modulebene nie auf useTools/useVerbund zu; die Abos entstehen erst in starte(), das load() aufruft.

export interface AnleitungStore {
  fortschritt: AnleitungsFortschritt;
  /** Speicher für die Diagnosezeile (G7, G8): wie gelesen; 'nichtSchreibbar' nach einem Schreibfehler. */
  speicher: SpeicherZustand | 'nichtSchreibbar';
  /** Modus der Steuerebene aus der Lese-IPC (EP19); null = noch nicht gelesen, zählt nie als erledigt (G7). */
  steuerebene: 'open' | 'secure' | null;
  /** Letzter Zustand nach ZUSTANDS_NAMEN und die Produktion (EP17); neu gesetzt nur bei einer Änderung. */
  jetzt: Zustand;
  produktion: boolean;
  /** Kurz nach dem Start: Tools sind installiert, die Presence sagt aber noch nicht, ob eins läuft (EP24). */
  produktionUnklar: boolean;
  /** Stimme je Rechner (Spec 6), gemerkt unter STIMME_SCHLUESSEL ('aus' oder 'an'). */
  stimmeAn: boolean;
  /** „Stimme trotzdem an“ während der Produktion (Spec 7, G15): nie gemerkt, endet mit der Produktion. */
  stimmeTrotzdem: boolean;
  /** Hinweis „Neu: geführte Einrichtung“ am Knopf (OF2, EP8): nur diese Sitzung; auch bei unlesbarem Speicher (EP23). */
  hinweis: boolean;
  /** „Was ist neu?“ wartet, bis die Anleitung pausiert, endet oder beendet wird (EP9; das Abo steht in store/tools.ts). */
  patchNotesNachAnleitung: boolean;
  starte: (u: { bestehenderRechner: boolean }) => 'anleitung' | 'hinweis' | null;
  ereignis: (e: AnleitungsEreignis) => void;
  toolEreignis: (name: string) => void;
  zustand: () => Zustand;
  eingang: () => AnleitungsEingang;
  ladeSteuerebene: () => Promise<void>;
  stimmeUmschalten: () => void;
  stimmeTrotzdemAn: () => void;
}

/** localStorage des Launchers; gesperrt (der Zugriff wirft) → null, dann gilt der Fortschritt als nicht lesbar (G8). */
export function launcherSpeicher(): AnleitungSpeicher | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Stimme an, außer dieser Rechner hat sie abgeschaltet; nicht lesbar → an (der Text steht ohnehin da). */
function leseStimmeAn(): boolean {
  try {
    return launcherSpeicher()?.getItem(STIMME_SCHLUESSEL) !== 'aus';
  } catch {
    return true;
  }
}

/** Abos einmal je Fenster. */
let abonniert = false;

export const useAnleitung = create<AnleitungStore>((set, get) => {
  // Die Entscheidungen trifft der Treiber (rein, im Selbsttest geprüft); der Store reicht ihm, was er braucht.
  const treiber = erzeugeAnleitungsTreiber({
    kern: { leseFortschritt, beimStart, anleitungSchritt, schreibeFortschritt },
    anleitung: EINRICHTUNG,
    schluessel: ANLEITUNG_SCHLUESSEL,
    speicher: launcherSpeicher,
    eingang: () => get().eingang(),
    uhr: () => Date.now(),
    wecker: (ms, f) => void setTimeout(f, ms),
    lies: () => get(),
    setze: (teil) => set(teil),
  });

  /** Abos; EP19: Fokus und das Schließen von System-Zustand oder Einstellungen lesen die Steuerebene neu. */
  function abonniere(): void {
    if (abonniert) return;
    abonniert = true;
    useTools.subscribe((s, vorher) => {
      if ((vorher.systemOpen && !s.systemOpen) || (vorher.settingsOpen && !s.settingsOpen)) void get().ladeSteuerebene();
      treiber.pruefe();
    });
    useVerbund.subscribe(() => treiber.pruefe());
    window.addEventListener('focus', () => void get().ladeSteuerebene());
  }

  return {
    fortschritt: leererFortschritt(EINRICHTUNG.id),
    speicher: 'leer',
    steuerebene: null,
    jetzt: {},
    produktion: false,
    produktionUnklar: false,
    stimmeAn: leseStimmeAn(),
    stimmeTrotzdem: false,
    hinweis: false,
    patchNotesNachAnleitung: false,

    starte: (u) => {
      // Der Treiber wirkt je Fenster einmal (React StrictMode ruft load() im Dev zweimal, D15); Abos und Steuerebene danach.
      const start = treiber.starte(u);
      abonniere();
      void get().ladeSteuerebene();
      return start;
    },
    ereignis: (e) => treiber.ereignis(e),
    toolEreignis: (name) => treiber.ereignis({ art: 'toolEreignis', name }),
    zustand: () => treiber.zustand(),
    // Den Eingang baut nur anleitungsEingang (rein, im Launcher-Selbsttest als Kreuz geprüft; G9).
    eingang: () => anleitungsEingang(useTools.getState(), useVerbund.getState(), get().steuerebene),
    ladeSteuerebene: async () => {
      try {
        const status = await window.jmps.getControlStatus();
        set({ steuerebene: status.mode === 'secure' ? 'secure' : 'open' });
      } catch {
        // Main nicht erreichbar → der bisherige Stand bleibt (null zählt nie als erledigt, G7)
      }
      treiber.pruefe();
    },
    stimmeUmschalten: () => {
      const an = !get().stimmeAn;
      set({ stimmeAn: an });
      try {
        launcherSpeicher()?.setItem(STIMME_SCHLUESSEL, an ? 'an' : 'aus');
      } catch {
        // nicht merkbar → gilt nur für diese Sitzung; die Diagnosezeile der Übersicht sagt es (G7)
        if (get().speicher !== 'nichtLesbar' && get().speicher !== 'neuer') set({ speicher: 'nichtSchreibbar' });
      }
    },
    stimmeTrotzdemAn: () => treiber.stimmeTrotzdemAn(),
  };
});

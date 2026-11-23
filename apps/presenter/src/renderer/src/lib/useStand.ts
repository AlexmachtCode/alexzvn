// Ein Stand für Editor und Referent (UX Welle 2b, Presenter d1 und d2; B8, B11, Muster d): alle Abos und Abfragen der Oberfläche
// an einer Stelle – Präsentation, Bildschirme, NDI, Handy samt Netzwerkkarten, Gast-Klicker, Timer (Verbindung und Live-Zustand),
// Master-Link, Fernsteuerung und im Referenten dessen Vollbild. Beide Wurzel-Views rufen useStand; Panel, Werkzeugleiste, Leiste
// und Live-Bereich lesen nur den Stand, den sie bekommen. Dazu die Aktionen des Panels (standAktionen) und des Referenten
// (referentAktionen), die window.jmpr erst im Rückruf rufen.
// window wird nur in preload() gelesen, hinter typeof window: Render-Tests laufen ohne window, und alle Abos stehen in Effekten.
import { useEffect, useRef, useState } from 'react';
import { useBrueckenWert, type BrueckenQuelle } from '@jm/ui';
import { chatText, type GastKlickerStatus } from '@shared/gast-klicker';
import type { DisplayInfo, JmprApi, NdiStatus, NetInterface, PresentationState, RemoteStatus, TimerSource, TimerSyncConfig } from '@shared/types';
import type { EinstellungenAktionen } from '@/views/Einstellungen';
import { FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE } from './bruecken';
import { PRESENTER_TEXTE, type OberflaechenStand, type ReferentAktionen } from './oberflaeche';

/** Die Preload-Brücke, wenn es sie gibt; ohne window (Node, Test) oder ohne Preload undefined. */
function preload(): Partial<JmprApi> | undefined {
  return typeof window === 'undefined' ? undefined : window.jmpr;
}

const KEIN_ABO = (): void => undefined;

/** Präsentationszustand (`present:state`): Abfrage beim Einhängen, danach jedes Ereignis. */
export const PRAESENTATION_QUELLE: BrueckenQuelle<PresentationState> = {
  abfrage: () => preload()?.present?.getState?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.present?.onState?.(cb) ?? KEIN_ABO,
};

/** NDI-Ausgang (`ndi:status`); ein Ereignis gilt vor einer älteren Antwort (wie useNdiStatus). */
export const NDI_QUELLE: BrueckenQuelle<NdiStatus> = {
  abfrage: () => preload()?.ndi?.status?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.ndi?.onStatus?.(cb) ?? KEIN_ABO,
};

/** Handy-Server (`remote:status`): Start, Stopp und Fehler meldet der Main an alle Fenster, auch nach jedem Anwenden. */
export const HANDY_QUELLE: BrueckenQuelle<RemoteStatus> = {
  abfrage: () => preload()?.remote?.status?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.remote?.onStatus?.(cb) ?? KEIN_ABO,
};

/** Gast-Klicker (`gastKlicker:status`). */
export const GAST_KLICKER_QUELLE: BrueckenQuelle<GastKlickerStatus> = {
  abfrage: () => preload()?.gastKlicker?.status?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.gastKlicker?.onStatus?.(cb) ?? KEIN_ABO,
};

/** Vollbild des Referentenfensters (#309): Abfrage beim Einhängen, danach jeder Wechsel (Knopf, F11, System). */
export const VOLLBILD_QUELLE: BrueckenQuelle<boolean> = {
  abfrage: () => preload()?.present?.referentVollbild?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.present?.onReferentVollbild?.(cb) ?? KEIN_ABO,
};

/** Timer (`timer:state`): `connected` für Statusleiste und Panel, der ganze Zustand für die Timer-Leiste des Referenten. */
export const TIMER_ZUSTAND_QUELLE: BrueckenQuelle<TimerSource> = {
  abfrage: () => preload()?.timer?.getState?.() ?? Promise.resolve(null),
  ereignis: (cb) => preload()?.timer?.onState?.(cb) ?? KEIN_ABO,
};

// Die Timer-Einstellung meldet der Main nicht (nur `timer:getConfig`); wie bisher gilt die neue Einstellung sofort, darum meldet
// timerEinstellen sie hier selbst an alle Hörer dieses Fensters.
const timerHoerer = new Set<(c: TimerSyncConfig) => void>();

/** Timer-Einstellung: Abfrage `timer:getConfig`, Ereignis = jede Änderung über timerEinstellen in diesem Fenster. */
export const TIMER_EINSTELLUNG_QUELLE: BrueckenQuelle<TimerSyncConfig> = {
  abfrage: () => preload()?.timer?.getConfig?.() ?? Promise.resolve(null),
  ereignis: (cb) => {
    timerHoerer.add(cb);
    return () => void timerHoerer.delete(cb);
  },
};

/** Timer-Einstellung setzen: sofort an den Stand melden (wie bisher setTimerCfg), dann anwenden und merken (`timer:apply`). */
export function timerEinstellen(cfg: TimerSyncConfig): void {
  for (const h of [...timerHoerer]) h(cfg);
  void preload()?.timer?.apply?.(cfg);
}

/** Was der Bildschirm-Leser von der Uhr braucht (setTimeout/clearTimeout passen). */
export interface ZeitGeber {
  setTimeout(f: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const ECHTE_ZEIT: ZeitGeber = {
  setTimeout: (f, ms) => setTimeout(f, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

/**
 * Ruhezeit des Bildschirm-Ereignisses: `present:bildschirme` kommt beim Ziehen des Publikumsfensters mit jedem `move` (ungedrosselt,
 * Task 8). Höchstens alle 150 ms wird darum neu gelesen, und nach dem letzten Ereignis immer noch einmal.
 */
export const BILDSCHIRM_RUHE_MS = 150;

/**
 * Leser der Bildschirmliste (B11): `lies()` liest sofort (Start, jede Änderung der Präsentation, Öffnen des Panels), `ereignis()`
 * fasst das Bildschirm-Ereignis zusammen (eine Abfrage nach BILDSCHIRM_RUHE_MS, egal wie viele Ereignisse dazwischen kommen).
 * Es läuft höchstens eine Abfrage; was währenddessen verlangt wird, liest danach genau einmal. So kommen die Antworten in
 * Reihenfolge an, und eine ältere überschreibt nie eine neuere (Muster folgeBildschirmen, Prompter aktionen.ts). Ein Fehler setzt
 * „unbekannt“ (undefined), nie die alte Liste. Nach `ab()` setzt nichts mehr etwas. Ohne Abfrage (kein Preload) nichts.
 */
export function bildschirmLeser(
  frage: (() => Promise<DisplayInfo[]>) | undefined,
  setze: (liste: DisplayInfo[] | undefined) => void,
  zeit: ZeitGeber = ECHTE_ZEIT,
): { lies(): void; ereignis(): void; ab(): void } {
  let weg = false;
  let laeuft = false;
  let nochmal = false;
  let geplant: { id: unknown } | null = null;
  const lies = (): void => {
    if (weg || frage === undefined) return;
    if (laeuft) {
      nochmal = true;
      return;
    }
    laeuft = true;
    const fertig = (): void => {
      laeuft = false;
      if (nochmal && !weg) {
        nochmal = false;
        lies();
      }
    };
    let antwort: Promise<DisplayInfo[]>;
    try {
      antwort = Promise.resolve(frage());
    } catch (e) {
      antwort = Promise.reject(e);
    }
    antwort.then(
      (liste) => {
        if (!weg) setze(liste);
        fertig();
      },
      () => {
        if (!weg) setze(undefined);
        fertig();
      },
    );
  };
  const ereignis = (): void => {
    if (weg || frage === undefined || geplant !== null) return;
    const g: { id: unknown } = { id: undefined };
    geplant = g;
    g.id = zeit.setTimeout(() => {
      if (geplant === g) geplant = null;
      lies();
    }, BILDSCHIRM_RUHE_MS);
  };
  const ab = (): void => {
    weg = true;
    if (geplant !== null) zeit.clearTimeout(geplant.id);
    geplant = null;
  };
  return { lies, ereignis, ab };
}

/** Einmal lesen (Netzwerkkarten): ein Fehler ergibt undefined; nach dem Aufräumen wird eine späte Antwort verworfen. */
function liesEinmal<T>(frage: (() => Promise<T>) | undefined, setze: (wert: T | undefined) => void): () => void {
  if (frage === undefined) return KEIN_ABO;
  let weg = false;
  void Promise.resolve()
    .then(frage)
    .then(
      (wert) => {
        if (!weg) setze(wert);
      },
      () => {
        if (!weg) setze(undefined);
      },
    );
  return () => {
    weg = true;
  };
}

/**
 * Der Stand eines Bedienfensters (Editor oder Referent). Alle Abos laufen hier, auch bei geschlossenem Panel; die Wurzel-View
 * ruft den Hook genau einmal und bleibt über Panel-Wechsel stabil. undefined = noch keine Antwort (unbekannt), auch ohne Preload.
 * Bildschirmliste nach B11: beim Start, bei jeder Änderung des Präsentationszustands, beim Öffnen des Panels und bei
 * `present:bildschirme` (zusammengefasst, bildschirmLeser). Netzwerkkarten beim Öffnen des Panels (wie bisher beim Öffnen des
 * Handy-Fensters). Das Vollbild des Referentenfensters liest nur der Referent.
 */
export function useStand(fenster: 'editor' | 'referent', panelOffen: boolean): OberflaechenStand {
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);
  const fernsteuerung = useBrueckenWert(FERNSTEUERUNG_QUELLE);
  const praesentation = useBrueckenWert(PRAESENTATION_QUELLE) ?? undefined;
  const ndi = useBrueckenWert(NDI_QUELLE) ?? undefined;
  const handy = useBrueckenWert(HANDY_QUELLE) ?? undefined;
  const gastKlicker = useBrueckenWert(GAST_KLICKER_QUELLE) ?? undefined;
  const timerZustand = useBrueckenWert(TIMER_ZUSTAND_QUELLE) ?? undefined;
  const timerEinstellung = useBrueckenWert(TIMER_EINSTELLUNG_QUELLE) ?? undefined;
  // Das Fenster wechselt nie während der Lebenszeit der Wurzel-View: die Quelle bleibt stabil (der Editor fragt nie).
  const referentVollbild = useBrueckenWert(fenster === 'referent' ? VOLLBILD_QUELLE : undefined) ?? undefined;

  const [bildschirme, setBildschirme] = useState<DisplayInfo[] | undefined>(undefined);
  const leserRef = useRef<ReturnType<typeof bildschirmLeser> | null>(null);
  // Zuerst der Leser samt Bildschirm-Ereignis (Effekte laufen in dieser Reihenfolge), dann die sofortigen Lesungen.
  useEffect(() => {
    const leser = bildschirmLeser(preload()?.present?.displays, setBildschirme);
    leserRef.current = leser;
    const abmelden = preload()?.present?.onBildschirme?.(() => leser.ereignis()) ?? KEIN_ABO;
    return () => {
      abmelden();
      leser.ab();
      if (leserRef.current === leser) leserRef.current = null;
    };
  }, []);
  // Beim Start (erster Lauf) und bei jeder Änderung des Präsentationszustands (Start, Folie, Ende: das Publikumsfenster kommt oder geht).
  useEffect(() => {
    leserRef.current?.lies();
  }, [praesentation]);
  useEffect(() => {
    if (panelOffen) leserRef.current?.lies();
  }, [panelOffen]);

  const [netzwerkkarten, setNetzwerkkarten] = useState<NetInterface[] | undefined>(undefined);
  useEffect(() => {
    if (!panelOffen) return undefined;
    return liesEinmal(preload()?.remote?.interfaces, setNetzwerkkarten);
  }, [panelOffen]);

  return {
    praesentation,
    bildschirme,
    ndi,
    handy,
    gastKlicker,
    timer: timerEinstellung !== undefined && timerZustand !== undefined ? { config: timerEinstellung, verbunden: timerZustand.connected } : undefined,
    masterLink,
    fernsteuerung,
    netzwerkkarten,
    timerZustand,
    referentVollbild,
    fenster,
    plattform: preload()?.platform ?? '',
  };
}

/**
 * Aktionen des Referenten (Leiste, Haupttasten, Übersicht, Kopf-Aktion): window.jmpr erst im Rückruf, je der bisherige Befehl;
 * ohne Preload passiert nichts. Die Ergebnisse kommen über die Abos zurück (Präsentationszustand, Vollbild, Bildschirmliste).
 */
export function referentAktionen(): ReferentAktionen {
  return {
    zurueck: () => void preload()?.present?.prev?.(),
    weiter: () => void preload()?.present?.next?.(),
    geheZu: (index) => void preload()?.present?.goto?.(index),
    schwarz: () => void preload()?.present?.setScreen?.('black'),
    weiss: () => void preload()?.present?.setScreen?.('white'),
    schleife: (an) => void preload()?.present?.setSchleife?.(an),
    publikumVollbild: () => void preload()?.present?.toggleAudienceFullscreen?.(),
    vollbild: () => void preload()?.present?.toggleReferentVollbild?.(),
    verschieben: (id) => void preload()?.present?.assignAudience?.(id),
    beenden: () => void preload()?.present?.stop?.(),
  };
}

/** Port des JM Timers, wenn der eingegebene außerhalb von 1 bis 65535 liegt (wie bisher Toolbar.tsx:274). */
const TIMER_VORGABE_PORT = 7777;
/** Host des JM Timers, wenn der eingegebene leer ist (wie bisher Toolbar.tsx:260). */
const TIMER_VORGABE_HOST = '127.0.0.1';

/**
 * Aktionen des Panels für Editor und Referent: window.jmpr erst im Rückruf, mit den Regeln der alten Bedienelemente. Die Ergebnisse
 * kommen über die Abos zurück (der Main meldet NDI, Handy und Gast-Klicker an alle Fenster); die Timer-Einstellung meldet
 * timerEinstellen selbst. Ohne bekannte Timer-Einstellung bewirken die Timer-Aktionen nichts (wie bisher `if (!timerCfg) return`).
 * Die Startwahl (`startwahl`) ergänzt nur der Editor.
 */
export function standAktionen(stand: Pick<OberflaechenStand, 'timer'>): EinstellungenAktionen {
  const timer = stand.timer?.config;
  return {
    ndiSchalten: (an) => {
      void preload()?.ndi?.setzeAn?.(an).then(undefined, (err: unknown) => {
        console.error('[ndi] Schalter nicht gesetzt:', err);
      });
    },
    timerSchalten: (an) => {
      if (timer) timerEinstellen({ ...timer, enabled: an });
    },
    timerSetzen: (host, port) => {
      if (timer) timerEinstellen({ ...timer, host: host.trim() || TIMER_VORGABE_HOST, port: port >= 1 && port <= 65535 ? port : TIMER_VORGABE_PORT });
    },
    handyAnwenden: async (config) => preload()?.remote?.apply?.(config),
    gastKlicker: {
      setzeAn: async (an) => preload()?.gastKlicker?.setzeAn?.(an),
      pause: async (an) => preload()?.gastKlicker?.pause?.(an),
      neuerLink: async () => {
        if (window.confirm(PRESENTER_TEXTE.gastKlicker.neuerLinkFrage)) await preload()?.gastKlicker?.neuerLink?.();
      },
      kopieren: async (link) => {
        try {
          await navigator.clipboard.writeText(chatText(link));
          return true;
        } catch {
          return false;
        }
      },
    },
  };
}

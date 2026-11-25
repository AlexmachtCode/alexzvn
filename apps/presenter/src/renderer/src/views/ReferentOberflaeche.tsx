// Referent im festen Dunkel (UX Welle 2b, Presenter d2; B4, B7, B8, B11, B12, Muster d): AppShell mit thema „dunkel“ (liest
// jm-theme nie), echter Titelleiste (mac={false}) und bei breitem Fenster der Kopf-Aktion „■ Beenden“ ganz rechts nach ⚙; bei
// schmalem Fenster steht „■ Beenden“ stattdessen als letzte Taste in der Leiste (Owner P2 B, ändert B7; REFERENT_BREIT_AB, gemessen in
// Task N1); darunter die Leiste (ReferentLeiste), im Inhalt der Live-Bereich (PresenterView) mit der Übersicht, unten die Statusleiste
// und rechts das gemeinsame Panel (Einstellungen, ohne Ausgabe und Import). Die Wurzel-View (ReferentOberflaeche) hält den einen Stand
// (useStand), die Folien (useFolien), die Bildschirmwahl, den Zustand der Übersicht und des Panels und die Lage von „■ Beenden“; sie
// bleibt über Panel-Wechsel stabil, und die Kürzel (usePresenterKeys, F11, Schutz vor Strg+W) laufen hier, auch bei geschlossenem
// Panel. Der Rahmen (ReferentRahmen) zeichnet nur, was er bekommt.
import { useEffect, useState } from 'react';
import { AppShell } from '@jm/ui';
import type { Slide } from '@shared/types';
import { KEIN_AUFRUF, mitLaufendenAufrufen, type LaufendeAufrufe } from '@/lib/aufrufe';
import {
  beendenInDerLeiste,
  fensterSchliessenAbfangen,
  kopfOnAir,
  PRESENTER_TEXTE,
  referentPanelTasten,
  referentWahl,
  statusLeiste,
  verschiebenGrund,
  type OberflaechenStand,
  type ReferentAktionen,
} from '@/lib/oberflaeche';
import { useFolien, usePresenterKeys } from '@/lib/usePresentation';
import { referentAktionen, standAktionen, useStand } from '@/lib/useStand';
import { Einstellungen, type EinstellungenAktionen } from './Einstellungen';
import { PresenterView } from './PresenterView';
import { ReferentLeiste } from './ReferentLeiste';

export interface ReferentRahmenProps {
  stand: OberflaechenStand;
  /** Folien des Payloads (useFolien); null, bis sie geladen sind. */
  folien: Slide[] | null;
  /** Wirksame Bildschirmwahl (referentWahl). */
  wahl: number | null;
  uebersicht: boolean;
  /** Panel-Aktionen (standAktionen); NDI und Gast-Klick der Leiste nutzen sie mit. */
  aktionen: EinstellungenAktionen;
  referent: ReferentAktionen;
  panelOffen: boolean;
  panelAbschnitt?: string;
  onPanel(offen: boolean, abschnitt?: string): void;
  onWahl(id: number): void;
  onVerschieben(): void;
  onUebersicht(offen: boolean): void;
  /**
   * Schmales Fenster (beendenInDerLeiste der Innenbreite, Owner P2 B): „■ Beenden“ als letzte Taste der Leiste, der Kopf behält ⚙.
   * Ohne Angabe breit: „■ Beenden“ ganz rechts im Kopf (B7).
   */
  schmal?: boolean;
}

/** Der Rahmen des Referenten: ein Stand für Kopf, Leiste, Live-Bereich, Statusleiste und Panel (eine Wahrheit). */
export function ReferentRahmen(p: ReferentRahmenProps): React.JSX.Element {
  const { stand, folien, wahl, uebersicht, aktionen, referent } = p;
  // Genau ein „■ Beenden“: breit im Kopf (B7), schmal in der Leiste (Owner P2 B); derselbe Knopf, derselbe Befehl.
  const beenden = <KopfBeenden onBeenden={referent.beenden} />;
  return (
    <AppShell
      tool="Presenter"
      thema="dunkel"
      mac={false}
      onAir={kopfOnAir(stand)}
      status={statusLeiste(stand)}
      kopfAktion={p.schmal ? undefined : beenden}
      toolbar={
        <ReferentLeiste
          stand={stand}
          folien={folien}
          wahl={wahl}
          uebersicht={uebersicht}
          referent={referent}
          onNdi={aktionen.ndiSchalten}
          onGastPause={(an) => void aktionen.gastKlicker.pause(an)}
          onWahl={p.onWahl}
          onVerschieben={p.onVerschieben}
          onUebersicht={p.onUebersicht}
          beenden={p.schmal ? beenden : undefined}
        />
      }
      settings={<Einstellungen stand={stand} aktionen={aktionen} />}
      settingsOpen={p.panelOffen}
      settingsSection={p.panelAbschnitt}
      onSettingsChange={p.onPanel}
      // Klicker auch bei Fokus auf einer Auswahl oder dem Gast-Link im Panel (B10, Gesamtprüfung I2); Textfelder behalten ihre Tasten.
      panelToolTasten={referentPanelTasten}
    >
      <PresenterView stand={stand} folien={folien} referent={referent} uebersicht={uebersicht} onUebersicht={p.onUebersicht} />
    </AppShell>
  );
}

/**
 * „■ Beenden“: bei breitem Fenster Kopf-Aktion ganz rechts im Kopf (B7), bei schmalem die letzte Taste der Leiste (Owner P2 B), je auf
 * dem alten Platz; beendet die Präsentation wie Esc (title).
 */
export function KopfBeenden({ onBeenden }: { onBeenden(): void }) {
  return (
    <button
      type="button"
      data-presenter="beenden"
      onClick={onBeenden}
      title={PRESENTER_TEXTE.taste.kopfBeendenKuerzel}
      className="h-8 px-3 shrink-0 whitespace-nowrap rounded-md text-xs font-semibold border border-[var(--destructive)] text-[var(--foreground)] hover:bg-[var(--destructive)]/15 transition-colors"
    >
      {PRESENTER_TEXTE.taste.kopfBeenden}
    </button>
  );
}

/**
 * Bildschirmwahl und „Auf diesen Bildschirm“ (B11): Die Wahl merkt nur (setze), verschoben wird erst mit dem Knopf und nur, wenn
 * verschiebenGrund nichts einwendet (anderer, bekannter Bildschirm bei gemessen offenem Publikum).
 */
export function bildschirmBedienung(
  stand: Pick<OberflaechenStand, 'praesentation' | 'bildschirme'>,
  wahl: number | null,
  setze: (id: number) => void,
  verschiebe: (id: number) => void,
): { onWahl(id: number): void; onVerschieben(): void } {
  return {
    onWahl: (id) => setze(id),
    onVerschieben: () => {
      if (wahl !== null && verschiebenGrund(stand, wahl) === undefined) verschiebe(wahl);
    },
  };
}

export function ReferentOberflaeche({
  anfangOffen = false,
}: {
  /** Panel beim Start offen (nur für Tests; im Betrieb zu, nichts gemerkt). */
  anfangOffen?: boolean;
}): React.JSX.Element {
  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt; offen über ⚙ oder einen Statuseintrag.
  const [panelOffen, setPanelOffen] = useState(anfangOffen);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);

  // Der eine Stand: alle Abos und Abfragen (B8), auch bei geschlossenem Panel; dazu die Folien des Payloads.
  const stand = useStand('referent', panelOffen);
  const folien = useFolien();

  // Tastatur und USB-Klicker wie bisher (N2b 1.7, Filter B10); dieselben Kürzel hat das Publikumsfenster.
  usePresenterKeys(true);

  // F11 nur hier (usePresenterKeys gilt auch fürs Publikum). preventDefault hält das Standardmenü von Electron ab,
  // das F11 sonst ein zweites Mal umschalten würde (gemessen, Electron 33.4.11).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'F11') return;
      e.preventDefault();
      void window.jmpr.present.toggleReferentVollbild();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Strg+W bzw. Cmd+W schließt das Referentenfenster nie, auch nicht aus einem Feld des Panels (das Tasten aus Feldern anhält):
  // Erfassungsphase, vor dem Panel; nur preventDefault (Controller-Entscheid zu Task 9, gemessen in Task 11).
  useEffect(() => {
    window.addEventListener('keydown', fensterSchliessenAbfangen, true);
    return () => window.removeEventListener('keydown', fensterSchliessenAbfangen, true);
  }, []);

  // Bildschirmwahl (B11), gemerkt nur hier, nie gespeichert; ohne eigene Wahl gilt der gemessene Bildschirm des Publikums.
  const [gewaehlt, setGewaehlt] = useState<number | undefined>(undefined);
  const wahl = referentWahl(gewaehlt, stand.bildschirme);
  const [uebersicht, setUebersicht] = useState(false);

  const referent = referentAktionen();
  const bedienung = bildschirmBedienung(stand, wahl, setGewaehlt, referent.verschieben);
  // Laufende Aufrufe des Panels (Handy, Gast-Klicker) hier in der Wurzel, nicht im Panel (Rückspiel Task 26): das Panel stirbt
  // beim Schließen, „beschäftigt“ überlebt es hier.
  const [laufend, setLaufend] = useState<LaufendeAufrufe>(KEIN_AUFRUF);

  // Lage von „■ Beenden“ (Owner P2 B, W134): schmal in der Leiste, breit im Kopf. Gemessen wird nur die Innenbreite des Fensters,
  // beim Start und bei jeder Größenänderung (auch Vollbild); kein Abo, kein IPC. Gleiche Lage rendert nicht neu (React vergleicht).
  const [schmal, setSchmal] = useState(() => beendenInDerLeiste(window.innerWidth));
  useEffect(() => {
    const messen = (): void => setSchmal(beendenInDerLeiste(window.innerWidth));
    window.addEventListener('resize', messen);
    return () => window.removeEventListener('resize', messen);
  }, []);

  return (
    <ReferentRahmen
      stand={stand}
      folien={folien}
      wahl={wahl}
      uebersicht={uebersicht}
      aktionen={mitLaufendenAufrufen(standAktionen(stand), laufend, setLaufend)}
      referent={referent}
      panelOffen={panelOffen}
      panelAbschnitt={panelAbschnitt}
      onPanel={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
      onWahl={bedienung.onWahl}
      onVerschieben={bedienung.onVerschieben}
      onUebersicht={setUebersicht}
      schmal={schmal}
    />
  );
}

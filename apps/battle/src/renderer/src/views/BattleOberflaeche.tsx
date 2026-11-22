// Oberfläche von Battle (UX Welle 1, Aufgabe d; Spec 3.1, 3.8, 5.1; E8, E16, E17): AppShell mit Kopf (JM Battle, „Runde n/m“ in der
// Mitte, On-Air, Hell/Dunkel, ⚙), der Statusleiste aus lib/oberflaeche.ts und dem Einstellungs-Panel; im Inhalt der Live-Bereich.
// Die Brücken (Master-Link, Fernsteuerung) und der Panelzustand laufen hier, auch bei geschlossenem Panel; das Panel selbst hat keine
// Effekte (G7, G8). Laden und Abonnement des Stands liegen darüber in App.tsx (immer gemountet). Es gibt keine Kopf-Knöpfe „Verbindungen“,
// „Einstellungen“ und „VS“ und kein Modal mehr: alles steht im Panel bzw. unter den Haupttasten.
import { useState } from 'react';
import { AppShell, useBrueckenWert } from '@jm/ui';
import { FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE } from '@/lib/bruecken';
import { BATTLE_TEXTE, onAirKopf, statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import type { BattleState } from '@shared/types';
import { Einstellungen, type EinstellungenAktionen } from './Einstellungen';
import { LiveBereich, type LiveAktionen } from './LiveBereich';

/** Alles, was die Oberfläche auslöst: die Handler des Stores, als Rückrufe ohne Rückgabe. */
export interface BattleViewAktionen extends LiveAktionen, EinstellungenAktionen {}

export function BattleOberflaeche({
  state,
  aktionen,
  anfangOffen = false,
}: {
  state: BattleState;
  aktionen: BattleViewAktionen;
  /** Panel beim Start offen (nur für Tests; im Betrieb zu, nichts gemerkt). */
  anfangOffen?: boolean;
}): React.JSX.Element {
  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt; offen über ⚙ oder einen Statuseintrag.
  const [panelOffen, setPanelOffen] = useState(anfangOffen);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);

  // Lesende Brücken (Spec 3.9): undefined, bis eine Antwort oder ein Ereignis da ist; ohne Preload null.
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);
  const fernsteuerung = useBrueckenWert(FERNSTEUERUNG_QUELLE);

  // Ein Stand für Statusleiste und Panel (lib/oberflaeche.ts): beide zeigen dieselbe Ableitung.
  const stand: OberflaechenStand = { state, masterLink, fernsteuerung };

  return (
    <AppShell
      tool="Battle"
      headerCenter={<span data-ba="runde">{BATTLE_TEXTE.runde(state.round, state.rounds.length)}</span>}
      onAir={onAirKopf(stand)}
      status={statusLeiste(stand)}
      settings={<Einstellungen stand={stand} aktionen={aktionen} />}
      settingsOpen={panelOffen}
      settingsSection={panelAbschnitt}
      onSettingsChange={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    >
      <LiveBereich state={state} aktionen={aktionen} />
    </AppShell>
  );
}

// Oberfläche von Q&A (UX Welle 1, Aufgabe d; Spec 3.1, 3.8, 5.1; E8, E13, E14, E17): AppShell mit Kopf (JM Q&A, „N wartend“ in der
// Mitte, On-Air, Hell/Dunkel, ⚙), der Statusleiste aus lib/oberflaeche.ts und dem Einstellungs-Panel; im Inhalt der Live-Bereich.
// Die Brücken (Master-Link, Fernsteuerung) und der Panelzustand laufen hier, auch bei geschlossenem Panel; das Panel selbst hat keine
// Effekte (G7, G8). Laden und Abonnement des Stands liegen darüber in App.tsx (immer gemountet). Es gibt keine Bildschirmleiste,
// kein Overlay und kein Modal für Einstellungen mehr: alles steht im Panel.
import { useState } from 'react';
import { AppShell, useBrueckenWert } from '@jm/ui';
import { FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE } from '@/lib/bruecken';
import { onAirKopf, statusLeiste, wartendText, type OberflaechenStand } from '@/lib/oberflaeche';
import type { QaState } from '@shared/types';
import { Einstellungen, type EinstellungenAktionen } from './Einstellungen';
import { LiveBereich, type LiveAktionen } from './LiveBereich';

/** Alles, was die Oberfläche auslöst: die Handler des Stores, als Rückrufe ohne Rückgabe. */
export interface QaViewAktionen extends LiveAktionen, EinstellungenAktionen {}

export function QaOberflaeche({
  state,
  aktionen,
  anfangOffen = false,
}: {
  state: QaState;
  aktionen: QaViewAktionen;
  /** Panel beim Start offen (nur für Tests; im Betrieb zu, nichts gemerkt). */
  anfangOffen?: boolean;
}): React.JSX.Element {
  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt; offen über ⚙ oder einen Statuseintrag.
  const [panelOffen, setPanelOffen] = useState(anfangOffen);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);

  // Lesende Brücken (Spec 3.9): undefined, bis eine Antwort oder ein Ereignis da ist; ohne Preload null.
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);
  const fernsteuerung = useBrueckenWert(FERNSTEUERUNG_QUELLE);

  // Ein Stand für Statusleiste und Panel (lib/oberflaeche.ts): beide zeigen dieselbe Ableitung. `qa:links` kommt bis zehnmal je Sekunde;
  // die Statusleiste rechnet nur aus diesem Stand.
  const stand: OberflaechenStand = { state, masterLink, fernsteuerung };

  return (
    <AppShell
      tool="Q&A"
      headerCenter={<span data-qa="wartend">{wartendText(stand)}</span>}
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

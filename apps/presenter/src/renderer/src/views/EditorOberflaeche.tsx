// Editor im Werkzeug-Rahmen (UX Welle 2b, Presenter d1; B11, B14, Muster d): AppShell „Werkzeug“ in der Dichte kompakt mit Kopf
// (JM Presenter, ON AIR, ThemeToggle, ⚙), Werkzeugleiste (Datei-Knöpfe, busy.label, NDI, Haupttaste), Statusleiste aus
// lib/oberflaeche.ts und dem gemeinsamen Panel. Die Wurzel-View (EditorOberflaeche) hält den einen Stand (useStand), die Startwahl
// und den Panelzustand; sie bleibt über Panel-Wechsel stabil, alle Abos laufen auch bei geschlossenem Panel. Der Rahmen
// (EditorRahmen) zeichnet nur, was er bekommt: Statusleiste und Panel mit derselben Startwahl. Die Ablage für Dateien umschließt
// den Rahmen von außen (EditorView, N2b 1.10 R6).
import { useEffect, useState, type ReactNode } from 'react';
import { AppShell } from '@jm/ui';
import { Werkzeugleiste } from '@/components/Toolbar';
import { bildschirmWahl, kopfOnAir, startBildschirm, statusLeiste, type OberflaechenStand, type StartWahl } from '@/lib/oberflaeche';
import { standAktionen, useStand } from '@/lib/useStand';
import { nurNdiBehalten } from '../../../shared/ndi';
import { Einstellungen, type EinstellungenAktionen } from './Einstellungen';

export interface EditorRahmenProps {
  stand: OberflaechenStand;
  startWahl: StartWahl;
  aktionen: EinstellungenAktionen;
  panelOffen: boolean;
  panelAbschnitt?: string;
  onPanel(offen: boolean, abschnitt?: string): void;
  children: ReactNode;
}

/** Der Rahmen des Editors: ein Stand und eine Startwahl für Kopf, Werkzeugleiste, Statusleiste und Panel (eine Wahrheit). */
export function EditorRahmen({ stand, startWahl, aktionen, panelOffen, panelAbschnitt, onPanel, children }: EditorRahmenProps): React.JSX.Element {
  return (
    <AppShell
      tool="Presenter"
      dichte="kompakt"
      onAir={kopfOnAir(stand)}
      status={statusLeiste(stand, startWahl)}
      toolbar={<Werkzeugleiste stand={stand} startWahl={startWahl} onNdi={aktionen.ndiSchalten} />}
      settings={<Einstellungen stand={stand} aktionen={aktionen} startWahl={startWahl} />}
      settingsOpen={panelOffen}
      settingsSection={panelAbschnitt}
      onSettingsChange={onPanel}
    >
      {children}
    </AppShell>
  );
}

export function EditorOberflaeche({
  children,
  anfangOffen = false,
}: {
  children: ReactNode;
  /** Panel beim Start offen (nur für Tests; im Betrieb zu, nichts gemerkt). */
  anfangOffen?: boolean;
}): React.JSX.Element {
  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt; offen über ⚙ oder einen Statuseintrag.
  const [panelOffen, setPanelOffen] = useState(anfangOffen);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);

  // Der eine Stand: alle Abos und Abfragen (B8), auch bei geschlossenem Panel.
  const stand = useStand('editor', panelOffen);

  // Startwahl (B11), gemerkt nur hier, nie gespeichert. Ohne eigene Wahl gilt die Vorgabe aus der aktuellen Liste, als echte
  // Bildschirm-id (startBildschirm); „Automatisch (Hauptmonitor)“ merkt die id des Hauptbildschirms (bildschirmWahl). So zeigt die
  // Auswahl immer den Bildschirm, auf dem der Main das Publikum öffnet.
  const [gewaehlt, setGewaehlt] = useState<number | undefined>(undefined);
  const [nurNdi, setNurNdi] = useState(false);
  // Liefert NDI dauerhaft kein Bild (aus, nicht verfügbar), gilt wieder die Bildschirmwahl; ein vorübergehendes „startet“ behält
  // „Keiner“ (wie bisher Toolbar.tsx:64-68).
  const nurNdiBleibt = stand.ndi !== undefined && nurNdiBehalten(stand.ndi);
  useEffect(() => {
    if (!nurNdiBleibt) setNurNdi(false);
  }, [nurNdiBleibt]);
  const startWahl: StartWahl = { bildschirm: startBildschirm(gewaehlt, stand.bildschirme), nurNdi };

  const aktionen: EinstellungenAktionen = {
    ...standAktionen(stand),
    startwahl: {
      startBildschirmWaehlen: (id) => setGewaehlt(bildschirmWahl(id, stand.bildschirme)),
      nurNdiWaehlen: setNurNdi,
    },
  };

  return (
    <EditorRahmen
      stand={stand}
      startWahl={startWahl}
      aktionen={aktionen}
      panelOffen={panelOffen}
      panelAbschnitt={panelAbschnitt}
      onPanel={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    >
      {children}
    </EditorRahmen>
  );
}

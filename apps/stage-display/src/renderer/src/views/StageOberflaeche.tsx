// Oberfläche des Stage-Displays (UX Welle 2a, Aufgabe d; Spec 3.1, 3.8, 5.1; E4, E5, E6, E16): AppShell mit Kopf (JM Stage Display,
// Hell/Dunkel, ⚙; kein ON AIR), Statusleiste aus lib/oberflaeche.ts und Einstellungs-Panel. Im Inhalt der Live-Bereich: Vorschau,
// Nachricht, Anzeige-Elemente und die Haupttaste „Bühnenschirm“. Das Panel ist kein eigener Bildschirm: Es steht im AppShell neben
// dem Inhalt, der Live-Bereich bleibt gemountet. Brücken, Bildschirmliste und Aktionen laufen hier, auch bei geschlossenem Panel;
// das Panel selbst hat keine Effekte (E15). Die Ausgabeansicht (#output) ist davon unberührt (E6).
import { useEffect, useState } from 'react';
import type { ScreenOption } from '@jm/settings';
import { AppShell, useBrueckenWert } from '@jm/ui';
import { baueAktionen, liesBildschirme } from '@/lib/aktionen';
import { useTick } from '@/lib/format';
import { AUSGABE_QUELLE, MASTER_LINK_QUELLE } from '@/lib/bruecken';
import { statusLeiste, STAGE_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import { useStage } from '@/store/stage';
import { Einstellungen } from './Einstellungen';
import { LiveBereich } from './LiveBereich';

export function StageOberflaeche({
  anfangOffen = false,
}: {
  /** Panel beim Start offen (nur für Tests; im Betrieb zu, nichts gemerkt). */
  anfangOffen?: boolean;
}): React.JSX.Element {
  const state = useStage((s) => s.state);
  const setConfig = useStage((s) => s.setConfig);
  const openOutput = useStage((s) => s.openOutput);
  const closeOutput = useStage((s) => s.closeOutput);
  const now = useTick();

  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt; offen über ⚙ oder einen Statuseintrag.
  const [panelOffen, setPanelOffen] = useState(anfangOffen);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);

  // Lesende Brücken (Spec 3.9): undefined, bis eine Antwort oder ein Ereignis da ist; ohne Preload null.
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);
  const ausgabe = useBrueckenWert(AUSGABE_QUELLE);

  // Bildschirmliste (Gesamtprüfung I3): beim Start und bei jeder Änderung des Ausgabezustands (ein abgezogener oder neuer
  // Bildschirm) frisch, dazu bei jedem Öffnen des Panels, beim Schließen nicht; undefined, bis eine Antwort da ist; bei einem
  // Fehler zurück auf unbekannt, nie die alte Liste; ohne Preload bleibt sie unbekannt.
  const [bildschirme, setBildschirme] = useState<ScreenOption[] | undefined>(undefined);
  useEffect(() => liesBildschirme(window.jmstage?.output?.displays, setBildschirme), [ausgabe]);
  useEffect(() => {
    if (!panelOffen) return undefined;
    return liesBildschirme(window.jmstage?.output?.displays, setBildschirme);
  }, [panelOffen]);

  // Ein Stand für Statusleiste, Panel und Haupttaste (lib/oberflaeche.ts): alle zeigen dieselbe Ableitung.
  const stand: OberflaechenStand = { stage: state ?? undefined, ausgabe, masterLink, ...(bildschirme === undefined ? {} : { bildschirme }) };
  const aktionen = baueAktionen({ outputDisplayId: state?.config.outputDisplayId ?? null, setConfig, openOutput, closeOutput });

  return (
    <AppShell
      tool="Stage Display"
      status={statusLeiste(stand)}
      settings={<Einstellungen stand={stand} aktionen={aktionen} />}
      settingsOpen={panelOffen}
      settingsSection={panelAbschnitt}
      onSettingsChange={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    >
      {!state ? (
        <div className="grid h-full place-items-center text-[var(--muted-foreground)]">{STAGE_TEXTE.live.laedt}</div>
      ) : (
        <div className="h-full overflow-auto">
          <div className="mx-auto max-w-[900px] px-6 py-6">
            <LiveBereich state={state} stand={stand} now={now} aktionen={aktionen} />
          </div>
        </div>
      )}
    </AppShell>
  );
}

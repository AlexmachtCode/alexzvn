// Oberfläche des Timers (UX Welle 1, Aufgabe d; Spec 3.1, 3.8, 5.1; E3, E8, E9, E17, E18): AppShell mit Kopf (JM Timer, ⚙, Hell/Dunkel,
// V-Zeile und Speaker-Knopf in der Mitte), Statusleiste aus lib/oberflaeche.ts und Einstellungs-Panel. Im Inhalt links die Sidebar
// mit den drei Modi, rechts die MessageBar (immer sichtbar) über genau einer Modus-Ansicht. Das Panel ist kein Modus (E9): Es steht im
// AppShell neben dem Inhalt, der Countdown bleibt samt Leertaste und R gemountet. Brücken und Speaker-Status laufen hier, auch bei
// geschlossenem Panel; das Panel selbst hat keine Effekte (G7, G8). Der Socket-Client und useAutoAdvance liegen darüber (App, Operator).
import { useEffect, useState } from 'react';
import { AppShell, useBrueckenWert } from '@jm/ui';
import { Clock } from '@/components/Clock';
import { Countdown } from '@/components/Countdown';
import { MessageBar } from '@/components/MessageBar';
import { Sidebar } from '@/components/Sidebar';
import { Timetable } from '@/components/Timetable';
import { FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE, VERBUND_QUELLE } from '@/lib/bruecken';
import { anzeigeModus, anzeigeVerbindung, statusLeiste, type OberflaechenStand, type TimerAktionen } from '@/lib/oberflaeche';
import { useStore } from '@/store/timer';
import { Einstellungen } from './Einstellungen';
import { KopfMitte } from './KopfMitte';

/** Genau eine Modus-Ansicht; `remote` und `settings` sind keine Modi mehr und zeigen den Countdown (anzeigeModus). */
function ModusInhalt({ modus }: { modus: ReturnType<typeof anzeigeModus> }): React.JSX.Element {
  return modus === 'clock' ? <Clock /> : modus === 'timetable' ? <Timetable /> : <Countdown />;
}

export function TimerOberflaeche({
  verbindungBekannt = false,
  anfangOffen = false,
}: {
  /** Ist schon ein Socket-Ereignis (verbunden oder getrennt) gekommen? Der Store startet mit connected=false; bis dahin gilt „unbekannt“. */
  verbindungBekannt?: boolean;
  /** Panel beim Start offen (nur für Tests; im Betrieb zu, nichts gemerkt). */
  anfangOffen?: boolean;
}): React.JSX.Element {
  const mode = useStore((s) => s.mode);
  const connected = useStore((s) => s.connected);
  const countdown = useStore((s) => s.countdown);
  const timetable = useStore((s) => s.timetable);

  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt; offen über ⚙ oder einen Statuseintrag.
  const [panelOffen, setPanelOffen] = useState(anfangOffen);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);

  // Speaker-Fenster (E3): undefined, bis isOpen geantwortet hat; ohne Preload (Browser) bleibt es „unbekannt“.
  const [speakerOffen, setSpeakerOffen] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (!window.jm?.speaker) return;
    void window.jm.speaker.isOpen().then(setSpeakerOffen, () => setSpeakerOffen(undefined));
    return window.jm.speaker.onStatus(setSpeakerOffen);
  }, []);

  // Lesende Brücken (Spec 3.9): undefined, bis eine Antwort oder ein Ereignis da ist; ohne Preload null.
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);
  const fernsteuerung = useBrueckenWert(FERNSTEUERUNG_QUELLE);
  const verbund = useBrueckenWert(VERBUND_QUELLE);

  // Ein Stand für Statusleiste und Panel (lib/oberflaeche.ts): beide zeigen dieselbe Ableitung.
  const stand: OberflaechenStand = {
    timer: { countdown, timetable },
    connected: anzeigeVerbindung(verbindungBekannt, connected),
    speakerOffen,
    masterLink,
    fernsteuerung,
    verbund,
  };
  // window.jm nur im Rückruf, nie beim Rendern (G7).
  const aktionen: TimerAktionen = { toggleSpeaker: () => void window.jm?.speaker.toggle() };

  return (
    <AppShell
      tool="Timer"
      headerCenter={<KopfMitte anzeige={verbund} speakerOffen={speakerOffen} onSpeaker={aktionen.toggleSpeaker} />}
      status={statusLeiste(stand)}
      settings={<Einstellungen stand={stand} aktionen={aktionen} />}
      settingsOpen={panelOffen}
      settingsSection={panelAbschnitt}
      onSettingsChange={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    >
      <div className="flex h-full min-h-0">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MessageBar />
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="@container mx-auto h-full max-w-[1400px] px-7 py-6">
              <ModusInhalt modus={anzeigeModus(mode)} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

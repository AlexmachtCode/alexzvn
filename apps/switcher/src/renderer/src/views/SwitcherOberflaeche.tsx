// Rahmen des Switchers (UX Welle 1, d1; Spec 3.1, 3.8, 5.1; E4, E6, E8, E17): AppShell mit Kopf (JM Switcher, ⚙, Hell/Dunkel,
// On-Air), der Projekt-Leiste in der Werkzeugleiste, der Statusleiste aus lib/oberflaeche.ts und dem Einstellungs-Panel. Der
// Mischer (SwitcherView) ist das Kind des Rahmens: unbedingt, ohne key und nicht im Panel, denn Engine, Canvas und Recorder laufen
// weiter, auch wenn das Panel auf- und zugeht (Review Focus 1). Die Controller und das Projekt leben in SwitcherView; es meldet
// dem Rahmen, was Kopf, Statusleiste, Toolbar und Panel zeigen (FrameMeldung). Brücken, Monitor- und Geräteliste laufen hier, auch
// bei geschlossenem Panel; das Panel selbst hat keine Effekte (G7, G8).
import { useEffect, useState } from 'react';
import { AUDIO_TEXTE, type AudioDeviceOption } from '@jm/settings';
import { AppShell, useBrueckenWert } from '@jm/ui';
import type { DisplayInfo } from '@shared/types';
import { FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE } from '@/lib/bruecken';
import {
  FRAME_ANFANG,
  onAirKopf,
  statusLeiste,
  type FrameMeldung,
  type OberflaechenStand,
  type SwitcherAktionen,
} from '@/lib/oberflaeche';
import { useSettings } from '@/store/settings';
import { Einstellungen } from './Einstellungen';
import { SwitcherView } from './SwitcherView';
import { Werkzeugleiste } from './Werkzeugleiste';

/** Audio-Eingänge auflisten; bei leeren Labels kurz Permission anfordern (wie bisher in der SettingsView). */
async function listAudioInputs(): Promise<AudioDeviceOption[]> {
  let devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = (): MediaDeviceInfo[] => devices.filter((d) => d.kind === 'audioinput');
  if (inputs().length === 0 || inputs().every((d) => !d.label)) {
    let probe: MediaStream | null = null;
    try {
      probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      devices = await navigator.mediaDevices.enumerateDevices();
    } finally {
      probe?.getTracks().forEach((t) => t.stop());
    }
  }
  return inputs().map((d, i) => ({ id: d.deviceId, label: d.label || `${AUDIO_TEXTE.titel} ${i + 1}` }));
}

/** Was der Rahmen dem Mischer reicht: die Meldung an den Rahmen und das Öffnen des Panels (bei einem Abschnitt). */
export interface MischerAnschluss {
  onFrame: (frame: FrameMeldung) => void;
  onOpenSettings: (abschnitt?: string) => void;
}

/**
 * Der Rahmen mit AppShell, Toolbar, Statusleiste und Panel. Der Mischer kommt als Funktion herein (er braucht den Anschluss) und
 * steht immer als Kind des AppShell, nie im Panel. Ohne Mischer testbar: SwitcherView braucht Canvas und Browser.
 */
export function SwitcherRahmen({
  anfangOffen = false,
  children,
}: {
  /** Panel beim Start offen (nur für Tests und den Render-Vergleich; im Betrieb zu, nichts gemerkt). */
  anfangOffen?: boolean;
  children: (anschluss: MischerAnschluss) => React.ReactNode;
}): React.JSX.Element {
  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt; offen über ⚙, einen Statuseintrag oder einen Link im Mischer.
  const [panelOffen, setPanelOffen] = useState(anfangOffen);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);
  // Was SwitcherView meldet; bis zur ersten Meldung der Anfangszustand.
  const [frame, setFrame] = useState<FrameMeldung>(FRAME_ANFANG);
  // Lesende Brücken (Spec 3.9): undefined, bis eine Antwort oder ein Ereignis da ist; ohne Preload null. Sie laufen hier und
  // damit auch bei geschlossenem Panel (die Statusleiste braucht sie immer).
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);
  const fernsteuerung = useBrueckenWert(FERNSTEUERUNG_QUELLE);
  const settings = useSettings();

  // Monitore für die Zweitbildschirm-Auswahl; undefined = noch nicht geladen oder nicht ladbar (dann „unbekannt“, nie eine
  // leere Liste, E4). Neu gelesen, wenn das Panel aufgeht, falls ein Monitor dazukam.
  const [displays, setDisplays] = useState<DisplayInfo[] | undefined>(undefined);
  useEffect(() => {
    void window.jmswitch.screen.listDisplays().then(setDisplays, () => setDisplays(undefined));
  }, [panelOffen]);

  // Audioeingänge; undefined = noch nicht gesucht oder die Suche schlug fehl („unbekannt“).
  const [audioGeraete, setAudioGeraete] = useState<AudioDeviceOption[] | undefined>(undefined);
  const scanAudio = (): void => {
    void listAudioInputs().then(setAudioGeraete, () => setAudioGeraete(undefined));
  };
  useEffect(scanAudio, []);

  // Ein Stand für Statusleiste und Panel (lib/oberflaeche.ts): beide zeigen dieselbe Ableitung.
  const stand: OberflaechenStand = {
    settings,
    output: frame.output,
    ndi: frame.ndi,
    audio: frame.audio,
    audioGeraete,
    displays,
    masterLink,
    fernsteuerung,
    canTake: frame.canTake,
    canAuto: frame.canAuto,
    transitioning: frame.transitioning,
  };
  const aktionen: SwitcherAktionen = {
    setRtmpUrl: settings.setRtmpUrl,
    setStreamBitrateKbps: settings.setStreamBitrateKbps,
    setRecordBitrateKbps: settings.setRecordBitrateKbps,
    setControlEnabled: settings.setControlEnabled,
    setControlPort: settings.setControlPort,
    setAudioInputId: settings.setAudioInputId,
    setNdiOutputName: settings.setNdiOutputName,
    setNdiOutputSource: settings.setNdiOutputSource,
    setProgramResolution: settings.setProgramResolution,
    setOutputFps: settings.setOutputFps,
    setSecondScreenEnabled: settings.setSecondScreenEnabled,
    setSecondScreenDisplayId: settings.setSecondScreenDisplayId,
    toggleNdiOutput: frame.aktionen.toggleNdiOutput,
    toggleRecording: frame.aktionen.toggleRecording,
    toggleStreaming: frame.aktionen.toggleStreaming,
    scanAudio,
  };

  return (
    <AppShell
      tool="Switcher"
      onAir={onAirKopf(stand)}
      status={statusLeiste(stand)}
      toolbar={<Werkzeugleiste name={frame.projekt.name} pfad={frame.projekt.pfad} aktionen={frame.aktionen} />}
      settings={<Einstellungen stand={stand} aktionen={aktionen} />}
      settingsOpen={panelOffen}
      settingsSection={panelAbschnitt}
      onSettingsChange={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    >
      {children({
        onFrame: setFrame,
        onOpenSettings: (abschnitt) => {
          setPanelOffen(true);
          setPanelAbschnitt(abschnitt);
        },
      })}
    </AppShell>
  );
}

export function SwitcherOberflaeche(): React.JSX.Element {
  return <SwitcherRahmen>{(anschluss) => <SwitcherView onFrame={anschluss.onFrame} onOpenSettings={anschluss.onOpenSettings} />}</SwitcherRahmen>;
}

// Oberfläche der Caption (UX Welle 2a, Caption d; Spec 3.1, 3.8, 5.1; E4, E5, E8, E9, E15, E16): AppShell mit Kopf (JM Caption,
// Logo, ON AIR nach E4, Hell/Dunkel, ⚙), Statusleiste aus lib/oberflaeche.ts und Einstellungs-Panel; im Inhalt der Live-Bereich.
// Diese View ist die Wurzel-View (App.tsx zeigt sie ohne Bedingung und ohne key). Hier laufen unbedingt und vor jeder Bedingung,
// wie bisher oben im alten App: das Laden des Zustands, die Geräteliste (mit der Mikrofon-Probe beim Start), die NDI-/Render-
// Engine (useCaptionNdiEngine, zeichnet in die Vorschau und sendet bei aktivem NDI) und die Aufnahme-Effekte (Start bei running,
// Neustart beim Gerätewechsel, Stopp, micError). Das Panel ist kein eigener Bildschirm: Es steht im AppShell neben dem Inhalt,
// steckt in keinem key und in keiner Bedingung um den Live-Bereich; nichts hier baut das Vorschau-Canvas um oder stoppt die
// Aufnahme. Brücken (Master-Link, Fernsteuerung) laufen auch bei geschlossenem Panel. window.jmcaption nur in Effekten und
// Rückrufen.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell, useBrueckenWert } from '@jm/ui';
import type { CaptionConfig } from '@shared/types';
import { geraeteListe, liveAktionen, panelAktionen, type CaptionStore } from '@/lib/aktionen';
import { FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE } from '@/lib/bruecken';
import { startCapture, listAudioInputs, type Capture } from '@/lib/capture';
import { useCaptionNdiEngine } from '@/lib/ndi-engine';
import { kopfOnAir, statusLeiste, type MikrofonGeraet, type OberflaechenStand } from '@/lib/oberflaeche';
import { useCaption } from '@/store/useCaption';
import { Einstellungen } from './Einstellungen';
import { LiveBereich } from './LiveBereich';

// Nur als Platzhalter, bis der echte State (mit config) vom Main geladen ist —
// die Engine-Hooks laufen unbedingt, brauchen aber eine vollständige Config.
// Nie Teil des Stands der Oberfläche (Übergabe Task 25): caption ist nur die Antwort des Main.
const FALLBACK_CFG: CaptionConfig = {
  model: 'base',
  language: 'de',
  maxUtteranceSec: 8,
  silenceMs: 700,
  silenceThreshold: 0.012,
  audioInputDeviceId: '',
  dictionary: '',
  engine: 'server',
  ndiName: 'JM Caption',
  ndiWidth: 1920,
  ndiHeight: 1080,
  ndiFps: 30,
  ndiFontSize: 54,
  ndiLines: 2,
  ndiBand: true,
};

export function CaptionOberflaeche({
  anfangOffen = false,
}: {
  /** Panel beim Start offen (nur für Tests; im Betrieb zu, nichts gemerkt). */
  anfangOffen?: boolean;
}): React.JSX.Element {
  const { state, level, load, setLevel, setConfig, start, stop, setHold, clear, correctLast, ndiStart, ndiStop } =
    useCaption();
  const captureRef = useRef<Capture | null>(null);
  // Audio-Eingang, mit dem die laufende Aufnahme gestartet wurde — für den
  // Neustart bei Gerätewechsel im Betrieb.
  const activeDeviceRef = useRef<string>('');
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  // Gemessene Eingänge: undefined, bis listAudioInputs das erste Mal antwortet (Übergabe Task 25).
  const [geraete, setGeraete] = useState<MikrofonGeraet[] | undefined>(undefined);
  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt; offen über ⚙ oder einen Statuseintrag.
  const [panelOffen, setPanelOffen] = useState(anfangOffen);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
  }, [load]);

  // Audio-Eingänge auflisten (+ auf An-/Abstecken reagieren).
  const refreshDevices = useCallback(() => {
    void listAudioInputs()
      .then((d) => setGeraete(geraeteListe(d)))
      .catch(() => setGeraete([]));
  }, []);
  useEffect(() => {
    refreshDevices();
    const onChange = (): void => refreshDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', onChange);
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', onChange);
  }, [refreshDevices]);

  const running = state?.running ?? false;
  const cfg = state?.config;
  const hold = state?.hold ?? false;
  const ndiActive = state?.status.ndiActive ?? false;

  // NDI-/Render-Engine (zeichnet Untertitel → Vorschau + NDI-Frames). Läuft immer;
  // sendet nur bei aktivem NDI. Hold friert die Ausgabe ein.
  useCaptionNdiEngine(cfg ?? FALLBACK_CFG, state?.lines ?? [], hold, ndiActive, previewRef);

  // Aufnahme-Lebenszyklus an das running-Flag koppeln.
  useEffect(() => {
    const desiredDevice = cfg?.audioInputDeviceId ?? '';
    // Gerätewechsel im laufenden Betrieb → alte Aufnahme verwerfen, damit sie
    // unten mit dem neuen Eingang neu startet.
    if (running && captureRef.current && activeDeviceRef.current !== desiredDevice) {
      captureRef.current.stop();
      captureRef.current = null;
      setLevel(0);
    }
    if (running && !captureRef.current && cfg) {
      let cancelled = false;
      activeDeviceRef.current = desiredDevice;
      startCapture(
        {
          silenceMs: cfg.silenceMs,
          silenceThreshold: cfg.silenceThreshold,
          maxUtteranceSec: cfg.maxUtteranceSec,
          deviceId: cfg.audioInputDeviceId,
          onLevel: (r) => setLevel(r),
        },
        (pcm, sr) => window.jmcaption.pushUtterance(pcm, sr),
      )
        .then((cap) => {
          if (cancelled) cap.stop();
          else {
            captureRef.current = cap;
            setMicError(null);
          }
        })
        .catch((e: unknown) => setMicError(String((e as Error)?.message ?? e)));
      return () => {
        cancelled = true;
      };
    }
    if (!running && captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
      setLevel(0);
    }
    return undefined;
  }, [running, cfg, setLevel]);

  // Beim Verlassen Aufnahme sicher stoppen.
  useEffect(() => () => captureRef.current?.stop(), []);

  // Lesende Brücken (Spec 3.9): undefined, bis eine Antwort oder ein Ereignis da ist; ohne Preload null.
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);
  const fernsteuerung = useBrueckenWert(FERNSTEUERUNG_QUELLE);

  // Ein Stand für Statusleiste, Panel, ON AIR und Haupttasten (lib/oberflaeche.ts): alle zeigen dieselbe Ableitung.
  const stand: OberflaechenStand = { caption: state ?? undefined, geraete, micError, pegel: level, masterLink, fernsteuerung };
  // Store-Aktionen unter ihrem Namen (dieselben wie im alten App.tsx).
  const store: CaptionStore = { setConfig, start, stop, setHold, clear, correctLast, ndiStart, ndiStop };
  const panel = panelAktionen(store, cfg?.ndiName, refreshDevices);
  const live = liveAktionen(store, cfg?.ndiName, setEditing);

  return (
    <AppShell
      tool="Caption"
      onAir={kopfOnAir(stand)}
      status={statusLeiste(stand)}
      settings={<Einstellungen stand={stand} aktionen={panel} />}
      settingsOpen={panelOffen}
      settingsSection={panelAbschnitt}
      onSettingsChange={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    >
      <div className="px-5 py-4">
        <LiveBereich stand={stand} previewRef={previewRef} editing={editing} aktionen={live} />
      </div>
    </AppShell>
  );
}

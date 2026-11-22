// Oberfläche des Interpreters (UX Welle 2a, Interpreter d; Spec 3.1, 3.8, 5.1; E4, E5, E10, E15, E16): AppShell mit Kopf (JM
// Interpreter, Logo, ON AIR „MIX AKTIV“ nach E4, Hell/Dunkel, ⚙), Statusleiste aus lib/oberflaeche.ts und Einstellungs-Panel; im
// Inhalt der Live-Bereich. Diese View ist die Wurzel-View (App.tsx zeigt sie ohne Bedingung und ohne key) und der Besitzer der
// Audio-Engine: Hier laufen unbedingt und vor jeder Bedingung, Zeichen für Zeichen wie bisher im alten App (App.tsx:6-84 bei
// d7cdd79ce0), die Erzeugung der Engine (useRef), ihr Abo mit destroy im Aufräumen, die Geräteliste mit der Mikrofon-Probe beim
// Start und die Effekte, mit denen Regler und Bypass sofort wirken. Das Panel ist kein eigener Bildschirm: Es steht im AppShell
// neben dem Inhalt, steckt in keinem key und in keiner Bedingung um den Live-Bereich oder diese View; nichts hier erzeugt eine
// zweite Engine oder baut die laufende ab. Die Brücke (Master-Link) läuft auch bei geschlossenem Panel. window.jminterpreter nur
// im Rückruf des Download-Knopfs.
import { useEffect, useRef, useState } from 'react';
import { AppShell, useBrueckenWert } from '@jm/ui';
import { InterpreterEngine, listDevices, type DeviceInfo, type EngineState } from '@/core/engine';
import { kabelHerunterladen, liveAktionen, panelAktionen } from '@/lib/aktionen';
import { MASTER_LINK_QUELLE } from '@/lib/bruecken';
import { kopfOnAir, statusLeiste, type GestarteteEingaenge, type OberflaechenStand } from '@/lib/oberflaeche';
import { duckSettings, useSettings } from '@/store/settings';
import { Einstellungen } from './Einstellungen';
import { LiveBereich } from './LiveBereich';

export function InterpreterOberflaeche({
  anfangOffen = false,
}: {
  /** Panel beim Start offen (nur für Tests; im Betrieb zu, nichts gemerkt). */
  anfangOffen?: boolean;
}): React.JSX.Element {
  // Der Konstruktor der Engine ist nebenwirkungsfrei; die verworfene Instanz aus dem doppelten
  // StrictMode-Render bleibt daher inert. Verdrahtet wird ausschließlich im Effekt.
  const engineRef = useRef<InterpreterEngine | null>(null);
  if (!engineRef.current) engineRef.current = new InterpreterEngine();
  const engine = engineRef.current;

  // Zustand der Engine: undefined bis zum ersten getState() im Effekt (Übergabe Task 30). Der Vorgabewert des Konstruktors ist
  // keine Antwort; bis dahin sind Taste und Einträge „unbekannt“ bzw. gesperrt.
  const [state, setState] = useState<EngineState | undefined>(undefined);
  const [inputs, setInputs] = useState<DeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<DeviceInfo[]>([]);
  const [labelsAvailable, setLabelsAvailable] = useState(true);
  // Vor dem ersten listDevices()-Ergebnis ist die Liste leer. Ohne dieses Flag würde ein aus
  // dem Store wiederhergestelltes outputId sofort "Gerät nicht verfügbar" behaupten (#208) —
  // ein Fehlalarm bei jedem Start, bis die echte Geräteliste da ist.
  const [devicesLoaded, setDevicesLoaded] = useState(false);
  const s = useSettings();
  // Fix-Runde 1: die Eingänge, mit denen die Haupttaste engine.start gerufen hat (die Engine liest sie nur in start()); null vor
  // dem ersten Start und nach dem Stopp. Daran messen Statusleiste und Panel im Lauf, ob eine Wahl schon wirkt.
  const [gestartet, setGestartet] = useState<GestarteteEingaenge | null>(null);
  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt; offen über ⚙ oder einen Statuseintrag.
  const [panelOffen, setPanelOffen] = useState(anfangOffen);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);

  useEffect(() => {
    const unsub = engine.subscribe(() => setState(engine.getState()));
    setState(engine.getState());
    return () => {
      unsub();
      engine.destroy();
    };
  }, [engine]);

  // Geräte auch nachziehen, wenn sich die Liste ändert: wer VB-CABLE erst nachinstalliert, soll
  // die Hinweiskarte ohne Neustart verschwinden sehen.
  //
  // Windows feuert `devicechange` bei einer Treiberinstallation mehrfach hintereinander. Ohne
  // Bündelung könnte ein älterer, länger laufender Aufruf einen bereits eingetroffenen jüngeren
  // Snapshot überschreiben — die Karte bliebe dann stehen, obwohl das Kabel schon da ist, genau
  // das Gegenteil des Katalogversprechens "ohne Neustart erkannt". Ein nachlaufender Debounce
  // bündelt die Serie, der Generationszähler verwirft zusätzlich jedes Ergebnis, das nicht mehr
  // zum jüngsten angestoßenen Aufruf gehört.
  useEffect(() => {
    let generation = 0;
    let knownLabels = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const load = (): void => {
      const myGeneration = ++generation;
      // Die Mikrofon-Probe ist nur nötig, solange noch keine Gerätenamen bekannt sind — danach
      // erspart sie dem Operator unnötige Mikrofon-Öffnungen im Livebetrieb.
      void listDevices(!knownLabels).then(({ inputs, outputs, labelsAvailable }) => {
        // Ein jüngerer Aufruf ist inzwischen unterwegs: dieses Ergebnis verwerfen.
        if (myGeneration !== generation) return;
        setInputs(inputs);
        setOutputs(outputs);
        setLabelsAvailable(labelsAvailable);
        setDevicesLoaded(true);
        if (labelsAvailable) knownLabels = true;
      });
    };

    const onDeviceChange = (): void => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(load, 500);
    };

    load();
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);

  // Regler wirken sofort — auch während die Konferenz läuft.
  useEffect(() => {
    engine.setSettings(duckSettings(s));
  }, [engine, s]);
  useEffect(() => {
    engine.setBypass(s.bypass);
  }, [engine, s.bypass]);

  // Lesende Brücke (Spec 3.9): undefined, bis eine Antwort oder ein Ereignis da ist; ohne Preload null.
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);

  // Ein Stand für Statusleiste, Panel, ON AIR, Haupttaste und Live-Bereich (lib/oberflaeche.ts): alle zeigen dieselbe Ableitung.
  // Die Einstellungen liest der Store beim Anlegen synchron aus localStorage (persist), sie sind also ab dem ersten Bild gelesen.
  const stand: OberflaechenStand = {
    engine: state,
    einstellungen: { floorId: s.floorId, interpreterId: s.interpreterId, outputId: s.outputId, bypass: s.bypass },
    geraete: devicesLoaded ? { eingaenge: inputs, ausgaenge: outputs, labelsAvailable } : undefined,
    masterLink,
    gestartet,
  };
  // Haupttaste wie der alte toggle (Engine selbst, running aus dem Zustand, die drei Geräte aus dem Store); Download liest den
  // Preload erst beim Klick; vor dem Start merkt sich die View die übergebenen Eingänge, nach dem Stopp vergisst sie sie. Das
  // Panel schreibt nur den Store (set, reset).
  const live = liveAktionen(
    engine,
    state?.running === true,
    { floorId: s.floorId, interpreterId: s.interpreterId, outputId: s.outputId },
    () => kabelHerunterladen(window.jminterpreter),
    setGestartet,
  );
  const panel = panelAktionen(s);

  return (
    <AppShell
      tool="Interpreter"
      onAir={kopfOnAir(stand)}
      status={statusLeiste(stand)}
      settings={<Einstellungen stand={stand} werte={{ ...duckSettings(s), bypass: s.bypass }} aktionen={panel} />}
      settingsOpen={panelOffen}
      settingsSection={panelAbschnitt}
      onSettingsChange={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    >
      <LiveBereich stand={stand} schwelleDb={s.thresholdDb} aktionen={live} />
    </AppShell>
  );
}

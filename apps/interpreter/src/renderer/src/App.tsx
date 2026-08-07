import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { InterpreterEngine, listDevices, type DeviceInfo, type EngineState } from '@/core/engine';
import { duckSettings, useSettings } from '@/store/settings';
import { counterpartPresent, detectCable, zoomInputDisplayName } from '@shared/virtual-cable';

export function App(): JSX.Element {
  // Der Konstruktor der Engine ist nebenwirkungsfrei; die verworfene Instanz aus dem doppelten
  // StrictMode-Render bleibt daher inert. Verdrahtet wird ausschließlich im Effekt.
  const engineRef = useRef<InterpreterEngine | null>(null);
  if (!engineRef.current) engineRef.current = new InterpreterEngine();
  const engine = engineRef.current;

  const [state, setState] = useState<EngineState>(() => engine.getState());
  const [inputs, setInputs] = useState<DeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<DeviceInfo[]>([]);
  const [labelsAvailable, setLabelsAvailable] = useState(true);
  // Vor dem ersten listDevices()-Ergebnis ist die Liste leer. Ohne dieses Flag würde ein aus
  // dem Store wiederhergestelltes outputId sofort "Gerät nicht verfügbar" behaupten (#208) —
  // ein Fehlalarm bei jedem Start, bis die echte Geräteliste da ist.
  const [devicesLoaded, setDevicesLoaded] = useState(false);
  const s = useSettings();

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
        if (myGeneration !== generation) return; // ein jüngerer Aufruf ist inzwischen unterwegs
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

  const toggle = useCallback(() => {
    if (state.running) void engine.stop();
    else void engine.start({ floorId: s.floorId, interpreterId: s.interpreterId, outputId: s.outputId });
  }, [engine, state.running, s.floorId, s.interpreterId, s.outputId]);

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-4 overflow-y-auto p-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">JM Interpreter</h1>
          <p className="text-sm text-neutral-400">Floor/Dolmetscher-Ducking · Einspeisung in Zoom/Webex</p>
        </div>
        <button
          onClick={toggle}
          disabled={!s.floorId || !s.interpreterId}
          title={!s.floorId || !s.interpreterId ? 'Erst beide Eingänge wählen' : undefined}
          className={`rounded-xl px-5 py-3 font-bold disabled:opacity-40 ${
            state.running ? 'bg-red-600 text-white' : 'bg-yellow-400 text-neutral-900'
          }`}
        >
          {state.running ? 'Stoppen' : 'Starten'}
        </button>
      </header>

      {state.error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{state.error}</div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <Picker label="Floor (O-Ton)" value={s.floorId} devices={inputs} onChange={(v) => s.set('floorId', v)} />
        <Picker
          label="Dolmetscher"
          value={s.interpreterId}
          devices={inputs}
          onChange={(v) => s.set('interpreterId', v)}
        />
        <Picker
          label="Ausgabe (virtuelles Kabel)"
          value={s.outputId}
          devices={outputs}
          onChange={(v) => s.set('outputId', v)}
          allowDefault
        />
      </section>

      <CableStatus
        outputId={s.outputId}
        outputs={outputs}
        inputs={inputs}
        labelsAvailable={labelsAvailable}
        devicesLoaded={devicesLoaded}
        running={state.running}
        startedOutputId={state.startedOutputId}
      />

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">Pegel</span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              state.ducking ? 'bg-yellow-400 text-neutral-900' : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            {state.ducking ? 'FLOOR ABGESENKT' : 'Floor offen'}
          </span>
        </div>
        <Meter label="Floor" db={state.floorDb} />
        <Meter label="Dolmetscher" db={state.interpreterDb} threshold={s.thresholdDb} />
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">Ducking</span>
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            <input type="checkbox" checked={s.bypass} onChange={(e) => s.set('bypass', e.target.checked)} />
            Überbrücken (zum Vergleichshören)
          </label>
        </div>
        <Slider label="Schwelle" unit="dB" min={-70} max={-10} value={s.thresholdDb} onChange={(v) => s.set('thresholdDb', v)}
          hint="Ab diesem Dolmetscher-Pegel wird der O-Ton abgesenkt." />
        <Slider label="Absenkung" unit="dB" min={-40} max={0} value={s.duckDb} onChange={(v) => s.set('duckDb', v)}
          hint="Wie weit der O-Ton zurückgeht, solange gesprochen wird." />
        <Slider label="Attack" unit="ms" min={5} max={300} step={5} value={s.attackMs} onChange={(v) => s.set('attackMs', v)}
          hint="Wie schnell abgesenkt wird." />
        <Slider label="Release" unit="ms" min={50} max={2000} step={10} value={s.releaseMs} onChange={(v) => s.set('releaseMs', v)}
          hint="Wie schnell der O-Ton zurückkommt." />
        <Slider label="Nachlauf" unit="ms" min={0} max={1500} step={10} value={s.holdMs} onChange={(v) => s.set('holdMs', v)}
          hint="Atempausen kürzer als der Nachlauf reißen den O-Ton nicht hoch (verhindert Pumpen)." />
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-3 text-sm font-semibold">Vorverstärkung</div>
        <Slider label="Floor" unit="dB" min={-24} max={12} value={s.floorGainDb} onChange={(v) => s.set('floorGainDb', v)} />
        <Slider label="Dolmetscher" unit="dB" min={-24} max={12} value={s.interpreterGainDb} onChange={(v) => s.set('interpreterGainDb', v)} />
        <button onClick={s.reset} className="mt-2 rounded bg-neutral-700 px-3 py-1 text-xs font-semibold">
          Ducking-Werte zurücksetzen
        </button>
      </section>
    </div>
  );
}

function Picker({
  label,
  value,
  devices,
  onChange,
  allowDefault,
}: {
  label: string;
  value: string;
  devices: DeviceInfo[];
  onChange: (v: string) => void;
  allowDefault?: boolean;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
      >
        <option value="">{allowDefault ? 'Systemstandard' : '— bitte wählen —'}</option>
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** dBFS auf 0…1 abbilden. Unter -60 dB ist für Sprache nichts mehr zu sehen. */
function meterWidth(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

function Meter({ label, db, threshold }: { label: string; db: number; threshold?: number }): JSX.Element {
  return (
    <div className="mb-2">
      <div className="mb-1 flex justify-between text-xs text-neutral-400">
        <span>{label}</span>
        <span className="tabular-nums">{Number.isFinite(db) ? `${db.toFixed(1)} dB` : '—'}</span>
      </div>
      <div className="relative h-3 overflow-hidden rounded bg-neutral-800">
        <div className="h-full bg-yellow-400 transition-[width] duration-75" style={{ width: `${meterWidth(db) * 100}%` }} />
        {threshold !== undefined && (
          <div
            title={`Schwelle ${threshold} dB`}
            className="absolute inset-y-0 w-0.5 bg-red-400"
            style={{ left: `${meterWidth(threshold) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

function Slider({
  label,
  unit,
  min,
  max,
  step = 1,
  value,
  onChange,
  hint,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}): JSX.Element {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs">
        <span className="text-neutral-300">{label}</span>
        <span className="tabular-nums text-neutral-400">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-yellow-400"
      />
      {hint && <div className="text-[11px] text-neutral-500">{hint}</div>}
    </div>
  );
}

/** Einheitlicher Rahmen fuer die Statuszeilen unter dem Ausgabe-Picker. */
function Notice({ tone, children }: { tone: 'ok' | 'warn'; children: ReactNode }): JSX.Element {
  // 'ok' bekommt eine erkennbar positive Farbe: die eine Zeile, die den ganzen Fix traegt, darf
  // nicht wie Dekor unter den umgebenden neutralen Flaechen verschwinden (#208).
  const cls =
    tone === 'ok'
      ? 'border-emerald-700 bg-emerald-950/30 text-emerald-200'
      : 'border-yellow-800 bg-yellow-950/30 text-yellow-200';
  return <div className={`rounded-lg border p-3 text-sm ${cls}`}>{children}</div>;
}

/** Gemeinsamer Fuss der Erklaerkarte: Lizenzsatz + Download-Knopf, in beiden Karten-Varianten gleich. */
function CableDownloadFooter(): JSX.Element {
  return (
    <>
      <p className="mt-2 text-xs text-yellow-200/60">
        VB-CABLE ist für private Nutzung Donationware; der gewerbliche Einsatz ist lizenzpflichtig.
      </p>
      <button
        onClick={() => {
          // Defensiv: window.jminterpreter kann fehlen, falls das Preload (noch) nicht geladen
          // hat — sonst wirft schon der Property-Zugriff, bevor `.catch()` greifen kann.
          void window.jminterpreter?.openCableDownload().catch(() => {});
        }}
        className="mt-3 rounded-lg border border-yellow-700 px-3 py-1.5 text-xs font-semibold hover:bg-yellow-900/40"
      >
        VB-CABLE herunterladen
      </button>
    </>
  );
}

/**
 * Meldet den Zustand des gerade wirksamen Ausgabegeraets — Kabel erkannt, Gegenseite fehlt,
 * unbekanntes Geraet, oder gar keins gewaehlt. Getrennt von `CableStatus`, weil der waehrend des
 * Betriebs nicht unbedingt der aktuelle Picker-Wert ist (siehe dort).
 */
function deviceCableNotice(outputId: string, outputs: DeviceInfo[], inputs: DeviceInfo[]): JSX.Element {
  const selected = outputs.find((d) => d.deviceId === outputId);

  if (outputId && !selected) {
    return (
      <Notice tone="warn">
        Das gewählte Ausgabegerät ist derzeit nicht verfügbar. Der Mix geht auf den Systemstandard und
        erreicht die Konferenz nicht.
      </Notice>
    );
  }

  const kind = selected ? detectCable(selected.label) : null;
  const inputLabels = inputs.map((d) => d.label);

  if (kind) {
    if (!counterpartPresent(kind, inputLabels)) {
      return (
        <Notice tone="warn">
          {kind.name} erkannt, aber unter dem Namen <strong>{kind.zoomInputLabel}</strong> wurde keine
          Aufnahmeseite gefunden. Mögliche Ursachen: der Treiber ist unvollständig installiert, das Gerät ist
          in den Windows-Sound-Einstellungen deaktiviert — oder es wurde dort umbenannt.
        </Notice>
      );
    }

    // Der TATSAECHLICH gefundene Geraetename, nicht die feste Konstante: die Muster akzeptieren
    // bewusst Namensvarianten, die es auf diesem Rechner so gar nicht gibt (#208).
    const zoomName = zoomInputDisplayName(kind, inputLabels);

    if (kind.needsRouting) {
      // VoiceMeeter (wie Dante) verbindet Ein- und Ausgang nicht von allein — Warnton statt
      // Erfolgston, plus der Zusatzhinweis, was im VoiceMeeter noch zu tun ist.
      return (
        <Notice tone="warn">
          {kind.name} erkannt. In Zoom als <em>Mikrofon</em> wählen: <strong>{zoomName}</strong>. {kind.routingHint}
        </Notice>
      );
    }

    return (
      <Notice tone="ok">
        {kind.name} erkannt. In Zoom als <em>Mikrofon</em> wählen: <strong>{zoomName}</strong>
      </Notice>
    );
  }

  if (!outputId) {
    return (
      <div className="rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
        <p className="font-bold">Kein virtuelles Kabel gewählt</p>
        <p className="mt-1 text-yellow-200/80">
          Zoom und Webex können nur ein <em>Mikrofon</em> abgreifen. Der Interpreter spielt seinen Mix deshalb
          in ein virtuelles Kabel hinein; in Zoom wird dann das andere Ende desselben Kabels als Mikrofon
          gewählt. Ohne Kabel geht der Mix auf den Systemstandard und erreicht die Konferenz nicht.
        </p>
        <CableDownloadFooter />
      </div>
    );
  }

  // Ein Geraet ist bewusst gewaehlt, aber keins der bekannten Kabel (z. B. Dante, Realtek): der
  // Mix geht sehr wohl dorthin — anders als im "nichts gewaehlt"-Fall oben darf das hier nicht
  // behauptet werden (#208).
  return (
    <div className="rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
      <p className="font-bold">{selected!.label}: kein bekanntes virtuelles Kabel</p>
      <p className="mt-1 text-yellow-200/80">
        Der Mix geht auf dieses Gerät. Es ist aber kein virtuelles Kabel, das der Interpreter kennt, und für
        Zoom/Webex wird eines gebraucht, damit die Konferenz den Ton als Mikrofon abgreifen kann. Sonderwege
        (z. B. eigenes Routing) bleiben davon unbenommen möglich.
      </p>
      <CableDownloadFooter />
    </div>
  );
}

/**
 * Sagt dauerhaft, was in Zoom zu waehlen ist (#208). Der frueherere Hinweis verschwand, sobald ein
 * Geraet gewaehlt war — also genau dann, wenn der Operator die Anweisung braucht.
 */
function CableStatus({
  outputId,
  outputs,
  inputs,
  labelsAvailable,
  devicesLoaded,
  running,
  startedOutputId,
}: {
  outputId: string;
  outputs: DeviceInfo[];
  inputs: DeviceInfo[];
  labelsAvailable: boolean;
  devicesLoaded: boolean;
  running: boolean;
  startedOutputId: string | null;
}): JSX.Element | null {
  // Vor dem ersten listDevices()-Ergebnis ist die Liste leer — noch nichts Alarmierendes
  // behaupten, sonst meldet ein gespeichertes outputId faelschlich "nicht verfuegbar" (#208).
  if (!devicesLoaded) return null;

  if (!labelsAvailable) {
    return (
      <Notice tone="warn">
        Gerätenamen nicht lesbar — bitte die Mikrofonfreigabe erteilen. Ohne sie kann der Interpreter das
        virtuelle Kabel nicht erkennen.
      </Notice>
    );
  }

  // `engine.route()` laeuft nur in `start()` — stellt der Operator den Ausgabe-Picker waehrend des
  // Betriebs um, sendet der Mix unveraendert auf das beim Start gewaehlte Geraet weiter. Die
  // Anzeige richtet sich deshalb nach dem GESTARTETEN Geraet, nicht nach dem aktuellen Picker-
  // Wert, und bekommt zusaetzlich einen eigenen Hinweis, dass die Umstellung noch nicht wirkt.
  const pendingChange = running && startedOutputId !== null && outputId !== startedOutputId;
  const effectiveOutputId = running && startedOutputId !== null ? startedOutputId : outputId;

  return (
    <>
      {pendingChange && (
        <Notice tone="warn">
          Das Ausgabegerät wurde geändert, der Interpreter sendet aber noch auf das beim Start gewählte Gerät.
          Die Änderung wirkt erst, wenn er <strong>gestoppt und erneut gestartet</strong> wird.
        </Notice>
      )}
      {deviceCableNotice(effectiveOutputId, outputs, inputs)}
    </>
  );
}

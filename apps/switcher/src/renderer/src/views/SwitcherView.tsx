import { useEffect, useRef, useState } from 'react';
import { Button, cn } from '@jm/ui';
import type { NdiStatus, NdiVideoMessage, ScreenSourceInfo } from '@shared/types';
import { emptyContent, makeEmptyProject, type SwitcherProject } from '@shared/project';
import {
  SwitcherEngine,
  type EngineState,
  type LayerInfo,
  type Rect,
  type SceneInfo,
  type SourceInfo,
} from '@/core/engine';
import { OutputController, type OutputState } from '@/core/output';
import { NdiOutputController, type NdiOutputState } from '@/core/ndiOutput';
import { AudioController, type AudioState } from '@/core/audio';
import { useSettings } from '@/store/settings';

const PALETTE = ['#1d4ed8', '#dc2626', '#16a34a', '#9333ea', '#0891b2', '#ca8a04'];

const LAYER_PRESETS: { key: string; label: string; rect: Rect }[] = [
  { key: 'full', label: 'Vollbild', rect: { x: 0, y: 0, w: 1, h: 1 } },
  { key: 'tl', label: 'PiP oben links', rect: { x: 0.04, y: 0.06, w: 0.3, h: 0.3 } },
  { key: 'tr', label: 'PiP oben rechts', rect: { x: 0.66, y: 0.06, w: 0.3, h: 0.3 } },
  { key: 'bl', label: 'PiP unten links', rect: { x: 0.04, y: 0.64, w: 0.3, h: 0.3 } },
  { key: 'br', label: 'PiP unten rechts', rect: { x: 0.66, y: 0.64, w: 0.3, h: 0.3 } },
  { key: 'left', label: 'Hälfte links', rect: { x: 0, y: 0, w: 0.5, h: 1 } },
  { key: 'right', label: 'Hälfte rechts', rect: { x: 0.5, y: 0, w: 0.5, h: 1 } },
];

function rectKey(r: { x: number; y: number; w: number; h: number }): string {
  return `${r.x.toFixed(2)},${r.y.toFixed(2)},${r.w.toFixed(2)},${r.h.toFixed(2)}`;
}
const PRESET_BY_KEY = new Map(LAYER_PRESETS.map((p) => [rectKey(p.rect), p.key]));
function currentPreset(l: LayerInfo): string {
  return PRESET_BY_KEY.get(rectKey(l)) ?? 'custom';
}

export function SwitcherView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const engineRef = useRef<SwitcherEngine | null>(null);
  if (!engineRef.current) engineRef.current = new SwitcherEngine();
  const engine = engineRef.current;

  const previewRef = useRef<HTMLCanvasElement>(null);
  const programRef = useRef<HTMLCanvasElement>(null);
  const ndiPortsRef = useRef<Map<string, MessagePort>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<AudioController | null>(null);
  if (!audioRef.current) audioRef.current = new AudioController();
  const audio = audioRef.current;
  const outputRef = useRef<OutputController | null>(null);
  if (!outputRef.current) {
    outputRef.current = new OutputController(
      () => programRef.current,
      () => audio.getOutputTrack(),
    );
  }
  const output = outputRef.current;
  const [outputState, setOutputState] = useState<OutputState>(() => output.getState());

  // NDI-Ausgabe (Program oder Multiview als NDI-Quelle). Die Quellwahl wird über
  // einen Ref gelesen, weil der Controller nur einmal erzeugt wird.
  const ndiSourceRef = useRef<'program' | 'multiview'>('program');
  const ndiOutRef = useRef<NdiOutputController | null>(null);
  if (!ndiOutRef.current) {
    ndiOutRef.current = new NdiOutputController(
      () => (ndiSourceRef.current === 'multiview' ? engine.getMultiviewCanvas() : programRef.current),
      // Programm-Ton mit ausspielen (derselbe Track wie Aufnahme/RTMP) → NDI-Quelle ist nicht mehr stumm.
      () => audio.getOutputTrack(),
    );
  }
  const ndiOut = ndiOutRef.current;
  const [ndiOutState, setNdiOutState] = useState<NdiOutputState>(() => ndiOut.getState());
  const [showMultiview, setShowMultiview] = useState(false);

  const rtmpUrl = useSettings((s) => s.rtmpUrl);
  const streamBitrateKbps = useSettings((s) => s.streamBitrateKbps);
  const recordBitrateKbps = useSettings((s) => s.recordBitrateKbps);
  const controlEnabled = useSettings((s) => s.controlEnabled);
  const controlPort = useSettings((s) => s.controlPort);
  const audioInputId = useSettings((s) => s.audioInputId);
  const ndiOutputName = useSettings((s) => s.ndiOutputName);
  const ndiOutputSource = useSettings((s) => s.ndiOutputSource);
  const setNdiOutputSource = useSettings((s) => s.setNdiOutputSource);
  const firstControlRun = useRef(true);
  const [state, setState] = useState<EngineState>(() => engine.getState());
  const [picker, setPicker] = useState(false);
  const [ndiPicker, setNdiPicker] = useState(false);
  const [capturePicker, setCapturePicker] = useState(false);
  const [ndiStatusById, setNdiStatusById] = useState<Record<string, NdiStatus['state']>>({});
  const [notice, setNotice] = useState<string | null>(null);

  // Projekt speichern/öffnen (#89): aktuelle Datei + Metadaten (id/createdAt).
  const projectRef = useRef<SwitcherProject | null>(null);
  if (!projectRef.current) projectRef.current = makeEmptyProject();
  const [projectName, setProjectName] = useState(projectRef.current.name);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  // Beim „neu verbinden" einer offline screen/capture-Quelle: Ziel-Source-ID für
  // den nächsten Picker-Pick (dann attachStream statt add).
  const reconnectTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (previewRef.current && programRef.current) {
      engine.attach(previewRef.current, programRef.current);
    }
    const unsub = engine.subscribe(() => setState(engine.getState()));
    setState(engine.getState());
    output.attach();
    const unsubOut = output.subscribe(() => setOutputState(output.getState()));
    setOutputState(output.getState());
    // Fenster-Listener + Status-Abo der NDI-Ausgabe hier (nicht im Konstruktor) aufsetzen: die Cleanup
    // unten ruft `destroy()`, und StrictMode/HMR lassen den Effekt danach erneut laufen. Ohne dieses
    // attach() bliebe der Controller ohne Frame-Port zurück und der NDI-Sender sendete nie ein Bild.
    ndiOut.attach();
    const unsubNdi = ndiOut.subscribe(() => setNdiOutState(ndiOut.getState()));
    setNdiOutState(ndiOut.getState());
    return () => {
      unsub();
      unsubOut();
      unsubNdi();
      ndiOut.destroy();
      output.destroy();
      audio.destroy();
      engine.destroy();
    };
  }, [engine, output, audio, ndiOut]);

  // Quellwahl der NDI-Ausgabe in den Ref spiegeln (Controller liest ihn live).
  useEffect(() => {
    ndiSourceRef.current = ndiOutputSource;
  }, [ndiOutputSource]);

  // Multiview nur rendern, wenn gebraucht: Vorschau offen ODER NDI-Multiview aktiv.
  useEffect(() => {
    const need = showMultiview || (ndiOutState.active && ndiOutputSource === 'multiview');
    engine.setMultiviewActive(need);
  }, [engine, showMultiview, ndiOutState.active, ndiOutputSource]);

  // Tally (REC/LIVE) ans Multiview weiterreichen.
  useEffect(() => {
    engine.setMultiviewTally({ recording: outputState.recording, streaming: outputState.streaming });
  }, [engine, outputState.recording, outputState.streaming]);

  // Programm-Audioquelle gemäß Einstellungen setzen.
  useEffect(() => {
    void audio.setDevice(audioInputId);
  }, [audio, audioInputId]);

  // NDI: Status (je recvId) + ein Frame-MessagePort pro Empfänger.
  useEffect(() => {
    const ports = ndiPortsRef.current;
    void window.jmswitch.ndi.getStatus().then((arr) => {
      setNdiStatusById(Object.fromEntries(arr.map((s) => [s.recvId, s.state])));
    });
    const offStatus = window.jmswitch.ndi.onStatus((s) => {
      setNdiStatusById((prev) => {
        const next = { ...prev };
        if (s.state === 'idle') delete next[s.recvId];
        else next[s.recvId] = s.state;
        return next;
      });
      if (s.state === 'error' && s.source) setNotice(`NDI: ${s.source}`);
    });

    const onMessage = (e: MessageEvent): void => {
      const data = e.data as { kind?: string; recvId?: string } | null;
      if (!data || data.kind !== 'jmswitch:ndi-port' || !data.recvId || !e.ports[0]) return;
      const recvId = data.recvId;
      const port = e.ports[0];
      ports.get(recvId)?.close?.(); // alten Port dieser recvId ablösen
      ports.set(recvId, port);
      port.onmessage = (ev: MessageEvent): void => {
        const m = ev.data as NdiVideoMessage | null;
        if (m && m.type === 'video') {
          engine.updateNdiFrame(recvId, m.data, m.width, m.height, m.lineStride);
        }
        port.postMessage({ type: 'ack' }); // immer bestätigen → Utility liefert weiter
      };
      port.start();
    };
    window.addEventListener('message', onMessage);

    return () => {
      offStatus();
      window.removeEventListener('message', onMessage);
      for (const p of ports.values()) {
        p.onmessage = null;
        try {
          p.close();
        } catch {
          // egal
        }
      }
      ports.clear();
    };
  }, [engine]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (outputState.error) setNotice(outputState.error);
  }, [outputState.error]);

  const toggleRecording = (): void => {
    if (outputState.recording) output.stopRecording();
    else void output.startRecording(recordBitrateKbps);
  };
  const toggleStreaming = (): void => {
    if (outputState.streaming) output.stopStreaming();
    else void output.startStreaming(rtmpUrl, streamBitrateKbps);
  };
  const toggleNdiOutput = (): void => {
    if (ndiOutState.active) void ndiOut.stop();
    else void ndiOut.start(ndiOutputName.trim() || 'JM Switcher');
  };

  // Fernsteuer-Befehle (TCP/Companion) auf Engine/Output anwenden.
  useEffect(() => {
    return window.jmswitch.control.onCommand((cmd) => {
      const scenes = engine.getState().scenes;
      switch (cmd.type) {
        case 'preview': {
          const sc = scenes[cmd.scene - 1];
          if (sc) engine.setPreviewScene(sc.id);
          break;
        }
        case 'program': {
          const sc = scenes[cmd.scene - 1];
          if (sc) engine.setProgramScene(sc.id);
          break;
        }
        case 'cut':
          engine.cut();
          break;
        case 'auto':
          engine.auto(cmd.ms);
          break;
        case 'record':
          if (cmd.on) void output.startRecordingAuto(useSettings.getState().recordBitrateKbps);
          else output.stopRecording();
          break;
        case 'stream':
          if (cmd.on) {
            const s = useSettings.getState();
            void output.startStreaming(s.rtmpUrl, s.streamBitrateKbps);
          } else {
            output.stopStreaming();
          }
          break;
      }
    });
  }, [engine, output]);

  // Show-Integration (C3): per .jmshow referenziertes .jmswitch-Projekt laden —
  // dieselbe Anwende-Logik wie beim manuellen „Öffnen".
  useEffect(() => {
    return window.jmswitch.project.onOpened((res) => applyProject(res.project, res.path));
    // applyProject nutzt nur stabile Engine-/State-Setter → einmalig abonnieren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switcher-Zustand bei jeder Änderung an den Steuerserver melden (Feedback).
  useEffect(() => {
    const idx = (id: string | null): number => {
      const i = state.scenes.findIndex((s) => s.id === id);
      return i < 0 ? 0 : i + 1;
    };
    window.jmswitch.control.pushState({
      program: idx(state.programSceneId),
      preview: idx(state.previewSceneId),
      recording: outputState.recording,
      streaming: outputState.streaming,
      scenes: state.scenes.length,
    });
  }, [state, outputState]);

  // Steuerserver gemäß Einstellungen starten/stoppen. Beim allerersten Lauf nicht
  // stoppen (sonst würde ein per Env (JMSWITCH_CONTROL_PORT) gestarteter Server gekillt).
  useEffect(() => {
    if (controlEnabled) {
      void window.jmswitch.control.start(controlPort).then((r) => {
        if (!r.ok) setNotice(`Steuerserver konnte nicht starten: ${r.error ?? ''}`);
      });
    } else if (!firstControlRun.current) {
      void window.jmswitch.control.stop();
    }
    firstControlRun.current = false;
  }, [controlEnabled, controlPort]);

  const previewScene = state.scenes.find((s) => s.id === state.previewSceneId) ?? null;
  const programScene = state.scenes.find((s) => s.id === state.programSceneId) ?? null;
  const canTake = state.previewSceneId != null;
  const canAuto =
    state.previewSceneId != null && state.previewSceneId !== state.programSceneId && !state.transitioning;

  const addColor = (): void => {
    const n = state.sources.filter((s) => s.kind === 'color').length;
    engine.addColor(`Farbe ${n + 1}`, PALETTE[n % PALETTE.length]);
  };

  const pickScreen = async (screen: ScreenSourceInfo): Promise<void> => {
    setPicker(false);
    const target = reconnectTargetRef.current;
    reconnectTargetRef.current = null;
    try {
      await window.jmswitch.armCapture(screen.id);
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      if (target) engine.attachStream(target, stream);
      else engine.addScreenStream(screen.name, stream);
    } catch (e) {
      setNotice(`Bildschirm konnte nicht aufgenommen werden: ${(e as Error).message}`);
    }
  };

  const pickCapture = async (device: MediaDeviceInfo): Promise<void> => {
    setCapturePicker(false);
    const target = reconnectTargetRef.current;
    reconnectTargetRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: device.deviceId } },
        audio: false,
      });
      if (target) engine.attachStream(target, stream);
      else engine.addCaptureStream(device.label || 'Capture-Gerät', stream);
    } catch (e) {
      setNotice(`Capture-Gerät konnte nicht geöffnet werden: ${(e as Error).message}`);
    }
  };

  // ── Projekt speichern/öffnen (#89) ───────────────────────────────────────────
  const disconnectAllNdi = (): void => {
    for (const s of engine.getState().sources) {
      if (s.kind !== 'ndi') continue;
      void window.jmswitch.ndi.disconnect(s.id);
      const p = ndiPortsRef.current.get(s.id);
      if (p) {
        p.onmessage = null;
        try {
          p.close();
        } catch {
          // egal
        }
        ndiPortsRef.current.delete(s.id);
      }
    }
  };

  const applyProject = (project: SwitcherProject, path: string | null): void => {
    disconnectAllNdi();
    engine.loadContent(project);
    projectRef.current = project;
    setProjectName(project.name);
    setProjectPath(path);
    // NDI-Quellen automatisch wieder verbinden (recvId = Source-id).
    for (const s of project.sources) {
      if (s.kind === 'ndi') void window.jmswitch.ndi.connect(s.id, s.name).catch(() => {});
    }
  };

  const newProject = (): void => {
    if (
      (state.sources.length > 0 || state.scenes.length > 0) &&
      !window.confirm('Neues Projekt anlegen? Nicht gespeicherte Änderungen gehen verloren.')
    ) {
      return;
    }
    disconnectAllNdi();
    engine.loadContent(emptyContent());
    projectRef.current = makeEmptyProject();
    setProjectName(projectRef.current.name);
    setProjectPath(null);
  };

  const openProject = async (): Promise<void> => {
    try {
      const res = await window.jmswitch.project.open();
      if (res) applyProject(res.project, res.path);
    } catch (e) {
      setNotice(`Projekt konnte nicht geöffnet werden: ${(e as Error).message}`);
    }
  };

  const saveProject = async (saveAs: boolean): Promise<void> => {
    const meta = projectRef.current ?? makeEmptyProject();
    const project: SwitcherProject = {
      ...meta,
      ...engine.serialize(),
      name: projectName.trim() || 'Unbenanntes Projekt',
      updatedAt: new Date().toISOString(),
    };
    try {
      const res = await window.jmswitch.project.save({
        project,
        path: saveAs ? undefined : projectPath ?? undefined,
      });
      if (res) {
        projectRef.current = project;
        setProjectPath(res.path);
        setNotice('Projekt gespeichert.');
      }
    } catch (e) {
      setNotice(`Speichern fehlgeschlagen: ${(e as Error).message}`);
    }
  };

  /** Offline screen/capture-Quelle wieder an eine Live-Quelle koppeln. */
  const reconnectSource = (id: string): void => {
    const src = state.sources.find((s) => s.id === id);
    if (!src) return;
    reconnectTargetRef.current = id;
    if (src.kind === 'screen') setPicker(true);
    else if (src.kind === 'capture') setCapturePicker(true);
    else reconnectTargetRef.current = null;
  };

  const addScene = (): void => {
    engine.addScene(`Szene ${state.scenes.length + 1}`);
  };

  const connectNdi = async (source: string): Promise<void> => {
    setNdiPicker(false);
    // Jede NDI-Quelle = eigener Empfänger (recvId = Engine-Source-id).
    const id = engine.addNdiSource(source);
    try {
      await window.jmswitch.ndi.connect(id, source);
    } catch (e) {
      engine.removeSource(id);
      setNotice(`NDI-Verbindung fehlgeschlagen: ${(e as Error).message}`);
    }
  };

  const removeSource = (id: string): void => {
    const src = state.sources.find((s) => s.id === id);
    if (src?.kind === 'ndi') {
      void window.jmswitch.ndi.disconnect(id);
      const p = ndiPortsRef.current.get(id);
      if (p) {
        p.onmessage = null;
        try {
          p.close();
        } catch {
          // egal
        }
        ndiPortsRef.current.delete(id);
      }
    }
    engine.removeSource(id);
  };

  const addImageFiles = async (files: FileList | null): Promise<void> => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        engine.addImageSource(file.name.replace(/\.[^.]+$/, ''), dataUrl);
      } catch (e) {
        setNotice(`Bild konnte nicht geladen werden: ${(e as Error).message}`);
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Projekt-Leiste (#89) */}
      <div className="shrink-0 flex items-center gap-2 px-6 py-1.5 border-b border-[var(--border)]/50 bg-[var(--card)]/20">
        <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--muted-foreground)]">
          Projekt
        </span>
        <span className="text-sm font-semibold truncate max-w-[320px]" title={projectPath ?? 'Nicht gespeichert'}>
          {projectName}
        </span>
        {!projectPath && <span className="text-[10px] text-[var(--muted-foreground)]">· ungespeichert</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={newProject}>
            Neu
          </Button>
          <Button size="sm" variant="outline" onClick={() => void openProject()}>
            Öffnen…
          </Button>
          <Button size="sm" variant="outline" onClick={() => void saveProject(false)}>
            Speichern
          </Button>
          <Button size="sm" variant="outline" onClick={() => void saveProject(true)}>
            Speichern unter…
          </Button>
        </div>
      </div>

      {/* Monitore + Transition */}
      <div className="flex-1 min-h-0 flex items-stretch gap-5 px-6 py-5">
        <Monitor label="Preview" tone="preview" canvasRef={previewRef} sceneName={previewScene?.name}>
          {previewScene && previewScene.layers.length > 0 && (
            <LayerEditor scene={previewScene} sources={state.sources} engine={engine} />
          )}
        </Monitor>

        <div className="shrink-0 flex flex-col items-center justify-center gap-3 w-28">
          <button
            type="button"
            disabled={!canTake}
            onClick={() => engine.cut()}
            className={cn(
              'w-full h-14 rounded-[var(--radius)] font-extrabold uppercase tracking-wide',
              'border-2 border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)]',
              'disabled:opacity-40 disabled:cursor-not-allowed transition-colors',
            )}
          >
            Cut
          </button>
          <button
            type="button"
            disabled={!canAuto}
            onClick={() => engine.auto()}
            className={cn(
              'w-full h-14 rounded-[var(--radius)] font-extrabold uppercase tracking-wide',
              'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90',
              'disabled:opacity-40 disabled:cursor-not-allowed transition-opacity',
            )}
          >
            Auto
          </button>
          <label className="flex flex-col items-center gap-1 text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)]">
            Dauer
            <span className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                step={50}
                value={state.autoMs}
                onChange={(e) => engine.setAutoMs(Number(e.target.value))}
                className="h-8 w-16 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-sm text-center tabular text-[var(--foreground)]"
              />
              <span>ms</span>
            </span>
          </label>
        </div>

        <Monitor label="Program" tone="program" canvasRef={programRef} sceneName={programScene?.name} />
      </div>

      {/* Aufnahme / RTMP-Stream des Program-Outputs */}
      <OutputBar
        state={outputState}
        rtmpUrl={rtmpUrl}
        audio={audio}
        ndiState={ndiOutState}
        ndiSource={ndiOutputSource}
        onSetNdiSource={setNdiOutputSource}
        onToggleNdi={toggleNdiOutput}
        onOpenMultiview={() => setShowMultiview(true)}
        onOpenSettings={onOpenSettings}
        onToggleRecording={toggleRecording}
        onToggleStreaming={toggleStreaming}
      />

      {/* Szenen / Ebenen / Quellen */}
      <div className="shrink-0 h-[300px] border-t border-[var(--border)]/60 grid grid-cols-[1fr_1.4fr_1fr] divide-x divide-[var(--border)]/60">
        <ScenesPanel
          scenes={state.scenes}
          previewId={state.previewSceneId}
          programId={state.programSceneId}
          onSelect={(id) => engine.setPreviewScene(id)}
          onRemove={(id) => engine.removeScene(id)}
          onRename={(id, name) => engine.renameScene(id, name)}
          onAdd={addScene}
        />
        <LayersPanel
          scene={previewScene}
          sources={state.sources}
          engine={engine}
        />
        <SourcesPanel
          sources={state.sources}
          canAddLayer={previewScene != null}
          ndiStatusById={ndiStatusById}
          onAddColor={addColor}
          onAddScreen={() => {
            reconnectTargetRef.current = null;
            setPicker(true);
          }}
          onAddNdi={() => setNdiPicker(true)}
          onAddCapture={() => {
            reconnectTargetRef.current = null;
            setCapturePicker(true);
          }}
          onAddImage={() => fileInputRef.current?.click()}
          onSetColor={(id, color) => engine.setSourceColor(id, color)}
          onRename={(id, name) => engine.renameSource(id, name)}
          onAddToScene={(sourceId) => previewScene && engine.addLayer(previewScene.id, sourceId)}
          onReconnect={reconnectSource}
          onRemove={removeSource}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void addImageFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {showMultiview && <MultiviewOverlay engine={engine} onClose={() => setShowMultiview(false)} />}

      {picker && (
        <ScreenPicker
          onPick={(s) => void pickScreen(s)}
          onClose={() => {
            setPicker(false);
            reconnectTargetRef.current = null;
          }}
        />
      )}
      {ndiPicker && <NdiPicker onPick={(s) => void connectNdi(s)} onClose={() => setNdiPicker(false)} />}
      {capturePicker && (
        <CapturePicker
          onPick={(d) => void pickCapture(d)}
          onClose={() => {
            setCapturePicker(false);
            reconnectTargetRef.current = null;
          }}
        />
      )}

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 flex justify-center px-6">
          <div className="pointer-events-auto rounded-[var(--radius-lg)] border border-[var(--primary)]/40 bg-[var(--card)] px-4 py-2.5 text-sm font-semibold shadow-lg max-w-2xl text-center">
            {notice}
          </div>
        </div>
      )}
    </div>
  );
}

function OutputBar({
  state,
  rtmpUrl,
  audio,
  ndiState,
  ndiSource,
  onSetNdiSource,
  onToggleNdi,
  onOpenMultiview,
  onOpenSettings,
  onToggleRecording,
  onToggleStreaming,
}: {
  state: OutputState;
  rtmpUrl: string;
  audio: AudioController;
  ndiState: NdiOutputState;
  ndiSource: 'program' | 'multiview';
  onSetNdiSource: (v: 'program' | 'multiview') => void;
  onToggleNdi: () => void;
  onOpenMultiview: () => void;
  onOpenSettings: () => void;
  onToggleRecording: () => void;
  onToggleStreaming: () => void;
}) {
  const recName = state.recPath ? state.recPath.replace(/^.*[\\/]/, '') : null;
  const hasTarget = rtmpUrl.trim().length > 0;
  return (
    <div className="shrink-0 flex items-center gap-3 px-6 h-14 border-t border-[var(--border)]/60">
      <button
        type="button"
        onClick={onToggleRecording}
        className={cn(
          'h-9 px-3.5 rounded-[var(--radius)] text-sm font-extrabold uppercase tracking-wide inline-flex items-center gap-2 transition-colors border-2',
          state.recording
            ? 'bg-[var(--destructive)] text-[var(--destructive-foreground)] border-[var(--destructive)]'
            : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)]',
        )}
      >
        <span className={cn('size-2.5 rounded-full', state.recording ? 'bg-white animate-pulse' : 'bg-[var(--destructive)]')} />
        {state.recording ? 'Aufnahme stoppen' : 'Aufnehmen'}
      </button>

      <button
        type="button"
        onClick={onToggleStreaming}
        disabled={!state.streaming && !hasTarget}
        title={!hasTarget ? 'Stream-Ziel in den Einstellungen festlegen' : undefined}
        className={cn(
          'h-9 px-3.5 rounded-[var(--radius)] text-sm font-extrabold uppercase tracking-wide inline-flex items-center gap-2 transition-colors border-2 shrink-0',
          state.streaming
            ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]'
            : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)] disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      >
        <span className={cn('size-2.5 rounded-full', state.streaming ? 'bg-white animate-pulse' : 'bg-[var(--primary)]')} />
        {state.streaming ? 'Stream stoppen' : 'Stream starten'}
      </button>

      {/* NDI-Ausgabe: Program oder Multiview als NDI-Quelle ins Studio-LAN. */}
      <div className="shrink-0 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleNdi}
          title="Program/Multiview als NDI-Quelle senden (TriCaster, vMix, OBS, NDI-Monitor)"
          className={cn(
            'h-9 px-3 rounded-[var(--radius)] text-sm font-extrabold uppercase tracking-wide inline-flex items-center gap-2 transition-colors border-2',
            ndiState.active
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]'
              : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)]',
          )}
        >
          <span className={cn('size-2.5 rounded-full', ndiState.active ? 'bg-white animate-pulse' : 'bg-[var(--primary)]')} />
          NDI
        </button>
        <select
          value={ndiSource}
          onChange={(e) => onSetNdiSource(e.target.value as 'program' | 'multiview')}
          title="Was als NDI-Quelle ausgegeben wird"
          className="h-9 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-1.5 text-xs font-semibold"
        >
          <option value="program">Program</option>
          <option value="multiview">Multiview</option>
        </select>
        {ndiState.active && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted-foreground)] tabular">
            {ndiState.connections} ▸
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenMultiview}
        title="Multiview anzeigen (alle Szenen + Program/Preview)"
        className="h-9 px-3 rounded-[var(--radius)] text-sm font-bold border-2 border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)] transition-colors shrink-0"
      >
        Multiview
      </button>

      <AudioStrip controller={audio} onOpenSettings={onOpenSettings} />

      <div className="flex-1 min-w-0 text-xs">
        {hasTarget ? (
          <span className="text-[var(--muted-foreground)] truncate block" title={rtmpUrl}>
            Ziel: <span className="font-semibold text-[var(--foreground)]">{rtmpUrl}</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-[var(--muted-foreground)] hover:text-[var(--primary)] underline underline-offset-2"
          >
            Stream-Ziel in den Einstellungen festlegen →
          </button>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wide">
        {state.recording && (
          <span className="text-[var(--destructive)] truncate max-w-[220px]" title={state.recPath ?? ''}>
            ● REC {recName}
          </span>
        )}
        {state.streaming && <span className="text-[var(--primary)]">● LIVE</span>}
      </div>
    </div>
  );
}

const MIN_LAYER = 0.05;
const CORNERS = ['nw', 'ne', 'sw', 'se'] as const;
type Corner = (typeof CORNERS)[number];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function cornerStyle(c: Corner): React.CSSProperties {
  const s: React.CSSProperties = { position: 'absolute' };
  if (c[0] === 'n') s.top = -6;
  else s.bottom = -6;
  if (c[1] === 'w') s.left = -6;
  else s.right = -6;
  s.cursor = c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize';
  return s;
}

/** Interaktives Overlay über dem Preview-Monitor: Ebenen ziehen + skalieren. */
function LayerEditor({
  scene,
  sources,
  engine,
}: {
  scene: SceneInfo;
  sources: SourceInfo[];
  engine: SwitcherEngine;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{
    id: string;
    mode: 'move' | Corner;
    sx: number;
    sy: number;
    cw: number;
    ch: number;
    rect: Rect;
  } | null>(null);

  const nameOf = (id: string): string => sources.find((s) => s.id === id)?.name ?? '—';

  const onMove = (e: PointerEvent): void => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / d.cw;
    const dy = (e.clientY - d.sy) / d.ch;
    let { x, y, w, h } = d.rect;
    if (d.mode === 'move') {
      x = clamp(d.rect.x + dx, 0, 1 - w);
      y = clamp(d.rect.y + dy, 0, 1 - h);
    } else {
      if (d.mode.includes('e')) w = clamp(d.rect.w + dx, MIN_LAYER, 1 - d.rect.x);
      if (d.mode.includes('s')) h = clamp(d.rect.h + dy, MIN_LAYER, 1 - d.rect.y);
      if (d.mode.includes('w')) {
        const nx = clamp(d.rect.x + dx, 0, d.rect.x + d.rect.w - MIN_LAYER);
        x = nx;
        w = d.rect.x + d.rect.w - nx;
      }
      if (d.mode.includes('n')) {
        const ny = clamp(d.rect.y + dy, 0, d.rect.y + d.rect.h - MIN_LAYER);
        y = ny;
        h = d.rect.y + d.rect.h - ny;
      }
    }
    engine.setLayerRect(scene.id, d.id, { x, y, w, h });
  };

  const onUp = (): void => {
    drag.current = null;
    window.removeEventListener('pointermove', onMove);
  };

  const begin = (e: React.PointerEvent, layer: LayerInfo, mode: 'move' | Corner): void => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(layer.id);
    const cont = ref.current?.getBoundingClientRect();
    if (!cont || cont.width === 0) return;
    drag.current = {
      id: layer.id,
      mode,
      sx: e.clientX,
      sy: e.clientY,
      cw: cont.width,
      ch: cont.height,
      rect: { x: layer.x, y: layer.y, w: layer.w, h: layer.h },
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  return (
    <div
      ref={ref}
      className="absolute inset-0"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setSelected(null);
      }}
    >
      {scene.layers.map(
        (layer) =>
          layer.visible && (
            <div
              key={layer.id}
              onPointerDown={(e) => begin(e, layer, 'move')}
              className={cn(
                'absolute border touch-none cursor-move',
                selected === layer.id
                  ? 'border-[var(--primary)]'
                  : 'border-white/40 hover:border-white/70',
              )}
              style={{
                left: `${layer.x * 100}%`,
                top: `${layer.y * 100}%`,
                width: `${layer.w * 100}%`,
                height: `${layer.h * 100}%`,
              }}
            >
              <span className="absolute top-0 left-0 px-1 text-[9px] font-bold bg-black/60 text-white truncate max-w-full pointer-events-none">
                {nameOf(layer.sourceId)}
              </span>
              {selected === layer.id &&
                CORNERS.map((c) => (
                  <div
                    key={c}
                    onPointerDown={(e) => begin(e, layer, c)}
                    className="size-3 rounded-sm bg-[var(--primary)] border border-black touch-none"
                    style={cornerStyle(c)}
                  />
                ))}
            </div>
          ),
      )}
    </div>
  );
}

function meterColor(level: number): string {
  if (level >= 0.85) return 'var(--destructive)';
  if (level >= 0.6) return 'var(--warning)';
  return 'var(--success)';
}

function AudioStrip({
  controller,
  onOpenSettings,
}: {
  controller: AudioController;
  onOpenSettings: () => void;
}) {
  const [s, setS] = useState<AudioState>(() => controller.getState());
  useEffect(() => controller.subscribe(() => setS(controller.getState())), [controller]);

  const shown = Math.min(1, s.level * 2.5); // RMS perzeptiv skalieren
  const pct = Math.round(shown * 100);

  if (!s.hasDevice) {
    return (
      <button
        type="button"
        onClick={onOpenSettings}
        title="Programm-Audioquelle in den Einstellungen wählen"
        className="shrink-0 flex items-center gap-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)]"
      >
        <SpeakerIcon muted />
        <span className="hidden md:inline underline underline-offset-2">Ton wählen</span>
      </button>
    );
  }

  return (
    <div className="shrink-0 flex items-center gap-2">
      <button
        type="button"
        onClick={() => controller.setMuted(!s.muted)}
        title={s.muted ? 'Stummschaltung aufheben' : 'Stummschalten'}
        className={cn('shrink-0', s.muted ? 'text-[var(--destructive)]' : 'text-[var(--foreground)]')}
      >
        <SpeakerIcon muted={s.muted} />
      </button>
      <div className="w-24 h-2 rounded-full bg-[var(--input)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-75"
          style={{ width: `${s.muted ? 0 : pct}%`, background: meterColor(shown) }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={1.5}
        step={0.01}
        value={s.gain}
        onChange={(e) => controller.setGain(Number(e.target.value))}
        title="Pegel"
        className="w-20 accent-[var(--primary)]"
      />
    </div>
  );
}

function SpeakerIcon({ muted }: { muted?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      {muted ? (
        <path d="M23 9l-6 6M17 9l6 6" />
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

function Monitor({
  label,
  tone,
  canvasRef,
  sceneName,
  children,
}: {
  label: string;
  tone: 'preview' | 'program';
  canvasRef: React.RefObject<HTMLCanvasElement>;
  sceneName?: string;
  children?: React.ReactNode;
}) {
  const accent = tone === 'program' ? 'var(--destructive)' : 'var(--success)';
  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
      <div className="shrink-0 flex items-center justify-between">
        <span className="text-xs font-extrabold uppercase tracking-[0.14em]" style={{ color: accent }}>
          {label}
        </span>
        <span className="text-[11px] text-[var(--muted-foreground)] truncate ml-3">{sceneName ?? '—'}</span>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div
          className="relative w-full max-h-full aspect-video rounded-[var(--radius-lg)] overflow-hidden bg-black border-2"
          style={{ borderColor: accent }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain" />
          {children}
        </div>
      </div>
    </div>
  );
}

function PanelHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 h-11 border-b border-[var(--border)]/60 shrink-0">
      <span className="text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
        {title}
      </span>
      <div className="ml-auto flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function ScenesPanel({
  scenes,
  previewId,
  programId,
  onSelect,
  onRemove,
  onRename,
  onAdd,
}: {
  scenes: SceneInfo[];
  previewId: string | null;
  programId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onAdd: () => void;
}) {
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);

  return (
    <div className="flex flex-col min-h-0 min-w-0">
      <PanelHead title="Szenen">
        <Button size="sm" variant="outline" onClick={onAdd}>
          + Szene
        </Button>
      </PanelHead>
      <div className="flex-1 overflow-auto scroll-thin p-2 flex flex-col gap-1">
        {scenes.length === 0 && (
          <p className="text-xs text-[var(--muted-foreground)] p-2">Erstelle eine Szene.</p>
        )}
        {scenes.map((sc) => {
          const isProgram = sc.id === programId;
          const isPreview = sc.id === previewId;
          return (
            <div
              key={sc.id}
              onClick={() => onSelect(sc.id)}
              className={cn(
                'group flex items-center gap-2 h-9 px-2.5 rounded-[var(--radius)] cursor-pointer text-sm font-semibold border',
                isPreview ? 'border-[var(--primary)] bg-[var(--highlight)]' : 'border-transparent hover:bg-[var(--highlight)]',
              )}
            >
              {editing?.id === sc.id ? (
                <input
                  autoFocus
                  value={editing.value}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditing({ id: sc.id, value: e.target.value })}
                  onBlur={() => {
                    if (editing.value.trim()) onRename(sc.id, editing.value.trim());
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditing(null);
                  }}
                  className="flex-1 h-7 rounded border border-[var(--border)] bg-[var(--input)] px-2 text-sm"
                />
              ) : (
                <span
                  className="flex-1 min-w-0 truncate"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditing({ id: sc.id, value: sc.name });
                  }}
                >
                  {sc.name}
                </span>
              )}
              {isProgram && (
                <span className="px-1 rounded text-[9px] font-extrabold bg-[var(--destructive)] text-[var(--destructive-foreground)]">
                  PGM
                </span>
              )}
              {isPreview && (
                <span className="px-1 rounded text-[9px] font-extrabold bg-[var(--primary)] text-[var(--primary-foreground)]">
                  PVW
                </span>
              )}
              <button
                type="button"
                title="Szene löschen"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(sc.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
              >
                <XIcon />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LayersPanel({
  scene,
  sources,
  engine,
}: {
  scene: SceneInfo | null;
  sources: SourceInfo[];
  engine: SwitcherEngine;
}) {
  const display = scene ? [...scene.layers].reverse() : []; // vorn = oben
  const nameOf = (id: string): string => sources.find((s) => s.id === id)?.name ?? '—';

  return (
    <div className="flex flex-col min-h-0 min-w-0">
      <PanelHead title={scene ? `Ebenen · ${scene.name}` : 'Ebenen'} />
      <div className="flex-1 overflow-auto scroll-thin p-2 flex flex-col gap-1">
        {!scene && <p className="text-xs text-[var(--muted-foreground)] p-2">Keine Szene gewählt.</p>}
        {scene && display.length === 0 && (
          <p className="text-xs text-[var(--muted-foreground)] p-2">
            Klick rechts eine Quelle, um sie als Ebene hinzuzufügen (1. Ebene = Vollbild, weitere = PiP).
          </p>
        )}
        {scene &&
          display.map((layer, di) => {
            const isFront = di === 0;
            const isBack = di === display.length - 1;
            const srcKind = sources.find((s) => s.id === layer.sourceId)?.kind;
            const canKey = srcKind === 'ndi' || srcKind === 'image' || srcKind === 'capture' || srcKind === 'screen';
            const key = layer.key;
            return (
              <div
                key={layer.id}
                className="flex flex-col rounded-[var(--radius)] border border-[var(--border)]/60 bg-[var(--card)]/40"
              >
                <div className="flex items-center gap-2 h-9 px-2">
                  <button
                    type="button"
                    title={layer.visible ? 'Ebene ausblenden' : 'Ebene einblenden'}
                    onClick={() => engine.setLayerVisible(scene.id, layer.id, !layer.visible)}
                    className={cn('shrink-0', layer.visible ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]/40')}
                  >
                    <EyeIcon off={!layer.visible} />
                  </button>
                  <span className="flex-1 min-w-0 truncate text-sm font-semibold">{nameOf(layer.sourceId)}</span>
                  <select
                    value={currentPreset(layer)}
                    onChange={(e) => {
                      const p = LAYER_PRESETS.find((x) => x.key === e.target.value);
                      if (p) engine.setLayerRect(scene.id, layer.id, p.rect);
                    }}
                    className="h-7 rounded border border-[var(--border)] bg-[var(--input)] px-1.5 text-xs"
                  >
                    {currentPreset(layer) === 'custom' && <option value="custom">Eigene</option>}
                    {LAYER_PRESETS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  {canKey && (
                    <button
                      type="button"
                      title="Chroma-Key (Greenscreen)"
                      onClick={() => engine.setLayerKey(scene.id, layer.id, { enabled: !key?.enabled })}
                      className={cn(
                        'shrink-0 h-6 px-1.5 rounded text-[10px] font-extrabold border',
                        key?.enabled
                          ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]'
                          : 'border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
                      )}
                    >
                      KEY
                    </button>
                  )}
                  <button
                    type="button"
                    title="nach vorn"
                    disabled={isFront}
                    onClick={() => engine.moveLayer(scene.id, layer.id, 1)}
                    className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30"
                  >
                    <ArrowIcon up />
                  </button>
                  <button
                    type="button"
                    title="nach hinten"
                    disabled={isBack}
                    onClick={() => engine.moveLayer(scene.id, layer.id, -1)}
                    className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30"
                  >
                    <ArrowIcon />
                  </button>
                  <button
                    type="button"
                    title="Ebene entfernen"
                    onClick={() => engine.removeLayer(scene.id, layer.id)}
                    className="shrink-0 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                  >
                    <XIcon />
                  </button>
                </div>
                {canKey && key?.enabled && (
                  <div className="flex items-center gap-3 px-2 pb-2 pt-0.5 flex-wrap">
                    <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-bold text-[var(--muted-foreground)]">
                      Farbe
                      <input
                        type="color"
                        value={key.color}
                        onChange={(e) => engine.setLayerKey(scene.id, layer.id, { color: e.target.value })}
                        className="size-6 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-bold text-[var(--muted-foreground)]">
                      Toleranz
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={key.similarity}
                        onChange={(e) => engine.setLayerKey(scene.id, layer.id, { similarity: Number(e.target.value) })}
                        className="w-24 accent-[var(--primary)]"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-bold text-[var(--muted-foreground)]">
                      Kante
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={key.smoothness}
                        onChange={(e) => engine.setLayerKey(scene.id, layer.id, { smoothness: Number(e.target.value) })}
                        className="w-20 accent-[var(--primary)]"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-bold text-[var(--muted-foreground)]">
                      Spill
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={key.spill ?? 0}
                        onChange={(e) => engine.setLayerKey(scene.id, layer.id, { spill: Number(e.target.value) })}
                        className="w-20 accent-[var(--primary)]"
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

function ndiDotColor(state: NdiStatus['state'] | undefined): string {
  if (state === 'connected') return 'var(--success)';
  if (state === 'error') return 'var(--destructive)';
  if (state === 'connecting') return 'var(--warning)';
  return 'var(--muted-foreground)';
}

function SourcesPanel({
  sources,
  canAddLayer,
  ndiStatusById,
  onAddColor,
  onAddScreen,
  onAddNdi,
  onAddCapture,
  onAddImage,
  onSetColor,
  onRename,
  onAddToScene,
  onReconnect,
  onRemove,
}: {
  sources: SourceInfo[];
  canAddLayer: boolean;
  ndiStatusById: Record<string, NdiStatus['state']>;
  onAddColor: () => void;
  onAddScreen: () => void;
  onAddNdi: () => void;
  onAddCapture: () => void;
  onAddImage: () => void;
  onSetColor: (id: string, color: string) => void;
  onRename: (id: string, name: string) => void;
  onAddToScene: (sourceId: string) => void;
  onReconnect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);

  return (
    <div className="flex flex-col min-h-0 min-w-0">
      <PanelHead title="Quellen-Pool" />
      <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-[var(--border)]/40">
        <Button size="sm" variant="outline" onClick={onAddColor}>
          + Farbe
        </Button>
        <Button size="sm" variant="outline" onClick={onAddScreen}>
          + Bildschirm
        </Button>
        <Button size="sm" variant="outline" onClick={onAddCapture}>
          + Capture
        </Button>
        <Button size="sm" variant="outline" onClick={onAddNdi}>
          + NDI
        </Button>
        <Button size="sm" variant="outline" onClick={onAddImage}>
          + Bild
        </Button>
      </div>
      <div className="flex-1 overflow-auto scroll-thin p-2 flex flex-col gap-1">
        {sources.length === 0 && (
          <p className="text-xs text-[var(--muted-foreground)] p-2">Noch keine Quellen.</p>
        )}
        {sources.map((s) => (
          <div
            key={s.id}
            className="group flex items-center gap-2 h-9 px-2 rounded-[var(--radius)] border border-[var(--border)]/60"
          >
            {s.kind === 'color' ? (
              <input
                type="color"
                value={s.color ?? '#000000'}
                title="Farbe ändern"
                onChange={(e) => onSetColor(s.id, e.target.value)}
                className="size-5 shrink-0 cursor-pointer rounded-sm border border-[var(--border)] bg-transparent p-0"
              />
            ) : (
              <span
                className={cn(
                  'size-4 rounded-sm shrink-0 border border-[var(--border)] grid place-items-center text-[6px] font-extrabold leading-none text-white',
                  s.kind === 'ndi' && 'bg-[var(--primary)] !text-[var(--primary-foreground)]',
                  s.kind === 'image' && 'bg-[var(--success)] !text-black',
                )}
                style={{ background: s.kind === 'screen' || s.kind === 'capture' ? '#333' : undefined }}
              >
                {s.kind === 'ndi'
                  ? 'NDI'
                  : s.kind === 'image'
                    ? 'IMG'
                    : s.kind === 'capture'
                      ? 'CAM'
                      : ''}
              </span>
            )}
            {editing?.id === s.id ? (
              <input
                autoFocus
                value={editing.value}
                onChange={(e) => setEditing({ id: s.id, value: e.target.value })}
                onBlur={() => {
                  if (editing.value.trim()) onRename(s.id, editing.value.trim());
                  setEditing(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setEditing(null);
                }}
                className="flex-1 h-7 rounded border border-[var(--border)] bg-[var(--input)] px-2 text-sm"
              />
            ) : (
              <span
                className="flex-1 min-w-0 truncate text-sm font-semibold"
                title="Doppelklick zum Umbenennen"
                onDoubleClick={() => setEditing({ id: s.id, value: s.name })}
              >
                {s.name}
              </span>
            )}
            {s.kind === 'ndi' && (
              <span
                className="size-2 rounded-full shrink-0"
                title={`NDI: ${ndiStatusById[s.id] ?? 'getrennt'}`}
                style={{ background: ndiDotColor(ndiStatusById[s.id]) }}
              />
            )}
            {s.offline && (
              <button
                type="button"
                title="Quelle ist offline (nach Projekt-Öffnen) — mit einer Live-Quelle neu verbinden"
                onClick={() => onReconnect(s.id)}
                className="shrink-0 h-7 px-2 rounded-[var(--radius)] border border-amber-500/50 text-[10px] font-bold text-amber-500 hover:bg-[var(--highlight)]"
              >
                ⚠ Neu verbinden
              </button>
            )}
            <button
              type="button"
              title={canAddLayer ? 'Als Ebene in Preview-Szene' : 'Erst eine Szene wählen'}
              disabled={!canAddLayer}
              onClick={() => onAddToScene(s.id)}
              className="shrink-0 h-7 px-2 rounded-[var(--radius)] border border-[var(--border)] text-xs font-bold hover:bg-[var(--highlight)] disabled:opacity-40"
            >
              + Ebene
            </button>
            <button
              type="button"
              title="Quelle löschen"
              onClick={() => onRemove(s.id)}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
            >
              <XIcon />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Multiview-Vollbild-Overlay: spiegelt das Multiview-Offscreen-Canvas der Engine
 * (alle Szenen + PGM/PVW). „Vollbild" wirft es per Fullscreen-API auf den Monitor,
 * auf dem das Fenster gerade liegt — so landet die Übersicht auf dem 2. Schirm.
 */
function MultiviewOverlay({ engine, onClose }: { engine: SwitcherEngine; onClose: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let raf = 0;
    const loop = (): void => {
      const dst = canvasRef.current;
      const src = engine.getMultiviewCanvas();
      if (dst && src && src.width > 0) {
        if (dst.width !== src.width || dst.height !== src.height) {
          dst.width = src.width;
          dst.height = src.height;
        }
        const ctx = dst.getContext('2d');
        if (ctx) ctx.drawImage(src, 0, 0);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onFsChange = (): void => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('fullscreenchange', onFsChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [engine]);

  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void wrapRef.current?.requestFullscreen().catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm px-6" onClick={onClose}>
      <div
        ref={wrapRef}
        className="relative w-full max-w-6xl bg-black rounded-[var(--radius-xl)] overflow-hidden border border-[var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <canvas ref={canvasRef} className="w-full h-full aspect-video object-contain bg-[#0a0a0a]" />
        {!fullscreen && (
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={toggleFullscreen}>
              Vollbild
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Schließen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenPicker({
  onPick,
  onClose,
}: {
  onPick: (s: ScreenSourceInfo) => void;
  onClose: () => void;
}) {
  const [screens, setScreens] = useState<ScreenSourceInfo[] | null>(null);

  useEffect(() => {
    let alive = true;
    window.jmswitch
      .listScreens()
      .then((s) => alive && setScreens(s))
      .catch(() => alive && setScreens([]));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-6" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[80vh] overflow-auto scroll-thin rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-extrabold tracking-tight">Bildschirm / Fenster wählen</h2>
        {screens == null ? (
          <p className="text-sm text-[var(--muted-foreground)] mt-4">Lade Quellen…</p>
        ) : screens.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] mt-4">Keine aufnehmbaren Quellen gefunden.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            {screens.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onPick(s)}
                className="text-left rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden hover:border-[var(--primary)]/60 transition-colors"
              >
                <div className="aspect-video bg-black grid place-items-center overflow-hidden">
                  {s.thumbnailDataURL ? (
                    <img src={s.thumbnailDataURL} alt="" className="size-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-[var(--muted-foreground)] uppercase">{s.type}</span>
                  )}
                </div>
                <div className="px-2.5 py-2 text-xs font-semibold truncate">{s.name}</div>
              </button>
            ))}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
}

function NdiPicker({ onPick, onClose }: { onPick: (s: string) => void; onClose: () => void }) {
  // Quellen über mehrere Scans hinweg AKKUMULIEREN (nicht ersetzen): NDI-
  // Discovery ist asynchron, ein einzelner Scan sieht oft nur einen Teil der
  // Geräte. Wir vereinen die Ergebnisse + scannen automatisch ein zweites Mal
  // (Issue #17).
  const [sources, setSources] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  const scanOnce = (): Promise<void> => {
    setScanning(true);
    return window.jmswitch.ndi
      .find(2000)
      .then((list) =>
        setSources((prev) => Array.from(new Set([...prev, ...list])).sort((a, b) => a.localeCompare(b))),
      )
      .catch(() => {})
      .finally(() => {
        setScanning(false);
        setScanned(true);
      });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await scanOnce();
      await new Promise((r) => setTimeout(r, 900));
      if (!cancelled) await scanOnce();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-6" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-auto scroll-thin rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight">NDI-Quelle wählen</h2>
          <Button size="sm" variant="outline" onClick={() => void scanOnce()} disabled={scanning}>
            {scanning ? 'Suche…' : 'Neu suchen'}
          </Button>
        </div>
        <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
          Quellen im Studio-LAN (z. B. JM NDI Screen Capture, TriCaster, vMix). Mehrere gleichzeitig möglich.
        </p>
        {!scanned && sources.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] mt-4">Suche NDI-Quellen…</p>
        ) : sources.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] mt-4">
            Keine NDI-Quellen gefunden. NDI-Sender aktiv? Gleiches Netz?
          </p>
        ) : (
          <div className="flex flex-col gap-2 mt-4">
            {scanning && (
              <p className="text-[11px] text-[var(--muted-foreground)]">Suche läuft… (Geräte erscheinen nach und nach)</p>
            )}
            {sources.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onPick(s)}
                className="text-left rounded-[var(--radius-lg)] border border-[var(--border)] px-3.5 py-2.5 text-sm font-semibold hover:border-[var(--primary)]/60 hover:bg-[var(--highlight)] transition-colors truncate"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
}

function CapturePicker({
  onPick,
  onClose,
}: {
  onPick: (d: MediaDeviceInfo) => void;
  onClose: () => void;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = (): void => {
    setDevices(null);
    setError(null);
    listVideoInputs()
      .then(setDevices)
      .catch((e) => {
        setDevices([]);
        setError((e as Error).message);
      });
  };

  useEffect(() => {
    scan();
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-6" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-auto scroll-thin rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight">Capture-Karte / Kamera wählen</h2>
          <Button size="sm" variant="outline" onClick={scan}>
            Neu suchen
          </Button>
        </div>
        <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
          USB-Capture-Karten (Elgato, Magewell, Grabber) erscheinen als Videogeräte. Reine SDI-Karten
          ohne UVC-Treiber kommen via ffmpeg in v0.2.
        </p>
        {devices == null ? (
          <p className="text-sm text-[var(--muted-foreground)] mt-4">Suche Geräte…</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] mt-4">
            Keine Videogeräte gefunden{error ? ` (${error})` : ''}.
          </p>
        ) : (
          <div className="flex flex-col gap-2 mt-4">
            {devices.map((d, i) => (
              <button
                key={d.deviceId || i}
                type="button"
                onClick={() => onPick(d)}
                className="text-left rounded-[var(--radius-lg)] border border-[var(--border)] px-3.5 py-2.5 text-sm font-semibold hover:border-[var(--primary)]/60 hover:bg-[var(--highlight)] transition-colors truncate"
              >
                {d.label || `Videogerät ${i + 1}`}
              </button>
            ))}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Videogeräte auflisten; bei leeren Labels kurz Permission anfordern (Electron). */
async function listVideoInputs(): Promise<MediaDeviceInfo[]> {
  let devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = (): MediaDeviceInfo[] => devices.filter((d) => d.kind === 'videoinput');
  if (inputs().length === 0 || inputs().every((d) => !d.label)) {
    let probe: MediaStream | null = null;
    try {
      probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      devices = await navigator.mediaDevices.enumerateDevices();
    } finally {
      probe?.getTracks().forEach((t) => t.stop());
    }
  }
  return inputs();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader-Fehler'));
    reader.readAsDataURL(file);
  });
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
function ArrowIcon({ up }: { up?: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={up ? undefined : { transform: 'rotate(180deg)' }}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}
function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

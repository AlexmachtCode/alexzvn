import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Logo, cn, dragRegion, isElectronMac } from '@jm/ui';
import type { JmNdiSource, JmNdiStatus, NdiFps, TrayCommand } from '@shared/types';
import { NDI_FPS_OPTIONS } from '@shared/types';
import { CaptureSession, type CaptureStats } from './core/capture';
import { SourcePicker } from './components/SourcePicker';
import { StatusBar } from './components/StatusBar';
import { Preview } from './components/Preview';

const IDLE_STATUS: JmNdiStatus = { sendState: 'idle', audioEnabled: false };

const FPS_KEY = 'jmndi.targetFps';
function loadFps(): NdiFps {
  try {
    const v = Number(localStorage.getItem(FPS_KEY));
    return (NDI_FPS_OPTIONS as readonly number[]).includes(v) ? (v as NdiFps) : 30;
  } catch {
    return 30;
  }
}

export function App() {
  const [sources, setSources] = useState<JmNdiSource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<JmNdiStatus>(IDLE_STATUS);
  const [stats, setStats] = useState<CaptureStats | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [audioOn, setAudioOn] = useState(true);
  const [targetFps, setTargetFps] = useState<NdiFps>(loadFps);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sessionRef = useRef<CaptureSession | null>(null);
  const framePortRef = useRef<MessagePort | null>(null);
  // #104: Live-Werte als Refs, damit start()/handleFrame und Tray-Restart immer
  // die aktuellen Einstellungen lesen (ohne stale Closures).
  const fpsRef = useRef<NdiFps>(targetFps);
  fpsRef.current = targetFps;
  const audioRef = useRef(audioOn);
  audioRef.current = audioOn;

  const refreshSources = useCallback(async () => {
    const list = await window.jmndi.listSources();
    setSources(list);
    setSelectedId((prev) => prev ?? list[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void refreshSources();
    void window.jmndi.getStatus().then(setStatus);
    const off = window.jmndi.onStatus(setStatus);

    // Frame-MessagePort vom Main (über die Preload-Bridge) entgegennehmen.
    const onMessage = (e: MessageEvent) => {
      if (e.data === 'jmndi:frame-port' && e.ports[0]) {
        framePortRef.current = e.ports[0];
        framePortRef.current.start();
      }
    };
    window.addEventListener('message', onMessage);

    return () => {
      off();
      window.removeEventListener('message', onMessage);
      sessionRef.current?.stop();
    };
  }, [refreshSources]);

  const drawFrame = useCallback((frame: VideoFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
      canvas.width = frame.displayWidth;
      canvas.height = frame.displayHeight;
    }
    if (!ctxRef.current) ctxRef.current = canvas.getContext('2d');
    ctxRef.current?.drawImage(frame, 0, 0);
  }, []);

  // Video: lokale Vorschau + BGRA an den nativen Sender (utilityProcess).
  const handleFrame = useCallback(
    async (frame: VideoFrame) => {
      drawFrame(frame);
      const port = framePortRef.current;
      if (!port) return;
      try {
        const size = frame.allocationSize({ format: 'BGRA' });
        const buf = new ArrayBuffer(size);
        await frame.copyTo(new Uint8Array(buf), { format: 'BGRA' });
        // WICHTIG: NICHT transferieren ([buf]). Ein transferierter ArrayBuffer
        // kommt über die Renderer→Main-MessagePort-Grenze als `null` an. Ohne
        // Transfer wird der Buffer kopiert und überträgt korrekt.
        port.postMessage({
          type: 'video',
          buffer: buf,
          w: frame.displayWidth,
          h: frame.displayHeight,
          fpsN: fpsRef.current,
        });
      } catch (err) {
        console.error('[jmndi] Frame-Versand fehlgeschlagen:', err);
      }
    },
    [drawFrame],
  );

  // Audio: float32-planar (FLTP) an den nativen Sender.
  const handleAudio = useCallback(async (data: AudioData) => {
    const port = framePortRef.current;
    if (!port) return;
    const ch = data.numberOfChannels;
    const n = data.numberOfFrames;
    const out = new Float32Array(ch * n);
    for (let c = 0; c < ch; c++) {
      await data.copyTo(out.subarray(c * n, c * n + n), { planeIndex: c, format: 'f32-planar' });
    }
    // Nicht transferieren (sonst kommt die Nachricht als null an) → kopieren.
    port.postMessage({ type: 'audio', buffer: out.buffer, ch, n, sr: data.sampleRate });
  }, []);

  const stop = useCallback(async () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    framePortRef.current = null;
    setActive(false);
    setStats(null);
    await window.jmndi.stop();
  }, []);

  const start = useCallback(async () => {
    if (!selectedId) return;
    const fps = fpsRef.current;
    const audio = audioRef.current;
    setBusy(true);
    try {
      // Quelle vormerken + nativen Sender starten (Main postet den Frame-Port).
      await window.jmndi.start({
        sourceId: selectedId,
        targetFps: fps,
        audio,
        pixelFormat: 'bgra',
      });
      const session = new CaptureSession(
        {
          onFrame: handleFrame,
          onAudio: handleAudio,
          onStats: setStats,
          onError: (e) => {
            setStatus((s) => ({ ...s, sendState: 'error', error: e.message }));
            void stop();
          },
          onEnded: () => setActive(false),
        },
        { targetFps: fps, audio },
      );
      sessionRef.current = session;
      await session.start();
      setActive(true);
    } catch (e) {
      setStatus((s) => ({ ...s, sendState: 'error', error: e instanceof Error ? e.message : String(e) }));
      await stop();
    } finally {
      setBusy(false);
    }
  }, [selectedId, handleFrame, handleAudio, stop]);

  // #104: Bildrate/Audio ändern — bei laufendem Versand neu starten (Ref zuerst
  // setzen, damit start() den neuen Wert liest).
  const changeFps = useCallback(
    async (fps: NdiFps) => {
      fpsRef.current = fps;
      setTargetFps(fps);
      try {
        localStorage.setItem(FPS_KEY, String(fps));
      } catch {
        /* nur In-Memory */
      }
      if (active) {
        await stop();
        await start();
      }
    },
    [active, start, stop],
  );
  const changeAudio = useCallback(
    async (on: boolean) => {
      audioRef.current = on;
      setAudioOn(on);
      if (active) {
        await stop();
        await start();
      }
    },
    [active, start, stop],
  );

  // #104: Tray-Menü ↔ Renderer.
  const trayCmdRef = useRef<(cmd: TrayCommand) => void>(() => {});
  trayCmdRef.current = (cmd: TrayCommand): void => {
    if (cmd.kind === 'start') {
      if (!active && selectedId) void start();
    } else if (cmd.kind === 'stop') {
      if (active) void stop();
    } else if (cmd.kind === 'setFps') {
      void changeFps(cmd.fps);
    } else if (cmd.kind === 'setAudio') {
      void changeAudio(cmd.audio);
    }
  };
  useEffect(() => window.jmndi.onTrayCommand((cmd) => trayCmdRef.current(cmd)), []);

  // Aktuelle Einstellungen ans Tray spiegeln.
  useEffect(() => {
    const sourceName = sources.find((s) => s.id === selectedId)?.name ?? null;
    window.jmndi.traySync({ active, targetFps, audio: audioOn, sourceName });
  }, [active, targetFps, audioOn, selectedId, sources]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <header
        style={dragRegion}
        className={cn(
          'flex items-center gap-3 border-b border-[var(--border)] pr-6 py-4',
          isElectronMac ? 'pl-20' : 'pl-6',
        )}
      >
        <Logo size={26} />
        <div className="flex flex-col">
          <span className="text-sm font-extrabold uppercase tracking-[0.14em]">
            JM NDI Screen Capture
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">
            Bildschirm &amp; Fenster als NDI-Quelle ins Studio-LAN
          </span>
        </div>
        <Badge tone="warning" className="ml-auto">
          v0.1.0
        </Badge>
      </header>

      <main className="grid flex-1 gap-4 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Vorschau + Status */}
        <section className="flex flex-col gap-3">
          <Preview canvasRef={canvasRef} active={active} />
          <StatusBar status={status} stats={stats} />
        </section>

        {/* Quellenauswahl + Steuerung */}
        <aside className="flex flex-col gap-3">
          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Quelle
              </h2>
              <Button size="sm" variant="ghost" onClick={() => void refreshSources()} disabled={active}>
                Aktualisieren
              </Button>
            </div>
            <SourcePicker
              sources={sources}
              selectedId={selectedId}
              onSelect={setSelectedId}
              disabled={active}
            />
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={audioOn}
                disabled={active}
                onChange={(e) => setAudioOn(e.target.checked)}
              />
              System-Audio mitsenden (Windows)
            </label>
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <span>Bildrate</span>
              <div className="flex gap-1">
                {NDI_FPS_OPTIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => void changeFps(f)}
                    className={cn(
                      'h-7 px-2.5 rounded-[var(--radius)] text-xs font-bold border',
                      targetFps === f
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent'
                        : 'border-[var(--border)] hover:bg-[var(--highlight)]',
                    )}
                  >
                    {f} fps
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Button
            size="lg"
            variant={active ? 'destructive' : 'primary'}
            disabled={busy || (!active && !selectedId)}
            onClick={() => void (active ? stop() : start())}
          >
            {active ? 'Stoppen' : 'NDI-Versand starten'}
          </Button>
          <p className="text-center text-[10px] text-[var(--muted-foreground)]">
            Fenster schließen minimiert ins System-Tray — der NDI-Versand läuft weiter. Beenden über das Tray-Menü.
          </p>
        </aside>
      </main>

      <footer className="px-6 py-4 text-center text-[10px] text-[var(--muted-foreground)]">
        NDI® is a registered trademark of Vizrt NDI AB.
      </footer>
    </div>
  );
}

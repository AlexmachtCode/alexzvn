import { useEffect, useState } from 'react';
import { cn } from '@jm/ui';
import type { DisplayInfo } from '@shared/types';
import { SlideCanvas } from '@/components/SlideCanvas';
import { Clock } from '@/components/Clock';
import { RemotePanel } from '@/components/RemotePanel';
import { TimerBar } from '@/components/TimerBar';
import { usePresentation, usePresenterKeys } from '@/lib/usePresentation';
import { useTimerSync } from '@/lib/timer';

export function PresenterView() {
  const { slides, state } = usePresentation();
  usePresenterKeys(true);
  const timer = useTimerSync();
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [jump, setJump] = useState('');
  const [showGrid, setShowGrid] = useState(false);
  const [showRemote, setShowRemote] = useState(false);

  useEffect(() => {
    void window.jmpr.present.displays().then(setDisplays);
  }, []);

  if (!slides) {
    return <div className="h-full grid place-items-center text-[var(--muted-foreground)]">Lade Präsentation…</div>;
  }

  const current = slides[state.index] ?? null;
  // Mit Schleife folgt auf die letzte Folie wieder die erste (#293).
  const next = slides[state.index + 1] ?? (state.schleife && slides.length > 1 ? slides[0] : null);
  const audienceDisplay = displays.find((d) => d.current);

  const doJump = (): void => {
    const n = Number(jump);
    if (Number.isFinite(n) && n >= 1 && n <= slides.length) {
      void window.jmpr.present.goto(n - 1);
    }
    setJump('');
  };

  return (
    <div className="h-full flex flex-col bg-[#0c0c0c] text-white select-none">
      {/* header */}
      <header className="h-16 flex items-center gap-4 px-5 border-b border-white/10">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tabular text-[var(--primary)]">{state.index + 1}</span>
          <span className="text-lg text-white/50 tabular">/ {state.total}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{current?.title || '—'}</div>
        </div>
        <Clock />
        <div className="h-8 w-px bg-white/15" />
        <div className="flex items-center gap-2">
          <select
            value={audienceDisplay?.id ?? ''}
            onChange={(e) => e.target.value && void window.jmpr.present.assignAudience(Number(e.target.value))}
            title="Publikums-Bildschirm"
            className="h-8 max-w-[170px] rounded-md bg-white/10 border border-white/15 px-2 text-xs"
          >
            {displays.map((d) => (
              <option key={d.id} value={d.id} className="text-black">
                {d.label}
              </option>
            ))}
          </select>
          <HeaderBtn
            onClick={() => void window.jmpr.present.setScreen('black')}
            active={state.screen === 'black'}
            title="Schwarzbild (Taste B)"
          >
            ⬛
          </HeaderBtn>
          <HeaderBtn
            onClick={() => void window.jmpr.present.setScreen('white')}
            active={state.screen === 'white'}
            title="Weißbild (Taste W)"
          >
            ⬜
          </HeaderBtn>
          <SchleifenKnopf schleife={state.schleife === true} bisMs={state.schleifeBisMs ?? null} />
          <HeaderBtn onClick={() => void window.jmpr.present.toggleAudienceFullscreen()}>Vollbild</HeaderBtn>
          <HeaderBtn onClick={() => setShowGrid((v) => !v)} active={showGrid}>
            Übersicht
          </HeaderBtn>
          <HeaderBtn onClick={() => setShowRemote(true)} active={showRemote} title="Handy-Fernsteuerung">
            📱
          </HeaderBtn>
          <HeaderBtn danger onClick={() => void window.jmpr.present.stop()}>
            ■ Beenden
          </HeaderBtn>
        </div>
      </header>

      {/* body */}
      <div className="flex-1 min-h-0 grid grid-cols-[1.7fr_1fr] gap-4 p-4">
        {/* current */}
        <div className="min-h-0 flex flex-col">
          <Label>Aktuelle Folie</Label>
          <div className="flex-1 min-h-0 flex items-center justify-center bg-black rounded-lg overflow-hidden ring-1 ring-white/10">
            {current && <SlideCanvas slide={current} maxWidth={1280} />}
          </div>
          <div className="mt-3 flex items-center justify-center gap-3">
            <NavBtn onClick={() => void window.jmpr.present.prev()} disabled={state.index <= 0}>
              ‹ Zurück
            </NavBtn>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                doJump();
              }}
              className="flex items-center gap-1"
            >
              <input
                value={jump}
                onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))}
                placeholder="Folie"
                className="h-9 w-20 text-center rounded-md bg-white/10 border border-white/15 text-sm"
              />
              <button type="submit" className="h-9 px-3 rounded-md bg-white/10 border border-white/15 text-sm">
                Gehe zu
              </button>
            </form>
            <NavBtn onClick={() => void window.jmpr.present.next()} disabled={state.index >= state.total - 1}>
              Weiter ›
            </NavBtn>
          </div>
        </div>

        {/* next + notes */}
        <div className="min-h-0 flex flex-col gap-4">
          {timer.connected && <TimerBar timer={timer} />}
          <div className="flex flex-col" style={{ flex: '0 0 38%' }}>
            <Label>Nächste Folie</Label>
            <div className="flex-1 min-h-0 flex items-center justify-center bg-black rounded-lg overflow-hidden ring-1 ring-white/10">
              {next ? (
                <SlideCanvas slide={next} maxWidth={640} />
              ) : (
                <span className="text-white/40 text-sm">Ende der Präsentation</span>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <Label>Notizen</Label>
            <div className="flex-1 min-h-0 overflow-auto scroll-thin bg-white/5 rounded-lg ring-1 ring-white/10 p-4 text-[15px] leading-relaxed whitespace-pre-wrap">
              {current?.notes ? current.notes : <span className="text-white/35">Keine Notizen</span>}
            </div>
          </div>
        </div>
      </div>

      {/* grid overlay */}
      {showGrid && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm p-6 overflow-auto scroll-thin">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Folienübersicht</h3>
            <button type="button" onClick={() => setShowGrid(false)} className="text-sm text-white/60 hover:text-white">
              schließen ✕
            </button>
          </div>
          <div className="grid grid-cols-4 lg:grid-cols-6 gap-3">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  void window.jmpr.present.goto(i);
                  setShowGrid(false);
                }}
                className={cn(
                  'group rounded-lg overflow-hidden ring-2 transition-all',
                  i === state.index ? 'ring-[var(--primary)]' : 'ring-white/10 hover:ring-white/40',
                )}
              >
                <div className="aspect-video bg-black flex items-center justify-center">
                  <SlideCanvas slide={s} maxWidth={360} />
                </div>
                <div className="px-2 py-1 text-left text-[11px] bg-white/5 flex items-center gap-1.5">
                  <span className="tabular text-white/50">{i + 1}</span>
                  <span className="truncate">{s.title}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showRemote && <RemotePanel onClose={() => setShowRemote(false)} />}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.14em] text-white/45 font-bold mb-1.5">{children}</div>
  );
}

/** #293: Schleife live an/aus, mit Countdown bis zum nächsten Selbst-Weiterblättern. */
function SchleifenKnopf({ schleife, bisMs }: { schleife: boolean; bisMs: number | null }) {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    if (!schleife || bisMs == null) return;
    const id = setInterval(() => setJetzt(Date.now()), 250);
    return () => clearInterval(id);
  }, [schleife, bisMs]);
  const rest = schleife && bisMs != null ? Math.max(0, Math.ceil((bisMs - jetzt) / 1000)) : null;
  return (
    <HeaderBtn
      onClick={() => void window.jmpr.present.setSchleife(!schleife)}
      active={schleife}
      title={schleife ? 'Schleife anhalten' : 'Schleife starten: blättert nach der Standzeit selbst weiter'}
    >
      ⟳ Schleife{rest != null ? ` · ${rest} s` : schleife ? ' · steht' : ''}
    </HeaderBtn>
  );
}

function HeaderBtn({
  children,
  onClick,
  active,
  danger,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'h-8 px-3 rounded-md text-xs font-semibold border transition-colors',
        danger
          ? 'border-[var(--destructive)]/60 text-[var(--destructive)] hover:bg-[var(--destructive)]/15'
          : active
            ? 'bg-[var(--primary)] text-[var(--brand-dark)] border-[var(--primary)]'
            : 'bg-white/10 border-white/15 hover:bg-white/20',
      )}
    >
      {children}
    </button>
  );
}

function NavBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-10 px-5 rounded-md bg-white/10 border border-white/15 text-sm font-bold hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

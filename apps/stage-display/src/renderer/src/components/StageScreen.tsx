import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from '@jm/ui';
import {
  getCountdownRemaining,
  getProjectedEndMs,
  isCountdownPaused,
  isCountdownRunning,
  type StageConfig,
  type StageState,
} from '@shared/types';
import { formatClock, formatHMS, formatWall } from '@/lib/format';
import { buehnenNachricht, type BuehnenNachricht } from '@/lib/nachricht';

/**
 * Geteilte Bühnen-Darstellung — identisch in der Operator-Vorschau und im
 * Vollbild-Ausgabefenster. Skaliert über Container-Query-Einheiten (cqw/cqh)
 * automatisch auf die Größe des umgebenden Kastens.
 */
export function StageScreen({ state, now }: { state: StageState; now: number }) {
  const { config, timer, switcher, presenter } = state;
  const w = config.widgets;

  // When the presenter feed is live, the stage display becomes a reference
  // (confidence) screen — current slide + notes + next, with a compact countdown
  // kept in the corner. Otherwise the normal countdown-centric layout shows.
  if (w.presenter && presenter.connected && presenter.active) {
    return config.presenter.mode === 'main' ? (
      <PresenterMainScreen state={state} now={now} />
    ) : (
      <PresenterRefScreen state={state} now={now} />
    );
  }

  const cd = timer.countdown;
  const timerActive = Boolean(
    w.timer && timer.connected && cd && (isCountdownRunning(cd) || isCountdownPaused(cd)),
  );
  const remaining = cd ? getCountdownRemaining(cd, now) : 0;
  const endsAt = cd ? getProjectedEndMs(cd, now) : null;

  const color = timerActive
    ? remaining <= 0
      ? timer.colors.overtime
      : remaining <= timer.colors.warningAtSec * 1000
        ? timer.colors.warning
        : timer.colors.normal
    : '#ffffff';

  const nachricht = buehnenNachricht(state);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-black text-white select-none"
      style={{ containerType: 'size' }}
    >
      {/* Uhr oben links */}
      {w.clock && (
        <div
          className="absolute left-[3%] top-[4%] font-extrabold text-white/80"
          style={{ fontSize: '4cqh', fontVariantNumeric: 'tabular-nums' }}
        >
          {formatClock(now)}
        </div>
      )}

      {/* Switcher PGM oben rechts */}
      {w.switcher && switcher.connected && (
        <div className="absolute right-[3%] top-[4%] flex items-center gap-[1cqw]" style={{ fontSize: '2.4cqh' }}>
          <span className="rounded bg-white/12 px-[1.2cqh] py-[0.4cqh] font-extrabold">
            PGM {switcher.program || '–'}
          </span>
          {switcher.recording && (
            <span className="rounded px-[1.2cqh] py-[0.4cqh] font-extrabold" style={{ background: '#F61C56' }}>
              ● REC
            </span>
          )}
          {switcher.streaming && (
            <span className="rounded bg-amber-400 px-[1.2cqh] py-[0.4cqh] font-extrabold text-black">STREAM</span>
          )}
        </div>
      )}

      {/* Aktiver Programmpunkt oben mittig */}
      {w.timer && timer.activeLabel && (
        <div className="absolute inset-x-0 top-[16%] text-center px-[5%]">
          <div className="uppercase tracking-[0.14em] text-white/45" style={{ fontSize: '2.4cqh' }}>
            Programmpunkt
          </div>
          <div className="font-extrabold leading-tight" style={{ fontSize: '6cqh' }}>
            {timer.activeLabel}
          </div>
        </div>
      )}

      {/* Zentrales Element: Countdown (wenn Timer aktiv) sonst Uhr */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="font-extrabold leading-none"
          style={{ fontSize: 'min(26cqw, 40cqh)', color, fontVariantNumeric: 'tabular-nums' }}
        >
          {timerActive ? formatHMS(remaining) : formatClock(now)}
        </div>
      </div>

      {/* „Endet …" */}
      {timerActive && endsAt != null && (
        <div
          className="absolute inset-x-0 top-[68%] text-center uppercase tracking-[0.14em] text-white/55"
          style={{ fontSize: '2.8cqh' }}
        >
          Endet {formatWall(endsAt)}
        </div>
      )}

      {/* Nachricht */}
      {nachricht && (
        <NachrichtZeile
          nachricht={nachricht}
          className="absolute inset-x-0 top-[76%] px-[5%] text-center"
          style={{ fontSize: '4.5cqh', wordBreak: 'break-word' }}
        />
      )}

      {/* Up Next unten */}
      {w.timer && timer.nextLabel && (
        <div className="absolute inset-x-0 bottom-[5%] text-center px-[5%]">
          <div className="uppercase tracking-[0.14em] text-white/40" style={{ fontSize: '2cqh' }}>
            Up Next
          </div>
          <div className="truncate font-semibold text-white/85" style={{ fontSize: '3.4cqh' }}>
            {timer.nextLabel}
          </div>
        </div>
      )}
    </div>
  );
}

/** Build the live rendered-slide URL on the presenter's remote server. `rev`
 *  busts the cache so the <img> refetches whenever the slide changes. */
function slideImageUrl(cfg: StageConfig['presenter'], rev: number): string {
  const pin = cfg.pin ? `&pin=${encodeURIComponent(cfg.pin)}` : '';
  return `http://${cfg.host}:${cfg.port}/slide/current.jpg?rev=${rev}${pin}`;
}

/**
 * Live rendered slide fetched from the presenter (#38, 2b). Keeps the previous
 * image visible across a slide change until the new one decodes (no flash), and
 * shows a placeholder only on the very first load or a hard error.
 */
function SlideImage({ url, className }: { url: string; className?: string }) {
  const [shown, setShown] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setErrored(false);
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setShown(url);
    };
    img.onerror = () => {
      if (!cancelled) setErrored(true);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!shown) {
    return (
      <div
        className={cn('flex items-center justify-center bg-black text-white/35', className)}
        style={{ fontSize: '2.6cqh' }}
      >
        {errored ? 'Folie nicht verfügbar' : 'Folie wird geladen…'}
      </div>
    );
  }
  return <img src={shown} alt="" className={cn('object-contain', className)} draggable={false} />;
}

/** Eine Bühnen-Nachricht: gelb, bei blinkender Timer-Nachricht rot und blinkend. */
function NachrichtZeile({
  nachricht,
  className,
  style,
}: {
  nachricht: BuehnenNachricht;
  className: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(className, 'font-extrabold', nachricht.blinkt && 'jm-blink')}
      style={{ ...style, color: nachricht.blinkt ? '#F61C56' : '#FFE819' }}
    >
      {nachricht.text}
    </div>
  );
}

/** Compact countdown + clock + PGM header shared by the presenter screens. */
function PresenterHeader({ state, now }: { state: StageState; now: number }) {
  const { config, timer, switcher } = state;
  const w = config.widgets;
  const cd = timer.countdown;
  const timerActive = Boolean(
    w.timer && timer.connected && cd && (isCountdownRunning(cd) || isCountdownPaused(cd)),
  );
  const remaining = cd ? getCountdownRemaining(cd, now) : 0;
  const color = timerActive
    ? remaining <= 0
      ? timer.colors.overtime
      : remaining <= timer.colors.warningAtSec * 1000
        ? timer.colors.warning
        : timer.colors.normal
    : '#ffffff';
  const nachricht = buehnenNachricht(state);
  return (
    <div className="flex items-center justify-between" style={{ fontVariantNumeric: 'tabular-nums' }}>
      <div className="font-extrabold text-white/80" style={{ fontSize: '4cqh' }}>
        {formatClock(now)}
      </div>
      {nachricht && (
        <NachrichtZeile
          nachricht={nachricht}
          className="min-w-0 flex-1 truncate px-[2cqw] text-center"
          style={{ fontSize: '3.6cqh' }}
        />
      )}
      <div className="flex items-center gap-[1.5cqw]">
        {w.switcher && switcher.connected && (
          <span className="rounded bg-white/12 px-[1.2cqh] py-[0.4cqh] font-extrabold" style={{ fontSize: '2.4cqh' }}>
            PGM {switcher.program || '–'}
          </span>
        )}
        {timerActive && (
          <span className="font-extrabold leading-none" style={{ fontSize: '5cqh', color }}>
            {formatHMS(remaining)}
          </span>
        )}
      </div>
    </div>
  );
}

function BlankBadge({ screen }: { screen: 'black' | 'white' }) {
  return (
    <span
      className="rounded px-[1.2cqh] py-[0.4cqh] font-extrabold uppercase tracking-[0.1em]"
      style={{
        fontSize: '2.2cqh',
        background: screen === 'white' ? '#ffffff' : '#222',
        color: screen === 'white' ? '#000' : '#fff',
      }}
    >
      {screen === 'white' ? '⬜ Weißbild' : '⬛ Schwarzbild'}
    </span>
  );
}

/**
 * Referentenansicht (REF) — gespeist vom JM Presenter (#38). Zweispaltig: links
 * die live gerenderte Folie (Bild), rechts Position, Notizen und nächste Folie;
 * oben kompakter Countdown + Uhr.
 */
function PresenterRefScreen({ state, now }: { state: StageState; now: number }) {
  const { config, presenter } = state;
  const blanked = presenter.screen !== 'live';
  const imgUrl = slideImageUrl(config.presenter, presenter.rev);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-black text-white select-none flex flex-col"
      style={{ containerType: 'size' }}
    >
      <div className="px-[3%] pt-[2.5cqh] pb-[1.5cqh]">
        <PresenterHeader state={state} now={now} />
      </div>

      <div className="flex-1 min-h-0 flex gap-[3cqw] px-[3%] pb-[3cqh]">
        {/* aktuelle Folie als Bild */}
        <div className="basis-[62%] min-w-0 flex items-center justify-center rounded-[1cqh] overflow-hidden ring-1 ring-white/10 bg-black">
          <SlideImage url={imgUrl} className="w-full h-full" />
        </div>

        {/* Meta: Position, Notizen, Nächste */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-baseline gap-[1.5cqw]">
            <span className="font-extrabold" style={{ fontSize: '3.4cqh', color: '#FFE819' }}>
              Folie {presenter.index + 1}
            </span>
            <span className="text-white/45" style={{ fontSize: '2.4cqh' }}>
              / {presenter.total}
            </span>
            {blanked && (
              <span className="ml-auto">
                <BlankBadge screen={presenter.screen === 'white' ? 'white' : 'black'} />
              </span>
            )}
          </div>

          <div className="mt-[1.5cqh] uppercase tracking-[0.14em] text-white/40" style={{ fontSize: '1.8cqh' }}>
            Notizen
          </div>
          <div
            className="flex-1 min-h-0 overflow-hidden whitespace-pre-wrap leading-relaxed text-white/90"
            style={{ fontSize: '3cqh' }}
          >
            {presenter.notes.trim() || '—'}
          </div>

          {presenter.nextTitle && (
            <div className="mt-[1.5cqh] pt-[1.5cqh] border-t border-white/15">
              <span className="uppercase tracking-[0.14em] text-white/40" style={{ fontSize: '1.8cqh' }}>
                Nächste
              </span>
              <div className="truncate font-semibold text-white/85" style={{ fontSize: '2.8cqh' }}>
                {presenter.nextTitle}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hauptansicht — spiegelt die Publikumsausgabe: die live gerenderte Folie als
 * Vollbild, mit dezentem Countdown/Uhr oben (#38, 2b).
 */
function PresenterMainScreen({ state, now }: { state: StageState; now: number }) {
  const { config, presenter } = state;
  const imgUrl = slideImageUrl(config.presenter, presenter.rev);
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-black text-white select-none"
      style={{ containerType: 'size' }}
    >
      <SlideImage url={imgUrl} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-x-0 top-0 px-[3%] pt-[2.5cqh] pointer-events-none">
        <PresenterHeader state={state} now={now} />
      </div>
      {presenter.screen !== 'live' && (
        <div className="absolute right-[3%] bottom-[3cqh]">
          <BlankBadge screen={presenter.screen === 'white' ? 'white' : 'black'} />
        </div>
      )}
    </div>
  );
}

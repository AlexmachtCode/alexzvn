// Live-Bereich der Caption (UX Welle 2a, Caption d; Spec 3.4, 5.1; E4, E7, E9; Funktionsliste Nr. 9–12, 24–36): oben die vier
// Haupttasten als TallyButtons in grid gap-3 (Start/Stopp, Hold, Leeren, NDI: die Reihenfolge von heute), direkt darunter der
// Mikrofonfehler-Text (E9) und die Hinweise (whisper fehlt, Fehler des Main), dann die große Live-Zeile mit der NDI-Vorschau,
// die Pegelzeile und der Verlauf mit der Korrektur der jüngsten Zeile. Die Tasten haben eine feste Breite (30 rem, zwei
// Spalten) und stehen ganz oben links: Sie liegen bei jeder Fenstergröße und bei offenem Panel an derselben Stelle, und keine
// wachsende Live-Zeile schiebt sie (heute standen Start, Hold und Leeren oben im Kopf). Unter 900 px liegt das Panel über dem
// Inhalt; dann bleibt der ganze Live-Bereich links daneben (max-[900px]).
// Das Vorschau-Canvas steht ohne Bedingung im JSX: Die Engine in der Wurzel-View zeichnet über previewRef hinein, auch vor der
// ersten Antwort. Rein darstellend und ohne Hooks: Stand, Ref, Korrekturzustand und Aktionen kommen aus der View
// (CaptionOberflaeche); kein window, kein Store. Hinweise stehen im Fluss, nie über Tasten, Live-Zeile, Pegel oder Statusleiste.
import type { RefObject } from 'react';
import { cn, TallyButton, type TallyButtonProps } from '@jm/ui';
import type { LiveAktionen } from '@/lib/aktionen';
import { CAPTION_TEXTE, hauptTasten, type OberflaechenStand } from '@/lib/oberflaeche';

/**
 * Die vier Haupttasten in Anzeigereihenfolge: Start/Stopp, Hold, Leeren, NDI. Genau hauptTasten plus Klick; die Wirkung folgt
 * dem Zustand wie bisher (running ? stop : start; setHold(!hold); clear; ndiActive ? ndiStop : ndiStart). Ohne DOM prüfbar.
 */
export function liveTasten(s: Pick<OberflaechenStand, 'caption' | 'micError'>, a: LiveAktionen): TallyButtonProps[] {
  const t = hauptTasten(s);
  const c = s.caption;
  const running = c?.running ?? false;
  const hold = c?.hold ?? false;
  const ndiActive = c?.status.ndiActive ?? false;
  return [
    { ...t.start, onClick: running ? a.stop : a.start },
    { ...t.hold, onClick: () => a.hold(!hold) },
    { ...t.leeren, onClick: a.leeren },
    { ...t.ndi, onClick: ndiActive ? a.ndiStoppen : a.ndiStarten },
  ];
}

/** Breite des Pegelbalkens in Prozent wie bisher (App.tsx:138): RMS 0,15 = voll. */
export function pegelProzent(rms: number): number {
  return Math.min(100, Math.round((rms / 0.15) * 100));
}

const KLEIN = 'text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]';
const HINWEIS = 'rounded-[var(--radius-md)] border px-3 py-1.5 text-xs text-[var(--foreground)] select-text';
const HINWEIS_FEHLER = 'border-[var(--status-error)]/60 bg-[var(--status-error)]/10';
const HINWEIS_WARNUNG = 'border-[var(--status-warn)]/60 bg-[var(--status-warn)]/10';

export function LiveBereich({
  stand,
  previewRef,
  editing,
  aktionen,
}: {
  stand: OberflaechenStand;
  /** Ref der Vorschau, dieselbe wie die der Engine in der Wurzel-View. */
  previewRef: RefObject<HTMLCanvasElement>;
  /** Id der Zeile im Korrekturmodus (Oberflächenzustand der View), sonst null. */
  editing: string | null;
  aktionen: LiveAktionen;
}): React.JSX.Element {
  const T = CAPTION_TEXTE;
  const c = stand.caption;
  const lines = c?.lines ?? [];
  const last = lines.length ? lines[lines.length - 1] : null;
  const prozent = pegelProzent(stand.pegel ?? 0);
  return (
    <section data-caption="live" className="flex max-w-[1100px] flex-col gap-3 max-[900px]:max-w-[calc(100vw_-_var(--panel-w)_-_2.5rem)]">
      {/* Reihenfolge fest, die Beschriftung wechselt (Start/Stopp, Hold/Hold ✓, NDI starten/NDI an): der Index ist der stabile key. */}
      <div data-caption="tasten" className="grid w-full max-w-[30rem] grid-cols-2 gap-3">
        {liveTasten(stand, aktionen).map((k, i) => (
          <TallyButton key={i} {...k} />
        ))}
      </div>

      {/* Mikrofonfehler unter den Haupttasten (E9): bleibt wie heute bis zum nächsten erfolgreichen Start stehen. */}
      {stand.micError !== null && (
        <p data-caption="mikrofonfehler" role="alert" className={cn('w-full max-w-[30rem]', HINWEIS, HINWEIS_FEHLER)}>
          {T.live.mikrofonFehler(stand.micError)}
        </p>
      )}
      {c !== undefined && !c.whisperAvailable && (
        <p data-caption="hinweis-whisper" className={cn(HINWEIS, HINWEIS_WARNUNG)}>
          {T.whisper.fehltHinweis}
        </p>
      )}
      {c?.error ? (
        <p data-caption="hinweis-fehler" role="alert" className={cn(HINWEIS, HINWEIS_FEHLER)}>
          {c.error}
        </p>
      ) : null}

      {/* Große Live-Zeile und NDI-Vorschau nebeneinander; bei schmalem Inhalt steht die Vorschau darunter. */}
      <div data-caption="zeile-vorschau" className="flex flex-wrap items-center gap-4">
        <div data-caption="live-zeile" className="grid min-w-[18rem] flex-1 place-items-center">
          <div data-caption="live-text" className="min-h-[3.5rem] w-full max-w-3xl text-center text-3xl font-semibold leading-snug">
            {c === undefined ? (
              <span className="text-[var(--muted-foreground)]">{T.grund.zustandOffen}</span>
            ) : last ? (
              last.text
            ) : (
              <span className="text-[var(--muted-foreground)]">{T.live.bereit}</span>
            )}
          </div>
        </div>
        <div data-caption="vorschau" className="w-80 shrink-0">
          <div className={cn('mb-1 flex items-center justify-between', KLEIN)}>
            <span>{T.live.vorschau}</span>
            {c?.hold ? (
              <span className="rounded-[var(--radius-sm)] border border-[var(--tally-selected)] px-1 font-bold text-[var(--foreground)]">{T.live.eingefroren}</span>
            ) : null}
          </div>
          {/* Schachbrett zeigt die Transparenz der Quelle (ca-schachbrett in globals.css, aus Tokens). */}
          <div className="ca-schachbrett overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
            <canvas ref={previewRef} width={320} height={180} className="block w-full" />
          </div>
        </div>
      </div>

      {/* Pegel und Verlauf. */}
      <div className="border-t border-[var(--border)] pt-2">
        <div data-caption="pegel" className="flex items-center gap-3 py-1">
          <span className={KLEIN}>{T.live.pegel}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-[var(--radius-full)] bg-[var(--muted)]">
            <div
              className="h-full rounded-[var(--radius-full)] transition-[width] duration-75"
              style={{ width: `${prozent}%`, background: prozent > 80 ? 'var(--status-error)' : 'var(--tally-ready)' }}
            />
          </div>
          {c?.busy ? <span className="text-[10px] text-[var(--muted-foreground)]">{T.whisper.arbeitet}</span> : null}
          {c !== undefined ? <span className="text-[10px] text-[var(--muted-foreground)]">{T.live.zeilen(lines.length)}</span> : null}
        </div>
        <div data-caption="verlauf" className="max-h-44 overflow-y-auto pb-3">
          {lines
            .slice()
            .reverse()
            .map((l) =>
              editing === l.id ? (
                <input
                  key={l.id}
                  autoFocus
                  defaultValue={l.text}
                  onBlur={(e) => {
                    aktionen.korrigieren(e.target.value);
                    aktionen.bearbeiten(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="my-0.5 w-full rounded-[var(--radius-md)] border border-[var(--field-border)] bg-[var(--input)] px-2 py-1 text-sm text-[var(--foreground)]"
                />
              ) : (
                <div
                  key={l.id}
                  onDoubleClick={() => l.id === last?.id && aktionen.bearbeiten(l.id)}
                  title={l.id === last?.id ? T.live.korrigieren : undefined}
                  className="border-b border-[var(--border)]/50 py-1 text-sm text-[var(--foreground)]"
                >
                  {l.text}
                </div>
              ),
            )}
          {c !== undefined && lines.length === 0 && <div className="py-3 text-center text-xs text-[var(--muted-foreground)]">{T.live.keineZeilen}</div>}
        </div>
      </div>
    </section>
  );
}

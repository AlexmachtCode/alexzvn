// Live-Bereich des Recorders (UX Welle 2a, Recorder d; Spec 3.4, 5.1; E4, E7, E13; Ruling P3; Funktionsliste Nr. 7–15, 21–30,
// 38–43): oben die Preset-Leiste (unverändert, als Einschub aus der View), das Hinweisband des Stores und die Meldung des
// Hauptprozesses mit „OK“ (wird es eng, scrollen sie in sich, nach den Metern); darunter die Karte mit Kopf und Ziel-Anzeige,
// Aufnahme/Stopp und Eingang öffnen/schließen als zwei TallyButtons, Marke und Uhr, Pegelkopf mit Verstärkung und die
// Kanal-Meter. Alles steht in EINEM Container, der nie höher ist als der sichtbare Inhalt (100vh minus Kopf, Statusleiste und
// Rand): Taste, Uhr, Marke und Meter sind ohne Scrollen zu sehen (gemessen 1180×820 und 920×620, Panel zu und offen,
// t21-messung.mjs); bei vielen Kanälen geben nur die Meter nach und scrollen in sich. Reicht selbst das nicht, scrollt der
// Container selbst und überdeckt nie den Zeitplan darunter.
// Rein darstellend und ohne Hooks: Stand, Werte und Aktionen kommen aus der View (RecorderOberflaeche), kein window, kein
// Store. Tasten zeigen genau hauptTasten (lib/oberflaeche.ts, gemessener Zustand) und rufen die Store-Aktion, die ihre
// Beschriftung nennt. Reihenfolge wie heute bei offenem Eingang: Aufnahme/Stopp links, Eingang schließen rechts.
import type { ReactNode } from 'react';
import { Badge, Button, cn, TallyButton, UNBEKANNT, type TallyButtonProps } from '@jm/ui';
import type { RecorderState } from '@shared/types';
import { basename, dbfsLabel, formatClock, meterColor, meterPct } from '@/lib/format';
import { hauptTasten, RECORDER_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';

/** Die Aktionen des Live-Bereichs: die Store-Aktionen unter ihrem Namen, dazu „OK“ der Meldung und „Im Ordner zeigen“. */
export interface LiveAktionen {
  arm(): void;
  disarm(): void;
  record(): void;
  stop(): void;
  setGain(db: number): void;
  hinweiseSchliessen(): void;
  /** „OK“ der Main-Meldung: Oberflächenzustand der View (null), nicht der Store. */
  meldungQuittieren(): void;
  /** Datei der Aufnahme im Dateimanager zeigen (`shell.reveal`). */
  dateiZeigen(pfad: string): void;
}

/** Was der Live-Bereich außer dem Stand aus dem Store zeigt (Werte wie bisher in RecorderView). */
export interface LiveWerte {
  peaks: readonly number[];
  gainDb: number;
  hinweisOrdner: string | null;
  dir: string | null;
}

/**
 * Die zwei Haupttasten in Anzeigereihenfolge: Aufnahme/Stopp, dann Eingang öffnen/schließen. Genau hauptTasten plus Klick; die
 * Taste ruft, was ihre Beschriftung sagt (Stopp → stop, sonst record; Eingang schließen → disarm, sonst arm). Ohne DOM prüfbar.
 */
export function liveKnoepfe(s: Pick<OberflaechenStand, 'recorder' | 'zustand'>, a: Pick<LiveAktionen, 'arm' | 'disarm' | 'record' | 'stop'>): TallyButtonProps[] {
  const t = hauptTasten(s);
  const T = RECORDER_TEXTE.taste;
  return [
    { ...t.aufnahme, onClick: t.aufnahme.label === T.stopp ? a.stop : a.record },
    { ...t.eingang, onClick: t.eingang.label === T.eingangSchliessen ? a.disarm : a.arm },
  ];
}

/** Statusmarke wie bisher (RecorderView.tsx:179-181) aus dem gemessenen Zustand; vor der ersten Antwort „unbekannt“. */
export function aufnahmeMarke(z: RecorderState | undefined): { tone: 'warning' | 'success' | 'muted'; text: string } {
  if (z === undefined) return { tone: 'muted', text: UNBEKANNT };
  if (z.status === 'recording') return { tone: 'warning', text: 'Aufnahme' };
  if (z.status === 'armed') return { tone: 'success', text: 'Bereit' };
  return { tone: 'muted', text: 'Inaktiv' };
}

const KOPF = 'text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted-foreground)]';
const HINWEIS = 'border border-[var(--status-warn)]/60 bg-[var(--status-warn)]/10';

export function LiveBereich({
  stand,
  werte,
  aktionen,
  presets,
}: {
  stand: OberflaechenStand;
  werte: LiveWerte;
  aktionen: LiveAktionen;
  /** Die Preset-Leiste (am Store, aus der View eingesetzt). */
  presets?: ReactNode;
}): React.JSX.Element {
  const T = RECORDER_TEXTE;
  const r = stand.recorder;
  const z = stand.zustand;
  const offen = z !== undefined && z.status !== 'idle';
  const kanaele = offen ? z.channels : (r?.channels ?? 2);
  const marke = aufnahmeMarke(z);
  const meldung = stand.meldung?.trim() ?? '';
  const datei = z?.filePath ?? null;
  const zaehler = r === undefined || r.loading ? T.grund.sucheGeraete : `${stand.geraete?.length ?? 0} Eingänge`;
  return (
    <section data-recorder="live" className="scroll-thin flex max-h-[calc(100vh_-_var(--header-h)_-_var(--statusbar-h)_-_2rem)] flex-col overflow-y-auto">
      <div className="shrink-0">{presets}</div>

      {/* Hinweise oben (E13). Wird es eng, geben zuerst die Meter nach (bis zur Mindesthöhe), dann dieser Kasten: er scrollt in
          sich, zeigt aber immer mindestens ein Band (2,75rem), damit Tasten, Uhr, Marke und Meter sichtbar bleiben. */}
      {(r?.hinweisEingang || werte.hinweisOrdner || meldung !== '') && (
        <div data-recorder="hinweise" className="scroll-thin mt-2 min-h-[2.75rem] space-y-2 overflow-y-auto">
          {/* Meldung des Hauptprozesses bis „OK“ (E13); der Toast zeigt sie zusätzlich 5 s. Zuerst, damit „OK“ auch im engen
              Kasten sichtbar bleibt (gemessen: hinter beiden langen Hinweisen lag sie bei 920×620 mit Panel ganz außer Sicht). */}
          {meldung !== '' && (
            <div data-recorder="meldung" role="status" className={cn('flex items-center gap-3 rounded-[var(--radius-lg)] px-3 py-1.5 text-sm', HINWEIS)}>
              <p className="flex-1 select-text font-semibold">{meldung}</p>
              <Button type="button" variant="outline" size="sm" uppercase={false} onClick={aktionen.meldungQuittieren}>
                {T.meldung.ok}
              </Button>
            </div>
          )}

          {/* Gemerkte Einstellungen, die beim Start nicht passten (#291) — bleibt, bis es erledigt ist. */}
          {(r?.hinweisEingang || werte.hinweisOrdner) && (
            <div role="alert" className={cn('flex items-start gap-3 rounded-[var(--radius-lg)] px-3 py-2 text-sm', HINWEIS)}>
              <div className="flex flex-1 flex-col gap-1 font-semibold">
                {r?.hinweisEingang && <p>{r.hinweisEingang}</p>}
                {werte.hinweisOrdner && <p>{werte.hinweisOrdner}</p>}
              </div>
              <Button type="button" variant="ghost" size="sm" uppercase={false} title="Hinweis schließen" aria-label="Hinweis schließen" onClick={aktionen.hinweiseSchliessen}>
                <span aria-hidden="true" className="text-lg leading-none">
                  ×
                </span>
              </Button>
            </div>
          )}
        </div>
      )}

      <div data-recorder="transport" className="mt-2 shrink-0 space-y-2.5 rounded-t-[var(--radius-xl)] border border-b-0 border-[var(--border)] bg-[var(--card)] px-4 pb-2 pt-3">
        {/* Kopf der Karte und Ziel-Anzeige in einer Zeile; der Pfad kürzt sich, die Zeile bricht nie um. */}
        <div className="flex min-h-[var(--control-h)] min-w-0 items-center gap-4">
          <div className="flex shrink-0 items-baseline gap-2">
            <h2 className={KOPF}>{T.aufnahme.titel}</h2>
            <span className="text-xs text-[var(--muted-foreground)]">{zaehler}</span>
          </div>
          <div data-recorder="ziel" className="flex min-w-0 flex-1 items-center justify-end gap-3 text-xs">
            <span className={cn('shrink-0', KOPF)}>{T.ziel.ordner}</span>
            <span className="min-w-0 truncate text-[var(--muted-foreground)]" title={werte.dir || undefined}>
              {werte.dir ? werte.dir : T.ziel.keinOrdner}
            </span>
            {datei ? (
              <Button type="button" variant="link" size="sm" uppercase={false} title={T.ziel.imOrdnerZeigen} className="min-w-0 max-w-[40%] shrink-0 px-0" onClick={() => aktionen.dateiZeigen(datei)}>
                <span className="truncate">→ {basename(datei)}</span>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {/* Reihenfolge fest, die Beschriftung wechselt (Aufnahme/Stopp, Eingang öffnen/schließen): der Index ist der stabile key. */}
          <div data-recorder="tasten" className="grid min-w-[18rem] max-w-xl flex-1 grid-cols-2 gap-3">
            {liveKnoepfe(stand, aktionen).map((k, i) => (
              <TallyButton key={i} {...k} />
            ))}
          </div>
          <div className="ml-auto flex items-center gap-4">
            <Badge data-recorder="marke" tone={marke.tone}>
              {marke.text}
            </Badge>
            <span data-recorder="uhr" className="tabular text-2xl font-extrabold">
              {formatClock(z?.recordedSec ?? 0)}
            </span>
          </div>
        </div>

        {/* Pegelkopf und Aufnahme-Verstärkung in einer Zeile (#94, E13 bei den Pegeln): hebt leise Eingänge an, wirkt live auf
            Pegel + Aufnahme. */}
        <div data-recorder="pegel-kopf" className="flex items-center gap-3 border-t border-[var(--border)]/60 pt-2.5">
          <h2 className={cn('w-12', KOPF)}>Pegel</h2>
          <span className="tabular w-9 text-[10px] font-bold text-[var(--muted-foreground)]">GAIN</span>
          <input
            type="range"
            min={-12}
            max={24}
            step={1}
            value={werte.gainDb}
            onChange={(e) => aktionen.setGain(Number(e.target.value))}
            className="min-w-16 flex-1 accent-[var(--primary)]"
            title="Aufnahme-Verstärkung"
          />
          <span className="tabular w-14 text-right text-xs font-bold">{werte.gainDb > 0 ? `+${werte.gainDb}` : werte.gainDb} dB</span>
          <Button type="button" variant="outline" size="sm" uppercase={false} onClick={() => aktionen.setGain(0)} disabled={werte.gainDb === 0} title="Auf 0 dB zurücksetzen">
            0 dB
          </Button>
          {!offen && <span className="ml-auto min-w-0 truncate text-xs text-[var(--muted-foreground)]">Eingang öffnen zum Messen</span>}
        </div>
        {werte.gainDb > 0 ? <p className="text-[11px] text-[var(--muted-foreground)]">Verstärkung hebt leise Aufnahmen an; zu viel übersteuert (Meter wird rot).</p> : null}
      </div>

      {/* Kanal-Meter: geben zuerst nach (flex-shrink 10000 gegen 1 beim Hinweiskasten; gemessen: bei 100 schrumpfte der Kasten schon um 1 px mit), bis zur Mindesthöhe, und scrollen bei
          vielen Kanälen in sich. */}
      <div data-recorder="pegel" className="scroll-thin min-h-[2.5rem] shrink-[10000] overflow-y-auto rounded-b-[var(--radius-xl)] border border-t-0 border-[var(--border)] bg-[var(--card)] px-4 pb-4 pt-1">
        <div data-recorder="pegel-zeilen" className={cn('flex flex-col gap-1.5', !offen && 'opacity-40')}>
          {Array.from({ length: Math.max(kanaele, 1) }, (_, c) => {
            const peak = werte.peaks[c] ?? 0;
            return (
              <div key={c} className="flex items-center gap-3">
                <span className="tabular w-9 text-[10px] font-bold text-[var(--muted-foreground)]">{`CH${String(c + 1).padStart(2, '0')}`}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                  <div className="h-full rounded-full transition-[width] duration-75" style={{ width: `${meterPct(peak)}%`, background: meterColor(peak) }} />
                </div>
                <span className="tabular w-12 text-right text-[10px] text-[var(--muted-foreground)]">{dbfsLabel(peak)} dB</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

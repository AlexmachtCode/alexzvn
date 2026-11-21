// Live-Bereich des Switchers (UX Welle 1, d2; Spec 3.4, 5.1; E7): die vier Haupttasten als TallyButtons (Cut, Auto, Aufnahme,
// Stream) mit dem Dauer-Feld neben Auto. Rein darstellend: Zustände kommen aus hauptTasten (lib/oberflaeche.ts), die Aktionen
// als Handler; die Abläufe (engine.cut, engine.auto, toggleRecording, toggleStreaming) bleiben in SwitcherView. Keine Kürzel (E1).
import { Fragment } from 'react';
import { TallyButton, type TallyButtonProps } from '@jm/ui';
import { SWITCHER_TEXTE, type hauptTasten } from '@/lib/oberflaeche';

/** Was die Haupttasten auslösen. */
export interface HaupttastenAktionen {
  cut(): void;
  auto(): void;
  aufnahme(): void;
  stream(): void;
}

/** Die vier Tasten als Props in fester Reihenfolge; Aufnahme und Stream tragen beim Laufen die Stopp-Beschriftung. */
export function liveTasten(t: ReturnType<typeof hauptTasten>, h: HaupttastenAktionen): TallyButtonProps[] {
  const T = SWITCHER_TEXTE.haupttaste;
  return [
    { ...t.cut, label: T.cut, onClick: () => h.cut() },
    { ...t.auto, label: T.auto, onClick: () => h.auto() },
    { ...t.aufnahme, label: t.aufnahme.state === 'live' ? T.aufnahmeStoppen : T.aufnehmen, onClick: () => h.aufnahme() },
    { ...t.stream, label: t.stream.state === 'live' ? T.streamStoppen : T.streamStarten, onClick: () => h.stream() },
  ];
}

export interface HaupttastenProps {
  tasten: TallyButtonProps[];
  /** Dauer der Überblendung in ms. */
  autoMs: number;
  onAutoMs(ms: number): void;
}

/** Die Tastenreihe unter den Monitoren: Cut, Auto, das Dauer-Feld, dann Aufnahme und Stream. */
export function Haupttasten({ tasten, autoMs, onAutoMs }: HaupttastenProps): React.JSX.Element {
  const T = SWITCHER_TEXTE.haupttaste;
  return (
    <div data-switcher="haupttasten" className="flex shrink-0 items-start gap-3 px-6 pb-3">
      {tasten.map((taste, i) => (
        <Fragment key={i}>
          <div className="min-w-0 flex-1">
            <TallyButton {...taste} />
          </div>
          {i === 1 && (
            <label
              data-switcher="dauer"
              className="flex shrink-0 flex-col items-center gap-1 pt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]"
            >
              {T.dauer}
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={autoMs}
                  onChange={(e) => onAutoMs(Number(e.target.value))}
                  className="h-8 w-16 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2 text-center text-sm tabular text-[var(--foreground)]"
                />
                <span>{T.ms}</span>
              </span>
            </label>
          )}
        </Fragment>
      ))}
    </div>
  );
}

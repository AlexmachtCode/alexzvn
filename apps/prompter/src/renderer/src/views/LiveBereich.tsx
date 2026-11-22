// Live-Bereich des Prompters (UX Welle 2a, Aufgabe d; Spec 3.4, 5.1; E4): die Vorschau (PrompterScroller, 16:9) immer sichtbar,
// darunter die vier Haupttasten als TallyButtons (GO/Pause, Anfang, Marke zurück, Marke vor) aus hauptTasten, die ±3-Knöpfe als
// normale Knöpfe, der Tempo-Regler (live wirksam, W2-8) und der Hinweis zur Leertaste. Die Tastatursteuerung (usePrompterHotkeys)
// hängt hier, weil dieser Bereich immer gemountet ist, auch bei offenem Panel. Rein darstellend: Aktionen kommen aus der View,
// das window liest nur der Hotkey-Hook in seinem Effekt.
import { Button, TallyButton, type TallyButtonProps } from '@jm/ui';
import type { PrompterState } from '@shared/types';
import { PrompterScroller } from '@/components/PrompterScroller';
import { Regler } from '@/components/Regler';
import { hauptTasten, PROMPTER_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import { usePrompterHotkeys } from '@/lib/useHotkeys';

export interface LiveAktionen {
  /** GO/Pause (`transport.toggle`). */
  toggle(): void;
  /** An den Anfang (`transport.reset`). */
  anfang(): void;
  /** Zur vorigen (-1) oder nächsten (1) Marke. */
  marke(richtung: 1 | -1): void;
  /** Relativ verschieben (±3). */
  nudge(delta: number): void;
  /** Tempo setzen. */
  tempo(v: number): void;
}

/** Die Haupttasten als Props in Anzeigereihenfolge (GO/Pause, Anfang, Marke zurück, Marke vor). Ohne DOM prüfbar. */
export function liveTasten(s: OberflaechenStand, a: LiveAktionen): TallyButtonProps[] {
  const t = hauptTasten(s);
  return [
    { ...t.go, onClick: a.toggle },
    { ...t.anfang, onClick: a.anfang },
    { ...t.markeZurueck, onClick: () => a.marke(-1) },
    { ...t.markeVor, onClick: () => a.marke(1) },
  ];
}

export function HauptTasten({ tasten }: { tasten: TallyButtonProps[] }): React.JSX.Element {
  return (
    <div data-prompter="haupttasten" className="grid w-full grid-cols-2 gap-3">
      {/* Reihenfolge fest, die Beschriftung wechselt (GO/Pause): der Index ist der stabile key. */}
      {tasten.map((taste, i) => (
        <TallyButton key={i} {...taste} />
      ))}
    </div>
  );
}

export function LiveBereich({
  state,
  stand,
  aktionen,
  onMarkers,
}: {
  state: PrompterState;
  stand: OberflaechenStand;
  aktionen: LiveAktionen;
  onMarkers: (positionsEm: number[]) => void;
}): React.JSX.Element {
  const T = PROMPTER_TEXTE;
  usePrompterHotkeys();
  return (
    <div data-prompter="live" className="space-y-4">
      <div>
        <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Vorschau</h3>
        <div data-prompter="vorschau" className="aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
          <PrompterScroller state={state} onMarkers={onMarkers} />
        </div>
      </div>

      <HauptTasten tasten={liveTasten(stand, aktionen)} />

      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" uppercase={false} className="flex-1" onClick={() => aktionen.nudge(-3)}>
          ↑ zurück
        </Button>
        <Button size="sm" variant="ghost" uppercase={false} className="flex-1" onClick={() => aktionen.nudge(3)}>
          ↓ vor
        </Button>
      </div>

      <Regler label={T.tempo.titel} value={state.config.speed} min={0.2} max={6} step={0.1} suffix={T.tempo.einheit} onChange={(v) => aktionen.tempo(v)} />

      <p className="text-[11px] text-[var(--muted-foreground)]">{T.live.hinweis}</p>
    </div>
  );
}

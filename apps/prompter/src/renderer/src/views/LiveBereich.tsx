// Live-Bereich des Prompters (UX Welle 2a, Aufgabe d; Spec 3.4, 5.1; E4): die Vorschau (PrompterScroller, 16:9) immer sichtbar,
// darunter die sechs Tasten des Transports als TallyButtons in der gewohnten Anordnung der alten OperatorView.tsx (Gesamtprüfung I1):
// oben Marke zurück, GO/Pause (breit), Marke vor; darunter ↑ zurück, Anfang, ↓ vor. GO/Pause, Anfang und die Marken kommen aus
// hauptTasten, ↑ zurück und ↓ vor (±3) haben kein Kürzel und keine Sperre. Danach der Tempo-Regler (live wirksam, W2-8) und der
// Hinweis zur Leertaste. Die Tastatursteuerung (usePrompterHotkeys) hängt in der Wurzel-View PrompterOberflaeche (R-T6b). Rein
// darstellend: Aktionen kommen aus der View, dieser Bereich liest kein window.
import { TallyButton, type TallyButtonProps } from '@jm/ui';
import type { PrompterState } from '@shared/types';
import { PrompterScroller } from '@/components/PrompterScroller';
import { Regler } from '@/components/Regler';
import { hauptTasten, PROMPTER_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';

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

/** Eine Taste des Transports: ihr Platz, die Props des TallyButton und, wo es einen gibt, der alte Tooltip (R-T6a). */
export interface LiveTaste {
  id: 'markeZurueck' | 'go' | 'markeVor' | 'zurueck3' | 'anfang' | 'vor3';
  taste: TallyButtonProps;
  tipp?: string;
}

/**
 * Die sechs Tasten des Transports Reihe für Reihe, in Spaltenfolge wie in der alten OperatorView.tsx (Ruling Gesamtprüfung I1):
 * oben Marke zurück, GO/Pause, Marke vor; unten ↑ zurück, Anfang, ↓ vor. Ohne DOM prüfbar.
 */
export function liveTasten(s: OberflaechenStand, aktionen: LiveAktionen): [LiveTaste[], LiveTaste[]] {
  const t = hauptTasten(s);
  const T = PROMPTER_TEXTE;
  return [
    [
      { id: 'markeZurueck', taste: { ...t.markeZurueck, onClick: () => aktionen.marke(-1) }, tipp: T.tipps.markeZurueck },
      { id: 'go', taste: { ...t.go, onClick: aktionen.toggle } },
      { id: 'markeVor', taste: { ...t.markeVor, onClick: () => aktionen.marke(1) }, tipp: T.tipps.markeVor },
    ],
    [
      { id: 'zurueck3', taste: { label: '↑ zurück', state: 'bereit', onClick: () => aktionen.nudge(-3) } },
      { id: 'anfang', taste: { ...t.anfang, onClick: aktionen.anfang } },
      { id: 'vor3', taste: { label: '↓ vor', state: 'bereit', onClick: () => aktionen.nudge(3) } },
    ],
  ];
}

/**
 * Ein Raster mit vier Spalten für beide Reihen (Ruling W62, Gesamtprüfung I1 nachgeschärft): GO und darunter Anfang liegen über
 * je zwei Spalten in der Mitte, die Marken bzw. ↑ zurück und ↓ vor außen über je eine (die alte Reihe war schmal | flex-1 |
 * schmal). Die Reihen teilen die Spalten (`contents`), Anfang steht also genau unter GO wie früher. Die Spalten nehmen
 * mindestens den Inhalt ihrer Taste.
 */
const BREIT: ReadonlySet<LiveTaste['id']> = new Set<LiveTaste['id']>(['go', 'anfang']);

/**
 * GO trägt im Lauf „LIVE“, „Pause“ und das Kürzel in der Schrift der LIVE-Fläche (19 px) und ist dann breiter als sein Platz
 * (gemessen, final-messung.mjs: Inhalt 232 px, mit Rand und Polster 268 px; Platz über zwei Spalten 175 px bei 1180 × 800, 162 px
 * bei 940 × 620). Der Platz schneidet am Rand der Taste ab, was übersteht:
 * Nichts davon liegt über einer Nachbartaste oder nimmt ihr einen Klick weg, und das Raster bleibt beim Wechsel zwischen GO und
 * Pause gleich (min-w-0). Den Fokusring der Taste schneidet der Platz mit ab; er zeichnet ihn deshalb selbst, gleich aussehend.
 */
const GO_PLATZ =
  'flex min-w-0 overflow-hidden rounded-[var(--radius-md)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)]';

export function HauptTasten({ tasten }: { tasten: readonly (readonly LiveTaste[])[] }): React.JSX.Element {
  return (
    <div data-prompter="haupttasten" className="grid w-full grid-cols-[1fr_1fr_1fr_1fr] gap-3">
      {tasten.map((reihe, r) => (
        <div key={r} data-prompter={r === 0 ? 'tasten-oben' : 'tasten-unten'} className="contents">
          {/* Reihenfolge fest, die Beschriftung wechselt (GO/Pause): die id ist der stabile key. Der TallyButton hat keinen title:
              Die Marken-Tasten stehen in einem Element mit dem alten Tooltip (R-T6a). */}
          {reihe.map(({ id, taste, tipp }) => (
            <div key={id} data-taste={id} title={tipp} className={`${id === 'go' ? GO_PLATZ : 'flex'}${BREIT.has(id) ? ' col-span-2' : ''}`}>
              <TallyButton {...taste} />
            </div>
          ))}
        </div>
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
  return (
    <div data-prompter="live" className="space-y-4">
      <div>
        <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Vorschau</h3>
        <div data-prompter="vorschau" className="aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
          <PrompterScroller state={state} onMarkers={onMarkers} />
        </div>
      </div>

      <HauptTasten tasten={liveTasten(stand, aktionen)} />

      <Regler label={T.tempo.titel} value={state.config.speed} min={0.2} max={6} step={0.1} suffix={T.tempo.einheit} onChange={(v) => aktionen.tempo(v)} />

      <p className="text-[11px] text-[var(--muted-foreground)]">{T.live.hinweis}</p>
    </div>
  );
}

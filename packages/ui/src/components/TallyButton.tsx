import { useEffect, useId, useRef } from 'react';
import { cn } from '../lib/cn';
import { erzeugeHalten, type HaltenRueckrufe, type HaltenSteuerung } from '../lib/halten';
import { LIVE_FLAECHE_KLASSE } from '../lib/status';
import { UI_TEXTE } from '../lib/texte';

/** Props wörtlich aus Spec 3.4. */
export interface TallyButtonProps {
  state: 'bereit' | 'live' | 'gesperrt';
  label: string;
  /** Nur Anzeige eines vorhandenen Kürzels (z. B. „F1“); das Kürzel selbst bleibt im Tool. */
  shortcut?: string;
  /** Pflicht bei 'gesperrt': sichtbar, als title und per aria-describedby. */
  disabledReason?: string;
  onClick?(): void;
  onPress?(): void;
  onRelease?(): void;
}

/** Das, was tallyHandler von einem Zeiger-Ereignis braucht (React.PointerEvent passt). */
export interface ZeigerEreignisArt {
  button: number;
  pointerId: number;
  currentTarget: { setPointerCapture?(id: number): void } | null;
}
/** Das, was tallyHandler von einem Tasten-Ereignis braucht (React.KeyboardEvent passt). */
export interface TastenEreignisArt {
  key: string;
  repeat: boolean;
  preventDefault(): void;
}
export interface TallyHandler {
  onClick(): void;
  onPointerDown(e: ZeigerEreignisArt): void;
  onPointerUp(): void;
  onPointerCancel(): void;
  onLostPointerCapture(): void;
  onKeyDown(e: TastenEreignisArt): void;
  onKeyUp(e: TastenEreignisArt): void;
  onBlur(): void;
}
/** Alles, was der <button> bekommt: Attribute, Klassen und die acht Handler aus tallyHandler. */
export interface TallyKnopfProps extends TallyHandler {
  type: 'button';
  'data-state': TallyButtonProps['state'];
  'aria-disabled'?: true;
  'aria-describedby'?: string;
  title?: string;
  className: string;
}

const HALTE_TASTEN = new Set([' ', 'Enter']);

/**
 * Die Ereignis-Verdrahtung des TallyButton als reine Funktion (E9), damit sie ohne Browser testbar ist.
 * - Halten nur mit der linken Taste bzw. Kontakt (button 0) oder Leertaste/Enter ohne Auto-Repeat.
 * - Loslassen über dieselbe Quelle; pointercancel, lostpointercapture und blur brechen ab (onRelease genau einmal).
 * - Gesperrt: nichts startet, nichts klickt; Loslassen bleibt möglich.
 * Nur aus dieser Datei exportiert, nicht aus index.ts.
 */
export function tallyHandler(p: TallyButtonProps, halten: HaltenSteuerung): TallyHandler {
  const gesperrt = p.state === 'gesperrt';
  return {
    onClick() {
      if (!gesperrt) p.onClick?.();
    },
    onPointerDown(e) {
      if (gesperrt || e.button !== 0 || halten.gehalten) return;
      try {
        e.currentTarget?.setPointerCapture?.(e.pointerId);
      } catch {
        // Capture ist optional; ohne sie beendet spätestens blur oder pointercancel das Halten.
      }
      halten.druecken('zeiger');
    },
    onPointerUp() {
      halten.loslassen('zeiger');
    },
    onPointerCancel() {
      halten.abbrechen();
    },
    onLostPointerCapture() {
      halten.abbrechen();
    },
    onKeyDown(e) {
      // Ein gehaltenes Enter klickt im Browser mit jeder Wiederholung erneut (mehrfaches Take); nur der erste Druck zählt.
      if (e.key === 'Enter' && e.repeat) e.preventDefault();
      if (gesperrt || e.repeat || !HALTE_TASTEN.has(e.key)) return;
      halten.druecken('taste');
    },
    onKeyUp(e) {
      if (HALTE_TASTEN.has(e.key)) halten.loslassen('taste');
    },
    onBlur() {
      halten.abbrechen();
    },
  };
}

/** Sichtbarer Sperrgrund: fehlt er oder ist er leer, steht „gesperrt – kein Grund angegeben“ (E9). Nur aus dieser Datei. */
export function tallyGrund(disabledReason: string | undefined): string {
  return disabledReason || UI_TEXTE.gesperrtOhneGrund;
}

const BASIS =
  'flex w-full min-h-[var(--control-h-lg)] flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border-2 ' +
  'px-4 py-2 text-center select-none touch-none ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ' +
  'motion-safe:transition-colors motion-safe:duration-150';

const FLAECHE: Record<TallyButtonProps['state'], string> = {
  bereit:
    'border-[var(--tally-ready)] bg-[var(--card)] text-[15px] font-extrabold text-[var(--foreground)] hover:bg-[var(--muted)]',
  // E3: Weiß auf der LIVE-Fläche ist nur „große Schrift“ – deshalb trägt die ganze Fläche LIVE_FLAECHE_KLASSE
  // (19 px, extrafett), und nichts darin setzt eine kleinere Schrift.
  live: cn('border-[var(--tally-live)]', LIVE_FLAECHE_KLASSE),
  gesperrt:
    'cursor-not-allowed border-[var(--border)] bg-[var(--muted)] text-[15px] font-extrabold text-[var(--muted-foreground)]',
};

const KUERZEL: Record<TallyButtonProps['state'], string> = {
  bereit: 'rounded-[var(--radius-sm)] border border-[var(--border)] px-1 font-sans text-[11px] font-semibold text-[var(--muted-foreground)]',
  live: 'rounded-[var(--radius-sm)] border border-current px-1 font-sans',
  gesperrt: 'rounded-[var(--radius-sm)] border border-[var(--border)] px-1 font-sans text-[11px] font-semibold text-[var(--muted-foreground)]',
};

/**
 * Alle Props des <button> als reine Funktion (E9): type, data-state, Sperre (aria-disabled, title, aria-describedby),
 * Klassen und die Handler aus tallyHandler. Der Baustein reicht sie unverändert per Spread durch, damit der Test genau
 * das prüft, was am Knopf hängt. Nur aus dieser Datei exportiert.
 */
export function tallyKnopfProps(p: TallyButtonProps, halten: HaltenSteuerung, grundId: string): TallyKnopfProps {
  const gesperrt = p.state === 'gesperrt';
  return {
    type: 'button',
    'data-state': p.state,
    'aria-disabled': gesperrt ? true : undefined,
    'aria-describedby': gesperrt ? grundId : undefined,
    title: gesperrt ? tallyGrund(p.disabledReason) : undefined,
    className: cn(BASIS, FLAECHE[p.state]),
    ...tallyHandler(p, halten),
  };
}

/**
 * Halten-Steuerung je Knopf: beim ersten Render erzeugt, bei jedem weiteren mit den neuesten Rückrufen aktualisiert
 * (ein Loslassen nach einem Neu-Rendern ruft das aktuelle onRelease). Nur aus dieser Datei exportiert.
 */
export function haltenFuerRender(ref: { current: HaltenSteuerung | null }, r: HaltenRueckrufe): HaltenSteuerung {
  if (ref.current === null) {
    ref.current = erzeugeHalten({ onPress: r.onPress, onRelease: r.onRelease });
  } else {
    ref.current.aktualisiere({ onPress: r.onPress, onRelease: r.onRelease });
  }
  return ref.current;
}

/** Körper des Effekts „Zustand gewechselt“: Wird der Knopf beim Halten gesperrt, endet das Halten (onRelease einmal). */
export function haltenBeiZustand(state: TallyButtonProps['state'], halten: HaltenSteuerung): void {
  if (state === 'gesperrt') halten.abbrechen();
}

/** Körper des Aufräumens beim Abbau: ein laufendes Halten endet (onRelease einmal). */
export function haltenBeiAbbau(halten: HaltenSteuerung): void {
  halten.abbrechen();
}

/**
 * Großer Sende-Knopf (Spec 3.4): `bereit` neutral mit grüner Kante, `live` rot gefüllt mit „LIVE“-Kennung, `gesperrt`
 * gedimmt mit sichtbarem Grund. Halten-zum-Sprechen über onPress/onRelease; onRelease kommt in jedem Fall genau einmal,
 * auch beim Wechsel auf `gesperrt` und beim Unmount. Füllt die Breite seines Behälters; die Anordnung macht das Tool.
 * Die Verdrahtung (Spread, zwei Effekte, haltenFuerRender) prüft tally.test.tsx am Quelltext dieser Datei.
 */
export function TallyButton(p: TallyButtonProps): React.JSX.Element {
  const { state, label, shortcut } = p;
  const haltenRef = useRef<HaltenSteuerung | null>(null);
  const halten = haltenFuerRender(haltenRef, p);
  useEffect(() => haltenBeiZustand(state, halten), [state, halten]);
  useEffect(() => () => haltenBeiAbbau(halten), [halten]);
  const grundId = useId();

  return (
    <button {...tallyKnopfProps(p, halten, grundId)}>
      <span className="inline-flex items-center gap-2">
        {state === 'live' ? (
          <span className="rounded-[var(--radius-sm)] border-2 border-current px-1.5 py-0.5 tracking-[0.08em]">
            {UI_TEXTE.live}
          </span>
        ) : null}
        <span>{label}</span>
        {shortcut ? (
          <kbd className={KUERZEL[state]}>
            <span className="sr-only">{UI_TEXTE.kuerzel}: </span>
            {shortcut}
          </kbd>
        ) : null}
      </span>
      {state === 'gesperrt' ? (
        <span id={grundId} className="text-[11px] font-semibold text-[var(--muted-foreground)]">
          {tallyGrund(p.disabledReason)}
        </span>
      ) : null}
    </button>
  );
}

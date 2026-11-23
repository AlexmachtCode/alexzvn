import { useEffect, useRef } from 'react';
import { cn } from '../lib/cn';
import { beobachteFensterVerlust, type HaltenSteuerung } from '../lib/halten';
import { LIVE_FLAECHE_KLASSE } from '../lib/status';
import { UI_TEXTE } from '../lib/texte';
import {
  haltenBeiAbbau,
  haltenBeiZustand,
  haltenFuerRender,
  tallyGrund,
  tallyHandler,
  type TallyHandler,
} from './TallyButton';

/** Props wörtlich aus Spec 4.1. */
export interface HalteKnopfProps {
  label: string;
  /** Hilfetext des Knopfs; auch sein Name für Screenreader (aria-label). Gesperrt steht „Gesperrt: ‹Grund›“ an seiner Stelle. */
  title: string;
  /** Wird gerade gehalten (die App weiß es; der Knopf zeigt es nur an). */
  aktiv: boolean;
  /** Der Grund der Sperre; gesetzt (auch leer) heißt gesperrt. */
  gesperrt?: string;
  onPress(): void;
  onRelease(): void;
  className?: string;
}

/** Alles, was der <button> bekommt: Handler aus tallyHandler (ohne onClick), Attribute und Klassen. */
export interface HalteKnopfKnopfProps extends Omit<TallyHandler, 'onClick'> {
  type: 'button';
  'aria-pressed': boolean;
  'aria-disabled'?: true;
  'aria-label': string;
  title: string;
  className: string;
}

const BASIS =
  'inline-flex min-h-[var(--control-h)] items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 px-3 text-center select-none touch-none ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ' +
  'motion-safe:transition-colors motion-safe:duration-150';

const RUHIG = 'border-[var(--field-border)] bg-[var(--card)] text-[13px] font-extrabold text-[var(--foreground)] hover:bg-[var(--muted)]';
const AKTIV = cn('border-[var(--tally-live)]', LIVE_FLAECHE_KLASSE);
const GESPERRT = 'cursor-not-allowed border-[var(--border)] bg-[var(--muted)] text-[13px] font-extrabold text-[var(--muted-foreground)]';

/**
 * Alle Props des <button> als reine Funktion, damit der Test genau das prüft, was am Knopf hängt. Die Handler kommen aus
 * tallyHandler (eine Halte-Logik, keine zweite Kopie), ohne onClick: Ein Klick tut nichts, nur das Halten zählt.
 */
export function halteKnopfProps(p: HalteKnopfProps, halten: HaltenSteuerung): HalteKnopfKnopfProps {
  const gesperrt = p.gesperrt !== undefined;
  const text = gesperrt ? UI_TEXTE.gesperrt(tallyGrund(p.gesperrt)) : p.title;
  const { onClick, ...handler } = tallyHandler(
    { state: gesperrt ? 'gesperrt' : 'bereit', label: p.label, disabledReason: p.gesperrt, onPress: p.onPress, onRelease: p.onRelease },
    halten,
  );
  void onClick;
  return {
    type: 'button',
    'aria-pressed': p.aktiv,
    'aria-disabled': gesperrt ? true : undefined,
    'aria-label': text,
    title: text,
    className: cn(BASIS, gesperrt ? GESPERRT : p.aktiv ? AKTIV : RUHIG, p.className),
    ...handler,
  };
}

/**
 * Knopf zum Halten (Spec 4.1), z. B. Talkback je Gast oder die Richtungstasten einer Kamera: gedrückt halten über Zeiger,
 * Leertaste oder Enter; onRelease kommt je Druck genau einmal, auch bei Abbruch, Fensterverlust, Sperre und Aushängen.
 * Nur eine Mindesthöhe, damit eine Höhe aus className (z. B. h-12) eindeutig gilt.
 * Die Verdrahtung (Spread, drei Effekte, haltenFuerRender) prüft halteknopf.test.tsx am Quelltext dieser Datei.
 */
export function HalteKnopf(p: HalteKnopfProps): React.JSX.Element {
  const haltenRef = useRef<HaltenSteuerung | null>(null);
  const halten = haltenFuerRender(haltenRef, p);
  useEffect(() => haltenBeiZustand(p.gesperrt === undefined ? 'bereit' : 'gesperrt', halten, p.gesperrt), [p.gesperrt, halten]);
  useEffect(() => () => haltenBeiAbbau(halten), [halten]);
  useEffect(() => beobachteFensterVerlust(typeof window === 'undefined' ? null : window, typeof document === 'undefined' ? null : document, halten), [halten]);

  return <button {...halteKnopfProps(p, halten)}>{p.label}</button>;
}

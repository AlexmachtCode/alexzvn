import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import type { AnleitungsAnsicht, AnleitungsEreignis, BlasenAnsicht } from '../lib/anleitung';
import { BLASEN_GROESSE, blasenFokus, blasenPlatz, blasenTaste, type Groesse, type Rechteck } from '../lib/anleitung-dom';
import { cn } from '../lib/cn';
import { STATUS_SYMBOL, STATUS_SYMBOL_KLASSE } from '../lib/status';
import { ANLEITUNG_TEXTE, UI_TEXTE } from '../lib/texte';
import { useAnleitungsZiel } from '../lib/useAnleitungsZiel';

/** Stimme der Anleitung, von der App (an/aus je Rechner, „trotzdem“ je Sitzung, Fehler aus useAnsage). */
export interface AnleitungsStimme {
  vorhanden: boolean;
  an: boolean;
  /** Fehler der Ansage (AnsageFehler aus useAnsage, P5). */
  fehler: 'fehlt' | 'abspielen' | null;
  umschalten(): void;
  trotzdemAn(): void;
}

export interface AnleitungsSchichtProps {
  ansicht: AnleitungsAnsicht;
  aufEreignis(e: AnleitungsEreignis): void;
  /** Lage und Ebene der Schicht, von der App (z. B. „pointer-events-none fixed inset-0 z-[65]“). */
  className: string;
  /** Zusatz-Stil der Sprechblase (z. B. noDragRegion über der Titelleiste). */
  blasenStil?: CSSProperties;
  stimme: AnleitungsStimme;
}

const KNOPF =
  'inline-flex h-[var(--control-h)] items-center justify-center rounded-[var(--radius-md)] border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)] motion-safe:transition-colors motion-safe:duration-150';
const KNOPF_HAUPT = 'border-[var(--tally-selected)] bg-[var(--tally-selected)] text-[var(--primary-foreground)]';
const KNOPF_NEBEN = 'border-[var(--field-border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--muted)]';

/** Ein Knopf der Bedienleiste: Name (data-knopf), Text, Ereignis, Hauptknopf? */
export interface BedienKnopf {
  name: keyof BlasenAnsicht['knoepfe'];
  text: string;
  ereignis: AnleitungsEreignis;
  haupt: boolean;
}

/**
 * Die Knöpfe der Bedienleiste genau nach `knoepfe` (Spec 3.1), in fester Reihenfolge. „Ja, überspringen“ beendet die
 * Anleitung (Spec 4); „Zurück“ heißt auf der Rückfrage „Zurück zur Anleitung“. Nur aus dieser Datei exportiert.
 */
export function bedienKnoepfe(b: BlasenAnsicht): BedienKnopf[] {
  const alle: BedienKnopf[] = [
    { name: 'zurueck', text: b.art === 'rueckfrage' ? ANLEITUNG_TEXTE.zurAnleitung : ANLEITUNG_TEXTE.zurueck, ereignis: { art: 'zurueck' }, haupt: false },
    { name: 'weiter', text: ANLEITUNG_TEXTE.weiter, ereignis: { art: 'weiter' }, haupt: true },
    { name: 'jaUeberspringen', text: ANLEITUNG_TEXTE.jaUeberspringen, ereignis: { art: 'beenden' }, haupt: true },
    { name: 'anleitungUeberspringen', text: ANLEITUNG_TEXTE.anleitungUeberspringen, ereignis: { art: 'anleitungUeberspringen' }, haupt: false },
    { name: 'ueberspringen', text: ANLEITUNG_TEXTE.ueberspringen, ereignis: { art: 'ueberspringen' }, haupt: false },
    { name: 'brauchtNicht', text: ANLEITUNG_TEXTE.brauchtNicht, ereignis: { art: 'brauchtNicht', kapitel: b.kapitel?.id ?? '' }, haupt: false },
    { name: 'spaeter', text: ANLEITUNG_TEXTE.spaeter, ereignis: { art: 'spaeter' }, haupt: false },
  ];
  return alle.filter((k) => b.knoepfe[k.name]);
}

/** Fenstergröße (nur im Effekt gelesen; ohne Browser die Mindestgröße des Launchers 980 × 640). */
function useFenster(): Groesse {
  const [fenster, setFenster] = useState<Groesse>({ breite: 980, hoehe: 640 });
  useEffect(() => {
    const messen = (): void =>
      setFenster((alt) => (alt.breite === window.innerWidth && alt.hoehe === window.innerHeight ? alt : { breite: window.innerWidth, hoehe: window.innerHeight }));
    messen();
    window.addEventListener('resize', messen);
    return () => window.removeEventListener('resize', messen);
  }, []);
  return fenster;
}

/**
 * Hervorhebung mit Sprechblase (Spec 3, 3.1, 7; EP11, EP18). Nicht modal: nur die Sprechblase nimmt Klicks an, das
 * Abdunkeln ist rein optisch. Ohne Ziel ganzflächig abgedunkelt; fehlt ein Ziel zur Laufzeit, gar nicht, und die Blase
 * sagt ehrlich, was zu tun ist. Ohne Sprechblase: nichts.
 */
export function AnleitungsSchicht(p: AnleitungsSchichtProps): React.JSX.Element | null {
  const blase = p.ansicht.blase;
  const zielRechteck = useAnleitungsZiel(blase === null ? null : blase.ziel);
  const fenster = useFenster();
  if (blase === null) return null;
  return <AnleitungsBlase {...p} zielRechteck={zielRechteck} fenster={fenster} />;
}

/** Die Darstellung bei gemessenem Ziel und Fenster (für Tests ohne DOM). Nur aus dieser Datei exportiert. */
export function AnleitungsBlase(p: AnleitungsSchichtProps & { zielRechteck: Rechteck | null; fenster: Groesse }): React.JSX.Element | null {
  const blase = p.ansicht.blase;
  const id = useId();
  const blaseRef = useRef<HTMLDivElement>(null);
  const grund = useRef<'geoeffnet' | 'bedienung' | 'erkannt'>('geoeffnet');
  const schluessel = blase === null ? '' : `${blase.kapitel?.id ?? ''}|${blase.ansage.id}|${blase.nurZeigen}`;
  useEffect(() => {
    if (blaseRef.current === null) return;
    blasenFokus(blaseRef.current, document.activeElement, grund.current);
    grund.current = 'erkannt';
  }, [schluessel]);
  if (blase === null) return null;

  const ereignis = (e: AnleitungsEreignis): void => {
    grund.current = 'bedienung';
    p.aufEreignis(e);
  };
  const ziel = blase.ziel === null ? null : p.zielRechteck;
  const zielFehlt = blase.ziel !== null && p.zielRechteck === null;
  const platz = blasenPlatz(ziel, p.fenster, BLASEN_GROESSE);
  const kopfId = `${id}-kopf`;
  const textId = `${id}-text`;

  return (
    <div className={cn('pointer-events-none', p.className)} data-anleitung-schicht="">
      {blase.ziel === null ? <div aria-hidden="true" data-abdunkeln="flaeche" className="absolute inset-0 bg-[var(--background)]/70" /> : null}
      {ziel !== null ? (
        <div
          aria-hidden="true"
          data-abdunkeln="ziel"
          className="absolute rounded-[var(--radius-md)] outline-2 outline-offset-2 outline-[var(--tally-selected)] ring-[9999px] ring-[var(--background)]/70"
          style={{ left: ziel.x, top: ziel.y, width: ziel.breite, height: ziel.hoehe }}
        />
      ) : null}
      <div
        ref={blaseRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={blase.kapitel !== null ? kopfId : textId}
        aria-describedby={blase.kapitel !== null ? textId : undefined}
        tabIndex={-1}
        data-seite={platz.seite}
        onKeyDown={(e) => blasenTaste(e, blase.knoepfe.spaeter, ereignis)}
        style={{ left: platz.x, top: platz.y, ...p.blasenStil }}
        className="pointer-events-auto absolute flex max-h-[300px] w-[var(--panel-w)] max-w-[calc(100vw-16px)] flex-col gap-3 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--tally-selected)] bg-[var(--surface-raised)] p-4 text-sm text-[var(--foreground)] shadow-xl outline-none motion-safe:transition-opacity motion-safe:duration-150"
      >
        {blase.kapitel !== null ? (
          <p id={kopfId} className="flex items-baseline justify-between gap-2 text-xs font-semibold text-[var(--muted-foreground)]">
            <span className="font-extrabold text-[var(--foreground)]">{blase.kapitel.titel}</span>
            {blase.zaehler !== null ? <span className="tabular">{ANLEITUNG_TEXTE.zaehler(blase.zaehler.n, blase.zaehler.m)}</span> : null}
          </p>
        ) : null}
        {blase.art === 'schonErledigt' || blase.nurZeigen ? (
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">
            {blase.art === 'schonErledigt' ? ANLEITUNG_TEXTE.schonErledigt : ANLEITUNG_TEXTE.nurZeigen}
          </p>
        ) : null}
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          {blase.produktionsWarnung ? (
            <p data-hinweis="produktion" className="flex gap-2">
              <span aria-hidden="true" className={STATUS_SYMBOL_KLASSE.warn}>
                {STATUS_SYMBOL.warn}
              </span>
              <span>
                <span className="sr-only">{UI_TEXTE.zustand.warn}: </span>
                {ANLEITUNG_TEXTE.produktion}
              </span>
            </p>
          ) : null}
          <p id={textId} className="leading-snug">
            {blase.text}
          </p>
          {zielFehlt ? <p data-hinweis="ziel-fehlt">{blase.zielFehlt ?? ANLEITUNG_TEXTE.zielFehlt}</p> : null}
          {blase.wartetAufNeustart ? <p className="text-[var(--muted-foreground)]">{ANLEITUNG_TEXTE.neustartWartet}</p> : null}
          {blase.wiederfinden !== null ? <p className="text-xs text-[var(--muted-foreground)]">{blase.wiederfinden}</p> : null}
        </div>
        {blase.optionen.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {blase.optionen.map((o, i) => (
              <button key={o.knopf} type="button" data-option={i} onClick={() => ereignis({ art: 'option', index: i })} className={cn(KNOPF, KNOPF_HAUPT)}>
                {o.knopf}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {bedienKnoepfe(blase).map((k) => (
            <button key={k.name} type="button" data-knopf={k.name} onClick={() => ereignis(k.ereignis)} className={cn(KNOPF, k.haupt ? KNOPF_HAUPT : KNOPF_NEBEN)}>
              {k.text}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
          {blase.ansage.hinweis === 'keineStimme' ? <span>{ANLEITUNG_TEXTE.keineStimme}</span> : null}
          {blase.ansage.hinweis === 'produktion' || blase.ansage.hinweis === 'eingriff' ? <span>{ANLEITUNG_TEXTE.stimmeProduktion}</span> : null}
          {blase.ansage.hinweis === 'produktion' ? (
            <button type="button" data-knopf="stimme-trotzdem" onClick={p.stimme.trotzdemAn} className={cn(KNOPF, KNOPF_NEBEN)}>
              {ANLEITUNG_TEXTE.stimmeTrotzdem}
            </button>
          ) : null}
          {blase.ansage.hinweis === 'aus' || blase.ansage.hinweis === null ? (
            <button type="button" data-knopf="stimme" onClick={p.stimme.umschalten} className={cn(KNOPF, KNOPF_NEBEN)}>
              {blase.ansage.hinweis === 'aus' ? ANLEITUNG_TEXTE.stimmeAn : ANLEITUNG_TEXTE.stimmeAus}
            </button>
          ) : null}
          {p.stimme.fehler === 'fehlt' ? <span data-hinweis="ansage">{ANLEITUNG_TEXTE.ansageFehlt}</span> : null}
          {p.stimme.fehler === 'abspielen' ? <span data-hinweis="ansage">{ANLEITUNG_TEXTE.ansageFehler}</span> : null}
        </div>
      </div>
    </div>
  );
}

import { useId } from 'react';
import type { AnleitungsAnsicht, AnleitungsEreignis } from '../lib/anleitung';
import { cn } from '../lib/cn';
import { KAPITEL_SYMBOL, KAPITEL_SYMBOL_KLASSE } from '../lib/status';
import { ANLEITUNG_TEXTE, zahlText } from '../lib/texte';

export interface AnleitungsUebersichtProps {
  ansicht: AnleitungsAnsicht;
  aufEreignis(e: AnleitungsEreignis): void;
  titel: string;
  unterzeile: string;
  tipp?: string;
  /** Detailzeile je Kapitel-ID (z. B. „Aktiv: GitHub.“), von der App. */
  details?: Partial<Record<string, string>>;
  /** Direkte Aktion je Kapitel-ID (Bedienerklick wie in der früheren Checkliste), von der App. */
  aktionen?: Partial<Record<string, { knopf: string; ausfuehren(): void }>>;
  /** Diagnose des Speichers (U25–U28) oder null. */
  speicherHinweis: string | null;
  stimme: { vorhanden: boolean; an: boolean; umschalten(): void; namensnennung: string | null };
  schliessen(): void;
}

const KNOPF =
  'inline-flex h-[var(--control-h)] items-center justify-center rounded-[var(--radius-md)] border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)] motion-safe:transition-colors motion-safe:duration-150';
const KNOPF_HAUPT = 'border-[var(--tally-selected)] bg-[var(--tally-selected)] text-[var(--primary-foreground)]';
const KNOPF_NEBEN = 'border-[var(--field-border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--muted)]';

/**
 * Kapitelübersicht (Spec 3.1, 4, 6; EP20–EP22): je Kapitel Zeichen (aria-hidden) mit Zustandswort für den Screenreader,
 * Nummer, Titel, Kurztext, Detail und direkte Aktion der App, „Zeig mir“, „Brauche ich nicht“ bzw. „Doch gebraucht“ (Name
 * mit dem Kapitel, z. B. „Zeig mir: Anmelden“); darunter Hauptknopf (starten oder fortsetzen, mit dem Titel der Anleitung),
 * „Anleitung beenden“, Stimme mit Namensnennung, Diagnose, Tipp, Fertig. „‹Titel› abgeschlossen“ nur, wenn alles erledigt
 * ist, nach dem Beenden mit offenen Kapiteln „Anleitung beendet“. Ein Haken nur bei erledigt (Anti-Ziel); die Übersicht
 * selbst bedient nichts.
 */
export function AnleitungsUebersicht(p: AnleitungsUebersichtProps): React.JSX.Element {
  const titelId = `${useId()}-titel`;
  const a = p.ansicht;
  return (
    <section aria-labelledby={titelId} className="flex flex-col gap-4 text-sm text-[var(--foreground)]">
      <header className="flex flex-col gap-1">
        <h2 id={titelId} className="text-base font-extrabold">
          {p.titel}
        </h2>
        <p className="text-[var(--muted-foreground)]">{p.unterzeile}</p>
      </header>
      {p.speicherHinweis !== null ? (
        <p role="status" data-hinweis="speicher" className="rounded-[var(--radius-md)] border border-[var(--status-warn)] px-3 py-2">
          {p.speicherHinweis}
        </p>
      ) : null}
      {a.abgeschlossen ? (
        <p data-hinweis="abgeschlossen" className="font-semibold">
          {ANLEITUNG_TEXTE.abgeschlossen(a.titel)}
        </p>
      ) : null}
      {a.beendet ? (
        <p data-hinweis="beendet" className="text-[var(--muted-foreground)]">
          {ANLEITUNG_TEXTE.beendet}
        </p>
      ) : null}
      <ol className="flex flex-col gap-2">
        {a.kapitel.map((k) => {
          const detail = p.details?.[k.id];
          const aktion = p.aktionen?.[k.id];
          return (
            <li key={k.id} data-kapitel={k.id} data-zustand={k.zustand} className="flex gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-3">
              <span aria-hidden="true" className={cn('w-4 shrink-0 text-center font-extrabold', KAPITEL_SYMBOL_KLASSE[k.zustand])}>
                {KAPITEL_SYMBOL[k.zustand]}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="font-semibold">
                  <span className="sr-only">{ANLEITUNG_TEXTE.zustand[k.zustand]}: </span>
                  {zahlText(k.nummer)}. {k.titel}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">{k.kurz}</p>
                {detail !== undefined ? (
                  <p data-detail={k.id} className="text-xs text-[var(--muted-foreground)]">
                    {detail}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  {aktion !== undefined ? (
                    <button type="button" data-aktion={k.id} aria-label={`${aktion.knopf}: ${k.titel}`} onClick={aktion.ausfuehren} className={cn(KNOPF, KNOPF_NEBEN)}>
                      {aktion.knopf}
                    </button>
                  ) : null}
                  {k.zeigMir ? (
                    <button
                      type="button"
                      data-knopf="zeigMir"
                      aria-label={`${ANLEITUNG_TEXTE.zeigMir}: ${k.titel}`}
                      onClick={() => p.aufEreignis({ art: 'starten', kapitel: k.id })}
                      className={cn(KNOPF, KNOPF_NEBEN)}
                    >
                      {ANLEITUNG_TEXTE.zeigMir}
                    </button>
                  ) : null}
                  {k.brauchtNicht ? (
                    <button
                      type="button"
                      data-knopf="brauchtNicht"
                      aria-label={`${ANLEITUNG_TEXTE.brauchtNicht}: ${k.titel}`}
                      onClick={() => p.aufEreignis({ art: 'brauchtNicht', kapitel: k.id })}
                      className={cn(KNOPF, KNOPF_NEBEN)}
                    >
                      {ANLEITUNG_TEXTE.brauchtNicht}
                    </button>
                  ) : null}
                  {k.dochGebraucht ? (
                    <button
                      type="button"
                      data-knopf="dochGebraucht"
                      aria-label={`${ANLEITUNG_TEXTE.dochGebraucht}: ${k.titel}`}
                      onClick={() => p.aufEreignis({ art: 'dochGebraucht', kapitel: k.id })}
                      className={cn(KNOPF, KNOPF_NEBEN)}
                    >
                      {ANLEITUNG_TEXTE.dochGebraucht}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" data-knopf="haupt" onClick={() => p.aufEreignis({ art: 'starten' })} className={cn(KNOPF, KNOPF_HAUPT)}>
          {a.hauptknopf === 'fortsetzen' && a.fortsetzen !== null
            ? ANLEITUNG_TEXTE.fortsetzen(a.titel, a.fortsetzen.n, a.fortsetzen.m)
            : ANLEITUNG_TEXTE.starten(a.titel)}
        </button>
        {!a.abgeschlossen && !a.beendet ? (
          <button type="button" data-knopf="beenden" onClick={() => p.aufEreignis({ art: 'beenden' })} className={cn(KNOPF, KNOPF_NEBEN)}>
            {ANLEITUNG_TEXTE.beenden}
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 text-xs text-[var(--muted-foreground)]">
        {p.stimme.vorhanden ? (
          <div>
            <button type="button" data-knopf="stimme" onClick={p.stimme.umschalten} className={cn(KNOPF, KNOPF_NEBEN)}>
              {p.stimme.an ? ANLEITUNG_TEXTE.stimmeAus : ANLEITUNG_TEXTE.stimmeAn}
            </button>
          </div>
        ) : (
          <p data-hinweis="keine-stimme">{ANLEITUNG_TEXTE.keineStimme}</p>
        )}
        {p.stimme.namensnennung !== null ? <p data-hinweis="namensnennung">{p.stimme.namensnennung}</p> : null}
      </div>
      {p.tipp !== undefined ? <p className="text-xs text-[var(--muted-foreground)]">{p.tipp}</p> : null}
      <div className="flex justify-end">
        <button type="button" data-knopf="schliessen" onClick={p.schliessen} className={cn(KNOPF, KNOPF_NEBEN)}>
          {ANLEITUNG_TEXTE.fertig}
        </button>
      </div>
    </section>
  );
}

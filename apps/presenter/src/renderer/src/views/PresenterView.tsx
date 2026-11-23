// Live-Bereich des Referenten (UX Welle 2b, Presenter d2; B6, B12, B13, Muster d): links die aktuelle Folie, darunter eine Reihe
// Schwarz · Zurück · „Gehe zu“ · Weiter · Weiß (vier TallyButtons mit Kürzelzeile B, ←, →, W); rechts Timer-Leiste, nächste Folie
// und Notizen. Die Folienübersicht liegt nur hier im Inhalt (main), nicht über Kopf und Leiste. Kein Abo: Folien und Stand kommen
// aus der Wurzel-View (useFolien, useStand), die Tasten rufen die Aktionen der Wurzel (referentAktionen).
import { useState } from 'react';
import { cn, TallyButton } from '@jm/ui';
import type { Slide } from '@shared/types';
import { SlideCanvas } from '@/components/SlideCanvas';
import { TimerBar } from '@/components/TimerBar';
import { referentTasten, type OberflaechenStand, type ReferentAktionen } from '@/lib/oberflaeche';

// Programmfläche (B5): die schwarzen Folienflächen um SlideCanvas bleiben schwarz, unabhängig von den Tokens.
const FOLIENFLAECHE = 'bg-black';

export interface LiveBereichProps {
  /** Aus dem einen Stand der Wurzel-View: Präsentationszustand (Folie, Pause, Schleife) und der Live-Zustand des JM Timers. */
  stand: Pick<OberflaechenStand, 'praesentation' | 'timerZustand'>;
  /** Folien des Payloads (useFolien); null, bis sie geladen sind. */
  folien: Slide[] | null;
  referent: Pick<ReferentAktionen, 'zurueck' | 'weiter' | 'geheZu' | 'schwarz' | 'weiss'>;
  /** Folienübersicht offen (Zustand der Wurzel; der Knopf „Übersicht“ steht in der Leiste). */
  uebersicht: boolean;
  onUebersicht(offen: boolean): void;
}

export function PresenterView({ stand, folien, referent, uebersicht, onUebersicht }: LiveBereichProps) {
  const p = stand.praesentation;
  if (!folien) {
    return (
      <div data-presenter="live" className="relative h-full grid place-items-center select-none text-[var(--muted-foreground)]">
        Lade Präsentation…
      </div>
    );
  }
  const current = p === undefined ? null : (folien[p.index] ?? null);
  // Mit Schleife folgt auf die letzte Folie wieder die erste (#293).
  const next = p === undefined ? null : (folien[p.index + 1] ?? (p.schleife && folien.length > 1 ? folien[0] : null));
  const timer = stand.timerZustand;

  return (
    <div data-presenter="live" className="relative h-full min-h-0 flex flex-col select-none">
      <div className="flex-1 min-h-0 grid grid-cols-[1.7fr_1fr] gap-4 p-4">
        {/* current */}
        <div className="min-h-0 min-w-0 flex flex-col">
          <Label>Aktuelle Folie</Label>
          <div data-presenter="aktuelle-folie" className={cn('flex-1 min-h-0 flex items-center justify-center rounded-lg overflow-hidden ring-1 ring-[var(--border)]', FOLIENFLAECHE)}>
            {current && <SlideCanvas slide={current} maxWidth={1280} />}
          </div>
          <HauptTasten stand={stand} anzahl={folien.length} referent={referent} />
        </div>

        {/* next + notes */}
        <div className="min-h-0 min-w-0 flex flex-col gap-4">
          {timer?.connected && <TimerBar timer={timer} />}
          <div className="flex flex-col" style={{ flex: '0 0 38%' }}>
            <Label>Nächste Folie</Label>
            <div data-presenter="naechste-folie" className={cn('flex-1 min-h-0 flex items-center justify-center rounded-lg overflow-hidden ring-1 ring-[var(--border)]', FOLIENFLAECHE)}>
              {next ? (
                <SlideCanvas slide={next} maxWidth={640} />
              ) : p !== undefined ? (
                <span className="text-[var(--muted-foreground)] text-sm">Ende der Präsentation</span>
              ) : null}
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <Label>Notizen</Label>
            <div
              data-presenter="notizen"
              className="flex-1 min-h-0 overflow-auto scroll-thin bg-[var(--card)] rounded-lg ring-1 ring-[var(--border)] p-4 text-[15px] leading-relaxed whitespace-pre-wrap"
            >
              {current?.notes ? current.notes : <span className="text-[var(--muted-foreground)]">Keine Notizen</span>}
            </div>
          </div>
        </div>
      </div>

      {uebersicht && <Uebersicht folien={folien} index={p?.index} onGeheZu={referent.geheZu} onSchliessen={() => onUebersicht(false)} />}
    </div>
  );
}

/**
 * Die Reihe unter der aktuellen Folie (B12): Schwarz · Zurück · „Gehe zu“ · Weiter · Weiß. Zurück und Weiter stehen links und
 * rechts von „Gehe zu“ wie bisher, Schwarz und Weiß an den Rändern. Zustände aus referentTasten (B13, B6; nie live), Kürzel nur
 * angezeigt (die Tasten selbst bleiben in usePresenterKeys). Bei schmaler Spalte (Panel offen) bricht die Reihe um, statt Knöpfe
 * abzuschneiden. Ohne Hooks: die Rückrufe sind direkt prüfbar.
 */
export function HauptTasten({
  stand,
  anzahl,
  referent,
}: {
  stand: Pick<OberflaechenStand, 'praesentation'>;
  anzahl: number;
  referent: Pick<ReferentAktionen, 'zurueck' | 'weiter' | 'geheZu' | 'schwarz' | 'weiss'>;
}) {
  const t = referentTasten(stand);
  // Die Hülle ist flex: der TallyButton füllt ihre Höhe. Mit items-stretch sind so alle Tasten einer Zeile gleich hoch, auch wenn
  // eine Beschriftung umbricht („Schwarz · an“ bei 1024 breit: gemessen 92 statt 90 px).
  const taste = (kennung: string, zustand: (typeof t)['schwarz'], onClick: () => void) => (
    <div data-presenter={kennung} className="flex min-w-24 flex-1">
      <TallyButton {...zustand} kuerzelZeile onClick={onClick} />
    </div>
  );
  return (
    <div data-presenter="tasten" className="mt-3 flex flex-wrap items-stretch justify-center gap-2">
      {taste('taste-schwarz', t.schwarz, referent.schwarz)}
      {taste('taste-zurueck', t.zurueck, referent.zurueck)}
      <GeheZu anzahl={anzahl} onGeheZu={referent.geheZu} />
      {taste('taste-weiter', t.weiter, referent.weiter)}
      {taste('taste-weiss', t.weiss, referent.weiss)}
    </div>
  );
}

/** „Gehe zu“: Folie 1 bis m (Index n - 1), sonst nichts (wie bisher doJump). */
export function geheZuIndex(eingabe: string, anzahl: number): number | null {
  const n = Number(eingabe);
  return eingabe !== '' && Number.isFinite(n) && n >= 1 && n <= anzahl ? n - 1 : null;
}

/** Feld „Folie“ (nur Ziffern) und Knopf „Gehe zu“: springt und leert das Feld; Enter im Feld sendet ab (B10: kein Weiterblättern). */
function GeheZu({ anzahl, onGeheZu }: { anzahl: number; onGeheZu(index: number): void }) {
  const [jump, setJump] = useState('');
  return (
    <form
      data-presenter="gehe-zu"
      onSubmit={(e) => {
        e.preventDefault();
        const i = geheZuIndex(jump, anzahl);
        if (i !== null) onGeheZu(i);
        setJump('');
      }}
      className="flex shrink-0 items-center self-center gap-1"
    >
      <input
        value={jump}
        onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))}
        placeholder="Folie"
        className="h-9 w-20 text-center rounded-md bg-[var(--input)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
      />
      <button type="submit" className="h-9 px-3 rounded-md bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--highlight)]">
        Gehe zu
      </button>
    </form>
  );
}

/**
 * Folienübersicht (wie bisher, aber nur im Inhalt): Titel, „schließen ✕“, je Folie Vorschau, Nummer und Titel, die aktuelle
 * hervorgehoben; ein Klick springt dorthin und schließt. Ohne Hooks.
 */
export function Uebersicht({ folien, index, onGeheZu, onSchliessen }: { folien: Slide[]; index: number | undefined; onGeheZu(index: number): void; onSchliessen(): void }) {
  return (
    <div data-presenter="uebersicht-flaeche" className="absolute inset-0 z-10 bg-[var(--background)]/90 backdrop-blur-sm p-6 overflow-auto scroll-thin">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Folienübersicht</h3>
        <button type="button" onClick={onSchliessen} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          schließen ✕
        </button>
      </div>
      <div className="grid grid-cols-4 lg:grid-cols-6 gap-3">
        {folien.map((s, i) => (
          <button
            key={s.id}
            type="button"
            data-presenter="uebersicht-folie"
            onClick={() => {
              onGeheZu(i);
              onSchliessen();
            }}
            className={cn(
              'group rounded-lg overflow-hidden ring-2 transition-all',
              i === index ? 'ring-[var(--primary)]' : 'ring-[var(--border)] hover:ring-[var(--muted-foreground)]',
            )}
          >
            <div className={cn('aspect-video flex items-center justify-center', FOLIENFLAECHE)}>
              <SlideCanvas slide={s} maxWidth={360} />
            </div>
            <div className="px-2 py-1 text-left text-[11px] bg-[var(--card)] flex items-center gap-1.5">
              <span className="tabular text-[var(--muted-foreground)]">{i + 1}</span>
              <span className="truncate">{s.title}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-bold mb-1.5">{children}</div>;
}

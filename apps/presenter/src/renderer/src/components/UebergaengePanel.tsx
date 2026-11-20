import { useEffect, useState } from 'react';
import { cn } from '@jm/ui';
import type { Slide, UebergangsArt } from '@shared/types';
import { useProject } from '@/store/project';
import {
  DAUER_MAX_MS,
  DAUER_MIN_MS,
  normiereWiedergabe,
  STANDZEIT_MAX_SEK,
  STANDZEIT_MIN_SEK,
} from '../../../shared/wiedergabe';
import { inputCls, labelCls, SegBtn } from './Inspector';

/**
 * #293: Reiter „Übergänge“ — Übergang und Schleife für alle Folien, darunter die Abweichungen der
 * ausgewählten Folie. Der Übergang gilt beim Hereinkommen einer Folie, auf der Publikumsansicht.
 */
export function UebergaengePanel({ slide }: { slide: Slide }) {
  const roh = useProject((s) => s.doc.wiedergabe);
  const slides = useProject((s) => s.doc.slides);
  const setWiedergabe = useProject((s) => s.setWiedergabe);
  const setSlideUebergang = useProject((s) => s.setSlideUebergang);
  const setSlideStandzeit = useProject((s) => s.setSlideStandzeit);
  const w = normiereWiedergabe(roh);
  const nr = slides.findIndex((s) => s.id === slide.id) + 1;

  const eigen = slide.uebergang ?? null;
  const eigeneStandzeit = slide.standzeitSek ?? null;

  return (
    <div className="h-full flex flex-col overflow-auto scroll-thin p-4 gap-5">
      {/* ---- Für alle Folien ---- */}
      <section className="space-y-3">
        <div className={labelCls}>Für alle Folien</div>

        <div className="space-y-1.5">
          <div className="text-xs font-semibold">Übergang</div>
          <ArtWahl art={w.uebergang.art} onChange={(art) => setWiedergabe({ uebergang: { ...w.uebergang, art } })} />
          {w.uebergang.art === 'blende' && (
            <SekundenFeld
              label="Dauer der Überblendung (s)"
              wert={w.uebergang.dauerMs / 1000}
              min={DAUER_MIN_MS / 1000}
              max={DAUER_MAX_MS / 1000}
              schritt={0.1}
              onCommit={(sek) => setWiedergabe({ uebergang: { ...w.uebergang, dauerMs: Math.round(sek * 1000) } })}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={w.schleife}
              onChange={(e) => setWiedergabe({ schleife: e.target.checked })}
            />
            <span>
              <span className="font-semibold">Schleife</span>
              <span className="block text-xs text-[var(--muted-foreground)]">
                Blättert nach der Standzeit selbst weiter, nach der letzten Folie wieder von vorn. In der
                Referentenansicht live an- und ausschaltbar.
              </span>
            </span>
          </label>
          <SekundenFeld
            label="Standzeit je Folie (s)"
            wert={w.standzeitSek}
            min={STANDZEIT_MIN_SEK}
            max={STANDZEIT_MAX_SEK}
            schritt={1}
            onCommit={(sek) => setWiedergabe({ standzeitSek: sek })}
          />
        </div>
      </section>

      <div className="h-px bg-[var(--border)]" />

      {/* ---- Diese Folie ---- */}
      <section className="space-y-3">
        <div className={labelCls}>
          Diese Folie{nr > 0 ? ` (${nr}${slide.title ? ` · ${slide.title}` : ''})` : ''}
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-semibold">Übergang beim Hereinkommen</div>
          <div className="flex gap-1">
            <SegBtn active={eigen == null} onClick={() => setSlideUebergang(slide.id, null)}>
              Wie alle
            </SegBtn>
            <SegBtn
              active={eigen?.art === 'schnitt'}
              onClick={() => setSlideUebergang(slide.id, { art: 'schnitt', dauerMs: eigen?.dauerMs ?? w.uebergang.dauerMs })}
            >
              Schnitt
            </SegBtn>
            <SegBtn
              active={eigen?.art === 'blende'}
              onClick={() => setSlideUebergang(slide.id, { art: 'blende', dauerMs: eigen?.dauerMs ?? w.uebergang.dauerMs })}
            >
              Überblendung
            </SegBtn>
          </div>
          {eigen?.art === 'blende' && (
            <SekundenFeld
              label="Dauer der Überblendung (s)"
              wert={eigen.dauerMs / 1000}
              min={DAUER_MIN_MS / 1000}
              max={DAUER_MAX_MS / 1000}
              schritt={0.1}
              onCommit={(sek) => setSlideUebergang(slide.id, { art: 'blende', dauerMs: Math.round(sek * 1000) })}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-semibold">Standzeit in der Schleife</div>
          <div className="flex gap-1">
            <SegBtn active={eigeneStandzeit == null} onClick={() => setSlideStandzeit(slide.id, null)}>
              Wie alle ({fmt(w.standzeitSek)} s)
            </SegBtn>
            <SegBtn
              active={eigeneStandzeit != null}
              onClick={() => setSlideStandzeit(slide.id, eigeneStandzeit ?? w.standzeitSek)}
            >
              Eigene
            </SegBtn>
          </div>
          {eigeneStandzeit != null && (
            <SekundenFeld
              label="Standzeit dieser Folie (s)"
              wert={eigeneStandzeit}
              min={STANDZEIT_MIN_SEK}
              max={STANDZEIT_MAX_SEK}
              schritt={1}
              onCommit={(sek) => setSlideStandzeit(slide.id, sek)}
            />
          )}
        </div>
      </section>

      <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
        Der Übergang wirkt auf der Publikumsansicht, wenn die Folie hereinkommt. Die Referentenansicht schaltet
        immer direkt um.
      </p>
    </div>
  );
}

function ArtWahl({ art, onChange }: { art: UebergangsArt; onChange: (a: UebergangsArt) => void }) {
  return (
    <div className="flex gap-1">
      <SegBtn active={art === 'schnitt'} onClick={() => onChange('schnitt')}>
        Schnitt
      </SegBtn>
      <SegBtn active={art === 'blende'} onClick={() => onChange('blende')}>
        Überblendung
      </SegBtn>
    </div>
  );
}

function fmt(n: number): string {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

/**
 * Zahlenfeld in Sekunden: tippt frei (auch „0,“ zwischendurch), übernimmt beim Verlassen oder Enter,
 * begrenzt auf min…max. Komma und Punkt gehen beide.
 */
function SekundenFeld({
  label,
  wert,
  min,
  max,
  schritt,
  onCommit,
}: {
  label: string;
  wert: number;
  min: number;
  max: number;
  schritt: number;
  onCommit: (sek: number) => void;
}) {
  const [text, setText] = useState(fmt(wert));
  useEffect(() => setText(fmt(wert)), [wert]);
  const uebernehmen = (): void => {
    const n = Number(text.replace(',', '.'));
    if (!Number.isFinite(n)) {
      setText(fmt(wert));
      return;
    }
    const geklemmt = Math.max(min, Math.min(max, Math.round(n / schritt) * schritt));
    setText(fmt(geklemmt));
    if (geklemmt !== wert) onCommit(geklemmt);
  };
  return (
    <label className="block space-y-1">
      <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
      <input
        className={cn(inputCls, 'tabular')}
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={uebernehmen}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

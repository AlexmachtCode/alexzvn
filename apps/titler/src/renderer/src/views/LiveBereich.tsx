// Live-Bereich des Titlers (UX-Pilot C10; Spec 3.4, 5.1, Anhang A „Titler“; E11, E12): immer sichtbar die CG-Vorschau,
// darunter die Haupttasten als TallyButtons (Take, Clear, mit Einträgen ◀ Eintrag und Eintrag ▶) und die Hinweiszeile.
// Rein darstellend: Zustände kommen aus hauptTasten (lib/oberflaeche.ts), Aktionen über Props. Keine Kürzel (UO5).
import type { RefObject } from 'react';
import { TallyButton, type TallyButtonProps } from '@jm/ui';
import { hauptTasten, TITLER_TEXTE } from '@/lib/oberflaeche';

export interface LiveBereichProps {
  previewRef: RefObject<HTMLCanvasElement>;
  /** On-Air aus der Engine (E11): Take zeigt LIVE, solange die Grafik eingeblendet ist bzw. wird. */
  live: boolean;
  ndiActive: boolean;
  activeEntry: number;
  anzahl: number;
  onTake(): void;
  onClear(): void;
  onSchritt(delta: -1 | 1): void;
}

/** Die Haupttasten als Props (2 ohne, 4 mit Einträgen); LiveBereich rendert genau diese. Ohne DOM prüfbar. */
export function liveTasten(p: LiveBereichProps): TallyButtonProps[] {
  const t = hauptTasten(p.live, p.activeEntry, p.anzahl);
  const tasten: TallyButtonProps[] = [
    { ...t.take, label: TITLER_TEXTE.take, onClick: () => p.onTake() },
    { ...t.clear, label: TITLER_TEXTE.clear, onClick: () => p.onClear() },
  ];
  if (t.eintrag) {
    tasten.push({ ...t.eintrag.zurueck, label: TITLER_TEXTE.zurueck, onClick: () => p.onSchritt(-1) });
    tasten.push({ ...t.eintrag.weiter, label: TITLER_TEXTE.weiter, onClick: () => p.onSchritt(1) });
  }
  return tasten;
}

export function LiveBereich(p: LiveBereichProps): React.JSX.Element {
  return (
    <div data-titler="live" className="flex min-w-0 flex-1 flex-col gap-4 p-5">
      <div className="cg-checker grid min-h-0 flex-1 place-items-center overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
        <canvas ref={p.previewRef} width={960} height={540} className="h-full w-full object-contain" />
      </div>
      <div data-titler="haupttasten" className="grid grid-cols-2 gap-3">
        {liveTasten(p).map((taste) => (
          <TallyButton key={taste.label} {...taste} />
        ))}
      </div>
      <p data-titler="hinweiszeile" className="-mt-1 text-[11px] text-[var(--muted-foreground)]">
        {p.ndiActive ? TITLER_TEXTE.hinweisNdiAn : TITLER_TEXTE.hinweisNdiAus}
      </p>
    </div>
  );
}

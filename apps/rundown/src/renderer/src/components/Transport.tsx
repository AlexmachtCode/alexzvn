// Transport unter der Liste (UX Welle 1, Aufgabe d; E11, R10, R15): ◀ Zurück, GO und Weiter ▶ als TallyButtons (Kürzel Leertaste, ↑, ↓),
// darunter die scharfe Zeile mit dem Zähler und die Quittung der zuletzt gefeuerten Zeile. Die Zustände kommen aus hauptTasten
// (lib/oberflaeche.ts), die Handler sind die des Stores (nav). Rein darstellend: kein window, kein Effekt.
import { TallyButton } from '@jm/ui';
import { hauptTasten, RUNDOWN_TEXTE } from '@/lib/oberflaeche';
import type { RundownNav, RundownState } from '@shared/types';

// Container-Query statt Viewport: tastenAnordnung(breite) beschreibt das Raster. Die Klassen stehen als Literal da (Tailwind-Scan); 292 = TASTEN_ZWEI_BREITE, 444 = TASTEN_DREI_BREITE; gemessen wird die Inhaltsbox nach px-4.
const RASTER = 'grid w-full grid-cols-1 gap-3 @[292px]:grid-cols-2 @[444px]:grid-cols-3';
// GO steht zuoberst, solange die Tasten nicht in einer Reihe stehen: gestapelt (eine Spalte, R17) und breit über ◀ ▶ (zwei
// Spalten); in einer Reihe in der Mitte. Im Markup bleibt die Reihenfolge ◀, GO, ▶ (Tab wie bisher).
const GO_PLATZ = 'order-first @[292px]:col-span-2 @[444px]:order-none @[444px]:col-span-1';

/** Die drei Haupttasten (Rolle als key, nie die Beschriftung), die scharfe Zeile samt Zähler und die Quittung. */
export function Transport({ state, onNav }: { state: RundownState; onNav: (cmd: RundownNav) => void }): React.JSX.Element {
  const T = RUNDOWN_TEXTE.transport;
  const rows = state.doc.rows;
  const idx = state.index;
  const cur = rows[idx];
  const fired = state.lastFired;
  const t = hauptTasten({ state });
  const quittung = fired
    ? fired.sent.length
      ? fired.sent.map((s) => `${s.line}${s.delivered ? '' : ' ⚠'}`).join('  ·  ')
      : T.keineAktionen
    : null;

  return (
    <div data-rundown="transport" className="@container shrink-0 space-y-3 border-t border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <div data-rundown="haupttasten" className={RASTER}>
        <TallyButton key="zurueck" {...t.zurueck} onClick={() => onNav({ t: 'prev' })} />
        <div key="go" className={GO_PLATZ}>
          <TallyButton {...t.go} onClick={() => onNav({ t: 'go' })} />
        </div>
        <TallyButton key="weiter" {...t.weiter} onClick={() => onNav({ t: 'next' })} />
      </div>

      <div className="flex items-end gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{T.scharf}</div>
          <div className="truncate text-lg font-semibold" title={cur?.label}>
            {cur ? cur.label : T.keineZeile}
          </div>
        </div>
        <div className="tabular shrink-0 text-sm text-[var(--muted-foreground)]">
          {rows.length ? idx + 1 : 0} / {rows.length}
        </div>
      </div>

      {fired && quittung !== null && (
        <div className="min-w-0" title={quittung}>
          <div className="truncate text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
            {T.zuletztGefeuert} {fired.rowLabel}
          </div>
          <div className="truncate text-xs text-[var(--muted-foreground)]">{quittung}</div>
        </div>
      )}
    </div>
  );
}

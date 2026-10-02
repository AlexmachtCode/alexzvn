import { useState } from 'react';
import { loeseSprungZiel } from '@shared/sprung';
import { sendeArgs, sperrenFuer, verschiebeZeilen, zeilenArt, zeilenHinweis, type ShowSicht } from '@shared/zeilen';
import { actionLabel } from '@/lib/capabilities';
import { addRow, duplicateRow, removeRow } from '@/lib/doc';
import type { RundownDoc } from '@shared/types';

const iconBtn =
  'rounded px-1.5 py-0.5 text-xs text-[var(--muted-foreground)] hover:bg-[var(--highlight)] hover:text-[var(--foreground)]';

/** Der Ablaufplan als Cue-Stack: scharfe Zeile hervorgehoben, Auswahl mit Ring. */
export function RundownList({
  doc,
  index,
  selectedId,
  onSelect,
  onSetCue,
  onDoc,
  sicht,
}: {
  doc: RundownDoc;
  index: number;
  selectedId: string | null;
  onSelect: (rowId: string) => void;
  onSetCue: (rowIndex: number) => void;
  onDoc: (doc: RundownDoc) => void;
  /** Gemerkte Show: Sperren (4.5) und aufgelöste Sprung-Nummern (6.2). */
  sicht: ShowSicht;
}) {
  // Drag&Drop-Umsortierung (Issue #84): Quell-Index festhalten, Ziel-Index für die
  // Einfüge-Markierung. Nutzt dieselbe bewege-Funktion wie die ↑/↓-Buttons.
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  function endDrag(): void {
    setDragIdx(null);
    setOverIdx(null);
  }
  function bewege(from: number, to: number): void {
    const rows = verschiebeZeilen(doc.rows, from, to, sicht.showGemerkt);
    if (rows !== doc.rows) onDoc({ ...doc, rows });
  }
  function drop(to: number): void {
    if (dragIdx !== null && dragIdx !== to) bewege(dragIdx, to);
    endDrag();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {doc.rows.map((row, i) => {
          const isCue = i === index;
          const isSel = row.id === selectedId;
          const isDragging = dragIdx === i;
          const isDropTarget = overIdx === i && dragIdx !== null && dragIdx !== i;
          // 4.5: Ablaufzeilen (lebend oder entfallen) sind bei gemerkter Show nicht verschiebbar.
          const sperre = sperrenFuer(row, sicht.showGemerkt);
          const art = zeilenArt(row);
          const hinweis = zeilenHinweis(row, sicht.showGemerkt, sicht.mitIveo);
          return (
            <div
              key={row.id}
              draggable={!sperre.verschieben}
              onDragStart={(e) => {
                if (sperre.verschieben) return;
                setDragIdx(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overIdx !== i) setOverIdx(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(i);
              }}
              onDragEnd={endDrag}
              onClick={() => onSelect(row.id)}
              style={isCue ? { borderColor: 'var(--brand-yellow)' } : undefined}
              className={`${sperre.verschieben ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} rounded-lg border px-3 py-2 ${
                art === 'entfallen' ? 'opacity-60' : ''
              } ${
                isCue ? 'bg-[var(--input)]/70' : 'border-[var(--border)] bg-[var(--card)]/40 hover:bg-[var(--card)]/70'
              } ${isSel ? 'ring-1 ring-[var(--muted-foreground)]' : ''} ${isDragging ? 'opacity-40' : ''} ${
                isDropTarget ? 'border-t-2 border-t-[var(--brand-yellow)]' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`select-none text-xs text-[var(--muted-foreground)] ${sperre.verschieben ? 'invisible' : ''}`}
                  title="ziehen zum Umsortieren"
                >
                  ⠿
                </span>
                <span className="tabular w-6 text-right text-xs text-[var(--muted-foreground)]">{i + 1}</span>
                <span className={`font-medium ${art === 'entfallen' ? 'line-through' : ''}`}>{row.label}</span>
                {hinweis && (
                  <span
                    className={`rounded px-1.5 text-[10px] ${
                      art === 'entfallen' ? 'text-[var(--warning)]' : 'text-[var(--muted-foreground)]'
                    }`}
                    title={hinweis}
                  >
                    {art === 'entfallen' ? hinweis : sicht.mitIveo ? 'iveo' : 'Show'}
                  </span>
                )}
                {isCue && (
                  <span
                    className="rounded px-1.5 text-[10px] font-bold text-[var(--brand-dark)]"
                    style={{ background: 'var(--brand-yellow)' }}
                  >
                    SCHARF
                  </span>
                )}
                <div className="ml-auto flex items-center gap-0.5">
                  <button
                    title="scharf setzen"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetCue(i);
                    }}
                    className={iconBtn}
                  >
                    ▶
                  </button>
                  <button
                    title={sperre.verschieben ? (hinweis ?? 'nach oben') : 'nach oben'}
                    disabled={sperre.verschieben}
                    onClick={(e) => {
                      e.stopPropagation();
                      bewege(i, i - 1);
                    }}
                    className={`${iconBtn} disabled:opacity-30`}
                  >
                    ↑
                  </button>
                  <button
                    title={sperre.verschieben ? (hinweis ?? 'nach unten') : 'nach unten'}
                    disabled={sperre.verschieben}
                    onClick={(e) => {
                      e.stopPropagation();
                      bewege(i, i + 1);
                    }}
                    className={`${iconBtn} disabled:opacity-30`}
                  >
                    ↓
                  </button>
                  <button
                    title="Zeile duplizieren"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDoc(duplicateRow(doc, row.id));
                    }}
                    className={iconBtn}
                  >
                    ⧉
                  </button>
                  <button
                    title={sperre.loeschen ? (hinweis ?? 'Zeile löschen') : 'Zeile löschen'}
                    disabled={sperre.loeschen}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDoc(removeRow(doc, row.id));
                    }}
                    className={`${iconBtn} disabled:opacity-30`}
                  >
                    ✕
                  </button>
                </div>
              </div>
              {row.actions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1 pl-12">
                  {row.actions.map((a) => (
                    <span
                      key={a.id}
                      className={`rounded px-1.5 py-0.5 text-[11px] ${
                        a.enabled
                          ? 'bg-[var(--muted)]/60 text-[var(--foreground)]'
                          : 'bg-[var(--input)]/60 text-[var(--muted-foreground)] line-through'
                      }`}
                    >
                      {a.delayMs ? (
                        <span className="text-[var(--muted-foreground)]" title={`${a.delayMs} ms Verzögerung`}>
                          ⏱{a.delayMs}ms{' '}
                        </span>
                      ) : null}
                      {actionLabel(
                        a.role,
                        a.verb,
                        sendeArgs(a, (x) => loeseSprungZiel(x, sicht.ablaufSchluessel, sicht.eigeneTimerListe)) ?? [
                          'Ziel entfallen',
                        ],
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {doc.rows.length === 0 && (
          <div className="p-6 text-center text-sm text-[var(--muted-foreground)]">Noch keine Zeilen.</div>
        )}
      </div>
      <div className="border-t border-[var(--border)] p-2">
        <button
          onClick={() => onDoc(addRow(doc, doc.rows.length - 1))}
          className="w-full rounded-md border border-dashed border-[var(--border)] py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--highlight)]"
        >
          + Zeile hinzufügen
        </button>
      </div>
    </div>
  );
}

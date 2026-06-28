import { useState } from 'react';
import { actionLabel } from '@/lib/capabilities';
import { addRow, duplicateRow, moveRow, removeRow } from '@/lib/doc';
import type { RundownDoc } from '@shared/types';

const iconBtn =
  'rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100';

/** Der Ablaufplan als Cue-Stack: scharfe Zeile hervorgehoben, Auswahl mit Ring. */
export function RundownList({
  doc,
  index,
  selectedId,
  onSelect,
  onSetCue,
  onDoc,
}: {
  doc: RundownDoc;
  index: number;
  selectedId: string | null;
  onSelect: (rowId: string) => void;
  onSetCue: (rowIndex: number) => void;
  onDoc: (doc: RundownDoc) => void;
}) {
  // Drag&Drop-Umsortierung (Issue #84): Quell-Index festhalten, Ziel-Index für die
  // Einfüge-Markierung. Nutzt dieselbe moveRow-Mutation wie die ↑/↓-Buttons.
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  function endDrag(): void {
    setDragIdx(null);
    setOverIdx(null);
  }
  function drop(to: number): void {
    if (dragIdx !== null && dragIdx !== to) onDoc(moveRow(doc, dragIdx, to));
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
          return (
            <div
              key={row.id}
              draggable
              onDragStart={(e) => {
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
              className={`cursor-grab rounded-lg border px-3 py-2 active:cursor-grabbing ${
                isCue ? 'bg-neutral-800/70' : 'border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900/70'
              } ${isSel ? 'ring-1 ring-neutral-500' : ''} ${isDragging ? 'opacity-40' : ''} ${
                isDropTarget ? 'border-t-2 border-t-[var(--brand-yellow)]' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="select-none text-xs text-neutral-600" title="ziehen zum Umsortieren">
                  ⠿
                </span>
                <span className="tabular w-6 text-right text-xs text-neutral-500">{i + 1}</span>
                <span className="font-medium">{row.label}</span>
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
                    title="nach oben"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDoc(moveRow(doc, i, i - 1));
                    }}
                    className={iconBtn}
                  >
                    ↑
                  </button>
                  <button
                    title="nach unten"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDoc(moveRow(doc, i, i + 1));
                    }}
                    className={iconBtn}
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
                    title="Zeile löschen"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDoc(removeRow(doc, row.id));
                    }}
                    className={iconBtn}
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
                          ? 'bg-neutral-700/60 text-neutral-200'
                          : 'bg-neutral-800/60 text-neutral-500 line-through'
                      }`}
                    >
                      {actionLabel(a.role, a.verb, a.args)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {doc.rows.length === 0 && (
          <div className="p-6 text-center text-sm text-neutral-500">Noch keine Zeilen.</div>
        )}
      </div>
      <div className="border-t border-neutral-800 p-2">
        <button
          onClick={() => onDoc(addRow(doc, doc.rows.length - 1))}
          className="w-full rounded-md border border-dashed border-neutral-700 py-2 text-sm text-neutral-400 hover:bg-neutral-800"
        >
          + Zeile hinzufügen
        </button>
      </div>
    </div>
  );
}

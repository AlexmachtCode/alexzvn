import { useState } from 'react';
import { buildActionLine } from '@shared/conductor';
import { CAPABILITIES, KNOWN_ROLES, capAction } from '@/lib/capabilities';
import { addAction, duplicateAction, removeAction, updateAction, updateRow } from '@/lib/doc';
import type { RundownAction, RundownDoc, RundownRow } from '@shared/types';

const select =
  'rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-100';
const input =
  'w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-100';

/** Default-Argumente einer Capability-Aktion (Reihenfolge wie im Protokoll). */
function defaultArgs(role: string, verb: string): (string | number)[] {
  const a = capAction(role, verb);
  return (a?.args ?? []).map((arg) => arg.default ?? (arg.type === 'number' ? 0 : ''));
}

export function RowEditor({
  doc,
  row,
  onDoc,
}: {
  doc: RundownDoc;
  row: RundownRow;
  onDoc: (doc: RundownDoc) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-800 p-3">
        <label className="text-[10px] uppercase tracking-wider text-neutral-500">Zeilen-Titel</label>
        <input
          key={row.id}
          defaultValue={row.label}
          onBlur={(e) => onDoc(updateRow(doc, row.id, { label: e.target.value }))}
          className={input}
        />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500">
          Aktionen beim GO ({row.actions.length})
        </div>
        {row.actions.map((a) => (
          <ActionRow key={a.id} doc={doc} rowId={row.id} action={a} onDoc={onDoc} />
        ))}
        <button
          onClick={() => onDoc(addAction(doc, row.id))}
          className="w-full rounded-md border border-dashed border-neutral-700 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800"
        >
          + Aktion hinzufügen
        </button>
      </div>
    </div>
  );
}

function ActionRow({
  doc,
  rowId,
  action,
  onDoc,
}: {
  doc: RundownDoc;
  rowId: string;
  action: RundownAction;
  onDoc: (doc: RundownDoc) => void;
}) {
  const cap = capAction(action.role, action.verb);
  const line = buildActionLine(action.role, action.verb, action.args);
  const [fired, setFired] = useState<'' | 'ok' | 'off'>('');

  async function test(): Promise<void> {
    const ok = await window.jmrundown.fireAction(action.role, action.verb, action.args);
    setFired(ok ? 'ok' : 'off');
    setTimeout(() => setFired(''), 1300);
  }

  function setRole(role: string): void {
    const verb = CAPABILITIES[role]?.actions[0]?.verb ?? '';
    onDoc(updateAction(doc, rowId, action.id, { role, verb, args: defaultArgs(role, verb) }));
  }
  function setVerb(verb: string): void {
    onDoc(updateAction(doc, rowId, action.id, { verb, args: defaultArgs(action.role, verb) }));
  }
  function setArg(i: number, value: string | number): void {
    const args = action.args.slice();
    args[i] = value;
    onDoc(updateAction(doc, rowId, action.id, { args }));
  }

  return (
    <div
      className={`rounded-lg border border-neutral-800 p-2 ${action.enabled ? '' : 'opacity-60'}`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={action.enabled}
          onChange={(e) => onDoc(updateAction(doc, rowId, action.id, { enabled: e.target.checked }))}
          title="aktiviert"
        />
        <select value={action.role} onChange={(e) => setRole(e.target.value)} className={`${select} min-w-0 flex-1`}>
          {KNOWN_ROLES.filter((r) => r !== 'rundown').map((r) => (
            <option key={r} value={r}>
              {CAPABILITIES[r].label}
            </option>
          ))}
        </select>
        <select value={action.verb} onChange={(e) => setVerb(e.target.value)} className={`${select} min-w-0 flex-1`}>
          {(CAPABILITIES[action.role]?.actions ?? []).map((a) => (
            <option key={a.id} value={a.verb}>
              {a.label}
            </option>
          ))}
          {!cap && <option value={action.verb}>{action.verb}</option>}
        </select>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {fired === 'ok' && <span className="text-xs text-green-400">✓ gesendet</span>}
          {fired === 'off' && <span className="text-xs text-yellow-400">⚠ offline</span>}
          <button
            onClick={test}
            title="diese Aktion jetzt an das Tool senden"
            className="rounded border border-neutral-700 px-1.5 py-0.5 text-xs text-neutral-300 hover:bg-neutral-700"
          >
            Test
          </button>
          <button
            onClick={() => onDoc(duplicateAction(doc, rowId, action.id))}
            title="Aktion duplizieren"
            className="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100"
          >
            ⧉
          </button>
          <button
            onClick={() => onDoc(removeAction(doc, rowId, action.id))}
            title="Aktion löschen"
            className="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100"
          >
            ✕
          </button>
        </div>
      </div>

      {cap?.args && cap.args.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {cap.args.map((arg, i) => (
            <label key={arg.id} className="text-xs text-neutral-400">
              {arg.label}
              {arg.type === 'dropdown' ? (
                <select
                  value={String(action.args[i] ?? arg.default ?? '')}
                  onChange={(e) => setArg(i, e.target.value)}
                  className={`${input} mt-0.5`}
                >
                  {(arg.choices ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={arg.type === 'number' ? 'number' : 'text'}
                  defaultValue={String(action.args[i] ?? arg.default ?? '')}
                  min={arg.min}
                  max={arg.max}
                  onBlur={(e) =>
                    setArg(i, arg.type === 'number' ? Number(e.target.value) : e.target.value)
                  }
                  className={`${input} mt-0.5`}
                />
              )}
            </label>
          ))}
        </div>
      )}

      <div className="mt-2 font-mono text-[11px] text-neutral-500">→ {line}</div>
    </div>
  );
}

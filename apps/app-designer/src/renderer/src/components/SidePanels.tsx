import { NODE_LABELS, type NodeType } from '@jm/appkit';
import { Badge, Button } from '@jm/ui';
import { useCurrentScene, useEditor } from '../store';
import { NumberField, SelectField, TextField } from './fields';

const PALETTE: NodeType[] = ['text', 'image', 'shape', 'button', 'video', 'wheel'];

export function ScenePanel(): JSX.Element {
  const doc = useEditor((s) => s.doc);
  const sceneId = useEditor((s) => s.sceneId);
  const setScene = useEditor((s) => s.setScene);
  const addScene = useEditor((s) => s.addScene);
  const removeScene = useEditor((s) => s.removeScene);
  const setStartScene = useEditor((s) => s.setStartScene);

  return (
    <div className="border-b border-[var(--border)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Szenen</span>
        <Button size="sm" variant="ghost" uppercase={false} onClick={addScene}>
          + Neu
        </Button>
      </div>
      <ul className="space-y-1">
        {doc.scenes.map((s) => (
          <li key={s.id}>
            <div
              className={`group flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm ${
                s.id === sceneId ? 'bg-[var(--muted)]' : 'hover:bg-[var(--muted)]'
              }`}
              onClick={() => setScene(s.id)}
            >
              <span className="flex-1 truncate">{s.name}</span>
              {s.id === doc.startSceneId ? (
                <Badge tone="success">Start</Badge>
              ) : (
                <button
                  className="hidden text-xs text-[var(--muted-foreground)] hover:underline group-hover:block"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStartScene(s.id);
                  }}
                >
                  Start setzen
                </button>
              )}
              {doc.scenes.length > 1 && (
                <button
                  className="hidden text-xs text-[var(--muted-foreground)] hover:text-[#e5484d] group-hover:block"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeScene(s.id);
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LayerPanel(): JSX.Element {
  const scene = useCurrentScene();
  const selectedId = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const addNode = useEditor((s) => s.addNode);
  const reorderNode = useEditor((s) => s.reorderNode);
  const removeNode = useEditor((s) => s.removeNode);
  const patchNode = useEditor((s) => s.patchNode);

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        Element hinzufügen
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1">
        {PALETTE.map((t) => (
          <button
            key={t}
            className="rounded border border-[var(--border)] px-2 py-1.5 text-xs hover:bg-[var(--muted)]"
            onClick={() => addNode(t)}
          >
            {NODE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        Elemente
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {/* Zuletzt gezeichnet = oben im Stapel → Liste umgekehrt anzeigen. */}
        {[...scene.nodes].reverse().map((n) => (
          <li
            key={n.id}
            className={`group flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-sm ${
              n.id === selectedId ? 'bg-[var(--muted)]' : 'hover:bg-[var(--muted)]'
            }`}
            onClick={() => select(n.id)}
          >
            <button
              className="w-5 text-xs opacity-60 hover:opacity-100"
              title={n.visible ? 'Beim Start sichtbar' : 'Beim Start versteckt'}
              onClick={(e) => {
                e.stopPropagation();
                patchNode(n.id, { visible: !n.visible });
              }}
            >
              {n.visible ? '👁' : '—'}
            </button>
            <span className="flex-1 truncate">{n.name}</span>
            {n.rules.length > 0 && <Badge tone="muted">{n.rules.length}</Badge>}
            <span className="hidden gap-0.5 group-hover:flex">
              <button
                className="px-1 text-xs hover:opacity-100"
                title="Nach vorn"
                onClick={(e) => {
                  e.stopPropagation();
                  reorderNode(n.id, 1);
                }}
              >
                ▲
              </button>
              <button
                className="px-1 text-xs"
                title="Nach hinten"
                onClick={(e) => {
                  e.stopPropagation();
                  reorderNode(n.id, -1);
                }}
              >
                ▼
              </button>
              <button
                className="px-1 text-xs hover:text-[#e5484d]"
                onClick={(e) => {
                  e.stopPropagation();
                  removeNode(n.id);
                }}
              >
                ✕
              </button>
            </span>
          </li>
        ))}
        {scene.nodes.length === 0 && (
          <li className="px-2 py-1 text-sm text-[var(--muted-foreground)]">Noch nichts auf dieser Szene.</li>
        )}
      </ul>
    </div>
  );
}

/**
 * Variablen-Inspektor + Trigger-Log.
 *
 * Der Log ist der eigentliche Wert der Sandbox: Autoren sehen, WARUM eine Regel
 * nicht gefeuert hat, statt zu raten.
 */
export function VariablesPanel(): JSX.Element {
  const doc = useEditor((s) => s.doc);
  const vars = useEditor((s) => s.vars);
  const log = useEditor((s) => s.log);
  const addVar = useEditor((s) => s.addVar);
  const patchVar = useEditor((s) => s.patchVar);
  const removeVar = useEditor((s) => s.removeVar);
  const clearLog = useEditor((s) => s.clearLog);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-h-0 w-1/2 flex-col border-r border-[var(--border)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Variablen
          </span>
          <Button size="sm" variant="ghost" uppercase={false} onClick={addVar}>
            + Neu
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {doc.variables.length === 0 && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Variablen merken sich Punkte, Runden oder Ergebnisse.
            </p>
          )}
          {doc.variables.map((v) => (
            <div key={v.name} className="mb-1 flex items-center gap-1">
              <div className="flex-1">
                <TextField value={v.name} onChange={(name) => patchVar(v.name, { name })} />
              </div>
              <div className="w-24">
                <SelectField
                  value={v.type}
                  options={[
                    { value: 'number', label: 'Zahl' },
                    { value: 'string', label: 'Text' },
                    { value: 'boolean', label: 'Ja/Nein' },
                  ]}
                  onChange={(t) =>
                    patchVar(v.name, {
                      type: t as 'number',
                      initial: t === 'number' ? 0 : t === 'boolean' ? false : '',
                    })
                  }
                />
              </div>
              <div className="w-20">
                {v.type === 'number' ? (
                  <NumberField value={Number(v.initial)} onChange={(initial) => patchVar(v.name, { initial })} />
                ) : (
                  <TextField value={String(v.initial)} onChange={(initial) => patchVar(v.name, { initial })} />
                )}
              </div>
              <span
                className="tabular w-16 truncate text-right text-xs text-[var(--brand-yellow,#fbe73b)]"
                title="Aktueller Wert in der Sandbox"
              >
                {vars[v.name] !== undefined ? String(vars[v.name]) : '—'}
              </span>
              <button className="rounded px-1 text-xs hover:bg-[var(--muted)]" onClick={() => removeVar(v.name)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 w-1/2 flex-col p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Was passiert (Sandbox)
          </span>
          <Button size="sm" variant="ghost" uppercase={false} onClick={clearLog}>
            Leeren
          </Button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto text-xs">
          {log.length === 0 && (
            <li className="text-[var(--muted-foreground)]">Noch nichts passiert. Spiel die App rechts an.</li>
          )}
          {log.map((l, i) => (
            <li key={`${l.at}-${i}`} className="border-b border-[var(--border)] py-1 last:border-0">
              <span className="tabular mr-2 text-[var(--muted-foreground)]">
                {new Date(l.at).toLocaleTimeString('de-DE')}
              </span>
              {l.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// „Wenn → Dann" als Formular.
//
// Die Felder werden aus ACTION_SPECS generiert — dieselbe Idee wie
// packages/suite-control-protocol/src/capabilities.ts, wo das Companion-Modul
// seine Actions aus einer Tabelle baut. Ein neues Verb bekommt sein Formular
// dadurch geschenkt.
//
// Bedingungen sind UND-verknüpft; ODER schreibt man als zweite Regel. Das ist für
// Nicht-Techniker verständlicher als Klammerlogik in einem Formular.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ACTION_SPECS,
  SCENE_TRIGGERS,
  TRIGGER_LABELS,
  makeAction,
  makeRule,
  triggersFor,
  type Action,
  type ActionVerb,
  type Condition,
  type NodeType,
  type Rule,
  type TriggerType,
} from '@jm/appkit';
import { Button } from '@jm/ui';
import { useCurrentScene, useEditor } from '../store';
import { NumberField, SelectField, TextField, type Option } from './fields';

const OPS: Option[] = [
  { value: '==', label: 'ist gleich' },
  { value: '!=', label: 'ist ungleich' },
  { value: '>', label: 'ist größer als' },
  { value: '>=', label: 'ist mindestens' },
  { value: '<', label: 'ist kleiner als' },
  { value: '<=', label: 'ist höchstens' },
];

interface CommonProps {
  rules: Rule[];
  onChange: (rules: Rule[]) => void;
}

/** Node-Regeln bieten andere Trigger als Szenen-Regeln — und `nodeType` entscheidet mit. */
type Props =
  | (CommonProps & { scope: 'scene' })
  | (CommonProps & { scope: 'node'; nodeType: NodeType });

export function RuleEditor(props: Props): JSX.Element {
  const { rules, onChange } = props;
  const doc = useEditor((s) => s.doc);
  const scene = useCurrentScene();

  const sceneOptions: Option[] = doc.scenes.map((s) => ({ value: s.id, label: s.name }));
  const nodeOptions: Option[] = scene.nodes.map((n) => ({ value: n.id, label: n.name }));
  const varOptions: Option[] = doc.variables.map((v) => ({ value: v.name, label: v.name }));
  const assetOptions: Option[] = doc.assets
    .filter((a) => a.kind === 'audio')
    .map((a) => ({ value: a.id, label: a.fileName }));

  // „Paar gefunden" an einer Schaltfläche wäre eine Falle, keine Freiheit.
  const available: TriggerType[] = props.scope === 'node' ? triggersFor(props.nodeType) : SCENE_TRIGGERS;

  const triggerOptions: Option[] = available.map((t) => ({ value: t, label: TRIGGER_LABELS[t] }));

  const conditionVarOptions: Option[] = [
    ...varOptions,
    // $result trägt das Ergebnis des Triggers — beim Rad das gezogene Feld.
    { value: '$result', label: '$result (Ergebnis)' },
  ];

  const patch = (id: string, next: Partial<Rule>): void =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...next } : r)));

  const argOptions = (kind: string): Option[] | null => {
    switch (kind) {
      case 'scene':
        return sceneOptions;
      case 'node':
        return nodeOptions;
      case 'variable':
        return varOptions;
      case 'asset':
        return assetOptions;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      {rules.length === 0 && (
        <p className="text-sm text-[var(--muted-foreground)]">
          Noch keine Regel. Eine Regel beschreibt, was passieren soll — zum Beispiel „wenn angeklickt, dann Szene
          wechseln".
        </p>
      )}

      {rules.map((rule) => (
        <div key={rule.id} className="rounded border border-[var(--border)] p-3">
          <div className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={(e) => patch(rule.id, { enabled: e.target.checked })}
              title="Regel aktiv"
            />
            <span className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">Wenn</span>
            <div className="flex-1">
              <SelectField
                value={rule.trigger.type}
                options={triggerOptions}
                onChange={(v) => patch(rule.id, { trigger: { ...rule.trigger, type: v as TriggerType } })}
              />
            </div>
            <button
              className="rounded px-2 py-1 text-xs text-[var(--destructive,#e5484d)] hover:bg-[var(--muted)]"
              onClick={() => onChange(rules.filter((r) => r.id !== rule.id))}
            >
              Löschen
            </button>
          </div>

          {rule.trigger.type === 'onTimer' && (
            <div className="mb-2 flex items-center gap-2 pl-6 text-sm">
              <span className="text-[var(--muted-foreground)]">nach</span>
              <div className="w-28">
                <NumberField
                  value={rule.trigger.afterMs ?? 1000}
                  min={0}
                  step={100}
                  onChange={(v) => patch(rule.id, { trigger: { ...rule.trigger, afterMs: v } })}
                />
              </div>
              <span className="text-[var(--muted-foreground)]">Millisekunden</span>
            </div>
          )}

          {rule.trigger.type === 'onVarChange' && (
            <div className="mb-2 flex items-center gap-2 pl-6 text-sm">
              <span className="text-[var(--muted-foreground)]">Variable</span>
              <div className="flex-1">
                <SelectField
                  value={rule.trigger.varName ?? ''}
                  options={varOptions}
                  placeholder="— wählen —"
                  onChange={(v) => patch(rule.id, { trigger: { ...rule.trigger, varName: v } })}
                />
              </div>
            </div>
          )}

          {/* Bedingungen */}
          {rule.conditions.map((c, i) => (
            <div key={i} className="mb-2 flex items-center gap-2 pl-6">
              <span className="w-8 text-xs font-semibold uppercase text-[var(--muted-foreground)]">und</span>
              <div className="flex-1">
                <SelectField
                  value={c.varName}
                  options={conditionVarOptions}
                  placeholder="— Variable —"
                  onChange={(v) => {
                    const conditions = [...rule.conditions];
                    conditions[i] = { ...c, varName: v as Condition['varName'] };
                    patch(rule.id, { conditions });
                  }}
                />
              </div>
              <div className="w-36">
                <SelectField
                  value={c.op}
                  options={OPS}
                  onChange={(v) => {
                    const conditions = [...rule.conditions];
                    conditions[i] = { ...c, op: v as Condition['op'] };
                    patch(rule.id, { conditions });
                  }}
                />
              </div>
              <div className="flex-1">
                <TextField
                  value={String(c.value)}
                  onChange={(v) => {
                    const conditions = [...rule.conditions];
                    conditions[i] = { ...c, value: v };
                    patch(rule.id, { conditions });
                  }}
                />
              </div>
              <button
                className="rounded px-2 text-xs hover:bg-[var(--muted)]"
                onClick={() => patch(rule.id, { conditions: rule.conditions.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            </div>
          ))}

          {/* Aktionen */}
          <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-2">
            {rule.actions.map((a, i) => {
              const spec = ACTION_SPECS[a.verb];
              const setAction = (next: Action): void => {
                const actions = [...rule.actions];
                actions[i] = next;
                patch(rule.id, { actions });
              };
              return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="w-8 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
                    {i === 0 ? 'Dann' : 'und'}
                  </span>
                  <input
                    type="checkbox"
                    checked={a.enabled}
                    onChange={(e) => setAction({ ...a, enabled: e.target.checked })}
                    title="Aktion aktiv"
                  />
                  <div className="w-44">
                    <SelectField
                      value={a.verb}
                      options={Object.entries(ACTION_SPECS).map(([v, s]) => ({ value: v, label: s.label }))}
                      onChange={(v) => setAction(makeAction(v as ActionVerb))}
                    />
                  </div>
                  {spec.args.map((argSpec, ai) => {
                    const opts = argOptions(argSpec.kind);
                    const value = a.args[ai];
                    return (
                      <div key={ai} className="w-40">
                        {opts ? (
                          <SelectField
                            value={String(value ?? '')}
                            options={opts}
                            placeholder={`— ${argSpec.label} —`}
                            onChange={(v) => {
                              const args = [...a.args];
                              args[ai] = v;
                              setAction({ ...a, args });
                            }}
                          />
                        ) : argSpec.kind === 'number' ? (
                          <NumberField
                            value={Number(value) || 0}
                            onChange={(v) => {
                              const args = [...a.args];
                              args[ai] = v;
                              setAction({ ...a, args });
                            }}
                          />
                        ) : (
                          <TextField
                            value={String(value ?? '')}
                            placeholder={argSpec.label}
                            onChange={(v) => {
                              const args = [...a.args];
                              args[ai] = v;
                              setAction({ ...a, args });
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                  <button
                    className="rounded px-2 text-xs hover:bg-[var(--muted)]"
                    onClick={() => patch(rule.id, { actions: rule.actions.filter((_, j) => j !== i) })}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              uppercase={false}
              onClick={() =>
                patch(rule.id, {
                  conditions: [...rule.conditions, { varName: doc.variables[0]?.name ?? '', op: '==', value: '' }],
                })
              }
            >
              + Bedingung
            </Button>
            <Button
              size="sm"
              variant="outline"
              uppercase={false}
              onClick={() => patch(rule.id, { actions: [...rule.actions, makeAction('goToScene')] })}
            >
              + Aktion
            </Button>
          </div>
        </div>
      ))}

      <Button
        size="sm"
        variant="ghost"
        uppercase={false}
        onClick={() => onChange([...rules, makeRule(available[0] ?? 'onClick')])}
      >
        + Regel hinzufügen
      </Button>
    </div>
  );
}

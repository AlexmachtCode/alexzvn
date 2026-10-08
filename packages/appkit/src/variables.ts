// ─────────────────────────────────────────────────────────────────────────────
// Variablen umbenennen (#231).
//
// Regeln und Elemente verweisen über den NAMEN auf eine Variable — es gibt keine
// Variablen-ID. Wer nur die Definition umbenennt, lässt jede Regel und jede
// Bindung still ins Leere greifen. Deshalb benennt `renameVariable` die
// Definition UND jeden Verweis im ganzen Dokument (alle Szenen) in einem Zug um.
//
// Verweise auf eine Variable stehen an genau diesen Stellen:
//   • Regel-Trigger `trigger.varName` (onVarChange)
//   • Bedingungen `conditions[].varName` — außer der Pseudo-Variable `$result`
//   • Aktions-Argumente, deren ArgSpec die Art 'variable' hat (ACTION_SPECS)
//   • Element-Bindungen, siehe NODE_VAR_PROPS
// Kommt eine neue Stelle hinzu, gehört sie hierher — sonst reißt das Umbenennen.
// ─────────────────────────────────────────────────────────────────────────────

import { ACTION_SPECS, type Action, type Condition, type Rule, type Trigger } from './logic';
import type { AppNode, AppProject, NodeType, Scene, VarName } from './model';

/** Pseudo-Variable für das Ergebnis des auslösenden Triggers — nie umbenennen. */
const RESULT_VAR = '$result';

/** Props, in denen ein Element eine Variable bindet, je Node-Typ. */
const NODE_VAR_PROPS: Partial<Record<NodeType, readonly string[]>> = {
  text: ['bindTextTo'],
  wheel: ['resultVar'],
  quiz: ['scoreVar', 'indexVar'],
  memory: ['matchesVar'],
};

/** Warum ein neuer Variablenname nicht geht. */
export type VarNameProblem = 'empty' | 'taken';

/**
 * Prüft einen neuen Namen für die Variable `oldName` (getrimmt).
 * `null` = in Ordnung; der unveränderte Name ist ebenfalls in Ordnung.
 * `$result` gilt als vergeben: Bedingungen lesen unter diesem Namen das
 * Trigger-Ergebnis, nicht die Variable.
 */
export function checkVariableName(doc: AppProject, oldName: VarName, newName: string): VarNameProblem | null {
  const name = newName.trim();
  if (!name) return 'empty';
  if (name === oldName) return null;
  if (name === RESULT_VAR || doc.variables.some((v) => v.name === name)) return 'taken';
  return null;
}

/**
 * Benennt die Variable `oldName` in `newName` (getrimmt) um und zieht jeden
 * Verweis im ganzen Dokument mit. Rein: das Eingangsdokument bleibt unverändert.
 *
 * Gibt `doc` selbst zurück, wenn es nichts zu tun gibt oder der Name nicht geht
 * (leer, vergeben, unverändert, unbekannte Variable, `$result`) — der Aufrufer
 * erkennt „keine Änderung" an der Identität.
 */
export function renameVariable(doc: AppProject, oldName: VarName, newName: string): AppProject {
  const name = newName.trim();
  if (oldName === RESULT_VAR || name === oldName) return doc;
  if (!doc.variables.some((v) => v.name === oldName)) return doc;
  if (checkVariableName(doc, oldName, name) !== null) return doc;

  const renameTrigger = (t: Trigger): Trigger => (t.varName === oldName ? { ...t, varName: name } : t);

  const renameCondition = (c: Condition): Condition =>
    c.varName === oldName ? { ...c, varName: name } : c;

  const renameAction = (a: Action): Action => {
    const specs = ACTION_SPECS[a.verb]?.args ?? [];
    let changed = false;
    const args = a.args.map((arg, i) => {
      if (specs[i]?.kind !== 'variable' || arg !== oldName) return arg;
      changed = true;
      return name;
    });
    return changed ? { ...a, args } : a;
  };

  const renameRule = (r: Rule): Rule => ({
    ...r,
    trigger: renameTrigger(r.trigger),
    conditions: r.conditions.map(renameCondition),
    actions: r.actions.map(renameAction),
  });

  const renameNode = (n: AppNode): AppNode => {
    const keys = NODE_VAR_PROPS[n.type] ?? [];
    const props = n.props as Record<string, unknown>;
    let nextProps = props;
    for (const k of keys) {
      if (props[k] === oldName) {
        if (nextProps === props) nextProps = { ...props };
        nextProps[k] = name;
      }
    }
    return { ...n, props: nextProps, rules: n.rules.map(renameRule) } as AppNode;
  };

  const renameScene = (s: Scene): Scene => ({
    ...s,
    rules: s.rules.map(renameRule),
    nodes: s.nodes.map(renameNode),
  });

  return {
    ...doc,
    variables: doc.variables.map((v) => (v.name === oldName ? { ...v, name } : v)),
    scenes: doc.scenes.map(renameScene),
  };
}

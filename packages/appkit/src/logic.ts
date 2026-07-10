// ─────────────────────────────────────────────────────────────────────────────
// Logikmodell: „Wenn → Dann" als DATEN, nie als Code.
//
// Die Runtime interpretiert Regeln über einen festen switch — es gibt kein eval,
// kein new Function, und die Prod-CSP bleibt ohne 'unsafe-eval'. Ein exportiertes
// Bundle kann deshalb nichts ausführen, was hier nicht vorgesehen ist.
//
// Bewusst nah an RundownAction { role, verb, args, enabled, delayMs } aus
// apps/rundown/src/shared/conductor.ts — dieselbe Denkweise, dieselbe Bedienung.
// ─────────────────────────────────────────────────────────────────────────────

import type { NodeId, SceneId, VarName } from './model';

export type TriggerType =
  /** Szene wurde betreten (nur Szenen-Regeln). */
  | 'onLoad'
  /** Node wurde geklickt/getippt (nur Node-Regeln). */
  | 'onClick'
  /** `afterMs` nach Betreten der Szene (Szene) bzw. nach Erscheinen (Node). */
  | 'onTimer'
  /** Eine Variable hat sich geändert (`varName` gesetzt). */
  | 'onVarChange'
  /** Glücksrad ist stehen geblieben; `$result` trägt den Segment-Wert. */
  | 'onWheelStop';

export interface Trigger {
  type: TriggerType;
  /** Nur `onTimer`. */
  afterMs?: number;
  /** Nur `onVarChange`. */
  varName?: VarName;
}

export type CompareOp = '==' | '!=' | '>' | '>=' | '<' | '<=';

/**
 * Bedingung über eine Variable. Der Sonderwert `$result` liest das Ergebnis des
 * auslösenden Triggers (z. B. das Segment, auf dem das Rad stehen blieb) — so
 * braucht „wenn Rad steht UND Gewinnfeld" keine Hilfsvariable.
 */
export interface Condition {
  varName: VarName | '$result';
  op: CompareOp;
  value: number | string | boolean;
}

export type ActionVerb =
  | 'goToScene'
  | 'setVar'
  | 'addVar'
  | 'show'
  | 'hide'
  | 'toggle'
  | 'setText'
  | 'playSound'
  | 'stopSound'
  | 'spinWheel'
  | 'restart';

/** Argumente sind pro Verb typisiert-per-Konvention; siehe ACTION_SPECS. */
export interface Action {
  verb: ActionVerb;
  args: (string | number | boolean)[];
  enabled: boolean;
  delayMs?: number;
}

export interface Rule {
  id: string;
  enabled: boolean;
  trigger: Trigger;
  /** UND-verknüpft. Leer = trifft immer zu. ODER schreibt man als zweite Regel. */
  conditions: Condition[];
  actions: Action[];
}

// ── Deklarative Beschreibung für den Regel-Editor ────────────────────────────
// Der Editor baut seine Formulare aus dieser Tabelle. Analog zu
// packages/suite-control-protocol/src/capabilities.ts: eine Tabelle, aus der
// UI generiert wird, statt handgepflegter Formulare je Verb.

export type ArgKind = 'scene' | 'node' | 'variable' | 'asset' | 'text' | 'number';

export interface ArgSpec {
  label: string;
  kind: ArgKind;
}

export interface ActionSpec {
  label: string;
  args: ArgSpec[];
  /** Nur für diese Node-Typen anbieten (leer = überall). */
  onlyFor?: string[];
}

export const ACTION_SPECS: Record<ActionVerb, ActionSpec> = {
  goToScene: { label: 'Szene wechseln', args: [{ label: 'Szene', kind: 'scene' }] },
  setVar: {
    label: 'Variable setzen',
    args: [
      { label: 'Variable', kind: 'variable' },
      { label: 'Wert', kind: 'text' },
    ],
  },
  addVar: {
    label: 'Variable erhöhen',
    args: [
      { label: 'Variable', kind: 'variable' },
      { label: 'Betrag', kind: 'number' },
    ],
  },
  show: { label: 'Element einblenden', args: [{ label: 'Element', kind: 'node' }] },
  hide: { label: 'Element ausblenden', args: [{ label: 'Element', kind: 'node' }] },
  toggle: { label: 'Element umschalten', args: [{ label: 'Element', kind: 'node' }] },
  setText: {
    label: 'Text ändern',
    args: [
      { label: 'Element', kind: 'node' },
      { label: 'Text', kind: 'text' },
    ],
  },
  playSound: { label: 'Ton abspielen', args: [{ label: 'Ton', kind: 'asset' }] },
  stopSound: { label: 'Ton stoppen', args: [] },
  spinWheel: { label: 'Glücksrad drehen', args: [{ label: 'Glücksrad', kind: 'node' }] },
  restart: { label: 'App neu starten', args: [] },
};

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  onLoad: 'Szene wird betreten',
  onClick: 'angeklickt',
  onTimer: 'nach Wartezeit',
  onVarChange: 'Variable ändert sich',
  onWheelStop: 'Rad bleibt stehen',
};

/** Trigger, die an einem Node hängen (der Rest gehört an die Szene). */
export const NODE_TRIGGERS: TriggerType[] = ['onClick', 'onTimer', 'onWheelStop'];
export const SCENE_TRIGGERS: TriggerType[] = ['onLoad', 'onTimer', 'onVarChange'];

export function makeRule(trigger: TriggerType): Rule {
  return {
    id: `r_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    enabled: true,
    trigger: { type: trigger, ...(trigger === 'onTimer' ? { afterMs: 1000 } : {}) },
    conditions: [],
    actions: [],
  };
}

export function makeAction(verb: ActionVerb): Action {
  return { verb, args: ACTION_SPECS[verb].args.map(() => ''), enabled: true };
}

// ── Auswertung ───────────────────────────────────────────────────────────────

export type VarValue = number | string | boolean;

/**
 * Vergleicht zwei Werte tolerant: Der Editor liefert Argumente als Strings
 * (Textfelder), Variablen können Zahlen sein. `"3" > 2` soll wahr sein, ohne dass
 * Autoren Typen pflegen. Bei nicht-numerischen Werten wird als String verglichen.
 */
export function compare(left: VarValue | undefined, op: CompareOp, right: VarValue): boolean {
  if (left === undefined) return op === '!=';
  const ln = typeof left === 'boolean' ? NaN : Number(left);
  const rn = typeof right === 'boolean' ? NaN : Number(right);
  const numeric = !Number.isNaN(ln) && !Number.isNaN(rn) && left !== '' && right !== '';
  if (numeric) {
    switch (op) {
      case '==': return ln === rn;
      case '!=': return ln !== rn;
      case '>': return ln > rn;
      case '>=': return ln >= rn;
      case '<': return ln < rn;
      case '<=': return ln <= rn;
    }
  }
  const ls = String(left);
  const rs = String(right);
  switch (op) {
    case '==': return ls === rs;
    case '!=': return ls !== rs;
    case '>': return ls > rs;
    case '>=': return ls >= rs;
    case '<': return ls < rs;
    case '<=': return ls <= rs;
  }
}

export function evalConditions(
  conds: Condition[],
  vars: Record<VarName, VarValue>,
  result?: VarValue,
): boolean {
  return conds.every((c) =>
    compare(c.varName === '$result' ? result : vars[c.varName], c.op, c.value),
  );
}

/** Nur zur Typisierung der Aktions-Argumente an den Aufrufstellen. */
export interface ActionTargets {
  scene?: SceneId;
  node?: NodeId;
}

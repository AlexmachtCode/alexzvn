// ─────────────────────────────────────────────────────────────────────────────
// migrateProject(): tolerante Normalisierung eines rohen .jmapp-Dokuments.
//
// Muster wie apps/daw/src/shared/project.ts: nie werfen, fehlende Felder mit
// Defaults auffüllen, unbekannte Node-Typen verwerfen. Das Dokument wird auch
// von exportierten Bundles gelesen, die eine ältere Runtime tragen können.
// ─────────────────────────────────────────────────────────────────────────────

import {
  APP_SCHEMA_VERSION,
  DEFAULT_THEME,
  makeEmptyProject,
  newId,
  type AppNode,
  type AppProject,
  type Asset,
  type MemoryPair,
  type NodeType,
  type QuizQuestion,
  type Scene,
  type Theme,
  type VarDef,
  type WheelSegment,
} from './model';
import type { Action, ActionVerb, Condition, Rule, Trigger, TriggerType } from './logic';
import { ACTION_SPECS } from './logic';

const NODE_TYPES: NodeType[] = [
  'text',
  'image',
  'shape',
  'button',
  'video',
  'wheel',
  'quiz',
  'memory',
  'dragitem',
  'dropzone',
];
const TRIGGER_TYPES: TriggerType[] = [
  'onLoad',
  'onClick',
  'onTimer',
  'onVarChange',
  'onWheelStop',
  'onCorrect',
  'onWrong',
  'onMatch',
  'onComplete',
  'onDropped',
  'onRejected',
];

type Raw = Record<string, unknown>;

function str(v: unknown, fb: string): string {
  return typeof v === 'string' ? v : fb;
}
function num(v: unknown, fb: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fb;
}
function bool(v: unknown, fb: boolean): boolean {
  return typeof v === 'boolean' ? v : fb;
}
function arr(v: unknown): Raw[] {
  return Array.isArray(v) ? (v as Raw[]) : [];
}

function migrateTrigger(raw: Raw): Trigger {
  const type = TRIGGER_TYPES.includes(raw['type'] as TriggerType) ? (raw['type'] as TriggerType) : 'onClick';
  const t: Trigger = { type };
  if (type === 'onTimer') t.afterMs = Math.max(0, num(raw['afterMs'], 1000));
  if (type === 'onVarChange') t.varName = str(raw['varName'], '');
  return t;
}

function migrateCondition(raw: Raw): Condition | null {
  const varName = str(raw['varName'], '');
  if (!varName) return null;
  const op = raw['op'];
  const valid = ['==', '!=', '>', '>=', '<', '<='].includes(op as string);
  const value = raw['value'];
  const v = typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string' ? value : '';
  return { varName: varName as Condition['varName'], op: valid ? (op as Condition['op']) : '==', value: v };
}

function migrateAction(raw: Raw): Action | null {
  const verb = raw['verb'] as ActionVerb;
  if (!verb || !(verb in ACTION_SPECS)) return null;
  const args = Array.isArray(raw['args'])
    ? (raw['args'] as unknown[]).map((a) =>
        typeof a === 'number' || typeof a === 'boolean' || typeof a === 'string' ? a : '',
      )
    : [];
  // Auf die vom Verb erwartete Stelligkeit bringen — ein umbenanntes/erweitertes
  // Verb darf gespeicherte Dokumente nicht sprengen.
  const want = ACTION_SPECS[verb].args.length;
  while (args.length < want) args.push('');
  const a: Action = { verb, args: args.slice(0, want), enabled: bool(raw['enabled'], true) };
  if (typeof raw['delayMs'] === 'number') a.delayMs = Math.max(0, raw['delayMs']);
  return a;
}

function migrateRule(raw: Raw): Rule {
  return {
    id: str(raw['id'], newId('r')),
    enabled: bool(raw['enabled'], true),
    trigger: migrateTrigger((raw['trigger'] as Raw) ?? {}),
    conditions: arr(raw['conditions']).map(migrateCondition).filter((c): c is Condition => !!c),
    actions: arr(raw['actions']).map(migrateAction).filter((a): a is Action => !!a),
  };
}

function migrateWheelSegments(raw: unknown): WheelSegment[] {
  return arr(raw).map((s) => ({
    id: str(s['id'], newId('seg')),
    label: str(s['label'], 'Feld'),
    color: str(s['color'], '#4f8cff'),
    weight: Math.max(0, num(s['weight'], 1)),
    value: str(s['value'], str(s['label'], 'feld')),
  }));
}

function migrateQuestions(raw: unknown): QuizQuestion[] {
  return arr(raw).map((q) => ({
    id: str(q['id'], newId('q')),
    text: str(q['text'], 'Frage?'),
    imageAssetId: typeof q['imageAssetId'] === 'string' ? q['imageAssetId'] : null,
    answers: arr(q['answers']).map((a) => ({
      id: str(a['id'], newId('a')),
      text: str(a['text'], 'Antwort'),
      correct: bool(a['correct'], false),
    })),
  }));
}

function migrateMemoryPairs(raw: unknown): MemoryPair[] {
  return arr(raw).map((p) => ({
    id: str(p['id'], newId('pair')),
    label: str(p['label'], ''),
    assetId: typeof p['assetId'] === 'string' ? p['assetId'] : null,
    matchLabel: str(p['matchLabel'], ''),
    matchAssetId: typeof p['matchAssetId'] === 'string' ? p['matchAssetId'] : null,
  }));
}

/** `accepts` toleriert auch einen kommaseparierten String (Handbearbeitung). */
function migrateAccepts(raw: unknown): string[] {
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string' && !!s) : [];
}

function migrateNode(raw: Raw, theme: Theme): AppNode | null {
  const type = raw['type'] as NodeType;
  if (!NODE_TYPES.includes(type)) return null;
  const base = {
    id: str(raw['id'], newId(type)),
    name: str(raw['name'], type),
    x: num(raw['x'], 0),
    y: num(raw['y'], 0),
    w: Math.max(1, num(raw['w'], 200)),
    h: Math.max(1, num(raw['h'], 100)),
    rotation: num(raw['rotation'], 0),
    opacity: Math.min(1, Math.max(0, num(raw['opacity'], 1))),
    visible: bool(raw['visible'], true),
    locked: bool(raw['locked'], false),
    rules: arr(raw['rules']).map(migrateRule),
  };
  const p = (raw['props'] as Raw) ?? {};

  switch (type) {
    case 'text':
      return {
        ...base,
        type,
        props: {
          text: str(p['text'], 'Text'),
          ...(typeof p['bindTextTo'] === 'string' && p['bindTextTo'] ? { bindTextTo: p['bindTextTo'] } : {}),
          fontSize: num(p['fontSize'], 48),
          color: str(p['color'], theme.colorText),
          weight: num(p['weight'], 600),
          align: (['left', 'center', 'right'] as const).includes(p['align'] as 'left')
            ? (p['align'] as 'left')
            : 'center',
          lineHeight: num(p['lineHeight'], 1.2),
        },
      };
    case 'image':
      return {
        ...base,
        type,
        props: {
          assetId: typeof p['assetId'] === 'string' ? p['assetId'] : null,
          fit: (['cover', 'contain', 'fill'] as const).includes(p['fit'] as 'contain')
            ? (p['fit'] as 'contain')
            : 'contain',
          radius: num(p['radius'], 0),
        },
      };
    case 'shape':
      return {
        ...base,
        type,
        props: {
          kind: p['kind'] === 'ellipse' ? 'ellipse' : 'rect',
          fill: str(p['fill'], theme.colorPrimary),
          stroke: str(p['stroke'], 'transparent'),
          strokeWidth: num(p['strokeWidth'], 0),
          radius: num(p['radius'], theme.radius),
        },
      };
    case 'button':
      return {
        ...base,
        type,
        props: {
          label: str(p['label'], 'Weiter'),
          bg: str(p['bg'], theme.colorPrimary),
          color: str(p['color'], '#ffffff'),
          radius: num(p['radius'], theme.radius),
          fontSize: num(p['fontSize'], 32),
        },
      };
    case 'video':
      return {
        ...base,
        type,
        props: {
          assetId: typeof p['assetId'] === 'string' ? p['assetId'] : null,
          autoplay: bool(p['autoplay'], false),
          loop: bool(p['loop'], false),
          muted: bool(p['muted'], true),
          controls: bool(p['controls'], false),
        },
      };
    case 'wheel':
      return {
        ...base,
        type,
        props: {
          segments: migrateWheelSegments(p['segments']),
          spinMs: Math.max(200, num(p['spinMs'], 4200)),
          turns: Math.max(1, num(p['turns'], 5)),
          textColor: str(p['textColor'], '#ffffff'),
          ...(typeof p['resultVar'] === 'string' && p['resultVar'] ? { resultVar: p['resultVar'] } : {}),
        },
      };
    case 'quiz':
      return {
        ...base,
        type,
        props: {
          questions: migrateQuestions(p['questions']),
          shuffleQuestions: bool(p['shuffleQuestions'], false),
          shuffleAnswers: bool(p['shuffleAnswers'], true),
          advanceMs: Math.max(0, num(p['advanceMs'], 1600)),
          ...(typeof p['scoreVar'] === 'string' && p['scoreVar'] ? { scoreVar: p['scoreVar'] } : {}),
          ...(typeof p['indexVar'] === 'string' && p['indexVar'] ? { indexVar: p['indexVar'] } : {}),
          questionFontSize: num(p['questionFontSize'], 56),
          answerFontSize: num(p['answerFontSize'], 36),
          answerColor: str(p['answerColor'], '#2b3138'),
          correctColor: str(p['correctColor'], '#30a46c'),
          wrongColor: str(p['wrongColor'], '#e5484d'),
          textColor: str(p['textColor'], theme.colorText),
        },
      };
    case 'memory':
      return {
        ...base,
        type,
        props: {
          pairs: migrateMemoryPairs(p['pairs']),
          columns: Math.max(1, Math.round(num(p['columns'], 4))),
          gap: Math.max(0, num(p['gap'], 16)),
          flipBackMs: Math.max(100, num(p['flipBackMs'], 1000)),
          backColor: str(p['backColor'], theme.colorPrimary),
          backLabel: str(p['backLabel'], '?'),
          faceColor: str(p['faceColor'], '#2b3138'),
          textColor: str(p['textColor'], theme.colorText),
          fontSize: num(p['fontSize'], 40),
          radius: num(p['radius'], theme.radius),
          ...(typeof p['matchesVar'] === 'string' && p['matchesVar'] ? { matchesVar: p['matchesVar'] } : {}),
        },
      };
    case 'dragitem':
      return {
        ...base,
        type,
        props: {
          label: str(p['label'], 'Element'),
          assetId: typeof p['assetId'] === 'string' ? p['assetId'] : null,
          tag: str(p['tag'], 'gruppe1'),
          bg: str(p['bg'], theme.colorPrimary),
          color: str(p['color'], '#ffffff'),
          radius: num(p['radius'], theme.radius),
          fontSize: num(p['fontSize'], 30),
          returnOnMiss: bool(p['returnOnMiss'], true),
          lockOnDrop: bool(p['lockOnDrop'], true),
        },
      };
    case 'dropzone':
      return {
        ...base,
        type,
        props: {
          label: str(p['label'], 'Hier ablegen'),
          accepts: migrateAccepts(p['accepts']),
          snap: bool(p['snap'], true),
          capacity: Math.max(0, Math.round(num(p['capacity'], 0))),
          bg: str(p['bg'], 'rgba(255,255,255,0.04)'),
          borderColor: str(p['borderColor'], 'rgba(255,255,255,0.3)'),
          color: str(p['color'], theme.colorText),
          radius: num(p['radius'], theme.radius),
          fontSize: num(p['fontSize'], 28),
        },
      };
  }
}

function migrateScene(raw: Raw, theme: Theme): Scene {
  return {
    id: str(raw['id'], newId('sc')),
    name: str(raw['name'], 'Szene'),
    background: str(raw['background'], theme.colorBg),
    nodes: arr(raw['nodes'])
      .map((n) => migrateNode(n, theme))
      .filter((n): n is AppNode => !!n),
    rules: arr(raw['rules']).map(migrateRule),
  };
}

function migrateVar(raw: Raw): VarDef | null {
  const name = str(raw['name'], '');
  if (!name) return null;
  const type = (['number', 'string', 'boolean'] as const).includes(raw['type'] as 'number')
    ? (raw['type'] as VarDef['type'])
    : 'number';
  const initial = raw['initial'];
  const fallback = type === 'number' ? 0 : type === 'boolean' ? false : '';
  return {
    name,
    type,
    initial:
      typeof initial === 'number' || typeof initial === 'string' || typeof initial === 'boolean'
        ? initial
        : fallback,
  };
}

function migrateAsset(raw: Raw): Asset | null {
  const id = str(raw['id'], '');
  const fileName = str(raw['fileName'], '');
  if (!id || !fileName) return null;
  const kind = (['image', 'video', 'audio'] as const).includes(raw['kind'] as 'image')
    ? (raw['kind'] as Asset['kind'])
    : 'image';
  return { id, kind, fileName, mime: str(raw['mime'], 'application/octet-stream'), bytes: num(raw['bytes'], 0) };
}

/** Rohes JSON → gültiges AppProject. Wirft nie; im Zweifel ein leeres Projekt. */
export function migrateProject(raw: unknown): AppProject {
  if (!raw || typeof raw !== 'object') return makeEmptyProject();
  const p = raw as Raw;

  const themeRaw = (p['theme'] as Raw) ?? {};
  const theme: Theme = {
    fontFamily: str(themeRaw['fontFamily'], DEFAULT_THEME.fontFamily),
    colorPrimary: str(themeRaw['colorPrimary'], DEFAULT_THEME.colorPrimary),
    colorBg: str(themeRaw['colorBg'], DEFAULT_THEME.colorBg),
    colorText: str(themeRaw['colorText'], DEFAULT_THEME.colorText),
    radius: num(themeRaw['radius'], DEFAULT_THEME.radius),
  };

  const scenes = arr(p['scenes']).map((s) => migrateScene(s, theme));
  if (!scenes.length) scenes.push(migrateScene({ name: 'Start' }, theme));

  const canvasRaw = (p['canvas'] as Raw) ?? {};
  const startId = str(p['startSceneId'], '');
  const now = new Date().toISOString();

  return {
    schemaVersion: APP_SCHEMA_VERSION,
    id: str(p['id'], newId('app')),
    name: str(p['name'], 'Neue App'),
    canvas: {
      width: Math.max(1, num(canvasRaw['width'], 1920)),
      height: Math.max(1, num(canvasRaw['height'], 1080)),
      fit: canvasRaw['fit'] === 'cover' ? 'cover' : 'contain',
    },
    theme,
    idleResetMs: Math.max(0, num(p['idleResetMs'], 0)),
    scenes,
    startSceneId: scenes.some((s) => s.id === startId) ? startId : scenes[0].id,
    variables: arr(p['variables']).map(migrateVar).filter((v): v is VarDef => !!v),
    assets: arr(p['assets']).map(migrateAsset).filter((a): a is Asset => !!a),
    createdAt: str(p['createdAt'], now),
    updatedAt: str(p['updatedAt'], now),
  };
}

export function parseProject(text: string): AppProject {
  return migrateProject(JSON.parse(text));
}

export function serializeProject(p: AppProject, at = new Date()): string {
  return JSON.stringify({ ...p, updatedAt: at.toISOString() }, null, 2) + '\n';
}

// ─────────────────────────────────────────────────────────────────────────────
// Dokumentmodell des JM App Designers (#196).
//
// Bewusst reines Plain-JSON + `schemaVersion` + handgeschriebenes migrate() —
// dasselbe Muster wie apps/daw/src/shared/project.ts und apps/switcher. Kein zod:
// das Dokument wird auch von der ausgelieferten Runtime gelesen, die keine
// Abhängigkeiten mitschleppen darf.
//
// Nodes werden als absolut positionierte DOM-Elemente gerendert (nicht Canvas):
// Zielformat ist Web, damit kommen Touch, Textumbruch, <video> und CSS-Animation
// ohne Eigenbau. Koordinaten sind Design-Pixel; die Bühne skaliert als Ganzes.
// ─────────────────────────────────────────────────────────────────────────────

import type { Rule } from './logic';

export const APP_SCHEMA_VERSION = 1;
export const APP_FILE_EXT = 'jmapp';

export type NodeId = string;
export type SceneId = string;
export type AssetId = string;
export type VarName = string;

export type NodeType =
  // Bausteine
  | 'text'
  | 'image'
  | 'shape'
  | 'button'
  | 'video'
  // Spiel-Widgets
  | 'wheel'
  | 'quiz'
  | 'memory'
  | 'dragitem'
  | 'dropzone';

/** Node-Typen, die eigene Spielmechanik mitbringen (eigene Trigger, `reset`). */
export const WIDGET_TYPES: NodeType[] = ['wheel', 'quiz', 'memory', 'dragitem', 'dropzone'];

export interface BaseNode {
  id: NodeId;
  type: NodeType;
  name: string;
  /** Design-Pixel, Ursprung oben links. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Grad, um den Elementmittelpunkt. */
  rotation: number;
  /** 0..1 */
  opacity: number;
  visible: boolean;
  locked: boolean;
  rules: Rule[];
}

export interface TextNode extends BaseNode {
  type: 'text';
  props: {
    text: string;
    /** Zeigt stattdessen den Wert dieser Variable an (live). */
    bindTextTo?: VarName;
    fontSize: number;
    color: string;
    weight: number;
    align: 'left' | 'center' | 'right';
    lineHeight: number;
  };
}

export interface ImageNode extends BaseNode {
  type: 'image';
  props: { assetId: AssetId | null; fit: 'cover' | 'contain' | 'fill'; radius: number };
}

export interface ShapeNode extends BaseNode {
  type: 'shape';
  props: { kind: 'rect' | 'ellipse'; fill: string; stroke: string; strokeWidth: number; radius: number };
}

export interface ButtonNode extends BaseNode {
  type: 'button';
  props: { label: string; bg: string; color: string; radius: number; fontSize: number };
}

export interface VideoNode extends BaseNode {
  type: 'video';
  props: { assetId: AssetId | null; autoplay: boolean; loop: boolean; muted: boolean; controls: boolean };
}

/** Ein Sektor des Glücksrads. `weight` gewichtet die Ziehung (0 = nie). */
export interface WheelSegment {
  id: string;
  label: string;
  color: string;
  weight: number;
  /** Wird bei `onWheelStop` als `$result` bereitgestellt; leer → label. */
  value: string;
}

export interface WheelNode extends BaseNode {
  type: 'wheel';
  props: {
    segments: WheelSegment[];
    spinMs: number;
    /** Volle Umdrehungen vor dem Auslaufen (Optik). */
    turns: number;
    textColor: string;
    /** Variable, in die das gezogene `value` geschrieben wird (optional). */
    resultVar?: VarName;
  };
}

// ── Quiz ─────────────────────────────────────────────────────────────────────

export interface QuizAnswer {
  id: string;
  text: string;
  correct: boolean;
}

export interface QuizQuestion {
  id: string;
  text: string;
  imageAssetId: AssetId | null;
  answers: QuizAnswer[];
}

export interface QuizNode extends BaseNode {
  type: 'quiz';
  props: {
    questions: QuizQuestion[];
    shuffleQuestions: boolean;
    shuffleAnswers: boolean;
    /** ms bis zur nächsten Frage. 0 = wartet auf die Aktion „Nächste Frage". */
    advanceMs: number;
    /** Zählt die richtigen Antworten mit. */
    scoreVar?: VarName;
    /** Nummer der aktuellen Frage (1-basiert). */
    indexVar?: VarName;
    questionFontSize: number;
    answerFontSize: number;
    answerColor: string;
    correctColor: string;
    wrongColor: string;
    textColor: string;
  };
}

// ── Memory ───────────────────────────────────────────────────────────────────

/**
 * Ein Paar sind zwei Karten. Bleiben `matchLabel`/`matchAssetId` leer, zeigt die
 * zweite Karte dasselbe wie die erste (klassisches Memory); sonst entsteht ein
 * Zuordnungsspiel (Begriff ↔ Bild), der häufigere Fall auf Wissens-Messeständen.
 */
export interface MemoryPair {
  id: string;
  label: string;
  assetId: AssetId | null;
  matchLabel: string;
  matchAssetId: AssetId | null;
}

export interface MemoryNode extends BaseNode {
  type: 'memory';
  props: {
    pairs: MemoryPair[];
    columns: number;
    gap: number;
    /** Wie lange zwei ungleiche Karten offen liegen bleiben. */
    flipBackMs: number;
    backColor: string;
    backLabel: string;
    faceColor: string;
    textColor: string;
    fontSize: number;
    radius: number;
    /** Zählt die gefundenen Paare mit. */
    matchesVar?: VarName;
  };
}

// ── Drag & Drop ──────────────────────────────────────────────────────────────

export interface DragItemNode extends BaseNode {
  type: 'dragitem';
  props: {
    label: string;
    assetId: AssetId | null;
    /** Gruppe, die eine Ablagefläche akzeptieren kann. */
    tag: string;
    bg: string;
    color: string;
    radius: number;
    fontSize: number;
    /** Springt zurück, wenn es nicht in eine passende Fläche gezogen wurde. */
    returnOnMiss: boolean;
    /**
     * Bleibt nach korrekter Ablage liegen und lässt sich nicht mehr ziehen.
     *
     * Ohne das zählt eine Regel wie „abgelegt +1" Ereignisse statt Elemente:
     * wer ein Element herauszieht und erneut ablegt, treibt den Zähler hoch und
     * gewinnt zu früh. Für Zuordnungsspiele ist „richtig = fertig" ohnehin das
     * erwartete Verhalten. Ausschalten für freies Sortieren.
     */
    lockOnDrop: boolean;
  };
}

export interface DropZoneNode extends BaseNode {
  type: 'dropzone';
  props: {
    label: string;
    /** Gruppen (`tag`), die hier abgelegt werden dürfen. */
    accepts: string[];
    /** Abgelegte Elemente einrasten lassen. */
    snap: boolean;
    /** Höchstzahl abgelegter Elemente. 0 = unbegrenzt. */
    capacity: number;
    bg: string;
    borderColor: string;
    color: string;
    radius: number;
    fontSize: number;
  };
}

export type AppNode =
  | TextNode
  | ImageNode
  | ShapeNode
  | ButtonNode
  | VideoNode
  | WheelNode
  | QuizNode
  | MemoryNode
  | DragItemNode
  | DropZoneNode;

export interface Scene {
  id: SceneId;
  name: string;
  /** CSS-Farbe. */
  background: string;
  nodes: AppNode[];
  /** Szenen-Regeln (typischerweise `onLoad`, `onTimer`). */
  rules: Rule[];
}

export type VarType = 'number' | 'string' | 'boolean';
export interface VarDef {
  name: VarName;
  type: VarType;
  initial: number | string | boolean;
}

export interface Asset {
  id: AssetId;
  kind: 'image' | 'video' | 'audio';
  /** Dateiname im Bundle-Ordner `assets/` — eindeutig innerhalb des Projekts. */
  fileName: string;
  mime: string;
  bytes: number;
}

export interface Theme {
  fontFamily: string;
  colorPrimary: string;
  colorBg: string;
  colorText: string;
  radius: number;
}

export interface AppProject {
  schemaVersion: number;
  id: string;
  name: string;
  /** Design-Auflösung; die Runtime skaliert die Bühne auf den Viewport. */
  canvas: { width: number; height: number; fit: 'contain' | 'cover' };
  theme: Theme;
  scenes: Scene[];
  startSceneId: SceneId;
  variables: VarDef[];
  assets: Asset[];
  createdAt: string;
  updatedAt: string;
}

// ── ID-Erzeugung ─────────────────────────────────────────────────────────────
// Zeit + Zähler + Zufall (base36), wie apps/daw/src/shared/project.ts. Nicht
// kryptografisch — nur kollisionsarm innerhalb eines Dokuments.
let idCounter = 0;
export function newId(prefix: string): string {
  idCounter = (idCounter + 1) % 46_656; // 36^3
  const t = Date.now().toString(36);
  const c = idCounter.toString(36).padStart(3, '0');
  const r = Math.floor(Math.random() * 1296).toString(36).padStart(2, '0');
  return `${prefix}_${t}${c}${r}`;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_THEME: Theme = {
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  colorPrimary: '#4f8cff',
  colorBg: '#121212',
  colorText: '#f2f2f2',
  radius: 12,
};

export function makeScene(name: string, background = DEFAULT_THEME.colorBg): Scene {
  return { id: newId('sc'), name, background, nodes: [], rules: [] };
}

export function makeEmptyProject(name = 'Neue App'): AppProject {
  const scene = makeScene('Start');
  const now = new Date().toISOString();
  return {
    schemaVersion: APP_SCHEMA_VERSION,
    id: newId('app'),
    name,
    canvas: { width: 1920, height: 1080, fit: 'contain' },
    theme: { ...DEFAULT_THEME },
    scenes: [scene],
    startSceneId: scene.id,
    variables: [],
    assets: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Basiswerte für einen neuen Node eines Typs (Mitte der Bühne setzt der Aufrufer). */
export function makeNode(type: NodeType, theme: Theme = DEFAULT_THEME): AppNode {
  const base = {
    id: newId(type),
    name: NODE_LABELS[type],
    x: 0,
    y: 0,
    w: 400,
    h: 160,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    rules: [] as Rule[],
  };
  switch (type) {
    case 'text':
      return {
        ...base,
        type: 'text',
        props: { text: 'Text', fontSize: 48, color: theme.colorText, weight: 600, align: 'center', lineHeight: 1.2 },
      };
    case 'image':
      return { ...base, w: 400, h: 300, type: 'image', props: { assetId: null, fit: 'contain', radius: 0 } };
    case 'shape':
      return {
        ...base,
        w: 300,
        h: 300,
        type: 'shape',
        props: { kind: 'rect', fill: theme.colorPrimary, stroke: 'transparent', strokeWidth: 0, radius: theme.radius },
      };
    case 'button':
      return {
        ...base,
        w: 320,
        h: 96,
        type: 'button',
        props: { label: 'Weiter', bg: theme.colorPrimary, color: '#ffffff', radius: theme.radius, fontSize: 32 },
      };
    case 'video':
      return {
        ...base,
        w: 640,
        h: 360,
        type: 'video',
        props: { assetId: null, autoplay: false, loop: false, muted: true, controls: false },
      };
    case 'wheel':
      return {
        ...base,
        w: 700,
        h: 700,
        type: 'wheel',
        props: {
          segments: defaultWheelSegments(theme),
          spinMs: 4200,
          turns: 5,
          textColor: '#ffffff',
          resultVar: undefined,
        },
      };
    case 'quiz':
      return {
        ...base,
        w: 1200,
        h: 700,
        type: 'quiz',
        props: {
          questions: [defaultQuestion()],
          shuffleQuestions: false,
          shuffleAnswers: true,
          advanceMs: 1600,
          questionFontSize: 56,
          answerFontSize: 36,
          answerColor: '#2b3138',
          correctColor: '#30a46c',
          wrongColor: '#e5484d',
          textColor: theme.colorText,
        },
      };
    case 'memory':
      return {
        ...base,
        w: 1200,
        h: 700,
        type: 'memory',
        props: {
          pairs: defaultMemoryPairs(),
          columns: 4,
          gap: 16,
          flipBackMs: 1000,
          backColor: theme.colorPrimary,
          backLabel: '?',
          faceColor: '#2b3138',
          textColor: theme.colorText,
          fontSize: 40,
          radius: theme.radius,
        },
      };
    case 'dragitem':
      return {
        ...base,
        w: 260,
        h: 120,
        type: 'dragitem',
        props: {
          label: 'Element',
          assetId: null,
          tag: 'gruppe1',
          bg: theme.colorPrimary,
          color: '#ffffff',
          radius: theme.radius,
          fontSize: 30,
          returnOnMiss: true,
          lockOnDrop: true,
        },
      };
    case 'dropzone':
      return {
        ...base,
        w: 480,
        h: 320,
        type: 'dropzone',
        props: {
          label: 'Hier ablegen',
          accepts: ['gruppe1'],
          snap: true,
          capacity: 0,
          bg: 'rgba(255,255,255,0.04)',
          borderColor: 'rgba(255,255,255,0.3)',
          color: theme.colorText,
          radius: theme.radius,
          fontSize: 28,
        },
      };
  }
}

export const NODE_LABELS: Record<NodeType, string> = {
  text: 'Text',
  image: 'Bild',
  shape: 'Form',
  button: 'Schaltfläche',
  video: 'Video',
  wheel: 'Glücksrad',
  quiz: 'Quiz',
  memory: 'Memory',
  dragitem: 'Zieh-Element',
  dropzone: 'Ablagefläche',
};

function defaultQuestion(): QuizQuestion {
  return {
    id: newId('q'),
    text: 'Ihre Frage?',
    imageAssetId: null,
    answers: [
      { id: newId('a'), text: 'Richtige Antwort', correct: true },
      { id: newId('a'), text: 'Falsche Antwort', correct: false },
    ],
  };
}

function defaultMemoryPairs(): MemoryPair[] {
  return ['A', 'B', 'C', 'D'].map((label) => ({
    id: newId('pair'),
    label,
    assetId: null,
    matchLabel: '',
    matchAssetId: null,
  }));
}

function defaultWheelSegments(theme: Theme): WheelSegment[] {
  const palette = ['#e5484d', '#f5a524', '#30a46c', '#4f8cff', '#8e4ec6', '#e93d82'];
  return palette.map((color, i) => ({
    id: newId('seg'),
    label: `Feld ${i + 1}`,
    color,
    weight: 1,
    value: `feld${i + 1}`,
  }));
}

// ── Zugriffshelfer ───────────────────────────────────────────────────────────

export function findScene(p: AppProject, id: SceneId): Scene | undefined {
  return p.scenes.find((s) => s.id === id);
}

export function findNode(p: AppProject, id: NodeId): AppNode | undefined {
  for (const s of p.scenes) {
    const n = s.nodes.find((x) => x.id === id);
    if (n) return n;
  }
  return undefined;
}

/** Startszene, defensiv: fällt auf die erste Szene zurück. */
export function startScene(p: AppProject): Scene {
  return findScene(p, p.startSceneId) ?? p.scenes[0];
}

export function initialVars(p: AppProject): Record<VarName, number | string | boolean> {
  const out: Record<VarName, number | string | boolean> = {};
  for (const v of p.variables) out[v.name] = v.initial;
  return out;
}

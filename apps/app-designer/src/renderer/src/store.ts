import { create } from 'zustand';
import {
  makeEmptyProject,
  makeNode,
  newId,
  type AppNode,
  type AppProject,
  type NodeId,
  type NodeType,
  type Scene,
  type SceneId,
  type VarDef,
} from '@jm/appkit';
import { uniqueFileName } from '@shared/assets';
import type { AssetBlob } from '@shared/types';

export interface EditorState {
  doc: AppProject;
  assets: AssetBlob[];
  path: string | null;
  dirty: boolean;
  sceneId: SceneId;
  selectedId: NodeId | null;
  /** Trigger-Log aus der Sandbox (jüngste zuerst, gekappt). */
  log: { at: number; text: string }[];
  vars: Record<string, number | string | boolean>;

  /** Rückgängig/Wiederherstellen. Snapshots des Dokuments, nicht der Auswahl. */
  past: AppProject[];
  future: AppProject[];
  undo(): void;
  redo(): void;

  /** Editor-Einstellungen (gehören nicht ins Dokument). */
  snap: boolean;
  grid: number;
  showGrid: boolean;
  setSnap(on: boolean): void;
  setGrid(px: number): void;
  setShowGrid(on: boolean): void;

  loadDoc(doc: AppProject, assets: AssetBlob[], path: string | null): void;
  markSaved(path: string): void;
  /** Projektweite Felder (Name, Auflösung, Thema, Attract-Reset). */
  patchDoc(patch: Partial<AppProject>): void;

  setScene(id: SceneId): void;
  addScene(): void;
  removeScene(id: SceneId): void;
  renameScene(id: SceneId, name: string): void;
  setStartScene(id: SceneId): void;
  patchScene(id: SceneId, patch: Partial<Scene>): void;

  select(id: NodeId | null): void;
  addNode(type: NodeType): void;
  patchNode(id: NodeId, patch: Partial<AppNode>): void;
  removeNode(id: NodeId): void;
  reorderNode(id: NodeId, dir: -1 | 1): void;

  addVar(): void;
  patchVar(name: string, patch: Partial<VarDef>): void;
  removeVar(name: string): void;

  addAssets(blobs: AssetBlob[]): void;

  pushLog(text: string): void;
  setVars(v: Record<string, number | string | boolean>): void;
  clearLog(): void;
}

const LOG_MAX = 60;
const HISTORY_MAX = 100;

/**
 * Gleichartige Änderungen innerhalb dieses Fensters werden zu EINEM Schritt
 * zusammengefasst. Ohne das erzeugte ein Zieh-Vorgang hunderte Undo-Schritte und
 * jeder Buchstabe im Textfeld einen eigenen.
 */
const COALESCE_MS = 600;

/** Ein Node-Patch trifft immer genau eine Szene — Szenen-Arrays neu bauen. */
function mapScene(doc: AppProject, sceneId: SceneId, fn: (s: Scene) => Scene): AppProject {
  return { ...doc, scenes: doc.scenes.map((s) => (s.id === sceneId ? fn(s) : s)) };
}

function kindOf(fileName: string): 'image' | 'video' | 'audio' {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (['.mp4', '.webm'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) return 'audio';
  return 'image';
}

/** Auswahl und Szene nach einem Undo/Redo auf gültige Werte ziehen. */
function reselect(doc: AppProject, sceneId: SceneId, selectedId: NodeId | null) {
  const nextScene = doc.scenes.some((s) => s.id === sceneId) ? sceneId : doc.scenes[0].id;
  const scene = doc.scenes.find((s) => s.id === nextScene);
  const keep = selectedId && scene?.nodes.some((n) => n.id === selectedId) ? selectedId : null;
  return { sceneId: nextScene, selectedId: keep };
}

export const useEditor = create<EditorState>((set) => {
  const initial = makeEmptyProject();

  // Verschmelzungs-Zustand lebt außerhalb des Stores: er beschreibt, WIE der
  // Nutzer gerade tippt oder zieht, nicht das Dokument.
  let lastKey: string | null = null;
  let lastAt = 0;

  /**
   * Eine Dokument-Änderung mit Undo-Eintrag. `key` fasst gleichartige, schnell
   * aufeinanderfolgende Änderungen zu einem Schritt zusammen; `null` erzwingt
   * immer einen eigenen Schritt (Anlegen, Löschen, Umsortieren).
   */
  const edit = (key: string | null, fn: (st: EditorState) => Partial<EditorState>) =>
    set((st) => {
      const patch = fn(st);
      if (!patch.doc || patch.doc === st.doc) return patch;

      const now = Date.now();
      const merge = key !== null && key === lastKey && now - lastAt < COALESCE_MS;
      lastKey = key;
      lastAt = now;

      return {
        ...patch,
        past: merge ? st.past : [...st.past, st.doc].slice(-HISTORY_MAX),
        future: [],
        dirty: true,
      };
    });

  /** Nach Undo/Redo darf die nächste Änderung nicht mit der letzten verschmelzen. */
  const breakCoalesce = (): void => {
    lastKey = null;
  };

  return {
    doc: initial,
    assets: [],
    path: null,
    dirty: false,
    sceneId: initial.startSceneId,
    selectedId: null,
    log: [],
    vars: {},

    past: [],
    future: [],
    snap: true,
    grid: 8,
    showGrid: false,

    setSnap: (on) => set({ snap: on }),
    setGrid: (px) => set({ grid: Math.max(0, Math.round(px)) }),
    setShowGrid: (on) => set({ showGrid: on }),

    undo: () =>
      set((st) => {
        const prev = st.past[st.past.length - 1];
        if (!prev) return st;
        breakCoalesce();
        return {
          doc: prev,
          past: st.past.slice(0, -1),
          future: [st.doc, ...st.future].slice(0, HISTORY_MAX),
          dirty: true,
          ...reselect(prev, st.sceneId, st.selectedId),
        };
      }),

    redo: () =>
      set((st) => {
        const next = st.future[0];
        if (!next) return st;
        breakCoalesce();
        return {
          doc: next,
          past: [...st.past, st.doc].slice(-HISTORY_MAX),
          future: st.future.slice(1),
          dirty: true,
          ...reselect(next, st.sceneId, st.selectedId),
        };
      }),

    loadDoc: (doc, assets, path) => {
      breakCoalesce();
      set({
        doc,
        assets,
        path,
        dirty: false,
        sceneId: doc.startSceneId,
        selectedId: null,
        log: [],
        past: [],
        future: [],
      });
    },
    markSaved: (path) => set({ path, dirty: false }),

    patchDoc: (patch) =>
      edit(`doc:${Object.keys(patch).sort().join(',')}`, (st) => ({ doc: { ...st.doc, ...patch } })),

    setScene: (id) => set({ sceneId: id, selectedId: null }),

    addScene: () =>
      edit(null, (st) => {
        const scene: Scene = {
          id: newId('sc'),
          name: `Szene ${st.doc.scenes.length + 1}`,
          background: st.doc.theme.colorBg,
          nodes: [],
          rules: [],
        };
        return {
          doc: { ...st.doc, scenes: [...st.doc.scenes, scene] },
          sceneId: scene.id,
          selectedId: null,
        };
      }),

    removeScene: (id) =>
      edit(null, (st) => {
        if (st.doc.scenes.length <= 1) return {};
        const scenes = st.doc.scenes.filter((s) => s.id !== id);
        const startSceneId = st.doc.startSceneId === id ? scenes[0].id : st.doc.startSceneId;
        return {
          doc: { ...st.doc, scenes, startSceneId },
          sceneId: st.sceneId === id ? scenes[0].id : st.sceneId,
          selectedId: null,
        };
      }),

    renameScene: (id, name) =>
      edit(`scene:${id}:name`, (st) => ({ doc: mapScene(st.doc, id, (s) => ({ ...s, name })) })),

    setStartScene: (id) => edit(null, (st) => ({ doc: { ...st.doc, startSceneId: id } })),

    patchScene: (id, patch) =>
      edit(`scene:${id}:${Object.keys(patch).sort().join(',')}`, (st) => ({
        doc: mapScene(st.doc, id, (s) => ({ ...s, ...patch })),
      })),

    select: (id) => set({ selectedId: id }),

    addNode: (type) =>
      edit(null, (st) => {
        const node = makeNode(type, st.doc.theme);
        // Mittig auf der Bühne einsetzen — sonst landet alles in der Ecke.
        node.x = Math.round((st.doc.canvas.width - node.w) / 2);
        node.y = Math.round((st.doc.canvas.height - node.h) / 2);
        return {
          doc: mapScene(st.doc, st.sceneId, (s) => ({ ...s, nodes: [...s.nodes, node] })),
          selectedId: node.id,
        };
      }),

    // Der Schlüssel entsteht aus den geänderten Feldern: Ziehen patcht {x,y},
    // Skalieren {x,y,w,h}, Tippen {props}. Gleichartiges verschmilzt, ein Wechsel
    // der Tätigkeit beginnt einen neuen Undo-Schritt.
    patchNode: (id, patch) =>
      edit(`node:${id}:${Object.keys(patch).sort().join(',')}`, (st) => ({
        doc: mapScene(st.doc, st.sceneId, (s) => ({
          ...s,
          nodes: s.nodes.map((n) => (n.id === id ? ({ ...n, ...patch } as AppNode) : n)),
        })),
      })),

    removeNode: (id) =>
      edit(null, (st) => ({
        doc: mapScene(st.doc, st.sceneId, (s) => ({ ...s, nodes: s.nodes.filter((n) => n.id !== id) })),
        selectedId: st.selectedId === id ? null : st.selectedId,
      })),

    reorderNode: (id, dir) =>
      edit(null, (st) => ({
        doc: mapScene(st.doc, st.sceneId, (s) => {
          const i = s.nodes.findIndex((n) => n.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= s.nodes.length) return s;
          const nodes = [...s.nodes];
          [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
          return { ...s, nodes };
        }),
      })),

    addVar: () =>
      edit(null, (st) => {
        const taken = new Set(st.doc.variables.map((v) => v.name));
        let name = 'punkte';
        for (let i = 2; taken.has(name); i++) name = `variable${i}`;
        return {
          doc: { ...st.doc, variables: [...st.doc.variables, { name, type: 'number', initial: 0 }] },
        };
      }),

    patchVar: (name, patch) =>
      edit(`var:${name}`, (st) => ({
        doc: {
          ...st.doc,
          variables: st.doc.variables.map((v) => (v.name === name ? { ...v, ...patch } : v)),
        },
      })),

    removeVar: (name) =>
      edit(null, (st) => ({
        doc: { ...st.doc, variables: st.doc.variables.filter((v) => v.name !== name) },
      })),

    addAssets: (blobs) =>
      edit(null, (st) => {
        const taken = st.assets.map((a) => a.fileName);
        const added: AssetBlob[] = [];
        for (const b of blobs) {
          const fileName = uniqueFileName(b.fileName, [...taken, ...added.map((a) => a.fileName)]);
          added.push({ ...b, id: newId('as'), fileName });
        }
        return {
          assets: [...st.assets, ...added],
          doc: {
            ...st.doc,
            assets: [
              ...st.doc.assets,
              ...added.map((a) => ({
                id: a.id,
                kind: kindOf(a.fileName),
                fileName: a.fileName,
                mime: a.mime,
                bytes: a.bytes.byteLength,
              })),
            ],
          },
        };
      }),

    pushLog: (text) =>
      set((st) => ({ log: [{ at: Date.now(), text }, ...st.log].slice(0, LOG_MAX) })),
    setVars: (vars) => set({ vars }),
    clearLog: () => set({ log: [] }),
  };
});

/** Aktuelle Szene — häufigster Zugriff, daher als Helfer. */
export function useCurrentScene(): Scene {
  return useEditor((s) => s.doc.scenes.find((x) => x.id === s.sceneId) ?? s.doc.scenes[0]);
}

export function useSelectedNode(): AppNode | null {
  const sceneId = useEditor((s) => s.sceneId);
  const selectedId = useEditor((s) => s.selectedId);
  const doc = useEditor((s) => s.doc);
  if (!selectedId) return null;
  const scene = doc.scenes.find((x) => x.id === sceneId);
  return scene?.nodes.find((n) => n.id === selectedId) ?? null;
}

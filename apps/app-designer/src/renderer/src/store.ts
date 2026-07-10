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

  loadDoc(doc: AppProject, assets: AssetBlob[], path: string | null): void;
  markSaved(path: string): void;

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

export const useEditor = create<EditorState>((set) => {
  const initial = makeEmptyProject();
  return {
    doc: initial,
    assets: [],
    path: null,
    dirty: false,
    sceneId: initial.startSceneId,
    selectedId: null,
    log: [],
    vars: {},

    loadDoc: (doc, assets, path) =>
      set({ doc, assets, path, dirty: false, sceneId: doc.startSceneId, selectedId: null, log: [] }),
    markSaved: (path) => set({ path, dirty: false }),

    setScene: (id) => set({ sceneId: id, selectedId: null }),

    addScene: () =>
      set((st) => {
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
          dirty: true,
        };
      }),

    removeScene: (id) =>
      set((st) => {
        if (st.doc.scenes.length <= 1) return st;
        const scenes = st.doc.scenes.filter((s) => s.id !== id);
        const startSceneId = st.doc.startSceneId === id ? scenes[0].id : st.doc.startSceneId;
        return {
          doc: { ...st.doc, scenes, startSceneId },
          sceneId: st.sceneId === id ? scenes[0].id : st.sceneId,
          selectedId: null,
          dirty: true,
        };
      }),

    renameScene: (id, name) =>
      set((st) => ({ doc: mapScene(st.doc, id, (s) => ({ ...s, name })), dirty: true })),

    setStartScene: (id) => set((st) => ({ doc: { ...st.doc, startSceneId: id }, dirty: true })),

    patchScene: (id, patch) =>
      set((st) => ({ doc: mapScene(st.doc, id, (s) => ({ ...s, ...patch })), dirty: true })),

    select: (id) => set({ selectedId: id }),

    addNode: (type) =>
      set((st) => {
        const node = makeNode(type, st.doc.theme);
        // Mittig auf der Bühne einsetzen — sonst landet alles in der Ecke.
        node.x = Math.round((st.doc.canvas.width - node.w) / 2);
        node.y = Math.round((st.doc.canvas.height - node.h) / 2);
        return {
          doc: mapScene(st.doc, st.sceneId, (s) => ({ ...s, nodes: [...s.nodes, node] })),
          selectedId: node.id,
          dirty: true,
        };
      }),

    patchNode: (id, patch) =>
      set((st) => ({
        doc: mapScene(st.doc, st.sceneId, (s) => ({
          ...s,
          nodes: s.nodes.map((n) => (n.id === id ? ({ ...n, ...patch } as AppNode) : n)),
        })),
        dirty: true,
      })),

    removeNode: (id) =>
      set((st) => ({
        doc: mapScene(st.doc, st.sceneId, (s) => ({ ...s, nodes: s.nodes.filter((n) => n.id !== id) })),
        selectedId: st.selectedId === id ? null : st.selectedId,
        dirty: true,
      })),

    reorderNode: (id, dir) =>
      set((st) => ({
        doc: mapScene(st.doc, st.sceneId, (s) => {
          const i = s.nodes.findIndex((n) => n.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= s.nodes.length) return s;
          const nodes = [...s.nodes];
          [nodes[i], nodes[j]] = [nodes[j], nodes[i]];
          return { ...s, nodes };
        }),
        dirty: true,
      })),

    addVar: () =>
      set((st) => {
        const taken = new Set(st.doc.variables.map((v) => v.name));
        let name = 'punkte';
        for (let i = 2; taken.has(name); i++) name = `variable${i}`;
        return {
          doc: { ...st.doc, variables: [...st.doc.variables, { name, type: 'number', initial: 0 }] },
          dirty: true,
        };
      }),

    patchVar: (name, patch) =>
      set((st) => ({
        doc: {
          ...st.doc,
          variables: st.doc.variables.map((v) => (v.name === name ? { ...v, ...patch } : v)),
        },
        dirty: true,
      })),

    removeVar: (name) =>
      set((st) => ({
        doc: { ...st.doc, variables: st.doc.variables.filter((v) => v.name !== name) },
        dirty: true,
      })),

    addAssets: (blobs) =>
      set((st) => {
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
          dirty: true,
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

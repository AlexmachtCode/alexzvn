import { useCallback, useEffect, useRef } from 'react';
import { EditorController } from '@/engine/render/EditorController';
import type { ToolId } from '@/engine/types';
import { useEditor } from '@/store/editor';
import { ToolDock } from '@/components/editor/ToolDock';
import { ToolOptionsBar } from '@/components/editor/ToolOptionsBar';
import { RightPanel } from '@/components/editor/RightPanel';
import { importBytesAsLayer } from '@/components/editor/EditorActions';
import { jmgToDoc } from '@/engine/io/project';

const SHORTCUT: Record<string, ToolId> = {
  v: 'move',
  b: 'brush',
  e: 'eraser',
  g: 'fill',
  m: 'marquee',
  l: 'lasso',
  w: 'wand',
  u: 'shape',
  t: 'text',
  c: 'crop',
  i: 'eyedropper',
  h: 'hand',
  z: 'zoom',
};

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

export function EditorView() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const attach = useEditor((s) => s.attach);
  const detach = useEditor((s) => s.detach);
  const sync = useEditor((s) => s.sync);
  const canUndo = useEditor((s) => s.canUndo);
  const layerCount = useEditor((s) => s.layers.length);

  // Create the engine controller once the host element exists.
  useEffect(() => {
    if (!hostRef.current) return;
    const controller = new EditorController(hostRef.current);
    attach(controller);
    (window as unknown as { __editor?: EditorController }).__editor = controller;
    const off = controller.onChange(() => sync());
    controller.fitView();
    return () => {
      off();
      controller.destroy();
      detach();
    };
  }, [attach, detach, sync]);

  // Keyboard shortcuts (tools, undo/redo, selection, colors, brush size).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = useEditor.getState().controller;
      if (!c || isTyping(e.target)) return;
      const meta = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (meta) {
        if (k === 'z') {
          e.preventDefault();
          e.shiftKey ? c.redo() : c.undo();
        } else if (k === 'y') {
          e.preventDefault();
          c.redo();
        } else if (k === 'a') {
          e.preventDefault();
          c.selectAll();
        } else if (k === 'd') {
          e.preventDefault();
          c.clearSelection();
        } else if (k === 'i') {
          e.preventDefault();
          c.invertSelection();
        } else if (k === 't') {
          e.preventDefault();
          c.setTool('transform');
        }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        c.deleteSelectionContent();
      } else if (k === 'x') {
        c.swapColors();
      } else if (k === '[') {
        c.setBrush({ size: Math.max(1, c.brush.size - 4) });
      } else if (k === ']') {
        c.setBrush({ size: c.brush.size + 4 });
      } else if (SHORTCUT[k]) {
        c.setTool(SHORTCUT[k]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Show-Integration (C3): per .jmshow referenziertes Dokument laden — gleiche
  // Anwende-Logik wie beim manuellen „Öffnen" (.jmg → ganzes Dokument ersetzen,
  // sonst als Ebene importieren).
  useEffect(() => {
    if (!window.jmg?.onFileOpened) return;
    return window.jmg.onFileOpened(async (f) => {
      const c = useEditor.getState().controller;
      if (!c) return;
      const kind = f.fileName.split('.').pop()?.toLowerCase();
      if (kind === 'jmg') c.setDocument(await jmgToDoc(f.bytes));
      else await importBytesAsLayer(c, f.bytes, f.fileName);
    });
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const controller = useEditor.getState().controller;
    if (!controller) return;
    const file = e.dataTransfer.files[0];
    if (!file) return;
    let bytes: Uint8Array;
    if (window.jmg) {
      const path = window.jmg.pathForFile(file);
      const picked = path ? await window.jmg.file.read(path) : null;
      bytes = picked ? picked.bytes : new Uint8Array(await file.arrayBuffer());
    } else {
      bytes = new Uint8Array(await file.arrayBuffer());
    }
    await importBytesAsLayer(controller, bytes, file.name);
  }, []);

  const showHint = !canUndo && layerCount <= 1;

  return (
    <div className="h-full flex">
      <ToolDock />
      <div className="flex-1 min-w-0 flex flex-col">
        <ToolOptionsBar />
        <div
          ref={hostRef}
          className="relative flex-1 min-h-0 overflow-hidden bg-[#1d1d1d]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          {showHint && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none z-[2]">
              <div className="text-center">
                <p className="text-sm font-bold text-[var(--foreground)]/70">Neue Arbeitsfläche</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Bild importieren oder hierher ziehen · Werkzeuge links
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      <RightPanel />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Splitter, Tabs, type TabItem } from '@jm/ui';
import { Toolbar } from './components/Toolbar';
import { CanvasStage } from './components/CanvasStage';
import { PreviewFrame } from './components/PreviewFrame';
import { Inspector } from './components/Inspector';
import { LayerPanel, ScenePanel, VariablesPanel } from './components/SidePanels';
import { useEditor } from './store';

type MainTab = 'design' | 'play';

const TABS: TabItem<MainTab>[] = [
  { key: 'design', label: 'Gestalten' },
  { key: 'play', label: 'Testen' },
];

/** In Eingabefeldern gehört Strg+Z dem Browser — sonst verliert man den Tippfehler nicht, sondern die Szene. */
function inTextField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

export function App(): JSX.Element {
  const [left, setLeft] = useState(260);
  const [right, setRight] = useState(400);
  const [bottom, setBottom] = useState(180);
  const [tab, setTab] = useState<MainTab>('design');

  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || inTextField(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <div className="flex h-full flex-col">
      <Toolbar />

      <div className="flex min-h-0 flex-1">
        <aside className="flex shrink-0 flex-col overflow-hidden" style={{ width: left }}>
          <ScenePanel />
          <LayerPanel />
        </aside>
        <Splitter orientation="v" onDelta={(d) => setLeft((w) => Math.max(200, Math.min(420, w + d)))} />

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-[var(--border)] px-3 py-2">
            <div className="w-64">
              <Tabs items={TABS} value={tab} onChange={setTab} />
            </div>
          </div>
          <div className="min-h-0 flex-1">
            {/* Beide gemountet lassen: ein Wechsel nach „Testen" soll den Player
                nicht jedes Mal neu starten und den Punktestand wegwerfen. */}
            <div className="h-full" style={{ display: tab === 'design' ? 'block' : 'none' }}>
              <CanvasStage />
            </div>
            <div className="h-full" style={{ display: tab === 'play' ? 'block' : 'none' }}>
              <PreviewFrame />
            </div>
          </div>

          <Splitter orientation="h" onDelta={(d) => setBottom((h) => Math.max(100, Math.min(400, h - d)))} />
          <section className="shrink-0 border-t border-[var(--border)]" style={{ height: bottom }}>
            <VariablesPanel />
          </section>
        </main>

        <Splitter orientation="v" onDelta={(d) => setRight((w) => Math.max(320, Math.min(560, w - d)))} />
        <aside className="shrink-0 overflow-y-auto border-l border-[var(--border)]" style={{ width: right }}>
          <Inspector />
        </aside>
      </div>
    </div>
  );
}

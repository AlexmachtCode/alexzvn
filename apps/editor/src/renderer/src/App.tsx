import { useEffect, useState } from 'react';
import '@fontsource-variable/manrope';
import { cn } from '@jm/ui';
import { Topbar } from './components/Topbar';
import { MediaBin } from './components/MediaBin';
import { SourceMonitor } from './components/SourceMonitor';
import { PreviewMonitor } from './components/PreviewMonitor';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline';
import { ExportDialog } from './components/ExportDialog';
import { Splitter } from './components/Splitter';
import { useProject } from './store/project';
import { useLayout } from './store/layout';
import { saveProjectFlow } from './lib/actions';

export function App() {
  const [exportOpen, setExportOpen] = useState(false);
  const setProxyProgress = useProject((s) => s.setProxyProgress);
  const setProxyDone = useProject((s) => s.setProxyDone);
  const setExportStatus = useProject((s) => s.setExportStatus);

  // IPC-Events abonnieren.
  useEffect(() => {
    const offPP = window.jmed.onProxyProgress((p) => setProxyProgress(p));
    const offPD = window.jmed.onProxyDone((r) => setProxyDone(r));
    const offEP = window.jmed.onExportProgress((p) =>
      setExportStatus({ running: true, percent: p.percent, etaSec: p.etaSec }),
    );
    const offED = window.jmed.onExportDone((r) => {
      if (r.canceled) {
        setExportStatus({ running: false, percent: 0, message: 'Abgebrochen', error: undefined });
      } else if (r.success) {
        setExportStatus({ running: false, percent: 100, lastOutput: r.outputPath, error: undefined, message: 'Fertig' });
      } else {
        setExportStatus({ running: false, error: r.error ?? 'Export fehlgeschlagen' });
      }
    });
    return () => {
      offPP();
      offPD();
      offEP();
      offED();
    };
  }, [setProxyProgress, setProxyDone, setExportStatus]);

  // Tastenkürzel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      const st = useProject.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveProjectFlow(false);
      } else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        st.undo();
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        st.redo();
      } else if (e.key === ' ') {
        e.preventDefault();
        st.setPlaying(!st.playing);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        st.deleteSelected();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        st.splitAtPlayhead();
      } else if (st.sourceAssetId && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        st.setSourceIn(st.sourcePlayheadUs);
      } else if (st.sourceAssetId && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        st.setSourceOut(st.sourcePlayheadUs);
      } else if (st.sourceAssetId && e.key === ',') {
        e.preventDefault();
        st.insertFromSource('insert');
      } else if (st.sourceAssetId && e.key === '.') {
        e.preventDefault();
        st.insertFromSource('overwrite');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <Topbar onExport={() => setExportOpen(true)} />

      <ViewBar />
      <PanelArea />

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}

/** Schlanke „Ansicht"-Leiste: Panels ein-/ausblenden + Layout zurücksetzen (#95). */
function ViewBar(): React.JSX.Element {
  const showMediaBin = useLayout((s) => s.showMediaBin);
  const showSource = useLayout((s) => s.showSource);
  const showPreview = useLayout((s) => s.showPreview);
  const showInspector = useLayout((s) => s.showInspector);
  const showTimeline = useLayout((s) => s.showTimeline);
  const toggleMediaBin = useLayout((s) => s.toggleMediaBin);
  const toggleSource = useLayout((s) => s.toggleSource);
  const togglePreview = useLayout((s) => s.togglePreview);
  const toggleInspector = useLayout((s) => s.toggleInspector);
  const toggleTimeline = useLayout((s) => s.toggleTimeline);
  const reset = useLayout((s) => s.reset);

  return (
    <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 border-b border-[var(--border)]/50 bg-[var(--card)]/20">
      <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)] mr-1">
        Ansicht
      </span>
      <ViewToggle label="Medien" active={showMediaBin} onClick={toggleMediaBin} />
      <ViewToggle label="Quelle" active={showSource} onClick={toggleSource} />
      <ViewToggle label="Vorschau" active={showPreview} onClick={togglePreview} />
      <ViewToggle label="Inspector" active={showInspector} onClick={toggleInspector} />
      <ViewToggle label="Timeline" active={showTimeline} onClick={toggleTimeline} />
      <button
        type="button"
        onClick={reset}
        title="Panel-Größen + Sichtbarkeit auf Standard zurücksetzen"
        className="ml-auto h-6 px-2 rounded-[var(--radius)] text-[10px] font-bold text-[var(--muted-foreground)] hover:bg-[var(--highlight)]"
      >
        Layout zurücksetzen
      </button>
    </div>
  );
}

function ViewToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${label} ${active ? 'ausblenden' : 'einblenden'}`}
      className={cn(
        'h-6 px-2.5 rounded-[var(--radius)] text-[10px] font-bold border',
        active
          ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent'
          : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--highlight)]',
      )}
    >
      {label}
    </button>
  );
}

/** Andockbare Panels mit resizebaren Splittern (#95). Größen + Sichtbarkeit aus useLayout. */
function PanelArea(): React.JSX.Element {
  const mediaBinW = useLayout((s) => s.mediaBinW);
  const inspectorW = useLayout((s) => s.inspectorW);
  const timelineH = useLayout((s) => s.timelineH);
  const sourceW = useLayout((s) => s.sourceW);
  const showMediaBin = useLayout((s) => s.showMediaBin);
  const showSource = useLayout((s) => s.showSource);
  const showPreview = useLayout((s) => s.showPreview);
  const showInspector = useLayout((s) => s.showInspector);
  const showTimeline = useLayout((s) => s.showTimeline);
  const nudgeMediaBin = useLayout((s) => s.nudgeMediaBin);
  const nudgeInspector = useLayout((s) => s.nudgeInspector);
  const nudgeTimeline = useLayout((s) => s.nudgeTimeline);
  const nudgeSource = useLayout((s) => s.nudgeSource);

  const bothMonitors = showSource && showPreview;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 flex">
        {showMediaBin && (
          <>
            <div className="shrink-0 h-full" style={{ width: mediaBinW }}>
              <MediaBin />
            </div>
            <Splitter orientation="v" onDelta={nudgeMediaBin} title="Medien-Breite anpassen" />
          </>
        )}

        {/* Monitor-Bereich (Quelle / Vorschau) */}
        <div className="flex-1 min-w-0 flex">
          {showSource && (
            <div
              className={cn('h-full min-w-0', bothMonitors ? 'shrink-0' : 'flex-1')}
              style={bothMonitors ? { width: sourceW } : undefined}
            >
              <SourceMonitor />
            </div>
          )}
          {bothMonitors && (
            <Splitter orientation="v" onDelta={nudgeSource} title="Quelle/Vorschau anpassen" />
          )}
          {showPreview && (
            <div className="flex-1 min-w-0 h-full">
              <PreviewMonitor />
            </div>
          )}
        </div>

        {showInspector && (
          <>
            <Splitter orientation="v" onDelta={nudgeInspector} title="Inspector-Breite anpassen" />
            <div className="shrink-0 h-full" style={{ width: inspectorW }}>
              <Inspector />
            </div>
          </>
        )}
      </div>
      {showTimeline && (
        <>
          <Splitter orientation="h" onDelta={nudgeTimeline} title="Timeline-Höhe anpassen" />
          <div className="shrink-0" style={{ height: timelineH }}>
            <Timeline />
          </div>
        </>
      )}
    </div>
  );
}

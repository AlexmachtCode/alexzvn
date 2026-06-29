import { useEffect, useState } from 'react';
import '@fontsource-variable/manrope';
import { Topbar } from './components/Topbar';
import { Transport } from './components/Transport';
import { RecordBar } from './components/RecordBar';
import { MediaBin } from './components/MediaBin';
import { Timeline } from './components/Timeline';
import { Inspector } from './components/Inspector';
import { Mixer } from './components/Mixer';
import { ExportDialog } from './components/ExportDialog';
import { Splitter } from './components/Splitter';
import { cn } from '@jm/ui';
import { useProject } from './store/project';
import { useLayout } from './store/layout';
import { useLiveMix, useTransport } from './lib/transport';
import { useRemoteControl } from './lib/remote-control';
import { useMixerWindowHost } from './lib/mixer-host';
import { saveProjectFlow } from './lib/actions';

export function App() {
  const [exportOpen, setExportOpen] = useState(false);
  const setExportStatus = useProject((s) => s.setExportStatus);
  const setRecLevels = useProject((s) => s.setRecLevels);
  const setRecFromMain = useProject((s) => s.setRecFromMain);

  useTransport();
  useLiveMix();
  useRemoteControl();
  useMixerWindowHost();

  // IPC-Events abonnieren.
  useEffect(() => {
    const offEP = window.jmdaw.onExportProgress((p) =>
      setExportStatus({ running: true, percent: p.percent }),
    );
    const offED = window.jmdaw.onExportDone((r) => {
      if (r.canceled) {
        setExportStatus({ running: false, percent: 0, message: 'Abgebrochen', error: undefined });
      } else if (r.success) {
        setExportStatus({ running: false, percent: 100, lastOutput: r.outputPath, error: undefined, message: 'Fertig' });
      } else {
        setExportStatus({ running: false, error: r.error ?? 'Export fehlgeschlagen' });
      }
    });
    const offRL = window.jmdaw.onRecLevels((l) => setRecLevels(l.peaks));
    const offRS = window.jmdaw.onRecState((s) => setRecFromMain(s));
    return () => {
      offEP();
      offED();
      offRL();
      offRS();
    };
  }, [setExportStatus, setRecLevels, setRecFromMain]);

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
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        st.duplicateSelected();
      } else if (e.key === ' ') {
        e.preventDefault();
        st.setPlaying(!st.playing);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        st.deleteSelected();
      } else if (!mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        st.splitAtPlayhead();
      } else if (!mod && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        st.toggleLoop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <Topbar onExport={() => setExportOpen(true)} />
      <Transport />
      <RecordBar />

      <ViewBar />
      <PanelArea />

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}

/** Schlanke „Ansicht"-Leiste: Panels ein-/ausblenden + Layout zurücksetzen (#95). */
function ViewBar(): React.JSX.Element {
  const showMediaBin = useLayout((s) => s.showMediaBin);
  const showInspector = useLayout((s) => s.showInspector);
  const showMixer = useLayout((s) => s.showMixer);
  const toggleMediaBin = useLayout((s) => s.toggleMediaBin);
  const toggleInspector = useLayout((s) => s.toggleInspector);
  const toggleMixer = useLayout((s) => s.toggleMixer);
  const reset = useLayout((s) => s.reset);

  return (
    <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 border-b border-[var(--border)]/50 bg-[var(--card)]/20">
      <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--muted-foreground)] mr-1">
        Ansicht
      </span>
      <ViewToggle label="Medien" active={showMediaBin} onClick={toggleMediaBin} />
      <ViewToggle label="Inspector" active={showInspector} onClick={toggleInspector} />
      <ViewToggle label="Mixer" active={showMixer} onClick={toggleMixer} />
      <button
        type="button"
        onClick={() => void window.jmdaw.mixerWin.open()}
        title="Mixer in eigenem Fenster öffnen (z. B. für einen zweiten Monitor)"
        className="ml-auto h-6 px-2.5 rounded-[var(--radius)] text-[10px] font-bold border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--highlight)]"
      >
        ⧉ Mixer-Fenster
      </button>
      <button
        type="button"
        onClick={reset}
        title="Panel-Größen + Sichtbarkeit auf Standard zurücksetzen"
        className="h-6 px-2 rounded-[var(--radius)] text-[10px] font-bold text-[var(--muted-foreground)] hover:bg-[var(--highlight)]"
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

/** Andockbare Panels mit resizebaren Splittern (#95). Breiten/Höhe + Sichtbarkeit aus useLayout. */
function PanelArea(): React.JSX.Element {
  const mediaBinW = useLayout((s) => s.mediaBinW);
  const inspectorW = useLayout((s) => s.inspectorW);
  const mixerH = useLayout((s) => s.mixerH);
  const showMediaBin = useLayout((s) => s.showMediaBin);
  const showInspector = useLayout((s) => s.showInspector);
  const showMixer = useLayout((s) => s.showMixer);
  const nudgeMediaBin = useLayout((s) => s.nudgeMediaBin);
  const nudgeInspector = useLayout((s) => s.nudgeInspector);
  const nudgeMixer = useLayout((s) => s.nudgeMixer);

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
        <div className="flex-1 min-w-0">
          <Timeline />
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
      {showMixer && (
        <>
          <Splitter orientation="h" onDelta={nudgeMixer} title="Mixer-Höhe anpassen" />
          <div className="shrink-0" style={{ height: mixerH }}>
            <Mixer />
          </div>
        </>
      )}
    </div>
  );
}

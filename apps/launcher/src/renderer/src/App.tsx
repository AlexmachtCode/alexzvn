import { useEffect } from 'react';
import { Button } from '@jm/ui';
import { Header } from '@/components/Header';
import { TabBar } from '@/components/TabBar';
import { ToolboxView } from '@/components/ToolboxView';
import { ShowView } from '@/components/ShowView';
import { SettingsModal } from '@/components/SettingsModal';
import { FeedbackModal } from '@/components/FeedbackModal';
import { PatchNotesModal } from '@/components/PatchNotesModal';
import { CookbookModal } from '@/components/CookbookModal';
import { RecipeDraftModal } from '@/components/RecipeDraftModal';
import { SystemStatusModal } from '@/components/SystemStatusModal';
import { ShowEditorModal } from '@/components/ShowEditorModal';
import { ShowLaunchOverlay } from '@/components/ShowLaunchOverlay';
import { useTools } from '@/store/tools';

export function App() {
  const notice = useTools((s) => s.notice);
  const load = useTools((s) => s.load);
  const setNotice = useTools((s) => s.setNotice);
  const view = useTools((s) => s.view);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);

  return (
    <div className="h-full flex flex-col">
      <Header />

      <LauncherUpdateBanner />

      <TabBar />

      <main className="flex-1 overflow-auto">
        {view === 'catalog' ? <ToolboxView /> : <ShowView />}
      </main>

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 flex justify-center px-6">
          <div
            className="pointer-events-auto jm-fade-in rounded-[var(--radius-lg)] border border-[var(--primary)]/40
                       bg-[var(--card)] px-4 py-2.5 text-sm font-semibold shadow-lg max-w-xl text-center"
          >
            {notice}
          </div>
        </div>
      )}

      <SettingsModal />
      <FeedbackModal />
      <PatchNotesModal />
      <CookbookModal />
      <RecipeDraftModal />
      <SystemStatusModal />
      <ShowEditorModal />
      <ShowLaunchOverlay />
    </div>
  );
}

function LauncherUpdateBanner() {
  const upd = useTools((s) => s.launcherUpdate);
  const busy = useTools((s) => s.busy['launcher'] ?? false);
  const progress = useTools((s) => s.progress['launcher']);
  const updateLauncher = useTools((s) => s.updateLauncher);

  if (!upd) return null;

  const downloading = busy && progress?.phase === 'download';
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-b border-[var(--primary)]/40
                 bg-[var(--highlight)] px-6 py-2.5 text-sm"
    >
      <span className="font-semibold">
        Neue Launcher-Version <strong>{upd.latest}</strong> verfügbar
        <span className="text-[var(--muted-foreground)]"> (installiert {upd.current})</span>
      </span>
      <Button size="sm" variant="primary" disabled={busy} onClick={() => updateLauncher()}>
        {downloading
          ? `Lädt… ${progress?.pct ?? 0}%`
          : busy
            ? 'Installer startet…'
            : 'Aktualisieren'}
      </Button>
    </div>
  );
}

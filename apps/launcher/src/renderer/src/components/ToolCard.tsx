import { Badge, Button, Card, cn } from '@jm/ui';
import type { ToolManifest, ToolState } from '@shared/types';
import { displayName, monogram } from '@/lib/monogram';
import { toolIcon } from '@/lib/tool-icons';
import { useChangelog } from '@/store/changelog';
import { useCookbook } from '@/store/cookbook';
import { useTools } from '@/store/tools';

interface Props {
  tool: ToolManifest;
  state?: ToolState;
}

export function ToolCard({ tool, state }: Props) {
  const status = state?.status ?? 'not-installed';
  const busy = useTools((s) => s.busy[tool.id] ?? false);
  const progress = useTools((s) => s.progress[tool.id]);
  const open = useTools((s) => s.open);
  const install = useTools((s) => s.install);
  const update = useTools((s) => s.update);
  const uninstall = useTools((s) => s.uninstall);
  const openPatchNotes = useTools((s) => s.openPatchNotes);
  const openCookbook = useCookbook((s) => s.openCookbook);
  const manualId = useCookbook((s) => s.manualFor(tool.id));
  const changelogFor = useChangelog((s) => s.changelogFor);
  const hasNotes = Boolean(changelogFor(tool.app));
  const showProgress = busy && progress && progress.phase !== 'done' && progress.phase !== 'error';

  return (
    <Card className="h-full p-5 flex flex-col gap-4 jm-fade-in">
      <div className="flex items-start gap-4">
        <ToolIcon tool={tool} />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-extrabold leading-tight truncate" title={tool.name}>
            {displayName(tool.name)}
          </h3>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted-foreground)] mt-0.5">
            {tool.tagline}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="text-sm leading-snug text-[var(--foreground)]/80 flex-1">
        {tool.description}
      </p>

      {showProgress ? (
        <ProgressStrip
          phase={progress.phase}
          pct={progress.pct}
          message={progress.message}
        />
      ) : (
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            {hasNotes ? (
              <button
                type="button"
                onClick={() => openPatchNotes({ app: tool.app })}
                title="Patch Notes anzeigen"
                className="underline-offset-2 hover:text-[var(--foreground)] hover:underline transition-colors"
              >
                v{state?.installedVersion ?? tool.latestVersion}
              </button>
            ) : (
              <>v{state?.installedVersion ?? tool.latestVersion}</>
            )}{' '}
            · {tool.category}
            {status === 'update-available' && state?.latestAvailable
              ? ` · Update auf ${state.latestAvailable}`
              : ''}
            {manualId && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={() => openCookbook(manualId)}
                  title="Anleitung im Kochbuch öffnen"
                  className="underline-offset-2 hover:text-[var(--foreground)] hover:underline transition-colors"
                >
                  Anleitung
                </button>
              </>
            )}
          </span>
          <Actions
            status={status}
            busy={busy}
            onOpen={() => open(tool.id)}
            onInstall={() => install(tool.id)}
            onUpdate={() => update(tool.id)}
            onUninstall={() => uninstall(tool.id)}
          />
        </div>
      )}
    </Card>
  );
}

/**
 * App-Icon der Kachel. Hat ein Tool (noch) keins, bleibt es beim Kürzel — die Kachel darf nie
 * leer sein, nur weil ein Icon fehlt.
 */
function ToolIcon({ tool }: { tool: ToolManifest }) {
  const src = toolIcon(tool.id);
  if (!src) {
    return (
      <div
        className="grid place-items-center size-12 shrink-0 rounded-[var(--radius-lg)]
                   border border-[var(--primary)]/40 bg-[var(--highlight)]
                   text-lg font-extrabold tracking-tight text-[var(--primary)]"
        aria-hidden
      >
        {monogram(tool.name)}
      </div>
    );
  }
  // Das SVG bringt seine dunkle Kachel samt Rundung selbst mit — kein Rahmen, kein Hintergrund.
  return <img src={src} alt="" aria-hidden className="size-12 shrink-0 rounded-[var(--radius-lg)]" />;
}

function ProgressStrip({
  phase,
  pct,
  message,
}: {
  phase: 'download' | 'install' | 'done' | 'error';
  pct?: number;
  message?: string;
}) {
  const label = message ?? (phase === 'download' ? 'Lade herunter…' : 'Installiere…');
  const indeterminate = pct === undefined;
  return (
    <div className="pt-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)] mb-1.5">
        <span>{label}</span>
        {pct !== undefined && <span className="tabular">{pct}%</span>}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-[var(--radius-full)] bg-[var(--muted)]">
        <div
          className={cn('h-full rounded-[var(--radius-full)] bg-[var(--primary)]', indeterminate && 'w-1/3 animate-pulse')}
          style={indeterminate ? undefined : { width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ToolState['status'] }) {
  if (status === 'installed') return <Badge tone="success">Installiert</Badge>;
  if (status === 'update-available') return <Badge tone="warning">Update</Badge>;
  return <Badge tone="muted">Nicht installiert</Badge>;
}

function Actions({
  status,
  busy,
  onOpen,
  onInstall,
  onUpdate,
  onUninstall,
}: {
  status: ToolState['status'];
  busy: boolean;
  onOpen: () => void;
  onInstall: () => void;
  onUpdate: () => void;
  onUninstall: () => void;
}) {
  if (status === 'not-installed') {
    return (
      <Button size="sm" variant="outline" disabled={busy} onClick={onInstall}>
        Installieren
      </Button>
    );
  }
  // installiert (ggf. mit Update): Deinstallieren + Öffnen (+ Update).
  const isUpdate = status === 'update-available';
  return (
    <div className="flex items-center gap-2">
      <UninstallButton busy={busy} onClick={onUninstall} />
      <Button size="sm" variant={isUpdate ? 'outline' : 'primary'} disabled={busy} onClick={onOpen}>
        Öffnen
      </Button>
      {isUpdate && (
        <Button size="sm" variant="primary" disabled={busy} onClick={onUpdate}>
          Update
        </Button>
      )}
    </div>
  );
}

function UninstallButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      aria-label="Deinstallieren"
      title="Deinstallieren"
      className={cn(
        'grid place-items-center size-8 shrink-0 rounded-[var(--radius)]',
        'border border-[var(--border)] text-[var(--muted-foreground)] transition-colors',
        'hover:border-[var(--destructive)]/50 hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]',
        'disabled:opacity-50 disabled:pointer-events-none',
      )}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}

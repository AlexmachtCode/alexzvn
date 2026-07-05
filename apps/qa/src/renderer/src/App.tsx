import { useEffect, useState } from 'react';
import { useQa } from '@/store/useQa';
import { COUPLED_ROLES, roleLabel } from '@/lib/capabilities';
import { ActivePanel } from '@/components/ActivePanel';
import { Queue } from '@/components/Queue';
import { AddForm } from '@/components/AddForm';
import { RemotePanel } from '@/components/RemotePanel';
import { CloudPanel } from '@/components/CloudPanel';
import { Settings } from '@/components/Settings';
import { ConnectionsPanel } from '@/components/ConnectionsPanel';

const topBtn = 'rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--highlight)]';

export function App() {
  const { state, load, next, endActive, setEndpoint, setConfig } = useQa();
  const [showSettings, setShowSettings] = useState(false);
  const [showConnections, setShowConnections] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state) {
    return <div className="grid h-full place-items-center text-[var(--muted-foreground)]">Lädt …</div>;
  }

  const waiting = state.entries.filter((e) => e.status === 'waiting').length;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2">
        <span className="font-bold">JM Q&A</span>
        <span className="text-xs text-[var(--muted-foreground)]">{waiting} wartend</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowConnections(true)} className={topBtn}>
            Verbindungen
          </button>
          <button onClick={() => setShowSettings(true)} className={topBtn}>
            Einstellungen
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        {/* Links: aktiver Sprecher + Queue + Hinzufügen */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
          <ActivePanel state={state} onEnd={() => void endActive()} onNext={() => void next()} />
          <Queue entries={state.entries} config={state.config} />
          <AddForm />
        </div>

        {/* Rechts: Saal-Einreichung (QR) + externe Einreichung + Kopplungsstatus */}
        <div className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto">
          <RemotePanel remote={state.remote} />
          <CloudPanel cloud={state.cloud} />
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/40 p-3">
            <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">Kopplung</h2>
            <div className="space-y-1.5">
              {COUPLED_ROLES.map((role) => {
                const link = state.links.find((l) => l.role === role);
                const enabled = role === 'timer' ? state.config.autoTimer : state.config.autoTitler;
                const connected = !!link?.connected;
                // Ehrlicher Status: aus / aktiviert-aber-nicht-gefunden / gekoppelt.
                const dot = !enabled ? 'bg-[var(--muted-foreground)]' : connected ? 'bg-[var(--success)]' : 'bg-[var(--warning)]';
                const status = !enabled
                  ? 'aus'
                  : connected
                    ? `gekoppelt · ${link?.host}:${link?.port}`
                    : 'aktiviert · nicht gefunden';
                const toggle = (): void =>
                  void setConfig(role === 'timer' ? { autoTimer: !enabled } : { autoTitler: !enabled });
                return (
                  <div key={role} className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                    <span className="text-[var(--foreground)]">{roleLabel(role)}</span>
                    <span
                      className={`ml-auto truncate text-[11px] ${
                        enabled && !connected ? 'text-[var(--warning)]' : 'text-[var(--muted-foreground)]'
                      }`}
                    >
                      {status}
                    </span>
                    <button
                      onClick={toggle}
                      title={enabled ? 'Auto-Kopplung ausschalten' : 'Auto-Kopplung einschalten'}
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                        enabled
                          ? 'border-[var(--success)]/60 bg-[var(--success)]/15 text-[var(--success)]'
                          : 'border-[var(--border)] bg-[var(--input)] text-[var(--muted-foreground)]'
                      } hover:brightness-125`}
                    >
                      {enabled ? 'An' : 'Aus'}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
              Standardmäßig aktiv: Redezeit (Timer) und Bauchbinde (Titler) werden beim Ans-Wort-Holen
              automatisch gesteuert — hier pro Werkzeug mit einem Klick umschaltbar.
            </p>
          </div>
        </div>
      </div>

      {showSettings && <Settings config={state.config} cloud={state.cloud} onClose={() => setShowSettings(false)} />}
      {showConnections && (
        <ConnectionsPanel
          links={state.links}
          overrides={state.overrides}
          onSet={(role, host, port) => void setEndpoint(role, host, port)}
          onClose={() => setShowConnections(false)}
        />
      )}
    </div>
  );
}

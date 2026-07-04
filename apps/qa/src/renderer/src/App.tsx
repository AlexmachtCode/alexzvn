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

const topBtn = 'rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800';

export function App() {
  const { state, load, next, endActive, setEndpoint } = useQa();
  const [showSettings, setShowSettings] = useState(false);
  const [showConnections, setShowConnections] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state) {
    return <div className="grid h-full place-items-center text-neutral-500">Lädt …</div>;
  }

  const waiting = state.entries.filter((e) => e.status === 'waiting').length;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-neutral-800 px-4 py-2">
        <span className="font-bold">JM Q&A</span>
        <span className="text-xs text-neutral-500">{waiting} wartend</span>
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
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
            <h2 className="mb-2 text-sm font-semibold text-neutral-300">Kopplung</h2>
            <div className="space-y-1.5">
              {COUPLED_ROLES.map((role) => {
                const link = state.links.find((l) => l.role === role);
                return (
                  <div key={role} className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 rounded-full ${link?.connected ? 'bg-green-500' : 'bg-neutral-600'}`} />
                    <span className="text-neutral-300">{roleLabel(role)}</span>
                    <span className="ml-auto text-[11px] text-neutral-500">
                      {link?.connected ? `${link.host}:${link.port}` : 'getrennt'}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-neutral-600">
              Beim Ans-Wort-Holen werden Redezeit (Timer) und Bauchbinde (Titler) automatisch gesteuert.
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

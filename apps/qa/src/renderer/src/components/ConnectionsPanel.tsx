import { useState } from 'react';
import { COUPLED_ROLES, CAPABILITIES } from '@/lib/capabilities';
import type { Endpoint, ToolLink } from '@shared/types';

const inp = 'rounded border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-sm text-[var(--foreground)]';
const btn = 'rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--highlight)]';

/** Modal: Steuer-Endpunkte der gekoppelten Tools (Timer, Titler) anzeigen/setzen. */
export function ConnectionsPanel({
  links,
  overrides,
  onSet,
  onClose,
}: {
  links: ToolLink[];
  overrides: Record<string, Endpoint>;
  onSet: (role: string, host: string, port: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onClick={onClose}>
      <div
        className="w-[40rem] rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center">
          <h2 className="text-lg font-semibold">Tool-Verbindungen</h2>
          <button onClick={onClose} className="ml-auto rounded px-2 text-[var(--muted-foreground)] hover:bg-[var(--highlight)]">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-[var(--muted-foreground)]">
          Q&amp;A koppelt Redezeit an den <b>JM Timer</b> und die Bauchbinde an den <b>JM Titler</b>. Standard ist
          automatisch (mDNS); für Cross-Subnet einen Host/Port manuell setzen. „Auto" entfernt den Override.
        </p>
        <div className="space-y-2">
          {COUPLED_ROLES.map((role) => (
            <RoleRow key={role} role={role} link={links.find((l) => l.role === role)} override={overrides[role]} onSet={onSet} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RoleRow({
  role,
  link,
  override,
  onSet,
}: {
  role: string;
  link: ToolLink | undefined;
  override: Endpoint | undefined;
  onSet: (role: string, host: string, port: number) => void;
}) {
  const cap = CAPABILITIES[role];
  const [host, setHost] = useState(override?.host ?? link?.host ?? '');
  const [port, setPort] = useState(String(override?.port ?? link?.port ?? cap?.port ?? ''));

  const status = link?.connected
    ? `verbunden ${link.host}:${link.port} (${link.source === 'manual' ? 'manuell' : 'mDNS'})`
    : override
      ? `manuell ${override.host}:${override.port} — suche …`
      : 'nicht verbunden';

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2">
      <div className="w-40 shrink-0">
        <div className="text-sm font-medium">{cap?.label ?? role}</div>
        <div className={`text-[11px] ${link?.connected ? 'text-[var(--success)]' : 'text-[var(--muted-foreground)]'}`}>{status}</div>
      </div>
      <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="IP (leer = mDNS)" className={`${inp} flex-1`} />
      <input value={port} onChange={(e) => setPort(e.target.value)} className={`${inp} w-20`} inputMode="numeric" />
      <button onClick={() => onSet(role, host.trim(), Number(port))} className={btn}>
        Setzen
      </button>
      <button onClick={() => onSet(role, '', 0)} title="zurück auf Auto/mDNS" className={btn}>
        Auto
      </button>
    </div>
  );
}

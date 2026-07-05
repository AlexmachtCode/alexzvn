import { useState } from 'react';
import { Modal } from '@jm/ui';
import { CAPABILITIES, KNOWN_ROLES } from '@/lib/capabilities';
import type { Endpoint, ToolLink } from '@shared/types';

const inp = 'rounded border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-sm text-[var(--foreground)]';
const btn = 'rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--highlight)]';

/** Modal: je Rolle den Steuer-Endpunkt anzeigen + bei Bedarf manuell setzen. */
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
    <Modal onClose={onClose} title="Tool-Verbindungen" className="w-[42rem]">
      <p className="mb-3 text-xs text-[var(--muted-foreground)]">
        Standard ist automatisch (mDNS). Für Cross-Subnet oder bei blockiertem mDNS einen Host/Port
        manuell setzen — das überschreibt den Fund. „Auto" entfernt den Override wieder.
      </p>
      <div className="space-y-2">
        {KNOWN_ROLES.map((role) => (
          <RoleRow
            key={role}
            role={role}
            link={links.find((l) => l.role === role)}
            override={overrides[role]}
            onSet={onSet}
          />
        ))}
      </div>
    </Modal>
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
  const [port, setPort] = useState(String(override?.port ?? link?.port ?? cap.port));

  const status = link?.connected
    ? `verbunden ${link.host}:${link.port} (${link.source === 'manual' ? 'manuell' : 'mDNS'})`
    : override
      ? `manuell ${override.host}:${override.port} — suche …`
      : 'nicht verbunden';

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2">
      <div className="w-44 shrink-0">
        <div className="text-sm font-medium">{cap.label}</div>
        <div className={`text-[11px] ${link?.connected ? 'text-[var(--success)]' : 'text-[var(--muted-foreground)]'}`}>{status}</div>
      </div>
      <input
        value={host}
        onChange={(e) => setHost(e.target.value)}
        placeholder="IP (leer = mDNS)"
        className={`${inp} flex-1`}
      />
      <input
        value={port}
        onChange={(e) => setPort(e.target.value)}
        className={`${inp} w-20`}
        inputMode="numeric"
      />
      <button onClick={() => onSet(role, host.trim(), Number(port))} className={btn}>
        Setzen
      </button>
      <button onClick={() => onSet(role, '', 0)} title="zurück auf Auto/mDNS" className={btn}>
        Auto
      </button>
    </div>
  );
}

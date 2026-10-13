import { useEffect, useState } from 'react';
import { CAPABILITIES } from '@/lib/capabilities';
import type { ToolLink, VerbundAnzeigeZeile } from '@shared/types';

const VERBUND_FARBE: Record<VerbundAnzeigeZeile['farbe'], string> = {
  gruen: 'border-[var(--success)]/50 text-[var(--success)]',
  gelb: 'border-[var(--warning)]/60 text-[var(--warning)]',
  rot: 'border-[var(--destructive)]/60 text-[var(--destructive)]',
  gedaempft: 'border-[var(--border)] text-[var(--muted-foreground)]',
};

/**
 * Verbund-Anzeige im Statusstreifen (Master-Link Teil 2b, Spec 16.4/16.5): die V-Zeile aus app-runtime,
 * gekürzt mit „…“, voller Text als Tooltip. Am Einzelplatz (null) nichts.
 */
function VerbundZeile() {
  const [anzeige, setAnzeige] = useState<VerbundAnzeigeZeile | null>(null);
  useEffect(() => {
    void window.jmrundown.verbundAnzeige().then(setAnzeige);
    return window.jmrundown.onVerbundAnzeige(setAnzeige);
  }, []);
  if (!anzeige) return null;
  return (
    <span
      title={anzeige.text}
      className={`inline-flex max-w-[28rem] shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs ${VERBUND_FARBE[anzeige.farbe]}`}
    >
      <span className="truncate">{anzeige.text}</span>
    </span>
  );
}

function isTruthy(v: string | undefined): boolean {
  return v === '1' || v === 'true' || v === 'an';
}

const rgb = (c: [number, number, number]): string => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Aktive „truthy"-Feedbacks eines Tools (REC, ON AIR, läuft …) als Tally. */
function tally(role: string, state: Record<string, string> | null) {
  if (!state) return [];
  return (CAPABILITIES[role]?.feedbacks ?? [])
    .filter((f) => f.match === 'truthy' && isTruthy(state[f.stateKey]))
    .map((f) => ({ label: f.label, bg: rgb(f.bgcolor), fg: rgb(f.color) }));
}

/** Status-Strip: vom Conductor gefundene/verbundene Tools + Live-Tally. */
export function ToolLinks({ links, onOpenConnections }: { links: ToolLink[]; onOpenConnections: () => void }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5">
      <VerbundZeile />
      {links.length === 0 ? (
        <span className="text-xs text-[var(--muted-foreground)]">
          Noch keine Tools gefunden — Suite-Tools im selben Netz starten (mDNS) oder Verbindungen manuell setzen.
        </span>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {links.map((l) => (
            <span
              key={l.role}
              title={`${l.host}:${l.port} (${l.source === 'manual' ? 'manuell' : 'mDNS'})`}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ${
                l.connected ? 'bg-[var(--success)]/15 text-[var(--success)]' : 'bg-[var(--muted)]/40 text-[var(--muted-foreground)]'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${l.connected ? 'bg-[var(--success)]' : 'bg-[var(--muted-foreground)]'}`} />
              {l.label}
              {l.source === 'manual' && <span className="opacity-50">⚙</span>}
              {tally(l.role, l.state).map((t) => (
                <span
                  key={t.label}
                  className="rounded px-1 text-[10px] font-semibold"
                  style={{ background: t.bg, color: t.fg }}
                >
                  {t.label}
                </span>
              ))}
            </span>
          ))}
        </div>
      )}
      <button
        onClick={onOpenConnections}
        className="ml-auto rounded-md border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--foreground)] hover:bg-[var(--highlight)]"
      >
        Verbindungen …
      </button>
    </div>
  );
}

// Pille „Scanning“ über StatusPill aus @jm/ui (UX Welle 2b, Studio-Control d2; B16); sonst unverändert.
import { useApp, discoveryKey } from '@/store/app';
import { useSession } from '@/store/session';
import { Button, StatusPill } from '@jm/ui';
import { emitWithAck, apiFetch } from '@/sync/client';
import { EVENTS } from '@shared/protocol';
import { DEFAULT_TRICASTER_PORT } from '@shared/tricaster';
import { canDo } from '@shared/roles';
import type { DiscoveredDevice, DeviceKind } from '@shared/device';

const PROTO_LABEL: Record<string, string> = {
  mdns: 'mDNS',
  artpoll: 'Artnet',
  panasonic: 'Panasonic',
  aja: 'AjA',
};

function guessKind(d: DiscoveredDevice): DeviceKind {
  const hay = `${d.vendor ?? ''} ${d.model ?? ''} ${d.name ?? ''}`.toLowerCase();
  if (hay.includes('tricaster') || hay.includes('newtek')) return 'tricaster';
  if (hay.includes('aw-ue')) return 'panasonic-ptz';
  if (hay.includes('aw-rp')) return 'panasonic-rp';
  if (hay.includes('kumo') || hay.includes('aja')) return 'aja-kumo';
  if (hay.includes('ultimatte') || hay.includes('blackmagic')) return 'ultimatte';
  if (hay.includes('eurolite') || hay.includes('artnet')) return 'artnet-node';
  return 'unknown';
}

export function DiscoverPanel() {
  const discovery = useApp((s) => s.discovery);
  const setRunning = useApp((s) => s.setDiscoveryRunning);
  const clear = useApp((s) => s.clearDiscovery);
  const dismiss = useApp((s) => s.dismissDiscoveryResult);
  const role = useSession((s) => s.user?.role);
  const token = useSession((s) => s.token);
  const canScan = role ? canDo(role, 'discovery:run') : false;
  const canAdd = role ? canDo(role, 'inventory:write') : false;

  async function startScan(): Promise<void> {
    setRunning(true);
    try {
      await emitWithAck(EVENTS.DISCOVERY_RUN);
    } catch (err) {
      console.warn('discovery run failed', err);
      setRunning(false);
    }
  }

  async function addToInventory(d: DiscoveredDevice): Promise<void> {
    const kind = guessKind(d);
    await emitWithAck(EVENTS.INVENTORY_UPSERT, {
      device: {
        id: `dev-${(d.mac ?? d.ip).replace(/[^a-z0-9]/gi, '')}`,
        kind,
        name: d.name ?? d.model ?? d.ip,
        ip: d.ip,
        mac: d.mac,
        model: d.model,
        vendor: d.vendor,
      },
    });
    // A discovered TriCaster should also become a controllable instance in the
    // Video tab — otherwise it only appears in the inventory table.
    if (kind === 'tricaster') {
      try {
        await apiFetch('/api/tricasters', {
          method: 'POST',
          token,
          body: JSON.stringify({
            id: `tc-${(d.mac ?? d.ip).replace(/[^a-z0-9]/gi, '')}`,
            name: d.name ?? d.model ?? `TriCaster ${d.ip}`,
            host: d.ip,
            port: DEFAULT_TRICASTER_PORT,
          }),
        });
      } catch (err) {
        console.warn('tricaster instance create failed', err);
      }
    }
    // Once adopted, drop it from the scan list so it's clear what's left.
    dismiss(discoveryKey(d));
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Button onClick={startScan} disabled={!canScan || discovery.running}>
          {discovery.running ? 'Scan läuft …' : 'Scan starten'}
        </Button>
        <Button variant="ghost" onClick={clear} disabled={discovery.running}>
          Liste leeren
        </Button>
        {discovery.running && <StatusPill state="warn" text="Scanning" />}
        {!discovery.running && discovery.lastDuration !== undefined && (
          <span className="text-xs text-[var(--muted-foreground)]">
            Letzter Scan: {discovery.results.length} Geräte · {(discovery.lastDuration / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      <div className="grid grid-cols-[110px_1fr_1fr_140px_1fr_auto] gap-3 px-2 py-2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] border-b border-[var(--border)]/40">
        <div>Protokoll</div>
        <div>Name</div>
        <div>IP</div>
        <div>MAC</div>
        <div>Modell</div>
        <div></div>
      </div>
      {discovery.results.length === 0 ? (
        <p className="px-2 py-6 text-sm text-[var(--muted-foreground)]">
          Noch keine Ergebnisse.
        </p>
      ) : (
        discovery.results.map((d) => (
          <div
            key={`${d.protocol}-${d.ip}-${d.mac ?? ''}`}
            className="grid grid-cols-[110px_1fr_1fr_140px_1fr_auto] gap-3 items-center px-2 py-3 border-b border-[var(--border)]/20"
          >
            <div className="text-xs text-[var(--primary)] font-bold">
              {PROTO_LABEL[d.protocol] ?? d.protocol}
            </div>
            <div className="text-sm">{d.name ?? '—'}</div>
            <div className="text-sm tabular-nums">{d.ip}</div>
            <div className="text-xs text-[var(--muted-foreground)] tabular-nums">{d.mac ?? '—'}</div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {d.vendor ?? ''} {d.model ?? ''}
            </div>
            <div className="flex gap-1 justify-end">
              {canAdd && (
                <Button size="sm" variant="outline" onClick={() => addToInventory(d)}>
                  Übernehmen
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => dismiss(discoveryKey(d))}
                title="Aus der Liste ausblenden"
              >
                Ausblenden
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// Video · OBS (UX Welle 2b, Studio-Control d2; B16, B3, Ruling Task 18): Pille über StatusPill aus @jm/ui mit geraetPille, die
// Hauptreihe Aufnahme · Stream als TallyButtons aus obsTasten, jede im Behälter mit der alten Mindestbreite min-w-[120px];
// Szenen bleiben normale Knöpfe. Der Gerätezustand gilt nur bei verbundenem Server (gemeldet). Befehle wie bisher.
import { useMemo, useState } from 'react';
import { Card, Button, StatusPill, TallyButton, cn, type TallyButtonProps } from '@jm/ui';
import { Input } from '@/components/ui/Input';
import { Headline } from '@/components/ui/Headline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { STUDIO_TEXTE, gemeldet, geraetPille, obsTasten, type OberflaechenStand } from '@/lib/oberflaeche';
import { useApp } from '@/store/app';
import { useSession } from '@/store/session';
import { emitWithAck, apiFetch } from '@/sync/client';
import { EVENTS } from '@shared/protocol';
import type { ObsCommand, ObsConfig } from '@shared/obs';
import { DEFAULT_OBS_PORT } from '@shared/obs';
import { canDo } from '@shared/roles';

/** Die Hauptreihe aus obsTasten (Zustand und Grund): Aufnahme sendet record, Stream sendet stream (wie bisher). Rein, ohne DOM prüfbar. */
export function obsReihe(stand: OberflaechenStand, id: string, exec: (c: ObsCommand) => void): TallyButtonProps[] {
  const befehle: ObsCommand[] = [{ type: 'record' }, { type: 'stream' }];
  return obsTasten(stand, id).map((t, i) => ({ ...t, onClick: () => exec(befehle[i]!) }));
}

/** Steuert eine OBS-Instanz über die studio-control-OBS-WebSocket-Bridge. */
export function ObsPanel({ stand }: { stand: OberflaechenStand }) {
  const obs = useApp((s) => s.obs);
  const statuses = useApp((s) => s.obsStatuses);
  const role = useSession((s) => s.user?.role);
  const token = useSession((s) => s.token);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const current = useMemo(() => obs.find((o) => o.id === selectedId) ?? obs[0], [obs, selectedId]);
  // Nur bei verbundenem Server gemessen (sonst Pille unbekannt, keine Szenen, Tasten gesperrt).
  const status = current ? gemeldet(stand, statuses[current.id]) : undefined;
  const live = status?.state === 'connected';

  const canExec = role ? canDo(role, 'obs:exec') : false;
  const canManage = role ? canDo(role, 'inventory:write') : false;

  async function exec(command: ObsCommand): Promise<void> {
    if (!current) return;
    try {
      await emitWithAck(EVENTS.OBS_EXEC, { obsId: current.id, command });
    } catch (err) {
      console.warn('obs exec failed', err);
    }
  }

  async function save(cfg: ObsConfig): Promise<void> {
    await apiFetch('/api/obs', { method: 'POST', token, body: JSON.stringify(cfg) });
    setAdding(false);
    setEditing(false);
    setSelectedId(cfg.id);
  }
  async function remove(id: string): Promise<void> {
    if (!confirm('OBS-Instanz wirklich entfernen?')) return;
    await apiFetch(`/api/obs/${encodeURIComponent(id)}`, { method: 'DELETE', token });
    setEditing(false);
    setSelectedId(null);
  }

  return (
    <Card data-panel="obs" className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <SectionHeader>Video · OBS</SectionHeader>
          <Headline variant="section" className="mt-2">
            OBS Studio
          </Headline>
        </div>
        <div className="flex items-center gap-3">
          {current && (
            <>
              <select
                value={current.id}
                onChange={(e) => setSelectedId(e.target.value)}
                className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
              >
                {obs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.host}:{o.port})
                  </option>
                ))}
              </select>
              <StatusPill {...geraetPille(status)} />
              {canManage && (
                <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
                  {editing ? 'Schließen' : 'Bearbeiten'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {current && status?.state === 'down' && status.lastError && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--destructive)]/50 bg-[var(--destructive)]/10 px-3 py-2 text-xs">
          <span className="font-extrabold uppercase tracking-wider text-[var(--destructive)]">Verbindung fehlgeschlagen:</span>{' '}
          <span className="text-[var(--foreground)]">{status.lastError}</span>
          <span className="text-[var(--muted-foreground)]"> — WebSocket-Server in OBS aktiv? (Werkzeuge → WebSocket-Server-Einstellungen)</span>
        </div>
      )}

      {current && editing && canManage && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--border)]/60 bg-[var(--card)]/40 p-4">
          <ObsForm initial={current} onSubmit={save} onCancel={() => setEditing(false)} onDelete={() => remove(current.id)} />
        </div>
      )}

      {!current ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-[var(--muted-foreground)]">Noch keine OBS-Instanz konfiguriert.</p>
          {canManage ? (
            adding ? (
              <ObsForm onSubmit={save} onCancel={() => setAdding(false)} />
            ) : (
              <Button onClick={() => setAdding(true)}>OBS hinzufügen</Button>
            )
          ) : (
            <p className="text-xs text-[var(--muted-foreground)]">Ein Admin/Operator kann im Setup eine OBS-Instanz anlegen.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Szenen</div>
            {status?.scenes && status.scenes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {status.scenes.map((scene) => {
                  const on = status.currentScene === scene;
                  return (
                    <button
                      key={scene}
                      disabled={!canExec || !live}
                      onClick={() => exec({ type: 'scene', scene })}
                      className={cn(
                        'h-11 rounded-[var(--radius)] border px-4 text-sm font-bold disabled:opacity-40',
                        on ? 'text-[var(--destructive-foreground)]' : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]/30',
                      )}
                      style={on ? { background: 'var(--destructive)', borderColor: 'var(--destructive)' } : undefined}
                    >
                      {scene}
                    </button>
                  );
                })}
              </div>
            ) : (
              // Ohne Meldung (oder ohne Server) ist die Verbindung nicht gemessen: unbekannt, nie „Nicht verbunden.“ (Task 16).
              <p className="text-xs text-[var(--muted-foreground)]">{live ? 'Keine Szenen.' : status === undefined ? STUDIO_TEXTE.grund.unbekannt : 'Nicht verbunden.'}</p>
            )}
          </div>

          {/* Hauptreihe wie bisher unter den Szenen; jede Taste im Behälter mit der alten Mindestbreite (B16).
              Der Sperrgrund (span mit id im TallyButton) bricht innerhalb der Tastenbreite um: Die Taste bleibt so breit wie ihre
              Beschriftung, die Reihe bleibt eine Zeile wie heute (Task 18, Variante A gemessen: sonst bricht die Reihe um). */}
          <div data-studio="hauptreihe-obs" className="flex flex-wrap gap-2 [&_button>span[id]]:w-0 [&_button>span[id]]:min-w-full">
            {obsReihe(stand, current.id, (c) => void exec(c)).map((p) => (
              <div key={p.label} className="min-w-[120px]">
                <TallyButton {...p} />
              </div>
            ))}
          </div>

          {canManage && !adding && (
            <div className="border-t border-[var(--border)]/40 pt-4">
              <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                Weitere Instanz
              </Button>
            </div>
          )}
          {canManage && adding && (
            <div className="border-t border-[var(--border)]/40 pt-4">
              <ObsForm onSubmit={save} onCancel={() => setAdding(false)} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ObsForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: ObsConfig;
  onSubmit: (cfg: ObsConfig) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? 'OBS');
  const [host, setHost] = useState(initial?.host ?? '127.0.0.1');
  const [port, setPort] = useState(String(initial?.port ?? DEFAULT_OBS_PORT));
  const [password, setPassword] = useState(initial?.password ?? '');
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const portNum = Number(port);
        if (!host || !name || !Number.isInteger(portNum) || portNum <= 0) return;
        setBusy(true);
        try {
          await onSubmit({
            id: initial?.id ?? `obs-${Date.now().toString(36)}`,
            name,
            host,
            port: portNum,
            password: password || undefined,
          });
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Name
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Host / IP
        <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="127.0.0.1" required />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Port
        <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} className="w-24" required />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Passwort
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="(optional)" />
      </label>
      <Button type="submit" disabled={busy}>
        Speichern
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel}>
        Abbrechen
      </Button>
      {onDelete && (
        <Button type="button" variant="destructive" onClick={onDelete}>
          Entfernen
        </Button>
      )}
    </form>
  );
}

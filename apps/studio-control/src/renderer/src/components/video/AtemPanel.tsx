// Video · ATEM (UX Welle 2b, Studio-Control d2; B16, B3, Ruling Task 18): Pille über StatusPill aus @jm/ui mit geraetPille, die
// Hauptreihe Cut · Auto · FTB · REC · STREAM als TallyButtons aus atemTasten, jede im Behälter mit der alten Mindestbreite
// min-w-[110px]; Busse bleiben normale Knöpfe. Der Gerätezustand gilt nur bei verbundenem Server (gemeldet). Befehle wie bisher.
import { useMemo, useState } from 'react';
import { Card, Button, StatusPill, TallyButton, cn, type TallyButtonProps } from '@jm/ui';
import { Input } from '@/components/ui/Input';
import { Headline } from '@/components/ui/Headline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { atemTasten, gemeldet, geraetPille, type OberflaechenStand } from '@/lib/oberflaeche';
import { useApp } from '@/store/app';
import { useSession } from '@/store/session';
import { emitWithAck, apiFetch } from '@/sync/client';
import { EVENTS, type AtemStatusEvent } from '@shared/protocol';
import type { AtemCommand, AtemConfig } from '@shared/atem';
import { canDo } from '@shared/roles';

const INPUTS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Die Hauptreihe aus atemTasten (Zustand und Grund), jede Taste mit ihrem heutigen Befehl: Cut, Auto, FTB, REC und STREAM
 * schalten mit on: !recording bzw. !streaming (gemeldeter Status). Rein, ohne DOM prüfbar.
 */
export function atemReihe(stand: OberflaechenStand, id: string, status: AtemStatusEvent | undefined, exec: (c: AtemCommand) => void): TallyButtonProps[] {
  const befehle: AtemCommand[] = [{ type: 'cut' }, { type: 'auto' }, { type: 'ftb' }, { type: 'record', on: !status?.recording }, { type: 'stream', on: !status?.streaming }];
  return atemTasten(stand, id).map((t, i) => ({ ...t, onClick: () => exec(befehle[i]!) }));
}

/** Steuert einen Blackmagic-ATEM (M/E 1) über die studio-control-Bridge. */
export function AtemPanel({ stand }: { stand: OberflaechenStand }) {
  const atem = useApp((s) => s.atem);
  const statuses = useApp((s) => s.atemStatuses);
  const role = useSession((s) => s.user?.role);
  const token = useSession((s) => s.token);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const current = useMemo(() => atem.find((a) => a.id === selectedId) ?? atem[0], [atem, selectedId]);
  // Nur bei verbundenem Server gemessen (sonst Pille unbekannt, Busse und Tasten gesperrt, keine gemeldete Auswahl).
  const status = current ? gemeldet(stand, statuses[current.id]) : undefined;
  const live = status?.state === 'connected';

  const canExec = role ? canDo(role, 'atem:exec') : false;
  const canManage = role ? canDo(role, 'inventory:write') : false;

  async function exec(command: AtemCommand): Promise<void> {
    if (!current) return;
    try {
      await emitWithAck(EVENTS.ATEM_EXEC, { atemId: current.id, command });
    } catch (err) {
      console.warn('atem exec failed', err);
    }
  }

  async function save(cfg: AtemConfig): Promise<void> {
    await apiFetch('/api/atem', { method: 'POST', token, body: JSON.stringify(cfg) });
    setAdding(false);
    setEditing(false);
    setSelectedId(cfg.id);
  }
  async function remove(id: string): Promise<void> {
    if (!confirm('ATEM-Instanz wirklich entfernen?')) return;
    await apiFetch(`/api/atem/${encodeURIComponent(id)}`, { method: 'DELETE', token });
    setEditing(false);
    setSelectedId(null);
  }

  return (
    <Card data-panel="atem" className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <SectionHeader>Video · ATEM</SectionHeader>
          <Headline variant="section" className="mt-2">
            Blackmagic-Mischer
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
                {atem.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.host})
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
        </div>
      )}

      {current && editing && canManage && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--border)]/60 bg-[var(--card)]/40 p-4">
          <AtemForm initial={current} onSubmit={save} onCancel={() => setEditing(false)} onDelete={() => remove(current.id)} />
        </div>
      )}

      {!current ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-[var(--muted-foreground)]">Noch kein ATEM konfiguriert.</p>
          {canManage ? (
            adding ? (
              <AtemForm onSubmit={save} onCancel={() => setAdding(false)} />
            ) : (
              <Button onClick={() => setAdding(true)}>ATEM hinzufügen</Button>
            )
          ) : (
            <p className="text-xs text-[var(--muted-foreground)]">Ein Admin/Operator kann im Setup einen ATEM anlegen.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <BusRow
            label="Program"
            tone="program"
            current={status?.program}
            disabled={!canExec || !live}
            onPick={(input) => exec({ type: 'program', input })}
          />
          <BusRow
            label="Preview"
            tone="preview"
            current={status?.preview}
            disabled={!canExec || !live}
            onPick={(input) => exec({ type: 'preview', input })}
          />

          {/* Hauptreihe wie bisher unter den Bussen; jede Taste im Behälter mit der alten Mindestbreite (B16).
              Der Sperrgrund (span mit id im TallyButton) bricht innerhalb der Tastenbreite um: Die Taste bleibt so breit wie ihre
              Beschriftung, die Reihe bleibt eine Zeile wie heute (Task 18, Variante A gemessen: sonst bricht die Reihe um). */}
          <div data-studio="hauptreihe-atem" className="flex flex-wrap gap-2 [&_button>span[id]]:w-0 [&_button>span[id]]:min-w-full">
            {atemReihe(stand, current.id, status, (c) => void exec(c)).map((p) => (
              <div key={p.label} className="min-w-[110px]">
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
              <AtemForm onSubmit={save} onCancel={() => setAdding(false)} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function BusRow({
  label,
  tone,
  current,
  disabled,
  onPick,
}: {
  label: string;
  tone: 'program' | 'preview';
  current?: number;
  disabled: boolean;
  onPick: (input: number) => void;
}) {
  const active = tone === 'program' ? 'var(--destructive)' : 'var(--accent)';
  const aufAktiv = tone === 'program' ? 'text-[var(--destructive-foreground)]' : 'text-[var(--accent-foreground)]';
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{label}</div>
      <div className="flex flex-wrap gap-2">
        {INPUTS.map((n) => {
          const on = current === n;
          return (
            <button
              key={n}
              disabled={disabled}
              onClick={() => onPick(n)}
              className={cn(
                'h-11 w-12 rounded-[var(--radius)] border text-sm font-bold tabular-nums disabled:opacity-40',
                on ? aufAktiv : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]/30',
              )}
              style={on ? { background: active, borderColor: active } : undefined}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AtemForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: AtemConfig;
  onSubmit: (cfg: AtemConfig) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? 'ATEM Mini');
  const [host, setHost] = useState(initial?.host ?? '');
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!host || !name) return;
        setBusy(true);
        try {
          await onSubmit({ id: initial?.id ?? `atem-${Date.now().toString(36)}`, name, host });
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
        <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.10.20" required />
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

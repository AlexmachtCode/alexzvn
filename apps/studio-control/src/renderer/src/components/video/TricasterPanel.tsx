// Video · TriCaster (UX Welle 2b, Studio-Control d2; B16, B6, Ruling Task 18): Pille über StatusPill aus @jm/ui mit geraetPille,
// die Hauptreihe Take · Auto · Fade Black · REC · STREAM als TallyButtons aus tricasterTasten, jede im Behälter mit der alten
// Mindestbreite min-w-[120px]; darunter der Hinweis „REC und STREAM ohne Rückmeldung“ (der TriCaster meldet keine Sendung, B6).
// DSK, DDR und Makros bleiben normale Knöpfe. Der Gerätezustand gilt nur bei verbundenem Server (gemeldet). Befehle wie bisher.
import { useMemo, useState } from 'react';
import { Card } from '@jm/ui';
import { Button, StatusPill, TallyButton, type TallyButtonProps } from '@jm/ui';
import { Input } from '@/components/ui/Input';
import { Headline } from '@/components/ui/Headline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { STUDIO_TEXTE, gemeldet, geraetPille, tricasterTasten, type OberflaechenStand } from '@/lib/oberflaeche';
import { useApp } from '@/store/app';
import { useSession } from '@/store/session';
import { emitWithAck, apiFetch } from '@/sync/client';
import { EVENTS } from '@shared/protocol';
import {
  MACRO_CATALOG,
  DEFAULT_TRICASTER_PORT,
  type MacroEntry,
  type MacroCategory,
  type TricasterConfig,
} from '@shared/tricaster';
import { canDo } from '@shared/roles';
import { cn } from '@jm/ui';
import { AuditLogPanel } from './AuditLogPanel';
import { PgmPreview } from './PgmPreview';
import { DskPanel } from './DskPanel';
import { DdrPanel } from './DdrPanel';

/** Die TriCaster-Kürzel der Hauptreihe in der Reihenfolge von tricasterTasten: Take, Auto, Fade Black, REC, STREAM (wie bisher). */
const HAUPT_KUERZEL = ['main_take', 'main_auto', 'main_fade_to_black', 'record_toggle_start', 'streaming_toggle_start'] as const;

/** Die Hauptreihe aus tricasterTasten (Zustand und Grund), jede Taste mit ihrem heutigen Kürzel. Rein, ohne DOM prüfbar. */
export function tricasterReihe(stand: OberflaechenStand, id: string, exec: (shortcut: string) => void): TallyButtonProps[] {
  return tricasterTasten(stand, id).map((t, i) => ({ ...t, onClick: () => exec(HAUPT_KUERZEL[i]!) }));
}

export function TricasterPanel({ stand }: { stand: OberflaechenStand }) {
  const tricasters = useApp((s) => s.tricasters);
  const statuses = useApp((s) => s.tricasterStatuses);
  const role = useSession((s) => s.user?.role);
  const token = useSession((s) => s.token);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const current = useMemo(
    () => tricasters.find((t) => t.id === selectedId) ?? tricasters[0],
    [tricasters, selectedId],
  );
  // Nur bei verbundenem Server gemessen (sonst Pille unbekannt, Tasten gesperrt).
  const status = current ? gemeldet(stand, statuses[current.id]) : undefined;
  const live = status?.state === 'connected';

  const canExec = role ? canDo(role, 'tricaster:exec') : false;
  const canManage = role ? canDo(role, 'inventory:write') : false;

  async function exec(shortcut: string): Promise<void> {
    if (!current) return;
    try {
      await emitWithAck(EVENTS.TRICASTER_EXEC, {
        tricasterId: current.id,
        shortcut,
      });
    } catch (err) {
      console.warn('exec failed', err);
    }
  }

  async function saveTricaster(cfg: TricasterConfig): Promise<void> {
    await apiFetch('/api/tricasters', {
      method: 'POST',
      token,
      body: JSON.stringify(cfg),
    });
    setAdding(false);
    setEditing(false);
    setSelectedId(cfg.id);
  }

  async function deleteTricaster(id: string): Promise<void> {
    if (!confirm('TriCaster-Instanz wirklich entfernen?')) return;
    await apiFetch(`/api/tricasters/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      token,
    });
    setEditing(false);
    setSelectedId(null);
  }

  return (
    <Card data-panel="tricaster" className="p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <SectionHeader>Video · TriCaster</SectionHeader>
          <Headline variant="section" className="mt-2">
            Bildmischer
          </Headline>
        </div>
        <div className="flex items-center gap-3">
          {current ? (
            <>
              <select
                value={current.id}
                onChange={(e) => setSelectedId(e.target.value)}
                className="h-10 px-3 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-sm"
              >
                {tricasters.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.host}:{t.port})
                  </option>
                ))}
              </select>
              <StatusPill {...geraetPille(status)} />
              {canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing((v) => !v)}
                >
                  {editing ? 'Schließen' : 'Bearbeiten'}
                </Button>
              )}
            </>
          ) : null}
        </div>
      </div>

      {current && status?.state === 'down' && status.lastError && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--destructive)]/50 bg-[var(--destructive)]/10 px-3 py-2 text-xs">
          <span className="font-extrabold uppercase tracking-wider text-[var(--destructive)]">
            Verbindung fehlgeschlagen:
          </span>{' '}
          <span className="text-[var(--foreground)]">{status.lastError}</span>
          <span className="text-[var(--muted-foreground)]">
            {' '}
            — Adresse{' '}
            <code className="tabular-nums">
              http://{current.host}
              {current.port !== 80 ? `:${current.port}` : ''}/v1/version
            </code>{' '}
            prüfen.
          </span>
        </div>
      )}

      {current && editing && canManage && (
        <div className="mb-6 rounded-[var(--radius)] border border-[var(--border)]/60 bg-[var(--card)]/40 p-4">
          <TricasterForm
            initial={current}
            onSubmit={saveTricaster}
            onCancel={() => setEditing(false)}
            onDelete={() => deleteTricaster(current.id)}
          />
        </div>
      )}

      {!current ? (
        <div className="flex flex-col gap-3 items-start">
          <p className="text-sm text-[var(--muted-foreground)]">
            Noch keine TriCaster-Instanz konfiguriert.
          </p>
          {canManage ? (
            adding ? (
              <TricasterForm onSubmit={saveTricaster} onCancel={() => setAdding(false)} />
            ) : (
              <Button onClick={() => setAdding(true)}>TriCaster hinzufügen</Button>
            )
          ) : (
            <p className="text-xs text-[var(--muted-foreground)]">
              Frage einen Admin / Operator, eine TriCaster-Instanz im Setup anzulegen.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 mb-6 items-start">
            {/* Die Zelle gibt die Höhe des Hinweises mit -mb-6 an den Rasterabstand gap-6 zurück: Im einspaltigen Raster (unter xl)
                rutscht so nichts darunter tiefer (gemessen ohne: 24 px, die ATEM-Program-Busse lagen auf den alten Preview-Plätzen). */}
            <div className="-mb-6">
              {/* Hauptreihe wie bisher links neben der Vorschau; jede Taste im Behälter mit der alten Mindestbreite (B16).
                  Der Sperrgrund (span mit id im TallyButton) bricht innerhalb der Tastenbreite um: Die Taste bleibt so breit wie ihre
                  Beschriftung, die Reihe bleibt eine Zeile wie heute (Task 18, Variante A gemessen: sonst bricht die Reihe um). */}
              <div data-studio="hauptreihe-tricaster" className="flex flex-wrap gap-2 [&_button>span[id]]:w-0 [&_button>span[id]]:min-w-full">
                {tricasterReihe(stand, current.id, (s) => void exec(s)).map((p) => (
                  <div key={p.label} className="min-w-[120px]">
                    <TallyButton {...p} />
                  </div>
                ))}
              </div>
              {/* Kein Sperrgrund: REC und STREAM schalten um, ohne dass der TriCaster antwortet (B6). Im Fluss unter der Reihe, im
                  Rasterabstand (mt-1.5 plus eine Zeile text-xs passt in gap-6). */}
              <p data-studio="tricaster-hinweis" className="mt-1.5 text-xs text-[var(--muted-foreground)]">
                {STUDIO_TEXTE.taste.tricasterHinweis}
              </p>
            </div>
            <PgmPreview ndiSource={`${current.name} (PGM)`} />
          </div>

          <div className="flex flex-col gap-6 mb-6">
            <DskPanel onExec={exec} disabled={!canExec || !live} />
            <DdrPanel onExec={exec} disabled={!canExec || !live} />
          </div>

          <MacroBrowser onExec={exec} disabled={!canExec || !live} />

          {canManage && (
            <div className="mt-6 pt-4 border-t border-[var(--border)]/40 flex gap-2">
              {adding ? (
                <TricasterForm onSubmit={saveTricaster} onCancel={() => setAdding(false)} />
              ) : (
                <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                  Weitere Instanz
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {role && canDo(role, 'audit:read') && (
        <div className="mt-8">
          <AuditLogPanel />
        </div>
      )}
    </Card>
  );
}

function TricasterForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: TricasterConfig;
  onSubmit: (cfg: TricasterConfig) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? 'TriCaster TC2');
  const [host, setHost] = useState(initial?.host ?? '');
  const [port, setPort] = useState(String(initial?.port ?? DEFAULT_TRICASTER_PORT));
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
            id: initial?.id ?? `tc-${Date.now().toString(36)}`,
            name,
            host,
            port: portNum,
          });
        } finally {
          setBusy(false);
        }
      }}
      className="flex items-end gap-2 flex-wrap"
    >
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Name
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Host / IP
        <Input
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="192.168.10.10"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Port
        <Input
          type="number"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          className="w-24"
          required
        />
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

function MacroBrowser({
  onExec,
  disabled,
}: {
  onExec: (shortcut: string) => void;
  disabled: boolean;
}) {
  // DSK and DDR have their own dedicated panels above — hide them here to avoid duplication.
  const HIDDEN_CATEGORIES: ReadonlySet<MacroCategory> = new Set(['DSK', 'DDR']);
  const grouped = useMemo(() => {
    const map = new Map<MacroCategory, MacroEntry[]>();
    for (const m of MACRO_CATALOG) {
      if (HIDDEN_CATEGORIES.has(m.category)) continue;
      const arr = map.get(m.category) ?? [];
      arr.push(m);
      map.set(m.category, arr);
    }
    return [...map.entries()];
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader>Macros</SectionHeader>
      {grouped.map(([category, entries]) => (
        <div key={category}>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] mb-2">
            {category}
          </div>
          <div className="flex flex-wrap gap-2">
            {entries.map((m) => (
              <Button
                key={m.id}
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => onExec(m.shortcut)}
                className={cn('uppercase font-bold')}
              >
                {m.label}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

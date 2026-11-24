// Licht · Art-Net (UX Welle 2b, Studio-Control d2; B16, B6, Ruling Task 18): Pille über StatusPill aus @jm/ui mit lichtPille
// (dieselbe Ableitung wie der Statuseintrag: „an (ohne Rückmeldung)“ statt „Output → Host“), Blackout als TallyButton aus
// lichtTaste im Behälter min-w-[110px] (heute size sm): ohne Recht gesperrt mit dem Rollen-Grund statt ausgeblendet, ohne Node
// wie heute nicht da, nie live (der Node meldet nichts zurück). Der Licht-Zustand gilt nur bei verbundenem Server (gemeldet).
import { useState } from 'react';
import { Card, Button, StatusPill, TallyButton, cn, type TallyButtonProps } from '@jm/ui';
import { Input } from '@/components/ui/Input';
import { Headline } from '@/components/ui/Headline';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { gemeldet, lichtPille, lichtTaste, type OberflaechenStand } from '@/lib/oberflaeche';
import { useApp } from '@/store/app';
import { useSession } from '@/store/session';
import { emitWithAck, apiFetch } from '@/sync/client';
import { EVENTS } from '@shared/protocol';
import {
  DEFAULT_FIXTURE_STATE,
  FIXTURE_PROFILES,
  findProfile,
  type ArtnetNode,
  type Fixture,
  type FixtureState,
} from '@shared/lighting';
import { canDo } from '@shared/roles';

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
}
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { r: 255, g: 255, b: 255 };
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Blackout aus lichtTaste (Zustand, Grund, Beschriftung „Blackout“ bzw. „Blackout aus“); ein Klick schaltet um wie bisher
 * (on: !blackout des gemeldeten Zustands). Ohne Node keine Taste. Rein, ohne DOM prüfbar.
 */
export function blackoutTaste(stand: OberflaechenStand, emit: (on: boolean) => void): TallyButtonProps | undefined {
  const t = lichtTaste(stand);
  if (t === undefined) return undefined;
  const an = gemeldet(stand, stand.licht)?.blackout === true;
  return { ...t, onClick: () => emit(!an) };
}

export function LichtPanel({ stand }: { stand: OberflaechenStand }) {
  const lighting = useApp((s) => s.lighting);
  const blackout = useApp((s) => s.blackout);
  const patchFixtureLocal = useApp((s) => s.patchFixtureLocal);
  const role = useSession((s) => s.user?.role);
  const token = useSession((s) => s.token);
  const [editingNode, setEditingNode] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const canExec = role ? canDo(role, 'lighting:exec') : false;
  const canManage = role ? canDo(role, 'inventory:write') : false;
  const node = lighting.node;

  function send(fixtureId: string, patch: Partial<FixtureState>): void {
    patchFixtureLocal(fixtureId, patch);
    void emitWithAck(EVENTS.LIGHTING_SET, { fixtureId, patch }).catch(() => {});
  }

  function setzeBlackout(on: boolean): void {
    void emitWithAck(EVENTS.LIGHTING_BLACKOUT, { on }).catch(() => {});
  }
  const taste = blackoutTaste(stand, setzeBlackout);
  // Bedienbar nur mit gemeldetem Node (bei verbundenem Server); die Anzeige der Konfiguration bleibt.
  const nodeGemeldet = gemeldet(stand, stand.licht)?.node === true;

  async function saveNode(next: ArtnetNode | null): Promise<void> {
    await apiFetch('/api/lighting/node', { method: 'POST', token, body: JSON.stringify({ node: next }) });
    setEditingNode(false);
  }

  async function saveFixture(fx: Fixture): Promise<void> {
    await apiFetch('/api/lighting/fixture', { method: 'POST', token, body: JSON.stringify(fx) });
    setAdding(false);
    setEditId(null);
  }

  async function removeFixture(id: string): Promise<void> {
    if (!confirm('Scheinwerfer wirklich entfernen?')) return;
    await apiFetch(`/api/lighting/fixture/${encodeURIComponent(id)}`, { method: 'DELETE', token });
    setEditId(null);
  }

  return (
    <Card data-panel="licht" className="p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <SectionHeader>Licht · Art-Net</SectionHeader>
          <Headline variant="section" className="mt-2">
            Beleuchtung
          </Headline>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill {...lichtPille(stand)} />
          {taste && (
            <div data-studio="hauptreihe-licht" className="flex">
              <div className="min-w-[110px]">
                <TallyButton {...taste} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Art-Net node */}
      <div className="mb-6 rounded-[var(--radius)] border border-[var(--border)]/60 bg-[var(--card)]/40 p-4">
        {editingNode && canManage ? (
          <NodeForm initial={node} onSubmit={saveNode} onCancel={() => setEditingNode(false)} />
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm">
              <span className="text-[var(--muted-foreground)]">Art-Net Node (Eurolite Node IV):</span>{' '}
              {node ? (
                <code className="tabular-nums">
                  {node.host} · {node.fps ?? 40} fps
                </code>
              ) : (
                <span className="text-[var(--muted-foreground)]">— nicht konfiguriert</span>
              )}
            </div>
            {canManage && (
              <Button size="sm" variant="ghost" onClick={() => setEditingNode(true)}>
                {node ? 'Ändern' : 'Node einrichten'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Fixtures */}
      {lighting.fixtures.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          Noch keine Scheinwerfer gepatcht. Aputure-Leuchten (Nova P300C, LS 300X, LS 60X) mit Profil,
          Universe und DMX-Startadresse hinzufügen.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {lighting.fixtures.map((fx) =>
            editId === fx.id && canManage ? (
              <div key={fx.id} className="rounded-[var(--radius)] border border-[var(--border)]/60 bg-[var(--card)]/40 p-4">
                <FixtureForm
                  initial={fx}
                  onSubmit={saveFixture}
                  onCancel={() => setEditId(null)}
                  onDelete={() => removeFixture(fx.id)}
                />
              </div>
            ) : (
              <FixtureCard
                key={fx.id}
                fx={fx}
                blackout={blackout}
                disabled={!canExec || !nodeGemeldet}
                onChange={(patch) => send(fx.id, patch)}
                canManage={canManage}
                onEdit={() => setEditId(fx.id)}
              />
            ),
          )}
        </div>
      )}

      {canManage && (
        <div className="mt-6 pt-4 border-t border-[var(--border)]/40">
          {adding ? (
            <div className="rounded-[var(--radius)] border border-[var(--border)]/60 bg-[var(--card)]/40 p-4 max-w-xl">
              <FixtureForm onSubmit={saveFixture} onCancel={() => setAdding(false)} />
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              Scheinwerfer hinzufügen
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function FixtureCard({
  fx,
  blackout,
  disabled,
  onChange,
  canManage,
  onEdit,
}: {
  fx: Fixture;
  blackout: boolean;
  disabled: boolean;
  onChange: (patch: Partial<FixtureState>) => void;
  canManage: boolean;
  onEdit: () => void;
}) {
  const profile = findProfile(fx.profileId);
  const s = fx.state;
  const off = disabled || blackout;
  const cctRange = profile?.cctRange ?? [2700, 6500];

  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border border-[var(--border)]/50 bg-[var(--card)]/40 p-4 flex flex-col gap-3',
        blackout && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-extrabold text-sm">{fx.name}</div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            {profile?.name ?? fx.profileId} · U{fx.universe} · DMX {fx.address}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ on: !s.on })}
            className={cn(
              'h-7 px-2 rounded-[var(--radius-sm)] text-[10px] uppercase tracking-wider font-extrabold transition-colors',
              s.on
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'bg-[var(--input)] text-[var(--muted-foreground)]',
              'disabled:opacity-40',
            )}
          >
            {s.on ? 'An' : 'Aus'}
          </button>
          {canManage && (
            <button
              type="button"
              onClick={onEdit}
              className="h-7 px-2 rounded-[var(--radius-sm)] text-[10px] uppercase tracking-wider font-extrabold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              ⋯
            </button>
          )}
        </div>
      </div>

      {profile?.controls.includes('intensity') && (
        <Fader
          label="Intensität"
          value={s.intensity}
          min={0}
          max={100}
          disabled={off}
          suffix="%"
          onInput={(v) => onChange({ intensity: v })}
        />
      )}

      {profile?.controls.includes('cct') && (
        <Fader
          label="Farbtemperatur"
          value={s.cct}
          min={cctRange[0]}
          max={cctRange[1]}
          step={50}
          disabled={off}
          suffix="K"
          onInput={(v) => onChange({ cct: v })}
        />
      )}

      {profile?.controls.includes('rgb') && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)] w-20">
            Farbe
          </span>
          <input
            type="color"
            disabled={off}
            value={rgbToHex(s.r, s.g, s.b)}
            onChange={(e) => onChange(hexToRgb(e.target.value))}
            className="h-8 w-14 rounded-[var(--radius-sm)] bg-transparent border border-[var(--border)] disabled:opacity-40"
          />
          <code className="text-[11px] tabular-nums text-[var(--muted-foreground)]">
            {rgbToHex(s.r, s.g, s.b).toUpperCase()}
          </code>
        </div>
      )}
    </div>
  );
}

function Fader({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  disabled,
  onInput,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  onInput: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--foreground)]">
          {Math.round(value)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onInput(Number(e.target.value))}
        className="w-full accent-[var(--primary)] disabled:opacity-40"
      />
    </label>
  );
}

function NodeForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: ArtnetNode | null;
  onSubmit: (node: ArtnetNode | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [host, setHost] = useState(initial?.host ?? '');
  const [fps, setFps] = useState(String(initial?.fps ?? 40));
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fpsNum = Number(fps);
        if (!host || !Number.isInteger(fpsNum) || fpsNum < 1 || fpsNum > 60) return;
        setBusy(true);
        try {
          await onSubmit({ host, fps: fpsNum });
        } finally {
          setBusy(false);
        }
      }}
      className="flex items-end gap-2 flex-wrap"
    >
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Node Host / IP
        <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.40.10" required />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        Output-Rate (fps)
        <Input type="number" value={fps} onChange={(e) => setFps(e.target.value)} className="w-24" />
      </label>
      <Button type="submit" disabled={busy}>
        Speichern
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel}>
        Abbrechen
      </Button>
      {initial && (
        <Button type="button" variant="destructive" onClick={() => void onSubmit(null)}>
          Trennen
        </Button>
      )}
    </form>
  );
}

function FixtureForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Fixture;
  onSubmit: (fx: Fixture) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [profileId, setProfileId] = useState(initial?.profileId ?? FIXTURE_PROFILES[0]!.id);
  const [universe, setUniverse] = useState(String(initial?.universe ?? 0));
  const [address, setAddress] = useState(String(initial?.address ?? 1));
  const [busy, setBusy] = useState(false);

  const profile = findProfile(profileId);
  const addrNum = Number(address);
  const uniNum = Number(universe);
  const addrInvalid =
    !Number.isInteger(addrNum) || addrNum < 1 || (profile ? addrNum - 1 + profile.footprint > 512 : false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name || !profile || addrInvalid || !Number.isInteger(uniNum) || uniNum < 0) return;
        setBusy(true);
        try {
          await onSubmit({
            id: initial?.id ?? `fx-${Date.now().toString(36)}`,
            name,
            profileId,
            universe: uniNum,
            address: addrNum,
            state: initial?.state ?? DEFAULT_FIXTURE_STATE,
          });
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex items-end gap-2 flex-wrap">
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] flex-1 min-w-[140px]">
          Name
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key Light" required />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
          Profil
          <select
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            className="h-10 px-3 rounded-[var(--radius)] bg-[var(--input)] border border-[var(--border)] text-sm"
          >
            {FIXTURE_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.footprint} Ch)
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-end gap-2 flex-wrap">
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
          Universe
          <Input type="number" value={universe} onChange={(e) => setUniverse(e.target.value)} className="w-24" />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
          DMX-Startadresse
          <Input
            type="number"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={cn('w-32', addrInvalid && 'border-[var(--destructive)]')}
          />
        </label>
        <span className="text-[10px] text-[var(--muted-foreground)] pb-2.5">
          belegt {profile?.footprint ?? 0} Kanäle
        </span>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || addrInvalid}>
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
      </div>
    </form>
  );
}

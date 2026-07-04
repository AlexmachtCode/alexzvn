import { useEffect, useState } from 'react';
import { Button, Card, cn } from '@jm/ui';
import type { ControlPlaneStatus, HealthEntry, PresenceRecord } from '@shared/types';
import { useTools } from '@/store/tools';
import { pairingUrl, toDataUrl } from '@/lib/qr';

// Spiegelt STALE_MS aus dem Presence-Hub: ohne Lebenszeichen gilt ein Tool
// nach dieser Zeit lokal als gestoppt (snappige Anzeige bis zum Hub-Event).
const STALE_MS = 25_000;

type BadgeTone = 'rec' | 'air' | 'stream' | 'warn' | 'active' | 'info';

/** Live-„Health"-Badges generisch aus dem STATE eines Steuer-Endpunkts ableiten. */
function badgesFor(kv: Record<string, string>): { label: string; tone: BadgeTone }[] {
  const out: { label: string; tone: BadgeTone }[] = [];
  const truthy = (v: string | undefined): boolean => v === '1' || v === 'true';
  const anyKey = (pred: (k: string) => boolean): boolean =>
    Object.entries(kv).some(([k, v]) => pred(k) && truthy(v));
  if (anyKey((k) => k === 'recording' || k === 'rec' || k.endsWith('_rec'))) out.push({ label: 'REC', tone: 'rec' });
  if (anyKey((k) => k === 'on_air' || k === 'live')) out.push({ label: 'ON AIR', tone: 'air' });
  if (anyKey((k) => k === 'streaming' || k === 'stream' || k.endsWith('_stream'))) out.push({ label: 'STREAM', tone: 'stream' });
  if (truthy(kv.overrun)) out.push({ label: 'ÜBERZOGEN', tone: 'warn' });
  if (anyKey((k) => k === 'running' || k === 'playing' || k === 'scrolling')) out.push({ label: 'AKTIV', tone: 'active' });
  if (anyKey((k) => k === 'ndi')) out.push({ label: 'NDI', tone: 'info' });
  if (truthy(kv.voting)) out.push({ label: 'VOTING', tone: 'info' });
  return out;
}

const TONE_CLS: Record<BadgeTone, string> = {
  rec: 'border-[var(--destructive)]/40 bg-[var(--destructive)]/15 text-[var(--destructive)]',
  air: 'border-[var(--destructive)]/40 bg-[var(--destructive)]/15 text-[var(--destructive)]',
  stream: 'border-[var(--warning,#caa)]/40 bg-[var(--highlight)] text-[var(--foreground)]',
  warn: 'border-[var(--destructive)]/40 bg-[var(--destructive)]/15 text-[var(--destructive)]',
  active: 'border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)]',
  info: 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]',
};

function Badges({ kv }: { kv: Record<string, string> }) {
  const badges = badgesFor(kv);
  if (badges.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {badges.map((b) => (
        <span
          key={b.label}
          className={cn(
            'rounded-[var(--radius-full)] border px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide',
            TONE_CLS[b.tone],
          )}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

export function SystemStatusModal() {
  const open = useTools((s) => s.systemOpen);
  const presence = useTools((s) => s.presence);
  const health = useTools((s) => s.health);
  const states = useTools((s) => s.states);
  const close = useTools((s) => s.closeSystem);
  const reload = useTools((s) => s.loadPresence);
  const reloadHealth = useTools((s) => s.loadHealth);

  // Sekündlich neu rendern, damit „vor X s" tickt und Stale-Tools umklappen.
  const [, force] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [open]);

  // „Aktualisieren" stößt auch einen Neu-Abruf des Steuerebenen-Status in der
  // Netzwerk-Karte an (presence/health kommen live aus dem Store).
  const [refreshNonce, setRefreshNonce] = useState(0);

  if (!open) return null;

  const now = Date.now();
  const isLive = (r: PresenceRecord) => r.running && now - r.lastSeen < STALE_MS;
  const runningCount = presence.filter(isLive).length;

  // Live-Steuerzustand je Tool (bevorzugt der verbundene Endpunkt) + Endpunkte,
  // die NUR im Netz entdeckt wurden (Tool läuft auf einem anderen Rechner).
  const healthById = new Map<string, HealthEntry>();
  for (const h of health) {
    const ex = healthById.get(h.appId);
    if (!ex || (h.connected && !ex.connected)) healthById.set(h.appId, h);
  }
  const presenceIds = new Set(presence.map((r) => r.appId));
  const discoveredOnly = [...healthById.values()].filter((h) => !presenceIds.has(h.appId));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm px-6">
      <Card className="w-full max-w-lg p-6 jm-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">System-Zustand</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              {presence.length === 0
                ? 'Noch keine Tool-Rückmeldungen.'
                : `${runningCount} von ${presence.length} Tools laufen gerade.`}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-[var(--radius-full)] border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em]',
              runningCount > 0
                ? 'border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)]'
                : 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]',
            )}
          >
            {runningCount > 0 ? 'Live' : 'Idle'}
          </span>
        </div>

        <NetworkPlaneCard presence={presence} health={health} now={now} nonce={refreshNonce} />

        {presence.length === 0 ? (
          <p className="mt-5 text-sm rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-3 text-[var(--muted-foreground)]">
            Sobald ein Tool aus der Suite gestartet wird, meldet es sich hier mit
            Status, Version und letzter Aktivität. Bereits laufende Tools melden
            sich beim nächsten Heartbeat.
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2 max-h-[60vh] overflow-auto">
            {presence.map((r) => (
              <Row
                key={r.appId}
                rec={r}
                live={isLive(r)}
                now={now}
                updateAvailable={states[r.appId]?.status === 'update-available'}
                health={healthById.get(r.appId)}
              />
            ))}
          </ul>
        )}

        {discoveredOnly.length > 0 && (
          <>
            <div className="mt-5 text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
              Im Netzwerk entdeckt
            </div>
            <ul className="mt-2 flex flex-col gap-2 max-h-[28vh] overflow-auto">
              {discoveredOnly.map((h) => (
                <DiscoveredRow key={`${h.host}:${h.port}`} health={h} />
              ))}
            </ul>
          </>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              void reload();
              void reloadHealth();
              setRefreshNonce((n) => n + 1);
            }}
          >
            Aktualisieren
          </Button>
          <Button variant="primary" onClick={close}>
            Schließen
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Netzwerk-Ampel + 1-Klick-Steuerebene (Onboarding-Slice A1).
//
// Leitet aus den bereits vorhandenen Daten (presence = lokal laufende Tools,
// health = im LAN entdeckte Steuer-Endpunkte) eine Erreichbarkeits-Diagnose ab
// und bietet die vorhandene 1-Klick-Provisionierung der sicheren Steuerebene
// (control-provision.ts über window.jmps.*) direkt an — statt sie in den
// Einstellungen zu verstecken. Kein neues Protokoll; nur Führung + Sichtbarkeit.
//
// Bewusst konservativ, um Fehlalarme zu vermeiden: „nicht gefunden" nur, wenn ein
// laufendes Tool nachweislich einen Server (servicePort) exponiert, aber im Netz
// nichts entdeckt wurde. Die getrennt-Warnung ist auf den secure-Modus begrenzt
// (klassischer p1-secure-client-gap: Tool läuft noch mit altem/plain Zustand).
// Die Provision/Disable-Logik spiegelt SettingsModal.ControlPlaneSection — die
// Zusammenführung zu einer geteilten „Netzwerk"-Sektion ist Säule D der Roadmap.

type PlaneTone = 'ok' | 'warn' | 'idle';

function NetworkPlaneCard({
  presence,
  health,
  now,
  nonce,
}: {
  presence: PresenceRecord[];
  health: HealthEntry[];
  now: number;
  nonce: number;
}) {
  const [status, setStatus] = useState<ControlPlaneStatus | null>(null);
  const [revealed, setRevealed] = useState<ControlPlaneStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    window.jmps.getControlStatus().then(setStatus).catch(() => {});
  }, [nonce]);

  // QR fürs Pairing erzeugen, sobald ein frisches Token vorliegt (nur nach
  // Aktivieren/Erneuern — das Token ist nur dann im Klartext verfügbar).
  useEffect(() => {
    if (!revealed?.token) {
      setQr(null);
      return;
    }
    let alive = true;
    toDataUrl(pairingUrl(revealed.token, revealed.tlsFingerprint))
      .then((d) => alive && setQr(d))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [revealed]);

  const provision = async () => {
    setBusy(true);
    try {
      const s = await window.jmps.provisionControl();
      setStatus(s);
      setRevealed(s);
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    setBusy(true);
    try {
      setStatus(await window.jmps.disableControl());
      setRevealed(null);
    } finally {
      setBusy(false);
    }
  };

  const secure = status?.mode === 'secure';
  const liveLocal = presence.filter((r) => r.running && now - r.lastSeen < STALE_MS);
  const liveWithServer = liveLocal.filter((r) => r.servicePort);
  const discovered = health.length;
  const connected = health.filter((h) => h.connected).length;
  const disconnected = discovered - connected;

  let tone: PlaneTone;
  let text: string;
  if (liveLocal.length === 0) {
    tone = 'idle';
    text = 'Bereit — sobald Tools laufen, prüfen wir hier, ob sie sich im Netz finden.';
  } else if (liveWithServer.length > 0 && discovered === 0) {
    tone = 'warn';
    text =
      'Laufende Tools werden im Netz nicht gefunden — läuft mDNS/Bonjour? Firewall prüfen, ' +
      'oder die Adresse (host:port) im jeweiligen Tool manuell eintragen.';
  } else if (secure && disconnected > 0) {
    tone = 'warn';
    text =
      `${disconnected} entdeckte(r) Endpunkt(e) getrennt — Tool(s) neu starten, damit sie die ` +
      'sichere Steuerebene (Token/TLS) übernehmen.';
  } else if (connected > 0) {
    tone = 'ok';
    text = `Tools finden sich im Netz — ${connected} von ${discovered} Steuer-Endpunkt(en) verbunden.`;
  } else {
    tone = 'ok';
    text = 'Bereit — für die laufenden Tools ist keine Netz-Kopplung nötig.';
  }

  const toneCls: Record<PlaneTone, string> = {
    ok: 'border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)]',
    warn: 'border-[var(--destructive)]/40 bg-[var(--destructive)]/15 text-[var(--destructive)]',
    idle: 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]',
  };
  const toneLabel: Record<PlaneTone, string> = { ok: 'Verbunden', warn: 'Prüfen', idle: 'Bereit' };
  const dotCls: Record<PlaneTone, string> = {
    ok: 'bg-[var(--success)]',
    warn: 'bg-[var(--destructive)]',
    idle: 'bg-[var(--muted-foreground)]/40',
  };

  return (
    <section className="mt-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', dotCls[tone])} />
          <p className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
            Netzwerk &amp; Steuerebene
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-[var(--radius-full)] border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em]',
            toneCls[tone],
          )}
        >
          {toneLabel[tone]}
        </span>
      </div>

      <p className="mt-2 text-xs text-[var(--muted-foreground)]" aria-live="polite">
        {text}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--border)] pt-3">
        <span className="text-xs text-[var(--muted-foreground)]">
          Steuerebene:{' '}
          <span className={cn('font-semibold', secure ? 'text-[var(--success)]' : 'text-[var(--foreground)]')}>
            {secure ? 'Sicher (Token + TLS)' : 'Offen'}
          </span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="primary" onClick={provision} disabled={busy}>
            {secure ? 'Erneuern' : 'Sichere Steuerebene aktivieren'}
          </Button>
          {secure && (
            <Button variant="ghost" onClick={disable} disabled={busy}>
              Deaktivieren
            </Button>
          )}
        </div>
      </div>

      {!secure && (
        <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
          Empfohlen in geteilten/mehrere-Standorte-Netzen: erzeugt ein Suite-Token + TLS, das alle
          Tools beim nächsten Start übernehmen. Companion/zweite Rechner koppelst du per Token &amp;
          Fingerprint.
        </p>
      )}

      {revealed?.token && (
        <div className="mt-3 flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] p-3 sm:flex-row sm:items-start">
          {qr && (
            <div className="shrink-0 self-center rounded-[var(--radius)] bg-white p-2 sm:self-start">
              <img
                src={qr}
                alt="QR-Code zum Koppeln (Token + Fingerprint)"
                width={120}
                height={120}
                className="block size-[120px]"
              />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-[10px] text-[var(--muted-foreground)]">
              Einmalig sichtbar — per QR auf zweiten Rechner/Companion koppeln oder Werte übernehmen:
            </p>
            <PlaneMono label="Token" value={revealed.token} />
            {revealed.tlsFingerprint && <PlaneMono label="TLS-Fingerprint" value={revealed.tlsFingerprint} />}
          </div>
        </div>
      )}
      {secure && !revealed && status?.tlsFingerprint && (
        <div className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] p-3">
          <PlaneMono label="TLS-Fingerprint" value={status.tlsFingerprint} />
          <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">
            Das Token wird aus Sicherheitsgründen nur beim Erzeugen/Erneuern angezeigt.
          </p>
        </div>
      )}
    </section>
  );
}

/** Kompakte, kopierbare Mono-Zeile (Token/Fingerprint). */
function PlaneMono({ label, value }: { label: string; value: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
        {label}
      </span>
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(
          'h-9 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)]',
          'px-3 text-xs font-mono text-[var(--foreground)] select-all',
        )}
      />
    </label>
  );
}

function Row({
  rec,
  live,
  now,
  updateAvailable,
  health,
}: {
  rec: PresenceRecord;
  live: boolean;
  now: number;
  updateAvailable: boolean;
  health?: HealthEntry;
}) {
  return (
    <li className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
      <span
        aria-hidden
        className={cn(
          'mt-1 size-2.5 shrink-0 rounded-full',
          live
            ? 'bg-[var(--success)] animate-pulse'
            : 'bg-[var(--muted-foreground)]/40',
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate">{rec.name}</span>
          <span className="text-[10px] tabular-nums text-[var(--muted-foreground)]">
            v{rec.version}
          </span>
          {updateAvailable && (
            <span className="rounded-[var(--radius-full)] border border-[var(--primary)]/40 bg-[var(--highlight)] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-[var(--primary)]">
              Update
            </span>
          )}
          {rec.servicePort && (
            <span className="text-[10px] tabular-nums text-[var(--muted-foreground)]">
              :{rec.servicePort}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          {live ? 'läuft' : 'gestoppt'} · {relTime(now - rec.lastSeen)}
        </div>
        {rec.lastCrash && (
          <div className="mt-1 text-[11px] text-[var(--destructive)]">
            ⚠ letzter Absturz ({rec.lastCrash.kind}) · {shortDate(rec.lastCrash.at)}
          </div>
        )}
        {health?.connected && <Badges kv={health.kv} />}
      </div>
    </li>
  );
}

/** Steuer-Endpunkt, der nur im Netz entdeckt wurde (Tool auf anderem Rechner). */
function DiscoveredRow({ health }: { health: HealthEntry }) {
  return (
    <li className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
      <span
        aria-hidden
        className={cn(
          'mt-1 size-2.5 shrink-0 rounded-full',
          health.connected ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--muted-foreground)]/40',
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate">{health.appId.replace(/^jm-/, 'JM ')}</span>
          <span className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">{health.role}</span>
        </div>
        <div className="mt-0.5 text-xs text-[var(--muted-foreground)] tabular-nums">
          {health.host}:{health.port} · {health.connected ? 'verbunden' : 'getrennt'}
        </div>
        {health.connected && <Badges kv={health.kv} />}
      </div>
    </li>
  );
}

/** Menschliche Relativzeit für „zuletzt gesehen": vor X s / min / h. */
function relTime(deltaMs: number): string {
  const s = Math.max(0, Math.round(deltaMs / 1000));
  if (s < 60) return `vor ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} min`;
  const h = Math.round(m / 60);
  return `vor ${h} h`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

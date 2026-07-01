import { useEffect, useState } from 'react';
import { Button, Card, cn } from '@jm/ui';
import type { ControlPlaneStatus } from '@shared/types';
import { useTools } from '@/store/tools';

export function SettingsModal() {
  const open = useTools((s) => s.settingsOpen);
  const settings = useTools((s) => s.settings);
  const close = useTools((s) => s.closeSettings);
  const save = useTools((s) => s.saveSettings);

  const [token, setToken] = useState('');
  const [proxy, setProxy] = useState(settings?.proxyUrl ?? '');
  const [manifestUrl, setManifestUrl] = useState(settings?.manifestUrl ?? '');
  const [iveoBaseUrl, setIveoBaseUrl] = useState(settings?.iveoBaseUrl ?? '');

  if (!open) return null;

  const fromEnv = settings?.fromEnv ?? false;
  const manifestFromEnv = settings?.manifestFromEnv ?? false;
  const iveoBaseUrlFromEnv = settings?.iveoBaseUrlFromEnv ?? false;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6">
      <Card className="w-full max-w-lg p-6 jm-fade-in">
        <div className="-mr-2 max-h-[68vh] overflow-y-auto pr-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Einstellungen</h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Quelle für Download &amp; Auto-Update der Tools.
            </p>
          </div>
          <SourceBadge source={settings?.source ?? 'none'} />
        </div>

        {fromEnv && (
          <p className="mt-4 text-xs rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[var(--muted-foreground)]">
            Quelle wird per Umgebungsvariable gesetzt und kann hier nicht überschrieben werden.
          </p>
        )}

        <div className={cn('mt-5 flex flex-col gap-4', fromEnv && 'opacity-50 pointer-events-none')}>
          <Field
            label="GitHub-Token (fine-grained PAT, read-only contents)"
            placeholder={settings?.hasToken ? '•••••••••• (gesetzt)' : 'ghp_… / github_pat_…'}
            type="password"
            value={token}
            onChange={setToken}
          />
          <Field
            label="Interner Proxy (optional, hat Vorrang vor Token)"
            placeholder="https://releases.intern.jakobsmedien.de"
            value={proxy}
            onChange={setProxy}
          />
        </div>

        <div className="mt-5 border-t border-[var(--border)] pt-5">
          <p className="text-xs text-[var(--muted-foreground)] mb-3">
            Remote-Katalog (suite.json): zentrale Liste der Tools/Texte. Leer = gebündelter
            Katalog. Änderung wirkt beim nächsten Start.
          </p>
          {manifestFromEnv && (
            <p className="mb-3 text-xs rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[var(--muted-foreground)]">
              Katalog-URL wird per Umgebungsvariable gesetzt und kann hier nicht überschrieben
              werden.
            </p>
          )}
          <div className={cn(manifestFromEnv && 'opacity-50 pointer-events-none')}>
            <Field
              label="Katalog-URL (optional)"
              placeholder="https://suite.intern.jakobsmedien.de/suite.json"
              value={manifestUrl}
              onChange={setManifestUrl}
            />
          </div>
        </div>

        <div className="mt-5 border-t border-[var(--border)] pt-5">
          <p className="text-xs text-[var(--muted-foreground)] mb-3">
            iveo-Eventplattform (#11): Basis-URL der API. Leer = Standard (Staging). Das
            Token ist pro Event und wird beim Anlegen einer Show eingetragen — es liegt
            verschlüsselt hier und nie in der Show-Datei.
          </p>
          {iveoBaseUrlFromEnv && (
            <p className="mb-3 text-xs rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[var(--muted-foreground)]">
              iveo-Basis-URL wird per Umgebungsvariable gesetzt und kann hier nicht
              überschrieben werden.
            </p>
          )}
          <div className={cn(iveoBaseUrlFromEnv && 'opacity-50 pointer-events-none')}>
            <Field
              label="iveo Basis-URL (optional)"
              placeholder="https://staging-dev.my-iveo.de/api/v1"
              value={iveoBaseUrl}
              onChange={setIveoBaseUrl}
            />
          </div>
        </div>

        <ControlPlaneSection />
        </div>

        <div className="mt-4 flex shrink-0 items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
          <Button variant="ghost" onClick={close}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              save({
                ...(fromEnv ? {} : { githubToken: token, proxyUrl: proxy }),
                ...(manifestFromEnv ? {} : { manifestUrl }),
                ...(iveoBaseUrlFromEnv ? {} : { iveoBaseUrl }),
              })
            }
          >
            Speichern
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ControlPlaneSection() {
  const [status, setStatus] = useState<ControlPlaneStatus | null>(null);
  const [revealed, setRevealed] = useState<ControlPlaneStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.jmps.getControlStatus().then(setStatus).catch(() => {});
  }, []);

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
  return (
    <div className="mt-5 border-t border-[var(--border)] pt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
          Sichere Steuerebene
        </p>
        <span
          className={cn(
            'shrink-0 rounded-[var(--radius-full)] border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em]',
            secure
              ? 'border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)]'
              : 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]',
          )}
        >
          {secure ? 'Sicher' : 'Offen'}
        </span>
      </div>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        Token + Verschlüsselung (TLS) für die Tool-Steuerung. Wirkt beim nächsten Start jedes
        Tools. Token &amp; Fingerprint trägst du in Companion/Clients ein.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" onClick={provision} disabled={busy}>
          {secure ? 'Erneuern' : 'Aktivieren'}
        </Button>
        {secure && (
          <Button variant="ghost" onClick={disable} disabled={busy}>
            Deaktivieren
          </Button>
        )}
      </div>
      {revealed?.token && (
        <div className="mt-3 flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] p-3">
          <p className="text-[10px] text-[var(--muted-foreground)]">
            Einmalig sichtbar — jetzt in Companion/Clients übernehmen:
          </p>
          <ReadonlyRow label="Token" value={revealed.token} />
          {revealed.tlsFingerprint && <ReadonlyRow label="TLS-Fingerprint" value={revealed.tlsFingerprint} />}
        </div>
      )}
      {secure && !revealed && status?.tlsFingerprint && (
        <div className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] p-3">
          <ReadonlyRow label="TLS-Fingerprint" value={status.tlsFingerprint} />
          <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">
            Das Token wird aus Sicherheitsgründen nur beim Erzeugen/Erneuern angezeigt.
          </p>
        </div>
      )}
    </div>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
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

function SourceBadge({ source }: { source: 'github' | 'proxy' | 'none' }) {
  const label = source === 'github' ? 'GitHub' : source === 'proxy' ? 'Proxy' : 'Keine Quelle';
  return (
    <span
      className={cn(
        'shrink-0 rounded-[var(--radius-full)] border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em]',
        source === 'none'
          ? 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]'
          : 'border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)]',
      )}
    >
      {label}
    </span>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)]',
          'px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
        )}
      />
    </label>
  );
}

import { useEffect, useState } from 'react';
import { useQa } from '@/store/useQa';
import { toDataUrl } from '@/lib/qr';
import type { QaCloudInfo } from '@shared/types';

/**
 * Externe Einreichung (#166): An/Aus, QR für den Livestream-Stream-Link, Presse-
 * Link + Zugangscode, Kanal-Schalter und „Event beenden". Konfiguration (Proxy-
 * URL/Key, Event erzeugen, Presse-Code) liegt in den Einstellungen.
 */
export function CloudPanel({ cloud }: { cloud: QaCloudInfo }) {
  const { cloudEnable, cloudPurge, setCloudConfig } = useQa();
  const [qr, setQr] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (cloud.enabled && cloud.streamUrl) {
      void toDataUrl(cloud.streamUrl)
        .then((d) => !cancelled && setQr(d))
        .catch(() => setQr(''));
    } else {
      setQr('');
    }
    return () => {
      cancelled = true;
    };
  }, [cloud.enabled, cloud.streamUrl]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Extern (Stream & Presse)</h2>
        <button
          onClick={() => void cloudEnable(!cloud.enabled)}
          disabled={!cloud.configured && !cloud.enabled}
          className={`ml-auto rounded-md border px-2.5 py-1 text-xs font-semibold disabled:opacity-40 ${
            cloud.enabled
              ? 'border-[var(--success)] bg-[var(--success)]/20 text-[var(--success)]'
              : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)]'
          }`}
        >
          {cloud.enabled ? '◉ An' : '○ Aus'}
        </button>
      </div>

      {!cloud.configured && !cloud.enabled ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          In den Einstellungen Proxy-URL, Key und ein Event einrichten, um Fragen per Livestream/Presse
          anzunehmen.
        </p>
      ) : cloud.enabled ? (
        <div className="flex flex-col items-center gap-2">
          {qr ? (
            <img src={qr} alt="QR-Code für die Stream-Einreichung" className="rounded-lg bg-white p-1.5" width={180} height={180} />
          ) : (
            <div className="grid h-[180px] w-[180px] place-items-center rounded-lg bg-[var(--input)] text-xs text-[var(--muted-foreground)]">
              …
            </div>
          )}
          <p className="text-center text-[11px] text-[var(--muted-foreground)]">
            QR im Livestream einblenden — Zuschauer reichen verschlüsselt ein.
          </p>

          <div className="w-full space-y-1">
            <LinkRow label="Stream" url={cloud.streamUrl} />
            {cloud.pressCode ? <LinkRow label="Presse" url={cloud.pressUrl} /> : null}
            {cloud.pressCode ? (
              <div className="rounded bg-[var(--input)] px-2 py-1 text-center text-[11px] text-[var(--foreground)]">
                Presse-Code: <span className="font-semibold text-[var(--warning)]">{cloud.pressCode}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-1 flex w-full items-center justify-center gap-3 text-[11px]">
            <label className="flex items-center gap-1 text-[var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={cloud.streamOpen}
                onChange={(e) => void setCloudConfig({ streamOpen: e.target.checked })}
              />
              Stream offen
            </label>
            <label className="flex items-center gap-1 text-[var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={cloud.pressOpen}
                onChange={(e) => void setCloudConfig({ pressOpen: e.target.checked })}
              />
              Presse offen
            </label>
          </div>

          {cloud.lastError ? (
            <p className="text-center text-[11px] text-[var(--destructive)]">Fehler: {cloud.lastError}</p>
          ) : (
            <p className="text-center text-[11px] text-[var(--muted-foreground)]">
              {cloud.lastPollAt ? 'Verbunden — Einreichungen werden abgeholt.' : 'Verbinde …'}
            </p>
          )}

          <button
            onClick={() => {
              if (confirm('Event beenden und alle externen Einreichungen im Relay löschen?')) void cloudPurge();
            }}
            className="mt-1 rounded border border-[var(--destructive)]/50 px-2 py-1 text-[11px] text-[var(--destructive)] hover:bg-[var(--destructive)]/15"
          >
            Event beenden & Daten löschen
          </button>
        </div>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">
          Aus. Anschalten, damit Fragen per Livestream-QR und von der Presse eingehen.
        </p>
      )}
    </div>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-12 shrink-0 text-[10px] uppercase text-[var(--muted-foreground)]">{label}</span>
      <div className="min-w-0 flex-1 truncate rounded bg-[var(--input)] px-2 py-1 text-[11px] text-[var(--foreground)]" title={url}>
        {url}
      </div>
      <button
        onClick={() => void navigator.clipboard?.writeText(url)}
        className="shrink-0 rounded px-1.5 py-1 text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--highlight)]"
        title="Link kopieren"
      >
        ⧉
      </button>
    </div>
  );
}

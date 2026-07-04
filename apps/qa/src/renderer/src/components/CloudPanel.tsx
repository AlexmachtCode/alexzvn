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
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-neutral-300">Extern (Stream & Presse)</h2>
        <button
          onClick={() => void cloudEnable(!cloud.enabled)}
          disabled={!cloud.configured && !cloud.enabled}
          className={`ml-auto rounded-md border px-2.5 py-1 text-xs font-semibold disabled:opacity-40 ${
            cloud.enabled
              ? 'border-green-500 bg-green-600/20 text-green-300'
              : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
          }`}
        >
          {cloud.enabled ? '◉ An' : '○ Aus'}
        </button>
      </div>

      {!cloud.configured && !cloud.enabled ? (
        <p className="text-xs text-neutral-500">
          In den Einstellungen Proxy-URL, Key und ein Event einrichten, um Fragen per Livestream/Presse
          anzunehmen.
        </p>
      ) : cloud.enabled ? (
        <div className="flex flex-col items-center gap-2">
          {qr ? (
            <img src={qr} alt="QR-Code für die Stream-Einreichung" className="rounded-lg bg-white p-1.5" width={180} height={180} />
          ) : (
            <div className="grid h-[180px] w-[180px] place-items-center rounded-lg bg-neutral-800 text-xs text-neutral-500">
              …
            </div>
          )}
          <p className="text-center text-[11px] text-neutral-500">
            QR im Livestream einblenden — Zuschauer reichen verschlüsselt ein.
          </p>

          <div className="w-full space-y-1">
            <LinkRow label="Stream" url={cloud.streamUrl} />
            {cloud.pressCode ? <LinkRow label="Presse" url={cloud.pressUrl} /> : null}
            {cloud.pressCode ? (
              <div className="rounded bg-neutral-800/60 px-2 py-1 text-center text-[11px] text-neutral-300">
                Presse-Code: <span className="font-semibold text-amber-300">{cloud.pressCode}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-1 flex w-full items-center justify-center gap-3 text-[11px]">
            <label className="flex items-center gap-1 text-neutral-400">
              <input
                type="checkbox"
                checked={cloud.streamOpen}
                onChange={(e) => void setCloudConfig({ streamOpen: e.target.checked })}
              />
              Stream offen
            </label>
            <label className="flex items-center gap-1 text-neutral-400">
              <input
                type="checkbox"
                checked={cloud.pressOpen}
                onChange={(e) => void setCloudConfig({ pressOpen: e.target.checked })}
              />
              Presse offen
            </label>
          </div>

          {cloud.lastError ? (
            <p className="text-center text-[11px] text-red-400">Fehler: {cloud.lastError}</p>
          ) : (
            <p className="text-center text-[11px] text-neutral-600">
              {cloud.lastPollAt ? 'Verbunden — Einreichungen werden abgeholt.' : 'Verbinde …'}
            </p>
          )}

          <button
            onClick={() => {
              if (confirm('Event beenden und alle externen Einreichungen im Relay löschen?')) void cloudPurge();
            }}
            className="mt-1 rounded border border-red-900/60 px-2 py-1 text-[11px] text-red-400 hover:bg-red-950/30"
          >
            Event beenden & Daten löschen
          </button>
        </div>
      ) : (
        <p className="text-xs text-neutral-500">
          Aus. Anschalten, damit Fragen per Livestream-QR und von der Presse eingehen.
        </p>
      )}
    </div>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-12 shrink-0 text-[10px] uppercase text-neutral-500">{label}</span>
      <div className="min-w-0 flex-1 truncate rounded bg-neutral-800/60 px-2 py-1 text-[11px] text-neutral-300" title={url}>
        {url}
      </div>
      <button
        onClick={() => void navigator.clipboard?.writeText(url)}
        className="shrink-0 rounded px-1.5 py-1 text-[11px] text-neutral-400 hover:bg-neutral-800"
        title="Link kopieren"
      >
        ⧉
      </button>
    </div>
  );
}

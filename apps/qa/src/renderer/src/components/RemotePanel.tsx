import { useEffect, useState } from 'react';
import { useQa } from '@/store/useQa';
import { toDataUrl } from '@/lib/qr';
import type { QaRemoteInfo } from '@shared/types';

/** Saal-Einreichung per Handy: An/Aus-Schalter, QR-Code + LAN-URLs. */
export function RemotePanel({ remote }: { remote: QaRemoteInfo }) {
  const { setRemote } = useQa();
  const [qr, setQr] = useState('');
  const url = remote.urls[0] ?? '';

  useEffect(() => {
    let cancelled = false;
    if (url) {
      void toDataUrl(url)
        .then((d) => {
          if (!cancelled) setQr(d);
        })
        .catch(() => setQr(''));
    } else {
      setQr('');
    }
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Saal-Einreichung</h2>
        <button
          onClick={() => void setRemote(!remote.running)}
          className={`ml-auto rounded-md border px-2.5 py-1 text-xs font-semibold ${
            remote.running
              ? 'border-[var(--success)] bg-[var(--success)]/20 text-[var(--success)]'
              : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--highlight)]'
          }`}
        >
          {remote.running ? '◉ An' : '○ Aus'}
        </button>
      </div>

      {remote.running ? (
        <div className="flex flex-col items-center gap-2">
          {qr ? (
            <img src={qr} alt="QR-Code zur Saal-Einreichung" className="rounded-lg bg-white p-1.5" width={180} height={180} />
          ) : (
            <div className="grid h-[180px] w-[180px] place-items-center rounded-lg bg-[var(--input)] text-xs text-[var(--muted-foreground)]">
              kein Netzwerk
            </div>
          )}
          <p className="text-center text-[11px] text-[var(--muted-foreground)]">
            Gäste scannen den QR-Code und reichen ihre Frage/Wortmeldung ein.
          </p>
          <div className="w-full space-y-0.5">
            {remote.urls.map((u) => (
              <div key={u} className="truncate rounded bg-[var(--input)] px-2 py-1 text-center text-[11px] text-[var(--foreground)]">
                {u}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">
          Aus. Anschalten, damit der Saal Fragen per Handy (QR) einreichen kann.
        </p>
      )}
    </div>
  );
}

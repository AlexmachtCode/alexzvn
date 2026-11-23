import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { REMOTE_TEXTE } from '@jm/settings';
import { Field, Select, TextInput, Toggle, UNBEKANNT } from '@jm/ui';
import type { NetInterface, RemoteConfig, RemoteStatus } from '@shared/types';
import { PRESENTER_TEXTE } from '@/lib/oberflaeche';

/**
 * Handy-Fernsteuerung (Inhalt des Panel-Abschnitts „Handy-Fernsteuerung“, UX Welle 2b d1, früher RemotePanel.tsx:62-128): den
 * LAN-Server ein- und ausschalten, die Netzwerkkarte wählen, den Port setzen und die Kopplung (Adresse, QR, PIN) zeigen. Status,
 * Netzwerkkarten und das Anwenden kommen herein; kein Abo, kein window. Jedes Anwenden setzt mit `enabled` den gemessenen
 * Zustand `running` fort (wie bisher).
 */
export function HandyAbschnitt({
  status,
  netzwerkkarten,
  anwenden,
}: {
  status: RemoteStatus;
  netzwerkkarten: NetInterface[] | undefined;
  anwenden(config: RemoteConfig): Promise<unknown>;
}) {
  const T = PRESENTER_TEXTE.handy;
  const [busy, setBusy] = useState(false);
  // Entwurf der Einstellung, beim Einhängen aus dem gemeldeten Stand; angewendet bei jeder Änderung (Port beim Verlassen).
  const [bind, setBind] = useState(status.config.bind);
  const [port, setPort] = useState(status.config.port);
  const [pinEnabled, setPinEnabled] = useState(status.config.pinEnabled);

  const apply = async (patch: Partial<RemoteConfig>): Promise<void> => {
    setBusy(true);
    try {
      await anwenden({ enabled: status.running, bind, port, pinEnabled, ...patch });
    } finally {
      setBusy(false);
    }
  };

  const running = status.running;
  return (
    <div className="space-y-3">
      <Field label={running ? T.serverAn : T.serverAus} hint={running ? T.hinweisAn : T.hinweisAus}>
        <Toggle checked={running} disabled={busy} onChange={() => void apply({ enabled: !running })} />
      </Field>

      <Field label={T.netzwerkkarte}>
        {netzwerkkarten === undefined ? (
          <p className="text-sm text-[var(--muted-foreground)]">{UNBEKANNT}</p>
        ) : (
          <Select
            options={netzwerkkarten.map((i) => ({ value: i.address, label: i.label }))}
            value={bind}
            disabled={busy}
            onChange={(v) => {
              setBind(v);
              void apply({ bind: v });
            }}
          />
        )}
      </Field>

      <Field label={REMOTE_TEXTE.port}>
        <TextInput
          value={String(port)}
          inputMode="numeric"
          disabled={busy}
          onChange={(v) => setPort(Number(v.replace(/\D/g, '')) || 0)}
          onBlur={() => {
            if (port >= 1024 && port <= 65535) void apply({ port });
          }}
          className="w-24 text-center"
        />
      </Field>

      <Field label={T.pin}>
        <Toggle
          checked={pinEnabled}
          disabled={busy}
          onChange={(an) => {
            setPinEnabled(an);
            void apply({ pinEnabled: an });
          }}
        />
      </Field>

      {status.error ? (
        <p role="alert" className="border-l-2 border-[var(--status-error)] pl-2 text-sm text-[var(--foreground)] select-text">
          {status.error}
        </p>
      ) : null}

      {running && status.url ? <Pairing url={status.url} pin={status.pin} /> : null}
    </div>
  );
}

function Pairing({ url, pin }: { url: string; pin: string | null }) {
  const T = PRESENTER_TEXTE.handy;
  return (
    <div data-presenter="handy-kopplung" className="rounded-[var(--radius-lg)] bg-[var(--muted)] ring-1 ring-[var(--border)] p-4 flex flex-wrap items-center gap-4">
      <QrBild url={url} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-bold">{T.amHandy}</div>
        <a href={url} className="block text-lg font-bold text-[var(--primary)] break-all leading-tight mt-1" onClick={(e) => e.preventDefault()}>
          {url}
        </a>
        {pin ? (
          <div className="mt-3">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] font-bold">{T.pinTitel}</span>
            <div className="text-3xl font-extrabold tracking-[0.3em] tabular">{pin}</div>
          </div>
        ) : (
          <div className="mt-3 text-xs text-[var(--muted-foreground)]">{T.ohnePin}</div>
        )}
      </div>
    </div>
  );
}

// Das QR-Bild ist eine Programmfläche (B5): dunkel auf weiß, damit jedes Handy es liest, in Hell und Dunkel gleich.
function QrBild({ url }: { url: string }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#0c0c0c', light: '#ffffff' } })
      .then((d) => alive && setQr(d))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <div className="bg-white rounded-lg p-2 shrink-0">
      {qr ? <img src={qr} alt={PRESENTER_TEXTE.handy.qrAlt} className="w-32 h-32 block" /> : <div className="w-32 h-32" />}
    </div>
  );
}

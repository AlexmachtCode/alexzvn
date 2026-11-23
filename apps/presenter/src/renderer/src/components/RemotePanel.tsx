import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { REMOTE_TEXTE } from '@jm/settings';
import { Field, Select, TextInput, Toggle, UNBEKANNT } from '@jm/ui';
import { chatText, type GastKlickerStatus } from '@shared/gast-klicker';
import type { NetInterface, RemoteConfig, RemoteStatus } from '@shared/types';
import { PRESENTER_TEXTE } from '@/lib/oberflaeche';
import { GastKlickerAbschnitt, type GastKlickerAktionen } from './GastKlickerAbschnitt';

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

/**
 * Fenster „Fernsteuerung übers Netzwerk“ im Referenten (bis Task 11, dann entfällt die Hülle): dieselben Inhalte wie die
 * Panel-Abschnitte Handy-Fernsteuerung und Gast-Klicker, mit eigenem Lesen, solange der Referent noch keinen Stand hat.
 */
export function RemotePanel({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<RemoteStatus | null>(null);
  const [ifaces, setIfaces] = useState<NetInterface[] | undefined>(undefined);
  const [gast, setGast] = useState<GastKlickerStatus | null>(null);

  useEffect(() => {
    void Promise.all([window.jmpr.remote.status(), window.jmpr.remote.interfaces()]).then(([s, list]) => {
      setStatus(s);
      setIfaces(list);
    });
    return window.jmpr.remote.onStatus(setStatus);
  }, []);

  useEffect(() => {
    void window.jmpr.gastKlicker.status().then(setGast);
    return window.jmpr.gastKlicker.onStatus(setGast);
  }, []);

  const gastAktionen: GastKlickerAktionen = {
    setzeAn: async (an) => setGast(await window.jmpr.gastKlicker.setzeAn(an)),
    pause: async (an) => setGast(await window.jmpr.gastKlicker.pause(an)),
    neuerLink: async () => {
      if (window.confirm(PRESENTER_TEXTE.gastKlicker.neuerLinkFrage)) setGast(await window.jmpr.gastKlicker.neuerLink());
    },
    kopieren: async (link) => {
      try {
        await navigator.clipboard.writeText(chatText(link));
        return true;
      } catch {
        return false;
      }
    },
  };

  return (
    <div className="absolute inset-0 z-20 bg-[var(--background)]/70 backdrop-blur-sm grid place-items-center p-6">
      <div className="w-full max-w-lg rounded-2xl bg-[var(--card)] ring-1 ring-[var(--border)] p-6 max-h-full overflow-auto scroll-thin">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold">📱 Fernsteuerung übers Netzwerk</h3>
          <button type="button" onClick={onClose} className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            schließen ✕
          </button>
        </div>
        <p className="text-sm text-[var(--muted-foreground)] mb-5">{PRESENTER_TEXTE.handy.erklaerung}</p>

        {status ? (
          <HandyAbschnitt
            status={status}
            netzwerkkarten={ifaces}
            anwenden={async (c) => setStatus(await window.jmpr.remote.apply(c))}
          />
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">{UNBEKANNT}</p>
        )}

        <div className="mt-6 pt-5 border-t border-[var(--border)]">
          <h4 className="font-bold">🌐 Gast-Klicker übers Internet (Zoom-Gäste)</h4>
          <p className="text-sm text-[var(--muted-foreground)] mt-1 mb-4">{PRESENTER_TEXTE.gastKlicker.erklaerung}</p>
          <GastKlickerAbschnitt status={gast ?? undefined} aktionen={gastAktionen} />
        </div>
      </div>
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

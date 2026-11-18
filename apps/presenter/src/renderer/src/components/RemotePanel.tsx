import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import type { NetInterface, RemoteConfig, RemoteStatus } from '@shared/types';
import { GastKlickerAbschnitt } from './GastKlickerAbschnitt';

/**
 * Operator panel for the phone clicker: toggle the LAN server on/off, pick which
 * network interface to bind to, and show the URL + QR + PIN to pair a phone.
 */
export function RemotePanel({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<RemoteStatus | null>(null);
  const [ifaces, setIfaces] = useState<NetInterface[]>([]);
  const [busy, setBusy] = useState(false);

  // Editable draft of the config; applied to the server on change.
  const [bind, setBind] = useState('all');
  const [port, setPort] = useState(7330);
  const [pinEnabled, setPinEnabled] = useState(true);

  useEffect(() => {
    void Promise.all([window.jmpr.remote.status(), window.jmpr.remote.interfaces()]).then(
      ([s, list]) => {
        setStatus(s);
        setIfaces(list);
        setBind(s.config.bind);
        setPort(s.config.port);
        setPinEnabled(s.config.pinEnabled);
      },
    );
    return window.jmpr.remote.onStatus(setStatus);
  }, []);

  const apply = async (patch: Partial<RemoteConfig>): Promise<void> => {
    setBusy(true);
    const config: RemoteConfig = {
      enabled: status?.running ?? false,
      bind,
      port,
      pinEnabled,
      ...patch,
    };
    const s = await window.jmpr.remote.apply(config);
    setStatus(s);
    setBusy(false);
  };

  const running = status?.running ?? false;

  return (
    <div className="absolute inset-0 z-20 bg-black/70 backdrop-blur-sm grid place-items-center p-6">
      <div className="w-full max-w-lg rounded-2xl bg-[#161616] ring-1 ring-white/10 p-6 max-h-full overflow-auto scroll-thin">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold">📱 Fernsteuerung übers Netzwerk</h3>
          <button type="button" onClick={onClose} className="text-sm text-white/60 hover:text-white">
            schließen ✕
          </button>
        </div>
        <p className="text-sm text-white/50 mb-5">
          Steuere die Präsentation vom Handy oder Tablet im selben Netzwerk.
        </p>

        {/* On/off */}
        <div className="flex items-center justify-between rounded-lg bg-white/5 ring-1 ring-white/10 px-4 py-3">
          <div>
            <div className="font-semibold">Server {running ? 'aktiv' : 'aus'}</div>
            <div className="text-xs text-white/45">
              {running ? 'Telefone können sich verbinden.' : 'Einschalten, um ein Gerät zu koppeln.'}
            </div>
          </div>
          <Switch on={running} disabled={busy} onClick={() => void apply({ enabled: !running })} />
        </div>

        {/* Network interface + port */}
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/45 font-bold">
              Netzwerkkarte
            </span>
            <select
              value={bind}
              disabled={busy}
              onChange={(e) => {
                setBind(e.target.value);
                void apply({ bind: e.target.value });
              }}
              className="mt-1 w-full h-10 rounded-md bg-white/10 border border-white/15 px-2 text-sm"
            >
              {ifaces.map((i) => (
                <option key={i.address} value={i.address} className="text-black">
                  {i.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/45 font-bold">Port</span>
            <input
              value={port}
              disabled={busy}
              onChange={(e) => setPort(Number(e.target.value.replace(/\D/g, '')) || 0)}
              onBlur={() => port >= 1024 && port <= 65535 && void apply({ port })}
              className="mt-1 w-24 h-10 text-center rounded-md bg-white/10 border border-white/15 text-sm"
            />
          </label>
        </div>

        {/* PIN toggle */}
        <label className="mt-4 flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={pinEnabled}
            disabled={busy}
            onChange={(e) => {
              setPinEnabled(e.target.checked);
              void apply({ pinEnabled: e.target.checked });
            }}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          <span className="text-sm">PIN-Schutz (empfohlen im offenen WLAN)</span>
        </label>

        {status?.error && (
          <div className="mt-4 rounded-md bg-[var(--destructive)]/15 border border-[var(--destructive)]/40 px-3 py-2 text-sm text-[var(--destructive)]">
            {status.error}
          </div>
        )}

        {running && status?.url && <Pairing url={status.url} pin={status.pin} />}

        <GastKlickerAbschnitt />
      </div>
    </div>
  );
}

function Pairing({ url, pin }: { url: string; pin: string | null }) {
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
    <div className="mt-5 rounded-xl bg-white/5 ring-1 ring-white/10 p-5 flex items-center gap-5">
      <div className="bg-white rounded-lg p-2 shrink-0">
        {qr ? <img src={qr} alt="QR" className="w-32 h-32 block" /> : <div className="w-32 h-32" />}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.14em] text-white/45 font-bold">
          Am Handy öffnen
        </div>
        <a
          href={url}
          className="block text-lg font-bold text-[var(--primary)] break-all leading-tight mt-1"
          onClick={(e) => e.preventDefault()}
        >
          {url}
        </a>
        {pin ? (
          <div className="mt-3">
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/45 font-bold">PIN</span>
            <div className="text-3xl font-extrabold tracking-[0.3em] tabular">{pin}</div>
          </div>
        ) : (
          <div className="mt-3 text-xs text-white/45">Ohne PIN — jeder im Netzwerk kann steuern.</div>
        )}
      </div>
    </div>
  );
}

function Switch({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${
        on ? 'bg-[var(--primary)]' : 'bg-white/20'
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${
          on ? 'left-[1.4rem]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

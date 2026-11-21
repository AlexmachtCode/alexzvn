import { useEffect, useState } from 'react';
import { Button, cn, StatusPill } from '@jm/ui';

interface AuthState {
  enabled: boolean;
  token: string;
}

/**
 * Inhalt des Panel-Abschnitts „LAN-Fernbedienung“ (E9; vorher die Ansicht „Remote“): LAN-Adressen des Speaker-Views, Token-Schutz
 * und Hinweise. Der Abschnitt ist nur gemountet, solange das Panel offen ist; die Adressen werden dann alle 4 s neu gelesen.
 * Die Sync-Pille der alten Ansicht ist in der Statusleiste aufgegangen.
 */
export function RemoteInfo() {
  const [urls, setUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!window.jm?.remote) {
        setUrls([]);
        setLoading(false);
        return;
      }
      try {
        const list = await window.jm.remote.getUrls();
        if (!cancelled) {
          setUrls(list);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = window.setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [auth?.enabled, auth?.token]);

  useEffect(() => {
    if (!window.jm?.auth) return;
    window.jm.auth.get().then((a) => setAuth(a));
  }, []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  async function toggleAuth() {
    if (!window.jm?.auth || !auth) return;
    const next = await window.jm.auth.setEnabled(!auth.enabled);
    setAuth(next);
  }

  async function regenerate() {
    if (!window.jm?.auth) return;
    const next = await window.jm.auth.regenerate();
    setAuth(next);
  }

  return (
    <div data-timer="lan" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold">Speaker-View im Browser öffnen</h4>
        <p className="text-xs text-[var(--muted-foreground)]">
          Jedes Gerät im gleichen WLAN/LAN kann eine der folgenden URLs öffnen
          und sieht den Speaker-View live — z. B. ein iPad als Backstage-Display,
          ein zweiter Bildschirm im Regieraum oder ein Smartphone als Side-Monitor.
          <br />
          Read-Only · Anzeige spiegelt 1:1 die Speaker-Fenster-Ansicht.
        </p>
      </div>

      {loading ? (
        <div className="text-xs text-[var(--muted-foreground)]">
          Netzwerk-Adressen werden ermittelt…
        </div>
      ) : urls.length === 0 ? (
        <div className="text-xs text-[var(--foreground)]">
          <span aria-hidden>⚠</span> Keine LAN-Adresse gefunden. Vermutlich nur Loopback verfügbar — prüfe
          WLAN/Netzwerk-Verbindung.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {urls.map((url) => (
            <div
              key={url}
              className="flex flex-col gap-2 px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)]"
            >
              <code className="text-xs font-mono text-[var(--foreground)] break-all select-text">{url}</code>
              <Button
                variant="outline"
                size="sm"
                uppercase={false}
                className="self-start"
                onClick={() => copy(url)}
              >
                {copied === url ? 'Kopiert' : 'Kopieren'}
              </Button>
            </div>
          ))}
        </div>
      )}

      {auth && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Auth · Token-Schutz</h4>
            <StatusPill state={auth.enabled ? 'ok' : 'off'} text={auth.enabled ? 'Auth aktiv' : 'Offen (kein Token)'} />
          </div>

          <p className="text-xs text-[var(--muted-foreground)]">
            Aktiviert, akzeptiert der Sync-Server nur Remote-Clients, die den
            Token mitschicken. Loopback (Operator + Speaker auf demselben
            Rechner) ist immer ohne Token erlaubt. Die LAN-URLs oben enthalten
            automatisch <code>?token=…</code>, du kannst sie 1:1 an die Geräte
            schicken.
          </p>

          <div className="flex flex-col gap-2 px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)]">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Token</span>
            <code
              className={cn(
                'text-xs font-mono break-all select-text',
                auth.enabled ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]',
              )}
            >
              {auth.token}
            </code>
            <Button
              variant="outline"
              size="sm"
              uppercase={false}
              className="self-start"
              onClick={() => copy(auth.token)}
            >
              {copied === auth.token ? 'Kopiert' : 'Kopieren'}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Button variant="ghost" size="sm" uppercase={false} onClick={regenerate}>
              Neuen Token generieren
            </Button>
            <Button variant={auth.enabled ? 'outline' : 'primary'} size="sm" onClick={toggleAuth}>
              {auth.enabled ? 'Auth deaktivieren' : 'Auth aktivieren'}
            </Button>
          </div>

          {auth.enabled && (
            <p className="text-xs text-[var(--muted-foreground)]">
              Tipp: ein neuer Token invalidiert bestehende Remote-Verbindungen
              — sie reconnecten automatisch, schlagen aber fehl bis die neue
              URL geöffnet wird.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold">Hinweise</h4>
        <ul className="flex flex-col gap-2 text-xs text-[var(--muted-foreground)]">
          <li>
            <span className="text-[var(--slash)] mr-2">/</span>
            Klingt eine Adresse falsch (z. B. VPN-IP), nutze die mit dem
            passenden Subnet — meistens <code>192.168.x.x</code>.
          </li>
          <li>
            <span className="text-[var(--slash)] mr-2">/</span>
            In Production lädt der Browser HTML+JS direkt vom App-Server (Port
            7777). Im Dev-Modus läuft die UI über den Vite-Devserver (Port
            5173); die Socket-Verbindung geht trotzdem auf Port 7777.
          </li>
          <li>
            <span className="text-[var(--slash)] mr-2">/</span>
            Firewall: Port <strong>7777</strong> (und im Dev zusätzlich{' '}
            <strong>5173</strong>) muss erreichbar sein.
          </li>
          <li>
            <span className="text-[var(--slash)] mr-2">/</span>
            Für öffentliche / unbekannte Netzwerke{' '}
            <strong>Auth aktivieren</strong> (oben). Im vertrauenswürdigen
            Backstage-LAN ist es meist überflüssig.
          </li>
        </ul>
      </div>
    </div>
  );
}

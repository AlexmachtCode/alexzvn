import { useEffect, useId, useState } from 'react';
import QRCode from 'qrcode';
import { PEERS_TEXTE, REMOTE_TEXTE } from '@jm/settings';
import { Button, Field, Select, TextInput, Toggle, UNBEKANNT } from '@jm/ui';
import type { NetInterface, RemoteConfig, RemoteStatus } from '@shared/types';
import { PRESENTER_TEXTE } from '@/lib/oberflaeche';

/** Netzwerkkarte und Port des Handy-Servers. */
export interface HandyBindung {
  bind: string;
  port: number;
}

/**
 * Entwurf: nur die Felder, die der Nutzer seit dem letzten „Setzen“ geändert hat. Ein Feld gleich dem angewandten Stand ist kein
 * Entwurf. Was nicht im Entwurf steht, kommt immer frisch aus dem angewandten Stand, nie aus einer Kopie.
 */
export type HandyEntwurf = Partial<HandyBindung>;

const gleicheBindung = (a: HandyBindung, b: HandyBindung): boolean => a.bind === b.bind && a.port === b.port;

/** Was die Felder zeigen und „Setzen“ sendet: je Feld der Entwurf, sonst der angewandte Stand. */
export function handyWerte(entwurf: HandyEntwurf, angewandt: HandyBindung): HandyBindung {
  return { bind: entwurf.bind ?? angewandt.bind, port: entwurf.port ?? angewandt.port };
}

/** Ein Feld in den Entwurf übernehmen; gleicht der Wert dem angewandten Stand, fällt das Feld aus dem Entwurf. */
export function handyEntwurfMit<K extends keyof HandyBindung>(entwurf: HandyEntwurf, feld: K, wert: HandyBindung[K], angewandt: HandyBindung): HandyEntwurf {
  const rest: HandyEntwurf = { ...entwurf };
  delete rest[feld];
  return wert === angewandt[feld] ? rest : { ...rest, [feld]: wert };
}

/** Port des Handy-Servers: nur 1024 bis 65535 (wie bisher beim Verlassen des Felds). */
const portGueltig = (port: number): boolean => Number.isInteger(port) && port >= 1024 && port <= 65535;

/**
 * Warum „Setzen“ gesperrt ist (gesperrt nie ohne Grund, Muster Gegenstellen): es wird gerade angewendet; der Port liegt
 * außerhalb 1024 bis 65535; Netzwerkkarte und Port gleichen dem angewandten Stand. undefined = bedienbar.
 */
export function handySetzenGrund(werte: HandyBindung, angewandt: HandyBindung, busy: boolean): string | undefined {
  const T = PRESENTER_TEXTE.handy;
  if (busy) return T.setzenLaeuft;
  if (!portGueltig(werte.port)) return T.setzenPort;
  if (gleicheBindung(werte, angewandt)) return T.setzenUnveraendert;
  return undefined;
}

/** Was die Felder des Abschnitts auslösen und zeigen (hooklos prüfbar). */
export interface HandyBedienung {
  /** Auswahl „Netzwerkkarte“: ändert nur den Entwurf. */
  netzwerkkarte(adresse: string): void;
  /** Feld „Port“ (nur Ziffern): ändert nur den Entwurf. */
  port(eingabe: string): void;
  /** „Setzen“: wendet die geänderten Felder an, nur ohne Sperrgrund; gelingt es, fällt der Entwurf weg. */
  setzen(): void;
  /** Schalter „Server aktiv“/„Server aus“: sofort, sonst alles wie angewandt. */
  server(): void;
  /** Schalter „PIN-Schutz“: sofort, sonst alles wie angewandt. */
  pin(an: boolean): void;
  /** Angezeigte Netzwerkkarte und Port (handyWerte). */
  werte: HandyBindung;
  setzenGrund: string | undefined;
}

/**
 * Bedienung des Abschnitts (Global Constraint „Wahl ≠ Bewegung“, Entscheid zu Task 12): Eine native Auswahl feuert change auch per
 * Tastatur, und im Panel behält die Auswahl ihre Tasten (O1). Darum ändern Netzwerkkarte und Port nur den Entwurf, und erst
 * „Setzen“ ruft dasselbe `anwenden` wie bisher.
 * Fix-Runde 1: Jede Anwendung sendet genau den angewandten Stand (`status.config`), außer den Feldern, die gerade bewusst geändert
 * werden: „Setzen“ die geänderten Felder des Entwurfs, der Server-Schalter `enabled`, der PIN-Schalter `pinEnabled`. Keine Kopie
 * eines angewandten Werts geht hinaus, so dreht kein Panel eine Änderung aus dem anderen Fenster zurück. `enabled` kommt bei
 * „Setzen“ und PIN weiter aus dem gemessenen `running` (wie bisher, Befund 16). Ein offener Entwurf überlebt einen Schalterdruck;
 * nach einem gelungenen „Setzen“ fällt er weg, danach folgt das Panel wieder dem angewandten Stand.
 */
export function handyBedienung(a: {
  status: RemoteStatus;
  entwurf: HandyEntwurf;
  busy: boolean;
  setzeEntwurf(e: HandyEntwurf): void;
  anwenden(config: RemoteConfig): Promise<unknown>;
}): HandyBedienung {
  const c = a.status.config;
  const angewandt = { bind: c.bind, port: c.port };
  const werte = handyWerte(a.entwurf, angewandt);
  const setzenGrund = handySetzenGrund(werte, angewandt, a.busy);
  return {
    netzwerkkarte: (adresse) => a.setzeEntwurf(handyEntwurfMit(a.entwurf, 'bind', adresse, angewandt)),
    port: (eingabe) => a.setzeEntwurf(handyEntwurfMit(a.entwurf, 'port', Number(eingabe.replace(/\D/g, '')) || 0, angewandt)),
    setzen: () => {
      if (setzenGrund !== undefined) return;
      void a.anwenden({ enabled: a.status.running, ...werte, pinEnabled: c.pinEnabled }).then(
        () => a.setzeEntwurf({}),
        () => undefined,
      );
    },
    server: () => void a.anwenden({ enabled: !a.status.running, bind: c.bind, port: c.port, pinEnabled: c.pinEnabled }),
    pin: (an) => void a.anwenden({ enabled: a.status.running, bind: c.bind, port: c.port, pinEnabled: an }),
    werte,
    setzenGrund,
  };
}

/**
 * Handy-Fernsteuerung (Inhalt des Panel-Abschnitts „Handy-Fernsteuerung“, UX Welle 2b d1, früher RemotePanel.tsx:62-128): den
 * LAN-Server ein- und ausschalten, Netzwerkkarte und Port wählen und mit „Setzen“ anwenden, und die Kopplung (Adresse, QR, PIN)
 * zeigen. Status, Netzwerkkarten, das Anwenden und „beschäftigt“ kommen herein; kein Abo, kein Effekt, kein window. Hier liegt nur
 * der Entwurf, keine Kopie des gemeldeten Stands; was die Felder tun, steht in handyBedienung, gezeichnet wird in HandyFelder.
 * „beschäftigt“ hält die Wurzel-View (lib/aufrufe.ts, Rückspiel Task 26): das Panel stirbt beim Schließen, ein Wiederöffnen während
 * des Anwendens gibt Schalter und „Setzen“ nicht frei. Der ungesicherte Entwurf stirbt weiter mit dem Panel (wie die Gegenstellen).
 */
export function HandyAbschnitt({
  status,
  netzwerkkarten,
  anwenden,
  busy,
}: {
  status: RemoteStatus;
  netzwerkkarten: NetInterface[] | undefined;
  /** Anwenden über die Wurzel-View, die dabei „beschäftigt“ führt (mitLaufendenAufrufen). */
  anwenden(config: RemoteConfig): Promise<unknown>;
  /** Läuft ein Anwenden (aus der Wurzel-View). */
  busy: boolean;
}) {
  const [entwurf, setEntwurf] = useState<HandyEntwurf>({});
  const grundId = useId();
  const bedienung = handyBedienung({ status, entwurf, busy, setzeEntwurf: setEntwurf, anwenden });

  return <HandyFelder status={status} netzwerkkarten={netzwerkkarten} busy={busy} grundId={grundId} bedienung={bedienung} />;
}

/**
 * Die Felder des Abschnitts, ohne Hooks: Auswahl und Port gehen nur an den Entwurf, „Setzen“ wendet an, gesperrt mit Grund; der
 * PIN-Schalter zeigt den angewandten Stand.
 */
export function HandyFelder({
  status,
  netzwerkkarten,
  busy,
  grundId,
  bedienung,
}: {
  status: RemoteStatus;
  netzwerkkarten: NetInterface[] | undefined;
  busy: boolean;
  grundId: string;
  bedienung: HandyBedienung;
}) {
  const T = PRESENTER_TEXTE.handy;
  const running = status.running;
  const grund = bedienung.setzenGrund;
  const werte = bedienung.werte;
  return (
    <div className="space-y-3">
      <Field label={running ? T.serverAn : T.serverAus} hint={running ? T.hinweisAn : T.hinweisAus}>
        <Toggle checked={running} disabled={busy} onChange={bedienung.server} />
      </Field>

      <Field label={T.netzwerkkarte}>
        {netzwerkkarten === undefined ? (
          <p className="text-sm text-[var(--muted-foreground)]">{UNBEKANNT}</p>
        ) : (
          <Select options={netzwerkkarten.map((i) => ({ value: i.address, label: i.label }))} value={werte.bind} disabled={busy} onChange={bedienung.netzwerkkarte} />
        )}
      </Field>

      <Field label={REMOTE_TEXTE.port}>
        <TextInput value={werte.port === 0 ? '' : String(werte.port)} inputMode="numeric" disabled={busy} onChange={bedienung.port} className="w-24 text-center" />
      </Field>

      <div data-presenter="handy-setzen" className="space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          uppercase={false}
          className="motion-reduce:transition-none"
          aria-label={PEERS_TEXTE.setzenFuer(T.titel)}
          aria-describedby={grund === undefined ? undefined : grundId}
          onClick={bedienung.setzen}
          disabled={grund !== undefined}
        >
          {PEERS_TEXTE.setzen}
        </Button>
        {grund === undefined ? null : (
          <p id={grundId} className="text-[11px] text-[var(--muted-foreground)]">
            {grund}
          </p>
        )}
      </div>

      <Field label={T.pin}>
        <Toggle checked={status.config.pinEnabled} disabled={busy} onChange={bedienung.pin} />
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
        <a href={url} className="block text-lg font-bold text-[var(--primary)] break-all leading-tight mt-1 select-text" onClick={(e) => e.preventDefault()}>
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

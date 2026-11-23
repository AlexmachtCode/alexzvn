import { useEffect, useId, useState } from 'react';
import QRCode from 'qrcode';
import { PEERS_TEXTE, REMOTE_TEXTE } from '@jm/settings';
import { Button, Field, Select, TextInput, Toggle, UNBEKANNT } from '@jm/ui';
import type { NetInterface, RemoteConfig, RemoteStatus } from '@shared/types';
import { PRESENTER_TEXTE } from '@/lib/oberflaeche';

/** Netzwerkkarte und Port, wie sie gelten bzw. wie sie im Entwurf stehen. */
export interface HandyBindung {
  bind: string;
  port: number;
}

/** Entwurf von Netzwerkkarte und Port; `basis` = der angewandte Stand, von dem er ausging. */
export interface HandyEntwurf extends HandyBindung {
  basis: HandyBindung;
}

const gleicheBindung = (a: HandyBindung, b: HandyBindung): boolean => a.bind === b.bind && a.port === b.port;

/**
 * Der wirksame Entwurf, ohne Effekt aus dem gemeldeten Stand abgeleitet: ohne Eingabe, unberührt oder schon angewandt folgt er dem
 * angewandten Stand (auch wenn ihn ein anderes Fenster geändert hat); eine eigene, noch nicht gesetzte Eingabe bleibt stehen.
 */
export function handyEntwurf(roh: HandyEntwurf | undefined, angewandt: HandyBindung): HandyEntwurf {
  if (roh === undefined || gleicheBindung(roh, roh.basis) || gleicheBindung(roh, angewandt)) return { ...angewandt, basis: { ...angewandt } };
  return roh;
}

/** Port des Handy-Servers: nur 1024 bis 65535 (wie bisher beim Verlassen des Felds). */
const portGueltig = (port: number): boolean => Number.isInteger(port) && port >= 1024 && port <= 65535;

/**
 * Warum „Setzen“ gesperrt ist (gesperrt nie ohne Grund, Muster Gegenstellen): es wird gerade angewendet; der Port liegt
 * außerhalb 1024 bis 65535; Netzwerkkarte und Port gleichen dem angewandten Stand. undefined = bedienbar.
 */
export function handySetzenGrund(entwurf: HandyBindung, angewandt: HandyBindung, busy: boolean): string | undefined {
  const T = PRESENTER_TEXTE.handy;
  if (busy) return T.setzenLaeuft;
  if (!portGueltig(entwurf.port)) return T.setzenPort;
  if (gleicheBindung(entwurf, angewandt)) return T.setzenUnveraendert;
  return undefined;
}

/** Was die Felder des Abschnitts auslösen (hooklos prüfbar). */
export interface HandyBedienung {
  /** Auswahl „Netzwerkkarte“: ändert nur den Entwurf. */
  netzwerkkarte(adresse: string): void;
  /** Feld „Port“ (nur Ziffern): ändert nur den Entwurf. */
  port(eingabe: string): void;
  /** „Setzen“: wendet Netzwerkkarte und Port des Entwurfs an, nur ohne Sperrgrund. */
  setzen(): void;
  /** Schalter „Server aktiv“/„Server aus“: sofort, mit dem angewandten Stand. */
  server(): void;
  /** Schalter „PIN-Schutz“: sofort, mit dem angewandten Stand. */
  pin(an: boolean): void;
  setzenGrund: string | undefined;
}

/**
 * Bedienung des Abschnitts (Global Constraint „Wahl ≠ Bewegung“, Entscheid zu Task 12): Eine native Auswahl feuert change auch per
 * Tastatur, und im Panel behält die Auswahl ihre Tasten (O1). Darum ändern Netzwerkkarte und Port nur den Entwurf, und erst
 * „Setzen“ ruft dasselbe `anwenden` wie bisher. Die Schalter Server und PIN wirken sofort, aber mit Netzwerkkarte und Port des
 * angewandten Stands (`status.config`), nie mit einem nicht gesetzten Entwurf. `enabled` kommt weiter aus dem gemessenen
 * `running` (wie bisher, Befund 16).
 */
export function handyBedienung(a: {
  status: RemoteStatus;
  entwurf: HandyEntwurf;
  pinEnabled: boolean;
  busy: boolean;
  setzeEntwurf(e: HandyEntwurf): void;
  setzePin(an: boolean): void;
  anwenden(config: RemoteConfig): void;
}): HandyBedienung {
  const angewandt = { bind: a.status.config.bind, port: a.status.config.port };
  const setzenGrund = handySetzenGrund(a.entwurf, angewandt, a.busy);
  return {
    netzwerkkarte: (adresse) => a.setzeEntwurf({ ...a.entwurf, bind: adresse }),
    port: (eingabe) => a.setzeEntwurf({ ...a.entwurf, port: Number(eingabe.replace(/\D/g, '')) || 0 }),
    setzen: () => {
      if (setzenGrund === undefined) a.anwenden({ enabled: a.status.running, bind: a.entwurf.bind, port: a.entwurf.port, pinEnabled: a.pinEnabled });
    },
    server: () => a.anwenden({ enabled: !a.status.running, ...angewandt, pinEnabled: a.pinEnabled }),
    pin: (an) => {
      a.setzePin(an);
      a.anwenden({ enabled: a.status.running, ...angewandt, pinEnabled: an });
    },
    setzenGrund,
  };
}

/**
 * Handy-Fernsteuerung (Inhalt des Panel-Abschnitts „Handy-Fernsteuerung“, UX Welle 2b d1, früher RemotePanel.tsx:62-128): den
 * LAN-Server ein- und ausschalten, Netzwerkkarte und Port wählen und mit „Setzen“ anwenden, und die Kopplung (Adresse, QR, PIN)
 * zeigen. Status, Netzwerkkarten und das Anwenden kommen herein; kein Abo, kein Effekt, kein window. Hier liegen nur die Zustände
 * (Entwurf, PIN, beschäftigt); was die Felder tun, steht in handyBedienung, gezeichnet wird in HandyFelder.
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
  const [busy, setBusy] = useState(false);
  const [roh, setEntwurf] = useState<HandyEntwurf | undefined>(undefined);
  const entwurf = handyEntwurf(roh, { bind: status.config.bind, port: status.config.port });
  const [pinEnabled, setPinEnabled] = useState(status.config.pinEnabled);
  const grundId = useId();

  const wende = async (config: RemoteConfig): Promise<void> => {
    setBusy(true);
    try {
      await anwenden(config);
    } finally {
      setBusy(false);
    }
  };
  const bedienung = handyBedienung({ status, entwurf, pinEnabled, busy, setzeEntwurf: setEntwurf, setzePin: setPinEnabled, anwenden: (c) => void wende(c) });

  return <HandyFelder status={status} netzwerkkarten={netzwerkkarten} entwurf={entwurf} pinEnabled={pinEnabled} busy={busy} grundId={grundId} bedienung={bedienung} />;
}

/** Die Felder des Abschnitts, ohne Hooks: Auswahl und Port gehen nur an den Entwurf, „Setzen“ wendet an, gesperrt mit Grund. */
export function HandyFelder({
  status,
  netzwerkkarten,
  entwurf,
  pinEnabled,
  busy,
  grundId,
  bedienung,
}: {
  status: RemoteStatus;
  netzwerkkarten: NetInterface[] | undefined;
  entwurf: HandyBindung;
  pinEnabled: boolean;
  busy: boolean;
  grundId: string;
  bedienung: HandyBedienung;
}) {
  const T = PRESENTER_TEXTE.handy;
  const running = status.running;
  const grund = bedienung.setzenGrund;
  return (
    <div className="space-y-3">
      <Field label={running ? T.serverAn : T.serverAus} hint={running ? T.hinweisAn : T.hinweisAus}>
        <Toggle checked={running} disabled={busy} onChange={bedienung.server} />
      </Field>

      <Field label={T.netzwerkkarte}>
        {netzwerkkarten === undefined ? (
          <p className="text-sm text-[var(--muted-foreground)]">{UNBEKANNT}</p>
        ) : (
          <Select options={netzwerkkarten.map((i) => ({ value: i.address, label: i.label }))} value={entwurf.bind} disabled={busy} onChange={bedienung.netzwerkkarte} />
        )}
      </Field>

      <Field label={REMOTE_TEXTE.port}>
        <TextInput value={entwurf.port === 0 ? '' : String(entwurf.port)} inputMode="numeric" disabled={busy} onChange={bedienung.port} className="w-24 text-center" />
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
        <Toggle checked={pinEnabled} disabled={busy} onChange={bedienung.pin} />
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

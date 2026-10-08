// --- @jm/settings: PeersSection „Gegenstellen“ (Spec 6.2, UO4) ---
import { Button, Field, NumberInput, StatusPill, TextInput, Toggle } from '@jm/ui';
import { useEffect, useId, useState } from 'react';
import { Anzeige, SectionFrame } from '../SectionFrame';
import { istGesperrt } from '../vertrag';
import { PEERS_TEXTE, peerAuto, peerSetzen, peersView, peerToggle, startPort, type PeerRow, type PeersSectionProps, type PeersView, type PeerZeileView } from './peers';

interface ZeileProps {
  row: PeerRow;
  zeile: PeerZeileView;
  p: PeersSectionProps;
  sichtbar: PeersView['sichtbar'];
  gesperrt: boolean;
}

function PeerZeile({ row, zeile, p, sichtbar, gesperrt }: ZeileProps): React.JSX.Element {
  const [host, setHost] = useState(row.host);
  const [port, setPort] = useState<number | null>(startPort(row));
  useEffect(() => setHost(row.host), [row.host]);
  useEffect(() => setPort(startPort(row)), [row.port, row.defaultPort]);
  const nameId = useId();
  const sperre = gesperrt ? true : undefined;
  return (
    <div role="group" aria-labelledby={nameId} data-rolle={row.role} className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--border)] p-3">
      <p id={nameId} className="text-sm font-semibold text-[var(--foreground)]">
        {row.label}
      </p>
      {sichtbar.schalter ? (
        <Field label={PEERS_TEXTE.aktiv}>
          <Toggle checked={zeile.aktiv} onChange={(n) => peerToggle(p, row, n)} disabled={sperre} />
        </Field>
      ) : null}
      <Field label={PEERS_TEXTE.host}>
        <TextInput value={host} onChange={setHost} placeholder={sichtbar.auto ? PEERS_TEXTE.platzhalterHost : undefined} disabled={sperre} />
      </Field>
      <Field label={PEERS_TEXTE.port}>
        <NumberInput value={port} ganzzahl min={1} max={65535} onChange={setPort} disabled={sperre} />
      </Field>
      {zeile.quelleText ? <Anzeige label={PEERS_TEXTE.quelle}>{zeile.quelleText}</Anzeige> : null}
      <Anzeige label={PEERS_TEXTE.verbunden}>
        <StatusPill state={zeile.status.state} text={zeile.status.text} />
      </Anzeige>
      {p.onSet || sichtbar.auto ? (
        <div className="flex items-center gap-2">
          {p.onSet ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              uppercase={false}
              className="motion-reduce:transition-none"
              aria-label={PEERS_TEXTE.setzenFuer(row.label)}
              onClick={() => peerSetzen(p, row, host, port)}
              disabled={gesperrt || port === null}
            >
              {PEERS_TEXTE.setzen}
            </Button>
          ) : null}
          {sichtbar.auto ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              uppercase={false}
              className="motion-reduce:transition-none"
              aria-label={PEERS_TEXTE.autoFuer(row.label)}
              onClick={() => {
                const e = peerAuto(p, row);
                setHost(e.host);
                setPort(e.port);
              }}
              disabled={gesperrt}
            >
              {PEERS_TEXTE.auto}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PeersSection(p: PeersSectionProps): React.JSX.Element {
  const view = peersView(p);
  const gesperrt = istGesperrt(view);
  return (
    <SectionFrame view={view} titel={PEERS_TEXTE.titel}>
      {view.sichtbar.erklaerung ? <p className="text-[11px] text-[var(--muted-foreground)]">{PEERS_TEXTE.erklaerung}</p> : null}
      {p.peers.map((row, i) => (
        <PeerZeile key={row.role} row={row} zeile={view.zeilen[i]} p={p} sichtbar={view.sichtbar} gesperrt={gesperrt} />
      ))}
    </SectionFrame>
  );
}

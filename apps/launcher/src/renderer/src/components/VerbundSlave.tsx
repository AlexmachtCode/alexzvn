import { useState } from 'react';
import { Button, cn } from '@jm/ui';
import type { VerbundStand } from '@shared/types';
import { toolVerbundText, uhrzeit, type Ton } from '@/lib/verbund-texte';
import { useTools } from '@/store/tools';
import { useVerbund } from '@/store/verbund';
import { Abschnitt, Bestaetigung, beschriftung, eingabeKlasse, TextFeld, TON_KLASSE } from './VerbundTeile';

export function VerbundSlave({ stand }: { stand: VerbundStand }) {
  return (
    <>
      {stand.slave!.gekoppelt ? <Gekoppelt stand={stand} /> : <Koppeln stand={stand} />}
      <ToolsDiesesRechners />
    </>
  );
}

function Koppeln({ stand }: { stand: VerbundStand }) {
  const s = stand.slave!;
  const koppele = useVerbund((x) => x.koppele);
  const anstossen = useVerbund((x) => x.anstossen);
  const meldung = useVerbund((x) => x.meldung);
  const beschaeftigt = useVerbund((x) => x.beschaeftigt);
  const [auswahl, setAuswahl] = useState('');
  const [hand, setHand] = useState('');
  const [code, setCode] = useState('');
  const adresse = hand.trim() || auswahl;
  const los = (): void => {
    if (adresse && code.trim()) void koppele(adresse, code);
  };
  return (
    <Abschnitt titel="Mit Master verbinden">
      {s.gefundeneMaster.length === 0 ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          Suche Master im Netz… Nichts gefunden? Gleiches Netz prüfen, sonst die Adresse von Hand eintragen.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {s.gefundeneMaster.map((g) => {
            const a = g.adressen[0] ?? '';
            return (
              <li key={g.masterId}>
                <label className="flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-xs">
                  <input type="radio" name="master" checked={auswahl === a && !hand.trim()} onChange={() => { setAuswahl(a); setHand(''); }} />
                  <span className="min-w-0 truncate font-bold" title={g.name}>{g.name}</span>
                  <span className="shrink-0 text-[var(--muted-foreground)]">{a} · {g.fpKurz}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <label className="mt-3 flex flex-col gap-1.5">
        <span className={beschriftung}>Adresse von Hand (z. B. über VLAN-Grenzen)</span>
        <input className={eingabeKlasse} value={hand} placeholder="10.0.0.110" onChange={(e) => setHand(e.target.value)} />
      </label>
      <label className="mt-3 flex flex-col gap-1.5">
        <span className={beschriftung}>Code vom Master</span>
        <input
          className={cn(eingabeKlasse, 'font-mono uppercase tracking-[0.2em]')}
          value={code}
          maxLength={13}
          placeholder="XXXXX-XXXXX"
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && los()}
        />
      </label>
      {meldung && <p className="mt-2 text-xs text-[var(--destructive)]" aria-live="polite">{meldung}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" uppercase={false} disabled={beschaeftigt || !adresse || !code.trim()} onClick={los}>
          {s.koppeltGerade ? 'Koppeln…' : 'Koppeln'}
        </Button>
        {s.koppeltGerade && (
          <Button size="sm" variant="ghost" uppercase={false} onClick={() => anstossen(() => window.jmps.brecheKoppelnAb())}>Abbrechen</Button>
        )}
      </div>
    </Abschnitt>
  );
}

function Gekoppelt({ stand }: { stand: VerbundStand }) {
  const s = stand.slave!;
  const fuehreAus = useVerbund((x) => x.fuehreAus);
  const [frage, setFrage] = useState(false);
  const c = s.client;
  const name = s.masterName ?? 'Master';
  const zeile = c.art === 'verbunden'
    ? `Verbunden mit ${name} · ${c.adresse ?? ''} · seit ${c.seit ? uhrzeit(c.seit) : '—'}`
    : c.art === 'fehler'
      ? c.text ?? 'Fehler'
      : c.art === 'verbindet'
        ? `Verbinde mit ${name} (${c.adresse ?? ''})…`
        : `Suche ${name}…`;
  const ton: Ton = c.art === 'verbunden' ? 'gruen' : c.art === 'fehler' ? 'rot' : 'gelb';
  return (
    <Abschnitt titel="Master">
      <p className={cn('text-xs', TON_KLASSE[ton])} aria-live="polite">{zeile}</p>
      <div className="mt-3">
        <TextFeld
          label="Feste Master-Adresse (optional, z. B. über VLAN)"
          wert={s.festeAdresse ?? ''}
          platzhalter="10.0.0.110"
          onSpeichern={(v) => fuehreAus(() => window.jmps.setzeFesteMasterAdresse(v || null))}
        />
      </div>
      <Button size="sm" variant="outline" uppercase={false} className="mt-3" onClick={() => setFrage(true)}>Trennen</Button>
      {frage && (
        <Bestaetigung
          frage="Die Kopplung wird gelöscht; alle Tools dieses Rechners trennen sich vom Master. Danach muss neu gekoppelt werden."
          jaText="Trennen"
          onJa={() => {
            setFrage(false);
            void fuehreAus(() => window.jmps.trenneVerbund());
          }}
          onNein={() => setFrage(false)}
        />
      )}
    </Abschnitt>
  );
}

/** Spec 5.2: welches Tool hängt? Aus dem lokalen Heartbeat-Feld `verbund`. */
function ToolsDiesesRechners() {
  const presence = useTools((s) => s.presence);
  const laufende = presence.filter((p) => p.running);
  return (
    <Abschnitt titel="Tools dieses Rechners">
      {laufende.length === 0 ? (
        <p className="text-xs text-[var(--muted-foreground)]">Gerade läuft kein Tool.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {laufende.map((p) => {
            const t = toolVerbundText(p.verbund, false)!;
            return (
              <li key={p.appId} className="flex items-center justify-between gap-3 text-xs">
                <span>{p.name}</span>
                <span className={TON_KLASSE[t.ton]}>{t.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Abschnitt>
  );
}

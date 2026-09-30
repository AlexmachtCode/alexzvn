import { useState } from 'react';
import { Button, cn } from '@jm/ui';
import type { VerbundClientStand, VerbundStand } from '@shared/types';
import { codeFeldLeeren, koppelnMoeglich, neueKennungAnbieten, uhrzeit, type Ton } from '@/lib/verbund-texte';
import { useVerbund } from '@/store/verbund';
import { Abschnitt, Bestaetigung, beschriftung, eingabeKlasse, TextFeld, ToolsDiesesRechners, TON_KLASSE } from './VerbundTeile';

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
  const letzteAblehnung = useVerbund((x) => x.letzteAblehnung);
  const [auswahl, setAuswahl] = useState('');
  const [hand, setHand] = useState('');
  const [code, setCode] = useState('');
  const adresse = hand.trim() || auswahl;
  const los = (): void => {
    if (!koppelnMoeglich(beschaeftigt, adresse, code)) return; // auch für Enter (C2)
    void koppele(adresse, code).then((r) => {
      // Ein Versuch, der das Gegenüber erreicht hat, verbraucht den Code (Spec 3.3, B9): Feld leeren.
      if (codeFeldLeeren(r)) setCode('');
    });
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
        <Button size="sm" uppercase={false} disabled={!koppelnMoeglich(beschaeftigt, adresse, code)} onClick={los}>
          {s.koppeltGerade ? 'Koppeln…' : 'Koppeln'}
        </Button>
        {s.koppeltGerade && (
          <Button size="sm" variant="ghost" uppercase={false} onClick={() => anstossen(() => window.jmps.brecheKoppelnAb())}>Abbrechen</Button>
        )}
      </div>
      {neueKennungAnbieten(s.client, letzteAblehnung) && <NeueKennung />}
    </Abschnitt>
  );
}

/** Text der Statuszeile am gekoppelten Slave; ein unbekannter Client-Zustand über IPC fällt auf „Suche …“ zurück (C5). */
function statusZeile(c: VerbundClientStand, name: string): { text: string; ton: Ton } {
  switch (c.art) {
    case 'verbunden': return { text: `Verbunden mit ${name} · ${c.adresse ?? ''} · seit ${c.seit ? uhrzeit(c.seit) : '—'}`, ton: 'gruen' };
    case 'fehler': return { text: typeof c.text === 'string' && c.text ? c.text : 'Fehler', ton: 'rot' };
    case 'verbindet': return { text: `Verbinde mit ${name} (${c.adresse ?? ''})…`, ton: 'gelb' };
    default: return { text: `Suche ${name}…`, ton: 'gelb' };
  }
}

function Gekoppelt({ stand }: { stand: VerbundStand }) {
  const s = stand.slave!;
  const fuehreAus = useVerbund((x) => x.fuehreAus);
  const [frage, setFrage] = useState(false);
  const zeile = statusZeile(s.client, s.masterName ?? 'Master');
  return (
    <Abschnitt titel="Master">
      <p className={cn('text-xs', TON_KLASSE[zeile.ton])} aria-live="polite">{zeile.text}</p>
      {neueKennungAnbieten(s.client, null) && <NeueKennung />}
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

/**
 * Endprüfung C1 (Ruling): geklonter Rechner bzw. kopierter Ordner — zwei Rechner mit derselben Kennung verdrängen
 * einander am Master. „Neue Kennung“ erzeugt eine eigene Kennung für DIESEN Rechner und löscht seine Kopplung; danach
 * ist der Koppeln-Bereich sichtbar. Das Original bleibt gekoppelt.
 */
function NeueKennung() {
  const neueKennung = useVerbund((x) => x.neueKennung);
  const beschaeftigt = useVerbund((x) => x.beschaeftigt);
  const [frage, setFrage] = useState(false);
  return (
    <div className="mt-3 rounded-[var(--radius)] border border-[var(--warning)]/50 p-3">
      <p className="text-xs">
        Wurde dieser Rechner geklont oder der Suite-Ordner kopiert? Dann melden sich zwei Rechner mit derselben Kennung.
        „Neue Kennung“ gibt diesem Rechner eine eigene; danach mit einem neuen Code vom Master koppeln.
      </p>
      <Button size="sm" variant="outline" uppercase={false} className="mt-2" disabled={beschaeftigt} onClick={() => setFrage(true)}>
        Neue Kennung
      </Button>
      {frage && (
        <Bestaetigung
          frage="Neue Kennung für diesen Rechner erzeugen? Seine Kopplung wird gelöscht; danach am Master „Rechner koppeln“ öffnen und neu koppeln."
          jaText="Neue Kennung"
          onJa={() => {
            setFrage(false);
            void neueKennung();
          }}
          onNein={() => setFrage(false)}
        />
      )}
    </div>
  );
}

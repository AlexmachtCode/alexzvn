import { useEffect, useState } from 'react';
import { Button, Card, noDragRegion } from '@jm/ui';
import type { VerbundKarte, VerbundRolle, VerbundStand } from '@shared/types';
import { kopfanzeige, kopfEingang } from '@/lib/kopfanzeige';
import { useVerbund } from '@/store/verbund';
import { VerbundMaster } from './VerbundMaster';
import { VerbundSlave } from './VerbundSlave';
import { Abschnitt, Bestaetigung, beschriftung, eingabeKlasse, Pille, TextFeld } from './VerbundTeile';

const ROLLEN: Array<{ rolle: VerbundRolle; text: string; erklaerung: string }> = [
  { rolle: 'aus', text: 'Aus', erklaerung: 'Einzelplatz: kein Netzverkehr des Verbunds, alles wie bisher.' },
  { rolle: 'master', text: 'Master', erklaerung: 'Dieser Launcher ist Master. Andere Rechner koppeln sich einmal per Code.' },
  { rolle: 'slave', text: 'Mit Master verbinden', erklaerung: 'Dieser Rechner koppelt sich mit einem Master. Alle Tools hier verbinden sich dann selbst.' },
];

function kartenText(k: VerbundKarte): string {
  return `${k.name} · ${k.adressen.join(', ')}${k.virtuell ? ' · virtuell' : ''}${k.nurLinkLocal ? ' · Link-Local (kein DHCP)' : ''}`;
}

export function VerbundModal() {
  const offen = useVerbund((s) => s.offen);
  const stand = useVerbund((s) => s.stand);
  const fehler = useVerbund((s) => s.fehler);
  const schliesse = useVerbund((s) => s.schliesse);

  // Sekündlich neu rendern: Countdown des Codes, „zuletzt gesehen“.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!offen) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [offen]);

  useEffect(() => {
    if (!offen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') schliesse();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [offen, schliesse]);

  if (!offen) return null;
  const kopf = stand ? kopfanzeige(kopfEingang(stand)) : null;

  // Aufbau wie System-Zustand (#233): Overlay hebt die Zieh-Fläche des Headers auf;
  // Flex-Layout auf EIGENEM Container (Card packt Kinder in ein <div class="relative">).
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6"
      style={noDragRegion}
      onClick={(e) => {
        if (e.target === e.currentTarget) schliesse();
      }}
    >
      <Card className="w-full max-w-xl p-6 jm-fade-in">
        <div className="flex max-h-[calc(100vh-6rem)] flex-col">
          {/* Die Pille zeigt den vollen Text und bricht um; ist sie zu breit für eine Zeile neben der Überschrift (langer Name), rutscht sie darunter. */}
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0 flex-[1_1_14rem]">
              <h2 className="text-lg font-extrabold tracking-tight">Verbund</h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Mehrere Rechner: ein Launcher ist Master, die anderen koppeln sich einmal.
              </p>
            </div>
            {kopf && <Pille farbe={kopf.farbe}>{kopf.text}</Pille>}
          </div>
          {fehler && (
            <p
              role="alert"
              className="mt-4 shrink-0 rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]"
            >
              {fehler}
            </p>
          )}
          {/* break-words: ein langer Name ohne Leerzeichen bricht um, statt waagerecht zu scrollen. */}
          <div className="-mr-2 min-h-0 flex-1 overflow-y-auto break-words pr-2">
            {!stand ? (
              <p className="mt-5 text-sm text-[var(--muted-foreground)]">Lade…</p>
            ) : stand.dateiFehler ? (
              <p className="mt-5 text-xs text-[var(--destructive)]">
                Die Kopplungsdatei (master-link.json) ist gerade nicht lesbar ({stand.dateiFehler}), z. B. weil ein
                Virenscanner sie prüft. Der Launcher liest sie laufend neu und startet den Verbund, sobald das gelingt.
                Bis dahin ändert er nichts an ihr.
              </p>
            ) : (
              <>
                <RolleWahl stand={stand} />
                <DieserRechner stand={stand} />
                {stand.rolle === 'master' && stand.master && <VerbundMaster stand={stand} />}
                {stand.rolle === 'slave' && stand.slave && <VerbundSlave stand={stand} />}
              </>
            )}
          </div>
          <div className="mt-6 flex shrink-0 items-center justify-end gap-3">
            <Button variant="primary" onClick={schliesse}>Schließen</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function RolleWahl({ stand }: { stand: VerbundStand }) {
  const fuehreAus = useVerbund((s) => s.fuehreAus);
  const beschaeftigt = useVerbund((s) => s.beschaeftigt);
  const [frage, setFrage] = useState<VerbundRolle | null>(null);
  // Die Liste „gefundene Master“ sucht nur, solange das Modal offen ist. Der Main führt dafür einen Wunsch (gesetzt in
  // oeffne(), gelöscht in schliesse()), den JEDE neu angelegte Slave-Rolle übernimmt — hier gibt es nichts nachzustarten.
  const wechsle = (r: VerbundRolle): void => {
    void fuehreAus(() => window.jmps.setzeVerbundRolle(r));
  };
  const waehle = (r: VerbundRolle): void => {
    if (r === stand.rolle) return;
    // Spec 5.3: Slave verlassen löscht die Kopplung — vorher fragen.
    if (stand.rolle === 'slave' && stand.slave?.gekoppelt) {
      setFrage(r);
      return;
    }
    wechsle(r);
  };
  return (
    <Abschnitt titel="Rolle dieses Rechners">
      <div className="flex flex-wrap gap-2">
        {ROLLEN.map((x) => (
          <Button
            key={x.rolle}
            size="sm"
            uppercase={false}
            variant={stand.rolle === x.rolle ? 'primary' : 'outline'}
            disabled={beschaeftigt}
            onClick={() => waehle(x.rolle)}
          >
            {x.text}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">{ROLLEN.find((x) => x.rolle === stand.rolle)?.erklaerung}</p>
      {frage && (
        <Bestaetigung
          frage="Die Kopplung dieses Rechners wird gelöscht. Danach muss neu gekoppelt werden."
          jaText="Rolle wechseln"
          onJa={() => {
            const r = frage;
            setFrage(null);
            wechsle(r);
          }}
          onNein={() => setFrage(null)}
        />
      )}
    </Abschnitt>
  );
}

function DieserRechner({ stand }: { stand: VerbundStand }) {
  const fuehreAus = useVerbund((s) => s.fuehreAus);
  if (stand.rolle === 'aus') return null;
  return (
    <Abschnitt titel="Dieser Rechner">
      <TextFeld
        label="Name dieses Rechners"
        wert={stand.rechnerName}
        onSpeichern={(v) => fuehreAus(() => window.jmps.setzeRechnerName(v))}
      />
      <label className="mt-3 flex flex-col gap-1.5">
        <span className={beschriftung}>Netzwerk der Suite</span>
        <select
          className={eingabeKlasse}
          value={stand.gewaehlteKarte ?? ''}
          onChange={(e) => void fuehreAus(() => window.jmps.setzeVerbundKarte(e.target.value || null))}
        >
          <option value="">Automatisch (alle Netzwerkkarten)</option>
          {stand.gewaehlteKarte && stand.karteFehlt && (
            <option value={stand.gewaehlteKarte}>{stand.gewaehlteKarte} (nicht vorhanden)</option>
          )}
          {stand.karten.map((k) => (
            <option key={k.name} value={k.name}>{kartenText(k)}</option>
          ))}
        </select>
      </label>
      {stand.karteFehlt && (
        <p className="mt-2 text-[11px] text-[var(--warning)]">
          Gewählte Karte „{stand.gewaehlteKarte}“ nicht vorhanden, nutze Automatisch.
        </p>
      )}
    </Abschnitt>
  );
}

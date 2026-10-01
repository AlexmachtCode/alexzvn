import { useState } from 'react';
import { Button, cn } from '@jm/ui';
import type { VerbundStand } from '@shared/types';
import { relativ, speicherFehlerText, uhrzeit, zeigeCode } from '@/lib/verbund-texte';
import { useVerbund } from '@/store/verbund';
import { Abschnitt, Bestaetigung, TextFeld, ToolsDiesesRechners } from './VerbundTeile';

export function VerbundMaster({ stand }: { stand: VerbundStand }) {
  const m = stand.master!;
  const fuehreAus = useVerbund((s) => s.fuehreAus);
  const beschaeftigt = useVerbund((s) => s.beschaeftigt);
  const [entfernen, setEntfernen] = useState<{ id: string; name: string } | null>(null);
  const [erneuern, setErneuern] = useState(false);
  const [neu, setNeu] = useState(false);
  const jetzt = Date.now();

  return (
    <>
      <Abschnitt titel="Master">
        <TextFeld label="Name des Masters" wert={m.name} onSpeichern={(v) => fuehreAus(() => window.jmps.setzeMasterName(v))} />
        <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">Fingerprint {m.fpKurz || '—'} · Port 8738</p>
        {m.zustand === 'port-belegt' && (
          <p className="mt-2 text-xs text-[var(--destructive)]">Port 8738 ist belegt (anderes Programm?). Der Master versucht es alle 10 s erneut.</p>
        )}
        {m.zustand === 'lausch-fehler' && (
          <p className="mt-2 text-xs text-[var(--destructive)]">Master-Link lauscht nicht ({m.fehlerCode}). Neuer Versuch alle 10 s.</p>
        )}
        {m.ausBak && (
          <p className="mt-2 text-xs text-[var(--warning)]">Verbunddaten wurden aus der Sicherung (.bak) wiederhergestellt.</p>
        )}
        {m.speicherFehler && (
          <p className="mt-2 text-xs text-[var(--destructive)]" role="alert">{speicherFehlerText(m.speicherFehler)}</p>
        )}
        {m.zustand === 'daten-beschaedigt' && (
          <div className="mt-3 rounded-[var(--radius)] border border-[var(--destructive)]/40 p-3">
            <p className="text-xs text-[var(--destructive)]">
              Die Verbunddaten dieses Masters sind beschädigt (auch die Sicherung). Der Master lauscht nicht und überschreibt nichts.
            </p>
            <Button size="sm" variant="destructive" uppercase={false} className="mt-2" onClick={() => setNeu(true)}>
              Verbund neu aufsetzen
            </Button>
            {neu && (
              <Bestaetigung
                frage="Alle gekoppelten Rechner gehen verloren und müssen neu gekoppelt werden."
                jaText="Neu aufsetzen"
                onJa={() => {
                  setNeu(false);
                  void fuehreAus(() => window.jmps.setzeVerbundNeuAuf());
                }}
                onNein={() => setNeu(false)}
              />
            )}
          </div>
        )}
      </Abschnitt>

      {m.zustand === 'laeuft' && <KoppelFenster stand={stand} />}

      <Abschnitt titel="Gekoppelte Rechner">
        {m.rechner.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">Noch keine.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {m.rechner.map((r) => (
              <li key={r.rechnerId} className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span aria-hidden className={cn('size-2 shrink-0 rounded-full', r.online ? 'bg-[var(--success)]' : 'bg-[var(--muted-foreground)]/40')} />
                  <span className="truncate text-sm font-bold">{r.name}</span>
                  {r.dieserRechner && <span className="text-[10px] text-[var(--muted-foreground)]">dieser Rechner</span>}
                  <span className="ml-auto shrink-0 text-[11px] text-[var(--muted-foreground)]">
                    {r.online
                      ? (r.dieserRechner ? 'online' : r.adresse ?? 'online')
                      : r.zuletztGesehen
                        ? `offline · zuletzt ${relativ(jetzt - r.zuletztGesehen)}`
                        : 'offline'}
                  </span>
                  {!r.dieserRechner && (
                    <button
                      type="button"
                      className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--highlight)]"
                      onClick={() => setEntfernen({ id: r.rechnerId, name: r.name })}
                    >
                      Entfernen
                    </button>
                  )}
                </div>
                {r.tools.length > 0 && (
                  <ul className="mt-1.5 flex flex-col gap-0.5 pl-4">
                    {r.tools.map((t) => (
                      <li key={t.appId} className="text-[11px] text-[var(--muted-foreground)]">
                        {t.name} {t.version} · verbunden seit {uhrzeit(t.verbundenSeit)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        {entfernen && (
          <Bestaetigung
            frage={`„${entfernen.name}“ entfernen? Der Rechner wird sofort getrennt und muss neu gekoppelt werden.`}
            jaText="Entfernen"
            onJa={() => {
              const id = entfernen.id;
              setEntfernen(null);
              void fuehreAus(() => window.jmps.entferneRechner(id));
            }}
            onNein={() => setEntfernen(null)}
          />
        )}
      </Abschnitt>

      {/* Spec 5.2 „sofern die Rolle nicht aus ist“: auch am Master (Endprüfung C3). */}
      <ToolsDiesesRechners />

      <Abschnitt titel="Master-Identität">
        <p className="text-xs text-[var(--muted-foreground)]">
          Nur bei Verdacht auf Missbrauch oder beim Tausch des Master-Rechners. Danach müssen alle anderen Rechner neu gekoppelt werden.
        </p>
        <Button size="sm" variant="outline" uppercase={false} className="mt-2" disabled={beschaeftigt || m.zustand !== 'laeuft'} onClick={() => setErneuern(true)}>
          Master-Identität erneuern
        </Button>
        {erneuern && (
          <Bestaetigung
            frage="Alle anderen Rechner müssen danach neu gekoppelt werden. Die Tools dieses Rechners verbinden sich von selbst wieder."
            jaText="Erneuern"
            onJa={() => {
              setErneuern(false);
              void fuehreAus(() => window.jmps.erneuereMasterIdentitaet());
            }}
            onNein={() => setErneuern(false)}
          />
        )}
      </Abschnitt>
    </>
  );
}

function KoppelFenster({ stand }: { stand: VerbundStand }) {
  const k = stand.master!.kopplung;
  const fuehreAus = useVerbund((s) => s.fuehreAus);
  const restSek = k.gueltigBis ? Math.max(0, Math.ceil((k.gueltigBis - Date.now()) / 1000)) : 0;
  const zeigbar = k.code !== null && !k.ungueltig && restSek > 0;
  return (
    <Abschnitt titel="Rechner koppeln">
      {!k.offen ? (
        <>
          <p className="text-xs text-[var(--muted-foreground)]">
            Zeigt einen Code für 2 Minuten. Am anderen Rechner im Launcher „Mit Master verbinden“ wählen und den Code eintippen.
          </p>
          <Button size="sm" uppercase={false} className="mt-2" onClick={() => void fuehreAus(() => window.jmps.oeffneKopplung())}>
            Rechner koppeln
          </Button>
        </>
      ) : (
        <>
          {zeigbar ? (
            <>
              <p className="font-mono text-3xl font-extrabold tracking-[0.2em] tabular-nums" aria-live="polite">{zeigeCode(k.code!)}</p>
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                noch {Math.floor(restSek / 60)}:{String(restSek % 60).padStart(2, '0')} · {k.rest} Versuche übrig
              </p>
            </>
          ) : (
            <p className="text-xs text-[var(--destructive)]">Code abgelaufen oder verbraucht. Für den nächsten Rechner einen neuen Code holen.</p>
          )}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" uppercase={false} onClick={() => void fuehreAus(() => window.jmps.neuerKoppelCode())}>Neuer Code</Button>
            <Button size="sm" variant="ghost" uppercase={false} onClick={() => void fuehreAus(() => window.jmps.schliesseKopplung())}>Fertig</Button>
          </div>
        </>
      )}
    </Abschnitt>
  );
}

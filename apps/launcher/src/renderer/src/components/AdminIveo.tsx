import { useState } from 'react';
import { Button, cn } from '@jm/ui';
import type { AdminUebersicht } from '@shared/konto';
import { ADMIN_TEXTE, REITER_TEXTE, fehlerText, iveoHinterlegen, iveoZeilen, vorauswahlNachLaden } from '@/lib/admin-ansicht';
import { useKonto } from '@/store/konto';
import { useTools } from '@/store/tools';

const feldCls = cn(
  'h-8 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2.5 text-xs text-[var(--foreground)]',
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
);

/**
 * Anmeldung (Plan P27, Spec 6.4, 7, EP13): Reiter „iveo-Events“ — links die hinterlegten Events (M30, leer M35), rechts das
 * Formular: Basis-URL, Token (Passwortfeld), „Events laden“ (Discovery im Main über konto:iveoEventsLaden, das Token kommt nie
 * zurück), Auswahl, „Hinterlegen“ (M32). Ein gewähltes Event: Ersetzen (Formular vorbelegt, Token neu) oder Entfernen
 * (Rückfrage M34). Das Token liegt nur im Eingabefeld und ist nach dem Hinterlegen leer.
 */
export function AdminIveo({ daten }: { daten: AdminUebersicht }): React.JSX.Element {
  const aktion = useKonto((s) => s.adminAktion);
  const laden = useKonto((s) => s.iveoEventsLaden);
  const standard = useTools((s) => s.settings?.iveoBaseUrl ?? '');
  const zeilen = iveoZeilen(daten);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [basis, setBasis] = useState('');
  const [token, setToken] = useState('');
  const [events, setEvents] = useState<Array<{ slug: string; name: string }>>([]);
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  // Z1 (Minor 3): „Ersetzen“ merkt sich das Event; nach „Events laden“ ist es wieder gewählt (vorauswahlNachLaden), AR63 bleibt.
  const [vorauswahl, setVorauswahl] = useState<{ basis: string; slug: string } | null>(null);
  const [frage, setFrage] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const zeile = zeilen.find((z) => z.key === auswahl) ?? null;

  // EP13: Events und Auswahl gehoeren zu genau einer Basis und einem Token — wer eines aendert, laedt neu.
  const aenderung = (setze: (v: string) => void, wert: string): void => {
    setze(wert);
    setEvents([]);
    setGewaehlt([]);
  };
  const eventsLaden = async (): Promise<void> => {
    if (!token.trim()) {
      setMeldung(REITER_TEXTE.tokenFehlt);
      return;
    }
    setBusy(true);
    setMeldung(null);
    try {
      const geladeneBasis = basis.trim() || standard;
      const r = await laden({ basis: geladeneBasis, token: token.trim() });
      if (r.ok) {
        setEvents(r.events);
        setGewaehlt(vorauswahlNachLaden(r.events, vorauswahl, geladeneBasis));
      } else {
        setEvents([]);
        setGewaehlt([]);
        setMeldung(r.fehler);
      }
    } finally {
      setBusy(false);
    }
  };
  const hinterlegen = async (): Promise<void> => {
    const a = iveoHinterlegen({ basis, token, gewaehlt, events }, standard);
    if ('fehler' in a) {
      setMeldung(a.fehler);
      return;
    }
    setBusy(true);
    try {
      const r = await aktion(a);
      if (r.ok) {
        // M32: nach dem Hinterlegen nie wieder angezeigt — das Feld ist sofort leer.
        setToken('');
        setEvents([]);
        setGewaehlt([]);
        setVorauswahl(null);
        setMeldung(null);
      } else setMeldung(fehlerText(r.code, a.aktion));
    } finally {
      setBusy(false);
    }
  };
  const entfernen = async (key: string): Promise<void> => {
    setBusy(true);
    setFrage(false);
    try {
      const r = await aktion({ aktion: 'iveo-entfernen', key });
      if (r.ok) setAuswahl(null);
      else setMeldung(fehlerText(r.code, 'iveo-entfernen'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 grid grid-cols-[260px_1fr] gap-5">
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-[1fr_auto] gap-x-2 text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
          <span>{REITER_TEXTE.spalteEvent}</span>
          <span>{REITER_TEXTE.spalteAm}</span>
        </div>
        {zeilen.length === 0 && <p className="text-xs text-[var(--muted-foreground)]">{REITER_TEXTE.keineEvents}</p>}
        {zeilen.map((z) => (
          <button
            key={z.key}
            type="button"
            onClick={() => {
              setAuswahl(z.key);
              setVorauswahl(null);
              setFrage(false);
              setMeldung(null);
            }}
            className={cn(
              'w-full rounded-[var(--radius)] border px-2 py-1.5 text-left text-xs transition-colors',
              auswahl === z.key ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--border)] hover:bg-[var(--highlight)]',
            )}
          >
            <span className="grid grid-cols-[1fr_auto] gap-x-2">
              <span className="truncate font-semibold">{z.event}</span>
              <span className="tabular-nums">{z.am}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {meldung && (
          <p role="alert" className="text-xs rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
            {meldung}
          </p>
        )}
        {zeile && (
          <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] p-3 text-xs">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-[var(--muted-foreground)]">{REITER_TEXTE.spalteEvent}</dt>
              <dd>{zeile.event}</dd>
              <dt className="text-[var(--muted-foreground)]">{REITER_TEXTE.spalteBasis}</dt>
              <dd className="break-all">{zeile.basis}</dd>
              <dt className="text-[var(--muted-foreground)]">{REITER_TEXTE.spalteAm}</dt>
              <dd>{zeile.am}</dd>
              <dt className="text-[var(--muted-foreground)]">{REITER_TEXTE.spalteVon}</dt>
              <dd>{zeile.von}</dd>
            </dl>
            {frage ? (
              <div className="flex flex-col gap-2">
                <p>{REITER_TEXTE.frageEntfernen}</p>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setFrage(false)}>
                    {ADMIN_TEXTE.abbrechen}
                  </Button>
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => void entfernen(zeile.key)}>
                    {REITER_TEXTE.entfernen}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBasis(zeile.basis);
                    setToken('');
                    setEvents([{ slug: zeile.slug, name: zeile.event }]);
                    setGewaehlt([zeile.slug]);
                    setVorauswahl({ basis: zeile.basis, slug: zeile.slug });
                  }}
                >
                  {REITER_TEXTE.ersetzen}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setFrage(true)}>
                  {REITER_TEXTE.entfernen}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-[var(--muted-foreground)]">
            {REITER_TEXTE.feldBasis}
            <input className={feldCls} value={basis} placeholder={standard} onChange={(e) => aenderung(setBasis, e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-[var(--muted-foreground)]">
            {REITER_TEXTE.feldToken}
            <input type="password" autoComplete="off" className={feldCls} value={token} onChange={(e) => aenderung(setToken, e.target.value)} />
          </label>
          <p className="text-[11px] text-[var(--muted-foreground)]">{REITER_TEXTE.tokenHinweis}</p>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void eventsLaden()}>
              {REITER_TEXTE.eventsLaden}
            </Button>
          </div>
          {events.length > 0 && (
            <div className="flex flex-col gap-1">
              {events.map((e) => (
                <label key={e.slug} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={gewaehlt.includes(e.slug)}
                    onChange={(x) => setGewaehlt(x.target.checked ? [...gewaehlt, e.slug] : gewaehlt.filter((s) => s !== e.slug))}
                  />
                  {e.name}
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void hinterlegen()}>
              {REITER_TEXTE.hinterlegen}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Fragment, useEffect, useState } from 'react';
import { Button, cn } from '@jm/ui';
import type { AdminAktionErgebnis, AdminUebersicht, Stufe, Werkzeug } from '@shared/konto';
import {
  ADMIN_TEXTE, einladeFormular, einladungsAnzeige, fehlerText, formularAusZugang, loeschenSchliesstDetail, loeschFrage, verlaengertBis, zugangDetails,
  zugangFormular, zugangZeilen, type ZugangsFormular,
} from '@/lib/admin-ansicht';
import { STUFE_TEXT } from '@shared/konto';
import { useKonto } from '@/store/konto';

const feldCls = cn(
  'h-8 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2.5 text-xs text-[var(--foreground)]',
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
);
const WERKZEUGE: Werkzeug[] = ['connect-raum', 'qa', 'iveo'];
const STUFEN: Stufe[] = ['admin', 'kollege', 'externer'];

/** Auswahl aus einer Liste per Häkchen (Tools, Events). */
function Haken<T extends string>({ alle, gewaehlt, name, onChange }: { alle: T[]; gewaehlt: T[]; name: (x: T) => string; onChange: (x: T[]) => void }) {
  return (
    <div className="flex flex-col gap-1">
      {alle.map((x) => (
        <label key={x} className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={gewaehlt.includes(x)}
            onChange={(e) => onChange(e.target.checked ? [...gewaehlt, x] : gewaehlt.filter((y) => y !== x))}
          />
          {name(x)}
        </label>
      ))}
    </div>
  );
}

/**
 * Anmeldung (Plan P26, Spec 7, 4, 5): Reiter „Zugänge“ — links die Liste (M10, M11) mit „+ Externen einladen“, rechts Details
 * (M12–M14) und Formular (Stufe, Tools und iveo-Events für Externe, Zugang bis, Zoom-Freigabe bis) mit Speichern, Löschen
 * (Rückfrage M17/M18), Sperre aufheben, neuem Code (Rückfrage M19) und Verlängern. Der Einladungscode erscheint genau einmal
 * (M22, M23) und liegt nur in diesem Zustand der Komponente, nie im Store.
 */
export function AdminZugaenge({ daten }: { daten: AdminUebersicht }): React.JSX.Element {
  const aktion = useKonto((s) => s.adminAktion);
  const jetzt = Date.now();
  const zeilen = zugangZeilen(daten, jetzt);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [einladen, setEinladen] = useState(false);
  const [formular, setFormular] = useState<ZugangsFormular | null>(null);
  const [einladung, setEinladung] = useState({ email: '', name: '', tools: [] as Werkzeug[], events: [] as string[], bis: '' });
  const [frage, setFrage] = useState<'loeschen' | 'code' | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [code, setCode] = useState<{ name: string; ergebnis: AdminAktionErgebnis } | null>(null);
  const [busy, setBusy] = useState(false);
  const zugang = daten.zugaenge.find((z) => z.kid === auswahl) ?? null;
  const eventName = (key: string): string => daten.iveo.find((e) => e.key === key)?.name ?? key;

  // Neue Auswahl: Formular aus dem Zugang, Rückfrage, Meldung und ein angezeigter Code verschwinden (M22: nur jetzt).
  // Nur die Auswahl zählt: eine neue Übersicht nach einer Aktion setzt das Formular nicht zurück.
  useEffect(() => {
    const z = daten.zugaenge.find((x) => x.kid === auswahl) ?? null;
    setFormular(z ? formularAusZugang(z) : null);
    setFrage(null);
    setMeldung(null);
    setCode(null);
  }, [auswahl]);

  const fuehreAus = async (a: Parameters<typeof aktion>[0], erfolg: (e: AdminAktionErgebnis) => void): Promise<void> => {
    setBusy(true);
    setFrage(null);
    try {
      const r = await aktion(a);
      if (r.ok) erfolg(r.ergebnis);
      else setMeldung(fehlerText(r.code, a.aktion));
    } finally {
      setBusy(false);
    }
  };

  const speichern = (): void => {
    if (!zugang || !formular) return;
    const a = zugangFormular(zugang.kid, formular);
    if ('fehler' in a) setMeldung(a.fehler);
    else void fuehreAus(a, () => setMeldung(ADMIN_TEXTE.gespeichert(zugang.name || zugang.email)));
  };
  const einladenSenden = (): void => {
    const a = einladeFormular(einladung);
    if ('fehler' in a) {
      setMeldung(a.fehler);
      return;
    }
    const name = einladung.name.trim() || einladung.email.trim();
    void fuehreAus(a, (e) => {
      setCode({ name, ergebnis: e });
      setEinladung({ email: '', name: '', tools: [], events: [], bis: '' });
      setMeldung(null);
    });
  };

  const extern = formular?.stufe === 'externer';
  const anzeige = code ? einladungsAnzeige(code.name, code.ergebnis) : null;

  return (
    <div className="mt-4 grid grid-cols-[260px_1fr] gap-5">
      <div className="flex flex-col gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setAuswahl(null);
            setEinladen(true);
            setMeldung(null);
            setCode(null);
          }}
        >
          {ADMIN_TEXTE.einladen}
        </Button>
        {zeilen.length === 0 && <p className="text-xs text-[var(--muted-foreground)]">{ADMIN_TEXTE.keineZugaenge}</p>}
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
          <span>{ADMIN_TEXTE.spalteName}</span>
          <span>{ADMIN_TEXTE.spalteStufe}</span>
          <span>{ADMIN_TEXTE.spalteBis}</span>
        </div>
        <ul className="flex flex-col gap-1">
          {zeilen.map((z) => (
            <li key={z.kid}>
              <button
                type="button"
                onClick={() => {
                  setEinladen(false);
                  setAuswahl(z.kid);
                }}
                className={cn(
                  'w-full rounded-[var(--radius)] border px-2 py-1.5 text-left text-xs transition-colors',
                  auswahl === z.kid ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-[var(--border)] hover:bg-[var(--highlight)]',
                )}
              >
                <span className="grid grid-cols-[1fr_auto_auto] gap-x-2">
                  <span className="truncate font-semibold">{z.name}</span>
                  <span>{z.stufe}</span>
                  <span className="tabular-nums">{z.bis}</span>
                </span>
                {z.merkmale.length > 0 && <span className="mt-0.5 block text-[10px] text-[var(--muted-foreground)]">{z.merkmale.join(' · ')}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {anzeige && (
          <div role="status" className="rounded-[var(--radius)] border border-[var(--primary)]/50 bg-[var(--highlight)] p-3 text-xs">
            <p className="font-mono text-sm font-extrabold">{anzeige.code}</p>
            <p className="mt-1">{anzeige.hinweis}</p>
          </div>
        )}
        {meldung && (
          <p role="alert" className="text-xs rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)] px-3 py-2">
            {meldung}
          </p>
        )}

        {einladen && (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-[11px] text-[var(--muted-foreground)]">
              {ADMIN_TEXTE.feldEmail}
              <input className={feldCls} value={einladung.email} onChange={(e) => setEinladung({ ...einladung, email: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-[var(--muted-foreground)]">
              {ADMIN_TEXTE.feldName}
              <input className={feldCls} value={einladung.name} onChange={(e) => setEinladung({ ...einladung, name: e.target.value })} />
            </label>
            <p className="text-[11px] text-[var(--muted-foreground)]">{ADMIN_TEXTE.tools}</p>
            <Haken alle={WERKZEUGE} gewaehlt={einladung.tools} name={(w) => ADMIN_TEXTE.werkzeug[w]} onChange={(tools) => setEinladung({ ...einladung, tools })} />
            <p className="text-[11px] text-[var(--muted-foreground)]">{ADMIN_TEXTE.events}</p>
            <Haken alle={daten.iveo.map((e) => e.key)} gewaehlt={einladung.events} name={eventName} onChange={(events) => setEinladung({ ...einladung, events })} />
            <label className="flex flex-col gap-1 text-[11px] text-[var(--muted-foreground)]">
              {ADMIN_TEXTE.zugangBis}
              <input type="date" className={feldCls} value={einladung.bis} onChange={(e) => setEinladung({ ...einladung, bis: e.target.value })} />
            </label>
            <div className="flex justify-end">
              <Button size="sm" variant="primary" disabled={busy || !einladung.email.trim()} onClick={einladenSenden}>
                {ADMIN_TEXTE.einladenKnopf}
              </Button>
            </div>
          </div>
        )}

        {zugang && formular && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-extrabold">
              {zugang.name || zugang.email} <span className="font-normal text-[var(--muted-foreground)]">{zugang.email}</span>
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              {zugangDetails(zugang, eventName, jetzt).map((z) => (
                <Fragment key={z.bezeichner}>
                  <dt className="text-[var(--muted-foreground)]">{z.bezeichner}</dt>
                  <dd className="break-words">{z.wert}</dd>
                </Fragment>
              ))}
            </dl>
            {zugang.ersterAdmin ? (
              <p className="text-xs text-[var(--muted-foreground)]">{ADMIN_TEXTE.ersterAdminFest}</p>
            ) : (
              <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
                <label className="flex flex-col gap-1 text-[11px] text-[var(--muted-foreground)]">
                  {ADMIN_TEXTE.stufe}
                  <select className={feldCls} value={formular.stufe} onChange={(e) => setFormular({ ...formular, stufe: e.target.value as Stufe })}>
                    {STUFEN.map((s) => (
                      <option key={s} value={s}>
                        {STUFE_TEXT[s]}
                      </option>
                    ))}
                  </select>
                </label>
                {extern && (
                  <>
                    <p className="text-[11px] text-[var(--muted-foreground)]">{ADMIN_TEXTE.tools}</p>
                    <Haken alle={WERKZEUGE} gewaehlt={formular.tools} name={(w) => ADMIN_TEXTE.werkzeug[w]} onChange={(tools) => setFormular({ ...formular, tools })} />
                    <p className="text-[11px] text-[var(--muted-foreground)]">{ADMIN_TEXTE.events}</p>
                    <Haken alle={daten.iveo.map((e) => e.key)} gewaehlt={formular.events} name={eventName} onChange={(events) => setFormular({ ...formular, events })} />
                  </>
                )}
                <label className="flex flex-col gap-1 text-[11px] text-[var(--muted-foreground)]">
                  {ADMIN_TEXTE.zugangBis}
                  <input type="date" className={feldCls} value={formular.bis} onChange={(e) => setFormular({ ...formular, bis: e.target.value })} />
                </label>
                {extern && (
                  <>
                    <label className="flex flex-col gap-1 text-[11px] text-[var(--muted-foreground)]">
                      {ADMIN_TEXTE.zoomBis}
                      <input type="date" className={feldCls} value={formular.zoomBis} onChange={(e) => setFormular({ ...formular, zoomBis: e.target.value })} />
                    </label>
                    {/* M48 (EP34): Connect nutzt Cloud-Raum und Zoom-Freigabe erst mit Teil 2. */}
                    <p className="text-[11px] text-[var(--muted-foreground)]">{ADMIN_TEXTE.connectTeil1}</p>
                  </>
                )}
                {frage ? (
                  <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] p-3">
                    <p className="text-xs">{frage === 'loeschen' ? loeschFrage(zugang).text : ADMIN_TEXTE.frageNeuerCode}</p>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setFrage(null)}>
                        {ADMIN_TEXTE.abbrechen}
                      </Button>
                      {frage === 'loeschen' ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy}
                          onClick={() =>
                            void fuehreAus({ aktion: 'zugang-loeschen', kid: zugang.kid }, () => {
                              // Z1: ein gesperrtes Google-Konto bleibt in der Liste; das Detail bleibt offen und bestätigt (M16).
                              if (loeschenSchliesstDetail(zugang)) setAuswahl(null);
                              else setMeldung(ADMIN_TEXTE.gespeichert(zugang.name || zugang.email));
                            })
                          }
                        >
                          {loeschFrage(zugang).ja}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy}
                          onClick={() => void fuehreAus({ aktion: 'neuer-code', kid: zugang.kid }, (e) => setCode({ name: zugang.name || zugang.email, ergebnis: e }))}
                        >
                          {ADMIN_TEXTE.jaNeuerCode}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-end gap-2">
                    {zugang.bis !== null && zugang.bis <= jetzt && (
                      <Button size="sm" variant="outline" onClick={() => setFormular({ ...formular, bis: verlaengertBis(jetzt) })}>
                        {ADMIN_TEXTE.verlaengern}
                      </Button>
                    )}
                    {zugang.zustand === 'gesperrt' && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void fuehreAus({ aktion: 'entsperren', kid: zugang.kid }, () => setMeldung(null))}>
                        {ADMIN_TEXTE.entsperren}
                      </Button>
                    )}
                    {zugang.art === 'passwort' && (
                      <Button size="sm" variant="outline" onClick={() => setFrage('code')}>
                        {ADMIN_TEXTE.neuerCode}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setFrage('loeschen')}>
                      {ADMIN_TEXTE.loeschen}
                    </Button>
                    <Button size="sm" variant="primary" disabled={busy} onClick={speichern}>
                      {ADMIN_TEXTE.speichern}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Zoom-Meeting in der Zoom-Spalte (Spec 9; UX Welle 2b, Connect d2; B19, B20): Titel und Statuszeile, Antwort am Ort „karte“, der
// Meldungsbereich, Beitritt (bereit, fehler) bzw. „Meeting verlassen“ und „Abbrechen“ (Z3–Z11) und der Bild-Versatz. Bis Task 24 war
// das die ganze Zoom-Karte; seit B20 hält die Wurzel-View das Abbild (es kommt als `a`), die laufenden Aufrufe und die Antwort
// (ZoomAufrufe), die Einrichtung steht im Panel (ZoomEinrichtung.tsx), Slots, Teilnehmer, Messwerte, Hinweise und Fußzeile baut
// die Spalte (views/ZoomSpalte.tsx). Statustexte und Knopflogik kommen aus @shared/zoom-text (dieselbe Quelle wie Tray und
// Statusleiste), Fehlertexte aus dem Main (ZoomErgebnis.text, abbild.meldung). Der Kenncode lebt hier nur bis zum Klick auf
// „Beitreten“ (Spec 5.7). Bewusst NICHT wiederverwendet: TallyButton, GuestActions, PhaseBadge (kein Tally, kein Talkback, keine
// Phasen). Knöpfe aus @jm/ui, Farben als Tokens (W2-9).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@jm/ui';
import type { ZoomAbbild, ZoomLetztesMeeting } from '@shared/types';
import {
  kartenZeile,
  versatzUebernommen,
  versatzZeile,
  zoomKnoepfe,
  verlassenFrage as verlassenFrageText,
  KENNCODE_GESPEICHERT,
  KENNCODE_NICHT_GESPEICHERT,
  KENNCODE_SITZUNG,
  kenncodePlatzhalter,
  SLOT_FELD,
  VERGESSEN,
  VERGESSEN_TITEL,
} from '@shared/zoom-text';
import { antwortAm, ohneText, type ZoomAufrufe } from './aufrufe';
import { STIL } from './SlotEinstellungen';

// Hinweistext wörtlich aus Spec 8 und 9 (der Renderer importiert klartext.ts nicht).
const TEXT_Q13 = 'Bild-Versatz: erlaubt sind ganze Zahlen von 0 bis 1000 ms.';
type MeldungsArt = NonNullable<ZoomAbbild['meldung']>['art'];

/** Meldungsbereich je Art: die Farbe nur an Rand und Fläche, die Schrift in Vordergrundfarbe (W2-9). */
const MELDUNG_FARBE: Record<MeldungsArt, string> = {
  info: 'border-[var(--border)] bg-[var(--muted)]',
  warnung: 'border-[var(--status-warn)]/60 bg-[var(--status-warn)]/10',
  fehler: 'border-[var(--status-error)]/60 bg-[var(--status-error)]/10',
};

/** Titel der Zoom-Spalte; auch vor dem ersten Abbild (ZoomSpalte). */
export const ZOOM_TITEL = 'Zoom-Meeting';

export function ZoomCard({ a, zoom }: { a: ZoomAbbild; zoom: ZoomAufrufe }): JSX.Element {
  const { laeuft, fuehreAus } = zoom;
  const [jetzt, setJetzt] = useState(() => Date.now());
  const [nummer, setNummer] = useState('');
  const [kenncode, setKenncode] = useState('');
  /** #290: das gemerkte Meeting; den Kenncode selbst kennt die Spalte nie, nur ob der Kern einen hält. */
  const [letztes, setLetztes] = useState<ZoomLetztesMeeting | null>(null);
  /**
   * „Vergessen“ scheiterte an der Platte (TEXT_VERGESSEN_FEHLER): Der Kern hat nichts mehr gemerkt, der Knopf bleibt trotzdem,
   * damit „Bitte erneut versuchen“ einen Weg hat. Ein gelungenes „Vergessen“ hebt das auf.
   */
  const [vergessenErneut, setVergessenErneut] = useState(false);
  /** null = noch nicht angefasst, dann gilt der gespeicherte Anzeigename aus dem Abbild. */
  const [anzeigename, setAnzeigename] = useState<string | null>(null);
  /** null = unverändert, dann gilt der gespeicherte Versatz aus dem Abbild. */
  const [versatz, setVersatz] = useState<string | null>(null);
  const [versatzFehler, setVersatzFehler] = useState<string | null>(null);
  const [verlassenFrage, setVerlassenFrage] = useState(false);

  // Abrufe des gemerkten Meetings: Nur die Antwort auf die neueste Anfrage zählt (eine ältere, später eintreffende hielte einen
  // überholten Stand), und nach dem Aushängen setzt keine mehr etwas.
  const letztesAbruf = useRef(0);
  const eingehaengt = useRef(true);
  useEffect(() => {
    eingehaengt.current = true;
    return () => {
      eingehaengt.current = false;
    };
  }, []);
  const holeLetztes = useCallback((): void => {
    const abruf = ++letztesAbruf.current;
    window.jmconnect
      .zoomLetztesMeeting()
      .then((l) => {
        if (!eingehaengt.current || abruf !== letztesAbruf.current) return;
        setLetztes(l);
        // Vorfüllen nur, wenn das Feld leer ist: eine laufende Eingabe bleibt unberührt.
        if (l.nummer) setNummer((alt) => (alt === '' ? (l.nummer as string) : alt));
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    holeLetztes();
  }, [holeLetztes]);
  // Nach jedem Wechsel nach bereit/fehler (z. B. nach „Schließen“) neu holen.
  const zustandJetzt = a.kurz.zustand;
  const zustandVorher = useRef(zustandJetzt);
  useEffect(() => {
    const vorher = zustandVorher.current;
    zustandVorher.current = zustandJetzt;
    if (vorher !== zustandJetzt && (zustandJetzt === 'bereit' || zustandJetzt === 'fehler')) holeLetztes();
  }, [zustandJetzt, holeLetztes]);

  // Countdown der Statuszeile (Z11): nur ticken, solange ein Zeitpunkt ansteht.
  const naechsterUm = a.abriss?.naechsterUm ?? null;
  useEffect(() => {
    if (naechsterUm === null) return;
    setJetzt(Date.now());
    const t = setInterval(() => setJetzt(Date.now()), 250);
    return () => clearInterval(t);
  }, [naechsterUm]);

  const kn = useMemo(() => zoomKnoepfe(a), [a]);
  const verlassenMoeglich = kn.verlassen;
  useEffect(() => {
    if (!verlassenMoeglich) setVerlassenFrage(false);
  }, [verlassenMoeglich]);

  const k = a.kurz;
  // Slot-Spec 7.5 Nr. 5/6: Die Verlassen-Rückfrage hängt an n = laufende Slots (T80).
  const n = k.slotsLaufen;
  const frage = verlassenFrage && n > 0;

  const beitreten = (): void => {
    const code = kenncode;
    setKenncode(''); // Spec 9 Punkt 4: nach dem Klick leert der Renderer das Kenncode-Feld
    const name = anzeigename ?? a.anzeigename;
    void fuehreAus('beitreten', 'beitritt', () =>
      window.jmconnect.zoomBeitreten({ nummer, kenncode: code, anzeigename: name }),
    );
  };

  const platzhalter = kenncodePlatzhalter(nummer, kenncode, letztes);
  const kenncodePlatzhalterText =
    platzhalter === 'gespeichert' ? KENNCODE_GESPEICHERT : platzhalter === 'sitzung' ? KENNCODE_SITZUNG : undefined;

  // „Vergessen“ nicht, während ein Beitritt oder „Schließen“ läuft; „Beitreten“ nicht, während „Vergessen“ läuft.
  const vergessenGesperrt = laeuft.has('vergessen') || laeuft.has('beitreten') || laeuft.has('schliessen');
  const beitretenGesperrt = kn.beitretenGesperrt || laeuft.has('beitreten') || laeuft.has('vergessen');

  const vergessen = (): void => {
    // fuehreAus zeigt ein Scheitern (TEXT_VERGESSEN_FEHLER oder einen IPC-Fehler) am Ort „beitritt“; die Felder bleiben dann.
    void fuehreAus('vergessen', 'beitritt', () => window.jmconnect.zoomVergessen()).then((r) => {
      setVergessenErneut(!r.ok);
      if (r.ok) {
        setNummer('');
        setKenncode('');
        setLetztes(null);
      }
      holeLetztes();
    });
  };

  const verlassen = (): void => {
    if (n > 0 && !verlassenFrage) {
      setVerlassenFrage(true); // erster Klick: T80 „Ja, verlassen (n Slots laufen)“
      return;
    }
    setVerlassenFrage(false);
    void fuehreAus('verlassen', null, () => ohneText(window.jmconnect.zoomVerlassen()));
  };

  // Spec 6.7: ungültig → Feld rot, Text Q13, nichts gesendet.
  const uebernimmVersatz = (): void => {
    if (versatz === null) return;
    const roh = versatz.trim();
    const ms = Number(roh);
    if (roh === '' || !Number.isInteger(ms) || ms < 0 || ms > 1000) {
      setVersatzFehler(TEXT_Q13);
      return;
    }
    void fuehreAus('versatz', null, () => window.jmconnect.zoomVersatz({ ms })).then((r) => {
      // „Nur für diese Sitzung gemerkt“ (L14) ist kein Fehler: Der Wert gilt; dass er einen Neustart nicht
      // übersteht, steht dauerhaft unter dem Feld (versatzZeile). Die Regel steckt getestet in versatzUebernommen.
      if (versatzUebernommen(r)) {
        setVersatz(null);
        setVersatzFehler(null);
      } else if (!r.ok && r.text) {
        setVersatzFehler(r.text);
      }
    });
  };

  const m = a.meldung;
  const mk = kn.meldung;
  const karteAntwort = antwortAm(zoom, 'karte');
  const beitrittAntwort = antwortAm(zoom, 'beitritt');
  const feld = 'mt-1 block w-full';

  return (
    <>
      {/* 1 · Titel und Statuszeile (Spec 7.2, Kartentext) */}
      <div data-connect="zoom-kopf" className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{ZOOM_TITEL}</h2>
        <p className="text-right text-xs text-[var(--foreground)] select-text">{kartenZeile(a, jetzt) ?? ''}</p>
      </div>
      {karteAntwort && <p className={STIL.fehler}>{karteAntwort}</p>}

      {/* 2 · Meldungsbereich: in jedem Zustand, bis quittiert */}
      {m && mk && (
        <div data-connect="zoom-meldung" className={`rounded-[var(--radius-md)] border p-3 text-[var(--foreground)] ${MELDUNG_FARBE[m.art]}`}>
          <p className="text-sm font-semibold select-text">{m.text}</p>
          {m.detail && <p className="mt-1 font-mono text-[11px] opacity-80 select-text">{m.detail}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {mk.erneut && (
              <Button
                size="sm"
                uppercase={false}
                variant="primary"
                disabled={laeuft.has('erneut')}
                onClick={() => void fuehreAus('erneut', 'karte', () => window.jmconnect.zoomErneut())}
              >
                Erneut beitreten
              </Button>
            )}
            {mk.schliessen && (
              <Button
                size="sm"
                uppercase={false}
                variant="outline"
                onClick={() => {
                  // #290 löst N4b.3 Nr. 5 ab: „Schließen“ leert das Feld; der Abruf beim Wechsel nach „bereit“ füllt es mit dem frisch geholten gemerkten Meeting
                  // (`letztes` kann während des Meetings noch das vorherige halten). Im Z2-Fall bleibt der Zustand `bereit`: dann holt erst der Abruf nach dem Aufruf.
                  setNummer('');
                  void fuehreAus('schliessen', 'karte', () => ohneText(window.jmconnect.zoomSchliessen())).then(() => holeLetztes());
                }}
              >
                Schließen
              </Button>
            )}
            {mk.ok && (
              <Button size="sm" uppercase={false} variant="outline" onClick={() => void fuehreAus('ok', 'karte', () => ohneText(window.jmconnect.zoomMeldungWeg()))}>
                OK
              </Button>
            )}
            {mk.logordner && (
              <Button size="sm" uppercase={false} variant="outline" onClick={() => void fuehreAus('logordner', null, () => ohneText(window.jmconnect.zoomLogordner()))}>
                Logordner öffnen
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 3 · Die Einrichtung steht seit Task 24 im Panel (ZoomEinrichtung.tsx, B20); bei einem Mangel öffnet sie der Statuseintrag. */}

      {/* 4 · Beitritt (bereit, fehler) */}
      {kn.beitrittSichtbar && (
        <form
          data-connect="zoom-beitritt"
          className="grid gap-2 @[34rem]:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!beitretenGesperrt) beitreten();
          }}
        >
          <label className="text-xs text-[var(--muted-foreground)]">
            Meeting-Nummer
            <input value={nummer} onChange={(e) => setNummer(e.target.value)} inputMode="numeric" autoComplete="off" className={`${STIL.inp} ${feld}`} />
          </label>
          <label className="text-xs text-[var(--muted-foreground)]">
            Kenncode
            <input
              type="password"
              value={kenncode}
              onChange={(e) => setKenncode(e.target.value)}
              placeholder={kenncodePlatzhalterText}
              autoComplete="off"
              className={`${STIL.inp} ${feld}`}
            />
            {letztes?.kenncodeNichtGespeichert && <span className="mt-1 block">{KENNCODE_NICHT_GESPEICHERT}</span>}
          </label>
          <label className="text-xs text-[var(--muted-foreground)]">
            Anzeigename in Zoom
            <input value={anzeigename ?? a.anzeigename} onChange={(e) => setAnzeigename(e.target.value)} autoComplete="off" className={`${STIL.inp} ${feld}`} />
          </label>
          <div className="flex flex-wrap items-center gap-3 @[34rem]:col-span-3">
            <Button type="submit" size="sm" uppercase={false} variant="primary" disabled={beitretenGesperrt}>
              Beitreten
            </Button>
            {(letztes?.nummer || vergessenErneut) && (
              <Button type="button" size="sm" uppercase={false} variant="outline" title={VERGESSEN_TITEL} disabled={vergessenGesperrt} onClick={vergessen}>
                {VERGESSEN}
              </Button>
            )}
            {beitrittAntwort && <span className={STIL.fehler}>{beitrittAntwort}</span>}
          </div>
        </form>
      )}

      {/* 5 · Laufend (Z3–Z11). 6 · Nur in Z11 zusätzlich „Abbrechen“: Wiederbeitritt beenden, die Daten für „Erneut beitreten“ bleiben (Spec 6.8). */}
      {kn.verlassen && (
        <div data-connect="zoom-laufend" className="flex flex-wrap gap-2">
          <Button size="sm" uppercase={false} variant={frage ? 'destructive' : 'outline'} disabled={laeuft.has('verlassen')} onClick={verlassen}>
            {frage ? verlassenFrageText(n) : 'Meeting verlassen'}
          </Button>
          {kn.abbrechen && (
            <Button
              size="sm"
              uppercase={false}
              variant="outline"
              disabled={laeuft.has('abbrechen')}
              onClick={() => void fuehreAus('abbrechen', 'karte', () => ohneText(window.jmconnect.zoomAbbrechen()))}
            >
              Abbrechen
            </Button>
          )}
        </div>
      )}

      {/* 7 · Bild-Versatz (Spec 6.7) */}
      <div data-connect="zoom-versatz">
        <label className="block text-xs text-[var(--muted-foreground)]">
          Bild-Versatz (ms)
          <input
            type="number"
            min={0}
            max={1000}
            step={1}
            value={versatz ?? String(a.versatz.gewuenschtMs)}
            onChange={(e) => {
              setVersatz(e.target.value);
              setVersatzFehler(null);
            }}
            onBlur={uebernimmVersatz}
            onKeyDown={(e) => {
              if (e.key === 'Enter') uebernimmVersatz();
            }}
            className={`${versatzFehler ? STIL.inp.replace('border-[var(--field-border)]', 'border-[var(--status-error)]') : STIL.inp} mt-1 block w-32`}
          />
        </label>
        {/* „bestätigt: … ms“ bzw. „gilt ab dem nächsten Beitritt“; nur für die Sitzung gemerkt zusätzlich als Warnung (L14). */}
        {versatzZeile(a).map((z, i) => (
          <p key={z} className={`mt-1 ${i === 0 ? STIL.hinweis : STIL.warnung}`}>
            {z}
          </p>
        ))}
        <p className={`mt-1 ${STIL.hinweis}`}>{SLOT_FELD.versatzZusatz}</p>
        {versatzFehler && <p className={`mt-1 ${STIL.fehler}`}>{versatzFehler}</p>}
      </div>
    </>
  );
}

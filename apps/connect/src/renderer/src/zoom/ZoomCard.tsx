// Zoom-Karte (Spec 9): Einrichtung, Beitritt, Teilnehmer und Quellen. Sie steht in App.tsx außerhalb
// des Raum-Zweigs und erscheint nur unter Windows. Statustexte und Knopflogik kommen aus
// @shared/zoom-text (dieselbe Quelle wie Tray und Kopfzeile), Fehlertexte aus dem Main
// (ZoomErgebnis.text, abbild.meldung). Der Kenncode lebt hier nur bis zum Klick auf „Beitreten“ (Spec 5.7).
// Bewusst NICHT wiederverwendet: PttButton, GuestActions, PhaseBadge (kein Tally, kein Talkback, keine Phasen).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ZoomAbbild, ZoomErgebnis, ZoomParticipant } from '@shared/types';
import {
  einrichtungsTextArt,
  kartenZeile,
  sdkBalken,
  sdkKnopf,
  sdkLadenZeile,
  sdkSchluesselZeile,
  sdkZeile,
  TEXT_S11,
  versatzUebernommen,
  versatzZeile,
  zoomKnoepfe,
  verlassenFrage as verlassenFrageText,
  zugangZeile,
} from '@shared/zoom-text';

// Zoom-Slots (Connect 0.4.0, Task B21): Slot-Bereich, Angabe je Teilnehmerzeile, Nachfrage ab dem 6. Slot. Texte aus @shared/zoom-text.
import {
  KANDIDAT_KENNZEICHEN,
  KENNCODE_GESPEICHERT,
  KENNCODE_NICHT_GESPEICHERT,
  kenncodePlatzhalterZeigen,
  SLOT_FELD,
  VERGESSEN,
  VERGESSEN_TITEL,
} from '@shared/zoom-text';
import { SlotBereich, TeilnehmerSlotAngabe } from './SlotBereich';
import { NachfrageZeile } from './SlotKachel';
import { istNachfrage, type SlotAufrufe, type SlotNachfrage, type SlotOrt } from './SlotEinstellungen';

import { Messwerte } from './Messwerte';

// Tooltip- und Hinweistexte wörtlich aus Spec 8 und 9 (der Renderer importiert klartext.ts nicht). TEXT_S10 ist
// neu gefasst und steht wörtlich in Spec 2026-10-06 (Zoom-SDK nachladen), Abschnitt 5 (Owner 06.10.2026).
// Q10, Q11, Q14 und Q15 an der Teilnehmerzeile entfallen mit den Quellen (Spec 9.7, Plan B, Task B11); Q15 lebt als T98 am
// Knopf „Als Slot laden“ weiter (Task B21).
const TEXT_S10 = 'Während Zoom läuft oder das Zoom-SDK geladen oder kopiert wird, lässt sich die Einrichtung nicht ändern.';
const TEXT_Q13 = 'Bild-Versatz: erlaubt sind ganze Zahlen von 0 bis 1000 ms.';
const SPERR_HINWEIS = 'Zoom ist gesperrt, bis SDK-Ordner und Zugangsdaten vollständig eingerichtet sind.';
const FUSSZEILE = 'Zoom-Quellen haben kein Tally, kein Talkback und kein Mix-Minus — das sind Grenzen von Zoom.';

/** Wo eine abgelehnte Antwort (ZoomErgebnis.text) erscheint; 'karte' = unter der Statuszeile, auch für unerwartete IPC-Fehler. */
type Ort = 'karte' | 'einrichtung' | 'beitritt' | `zeile:${number}` | `slot:${number}` | 'slots';
type MeldungsArt = NonNullable<ZoomAbbild['meldung']>['art'];

const KARTE = 'mt-6 rounded-lg border border-neutral-700 bg-neutral-900 p-4';
const INP = 'w-full rounded border bg-neutral-950 px-2 py-1 text-sm text-neutral-100';
const KNOPF = 'rounded px-2 py-1 text-xs font-semibold disabled:opacity-40';
const RAND = `${KNOPF} border border-neutral-700 text-neutral-200 hover:bg-neutral-800`;
const GELB = `${KNOPF} bg-yellow-400 text-neutral-900`;
const ROT = `${KNOPF} bg-red-700 text-white`;
const MELDUNG_FARBE: Record<MeldungsArt, string> = {
  info: 'border-sky-800 bg-sky-950/40 text-sky-100',
  warnung: 'border-yellow-800 bg-yellow-950/40 text-yellow-100',
  fehler: 'border-red-800 bg-red-950/40 text-red-100',
};

/** Für Aufrufe ohne Ergebnis (verlassen, schließen …): einheitlich durch fuehreAus schicken. */
async function ohneText(p: Promise<void>): Promise<ZoomErgebnis> {
  await p;
  return { ok: true };
}

function Kennzeichen({ children, rot = false }: { children: string; rot?: boolean }): JSX.Element {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${rot ? 'bg-red-900 text-red-100' : 'bg-neutral-800 text-neutral-300'}`}
    >
      {children}
    </span>
  );
}

/** Gesperrte Knöpfe bekommen in Chromium keine Mausereignisse; der Tooltip sitzt darum am Rahmen. */
function MitTooltip({ titel, children }: { titel: string | undefined; children: JSX.Element }): JSX.Element {
  return (
    <span title={titel} className="inline-flex">
      {children}
    </span>
  );
}

/**
 * Zugangsdaten von Hand. Client-ID und Client-Secret stehen NUR im State dieser Komponente: Hängt sie aus
 * (Speichern, Abbrechen, Datei gewählt, Einrichtung zugeklappt), sind beide Werte und der Schalter weg.
 * A7 und andere Ablehnungen erscheinen hier am Formular, bis zum nächsten Speichern oder Zuklappen.
 */
function ZugangEingabe({
  gesperrt,
  speichern,
  zu,
}: {
  gesperrt: boolean;
  speichern: (clientId: string, clientSecret: string) => Promise<ZoomErgebnis>;
  zu: () => void;
}): JSX.Element {
  const [id, setId] = useState('');
  const [secret, setSecret] = useState('');
  const [zeigen, setZeigen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const absenden = (): void => {
    if (gesperrt) return;
    setFehler(null);
    void speichern(id, secret).then((r) => {
      if (r.ok) zu();
      else setFehler(r.text || null);
    });
  };
  return (
    <form
      className="mt-2 grid gap-2 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        absenden();
      }}
    >
      <label className="text-xs text-neutral-400">
        Client-ID
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className={`${INP} mt-1 border-neutral-700`}
        />
      </label>
      <div className="text-xs text-neutral-400">
        <label>
          Client-Secret
          <input
            type={zeigen ? 'text' : 'password'}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className={`${INP} mt-1 border-neutral-700`}
          />
        </label>
        <button type="button" onClick={() => setZeigen((z) => !z)} className={`${RAND} mt-1`}>
          {zeigen ? 'verbergen' : 'anzeigen'}
        </button>
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={gesperrt} className={GELB}>
          Speichern
        </button>
        <button type="button" onClick={zu} className={RAND}>
          Abbrechen
        </button>
        {fehler && <span className="text-xs text-red-300">{fehler}</span>}
      </div>
    </form>
  );
}

/**
 * SDK-Schlüssel von Hand (Spec SDK nachladen 4.5). Der Wert steht NUR im State dieser Komponente: Hängt sie aus
 * (Speichern, Abbrechen, Einrichtung zugeklappt), ist er weg. S18 und andere Ablehnungen erscheinen hier am Formular.
 */
function SchluesselEingabe({
  gesperrt,
  speichern,
  zu,
}: {
  gesperrt: boolean;
  speichern: (schluessel: string) => Promise<ZoomErgebnis>;
  zu: () => void;
}): JSX.Element {
  const [wert, setWert] = useState('');
  const [zeigen, setZeigen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const absenden = (): void => {
    if (gesperrt) return;
    setFehler(null);
    void speichern(wert).then((r) => {
      if (r.ok) zu();
      else setFehler(r.text || null);
    });
  };
  return (
    <form
      className="mt-2 grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        absenden();
      }}
    >
      <div className="text-xs text-neutral-400">
        <label>
          SDK-Schlüssel
          <input
            type={zeigen ? 'text' : 'password'}
            value={wert}
            onChange={(e) => setWert(e.target.value)}
            // Mehr nimmt der Main nicht an (pruefeSdkSchluesselEingabe): Ein längerer Text käme dort stumm als Nichts zurück.
            maxLength={512}
            autoComplete="off"
            spellCheck={false}
            className={`${INP} mt-1 border-neutral-700`}
          />
        </label>
        <button type="button" onClick={() => setZeigen((z) => !z)} className={`${RAND} mt-1`}>
          {zeigen ? 'verbergen' : 'anzeigen'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={gesperrt} className={GELB}>
          Speichern
        </button>
        <button type="button" onClick={zu} className={RAND}>
          Abbrechen
        </button>
        {fehler && <span className="text-xs text-red-300">{fehler}</span>}
      </div>
    </form>
  );
}

export function ZoomCard(): JSX.Element {
  const [abbild, setAbbild] = useState<ZoomAbbild | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const [nummer, setNummer] = useState('');
  const [kenncode, setKenncode] = useState('');
  /** #290: das gemerkte Meeting; den Kenncode selbst kennt die Karte nie, nur ob einer gespeichert ist. */
  const [letztes, setLetztes] = useState<{
    nummer: string | null;
    kenncodeGespeichert: boolean;
    kenncodeNichtGespeichert: boolean;
  } | null>(null);
  /** null = noch nicht angefasst, dann gilt der gespeicherte Anzeigename aus dem Abbild. */
  const [anzeigename, setAnzeigename] = useState<string | null>(null);
  /** null = unverändert, dann gilt der gespeicherte Versatz aus dem Abbild. */
  const [versatz, setVersatz] = useState<string | null>(null);
  const [versatzFehler, setVersatzFehler] = useState<string | null>(null);
  const [einrichtungAuf, setEinrichtungAuf] = useState(false);
  /** Zugangsdaten von Hand: Eingabe offen. Die Werte selbst leben nur in `ZugangEingabe` und verschwinden mit dem Aushängen. */
  const [handAuf, setHandAuf] = useState(false);
  /** SDK-Schlüssel von Hand: Eingabe offen. Der Wert selbst lebt nur in `SchluesselEingabe`. */
  const [schluesselAuf, setSchluesselAuf] = useState(false);
  const [verlassenFrage, setVerlassenFrage] = useState(false);
  const [antwort, setAntwort] = useState<{ ort: Ort; text: string } | null>(null);
  /** Nachfrage ab dem 6. Slot (Spec 7.4): T40 am Ort des Aufrufs; „Trotzdem einschalten“ wiederholt ihn mit trotz. */
  const [nachfrage, setNachfrage] = useState<SlotNachfrage | null>(null);
  /** Laufende Aufrufe (gegen Doppelklicks), je Knopf ein Schlüssel. */
  const [laeuft, setLaeuft] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    let lebt = true;
    window.jmconnect
      .zoomGet()
      .then((a) => {
        // Ein Push, der vor der Antwort kam, ist neuer: nicht überschreiben.
        if (lebt) setAbbild((alt) => alt ?? a);
      })
      .catch((e: unknown) => {
        if (lebt) setLadeFehler(e instanceof Error ? e.message : String(e));
      });
    const aus = window.jmconnect.onZoom((a) => setAbbild(a));
    return () => {
      lebt = false;
      aus();
    };
  }, []);

  const holeLetztes = useCallback((): void => {
    window.jmconnect
      .zoomLetztesMeeting()
      .then((l) => {
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
  const zustandJetzt = abbild?.kurz.zustand;
  const zustandVorher = useRef(zustandJetzt);
  useEffect(() => {
    const vorher = zustandVorher.current;
    zustandVorher.current = zustandJetzt;
    if (vorher !== zustandJetzt && (zustandJetzt === 'bereit' || zustandJetzt === 'fehler')) holeLetztes();
  }, [zustandJetzt, holeLetztes]);

  // Countdown der Statuszeile (Z11): nur ticken, solange ein Zeitpunkt ansteht.
  const naechsterUm = abbild?.abriss?.naechsterUm ?? null;
  useEffect(() => {
    if (naechsterUm === null) return;
    setJetzt(Date.now());
    const t = setInterval(() => setJetzt(Date.now()), 250);
    return () => clearInterval(t);
  }, [naechsterUm]);

  const knoepfe = useMemo(() => (abbild ? zoomKnoepfe(abbild) : null), [abbild]);
  const verlassenMoeglich = knoepfe?.verlassen ?? false;
  useEffect(() => {
    if (!verlassenMoeglich) setVerlassenFrage(false);
  }, [verlassenMoeglich]);
  // Klappt die Einrichtung zu (von Hand oder weil der letzte Mangel weg ist), schließt auch die Handeingabe.
  const einrichtungSichtbar = (knoepfe?.einrichtungOffen ?? false) || einrichtungAuf;
  useEffect(() => {
    if (!einrichtungSichtbar) {
      setHandAuf(false);
      setSchluesselAuf(false);
    }
  }, [einrichtungSichtbar]);

  /** Führt einen Aufruf aus; ein abgelehnter mit Text erscheint am Ort `ort` (null = nirgends, weil das Abbild ihn zeigt). */
  const fuehreAus = useCallback(
    async (schluessel: string, ort: Ort | null, f: () => Promise<ZoomErgebnis>): Promise<ZoomErgebnis> => {
      setAntwort(null);
      setLaeuft((s) => new Set(s).add(schluessel));
      try {
        const r = await f();
        if (!r.ok && r.text && ort !== null) setAntwort({ ort, text: r.text });
        return r;
      } catch (e) {
        const text = e instanceof Error ? e.message : String(e);
        setAntwort({ ort: ort ?? 'karte', text });
        return { ok: false, text };
      } finally {
        setLaeuft((s) => {
          const n = new Set(s);
          n.delete(schluessel);
          return n;
        });
      }
    },
    [],
  );

  if (!abbild || !knoepfe) {
    return (
      <section className={KARTE}>
        <h2 className="text-sm font-semibold">Zoom-Meeting</h2>
        {ladeFehler && <p className="mt-2 text-xs text-red-300">{ladeFehler}</p>}
      </section>
    );
  }

  const a = abbild;
  const kn = knoepfe;
  const k = a.kurz;
  const sdk = a.einrichtung.sdk;
  const zugang = a.einrichtung.zugang;
  const zugangText = zugangZeile(a);
  // Slot-Spec 7.5 Nr. 5/6: Die Verlassen-Rückfrage hängt an n = laufende Slots (T80).
  const n = k.slotsLaufen;
  const frage = verlassenFrage && n > 0;
  const sperrTitel = kn.einrichtungAenderbar ? undefined : TEXT_S10;
  const zugangEntfernbar =
    zugang.herkunft === 'stored' || zugang.herkunft === 'session' || k.maengel.includes('zugang_unlesbar');
  const antwortText = (ort: Ort): string | null => (antwort && antwort.ort === ort ? antwort.text : null);
  const einrichtungAntwort = antwortText('einrichtung');
  // „Zoom-SDK laden“: Tooltip S10 wie die Ordnerwahl, ohne Schlüssel S11 (Spec SDK nachladen 4.5).
  const ladenTitel = kn.sdkLaden === 'gesperrt' ? TEXT_S10 : kn.sdkLaden === 'ohneSchluessel' ? TEXT_S11 : undefined;
  // Ein Balken für beide Abschnitte: erst der Download, danach die bestehende Kopie (sdkBalken, Aufgabe 8).
  const balken = sdkBalken(sdk);
  // S17 ist ein Hinweis (grau), alles andere rot (Spec SDK nachladen 4.3) — auch als Antwort, bevor das Abbild kommt.
  const textFarbe = (t: string): string => (einrichtungsTextArt(t) === 'hinweis' ? 'text-neutral-400' : 'text-red-300');

  const beitreten = (): void => {
    const code = kenncode;
    setKenncode(''); // Spec 9 Punkt 4: nach dem Klick leert der Renderer das Kenncode-Feld
    const name = anzeigename ?? a.anzeigename;
    void fuehreAus('beitreten', 'beitritt', () =>
      window.jmconnect.zoomBeitreten({ nummer, kenncode: code, anzeigename: name }),
    );
  };

  const kenncodeGemerkt = kenncodePlatzhalterZeigen(nummer, kenncode, letztes);

  const vergessen = async (): Promise<void> => {
    setLaeuft((l) => new Set(l).add('vergessen'));
    try {
      await window.jmconnect.zoomVergessen();
      setNummer('');
      setKenncode('');
      setLetztes(null);
      holeLetztes();
    } finally {
      setLaeuft((l) => {
        const n2 = new Set(l);
        n2.delete('vergessen');
        return n2;
      });
    }
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

  // Teilnehmerzeile ohne Ton-Schalter, ohne die Knöpfe und Zeilen der Quellen (Spec 7.5 Nr. 9, Plan B, Task B11);
  // „Als Slot laden“ und die Angaben T39–T39d kommen mit Task B21.
  const zeile = (t: ZoomParticipant): JSX.Element => {
    const ort: Ort = `zeile:${t.id}`;
    const text = antwortText(ort);
    return (
      <li key={t.id} className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{t.name}</span>
          {t.rolle === 'host' && <Kennzeichen>{KANDIDAT_KENNZEICHEN.host}</Kennzeichen>}
          {t.rolle === 'coHost' && <Kennzeichen>Co-Host</Kennzeichen>}
          {t.kamera === 'aus' && <Kennzeichen>{KANDIDAT_KENNZEICHEN.kameraAus}</Kennzeichen>}
          {t.kamera === 'keine' && <Kennzeichen>keine Kamera</Kennzeichen>}
          {t.imWarteraum && <Kennzeichen>{KANDIDAT_KENNZEICHEN.imWarteraum}</Kennzeichen>}
          {t.doppelname && <Kennzeichen rot>Name doppelt</Kennzeichen>}
          {/* Spec 7.5 Nr. 9, 10.10: „Als Slot laden“ (T38, im Warteraum T98) bzw. die Angaben T39–T39d. */}
          <span className="ml-auto flex items-center gap-2">
            <TeilnehmerSlotAngabe t={t} a={a} imMeeting={imMeeting} aufrufe={slotAufrufe} />
          </span>
        </div>
        {text && <p className="mt-1 text-xs text-red-300">{text}</p>}
        <NachfrageZeile aufrufe={slotAufrufe} ort={`zeile:${t.id}`} />
      </li>
    );
  };

  /** Im Meeting: „Als Slot laden“ ist nur dann bedienbar (Spec 7.5 Nr. 9; die Zeile aus 0.3.0 nahm Task B11 mit den Lade-Knöpfen). */
  const imMeeting = k.zustand === 'im_meeting';
  // Zoom-Slots (Spec 7.5 Nr. 8, 9; 7.4): ein Doppelklick-Schutz (laeuft), ein Antwortort (antwort) und eine Nachfrage für
  // Slot-Bereich, Kacheln und Teilnehmerliste. starte: Antwort mit nachfrage → T40 am Ort; sonst wie fuehreAus.
  const starte = (schluessel: string, ort: SlotOrt, f: (trotz: boolean) => Promise<ZoomErgebnis>, trotz = false): void => {
    setNachfrage(null);
    void fuehreAus(schluessel, null, () => f(trotz)).then((r) => {
      if (istNachfrage(r)) setNachfrage({ ort, text: r.text, trotzdem: () => starte(schluessel, ort, f, true) });
      else if (!r.ok && r.text) setAntwort({ ort, text: r.text });
    });
  };
  const slotAufrufe: SlotAufrufe = {
    laeuft,
    fuehreAus: (schluessel, ort, f) => fuehreAus(schluessel, ort, f),
    starte: (schluessel, ort, f) => starte(schluessel, ort, f),
    antwortText: (ort) => antwortText(ort),
    nachfrage,
    nachfrageWeg: () => setNachfrage(null),
  };

  const m = a.meldung;
  const mk = kn.meldung;

  return (
    <section className={KARTE}>
      {/* 1 · Titel und Statuszeile (Spec 7.2, Kartentext) */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">Zoom-Meeting</h2>
        <p className="text-right text-xs text-neutral-300">{kartenZeile(a, jetzt) ?? ''}</p>
      </div>
      {antwortText('karte') && <p className="mb-3 text-xs text-red-300">{antwortText('karte')}</p>}

      {/* 2 · Meldungsbereich: in jedem Zustand, bis quittiert */}
      {m && mk && (
        <div className={`mb-3 rounded-lg border p-3 ${MELDUNG_FARBE[m.art]}`}>
          <p className="text-sm font-semibold">{m.text}</p>
          {m.detail && <p className="mt-1 font-mono text-[11px] opacity-80">{m.detail}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {mk.erneut && (
              <button
                disabled={laeuft.has('erneut')}
                onClick={() => void fuehreAus('erneut', 'karte', () => window.jmconnect.zoomErneut())}
                className={GELB}
              >
                Erneut beitreten
              </button>
            )}
            {mk.schliessen && (
              <button
                onClick={() => {
                  // #290 löst N4b.3 Nr. 5 ab: „Schließen“ leert das Feld; der Abruf beim Wechsel nach „bereit“ füllt es mit dem frisch geholten gemerkten Meeting
                  // (`letztes` kann während des Meetings noch das vorherige halten).
                  setNummer('');
                  void fuehreAus('schliessen', 'karte', () => ohneText(window.jmconnect.zoomSchliessen()));
                }}
                className={RAND}
              >
                Schließen
              </button>
            )}
            {mk.ok && (
              <button
                onClick={() => void fuehreAus('ok', 'karte', () => ohneText(window.jmconnect.zoomMeldungWeg()))}
                className={RAND}
              >
                OK
              </button>
            )}
            {mk.logordner && (
              <button
                onClick={() => void fuehreAus('logordner', null, () => ohneText(window.jmconnect.zoomLogordner()))}
                className={RAND}
              >
                Logordner öffnen
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3 · Einrichtung: eingeklappt, sobald es keine Mängel gibt */}
      {!kn.einrichtungOffen && (
        <button onClick={() => setEinrichtungAuf((v) => !v)} className={`${RAND} mb-3`}>
          Einrichtung
        </button>
      )}
      {einrichtungSichtbar && (
        <div className="mb-3 space-y-3 rounded-lg border border-neutral-800 p-3">
          {kn.sperrHinweis && <p className="text-xs text-yellow-200">{SPERR_HINWEIS}</p>}
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{sdkZeile(a)}</span>
              <span className="flex shrink-0 gap-2">
                <MitTooltip titel={sperrTitel}>
                  <button
                    disabled={!kn.einrichtungAenderbar || laeuft.has('sdk')}
                    onClick={() => void fuehreAus('sdk', 'einrichtung', () => window.jmconnect.zoomSdkWaehlen())}
                    className={RAND}
                  >
                    {sdkKnopf(a)}
                  </button>
                </MitTooltip>
                <MitTooltip titel={ladenTitel}>
                  <button
                    disabled={kn.sdkLaden !== 'frei' || laeuft.has('sdk')}
                    onClick={() => void fuehreAus('sdk', 'einrichtung', () => window.jmconnect.zoomSdkLaden())}
                    className={RAND}
                  >
                    Zoom-SDK laden
                  </button>
                </MitTooltip>
              </span>
            </div>
            {sdk.laden && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-xs text-neutral-300">{sdkLadenZeile(sdk.laden)}</span>
                <button
                  disabled={!kn.sdkLadenAbbrechen || laeuft.has('sdk-abbrechen')}
                  onClick={() => void fuehreAus('sdk-abbrechen', null, () => ohneText(window.jmconnect.zoomSdkLadenAbbrechen()))}
                  className={RAND}
                >
                  Abbrechen
                </button>
              </div>
            )}
            {balken !== null && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-neutral-800">
                <div className="h-full bg-yellow-400" style={{ width: `${balken}%` }} />
              </div>
            )}
            {/* S17 (abgebrochen) ist ein Hinweis, kein Fehler: grau statt rot (Spec SDK nachladen 4.3). */}
            {sdk.text && <p className={`mt-1 text-xs ${textFarbe(sdk.text)}`}>{sdk.text}</p>}
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{sdkSchluesselZeile(a)}</span>
              <span className="flex shrink-0 gap-2">
                <MitTooltip titel={sperrTitel}>
                  <button
                    disabled={!kn.einrichtungAenderbar || laeuft.has('sdk-schluessel')}
                    onClick={() => setSchluesselAuf(true)}
                    className={RAND}
                  >
                    Eintragen …
                  </button>
                </MitTooltip>
                {kn.sdkSchluesselEntfernbar && (
                  <MitTooltip titel={sperrTitel}>
                    <button
                      disabled={!kn.einrichtungAenderbar || laeuft.has('sdk-schluessel')}
                      onClick={() => void fuehreAus('sdk-schluessel', 'einrichtung', () => window.jmconnect.zoomSdkSchluesselLoeschen())}
                      className={RAND}
                    >
                      Entfernen
                    </button>
                  </MitTooltip>
                )}
              </span>
            </div>
            {schluesselAuf && (
              <SchluesselEingabe
                gesperrt={!kn.einrichtungAenderbar || laeuft.has('sdk-schluessel')}
                speichern={(schluessel) =>
                  fuehreAus('sdk-schluessel', null, () => window.jmconnect.zoomSdkSchluesselEintragen({ schluessel }))
                }
                zu={() => setSchluesselAuf(false)}
              />
            )}
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{zugangText}</span>
              <span className="flex shrink-0 gap-2">
                <MitTooltip titel={sperrTitel}>
                  <button
                    disabled={!kn.einrichtungAenderbar || laeuft.has('zugang')}
                    onClick={() =>
                      void fuehreAus('zugang', 'einrichtung', () => window.jmconnect.zoomZugangWaehlen()).then((r) => {
                        if (r.ok) setHandAuf(false); // Eingabe schließt sich, ihre Werte verschwinden mit ihr
                      })
                    }
                    className={RAND}
                  >
                    Datei wählen …
                  </button>
                </MitTooltip>
                <MitTooltip titel={sperrTitel}>
                  <button
                    disabled={!kn.einrichtungAenderbar || laeuft.has('zugang')}
                    onClick={() => setHandAuf(true)}
                    className={RAND}
                  >
                    Eintragen …
                  </button>
                </MitTooltip>
                {zugangEntfernbar && (
                  <MitTooltip titel={sperrTitel}>
                    <button
                      disabled={!kn.einrichtungAenderbar || laeuft.has('zugang')}
                      onClick={() => void fuehreAus('zugang', 'einrichtung', () => window.jmconnect.zoomZugangLoeschen())}
                      className={RAND}
                    >
                      Entfernen
                    </button>
                  </MitTooltip>
                )}
              </span>
            </div>
            {handAuf && (
              <ZugangEingabe
                gesperrt={!kn.einrichtungAenderbar || laeuft.has('zugang')}
                speichern={(clientId, clientSecret) =>
                  fuehreAus('zugang', null, () => window.jmconnect.zoomZugangEintragen({ clientId, clientSecret }))
                }
                zu={() => setHandAuf(false)}
              />
            )}
            {zugang.text && zugang.text !== zugangText && <p className="mt-1 text-xs text-red-300">{zugang.text}</p>}
          </div>
          {einrichtungAntwort && einrichtungAntwort !== sdk.text && einrichtungAntwort !== zugang.text && (
            <p className={`text-xs ${textFarbe(einrichtungAntwort)}`}>{einrichtungAntwort}</p>
          )}
          {kn.pruefen !== 'aus' && (
            <button
              disabled={kn.pruefen === 'laeuft' || laeuft.has('pruefen')}
              onClick={() => void fuehreAus('pruefen', null, () => window.jmconnect.zoomPruefen())}
              className={RAND}
            >
              {kn.pruefen === 'laeuft' ? 'Prüfe …' : 'Einrichtung prüfen'}
            </button>
          )}
        </div>
      )}

      {/* 4 · Beitritt (bereit, fehler) */}
      {kn.beitrittSichtbar && (
        <form
          className="mb-3 grid gap-2 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!kn.beitretenGesperrt && !laeuft.has('beitreten')) beitreten();
          }}
        >
          <label className="text-xs text-neutral-400">
            Meeting-Nummer
            <input
              value={nummer}
              onChange={(e) => setNummer(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              className={`${INP} mt-1 border-neutral-700`}
            />
          </label>
          <label className="text-xs text-neutral-400">
            Kenncode
            <input
              type="password"
              value={kenncode}
              onChange={(e) => setKenncode(e.target.value)}
              placeholder={kenncodeGemerkt ? KENNCODE_GESPEICHERT : undefined}
              autoComplete="off"
              className={`${INP} mt-1 border-neutral-700`}
            />
            {letztes?.kenncodeNichtGespeichert && (
              <span className="mt-1 block text-neutral-500">{KENNCODE_NICHT_GESPEICHERT}</span>
            )}
          </label>
          <label className="text-xs text-neutral-400">
            Anzeigename in Zoom
            <input
              value={anzeigename ?? a.anzeigename}
              onChange={(e) => setAnzeigename(e.target.value)}
              autoComplete="off"
              className={`${INP} mt-1 border-neutral-700`}
            />
          </label>
          <div className="flex items-center gap-3 sm:col-span-3">
            <button type="submit" disabled={kn.beitretenGesperrt || laeuft.has('beitreten')} className={GELB}>
              Beitreten
            </button>
            {letztes?.nummer && (
              <button
                type="button"
                title={VERGESSEN_TITEL}
                disabled={laeuft.has('vergessen')}
                onClick={() => void vergessen()}
                className={RAND}
              >
                {VERGESSEN}
              </button>
            )}
            {antwortText('beitritt') && <span className="text-xs text-red-300">{antwortText('beitritt')}</span>}
          </div>
        </form>
      )}

      {/* 5 · Laufend (Z3–Z11). 6 · Nur in Z11 zusätzlich „Abbrechen“: Wiederbeitritt beenden, die Daten für „Erneut beitreten“ bleiben (Spec 6.8). */}
      {kn.verlassen && (
        <div className="mb-3 flex flex-wrap gap-2">
          <button disabled={laeuft.has('verlassen')} onClick={verlassen} className={frage ? ROT : RAND}>
            {frage ? verlassenFrageText(n) : 'Meeting verlassen'}
          </button>
          {kn.abbrechen && (
            <button
              disabled={laeuft.has('abbrechen')}
              onClick={() => void fuehreAus('abbrechen', 'karte', () => ohneText(window.jmconnect.zoomAbbrechen()))}
              className={RAND}
            >
              Abbrechen
            </button>
          )}
        </div>
      )}

      {/* 7 · Bild-Versatz (Spec 6.7) */}
      <div className="mb-3">
        <label className="block text-xs text-neutral-400">
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
            className={`${INP} mt-1 block w-32 ${versatzFehler ? 'border-red-500' : 'border-neutral-700'}`}
          />
        </label>
        {/* „bestätigt: … ms“ bzw. „gilt ab dem nächsten Beitritt“; nur für die Sitzung gemerkt zusätzlich gelb (L14). */}
        {versatzZeile(a).map((z, i) => (
          <p key={z} className={`mt-1 text-xs ${i === 0 ? 'text-neutral-500' : 'text-yellow-200'}`}>
            {z}
          </p>
        ))}
        <p className="mt-1 text-xs text-neutral-500">{SLOT_FELD.versatzZusatz}</p>
        {versatzFehler && <p className="mt-1 text-xs text-red-300">{versatzFehler}</p>}
      </div>

      {/* 8 · Zoom-Slots (Spec 7.5 Nr. 8): Kopf, Vorgaben, Vorschau, Sprecher-Einstellungen, Kacheln */}
      <SlotBereich a={a} aufrufe={slotAufrufe} />

      {/* 8 · Teilnehmerliste (ohne eigene Zeile; Host und Co-Host zuerst, sortiert der Kern) */}
      {a.teilnehmer.length > 0 && <ul className="mb-3 space-y-2">{a.teilnehmer.map((t) => zeile(t))}</ul>}

      {/* 9 · Die Liste der gemerkten Quellen entfällt (Spec 7.5 Nr. 10, Plan B, Task B11); an ihre Stelle treten die Zoom-Slots (Task B21). */}

      {/* 11 · Messwerte (Spec 7.5 Nr. 11, 7.8): aufklappbar, eingeklappt als Vorgabe; Kopie ohne Namen */}
      <Messwerte a={a} />

      {/* 10 · Hinweise (die letzten 5) */}
      {a.hinweise.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-xs font-semibold text-neutral-400">Hinweise</div>
          <ul className="space-y-0.5 text-xs text-neutral-400">
            {a.hinweise.map((h, i) => (
              <li key={`${i}:${h}`}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 11 · Fußzeile */}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-800 pt-3 text-[11px] text-neutral-500">
        <span>{FUSSZEILE}</span>
        <button
          onClick={() => void fuehreAus('logordner', null, () => ohneText(window.jmconnect.zoomLogordner()))}
          className={`${RAND} shrink-0`}
        >
          Logordner öffnen
        </button>
      </div>
    </section>
  );
}

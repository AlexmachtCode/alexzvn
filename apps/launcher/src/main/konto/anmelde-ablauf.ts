// ─────────────────────────────────────────────────────────────────────────────
// Anmeldung im Launcher (Teil 1) · Anmelde-Ablauf mit Bestätigungscode (Plan 10.6, Verhalten 11.2 AA1–AA6; Spec 4.1, 11;
// EP5). Der Launcher legt beim Worker einen Vorgang an, öffnet die Anmeldeseite im System-Browser und fragt alle 2 s mit
// frischem Gerätebeweis nach, bis der Mensch im Browser „Ja, das ist mein Rechner“ (oder „Nein“) wählt oder der Code
// abläuft. Kein Rückkanal über jmps:// (die volle URL stünde in main.log, Ist-L 12). Der Code steht nur im Schritt
// `wartet` und geht nie in ein Log (AA6); das Abholgeheimnis verlässt dieses Modul nur zum Worker.
// Z2 (RFC 8252 loopback redirect): Vor dem Anlegen öffnet der Ablauf einen Rückkanal auf 127.0.0.1 (rueckkanal.ts) und meldet dessen
// Port; nach „Ja“ springt der Browser dorthin und bringt den Einmalwert e. Ab dann fragt der Ablauf mit e nach; ohne e gibt der
// Worker keine Sitzung heraus. Der Rückkanal schließt sich mit jedem Ende des Ablaufs (fertig, abgelehnt, abgelaufen, fehler,
// abgebrochen, stoppe). Vorübergehende Fehler beenden das Warten erst, wenn seit dem letzten Erfolg 60 s nur Fehler kamen.
// Kein electron-Import (G9): Browser, Uhr, Wecker, Client, Gerät und Rückkanal sind eingespeist.
// ─────────────────────────────────────────────────────────────────────────────
import { kurzName, type AnmeldeSchritt, type KontoFehlerCode } from '../../shared/konto';
import type { GeraetHandle } from './geraet';
import type { Rueckkanal } from './rueckkanal';
import type { GespeicherteSitzung } from './sitzung-kern';
import { KontoFehler, type KontoClient } from './worker-client';

export interface AnmeldeAblauf {
  starte(): Promise<void>; abbrechen(): Promise<void>; schritt(): AnmeldeSchritt; adresse(): string | null;
  /** Z2: beim Beenden des Launchers: Abfrage stoppen, Rückkanal schließen, beim Worker abbrechen (best effort), ohne Meldung. */
  stoppe(): void;
}

/** AA3: Abstand der Abfragen beim Worker. */
export const ABFRAGE_MS = 2000;
/** AA4 (Z2 Nr. 7): kommen seit dem letzten Erfolg so lange nur Netz- bzw. Serverfehler, endet das Warten mit `fehler`. */
export const FEHLER_BUDGET_MS = 60_000;
/** EP5: ein Vorgang lebt 5 min. Die Frist läuft auf der eigenen Uhr (Start + 5 min), nie gegen die Uhr des Workers (EP30). */
export const VORGANG_MS = 5 * 60_000;

const LAEUFT: ReadonlyArray<AnmeldeSchritt['art']> = ['startet', 'wartet'];
const VORUEBERGEHEND: readonly string[] = ['netz', 'server', 'zu-viele'];

export function erzeugeAnmeldeAblauf(u: {
  client: KontoClient; geraet: () => Promise<GeraetHandle | null>; jetzt(): number;
  wecker(ms: number, fn: () => void): () => void; oeffneBrowser(url: string): Promise<boolean>;
  /** Z2: Rückkanal auf 127.0.0.1 öffnen (Hülle: oeffneRueckkanal mit Log); `angenommen` bekommt den Einmalwert aus dem Sprung. */
  oeffneRueckkanal(o: { angenommen(e: string): void }): Promise<Pick<Rueckkanal, 'port' | 'setzeVorgang' | 'schliesse'>>;
  rechnerName: string; plattform: 'win' | 'mac'; arch: string; version: string;
  angemeldet(s: GespeicherteSitzung): void; melde(s: AnmeldeSchritt): void;
}): AnmeldeAblauf {
  let aktuell: AnmeldeSchritt = { art: 'ruhe' };
  /** Jeder Start und jedes Abbrechen zählt hoch; Antworten eines früheren Laufs werden verworfen. */
  let lauf = 0;
  let vorgang: { id: string; abholGeheimnis: string; bis: number; geraet: GeraetHandle } | null = null;
  let stoppeWecker: (() => void) | null = null;
  let fehlerInFolge = 0;
  let letzterFehler: KontoFehlerCode | null = null;
  /** Z2 Nr. 7: Zeit des letzten Erfolgs (Anlegen, Antwort beim Abfragen, auch 429); das Fehlerbudget läuft ab hier. */
  let letzterErfolg = 0;
  /** Z2: Rückkanal des laufenden Versuchs und der Einmalwert aus dem Sprung (nur im Speicher, nie im Log, nie im Schritt). */
  let rueck: Pick<Rueckkanal, 'port' | 'setzeVorgang' | 'schliesse'> | null = null;
  let einmalwert: string | null = null;

  /** Z2: den Rückkanal schließen (best effort, ohne zu warten). */
  function rueckZu(): void {
    const r = rueck;
    rueck = null;
    if (r) r.schliesse().catch(() => undefined);
  }

  /** Einen Vorgang beim Worker schließen, ohne zu warten; ein Fehler wird verschluckt (best effort). */
  function schliesse(v: { id: string; abholGeheimnis: string }): void {
    try {
      u.client.vorgangAbbrechen(v.id, v.abholGeheimnis).catch(() => undefined);
    } catch {
      /* best effort */
    }
  }

  function setze(s: AnmeldeSchritt): void {
    aktuell = s;
    u.melde(s);
  }
  function ende(s: AnmeldeSchritt): void {
    stoppeWecker?.();
    stoppeWecker = null;
    vorgang = null;
    einmalwert = null;
    rueckZu();
    setze(s);
  }
  const fehlerCode = (e: unknown): KontoFehlerCode => (e instanceof KontoFehler ? e.code : 'server');

  function plane(meinLauf: number): void {
    stoppeWecker = u.wecker(ABFRAGE_MS, () => {
      stoppeWecker = null;
      void frage(meinLauf);
    });
  }

  /** AA3, AA4: eine Abfrage beim Worker. */
  async function frage(meinLauf: number): Promise<void> {
    const v = vorgang;
    if (meinLauf !== lauf || !v) return;
    if (u.jetzt() >= v.bis) {
      schliesse(v);
      ende({ art: 'abgelaufen' });
      return;
    }
    let antwort: Awaited<ReturnType<KontoClient['vorgangAbholen']>> | null = null;
    let code: KontoFehlerCode | null = null;
    try {
      const beweis = await v.geraet.beweis('abholen', v.id, u.jetzt());
      // Z2: ab dem Sprung mit dem Einmalwert e; vorher ohne (dann sagt der Worker auch nach „Ja“ nur „wartet“).
      antwort = await u.client.vorgangAbholen(v.id, v.abholGeheimnis, beweis, einmalwert ?? undefined);
    } catch (e) {
      code = fehlerCode(e);
    }
    if (meinLauf !== lauf) return;
    if (antwort === null) {
      if (code === 'vorgang-unbekannt') {
        // Der Worker nimmt den Vorgang beim erfolgreichen Abholen weg (Z2: der Grabstein nimmt dieselbe Anfrage noch 60 s an). Folgt
        // „unbekannt“ direkt auf einen vorübergehenden Fehler, ging womöglich die Antwort mit der Bestätigung verloren: ehrlich
        // „fehler“ statt „abgelaufen“.
        if (fehlerInFolge > 0 && letzterFehler !== null) ende({ art: 'fehler', code: letzterFehler });
        else ende({ art: 'abgelaufen' });
      } else if (code !== null && VORUEBERGEHEND.includes(code)) {
        fehlerInFolge++;
        if (code === 'zu-viele') {
          // Z1: eine Drosselung (zu-viele) wurde am Worker abgewiesen, bevor sie etwas verbrauchen konnte: Sie erklärt kein verlorenes
          // „bestätigt“ und wird nie der letzte Fehler. Z2 Nr. 7: Sie zählt auch nicht als Fehler (der Worker hat geantwortet).
          letzterErfolg = u.jetzt();
          plane(meinLauf);
        } else {
          letzterFehler = code;
          // Z2 Nr. 7: das Fehlerbudget läuft in Zeit, nicht in Versuchen: erst nach 60 s nur mit Fehlern seit dem letzten Erfolg.
          if (u.jetzt() - letzterErfolg >= FEHLER_BUDGET_MS) {
            schliesse(v);
            ende({ art: 'fehler', code });
          } else plane(meinLauf);
        }
      } else {
        schliesse(v);
        ende({ art: 'fehler', code: code ?? 'server' });
      }
      return;
    }
    fehlerInFolge = 0;
    letzterErfolg = u.jetzt();
    if (antwort.zustand === 'bestaetigt') {
      const s: GespeicherteSitzung = { token: antwort.sitzung, stand: antwort.stand };
      try {
        u.angemeldet(s);
        ende({ art: 'fertig', kurzName: kurzName(s.stand.name, s.stand.email), stufe: s.stand.stufe });
      } catch {
        ende({ art: 'fehler', code: 'server' });
      }
    } else if (antwort.zustand === 'abgelehnt') ende({ art: 'abgelehnt' });
    else if (antwort.zustand === 'abgelaufen') ende({ art: 'abgelaufen' });
    else plane(meinLauf);
  }

  return {
    async starte(): Promise<void> {
      // AA1: nicht verdoppeln; ein neuer Start nur aus Ruhe oder einem Endzustand.
      if (LAEUFT.includes(aktuell.art)) return;
      const meinLauf = ++lauf;
      fehlerInFolge = 0;
      letzterFehler = null;
      einmalwert = null;
      setze({ art: 'startet' });
      const g = await u.geraet();
      if (meinLauf !== lauf) return;
      if (!g) {
        ende({ art: 'fehler', code: 'kein-schluesselspeicher' });
        return;
      }
      // Z2: erst der Rückkanal (sein Port geht mit dem Vorgang an den Worker); ohne ihn gibt es keinen Vorgang. Den Einmalwert nimmt
      // nur der laufende Versuch an.
      let rk: Pick<Rueckkanal, 'port' | 'setzeVorgang' | 'schliesse'>;
      try {
        rk = await u.oeffneRueckkanal({ angenommen: (e) => { if (meinLauf === lauf && vorgang !== null) einmalwert = e; } });
      } catch {
        if (meinLauf === lauf) ende({ art: 'fehler', code: 'server' });
        return;
      }
      if (meinLauf !== lauf) {
        rk.schliesse().catch(() => undefined);
        return;
      }
      rueck = rk;
      let v: Awaited<ReturnType<KontoClient['vorgangAnlegen']>>;
      const t0 = u.jetzt();
      try {
        v = await u.client.vorgangAnlegen({ publicJwk: g.publicJwk, name: u.rechnerName, plattform: u.plattform, arch: u.arch, version: u.version }, rk.port);
      } catch (e) {
        if (meinLauf === lauf) ende({ art: 'fehler', code: fehlerCode(e) });
        else rk.schliesse().catch(() => undefined);
        return;
      }
      if (meinLauf !== lauf) {
        // Während des Anlegens abgebrochen: den späten Vorgang beim Worker gleich wieder schließen (best effort).
        u.client.vorgangAbbrechen(v.vorgang, v.abholGeheimnis).catch(() => undefined);
        rk.schliesse().catch(() => undefined);
        return;
      }
      // Die Frist auf der eigenen Uhr (t0 + 5 min); das `bis` des Workers geht nach dessen Uhr und wird nicht verglichen.
      const bisLokal = t0 + VORGANG_MS;
      vorgang = { id: v.vorgang, abholGeheimnis: v.abholGeheimnis, bis: bisLokal, geraet: g };
      letzterErfolg = u.jetzt();
      rk.setzeVorgang(v.vorgang);
      // AA2: Browser öffnen, dann „wartet“ mit dem Ergebnis (K52, wenn er nicht aufging).
      let offen = false;
      try {
        offen = await u.oeffneBrowser(v.adresse);
      } catch {
        offen = false;
      }
      if (meinLauf !== lauf) return;
      setze({ art: 'wartet', code: v.code, adresse: v.adresse, bis: bisLokal, browserOffen: offen });
      plane(meinLauf);
    },

    async abbrechen(): Promise<void> {
      // AA5: Abfrage stoppen, beim Worker abbrechen (best effort), Schritt „abgebrochen“.
      if (!LAEUFT.includes(aktuell.art)) return;
      const v = vorgang;
      lauf++;
      ende({ art: 'abgebrochen' });
      // Best effort, ohne zu warten: der Vorgang verfällt am Worker nach 5 min von selbst.
      if (v) schliesse(v);
    },

    stoppe(): void {
      // Z2: beim Beenden des Launchers (before-quit): kein Wecker, kein Rückkanal mehr; der Worker erfährt es best effort. Keine
      // Meldung an den Renderer (das Fenster geht gerade zu).
      const v = vorgang;
      lauf++;
      stoppeWecker?.();
      stoppeWecker = null;
      vorgang = null;
      einmalwert = null;
      rueckZu();
      if (LAEUFT.includes(aktuell.art)) aktuell = { art: 'abgebrochen' };
      if (v) schliesse(v);
    },

    schritt: () => aktuell,
    adresse: () => (aktuell.art === 'wartet' ? aktuell.adresse : null),
  };
}

// ── Ende des Moduls ──

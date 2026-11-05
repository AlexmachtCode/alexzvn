// ─────────────────────────────────────────────────────────────────────────────
// Anmeldung im Launcher (Teil 1) · Anmelde-Ablauf mit Bestätigungscode (Plan 10.6, Verhalten 11.2 AA1–AA6; Spec 4.1, 11;
// EP5). Der Launcher legt beim Worker einen Vorgang an, öffnet die Anmeldeseite im System-Browser und fragt alle 2 s mit
// frischem Gerätebeweis nach, bis der Mensch im Browser „Ja, das ist mein Rechner“ (oder „Nein“) wählt oder der Code
// abläuft. Kein Rückkanal über jmps:// (die volle URL stünde in main.log, Ist-L 12). Der Code steht nur im Schritt
// `wartet` und geht nie in ein Log (AA6); das Abholgeheimnis verlässt dieses Modul nur zum Worker.
// Kein electron-Import (G9): Browser, Uhr, Wecker, Client und Gerät sind eingespeist.
// ─────────────────────────────────────────────────────────────────────────────
import { kurzName, type AnmeldeSchritt, type KontoFehlerCode } from '../../shared/konto';
import type { GeraetHandle } from './geraet';
import type { GespeicherteSitzung } from './sitzung-kern';
import { KontoFehler, type KontoClient } from './worker-client';

export interface AnmeldeAblauf { starte(): Promise<void>; abbrechen(): Promise<void>; schritt(): AnmeldeSchritt; adresse(): string | null }

/** AA3: Abstand der Abfragen beim Worker. */
export const ABFRAGE_MS = 2000;
/** AA4: so viele Netz- bzw. Serverfehler in Folge beenden das Warten mit `fehler`. */
export const FEHLER_IN_FOLGE_MAX = 5;
/** EP5: ein Vorgang lebt 5 min. Die Frist läuft auf der eigenen Uhr (Start + 5 min), nie gegen die Uhr des Workers (EP30). */
export const VORGANG_MS = 5 * 60_000;

const LAEUFT: ReadonlyArray<AnmeldeSchritt['art']> = ['startet', 'wartet'];
const VORUEBERGEHEND: readonly string[] = ['netz', 'server', 'zu-viele'];

export function erzeugeAnmeldeAblauf(u: {
  client: KontoClient; geraet: () => Promise<GeraetHandle | null>; jetzt(): number;
  wecker(ms: number, fn: () => void): () => void; oeffneBrowser(url: string): Promise<boolean>;
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
      antwort = await u.client.vorgangAbholen(v.id, v.abholGeheimnis, beweis);
    } catch (e) {
      code = fehlerCode(e);
    }
    if (meinLauf !== lauf) return;
    if (antwort === null) {
      if (code === 'vorgang-unbekannt') {
        // Der Worker nimmt den Vorgang beim erfolgreichen Abholen weg. Folgt „unbekannt“ direkt auf einen vorübergehenden
        // Fehler, ging womöglich die Antwort mit der Bestätigung verloren: ehrlich „fehler“ statt „abgelaufen“.
        if (fehlerInFolge > 0 && letzterFehler !== null) ende({ art: 'fehler', code: letzterFehler });
        else ende({ art: 'abgelaufen' });
      } else if (code !== null && VORUEBERGEHEND.includes(code)) {
        fehlerInFolge++;
        // Z1: eine Drosselung (zu-viele) wurde am Worker abgewiesen, bevor sie etwas verbrauchen konnte: Sie erklärt kein verlorenes
        // „bestätigt“ und wird nie der letzte Fehler.
        if (code !== 'zu-viele') letzterFehler = code;
        if (fehlerInFolge >= FEHLER_IN_FOLGE_MAX) {
          schliesse(v);
          ende({ art: 'fehler', code });
        } else plane(meinLauf);
      } else {
        schliesse(v);
        ende({ art: 'fehler', code: code ?? 'server' });
      }
      return;
    }
    fehlerInFolge = 0;
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
      setze({ art: 'startet' });
      const g = await u.geraet();
      if (meinLauf !== lauf) return;
      if (!g) {
        ende({ art: 'fehler', code: 'kein-schluesselspeicher' });
        return;
      }
      let v: Awaited<ReturnType<KontoClient['vorgangAnlegen']>>;
      const t0 = u.jetzt();
      try {
        v = await u.client.vorgangAnlegen({ publicJwk: g.publicJwk, name: u.rechnerName, plattform: u.plattform, arch: u.arch, version: u.version });
      } catch (e) {
        if (meinLauf === lauf) ende({ art: 'fehler', code: fehlerCode(e) });
        return;
      }
      if (meinLauf !== lauf) {
        // Während des Anlegens abgebrochen: den späten Vorgang beim Worker gleich wieder schließen (best effort).
        u.client.vorgangAbbrechen(v.vorgang, v.abholGeheimnis).catch(() => undefined);
        return;
      }
      // Die Frist auf der eigenen Uhr (t0 + 5 min); das `bis` des Workers geht nach dessen Uhr und wird nicht verglichen.
      const bisLokal = t0 + VORGANG_MS;
      vorgang = { id: v.vorgang, abholGeheimnis: v.abholGeheimnis, bis: bisLokal, geraet: g };
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

    schritt: () => aktuell,
    adresse: () => (aktuell.art === 'wartet' ? aktuell.adresse : null),
  };
}

// ── Ende des Moduls ──

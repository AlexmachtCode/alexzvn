// ─────────────────────────────────────────────────────────────────────────────
// Anmeldung im Launcher (Teil 1) · Rückkanal beim Bestätigen (Z2; wie Desktop-OAuth, RFC 8252 7.3 und 8.3 „loopback redirect“).
// Nach „Ja, das ist mein Rechner“ leitet der Worker den Browser per 303 an
//   http://127.0.0.1:<port>/anmeldung/zurueck?v=<vorgang>&e=<einmalwert>
// weiter. Dort lauscht nur der Launcher, der den Vorgang gestartet hat: nur auf 127.0.0.1, Port vom Betriebssystem (Port 0). Er nimmt
// genau eine Anfrage an: GET, Host-Kopf genau `127.0.0.1:<port>` (gegen DNS-Rebinding), Pfad genau RUECK_PFAD, genau die Parameter
// `v` (der laufende Vorgang) und `e` (genau 43 Zeichen b64url). Antwort: kleine Seite ohne Skript mit K57, Kopfzeilen no-store,
// no-referrer und `default-src 'none'`. Alles andere: 404 ohne Inhalt. Danach schließt er sich; ebenso bei schliesse() (Abbrechen,
// Ende des Ablaufs, Beenden des Launchers) und nach der Frist des Vorgangs (5 min). Den Wert e prüft der Worker (nur er kennt den
// Hash); hier wird nur die Form geprüft. Ins Log kommt nur „angenommen“ oder „abgewiesen“, nie e oder der Vorgang (G4).
// Kein electron-Import (G9).
// ─────────────────────────────────────────────────────────────────────────────
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Pfad des Rückkanals; derselbe wie RUECK_PFAD im Worker (services/release-proxy/konto-seiten.js, der Kettentest prüft beide). */
export const RUECK_PFAD = '/anmeldung/zurueck';
/** K57 (Z2): Seite des Launchers im Browser nach dem Sprung. */
export const TEXT_ZURUECK = 'Fertig. Du kannst dieses Fenster schließen; der Launcher meldet sich jetzt an.';
/** B1: Titel der Seite, derselbe wie auf der Anmeldeseite des Workers. */
const TITEL = 'Anmeldung · JM Production Suite';
/** EP5: ein Vorgang lebt 5 min; so lange höchstens ist der Rückkanal offen. */
export const RUECK_FRIST_MS = 5 * 60_000;
const LOG_ABSTAND_MS = 10_000;
const E_FORM = /^[A-Za-z0-9_-]{43}$/;

const SEITE = '<!doctype html>\n<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
  + `<meta name="referrer" content="no-referrer"><title>${TITEL}</title></head>\n<body><p>${TEXT_ZURUECK}</p></body></html>\n`;

export interface Rueckkanal {
  /** Port auf 127.0.0.1, den der Launcher beim Anlegen des Vorgangs meldet (`rueckPort`). */
  readonly port: number;
  /** Adresse, auf der der Server lauscht (immer 127.0.0.1). */
  readonly adresse: string;
  /** Der Vorgang ist erst nach dem Anlegen bekannt; vorher nimmt der Rückkanal nichts an. */
  setzeVorgang(vorgang: string): void;
  offen(): boolean;
  /** Schließen (idempotent): keine neue Verbindung, offene werden beendet. */
  schliesse(): Promise<void>;
}

export async function oeffneRueckkanal(o: {
  angenommen(e: string): void; log(z: string): void; fristMs?: number; jetzt?: () => number;
}): Promise<Rueckkanal> {
  const jetzt = o.jetzt ?? Date.now;
  let vorgang: string | null = null;
  let offen = true;
  let port = 0;
  let letzteZeile = Number.NEGATIVE_INFINITY;
  let unterdrueckt = 0;
  let geschlossen: Promise<void> | null = null;

  /** Ins Log nur, ob ein Aufruf angenommen oder abgewiesen wurde; Abweisungen höchstens alle 10 s (mit Zahl der unterdrückten). */
  function abgewiesen(): void {
    const t = jetzt();
    if (t - letzteZeile >= LOG_ABSTAND_MS) {
      o.log(`Anmeldung: Rückkanal-Aufruf abgewiesen${unterdrueckt ? ` (${unterdrueckt} weitere unterdrückt)` : ''}`);
      letzteZeile = t;
      unterdrueckt = 0;
    } else {
      unterdrueckt++;
    }
  }

  function nichts(res: ServerResponse): void {
    res.writeHead(404, { 'content-length': '0', 'cache-control': 'no-store', connection: 'close' });
    res.end();
  }

  /** Der Einmalwert, wenn die Anfrage genau die eine gültige ist; sonst null. */
  function wertAus(req: IncomingMessage): string | null {
    if (!offen || vorgang === null || req.method !== 'GET' || req.headers.host !== `127.0.0.1:${port}`) return null;
    const ziel = req.url ?? '';
    if (!ziel.startsWith('/')) return null;
    let u: URL;
    try {
      u = new URL(ziel, `http://127.0.0.1:${port}`);
    } catch {
      return null;
    }
    if (u.pathname !== RUECK_PFAD) return null;
    const namen = [...u.searchParams.keys()];
    if (namen.length !== 2 || u.searchParams.getAll('v').length !== 1 || u.searchParams.getAll('e').length !== 1) return null;
    const e = u.searchParams.get('e') ?? '';
    return u.searchParams.get('v') === vorgang && E_FORM.test(e) ? e : null;
  }

  const server = createServer({ connectionsCheckingInterval: 1000 }, (req, res) => {
    req.resume();
    const e = wertAus(req);
    if (e === null) {
      abgewiesen();
      nichts(res);
      return;
    }
    // Genau einmal: ab hier nimmt der Rückkanal nichts mehr an, auch nicht auf einer anderen offenen Verbindung.
    offen = false;
    o.log('Anmeldung: Rückkanal-Aufruf angenommen');
    try {
      o.angenommen(e);
    } catch {
      /* der Ablauf entscheidet selbst; der Browser bekommt trotzdem die Seite */
    }
    const text = Buffer.from(SEITE, 'utf8');
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-length': String(text.length),
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'content-security-policy': "default-src 'none'",
      'x-content-type-options': 'nosniff',
      connection: 'close',
    });
    res.end(text, () => void schliesse());
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5000;
  await new Promise<void>((ok, nein) => {
    server.once('error', nein);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', nein);
      ok();
    });
  });
  const a = server.address() as AddressInfo;
  port = a.port;
  server.on('error', () => o.log('Anmeldung: Rückkanal-Fehler am Socket'));
  // Der Rückkanal hält den Prozess nicht am Leben (Beenden des Launchers wartet nie auf ihn, G5).
  server.unref();
  const frist = setTimeout(() => void schliesse(), o.fristMs ?? RUECK_FRIST_MS);
  frist.unref?.();

  function schliesse(): Promise<void> {
    if (geschlossen) return geschlossen;
    offen = false;
    clearTimeout(frist);
    geschlossen = new Promise<void>((fertig) => {
      server.close(() => fertig());
      server.closeAllConnections();
    });
    return geschlossen;
  }

  return {
    port,
    adresse: a.address,
    setzeVorgang: (v) => { vorgang = v; },
    offen: () => offen,
    schliesse,
  };
}

// ── Ende des Moduls ──

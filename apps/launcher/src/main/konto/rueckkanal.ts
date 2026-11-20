// ─────────────────────────────────────────────────────────────────────────────
// Anmeldung im Launcher (Teil 1) · Rückkanal beim Bestätigen (Z2; wie Desktop-OAuth, RFC 8252 7.3 und 8.3 „loopback redirect“).
// Fixrunde 1 (OE6): Nach „Ja, das ist mein Rechner“ zeigt die Seite des Workers einen Knopf („Weiter zum Launcher“, B29). Sein
// Formular schickt Vorgang und Einmalwert per POST (application/x-www-form-urlencoded) an
//   http://127.0.0.1:<port>/anmeldung/zurueck
// Der Einmalwert steht so nie in einer Adresszeile, im Verlauf oder in einem Location-Kopf. Dort lauscht nur der Launcher, der den
// Vorgang gestartet hat: nur auf 127.0.0.1, Port vom Betriebssystem (Port 0). Er nimmt genau `POST /anmeldung/zurueck` an: Host-Kopf
// genau `127.0.0.1:<port>` (gegen DNS-Rebinding), Inhaltstyp Formular, Körper höchstens 1 KiB (mehr: 404 und die Verbindung geht zu),
// genau die Felder `v` (der laufende Vorgang) und `e` (genau 43 Zeichen b64url), jedes genau einmal. Antwort: kleine Seite ohne Skript
// mit K57, Kopfzeilen no-store, no-referrer und `default-src 'none'`. Alles andere, auch GET und kaputte Anfragen (clientError): 404
// ohne Inhalt. Nach der Annahme beantwortet er höchstens 10 s lang dieselbe Kombination v/e noch einmal mit K57 (Doppelklick auf den
// Knopf; der Launcher erfährt e nur einmal), danach schließt er. Beim Abbrechen, nach der Frist des Vorgangs (5 min) und beim Beenden
// des Launchers schließt er sofort. Den Wert e prüft der Worker (nur er kennt die Hashes); hier wird nur die Form geprüft. Ins Log
// kommt nur „angenommen“ oder „abgewiesen“, nie e oder der Vorgang (G4). Kein electron-Import (G9).
// ─────────────────────────────────────────────────────────────────────────────
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';

/** Pfad des Rückkanals; derselbe wie RUECK_PFAD im Worker (services/release-proxy/konto-seiten.js, der Kettentest prüft beide). */
export const RUECK_PFAD = '/anmeldung/zurueck';
/** K57 (Z2): Seite des Launchers im Browser nach dem Knopf. */
export const TEXT_ZURUECK = 'Fertig. Du kannst dieses Fenster schließen; der Launcher meldet sich jetzt an.';
/** B1: Titel der Seite, derselbe wie auf der Anmeldeseite des Workers. */
const TITEL = 'Anmeldung · JM Production Suite';
/** EP5: ein Vorgang lebt 5 min; so lange höchstens ist der Rückkanal offen. */
export const RUECK_FRIST_MS = 5 * 60_000;
/** Fixrunde 1 (OE6): so lange nach der Annahme beantwortet er dieselbe Kombination v/e noch einmal (Doppelklick auf den Knopf). */
export const RUECK_WIEDERHOL_MS = 10_000;
/** Fixrunde 1 (OE6): höchstens so viele Bytes Körper; das Formular braucht rund 80. */
export const RUECK_BODY_MAX = 1024;
/** Zeitlimit für Kopf und Anfrage (Fixrunde 1, M4 lb: eine halb offene Verbindung geht danach zu). */
export const RUECK_ZEITLIMIT_MS = 5000;
const LOG_ABSTAND_MS = 10_000;
const E_FORM = /^[A-Za-z0-9_-]{43}$/;
const LEER_404 = 'HTTP/1.1 404 Not Found\r\ncontent-length: 0\r\ncache-control: no-store\r\nconnection: close\r\n\r\n';

const SEITE = '<!doctype html>\n<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
  + `<meta name="referrer" content="no-referrer"><title>${TITEL}</title></head>\n<body><p>${TEXT_ZURUECK}</p></body></html>\n`;

export interface Rueckkanal {
  /** Port auf 127.0.0.1, den der Launcher beim Anlegen des Vorgangs meldet (`rueckPort`). */
  readonly port: number;
  /** Adresse, auf der der Server lauscht (immer 127.0.0.1). */
  readonly adresse: string;
  /** Der Vorgang ist erst nach dem Anlegen bekannt; vorher nimmt der Rückkanal nichts an. */
  setzeVorgang(vorgang: string): void;
  /** Lauscht der Server noch (bis zum Schließen, auch im Fenster nach der Annahme)? */
  offen(): boolean;
  /** Sofort schließen (idempotent): keine neue Verbindung, offene werden beendet (Abbrechen, Ablauf, Beenden). */
  schliesse(): Promise<void>;
  /** Ablauf fertig: ohne angenommenen Wert sofort schließen, sonst am Ende des Fensters für den Doppelklick. */
  schliesseNachFenster(): void;
}

/** Ist der Inhaltstyp genau ein Formular (application/x-www-form-urlencoded, Parameter wie charset erlaubt)? */
function istFormular(typ: string | undefined): boolean {
  return typeof typ === 'string' && typ.split(';')[0].trim().toLowerCase() === 'application/x-www-form-urlencoded';
}

export async function oeffneRueckkanal(o: {
  angenommen(e: string): void; log(z: string): void; fristMs?: number; wiederholMs?: number; zeitlimitMs?: number; jetzt?: () => number;
}): Promise<Rueckkanal> {
  const jetzt = o.jetzt ?? Date.now;
  const zeitlimit = o.zeitlimitMs ?? RUECK_ZEITLIMIT_MS;
  let vorgang: string | null = null;
  /** Die angenommene Kombination; danach nimmt der Rückkanal keine andere mehr an. */
  let paar: { v: string; e: string } | null = null;
  let port = 0;
  let letzteZeile = Number.NEGATIVE_INFINITY;
  let unterdrueckt = 0;
  let geschlossen: Promise<void> | null = null;
  let fenster: ReturnType<typeof setTimeout> | null = null;

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

  /** 404 ohne Inhalt; `trennen` schließt die Verbindung nach der Antwort (zu großer Körper, ungelesen). */
  function nichts(req: IncomingMessage, res: ServerResponse, trennen = false): void {
    abgewiesen();
    if (res.headersSent) return;
    res.writeHead(404, { 'content-length': '0', 'cache-control': 'no-store', connection: 'close' });
    res.end();
    if (trennen) res.once('finish', () => req.destroy());
  }

  function seite(res: ServerResponse): void {
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
    res.end(text);
  }

  /** Die Felder v und e aus dem Körper, wenn es genau diese zwei sind (je einmal), v der laufende Vorgang und e in der Form; sonst null. */
  function paarAus(text: string): { v: string; e: string } | null {
    const f = new URLSearchParams(text);
    const namen = [...f.keys()];
    if (namen.length !== 2 || f.getAll('v').length !== 1 || f.getAll('e').length !== 1) return null;
    const v = f.get('v') ?? '';
    const e = f.get('e') ?? '';
    return vorgang !== null && v === vorgang && E_FORM.test(e) ? { v, e } : null;
  }

  function behandle(req: IncomingMessage, res: ServerResponse, text: string): void {
    const p = paarAus(text);
    if (p === null || geschlossen) return nichts(req, res);
    if (paar === null) {
      // Genau einmal: diese Kombination ist ab jetzt die einzige, die der Rückkanal noch beantwortet.
      paar = p;
      o.log('Anmeldung: Rückkanal-Aufruf angenommen');
      try {
        o.angenommen(p.e);
      } catch {
        /* der Ablauf entscheidet selbst; der Browser bekommt trotzdem die Seite */
      }
      fenster = setTimeout(() => void schliesse(), o.wiederholMs ?? RUECK_WIEDERHOL_MS);
      fenster.unref?.();
      return seite(res);
    }
    // Doppelklick auf den Knopf: dieselbe Kombination noch einmal K57, ohne neue Benachrichtigung; alles andere 404.
    if (p.v === paar.v && p.e === paar.e) return seite(res);
    return nichts(req, res);
  }

  const server = createServer({ connectionsCheckingInterval: Math.min(1000, Math.max(50, zeitlimit)) }, (req, res) => {
    const kopfOk = req.method === 'POST' && req.url === RUECK_PFAD && req.headers.host === `127.0.0.1:${port}` && istFormular(req.headers['content-type']);
    if (!kopfOk) {
      req.resume();
      return nichts(req, res);
    }
    const laenge = req.headers['content-length'];
    if (laenge !== undefined && !(Number(laenge) <= RUECK_BODY_MAX)) return nichts(req, res, true);
    const teile: Buffer[] = [];
    let summe = 0;
    let zuGross = false;
    req.on('data', (c: Buffer) => {
      if (zuGross) return;
      summe += c.length;
      if (summe > RUECK_BODY_MAX) {
        zuGross = true;
        teile.length = 0;
        nichts(req, res, true);
      } else {
        teile.push(c);
      }
    });
    req.on('end', () => {
      if (!zuGross) behandle(req, res, Buffer.concat(teile).toString('utf8'));
    });
    req.on('error', () => undefined);
  });
  // Fixrunde 1 (M3): kaputte Anfragen, zu lange Köpfe und Zeitüberschreitungen bekommen 404 ohne Inhalt statt der Texte von Node
  // (400, 431, 408); ist der Socket schon zu oder eine Antwort unterwegs, wird nichts geschrieben.
  server.on('clientError', (_e: Error, socket: Socket) => {
    abgewiesen();
    const halb = (socket as Socket & { _httpMessage?: { headersSent?: boolean } })._httpMessage;
    if (!socket.writable || socket.destroyed || halb?.headersSent) {
      socket.destroy();
      return;
    }
    socket.end(LEER_404);
  });
  server.requestTimeout = zeitlimit;
  server.headersTimeout = zeitlimit;
  server.keepAliveTimeout = Math.min(zeitlimit, 5000);
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
    clearTimeout(frist);
    if (fenster) clearTimeout(fenster);
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
    offen: () => geschlossen === null,
    schliesse,
    schliesseNachFenster: () => {
      if (paar === null) void schliesse();
    },
  };
}

// ── Ende des Moduls ──

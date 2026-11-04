// ─────────────────────────────────────────────────────────────────────────────
// Anmeldung im Launcher (Teil 1) · Tür-Dienst für die Tools (Plan 10.6, 10.8, EP8; Spec 6.2).
// Lauscht nur auf 127.0.0.1 mit freiem Port und legt je Start die Tür-Datei <appData>/JM Production Suite/launcher-tuer.json
// mit Port und neuem Zufallsschlüssel an (atomar, nur für dieses Windows-Konto). Jede Anfrage muss den HMAC-Beweis des Tools
// tragen (Zeit ±60 s, Nonce nur einmal in 2 min); sonst 401 ohne unterschriebene Antwort. Gültige Anfragen bekommen eine
// unterschriebene Antwort (auch Ablehnungen), damit das Tool den Launcher erkennt. Die Entscheidung trifft `behandle`
// (Freigabe-Stelle, freigaben.ts). Beim Stoppen wird die Tür-Datei gelöscht, wenn sie noch die eigene ist.
// Kein electron-Import (G9). Das Log nennt nie Schlüssel, Freigabe oder Sitzung (G4).
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto';
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname } from 'node:path';
import {
  beweisGleich, FREIGABE_PFAD, FREIGABE_VERSION, freigabeBeweis, inhaltsHash, KOPF_BEWEIS, KOPF_NONCE, KOPF_ZEIT, tuerPfad,
  type FreigabeAnfrage, type FreigabeErgebnis, type TuerDatei,
} from '@jm/app-runtime/freigabe';

/** EP8: Zeitfenster des Beweises und Merkdauer der Nonces. */
export const TUER_ZEITFENSTER_MS = 60_000;
export const TUER_NONCE_MS = 2 * 60_000;
const BODY_MAX_BYTES = 4096;
/** Frist für `behandle`: unter dem Zeitlimit des Clients (5 s), damit das Tool eine unterschriebene Antwort bekommt. */
export const TUER_FRIST_MS = 4000;
const LOG_ABSTAND_MS = 10_000;

/** Tür-Datei atomar schreiben: Zwischendatei im selben Ordner, dann umbenennen (Windows: kurz wiederholen). */
function schreibeAtomar(pfad: string, inhalt: string): void {
  mkdirSync(dirname(pfad), { recursive: true });
  const zwischen = `${pfad}.${process.pid}.${Date.now()}.tmp`;
  const fd = openSync(zwischen, 'w', 0o600);
  try {
    writeSync(fd, inhalt);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  for (let versuch = 0; ; versuch++) {
    try {
      renameSync(zwischen, pfad);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? '';
      if (versuch >= 20 || !['EPERM', 'EBUSY', 'EACCES'].includes(code)) {
        try { unlinkSync(zwischen); } catch { /* schon weg */ }
        throw e;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
}

function anfrageAus(text: string): FreigabeAnfrage | 'neuer' | null {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof roh !== 'object' || roh === null) return null;
  const a = roh as Record<string, unknown>;
  if (typeof a.v !== 'number' || !Number.isInteger(a.v) || a.v < 1) return null;
  if (a.v > FREIGABE_VERSION) return 'neuer';
  if (typeof a.appId !== 'string' || !a.appId || a.appId.length > 64) return null;
  if (typeof a.zweck !== 'string' || !a.zweck || a.zweck.length > 64) return null;
  if (a.ziel !== undefined && (typeof a.ziel !== 'string' || a.ziel.length > 200)) return null;
  return { v: 1, appId: a.appId, zweck: a.zweck, ...(a.ziel === undefined ? {} : { ziel: a.ziel as string }) };
}

export async function starteTuerDienst(o: {
  appDataDir: string; behandle(a: FreigabeAnfrage): Promise<FreigabeErgebnis>; log(z: string): void; jetzt?: () => number;
  fristMs?: number;
}): Promise<{ port: number; stoppe(): Promise<void> }> {
  const jetzt = o.jetzt ?? Date.now;
  const schluessel = randomBytes(32).toString('base64url');
  const gesehen = new Map<string, number>();
  let letzteZeile = Number.NEGATIVE_INFINITY;
  let unterdrueckt = 0;

  function unterschrieben(res: ServerResponse, status: number, e: FreigabeErgebnis, nonce: string): void {
    const text = JSON.stringify(e);
    res.writeHead(status, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      [KOPF_BEWEIS]: freigabeBeweis(schluessel, ['launcher', nonce, inhaltsHash(text)]),
    });
    res.end(text);
  }
  function abgelehnt(res: ServerResponse, status: number, warum: string): void {
    const t = jetzt();
    if (t - letzteZeile >= LOG_ABSTAND_MS) {
      o.log(`Tür-Dienst: Anfrage abgelehnt (${warum})${unterdrueckt ? `, ${unterdrueckt} weitere unterdrückt` : ''}`);
      letzteZeile = t;
      unterdrueckt = 0;
    } else {
      unterdrueckt++;
    }
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end('abgelehnt');
  }

  async function bediene(req: IncomingMessage, res: ServerResponse, body: string): Promise<void> {
    const zeit = req.headers[KOPF_ZEIT];
    const nonce = req.headers[KOPF_NONCE];
    const beweis = req.headers[KOPF_BEWEIS];
    if (typeof zeit !== 'string' || !/^\d{1,16}$/.test(zeit) || Math.abs(jetzt() - Number(zeit)) > TUER_ZEITFENSTER_MS) {
      abgelehnt(res, 401, 'Zeit');
      return;
    }
    if (typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(nonce)) {
      abgelehnt(res, 401, 'Nonce');
      return;
    }
    if (typeof beweis !== 'string' || !beweisGleich(beweis, freigabeBeweis(schluessel, ['tool', zeit, nonce, inhaltsHash(body)]))) {
      abgelehnt(res, 401, 'Beweis');
      return;
    }
    const t = jetzt();
    for (const [n, am] of gesehen) if (t - am > TUER_NONCE_MS) gesehen.delete(n);
    if (gesehen.has(nonce)) {
      abgelehnt(res, 401, 'Wiederholung');
      return;
    }
    gesehen.set(nonce, t);
    if (req.url !== FREIGABE_PFAD) {
      unterschrieben(res, 404, { ok: false, grund: 'launcher-zu-alt' }, nonce);
      return;
    }
    const a = anfrageAus(body);
    if (a === 'neuer') {
      unterschrieben(res, 200, { ok: false, grund: 'launcher-zu-alt' }, nonce);
      return;
    }
    if (a === null) {
      unterschrieben(res, 400, { ok: false, grund: 'fehler', detail: 'ungueltig' }, nonce);
      return;
    }
    let e: FreigabeErgebnis;
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const frist = new Promise<FreigabeErgebnis>((ja) => {
        timer = setTimeout(() => ja({ ok: false, grund: 'server-nicht-erreichbar' }), o.fristMs ?? TUER_FRIST_MS);
      });
      try {
        e = await Promise.race([o.behandle(a), frist]);
      } finally {
        clearTimeout(timer);
      }
    } catch {
      e = { ok: false, grund: 'fehler' };
    }
    unterschrieben(res, 200, e, nonce);
  }

  const server = createServer((req, res) => {
    // Browser-Seiten (Origin) und fremde Hostnamen (DNS-Rebinding) bekommen nie eine Antwort mit Unterschrift und kein Log.
    if (req.headers.origin !== undefined || req.headers.host !== `127.0.0.1:${port}`) {
      res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', connection: 'close' });
      res.end('abgelehnt');
      return;
    }
    if (req.method !== 'POST') {
      abgelehnt(res, 405, 'Methode');
      return;
    }
    const teile: Buffer[] = [];
    let laenge = 0;
    let zuGross = false;
    req.on('data', (c: Buffer) => {
      laenge += c.length;
      if (zuGross) return;
      if (laenge > BODY_MAX_BYTES) {
        zuGross = true;
        teile.length = 0;
        abgelehnt(res, 413, 'zu groß');
        res.once('finish', () => req.destroy());
      } else {
        teile.push(c);
      }
    });
    req.on('end', () => {
      if (zuGross) return;
      void bediene(req, res, Buffer.concat(teile).toString('utf8')).catch(() => {
        if (!res.headersSent) abgelehnt(res, 500, 'Fehler');
      });
    });
  });

  server.requestTimeout = 10_000;
  server.headersTimeout = 5000;
  let port = 0;
  await new Promise<void>((ok, nein) => {
    server.once('error', nein);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', nein);
      ok();
    });
  });
  port = (server.address() as AddressInfo).port;
  server.on('error', () => o.log('Tür-Dienst: Fehler am Socket'));
  const pfad = tuerPfad(o.appDataDir);
  const tuer: TuerDatei = { v: 1, port, schluessel, pid: process.pid, start: jetzt() };
  try {
    schreibeAtomar(pfad, JSON.stringify(tuer));
  } catch (e) {
    server.close();
    throw e;
  }
  o.log(`Tür-Dienst: lauscht auf 127.0.0.1:${port}`);

  return {
    port,
    async stoppe(): Promise<void> {
      try {
        const da = JSON.parse(readFileSync(pfad, 'utf8')) as Partial<TuerDatei>;
        if (da.schluessel === schluessel) unlinkSync(pfad);
      } catch {
        /* Datei fehlt oder ist nicht lesbar: nichts zu löschen */
      }
      server.closeAllConnections();
      await new Promise<void>((ok) => server.close(() => ok()));
      o.log('Tür-Dienst: beendet');
    },
  };
}

// ── Ende des Moduls ──

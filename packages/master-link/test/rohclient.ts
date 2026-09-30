// Ein Protokoll-Client „von Hand“ (ohne Pin) — für Server-Tests vor dem echten Client.
import { connect, type TLSSocket } from 'node:tls';
import { certFingerprint } from '@jm/auth-core';
import { GRENZEN } from '../src/fristen';
import type { Nachricht } from '../src/rahmen';
import { Verbindung } from '../src/verbindung';
import { warte } from './helfer';

export interface RohClient {
  v: Verbindung;
  socket: TLSSocket;
  fp: string;
  hallo: Extract<Nachricht, { t: 'hallo' }>;
  nachrichten: Nachricht[];
  naechste(t: Nachricht['t'], maxMs?: number): Promise<Nachricht | null>;
  beendet(): boolean;
  zu(): void;
}

export async function verbindeRoh(port: number, host = '127.0.0.1'): Promise<RohClient> {
  const socket = connect({ host, port, rejectUnauthorized: false });
  await new Promise<void>((ok, fehler) => {
    socket.once('secureConnect', () => ok());
    socket.once('error', fehler);
  });
  const fp = certFingerprint(socket.getPeerCertificate().raw);
  const v = new Verbindung(socket, GRENZEN.nachAnmeldung);
  const nachrichten: Nachricht[] = [];
  let ende = false;
  v.on('nachricht', (n: Nachricht) => nachrichten.push(n));
  v.on('ende', () => {
    ende = true;
  });
  const naechste = async (t: Nachricht['t'], maxMs = 2000): Promise<Nachricht | null> => {
    const ablauf = Date.now() + maxMs;
    while (Date.now() < ablauf) {
      const i = nachrichten.findIndex((n) => n.t === t);
      if (i >= 0) return nachrichten.splice(i, 1)[0];
      await warte(5);
    }
    return null;
  };
  const hallo = await naechste('hallo');
  if (!hallo || hallo.t !== 'hallo') throw new Error('kein hallo');
  return { v, socket, fp, hallo, nachrichten, naechste, beendet: () => ende, zu: () => socket.destroy() };
}

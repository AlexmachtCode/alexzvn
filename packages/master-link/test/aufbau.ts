import { randomUUID } from 'node:crypto';
import { erzeugeSchluesselpaar, signiereAnmeldung, type Schluesselpaar } from '../src/beweis';
import type { Fristen } from '../src/fristen';
import { PROTOKOLL } from '../src/rahmen';
import { MasterLinkServer, type ServerOptionen } from '../src/server';
import { SpeicherVerbund, type Identitaet } from '../src/speicher';
import { verbindeRoh, type RohClient } from './rohclient';
import { erzeugeTestZertifikat } from './zertifikate';

export interface TestRechner {
  rechnerId: string;
  paar: Schluesselpaar;
}

export interface Aufbau {
  server: MasterLinkServer;
  port: number;
  identitaet: Identitaet;
  verbund: SpeicherVerbund;
  /** Gekoppelter fremder Rechner „Regie-Laptop 2“. */
  slave: TestRechner;
  /** Selbstkopplung des Master-Rechners. */
  eigen: TestRechner;
}

export function neueIdentitaet(name = 'Regie-PC'): Identitaet {
  const z = erzeugeTestZertifikat();
  return { masterId: randomUUID(), name, zertifikat: z.cert, schluessel: z.key };
}

/** Master auf 127.0.0.1, freier Port (0), ein fremder und der eigene Rechner gekoppelt. */
export async function baueServer(teil: Partial<ServerOptionen> = {}, fristen: Partial<Fristen> = {}): Promise<Aufbau> {
  const identitaet = teil.identitaet ?? neueIdentitaet();
  const slave: TestRechner = { rechnerId: 'rechner-b', paar: erzeugeSchluesselpaar() };
  const eigen: TestRechner = { rechnerId: 'rechner-a', paar: erzeugeSchluesselpaar() };
  const verbund = new SpeicherVerbund([
    { rechnerId: eigen.rechnerId, name: 'Regie-PC', schluessel: eigen.paar.oeffentlich, gekoppeltAm: 1, zuletztGesehen: null, letzteAdresse: null, dieserRechner: true },
    { rechnerId: slave.rechnerId, name: 'Regie-Laptop 2', schluessel: slave.paar.oeffentlich, gekoppeltAm: 1, zuletztGesehen: null, letzteAdresse: null, dieserRechner: false },
  ]);
  const server = new MasterLinkServer({
    identitaet,
    verbund,
    eigeneRechnerId: eigen.rechnerId,
    suiteVersion: '0.12.0',
    lauschAdressen: ['127.0.0.1'],
    port: 0,
    fristen,
    ...teil,
  });
  await server.starte();
  return { server, port: server.port(), identitaet, verbund, slave, eigen };
}

export async function meldeAn(a: Aufbau, rechner: TestRechner = a.slave, appId = 'jm-timer', pid = 1): Promise<RohClient> {
  const c = await verbindeRoh(a.port);
  c.v.sende({
    t: 'anmelden',
    protokoll: PROTOKOLL,
    rechnerId: rechner.rechnerId,
    rechnerName: 'Regie-Laptop 2',
    signatur: signiereAnmeldung(rechner.paar.privat, c.fp, c.hallo.nonce, rechner.rechnerId),
    teilnehmer: { art: 'tool', appId, name: appId, version: '0.12.0', pid },
  });
  return c;
}

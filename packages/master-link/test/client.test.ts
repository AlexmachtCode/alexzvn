import { EventEmitter } from 'node:events';
import { connect as netConnect, createServer as netServer, type Socket } from 'node:net';
import { createServer as tlsServer, type Server as TlsServer, type TLSSocket } from 'node:tls';
import type { AddressInfo } from 'node:net';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { randomNonce } from '@jm/auth-core';
import { MasterLinkClient, verbundWert, versucheAnmeldung, type AnmeldeParameter, type ClientZustand, type Versuch } from '../src/client';
import { masterLinkPfad, schreibeMasterLinkDatei, type MasterLinkDatei } from '../src/datei';
import { fingerprintVonPem } from '../src/beweis';
import { PIN_FALSCH, type VersuchsErgebnis } from '../src/fehler';
import { fristen, GRENZEN, type Fristen } from '../src/fristen';
import { koppele } from '../src/koppeln';
import type { MasterSichtung, SucheLike } from '../src/mdns';
import { kodiere, type Nachricht } from '../src/rahmen';
import { MasterLinkServer } from '../src/server';
import { Verbindung } from '../src/verbindung';
import { baueServer, neueIdentitaet, type Aufbau } from './aufbau';
import { abschnitt, bis, gleich, pruefe, tempOrdner, warte } from './helfer';
import { zertifikatMitGueltigkeit } from './zertifikate';

const KURZ: Partial<Fristen> = {
  dateiPruefMs: 50, rueckzugBasisMs: 50, rueckzugMaxMs: 200, tcpMs: 300, tlsHalloMs: 400, angemeldetMs: 400,
  stilleMs: 600, pulsMs: 150, zertifikatWiederholMs: 300, protokollWiederholMs: 300, ersetztWiederholMs: 400,
  lastMinMs: 100, suchrundeMs: 30,
};
const teilnehmer = { art: 'tool' as const, appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 7 };

function dateiFuer(a: Aufbau, teil: Partial<MasterLinkDatei> = {}): MasterLinkDatei {
  return {
    version: 1,
    rolle: 'slave',
    rechner: { id: a.slave.rechnerId, name: 'Regie-Laptop 2' },
    netzwerk: { karte: null },
    kopplung: {
      masterId: a.identitaet.masterId, masterName: 'Regie-PC', fingerprint: a.server.fingerprint,
      zertifikat: a.identitaet.zertifikat, port: a.port, adressen: ['127.0.0.1'], letzteAdresse: null,
      festeAdresse: null, schluessel: a.slave.paar,
    },
    ...teil,
  };
}

function neuerClient(pfad: string, extra: Partial<ConstructorParameters<typeof MasterLinkClient>[0]> = {}): MasterLinkClient {
  return new MasterLinkClient({ dateiPfad: pfad, teilnehmer, fristen: KURZ, suche: null, ...extra });
}

const art = (c: MasterLinkClient): string => verbundWert(c.zustand());

class FakeSuche implements SucheLike {
  sichtungen: MasterSichtung[] = [];
  runden = 0;
  setzeKarten(): void { /* egal */ }
  stoppe(): void { /* egal */ }
  async runde(): Promise<MasterSichtung[]> {
    this.runden++;
    return this.sichtungen;
  }
}

/** Socket, der nie „close“ meldet und sich nicht schließen lässt (Standby, halboffene Verbindung). */
class StummerSocket extends EventEmitter {
  destroyed = false;
  remoteAddress = '10.0.0.1';
  end(): void { /* schweigt */ }
  write(): boolean { return true; }
  destroy(): void { this.destroyed = true; }
}

/** Master-Attrappe auf dem Port von `a`: sendet „hallo“, ruft bei „anmelden“ `antwort`, zählt Verbindungen. */
async function attrappe(a: Aufbau, antwort: (ts: TLSSocket, v: Verbindung) => void): Promise<{ srv: TlsServer; zaehler: { n: number } }> {
  await a.server.stoppe();
  const zaehler = { n: 0 };
  const srv = tlsServer({ key: a.identitaet.schluessel, cert: a.identitaet.zertifikat }, (ts) => {
    zaehler.n++;
    const v = new Verbindung(ts, 1 << 20);
    v.on('nachricht', (n: Nachricht) => {
      if (n.t === 'anmelden') antwort(ts, v);
    });
    v.sende({ t: 'hallo', protokoll: 1, masterId: a.identitaet.masterId, name: 'Regie-PC', nonce: randomNonce() });
  });
  await new Promise<void>((r) => srv.listen(a.port, '127.0.0.1', r));
  return { srv, zaehler };
}

export async function laufe(): Promise<void> {
  abschnitt('Client: verbinden, Master weg und zurück');
  {
    const a = await baueServer({}, { pulsMs: 150, stilleMs: 600 });
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    const angemeldet: string[] = [];
    c.on('angemeldet', (x: { adresse: string }) => angemeldet.push(x.adresse));
    c.starte();
    await bis(() => art(c) === 'verbunden');
    gleich(art(c), 'verbunden', 'Client verbindet sich selbst');
    gleich(a.server.teilnehmer().map((t) => t.appId), ['jm-timer'], 'Master sieht das Tool');
    gleich(angemeldet, ['127.0.0.1'], 'Ereignis „angemeldet“ mit Adresse');
    await a.server.stoppe();
    await bis(() => art(c) !== 'verbunden');
    pruefe(art(c) !== 'verbunden', 'Master weg → nicht mehr verbunden');
    // Gleicher Puls wie a: sonst trennt die Stille-Frist des Clients (600 ms) mitten in den Prüffenstern unten.
    const b = new MasterLinkServer({ identitaet: a.identitaet, verbund: a.verbund, eigeneRechnerId: 'rechner-a', suiteVersion: '0.12.0', lauschAdressen: ['127.0.0.1'], port: a.port, fristen: { pulsMs: 150, stilleMs: 600 } });
    await b.starte();
    await bis(() => art(c) === 'verbunden', 3000);
    gleich(art(c), 'verbunden', 'Master zurück → ohne Zutun wieder verbunden');

    abschnitt('Client: entfernt, Datei-Änderungen');
    b.entferne('rechner-b');
    await bis(() => art(c) === 'fehler:unbekannt', 1000);
    gleich(art(c), 'fehler:unbekannt', 'entfernt während verbunden → fehler:unbekannt binnen 1 s');
    let versucheDanach = 0;
    const zaehle = (z: ClientZustand): void => {
      if (z.art === 'verbindet') versucheDanach++;
    };
    c.on('zustand', zaehle);
    await warte(500);
    c.off('zustand', zaehle);
    gleich(versucheDanach, 0, 'keine neuen Versuche nach „unbekannt“');
    const neu = dateiFuer(a);
    b.oeffneKopplung();
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: b.kopplungsStand().code!, rechner: { id: a.slave.rechnerId, name: 'Regie-Laptop 2' } });
    pruefe(r.ok, 'neu gekoppelt (Launcher-Weg)');
    if (r.ok) {
      r.verbindung.schliesse();
      schreibeMasterLinkDatei(pfad, { ...neu, kopplung: r.kopplung });
    }
    await bis(() => art(c) === 'verbunden', 3000);
    gleich(art(c), 'verbunden', 'Dateiänderung (neuer Schlüssel) → Neuaufbau, verbunden');
    const seit = (c.zustand() as Extract<ClientZustand, { art: 'verbunden' }>).seit;
    const d = { ...neu, kopplung: { ...(r.ok ? r.kopplung : neu.kopplung!), adressen: ['127.0.0.1', '10.9.9.9'] } };
    schreibeMasterLinkDatei(pfad, d);
    await warte(300);
    pruefe(art(c) === 'verbunden' && (c.zustand() as Extract<ClientZustand, { art: 'verbunden' }>).seit === seit, 'nur Adressen geändert → keine Trennung');
    rmSync(pfad);
    mkdirSync(pfad); // Ordner statt Datei: Lesen wirft EISDIR — ein I/O-Fehler wie EBUSY vom Virenscanner
    await warte(300);
    pruefe(art(c) === 'verbunden' && (c.zustand() as Extract<ClientZustand, { art: 'verbunden' }>).seit === seit,
      'Datei nicht lesbar (I/O-Fehler) → letzter gültiger Stand bleibt, keine Trennung (Spec 7.3)');
    rmSync(pfad, { recursive: true });
    writeFileSync(pfad, 'Müll');
    await bis(() => art(c) === 'fehler:datei', 1000);
    gleich(art(c), 'fehler:datei', 'Datei zweimal unlesbar → fehler:datei (Review Focus 3)');
    schreibeMasterLinkDatei(pfad, d);
    await bis(() => art(c) === 'verbunden', 3000);
    gleich(art(c), 'verbunden', 'Datei repariert → wieder verbunden');
    rmSync(pfad);
    await bis(() => art(c) === 'aus', 1000);
    gleich(art(c), 'aus', 'Datei im Betrieb gelöscht → aus, kein Absturz (Review Focus 3)');
    await c.stoppe();
    await b.stoppe();
  }

  abschnitt('Client: Zertifikat, Uhr, Protokoll, kein Master, verweigert');
  {
    const a = await baueServer();
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    await a.server.stoppe();
    const erneuert = new MasterLinkServer({ identitaet: neueIdentitaet(), verbund: a.verbund, eigeneRechnerId: 'rechner-a', suiteVersion: '0.12.0', lauschAdressen: ['127.0.0.1'], port: a.port });
    await erneuert.starte();
    const c = neuerClient(pfad);
    c.starte();
    await bis(() => art(c) === 'fehler:zertifikat', 2000);
    gleich(art(c), 'fehler:zertifikat', 'Master-Identität erneuert → fehler:zertifikat (CA-Prüfung im Handshake)');
    await c.stoppe();
    await erneuert.stoppe();
  }
  {
    // Pin im Handshake: das Zertifikat besteht die CA-Prüfung, nur der Fingerprint-Vergleich bzw. die masterId fällt.
    const a = await baueServer();
    const k = dateiFuer(a).kopplung!;
    const basis = { adresse: '127.0.0.1', rechner: { id: a.slave.rechnerId, name: 'Regie-Laptop 2' }, teilnehmer, f: fristen(KURZ) };
    const pin = await versucheAnmeldung({ ...basis, kopplung: { ...k, fingerprint: '00'.repeat(32) } });
    gleich(pin.ok ? null : pin.ergebnis, { art: 'fehler', code: PIN_FALSCH }, 'Zertifikat gültig, Fingerprint ≠ Pin → PIN_FALSCH');
    if (pin.ok) pin.a.v.schliesse();
    const fremdeId = await versucheAnmeldung({ ...basis, kopplung: { ...k, masterId: 'anderer-master' } });
    gleich(fremdeId.ok ? null : fremdeId.ergebnis, { art: 'fehler', code: PIN_FALSCH }, 'hallo mit fremder masterId → PIN_FALSCH');
    if (fremdeId.ok) fremdeId.a.v.schliesse();
    await a.server.stoppe();
  }
  {
    const z = zertifikatMitGueltigkeit(new Date(Date.now() + 3600e3), new Date(Date.now() + 3650 * 864e5));
    const srv = tlsServer({ key: z.key, cert: z.cert }, () => { /* nie erreicht */ });
    srv.on('tlsClientError', (_e, s) => s.destroy());
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    const a = await baueServer();
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, { ...d, kopplung: { ...d.kopplung!, zertifikat: z.cert, fingerprint: fingerprintVonPem(z.cert), port: (srv.address() as AddressInfo).port } });
    const c = neuerClient(pfad);
    c.starte();
    await bis(() => art(c) === 'fehler:uhr', 2000);
    gleich(art(c), 'fehler:uhr', 'Zertifikat noch nicht gültig → fehler:uhr (nicht „anderer Master“)');
    await c.stoppe();
    srv.close();
    await a.server.stoppe();
  }
  {
    const a = await baueServer();
    await a.server.stoppe();
    const srv = tlsServer({ key: a.identitaet.schluessel, cert: a.identitaet.zertifikat }, (ts) => {
      const v = new Verbindung(ts, 1 << 20);
      v.on('nachricht', (n: Nachricht) => {
        if (n.t === 'anmelden') { v.sende({ t: 'abgelehnt', grund: 'protokoll', master: 2, suite: '0.13.0' }); v.schliesse(); }
      });
      v.sende({ t: 'hallo', protokoll: 2, masterId: a.identitaet.masterId, name: 'Regie-PC', nonce: randomNonce() });
    });
    await new Promise<void>((r) => srv.listen(a.port, '127.0.0.1', r));
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    c.starte();
    await bis(() => art(c) === 'fehler:protokoll', 2000);
    const z = c.zustand();
    pruefe(z.art === 'fehler' && z.text.includes('Launcher 0.13.0 (Protokoll 2)'), 'fehler:protokoll nennt den Stand des Masters');
    await c.stoppe();
    srv.close();
  }
  {
    const a = await baueServer();
    await a.server.stoppe();
    const sockets: Socket[] = [];
    const stumm = netServer((s) => { sockets.push(s); s.on('error', () => {}); });
    await new Promise<void>((r) => stumm.listen(a.port, '127.0.0.1', r));
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    c.starte();
    await bis(() => art(c) === 'fehler:kein-master', 2000);
    gleich(art(c), 'fehler:kein-master', 'TCP steht, aber kein TLS/hallo → kein-master');
    await c.stoppe();
    sockets.forEach((s) => s.destroy());
    stumm.close();
    const c2 = neuerClient(pfad);
    c2.starte();
    await bis(() => art(c2) === 'fehler:verweigert', 2000);
    gleich(art(c2), 'fehler:verweigert', 'niemand lauscht → verweigert');
    await c2.stoppe();
    // Spec 11.1 Nr. 5 „zusätzlich ein Nicht-TLS-Dienst“: Klartext statt ServerHello → ERR_SSL_* → kein-master
    const klartext = netServer((s) => { s.on('error', () => {}); s.write('HTTP/1.1 400 Bad Request\r\n\r\n'); });
    await new Promise<void>((r) => klartext.listen(0, '127.0.0.1', r));
    const d3 = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, { ...d3, kopplung: { ...d3.kopplung!, port: (klartext.address() as AddressInfo).port } });
    const c3 = neuerClient(pfad);
    c3.starte();
    await bis(() => art(c3) === 'fehler:kein-master', 2000);
    gleich(art(c3), 'fehler:kein-master', 'Nicht-TLS-Dienst auf dem Port → kein-master (nicht sonstig)');
    await c3.stoppe();
    klartext.close();
  }

  abschnitt('Client: Zeilengrenze 4 KiB vor, 1 MiB nach der Anmeldung (Spec 6.1)');
  {
    const a = await baueServer();
    await a.server.stoppe();
    let grossVorAngemeldet = true;
    let verbindungen = 0;
    const srv = tlsServer({ key: a.identitaet.schluessel, cert: a.identitaet.zertifikat }, (ts) => {
      verbindungen++;
      const v = new Verbindung(ts, 1 << 20);
      v.on('nachricht', (n: Nachricht) => {
        if (n.t === 'puls') v.sende({ t: 'puls' }); // hält die Stille-Frist des Clients fern
        if (n.t !== 'anmelden') return;
        if (grossVorAngemeldet) ts.write(`{"t":"gross","x":"${'y'.repeat(GRENZEN.vorAnmeldung)}"}\n`);
        v.sende({ t: 'angemeldet', adressen: [], suite: '0.12.0' });
        if (!grossVorAngemeldet) setTimeout(() => ts.write(`{"t":"gross","x":"${'y'.repeat(100_000)}"}\n`), 100);
      });
      v.sende({ t: 'hallo', protokoll: 1, masterId: a.identitaet.masterId, name: 'Regie-PC', nonce: randomNonce() });
    });
    await new Promise<void>((r) => srv.listen(a.port, '127.0.0.1', r));
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    const gesehen = new Set<string>();
    c.on('zustand', () => gesehen.add(art(c)));
    c.starte();
    await bis(() => art(c) === 'fehler:kein-master', 2000);
    pruefe(art(c) === 'fehler:kein-master' && !gesehen.has('verbunden'), 'Zeile > 4 KiB vor „angemeldet“ → Verbindung zu (kein-master), nie verbunden');
    await c.stoppe();
    grossVorAngemeldet = false;
    verbindungen = 0;
    const c2 = neuerClient(pfad);
    c2.starte();
    await bis(() => art(c2) === 'verbunden', 2000);
    await warte(400);
    pruefe(art(c2) === 'verbunden' && verbindungen === 1, `nach „angemeldet“ sind 100-KB-Zeilen erlaubt (1 MiB), ${verbindungen} Verbindung(en)`);
    await c2.stoppe();
    srv.close();
  }

  abschnitt('Client: Stille (Review Focus 5) und ersetzt');
  {
    const a = await baueServer();
    await a.server.stoppe();
    let verbindungen = 0;
    const srv = tlsServer({ key: a.identitaet.schluessel, cert: a.identitaet.zertifikat }, (ts) => {
      verbindungen++;
      const v = new Verbindung(ts, 1 << 20);
      v.on('nachricht', (n: Nachricht) => {
        if (n.t === 'anmelden') v.sende({ t: 'angemeldet', adressen: [], suite: '0.12.0' }); // danach: Schweigen
      });
      v.sende({ t: 'hallo', protokoll: 1, masterId: a.identitaet.masterId, name: 'Regie-PC', nonce: randomNonce() });
    });
    await new Promise<void>((r) => srv.listen(a.port, '127.0.0.1', r));
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    c.starte();
    await bis(() => verbindungen >= 2, 3000);
    pruefe(verbindungen >= 2, 'halboffene Verbindung (keine Zeile) → nach stilleMs selbst neu aufgebaut');
    await c.stoppe();
    srv.close();
  }
  {
    const a = await baueServer({}, { pulsMs: 150, stilleMs: 600 });
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const gesehen = new Set<string>();
    const luecken: number[] = [];
    // Der nächste Versuch wird am Anmeldeaufruf gemessen: der Fehler bleibt über die Wiederholung hinweg stehen (Endprüfung A4).
    const mitMessung = (): MasterLinkClient => {
      let ersetztSeit: number | null = null;
      const c = neuerClient(pfad, {
        anmelden: (p: AnmeldeParameter): Promise<Versuch> => {
          if (ersetztSeit !== null) {
            luecken.push(Date.now() - ersetztSeit);
            ersetztSeit = null;
          }
          return versucheAnmeldung(p);
        },
      });
      c.on('zustand', () => {
        const w = art(c);
        gesehen.add(w);
        if (w === 'fehler:ersetzt') ersetztSeit = Date.now();
      });
      return c;
    };
    const c1 = mitMessung();
    const c2 = mitMessung();
    c1.starte();
    await bis(() => art(c1) === 'verbunden');
    c2.starte();
    await bis(() => gesehen.has('fehler:ersetzt'), 2000);
    pruefe(gesehen.has('fehler:ersetzt'), 'zweite Instanz mit gleicher Kennung → fehler:ersetzt');
    await bis(() => luecken.length > 0, 2000);
    pruefe(luecken.length > 0 && Math.min(...luecken) >= 300,
      `nach „ersetzt“ erst nach ersetztWiederholMs (400) neu versucht: ${luecken.join(', ')} ms (kein Sekundentakt-Pingpong)`);
    await c1.stoppe();
    await c2.stoppe();
    await a.server.stoppe();
  }

  abschnitt('Client: Kandidaten, mDNS, Rolle master (Test-Naht anmelden)');
  {
    const a = await baueServer();
    await a.server.stoppe();
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, { ...d, kopplung: { ...d.kopplung!, adressen: ['10.0.0.9'] } });
    const versucht: string[] = [];
    const anmelden = async (p: AnmeldeParameter): Promise<Versuch> => {
      versucht.push(p.adresse);
      return { ok: false, ergebnis: { art: 'tcp-timeout' } };
    };
    const suche = new FakeSuche();
    suche.sichtungen = [
      { masterId: 'anderer-saal', name: 'Regie-PC', fpKurz: 'bb', protokoll: 1, adressen: ['10.0.0.60'] },
      { masterId: a.identitaet.masterId, name: 'Regie-PC', fpKurz: 'aa', protokoll: 1, adressen: ['10.0.0.50'] },
    ];
    const c = neuerClient(pfad, { suche, anmelden });
    c.starte();
    await bis(() => art(c) === 'fehler:zeit', 1000);
    gleich(art(c), 'fehler:zeit', 'Timeout + eigener Master per mDNS gesehen → zeit (Firewall?)');
    gleich(versucht.slice(0, 2), ['10.0.0.50', '10.0.0.9'], 'nur die eigene masterId (nicht der zweite „Regie-PC“), dann Datei');
    pruefe(!versucht.includes('10.0.0.60'), 'fremder Master gleichen Namens wird nie versucht (Review Focus 4)');
    await c.stoppe();

    suche.sichtungen = [];
    const c2 = neuerClient(pfad, { suche, anmelden });
    c2.starte();
    await bis(() => art(c2) === 'fehler:nicht-gefunden', 1000);
    gleich(art(c2), 'fehler:nicht-gefunden', 'Timeout ohne mDNS-Sichtung → nicht-gefunden (Windows-Stealth)');
    await c2.stoppe();

    versucht.length = 0;
    const rundenVorher = suche.runden;
    schreibeMasterLinkDatei(pfad, { ...d, rolle: 'master', kopplung: { ...d.kopplung!, adressen: ['10.0.0.9'] } });
    const c3 = neuerClient(pfad, { suche, anmelden });
    c3.starte();
    await bis(() => versucht.length > 0, 1000);
    gleich([...new Set(versucht)], ['127.0.0.1'], 'Rolle master → nur 127.0.0.1');
    gleich(suche.runden, rundenVorher, 'Rolle master → keine mDNS-Suchrunde');
    await c3.stoppe();
  }

  abschnitt('Client: Verbindung nach dem Koppeln übernehmen');
  {
    const a = await baueServer({}, { pulsMs: 150, stilleMs: 600 });
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, { ...d, rechner: { id: 'rechner-c', name: 'Neuer PC' }, kopplung: null });
    const c = new MasterLinkClient({ dateiPfad: pfad, teilnehmer: { ...teilnehmer, art: 'launcher', appId: 'jm-launcher' }, fristen: KURZ, suche: null });
    c.starte();
    await bis(() => art(c) === 'aus');
    gleich(art(c), 'aus', 'Slave ohne Kopplung → aus (untätig)');
    a.server.oeffneKopplung();
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: a.server.kopplungsStand().code!, rechner: { id: 'rechner-c', name: 'Neuer PC' } });
    pruefe(r.ok, 'gekoppelt');
    if (r.ok) {
      schreibeMasterLinkDatei(pfad, { ...d, rechner: { id: 'rechner-c', name: 'Neuer PC' }, kopplung: r.kopplung });
      c.uebernehme(r.verbindung, r.kopplung, r.masterName);
      await bis(() => art(c) === 'verbunden');
      gleich(art(c), 'verbunden', 'übernommene Verbindung ist angemeldet');
      const seit = (c.zustand() as Extract<ClientZustand, { art: 'verbunden' }>).seit;
      await warte(300);
      pruefe(art(c) === 'verbunden' && (c.zustand() as Extract<ClientZustand, { art: 'verbunden' }>).seit === seit,
        'Dateibeobachter baut die übernommene Verbindung nicht neu auf');
    }
    await c.stoppe();
    gleich(art(c), 'aus', 'stoppe → aus');
    c.starte();
    await bis(() => art(c) === 'verbunden', 2000);
    gleich(art(c), 'verbunden', 'starte() nach stoppe(), Datei unverändert → verbindet wieder');
    await c.stoppe();
    await a.server.stoppe();
  }

  abschnitt('Client: unbrauchbarer Schlüssel, Ausnahmen in Handlern (Spec 7.3: stürzt nie ab)');
  {
    // GEMESSEN: privat 'AAAA' bestand die Dateiprüfung, signiereAnmeldung warf im Handler → Exit 1 in jedem Tool.
    const a = await baueServer();
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, { ...d, kopplung: { ...d.kopplung!, schluessel: { ...a.slave.paar, privat: 'AAAA' } } });
    const c = neuerClient(pfad);
    const gesehen = new Set<string>();
    c.on('zustand', () => gesehen.add(art(c)));
    c.starte();
    await bis(() => art(c) === 'fehler:datei', 1000);
    gleich(art(c), 'fehler:datei', 'privater Schlüssel unbrauchbar → fehler:datei, Prozess lebt');
    pruefe(!gesehen.has('verbindet'), '… ohne Verbindungsversuch');
    await c.stoppe();
    await a.server.stoppe();
  }
  {
    // Eine Ausnahme in einem Socket-Handler wäre ungefangen und beendete den ganzen Prozess (jedes Tool).
    const a = await baueServer();
    const wirft = { get id(): string { throw Object.assign(new Error('Testwurf'), { code: 'TESTWURF' }); }, name: 'Regie-Laptop 2' };
    const r = await versucheAnmeldung({ adresse: '127.0.0.1', kopplung: dateiFuer(a).kopplung!, rechner: wirft, teilnehmer, f: fristen(KURZ) });
    gleich(r.ok ? null : r.ergebnis, { art: 'fehler', code: 'TESTWURF' }, 'Ausnahme im Handler von versucheAnmeldung → Fehlerergebnis statt Absturz');
    await a.server.stoppe();
  }
  {
    const a = await baueServer({}, { pulsMs: 150, stilleMs: 600 });
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    const rechner = { id: 'rechner-c', name: 'Neuer PC' };
    schreibeMasterLinkDatei(pfad, { ...d, rechner, kopplung: null });
    const c = new MasterLinkClient({ dateiPfad: pfad, teilnehmer: { ...teilnehmer, art: 'launcher', appId: 'jm-launcher' }, fristen: KURZ, suche: null });
    const fehler: string[] = [];
    c.on('zustand', (z: ClientZustand) => { if (z.art === 'fehler') fehler.push(`${z.code}/${z.errCode ?? ''}`); });
    c.starte();
    a.server.oeffneKopplung();
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: a.server.kopplungsStand().code!, rechner });
    pruefe(r.ok, 'gekoppelt');
    if (r.ok) {
      schreibeMasterLinkDatei(pfad, { ...d, rechner, kopplung: r.kopplung });
      c.uebernehme(r.verbindung, r.kopplung, r.masterName);
      // Gleich nach uebernehme() wartet der Handler; die echte Antwort des Masters ist noch nicht gelesen.
      const wurf = { t: 'angemeldet', suite: '0.12.0', get adressen(): string[] { throw Object.assign(new Error('Testwurf'), { code: 'TESTWURF' }); } };
      let durch = false;
      try {
        r.verbindung.emit('nachricht', wurf);
      } catch {
        durch = true;
      }
      pruefe(!durch, 'Ausnahme im Handler von warteAufAngemeldet dringt nicht bis zum Socket durch (dort: Absturz)');
      await bis(() => fehler.length > 0, 1000);
      gleich(fehler[0], 'sonstig/TESTWURF', '… sondern wird Fehlerergebnis: fehler:sonstig mit errCode');
      await bis(() => art(c) === 'verbunden', 3000);
      gleich(art(c), 'verbunden', '… danach normal neu verbunden');
    }
    await c.stoppe();
    await a.server.stoppe();
  }

  abschnitt('Client: starte() nach stoppe(), Datei nur in nicht relevanten Feldern geändert');
  {
    // Der Launcher schreibt nach „angemeldet“ letzteAdresse/adressen/masterName: das trennt nie, darf aber auch kein starte() verschlucken.
    const a = await baueServer({}, { pulsMs: 150, stilleMs: 600 });
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, d);
    const c = neuerClient(pfad);
    c.starte();
    await bis(() => art(c) === 'verbunden');
    gleich(art(c), 'verbunden', 'verbunden');
    await c.stoppe();
    gleich(art(c), 'aus', 'stoppe → aus');
    await warte(30); // andere mtime als beim ersten Schreiben
    schreibeMasterLinkDatei(pfad, { ...d, kopplung: { ...d.kopplung!, letzteAdresse: '127.0.0.1', adressen: ['127.0.0.1', '10.9.9.9'], masterName: 'Regie-PC (Saal 2)' } });
    c.starte();
    await bis(() => art(c) === 'verbunden', 2000);
    gleich(art(c), 'verbunden', 'stoppe → nur Adressen/Namen ändern → starte → verbunden (nicht dauerhaft aus)');
    await c.stoppe();
    await a.server.stoppe();
  }

  abschnitt('Client: Übergabe nach „angemeldet“ ohne Lücke, Stille beendet selbst (Review Focus 5)');
  {
    // „angemeldet“ und „abgelehnt ersetzt“ kommen in EINEM Schreibvorgang: die zweite Zeile darf nicht ins Leere gehen.
    const a = await baueServer();
    const { srv } = await attrappe(a, (ts, v) => {
      ts.write(kodiere({ t: 'angemeldet', adressen: [], suite: '0.12.0' }) + kodiere({ t: 'abgelehnt', grund: 'ersetzt' }));
      v.schliesse();
    });
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const gesehen = new Set<string>();
    const luecken: number[] = [];
    let ersetztSeit: number | null = null;
    // Gemessen am Anmeldeaufruf: der Fehler bleibt über die Wiederholung hinweg stehen (Endprüfung A4).
    const c = neuerClient(pfad, {
      anmelden: (p: AnmeldeParameter): Promise<Versuch> => {
        if (ersetztSeit !== null) {
          luecken.push(Date.now() - ersetztSeit);
          ersetztSeit = null;
        }
        return versucheAnmeldung(p);
      },
    });
    c.on('zustand', () => {
      const w = art(c);
      gesehen.add(w);
      if (w === 'fehler:ersetzt') ersetztSeit = Date.now();
    });
    c.starte();
    await bis(() => gesehen.has('fehler:ersetzt'), 1500);
    pruefe(gesehen.has('fehler:ersetzt'), '„angemeldet“ + „abgelehnt ersetzt“ in einem Schreibvorgang → fehler:ersetzt');
    await bis(() => luecken.length > 0, 1500);
    pruefe(luecken.length > 0 && Math.min(...luecken) >= 300,
      `… und neuer Versuch erst nach ersetztWiederholMs (400): ${luecken.join(', ')} ms`);
    await c.stoppe();
    srv.close();
  }
  {
    // Dasselbe auf dem Weg nach dem Koppeln (uebernehme → warteAufAngemeldet): die Antwort kommt als ein Chunk aus zwei Zeilen.
    const a = await baueServer();
    await a.server.stoppe();
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, d);
    const c = neuerClient(pfad);
    const gesehen = new Set<string>();
    c.on('zustand', () => gesehen.add(art(c)));
    c.starte();
    await bis(() => art(c) === 'fehler:verweigert', 1000);
    const socket = new StummerSocket();
    c.uebernehme(new Verbindung(socket as unknown as TLSSocket, GRENZEN.vorAnmeldung), d.kopplung!, 'Regie-PC');
    socket.emit('data', Buffer.from(kodiere({ t: 'angemeldet', adressen: [], suite: '0.12.0' }) + kodiere({ t: 'abgelehnt', grund: 'ersetzt' })));
    await bis(() => gesehen.has('fehler:ersetzt'), 1500);
    pruefe(gesehen.has('fehler:ersetzt'), 'übernommene Verbindung: „angemeldet“ + „abgelehnt ersetzt“ in einem Chunk → fehler:ersetzt');
    await c.stoppe();
  }
  {
    // Nach „angemeldet“ bricht eine Zeile den Rahmen (künftiger grund): das ende darf nicht ins Leere gehen.
    const a = await baueServer();
    const { srv, zaehler } = await attrappe(a, (ts) => {
      ts.write(`${kodiere({ t: 'angemeldet', adressen: [], suite: '0.12.0' })}{"t":"abgelehnt","grund":"kuenftiger-grund"}\n`);
    });
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    c.starte();
    await bis(() => zaehler.n >= 2, 3000);
    pruefe(zaehler.n >= 2, `„angemeldet“ + rahmenbrechende Zeile in einem Schreibvorgang → Neuaufbau statt dauerhaft „verbunden“ (${zaehler.n} Verbindungen)`);
    await c.stoppe();
    srv.close();
  }
  {
    // Der Socket meldet nie „close“: die Stille-Frist muss die Verbindung selbst beenden, und stoppe() das Puls-Intervall löschen.
    const a = await baueServer();
    await a.server.stoppe();
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    let versuche = 0;
    const anmelden = async (): Promise<Versuch> => {
      versuche++;
      const v = new Verbindung(new StummerSocket() as unknown as TLSSocket, GRENZEN.nachAnmeldung);
      return { ok: true, a: { v, adresse: '10.0.0.1', masterName: 'Regie-PC', suite: '0.12.0', adressen: [] } };
    };
    const pulse: unknown[] = [];
    const geloescht = new Set<unknown>();
    const setzeIntervall = globalThis.setInterval;
    const loescheIntervall = globalThis.clearInterval;
    globalThis.setInterval = ((f: () => void, ms?: number) => {
      const h = setzeIntervall(f, ms);
      if (ms === KURZ.pulsMs) pulse.push(h);
      return h;
    }) as unknown as typeof setInterval;
    globalThis.clearInterval = ((h: Parameters<typeof clearInterval>[0]) => {
      geloescht.add(h);
      loescheIntervall(h);
    }) as typeof clearInterval;
    try {
      const c = neuerClient(pfad, { anmelden });
      c.starte();
      await bis(() => versuche >= 2, 3000);
      pruefe(versuche >= 2, `Stille-Frist beendet die Verbindung selbst, auch ohne „close“ des Sockets → neu aufgebaut (${versuche} Versuche)`);
      await c.stoppe();
      pruefe(pulse.length >= 2 && pulse.every((h) => geloescht.has(h)), `Puls-Intervall wird bei Stille und bei stoppe() gelöscht (${pulse.length} angelegt)`);
    } finally {
      globalThis.setInterval = setzeIntervall;
      globalThis.clearInterval = loescheIntervall;
    }
  }

  abschnitt('Client: Log nur bei Änderung des Ergebnisses (Dauerfehler flutet das Log nicht)');
  {
    const a = await baueServer();
    await a.server.stoppe();
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const zeilen: Array<{ stufe: string; text: string }> = [];
    let runden = 0;
    // Runden am Anmeldeaufruf gezählt: nach dem ersten Fehler bleibt der Zustand stehen (Endprüfung A4, eigener Abschnitt).
    const c = neuerClient(pfad, {
      log: (stufe, text) => zeilen.push({ stufe, text }),
      anmelden: (p: AnmeldeParameter): Promise<Versuch> => {
        runden++;
        return versucheAnmeldung(p);
      },
    });
    c.starte();
    await bis(() => runden >= 5, 5000);
    pruefe(runden >= 5, `mehrere Runden ohne Master (${runden} Versuche)`);
    pruefe(zeilen.length === 1 && zeilen[0]!.stufe === 'warn' && zeilen[0]!.text.includes('fehler:verweigert'),
      `Dauerfehler → genau eine Warnzeile (${zeilen.length} Zeilen)`);
    const b = new MasterLinkServer({ identitaet: a.identitaet, verbund: a.verbund, eigeneRechnerId: 'rechner-a', suiteVersion: '0.12.0', lauschAdressen: ['127.0.0.1'], port: a.port, fristen: { pulsMs: 150, stilleMs: 600 } });
    await b.starte();
    await bis(() => art(c) === 'verbunden', 3000);
    pruefe(zeilen.length === 2 && zeilen[1]!.stufe === 'info' && zeilen[1]!.text.includes('verbunden (127.0.0.1)'),
      `Master zurück → „verbunden“ wird gemeldet (${zeilen.length} Zeilen)`);
    await c.stoppe();
    await b.stoppe();
  }

  abschnitt('Client: Fehlertext gehört zu dem Ergebnis, das den stärksten Code lieferte');
  {
    const a = await baueServer();
    await a.server.stoppe();
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, { ...d, kopplung: { ...d.kopplung!, adressen: ['10.0.0.1', '10.0.0.2'] } });
    const ersterFehler = async (ergebnisse: Record<string, VersuchsErgebnis>): Promise<ClientZustand | null> => {
      const c = neuerClient(pfad, { anmelden: async (p: AnmeldeParameter): Promise<Versuch> => ({ ok: false, ergebnis: ergebnisse[p.adresse]! }) });
      let z: ClientZustand | null = null;
      c.on('zustand', (n: ClientZustand) => {
        if (n.art === 'fehler') z ??= n;
      });
      c.starte();
      await bis(() => z !== null, 1000);
      await c.stoppe();
      return z;
    };
    const eins = await ersterFehler({ '10.0.0.1': { art: 'frist' }, '10.0.0.2': { art: 'tcp-timeout' } });
    pruefe(eins?.art === 'fehler' && eins.code === 'kein-master' && eins.text.includes('10.0.0.1') && !eins.text.includes('10.0.0.2'),
      '[A → Frist, B → TCP-Timeout]: kein-master nennt A (antwortet), nicht B (letzter Kandidat)');
    const zwei = await ersterFehler({ '10.0.0.1': { art: 'fehler', code: 'ECONNRESET' }, '10.0.0.2': { art: 'fehler', code: 'EHOSTUNREACH' } });
    pruefe(zwei?.art === 'fehler' && zwei.code === 'sonstig' && zwei.errCode === 'ECONNRESET' && zwei.text.includes('ECONNRESET') && !zwei.text.includes('EHOSTUNREACH'),
      '[A → ECONNRESET, B → EHOSTUNREACH]: sonstig mit dem Code von A, nicht dem des letzten Ergebnisses');
  }
  await laufeEndpruefung();
}

/** Nachträge aus der Schlussprüfung (Fix-Welle): einzeln aufrufbar, damit ein Punkt rot → grün gezielt läuft. */
export async function laufeEndpruefung(): Promise<void> {
  abschnitt('Client: Ausnahme in einer Runde beendet die Schleife nicht (Endprüfung A1, Spec 7.3)');
  {
    const unbehandelt: unknown[] = [];
    const merke = (r: unknown): void => { unbehandelt.push(r); };
    process.on('unhandledRejection', merke);
    try {
      // 1) networkInterfaces wirft dreimal hintereinander, während der Master aus ist; danach kommt er zurück.
      const a = await baueServer({}, { pulsMs: 150, stilleMs: 600 });
      await a.server.stoppe();
      const pfad = masterLinkPfad(tempOrdner());
      schreibeMasterLinkDatei(pfad, dateiFuer(a));
      let werfen = 0;
      let abfragen = 0;
      const zeilen: string[] = [];
      const c = neuerClient(pfad, {
        log: (_s, t) => zeilen.push(t),
        netzwerkKarten: () => {
          abfragen++;
          if (werfen > 0) {
            werfen--;
            throw Object.assign(new Error('uv_interface_addresses failed'), { code: 'ERR_SYSTEM_ERROR' });
          }
          return networkInterfaces();
        },
      });
      c.starte();
      await bis(() => abfragen >= 2, 2000);
      werfen = 3;
      await bis(() => werfen === 0, 2000);
      const nachWurf = abfragen;
      await bis(() => abfragen > nachWurf, 2000);
      pruefe(abfragen > nachWurf, `nach drei Würfen von networkInterfaces läuft die Schleife weiter (${abfragen - nachWurf} weitere Runde(n))`);
      const b = new MasterLinkServer({ identitaet: a.identitaet, verbund: a.verbund, eigeneRechnerId: 'rechner-a', suiteVersion: '0.12.0', lauschAdressen: ['127.0.0.1'], port: a.port, fristen: { pulsMs: 150, stilleMs: 600 } });
      await b.starte();
      await bis(() => art(c) === 'verbunden', 3000);
      gleich(art(c), 'verbunden', '… und verbindet, sobald der Master zurück ist');
      gleich(zeilen.filter((z) => z.includes('ERR_SYSTEM_ERROR')).length, 1, 'drei gleiche Würfe → genau eine Logzeile (gedrosselt)');
      await c.stoppe();

      // 2) Die Suche (Bonjour-Fabrik) wirft einmal in setzeKarten.
      let fabrikWirft = true;
      const suche = new FakeSuche();
      suche.setzeKarten = (): void => {
        if (fabrikWirft) {
          fabrikWirft = false;
          throw new TypeError("Cannot read properties of undefined (reading 'mdns')");
        }
      };
      const c2 = neuerClient(pfad, { suche });
      c2.starte();
      await bis(() => art(c2) === 'verbunden', 3000);
      pruefe(!fabrikWirft && art(c2) === 'verbunden', 'Suche wirft einmal in setzeKarten → spätere Runde verbindet');
      await c2.stoppe();

      // 3) Ein Zuhörer von 'zustand' wirft.
      const c3 = neuerClient(pfad);
      let zuhoererWuerfe = 0;
      c3.on('zustand', (z: ClientZustand) => {
        if (z.art === 'sucht' && zuhoererWuerfe < 2) {
          zuhoererWuerfe++;
          throw new Error('Zuhörer kaputt');
        }
      });
      c3.starte();
      await bis(() => art(c3) === 'verbunden', 3000);
      pruefe(zuhoererWuerfe > 0 && art(c3) === 'verbunden', `werfender Zuhörer (${zuhoererWuerfe}×) → Schleife lebt, verbunden`);
      await c3.stoppe();
      await b.stoppe();
      await warte(20);
      gleich(unbehandelt.length, 0, 'keine unbehandelte Ablehnung (app-runtime schriebe sonst eine Absturzmarke)');
    } finally {
      process.off('unhandledRejection', merke);
    }
  }

  abschnitt('Client: „last“ gilt auch in gemischten Runden (Endprüfung A2, Spec 9.1/5.4)');
  {
    const a = await baueServer();
    await a.server.stoppe();
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, { ...d, kopplung: { ...d.kopplung!, adressen: ['10.0.0.1', '10.0.0.2'] } });
    // lastMinMs weit über dem Rückzug (50 → 100 → 200 ms): ein Abstand ≥ 600 ms kann nur von „last“ kommen.
    const f: Partial<Fristen> = { ...KURZ, rueckzugBasisMs: 50, rueckzugMaxMs: 200, lastMinMs: 600 };
    const LAST: VersuchsErgebnis = { art: 'abgelehnt', grund: 'last' };
    const lauf = async (b: VersuchsErgebnis): Promise<{ abstaende: number[]; gezeigt: string[] }> => {
      const zeiten: number[] = [];
      const c = neuerClient(pfad, {
        fristen: f,
        zufall: () => 0.5,
        anmelden: async (p: AnmeldeParameter): Promise<Versuch> => {
          if (p.adresse === '10.0.0.1') zeiten.push(Date.now());
          return { ok: false, ergebnis: p.adresse === '10.0.0.1' ? LAST : b };
        },
      });
      const gezeigt = new Set<string>();
      c.on('zustand', () => {
        const w = art(c);
        if (w !== 'sucht' && w !== 'verbindet') gezeigt.add(w);
      });
      c.starte();
      await bis(() => zeiten.length >= 3 || gezeigt.has('fehler:unbekannt'), 4000);
      await c.stoppe();
      return { abstaende: zeiten.slice(1).map((t, i) => t - zeiten[i]!), gezeigt: [...gezeigt] };
    };
    const verweigert = await lauf({ art: 'fehler', code: 'ECONNREFUSED' });
    pruefe(verweigert.abstaende.length >= 2 && Math.min(...verweigert.abstaende) >= 550,
      `[A → last, B → ECONNREFUSED]: nächster Versuch an A frühestens nach lastMinMs (600): ${verweigert.abstaende.join(', ')} ms`);
    gleich(verweigert.gezeigt.filter((w) => w !== 'aus'), [], '… und keine Anzeige „verweigert“ (unser Master hat geantwortet)');
    const zeit = await lauf({ art: 'tcp-timeout' });
    pruefe(zeit.abstaende.length >= 2 && Math.min(...zeit.abstaende) >= 550,
      `[A → last, B → TCP-Timeout]: frühestens nach lastMinMs: ${zeit.abstaende.join(', ')} ms`);
    gleich(zeit.gezeigt.filter((w) => w !== 'aus'), [], '… und keine Anzeige „nicht erreichbar“');
    const entfernt = await lauf({ art: 'abgelehnt', grund: 'unbekannt' });
    gleich(entfernt.gezeigt.filter((w) => w !== 'aus'), ['fehler:unbekannt'], '[A → last, B → unbekannt]: eine Antwort unseres Masters bleibt sichtbar');
  }

  abschnitt('Client: Fehler bleibt über Wiederholungsrunden stehen (Endprüfung A4, Ruling jj)');
  {
    const a = await baueServer({}, { pulsMs: 150, stilleMs: 600 });
    await a.server.stoppe();
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, d);
    let versuche = 0;
    const c = neuerClient(pfad, {
      anmelden: (p: AnmeldeParameter): Promise<Versuch> => {
        versuche++;
        return versucheAnmeldung(p);
      },
    });
    const ereignisse: string[] = [];
    c.on('zustand', (z: ClientZustand) => ereignisse.push(verbundWert(z)));
    c.starte();
    await bis(() => art(c) === 'fehler:verweigert', 2000);
    gleich(ereignisse.slice(0, 2), ['sucht', 'verbindet'], 'Start (frisch): „sucht“, „verbindet“ werden gemeldet');
    const ab = ereignisse.length;
    const vorher = versuche;
    await bis(() => versuche >= vorher + 3, 3000);
    pruefe(versuche >= vorher + 3, `drei weitere Runden gelaufen (${versuche - vorher})`);
    gleich(ereignisse.slice(ab).filter((w) => w === 'sucht' || w === 'verbindet'), [], 'nach dem Fehler: kein Zustandsereignis „sucht“/„verbindet“ in Folgerunden');
    gleich(art(c), 'fehler:verweigert', 'verbundWert folgt: bleibt fehler:verweigert, bis ein neues Ergebnis kommt');
    const ab2 = ereignisse.length;
    schreibeMasterLinkDatei(pfad, { ...d, kopplung: { ...d.kopplung!, festeAdresse: '127.0.0.1' } }); // verbindungsrelevant → neustart
    await bis(() => ereignisse.slice(ab2).includes('sucht'), 2000);
    gleich(ereignisse[ab2], 'sucht', 'nach Neustart (relevante Dateiänderung) wieder zuerst „sucht“');
    const b = new MasterLinkServer({ identitaet: a.identitaet, verbund: a.verbund, eigeneRechnerId: 'rechner-a', suiteVersion: '0.12.0', lauschAdressen: ['127.0.0.1'], port: a.port, fristen: { pulsMs: 150, stilleMs: 600 } });
    await b.starte();
    await bis(() => art(c) === 'verbunden', 3000);
    gleich(art(c), 'verbunden', 'Master zurück → verbunden (neues Ergebnis ersetzt den Fehler)');
    const ab3 = ereignisse.length;
    await b.stoppe();
    await bis(() => ereignisse.length > ab3, 2000);
    gleich(ereignisse[ab3], 'sucht', 'Verbindung verloren → wieder frisch: zuerst „sucht“');
    await c.stoppe();
  }

  abschnitt('Client: Anmeldeversuch der alten Generation wird abgebrochen (Endprüfung A5)');
  {
    // Proxy: Verbindung 1 bekommt die Antworten des Masters je 400 ms verzögert (langsames WLAN, Master beschäftigt).
    const a = await baueServer({}, { pulsMs: 150, stilleMs: 600 });
    let n = 0;
    const proxy = netServer((cl) => {
      const nr = ++n;
      const s = netConnect(a.port, '127.0.0.1');
      cl.on('error', () => {});
      s.on('error', () => {});
      cl.on('data', (x) => s.write(x));
      s.on('data', (x) => (nr === 1 ? setTimeout(() => { if (!cl.destroyed) cl.write(x); }, 400) : cl.write(x)));
      cl.on('close', () => s.destroy());
      s.on('close', () => setTimeout(() => cl.destroy(), nr === 1 ? 450 : 0));
    });
    await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', r));
    const q = (proxy.address() as AddressInfo).port;
    const d = dateiFuer(a);
    const mitProxy = { ...d, kopplung: { ...d.kopplung!, port: q } };
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, mitProxy);
    const c = neuerClient(pfad, { fristen: { ...KURZ, dateiPruefMs: 30, tlsHalloMs: 4000, angemeldetMs: 4000, ersetztWiederholMs: 5000 } });
    const verlauf: string[] = [];
    c.on('zustand', () => verlauf.push(art(c)));
    c.starte();
    await warte(150);
    // Bediener trägt eine feste Adresse ein (verbindungsrelevant, Spec 7.1) — während Versuch 1 noch läuft.
    schreibeMasterLinkDatei(pfad, { ...mitProxy, kopplung: { ...mitProxy.kopplung, festeAdresse: '127.0.0.1' } });
    await warte(3000);
    pruefe(!verlauf.includes('fehler:ersetzt') && art(c) === 'verbunden',
      `relevante Dateiänderung während eines langsamen Versuchs → kein falsches „ersetzt“ (${verlauf.join(' → ')})`);
    await c.stoppe();

    // stoppe() während eines langsamen Versuchs: der alte Versuch darf sich danach nicht mehr am Master anmelden.
    n = 0;
    const gesehen: number[] = [];
    const zaehle = (): void => { gesehen.push(a.server.teilnehmer().length); };
    a.server.on('aenderung', zaehle);
    const c2 = neuerClient(pfad, { fristen: { ...KURZ, tlsHalloMs: 4000, angemeldetMs: 4000 } });
    schreibeMasterLinkDatei(pfad, mitProxy);
    c2.starte();
    await warte(150);
    await c2.stoppe();
    await warte(2500);
    a.server.off('aenderung', zaehle);
    gleich(Math.max(0, ...gesehen), 0, 'stoppe() während des Versuchs → der alte Versuch meldet sich nie mehr am Master an');
    proxy.close();
    await a.server.stoppe();
  }

  abschnitt('Client: Fremdtext „suite“ aus „abgelehnt protokoll“ gesäubert (Endprüfung A6)');
  {
    const a = await baueServer();
    await a.server.stoppe();
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const zeilen: string[] = [];
    const c = neuerClient(pfad, {
      log: (_s, t) => zeilen.push(t),
      anmelden: async (): Promise<Versuch> => ({
        ok: false, ergebnis: { art: 'abgelehnt', grund: 'protokoll', master: 2, suite: '0.13.0\n2026-01-01 [ERROR] gefälscht\u001b[2J\u202e' },
      }),
    });
    c.starte();
    await bis(() => art(c) === 'fehler:protokoll', 1000);
    const z = c.zustand();
    pruefe(z.art === 'fehler' && z.text.includes('Launcher 0.13.0 2026-01-01') && !/[\p{Cc}\p{Cf}]/u.test(z.text),
      `Statustext ohne Steuer-/Formatzeichen (${z.art === 'fehler' ? JSON.stringify(z.text).slice(0, 70) : z.art})`);
    pruefe(zeilen.length > 0 && zeilen.every((t) => !/[\p{Cc}\p{Cf}]/u.test(t)), 'Logzeilen einzeilig, ohne Steuer-/Formatzeichen');
    await c.stoppe();
  }
}

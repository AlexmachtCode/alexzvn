import { existsSync, readFileSync } from 'node:fs';
import { connect as netConnect, type Socket } from 'node:net';
import type { NetworkInterfaceInfo } from 'node:os';
import { join } from 'node:path';
import { erzeugeSchluesselpaar, signiereAnmeldung } from '../src/beweis';
import { GRENZEN } from '../src/fristen';
import { PROTOKOLL } from '../src/rahmen';
import { MasterLinkServer } from '../src/server';
import { DateiVerbund, SpeicherVerbund, type VerbundEintrag } from '../src/speicher';
import { baueServer, meldeAn, neueIdentitaet } from './aufbau';
import { abschnitt, bis, gleich, pruefe, tempOrdner, warte } from './helfer';
import { verbindeRoh } from './rohclient';

export async function laufe(): Promise<void> {
  abschnitt('Server: Anmeldung (Spec 3.4, 5.1)');
  {
    const a = await baueServer();
    const c = await meldeAn(a);
    const ang = await c.naechste('angemeldet');
    pruefe(ang?.t === 'angemeldet' && ang.suite === '0.12.0', 'richtige Signatur → angemeldet mit Suite-Version');
    gleich(a.server.teilnehmer().map((t) => [t.rechnerId, t.appId, t.art]), [['rechner-b', 'jm-timer', 'tool']], 'Teilnehmer unter rechnerId + appId');
    pruefe(a.server.rechnerOnline('rechner-b'), 'Rechner online, solange ein Teilnehmer verbunden ist');
    pruefe(a.server.rechnerOnline('rechner-a'), '„dieser Rechner“ online, solange der Server läuft');
    pruefe(a.verbund.finde('rechner-b')?.letzteAdresse === '127.0.0.1', 'letzte Adresse gemerkt');
    c.zu();
    await bis(() => a.server.teilnehmer().length === 0);
    gleich(a.server.teilnehmer().length, 0, 'Verbindung weg → sofort getrennt');
    pruefe(!a.server.rechnerOnline('rechner-b'), 'Rechner offline');
    await a.server.stoppe();
  }
  {
    const a = await baueServer();
    const c = await verbindeRoh(a.port);
    c.v.sende({ t: 'anmelden', protokoll: 2, rechnerId: 'rechner-b', rechnerName: 'B', signatur: 'x', teilnehmer: { art: 'tool', appId: 'a', name: 'a', version: '1', pid: 1 } });
    const ab = await c.naechste('abgelehnt');
    gleich(ab, { t: 'abgelehnt', grund: 'protokoll', master: PROTOKOLL, suite: '0.12.0' }, 'anderes Protokoll → abgelehnt mit Stand des Masters');
    await bis(() => c.beendet());
    pruefe(c.beendet(), 'danach Verbindung zu');

    const u = await meldeAn(a, { rechnerId: 'rechner-x', paar: erzeugeSchluesselpaar() });
    gleich(await u.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'unbekannt' }, 'unbekannter Rechner → unbekannt');

    const f = await meldeAn(a, { rechnerId: 'rechner-b', paar: erzeugeSchluesselpaar() });
    gleich(await f.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'signatur' }, 'falscher Schlüssel → signatur');

    const w = await verbindeRoh(a.port);
    const alt = signiereAnmeldung(a.slave.paar.privat, w.fp, '00'.repeat(16), 'rechner-b');
    w.v.sende({ t: 'anmelden', protokoll: 1, rechnerId: 'rechner-b', rechnerName: 'B', signatur: alt, teilnehmer: { art: 'tool', appId: 'a', name: 'a', version: '1', pid: 1 } });
    gleich(await w.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'signatur' }, 'Signatur zu fremder Nonce → signatur (keine Wiederholung)');

    const e = await verbindeRoh(a.port);
    e.v.sende({ t: 'puls' });
    await bis(() => e.beendet());
    pruefe(e.beendet(), 'erste Nachricht weder anmelden noch koppeln → Verbindung zu');

    const k = await verbindeRoh(a.port);
    k.v.sende({ t: 'koppeln', protokoll: 1, rechnerId: 'r', rechnerName: 'n', nonce: 'n', schluessel: 'P', beweis: 'b' });
    gleich(await k.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'keine-kopplung-offen' }, 'koppeln ohne offenes Fenster → keine-kopplung-offen');
    await a.server.stoppe();
  }

  abschnitt('Server: ersetzt, entfernen');
  {
    const warnungen: string[] = [];
    const a = await baueServer();
    a.server.on('warnung', (t: string) => warnungen.push(t));
    const erst = await meldeAn(a);
    await erst.naechste('angemeldet');
    const zweit = await meldeAn(a);
    await zweit.naechste('angemeldet');
    gleich(await erst.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'ersetzt' }, 'gleicher Schlüssel → alte Verbindung ersetzt');
    gleich(a.server.teilnehmer().length, 1, 'genau ein Teilnehmer bleibt');
    pruefe(warnungen.some((t) => t.includes('doppelt aktiv')), 'Warnung „doppelt aktiv“, weil die alte Verbindung lebte');

    const eigenTool = await meldeAn(a, a.eigen, 'jm-titler');
    await eigenTool.naechste('angemeldet');
    a.server.entferne('rechner-b');
    gleich(await zweit.naechste('abgelehnt', 1000), { t: 'abgelehnt', grund: 'unbekannt' }, 'entfernen während verbunden → sofort unbekannt');
    await bis(() => zweit.beendet(), 1000);
    pruefe(zweit.beendet(), 'Verbindung des entfernten Rechners binnen 1 s zu');
    pruefe(!eigenTool.beendet(), 'andere Rechner bleiben verbunden');
    gleich(a.verbund.finde('rechner-b'), undefined, 'Eintrag gelöscht');
    a.server.entferne('rechner-a');
    pruefe(a.verbund.finde('rechner-a') !== undefined, '„dieser Rechner“ ist nicht entfernbar');
    await a.server.stoppe();
  }

  abschnitt('Server: Puls und Stille');
  {
    const a = await baueServer({}, { pulsMs: 100, stilleMs: 300 });
    const still = await meldeAn(a);
    await still.naechste('angemeldet');
    const lebt = await meldeAn(a, a.eigen, 'jm-titler');
    await lebt.naechste('angemeldet');
    const puls = setInterval(() => lebt.v.sende({ t: 'puls' }), 100);
    pruefe((await lebt.naechste('puls', 500)) !== null, 'Master sendet Puls');
    await bis(() => still.beendet(), 1500);
    pruefe(still.beendet(), 'ohne Zeile vom Client → nach stilleMs getrennt');
    await warte(400);
    pruefe(!lebt.beendet(), 'Client mit Puls bleibt verbunden');
    clearInterval(puls);
    await a.server.stoppe();
  }

  abschnitt('Server: Grenzen vor der Anmeldung (Spec 6.3)');
  {
    const a = await baueServer({}, { anmeldefristMs: 200, handshakeMs: 200 });
    const c = await verbindeRoh(a.port);
    gleich(await c.naechste('abgelehnt', 1000), { t: 'abgelehnt', grund: 'anmeldefrist' }, 'nichts gesendet → anmeldefrist');
    // Eigener Server mit langer Anmeldefrist — sonst schlösse die Anmeldefrist (200 ms) den Socket, nicht der Handshake.
    const h = await baueServer({}, { anmeldefristMs: 5000, handshakeMs: 200 });
    const roh = netConnect(h.port, '127.0.0.1');
    roh.on('error', () => {});
    let zu = false;
    roh.on('close', () => { zu = true; });
    await bis(() => zu, 1500);
    pruefe(zu, 'TCP ohne TLS-Handshake → nach handshakeMs zu (tlsClientError → destroy)');
    await h.server.stoppe();
    await a.server.stoppe();
    // Eigener Server mit langer Anmeldefrist — sonst könnte bei langsamem Handshake die Anmeldefrist schließen, nicht die Zeilengrenze.
    const g = await baueServer({}, { anmeldefristMs: 5000 });
    const lang = await verbindeRoh(g.port);
    lang.socket.write('x'.repeat(GRENZEN.vorAnmeldung + 100));
    await bis(() => lang.beendet(), 1000);
    pruefe(lang.beendet() && lang.nachrichten.length === 0, 'Zeile > 4 KiB vor der Anmeldung → sofort zu (ohne „abgelehnt“: Zeilengrenze, nicht Anmeldefrist)');
    await g.server.stoppe();
  }
  {
    const a = await baueServer();
    const sockets: Socket[] = [];
    let ersterZu = false;
    for (let i = 0; i <= GRENZEN.maxUnangemeldet; i++) {
      if (i === GRENZEN.maxUnangemeldet) {
        await warte(100);
        pruefe(!ersterZu, `${GRENZEN.maxUnangemeldet} unangemeldete Verbindungen sind erlaubt`);
      }
      const s = netConnect(a.port, '127.0.0.1');
      s.on('error', () => {});
      if (i === 0) s.on('close', () => { ersterZu = true; });
      sockets.push(s);
      await new Promise<void>((r) => s.once('connect', () => r()));
    }
    await bis(() => ersterZu, 1000);
    pruefe(ersterZu, `${GRENZEN.maxUnangemeldet + 1}. unangemeldete Verbindung → älteste fliegt`);
    sockets.forEach((s) => s.destroy());
    await a.server.stoppe();
  }
  {
    const a = await baueServer();
    const c = await meldeAn(a);
    await c.naechste('angemeldet');
    c.socket.write(`{"t":"gross","x":"${'y'.repeat(100_000)}"}\n`);
    await warte(200);
    pruefe(!c.beendet(), 'nach der Anmeldung sind 100-KB-Zeilen erlaubt (1 MiB)');
    await a.server.stoppe();
  }

  abschnitt('Server: Ratenlimit (nur Fehlschläge)');
  {
    const a = await baueServer({ ratenAusnahme: () => false });
    const fremd = { rechnerId: 'rechner-b', paar: erzeugeSchluesselpaar() };
    let zuFrueh = 0;
    for (let i = 0; i < GRENZEN.ratenLimit; i++) {
      const c = await meldeAn(a, fremd);
      const ab = await c.naechste('abgelehnt');
      if (ab?.t === 'abgelehnt' && ab.grund === 'last') zuFrueh++;
    }
    gleich(zuFrueh, 0, `die ersten ${GRENZEN.ratenLimit} Fehlschläge → signatur, noch nicht last`);
    const richtig = await meldeAn(a);
    gleich(await richtig.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'last' }, '21. Versuch → last');
    await a.server.stoppe();
  }
  {
    const a = await baueServer();
    const fremd = { rechnerId: 'rechner-b', paar: erzeugeSchluesselpaar() };
    let last = 0;
    for (let i = 0; i < GRENZEN.ratenLimit + 3; i++) {
      const c = await meldeAn(a, fremd);
      const ab = await c.naechste('abgelehnt');
      if (ab?.t === 'abgelehnt' && ab.grund === 'last') last++;
    }
    gleich(last, 0, 'Loopback ist vom Ratenlimit ausgenommen (Tools am Master)');
    await a.server.stoppe();
  }
  {
    // Gegenprobe (Spec 6.3, 11.1 Nr. 9): viele ERFOLGREICHE Anmeldungen einer nicht ausgenommenen IP → nie „last“.
    const a = await baueServer({ ratenAusnahme: () => false });
    let abgewiesen = 0;
    for (let i = 0; i < GRENZEN.ratenLimit + 5; i++) {
      const c = await meldeAn(a, a.slave, `jm-app-${i}`);
      if ((await c.naechste('angemeldet', 1000)) === null) abgewiesen++;
    }
    gleich(abgewiesen, 0, `${GRENZEN.ratenLimit + 5} erfolgreiche Anmeldungen einer IP → kein „last“ (nur Fehlschläge zählen)`);
    await a.server.stoppe();
  }

  abschnitt('Server: „zuletzt gesehen“ (Spec 5.1)');
  {
    // Injizierte Uhr für Server UND Verbundspeicher; der Speicher schreibt höchstens alle 60 s, beim Trennen sofort.
    let uhr = 1_000_000;
    const a = await baueServer();
    await a.server.stoppe();
    const pfad = join(tempOrdner(), 'verbund.json');
    const verbund = new DateiVerbund(pfad, { version: 1, rechner: a.verbund.liste() }, { jetzt: () => uhr, schreibIntervallMs: 60_000 });
    const inDatei = (): unknown => !existsSync(pfad) ? 'nie geschrieben'
      : (JSON.parse(readFileSync(pfad, 'utf8')) as { rechner: VerbundEintrag[] }).rechner.find((e) => e.rechnerId === 'rechner-b')?.zuletztGesehen;
    const m = new MasterLinkServer({
      identitaet: a.identitaet, verbund, eigeneRechnerId: 'rechner-a', suiteVersion: '0.12.0',
      lauschAdressen: ['127.0.0.1'], port: 0, jetzt: () => uhr,
    });
    await m.starte();
    const c = await meldeAn({ ...a, server: m, port: m.port() });
    await c.naechste('angemeldet');
    gleich(inDatei(), 1_000_000, 'Anmeldung → „zuletzt gesehen“ geschrieben');
    uhr += 10_000;
    c.v.sende({ t: 'puls' });
    await bis(() => verbund.finde('rechner-b')?.zuletztGesehen === uhr, 1000);
    gleich(verbund.finde('rechner-b')?.zuletztGesehen, 1_010_000, 'während der Verbindung frischt jede Zeile „zuletzt gesehen“ auf');
    gleich(inDatei(), 1_000_000, '… geschrieben wird aber nicht bei jeder Zeile (höchstens alle 60 s)');
    uhr += 60_000;
    c.v.sende({ t: 'puls' });
    await bis(() => inDatei() === uhr, 1000);
    gleich(inDatei(), 1_070_000, 'nach 60 s ohne Trennung geschrieben');
    uhr += 5000;
    await m.stoppe();
    gleich(inDatei(), 1_075_000, 'Master trennt (stoppe: Aus, Neustart, Erneuern) → beim Trennen sofort geschrieben');
    verbund.schliesse();
  }

  abschnitt('Server: Lauscher (Review Focus 2)');
  {
    const a = await baueServer();
    const c = await meldeAn(a);
    await c.naechste('angemeldet');
    await a.server.stoppe();
    await bis(() => c.beendet(), 1000);
    pruefe(c.beendet(), 'stoppe(): offene Verbindung binnen 1 s zu (nicht nur server.close)');
    const b = new MasterLinkServer({
      identitaet: a.identitaet, verbund: a.verbund, eigeneRechnerId: 'rechner-a', suiteVersion: '0.12.0',
      lauschAdressen: ['127.0.0.1'], port: a.port,
    });
    await b.starte();
    pruefe(b.gestartet, 'sofort wieder auf demselben Port gestartet (kein EADDRINUSE)');
    const doppelt = new MasterLinkServer({
      identitaet: a.identitaet, verbund: a.verbund, eigeneRechnerId: 'rechner-a', suiteVersion: '0.12.0',
      lauschAdressen: ['127.0.0.1'], port: a.port,
    });
    let code = '';
    try { await doppelt.starte(); } catch (e) { code = (e as NodeJS.ErrnoException).code ?? ''; }
    gleich(code, 'EADDRINUSE', 'belegter Port → starte() wirft EADDRINUSE');
    const d = await meldeAn({ ...a, server: b, port: a.port });
    await d.naechste('angemeldet');
    await b.setzeLauschAdressen([]);
    await bis(() => d.beendet(), 1000);
    pruefe(d.beendet(), 'weggefallener Lauscher schließt seine Sitzungen');
    await b.stoppe();
  }
  {
    const karten: NodeJS.Dict<NetworkInterfaceInfo[]> = {
      'Ethernet 2': [{ address: '10.0.0.110', netmask: '255.255.255.0', family: 'IPv4', mac: '00:11:22:33:44:55', internal: false, cidr: '10.0.0.110/24' }],
      'Loopback': [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: true, cidr: '127.0.0.1/8' }],
    };
    const basis = { identitaet: neueIdentitaet(), verbund: new SpeicherVerbund(), eigeneRechnerId: 'a', suiteVersion: '0.12.0', netzwerkKarten: () => karten };
    gleich(new MasterLinkServer({ ...basis, lauschAdressen: ['0.0.0.0'] }).adressenFuerSlaves(), ['10.0.0.110'], 'Automatisch → alle nicht-internen IPv4');
    gleich(new MasterLinkServer({ ...basis, lauschAdressen: ['10.0.0.110', '192.168.1.5', '127.0.0.1'] }).adressenFuerSlaves(),
      ['10.0.0.110', '192.168.1.5'], 'gewählte Karte → ihre IPv4, nie 127.0.0.1');
  }
}

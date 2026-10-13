import { existsSync, readFileSync } from 'node:fs';
import { connect as netConnect, createServer as netServer, type Socket } from 'node:net';
import type { NetworkInterfaceInfo } from 'node:os';
import { join } from 'node:path';
import type { TLSSocket } from 'node:tls';
import { erzeugeSchluesselpaar, signiereAnmeldung } from '../src/beweis';
import { GRENZEN } from '../src/fristen';
import { koppele } from '../src/koppeln';
import { PROTOKOLL, type DatenZeile, type Nachricht } from '../src/rahmen';
import { MasterLinkServer, type SendeErgebnis, type TeilnehmerDaten } from '../src/server';
import { kodiereStand, zeilenBytes, type AboInhalt } from '../src/show-daten';
import { DateiVerbund, SpeicherVerbund, type VerbundEintrag } from '../src/speicher';
import { baueServer, meldeAn, neueIdentitaet } from './aufbau';
import { abschnitt, bis, gleich, pruefe, tempOrdner, warte } from './helfer';
import { verbindeRoh, type RohClient } from './rohclient';

/** Eine fertige stand-/aenderung-Zeile; `fuell` Zeichen Nutzlast machen sie groß (Rückdruck). */
function zeile(t: 'stand' | 'aenderung', folge: number, fuell = 0): string {
  return kodiereStand(t, {
    art: 'show', fassung: 1, epoche: 'e-1', folge, schluessel: null,
    show: fuell > 0 ? { x: 'y'.repeat(fuell) } : null, ...(fuell > 0 ? {} : { grund: 'keine-show' as const }), mitDokument: [],
  });
}

/** Sitzungen des Servers von innen (nur für Tests): Kennung und Socket. */
type InnenSitzung = { sitzung: number; v: { socket: TLSSocket; emit(n: string, x?: unknown): boolean } };
const innen = (s: MasterLinkServer): InnenSitzung[] => [...(s as unknown as { sitzungen: Set<InnenSitzung> }).sitzungen];

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
    const zweit = await meldeAn(a, a.slave, 'jm-timer', 2); // andere pid: echte Zweitinstanz (A7)
    await zweit.naechste('angemeldet');
    gleich(await erst.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'ersetzt' }, 'gleicher Schlüssel → alte Verbindung ersetzt');
    gleich(a.server.teilnehmer().length, 1, 'genau ein Teilnehmer bleibt');
    pruefe(warnungen.some((t) => t.includes('doppelt aktiv')), 'Warnung „doppelt aktiv“, weil die alte Verbindung lebte');

    // Endprüfung A6: appId mit Zeilenumbruch/ESC/Bidi darf keine zweite Logzeile erzeugen.
    const boese = 'jm-timer\n2026-01-01 [ERROR] [jm-launcher] gefälscht\u001b[2J\u202e';
    const b1 = await meldeAn(a, a.slave, boese);
    await b1.naechste('angemeldet');
    const b2 = await meldeAn(a, a.slave, boese, 2);
    await b2.naechste('angemeldet');
    const zeile = warnungen.filter((t) => t.includes('doppelt aktiv')).pop() ?? '';
    pruefe(warnungen.filter((t) => t.includes('doppelt aktiv')).length === 2 && !/[\p{Cc}\p{Cf}]/u.test(zeile),
      `Warnzeile „doppelt aktiv“ bleibt einzeilig, ohne Steuer-/Formatzeichen (${JSON.stringify(zeile).slice(0, 80)})`);
    pruefe(a.server.teilnehmer().every((t) => !/[\p{Cc}\p{Cf}]/u.test(t.appId)), 'teilnehmer().appId ohne Steuer-/Formatzeichen');
    b1.v.schliesse();
    b2.v.schliesse();
    const nm = await baueServer({ identitaet: neueIdentitaet('Regie\nPC\u202e') });
    const roh = await verbindeRoh(nm.port);
    gleich(roh.hallo.name, 'Regie PC', 'Server-Konstruktor säubert identitaet.name (hallo ohne Steuerzeichen)');
    roh.zu();
    await nm.server.stoppe();

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
    // Ansturm (Spec 6.3): viele Verbindungen GLEICHZEITIG, nicht nacheinander — das Opfer muss sofort ausgetragen sein,
    // sonst wählt jede weitere Annahme derselben Runde denselben, schon zerstörten Socket als „ältesten“.
    const a = await baueServer();
    const ansturm = 200;
    const sockets: Socket[] = [];
    let offen = 0;
    await Promise.all(Array.from({ length: ansturm }, () => new Promise<void>((fertig) => {
      const s = netConnect(a.port, '127.0.0.1');
      s.on('error', () => {});
      offen++;
      s.once('close', () => { offen--; fertig(); });
      s.once('connect', () => fertig());
      sockets.push(s);
    })));
    await bis(() => offen <= GRENZEN.maxUnangemeldet, 3000);
    await warte(300);
    pruefe(offen <= GRENZEN.maxUnangemeldet, `${ansturm} gleichzeitige Verbindungen → höchstens ${GRENZEN.maxUnangemeldet} bleiben offen (gemessen: ${offen})`);
    pruefe(offen > 0, 'der Ansturm lässt die neuesten Verbindungen leben (nicht alle gekappt)');
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

  abschnitt('Server: Teilnehmerangaben aus dem Netz (höchstens 60 Zeichen)');
  {
    const a = await baueServer();
    const lang = 'x'.repeat(200);
    const emoji = '😀'.repeat(200);
    const anmelden = async (teilnehmer: { art: 'tool'; appId: string; name: string; version: string; pid: number }): Promise<RohClient> => {
      const c = await verbindeRoh(a.port);
      c.v.sende({
        t: 'anmelden',
        protokoll: PROTOKOLL,
        rechnerId: a.slave.rechnerId,
        rechnerName: 'B',
        signatur: signiereAnmeldung(a.slave.paar.privat, c.fp, c.hallo.nonce, a.slave.rechnerId),
        teilnehmer,
      });
      await c.naechste('angemeldet');
      return c;
    };
    const c = await anmelden({ art: 'tool', appId: 'jm-timer', name: lang, version: lang, pid: 1 });
    const t = a.server.teilnehmer()[0];
    pruefe(t !== undefined && t.name.length <= 60 && t.version.length <= 60, `anmelden: 200-Zeichen-Name und -Version → höchstens 60 (gemessen: ${t?.name.length}/${t?.version.length})`);

    const mitExtra = { art: 'tool' as const, appId: 'jm-timer', name: emoji, version: lang, pid: 2, extra: 'z'.repeat(100_000) };
    c.v.sende({ t: 'teilnehmer', teilnehmer: mitExtra });
    await bis(() => a.server.teilnehmer()[0]?.pid === 2, 1000);
    const u = a.server.teilnehmer()[0];
    pruefe(u !== undefined && u.pid === 2, 'Update per teilnehmer kommt an');
    gleich(u && [...u.name].join(''), '😀'.repeat(60), 'teilnehmer-Update: Emoji-Name → 60 ganze Zeichen, nicht mitten im Zeichen gekappt');
    pruefe(u !== undefined && u.version.length <= 60, 'teilnehmer-Update: 200-Zeichen-Version → höchstens 60');
    pruefe(u !== undefined && !('extra' in u), 'teilnehmer-Update: unbekannte Zusatzfelder aus dem Netz werden nicht übernommen');
    c.zu();
    await bis(() => a.server.teilnehmer().length === 0);

    const e = await anmelden({ art: 'tool', appId: emoji, name: emoji, version: '1', pid: 3 });
    const ea = a.server.teilnehmer()[0];
    pruefe(ea !== undefined && [...ea.appId].length <= 60 && [...ea.name].length <= 60, 'anmelden: Emoji-appId und -Name → höchstens 60 Zeichen');
    e.v.sende({ t: 'teilnehmer', teilnehmer: { art: 'tool', appId: emoji, name: 'neu', version: '2', pid: 4 } });
    await bis(() => a.server.teilnehmer()[0]?.pid === 4, 1000);
    gleich(a.server.teilnehmer()[0]?.name, 'neu', 'teilnehmer-Update derselben (gekürzten) appId wird erkannt und übernommen');
    e.zu();
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

  abschnitt('Server: nach stoppe() endgültig still, „doppelt aktiv“ nur bei echter Zweitinstanz (Endprüfung A7)');
  {
    // Eine Zeile, die nach stoppe() noch aus einem alten Socket kommt, darf den Verbundspeicher nicht mehr erreichen.
    let nachStopp = 0;
    let gestoppt = false;
    class Zaehler extends SpeicherVerbund {
      override gesehen(r: string, z: number, ad: string | null, s: boolean): void {
        if (gestoppt) nachStopp++;
        super.gesehen(r, z, ad, s);
      }
    }
    const a = await baueServer();
    await a.server.stoppe();
    const m = new MasterLinkServer({
      identitaet: a.identitaet, verbund: new Zaehler(a.verbund.liste()), eigeneRechnerId: 'rechner-a', suiteVersion: '0.12.0',
      lauschAdressen: ['127.0.0.1'], port: 0,
    });
    await m.starte();
    const c = await meldeAn({ ...a, server: m, port: m.port() });
    await c.naechste('angemeldet');
    const sitzungen = [...(m as unknown as { sitzungen: Set<{ v: { emit(n: string, x?: unknown): boolean } }> }).sitzungen];
    await m.stoppe();
    gestoppt = true;
    for (const s of sitzungen) {
      s.v.emit('nachricht', { t: 'puls' });
      s.v.emit('unbekannt');
    }
    await warte(20);
    gleich(nachStopp, 0, 'späte Zeile nach stoppe() → kein „zuletzt gesehen“ mehr (Server endgültig still)');
    c.zu();

    // Schneller Wiederaufbau nach einem WLAN-Aussetzer: gleiche pid, gleiche Adresse → ersetzt, aber keine Klon-Warnung.
    const b = await baueServer();
    const warnungen: string[] = [];
    b.server.on('warnung', (t: string) => warnungen.push(t));
    const alt = await meldeAn(b, b.slave, 'jm-timer', 7);
    await alt.naechste('angemeldet');
    const neu = await meldeAn(b, b.slave, 'jm-timer', 7);
    await neu.naechste('angemeldet');
    gleich(await alt.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'ersetzt' }, 'gleiche pid + Adresse → alte Verbindung ersetzt');
    gleich(warnungen.filter((t) => t.includes('doppelt aktiv')), [], '… ohne Warnung „doppelt aktiv“ (derselbe Prozess, kein Klon)');
    neu.zu();
    await b.server.stoppe();
  }

  abschnitt('Server: Neubinden bindet jede Adresse einzeln, Loopback bleibt (Endprüfung B1, Spec 4.3)');
  {
    // Wechsel „Automatisch“ → Karte: [Karten-IP, 127.0.0.1]. Scheitert die Karten-IP, muss 127.0.0.1 trotzdem lauschen,
    // und an Slaves gehen nur Adressen, auf denen wirklich gelauscht wird. (127.0.0.5 steht für 0.0.0.0: keine Firewall-Abfrage.)
    // Fester Port: mit Port 0 vergäbe das Neubinden nach dem Schließen aller alten Lauscher einen neuen.
    const frei = netServer();
    await new Promise<void>((r) => frei.listen(0, '127.0.0.1', r));
    const p = (frei.address() as { port: number }).port;
    await new Promise<void>((r) => frei.close(() => r()));
    const a = await baueServer({ lauschAdressen: ['127.0.0.5'], port: p });
    const blocker = netServer();
    await new Promise<void>((r) => blocker.listen(p, '127.0.0.6', r));
    let code = '';
    try {
      await a.server.setzeLauschAdressen(['127.0.0.6', '127.0.0.1']);
    } catch (e) {
      code = (e as NodeJS.ErrnoException).code ?? '';
    }
    gleich(code, 'EADDRINUSE', 'Karten-IP belegt → setzeLauschAdressen meldet den Fehler');
    const offen = await new Promise<boolean>((r) => {
      const s = netConnect(p, '127.0.0.1');
      s.on('connect', () => { s.destroy(); r(true); });
      s.on('error', () => r(false));
    });
    pruefe(offen, '… 127.0.0.1 lauscht trotzdem (die eigenen Tools behalten den Master)');
    const liste = (a.server as unknown as { lauschAdressen: string[] }).lauschAdressen;
    gleich(liste, ['127.0.0.1'], '… geführt werden nur tatsächlich gebundene Adressen (Spec 4.3)');
    await new Promise<void>((r) => blocker.close(() => r()));
    await a.server.setzeLauschAdressen(['127.0.0.6', '127.0.0.1']);
    gleich((a.server as unknown as { lauschAdressen: string[] }).lauschAdressen, ['127.0.0.6', '127.0.0.1'], 'erneuter Aufruf bindet die Karten-IP nach');
    await a.server.stoppe();
  }

  abschnitt('Server: Show-Daten — Sitzung, daten, getrennt (Teil 2b, Spec 13.6, 13.7)');
  {
    const warnungen: string[] = [];
    const a = await baueServer();
    a.server.on('warnung', (t: string) => warnungen.push(t));
    const daten: Array<[TeilnehmerDaten, AboInhalt]> = [];
    const getrennt: number[] = [];
    a.server.on('daten', (t: TeilnehmerDaten, abo: AboInhalt) => daten.push([t, abo]));
    a.server.on('getrennt', (s: number) => getrennt.push(s));
    const c = await meldeAn(a);
    await c.naechste('angemeldet');
    const eigen = await meldeAn(a, a.eigen, 'jm-titler');
    await eigen.naechste('angemeldet');
    gleich(a.server.teilnehmer().map((t) => [t.appId, t.sitzung]), [['jm-timer', 1], ['jm-titler', 2]],
      'zwei Sitzungen → verschiedene Kennungen (Zähler je Server), teilnehmer() trägt sitzung');
    c.v.sende({ t: 'abo', art: 'show', fassung: 1 });
    await bis(() => daten.length === 1);
    gleich(daten[0], [
      { sitzung: 1, schluessel: 'rechner-b\u0000jm-timer', rechnerId: 'rechner-b', art: 'tool', appId: 'jm-timer', dieserRechner: false },
      { art: 'show', fassung: 1 },
    ], 'abo einer angemeldeten Sitzung → daten mit sitzung, schluessel, rechnerId, art, appId, dieserRechner');
    eigen.v.sende({ t: 'abo', art: 'show', fassung: 2 });
    await bis(() => daten.length === 2);
    gleich(daten[1]?.[0].dieserRechner, true, 'abo vom Master-Rechner selbst → dieserRechner true');
    gleich(daten[1]?.[1], { art: 'show', fassung: 2 }, '… die erbetene Fassung reist mit (die Antwortfassung wählt der Verteiler)');
    c.v.sende({ t: 'abo', art: 'film', fassung: 1 });
    c.v.sende({ t: 'abo', art: 'film', fassung: 1 });
    c.v.sende({ t: 'abo', art: 'show', fassung: 0 });
    await bis(() => warnungen.filter((w) => w.includes('ungültiges Abo')).length === 2, 1000);
    await warte(100);
    gleich(warnungen.filter((w) => w.includes('ungültiges Abo')), [
      'Master-Link: ungültiges Abo von Regie-Laptop 2/jm-timer (art), ignoriert.',
      'Master-Link: ungültiges Abo von Regie-Laptop 2/jm-timer (fassung), ignoriert.',
    ], 'ungültiges abo → eine Warnung je Sitzung und Feld (E13); dasselbe noch einmal → keine zweite');
    gleich(daten.length, 2, '… kein daten für ein ungültiges abo');
    pruefe(!c.beendet(), '… die Leitung bleibt');
    c.v.sende({ t: 'stand', art: 'show', fassung: 1 });
    c.v.sende({ t: 'aenderung', folge: 'x' });
    await warte(200);
    pruefe(daten.length === 2 && !c.beendet(), 'stand/aenderung von einem Client → ignoriert, die Leitung bleibt (G4)');
    c.zu();
    await bis(() => getrennt.length === 1);
    await warte(300);
    gleich(getrennt, [1], 'Sitzung zu → getrennt(sitzung) genau einmal');
    gleich(a.server.sendeDaten(1, zeile('aenderung', 1)), 'weg', 'sendeDaten an eine beendete Sitzung → weg');
    gleich(a.server.sendeDaten(99, zeile('aenderung', 1)), 'weg', 'sendeDaten an eine unbekannte Sitzung → weg');
    eigen.zu();
    await a.server.stoppe();
  }
  {
    const a = await baueServer();
    let daten = 0;
    a.server.on('daten', () => daten++);
    const r = await verbindeRoh(a.port);
    r.v.sende({ t: 'abo', art: 'show', fassung: 1 });
    await bis(() => r.beendet(), 1000);
    pruefe(r.beendet() && daten === 0, 'abo als erste Nachricht vor anmelden → Verbindung zu, kein daten (E3)');
    await a.server.stoppe();
  }
  {
    const zeilen: string[] = [];
    const a = await baueServer({ log: (_s, t) => zeilen.push(t) });
    a.server.on('daten', () => {
      throw Object.assign(new Error('Testwurf'), { code: 'TESTWURF' });
    });
    const c = await meldeAn(a);
    await c.naechste('angemeldet');
    c.v.sende({ t: 'abo', art: 'show', fassung: 1 });
    c.v.sende({ t: 'abo', art: 'show', fassung: 1 });
    await bis(() => zeilen.some((z) => z.includes('TESTWURF')), 1000);
    await warte(100);
    gleich(zeilen.filter((z) => z.includes('warf')), ['Master-Link: Zuhörer von „daten“ warf (TESTWURF).'],
      'werfender daten-Zuhörer: eine Logzeile, auch beim zweiten Wurf');
    pruefe(!c.beendet(), '… die Leitung bleibt (der Wurf trifft den Socket-Handler nicht)');
    c.zu();
    await a.server.stoppe();
  }

  abschnitt('Server: Ersetzung, die neue Sitzung schickt ihr abo, bevor die alte zu ist (Teil 2b, Spec 13.6, 19.1)');
  {
    const a = await baueServer();
    // Nachgebauter Verteiler: Abos nach sitzung, Antwort stand, verteile() schickt eine aenderung an alle Abos.
    const abos = new Set<number>();
    const getrennt: number[] = [];
    let teilnehmerBeiGetrennt = -1;
    a.server.on('daten', (t: TeilnehmerDaten) => {
      abos.add(t.sitzung);
      a.server.sendeDaten(t.sitzung, zeile('stand', 0));
    });
    a.server.on('getrennt', (s: number) => {
      getrennt.push(s);
      abos.delete(s);
      teilnehmerBeiGetrennt = a.server.teilnehmer().length;
    });
    const verteile = (folge: number): SendeErgebnis[] => [...abos].map((s) => a.server.sendeDaten(s, zeile('aenderung', folge)));
    const alt = await meldeAn(a, a.slave, 'jm-timer', 7);
    await alt.naechste('angemeldet');
    alt.v.sende({ t: 'abo', art: 'show', fassung: 1 });
    pruefe((await alt.naechste('stand')) !== null, 'alte Sitzung: abo → stand');
    const altSitzung = a.server.teilnehmer()[0]!.sitzung;
    alt.socket.pause(); // liest nicht mehr: ihr Ende kommt erst mit dem 200-ms-Zwangsabbruch von schliesse()
    const neu = await meldeAn(a, a.slave, 'jm-timer', 7); // gleiche pid und Adresse → ersetzt
    await neu.naechste('angemeldet');
    gleich(getrennt, [altSitzung], 'Ersetzung: getrennt nur für die alte Sitzung, sofort in meldeAn');
    gleich(teilnehmerBeiGetrennt, 0, '… noch bevor die neue Sitzung eingetragen und angemeldet ist');
    const neuSitzung = a.server.teilnehmer()[0]!.sitzung;
    pruefe(neuSitzung !== altSitzung, `… die neue Sitzung hat eine eigene Kennung (${altSitzung} → ${neuSitzung})`);
    gleich(verteile(1), [], 'vor ihrem abo: kein Abo mehr, nichts verteilt');
    await warte(100);
    gleich(neu.nachrichten.filter((n) => n.t === 'stand' || n.t === 'aenderung'), [], '… die neue Sitzung bekam vor ihrem abo nichts');
    neu.v.sende({ t: 'abo', art: 'show', fassung: 1 });
    pruefe((await neu.naechste('stand')) !== null, 'neue Sitzung: ihr abo → stand');
    gleich(innen(a.server).length, 2, '… während die alte Sitzung am Server noch offen ist (bis zu 200 ms)');
    await warte(400); // länger als der 200-ms-Zwangsabbruch der alten Sitzung
    gleich(innen(a.server).length, 1, 'die alte Sitzung ist inzwischen zu');
    gleich(getrennt, [altSitzung], '… ihr spätes Ende meldet kein zweites getrennt');
    gleich(verteile(2), ['gesendet'], 'das Abo der neuen Sitzung bleibt');
    const n2 = await neu.naechste('aenderung');
    gleich(n2 && (n2 as DatenZeile).folge, 2, 'die nächste aenderung kommt bei der neuen Sitzung an');
    gleich(a.server.sendeDaten(altSitzung, zeile('aenderung', 3)), 'weg', 'sendeDaten an die ersetzte Sitzung → weg');
    alt.zu();
    neu.zu();
    await a.server.stoppe();
  }

  abschnitt('Server: stoppe() meldet getrennt je angemeldeter Sitzung genau einmal (Teil 2b, E4)');
  {
    const a = await baueServer();
    const getrennt: number[] = [];
    let daten = 0;
    a.server.on('getrennt', (s: number) => getrennt.push(s));
    a.server.on('daten', () => daten++);
    const c1 = await meldeAn(a);
    await c1.naechste('angemeldet');
    const c2 = await meldeAn(a, a.eigen, 'jm-titler');
    await c2.naechste('angemeldet');
    const roh = await verbindeRoh(a.port); // nicht angemeldet: keine Sitzungskennung, kein getrennt
    const sitzungen = innen(a.server);
    const gestoppt = a.server.stoppe();
    gleich([...getrennt].sort(), [1, 2], 'stoppe(): getrennt je angemeldeter Sitzung, synchron im Aufruf');
    await gestoppt;
    await warte(300);
    gleich(getrennt.length, 2, '… genau einmal (das spätere ende der Sockets meldet nichts mehr)');
    for (const s of sitzungen) s.v.emit('nachricht', { t: 'abo', art: 'show', fassung: 1 });
    await warte(20);
    gleich(daten, 0, 'nach stoppe(): eine späte abo-Zeile ergibt kein daten');
    roh.zu();
  }

  abschnitt('Server: Rückdruck — sendeDaten staut über 1 MiB, entstaut beim nächsten drain (Teil 2b, Spec 13.6)');
  {
    const a = await baueServer({}, { stilleMs: 60_000 }); // der pausierte Client schickt keinen Puls
    const entstaut: number[] = [];
    const getrennt: number[] = [];
    a.server.on('entstaut', (s: number) => entstaut.push(s));
    a.server.on('getrennt', (s: number) => getrennt.push(s));
    const c = await meldeAn(a);
    await c.naechste('angemeldet');
    const sitzung = a.server.teilnehmer()[0]!.sitzung;
    const serverSocket = innen(a.server).find((s) => s.sitzung === sitzung)!.v.socket;
    const gross = zeile('aenderung', 1, 64 * 1024 - 200);
    c.socket.pause();
    let gesendet = 0;
    let ergebnis: SendeErgebnis = 'gesendet';
    // Begrenzt: 64-KiB-Zeilen, Abbruch nach 64 MiB. Zwischen zwei Zeilen läuft die Ereignisschleife (echte Socket-Puffer).
    while (ergebnis === 'gesendet' && gesendet < 64 * 1024 * 1024) {
      ergebnis = a.server.sendeDaten(sitzung, gross);
      if (ergebnis === 'gesendet') gesendet += zeilenBytes(gross);
      await new Promise<void>((r) => setImmediate(r));
    }
    const beimStau = serverSocket.writableLength;
    gleich(ergebnis, 'gestaut', `Client liest nicht → gestaut (nach ${Math.round(gesendet / 1024)} KiB, writableLength beim Stau ${beimStau} Byte)`);
    pruefe(beimStau > GRENZEN.stauBytes && beimStau <= GRENZEN.stauBytes + zeilenBytes(gross),
      `… erst über 1 MiB im Schreibpuffer, höchstens eine Zeile darüber (gemessen: ${beimStau} Byte, Zeile ${zeilenBytes(gross)} Byte)`);
    gleich([a.server.sendeDaten(sitzung, gross), serverSocket.writableLength], ['gestaut', beimStau], 'weiteres sendeDaten → gestaut, ohne zu schreiben');
    c.socket.resume();
    await bis(() => entstaut.length > 0, 10_000);
    await warte(300);
    gleich(entstaut, [sitzung], 'Client liest wieder → genau ein entstaut(sitzung)');
    gleich(a.server.sendeDaten(sitzung, zeile('aenderung', 2)), 'gesendet', 'nach entstaut schreibt sendeDaten wieder');
    // Stau, dann Sitzungsende: ein spätes drain meldet kein entstaut mehr.
    c.socket.pause();
    ergebnis = 'gesendet';
    for (let n = 0; ergebnis === 'gesendet' && n < 1024; n++) {
      ergebnis = a.server.sendeDaten(sitzung, gross);
      await new Promise<void>((r) => setImmediate(r));
    }
    gleich(ergebnis, 'gestaut', 'zweiter Stau');
    c.zu();
    await bis(() => getrennt.length === 1, 2000);
    serverSocket.emit('drain');
    await warte(100);
    gleich(entstaut, [sitzung], 'entstaut nach Sitzungsende kommt nicht (auch nicht bei einem späten drain)');
    await a.server.stoppe();
  }

  abschnitt('Server: Teil-1-Client ohne abo bleibt angemeldet und bekommt keine 2b-Zeile (Teil 2b, Spec 13.5, 19.1)');
  {
    const a = await baueServer({}, { pulsMs: 100 });
    a.server.on('daten', (t: TeilnehmerDaten) => a.server.sendeDaten(t.sitzung, zeile('stand', 0)));
    const mitAbo = await meldeAn(a, a.slave, 'jm-timer');
    const teil1 = await meldeAn(a, a.slave, 'jm-titler'); // schickt nie ein abo
    await mitAbo.naechste('angemeldet');
    await teil1.naechste('angemeldet');
    mitAbo.v.sende({ t: 'abo', art: 'show', fassung: 1 });
    pruefe((await mitAbo.naechste('stand')) !== null, 'die Sitzung mit abo bekommt stand');
    await warte(500);
    pruefe(teil1.nachrichten.some((n) => n.t === 'puls'), 'Teil-1-Client bekommt den Puls');
    gleich(teil1.nachrichten.filter((n) => n.t !== 'puls'), [], '… sonst nichts (keine 2b-Zeile)');
    pruefe(!teil1.beendet() && a.server.teilnehmer().some((t) => t.appId === 'jm-titler'), '… und bleibt angemeldet');
    mitAbo.zu();
    teil1.zu();
    await a.server.stoppe();
  }

  abschnitt('Server: nach gekoppelt sendet der Master bis teilnehmer nichts (Spec 13.5 „Koppeln braucht keine Reparatur“)');
  {
    const a = await baueServer({}, { pulsMs: 100 });
    const { code } = a.server.oeffneKopplung();
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: code!, rechner: { id: 'rechner-c', name: 'Neuer PC' } });
    pruefe(r.ok, 'gekoppelt');
    if (r.ok) {
      const zeilen: string[] = [];
      r.verbindung.on('nachricht', (n: Nachricht) => zeilen.push(n.t));
      r.verbindung.on('unbekannt', (t: string) => zeilen.push(t));
      await warte(1000);
      gleich(zeilen, [], 'nach gekoppelt: 1 s lang keine Zeile vom Master, auch kein Puls (removeAllListeners in koppeln.ts verliert nichts)');
      r.verbindung.sende({ t: 'teilnehmer', teilnehmer: { art: 'launcher', appId: 'jm-launcher', name: 'JM Production Suite', version: '0.15.0', pid: 3 } });
      await bis(() => zeilen.includes('puls'), 1000);
      gleich(zeilen[0], 'angemeldet', 'Gegenprobe: nach teilnehmer kommt zuerst angemeldet …');
      pruefe(zeilen.includes('puls'), '… und danach der Puls (100 ms)');
      r.verbindung.schliesse();
    }
    await a.server.stoppe();
  }
}

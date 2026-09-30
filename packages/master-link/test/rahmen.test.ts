import { abschnitt, bis, gleich, pruefe, warte } from './helfer';
import { erzeugeTestZertifikat } from './zertifikate';
import { tlsPaar } from './tlspaar';
import { dekodiere, kodiere, PROTOKOLL, ZeileZuLang, ZeilenLeser, type Nachricht } from '../src/rahmen';
import { ohneV6Praefix, Verbindung } from '../src/verbindung';

export async function laufe(): Promise<void> {
  abschnitt('Rahmen: Nachrichten');
  gleich(PROTOKOLL, 1, 'Protokoll 1');
  const teilnehmer = { art: 'tool' as const, appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 42 };
  const alle: Nachricht[] = [
    { t: 'hallo', protokoll: 1, masterId: 'm', name: 'Regie-PC', nonce: 'n' },
    { t: 'koppeln', protokoll: 1, rechnerId: 'r', rechnerName: 'B', nonce: 'n', schluessel: 'P', beweis: 'b' },
    { t: 'gekoppelt', masterId: 'm', name: 'Regie-PC', beweis: 'b', adressen: ['10.0.0.1'] },
    { t: 'anmelden', protokoll: 1, rechnerId: 'r', rechnerName: 'B', signatur: 's', teilnehmer },
    { t: 'teilnehmer', teilnehmer },
    { t: 'angemeldet', adressen: [], suite: '0.12.0' },
    { t: 'abgelehnt', grund: 'code-falsch', rest: 3 },
    { t: 'abgelehnt', grund: 'protokoll', master: 1, suite: '0.12.0' },
    { t: 'puls' },
  ];
  for (const n of alle) {
    const z = kodiere(n);
    pruefe(z.endsWith('\n') && !z.slice(0, -1).includes('\n'), `${n.t}: genau eine Zeile`);
    gleich(dekodiere(z.slice(0, -1)), { art: 'nachricht', n }, `${n.t}: hin und zurück`);
  }
  gleich(dekodiere('{"t":"neu-in-teil-2","x":1}'), { art: 'unbekannt', t: 'neu-in-teil-2' }, 'unbekannter Typ → unbekannt (wird ignoriert)');
  gleich(dekodiere('{"t":"constructor"}'), { art: 'unbekannt', t: 'constructor' }, 't = "constructor" ist kein Prüfer (Map statt Objekt)');
  gleich(dekodiere('{"t":"__proto__"}'), { art: 'unbekannt', t: '__proto__' }, 't = "__proto__" ist kein Prüfer');
  gleich(dekodiere('nicht json'), { art: 'kaputt' }, 'kein JSON → kaputt');
  gleich(dekodiere('[1,2]'), { art: 'kaputt' }, 'Array → kaputt');
  gleich(dekodiere('{"x":1}'), { art: 'kaputt' }, 'ohne t → kaputt');
  gleich(dekodiere('{"t":"hallo","protokoll":"1","masterId":"m","name":"n","nonce":"x"}'), { art: 'kaputt' }, 'falscher Feldtyp → kaputt');
  gleich(dekodiere('{"t":"abgelehnt","grund":"erfunden"}'), { art: 'kaputt' }, 'unbekannter Grund → kaputt');
  gleich(dekodiere('{"t":"anmelden","protokoll":1,"rechnerId":"r","rechnerName":"B","signatur":"s","teilnehmer":{"art":"x","appId":"a","name":"n","version":"v","pid":1}}'), { art: 'kaputt' }, 'Teilnehmer mit falscher Art → kaputt');

  abschnitt('Rahmen: Zeilenleser');
  const l = new ZeilenLeser(16);
  gleich(l.fuettere(Buffer.from('{"a"')), [], 'unvollständige Zeile → nichts');
  gleich(l.fuettere(Buffer.from(':1}\n{"b":2}\n')), ['{"a":1}', '{"b":2}'], 'zwei Zeilen über zwei Stücke');
  const e = Buffer.from('é\n', 'utf8');
  gleich([...l.fuettere(e.subarray(0, 1)), ...l.fuettere(e.subarray(1))], ['é'], 'UTF-8-Zeichen über Stückgrenze');
  let geworfen = false;
  try { l.fuettere(Buffer.from('x'.repeat(17))); } catch (f) { geworfen = f instanceof ZeileZuLang; }
  pruefe(geworfen, 'unvollständige Zeile über der Grenze → ZeileZuLang');
  const l2 = new ZeilenLeser(4);
  gleich(l2.fuettere(Buffer.from('abcd\n')), ['abcd'], 'Zeile genau an der Grenze ist erlaubt');
  l2.setzeGrenze(100);
  gleich(l2.fuettere(Buffer.from('x'.repeat(50) + '\n')), ['x'.repeat(50)], 'setzeGrenze hebt die Grenze an');

  abschnitt('Verbindung über echtes TLS');
  const z = erzeugeTestZertifikat();
  {
    const p = await tlsPaar(z);
    const v = new Verbindung(p.server, 4096);
    const empfangen: Nachricht[] = [];
    const unbekannt: string[] = [];
    v.on('nachricht', (n: Nachricht) => empfangen.push(n));
    v.on('unbekannt', (t: string) => unbekannt.push(t));
    p.client.write(kodiere({ t: 'puls' }) + '{"t":"zukunft"}\n');
    await bis(() => empfangen.length === 1 && unbekannt.length === 1);
    gleich(empfangen, [{ t: 'puls' }], 'Nachricht kommt an');
    gleich(unbekannt, ['zukunft'], 'unbekannter Typ als Ereignis');
    gleich(v.adresse, '127.0.0.1', 'Adresse ohne ::ffff:');
    // Über 127.0.0.1 kommt nie ein ::ffff:-Präfix an — deshalb die Funktion hier direkt.
    gleich([ohneV6Praefix('::ffff:10.0.0.5'), ohneV6Praefix('10.0.0.5'), ohneV6Praefix(undefined)], ['10.0.0.5', '10.0.0.5', ''],
      'ohneV6Praefix: IPv4-gemappte IPv6-Adresse → IPv4');
    let ende: Error | undefined | null = null;
    v.on('ende', (f?: Error) => { ende = f; });
    p.client.write('kaputt\n');
    await bis(() => ende !== null);
    pruefe(ende !== null && (ende as Error).message === 'rahmen', 'kaputte Zeile → ende("rahmen")');
    pruefe(p.server.destroyed, 'Socket nach kaputter Zeile zerstört');
    p.schliesse();
  }
  {
    const p = await tlsPaar(z);
    const v = new Verbindung(p.server, 4096);
    let ende: Error | undefined | null = null;
    v.on('ende', (f?: Error) => { ende = f; });
    p.client.write('x'.repeat(5000));
    await bis(() => ende !== null);
    pruefe(ende !== null && (ende as Error).message === 'rahmen', '4-KiB-Grenze überschritten → ende("rahmen")');
    p.schliesse();
  }
  {
    const p = await tlsPaar(z);
    const v = new Verbindung(p.server, 4096);
    v.setzeGrenze(1024 * 1024);
    const unbekannt: string[] = [];
    v.on('unbekannt', (t: string) => unbekannt.push(t));
    p.client.write(`{"t":"gross","x":"${'y'.repeat(100_000)}"}\n`);
    await bis(() => unbekannt.length === 1);
    gleich(unbekannt, ['gross'], 'nach setzeGrenze(1 MiB) kommen 100-KB-Zeilen durch');
    p.schliesse();
  }
  {
    // Geordnetes Schließen mit lesendem Peer: die gepufferte Zeile geht noch raus, 'ende' kommt schnell, genau einmal, ohne Fehler.
    const p = await tlsPaar(z);
    const v = new Verbindung(p.server, 4096);
    let gelesen = '';
    p.client.on('data', (d: Buffer) => { gelesen += d.toString('utf8'); });
    const enden: Array<Error | undefined> = [];
    v.on('ende', (f?: Error) => { enden.push(f); });
    v.sende({ t: 'abgelehnt', grund: 'unbekannt' });
    v.schliesse();
    const t0 = Date.now();
    pruefe(!v.offen, 'offen ist direkt nach schliesse() false');
    await bis(() => enden.length > 0 && gelesen.endsWith('\n'));
    const dauer = Date.now() - t0;
    gleich(gelesen, '{"t":"abgelehnt","grund":"unbekannt"}\n', 'gepufferte Zeile geht nach schliesse() noch raus');
    pruefe(dauer < 150, `lesender Peer: ende kommt sofort, nicht erst durch den 200-ms-Zwangsabbruch (${dauer} ms)`);
    await warte(300); // länger als der 200-ms-Zwangsabbruch: auch der darf kein zweites 'ende' auslösen
    pruefe(enden.length === 1, `ende genau einmal (${enden.length})`);
    pruefe(enden[0] === undefined, 'reguläres Schließen: ende ohne Fehler');
    p.schliesse();
  }
  {
    // Nach schliesse() wird nichts mehr verarbeitet: gepipelte Zeilen im selben Chunk werden verworfen, sende() tut nichts.
    const p = await tlsPaar(z);
    const v = new Verbindung(p.server, 4096);
    let gelesen = '';
    p.client.on('data', (d: Buffer) => { gelesen += d.toString('utf8'); });
    const enden: Array<Error | undefined> = [];
    let nachrichten = 0;
    let offenDirektDanach: boolean | null = null;
    v.on('ende', (f?: Error) => { enden.push(f); });
    v.on('nachricht', () => {
      nachrichten++;
      if (nachrichten !== 1) return;
      v.sende({ t: 'abgelehnt', grund: 'unbekannt' });
      v.schliesse();
      offenDirektDanach = v.offen;
      v.sende({ t: 'puls' }); // nach schliesse(): No-op, kein „write after end“
    });
    p.client.write(kodiere({ t: 'puls' }).repeat(3));
    await bis(() => enden.length > 0);
    await warte(300);
    gleich(nachrichten, 1, 'nach schliesse() wird keine weitere gepipelte Nachricht zugestellt');
    gleich(offenDirektDanach, false, 'offen ist im Handler direkt nach schliesse() false');
    gleich(gelesen, '{"t":"abgelehnt","grund":"unbekannt"}\n', 'sende() nach schliesse() schreibt nichts mehr');
    pruefe(enden.length === 1, `ende genau einmal (${enden.length})`);
    pruefe(enden[0] === undefined, 'sende() nach schliesse(): ende ohne Fehler (kein „write after end“)');
    p.schliesse();
  }
  {
    // Zurückhaltender Peer: liest die 'abgelehnt'-Zeile nicht und schließt deshalb nie zurück. schliesse() wartet höchstens
    // 200 ms, dann wird hart getrennt. Daten, die in dieser Zeit noch eintreffen, werden verworfen, auch eine überlange
    // Zeile: sie darf kein ende('rahmen') mehr auslösen.
    const p = await tlsPaar(z);
    p.client.on('error', () => {}); // Fehler des absichtlich stummen Clients sind hier nicht der Gegenstand
    const v = new Verbindung(p.server, 4096);
    const enden: Array<Error | undefined> = [];
    let nachrichten = 0;
    v.on('ende', (f?: Error) => { enden.push(f); });
    v.on('nachricht', () => {
      nachrichten++;
      v.sende({ t: 'abgelehnt', grund: 'unbekannt' });
      v.schliesse();
    });
    p.client.write(kodiere({ t: 'puls' }));
    await bis(() => nachrichten === 1);
    const t0 = Date.now();
    p.client.write(kodiere({ t: 'puls' }) + 'x'.repeat(5000)); // eigener Chunk: gültige Zeile plus Zeile über der 4-KiB-Grenze
    await bis(() => enden.length > 0, 1500);
    const dauer = Date.now() - t0;
    pruefe(enden.length === 1, `zurückhaltender Peer: ende kommt durch den Zwangsabbruch (${enden.length})`);
    pruefe(dauer >= 150, `Zwangsabbruch nicht vor Ablauf der 200 ms (${dauer} ms)`);
    pruefe(p.server.destroyed, 'Socket nach dem Zwangsabbruch zerstört');
    pruefe(enden[0] === undefined, 'Zwangsabbruch nach regulärem Schließen: ende ohne Fehler');
    gleich(nachrichten, 1, 'Daten nach schliesse() in einem späteren Chunk werden verworfen (auch die überlange Zeile)');
    p.schliesse();
  }
}

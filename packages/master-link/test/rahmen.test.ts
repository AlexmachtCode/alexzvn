import { abschnitt, bis, gleich, pruefe, warte } from './helfer';
import { erzeugeTestZertifikat } from './zertifikate';
import { tlsPaar } from './tlspaar';
import { GRENZEN } from '../src/fristen';
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

  abschnitt('Rahmen: Show-Daten mit lockeren Prüfern (Teil 2b, Spec 13.2)');
  const daten: Nachricht[] = [
    { t: 'abo', art: 'show', fassung: 1 },
    { t: 'stand', art: 'show', fassung: 1, epoche: 'e', folge: 0, schluessel: null, show: null, grund: 'keine-show', mitDokument: [] },
    { t: 'aenderung', art: 'show', fassung: 1, epoche: 'e', folge: 1, schluessel: null, show: null, grund: 'keine-show', mitDokument: [] },
  ];
  for (const n of daten) gleich(dekodiere(kodiere(n).slice(0, -1)), { art: 'nachricht', n }, `${n.t}: kodiere → dekodiere hin und zurück`);
  for (const zeile of ['{"t":"abo"}', '{"t":"stand","folge":"x"}', '{"t":"aenderung","show":[1,2]}', '{"t":"stand","epoche":null,"x":{}}']) {
    gleich(dekodiere(zeile).art, 'nachricht', `${zeile} → nachricht, nie kaputt (lockerer Prüfer)`);
  }
  gleich(PROTOKOLL, 1, 'PROTOKOLL bleibt 1 (Fähigkeiten laufen über fassung)');

  abschnitt('Rahmen: Kennungen und Nonces (gehen in Beweise und Signaturen ein)');
  {
    // hallo.nonce, koppeln.nonce, koppeln.rechnerId, anmelden.rechnerId: nicht leer, höchstens 128 Zeichen, kein „|“,
    // keine Steuerzeichen. Eine leere Nonce darf nie als „hallo gesehen“ durchgehen (Spec 3.3: harte Frist).
    const baue = (feld: 'hallo.nonce' | 'koppeln.nonce' | 'koppeln.rechnerId' | 'anmelden.rechnerId', wert: string): string => {
      const [t, name] = feld.split('.');
      const n: Record<string, unknown> = {
        hallo: { t: 'hallo', protokoll: 1, masterId: 'm', name: 'Regie-PC', nonce: 'n' },
        koppeln: { t: 'koppeln', protokoll: 1, rechnerId: 'r', rechnerName: 'B', nonce: 'n', schluessel: 'P', beweis: 'b' },
        anmelden: { t: 'anmelden', protokoll: 1, rechnerId: 'r', rechnerName: 'B', signatur: 's', teilnehmer },
      }[t]! as Record<string, unknown>;
      n[name] = wert;
      return JSON.stringify(n);
    };
    const felder = ['hallo.nonce', 'koppeln.nonce', 'koppeln.rechnerId', 'anmelden.rechnerId'] as const;
    const schlecht: Array<[string, string]> = [
      ['leer', ''],
      ['129 Zeichen', 'x'.repeat(129)],
      ['mit „|“', 'a|b'],
      ['nur „|“', '|'],
      ['mit Zeilenumbruch', 'a\nb'],
      ['mit NUL', 'a\u0000b'],
      ['mit Tabulator', 'a\tb'],
      ['mit U+001F', 'a\u001fb'],
      ['mit DEL (U+007F)', 'a\u007fb'],
    ];
    for (const feld of felder) {
      for (const [was, wert] of schlecht) {
        gleich(dekodiere(baue(feld, wert)), { art: 'kaputt' }, `${feld} ${was} → kaputt`);
      }
      for (const [was, wert] of [['128 Zeichen', 'x'.repeat(128)], ['mit Leerzeichen', 'Regie-Laptop 2-id'], ['mit Umlaut', 'Büro-é']] as const) {
        gleich(dekodiere(baue(feld, wert)).art, 'nachricht', `${feld} ${was} → gültig`);
      }
    }
  }

  abschnitt('Rahmen: Zeilenleser');
  /** Ein Stück füttern und alle fertigen Zeilen entnehmen — wie Verbindung.aufDaten, nur ohne Zuhörer dazwischen. */
  const alleZeilen = (leser: ZeilenLeser, stueck: Buffer): string[] => {
    leser.fuettere(stueck);
    const zeilen: string[] = [];
    for (let z = leser.naechste(); z !== null; z = leser.naechste()) zeilen.push(z);
    return zeilen;
  };
  const l = new ZeilenLeser(16);
  gleich(alleZeilen(l, Buffer.from('{"a"')), [], 'unvollständige Zeile → nichts');
  gleich(alleZeilen(l, Buffer.from(':1}\n{"b":2}\n')), ['{"a":1}', '{"b":2}'], 'zwei Zeilen über zwei Stücke');
  const e = Buffer.from('é\n', 'utf8');
  gleich([...alleZeilen(l, e.subarray(0, 1)), ...alleZeilen(l, e.subarray(1))], ['é'], 'UTF-8-Zeichen über Stückgrenze');
  let geworfen = false;
  try { alleZeilen(l, Buffer.from('x'.repeat(17))); } catch (f) { geworfen = f instanceof ZeileZuLang; }
  pruefe(geworfen, 'unvollständige Zeile über der Grenze → ZeileZuLang');
  const l2 = new ZeilenLeser(4);
  gleich(alleZeilen(l2, Buffer.from('abcd\n')), ['abcd'], 'Zeile genau an der Grenze ist erlaubt');
  l2.setzeGrenze(100);
  gleich(alleZeilen(l2, Buffer.from('x'.repeat(50) + '\n')), ['x'.repeat(50)], 'setzeGrenze hebt die Grenze an');

  abschnitt('Rahmen: Zeilenleser gibt Zeilen einzeln heraus (Teil 2b, Spec 13.4, 13.5)');
  {
    gleich([GRENZEN.maxStandZeile, GRENZEN.maxAbosJeRechner, GRENZEN.stauBytes], [921_600, 32, 1_048_576],
      'Grenzen Teil 2b: Stand-Zeile 900 KiB, 32 Abos je Rechner, Stau 1 MiB');
    const gross = 'g'.repeat(900 * 1024);
    // Die Grenze gilt beim Entnehmen: setzeGrenze nach der ersten Zeile wirkt schon für die zweite Zeile desselben Stücks.
    const l3 = new ZeilenLeser(GRENZEN.vorAnmeldung);
    l3.fuettere(Buffer.from(`a\n${gross}\n`));
    gleich(l3.naechste(), 'a', 'Grenze gilt beim Entnehmen: die erste Zeile kommt mit 4 KiB heraus');
    l3.setzeGrenze(GRENZEN.nachAnmeldung);
    pruefe(l3.naechste() === gross, 'Grenze gilt beim Entnehmen: nach setzeGrenze(1 MiB) kommt die 900-KiB-Zeile desselben Stücks heraus');
    gleich(l3.naechste(), null, '… danach keine weitere Zeile');
    const l4 = new ZeilenLeser(GRENZEN.vorAnmeldung);
    l4.fuettere(Buffer.from(`a\n${gross}\n`));
    const erste = l4.naechste();
    let wurf4 = false;
    try { l4.naechste(); } catch (f) { wurf4 = f instanceof ZeileZuLang; }
    pruefe(erste === 'a' && wurf4, 'ohne Anheben wirft die zweite Zeile, die erste kam vorher heraus');
    // Unvollständige Zeile: genau an der Grenze wartet sie, ein Byte darüber wirft.
    const l5 = new ZeilenLeser(4096);
    l5.fuettere(Buffer.alloc(4096, 0x78));
    gleich(l5.naechste(), null, 'unvollständige Zeile mit genau 4096 Byte → nichts, kein Wurf');
    l5.fuettere(Buffer.from('x'));
    let wurf5 = false;
    try { l5.naechste(); } catch (f) { wurf5 = f instanceof ZeileZuLang; }
    pruefe(wurf5, 'unvollständige Zeile mit 4097 Byte (ohne \\n) → ZeileZuLang');
    const l6 = new ZeilenLeser(4096);
    l6.fuettere(Buffer.from(`${'x'.repeat(4096)}\n${'y'.repeat(4097)}\n`));
    gleich(l6.naechste()?.length, 4096, 'Zeile mit genau 4096 Byte → heraus');
    let wurf6 = false;
    try { l6.naechste(); } catch (f) { wurf6 = f instanceof ZeileZuLang; }
    pruefe(wurf6, 'Zeile mit 4097 Byte → ZeileZuLang');
    // Review Focus 1: ein „ä“ (zwei Byte) genau auf der Stückgrenze.
    const umlaut = Buffer.from('{"name":"Bär"}\n', 'utf8');
    const mitte = umlaut.indexOf(0xc3) + 1;
    const l7 = new ZeilenLeser(4096);
    l7.fuettere(umlaut.subarray(0, mitte));
    gleich(l7.naechste(), null, 'Umlaut über die Stückgrenze: erste Hälfte → noch keine Zeile');
    l7.fuettere(umlaut.subarray(mitte));
    gleich(l7.naechste(), '{"name":"Bär"}', 'Umlaut über die Stückgrenze → unverändert dekodiert');
    // Kopierzähler (nur im Test gesetzt, Spec 19.1): zusammengefügt wird nur die fertige Zeile.
    const messung = { kopiert: 0 };
    const l8 = new ZeilenLeser(GRENZEN.nachAnmeldung, messung);
    const mib = Buffer.alloc(GRENZEN.nachAnmeldung + 1, 0x7a);
    mib[GRENZEN.nachAnmeldung] = 0x0a;
    let heraus: string | null = null;
    for (let ab = 0; ab < mib.length; ab += 16 * 1024) {
      l8.fuettere(mib.subarray(ab, ab + 16 * 1024));
      heraus = l8.naechste() ?? heraus;
    }
    gleich(heraus?.length, GRENZEN.nachAnmeldung, '1 MiB in 16-KiB-Stücken: die Zeile kommt ganz heraus');
    pruefe(messung.kopiert > 0 && messung.kopiert <= 2 * 1024 * 1024,
      `1 MiB in 16-KiB-Stücken kopiert höchstens 2 MiB (gemessen: ${messung.kopiert} Byte)`);
    const messung2 = { kopiert: 0 };
    const l9 = new ZeilenLeser(4096, messung2);
    gleich(alleZeilen(l9, Buffer.from('{"t":"puls"}\n{"t":"puls"}\n')), ['{"t":"puls"}', '{"t":"puls"}'], 'zwei ganze Zeilen in einem Stück');
    gleich(messung2.kopiert, 0, 'Zeilen ganz in einem Stück kopieren nichts');
  }

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

  abschnitt('Verbindung: Grenze je Zeile im selben TLS-Schreibvorgang (Teil 2b, Spec 13.5)');
  {
    // Wie 'angemeldet': der Zuhörer der ersten Zeile hebt die Grenze. Beide Zeilen gehen in EINEM write hinaus.
    const p = await tlsPaar(z);
    p.client.on('error', () => {}); // kappt der Server (Fehlerfall), meldet der Client ECONNRESET — dann zählt die Prüfzeile
    const v = new Verbindung(p.server, GRENZEN.vorAnmeldung);
    const angekommen: string[] = [];
    let ende: Error | undefined | null = null;
    v.on('nachricht', (n: Nachricht) => {
      angekommen.push(n.t);
      if (n.t === 'puls') v.setzeGrenze(GRENZEN.nachAnmeldung);
    });
    v.on('unbekannt', (t: string) => angekommen.push(t));
    v.on('ende', (f?: Error) => { ende = f; });
    p.client.write(`${kodiere({ t: 'puls' })}{"t":"gross","x":"${'y'.repeat(900 * 1024)}"}\n`);
    await bis(() => angekommen.length === 2 || ende !== null, 3000);
    gleich(angekommen, ['puls', 'gross'], 'Zuhörer der ersten Zeile hebt die Grenze: die 900-KiB-Zeile desselben Schreibvorgangs kommt an');
    pruefe(ende === null && v.offen, '… kein ende, die Verbindung bleibt offen');
    p.schliesse();
  }
  {
    const p = await tlsPaar(z);
    p.client.on('error', () => {}); // der Server kappt mitten im Schreiben: ECONNRESET beim Client ist hier nicht der Gegenstand
    const v = new Verbindung(p.server, GRENZEN.vorAnmeldung);
    const angekommen: string[] = [];
    let ende: Error | undefined | null = null;
    v.on('nachricht', (n: Nachricht) => angekommen.push(n.t));
    v.on('unbekannt', (t: string) => angekommen.push(t));
    v.on('ende', (f?: Error) => { ende = f; });
    p.client.write(`${kodiere({ t: 'puls' })}{"t":"gross","x":"${'y'.repeat(900 * 1024)}"}\n`);
    await bis(() => ende !== null, 3000);
    pruefe(ende !== null && (ende as Error).message === 'rahmen', 'ohne Anheben: ende("rahmen")');
    gleich(angekommen, ['puls'], '… die erste Zeile kam vorher an (früher ging sie mit dem ganzen Stück verloren)');
    p.schliesse();
  }

  abschnitt('Verbindung: Show-Daten, sende mit Rückgabe, sendeZeile (Teil 2b, Spec 13.2, 13.6)');
  {
    const p = await tlsPaar(z);
    const v = new Verbindung(p.server, GRENZEN.nachAnmeldung);
    const empfangen: Nachricht[] = [];
    let ende: Error | undefined | null = null;
    v.on('nachricht', (n: Nachricht) => empfangen.push(n));
    v.on('ende', (f?: Error) => { ende = f; });
    p.client.write('{"t":"stand","folge":"x","show":[]}\n');
    await bis(() => empfangen.length === 1 || ende !== null);
    gleich(empfangen, [{ t: 'stand', folge: 'x', show: [] }], 'stand mit falschem Feld → Ereignis nachricht (den Inhalt prüft der Empfänger)');
    pruefe(ende === null && v.offen, '… die Leitung bleibt');
    let gelesen = '';
    p.client.on('data', (d: Buffer) => { gelesen += d.toString('utf8'); });
    const zeile = '{"t":"aenderung","art":"show","fassung":1,"epoche":"e","folge":1,"schluessel":null,"show":null,"grund":"keine-show","mitDokument":[]}\n';
    gleich(v.sende({ t: 'puls' }), true, 'sende: offene Verbindung → true');
    gleich(v.sendeZeile(zeile), true, 'sendeZeile: offene Verbindung → true');
    await bis(() => gelesen.length >= 13 + zeile.length);
    gleich(gelesen, `{"t":"puls"}\n${zeile}`, 'sendeZeile: die fertige Zeile kommt unverändert an');
    const wirft = (x: string): boolean => {
      try {
        v.sendeZeile(x);
        return false;
      } catch {
        return true;
      }
    };
    pruefe(wirft('{"t":"puls"}'), 'sendeZeile ohne \\n am Ende → wirft');
    pruefe(wirft('{"t":"puls"}\n{"t":"puls"}\n'), 'sendeZeile mit \\n mitten in der Zeile → wirft');
    v.schliesse();
    gleich([v.sende({ t: 'puls' }), v.sendeZeile(zeile)], [false, false], 'nach schliesse(): sende und sendeZeile → false');
    p.schliesse();
  }
}

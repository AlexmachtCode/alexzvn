import { createServer, connect } from 'node:tls';
import { createServer as netServer, type AddressInfo } from 'node:net';
import { certFingerprint, randomNonce } from '@jm/auth-core';
import { masterBeweis } from '../src/beweis';
import { zeigeCode } from '../src/code';
import { GRENZEN } from '../src/fristen';
import { koppele } from '../src/koppeln';
import type { Nachricht } from '../src/rahmen';
import { Verbindung } from '../src/verbindung';
import { baueServer, meldeAn } from './aufbau';
import { abschnitt, bis, gleich, pruefe } from './helfer';
import { erzeugeTestZertifikat } from './zertifikate';

const rechnerC = { id: 'rechner-c', name: 'Neuer PC' };

/** Ein fremdes Gerät, das sich als Master ausgibt (eigenes Zertifikat, masterId „falsch“). */
async function falscherMaster(
  aufKoppeln: (v: Verbindung, n: Extract<Nachricht, { t: 'koppeln' }>, fp: string, ns: string) => void,
  /** Ersetzt das eine ordentliche 'hallo' (z. B. durch eine Schleife mit leerer Nonce). */
  hallo?: (v: Verbindung, ns: string) => void,
): Promise<{ port: number; schliesse(): void }> {
  const z = erzeugeTestZertifikat();
  const fp = certFingerprint(z.cert);
  const srv = createServer({ key: z.key, cert: z.cert }, (ts) => {
    const v = new Verbindung(ts, 1 << 20);
    const ns = randomNonce();
    v.on('nachricht', (n: Nachricht) => {
      if (n.t === 'koppeln') aufKoppeln(v, n, fp, ns);
    });
    if (hallo) hallo(v, ns);
    else v.sende({ t: 'hallo', protokoll: 1, masterId: 'falsch', name: 'Regie-PC', nonce: ns });
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  return { port: (srv.address() as AddressInfo).port, schliesse: () => srv.close() };
}

export async function laufe(): Promise<void> {
  abschnitt('Koppeln: Erfolg (Spec 3.3)');
  {
    const a = await baueServer();
    const { code } = a.server.oeffneKopplung();
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: code!, rechner: rechnerC });
    pruefe(r.ok, 'richtiger Code → gekoppelt');
    if (r.ok) {
      gleich(r.kopplung.fingerprint, a.server.fingerprint, 'gepinnter Fingerprint = Master');
      gleich(certFingerprint(r.kopplung.zertifikat), a.server.fingerprint, 'gespeichertes Zertifikat passt zum Pin');
      gleich(r.kopplung.masterId, a.identitaet.masterId, 'masterId übernommen');
      gleich(r.masterName, 'Regie-PC', 'Master-Name übernommen');
      gleich(a.verbund.finde('rechner-c')?.schluessel, r.kopplung.schluessel.oeffentlich, 'Master speichert NUR den öffentlichen Schlüssel');
      pruefe(!JSON.stringify(a.verbund.liste()).includes(r.kopplung.schluessel.privat), 'privater Schlüssel nie beim Master');
      const angekommen: Nachricht[] = [];
      r.verbindung.on('nachricht', (n: Nachricht) => angekommen.push(n));
      r.verbindung.sende({ t: 'teilnehmer', teilnehmer: { art: 'launcher', appId: 'jm-launcher', name: 'JM Production Suite', version: '0.12.0', pid: 2 } });
      await bis(() => angekommen.some((n) => n.t === 'angemeldet'));
      pruefe(angekommen.some((n) => n.t === 'angemeldet'), 'dieselbe Verbindung geht direkt in „angemeldet“ über');
      pruefe(a.server.teilnehmer().some((t) => t.rechnerId === 'rechner-c' && t.art === 'launcher'), 'Launcher als Teilnehmer am Master');
      r.verbindung.schliesse();
    }
    const nochmal = await koppele({ adresse: '127.0.0.1', port: a.port, code: code!, rechner: { id: 'rechner-d', name: 'D' } });
    gleich(nochmal.ok ? 'ok' : nochmal.art === 'abgelehnt' ? nochmal.grund : nochmal.art, 'code-ungueltig', 'Code ist nach Erfolg verbraucht');
    await a.server.stoppe();
  }

  abschnitt('Koppeln: Fenster, Fehlversuche, Ablauf');
  {
    let uhr = 1_000_000;
    const a = await baueServer({ jetzt: () => uhr });
    const keinFenster = await koppele({ adresse: '127.0.0.1', port: a.port, code: 'AAAAAAAAAA', rechner: rechnerC });
    gleich(keinFenster.ok ? '' : keinFenster.art === 'abgelehnt' ? keinFenster.grund : '', 'keine-kopplung-offen', 'ohne Fenster → keine-kopplung-offen');
    const { code } = a.server.oeffneKopplung();
    const falsch = code === '2222222222' ? '3333333333' : '2222222222';
    const r1 = await koppele({ adresse: '127.0.0.1', port: a.port, code: falsch, rechner: rechnerC });
    gleich(r1.ok ? null : r1, { ok: false, art: 'abgelehnt', grund: 'code-falsch', rest: 4 }, 'falscher Code → code-falsch, noch 4');
    for (let i = 0; i < 4; i++) await koppele({ adresse: '127.0.0.1', port: a.port, code: falsch, rechner: rechnerC });
    gleich(a.server.kopplungsStand().rest, 0, 'nach 5 Fehlversuchen rest 0');
    const r6 = await koppele({ adresse: '127.0.0.1', port: a.port, code: code!, rechner: rechnerC });
    gleich(r6.ok ? '' : r6.art === 'abgelehnt' ? r6.grund : '', 'code-ungueltig', 'nach 5 Fehlversuchen ist auch der richtige Code ungültig');
    pruefe(a.server.kopplungsStand().ungueltig && a.server.kopplungsStand().code === null, 'Stand: ungültig, Code nicht mehr angezeigt');

    const neu = a.server.neuerCode();
    uhr += 121_000;
    const alt = await koppele({ adresse: '127.0.0.1', port: a.port, code: neu.code!, rechner: rechnerC });
    gleich(alt.ok ? '' : alt.art === 'abgelehnt' ? alt.grund : '', 'code-ungueltig', 'nach 2 min abgelaufen');

    const c1 = a.server.neuerCode().code!;
    const c2 = a.server.neuerCode().code!;
    if (c1 !== c2) {
      const mitAlt = await koppele({ adresse: '127.0.0.1', port: a.port, code: c1, rechner: rechnerC });
      gleich(mitAlt.ok ? '' : mitAlt.art === 'abgelehnt' ? mitAlt.grund : '', 'code-falsch', 'neuer Code ersetzt den alten');
    }
    const mitNeu = await koppele({ adresse: '127.0.0.1', port: a.port, code: c2, rechner: { id: a.eigen.rechnerId, name: 'Klon' } });
    gleich(mitNeu.ok ? '' : mitNeu.art === 'abgelehnt' ? mitNeu.grund : '', 'rechner-id', 'Kennung des Masters selbst → rechner-id');
    a.server.schliesseKopplung();
    const zu = await koppele({ adresse: '127.0.0.1', port: a.port, code: c2, rechner: rechnerC });
    gleich(zu.ok ? '' : zu.art === 'abgelehnt' ? zu.grund : '', 'keine-kopplung-offen', 'Fenster geschlossen → keine-kopplung-offen');
    await a.server.stoppe();
  }

  abschnitt('Koppeln: erneut koppeln mit bekannter rechnerId');
  {
    const a = await baueServer();
    const alt = await meldeAn(a);
    await alt.naechste('angemeldet');
    const { code } = a.server.oeffneKopplung();
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: code!, rechner: { id: 'rechner-b', name: 'Regie-Laptop 2' } });
    pruefe(r.ok, 'bekannte rechnerId koppelt neu');
    gleich(await alt.naechste('abgelehnt', 1000), { t: 'abgelehnt', grund: 'signatur' }, 'alte Verbindungen des Rechners mit „signatur“ geschlossen');
    gleich(a.verbund.liste().filter((e) => e.rechnerId === 'rechner-b').length, 1, 'genau ein Eintrag');
    const mitAltemSchluessel = await meldeAn(a);
    gleich(await mitAltemSchluessel.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'signatur' }, 'alter Schlüssel gilt nicht mehr');
    if (r.ok) r.verbindung.schliesse();
    await a.server.stoppe();
  }

  abschnitt('Koppeln: Mittelsmann (wichtigster Test)');
  {
    const a = await baueServer();
    const { code } = a.server.oeffneKopplung();
    const z2 = erzeugeTestZertifikat();
    const relais = createServer({ key: z2.key, cert: z2.cert }, (vomSlave) => {
      const zumMaster = connect({ host: '127.0.0.1', port: a.port, rejectUnauthorized: false });
      vomSlave.on('error', () => {});
      zumMaster.on('error', () => {});
      vomSlave.pipe(zumMaster);
      zumMaster.pipe(vomSlave);
    });
    await new Promise<void>((r) => relais.listen(0, '127.0.0.1', r));
    const r = await koppele({ adresse: '127.0.0.1', port: (relais.address() as AddressInfo).port, code: code!, rechner: rechnerC });
    gleich(r.ok ? null : r, { ok: false, art: 'abgelehnt', grund: 'code-falsch', rest: 4 },
      'Relais mit eigenem Zertifikat: Master lehnt ab (anderer fp im Beweis), Fehlversuch gezählt');
    gleich(a.verbund.finde('rechner-c'), undefined, 'nichts gekoppelt');
    relais.close();
    await a.server.stoppe();
  }
  {
    const f = await falscherMaster((v) => v.sende({ t: 'gekoppelt', masterId: 'falsch', name: 'Regie-PC', beweis: 'ab'.repeat(32), adressen: [] }));
    const r = await koppele({ adresse: '127.0.0.1', port: f.port, code: 'K7QXM3PRTH', rechner: rechnerC });
    gleich(r.ok ? null : r, { ok: false, art: 'master-beweis' }, 'falscher Master mit beliebigem Beweis → abgelehnt, nichts gepinnt');
    f.schliesse();
  }
  {
    // Beweis korrekt gebildet, aber für eine andere masterId als im 'hallo' angekündigt.
    const K = 'K7QXM3PRTH';
    const f = await falscherMaster((v, n, fp, ns) => {
      const d = { fp, ns, nc: n.nonce, rechnerId: n.rechnerId, schluessel: n.schluessel };
      v.sende({ t: 'gekoppelt', masterId: 'anders', name: 'Regie-PC', beweis: masterBeweis(K, d, 'anders'), adressen: [] });
    });
    const r = await koppele({ adresse: '127.0.0.1', port: f.port, code: K, rechner: rechnerC });
    gleich(r.ok ? null : r, { ok: false, art: 'master-beweis' }, 'gekoppelt mit anderer masterId als im hallo → master-beweis');
    if (r.ok) r.verbindung.schliesse();
    f.schliesse();
  }
  {
    // Der Angreifer KENNT K (Offline-Raten gelungen), braucht aber länger als die Frist des Slaves.
    const K = 'K7QXM3PRTH';
    const f = await falscherMaster((v, n, fp, ns) => {
      const puls = setInterval(() => v.sende({ t: 'puls' }), 50);
      setTimeout(() => {
        clearInterval(puls);
        const d = { fp, ns, nc: n.nonce, rechnerId: n.rechnerId, schluessel: n.schluessel };
        v.sende({ t: 'gekoppelt', masterId: 'falsch', name: 'Regie-PC', beweis: masterBeweis(K, d, 'falsch'), adressen: [] });
      }, 450);
    });
    const r = await koppele({ adresse: '127.0.0.1', port: f.port, code: K, rechner: rechnerC, fristen: { koppelnMs: 300 } });
    gleich(r.ok ? null : r, { ok: false, art: 'frist' }, 'harte 10-s-Frist (hier 300 ms): Puls verlängert nicht, später Beweis wird nie angenommen');
    f.schliesse();
  }

  {
    // Der Angreifer kennt K und schickt 'hallo' mit LEERER Nonce in Schleife: das darf weder die harte Frist neu ansetzen
    // noch als „hallo gesehen“ gelten. Später käme ein 'hallo' mit echter Nonce und ein gültiges 'gekoppelt' (1,5 s).
    const K = 'K7QXM3PRTH';
    let echtGesendet = false;
    const f = await falscherMaster((v, n, fp) => {
      if (!echtGesendet) return;
      const d = { fp, ns: 'echt', nc: n.nonce, rechnerId: n.rechnerId, schluessel: n.schluessel };
      v.sende({ t: 'gekoppelt', masterId: 'falsch', name: 'X', beweis: masterBeweis(K, d, 'falsch'), adressen: [] });
    }, (v) => {
      const leer = (): void => v.sende({ t: 'hallo', protokoll: 1, masterId: 'falsch', name: 'X', nonce: '' });
      leer();
      const schleife = setInterval(leer, 50);
      v.on('ende', () => clearInterval(schleife));
      setTimeout(() => {
        clearInterval(schleife);
        echtGesendet = true;
        v.sende({ t: 'hallo', protokoll: 1, masterId: 'falsch', name: 'X', nonce: 'echt' });
      }, 1500);
    });
    const t0 = Date.now();
    const r = await koppele({ adresse: '127.0.0.1', port: f.port, code: K, rechner: rechnerC, fristen: { koppelnMs: 300 } });
    const dauer = Date.now() - t0;
    pruefe(!r.ok && (r.art === 'frist' || (r.art === 'verbindung' && r.code === 'kein-master')),
      `hallo mit leerer Nonce in Schleife → frist oder kein-master, nie gekoppelt (${r.ok ? 'ok' : r.art})`);
    pruefe(dauer < 1000, `… und innerhalb der Frist statt erst nach der Schleife (${dauer} ms)`);
    if (r.ok) r.verbindung.schliesse();
    f.schliesse();
  }
  {
    // Ein zweites 'hallo' (auch mit echter Nonce) wird nie beantwortet und setzt die Frist nicht neu.
    const K = 'K7QXM3PRTH';
    let koppelnGesamt = 0;
    const f = await falscherMaster((v, n, fp, ns) => {
      koppelnGesamt++;
      if (koppelnGesamt > 1) return;
      const weitere = setInterval(() => v.sende({ t: 'hallo', protokoll: 1, masterId: 'falsch', name: 'X', nonce: randomNonce() }), 50);
      v.on('ende', () => clearInterval(weitere));
      setTimeout(() => {
        clearInterval(weitere);
        const d = { fp, ns, nc: n.nonce, rechnerId: n.rechnerId, schluessel: n.schluessel };
        v.sende({ t: 'gekoppelt', masterId: 'falsch', name: 'X', beweis: masterBeweis(K, d, 'falsch'), adressen: [] });
      }, 450);
    });
    const r = await koppele({ adresse: '127.0.0.1', port: f.port, code: K, rechner: rechnerC, fristen: { koppelnMs: 300 } });
    gleich(r.ok ? null : r, { ok: false, art: 'frist' }, 'weitere hallo verlängern die Frist nicht, der späte gültige Beweis wird nie angenommen');
    gleich(koppelnGesamt, 1, 'auf weitere hallo folgt kein weiteres koppeln');
    f.schliesse();
  }

  abschnitt('Koppeln: Zeilengrenze (Spec 6.1)');
  {
    // Vor dem geprüften „gekoppelt“ spricht ein UNGEPRÜFTES Gegenüber: höchstens 4 KiB je Zeile.
    const f = await falscherMaster((v) => v.socket.write(`{"t":"gross","x":"${'y'.repeat(GRENZEN.vorAnmeldung)}"}\n`));
    const r = await koppele({ adresse: '127.0.0.1', port: f.port, code: 'K7QXM3PRTH', rechner: rechnerC, fristen: { koppelnMs: 1000 } });
    gleich(r.ok ? null : r, { ok: false, art: 'verbindung', code: 'kein-master' }, 'Zeile > 4 KiB vor „gekoppelt“ → sofort zu (kein-master), nicht erst nach der Frist');
    f.schliesse();
  }
  {
    // Nach dem geprüften „gekoppelt“ ist die Verbindung angemeldet (Spec 3.3): 1 MiB je Zeile.
    const K = 'K7QXM3PRTH';
    const f = await falscherMaster((v, n, fp, ns) => {
      const d = { fp, ns, nc: n.nonce, rechnerId: n.rechnerId, schluessel: n.schluessel };
      v.sende({ t: 'gekoppelt', masterId: 'falsch', name: 'Regie-PC', beweis: masterBeweis(K, d, 'falsch'), adressen: [] });
      setTimeout(() => v.socket.write(`{"t":"gross","x":"${'y'.repeat(100_000)}"}\n`), 100);
    });
    const r = await koppele({ adresse: '127.0.0.1', port: f.port, code: K, rechner: rechnerC });
    pruefe(r.ok, 'Gegenüber mit gültigem Beweis → gekoppelt');
    if (r.ok) {
      const unbekannt: string[] = [];
      r.verbindung.on('unbekannt', (t: string) => unbekannt.push(t));
      await bis(() => unbekannt.length > 0, 1000);
      pruefe(unbekannt.includes('gross') && r.verbindung.offen, 'nach dem geprüften „gekoppelt“ sind 100-KB-Zeilen erlaubt (1 MiB)');
      r.verbindung.schliesse();
    }
    f.schliesse();
  }

  abschnitt('Koppeln: Code und Ausnahmen (Spec 3.1, 3.2)');
  {
    const a = await baueServer();
    const { code } = a.server.oeffneKopplung();
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: zeigeCode(code!).toLowerCase(), rechner: rechnerC });
    pruefe(r.ok, 'Code wie eingegeben (klein, mit Bindestrich) → koppele() normalisiert selbst');
    if (r.ok) r.verbindung.schliesse();
    await a.server.stoppe();
  }
  {
    // Ohne lokal gültigen Code KEIN Socket (Spec 3.1) — auch wenn der Aufrufer nicht vorher prüft.
    let verbindungen = 0;
    const zaehler = netServer((s) => { verbindungen++; s.destroy(); });
    await new Promise<void>((r) => zaehler.listen(0, '127.0.0.1', r));
    const port = (zaehler.address() as AddressInfo).port;
    const arten: string[] = [];
    for (const code of ['K7QXO3PRTH', 'K7QXM', undefined as unknown as string]) {
      const r = await koppele({ adresse: '127.0.0.1', port, code, rechner: rechnerC });
      arten.push(r.ok ? 'ok' : r.art === 'verbindung' ? `${r.code}/${r.errCode}` : r.art);
    }
    gleich(arten, ['sonstig/CODE_UNGUELTIG', 'sonstig/CODE_UNGUELTIG', 'sonstig/CODE_UNGUELTIG'], 'fremdes Zeichen, zu kurz, kein Text → Fehlerergebnis');
    gleich(verbindungen, 0, '… ohne Verbindung zum Master (Spec 3.1)');
    zaehler.close();
  }
  {
    // Eine Ausnahme in einem Socket-Handler wäre ungefangen und beendete den ganzen Prozess (den Launcher).
    const a = await baueServer();
    a.server.oeffneKopplung();
    const wirft = { get id(): string { throw Object.assign(new Error('Testwurf'), { code: 'TESTWURF' }); }, name: 'Neuer PC' };
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: 'K7QXM3PRTH', rechner: wirft });
    gleich(r.ok ? null : r, { ok: false, art: 'verbindung', code: 'sonstig', errCode: 'TESTWURF' }, 'Ausnahme im Handler → Fehlerergebnis statt Absturz');
    await a.server.stoppe();
  }

  abschnitt('Koppeln: Abbruch und Verbindungsfehler');
  {
    const f = await falscherMaster(() => { /* schweigt */ });
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 100);
    const r = await koppele({ adresse: '127.0.0.1', port: f.port, code: 'K7QXM3PRTH', rechner: rechnerC, signal: ctrl.signal });
    gleich(r.ok ? null : r, { ok: false, art: 'abgebrochen' }, 'Dialog geschlossen → abgebrochen, nichts gespeichert');
    f.schliesse();
  }
  {
    const r = await koppele({ adresse: '127.0.0.1', port: 1, code: 'K7QXM3PRTH', rechner: rechnerC });
    pruefe(!r.ok && r.art === 'verbindung' && r.code === 'verweigert', 'niemand lauscht → verbindung/verweigert');
  }
}

import { abschnitt, gleich, pruefe } from './helfer';
import type { Karte } from '../src/adresswahl';
import {
  DIENST_TYP, instanzName, instanzOptionen, kuerzeFuerTxt, leseSichtung, MasterAnnonce, MdnsSuche,
  type BonjourLike, type MdnsDienst,
} from '../src/mdns';

class FakeBonjour implements BonjourLike {
  readonly opts: { interface: string; bind: string };
  readonly veroeffentlicht: Array<Record<string, unknown>> = [];
  readonly protokoll: string[];
  finds = 0;
  /** Antworten je find()-Aufruf; der letzte Eintrag gilt für alle weiteren Runden. */
  antworten: MdnsDienst[][] = [];

  constructor(opts: { interface: string; bind: string }, protokoll: string[]) {
    this.opts = opts;
    this.protokoll = protokoll;
  }
  publish(o: Record<string, unknown>): unknown {
    this.veroeffentlicht.push(o);
    this.protokoll.push(`publish ${this.opts.interface}`);
    return {};
  }
  find(_o: { type: string }, onUp?: (s: MdnsDienst) => void): { stop(): void } {
    const runde = this.antworten[this.finds] ?? this.antworten[this.antworten.length - 1] ?? [];
    this.finds++;
    let gestoppt = false;
    setTimeout(() => {
      if (!gestoppt) for (const s of runde) onUp?.(s);
    }, 5);
    return { stop: () => { gestoppt = true; } };
  }
  unpublishAll(cb?: () => void): void {
    this.protokoll.push(`unpublishAll ${this.opts.interface}`);
    setTimeout(() => cb?.(), 1);
  }
  destroy(cb?: () => void): void {
    this.protokoll.push(`destroy ${this.opts.interface}`);
    cb?.();
  }
}

const karten: Karte[] = [
  { name: 'Ethernet 2', adressen: [{ adresse: '10.0.0.110', praefix: 24 }, { adresse: '10.0.1.110', praefix: 24 }], virtuell: false, nurLinkLocal: false },
  { name: 'WLAN', adressen: [{ adresse: '192.168.1.20', praefix: 24 }], virtuell: false, nurLinkLocal: false },
];

export async function laufe(): Promise<void> {
  abschnitt('mDNS: Instanzen (Spec 4.2)');
  gleich(instanzOptionen(karten), [
    { interface: '10.0.0.110', bind: '0.0.0.0' },
    { interface: '192.168.1.20', bind: '0.0.0.0' },
  ], 'je Karte eine Instanz, erste IPv4, bind 0.0.0.0 (macOS)');
  gleich(instanzName('abcdef12-3456-7890-abcd-ef1234567890'), 'jm-master-abcdef12', 'Instanzname aus masterId');
  pruefe(instanzName('11111111-aaaa') !== instanzName('22222222-aaaa'), 'zwei Master → zwei Instanznamen (Review Focus 4)');
  gleich(DIENST_TYP, 'jmps-master', 'Diensttyp ohne Unterstrich (bonjour-service ergänzt ihn)');

  abschnitt('mDNS: Sichtung lesen');
  gleich(leseSichtung({ name: 'x', port: 8738, addresses: ['10.0.0.1', 'fe80::1'], txt: { id: 'm-1', name: 'Regie-PC', fp: 'ab', p: '1' } }),
    { masterId: 'm-1', name: 'Regie-PC', fpKurz: 'ab', protokoll: 1, adressen: ['10.0.0.1'] }, 'String-TXT, nur IPv4');
  gleich(leseSichtung({ name: 'x', port: 1, txt: { id: Buffer.from('m-2'), name: Buffer.from('Säle'), p: Buffer.from('1') } })?.name, 'Säle', 'Buffer-TXT wird UTF-8');
  gleich(leseSichtung({ name: 'x', port: 1, txt: { name: 'ohne id' } }), null, 'ohne id → keine Sichtung');

  abschnitt('mDNS: Netzdaten sind unvertrauenswürdig (Namen höchstens 60 Zeichen, Fix-Runde 1)');
  const emojiLang = '🎬'.repeat(70);
  gleich([...(leseSichtung({ name: 'x', port: 1, txt: { id: 'm-1', name: emojiLang } })?.name ?? '')].length, 60, 'Sichtung: 70 Emoji → 60 Zeichen');
  gleich([...(leseSichtung({ name: 'x', port: 1, txt: { id: 'm-1', name: 'a'.repeat(10_000) } })?.name ?? '')].length, 60, 'Sichtung: 10 000 ASCII-Zeichen → 60 Zeichen');
  gleich([...(leseSichtung({ name: 'x', port: 1, txt: { id: 'm-1', name: Buffer.from(emojiLang) } })?.name ?? '')].length, 60, 'Sichtung: überlanger Buffer-Name → 60 Zeichen');
  gleich(leseSichtung({ name: 'y'.repeat(500), port: 1, txt: { id: 'm-1' } })?.name.length, 60, 'Sichtung: überlanger Dienstname als Rückfall → 60 Zeichen');
  gleich(leseSichtung({ name: 'x', port: 1, txt: { id: 'm-1', name: '' } })?.name, 'x', 'Sichtung: leerer TXT-Name → Dienstname als Rückfall');
  gleich(leseSichtung({ name: 'x', port: 1, txt: { id: 'm-1', name: '   ' } })?.name, 'Unbenannt', 'Sichtung: nur Leerzeichen → „Unbenannt“ (kuerzeName)');
  gleich(leseSichtung({ name: 'x', port: 1, txt: { id: 'm-1', name: 'Regie-PC', fp: 'f'.repeat(200) } })?.fpKurz, 'f'.repeat(16), 'Sichtung: fp auf Kurzform (16) begrenzt');
  gleich(leseSichtung({ name: 'x', port: 1, txt: { id: 'i'.repeat(65), name: 'Regie-PC' } }), null, 'Sichtung: überlange id → verworfen');
  gleich(leseSichtung({ name: 'x', port: 1, txt: { id: 'i'.repeat(64), name: 'Regie-PC' } })?.masterId, 'i'.repeat(64), 'Sichtung: id mit 64 Zeichen bleibt');
  const fremd = (txt: Record<string, unknown>): ReturnType<typeof leseSichtung> | 'wurf' => {
    try {
      return leseSichtung({ name: 'x', port: 1, txt });
    } catch {
      return 'wurf';
    }
  };
  gleich(fremd({ id: 'm-1', name: { boese: 1 } }), null, 'Sichtung: name kein Text (Objekt) → verworfen, kein Wurf');
  gleich(fremd({ id: 'm-1', name: true }), null, 'Sichtung: name ohne Wert (true) → verworfen, kein Wurf');
  gleich(fremd({ id: 'm-1', name: 'Regie-PC', fp: 12345 }), null, 'Sichtung: fp kein Text (Zahl) → verworfen, kein Wurf');
  gleich(fremd({ id: 42, name: 'Regie-PC' }), null, 'Sichtung: id kein Text (Zahl) → verworfen, kein Wurf');
  gleich(fremd({ id: ['m-1'], name: 'Regie-PC' }), null, 'Sichtung: id kein Text (Liste) → verworfen, kein Wurf');
  gleich(leseSichtung({ name: undefined as unknown as string, port: 1, txt: { id: 'm-1' } }), null, 'Sichtung: weder TXT-Name noch Dienstname als Text → verworfen, kein Wurf');

  abschnitt('mDNS: Annonce');
  const protokoll: string[] = [];
  const instanzen: FakeBonjour[] = [];
  const fabrik = (o: { interface: string; bind: string }) => {
    const b = new FakeBonjour(o, protokoll);
    instanzen.push(b);
    return b;
  };
  const langName = '🎬'.repeat(70); // 280 Byte: ohne kuerzeFuerTxt wäre „name=…“ über 255 Byte
  const a = new MasterAnnonce(fabrik, { masterId: 'abcdef12-0000', name: langName, fp: 'f'.repeat(64), port: 8738 });
  a.starte(karten);
  gleich(instanzen.length, 2, 'Annonce auf zwei Karten');
  const pub = instanzen[0].veroeffentlicht[0] as { name: string; type: string; port: number; probe: boolean; disableIPv6: boolean; txt: Record<string, string> };
  gleich([pub.name, pub.type, pub.port, pub.probe, pub.disableIPv6], ['jm-master-abcdef12', 'jmps-master', 8738, false, true], 'publish-Optionen');
  gleich([pub.txt.id, pub.txt.fp, pub.txt.p], ['abcdef12-0000', 'f'.repeat(16), '1'], 'TXT id, Kurz-Fingerprint, Protokoll');
  pruefe(Buffer.byteLength(`name=${pub.txt.name}`) <= 255, `TXT name ≤ 255 Byte (${Buffer.byteLength(`name=${pub.txt.name}`)}) (Review Focus 1)`);
  pruefe(Buffer.byteLength(kuerzeFuerTxt('ü'.repeat(300))) <= 250, 'kuerzeFuerTxt kürzt nach Bytes');
  pruefe(!kuerzeFuerTxt('🎬'.repeat(100)).includes('�'), 'kuerzeFuerTxt schneidet kein Zeichen entzwei');
  await a.stoppe();
  const i0 = protokoll.indexOf('unpublishAll 10.0.0.110');
  const d0 = protokoll.indexOf('destroy 10.0.0.110');
  pruefe(i0 >= 0 && d0 > i0, 'stoppe: erst unpublishAll (Goodbye), dann destroy');

  // Spec: Namen höchstens 60 Zeichen. Der Name kommt aus identitaet.json und ist dort nur typgeprüft.
  const pubName = (b: FakeBonjour): string => (b.veroeffentlicht[b.veroeffentlicht.length - 1] as { txt: Record<string, string> }).txt.name;
  gleich([...pub.txt.name].length, 60, 'Annonce: 70 Emoji → veröffentlichter Name hat 60 Zeichen (Review Focus 1)');
  pruefe(Buffer.byteLength(`name=${pub.txt.name}`) <= 245, `Annonce: 60 Emoji + „name=“ ≤ 245 Byte (${Buffer.byteLength(`name=${pub.txt.name}`)})`);
  const instanzenB: FakeBonjour[] = [];
  const fabrikB = (o: { interface: string; bind: string }) => {
    const b = new FakeBonjour(o, []);
    instanzenB.push(b);
    return b;
  };
  const ascii = new MasterAnnonce(fabrikB, { masterId: 'abcdef12-0000', name: 'a'.repeat(10_000), fp: 'f'.repeat(64), port: 8738 });
  ascii.starte(karten);
  gleich([...pubName(instanzenB[0])].length, 60, 'Annonce: 10 000 ASCII-Zeichen → 60 Zeichen');
  instanzenB.length = 0;
  await ascii.aktualisiere(karten, '🎬'.repeat(70));
  gleich([instanzenB.length, [...pubName(instanzenB[0])].length], [2, 60], 'aktualisiere: 70 Emoji → 60 Zeichen');
  instanzenB.length = 0;
  await ascii.aktualisiere(karten, '   ');
  gleich(pubName(instanzenB[0]), 'Unbenannt', 'aktualisiere: leerer Name → „Unbenannt“');
  instanzenB.length = 0;
  await ascii.aktualisiere(karten);
  gleich(pubName(instanzenB[0]), 'Unbenannt', 'aktualisiere ohne Namen behält den gesäuberten Namen');
  await ascii.stoppe();

  abschnitt('mDNS: Suche mit neuem Browser je Runde');
  instanzen.length = 0;
  const s = new MdnsSuche(fabrik);
  s.setzeKarten(karten);
  gleich(instanzen.length, 2, 'Suche: eine Instanz je Karte');
  instanzen[0].antworten = [
    [{ name: 'a', port: 8738, addresses: ['10.0.0.50'], txt: { id: 'm-1', name: 'Regie-PC', fp: 'aa', p: '1' } }],
    [{ name: 'a', port: 8738, addresses: ['10.0.0.77'], txt: { id: 'm-1', name: 'Regie-PC', fp: 'aa', p: '1' } }],
  ];
  instanzen[1].antworten = [[
    { name: 'a', port: 8738, addresses: ['192.168.1.50'], txt: { id: 'm-1', name: 'Regie-PC', fp: 'aa', p: '1' } },
    { name: 'b', port: 8738, addresses: ['192.168.1.60'], txt: { id: 'm-2', name: 'Regie-PC', fp: 'bb', p: '1' } },
  ]];
  const r1 = await s.runde(50);
  gleich(r1.find((x) => x.masterId === 'm-1')?.adressen, ['10.0.0.50', '192.168.1.50'], 'Adressen derselben masterId zusammengeführt');
  gleich(r1.length, 2, 'zwei Master mit gleichem Namen bleiben unterscheidbar (Review Focus 4)');
  const r2 = await s.runde(50);
  gleich(r2.find((x) => x.masterId === 'm-1')?.adressen, ['10.0.0.77', '192.168.1.50'], 'neue Runde liefert die NEUE Adresse (kein alter Browser-Stand)');
  gleich(instanzen.map((i) => i.finds), [2, 2], 'je Runde ein neuer find()');
  s.setzeKarten(karten);
  gleich(instanzen.length, 2, 'gleiche Karten → keine neuen Instanzen');
  const zerstoertVorher = protokoll.filter((p) => p.startsWith('destroy')).length;
  s.setzeKarten([karten[1]]);
  gleich(instanzen.length, 3, 'andere Karten → Instanzen neu angelegt');
  gleich(protokoll.filter((p) => p.startsWith('destroy')).length - zerstoertVorher, 2, 'beide alten Instanzen zerstört');
  s.stoppe();

  abschnitt('mDNS: Suche, Fabrik wirft (Endprüfung A3)');
  {
    // Wirft die Fabrik an der ZWEITEN Karte: die erste Instanz dieser Runde wird geschlossen (kein Leck), der Wurf geht weiter,
    // und der nächste Aufruf mit DENSELBEN Karten legt neu an (der Schlüssel gilt erst nach vollständigem Anlegen).
    const prot: string[] = [];
    const angelegt: FakeBonjour[] = [];
    let wirftBei = 2;
    let aufrufe = 0;
    const s2 = new MdnsSuche((o) => {
      aufrufe++;
      if (aufrufe === wirftBei) throw new TypeError("Cannot read properties of undefined (reading 'mdns')");
      const b = new FakeBonjour(o, prot);
      angelegt.push(b);
      return b;
    });
    let geworfen = false;
    try {
      s2.setzeKarten(karten);
    } catch {
      geworfen = true;
    }
    pruefe(geworfen, 'Wurf der Fabrik geht an den Aufrufer weiter (Client/Listensuche melden ihn)');
    gleich(prot.filter((p) => p.startsWith('destroy')), ['destroy 10.0.0.110'], 'schon angelegte Instanz dieser Runde wird geschlossen (kein Leck)');
    wirftBei = 0;
    s2.setzeKarten(karten);
    gleich(angelegt.length, 3, 'nächster Aufruf mit denselben Karten legt beide Instanzen an (kein stilles „ohne mDNS“)');
    const r = await s2.runde(20);
    pruefe(Array.isArray(r) && angelegt.length === 3 && angelegt.slice(1).every((b) => b.finds === 1), 'danach sucht die Runde auf beiden Karten');
    s2.stoppe();
  }
}

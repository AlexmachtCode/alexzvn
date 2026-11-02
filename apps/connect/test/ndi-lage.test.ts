// NDI-Lage von JM Connect als reine Funktionen OHNE Electron (tsx): npm run selftest -w @jm/connect
// Spec 22.3 (Gast-Quellen), ab Plan C Task C2 22.4 (Programm-Empfang), ab Task C3 E50–E52 (Fristen, Peer-Fenster,
// Meldewege, Zählweise, STATE-Teil). Fälle PK37–PK45, PK53–PK55, KF11 (22.11). Die Zeit kommt von einer Testuhr (G-C2).
import { erzeugeNdiLage, leseGastMeldung, type GastMeldung, type NdiHandlung, type NdiLage } from '../src/main/ndi-lage';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// ── Testhilfen ──
/** Eine Lage mit Testuhr (Start bei 1000 ms), schaltbarem Peer-Fenster und Zählern für die Rückrufe. */
function testLage(peer = true) {
  const s = { t: 1000, peer, lage: 0, namen: 0 };
  const lage = erzeugeNdiLage({ jetzt: () => s.t, peerDa: () => s.peer, onLage: () => { s.lage++; }, onNamen: () => { s.namen++; } });
  return { lage, s };
}
type TestLage = ReturnType<typeof testLage>;
/** Handlungen ohne Logzeilen, kurz: „starten gast g1 G1“, „beenden gast g1 G1“, „planen gast g1 1000“. */
function kurz(h: NdiHandlung[]): string[] {
  return h.flatMap((x) => (x.art === 'log' ? [] : [x.art === 'neustartPlanen'
    ? `planen ${x.teil} ${x.schluessel} ${x.inMs}`
    : `${x.art === 'prozessStarten' ? 'starten' : 'beenden'} ${x.teil} ${x.schluessel} G${x.generation}`]));
}
const logs = (h: NdiHandlung[]): string[] => h.flatMap((x) => (x.art === 'log' ? [x.zeile] : []));
/** Generation aus der Handlung „prozessStarten“ (die Hülle merkt sie sich je Prozess); -1 ohne Start. */
function gen(h: NdiHandlung[]): number {
  for (const x of h) if (x.art === 'prozessStarten') return x.generation;
  return -1;
}
/** Zustand einer Quelle kurz: „sendet“, „gescheitert/addon“; „weg“ ohne Eintrag. */
function zst(l: NdiLage, k = 'g1'): string {
  const q = l.quelleLage(k);
  return q ? (q.grund ? `${q.zustand}/${q.grund}` : q.zustand) : 'weg';
}
const BEREIT: GastMeldung = { type: 'bereit' };
/** Erfundener NDI-Name mit Leerzeichen (er darf in keiner Logzeile stehen, E35). */
const ANNA = 'JM Connect – Anna Maria Beispiel';
/** spinUp mit Peer und „bereit“; gibt die Generation des laufenden Prozesses zurück. */
function sendend(t: TestLage, k = 'g1', label = ANNA): number {
  const g = gen(t.lage.spinUp(k, 'kamera', label));
  t.lage.gastMeldung(k, g, BEREIT);
  return g;
}
/** Absturz nach „bereit“, 1 s warten, `tick()`: gibt die Generation des neuen Prozesses zurück. */
function neustartNachAbsturz(t: TestLage, g: number, k = 'g1', code = 1): number {
  t.lage.gastExit(k, g, code);
  t.s.t += 1000;
  return gen(t.lage.tick());
}

console.log('— C1 PK37: Gast-Lage, Lebenslauf');
{
  const t = testLage();
  const h = t.lage.spinUp('g1', 'kamera', ANNA);
  ck('C1 PK37 spinUp mit Peer → startet, Handlung „Prozess starten“ mit Generation 1',
    zst(t.lage) === 'startet' && gleich(kurz(h), ['starten gast g1 G1']));
  ck('C1 PK37 startet: k 0, kein Grund, kein Code, Empfängerzahl unbekannt',
    gleich(t.lage.quelleLage('g1'), { schluessel: 'g1', art: 'kamera', label: ANNA, zustand: 'startet', grund: null, code: null, k: 0, empfaenger: null }));
  ck('C1 PK37 bereit → sendet, Empfängerzahl noch unbekannt (T108 Grundform)',
    gleich(kurz(t.lage.gastMeldung('g1', 1, BEREIT)), []) && zst(t.lage) === 'sendet' && t.lage.quelleLage('g1')?.empfaenger === null);
  t.lage.gastMeldung('g1', 1, { type: 'stat', connections: 2 });
  ck('C1 PK37 stat 2 → Empfängerzahl 2 („NDI ● 2 Empfänger“)', t.lage.quelleLage('g1')?.empfaenger === 2 && zst(t.lage) === 'sendet');
  t.s.t += 2999;
  t.lage.tick();
  ck('C1 PK37 2999 ms nach bereit ohne Videobild → noch sendet', zst(t.lage) === 'sendet');
  t.s.t += 1;
  t.lage.tick();
  ck('C1 PK37 3000 ms ohne Videobild → ohneBild', zst(t.lage) === 'ohneBild');
  t.lage.videobild('g1');
  ck('C1 PK37 Videobild in ohneBild → sendet', zst(t.lage) === 'sendet');
  t.s.t += 2999;
  t.lage.tick();
  ck('C1 PK37 letztes Videobild vor 2999 ms → sendet', zst(t.lage) === 'sendet');
  t.s.t += 1;
  t.lage.tick();
  ck('C1 PK37 letztes Videobild vor 3000 ms → ohneBild', zst(t.lage) === 'ohneBild');
  ck('C1 PK37 Empfängerzahl bleibt in ohneBild stehen', t.lage.quelleLage('g1')?.empfaenger === 2);
  ck('C1 PK37 spinUp für einen bestehenden Eintrag ändert nichts',
    gleich(t.lage.spinUp('g1', 'kamera', 'anders'), []) && t.lage.quelleLage('g1')?.label === ANNA && zst(t.lage) === 'ohneBild');
  const b = testLage();
  b.lage.spinUp('g1', 'kamera', ANNA);
  b.lage.videobild('g1');
  b.s.t += 2000;
  b.lage.gastMeldung('g1', 1, BEREIT);
  b.s.t += 2999;
  b.lage.tick();
  ck('C1 PK37 Videobild vor bereit: die 3 s laufen ab bereit (2999 ms → sendet)', zst(b.lage) === 'sendet');
}

console.log('— C1 PK38: Absturz nach bereit, Neustart höchstens dreimal, Rücksetzung nach 60 s');
{
  const t = testLage();
  const g1 = sendend(t);
  t.lage.gastMeldung('g1', g1, { type: 'stat', connections: 1 });
  const h = t.lage.gastExit('g1', g1, 1);
  ck('C1 PK38 exit 1 nach bereit → neustart, k = 1, Code 1, Handlung „in 1 s neu starten“',
    zst(t.lage) === 'neustart' && t.lage.quelleLage('g1')?.k === 1 && t.lage.quelleLage('g1')?.code === 1 && gleich(kurz(h), ['planen gast g1 1000']));
  ck('C1 PK38 neustart: Empfängerzahl wieder unbekannt', t.lage.quelleLage('g1')?.empfaenger === null);
  t.s.t += 999;
  ck('C1 PK38 tick nach 999 ms → noch kein neuer Prozess', gleich(kurz(t.lage.tick()), []) && zst(t.lage) === 'neustart');
  t.s.t += 1;
  const h2 = t.lage.tick();
  ck('C1 PK38 tick nach 1000 ms → neuer Prozess (Generation 2), weiter neustart mit k = 1',
    gleich(kurz(h2), ['starten gast g1 G2']) && zst(t.lage) === 'neustart' && t.lage.quelleLage('g1')?.k === 1);
  t.lage.gastMeldung('g1', 2, BEREIT);
  ck('C1 PK38 neuer Prozess bereit → sendet, k bleibt 1', zst(t.lage) === 'sendet' && t.lage.quelleLage('g1')?.k === 1);
  const g3 = neustartNachAbsturz(t, 2);
  t.lage.gastMeldung('g1', g3, BEREIT);
  ck('C1 PK38 zweiter Absturz in Folge → k = 2', t.lage.quelleLage('g1')?.k === 2);
  const g4 = neustartNachAbsturz(t, g3);
  t.lage.gastMeldung('g1', g4, BEREIT);
  ck('C1 PK38 dritter Absturz in Folge → k = 3', t.lage.quelleLage('g1')?.k === 3);
  const h4 = t.lage.gastExit('g1', g4, 4);
  ck('C1 PK38 vierter Absturz in Folge → gescheitert/absturz mit Code 4, kein Neustart',
    zst(t.lage) === 'gescheitert/absturz' && t.lage.quelleLage('g1')?.code === 4 && gleich(kurz(h4), []));
  t.s.t += 5000;
  ck('C1 PK38 gescheitert/absturz: auch nach 5 s kein Prozessstart', gleich(kurz(t.lage.tick()), []));

  const r = testLage();
  const r1 = sendend(r);
  const r2 = neustartNachAbsturz(r, r1);
  r.lage.gastMeldung('g1', r2, BEREIT);
  r.s.t += 59_999;
  r.lage.tick();
  r.lage.gastExit('g1', r2, 1);
  ck('C1 PK38 59 999 ms nach bereit: der nächste Absturz zählt weiter (k = 2)', r.lage.quelleLage('g1')?.k === 2);
  const v = testLage();
  const v1 = sendend(v);
  const v2 = neustartNachAbsturz(v, v1);
  v.lage.gastMeldung('g1', v2, BEREIT);
  v.s.t += 60_000;
  v.lage.tick();
  ck('C1 PK38 60 000 ms ununterbrochen nach bereit → Neustarts in Folge 0', v.lage.quelleLage('g1')?.k === 0);
  v.lage.gastExit('g1', v2, 1);
  ck('C1 PK38 … der nächste Absturz setzt wieder bei k = 1 an', v.lage.quelleLage('g1')?.k === 1 && zst(v.lage) === 'neustart');
}

console.log('— C1 PK39: Startfehler ohne Neustart');
{
  const t = testLage();
  t.lage.spinUp('g1', 'kamera', ANNA);
  const h = t.lage.gastExit('g1', 1, 1);
  ck('C1 PK39 exit 1 vor bereit → gescheitert/startAbbruch mit Code 1, kein Neustart',
    zst(t.lage) === 'gescheitert/startAbbruch' && t.lage.quelleLage('g1')?.code === 1 && gleich(kurz(h), []));
  t.s.t += 5000;
  ck('C1 PK39 startAbbruch: auch nach 5 s kein Prozessstart', gleich(kurz(t.lage.tick()), []));
  for (const grund of ['addon', 'init', 'sender'] as const) {
    const a = testLage();
    a.lage.spinUp('g1', 'kamera', ANNA);
    const ha = a.lage.gastMeldung('g1', 1, { type: 'abbruch', grund, text: 'Fehlertext' });
    ck(`C1 PK39 abbruch {${grund}} → gescheitert/${grund}, Handlung „Prozess beenden“ (Generation 1)`,
      zst(a.lage) === `gescheitert/${grund}` && gleich(kurz(ha), ['beenden gast g1 G1']));
    ck(`C1 PK39 abbruch {${grund}}: das folgende exit ändert nichts`,
      gleich(a.lage.gastExit('g1', 1, 1), []) && zst(a.lage) === `gescheitert/${grund}` && a.lage.quelleLage('g1')?.code === null);
  }
  const u = testLage();
  u.lage.spinUp('g1', 'kamera', ANNA);
  u.lage.gastMeldung('g1', 1, { type: 'abbruch', grund: 'unbekannt', text: '' });
  ck('C1 PK39 abbruch {unbekannt} → gescheitert/unbekannt (T139)', zst(u.lage) === 'gescheitert/unbekannt');
  const n = testLage();
  const n1 = sendend(n);
  const n2 = neustartNachAbsturz(n, n1);
  const hn = n.lage.gastExit('g1', n2, 3);
  ck('C1 PK39 nach einem Absturz scheitert der neue Prozess vor bereit → gescheitert/startAbbruch, Code 3, k bleibt 1',
    zst(n.lage) === 'gescheitert/startAbbruch' && n.lage.quelleLage('g1')?.code === 3 && n.lage.quelleLage('g1')?.k === 1 && gleich(kurz(hn), []));
  n.s.t += 5000;
  ck('C1 PK39 … kein weiterer Neustart', gleich(kurz(n.lage.tick()), []) && zst(n.lage) === 'gescheitert/startAbbruch');
}

console.log('— C1 PK40: Abbau und Generationen');
{
  const lagen: [string, (t: TestLage) => void, string[]][] = [
    ['startet', (t) => { t.lage.spinUp('g1', 'kamera', ANNA); }, ['beenden gast g1 G1']],
    ['sendet', (t) => { sendend(t); }, ['beenden gast g1 G1']],
    ['ohneBild', (t) => { sendend(t); t.s.t += 3000; t.lage.tick(); }, ['beenden gast g1 G1']],
    ['neustart, Neustart geplant', (t) => { t.lage.gastExit('g1', sendend(t), 1); }, []],
    ['neustart, neuer Prozess läuft', (t) => { neustartNachAbsturz(t, sendend(t)); }, ['beenden gast g1 G2']],
    ['gescheitert', (t) => { t.lage.spinUp('g1', 'kamera', ANNA); t.lage.gastExit('g1', 1, 1); }, []],
  ];
  for (const [name, bringe, erwartet] of lagen) {
    const t = testLage();
    bringe(t);
    const h = t.lage.tearDown('g1');
    ck(`C1 PK40 tearDown in ${name} → Eintrag weg, Handlungen ${JSON.stringify(erwartet)}`,
      t.lage.quelleLage('g1') === null && t.lage.quellen().length === 0 && gleich(kurz(h), erwartet));
  }
  const p = testLage();
  p.lage.gastExit('g1', sendend(p), 1);
  p.lage.tearDown('g1');
  p.s.t += 1000;
  ck('C1 PK40 tearDown in neustart: der geplante Neustart entfällt (kein Prozessstart nach 1 s)', gleich(kurz(p.lage.tick()), []));
  ck('C1 PK40 tearDown eines unbekannten Schlüssels → nichts', gleich(p.lage.tearDown('g9'), []));

  const a = testLage();
  const a1 = sendend(a);
  const a2 = neustartNachAbsturz(a, a1);
  ck('C1 PK40 alte Generation: bereit ändert nichts (neustart bleibt)', gleich(a.lage.gastMeldung('g1', a1, BEREIT), []) && zst(a.lage) === 'neustart');
  ck('C1 PK40 alte Generation: stat ändert nichts', gleich(a.lage.gastMeldung('g1', a1, { type: 'stat', connections: 5 }), [])
    && a.lage.quelleLage('g1')?.empfaenger === null);
  ck('C1 PK40 alte Generation: abbruch ändert nichts', gleich(a.lage.gastMeldung('g1', a1, { type: 'abbruch', grund: 'init', text: '' }), [])
    && zst(a.lage) === 'neustart');
  ck('C1 PK40 alte Generation: exit ändert nichts', gleich(a.lage.gastExit('g1', a1, 9), []) && zst(a.lage) === 'neustart' && a.lage.quelleLage('g1')?.k === 1);
  a.lage.gastMeldung('g1', a2, BEREIT);
  ck('C1 PK40 aktuelle Generation wirkt (bereit → sendet)', zst(a.lage) === 'sendet');
  ck('C1 PK40 Ereignisse eines unbekannten Schlüssels → nichts',
    gleich(a.lage.gastMeldung('g9', a2, BEREIT), []) && gleich(a.lage.gastExit('g9', a2, 1), []) && gleich(a.lage.videobild('g9'), []));
}

console.log('— C1 PK41: „NDI neu starten“ nur in gescheitert');
{
  const lagen: [string, (t: TestLage) => void][] = [
    ['startet', (t) => { t.lage.spinUp('g1', 'kamera', ANNA); }],
    ['sendet', (t) => { sendend(t); }],
    ['ohneBild', (t) => { sendend(t); t.s.t += 3000; t.lage.tick(); }],
    ['neustart', (t) => { t.lage.gastExit('g1', sendend(t), 1); }],
  ];
  for (const [name, bringe] of lagen) {
    const t = testLage();
    bringe(t);
    const vorher = JSON.stringify(t.lage.quelleLage('g1'));
    ck(`C1 PK41 NDI neu starten in ${name} → nichts`, gleich(t.lage.gastNeustart('g1'), []) && JSON.stringify(t.lage.quelleLage('g1')) === vorher);
  }
  const t = testLage();
  const t1 = sendend(t);
  const t2 = neustartNachAbsturz(t, t1);
  t.lage.gastExit('g1', t2, 1);
  const h = t.lage.gastNeustart('g1');
  ck('C1 PK41 NDI neu starten in gescheitert → startet, k = 0, Grund und Code leer, neuer Prozess (Generation 3)',
    gleich(t.lage.quelleLage('g1'), { schluessel: 'g1', art: 'kamera', label: ANNA, zustand: 'startet', grund: null, code: null, k: 0, empfaenger: null })
    && gleich(kurz(h), ['starten gast g1 G3']));
  ck('C1 PK41 NDI neu starten eines unbekannten Schlüssels → nichts', gleich(t.lage.gastNeustart('g9'), []));
}

console.log('— C1 PK42: kein Peer-Fenster (spinUp, Knopf, geplanter Neustart)');
{
  const t = testLage(false);
  const h = t.lage.spinUp('g1', 'kamera', ANNA);
  ck('C1 PK42 spinUp ohne Peer-Fenster → gescheitert/keinPeer ohne Prozess', zst(t.lage) === 'gescheitert/keinPeer' && gleich(kurz(h), []));
  ck('C1 PK42 NDI neu starten, Peer weiter weg → bleibt gescheitert/keinPeer ohne Prozess',
    gleich(kurz(t.lage.gastNeustart('g1')), []) && zst(t.lage) === 'gescheitert/keinPeer');
  t.s.peer = true;
  ck('C1 PK42 NDI neu starten mit Peer → startet mit Prozess', gleich(kurz(t.lage.gastNeustart('g1')), ['starten gast g1 G1']) && zst(t.lage) === 'startet');
  const r = testLage();
  r.lage.gastExit('g1', sendend(r), 1);
  r.s.peer = false;
  r.s.t += 1000;
  const hr = r.lage.tick();
  ck('C1 PK42 geplanter Neustart ohne Peer-Fenster → gescheitert/keinPeer, kein Prozess', zst(r.lage) === 'gescheitert/keinPeer' && gleich(kurz(hr), []));
}

console.log('— C1 PK43: Namensliste für T46 und onNamen');
{
  const t = testLage();
  const n0 = t.s.namen;
  t.lage.spinUp('g1', 'kamera', 'JM Connect – A');
  ck('C1 PK43 startet steht in der Liste, onNamen einmal', gleich(t.lage.namensListe(), ['JM Connect – A']) && t.s.namen === n0 + 1);
  t.lage.gastMeldung('g1', 1, BEREIT);
  t.lage.gastMeldung('g1', 1, { type: 'stat', connections: 3 });
  t.s.t += 3000;
  t.lage.tick();
  ck('C1 PK43 startet → sendet → ohneBild und neue Empfängerzahl: Liste gleich, kein onNamen',
    zst(t.lage) === 'ohneBild' && gleich(t.lage.namensListe(), ['JM Connect – A']) && t.s.namen === n0 + 1);
  t.lage.spinUp('g2::screen', 'bildschirm', 'JM Connect – A (Bildschirm)');
  ck('C1 PK43 zweite Quelle kommt dazu, onNamen', gleich(t.lage.namensListe(), ['JM Connect – A', 'JM Connect – A (Bildschirm)']) && t.s.namen === n0 + 2);
  t.lage.gastExit('g1', 1, 1);
  ck('C1 PK43 neustart steht in der Liste, kein onNamen', zst(t.lage) === 'neustart' && t.lage.namensListe().length === 2 && t.s.namen === n0 + 2);
  t.lage.gastExit('g2::screen', 2, 1);
  ck('C1 PK43 gescheitert fällt aus der Liste, onNamen', zst(t.lage, 'g2::screen') === 'gescheitert/startAbbruch'
    && gleich(t.lage.namensListe(), ['JM Connect – A']) && t.s.namen === n0 + 3);
  t.lage.gastNeustart('g2::screen');
  ck('C1 PK43 NDI neu starten bringt den Namen zurück, onNamen', t.lage.namensListe().length === 2 && t.s.namen === n0 + 4);
  t.lage.tearDown('g2::screen');
  ck('C1 PK43 tearDown nimmt den Namen heraus, onNamen', gleich(t.lage.namensListe(), ['JM Connect – A']) && t.s.namen === n0 + 5);
  const k = testLage(false);
  k.lage.spinUp('g1', 'kamera', 'JM Connect – B');
  ck('C1 PK43 spinUp ohne Peer (gescheitert): Liste leer, kein onNamen', gleich(k.lage.namensListe(), []) && k.s.namen === 0);
}

console.log('— C1 PK54: Leser der Gast-Leitung');
{
  const verworfen = (r: unknown): boolean => typeof r === 'object' && r !== null && 'verworfen' in r
    && typeof (r as { verworfen: unknown }).verworfen === 'string';
  ck('C1 PK54 bereit → bereit', gleich(leseGastMeldung({ type: 'bereit' }), { type: 'bereit' }));
  for (const grund of ['addon', 'init', 'sender'] as const) {
    ck(`C1 PK54 abbruch {${grund}} mit Text → abbruch {${grund}}`,
      gleich(leseGastMeldung({ type: 'abbruch', grund, text: 'x' }), { type: 'abbruch', grund, text: 'x' }));
  }
  ck('C1 PK54 abbruch mit unbekanntem Grund → Grund unbekannt', gleich(leseGastMeldung({ type: 'abbruch', grund: 'kaputt', text: 'x' }),
    { type: 'abbruch', grund: 'unbekannt', text: 'x' }));
  ck('C1 PK54 abbruch ohne Grund und Text → unbekannt, Text leer', gleich(leseGastMeldung({ type: 'abbruch' }), { type: 'abbruch', grund: 'unbekannt', text: '' }));
  ck('C1 PK54 stat 0 und stat 3 → Empfängerzahl', gleich(leseGastMeldung({ type: 'stat', connections: 0 }), { type: 'stat', connections: 0 })
    && gleich(leseGastMeldung({ type: 'stat', connections: 3 }), { type: 'stat', connections: 3 }));
  ck('C1 PK54 stat mit negativer Zahl → verworfen', verworfen(leseGastMeldung({ type: 'stat', connections: -1 })));
  ck('C1 PK54 stat mit nicht ganzer Zahl → verworfen', verworfen(leseGastMeldung({ type: 'stat', connections: 1.5 })));
  ck('C1 PK54 stat ohne Zahl bzw. mit Text → verworfen', verworfen(leseGastMeldung({ type: 'stat' })) && verworfen(leseGastMeldung({ type: 'stat', connections: '2' })));
  ck('C1 PK54 alte Meldungen status und stopped → verworfen, Grund nennt die Art',
    verworfen(leseGastMeldung({ type: 'status', state: 'connected' })) && verworfen(leseGastMeldung({ type: 'stopped' }))
    && (leseGastMeldung({ type: 'stopped' }) as { verworfen: string }).verworfen.includes('stopped'));
  ck('C1 PK54 keine Nachricht (null, Text, Zahl) → verworfen',
    verworfen(leseGastMeldung(null)) && verworfen(leseGastMeldung('bereit')) && verworfen(leseGastMeldung(7)));
  ck('C1 PK54 Art ohne kurzes Wort → verworfen, ohne den Wert zu wiederholen',
    (leseGastMeldung({ type: 'JM Connect – Anna Maria Beispiel' }) as { verworfen: string }).verworfen === 'unbekannte Art (unlesbar)');
}

console.log('— C1 KF11: quelleLage und quellen mit abweichenden Werten');
{
  const t = testLage();
  t.lage.spinUp('g7', 'kamera', ANNA);
  const b1 = gen(t.lage.spinUp('g7::screen', 'bildschirm', 'JM Connect – Ben (Bildschirm)'));
  t.lage.gastMeldung('g7::screen', b1, BEREIT);
  const b2 = neustartNachAbsturz(t, b1, 'g7::screen');
  t.lage.gastMeldung('g7::screen', b2, BEREIT);
  t.lage.gastMeldung('g7::screen', b2, { type: 'stat', connections: 2 });
  ck('C1 KF11 sendet nach einem Neustart: Schlüssel, Art, Name, Zustand, k, Empfänger',
    gleich(t.lage.quelleLage('g7::screen'), { schluessel: 'g7::screen', art: 'bildschirm', label: 'JM Connect – Ben (Bildschirm)', zustand: 'sendet',
      grund: null, code: null, k: 1, empfaenger: 2 }));
  const b3 = neustartNachAbsturz(t, b2, 'g7::screen');
  t.lage.gastExit('g7::screen', b3, 3);
  ck('C1 KF11 gescheitert/startAbbruch: Grund, Code 3, k 2, Empfänger unbekannt',
    gleich(t.lage.quelleLage('g7::screen'), { schluessel: 'g7::screen', art: 'bildschirm', label: 'JM Connect – Ben (Bildschirm)', zustand: 'gescheitert',
      grund: 'startAbbruch', code: 3, k: 2, empfaenger: null }));
  ck('C1 KF11 quellen() in der Reihenfolge der Einträge', gleich(t.lage.quellen().map((q) => q.schluessel), ['g7', 'g7::screen']));
  const kopie = t.lage.quelleLage('g7');
  if (kopie) kopie.zustand = 'sendet';
  const liste = t.lage.quellen();
  liste[0].k = 9;
  ck('C1 KF11 quelleLage und quellen liefern Kopien', zst(t.lage, 'g7') === 'startet' && t.lage.quelleLage('g7')?.k === 0);
  ck('C1 KF11 quelleLage eines unbekannten Schlüssels → null', t.lage.quelleLage('g9') === null);
}

console.log('— C1 E35: Logzeilen ohne Namen, mit Generation und PID');
{
  const t = testLage();
  const alle: NdiHandlung[] = [];
  const h1 = t.lage.spinUp('g1', 'kamera', ANNA);
  const g1 = gen(h1);
  alle.push(...h1, ...t.lage.spinUp('g2', 'kamera', 'JM Connect – Anna Maria Beispiel 2'));
  // Die Hülle meldet die PID ab `spawn` (C-EB4); eine Generation, die keinem Eintrag gehört, ändert nichts.
  t.lage.prozessPid(g1, 4711);
  t.lage.prozessPid(2, 4712);
  t.lage.prozessPid(99, 4799);
  alle.push(...t.lage.gastMeldung('g1', g1, BEREIT));
  t.s.t += 3000;
  alle.push(...t.lage.tick(), ...t.lage.videobild('g1'), ...t.lage.gastExit('g1', g1, 1));
  t.s.t += 1000;
  const hn = t.lage.tick();
  alle.push(...hn);
  t.lage.prozessPid(g1, 4798);
  t.lage.prozessPid(gen(hn), 4713);
  alle.push(...t.lage.gastMeldung('g2', 2, { type: 'abbruch', grund: 'sender', text: 'NDIlib_send_create fehlgeschlagen' }));
  alle.push(...t.lage.tearDown('g1'), ...t.lage.gastNeustart('g2'));
  const zeilen = logs(alle);
  ck('C1 E35 jeder Zustandswechsel schreibt eine Logzeile (10)', zeilen.length === 10);
  ck('C1 E35 keine Logzeile nennt einen NDI-Namen', zeilen.every((z) => !z.includes('Anna')));
  ck('C1 E35 jede Logzeile nennt Schlüssel, Generation und PID',
    zeilen.every((z) => /^\[ndi-lage\] Gast g[12] \(Generation \d+, PID (\d+|–)\): /.test(z)));
  ck('C1 E35 PID der eigenen Generation ab prozessPid, „–“ davor und ab jedem neuen Prozess; eine andere Generation ändert sie nicht',
    gleich(zeilen.map((z) => / PID (\d+|–)\): /.exec(z)?.[1] ?? '?'), ['–', '–', '4711', '4711', '4711', '4711', '–', '4712', '4713', '–']));
  ck('C1 E35 Abbruch: Grund und Text der Meldung im Log', zeilen.some((z) => z.includes('Grund sender') && z.includes('NDIlib_send_create fehlgeschlagen')));
  ck('C1 E35 Absturz: Code und Neustarts im Log', zeilen.some((z) => z.includes('sendet → neustart, Code 1, Neustarts 1')));
}

// ── Testhilfen Programm-Empfang (Plan C, Task C2) ──
const { leseProgrammMeldung, programmBildLage } = await import('../src/main/ndi-lage');
type ProgrammMeldungT = import('../src/main/ndi-lage').ProgrammMeldung;
const PB: ProgrammMeldungT = { type: 'bereit' };
const HINWEIS = 'JM Switcher Regie';
/** Programm-Zustand kurz: „sucht“, „gescheitert/init“. */
function pz(l: NdiLage): string {
  const p = l.programmLage();
  return p.grund ? `${p.zustand}/${p.grund}` : p.zustand;
}
/** Start mit Peer und „bereit“; gibt die Generation des laufenden Prozesses zurück. */
function programmBereit(t: TestLage, hinweis = HINWEIS): number {
  const g = gen(t.lage.programmStart(hinweis));
  t.lage.programmMeldung(g, PB);
  return g;
}
/** Absturz nach „bereit“, 1 s warten, `tick()`: gibt die Generation des neuen Prozesses zurück. */
function programmNeustartNachAbsturz(t: TestLage, g: number, code = 1): number {
  t.lage.programmExit(g, code);
  t.s.t += 1000;
  return gen(t.lage.tick());
}

console.log('— C2 PK44: Programm-Lage und Lebenslauf');
{
  const t = testLage();
  ck('C2 PK44 vor dem Start: aus, k 0, ohne Quelle und Hinweis, nicht bereit',
    gleich(t.lage.programmLage(), { zustand: 'aus', grund: null, code: null, k: 0, quelle: null, hinweis: '', bereit: false }));
  const h = t.lage.programmStart(HINWEIS);
  ck('C2 PK44 Start → sucht, hinweis aus dem Start in der Lage, Handlung „Prozess starten“ (Generation 1)',
    pz(t.lage) === 'sucht' && t.lage.programmLage().hinweis === HINWEIS && !t.lage.programmLage().bereit
    && gleich(kurz(h), ['starten programm programm G1']));
  t.lage.programmMeldung(1, PB);
  ck('C2 PK44 bereit → weiter sucht, bereit', pz(t.lage) === 'sucht' && t.lage.programmLage().bereit);
  t.lage.programmMeldung(1, { type: 'lage', zustand: 'keineQuelle' });
  ck('C2 PK44 lage keineQuelle → keineQuelle ohne Quelle', pz(t.lage) === 'keineQuelle' && t.lage.programmLage().quelle === null);
  t.lage.programmMeldung(1, { type: 'lage', zustand: 'verbunden', quelle: 'REGIE-PC (JM Switcher Regie)' });
  ck('C2 PK44 lage verbunden → verbunden mit Quelle', pz(t.lage) === 'verbunden' && t.lage.programmLage().quelle === 'REGIE-PC (JM Switcher Regie)');
  ck('C2 PK44 lage ohne Wechsel → keine Handlung', gleich(t.lage.programmMeldung(1, { type: 'lage', zustand: 'verbunden', quelle: 'REGIE-PC (JM Switcher Regie)' }), []));
  const he = t.lage.programmExit(1, 1);
  ck('C2 PK44 Absturz nach bereit → neustart, k = 1, Code 1, Quelle leer, Handlung „in 1 s neu starten“',
    pz(t.lage) === 'neustart' && t.lage.programmLage().k === 1 && t.lage.programmLage().code === 1 && t.lage.programmLage().quelle === null
    && gleich(kurz(he), ['planen programm programm 1000']));
  t.s.t += 999;
  ck('C2 PK44 tick nach 999 ms → noch kein neuer Prozess', gleich(kurz(t.lage.tick()), []) && pz(t.lage) === 'neustart');
  t.s.t += 1;
  const hn = t.lage.tick();
  ck('C2 PK44 tick nach 1000 ms → neuer Prozess, weiter neustart (nie aus), k bleibt 1, Hinweis bleibt',
    gleich(kurz(hn), ['starten programm programm G2']) && pz(t.lage) === 'neustart' && t.lage.programmLage().k === 1
    && t.lage.programmLage().hinweis === HINWEIS);
  t.lage.programmMeldung(2, PB);
  ck('C2 PK44 neuer Prozess bereit → sucht, k bleibt 1', pz(t.lage) === 'sucht' && t.lage.programmLage().k === 1);
  const g3 = programmNeustartNachAbsturz(t, 2);
  t.lage.programmMeldung(g3, PB);
  ck('C2 PK44 zweiter Absturz in Folge → k = 2', t.lage.programmLage().k === 2);
  const g4 = programmNeustartNachAbsturz(t, g3);
  t.lage.programmMeldung(g4, PB);
  ck('C2 PK44 dritter Absturz in Folge → k = 3', t.lage.programmLage().k === 3);
  ck('C2 PK44 vierter Absturz in Folge → gescheitert/absturz mit Code 4, kein Neustart',
    gleich(kurz(t.lage.programmExit(g4, 4)), []) && pz(t.lage) === 'gescheitert/absturz' && t.lage.programmLage().code === 4);

  for (const [ms, k] of [[59_999, 2], [60_000, 1]] as const) {
    const r = testLage();
    const r1 = programmBereit(r);
    const r2 = programmNeustartNachAbsturz(r, r1);
    r.lage.programmMeldung(r2, PB);
    r.s.t += ms;
    r.lage.tick();
    r.lage.programmExit(r2, 1);
    ck(`C2 PK44 ${ms} ms Leben nach bereit, dann Absturz → neustart mit k = ${k}`, r.lage.programmLage().k === k && pz(r.lage) === 'neustart');
  }

  const s = testLage();
  s.lage.programmStart(HINWEIS);
  ck('C2 PK44 Ende vor bereit → gescheitert/startAbbruch mit Code 2, kein Neustart',
    gleich(kurz(s.lage.programmExit(1, 2)), []) && pz(s.lage) === 'gescheitert/startAbbruch' && s.lage.programmLage().code === 2);
  s.s.t += 5000;
  ck('C2 PK44 … auch nach 5 s kein Prozessstart', gleich(kurz(s.lage.tick()), []));
  for (const grund of ['init', 'addon', 'unbekannt'] as const) {
    const a = testLage();
    a.lage.programmStart(HINWEIS);
    const ha = a.lage.programmMeldung(1, { type: 'abbruch', grund, text: 'x' });
    ck(`C2 PK44 abbruch {${grund}} → gescheitert/${grund}, Handlung „Prozess beenden“`,
      pz(a.lage) === `gescheitert/${grund}` && gleich(kurz(ha), ['beenden programm programm G1']));
    ck(`C2 PK44 abbruch {${grund}}: das folgende exit ändert nichts`, gleich(a.lage.programmExit(1, 1), []) && pz(a.lage) === `gescheitert/${grund}`);
  }

  const st = testLage();
  const st1 = programmBereit(st);
  st.lage.programmMeldung(st1, { type: 'lage', zustand: 'verbunden', quelle: 'Q' });
  const hs = st.lage.programmStop();
  ck('C2 PK44 programmStop → aus, Handlung „Prozess beenden“, Hinweis bleibt',
    gleich(st.lage.programmLage(), { zustand: 'aus', grund: null, code: null, k: 0, quelle: null, hinweis: HINWEIS, bereit: false })
    && gleich(kurz(hs), ['beenden programm programm G1']));
  ck('C2 PK44 ein exit nach programmStop ist kein Absturz (bleibt aus)', gleich(st.lage.programmExit(st1, 1), []) && pz(st.lage) === 'aus');
  ck('C2 PK44 programmStop in aus → nichts', gleich(st.lage.programmStop(), []));
  const sn = testLage();
  sn.lage.programmExit(programmBereit(sn), 1);
  ck('C2 PK44 programmStop in neustart (Neustart geplant) → aus ohne „Prozess beenden“', gleich(kurz(sn.lage.programmStop()), []) && pz(sn.lage) === 'aus');
  sn.s.t += 1000;
  ck('C2 PK44 … der geplante Neustart entfällt', gleich(kurz(sn.lage.tick()), []) && pz(sn.lage) === 'aus');

  const so = testLage();
  const so1 = programmBereit(so);
  so.lage.programmMeldung(so1, { type: 'lage', zustand: 'verbunden', quelle: 'Q' });
  for (const roh of [{ type: 'stopped' }, { type: 'status', state: 'stopped' }, { type: 'status', state: 'off' }]) {
    const m = leseProgrammMeldung(roh);
    if (!('verworfen' in m)) so.lage.programmMeldung(so1, m);
  }
  ck('C2 PK44 stopped und status des Utility ändern nichts (verbunden bleibt)', pz(so.lage) === 'verbunden' && so.lage.programmLage().quelle === 'Q');

  const kp = testLage(false);
  ck('C2 PK44 Start ohne Peer-Fenster → gescheitert/keinPeer ohne Prozess, Hinweis gesetzt',
    gleich(kurz(kp.lage.programmStart(HINWEIS)), []) && pz(kp.lage) === 'gescheitert/keinPeer' && kp.lage.programmLage().hinweis === HINWEIS);
  ck('C2 PK44 Programm neu starten, Peer weiter weg → bleibt gescheitert/keinPeer', gleich(kurz(kp.lage.programmNeustart()), [])
    && pz(kp.lage) === 'gescheitert/keinPeer');
  kp.s.peer = true;
  ck('C2 PK44 Programm neu starten mit Peer → sucht mit Prozess', gleich(kurz(kp.lage.programmNeustart()), ['starten programm programm G1'])
    && pz(kp.lage) === 'sucht');
  const kn = testLage();
  kn.lage.programmExit(programmBereit(kn), 1);
  kn.s.peer = false;
  kn.s.t += 1000;
  ck('C2 PK44 geplanter Neustart ohne Peer-Fenster → gescheitert/keinPeer, kein Prozess', gleich(kurz(kn.lage.tick()), [])
    && pz(kn.lage) === 'gescheitert/keinPeer');

  const lagen: [string, (t: TestLage) => void][] = [
    ['aus', () => {}],
    ['sucht', (x) => { x.lage.programmStart(HINWEIS); }],
    ['verbunden', (x) => { x.lage.programmMeldung(programmBereit(x), { type: 'lage', zustand: 'verbunden', quelle: 'Q' }); }],
    ['neustart', (x) => { x.lage.programmExit(programmBereit(x), 1); }],
  ];
  for (const [name, bringe] of lagen) {
    const x = testLage();
    bringe(x);
    const vorher = JSON.stringify(x.lage.programmLage());
    ck(`C2 PK44 Programm neu starten in ${name} → nichts`, gleich(x.lage.programmNeustart(), []) && JSON.stringify(x.lage.programmLage()) === vorher);
  }
  const gs = testLage();
  const gs1 = programmBereit(gs);
  const gs2 = programmNeustartNachAbsturz(gs, gs1);
  gs.lage.programmExit(gs2, 1);
  const hg = gs.lage.programmNeustart();
  ck('C2 PK44 Programm neu starten in gescheitert → sucht, k 0, Grund und Code leer, neuer Prozess (Generation 3)',
    gleich(gs.lage.programmLage(), { zustand: 'sucht', grund: null, code: null, k: 0, quelle: null, hinweis: HINWEIS, bereit: false })
    && gleich(kurz(hg), ['starten programm programm G3']));

  const pr = testLage();
  const pr1 = programmBereit(pr);
  const pr2 = programmNeustartNachAbsturz(pr, pr1);
  const hp = pr.lage.programmStart('Anderer Hinweis');
  ck('C2 PK44 Start bei laufendem Empfang: der alte Prozess endet, ein neuer startet, k 0, neuer Hinweis',
    gleich(kurz(hp), [`beenden programm programm G${pr2}`, `starten programm programm G${pr2 + 1}`]) && pz(pr.lage) === 'sucht'
    && pr.lage.programmLage().k === 0 && pr.lage.programmLage().hinweis === 'Anderer Hinweis');
  ck('C2 PK44 alte Generation: bereit, lage, abbruch und exit ändern nichts',
    gleich(pr.lage.programmMeldung(pr2, PB), []) && gleich(pr.lage.programmMeldung(pr2, { type: 'lage', zustand: 'verbunden', quelle: 'Q' }), [])
    && gleich(pr.lage.programmMeldung(pr2, { type: 'abbruch', grund: 'init', text: '' }), []) && gleich(pr.lage.programmExit(pr2, 1), [])
    && pz(pr.lage) === 'sucht' && !pr.lage.programmLage().bereit);
  const vb = testLage();
  vb.lage.programmStart(HINWEIS);
  ck('C2 PK44 lage vor bereit → nichts', gleich(vb.lage.programmMeldung(1, { type: 'lage', zustand: 'verbunden', quelle: 'Q' }), [])
    && pz(vb.lage) === 'sucht');
}

console.log('— C2 PK45: Bildwache programmBildLage an den Grenzen');
{
  const w = (jetzt: number, verbundenSeit: number, letztesBild: number | null, wartetSeit: number | null): string =>
    programmBildLage({ jetzt, verbundenSeit, letztesBild, wartetSeit });
  ck('C2 PK45 frisch verbunden ohne Bild, 2999 ms → verbunden', w(12_999, 10_000, null, null) === 'verbunden');
  ck('C2 PK45 frisch verbunden ohne Bild, 3000 ms → ohneBild', w(13_000, 10_000, null, null) === 'ohneBild');
  ck('C2 PK45 letztes Bild vor 2999 ms → verbunden', w(22_999, 10_000, 20_000, null) === 'verbunden');
  ck('C2 PK45 letztes Bild vor 3000 ms → ohneBild', w(23_000, 10_000, 20_000, null) === 'ohneBild');
  ck('C2 PK45 neu verbunden nach einem alten Bild: ab dem Verbinden gerechnet (2999 ms → verbunden)', w(32_999, 30_000, 20_000, null) === 'verbunden');
  ck('C2 PK45 ein Bild wartet 2999 ms, Bild in den letzten 3 s → verbunden', w(22_999, 10_000, 22_500, 20_000) === 'verbunden');
  ck('C2 PK45 ein Bild wartet 3000 ms, Bild in den letzten 3 s → staut', w(23_000, 10_000, 22_500, 20_000) === 'staut');
  ck('C2 PK45 wartet 5 s, seit 3 s kein Bild → ohneBild', w(25_000, 10_000, 22_000, 20_000) === 'ohneBild');
  ck('C2 PK45 erstes Bild nach einer Pause (wartet 0 s) → verbunden', w(40_000, 10_000, 40_000, 40_000) === 'verbunden');
  ck('C2 PK45 staut, dann Bestätigung (nichts wartet mehr) → verbunden', w(23_000, 10_000, 22_500, null) === 'verbunden');
}

console.log('— C2 PK54: Leser der Programm-Leitung');
{
  const verworfen = (r: unknown): boolean => typeof r === 'object' && r !== null && 'verworfen' in r
    && typeof (r as { verworfen: unknown }).verworfen === 'string';
  ck('C2 PK54 bereit → bereit', gleich(leseProgrammMeldung({ type: 'bereit' }), { type: 'bereit' }));
  for (const grund of ['addon', 'init'] as const) {
    ck(`C2 PK54 abbruch {${grund}} → abbruch {${grund}}`, gleich(leseProgrammMeldung({ type: 'abbruch', grund, text: 'x' }), { type: 'abbruch', grund, text: 'x' }));
  }
  ck('C2 PK54 abbruch {sender} (nur Gast) → Grund unbekannt', gleich(leseProgrammMeldung({ type: 'abbruch', grund: 'sender' }),
    { type: 'abbruch', grund: 'unbekannt', text: '' }));
  for (const zustand of ['sucht', 'keineQuelle'] as const) {
    ck(`C2 PK54 lage ${zustand} → lage ${zustand}`, gleich(leseProgrammMeldung({ type: 'lage', zustand }), { type: 'lage', zustand }));
  }
  ck('C2 PK54 lage sucht mit Quelle → ohne Quelle übernommen', gleich(leseProgrammMeldung({ type: 'lage', zustand: 'sucht', quelle: 'Q' }),
    { type: 'lage', zustand: 'sucht' }));
  for (const zustand of ['verbunden', 'ohneBild', 'staut', 'fehler'] as const) {
    ck(`C2 PK54 lage ${zustand} mit Quelle → lage ${zustand} mit Quelle`,
      gleich(leseProgrammMeldung({ type: 'lage', zustand, quelle: 'Q' }), { type: 'lage', zustand, quelle: 'Q' }));
    ck(`C2 PK54 lage ${zustand} ohne Quelle oder mit leerer Quelle → verworfen`,
      verworfen(leseProgrammMeldung({ type: 'lage', zustand })) && verworfen(leseProgrammMeldung({ type: 'lage', zustand, quelle: '' })));
  }
  for (const zustand of ['aus', 'neustart', 'gescheitert', 'stopped', 'connected', 7]) {
    ck(`C2 PK54 lage mit unbekanntem Zustand ${String(zustand)} → verworfen`, verworfen(leseProgrammMeldung({ type: 'lage', zustand, quelle: 'Q' })));
  }
  ck('C2 PK54 alte Meldungen status und stopped, dazu video → verworfen', verworfen(leseProgrammMeldung({ type: 'status', state: 'connected' }))
    && verworfen(leseProgrammMeldung({ type: 'stopped' })) && verworfen(leseProgrammMeldung({ type: 'video' })));
  ck('C2 PK54 keine Nachricht → verworfen', verworfen(leseProgrammMeldung(null)) && verworfen(leseProgrammMeldung('lage')));
}

console.log('— C2 KF11: programmLage mit abweichenden Werten');
{
  const t = testLage();
  const g1 = programmBereit(t, 'Regie-PGM');
  const g2 = programmNeustartNachAbsturz(t, g1);
  t.lage.programmMeldung(g2, PB);
  t.lage.programmMeldung(g2, { type: 'lage', zustand: 'fehler', quelle: 'REGIE (Regie-PGM)' });
  ck('C2 KF11 fehler nach einem Neustart: Zustand, k, Quelle, Hinweis, bereit',
    gleich(t.lage.programmLage(), { zustand: 'fehler', grund: null, code: null, k: 1, quelle: 'REGIE (Regie-PGM)', hinweis: 'Regie-PGM', bereit: true }));
  const g3 = programmNeustartNachAbsturz(t, g2, 7);
  t.lage.programmExit(g3, 6);
  ck('C2 KF11 gescheitert/startAbbruch: Grund, Code 6, k 2, Hinweis bleibt',
    gleich(t.lage.programmLage(), { zustand: 'gescheitert', grund: 'startAbbruch', code: 6, k: 2, quelle: null, hinweis: 'Regie-PGM', bereit: false }));
  const kopie = t.lage.programmLage();
  kopie.zustand = 'aus';
  ck('C2 KF11 programmLage liefert eine Kopie', pz(t.lage) === 'gescheitert/startAbbruch');
}

console.log('— C2 E35: Logzeilen des Programm-Empfangs ohne NDI-Namen, mit Generation und PID');
{
  const t = testLage();
  const alle: NdiHandlung[] = [];
  alle.push(...t.lage.programmStart('Regie-PGM'));
  // Die Hülle meldet die PID ab `spawn`, vor „bereit“ (C-EB4).
  t.lage.prozessPid(1, 5001);
  alle.push(...t.lage.programmMeldung(1, PB));
  alle.push(...t.lage.programmMeldung(1, { type: 'lage', zustand: 'verbunden', quelle: 'REGIE (Regie-PGM)' }), ...t.lage.programmExit(1, 1));
  t.s.t += 1000;
  const hn = t.lage.tick();
  alle.push(...hn);
  t.lage.prozessPid(1, 5998);
  t.lage.prozessPid(gen(hn), 5002);
  alle.push(...t.lage.programmMeldung(2, { type: 'abbruch', grund: 'init', text: 'NDIlib_initialize fehlgeschlagen' }));
  alle.push(...t.lage.programmNeustart(), ...t.lage.programmStop());
  const zeilen = logs(alle);
  ck('C2 E35 jeder Zustandswechsel des Programms schreibt eine Logzeile (8)', zeilen.length === 8);
  ck('C2 E35 keine Logzeile nennt Quelle oder Hinweis', zeilen.every((z) => !z.includes('Regie') && !z.includes('REGIE')));
  ck('C2 E35 jede Logzeile nennt Generation und PID', zeilen.every((z) => /^\[ndi-lage\] Programm \(Generation \d+, PID (\d+|–)\): /.test(z)));
  ck('C2 E35 PID der eigenen Generation ab prozessPid, „–“ davor und ab jedem neuen Prozess; eine andere Generation ändert sie nicht',
    gleich(zeilen.map((z) => / PID (\d+|–)\): /.exec(z)?.[1] ?? '?'), ['–', '5001', '5001', '5001', '–', '5002', '–', '–']));
  ck('C2 E35 Abbruch: Grund und Text der Meldung im Log', zeilen.some((z) => z.includes('Grund init') && z.includes('NDIlib_initialize fehlgeschlagen')));
}
// ── Testhilfen Fristen, Meldewege und Zählweise (Plan C, Task C3) ──
const { ndiZahlen, ndiStateKv } = await import('../src/main/ndi-lage');
type QuelleLageT = import('../src/main/ndi-lage').NdiQuelleLage;
type ProgrammLageT = import('../src/main/ndi-lage').NdiProgrammLage;
type QuelleZustandT = import('../src/main/ndi-lage').NdiQuelleZustand;
type ProgrammZustandT = import('../src/main/ndi-lage').NdiProgrammZustand;
/** Nur die Handlungen „Prozess beenden“. */
const beendenH = (h: NdiHandlung[]): string[] => kurz(h).filter((x) => x.startsWith('beenden'));

console.log('— C3 PK39, PK44: Frist bis bereit (10 s)');
{
  const t = testLage();
  t.lage.spinUp('g1', 'kamera', ANNA);
  t.s.t += 9999;
  ck('C3 PK39 Gast: 9999 ms ohne bereit → startet, keine Handlung', gleich(kurz(t.lage.tick()), []) && zst(t.lage) === 'startet');
  t.s.t += 1;
  ck('C3 PK39 Gast: 10 000 ms ohne bereit → „Prozess beenden“ und gescheitert/keinStart',
    gleich(kurz(t.lage.tick()), ['beenden gast g1 G1']) && zst(t.lage) === 'gescheitert/keinStart');
  ck('C3 PK39 Gast keinStart: das folgende exit ändert nichts', gleich(t.lage.gastExit('g1', 1, 1), []) && zst(t.lage) === 'gescheitert/keinStart');
  t.s.t += 60_000;
  ck('C3 PK39 Gast keinStart: kein Neustart von selbst', gleich(kurz(t.lage.tick()), []));
  const n = testLage();
  const n2 = neustartNachAbsturz(n, sendend(n));
  n.s.t += 9999;
  ck('C3 PK39 Gast, neuer Prozess in neustart: 9999 ms ohne bereit → weiter neustart', gleich(kurz(n.lage.tick()), []) && zst(n.lage) === 'neustart');
  n.s.t += 1;
  ck('C3 PK39 Gast, neuer Prozess in neustart: 10 000 ms → „Prozess beenden“ und gescheitert/keinStart',
    gleich(kurz(n.lage.tick()), [`beenden gast g1 G${n2}`]) && zst(n.lage) === 'gescheitert/keinStart');
  ck('C3 PK39 … das folgende exit ändert nichts', gleich(n.lage.gastExit('g1', n2, 1), []) && zst(n.lage) === 'gescheitert/keinStart');

  const p = testLage();
  p.lage.programmStart(HINWEIS);
  p.s.t += 9999;
  ck('C3 PK44 Programm: 9999 ms ohne bereit → sucht', gleich(kurz(p.lage.tick()), []) && pz(p.lage) === 'sucht');
  p.s.t += 1;
  ck('C3 PK44 Programm: 10 000 ms ohne bereit → „Prozess beenden“ und gescheitert/keinStart',
    gleich(kurz(p.lage.tick()), ['beenden programm programm G1']) && pz(p.lage) === 'gescheitert/keinStart');
  ck('C3 PK44 Programm keinStart: das folgende exit ändert nichts', gleich(p.lage.programmExit(1, 1), []) && pz(p.lage) === 'gescheitert/keinStart');
  const q = testLage();
  const q2 = programmNeustartNachAbsturz(q, programmBereit(q));
  q.s.t += 10_000;
  ck('C3 PK44 Programm, neuer Prozess in neustart ohne bereit nach 10 000 ms → gescheitert/keinStart',
    gleich(kurz(q.lage.tick()), [`beenden programm programm G${q2}`]) && pz(q.lage) === 'gescheitert/keinStart');
}

console.log('— C3 PK55: Lebenszeichen (5 s), Gast und Programm');
{
  const t = testLage();
  const g1 = sendend(t);
  t.lage.prozessPid(g1, 4711);
  t.s.t += 4999;
  ck('C3 PK55 Gast: 4999 ms nach bereit ohne Meldung → kein „Prozess beenden“', gleich(beendenH(t.lage.tick()), []));
  t.s.t += 1;
  const h = t.lage.tick();
  ck('C3 PK55 Gast: 5000 ms ohne Meldung → „Prozess beenden“ mit der Logzeile „keine Lebenszeichen“ samt Generation und PID',
    gleich(kurz(h), ['beenden gast g1 G1']) && logs(h).some((z) => z.startsWith('[ndi-lage] Gast g1 (Generation 1, PID 4711): keine Lebenszeichen')));
  ck('C3 PK55 Gast: der Zustand bleibt bis zum exit (ohneBild)', zst(t.lage) === 'ohneBild');
  t.s.t += 1000;
  ck('C3 PK55 Gast: kein zweites „Prozess beenden“, solange das exit aussteht', gleich(kurz(t.lage.tick()), []));
  t.lage.gastExit('g1', g1, null);
  ck('C3 PK55 Gast: das folgende exit zählt als Ausfall nach bereit → neustart, k = 1', zst(t.lage) === 'neustart' && t.lage.quelleLage('g1')?.k === 1);
  const m = testLage();
  const m1 = sendend(m);
  m.s.t += 4000;
  m.lage.gastMeldung('g1', m1, { type: 'stat', connections: 0 });
  m.s.t += 4999;
  ck('C3 PK55 Gast: ein stat (auch ohne Bild) setzt die Frist zurück, 4999 ms danach → nichts', gleich(beendenH(m.lage.tick()), []));
  m.s.t += 1;
  ck('C3 PK55 Gast: 5000 ms nach dem letzten stat → „Prozess beenden“', gleich(beendenH(m.lage.tick()), ['beenden gast g1 G1']));

  const p = testLage();
  const p1 = programmBereit(p);
  p.lage.prozessPid(p1, 5001);
  p.s.t += 4000;
  p.lage.programmMeldung(p1, { type: 'lage', zustand: 'sucht' });
  p.s.t += 4999;
  ck('C3 PK55 Programm: lage ohne Wechsel setzt die Frist zurück, 4999 ms danach → nichts', gleich(kurz(p.lage.tick()), []));
  p.s.t += 1;
  const hp = p.lage.tick();
  ck('C3 PK55 Programm: 5000 ms ohne Meldung → „Prozess beenden“ mit „keine Lebenszeichen“ samt Generation und PID, Zustand bleibt',
    gleich(kurz(hp), ['beenden programm programm G1'])
      && logs(hp).some((z) => z.startsWith('[ndi-lage] Programm (Generation 1, PID 5001): keine Lebenszeichen')) && pz(p.lage) === 'sucht');
  p.s.t += 1000;
  ck('C3 PK55 Programm: kein zweites „Prozess beenden“', gleich(kurz(p.lage.tick()), []));
  p.lage.programmExit(p1, null);
  ck('C3 PK55 Programm: das folgende exit → neustart, k = 1', pz(p.lage) === 'neustart' && p.lage.programmLage().k === 1);

  const gs = testLage();
  gs.lage.spinUp('g1', 'kamera', ANNA);
  gs.lage.gastMeldung('g1', 1, { type: 'abbruch', grund: 'addon', text: '' });
  gs.lage.programmStart(HINWEIS);
  gs.lage.programmMeldung(2, { type: 'abbruch', grund: 'init', text: '' });
  gs.s.t += 60_000;
  ck('C3 PK55 keine Frist in gescheitert (Gast und Programm): nach 60 s keine Handlung', gleich(kurz(gs.lage.tick()), [])
    && zst(gs.lage) === 'gescheitert/addon' && pz(gs.lage) === 'gescheitert/init');
  const au = testLage();
  programmBereit(au);
  au.lage.programmStop();
  au.s.t += 60_000;
  ck('C3 PK55 keine Frist in aus: nach 60 s keine Handlung', gleich(kurz(au.lage.tick()), []) && pz(au.lage) === 'aus');
  const gp = testLage();
  gp.lage.gastExit('g1', sendend(gp), 1);
  gp.lage.programmExit(programmBereit(gp), 1);
  gp.s.t += 20_000;
  ck('C3 PK55 keine Frist für einen geplanten Neustart ohne laufenden Prozess: ein später tick startet nur neu',
    gleich(kurz(gp.lage.tick()), ['starten gast g1 G3', 'starten programm programm G4']));

  const w = testLage();
  sendend(w);
  programmBereit(w);
  const echt = Date.now;
  try {
    Date.now = () => echt() + 29_100_000;
    ck('C3 PK55 Wanduhr springt 8 h 5 min vor (ND17): keine Frist löst aus', gleich(kurz(w.lage.tick()), []));
    Date.now = () => echt() - 29_100_000;
    w.s.t += 5000;
    ck('C3 PK55 Wanduhr springt zurück: nach 5000 ms auf der monotonen Uhr greift die Frist trotzdem (Gast und Programm)',
      gleich(beendenH(w.lage.tick()), ['beenden gast g1 G1', 'beenden programm programm G2']));
  } finally {
    Date.now = echt;
  }
}

console.log('— C3 PK42, PK44: Peer-Fenster weg (render-process-gone, closed)');
{
  const t = testLage();
  t.lage.spinUp('g1', 'kamera', ANNA);
  sendend(t, 'g2', 'JM Connect – B');
  t.lage.gastExit('g3', sendend(t, 'g3', 'JM Connect – C'), 1);
  t.lage.spinUp('g4', 'kamera', 'JM Connect – D');
  t.lage.gastMeldung('g4', 4, { type: 'abbruch', grund: 'addon', text: '' });
  t.lage.programmStart(HINWEIS);
  const n0 = t.s.namen;
  const h = t.lage.peerWeg();
  ck('C3 PK42 peerWeg → „Prozess beenden“ je laufendem Prozess (Gast g1, g2, Programm)',
    gleich(kurz(h), ['beenden gast g1 G1', 'beenden gast g2 G2', 'beenden programm programm G5']));
  ck('C3 PK42 peerWeg → alle Einträge gescheitert/keinPeer (auch neustart und gescheitert/addon)',
    ['g1', 'g2', 'g3', 'g4'].every((k) => zst(t.lage, k) === 'gescheitert/keinPeer'));
  ck('C3 PK44 peerWeg → Programm-Empfang gescheitert/keinPeer', pz(t.lage) === 'gescheitert/keinPeer');
  ck('C3 PK42 peerWeg → Namensliste leer, onNamen', gleich(t.lage.namensListe(), []) && t.s.namen === n0 + 1);
  t.s.t += 1000;
  ck('C3 PK42 der geplante Neustart von g3 entfällt (kein Prozessstart nach 1 s)', gleich(kurz(t.lage.tick()), []));
  const l0 = t.s.lage;
  ck('C3 PK42 ein zweites peerWeg (closed nach render-process-gone) ändert nichts, kein onLage', gleich(t.lage.peerWeg(), []) && t.s.lage === l0);
  const a = testLage();
  sendend(a);
  a.lage.peerWeg();
  ck('C3 PK44 Empfang in aus bleibt bei peerWeg aus', pz(a.lage) === 'aus' && zst(a.lage) === 'gescheitert/keinPeer');
  const e = testLage();
  sendend(e);
  e.lage.programmStart(HINWEIS);
  e.lage.tearDown('g1');
  e.lage.programmStop();
  const l1 = e.s.lage;
  ck('C3 PK42, PK44 Beenden: nach tearDown aller Einträge und programmStop ändert peerWeg nichts, kein onLage',
    gleich(e.lage.peerWeg(), []) && e.lage.quellen().length === 0 && pz(e.lage) === 'aus' && e.s.lage === l1);
}

console.log('— C3 PK53: Meldewege onLage und onNamen');
{
  const t = testLage();
  ck('C3 PK53 kein onLage während erzeugeNdiLage', t.s.lage === 0);
  await Promise.resolve();
  ck('C3 PK53 ein onLage beim Start, vor dem ersten Ereignis, ohne onNamen', t.s.lage === 1 && t.s.namen === 0);
  ck('C3 PK53 beim Start: STATE-Teil mit allen vier ndi_*-Schlüsseln', gleich(ndiStateKv(t.lage.quellen(), t.lage.programmLage()),
    { ndi_sources: 0, ndi_failed: 0, ndi_program: 'aus', ndi_alarm: 0 }));
  const zaehle = (f: () => unknown): [number, number] => {
    const l = t.s.lage, n = t.s.namen;
    f();
    return [t.s.lage - l, t.s.namen - n];
  };
  ck('C3 PK53 spinUp → onLage und onNamen', gleich(zaehle(() => t.lage.spinUp('g1', 'kamera', ANNA)), [1, 1]));
  ck('C3 PK53 startet → sendet → onLage, kein onNamen', gleich(zaehle(() => t.lage.gastMeldung('g1', 1, BEREIT)), [1, 0]));
  ck('C3 PK53 neue Empfängerzahl → onLage', gleich(zaehle(() => t.lage.gastMeldung('g1', 1, { type: 'stat', connections: 1 })), [1, 0]));
  ck('C3 PK53 gleiche Empfängerzahl → kein onLage', gleich(zaehle(() => t.lage.gastMeldung('g1', 1, { type: 'stat', connections: 1 })), [0, 0]));
  ck('C3 PK53 Videobild ohne Zustandswechsel → kein onLage', gleich(zaehle(() => t.lage.videobild('g1')), [0, 0]));
  t.s.t += 1000;
  ck('C3 PK53 tick ohne Änderung → kein onLage', gleich(zaehle(() => t.lage.tick()), [0, 0]));
  t.s.t += 3000;
  ck('C3 PK53 sendet → ohneBild → onLage, kein onNamen', gleich(zaehle(() => t.lage.tick()), [1, 0]) && zst(t.lage) === 'ohneBild');
  ck('C3 PK53 ohneBild → sendet (Videobild) → onLage', gleich(zaehle(() => t.lage.videobild('g1')), [1, 0]));
  ck('C3 PK53 sendet → neustart → onLage, kein onNamen', gleich(zaehle(() => t.lage.gastExit('g1', 1, 1)), [1, 0]));
  ck('C3 PK53 Programm-Start → onLage', gleich(zaehle(() => t.lage.programmStart(HINWEIS)), [1, 0]));
  ck('C3 PK53 Programm bereit → onLage (bereit gehört zur Lage)', gleich(zaehle(() => t.lage.programmMeldung(2, PB)), [1, 0]));
  ck('C3 PK53 Programm-Wechsel → onLage', gleich(zaehle(() => t.lage.programmMeldung(2, { type: 'lage', zustand: 'verbunden', quelle: 'Q' })), [1, 0]));
  ck('C3 PK53 Programm-lage ohne Wechsel → kein onLage',
    gleich(zaehle(() => t.lage.programmMeldung(2, { type: 'lage', zustand: 'verbunden', quelle: 'Q' })), [0, 0]));
  ck('C3 PK53 neue Programm-Quelle → onLage', gleich(zaehle(() => t.lage.programmMeldung(2, { type: 'lage', zustand: 'verbunden', quelle: 'Q2' })), [1, 0]));
  ck('C3 PK53 Programm-Stop → onLage', gleich(zaehle(() => t.lage.programmStop()), [1, 0]));
  ck('C3 PK53 tearDown → onLage und onNamen', gleich(zaehle(() => t.lage.tearDown('g1')), [1, 1]));
  ck('C3 PK53 ohne Wirkung (tearDown eines unbekannten Schlüssels) → weder onLage noch onNamen', gleich(zaehle(() => t.lage.tearDown('g9')), [0, 0]));
}

console.log('— C3 E42: Zählweise e, g, b, s, a');
{
  const Z: readonly QuelleZustandT[] = ['startet', 'sendet', 'ohneBild', 'neustart', 'gescheitert'];
  const quelle = (zustand: QuelleZustandT, n: number): QuelleLageT => ({
    schluessel: `g${n}`, art: 'kamera', label: `L${n}`, zustand, grund: zustand === 'gescheitert' ? 'absturz' : null, code: null, k: 0, empfaenger: null,
  });
  ck('C3 E42 keine Einträge → alles 0', gleich(ndiZahlen([]), { e: 0, g: 0, b: 0, s: 0, a: 0 }));
  const einzeln: [QuelleZustandT, object][] = [
    ['startet', { e: 1, g: 0, b: 0, s: 1, a: 0 }], ['sendet', { e: 1, g: 1, b: 0, s: 0, a: 0 }], ['ohneBild', { e: 1, g: 1, b: 1, s: 0, a: 0 }],
    ['neustart', { e: 1, g: 0, b: 0, s: 0, a: 1 }], ['gescheitert', { e: 1, g: 0, b: 0, s: 0, a: 1 }],
  ];
  for (const [z, erwartet] of einzeln) ck(`C3 E42 ein Eintrag in ${z} → ${JSON.stringify(erwartet)}`, gleich(ndiZahlen([quelle(z, 1)]), erwartet));
  ck('C3 E42 je ein Eintrag in jedem Zustand → e 5, g 2, b 1, s 1, a 2', gleich(ndiZahlen(Z.map((z, i) => quelle(z, i))), { e: 5, g: 2, b: 1, s: 1, a: 2 }));
  const listen: QuelleLageT[][] = [[]];
  for (let e = 1; e <= 3; e++) {
    const bau = (vorne: QuelleLageT[]): void => {
      if (vorne.length === e) { listen.push(vorne); return; }
      for (const z of Z) bau([...vorne, quelle(z, vorne.length)]);
    };
    bau([]);
  }
  ck('C3 E42 jede Aufteilung von e = 0 bis 3 (156 Listen): e = g + s + a, b ≤ g', listen.length === 156 && listen.every((l) => {
    const x = ndiZahlen(l);
    return x.e === l.length && x.e === x.g + x.s + x.a && x.b <= x.g;
  }));
  ck('C3 E42 die Reihenfolge der Einträge zählt nicht', listen.every((l) => gleich(ndiZahlen(l), ndiZahlen([...l].reverse()))));

  const WORT: Record<ProgrammZustandT, string> = {
    aus: 'aus', sucht: 'sucht', keineQuelle: 'keine_quelle', verbunden: 'verbunden', ohneBild: 'ohne_bild', staut: 'staut', fehler: 'fehler',
    neustart: 'neustart', gescheitert: 'gescheitert',
  };
  const ALARM: Record<ProgrammZustandT, 0 | 1> = {
    aus: 0, sucht: 0, keineQuelle: 0, verbunden: 0, ohneBild: 0, staut: 1, fehler: 1, neustart: 1, gescheitert: 1,
  };
  const P = (zustand: ProgrammZustandT): ProgrammLageT => ({
    zustand, grund: zustand === 'gescheitert' ? 'absturz' : null, code: null, k: zustand === 'neustart' ? 1 : 0,
    quelle: ['verbunden', 'ohneBild', 'staut', 'fehler'].includes(zustand) ? 'Q' : null, hinweis: 'JM Switcher', bereit: zustand !== 'aus',
  });
  const PZ = Object.keys(WORT) as ProgrammZustandT[];
  for (const z of PZ) {
    ck(`C3 22.6 Programm ${z}, keine Gast-Quelle → ndi_program ${WORT[z]}, ndi_alarm ${ALARM[z]}`,
      gleich(ndiStateKv([], P(z)), { ndi_sources: 0, ndi_failed: 0, ndi_program: WORT[z], ndi_alarm: ALARM[z] }));
  }
  ck('C3 22.6 ndi_sources = g, ndi_failed = a; ein Ausfall gibt ndi_alarm 1 auch bei verbundenem Programm',
    gleich(ndiStateKv([quelle('sendet', 1), quelle('ohneBild', 2), quelle('startet', 3), quelle('neustart', 4)], P('verbunden')),
      { ndi_sources: 2, ndi_failed: 1, ndi_program: 'verbunden', ndi_alarm: 1 }));
  ck('C3 22.6 bestehende und startende Quellen, Programm sucht → ndi_alarm 0',
    gleich(ndiStateKv([quelle('sendet', 1), quelle('startet', 2)], P('sucht')), { ndi_sources: 1, ndi_failed: 0, ndi_program: 'sucht', ndi_alarm: 0 }));
  let vier = true, praedikat = true, alarm = true;
  for (const l of listen) {
    for (const z of PZ) {
      const kv = ndiStateKv(l, P(z));
      if (Object.keys(kv).join(',') !== 'ndi_sources,ndi_failed,ndi_program,ndi_alarm') vier = false;
      if (kv.ndi_sources + kv.ndi_failed > l.length) praedikat = false;
      if ((kv.ndi_alarm === 1) !== (kv.ndi_failed > 0 || ALARM[z] === 1)) alarm = false;
    }
  }
  ck('C3 22.6 vier Schlüssel in jeder Lage (156 Listen × 9 Programm-Zustände)', vier);
  ck('C3 22.10 Prädikat ndi_sources + ndi_failed ≤ e (alle Lagen)', praedikat);
  ck('C3 22.6 ndi_alarm = 1 ⇔ a > 0 oder Programm in fehler, staut, neustart, gescheitert (alle Lagen)', alarm);
}

console.log('— C3 PK55, OE4 a: Quelltext von ndi-lage.ts');
{
  const { readFileSync } = await import('node:fs');
  const quelltext = readFileSync(new URL('../src/main/ndi-lage.ts', import.meta.url), 'utf8');
  const code = quelltext.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  ck('C3 PK55 ndi-lage.ts liest keine Wanduhr (kein Date.now(), kein new Date)', !code.includes('Date.now(') && !code.includes('new Date'));
  ck('C3 PK55 ndi-lage.ts importiert nichts (rein, G-C2)', !/^\s*import\s/m.test(code) && !code.includes('require('));
  const kopf: string[] = [];
  for (const z of quelltext.split(/\r?\n/)) {
    if (!z.startsWith('//')) break;
    kopf.push(z);
  }
  const kopfText = kopf.join('\n');
  for (const frist of ['10 s bis „bereit“', '5 s Lebenszeichen', '1 s bis zum Neustart', '60 s ununterbrochen', '3 s ohne Videobild',
    '3 s Bildwache', '3 s Pausen des Programm-Empfangs', '3 s bis T140']) {
    ck(`C3 OE4 a Kopfkommentar nennt die Frist „${frist}“`, kopfText.includes(frist));
  }
}
console.log('— C7: Gast-Quellen angebunden (Quelltext: Utility, Hülle, Peer-Fenster, index.ts; PK46, PK47, PK55, PK33)');
{
  const { readFileSync } = await import('node:fs');
  const lies = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const sender = lies('../src/utility/ndi-guest-sender.ts');
  const huelle = lies('../src/main/ndi-guests.ts');
  const peerFenster = lies('../src/main/peer-window.ts');
  const index = lies('../src/main/index.ts');
  /** Text ab `start` bis vor das nächste `ende` (leer, wenn `start` fehlt). */
  const abschnitt = (s: string, start: string, ende: string): string => {
    const i = s.indexOf(start);
    if (i < 0) return '';
    const j = s.indexOf(ende, i + start.length);
    return j < 0 ? s.slice(i) : s.slice(i, j);
  };
  const zaehle = (s: string, t: string): number => s.split(t).length - 1;

  // PK46 (Gast): @jm/ndi erst im Auftrag, in try/catch, mit abbruch und Grund; kein process.exit (E51).
  ck('C7 PK46 Gast: kein Import von @jm/ndi auf oberster Ebene außer import type',
    !/^import (?!type\b)[^\n]*'@jm\/ndi'/m.test(sender) && /^import type \* as NdiModul from '@jm\/ndi';$/m.test(sender));
  ck('C7 PK46 Gast: das Laden steht in try/catch und meldet abbruch mit Grund addon',
    /try \{\n\s*modul = require\('@jm\/ndi'\) as typeof NdiModul;\n\s*\} catch \(err\) \{\n\s*melde\(\{ type: 'abbruch', grund: 'addon', text: fehlerText\(err\) \}\);/.test(sender));
  ck('C7 PK46 Gast: init() und createSender() melden ihr Scheitern mit Grund init bzw. sender',
    /modul\.init\(\);\n\s*\} catch \(err\) \{\n\s*melde\(\{ type: 'abbruch', grund: 'init'/.test(sender)
      && /modul\.createSender\(name\);\n\s*\} catch \(err\) \{\n\s*melde\(\{ type: 'abbruch', grund: 'sender'/.test(sender));
  ck('C7 22.3 Gast: bereit erst nach init() und createSender()',
    sender.indexOf('modul.createSender(name);') > sender.indexOf('modul.init();') && sender.indexOf("melde({ type: 'bereit' });") > sender.indexOf('modul.createSender(name);'));
  ck('C7 PK46/E51 Gast: kein Aufruf process.exit im Utility (der Main beendet es)', !/process\.exit\(/.test(sender));
  ck('C7 E50 Gast: ab bereit jede Sekunde ein stat (Lebenszeichen), nicht mehr nach je 30 Bildern',
    /statTakt = setInterval\(\(\) => \{\n\s*if \(started && ndi\) melde\(\{ type: 'stat', connections: ndi\.connections\(\) \}\);\n\s*\}, 1000\);/.test(sender) && !sender.includes('% 30'));

  // PK55 (Gast): nur die monotone Uhr.
  ck('C7 PK55 Gast: kein Date.now() in ndi-guest-sender.ts und ndi-guests.ts', !sender.includes('Date.now()') && !huelle.includes('Date.now()'));
  ck('C7 PK55 Gast: der Wachhund rechnet mit performance.now()',
    sender.includes('const jetzt = (): number => performance.now();') && sender.includes('lastFrameAt = jetzt();') && sender.includes('if (jetzt() - lastFrameAt > 3000) {'));

  // PK47: Hülle.
  {
    const i = huelle.indexOf('if (!eintrag) {');
    const j = huelle.indexOf('new MessageChannelMain()');
    ck('C7 PK47: je Eintrag genau ein MessageChannelMain, angelegt nur, solange der Eintrag noch keinen hat',
      zaehle(huelle, 'new MessageChannelMain()') === 1 && i >= 0 && j > i && !huelle.slice(i, j).includes('\n  }'));
  }
  const portWeg = abschnitt(huelle, "port2.on('message', (ev) => {", '\n    });');
  ck('C7 PK47: port2 leitet an den Prozess, der bei jeder Nachricht aktuell ist (nicht an einen festgehaltenen)',
    portWeg.includes('const p = neu.aktuell;') && portWeg.includes('p.child.postMessage(ev.data);'));
  ck('C7 PK47: ein Zuhörer auf exit je Prozess, das Ende geht an die Lage (gastExit)',
    zaehle(huelle, "child.on('exit'") === 1 && /child\.on\('exit', \(code\) => \{[\s\S]*?ausfuehren\(lage\?\.gastExit\(schluessel, generation, code\) \?\? \[\]\);/.test(huelle));
  ck('C7 E51: jede Nachricht des Prozesses geht durch leseGastMeldung, Verworfenes nur ins Log',
    /child\.on\('message', \(roh: unknown\) => \{\n\s*const m = leseGastMeldung\(roh\);\n\s*if \('verworfen' in m\) \{/.test(huelle));
  ck('C7 22.3 Nr. 6: jedes weitergeleitete Videobild meldet videobild an die Lage',
    portWeg.includes("=== 'video') ausfuehren(lage?.videobild(schluessel) ?? []);"));
  ck('C7 22.3 Nr. 1: spinUp geht an die Lage (Art aus dem Pool-Schlüssel), nicht mehr direkt an fork',
    /export function spinUp\(key: string, label: string\): void \{\n\s*if \(!lage\) return;\n\s*const art: NdiArt = key\.includes\('::'\) \? 'bildschirm' : 'kamera';\n\s*ausfuehren\(lage\.spinUp\(key, art, label\)\);/.test(huelle));
  ck('C7 E42: activeLabels ist die Namensliste der Lage (alle Einträge außer gescheitert)',
    /export function activeLabels\(\): string\[\] \{\n\s*return lage \? lage\.namensListe\(\) : \[\];/.test(huelle));
  // C-EB12 (Verhalten aus 0.3.0, Nachbesserung C-robust:6): Der Abbau der Kamera nimmt die Bildschirm-Quelle des Gasts mit.
  ck('C7 C-EB12: tearDown baut zur Kamera die Bildschirm-Quelle mit ab (nur für Schlüssel ohne ::), vor lage.tearDown(key)',
    /export function tearDown\(key: string\): void \{\n\s*if \(!key\.includes\('::'\)\) tearDown\(ndiPoolKey\(key, 'screen'\)\);\n\s*if \(lage\) ausfuehren\(lage\.tearDown\(key\)\);/.test(huelle));
  const spawnTeil = abschnitt(huelle, "child.on('spawn', () => {", '\n  });');
  ck('C7 E35: Logzeilen der Hülle nennen Schlüssel, Generation und PID, nie das label; Startzeile und PID ab spawn, die PID an die Lage',
    spawnTeil.includes('(Generation ${generation}, PID ${child.pid ?? \'?\'}): Prozess gestartet')
      && spawnTeil.includes('if (child.pid !== undefined) lage?.prozessPid(generation, child.pid);')
      && !/getLog\(\)[^\n]*\blabel\b/.test(huelle) && !/getLog\(\)[^\n]*q\.label/.test(huelle));
  ck('C7 PK33: kein case- oder ev-Zweig für video oder audio in Utility und Hülle',
    ![sender, huelle].some((s) => /case 'video'|case 'audio'|ev === 'video'|ev === 'audio'/.test(s)));

  // E50: Peer-Fenster.
  ck('C7 E50: peer-window.ts meldet render-process-gone an onWeg', peerFenster.includes("peer.webContents.on('render-process-gone', () => onWeg());"));
  ck('C7 E50: peer-window.ts meldet closed an onWeg', /peer\.on\('closed', \(\) => \{\n\s*peer = null;\n\s*onWeg\(\);\n\s*\}\);/.test(peerFenster));

  // E52, PK47: eine Lage in index.ts.
  const aufruf = abschnitt(index, 'const ndiLage = erzeugeNdiLage({', '\n    });');
  ck('C7 E50: die Lage bekommt die monotone Uhr der Hülle (performance.now())', aufruf.includes('jetzt: () => performance.now(),'));
  ck('C7 PK47: onLage ruft notifyStatusChanged()', abschnitt(aufruf, 'onLage:', 'onNamen:').includes('notifyStatusChanged();'));
  ck('C7 PK47: onNamen ruft zoomGastLabelsGeaendert()', aufruf.includes('onNamen: () => zoomGastLabelsGeaendert(),'));
  ck('C7 E50: peerDa fragt das Peer-Fenster (da und nicht abgestürzt)', aufruf.includes('return p !== null && !p.webContents.isCrashed();'));
  ck('C7 E50: das Peer-Fenster meldet sein Ende an die Lage (peerWeg)', index.includes('createPeerWindow(preloadPath, () => ndiAusfuehren(ndiLage.peerWeg()));'));
  ck('C7 C-EP1: die Gast-Hülle bekommt die eine Lage und den Ausführer, ohne onChange',
    index.includes('initNdiGuests({ getPeer: () => getPeerWindow(), lage: ndiLage, ausfuehren: ndiAusfuehren });') && !/initNdiGuests\(\{[^}]*onChange/.test(index));
  ck('C7 22.3 Nr. 7: Zeitgeber der Lage jede Sekunde', index.includes('setInterval(() => ndiAusfuehren(ndiLage.tick()), 1000);'));
  ck('C7 C-EB1: neustartPlanen weckt die Lage nach inMs (tick)',
    index.includes("else if (x.art === 'neustartPlanen') setTimeout(() => ndiAusfuehren(ndiLage.tick()), x.inMs + 5);"));
  ck('C7 C-EP1: Handlungen für Gast-Quellen gehen an gastHandlung, Logzeilen ins Log',
    index.includes("if (x.art === 'log') getLog().info(x.zeile);") && index.includes("else if (x.teil === 'gast') gastHandlung(x);"));
}
console.log('— C8: Programm-Empfang angebunden (Quelltext: Utility, Hülle, index.ts; PK46, PK55, 22.4, C-EP2, C-EP9)');
{
  const { readFileSync } = await import('node:fs');
  const lies = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const empf = lies('../src/utility/ndi-program-receiver.ts');
  const huelle = lies('../src/main/ndi-program.ts');
  const index = lies('../src/main/index.ts');
  /** Text ab `start` bis vor das nächste `ende` (leer, wenn `start` fehlt). */
  const abschnitt = (s: string, start: string, ende: string): string => {
    const i = s.indexOf(start);
    if (i < 0) return '';
    const j = s.indexOf(ende, i + start.length);
    return j < 0 ? s.slice(i) : s.slice(i, j);
  };
  const zaehle = (s: string, t: string): number => s.split(t).length - 1;
  const start = abschnitt(empf, 'function handleStart(', '\n}\n');
  const lageFn = abschnitt(empf, 'function meldeLage(', '\n}\n');

  // PK46 (Programm): @jm/ndi erst im Auftrag; „bereit“ nach ndi.init() und vor der ersten Suche (22.4, NF8).
  ck('C8 PK46 Programm: kein Import von @jm/ndi auf oberster Ebene außer import type',
    !/^import (?!type\b)[^\n]*'@jm\/ndi'/m.test(empf) && /^import type \* as NdiModul from '@jm\/ndi';$/m.test(empf));
  ck('C8 PK46 Programm: das Laden steht in try/catch und meldet abbruch mit Grund addon',
    /try \{\n\s*modul = require\('@jm\/ndi'\) as typeof NdiModul;\n\s*\} catch \(err\) \{\n\s*melde\(\{ type: 'abbruch', grund: 'addon', text: fehlerText\(err\) \}\);/.test(start));
  ck('C8 22.4 Programm: ein Scheitern von ndi.init() ist abbruch {init}, kein Zustand',
    /modul\.init\(\);\n\s*\} catch \(err\) \{\n[^\n]*\n\s*melde\(\{ type: 'abbruch', grund: 'init', text: fehlerText\(err\) \}\);/.test(start));
  {
    const i = empf.indexOf('modul.init();');
    const b = empf.indexOf("melde({ type: 'bereit' });");
    const f = empf.indexOf('.findSources(');
    ck('C8 PK46 Programm: bereit steht nach ndi.init() und vor dem ersten findSources', i >= 0 && b > i && f > b);
  }
  ck('C8 PK46/E51 Programm: kein Aufruf process.exit', !/process\.exit\(/.test(empf));
  ck('C8 22.4: kein stopped mehr, auch nicht beim Start (handleStart ruft handleStop nicht)',
    !empf.includes("'stopped'") && start !== '' && !start.includes('handleStop('));
  ck('C8 E50, C-EP2: lage alle 500 ms, im verbundenen Zustand über programmBildLage',
    /^import \{ programmBildLage \} from '\.\.\/main\/ndi-lage';$/m.test(empf) && start.includes('lageTakt = setInterval(meldeLage, 500);')
      && lageFn.includes('if (connected) zustand = programmBildLage({ jetzt: jetzt(), verbundenSeit, letztesBild, wartetSeit });'));
  ck('C8 22.4 Leitung: quelle nur in verbunden, ohneBild, staut und fehler',
    lageFn.includes("const mitQuelle = zustand === 'verbunden' || zustand === 'ohneBild' || zustand === 'staut' || zustand === 'fehler';"));
  ck('C8 C-EP9: eine Ausnahme von createReceiver ergibt fehler mit Quelle und den nächsten Versuch nach 3 s',
    /\} catch \(err\) \{\n[^\n]*\n[^\n]*createReceiver fehlgeschlagen[^\n]*\n\s*zustand = 'fehler';\n\s*quelle = source;\n\s*searchTimer = setTimeout\(\(\) => searchLoop\(nameHint\), 3000\);/.test(empf));
  ck('C8 22.4: createReceiver = false ergibt ebenso fehler mit Quelle', /if \(!ok\) \{\n\s*zustand = 'fehler';\n\s*quelle = source;/.test(empf));
  ck('C8 22.4 Bildwache: jedes NDI-Videobild zählt, auch ein verworfenes (letztesBild vor der Rückstau-Prüfung)',
    empf.indexOf('letztesBild = jetzt();') > 0 && empf.indexOf('letztesBild = jetzt();') < empf.indexOf('if (wartetSeit !== null) {'));
  ck('C8 22.4: das Ack des Peers beendet das Warten', empf.includes("else if (d.type === 'ack') wartetSeit = null;"));
  ck('C8 OE4 a: die Pausen des Empfangs bleiben 3 s (nach false, nach einer Ausnahme, nach keineQuelle)',
    zaehle(empf, 'setTimeout(() => searchLoop(nameHint), 3000);') === 3);

  // PK55 (Programm): nur die monotone Uhr.
  ck('C8 PK55 Programm: kein Date.now() in ndi-program.ts und ndi-program-receiver.ts', !empf.includes('Date.now()') && !huelle.includes('Date.now()'));
  ck('C8 PK55 Programm: Bildwache und Abstand der Suchmeldung im Log nehmen performance.now()',
    empf.includes('const jetzt = (): number => performance.now();') && empf.includes('const now = jetzt();'));

  // Hülle (22.4): Neustart tauscht nur den Prozess.
  const startProgram = abschnitt(huelle, 'export function startProgram(', '\n}\n');
  const neustart = abschnitt(huelle, 'export function programmNeustart(', '\n}\n');
  ck('C8 22.4: startProgram ruft stopProgram nicht (kein Zwischenstand aus; den alten Prozess beendet die Lage, C-EB10)',
    startProgram.includes('ausfuehren(lage.programmStart(nameHint));') && !startProgram.includes('stopProgram('));
  ck('C8 22.4, PK44: „Programm neu starten“ läuft nicht über stopProgram oder startProgram',
    neustart.includes('ausfuehren(lage.programmNeustart());') && !neustart.includes('stopProgram(') && !neustart.includes('startProgram('));
  ck('C8 22.4: der Kanal zum Peer entsteht nur in startProgram, Bestätigungen gehen an den aktuellen Prozess',
    zaehle(huelle, 'new MessageChannelMain()') === 1 && startProgram.includes('new MessageChannelMain()')
      && huelle.includes("port2.on('message', (ev) => aktuell?.child.postMessage(ev.data));"));
  ck('C8 22.4: Bilder und Ton nur vom aktuellen Prozess an den Peer, nicht durch den Leser',
    huelle.includes("if (art === 'video' || art === 'audio') {") && huelle.includes('if (aktuell === prozess) port2?.postMessage(roh);'));
  ck('C8 E51: jede andere Nachricht geht durch leseProgrammMeldung', huelle.includes('const m = leseProgrammMeldung(roh);'));
  const spawnTeil = abschnitt(huelle, "child.on('spawn', () => {", '\n  });');
  ck('C8 22.4, E35: ein Zuhörer auf exit (das Ende geht an die Lage, programmExit); Startzeile und PID ab spawn, die PID an die Lage',
    zaehle(huelle, "child.on('exit'") === 1 && huelle.includes('ausfuehren(lage?.programmExit(generation, code) ?? []);')
      && spawnTeil.includes('(Generation ${generation}, PID ${child.pid ?? \'?\'}): Prozess gestartet')
      && spawnTeil.includes('if (child.pid !== undefined) lage?.prozessPid(generation, child.pid);'));
  ck('C8 E35: Logzeilen der Hülle ohne Quelle und Suchname', !/getLog\(\)[^\n]*(hinweis|quelle|nameHint)/.test(huelle));
  // GG21, E35, Spec 0.23 (Nachbesserung C-sicherheit:1, C-code:3; OFC3): Die Hülle leitet stdout und stderr des Utility ins
  // Log von Connect. Seit 0.4.0 tragen frei benannte Zoom-Slots keinen Vorsatz „JM Connect – “ mehr; die Diagnose nennt darum
  // keinen NDI-Namen und keinen Suchnamen, nur Anzahlen (Quelle und Suchname zeigt das Programm-Abzeichen, T122–T126).
  // Feste Liste statt Suchliste (Nachfix 1): Jede console-Zeile ist ein einzeiliger Aufruf; als Argumente gelten nur
  // Zeichenketten ('…' oder `…`) und `err`, in `…` nur ${…} aus `erlaubt`. Die erlaubten Namen halten Zahlen, ihre
  // Deklarationen stehen fest (NdiFrame trägt nur Zahlen und die Bilddaten, packages/ndi/index.d.ts).
  // Härtung (Nachfix 2, Nachbesserung N15, N16): Jedes Wort „console“ im Utility steht in einem direkten Aufruf console.‹m›(,
  // jedes Wort „process“ in process.parentPort.; die erlaubten Namen und err sind zusammen genau siebenmal mit const, let oder var
  // gebunden (die sieben Deklarationen unten; err nur als catch-Parameter). Gemessen rot (C8 Proben 15–22): ein Name über eine
  // Hilfsvariable, als weiteres Argument von console.info, in einer geänderten Deklaration, in einer Schleifenvariable mit
  // erlaubtem Namen, in einem neu gebundenen err, über process.stdout.write, über Aliase von console.log und von process.
  // Grenze (gemessen grün, Step 8): ein Name nicht unmittelbar hinter const, let oder var an einen erlaubten Namen gebunden
  // (mehrzeiliger Rückruf, Zerlegung) oder im Text eines Error (über stderr oder err); process als globalThis['\u0070rocess'].
  {
    const logZeilen = empf.split('\n').filter((z) => /\bconsole\.\w+\(/.test(z));
    const erlaubt = /^(?:anzahl|eigene|emptyPolls|audioRx|videoRx|videoDropped|frame\.\w+(?: \* \d+)?)$/;
    const nurZahlen = (z: string): boolean => {
      const m = /\bconsole\.\w+\((.*)\);$/.exec(z.trim());
      if (!m) return false;
      const arg = /\s*(?:'(?:[^'\\]|\\.)*'|`((?:[^`\\]|\\.)*)`|err)\s*(?:,|$)/y;
      for (let i = 0; i < m[1].length; i = arg.lastIndex) {
        arg.lastIndex = i;
        const a = arg.exec(m[1]);
        if (!a) return false;
        if (a[1] !== undefined && [...a[1].matchAll(/\$\{([^}]*)\}/g)].some((x) => !erlaubt.test(x[1]))) return false;
      }
      return true;
    };
    const deklariert = (d: string): boolean => zaehle(empf, d.slice(0, d.indexOf(' =') + 2)) === 1 && empf.includes(d);
    ck('C8 GG21, E35: die Logzeilen des Programm-Utility nennen keinen NDI-Namen und keinen Suchnamen, nur Anzahlen (OFC3)',
      logZeilen.length > 0 && logZeilen.every(nurZahlen)
        && ['const anzahl = seen.size;', 'const eigene = anzahl - fremde.length;', 'const frame = safeReceive(60);',
          'let emptyPolls = 0;', 'let audioRx = 0;', 'let videoRx = 0;', 'let videoDropped = 0;'].every(deklariert)
        && (empf.match(/\bconsole\b/g) ?? []).length === (empf.match(/\bconsole\.\w+\(/g) ?? []).length
        && (empf.match(/\bprocess\b/g) ?? []).length === (empf.match(/\bprocess\.parentPort\./g) ?? []).length
        && (empf.match(/\b(?:const|let|var)\s+(?:anzahl|eigene|frame|emptyPolls|audioRx|videoRx|videoDropped|err)\b/g) ?? []).length === 7
        && empf.includes('Programm-Quelle nicht gefunden, ${anzahl} NDI-Quellen gesehen, ${eigene} davon mit „JM Connect – “ im Namen (Namen nicht im Log).'));
  }
  ck('C8 PK33: kein case- oder ev-Zweig für video oder audio im Programm-Empfang',
    ![empf, huelle].some((s) => /case 'video'|case 'audio'|ev === 'video'|ev === 'audio'/.test(s)));

  // index.ts: dieselbe Lage, derselbe Ausführer.
  ck('C8 C-EP1: die Programm-Hülle bekommt dieselbe Lage und denselben Ausführer',
    index.includes('initNdiProgram({ getPeer: () => getPeerWindow(), lage: ndiLage, ausfuehren: ndiAusfuehren });'));
  ck('C8 C-EP1: Handlungen für den Programm-Empfang gehen an programmHandlung', index.includes('else programmHandlung(x);') && !index.includes('bis Task C8'));
  {
    const quit = abschnitt(index, "app.on('before-quit'", '\n  });');
    ck('C8 PK44: beim Beenden stopProgram() vor destroyPeerWindow() (ein Empfang in aus bleibt aus)',
      quit.indexOf('stopProgram();') >= 0 && quit.indexOf('destroyPeerWindow();') > quit.indexOf('stopProgram();'));
  }
}
console.log('— Nachtrag C (I-C7-1, R18, R20): Takt-Lücke nach Hänger oder Ruhezustand des Main, Gast und Programm (E50)');
{
  /** Wie testLage, aber mit sekundenTakt wie index.ts: Die Hülle ruft tick() jede Sekunde, eine längere Lücke ist ein Hänger. */
  function taktLage(peer = true): TestLage {
    const s = { t: 1000, peer, lage: 0, namen: 0 };
    const lage = erzeugeNdiLage({ jetzt: () => s.t, peerDa: () => s.peer, sekundenTakt: true, onLage: () => { s.lage++; }, onNamen: () => { s.namen++; } });
    return { lage, s };
  }
  const STAT: GastMeldung = { type: 'stat', connections: 1 };
  const VERBUNDEN: ProgrammMeldungT = { type: 'lage', zustand: 'verbunden', quelle: 'Regie (JM Switcher)' };
  /** `n` ticks im Sekundentakt; alle Handlungen zusammen. */
  const sekunden = (t: TestLage, n: number): NdiHandlung[] => {
    const h: NdiHandlung[] = [];
    for (let i = 0; i < n; i++) {
      t.s.t += 1000;
      h.push(...t.lage.tick());
    }
    return h;
  };

  // (1) Gast sendet: Meldung, Bild und tick je Sekunde, dann steht der Main 6 s.
  const a = taktLage();
  const ga = sendend(a);
  for (let i = 0; i < 3; i++) {
    a.s.t += 1000;
    a.lage.gastMeldung('g1', ga, STAT);
    a.lage.videobild('g1');
    a.lage.tick();
  }
  a.s.t += 6000;
  const ha = a.lage.tick();
  ck('Nachtrag C (1) Gast sendet, die Uhr springt um 6000 ms, ein tick → kein „Prozess beenden“, bleibt sendet, keine Logzeile',
    gleich(kurz(ha), []) && zst(a.lage) === 'sendet' && logs(ha).length === 0);
  a.lage.gastMeldung('g1', ga, STAT);
  ck('Nachtrag C (1) … danach stat (die gepufferte Meldung kommt an, noch kein neues Bild) → bleibt sendet',
    zst(a.lage) === 'sendet' && a.lage.quelleLage('g1')?.empfaenger === 1);
  const ha4 = sekunden(a, 4);
  ck('Nachtrag C (1) … weitere ticks rechnen normal: 4 s ohne Meldung kein „Prozess beenden“, nach 3 s ohne Bild ohneBild',
    gleich(beendenH(ha4), []) && zst(a.lage) === 'ohneBild');
  ck('Nachtrag C (1) … 5 s ohne Meldung nach der Lücke → „Prozess beenden“ (E50 gilt wieder)', gleich(beendenH(sekunden(a, 1)), ['beenden gast g1 G1']));

  // (1, Reihenfolge harmlos) Die gepufferte Meldung kommt VOR dem verspäteten tick: Die Frist läuft ab ihr, nicht später.
  const b = taktLage();
  const gb = sendend(b);
  b.s.t += 1000;
  b.lage.gastMeldung('g1', gb, STAT);
  b.lage.tick();
  b.s.t += 6000;
  b.lage.gastMeldung('g1', gb, STAT);
  b.lage.tick();
  ck('Nachtrag C (1) Meldung vor dem verspäteten tick zugestellt: 4 s danach nichts, 5 s danach „Prozess beenden“ (kein Anker hinter jetzt)',
    gleich(beendenH(sekunden(b, 4)), []) && gleich(beendenH(sekunden(b, 1)), ['beenden gast g1 G1']));

  // (2) Programm verbunden: lage und tick je Sekunde, dann steht der Main 6 s.
  const p = taktLage();
  const gp = programmBereit(p);
  for (let i = 0; i < 3; i++) {
    p.s.t += 1000;
    p.lage.programmMeldung(gp, VERBUNDEN);
    p.lage.tick();
  }
  p.s.t += 6000;
  const hp = p.lage.tick();
  p.lage.programmMeldung(gp, VERBUNDEN);
  ck('Nachtrag C (2) Programm verbunden, die Uhr springt um 6000 ms, ein tick → kein „Prozess beenden“, keine Logzeile; danach lage → bleibt verbunden',
    gleich(kurz(hp), []) && logs(hp).length === 0 && pz(p.lage) === 'verbunden' && p.lage.programmLage().quelle === 'Regie (JM Switcher)');
  ck('Nachtrag C (2) … weitere ticks rechnen normal: 4 s ohne Meldung nichts, 5 s ohne Meldung „Prozess beenden“ (E50 gilt wieder)',
    gleich(beendenH(sekunden(p, 4)), []) && gleich(beendenH(sekunden(p, 1)), ['beenden programm programm G1']));

  // (3) Gast in startet und Programm in sucht (vor bereit), dann steht der Main 11 s.
  const c = taktLage();
  c.lage.spinUp('g1', 'kamera', ANNA);
  c.lage.programmStart(HINWEIS);
  sekunden(c, 1);
  c.s.t += 11_000;
  const hc = c.lage.tick();
  ck('Nachtrag C (3) Gast startet und Programm sucht, die Uhr springt um 11 000 ms → nicht gescheitert/keinStart, kein „Prozess beenden“',
    gleich(kurz(hc), []) && zst(c.lage) === 'startet' && pz(c.lage) === 'sucht');
  c.lage.gastMeldung('g1', 1, BEREIT);
  c.lage.programmMeldung(2, PB);
  ck('Nachtrag C (3) … danach bereit (gepuffert) → sendet bzw. sucht nach bereit', zst(c.lage) === 'sendet' && pz(c.lage) === 'sucht' && c.lage.programmLage().bereit);
  // Von der Lücke zählt ein Nenntakt (1 s, R28), die beobachtete Zeit davor ganz (Verschieben statt Zurücksetzen):
  // 1 s vor der Lücke + 1 s der Lücke + 8 s danach = 10 s.
  const d = taktLage();
  d.lage.spinUp('g1', 'kamera', ANNA);
  d.lage.programmStart(HINWEIS);
  sekunden(d, 1);
  d.s.t += 11_000;
  d.lage.tick();
  ck('Nachtrag C (3) … ohne bereit: 1 s vor, 1 s der Lücke und 7 s danach → noch startet bzw. sucht', gleich(kurz(sekunden(d, 7)), []) && zst(d.lage) === 'startet' && pz(d.lage) === 'sucht');
  ck('Nachtrag C (3) … nach 10 s beobachteter Startzeit (1 s vor, 1 s der Lücke, 8 s danach) → gescheitert/keinStart, Gast und Programm',
    gleich(beendenH(sekunden(d, 1)), ['beenden gast g1 G1', 'beenden programm programm G2'])
      && zst(d.lage) === 'gescheitert/keinStart' && pz(d.lage) === 'gescheitert/keinStart');

  // (4) Gegenfall ohne Sprung: E50 bleibt, wie es war.
  const e = taktLage();
  sendend(e);
  programmBereit(e);
  const e4 = sekunden(e, 4);
  const he = sekunden(e, 1);
  ck('Nachtrag C (4) ohne Sprung, Meldungspause in 1-s-Schritten: nach 4 s nichts, nach 5 s „Prozess beenden“ mit „keine Lebenszeichen“, Gast und Programm (E50 bleibt gültig)',
    gleich(beendenH(e4), []) && gleich(beendenH(he), ['beenden gast g1 G1', 'beenden programm programm G2'])
      && logs(he).filter((z) => z.includes('keine Lebenszeichen')).length === 2);
  const f = taktLage();
  f.lage.spinUp('g1', 'kamera', ANNA);
  f.lage.programmStart(HINWEIS);
  const f9 = sekunden(f, 9);
  const f9Lage = `${zst(f.lage)} ${pz(f.lage)}`;
  ck('Nachtrag C (4) ohne Sprung, ohne bereit in 1-s-Schritten: nach 9 s noch startet bzw. sucht, nach 10 s gescheitert/keinStart, Gast und Programm (E50 bleibt gültig)',
    gleich(kurz(f9), []) && f9Lage === 'startet sucht' && gleich(beendenH(sekunden(f, 1)), ['beenden gast g1 G1', 'beenden programm programm G2'])
      && zst(f.lage) === 'gescheitert/keinStart' && pz(f.lage) === 'gescheitert/keinStart');
  // Grenze der Lücke: 2500 ms zwischen zwei tick() sind noch Takt, 2501 ms eine Lücke.
  const g = taktLage();
  sendend(g);
  g.s.t += 2500;
  g.lage.tick();
  g.s.t += 2500;
  ck('Nachtrag C (4) tick alle 2500 ms ist keine Lücke: 5000 ms ohne Meldung → „Prozess beenden“', gleich(beendenH(g.lage.tick()), ['beenden gast g1 G1']));
  // Mit einem Videobild beim ersten tick (R28: von 2501 ms zählt 1 s, das Bildalter liegt danach bei 1 s, nicht bei 3,5 s).
  const i = taktLage();
  sendend(i);
  i.s.t += 2501;
  i.lage.videobild('g1');
  i.lage.tick();
  i.s.t += 2501;
  ck('Nachtrag C (4) … 2501 ms zwischen zwei tick() sind eine Lücke: kein „Prozess beenden“, bleibt sendet', gleich(beendenH(i.lage.tick()), []) && zst(i.lage) === 'sendet');
  // Der erste tick nach dem Anlegen der Lage zählt nicht als Lücke.
  const j = taktLage();
  j.lage.spinUp('g1', 'kamera', ANNA);
  j.s.t += 10_000;
  ck('Nachtrag C (4) der erste tick nach dem Anlegen zählt nicht als Lücke: 10 s ohne bereit → gescheitert/keinStart',
    gleich(beendenH(j.lage.tick()), ['beenden gast g1 G1']) && zst(j.lage) === 'gescheitert/keinStart');
  // Ohne sekundenTakt (die übrigen Fälle mit springender Testuhr) rechnet jeder tick() die Fristen.
  const k = testLage();
  sendend(k);
  k.s.t += 1000;
  k.lage.tick();
  k.s.t += 6000;
  ck('Nachtrag C (4) ohne sekundenTakt ist ein Sprung keine Lücke: 7 s ohne Meldung → „Prozess beenden“', gleich(beendenH(k.lage.tick()), ['beenden gast g1 G1']));

  // (5) Ein geplanter Neustart geht über eine Lücke nicht verloren: Absturz 500 ms nach dem vorigen tick, fällig mitten in der
  // Lücke (Fixrunde 1: nach dem vorigen tick, damit ein mitverschobener Neustart-Wecker auch mit Nenntakt noch nicht fällig wäre).
  const n = taktLage();
  const gn = sendend(n);
  const pn = programmBereit(n);
  sekunden(n, 1);
  n.s.t += 500;
  n.lage.gastExit('g1', gn, 1);
  n.lage.programmExit(pn, 1);
  n.s.t += 5500;
  ck('Nachtrag C (5) geplanter Neustart (Gast und Programm), dann eine Lücke von 6000 ms → der tick danach startet beide neu',
    gleich(kurz(n.lage.tick()), ['starten gast g1 G3', 'starten programm programm G4']) && zst(n.lage) === 'neustart' && pz(n.lage) === 'neustart');
  ck('Nachtrag C (5) … der neue Prozess hat ab seinem Start 10 s bis bereit', gleich(kurz(sekunden(n, 9)), [])
    && gleich(beendenH(sekunden(n, 1)), ['beenden gast g1 G3', 'beenden programm programm G4']) && zst(n.lage) === 'gescheitert/keinStart');

  // (6) Dauerdrosselung (Fixrunde 1, R28; etwa App Nap unter macOS im Tray): JEDER Abstand zwischen zwei tick() ist 3000 ms.
  // Von jeder Lücke zählt ein Nenntakt (1 s), das Alter wächst je gedrosseltem tick um 1 s; die Fristen greifen wieder, nur
  // langsamer. Vor jedem Fall ein normaler erster tick 1 s nach bereit bzw. nach dem Start (dort Alter 0 bzw. 1 s).
  /** `n` ticks im Abstand von 3000 ms; je tick die Handlungen und danach der Zustand. */
  const gedrosselt = (t: TestLage, n: number, zustand: () => string): { h: NdiHandlung[]; z: string }[] => {
    const aus: { h: NdiHandlung[]; z: string }[] = [];
    for (let r = 0; r < n; r++) {
      t.s.t += 3000;
      const h = t.lage.tick();
      aus.push({ h, z: zustand() });
    }
    return aus;
  };
  // (a) Gast sendet, danach weder Meldung noch Bild: Alter nach dem m-ten gedrosselten tick = m s.
  const da = taktLage();
  const gda = sendend(da);
  da.s.t += 1000;
  da.lage.gastMeldung('g1', gda, STAT);
  da.lage.videobild('g1');
  da.lage.tick();
  const ra = gedrosselt(da, 5, () => zst(da.lage));
  ck('Nachtrag C (6a) Dauerdrosselung, Gast ohne Meldung und Bild: nach dem 2. gedrosselten tick (2 s beobachtet) noch sendet, nach dem 3. (3 s) ohneBild',
    ra[1].z === 'sendet' && ra[2].z === 'ohneBild');
  ck('Nachtrag C (6a) … nach dem 4. gedrosselten tick (4 s) kein „Prozess beenden“, nach dem 5. (5 s beobachtet, 15 s Wanduhr) „Prozess beenden“ mit „keine Lebenszeichen“',
    ra.slice(0, 4).every((x) => beendenH(x.h).length === 0) && gleich(beendenH(ra[4].h), ['beenden gast g1 G1'])
      && logs(ra[4].h).some((z) => z.includes('keine Lebenszeichen')));
  // (b) Programm verbunden, danach keine Meldung.
  const db = taktLage();
  const gdb = programmBereit(db);
  db.s.t += 1000;
  db.lage.programmMeldung(gdb, VERBUNDEN);
  db.lage.tick();
  const rb = gedrosselt(db, 5, () => pz(db.lage));
  ck('Nachtrag C (6b) Dauerdrosselung, Programm verbunden ohne Meldung: nach dem 4. gedrosselten tick (4 s) nichts, nach dem 5. (5 s) „Prozess beenden“',
    rb.slice(0, 4).every((x) => beendenH(x.h).length === 0) && gleich(beendenH(rb[4].h), ['beenden programm programm G1']) && rb[3].z === 'verbunden');
  // (c) Gast startet ohne bereit: 1 s bis zum ersten tick, dann je gedrosseltem tick 1 s.
  const dc = taktLage();
  dc.lage.spinUp('g1', 'kamera', ANNA);
  dc.s.t += 1000;
  dc.lage.tick();
  const rc = gedrosselt(dc, 9, () => zst(dc.lage));
  ck('Nachtrag C (6c) Dauerdrosselung, Gast startet ohne bereit: nach dem 8. gedrosselten tick (9 s beobachtet) noch startet, nach dem 9. (10 s, 28 s Wanduhr) gescheitert/keinStart',
    rc.slice(0, 8).every((x) => kurz(x.h).length === 0 && x.z === 'startet') && gleich(beendenH(rc[8].h), ['beenden gast g1 G1']) && rc[8].z === 'gescheitert/keinStart');
  // (d) Gesund unter Dauerdrosselung: stat, Bild und lage je 1 s Wanduhr zwischen den ticks (IPC kommt an, nur der Takt ist gedehnt).
  const dd = taktLage();
  const gdd = sendend(dd);
  const pdd = programmBereit(dd);
  const lebt = (): void => {
    dd.lage.gastMeldung('g1', gdd, STAT);
    dd.lage.videobild('g1');
    dd.lage.programmMeldung(pdd, VERBUNDEN);
  };
  dd.s.t += 1000;
  lebt();
  dd.lage.tick();
  const rd: { h: NdiHandlung[]; z: string }[] = [];
  for (let r = 0; r < 10; r++) {
    dd.s.t += 1000;
    lebt();
    dd.s.t += 1000;
    lebt();
    dd.s.t += 1000;
    rd.push({ h: dd.lage.tick(), z: `${zst(dd.lage)} ${pz(dd.lage)}` });
  }
  ck('Nachtrag C (6d) gesunder Gast und Programm unter Dauerdrosselung (Meldungen je 1 s, ticks alle 3000 ms, 30 s): bleibt sendet bzw. verbunden, kein „Prozess beenden“',
    rd.every((x) => kurz(x.h).length === 0 && x.z === 'sendet verbunden'));

  // index.ts treibt die Lage im Sekundentakt und sagt es ihr.
  const { readFileSync } = await import('node:fs');
  const lies = (q: string): string => readFileSync(new URL(q, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const index = lies('../src/main/index.ts');
  const aufruf = index.slice(index.indexOf('const ndiLage = erzeugeNdiLage({'), index.indexOf('\n    });', index.indexOf('const ndiLage = erzeugeNdiLage({')));
  ck('Nachtrag C R20: index.ts gibt der Lage sekundenTakt: true, der Zeitgeber bleibt jede Sekunde',
    aufruf.includes('sekundenTakt: true,') && index.includes('setInterval(() => ndiAusfuehren(ndiLage.tick()), 1000);'));
}
console.log('— Nachtrag C (M-C7-1, M-C8-2): Stapel je Handlung abgesichert, Finder-Fehler als abbruch {init}');
{
  const { readFileSync } = await import('node:fs');
  const lies = (q: string): string => readFileSync(new URL(q, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const index = lies('../src/main/index.ts');
  const empf = lies('../src/utility/ndi-program-receiver.ts');
  /** Text ab `start` bis vor das nächste `ende` (leer, wenn `start` fehlt). */
  const abschnitt = (s: string, start: string, ende: string): string => {
    const i = s.indexOf(start);
    if (i < 0) return '';
    const j = s.indexOf(ende, i + start.length);
    return j < 0 ? s.slice(i) : s.slice(i, j);
  };
  const ausfuehren = abschnitt(index, 'const ndiAusfuehren = (h: NdiHandlung[]): void => {', '\n    };');
  ck('Nachtrag C M-C7-1: ndiAusfuehren führt jede Handlung in einem eigenen try aus; ein Fehler geht mit getLog().error ins Log, die nächste läuft',
    /for \(const x of h\) \{\n(?:\s*\/\/[^\n]*\n)*\s*try \{\n\s*if \(x\.art === 'log'\) getLog\(\)\.info\(x\.zeile\);\n[\s\S]*?\n\s*else programmHandlung\(x\);\n\s*\} catch \(err\) \{\n[\s\S]*?getLog\(\)\.error\([^\n]*, err\);\n\s*\}\n\s*\}$/.test(ausfuehren));
  const suche = abschnitt(empf, 'function searchLoop(', '\n}\n');
  ck('Nachtrag C M-C8-2: ein Fehler von findSources (in resolveSource) ist abbruch {init} mit Text wie ein Scheitern von init(), ohne weitere Suche',
    /let source: string \| null;\n\s*try \{\n\s*source = resolveSource\(nameHint\);\n\s*\} catch \(err\) \{\n(?:\s*\/\/[^\n]*\n)*\s*console\.error\('\[ndi-program-receiver\] findSources fehlgeschlagen:', err\);\n(?:[\s\S]*?\n)?\s*melde\(\{ type: 'abbruch', grund: 'init', text: fehlerText\(err\) \}\);\n\s*return;\n\s*\}/.test(suche)
      && suche.indexOf('source = resolveSource(nameHint);') < suche.indexOf('if (source) {'));
  ck('Nachtrag C M-C8-2: nach dem Finder-Fehler endet der Lage-Takt (keine Meldung mehr bis zum Ende durch den Main, E51)',
    /\} catch \(err\) \{\n[\s\S]*?findSources fehlgeschlagen[\s\S]*?if \(lageTakt\) \{\n\s*clearInterval\(lageTakt\);\n\s*lageTakt = null;\n\s*\}\n\s*melde\(\{ type: 'abbruch', grund: 'init'/.test(suche));
  // Die Lage macht aus dem abbruch {init} nach bereit gescheitert/init und beendet den Prozess, ohne Neustart (22.4).
  const t = testLage();
  const g = programmBereit(t);
  const h = t.lage.programmMeldung(g, { type: 'abbruch', grund: 'init', text: 'NDIlib_find_create_v2 failed' });
  ck('Nachtrag C M-C8-2 Lage: abbruch {init} nach bereit → „Prozess beenden“ und gescheitert/init; das folgende exit ändert nichts',
    gleich(kurz(h), ['beenden programm programm G1']) && pz(t.lage) === 'gescheitert/init' && gleich(t.lage.programmExit(g, 1), []) && pz(t.lage) === 'gescheitert/init');
}
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

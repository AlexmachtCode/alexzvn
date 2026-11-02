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
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

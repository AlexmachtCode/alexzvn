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

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

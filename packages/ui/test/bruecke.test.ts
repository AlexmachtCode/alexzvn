// UX-Pilot C5 · Brücken-Stand und -Hook (Plan E5): Ein Ereignis gewinnt gegen eine späte Antwort, Ablehnung und Wurf
// melden null, erst anmelden, dann abfragen, nach dem Abmelden nichts mehr; der Hook fasst beim Rendern nichts an (G7).
// Ohne DOM: hookAbo ist der Körper des Effekts (über verbindeBruecke), der Hook ruft ihn nur auf.
import { createElement } from 'react';
import * as ui from '../src/index';
import { brueckenSchritt, verbindeBruecke, type BrueckenQuelle, type BrueckenStand } from '../src/lib/bruecke';
import { hookAbo, hookSchritt, hookWert, useBrueckenWert, type HookZustand } from '../src/lib/useBrueckenWert';
import { gleich, leseText, ok, render } from './harness';

const OFFEN: BrueckenStand<string> = { art: 'offen' };

// ── brueckenSchritt ──
{
  gleich(brueckenSchritt(OFFEN, { art: 'antwort', wert: 'A' }), { art: 'da', wert: 'A', durch: 'antwort' }, 'Brücke: offen + Antwort → da (Antwort)');
  gleich(brueckenSchritt(OFFEN, { art: 'ereignis', wert: 'E' }), { art: 'da', wert: 'E', durch: 'ereignis' }, 'Brücke: offen + Ereignis → da (Ereignis)');
  const nachEreignis: BrueckenStand<string> = { art: 'da', wert: 'E', durch: 'ereignis' };
  ok(brueckenSchritt(nachEreignis, { art: 'antwort', wert: 'A' }) === nachEreignis, 'Brücke: Antwort nach einem Ereignis wird verworfen (Stand bleibt dasselbe Objekt)');
  gleich(
    brueckenSchritt({ art: 'da', wert: 'A', durch: 'antwort' }, { art: 'ereignis', wert: 'E2' }),
    { art: 'da', wert: 'E2', durch: 'ereignis' },
    'Brücke: ein Ereignis nach der Antwort gilt',
  );
  gleich(brueckenSchritt(nachEreignis, { art: 'ereignis', wert: 'E3' }), { art: 'da', wert: 'E3', durch: 'ereignis' }, 'Brücke: jedes weitere Ereignis gilt');
  gleich(brueckenSchritt(OFFEN, { art: 'ereignis', wert: null }), { art: 'da', wert: null, durch: 'ereignis' }, 'Brücke: null aus einem Ereignis bleibt null (nicht offen)');
}

// ── verbindeBruecke (Kern des Effekts) mit einer Attrappen-Quelle, die der Test von Hand steuert ──
// Die Attrappe hält ihren Zuhörer auch nach der Abmeldung fest (wie eine fehlerhafte Quelle): Still bleiben muss die Brücke.
function attrappe(wirft = false) {
  const reihe: string[] = [];
  let zuhoerer: ((wert: string | null) => void) | undefined;
  let loese: (wert: string | null) => void = () => {};
  let verwirf: (fehler: Error) => void = () => {};
  const quelle: BrueckenQuelle<string> = {
    abfrage: () => {
      reihe.push('abfrage');
      if (wirft) throw new Error('kein Handler');
      return new Promise<string | null>((res, rej) => {
        loese = res;
        verwirf = rej;
      });
    },
    ereignis: (cb) => {
      reihe.push('ereignis');
      zuhoerer = cb;
      return () => {
        reihe.push('ab');
      };
    },
  };
  return {
    quelle,
    reihe,
    sende: (wert: string | null) => zuhoerer?.(wert),
    antworte: (wert: string | null) => loese(wert),
    lehneAb: () => verwirf(new Error('abgelehnt')),
  };
}
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

{
  const q = attrappe();
  const gemeldet: Array<string | null> = [];
  verbindeBruecke(q.quelle, (wert) => gemeldet.push(wert));
  gleich(q.reihe, ['ereignis', 'abfrage'], 'Brücke verbinden: erst das Ereignis anmelden, dann abfragen');
  q.sende('E');
  q.antworte('A');
  await tick();
  gleich(gemeldet, ['E'], 'Brücke verbinden: Ereignis vor der Antwort gewinnt, die späte Antwort wird nicht gemeldet');
}
{
  const q = attrappe();
  const gemeldet: Array<string | null> = [];
  verbindeBruecke(q.quelle, (wert) => gemeldet.push(wert));
  q.antworte('A');
  await tick();
  gleich(gemeldet, ['A'], 'Brücke verbinden: Antwort ohne Ereignis gilt');
  q.sende('E2');
  q.sende(null);
  gleich(gemeldet, ['A', 'E2', null], 'Brücke verbinden: spätere Ereignisse gelten, auch null');
}
{
  const q = attrappe();
  const gemeldet: Array<string | null> = [];
  verbindeBruecke(q.quelle, (wert) => gemeldet.push(wert));
  q.lehneAb();
  await tick();
  gleich(gemeldet, [null], 'Brücke verbinden: abgelehnte Abfrage meldet null (nicht offen)');
}
{
  const q = attrappe(true);
  const gemeldet: Array<string | null> = [];
  verbindeBruecke(q.quelle, (wert) => gemeldet.push(wert));
  await tick();
  gleich(gemeldet, [null], 'Brücke verbinden: wirft die Abfrage, meldet null');
}
{
  const q = attrappe();
  const gemeldet: Array<string | null> = [];
  const ab = verbindeBruecke(q.quelle, (wert) => gemeldet.push(wert));
  ab();
  ab();
  q.sende('E');
  q.antworte('A');
  await tick();
  ok(
    gemeldet.length === 0 && q.reihe.filter((r) => r === 'ab').length === 1,
    'Brücke verbinden: nach dem Abmelden nichts mehr gemeldet, Abmeldung der Quelle genau einmal',
  );
}

// ── Hook beim Rendern (renderToStaticMarkup: Effekte laufen nicht) ──
{
  function Probe({ quelle }: { quelle?: BrueckenQuelle<string> }): React.JSX.Element {
    const wert = useBrueckenWert(quelle);
    return createElement('span', null, wert === undefined ? 'offen' : wert === null ? 'null' : wert);
  }
  gleich(render(createElement(Probe, {})), '<span>null</span>', 'Brücken-Hook: ohne Quelle null');
  const q = attrappe();
  gleich(render(createElement(Probe, { quelle: q.quelle })), '<span>offen</span>', 'Brücken-Hook: mit Quelle beim Server-Render undefined (offen)');
  gleich(q.reihe, [], 'Brücken-Hook: beim Rendern weder angemeldet noch abgefragt (nur im Effekt, G7)');
  // Ohne DOM laufen die Effekte des Hooks nicht. Darum steht er hier wörtlich: Er ruft im Effekt nur hookAbo und liefert
  // hookWert. Jeder eigene Übergang im Hook (eine Meldung auslassen, den ersten Wert halten) ändert diesen Text.
  const hook = leseText('src/lib/useBrueckenWert.ts');
  const koerper = /export function useBrueckenWert<T>[\s\S]*?\n\}/.exec(hook)?.[0] ?? '';
  gleich(
    koerper.split('\n').map((z) => z.trim()),
    [
      'export function useBrueckenWert<T>(quelle: BrueckenQuelle<T> | undefined): T | null | undefined {',
      'const [z, setZ] = useState<HookZustand<T>>({ fuer: quelle, wert: undefined });',
      'useEffect(() => hookAbo(quelle, setZ), [quelle]);',
      'return hookWert(z, quelle);',
      '}',
    ],
    'Brücken-Hook: der Hook wörtlich (Effekt nur hookAbo, Rückgabe hookWert; kein eigener Übergang im Hook)',
  );
}

// ── Effekt des Hooks über mehrere Meldungen: hookAbo mit der Attrappe; setZ wendet den Schritt an wie React ──
{
  const q = attrappe();
  let z: HookZustand<string> = { fuer: q.quelle, wert: undefined };
  // String(…), damit undefined und null im Vergleich verschieden bleiben (JSON macht aus beiden null).
  const verlauf: string[] = [String(hookWert(z, q.quelle))];
  const ab = hookAbo(q.quelle, (schritt) => {
    z = schritt(z);
    verlauf.push(String(hookWert(z, q.quelle)));
  });
  q.antworte('verbunden');
  await tick();
  q.sende('sucht');
  q.sende('fehler');
  q.sende(null);
  gleich(
    [q.reihe, verlauf],
    [
      ['ereignis', 'abfrage'],
      ['undefined', 'verbunden', 'sucht', 'fehler', 'null'],
    ],
    'Brücken-Hook (Effekt hookAbo): angemeldet, dann abgefragt; Antwort verbunden, dann sucht, fehler, null: jede Meldung ersetzt den Wert, auch null nach einem Wert',
  );
  const vorAb = verlauf.length;
  ab?.();
  q.sende('spät');
  const ohne: string[] = [];
  gleich(
    [verlauf.length - vorAb, q.reihe.filter((r) => r === 'ab').length, String(hookAbo(undefined, () => void ohne.push('x'))), ohne.length],
    [0, 1, 'undefined', 0],
    'Brücken-Hook (Effekt hookAbo): nach dem Abmelden bleibt der Wert, ohne Quelle meldet er nichts an',
  );
  gleich(
    [hookWert(z, attrappe().quelle), hookWert(z, undefined)].map(String),
    ['undefined', 'null'],
    'Brücken-Hook: neue Quelle → undefined (der Wert der alten Quelle gilt nicht), ohne Quelle null',
  );
}

{
  ok(
    typeof ui.brueckenSchritt === 'function' && typeof ui.verbindeBruecke === 'function' && typeof ui.useBrueckenWert === 'function',
    'Brücke: Exporte aus src/index.ts (brueckenSchritt, verbindeBruecke, useBrueckenWert)',
  );
}

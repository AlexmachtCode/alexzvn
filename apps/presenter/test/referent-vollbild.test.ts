// #309: Vollbild der Referentenansicht – Kern ohne Electron (src/main/referent-vollbild.ts) mit Fenster- und
// Speicher-Attrappe. npm run selftest -w @jm/presenter
import type { ReferentConfig } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const k = await import('../src/main/referent-vollbild');

type Ereignis = 'enter-full-screen' | 'leave-full-screen' | 'close';

/**
 * Fenster-Attrappe wie ein BrowserWindow: `setFullScreen` meldet einen echten Wechsel sofort über
 * enter-/leave-full-screen (Electron meldet ihn nach dem Übergang); `feuere` löst ein Ereignis von Hand aus.
 */
class Fenster {
  voll = false;
  zerstoert = false;
  aufrufe: boolean[] = [];
  private zuhoerer = new Map<Ereignis, Array<() => void>>();
  isFullScreen(): boolean { return this.voll; }
  isDestroyed(): boolean { return this.zerstoert; }
  setFullScreen(an: boolean): void {
    this.aufrufe.push(an);
    if (an === this.voll) return;
    this.voll = an;
    this.feuere(an ? 'enter-full-screen' : 'leave-full-screen');
  }
  on(e: Ereignis, fn: () => void): this {
    this.zuhoerer.set(e, [...(this.zuhoerer.get(e) ?? []), fn]);
    return this;
  }
  feuere(e: Ereignis): void {
    for (const fn of this.zuhoerer.get(e) ?? []) fn();
  }
}

class Speicher {
  gespeichert: ReferentConfig[] = [];
  constructor(private stand: ReferentConfig = { vollbild: false }) {}
  lade(): ReferentConfig { return this.stand; }
  speichere(c: ReferentConfig): void { this.gespeichert.push(c); this.stand = c; }
}

// --- normiereReferentConfig: nur ein echtes `true` schaltet Vollbild ein
for (const [name, roh] of [
  ['undefined', undefined], ['null', null], ['Zahl', 42], ['Liste', []], ['leeres Objekt', {}],
  ['Text "true"', { vollbild: 'true' }], ['Zahl 1', { vollbild: 1 }],
] as const) {
  ck(`normiere ${name} → aus`, eq(k.normiereReferentConfig(roh), { vollbild: false }));
}
ck('normiere { vollbild: true } → an', eq(k.normiereReferentConfig({ vollbild: true }), { vollbild: true }));
ck('normiere wirft fremde Felder weg', eq(k.normiereReferentConfig({ vollbild: true, x: 1 }), { vollbild: true }));

// --- Anwenden beim Öffnen
{
  const w = new Fenster();
  k.referentVollbildAnwenden(w, new Speicher({ vollbild: true }));
  ck('gemerkt an → genau ein setFullScreen(true)', eq(w.aufrufe, [true]) && w.voll);
}
{
  const w = new Fenster();
  k.referentVollbildAnwenden(w, new Speicher({ vollbild: false }));
  ck('gemerkt aus → kein setFullScreen', eq(w.aufrufe, []));
}
{
  const w = new Fenster();
  w.zerstoert = true;
  k.referentVollbildAnwenden(w, new Speicher({ vollbild: true }));
  ck('zerstörtes Fenster → kein setFullScreen', eq(w.aufrufe, []));
}

// --- Verdrahten: jeder echte Wechsel wird gemerkt und gemeldet
{
  const w = new Fenster();
  const s = new Speicher();
  const gemeldet: boolean[] = [];
  k.referentVollbildVerdrahten(w, s, (an) => gemeldet.push(an));
  w.feuere('enter-full-screen');
  ck('enter → gespeichert an', eq(s.gespeichert, [{ vollbild: true }]));
  ck('enter → gemeldet an', eq(gemeldet, [true]));
  w.feuere('leave-full-screen');
  ck('leave → gespeichert aus', eq(s.gespeichert, [{ vollbild: true }, { vollbild: false }]));
  ck('leave → gemeldet aus', eq(gemeldet, [true, false]));
}
{
  // Schließen im Vollbild (Beenden/Escape) darf den gemerkten Zustand nicht löschen – auch wenn ein System
  // (Mac ungeprüft) beim Schließen noch „Vollbild verlassen“ meldet.
  const w = new Fenster();
  const s = new Speicher({ vollbild: true });
  const gemeldet: boolean[] = [];
  k.referentVollbildVerdrahten(w, s, (an) => gemeldet.push(an));
  w.feuere('close');
  w.feuere('leave-full-screen');
  ck('close, dann leave → nichts gespeichert', eq(s.gespeichert, []));
  ck('close, dann leave → nichts gemeldet', eq(gemeldet, []));
  ck('close, dann leave → gemerkt bleibt an', eq(s.lade(), { vollbild: true }));
}

// --- Umschalten
ck('umschalten ohne Fenster → false', k.referentVollbildUmschalten(null) === false);
{
  const w = new Fenster();
  w.zerstoert = true;
  ck('umschalten zerstört → false', k.referentVollbildUmschalten(w) === false);
  ck('umschalten zerstört → kein setFullScreen', eq(w.aufrufe, []));
}
{
  const w = new Fenster();
  ck('umschalten aus → liefert true', k.referentVollbildUmschalten(w) === true);
  ck('umschalten aus → Fenster voll', w.voll === true);
  ck('nochmal umschalten → liefert false', k.referentVollbildUmschalten(w) === false);
  ck('nochmal umschalten → Fenster nicht voll', w.voll === false);
}

// --- Stand
ck('Stand ohne Fenster → false', k.referentVollbildStand(null) === false);
{
  const w = new Fenster();
  w.voll = true;
  ck('Stand volles Fenster → true', k.referentVollbildStand(w) === true);
  w.zerstoert = true;
  ck('Stand zerstörtes Fenster → false', k.referentVollbildStand(w) === false);
}

// --- Ende zu Ende im Kern: Umschalten merkt, das nächste Fenster öffnet im Vollbild
{
  const s = new Speicher();
  const erstes = new Fenster();
  k.referentVollbildVerdrahten(erstes, s, () => {});
  k.referentVollbildUmschalten(erstes);
  ck('Umschalten an → Speicher an', eq(s.lade(), { vollbild: true }));
  erstes.feuere('close');
  const zweites = new Fenster();
  k.referentVollbildVerdrahten(zweites, s, () => {});
  k.referentVollbildAnwenden(zweites, s);
  ck('nächstes Fenster öffnet im Vollbild', zweites.voll === true);
}

console.log(`referent-vollbild: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);

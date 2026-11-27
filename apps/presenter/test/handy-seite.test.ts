// Altfehler Stufe 2, PS-15: Die Handy-Seite (src/main/remote-page.ts) prüft die PIN über den lesenden Strom /events, nicht
// mit dem Befehl `live` an /cmd; ein Schwarz- oder Weißbild bleibt stehen (P7). Das <script> aus controllerHtml(true) läuft in
// node:vm mit Attrappen für document, localStorage, EventSource und fetch. Kein Electron, kein Server. npm run selftest -w @jm/presenter
import vm from 'node:vm';
import { controllerHtml } from '../src/main/remote-page';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
/** Mikro- und Makroaufgaben abarbeiten (die fetch-Ketten der Seite hängen an Promises). */
const ruhe = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

interface Element {
  id: string;
  klassen: Set<string>;
  classList: { add(k: string): void; remove(k: string): void; toggle(k: string, an?: boolean): void; contains(k: string): boolean };
  textContent: string;
  value: string;
  disabled: boolean;
  dataset: Record<string, string>;
  hoerer: Map<string, Array<(e?: unknown) => void>>;
  addEventListener(art: string, f: (e?: unknown) => void): void;
  click(): void;
}
function element(id: string, klassen: string, dataset: Record<string, string> = {}): Element {
  const k = new Set(klassen.split(/\s+/).filter((s) => s !== ''));
  const el: Element = {
    id,
    klassen: k,
    classList: {
      add: (x) => void k.add(x),
      remove: (x) => void k.delete(x),
      toggle: (x, an) => void ((an ?? !k.has(x)) ? k.add(x) : k.delete(x)),
      contains: (x) => k.has(x),
    },
    textContent: '',
    value: '',
    disabled: false,
    dataset,
    hoerer: new Map(),
    addEventListener(art, f) {
      el.hoerer.set(art, [...(el.hoerer.get(art) ?? []), f]);
    },
    click() {
      for (const f of el.hoerer.get('click') ?? []) f({});
    },
  };
  return el;
}

interface Aufruf { url: string; methode: string; body: string | undefined; signal: AbortSignal | undefined }
interface Seite {
  el: (id: string) => Element;
  knopf: (screen: string) => Element;
  aufrufe: Aufruf[];
  quellen: Array<{ url: string; zu: boolean }>;
  status: { wert: number };
}

/** Lädt die Seite mit PIN-Schutz: Elemente mit ihren Klassen aus dem HTML, Skript in einem eigenen vm-Kontext. */
function lade(): Seite {
  const html = controllerHtml(true);
  const elemente = new Map<string, Element>();
  const knoepfe: Element[] = [];
  for (const m of html.matchAll(/<[a-z]+\b[^>]*>/g)) {
    const tag = m[0];
    const id = /\bid="([^"]+)"/.exec(tag)?.[1];
    const klassen = /\bclass="([^"]*)"/.exec(tag)?.[1] ?? '';
    const screen = /\bdata-screen="([^"]+)"/.exec(tag)?.[1];
    if (id) elemente.set(id, element(id, klassen));
    if (screen) knoepfe.push(element('', klassen, { screen }));
  }
  const el = (id: string): Element => {
    if (!elemente.has(id)) elemente.set(id, element(id, ''));
    return elemente.get(id) as Element;
  };
  const speicher = new Map<string, string>();
  const aufrufe: Aufruf[] = [];
  const quellen: Array<{ url: string; zu: boolean }> = [];
  const status = { wert: 200 };
  class EventSourceAttrappe {
    onopen: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    private eintrag: { url: string; zu: boolean };
    constructor(url: string) {
      this.eintrag = { url, zu: false };
      quellen.push(this.eintrag);
    }
    close(): void {
      this.eintrag.zu = true;
    }
  }
  const kontext = vm.createContext({
    document: {
      getElementById: el,
      querySelectorAll: (sel: string) => (sel === '[data-screen]' ? knoepfe : []),
      addEventListener: () => {},
    },
    localStorage: {
      getItem: (k: string) => speicher.get(k) ?? null,
      setItem: (k: string, v: string) => void speicher.set(k, String(v)),
      removeItem: (k: string) => void speicher.delete(k),
    },
    EventSource: EventSourceAttrappe,
    AbortController,
    fetch: (url: string, opt?: { method?: string; body?: string; signal?: AbortSignal }) => {
      aufrufe.push({ url, methode: opt?.method ?? 'GET', body: opt?.body, signal: opt?.signal });
      const s = status.wert;
      return Promise.resolve({ status: s, json: () => Promise.resolve({ active: false }) });
    },
    confirm: () => true,
    setTimeout,
    clearTimeout,
    console,
  });
  const skript = html.slice(html.indexOf('<script>') + '<script>'.length, html.indexOf('</script>'));
  vm.runInContext(skript, kontext);
  return { el, knopf: (s) => knoepfe.find((k) => k.dataset.screen === s) as Element, aufrufe, quellen, status };
}

const anCmd = (s: Seite): Aufruf[] => s.aufrufe.filter((a) => a.url.startsWith('/cmd'));
const mitLive = (s: Seite): Aufruf[] => s.aufrufe.filter((a) => (a.body ?? '').includes('"action":"live"'));
const pruefungen = (s: Seite): Aufruf[] => s.aufrufe.filter((a) => a.methode === 'GET' && a.url === '/events?pin=1234');

// ── PS-15 PIN-Prüfung schaltet nichts: falsche PIN (401) ──
{
  const s = lade();
  ck('PS-15 Vorbedingung: mit PIN-Schutz ist das Tor offen, die Steuerung verborgen, kein Strom offen', !s.el('gate').klassen.has('hidden') && s.el('app').klassen.has('hidden') && s.quellen.length === 0 && s.aufrufe.length === 0);
  s.status.wert = 401;
  s.el('pin').value = '1234';
  s.el('connect').click();
  await ruhe();
  ck('PS-15 PIN-Prüfung schaltet nichts (401): kein Aufruf an /cmd', anCmd(s).length === 0);
  ck('PS-15 PIN-Prüfung schaltet nichts (401): kein Body mit "action":"live"', mitLive(s).length === 0);
  ck('PS-15 PIN-Prüfung schaltet nichts (401): genau ein GET auf /events?pin=1234 und sonst nichts', pruefungen(s).length === 1 && s.aufrufe.length === 1);
  ck('PS-15 PIN-Prüfung schaltet nichts (401): „Falsche PIN.“ in gateErr', s.el('gateErr').textContent === 'Falsche PIN.');
  ck('PS-15 PIN-Prüfung schaltet nichts (401): das Tor bleibt, die Steuerung bleibt verborgen, kein Strom offen', !s.el('gate').klassen.has('hidden') && s.el('app').klassen.has('hidden') && s.quellen.length === 0);
}

// ── PS-15 PIN-Prüfung schaltet nichts: richtige PIN (200) ──
{
  const s = lade();
  s.status.wert = 200;
  s.el('pin').value = '1234';
  s.el('connect').click();
  await ruhe();
  ck('PS-15 PIN-Prüfung schaltet nichts (200): kein Aufruf an /cmd', anCmd(s).length === 0);
  ck('PS-15 PIN-Prüfung schaltet nichts (200): kein Body mit "action":"live"', mitLive(s).length === 0);
  ck('PS-15 PIN-Prüfung schaltet nichts (200): genau ein GET auf /events?pin=1234 und sonst nichts', pruefungen(s).length === 1 && s.aufrufe.length === 1);
  ck('PS-15 PIN-Prüfung schaltet nichts (200): die Prüfung ist abgebrochen (abort), sie hält keinen zweiten Strom offen', pruefungen(s)[0]?.signal?.aborted === true);
  ck('PS-15 PIN-Prüfung schaltet nichts (200): gate versteckt, Steuerung sichtbar', s.el('gate').klassen.has('hidden') && !s.el('app').klassen.has('hidden'));
  ck(
    'PS-15 PIN-Prüfung schaltet nichts (200): genau eine EventSource(/events?pin=1234) ist offen',
    s.quellen.length === 1 && s.quellen[0].url === '/events?pin=1234' && !s.quellen[0].zu,
  );
  ck('PS-15 PIN-Prüfung schaltet nichts (200): leere Fehlerzeile', s.el('gateErr').textContent === '');

  // Gegenprobe (Wächter, K8): „Folie“ sendet weiter `live` an /cmd, mit der angenommenen PIN. Gezählt wird nur, was der Klick
  // auf „Folie“ auslöst, nicht die Prüfung davor.
  const vorher = s.aufrufe.length;
  s.knopf('live').click();
  await ruhe();
  const cmd = s.aufrufe.slice(vorher);
  ck(
    'PS-15 Gegenprobe: „Folie“ (data-screen="live") sendet weiter /cmd mit action live und der PIN',
    cmd.length === 1 && cmd[0].url === '/cmd' && cmd[0].methode === 'POST' && JSON.stringify(JSON.parse(cmd[0].body ?? '{}')) === JSON.stringify({ action: 'live', pin: '1234' }),
  );
}

// ── Randfall: kürzer als vier Ziffern → kein Abruf, Hinweis wie bisher ──
{
  const s = lade();
  s.el('pin').value = '12';
  s.el('connect').click();
  await ruhe();
  ck('PS-15 Randfall: weniger als vier Ziffern → „4-stellige PIN.“, kein Abruf', s.el('gateErr').textContent === '4-stellige PIN.' && s.aufrufe.length === 0);
}

console.log(`\nhandy-seite: ${pass} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

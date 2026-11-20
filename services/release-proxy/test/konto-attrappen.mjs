// Gemeinsame Attrappen der Konto-Tests im Worker (P3; genutzt von konto-do.test.mjs und in Block C von konto-zugang,
// konto-routen und qa-relay). Kein Netz, keine Cloudflare-Laufzeit (EP21):
// - `makeCtx()`: Speicher eines Durable Object als Map mit get/put/delete/deleteAll/list (prefix, start, end, limit,
//   reverse; sortiert) und Alarm (getAlarm/setAlarm/deleteAlarm). Werte werden wie im echten Speicher als Kopie abgelegt
//   und gelesen (structuredClone). `ctx.daten` ist die Map, `ctx.alarmZeit` der gestellte Alarm.
// - `makeKontoNs(env)`: Namespace-Fake für die Bindung KONTO mit `jurisdiction(j)`, `idFromName`, `get(id).fetch`; eine
//   echte `KontoSpeicher`-Instanz je Name und Jurisdiction; jede Anfrage an den DO landet in `ns.anfragen`
//   (URL, Methode, Kopfzeilen), gewählte Jurisdictions in `ns.jurisdiktionen`. `{ mitJurisdiktion: false }` ohne Fähigkeit.
// - `makeKV()`: KV mit get (auch `'json'`), put (merkt `expirationTtl`), delete und list (prefix, limit, cursor).
// - `makeUhr(start)`: Uhr für `env.KONTO_UHR` mit `stelle(ms)` und `vor(ms)`; `makeWaitCtx()`: drittes Argument von
//   `fetch(request, env, ctx)` mit `waitUntil` und `fertig()`.
// - `testSchluessel()`: 32 Zufallsbytes als Base64, zur Laufzeit (G4: kein Schlüssel-Literal im Quelltext).
// - `testGeraet(angaben)`: ECDSA-P-256-Paar wie im Launcher (P8) mit `gid`, `angaben` für `vorgang-anlegen` und
//   `beweis(zweck, bezug, ts)`; `neuerSpeicher(env)`, `rufeDo(speicher, aktion, body)`.
// - Zählung im Format „check“: `check`, `kreuz`, `pruefeFaelle` (eine Zeile je Tabelle, bis zu fünf Abweichungen),
//   `abschluss()` druckt `‹n› passed, ‹m› failed` und beendet mit Exit 1 bei Fehlern.
import { AsyncLocalStorage } from 'node:async_hooks';
import { KontoSpeicher } from '../konto-do.js';
import { beweisText, geraetIdAus } from '../konto-krypto.js';

let passed = 0;
let failed = 0;

// Die eigene Ausgabe des Harness läuft über das echte, beim Laden dieses Moduls ungekapselte console.log, damit ein Test console.log,
// info und debug mitschneiden kann (konto-routen.test.mjs, G4) und die Zeilen des Harness nicht im Mitschnitt landen.
const echtesLog = console.log.bind(console);

export function check(name, cond) {
  if (cond) {
    passed++;
    echtesLog(`  ok  ${name}`);
  } else {
    failed++;
    echtesLog(`FAIL  ${name}`);
  }
}

/** Alle Kombinationen der Achsen, in fester Reihenfolge. */
export function kreuz(achsen) {
  let faelle = [{}];
  for (const [name, werte] of Object.entries(achsen)) faelle = faelle.flatMap((f) => werte.map((w) => ({ ...f, [name]: w })));
  return faelle;
}

export function fallText(f) {
  return f.name ?? Object.entries(f).map(([k, v]) => `${k}=${v === undefined ? 'undefined' : JSON.stringify(v)}`).join(' ');
}

/** Eine Zeile je Tabelle; `pruefe` liefert null oder eine Abweichung (auch async). */
export async function pruefeFaelle(name, faelle, pruefe) {
  const abw = [];
  for (const f of faelle) {
    const r = await pruefe(f);
    if (r !== null) abw.push(`${fallText(f)} → ${r}`);
  }
  check(`${name} (${faelle.length} Fälle)`, abw.length === 0);
  for (const z of abw.slice(0, 5)) echtesLog(`     ${z}`);
  if (abw.length > 5) echtesLog(`     … und ${abw.length - 5} weitere`);
}

/** null bei Gleichheit (JSON), sonst „ist … soll …“. */
export function gleich(ist, soll) {
  return JSON.stringify(ist) === JSON.stringify(soll) ? null : `ist ${JSON.stringify(ist)} soll ${JSON.stringify(soll)}`;
}

export function abschluss() {
  echtesLog(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

export function makeCtx() {
  const daten = new Map();
  let alarm = null;
  const kopie = (v) => (v === undefined ? undefined : structuredClone(v));
  const ctx = {
    daten,
    get alarmZeit() {
      return alarm;
    },
    storage: {
      async get(k) {
        if (Array.isArray(k)) return new Map(k.filter((x) => daten.has(x)).map((x) => [x, kopie(daten.get(x))]));
        return kopie(daten.get(k));
      },
      async put(k, v) {
        if (k && typeof k === 'object') {
          for (const [x, y] of Object.entries(k)) daten.set(x, kopie(y));
          return;
        }
        daten.set(k, kopie(v));
      },
      async delete(k) {
        if (Array.isArray(k)) return k.filter((x) => daten.delete(x)).length;
        return daten.delete(k);
      },
      async deleteAll() {
        daten.clear();
      },
      async list({ prefix = '', start, end, limit, reverse } = {}) {
        let keys = [...daten.keys()]
          .filter((k) => k.startsWith(prefix) && (start === undefined || k >= start) && (end === undefined || k < end))
          .sort();
        if (reverse) keys.reverse();
        if (typeof limit === 'number') keys = keys.slice(0, limit);
        return new Map(keys.map((k) => [k, kopie(daten.get(k))]));
      },
      async getAlarm() {
        return alarm;
      },
      async setAlarm(ms) {
        alarm = typeof ms === 'number' ? ms : ms.getTime();
      },
      async deleteAlarm() {
        alarm = null;
      },
    },
    blockConcurrencyWhile(fn) {
      return fn();
    },
  };
  eingangsTor(ctx.storage);
  return ctx;
}

// Eingangs-Tor (Input Gate) eines Durable Object, wie in der Cloudflare-Laufzeit: Solange eine Anfrage Speicherzugriffe
// ausführt, erreicht den Speicher keine andere Anfrage. Das Tor öffnet erst, wenn die haltende Anfrage auf etwas anderes als
// Speicher wartet (echtes I/O, etwa crypto.subtle oder einen Timer) oder fertig ist. Dann kommt die nächste dran, und ein
// Lesen und Schreiben der ersten Anfrage mit einem solchen `await` dazwischen verzahnt sich mit der zweiten (Rennen).
// Reine Mikrotask-Sprünge (`await Promise.resolve()`, Rückkehr aus einer async-Hilfsfunktion) öffnen es nicht.
// Die Anfrage erkennt die Attrappe am Kontext, den `makeKontoNs().get(id).fetch` setzt; Zugriffe ohne Kontext
// (Tests, die rufeDo direkt aufrufen) laufen wie bisher ungebremst.
const anfrageKontext = new AsyncLocalStorage();
let anfrageZaehler = 0;

function eingangsTor(speicher) {
  const tor = { halter: null, wartende: [] };
  const freigeben = () => {
    tor.halter = null;
    const w = tor.wartende.shift();
    if (w) {
      tor.halter = w.ich;
      w.weiter();
    }
  };
  const gebremst = (original) => async (...args) => {
    const ich = anfrageKontext.getStore();
    if (!ich) return original(...args);
    if (tor.halter && tor.halter !== ich) await new Promise((weiter) => tor.wartende.push({ ich, weiter }));
    tor.halter = ich;
    ich.zugriffe++;
    const gezaehlt = ich.zugriffe;
    // Nach dem Abarbeiten aller Mikrotasks: hat die Anfrage keinen weiteren Speicherzugriff gestellt, wartet sie auf I/O.
    setImmediate(() => {
      if (tor.halter === ich && ich.zugriffe === gezaehlt) freigeben();
    });
    return original(...args);
  };
  for (const name of ['get', 'put', 'delete', 'deleteAll', 'list']) speicher[name] = gebremst(speicher[name]);
}

export function makeKontoNs(env, { mitJurisdiktion = true } = {}) {
  const instanzen = new Map();
  const anfragen = [];
  const jurisdiktionen = [];
  const instanz = (j, name) => {
    const key = `${j}|${name}`;
    if (!instanzen.has(key)) instanzen.set(key, new KontoSpeicher(makeCtx(), env));
    return instanzen.get(key);
  };
  const machNs = (j) => ({
    idFromName: (name) => ({ name: String(name), jurisdiktion: j, toString: () => `${j}|${name}` }),
    get(id) {
      const speicher = instanz(id.jurisdiktion, id.name);
      return {
        async fetch(request) {
          anfragen.push({ url: request.url, method: request.method, headers: Object.fromEntries(request.headers) });
          const ich = { nr: ++anfrageZaehler, zugriffe: 0 };
          return anfrageKontext.run(ich, () => speicher.fetch(request));
        },
      };
    },
  });
  const ns = { ...machNs(''), anfragen, jurisdiktionen, instanzen, speicher: (name = 'konten', j = 'eu') => instanz(j, name) };
  if (mitJurisdiktion) {
    ns.jurisdiction = (j) => {
      jurisdiktionen.push(j);
      return machNs(j);
    };
  }
  return ns;
}

export function makeKV() {
  const m = new Map();
  return {
    daten: m,
    async get(key, art) {
      if (!m.has(key)) return null;
      const typ = typeof art === 'string' ? art : art && art.type;
      const wert = m.get(key).wert;
      return typ === 'json' ? JSON.parse(wert) : wert;
    },
    async put(key, wert, opts = {}) {
      m.set(key, { wert: String(wert), ttl: opts.expirationTtl ?? null });
    },
    async delete(key) {
      m.delete(key);
    },
    async list({ prefix = '', limit = 1000, cursor } = {}) {
      const alle = [...m.keys()].filter((k) => k.startsWith(prefix)).sort();
      const ab = cursor ? Number(cursor) : 0;
      const teil = alle.slice(ab, ab + limit);
      const weiter = ab + limit < alle.length;
      return { keys: teil.map((name) => ({ name })), list_complete: !weiter, cursor: weiter ? String(ab + limit) : '' };
    },
  };
}

/**
 * Die sieben Rate-Limit-Bindungen der Anmeldung (AR70, wrangler.toml [[ratelimits]]): Name → namespace_id, Grenze je Periode
 * (60 s) und die Route. Die Tabelle steht hier EINMAL; der Wächter in konto-zugang.test.mjs vergleicht sie mit wrangler.toml.
 */
export const RL_TABELLE = Object.freeze({
  KONTO_RL_VORGANG: { namespaceId: '7301', grenze: 20, period: 60 },
  KONTO_RL_ABHOLEN: { namespaceId: '7302', grenze: 600, period: 60 },
  KONTO_RL_ABBRECHEN: { namespaceId: '7303', grenze: 60, period: 60 },
  KONTO_RL_GOOGLE: { namespaceId: '7304', grenze: 60, period: 60 },
  KONTO_RL_PASSWORT: { namespaceId: '7305', grenze: 10, period: 60 },
  KONTO_RL_SELBSTUPDATE: { namespaceId: '7306', grenze: 20, period: 60 },
  KONTO_RL_QAALT: { namespaceId: '7307', grenze: 60, period: 60 },
});

/**
 * Attrappe einer Rate-Limit-Bindung von Cloudflare: `limit({ key })` → `{ success }`, ein Zähler je key, ab der Grenze + 1 ist
 * success false. `neuesFenster()` setzt die Zähler zurück (die Periode ist um). `aufrufe` merkt jeden key; `wirft` lässt limit()
 * mit einer Ausnahme scheitern.
 */
export function makeRateLimit(grenze, { wirft = null } = {}) {
  const b = {
    grenze,
    zaehler: new Map(),
    aufrufe: [],
    wirft,
    async limit(opts) {
      b.aufrufe.push(opts && opts.key);
      if (b.wirft) throw b.wirft;
      const n = (b.zaehler.get(opts.key) || 0) + 1;
      b.zaehler.set(opts.key, n);
      return { success: n <= b.grenze };
    },
    neuesFenster() {
      b.zaehler.clear();
    },
  };
  return b;
}

/** Alle sieben Bindungen mit den Grenzen aus RL_TABELLE; `ueberschreibe` ersetzt einzelne (oder lässt sie mit undefined weg). */
export function makeRLBindungen(ueberschreibe = {}) {
  const env = {};
  for (const [name, t] of Object.entries(RL_TABELLE)) env[name] = makeRateLimit(t.grenze);
  return { ...env, ...ueberschreibe };
}

export function makeUhr(start = Date.UTC(2026, 9, 21, 8, 0, 0)) {
  let t = start;
  const uhr = () => t;
  uhr.stelle = (ms) => {
    t = ms;
  };
  uhr.vor = (ms) => {
    t += ms;
  };
  return uhr;
}

export function makeWaitCtx() {
  const versprechen = [];
  return {
    versprechen,
    waitUntil(p) {
      versprechen.push(Promise.resolve(p));
    },
    passThroughOnException() {},
    async fertig() {
      await Promise.all(versprechen);
    },
  };
}

export function testSchluessel() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
}

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function testGeraet(o = {}) {
  const paar = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicJwk = await crypto.subtle.exportKey('jwk', paar.publicKey);
  const gid = await geraetIdAus(publicJwk);
  return {
    gid,
    publicJwk,
    angaben: { publicJwk, name: o.name ?? 'Regie-PC 1', plattform: o.plattform ?? 'win', arch: o.arch ?? 'x64', version: o.version ?? '0.18.0' },
    async beweis(zweck, bezug, ts) {
      const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, paar.privateKey, new TextEncoder().encode(beweisText(zweck, bezug, ts)));
      return { gid, ts, sig: b64url(sig) };
    },
  };
}

export function neuerSpeicher(env = {}) {
  const ctx = makeCtx();
  return { ctx, speicher: new KontoSpeicher(ctx, env) };
}

/** POST https://konto.intern/<aktion> wie der Worker; Ergebnis = JSON der Antwort plus `http` (Status). */
export async function rufeDo(speicher, aktion, body) {
  const res = await speicher.fetch(new Request(`https://konto.intern/${aktion}`, { method: 'POST', body: JSON.stringify(body) }));
  return { http: res.status, ...(await res.json()) };
}

// Anmeldung im Launcher (Teil 1) · P10: Sitzungs-Treiber (src/main/konto/sitzung-kern.ts) nach Verhalten 11.1 (R1–R13) —
// ohne Electron, ohne Netz (tsx). Client, Gerät, Speicher, Uhr und Wecker sind Attrappen; der Wecker feuert nur von Hand.
import { readFileSync } from 'node:fs';
import type { KontoAnsicht, KontoStand, ZoomAnfrageStand } from '../src/shared/konto';
import type { GeraetHandle } from '../src/main/konto/geraet';
import {
  erzeugeSitzungsTreiber, GOOGLE_NEU_MS, NEUPRUEFUNG_VORLAUF_MS, WECKER_MAX_MS, type GespeicherteSitzung, type SitzungsTreiber,
  type SitzungsUmgebung,
} from '../src/main/konto/sitzung-kern';
import { KontoFehler, type KontoClient } from '../src/main/konto/worker-client';
import { kreuz, pruefeFaelle } from './konto-rechte.test';
import { GOOGLE_NEU_MS as GOOGLE_NEU_MS_WORKER } from '../../../services/release-proxy/konto-kern.js';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const TAG = 24 * 3600_000;
const T0 = Date.UTC(2026, 9, 21, 8, 0, 0);
function stand(o: Partial<KontoStand> = {}): KontoStand {
  return {
    kid: 'k1', email: 'maria.schmidt@jakobsmedien.com', name: 'Maria Schmidt', art: 'google', stufe: 'kollege', tools: [],
    events: [], zoom: true, zoomBis: null, jm: true, plattform: 'win', gid: 'g1', iat: T0 - TAG, exp: T0 + 29 * TAG,
    kontoBis: null, angemeldetSeit: T0 - 40 * TAG, ...o,
  };
}
const ALT: GespeicherteSitzung = { token: 'jm1.test.alt', stand: stand() };
const NEU: GespeicherteSitzung = { token: 'jm1.test.neu', stand: stand({ iat: T0, exp: T0 + 30 * TAG }) };

/** `spaeter`: die Uhr steht bei dieser Antwort auf der genannten Zeit (eine Antwort, die erst nach exp ankommt; Nachfix 2). */
type Antwort = { ok: GespeicherteSitzung } | { code: KontoFehler['code']; spaeter?: number } | { haengt: true };
interface Offen { aufloesen(a: Antwort): void }

/** Umgebung mit Attrappen; `antworten` bedient sitzungErneuern der Reihe nach, `ich` die Lage. */
function umgebung(o: {
  gespeichert?: GespeicherteSitzung | null | 'unlesbar'; entzug?: { grund: 'gesperrt' | 'geloescht' | 'zugang-abgelaufen' | 'geraet-unbekannt'; am: number } | null;
  geraet?: boolean; antworten?: Antwort[]; ich?: Array<Awaited<ReturnType<KontoClient['ich']>> | { code: KontoFehler['code'] }>;
  ersteAnmeldung?: number | null | 'fehlt'; dev?: string[]; abmeldenWirft?: boolean;
} = {}) {
  const u0 = {
    zeit: T0,
    gespeichert: (o.gespeichert === undefined ? null : o.gespeichert) as GespeicherteSitzung | null | 'unlesbar',
    entzug: o.entzug ?? null,
    speichervorgaenge: 0,
    erneuern: [] as Array<{ token: string; version: string; rechnerName: string; beweisZweck: string; bezug: string }>,
    ichAufrufe: 0,
    abmeldenAufrufe: [] as string[],
    beweise: 0,
    gemeldet: [] as KontoAnsicht[],
    wecker: [] as Array<{ ms: number; fn: () => void; aktiv: boolean }>,
    nachAnmeldung: [] as Array<{ s: GespeicherteSitzung; erste: boolean }>,
    nachStartPruefung: [] as string[],
    nachAbmelden: 0,
    offen: [] as Offen[],
  };
  const antworten = [...(o.antworten ?? [])];
  const ich = [...(o.ich ?? [])];
  const geraet: GeraetHandle = {
    gid: 'g1',
    publicJwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
    async beweis(zweck, bezug, jetzt) { u0.beweise++; return { gid: 'g1', ts: jetzt, sig: `sig|${zweck}|${bezug}` }; },
  };
  const client = {
    async sitzungErneuern(token: string, beweis: { sig: string }, version: string, rechnerName: string) {
      const [, zweck, bezug] = beweis.sig.split('|');
      u0.erneuern.push({ token, version, rechnerName, beweisZweck: zweck, bezug });
      const a = antworten.shift() ?? { code: 'netz' };
      if ('code' in a && a.spaeter !== undefined) u0.zeit = a.spaeter;
      const erledige = (x: Antwort): { sitzung: string; stand: KontoStand } => {
        if ('ok' in x) return { sitzung: x.ok.token, stand: x.ok.stand };
        if ('code' in x) throw new KontoFehler(x.code, null);
        throw new Error('haengt');
      };
      if ('haengt' in a) {
        return new Promise<{ sitzung: string; stand: KontoStand }>((ja, nein) => {
          u0.offen.push({ aufloesen: (x) => { try { ja(erledige(x)); } catch (e) { nein(e); } } });
        });
      }
      return erledige(a);
    },
    async ich() {
      u0.ichAufrufe++;
      const a = ich.shift() ?? { code: 'netz' };
      if ('code' in a) throw new KontoFehler(a.code, null);
      return a;
    },
    async abmelden(token: string) {
      u0.abmeldenAufrufe.push(token);
      if (o.abmeldenWirft) throw new KontoFehler('netz', null);
    },
  } as unknown as KontoClient;
  const umg: SitzungsUmgebung = {
    jetzt: () => u0.zeit,
    client,
    geraet: o.geraet === false ? null : geraet,
    speicher: {
      lade: () => u0.gespeichert,
      speichere: (s) => { u0.speichervorgaenge++; u0.gespeichert = s; },
      ladeEntzug: () => u0.entzug,
      merkeEntzug: (e) => { u0.entzug = e; },
    },
    version: '0.18.0',
    rechnerName: 'PC-Regie',
    plattform: 'win',
    devVariablen: o.dev ?? [],
    wecker: (ms, fn) => {
      const w = { ms, fn, aktiv: true };
      u0.wecker.push(w);
      return () => { w.aktiv = false; };
    },
    melde: (a) => { u0.gemeldet.push(a); },
    nachAnmeldung: (s, erste) => { u0.nachAnmeldung.push({ s, erste }); },
    nachStartPruefung: (t) => { u0.nachStartPruefung.push(t); },
    nachAbmelden: () => { u0.nachAbmelden++; },
    ...(o.ersteAnmeldung === 'fehlt' || o.ersteAnmeldung === undefined ? {} : { ersteAnmeldung: () => o.ersteAnmeldung as number | null }),
  };
  const t = erzeugeSitzungsTreiber(umg);
  return Object.assign(u0, { t, umg });
}
/** Alle Mikro- und Makroaufgaben abwarten (Beweis, Antwort, Folgeschritte). */
async function ruhe(): Promise<void> {
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
}
/** Den einzigen aktiven Wecker auslösen; liefert seine Zeit. */
async function feuere(u: { wecker: Array<{ ms: number; fn: () => void; aktiv: boolean }> }): Promise<number | null> {
  const aktiv = u.wecker.filter((w) => w.aktiv);
  if (aktiv.length !== 1) return null;
  aktiv[0].aktiv = false;
  aktiv[0].fn();
  await ruhe();
  return aktiv[0].ms;
}
const angemeldet = async (antworten: Antwort[] = [{ ok: NEU }], o: Parameters<typeof umgebung>[0] = {}) => {
  const u = umgebung({ gespeichert: ALT, ...o, antworten });
  u.t.start();
  await ruhe();
  return u;
};

// --- P10 6.1: Start als Kreuzprodukt (R1–R5) ------------------------------------------------------------------------
{
  const GESPEICHERT = ['keine', 'keine+entzug', 'unlesbar', 'gueltig', 'abgelaufen-30', 'abgelaufen-bis'] as const;
  const ANTWORTEN = ['ok', 'netz', 'server', 'zu-viele', 'nicht-eingerichtet', 'uhr', 'gesperrt', 'geloescht', 'zugang-abgelaufen',
    'geraet-unbekannt', 'sitzung-abgelaufen', 'nicht-angemeldet'] as const;
  const faelle = kreuz({ g: GESPEICHERT, a: ANTWORTEN, schluessel: [true, false] });
  const ergebnisse: Array<{ f: (typeof faelle)[number]; ist: string; soll: string }> = [];
  for (const f of faelle) {
    const abgelaufen30 = { token: 'jm1.test.alt', stand: stand({ exp: T0 - 1 }) };
    // „Zugang bis“ erreicht, die 30 Tage der Sitzung noch nicht (Spec 6.1, 6.3: der Start gilt nicht mehr, R4).
    const abgelaufenBis = { token: 'jm1.test.alt', stand: stand({ stufe: 'externer', exp: T0 + 20 * TAG, kontoBis: T0 }) };
    const gesp = f.g === 'gueltig' ? ALT : f.g === 'unlesbar' ? 'unlesbar' : f.g === 'abgelaufen-30' ? abgelaufen30
      : f.g === 'abgelaufen-bis' ? abgelaufenBis : null;
    const u = umgebung({
      gespeichert: gesp, entzug: f.g === 'keine+entzug' ? { grund: 'gesperrt', am: T0 - TAG } : null, geraet: f.schluessel,
      antworten: [f.a === 'ok' ? { ok: NEU } : { code: f.a }],
    });
    u.t.start();
    await ruhe();
    const a = u.t.ansicht();
    const gespeichertNach = u.gespeichert === null ? 'leer' : u.gespeichert === 'unlesbar' ? 'unlesbar' : u.gespeichert.token;
    const ist = [a.zustand, a.grund, a.gueltigBis, u.t.token(), gespeichertNach, u.entzug?.grund ?? '-', u.erneuern.length,
      a.hinweise.join('+') || '-', u.wecker.filter((w) => w.aktiv).map((w) => w.ms).join('+') || '-'].join(' ');
    let soll: Array<string | number | null>;
    if (!f.schluessel) soll = ['kein-schluesselspeicher', null, null, null, f.g === 'gueltig' ? 'jm1.test.alt' : f.g === 'unlesbar' ? 'unlesbar' : f.g.startsWith('abgelaufen') ? 'jm1.test.alt' : 'leer', f.g === 'keine+entzug' ? 'gesperrt' : '-', 0, '-', '-'];
    else if (f.g === 'keine') soll = ['nicht-angemeldet', null, null, null, 'leer', '-', 0, '-', '-'];
    else if (f.g === 'keine+entzug') soll = ['entzogen', 'gesperrt', null, null, 'leer', 'gesperrt', 0, '-', '-'];
    else if (f.g === 'unlesbar') soll = ['nicht-angemeldet', null, null, null, 'leer', '-', 0, 'sitzung-unlesbar', '-'];
    else if (f.g === 'abgelaufen-30') soll = ['abgelaufen', 'dreissig-tage', T0 - 1, null, 'leer', '-', 0, '-', '-'];
    else if (f.g === 'abgelaufen-bis') soll = ['abgelaufen', 'zugang-bis', T0, null, 'leer', '-', 0, '-', '-'];
    // EP29: nach der Prüfung steht der Wecker der Neuprüfung (24 h vor exp, höchstens 24 h je Wecker).
    else if (f.a === 'ok') soll = ['angemeldet', null, NEU.stand.exp, 'jm1.test.neu', 'jm1.test.neu', '-', 1, '-', WECKER_MAX_MS];
    else if (f.a === 'netz') soll = ['offline', null, ALT.stand.exp, 'jm1.test.alt', 'jm1.test.alt', '-', 1, '-', 30_000];
    // EP30, EP31: Server antwortet, Prüfung scheitert an seiner Einrichtung oder an der Uhr → Grund, nichts gelöscht, kein Entzug.
    else if (f.a === 'server' || f.a === 'zu-viele' || f.a === 'nicht-eingerichtet' || f.a === 'uhr') soll = ['server-nicht-erreichbar', f.a === 'nicht-eingerichtet' || f.a === 'uhr' ? f.a : null, ALT.stand.exp, 'jm1.test.alt', 'jm1.test.alt', '-', 1, '-', 30_000];
    else if (f.a === 'sitzung-abgelaufen') soll = ['abgelaufen', 'dreissig-tage', ALT.stand.exp, null, 'leer', '-', 1, '-', '-'];
    else if (f.a === 'nicht-angemeldet') soll = ['nicht-angemeldet', null, null, null, 'leer', '-', 1, 'sitzung-unlesbar', '-'];
    else soll = ['entzogen', f.a, null, null, 'leer', f.a, 1, '-', '-'];
    ergebnisse.push({ f, ist, soll: soll.join(' ') });
  }
  const r = pruefeFaelle('P10 6.1: Start (gespeichert × Antwort der Prüfung × Schlüsselspeicher) → Zustand, Grund, gültig bis, token, Platte, Entzug, Anfragen, Hinweis, Wecker',
    ergebnisse, (e) => (e.ist === e.soll ? null : `${e.f.g}/${e.f.a}/${e.f.schluessel ? 'mit' : 'ohne'}: ist ${e.ist}, soll ${e.soll}`));
  ck(r.name, r.ok);
}

// --- P10 R5: die erste Ansicht entsteht vor jeder Netzantwort ---------------------------------------------------------
{
  const u = umgebung({ gespeichert: ALT, antworten: [{ haengt: true }] });
  u.t.start();
  const sofort = [...u.gemeldet];
  const tokenSofort = u.t.token();
  await ruhe();
  const waehrend = u.gemeldet.length;
  u.offen[0]?.aufloesen({ ok: NEU });
  await ruhe();
  ck('P10 R5: erste Ansicht sofort „pruefe“ mit Stand und gültigem Token, die Antwort kommt danach (Start wartet nie auf den Server)',
    sofort.length === 1 && sofort[0].zustand === 'pruefe' && sofort[0].stand?.kid === 'k1' && sofort[0].gueltigBis === ALT.stand.exp
    && tokenSofort === 'jm1.test.alt' && waehrend === 1 && u.t.ansicht().zustand === 'angemeldet' && u.gemeldet.length === 2
    && u.erneuern[0]?.beweisZweck === 'erneuern' && u.erneuern[0]?.bezug === 'k1' && u.erneuern[0]?.version === '0.18.0'
    && u.erneuern[0]?.rechnerName === 'PC-Regie' && JSON.stringify(u.nachStartPruefung) === JSON.stringify(['jm1.test.neu']));
}

// --- P10 R5: nachgeholte Prüfung entzieht nur bis zum Neustart --------------------------------------------------------
{
  const u = await angemeldet([{ code: 'netz' }, { code: 'gesperrt' }]);
  const vorher = u.t.ansicht().zustand;
  const ms = await feuere(u);
  const a = u.t.ansicht();
  const tokenLaeuft = u.t.token();
  const bedarf = await u.t.sitzungFuerBedarf();
  // Neustart: neuer Treiber mit derselben Platte.
  const neu = umgebung({ gespeichert: u.gespeichert, entzug: u.entzug });
  neu.t.start();
  await ruhe();
  ck('P10 R5: offline, dann nachgeholte Prüfung „gesperrt“ → entzogen-laeuft (Sitzung bis zum Neustart), nach dem Neustart entzogen',
    vorher === 'offline' && ms === 30_000 && a.zustand === 'entzogen-laeuft' && a.grund === 'gesperrt' && a.stand?.kid === 'k1'
    && tokenLaeuft === 'jm1.test.alt' && bedarf === 'jm1.test.alt' && u.gespeichert === null && u.entzug?.grund === 'gesperrt'
    && neu.t.ansicht().zustand === 'entzogen' && neu.t.ansicht().grund === 'gesperrt' && neu.erneuern.length === 0);
}

// --- P10 R5: Wiederholung 30 s, verdoppelt bis 5 min ------------------------------------------------------------------
{
  const u = await angemeldet([{ code: 'netz' }, { code: 'server' }, { code: 'netz' }, { code: 'zu-viele' }, { code: 'netz' }, { code: 'netz' }, { ok: NEU }]);
  const zeiten: Array<number | null> = [];
  const zustaende: string[] = [u.t.ansicht().zustand];
  for (let i = 0; i < 6; i++) {
    zeiten.push(await feuere(u));
    zustaende.push(u.t.ansicht().zustand);
  }
  const danach = u.wecker.filter((w) => w.aktiv).map((w) => w.ms).join('+');
  // Läuft die Sitzung während offline ab, endet die Wiederholung ohne Anfrage.
  const v = await angemeldet([{ code: 'netz' }]);
  v.zeit = ALT.stand.exp;
  await feuere(v);
  ck(`P10 R5: Wiederholung nach ${zeiten.map((z) => (z === null ? '–' : `${z / 1000} s`)).join(', ')}, Erfolg beendet sie (danach nur der Wecker der Neuprüfung); Ablauf während offline → abgelaufen ohne Anfrage`,
    JSON.stringify(zeiten) === JSON.stringify([30_000, 60_000, 120_000, 240_000, 300_000, 300_000])
    && zustaende.join(',') === 'offline,server-nicht-erreichbar,offline,server-nicht-erreichbar,offline,offline,angemeldet'
    && danach === String(WECKER_MAX_MS) && u.t.token() === 'jm1.test.neu' && JSON.stringify(u.nachStartPruefung) === JSON.stringify(['jm1.test.neu'])
    && v.t.ansicht().zustand === 'abgelaufen' && v.t.ansicht().grund === 'dreissig-tage' && v.erneuern.length === 1);
}

// --- P10 6.3, R8: Entzug bei laufender Sitzung ------------------------------------------------------------------------
{
  const u = await angemeldet([{ ok: NEU }]);
  await u.t.lage();
  const unveraendert = u.t.ansicht().zustand;
  (u.umg.client as unknown as { ich: () => Promise<unknown> }).ich = async () => ({ kontoAktiv: false, grund: 'geloescht', zoomAnfrage: null, adminOffen: 0 });
  await u.t.lage();
  const a = u.t.ansicht();
  ck('P10 6.3: Lage „Zugang nicht mehr aktiv“ → entzogen-laeuft: Sitzung läuft bis zum Neustart weiter, Platte leer, Entzug gemerkt (R8)',
    unveraendert === 'angemeldet' && a.zustand === 'entzogen-laeuft' && a.grund === 'geloescht' && u.t.token() === 'jm1.test.neu'
    && u.gespeichert === null && u.entzug?.grund === 'geloescht' && a.stand?.kid === 'k1');
}
{
  const anfrage: ZoomAnfrageStand = { id: 'z1', zustand: 'offen', zweck: 'Messe', von: T0, bis: T0 + TAG, am: T0 };
  const kollege = await angemeldet([{ ok: NEU }], { ich: [{ kontoAktiv: true, grund: null, zoomAnfrage: anfrage, adminOffen: 4 }] });
  await kollege.t.lage();
  const admin = await angemeldet([{ ok: { token: 'jm1.test.admin', stand: stand({ stufe: 'admin', exp: T0 + 30 * TAG }) } }],
    { ich: [{ kontoAktiv: true, grund: null, zoomAnfrage: null, adminOffen: 4 }, { code: 'netz' }, { kontoAktiv: true, grund: null, zoomAnfrage: null, adminOffen: 0 }] });
  await admin.t.lage();
  const vorNetz = JSON.stringify(admin.t.ansicht());
  await admin.t.lage();
  const nachNetz = JSON.stringify(admin.t.ansicht());
  // Ein Admin hat die Anfragen bearbeitet: der Punkt am Zahnrad geht wieder weg (robust:1).
  await admin.t.lage();
  const nachEntscheidung = admin.t.ansicht().adminOffen;
  const offline = await angemeldet([{ code: 'netz' }, { ok: NEU }], { ich: [{ kontoAktiv: true, grund: null, zoomAnfrage: null, adminOffen: 0 }] });
  await offline.t.lage();
  await ruhe();
  const entzogenOhneLage = await angemeldet([{ code: 'gesperrt' }]);
  await entzogenOhneLage.t.lage();
  ck('P10 R8: Lage übernimmt Zoom-Anfrage, adminOffen nur für Admins und auch nach unten (4 → 0); Netzfehler ändern nichts; offline + Antwort → Prüfung sofort nachgeholt; ohne Sitzung keine Lage',
    kollege.t.ansicht().zoomAnfrage?.id === 'z1' && kollege.t.ansicht().adminOffen === 0 && JSON.parse(vorNetz).adminOffen === 4
    && nachNetz === vorNetz && nachEntscheidung === 0 && admin.ichAufrufe === 3
    && offline.t.ansicht().zustand === 'angemeldet' && offline.erneuern.length === 2
    && offline.wecker.filter((w) => w.aktiv).map((w) => w.ms).join('+') === String(WECKER_MAX_MS)
    && entzogenOhneLage.ichAufrufe === 0);
}

// --- P10 R7: Bedarf kurz vor exp; nach exp keine Anfrage mehr (der Worker erneuert nur gültige Sitzungen, 10.1) ----------
{
  const exp = NEU.stand.exp;
  async function fall(jetzt: number, antwort: Antwort | null): Promise<{ wert: string | null; zustand: string; grund: string | null; anfragen: number; platte: string }> {
    const u = await angemeldet([{ ok: NEU }, ...(antwort ? [antwort] : [])]);
    u.zeit = jetzt;
    const wert = await u.t.sitzungFuerBedarf();
    const a = u.t.ansicht();
    const platte = u.gespeichert === null ? 'leer' : u.gespeichert === 'unlesbar' ? 'unlesbar' : u.gespeichert.token;
    return { wert, zustand: a.zustand, grund: a.grund, anfragen: u.erneuern.length - 1, platte };
  }
  const NEU2: GespeicherteSitzung = { token: 'jm1.test.neu2', stand: stand({ iat: exp - 30_000, exp: exp + 30 * TAG }) };
  const faelle: Array<[string, Awaited<ReturnType<typeof fall>>, string]> = [
    ['2 min vor exp, keine Anfrage', await fall(exp - 120_000, null), 'jm1.test.neu angemeldet - 0 jm1.test.neu'],
    ['30 s vor exp, Erneuerung ok', await fall(exp - 30_000, { ok: NEU2 }), 'jm1.test.neu2 angemeldet - 1 jm1.test.neu2'],
    ['30 s vor exp, netz', await fall(exp - 30_000, { code: 'netz' }), 'jm1.test.neu angemeldet - 1 jm1.test.neu'],
    ['30 s vor exp, uhr (EP30: kein Entzug, Grund wie beim Start)', await fall(exp - 30_000, { code: 'uhr' }), 'jm1.test.neu server-nicht-erreichbar uhr 1 jm1.test.neu'],
    ['30 s vor exp, gesperrt', await fall(exp - 30_000, { code: 'gesperrt' }), 'jm1.test.neu entzogen-laeuft gesperrt 1 leer'],
    ['30 s vor exp, sitzung-abgelaufen', await fall(exp - 30_000, { code: 'sitzung-abgelaufen' }), '- abgelaufen dreissig-tage 1 leer'],
    // Nach exp lehnt der echte Worker jede Erneuerung ab (401 sitzung-abgelaufen, 10.1): keine Anfrage, die Sitzung ist zu Ende.
    ['nach exp (Wecker kam zu spät), keine Anfrage', await fall(exp + 1000, { ok: NEU2 }), '- abgelaufen dreissig-tage 0 leer'],
  ];
  const zwei = await angemeldet([{ ok: NEU }, { haengt: true }]);
  zwei.zeit = exp - 30_000;
  const p1 = zwei.t.sitzungFuerBedarf();
  const p2 = zwei.t.sitzungFuerBedarf();
  await ruhe();
  zwei.offen[0]?.aufloesen({ ok: NEU2 });
  const beide = await Promise.all([p1, p2]);
  const r = pruefeFaelle('P10 R7: sitzungFuerBedarf erneuert ab 60 s vor exp (Netz und Uhr behalten die Sitzung, Entzug läuft weiter); nach exp keine Anfrage',
    faelle, ([name, ist, soll]) => {
      const t = `${ist.wert ?? '-'} ${ist.zustand} ${ist.grund ?? '-'} ${ist.anfragen} ${ist.platte}`;
      return t === soll ? null : `${name}: ist ${t}, soll ${soll}`;
    });
  ck(r.name, r.ok);
  ck('P10 R7: zwei gleichzeitige Bedarfe erneuern nur einmal',
    beide[0] === 'jm1.test.neu2' && beide[1] === 'jm1.test.neu2' && zwei.erneuern.length === 2);
}

// --- P10 6.1, EP29: Obergrenze 30 Tage = Neuprüfung im Hintergrund, nicht Neuanmeldung (spec:2, robust:2) ---------------
// Nachfix 1: Fehlschläge der Neuprüfung zeigen ihren Grund wie beim Start (EP30, EP31, R3); lehnt der Worker sie ab, weil die
// letzte Anmeldung mit Google 90 Tage oder länger her ist (OFP8), läuft die Sitzung wie nach einem Entzug bis exp weiter (K25o).
{
  const exp = NEU.stand.exp;
  const faellig = exp - NEUPRUEFUNG_VORLAUF_MS;
  const NEU2: GespeicherteSitzung = { token: 'jm1.test.neu2', stand: stand({ iat: faellig, exp: faellig + 30 * TAG }) };
  // Letzte Anmeldung mit Google genau 90 Tage vor der Neuprüfung (OFP8), ein E-Mail-Zugang ebenso alt, und eine gespeicherte
  // Sitzung, deren Google-Anmeldung beim Start 90 Tage her ist (nachgeholte Prüfung nach offline).
  const NEU_G: GespeicherteSitzung = { token: 'jm1.test.neu', stand: stand({ iat: T0, exp, angemeldetSeit: faellig - GOOGLE_NEU_MS }) };
  const NEU_P: GespeicherteSitzung = { token: 'jm1.test.neu', stand: stand({ iat: T0, exp, art: 'passwort', stufe: 'externer', kontoBis: exp + 30 * TAG, angemeldetSeit: faellig - GOOGLE_NEU_MS }) };
  const ALT_G: GespeicherteSitzung = { token: 'jm1.test.alt', stand: stand({ angemeldetSeit: T0 - GOOGLE_NEU_MS }) };
  // Eine gespeicherte Sitzung, die 10 s nach dem Start endet (Nachfix 2: Wiederholung beim Start höchstens bis exp).
  const KURZ: GespeicherteSitzung = { token: 'jm1.test.alt', stand: stand({ exp: T0 + 10_000 }) };
  const ENTZUG = [{ kontoAktiv: false, grund: 'gesperrt' as const, zoomAnfrage: null, adminOffen: 0 }];
  const alleWecker: number[] = [];
  /**
   * Angemeldet (Start-Antwort `start.antwort`, sonst NEU), dann je Schritt die Uhr stellen und den einen Wecker auslösen bzw. bei
   * `{ bedarf }` eine Sitzung für einen Abruf holen (ein Schritt ohne Wecker: „kein Wecker“).
   */
  async function lauf(antworten: Antwort[], schritte: Array<number | { bedarf: number }>, ich: NonNullable<Parameters<typeof umgebung>[0]>['ich'] = [],
    start: { gespeichert?: GespeicherteSitzung; antwort?: Antwort } = {}) {
    const u = await angemeldet([start.antwort ?? { ok: NEU }, ...antworten], { ich, ...(start.gespeichert ? { gespeichert: start.gespeichert } : {}) });
    if (ich.length) await u.t.lage();
    for (const schritt of schritte) {
      if (typeof schritt !== 'number') {
        u.zeit = schritt.bedarf;
        await u.t.sitzungFuerBedarf();
        await ruhe();
        continue;
      }
      u.zeit = schritt;
      if ((await feuere(u)) === null) return { u, text: 'kein Wecker' };
    }
    for (const w of u.wecker) alleWecker.push(w.ms);
    const a = u.t.ansicht();
    const platte = u.gespeichert === null ? 'leer' : u.gespeichert === 'unlesbar' ? 'unlesbar' : u.gespeichert.token;
    const wecker = u.wecker.filter((w) => w.aktiv).map((w) => w.ms).join('+') || '-';
    return { u, text: `${a.zustand} ${a.grund ?? '-'} ${u.t.token() ?? '-'} ${platte} Anfragen ${u.erneuern.length - 1} Wecker ${wecker} Hinweis ${a.hinweise.join('+') || '-'}` };
  }
  const faelle: Array<[string, Awaited<ReturnType<typeof lauf>>, string]> = [
    ['zu früh geweckt (Wecker höchstens 24 h): neu gestellt, keine Anfrage', await lauf([], [T0 + TAG]),
      `angemeldet - jm1.test.neu jm1.test.neu Anfragen 0 Wecker ${WECKER_MAX_MS} Hinweis -`],
    ['24 h vor exp, Erneuerung ok: neue Sitzung, Wecker für die nächste Neuprüfung', await lauf([{ ok: NEU2 }], [faellig]),
      `angemeldet - jm1.test.neu2 jm1.test.neu2 Anfragen 1 Wecker ${WECKER_MAX_MS} Hinweis -`],
    ['24 h vor exp, netz: Sitzung bleibt, Wiederholung nach 30 s', await lauf([{ code: 'netz' }], [faellig]),
      'angemeldet - jm1.test.neu jm1.test.neu Anfragen 1 Wecker 30000 Hinweis -'],
    ['24 h vor exp, uhr (EP30): Grund wie beim Start (K13b, K25n), Sitzung bleibt, Wiederholung, kein Entzug', await lauf([{ code: 'uhr' }], [faellig]),
      'server-nicht-erreichbar uhr jm1.test.neu jm1.test.neu Anfragen 1 Wecker 30000 Hinweis -'],
    ['24 h vor exp, nicht-eingerichtet (EP31): Grund wie beim Start (K13a, K25m), Sitzung bleibt, Wiederholung', await lauf([{ code: 'nicht-eingerichtet' }], [faellig]),
      'server-nicht-erreichbar nicht-eingerichtet jm1.test.neu jm1.test.neu Anfragen 1 Wecker 30000 Hinweis -'],
    ['uhr, nach 30 s ok: wieder angemeldet ohne Grund, Wecker für die nächste Neuprüfung', await lauf([{ code: 'uhr' }, { ok: NEU2 }], [faellig, faellig + 30_000]),
      `angemeldet - jm1.test.neu2 jm1.test.neu2 Anfragen 2 Wecker ${WECKER_MAX_MS} Hinweis -`],
    ['uhr bis exp: abgelaufen ohne weitere Anfrage (K25c; den Grund nennt K55 beim neuen Anmelden)', await lauf([{ code: 'uhr' }], [faellig, exp]),
      'abgelaufen dreissig-tage - leer Anfragen 1 Wecker - Hinweis -'],
    ['24 h vor exp, nicht-angemeldet (neuer Schlüssel am Server): wie R3, Hinweis K25i', await lauf([{ code: 'nicht-angemeldet' }], [faellig]),
      'nicht-angemeldet - - leer Anfragen 1 Wecker - Hinweis sitzung-unlesbar'],
    ['netz, dann netz nach 30 s: Wiederholung nach 60 s', await lauf([{ code: 'netz' }, { code: 'netz' }], [faellig, faellig + 30_000]),
      'angemeldet - jm1.test.neu jm1.test.neu Anfragen 2 Wecker 60000 Hinweis -'],
    ['netz bis exp: abgelaufen ohne weitere Anfrage, Platte leer', await lauf([{ code: 'netz' }], [faellig, exp]),
      'abgelaufen dreissig-tage - leer Anfragen 1 Wecker - Hinweis -'],
    ['24 h vor exp, gesperrt: entzogen-laeuft bis exp, dann entzogen', await lauf([{ code: 'gesperrt' }], [faellig, exp]),
      'entzogen gesperrt - leer Anfragen 1 Wecker - Hinweis -'],
    ['Lage entzieht: entzogen-laeuft, Wecker auf exp, dann entzogen', await lauf([], [T0 + TAG, exp], ENTZUG),
      'entzogen gesperrt - leer Anfragen 0 Wecker - Hinweis -'],
    ['Rechner schlief über exp (Wecker kommt 1 h zu spät): abgelaufen ohne Anfrage', await lauf([{ ok: NEU2 }], [exp + 3600_000]),
      'abgelaufen dreissig-tage - leer Anfragen 0 Wecker - Hinweis -'],
    ['24 h vor exp, Google 90 Tage (OFP8): Sitzung läuft bis exp mit Grund google-neu (K25o), keine weitere Neuprüfung', await lauf([{ code: 'sitzung-abgelaufen' }], [faellig], [], { antwort: { ok: NEU_G } }),
      `angemeldet google-neu jm1.test.neu jm1.test.neu Anfragen 1 Wecker ${WECKER_MAX_MS} Hinweis -`],
    ['Google 90 Tage, dann exp: abgelaufen mit Grund google-neu (K25k), ohne weitere Anfrage', await lauf([{ code: 'sitzung-abgelaufen' }], [faellig, exp], [], { antwort: { ok: NEU_G } }),
      'abgelaufen google-neu - leer Anfragen 1 Wecker - Hinweis -'],
    ['E-Mail-Zugang, sitzung-abgelaufen 24 h vor exp: abgelaufen (kein Google-Konto)', await lauf([{ code: 'sitzung-abgelaufen' }], [faellig], [], { antwort: { ok: NEU_P } }),
      'abgelaufen dreissig-tage - leer Anfragen 1 Wecker - Hinweis -'],
    ['offline beim Start, nachgeholte Prüfung nach 30 s: Google 90 Tage (OFP8) → wie im Betrieb bis exp', await lauf([{ code: 'sitzung-abgelaufen' }], [T0 + 30_000], [], { gespeichert: ALT_G, antwort: { code: 'netz' } }),
      `angemeldet google-neu jm1.test.alt jm1.test.alt Anfragen 1 Wecker ${WECKER_MAX_MS} Hinweis -`],
    ['Lage entzieht, Bedarf 30 s vor exp, Google 90 Tage: der Entzug bleibt bis exp', await lauf([{ code: 'sitzung-abgelaufen' }], [{ bedarf: exp - 30_000 }], ENTZUG, { antwort: { ok: NEU_G } }),
      `entzogen-laeuft gesperrt jm1.test.neu leer Anfragen 1 Wecker ${WECKER_MAX_MS} Hinweis -`],
    ['Lage entzieht, Bedarf 30 s vor exp, uhr: der Entzug bleibt bis exp', await lauf([{ code: 'uhr' }], [{ bedarf: exp - 30_000 }], ENTZUG),
      `entzogen-laeuft gesperrt jm1.test.neu leer Anfragen 1 Wecker ${WECKER_MAX_MS} Hinweis -`],
    // Nachfix 2 (R7, EP36): Kennt der Server die Sitzung nicht mehr oder hält er sie für abgelaufen, endet sie wie bei exp; der
    // Entzug bleibt sichtbar (K7 statt K1 mit K25i bzw. K6 mit K25c), und es gibt kein Token mehr, das jede Route ablehnt.
    ['Lage entzieht, Bedarf 30 s vor exp, nicht-angemeldet (EP36): endet wie bei exp, der Entzug bleibt', await lauf([{ code: 'nicht-angemeldet' }], [{ bedarf: exp - 30_000 }], ENTZUG),
      'entzogen gesperrt - leer Anfragen 1 Wecker - Hinweis -'],
    ['Lage entzieht, Bedarf 30 s vor exp, sitzung-abgelaufen ohne OFP8 (EP36): endet wie bei exp, der Entzug bleibt', await lauf([{ code: 'sitzung-abgelaufen' }], [{ bedarf: exp - 30_000 }], ENTZUG),
      'entzogen gesperrt - leer Anfragen 1 Wecker - Hinweis -'],
    ['Lage entzieht, Bedarf 10 s vor exp, die Antwort (netz) kommt erst nach exp: entzogen, nicht abgelaufen', await lauf([{ code: 'netz', spaeter: exp + 5000 }], [{ bedarf: exp - 10_000 }], ENTZUG),
      'entzogen gesperrt - leer Anfragen 1 Wecker - Hinweis -'],
    // Nachfix 2 (R5, EP29): Die Wiederholung endet spätestens bei exp, im Betrieb wie beim Start; danach verlässt die Ansicht den
    // gültigen Zustand ohne Anfrage.
    ['uhr, Wiederholung 10 s vor exp (Rechner schlief): der Wecker steht höchstens bis exp', await lauf([{ code: 'uhr' }, { code: 'uhr' }], [faellig, exp - 10_000]),
      'server-nicht-erreichbar uhr jm1.test.neu jm1.test.neu Anfragen 2 Wecker 10000 Hinweis -'],
    ['uhr, Wiederholung 10 s vor exp, dann exp: abgelaufen ohne weitere Anfrage', await lauf([{ code: 'uhr' }, { code: 'uhr' }], [faellig, exp - 10_000, exp]),
      'abgelaufen dreissig-tage - leer Anfragen 2 Wecker - Hinweis -'],
    ['offline beim Start 10 s vor exp (R5): der Wecker der Wiederholung steht höchstens bis exp', await lauf([], [], [], { gespeichert: KURZ, antwort: { code: 'netz' } }),
      'offline - jm1.test.alt jm1.test.alt Anfragen 0 Wecker 10000 Hinweis -'],
  ];
  const r = pruefeFaelle('P10 6.1, EP29: Obergrenze 30 Tage — ab 24 h vor exp prüft der Treiber im Hintergrund neu, mit Wiederholung; erreicht die Sitzung exp, verlässt die Ansicht „angemeldet“ ohne Anfrage; Fehlschläge mit Grund wie beim Start, Google 90 Tage und Entzug laufen bis exp',
    faelle, ([name, ist, soll]) => (ist.text === soll ? null : `${name}: ist ${ist.text}, soll ${soll}`));
  ck(r.name, r.ok);
  ck(`P10 EP29: kein Wecker länger als 24 h (setTimeout trägt höchstens 2^31 − 1 ms), längster gestellt: ${Math.max(...alleWecker) / 3600_000} h`,
    alleWecker.length > 0 && Math.max(...alleWecker) <= WECKER_MAX_MS && WECKER_MAX_MS < 2 ** 31 && NEUPRUEFUNG_VORLAUF_MS === TAG);
}

// --- P10 R10: Abmelden ---------------------------------------------------------------------------------------------------
{
  const u = await angemeldet([{ ok: NEU }], { abmeldenWirft: true });
  u.t.merkeAusgabe({ appId: 'jm-qa', zweck: 'qa-relay', ziel: 'evt-1', bis: T0 + 3 * TAG, am: T0 });
  await u.t.abmelden();
  await ruhe();
  const a = u.t.ansicht();
  const spaet = umgebung({ gespeichert: ALT, antworten: [{ haengt: true }] });
  spaet.t.start();
  await spaet.t.abmelden();
  spaet.offen[0]?.aufloesen({ ok: NEU });
  await ruhe();
  ck('P10 R10: Abmelden — sofort nicht angemeldet, Platte leer, nachAbmelden einmal, Worker best effort (auch wenn er scheitert), Ausgaben bleiben; eine späte Antwort setzt nichts zurück',
    a.zustand === 'nicht-angemeldet' && a.stand === null && u.t.token() === null && u.gespeichert === null && u.nachAbmelden === 1
    && JSON.stringify(u.abmeldenAufrufe) === JSON.stringify(['jm1.test.neu']) && a.ausgaben.length === 1
    && spaet.t.ansicht().zustand === 'nicht-angemeldet' && spaet.gespeichert === null && spaet.t.token() === null);
}

// --- P10 G7: vor dem Start nie angemeldet -------------------------------------------------------------------------------
{
  const u = umgebung({ gespeichert: ALT, antworten: [{ haengt: true }] });
  const vorher = u.t.ansicht();
  const tokenVorher = u.t.token();
  u.t.merkeHinweis('geraet-neu');
  const meldungenVorher = u.gemeldet.length;
  const bedarf = await u.t.sitzungFuerBedarf();
  u.t.start();
  ck('P10 G7: vor dem Start „pruefe“ ohne Stand und ohne Token, nichts gemeldet; der Hinweis erscheint mit der ersten Meldung',
    vorher.zustand === 'pruefe' && vorher.stand === null && vorher.gueltigBis === null && tokenVorher === null && bedarf === null
    && meldungenVorher === 0 && u.gemeldet.length === 1 && u.gemeldet[0].hinweise.join(',') === 'geraet-neu');
}

// --- P10 R9: Anmeldung --------------------------------------------------------------------------------------------------
{
  const erst = umgebung({ entzug: { grund: 'gesperrt', am: T0 - TAG }, gespeichert: 'unlesbar', ersteAnmeldung: null });
  erst.t.start();
  erst.t.angemeldet(NEU);
  const a = erst.t.ansicht();
  const zweit = umgebung({ ersteAnmeldung: T0 - 5 * TAG });
  zweit.t.start();
  zweit.t.angemeldet(NEU);
  const ohne = umgebung({ ersteAnmeldung: 'fehlt' });
  ohne.t.start();
  ohne.t.angemeldet(NEU);
  ck('P10 R9: angemeldet() speichert, löscht gemerkten Entzug und Hinweis „unlesbar“, ruft nachAnmeldung genau einmal (erste nur ohne frühere Anmeldung)',
    a.zustand === 'angemeldet' && erst.t.token() === 'jm1.test.neu' && (erst.gespeichert as GespeicherteSitzung).token === 'jm1.test.neu'
    && erst.entzug === null && a.hinweise.length === 0 && erst.nachAnmeldung.length === 1 && erst.nachAnmeldung[0].erste === true
    && zweit.nachAnmeldung.length === 1 && zweit.nachAnmeldung[0].erste === false && ohne.nachAnmeldung[0]?.erste === false);
}

// --- P10 R13, R11, R12 -------------------------------------------------------------------------------------------------
{
  const u = umgebung({ dev: ['JMPS_IVEO_TOKEN', 'geheim-123', 'JMPS_PROXY_KEY', 'PATH'] });
  u.t.start();
  ck('P10 R13: devVariablen nur die vier bekannten Namen, in fester Reihenfolge, nie Werte',
    JSON.stringify(u.t.ansicht().devVariablen) === JSON.stringify(['JMPS_PROXY_KEY', 'JMPS_IVEO_TOKEN']));
}
{
  const u = await angemeldet([{ ok: NEU }]);
  const vor = u.gemeldet.length;
  for (let i = 1; i <= 12; i++) u.t.merkeAusgabe({ appId: 'jm-qa', zweck: 'qa-relay', ziel: `evt-${i}`, bis: T0 + i, am: T0 } as never);
  const a = u.t.ansicht();
  ck('P10 R11: Ausgaben an Tools — die letzten zehn dieses Laufs, nur appId, Zweck, Ziel, bis, am',
    a.ausgaben.length === 10 && a.ausgaben[0].ziel === 'evt-3' && a.ausgaben[9].ziel === 'evt-12'
    && a.ausgaben.every((x) => JSON.stringify(Object.keys(x).sort()) === JSON.stringify(['am', 'appId', 'bis', 'zweck', 'ziel'].sort()))
    && u.gemeldet.length === vor + 12);
  const s = await angemeldet([{ code: 'server' }, { code: 'server' }]);
  const nachErstem = s.gemeldet.length;
  await feuere(s);
  s.t.merkeHinweis('geraet-neu');
  s.t.merkeHinweis('geraet-neu');
  ck('P10 R12: melde genau einmal je geänderter Ansicht (gleiche Ansicht nach zweitem Serverfehler, doppelter Hinweis → keine Meldung)',
    nachErstem === 2 && s.gemeldet.length === 3 && s.gemeldet[2].hinweise.join(',') === 'geraet-neu');
}

// --- P10 OFP8: letzte Anmeldung mit Google 90 Tage oder länger her (Nachbesserung Block A, spec:3) ---------------------
{
  const mit = async (o: Partial<KontoStand>) => {
    const u = umgebung({ gespeichert: { token: 'jm1.test.alt', stand: stand(o) }, antworten: [{ code: 'sitzung-abgelaufen' }] });
    u.t.start();
    await ruhe();
    return u;
  };
  const google = await mit({ angemeldetSeit: T0 - GOOGLE_NEU_MS });
  const jung = await mit({ angemeldetSeit: T0 - GOOGLE_NEU_MS + 1 });
  const passwort = await mit({ art: 'passwort', stufe: 'externer', kontoBis: T0 + 10 * TAG, angemeldetSeit: T0 - GOOGLE_NEU_MS });
  ck('P10 OFP8: Erneuern abgelehnt (sitzung-abgelaufen), letzte Anmeldung mit Google 90 Tage oder länger her → abgelaufen mit Grund google-neu (K25k); jüngere Google-Anmeldung oder E-Mail-Zugang → dreissig-tage; Frist wie im Worker',
    google.t.ansicht().zustand === 'abgelaufen' && google.t.ansicht().grund === 'google-neu' && google.gespeichert === null && google.erneuern.length === 1
    && jung.t.ansicht().grund === 'dreissig-tage' && passwort.t.ansicht().grund === 'dreissig-tage' && GOOGLE_NEU_MS === GOOGLE_NEU_MS_WORKER);
}

// --- P10 Review (AR34a): Speichern ist Nebenwirkung — wirft die Hülle, stehen Zustand und Wecker trotzdem ------------------
{
  let unbehandelt = 0;
  const merke = (): void => { unbehandelt++; };
  process.on('unhandledRejection', merke);
  const werfend = (u: ReturnType<typeof umgebung>): void => {
    u.umg.speicher.speichere = () => { throw new Error('Platte voll'); };
    u.umg.speicher.merkeEntzug = () => { throw new Error('Platte voll'); };
  };
  const text = (u: ReturnType<typeof umgebung>): string => {
    const a = u.t.ansicht();
    return `${a.zustand} ${a.grund ?? '-'} ${u.t.token() ?? '-'} Wecker ${u.wecker.filter((w) => w.aktiv).length} Hinweis ${a.hinweise.join('+') || '-'}`;
  };
  const start = async (gesp: GespeicherteSitzung | 'unlesbar', antwort: Antwort): Promise<string> => {
    const u = umgebung({ gespeichert: gesp, antworten: [antwort] });
    werfend(u);
    u.t.start();
    await ruhe();
    return text(u);
  };
  const KURZ_ALT: GespeicherteSitzung = { token: 'jm1.test.alt', stand: stand({ exp: T0 - 1 }) };
  const faelle: Array<[string, string, string]> = [
    ['Start, Prüfung ok', await start(ALT, { ok: NEU }), 'angemeldet - jm1.test.neu Wecker 1 Hinweis -'],
    ['Start, Entzug (merkeEntzug und speichere werfen)', await start(ALT, { code: 'gesperrt' }), 'entzogen gesperrt - Wecker 0 Hinweis -'],
    ['Start, unlesbar', await start('unlesbar', { code: 'netz' }), 'nicht-angemeldet - - Wecker 0 Hinweis sitzung-unlesbar'],
    ['Start, abgelaufen', await start(KURZ_ALT, { code: 'netz' }), 'abgelaufen dreissig-tage - Wecker 0 Hinweis -'],
    ['Start, nicht-angemeldet vom Server', await start(ALT, { code: 'nicht-angemeldet' }), 'nicht-angemeldet - - Wecker 0 Hinweis sitzung-unlesbar'],
  ];
  const bedarf = umgebung({ gespeichert: ALT, antworten: [{ ok: NEU }, { ok: { token: 'jm1.test.neu2', stand: stand({ iat: NEU.stand.exp - 30_000, exp: NEU.stand.exp + 30 * TAG }) } }] });
  bedarf.t.start();
  await ruhe();
  werfend(bedarf);
  bedarf.zeit = NEU.stand.exp - 30_000;
  const wert = await bedarf.t.sitzungFuerBedarf();
  await ruhe();
  faelle.push(['Bedarf, Erneuerung ok', `${wert} ${text(bedarf)}`, 'jm1.test.neu2 angemeldet - jm1.test.neu2 Wecker 1 Hinweis -']);
  const lageU = await angemeldet([{ ok: NEU }], { ich: [{ kontoAktiv: false, grund: 'gesperrt', zoomAnfrage: null, adminOffen: 0 }] });
  werfend(lageU);
  await lageU.t.lage();
  faelle.push(['Lage entzieht', text(lageU), 'entzogen-laeuft gesperrt jm1.test.neu Wecker 1 Hinweis -']);
  const anm = umgebung();
  werfend(anm);
  anm.t.start();
  anm.t.angemeldet(NEU);
  faelle.push(['angemeldet()', `${text(anm)} nachAnmeldung ${anm.nachAnmeldung.length}`, 'angemeldet - jm1.test.neu Wecker 1 Hinweis - nachAnmeldung 1']);
  await ruhe();
  process.off('unhandledRejection', merke);
  const r = pruefeFaelle('P10 AR34a: wirft der Speicher (Platte voll), stehen Zustand, Token und Wecker richtig und es gibt keine unbehandelte Ablehnung',
    faelle, ([name, ist, soll]) => (ist === soll ? null : `${name}: ist ${ist}, soll ${soll}`));
  ck(r.name, r.ok && unbehandelt === 0);
}

// --- P10 Review (AR34b): eine späte Antwort überschreibt keinen Entzug ----------------------------------------------------
{
  const u = await angemeldet([{ code: 'netz' }, { haengt: true }], { ich: [{ kontoAktiv: false, grund: 'gesperrt', zoomAnfrage: null, adminOffen: 0 }] });
  await feuere(u); // die nachgeholte Prüfung hängt
  await u.t.lage(); // Entzug
  const vorher = u.t.ansicht().zustand;
  u.offen[0]?.aufloesen({ code: 'netz' });
  await ruhe();
  const a = u.t.ansicht();
  const spaetOk = await angemeldet([{ code: 'netz' }, { haengt: true }], { ich: [{ kontoAktiv: false, grund: 'gesperrt', zoomAnfrage: null, adminOffen: 0 }] });
  await feuere(spaetOk);
  await spaetOk.t.lage();
  spaetOk.offen[0]?.aufloesen({ ok: NEU });
  await ruhe();
  ck('P10 Review: späte Antwort (netz bzw. ok) nach dem Entzug durch lage() ändert nichts — entzogen-laeuft bleibt, Platte leer',
    vorher === 'entzogen-laeuft' && a.zustand === 'entzogen-laeuft' && a.grund === 'gesperrt' && u.wecker.filter((w) => w.aktiv).length === 1
    && spaetOk.t.ansicht().zustand === 'entzogen-laeuft' && spaetOk.gespeichert === null && spaetOk.t.token() === 'jm1.test.alt');
}

// --- P10 Review (AR30): Fristen der gespeicherten Sitzung müssen endliche Zahlen sein --------------------------------------
{
  const ungueltig: Array<[string, GespeicherteSitzung]> = [
    ['exp NaN', { token: 'jm1.test.x', stand: stand({ exp: NaN }) }],
    ['exp Infinity', { token: 'jm1.test.x', stand: stand({ exp: Infinity }) }],
    ['exp fehlt', { token: 'jm1.test.x', stand: stand({ exp: undefined as unknown as number }) }],
    ['kontoBis fehlt', { token: 'jm1.test.x', stand: stand({ kontoBis: undefined as unknown as null }) }],
    ['kontoBis "x"', { token: 'jm1.test.x', stand: stand({ kontoBis: 'x' as unknown as number }) }],
    ['kontoBis NaN', { token: 'jm1.test.x', stand: stand({ kontoBis: NaN }) }],
  ];
  const gut: Array<[string, GespeicherteSitzung]> = [
    ['kontoBis null', ALT],
    ['kontoBis Zahl', { token: 'jm1.test.alt', stand: stand({ stufe: 'externer', kontoBis: T0 + 10 * TAG }) }],
  ];
  const faelle: Array<[string, string]> = [];
  for (const [name, g] of [...ungueltig, ...gut]) {
    const u = umgebung({ gespeichert: g, antworten: [{ code: 'server' }, { code: 'server' }] });
    u.t.start();
    await ruhe();
    const a = u.t.ansicht();
    const platte = u.gespeichert === null ? 'leer' : 'da';
    faelle.push([name, `${a.zustand} ${a.hinweise.join('+') || '-'} ${u.t.token() ?? '-'} Platte ${platte} Anfragen ${u.erneuern.length} Wecker ${u.wecker.filter((w) => w.aktiv).map((w) => w.ms).join('+') || '-'}`]);
  }
  const unlesbar = 'nicht-angemeldet sitzung-unlesbar - Platte leer Anfragen 0 Wecker -';
  const r = pruefeFaelle('P10 AR30: exp NaN, Infinity oder fehlend und kontoBis fehlend, Text oder NaN → unlesbar (wie R3), keine Anfrage, kein Wecker; gültige Fristen starten normal',
    faelle, ([name, ist]) => {
      const schlecht = ungueltig.some(([n]) => n === name);
      return (schlecht ? ist === unlesbar : ist.startsWith('server-nicht-erreichbar - jm1.test.')) ? null : `${name}: ist ${ist}`;
    });
  ck(r.name, r.ok);
}

// --- P10 Review: lage() nach exp (Rechner schlief, der Wecker kam nicht) ------------------------------------------------
{
  const entzug = { kontoAktiv: false, grund: 'gesperrt' as const, zoomAnfrage: null, adminOffen: 0 };
  const a = await angemeldet([{ ok: NEU }], { ich: [entzug] });
  await a.t.lage();
  a.zeit = NEU.stand.exp + 3600_000;
  const ichVorher = a.ichAufrufe;
  await a.t.lage();
  const b = await angemeldet([{ ok: NEU }]);
  b.zeit = NEU.stand.exp + 3600_000;
  await b.t.lage();
  ck('P10 Review: lage() nach exp ohne Wecker beendet die Sitzung ohne Anfrage (entzogen-laeuft → entzogen, angemeldet → abgelaufen), kein Token mehr',
    a.t.ansicht().zustand === 'entzogen' && a.t.ansicht().grund === 'gesperrt' && a.t.token() === null && a.ichAufrufe === ichVorher
    && b.t.ansicht().zustand === 'abgelaufen' && b.t.ansicht().grund === 'dreissig-tage' && b.t.token() === null && b.ichAufrufe === 0);
}

// --- P10 Review (G4): kein Token in irgendeiner Meldung ---------------------------------------------------------------------
{
  const codes = ['ok', 'netz', 'server', 'uhr', 'nicht-eingerichtet', 'gesperrt', 'sitzung-abgelaufen', 'nicht-angemeldet'] as const;
  let meldungen = 0;
  let mitToken = 0;
  for (const gesp of [ALT, 'unlesbar', null] as const) {
    for (const c of codes) {
      const u = umgebung({ gespeichert: gesp, antworten: [c === 'ok' ? { ok: NEU } : { code: c }], ich: [{ kontoAktiv: true, grund: null, zoomAnfrage: null, adminOffen: 0 }] });
      u.t.start();
      await ruhe();
      await u.t.lage();
      u.t.merkeAusgabe({ appId: 'jm-qa', zweck: 'qa-relay', ziel: 'evt-1', bis: T0 + TAG, am: T0 });
      await u.t.sitzungFuerBedarf();
      u.t.angemeldet(NEU);
      await u.t.abmelden();
      meldungen += u.gemeldet.length;
      mitToken += u.gemeldet.filter((a) => JSON.stringify(a).includes('jm1.')).length + (JSON.stringify(u.t.ansicht()).includes('jm1.') ? 1 : 0);
    }
  }
  ck(`P10 G4: kein Token in den ${meldungen} Meldungen an melde und nie in der Ansicht (Start-Kreuzprodukt, Lage, Bedarf, Anmeldung, Abmelden)`, meldungen > 40 && mitToken === 0);
}

// --- P10 G9 -----------------------------------------------------------------------------------------------------------------
{
  const quelle = readFileSync(new URL('../src/main/konto/sitzung-kern.ts', import.meta.url), 'utf8');
  ck('P10 G9: sitzung-kern.ts ohne electron-Import und ohne Konsole', !/from 'electron'|require\('electron'\)/.test(quelle) && !/console\./.test(quelle));
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

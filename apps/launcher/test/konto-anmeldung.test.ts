// Anmeldung im Launcher (Teil 1) · P11: Anmelde-Ablauf mit Bestätigungscode (src/main/konto/anmelde-ablauf.ts) nach
// Verhalten 11.2 (AA1–AA6) — ohne Electron, ohne Netz, ohne Browser (tsx). Der Wecker feuert nur von Hand, die Uhr
// rückt je Abfrage 2 s vor.
import { readFileSync } from 'node:fs';
import type { AnmeldeSchritt, KontoStand } from '../src/shared/konto';
import type { GeraetHandle } from '../src/main/konto/geraet';
import { erzeugeAnmeldeAblauf, type AnmeldeAblauf } from '../src/main/konto/anmelde-ablauf';
import type { GespeicherteSitzung } from '../src/main/konto/sitzung-kern';
import { KontoFehler, type KontoClient } from '../src/main/konto/worker-client';
import { kreuz, pruefeFaelle } from './konto-rechte.test';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const T0 = Date.UTC(2026, 9, 21, 9, 0, 0);
const CODE = 'K7Q-9XZ';
const ADRESSE = 'https://worker.test/konto/anmelden?v=vorgang-1';
const STAND: KontoStand = {
  kid: 'k1', email: 'maria.schmidt@jakobsmedien.com', name: 'Maria Schmidt', art: 'google', stufe: 'kollege', tools: [],
  events: [], zoom: true, zoomBis: null, jm: true, plattform: 'win', gid: 'g1', iat: T0, exp: T0 + 30 * 86_400_000,
  kontoBis: null, angemeldetSeit: T0,
};
type Abholen = 'wartet' | 'bestaetigt' | 'abgelehnt' | 'abgelaufen' | KontoFehler['code'];

function umgebung(o: { browser?: boolean | 'wirft' | 'haengt'; abholen?: Abholen[]; anlegen?: KontoFehler['code'] | 'haengt'; geraet?: boolean;
  versatz?: number; abholenHaelt?: boolean } = {}) {
  const u0 = {
    // Die Uhr des Rechners geht um `versatz` vor (die des Workers nicht): T0 + versatz.
    zeit: T0 + (o.versatz ?? 0),
    schritte: [] as AnmeldeSchritt[],
    anlegen: [] as unknown[],
    abholen: [] as Array<{ vorgang: string; geheimnis: string; zweck: string; bezug: string; ts: number }>,
    abbrechen: [] as Array<{ vorgang: string; geheimnis: string }>,
    browser: [] as string[],
    angemeldet: [] as GespeicherteSitzung[],
    wecker: [] as Array<{ ms: number; fn: () => void; aktiv: boolean }>,
    loeseAnlegen: null as null | (() => void),
    loeseAbholen: null as null | (() => void),
    loeseBrowser: null as null | ((offen: boolean) => void),
  };
  let abholenGehalten = false;
  const folge = [...(o.abholen ?? [])];
  const geraet: GeraetHandle = {
    gid: 'g1',
    publicJwk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
    async beweis(zweck, bezug, jetzt) { return { gid: 'g1', ts: jetzt, sig: `${zweck}|${bezug}|${jetzt}` }; },
  };
  const anlegenAntwort = { vorgang: 'vorgang-1', abholGeheimnis: 'test-abholen-1', code: CODE, adresse: ADRESSE, bis: T0 + 5 * 60_000 };
  const client = {
    async vorgangAnlegen(g: unknown) {
      u0.anlegen.push(g);
      if (o.anlegen === 'haengt') return new Promise((ja) => { u0.loeseAnlegen = () => ja({ ...anlegenAntwort, vorgang: 'vorgang-spaet' }); });
      if (o.anlegen) throw new KontoFehler(o.anlegen, null);
      return { ...anlegenAntwort, vorgang: `vorgang-${u0.anlegen.length}` };
    },
    async vorgangAbholen(vorgang: string, geheimnis: string, beweis: { sig: string }) {
      const [zweck, bezug, ts] = beweis.sig.split('|');
      u0.abholen.push({ vorgang, geheimnis, zweck, bezug, ts: Number(ts) });
      // EP30: der Worker meldet `uhr`, wenn der Zeitstempel des Beweises mehr als 5 min von seiner Uhr abweicht.
      if (Math.abs(o.versatz ?? 0) > 5 * 60_000) throw new KontoFehler('uhr', null);
      if (o.abholenHaelt && !abholenGehalten) {
        abholenGehalten = true;
        return new Promise((ja) => { u0.loeseAbholen = () => ja({ zustand: 'bestaetigt', sitzung: 'jm1.test.sitzung', stand: STAND }); });
      }
      const a = folge.shift() ?? 'wartet';
      if (a === 'bestaetigt') return { zustand: 'bestaetigt', sitzung: 'jm1.test.sitzung', stand: STAND };
      if (a === 'wartet' || a === 'abgelehnt' || a === 'abgelaufen') return { zustand: a };
      throw new KontoFehler(a, null);
    },
    async vorgangAbbrechen(vorgang: string, geheimnis: string) {
      u0.abbrechen.push({ vorgang, geheimnis });
      throw new KontoFehler('netz', null);
    },
  } as unknown as KontoClient;
  const ablauf: AnmeldeAblauf = erzeugeAnmeldeAblauf({
    client,
    geraet: async () => (o.geraet === false ? null : geraet),
    jetzt: () => u0.zeit,
    wecker: (ms, fn) => {
      const w = { ms, fn, aktiv: true };
      u0.wecker.push(w);
      return () => { w.aktiv = false; };
    },
    oeffneBrowser: async (url) => {
      u0.browser.push(url);
      if (o.browser === 'wirft') throw new Error('kein Browser');
      if (o.browser === 'haengt') return new Promise<boolean>((ja) => { u0.loeseBrowser = ja; });
      return o.browser !== false;
    },
    rechnerName: 'PC-Regie', plattform: 'win', arch: 'x64', version: '0.18.0',
    angemeldet: (s) => { u0.angemeldet.push(s); },
    melde: (s) => { u0.schritte.push(s); },
  });
  return Object.assign(u0, { ablauf });
}
async function ruhe(): Promise<void> {
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
}
/** Den aktiven Wecker auslösen (Uhr + Wecker-Zeit); false, wenn keiner aktiv ist. */
async function feuere(u: ReturnType<typeof umgebung>): Promise<boolean> {
  const w = u.wecker.find((x) => x.aktiv);
  if (!w) return false;
  w.aktiv = false;
  u.zeit += w.ms;
  w.fn();
  await ruhe();
  return true;
}
async function bisZumEnde(u: ReturnType<typeof umgebung>, max = 400): Promise<number> {
  let n = 0;
  while (n < max && (await feuere(u))) n++;
  return n;
}
const arten = (u: ReturnType<typeof umgebung>): string => u.schritte.map((s) => s.art).join(',');

// --- P11 4.1: Ablauf als Kreuzprodukt ----------------------------------------------------------------------------------
{
  const FOLGEN: Record<string, Abholen[]> = {
    'bestaetigt': ['bestaetigt'],
    'wartet,bestaetigt': ['wartet', 'wartet', 'bestaetigt'],
    'abgelehnt': ['wartet', 'abgelehnt'],
    'abgelaufen': ['abgelaufen'],
    'vorgang-unbekannt': ['vorgang-unbekannt'],
    'immer wartet': [],
    'geraet-unbekannt': ['geraet-unbekannt'],
    // EP30: die Uhr des Rechners geht falsch — sofort fehler mit Code uhr (Dialog K55), kein Wiederholen, nichts angemeldet.
    'uhr': ['uhr'],
  };
  const faelle = kreuz({ browser: [true, false, 'wirft'] as const, folge: Object.keys(FOLGEN), abbrechen: [false, true] });
  const ergebnisse: Array<{ f: (typeof faelle)[number]; ist: string; soll: string }> = [];
  for (const f of faelle) {
    const u = umgebung({ browser: f.browser, abholen: FOLGEN[f.folge] });
    await u.ablauf.starte();
    const wartet = u.ablauf.schritt();
    const adresseWartet = u.ablauf.adresse();
    if (f.abbrechen) await u.ablauf.abbrechen();
    const gefeuert = await bisZumEnde(u);
    const ende = u.ablauf.schritt();
    const ist = [arten(u), wartet.art === 'wartet' ? `${wartet.code}/${wartet.browserOffen}/${wartet.bis - T0}` : '-',
      adresseWartet ?? '-', u.ablauf.adresse() ?? '-', ende.art === 'fehler' ? ende.code : '-', u.angemeldet.length,
      u.abbrechen.length, u.abholen.length, gefeuert].join(' ');
    const ok = f.browser === true;
    let endArt: string, code = '-', angemeldet = 0, abholen: number;
    if (f.abbrechen) { endArt = 'abgebrochen'; abholen = 0; }
    else if (f.folge === 'bestaetigt') { endArt = 'fertig'; angemeldet = 1; abholen = 1; }
    else if (f.folge === 'wartet,bestaetigt') { endArt = 'fertig'; angemeldet = 1; abholen = 3; }
    else if (f.folge === 'abgelehnt') { endArt = 'abgelehnt'; abholen = 2; }
    else if (f.folge === 'abgelaufen' || f.folge === 'vorgang-unbekannt') { endArt = 'abgelaufen'; abholen = 1; }
    else if (f.folge === 'immer wartet') { endArt = 'abgelaufen'; abholen = 149; }
    else { endArt = 'fehler'; code = f.folge; abholen = 1; }
    // Nach einem Fehler beim Abfragen (Gerät, Uhr) und nach lokalem Ablauf wird der Vorgang best effort beim Worker geschlossen.
    const schliesst = f.abbrechen || endArt === 'fehler' || f.folge === 'immer wartet';
    const soll = [`startet,wartet,${endArt}`, `${CODE}/${ok}/300000`, ADRESSE, '-', code, angemeldet, schliesst ? 1 : 0, abholen,
      f.abbrechen ? 0 : abholen + (f.folge === 'immer wartet' ? 1 : 0)].join(' ');
    ergebnisse.push({ f, ist, soll });
  }
  const r = pruefeFaelle('P11 4.1: Ablauf (Browser ja/nein/wirft × Antworten des Workers × Abbrechen) → Schrittfolge, Code, Adresse, Aufrufe',
    ergebnisse, (e) => (e.ist === e.soll ? null : `${e.f.browser}/${e.f.folge}/${e.f.abbrechen}: ist ${e.ist}, soll ${e.soll}`));
  ck(r.name, r.ok);
}

// --- P11 AA2, AA3: Anlegen mit Gerät, Abfrage alle 2 s mit frischem Beweis ------------------------------------------
{
  const u = umgebung({ abholen: ['wartet', 'wartet', 'bestaetigt'] });
  await u.ablauf.starte();
  await bisZumEnde(u);
  const a = u.anlegen[0] as { publicJwk: JsonWebKey; name: string; plattform: string; arch: string; version: string };
  ck('P11 AA3: Abfrage alle 2 s mit frischem Beweis (Zweck abholen, Bezug Vorgang, ts = jetzt) und dem Abholgeheimnis',
    u.wecker.length === 3 && u.wecker.every((w) => w.ms === 2000) && u.abholen.length === 3
    && u.abholen.every((x, i) => x.zweck === 'abholen' && x.bezug === 'vorgang-1' && x.vorgang === 'vorgang-1'
      && x.geheimnis === 'test-abholen-1' && x.ts === T0 + 2000 * (i + 1)));
  ck('P11 AA2: Vorgang mit öffentlichem Schlüssel, Rechnername, Plattform, Architektur, Version; Browser mit der Adresse des Workers',
    u.anlegen.length === 1 && a.name === 'PC-Regie' && a.plattform === 'win' && a.arch === 'x64' && a.version === '0.18.0'
    && a.publicJwk.kty === 'EC' && JSON.stringify(u.browser) === JSON.stringify([ADRESSE]));
  const fertig = u.ablauf.schritt();
  ck('P11 AA3: bestätigt → angemeldet genau einmal mit Sitzung und Stand, Schritt „fertig“ mit Kurzname und Stufe',
    u.angemeldet.length === 1 && u.angemeldet[0].token === 'jm1.test.sitzung' && u.angemeldet[0].stand.kid === 'k1'
    && fertig.art === 'fertig' && fertig.kurzName === 'Maria S.' && fertig.stufe === 'kollege');
}

// --- P11 AA4: Netzfehler ------------------------------------------------------------------------------------------------
{
  const einzeln = umgebung({ abholen: ['netz', 'wartet', 'netz', 'netz', 'server', 'netz', 'bestaetigt'] });
  await einzeln.ablauf.starte();
  await bisZumEnde(einzeln);
  const fuenf = umgebung({ abholen: ['netz', 'netz', 'netz', 'netz', 'netz', 'bestaetigt'] });
  await fuenf.ablauf.starte();
  await bisZumEnde(fuenf);
  const server = umgebung({ abholen: ['server', 'zu-viele', 'server', 'server', 'server'] });
  await server.ablauf.starte();
  await bisZumEnde(server);
  const e1 = fuenf.ablauf.schritt();
  const e2 = server.ablauf.schritt();
  ck('P11 AA4: einzelne Netz- und Serverfehler beim Abfragen ändern nichts; fünf in Folge → fehler mit dem letzten Code, keine Abfrage mehr',
    einzeln.ablauf.schritt().art === 'fertig' && arten(einzeln) === 'startet,wartet,fertig'
    && e1.art === 'fehler' && e1.code === 'netz' && fuenf.abholen.length === 5 && fuenf.angemeldet.length === 0
    && e2.art === 'fehler' && e2.code === 'server' && server.abholen.length === 5);
}
{
  const ergebnisse: string[] = [];
  for (const code of ['netz', 'nicht-eingerichtet', 'server', 'zu-viele'] as const) {
    const u = umgebung({ anlegen: code });
    await u.ablauf.starte();
    const s = u.ablauf.schritt();
    ergebnisse.push(`${arten(u)}/${s.art === 'fehler' ? s.code : '-'}/${u.browser.length}/${u.wecker.length}`);
  }
  ck(`P11 AA4: Fehler beim Anlegen → fehler mit Code (K50, K51, K53, K54), kein Browser, keine Abfrage (${ergebnisse.join(' ')})`,
    JSON.stringify(ergebnisse) === JSON.stringify(['startet,fehler/netz/0/0', 'startet,fehler/nicht-eingerichtet/0/0', 'startet,fehler/server/0/0', 'startet,fehler/zu-viele/0/0']));
}

// --- P11 AA1: nicht verdoppeln, neuer Start aus einem Endzustand; ohne Gerät kein Vorgang -------------------------------
{
  const u = umgebung({ abholen: ['abgelehnt'] });
  await u.ablauf.starte();
  await u.ablauf.starte();
  const waehrend = u.anlegen.length;
  await bisZumEnde(u);
  await u.ablauf.starte();
  const ohne = umgebung({ geraet: false });
  await ohne.ablauf.starte();
  const s = ohne.ablauf.schritt();
  ck('P11 AA1: ein laufender Ablauf wird nicht verdoppelt; aus „abgelehnt“ startet ein neuer Vorgang; ohne Gerät → fehler kein-schluesselspeicher ohne Vorgang',
    waehrend === 1 && u.anlegen.length === 2 && u.ablauf.schritt().art === 'wartet'
    && (u.ablauf.schritt() as { code: string }).code === CODE && s.art === 'fehler' && s.code === 'kein-schluesselspeicher'
    && ohne.anlegen.length === 0);
}

// --- P11 AA5: Abbrechen -------------------------------------------------------------------------------------------------
{
  const u = umgebung({ abholen: ['wartet', 'bestaetigt'] });
  await u.ablauf.starte();
  await feuere(u);
  await u.ablauf.abbrechen();
  const nachAbbruch = await bisZumEnde(u);
  const spaet = umgebung({ anlegen: 'haengt' });
  const laeuft = spaet.ablauf.starte();
  await ruhe();
  await spaet.ablauf.abbrechen();
  spaet.loeseAnlegen?.();
  await laeuft;
  await ruhe();
  ck('P11 AA5: Abbrechen stoppt die Abfrage, ruft den Worker (auch wenn er scheitert) und endet „abgebrochen“; ein Vorgang, der erst nach dem Abbrechen ankommt, wird beim Worker gleich geschlossen',
    arten(u) === 'startet,wartet,abgebrochen' && u.abbrechen.length === 1 && u.abbrechen[0].vorgang === 'vorgang-1'
    && u.abbrechen[0].geheimnis === 'test-abholen-1' && nachAbbruch === 0 && u.abholen.length === 1 && u.angemeldet.length === 0
    && arten(spaet) === 'startet,abgebrochen' && spaet.abbrechen.length === 1 && spaet.abbrechen[0].vorgang === 'vorgang-spaet'
    && spaet.browser.length === 0);
}

// --- P11 AA6: der Code geht nie in ein Log ------------------------------------------------------------------------------
{
  const mitschnitt: string[] = [];
  const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
  for (const k of Object.keys(orig) as Array<keyof typeof orig>) console[k] = (...a: unknown[]) => { mitschnitt.push(a.map(String).join(' ')); };
  try {
    for (const folge of [['wartet', 'bestaetigt'], ['netz', 'netz', 'netz', 'netz', 'netz'], ['geraet-unbekannt']] as Abholen[][]) {
      const u = umgebung({ abholen: folge, browser: false });
      await u.ablauf.starte();
      await bisZumEnde(u);
    }
    const ab = umgebung({ abholen: ['wartet'] });
    await ab.ablauf.starte();
    await ab.ablauf.abbrechen();
  } finally {
    Object.assign(console, orig);
  }
  const quelle = readFileSync(new URL('../src/main/konto/anmelde-ablauf.ts', import.meta.url), 'utf8');
  ck('P11 AA6: der Code geht in kein Log (Konsole leer über Erfolg, Netzfehler, fremdes Gerät, Abbrechen), das Modul hat keine Konsole',
    mitschnitt.length === 0 && !/console\./.test(quelle));
}

// --- P11 EP30: die Frist läuft auf der eigenen Uhr -----------------------------------------------------------------------
{
  const vor = umgebung({ versatz: 6 * 60_000 });
  await vor.ablauf.starte();
  await bisZumEnde(vor);
  const e = vor.ablauf.schritt();
  const drei = umgebung({ versatz: 3 * 60_000, abholen: [] });
  await drei.ablauf.starte();
  const w3 = drei.ablauf.schritt();
  await bisZumEnde(drei);
  ck('P11 EP30: Uhr 6 min vor → die Abfrage findet statt, der Worker meldet uhr → fehler uhr (K55), nicht abgelaufen',
    vor.abholen.length === 1 && e.art === 'fehler' && e.code === 'uhr' && vor.angemeldet.length === 0);
  ck('P11 EP30: Uhr 3 min vor → volle Frist von 300 s auf der eigenen Uhr (wartet.bis, 149 Abfragen, dann abgelaufen)',
    w3.art === 'wartet' && w3.bis - (T0 + 3 * 60_000) === 300_000 && drei.abholen.length === 149
    && drei.ablauf.schritt().art === 'abgelaufen');
}

// --- P11 Verlorene Antwort: unbekannt nach vorübergehendem Fehler ist kein „abgelaufen“ ---------------------------------
{
  const netz = umgebung({ abholen: ['netz', 'vorgang-unbekannt'] });
  await netz.ablauf.starte();
  await bisZumEnde(netz);
  const server = umgebung({ abholen: ['wartet', 'server', 'vorgang-unbekannt'] });
  await server.ablauf.starte();
  await bisZumEnde(server);
  const a = netz.ablauf.schritt(), b = server.ablauf.schritt();
  ck('P11 AA4: vorgang-unbekannt direkt nach einem Netz- oder Serverfehler → fehler mit dem vorigen Code (die Bestätigung kann verloren sein), sonst abgelaufen',
    a.art === 'fehler' && a.code === 'netz' && b.art === 'fehler' && b.code === 'server' && netz.angemeldet.length === 0);
}

// --- P11 AA5: späte Antworten eines früheren Laufs ------------------------------------------------------------------------
{
  const u = umgebung({ abholenHaelt: true });
  await u.ablauf.starte();
  await feuere(u);
  await u.ablauf.abbrechen();
  await u.ablauf.starte();
  u.loeseAbholen?.();
  await ruhe();
  const spaetBestaetigt = u.angemeldet.length === 0 && u.ablauf.schritt().art === 'wartet';
  const b = umgebung({ browser: 'haengt' });
  const laeuft = b.ablauf.starte();
  await ruhe();
  await b.ablauf.abbrechen();
  b.loeseBrowser?.(true);
  await laeuft;
  await ruhe();
  ck('P11 AA5: eine späte Antwort „bestätigt“ des abgebrochenen Laufs meldet den neuen Lauf nicht an; ein Browser, der erst nach dem Abbrechen zurückkehrt, bringt „wartet“ nicht zurück',
    spaetBestaetigt && arten(b) === 'startet,abgebrochen' && b.ablauf.schritt().art === 'abgebrochen' && b.wecker.length === 0
    && b.ablauf.adresse() === null);
}

// --- P11 G4: kein Geheimnis in den gemeldeten Schritten --------------------------------------------------------------------
{
  const u = umgebung({ abholen: ['wartet', 'bestaetigt'] });
  await u.ablauf.starte();
  await bisZumEnde(u);
  const f = umgebung({ abholen: ['netz'] });
  await f.ablauf.starte();
  await bisZumEnde(f);
  const alles = JSON.stringify([u.schritte, f.schritte]);
  ck('P11 G4: in keinem gemeldeten Schritt stehen Abholgeheimnis oder Sitzung',
    u.schritte.length === 3 && !alles.includes('test-abholen-1') && !alles.includes('jm1.test.sitzung'));
}

// --- P11 G9 ---------------------------------------------------------------------------------------------------------------
{
  const quelle = readFileSync(new URL('../src/main/konto/anmelde-ablauf.ts', import.meta.url), 'utf8');
  ck('P11 G9: anmelde-ablauf.ts ohne electron-Import, Browser nur über oeffneBrowser',
    !/from 'electron'|require\('electron'\)/.test(quelle) && !/shell\./.test(quelle));
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

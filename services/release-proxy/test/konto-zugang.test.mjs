// Zugang zu den Tool-Routen (Anmeldung im Launcher, Plan Teil 1, P15; Spec 9, 9.1, 10; EP3, EP9, EP10, EP25, EP32; OF2).
//   node --experimental-strip-types services/release-proxy/test/konto-zugang.test.mjs
// Ruft worker.fetch(request, env, ctx) ohne Netz (globaler fetch-Stub für GitHub, der jeden Abruf mitschreibt). Sitzungen
// und Freigaben signiert der Test selbst mit einem Schlüssel aus testSchluessel() (zur Laufzeit, G4). Der Konten-DO ist für
// die Zählung ein Fake, der jede Anfrage mitschreibt (die Zählung im DO selbst testet P5). Das Selbst-Update hält Antworten
// 60 s im Speicher des Isolats (EP32): jeder Block dazu nutzt ein eigenes Repo. Nicht über tsx (Kopf von worker.test.mjs).
// P20 fügt Wächter für wrangler.toml und den Re-Export direkt vor der Ende-Marke ein.
import { readFileSync } from 'node:fs';
import worker from '../worker.js';
import { altKeyMerkerGroesse, altKeyMerkerLeeren, ALTKEY_MERKER_MAX } from '../konto-altkey.js';
import { funktionFuerRoute } from '../konto-kern.js';
import { sha256B64url, signiere } from '../konto-krypto.js';
import { FEHLER_TEXT, ipHash, KONTO_RL, launcherSelbstUpdate, selbstUpdateLiefern, zugangPruefen } from '../konto-zugang.js';
import { abschluss, check, makeRateLimit, makeRLBindungen, pruefeFaelle, RL_TABELLE, testSchluessel } from './konto-attrappen.mjs';

// Warn- und Fehlerlog mitschneiden (erwartet, und für die Prüfung auf Geheimnisse).
const protokoll = [];
const realWarn = console.warn;
const realError = console.error;
console.warn = (...a) => protokoll.push(a.join(' '));
console.error = (...a) => protokoll.push(a.join(' '));

const TAG = 24 * 3600_000;
const T0 = Date.parse('2026-11-02T10:00:00Z');
const jetzt = T0;
const SCHLUESSEL = testSchluessel();
const FREMD = testSchluessel();
const PROXY = 'test-proxy-key';
const ENV = { PROXY_KEY: PROXY, GITHUB_TOKEN: 'gh', REPO: 'owner/repo', KONTO_SCHLUESSEL: SCHLUESSEL, KONTO_UHR: () => jetzt };
const VOR = new Date(T0 + 10 * TAG).toISOString(); // Frist läuft noch
const GENAU = new Date(T0).toISOString(); // Frist endet genau jetzt
const NACH = new Date(T0 - TAG).toISOString(); // Frist vorbei

const RELEASES = [
  { tag_name: 'launcher-v0.18.0', draft: false, assets: [{ id: 11, name: 'JM.Production.Suite-0.18.0-win-x64.exe', size: 1 }] },
  { tag_name: 'copy-v0.2.0', draft: false, assets: [{ id: 12, name: 'JM.Copy-0.2.0-win-x64.exe', size: 1 }] },
];
// EP32: Im Repo test/alt ist der neueste Launcher 0.17.0 (Installer mit eingebackenem alten Schlüssel).
const RELEASES_ALT = [{ tag_name: 'launcher-v0.17.0', draft: false, assets: [{ id: 21, name: 'JM.Production.Suite-0.17.0-win-x64.exe', size: 1 }] }];
const ghAufrufe = [];
let githubWirft = false; // Repo test/wirft: GitHub ist nicht erreichbar (Fix-Runde 2)
globalThis.fetch = async (u, init = {}) => {
  const url = String(u);
  if (url.includes('api.github.com')) ghAufrufe.push(url);
  if (url.includes('/repos/test/gedrosselt/') || url.includes('/repos/test/wirft/')) await new Promise((r) => setTimeout(r, 20)); // Anfragen überlappen
  if (githubWirft && url.includes('/repos/test/wirft/')) throw new Error('netz weg');
  if (url.includes('/releases/assets/')) {
    return new Response(null, { status: 302, headers: { Location: `https://signed.test/${url.split('/').pop()}` } });
  }
  // Repo test/gleichzeitig: die Liste kommt verzögert, damit gleichzeitige Anfragen sich überlappen (Fix-Runde 1).
  if (url.includes('/repos/test/gleichzeitig/') && url.includes('/releases?')) await new Promise((r) => setTimeout(r, 20));
  if (url.includes('/releases?')) return new Response(JSON.stringify(url.includes('/repos/test/alt/') ? RELEASES_ALT : RELEASES), { status: 200 });
  if (url.includes('/contents/')) return new Response('{"tools":[]}', { status: 200 });
  if (url.endsWith('/issues') && init.method === 'POST') {
    return new Response(JSON.stringify({ number: 1, html_url: 'https://github.test/1' }), { status: 201 });
  }
  return new Response('{}', { status: 404 });
};

function req(pfad, { method = 'GET', body, kopf = {} } = {}) {
  const init = { method, headers: { 'CF-Connecting-IP': '9.9.9.9', ...kopf } };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request('https://proxy.test' + pfad, init);
}
const sitzung = (stufe, extra = {}, schluessel = SCHLUESSEL) =>
  signiere(schluessel, {
    v: 1, typ: 'sitzung', kid: `k-${stufe}`, email: `${stufe}@test.invalid`, name: 'Test Person', art: 'google', stufe,
    tools: [], events: [], zoom: stufe !== 'externer', zoomBis: null, jm: false, plattform: 'win', gid: 'g-1',
    iat: jetzt - TAG, exp: jetzt + TAG, kontoBis: null, angemeldetSeit: jetzt - TAG, ...extra,
  });
const freigabe = (ziel, extra = {}) =>
  signiere(SCHLUESSEL, { v: 1, typ: 'freigabe', zweck: 'qa-relay', ziel, kid: 'k-kollege', gid: 'g-1', iat: jetzt, exp: jetzt + 72 * 3600_000, ...extra });
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

async function run() {
  // P15 9.1: jede Tool-Route × jeder Zugang. Erwartet: Status und code mit Text S… (oder der Status der Route selbst).
  {
    const ROUTEN = [
      { name: 'GET /tools/jm-copy/latest', pfad: '/tools/jm-copy/latest?platform=win&arch=x64', erlaubt: 200 },
      { name: 'GET /tools/jm-launcher/latest', pfad: '/tools/jm-launcher/latest?platform=win&arch=x64', erlaubt: 200 },
      { name: 'GET /suite.json', pfad: '/suite.json', erlaubt: 200 },
      { name: 'GET /changelog.json', pfad: '/changelog.json', erlaubt: 200 },
      { name: 'GET /cookbook.json', pfad: '/cookbook.json', erlaubt: 200 },
      { name: 'POST /feedback', pfad: '/feedback', method: 'POST', body: { title: 't', description: 'd' }, erlaubt: 200 },
      // Formular-Modus mit leerem Rezept: nach dem Gate 422, ohne GitHub und ohne Anthropic.
      { name: 'POST /cookbook/draft', pfad: '/cookbook/draft', method: 'POST', body: { mode: 'form', recipe: {} }, erlaubt: 422, ki: true },
      // Unbekannte Pfade sind nie offen; mit Zugang wie bisher 404.
      { name: 'GET /gibt-es-nicht', pfad: '/gibt-es-nicht', erlaubt: 404 },
    ];
    const ja = (r) => [r.erlaubt, null];
    const nein = (status, code) => () => [status, code];
    const ZUGAENGE = [
      { name: 'ohne Zugang', kopf: {}, env: {}, soll: nein(401, 'nicht-angemeldet') },
      { name: 'alter Key, Frist läuft', kopf: { 'X-Proxy-Key': PROXY }, env: { ALTKEY_BIS: VOR }, soll: ja },
      { name: 'alter Key, ALTKEY_BIS fehlt (unbefristet)', kopf: { 'X-Proxy-Key': PROXY }, env: {}, soll: ja },
      { name: 'alter Key, Frist endet genau jetzt', kopf: { 'X-Proxy-Key': PROXY }, env: { ALTKEY_BIS: GENAU }, soll: nein(401, 'alter-key-abgelaufen') },
      { name: 'alter Key nach der Frist', kopf: { 'X-Proxy-Key': PROXY }, env: { ALTKEY_BIS: NACH }, soll: nein(401, 'alter-key-abgelaufen') },
      { name: 'falscher Key', kopf: { 'X-Proxy-Key': 'test-falsch' }, env: { ALTKEY_BIS: VOR }, soll: nein(401, 'nicht-angemeldet') },
      { name: 'Bearer mit altem Key', kopf: bearer(PROXY), env: { ALTKEY_BIS: VOR }, soll: ja },
      { name: 'Sitzung Admin, Frist vorbei', kopf: bearer(await sitzung('admin')), env: { ALTKEY_BIS: NACH }, soll: ja },
      { name: 'Sitzung Kollege', kopf: bearer(await sitzung('kollege')), env: { ALTKEY_BIS: NACH }, soll: ja },
      { name: 'Sitzung Externer', kopf: bearer(await sitzung('externer')), env: { ALTKEY_BIS: NACH }, soll: (r) => (r.ki ? [403, 'kein-recht'] : ja(r)) },
      { name: 'Sitzung Kollege und falscher Key', kopf: { ...bearer(await sitzung('kollege')), 'X-Proxy-Key': 'test-falsch' }, env: {}, soll: ja },
      { name: 'Sitzung abgelaufen', kopf: bearer(await sitzung('kollege', { exp: jetzt - 1 })), env: {}, soll: nein(401, 'sitzung-abgelaufen') },
      { name: 'Sitzung endet genau jetzt', kopf: bearer(await sitzung('kollege', { exp: jetzt })), env: {}, soll: nein(401, 'sitzung-abgelaufen') },
      { name: 'Sitzung mit fremdem Schlüssel', kopf: bearer(await sitzung('admin', {}, FREMD)), env: {}, soll: nein(401, 'nicht-angemeldet') },
      { name: 'Freigabe (qa-relay) statt Sitzung', kopf: bearer(await freigabe('qa-event-1')), env: {}, soll: nein(403, 'kein-recht') },
      { name: 'Sitzung, Server ohne KONTO_SCHLUESSEL', kopf: bearer(await sitzung('kollege')), env: { KONTO_SCHLUESSEL: undefined }, soll: nein(503, 'nicht-eingerichtet') },
    ];
    const faelle = ZUGAENGE.flatMap((z) => ROUTEN.map((r) => ({ name: `${z.name} · ${r.name}`, z, r })));
    await pruefeFaelle('P15 9.1: Zugang je Route', faelle, async ({ z, r }) => {
      const res = await worker.fetch(req(r.pfad, { method: r.method, body: r.body, kopf: z.kopf }), { ...ENV, ...z.env });
      const body = await res.json().catch(() => ({}));
      const [status, code] = z.soll(r);
      const ok = res.status === status && (code === null ? body.code === undefined : body.code === code && body.error === FEHLER_TEXT[code]);
      return ok ? null : `ist ${res.status} ${body.code ?? '-'}, soll ${status} ${code ?? '-'}`;
    });
  }

  // P15 EP3: Freigabe und Sitzung, je nachdem, ob die Route ein Ziel hat (Vorbereitung P19, direkt über zugangPruefen).
  {
    const r = (kopf) => new Request('https://proxy.test/qa/qa-event-1/pending', { headers: kopf });
    const Q = { funktion: 'qa', gruppe: 'qa', ziel: 'qa-event-1' };
    const OHNE = { funktion: 'qa', gruppe: null, ziel: null };
    const faelle = [
      { name: 'Freigabe für dieses Event', kopf: bearer(await freigabe('qa-event-1')), o: Q, soll: 'freigabe' },
      { name: 'Freigabe für ein anderes Event', kopf: bearer(await freigabe('qa-event-2')), o: Q, soll: 'keine-freigabe' },
      { name: 'Freigabe abgelaufen', kopf: bearer(await freigabe('qa-event-1', { exp: jetzt })), o: Q, soll: 'sitzung-abgelaufen' },
      { name: 'Freigabe mit unbekanntem Zweck', kopf: bearer(await freigabe('qa-event-1', { zweck: 'connect-raum' })), o: Q, soll: 'kein-recht' },
      { name: 'Freigabe an Route ohne Ziel', kopf: bearer(await freigabe('qa-event-1')), o: OHNE, soll: 'kein-recht' },
      { name: 'Sitzung Kollege an Route mit Ziel', kopf: bearer(await sitzung('kollege')), o: Q, soll: 'keine-freigabe' },
      { name: 'Sitzung Kollege an Route ohne Ziel', kopf: bearer(await sitzung('kollege')), o: OHNE, soll: 'sitzung' },
      { name: 'Sitzung Externer ohne Werkzeug qa', kopf: bearer(await sitzung('externer')), o: OHNE, soll: 'kein-recht' },
      { name: 'Sitzung Externer mit Werkzeug qa', kopf: bearer(await sitzung('externer', { tools: ['qa'] })), o: OHNE, soll: 'sitzung' },
      { name: 'alter Key, Gruppe qa, Frist läuft', kopf: { 'X-Proxy-Key': PROXY }, o: Q, env: { ALTKEY_BIS: VOR }, soll: 'alter-key' },
      { name: 'alter Key, Gruppe qa, nach der Frist', kopf: { 'X-Proxy-Key': PROXY }, o: Q, env: { ALTKEY_BIS: NACH }, soll: 'alter-key-abgelaufen' },
      { name: 'alter Key ohne Gruppe', kopf: { 'X-Proxy-Key': PROXY }, o: OHNE, soll: 'nicht-angemeldet' },
    ];
    await pruefeFaelle('P15 EP3: Freigabe nur an Routen mit Ziel, Sitzung nur ohne', faelle, async (f) => {
      const z = await zugangPruefen(r(f.kopf), { ...ENV, ...(f.env ?? {}) }, { ...f.o, jetzt });
      const ist = z.ok ? z.art : z.code;
      if (ist !== f.soll) return `ist ${ist}, soll ${f.soll}`;
      if (!z.ok && z.error !== FEHLER_TEXT[z.code]) return `Text ${z.error}`;
      if (z.ok && z.art === 'freigabe' && z.claims.ziel !== 'qa-event-1') return 'Claims fehlen';
      return null;
    });
  }

  // P15 Texte S1–S18 wörtlich aus der Texttabelle 9.6 (S12a als Vorgabe zu konflikt; S18 `uhr`, EP30).
  check('P15 G2: FEHLER_TEXT S1–S18 wörtlich, ohne ASCII-Anführungszeichen',
    FEHLER_TEXT['nicht-angemeldet'] === 'nicht angemeldet: im Launcher anmelden'
      && FEHLER_TEXT['sitzung-abgelaufen'] === 'Anmeldung abgelaufen: im Launcher neu anmelden'
      && FEHLER_TEXT['kein-recht'] === 'kein Recht für diese Funktion'
      && FEHLER_TEXT['alter-key-abgelaufen'] === 'alter Schlüssel nicht mehr gültig: Launcher aktualisieren und anmelden'
      && FEHLER_TEXT['nicht-eingerichtet'] === 'Anmeldung auf dem Server nicht eingerichtet'
      && FEHLER_TEXT.gesperrt === 'Zugang gesperrt'
      && FEHLER_TEXT.geloescht === 'Zugang gelöscht'
      && FEHLER_TEXT['zugang-abgelaufen'] === 'Zugang abgelaufen'
      && FEHLER_TEXT['geraet-unbekannt'] === 'Rechner unbekannt: neu anmelden'
      && FEHLER_TEXT['vorgang-unbekannt'] === 'Anmeldevorgang unbekannt oder abgelaufen'
      && FEHLER_TEXT.ungueltig === 'ungültige Anfrage'
      && FEHLER_TEXT.konflikt === 'es muss immer mindestens einen Admin geben'
      && FEHLER_TEXT['nicht-noetig'] === 'Zoom ist für deine Stufe schon erlaubt'
      && FEHLER_TEXT['unbekannter-zweck'] === 'unbekannter Zweck'
      && FEHLER_TEXT['keine-freigabe'] === 'keine Freigabe für dieses Q&A-Event'
      && FEHLER_TEXT['erster-admin'] === 'der erste Admin lässt sich hier nicht ändern'
      && FEHLER_TEXT.domain === 'Kollegen von jakobsmedien.com melden sich mit Google an'
      && FEHLER_TEXT.uhr === 'Uhr des Rechners geht falsch: Datum und Uhrzeit prüfen'
      // S19 (Z1-W2, OE2) wörtlich wie der Text M49 des Launchers
      && FEHLER_TEXT['iveo-basis-unbekannt'] === 'Diese iveo-Adresse ist nicht freigegeben. Erlaubt sind Production (app.my-iveo.de) und Staging (staging-dev.my-iveo.de).'
      && Object.keys(FEHLER_TEXT).length === 19
      && Object.values(FEHLER_TEXT).every((t) => !t.includes('"')));

  // P15 EP10: launcherSelbstUpdate nur GET und dekodierte ID genau launcher.
  {
    const faelle = [
      ['GET', '/tools/launcher/latest', true],
      ['GET', '/tools/launcher/latest/', true],
      ['GET', '/tools/%6Cauncher/latest', true],
      ['HEAD', '/tools/launcher/latest', false],
      ['POST', '/tools/launcher/latest', false],
      ['GET', '/tools/jm-launcher/latest', false],
      ['GET', '/tools/launcher2/latest', false],
      ['GET', '/tools/launcher/latest/x', false],
      ['GET', '/tools/%E0%A4%A/latest', false],
    ].map(([methode, pfad, soll]) => ({ name: `${methode} ${pfad}`, methode, pfad, soll }));
    await pruefeFaelle('P15 EP10: launcherSelbstUpdate nur GET mit der dekodierten ID launcher', faelle, (f) =>
      launcherSelbstUpdate(f.methode, f.pfad) === f.soll ? null : `soll ${f.soll}`);
  }

  // P15 N11 (EP10): Das Selbst-Update geht immer, auch nach der Frist; jm-launcher und andere Tools nicht.
  {
    const env = { ...ENV, ALTKEY_BIS: NACH };
    const launcher = (kopf) => worker.fetch(req('/tools/launcher/latest?platform=win&arch=x64', { kopf }), env);
    const a = await launcher({});
    const b = await launcher({ 'X-Proxy-Key': PROXY });
    const c = await launcher({ 'X-Proxy-Key': 'test-falsch', Authorization: 'Bearer jm1.kaputt.kaputt' });
    const version = (await a.json()).version;
    const d = await worker.fetch(req('/tools/jm-launcher/latest?platform=win&arch=x64'), env);
    const e = await worker.fetch(req('/tools/jm-copy/latest?platform=win&arch=x64', { kopf: { 'X-Proxy-Key': PROXY } }), env);
    const eb = await e.json();
    check('P15 N11: /tools/launcher/latest ohne Kopf, mit altem Key nach der Frist und mit kaputter Sitzung → 200 (0.18.0)',
      a.status === 200 && version === '0.18.0' && b.status === 200 && c.status === 200);
    check('P15 N11: /tools/jm-launcher/latest ohne Zugang → 401 (bleibt geprüft)', d.status === 401);
    check('P15 N11: alter Key nach der Frist → /tools/jm-copy/latest 401 S4',
      e.status === 401 && eb.code === 'alter-key-abgelaufen' && eb.error === 'alter Schlüssel nicht mehr gültig: Launcher aktualisieren und anmelden');
  }

  // P15 EP32: Ohne Zugang gibt es das Selbst-Update erst ab 0.18.0 (ältere Installer tragen den alten PROXY_KEY in sich);
  // mit Zugang (Sitzung oder alter Key in der Frist) wie jedes Tool. Repo test/alt: neuester Launcher 0.17.0.
  {
    const env = { ...ENV, REPO: 'test/alt', ALTKEY_BIS: VOR };
    const hole = async (kopf, e = env) => {
      const r = await worker.fetch(req('/tools/launcher/latest?platform=win&arch=x64', { kopf }), e);
      const d = await r.json().catch(() => ({}));
      return `${r.status} ${d.version ?? d.code}`;
    };
    const ist = [
      await hole({}),
      await hole({ Authorization: 'Bearer jm1.kaputt.kaputt' }),
      await hole({ 'X-Proxy-Key': PROXY }),
      await hole(bearer(await sitzung('externer'))),
      await hole({ 'X-Proxy-Key': PROXY }, { ...env, ALTKEY_BIS: NACH }),
    ].join(' | ');
    const soll = '401 nicht-angemeldet | 401 nicht-angemeldet | 200 0.17.0 | 200 0.17.0 | 401 alter-key-abgelaufen';
    check('P15 EP32: Selbst-Update 0.17.0 ohne Zugang und mit kaputter Sitzung 401 S1, mit altem Key und mit Sitzung 200, mit altem Key nach der Frist 401 S4',
      ist === soll);
    if (ist !== soll) console.log(`     ${ist}`);
  }

  // P15 EP32: Der Speicher des Isolats hält eine Antwort 60 s: 50 anonyme Anfragen kosten 2 Abrufe bei GitHub (Liste, Link).
  {
    let uhr = T0;
    const env = { ...ENV, REPO: 'test/speicher', KONTO_UHR: () => uhr, ...makeRLBindungen() };
    const zaehle = () => ghAufrufe.filter((u) => u.includes('/repos/test/speicher/')).length;
    const status = [];
    for (let i = 0; i < 50; i++) status.push((await worker.fetch(req('/tools/launcher/latest?platform=win&arch=x64'), env)).status);
    const nachFuenfzig = zaehle();
    uhr += 61_000;
    const spaeter = await worker.fetch(req('/tools/launcher/latest?platform=win&arch=x64'), env);
    check('P15 EP32: 50 anonyme Anfragen → 200 mit 2 Abrufen bei GitHub (Zwischenspeicher 60 s), nach 61 s wieder 2 Abrufe',
      status.every((s) => s === 200) && nachFuenfzig === 2 && spaeter.status === 200 && zaehle() === 4);
    if (nachFuenfzig !== 2 || zaehle() !== 4) console.log(`     Abrufe bei GitHub: ${nachFuenfzig} / ${zaehle()}`);
  }

  // P15 EP32, Z1-W2 AR70: Die Drossel je IP (Bindung KONTO_RL_SELBSTUPDATE, 20 je Periode) zählt nur Abrufe bei GitHub: 9 × 4 Abrufe
  // (vier Plattformen, alle 61 s neu) aus einer IP in derselben Periode → die ersten 20 gehen durch, dann 429. Ein Treffer im
  // Speicher und eine andere IP gehen weiter.
  {
    let uhr = T0;
    const rl = makeRateLimit(RL_TABELLE.KONTO_RL_SELBSTUPDATE.grenze);
    const env = { ...ENV, REPO: 'test/drossel', KONTO_UHR: () => uhr, KONTO_RL_SELBSTUPDATE: rl, RATELIMIT: { get() { throw new Error('KV darf nicht gelesen werden'); }, put() { throw new Error('KV darf nicht geschrieben werden'); } } };
    const holen = (ziel, ip) => worker.fetch(req(`/tools/launcher/latest?platform=${ziel}`, { kopf: { 'CF-Connecting-IP': ip } }), env);
    const antworten = [];
    for (let schritt = 0; schritt < 9; schritt++) {
      for (const ziel of ['win&arch=x64', 'win&arch=arm64', 'mac&arch=x64', 'mac&arch=arm64']) antworten.push(await holen(ziel, '5.5.5.5'));
      uhr += 61_000;
    }
    const andere = await holen('win&arch=x64', '6.6.6.6');
    const treffer = await holen('win&arch=x64', '5.5.5.5');
    const zuViele = antworten.filter((a) => a.status === 429);
    const erste = zuViele[0] ? await zuViele[0].json() : {};
    const schluessel = [...new Set(rl.aufrufe)];
    check('Z1-W2 AR70: Selbst-Update: Drossel je IP nur für Abrufe bei GitHub (20 je Periode, dann 429 zu-viele mit Retry-After 60); Treffer im Speicher und andere IP gehen weiter; IP nie im Klartext; KV unberührt',
      antworten.length === 36 && antworten.slice(0, 20).every((a) => a.status !== 429) && zuViele.length === 16 && erste.code === 'zu-viele'
        && erste.error === 'zu viele Anfragen' && zuViele[0].headers.get('Retry-After') === '60' && andere.status === 200
        && treffer.status === 200 && schluessel.length >= 2 && !schluessel.some((s) => s.includes('5.5.5.5') || s.includes('6.6.6.6')));
  }

  // Z1-W2 AR70: Fehlt die Bindung KONTO_RL_SELBSTUPDATE oder wirft limit(), bleibt das Selbst-Update offen (200, nie 5xx), mit Warnung.
  {
    const vorWarn = protokoll.length;
    const ohne = await worker.fetch(req('/tools/launcher/latest?platform=win&arch=x64'), { ...ENV, REPO: 'test/rl-fehlt' });
    const wirftBindung = makeRateLimit(1, { wirft: Object.assign(new Error('test-geheim-meldung-w2'), { name: 'TestFehler' }) });
    const wirft = await worker.fetch(req('/tools/launcher/latest?platform=win&arch=x64'), { ...ENV, REPO: 'test/rl-wirft', KONTO_RL_SELBSTUPDATE: wirftBindung });
    const neu = protokoll.slice(vorWarn);
    check('Z1-W2 AR70: Selbst-Update ohne Bindung → 200 mit Warnung; limit() wirft → 200 mit Warnung (Name der Ausnahme, nie ihre Meldung)',
      ohne.status === 200 && wirft.status === 200 && wirftBindung.aufrufe.length === 1
        && neu.includes('rate-limit: Bindung KONTO_RL_SELBSTUPDATE fehlt — ungedrosselt') && neu.includes('rate-limit: KONTO_RL_SELBSTUPDATE nicht prüfbar (TestFehler) — offen')
        && !neu.join('\n').includes('test-geheim-meldung-w2'));
  }

  // P15 G10: Connect prüft in Teil 1 weiter selbst gegen PROXY_KEY, auch nach ALTKEY_BIS.
  {
    const ns = { jurisdiction() { return ns; }, idFromName: () => ({}), get: () => ({ fetch: async () => new Response('{"ok":true}', { status: 200 }) }) };
    const env = { ...ENV, ALTKEY_BIS: NACH, CONNECT_ROOM: ns };
    const r1 = await worker.fetch(req('/connect/room-1', { method: 'POST', body: { secretHex: 'a'.repeat(64) }, kopf: { 'X-Proxy-Key': PROXY } }), env);
    const r2 = await worker.fetch(req('/connect/room-1', { method: 'POST', body: {} }), env);
    const b2 = await r2.json();
    check('P15 G10: POST /connect/room-1 mit altem Key nach ALTKEY_BIS → erreicht den Raum (200) wie heute', r1.status === 200);
    check('P15 G10: POST /connect/room-1 ohne Key → 401 unauthorized wie heute', r2.status === 401 && b2.error === 'unauthorized');
  }

  // P15 EP25: Katalog, Patch Notes und Kochbuch hängen an einer Sitzung → private statt public.
  {
    const werte = [];
    for (const p of ['/suite.json', '/changelog.json', '/cookbook.json']) {
      werte.push((await worker.fetch(req(p, { kopf: bearer(await sitzung('kollege')) }), ENV)).headers.get('cache-control'));
    }
    check('P15 EP25: /suite.json, /changelog.json, /cookbook.json antworten mit private, max-age=60',
      werte.every((w) => w === 'private, max-age=60'));
    if (!werte.every((w) => w === 'private, max-age=60')) console.log(`     ${werte.join(' | ')}`);
  }

  // P15 OF2: Anfragen mit altem Key zählt der Konten-DO nach der Antwort (waitUntil), ohne Kopfzeilen des Clients.
  {
    const anfragen = [];
    const ns = {
      aufrufe: [],
      jurisdiction(j) { ns.aufrufe.push(`jurisdiction:${j}`); return ns; },
      idFromName(n) { ns.aufrufe.push(`idFromName:${n}`); return { n }; },
      get: () => ({
        fetch: async (r) => {
          anfragen.push({ url: r.url, kopf: [...r.headers.keys()].sort(), body: await r.json() });
          return Response.json({ ok: true });
        },
      }),
    };
    const offen = [];
    const ctx = { waitUntil: (p) => offen.push(p) };
    const env = { ...ENV, ALTKEY_BIS: VOR, KONTO: ns };
    const kopf = { 'X-Proxy-Key': PROXY, Cookie: 'a=b', 'x-connect-admin': '1' };
    const r = await worker.fetch(req('/tools/jm-copy/latest?platform=win&arch=arm64', { kopf }), env, ctx);
    await Promise.all(offen);
    const a = anfragen[0];
    check('P15 OF2: alter Key → 200 und genau eine Zählung über waitUntil (altkey-zaehlen, katalog, win, arm64, jetzt)',
      r.status === 200 && offen.length === 1 && anfragen.length === 1 && a.url === 'https://konto.intern/altkey-zaehlen'
        && JSON.stringify(a.body) === JSON.stringify({ jetzt: T0, gruppe: 'katalog', plattform: 'win', arch: 'arm64' }));
    check('P15 EP1: Konten-DO in der EU, eine Instanz konten', ns.aufrufe.join(' ') === 'jurisdiction:eu idFromName:konten');
    check('P15 B1-Lehre: die Zählanfrage trägt nur content-type, keine Kopfzeile des Clients', !!a && JSON.stringify(a.kopf) === '["content-type"]');
    offen.length = 0;
    anfragen.length = 0;
    const s = await worker.fetch(req('/suite.json', { kopf: bearer(await sitzung('kollege')) }), env, ctx);
    const ohneBindung = await worker.fetch(req('/suite.json', { kopf: { 'X-Proxy-Key': PROXY } }), { ...ENV, ALTKEY_BIS: VOR }, ctx);
    const ohneCtx = await worker.fetch(req('/suite.json', { kopf: { 'X-Proxy-Key': PROXY } }), env);
    check('P15 OF2: Sitzung zählt nicht; ohne KONTO-Bindung oder ohne ctx → 200 ohne Zählung',
      s.status === 200 && ohneBindung.status === 200 && ohneCtx.status === 200 && offen.length === 0 && anfragen.length === 0);
    altKeyMerkerLeeren(); // der Merker der Zählung ist modulweit (Z1-W1): vor dem nächsten Fall zurücksetzen
    const kaputt = { ...env, KONTO: { jurisdiction() { throw new Error('kaputt'); } } };
    const k = await worker.fetch(req('/suite.json', { kopf: { 'X-Proxy-Key': PROXY } }), kaputt, ctx);
    await Promise.all(offen);
    check('P15 OF2: wirft der Konten-DO, bleibt die Antwort 200 und das Log nennt nur den Fehlernamen',
      k.status === 200 && protokoll.includes('konto: Alt-Key-Zählung fehlgeschlagen (Error)'));
  }

  // Z1-W1 (Minor 4): die Alt-Key-Zählung geht höchstens einmal je IP-Hash, Tag und Gruppe an den DO.
  {
    const aufrufe = [];
    const ns = {
      jurisdiction() { return ns; },
      idFromName: () => ({}),
      get: () => ({ fetch: async (r) => { aufrufe.push(await r.json()); return Response.json({ ok: true }); } }),
    };
    const offen = [];
    const ctx = { waitUntil: (p) => offen.push(p) };
    const env = { ...ENV, ALTKEY_BIS: VOR, KONTO: ns };
    const alt = (ip, pfad = '/suite.json') => req(pfad, { kopf: { 'X-Proxy-Key': PROXY, 'CF-Connecting-IP': ip } });
    const sende = async (r, e = env, jetztZeit = T0) => {
      const z = await zugangPruefen(r, e, { funktion: 'katalog', gruppe: 'katalog', jetzt: jetztZeit, ctx });
      await Promise.all(offen.splice(0));
      return z;
    };
    altKeyMerkerLeeren();
    for (let i = 0; i < 6; i++) await sende(alt('1.1.1.1'));
    check('Z1-W1 Minor 4: sechs gleiche Anfragen (derselbe IP-Hash, Tag, Gruppe) → genau ein DO-Aufruf', aufrufe.length === 1 && aufrufe[0].gruppe === 'katalog');
    await sende(alt('2.2.2.2'));
    await sende(alt('1.1.1.1'), env, T0 + TAG);
    const qaZ = await zugangPruefen(alt('1.1.1.1', '/qa/event-1/pending'), env, { funktion: 'qa', gruppe: 'qa', jetzt: T0, ctx });
    await Promise.all(offen.splice(0));
    check(
      'Z1-W1 Minor 4: eine andere IP, ein anderer Tag oder eine andere Gruppe zählt wieder (4 Aufrufe in Summe)',
      qaZ.ok === true && aufrufe.length === 4 && aufrufe.map((a) => a.gruppe).join(',') === 'katalog,katalog,katalog,qa',
    );
    // Scheitert der DO, bleibt der Schlüssel nicht gemerkt: die nächste Anfrage versucht es noch einmal.
    altKeyMerkerLeeren();
    aufrufe.length = 0;
    let faellt = true;
    const wackelig = { jurisdiction() { return wackelig; }, idFromName: () => ({}), get: () => ({ fetch: async (r) => { if (faellt) throw new Error('weg'); aufrufe.push(await r.json()); return Response.json({ ok: true }); } }) };
    const wEnv = { ...env, KONTO: wackelig };
    await sende(alt('3.3.3.3'), wEnv);
    faellt = false;
    await sende(alt('3.3.3.3'), wEnv);
    await sende(alt('3.3.3.3'), wEnv);
    check('Z1-W1 Minor 4: ein gescheiterter DO-Aufruf wird beim nächsten Mal wiederholt, danach nicht mehr (1 Aufruf)', aufrufe.length === 1);
    // Der Merker hat eine Obergrenze: die ältesten Einträge fliegen.
    altKeyMerkerLeeren();
    aufrufe.length = 0;
    for (let i = 0; i < ALTKEY_MERKER_MAX + 5; i++) await sende(alt('10.0.' + Math.floor(i / 250) + '.' + (i % 250)));
    const nachFlut = aufrufe.length;
    await sende(alt('10.0.0.0'));
    check(
      'Z1-W1 Minor 4: der Merker hält höchstens 1000 Einträge (die älteste IP fliegt raus und zählt wieder), altKeyMerkerLeeren setzt ihn zurück',
      nachFlut === ALTKEY_MERKER_MAX + 5 && aufrufe.length === nachFlut + 1 && altKeyMerkerGroesse() === ALTKEY_MERKER_MAX && (altKeyMerkerLeeren(), altKeyMerkerGroesse() === 0),
    );
    altKeyMerkerLeeren();
  }

  // P15 zeitkonstant: kein einfacher Vergleich mit dem Proxy-Key mehr im Gate.
  {
    const w = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
    const z = readFileSync(new URL('../konto-zugang.js', import.meta.url), 'utf8');
    check('P15 zeitkonstant: worker.js und konto-zugang.js vergleichen den Proxy-Key nie mit === oder !==; das Gate fragt zugangPruefen',
      !/[!=]==\s*env\.PROXY_KEY/.test(w) && !/[!=]==\s*env\.PROXY_KEY/.test(z)
        && z.includes('gleichOhneZeitleck(key, env.PROXY_KEY)') && w.includes('await zugangPruefen(request, env, {'));
  }

  // P15 Fix 1 (EP32): Gleichzeitige Anfragen teilen sich EINE Abfrage: 50 Anfragen aus 50 IPs gleichzeitig → 2 Abrufe bei GitHub
  // (Liste, Link), nicht 100; die Drossel zählt die eine Abfrage einmal.
  {
    const env = { ...ENV, REPO: 'test/gleichzeitig', ...makeRLBindungen() };
    const zaehle = () => ghAufrufe.filter((u) => u.includes('/repos/test/gleichzeitig/')).length;
    const res = await Promise.all(
      Array.from({ length: 50 }, (_, i) => worker.fetch(req('/tools/launcher/latest?platform=win&arch=x64', { kopf: { 'CF-Connecting-IP': `7.7.${i}.1` } }), env)),
    );
    const n = zaehle();
    check('P15 Fix 1: 50 gleichzeitige Anfragen aus 50 IPs → alle 200 mit 2 Abrufen bei GitHub (laufende Abfrage geteilt)',
      res.every((r) => r.status === 200) && n === 2);
    if (n !== 2) console.log(`     Abrufe bei GitHub: ${n}`);
  }

  // P15 Fix 2 (OF2): Unbekannte Routen mit dem alten Schlüssel (der steckt in öffentlichen Installern) schreiben nichts in den DO.
  {
    const anfragen = [];
    const ns = { jurisdiction: () => ns, idFromName: () => ({}), get: () => ({ fetch: async (r) => (anfragen.push(r.url), Response.json({ ok: true })) }) };
    const offen = [];
    const ctx = { waitUntil: (p) => offen.push(p) };
    const env = { ...ENV, ALTKEY_BIS: VOR, KONTO: ns };
    const r = await worker.fetch(req('/gibt-es-nicht', { kopf: { 'X-Proxy-Key': PROXY } }), env, ctx);
    const h = await worker.fetch(req('/suite.json', { method: 'HEAD', kopf: { 'X-Proxy-Key': PROXY } }), env, ctx);
    await Promise.all(offen);
    check('P15 Fix 2: alter Key an unbekannter Route (404) oder unerwarteter Methode zählt nicht (kein waitUntil, kein DO-Aufruf)',
      r.status === 404 && h.status === 404 && offen.length === 0 && anfragen.length === 0);
    if (offen.length) console.log(`     waitUntil ${offen.length}, DO-Aufrufe ${anfragen.length}`);
  }

  // P15 Fix 3 (Vertrag 10.3): Ein unbrauchbarer KONTO_SCHLUESSEL (nicht 32 Byte Base64) ist 503 S5, nicht 401 S1.
  {
    const faelle = ['kurz', '', 'AAAA'];
    const ist = [];
    for (const k of faelle) {
      const res = await worker.fetch(req('/suite.json', { kopf: bearer('jm1.a.b') }), { ...ENV, KONTO_SCHLUESSEL: k });
      const b = await res.json();
      ist.push(`${res.status} ${b.code}`);
    }
    check('P15 Fix 3: unbrauchbarer oder leerer KONTO_SCHLUESSEL → 503 nicht-eingerichtet', ist.every((s) => s === '503 nicht-eingerichtet'));
    if (!ist.every((s) => s === '503 nicht-eingerichtet')) console.log(`     ${ist.join(' | ')}`);
  }

  // P15 Fix 4: /tools/:id/latest und das Selbst-Update tragen cache-control: no-store (dieselbe URL: ohne Zugang 401, mit Zugang 200).
  {
    const kopfVon = async (pfad, kopf, e = ENV) => (await worker.fetch(req(pfad, { kopf }), e)).headers.get('cache-control');
    const ist = [
      await kopfVon('/tools/jm-copy/latest?platform=win&arch=x64', { 'X-Proxy-Key': PROXY }),
      await kopfVon('/tools/jm-copy/latest?platform=mac&arch=x64', { 'X-Proxy-Key': PROXY }), // kein Paket für mac → 404
      await kopfVon('/tools/launcher/latest?platform=win&arch=x64', {}),
      await kopfVon('/tools/launcher/latest?platform=win&arch=x64', {}, { ...ENV, REPO: 'test/alt' }), // 0.17.0 ohne Zugang → 401
    ];
    check('P15 Fix 4: /tools/:id/latest (200, 404) und Selbst-Update (200, 401) antworten mit no-store', ist.every((w) => w === 'no-store'));
    if (!ist.every((w) => w === 'no-store')) console.log(`     ${ist.join(' | ')}`);
  }

  // P15 Fix 5 (Review 2): Die Drossel gilt je Anfrage, nicht im geteilten Versprechen. Eine gedrosselte IP (Zähler 30) kommt zuerst,
  // dazu 10 frische IPs gleichzeitig → nur die gedrosselte IP 429, die frischen 10 × 200, 2 Abrufe bei GitHub.
  {
    const rl = makeRateLimit(RL_TABELLE.KONTO_RL_SELBSTUPDATE.grenze);
    const env = { ...ENV, REPO: 'test/gedrosselt', KONTO_RL_SELBSTUPDATE: rl };
    const ipHash = (await sha256B64url(`${SCHLUESSEL}|8.8.8.8`)).slice(0, 22);
    rl.zaehler.set(ipHash, RL_TABELLE.KONTO_RL_SELBSTUPDATE.grenze);
    const ips = ['8.8.8.8', ...Array.from({ length: 10 }, (_, i) => `8.9.${i}.1`)];
    const res = await Promise.all(ips.map((ip) => worker.fetch(req('/tools/launcher/latest?platform=win&arch=x64', { kopf: { 'CF-Connecting-IP': ip } }), env)));
    const n = ghAufrufe.filter((u) => u.includes('/repos/test/gedrosselt/')).length;
    const ist = res.map((r) => r.status).join(' ');
    check('P15 Fix 5: gedrosselte IP zuerst + 10 frische IPs gleichzeitig → 429, dann 10 × 200, 2 Abrufe bei GitHub',
      ist === '429 ' + Array(10).fill(200).join(' ') && n === 2);
    if (n !== 2 || !ist.startsWith('429 200')) console.log(`     ${ist} / Abrufe ${n}`);
  }

  // P15 Fix 6 (Review 2): GitHub wirft bei 10 gleichzeitigen Anfragen → 10 × 502 mit 1 Abruf, kein 500; danach (erholt) 200.
  // Dazu direkt: wirft hole() selbst (etwa res.text()), bekommen alle Wartenden 502 statt einer Ausnahme.
  {
    const env = { ...ENV, REPO: 'test/wirft', ...makeRLBindungen() };
    const zaehle = () => ghAufrufe.filter((u) => u.includes('/repos/test/wirft/')).length;
    githubWirft = true;
    const res = await Promise.all(
      Array.from({ length: 10 }, (_, i) => worker.fetch(req('/tools/launcher/latest?platform=win&arch=x64', { kopf: { 'CF-Connecting-IP': `8.10.${i}.1` } }), env)),
    );
    const n = zaehle();
    githubWirft = false;
    const danach = await worker.fetch(req('/tools/launcher/latest?platform=win&arch=x64'), env);
    check('P15 Fix 6: GitHub wirft bei 10 gleichzeitigen Anfragen → 10 × 502 mit 1 Abruf; nach der Erholung 200',
      res.every((r) => r.status === 502) && n === 1 && danach.status === 200);
    if (!res.every((r) => r.status === 502) || n !== 1) console.log(`     ${res.map((r) => r.status).join(' ')} / Abrufe ${n}`);
    const direkt = await Promise.all(
      Array.from({ length: 10 }, () =>
        selbstUpdateLiefern(req('/tools/launcher/latest'), { ...ENV, REPO: 'test/hole-wirft' }, {
          jetzt, zugang: { ok: false, status: 401, error: 'x', code: 'nicht-angemeldet' }, platform: 'win', arch: 'x64',
          hole: async () => { await new Promise((r) => setTimeout(r, 5)); throw new Error('boom'); },
        }).then((r) => r.status, () => 'Ausnahme'),
      ),
    );
    check('P15 Fix 6: wirft hole() selbst, bekommen alle Wartenden 502 (keine Ausnahme)', direkt.every((s) => s === 502));
    if (!direkt.every((s) => s === 502)) console.log(`     ${direkt.join(' ')}`);
  }

  // P15 Fix 7 (Review 3): Eine laufende Abfrage hat eine Frist (15 s). Hängt hole() für immer (workerd bricht die Aufgaben eines
  // getrennten Clients ab), bekommt eine Anfrage 61 s später (gefälschte Uhr), bei gesundem GitHub, trotzdem 200.
  {
    const gut = () => new Response('{"version":"0.18.0"}', { status: 200 });
    const lauf = (e, jetztMs, hole, ctx) =>
      selbstUpdateLiefern(req('/tools/launcher/latest'), e, { jetzt: jetztMs, zugang: { ok: false, status: 401, error: 'x', code: 'nicht-angemeldet' }, platform: 'win', arch: 'x64', hole, ctx });
    const e1 = { ...ENV, REPO: 'test/haenger' };
    void lauf(e1, T0, () => new Promise(() => {})); // der Starter, dessen hole() nie fertig wird
    // Wer an der hängenden Abfrage klebt, würde nie fertig: der Wettlauf mit einem Zeitgeber macht das als Fehler sichtbar.
    const spaet = await Promise.race([lauf(e1, T0 + 61_000, async () => gut()), new Promise((r) => setTimeout(() => r({ status: 'haengt' }), 500))]);
    check('P15 Fix 7a: hängt hole() für immer, antwortet eine Anfrage 61 s später (gesundes GitHub) mit 200', spaet.status === 200);

    // (b) Der Starter hängt seine Abfrage an ctx.waitUntil; wer beitritt, nicht.
    const e2 = { ...ENV, REPO: 'test/waituntil' };
    const gemerkt = [];
    const ctx = { waitUntil: (p) => gemerkt.push(p) };
    const hole2 = async () => (await new Promise((r) => setTimeout(r, 5)), gut());
    const [r1, r2] = await Promise.all([lauf(e2, T0, hole2, ctx), lauf(e2, T0, hole2, ctx)]);
    const erg = gemerkt.length === 1 ? await gemerkt[0] : null;
    check('P15 Fix 7b: der Starter ruft ctx.waitUntil genau einmal mit der geteilten Abfrage auf (Beitretende nicht)',
      r1.status === 200 && r2.status === 200 && gemerkt.length === 1 && !!erg && erg.art === 'eintrag');

    // (c) Ein alter, endlich fertig werdender Abruf löscht keinen neueren Eintrag: C tritt B bei (2 Abrufe, nicht 3).
    const e3 = { ...ENV, REPO: 'test/alt-neu' };
    let aufrufe = 0;
    const tore = [];
    const holeTor = () => new Promise((r) => (aufrufe++, tore.push(() => r(new Response('{}', { status: 502 })))));
    const pa = lauf(e3, T0, holeTor); // A
    const pb = lauf(e3, T0 + 16_000, holeTor); // B: A ist zu alt, B startet neu
    await new Promise((r) => setTimeout(r, 5));
    tore[0](); // A endet jetzt (finally)
    await pa;
    const pc = lauf(e3, T0 + 16_500, holeTor); // C: muss B beitreten
    await new Promise((r) => setTimeout(r, 5));
    const abrufeC = aufrufe;
    tore.forEach((fn) => fn());
    await Promise.all([pb, pc]);
    check('P15 Fix 7c: ein alter Abruf löscht keinen neueren Eintrag (A, B, C → 2 Abrufe, C tritt B bei)', abrufeC === 2);
    if (abrufeC !== 2) console.log(`     Abrufe ${abrufeC}`);
  }

  // Z1-W2 [T]: Zwischenspeicher des Selbst-Updates mit Restlaufzeit: 59,999 s nach dem Abruf noch aus dem Speicher, nach genau 60 s neu.
  {
    let uhr = T0;
    const env = { ...ENV, REPO: 'test/ttl', KONTO_UHR: () => uhr, ...makeRLBindungen() };
    const zaehle = () => ghAufrufe.filter((u) => u.includes('/repos/test/ttl/')).length;
    const holen = () => worker.fetch(req('/tools/launcher/latest?platform=win&arch=x64'), env);
    await holen();
    const erst = zaehle();
    uhr = T0 + 59_999;
    await holen();
    const knapp = zaehle();
    uhr = T0 + 60_000;
    await holen();
    const genau = zaehle();
    check('Z1-W2 [T] EP32: Zwischenspeicher 60 s: 2 Abrufe beim ersten Mal, bei +59,999 s weiter 2, bei +60 s neu (4)', erst === 2 && knapp === 2 && genau === 4);
  }

  // Z1-W2 [T]: Hash-Präfix der IP: ipHash = die ersten 22 Zeichen von sha256B64url(KONTO_SCHLUESSEL|ip); anderer Schlüssel, andere IP
  // oder fehlender Kopf (unknown) ergeben andere Werte; die IP steht nie darin.
  {
    const mitIp = (ip) => new Request('https://proxy.test/x', { headers: ip === null ? {} : { 'CF-Connecting-IP': ip } });
    const h = await ipHash(mitIp('4.3.2.1'), ENV);
    const voll = await sha256B64url(`${SCHLUESSEL}|4.3.2.1`);
    const andereIp = await ipHash(mitIp('4.3.2.2'), ENV);
    const andererSchluessel = await ipHash(mitIp('4.3.2.1'), { ...ENV, KONTO_SCHLUESSEL: FREMD });
    const ohneKopf = await ipHash(mitIp(null), ENV);
    check('Z1-W2 [T] ipHash: genau die ersten 22 Zeichen von sha256B64url(Schlüssel|ip), je IP und je Schlüssel verschieden, ohne Kopf = unknown, nie die IP',
      h === voll.slice(0, 22) && h.length === 22 && voll.length === 43 && h !== andereIp && h !== andererSchluessel
        && ohneKopf === (await sha256B64url(`${SCHLUESSEL}|unknown`)).slice(0, 22) && !h.includes('4.3.2.1'));
  }

  // Z1-W2 [T] Wächter Routen ↔ funktionFuerRoute: jede Gate-Route in worker.js (Methode und Pfad) ist in funktionFuerRoute geführt (nicht null),
  // und kein Pfad der /konto/-Routen (Launcher-API, eigene Prüfung in konto-relay.js) ist es.
  {
    const w = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
    const rq = readFileSync(new URL('../konto-relay.js', import.meta.url), 'utf8');
    const gate = [...w.matchAll(/request\.method === '(GET|POST|DELETE)' && url\.pathname === '(\/[^']+)'/g)].map((m) => [m[1], m[2]]).filter(([, p]) => p !== '/');
    const konto = [...rq.matchAll(/^\s+'(GET|POST) (\/konto[^']*)':/gm)].map((m) => [m[1], m[2]]);
    const ohneFunktion = gate.filter(([m, p]) => funktionFuerRoute(m, p) === null);
    const kontoMitFunktion = konto.filter(([m, p]) => funktionFuerRoute(m, p) !== null);
    check(`Z1-W2 [T] Wächter: alle ${gate.length} Gate-Routen in worker.js haben eine Funktion in funktionFuerRoute${ohneFunktion.length ? ` — ohne: ${JSON.stringify(ohneFunktion)}` : ''}; keine der ${konto.length} /konto/-Routen hat eine`,
      gate.length >= 5 && ohneFunktion.length === 0 && konto.length >= 16 && kontoMitFunktion.length === 0
        && funktionFuerRoute('GET', '/tools/jm-copy/latest') === 'katalog' && w.includes('url.pathname.match(/^\\/tools\\/([^/]+)\\/latest\\/?$/)'));
  }

  // P20 EP1, EP9, EP24: Bindung, Migration und Variable in wrangler.toml, Re-Export im Worker, CI-Schritte.
  {
    const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    // Kleiner TOML-Leser (Fixrunde 1): Tabellenkopf mitführen, Schlüssel ohne Anführungszeichen, Kommentare weg. Ein Schlüssel zählt
    // nur in seiner Tabelle (ein ALTKEY_BIS ganz oben sähe der Worker nicht, ein deleted_classes in v2 löschte den DO).
    const tabellen = [{ kopf: '', feld: false, kv: [] }];
    for (const z of toml.split('\n')) {
      const s = z.trim();
      if (!s || s.startsWith('#')) continue;
      const kopf = /^(\[\[?)\s*([^\]]+?)\s*\]\]?$/.exec(s);
      if (kopf) { tabellen.push({ kopf: kopf[2], feld: kopf[1] === '[[', kv: [] }); continue; }
      const kv = /^(["']?)([A-Za-z0-9_.-]+)\1\s*=\s*(.*)$/.exec(s);
      if (kv) tabellen[tabellen.length - 1].kv.push([kv[2], kv[3].trim()]);
    }
    const nurSchluessel = (t, namen) => JSON.stringify(t.kv.map(([k]) => k)) === JSON.stringify(namen);
    const migTab = tabellen.filter((t) => t.kopf === 'migrations');
    const bindTab = tabellen.filter((t) => t.kopf === 'durable_objects.bindings');
    const varsTab = tabellen.filter((t) => t.kopf === 'vars' && !t.feld);
    const migrationen = migTab.filter((t) => t.feld && nurSchluessel(t, ['tag', 'new_sqlite_classes'])).map((t) => `${t.kv[0][1].replace(/"/g, '')}:${t.kv[1][1].replace(/^\[|\]$/g, '')}`);
    const bindungen = bindTab.filter((t) => t.feld && nurSchluessel(t, ['name', 'class_name'])).map((t) => `${t.kv[0][1].replace(/"/g, '')}=${t.kv[1][1].replace(/"/g, '')}`);
    const inVars = (n) => (varsTab.length === 1 ? varsTab[0].kv.filter(([k]) => k === n).map(([, w]) => w) : []);
    check('P20 EP1: wrangler.toml: Bindung KONTO → KontoSpeicher, Migration v1 unverändert und genau eine v2 mit KontoSpeicher, KONTO_JURISDICTION und CONNECT_JURISDICTION eu',
      migTab.length === 2 && migrationen.length === 2 && JSON.stringify(migrationen) === JSON.stringify(['v1:"ConnectRoom"', 'v2:"KontoSpeicher"'])
        && bindTab.length === 2 && bindungen.length === 2 && JSON.stringify(bindungen) === JSON.stringify(['CONNECT_ROOM=ConnectRoom', 'KONTO=KontoSpeicher'])
        && varsTab.length === 1 && JSON.stringify(inVars('KONTO_JURISDICTION')) === '["\\"eu\\""]' && JSON.stringify(inVars('CONNECT_JURISDICTION')) === '["\\"eu\\""]'
        && tabellen.every((t) => t.kopf === 'vars' || !t.kv.some(([k]) => k.endsWith('_JURISDICTION'))));
    // Z1-W2 AR70: genau die sechs [[ratelimits]] der Tabelle (Name, namespace_id, limit, period), je gefolgt von [ratelimits.simple]
    // mit nur limit und period; period nur 10 oder 60; die Namen in KONTO_RL (konto-zugang.js) sind genau diese sechs.
    const rlTabellen = tabellen.filter((t) => t.kopf.startsWith('ratelimits'));
    const rlEintraege = [];
    let rlAufbauOk = rlTabellen.length === 12;
    for (let i = 0; i + 1 < rlTabellen.length; i += 2) {
      const [a, s] = [rlTabellen[i], rlTabellen[i + 1]];
      if (a.kopf !== 'ratelimits' || !a.feld || !nurSchluessel(a, ['name', 'namespace_id']) || s.kopf !== 'ratelimits.simple' || s.feld || !nurSchluessel(s, ['limit', 'period'])) {
        rlAufbauOk = false;
        continue;
      }
      const wert = (t, n) => t.kv.find(([k]) => k === n)[1];
      // AR79: die ROHwerte, nicht die entquoteten: namespace_id ist ein String (Doku), name ein KONTO_RL_-Name, limit und period Zahlen.
      if (!/^"KONTO_RL_[A-Z]+"$/.test(wert(a, 'name')) || !/^"\d+"$/.test(wert(a, 'namespace_id')) || !/^\d+$/.test(wert(s, 'limit')) || !/^\d+$/.test(wert(s, 'period'))) rlAufbauOk = false;
      rlEintraege.push([wert(a, 'name').replace(/^"|"$/g, ''), wert(a, 'namespace_id').replace(/^"|"$/g, ''), Number(wert(s, 'limit')), Number(wert(s, 'period'))]);
    }
    const rlSoll = Object.entries(RL_TABELLE).map(([n, t]) => [n, t.namespaceId, t.grenze, t.period]);
    check('Z1-W2 AR70: wrangler.toml hat genau sechs [[ratelimits]] mit [ratelimits.simple] (Name, namespace_id, limit, period wie die Tabelle), period 10 oder 60; KONTO_RL nennt genau diese Namen',
      rlAufbauOk && JSON.stringify(rlEintraege) === JSON.stringify(rlSoll) && rlEintraege.every(([, , l, p]) => Number.isInteger(l) && l > 0 && (p === 10 || p === 60))
        && new Set(rlEintraege.map((e) => e[0])).size === 6 && new Set(rlEintraege.map((e) => e[1])).size === 6
        && JSON.stringify(Object.values(KONTO_RL).sort()) === JSON.stringify(rlSoll.map((e) => e[0]).sort()));
    // ALTKEY_BIS mit derselben Regel wie der Worker: ein unlesbarer Wert (z. B. 2026-12-32) hieße dort still „unbefristet“ (EP9).
    const { alterKeyGilt } = await import('../konto-kern.js');
    const alleSchluessel = tabellen.flatMap((t) => t.kv.map(([k]) => k));
    const geheim = /^(KONTO_SCHLUESSEL|IVEO_SCHLUESSEL|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|ERSTER_ADMIN|PROXY_KEY|ALTKEY_CONNECT_BIS|GITHUB_TOKEN|ANTHROPIC_API_KEY|ZOOM_SDK_KEY|RTC_.*)$/;
    const bisAlle = tabellen.flatMap((t) => t.kv.filter(([k]) => k === 'ALTKEY_BIS'));
    const bisWert = inVars('ALTKEY_BIS');
    const bis = bisWert.length === 1 ? /^"([^"]*)"$/.exec(bisWert[0]) : null;
    check('P20 EP9, G4: keine Secrets in [vars], ALTKEY_CONNECT_BIS in Teil 1 nicht gesetzt, ALTKEY_BIS höchstens als lesbares Datum; alle Namen beschrieben',
      !alleSchluessel.some((k) => geheim.test(k))
        && (bisAlle.length === 0
          || (bisAlle.length === 1 && bisWert.length === 1 && !!bis && /^\d{4}-\d{2}-\d{2}(T.+)?$/.test(bis[1]) && alterKeyGilt({ ALTKEY_BIS: bis[1] }, 'katalog', 0).diagnose === null))
        && ['KONTO_SCHLUESSEL', 'IVEO_SCHLUESSEL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'ERSTER_ADMIN', 'ALTKEY_BIS', 'ALTKEY_CONNECT_BIS'].every((n) => toml.includes(n)));
    const modul = await import('../worker.js');
    const { KontoSpeicher } = await import('../konto-do.js');
    check('P20 EP1: worker.js exportiert ConnectRoom und KontoSpeicher (Durable-Object-Klassen aus wrangler.toml)',
      modul.KontoSpeicher === KontoSpeicher && typeof modul.ConnectRoom === 'function' && typeof modul.default.fetch === 'function');
    const ci = readFileSync(new URL('../../../.github/workflows/ci-checks.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    // Fixrunde 1: Kommentare weg, nur verankerte run-Zeilen, und keiner dieser Schritte trägt if oder continue-on-error.
    // Z1-W2: auch `- if:` oder `- continue-on-error:` als ERSTE Zeile eines Schritts und `- run:` als erste Zeile zählen.
    const laeufeAus = (text) => {
      const schritte = text.split('\n').filter((z) => !z.trim().startsWith('#')).join('\n').split(/^(?=\s*- )/m);
      const proxySchritte = schritte.map((b) => ({ b, m: /^\s*(?:-\s+)?run: node --experimental-strip-types services\/release-proxy\/test\/([a-z-]+)\.test\.mjs\s*$/m.exec(b) })).filter((x) => x.m);
      const l = proxySchritte.map((x) => x.m[1]);
      if (proxySchritte.some((x) => /^\s*(?:-\s+)?(if|continue-on-error)\s*:/m.test(x.b))) l.push('bedingt');
      return l;
    };
    const laeufe = laeufeAus(ci);
    const lauf = 'node --experimental-strip-types services/release-proxy/test/konto-kern.test.mjs';
    const yml = (...zeilen) => `jobs:\n  x:\n    steps:\n${zeilen.map((z) => `      ${z}`).join('\n')}\n`;
    check('Z1-W2 [T] EP24-Wächter: erkennt if und continue-on-error auch als erste Zeile eines Schritts (- if:), an zweiter Stelle, und - run: als erste Zeile; ein Kommentar zählt nicht',
      JSON.stringify(laeufeAus(yml('- name: A', `  run: ${lauf}`))) === '["konto-kern"]'
        && JSON.stringify(laeufeAus(yml(`- run: ${lauf}`))) === '["konto-kern"]'
        && JSON.stringify(laeufeAus(yml("- if: github.ref == 'refs/heads/main'", `  run: ${lauf}`))) === '["konto-kern","bedingt"]'
        && JSON.stringify(laeufeAus(yml('- continue-on-error: true', `  run: ${lauf}`))) === '["konto-kern","bedingt"]'
        && JSON.stringify(laeufeAus(yml('- name: A', "  if: always()", `  run: ${lauf}`))) === '["konto-kern","bedingt"]'
        && JSON.stringify(laeufeAus(yml('- name: A', '  continue-on-error: true', `  run: ${lauf}`))) === '["konto-kern","bedingt"]'
        && JSON.stringify(laeufeAus(yml('# - if: x', '- name: A', `  run: ${lauf}`))) === '["konto-kern"]');
    check('P20 EP24: ci-checks.yml startet die Proxy-Tests in dieser Reihenfolge: worker, konto-kern, konto-krypto, konto-do, konto-zugang, konto-routen, qa-relay',
      JSON.stringify(laeufe) === JSON.stringify(['worker', 'konto-kern', 'konto-krypto', 'konto-do', 'konto-zugang', 'konto-routen', 'qa-relay']));
  }

  // ── Ende der Fälle ──

  // P15 G4: Kein Geheimnis in der Konsole (läuft als letzter Fall über das ganze Protokoll).
  const alles = protokoll.join('\n');
  check('P15 G4: Konsole ohne Proxy-Key, Konto-Schlüssel und Token', !alles.includes(PROXY) && !alles.includes(SCHLUESSEL) && !alles.includes('jm1.'));
}

run()
  .catch((e) => {
    check(`P15 Test-Harness ohne Ausnahme (${e && e.name})`, false);
    realError(e);
  })
  .finally(() => {
    console.warn = realWarn;
    console.error = realError;
    abschluss();
  });

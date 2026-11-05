// Anmeldung im Launcher (Teil 1) · P14: iveo-Tokens im Speicher und „Abgleich hier“ (src/main/konto/iveo-zentral.ts) nach
// Verhalten 11.4 (IV1, IV5) und OFP1, OFP3 — ohne Electron, ohne Netz (tsx). Die Naht in settings.ts verdrahtet Task 23.
import { readFileSync } from 'node:fs';
import { IVEO_ERLAUBTE_BASEN, iveoBasisErlaubt, kanonischeIveoBasis } from '@jm/iveo';
import {
  erzeugeIveoZentral, iveoHinterlegenBasis, iveoSchluessel, LOKAL_FRIST_MS, lokaleLoeschen, type IveoLage,
} from '../src/main/konto/iveo-zentral';
import { kreuz, pruefeFaelle } from './konto-rechte.test';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const PROD = 'https://app.my-iveo.de/api/v1';
const STAGING = 'https://staging-dev.my-iveo.de/api/v1';
const T0 = Date.UTC(2026, 9, 21, 12, 0, 0);
const TAG = 86_400_000;

// --- P14 EP13: Schlüssel eines Events ------------------------------------------------------------------------------------
ck('P14 EP13: iveoSchluessel normalisiert die Basis wie settings.ts (Schrägstrich, ohne Schema, leer = Standard, kaputt wirft nicht)',
  iveoSchluessel(`${PROD}/`, 'cop31') === `${PROD}|cop31` && iveoSchluessel('app.my-iveo.de/api/v1', ' cop31 ') === `${PROD}|cop31`
  && iveoSchluessel('', 'cop31') === `${PROD}|cop31` && iveoSchluessel('https://', 'x') === 'https:|x');

// --- P14 IV1: tokenFuer als Kreuzprodukt -----------------------------------------------------------------------------------
{
  const SPEICHER = {
    'leer': [],
    'genau': [{ key: `${PROD}|cop31`, basis: PROD, slug: 'cop31', name: 'COP31', token: 'tok-genau' }],
    'Slug eindeutig': [{ key: `${STAGING}|cop31`, basis: STAGING, slug: 'cop31', name: 'COP31', token: 'tok-staging' }],
    // Z1 (OE2): der Eintrag auf x.my-iveo.de steht nicht in der festen Liste und zählt nie, auch nicht für die Eindeutigkeit des Slugs.
    'Slug mit Fremdeintrag': [
      { key: `${STAGING}|cop31`, basis: STAGING, slug: 'cop31', name: 'COP31', token: 'tok-staging' },
      { key: 'https://x.my-iveo.de/api/v1|cop31', basis: 'https://x.my-iveo.de/api/v1', slug: 'cop31', name: 'COP31', token: 'tok-x' },
    ],
  };
  const ABGLEICH = { 'keiner': [] as string[], 'genau': [`${PROD}|cop31`], 'Slug': [`${STAGING}|cop31`], 'anderes Event': [`${PROD}|anders`] };
  // Dritter Wert: Hinweis des Workers beim Laden (EP31: ohne IVEO_SCHLUESSEL „iveo-nicht-eingerichtet“).
  const LAGEN = {
    'angemeldet, geladen': [true, true, null], 'angemeldet, geladen, Server ohne iveo': [true, true, 'iveo-nicht-eingerichtet'],
    'angemeldet, nicht geladen': [true, false, null], 'nicht angemeldet': [false, false, null],
  } as const;
  const faelle = kreuz({
    s: Object.keys(SPEICHER) as Array<keyof typeof SPEICHER>, lokal: [false, true], env: [false, true],
    a: Object.keys(ABGLEICH) as Array<keyof typeof ABGLEICH>, l: Object.keys(LAGEN) as Array<keyof typeof LAGEN>,
  });
  const r = pruefeFaelle('P14 IV1: tokenFuer (Speicher × lokal × Env × Abgleich hier × Lage)', faelle, (f) => {
    const z = erzeugeIveoZentral();
    z.setze(SPEICHER[f.s], T0, LAGEN[f.l][2]);
    const lage: IveoLage = {
      angemeldet: LAGEN[f.l][0], geladen: LAGEN[f.l][1], abgleichHier: ABGLEICH[f.a],
      lokal: (slug) => (f.lokal && slug === 'cop31' ? 'tok-lokal' : undefined), env: f.env ? 'tok-env' : undefined, standardBasis: PROD,
    };
    const ist = z.tokenFuer('cop31', undefined, lage);
    let soll: { token: string | undefined; grund: string };
    const markiert = f.a === 'genau' || f.a === 'Slug';
    const ausSpeicher = f.s === 'genau' ? 'tok-genau' : f.s === 'Slug eindeutig' || f.s === 'Slug mit Fremdeintrag' ? 'tok-staging' : undefined;
    if (f.env) soll = { token: 'tok-env', grund: 'ok' };
    else if (!markiert && !f.lokal) soll = { token: undefined, grund: 'kein-abgleich-hier' };
    else if (ausSpeicher) soll = { token: ausSpeicher, grund: 'ok' };
    else if (f.lokal) soll = { token: 'tok-lokal', grund: 'ok' };
    else if (!LAGEN[f.l][0]) soll = { token: undefined, grund: 'nicht-angemeldet' };
    else if (!LAGEN[f.l][1]) soll = { token: undefined, grund: 'noch-nicht-geladen' };
    else if (LAGEN[f.l][2]) soll = { token: undefined, grund: 'nicht-eingerichtet' };
    else soll = { token: undefined, grund: 'nicht-hinterlegt' };
    return ist.token === soll.token && ist.grund === soll.grund ? null
      : `${f.s}/${f.lokal ? 'lokal' : '-'}/${f.env ? 'env' : '-'}/${f.a}/${f.l}: ist ${ist.token ?? '-'} ${ist.grund}, soll ${soll.token ?? '-'} ${soll.grund}`;
  });
  ck(r.name, r.ok);
}
{
  const z = erzeugeIveoZentral();
  z.setze([
    { key: `${PROD}|cop31`, basis: PROD, slug: 'cop31', name: 'COP31', token: 'tok-prod' },
    { key: `${STAGING}|cop31`, basis: STAGING, slug: 'cop31', name: 'COP31 Probe', token: 'tok-staging' },
  ], T0);
  const lage = (abgleichHier: string[]): IveoLage => ({ angemeldet: true, geladen: true, abgleichHier, lokal: () => undefined, env: undefined, standardBasis: PROD });
  const a = z.tokenFuer('cop31', STAGING, lage([`${STAGING}|cop31`]));
  const b = z.tokenFuer('cop31', undefined, lage([`${PROD}|cop31`]));
  const c = z.tokenFuer('cop31', 'https://x.my-iveo.de/api/v1', lage([`${PROD}|cop31`, `${STAGING}|cop31`]));
  ck('P14 IV1: Schlüssel genau vor eindeutigem Slug; Basis der Bindung zählt; mehrdeutiger Slug und mehrdeutige Markierung zählen nicht',
    a.token === 'tok-staging' && b.token === 'tok-prod' && c.token === undefined && c.grund === 'kein-abgleich-hier');
}

// --- P14 EP13: erlaubte Events ohne Token, setze und leere ----------------------------------------------------------------
{
  const z = erzeugeIveoZentral();
  z.setze([
    { key: 'egal', basis: `${PROD}/`, slug: 'cop31', name: 'COP31', token: 'tok-geheim-1' },
    { key: 'doppelt', basis: PROD, slug: 'cop31', name: 'COP31 doppelt', token: 'tok-geheim-2' },
    { key: 'leer', basis: PROD, slug: '', name: 'ohne Slug', token: 'tok-geheim-3' },
    { key: 'ohne', basis: PROD, slug: 'messe', name: 'Messe', token: '' },
  ], T0);
  const ev = z.erlaubteEvents();
  const json = JSON.stringify(ev);
  z.setze([], T0, 'iveo-nicht-eingerichtet');
  z.leere();
  const nachLeeren = z.tokenFuer('cop31', undefined, { angemeldet: false, geladen: false, abgleichHier: [`${PROD}|cop31`], lokal: () => undefined, env: undefined, standardBasis: PROD });
  const geladenNachLeeren = z.tokenFuer('cop31', undefined, { angemeldet: true, geladen: true, abgleichHier: [`${PROD}|cop31`], lokal: () => undefined, env: undefined, standardBasis: PROD });
  ck('P14 EP13: erlaubteEvents ohne Token (Schlüssel lokal normalisiert, doppelte und unvollständige Einträge fallen weg); leere() vergisst alles',
    ev.length === 1 && json === JSON.stringify([{ key: `${PROD}|cop31`, basis: `${PROD}/`, slug: 'cop31', name: 'COP31' }])
    && !json.includes('tok-geheim') && z.erlaubteEvents().length === 0 && nachLeeren.token === undefined && nachLeeren.grund === 'nicht-angemeldet'
    && geladenNachLeeren.grund === 'nicht-hinterlegt');
}

// --- P14 G5, Spec 6.3: eine kürzere Liste nimmt kein Token weg, das dieser Lauf schon hat (Nachfix 1, Nachprüfung 1) --------
// Die Hülle lädt die Tokens alle 5 min neu. Entfernt ein Admin ein Event oder wird das Konto herabgestuft, behält der laufende
// Launcher das Token bis zum Abmelden oder Neustart (M34); die erlaubten Events folgen dem Server, ein neues Token ersetzt das alte.
{
  const z = erzeugeIveoZentral();
  const lage: IveoLage = { angemeldet: true, geladen: true, abgleichHier: [`${PROD}|cop31`], lokal: () => undefined, env: undefined, standardBasis: PROD };
  const ev = (slug: string, token: string) => ({ key: `${PROD}|${slug}`, basis: PROD, slug, name: slug.toUpperCase(), token });
  z.setze([ev('cop31', 'tok-alt'), ev('messe', 'tok-messe')], T0);
  z.setze([ev('messe', 'tok-messe')], T0 + 300_000);
  const nachTakt = z.tokenFuer('cop31', undefined, lage);
  const erlaubt = z.erlaubteEvents().map((e) => e.slug).join(',');
  z.setze([], T0 + 600_000, 'iveo-nicht-eingerichtet');
  const ohneServer = z.tokenFuer('cop31', undefined, lage);
  z.setze([ev('cop31', 'tok-neu')], T0 + 900_000);
  z.setze([], T0 + 1_200_000);
  const ersetzt = z.tokenFuer('cop31', undefined, lage);
  z.leere();
  const nachAbmelden = z.tokenFuer('cop31', undefined, lage);
  const neustart = erzeugeIveoZentral();
  neustart.setze([ev('messe', 'tok-messe')], T0);
  const nachNeustart = neustart.tokenFuer('cop31', undefined, lage);
  ck('P14 G5, Spec 6.3: Liste schrumpft (Event entfernt, Stufe herabgesetzt) → das Token bleibt für den laufenden Abgleich bis zum Abmelden oder Neustart, die erlaubten Events folgen dem Server, ein neues Token ersetzt das alte',
    nachTakt.token === 'tok-alt' && nachTakt.grund === 'ok' && erlaubt === 'messe' && ohneServer.token === 'tok-alt'
    && ersetzt.token === 'tok-neu' && nachAbmelden.token === undefined && nachAbmelden.grund === 'nicht-hinterlegt'
    && nachNeustart.token === undefined && nachNeustart.grund === 'nicht-hinterlegt');
}

// --- P14 IV5, OFP1: lokale Tokens löschen ------------------------------------------------------------------------------------
{
  const ZENTRAL = [`${PROD}|cop31`, `${STAGING}|probe`, `${PROD}|doppelt`, `${STAGING}|doppelt`, `${STAGING}|zwei`, 'https://x.my-iveo.de/api/v1|zwei'];
  const LOKAL = { 'zentral genau': 'cop31', 'zentral andere Basis': 'probe', 'zentral genau, Slug doppelt': 'doppelt', 'zentral mehrdeutig': 'zwei', 'nicht zentral': 'messe', 'Basis-Token': `base:${PROD}` };
  const ZEIT = { 'vor der Frist': T0 + LOKAL_FRIST_MS - 1, 'genau an der Frist': T0 + LOKAL_FRIST_MS, 'nach der Frist': T0 + LOKAL_FRIST_MS + TAG };
  const faelle = kreuz({ k: Object.keys(LOKAL) as Array<keyof typeof LOKAL>, t: Object.keys(ZEIT) as Array<keyof typeof ZEIT>, offen: [false, true] });
  const r = pruefeFaelle('P14 IV5: lokaleLoeschen (OFP1: zentral hinterlegt → markieren und löschen, sonst nach 30 Tagen, nie bei offener iveo-Show)', faelle, (f) => {
    const slug = LOKAL[f.k];
    const e = lokaleLoeschen({ lokaleSlugs: [slug], zentral: ZENTRAL, ersteAnmeldung: T0, jetzt: ZEIT[f.t], iveoShowOffen: f.offen, standardBasis: PROD });
    const frist = f.t !== 'vor der Frist';
    let soll: { loeschen: string[]; markieren: string[]; bleiben: string[] };
    if (f.offen) soll = { loeschen: [], markieren: [], bleiben: [slug] };
    else if (f.k === 'zentral genau') soll = { loeschen: [slug], markieren: [`${PROD}|cop31`], bleiben: [] };
    else if (f.k === 'zentral andere Basis') soll = frist ? { loeschen: [slug], markieren: [`${STAGING}|probe`], bleiben: [] } : { loeschen: [], markieren: [], bleiben: [slug] };
    else if (f.k === 'zentral genau, Slug doppelt') soll = { loeschen: [slug], markieren: [`${PROD}|doppelt`], bleiben: [] };
    else if (f.k === 'Basis-Token') soll = frist ? { loeschen: [slug], markieren: [], bleiben: [] } : { loeschen: [], markieren: [], bleiben: [slug] };
    else if (f.k === 'zentral mehrdeutig') soll = frist ? { loeschen: [slug], markieren: [`${PROD}|zwei`], bleiben: [] } : { loeschen: [], markieren: [], bleiben: [slug] };
    else soll = frist ? { loeschen: [slug], markieren: [`${PROD}|messe`], bleiben: [] } : { loeschen: [], markieren: [], bleiben: [slug] };
    const ist = JSON.stringify({ loeschen: e.loeschen, markieren: e.markieren, bleiben: e.bleiben });
    return ist === JSON.stringify(soll) && e.spaetestens === T0 + LOKAL_FRIST_MS ? null : `${f.k}/${f.t}/${f.offen ? 'Show offen' : 'zu'}: ist ${ist}, soll ${JSON.stringify(soll)}`;
  });
  ck(r.name, r.ok);
  const alle = lokaleLoeschen({ lokaleSlugs: ['cop31', 'messe', 'probe', 'messe2'], zentral: ZENTRAL, ersteAnmeldung: T0, jetzt: T0 + LOKAL_FRIST_MS, iveoShowOffen: false, standardBasis: PROD });
  ck('P14 IV5: nach dem Löschen hat jedes gelöschte Event eine Markierung „Abgleich hier“ (nichts hört still auf abzugleichen)',
    alle.loeschen.length === 4 && alle.bleiben.length === 0
    && alle.loeschen.every((s) => alle.markieren.some((m) => m.endsWith(`|${s}`))) && LOKAL_FRIST_MS === 30 * TAG);
}

// --- P14 Review (HIGH): eine übergebene fremde Basis bekommt kein Token über den Slug-Rückfall ------------------------------
// Eine präparierte .jmshow mit fremder iveo.baseUrl darf das Token von PROD nicht auf einen fremden Host lenken.
{
  const lage: IveoLage = { angemeldet: true, geladen: true, abgleichHier: [`${PROD}|cop31`], lokal: () => undefined, env: undefined, standardBasis: PROD };
  const faelle = kreuz({
    basis: ['https://evil.example/api/v1', 'http://app.my-iveo.de/api/v1', 'https://x.my-iveo.de/api/v1'], wo: ['zentral', 'frueher'],
  });
  const r = pruefeFaelle('P14 Review: übergebene fremde Basis, eindeutiger Slug → kein Token (fremder Host, http statt https; zentral und früher)', faelle, (f) => {
    const z = erzeugeIveoZentral();
    z.setze([{ key: `${PROD}|cop31`, basis: PROD, slug: 'cop31', name: 'COP31', token: 'test-prod' }], T0);
    if (f.wo === 'frueher') z.setze([], T0 + 300_000);
    const ist = z.tokenFuer('cop31', f.basis, lage);
    const ohneBasis = z.tokenFuer('cop31', undefined, lage);
    const genau = z.tokenFuer('cop31', PROD, lage);
    // Z1 (Nr. 7): die Markierung PROD|cop31 aktiviert keine fremde Basis mehr (kein Slug-Rückfall bei genannter Basis).
    return ist.token === undefined && ist.grund === 'kein-abgleich-hier' && ohneBasis.token === 'test-prod' && genau.token === 'test-prod' ? null
      : `${f.basis}/${f.wo}: ist ${ist.token ?? '-'} ${ist.grund}, ohne Basis ${ohneBasis.token ?? '-'}, genau ${genau.token ?? '-'}`;
  });
  ck(r.name, r.ok);
}

// --- Z1 L1 OE2: feste Liste der iveo-Server (packages/iveo/src/client.ts) -----------------------------------------------------
ck('Z1 OE2: IVEO_ERLAUBTE_BASEN sind genau Production und Staging (die Liste des Workers, Paket W2)',
  JSON.stringify(IVEO_ERLAUBTE_BASEN) === JSON.stringify([PROD, STAGING]));
{
  const faelle: Array<[string, string | null, boolean]> = [
    [PROD, PROD, true], [`${PROD}/`, PROD, true], [`${PROD}///`, PROD, true], ['HTTPS://APP.MY-IVEO.DE/api/v1', PROD, true],
    ['https://app.my-iveo.de:443/api/v1', PROD, true], ['app.my-iveo.de/api/v1', PROD, true], [`  ${STAGING}  `, STAGING, true],
    ['https://STAGING-DEV.my-iveo.de:443/api/v1/', STAGING, true],
    ['http://app.my-iveo.de/api/v1', 'http://app.my-iveo.de/api/v1', false], ['https://app.my-iveo.de:8443/api/v1', 'https://app.my-iveo.de:8443/api/v1', false],
    ['https://app.my-iveo.de/api/v2', 'https://app.my-iveo.de/api/v2', false], ['https://staging.my-iveo.de/api/v1', 'https://staging.my-iveo.de/api/v1', false],
    ['https://evil.example/api/v1', 'https://evil.example/api/v1', false], ['https://app.my-iveo.de.evil.example/api/v1', 'https://app.my-iveo.de.evil.example/api/v1', false],
    ['https://user@app.my-iveo.de/api/v1', null, false], ['https://app.my-iveo.de/api/v1?x=1', null, false], ['https://app.my-iveo.de/api/v1#x', null, false],
    ['ftp://app.my-iveo.de/api/v1', null, false], ['', null, false], ['https://', null, false],
  ];
  const abw = faelle.filter(([roh, kanon, erlaubt]) => kanonischeIveoBasis(roh) !== kanon || iveoBasisErlaubt(roh) !== erlaubt).map(([roh]) => roh);
  ck(`Z1 OE2: kanonischeIveoBasis (Schema und Host klein, :443 weg, Schrägstrich weg, nie Zugangsdaten/Query/Fragment) und iveoBasisErlaubt (${faelle.length} Fälle)${abw.length ? ` — abweichend: ${abw.join('; ')}` : ''}`,
    abw.length === 0 && kanonischeIveoBasis(undefined) === null && !iveoBasisErlaubt(undefined));
}
{
  const faelle: Array<[unknown, string | null]> = [
    [PROD, PROD], [`${PROD}/`, PROD], ['', PROD], ['   ', PROD], [STAGING, STAGING], ['https://x.my-iveo.de/api/v1', null],
    ['http://app.my-iveo.de/api/v1', null], [undefined, null], [42, null], [null, null],
  ];
  const abw = faelle.filter(([roh, soll]) => iveoHinterlegenBasis(roh, PROD) !== soll).map(([roh]) => String(roh));
  ck(`Z1 OE2: iveoHinterlegenBasis — Basis der Liste in Normalform, leer = Standardbasis, alles andere null (${faelle.length} Fälle)${abw.length ? ` — abweichend: ${abw.join('; ')}` : ''}`,
    abw.length === 0 && iveoHinterlegenBasis('', 'http://127.0.0.1:9/api') === null && iveoHinterlegenBasis('', STAGING) === STAGING);
}

// --- Z1 L1 OE2: ein zentrales Token geht nur an eine Basis der Liste ------------------------------------------------------------
{
  const X = 'https://x.my-iveo.de/api/v1';
  const DEV = 'http://127.0.0.1:9/api/v1';
  const lage = (abgleichHier: string[], standardBasis = PROD, lokal?: string): IveoLage => ({
    angemeldet: true, geladen: true, abgleichHier, lokal: () => lokal, env: undefined, standardBasis,
  });
  const ev = (basis: string, token: string) => ({ key: `${basis}|cop31`, basis, slug: 'cop31', name: 'COP31', token });
  const fall = [
    ['Basis der Liste → Token', [ev(PROD, 'tok-prod')], PROD, [`${PROD}|cop31`], PROD, undefined, 'tok-prod', 'ok'],
    ['Basis nicht in der Liste, genau markiert → kein Token', [ev(X, 'tok-x')], X, [`${X}|cop31`], PROD, undefined, undefined, 'nicht-hinterlegt'],
    ['Basis nicht in der Liste, lokales Token im Übergang bleibt', [ev(X, 'tok-x')], X, [`${X}|cop31`], PROD, 'tok-lokal', 'tok-lokal', 'ok'],
    ['Standardbasis aus der Entwicklung (JMPS_IVEO_BASE_URL) bekommt kein zentrales Token', [ev(PROD, 'tok-prod')], undefined, [`${PROD}|cop31`], DEV, undefined, undefined, 'nicht-hinterlegt'],
    ['Eintrag mit Großbuchstaben, :443 und Schrägstrich zählt als Basis der Liste', [ev('HTTPS://App.My-Iveo.de:443/api/v1/', 'tok-gross')], PROD, [`${PROD}|cop31`], PROD, undefined, 'tok-gross', 'ok'],
    ['http statt https ist nicht die Basis der Liste', [ev('http://app.my-iveo.de/api/v1', 'tok-http')], 'http://app.my-iveo.de/api/v1', ['http://app.my-iveo.de/api/v1|cop31'], PROD, undefined, undefined, 'nicht-hinterlegt'],
  ] as const;
  const abw: string[] = [];
  for (const [name, events, basis, abgleich, standard, lokal, token, grund] of fall) {
    const z = erzeugeIveoZentral();
    z.setze([...events], T0);
    const ist = z.tokenFuer('cop31', basis, lage([...abgleich], standard, lokal));
    if (ist.token !== token || ist.grund !== grund) abw.push(`${name}: ist ${ist.token ?? '-'} ${ist.grund}`);
    // auch ein früher geladenes Token (frueher) hält sich an die Liste
    const z2 = erzeugeIveoZentral();
    z2.setze([...events], T0);
    z2.setze([], T0 + 300_000);
    const ist2 = z2.tokenFuer('cop31', basis, lage([...abgleich], standard, lokal));
    if (ist2.token !== token) abw.push(`${name} (früher): ist ${ist2.token ?? '-'}`);
  }
  ck(`Z1 OE2: tokenFuer gibt ein zentrales Token nur an eine Basis der festen Liste, lokale Tokens bleiben unberührt (${fall.length} Fälle, je zentral und früher)${abw.length ? ` — ${abw.join('; ')}` : ''}`,
    abw.length === 0);
  // Z1 (Nr. 7): die Markierung einer anderen Basis aktiviert den Abgleich nicht (wie beim Token: Slug-Rückfall nur ohne Basis)
  const z = erzeugeIveoZentral();
  z.setze([ev(PROD, 'tok-prod')], T0);
  const strikt = z.tokenFuer('cop31', PROD, lage([`${STAGING}|cop31`]));
  const ohneBasis = z.tokenFuer('cop31', undefined, lage([`${STAGING}|cop31`]));
  ck('Z1 Nr. 7: „Abgleich hier“ einer anderen Basis aktiviert die genannte Basis nicht (kein-abgleich-hier); ohne genannte Basis gilt der eindeutige Slug weiter',
    strikt.token === undefined && strikt.grund === 'kein-abgleich-hier' && ohneBasis.token === 'tok-prod' && ohneBasis.grund === 'ok');
}

// --- P14 G9 --------------------------------------------------------------------------------------------------------------------
{
  const quelle = readFileSync(new URL('../src/main/konto/iveo-zentral.ts', import.meta.url), 'utf8');
  ck('P14 G9: iveo-zentral.ts ohne electron-Import, ohne Konsole, ohne Dateizugriff (Tokens nur im Speicher)',
    !/from 'electron'|require\('electron'\)/.test(quelle) && !/console\./.test(quelle) && !/node:fs|writeFile|safeStorage/.test(quelle));
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

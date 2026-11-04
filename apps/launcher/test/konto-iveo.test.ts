// Anmeldung im Launcher (Teil 1) · P14: iveo-Tokens im Speicher und „Abgleich hier“ (src/main/konto/iveo-zentral.ts) nach
// Verhalten 11.4 (IV1, IV5) und OFP1, OFP3 — ohne Electron, ohne Netz (tsx). Die Naht in settings.ts verdrahtet Task 23.
import { readFileSync } from 'node:fs';
import {
  erzeugeIveoZentral, iveoSchluessel, LOKAL_FRIST_MS, lokaleLoeschen, type IveoLage,
} from '../src/main/konto/iveo-zentral';
import { kreuz, pruefeFaelle } from './konto-rechte.test';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const PROD = 'https://app.my-iveo.de/api/v1';
const STAGING = 'https://staging.my-iveo.de/api/v1';
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
    'Slug mehrdeutig': [
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
    const ausSpeicher = f.s === 'genau' ? 'tok-genau' : f.s === 'Slug eindeutig' ? 'tok-staging' : undefined;
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
    else if (f.k === 'zentral andere Basis') soll = { loeschen: [slug], markieren: [`${STAGING}|probe`], bleiben: [] };
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

// --- P14 G9 --------------------------------------------------------------------------------------------------------------------
{
  const quelle = readFileSync(new URL('../src/main/konto/iveo-zentral.ts', import.meta.url), 'utf8');
  ck('P14 G9: iveo-zentral.ts ohne electron-Import, ohne Konsole, ohne Dateizugriff (Tokens nur im Speicher)',
    !/from 'electron'|require\('electron'\)/.test(quelle) && !/console\./.test(quelle) && !/node:fs|writeFile|safeStorage/.test(quelle));
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

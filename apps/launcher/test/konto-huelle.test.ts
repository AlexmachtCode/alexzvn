// Anmeldung im Launcher (Teil 1) · Nachrunde Z1-L1: die reinen Teile der Hülle (src/main/konto/huelle-kern.ts) und der Show-Wächter
// (src/main/show-offen.ts) im Verhalten — ohne Electron, ohne Netz (tsx). Die Hülle (konto/huelle.ts) lädt Electron und läuft
// hier nicht; ihre Verdrahtung prüfen die Quelltext-Wächter am Ende dieser Datei und der Selbsttest (npm run selftest).
import { readFileSync } from 'node:fs';
import type { AdminAktionErgebnis, AdminUebersicht, KontoFehlerCode } from '../src/shared/konto';
import {
  adminAktionAusfuehren, anmeldenOhneAblauf, browserHref, erzeugeIveoLader, erzeugeUebergang, ersteAnmeldungVerarbeiten, eventsFuerRenderer,
  githubZugangNachholen, K33_STEHT_MS, kontoGewechselt, ohneGithubZugang, ohneWurf, uebergangsText, zustandsLogger, type UebergangsMerker,
} from '../src/main/konto/huelle-kern';
import { showIstZu, SHOW_GNADE_MS } from '../src/main/show-offen';
import { KontoFehler, type IveoZentral } from '../src/main/konto/worker-client';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// --- Nr. 8: die Übergangsmeldung (K32/I11) kommt nach K33 und überlebt einen Neustart ----------------------------------------
function uebergangUmgebung(o: { startMerker?: UebergangsMerker | null; schreibWirft?: boolean; liesWirft?: boolean } = {}) {
  const z = {
    zeit: 1_000_000,
    merker: (o.startMerker ?? null) as UebergangsMerker | null,
    schreibvorgaenge: 0,
    meldungen: [] as string[],
    log: [] as string[],
    wecker: [] as Array<{ ms: number; fn: () => void; aktiv: boolean }>,
  };
  const u = erzeugeUebergang({
    speicher: {
      lies: () => { if (o.liesWirft) throw new Error('kaputt'); return z.merker; },
      schreib: (m) => { z.schreibvorgaenge++; if (o.schreibWirft) { const e = new Error('Platte voll'); e.name = 'EPERM'; throw e; } z.merker = m; },
    },
    jetzt: () => z.zeit,
    wecker: (ms, fn) => { const w = { ms, fn, aktiv: true }; z.wecker.push(w); return () => { w.aktiv = false; }; },
    melde: (t) => z.meldungen.push(t),
    log: (l) => z.log.push(l),
  });
  return Object.assign(z, { u });
}
{
  // nichts vorgemerkt → nichts gemeldet
  const a = uebergangUmgebung();
  let gefragt = 0;
  a.u.nachLaden(() => { gefragt++; return 'text'; });
  ck('Z1 Nr. 8: ohne Vormerkung kommt keine Übergangsmeldung (und der Text wird nicht einmal gebaut)', gefragt === 0 && a.wecker.length === 0 && a.meldungen.length === 0);

  // erste Anmeldung: Vormerken, K33 gezeigt, Tokens laden 500 ms später → die Meldung folgt erst, wenn K33 K33_STEHT_MS stand
  const b = uebergangUmgebung();
  b.u.vormerken(true);
  b.u.k33Gezeigt();
  b.zeit += 500;
  b.u.nachLaden((github) => (github ? 'K32 und I11' : 'nur I11'));
  const vorher = b.meldungen.length;
  const warte = b.wecker[0]?.ms;
  b.wecker[0].fn();
  ck('Z1 Nr. 8: K33 bleibt K33_STEHT_MS (4 s) stehen: die Meldung kommt nicht sofort, sondern nach dem Rest der 4 s, mit dem Wissen über den GitHub-Zugang; danach ist die Vormerkung gelöscht',
    K33_STEHT_MS === 4000 && vorher === 0 && warte === K33_STEHT_MS - 500 && b.meldungen.length === 1 && b.meldungen[0] === 'K32 und I11' && b.merker === null);

  // war K33 schon länger her, kommt die Meldung ohne Wartezeit; ohne K33 (Start-Prüfung) ebenso
  const c = uebergangUmgebung({ startMerker: { melden: true, github: false } });
  c.u.k33Gezeigt();
  c.zeit += 10_000;
  c.u.nachLaden(() => 'I11');
  const d = uebergangUmgebung({ startMerker: { melden: true, github: false } });
  d.u.nachLaden(() => 'I11');
  ck('Z1 Nr. 8: war K33 länger als 4 s her oder gab es keine, folgt die Meldung ohne Wartezeit', c.wecker[0]?.ms === 0 && d.wecker[0]?.ms === 0);

  // Abmelden löscht den Zeitgeber; die Vormerkung bleibt und kommt nach der nächsten Anmeldung
  const e = uebergangUmgebung();
  e.u.vormerken(false);
  e.u.k33Gezeigt();
  e.u.nachLaden(() => 'I11');
  e.u.abmelden();
  const abgeschaltet = !e.wecker[0].aktiv;
  const bleibt = e.merker?.melden === true;
  e.u.nachLaden(() => 'I11');
  ck('Z1 Nr. 8: Abmelden schaltet den Zeitgeber ab; die Vormerkung bleibt und löst nach dem nächsten Laden einen neuen aus',
    abgeschaltet && bleibt && e.wecker.length === 2 && e.wecker[1].aktiv);

  // Neustart vor der Meldung: ein frischer Prozess liest die Vormerkung aus settings.json
  const f = uebergangUmgebung();
  f.u.vormerken(true);
  const neustart = uebergangUmgebung({ startMerker: f.merker });
  ck('Z1 Nr. 8: die Vormerkung (melden und GitHub gelöscht) steht in settings.json und ist nach einem Neustart wieder da, vor dem ersten Laden',
    f.merker?.melden === true && f.merker?.github === true && neustart.u.vorgemerkt()?.github === true);
  neustart.u.nachLaden((g) => (g ? 'K32' : ''));
  neustart.wecker[0].fn();
  ck('Z1 Nr. 8: … und wird nach dem Neustart gemeldet und dann gelöscht (einmal)', neustart.meldungen.join('|') === 'K32' && neustart.merker === null);

  // Vormerken ist additiv: ein späteres Vormerken ohne GitHub nimmt K32 nicht zurück
  const g = uebergangUmgebung();
  g.u.vormerken(true);
  g.u.vormerken(false);
  ck('Z1 Nr. 8: vormerken(false) nach vormerken(true) behält den GitHub-Hinweis', g.merker?.github === true);

  // Z1-F AR81 (A): vormerken setzt `gemeldet` zurück. Nach einer gezeigten Meldung bringt ein neues Vormerken (z. B. nach dem
  // Abmelden und einer weiteren ersten Anmeldung im selben Prozess) die zweite Meldung; ohne das Zurücksetzen bliebe sie stumm.
  const m = uebergangUmgebung();
  m.u.vormerken(false);
  m.u.nachLaden(() => 'erste');
  m.wecker[0].fn();
  m.u.vormerken(true);
  m.u.nachLaden((github) => (github ? 'zweite mit GitHub' : 'zweite'));
  m.wecker[1]?.fn();
  ck('Z1-F AR81 A: vormerken → melden → vormerken → nachLaden → zweite Meldung kommt (vormerken setzt gemeldet zurück)',
    m.meldungen.join('|') === 'erste|zweite mit GitHub' && m.merker === null);

  // nichts zu sagen → die Vormerkung fällt weg, ohne Meldung
  const h = uebergangUmgebung();
  h.u.vormerken(false);
  h.u.nachLaden(() => null);
  ck('Z1 Nr. 8: gibt es nichts zu melden (null), wird die Vormerkung gelöscht und nichts gemeldet', h.merker === null && h.meldungen.length === 0 && h.wecker.length === 0);

  // zwei Ladeläufe hintereinander: nur ein Zeitgeber
  const i = uebergangUmgebung();
  i.u.vormerken(false);
  i.u.nachLaden(() => 'I11');
  i.u.nachLaden(() => 'I11');
  ck('Z1 Nr. 8: ein zweites Laden vor Ablauf des Zeitgebers stellt keinen zweiten (keine doppelte Meldung)', i.wecker.length === 1);

  // Fixrunde 1 (Nr. 2): scheitert das Löschen der Vormerkung dauerhaft, kommt die Meldung trotzdem nur einmal (nicht alle 5 min)
  const l = uebergangUmgebung({ schreibWirft: true, startMerker: { melden: true, github: false } });
  l.u.nachLaden(() => 'I11');
  l.wecker[0].fn();
  l.u.nachLaden(() => 'I11'); // das nächste Laden nach 5 min
  l.u.nachLaden(() => 'I11');
  ck('Fixrunde 1 Nr. 2: scheitert schreibe(null), wird K32/I11 trotzdem nur einmal gemeldet (Merker im Speicher), nicht bei jedem Laden', l.meldungen.length === 1 && l.wecker.length === 1);

  // Schreibfehler: kein Wurf, Log nur mit dem Fehlernamen
  const j = uebergangUmgebung({ schreibWirft: true });
  let geworfen = false;
  try { j.u.vormerken(true); j.u.nachLaden(() => 'I11'); j.wecker[0]?.fn(); } catch { geworfen = true; }
  ck('Z1 Nr. 8: scheitert settings.json beim Merken oder Löschen, wirft nichts nach außen; die Logzeile nennt nur den Fehlernamen (EPERM), nie den Text',
    !geworfen && j.log.length >= 1 && j.log.every((l) => l.includes('(EPERM)') && !l.includes('Platte voll')));
  const k = uebergangUmgebung({ liesWirft: true });
  let w2 = false;
  try { k.u.nachLaden(() => 'x'); k.u.vormerken(true); } catch { w2 = true; }
  ck('Z1 Nr. 8: scheitert das Lesen der Vormerkung, wirft nichts (kein Vormerken gilt)', !w2 && k.meldungen.length === 0);
}
{
  // [T] I11 aus events, nicht aus r.bleiben: base:-Schlüssel erscheinen nie in der Meldung
  const t = (a: Partial<Parameters<typeof uebergangsText>[0]>): string | null => uebergangsText({
    github: false, bleiben: [], spaetestens: 7, textGithub: 'K32.', textLokal: (s, d) => `I11: ${s.join(', ')} bis ${d}.`, ...a,
  });
  ck('Z1 [T] I11: die Meldung nennt nur Event-Kennungen — base:-Schlüssel (Basis-Tokens) fehlen, nur Basis-Tokens ergeben keine Meldung',
    t({ bleiben: ['cop31', 'base:https://app.my-iveo.de/api/v1', 'messe'] }) === 'I11: cop31, messe bis 7.'
    && t({ bleiben: ['base:https://app.my-iveo.de/api/v1'] }) === null && t({}) === null);
  ck('Z1 Nr. 8: K32 und I11 stehen in einer Meldung (K32 zuerst); K32 allein, wenn kein Token mehr lokal liegt',
    t({ github: true, bleiben: ['cop31'] }) === 'K32. I11: cop31 bis 7.' && t({ github: true }) === 'K32.');
}

// --- Nr. 6: erste Anmeldung, GitHub-Löschen, Zustands-Log, Anmelden-Fehler, Browser-Adresse -----------------------------------
{
  const f = (o: { erste?: number | null; schreibWirft?: boolean; hakenWirft?: boolean } = {}) => {
    const z = { erste: o.erste ?? null, log: [] as string[], haken: 0, hakenZwei: 0 };
    const ergebnis = ersteAnmeldungVerarbeiten({
      lies: () => z.erste,
      schreibe: (ms) => { if (o.schreibWirft) { const e = new Error('geheimer Pfad C:\\Nutzer'); e.name = 'EBUSY'; throw e; } z.erste = ms; },
      haken: [() => { z.haken++; if (o.hakenWirft) { const e = new Error('Dateiname.json'); e.name = 'EPERM'; throw e; } }, () => { z.hakenZwei++; }],
      jetzt: () => 42, log: (l) => z.log.push(l),
    });
    return Object.assign(z, { ergebnis });
  };
  const normal = f(), schreibt = f({ schreibWirft: true }), haken = f({ hakenWirft: true }), schon = f({ erste: 5 });
  ck('Z1 Nr. 6: erste Anmeldung — merkt die Zeit und lässt jeden Haken laufen; ist sie schon gemerkt, läuft nichts',
    normal.ergebnis && normal.erste === 42 && normal.haken === 1 && normal.hakenZwei === 1 && !schon.ergebnis && schon.haken === 0 && schon.erste === 5);
  ck('Z1 Nr. 6: wirft das Merken (settings.json), wirft ersteAnmeldungVerarbeiten nicht, die Haken laufen trotzdem, im Log steht nur der Fehlername',
    schreibt.ergebnis && schreibt.haken === 1 && schreibt.log.length === 1 && schreibt.log[0].includes('(EBUSY)') && !schreibt.log[0].includes('C:\\'));
  ck('Z1 Nr. 6: wirft ein Haken, läuft der nächste weiter; im Log nur der Fehlername', haken.hakenZwei === 1 && haken.log.length === 1 && haken.log[0].includes('(EPERM)') && !haken.log[0].includes('Dateiname'));
}
{
  const mk = (erste: number | null, loesche: () => boolean) => { const log: string[] = []; return { r: githubZugangNachholen({ ersteAnmeldung: erste, loesche, log: (l) => log.push(l) }), log }; };
  let aufrufe = 0;
  const a = mk(null, () => { aufrufe++; return true; });
  const b = mk(5, () => true), c = mk(5, () => false);
  const d = mk(5, () => { const e = new Error('Pfad'); e.name = 'EBUSY'; throw e; });
  ck('Z1 Nr. 6: GitHub-Zugang beim Start nachholen — nur wenn die erste Anmeldung gemerkt ist; gelöscht → true, nichts da → false, Wurf → false mit Fehlername im Log',
    !a.r && aufrufe === 0 && b.r && !c.r && !d.r && d.log.length === 1 && d.log[0].includes('(EBUSY)') && !d.log[0].includes('Pfad'));
  const s = { githubToken: 'klar', githubTokenEnc: 'verschluesselt', proxyUrl: 'https://worker.test', manifestUrl: 'https://m.test', iveoBaseUrl: 'https://x', recentShows: [1] };
  const { neu, war } = ohneGithubZugang(s);
  const nichts = ohneGithubZugang({ proxyUrl: 'https://worker.test' });
  const nurEnc = ohneGithubZugang({ githubTokenEnc: 'x', proxyUrl: 'p' });
  ck('Z1 Nr. 6: ohneGithubZugang entfernt nur githubToken und githubTokenEnc — proxyUrl und alle anderen Felder bleiben, das Original bleibt unverändert',
    war && !('githubToken' in neu) && !('githubTokenEnc' in neu) && neu.proxyUrl === 'https://worker.test' && neu.manifestUrl === 'https://m.test'
    && neu.iveoBaseUrl === 'https://x' && JSON.stringify(neu.recentShows) === '[1]' && s.githubToken === 'klar'
    && !nichts.war && nichts.neu.proxyUrl === 'https://worker.test' && nurEnc.war && nurEnc.neu.proxyUrl === 'p');
}
{
  const log = zustandsLogger();
  const zeilen = ['pruefe', 'pruefe', 'angemeldet', 'angemeldet', 'angemeldet', 'offline', 'angemeldet', 'angemeldet'].map((z) => log(z as never));
  ck('Z1 Nr. 6: das Log schreibt je Zustandswechsel eine Zeile (nicht je Lage), nur mit dem Zustandsnamen',
    JSON.stringify(zeilen) === JSON.stringify(['Anmeldung: Zustand pruefe', null, 'Anmeldung: Zustand angemeldet', null, null, 'Anmeldung: Zustand offline', 'Anmeldung: Zustand angemeldet', null]));
}
{
  const faelle: Array<[Parameters<typeof anmeldenOhneAblauf>[0], string]> = [
    ['kein-schluesselspeicher', 'kein-schluesselspeicher'], ['pruefe', 'server'], ['nicht-angemeldet', 'server'], ['angemeldet', 'server'], ['offline', 'server'],
    ['server-nicht-erreichbar', 'server'], ['abgelaufen', 'server'], ['entzogen', 'server'], ['entzogen-laeuft', 'server'],
  ];
  const abw = faelle.filter(([z, soll]) => { const s = anmeldenOhneAblauf(z); return !(s.art === 'fehler' && s.code === soll); }).map(([z]) => z);
  ck(`Z1 Nr. 6, G7: konto:anmelden ohne Ablauf nennt den wahren Grund — Schlüsselspeicher nur im Zustand kein-schluesselspeicher, sonst server (${faelle.length} Zustände)${abw.length ? ` — ${abw.join(', ')}` : ''}`, abw.length === 0);
}
{
  const S = 'https://worker.test';
  const faelle: Array<[string, string | null]> = [
    [`${S}/konto/anmelden?v=v1&c=ABC`, `${S}/konto/anmelden?v=v1&c=ABC`], [`${S}/a b`, `${S}/a%20b`], [`${S}`, `${S}/`], ['HTTPS://WORKER.test:443/x', `${S}/x`],
    [`${S}/x\nSet`, `${S}/xSet`], ['https://worker.test.evil.example/x', null], ['http://worker.test/x', null], ['file:///C:/x', null], ['', null], ['keine Adresse', null],
  ];
  const abw = faelle.filter(([u, soll]) => browserHref(u, S) !== soll).map(([u]) => `${JSON.stringify(u)} → ${browserHref(u, S)}`);
  ck(`Z1 Nr. 6: browserHref — die Form von new URL(url).href, nur beim Worker und über https (${faelle.length} Fälle)${abw.length ? ` — ${abw.join('; ')}` : ''}`,
    abw.length === 0 && browserHref(`${S}/x`, '') === null);
}

// --- Nr. 5: adminAktion liefert das Ergebnis auch, wenn die Übersicht danach scheitert --------------------------------------
{
  const UEB = { zugaenge: [], iveo: [], anfragen: [], geraete: [], altKey: { bis: null, diagnose: null, zeilen: [] } } as AdminUebersicht;
  const CODE: AdminAktionErgebnis = { ok: true, einladungscode: 'ABCD-EFGH', codeBis: 99 };
  const code = (e: unknown): KontoFehlerCode => (e instanceof KontoFehler ? e.code : 'server');
  const lauf = async (o: { aktion?: 'ok' | 'netz'; uebersicht?: 'ok' | 'netz' | 'zu-viele'; lage?: 'ok' | 'wirft' }) => {
    const reihenfolge: string[] = [];
    const r = await adminAktionAusfuehren({
      aktion: async () => { reihenfolge.push('aktion'); if (o.aktion === 'netz') throw new KontoFehler('netz', null); return CODE; },
      uebersicht: async () => { reihenfolge.push('uebersicht'); if (o.uebersicht === 'netz' || o.uebersicht === 'zu-viele') throw new KontoFehler(o.uebersicht, null); return UEB; },
      lage: async () => { reihenfolge.push('lage'); if (o.lage === 'wirft') throw new Error('x'); },
      fehlerCode: code,
    });
    return { r, reihenfolge: reihenfolge.join(',') };
  };
  const ok = await lauf({});
  const ohneUeb = await lauf({ uebersicht: 'netz' });
  const drossel = await lauf({ uebersicht: 'zu-viele' });
  const aktionFehlt = await lauf({ aktion: 'netz' });
  const lageWirft = await lauf({ lage: 'wirft' });
  ck('Z1 Nr. 5: adminAktion — Erfolg liefert Ergebnis und neue Übersicht (Aktion, Übersicht, Lage in dieser Reihenfolge)',
    ok.r.ok === true && ok.r.ergebnis.einladungscode === 'ABCD-EFGH' && ok.r.daten === UEB && ok.r.uebersichtFehler === undefined && ok.reihenfolge === 'aktion,uebersicht,lage');
  ck('Z1 Nr. 5: scheitert die Folge-Übersicht, kommt der Einladungscode trotzdem an; die Übersicht meldet ihren eigenen Fehler (netz bzw. zu-viele)',
    ohneUeb.r.ok === true && ohneUeb.r.ergebnis.einladungscode === 'ABCD-EFGH' && ohneUeb.r.daten === null && ohneUeb.r.uebersichtFehler === 'netz'
    && drossel.r.ok === true && drossel.r.ergebnis.codeBis === 99 && drossel.r.uebersichtFehler === 'zu-viele' && ohneUeb.reihenfolge === 'aktion,uebersicht,lage');
  ck('Z1 Nr. 5: scheitert die Aktion selbst, meldet adminAktion den Fehlercode ohne Übersicht; wirft die Lage, bleibt die Antwort ein Erfolg',
    aktionFehlt.r.ok === false && aktionFehlt.r.code === 'netz' && aktionFehlt.reihenfolge === 'aktion' && lageWirft.r.ok === true && lageWirft.r.daten === UEB);
}

// --- Nr. 7: das Laden der iveo-Tokens ---------------------------------------------------------------------------------------
{
  type Roh = { events: IveoZentral[]; hinweis: null };
  const leer: Roh = { events: [], hinweis: null };
  function lader(o: { token?: Array<string | null>; kid?: Array<string | null>; lauf?: number[]; antworten: Array<'ok' | 'wirft' | 'haengt'>; fertigWirft?: boolean }) {
    const z = {
      token: o.token ?? ['t'], kid: o.kid ?? ['k1'], lauf: o.lauf ?? [0], lade: 0, uebernommen: [] as Array<string | null>, fertig: 0, log: [] as string[],
      offen: [] as Array<(x: 'ok' | 'wirft') => void>, antworten: [...o.antworten],
      tokenJetzt: (o.token ?? ['t'])[0] as string | null, kidJetzt: (o.kid ?? ['k1'])[0] as string | null, laufJetzt: (o.lauf ?? [0])[0],
    };
    const l = erzeugeIveoLader({
      token: () => z.tokenJetzt, kid: () => z.kidJetzt, lauf: () => z.laufJetzt,
      lade: () => {
        z.lade++;
        const a = z.antworten.shift() ?? 'ok';
        if (a === 'haengt') return new Promise<Roh>((ja, nein) => { z.offen.push((x) => (x === 'ok' ? ja(leer) : nein(new KontoFehler('netz', null)))); });
        return a === 'ok' ? Promise.resolve(leer) : Promise.reject(new KontoFehler('netz', null));
      },
      uebernimm: (_r, kid) => { z.uebernommen.push(kid); },
      fertig: () => { z.fertig++; if (o.fertigWirft) { const e = new Error('Aufräumen'); e.name = 'EPERM'; throw e; } },
      log: (x) => z.log.push(x), fehlerCode: (e) => (e instanceof KontoFehler ? e.code : 'server'),
    });
    return Object.assign(z, { l });
  }
  const ruhe = async (): Promise<void> => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };

  const ohneSitzung = lader({ antworten: [] });
  ohneSitzung.tokenJetzt = null;
  await ohneSitzung.l.lade();
  ck('Z1 Nr. 7: ohne Sitzung wird nichts geladen, aber die Frist für lokale Tokens läuft (fertig)', ohneSitzung.lade === 0 && ohneSitzung.fertig === 1 && ohneSitzung.uebernommen.length === 0);

  const gut = lader({ antworten: ['ok'] });
  await gut.l.lade();
  ck('Z1 Nr. 7: Laden übernimmt die Tokens mit der Kennung des Kontos und räumt danach auf', gut.lade === 1 && gut.uebernommen.join() === 'k1' && gut.fertig === 1);

  const doppelt = lader({ antworten: ['haengt'] });
  const erster = doppelt.l.lade();
  await ruhe();
  const zweiter = doppelt.l.lade();
  await ruhe();
  const zeitgleich = doppelt.lade;
  doppelt.offen[0]('ok');
  await Promise.all([erster, zweiter]);
  ck('Z1 Nr. 7: höchstens ein Lauf zugleich (AR60) — ein zweiter Aufruf während des Wartens fragt den Worker nicht noch einmal', zeitgleich === 1 && doppelt.lade === 1 && doppelt.uebernommen.length === 1);

  const wechselOk = lader({ antworten: ['haengt', 'ok'] });
  const p1 = wechselOk.l.lade();
  await ruhe();
  wechselOk.laufJetzt = 1; // Abmelden und Anmelden während des Wartens
  wechselOk.offen[0]('ok');
  await p1;
  await ruhe();
  ck('Z1 Nr. 7: wechselt der Lauf während des Wartens (erfolgreiche Antwort), wird die alte Antwort verworfen und das Laden für das neue Konto neu gestartet',
    wechselOk.lade === 2 && wechselOk.uebernommen.join() === 'k1' && wechselOk.fertig === 1);

  const wechselFehl = lader({ antworten: ['haengt', 'ok'] });
  const p2 = wechselFehl.l.lade();
  await ruhe();
  wechselFehl.kidJetzt = 'k2'; // anderes Konto ohne Abmelden
  wechselFehl.offen[0]('wirft');
  await p2;
  await ruhe();
  ck('Z1 Nr. 7: wechselt das Konto während des Wartens und die Anfrage SCHEITERT, startet das Laden trotzdem neu (catch-Zweig) und lädt für das neue Konto',
    wechselFehl.lade === 2 && wechselFehl.uebernommen.join() === 'k2' && wechselFehl.log.length === 1 && wechselFehl.log[0].includes('(netz)'));

  const wechselAus = lader({ antworten: ['haengt'] });
  const p3 = wechselAus.l.lade();
  await ruhe();
  wechselAus.tokenJetzt = null; // abgemeldet
  wechselAus.laufJetzt = 1;
  wechselAus.offen[0]('wirft');
  await p3;
  await ruhe();
  ck('Z1 Nr. 7: ist nach dem Wechsel keine Sitzung mehr da, startet kein neues Laden (und es wird nichts übernommen)', wechselAus.lade === 1 && wechselAus.uebernommen.length === 0);

  const fehl = lader({ antworten: ['wirft'] });
  await fehl.l.lade();
  ck('Z1 Nr. 7: scheitert das Laden ohne Wechsel, bleibt es bei einer Logzeile mit dem Fehlercode; nichts wird übernommen, der Abschluss läuft (G5)',
    fehl.lade === 1 && fehl.uebernommen.length === 0 && fehl.fertig === 1 && fehl.log.join() === 'Anmeldung: iveo-Tokens nicht geladen (netz)');

  const aufraeumen = lader({ antworten: ['ok'], fertigWirft: true });
  let w = false;
  try { await aufraeumen.l.lade(); } catch { w = true; }
  ck('Z1 Nr. 7: wirft der Abschluss (Aufräumen, Kern), wirft das Laden nicht; im Log nur der Fehlername', !w && aufraeumen.log.length === 1 && aufraeumen.log[0].includes('(EPERM)') && !aufraeumen.log[0].includes('Aufräumen)'));
}

// --- Nr. 7: „Show offen“, solange eines ihrer Tools läuft -------------------------------------------------------------------
{
  const T = 10_000_000;
  const faelle: Array<[string, Parameters<typeof showIstZu>[0], boolean]> = [
    ['innerhalb der Gnadenfrist ohne laufende Tools', { geoeffnetAm: T, jetzt: T + SHOW_GNADE_MS - 1, toolIds: ['jm-timer'], laufend: [] }, false],
    ['nach der Gnadenfrist, ein Tool läuft', { geoeffnetAm: T, jetzt: T + SHOW_GNADE_MS, toolIds: ['jm-timer', 'jm-titler'], laufend: ['jm-titler', 'jm-q-a'] }, false],
    ['nach der Gnadenfrist, kein Tool der Show läuft (andere Tools laufen)', { geoeffnetAm: T, jetzt: T + SHOW_GNADE_MS, toolIds: ['jm-timer'], laufend: ['jm-q-a'] }, true],
    ['nach der Gnadenfrist, nichts läuft', { geoeffnetAm: T, jetzt: T + 10 * SHOW_GNADE_MS, toolIds: ['jm-timer'], laufend: [] }, true],
    ['Show ohne Tools nach der Gnadenfrist', { geoeffnetAm: T, jetzt: T + SHOW_GNADE_MS, toolIds: [], laufend: ['jm-timer'] }, true],
    ['eigene Gnadenfrist 0', { geoeffnetAm: T, jetzt: T, toolIds: ['a'], laufend: [], gnadeMs: 0 }, true],
  ];
  const abw = faelle.filter(([, a, soll]) => showIstZu(a) !== soll).map(([n]) => n);
  ck(`Z1 Nr. 7: showIstZu — offen, solange die Gnadenfrist läuft oder ein Tool der Show läuft; sonst geschlossen (${faelle.length} Fälle)${abw.length ? ` — ${abw.join('; ')}` : ''}`, abw.length === 0);
}

// --- Nr. 10 [T]: Verhalten statt Quelltext-Muster (T21, T23) -----------------------------------------------------------------------
{
  // AR58: ein Speichern, das wirft, bricht den Treiber nicht ab; ins Log nur der Fehlername
  const log: string[] = [];
  const aufrufe: string[] = [];
  const wirft = ohneWurf((s: string) => { aufrufe.push(s); const e = new Error('Inhalt: jm1.geheim.sitzung'); e.name = 'EPERM'; throw e; }, (z) => log.push(z), 'Anmeldung: Sitzung nicht gespeichert');
  const klappt = ohneWurf((s: string) => { aufrufe.push(s); }, (z) => log.push(z), 'x');
  let geworfen = false;
  try { wirft('eins'); klappt('zwei'); } catch { geworfen = true; }
  ck('Z1 [T] AR58: ohneWurf — ein werfendes Speichern wirft nicht nach außen, die Argumente kommen an, im Log steht nur der Fehlername (kein Inhalt, kein Token)',
    !geworfen && aufrufe.join() === 'eins,zwei' && log.length === 1 && log[0] === 'Anmeldung: Sitzung nicht gespeichert (EPERM)' && !log[0].includes('jm1.'));
  const roh = [{ slug: 'cop31', name: 'COP31', token: 'jm1.geheim', key: 'k', basis: 'b' }, { slug: 'messe', name: 'Messe' }];
  const aus = eventsFuerRenderer(roh);
  ck('Z1 [T]: eventsFuerRenderer (konto:iveoEventsLaden) trägt nur Slug und Name — kein Token, kein Rest des Objekts (kein Spread)',
    JSON.stringify(aus) === JSON.stringify([{ slug: 'cop31', name: 'COP31' }, { slug: 'messe', name: 'Messe' }]) && !JSON.stringify(aus).includes('geheim') && roh[0].token === 'jm1.geheim');
  ck('Z1 [T] T23 (f): kontoGewechselt — nur ein ANDERES Konto leert die Tokens; kein Konto im Speicher und dasselbe Konto nicht',
    kontoGewechselt('k1', 'k2') && !kontoGewechselt('k1', 'k1') && !kontoGewechselt(null, 'k1'));
}
{
  // Keine Logzeile in der Hülle und im Kern nennt eine Sitzung, ein Token, einen Code oder eine Adresse über eine Variable: jede
  // eingesetzte Größe steht auf der Liste (Fehlername, Fehlercode, Anzahl, Zustandsname).
  const les = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const ERLAUBT = new Set([
    "(e as Error | null)?.name ?? 'Fehler'", "(e as Error)?.name ?? 'Error'", "f.code ?? 'fehler'", 'r.loeschen.length', // huelle.ts
    'fehlerName(e)', 'd.fehlerCode(e)', 'text', // huelle-kern.ts
  ]);
  const fremd: string[] = [];
  let zeilen = 0;
  for (const p of ['../src/main/konto/huelle.ts', '../src/main/konto/huelle-kern.ts']) {
    for (const zeile of les(p).split('\n')) {
      if (!/\b(?:warn|info|error|log)\(`/.test(zeile)) continue;
      zeilen++;
      for (const m of zeile.matchAll(/\$\{([^}]*)\}/g)) if (!ERLAUBT.has(m[1])) fremd.push(`${p.split('/').pop()}: \${${m[1]}}`);
    }
  }
  ck(`Z1 [T] G4: in ${zeilen} Logzeilen mit eingesetzten Größen steht nur Fehlername, Fehlercode oder Anzahl — nie eine Variable mit Sitzung, Token oder Code${fremd.length ? ` — ${fremd.join('; ')}` : ''}`,
    zeilen >= 8 && fremd.length === 0);
}

// --- Wächter am Quelltext (die Hülle selbst läuft hier nicht) ---------------------------------------------------------------
{
  const les = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const kern = les('../src/main/konto/huelle-kern.ts');
  const huelle = les('../src/main/konto/huelle.ts');
  ck('Z1 G9, G4: huelle-kern.ts und show-offen.ts ohne electron-Import, ohne Konsole, ohne Dateizugriff',
    [kern, les('../src/main/show-offen.ts')].every((q) => !/from 'electron'|require\('electron'\)/.test(q) && !/console\./.test(q) && !/node:fs|writeFile/.test(q)));
  const admin = huelle.slice(huelle.indexOf('async function adminAktion('), huelle.indexOf('async function iveoEventsLaden('));
  ck('Z1 OE2: adminAktion weist iveo-hinterlegen mit einer Basis außerhalb der Liste VOR dem Senden ab (iveo-basis-unbekannt) und sendet die Normalform',
    admin.indexOf("a.aktion === 'iveo-hinterlegen'") > 0 && admin.indexOf('iveoHinterlegenBasis(a.basis, resolveIveoBaseUrl())') > admin.indexOf("a.aktion === 'iveo-hinterlegen'")
    && admin.indexOf("return { ok: false, code: 'iveo-basis-unbekannt' };") > admin.indexOf('iveoHinterlegenBasis(')
    && admin.indexOf('c.adminAktion(t, aktion)') > admin.indexOf("'iveo-basis-unbekannt'") && admin.includes('aktion = { ...a, basis };'));
  ck('Z1 Nr. 6: kontoSitzungMoeglich beachtet exp; stoppeKonto stoppt den Treiber; kontoSitzungFuerBedarf wartet auf den Treiber, nicht auf den Tür-Dienst',
    huelle.includes('SITZUNG_ZUSTAENDE.includes(a.zustand) && a.stand.exp > Date.now();')
    && huelle.slice(huelle.indexOf('export function stoppeKonto'), huelle.indexOf('export function kontoToken')).includes('  treiber?.stoppe();')
    && huelle.slice(huelle.indexOf('export async function kontoSitzungFuerBedarf'), huelle.indexOf('export function kontoAnsichtJetzt')).includes('  await treiberBereit;')
    && !huelle.slice(huelle.indexOf('export async function kontoSitzungFuerBedarf'), huelle.indexOf('export function kontoAnsichtJetzt')).includes('await bereit')
    && huelle.indexOf('  treiberFertig();') > huelle.indexOf('  t.start();') && huelle.indexOf('  treiberFertig();') < huelle.indexOf('const d = await starteTuerDienst('));
  ck('Z1 Nr. 6: der Lage-Takt entsteht nicht nach dem Beenden (gestoppt wird vor dem Treiber geprüft)',
    huelle.indexOf('  if (gestoppt) return;') > huelle.indexOf('geraet = g.art ===') && huelle.indexOf('  if (gestoppt) return;') < huelle.indexOf('const t = erzeugeSitzungsTreiber('));
  ck('Z1 Nr. 6: Log nur bei Zustandswechsel (zustandsLogger) und die Server-Adresse wird vor dem Bau des Clients geprüft (pruefeServerBasis)',
    huelle.includes('const zeile = zustandsLog(a.zustand);') && !huelle.includes('o.log.info(`Anmeldung: Zustand ${a.zustand}`)')
    && huelle.indexOf('pruefeServerBasis(resolveProxy())') > 0 && huelle.indexOf('pruefeServerBasis(resolveProxy())') < huelle.indexOf('erzeugeKontoClient({ basis: serverBasis'));
  // Verdrahtung der reinen Funktionen (ihr Verhalten steht oben bzw. in konto-sitzung/konto-client/konto-iveo)
  const einst = les('../src/main/settings.ts');
  ck('Z1 Nr. 6: settings.ts liest den Entzug über leseEntzugAus und löscht den GitHub-Zugang über ohneGithubZugang (proxyUrl bleibt); der Übergang steht in kontoUebergang',
    einst.includes('  return leseEntzugAus(read().kontoEntzug);') && einst.includes('  const { neu, war } = ohneGithubZugang(read());')
    && einst.includes('  if (!war) return false;') && einst.includes('  write(neu);') && !einst.includes('delete s.githubTokenEnc;')
    && einst.includes('export function leseKontoUebergang(): UebergangsMerker | null {') && einst.includes('export function schreibeKontoUebergang(m: UebergangsMerker | null): void {'));
  const SECHS = ['changelog', 'cookbook', 'manifest', 'cookbook-draft', 'feedback', 'release-source'];
  const ohne = SECHS.filter((d) => {
    const q = les(`../src/main/${d}.ts`);
    return !q.includes("import { redirectFuer } from './konto/worker-client';") || !q.includes('redirect: redirectFuer(kopf)');
  });
  ck(`Z1 Abrufe mit Kopf: alle sechs Abrufer mit Kopf setzen redirect über redirectFuer(kopf)${ohne.length ? ` — ohne: ${ohne.join(', ')}` : ''}`, ohne.length === 0);
  ck('Fixrunde 1 Nr. 4: zugangsKopfFuer prüft und baut den Kopf mit serverBasis (der Basis der Sitzung), nicht mit der änderbaren Einstellung resolveProxy()',
    (() => {
      const k = huelle.slice(huelle.indexOf('export async function zugangsKopfFuer'), huelle.indexOf('export async function workerRecht'));
      return k.includes('if (!serverBasis || !istWorkerZiel(url, serverBasis)) return {};') && k.includes('return kopfFuer(url, serverBasis, ') && !k.includes('resolveProxy()');
    })());
  ck('Fixrunde 1 Nr. 6: der Löschlauf lokaler Tokens nimmt nur Schlüssel von Basen der Liste (zentraleKeysFuerLoeschlauf)',
    huelle.includes('zentral: iveoGeladen ? zentraleKeysFuerLoeschlauf(iveo.erlaubteEvents()) : [],'));
  ck('Z1 Nr. 8 [T]: K33 steht vor der Übergangsmeldung — nachAnmeldung zeigt K33 und stellt k33Gezeigt, bevor irgendein Laden folgt; der Abmelden-Haken schaltet den Zeitgeber ab',
    huelle.indexOf("emit({ type: 'notice', message: textAngemeldet(s.stand) });") > 0
    && huelle.indexOf('uebergang.k33Gezeigt();') > huelle.indexOf("emit({ type: 'notice', message: textAngemeldet(s.stand) });")
    && huelle.indexOf('uebergang.k33Gezeigt();') < huelle.indexOf('void kontoLage(false);')
    && huelle.includes('      uebergang.abmelden();'));
  // Z2: die Hülle gibt dem Ablauf den echten Rückkanal (Log nur über das Launcher-Log, rueckkanal.ts schreibt nie e) und schließt ihn
  // beim Beenden (stoppeKonto → ablauf.stoppe). Verhalten von Rückkanal und Ablauf: konto-rueckkanal und konto-anmeldung.
  ck('Z2 1, M2: die Hülle verdrahtet oeffneRueckkanal mit dem Launcher-Log und die monotone Uhr (performance.now) in den Ablauf und stoppt beim Beenden den Ablauf (Rückkanal zu)',
    huelle.includes("import { oeffneRueckkanal } from './rueckkanal';") && huelle.includes('    oeffneRueckkanal: (o) => oeffneRueckkanal({ ...o, log: (z) => log?.info(z) }),')
    // Fixrunde 1 (M2): Dauern des Ablaufs auf der monotonen Uhr.
    && huelle.includes('    monoton: () => performance.now(),')
    && (() => {
      const s = huelle.slice(huelle.indexOf('export function stoppeKonto(): void {'), huelle.indexOf('export function kontoToken()'));
      return s.includes('  ablauf?.stoppe();');
    })());
}

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

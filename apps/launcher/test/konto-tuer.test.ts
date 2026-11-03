// Anmeldung im Launcher (Teil 1) · P13: Tür-Dienst und Freigabe-Stelle (src/main/konto/tuer-dienst.ts, freigaben.ts) —
// ohne Electron (tsx), mit echten Sockets nur auf 127.0.0.1 und Tür-Dateien nur in Temp-Ordnern unter os.tmpdir().
// Der Client ist der echte aus @jm/app-runtime/freigabe (Task 12); der Worker ist eine Attrappe des KontoClient.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  freigabeBeweis, holeFreigabe, inhaltsHash, tuerPfad, type FreigabeAnfrage, type FreigabeErgebnis, type TuerDatei,
} from '@jm/app-runtime/freigabe';
import type { FreigabeAusgabe, KontoAnsicht, KontoStand, KontoZustand } from '../src/shared/konto';
import { erzeugeFreigabeStelle, ZWECKE } from '../src/main/konto/freigaben';
import type { SitzungsTreiber } from '../src/main/konto/sitzung-kern';
import { starteTuerDienst } from '../src/main/konto/tuer-dienst';
import { KontoFehler, type KontoClient } from '../src/main/konto/worker-client';
import { kreuz, pruefeFaelle } from './konto-rechte.test';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const temp: string[] = [];
const appData = (): string => { const d = mkdtempSync(join(tmpdir(), 'jm-tuer-')); temp.push(d); return d; };
const T0 = Date.UTC(2026, 9, 21, 12, 0, 0);
const SITZUNG = 'jm1.test.sitzung';
const FREIGABE = 'jm1.test.freigabe';
const MIT_TOKEN: KontoZustand[] = ['pruefe', 'angemeldet', 'offline', 'server-nicht-erreichbar', 'entzogen-laeuft'];
function stand(o: Partial<KontoStand> = {}): KontoStand {
  return {
    kid: 'k1', email: 'maria.schmidt@jakobsmedien.com', name: 'Maria Schmidt', art: 'google', stufe: 'kollege', tools: [],
    events: [], zoom: true, zoomBis: null, jm: true, plattform: 'win', gid: 'g1', iat: T0, exp: T0 + 30 * 86_400_000,
    kontoBis: null, angemeldetSeit: T0, ...o,
  };
}
/** Treiber-Attrappe: Zustand und Stand fest; Token nur in den Zuständen mit gültiger Sitzung (R6). */
function treiber(zustand: KontoZustand, s: KontoStand | null): SitzungsTreiber & { ausgaben: FreigabeAusgabe[] } {
  const ausgaben: FreigabeAusgabe[] = [];
  const mitToken = MIT_TOKEN.includes(zustand);
  const ansicht = (): KontoAnsicht => ({
    zustand, stand: mitToken || zustand === 'abgelaufen' ? s : null, grund: null, gueltigBis: s?.exp ?? null, rechnerName: 'PC-Regie',
    plattform: 'win', hinweise: [], devVariablen: [], zoomAnfrage: null, adminOffen: 0, ausgaben: [...ausgaben], letztePruefung: null,
  });
  return {
    ausgaben, ansicht, start() {}, token: () => (mitToken ? SITZUNG : null), sitzungFuerBedarf: async () => (mitToken ? SITZUNG : null),
    angemeldet() {}, abmelden: async () => {}, lage: async () => {}, merkeAusgabe(a) { ausgaben.push(a); }, merkeHinweis() {},
  };
}
type WorkerAntwort = 'ok' | KontoFehler['code'];
function client(antwort: WorkerAntwort): KontoClient & { aufrufe: Array<{ sitzung: string; zweck: string; ziel: string }> } {
  const aufrufe: Array<{ sitzung: string; zweck: string; ziel: string }> = [];
  return {
    aufrufe,
    async freigabe(sitzung: string, zweck: string, ziel: string) {
      aufrufe.push({ sitzung, zweck, ziel });
      if (antwort !== 'ok') throw new KontoFehler(antwort, null);
      return { freigabe: FREIGABE, bis: T0 + 72 * 3600_000 };
    },
  } as unknown as KontoClient & { aufrufe: Array<{ sitzung: string; zweck: string; ziel: string }> };
}
const grund = (e: FreigabeErgebnis): string => (e.ok ? 'ok' : e.grund);

/** Eine Anfrage von Hand bauen (wie der Client), um Wiederholung, fremde Schlüssel und Zeitfenster zu prüfen. */
function roh(port: number, o: { schluessel: string; zeit: number; nonce: string; body?: string; pfad?: string; methode?: string }): Promise<{ status: number; beweis: string | undefined; text: string }> {
  const body = o.body ?? JSON.stringify({ v: 1, appId: 'jm-qa', zweck: 'qa-relay', ziel: 'evt-1' });
  const zeit = String(o.zeit);
  return new Promise((ja, nein) => {
    const req = request({
      host: '127.0.0.1', port, method: o.methode ?? 'POST', path: o.pfad ?? '/v1/freigabe', agent: false,
      headers: {
        'content-type': 'application/json', 'x-jm-zeit': zeit, 'x-jm-nonce': o.nonce,
        'x-jm-beweis': freigabeBeweis(o.schluessel, ['tool', zeit, o.nonce, inhaltsHash(body)]),
      },
    }, (res) => {
      let text = '';
      res.on('data', (c) => { text += String(c); });
      res.on('end', () => ja({ status: res.statusCode ?? 0, beweis: res.headers['x-jm-beweis'] as string | undefined, text }));
    });
    req.on('error', nein);
    req.end(body);
  });
}
const NONCE = (n: number): string => `nonce${String(n).padStart(17, '0')}`;
async function dienst(o: { behandle?: (a: FreigabeAnfrage) => Promise<FreigabeErgebnis>; jetzt?: () => number } = {}) {
  const dir = appData();
  const log: string[] = [];
  const behandelt: FreigabeAnfrage[] = [];
  const d = await starteTuerDienst({
    appDataDir: dir,
    behandle: async (a) => { behandelt.push(a); return o.behandle ? o.behandle(a) : { ok: false, grund: 'niemand-angemeldet' }; },
    log: (z) => log.push(z),
    jetzt: o.jetzt,
  });
  const tuer = JSON.parse(readFileSync(tuerPfad(dir), 'utf8')) as TuerDatei;
  return { dir, log, behandelt, d, tuer };
}

// --- P13 6.2: Q&A bekommt eine Freigabe über den echten Tür-Dienst ----------------------------------------------------
{
  const t = treiber('angemeldet', stand());
  const c = client('ok');
  const log: string[] = [];
  const stelle = erzeugeFreigabeStelle({ treiber: t, client: c, jetzt: () => T0, log: (z) => log.push(z) });
  const x = await dienst({ behandle: (a) => stelle.behandle(a) });
  const e = await holeFreigabe({ appId: 'jm-qa', zweck: 'qa-relay', ziel: 'evt-1' }, { appDataDir: x.dir });
  await x.d.stoppe();
  ck('P13 6.2: Q&A bekommt über den echten Tür-Dienst eine Freigabe (Client aus Task 12): Zweck und Ziel beim Worker, Konto im Ergebnis, Ausgabe gemerkt',
    e.ok === true && e.freigabe === FREIGABE && e.bis === T0 + 72 * 3600_000 && e.konto.name === 'Maria Schmidt' && e.konto.stufe === 'kollege'
    && JSON.stringify(c.aufrufe) === JSON.stringify([{ sitzung: SITZUNG, zweck: 'qa-relay', ziel: 'evt-1' }])
    && JSON.stringify(t.ausgaben) === JSON.stringify([{ appId: 'jm-qa', zweck: 'qa-relay', ziel: 'evt-1', bis: T0 + 72 * 3600_000, am: T0 }]));
  const alles = [...log, ...x.log].join('\n');
  ck('P13 G4: Log nennt Zweck, Tool und Ablauf, aber weder Freigabe noch Sitzung noch den Schlüssel der Tür-Datei',
    log.some((z) => z.includes('qa-relay') && z.includes('jm-qa')) && !alles.includes(FREIGABE) && !alles.includes(SITZUNG)
    && !alles.includes(x.tuer.schluessel) && x.log.some((z) => z.startsWith('Tür-Dienst: lauscht auf 127.0.0.1:')));
}

// --- P13 6.1, 6.2: Gründe als Kreuzprodukt -------------------------------------------------------------------------------
{
  const ZUSTAENDE: KontoZustand[] = ['nicht-angemeldet', 'pruefe', 'angemeldet', 'offline', 'server-nicht-erreichbar', 'abgelaufen',
    'entzogen', 'entzogen-laeuft', 'kein-schluesselspeicher'];
  const STAENDE = { 'kollege': stand(), 'externer mit qa': stand({ stufe: 'externer', tools: ['qa'] }), 'externer ohne qa': stand({ stufe: 'externer', tools: ['iveo'] }) };
  const ANTWORTEN: WorkerAntwort[] = ['ok', 'netz', 'server', 'kein-recht', 'sitzung-abgelaufen', 'gesperrt', 'unbekannter-zweck', 'ungueltig'];
  const faelle = kreuz({ z: ZUSTAENDE, s: Object.keys(STAENDE) as Array<keyof typeof STAENDE>, w: ANTWORTEN });
  const ergebnisse: Array<{ f: (typeof faelle)[number]; ist: string; soll: string }> = [];
  for (const f of faelle) {
    const c = client(f.w);
    const t = treiber(f.z, STAENDE[f.s]);
    const e = await erzeugeFreigabeStelle({ treiber: t, client: c, jetzt: () => T0, log: () => {} })
      .behandle({ v: 1, appId: 'jm-qa', zweck: 'qa-relay', ziel: 'evt-1' });
    const ist = `${grund(e)}${!e.ok && e.detail ? `/${e.detail}` : ''} ${c.aufrufe.length} ${t.ausgaben.length}`;
    let soll: string;
    if (!MIT_TOKEN.includes(f.z)) soll = `${f.z === 'abgelaufen' ? 'abgelaufen' : f.z === 'entzogen' ? 'entzogen' : 'niemand-angemeldet'} 0 0`;
    else if (f.s === 'externer ohne qa') soll = 'kein-recht 0 0';
    else {
      const g = { ok: 'ok', netz: 'server-nicht-erreichbar', server: 'server-nicht-erreichbar', 'kein-recht': 'kein-recht',
        'sitzung-abgelaufen': 'abgelaufen', gesperrt: 'entzogen', 'unbekannter-zweck': 'unbekannter-zweck', ungueltig: 'fehler/ungueltig' }[f.w as string];
      soll = `${g} 1 ${f.w === 'ok' ? 1 : 0}`;
    }
    ergebnisse.push({ f, ist, soll });
  }
  const r = pruefeFaelle('P13 6.2: Gründe (Zustand des Treibers × Stand × Antwort des Workers) → Ergebnis, Aufruf beim Worker, gemerkte Ausgabe',
    ergebnisse, (e) => (e.ist === e.soll ? null : `${e.f.z}/${e.f.s}/${e.f.w}: ist ${e.ist}, soll ${e.soll}`));
  ck(r.name, r.ok);
  const laeuft = await erzeugeFreigabeStelle({ treiber: treiber('entzogen-laeuft', stand()), client: client('ok'), jetzt: () => T0, log: () => {} })
    .behandle({ v: 1, appId: 'jm-qa', zweck: 'qa-relay', ziel: 'evt-1' });
  ck('P13 6.1: „Zugang entzogen, Sitzung läuft“ gibt bis zum Neustart des Launchers weiter Freigaben aus', laeuft.ok === true);
}

// --- P13 10.6: unbekannter Zweck, fremde App, Ziel fehlt ----------------------------------------------------------------
{
  const c = client('ok');
  const stelle = erzeugeFreigabeStelle({ treiber: treiber('angemeldet', stand()), client: c, jetzt: () => T0, log: () => {} });
  const zoom = await stelle.behandle({ v: 1, appId: 'jm-connect', zweck: 'zoom-jwt', ziel: 'r1' });
  const fremd = await stelle.behandle({ v: 1, appId: 'jm-titler', zweck: 'qa-relay', ziel: 'evt-1' });
  const proto = await stelle.behandle({ v: 1, appId: 'jm-qa', zweck: 'toString', ziel: 'evt-1' });
  const ohneZiel = await stelle.behandle({ v: 1, appId: 'jm-qa', zweck: 'qa-relay' });
  ck('P13 10.6: unbekannter Zweck (auch „toString“) und App nicht in der Liste → unbekannter-zweck; Ziel fehlt → fehler; nie beim Worker',
    grund(zoom) === 'unbekannter-zweck' && grund(fremd) === 'unbekannter-zweck' && grund(proto) === 'unbekannter-zweck'
    && grund(ohneZiel) === 'fehler' && c.aufrufe.length === 0
    && JSON.stringify(ZWECKE) === JSON.stringify({ 'qa-relay': { funktion: 'qa', zielNoetig: true, apps: ['jm-qa'] } }));
}

// --- P13 EP8: Wiederholung, fremder Schlüssel, Zeitfenster -----------------------------------------------------------------
{
  let uhr = T0;
  const x = await dienst({ jetzt: () => uhr });
  const p = x.d.port;
  const s = x.tuer.schluessel;
  const erst = await roh(p, { schluessel: s, zeit: T0, nonce: NONCE(1) });
  const wieder = await roh(p, { schluessel: s, zeit: T0, nonce: NONCE(1) });
  uhr = T0 + 3 * 60_000;
  const spaeter = await roh(p, { schluessel: s, zeit: uhr, nonce: NONCE(1) });
  const behandeltWdh = x.behandelt.length;
  ck('P13 EP8: Wiederholung einer mitgeschnittenen Anfrage → 401 ohne unterschriebene Antwort; dieselbe Nonce nach 2 min ist wieder frei',
    erst.status === 200 && typeof erst.beweis === 'string' && wieder.status === 401 && wieder.beweis === undefined
    && spaeter.status === 200 && behandeltWdh === 2 && x.log.includes('Tür-Dienst: Anfrage abgelehnt (Wiederholung)'));

  const vorFremd = x.behandelt.length;
  const fremd = await roh(p, { schluessel: 'test-fremder-schluessel-0000000000000000', zeit: uhr, nonce: NONCE(2) });
  const fremdDir = appData();
  const tuerFremd: TuerDatei = { ...x.tuer, schluessel: 'test-fremder-schluessel-0000000000000000' };
  mkdirSync(join(fremdDir, 'JM Production Suite'), { recursive: true });
  writeFileSync(tuerPfad(fremdDir), JSON.stringify(tuerFremd));
  const client2 = await holeFreigabe({ appId: 'jm-qa', zweck: 'qa-relay', ziel: 'evt-1' }, { appDataDir: fremdDir, jetzt: () => uhr });
  ck('P13 EP8: fremder Schlüssel → 401 ohne unterschriebene Antwort, behandle nicht gerufen; der Client sagt launcher-unecht',
    fremd.status === 401 && fremd.beweis === undefined && x.behandelt.length === vorFremd && grund(client2) === 'launcher-unecht');

  const vorZeit = x.behandelt.length;
  const z1 = await roh(p, { schluessel: s, zeit: uhr - 59_000, nonce: NONCE(3) });
  const z2 = await roh(p, { schluessel: s, zeit: uhr - 61_000, nonce: NONCE(4) });
  const z3 = await roh(p, { schluessel: s, zeit: uhr + 61_000, nonce: NONCE(5) });
  const z4 = await roh(p, { schluessel: s, zeit: uhr + 59_000, nonce: NONCE(6) });
  ck('P13 EP8: Zeitfenster ±60 s (59 s davor und danach angenommen, 61 s davor und danach 401)',
    z1.status === 200 && z2.status === 401 && z3.status === 401 && z4.status === 200 && x.behandelt.length === vorZeit + 2);

  const pfad = await roh(p, { schluessel: s, zeit: uhr, nonce: NONCE(7), pfad: '/v2/freigabe' });
  const neuer = await roh(p, { schluessel: s, zeit: uhr, nonce: NONCE(8), body: JSON.stringify({ v: 2, appId: 'jm-qa', zweck: 'qa-relay' }) });
  const kaputt = await roh(p, { schluessel: s, zeit: uhr, nonce: NONCE(9), body: '{kaputt' });
  const gross = await roh(p, { schluessel: s, zeit: uhr, nonce: NONCE(10), body: JSON.stringify({ v: 1, appId: 'jm-qa', zweck: 'qa-relay', ziel: 'x'.repeat(5000) }) });
  const get = await roh(p, { schluessel: s, zeit: uhr, nonce: NONCE(11), methode: 'GET', body: '' });
  const echt = (r: { beweis: string | undefined; text: string }, n: number): boolean => r.beweis === freigabeBeweis(s, ['launcher', NONCE(n), inhaltsHash(r.text)]);
  const quelle = readFileSync(new URL('../src/main/konto/tuer-dienst.ts', import.meta.url), 'utf8');
  ck('P13 10.8: anderer Pfad → unterschriebene 404 launcher-zu-alt; v: 2 → launcher-zu-alt; kaputt → 400 fehler; über 4 KB → 413; GET → 405; nur 127.0.0.1 (Quelltext)',
    pfad.status === 404 && echt(pfad, 7) && JSON.parse(pfad.text).grund === 'launcher-zu-alt'
    && neuer.status === 200 && echt(neuer, 8) && JSON.parse(neuer.text).grund === 'launcher-zu-alt'
    && kaputt.status === 400 && echt(kaputt, 9) && JSON.parse(kaputt.text).grund === 'fehler'
    && gross.status === 413 && gross.beweis === undefined && get.status === 405
    && (quelle.match(/\.listen\(/g) ?? []).length === 1 && quelle.includes("server.listen(0, '127.0.0.1',"));
  await x.d.stoppe();
}

// --- P13 10.8: Tür-Datei je Start neu, beim Stoppen gelöscht ----------------------------------------------------------------
{
  const a = await dienst({ jetzt: () => T0 });
  const ersteDatei = JSON.parse(readFileSync(tuerPfad(a.dir), 'utf8')) as TuerDatei;
  await a.d.stoppe();
  const wegNachStopp = !existsSync(tuerPfad(a.dir));
  const b1 = await starteTuerDienst({ appDataDir: a.dir, behandle: async () => ({ ok: false, grund: 'fehler' }), log: () => {}, jetzt: () => T0 + 1 });
  const zweite = JSON.parse(readFileSync(tuerPfad(a.dir), 'utf8')) as TuerDatei;
  // Ein späterer Launcher hat die Datei überschrieben: das Stoppen des alten löscht sie nicht.
  writeFileSync(tuerPfad(a.dir), JSON.stringify({ ...zweite, schluessel: 'test-anderer-start-00000000000000000000' }));
  await b1.stoppe();
  const fremdeBleibt = existsSync(tuerPfad(a.dir));
  ck('P13 10.8: Tür-Datei je Start neu (v 1, Port, 43 Zeichen Schlüssel, pid, start), beim Stoppen gelöscht; eine fremde Datei bleibt',
    ersteDatei.v === 1 && ersteDatei.port === a.d.port && /^[A-Za-z0-9_-]{43}$/.test(ersteDatei.schluessel) && ersteDatei.pid === process.pid
    && ersteDatei.start === T0 && wegNachStopp && zweite.schluessel !== ersteDatei.schluessel && zweite.start === T0 + 1 && fremdeBleibt);
}

// --- P13 G9 ------------------------------------------------------------------------------------------------------------------
{
  const q1 = readFileSync(new URL('../src/main/konto/tuer-dienst.ts', import.meta.url), 'utf8');
  const q2 = readFileSync(new URL('../src/main/konto/freigaben.ts', import.meta.url), 'utf8');
  ck('P13 G9: tuer-dienst.ts und freigaben.ts ohne electron-Import und ohne Konsole',
    [q1, q2].every((q) => !/from 'electron'|require\('electron'\)/.test(q) && !/console\./.test(q)));
}

for (const d of temp) {
  try { rmSync(d, { recursive: true, force: true }); } catch { /* Windows: Datei noch offen */ }
}
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

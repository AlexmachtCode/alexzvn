// Kette Master → Tool OHNE Electron (2b-Spec 18, 19.1 letzter Punkt): npm run selftest:verbund -w @jm/launcher
// Am Master laufen der echte MasterLinkServer und der Verteiler, verdrahtet wie in MasterRolle (C9). Am Tool auf B
// laufen der echte MasterLinkClient mit master-link.json im Temp-Ordner, VerbundFolger, Zwischenspeicher und
// verbundAnzeige aus @jm/app-runtime. Diese Module kommen per Relativpfad, nie über src/index.ts (das lädt Electron).
// Echte TLS-Sockets nur auf 127.0.0.1, Fristen verkürzt; Laufzeit unter 60 s. Jeder Abschnitt nennt seine Zeile aus Spec 18.
// Nicht nachbaubar und deshalb nicht hier: „bis 25 s grün“ bei gezogenem Kabel (Spec 25 Nr. 11, Abnahme Schritt 7;
// Abschnitt E prüft dasselbe mit verkürzter Stille-Frist), RELOAD an fremde Rechner (C9, reload-nachholen.test.ts),
// Rundown 0.8 mit Titler 0.10 (Abruf-Form aus Release 1).
// Gegenprobe: KETTE_GEGENPROBE=nur-erstes-abo bzw. KETTE_GEGENPROBE=ohne-speicher baut an der Testnaht einen Fehler
// ein (nur das erste Abo geht hinaus bzw. der Zwischenspeicher speichert nichts). Dann müssen die in C19 genannten Zeilen rot werden.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { connect as netConnect, createServer as createNetServer, type AddressInfo, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  fingerprintVonPem, masterLinkPfad, MasterLinkClient, MasterLinkServer, schreibeMasterLinkDatei,
  type AboInhalt, type DatenZeile, type Fristen, type MasterLinkDatei, type Nachricht, type TeilnehmerDaten,
} from '@jm/master-link';
import { migrateShow, type Show } from '@jm/show';
import { baueServer, meldeAn, neueIdentitaet } from '../../../packages/master-link/test/aufbau';
import { verbundAnzeige } from '../../../packages/app-runtime/src/verbund-anzeige';
import { VerbundFolger, type ClientLike, type StandSpeicher } from '../../../packages/app-runtime/src/verbund-daten';
import { erzeugeStandSpeicher } from '../../../packages/app-runtime/src/verbund-speicher';
import type { VerbundAnzeige, VerbundDaten } from '../../../packages/app-runtime/src/verbund-typen';
import { Verteiler } from '../src/main/verbund/verteiler';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean, detail = ''): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}
const abschnitt = (titel: string): void => console.log(`\n── ${titel}`);
const warte = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function bis(f: () => boolean, maxMs = 3000): Promise<boolean> {
  const ende = Date.now() + maxMs;
  while (Date.now() < ende) { if (f()) return true; await warte(20); }
  return f();
}
// Gesamtfrist: ein hängender Socket darf den CI-Lauf (15 min) nie blockieren.
setTimeout(() => { console.log('FAIL  Kette: Gesamtfrist 120 s überschritten'); process.exit(1); }, 120_000).unref();

const tempOrdner: string[] = [];
function temp(prefix: string): string {
  const p = mkdtempSync(join(tmpdir(), prefix));
  tempOrdner.push(p);
  return p;
}
process.on('exit', () => {
  for (const p of tempOrdner) {
    try { rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } catch { /* Windows hält den Ordner noch */ }
  }
});

const GEGENPROBE = process.env.KETTE_GEGENPROBE ?? '';
const MASTER = 'Kette-Master';
// Stille-Frist 2 s (statt 25 s): weit genug weg von den Haltezeiten in D (500 ms) und E (600 ms), auch unter Last in
// der CI (ubuntu-latest, Node 22; Nachbesserung N12).
const SERVER_FRISTEN: Partial<Fristen> = { pulsMs: 200, stilleMs: 2000 };
const CLIENT_FRISTEN: Partial<Fristen> = {
  dateiPruefMs: 50, rueckzugBasisMs: 50, rueckzugMaxMs: 200, tcpMs: 300, tlsHalloMs: 400, angemeldetMs: 400,
  stilleMs: 2000, pulsMs: 200, zertifikatWiederholMs: 300, protokollWiederholMs: 300, ersetztWiederholMs: 400,
  lastMinMs: 100, suchrundeMs: 30,
};
const FOLGER_FRISTEN = { antwortMs: 400, aboWiederholMs: 800, anwendeVersuche: 5, anwendePauseMs: 100 };

// Anzeige-Texte wörtlich aus Spec 16.4; die Uhrzeit ist fest, damit die Texte genau vergleichbar sind.
const UHR = (): string => '12:34';
const L = (s: string): string => ` · letzter Stand: ${s} 12:34`;
const V3 = (s: string): string => `${MASTER} antwortet nicht auf die Anfrage nach Show-Daten (Launcher-Update am Master nötig?)${L(s)}`;
const V4 = (s: string): string => `Show vom Master: ${s} · Stand 12:34`;
const V5 = (s: string): string => `${MASTER} hat keine Show offen${L(s)}`;
const V9 = (s: string): string => `${MASTER} nicht verbunden${L(s)}`;
const V13 = (s: string): string => `Daten vom früheren Master ${MASTER} (nicht mehr gekoppelt)${L(s)}`;
const V15 = (s: string): string => `Show-Daten von ${MASTER} nicht lesbar (Tool-Update nötig?)${L(s)}`;

// ── Shows ────────────────────────────────────────────────────────────────────
const SHOW_DIR = temp('jmkette-show-');
const SHOW_A = join(SHOW_DIR, 'Kette A.jmshow');
const SHOW_B = join(SHOW_DIR, 'Kette B.jmshow');
const A_NAME = 'Kette Show A';
const B_NAME = 'Kette Show B';
function show(name: string, ablauf: string[], speaker: string[] = ['Ada', 'Grace', 'Alan']): Show {
  return migrateShow({
    schemaVersion: 1,
    name,
    updatedAt: '2026-10-08T10:00:00.000Z',
    tools: [{ appId: 'jm-timer', settings: { durationMs: 600_000 } }],
    ablauf: ablauf.map((id) => ({ id, label: `Punkt ${id}`, durationMs: 60_000 })),
    iveo: { event: 'e2e-kette', name, syncedAt: '2026-10-08T10:00:00.000Z', speakers: speaker.map((n) => ({ name: n, title: 'Gast' })), sideEvents: [] },
  });
}

// ── Master: echter Server, Verteiler wie in MasterRolle verdrahtet ──────────
const a = await baueServer({ identitaet: neueIdentitaet(MASTER) }, SERVER_FRISTEN);
const masterLog: string[] = [];
/** Logzeilen der Tools (VerbundFolger, Zwischenspeicher, Client) — nur bei einem Fehlschlag ausgegeben. */
const toolLog: string[] = [];
/** Jedes Ereignis 'daten' (Abo) aller Server dieses Laufs, in Ankunftsfolge. */
const abos: TeilnehmerDaten[] = [];
const aboZahl = (appId: string): number => abos.filter((t) => t.appId === appId).length;
function neuerVerteiler(): Verteiler {
  return new Verteiler({ log: (stufe, text) => masterLog.push(`${stufe}: ${text}`), rechnerName: (id) => a.verbund.finde(id)?.name ?? id });
}
function zaehleAbos(s: MasterLinkServer): void {
  s.on('daten', (t: TeilnehmerDaten) => abos.push(t));
}
/** Wie MasterRolle (C9): daten/getrennt/entstaut an den Verteiler, sendeDaten zurück (der Server ist der VerteilerServer). */
function haengeAn(s: MasterLinkServer, v: Verteiler): void {
  s.on('daten', (t: TeilnehmerDaten, abo: AboInhalt) => v.aufAbo(t, abo));
  s.on('getrennt', (sitzung: number) => v.aufGetrennt(sitzung));
  s.on('entstaut', (sitzung: number) => v.aufEntstaut(sitzung));
}
function neuerServer(): MasterLinkServer {
  return new MasterLinkServer({
    identitaet: a.identitaet, verbund: a.verbund, eigeneRechnerId: a.eigen.rechnerId, suiteVersion: '0.15.0',
    lauschAdressen: ['127.0.0.1'], port: a.port, fristen: SERVER_FRISTEN,
  });
}

// ── Strecke: TCP-Weiterleitung zwischen Tool und Master; „halte“ hält alle Bytes fest (Kabel gezogen, ohne RST) ──
interface Strecke { port: number; halte(an: boolean): void; schliesse(): Promise<void> }
async function baueStrecke(zielPort: number): Promise<Strecke> {
  let halten = false;
  const paare = new Set<{ ein: Socket; aus: Socket; puffer: [Socket, Buffer][] }>();
  const srv = createNetServer((ein) => {
    const aus = netConnect(zielPort, '127.0.0.1');
    const p = { ein, aus, puffer: [] as [Socket, Buffer][] };
    paare.add(p);
    const nach = (ziel: Socket) => (d: Buffer): void => { if (halten) p.puffer.push([ziel, d]); else ziel.write(d); };
    ein.on('data', nach(aus));
    aus.on('data', nach(ein));
    const zu = (): void => { paare.delete(p); ein.destroy(); aus.destroy(); };
    for (const s of [ein, aus]) { s.on('close', zu); s.on('error', zu); }
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  return {
    port: (srv.address() as AddressInfo).port,
    halte(an: boolean): void {
      halten = an;
      if (an) return;
      for (const p of paare) {
        for (const [ziel, d] of p.puffer) if (!ziel.destroyed) ziel.write(d);
        p.puffer = [];
      }
    },
    async schliesse(): Promise<void> {
      for (const p of paare) { p.ein.destroy(); p.aus.destroy(); }
      await new Promise<void>((r) => srv.close(() => r()));
    },
  };
}

// ── Tool auf Rechner B: echter Client, VerbundFolger, Zwischenspeicher; der Handler zählt Anwendungen ──
interface Anwendung { epoche: string; folge: number; neueShow: boolean; name: string; json: string }
interface Werkzeug {
  appId: string;
  client: MasterLinkClient;
  folger: VerbundFolger;
  speicherDatei: string;
  anwendungen: Anwendung[];
  /** Anzeige nach jedem Wechsel (beiWechsel), null = keine Anzeige. */
  verlauf: (VerbundAnzeige | null)[];
  /** Eingegangene stand/aenderung am Client (Ereignis 'daten'). */
  eingang: DatenZeile[];
  /** true: anwenden wirft EBUSY (Spec 18 „Stand nicht anwendbar“). */
  wirft: boolean;
  anzeige(): VerbundAnzeige | null;
  stoppe(): Promise<void>;
}
/** Testnaht der Gegenprobe „nur-erstes-abo“: jedes weitere Abo wird geschluckt (sende meldet trotzdem true). */
function alsClientLike(c: MasterLinkClient): ClientLike {
  if (GEGENPROBE !== 'nur-erstes-abo') return c;
  let abo = 0;
  return {
    zustand: () => c.zustand(),
    kopplung: () => c.kopplung(),
    sende: (n: Nachricht): boolean => (n.t === 'abo' && ++abo > 1 ? true : c.sende(n)),
    on: (e, f) => c.on(e, f),
  };
}
/** Testnaht der Gegenprobe „ohne-speicher“: speichert nichts, liest nichts. */
function speicherFuer(datei: string): StandSpeicher {
  if (GEGENPROBE === 'ohne-speicher') return { lies: () => null, schreibe: async () => true, loesche: () => {} };
  return erzeugeStandSpeicher(datei, (stufe, t) => toolLog.push(`speicher ${stufe}: ${t}`));
}
let pid = 100;
function baueWerkzeug(appId: string, dateiPfad: string, userData: string): Werkzeug {
  const client = new MasterLinkClient({
    dateiPfad, teilnehmer: { art: 'tool', appId, name: appId, version: '0.14.0', pid: pid++ }, fristen: CLIENT_FRISTEN, suche: null,
    log: (stufe, t) => toolLog.push(`${appId} ${stufe}: ${t}`),
  });
  const speicherDatei = join(userData, 'verbund', 'master-stand.json');
  const folger = new VerbundFolger({ client: alsClientLike(client), speicher: speicherFuer(speicherDatei),
    log: (stufe, t) => toolLog.push(`${appId} ${stufe}: ${t}`), fristen: FOLGER_FRISTEN });
  const w: Werkzeug = {
    appId, client, folger, speicherDatei, anwendungen: [], verlauf: [], eingang: [], wirft: false,
    anzeige: () => verbundAnzeige(folger.daten(), UHR),
    async stoppe(): Promise<void> { folger.stoppe(); await client.stoppe(); },
  };
  folger.folge({
    anwenden(stand, neueShow): void {
      w.anwendungen.push({ epoche: stand.epoche, folge: stand.folge, neueShow, name: stand.show.name, json: JSON.stringify(stand.show) });
      if (w.wirft) throw Object.assign(new Error('gesperrt'), { code: 'EBUSY' });
    },
    beiWechsel(d: VerbundDaten): void { w.verlauf.push(verbundAnzeige(d, UHR)); },
  });
  client.on('daten', (n: DatenZeile) => w.eingang.push(n));
  // Reihenfolge wie in app-runtime (C13): verbundAnClient direkt nach client.starte().
  client.starte();
  folger.starte();
  return w;
}
const text = (w: Werkzeug): string => w.anzeige()?.text ?? '—';
const farbe = (w: Werkzeug): string => w.anzeige()?.farbe ?? '—';
const letzte = (w: Werkzeug): Anwendung | undefined => w.anwendungen.at(-1);
function speicherInhalt(w: Werkzeug): { fassung?: number; stand?: { epoche?: string; folge?: number } } | null {
  try { return JSON.parse(readFileSync(w.speicherDatei, 'utf8')); } catch { return null; }
}
/** V9 (gelb) oder V11 (rot, Text des Clients) mit Zusatz L; liest Daten und Anzeige im selben Takt. */
function getrenntMitL(w: Werkzeug, s: string): { ok: boolean; v9: boolean; v11: boolean; detail: string } {
  const d = w.folger.daten();
  const z = verbundAnzeige(d, UHR);
  const v9 = z?.text === V9(s) && z.farbe === 'gelb';
  const v11 = d.art === 'getrennt' && d.client.art === 'fehler' && z?.text === `${d.client.text}${L(s)}` && z.farbe === 'rot';
  return { ok: v9 || v11, v9, v11, detail: `${d.art} · ${z?.farbe ?? '—'} · ${z?.text ?? '—'}` };
}
function dateiSlave(port: number, teil: Partial<MasterLinkDatei> = {}): MasterLinkDatei {
  return {
    version: 1, rolle: 'slave', rechner: { id: a.slave.rechnerId, name: 'Regie-Laptop 2' }, netzwerk: { karte: null },
    kopplung: {
      masterId: a.identitaet.masterId, masterName: MASTER, fingerprint: fingerprintVonPem(a.identitaet.zertifikat),
      zertifikat: a.identitaet.zertifikat, port, adressen: ['127.0.0.1'], letzteAdresse: null, festeAdresse: null, schluessel: a.slave.paar,
    },
    ...teil,
  };
}

const showA1 = show(A_NAME, ['a-1', 'a-2', 'a-3']);
const showA2 = show(A_NAME, ['a-1', 'a-2', 'a-3', 'a-4']);
const showB1 = show(B_NAME, ['b-1', 'b-2']);

abschnitt('A · 0.15 + 2b-Tool → Daten (Spec 18, gemischte Versionen Zeile 3)');
let server: MasterLinkServer = a.server;
const v1 = neuerVerteiler();
v1.meldeShow(SHOW_A, showA1); // vor starte(): wird gemerkt und beim Start verteilt
v1.starte(server);
zaehleAbos(server);
haengeAn(server, v1);
const strecke = await baueStrecke(a.port);
const pfadT = masterLinkPfad(temp('jmkette-app-'));
const userDataT = temp('jmkette-user-');
schreibeMasterLinkDatei(pfadT, dateiSlave(strecke.port));
let T = baueWerkzeug('jm-timer', pfadT, userDataT);
await bis(() => text(T) === V4(A_NAME), 5000);
ck('A · V4 „Show vom Master: … · Stand …“ grün', text(T) === V4(A_NAME) && farbe(T) === 'gruen', `${farbe(T)} · ${text(T)}`);
ck('A · erster Stand angewendet: Folge 0, neueShow true, Show A', T.anwendungen.length === 1 && T.anwendungen[0].folge === 0
  && T.anwendungen[0].neueShow && T.anwendungen[0].name === A_NAME, JSON.stringify(T.anwendungen.map((x) => [x.folge, x.neueShow, x.name])));
ck('A · Abo genau einmal nach der Anmeldung', aboZahl('jm-timer') === 1, `${aboZahl('jm-timer')} Abos`);
ck('A · Antwort auf das Abo ist „stand“', T.eingang.length === 1 && T.eingang[0].t === 'stand', T.eingang.map((n) => n.t).join(','));
ck('A · im Verbundmodus', T.folger.imVerbundmodus());
await bis(() => speicherInhalt(T)?.stand?.folge === 0, 2000);
const sp0 = speicherInhalt(T);
ck('A · Zwischenspeicher geschrieben (fassung 1, Epoche und Folge des Stands)', sp0?.fassung === 1 && sp0.stand?.epoche === T.anwendungen[0]?.epoche
  && sp0.stand?.folge === 0, JSON.stringify(sp0?.stand ? { fassung: sp0.fassung, epoche: sp0.stand.epoche, folge: sp0.stand.folge } : sp0));

abschnitt('B · Änderung am Ablauf → aenderung, Folge + 1, gleiche Show');
v1.meldeShow(SHOW_A, showA2);
await bis(() => T.anwendungen.length === 2, 3000);
ck('B · angewendet mit Folge 1 und neueShow false', T.anwendungen.length === 2 && letzte(T)?.folge === 1 && letzte(T)?.neueShow === false,
  JSON.stringify(T.anwendungen.map((x) => [x.folge, x.neueShow])));
ck('B · kam als „aenderung“', T.eingang.at(-1)?.t === 'aenderung', T.eingang.map((n) => n.t).join(','));
ck('B · der neue Punkt a-4 steht in der angewendeten Show', letzte(T)?.json.includes('"a-4"') === true);

abschnitt('C · Master öffnet dieselbe Show unverändert erneut (E9) → keine aenderung, kein anwenden');
const eingangC = T.eingang.length;
v1.meldeShow(SHOW_A, show(A_NAME, ['a-1', 'a-2', 'a-3', 'a-4']));
await warte(600);
ck('C · keine neue Zeile am Tool', T.eingang.length === eingangC, `${T.eingang.length - eingangC} neue Zeilen`);
ck('C · nicht erneut angewendet', T.anwendungen.length === 2, `${T.anwendungen.length} Anwendungen`);

abschnitt('D · Netz kurz weg, unter der Stille-Frist (Spec 18 Zeile 1) → Daten bleiben, V4');
const abosD = aboZahl('jm-timer');
let immerGruen = true;
strecke.halte(true);
const endeD = Date.now() + 500;
while (Date.now() < endeD) { if (text(T) !== V4(A_NAME) || T.client.zustand().art !== 'verbunden') immerGruen = false; await warte(20); }
strecke.halte(false);
await warte(300);
ck('D · während 500 ms ohne Bytes durchgehend V4 und verbunden', immerGruen && text(T) === V4(A_NAME), text(T));
ck('D · kein neues Abo (die Leitung riss nicht)', aboZahl('jm-timer') === abosD, `${aboZahl('jm-timer') - abosD} neue Abos`);

abschnitt('E · Netz länger weg (Spec 18 Zeile 2, Stille-Frist hier 2 s statt 25 s) → Neuabo, gleicher Stand nicht neu angewendet');
const abosE = aboZahl('jm-timer');
const anwE = T.anwendungen.length;
const verlaufE = T.verlauf.length;
const eingangE = T.eingang.length;
strecke.halte(true);
await warte(600);
ck('E · bis zur Stille-Frist bleibt V4 grün', text(T) === V4(A_NAME) && farbe(T) === 'gruen', `${farbe(T)} · ${text(T)}`);
await bis(() => getrenntMitL(T, A_NAME).ok, 5000);
const gE = getrenntMitL(T, A_NAME);
ck('E · danach V9 bzw. V11 mit Zusatz L', gE.ok, gE.detail);
await warte(1000);
strecke.halte(false);
await bis(() => text(T) === V4(A_NAME), 5000);
const nachE = T.verlauf.slice(verlaufE).map((z) => z?.text ?? '—');
ck('E · nach dem Wiederverbinden wieder V4', text(T) === V4(A_NAME), `${farbe(T)} · ${text(T)}`);
ck('E · dazwischen „Suche/nicht verbunden“ oder Fehler mit Zusatz L', nachE.some((x) => x.endsWith(L(A_NAME))), nachE.join(' | '));
ck('E · Neuabo nach dem Wiederverbinden', aboZahl('jm-timer') > abosE, `${aboZahl('jm-timer') - abosE} neue Abos`);
const standE = T.eingang.slice(eingangE).filter((n) => n.t === 'stand').at(-1);
ck('E · der neue „stand“ trägt dieselbe Epoche und Folge', standE?.epoche === letzte(T)?.epoche && standE?.folge === letzte(T)?.folge,
  JSON.stringify({ stand: standE ? [standE.epoche, standE.folge] : null, angewendet: [letzte(T)?.epoche, letzte(T)?.folge] }));
ck('E · gleicher Stand nicht neu angewendet', T.anwendungen.length === anwE, `${T.anwendungen.length - anwE} neue Anwendungen`);

abschnitt('F · Master öffnet eine andere Show (Spec 18) → neueShow true, V4');
v1.meldeShow(SHOW_B, showB1);
await bis(() => letzte(T)?.name === B_NAME, 3000);
ck('F · Show B angewendet mit neueShow true', letzte(T)?.name === B_NAME && letzte(T)?.neueShow === true, JSON.stringify(letzte(T) && [letzte(T)!.name, letzte(T)!.neueShow]));
await bis(() => text(T) === V4(B_NAME), 2000);
ck('F · V4 mit Show B', text(T) === V4(B_NAME), text(T));

abschnitt('G · Master-Launcher beendet / Master-Rolle aus (Spec 18) → Daten bleiben, kurz V9, dann V11');
const anwG = T.anwendungen.length;
const verlaufG = T.verlauf.length;
await server.stoppe();
v1.stoppe();
await bis(() => { const g = getrenntMitL(T, B_NAME); return g.v11; }, 4000);
const gG = getrenntMitL(T, B_NAME);
ck('G · V11 mit dem Text des Clients und Zusatz L', gG.v11, gG.detail);
const nachG = T.verlauf.slice(verlaufG).map((z) => z?.text ?? '—');
const iV9 = nachG.indexOf(V9(B_NAME));
const iV11 = nachG.findIndex((x) => x !== V9(B_NAME) && x.endsWith(L(B_NAME)));
ck('G · erst V9 „nicht verbunden“, dann V11', iV9 >= 0 && iV11 > iV9, nachG.join(' | '));
ck('G · Daten bleiben (nichts angewendet, nichts verworfen)', T.anwendungen.length === anwG && letzte(T)?.name === B_NAME);
ck('G · bleibt im Verbundmodus (RELOAD bleibt ignoriert)', T.folger.imVerbundmodus());

abschnitt('H · Master-Launcher startet ohne Show (Spec 18) → V5, dann die Show öffnen → V4');
const v2 = neuerVerteiler();
server = neuerServer();
v2.starte(server);
zaehleAbos(server);
haengeAn(server, v2);
await server.starte();
await bis(() => text(T) === V5(B_NAME), 5000);
ck('H · V5 „hat keine Show offen“ mit Zusatz L, gelb', text(T) === V5(B_NAME) && farbe(T) === 'gelb', `${farbe(T)} · ${text(T)}`);
ck('H · Daten bleiben (keine-show wendet nichts an)', T.anwendungen.length === anwG);
v2.meldeShow(SHOW_B, showB1);
await bis(() => T.anwendungen.length === anwG + 1, 3000);
ck('H · Show geöffnet: angewendet mit neueShow false (gleicher Master, gleicher Schlüssel)', T.anwendungen.length === anwG + 1
  && letzte(T)?.neueShow === false && letzte(T)?.name === B_NAME, JSON.stringify(T.anwendungen.slice(anwG).map((x) => [x.name, x.neueShow])));
await bis(() => text(T) === V4(B_NAME), 2000);
ck('H · danach V4', text(T) === V4(B_NAME), text(T));

abschnitt('I · Master öffnet dieselbe Show wieder: neue Epoche (Spec 18) → einmal angewendet, Ergebnis gleich, V4');
const vorI = letzte(T)!;
await server.stoppe();
v2.stoppe();
server = neuerServer();
v2.starte(server); // neue Epoche; die gemerkte Show B wird verteilt
zaehleAbos(server);
haengeAn(server, v2);
await server.starte();
await bis(() => T.anwendungen.length === anwG + 2, 5000);
await warte(300);
ck('I · genau einmal angewendet', T.anwendungen.length === anwG + 2, `${T.anwendungen.length - anwG - 1} Anwendungen`);
ck('I · neue Epoche, neueShow false', letzte(T)?.epoche !== vorI.epoche && letzte(T)?.neueShow === false, JSON.stringify([vorI.epoche, letzte(T)?.epoche, letzte(T)?.neueShow]));
ck('I · Ergebnis gleich (dieselbe Show wie vorher angewendet)', letzte(T)?.json === vorI.json);
await bis(() => text(T) === V4(B_NAME), 2000);
ck('I · V4', text(T) === V4(B_NAME), text(T));

abschnitt('J · Stand nicht anwendbar (Spec 18) → alter Stand bleibt, fünf neue Versuche, V12');
const anwJ = T.anwendungen.length;
const speicherVorJ = existsSync(T.speicherDatei) ? readFileSync(T.speicherDatei, 'utf8') : '';
T.wirft = true;
v2.meldeShow(SHOW_B, show(B_NAME, ['b-1', 'b-2', 'b-3']));
await bis(() => T.anwendungen.length >= anwJ + 1 + FOLGER_FRISTEN.anwendeVersuche, 3000);
await warte(FOLGER_FRISTEN.anwendePauseMs * 4);
ck('J · erster Versuch plus fünf neue (Spec 16.2 „bis zu fünfmal … erneut“)', T.anwendungen.length === anwJ + 1 + FOLGER_FRISTEN.anwendeVersuche,
  `${T.anwendungen.length - anwJ} Aufrufe`);
const zJ = T.anzeige();
ck('J · V12 „Show vom Master nicht übernommen: …“ mit „· in Benutzung: Show B“, rot', zJ?.farbe === 'rot'
  && zJ.text.startsWith('Show vom Master nicht übernommen: ') && zJ.text.endsWith(` · in Benutzung: ${B_NAME} 12:34`), `${zJ?.farbe} · ${zJ?.text}`);
ck('J · Zwischenspeicher unverändert', (existsSync(T.speicherDatei) ? readFileSync(T.speicherDatei, 'utf8') : '') === speicherVorJ);
T.wirft = false;
v2.meldeShow(SHOW_B, show(B_NAME, ['b-1', 'b-2', 'b-3', 'b-4']));
await bis(() => text(T) === V4(B_NAME), 3000);
ck('J · der nächste Stand wird angewendet, Fehler weg, V4', text(T) === V4(B_NAME) && letzte(T)?.json.includes('"b-4"') === true, text(T));

abschnitt('K · Stand ungültig (Spec 18, Prüfung 13.2) → alter Stand bleibt, V15, Leitung bleibt');
const anwK = T.anwendungen.length;
const sitzungT = abos.filter((t) => t.appId === 'jm-timer').at(-1)?.sitzung ?? -1;
const ungueltig = '{"t":"aenderung","art":"show","fassung":1,"epoche":"kein gültiges","folge":99,"schluessel":null,"show":null,"grund":"keine-show","mitDokument":[]}\n';
const ergK = server.sendeDaten(sitzungT, ungueltig);
ck('K · ungültige Zeile ging hinaus', ergK === 'gesendet', ergK);
await bis(() => text(T) === V15(B_NAME), 3000);
ck('K · V15 „Show-Daten von … nicht lesbar (Tool-Update nötig?)“ mit Zusatz L, rot', text(T) === V15(B_NAME) && farbe(T) === 'rot', `${farbe(T)} · ${text(T)}`);
ck('K · nichts angewendet, Leitung steht', T.anwendungen.length === anwK && T.client.zustand().art === 'verbunden', T.client.zustand().art);
v2.meldeShow(SHOW_B, show(B_NAME, ['b-1', 'b-2', 'b-3', 'b-4', 'b-5']));
await bis(() => text(T) === V4(B_NAME), 3000);
ck('K · der nächste gültige Stand löscht den Verwurf, V4', text(T) === V4(B_NAME) && T.anwendungen.length === anwK + 1, text(T));

abschnitt('L · Kopplung an B getrennt (Spec 18) → Verbundmodus endet, Daten bleiben, V13');
const anwL = T.anwendungen.length;
schreibeMasterLinkDatei(pfadT, dateiSlave(strecke.port, { kopplung: null }));
await bis(() => text(T) === V13(B_NAME), 3000);
const dL = T.folger.daten();
ck('L · frueher (entkoppelt), V13 gelb mit Zusatz L', dL.art === 'frueher' && dL.grund === 'entkoppelt' && text(T) === V13(B_NAME) && farbe(T) === 'gelb',
  `${dL.art} · ${farbe(T)} · ${text(T)}`);
ck('L · nicht mehr im Verbundmodus, Daten und Zwischenspeicher bleiben', !T.folger.imVerbundmodus() && T.anwendungen.length === anwL && existsSync(T.speicherDatei));
T.folger.ersetzt(); // das Tool hat eine eigene Show angewendet (16.1)
ck('L · eigene Show → einzelplatz, keine Anzeige, Zwischenspeicher gelöscht', T.folger.daten().art === 'einzelplatz' && T.anzeige() === null
  && !existsSync(T.speicherDatei), `${T.folger.daten().art} · ${text(T)}`);
schreibeMasterLinkDatei(pfadT, dateiSlave(strecke.port));
await bis(() => text(T) === V4(B_NAME), 5000);
ck('L · neu gekoppelt → Stand vom Master gilt wieder als neue Show, V4', text(T) === V4(B_NAME) && letzte(T)?.neueShow === true
  && T.anwendungen.length === anwL + 1, `${text(T)} · ${JSON.stringify(T.anwendungen.slice(anwL).map((x) => x.neueShow))}`);
await bis(() => existsSync(T.speicherDatei), 2000);

abschnitt('M · Tool auf B startet neu, Master fehlt (Spec 18) → Daten aus dem Zwischenspeicher, kurz V9, dann V11');
const zuletztM = letzte(T)!;
await T.stoppe();
await server.stoppe();
v2.stoppe();
T = baueWerkzeug('jm-timer', pfadT, userDataT);
await bis(() => T.anwendungen.length === 1, 2000);
ck('M · Zwischenspeicher angewendet: einmal, neueShow false, dieselbe Show', T.anwendungen.length === 1 && T.anwendungen[0].neueShow === false
  && T.anwendungen[0].json === zuletztM.json, JSON.stringify(T.anwendungen.map((x) => [x.name, x.neueShow])));
await bis(() => getrenntMitL(T, B_NAME).v11, 4000);
const gM = getrenntMitL(T, B_NAME);
ck('M · V11 mit Zusatz L (letzter Stand aus dem Zwischenspeicher)', gM.v11, gM.detail);
const nachM = T.verlauf.map((z) => z?.text ?? '—'); // ab dem Bau des Tools: der Zwischenspeicher wird schon in starte() angewendet
const iV9M = nachM.indexOf(V9(B_NAME));
ck('M · erst V9 „nicht verbunden“, dann V11', iV9M >= 0 && nachM.findIndex((x) => x !== V9(B_NAME) && x.endsWith(L(B_NAME))) > iV9M, nachM.join(' | '));
ck('M · beim Start nie V13 (die Datei ist unverändert gekoppelt, 16.1/16.3)', !nachM.includes(V13(B_NAME)), nachM.join(' | '));
ck('M · im Verbundmodus (gleicher Master)', T.folger.imVerbundmodus());

abschnitt('N · Master ≤ 0.14 ohne Verteiler (Spec 18, gemischte Versionen Zeile 1) → nach der Antwortfrist V3, Abo wiederholt');
server = neuerServer();
zaehleAbos(server); // nur zählen: niemand beantwortet das Abo
await server.starte();
const abosN = aboZahl('jm-timer');
await bis(() => text(T) === V3(B_NAME), 5000);
ck('N · V3 „antwortet nicht auf die Anfrage nach Show-Daten …“ mit Zusatz L, gelb', text(T) === V3(B_NAME) && farbe(T) === 'gelb', `${farbe(T)} · ${text(T)}`);
await bis(() => aboZahl('jm-timer') >= abosN + 2, 3000);
ck('N · Abo wird wiederholt', aboZahl('jm-timer') >= abosN + 2, `${aboZahl('jm-timer') - abosN} Abos`);
const anwN = T.anwendungen.length;
v2.starte(server); // ein Platz wird frei bzw. der Master bekommt das Update: das nächste wiederholte Abo wird beantwortet
haengeAn(server, v2);
await bis(() => text(T) === V4(B_NAME), 3000);
ck('N · das wiederholte Abo wird beantwortet, V4', text(T) === V4(B_NAME) && T.anwendungen.length === anwN + 1, text(T));

abschnitt('O · Teil-1-Tool ohne Abo (Spec 18, gemischte Versionen Zeile 2; 19.1) → angemeldet, keine 2b-Zeile');
const roh = await meldeAn(a, a.slave, 'jm-titler', 4711);
const angemeldet = await roh.naechste('angemeldet', 2000);
const rohPuls = setInterval(() => roh.v.sende({ t: 'puls' }), 200); // ein Teil-1-Tool pulst; sonst trennt die Stille-Frist des Servers
ck('O · Teil-1-Client ist angemeldet', angemeldet !== null);
const anwO = T.anwendungen.length;
v2.meldeShow(SHOW_B, show(B_NAME, ['b-1', 'b-2', 'b-3', 'b-4', 'b-5', 'b-6']));
await bis(() => T.anwendungen.length === anwO + 1, 3000);
await warte(300);
ck('O · das 2b-Tool bekommt die Änderung', T.anwendungen.length === anwO + 1);
ck('O · der Teil-1-Client bekommt keine stand/aenderung und bleibt angemeldet',
  !roh.nachrichten.some((n) => n.t === 'stand' || n.t === 'aenderung') && !roh.beendet(), roh.nachrichten.map((n) => n.t).join(','));
clearInterval(rohPuls);
roh.zu();

abschnitt('P · Slave-Launcher (Spec 18, gemischte Versionen Zeile 6) → sein Abo wird ignoriert');
const pfadL = masterLinkPfad(temp('jmkette-app-'));
schreibeMasterLinkDatei(pfadL, dateiSlave(a.port));
const launcherB = new MasterLinkClient({
  dateiPfad: pfadL, teilnehmer: { art: 'launcher', appId: 'jm-launcher', name: 'JM Production Suite', version: '0.15.0', pid: 4712 }, fristen: CLIENT_FRISTEN, suche: null,
});
const launcherDaten: DatenZeile[] = [];
launcherB.on('daten', (n: DatenZeile) => launcherDaten.push(n));
launcherB.starte();
await bis(() => launcherB.zustand().art === 'verbunden', 3000);
const abosP = aboZahl('jm-launcher');
ck('P · Abo des Slave-Launchers geht hinaus', launcherB.sende({ t: 'abo', art: 'show', fassung: 1 }));
await bis(() => aboZahl('jm-launcher') > abosP, 2000);
await warte(500);
ck('P · der Master hat es bekommen (art launcher), antwortet aber nicht', aboZahl('jm-launcher') === abosP + 1
  && abos.at(-1)?.art === 'launcher' && launcherDaten.length === 0, `${launcherDaten.length} Zeilen am Launcher`);
await launcherB.stoppe();

abschnitt('Q · Tool auf dem Master-Rechner (Spec 16.1, 18 Zeile „beliebig | Tool auf dem Master-Rechner“) → Einzelplatz, kein Abo');
const pfadQ = masterLinkPfad(temp('jmkette-app-'));
const kopplungQ = dateiSlave(a.port).kopplung!;
schreibeMasterLinkDatei(pfadQ, { version: 1, rolle: 'master', rechner: { id: a.eigen.rechnerId, name: 'Regie-PC' }, netzwerk: { karte: null },
  kopplung: { ...kopplungQ, schluessel: a.eigen.paar } });
const Q = baueWerkzeug('jm-rundown', pfadQ, temp('jmkette-user-'));
await bis(() => Q.client.zustand().art === 'verbunden', 3000);
await warte(FOLGER_FRISTEN.antwortMs + 300);
ck('Q · der Client ist am Master angemeldet', Q.client.zustand().art === 'verbunden', Q.client.zustand().art);
ck('Q · einzelplatz, keine Anzeige, nicht im Verbundmodus', Q.folger.daten().art === 'einzelplatz' && Q.anzeige() === null && !Q.folger.imVerbundmodus(),
  `${Q.folger.daten().art} · ${text(Q)}`);
ck('Q · kein Abo von diesem Rechner, nichts angewendet', !abos.some((t) => t.rechnerId === a.eigen.rechnerId) && Q.anwendungen.length === 0);
await Q.stoppe();

abschnitt('R · Rolle „aus“ (Spec 18, gemischte Versionen letzte Zeile) → unverändert, Einzelplatz');
const pfadR = masterLinkPfad(temp('jmkette-app-'));
schreibeMasterLinkDatei(pfadR, dateiSlave(a.port, { rolle: 'aus' }));
const R = baueWerkzeug('jm-qa', pfadR, temp('jmkette-user-'));
await warte(FOLGER_FRISTEN.antwortMs + 300);
ck('R · Client aus, einzelplatz, keine Anzeige, kein Abo', R.client.zustand().art === 'aus' && R.folger.daten().art === 'einzelplatz'
  && R.anzeige() === null && aboZahl('jm-qa') === 0, `${R.client.zustand().art} · ${R.folger.daten().art}`);
await R.stoppe();

await T.stoppe();
await server.stoppe();
v2.stoppe();
await strecke.schliesse();
if (fail > 0) {
  console.log('\nVerteiler-Log (Master):');
  for (const z of masterLog) console.log(`  ${z}`);
  console.log('Tool-Log:');
  for (const z of toolLog) console.log(`  ${z}`);
}
if (GEGENPROBE) console.log(`\nGEGENPROBE ${GEGENPROBE}: rote Zeilen oben sind erwartet (C19).`);
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

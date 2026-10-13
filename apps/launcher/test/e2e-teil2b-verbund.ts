// ─────────────────────────────────────────────────────────────────────────────
// Durchgang Master-Link Teil 2b, Release 2 (2b-Spec 19.7) mit den GEBAUTEN Tools Timer, Titler und Rundown.
// NICHT in der CI: startet die drei Tools aus diesem Repo als echte Electron-Programme, ohne Deep-Link, und spielt
// selbst den Master: MasterLinkServer mit Test-Identität auf Port 8738 und Verteiler mit einer Test-Show.
// Ein Launcher läuft nicht mit.
//
// Aufruf (Repo-Wurzel, nach `npm run build -w @jm/timer -w @jm/titler -w @jm/rundown`):
//   ELECTRON_EXE=<Pfad zu electron.exe> node node_modules/tsx/dist/cli.mjs apps/launcher/test/e2e-teil2b-verbund.ts
// ELECTRON_EXE ist Pflicht. Ohne sie bricht das Skript ab, bevor es eine Datei oder einen Port anfasst.
//
// Vorher darf kein Launcher, Timer, Titler oder Rundown laufen
// (Ports 8738, 8736, 7777, 8724, 8726, 8731, 9334, 9335, 9336 frei).
// Das Skript legt die Daten, die es verändert, VOR dem Lauf beiseite (umbenennen nach <name>.e2e-vorher) und
// stellt sie in jedem Ausgang wieder her (auch Abbruch und Strg+C):
//   %APPDATA%\JM Production Suite\master-link.json (das Skript schreibt eine eigene: Rolle Slave, Master 127.0.0.1:8738),
//   %APPDATA%\@jm\timer\state.json, %APPDATA%\@jm\timer\verbund,
//   %APPDATA%\@jm\titler\titler-config.json, iveo-data, show-zuletzt.json, verbund,
//   %APPDATA%\@jm\rundown\regie, rundown.autosave.jmrundown, rundown.autosave.v1.jmrundown, verbund.
// Liegt von einem früheren Lauf (auch von e2e-teil2a.mjs) noch eine <name>.e2e-vorher da, bricht es ab.
//
// Messpunkte (19.7): STATE über die Steuerports (Titler 8726, Rundown 8731), den Timer-Ablauf über den
// Timer-Socket 7777, die V-Zeile je Tool per DevTools über verbundAnzeige() aus dem Preload (Timer 9336, Titler 9335,
// Rundown 9334), die Hinweise des Rundowns (gesammelt: kurze verschwinden nach 6 s) und das Vorschaubild des Titlers
// (SHA-256 von toDataURL(), 1,5 s nach jeder Aktion, Gegenprobe „Bild nicht leer“).
// Eigene Helfer statt e2e-teil2a.mjs (Entscheidung E26): bis() fängt Ausnahmen, DevTools wertet `error` aus, jede
// Prüfzeile trägt ein Detail.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io, type Socket as IoSocket } from 'socket.io-client';
import { controlClientOptions, readControlConfig } from '@jm/control-config';
import {
  erzeugeSchluesselpaar, fingerprintVonPem, MASTER_PORT, masterLinkPfad, MasterLinkServer, schreibeMasterLinkDatei, SpeicherVerbund,
  type AboInhalt, type MasterLinkDatei, type TeilnehmerDaten,
} from '@jm/master-link';
import { migrateShow, type Show } from '@jm/show';
import { SuiteControlClient } from '@jm/suite-control-protocol/client';
import { neueIdentitaet } from '../../../packages/master-link/test/aufbau';
import { Verteiler } from '../src/main/verbund/verteiler';

type Tool = 'timer' | 'titler' | 'rundown';
const TOOLS: Tool[] = ['timer', 'titler', 'rundown'];
const NAME: Record<Tool, string> = { timer: 'Timer', titler: 'Titler', rundown: 'Rundown' };
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ELECTRON = process.env.ELECTRON_EXE ?? '';
const APPDATA = process.env.APPDATA ?? '';
/** userData eines Dev-Starts: Electron nimmt den Paketnamen @jm/<app>. */
const DEV = (app: Tool): string => join(APPDATA, '@jm', app);
const LOG = (app: Tool): string => join(DEV(app), 'logs', 'main.log');
const CDP: Record<Tool, number> = { rundown: 9334, titler: 9335, timer: 9336 };
const STEUER: Record<Tool, number> = { timer: 8724, titler: 8726, rundown: 8731 };
const PORTS: Record<string, number> = {
  master: MASTER_PORT, launcher: 8736, timerSocket: 7777, timer: STEUER.timer, titler: STEUER.titler, rundown: STEUER.rundown,
  rundownDevTools: CDP.rundown, titlerDevTools: CDP.titler, timerDevTools: CDP.timer,
};
const VORHER = '.e2e-vorher';
const SICHERN = [
  masterLinkPfad(APPDATA),
  join(DEV('timer'), 'state.json'),
  join(DEV('timer'), 'verbund'),
  join(DEV('titler'), 'titler-config.json'),
  join(DEV('titler'), 'iveo-data'),
  join(DEV('titler'), 'show-zuletzt.json'),
  join(DEV('titler'), 'verbund'),
  join(DEV('rundown'), 'regie'),
  join(DEV('rundown'), 'rundown.autosave.jmrundown'),
  join(DEV('rundown'), 'rundown.autosave.v1.jmrundown'),
  join(DEV('rundown'), 'verbund'),
];
const MASTER_NAME = 'E2E-Master';
const SHOW_NAME = 'E2E Verbund';
const SHOW_PFAD = join(tmpdir(), 'jm-e2e-2b', 'E2E Verbund.jmshow'); // nur für den Schlüssel; die Datei muss nicht existieren
const RECHNER_B = { id: 'e2e-rechner-b', name: 'E2E-Rechner-B' };
const LABEL: Record<string, string> = { 'v-1': 'Begrüßung', 'v-2': 'Panel', 'v-3': 'Abschluss', 'v-4': 'Ausblick' };
// Einwort-Namen: STATE trennt an Leerzeichen, so liest der Titler-Messpunkt den ganzen Namen.
const FUNKTION: Record<string, string> = { Ada: 'Moderation', Grace: 'Keynote', Alan: 'Panel', Hedy: 'Panel' };
const env: NodeJS.ProcessEnv = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// ── Kleinkram (E26) ────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let letzterFehler = '';
/** Wartet, bis f() einen wahren Wert liefert. Eine Ausnahme zählt als „noch nicht“ und wird gemerkt (E26). */
async function bis<T>(f: () => T | Promise<T>, maxMs: number, schrittMs = 200): Promise<T | null> {
  const ende = Date.now() + maxMs;
  for (;;) {
    try {
      const v = await f();
      if (v) return v;
    } catch (e) {
      letzterFehler = (e as Error).message;
    }
    if (Date.now() >= ende) return null;
    await sleep(schrittMs);
  }
}
/** Text für eine Detailzeile; eine Ausnahme wird zum Text statt zum Abbruch. */
async function sicher(f: () => Promise<string> | string): Promise<string> {
  try { return await f(); } catch (e) { return `Fehler: ${(e as Error).message}`; }
}
function portFrei(port: number): Promise<boolean> {
  return new Promise((r) => {
    const s = connect({ port, host: '127.0.0.1' });
    s.once('connect', () => { s.destroy(); r(false); });
    s.once('error', () => r(true));
  });
}
const warteAufPort = (port: number, maxMs: number) => bis(async () => !(await portFrei(port)), maxMs, 300);
const ergebnisse: { name: string; ok: boolean }[] = [];
/** Jede Prüfzeile mit Detail (E26): auch eine grüne Zeile sagt, was gemessen wurde. */
function pruefe(name: string, ok: boolean, detail: string): void {
  ergebnisse.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name} — ${detail || '(leer)'}`);
}
const kurz = (h: string): string => h.slice(0, 12);
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── Logs: nur was seit einer Marke dazukam ─────────────────────────────────────
function logMarke(app: Tool): number {
  return existsSync(LOG(app)) ? statSync(LOG(app)).size : 0;
}
function logAb(app: Tool, marke: number): string {
  if (!existsSync(LOG(app))) return '';
  const buf = readFileSync(LOG(app));
  return (buf.length >= marke ? buf.subarray(marke) : buf).toString('utf8');
}
const letzteZeilen = (t: string, n = 2): string => t.trim().split(/\r?\n/).slice(-n).join(' / ').slice(0, 240) || '(keine neue Zeile)';

// ── Test-Master: Test-Identität aus den Master-Link-Helfern, ein gekoppelter Rechner B ──
const identitaet = neueIdentitaet(MASTER_NAME);
const slavePaar = erzeugeSchluesselpaar();
const verbund = new SpeicherVerbund([
  { rechnerId: 'e2e-master', name: MASTER_NAME, schluessel: erzeugeSchluesselpaar().oeffentlich, gekoppeltAm: 1, zuletztGesehen: null, letzteAdresse: null, dieserRechner: true },
  { rechnerId: RECHNER_B.id, name: RECHNER_B.name, schluessel: slavePaar.oeffentlich, gekoppeltAm: 1, zuletztGesehen: null, letzteAdresse: null, dieserRechner: false },
]);
const masterLog: string[] = [];
const verteiler = new Verteiler({ log: (stufe, text) => masterLog.push(`${stufe}: ${text}`), rechnerName: (id) => verbund.finde(id)?.name ?? id });
let server: MasterLinkServer | null = null;
/** Start der Rolle Master: neuer Server, Verteiler mit neuer Epoche, verdrahtet wie MasterRolle (C9). */
async function starteMaster(): Promise<void> {
  const s = new MasterLinkServer({
    identitaet, verbund, eigeneRechnerId: 'e2e-master', suiteVersion: '0.15.0', lauschAdressen: ['127.0.0.1'], port: MASTER_PORT,
    log: (stufe, text) => masterLog.push(`${stufe}: ${text}`),
  });
  s.on('daten', (t: TeilnehmerDaten, abo: AboInhalt) => verteiler.aufAbo(t, abo));
  s.on('getrennt', (sitzung: number) => verteiler.aufGetrennt(sitzung));
  s.on('entstaut', (sitzung: number) => verteiler.aufEntstaut(sitzung));
  verteiler.starte(s);
  await s.starte();
  server = s;
}
async function stoppeMaster(): Promise<void> {
  const s = server;
  server = null;
  if (s) await s.stoppe();
  verteiler.stoppe();
}
/** master-link.json der Tools: Rechner B, gekoppelt mit dem Test-Master, feste Adresse 127.0.0.1 (19.7). */
function dateiB(rolle: 'slave' | 'aus'): MasterLinkDatei {
  return {
    version: 1, rolle, rechner: { ...RECHNER_B }, netzwerk: { karte: null },
    kopplung: {
      masterId: identitaet.masterId, masterName: MASTER_NAME, fingerprint: fingerprintVonPem(identitaet.zertifikat),
      zertifikat: identitaet.zertifikat, port: MASTER_PORT, adressen: ['127.0.0.1'], letzteAdresse: '127.0.0.1',
      festeAdresse: '127.0.0.1', schluessel: slavePaar,
    },
  };
}
function testShow(ablauf: string[], speaker: string[]): Show {
  return migrateShow({
    schemaVersion: 1,
    name: SHOW_NAME,
    updatedAt: new Date().toISOString(),
    tools: [],
    ablauf: ablauf.map((id) => ({ id, label: LABEL[id], durationMs: 600_000 })),
    iveo: { event: 'e2e-verbund', name: SHOW_NAME, syncedAt: new Date().toISOString(), speakers: speaker.map((name) => ({ name, title: FUNKTION[name] })), sideEvents: [] },
  });
}

// ── Prozesse ───────────────────────────────────────────────────────────────────
const kinder = new Map<Tool, ChildProcess>();
function starteTool(app: Tool): void {
  const p = spawn(ELECTRON, [`--remote-debugging-port=${CDP[app]}`, join(REPO, 'apps', app)], { env, stdio: 'ignore' });
  kinder.set(app, p);
}
async function beendeTool(app: Tool): Promise<void> {
  sitzungen[app]?.schliesse();
  sitzungen[app] = null;
  const p = kinder.get(app);
  kinder.delete(app);
  if (p && p.exitCode === null) {
    const weg = new Promise((r) => p.once('exit', r));
    p.kill();
    await Promise.race([weg, sleep(15_000)]);
  }
  await bis(() => portFrei(STEUER[app]), 15_000, 200);
  await bis(() => portFrei(CDP[app]), 15_000, 200);
}

// ── DevTools (E26: wertet result.exceptionDetails UND error aus) ──────────────
interface CdpAntwort {
  id: number;
  error?: { message: string };
  result?: { result?: { value?: unknown }; exceptionDetails?: { text?: string; exception?: { description?: string } } };
}
interface Sitzung { werte(ausdruck: string, ms?: number): Promise<unknown>; schliesse(): void }
const BRUECKE: Record<Tool, string> = { timer: 'window.jm', titler: 'window.jmtitler', rundown: 'window.jmrundown' };
const FENSTER: Record<Tool, (url: string) => boolean> = {
  timer: (url) => url.includes('view=operator'),
  // Bedienfenster = index.html ohne ?view= (Recall-Board und 2. Bildschirm tragen view=recall bzw. view=output).
  titler: (url) => url.includes('index.html') && !url.includes('view='),
  rundown: (url) => url.includes('index.html'),
};
const BEREIT: Record<Tool, string> = {
  timer: 'typeof window.jm?.verbundAnzeige === "function"',
  titler: 'typeof window.jmtitler?.verbundAnzeige === "function" && document.querySelector("canvas") !== null',
  rundown: 'typeof window.jmrundown?.verbundAnzeige === "function" && typeof window.jmrundown?.getState === "function"',
};
const sitzungen: Record<Tool, Sitzung | null> = { timer: null, titler: null, rundown: null };
async function verbindeDevTools(app: Tool): Promise<void> {
  const name = NAME[app];
  const ziel = await bis(async () => {
    const l = (await (await fetch(`http://127.0.0.1:${CDP[app]}/json/list`)).json()) as { type: string; url: string; webSocketDebuggerUrl: string }[];
    return l.find((t) => t.type === 'page' && FENSTER[app](t.url)) ?? null;
  }, 60_000, 300);
  if (!ziel) throw new Error(`${name}: Fenster per DevTools nicht erreichbar (${letzterFehler || 'keine passende Seite'})`);
  const ws = new WebSocket(ziel.webSocketDebuggerUrl);
  await new Promise<void>((ok, fehler) => {
    ws.addEventListener('open', () => ok(), { once: true });
    ws.addEventListener('error', () => fehler(new Error(`${name}: DevTools-Verbindung scheitert`)), { once: true });
  });
  let naechste = 1;
  const warten = new Map<number, (d: CdpAntwort) => void>();
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(String(m.data)) as CdpAntwort;
    const w = warten.get(d.id);
    if (w) { warten.delete(d.id); w(d); }
  });
  ws.addEventListener('close', () => {
    for (const [id, w] of warten) { warten.delete(id); w({ id, error: { message: 'DevTools-Verbindung geschlossen' } }); }
  });
  const werte = (ausdruck: string, ms = 15_000): Promise<unknown> => new Promise((ok, fehler) => {
    const id = naechste++;
    const t = setTimeout(() => { warten.delete(id); fehler(new Error(`${name}: DevTools-Frist für ${ausdruck.slice(0, 60)}`)); }, ms);
    warten.set(id, (d) => {
      clearTimeout(t);
      if (d.error) fehler(new Error(`${name}: DevTools ${d.error.message}`));
      else if (d.result?.exceptionDetails) {
        const x = d.result.exceptionDetails;
        fehler(new Error(`${name}: ${x.exception?.description ?? x.text ?? 'Fehler im Fenster'}`));
      } else ok(d.result?.result?.value);
    });
    try {
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: ausdruck, returnByValue: true, awaitPromise: true } }));
    } catch (e) {
      clearTimeout(t);
      warten.delete(id);
      fehler(e as Error);
    }
  });
  if (!(await bis(async () => (await werte(BEREIT[app])) === true, 30_000))) {
    throw new Error(`${name}: Preload-Brücke nicht bereit (${letzterFehler || BEREIT[app]})`);
  }
  sitzungen[app] = { werte, schliesse: () => { try { ws.close(); } catch { /* schon zu */ } } };
}
function werte(app: Tool, ausdruck: string): Promise<unknown> {
  const s = sitzungen[app];
  if (!s) return Promise.reject(new Error(`${NAME[app]}: keine DevTools-Sitzung`));
  return s.werte(ausdruck);
}

// ── Messpunkte ─────────────────────────────────────────────────────────────────
interface Anzeige { text: string; farbe: string }
/** V-Zeile des Tools aus dem Preload (16.5). */
async function anzeige(app: Tool): Promise<Anzeige | null> {
  return (await werte(app, `${BRUECKE[app]}.verbundAnzeige()`)) as Anzeige | null;
}
const anzeigeText = (app: Tool): Promise<string> => sicher(async () => { const a = await anzeige(app); return a ? `${a.farbe} · ${a.text}` : 'keine Anzeige'; });
const V4 = new RegExp(`^Show vom Master: ${esc(SHOW_NAME)} · Stand \\d{2}:\\d{2}$`);
const ZUSATZ_L = new RegExp(` · letzter Stand: ${esc(SHOW_NAME)} \\d{2}:\\d{2}$`);
const V13 = new RegExp(`^Daten vom früheren Master ${esc(MASTER_NAME)} \\(nicht mehr gekoppelt\\) · letzter Stand: ${esc(SHOW_NAME)} \\d{2}:\\d{2}$`);
const istV4 = (a: Anzeige | null): boolean => !!a && V4.test(a.text) && a.farbe === 'gruen';
/** V9 (gelb, „⟨M⟩ nicht verbunden“) oder V11 (rot, Text des Clients), jeweils mit Zusatz L. */
const istV9oderV11 = (a: Anzeige | null): boolean => !!a && ZUSATZ_L.test(a.text)
  && ((a.farbe === 'gelb' && a.text.startsWith(`${MASTER_NAME} nicht verbunden · letzter Stand: `)) || a.farbe === 'rot');

interface RundownBlick { doc?: { rows?: { id: string; label: string }[] }; hinweise?: { id: number | string; text: string }[] }
let rdLauf = 0;
/** Hinweise des Rundowns: kurze verschwinden nach 6 s, deshalb bei jedem Blick merken (Schlüssel Lauf + id). */
const gesehen = new Map<string, string>();
async function rdStand(): Promise<RundownBlick> {
  const st = ((await werte('rundown', 'window.jmrundown.getState()')) ?? {}) as RundownBlick;
  for (const h of st.hinweise ?? []) gesehen.set(`${rdLauf}:${h.id}`, h.text);
  return st;
}
const zeilenIds = (st: RundownBlick): string => (st.doc?.rows ?? []).map((r) => r.id).join(',');

async function bildHash(): Promise<string> {
  const daten = await werte('titler', "document.querySelector('canvas').toDataURL()");
  if (typeof daten !== 'string' || !daten.startsWith('data:image/png')) throw new Error('Titler: Vorschau-Canvas liefert kein Bild');
  return createHash('sha256').update(daten).digest('hex');
}
/** Vorlage Bauchbinde mit {{name}} und {{funktion}}: So zeigt das Vorschaubild den abgerufenen Speaker. */
function schreibeTitlerConfig(): void {
  mkdirSync(DEV('titler'), { recursive: true });
  writeFileSync(join(DEV('titler'), 'titler-config.json'), JSON.stringify({ template: 'lowerthird', name: '{{name}}', subtitle: '{{funktion}}' }, null, 2), 'utf8');
}

interface Steuer { sende(z: string): void; kv(): Record<string, string>; bereit(): boolean; trenne(): void }
const steuer: Steuer[] = [];
function steuerClient(port: number, sicherheit: ReturnType<typeof controlClientOptions>): Steuer {
  let kv: Record<string, string> | null = null;
  const c = new SuiteControlClient({
    ...sicherheit, reconnectMs: 500,
    onState: (st) => { kv = Object.fromEntries(Object.entries(st.kv).map(([k, v]) => [k, String(v)])); },
  });
  c.connect('127.0.0.1', port);
  const s: Steuer = { sende: (z) => c.send(z), kv: () => kv ?? {}, bereit: () => kv !== null, trenne: () => c.disconnect() };
  steuer.push(s);
  return s;
}
const titlerKurz = (kv: Record<string, string>): string => `entry „${kv.entry ?? ''}“ Eintrag ${kv.entry_index ?? '?'}/${kv.entry_count ?? '?'}, on_air=${kv.on_air ?? '?'}`;
interface TimerStand { timetable?: { items?: { id?: string; label: string }[]; activeIndex?: number | null } }
let timerStand: TimerStand | null = null;
let timerSocket: IoSocket | null = null;
const timerIds = (): string => (timerStand?.timetable?.items ?? []).map((i) => i.id ?? '-').join(',');

// ── Beiseitelegen / Aufräumen (Muster e2e-teil2a.mjs) ─────────────────────────
const gesichert: string[] = [];
const freigemacht: string[] = []; // Pfade, die der Lauf leer vorfand oder beiseitegelegt hat (nur die darf er am Ende löschen)
let beiseiteGelegt = false;
function legeBeiseite(): void {
  for (const p of SICHERN) {
    if (existsSync(p + VORHER)) {
      console.log(`ABBRUCH vor dem Start: ${p + VORHER} liegt noch da (voriger Lauf?) — erst von Hand zurückbenennen.`);
      process.exit(3);
    }
  }
  beiseiteGelegt = true; // vor der Schleife: scheitert renameSync mittendrin, stellt raeumeAuf die schon verschobenen zurück
  for (const p of SICHERN) {
    if (existsSync(p)) {
      renameSync(p, p + VORHER);
      gesichert.push(p);
    }
    freigemacht.push(p);
  }
}
let aufgeraeumt = false;
async function raeumeAuf(): Promise<void> {
  if (aufgeraeumt) return;
  aufgeraeumt = true;
  try { timerSocket?.close(); } catch { /* schon zu */ }
  for (const s of steuer) s.trenne();
  for (const app of TOOLS) await beendeTool(app).catch(() => {});
  await sleep(2_000); // Windows gibt Dateien erst nach dem Prozessende frei
  await stoppeMaster().catch(() => {});
  if (beiseiteGelegt) {
    for (const p of freigemacht) {
      rmSync(p, { recursive: true, force: true }); // was der Lauf angelegt hat
      if (gesichert.includes(p)) renameSync(p + VORHER, p);
    }
  }
  console.log('aufgeräumt: Prozesse beendet, Test-Master gestoppt, Dev-Daten wiederhergestellt.');
}
process.on('SIGINT', () => { void raeumeAuf().then(() => process.exit(130)); });

async function starteTools(): Promise<void> {
  rdLauf += 1;
  for (const app of TOOLS) starteTool(app);
  for (const app of TOOLS) {
    if (!(await warteAufPort(STEUER[app], 60_000))) throw new Error(`${NAME[app]}: Steuerport ${STEUER[app]} kommt nicht hoch`);
  }
  for (const app of TOOLS) await verbindeDevTools(app);
}
async function wartV4(nr: string): Promise<void> {
  for (const app of TOOLS) {
    const z = await bis(async () => { const a = await anzeige(app); return istV4(a) ? a : null; }, 60_000, 500);
    pruefe(`${nr} · ${NAME[app]}: V4 „Show vom Master: ${SHOW_NAME} · Stand hh:mm“, grün`, !!z, z ? z.text : await anzeigeText(app));
  }
}

// ── Ablauf ─────────────────────────────────────────────────────────────────────
const ABLAUF_1 = ['v-1', 'v-2', 'v-3'];
const ABLAUF_2 = ['v-1', 'v-2', 'v-3', 'v-4'];
const ALLE = ['Ada', 'Grace', 'Alan', 'Hedy'];
const OHNE_ALAN = ['Ada', 'Grace', 'Hedy'];

async function main(): Promise<void> {
  // Vorbedingungen: bis legeBeiseite() fasst das Skript nichts an.
  if (!ELECTRON) {
    console.log('ABBRUCH: ELECTRON_EXE ist nicht gesetzt — Pfad zu einer electron.exe (Electron 33) angeben.');
    process.exit(2);
  }
  if (!existsSync(ELECTRON)) {
    console.log(`ABBRUCH: ${ELECTRON} fehlt — ELECTRON_EXE auf eine vorhandene electron.exe (Electron 33) setzen.`);
    process.exit(2);
  }
  if (!APPDATA) {
    console.log('ABBRUCH: APPDATA ist nicht gesetzt.');
    process.exit(2);
  }
  for (const app of TOOLS) {
    if (!existsSync(join(REPO, 'apps', app, 'out', 'main', 'index.cjs'))) {
      console.log(`ABBRUCH: apps/${app} ist nicht gebaut — erst npm run build -w @jm/${app}.`);
      process.exit(2);
    }
  }
  for (const [name, port] of Object.entries(PORTS)) {
    if (!(await portFrei(port))) {
      console.log(`ABBRUCH: Port ${port} (${name}) belegt — läuft noch ein Launcher, Timer, Titler oder Rundown?`);
      process.exit(2);
    }
  }
  legeBeiseite();
  schreibeTitlerConfig();
  schreibeMasterLinkDatei(masterLinkPfad(APPDATA), dateiB('slave'));
  verteiler.meldeShow(SHOW_PFAD, testShow(ABLAUF_1, ALLE));
  await starteMaster();
  await starteTools();
  const sicherheit = controlClientOptions(readControlConfig(APPDATA));
  const titlerSt = steuerClient(STEUER.titler, sicherheit);
  const rundownSt = steuerClient(STEUER.rundown, sicherheit);
  const timerSt = steuerClient(STEUER.timer, sicherheit);
  timerSocket = io(`http://127.0.0.1:${PORTS.timerSocket}`, { transports: ['websocket'], reconnectionDelay: 500 });
  timerSocket.on('state', (s: TimerStand) => { timerStand = s; });
  await bis(() => titlerSt.bereit() && rundownSt.bereit() && timerSt.bereit(), 15_000);

  console.log('\n— 1 · Alle drei zeigen die Test-Show (STATE) und V4');
  await wartV4('1');
  pruefe('1 · Timer: Ablauf der Test-Show (Timer-Socket)', !!(await bis(() => timerIds() === ABLAUF_1.join(','), 15_000)), timerIds() || 'kein Timer-Zustand');
  pruefe('1 · Titler: STATE entry_count 4 (Speaker der Test-Show)', !!(await bis(() => titlerSt.kv().entry_count === '4', 15_000)), titlerKurz(titlerSt.kv()));
  const st1 = await bis(async () => { const st = await rdStand(); return zeilenIds(st) === ABLAUF_1.join(',') && rundownSt.kv().total === '3' ? st : null; }, 15_000);
  pruefe('1 · Rundown: STATE total 3 und die drei Punkte mit ihren Kennungen', !!st1, `total=${rundownSt.kv().total} · ${await sicher(async () => zeilenIds(await rdStand()))}`);
  const abos1 = verteiler.stand().abos;
  pruefe('1 · Master: drei Tools beziehen die Show', abos1.length === 3, abos1.map((x) => x.appId).join(', ') || 'keine Abos');

  console.log('\n— 2 · Änderung am Ablauf → angewendet in höchstens 2 s');
  const t0 = Date.now();
  verteiler.meldeShow(SHOW_PFAD, testShow(ABLAUF_2, ALLE));
  let tTimer = -1;
  let tRundown = -1;
  await bis(async () => {
    if (tTimer < 0 && timerIds() === ABLAUF_2.join(',')) tTimer = Date.now() - t0;
    if (tRundown < 0 && zeilenIds(await rdStand()) === ABLAUF_2.join(',')) tRundown = Date.now() - t0;
    return tTimer >= 0 && tRundown >= 0;
  }, 5_000, 50);
  pruefe('2 · Timer übernimmt den neuen Punkt v-4 in höchstens 2 s', tTimer >= 0 && tTimer <= 2_000, tTimer >= 0 ? `${tTimer} ms` : `nicht angekommen · ${timerIds()}`);
  pruefe('2 · Rundown übernimmt den neuen Punkt v-4 in höchstens 2 s', tRundown >= 0 && tRundown <= 2_000,
    tRundown >= 0 ? `${tRundown} ms` : `nicht angekommen · ${await sicher(async () => zeilenIds(await rdStand()))}`);

  console.log('\n— 3 · Bauchbinde auf Sendung (Bild A), Speakerliste ohne diese Person → entry bleibt und Bild gleich A');
  titlerSt.sende('TITLER CLEAR');
  await sleep(1_500);
  const bildLeer = await bildHash();
  titlerSt.sende('TITLER RECALL Alan');
  await bis(() => titlerSt.kv().entry === 'Alan', 5_000);
  titlerSt.sende('TITLER TAKE');
  await bis(() => titlerSt.kv().on_air === '1', 10_000);
  await sleep(1_500);
  const bildA = await bildHash();
  const kvA = { ...titlerSt.kv() };
  pruefe('3 · vorher: Alan auf Sendung', kvA.entry === 'Alan' && kvA.on_air === '1', titlerKurz(kvA));
  pruefe('3 · Gegenprobe: Bild A ist nicht das leere Bild', bildA !== bildLeer, `A ${kurz(bildA)} · leer ${kurz(bildLeer)}`);
  titlerSt.sende('TITLER RECALL Grace');
  await sleep(1_500);
  const bildGrace = await bildHash();
  pruefe('3 · Kontrolle: RECALL Grace → Bild ungleich A', bildGrace !== bildA, `${titlerKurz(titlerSt.kv())} · ${kurz(bildGrace)}`);
  titlerSt.sende('TITLER RECALL Alan');
  await sleep(1_500);
  const bildA2 = await bildHash();
  pruefe('3 · Kontrolle: RECALL Alan → Bild wieder gleich A', bildA2 === bildA, `${titlerKurz(titlerSt.kv())} · ${kurz(bildA2)}`);
  const mTitler3 = logMarke('titler');
  verteiler.meldeShow(SHOW_PFAD, testShow(ABLAUF_2, OHNE_ALAN));
  const drei = await bis(() => titlerSt.kv().entry_count === '3', 10_000);
  await sleep(1_500);
  const kv3 = { ...titlerSt.kv() };
  const bild3 = await bildHash();
  pruefe('3 · Liste ohne Alan angekommen (entry_count 3)', !!drei, titlerKurz(kv3));
  pruefe('3 · entry bleibt Alan, auf Sendung gehalten (entry_index 0)', kv3.entry === 'Alan' && kv3.on_air === '1' && kv3.entry_index === '0', titlerKurz(kv3));
  pruefe('3 · Bild gleich A', bild3 === bildA, `${kurz(bild3)} gegen A ${kurz(bildA)}`);
  const log3 = logAb('titler', mTitler3);
  pruefe('3 · Logzeile A2 im Titler-Log', log3.includes('DataLink: aktiver Eintrag „Alan“ nicht mehr in der Liste, auf Sendung gehalten.'), letzteZeilen(log3));
  titlerSt.sende('TITLER CLEAR');
  await sleep(2_000);

  console.log('\n— 4 · Server stoppen → Daten bleiben, V9 bzw. V11; neue Epoche, gleiche Show → V4, keine neuen Hinweise im Rundown');
  const epocheVorher = verteiler.stand().epoche;
  await stoppeMaster();
  for (const app of TOOLS) {
    const z = await bis(async () => { const a = await anzeige(app); return istV9oderV11(a) ? a : null; }, 30_000, 300);
    pruefe(`4 · ${NAME[app]}: V9 bzw. V11 mit „· letzter Stand: ${SHOW_NAME} hh:mm“`, !!z, z ? `${z.farbe} · ${z.text}` : await anzeigeText(app));
  }
  pruefe('4 · Daten bleiben: Timer v-1…v-4', timerIds() === ABLAUF_2.join(','), timerIds() || 'kein Timer-Zustand');
  pruefe('4 · Daten bleiben: Titler mit 3 Speakern', titlerSt.kv().entry_count === '3', titlerKurz(titlerSt.kv()));
  const zeilen4 = await sicher(async () => zeilenIds(await rdStand()));
  pruefe('4 · Daten bleiben: Rundown v-1…v-4', zeilen4 === ABLAUF_2.join(','), zeilen4);
  const hinweiseVorher = new Set(gesehen.keys());
  await starteMaster();
  const epocheNeu = verteiler.stand().epoche;
  pruefe('4 · Master mit neuer Epoche und gleicher Show', epocheNeu !== null && epocheNeu !== epocheVorher && verteiler.stand().showName === SHOW_NAME,
    `${epocheVorher ?? '-'} → ${epocheNeu ?? '-'} · ${verteiler.stand().showName ?? '-'}`);
  await wartV4('4');
  await bis(async () => { await rdStand(); return false; }, 3_000, 250); // drei Sekunden lang Hinweise sammeln
  const neueHinweise = [...gesehen.entries()].filter(([k]) => !hinweiseVorher.has(k)).map(([, t]) => t);
  pruefe('4 · Rundown: keine neuen Hinweise (gleiche Show, kein Kontextwechsel)', neueHinweise.length === 0, neueHinweise.join(' | ') || 'keine');

  console.log('\n— 5 · Tools neu starten, ohne Server → Daten aus dem Zwischenspeicher, V9 bzw. V11 mit Zusatz L');
  await stoppeMaster();
  for (const app of TOOLS) await beendeTool(app);
  for (const app of TOOLS) {
    const datei = join(DEV(app), 'verbund', 'master-stand.json');
    pruefe(`5 · ${NAME[app]}: Zwischenspeicher liegt da`, existsSync(datei), join('@jm', app, 'verbund', 'master-stand.json'));
  }
  timerStand = null;
  await starteTools();
  for (const app of TOOLS) {
    const z = await bis(async () => { const a = await anzeige(app); return istV9oderV11(a) ? a : null; }, 60_000, 500);
    pruefe(`5 · ${NAME[app]}: V9 bzw. V11 mit Zusatz L nach dem Neustart`, !!z, z ? `${z.farbe} · ${z.text}` : await anzeigeText(app));
  }
  pruefe('5 · Timer: Ablauf v-1…v-4 nach dem Neustart', !!(await bis(() => timerIds() === ABLAUF_2.join(','), 15_000)), timerIds() || 'kein Timer-Zustand');
  pruefe('5 · Titler: 3 Speaker nach dem Neustart', !!(await bis(() => titlerSt.kv().entry_count === '3', 15_000)), titlerKurz(titlerSt.kv()));
  const st5 = await bis(async () => zeilenIds(await rdStand()) === ABLAUF_2.join(','), 15_000);
  pruefe('5 · Rundown: v-1…v-4 nach dem Neustart', !!st5, await sicher(async () => zeilenIds(await rdStand())));

  console.log('\n— 6 · Gleichzeitiges RELOAD über den Steuerport → ignoriert, Logzeile');
  await starteMaster();
  await wartV4('6 · vorher');
  await bis(() => titlerSt.bereit() && rundownSt.bereit() && timerSt.bereit(), 15_000);
  const marken = { timer: logMarke('timer'), titler: logMarke('titler'), rundown: logMarke('rundown') };
  const vorher6 = { timer: timerIds(), titler: titlerSt.kv().entry_count, rundown: await sicher(async () => zeilenIds(await rdStand())) };
  timerSt.sende('TIMER RELOAD');
  titlerSt.sende('TITLER RELOAD');
  rundownSt.sende('RUNDOWN RELOAD');
  await sleep(3_000);
  const zeile6 = `Verbund: RELOAD ignoriert, die Show-Daten kommen vom Master „${MASTER_NAME}“.`;
  for (const app of TOOLS) {
    const t = logAb(app, marken[app]);
    pruefe(`6 · ${NAME[app]}: Logzeile „${zeile6}“`, t.includes(zeile6), letzteZeilen(t));
  }
  const nachher6 = { timer: timerIds(), titler: titlerSt.kv().entry_count, rundown: await sicher(async () => zeilenIds(await rdStand())) };
  pruefe('6 · Daten unverändert (Timer, Titler, Rundown)', JSON.stringify(nachher6) === JSON.stringify(vorher6), `${JSON.stringify(vorher6)} → ${JSON.stringify(nachher6)}`);

  console.log('\n— 7 · master-link.json auf Rolle „aus“ → V13 „Daten vom früheren Master …“, Daten bleiben');
  schreibeMasterLinkDatei(masterLinkPfad(APPDATA), dateiB('aus'));
  for (const app of TOOLS) {
    // Die Tools prüfen ihre master-link.json im 5-s-Takt: bis zu 10 s warten.
    const z = await bis(async () => { const a = await anzeige(app); return a && V13.test(a.text) && a.farbe === 'gelb' ? a : null; }, 10_000, 300);
    pruefe(`7 · ${NAME[app]}: V13 „Daten vom früheren Master ${MASTER_NAME} (nicht mehr gekoppelt) · letzter Stand: …“, gelb`, !!z,
      z ? z.text : await anzeigeText(app));
  }
  pruefe('7 · Daten bleiben: Timer v-1…v-4', timerIds() === ABLAUF_2.join(','), timerIds() || 'kein Timer-Zustand');
  pruefe('7 · Daten bleiben: Titler mit 3 Speakern', titlerSt.kv().entry_count === '3', titlerKurz(titlerSt.kv()));
  const zeilen7 = await sicher(async () => zeilenIds(await rdStand()));
  pruefe('7 · Daten bleiben: Rundown v-1…v-4', zeilen7 === ABLAUF_2.join(','), zeilen7);
}

let code = 1;
try {
  await main();
  const fehl = ergebnisse.filter((e) => !e.ok);
  console.log(`\n${ergebnisse.length - fehl.length}/${ergebnisse.length} Prüfungen ok.`);
  code = fehl.length === 0 ? 0 : 1;
} catch (e) {
  console.log(`ABBRUCH: ${(e as Error).message}`);
} finally {
  if (code !== 0 && masterLog.length) {
    console.log('Log des Test-Masters:');
    for (const z of masterLog) console.log(`  ${z}`);
  }
  await raeumeAuf();
}
process.exit(code);

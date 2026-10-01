// ─────────────────────────────────────────────────────────────────────────────
// Durchgang Master-Link Teil 2a mit den GEBAUTEN Programmen (Spec 9.8, Titler-Messung 6.4).
// NICHT in CI: startet Launcher, Timer, Titler und Rundown aus diesem Repo als echte
// Electron-Apps und dazu einen nachgebauten iveo-Server auf 127.0.0.1.
//
// Aufruf (Repo-Wurzel, nach `npm run build -w @jm/launcher -w @jm/timer -w @jm/rundown -w @jm/titler`):
//   ELECTRON_EXE=<Pfad zu electron.exe> node node_modules/tsx/dist/cli.mjs apps/rundown/test/e2e-teil2a.mjs
// tsx, weil das Skript Suite-Pakete als TypeScript-Quelle lädt (Steuer-Client, Show-Format, iveo-Umwandler).
//
// Vorher darf kein Launcher/Timer/Titler/Rundown laufen (Ports 7777, 8724, 8726, 8731, 8736, 8738, 9334 frei).
// Das Skript legt die Daten, die es verändert, VOR dem Lauf beiseite (umbenennen nach <name>.e2e-vorher) und
// stellt sie in jedem Ausgang wieder her (auch Abbruch und Strg+C):
//   %APPDATA%\@jm\rundown\regie, rundown.autosave.jmrundown, rundown.autosave.v1.jmrundown,
//   %APPDATA%\@jm\timer\state.json, %APPDATA%\@jm\titler\titler-config.json, %APPDATA%\@jm\titler\iveo-data,
//   %APPDATA%\JM Production Suite\master-link.json (der Dev-Launcher soll nicht als Master/Slave mitlaufen).
// Nebenwirkung: Der Dev-Launcher meldet sich als Empfänger für jmps://-Links an; der installierte Launcher
// holt sich das bei seinem nächsten Start zurück.
//
// Messpunkte (9.8): Gedächtnis-Datei regie/<schlüssel>.json · STATE des Rundowns auf 8731 · Timer-Socket 7777 ·
// Logzeilen der drei Programme. Den Rundown liest und bedient das Skript über seine Preload-Brücke
// window.jmrundown (Chrome-DevTools-Protokoll auf Port 9334) — derselbe Weg wie der Editor.
// Reihenfolge: 1–7b, dann 9 (Titler hängt an Show 1), zuletzt 8 (wechselt den Rundown auf Show 2).
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { controlClientOptions, readControlConfig } from '@jm/control-config';
import { agendaToAblauf, localTimeOfDayMs } from '@jm/iveo';
import { serializeShow } from '@jm/show';
import { SuiteControlClient } from '@jm/suite-control-protocol/client';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ELECTRON = process.env.ELECTRON_EXE ?? join(REPO, 'node_modules/electron/dist/electron.exe');
const APPDATA = process.env.APPDATA ?? '';
/** userData eines Dev-Starts: Electron nimmt den Paketnamen @jm/<app>. */
const DEV = (app) => join(APPDATA, '@jm', app);
const LOGS = Object.fromEntries(['launcher', 'timer', 'titler', 'rundown'].map((a) => [a, join(DEV(a), 'logs', 'main.log')]));
const TOKEN = 'e2e-teil2a-token';
const EVENT = 'e2e-teil2a';
const CDP_RUNDOWN = 9334;
const PORTS = { timerSocket: 7777, timer: 8724, titler: 8726, rundown: 8731, launcher: 8736, verbund: 8738, rundownDevTools: CDP_RUNDOWN };
const VORHER = '.e2e-vorher';
const SICHERN = [
  join(DEV('rundown'), 'regie'),
  join(DEV('rundown'), 'rundown.autosave.jmrundown'),
  join(DEV('rundown'), 'rundown.autosave.v1.jmrundown'),
  join(DEV('timer'), 'state.json'),
  join(DEV('titler'), 'titler-config.json'),
  join(DEV('titler'), 'iveo-data'),
  join(APPDATA, 'JM Production Suite', 'master-link.json'),
];
const env = { ...process.env, JMPS_IVEO_TOKEN: TOKEN, JMPS_IVEO_POLL_MS: '2000' };
delete env.ELECTRON_RUN_AS_NODE;

// ── Kleinkram ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function bis(f, maxMs, schrittMs = 200) {
  const ende = Date.now() + maxMs;
  while (Date.now() < ende) {
    const v = await f();
    if (v) return v;
    await sleep(schrittMs);
  }
  return f();
}
function portFrei(port) {
  return new Promise((r) => {
    const s = connect({ port, host: '127.0.0.1' });
    s.once('connect', () => { s.destroy(); r(false); });
    s.once('error', () => r(true));
  });
}
const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok: !!ok });
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${detail ? ` — ${detail}` : ''}`);
}
const ids = (st) => (st?.doc?.rows ?? []).map((r) => r.id);
const zeile = (st, id) => (st?.doc?.rows ?? []).find((r) => r.id === id);
const zeilenKurz = (st) =>
  (st?.doc?.rows ?? []).map((r) => `${r.id}${r.entfallen ? '(entfallen)' : ''}${r.quelle ? '' : '(eigen)'}:${r.label}:${r.actions.length}`).join(' | ');

// ── Logs: nur was seit einer Marke dazukam (Bytes; rotiert die Datei, zählt alles) ─
function logMarke(app) {
  return existsSync(LOGS[app]) ? statSync(LOGS[app]).size : 0;
}
function logAb(app, marke) {
  if (!existsSync(LOGS[app])) return '';
  const buf = readFileSync(LOGS[app]);
  return (buf.length >= marke ? buf.subarray(marke) : buf).toString('utf8');
}
function reloadZaehler(text) {
  const t = [...text.matchAll(/iveo: RELOAD → (\d+) Timer, (\d+) Titler, (\d+) Rundown benachrichtigt\./g)].at(-1);
  return t ? { timer: Number(t[1]), titler: Number(t[2]), rundown: Number(t[3]) } : null;
}

// ── Gedächtnis (Spec 4.7) ─────────────────────────────────────────────────────
function gedaechtnisPfad(showPfad) {
  const schluessel = createHash('sha256').update(resolve(showPfad).toLowerCase()).digest('hex').slice(0, 16);
  return join(DEV('rundown'), 'regie', `${schluessel}.json`);
}
function leseGedaechtnis(showPfad) {
  try {
    return JSON.parse(readFileSync(gedaechtnisPfad(showPfad), 'utf8'));
  } catch {
    return null;
  }
}

// ── Nachgebautes iveo (Endpunkte, die IveoClient nutzt) ───────────────────────
const START = Date.now() - 3_600_000;
const iveo = {
  event: { id: 'ev-e2e', slug: EVENT, name: 'E2E Teil 2a', starts_at: null, ends_at: null, timezone: 'Europe/Berlin' },
  programs: [
    { id: 'p-a', event_id: 'ev-e2e', type_slug: 'side-event', title: 'Side Event A', starts_at_local: '2026-10-01T10:00:00', duration_minutes: 60, updated_at: new Date(START).toISOString() },
    { id: 'p-b', event_id: 'ev-e2e', type_slug: 'side-event', title: 'Side Event B', starts_at_local: '2026-10-01T14:00:00', duration_minutes: 45, updated_at: new Date(START).toISOString() },
  ],
  agenda: {
    'p-a': [
      { id: 'a-1', program_id: 'p-a', sort_order: 1, title: 'Begrüßung', duration_minutes: 10 },
      { id: 'a-2', program_id: 'p-a', sort_order: 2, title: 'Panel', duration_minutes: 20 },
      { id: 'a-3', program_id: 'p-a', sort_order: 3, title: 'Abschluss', duration_minutes: 10 },
    ],
    'p-b': [
      { id: 'b-1', program_id: 'p-b', sort_order: 1, title: 'Keynote', duration_minutes: 30 },
      { id: 'b-2', program_id: 'p-b', sort_order: 2, title: 'Fragen', duration_minutes: 15 },
    ],
  },
  // Einwort-Namen: STATE trennt an Leerzeichen, so liest der Titler-Messpunkt den ganzen Namen.
  speakers: [
    { id: 's-1', event_id: 'ev-e2e', first_name: 'Ada', last_name: '', title: 'Moderation' },
    { id: 's-2', event_id: 'ev-e2e', first_name: 'Grace', last_name: '', title: 'Keynote' },
    { id: 's-3', event_id: 'ev-e2e', first_name: 'Alan', last_name: '', title: 'Panel' },
    { id: 's-4', event_id: 'ev-e2e', first_name: 'Hedy', last_name: '', title: 'Panel' },
  ],
};
let BASE = '';
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const sende = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const fehler = (status, code) => sende(status, { errors: [{ code, message: code }], meta: { request_id: 'e2e' } });
  const eins = (data) => sende(200, { data, meta: { request_id: 'e2e' } });
  const liste = (data) => sende(200, { data, meta: { request_id: 'e2e', pagination: { next_cursor: null, limit: 200 } } });
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return fehler(401, 'unauthorized');
  const teile = url.pathname.replace(/^\/api\/v1/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (teile[0] !== 'events' || teile[1] !== EVENT) return fehler(404, 'not_found');
  if (teile.length === 2) return eins(iveo.event);
  if (teile[2] === 'programs' && teile.length === 3) {
    const seit = url.searchParams.get('updated_since');
    return liste(seit ? iveo.programs.filter((p) => Date.parse(p.updated_at) > Date.parse(seit)) : iveo.programs);
  }
  if (teile[2] === 'programs' && teile.length === 4) {
    const p = iveo.programs.find((x) => x.id === teile[3]);
    return p ? eins(p) : fehler(404, 'not_found');
  }
  if (teile[2] === 'programs' && teile[4] === 'agenda-items') return liste(iveo.agenda[teile[3]] ?? []);
  if (teile[2] === 'speakers') return liste(iveo.speakers);
  if (teile[2] === 'organisations') return liste([]);
  if (teile[2] === 'stages') return eins([]);
  return fehler(404, 'not_found');
});

/** Ablauf eines Side Events, wie der Launcher-Kern ihn im Agenda-Modus baut (ohne verknüpfte Speaker). */
function agendaAblauf(programId) {
  const p = iveo.programs.find((x) => x.id === programId);
  return agendaToAblauf(iveo.agenda[programId], { firstStartMs: localTimeOfDayMs(p), category: p.type_slug });
}
function speakerListe() {
  return iveo.speakers.map((s) => ({ name: [s.first_name, s.last_name].filter(Boolean).join(' '), ...(s.title ? { title: s.title } : {}) }));
}
/** Show-Datei mit Bindung an den nachgebauten Server (tools leer: die Tools startet das Skript selbst). */
function schreibeShowDatei(pfad, { name, programId, mitKennung }) {
  const ablauf = agendaAblauf(programId).map((a) => {
    if (mitKennung) return a;
    const { id: _ohne, ...rest } = a;
    return rest;
  });
  const show = {
    schemaVersion: 1,
    name,
    tools: [],
    ablauf,
    iveo: {
      event: EVENT,
      baseUrl: BASE,
      name: iveo.event.name,
      syncedAt: new Date().toISOString(),
      speakers: speakerListe(),
      sideEvents: iveo.programs.map((p) => ({ id: p.id, title: p.title })),
      filter: { programId },
    },
  };
  writeFileSync(pfad, serializeShow(show, new Date().toISOString()), 'utf8');
}

// ── Prozesse ──────────────────────────────────────────────────────────────────
const kinder = [];
function starte(app, args = [], schalter = []) {
  const p = spawn(ELECTRON, [...schalter, join(REPO, 'apps', app), ...args], { env, stdio: 'ignore' });
  kinder.push(p);
  return p;
}
const warteAufPort = (port, maxMs) => bis(async () => !(await portFrei(port)), maxMs, 300);

// Rundown über DevTools: getState/setDoc/nav der Preload-Brücke.
let rundown = null;
let rdWs = null;
let rdNaechste = 1;
const rdWarten = new Map();
async function verbindeRundown() {
  const ziel = await bis(async () => {
    try {
      const l = await (await fetch(`http://127.0.0.1:${CDP_RUNDOWN}/json/list`)).json();
      return l.find((t) => t.type === 'page' && t.url.includes('index.html')) ?? null;
    } catch {
      return null;
    }
  }, 30_000, 300);
  if (!ziel) throw new Error('Rundown-Fenster per DevTools nicht erreichbar');
  rdWs = new WebSocket(ziel.webSocketDebuggerUrl);
  await new Promise((r, f) => { rdWs.addEventListener('open', r, { once: true }); rdWs.addEventListener('error', f, { once: true }); });
  rdWs.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    const w = rdWarten.get(d.id);
    if (w) { rdWarten.delete(d.id); w(d); }
  });
  if (!(await bis(async () => (await rd('typeof window.jmrundown?.getState === "function"')) === true, 15_000))) {
    throw new Error('window.jmrundown fehlt im Rundown-Fenster');
  }
}
function rd(ausdruck, ms = 15_000) {
  return new Promise((ok, fehler) => {
    const id = rdNaechste++;
    const t = setTimeout(() => { rdWarten.delete(id); fehler(new Error(`DevTools-Frist: ${ausdruck.slice(0, 60)}`)); }, ms);
    rdWarten.set(id, (d) => {
      clearTimeout(t);
      if (d.result?.exceptionDetails) fehler(new Error(d.result.exceptionDetails.exception?.description ?? 'Fehler im Rundown-Fenster'));
      else ok(d.result?.result?.value);
    });
    rdWs.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: ausdruck, returnByValue: true, awaitPromise: true } }));
  });
}
/**
 * Hinweise (4.6) sammeln: kurze verschwinden nach 6 s, deshalb bei jedem Blick merken.
 * Schlüssel = Rundown-Lauf + Hinweis-id (die id beginnt nach einem Neustart neu).
 */
let rdLauf = 0;
const gesehen = new Map();
const hinweisTexte = () => [...gesehen.values()];
async function mitHinweisen(p) {
  const st = await p;
  for (const h of st?.hinweise ?? []) gesehen.set(`${rdLauf}:${h.id}`, h.text);
  return st;
}
const rdStand = () => mitHinweisen(rd('window.jmrundown.getState()'));
const rdSetzeDoc = (doc, rev) => mitHinweisen(rd(`window.jmrundown.setDoc(${JSON.stringify(doc)}, ${rev})`));
const rdNav = (cmd) => mitHinweisen(rd(`window.jmrundown.nav(${JSON.stringify(cmd)})`));
async function starteRundown(args) {
  rdLauf += 1;
  rundown = starte('rundown', args, [`--remote-debugging-port=${CDP_RUNDOWN}`]);
  await verbindeRundown();
}
async function beendeRundown() {
  const p = rundown;
  rundown = null;
  try { rdWs?.close(); } catch { /* schon zu */ }
  rdWs = null;
  if (!p || p.exitCode !== null) return;
  const weg = new Promise((r) => p.once('exit', r));
  try {
    const v = await (await fetch(`http://127.0.0.1:${CDP_RUNDOWN}/json/version`)).json();
    const wb = new WebSocket(v.webSocketDebuggerUrl);
    await new Promise((r, f) => { wb.addEventListener('open', r, { once: true }); wb.addEventListener('error', f, { once: true }); });
    wb.send(JSON.stringify({ id: 1, method: 'Browser.close' })); // Fenster zu → window-all-closed → quit
  } catch { /* Endpunkt weg: die Frist entscheidet */ }
  if ((await Promise.race([weg.then(() => 'weg'), sleep(15_000).then(() => 'frist')])) === 'frist') {
    p.kill();
    await weg;
  }
  await bis(() => portFrei(PORTS.rundown), 10_000, 200);
}

async function wartRundown(bedingung, maxMs, name) {
  let letzter = null;
  const ok = await bis(async () => {
    letzter = await rdStand();
    return bedingung(letzter);
  }, maxMs, 200);
  if (!ok) console.log(`  (Frist abgelaufen: ${name}) Zeilen: ${zeilenKurz(letzter)}`);
  return letzter;
}

// Steuer-Clients (open- oder secure-Modus wie die Tools: control.json in %APPDATA%).
const sicherheit = controlClientOptions(readControlConfig(APPDATA));
const steuer = [];
function steuerClient(port) {
  let zustand = null;
  const c = new SuiteControlClient({ ...sicherheit, reconnectMs: 500, onState: (st) => { zustand = st; } });
  c.connect('127.0.0.1', port);
  steuer.push(c);
  return { sende: (z) => c.send(z), kv: () => zustand?.kv ?? {}, bereit: () => zustand !== null };
}
let timerStand = null;
let timerSocket = null;
const timerKurz = () => {
  const t = timerStand?.timetable;
  return t ? `aktiv ${t.activeIndex} (${t.items[t.activeIndex ?? -1]?.id ?? '-'}) in ${t.items.map((i) => i.id).join(',')}` : 'kein Timer-Zustand';
};

// ── Beiseitelegen / Aufräumen ─────────────────────────────────────────────────
const gesichert = [];
const freigemacht = []; // Pfade, die der Lauf leer vorfand oder erfolgreich beiseitegelegt hat (nur die darf er am Ende löschen)
let beiseiteGelegt = false;
let TMP = '';
function legeBeiseite() {
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
      gesichert.push(p); // erst nach gelungener Umbenennung
    }
    freigemacht.push(p);
  }
}
let aufgeraeumt = false;
async function raeumeAuf() {
  if (aufgeraeumt) return;
  aufgeraeumt = true;
  try { timerSocket?.close(); } catch { /* schon zu */ }
  for (const c of steuer) c.disconnect();
  await beendeRundown().catch(() => {});
  for (const p of kinder) {
    try { if (p.exitCode === null) p.kill(); } catch { /* schon beendet */ }
  }
  await sleep(2_000); // Windows gibt Dateien erst nach dem Prozessende frei
  server.closeAllConnections();
  server.close();
  if (beiseiteGelegt) {
    for (const p of freigemacht) {
      rmSync(p, { recursive: true, force: true }); // was der Lauf angelegt hat
      if (gesichert.includes(p)) renameSync(p + VORHER, p);
    }
    rmSync(join(DEV('launcher'), 'iveo-cache', `${EVENT}.json`), { force: true });
  }
  if (TMP) rmSync(TMP, { recursive: true, force: true });
  console.log('aufgeräumt: Prozesse beendet, Dev-Daten wiederhergestellt.');
  console.log('Hinweis: jmps:// zeigt bis zum nächsten Start des installierten Launchers auf den Dev-Launcher.');
}
process.on('SIGINT', () => { void raeumeAuf().then(() => process.exit(130)); });

// ── Ablauf ────────────────────────────────────────────────────────────────────
async function main() {
  for (const app of ['launcher', 'timer', 'titler', 'rundown']) {
    if (!existsSync(join(REPO, 'apps', app, 'out', 'main', 'index.cjs'))) {
      console.log(`ABBRUCH: apps/${app} ist nicht gebaut — erst npm run build -w @jm/${app}.`);
      process.exit(2);
    }
  }
  if (!existsSync(ELECTRON)) {
    console.log(`ABBRUCH: ${ELECTRON} fehlt — ELECTRON_EXE auf eine electron.exe (Version 33) setzen.`);
    process.exit(2);
  }
  for (const [name, port] of Object.entries(PORTS)) {
    if (!(await portFrei(port))) {
      console.log(`ABBRUCH: Port ${port} (${name}) belegt — läuft noch ein Launcher, Timer, Titler oder Rundown?`);
      process.exit(2);
    }
  }
  legeBeiseite();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  BASE = `http://127.0.0.1:${server.address().port}/api/v1`;
  TMP = mkdtempSync(join(tmpdir(), 'jm-e2e-2a-'));
  const SHOW1 = join(TMP, 'E2E Teil 2a.jmshow');
  const SHOW2 = join(TMP, 'E2E Bestand.jmshow');
  schreibeShowDatei(SHOW1, { name: 'E2E Teil 2a', programId: 'p-a', mitKennung: true });

  // Tools zuerst (mit Show 1), dann der Launcher.
  starte('timer', ['--show', SHOW1]);
  starte('titler', ['--show', SHOW1]);
  await starteRundown(['--show', SHOW1]);
  for (const port of [PORTS.timer, PORTS.titler, PORTS.rundown, PORTS.timerSocket]) {
    if (!(await warteAufPort(port, 60_000))) throw new Error(`Port ${port} kommt nicht hoch`);
  }
  const rundownSt = steuerClient(PORTS.rundown);
  const timerSt = steuerClient(PORTS.timer);
  const titlerSt = steuerClient(PORTS.titler);
  timerSocket = io(`http://127.0.0.1:${PORTS.timerSocket}`, { transports: ['websocket'], reconnectionDelay: 500 });
  timerSocket.on('state', (s) => { timerStand = s; });
  starte('launcher');
  if (!(await warteAufPort(PORTS.launcher, 60_000))) throw new Error('Launcher-Steuerport 8736 kommt nicht hoch');
  const launcherSt = steuerClient(PORTS.launcher);
  await bis(() => rundownSt.bereit() && timerSt.bereit() && titlerSt.bereit() && launcherSt.bereit(), 15_000);
  const mOeffnen = logMarke('launcher');
  starte('launcher', [`jmps://open?show=${encodeURIComponent(SHOW1)}`]); // zweite Instanz reicht den Deep-Link weiter
  pruefe('Launcher fragt die Show im 2-s-Takt ab', await bis(() => logAb('launcher', mOeffnen).includes(`Live-Polling für Event „${EVENT}" aktiv (alle 2s)`), 20_000));

  console.log('\n— 1 · Show öffnen');
  let st = await wartRundown((s) => ids(s).join(',') === 'a-1,a-2,a-3', 20_000, 'drei Agenda-Punkte');
  pruefe('1 · Rundown zeigt die drei Agenda-Punkte mit ihren iveo-Kennungen', ids(st).join(',') === 'a-1,a-2,a-3' && st.doc.rows.every((r) => r.quelle === 'ablauf'), zeilenKurz(st));
  pruefe('1 · Rundown hat die Show gemerkt (mit iveo)', st.showGemerkt === true && st.showMitIveo === true);
  const mtime0 = statSync(SHOW1).mtimeMs;
  await sleep(5_000); // mindestens zwei Abfragen
  pruefe('1 · Abfragen mit gleichem Stand schreiben nicht (kein Schein-RELOAD nach dem Öffnen)', statSync(SHOW1).mtimeMs === mtime0 && !logAb('launcher', mOeffnen).includes('RELOAD →'));

  console.log('\n— Fühler: erreicht das RELOAD des Launchers die Tools?');
  let erreicht = null;
  for (let i = 0; i < 10 && !erreicht; i++) {
    const m = logMarke('launcher');
    launcherSt.sende('LAUNCHER SIDEEVENT p-a'); // auf dasselbe Side Event: schreibt, schickt RELOAD, ändert nichts
    const z = await bis(() => reloadZaehler(logAb('launcher', m)), 8_000);
    if (z && z.timer >= 1 && z.rundown >= 1) erreicht = z;
    else await sleep(2_000);
  }
  pruefe('RELOAD erreicht Timer und Rundown (Logzeile 7.1)', !!erreicht, erreicht ? `${erreicht.timer} Timer, ${erreicht.titler} Titler, ${erreicht.rundown} Rundown` : 'der Launcher findet die Tools nicht (mDNS?)');
  if (!erreicht) throw new Error('ohne RELOAD-Weg ist der Rest des Durchgangs sinnlos');

  console.log('\n— 2 · Aktionen an Punkt 2, eigene Zeile hinter Punkt 1');
  st = await rdStand();
  const doc2 = structuredClone(st.doc);
  doc2.rows.find((r) => r.id === 'a-2').actions = [
    { id: 'e2e-recall', role: 'titler', verb: 'recall', args: ['1'], enabled: true },
    { id: 'e2e-goto', role: 'timer', verb: 'goto', args: [2], enabled: true, delayMs: 8_000, zielId: 'a-2' },
  ];
  doc2.rows.splice(1, 0, { id: 'e2e-eigen', label: 'Eigene Zeile (Einspieler)', actions: [] });
  st = await rdSetzeDoc(doc2, st.rev);
  pruefe('2 · Änderung angenommen', ids(st).join(',') === 'a-1,e2e-eigen,a-2,a-3' && zeile(st, 'a-2')?.actions.length === 2, zeilenKurz(st));
  st = await wartRundown((s) => s.links.some((l) => l.role === 'timer' && l.connected), 30_000, 'Rundown verbunden mit dem Timer');
  pruefe('2 · Rundown ist mit dem Timer verbunden', st.links.some((l) => l.role === 'timer' && l.connected),
    `Titler ${st.links.some((l) => l.role === 'titler' && l.connected) ? 'auch verbunden' : 'nicht verbunden (für 2–8 unnötig)'}`);

  console.log('\n— 3 · GO auf Punkt 2, dann Einschub davor und Umbenennung in iveo');
  st = await rdNav({ t: 'goto', n: 3 }); // sichtbare Zeilen: Punkt 1, eigene Zeile, Punkt 2, Punkt 3
  pruefe('3 · Punkt 2 ist scharf', st.scharfId === 'a-2', `scharf ${st.scharfId}`);
  const mLauncher3 = logMarke('launcher');
  st = await rdNav({ t: 'go' });
  const goZeit = Date.now();
  const [a1, a2, a3] = iveo.agenda['p-a'];
  iveo.agenda['p-a'] = [
    { ...a1, sort_order: 1 },
    { id: 'n-1', program_id: 'p-a', sort_order: 2, title: 'Einschub', duration_minutes: 5 },
    { ...a2, sort_order: 3 },
    { ...a3, sort_order: 4, title: 'Abschluss (neu)' },
  ];
  st = await wartRundown((s) => ids(s).join(',') === 'a-1,e2e-eigen,n-1,a-2,a-3', 10_000, 'Abgleich nach dem Einschub');
  const abgleichMs = Date.now() - goZeit;
  pruefe('3 · Abgleich kam, bevor das verzögerte TIMER GOTO fällig war', ids(st).join(',') === 'a-1,e2e-eigen,n-1,a-2,a-3' && abgleichMs < 8_000, `${abgleichMs} ms nach GO`);
  st = await wartRundown((s) => (s.lastFired?.sent ?? []).some((x) => x.role === 'timer'), 12_000, 'verzögertes TIMER GOTO');

  console.log('\n— 4 · Prüfen');
  const gesendet = (st.lastFired?.sent ?? []).find((x) => x.role === 'timer');
  pruefe('4 · TIMER GOTO ging mit der NEUEN Nummer raus', gesendet?.line === 'TIMER GOTO 3' && gesendet.delivered === true, gesendet ? `${gesendet.line} (zugestellt: ${gesendet.delivered})` : 'nicht gesendet');
  pruefe('4 · Timer steht auf Punkt 2 (Kennung a-2)', await bis(() => { const t = timerStand?.timetable; return !!t && t.activeIndex !== null && t.items[t.activeIndex]?.id === 'a-2'; }, 5_000), timerKurz());
  pruefe('4 · Rundown in iveo-Reihenfolge, eigene Zeile hinter Punkt 1', ids(st).join(',') === 'a-1,e2e-eigen,n-1,a-2,a-3', zeilenKurz(st));
  pruefe('4 · Aktionen an Punkt 2 erhalten', zeile(st, 'a-2')?.actions.map((a) => a.id).join(',') === 'e2e-recall,e2e-goto');
  pruefe('4 · Punkt 3 umbenannt, Kennung gleich', zeile(st, 'a-3')?.label === 'Abschluss (neu)');
  pruefe('4 · scharfe Zeile über die Kennung (nach dem GO Punkt 3)', st.scharfId === 'a-3', `scharf ${st.scharfId}`);
  pruefe('4 · STATE cue auf 8731 zeigt dieselbe Zeile', await bis(() => Number(rundownSt.kv().cue) === ids(st).indexOf('a-3') + 1, 3_000), `cue=${rundownSt.kv().cue}`);
  pruefe('4 · Hinweis zum Abgleich (4.6)', hinweisTexte().some((t) => t.startsWith('iveo: 1 geändert · 1 neu')), hinweisTexte().join(' | '));
  const z3 = reloadZaehler(logAb('launcher', mLauncher3));
  pruefe('4 · Launcher-Logzeile nennt den Rundown', !!z3 && z3.rundown >= 1, z3 ? `${z3.rundown} Rundown` : 'keine RELOAD-Zeile');
  const ged = leseGedaechtnis(SHOW1);
  pruefe('4 · Gedächtnis-Datei trägt Zeilen und scharfe Zeile', ged?.schemaVersion === 2 && ged?.scharfId === 'a-3' && (ged?.doc?.rows ?? []).map((r) => r.id).join(',') === ids(st).join(','), ged ? `scharf ${ged.scharfId}` : `fehlt: ${gedaechtnisPfad(SHOW1)}`);

  console.log('\n— 5 · Punkt mit Aktionen in iveo löschen');
  const mTimer5 = logMarke('timer');
  iveo.agenda['p-a'] = iveo.agenda['p-a'].filter((x) => x.id !== 'a-2');
  st = await wartRundown((s) => zeile(s, 'a-2')?.entfallen === true, 10_000, 'Punkt 2 entfallen');
  pruefe('5 · Punkt 2 bleibt markiert stehen, Aktionen erhalten', zeile(st, 'a-2')?.entfallen === true && zeile(st, 'a-2')?.actions.length === 2, zeilenKurz(st));
  pruefe('5 · Hinweis „1 entfallen“', hinweisTexte().some((t) => t.startsWith('iveo:') && t.includes('1 entfallen')), hinweisTexte().join(' | '));
  await rdNav({ t: 'goto', n: 3 }); // Einschub
  st = await rdNav({ t: 'next' });
  pruefe('5 · Weiter überspringt die entfallene Zeile', st.scharfId === 'a-3', `scharf ${st.scharfId}`);
  st = await rdNav({ t: 'prev' });
  pruefe('5 · Zurück überspringt sie ebenso', st.scharfId === 'n-1', `scharf ${st.scharfId}`);
  st = await rdNav({ t: 'goto', n: 4 });
  pruefe('5 · GOTO auf die entfallene Zeile → die nächste', st.scharfId === 'a-3', `scharf ${st.scharfId}`);
  pruefe('5 · Timer: aktiver Punkt weg → Nummer gehalten, Logzeile', await bis(() => logAb('timer', mTimer5).includes('Aktiver Punkt im neuen Ablauf nicht mehr vorhanden, Nummer gehalten'), 5_000));

  console.log('\n— 6 · Side Event wechseln und zurück');
  launcherSt.sende('LAUNCHER SIDEEVENT p-b');
  st = await wartRundown((s) => ids(s).join(',') === 'b-1,b-2', 15_000, 'Side Event B');
  pruefe('6 · Side Event B: neue Agenda ohne Aktionen', ids(st).join(',') === 'b-1,b-2' && st.doc.rows.every((r) => r.actions.length === 0), zeilenKurz(st));
  pruefe('6 · Hinweis „Side Event gewechselt: Side Event B“', hinweisTexte().includes('Side Event gewechselt: Side Event B'), hinweisTexte().join(' | '));
  pruefe('6 · scharf ist die erste Zeile', st.scharfId === 'b-1', `scharf ${st.scharfId}`);
  launcherSt.sende('LAUNCHER SIDEEVENT p-a');
  st = await wartRundown((s) => ids(s).includes('e2e-eigen'), 15_000, 'zurück auf Side Event A');
  pruefe('6 · zurück: Zeilen, eigene Zeile und Aktionen wieder da', ids(st).join(',') === 'a-1,e2e-eigen,n-1,a-2,a-3' && zeile(st, 'a-2')?.entfallen === true && zeile(st, 'a-2')?.actions.length === 2, zeilenKurz(st));
  pruefe('6 · scharf ist wieder die erste Zeile', st.scharfId === 'a-1', `scharf ${st.scharfId}`);

  console.log('\n— 7a · Rundown beenden und ohne Deep-Link starten (wie die Kachel)');
  timerSt.sende('TIMER START');
  await bis(() => typeof timerStand?.countdown?.startedAtMs === 'number', 5_000);
  const countdownVorher = JSON.stringify(timerStand?.countdown);
  const vor7a = await rdStand();
  await beendeRundown();
  const mRd = logMarke('rundown');
  await starteRundown([]);
  st = await wartRundown((s) => ids(s).join(',') === ids(vor7a).join(','), 20_000, 'Stand nach dem Neustart');
  pruefe('7a · Stand nach dem Neustart über die Kachel', JSON.stringify(st.doc.rows) === JSON.stringify(vor7a.doc.rows), zeilenKurz(st));
  pruefe('7a · scharfe Zeile nach dem Neustart', st.scharfId === vor7a.scharfId, `scharf ${st.scharfId}`);
  pruefe('7a · Show bleibt gemerkt', st.showGemerkt === true);
  // Fix-Runde 1: Ein RELOAD, das in die Lücke zwischen Neustart und Wiederverbindung des Launchers fällt, wird vom
  // Launcher bei der Verbindung nachgeholt (reload-nachholen.ts). Deshalb hier BEWUSST sofort ändern, ohne zu warten.
  iveo.agenda['p-a'] = iveo.agenda['p-a'].map((x) => (x.id === 'a-1' ? { ...x, title: 'Begrüßung (neu)' } : x));
  st = await wartRundown((s) => zeile(s, 'a-1')?.label === 'Begrüßung (neu)', 15_000, 'RELOAD nach dem Neustart');
  pruefe('7a · ein folgendes RELOAD gleicht ab', zeile(st, 'a-1')?.label === 'Begrüßung (neu)');
  pruefe('7a · keine Warnung „RELOAD ohne Show“ im Rundown-Log', !logAb('rundown', mRd).includes('RELOAD empfangen, aber keine Show geladen'));
  pruefe('7a · Timer-Countdown unverändert', JSON.stringify(timerStand?.countdown) === countdownVorher, `${countdownVorher} → ${JSON.stringify(timerStand?.countdown)}`);

  console.log('\n— 7b · Rundown beenden und per Show-Deep-Link starten');
  const vor7b = await rdStand();
  await beendeRundown();
  await starteRundown(['--show', SHOW1]);
  st = await wartRundown((s) => ids(s).join(',') === ids(vor7b).join(','), 20_000, 'Stand nach dem Start per Deep-Link');
  await sleep(1_000); // der Deep-Link gleicht nach dem Laden des Gedächtnisses noch ab
  st = await rdStand();
  pruefe('7b · Stand und scharfe Zeile nach dem Start per Deep-Link', JSON.stringify(st.doc.rows) === JSON.stringify(vor7b.doc.rows) && st.scharfId === vor7b.scharfId, `scharf ${st.scharfId}`);

  console.log('\n— 9 · Titler-Messung (6.4): Bauchbinde auf Sendung, dann ein Speaker davor');
  launcherSt.sende('LAUNCHER SIDEEVENT'); // Tagesübersicht: Listen-Modus, alle Event-Speaker
  await bis(() => launcherSt.kv().iveo_side_event === '', 15_000);
  const vier = await bis(() => Number(titlerSt.kv().entry_count) === 4, 15_000);
  titlerSt.sende('TITLER RECALL 3');
  await bis(() => titlerSt.kv().entry === 'Alan', 5_000);
  titlerSt.sende('TITLER TAKE');
  await bis(() => titlerSt.kv().on_air === '1', 10_000);
  const vorher9 = { ...titlerSt.kv() };
  iveo.speakers.unshift({ id: 's-0', event_id: 'ev-e2e', first_name: 'Neu', last_name: '', title: 'Gast' });
  iveo.programs = iveo.programs.map((p) => (p.id === 'p-a' ? { ...p, updated_at: new Date().toISOString() } : p));
  const fuenf = await bis(() => Number(titlerSt.kv().entry_count) === 5, 15_000);
  await sleep(1_000); // der Titler liest seinen Datenordner entprellt neu
  const nachher9 = { ...titlerSt.kv() };
  console.log(
    `MESSUNG 6.4: auf Sendung vorher „${vorher9.entry}“ (Eintrag ${vorher9.entry_index}/${vorher9.entry_count}, on_air=${vorher9.on_air}), ` +
      `nach dem Einfügen „${nachher9.entry}“ (Eintrag ${nachher9.entry_index}/${nachher9.entry_count}, on_air=${nachher9.on_air}) ` +
      `→ Name wechselt auf Sendung: ${vorher9.entry !== nachher9.entry ? 'JA' : 'nein'}`,
  );
  pruefe('9 · Messung durchgeführt (Bauchbinde auf Sendung, Speaker-Liste von 4 auf 5)', !!vier && !!fuenf && vorher9.on_air === '1');

  console.log('\n— 8 · Bestands-Show ohne Kennungen: Aktion anlegen, dann schreibt der Launcher die Kennungen');
  schreibeShowDatei(SHOW2, { name: 'E2E Bestand', programId: 'p-b', mitKennung: false });
  // Abweichung vom Brief (Ursache im Bericht): Im Dev-Start ordnet Electron das argv der zweiten Instanz um
  // (`--show`, `--allow-file-access-from-files`, <App>, <Pfad>); findDeepLink läse dann den Schalter als Pfad.
  // Die jmps://-URL steht im argv unverwechselbar und wird zuerst gefunden (wie beim Launcher oben).
  starte('rundown', [`jmps://open?show=${encodeURIComponent(SHOW2)}`]); // zweite Instanz reicht den Deep-Link an den laufenden Rundown
  st = await wartRundown((s) => ids(s).join(',') === 'ersatz:Keynote,ersatz:Fragen', 20_000, 'Bestands-Show im Rundown');
  pruefe('8 · Rundown bildet Ersatz-Kennungen', ids(st).join(',') === 'ersatz:Keynote,ersatz:Fragen', zeilenKurz(st));
  const doc8 = structuredClone(st.doc);
  doc8.rows.find((r) => r.id === 'ersatz:Fragen').actions = [{ id: 'e2e-fragen', role: 'titler', verb: 'recall', args: ['2'], enabled: true }];
  st = await rdSetzeDoc(doc8, st.rev);
  pruefe('8 · Aktion an „Fragen“ angelegt', zeile(st, 'ersatz:Fragen')?.actions.length === 1, zeilenKurz(st));
  const vor8 = new Set(gesehen.keys());
  starte('launcher', [`jmps://open?show=${encodeURIComponent(SHOW2)}`]);
  st = await wartRundown((s) => ids(s).join(',') === 'b-1,b-2', 20_000, 'Kennungen nachgeschrieben');
  pruefe('8 · der Launcher hat die Kennungen in die Show geschrieben', readFileSync(SHOW2, 'utf8').includes('"id": "b-2"'));
  pruefe('8 · Rundown wechselt über die Titel-Brücke (R0) auf die echten Kennungen', ids(st).join(',') === 'b-1,b-2', zeilenKurz(st));
  pruefe('8 · keine Zeile entfallen, Aktion an „Fragen“ erhalten', st.doc.rows.every((r) => !r.entfallen) && zeile(st, 'b-2')?.actions[0]?.id === 'e2e-fragen');
  const neu8 = [...gesehen].filter(([k]) => !vor8.has(k)).map(([, t]) => t);
  pruefe('8 · kein Hinweis „entfallen“', !neu8.some((t) => t.includes('entfallen')), neu8.join(' | ') || 'keine neuen Hinweise');
  pruefe('8 · Gedächtnis der Bestands-Show angelegt', leseGedaechtnis(SHOW2)?.showName === 'E2E Bestand');

  // ═══ Zusätzliche Messpunkte des Controllers (a)–(e); nicht Teil des Briefs ════════════════════════
  const dateiHash = (p) => (existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : null);

  console.log('\n— 10 · (e) Show mit Speakern öffnen: kein Schein-RELOAD (Signatur aus Datei == erste Abfrage)');
  {
    const zeigt = JSON.parse(readFileSync(SHOW2, 'utf8'));
    const m = logMarke('launcher');
    const mt = statSync(SHOW2).mtimeMs;
    await sleep(7_000); // mindestens drei Abfragen im 2-s-Takt
    const text = logAb('launcher', m);
    pruefe('10e · die Show hat Speaker', (zeigt.iveo?.speakers ?? []).length === iveo.speakers.length, `${zeigt.iveo?.speakers?.length} Speaker`);
    pruefe('10e · in 7 s Polling keine RELOAD-Zeile und keine Schreibung der Show', !text.includes('RELOAD →') && statSync(SHOW2).mtimeMs === mt,
      `RELOAD-Zeilen: ${(text.match(/RELOAD →/g) ?? []).length}`);
  }

  console.log('\n— 11 · (c) Editor: Ablaufzeilen nicht verschiebbar, eigene Zeile verschiebbar (Spec 4.5)');
  {
    st = await rdStand();
    const doc10 = structuredClone(st.doc);
    doc10.rows.push({ id: 'e2e-eigen2', label: 'Eigene Zeile hinten', actions: [] });
    st = await rdSetzeDoc(doc10, st.rev);
    pruefe('11c · eigene Zeile hinten angelegt', ids(st).join(',') === 'b-1,b-2,e2e-eigen2', zeilenKurz(st));
    const lesen = () => rd(`(() => [...document.querySelectorAll('div[draggable]')].map((d) => {
      const knopf = (z) => [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === z);
      return { label: d.querySelector('span.font-medium')?.textContent, draggable: d.getAttribute('draggable'),
        hoch: knopf('↑')?.disabled, runter: knopf('↓')?.disabled, loeschen: knopf('✕')?.disabled };
    }))()`);
    const dom = await bis(async () => { const d = await lesen(); return d.length === 3 ? d : null; }, 5_000);
    const kurz = (dom ?? []).map((d) => `${d.label}: drag=${d.draggable} ↑gesperrt=${d.hoch} ↓gesperrt=${d.runter} ✕gesperrt=${d.loeschen}`).join(' | ');
    pruefe('11c · Ablaufzeilen: nicht ziehbar, ↑ und ↓ gesperrt, Löschen gesperrt', !!dom && dom.slice(0, 2).every((d) => d.draggable === 'false' && d.hoch === true && d.runter === true && d.loeschen === true), kurz);
    pruefe('11c · eigene Zeile: ziehbar, ↑ ↓ ✕ frei', !!dom && dom[2].draggable === 'true' && dom[2].hoch === false && dom[2].runter === false && dom[2].loeschen === false);
    // Klick auf einen gesperrten Knopf ändert nichts; ↑ an der eigenen Zeile verschiebt sie.
    await rd(`(() => { const d = document.querySelectorAll('div[draggable]')[1]; [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === '↑').click(); })()`);
    st = await rdStand();
    pruefe('11c · Klick auf ↑ einer Ablaufzeile ändert nichts', ids(st).join(',') === 'b-1,b-2,e2e-eigen2', zeilenKurz(st));
    await rd(`(() => { const d = document.querySelectorAll('div[draggable]')[2]; [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === '↑').click(); })()`);
    st = await wartRundown((s) => ids(s).join(',') === 'b-1,e2e-eigen2,b-2', 5_000, 'eigene Zeile nach oben');
    pruefe('11c · ↑ an der eigenen Zeile verschiebt sie', ids(st).join(',') === 'b-1,e2e-eigen2,b-2', zeilenKurz(st));
  }

  console.log('\n— 12 · (d) Regieplan-Import, während ein RELOAD dazwischenkommt');
  {
    // Die native Dateiauswahl (dialog.showOpenDialog im Main) lässt sich nicht bedienen. Erster Versuch: die Brücke
    // im Renderer ersetzen, sodass sie eine kleine CSV erst auf Signal liefert — dann läuft der echte Weg
    // (Knopf „Regieplan…“ → parseRegieplan → setDoc mit dem rev aus dem Renderer-Stand).
    const stub = await rd(`(() => {
      window.__imp = { frei: null };
      window.confirm = () => true;
      try { window.jmrundown.importRegieplan = () => new Promise((r) => { window.__imp.frei = () => r({ name: 'e2e.csv', bytes: new TextEncoder().encode('Titel\\nImportA\\nImportB\\n') }); }); } catch (e) { return 'Fehler: ' + e.message; }
      return String(window.jmrundown.importRegieplan).includes('__imp') ? 'ok' : 'Brücke nicht überschreibbar (contextBridge)';
    })()`);
    if (stub === 'ok') {
      await rd(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Regieplan…')).click()`);
      await bis(() => rd('typeof window.__imp.frei === "function"'), 5_000);
      // Während der „Dateiauswahl“ kommt der Abgleich: eine Titeländerung in iveo → RELOAD → Rundown gleicht ab.
      iveo.agenda['p-b'] = iveo.agenda['p-b'].map((x) => (x.id === 'b-1' ? { ...x, title: 'Keynote (neu)' } : x));
      st = await wartRundown((s) => zeile(s, 'b-1')?.label === 'Keynote (neu)', 15_000, 'Abgleich während der Dateiauswahl');
      pruefe('12d · der Abgleich lief dazwischen', zeile(st, 'b-1')?.label === 'Keynote (neu)', zeilenKurz(st));
      const rowsVor = JSON.stringify(st.doc.rows);
      await rd('window.__imp.frei()');
      const meldung = await bis(() => rd(`(document.body.innerText.match(/Import abgewiesen[^\\n]*/) ?? [null])[0]`), 6_000, 100);
      pruefe('12d · Meldung „Import abgewiesen …“ statt Erfolg', !!meldung && !(await rd(`document.body.innerText.includes('Punkte angehängt') || document.body.innerText.includes('importiert')`)), String(meldung));
      st = await rdStand();
      pruefe('12d · die importierten Zeilen sind nicht im Dokument', JSON.stringify(st.doc.rows) === rowsVor && !st.doc.rows.some((r) => r.label.startsWith('Import')), zeilenKurz(st));
    } else {
      console.log(`  (12d: ${stub}) Der Knopf-Weg ist nicht stellbar. Ersatz: derselbe Main-Pfad über die Brücke — ein Stand, der vor dem Abgleich berechnet wurde, kommt nach dem Abgleich an.`);
      st = await rdStand();
      const revAlt = st.rev;
      const abwVor = st.abweisungen;
      const alt = structuredClone(st.doc);
      alt.rows.push({ id: 'e2e-import-sim', label: 'ImportA', actions: [] });
      iveo.agenda['p-b'] = iveo.agenda['p-b'].map((x) => (x.id === 'b-1' ? { ...x, title: 'Keynote (neu)' } : x));
      st = await wartRundown((s) => zeile(s, 'b-1')?.label === 'Keynote (neu)', 15_000, 'Abgleich vor dem Import');
      pruefe('12d (Ersatz) · der Abgleich lief dazwischen', zeile(st, 'b-1')?.label === 'Keynote (neu)', zeilenKurz(st));
      const rowsVor = JSON.stringify(st.doc.rows);
      st = await rdSetzeDoc(alt, revAlt);
      pruefe('12d (Ersatz) · die Änderung mit dem alten rev wird abgewiesen (Zähler steigt, Zeile fehlt)', st.abweisungen > abwVor && JSON.stringify(st.doc.rows) === rowsVor && !ids(st).includes('e2e-import-sim'), `abweisungen ${abwVor} → ${st.abweisungen}`);
      pruefe('12d (Ersatz) · stehender Hinweis „Gleichzeitig kam ein iveo-Abgleich …“', (st.hinweise ?? []).some((h) => h.art === 'stehend' && h.text.startsWith('Gleichzeitig kam ein iveo-Abgleich.')), (st.hinweise ?? []).map((h) => `${h.art}:${h.text}`).join(' | '));
    }
  }

  console.log('\n— 13 · (a) Show zuerst OHNE Ablauf, dann per RELOAD mit Ablauf → Zeile „andere Show“');
  {
    const SHOW3 = join(TMP, 'E2E Spaet.jmshow');
    const ohne = { schemaVersion: 1, name: 'E2E Spaet', tools: [] };
    writeFileSync(SHOW3, serializeShow(ohne, new Date().toISOString()), 'utf8');
    const vorRows = JSON.stringify((await rdStand()).doc.rows);
    const hashShow2Gedaechtnis = dateiHash(gedaechtnisPfad(SHOW2));
    starte('rundown', [`jmps://open?show=${encodeURIComponent(SHOW3)}`]);
    const zeiger = () => {
      try { return JSON.parse(readFileSync(join(DEV('rundown'), 'regie', 'zuletzt.json'), 'utf8')).showPfad === SHOW3; } catch { return false; }
    };
    await bis(zeiger, 15_000, 200);
    await sleep(1_000);
    st = await rdStand();
    pruefe('13a · Show ohne Ablauf wird gemerkt (Zeiger zuletzt.json)', zeiger());
    pruefe('13a · Show ohne Ablauf: das Dokument bleibt unangetastet (keine Beispiel- oder fremden Zeilen)', JSON.stringify(st.doc.rows) === vorRows, zeilenKurz(st));
    pruefe('13a · noch kein Gedächtnis der neuen Show', !existsSync(gedaechtnisPfad(SHOW3)), existsSync(gedaechtnisPfad(SHOW3)) ? 'Gedächtnis-Datei vorhanden' : 'keine Datei');
    pruefe('13a · das Gedächtnis der vorigen Show blieb unverändert', dateiHash(gedaechtnisPfad(SHOW2)) === hashShow2Gedaechtnis);
    // Die Show bekommt einen Ablauf (hier die aktuelle Agenda von Side Event A) und das RELOAD kommt.
    schreibeShowDatei(SHOW3, { name: 'E2E Spaet', programId: 'p-a', mitKennung: true });
    const erwartet = agendaAblauf('p-a').map((a) => a.id);
    rundownSt.sende('RUNDOWN RELOAD');
    st = await wartRundown((s) => ids(s).join(',') === erwartet.join(','), 15_000, 'Zeilen der neuen Show');
    pruefe('13a · nach RELOAD stehen genau die Ablaufzeilen der Show da (keine fremden, keine Beispielzeilen)', ids(st).join(',') === erwartet.join(',') && st.doc.rows.every((r) => r.quelle === 'ablauf'), zeilenKurz(st));
    const g3 = await bis(() => leseGedaechtnis(SHOW3), 5_000);
    pruefe('13a · jetzt entsteht das Gedächtnis der Show', g3?.showName === 'E2E Spaet' && (g3?.doc?.rows ?? []).map((r) => r.id).join(',') === erwartet.join(','), g3 ? `Zeilen ${(g3.doc.rows ?? []).map((r) => r.id).join(',')}` : 'fehlt');
    pruefe('13a · das Gedächtnis der vorigen Show blieb unverändert (nichts vermischt)', dateiHash(gedaechtnisPfad(SHOW2)) === hashShow2Gedaechtnis);
    pruefe('13a · keine eigene Zeile der vorigen Show gerutscht', !ids(st).includes('e2e-eigen2'));
  }

  console.log('\n— 14 · (b) Gedächtnis-Datei beim Start gesperrt');
  {
    await beendeRundown();
    const datei = gedaechtnisPfad(SHOW2);
    const vorHash = dateiHash(datei);
    const sperre = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `$f = [System.IO.File]::Open('${datei.replaceAll("'", "''")}', 'Open', 'Read', 'None'); Write-Output 'GESPERRT'; Start-Sleep -Seconds 40; $f.Close()`], { stdio: ['ignore', 'pipe', 'ignore'] });
    kinder.push(sperre);
    let ausgabe = '';
    sperre.stdout.on('data', (b) => { ausgabe += b.toString(); });
    const gesperrt = await bis(() => ausgabe.includes('GESPERRT'), 20_000, 100);
    pruefe('14b · Sperre auf der Gedächtnis-Datei gesetzt', !!gesperrt);
    if (gesperrt) {
      const blockiert = (() => { try { readFileSync(datei); return false; } catch (e) { return e.code; } })();
      pruefe('14b · die Datei ist für andere nicht lesbar (EBUSY/EPERM/EACCES)', !!blockiert, String(blockiert));
      await starteRundown(['--show', SHOW2]);
      const stehend = 'Gespeicherter Stand dieser Show ist gerade nicht lesbar und wird nicht überschrieben.';
      st = await wartRundown((s) => (s.hinweise ?? []).some((h) => h.text === stehend), 20_000, 'Hinweis Gedächtnis gesperrt');
      pruefe('14b · stehender Hinweis „Gespeicherter Stand dieser Show ist gerade nicht lesbar …“', (st.hinweise ?? []).some((h) => h.art === 'stehend' && h.text === stehend), (st.hinweise ?? []).map((h) => `${h.art}:${h.text}`).join(' | '));
      // Eine Änderung während der Sperre darf das Gedächtnis nicht überschreiben (auch nicht nach der Freigabe).
      const d14 = structuredClone(st.doc);
      d14.rows.push({ id: 'e2e-gesperrt', label: 'Während der Sperre', actions: [] });
      await rdSetzeDoc(d14, st.rev);
      await sleep(1_500);
      sperre.kill();
      await bis(() => { try { readFileSync(datei); return true; } catch { return false; } }, 15_000, 300);
      await sleep(1_000);
      pruefe('14b · die Gedächtnis-Datei ist nach der Freigabe byte-gleich wie vorher', dateiHash(datei) === vorHash && !readFileSync(datei, 'utf8').includes('e2e-gesperrt'));
    }
  }
}

let code = 1;
try {
  await main();
  const fehl = ergebnisse.filter((e) => !e.ok);
  console.log(`\n${ergebnisse.length - fehl.length}/${ergebnisse.length} Prüfungen ok.`);
  code = fehl.length === 0 ? 0 : 1;
} catch (e) {
  console.log(`ABBRUCH: ${e.message}`);
} finally {
  await raeumeAuf();
}
process.exit(code);

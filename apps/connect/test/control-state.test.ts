// STATE von JM Connect aus zwei Teilen (Zoom Stage 4b, Spec 11.3, 12.4; Gegenprobe 12.5 „Raum-Push
// ersetzt alles“). Teil 1 prüft die reinen Funktionen aus src/main/control-state.ts, Teil 2 die
// Verdrahtung in control-server.ts. Electron und der TCP-Steuerserver werden dort per Modul-Hook durch
// Attrappen ersetzt (wie in zoom-settings.test.ts). npm run selftest -w @jm/connect
import { registerHooks } from 'node:module';
import { formatSuiteState, parseSuiteState } from '@jm/suite-control-protocol';
import { CAPABILITIES } from '@jm/suite-control-protocol/capabilities';
import { aenderungsMelder, erzeugeStateSpeicher, leiteSteuerbefehl, mischeState, RAUM_START, type Kv } from '../src/main/control-state';
import { stateKvAus } from '../src/shared/zoom-text';
import type { ZoomKurz } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const zoomSchluessel = (kv: Kv): string[] => Object.keys(kv).filter((s) => s.startsWith('zoom_'));

// Raum-Teil, wie ihn App.tsx meldet (G12: erfundener Name mit Leerzeichen).
const RAUM: Kv = {
  room: 'R1', guests: 3, lobby: 2, onair: 2, active_label: 'Anna Maria Beispiel', standby: 'g7', standby_label: 'Ben', talkback: 0,
};
// Zoom-Teil, wie ihn die Zoom-Hülle aus kern.stateKv() meldet.
const ZOOM: Kv = {
  zoom_status: 'im_meeting', zoom_sources: 2, zoom_live: 1, zoom_privilege: 1, zoom_alarm: 0, zoom_cmd: 'f3', zoom_cmd_rejected: 1,
};

console.log('— Teil 1: mischeState und StateSpeicher (rein)');
{
  ck('mischeState: Raum- und Zoom-Teil nebeneinander', gleich(mischeState(RAUM, ZOOM), { ...RAUM, ...ZOOM }));
  ck('mischeState: leerer Zoom-Teil → nur der Raum-Teil', gleich(mischeState(RAUM, {}), RAUM));

  const gesendet: Kv[] = [];
  const sp = erzeugeStateSpeicher((kv) => gesendet.push(kv));
  ck('vor dem ersten Push: Startwerte des Raums, kein zoom_*', gleich(sp.aktuell(), RAUM_START) && zoomSchluessel(sp.aktuell()).length === 0);
  ck('RAUM_START = room leer, onair/lobby/guests/talkback 0', gleich(RAUM_START, { room: '', onair: 0, lobby: 0, guests: 0, talkback: 0 }));

  sp.zoom(ZOOM);
  sp.raum(RAUM);
  ck('Raum-Push lässt zoom_* stehen', gleich(sp.aktuell(), { ...RAUM, ...ZOOM }));

  sp.zoom({ ...ZOOM, zoom_status: 'abriss', zoom_alarm: 1 });
  ck('Zoom-Push lässt Raum-Werte stehen', sp.aktuell().room === 'R1' && sp.aktuell().active_label === 'Anna Maria Beispiel'
    && sp.aktuell().zoom_status === 'abriss' && sp.aktuell().zoom_alarm === 1);

  sp.zoom({ zoom_status: 'bereit', zoom_sources: 0 });
  ck('zweiter Zoom-Push ersetzt den ersten Zoom-Teil (zoom_cmd weg)',
    gleich(zoomSchluessel(sp.aktuell()), ['zoom_status', 'zoom_sources']) && sp.aktuell().zoom_status === 'bereit');

  sp.raum({ room: 'R2', onair: 0 });
  ck('zweiter Raum-Push ersetzt den ersten Raum-Teil (standby weg), Zoom bleibt',
    sp.aktuell().room === 'R2' && !('standby' in sp.aktuell()) && sp.aktuell().zoom_status === 'bereit');

  sp.zoom({});
  ck('leerer Zoom-Teil (macOS) → nur Raum', gleich(sp.aktuell(), { room: 'R2', onair: 0 }));

  ck('senden bekommt je Push den gemischten Stand', gesendet.length === 6 && gleich(gesendet[1], { ...RAUM, ...ZOOM })
    && gleich(gesendet[5], sp.aktuell()));

  const eingabe: Kv = { room: 'R3' };
  sp.raum(eingabe);
  eingabe.room = 'verändert';
  const stand = sp.aktuell();
  stand.room = 'auch verändert';
  ck('Eingaben und aktuell() sind Kopien', sp.aktuell().room === 'R3');

  const mitStart = erzeugeStateSpeicher(() => {}, { room: 'X' });
  ck('eigene Startwerte für den Raum-Teil', gleich(mitStart.aktuell(), { room: 'X' }));
}

console.log('— Teil 1b: Zoom-Teil nur bei Änderung melden (aenderungsMelder)');
{
  const gemeldet: Kv[] = [];
  const melde = aenderungsMelder((kv) => gemeldet.push(kv));
  melde({ ...ZOOM });
  ck('erster Aufruf meldet immer', gemeldet.length === 1 && gleich(gemeldet[0], ZOOM));
  melde({ ...ZOOM });
  ck('gleicher Inhalt (neues Objekt) → keine zweite Meldung', gemeldet.length === 1);
  melde({ ...ZOOM, zoom_cmd: 'ok', zoom_cmd_rejected: 0 });
  ck('ein Wert geändert (zoom_cmd) → Meldung', gemeldet.length === 2 && gemeldet[1].zoom_cmd === 'ok');
  melde(null);
  ck('null → leerer Teil {}', gemeldet.length === 3 && gleich(gemeldet[2], {}));
  melde(null);
  melde({});
  ck('… und kein zweites Mal', gemeldet.length === 3);
}

console.log('— Teil 1c: Zoom-Schlüssel = Variablen der Rolle connect, Namen mit Leerzeichen kommen ganz an');
{
  const kurz: ZoomKurz = {
    zustand: 'im_meeting', warten: null, erlaubnis: 'ja', quellen: 2, ohneBild: 0, sollOffen: 0,
    versuch: null, maengel: [], kopieLaeuft: false, befehl: { kennung: 'f3', abgelehnt: true },
  };
  const kv = stateKvAus(kurz);
  const variablen = CAPABILITIES.connect.variables.map((v) => v.id).filter((id) => id.startsWith('zoom_'));
  ck('stateKv() führt genau die sieben zoom_*-Variablen der Rolle connect',
    kv !== null && gleich(Object.keys(kv).sort(), [...variablen].sort()) && variablen.length === 7);
  ck('… zoom_cmd=f3, zoom_cmd_rejected=1', kv?.zoom_cmd === 'f3' && kv?.zoom_cmd_rejected === 1);

  const zeile = formatSuiteState({ ns: 'connect', kv: mischeState(RAUM, kv ? { ...kv } : {}) });
  const zurueck = parseSuiteState(zeile);
  ck('STATE-Zeile bleibt eine Zeile', zeile.indexOf('\n') === zeile.length - 1);
  ck('active_label „Anna Maria Beispiel“ kommt über die Leitung ganz an (17.2 Nr. 3)',
    zurueck?.ns === 'connect' && zurueck.kv.active_label === 'Anna Maria Beispiel' && zurueck.kv.zoom_status === 'im_meeting');
}

console.log('— Teil 1d: Weiche für Befehle des Steuerservers (Spec 11.2, Ergänzung 0.3)');
{
  const wege: string[] = [];
  const ziele = {
    zoom: (c: { verb: string; args: string[] }) => wege.push(`zoom ${c.verb} ${c.args.join(' ')}`.trim()),
    renderer: (c: { verb: string; args: string[] }) => wege.push(`renderer ${c.verb} ${c.args.join(' ')}`.trim()),
  };
  leiteSteuerbefehl({ verb: 'zoom_load', args: ['Anna', 'Maria'] }, ziele);
  ck('zoom_load geht nur an die Zoom-Hülle, mit allen Argumenten', gleich(wege, ['zoom zoom_load Anna Maria']));
  wege.length = 0;
  leiteSteuerbefehl({ verb: 'zoom_join', args: ['123'] }, ziele);
  ck('… auch ein unbekanntes zoom_* (nie an Renderer oder DO)', gleich(wege, ['zoom zoom_join 123']));
  wege.length = 0;
  leiteSteuerbefehl({ verb: 'go', args: [] }, ziele);
  leiteSteuerbefehl({ verb: 'onair', args: ['g7'] }, ziele);
  ck('go und onair gehen nur an den Renderer', gleich(wege, ['renderer go', 'renderer onair g7']));
}

console.log('— Teil 2: control-server.ts (Attrappen für Electron und den Steuerserver)');
{
  const g = globalThis as unknown as {
    __srv: { opts: null | { getState(): { ns: string; kv: Kv }; onCommand(c: { ns: string; verb: string; args: string[] }): void }; pushes: { ns: string; kv: Kv }[] };
  };
  g.__srv = { opts: null, pushes: [] };
  const ELECTRON = `export const app = { getPath: () => '.' };`;
  const SERVER = `
export class SuiteControlServer {
  constructor(opts) { globalThis.__srv.opts = opts; }
  start(port) { return Promise.resolve({ ok: true, port }); }
  stop() {}
  pushState(s) { globalThis.__srv.pushes.push(s); }
}`;
  registerHooks({
    resolve(spec, ctx, next) {
      if (spec === 'electron') return { url: 'mock:electron', shortCircuit: true };
      if (spec === '@jm/suite-control-protocol/server') return { url: 'mock:steuerserver', shortCircuit: true };
      return next(spec, ctx);
    },
    load(url, ctx, next) {
      if (url === 'mock:electron') return { format: 'module', source: ELECTRON, shortCircuit: true };
      if (url === 'mock:steuerserver') return { format: 'module', source: SERVER, shortCircuit: true };
      return next(url, ctx);
    },
  });
  const cs = await import('../src/main/control-server');

  // Vor dem Serverstart: beide Teile merken, noch nichts senden.
  cs.pushControlState(RAUM);
  cs.setZoomControlState(ZOOM);
  const befehle: string[] = [];
  const r = await cs.startControlServer({ onCommand: (c) => befehle.push(`${c.verb} ${c.args.join(' ')}`) });
  const opts = g.__srv.opts;
  ck('Start: Port 8737', r.ok === true && r.port === 8737);
  ck('Begrüßungs-STATE (getState) enthält Raum- und Zoom-Teil', opts !== null && gleich(opts.getState(), { ns: 'connect', kv: { ...RAUM, ...ZOOM } }));

  cs.pushControlState({ room: 'R2', onair: 0 });
  const nachRaum = g.__srv.pushes.at(-1);
  ck('Renderer-Push lässt zoom_* stehen (vorher ersetzte er alles)',
    nachRaum?.ns === 'connect' && nachRaum.kv.room === 'R2' && nachRaum.kv.zoom_status === 'im_meeting' && nachRaum.kv.zoom_cmd === 'f3');

  cs.setZoomControlState({ ...ZOOM, zoom_status: 'abriss' });
  const nachZoom = g.__srv.pushes.at(-1);
  ck('Zoom-Push lässt den Raum-Teil stehen', nachZoom?.kv.room === 'R2' && nachZoom.kv.zoom_status === 'abriss');

  cs.setZoomControlState({});
  ck('leerer Zoom-Teil → STATE ohne zoom_*', gleich(g.__srv.pushes.at(-1)?.kv, { room: 'R2', onair: 0 }) && gleich(opts?.getState().kv, { room: 'R2', onair: 0 }));
  ck('jeder Push nach dem Start geht hinaus (3)', g.__srv.pushes.length === 3);

  opts?.onCommand({ ns: 'timer', verb: 'start', args: [] });
  opts?.onCommand({ ns: 'connect', verb: 'zoom_load', args: ['Anna', 'Maria'] });
  ck('nur Befehle mit ns=connect erreichen Connect', gleich(befehle, ['zoom_load Anna Maria']));
  cs.stopControlServer();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

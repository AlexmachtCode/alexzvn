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
    zustand: 'im_meeting', warten: null, erlaubnis: 'ja', slotsLaufen: 2, slotsErsatz: 0, slotsOffen: 0, slotsAn: 2, slotsGestopptEntzug: 0,
    slotKurz: [], versuch: null, maengel: [], kopieLaeuft: false, befehl: { kennung: 'f3', abgelehnt: true },
  };
  const kv = stateKvAus(kurz);
  const variablen = CAPABILITIES.connect.variables.map((v) => v.id).filter((id) => id.startsWith('zoom_'));
  ck('stateKv() führt genau die zoom_*-Variablen der Rolle connect: 119 = 7 + 16 × 7 (Spec 8.2, 11.6)',
    kv !== null && gleich(Object.keys(kv).sort(), [...variablen].sort()) && variablen.length === 119);
  ck('… die sieben Namen von 0.3.0 bleiben wörtlich als Teilmenge (Modul 0.2.0, Spec 8.4, B-EP15)',
    kv !== null && ['zoom_status', 'zoom_sources', 'zoom_live', 'zoom_privilege', 'zoom_alarm', 'zoom_cmd', 'zoom_cmd_rejected']
      .every((s) => s in kv && variablen.includes(s)));
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

console.log('— B18: STATE je Slot (Spec 8.2, 10.4, 11.6), Raum- und Zoom-Teil mit 119 Schlüsseln');
{
  const { slotStateTeil, stateKvSlots, ZOOM_SLOT_STATE_TEILE } = await import('../src/shared/zoom-text');
  const { SLOT_NR_MAX } = await import('@jm/zoom-bridge/protocol');
  const { ZOOM_SLOT_MAX } = await import('@jm/suite-control-protocol/capabilities');
  type SlotKurz = import('../src/shared/types').ZoomKurz['slotKurz'];
  type SlotStateEingabe = import('../src/shared/zoom-text').SlotStateEingabe;
  // Schlüssel für Schlüssel, unabhängig von der Reihenfolge (die STATE-Zeile ordnet nicht).
  const nurSlots = (kv: Record<string, string | number>): Record<string, string | number> =>
    Object.fromEntries(Object.entries(kv).filter(([s]) => s.startsWith('zoom_slot')).sort(([a], [b]) => a.localeCompare(b)));
  const variablen = CAPABILITIES.connect.variables.map((v) => v.id).filter((id) => id.startsWith('zoom_slot'));

  ck('B18: ZOOM_SLOT_MAX (Capabilities) = SLOT_NR_MAX (Bridge) = 16', ZOOM_SLOT_MAX === SLOT_NR_MAX && SLOT_NR_MAX === 16);
  const leer = slotStateTeil([]);
  ck('B18: ohne Slots 112 Schlüssel, genau die Slot-Variablen der Rolle connect',
    gleich(Object.keys(leer).sort(), [...variablen].sort()) && variablen.length === 112);
  ck('B18: nicht angelegt = on/live/alarm/audio 0, mode und target leer, state „fehlt“ (8.2), für Slot 1 und 16',
    [1, 16].every((n) => gleich(ZOOM_SLOT_STATE_TEILE.map((t) => leer[`zoom_slot${n}_${t}`]), [0, 0, 0, 0, '', '', 'fehlt'])));
  const eLeer: SlotStateEingabe = {
    kurz: { zustand: 'im_meeting', erlaubnis: 'ja', befehl: null }, z: 'Z8',
    zahlen: { n: 0, k: 0, o: 0, e: 0, a: 0, gestopptEntzug: 0 }, slots: [],
  };
  ck('B18: Vorgaben nicht angelegter Slots gleich denen von stateKvSlots (B9)', gleich(nurSlots(leer), nurSlots(stateKvSlots(eLeer))));

  // Wie der Kern die Kurzform füllt (B12): die Werte je Slot aus stateKvSlots, dann über stateKvAus in den STATE.
  const e: SlotStateEingabe = {
    kurz: { zustand: 'im_meeting', erlaubnis: 'ja', befehl: null }, z: 'Z9',
    zahlen: { n: 1, k: 0, o: 1, e: 2, a: 3, gestopptEntzug: 0 },
    slots: [
      { nr: 2, an: true, zustand: 'zeigt', offen: false, tonEin: true, modus: 'teilnehmer', zielName: 'Anna Maria' },
      { nr: 5, an: true, zustand: 'gescheitert', offen: true, tonEin: false, modus: 'sprecher', zielName: null },
      { nr: 16, an: false, zustand: 'aus', offen: false, tonEin: true, modus: 'freigabe', zielName: null },
    ],
  };
  const soll = nurSlots(stateKvSlots(e));
  const slotKurz: SlotKurz = e.slots.map((s) => ({
    nr: s.nr, an: soll[`zoom_slot${s.nr}_on`] === 1, live: soll[`zoom_slot${s.nr}_live`] === 1,
    alarm: soll[`zoom_slot${s.nr}_alarm`] === 1, tonEin: soll[`zoom_slot${s.nr}_audio`] === 1, modus: s.modus,
    ziel: String(soll[`zoom_slot${s.nr}_target`]), zustandWort: String(soll[`zoom_slot${s.nr}_state`]),
  }));
  const teil = slotStateTeil(slotKurz);
  ck('B18: slotKurz → STATE Schlüssel für Schlüssel gleich stateKvSlots (Slots 2, 5, 16 angelegt, übrige fehlen)', gleich(nurSlots(teil), soll));
  ck('B18: Slot 2 zeigt Anna Maria (on 1, live 1, audio 1, mode teilnehmer, target Anna Maria, state zeigt)',
    gleich(ZOOM_SLOT_STATE_TEILE.map((t) => teil[`zoom_slot2_${t}`]), [1, 1, 0, 1, 'teilnehmer', 'Anna Maria', 'zeigt']));
  ck('B18: Slot 16 aus, Ton eingeschaltet (Computerton eingerechnet): on 0, audio 1, mode freigabe',
    teil.zoom_slot16_on === 0 && teil.zoom_slot16_audio === 1 && teil.zoom_slot16_mode === 'freigabe');
  ck('B18: ein Name steht nur in _target (B.4)',
    gleich(Object.entries(teil).filter(([, w]) => String(w).includes('Anna')).map(([s]) => s), ['zoom_slot2_target']));
  const ohneLive = slotStateTeil([{ nr: 3, an: true, live: false, alarm: false, tonEin: false, modus: 'teilnehmer', ziel: 'Ben', zustandWort: 'wartet' }]);
  ck('B18: _target leer, solange _live 0 ist (10.4), auch wenn die Kurzform ein Ziel trägt',
    ohneLive.zoom_slot3_target === '' && ohneLive.zoom_slot3_live === 0 && ohneLive.zoom_slot3_state === 'wartet');

  const zoom119: Kv = { ...ZOOM, ...teil };
  ck('B18: Zoom-Teil mit den sieben und 112 Schlüsseln = 119', zoomSchluessel(zoom119).length === 119);
  const sp = erzeugeStateSpeicher(() => {});
  sp.zoom(zoom119);
  sp.raum(RAUM);
  ck('B18: Raum-Push lässt alle 119 zoom_*-Werte stehen (11.6)', gleich(sp.aktuell(), { ...RAUM, ...zoom119 }));
  sp.zoom({ ...zoom119, zoom_slot2_live: 0, zoom_slot2_target: '' });
  ck('B18: Zoom-Push lässt den Raum-Teil stehen (11.6)', sp.aktuell().active_label === 'Anna Maria Beispiel'
    && sp.aktuell().room === 'R1' && sp.aktuell().zoom_slot2_live === 0 && zoomSchluessel(sp.aktuell()).length === 119);
  const zurueck = parseSuiteState(formatSuiteState({ ns: 'connect', kv: { ...RAUM, ...zoom119 } }));
  ck('B18: zoom_slot2_target „Anna Maria“ kommt über die Leitung ganz an, STATE bleibt eine Zeile',
    zurueck?.kv.zoom_slot2_target === 'Anna Maria' && Object.keys(zurueck.kv).filter((s) => s.startsWith('zoom_')).length === 119);
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

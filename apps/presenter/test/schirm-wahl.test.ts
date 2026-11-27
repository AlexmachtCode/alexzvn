// Altfehler Stufe 2, PS-18: Companion „Schwarz“ und „Weiß“ mit der Wahl an, aus oder umschalten. Reine Regel schirmBefehl
// (src/main/schirm-wahl.ts) als Tabelle, dazu mit dem echten present.ts und einer Fenster-Attrappe (Muster wiedergabe.test.ts).
// Fehlt die Wahl oder ist sie unbekannt, schaltet es um wie bisher (P2). npm run selftest -w @jm/presenter
import { registerHooks } from 'node:module';
import type { PresentationPayload, ScreenMode, Slide } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// present.ts importiert './windows' (Electron) → Attrappe ohne Wirkung.
const WINDOWS = `
export const broadcastAll = () => {};
export const closePresentationWindows = () => {};
export const openAudienceWindow = () => {};
export const openPresenterWindow = () => {};
export const setPresentationClosedHandler = () => {};`;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === './windows') return { url: 'mock:windows', shortCircuit: true };
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url === 'mock:windows') return { format: 'module', source: WINDOWS, shortCircuit: true };
    return next(url, ctx);
  },
});

type Befehl = (aktuell: ScreenMode, ziel: 'black' | 'white', wahl: string | undefined) => ScreenMode | null;
let schirmBefehl: Befehl | null = null;
try {
  ({ schirmBefehl } = (await import('../src/main/schirm-wahl')) as { schirmBefehl: Befehl });
} catch (e) {
  console.log(`FAIL  PS-18: src/main/schirm-wahl.ts lässt sich nicht laden (${e instanceof Error ? e.message.split('\n')[0] : String(e)})`);
  fail++;
}
const p = await import('../src/main/present');

// ── PS-18 Tabelle schirmBefehl (aktuell, wahl → Ergebnis; null = nichts tun) ──
const tabelle = (z: 'black' | 'white'): Array<[ScreenMode, string | undefined, ScreenMode | null]> => {
  const a: ScreenMode = z === 'black' ? 'white' : 'black';
  return [
    ['live', undefined, z],
    [z, undefined, z], // setScreen schaltet bei gleichem Ziel zurück auf die Folie, wie heute
    ['live', 'ON', z],
    [z, 'on', null],
    [a, 'ON', z],
    [z, 'OFF', 'live'],
    ['live', 'off', null],
    [a, 'OFF', null],
    [z, 'TOGGLE', z],
    ['live', 'UNDEFINED', z],
    // Interfaces: 1/true wie ON, 0/false wie OFF, Groß/Klein egal
    ['live', '1', z],
    [z, 'True', null],
    [z, '0', 'live'],
    ['live', 'FALSE', null],
    ['live', '', z],
  ];
};
for (const z of ['black', 'white'] as const) {
  for (const [aktuell, wahl, erwartet] of tabelle(z)) {
    const ist = schirmBefehl === null ? 'fehlt' : schirmBefehl(aktuell, z, wahl);
    ck(`PS-18 Tabelle ${z}: ${aktuell}, ${wahl === undefined ? '—' : JSON.stringify(wahl)} → ${String(erwartet)} (ist ${String(ist)})`, ist === erwartet);
  }
}

// ── PS-18 mit dem echten present.ts: der Steuerserver-Weg (schirmBefehl, dann setScreen) ──
const folie = (id: string): Slide => ({ id, sourceId: 's', pageIndex: 0, title: id, notes: '', hidden: false, overlays: [] });
const payload: PresentationPayload = {
  slides: [folie('a'), folie('b')], sources: {}, images: {}, startIndex: 0,
  wiedergabe: { uebergang: { art: 'schnitt', dauerMs: 100 }, schleife: false, standzeitSek: 10 },
};
/** Wie control-server.ts `case 'black'`/`case 'white'`: nur setScreen, wenn schirmBefehl etwas liefert. */
const druecke = (ziel: 'black' | 'white', wahl?: string): void => {
  if (schirmBefehl === null) return;
  const m = schirmBefehl(p.getState().screen, ziel, wahl);
  if (m) p.setScreen(m);
};
p.startPresentation(payload, null);
ck('PS-18 echtes present.ts: Präsentation läuft auf der Folie', p.getState().active === true && p.getState().screen === 'live');
druecke('black', 'ON');
druecke('black', 'ON');
ck(`PS-18 echtes present.ts: zweimal BLACK ON → black (ist ${p.getState().screen})`, p.getState().screen === 'black');
druecke('black', 'OFF');
ck(`PS-18 echtes present.ts: BLACK OFF → live (ist ${p.getState().screen})`, p.getState().screen === 'live');
druecke('black', 'OFF');
ck(`PS-18 echtes present.ts: noch ein BLACK OFF bleibt live (ist ${p.getState().screen})`, p.getState().screen === 'live');
druecke('black');
druecke('black');
ck(`PS-18 echtes present.ts: ohne Wahl zweimal → live (Umschalten wie bisher, ist ${p.getState().screen})`, p.getState().screen === 'live');
druecke('white', 'ON');
druecke('black', 'ON');
ck(`PS-18 echtes present.ts: Weiß an, dann BLACK ON → black (ist ${p.getState().screen})`, p.getState().screen === 'black');
druecke('white', 'OFF');
ck(`PS-18 echtes present.ts: WHITE OFF bei Schwarzbild tut nichts (ist ${p.getState().screen})`, p.getState().screen === 'black');
druecke('white', 'TOGGLE');
druecke('white', 'TOGGLE');
ck(`PS-18 echtes present.ts: WHITE TOGGLE zweimal → live (ist ${p.getState().screen})`, p.getState().screen === 'live');
p.stopPresentation();
druecke('black', 'ON');
ck('PS-18 echtes present.ts: ohne Präsentation wirkt BLACK ON nicht', p.getState().active === false && p.getState().screen === 'live');

console.log(`\nschirm-wahl: ${pass} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

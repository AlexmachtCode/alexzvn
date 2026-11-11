// #293: Übergänge (global + pro Folie) und Schleife. Reine Regeln aus shared/wiedergabe und die
// Schleife im Hauptprozess (present.ts) mit Attrappe statt der Fenster. npm run selftest -w @jm/presenter
import { registerHooks } from 'node:module';
import type { PresentationPayload, PresentationState, Slide } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

// present.ts importiert './windows' (Electron) → Attrappe, die nur die Sendungen mitschreibt.
const g = globalThis as unknown as { __gesendet: PresentationState[] };
g.__gesendet = [];
const WINDOWS = `
export const broadcastAll = (ch, s) => { if (ch === 'present:state') globalThis.__gesendet.push(s); };
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

const w = await import('../src/shared/wiedergabe');
const p = await import('../src/main/present');

const folie = (id: string, extra: Partial<Slide> = {}): Slide =>
  ({ id, sourceId: 's', pageIndex: 0, title: id, notes: '', hidden: false, overlays: [], ...extra });

// --- Regeln
const V = w.WIEDERGABE_VORGABE;
ck('Vorgabe: Schnitt, keine Schleife', V.uebergang.art === 'schnitt' && V.schleife === false);
ck('alte Projekte (ohne Feld) → Vorgabe', JSON.stringify(w.normiereWiedergabe(undefined)) === JSON.stringify(V));
const n = w.normiereWiedergabe({ uebergang: { art: 'blende', dauerMs: 99999 }, schleife: true, standzeitSek: 0 });
ck('Dauer auf 5 s begrenzt, Standzeit mindestens 1 s', n.uebergang.dauerMs === 5000 && n.standzeitSek === 1 && n.schleife);
ck('unbekannte Übergangsart → Schnitt', w.normiereWiedergabe({ uebergang: { art: 'wisch', dauerMs: 500 } }).uebergang.art === 'schnitt');

const glob = { uebergang: { art: 'blende' as const, dauerMs: 800 }, schleife: true, standzeitSek: 10 };
ck('Folie ohne eigenen Übergang → global', w.uebergangFuer(folie('a'), glob).dauerMs === 800);
ck('Folie mit eigenem Übergang → ihrer', w.uebergangFuer(folie('a', { uebergang: { art: 'schnitt', dauerMs: 500 } }), glob).art === 'schnitt');
ck('Folie ohne eigene Standzeit → global', w.standzeitFuer(folie('a'), glob) === 10);
ck('Folie mit eigener Standzeit → ihre', w.standzeitFuer(folie('a', { standzeitSek: 25 }), glob) === 25);

// Werte einzelner Folien kommen ungeprüft aus der Projektdatei (Security-Review): nie Dauerfeuer.
ck('kaputte Standzeit 0 → mindestens 1 s', w.standzeitFuer(folie('a', { standzeitSek: 0 }), glob) === 1);
ck('Standzeit als Text → global', w.standzeitFuer(folie('a', { standzeitSek: 'abc' as unknown as number }), glob) === 10);
ck('riesige Standzeit → höchstens 1 h', w.standzeitFuer(folie('a', { standzeitSek: 1e12 }), glob) === 3600);
ck('kaputter Übergang je Folie → geprüft', JSON.stringify(w.uebergangFuer(folie('a', { uebergang: { art: 'x', dauerMs: -5 } as never }), glob)) === JSON.stringify({ art: 'schnitt', dauerMs: 100 }));

ck('weiter: mitten drin +1', w.naechsterIndex(1, 3, false) === 2);
ck('weiter: letzte Folie ohne Schleife bleibt', w.naechsterIndex(2, 3, false) === 2);
ck('weiter: letzte Folie mit Schleife → erste', w.naechsterIndex(2, 3, true) === 0);

// --- Schleife im Hauptprozess (Standzeit 1 s; echte Timer)
const payload = (schleife: boolean, slides: Slide[]): PresentationPayload => ({
  slides, sources: {}, images: {}, startIndex: 0,
  wiedergabe: { uebergang: { art: 'blende', dauerMs: 500 }, schleife, standzeitSek: 1 },
});
const zuletzt = (): PresentationState => g.__gesendet[g.__gesendet.length - 1];

p.startPresentation(payload(true, [folie('a'), folie('b', { standzeitSek: 2 })]), null);
ck('Start: Schleife an, Countdown gesetzt', zuletzt().schleife === true && typeof zuletzt().schleifeBisMs === 'number');
await warte(1150);
ck('nach 1 s Standzeit: Folie 2', p.getState().index === 1);
await warte(1150);
ck('Folie 2 hat eigene 2 s: noch nicht weiter', p.getState().index === 1);
await warte(1000);
ck('nach letzter Folie: zurück auf die erste', p.getState().index === 0);

p.setScreen('black');
ck('Schwarzbild: kein Countdown', zuletzt().schleifeBisMs == null);
await warte(1150);
ck('Schwarzbild hält die Schleife an', p.getState().index === 0 && p.getState().screen === 'black');
p.setScreen('black'); // zurück auf live
await warte(1150);
ck('wieder live: Schleife läuft weiter', p.getState().index === 1);

p.goto(0);
await warte(600);
p.goto(0); // Hand-Navigation startet die Standzeit neu
await warte(600);
ck('Hand-Navigation startet die Standzeit neu', p.getState().index === 0);

p.setSchleife(false);
ck('Schleife live aus: kein Countdown', zuletzt().schleife === false && zuletzt().schleifeBisMs == null);
await warte(1150);
ck('Schleife aus: bleibt stehen', p.getState().index === 0);
p.goto(1);
p.next();
ck('ohne Schleife: weiter auf letzter Folie bleibt', p.getState().index === 1);
p.setSchleife(true);
p.next();
ck('mit Schleife: weiter auf letzter Folie → erste', p.getState().index === 0);

p.stopPresentation();
const nachStopp = p.getState().index;
await warte(1150);
ck('nach dem Beenden läuft kein Timer weiter', p.getState().active === false && p.getState().index === nachStopp);

// Ohne Schleife im Projekt startet keine.
p.startPresentation(payload(false, [folie('a'), folie('b')]), null);
await warte(1150);
ck('Projekt ohne Schleife: bleibt auf Folie 1', p.getState().index === 0 && zuletzt().schleife === false);
p.stopPresentation();

console.log(`\nwiedergabe: ${pass} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

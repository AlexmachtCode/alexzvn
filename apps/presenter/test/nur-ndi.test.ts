// #303: Publikums-Bildschirm „Keiner – nur NDI“. Start-Ziel prüfen (Main) und wählen (Werkzeugleiste), dazu der
// Start im echten present.ts mit Attrappe statt der Fenster. npm run selftest -w @jm/presenter
import { registerHooks } from 'node:module';
import type { NdiStatus, PresentationPayload } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// present.ts importiert './windows' (Electron) → Attrappe: zählt die Referentenansichten, sammelt die Ziele der
// Publikumsfenster, zählt das Schließen und merkt den Rückruf „Präsentationsfenster geschlossen“.
const g = globalThis as unknown as {
  __w: { referent: number; publikum: (number | null)[]; zu: number; geschlossen: () => void };
};
g.__w = { referent: 0, publikum: [], zu: 0, geschlossen: () => {} };
const WINDOWS = `
const w = globalThis.__w;
export const broadcastAll = () => {};
export const closePresentationWindows = () => { w.zu++; };
export const openAudienceWindow = (ziel) => { w.publikum.push(ziel); };
export const openPresenterWindow = () => { w.referent++; };
export const setPresentationClosedHandler = (cb) => { w.geschlossen = cb; };`;
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

const n = await import('../src/shared/ndi');
const p = await import('../src/main/present');

const payload: PresentationPayload = {
  slides: [{ id: 'a', sourceId: 's', pageIndex: 0, title: 'a', notes: '', hidden: false, overlays: [] }],
  sources: {},
  images: {},
  startIndex: 0,
};

// --- Main: das Start-Ziel aus dem Renderer prüfen
ck('keiner + NDI liefert → keiner', n.pruefeStartZiel('keiner', true) === 'keiner');
ck('keiner ohne NDI → automatischer Bildschirm', n.pruefeStartZiel('keiner', false) === null);
ck('Bildschirm-ID bleibt', n.pruefeStartZiel(7, false) === 7);
ck('Unsinn → null', n.pruefeStartZiel('x', true) === null && n.pruefeStartZiel(NaN, true) === null && n.pruefeStartZiel(undefined, true) === null);
ck('keine endliche Zahl, Zahl als Text → null', n.pruefeStartZiel(Infinity, true) === null && n.pruefeStartZiel('7', true) === null);
ck('null bleibt automatisch', n.pruefeStartZiel(null, true) === null);

// --- Werkzeugleiste: Ziel aus Auswahl und NDI-Status
const sendet: NdiStatus = { an: true, lage: 'sendet', empfaenger: 0, grund: null };
ck('nur NDI gewählt, NDI sendet → keiner', n.startZielFuer(true, sendet, 5) === 'keiner');
ck('nur NDI gewählt, NDI aus → bisherige Bildschirmwahl', n.startZielFuer(true, { ...sendet, an: false, lage: 'aus' }, 5) === 5);
ck('nur NDI gewählt, NDI ausgefallen → bisherige Bildschirmwahl', n.startZielFuer(true, { ...sendet, lage: 'nicht-verfuegbar', grund: 'x' }, 5) === 5);
ck('nur NDI gewählt, NDI startet noch → bisherige Bildschirmwahl', n.startZielFuer(true, { ...sendet, lage: 'startet' }, 5) === 5);
ck('nicht gewählt → Bildschirm', n.startZielFuer(false, sendet, null) === null && n.startZielFuer(false, sendet, 5) === 5);
// Die Wahl „Keiner“ fällt nur, wenn NDI dauerhaft nicht liefert; ein vorübergehendes „startet“ behält sie
// (der Start selbst prüft weiter über startZielFuer).
ck('Wahl behalten: sendet', n.nurNdiBehalten(sendet) === true);
ck('Wahl behalten: startet (Start-Phase, Neuaufbau nach Bild-Absturz)', n.nurNdiBehalten({ ...sendet, lage: 'startet' }) === true);
ck('Wahl zurück: aus', n.nurNdiBehalten({ ...sendet, an: false, lage: 'aus' }) === false);
ck('Wahl zurück: nicht verfügbar', n.nurNdiBehalten({ ...sendet, lage: 'nicht-verfuegbar', grund: 'x' }) === false);
ck('Wahl zurück: Schalter aus (an: false)', n.nurNdiBehalten({ ...sendet, an: false }) === false);
ck('Wahl zurück: Schalter aus, Lage noch startet', n.nurNdiBehalten({ ...sendet, an: false, lage: 'startet' }) === false);

// --- Start im Main
p.startPresentation(payload, 'keiner');
ck('nur NDI: Referentenansicht, kein Publikumsfenster', g.__w.referent === 1 && g.__w.publikum.length === 0 && p.getState().active);
g.__w.geschlossen();
ck('Referentenansicht zu → Präsentation beendet', p.getState().active === false && g.__w.zu === 1);
p.startPresentation(payload, 'keiner');
p.stopPresentation();
ck('nur NDI: Beenden schließt die Referentenansicht', p.getState().active === false && g.__w.zu === 2 && g.__w.publikum.length === 0);
p.startPresentation(payload, 3); p.stopPresentation(); p.startPresentation(payload, null); p.stopPresentation();
ck('sonst unverändert: Publikumsfenster auf 3, dann automatisch', eq(g.__w.publikum, [3, null]) && g.__w.referent === 4 && g.__w.zu === 4);

// --- Review Focus 5: NDI fällt aus oder wird ausgeschaltet, während „Keiner – nur NDI“ läuft. Dass die laufende
// Präsentation dabei weiterläuft, prüft ndi-ausgang.test.ts mit dem echten Ausgang; hier der nächste Start.
const ausgefallen: NdiStatus = { ...sendet, lage: 'nicht-verfuegbar', grund: 'x' };
const aus: NdiStatus = { an: false, lage: 'aus', empfaenger: 0, grund: null };
p.startPresentation(payload, n.pruefeStartZiel(n.startZielFuer(true, sendet, 5), true)); p.stopPresentation();
ck('nur NDI über Auswahl und Main-Prüfung → kein Publikumsfenster', g.__w.publikum.length === 2);
p.startPresentation(payload, n.pruefeStartZiel(n.startZielFuer(true, ausgefallen, 5), false)); p.stopPresentation();
p.startPresentation(payload, n.pruefeStartZiel(n.startZielFuer(true, aus, 5), false)); p.stopPresentation();
ck('nächster Start nach NDI-Ausfall bzw. -Aus → wieder der gewählte Bildschirm', eq(g.__w.publikum.slice(2), [5, 5]));
p.startPresentation(payload, n.pruefeStartZiel('keiner', false)); p.stopPresentation();
ck('Wettlauf: Leiste schickt noch „keiner“, im Main liefert NDI nicht mehr → Publikumsfenster automatisch', eq(g.__w.publikum.slice(4), [null]));

console.log(`\nnur-ndi: ${pass} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

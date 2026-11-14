// #303: Gemeinsame Entscheidungen des Publikumsbilds (Bildschirm und NDI). npm run selftest -w @jm/presenter
import { readFileSync } from 'node:fs';
import type { PresentationState, ScreenMode, Slide } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const folie = (id: string, extra: Partial<Slide> = {}): Slide =>
  ({ id, sourceId: 's', pageIndex: 0, title: id, notes: '', hidden: false, overlays: [], ...extra });

const pb = await import('../src/shared/publikumsbild');
const W = { uebergang: { art: 'blende' as const, dauerMs: 800 }, schleife: false, standzeitSek: 10 };
const a = folie('a'), b = folie('b'), c = folie('c', { uebergang: { art: 'schnitt', dauerMs: 500 } });
const live = (index: number, screen: ScreenMode = 'live'): PresentationState => ({ active: true, index, total: 3, screen });
const aus: PresentationState = { active: false, index: 0, total: 0, screen: 'live' };
ck('aktuelle Folie nach Index', pb.aktuelleFolie(live(1), [a, b, c]) === b);
// Bildschirm unverändert (Anti-Ziel): aktuelleFolie wählt wie HEUTE die AudienceView, auch gestoppt.
// „gestoppt → transparent“ entscheidet nur bildArt/ndiFuellung im NDI-Weg.
ck('gestoppt → Folie nach Index wie heute', pb.aktuelleFolie(aus, [a, b, c]) === a);
ck('ohne Folien / Index außerhalb → keine', pb.aktuelleFolie(live(0), null) === null && pb.aktuelleFolie(live(7), [a]) === null);
ck('Schwarzbild', pb.bildArt(live(0, 'black'), a) === 'schwarz');
ck('Weißbild', pb.bildArt(live(0, 'white'), a) === 'weiss');
ck('Folie', pb.bildArt(live(0), a) === 'folie');
ck('keine Folie → leer', pb.bildArt(live(0), null) === 'leer');
ck('gestoppt → leer, auch mit Folie', pb.bildArt(aus, a) === 'leer');
ck('erste Folie ohne Übergang', eq(pb.naechsteSchicht(null, a, W), { art: 'neu', slide: a, blendeMs: 0 }));
ck('gleiche Folie bleibt', pb.naechsteSchicht('a', a, W).art === 'bleibt');
ck('nächste mit Blende des Projekts', eq(pb.naechsteSchicht('a', b, W), { art: 'neu', slide: b, blendeMs: 800 }));
ck('eigener Schnitt der Folie gewinnt', eq(pb.naechsteSchicht('b', c, W), { art: 'neu', slide: c, blendeMs: 0 }));
ck('keine Folie → leeren', pb.naechsteSchicht('a', null, W).art === 'leeren');
ck('höchstens zwei alte Schichten', pb.MAX_ALTE_SCHICHTEN === 2);
// Gleichlauf-Schutz (Spec): die Ansicht entscheidet nichts selbst, sie ruft die gemeinsamen Funktionen.
const quelle = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const pruefeAnsicht = (name: string, text: string) => {
  for (const f of ['aktuelleFolie(', 'bildArt(', 'naechsteSchicht(', 'MAX_ALTE_SCHICHTEN']) ck(`${name} nutzt ${f}`, text.includes(f));
  ck(`${name} entscheidet den Übergang nicht selbst`, !text.includes('uebergangFuer('));
};
pruefeAnsicht('Publikumsansicht', quelle('../src/renderer/src/views/AudienceView.tsx'));

console.log(`\n${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);

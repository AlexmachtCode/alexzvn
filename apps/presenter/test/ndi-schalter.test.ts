// #303: Beschriftung des NDI-Schalters je Status; Status-Haken useNdiStatus mit React- und jmpr-Attrappe.
// npm run selftest -w @jm/presenter
import { registerHooks } from 'node:module';
import type { NdiLage, NdiStatus } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const n = await import('../src/shared/ndi');

const st = (lage: NdiLage, an = true, empfaenger = 0): NdiStatus => ({ an, lage, empfaenger, grund: null });
ck('aus', n.ndiSchalterText(st('aus', false)) === 'NDI aus');
ck('startet', n.ndiSchalterText(st('startet')) === 'NDI startet …');
ck('sendet, 0 Empfänger', n.ndiSchalterText(st('sendet')) === 'NDI ● an · 0 Empfänger');
ck('sendet, 2 Empfänger', n.ndiSchalterText(st('sendet', true, 2)) === 'NDI ● an · 2 Empfänger');
ck('ausgefallen', n.ndiSchalterText(st('nicht-verfuegbar')) === 'NDI nicht verfügbar');
ck('Mac', n.ndiSchalterText(st('nicht-verfuegbar', false)) === 'NDI nicht verfügbar');

// ---- useNdiStatus: React-Attrappe (useState merkt den Stand, useEffect läuft sofort, useCallback reicht durch)
const r = (globalThis as unknown as { __r: { stand: unknown; aufraeumen: unknown } }).__r = { stand: null, aufraeumen: null };
const REACT = `
const r = globalThis.__r;
export function useState(start) { r.stand = start; return [start, (neu) => { r.stand = neu; }]; }
export function useEffect(fn) { r.aufraeumen = fn(); }
export function useCallback(fn) { return fn; }`;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'react') return { url: 'mock:react', shortCircuit: true };
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url === 'mock:react') return { format: 'module', source: REACT, shortCircuit: true };
    return next(url, ctx);
  },
});
// jmpr.ndi-Attrappe: Push und Abfrage-Antwort steuert der Test selbst.
const api = {
  push: null as ((s: NdiStatus) => void) | null,
  antwort: null as ((s: NdiStatus) => void) | null,
  setzeAn: (_an: boolean): Promise<NdiStatus> => Promise.resolve(st('aus', false)),
};
(globalThis as unknown as { window: unknown }).window = {
  jmpr: {
    ndi: {
      onStatus: (cb: (s: NdiStatus) => void) => { api.push = cb; return () => { api.push = null; }; },
      status: () => new Promise<NdiStatus>((res) => { api.antwort = res; }),
      setzeAn: (an: boolean) => api.setzeAn(an),
    },
  },
};
const { useNdiStatus } = await import('../src/renderer/src/lib/useNdiStatus');
const abbauen = (): void => { if (typeof r.aufraeumen === 'function') (r.aufraeumen as () => void)(); };

useNdiStatus();
ck('Haken: Start mit „aus“', eq(r.stand, n.NDI_STATUS_AUS));
api.antwort!(st('sendet')); await tick();
ck('Haken: Abfrage-Antwort ohne vorherigen Push → übernommen', eq(r.stand, st('sendet')));
abbauen();

const h = useNdiStatus();
api.push!(st('sendet', true, 2)); api.antwort!(st('startet')); await tick();
ck('Haken: Push kam vor der Abfrage-Antwort → die ältere Antwort wird verworfen', eq(r.stand, st('sendet', true, 2)));
api.push!(st('aus', false));
ck('Haken: weitere Pushes gelten', eq(r.stand, st('aus', false)));

api.setzeAn = () => Promise.resolve(st('startet'));
h.setzeAn(true); await tick();
ck('Haken: setzeAn → Antwort des Main übernommen', eq(r.stand, st('startet')));

const fehlerZeilen: string[] = [];
const echtesError = console.error;
console.error = (...a: unknown[]) => { fehlerZeilen.push(a.map(String).join(' ')); };
try {
  api.setzeAn = () => Promise.reject(new Error('IPC weg'));
  h.setzeAn(false); await tick();
} finally {
  console.error = echtesError;
}
ck('Haken: setzeAn scheitert → kein Wurf, letzter bestätigter Status bleibt, eine [ndi]-Zeile',
  eq(r.stand, st('startet')) && fehlerZeilen.length === 1 && fehlerZeilen[0].startsWith('[ndi]') && fehlerZeilen[0].includes('IPC weg'));
abbauen();
ck('Haken: nach dem Abbau kein Push-Abo mehr', api.push === null);

console.log(`\n${pass} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

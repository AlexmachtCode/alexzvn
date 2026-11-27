// Altfehler CN-MV (Stufe 2, Task 9; P6, D9, G18, G19): Ein Doppelklick auf „Meeting verlassen“ verlässt nie. Mit laufenden Slots
// macht der erste Klick auf derselben Taste die Rückfrage „Ja, verlassen (n Slots laufen)“ (T80; Tastenplatz W79, Plan 2b :77-78);
// bis Stufe 2 verließ der zweite Klick eines Doppelklicks damit das Meeting. Jetzt nimmt die Rückfrage erst nach VERLASSEN_SPERRE_MS
// einen Klick an; währenddessen ist die Taste aria-disabled, Platz, Text und Fokus bleiben (D9). Fallen die Slots während der Sperre
// auf 0, verlässt ein Klick sofort (Review Focus 5, G19). Geprüft rein (verlassenSchritt, verlassenGesperrt), über die hooklose
// Verdrahtung verlassenBedienung (Muster slotWahl, live.test.tsx), mit einer Render-Gegenprobe und Quelltext-Wächtern an
// ZoomCard.tsx. Das Modul wird dynamisch geladen: Fehlt es, zählt pruefe das Werfen als FAIL.
import { createElement } from 'react';
import { leseText, ok, render } from '@jm/ui/testhilfe';
import { verlassenFrage } from '@shared/zoom-text';
import { ZoomCard } from '@/zoom/ZoomCard';
import type * as Verlassen from '@/zoom/verlassen';
import { attr, bereich, knopfTexte, ohneKommentare, tags, zoomAbbild, zoomSpeicher } from './testzustand';

/** Eine Prüfung, die auch dann als FAIL zählt, wenn sie wirft (etwa weil das Modul fehlt). */
const pruefe = async (name: string, f: () => boolean | Promise<boolean>): Promise<void> => {
  let r = false;
  try {
    r = await f();
  } catch (e) {
    console.log(`     ${e instanceof Error ? e.message : String(e)}`);
  }
  ok(r, name);
};
const modul = (): Promise<typeof Verlassen> => import('@/zoom/verlassen');
const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const zaehle = (s: string, teil: string): number => s.split(teil).length - 1;

/** Eine Taste mit lebender Frage und Schein-Uhr; jeder Klick baut die Verdrahtung neu wie ein Render (n darf sich ändern). */
function taste(V: typeof Verlassen, n: number) {
  const s = { n, frageSeit: null as number | null, uhr: 0, verlassen: [] as number[] };
  const klick = (t: number): void => {
    s.uhr = t;
    V.verlassenBedienung({
      n: s.n,
      frageSeit: s.frageSeit,
      setzeFrageSeit: (x) => void (s.frageSeit = x),
      jetzt: () => s.uhr,
      verlasse: () => void s.verlassen.push(s.uhr),
    })();
  };
  return { s, klick };
}

// ── CN-MV Doppelklick verlässt nie (rein): der zweite Klick in der Sperrzeit wartet, erst danach verlässt einer ──
await pruefe('CN-MV Doppelklick verlässt nie: Sperrzeit 1000 ms; mit Slots fragt der erste Klick, bei 120 und 999 ms wartet die Taste, ab 1000 ms verlässt sie; ohne Slots sofort', async () => {
  const V = await modul();
  const s = V.verlassenSchritt;
  return V.VERLASSEN_SPERRE_MS === 1000
    && s(2, null, 0) === 'fragen' && s(2, 0, 120) === 'warten' && s(2, 0, 999) === 'warten' && s(2, 0, 1000) === 'verlassen'
    && s(0, null, 0) === 'verlassen';
});
await pruefe('CN-MV Doppelklick verlässt nie: gesperrt nur mit Frage und nur in der Sperrzeit (verlassenGesperrt)', async () => {
  const { verlassenGesperrt: g } = await modul();
  return g(null, 0) === false && g(0, 0) === true && g(0, 120) === true && g(0, 999) === true && g(0, 1000) === false && g(500, 1499) === true && g(500, 1500) === false;
});

// ── CN-MV Verdrahtung: Klick bei t = 0 fragt, bei t = 120 nichts, bei t = 1000 genau ein verlasse ──
await pruefe('CN-MV Verdrahtung: Klick bei 0 setzt die Frage, Klick bei 120 ruft verlasse nicht, Klick bei 1000 ruft es genau einmal', async () => {
  const t = taste(await modul(), 2);
  t.klick(0);
  const gefragt = t.s.frageSeit === 0 && t.s.verlassen.length === 0;
  t.klick(120);
  const gewartet = t.s.frageSeit === 0 && t.s.verlassen.length === 0;
  t.klick(1000);
  return gefragt && gewartet && JSON.stringify(t.s.verlassen) === '[1000]' && t.s.frageSeit === null;
});
await pruefe('CN-MV Verdrahtung: ein Doppelklick (0 und 100 ms) und ein dritter Klick bei 600 ms verlassen nicht; ohne Slots verlässt ein Klick sofort, ohne Frage', async () => {
  const V = await modul();
  const t = taste(V, 2);
  t.klick(0);
  t.klick(100);
  t.klick(600);
  const ohne = taste(V, 0);
  ohne.klick(0);
  return t.s.verlassen.length === 0 && t.s.frageSeit === 0 && JSON.stringify(ohne.s.verlassen) === '[0]' && ohne.s.frageSeit === null;
});

// ── Review Focus 5: fallen die Slots während der Sperre auf 0, verlässt ein Klick sofort (wie heute, keine zweite Frage) ──
await pruefe('CN-MV keine Slots mehr während der Sperre: Klick verlässt (Frage bei 0 mit n = 2, dann n = 0, Klick bei 120 → verlasse genau einmal)', async () => {
  const V = await modul();
  const t = taste(V, 2);
  t.klick(0);
  t.s.n = 0;
  t.klick(120);
  return V.verlassenSchritt(0, 0, 120) === 'verlassen' && JSON.stringify(t.s.verlassen) === '[120]' && t.s.frageSeit === null;
});

// ── Render-Gegenprobe (Wächter, K8): im Meeting mit zwei laufenden Slots steht „Meeting verlassen“, frei und ohne Rückfrage ──
{
  const html = render(createElement(ZoomCard, { a: zoomAbbild({ kurz: { zustand: 'im_meeting', slotsLaufen: 2 } }), zoom: zoomSpeicher() }));
  const zeile = bereich(html, 'data-connect', 'zoom-laufend');
  const knopf = tags(zeile, 'button')[0];
  ok(
    knopfTexte(zeile)[0] === 'Meeting verlassen' && !knopfTexte(zeile).includes(verlassenFrage(2)) && knopf !== undefined && attr(knopf, 'aria-disabled') === undefined && !/\sdisabled=""/.test(knopf),
    'CN-MV Render-Gegenprobe: im Meeting mit 2 laufenden Slots zeigt ZoomCard „Meeting verlassen“ (frei, ohne aria-disabled, ohne T80)',
  );
}

// ── Wächter am Quelltext: ZoomCard verdrahtet verlassenBedienung (G18), die Sperre nur mit Frage (G19), Platz, Text und Variante bleiben ──
await pruefe('CN-MV Wächter: der verlassen-Handler der ZoomCard ist verlassenBedienung, das Modul entscheidet mit verlassenSchritt und liest kein window (G18)', () => {
  const zc = QUELLE('zoom/ZoomCard.tsx');
  const v = QUELLE('zoom/verlassen.ts');
  const bedienung = v.slice(v.indexOf('export function verlassenBedienung('));
  return /const verlassen = verlassenBedienung\(\{/.test(zc) && zc.includes('onClick={verlassen}') && !zc.includes('const verlassen = (): void =>')
    && bedienung.includes('verlassenSchritt(') && !/\bwindow\b|\bdocument\b|\bDate\b|\bperformance\b/.test(v);
});
await pruefe('CN-MV Wächter: aria-disabled nur, solange die Rückfrage steht und gesperrt ist (G19); dieselbe Abschwächung wie gesperrt; ein Zeitgeber zeichnet am Ende der Sperre neu', () => {
  const zc = QUELLE('zoom/ZoomCard.tsx');
  return zc.includes('const sperre = frage && verlassenGesperrt(frageSeit, performance.now());') && zc.includes('aria-disabled={sperre ? true : undefined}')
    && zaehle(zc, 'verlassenGesperrt(') === 1 && zc.includes('aria-disabled:opacity-40') && zc.includes('aria-disabled:cursor-not-allowed')
    && /setTimeout\([^)]*\)/.test(zc) && zc.includes('VERLASSEN_SPERRE_MS') && zc.includes('clearTimeout(');
});
{
  const zc = QUELLE('zoom/ZoomCard.tsx');
  ok(
    zaehle(zc, 'flex flex-row-reverse') === 3 && zc.includes('<div data-connect="zoom-laufend" className="flex flex-row-reverse flex-wrap gap-2">')
      && zc.includes("variant={frage ? 'destructive' : 'outline'}") && zc.includes("{frage ? verlassenFrageText(n) : 'Meeting verlassen'}") && zc.includes("disabled={laeuft.has('verlassen')}"),
    'CN-MV Wächter: drei flex-row-reverse wie bisher, „Meeting verlassen“ vorn in seiner Zeile; Text, Variante und der Doppelklick-Schutz laeuft bleiben (D9, Nr. 103)',
  );
}

import { readFileSync } from 'node:fs';
import {
  AUSGABE_ZU,
  naechsterAusgabeZustand,
  type AusgabeArt,
  type AusgabeEreignis,
  type AusgabeZustand,
} from '../src/zustand.ts';

type Pruefe = (cond: boolean, name: string) => void;

const ARTEN: AusgabeArt[] = ['zu', 'offen', 'bildschirm-fehlt', 'abgestuerzt'];

/** Ausgangszustand je Art; alle außer `zu` haben Bildschirm 7. */
function zustandVon(art: AusgabeArt): AusgabeZustand {
  return art === 'zu' ? AUSGABE_ZU : { art, displayId: 7 };
}

const EREIGNISSE: { name: string; e: AusgabeEreignis }[] = [
  { name: 'geoeffnet neu (Bildschirm 9)', e: { t: 'geoeffnet', displayId: 9, neu: true } },
  { name: 'geoeffnet Umzug (Bildschirm 9)', e: { t: 'geoeffnet', displayId: 9, neu: false } },
  { name: 'geschlossen', e: { t: 'geschlossen' } },
  { name: 'bildschirm-weg (gleicher Bildschirm 7)', e: { t: 'bildschirm-weg', displayId: 7 } },
  { name: 'bildschirm-weg (anderer Bildschirm 3)', e: { t: 'bildschirm-weg', displayId: 3 } },
  { name: 'abgestuerzt', e: { t: 'abgestuerzt' } },
];

/** Erwartung nach den Regeln der Aufgabe. */
function erwartet(z: AusgabeZustand, e: AusgabeEreignis): AusgabeZustand {
  switch (e.t) {
    case 'geoeffnet':
      if (e.neu) return { art: 'offen', displayId: e.displayId };
      // Umzug: open() lädt nicht neu, ein abgestürztes Fenster bleibt abgestürzt.
      if (z.art === 'abgestuerzt') return z;
      return { art: 'offen', displayId: e.displayId };
    case 'geschlossen':
      return AUSGABE_ZU;
    case 'bildschirm-weg':
      return z.art === 'offen' && z.displayId === e.displayId
        ? { art: 'bildschirm-fehlt', displayId: z.displayId }
        : z;
    case 'abgestuerzt':
      return z;
  }
}

function gleich(a: AusgabeZustand, b: AusgabeZustand): boolean {
  return a.art === b.art && a.displayId === b.displayId;
}

export function zustandTests(assert: Pruefe): void {
  console.log('OW Zustand Kreuzprodukt:');
  for (const art of ARTEN) {
    for (const { name, e } of EREIGNISSE) {
      const z = zustandVon(art);
      let soll = erwartet(z, e);
      // `abgestuerzt` kippt jede Art außer `zu`.
      if (e.t === 'abgestuerzt' && art !== 'zu') soll = { art: 'abgestuerzt', displayId: z.displayId };
      const ist = naechsterAusgabeZustand(z, e);
      assert(gleich(ist, soll), `${art} + ${name} → ${soll.art}/${String(soll.displayId)}`);
    }
  }
  assert(AUSGABE_ZU.art === 'zu' && AUSGABE_ZU.displayId === null, 'AUSGABE_ZU ist zu ohne Bildschirm');

  console.log('\nOW Zustand rein:');
  const zustandQuelle = readFileSync(new URL('../src/zustand.ts', import.meta.url), 'utf8');
  assert(!/electron/i.test(zustandQuelle), 'zustand.ts erwähnt electron nicht');

  console.log('\nOW Verdrahtung:');
  const index = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  for (const s of ['render-process-gone', 'display-removed', 'naechsterAusgabeZustand', "'closed'"]) {
    assert(index.includes(s), `index.ts enthält ${s}`);
  }
  const ctor = /constructor\([^)]*\)\s*\{[\s\S]*?\n {2}\}/.exec(index)?.[0] ?? '';
  assert(ctor.length > 0 && !ctor.includes('display-removed'), 'display-removed nicht im Konstruktor');
  const openTeil = /\n {2}open\([\s\S]*?\n {2}close\(/.exec(index)?.[0] ?? '';
  assert(openTeil.includes('display-removed'), 'display-removed wird in open() angemeldet');
}

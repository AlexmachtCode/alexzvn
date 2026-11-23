// Bildschirm-Ereignis (UX Welle 2b, Task 4): `beobachte` meldet sich an einer Quelle wie Electrons `screen` für
// display-added, display-removed und display-metrics-changed an und ruft den Rückruf je Ereignis genau einmal. Geprüft mit
// einer Attrappen-Quelle, ohne Electron. Das Modul wird dynamisch geladen, damit ein fehlendes Modul als FAIL der Prüfungen
// erscheint statt als Abbruch des ganzen Selbsttests.
import { readFileSync } from 'node:fs';

type Pruefe = (cond: boolean, name: string) => void;
type Quelle = { on(e: string, h: () => void): void; removeListener(e: string, h: () => void): void };
type Beobachte = (quelle: Quelle, cb: () => void) => () => void;

const EREIGNISSE = ['display-added', 'display-removed', 'display-metrics-changed'];

/** Attrappe der Quelle: merkt die Hörer je Ereignis und löst sie auf Zuruf aus (mit Argumenten wie Electron). */
function attrappe(): { quelle: Quelle; feuere(e: string): void; hoerer(): string[]; log: string[] } {
  const hoerer = new Map<string, Array<() => void>>();
  const log: string[] = [];
  return {
    quelle: {
      on(e, h) {
        log.push(`on ${e}`);
        hoerer.set(e, [...(hoerer.get(e) ?? []), h]);
      },
      removeListener(e, h) {
        log.push(`ab ${e}`);
        hoerer.set(e, (hoerer.get(e) ?? []).filter((x) => x !== h));
      },
    },
    feuere(e) {
      // Electron ruft mit (event, display[, changedMetrics]); der Rückruf bekommt nichts davon.
      for (const h of [...(hoerer.get(e) ?? [])]) (h as (...a: unknown[]) => void)({}, { id: 7 }, ['bounds']);
    },
    hoerer: () => [...hoerer.entries()].flatMap(([e, l]) => l.map(() => e)).sort(),
    log,
  };
}

export async function bildschirmeTests(assert: Pruefe): Promise<void> {
  console.log('\nOW Bildschirm-Ereignis:');
  const modul = (await import('../src/bildschirme.ts').catch(() => null)) as { beobachte?: Beobachte } | null;
  const beobachte = modul?.beobachte;
  assert(typeof beobachte === 'function', 'bildschirme.ts exportiert beobachte');
  if (typeof beobachte === 'function') {
    const a = attrappe();
    let gemeldet = 0;
    const ab = beobachte(a.quelle, () => void gemeldet++);
    assert(
      a.hoerer().join() === [...EREIGNISSE].sort().join() && a.log.length === 3,
      'beobachte meldet genau drei Hörer an: display-added, display-removed, display-metrics-changed',
    );
    assert(gemeldet === 0, 'die Anmeldung allein ruft den Rückruf nicht');
    for (const e of EREIGNISSE) {
      const vorher = gemeldet;
      a.feuere(e);
      assert(gemeldet === vorher + 1, `${e} ruft den Rückruf genau einmal`);
    }
    const vorFremd = gemeldet;
    a.feuere('display-unbekannt');
    assert(gemeldet === vorFremd, 'ein anderes Ereignis ruft nichts');
    const vorAb = gemeldet;
    ab();
    assert(a.hoerer().length === 0 && EREIGNISSE.every((e) => a.log.includes(`ab ${e}`)), 'die Abmeldung entfernt alle drei Hörer');
    for (const e of EREIGNISSE) a.feuere(e);
    assert(gemeldet === vorAb, 'nach der Abmeldung ruft kein Ereignis mehr');

    // Zwei Beobachter an derselben Quelle: jeder bekommt sein Ereignis, die Abmeldung des einen lässt den anderen stehen.
    const b = attrappe();
    let eins = 0;
    let zwei = 0;
    const abEins = beobachte(b.quelle, () => void eins++);
    beobachte(b.quelle, () => void zwei++);
    b.feuere('display-added');
    abEins();
    b.feuere('display-removed');
    assert(eins === 1 && zwei === 2 && b.hoerer().length === 3, 'zwei Beobachter sind getrennt; die Abmeldung des einen lässt den anderen stehen');
  }

  console.log('\nOW Bildschirm-Ereignis rein und verdrahtet:');
  const quelle = (() => {
    try {
      return readFileSync(new URL('../src/bildschirme.ts', import.meta.url), 'utf8');
    } catch {
      return '';
    }
  })();
  assert(
    quelle.length > 0 && !/from\s+['"]electron['"]|require\(\s*['"]electron['"]\s*\)|import\(\s*['"]electron['"]\s*\)/.test(quelle),
    'bildschirme.ts importiert kein electron',
  );
  assert(
    /export interface BildschirmQuelle \{\s*on\(e: string, h: \(\) => void\): void;\s*removeListener\(e: string, h: \(\) => void\): void;?\s*\}/.test(quelle),
    'bildschirme.ts: BildschirmQuelle mit on und removeListener',
  );
  const index = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert(
    /\nexport function beobachteBildschirme\(cb: \(\) => void\): \(\) => void \{\n {2}return beobachte\(screen, cb\);\n\}/.test(index),
    'index.ts: beobachteBildschirme ist eine Funktion (keine Methode) und reicht screen an beobachte',
  );
  const klasse = /export class OutputWindow \{[\s\S]*?\n\}/.exec(index)?.[0] ?? '';
  assert(klasse.length > 0 && !klasse.includes('beobachte'), 'beobachteBildschirme steht nicht in OutputWindow');
}

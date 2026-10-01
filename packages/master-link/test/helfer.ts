// Testhilfen der Selbsttests (kein Framework, wie in @jm/auth-core).
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let bestanden = 0;
let fehlgeschlagen = 0;

export function pruefe(bedingung: boolean, text: string): void {
  if (bedingung) {
    bestanden++;
    console.log(`  ok  ${text}`);
  } else {
    fehlgeschlagen++;
    console.error(`FAIL  ${text}`);
  }
}

// FAIL-Zeilen landen auch in CI-Logs: private Schlüssel nur geschwärzt ausgeben. Verglichen wird ungeschwärzt.
const schwaerze = (feld: string, wert: unknown): unknown =>
  feld === 'privat' || (typeof wert === 'string' && wert.includes('PRIVATE KEY')) ? '«geschwärzt»' : wert;

export function gleich(ist: unknown, soll: unknown, text: string): void {
  const a = JSON.stringify(ist);
  const b = JSON.stringify(soll);
  pruefe(a === b, a === b ? text : `${text} (ist ${JSON.stringify(ist, schwaerze)}, soll ${JSON.stringify(soll, schwaerze)})`);
}

export function abschnitt(titel: string): void {
  console.log(`\n── ${titel}`);
}

export function bilanz(): never {
  console.log(`\n${bestanden} ok, ${fehlgeschlagen} fehlgeschlagen.`);
  process.exit(fehlgeschlagen === 0 ? 0 : 1);
}

export function tempOrdner(praefix = 'jmml-'): string {
  return mkdtempSync(join(tmpdir(), praefix));
}

export const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Wartet, bis `bedingung()` wahr ist (true) oder `maxMs` verstrichen sind (false). */
export async function bis(bedingung: () => boolean, maxMs = 3000, schrittMs = 10): Promise<boolean> {
  const ende = Date.now() + maxMs;
  while (Date.now() < ende) {
    if (bedingung()) return true;
    await warte(schrittMs);
  }
  return bedingung();
}

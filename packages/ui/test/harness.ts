// ─────────────────────────────────────────────────────────────────────────────
// Testhilfe der Selbsttests von @jm/ui und @jm/settings (Export `@jm/ui/testhilfe`).
// Kein Framework: Jede Prüfung druckt `ok   <msg>` oder `FAIL <msg>`; `abschluss()` druckt am Ende
// `ALLE TESTS OK` bzw. `<n> FEHLGESCHLAGEN` und setzt dann den Exitcode 1.
// Läuft unter tsx in Node, ohne Browser und ohne Electron. Nur Tests importieren diese Datei.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let fehlgeschlagen = 0;

export function ok(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`ok   ${msg}`);
  } else {
    fehlgeschlagen++;
    console.log(`FAIL ${msg}`);
  }
}

/** Vergleich über JSON.stringify (Reihenfolge der Schlüssel zählt). Bei FAIL eine zweite Zeile mit ist/soll. */
export function gleich<T>(ist: T, soll: T, msg: string): void {
  const a = JSON.stringify(ist);
  const b = JSON.stringify(soll);
  ok(a === b, msg);
  if (a !== b) console.log(`     ist: ${a} soll: ${b}`);
}

export function enthaelt(text: string, teil: string, msg: string): void {
  const da = text.includes(teil);
  ok(da, msg);
  if (!da) console.log(`     fehlt: ${teil}`);
}

export function enthaeltNicht(text: string, teil: string, msg: string): void {
  const da = text.includes(teil);
  ok(!da, msg);
  if (da) console.log(`     gefunden: ${teil}`);
}

/** Rendert ohne Browser (react-dom/server). Effekte laufen dabei nicht. */
export function render(el: ReactElement): string {
  return renderToStaticMarkup(el);
}

const VERWEIS = /\s(aria-describedby|aria-labelledby|aria-controls|for)="([^"]*)"/g;
const ID = /\sid="([^"]*)"/g;

/** IDs, auf die aria-describedby, aria-labelledby, aria-controls oder for= zeigen, die im HTML aber fehlen. */
export function fehlendeIdVerweise(html: string): string[] {
  const vorhanden = new Set<string>();
  for (const m of html.matchAll(ID)) vorhanden.add(m[1]);
  const fehlend: string[] = [];
  for (const m of html.matchAll(VERWEIS)) {
    for (const id of m[2].split(/\s+/)) {
      if (id !== '' && !vorhanden.has(id) && !fehlend.includes(id)) fehlend.push(id);
    }
  }
  return fehlend;
}

export function pruefeIdVerweise(html: string, msg: string): void {
  const fehlend = fehlendeIdVerweise(html);
  ok(fehlend.length === 0, msg);
  if (fehlend.length > 0) console.log(`     fehlende ids: ${fehlend.join(', ')}`);
}

/** Liest eine Datei relativ zum Arbeitsverzeichnis (Paketordner) und macht aus \r\n ein \n. */
export function leseText(pfad: string): string {
  return readFileSync(pfad, 'utf8').replace(/\r\n/g, '\n');
}

export function abschluss(): void {
  if (fehlgeschlagen > 0) {
    console.log(`\n${fehlgeschlagen} FEHLGESCHLAGEN`);
    process.exitCode = 1;
  } else {
    console.log('\nALLE TESTS OK');
  }
}

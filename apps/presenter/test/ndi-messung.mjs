// NDI-Messung (#303): zählt die Bilder einer NDI-Quelle in einem Zeitfenster und misst die Abstände dazwischen.
//
//   node test/ndi-messung.mjs [--quelle "<NAME>"] [--sekunden N]
//
// Ohne `--quelle` gilt die einzige Quelle im Netz, deren Name auf „(JM Presenter)“ endet. Gezählt wird erst ab dem
// ersten Bild (der Verbindungsaufbau dauert einige Sekunden). Ausgabe eine Zeile
//   Bilder <n> von <25·N> (<fps> fps), längste Lücke <x> ms, Lücken über 80 ms: <k>
// Exit 1 bei n < 25·N − 2 oder k > 0; Exit 2, wenn nicht gemessen werden kann (@jm/ndi fehlt, keine oder mehrere
// passende Quellen, kein Bild). Der Prüfstand (Gruppe `ndi`) ruft `zaehleBilder` direkt auf.
import { createRequire } from 'node:module';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const FPS = 25;
const ENDUNG = '(JM Presenter)';
/** Ein Abstand über 80 ms heißt: mindestens ein Bild (Takt 40 ms) fehlt. */
const LUECKE_MS = 80;

/**
 * Zählt `ms` lang die Videobilder des verbundenen Empfängers (`ndi.receive(100)` in einer Schleife; Ton und leere
 * Abfragen zählen nicht) und misst die Abstände mit `performance.now()` – auch vom Beginn bis zum ersten und vom
 * letzten Bild bis zum Ende des Fensters. Vorher wird die Warteschlange des Empfängers geleert, damit nur Bilder
 * aus dem Zeitfenster zählen. Blockiert den Aufrufer für `ms`.
 *
 * @param {{ receive(timeoutMs?: number): { type: string } | null }} ndi `@jm/ndi` mit verbundenem Empfänger
 * @param {number} ms
 * @returns {{ bilder: number; laengsteLueckeMs: number; luecken80: number }}
 */
export function zaehleBilder(ndi, ms) {
  while (ndi.receive(0) !== null) {
    // alte Bilder und Ton aus der Warteschlange verwerfen
  }
  const beginn = performance.now();
  const ende = beginn + ms;
  let bilder = 0;
  let laengsteLueckeMs = 0;
  let luecken80 = 0;
  let vorher = beginn;
  const abstand = (bis) => {
    const d = bis - vorher;
    if (d > laengsteLueckeMs) laengsteLueckeMs = d;
    if (d > LUECKE_MS) luecken80++;
  };
  while (performance.now() < ende) {
    const f = ndi.receive(100);
    if (!f || f.type !== 'video') continue;
    const t = performance.now();
    if (t > ende) break; // kam erst nach dem Fenster
    bilder++;
    abstand(t);
    vorher = t;
  }
  abstand(ende);
  return { bilder, laengsteLueckeMs: Math.round(laengsteLueckeMs), luecken80 };
}

function abbruch(meldung) {
  console.error(`ndi-messung: ${meldung}`);
  process.exit(2);
}

function leseArgumente(argv) {
  const opt = { quelle: null, sekunden: 10 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--quelle' && argv[i + 1]) opt.quelle = argv[++i];
    else if (argv[i] === '--sekunden' && argv[i + 1]) opt.sekunden = Number(argv[++i]);
    else abbruch(`unbekanntes Argument „${argv[i]}“ (erlaubt: --quelle "<NAME>", --sekunden N)`);
  }
  if (!Number.isInteger(opt.sekunden) || opt.sekunden < 1) abbruch('--sekunden braucht eine ganze Zahl ab 1');
  return opt;
}

/** Wartet höchstens `ms` auf die Quelle: die genannte oder die einzige, die auf „(JM Presenter)“ endet. */
function findeQuelle(ndi, gewuenscht, ms = 10_000) {
  const ende = Date.now() + ms;
  let passend = [];
  for (;;) {
    const alle = ndi.findSources(1_000);
    passend = gewuenscht ? alle.filter((s) => s === gewuenscht) : alle.filter((s) => s.endsWith(ENDUNG));
    if (passend.length === 1 || Date.now() > ende) break;
  }
  if (passend.length === 1) return passend[0];
  if (gewuenscht) abbruch(`Quelle „${gewuenscht}“ nicht gefunden`);
  if (passend.length === 0) abbruch(`keine Quelle, die auf „${ENDUNG}“ endet – NDI im Presenter an?`);
  abbruch(`mehrere Quellen enden auf „${ENDUNG}“ (${passend.join(', ')}) – bitte --quelle angeben`);
}

function messe(opt) {
  let ndi;
  try {
    ndi = createRequire(import.meta.url)('@jm/ndi');
  } catch (e) {
    abbruch(`@jm/ndi lässt sich nicht laden: ${String(e?.message ?? e).split(/\r?\n/)[0]}`);
  }
  ndi.init();
  try {
    const quelle = findeQuelle(ndi, opt.quelle);
    if (!ndi.createReceiver(quelle)) abbruch(`keine Verbindung zu „${quelle}“`);
    const bisErstes = Date.now() + 15_000;
    let erstes = false;
    while (!erstes && Date.now() < bisErstes) erstes = ndi.receive(100)?.type === 'video';
    if (!erstes) abbruch(`von „${quelle}“ kommt binnen 15 s kein Bild`);
    const ms = opt.sekunden * 1_000;
    const soll = FPS * opt.sekunden;
    const r = zaehleBilder(ndi, ms);
    const fps = ((r.bilder * 1_000) / ms).toFixed(1).replace('.', ',');
    console.log(
      `Bilder ${r.bilder} von ${soll} (${fps} fps), längste Lücke ${r.laengsteLueckeMs} ms, Lücken über ${LUECKE_MS} ms: ${r.luecken80}`,
    );
    return r.bilder < soll - 2 || r.luecken80 > 0 ? 1 : 0;
  } finally {
    ndi.destroy();
  }
}

// CLI nur, wenn die Datei direkt gestartet wird (nicht beim Import durch den Prüfstand).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(messe(leseArgumente(process.argv.slice(2))));
}

// #303: Kern des NDI-Senders (Takt, letztes Bild, Fehlerwege) ohne echtes NDI. npm run selftest -w @jm/presenter
import type { VomSender } from '../src/shared/ndi';
import { NDI_BILD_BYTES } from '../src/shared/ndi';
import type { KernUhr } from '../src/utility/ndi-sender-kern';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const fluss = (): Promise<void> => new Promise<void>((r) => setImmediate(r)); // das Laden im Kern ist async

const k = await import('../src/utility/ndi-sender-kern');

// Simulierte Uhr: die Zeit steht still, bis der Test sie vorspult. vorspulen ruft fällige Rückrufe in
// Fälligkeitsreihenfolge auf (bei Gleichstand in Planungsreihenfolge); stau rückt nur die Uhr vor
// (blockierte Ereignisschleife).
function simulierteUhr(): { uhr: KernUhr; jetzt(): number; vorspulen(ms: number): void; stau(ms: number): void } {
  let jetzt = 0;
  let folge = 0;
  const liste: { marke: number; faellig: number; fn: () => void }[] = [];
  const uhr: KernUhr = {
    jetzt: () => jetzt,
    planen: (fn, ms) => { const marke = folge++; liste.push({ marke, faellig: jetzt + ms, fn }); return marke; },
    abbrechen: (marke) => { const i = liste.findIndex((e) => e.marke === marke); if (i >= 0) liste.splice(i, 1); },
  };
  return {
    uhr,
    jetzt: () => jetzt,
    stau: (ms) => { jetzt += ms; },
    vorspulen: (ms) => {
      const ziel = jetzt + ms;
      for (;;) {
        let besser = -1;
        for (let i = 0; i < liste.length; i++) {
          if (liste[i].faellig > ziel) continue;
          if (besser < 0 || liste[i].faellig < liste[besser].faellig
            || (liste[i].faellig === liste[besser].faellig && liste[i].marke < liste[besser].marke)) besser = i;
        }
        if (besser < 0) break;
        const [e] = liste.splice(besser, 1);
        jetzt = Math.max(jetzt, e.faellig);
        e.fn();
      }
      jetzt = ziel;
    },
  };
}

function attrappenPort() {
  let lauscher: ((e: { data: unknown }) => void) | null = null;
  const raus: VomSender[] = [];
  return {
    raus,
    port: {
      on: (_e: 'message', cb: (e: { data: unknown }) => void) => { lauscher = cb; },
      postMessage: (m: unknown) => { raus.push(m as VomSender); },
    },
    rein: (data: unknown) => lauscher?.({ data }),
  };
}

function attrappenNdi(opt: { initWirft?: boolean; dauerMs?: number; verbindungen?: number; sim?: { stau(ms: number): void } } = {}) {
  const log = {
    init: 0, namen: [] as string[], gesendet: [] as Uint8Array[], format: [] as number[], destroy: 0,
  };
  const modul = {
    init: () => { log.init++; if (opt.initWirft) throw new Error('NDI-Laufzeit fehlt\nDetails'); return true; },
    createSender: (n: string) => { log.namen.push(n); },
    sendVideoBGRA: (buf: Uint8Array, w: number, h: number, fpsN?: number, fpsD?: number) => {
      if (opt.dauerMs && opt.sim) opt.sim.stau(opt.dauerMs);
      log.gesendet.push(buf); // Verweis, keine Kopie
      log.format = [w, h, fpsN ?? 0, fpsD ?? 0];
    },
    connections: () => opt.verbindungen ?? 2,
    destroy: () => { log.destroy++; },
  };
  return { log, modul };
}

// Laufzeit fehlt: Laden scheitert → Meldung, kein Wurf
const sim1 = simulierteUhr();
const p1 = attrappenPort();
k.starteNdiSenderKern(p1.port, () => Promise.reject(new Error('Addon fehlt\nDetails')), 40, sim1.uhr); p1.rein({ type: 'init' }); await fluss();
ck('Laufzeit fehlt → eine Meldung fehler mit erster Zeile', eq(p1.raus, [{ type: 'fehler', grund: 'Addon fehlt' }]));

// init() wirft
const sim2 = simulierteUhr();
const p2 = attrappenPort(); const n2 = attrappenNdi({ initWirft: true });
k.starteNdiSenderKern(p2.port, async () => n2.modul, 40, sim2.uhr); p2.rein({ type: 'init' }); await fluss();
ck('init wirft → fehler, nichts gesendet', p2.raus[0]?.type === 'fehler' && n2.log.gesendet.length === 0);
ck('init wirft → Grund ist erste Zeile', eq(p2.raus[0], { type: 'fehler', grund: 'NDI-Laufzeit fehlt' }));

// Normalfall
const sim3 = simulierteUhr();
const p3 = attrappenPort(); const n3 = attrappenNdi();
k.starteNdiSenderKern(p3.port, async () => n3.modul, 40, sim3.uhr);
p3.rein({ type: 'init' }); p3.rein({ type: 'init' }); await fluss();
ck('init zählt nur einmal', n3.log.init === 1);
ck('bereit gemeldet', p3.raus.some((m) => m.type === 'bereit'));
ck('Quelle heißt JM Presenter', n3.log.namen.join() === 'JM Presenter');
ck('Format 1920×1080, 25/1', eq(n3.log.format, [1920, 1080, 25, 1]));
ck('vor dem ersten Bild: transparent', n3.log.gesendet[0].length === NDI_BILD_BYTES && n3.log.gesendet[0].every((v) => v === 0));
p3.rein({ type: 'bild', buffer: new Uint8Array(NDI_BILD_BYTES).fill(7).buffer });
const vor = n3.log.gesendet.length; sim3.vorspulen(2000);
const neu = n3.log.gesendet.slice(vor);
ck('Standbild: genau 50 Sendungen in 2000 ms (Takt 40 ms)', neu.length === 50);
ck('wiederholt das letzte Bild', neu.every((b) => b[0] === 7));
ck('Standbild: jede Sendung ist derselbe Puffer (Verweis statt 8,3-MB-Kopie je Takt)', neu.every((b) => b === neu[0]));
// Gemessen 15.11.2026 (Task 8, NDI 6, nur @jm/ndi-Empfänger auf demselben Rechner): ein Empfänger = 2 Verbindungen
// laut connections() (0 → 2 → 4 bei 0/1/2 Empfängern). Fremde und entfernte Empfänger: Hand-Abnahme (Task 10).
ck('Empfängerzahl etwa jede Sekunde, 2 Verbindungen = 1 Empfänger', p3.raus.filter((m) => m.type === 'stat' && m.empfaenger === 1).length >= 1);
ck('stat meldet nie die rohe Verbindungszahl', !p3.raus.some((m) => m.type === 'stat' && m.empfaenger === 2));
const anzahl = (): number => n3.log.gesendet.length;
p3.rein({ type: 'bild', buffer: new ArrayBuffer(100) }); sim3.vorspulen(80); // Uhr 2080, steht auf einer Sendung
ck('falsche Größe verworfen (nativer Code läse sonst über das Ende)', n3.log.gesendet.at(-1)![0] === 7);
const a = anzahl(); sim3.stau(100); sim3.vorspulen(0);
ck('Stau 100 ms: beim Wiederanlauf genau 2 Sendungen (Nachholen)', anzahl() - a === 2);
sim3.vorspulen(1900);
ck('Stau 100 ms: 2000 ms ab Stau-Beginn weiter genau 50 Sendungen', anzahl() - a === 50);
const b = anzahl(); sim3.stau(500); sim3.vorspulen(0);
ck('Stau 500 ms: kein Stoß, höchstens 2 Sendungen beim Wiederanlauf (ohne die 2-Takt-Regel wären es 12)', anzahl() - b <= 2);
const c = anzahl(); sim3.vorspulen(39); const nach39 = anzahl(); sim3.vorspulen(1); const nach40 = anzahl();
ck('Stau 500 ms: danach wieder im 40-ms-Takt ab dem Wiederanlauf', nach39 === c && nach40 === c + 1);
p3.rein({ type: 'stop' }); const m = anzahl(); sim3.vorspulen(200);
ck('stop: destroy, danach nichts mehr', n3.log.destroy === 1 && anzahl() === m);

// driftfrei: Senden dauert 10 ms (ein setInterval(40) käme nur auf ~40 in 2 s)
const sim4 = simulierteUhr();
const p4 = attrappenPort(); const n4 = attrappenNdi({ dauerMs: 10, sim: sim4 });
k.starteNdiSenderKern(p4.port, async () => n4.modul, 40, sim4.uhr);
p4.rein({ type: 'init' }); await fluss();
p4.rein({ type: 'bild', buffer: new Uint8Array(NDI_BILD_BYTES).fill(1).buffer });
const vor4 = n4.log.gesendet.length; sim4.vorspulen(2000);
const zaehl4 = n4.log.gesendet.length - vor4;
ck('langsames Senden (10 ms je Bild): genau 50 Sendungen in 2000 ms', zaehl4 === 50);
p4.rein({ type: 'stop' });

// Verbindungen → Empfänger: je Empfänger zwei Verbindungen; eine ungerade Zahl rundet auf, damit ein
// verbundener Empfänger nie als 0 erscheint.
ck('Empfänger aus Verbindungen: 0/1/2/3/4/5 → 0/1/1/2/2/3', eq([0, 1, 2, 3, 4, 5].map(k.empfaengerZahl), [0, 1, 1, 2, 2, 3]));
ck('Empfänger aus Verbindungen: Unsinn → 0', eq([-1, NaN, Infinity].map(k.empfaengerZahl), [0, 0, 0]));
const sim5 = simulierteUhr();
const p5 = attrappenPort(); const n5 = attrappenNdi({ verbindungen: 4 });
k.starteNdiSenderKern(p5.port, async () => n5.modul, 40, sim5.uhr);
p5.rein({ type: 'init' }); await fluss(); sim5.vorspulen(1000); // stat kommt nach 25 × 40 ms
ck('4 Verbindungen → stat empfaenger 2', p5.raus.some((m) => m.type === 'stat' && m.empfaenger === 2) && !p5.raus.some((m) => m.type === 'stat' && m.empfaenger === 4));
p5.rein({ type: 'stop' });

// Standard ist die echte Uhr (kein viertes Argument)
const p6 = attrappenPort(); const n6 = attrappenNdi();
k.starteNdiSenderKern(p6.port, async () => n6.modul, 40);
p6.rein({ type: 'init' }); await warte(300);
p6.rein({ type: 'stop' });
ck('Standard ist die echte Uhr: ohne Uhr-Argument mindestens 1 Sendung in 300 ms', n6.log.gesendet.length >= 1);

console.log(`\n${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);

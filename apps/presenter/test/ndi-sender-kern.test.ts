// #303: Kern des NDI-Senders (Takt, letztes Bild, Fehlerwege) ohne echtes NDI. npm run selftest -w @jm/presenter
import type { VomSender } from '../src/shared/ndi';
import { NDI_BILD_BYTES } from '../src/shared/ndi';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const k = await import('../src/utility/ndi-sender-kern');

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

function attrappenNdi(opt: { initWirft?: boolean; dauerMs?: number } = {}) {
  const log = {
    init: 0, namen: [] as string[], gesendet: [] as Uint8Array[], format: [] as number[], destroy: 0,
  };
  const modul = {
    init: () => { log.init++; if (opt.initWirft) throw new Error('NDI-Laufzeit fehlt\nDetails'); return true; },
    createSender: (n: string) => { log.namen.push(n); },
    sendVideoBGRA: (buf: Uint8Array, w: number, h: number, fpsN?: number, fpsD?: number) => {
      if (opt.dauerMs) { const bis = performance.now() + opt.dauerMs; while (performance.now() < bis) { /* Leerlauf */ } }
      log.gesendet.push(buf.slice());
      log.format = [w, h, fpsN ?? 0, fpsD ?? 0];
    },
    connections: () => 2,
    destroy: () => { log.destroy++; },
  };
  return { log, modul };
}

// Laufzeit fehlt: Laden scheitert → Meldung, kein Wurf
const p1 = attrappenPort();
k.starteNdiSenderKern(p1.port, () => Promise.reject(new Error('Addon fehlt\nDetails')), 40); p1.rein({ type: 'init' }); await warte(100);
ck('Laufzeit fehlt → eine Meldung fehler mit erster Zeile', eq(p1.raus, [{ type: 'fehler', grund: 'Addon fehlt' }]));

// init() wirft
const p2 = attrappenPort(); const n2 = attrappenNdi({ initWirft: true });
k.starteNdiSenderKern(p2.port, async () => n2.modul, 40); p2.rein({ type: 'init' }); await warte(100);
ck('init wirft → fehler, nichts gesendet', p2.raus[0]?.type === 'fehler' && n2.log.gesendet.length === 0);
ck('init wirft → Grund ist erste Zeile', eq(p2.raus[0], { type: 'fehler', grund: 'NDI-Laufzeit fehlt' }));

// Normalfall
const p3 = attrappenPort(); const n3 = attrappenNdi();
k.starteNdiSenderKern(p3.port, async () => n3.modul, 40);
p3.rein({ type: 'init' }); p3.rein({ type: 'init' }); await warte(130);
ck('init zählt nur einmal', n3.log.init === 1);
ck('bereit gemeldet', p3.raus.some((m) => m.type === 'bereit'));
ck('Quelle heißt JM Presenter', n3.log.namen.join() === 'JM Presenter');
ck('Format 1920×1080, 25/1', eq(n3.log.format, [1920, 1080, 25, 1]));
ck('vor dem ersten Bild: transparent', n3.log.gesendet[0].length === NDI_BILD_BYTES && n3.log.gesendet[0].every((v) => v === 0));
p3.rein({ type: 'bild', buffer: new Uint8Array(NDI_BILD_BYTES).fill(7).buffer });
const vor = n3.log.gesendet.length; await warte(2000);
const neu = n3.log.gesendet.slice(vor);
ck('Standbild: 2 s → 48 bis 52 Sendungen', neu.length >= 48 && neu.length <= 52);
ck('wiederholt das letzte Bild', neu.slice(2).every((b) => b[0] === 7));
ck('Empfängerzahl etwa jede Sekunde', p3.raus.filter((m) => m.type === 'stat' && m.empfaenger === 2).length >= 1);
p3.rein({ type: 'bild', buffer: new ArrayBuffer(100) }); await warte(100);
ck('falsche Größe verworfen (nativer Code läse sonst über das Ende)', n3.log.gesendet.at(-1)![0] === 7);
p3.rein({ type: 'stop' }); const n = n3.log.gesendet.length; await warte(200);
ck('stop: destroy, danach nichts mehr', n3.log.destroy === 1 && n3.log.gesendet.length === n);

// driftfrei: Senden dauert 10 ms (ein setInterval(40) käme nur auf ~40 in 2 s)
const p4 = attrappenPort(); const n4 = attrappenNdi({ dauerMs: 10 });
k.starteNdiSenderKern(p4.port, async () => n4.modul, 40);
p4.rein({ type: 'init' }); await warte(100);
p4.rein({ type: 'bild', buffer: new Uint8Array(NDI_BILD_BYTES).fill(1).buffer });
const vor4 = n4.log.gesendet.length; await warte(2000);
const zaehl4 = n4.log.gesendet.length - vor4;
ck('langsames Senden: 2 s → 48 bis 52 Sendungen', zaehl4 >= 48 && zaehl4 <= 52);
p4.rein({ type: 'stop' });

console.log(`\n${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);

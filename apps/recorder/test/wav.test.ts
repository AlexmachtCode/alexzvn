// WAV-Writer (#291): über die 4-GB-Grenze einer Standard-WAV hinaus beginnt der Recorder eine
// Folgedatei (Name_002.wav, Name_003.wav …), statt beim Stopp an writeUInt32LE zu scheitern.
// Grenze im Test klein gestellt; MAX_DATA_BYTES selbst wird einzeln geprüft.
// npm run selftest -w @jm/recorder
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_DATA_BYTES, MultiWavWriter, WavWriter } from '../src/main/wav';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const wurzel = mkdtempSync(join(tmpdir(), 'jmrec-wav-'));

/** Kopf lesen: RIFF-Größe, Kanäle, data-Größe, und die Float-Werte dahinter. */
function lies(p: string): { riff: number; ch: number; data: number; werte: number[] } {
  const b = readFileSync(p);
  const data = b.readUInt32LE(40);
  const werte: number[] = [];
  // Fix-Welle (S2-R26): nie über das Dateiende lesen; ein zu großer Kopf soll als FAIL erscheinen, nicht als Absturz.
  for (let o = 44; o < 44 + data && o + 4 <= b.length; o += 4) werte.push(b.readFloatLE(o));
  return { riff: b.readUInt32LE(4), ch: b.readUInt16LE(22), data, werte };
}

/** planar [ch0:frames][ch1:frames]; Wert = Frame*10 + Kanal, damit Reihenfolge prüfbar ist. */
function block(channels: number, frames: number, start: number): Float32Array {
  const a = new Float32Array(channels * frames);
  for (let c = 0; c < channels; c++) for (let i = 0; i < frames; i++) a[c * frames + i] = (start + i) * 10 + c;
  return a;
}

// --- Grenze selbst: Kopf (36 + data) muss in ein vorzeichenloses 32-Bit-Feld passen.
ck('MAX_DATA_BYTES passt mit Kopf in 32 Bit', MAX_DATA_BYTES + 36 <= 0xffffffff);
ck('MAX_DATA_BYTES liegt nah an 4 GB (> 4 000 000 000)', MAX_DATA_BYTES > 4_000_000_000);

// --- Unter der Grenze: genau eine Datei, wie bisher.
{
  const p = join(wurzel, 'klein.wav');
  const w = new WavWriter(p, 2, 48000, 40);
  w.writeBlock(block(2, 3, 0), 2, 3);
  const r = w.finalize();
  const k = lies(p);
  ck('klein: data = 3 Frames × 8 Byte', k.data === 24);
  ck('klein: RIFF = 36 + data', k.riff === 60);
  ck('klein: keine Folgedatei', !existsSync(join(wurzel, 'klein_002.wav')));
  ck('klein: files = [klein.wav]', r.files.length === 1 && r.files[0] === p);
}

// --- Über der Grenze: 12 Frames Stereo bei 40 Byte (5 Frames) je Datei → 5 + 5 + 2.
{
  const p = join(wurzel, 'lang.wav');
  const w = new WavWriter(p, 2, 1000, 40);
  w.writeBlock(block(2, 12, 0), 2, 12);
  const r = w.finalize();
  const teile = [p, join(wurzel, 'lang_002.wav'), join(wurzel, 'lang_003.wav')];
  ck('lang: drei Dateien', teile.every((t) => existsSync(t)) && !existsSync(join(wurzel, 'lang_004.wav')));
  ck('lang: files in Reihenfolge', JSON.stringify(r.files) === JSON.stringify(teile));
  const k = teile.map(lies);
  ck('lang: data-Größen 40/40/16', k[0].data === 40 && k[1].data === 40 && k[2].data === 16);
  ck('lang: jede RIFF-Größe = 36 + data', k.every((x) => x.riff === 36 + x.data));
  ck('lang: Folgedateien behalten 2 Kanäle', k.every((x) => x.ch === 2));
  const alle = k.flatMap((x) => x.werte);
  const erwartet: number[] = [];
  for (let i = 0; i < 12; i++) erwartet.push(i * 10, i * 10 + 1);
  ck('lang: Samples lückenlos und interleaved über alle Dateien', JSON.stringify(alle) === JSON.stringify(erwartet));
  ck('lang: Dauer zählt alle Dateien (12 Frames / 1000 Hz)', Math.abs(r.durationSec - 0.012) < 1e-9);
  const summe = teile.reduce((s, t) => s + statSync(t).size, 0);
  ck('lang: bytes = Summe der Dateigrößen', r.bytes === summe);
}

// --- Grenze kein Vielfaches eines Frames: 44 Byte bei 8 Byte/Frame → 5 Frames (40 Byte), nie ein halber Frame.
{
  const p = join(wurzel, 'krumm.wav');
  const w = new WavWriter(p, 2, 48000, 44);
  w.writeBlock(block(2, 6, 0), 2, 6);
  w.finalize();
  ck('krumm: erste Datei endet auf Frame-Grenze', lies(p).data === 40);
  ck('krumm: Rest in Folgedatei', lies(join(wurzel, 'krumm_002.wav')).data === 8);
}

// --- Genau an der Grenze: keine leere Folgedatei.
{
  const p = join(wurzel, 'genau.wav');
  const w = new WavWriter(p, 2, 48000, 40);
  w.writeBlock(block(2, 5, 0), 2, 5);
  const r = w.finalize();
  ck('genau: keine leere Folgedatei', !existsSync(join(wurzel, 'genau_002.wav')) && r.files.length === 1);
}

// --- Mehrere Blöcke über die Grenze hinweg.
{
  const p = join(wurzel, 'bloecke.wav');
  const w = new WavWriter(p, 1, 1000, 12); // 3 Frames Mono je Datei
  w.writeBlock(block(1, 2, 0), 1, 2);
  w.writeBlock(block(1, 2, 2), 1, 2);
  w.writeBlock(block(1, 3, 4), 1, 3);
  w.finalize();
  const alle = [p, join(wurzel, 'bloecke_002.wav'), join(wurzel, 'bloecke_003.wav')].map(lies).flatMap((x) => x.werte);
  ck('bloecke: 7 Frames über drei Dateien in Reihenfolge', JSON.stringify(alle) === JSON.stringify([0, 10, 20, 30, 40, 50, 60]));
}

// --- Einzelspuren teilen genauso: Name-Spur01.wav → Name-Spur01_002.wav.
{
  const w = new MultiWavWriter(wurzel, 'multi', 2, 48000, 8); // 2 Frames Mono je Datei
  w.writeBlock(block(2, 3, 0), 2, 3);
  w.finalize();
  ck('multi: Spur01 + Folgedatei', existsSync(join(wurzel, 'multi-Spur01.wav')) && existsSync(join(wurzel, 'multi-Spur01_002.wav')));
  ck('multi: Spur02-Folgedatei trägt Kanal 2', JSON.stringify(lies(join(wurzel, 'multi-Spur02_002.wav')).werte) === JSON.stringify([21]));
}

// --- Altfehler RE-3 (Task 7, Fix-Runde 2, Ruling R21): eine kaputte Spur bricht das Abschließen der übrigen nicht ab, verschwindet aber
// auch nicht mehr still: nach allen Spuren wirft finalize den ersten Fehler, mit der Datei der Spur, deren Kopf scheiterte (`datei`).
{
  const echt = WavWriter.prototype.finalize;
  const versucht: string[] = [];
  const kaputt = (enden: string[]) =>
    function (this: WavWriter): ReturnType<WavWriter['finalize']> {
      const dateien = (this as unknown as { files: string[] }).files;
      const aktuell = dateien[dateien.length - 1];
      versucht.push(aktuell);
      const r = echt.call(this);
      if (enden.some((e) => aktuell.endsWith(e))) throw Object.assign(new Error(`EIO: i/o error, write (${aktuell.slice(-11)})`), { code: 'EIO' });
      return r;
    };
  const fange = (f: () => void): (Error & { datei?: string }) | null => {
    try {
      f();
      return null;
    } catch (e) {
      return e as Error & { datei?: string };
    }
  };
  const w = new MultiWavWriter(wurzel, 'kaputt', 3, 48000);
  w.writeBlock(block(3, 3, 0), 3, 3);
  WavWriter.prototype.finalize = kaputt(['-Spur01.wav', '-Spur03.wav']);
  let e: (Error & { datei?: string }) | null;
  try {
    e = fange(() => w.finalize());
  } finally {
    WavWriter.prototype.finalize = echt;
  }
  const spur = (n: number): string => join(wurzel, `kaputt-Spur0${n}.wav`);
  ck(
    `RE-3 R21 MultiWavWriter: Spur01 und Spur03 scheitern, alle drei werden versucht (${versucht.length}), Spur02 trägt ihren Kopf (${lies(spur(2)).data})`,
    versucht.length === 3 && lies(spur(2)).data === 12 && JSON.stringify(lies(spur(2)).werte) === JSON.stringify([1, 11, 21]),
  );
  ck(
    `RE-3 R21 MultiWavWriter: danach wirft finalize den ersten Fehler, mit der Datei der Spur (${e?.datei}, ${e?.message})`,
    e !== null && e.datei === spur(1) && e.message === 'EIO: i/o error, write (-Spur01.wav)',
  );

  // Teilt eine Spur in Folgedateien, nennt der Fehler die Datei, deren Kopf scheiterte (die laufende Folgedatei).
  versucht.length = 0;
  const f = new MultiWavWriter(wurzel, 'kaputtFolge', 2, 48000, 8);
  f.writeBlock(block(2, 3, 0), 2, 3);
  WavWriter.prototype.finalize = kaputt(['-Spur02_002.wav']);
  let e2: (Error & { datei?: string }) | null;
  try {
    e2 = fange(() => f.finalize());
  } finally {
    WavWriter.prototype.finalize = echt;
  }
  ck(
    `RE-3 R21 MultiWavWriter: in einer Folgedatei nennt der Fehler die laufende Folgedatei (${e2?.datei})`,
    e2 !== null && e2.datei === join(wurzel, 'kaputtFolge-Spur02_002.wav') && versucht.length === 2,
  );

  // Ohne Fehler wirft finalize nichts (wie bisher).
  const heil = new MultiWavWriter(wurzel, 'heil', 2, 48000);
  heil.writeBlock(block(2, 2, 0), 2, 2);
  ck('RE-3 R21 MultiWavWriter: ohne kaputte Spur wirft finalize nichts', fange(() => heil.finalize()) === null && lies(join(wurzel, 'heil-Spur02.wav')).data === 8);
}

// --- Fix-Welle (Ruling S2-R26, I1; Altfehler RE-7a): kopfAktualisieren schreibt den Kopf der offenen Datei mit den aktuellen Größen neu
// (RIFF-Größe an Offset 4, data-Größe an Offset 40), ohne zu schließen; weitere Blöcke hängen dahinter an. Beendet danach der Installer
// eines Updates den Recorder hart (taskkill /f), ist die Datei bis zu diesem Moment abspielbar statt mit Platzhalter-Kopf (data 0).
type MitKopf = { kopfAktualisieren?: () => void };
const kopf = (w: unknown): void => (w as MitKopf).kopfAktualisieren?.();
/** Alle Float-Werte hinter dem 44-Byte-Kopf bis zum Dateiende (unabhängig von der data-Größe im Kopf). */
function bisEnde(p: string): number[] {
  const b = readFileSync(p);
  const werte: number[] = [];
  for (let o = 44; o + 4 <= b.length; o += 4) werte.push(b.readFloatLE(o));
  return werte;
}
const folge = (von: number, bis: number, ch: number): number[] => {
  const a: number[] = [];
  for (let i = von; i < bis; i++) for (let c = 0; c < ch; c++) a.push(i * 10 + c);
  return a;
};
{
  const p = join(wurzel, 'zwischen.wav');
  const w = new WavWriter(p, 2, 1000);
  w.writeBlock(block(2, 3, 0), 2, 3);
  w.writeBlock(block(2, 2, 3), 2, 2);
  ck('S2-R26 WavWriter.kopfAktualisieren gibt es', typeof (w as unknown as MitKopf).kopfAktualisieren === 'function');
  ck(`S2-R26 vor kopfAktualisieren steht im Kopf noch der Platzhalter (data ${lies(p).data})`, lies(p).data === 0);
  kopf(w);
  const b = readFileSync(p);
  const k = lies(p);
  ck(
    `S2-R26 WavWriter: nach 2 Blöcken (5 Frames) trägt der Kopf data 40 = Dateigröße − 44 und RIFF = Dateigröße − 8 (data ${k.data}, RIFF ${k.riff}, Datei ${b.length})`,
    k.data === 40 && k.data === b.length - 44 && k.riff === b.length - 8,
  );
  ck(
    'S2-R26 WavWriter: „RIFF“, „WAVE“, „fmt “, Format, Kanäle und „data“ bleiben an ihrem Platz, der erste Wert steht an Offset 44',
    b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE' && b.toString('ascii', 12, 16) === 'fmt ' && b.readUInt16LE(20) === 3 &&
      k.ch === 2 && b.toString('ascii', 36, 40) === 'data' && JSON.stringify(k.werte) === JSON.stringify(folge(0, 5, 2)),
  );
  w.writeBlock(block(2, 4, 5), 2, 4);
  const b2 = readFileSync(p);
  ck(
    `S2-R26 WavWriter: weitere Blöcke hängen hinten an (Datei ${b2.length} = 44 + 9 Frames × 8), lückenlos; der Kopf bleibt beim Stand der Anfrage (data ${b2.readUInt32LE(40)})`,
    b2.length === 44 + 72 && JSON.stringify(bisEnde(p)) === JSON.stringify(folge(0, 9, 2)) && b2.readUInt32LE(40) === 40,
  );
  w.finalize();
  ck(`S2-R26 WavWriter: finalize schreibt danach die volle Länge (data ${lies(p).data})`, lies(p).data === 72 && lies(p).riff === 108);
}
// Folgedatei: aktualisiert wird der Kopf der gerade offenen Datei; die abgeschlossene erste Datei bleibt, wie sie ist.
{
  const p = join(wurzel, 'zwFolge.wav');
  const f2 = join(wurzel, 'zwFolge_002.wav');
  const w = new WavWriter(p, 2, 1000, 40); // 5 Frames je Datei
  w.writeBlock(block(2, 7, 0), 2, 7);
  kopf(w);
  ck(
    `S2-R26 WavWriter mit Folgedatei: die laufende Folgedatei trägt data 16 = Dateigröße − 44, die erste bleibt bei 40 (${lies(f2).data}, ${readFileSync(f2).length}, ${lies(p).data})`,
    lies(f2).data === 16 && readFileSync(f2).length - 44 === 16 && lies(f2).riff === readFileSync(f2).length - 8 && lies(p).data === 40,
  );
  w.writeBlock(block(2, 1, 7), 2, 1);
  w.finalize();
  ck(
    `S2-R26 WavWriter mit Folgedatei: danach hängt der nächste Block an, finalize schreibt 24 (${lies(f2).data})`,
    lies(f2).data === 24 && JSON.stringify(bisEnde(f2)) === JSON.stringify(folge(5, 8, 2)),
  );
}
// Spuren einzeln: jede Spur, auch in ihrer Folgedatei.
{
  const w = new MultiWavWriter(wurzel, 'zwMulti', 2, 1000);
  w.writeBlock(block(2, 3, 0), 2, 3);
  ck('S2-R26 MultiWavWriter.kopfAktualisieren gibt es', typeof (w as unknown as MitKopf).kopfAktualisieren === 'function');
  kopf(w);
  const spur = (n: number): string => join(wurzel, `zwMulti-Spur0${n}.wav`);
  ck(
    `S2-R26 MultiWavWriter mit zwei Spuren: jede Spur trägt data 12 = Dateigröße − 44 (${lies(spur(1)).data}, ${lies(spur(2)).data})`,
    [1, 2].every((n) => lies(spur(n)).data === 12 && readFileSync(spur(n)).length - 44 === 12 && lies(spur(n)).riff === readFileSync(spur(n)).length - 8),
  );
  w.writeBlock(block(2, 2, 3), 2, 2);
  ck(
    'S2-R26 MultiWavWriter: danach hängen weitere Blöcke je Spur an, die Köpfe bleiben beim Stand der Anfrage',
    JSON.stringify(bisEnde(spur(1))) === JSON.stringify([0, 10, 20, 30, 40]) && JSON.stringify(bisEnde(spur(2))) === JSON.stringify([1, 11, 21, 31, 41]) &&
      lies(spur(1)).data === 12 && lies(spur(2)).data === 12,
  );
  w.finalize();
  ck('S2-R26 MultiWavWriter: finalize schreibt danach die volle Länge je Spur', lies(spur(1)).data === 20 && lies(spur(2)).data === 20);

  const m = new MultiWavWriter(wurzel, 'zwMultiFolge', 2, 1000, 8); // 2 Frames Mono je Datei
  m.writeBlock(block(2, 3, 0), 2, 3);
  kopf(m);
  const folgeSpur = (n: number): string => join(wurzel, `zwMultiFolge-Spur0${n}_002.wav`);
  ck(
    `S2-R26 MultiWavWriter mit Folgedateien: die laufende Folgedatei jeder Spur trägt data 4 = Dateigröße − 44 (${lies(folgeSpur(1)).data}, ${lies(folgeSpur(2)).data})`,
    [1, 2].every((n) => lies(folgeSpur(n)).data === 4 && readFileSync(folgeSpur(n)).length - 44 === 4) &&
      JSON.stringify([lies(folgeSpur(1)).werte, lies(folgeSpur(2)).werte]) === JSON.stringify([[20], [21]]),
  );
  m.finalize();
}
// Eine Spur, deren Kopf sich nicht schreiben lässt, hält die übrigen nicht auf; danach wirft kopfAktualisieren den ersten Fehler mit der
// Datei dieser Spur (wie finalize, Ruling R21), damit die Logzeile sie nennen kann.
{
  const echt = (WavWriter.prototype as unknown as MitKopf).kopfAktualisieren;
  const m = new MultiWavWriter(wurzel, 'zwKaputt', 3, 1000);
  m.writeBlock(block(3, 2, 0), 3, 2);
  const versucht: string[] = [];
  (WavWriter.prototype as unknown as MitKopf).kopfAktualisieren = function (this: WavWriter): void {
    versucht.push(this.aktuelleDatei);
    if (this.aktuelleDatei.endsWith('-Spur01.wav')) throw new Error('EIO: i/o error, write');
    echt?.call(this);
  };
  let e: (Error & { datei?: string }) | null = null;
  try {
    kopf(m);
  } catch (x) {
    e = x as Error & { datei?: string };
  } finally {
    (WavWriter.prototype as unknown as MitKopf).kopfAktualisieren = echt;
  }
  const spur = (n: number): string => join(wurzel, `zwKaputt-Spur0${n}.wav`);
  ck(
    `S2-R26 MultiWavWriter: scheitert Spur01, werden alle drei versucht, Spur02 und Spur03 tragen ihren Kopf (${versucht.length}, ${lies(spur(2)).data}, ${lies(spur(3)).data})`,
    versucht.length === 3 && lies(spur(2)).data === 8 && lies(spur(3)).data === 8 && lies(spur(1)).data === 0,
  );
  ck(`S2-R26 MultiWavWriter: danach wirft kopfAktualisieren den Fehler mit der Datei von Spur01 (${e?.datei}, ${e?.message})`, e?.datei === spur(1) && e.message === 'EIO: i/o error, write');
  m.finalize();
}

console.log(`\nwav: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);

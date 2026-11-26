// Aufnahme-Ablauf (#291) mit Attrappe statt @jm/audio: Überschreibschutz beim Start, Folgedateien
// im Stopp-Ergebnis, und shutdown() (Fenster zu) schließt eine laufende Aufnahme ordentlich ab —
// vorher blieb der Kopf auf Länge 0. npm run selftest -w @jm/recorder
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// recorder.ts lädt das Addon per freiem `require('@jm/audio')`; in ESM greift das auf globalThis.
type Frames = (planar: Float32Array, channels: number, frames: number) => void;
let aufFrames: Frames | null = null;
let gestoppt = 0;
const attrappe = {
  init: () => {},
  listDevices: () => [
    { index: 0, name: 'Mikrofon (Realtek)', hostApiName: 'WASAPI', maxInputChannels: 2, defaultSampleRate: 48000 },
    { index: 5, name: 'Lautsprecher (Realtek) [Loopback]', hostApiName: 'WASAPI', maxInputChannels: 2, defaultSampleRate: 48000 },
  ],
  openInput: (_o: unknown, cb: Frames) => { aufFrames = cb; },
  stopInput: () => { gestoppt++; aufFrames = null; },
};
(globalThis as unknown as { require: (id: string) => unknown }).require = (id: string) => {
  if (id === '@jm/audio') return attrappe;
  throw new Error(`unerwartetes require: ${id}`);
};
// Wächtertakte zählen: recorder.ts startet den Wächter über das globale setInterval. Altfehler RE-3 (Task 7): jede Rückruffunktion
// steht mit ihrem Takt in `intervalle`, damit ein Test den Block-Wächter mit umgelegter Uhr selbst rufen kann.
let takte = 0;
const intervalle: Array<{ fn: () => void; ms: number | undefined }> = [];
const echtesSetInterval = globalThis.setInterval;
(globalThis as unknown as { setInterval: (fn: () => void, ms?: number) => unknown }).setInterval = (fn, ms) => {
  intervalle.push({ fn, ms });
  return echtesSetInterval(() => { takte++; fn(); }, ms);
};

const rec = await import('../src/main/recorder');
const dir = mkdtempSync(join(tmpdir(), 'jmrec-rec-'));
const dataLaenge = (p: string): number => readFileSync(p).readUInt32LE(40);

// --- Überschreibschutz: vorhandene Tag.wav bleibt unberührt, Aufnahme läuft als Tag-2.wav.
writeFileSync(join(dir, 'Tag.wav'), 'VORTAG');
ck('arm ok', rec.arm({ device: 0, channels: 2, sampleRate: 48000 }).ok);
ck('start ok', rec.startRecording({ dir, fileName: 'Tag' }).ok);
ck('läuft als Tag-2.wav', rec.getState().filePath === join(dir, 'Tag-2.wav'));
aufFrames!(new Float32Array(2 * 4), 2, 4);
const r = rec.stopRecording();
ck('Vortags-Datei unverändert', readFileSync(join(dir, 'Tag.wav'), 'utf8') === 'VORTAG');
ck('Stopp meldet Tag-2.wav', r.ok && r.filePath === join(dir, 'Tag-2.wav'));
ck('Stopp nennt die Dateien', JSON.stringify(r.files) === JSON.stringify([join(dir, 'Tag-2.wav')]));

// --- shutdown während der Aufnahme: Kopf trägt die echte Länge, Eingang ist zu.
ck('start 2 ok', rec.startRecording({ dir, fileName: 'Abbruch' }).ok);
aufFrames!(new Float32Array(2 * 10), 2, 10);
const vorher = gestoppt;
rec.shutdown();
ck('shutdown: Kopf trägt 10 Frames × 8 Byte', dataLaenge(join(dir, 'Abbruch.wav')) === 80);
ck('shutdown: Eingang geschlossen', gestoppt > vorher);
ck('shutdown: Zustand idle', rec.getState().status === 'idle');

// --- Loopback (Windows liefert in Stille KEINE Blöcke): Lücke wird als echte Stille aufgefüllt.
const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function luecke(device: number, name: string): Promise<{ frames: number; ms: number }> {
  ck(`arm ${name}`, rec.arm({ device, channels: 2, sampleRate: 1000 }).ok);
  const t0 = Date.now();
  ck(`start ${name}`, rec.startRecording({ dir, fileName: name }).ok);
  aufFrames!(new Float32Array(2 * 10), 2, 10);
  await warte(700);
  aufFrames!(new Float32Array(2 * 10), 2, 10);
  const res = rec.stopRecording();
  const ms = Date.now() - t0;
  ck(`stopp ${name}`, res.ok);
  rec.disarm();
  return { frames: dataLaenge(join(dir, `${name}.wav`)) / 8, ms };
}
// Länge gegen die GEMESSENE Zeit von Start bis Stopp (bei 1000 Hz: 1 Frame je ms).
const loop = await luecke(5, 'Loop');
ck(`Loopback: Pause gefüllt (${loop.frames} Frames, gemessen ${loop.ms} ms)`, Math.abs(loop.frames - loop.ms) <= 80);
const mik = await luecke(0, 'Mik');
ck(`Nicht-Loopback: genau 20 Frames (${mik.frames})`, mik.frames === 20);

// --- Stau im Hauptprozess (I1): hängt die Ereignisschleife 400 ms, kommen die gepufferten Blöcke
// danach auf einen Schlag. Das ist keine Stille — zwischen den echten Blöcken darf keine Null stehen.
const haengen = (ms: number): void => {
  const bis = Date.now() + ms;
  while (Date.now() < bis) { /* Hauptprozess hängt, kein Wächter */ }
};
const echt = (n: number): Float32Array => new Float32Array(2 * n).fill(0.5);
async function stau(name: string, waechterZuerst: boolean): Promise<Float32Array> {
  ck(`arm ${name}`, rec.arm({ device: 5, channels: 2, sampleRate: 1000 }).ok);
  ck(`start ${name}`, rec.startRecording({ dir, fileName: name }).ok);
  aufFrames!(echt(10), 2, 10);
  haengen(400);
  if (waechterZuerst) {
    // Ein Wächtertakt läuft VOR den Blöcken (ohne echte Wartezeit — die wäre wieder Stille).
    const vor = takte;
    for (let i = 0; takte === vor && i < 1000; i++) await new Promise((r) => setImmediate(r));
    ck(`${name}: Wächter lief vor den Blöcken`, takte > vor);
  }
  for (let i = 0; i < 40; i++) aufFrames!(echt(10), 2, 10);
  ck(`stopp ${name}`, rec.stopRecording().ok);
  rec.disarm();
  const b = readFileSync(join(dir, `${name}.wav`));
  return new Float32Array(b.buffer.slice(b.byteOffset + 44, b.byteOffset + b.length));
}
function nullenZwischen(s: Float32Array): number {
  const a = s.findIndex((v) => v !== 0);
  let e = s.length - 1;
  while (e >= 0 && s[e] === 0) e--;
  let n = 0;
  for (let i = a; i <= e; i++) if (s[i] === 0) n++;
  return n;
}
for (const [name, zuerst] of [['StauBloecke', false], ['StauWaechter', true]] as const) {
  const s = await stau(name, zuerst);
  ck(`${name}: keine Null zwischen den echten Blöcken (${nullenZwischen(s)})`, s.length > 0 && nullenZwischen(s) === 0);
  ck(`${name}: genau 41 Blöcke, nichts eingeschoben (${s.length / 2} Frames)`, s.length === 2 * 410);
}

// --- Alte Bestätigung (Review): Wächter bestätigt echte Stille, dann hängt der Hauptprozess 400 ms,
// danach kommt echtes Audio VOR dem nächsten Wächtertakt. Der Stau darf nicht als Stille davor stehen.
{
  ck('arm Alt', rec.arm({ device: 5, channels: 2, sampleRate: 1000 }).ok);
  ck('start Alt', rec.startRecording({ dir, fileName: 'Alt' }).ok);
  const t0 = Date.now();
  await warte(450); // echte Stille, der Wächter füllt auf
  haengen(400);
  const stilleMs = Date.now() - t0 - 400; // gemessene Stille vor dem Stau (ohne die 400 ms)
  for (let i = 0; i < 40; i++) aufFrames!(echt(10), 2, 10);
  ck('stopp Alt', rec.stopRecording().ok);
  rec.disarm();
  const b = readFileSync(join(dir, 'Alt.wav'));
  const s = new Float32Array(b.buffer.slice(b.byteOffset + 44, b.byteOffset + b.length));
  const erster = s.findIndex((v) => v !== 0) / 2;
  ck(`Alt: erster echter Frame bei ${erster} ≈ Stille ${stilleMs} ms (nicht danach)`, erster >= stilleMs - 150 && erster <= stilleMs + 20);
}

// --- Altfehler RE-2 (Plan 2026-11-26, Task 6; B6): arm in der Aufnahme lehnt ab, statt den Eingang zu schließen und neu zu öffnen
// (ein ARM kurz nach RECORD ON darf keine Aufnahme beenden). Die Aufnahme läuft weiter und behält alle Frames.
{
  ck('RE-2 arm', rec.arm({ device: 0, channels: 2, sampleRate: 48000 }).ok);
  ck('RE-2 start', rec.startRecording({ dir, fileName: 'Wache' }).ok);
  aufFrames!(new Float32Array(2 * 10), 2, 10);
  const vor = gestoppt;
  const r = rec.arm({ device: 0, channels: 2, sampleRate: 48000 });
  ck(`RE-2 arm in der Aufnahme abgelehnt: ok false, Grund „Erst die Aufnahme stoppen.“ (${JSON.stringify(r)})`, r.ok === false && r.error === 'Erst die Aufnahme stoppen.');
  ck('RE-2 arm in der Aufnahme abgelehnt: Status bleibt recording, der Eingang wurde nicht geschlossen', rec.getState().status === 'recording' && gestoppt === vor);
  aufFrames!(new Float32Array(2 * 10), 2, 10);
  const stopp = rec.stopRecording();
  ck('RE-2 arm in der Aufnahme abgelehnt: der Stopp danach schließt ab', stopp.ok);
  ck(`RE-2 arm in der Aufnahme abgelehnt: der Kopf trägt beide Blöcke (20 Frames × 8 Byte = ${dataLaenge(join(dir, 'Wache.wav'))})`, dataLaenge(join(dir, 'Wache.wav')) === 160);
  rec.disarm();
}
{
  const schliesse = (rec as unknown as { schliesseEingang?: () => { ok: boolean; error?: string } }).schliesseEingang;
  ck('RE-2 schliesseEingang gibt es', typeof schliesse === 'function');
  ck('RE-2 schliesseEingang: arm', rec.arm({ device: 0, channels: 2, sampleRate: 48000 }).ok);
  ck('RE-2 schliesseEingang: start', rec.startRecording({ dir, fileName: 'Wache2' }).ok);
  aufFrames!(new Float32Array(2 * 10), 2, 10);
  const vor = gestoppt;
  const r = schliesse?.();
  ck(
    `RE-2 schliesseEingang in der Aufnahme abgelehnt (${JSON.stringify(r)})`,
    r?.ok === false && r.error === 'Erst die Aufnahme stoppen.' && rec.getState().status === 'recording' && gestoppt === vor,
  );
  // Ohne `!`: hätte schliesseEingang den Eingang doch geschlossen, gibt es keine Block-Funktion mehr, und die Prüfung unten zeigt es.
  aufFrames?.(new Float32Array(2 * 10), 2, 10);
  ck('RE-2 schliesseEingang: Stopp', rec.stopRecording().ok);
  ck(`RE-2 schliesseEingang abgelehnt: die Aufnahme lief weiter, der Kopf trägt beide Blöcke (${dataLaenge(join(dir, 'Wache2.wav'))})`, dataLaenge(join(dir, 'Wache2.wav')) === 160);
  const r2 = schliesse?.();
  ck(`RE-2 schliesseEingang bei armed ok: Eingang zu (${JSON.stringify(r2)})`, r2?.ok === true && rec.getState().status === 'idle' && gestoppt > vor);
  if (rec.getState().status !== 'idle') rec.disarm();
}

// --- Altfehler RE-3 (Plan 2026-11-26, Task 7; B1, B2, D3, Pre-flight K7): ein Schreibfehler oder 2 s ohne Blöcke an einem Eingang, der
// kein Loopback ist, beenden die Aufnahme sauber: Datei abgeschlossen, Status `armed`, das Fehlerfeld bleibt, bis ein Start gelingt, ein
// Stopp quittiert oder jemand den Eingang schließt. Nie „recording“, während nichts geschrieben wird. Fehler per umgelegtem Prototyp.
type Fehler = { art: string; text: string; datei: string | null } | null | undefined;
const R = rec as unknown as {
  setProtokoll?: (f: (zeile: string) => void) => void;
  AUFNAHME_FEHLER_TEXTE?: {
    schreiben: (datei: string, grund: string) => string;
    kopf: (datei: string, grund: string) => string;
    eingang: string;
    eingangGrund: string;
    log: (art: string, datei: string, grund: string) => string;
  };
  wettlaufAblehnung?: (verb: 'ARM' | 'DISARM', r: { ok: boolean; error?: string }) => { log: string; hinweis: string } | null;
};
const fehler = (): Fehler => (rec.getState() as unknown as { fehler?: Fehler }).fehler;
const spuren = (): unknown => (rec.getState() as unknown as { spuren?: unknown }).spuren;
const protokoll: string[] = [];
R.setProtokoll?.((z) => void protokoll.push(z));
const gesendet: Array<[string, unknown]> = [];
rec.setWindowGetter(() => ({ isDestroyed: () => false, webContents: { isDestroyed: () => false, send: (k: string, p: unknown) => void gesendet.push([k, p]) } }) as never);
const meldungen = (): unknown[] => gesendet.filter(([k]) => k === 'recorder:notice').map(([, p]) => p);
const { MultiWavWriter, WavWriter } = await import('../src/main/wav');
const ENOSPC = (): never => {
  throw Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' });
};
const GRUND = 'ENOSPC: no space left on device, write';
const echtBlock = WavWriter.prototype.writeBlock;
const echtSpur = MultiWavWriter.prototype.writeBlock;
const echtKopf = WavWriter.prototype.finalize;
const zehn = (): void => aufFrames?.(new Float32Array(2 * 10), 2, 10);
const dateiGroesse = (p: string): number => readFileSync(p).length;
/** Nach jedem Fall: eine noch laufende Aufnahme stoppen und den Eingang schließen (vor der Änderung bleibt sie sonst stehen). */
const aufraeumen = (): void => {
  if (rec.getState().status === 'recording') rec.stopRecording();
  if (rec.getState().status !== 'idle') rec.schliesseEingang();
};

{
  const T = R.AUFNAHME_FEHLER_TEXTE;
  const ist = JSON.stringify([T?.schreiben('D:\\a.wav', 'ENOSPC'), T?.kopf('D:\\a.wav', 'EIO'), T?.eingang, T?.eingangGrund, T?.log('schreiben', 'D:\\a.wav', 'ENOSPC')]);
  const soll = JSON.stringify([
    'Aufnahme beendet: Schreibfehler in „D:\\a.wav“: ENOSPC. Das bisher Aufgenommene ist gespeichert.',
    'Aufnahme beendet: Der Dateikopf von „D:\\a.wav“ konnte nicht geschrieben werden: EIO.',
    'Aufnahme beendet: Vom Eingang kamen 2 s lang keine Audiodaten. Das bisher Aufgenommene ist gespeichert.',
    'Keine Audiodaten vom Eingang',
    'Aufnahme beendet (schreiben): D:\\a.wav: ENOSPC',
  ]);
  ck(`RE-3 Texte: AUFNAHME_FEHLER_TEXTE wörtlich wie im Plan (${ist})`, ist === soll);
}

// Schreibfehler im Block: wirft nicht bis ins Addon, die Aufnahme endet sauber.
{
  ck('RE-3 Block: arm', rec.arm({ device: 0, channels: 2, sampleRate: 48000 }).ok);
  ck('RE-3 Block: start', rec.startRecording({ dir, fileName: 'Voll' }).ok);
  const datei = join(dir, 'Voll.wav');
  zehn();
  protokoll.length = 0;
  gesendet.length = 0;
  WavWriter.prototype.writeBlock = ENOSPC;
  let wurf: unknown = null;
  try {
    zehn();
  } catch (e) {
    wurf = e;
  } finally {
    WavWriter.prototype.writeBlock = echtBlock;
  }
  ck(`RE-3 Schreibfehler im Block wirft nicht (${wurf === null ? 'kein Wurf' : (wurf as Error).message})`, wurf === null);
  const s = rec.getState();
  const f = fehler();
  ck(`RE-3 Zustand nach Schreibfehler: status armed (${s.status})`, s.status === 'armed');
  ck(`RE-3 Zustand nach Schreibfehler: fehler.art schreiben, der Text nennt ENOSPC, die Datei (${JSON.stringify(f)})`, f?.art === 'schreiben' && f.text.includes('ENOSPC') && f.datei === datei);
  ck('RE-3 Zustand nach Schreibfehler: filePath bleibt', s.filePath === datei);
  ck(`RE-3 Zustand nach Schreibfehler: der Kopf trägt die 10 Frames vor dem Fehler (${dataLaenge(datei)})`, dataLaenge(datei) === 80);
  ck(`RE-3 Zustand nach Schreibfehler: genau eine Logzeile „Aufnahme beendet (schreiben): …“ (${JSON.stringify(protokoll)})`, protokoll.length === 1 && protokoll[0] === `Aufnahme beendet (schreiben): ${datei}: ${GRUND}`);
  ck(
    `RE-3 Zustand nach Schreibfehler: die Meldung bis „OK“ nennt Datei und Grund (${JSON.stringify(meldungen())})`,
    JSON.stringify(meldungen()) === JSON.stringify([`Aufnahme beendet: Schreibfehler in „${datei}“: ${GRUND}. Das bisher Aufgenommene ist gespeichert.`]),
  );
  const zustaende = gesendet.filter(([k]) => k === 'recorder:state').map(([, p]) => p as { status: string; fehler?: Fehler });
  ck('RE-3 Zustand nach Schreibfehler: der Zustand geht mit armed und Fehlerfeld ans Fenster', zustaende.at(-1)?.status === 'armed' && zustaende.at(-1)?.fehler?.art === 'schreiben');
  zehn();
  ck(`RE-3 Zustand nach Schreibfehler: weitere Blöcke schreiben nichts mehr (${dataLaenge(datei)} Byte im Kopf, ${dateiGroesse(datei)} Byte Datei)`, dataLaenge(datei) === 80 && dateiGroesse(datei) === 44 + 80 && protokoll.length === 1);

  // Pre-flight K7: arm löscht das Fehlerfeld nicht (auch nicht das Neuöffnen eines Presets, das über arm läuft).
  const a = rec.arm({ device: 0, channels: 2, sampleRate: 48000 });
  ck(`RE-3 K7 arm löscht fehler nicht (${JSON.stringify(fehler())})`, a.ok && rec.getState().status === 'armed' && fehler()?.art === 'schreiben');
  // Pre-flight K7: der Stopp im Fehlerzustand ist eine Quittung.
  const q = rec.stopRecording();
  ck(`RE-3 Stopp im Fehlerzustand quittiert: ok true, ohne Datei, fehler null (${JSON.stringify(q)}, ${JSON.stringify(fehler())})`, q.ok === true && q.filePath === undefined && fehler() === null && rec.getState().status === 'armed');
  const q2 = rec.stopRecording();
  ck('RE-3 Stopp ohne Fehler und ohne Aufnahme bleibt „Keine laufende Aufnahme.“', q2.ok === false && q2.error === 'Keine laufende Aufnahme.');
}

// Gescheiterter Start setzt das Fehlerfeld (art start), ein gelungener Start löscht es (K7); RE-PLATZ: `spuren` im Zustand.
{
  const r = rec.startRecording({ dir: join(dir, 'Tag.wav'), fileName: 'Nie' });
  const f = fehler();
  ck(`RE-3 gescheiterter Start setzt fehler (art start, Text der Meldung, keine Datei) (${JSON.stringify(f)})`, r.ok === false && f?.art === 'start' && f.text === r.error && f.datei === null && rec.getState().status === 'armed');
  ck('RE-3 Neustart: start mit Spuren', rec.startRecording({ dir, fileName: 'Spur', separateTracks: true }).ok);
  ck(`RE-3 Neustart löscht fehler (${JSON.stringify(fehler())})`, fehler() === null);
  ck(`RE-PLATZ spuren: mit „Spuren einzeln“ und 2 Kanälen true (${String(spuren())})`, spuren() === true);
  zehn();
  protokoll.length = 0;
  MultiWavWriter.prototype.writeBlock = ENOSPC;
  let wurf: unknown = null;
  try {
    zehn();
  } catch (e) {
    wurf = e;
  } finally {
    MultiWavWriter.prototype.writeBlock = echtSpur;
  }
  const kombi = join(dir, 'Spur.wav');
  const f2 = fehler();
  ck(`RE-3 Spurfehler: wirft nicht, status armed, fehler.art schreiben mit ENOSPC (${JSON.stringify(f2)})`, wurf === null && rec.getState().status === 'armed' && f2?.art === 'schreiben' && f2.text.includes('ENOSPC'));
  ck(`RE-3 Spurfehler: der Kopf der Kombidatei trägt, was in ihr steht (${dataLaenge(kombi)} + 44 = ${dateiGroesse(kombi)})`, dataLaenge(kombi) + 44 === dateiGroesse(kombi) && protokoll.length === 1);
  ck('RE-3 Spurfehler: Neustart ohne Spuren', rec.startRecording({ dir, fileName: 'OhneSpur' }).ok);
  ck(`RE-PLATZ spuren: ohne „Spuren einzeln“ false (${String(spuren())})`, spuren() === false);
  ck('RE-3 Spurfehler: Stopp', rec.stopRecording().ok);
  // Pre-flight K7: „Eingang schließen“ des Bedieners löscht das Fehlerfeld.
  ck('RE-3 K7: start', rec.startRecording({ dir, fileName: 'Zu' }).ok);
  WavWriter.prototype.writeBlock = ENOSPC;
  try {
    zehn();
  } catch {
    // vor der Änderung wirft der Block bis hierher
  } finally {
    WavWriter.prototype.writeBlock = echtBlock;
  }
  ck('RE-3 K7: Fehler gesetzt', fehler()?.art === 'schreiben');
  const z = rec.schliesseEingang();
  ck(`RE-3 K7 Eingang schließen (schliesseEingang) löscht fehler (${JSON.stringify(fehler())})`, z.ok && rec.getState().status === 'idle' && fehler() === null);
}

// Stille-Schreibfehler im Wächter (Loopback, Gerät 5): derselbe Weg wie ein Schreibfehler im Block.
{
  ck('RE-3 Stille: arm Loopback', rec.arm({ device: 5, channels: 2, sampleRate: 1000 }).ok);
  ck('RE-3 Stille: start', rec.startRecording({ dir, fileName: 'StilleVoll' }).ok);
  zehn();
  protokoll.length = 0;
  WavWriter.prototype.writeBlock = ENOSPC;
  try {
    await warte(450); // keine Blöcke: der Wächter füllt Stille auf und scheitert
  } finally {
    WavWriter.prototype.writeBlock = echtBlock;
  }
  const f = fehler();
  ck(`RE-3 Stille-Schreibfehler (Loopback, Gerät 5): fehler gesetzt, status armed (${rec.getState().status}, ${JSON.stringify(f)})`, rec.getState().status === 'armed' && f?.art === 'schreiben' && f.text.includes('ENOSPC'));
  ck(`RE-3 Stille-Schreibfehler: eine Logzeile, nicht je Takt (${protokoll.length})`, protokoll.length === 1);
  aufraeumen();
}

// Kopf beim Stopp nicht schreibbar.
{
  ck('RE-3 Kopf: arm', rec.arm({ device: 0, channels: 2, sampleRate: 48000 }).ok);
  ck('RE-3 Kopf: start', rec.startRecording({ dir, fileName: 'Kopf' }).ok);
  zehn();
  protokoll.length = 0;
  gesendet.length = 0;
  WavWriter.prototype.finalize = ENOSPC;
  let r: { ok: boolean; error?: string } = { ok: true };
  try {
    r = rec.stopRecording();
  } finally {
    WavWriter.prototype.finalize = echtKopf;
  }
  const datei = join(dir, 'Kopf.wav');
  const f = fehler();
  ck(`RE-3 Kopf beim Stopp nicht schreibbar: ok false, fehler gesetzt (art schreiben), status armed (${JSON.stringify(r)}, ${JSON.stringify(f)})`, r.ok === false && f?.art === 'schreiben' && f.text.includes('ENOSPC') && rec.getState().status === 'armed');
  ck(
    `RE-3 Kopf beim Stopp nicht schreibbar: Meldung „Der Dateikopf … konnte nicht geschrieben werden“ und eine Logzeile (${JSON.stringify(meldungen())})`,
    JSON.stringify(meldungen()) === JSON.stringify([`Aufnahme beendet: Der Dateikopf von „${datei}“ konnte nicht geschrieben werden: ${GRUND}.`]) && protokoll.length === 1,
  );
  aufraeumen();
}

// Schreibfehler im Block, und auch der Kopf lässt sich danach nicht schreiben: die Meldung behauptet nicht „gespeichert“.
{
  ck('RE-3 Block und Kopf: arm', rec.arm({ device: 0, channels: 2, sampleRate: 48000 }).ok);
  ck('RE-3 Block und Kopf: start', rec.startRecording({ dir, fileName: 'Doppelt' }).ok);
  zehn();
  gesendet.length = 0;
  WavWriter.prototype.writeBlock = ENOSPC;
  WavWriter.prototype.finalize = (): never => {
    throw new Error('EIO: i/o error, write');
  };
  try {
    zehn();
  } catch {
    // vor der Änderung wirft der Block bis hierher
  } finally {
    WavWriter.prototype.writeBlock = echtBlock;
    WavWriter.prototype.finalize = echtKopf;
  }
  const datei = join(dir, 'Doppelt.wav');
  ck(
    `RE-3 Block und Kopf: scheitert auch der Kopf, nennt die Meldung ihn statt „gespeichert“; das Fehlerfeld behält den ersten Grund (${JSON.stringify(meldungen())}, ${JSON.stringify(fehler())})`,
    JSON.stringify(meldungen()) === JSON.stringify([`Aufnahme beendet: Der Dateikopf von „${datei}“ konnte nicht geschrieben werden: EIO: i/o error, write.`]) && fehler()?.text === GRUND && rec.getState().status === 'armed',
  );
  aufraeumen();
}

// Ein Schreibfehler löscht den geplanten Stopp (D3).
{
  ck('RE-3 Plan: arm', rec.arm({ device: 0, channels: 2, sampleRate: 48000 }).ok);
  ck('RE-3 Plan: schedule mit Dauer', rec.schedule({ dir, fileName: 'Plan', separateTracks: false, startAt: null, stopAt: Date.now() + 5000 }).ok);
  ck('RE-3 Plan: Aufnahme läuft mit geplantem Stopp', rec.getState().status === 'recording' && typeof rec.getState().scheduledStopAt === 'number');
  zehn();
  WavWriter.prototype.writeBlock = ENOSPC;
  try {
    zehn();
  } catch {
    // vor der Änderung wirft der Block bis hierher
  } finally {
    WavWriter.prototype.writeBlock = echtBlock;
  }
  ck(`RE-3 Schreibfehler löscht den geplanten Stopp (scheduledStopAt ${String(rec.getState().scheduledStopAt)})`, rec.getState().scheduledStopAt === null && rec.getState().status === 'armed');
  aufraeumen();
}

// B1: 2 s ohne Block an einem Eingang, der kein Loopback ist; Zeit über ein umgelegtes Date.now, der Block-Wächter von Hand gerufen.
{
  const echtNow = Date.now;
  let uhr = echtNow();
  Date.now = () => uhr;
  try {
    const blockWaechter = (vor: number): Array<() => void> => intervalle.slice(vor).filter((i) => i.ms === 250).map((i) => i.fn);
    ck('RE-3 Block-Wächter: arm Gerät 0', rec.arm({ device: 0, channels: 2, sampleRate: 48000 }).ok);
    let vor = intervalle.length;
    ck('RE-3 Block-Wächter: start', rec.startRecording({ dir, fileName: 'Stumm' }).ok);
    const w = blockWaechter(vor);
    ck(`RE-3 kein Block 2 s: in der Aufnahme läuft ein Block-Wächter im Takt 250 ms (${w.length})`, w.length === 1);
    zehn();
    protokoll.length = 0;
    gesendet.length = 0;
    const t0 = uhr;
    let erstFehler: number | null = null;
    for (let t = 250; t <= 2250; t += 250) {
      uhr = t0 + t;
      w[0]?.();
      if (erstFehler === null && fehler()) erstFehler = t;
    }
    const datei = join(dir, 'Stumm.wav');
    const f = fehler();
    ck(`RE-3 kein Block 2 s (Gerät 0): status armed, fehler.art eingang mit „Keine Audiodaten vom Eingang“ (${rec.getState().status}, ${JSON.stringify(f)})`, rec.getState().status === 'armed' && f?.art === 'eingang' && f.text === 'Keine Audiodaten vom Eingang' && f.datei === datei);
    ck(`RE-3 kein Block 2 s: der Fehler kommt bei +2000 ms, nicht früher (${erstFehler})`, erstFehler === 2000);
    ck(`RE-3 kein Block 2 s: der Kopf trägt die 10 Frames (${dataLaenge(datei)})`, dataLaenge(datei) === 80);
    ck(
      `RE-3 kein Block 2 s: Meldung und Logzeile (${JSON.stringify(meldungen())}, ${JSON.stringify(protokoll)})`,
      JSON.stringify(meldungen()) === JSON.stringify(['Aufnahme beendet: Vom Eingang kamen 2 s lang keine Audiodaten. Das bisher Aufgenommene ist gespeichert.']) &&
        JSON.stringify(protokoll) === JSON.stringify([`Aufnahme beendet (eingang): ${datei}: Keine Audiodaten vom Eingang`]),
    );
    aufraeumen();

    // Die Ereignisschleife hing: der erste Takt kommt erst nach 2,1 s. Das ist ein Stau, kein Geräteverlust; die Grundlinie beginnt neu.
    ck('RE-3 Stau: arm', rec.arm({ device: 0, channels: 2, sampleRate: 48000 }).ok);
    vor = intervalle.length;
    ck('RE-3 Stau: start', rec.startRecording({ dir, fileName: 'Hing' }).ok);
    const w2 = blockWaechter(vor);
    zehn();
    uhr += 2100;
    w2[0]?.();
    const nachStau = { status: rec.getState().status, fehler: fehler() };
    uhr += 250;
    w2[0]?.();
    ck(
      `RE-3 Ereignisschleife hing: ein Takt erst nach +2100 → kein fehler, status recording, auch im Takt danach (${JSON.stringify(nachStau)}, ${rec.getState().status})`,
      w2.length === 1 && nachStau.status === 'recording' && nachStau.fehler === null && rec.getState().status === 'recording' && fehler() === null,
    );
    ck('RE-3 Stau: Stopp', rec.stopRecording().ok);
    aufraeumen();

    // Loopback hat seinen Stille-Wächter; in Stille kommen dort keine Blöcke, ein Block-Wächter wäre falsch.
    ck('RE-3 Loopback: arm Gerät 5', rec.arm({ device: 5, channels: 2, sampleRate: 1000 }).ok);
    vor = intervalle.length;
    ck('RE-3 Loopback: start', rec.startRecording({ dir, fileName: 'LoopOhne' }).ok);
    ck(`RE-3 Loopback ohne Block-Wächter (Gerät 5): kein neuer Takt von 250 ms (${blockWaechter(vor).length})`, blockWaechter(vor).length === 0);
    ck('RE-3 Loopback: Stopp', rec.stopRecording().ok);
    aufraeumen();

    // Fix-Runde 1 (Ruling R18a): war das letzte Ereignis vor dem Hängen ein Takt des Wächters (100 ms nach dem Block), kommt der nächste Takt
    // nach 1950 ms: das ist ein Stau (mehr als zwei Takte), kein Geräteverlust, auch wenn seit dem Block 2050 ms vergangen sind.
    ck('RE-3 R18a: arm', rec.arm({ device: 0, channels: 2, sampleRate: 48000 }).ok);
    vor = intervalle.length;
    ck('RE-3 R18a: start', rec.startRecording({ dir, fileName: 'TaktVorStau' }).ok);
    const w3 = blockWaechter(vor);
    zehn();
    const t3 = uhr;
    uhr = t3 + 100;
    w3[0]?.();
    uhr = t3 + 2050;
    w3[0]?.();
    ck(
      `RE-3 R18a Ereignisschleife hing nach einem Takt: kein falscher Alarm, die Aufnahme läuft (${rec.getState().status}, ${JSON.stringify(fehler())})`,
      w3.length === 1 && rec.getState().status === 'recording' && fehler() === null,
    );
    uhr = t3 + 2300;
    w3[0]?.();
    ck(`RE-3 R18a: nach dem Stau gilt die neue Grundlinie, im Takt danach weiter kein Fehler (${rec.getState().status})`, rec.getState().status === 'recording' && fehler() === null);
    ck('RE-3 R18a: Stopp', rec.stopRecording().ok);
    aufraeumen();
  } finally {
    Date.now = echtNow;
  }
}

// Fix-Runde 1 (Ruling R18b): der Kopf der Spuren lässt sich beim Stopp nicht schreiben, die Kombidatei ist abgeschlossen. Die Meldung nennt
// den Ordner der Spuren (nicht die Kombidatei), die Spuren werden genau einmal abgeschlossen.
// Fix-Runde 2 (Ruling R21, Test umgestellt): bisher verschluckte MultiWavWriter.finalize den Fehler einer Spur, darum schlug der Test die
// Attrappe am ganzen MultiWavWriter ein. Jetzt scheitert der Kopf einer echten Spur (Spur01): die übrigen Spuren werden trotzdem
// abgeschlossen, Meldung, Log und Fehlerfeld nennen die Datei dieser Spur, nicht den Ordner.
{
  ck('RE-3 R18b: arm', rec.arm({ device: 0, channels: 2, sampleRate: 48000 }).ok);
  ck('RE-3 R18b: start mit Spuren', rec.startRecording({ dir, fileName: 'SpurKopf', separateTracks: true }).ok);
  zehn();
  protokoll.length = 0;
  gesendet.length = 0;
  const versucht: Record<string, number> = {};
  WavWriter.prototype.finalize = function (this: InstanceType<typeof WavWriter>): ReturnType<InstanceType<typeof WavWriter>['finalize']> {
    const datei = (this as unknown as { files: string[] }).files[0];
    versucht[datei] = (versucht[datei] ?? 0) + 1;
    const r = echtKopf.call(this);
    if (datei.endsWith('-Spur01.wav')) throw new Error('EIO: i/o error, write');
    return r;
  };
  let r: { ok: boolean; error?: string } = { ok: true };
  try {
    r = rec.stopRecording();
  } finally {
    WavWriter.prototype.finalize = echtKopf;
  }
  const kombi = join(dir, 'SpurKopf.wav');
  const spuren = join(dir, 'SpurKopf-Spuren');
  const spur1 = join(spuren, 'SpurKopf-Spur01.wav');
  const spur2 = join(spuren, 'SpurKopf-Spur02.wav');
  ck(
    `RE-3 R21 Kopf einer Spur nicht schreibbar: die Meldung nennt die Datei dieser Spur, das Fehlerfeld auch (${JSON.stringify(meldungen())}, ${JSON.stringify(fehler())})`,
    r.ok === false &&
      JSON.stringify(meldungen()) === JSON.stringify([`Aufnahme beendet: Der Dateikopf von „${spur1}“ konnte nicht geschrieben werden: EIO: i/o error, write.`]) &&
      fehler()?.datei === spur1 && fehler()?.art === 'schreiben' && rec.getState().status === 'armed',
  );
  ck(
    `RE-3 R18b/R21: jede Spur und die Kombidatei werden genau einmal abgeschlossen (${JSON.stringify(versucht)}), Spur02 trägt ihren Kopf (${dataLaenge(spur2)}), die Kombidatei auch (${dataLaenge(kombi)})`,
    versucht[kombi] === 1 && versucht[spur1] === 1 && versucht[spur2] === 1 && Object.keys(versucht).length === 3 && dataLaenge(spur2) === 40 && dataLaenge(kombi) === 80,
  );
  ck(`RE-3 R21: eine Logzeile mit der Datei der Spur (${JSON.stringify(protokoll)})`, protokoll.length === 1 && protokoll[0] === `Aufnahme beendet (schreiben): ${spur1}: EIO: i/o error, write`);
  aufraeumen();
}

// --- Altfehler RE-2, Ruling R11 (Task 7): lehnt der Wächter im Hauptprozess ARM oder DISARM im Wettlauf ab, nennt wettlaufAblehnung
// Logzeile und Hinweis wie die Ablehnung im Store (main/ipc.ts schreibt die Zeile mit getLog().warn und zeigt den Hinweis bis „OK“).
{
  const w = R.wettlaufAblehnung;
  ck('RE-2 R11 wettlaufAblehnung gibt es', typeof w === 'function');
  ck('RE-2 R11: arm', rec.arm({ device: 0, channels: 2, sampleRate: 48000 }).ok);
  ck('RE-2 R11: start', rec.startRecording({ dir, fileName: 'Wettlauf' }).ok);
  const ist = JSON.stringify([w?.('ARM', rec.arm({ device: 0, channels: 2, sampleRate: 48000 })), w?.('DISARM', rec.schliesseEingang())]);
  const soll = JSON.stringify([
    { log: 'Fernbefehl abgelehnt: ARM (Aufnahme läuft)', hinweis: 'Companion „ARM“ abgelehnt: Erst die Aufnahme stoppen.' },
    { log: 'Fernbefehl abgelehnt: DISARM (Aufnahme läuft)', hinweis: 'Companion „DISARM“ abgelehnt: Erst die Aufnahme stoppen.' },
  ]);
  ck(`RE-2 R11 wettlaufAblehnung: ARM und DISARM in der Aufnahme mit dem Text der Store-Ablehnung (${ist})`, ist === soll);
  ck(
    'RE-2 R11 wettlaufAblehnung: ein gelungener Aufruf und ein anderer Fehler sind keine Ablehnung im Wettlauf',
    w?.('ARM', { ok: true }) === null && w?.('ARM', { ok: false, error: 'Gerät belegt' }) === null && w?.('DISARM', { ok: false }) === null,
  );
  ck('RE-2 R11: Stopp', rec.stopRecording().ok);
  aufraeumen();
}

console.log(`\nrecorder: ${pass} ok, ${fail} FAIL`);
if (fail) process.exit(1);

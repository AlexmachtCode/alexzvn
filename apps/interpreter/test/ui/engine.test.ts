// Altfehler IN-3 (Stufe 2, C4, D6): Die Engine nimmt nur einen Start zur Zeit an. Ein zweiter Aufruf während des ersten wird
// verworfen, statt den halben ersten Start abzureißen; ein Start ohne Antwort gilt nach der Frist als gescheitert (Fehlertext, Sperre
// frei, der halbe Start ist aufgeräumt), und ein Eingang, der erst danach antwortet, wird sofort wieder geschlossen. Gegen
// Schein-Web-Audio: AudioContext, Audio und navigator.mediaDevices.getUserMedia (zurückhaltbar), dazu setInterval/clearInterval mit
// Buchführung, damit ein liegengebliebener Regeltakt als Fehler zählt und den Lauf nicht offen hält. Die Attrappen nimmt der Test am
// Ende zurück (Vorbild apps/player/test/ui/show-audio.test.ts).
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { InterpreterEngine, START_FRIST_MS, START_FRIST_TEXT, type Devices } from '@/core/engine';
import { ohneKommentare } from './testzustand';

type Global = { AudioContext?: unknown; Audio?: unknown; setInterval: typeof setInterval; clearInterval: typeof clearInterval };
const g = globalThis as unknown as Global;
const vorher = { AudioContext: g.AudioContext, Audio: g.Audio, setInterval: g.setInterval, clearInterval: g.clearInterval, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };

const D: Devices = { floorId: 'mic-a', interpreterId: 'mic-b', outputId: 'cable-in' };
const warte = (ms = 0): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function bis(bed: () => boolean, ms = 1000): Promise<boolean> {
  const t0 = Date.now();
  while (!bed()) {
    if (Date.now() - t0 > ms) return false;
    await warte(1);
  }
  return true;
}

// ── Zähler der Attrappen (je Fall zurückgesetzt) ──
const zahl = { kontexte: 0, close: 0, resume: 0, play: 0, pause: 0, sink: 0 };
interface Spur {
  stops: number;
  stop(): void;
}
const gum = {
  modus: 'sofort' as 'sofort' | 'halten' | 'ablehnen',
  aufrufe: 0,
  wartend: [] as Array<{ aufloesen: () => void; ablehnen: (e: Error) => void; spur: Spur }>,
  /** Lässt die zurückgehaltenen Aufrufe antworten; danach antwortet jeder Aufruf sofort. */
  freigeben(): void {
    this.modus = 'sofort';
    for (const w of this.wartend.splice(0)) w.aufloesen();
  },
};
/** setSinkId der Schein-Ausgabe: sofort oder zurückgehalten. */
const sink = {
  modus: 'sofort' as 'sofort' | 'halten',
  wartend: [] as Array<() => void>,
  freigeben(): void {
    this.modus = 'sofort';
    for (const w of this.wartend.splice(0)) w();
  },
};
/** Neuer Fall: Zähler auf 0; ein Regeltakt, den der vorige Fall liegen ließ (dort schon als Fehler gezählt), wird beendet. */
function neu(): void {
  for (const k of Object.keys(zahl) as Array<keyof typeof zahl>) zahl[k] = 0;
  gum.modus = 'sofort';
  gum.aufrufe = 0;
  gum.wartend = [];
  sink.modus = 'sofort';
  sink.wartend = [];
  for (const id of takte) vorher.clearInterval(id as Parameters<typeof clearInterval>[0]);
  takte.clear();
}

const knoten = (): Record<string, unknown> => ({ connect: <T>(z: T): T => z });
class ScheinKontext {
  currentTime = 0;
  constructor() {
    zahl.kontexte++;
  }
  createGain(): unknown {
    return { ...knoten(), gain: { value: 1, setTargetAtTime() {} } };
  }
  createAnalyser(): unknown {
    return { ...knoten(), fftSize: 2048, getFloatTimeDomainData: (b: Float32Array) => b.fill(0) };
  }
  createMediaStreamDestination(): unknown {
    return { ...knoten(), stream: {} };
  }
  createMediaStreamSource(): unknown {
    return knoten();
  }
  async resume(): Promise<void> {
    zahl.resume++;
  }
  async close(): Promise<void> {
    zahl.close++;
  }
}
class ScheinAudio {
  srcObject: unknown = null;
  autoplay = false;
  async play(): Promise<void> {
    zahl.play++;
  }
  pause(): void {
    zahl.pause++;
  }
  setSinkId(): Promise<void> {
    zahl.sink++;
    if (sink.modus === 'halten') return new Promise((r) => sink.wartend.push(() => r()));
    return Promise.resolve();
  }
}
function getUserMedia(): Promise<unknown> {
  gum.aufrufe++;
  const spur: Spur = {
    stops: 0,
    stop() {
      this.stops++;
    },
  };
  const strom = { getTracks: () => [spur] };
  if (gum.modus === 'ablehnen') return Promise.reject(new Error('Permission denied'));
  if (gum.modus === 'halten') return new Promise((r, f) => gum.wartend.push({ aufloesen: () => r(strom), ablehnen: (e) => f(e), spur }));
  return Promise.resolve(strom);
}

/** Regeltakte der Engine (setInterval), die noch laufen. */
const takte = new Set<unknown>();
g.AudioContext = ScheinKontext;
g.Audio = ScheinAudio;
g.setInterval = ((f: () => void, ms?: number) => {
  const id = vorher.setInterval(f, ms);
  takte.add(id);
  return id;
}) as typeof setInterval;
g.clearInterval = ((id: Parameters<typeof clearInterval>[0]) => {
  takte.delete(id);
  vorher.clearInterval(id);
}) as typeof clearInterval;
Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: { mediaDevices: { getUserMedia, enumerateDevices: async () => [] } } });

try {
  gleich([START_FRIST_MS, START_FRIST_TEXT], [15000, 'Start abgebrochen: keine Antwort der Geräte.'], 'IN-3 Frist: 15 s (C4), Fehlertext als Konstante der Engine (D6)');
  ok(ohneKommentare(leseText('src/renderer/src/core/engine.ts')).includes('constructor(startFristMs: number = START_FRIST_MS)'), 'IN-3 Frist: ohne Wert gilt START_FRIST_MS (die Wurzel-View baut die Engine ohne Wert)');

  // ── Zweiter Start während des ersten ──
  {
    neu();
    gum.modus = 'halten';
    const e = new InterpreterEngine();
    void e.start(D);
    void e.start(D);
    await warte();
    const mitten = { getUserMedia: gum.aufrufe, close: zahl.close, kontexte: zahl.kontexte, starting: e.getState().starting, running: e.getState().running };
    gum.freigeben();
    const gelaufen = await bis(() => e.getState().running);
    await warte(5);
    const s = e.getState();
    gleich(mitten, { getUserMedia: 1, close: 0, kontexte: 1, starting: true, running: false }, 'IN-3 zweiter Start während des ersten wird verworfen: getUserMedia 1×, kein close, ein Kontext, starting an');
    gleich(
      { gelaufen, running: s.running, starting: s.starting, error: s.error, getUserMedia: gum.aufrufe, kontexte: zahl.kontexte, close: zahl.close, takte: takte.size },
      { gelaufen: true, running: true, starting: false, error: null, getUserMedia: 2, kontexte: 1, close: 0, takte: 1 },
      'IN-3 zweiter Start während des ersten wird verworfen: nach der Freigabe läuft der erste Start durch (running, starting aus, getUserMedia 2×, ein Regeltakt)',
    );
    await e.stop();
    gleich(takte.size, 0, 'IN-3 zweiter Start während des ersten wird verworfen: nach stop() läuft kein Regeltakt mehr');
  }

  // ── Frist: ein Start ohne Antwort bricht ab; danach geht ein neuer Start ──
  {
    neu();
    gum.modus = 'halten';
    const e = new InterpreterEngine(30);
    const meldungen: boolean[] = [];
    e.subscribe(() => meldungen.push(e.getState().starting));
    void e.start(D);
    await warte(60);
    const s = e.getState();
    gleich(
      { starting: s.starting, running: s.running, error: s.error, closeMindestensEinmal: zahl.close >= 1, startingGemeldet: meldungen.includes(true) && meldungen.at(-1) === false },
      { starting: false, running: false, error: START_FRIST_TEXT, closeMindestensEinmal: true, startingGemeldet: true },
      'IN-3 Frist: Start ohne Antwort bricht ab (starting aus, running aus, Fehlertext der Frist, Kontext geschlossen)',
    );
    const spaet = gum.wartend.map((w) => w.spur);
    gum.freigeben();
    await warte(10);
    gleich(
      { zurueckgehalten: spaet.length, gestoppt: spaet.map((x) => x.stops), running: e.getState().running, starting: e.getState().starting, error: e.getState().error, getUserMedia: gum.aufrufe, takte: takte.size },
      { zurueckgehalten: 1, gestoppt: [1], running: false, starting: false, error: START_FRIST_TEXT, getUserMedia: 1, takte: 0 },
      'IN-3 Frist: antwortet der zurückgehaltene Eingang danach, wird seine Spur 1× gestoppt; running bleibt aus, kein Regeltakt',
    );
    await e.start(D);
    const n = e.getState();
    gleich({ running: n.running, starting: n.starting, error: n.error, takte: takte.size }, { running: true, starting: false, error: null, takte: 1 }, 'IN-3 nach der Frist geht ein neuer Start (running, Fehler gelöscht)');
    await e.stop();
    gleich(takte.size, 0, 'IN-3 nach der Frist geht ein neuer Start: nach stop() läuft kein Regeltakt mehr');
  }

  // ── Frist im Ausgabeweg: ein setSinkId, das erst nach der Frist antwortet, hängt kein Element ein ──
  {
    neu();
    sink.modus = 'halten';
    const e = new InterpreterEngine(30);
    void e.start(D);
    await warte(60);
    const s = e.getState();
    sink.freigeben();
    await warte(10);
    gleich(
      { error: s.error, running: e.getState().running, setSinkId: zahl.sink, play: zahl.play, pause: zahl.pause, takte: takte.size },
      { error: START_FRIST_TEXT, running: false, setSinkId: 1, play: 0, pause: 1, takte: 0 },
      'IN-3 Frist im Ausgabeweg: antwortet setSinkId erst nach der Frist, spielt das Element nie und wird angehalten; running bleibt aus',
    );
    await e.start(D);
    await e.stop();
    gleich({ play: zahl.play, pause: zahl.pause, takte: takte.size }, { play: 1, pause: 2, takte: 0 }, 'IN-3 Frist im Ausgabeweg: der nächste Start spielt sein eigenes Element, stop() hält genau dieses an');
  }

  // ── Frist: ein später Fehler des veralteten Laufs trifft den neuen Start nicht ──
  {
    neu();
    gum.modus = 'halten';
    const e = new InterpreterEngine(30);
    void e.start(D);
    await warte(60);
    const alt = gum.wartend.splice(0);
    gum.modus = 'sofort';
    await e.start(D);
    for (const w of alt) w.ablehnen(new Error('Permission denied'));
    await warte(10);
    const s = e.getState();
    gleich(
      { veraltet: alt.length, running: s.running, starting: s.starting, error: s.error, takte: takte.size },
      { veraltet: 1, running: true, starting: false, error: null, takte: 1 },
      'IN-3 Frist: ein Fehler des veralteten Laufs nach der Frist stoppt den neuen Start nicht und meldet nichts',
    );
    await e.stop();
  }

  // ── Review Focus 3: ein Start, der scheitert, gibt die Sperre frei ──
  {
    neu();
    gum.modus = 'ablehnen';
    const e = new InterpreterEngine();
    await e.start(D);
    const s = e.getState();
    gleich({ starting: s.starting, running: s.running, error: s.error, takte: takte.size }, { starting: false, running: false, error: 'Permission denied', takte: 0 }, 'IN-3 Start scheitert: Sperre frei, running aus, die rohe Meldung steht');
    gum.modus = 'sofort';
    await e.start(D);
    const n = e.getState();
    gleich({ running: n.running, starting: n.starting, error: n.error }, { running: true, starting: false, error: null }, 'IN-3 Start scheitert: Sperre frei, nächster Start geht');
    await e.stop();
  }
} finally {
  for (const id of takte) vorher.clearInterval(id as Parameters<typeof clearInterval>[0]);
  takte.clear();
  g.AudioContext = vorher.AudioContext;
  g.Audio = vorher.Audio;
  g.setInterval = vorher.setInterval;
  g.clearInterval = vorher.clearInterval;
  if (vorher.navigator) Object.defineProperty(globalThis, 'navigator', vorher.navigator);
  else delete (globalThis as { navigator?: unknown }).navigator;
}

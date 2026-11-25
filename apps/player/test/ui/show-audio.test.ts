// Altfehler PL-T14: Die Tonmaschine der Show wirft für einen Cue, der nicht lädt, einen Fehler mit Grund (Datei oder Format), statt
// still mit leerem Puffer zu enden. Gegen einen Schein-fetch und einen Schein-AudioContext; die Attrappen nimmt der Test am Ende zurück.
import { gleich, ok } from '@jm/ui/testhilfe';
import { SHOW_AUDIO_GRUND, showAudio } from '@/lib/show-audio';
import { showCue } from './testzustand';

type Global = { AudioContext?: unknown; fetch?: unknown };
const g = globalThis as unknown as Global;
const vorher = { AudioContext: g.AudioContext, fetch: g.fetch };

let abrufe = 0;
let antwort: () => Promise<unknown> = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
let dekodieren: () => Promise<unknown> = async () => ({ duration: 1 });

class ScheinKontext {
  state = 'running';
  currentTime = 0;
  destination = {};
  decodeAudioData(): Promise<unknown> {
    return dekodieren();
  }
  createBufferSource(): unknown {
    return { connect: <T>(z: T): T => z, start() {}, stop() {}, onended: null, buffer: null, loop: false };
  }
  createGain(): unknown {
    const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 1 };
    return { gain: param, connect: <T>(z: T): T => z };
  }
  async resume(): Promise<void> {}
  async suspend(): Promise<void> {}
}
g.AudioContext = ScheinKontext;
g.fetch = (async () => {
  abrufe++;
  return antwort();
}) as unknown;

/** Der Grund, mit dem ein Versprechen abgelehnt wird; null, wenn es gelingt. */
async function grund(v: Promise<unknown>): Promise<string | null> {
  try {
    await v;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

try {
  gleich(
    SHOW_AUDIO_GRUND,
    { datei: 'Datei fehlt oder ist nicht lesbar.', format: 'Datei lässt sich nicht als Ton abspielen.' },
    'PL-T14 die zwei Gründe stehen in SHOW_AUDIO_GRUND',
  );

  antwort = async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) });
  gleich(await grund(showAudio.preload(901, 'jmedia://a')), SHOW_AUDIO_GRUND.datei, 'PL-T14 404 ergibt den Grund datei');

  antwort = async () => {
    throw new TypeError('Failed to fetch');
  };
  gleich(await grund(showAudio.preload(902, 'jmedia://b')), SHOW_AUDIO_GRUND.datei, 'PL-T14 fetch wirft ergibt datei');

  antwort = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
  dekodieren = async () => {
    throw new Error('EncodingError');
  };
  gleich(await grund(showAudio.preload(903, 'jmedia://c')), SHOW_AUDIO_GRUND.format, 'PL-T14 decode wirft ergibt format');

  // Kein Puffer im Cache nach einem Fehler: der zweite Versuch fragt fetch erneut (und gelingt dann).
  const davor = abrufe;
  gleich(await grund(showAudio.preload(903, 'jmedia://c')), SHOW_AUDIO_GRUND.format, 'PL-T14 zweiter Versuch scheitert wie der erste');
  dekodieren = async () => ({ duration: 1 });
  gleich(await grund(showAudio.preload(903, 'jmedia://c')), null, 'PL-T14 nach behobenem Fehler gelingt das Laden');
  gleich(abrufe - davor, 2, 'PL-T14 kein Puffer im Cache nach Fehler: fetch wurde bei jedem Versuch erneut gefragt');
  const nachErfolg = abrufe;
  await showAudio.preload(903, 'jmedia://c');
  gleich(abrufe, nachErfolg, 'PL-T14 ein geladener Puffer bleibt im Cache (kein weiteres fetch)');

  // play reicht den Grund weiter.
  antwort = async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) });
  const cue = showCue(21, { label: 'Gong' });
  gleich(await grund(showAudio.play({ ...cue, mediaId: 904 }, 'jmedia://d', () => {})), SHOW_AUDIO_GRUND.datei, 'PL-T14 play reicht den Grund datei weiter');
  ok(abrufe > nachErfolg, 'PL-T14 play hat nach dem Fehler nichts im Cache gelassen');
} finally {
  for (const id of [901, 902, 903, 904]) showAudio.forget(id);
  g.AudioContext = vorher.AudioContext;
  g.fetch = vorher.fetch;
}

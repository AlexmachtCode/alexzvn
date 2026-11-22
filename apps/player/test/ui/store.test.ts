// UX Welle 2a · Player-Store (Aufgabe c; W2-1 Vorlauf und Pad-Meldung, W2-10 Panik stoppt Pads, Ruling „Pause folgt
// Wirklichkeit“): Der echte Store läuft gegen Attrappen für window.jmplay, showAudio und cueEngine. Die Attrappen setzt nur
// dieser Test (als eigene Eigenschaften der Einzelstücke bzw. als globales window) und nimmt sie am Ende zurück; der
// Produktionscode bleibt dafür unverändert. Die Pad-Maschine läuft als frische Instanz gegen einen Schein-AudioContext.
import { gleich, ok } from '@jm/ui/testhilfe';
import type { OutputCommand, RemoteCommand, RemotePlayerState, ShowCue } from '@shared/types';
import { cueEngine } from '@/lib/cues';
import { kopfOnAir } from '@/lib/oberflaeche';
import { showAudio } from '@/lib/show-audio';
import { usePlayer } from '@/store/player';
import { pad, showCue } from './testzustand';
// Reihenfolge: bruecken.test setzt und löscht globalThis.window zwischen eigenen await-Stellen. Geschwister-Module mit
// top-level await laufen sonst verschränkt und überschrieben sich das Schein-window; dieser Import lässt diesen Test erst
// nach bruecken.test beginnen (dasselbe Modul, es läuft nicht doppelt).
import './bruecken.test';

type Global = { window?: unknown; AudioContext?: unknown; fetch?: unknown };
const g = globalThis as unknown as Global;
const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Show-Cues: Audio ohne Vorlauf, Video ohne Vorlauf, Audio mit 30 ms Vorlauf, Video mit 30 ms Vorlauf.
const A = showCue(11, { label: 'Gong', fadeOutSec: 0.5 });
const V = showCue(12, { kind: 'video', label: 'Einspieler' });
const P = showCue(13, { label: 'Wartet', preWaitSec: 0.03 });
const PV = showCue(14, { kind: 'video', preWaitSec: 0.03 });
const CUES: ShowCue[] = [A, V, P, PV];

// ── Attrappen: Protokoll aller Wirkungen nach außen (Ton der Show, Pads, Ausgabefenster) ──
const log: string[] = [];
const berichte: RemotePlayerState[] = [];
let fernbefehl: ((c: RemoteCommand) => void) | undefined;
const zaehle = (eintrag: string): number => log.filter((z) => z === eintrag).length;

const echt = {
  play: showAudio.play,
  stop: showAudio.stop,
  panic: showAudio.panic,
  suspend: showAudio.suspend,
  resume: showAudio.resume,
  preload: showAudio.preload,
  stopAll: cueEngine.stopAll,
};
showAudio.play = async (cue) => {
  log.push(`audio.play ${cue.id}`);
};
showAudio.stop = (id, fade = 0) => {
  log.push(`audio.stop ${id} ${fade}`);
};
showAudio.panic = () => {
  log.push('audio.panic');
};
showAudio.suspend = async () => {
  log.push('audio.suspend');
};
showAudio.resume = async () => {
  log.push('audio.resume');
};
showAudio.preload = async () => {};
cueEngine.stopAll = () => {
  log.push('pads.stopAll');
};
g.window = {
  jmplay: {
    library: { list: async () => [] },
    playlists: { list: async () => [] },
    shows: { list: async () => [], cues: async () => CUES, remove: async () => {} },
    output: {
      command: async (c: OutputCommand) => {
        log.push(`output.${c.type}`);
      },
      isOpen: async () => true,
      open: async () => {
        log.push('output.open');
      },
      onEnded: () => () => {},
      onTime: () => () => {},
    },
    remote: {
      onCommand: (cb: (c: RemoteCommand) => void) => {
        fernbefehl = cb;
        return () => {};
      },
      reportState: async (s: RemotePlayerState) => {
        berichte.push(s);
      },
    },
    mediaUrl: (p: string) => `jmedia://local/?path=${encodeURIComponent(p)}`,
    onShowSettings: () => () => {},
    takeShowSettings: async () => null,
  },
};

const p = () => usePlayer.getState();

/** Frischer Lauf: Panik räumt Zeitgeber und Listen, dann Show mit CUES, nichts spielt, keine Pause; Protokoll leer. */
function neu(): void {
  p().showPanic();
  usePlayer.setState({ activeShowId: 1, showCues: CUES, standbyIndex: 0, playingCueIds: [], vorlaufCueIds: [], showPaused: false, videoCue: null, videoProgress: null });
  log.length = 0;
}

/** Companion-Zustand genau wie vor dem Umbau (R/store/player.ts:37-47 auf d7cdd79ce0), als Orakel. */
function vorDemUmbau(s: ReturnType<typeof p>): RemotePlayerState {
  const label = s.showCues[s.standbyIndex]?.media?.title ?? '';
  return {
    playing: s.playingCueIds.length > 0 || s.videoCue !== null,
    paused: s.showPaused,
    standby: s.showCues.length ? s.standbyIndex + 1 : 0,
    standbyLabel: label.trim().replace(/\s+/g, '_') || '-',
    cues: s.showCues.length,
    playingCount: s.playingCueIds.length,
  };
}

try {
  await p().load();

  // ── PL Vorlauf-Feld: gesetzt beim Start der Vorlaufzeit, geleert an ihrem Ende, bei Stop und bei Panik ──
  {
    neu();
    p().fireCue(2);
    gleich([p().playingCueIds, p().vorlaufCueIds], [[13], [13]], 'PL Vorlauf-Feld: Start der Vorlaufzeit setzt vorlaufCueIds, playingCueIds enthält den Cue wie bisher');
    await warte(90);
    gleich([p().playingCueIds, p().vorlaufCueIds, zaehle('audio.play 13')], [[13], [], 1], 'PL Vorlauf-Feld: Ende der Vorlaufzeit leert vorlaufCueIds, der Cue startet und bleibt in playingCueIds');

    neu();
    p().fireCue(3);
    ok(p().vorlaufCueIds.includes(14) && p().videoCue === null, 'PL Vorlauf-Feld: Video-Cue im Vorlauf steht in vorlaufCueIds, videoCue erst nach dem Vorlauf');
    await warte(90);
    gleich([p().vorlaufCueIds, p().videoCue?.id, p().videoProgress], [[], 14, null], 'PL Vorlauf-Feld: nach dem Vorlauf ist der Video-Cue gestartet (videoCue), noch ohne Fortschritt');

    neu();
    p().fireCue(2);
    p().showStop();
    gleich([p().playingCueIds, p().vorlaufCueIds], [[], []], 'PL Vorlauf-Feld: Stop leert vorlaufCueIds und playingCueIds');
    await warte(90);
    ok(zaehle('audio.play 13') === 0, 'PL Vorlauf-Feld: nach Stop startet der Cue nicht mehr (Zeitgeber geräumt wie bisher)');

    neu();
    p().fireCue(2);
    p().showPanic();
    gleich([p().playingCueIds, p().vorlaufCueIds], [[], []], 'PL Vorlauf-Feld: Panik leert vorlaufCueIds und playingCueIds');
    await warte(90);
    ok(zaehle('audio.play 13') === 0, 'PL Vorlauf-Feld: nach Panik startet der Cue nicht mehr (Zeitgeber geräumt wie bisher)');

    neu();
    p().fireCue(0);
    gleich([p().playingCueIds, p().vorlaufCueIds, zaehle('audio.play 11')], [[11], [], 1], 'PL Vorlauf-Feld: Cue ohne Vorlauf steht nie in vorlaufCueIds');
  }

  // ── PL Companion unverändert: Pre-Wait zählt für Companion weiter als „spielt“ (playing, playing_count) ──
  {
    neu();
    const vorher = berichte.length;
    p().fireCue(2);
    const b = berichte[berichte.length - 1];
    ok(berichte.length > vorher, 'PL Companion unverändert: der Start der Vorlaufzeit wird an Companion gemeldet');
    gleich([b.playing, b.playingCount], [true, 1], 'PL Companion unverändert: Cue im Vorlauf → playing wahr, playing_count 1 (wie vor dem Umbau)');
    gleich(b, vorDemUmbau(p()), 'PL Companion unverändert: Meldung im Vorlauf gleich der Formel vor dem Umbau, gleiche Felder in gleicher Reihenfolge');

    neu();
    p().fireCue(3);
    gleich(berichte[berichte.length - 1], vorDemUmbau(p()), 'PL Companion unverändert: Video-Cue im Vorlauf gleich der Formel vor dem Umbau');
    await warte(90);
    gleich([berichte[berichte.length - 1], berichte[berichte.length - 1].playing], [vorDemUmbau(p()), true], 'PL Companion unverändert: Video vor dem ersten Fortschritt zählt für Companion als spielt (wie bisher)');

    neu();
    p().fireCue(0);
    p().fireCue(2);
    gleich([berichte[berichte.length - 1], berichte[berichte.length - 1].playingCount], [vorDemUmbau(p()), 2], 'PL Companion unverändert: ein spielender und ein wartender Cue → playing_count 2');
    p().showStop();
    gleich(berichte[berichte.length - 1], vorDemUmbau(p()), 'PL Companion unverändert: nach Stop gleich der Formel vor dem Umbau');
  }

  // ── PL Panik stoppt Pads (W2-10): showPanic und Companion panic rufen cueEngine.stopAll() genau einmal, Stop nie ──
  {
    neu();
    p().showPanic();
    gleich([zaehle('pads.stopAll'), zaehle('audio.panic'), zaehle('output.black')], [1, 1, 1], 'PL Panik stoppt Pads: showPanic ruft cueEngine.stopAll() genau einmal, dazu wie bisher Show-Töne hart aus und Ausgabe schwarz');

    neu();
    p().showStop();
    gleich(zaehle('pads.stopAll'), 0, 'PL Panik stoppt Pads: showStop ruft cueEngine.stopAll() nicht');

    neu();
    fernbefehl?.({ t: 'panic' });
    ok(fernbefehl !== undefined && zaehle('pads.stopAll') === 1, 'PL Panik stoppt Pads: Companion panic (derselbe Store-Weg) stoppt die Pads genau einmal');

    neu();
    fernbefehl?.({ t: 'stop' });
    ok(fernbefehl !== undefined && zaehle('pads.stopAll') === 0, 'PL Panik stoppt Pads: Companion stop stoppt die Pads nicht');

    neu();
    await p().selectShow(1);
    gleich([zaehle('pads.stopAll'), zaehle('audio.panic'), zaehle('output.black')], [0, 1, 1], 'PL Panik stoppt Pads: Show-Wahl räumt die Show wie bisher, die Pads laufen weiter (keine Änderung außer W2-10)');

    neu();
    await p().removeShow(1);
    gleich([zaehle('pads.stopAll'), zaehle('audio.panic'), p().activeShowId], [0, 1, null], 'PL Panik stoppt Pads: Löschen der aktiven Show räumt die Show wie bisher, die Pads laufen weiter');
  }

  // ── PL Pause folgt Wirklichkeit (Ruling): Stop und Cue-Start heben die Pause auf; Ton und Video wirken wie bisher ──
  {
    neu();
    p().fireCue(0);
    p().showTogglePause();
    ok(p().showPaused, 'PL Pause folgt Wirklichkeit: Pause setzt showPaused (wie bisher)');
    log.length = 0;
    p().showStop();
    gleich([p().showPaused, log], [false, ['audio.stop 11 0.5']], 'PL Pause folgt Wirklichkeit: Stop in der Pause → showPaused false; Ton wie bisher (Stop mit Fade-Out, kein resume)');

    neu();
    p().fireCue(0);
    p().showTogglePause();
    log.length = 0;
    p().fireCue(0);
    gleich([p().showPaused, log], [false, ['audio.play 11']], 'PL Pause folgt Wirklichkeit: Cue-Start in der Pause → showPaused false; Ton wie bisher (nur showAudio.play)');

    neu();
    p().fireCue(2);
    p().showTogglePause();
    ok(p().showPaused, 'PL Pause folgt Wirklichkeit: Pause während des Vorlaufs setzt showPaused');
    log.length = 0;
    await warte(90);
    gleich([p().showPaused, log], [false, ['audio.play 13']], 'PL Pause folgt Wirklichkeit: Vorlauf läuft in der Pause ab → showPaused false; Ton wie bisher (nur showAudio.play)');

    neu();
    p().fireCue(0);
    p().showTogglePause();
    log.length = 0;
    p().fireCue(1);
    await warte(5);
    gleich([p().showPaused, log], [false, ['output.load']], 'PL Pause folgt Wirklichkeit: Video-Cue-Start in der Pause → showPaused false; Ausgabe wie bisher (nur load)');

    neu();
    p().fireCue(0);
    p().showTogglePause();
    log.length = 0;
    p().showTogglePause();
    gleich([p().showPaused, log], [false, ['audio.resume', 'output.resume']], 'PL Pause folgt Wirklichkeit: Weiter wirkt wie bisher (resume für Ton und Ausgabe)');

    neu();
    p().fireCue(0);
    p().showTogglePause();
    p().showPanic();
    ok(!p().showPaused, 'PL Pause folgt Wirklichkeit: Panik hebt die Pause auf (wie bisher)');
  }

  // ── PL ON AIR Wahrheitstabelle am echten Store: Stop in der Pause, dann GO mit Audio-Cue ──
  {
    neu();
    p().fireCue(0);
    p().showTogglePause();
    const inDerPause = kopfOnAir({ player: p(), pads: [] }).live;
    p().showStop();
    const nachStop = kopfOnAir({ player: p(), pads: [] }).live;
    p().setStandby(0);
    p().showGo();
    gleich(
      [inDerPause, nachStop, kopfOnAir({ player: p(), pads: [] }).live, log.filter((z) => z.startsWith('audio.play')).length],
      [false, false, true, 2],
      'PL ON AIR Wahrheitstabelle: Stop in der Pause, dann GO mit Audio-Cue → live true (vorher pausiert und nach Stop nicht live)',
    );
  }

  // ── PL ON AIR Wahrheitstabelle am echten Store: GO auf Video 2, während Video 1 läuft; Video 2 endet (veraltete ID) ──
  {
    neu();
    const live = (): boolean => kopfOnAir({ player: p(), pads: [] }).live;
    p().setStandby(1);
    p().showGo();
    p().onOutputTime({ currentTime: 1, duration: 10 });
    const video1 = live();
    p().setStandby(3);
    p().showGo();
    await warte(90);
    const video2Laedt = live();
    p().onOutputTime({ currentTime: 1, duration: 10 });
    const video2 = live();
    p().onOutputEnded();
    const b = berichte[berichte.length - 1];
    gleich(
      [video1, video2Laedt, video2, p().playingCueIds, p().videoCue, live(), b.playing, b.playingCount],
      [true, false, true, [12], null, false, true, 1],
      'PL ON AIR Wahrheitstabelle: veraltetes Video → nach dem Ende von Video 2 nicht live, obwohl Video 1 noch in playingCueIds steht (Companion zählt es weiter wie bisher)',
    );
  }
} finally {
  // Zeitgeber räumen, dann Attrappen zurücknehmen: danach läuft nichts mehr gegen das Schein-window.
  p().showPanic();
  await warte(5);
  showAudio.play = echt.play;
  showAudio.stop = echt.stop;
  showAudio.panic = echt.panic;
  showAudio.suspend = echt.suspend;
  showAudio.resume = echt.resume;
  showAudio.preload = echt.preload;
  cueEngine.stopAll = echt.stopAll;
  delete g.window;
}

// ── PL Pad-Meldung: frische Pad-Maschine gegen einen Schein-AudioContext; onChange bei play, stop, stopAll und onended ──
{
  class ScheinQuelle {
    buffer: unknown = null;
    loop = false;
    onended: (() => void) | null = null;
    gestoppt = 0;
    connect<T>(ziel: T): T {
      return ziel;
    }
    start(): void {}
    stop(): void {
      this.gestoppt++;
    }
  }
  class ScheinKontext {
    static letzter: ScheinKontext | undefined;
    state = 'running';
    destination = {};
    quellen: ScheinQuelle[] = [];
    constructor() {
      ScheinKontext.letzter = this;
    }
    async resume(): Promise<void> {}
    async decodeAudioData(): Promise<{ duration: number }> {
      return { duration: 1 };
    }
    createBufferSource(): ScheinQuelle {
      const q = new ScheinQuelle();
      this.quellen.push(q);
      return q;
    }
    createGain(): { gain: { value: number }; connect<T>(ziel: T): T } {
      return { gain: { value: 1 }, connect: <T>(ziel: T): T => ziel };
    }
  }
  const vorher = { AudioContext: g.AudioContext, fetch: g.fetch };
  g.AudioContext = ScheinKontext;
  g.fetch = async () => ({ arrayBuffer: async () => new ArrayBuffer(0) });
  try {
    // Dieselbe Klasse wie das Einzelstück, aber eine frische Instanz (das Einzelstück bleibt unberührt).
    const Maschine = cueEngine.constructor as unknown as new () => typeof cueEngine;
    const m = new Maschine();
    if (typeof m.onChange !== 'function' || typeof m.aktiveIds !== 'function') {
      ok(false, 'PL Pad-Meldung: cueEngine hat aktiveIds() und onChange(cb)');
    } else {
      const meldungen: number[][] = [];
      const ab = m.onChange((ids) => meldungen.push([...ids]));
      await m.preload(1, 'u1');
      await m.preload(2, 'u2');
      gleich([meldungen, m.aktiveIds()], [[], []], 'PL Pad-Meldung: Vordekodieren meldet nichts, nichts aktiv');
      m.play(pad(101, 0, 1), 'u1');
      m.play(pad(102, 1, 2), 'u2');
      gleich(meldungen, [[101], [101, 102]], 'PL Pad-Meldung: play meldet die aktuellen IDs');
      const ersteQuelle = ScheinKontext.letzter?.quellen[0];
      m.play(pad(101, 0, 1), 'u1');
      gleich([meldungen.length, meldungen[2], ersteQuelle?.gestoppt], [3, [102, 101], 1], 'PL Pad-Meldung: Re-Trigger meldet einmal (ohne Zwischenstand), die alte Instanz ist gestoppt wie bisher');
      m.stop(102);
      gleich(meldungen[3], [101], 'PL Pad-Meldung: stop meldet die übrigen IDs');
      ersteQuelle?.onended?.();
      gleich(meldungen.length, 4, 'PL Pad-Meldung: onended einer abgelösten Instanz meldet nichts');
      ScheinKontext.letzter?.quellen[2]?.onended?.();
      gleich([meldungen[4], m.aktiveIds(), m.isPlaying(101)], [[], [], false], 'PL Pad-Meldung: natürliches Ende (onended) meldet die übrigen IDs');
      m.play(pad(101, 0, 1), 'u1');
      m.play(pad(102, 1, 2), 'u2');
      const n = meldungen.length;
      m.stopAll();
      gleich([meldungen.length - n, meldungen[meldungen.length - 1], m.aktiveIds()], [1, [], []], 'PL Pad-Meldung: stopAll meldet einmal mit leerer Liste');
      m.play(pad(103, 2, 3), 'u3');
      const ohneBuffer = meldungen.length;
      await warte(5);
      gleich([ohneBuffer, meldungen[meldungen.length - 1]], [n + 1, [103]], 'PL Pad-Meldung: Pad ohne Vordekodierung meldet erst, wenn es nach dem Laden spielt');
      ab();
      m.play(pad(101, 0, 1), 'u1');
      gleich([meldungen.length, m.aktiveIds()], [n + 2, [103, 101]], 'PL Pad-Meldung: nach der Abmeldung kommt keine Meldung mehr, aktiveIds bleibt aktuell');
    }
  } finally {
    if (vorher.AudioContext === undefined) delete g.AudioContext;
    else g.AudioContext = vorher.AudioContext;
    g.fetch = vorher.fetch;
  }
}

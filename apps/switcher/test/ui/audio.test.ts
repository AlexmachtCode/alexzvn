// Switcher 0.12.1 · Audio-Abzug (Befund der Gesamtprüfung UX Welle 1): Wird das Gerät während der Show abgezogen, endet die
// Eingangsspur. Der Controller meldet dann „getrennt“ statt weiter ok. Kommt das Gerät zurück (devicechange und wieder in der Liste),
// verbindet er es an denselben Ausgang: Eine laufende Aufnahme oder Sendung behält ihre Ausgangsspur und hört es wieder.
// Ohne Browser: mediaDevices, AudioContext und window sind Attrappen, die nach dem Lauf wieder entfernt werden.
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { AudioController, beobachteGeraetewechsel } from '@/core/audio';
import { ohneKommentare } from './testzustand';

/** Der Rahmen liest die Geräteliste bei devicechange neu, ohne Berechtigungsprobe (R6). */
const RAHMEN_GERAETEWECHSEL = 'useEffect(() => beobachteGeraetewechsel(navigator.mediaDevices, () => scanAudio(false)), [])';

class SpurAttrappe extends EventTarget {
  readonly kind = 'audio';
  readyState: 'live' | 'ended' = 'live';
  stop(): void {
    this.readyState = 'ended';
  }
  /** Wie Chromium beim Abziehen: readyState ended und das Ereignis „ended“ (stop() löst es nicht aus). */
  ende(): void {
    this.readyState = 'ended';
    this.dispatchEvent(new Event('ended'));
  }
}

class StreamAttrappe {
  constructor(readonly spur: SpurAttrappe) {}
  getTracks(): SpurAttrappe[] {
    return [this.spur];
  }
  getAudioTracks(): SpurAttrappe[] {
    return [this.spur];
  }
}

class GeraeteAttrappe extends EventTarget {
  vorhanden = new Set<string>();
  geoeffnet: Array<{ id: string; spur: SpurAttrappe }> = [];
  listeAbrufe = 0;
  async getUserMedia(c: { audio: { deviceId: { exact: string } } }): Promise<StreamAttrappe> {
    const id = c.audio.deviceId.exact;
    if (!this.vorhanden.has(id)) throw new Error('Requested device not found');
    const spur = new SpurAttrappe();
    this.geoeffnet.push({ id, spur });
    return new StreamAttrappe(spur);
  }
  async enumerateDevices(): Promise<Array<{ kind: string; deviceId: string; label: string }>> {
    this.listeAbrufe++;
    return [...this.vorhanden].map((id) => ({ kind: 'audioinput', deviceId: id, label: id }));
  }
  /** Gerät abziehen: aus der Liste nehmen, die offene Spur endet, dann das devicechange des Browsers. */
  abziehen(id: string): void {
    this.vorhanden.delete(id);
    for (const g of this.geoeffnet) if (g.id === id && g.spur.readyState === 'live') g.spur.ende();
    this.dispatchEvent(new Event('devicechange'));
  }
  einstecken(id: string): void {
    this.vorhanden.add(id);
    this.dispatchEvent(new Event('devicechange'));
  }
}

class KnotenAttrappe {
  ziele: KnotenAttrappe[] = [];
  connect(z: KnotenAttrappe): void {
    this.ziele.push(z);
  }
  disconnect(): void {
    this.ziele = [];
  }
}

class KontextAttrappe {
  static letzter: KontextAttrappe | null = null;
  quellen: Array<KnotenAttrappe & { stream: StreamAttrappe }> = [];
  gains: Array<KnotenAttrappe & { gain: { value: number } }> = [];
  constructor() {
    KontextAttrappe.letzter = this;
  }
  async resume(): Promise<void> {}
  async close(): Promise<void> {}
  createMediaStreamSource(stream: StreamAttrappe): KnotenAttrappe & { stream: StreamAttrappe } {
    const q = Object.assign(new KnotenAttrappe(), { stream });
    this.quellen.push(q);
    return q;
  }
  createGain(): KnotenAttrappe & { gain: { value: number } } {
    const g = Object.assign(new KnotenAttrappe(), { gain: { value: 1 } });
    this.gains.push(g);
    return g;
  }
  createAnalyser(): KnotenAttrappe & { fftSize: number; getFloatTimeDomainData(b: Float32Array): void } {
    return Object.assign(new KnotenAttrappe(), { fftSize: 2048, getFloatTimeDomainData: (b: Float32Array) => void b.fill(0) });
  }
  createMediaStreamDestination(): KnotenAttrappe & { stream: StreamAttrappe } {
    return Object.assign(new KnotenAttrappe(), { stream: new StreamAttrappe(new SpurAttrappe()) });
  }
}

/** Die Promise-Kette der Attrappen abwarten (getUserMedia, enumerateDevices, then). */
const abwarten = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise<void>((r) => setTimeout(r, 0));
};

const g = globalThis as Record<string, unknown>;
const vorher = {
  navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
  window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
  AudioContext: Object.getOwnPropertyDescriptor(globalThis, 'AudioContext'),
};
function attrappenEinsetzen(): GeraeteAttrappe {
  const geraete = new GeraeteAttrappe();
  Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: geraete }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'window', { value: { setTimeout, clearTimeout }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'AudioContext', { value: KontextAttrappe, configurable: true, writable: true });
  return geraete;
}
function attrappenEntfernen(): void {
  for (const [name, d] of Object.entries(vorher)) {
    if (d) Object.defineProperty(globalThis, name, d);
    else delete g[name];
  }
}

try {
  // ── Abziehen: getrennt statt ok, dieselbe Ausgangsspur bleibt ──
  {
    const geraete = attrappenEinsetzen();
    geraete.vorhanden.add('mic1');
    const audio = new AudioController();
    await audio.setDevice('mic1');
    const ausgangVorher = audio.getOutputTrack();
    gleich([audio.getState().hasDevice, audio.getState().getrennt], [true, false], 'SW Audio-Abzug: Gerät offen → hasDevice, nicht getrennt');
    geraete.abziehen('mic1');
    await abwarten();
    const s = audio.getState();
    gleich([s.hasDevice, s.getrennt, s.level, s.error], [false, true, 0, null], 'SW Audio-Abzug: nach dem Ende der Eingangsspur meldet der Controller getrennt, kein Gerät offen, Pegel 0, kein Browserfehler');
    ok(ausgangVorher !== null && audio.getOutputTrack() === ausgangVorher, 'SW Audio-Abzug: die Ausgangsspur bleibt dieselbe (laufende Aufnahme und Sendung behalten ihre Spur)');
    gleich(geraete.geoeffnet.length, 1, 'SW Audio-Abzug: devicechange ohne das Gerät öffnet nichts neu');

    // ── Wiedereinstecken: dieselbe Spur, neue Quelle am selben Gain ──
    geraete.einstecken('mic1');
    await abwarten();
    const t = audio.getState();
    gleich([t.hasDevice, t.getrennt, t.error], [true, false, null], 'SW Audio-Abzug: Gerät wieder da (devicechange) → von selbst wieder verbunden');
    gleich(geraete.geoeffnet.length, 2, 'SW Audio-Abzug: zum Wiederverbinden wird das Gerät genau einmal neu geöffnet');
    ok(audio.getOutputTrack() === ausgangVorher, 'SW Audio-Abzug: nach dem Wiederverbinden dieselbe Ausgangsspur (der Ton kommt in die laufende Aufnahme zurück)');
    const ctx = KontextAttrappe.letzter;
    ok(
      ctx !== null && ctx.gains.length === 1 && ctx.quellen.length === 2 && ctx.quellen[1].ziele[0] === ctx.gains[0],
      'SW Audio-Abzug: die neue Quelle hängt am bisherigen Gain (Fader und Stumm bleiben, kein neuer Graph)',
    );
    audio.destroy();
    attrappenEntfernen();
  }

  // ── Dieselbe Wahl nach dem Abziehen öffnet erneut (Auswahl neu gesetzt, Gerät schon wieder da) ──
  {
    const geraete = attrappenEinsetzen();
    geraete.vorhanden.add('mic1');
    const audio = new AudioController();
    await audio.setDevice('mic1');
    geraete.geoeffnet[0].spur.ende(); // Spur endet, Liste unverändert, kein devicechange
    await abwarten();
    ok(audio.getState().getrennt, 'SW Audio-Abzug: Spur endet ohne devicechange → getrennt');
    await audio.setDevice('mic1');
    gleich([audio.getState().hasDevice, audio.getState().getrennt, geraete.geoeffnet.length], [true, false, 2], 'SW Audio-Abzug: dieselbe Wahl im getrennten Zustand öffnet das Gerät erneut');
    audio.destroy();
    attrappenEntfernen();
  }

  // ── Das Ende einer alten Spur nach einem Gerätewechsel ändert nichts ──
  {
    const geraete = attrappenEinsetzen();
    geraete.vorhanden.add('mic1');
    geraete.vorhanden.add('mic2');
    const audio = new AudioController();
    await audio.setDevice('mic1');
    const alteSpur = geraete.geoeffnet[0].spur;
    await audio.setDevice('mic2');
    alteSpur.dispatchEvent(new Event('ended'));
    await abwarten();
    gleich([audio.getState().hasDevice, audio.getState().getrennt], [true, false], 'SW Audio-Abzug: „ended“ einer abgelösten Spur lässt das neue Gerät in Ruhe');
    audio.destroy();
    attrappenEntfernen();
  }

  // ── Nach destroy hört der Controller nicht mehr auf devicechange ──
  {
    const geraete = attrappenEinsetzen();
    geraete.vorhanden.add('mic1');
    const audio = new AudioController();
    await audio.setDevice('mic1');
    geraete.abziehen('mic1');
    await abwarten();
    audio.destroy();
    const abrufe = geraete.listeAbrufe;
    geraete.einstecken('mic1');
    await abwarten();
    gleich([geraete.listeAbrufe, geraete.geoeffnet.length], [abrufe, 1], 'SW Audio-Abzug: nach destroy kein Listenabruf und kein Öffnen mehr');
    attrappenEntfernen();
  }

  // ── beobachteGeraetewechsel: Rückruf je devicechange, Abmelden, ohne mediaDevices nichts ──
  {
    const geraete = new GeraeteAttrappe();
    let n = 0;
    const ab = beobachteGeraetewechsel(geraete as unknown as MediaDevices, () => void n++);
    geraete.dispatchEvent(new Event('devicechange'));
    geraete.dispatchEvent(new Event('devicechange'));
    ab();
    geraete.dispatchEvent(new Event('devicechange'));
    gleich(n, 2, 'SW Geräteliste: beobachteGeraetewechsel ruft je devicechange einmal, nach dem Abmelden nicht mehr');
    let wurf = false;
    try {
      beobachteGeraetewechsel(undefined, () => {})();
    } catch {
      wurf = true;
    }
    ok(!wurf, 'SW Geräteliste: ohne mediaDevices (kein Browser) kein Wurf');
  }
} finally {
  attrappenEntfernen();
}

ok(
  ohneKommentare(leseText('src/renderer/src/views/SwitcherOberflaeche.tsx')).includes(RAHMEN_GERAETEWECHSEL),
  'SW Geräteliste: der Rahmen liest die Liste bei devicechange neu, ohne Berechtigungsprobe (scanAudio(false))',
);

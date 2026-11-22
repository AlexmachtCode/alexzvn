// Switcher 0.12.1 · Audio-Abzug (Befund der Gesamtprüfung UX Welle 1): Wird das Gerät während der Show abgezogen, endet die
// Eingangsspur. Der Controller meldet dann „getrennt“ statt weiter ok. Kommt dasselbe Gerät zurück (devicechange oder der nächste
// Takt der Wiederholung), verbindet er es an denselben Ausgang: Eine laufende Aufnahme oder Sendung behält ihre Ausgangsspur und
// hört es wieder. Ein anderes Gerät (z. B. „Standard“ zeigt jetzt aufs Laptop-Mikro) verbindet er nie von selbst.
// Ohne Browser: mediaDevices und AudioContext sind Attrappen, die nach dem Lauf wieder entfernt werden. window bleibt unberührt
// (bruecken.test setzt und löscht es, und Testmodule mit await laufen verschränkt).
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { AudioController, beobachteGeraetewechsel } from '@/core/audio';
import { ohneKommentare } from './testzustand';

/** Der Rahmen liest die Geräteliste bei devicechange neu, ohne Berechtigungsprobe (R6). */
const RAHMEN_GERAETEWECHSEL = 'useEffect(() => beobachteGeraetewechsel(navigator.mediaDevices, () => scanAudio(false)), [])';

class SpurAttrappe extends EventTarget {
  readonly kind = 'audio';
  readyState: 'live' | 'ended' = 'live';
  constructor(private readonly einstellungen: { deviceId: string; groupId: string }) {
    super();
  }
  getSettings(): { deviceId: string; groupId: string } {
    return { ...this.einstellungen };
  }
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
  /** deviceId → groupId (das physische Gerät dahinter). */
  vorhanden = new Map<string, string>();
  /** Erfolgreich geöffnete Spuren in Reihenfolge. */
  geoeffnet: Array<{ id: string; spur: SpurAttrappe }> = [];
  listeAbrufe = 0;
  /** So viele der nächsten getUserMedia scheitern (Gerät noch nicht bereit). */
  ablehnen = 0;
  /** Die nächste geöffnete Spur ist schon beendet. */
  bereitsBeendet = false;
  /** getUserMedia für diese ids wartet, bis freigeben() gerufen wird. */
  aufhaltenFuer = new Set<string>();
  private wartend: Array<() => void> = [];

  geben(id: string, gruppe = id): void {
    this.vorhanden.set(id, gruppe);
  }
  async getUserMedia(c: { audio: { deviceId: { exact: string } } }): Promise<StreamAttrappe> {
    const id = c.audio.deviceId.exact;
    if (this.aufhaltenFuer.has(id)) await new Promise<void>((r) => this.wartend.push(r));
    if (this.ablehnen > 0) {
      this.ablehnen--;
      throw new Error('Could not start audio source');
    }
    const gruppe = this.vorhanden.get(id);
    if (gruppe === undefined) throw new Error('Requested device not found');
    const spur = new SpurAttrappe({ deviceId: id, groupId: gruppe });
    if (this.bereitsBeendet) {
      this.bereitsBeendet = false;
      spur.readyState = 'ended';
    }
    this.geoeffnet.push({ id, spur });
    return new StreamAttrappe(spur);
  }
  freigeben(): void {
    this.aufhaltenFuer.clear();
    const w = this.wartend;
    this.wartend = [];
    for (const r of w) r();
  }
  async enumerateDevices(): Promise<Array<{ kind: string; deviceId: string; label: string; groupId: string }>> {
    this.listeAbrufe++;
    return [...this.vorhanden].map(([id, groupId]) => ({ kind: 'audioinput', deviceId: id, label: id, groupId }));
  }
  /** Die offenen Spuren dieser id enden (Gerät weg). */
  spurenEnden(id: string): void {
    for (const g of this.geoeffnet) if (g.id === id && g.spur.readyState === 'live') g.spur.ende();
  }
  /** Gerät abziehen: aus der Liste nehmen, die offene Spur endet, dann das devicechange des Browsers. */
  abziehen(id: string): void {
    this.vorhanden.delete(id);
    this.spurenEnden(id);
    this.dispatchEvent(new Event('devicechange'));
  }
  einstecken(id: string, gruppe = id): void {
    this.vorhanden.set(id, gruppe);
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
    return Object.assign(new KnotenAttrappe(), { stream: new StreamAttrappe(new SpurAttrappe({ deviceId: 'ziel', groupId: '' })) });
  }
}

/** Die Promise-Kette der Attrappen abwarten (getUserMedia, enumerateDevices, then). */
const abwarten = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise<void>((r) => setTimeout(r, 0));
};
/** Einige Takte der Wiederholung (Takt 10 ms in den Tests, die sie prüfen). */
const takte = (ms = 80): Promise<void> => new Promise((r) => setTimeout(r, ms));
/** Wartet, bis die Bedingung gilt (höchstens maxMs): robust gegen grobe Zeitgeber (Windows ≈ 15,6 ms), für erwartete Wirkungen. */
const bis = async (bedingung: () => boolean, maxMs = 2000): Promise<void> => {
  const ende = Date.now() + maxMs;
  while (!bedingung() && Date.now() < ende) await new Promise<void>((r) => setTimeout(r, 5));
};
/** Ohne Wiederholung im Testzeitraum: nur devicechange und Aufrufe wirken. */
const OHNE_TAKT = { wiederholMs: 60_000 };
const MIT_TAKT = { wiederholMs: 10 };

const g = globalThis as Record<string, unknown>;
const vorher = {
  navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
  AudioContext: Object.getOwnPropertyDescriptor(globalThis, 'AudioContext'),
};
function attrappenEinsetzen(): GeraeteAttrappe {
  const geraete = new GeraeteAttrappe();
  Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: geraete }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'AudioContext', { value: KontextAttrappe, configurable: true, writable: true });
  return geraete;
}
function attrappenEntfernen(): void {
  for (const [name, d] of Object.entries(vorher)) {
    if (d) Object.defineProperty(globalThis, name, d);
    else delete g[name];
  }
}
const zustand = (a: AudioController): [boolean, boolean] => [a.getState().hasDevice, a.getState().getrennt];

try {
  // ── Abziehen: getrennt statt ok, dieselbe Ausgangsspur bleibt ──
  {
    const geraete = attrappenEinsetzen();
    geraete.geben('mic1');
    const audio = new AudioController(OHNE_TAKT);
    await audio.setDevice('mic1');
    const ausgangVorher = audio.getOutputTrack();
    gleich(zustand(audio), [true, false], 'SW Audio-Abzug: Gerät offen → hasDevice, nicht getrennt');
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
    geraete.geben('mic1');
    const audio = new AudioController(OHNE_TAKT);
    await audio.setDevice('mic1');
    geraete.spurenEnden('mic1'); // Spur endet, Liste unverändert, kein devicechange
    await abwarten();
    ok(audio.getState().getrennt, 'SW Audio-Abzug: Spur endet ohne devicechange → getrennt');
    await audio.setDevice('mic1');
    gleich([...zustand(audio), geraete.geoeffnet.length], [true, false, 2], 'SW Audio-Abzug: dieselbe Wahl im getrennten Zustand öffnet das Gerät erneut');
    audio.destroy();
    attrappenEntfernen();
  }

  // ── Das Ende einer alten Spur nach einem Gerätewechsel ändert nichts ──
  {
    const geraete = attrappenEinsetzen();
    geraete.geben('mic1');
    geraete.geben('mic2');
    const audio = new AudioController(OHNE_TAKT);
    await audio.setDevice('mic1');
    const alteSpur = geraete.geoeffnet[0].spur;
    await audio.setDevice('mic2');
    alteSpur.dispatchEvent(new Event('ended'));
    await abwarten();
    gleich(zustand(audio), [true, false], 'SW Audio-Abzug: „ended“ einer abgelösten Spur lässt das neue Gerät in Ruhe');
    audio.destroy();
    attrappenEntfernen();
  }

  // ── Nach destroy hört der Controller nicht mehr auf devicechange ──
  {
    const geraete = attrappenEinsetzen();
    geraete.geben('mic1');
    const audio = new AudioController(MIT_TAKT);
    await audio.setDevice('mic1');
    geraete.abziehen('mic1');
    await abwarten();
    audio.destroy();
    const abrufe = geraete.listeAbrufe;
    geraete.einstecken('mic1');
    await takte();
    gleich([geraete.listeAbrufe, geraete.geoeffnet.length], [abrufe, 1], 'SW Audio-Abzug: nach destroy kein Listenabruf, keine Wiederholung und kein Öffnen mehr');
    attrappenEntfernen();
  }

  // ── Fund 1: „Standard“ zeigt nach dem Abziehen auf ein anderes Gerät → nie von selbst verbinden ──
  {
    const geraete = attrappenEinsetzen();
    geraete.geben('default', 'usb');
    geraete.geben('laptop', 'laptop');
    const audio = new AudioController(MIT_TAKT);
    await audio.setDevice('default');
    geraete.geben('default', 'laptop'); // Windows stellt den Standard auf das Laptop-Mikro um
    geraete.spurenEnden('default');
    geraete.dispatchEvent(new Event('devicechange'));
    await takte();
    gleich(
      [...zustand(audio), geraete.geoeffnet.length],
      [false, true, 1],
      'SW Audio-Abzug Standard-Eintrag: zeigt „Standard“ jetzt auf ein anderes Gerät, verbindet der Switcher nicht (kein fremdes Mikro auf Sendung), auch nicht im Takt',
    );
    geraete.einstecken('default', 'usb'); // dasselbe Gerät ist wieder Standard
    await bis(() => audio.getState().hasDevice);
    gleich([...zustand(audio), geraete.geoeffnet.length], [true, false, 2], 'SW Audio-Abzug Standard-Eintrag: kommt dasselbe Gerät als Standard zurück, verbindet er wieder');
    audio.destroy();
    attrappenEntfernen();
  }

  // ── Ohne Gruppenkennung: Standard und Kommunikation verbinden nie von selbst, echte Geräte schon ──
  {
    const geraete = attrappenEinsetzen();
    geraete.geben('communications', '');
    geraete.geben('mic1', '');
    const audio = new AudioController(MIT_TAKT);
    await audio.setDevice('communications');
    geraete.spurenEnden('communications');
    geraete.dispatchEvent(new Event('devicechange'));
    await takte();
    gleich([...zustand(audio), geraete.geoeffnet.length], [false, true, 1], 'SW Audio-Abzug ohne Gruppenkennung: „Kommunikation“ verbindet nicht von selbst');
    await audio.setDevice('mic1');
    geraete.spurenEnden('mic1');
    await bis(() => audio.getState().hasDevice);
    gleich(zustand(audio), [true, false], 'SW Audio-Abzug ohne Gruppenkennung: ein echtes Gerät (eigene id) verbindet wieder');
    audio.destroy();
    attrappenEntfernen();
  }

  // ── Fund 2: Wiederholung im Takt, auch ohne devicechange; ein gescheiterter Versuch wird wiederholt ──
  {
    const geraete = attrappenEinsetzen();
    geraete.geben('mic1');
    const audio = new AudioController(MIT_TAKT);
    await audio.setDevice('mic1');
    geraete.spurenEnden('mic1'); // z. B. Abtastrate im Treiber geändert: Spur endet, Gerät bleibt in der Liste
    await bis(() => audio.getState().hasDevice);
    gleich([...zustand(audio), geraete.geoeffnet.length], [true, false, 2], 'SW Audio-Abzug Wiederholung: Spur endet ohne devicechange → im nächsten Takt wieder verbunden');
    geraete.ablehnen = 2;
    geraete.spurenEnden('mic1');
    await bis(() => geraete.geoeffnet.length === 3 && audio.getState().hasDevice);
    gleich([...zustand(audio), geraete.geoeffnet.length, geraete.ablehnen], [true, false, 3, 0], 'SW Audio-Abzug Wiederholung: scheitert das Öffnen, versucht er es im nächsten Takt erneut');
    audio.destroy();
    attrappenEntfernen();
  }

  // ── Wettlauf: Gerätewechsel und destroy während des Wiederverbindens ──
  {
    const geraete = attrappenEinsetzen();
    geraete.geben('mic1');
    geraete.geben('mic2');
    const audio = new AudioController(OHNE_TAKT);
    await audio.setDevice('mic1');
    geraete.aufhaltenFuer.add('mic1');
    geraete.spurenEnden('mic1');
    geraete.dispatchEvent(new Event('devicechange')); // Wiederverbinden beginnt und wartet
    await abwarten();
    await audio.setDevice('mic2');
    geraete.freigeben();
    await abwarten();
    const spaet = geraete.geoeffnet.find((x, i) => x.id === 'mic1' && i > 0);
    ok(spaet !== undefined && spaet.spur.readyState === 'ended', 'SW Audio-Abzug Wettlauf: die späte Spur des alten Geräts wird gestoppt');
    gleich(zustand(audio), [true, false], 'SW Audio-Abzug Wettlauf: das neu gewählte Gerät bleibt offen');
    audio.destroy();
    attrappenEntfernen();
  }
  {
    const geraete = attrappenEinsetzen();
    geraete.geben('mic1');
    const audio = new AudioController(OHNE_TAKT);
    await audio.setDevice('mic1');
    geraete.aufhaltenFuer.add('mic1');
    geraete.spurenEnden('mic1');
    geraete.dispatchEvent(new Event('devicechange'));
    await abwarten();
    audio.destroy();
    geraete.freigeben();
    await abwarten();
    const spaet = geraete.geoeffnet[1];
    ok(spaet !== undefined && spaet.spur.readyState === 'ended', 'SW Audio-Abzug Wettlauf: destroy während des Wiederverbindens → die späte Spur wird gestoppt');
    attrappenEntfernen();
  }

  // ── Kleinere Funde: schon beendete Spur, kein alter Fehler am neuen Gerät, Wiederverwendung nach destroy ──
  {
    const geraete = attrappenEinsetzen();
    geraete.geben('mic1');
    geraete.bereitsBeendet = true;
    const audio = new AudioController(OHNE_TAKT);
    await audio.setDevice('mic1');
    gleich(zustand(audio), [false, true], 'SW Audio-Abzug: eine schon beim Öffnen beendete Spur gilt sofort als getrennt');
    audio.destroy();
    attrappenEntfernen();
  }
  {
    const geraete = attrappenEinsetzen();
    geraete.geben('mic1');
    geraete.geben('mic2');
    const audio = new AudioController(OHNE_TAKT);
    await audio.setDevice('mic1');
    geraete.spurenEnden('mic1');
    await abwarten();
    geraete.aufhaltenFuer.add('mic2');
    const offen = audio.setDevice('mic2');
    ok(!audio.getState().getrennt, 'SW Audio-Abzug: der Wechsel auf ein anderes Gerät löscht „getrennt“ sofort (kein alter Fehler am neuen Gerät)');
    geraete.freigeben();
    await offen;
    audio.destroy();
    attrappenEntfernen();
  }
  {
    const geraete = attrappenEinsetzen();
    geraete.geben('mic1');
    const audio = new AudioController(OHNE_TAKT);
    await audio.setDevice('mic1');
    geraete.spurenEnden('mic1');
    await abwarten();
    audio.destroy();
    await audio.setDevice('mic1');
    gleich([...zustand(audio), geraete.geoeffnet.length], [true, false, 2], 'SW Audio-Abzug: nach destroy im getrennten Zustand öffnet dieselbe Wahl neu (StrictMode, HMR)');
    audio.destroy();
    attrappenEntfernen();
  }

  // ── Fund 10: fehlt das gewählte Gerät beim Start und wird später eingesteckt, öffnet der Switcher es ──
  {
    const geraete = attrappenEinsetzen();
    const audio = new AudioController(OHNE_TAKT);
    await audio.setDevice('mic1');
    ok(!audio.getState().hasDevice && audio.getState().error !== null, 'SW Audio Start ohne Gerät: Öffnen scheitert, der Fehler steht');
    geraete.einstecken('mic1');
    await abwarten();
    const s = audio.getState();
    gleich([s.hasDevice, s.getrennt, s.error], [true, false, null], 'SW Audio Start ohne Gerät: später eingesteckt (devicechange) → geöffnet, Fehler weg');
    audio.destroy();
    attrappenEntfernen();
  }

  // ── Nachprüfung: „Kein Ton“ oder ein anderes Gerät beendet das Warten auf ein beim Start fehlendes Gerät ──
  {
    const geraete = attrappenEinsetzen();
    const audio = new AudioController(MIT_TAKT);
    await audio.setDevice('mic1');
    await audio.setDevice('');
    ok(audio.getState().error === null, 'SW Audio Start ohne Gerät: „Kein Ton“ danach löscht den alten Fehler');
    geraete.einstecken('mic1');
    await takte();
    gleich([audio.getState().hasDevice, geraete.geoeffnet.length], [false, 0], 'SW Audio Start ohne Gerät: nach „Kein Ton“ öffnet ein später eingestecktes Gerät nicht von selbst');
    audio.destroy();
    attrappenEntfernen();
  }
  {
    const geraete = attrappenEinsetzen();
    geraete.geben('mic2');
    const audio = new AudioController(MIT_TAKT);
    await audio.setDevice('mic1');
    await audio.setDevice('mic2');
    geraete.einstecken('mic1');
    await takte();
    gleich(geraete.geoeffnet.map((x) => x.id), ['mic2'], 'SW Audio Start ohne Gerät: nach der Wahl eines anderen Geräts öffnet das zuerst gewählte nicht mehr von selbst');
    audio.destroy();
    attrappenEntfernen();
  }

  // ── Nachprüfung: zwei überlappende Öffnen derselben Wahl bauen einen Graphen, die überholte Spur wird gestoppt ──
  {
    const geraete = attrappenEinsetzen();
    geraete.geben('mic1');
    geraete.aufhaltenFuer.add('mic1');
    const audio = new AudioController(OHNE_TAKT);
    const erst = audio.setDevice('mic1');
    const zweit = audio.setDevice('mic1');
    geraete.freigeben();
    await Promise.all([erst, zweit]);
    const ctx = KontextAttrappe.letzter;
    const offen = geraete.geoeffnet.filter((x) => x.spur.readyState === 'live').length;
    gleich([ctx?.gains.length, offen, audio.getState().hasDevice], [1, 1, true], 'SW Audio: zwei überlappende Öffnen derselben Wahl → ein Graph, eine offene Spur');
    audio.destroy();
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

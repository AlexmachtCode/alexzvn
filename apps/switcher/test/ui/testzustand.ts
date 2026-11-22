// Testhilfen der Switcher-Oberflächentests (UX Welle 1): feste Zustände und Attrappen für Render- und Ableitungstests.
// Wächst mit den Aufgaben c bis d2; Aufgabe b liefert die Zustände der Fernsteuerungs-Meldung.
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { ControlStatus, DisplayInfo } from '@shared/types';
import type { OberflaechenStand, SwitcherAktionen } from '@/lib/oberflaeche';

/** Meldung eines laufenden Steuerservers ohne Clients (Standardport, offener Modus). */
export function basisMeldung(z: Partial<FernsteuerungMeldung> = {}): FernsteuerungMeldung {
  return { laeuft: true, port: 8723, clients: 0, modus: 'open', ...z };
}

/** Dieselbe Meldung in der Form des Kanals control:status. */
export function basisControlStatus(z: Partial<ControlStatus> = {}): ControlStatus {
  return { running: true, port: 8723, clients: 0, modus: 'open', ...z };
}

// ── Grundzustand der Oberflächen-Ableitungen (Aufgabe c) ──
const nichts = (): void => {};

/** Einstellungen ohne Store (zustand/persist) mit den Standardwerten des Stores und Attrappen als Setter. */
export function basisEinstellungen(z: Partial<OberflaechenStand['settings']> = {}): OberflaechenStand['settings'] {
  return {
    rtmpUrl: '',
    streamBitrateKbps: 4500,
    recordBitrateKbps: 16000,
    controlEnabled: true,
    controlPort: 8723,
    audioInputId: '',
    ndiOutputName: 'JM Switcher',
    ndiOutputSource: 'program',
    programResolution: '1080p',
    outputFps: 25,
    secondScreenEnabled: false,
    secondScreenDisplayId: 0,
    setRtmpUrl: nichts,
    setStreamBitrateKbps: nichts,
    setRecordBitrateKbps: nichts,
    setControlEnabled: nichts,
    setControlPort: nichts,
    setAudioInputId: nichts,
    setNdiOutputName: nichts,
    setNdiOutputSource: nichts,
    setProgramResolution: nichts,
    setOutputFps: nichts,
    setSecondScreenEnabled: nichts,
    setSecondScreenDisplayId: nichts,
    ...z,
  };
}

export const PRIMAERER_MONITOR: DisplayInfo = { id: 11, label: '2560×1440', width: 2560, height: 1440, primary: true };
export const ZWEITER_MONITOR: DisplayInfo = { id: 22, label: '1920×1080', width: 1920, height: 1080, primary: false };

/** Grundstand: alles aus, alle Messungen da (Master aus, Monitore bekannt, Steuerserver meldet „läuft“). */
export function basisStand(z: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return {
    settings: basisEinstellungen(),
    output: { recording: false, streaming: false, recPath: null, error: null, errorScope: null },
    ndi: { active: false, name: '', connections: 0, error: null },
    audio: { hasDevice: false, muted: false, gain: 1, level: 0, error: null, getrennt: false },
    audioGeraete: [{ id: 'mic1', label: 'Mikrofon 1' }],
    displays: [PRIMAERER_MONITOR, ZWEITER_MONITOR],
    masterLink: { art: 'aus' },
    fernsteuerung: basisMeldung(),
    canTake: true,
    canAuto: true,
    transitioning: false,
    ...z,
  };
}

// ── Lesehilfen für gerendertes HTML (Aufgabe d; wie apps/titler/test/ui/testzustand.ts) ──

/** Aktionen, die jeden Aufruf mitschreiben (für Prop-Bauer und Knöpfe ohne DOM). */
export function protokollAktionen(log: string[]): SwitcherAktionen {
  const m = <A extends unknown[]>(name: string) => (...a: A): void => void log.push(`${name} ${JSON.stringify(a)}`);
  return {
    setRtmpUrl: m('setRtmpUrl'),
    setStreamBitrateKbps: m('setStreamBitrateKbps'),
    setRecordBitrateKbps: m('setRecordBitrateKbps'),
    setControlEnabled: m('setControlEnabled'),
    setControlPort: m('setControlPort'),
    setAudioInputId: m('setAudioInputId'),
    setNdiOutputName: m('setNdiOutputName'),
    setNdiOutputSource: m('setNdiOutputSource'),
    setProgramResolution: m('setProgramResolution'),
    setOutputFps: m('setOutputFps'),
    setSecondScreenEnabled: m('setSecondScreenEnabled'),
    setSecondScreenDisplayId: m('setSecondScreenDisplayId'),
    toggleNdiOutput: m('toggleNdiOutput'),
    toggleRecording: m('toggleRecording'),
    toggleStreaming: m('toggleStreaming'),
    scanAudio: m('scanAudio'),
    scanDisplays: m('scanDisplays'),
  };
}

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare, auch JSX-Kommentare), für Prüfungen am Code. */
export function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function entities(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Alle öffnenden Tags eines Elements, z. B. tags(html, 'button'). */
export function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}(?=[\\s>/])[^>]*>`, 'g')) ?? [];
}

/** Wert eines Attributs in einem öffnenden Tag (Entities aufgelöst), sonst undefined. */
export function attr(tag: string | undefined, name: string): string | undefined {
  const m = tag?.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? entities(m[1]) : undefined;
}

/** Text ohne Tags (Entities aufgelöst). */
export function text(html: string): string {
  return entities(html.replace(/<[^>]+>/g, ''));
}

/** Statuseinträge der Leiste in Reihenfolge: [id, Zustand, Tooltip „Label: Detail“]. */
export function statusEintraege(html: string): Array<[string | undefined, string | undefined, string | undefined]> {
  return [...html.matchAll(/<(?:button|span)\s[^>]*data-status-id="[^"]*"[^>]*>/g)].map((m) => [
    attr(m[0], 'data-status-id'),
    attr(m[0], 'data-state'),
    attr(m[0], 'title'),
  ]);
}

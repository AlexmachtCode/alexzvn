// --- @jm/settings: Audiogerät (Spec 6.2 Absatz Audiogerät, Regeln 7.1–7.3, Plan E11, E17) ---
//
// Der Abschnitt kennt nur `{ id, label }` (Browser-Geräte und PortAudio übersetzt die App). Ein
// gewähltes Gerät, das in der gemeldeten Liste fehlt, bleibt gewählt: Die Auswahl zeigt
// „nicht verfügbar: …“, der Status „Gerät nicht gefunden, zuletzt: {name}“. Nie still auf Standard.
import { UNBEKANNT, zahlText, type SelectOption, type StatusState } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export interface AudioDeviceOption { id: string; label: string }           // Spec 6.2: nur {id,label}

export interface AudioChoice {
  key: string; label: string; direction: 'input' | 'output';
  devices?: AudioDeviceOption[];     // gemessen; undefined = Liste unbekannt
  value: string;                     // '' = Standard bzw. keine Wahl
  defaultLabel?: string;             // Text der Option '' (z. B. „System-Standard“); fehlt → '' heißt „nicht gewählt“
  required?: boolean;                // '' ist ein Fehlzustand
  lastLabel?: string;                // Name des zuletzt gewählten Geräts
  levelDb?: number;                  // nur mit capabilities.level; undefined = kein Pegel (keine Anzeige), -Infinity = kein Signal
  lockedReason?: string;
  changeWarning?: string;
  onChange?(id: string): void;
}

export interface AudioDeviceSectionProps extends SectionInput {
  choices: AudioChoice[];
  capabilities: { level?: boolean; refresh?: boolean };
  onRefresh?(): void;
}

export const AUDIO_TEXTE = {
  titel: 'Audiogerät',
  nichtGefundenZuletzt: (name: string) => `Gerät nicht gefunden, zuletzt: ${name}`,
  nichtGefunden: 'Gerät nicht gefunden',
  keinGeraet: 'kein Gerät gewählt',
  geraeteGewaehlt: (n: number) => `${zahlText(n)} Geräte gewählt`,
  wahlPraefix: (wahl: string, text: string) => `${wahl}: ${text}`,
  keinEingang: 'Kein Eingang gefunden',
  keinAusgang: 'Kein Ausgang gefunden',
  pegelWert: (db: number) => `Pegel: ${zahlText(Math.round(db) || 0)} dB`,   // || 0: -0,4 dB ergäbe sonst „-0 dB“
  keinSignal: 'Pegel: kein Signal',
  aktualisieren: 'Geräte aktualisieren',
  sperreEingangOffen: 'solange der Eingang offen ist',
  wechselStoppt: 'Ein Wechsel stoppt die laufende Verarbeitung',
  unbekannt: UNBEKANNT,
} as const;

/** Untere Grenze der Pegelanzeige in dB (0 dB = voll). */
export const PEGEL_MIN_DB = -60;

export interface AudioWahlView {
  key: string;
  label: string;
  status: SectionStatus;
  listeBekannt: boolean;             // devices !== undefined
  optionen: SelectOption[];          // '' (mit defaultLabel) + Geräte; ein fehlender Wert ergänzt Select selbst
  platzhalter?: string;              // „– bitte wählen –“, wenn '' keine echte Option ist
  hinweis?: string;                  // Leerliste und Wechsel-Warnung
  pegel?: { text: string; prozent: number };   // nur mit capabilities.level und gemessenem levelDb (jede Richtung)
}

export interface AudioDeviceView extends SectionBase {
  sichtbar: { aktualisieren: boolean };
  wahlen: AudioWahlView[];
}

const RANG: Record<StatusState, number> = { ok: 0, off: 1, warn: 2, error: 3, live: 4 };

function wahlStatus(c: AudioChoice): SectionStatus {
  if (c.devices === undefined) return STATUS_UNBEKANNT;
  if (c.value !== '') {
    const geraet = c.devices.find((d) => d.id === c.value);
    if (geraet) return st('ok', geraet.label || geraet.id);
    return st('error', c.lastLabel ? AUDIO_TEXTE.nichtGefundenZuletzt(c.lastLabel) : AUDIO_TEXTE.nichtGefunden);
  }
  if (c.required === true) return st('warn', AUDIO_TEXTE.keinGeraet);
  if (c.devices.length === 0) return st('off', AUDIO_TEXTE.keinGeraet);   // leere gemessene Liste: auch den Systemstandard gibt es nicht (Spec 7, Regel 3)
  if (c.defaultLabel) return st('ok', c.defaultLabel);
  return st('off', AUDIO_TEXTE.keinGeraet);
}

/** Gemessen ist eine endliche Zahl oder -Infinity (kein Signal); NaN und +Infinity sind keine Messung (E26). */
function gemessen(db: number | undefined): db is number {
  return db === -Infinity || (typeof db === 'number' && Number.isFinite(db));
}

function pegel(db: number): { text: string; prozent: number } {
  if (db === -Infinity) return { text: AUDIO_TEXTE.keinSignal, prozent: 0 };
  const prozent = Math.round(Math.min(1, Math.max(0, (db - PEGEL_MIN_DB) / -PEGEL_MIN_DB)) * 100);
  return { text: AUDIO_TEXTE.pegelWert(db), prozent };
}

function wahlView(c: AudioChoice, level: boolean): AudioWahlView {
  const leer = c.devices !== undefined && c.devices.length === 0 ? (c.direction === 'input' ? AUDIO_TEXTE.keinEingang : AUDIO_TEXTE.keinAusgang) : undefined;
  const hinweis = [leer, c.changeWarning].filter((t): t is string => typeof t === 'string' && t !== '').join(' ');
  return {
    key: c.key,
    label: c.label,
    status: wahlStatus(c),
    listeBekannt: c.devices !== undefined,
    optionen: [
      ...(c.defaultLabel ? [{ value: '', label: c.defaultLabel }] : []),
      ...(c.devices ?? []).map((d) => ({ value: d.id, label: d.label || d.id })),
    ],
    platzhalter: c.defaultLabel ? undefined : ABSCHNITT_TEXTE.bitteWaehlen,
    hinweis: hinweis === '' ? undefined : hinweis,
    pegel: level && gemessen(c.levelDb) ? pegel(c.levelDb) : undefined,
  };
}

function audioStatus(p: AudioDeviceSectionProps, wahlen: readonly AudioWahlView[]): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (wahlen.length === 0) return st('off', AUDIO_TEXTE.keinGeraet);
  if (wahlen.length === 1) return wahlen[0].status;
  const schlimmste = Math.max(...wahlen.map((w) => RANG[w.status.state]));
  if (schlimmste === RANG.ok) return st('ok', AUDIO_TEXTE.geraeteGewaehlt(wahlen.length));
  const erste = wahlen.find((w) => RANG[w.status.state] === schlimmste) as AudioWahlView;
  return { state: erste.status.state, text: AUDIO_TEXTE.wahlPraefix(erste.label, erste.status.text) };
}

export function audioDeviceView(p: AudioDeviceSectionProps): AudioDeviceView {
  const wahlen = p.choices.map((c) => wahlView(c, p.capabilities.level === true));
  return {
    id: p.id,
    status: audioStatus(p, wahlen),
    locked: p.locked,
    error: p.error,
    sichtbar: { aktualisieren: p.capabilities.refresh === true && typeof p.onRefresh === 'function' },
    wahlen,
  };
}

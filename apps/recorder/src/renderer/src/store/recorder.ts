import { create } from 'zustand';
import type {
  AudioDevice,
  GemerkterEingang,
  RecEinstellungen,
  RecPreset,
  RecorderState,
  RecShowSettings,
} from '@shared/types';
import { findeEingang } from '../../../shared/einstellungen';
import { gleicheDefinierteWerte, istNetzwerkPfad, PRESET_NAME_MAX, presetWerte, saeubereAnzeige } from '../../../shared/presets';

const IDLE: RecorderState = {
  status: 'idle',
  device: null,
  channels: 0,
  sampleRate: 0,
  filePath: null,
  recordedSec: 0,
};

/** Wartezeit, bis eine Änderung in die Einstellungsdatei geht — Tippen im Dateinamen schreibt nicht je Taste. */
export const MERK_VERZOEGERUNG_MS = 300;

// Bis 0.7.0 lag nur die Verstärkung in localStorage. Wird beim ersten Start mit 0.8.0 einmal
// übernommen, wenn die Einstellungsdatei noch keine Verstärkung kennt (#291).
const GAIN_KEY = 'jmrec.gainDb';
const GAIN_MIN = -12;
const GAIN_MAX = 24;
function clampGain(db: number): number {
  return Math.max(GAIN_MIN, Math.min(GAIN_MAX, Math.round(Number.isFinite(db) ? db : 0)));
}
function loadAltGain(): number {
  try {
    return clampGain(Number(localStorage.getItem(GAIN_KEY)));
  } catch {
    return 0;
  }
}

interface RecStore {
  devices: AudioDevice[];
  deviceIndex: number | null;
  channels: number;
  sampleRate: number;
  dir: string | null;
  fileName: string;
  separateTracks: boolean;
  /** Geplante Startzeit als datetime-local-Wert; '' = sofort starten. */
  scheduleStart: string;
  /** Auto-Stopp nach N Minuten; 0 = bis zum manuellen Stopp. */
  scheduleDurationMin: number;
  /** Aufnahme-Verstärkung in dB (#94). */
  gainDb: number;
  state: RecorderState;
  peaks: number[];
  notice: string | null;
  /** Bleibt stehen, bis es sich erledigt: gemerkter Eingang beim Start nicht gefunden (#291). */
  hinweisEingang: string | null;
  /** Bleibt stehen, bis es sich erledigt: gemerkter Zielordner beim Start nicht erreichbar (#291). */
  hinweisOrdner: string | null;
  loading: boolean;
  /** Gespeicherte Presets (Namen sortiert, wie der Main sie liefert). */
  presets: RecPreset[];
  /** Name des zuletzt angewendeten/gespeicherten Presets; null = „— kein Preset —“. */
  aktivesPreset: string | null;

  init: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  selectDevice: (index: number) => void;
  setChannels: (n: number) => void;
  setSampleRate: (n: number) => void;
  setFileName: (s: string) => void;
  setSeparateTracks: (v: boolean) => void;
  setScheduleStart: (s: string) => void;
  setScheduleDurationMin: (n: number) => void;
  setGain: (db: number) => void;
  pickDir: () => Promise<void>;
  /** true = Eingang offen, false = nicht geöffnet (Grund steht in `notice`). */
  arm: () => Promise<boolean>;
  disarm: () => Promise<void>;
  record: () => Promise<void>;
  stop: () => Promise<void>;
  schedule: () => Promise<void>;
  cancelSchedule: () => Promise<void>;
  setNotice: (s: string | null) => void;
  hinweiseSchliessen: () => void;
  presetAnwenden: (name: string) => Promise<void>;
  /** Überschreibt ohne Rückfrage — die fragt die UI. */
  presetSpeichern: (name: string) => Promise<void>;
  presetLoeschen: (name: string) => Promise<void>;
  /** „— kein Preset —“: die Werte bleiben, nur der Bezug fällt weg. */
  presetAbwaehlen: () => void;
  presetsExportieren: () => Promise<void>;
  presetsImportieren: () => Promise<void>;
}

let subscribed = false;

/**
 * Gemerkter Eingang, der beim Start fehlte (z. B. Dante Virtual Soundcard noch nicht gestartet).
 * Solange niemand selbst einen Eingang wählt, bleibt ER gemerkt — samt Kanälen und Samplerate —
 * und nicht die Ersatz-Vorauswahl. „Aktualisieren" sucht ihn erneut.
 */
let vorbehalt: { eingang: GemerkterEingang; channels?: number; sampleRate?: number } | null = null;

/**
 * Preset-Anwenden läuft nacheinander: Pfeiltasten/Buchstaben auf der Auswahl feuern je Schritt.
 * `anwendenKette` = Ende des zuletzt angestellten Laufs (null = keiner läuft).
 */
let anwendenKette: Promise<void> | null = null;
let anwendenNr = 0;

/** Begrenzungen für Kanäle und Samplerate — Setter und Show-Vorgaben benutzen dieselben. */
const kanaele = (n: number): number => Math.max(1, Math.floor(n) || 1);
const rate = (n: number): number => Math.max(8000, Math.floor(n) || 48000);

function eingangsText(e: GemerkterEingang): string {
  return `„${e.name}“ (${e.hostApiName})`;
}

export const useRec = create<RecStore>((set, get) => {
  /** Gemerkten Eingang wählen und seine Kanäle (aufs Gerät begrenzt) + Samplerate setzen. */
  const waehleGemerkt = (d: AudioDevice, channels?: number, sampleRate?: number): void => {
    get().selectDevice(d.index);
    if (channels) set({ channels: Math.max(1, Math.min(channels, d.maxInputChannels)) });
    if (sampleRate) get().setSampleRate(sampleRate);
  };

  /** Ein Preset anwenden (läuft nur über die Kette in `presetAnwenden`). */
  const wendeAn = async (name: string): Promise<void> => {
    const p = get().presets.find((x) => x.name === name);
    if (!p) return;
    const st = get().state;
    if (st.status === 'recording' || st.scheduledStartAt != null) {
      set({ notice: 'Während einer laufenden oder geplanten Aufnahme lässt sich kein Preset anwenden.' });
      return;
    }
    const w = p.werte;
    // Aktives Preset und Werte im selben synchronen Schritt, vor jedem await — sonst blitzt
    // „(geändert)“ auf und das Merken schriebe die neuen Werte unter dem alten Namen.
    set({ aktivesPreset: name });
    // Ordner, Dateiname, Einzelspuren, Dauer, Verstärkung — fehlendes Feld = aktueller Wert bleibt.
    if (typeof w.dir === 'string') set({ dir: w.dir });
    if (typeof w.fileName === 'string') set({ fileName: w.fileName });
    if (typeof w.separateTracks === 'boolean') set({ separateTracks: w.separateTracks });
    if (typeof w.scheduleDurationMin === 'number') get().setScheduleDurationMin(w.scheduleDurationMin);
    if (typeof w.gainDb === 'number') get().setGain(w.gainDb);
    // Eingang samt Kanälen + Samplerate; fehlt das Gerät, bleibt es gemerkt (wie beim Start).
    if (w.eingang) {
      const d = findeEingang(get().devices, w.eingang);
      if (d) {
        waehleGemerkt(d, w.channels, w.sampleRate);
      } else {
        vorbehalt = { eingang: w.eingang, channels: w.channels, sampleRate: w.sampleRate };
        set({
          hinweisEingang:
            `Eingang des Presets „${name}“ nicht gefunden: ${eingangsText(w.eingang)}.` +
            ' Gerät/Treiber starten und „Geräte aktualisieren“ drücken.',
        });
      }
    } else {
      const d = get().devices.find((x) => x.index === get().deviceIndex);
      if (w.channels) get().setChannels(d ? Math.min(w.channels, d.maxInputChannels) : w.channels);
      if (w.sampleRate) get().setSampleRate(w.sampleRate);
    }
    // Offener Eingang, der nicht dem Soll entspricht → neu öffnen. Maßgeblich ist der Ist-Zustand
    // vom Main, nicht „vorher/nachher“ im Renderer.
    let neu = '';
    let offen = true;
    const soll = get();
    const ist = soll.state;
    if (
      ist.status === 'armed' &&
      (ist.device !== soll.deviceIndex || ist.channels !== soll.channels || ist.sampleRate !== soll.sampleRate)
    ) {
      try {
        await get().disarm();
        offen = await get().arm();
      } catch (e) {
        offen = false;
        set({ notice: (e as Error).message });
      }
      neu = ' Eingang neu geöffnet.';
    }
    // Erst nach dem Gerätewechsel: ein unerreichbares NAS hält das Neuöffnen nicht auf.
    if (w.dir) {
      let da = true;
      try {
        da = await window.jmrec.ordnerDa(w.dir);
      } catch {
        // nicht prüfbar → nicht als fehlend melden
      }
      set({
        hinweisOrdner: da
          ? null
          : `Zielordner des Presets „${name}“ nicht erreichbar: ${w.dir} — neuen Ordner wählen und das Preset neu speichern.`,
      });
    }
    // Scheitert das Neuöffnen, steht dessen Fehlertext schon in `notice` — nicht überschreiben.
    set({
      notice: offen
        ? `Preset „${name}“ angewendet.${neu}`
        : `Preset „${name}“ angewendet – der Eingang ließ sich nicht wieder öffnen: ${get().notice ?? ''}`,
    });
  };

  return {
    devices: [],
    deviceIndex: null,
    channels: 2,
    sampleRate: 48000,
    dir: null,
    fileName: '',
    separateTracks: false,
    scheduleStart: '',
    scheduleDurationMin: 0,
    gainDb: 0,
    state: IDLE,
    peaks: [],
    notice: null,
    hinweisEingang: null,
    hinweisOrdner: null,
    loading: true,
    presets: [],
    aktivesPreset: null,

    setNotice: (notice) => set({ notice }),
    hinweiseSchliessen: () => set({ hinweisEingang: null, hinweisOrdner: null }),

    presetAnwenden: (name) => {
      const nr = ++anwendenNr;
      // Läuft gerade keins, sofort (die Werte stehen dann synchron); sonst hinten anstellen.
      // Wer wartet und von einem neueren Aufruf überholt wird, entfällt.
      const lauf = anwendenKette
        ? anwendenKette.then(() => (nr === anwendenNr ? wendeAn(name) : undefined))
        : wendeAn(name);
      const kette: Promise<void> = lauf
        .catch(() => {})
        .then(() => {
          if (anwendenKette === kette) anwendenKette = null;
        });
      anwendenKette = kette;
      return lauf;
    },

    presetSpeichern: async (name) => {
      // Wie der Main kürzt (normierePreset) — sonst passte das aktive Preset zu keinem gespeicherten.
      const n = name.trim().slice(0, PRESET_NAME_MAX).trim();
      if (!n) {
        set({ notice: 'Bitte einen Namen für das Preset eingeben.' });
        return;
      }
      try {
        const presets = await window.jmrec.presets.speichern({ name: n, werte: presetWerte(aktuelleWerte(get())) });
        set({ presets, aktivesPreset: n, notice: `Preset „${n}“ gespeichert.` });
      } catch (e) {
        set({ notice: `Preset konnte nicht gespeichert werden: ${(e as Error).message}` });
      }
    },

    presetLoeschen: async (name) => {
      try {
        const presets = await window.jmrec.presets.loeschen(name);
        set({
          presets,
          aktivesPreset: get().aktivesPreset === name ? null : get().aktivesPreset,
          notice: `Preset „${name}“ gelöscht.`,
        });
      } catch (e) {
        set({ notice: `Preset konnte nicht gelöscht werden: ${(e as Error).message}` });
      }
    },

    presetAbwaehlen: () => {
      anwendenNr++; // ein wartendes Anwenden entfällt; ein laufendes endet noch
      set({ aktivesPreset: null });
    },

    presetsExportieren: async () => {
      try {
        const r = await window.jmrec.presets.exportieren();
        if (r.ok) set({ notice: r.meldung ?? null });
        else if (r.error) set({ notice: r.error });
      } catch (e) {
        set({ notice: `Export fehlgeschlagen: ${(e as Error).message}` });
      }
    },

    presetsImportieren: async () => {
      try {
        const r = await window.jmrec.presets.importieren();
        if (r.ok) set({ presets: r.presets ?? get().presets, notice: r.meldung ?? null });
        else if (r.error) set({ notice: r.error });
      } catch (e) {
        set({ notice: `Import fehlgeschlagen: ${(e as Error).message}` });
      }
    },

    init: async () => {
      // Show-Integration (C3): geprüfte Voreinstellungen aus der .jmshow auf den Store anwenden.
      // channels/sampleRate mit derselben Begrenzung wie die Setter, aber direkt: ein Vorbehalt
      // auf einen fehlenden Eingang bleibt stehen.
      const applyShowSettings = (s: RecShowSettings): void => {
        if (typeof s.dir === 'string') {
          set({
            dir: s.dir,
            hinweisOrdner: istNetzwerkPfad(s.dir)
              ? `Zielordner aus der Show liegt im Netzwerk: ${saeubereAnzeige(s.dir)} – nur verwenden, wenn dieser Ordner bekannt ist.`
              : null,
          });
        }
        if (typeof s.fileName === 'string') set({ fileName: s.fileName });
        if (typeof s.separateTracks === 'boolean') set({ separateTracks: s.separateTracks });
        // Show schlägt gemerkt: auch im Vorbehalt (fehlender Eingang) gelten die Show-Werte, wenn er zurückkommt.
        if (typeof s.channels === 'number') {
          const c = kanaele(s.channels);
          set({ channels: c });
          if (vorbehalt) vorbehalt = { ...vorbehalt, channels: c };
        }
        if (typeof s.sampleRate === 'number') {
          const r = rate(s.sampleRate);
          set({ sampleRate: r });
          if (vorbehalt) vorbehalt = { ...vorbehalt, sampleRate: r };
        }
      };
      if (subscribed) return;
      subscribed = true;
      window.jmrec.onLevels((l) => set({ peaks: l.peaks }));
      window.jmrec.onState((s) => set({ state: s }));
      window.jmrec.onNotice((msg) => set({ notice: msg }));
      // TCP-Fernsteuerung (Companion): Befehle auf die Store-Aktionen abbilden.
      window.jmrec.onRemoteCommand((cmd) => {
        const s = get();
        switch (cmd.t) {
          case 'record':
            if (cmd.mode === 'off') void s.stop();
            else if (cmd.mode === 'on') void s.record();
            else s.state.status === 'recording' ? void s.stop() : void s.record();
            break;
          case 'arm':
            void s.arm();
            break;
          case 'disarm':
            void s.disarm();
            break;
        }
      });
      // Show-Voreinstellungen, die zur Laufzeit per Deep-Link ankommen. Kommt eine noch während
      // des Wiederherstellens, wird sie gehalten und danach angewandt — sonst überschrieben die
      // gemerkten Werte sie (#291, Review).
      let wiederhergestellt = false;
      let frueheShow: RecShowSettings | null = null;
      window.jmrec.onShowSettings((s) => {
        if (wiederhergestellt) applyShowSettings(s);
        else frueheShow = { ...(frueheShow ?? {}), ...s };
      });

      // Gemerkte Einstellungen (#291). Reihenfolge: gemerkt → Show schlägt gemerkt.
      const { einstellungen: e, ordnerDa } = await window.jmrec.settings.load();
      set({
        dir: e.dir ?? null,
        fileName: e.fileName ?? '',
        separateTracks: e.separateTracks ?? false,
        scheduleDurationMin: e.scheduleDurationMin ?? 0,
        gainDb: e.gainDb ?? loadAltGain(),
        hinweisOrdner:
          e.dir && ordnerDa === false
            ? `Gemerkter Zielordner nicht erreichbar: ${e.dir} — Laufwerk prüfen oder neuen Ordner wählen.`
            : null,
      });
      // Presets + das zuletzt aktive — VOR dem Merken, damit der Start nichts speichert.
      let presets: RecPreset[] = [];
      try {
        presets = await window.jmrec.presets.list();
      } catch {
        // Presets sind Beiwerk — der Start darf daran nicht scheitern
      }
      set({ presets, aktivesPreset: e.preset && presets.some((p) => p.name === e.preset) ? e.preset : null });
      // Main startet bei 0 dB → gemerkte Verstärkung hineinspiegeln.
      void window.jmrec.setGain(get().gainDb);

      await get().refreshDevices(); // wählt wie bisher vor (Dante → ASIO → erstes)
      if (e.eingang) {
        const d = findeEingang(get().devices, e.eingang);
        if (d) {
          waehleGemerkt(d, e.channels, e.sampleRate);
        } else {
          const ersatz = get().devices.find((x) => x.index === get().deviceIndex);
          vorbehalt = { eingang: e.eingang, channels: e.channels, sampleRate: e.sampleRate };
          set({
            hinweisEingang:
              `Gemerkter Eingang ${eingangsText(e.eingang)} nicht gefunden` +
              (ersatz ? ` — vorerst gewählt: „${ersatz.name}“.` : '.') +
              ' Gerät/Treiber starten und „Geräte aktualisieren“ drücken.',
          });
        }
      }

      // Kaltstart: ausstehende Show-Voreinstellungen NACH Gerätewahl und gemerkten Werten
      // anwenden, damit die Show channels/sampleRate überschreibt (nicht umgekehrt).
      const pending = await window.jmrec.takeShowSettings();
      if (pending) applyShowSettings(pending);
      if (frueheShow) applyShowSettings(frueheShow); // jünger als der Kaltstart-Puffer
      wiederhergestellt = true;
      set({ loading: false });
      starteMerken();
    },

    refreshDevices: async () => {
      try {
        const devices = await window.jmrec.listDevices();
        set({ devices });
        // Ein beim Start fehlender gemerkter Eingang ist jetzt da → ihn nehmen.
        if (vorbehalt) {
          const v = vorbehalt;
          const d = findeEingang(devices, v.eingang);
          if (d) {
            waehleGemerkt(d, v.channels, v.sampleRate);
            set({ hinweisEingang: null, notice: `Gemerkter Eingang „${d.name}“ wieder da und gewählt.` });
          }
        }
        // Vorauswahl: bevorzugt ein ASIO-/Dante-Gerät, sonst das erste.
        if (get().deviceIndex == null && devices.length) {
          const preferred =
            devices.find((d) => /dante/i.test(d.name)) ??
            devices.find((d) => /asio/i.test(d.hostApiName)) ??
            devices[0];
          get().selectDevice(preferred.index);
        }
      } catch (e) {
        set({ notice: (e as Error).message });
      }
    },

    selectDevice: (index) => {
      const d = get().devices.find((x) => x.index === index);
      if (!d) return;
      // Wer selbst einen Eingang wählt, ersetzt den gemerkten (auch einen fehlenden).
      vorbehalt = null;
      set({
        deviceIndex: index,
        channels: Math.min(d.maxInputChannels, 2) || 1,
        sampleRate: d.defaultSampleRate || 48000,
        hinweisEingang: null,
      });
    },
    // Wer Kanäle oder Samplerate selbst setzt, beendet den Vorbehalt auf den fehlenden Eingang.
    setChannels: (n) => {
      if (vorbehalt) {
        vorbehalt = null;
        set({ hinweisEingang: null });
      }
      set({ channels: kanaele(n) });
    },
    setSampleRate: (n) => {
      if (vorbehalt) {
        vorbehalt = null;
        set({ hinweisEingang: null });
      }
      set({ sampleRate: rate(n) });
    },
    setFileName: (fileName) => set({ fileName }),
    setSeparateTracks: (separateTracks) => set({ separateTracks }),
    setScheduleStart: (scheduleStart) => set({ scheduleStart }),
    setScheduleDurationMin: (scheduleDurationMin) =>
      set({ scheduleDurationMin: Math.max(0, Math.floor(scheduleDurationMin) || 0) }),

    setGain: (db) => {
      const gainDb = clampGain(db);
      set({ gainDb });
      void window.jmrec.setGain(gainDb);
    },

    pickDir: async () => {
      const dir = await window.jmrec.dialog.pickDir();
      if (dir) set({ dir, hinweisOrdner: null });
    },

    arm: async () => {
      const { deviceIndex, channels, sampleRate } = get();
      if (deviceIndex == null) {
        set({ notice: 'Kein Eingang gewählt.' });
        return false;
      }
      const res = await window.jmrec.arm({ device: deviceIndex, channels, sampleRate });
      if (!res.ok) set({ notice: res.error ?? 'Eingang konnte nicht geöffnet werden.' });
      return res.ok;
    },

    disarm: async () => {
      await window.jmrec.disarm();
      set({ peaks: [] });
    },

    record: async () => {
      let dir = get().dir;
      if (!dir) {
        await get().pickDir();
        dir = get().dir;
        if (!dir) return;
      }
      const res = await window.jmrec.startRecording({
        dir,
        fileName: get().fileName,
        separateTracks: get().separateTracks,
      });
      if (!res.ok) set({ notice: res.error ?? 'Aufnahme konnte nicht gestartet werden.' });
    },

    stop: async () => {
      const res = await window.jmrec.stopRecording();
      if (res.ok && res.filePath) {
        const mehr = (res.files?.length ?? 1) - 1;
        set({ notice: `Gespeichert: ${res.filePath}${mehr > 0 ? ` (+ ${mehr} Folgedatei${mehr > 1 ? 'en' : ''})` : ''}` });
      } else if (!res.ok) {
        set({ notice: res.error ?? 'Stopp fehlgeschlagen.' });
      }
    },

    schedule: async () => {
      let dir = get().dir;
      if (!dir) {
        await get().pickDir();
        dir = get().dir;
        if (!dir) return;
      }
      const { scheduleStart, scheduleDurationMin } = get();
      // datetime-local liefert lokale Zeit ohne Zone — new Date(...) interpretiert sie lokal.
      const startMs = scheduleStart ? new Date(scheduleStart).getTime() : null;
      if (scheduleStart && (startMs == null || Number.isNaN(startMs))) {
        set({ notice: 'Ungültige Startzeit.' });
        return;
      }
      const base = startMs ?? Date.now();
      const stopMs = scheduleDurationMin > 0 ? base + scheduleDurationMin * 60_000 : null;
      const res = await window.jmrec.schedule({
        dir,
        fileName: get().fileName,
        separateTracks: get().separateTracks,
        startAt: startMs,
        stopAt: stopMs,
      });
      if (!res.ok) set({ notice: res.error ?? 'Planung fehlgeschlagen.' });
    },

    cancelSchedule: async () => {
      await window.jmrec.cancelSchedule();
    },
  };
});

/** Was gemerkt wird (#291). Ein beim Start fehlender Eingang bleibt gemerkt, bis jemand selbst wählt. */
export function aktuelleWerte(s: RecStore): RecEinstellungen {
  const d = s.devices.find((x) => x.index === s.deviceIndex);
  const e: RecEinstellungen = {
    eingang: d ? { name: d.name, hostApiName: d.hostApiName } : undefined,
    channels: s.channels,
    sampleRate: s.sampleRate,
    dir: s.dir ?? undefined,
    fileName: s.fileName,
    separateTracks: s.separateTracks,
    gainDb: s.gainDb,
    scheduleDurationMin: s.scheduleDurationMin,
    preset: s.aktivesPreset ?? undefined,
  };
  if (vorbehalt) {
    e.eingang = vorbehalt.eingang;
    e.channels = vorbehalt.channels;
    e.sampleRate = vorbehalt.sampleRate;
  }
  return e;
}

/** Weichen die aktuellen Werte vom aktiven Preset ab (nur in dessen gespeicherten Feldern)? Ohne aktives (oder gelöschtes) Preset: nein. */
export function presetGeaendert(s: RecStore): boolean {
  const p = s.aktivesPreset ? s.presets.find((x) => x.name === s.aktivesPreset) : undefined;
  return !!p && !gleicheDefinierteWerte(aktuelleWerte(s), p.werte);
}

/**
 * Ab jetzt jede Änderung merken. Erst nach dem Wiederherstellen gestartet — sonst überschriebe
 * der leere Anfangszustand die Datei. Vor dem Schließen wird eine wartende Änderung sofort geschrieben.
 */
function starteMerken(): void {
  let zuletzt = JSON.stringify(aktuelleWerte(useRec.getState()));
  let wartet: ReturnType<typeof setTimeout> | null = null;
  const schreibe = (): void => {
    if (wartet) clearTimeout(wartet);
    wartet = null;
    window.jmrec.settings.save(JSON.parse(zuletzt) as RecEinstellungen);
  };
  useRec.subscribe((s) => {
    const jetzt = JSON.stringify(aktuelleWerte(s));
    if (jetzt === zuletzt) return; // z. B. nur Pegel/Zustand geändert
    zuletzt = jetzt;
    if (wartet) clearTimeout(wartet);
    wartet = setTimeout(schreibe, MERK_VERZOEGERUNG_MS);
  });
  window.addEventListener('beforeunload', () => {
    if (wartet) schreibe();
  });
}

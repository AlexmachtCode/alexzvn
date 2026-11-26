// UX Welle 2a · Recorder-Ableitungen (Aufgabe c; E4 ON AIR nur recording, E7 Umschalter, E13, Spec 7.2): Statusleiste als
// Kreuzprodukt je Eintrag, vor der ersten Antwort, Eingang gesperrt, Meldung bis OK, Haupttasten, ON AIR, Texte und Quelltext.
// Ohne window und ohne Electron.
import * as settings from '@jm/settings';
import { AUDIO_TEXTE, REMOTE_TEXTE } from '@jm/settings';
import { formatUhrzeitKurz, MASTER_LINK_TEXTE, ordneStatus, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { AudioDevice, MasterLinkMeldungZeile, RecorderState, RecorderStatus } from '@shared/types';
import {
  ABSCHNITT,
  eingangAbschnitt,
  fernsteuerungAbschnitt,
  formatAbschnitt,
  hauptTasten,
  kopfOnAir,
  RECORDER_TEXTE,
  statusLeiste,
  type OberflaechenStand,
  type RecorderZustand,
} from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { basisMeldung, ohneKommentare } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8729';
const STATI: RecorderStatus[] = ['idle', 'armed', 'recording'];

const GERAETE: AudioDevice[] = [
  { index: 0, name: 'Dante Virtual Soundcard', hostApiName: 'ASIO', maxInputChannels: 64, defaultSampleRate: 48000 },
  { index: 3, name: 'Mikro', hostApiName: 'MME', maxInputChannels: 2, defaultSampleRate: 44100 },
];

function zustand(status: RecorderStatus, z: Partial<RecorderState> = {}): RecorderState {
  const offen = status !== 'idle';
  return { status, device: offen ? 3 : null, channels: offen ? 2 : 0, sampleRate: offen ? 44100 : 0, filePath: null, recordedSec: 0, fehler: null, spuren: false, ...z };
}
/** Wunsch (Kanäle 8, 96000) und Gemessenes (2, 44100) unterscheiden sich absichtlich: Offen darf nur das Gemessene zeigen. */
function recorder(z: Partial<RecorderZustand> = {}): RecorderZustand {
  return { deviceIndex: 0, channels: 8, sampleRate: 96000, state: zustand('idle'), loading: false, hinweisEingang: null, ...z };
}
function stand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  const s = { recorder: undefined, zustand: undefined, geraete: undefined, meldung: null, masterLink: undefined, fernsteuerung: undefined, ...teil };
  // Sonst folgt der gemessene Zustand dem Zustand des Store-Attrappe (die Fälle fragen „Main hat geantwortet“); wer ihn
  // trennen will, setzt `zustand` ausdrücklich (auch auf undefined).
  return 'zustand' in teil ? s : { ...s, zustand: s.recorder?.state };
}
const eintrag = (s: OberflaechenStand, id: string): StatusItem | undefined => statusLeiste(s).find((i) => i.id === id);
const sd = (i: StatusItem | undefined): string => (i === undefined ? 'fehlt' : `${i.state} ${i.detail ?? ''}`);

// ── RE ON AIR (E4): nur gemessenes recording, nie armed, nie ohne Store ──
{
  const faelle = kreuz({ status: [undefined, ...STATI], geraete: [undefined, GERAETE] } as const);
  pruefeFaelle('RE ON AIR: live nur bei recording (nie armed, nie ohne Store), Label REC', faelle, (f) => {
    const s = stand({ recorder: f.status === undefined ? undefined : recorder({ state: zustand(f.status) }), geraete: f.geraete });
    const a = kopfOnAir(s);
    return vergleiche(`${a.live}/${a.label}`, `${f.status === 'recording'}/REC`);
  });
}

// ── RE Statusleiste master-link ──
{
  const faelle: Array<{ name: string; m: MasterLinkMeldungZeile | null | undefined; soll: string }> = [
    { name: 'undefined', m: undefined, soll: 'off unbekannt' },
    { name: 'null', m: null, soll: 'off unbekannt' },
    { name: 'aus', m: { art: 'aus' }, soll: 'off aus' },
    { name: 'sucht', m: { art: 'sucht' }, soll: 'warn sucht …' },
    { name: 'verbunden', m: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1, masterName: 'Regie-PC', suite: 'JM Production Suite' }, soll: 'ok verbunden mit Regie-PC' },
  ];
  pruefeFaelle('RE Statusleiste master-link: Meldung → Zustand und Detail, Gruppe verbindung, ohne Abschnitt', faelle, (f) => {
    const i = eintrag(stand({ masterLink: f.m }), 'master-link');
    return vergleiche(sd(i), f.soll) ?? (i?.group !== 'verbindung' || i.settingsSection !== undefined ? 'Kopf falsch' : null);
  });
}

// ── RE Statusleiste fernsteuerung: Meldung × Modus (Port 8729) ──
{
  const MELDUNG: Record<string, FernsteuerungMeldung | null | undefined> = {
    undefined: undefined,
    null: null,
    aus: { laeuft: false, port: 8729, clients: 0 },
    belegt: { laeuft: false, port: 8729, clients: 0, fehler: BELEGT },
    fehler: { laeuft: false, port: 8729, clients: 0, fehler: 'listen EACCES: permission denied 0.0.0.0:8729' },
    bereit0: basisMeldung({ clients: 0 }),
    bereit3: basisMeldung({ clients: 3 }),
  };
  const SOLL: Record<string, string> = {
    undefined: 'off unbekannt',
    null: 'off unbekannt',
    aus: 'off aus',
    belegt: 'error Port belegt',
    fehler: 'error Fehler: listen EACCES: permission denied 0.0.0.0:8729',
    bereit0: 'ok bereit · 0 verbunden',
    bereit3: 'ok bereit · 3 verbunden',
  };
  const faelle = kreuz({ meldung: Object.keys(MELDUNG), modus: [undefined, 'open', 'secure'] } as const);
  pruefeFaelle('RE Statusleiste fernsteuerung: Meldung × Modus → unbekannt, aus, Port belegt, Fehler, bereit n verbunden', faelle, (f) => {
    const m = MELDUNG[f.meldung];
    const i = eintrag(stand({ fernsteuerung: m ? { ...m, modus: f.modus } : m }), 'fernsteuerung');
    return vergleiche(sd(i), SOLL[f.meldung]) ?? (i?.group !== 'fernsteuerung' || i.settingsSection !== ABSCHNITT.fernsteuerung ? 'Kopf falsch' : null);
  });
  const p = fernsteuerungAbschnitt(stand({ fernsteuerung: { laeuft: false, port: 0, clients: 0, fehler: BELEGT } }));
  gleich(
    [p.port, p.portInUse, p.error, p.companionModule, p.running],
    [8729, true, undefined, 'JM Audio Recorder', false],
    'RE Fernsteuerung-Abschnitt: Port 8729 auch bei gemeldetem 0, EADDRINUSE nur als portInUse, Companion-Modul',
  );
}

// ── RE Statusleiste eingang: Store × Liste × Wunsch × Hinweis (gemessen offen, Wunsch zu) ──
{
  const faelle = kreuz({
    status: [undefined, 'idle', 'armed', 'recording'],
    liste: ['undefined', 'sucht', 'bekannt'],
    wunsch: [null, 0, 99],
    hinweis: [null, 'Gemerkter Eingang „Dante“ nicht gefunden.'],
  } as const);
  pruefeFaelle('RE Statusleiste eingang: offen nur aus dem Gemessenen, zu zeigt den Wunsch und den Hinweis, nie ok ohne Messung', faelle, (f) => {
    const r = f.status === undefined ? undefined : recorder({ deviceIndex: f.wunsch, hinweisEingang: f.hinweis, loading: f.liste === 'sucht', state: zustand(f.status) });
    const geraete = f.liste === 'undefined' ? undefined : f.liste === 'sucht' ? [] : GERAETE;
    const i = eintrag(stand({ recorder: r, geraete }), 'eingang') as StatusItem;
    const ist = sd(i);
    const kopf = i.group !== 'tool' || i.settingsSection !== ABSCHNITT.eingang || i.label !== RECORDER_TEXTE.eingang.titel ? 'Kopf falsch' : null;
    if (kopf) return kopf;
    if (r === undefined) return vergleiche(ist, 'off unbekannt');
    const liste = f.liste === 'bekannt';
    if (f.status !== 'idle') {
      // Gemessen offen: Gerät 3 „Mikro“, 2 Kanäle, 44100 Hz (nie der Wunsch 8 ch, 96000 Hz).
      if (f.liste === 'undefined' || f.liste === 'sucht') return vergleiche(ist, 'ok offen · 2 ch · 44100 Hz');
      return vergleiche(ist, 'ok offen · Mikro · 2 ch · 44100 Hz');
    }
    if (f.hinweis !== null) return vergleiche(ist, `warn zu · ${f.hinweis}`);
    if (!liste) return vergleiche(ist, 'off unbekannt');
    if (f.wunsch === null) return vergleiche(ist, `warn zu · ${AUDIO_TEXTE.keinGeraet}`);
    if (f.wunsch === 99) return vergleiche(ist, `error zu · ${AUDIO_TEXTE.nichtGefunden}`);
    return vergleiche(ist, 'off zu · Dante Virtual Soundcard · 8 ch · 96000 Hz');
  });
  const unbekanntOffen = eintrag(stand({ recorder: recorder({ state: zustand('armed', { device: 77 }) }), geraete: GERAETE }), 'eingang');
  gleich(sd(unbekanntOffen), `error offen · ${AUDIO_TEXTE.nichtGefunden}`, 'RE Statusleiste eingang: offenes Gerät fehlt in der Liste → Fehler des Abschnitts, nicht ok');
}

// ── RE Statusleiste aufnahme: live nur bei recording ──
{
  const faelle = kreuz({ status: [undefined, ...STATI], datei: [null, 'D:\\Aufnahmen\\Vortrag 1.wav'] } as const);
  pruefeFaelle('RE Statusleiste aufnahme: live nur bei recording (mit Dateiname), armed und idle off, ohne Store unbekannt', faelle, (f) => {
    const r = f.status === undefined ? undefined : recorder({ state: zustand(f.status, { filePath: f.datei }) });
    const i = eintrag(stand({ recorder: r }), 'aufnahme');
    const soll = f.status === undefined ? 'off unbekannt' : f.status === 'recording' ? `live ${f.datei === null ? 'läuft' : 'Vortrag 1.wav'}` : `off ${RECORDER_TEXTE.aufnahme.keine}`;
    return vergleiche(sd(i), soll) ?? (i?.group !== 'ausgabe' ? 'Gruppe falsch' : null);
  });
}

// ── RE Statusleiste zeitplan: gemessene Zeiten × Status ──
{
  const start = new Date(2026, 10, 22, 14, 30).getTime();
  const stopp = new Date(2026, 10, 22, 15, 45).getTime();
  const uhr = (ms: number): string => formatUhrzeitKurz(new Date(ms).toISOString()) as string;
  const faelle = kreuz({ status: [undefined, ...STATI], start: [null, undefined, start], stopp: [null, undefined, stopp] } as const);
  pruefeFaelle('RE Statusleiste zeitplan: wartender Start (mit Stopp) und Auto-Stopp in der Aufnahme ok mit Uhrzeit, sonst off, ohne Store unbekannt', faelle, (f) => {
    const r = f.status === undefined ? undefined : recorder({ state: zustand(f.status, { scheduledStartAt: f.start, scheduledStopAt: f.stopp }) });
    const i = eintrag(stand({ recorder: r }), 'zeitplan');
    let soll = `off ${RECORDER_TEXTE.zeitplan.keiner}`;
    if (f.status === undefined) soll = 'off unbekannt';
    else if (typeof f.start === 'number') soll = `ok Start ${uhr(start)}${typeof f.stopp === 'number' ? ` · Auto-Stopp ${uhr(stopp)}` : ''}`;
    else if (f.status === 'recording' && typeof f.stopp === 'number') soll = `ok Auto-Stopp ${uhr(stopp)}`;
    return vergleiche(sd(i), soll) ?? (i?.group !== 'tool' ? 'Gruppe falsch' : null);
  });
}

// ── RE Statusleiste audio-modul: nur bei leerer Liste UND nicht beim Laden ──
{
  const faelle = kreuz({ liste: ['undefined', 'leer', 'bekannt'], laden: [undefined, true, false] } as const);
  pruefeFaelle('RE Statusleiste audio-modul: error „Audio-Modul fehlt“ nur bei leerer Liste und nicht loading, sonst kein Eintrag', faelle, (f) => {
    const r = f.laden === undefined ? undefined : recorder({ loading: f.laden });
    const geraete = f.liste === 'undefined' ? undefined : f.liste === 'leer' ? [] : GERAETE;
    const i = eintrag(stand({ recorder: r, geraete }), 'audio-modul');
    const da = f.liste === 'leer' && f.laden === false;
    return vergleiche(sd(i), da ? `error ${RECORDER_TEXTE.audioModul.fehlt}` : 'fehlt');
  });
}

// ── RE Meldung bleibt bis OK: Main-Meldung warn bis zur Quittung, Store-Meldung (Toast) ohne Eintrag ──
{
  const MELDUNG = 'Geplante Aufnahme konnte nicht starten.';
  // Dieselbe offene Meldung bleibt über jeden Zustandswechsel stehen (kein Ablaufen, kein Ersetzen durch den Store).
  const faelle = kreuz({ status: [undefined, ...STATI], fern: [undefined, basisMeldung()], liste: [undefined, GERAETE] } as const);
  pruefeFaelle('RE Meldung bleibt bis OK: offene Main-Meldung → warn mit dem Text, unabhängig von Zustand, Fernsteuerung und Liste', faelle, (f) => {
    const s = stand({
      recorder: f.status === undefined ? undefined : recorder({ state: zustand(f.status) }),
      fernsteuerung: f.fern,
      geraete: f.liste,
      meldung: MELDUNG,
    });
    const i = eintrag(s, 'meldung');
    return vergleiche(sd(i), `warn ${MELDUNG}`) ?? (i?.group !== 'tool' ? 'Gruppe falsch' : null);
  });
  // Quittung: null (die View setzt ihn auf Klick „OK“) → Eintrag weg; eine neuere Meldung ersetzt die ältere; Leerraum zählt nicht.
  const offen = stand({ recorder: recorder(), meldung: MELDUNG });
  const quittiert = { ...offen, meldung: null };
  const neuer = { ...quittiert, meldung: 'Planung abgebrochen.' };
  gleich(
    [sd(eintrag(offen, 'meldung')), sd(eintrag(quittiert, 'meldung')), sd(eintrag(neuer, 'meldung')), sd(eintrag({ ...offen, meldung: '  ' }, 'meldung'))],
    [`warn ${MELDUNG}`, 'fehlt', 'warn Planung abgebrochen.', 'fehlt'],
    'RE Meldung bleibt bis OK: Quittung (null) nimmt den Eintrag, eine neue Meldung zeigt sich wieder, Leerraum ist keine Meldung',
  );
  // Store-Meldung: nur `notice` des Stores gesetzt (Toast), keine Main-Meldung → kein Eintrag, in keinem Zustand.
  const toast = kreuz({ status: STATI, notice: ['Bitte einen Namen für das Preset eingeben.', 'Kein Eingang gewählt.', 'Gespeichert: D:\\a.wav'] } as const);
  pruefeFaelle('RE Meldung bleibt bis OK: Store-Meldung (notice, Toast) ergibt keinen Eintrag', toast, (f) =>
    vergleiche(sd(eintrag(stand({ recorder: recorder({ state: zustand(f.status), notice: f.notice }), geraete: GERAETE }), 'meldung')), 'fehlt'),
  );
}

// ── RE Statusleiste vor erster Antwort: jedes undefined ist unbekannt, nie ok, nie live ──
{
  const items = statusLeiste(stand());
  // Altfehler RE-PLATZ (Task 7, geänderte Erwartung): der Eintrag „Platz“ steht hinter der Aufnahme.
  gleich(items.map((i) => i.id), ['master-link', 'aufnahme', 'platz', 'fernsteuerung', 'eingang', 'zeitplan'], 'RE Statusleiste vor erster Antwort (Altfehler RE-PLATZ): Einträge in fester Reihenfolge, „platz“ hinter „aufnahme“, ohne audio-modul und meldung');
  pruefeFaelle('RE Statusleiste vor erster Antwort: jeder Eintrag off unbekannt', items.map((i) => ({ id: i.id })), (f) =>
    vergleiche(sd(items.find((i) => i.id === f.id)), 'off unbekannt'),
  );
  const mitListe = statusLeiste(stand({ geraete: GERAETE }));
  ok(mitListe.every((i) => i.state !== 'ok' && i.state !== 'live' && i.state !== 'error'), 'RE Statusleiste vor erster Antwort: eine Geräteliste allein macht den Eingang nicht ok');
  const gruppen = ordneStatus(statusLeiste(stand({ recorder: recorder(), geraete: GERAETE, meldung: 'x' }))).map((i) => i.group);
  gleich(gruppen, ['verbindung', 'ausgabe', 'ausgabe', 'fernsteuerung', 'tool', 'tool', 'tool'], 'RE Statusleiste (Altfehler RE-PLATZ): Reihenfolge nach Gruppen (verbindung, ausgabe mit Aufnahme und Platz, fernsteuerung, tool)');
}

// ── RE Eingang gesperrt: bei offenem Eingang lockedReason, Format-Felder gesperrt ──
{
  const faelle = kreuz({ status: [undefined, ...STATI], liste: ['undefined', 'bekannt'] } as const);
  pruefeFaelle('RE Eingang gesperrt: offen (armed, recording) → Abschnitt und Wahl mit Grund, Format-Felder gesperrt; zu → frei', faelle, (f) => {
    const r = f.status === undefined ? undefined : recorder({ state: zustand(f.status) });
    const s = stand({ recorder: r, geraete: f.liste === 'undefined' ? undefined : GERAETE });
    const p = eingangAbschnitt(s);
    const fm = formatAbschnitt(s);
    const offen = f.status === 'armed' || f.status === 'recording';
    const grund = offen ? AUDIO_TEXTE.sperreEingangOffen : undefined;
    const ist = [p.locked, p.choices[0].lockedReason, fm.kanaele.lockedReason, fm.samplerate.lockedReason, fm.alleKanaele?.lockedReason].map((x) => x ?? '-').join('|');
    const soll = [grund, grund, grund, grund, f.liste === 'bekannt' ? grund : undefined].map((x) => x ?? '-').join('|');
    // Offen gilt das gemessene Gerät (3), zu der Wunsch (0), ohne Store keine Wahl.
    const wert = p.choices[0].value;
    const sollWert = offen ? '3' : r === undefined ? '' : '0';
    return vergleiche(`${ist}|${wert}`, `${soll}|${sollWert}`);
  });
  const p = eingangAbschnitt(stand({ recorder: recorder(), geraete: GERAETE }));
  gleich(
    [p.choices[0].devices?.map((d) => `${d.id}=${d.label}`), p.choices[0].required, p.capabilities, p.id],
    [['0=Dante Virtual Soundcard — ASIO (64 ch)', '3=Mikro — MME (2 ch)'], true, { refresh: true }, 'eingang'],
    'RE Eingang gesperrt: Wahl mit id = Geräteindex und Beschriftung Name — Treiber (n ch), Aktualisieren angeboten',
  );
  const aufrufe: string[] = [];
  const mitAktion = eingangAbschnitt(stand({ recorder: recorder(), geraete: GERAETE }), { geraetWaehlen: (i) => aufrufe.push(`wahl ${i}`), geraeteAktualisieren: () => aufrufe.push('neu') });
  mitAktion.choices[0].onChange?.('3');
  mitAktion.onRefresh?.();
  gleich(aufrufe, ['wahl 3', 'neu'], 'RE Eingang gesperrt: Aktionen laufen erst im Rückruf (Gerät als Zahl)');
  const fm = formatAbschnitt(stand({ recorder: recorder(), geraete: GERAETE }));
  gleich(
    [fm.kanaele.wert, fm.kanaele.max, fm.kanaele.min, fm.samplerate.wert, fm.samplerate.min, fm.alleKanaele?.kanaele, fm.asioHinweis, formatAbschnitt(stand({ recorder: recorder({ deviceIndex: 3 }), geraete: GERAETE })).asioHinweis],
    [8, 64, 1, 96000, 8000, 64, true, false],
    'RE Eingang gesperrt: Format zeigt den Wunsch, Grenzen vom gewählten Gerät, ASIO-Hinweis nur bei ASIO',
  );
}

// ── RE Haupttasten: Eingang öffnen/schließen (bereit, E7) und Aufnahme/Stopp (live nur recording) ──
{
  const faelle = kreuz({ r: ['ohne Store', 'sucht ohne Gerät', 'ohne Gerät', 'idle', 'armed', 'recording'] } as const);
  const SOLL: Record<string, string> = {
    'ohne Store': `Eingang öffnen/gesperrt/${RECORDER_TEXTE.grund.zustandOffen} | Aufnahme/gesperrt/${RECORDER_TEXTE.grund.zustandOffen}`,
    'sucht ohne Gerät': `Eingang öffnen/gesperrt/${RECORDER_TEXTE.grund.sucheGeraete} | Aufnahme/gesperrt/${RECORDER_TEXTE.grund.eingangZu}`,
    'ohne Gerät': `Eingang öffnen/gesperrt/${RECORDER_TEXTE.grund.keinEingang} | Aufnahme/gesperrt/${RECORDER_TEXTE.grund.eingangZu}`,
    idle: `Eingang öffnen/bereit/- | Aufnahme/gesperrt/${RECORDER_TEXTE.grund.eingangZu}`,
    armed: 'Eingang schließen/bereit/- | Aufnahme/bereit/-',
    // Altfehler RE-2: in der Aufnahme ist „Eingang schließen“ gesperrt mit dem Grund der Spec (bisher bereit, beendete die Aufnahme).
    recording: 'Eingang schließen/gesperrt/Erst die Aufnahme stoppen | Stopp/live/-',
  };
  pruefeFaelle('RE Haupttasten (Altfehler RE-2): je Zustand Beschriftung, Zustand und Sperrgrund (nie gesperrt ohne Grund, Eingang nie live, Aufnahme nur bei recording live, „Eingang schließen“ in der Aufnahme gesperrt)', faelle, (f) => {
    const r =
      f.r === 'ohne Store'
        ? undefined
        : f.r === 'sucht ohne Gerät'
          ? recorder({ deviceIndex: null, loading: true })
          : f.r === 'ohne Gerät'
            ? recorder({ deviceIndex: null })
            : recorder({ state: zustand(f.r as RecorderStatus) });
    const t = hauptTasten({ recorder: r, zustand: r?.state });
    const z = (x: { label: string; state: string; disabledReason?: string }): string => `${x.label}/${x.state}/${x.disabledReason ?? '-'}`;
    const grundFehlt = [t.eingang, t.aufnahme].some((x) => (x.state === 'gesperrt') !== (x.disabledReason !== undefined && x.disabledReason.trim() !== ''));
    return vergleiche(`${z(t.eingang)} | ${z(t.aufnahme)}`, SOLL[f.r]) ?? (grundFehlt || t.eingang.state === 'live' ? 'Grund oder live falsch' : null);
  });
  // Armed ist bereit, nie live: die Aufnahme-Taste zeigt erst bei gemessenem recording „Stopp“.
  gleich(hauptTasten({ recorder: recorder(), zustand: zustand('armed') }).aufnahme.state, 'bereit', 'RE Haupttasten: armed ist bereit, nicht live (E4)');
  // Fix-Runde 1 (Ruling): Im Ruhezustand gab es bisher keine Aufnahme-Taste; ein Start scheitert dort immer im Main. Die Taste ist
  // gesperrt, der Grund ist der Wortlaut der alten Meldung des Hauptprozesses ohne „(Arm).“ (src/main/recorder.ts).
  gleich(
    [hauptTasten({ recorder: recorder(), zustand: zustand('idle') }).aufnahme.state, hauptTasten({ recorder: recorder(), zustand: zustand('idle') }).aufnahme.disabledReason],
    ['gesperrt', 'Erst den Eingang öffnen'],
    'RE Haupttasten: im Ruhezustand ist Aufnahme gesperrt mit Grund „Erst den Eingang öffnen“',
  );
  ok(leseText('src/main/recorder.ts').includes(`'${RECORDER_TEXTE.grund.eingangZu} (Arm).'`), 'RE Haupttasten: der Sperrgrund ist der Wortlaut der Main-Meldung „Erst den Eingang öffnen (Arm).“ ohne den Zusatz');
}

// ── RE Zustand getrennt: der Vorgabewert des Stores ist keine Messung ──
{
  // Store frisch: state IDLE (Vorgabe), loading true, Main noch nicht gefragt → nichts behaupten.
  const frisch = stand({ recorder: recorder({ state: zustand('idle'), loading: true }), geraete: [], zustand: undefined });
  gleich(
    [sd(eintrag(frisch, 'aufnahme')), sd(eintrag(frisch, 'zeitplan')), sd(eintrag(frisch, 'eingang')), kopfOnAir(frisch).live],
    ['off unbekannt', 'off unbekannt', 'off unbekannt', false],
    'RE Zustand getrennt: Store-Vorgabe IDLE ohne gemessenen Zustand → aufnahme, zeitplan und eingang unbekannt, kein ON AIR',
  );
  const t = hauptTasten(frisch);
  gleich(
    [t.eingang.state, t.eingang.disabledReason, t.aufnahme.state, t.aufnahme.disabledReason],
    ['gesperrt', RECORDER_TEXTE.grund.zustandOffen, 'gesperrt', RECORDER_TEXTE.grund.zustandOffen],
    'RE Zustand getrennt: ohne gemessenen Zustand beide Haupttasten gesperrt mit sichtbarem Grund',
  );
  // Auch ein vollständig bereiter Store (Gerät gewählt, Liste da) ändert daran nichts, solange Main nicht geantwortet hat.
  const bereit = stand({ recorder: recorder({ loading: false }), geraete: GERAETE, zustand: undefined });
  const tb = hauptTasten(bereit);
  ok(tb.eingang.state === 'gesperrt' && tb.aufnahme.state === 'gesperrt' && sd(eintrag(bereit, 'eingang')) === 'off unbekannt', 'RE Zustand getrennt: bereiter Store ohne gemessenen Zustand bleibt gesperrt und unbekannt');
  // Verwechslung: gemessen recording, der Store steht noch auf IDLE → alles folgt `zustand`.
  const faelle = kreuz({ gemessen: STATI, vorgabe: STATI } as const);
  pruefeFaelle('RE Zustand getrennt: Ableitungen folgen zustand, nie recorder.state (Kreuzprodukt gemessen × Vorgabe)', faelle, (f) => {
    const s = stand({ recorder: recorder({ state: zustand(f.vorgabe) }), geraete: GERAETE, zustand: zustand(f.gemessen, { filePath: 'D:\\x\\a.wav' }) });
    const k = hauptTasten(s);
    const rec = f.gemessen === 'recording';
    const offen = f.gemessen !== 'idle';
    const ist = [kopfOnAir(s).live, sd(eintrag(s, 'aufnahme')), k.aufnahme.state, k.eingang.label, eintrag(s, 'eingang')?.detail?.startsWith('offen')].join('|');
    const soll = [rec, rec ? 'live a.wav' : `off ${RECORDER_TEXTE.aufnahme.keine}`, rec ? 'live' : offen ? 'bereit' : 'gesperrt', offen ? RECORDER_TEXTE.taste.eingangSchliessen : RECORDER_TEXTE.taste.eingangOeffnen, offen].join('|');
    return vergleiche(ist, soll);
  });
}

// ── Texte und Quelltext ──
{
  const aufruf = (fn: (...a: never[]) => unknown): string[] => {
    try {
      return flach((fn as (...a: unknown[]) => unknown)('x', 2, 3));
    } catch {
      return [];
    }
  };
  const flach = (v: unknown): string[] => (typeof v === 'function' ? aufruf(v as (...a: never[]) => unknown) : typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(flach) : []);
  const geraet = { name: 'N', hostApiName: 'H', maxInputChannels: 2 };
  const texte = [...flach(RECORDER_TEXTE), RECORDER_TEXTE.eingang.geraet(geraet), RECORDER_TEXTE.format.alleKanaele(2), RECORDER_TEXTE.zeitplan.start('14:30')];
  ok(texte.length > 0 && texte.every((t) => !t.includes('"')), 'RE Texte ohne ASCII-Anführungszeichen');
  gleich(
    [RECORDER_TEXTE.eingang.geraet(geraet), RECORDER_TEXTE.format.alleKanaele(8), RECORDER_TEXTE.eingang.kanaele(2), RECORDER_TEXTE.eingang.rate(48000)],
    ['N — H (2 ch)', 'Alle 8 Kanäle', '2 ch', '48000 Hz'],
    'RE Texte: Geräteliste und Maßeinheiten im alten Wortlaut',
  );
  // R5: Texte aus @jm/settings (*_TEXTE, STATUS_UNBEKANNT) und @jm/ui (MASTER_LINK_TEXTE) werden nie nachgebaut.
  const fremd = new Set([...Object.entries(settings).filter(([k]) => k.endsWith('_TEXTE')).map(([, v]) => v), MASTER_LINK_TEXTE, settings.STATUS_UNBEKANNT].flatMap(flach));
  // Bewusste Ausnahme (R7, wie Player und Prompter): „offen“ = Eingang offen, nicht der Modus „offen“ der Fernsteuerung
  // (REMOTE_TEXTE.modusOffen); beide Wörter stehen nie im selben Eintrag.
  const AUSNAHMEN = new Set<string>([RECORDER_TEXTE.eingang.offen]);
  const nachgebaut = texte.filter((t) => fremd.has(t) && !AUSNAHMEN.has(t));
  ok(fremd.size > 0 && nachgebaut.length === 0 && REMOTE_TEXTE.modusOffen === RECORDER_TEXTE.eingang.offen, `RE Texte nicht nachgebaut: kein RECORDER_TEXTE-Wert gleicht einem Text aus @jm/settings oder @jm/ui${nachgebaut.length ? ` (${nachgebaut.join(' | ')})` : ''}`);
  const code = ohneKommentare(leseText('src/renderer/src/lib/oberflaeche.ts'));
  ok(!/(?<![\w-])window\b|\blocalStorage\b|\bipcRenderer\b|\bdocument\b|from ['"]electron['"]|from ['"]@\/store\//.test(code), 'RE oberflaeche rein: lib/oberflaeche.ts ohne window, document, localStorage, IPC, Electron und Store');
}

// ── Altfehler RE-3 (Plan 2026-11-26, Task 7; B2, D3): das Fehlerfeld des Hauptprozesses in Statusleiste, ON AIR und Haupttaste ──
{
  type Art = 'schreiben' | 'eingang' | 'start';
  const F: Record<Art, { art: Art; text: string; datei: string | null }> = {
    schreiben: { art: 'schreiben', text: 'ENOSPC: no space left on device, write', datei: 'D:\Aufnahmen\Voll.wav' },
    eingang: { art: 'eingang', text: 'Keine Audiodaten vom Eingang', datei: 'D:\Aufnahmen\Stumm.wav' },
    start: { art: 'start', text: 'EEXIST: file already exists, mkdir', datei: null },
  };
  const SOLL: Record<Art, string> = {
    schreiben: 'error Schreibfehler – Aufnahme beendet: ENOSPC: no space left on device, write',
    eingang: 'error Keine Audiodaten vom Eingang – Aufnahme beendet',
    start: 'error Aufnahme nicht gestartet: EEXIST: file already exists, mkdir',
  };
  const mitFehler = (status: RecorderStatus, art: Art): RecorderState => zustand(status, { fehler: F[art], filePath: F[art].datei } as Partial<RecorderState>);
  const faelle = kreuz({ art: ['schreiben', 'eingang', 'start'], status: ['armed', 'idle'] } as const);
  pruefeFaelle('RE-3 Statusleiste aufnahme bei fehler: je Art der Text, state error, Gruppe ausgabe (armed und idle)', faelle, (f) => {
    const i = eintrag(stand({ recorder: recorder(), zustand: mitFehler(f.status, f.art) }), 'aufnahme');
    return vergleiche(sd(i), SOLL[f.art]) ?? (i?.group !== 'ausgabe' ? 'Gruppe falsch' : null);
  });
  const onAir = kreuz({ status: STATI, fehler: [null, 'schreiben', 'eingang'] } as const);
  pruefeFaelle('RE-3 ON AIR nie live bei fehler (live nur bei recording ohne Fehlerfeld), Label REC', onAir, (f) => {
    const z = f.fehler === null ? zustand(f.status) : mitFehler(f.status, f.fehler);
    const a = kopfOnAir({ zustand: z });
    return vergleiche(`${a.live}/${a.label}`, `${f.status === 'recording' && f.fehler === null}/REC`);
  });
  const T = RECORDER_TEXTE as unknown as { taste: { neuAufnehmen?: string }; fehler?: { marke?: Record<Art, string>; detail?: (f: { art: Art; text: string }) => string } };
  const tasten = (z: RecorderState): string => {
    const t = hauptTasten({ recorder: recorder(), zustand: z });
    return `${t.aufnahme.label}/${t.aufnahme.state}/${t.aufnahme.disabledReason ?? '-'} | ${t.eingang.label}/${t.eingang.state}`;
  };
  gleich(
    [tasten(mitFehler('armed', 'schreiben')), tasten(mitFehler('armed', 'eingang')), tasten(mitFehler('armed', 'start')), tasten(mitFehler('idle', 'schreiben'))],
    [
      'Neu aufnehmen/bereit/- | Eingang schließen/bereit',
      'Neu aufnehmen/bereit/- | Eingang schließen/bereit',
      'Neu aufnehmen/bereit/- | Eingang schließen/bereit',
      `Aufnahme/gesperrt/${RECORDER_TEXTE.grund.eingangZu} | Eingang öffnen/bereit`,
    ],
    'RE-3 Haupttaste „Neu aufnehmen“ bereit: bei offenem Eingang mit Fehlerfeld heißt die Aufnahme-Taste „Neu aufnehmen“ (startet neu), „Eingang schließen“ bleibt bereit; bei zu gilt wie bisher „Erst den Eingang öffnen“',
  );
  gleich(
    [T.taste.neuAufnehmen, T.fehler?.marke, ...(['schreiben', 'eingang', 'start'] as const).map((a) => T.fehler?.detail?.(F[a]))],
    [
      'Neu aufnehmen',
      { schreiben: 'Schreibfehler', eingang: 'Kein Eingang', start: 'Nicht gestartet' },
      'Schreibfehler – Aufnahme beendet: ENOSPC: no space left on device, write',
      'Keine Audiodaten vom Eingang – Aufnahme beendet',
      'Aufnahme nicht gestartet: EEXIST: file already exists, mkdir',
    ],
    'RE-3 Texte: RECORDER_TEXTE.taste.neuAufnehmen, RECORDER_TEXTE.fehler.marke und RECORDER_TEXTE.fehler.detail wörtlich wie im Plan (nie „Fehler“, das ist UI_TEXTE.zustand.error)',
  );
  ok(T.fehler?.marke !== undefined && !Object.values(T.fehler.marke).includes('Fehler'), 'RE-3 Texte: keine Marke heißt „Fehler“');
}

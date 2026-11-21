// UX Welle 1 · Switcher-Ableitungen (Aufgabe c; Spec 5.1, 6, 7.1–7.4, Anhang A „Switcher“): Statusleiste als Kreuzprodukt je Eintrag
// mit Erwartungstabelle (E4, E5, R4), Abschnitts-Props, Haupttasten (E7), On-Air (E8), Aktionen, Texte.
// Ohne window und ohne Electron.
import { audioDeviceView, ndiOutputView, remoteControlView } from '@jm/settings';
import { ordneStatus, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { DisplayInfo, MasterLinkMeldungZeile } from '@shared/types';
import {
  ABSCHNITT,
  audioAbschnitt,
  bildschirmAbschnitt,
  fernsteuerungAbschnitt,
  hauptTasten,
  ndiAbschnitt,
  onAirKopf,
  statusLeiste,
  SWITCHER_TEXTE,
  type OberflaechenStand,
  type SwitcherAktionen,
} from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { basisEinstellungen, basisMeldung, basisStand, PRIMAERER_MONITOR, ZWEITER_MONITOR } from './testzustand';

const eintrag = (s: OberflaechenStand, id: string): StatusItem => statusLeiste(s).find((i) => i.id === id) as StatusItem;
const sd = (i: StatusItem): string => `${i.state} ${i.detail ?? ''}`;
const KEINE = {} as SwitcherAktionen;

function aufzeichner(): { log: unknown[]; a: SwitcherAktionen } {
  const log: unknown[] = [];
  const f =
    (name: string) =>
    (...args: unknown[]): void => {
      log.push([name, ...args]);
    };
  return {
    log,
    a: {
      setRtmpUrl: f('setRtmpUrl'),
      setStreamBitrateKbps: f('setStreamBitrateKbps'),
      setRecordBitrateKbps: f('setRecordBitrateKbps'),
      setControlEnabled: f('setControlEnabled'),
      setControlPort: f('setControlPort'),
      setAudioInputId: f('setAudioInputId'),
      setNdiOutputName: f('setNdiOutputName'),
      setNdiOutputSource: f('setNdiOutputSource'),
      setProgramResolution: f('setProgramResolution'),
      setOutputFps: f('setOutputFps'),
      setSecondScreenEnabled: f('setSecondScreenEnabled'),
      setSecondScreenDisplayId: f('setSecondScreenDisplayId'),
      toggleNdiOutput: f('toggleNdiOutput'),
      toggleRecording: f('toggleRecording'),
      toggleStreaming: f('toggleStreaming'),
      scanAudio: f('scanAudio'),
    },
  };
}

// ── Master (12 Eingänge wie im Titler, über statusLeiste) ──
{
  const faelle: Array<{ name: string; m: MasterLinkMeldungZeile | null | undefined; soll: string }> = [
    { name: 'undefined', m: undefined, soll: 'off unbekannt' },
    { name: 'null', m: null, soll: 'off unbekannt' },
    { name: 'ohne-client', m: { art: 'ohne-client' }, soll: 'warn nicht gestartet' },
    { name: 'aus', m: { art: 'aus' }, soll: 'off aus' },
    { name: 'sucht', m: { art: 'sucht' }, soll: 'warn sucht …' },
    { name: 'verbindet', m: { art: 'verbindet', adresse: '10.0.0.5:8740' }, soll: 'warn verbindet …' },
    { name: 'verbunden', m: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1000, masterName: 'Regie-PC', suite: 'JM Production Suite' }, soll: 'ok verbunden mit Regie-PC' },
    { name: 'verbunden ohne Namen', m: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1000, masterName: '', suite: 'JM Production Suite' }, soll: 'ok verbunden' },
    { name: 'fehler', m: { art: 'fehler', code: 'nicht-gefunden', text: 'Master nicht gefunden' }, soll: 'error Master nicht gefunden' },
    { name: 'unbekannte Art', m: { art: 'neu' } as unknown as MasterLinkMeldungZeile, soll: 'off unbekannt' },
  ];
  pruefeFaelle('SW Statusleiste master-link: Eingänge → Zustand und Detail, Gruppe verbindung, ohne Abschnitt', faelle, (f) => {
    const i = eintrag(basisStand({ masterLink: f.m }), 'master-link');
    return vergleiche(sd(i), f.soll) ?? (i.group !== 'verbindung' || i.settingsSection !== undefined ? 'Kopf falsch' : null);
  });
}

// ── NDI (E5): aus · an (ohne Rückmeldung) · n Empfänger · Fehler ──
{
  const faelle = kreuz({ active: [false, true], connections: [0, 3], error: [null, 'Sender startet nicht'], name: ['', 'Regie'] } as const);
  const soll = (f: (typeof faelle)[number]): string => {
    const empf = f.active && f.connections > 0 ? `${f.connections} Empfänger` : undefined;
    if (f.error !== null) return `error ${empf ? `${empf} · ` : ''}Fehler: ${f.error}`;
    if (f.active) return `warn ${empf ? `${empf} · ` : ''}an (ohne Rückmeldung)`;
    return 'off aus';
  };
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    basisStand({ settings: basisEinstellungen({ ndiOutputName: f.name }), ndi: { active: f.active, name: f.name, connections: f.connections, error: f.error } });
  pruefeFaelle('SW Statusleiste ndi: an/aus × Empfänger × Fehler × Name → Tabelle (Fehler vor Empfängerzahl, nie ok)', faelle, (f) => vergleiche(sd(eintrag(props(f), 'ndi')), soll(f)));
  pruefeFaelle('SW NDI-Abschnitt: nur Schalter und Name (E5), sending nie gesetzt, Name-Hinweis bei leerem Namen', faelle, (f) => {
    const p = ndiAbschnitt(props(f), KEINE);
    const v = ndiOutputView(p);
    return vergleiche(
      `${JSON.stringify(p.capabilities)}/${p.sending}/${p.resolution}/${p.fps}/${v.hinweis}`,
      `${JSON.stringify({ toggle: true, rename: true })}/undefined/undefined/undefined/${f.name === '' ? 'Kein Quellenname eingetragen.' : undefined}`,
    );
  });
}

// ── Bildschirm (E4): aus · an (ohne Rückmeldung) · Liste unbekannt ──
{
  const LISTEN: Record<string, DisplayInfo[] | undefined> = {
    unbekannt: undefined,
    leer: [],
    primaer: [PRIMAERER_MONITOR],
    zwei: [PRIMAERER_MONITOR, ZWEITER_MONITOR],
  };
  const faelle = kreuz({ enabled: [false, true], liste: ['unbekannt', 'leer', 'primaer', 'zwei'], wahl: [0, 22, 9999] } as const);
  // Zeile = Liste|Wahl (0 = automatisch, 22 = zweiter Monitor, 9999 = abgezogen), Spalten = aus, an.
  const T: Record<string, [string, string]> = {
    'unbekannt|0': ['off unbekannt', 'off unbekannt'],
    'unbekannt|22': ['off unbekannt', 'off unbekannt'],
    'unbekannt|9999': ['off unbekannt', 'off unbekannt'],
    'leer|0': ['off aus', 'error Bildschirm fehlt'],
    'leer|22': ['error Bildschirm fehlt', 'error Bildschirm fehlt'],
    'leer|9999': ['error Bildschirm fehlt', 'error Bildschirm fehlt'],
    'primaer|0': ['off aus', 'warn an (ohne Rückmeldung)'],
    'primaer|22': ['error Bildschirm fehlt', 'error Bildschirm fehlt'],
    'primaer|9999': ['error Bildschirm fehlt', 'error Bildschirm fehlt'],
    'zwei|0': ['off aus', 'warn an (ohne Rückmeldung)'],
    'zwei|22': ['off aus', 'warn an (ohne Rückmeldung)'],
    'zwei|9999': ['error Bildschirm fehlt', 'error Bildschirm fehlt'],
  };
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    basisStand({ settings: basisEinstellungen({ secondScreenEnabled: f.enabled, secondScreenDisplayId: f.wahl }), displays: LISTEN[f.liste] });
  pruefeFaelle('SW Statusleiste bildschirm: an/aus × Monitorliste × Wahl → Tabelle (E4)', faelle, (f) =>
    vergleiche(sd(eintrag(props(f), 'bildschirm')), T[`${f.liste}|${f.wahl}`][f.enabled ? 1 : 0]),
  );
  pruefeFaelle('SW Bildschirm-Abschnitt: nie ok, windowOpen nie gesetzt, Wahl 0 = automatisch (null)', faelle, (f) => {
    const p = bildschirmAbschnitt(props(f), KEINE);
    const state = eintrag(props(f), 'bildschirm').state;
    return state === 'ok' || p.windowOpen !== undefined || p.selectedId !== (f.wahl === 0 ? null : f.wahl) ? `state ${state} windowOpen ${p.windowOpen} selectedId ${p.selectedId}` : null;
  });
}

// ── Fernsteuerung (R4): controlEnabled zuerst, dann die Meldung ──
{
  const MELDUNG: Record<string, FernsteuerungMeldung | null | undefined> = {
    undefined: undefined,
    null: null,
    belegt: { laeuft: false, port: 8723, clients: 0, fehler: 'listen EADDRINUSE: address already in use :::8723' },
    fehler: { laeuft: false, port: 8723, clients: 0, fehler: 'listen EACCES: permission denied' },
    bereit0: basisMeldung({ clients: 0 }),
    bereit3: basisMeldung({ clients: 3 }),
    gestoppt: { laeuft: false, port: 8723, clients: 0 },
  };
  const T: Record<string, [string, string]> = {
    // Zeile = Meldung, Spalten = aus, an. Aus ist immer „aus“, auch mit altem Fehler (naechsteFernsteuerung behält ihn).
    undefined: ['off aus', 'off unbekannt'],
    null: ['off aus', 'off unbekannt'],
    belegt: ['off aus', 'error Port belegt'],
    fehler: ['off aus', 'error Fehler: listen EACCES: permission denied'],
    bereit0: ['off aus', 'ok bereit · 0 verbunden'],
    bereit3: ['off aus', 'ok bereit · 3 verbunden'],
    gestoppt: ['off aus', 'off aus'],
  };
  const faelle = kreuz({ an: [false, true], meldung: Object.keys(MELDUNG), port: [8723, 9000] } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    basisStand({ settings: basisEinstellungen({ controlEnabled: f.an, controlPort: f.port }), fernsteuerung: MELDUNG[f.meldung] });
  pruefeFaelle('SW Statusleiste fernsteuerung: Einstellung × Meldung × Port → Tabelle (R4)', faelle, (f) =>
    vergleiche(sd(eintrag(props(f), 'fernsteuerung')), T[f.meldung][f.an ? 1 : 0]),
  );
  pruefeFaelle('SW Fernsteuerung-Abschnitt: Port aus der Einstellung, Port und An/Aus bedienbar, Modul jm-switcher, kein Launcher-Knopf', faelle, (f) => {
    const p = fernsteuerungAbschnitt(props(f), KEINE);
    const v = remoteControlView(p);
    return vergleiche(
      `${p.port}/${p.enabled}/${JSON.stringify(p.capabilities)}/${p.companionModule}/${v.sichtbar.portFeld}/${v.sichtbar.steuerung}/${v.sichtbar.imLauncher}`,
      `${f.port}/${f.an}/${JSON.stringify({ portEditable: true, enableToggle: true })}/jm-switcher/true/true/false`,
    );
  });
  pruefeFaelle('SW Fernsteuerung-Abschnitt: „Port belegt“ als portInUse ohne Fehlertext daneben, Modus aus der Meldung', faelle, (f) => {
    const p = fernsteuerungAbschnitt(props(f), KEINE);
    const m = MELDUNG[f.meldung];
    const belegt = f.an && f.meldung === 'belegt';
    return vergleiche(`${p.portInUse ?? false}/${p.error === undefined || !p.portInUse}/${p.mode}`, `${belegt}/true/${f.an && m ? m.modus : undefined}`);
  });
}

// ── Audio: kein Gerät · Gerät · Gerät nicht gefunden · stumm · Fehler ──
{
  const faelle = kreuz({
    liste: ['unbekannt', 'leer', 'mikro'],
    wahl: ['', 'mic1', 'weg'],
    hasDevice: [false, true],
    muted: [false, true],
    fehler: [null, 'Permission denied'],
  } as const);
  const LISTEN = { unbekannt: undefined, leer: [], mikro: [{ id: 'mic1', label: 'Mikrofon 1' }] } as const;
  const soll = (f: (typeof faelle)[number]): string => {
    const gefunden = f.liste === 'mikro' && f.wahl === 'mic1';
    const fehlt = f.wahl !== '' && f.liste !== 'unbekannt' && !gefunden;
    if (f.fehler !== null && !fehlt) return `error Fehler: ${f.fehler}`;
    if (f.liste === 'unbekannt') return 'off unbekannt';
    if (f.wahl === '') return 'warn kein Gerät gewählt';
    if (!gefunden) return 'error Gerät nicht gefunden';
    if (!f.hasDevice) return 'warn Mikrofon 1 · startet';
    return f.muted ? 'warn Mikrofon 1 · stumm' : 'ok Mikrofon 1';
  };
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    basisStand({
      settings: basisEinstellungen({ audioInputId: f.wahl }),
      audioGeraete: LISTEN[f.liste] as OberflaechenStand['audioGeraete'],
      audio: { hasDevice: f.hasDevice, muted: f.muted, gain: 1, level: 0, error: f.fehler },
    });
  pruefeFaelle('SW Statusleiste audio: Liste × Wahl × Graph × stumm × Fehler → Tabelle', faelle, (f) => vergleiche(sd(eintrag(props(f), 'audio')), soll(f)));
  pruefeFaelle('SW Audio-Abschnitt: eine Wahl „Programm-Audio“, Option „Kein Ton“ bleibt, Gerätewechsel und Aktualisieren als Aktion', faelle, (f) => {
    const { log, a } = aufzeichner();
    const p = audioAbschnitt(props(f), a);
    p.choices[0].onChange?.('mic1');
    p.onRefresh?.();
    const v = audioDeviceView(p);
    return vergleiche(
      `${p.choices.length}/${p.choices[0].label}/${v.wahlen[0].optionen[0]?.label}/${JSON.stringify(log)}/${v.sichtbar.aktualisieren}`,
      `1/Programm-Audio/${f.liste === 'leer' ? undefined : '— Kein Ton (stille Spur) —'}/${JSON.stringify([['setAudioInputId', 'mic1'], ['scanAudio']])}/true`,
    );
  });
}

// ── Aufnahme ──
{
  const faelle = kreuz({
    recording: [false, true],
    recPath: [null, 'C:\\Videos\\Gala 1.webm', '/home/x/gala.webm'],
    streaming: [false, true],
    error: [null, 'Kein Program-Bild zum Aufnehmen.'],
  } as const);
  const soll = (f: (typeof faelle)[number]): string => {
    if (f.recording) return `live ${f.recPath === null ? 'läuft' : f.recPath.replace(/^.*[\\/]/, '')}`;
    if (f.error !== null) return `error Fehler: ${f.error}`;
    return 'off aus';
  };
  pruefeFaelle('SW Statusleiste aufnahme: läuft × Datei × Stream × Fehler → Tabelle (live nur beim Aufnehmen, Fehler gemeinsam)', faelle, (f) =>
    vergleiche(sd(eintrag(basisStand({ output: { recording: f.recording, streaming: f.streaming, recPath: f.recPath, error: f.error } }), 'aufnahme')), soll(f)),
  );
}

// ── Stream ──
{
  const faelle = kreuz({ streaming: [false, true], rtmpUrl: ['', '   ', 'rtmp://x/live/key'], error: [null, 'Verbindung abgelehnt'], recording: [false, true] } as const);
  const soll = (f: (typeof faelle)[number]): string => {
    if (f.streaming) return 'live läuft';
    if (f.error !== null) return 'error Fehler: Verbindung abgelehnt';
    return f.rtmpUrl.trim() === '' ? 'off kein Ziel' : 'ok bereit';
  };
  pruefeFaelle('SW Statusleiste stream: läuft × Ziel × Fehler × Aufnahme → Tabelle (kein Ziel ist off)', faelle, (f) =>
    vergleiche(
      sd(eintrag(basisStand({ settings: basisEinstellungen({ rtmpUrl: f.rtmpUrl }), output: { recording: f.recording, streaming: f.streaming, recPath: null, error: f.error } }), 'stream')),
      soll(f),
    ),
  );
}

// ── Statusleiste gesamt ──
{
  const faelle = kreuz({
    masterLink: [undefined, null, { art: 'aus' }] as Array<MasterLinkMeldungZeile | null | undefined>,
    fernsteuerung: [undefined, null, basisMeldung()] as Array<FernsteuerungMeldung | null | undefined>,
    displays: [undefined, [PRIMAERER_MONITOR]] as const,
    audioGeraete: [undefined, [{ id: 'mic1', label: 'Mikrofon 1' }]] as const,
    streaming: [false, true],
    recording: [false, true],
  } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    basisStand({
      masterLink: f.masterLink,
      fernsteuerung: f.fernsteuerung,
      displays: f.displays as OberflaechenStand['displays'],
      audioGeraete: f.audioGeraete as OberflaechenStand['audioGeraete'],
      output: { recording: f.recording, streaming: f.streaming, recPath: null, error: null },
    });
  const IDS = ['master-link', 'ndi', 'bildschirm', 'aufnahme', 'stream', 'fernsteuerung', 'audio'];
  pruefeFaelle('SW Statusleiste gesamt: Reihenfolge master-link, ndi, bildschirm, aufnahme, stream, fernsteuerung, audio; ids eindeutig; schon nach Gruppen geordnet', faelle, (f) => {
    const leiste = statusLeiste(props(f));
    const ids = leiste.map((i) => i.id).join();
    return vergleiche(ids, IDS.join()) ?? (new Set(leiste.map((i) => i.id)).size !== leiste.length ? 'ids doppelt' : null) ?? vergleiche(ordneStatus(leiste).map((i) => i.id).join(), ids);
  });
  pruefeFaelle('SW Statusleiste gesamt: jeder Eintrag außer master-link springt in einen Abschnitt aus ABSCHNITT', faelle, (f) => {
    const falsch = statusLeiste(props(f)).filter((i) =>
      i.id === 'master-link' ? i.settingsSection !== undefined : !(Object.values(ABSCHNITT) as string[]).includes(i.settingsSection ?? ''),
    );
    return falsch.length === 0 ? null : `falsch: ${falsch.map((i) => i.id).join()}`;
  });
  pruefeFaelle('SW Statusleiste gesamt: live nur bei aufnahme (Aufnahme läuft) und stream (Stream läuft)', faelle, (f) => {
    const live = statusLeiste(props(f)).filter((i) => i.state === 'live').map((i) => i.id).join();
    return vergleiche(live, [f.recording ? 'aufnahme' : '', f.streaming ? 'stream' : ''].filter(Boolean).join());
  });
  gleich(
    statusLeiste(basisStand()).map((i) => `${i.group}:${i.label}`),
    ['verbindung:Master', 'ausgabe:NDI', 'ausgabe:Bildschirm', 'ausgabe:Aufnahme', 'ausgabe:Stream', 'fernsteuerung:Fernsteuerung', 'tool:Audio'],
    'SW Statusleiste: Gruppen und Labels',
  );
}

// ── Vor der ersten Antwort ──
{
  const s = basisStand({ masterLink: undefined, fernsteuerung: undefined, displays: undefined, audioGeraete: undefined });
  const leiste = statusLeiste(s);
  const soll = ['master-link', 'bildschirm', 'fernsteuerung', 'audio'];
  gleich(
    soll.map((id) => sd(leiste.find((i) => i.id === id) as StatusItem)),
    soll.map(() => 'off unbekannt'),
    'SW Statusleiste vor erster Antwort: masterLink/fernsteuerung/displays/Audioliste undefined → off unbekannt, nie ok',
  );
  ok(!leiste.some((i) => i.state === 'ok' && soll.includes(i.id)), 'SW Statusleiste vor erster Antwort: kein unbekannter Eintrag ist ok');
}

// ── Haupttasten (E7) ──
{
  const faelle = kreuz({
    canTake: [false, true],
    canAuto: [false, true],
    transitioning: [false, true],
    recording: [false, true],
    streaming: [false, true],
    rtmpUrl: ['', '  ', 'rtmp://x/live/key'],
  } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    basisStand({
      canTake: f.canTake,
      canAuto: f.canAuto,
      transitioning: f.transitioning,
      settings: basisEinstellungen({ rtmpUrl: f.rtmpUrl }),
      output: { recording: f.recording, streaming: f.streaming, recPath: null, error: null },
    });
  const t = (z: { state: string; disabledReason?: string }): string => `${z.state}:${z.disabledReason ?? ''}`;
  pruefeFaelle('SW Haupttasten Cut: bereit nach canTake, sonst gesperrt „Keine andere Szene in der Vorschau“', faelle, (f) =>
    vergleiche(t(hauptTasten(props(f)).cut), f.canTake ? 'bereit:' : 'gesperrt:Keine andere Szene in der Vorschau'),
  );
  pruefeFaelle('SW Haupttasten Auto: bereit nach canAuto, Überblendung läuft zuerst, sonst Szenen-Grund', faelle, (f) =>
    vergleiche(
      t(hauptTasten(props(f)).auto),
      f.canAuto && !f.transitioning ? 'bereit:' : f.transitioning ? 'gesperrt:Überblendung läuft' : 'gesperrt:Keine andere Szene in der Vorschau',
    ),
  );
  pruefeFaelle('SW Haupttasten Aufnahme: live beim Aufnehmen, sonst bereit, nie gesperrt', faelle, (f) =>
    vergleiche(t(hauptTasten(props(f)).aufnahme), f.recording ? 'live:' : 'bereit:'),
  );
  pruefeFaelle('SW Haupttasten Stream: Stop während live nie gesperrt, ohne Ziel gesperrt mit Grund nur ohne Sendung', faelle, (f) =>
    vergleiche(
      t(hauptTasten(props(f)).stream),
      f.streaming ? 'live:' : f.rtmpUrl.trim() === '' ? 'gesperrt:Stream-Ziel in den Einstellungen festlegen' : 'bereit:',
    ),
  );
  pruefeFaelle('SW Haupttasten: jede gesperrte Taste hat einen Grund, kein „live“ mit Sperre', faelle, (f) => {
    const h = hauptTasten(props(f));
    return Object.values(h).some((z) => (z.state === 'gesperrt') !== Boolean(z.disabledReason?.trim())) ? 'Grund und Sperre passen nicht' : null;
  });
  // Befund zu canAuto: !canAuto ohne laufende Überblendung kommt vor (Vorschau leer oder Vorschau = Programm) und bekommt den Cut-Grund.
  gleich(
    t(hauptTasten(basisStand({ canTake: true, canAuto: false, transitioning: false })).auto),
    'gesperrt:Keine andere Szene in der Vorschau',
    'SW Haupttasten Auto: Vorschau = Programm (canAuto aus, keine Überblendung) nennt den Szenen-Grund',
  );
}

// ── On-Air (E8): LIVE vor REC ──
{
  const faelle = kreuz({ streaming: [false, true], recording: [false, true] } as const);
  pruefeFaelle('SW onAir: live bei Stream oder Aufnahme, LIVE geht vor REC', faelle, (f) => {
    const k = onAirKopf(basisStand({ output: { recording: f.recording, streaming: f.streaming, recPath: null, error: null } }));
    return vergleiche(`${k.live}/${k.label}`, `${f.streaming || f.recording}/${f.streaming ? 'LIVE' : 'REC'}`);
  });
}

// ── Aktionen (ohne DOM: die Rückrufe der Abschnitts-Props) ──
{
  const { log, a } = aufzeichner();
  const aus = basisStand({ ndi: { active: false, name: '', connections: 0, error: null } });
  const an = basisStand({ ndi: { active: true, name: 'JM Switcher', connections: 0, error: null } });
  ndiAbschnitt(aus, a).onToggle?.(true);
  ndiAbschnitt(aus, a).onToggle?.(false);
  ndiAbschnitt(an, a).onToggle?.(false);
  ndiAbschnitt(an, a).onToggle?.(true);
  ndiAbschnitt(aus, a).onRename?.('Bühne');
  gleich(log, [['toggleNdiOutput'], ['toggleNdiOutput'], ['setNdiOutputName', 'Bühne']], 'SW Aktionen NDI: Umschalten nur bei abweichendem Zielzustand, Name als Einstellung');
}
{
  const { log, a } = aufzeichner();
  const p = bildschirmAbschnitt(basisStand(), a);
  p.onToggle?.(true);
  p.onSelect?.(null);
  p.onSelect?.(22);
  gleich(log, [['setSecondScreenEnabled', true], ['setSecondScreenDisplayId', 0], ['setSecondScreenDisplayId', 22]], 'SW Aktionen Bildschirm: an/aus, automatisch = 0, Monitor-id');
}
{
  const { log, a } = aufzeichner();
  const p = fernsteuerungAbschnitt(basisStand(), a);
  p.onToggle?.(false);
  p.onPortChange?.(9000);
  gleich(log, [['setControlEnabled', false], ['setControlPort', 9000]], 'SW Aktionen Fernsteuerung: An/Aus und Port als Einstellung');
}

// ── Texte und Quelltext ──
{
  const texte = Object.values(SWITCHER_TEXTE).flatMap((t) => (typeof t === 'string' ? [t] : Object.values(t)));
  ok(texte.length > 0 && texte.every((t) => !t.includes('"')), 'SW Texte ohne ASCII-Anführungszeichen');
  gleich(
    [SWITCHER_TEXTE.keineSzeneInVorschau, SWITCHER_TEXTE.ueberblendungLaeuft, SWITCHER_TEXTE.keinStreamZiel],
    ['Keine andere Szene in der Vorschau', 'Überblendung läuft', 'Stream-Ziel in den Einstellungen festlegen'],
    'SW Texte: Gründe der Haupttasten (E7), Stream-Grund wörtlich wie heute',
  );
  gleich(Object.values(ABSCHNITT), ['ndi', 'bildschirm', 'fernsteuerung', 'audio', 'streaming', 'aufnahme', 'format'], 'SW Abschnitts-ids');
  const code = leseText('src/renderer/src/lib/oberflaeche.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!/\bwindow\b|\blocalStorage\b|\bipcRenderer\b|\bjmswitch\b|from ['"]electron['"]/.test(code), 'SW oberflaeche rein: lib/oberflaeche.ts ohne window, localStorage, IPC und Electron');
}

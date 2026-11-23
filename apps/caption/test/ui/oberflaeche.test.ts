// UX Welle 2a · Caption-Ableitungen (Aufgabe c; E4 ON AIR, E7 Hold, E8 NDI, E9 micError): Statusleiste als Kreuzprodukt je Eintrag,
// vor der ersten Antwort, ON AIR, Haupttasten, Gerät fehlt, Netzname, Texte und Quelltext. Ohne window und ohne Electron.
import * as settings from '@jm/settings';
import { AUDIO_TEXTE, NDI_TEXTE, ndiOutputView } from '@jm/settings';
import { MASTER_LINK_TEXTE, ordneStatus, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { CaptionConfig, CaptionState, CaptionStatus, MasterLinkMeldungZeile } from '@shared/types';
import {
  ABSCHNITT,
  AUFLOESUNGEN,
  CAPTION_TEXTE,
  fernsteuerungAbschnitt,
  hauptTasten,
  kopfOnAir,
  mikrofonAbschnitt,
  ndiAbschnitt,
  statusLeiste,
  type OberflaechenStand,
} from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { basisMeldung, ohneKommentare } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8732';
const MIKRO_FEHLER = 'Requested device not found';

const CONFIG: CaptionConfig = {
  model: 'base',
  language: 'de',
  maxUtteranceSec: 8,
  silenceMs: 700,
  silenceThreshold: 0.012,
  audioInputDeviceId: '',
  dictionary: '',
  engine: 'server',
  ndiName: 'JM Caption',
  ndiWidth: 1920,
  ndiHeight: 1080,
  ndiFps: 30,
  ndiFontSize: 54,
  ndiLines: 2,
  ndiBand: true,
};
const GERAETE = [
  { id: 'mic-1', label: 'Shure MV7' },
  { id: 'mic-2', label: 'Headset' },
];

function status(z: Partial<CaptionStatus> = {}): CaptionStatus {
  return { ndiActive: false, connections: 0, ndiSendet: false, ndiNetzName: null, ...z };
}
/** Antwort des Main (CaptionState). Bis zur ersten Antwort ist der Wert im Stand `undefined`, nicht eine solche Vorgabe. */
function caption(z: Partial<Omit<CaptionState, 'config' | 'status'>> & { config?: Partial<CaptionConfig>; status?: Partial<CaptionStatus> } = {}): CaptionState {
  const { config, status: st, ...rest } = z;
  return { running: false, hold: false, busy: false, whisperAvailable: true, lines: [], error: null, ...rest, config: { ...CONFIG, ...config }, status: status(st) };
}
function stand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { caption: undefined, geraete: undefined, micError: null, masterLink: undefined, fernsteuerung: undefined, ...teil };
}
const eintrag = (s: OberflaechenStand, id: string): StatusItem | undefined => statusLeiste(s).find((i) => i.id === id);
const sd = (i: StatusItem | undefined): string => (i === undefined ? 'fehlt' : `${i.state} ${i.detail ?? ''}`);
const BOOL = [false, true] as const;

/** Aktionen, die nichts tun (der Test setzt nur die, die er prüft). */
const KEINE = {
  ndiSchalten: () => {},
  ndiName: () => {},
  aufloesung: () => {},
  bildrate: () => {},
  geraetWaehlen: () => {},
  geraeteAktualisieren: () => {},
};

// ── CA ON AIR (E4): live nur bei ndiSendet && running && !micError ──
{
  const faelle = kreuz({ antwort: [false, true], ndiSendet: BOOL, running: BOOL, micError: [null, MIKRO_FEHLER] } as const);
  pruefeFaelle('CA ON AIR: live nur bei ndiSendet und running und ohne micError (nie ohne Antwort von Main)', faelle, (f) => {
    const s = stand({ caption: f.antwort ? caption({ running: f.running, status: { ndiActive: f.ndiSendet, ndiSendet: f.ndiSendet } }) : undefined, micError: f.micError });
    const soll = f.antwort && f.ndiSendet && f.running && f.micError === null;
    return vergleiche(String(kopfOnAir(s).live), String(soll));
  });
  gleich(kopfOnAir(stand()).live, false, 'CA ON AIR: vor erster Antwort nicht live');
}

// ── CA Statusleiste master-link ──
{
  const faelle: Array<{ name: string; m: MasterLinkMeldungZeile | null | undefined; soll: string }> = [
    { name: 'undefined', m: undefined, soll: 'off unbekannt' },
    { name: 'aus', m: { art: 'aus' }, soll: 'off aus' },
    { name: 'verbunden', m: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1, masterName: 'Regie-PC', suite: 'JM Production Suite' }, soll: 'ok verbunden mit Regie-PC' },
  ];
  pruefeFaelle('CA Statusleiste master-link: Meldung → Zustand und Detail, Gruppe verbindung', faelle, (f) => {
    const i = eintrag(stand({ masterLink: f.m }), 'master-link');
    return vergleiche(sd(i), f.soll) ?? (i?.group !== 'verbindung' ? 'Gruppe falsch' : null);
  });
}

// ── CA Statusleiste ndi (E8): sendet nur mit ndiSendet, ndiActive allein ist „an, keine Rückmeldung“ ──
{
  const faelle = kreuz({ antwort: [false, true], ndiActive: BOOL, ndiSendet: BOOL, connections: [0, 3] } as const);
  pruefeFaelle('CA Statusleiste ndi: unbekannt · aus · an, keine Rückmeldung (warn) · sendet, n Empfänger', faelle, (f) => {
    const s = stand({ caption: f.antwort ? caption({ status: { ndiActive: f.ndiActive, ndiSendet: f.ndiSendet, connections: f.connections } }) : undefined });
    const i = eintrag(s, 'ndi');
    let soll: string;
    if (!f.antwort) soll = 'off unbekannt';
    else if (f.ndiActive && f.ndiSendet) soll = `ok ${NDI_TEXTE.sendet}, ${NDI_TEXTE.empfaenger(f.connections)}`;
    else if (f.ndiActive) soll = `warn ${NDI_TEXTE.anOhneRueckmeldung}`;
    else if (f.ndiSendet) soll = `warn ${NDI_TEXTE.ausSendetNoch}`;
    else soll = `off ${NDI_TEXTE.aus}`;
    return vergleiche(sd(i), soll) ?? (i?.group !== 'ausgabe' || i.settingsSection !== ABSCHNITT.ndi ? 'Kopf falsch' : null);
  });
  gleich(sd(eintrag(stand({ caption: caption({ status: { ndiActive: true, ndiSendet: true, connections: 3 } }) }), 'ndi')), 'ok sendet, 3 Empfänger', 'CA Statusleiste ndi: Wortlaut sendet, 3 Empfänger');
  gleich(sd(eintrag(stand({ caption: caption({ status: { ndiActive: true } }) }), 'ndi')), 'warn an (ohne Rückmeldung)', 'CA Statusleiste ndi: ndiActive ohne ndiSendet ist warn, nie ok');
}

// ── CA Statusleiste fernsteuerung: Meldung (Port 8732) ──
{
  const MELDUNG: Record<string, FernsteuerungMeldung | null | undefined> = {
    undefined: undefined,
    null: null,
    aus: { laeuft: false, port: 8732, clients: 0 },
    belegt: { laeuft: false, port: 8732, clients: 0, fehler: BELEGT },
    fehler: { laeuft: false, port: 8732, clients: 0, fehler: 'listen EACCES: permission denied 0.0.0.0:8732' },
    bereit0: basisMeldung({ clients: 0 }),
    bereit3: basisMeldung({ clients: 3 }),
  };
  const SOLL: Record<string, string> = {
    undefined: 'off unbekannt',
    null: 'off unbekannt',
    aus: 'off aus',
    belegt: 'error Port belegt',
    fehler: 'error Fehler: listen EACCES: permission denied 0.0.0.0:8732',
    bereit0: 'ok bereit · 0 verbunden',
    bereit3: 'ok bereit · 3 verbunden',
  };
  const faelle = kreuz({ meldung: Object.keys(MELDUNG), modus: [undefined, 'open', 'secure'] } as const);
  pruefeFaelle('CA Statusleiste fernsteuerung: Meldung × Modus → unbekannt, aus, Port belegt, Fehler, bereit n verbunden', faelle, (f) => {
    const m = MELDUNG[f.meldung];
    const i = eintrag(stand({ fernsteuerung: m ? { ...m, modus: f.modus } : m }), 'fernsteuerung');
    return vergleiche(sd(i), SOLL[f.meldung]) ?? (i?.group !== 'fernsteuerung' || i.settingsSection !== ABSCHNITT.fernsteuerung ? 'Kopf falsch' : null);
  });
  const p = fernsteuerungAbschnitt(stand({ fernsteuerung: { laeuft: false, port: 0, clients: 0, fehler: BELEGT } }));
  gleich([p.port, p.portInUse, p.error, p.companionModule, p.running], [8732, true, undefined, 'JM Caption', false], 'CA Fernsteuerung-Abschnitt: Port 8732 auch bei gemeldetem 0, EADDRINUSE nur als portInUse, Companion-Modul');
}

// ── CA Statusleiste mikrofon: gespeicherte ID × gemessene Liste × micError; CA Gerät fehlt ──
{
  const faelle = kreuz({ antwort: [false, true], liste: ['undefined', 'leer', 'bekannt'], id: ['', 'mic-1', 'weg'], micError: [null, MIKRO_FEHLER] } as const);
  pruefeFaelle('CA Statusleiste mikrofon: unbekannt · Gerät · Gerät nicht gefunden · Fehler (micError geht vor)', faelle, (f) => {
    const s = stand({
      caption: f.antwort ? caption({ config: { audioInputDeviceId: f.id } }) : undefined,
      geraete: f.liste === 'undefined' ? undefined : f.liste === 'leer' ? [] : GERAETE,
      micError: f.micError,
    });
    const i = eintrag(s, 'mikrofon');
    let soll: string;
    if (f.micError !== null) soll = `error Fehler: ${MIKRO_FEHLER}`;
    else if (!f.antwort || f.liste === 'undefined') soll = 'off unbekannt';
    else if (f.id === '') soll = f.liste === 'leer' ? `off ${AUDIO_TEXTE.keinGeraet}` : `ok ${CAPTION_TEXTE.mikrofon.standard}`;
    else if (f.id === 'mic-1' && f.liste === 'bekannt') soll = 'ok Shure MV7';
    else soll = `error ${AUDIO_TEXTE.nichtGefunden}`;
    return vergleiche(sd(i), soll) ?? (i?.group !== 'tool' || i.settingsSection !== ABSCHNITT.mikrofon ? 'Kopf falsch' : null);
  });
}
{
  // CA Gerät fehlt: eine gespeicherte ID, die nicht in der Liste steht, ist „Gerät nicht gefunden“, nie der Standard.
  const s = stand({ caption: caption({ config: { audioInputDeviceId: 'weg' } }), geraete: GERAETE });
  const i = eintrag(s, 'mikrofon') as StatusItem;
  gleich([i.state, i.detail], ['error', AUDIO_TEXTE.nichtGefunden], 'CA Gerät fehlt: gespeicherte ID nicht in der Liste ergibt Gerät nicht gefunden');
  ok(i.detail !== CAPTION_TEXTE.mikrofon.standard && !(i.detail ?? '').includes('System-Standard'), 'CA Gerät fehlt: nie der Standard');
  const p = mikrofonAbschnitt(s);
  gleich([p.choices[0].value, p.choices[0].defaultLabel, p.choices[0].devices?.map((d) => d.id)], ['weg', 'System-Standard (Mikrofon)', ['mic-1', 'mic-2']], 'CA Gerät fehlt: die Wahl behält die gespeicherte ID, Standard bleibt als eigene Option');
  const leer = eintrag(stand({ caption: caption({ config: { audioInputDeviceId: 'weg' } }), geraete: [] }), 'mikrofon');
  gleich(sd(leer), `error ${AUDIO_TEXTE.nichtGefunden}`, 'CA Gerät fehlt: auch bei gemessen leerer Liste');
}

// ── CA Mikrofon-Abschnitt: Aktionen, Pegel nur bei running ──
{
  const aufrufe: string[] = [];
  const p = mikrofonAbschnitt(stand({ caption: caption(), geraete: GERAETE }), {
    ...KEINE,
    geraetWaehlen: (id) => aufrufe.push(`wahl ${id}`),
    geraeteAktualisieren: () => aufrufe.push('neu'),
  });
  p.choices[0].onChange?.('mic-2');
  p.onRefresh?.();
  gleich([aufrufe, p.capabilities, p.id, p.choices[0].direction], [['wahl mic-2', 'neu'], { level: true, refresh: true }, 'mikrofon', 'input'], 'CA Mikrofon-Abschnitt: Aktionen laufen erst im Rückruf, Pegel und Aktualisieren angeboten');
  const faelle = kreuz({ running: BOOL, pegel: [undefined, 0, 0.1] } as const);
  pruefeFaelle('CA Mikrofon-Abschnitt: Pegel nur bei running und gemessenem Wert (0 = kein Signal)', faelle, (f) => {
    const db = mikrofonAbschnitt(stand({ caption: caption({ running: f.running }), geraete: GERAETE, pegel: f.pegel })).choices[0].levelDb;
    if (!f.running || f.pegel === undefined) return vergleiche(String(db), 'undefined');
    return f.pegel === 0 ? vergleiche(String(db), '-Infinity') : vergleiche(String(Math.round((db as number) * 10) / 10), '-20');
  });
}

// ── CA Netzname (E8): bei laufendem NDI der gemessene Name, nie config.ndiName, nie leer ──
{
  const faelle = kreuz({ ndiActive: BOOL, netz: [null, '', 'JM Caption (2)'] } as const);
  pruefeFaelle('CA Netzname: Hinweis „Im Netz“ nur bei laufendem NDI und nicht leerem ndiNetzName, nie config.ndiName', faelle, (f) => {
    const s = stand({ caption: caption({ config: { ndiName: 'Eigener Name' }, status: { ndiActive: f.ndiActive, ndiNetzName: f.netz } }) });
    const v = ndiOutputView(ndiAbschnitt(s));
    const soll = f.ndiActive && f.netz ? NDI_TEXTE.imNetz(f.netz) : undefined;
    return vergleiche(v.hinweis, soll) ?? ((v.hinweis ?? '').includes('Eigener Name') || (v.hinweis ?? '') === NDI_TEXTE.imNetz('') ? 'config.ndiName oder leerer Name' : null);
  });
  const p = ndiAbschnitt(stand({ caption: caption({ config: { ndiName: 'Eigener Name' }, status: { ndiActive: true, ndiSendet: true, ndiNetzName: 'JM Caption (2)', connections: 2 } }) }));
  gleich([p.networkName, p.sourceName, p.receivers, p.sending, p.enabled], ['JM Caption (2)', 'Eigener Name', 2, true, true], 'CA Netzname: Abschnitt zeigt ndiNetzName, der Quellname bleibt das Feld der Einstellung');
  const leer = ndiAbschnitt(stand({ caption: caption({ status: { ndiActive: true, ndiNetzName: '' } }) }));
  gleich([leer.networkName, leer.receivers, leer.sending], [undefined, undefined, undefined], 'CA Netzname: leerer Name wird nie gezeigt, Empfänger und sending ohne Messung unbekannt');
}

// ── CA NDI-Abschnitt: Felder und Aktionen ──
{
  const aufrufe: string[] = [];
  const p = ndiAbschnitt(stand({ caption: caption({ config: { ndiWidth: 1280, ndiHeight: 720, ndiFps: 50 } }) }), {
    ...KEINE,
    ndiSchalten: (n) => aufrufe.push(`ndi ${n}`),
    ndiName: (n) => aufrufe.push(`name ${n}`),
    aufloesung: (w, h) => aufrufe.push(`res ${w}x${h}`),
    bildrate: (n) => aufrufe.push(`fps ${n}`),
  });
  p.onToggle?.(true);
  p.onRename?.('X');
  p.onResolution?.('3840x2160');
  p.onResolution?.('1x1');
  p.onFps?.('60');
  gleich(
    [p.resolution, p.fps, p.resolutionOptions?.map((o) => o.value), p.fpsOptions?.map((o) => o.value), p.capabilities, aufrufe],
    [
      '1280x720',
      '50',
      AUFLOESUNGEN.map((r) => r.id),
      ['25', '30', '50', '60'],
      { toggle: true, rename: true, resolution: true, fps: true },
      ['ndi true', 'name X', 'res 3840x2160', 'fps 60'],
    ],
    'CA NDI-Abschnitt: Auflösung aus RES, Bildrate 25/30/50/60, keine Transparenz-Wahl, Aktionen erst im Rückruf',
  );
}

// ── CA Statusleiste whisper ──
{
  const faelle = kreuz({ antwort: [false, true], whisperAvailable: BOOL, busy: BOOL } as const);
  pruefeFaelle('CA Statusleiste whisper: unbekannt · verfügbar · arbeitet · fehlt', faelle, (f) => {
    const i = eintrag(stand({ caption: f.antwort ? caption({ whisperAvailable: f.whisperAvailable, busy: f.busy }) : undefined }), 'whisper');
    const T = CAPTION_TEXTE.whisper;
    const soll = !f.antwort ? 'off unbekannt' : !f.whisperAvailable ? `warn ${T.fehlt}` : f.busy ? `ok ${T.arbeitet}` : `ok ${T.verfuegbar}`;
    return vergleiche(sd(i), soll) ?? (i?.group !== 'tool' ? 'Gruppe falsch' : null);
  });
}

// ── CA Statusleiste fehler: state.error ──
{
  const faelle = kreuz({ antwort: [false, true], error: [null, 'whisper-Server abgestürzt'] } as const);
  pruefeFaelle('CA Statusleiste fehler: unbekannt · nichts · Text (error)', faelle, (f) => {
    const i = eintrag(stand({ caption: f.antwort ? caption({ error: f.error }) : undefined }), 'fehler');
    const soll = !f.antwort ? 'off unbekannt' : f.error === null ? `ok ${CAPTION_TEXTE.fehler.keiner}` : `error ${f.error}`;
    return vergleiche(sd(i), soll) ?? (i?.group !== 'tool' ? 'Gruppe falsch' : null);
  });
}

// ── CA Statusleiste vor erster Antwort: jedes undefined ist unbekannt, nie ok, nie live ──
{
  const items = statusLeiste(stand());
  gleich(items.map((i) => i.id), ['master-link', 'ndi', 'fernsteuerung', 'mikrofon', 'whisper', 'fehler'], 'CA Statusleiste vor erster Antwort: Einträge in fester Reihenfolge');
  pruefeFaelle('CA Statusleiste vor erster Antwort: jeder Eintrag off unbekannt', items.map((i) => ({ id: i.id })), (f) => vergleiche(sd(items.find((i) => i.id === f.id)), 'off unbekannt'));
  const mitListe = statusLeiste(stand({ geraete: GERAETE }));
  ok(mitListe.every((i) => i.state === 'off'), 'CA Statusleiste vor erster Antwort: eine Geräteliste allein macht das Mikrofon nicht ok');
  const gruppen = ordneStatus(statusLeiste(stand({ caption: caption(), geraete: GERAETE }))).map((i) => i.group);
  gleich(gruppen, ['verbindung', 'ausgabe', 'fernsteuerung', 'tool', 'tool', 'tool'], 'CA Statusleiste: Reihenfolge nach Gruppen');
}

// ── CA Haupttasten: vier Tasten je Zustand (E4, E7, E9) ──
{
  const faelle = kreuz({ antwort: [false, true], running: BOOL, hold: BOOL, ndiActive: BOOL, ndiSendet: BOOL, micError: [null, MIKRO_FEHLER] } as const);
  const T = CAPTION_TEXTE.taste;
  pruefeFaelle('CA Haupttasten: Start bei micError bedienbar und nie live, NDI live nur bei ndiSendet, ohne Antwort gesperrt mit Grund', faelle, (f) => {
    const s = stand({ caption: f.antwort ? caption({ running: f.running, hold: f.hold, status: { ndiActive: f.ndiActive, ndiSendet: f.ndiSendet } }) : undefined, micError: f.micError });
    const t = hauptTasten(s);
    const z = (x: { label: string; state: string; disabledReason?: string }): string => `${x.label}/${x.state}/${x.disabledReason ?? '-'}`;
    const g = CAPTION_TEXTE.grund.zustandOffen;
    const soll = !f.antwort
      ? [`${T.start}/gesperrt/${g}`, `${T.hold}/gesperrt/${g}`, `${T.leeren}/gesperrt/${g}`, `${T.ndiStarten}/gesperrt/${g}`]
      : [
          f.running ? `${T.stopp}/${f.micError === null ? 'live' : 'bereit'}/-` : `${T.start}/bereit/-`,
          `${f.hold ? T.holdAn : T.hold}/bereit/-`,
          `${T.leeren}/bereit/-`,
          `${f.ndiActive ? T.ndiAn : T.ndiStarten}/${f.ndiSendet ? 'live' : 'bereit'}/-`,
        ];
    const ist = [t.start, t.hold, t.leeren, t.ndi].map(z);
    const grundFehlt = [t.start, t.hold, t.leeren, t.ndi].some((x) => (x.state === 'gesperrt') !== (x.disabledReason !== undefined && x.disabledReason.trim() !== ''));
    return vergleiche(ist.join(' | '), soll.join(' | ')) ?? (grundFehlt || t.hold.state === 'live' || t.leeren.state === 'live' ? 'Grund oder live falsch' : null);
  });
  // Start bei micError: bedienbar (Stopp möglich), nie live.
  const t = hauptTasten(stand({ caption: caption({ running: true, status: { ndiActive: true, ndiSendet: true } }), micError: MIKRO_FEHLER }));
  gleich([t.start.state, t.start.disabledReason], ['bereit', undefined], 'CA Haupttasten: Start bei micError bedienbar und nie live');
  gleich(hauptTasten(stand({ caption: caption({ status: { ndiActive: true } }) })).ndi.state, 'bereit', 'CA Haupttasten: NDI aktiv ohne ndiSendet ist bereit, nicht live');
}

// ── CA Zustand getrennt: ohne Antwort von Main nichts behaupten ──
{
  // Der Store startet mit state = null; erst getState/onState setzt ihn. Ein bereiter Renderer (Liste da, kein micError)
  // ändert daran nichts.
  const frisch = stand({ geraete: GERAETE, fernsteuerung: basisMeldung() });
  const t = hauptTasten(frisch);
  ok([t.start, t.hold, t.leeren, t.ndi].every((x) => x.state === 'gesperrt' && x.disabledReason === CAPTION_TEXTE.grund.zustandOffen), 'CA Zustand getrennt: vor Main-Antwort alle vier Tasten gesperrt mit sichtbarem Grund');
  gleich(
    [sd(eintrag(frisch, 'ndi')), sd(eintrag(frisch, 'mikrofon')), sd(eintrag(frisch, 'whisper')), sd(eintrag(frisch, 'fehler')), kopfOnAir(frisch).live],
    ['off unbekannt', 'off unbekannt', 'off unbekannt', 'off unbekannt', false],
    'CA Zustand getrennt: ndi, mikrofon, whisper, fehler unbekannt und kein ON AIR',
  );
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
  const texte = [...flach(CAPTION_TEXTE), ...AUFLOESUNGEN.map((r) => r.label)];
  ok(texte.length > 0 && texte.every((t) => !t.includes('"')), 'CA Texte ohne ASCII-Anführungszeichen');
  // R5: Texte aus @jm/settings (*_TEXTE, STATUS_UNBEKANNT) und @jm/ui (MASTER_LINK_TEXTE) werden nie nachgebaut.
  const fremd = new Set([...Object.entries(settings).filter(([k]) => k.endsWith('_TEXTE')).map(([, v]) => v), MASTER_LINK_TEXTE, settings.STATUS_UNBEKANNT].flatMap(flach));
  const nachgebaut = texte.filter((t) => fremd.has(t));
  ok(fremd.size > 0 && nachgebaut.length === 0, `CA Texte nicht nachgebaut: kein CAPTION_TEXTE-Wert gleicht einem Text aus @jm/settings oder @jm/ui${nachgebaut.length ? ` (${nachgebaut.join(' | ')})` : ''}`);
  const code = ohneKommentare(leseText('src/renderer/src/lib/oberflaeche.ts'));
  ok(!/(?<![\w-])window\b|\blocalStorage\b|\bipcRenderer\b|\bdocument\b|from ['"]electron['"]|from ['"]@\/store\//.test(code), 'CA oberflaeche rein: lib/oberflaeche.ts ohne window, document, localStorage, IPC, Electron und Store');
}

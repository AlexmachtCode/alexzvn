// UX-Pilot C8 · Titler-Ableitungen (Spec 5.1, 6, 7.1–7.4, Anhang A „Titler“): Statusleiste als Kreuzprodukt je Eintrag mit
// Erwartungstabelle (E4, E6–E10, E20), V-Zeile (E18), Abschnitts-Props, Haupttasten (E12), Aktionen, Texte (OF8).
// Ohne window und ohne Electron (G7).
import { ndiOutputView, remoteControlView } from '@jm/settings';
import { ordneStatus, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { ordnerWahlGesperrt, quellZeile, zurueckKnopf, type QuellZustand } from '@shared/datenquelle';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import { DEFAULT_CONFIG, type DisplayInfo, type MasterLinkMeldungZeile, type TitlerConfig, type TitlerStatus, type VerbundAnzeigeZeile } from '@shared/types';
import {
  ABSCHNITT,
  bildschirmAbschnitt,
  dataLinkAbschnitt,
  fernsteuerungAbschnitt,
  hauptTasten,
  iveoAbschnitt,
  ndiAbschnitt,
  statusLeiste,
  TITLER_TEXTE,
  verbundZeileZustand,
  type OberflaechenStand,
  type TasteZustand,
  type TitlerAktionen,
} from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';

// ── Fixtures ──
const STATUS: TitlerStatus = {
  ndiActive: false,
  connections: 0,
  suiteClients: 0,
  variables: {},
  dataSources: [],
  entries: [],
  activeEntry: -1,
  datenQuelle: { art: 'ordner', zeile: '', zurueckKnopf: null, ohneOrdner: true },
};
const PRIMAER: DisplayInfo = { id: 11, label: '2560×1440 (primär)', bounds: { x: 0, y: 0, width: 2560, height: 1440 }, size: { width: 2560, height: 1440 }, scaleFactor: 1, primary: true, internal: false };
const ZWEITER: DisplayInfo = { id: 22, label: '1920×1080', bounds: { x: 2560, y: 0, width: 1920, height: 1080 }, size: { width: 1920, height: 1080 }, scaleFactor: 1, primary: false, internal: false };

interface Teil {
  config?: Partial<TitlerConfig>;
  status?: Partial<TitlerStatus>;
  displays?: DisplayInfo[] | undefined;
  masterLink?: MasterLinkMeldungZeile | null | undefined;
}
function stand(teil: Teil = {}): OberflaechenStand {
  return {
    config: { ...DEFAULT_CONFIG, ...teil.config },
    status: { ...STATUS, ...teil.status },
    displays: 'displays' in teil ? teil.displays : [PRIMAER, ZWEITER],
    masterLink: 'masterLink' in teil ? teil.masterLink : { art: 'aus' },
  };
}
const eintraege = (n: number): TitlerStatus['entries'] => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, label: `Person ${i + 1}` }));
const eintrag = (s: OberflaechenStand, id: string): StatusItem => statusLeiste(s).find((i) => i.id === id) as StatusItem;
const sd = (i: StatusItem): string => `${i.state} ${i.detail ?? ''}`;
const KEINE: TitlerAktionen = { setConfig: () => {}, startNdi: () => {}, stopNdi: () => {}, pickFolder: () => {}, zurueckZumEigenenOrdner: () => {} };
function aufzeichner(): { log: unknown[]; a: TitlerAktionen } {
  const log: unknown[] = [];
  return {
    log,
    a: {
      setConfig: (p) => log.push(['setConfig', p]),
      startNdi: (n) => log.push(['startNdi', n]),
      stopNdi: () => log.push(['stopNdi']),
      pickFolder: () => log.push(['pickFolder']),
      zurueckZumEigenenOrdner: () => log.push(['zurueck']),
    },
  };
}

// ── Master (die 12 Eingänge aus C5 in der Titler-Form, über statusLeiste; E4) ──
{
  const faelle: Array<{ name: string; m: MasterLinkMeldungZeile | null | undefined; soll: string }> = [
    { name: 'undefined', m: undefined, soll: 'off unbekannt' },
    { name: 'null', m: null, soll: 'off unbekannt' },
    { name: 'ohne-client', m: { art: 'ohne-client' }, soll: 'warn nicht gestartet' },
    { name: 'aus', m: { art: 'aus' }, soll: 'off aus' },
    { name: 'sucht', m: { art: 'sucht' }, soll: 'warn sucht …' },
    { name: 'verbindet a1', m: { art: 'verbindet', adresse: '10.0.0.5:8740' }, soll: 'warn verbindet …' },
    { name: 'verbindet a2', m: { art: 'verbindet', adresse: '10.0.0.7:8740' }, soll: 'warn verbindet …' },
    { name: 'verbunden', m: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1000, masterName: 'Regie-PC', suite: 'JM Production Suite' }, soll: 'ok verbunden mit Regie-PC' },
    { name: 'verbunden ohne Namen', m: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1000, masterName: '', suite: 'JM Production Suite' }, soll: 'ok verbunden' },
    { name: 'fehler nicht-gefunden', m: { art: 'fehler', code: 'nicht-gefunden', text: 'Master nicht gefunden', errCode: 'ETIMEDOUT' }, soll: 'error Master nicht gefunden' },
    { name: 'fehler datei', m: { art: 'fehler', code: 'datei', text: 'Kopplungsdatei beschädigt. Neu koppeln.' }, soll: 'error Kopplungsdatei beschädigt. Neu koppeln.' },
    { name: 'unbekannte Art', m: { art: 'neu' } as unknown as MasterLinkMeldungZeile, soll: 'off unbekannt' },
  ];
  pruefeFaelle('Statusleiste Master: 12 Eingänge → Zustand und Detail wie C5, Gruppe verbindung, ohne Abschnitt', faelle, (f) => {
    const i = eintrag(stand({ masterLink: f.m }), 'master-link');
    return vergleiche(sd(i), f.soll) ?? (i.group !== 'verbindung' || i.label !== 'Master' || i.settingsSection !== undefined ? 'Kopf falsch' : null);
  });
}

// ── iveo (E9): bei Quelle master ist die Master-Link-Meldung eine Eingangsgröße ──
{
  const LINK: Record<string, MasterLinkMeldungZeile | null | undefined> = {
    offen: undefined,
    keine: null,
    ohne: { art: 'ohne-client' },
    aus: { art: 'aus' },
    sucht: { art: 'sucht' },
    verbindet: { art: 'verbindet', adresse: '10.0.0.5:8740' },
    fehler: { art: 'fehler', code: 'verweigert', text: 'Master antwortet nicht auf 8738. Ist der Master-Modus dort eingeschaltet?' },
    verbunden: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1, masterName: 'Regie-PC', suite: 'JM Production Suite' },
    neu: { art: 'neu' } as unknown as MasterLinkMeldungZeile,
  };
  const faelle = kreuz({
    art: ['ordner', 'frueher', 'show', 'master'],
    hinweis: ['–', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7'],
    entries: [0, 3],
    link: ['offen', 'keine', 'ohne', 'aus', 'sucht', 'verbindet', 'fehler', 'verbunden', 'neu'],
  } as const);
  // Tabelle: Zeile = Datenquelle (bei master je Master-Link-Meldung), Spalte = kein Hinweis | Quell-Hinweis H3/H4/H7 |
  // Kern-Hinweis H1/H2/H5/H6. Ohne Bindung und bei Quelle show ändert die Meldung nichts.
  const NICHT: [string, string, string] = ['off nicht eingerichtet', 'off nicht eingerichtet', 'off nicht eingerichtet'];
  const LIEFERT: [string, string, string] = ['ok verbunden', 'warn Liste aus früherem Stand', 'off unbekannt'];
  const GETRENNT: [string, string, string] = ['warn Liste aus früherem Stand', 'warn Liste aus früherem Stand', 'off unbekannt'];
  const OFFEN: [string, string, string] = ['off unbekannt', 'off unbekannt', 'off unbekannt'];
  const IVEO: Record<string, [string, string, string]> = {
    ordner: NICHT,
    frueher: NICHT,
    show: LIEFERT,
    'master|verbunden': LIEFERT,
    'master|ohne': GETRENNT,
    'master|aus': GETRENNT,
    'master|sucht': GETRENNT,
    'master|verbindet': GETRENNT,
    'master|fehler': GETRENNT,
    'master|offen': OFFEN,
    'master|keine': OFFEN,
    'master|neu': OFFEN,
  };
  const spalte = (h: string): number => (h === '–' ? 0 : ['H3', 'H4', 'H7'].includes(h) ? 1 : 2);
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    stand({
      masterLink: LINK[f.link],
      status: {
        datenQuelle: { art: f.art, zeile: '', zurueckKnopf: null, ohneOrdner: false },
        hinweis: f.hinweis === '–' ? undefined : { art: f.hinweis, text: `Hinweis ${f.hinweis}` },
        entries: eintraege(f.entries),
      },
    });
  pruefeFaelle('Statusleiste iveo Kreuzprodukt: Datenquelle × Hinweis × Einträge × Master-Link → Tabelle (E9; bei master ok nur mit verbundenem Link)', faelle, (f) =>
    vergleiche(sd(eintrag(props(f), 'iveo')), IVEO[f.art === 'master' ? `master|${f.link}` : f.art][spalte(f.hinweis)]),
  );
  pruefeFaelle('iveo-Abschnitt: Speakerzahl = Einträge nur bei Show und Master; kein Event, keine Bühne, kein Launcher-Knopf (OF5)', faelle, (f) => {
    const p = iveoAbschnitt(props(f));
    const soll = f.art === 'show' || f.art === 'master' ? f.entries : undefined;
    return vergleiche(`${p.speakerCount}/${p.eventName}/${p.stage}/${p.onOpenLauncher}`, `${soll}/undefined/undefined/undefined`);
  });
}

// ── NDI (E7) ──
{
  const faelle = kreuz({ ndiActive: [false, true], connections: [0, 2], ndiName: ['', 'JM Titler'], aufloesung: ['1920x1080', '1921x1080', '1920x1081'] } as const);
  // Tabelle: Zeile = Auflösung|an|Empfänger (der Name ändert den Status nicht); ungerade Breite und ungerade Höhe je für sich.
  const MASS: Record<string, { width: number; height: number }> = {
    '1920x1080': { width: 1920, height: 1080 },
    '1921x1080': { width: 1921, height: 1080 },
    '1920x1081': { width: 1920, height: 1081 },
  };
  const NDI: Record<string, string> = {
    '1920x1080|false|0': 'off aus',
    '1920x1080|false|2': 'off aus',
    '1920x1080|true|0': 'warn an (ohne Rückmeldung)',
    '1920x1080|true|2': 'warn 2 Empfänger · an (ohne Rückmeldung)',
    '1921x1080|false|0': 'error Fehler: Auflösung sollte gerade sein.',
    '1921x1080|false|2': 'error Fehler: Auflösung sollte gerade sein.',
    '1921x1080|true|0': 'error Fehler: Auflösung sollte gerade sein.',
    '1921x1080|true|2': 'error 2 Empfänger · Fehler: Auflösung sollte gerade sein.',
    '1920x1081|false|0': 'error Fehler: Auflösung sollte gerade sein.',
    '1920x1081|false|2': 'error Fehler: Auflösung sollte gerade sein.',
    '1920x1081|true|0': 'error Fehler: Auflösung sollte gerade sein.',
    '1920x1081|true|2': 'error 2 Empfänger · Fehler: Auflösung sollte gerade sein.',
  };
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    stand({ config: { ndiName: f.ndiName, ...MASS[f.aufloesung] }, status: { ndiActive: f.ndiActive, connections: f.connections } });
  pruefeFaelle('Statusleiste NDI Kreuzprodukt: an/aus × Empfänger × Name × Auflösung → Tabelle (E7)', faelle, (f) =>
    vergleiche(sd(eintrag(props(f), 'ndi')), NDI[`${f.aufloesung}|${f.ndiActive}|${f.connections}`]),
  );
  pruefeFaelle('Statusleiste NDI: nie ok, sending nie gesetzt, Empfänger nur bei an und über 0 (keine Rückmeldung des Senders)', faelle, (f) => {
    const p = ndiAbschnitt(props(f), KEINE);
    const i = eintrag(props(f), 'ndi');
    const soll = f.ndiActive && f.connections > 0 ? f.connections : undefined;
    return i.state === 'ok' || p.sending !== undefined || p.receivers !== soll ? `state ${i.state} sending ${p.sending} receivers ${p.receivers}` : null;
  });
  pruefeFaelle('NDI-Abschnitt: leerer Quellenname zeigt „Kein Quellenname eingetragen.“', faelle, (f) =>
    vergleiche(ndiOutputView(ndiAbschnitt(props(f), KEINE)).hinweis, f.ndiName === '' ? 'Kein Quellenname eingetragen.' : undefined),
  );
}

// ── Bildschirm (E8) ──
{
  const LISTEN: Record<string, DisplayInfo[] | undefined> = { unbekannt: undefined, leer: [], primaer: [PRIMAER], zwei: [PRIMAER, ZWEITER] };
  const faelle = kreuz({ enabled: [false, true], liste: ['unbekannt', 'leer', 'primaer', 'zwei'], wahl: [0, 22, 9999] } as const);
  // Tabelle: Zeile = Monitorliste|Wahl (0 = automatisch, 22 = zweiter Monitor, 9999 = abgezogen), Spalten = aus, an.
  const BILDSCHIRM: Record<string, [string, string]> = {
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
    stand({ config: { secondScreenEnabled: f.enabled, secondScreenDisplay: f.wahl }, displays: LISTEN[f.liste] });
  pruefeFaelle('Statusleiste Bildschirm Kreuzprodukt: an/aus × Monitorliste × Wahl → Tabelle (E8)', faelle, (f) =>
    vergleiche(sd(eintrag(props(f), 'bildschirm')), BILDSCHIRM[`${f.liste}|${f.wahl}`][f.enabled ? 1 : 0]),
  );
  pruefeFaelle('Statusleiste Bildschirm: nie ok, windowOpen nie gesetzt, Wahl 0 = automatisch (null)', faelle, (f) => {
    const p = bildschirmAbschnitt(props(f), KEINE);
    const state = eintrag(props(f), 'bildschirm').state;
    return state === 'ok' || p.windowOpen !== undefined || p.selectedId !== (f.wahl === 0 ? null : f.wahl) ? `state ${state} windowOpen ${p.windowOpen} selectedId ${p.selectedId}` : null;
  });
}

// ── Fernsteuerung (E6, OF2, OF5) ──
{
  const MELDUNG: Record<string, FernsteuerungMeldung | undefined> = {
    keine: undefined,
    aus: { laeuft: false, port: 8726, clients: 0 },
    belegt: { laeuft: false, port: 8726, clients: 0, fehler: 'listen EADDRINUSE: address already in use :::8726' },
    fehler: { laeuft: false, port: 8726, clients: 0, fehler: 'listen EACCES: permission denied 0.0.0.0:8726' },
    bereit0: { laeuft: true, port: 8726, clients: 0 },
    bereit3: { laeuft: true, port: 8726, clients: 3 },
  };
  const FERN: Record<string, string> = {
    keine: 'off unbekannt',
    aus: 'off aus',
    belegt: 'error Port belegt',
    fehler: 'error Fehler: listen EACCES: permission denied 0.0.0.0:8726',
    bereit0: 'ok bereit · 0 verbunden',
    bereit3: 'ok bereit · 3 verbunden',
  };
  const faelle = kreuz({ meldung: ['keine', 'aus', 'belegt', 'fehler', 'bereit0', 'bereit3'], modus: [undefined, 'open', 'secure'] } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand => {
    const m = MELDUNG[f.meldung];
    return stand({ status: { fernsteuerung: m === undefined ? undefined : { ...m, modus: f.modus } } });
  };
  pruefeFaelle('Statusleiste Fernsteuerung Kreuzprodukt: Meldung × Modus → Tabelle (E6; „Port belegt“ nur bei EADDRINUSE)', faelle, (f) =>
    vergleiche(sd(eintrag(props(f), 'fernsteuerung')), FERN[f.meldung]),
  );
  pruefeFaelle('Fernsteuerung-Abschnitt: Port 8726, Modus aus der Meldung, Modul jm-suite, kein Port-Feld, kein „Im Launcher einrichten“ (OF5)', faelle, (f) => {
    const p = fernsteuerungAbschnitt(props(f));
    const v = remoteControlView(p);
    const modus = f.meldung === 'keine' ? 'unbekannt' : f.modus === 'secure' ? 'gesichert' : f.modus === 'open' ? 'offen' : 'unbekannt';
    return vergleiche(
      `${p.port}/${v.modusText}/${p.companionModule}/${p.onOpenLauncher}/${v.sichtbar.imLauncher}/${v.sichtbar.portFeld}/${v.sichtbar.companion}/${p.error === undefined || !p.portInUse}`,
      `8726/${modus}/jm-suite/undefined/false/false/true/true`,
    );
  });
  gleich(
    [fernsteuerungAbschnitt(stand({ status: { fernsteuerung: { laeuft: true, port: 9000, clients: 1 } } })).port, fernsteuerungAbschnitt(stand({ status: { fernsteuerung: { laeuft: false, port: 0, clients: 0 } } })).port],
    [9000, 8726],
    'Fernsteuerung-Abschnitt: Port aus der Meldung, ohne gültigen Port STEUER_PORT (E6)',
  );
}

// ── DataLink (E10, OF4, OF7): Datenquelle so gerechnet wie im Main (uebernimmDataState) ──
const R2_SATZ = 'Im Verbund kommen die Speaker vom Master „Regie-PC“. Ein eigener Ordner gilt, solange die Show dort keine Speaker hat.';
{
  const ORDNER = 'D:\\Daten';
  const faelle = kreuz({
    art: ['ordner', 'frueher', 'show', 'master'],
    dataFolder: ['', ORDNER],
    dataError: [undefined, 'Ordner nicht gefunden', 'EACCES: permission denied, scandir'],
    entries: [0, 5],
  } as const);
  const quelle = (art: QuellZustand['art']): QuellZustand => ({
    art,
    showPfad: art === 'show' ? 'D:\\Shows\\Gala.jmshow' : null,
    showName: art === 'show' || art === 'master' ? 'Gala' : null,
    quellHinweis: null,
    master: art === 'master' ? { masterId: 'M1', masterName: 'Regie-PC', schluessel: null } : null,
  });
  const props = (f: (typeof faelle)[number]): OberflaechenStand => {
    const q = quelle(f.art);
    const gesperrt = ordnerWahlGesperrt(q);
    return stand({
      config: { dataFolder: f.dataFolder },
      status: {
        dataError: f.dataError,
        entries: eintraege(f.entries),
        hinweis: { art: 'H3', text: 'Liste aus früherem Stand: Die Show enthält gerade keine Speaker.' },
        datenQuelle: {
          art: f.art,
          zeile: quellZeile(q, f.dataFolder, f.entries),
          zurueckKnopf: zurueckKnopf(q, f.dataFolder),
          ohneOrdner: f.art === 'ordner' && f.dataFolder === '',
          ...(gesperrt ? { ordnerGesperrt: gesperrt } : {}),
        },
      },
    });
  };
  // Tabelle: Fehler gehen vor; ohne Fehler „kein Ordner“ nur bei eigener Quelle ohne Ordner, sonst die Zahl der Einträge.
  const FEHLERBILD: Record<string, string | null> = {
    undefined: null,
    'Ordner nicht gefunden': 'error Ordner fehlt',
    'EACCES: permission denied, scandir': 'error Fehler: EACCES: permission denied, scandir',
  };
  const NACH_ZAHL: Record<string, string> = { '0': 'warn keine Einträge', '5': 'ok 5 Einträge' };
  pruefeFaelle('Statusleiste DataLink Kreuzprodukt: Quelle × eigener Ordner × Fehler × Einträge → Tabelle (E10)', faelle, (f) => {
    const soll = FEHLERBILD[String(f.dataError)] ?? (f.art === 'ordner' && f.dataFolder === '' ? 'off kein Ordner' : NACH_ZAHL[String(f.entries)]);
    return vergleiche(sd(eintrag(props(f), 'datalink')), soll);
  });
  pruefeFaelle('DataLink-Abschnitt: Sperre = R2-Satz nur bei Master, K1 genau mit Text aus dem Main, Quellzeile und Hinweis durchgereicht, Entfernen und Pfadfeld immer (OF4, OF7)', faelle, (f) => {
    const s = props(f);
    const p = dataLinkAbschnitt(s, KEINE);
    const k1 = s.status.datenQuelle.zurueckKnopf;
    const ist = `${p.locked}/${p.backLabel}/${typeof p.onBack}/${p.sourceLine}/${p.notice}/${typeof p.onClearFolder}/${p.capabilities?.ordnerText}/${typeof p.onFolderText}/${p.externeQuelle}/${p.eintraege}/${p.folder}`;
    const soll = `${f.art === 'master' ? R2_SATZ : undefined}/${k1 ?? undefined}/${k1 ? 'function' : 'undefined'}/${s.status.datenQuelle.zeile}/${s.status.hinweis?.text}/function/true/function/${f.art !== 'ordner'}/${f.entries}/${f.dataFolder}`;
    return vergleiche(ist, soll);
  });
  {
    const p = dataLinkAbschnitt(props({ art: 'master', dataFolder: ORDNER, dataError: undefined, entries: 5 }), KEINE);
    ok(p.locked === R2_SATZ && p.backLabel === undefined && typeof p.onClearFolder === 'function', 'DataLink bei Master: gesperrt mit dem R2-Satz, ohne K1, „Ordner entfernen“ bleibt (sichtbar gesperrt)');
    const show = dataLinkAbschnitt(props({ art: 'show', dataFolder: '', dataError: undefined, entries: 5 }), KEINE);
    ok(show.externeQuelle === true && show.folder === '' && show.eintraege === 5, 'DataLink bei Show ohne eigenen Ordner: fremde Quelle mit 5 Einträgen (statt „kein Ordner“)');
  }
  ok(leseText('src/main/datalink.ts').includes("error: 'Ordner nicht gefunden'"), 'DataLink: main/datalink.ts meldet weiter „Ordner nicht gefunden“ (Gleichlauf mit folderMissing)');
}

// ── Statusleiste gesamt ──
{
  const MELDUNG: Record<string, FernsteuerungMeldung | undefined> = {
    keine: undefined,
    belegt: { laeuft: false, port: 8726, clients: 0, fehler: 'listen EADDRINUSE: address already in use :::8726' },
    bereit3: { laeuft: true, port: 8726, clients: 3, modus: 'secure' },
  };
  const MASTER: Record<string, MasterLinkMeldungZeile | null | undefined> = {
    offen: undefined,
    keine: null,
    ohne: { art: 'ohne-client' },
    verbunden: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1, masterName: 'Regie-PC', suite: 'JM Production Suite' },
    fehler: { art: 'fehler', code: 'verweigert', text: 'Master antwortet nicht auf 8738. Ist der Master-Modus dort eingeschaltet?' },
  };
  const faelle = kreuz({
    master: ['offen', 'keine', 'ohne', 'verbunden', 'fehler'],
    ndiActive: [false, true],
    fern: ['keine', 'belegt', 'bereit3'],
    art: ['ordner', 'show', 'master'],
    liste: ['unbekannt', 'zwei'],
    secondScreenEnabled: [false, true],
  } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    stand({
      masterLink: MASTER[f.master],
      displays: f.liste === 'zwei' ? [PRIMAER, ZWEITER] : undefined,
      config: { secondScreenEnabled: f.secondScreenEnabled },
      status: {
        ndiActive: f.ndiActive,
        connections: f.ndiActive ? 2 : 0,
        fernsteuerung: MELDUNG[f.fern],
        entries: eintraege(f.art === 'ordner' ? 0 : 4),
        datenQuelle: { art: f.art, zeile: '', zurueckKnopf: null, ohneOrdner: f.art === 'ordner', ...(f.art === 'master' ? { ordnerGesperrt: R2_SATZ } : {}) },
      },
    });
  const IDS = ['master-link', 'iveo', 'ndi', 'bildschirm', 'fernsteuerung', 'datalink'];
  pruefeFaelle('Statusleiste gesamt: Reihenfolge master-link, iveo, ndi, bildschirm, fernsteuerung, datalink, ids eindeutig, schon nach Gruppen geordnet', faelle, (f) => {
    const leiste = statusLeiste(props(f));
    const ids = leiste.map((i) => i.id).join();
    return vergleiche(ids, IDS.join()) ?? (new Set(leiste.map((i) => i.id)).size !== leiste.length ? 'ids doppelt' : null) ?? vergleiche(ordneStatus(leiste).map((i) => i.id).join(), ids);
  });
  pruefeFaelle('Statusleiste gesamt: jeder Eintrag außer Master springt in seinen Abschnitt (settingsSection = id aus ABSCHNITT)', faelle, (f) => {
    const falsch = statusLeiste(props(f)).filter((i) =>
      i.id === 'master-link' ? i.settingsSection !== undefined : i.settingsSection !== i.id || !(Object.values(ABSCHNITT) as string[]).includes(i.id),
    );
    return falsch.length === 0 ? null : `falsch: ${falsch.map((i) => i.id).join()}`;
  });
  pruefeFaelle('Statusleiste gesamt: nie live (Spec 7.4, E11)', faelle, (f) => (statusLeiste(props(f)).some((i) => i.state === 'live') ? 'live' : null));
  gleich(
    statusLeiste(stand()).map((i) => `${i.group}:${i.label}`),
    ['verbindung:Master', 'verbindung:iveo', 'ausgabe:NDI', 'ausgabe:Bildschirm', 'fernsteuerung:Fernsteuerung', 'tool:DataLink'],
    'Statusleiste: Gruppen und Labels (T2, OF2)',
  );
}

// ── V-Zeile in der Kopfmitte (E18) ──
{
  const FARBEN: Array<[VerbundAnzeigeZeile['farbe'], string]> = [['gruen', 'ok'], ['gelb', 'warn'], ['rot', 'error'], ['gedaempft', 'off']];
  gleich(FARBEN.map(([f]) => verbundZeileZustand(f)), FARBEN.map(([, z]) => z), 'V-Zeile: gruen ok, gelb warn, rot error, gedaempft off (E18)');
  gleich(verbundZeileZustand('lila' as unknown as VerbundAnzeigeZeile['farbe']), 'off', 'V-Zeile: unbekannte Farbe ist off, nie ok und nie live');
}

// ── Haupttasten (E12) ──
{
  const faelle = kreuz({ live: [false, true], activeEntry: [-1, 0, 2, 4], anzahl: [0, 1, 5] } as const);
  // Tabelle ◀/▶ Eintrag: Zeile = Anzahl|aktiver Eintrag → null (keine Tasten) oder [zurück, weiter].
  const NAV: Record<string, [string, string] | null> = {
    '0|-1': null, '0|0': null, '0|2': null, '0|4': null,
    '1|-1': ['frei', 'frei'], '1|0': ['erster', 'letzter'], '1|2': ['frei', 'letzter'], '1|4': ['frei', 'letzter'],
    '5|-1': ['frei', 'frei'], '5|0': ['erster', 'frei'], '5|2': ['frei', 'frei'], '5|4': ['frei', 'letzter'],
  };
  const kurz = (t: TasteZustand): string =>
    t.state === 'bereit' && t.disabledReason === undefined ? 'frei'
      : t.state === 'gesperrt' && t.disabledReason === 'Erster Eintrag' ? 'erster'
        : t.state === 'gesperrt' && t.disabledReason === 'Letzter Eintrag' ? 'letzter'
          : `${t.state}:${t.disabledReason}`;
  pruefeFaelle('Haupttasten Kreuzprodukt: ◀/▶ Eintrag nur mit Einträgen, an den Rändern gesperrt mit Grund → Tabelle', faelle, (f) => {
    const h = hauptTasten(f.live, f.activeEntry, f.anzahl);
    return vergleiche(JSON.stringify(h.eintrag === null ? null : [kurz(h.eintrag.zurueck), kurz(h.eintrag.weiter)]), JSON.stringify(NAV[`${f.anzahl}|${f.activeEntry}`]));
  });
  pruefeFaelle('Haupttasten: Take live genau bei live, sonst bereit, nie gesperrt; Clear immer bereit', faelle, (f) => {
    const h = hauptTasten(f.live, f.activeEntry, f.anzahl);
    return vergleiche(`${h.take.state}/${h.take.disabledReason}/${h.clear.state}/${h.clear.disabledReason}`, `${f.live ? 'live' : 'bereit'}/undefined/bereit/undefined`);
  });
  pruefeFaelle('Haupttasten: jede gesperrte Taste hat einen nicht leeren Grund', faelle, (f) => {
    const h = hauptTasten(f.live, f.activeEntry, f.anzahl);
    const alle = [h.take, h.clear, ...(h.eintrag ? [h.eintrag.zurueck, h.eintrag.weiter] : [])];
    return alle.some((t) => t.state === 'gesperrt' && !t.disabledReason?.trim()) ? 'gesperrt ohne Grund' : null;
  });
}

// ── Aktionen (ohne DOM: die Rückrufe der Abschnitts-Props, mit Aufrufzähler) ──
{
  const { log, a } = aufzeichner();
  const p = ndiAbschnitt(stand({ config: { ndiName: 'Regie Titler' } }), a);
  p.onToggle?.(true);
  p.onToggle?.(false);
  p.onRename?.('Bühne');
  p.onResolution?.('1280x720');
  p.onResolution?.('999x1');
  p.onFps?.('50');
  p.onFps?.('47');
  gleich(
    log,
    [['startNdi', 'Regie Titler'], ['stopNdi'], ['setConfig', { ndiName: 'Bühne' }], ['setConfig', { width: 1280, height: 720 }], ['setConfig', { fps: 50 }]],
    'Aktionen NDI: Schalter startet mit dem Quellenname bzw. stoppt; Name, Auflösung, Bildrate als Config; fremde Werte ignoriert',
  );
  gleich(
    [p.capabilities, p.resolution, p.fps, p.resolutionOptions?.map((o) => o.value), p.fpsOptions?.map((o) => o.value), p.transparency],
    [{ toggle: true, rename: true, resolution: true, fps: true }, '1920x1080', '30', ['1920x1080', '1280x720'], ['25', '30', '50', '60'], undefined],
    'NDI-Abschnitt: Fähigkeiten ohne Transparenz, Auflösungen und Bildraten wie bisher',
  );
}
{
  const { log, a } = aufzeichner();
  const p = bildschirmAbschnitt(stand(), a);
  p.onToggle?.(true);
  p.onSelect?.(null);
  p.onSelect?.(22);
  p.onBackground?.('#123456');
  gleich(
    log,
    [['setConfig', { secondScreenEnabled: true }], ['setConfig', { secondScreenDisplay: 0 }], ['setConfig', { secondScreenDisplay: 22 }], ['setConfig', { chromaColor: '#123456' }]],
    'Aktionen Bildschirm: an/aus, automatisch = 0, Monitor-id, Chroma-Farbe',
  );
  gleich(
    [p.background, p.backgroundDefault, p.capabilities, p.screens?.map((s) => `${s.id}:${s.primary}`)],
    ['#00B140', '#00B140', { toggle: true, background: true, backgroundPicker: true }, ['11:true', '22:false']],
    'Bildschirm-Abschnitt: Chroma-Farbe, Standardfarbe #00B140, Farbwähler, Monitorliste',
  );
}
{
  const { log, a } = aufzeichner();
  const mitK1 = stand({
    config: { dataFolder: 'D:\\Show\\Daten' },
    status: { datenQuelle: { art: 'show', zeile: 'Quelle: Show „Gala“ · 5 Speaker', zurueckKnopf: 'Zurück zum eigenen Ordner (Daten)', ohneOrdner: false } },
  });
  const p = dataLinkAbschnitt(mitK1, a);
  p.onPickFolder?.();
  p.onClearFolder?.();
  p.onFolderText?.('E:\\Neu');
  p.onBack?.();
  gleich(log, [['pickFolder'], ['setConfig', { dataFolder: '' }], ['setConfig', { dataFolder: 'E:\\Neu' }], ['zurueck']], 'Aktionen DataLink: Ordner wählen, entfernen, Pfad von Hand, K1');
}

// ── Texte und Quelltext ──
{
  const texte = Object.values(TITLER_TEXTE).flatMap((t) => (typeof t === 'string' ? [t] : typeof t === 'function' ? [t('X')] : Object.values(t)));
  ok(texte.every((t) => !t.includes('"')), 'Titler-Texte: keine ASCII-Anführungszeichen (G5)');
  gleich(
    [TITLER_TEXTE.take, TITLER_TEXTE.clear, TITLER_TEXTE.zurueck, TITLER_TEXTE.weiter, TITLER_TEXTE.ersterEintrag, TITLER_TEXTE.letzterEintrag],
    ['Take', 'Clear', '◀ Eintrag', 'Eintrag ▶', 'Erster Eintrag', 'Letzter Eintrag'],
    'Titler-Texte: Haupttasten und Gründe wörtlich (T3; ohne „●“, keine Kürzel)',
  );
  gleich(
    [TITLER_TEXTE.hinweisNdiAn, TITLER_TEXTE.hinweisNdiAus],
    [
      'NDI-Quelle aktiv — in TriCaster/vMix/OBS als Eingang über das vorhandene Programm legen (Alpha/Key).',
      'NDI unter Einstellungen › NDI-Ausgabe starten, damit die transparente Quelle im Netz erscheint. Vorschau läuft auch ohne NDI.',
    ],
    'Titler-Texte: Hinweiszeile bei NDI an (wie bisher, Nr. 9) und aus (T4)',
  );
  gleich(
    [TITLER_TEXTE.keinOrdner, TITLER_TEXTE.keineGrafik, TITLER_TEXTE.keineVorlagen],
    [
      'Kein Datenordner aktiv. Unter Einstellungen › DataLink einen Ordner wählen — oder den Titler über eine JM Show mit iveo-Daten öffnen. Abrufbare Einträge erscheinen dann hier.',
      'Keine Grafik-Vorlage gewählt — unter „Grafik-Vorlagen“ auswählen oder unter Einstellungen › Grafik-Vorlagen importieren.',
      'Noch keine Vorlagen. Import unter Einstellungen › Grafik-Vorlagen.',
    ],
    'Titler-Texte: Daten / Recall ohne Ordner (T5) und Grafik (T6a, T6b) nennen die neuen Orte',
  );
  gleich(
    [TITLER_TEXTE.stil, TITLER_TEXTE.vorlagen, TITLER_TEXTE.loeschen, TITLER_TEXTE.loeschenAria('Gala-Insert'), TITLER_TEXTE.laedt, TITLER_TEXTE.aufloesungUngerade, TITLER_TEXTE.companionModul],
    ['Stil', 'Grafik-Vorlagen', 'Löschen', 'Vorlage „Gala-Insert“ löschen', 'Lädt…', 'Auflösung sollte gerade sein.', 'jm-suite'],
    'Titler-Texte: Panel tool-eigen (T7), Laden (T11), ungerade Auflösung (Nr. 54), Companion-Modul (T10)',
  );
  ok(texte.every((t) => !/Reiter|rechts starten/.test(t)), 'Titler-Texte: kein Verweis auf Reiter oder „rechts starten“ (Befund 16)');
  gleich(Object.values(ABSCHNITT), ['iveo', 'ndi', 'bildschirm', 'fernsteuerung', 'datalink', 'stil', 'vorlagen'], 'Abschnitts-ids (E20)');
  const code = leseText('src/renderer/src/lib/oberflaeche.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!/\bwindow\b|\blocalStorage\b|\bipcRenderer\b|from ['"]electron['"]/.test(code), 'Quelltext: lib/oberflaeche.ts ohne window, localStorage, IPC und Electron (G7)');
}

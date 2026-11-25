// UX Welle 2b, Presenter c · Ableitungen und Kürzelschutz (B3 ON AIR, B10 Tastenfilter, B11 Bildschirm, B13 Sperren,
// Spec 7.2): Statusleiste als Kreuzprodukt je Eintrag und vor der ersten Antwort, ON AIR, Haupttasten von Editor und Referent,
// Pille und Statusleiste, Kürzel aus Textfeldern und bei fokussierter Auswahl, Texte. Geladen wird nur lib/oberflaeche.ts
// (rein, ohne lib/pdf.ts); kein window, kein Electron.
import * as settings from '@jm/settings';
import { ABSCHNITT_TEXTE, NDI_TEXTE, REMOTE_TEXTE, SCREEN_TEXTE } from '@jm/settings';
import { MASTER_LINK_TEXTE, ordneStatus, UNBEKANNT as UNBEKANNT_TEXT, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { GastKlickerLage, GastKlickerStatus } from '@shared/gast-klicker';
import type { MasterLinkMeldungZeile, NdiStatus, PresentationState, RemoteStatus, ScreenMode } from '@shared/types';
import {
  ABSCHNITT,
  ausgabeAbschnitt,
  editorTaste,
  fernsteuerungAbschnitt,
  istTextfeld,
  kopfOnAir,
  ndiAbschnitt,
  nurNdiLaeuft,
  PRESENTER_TEXTE,
  referentTasten,
  statusLeiste,
  timerAbschnitt,
  verarbeiteTaste,
  verschiebenMoeglich,
  type OberflaechenStand,
  type PresenterAktionen,
  type StartWahl,
} from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { basisMeldung, bildschirme, grundStand, laufend, ohneKommentare, presentAttrappe } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8728';
const T = PRESENTER_TEXTE;
/** Eintrag der Statusleiste; `wahl` = Startwahl des Editors (der Referent hat keine). */
const eintrag = (s: OberflaechenStand, id: string, wahl?: StartWahl): StatusItem | undefined => statusLeiste(s, wahl).find((i) => i.id === id);
const sd = (i: StatusItem | undefined): string => (i === undefined ? 'fehlt' : `${i.state} ${i.detail ?? ''}`);
const LABEL_22 = 'Bildschirm 2 · 1920×1080';
const KEINE_WAHL = { bildschirm: 22, nurNdi: false } as const;

/** Liste nach Achsenwert: unbekannt (noch keine Antwort), ohne Publikum (kein `current`), mit Publikum auf 22. */
const liste = (l: 'unbekannt' | 'ohne' | 'mit') => (l === 'unbekannt' ? undefined : bildschirme(l === 'mit' ? 22 : null));
/** Präsentationszustand nach Achsenwert: keine Antwort, keine Präsentation, laufend. */
const praes = (p: 'undefined' | 'aus' | 'laeuft', z: Partial<PresentationState> = {}): PresentationState | undefined =>
  p === 'undefined' ? undefined : p === 'aus' ? { active: false, index: 0, total: 0, screen: 'live' } : laufend(z);

const NDI: Record<string, NdiStatus | undefined> = {
  undefined: undefined,
  aus: { an: false, lage: 'aus', empfaenger: 0, grund: null },
  startet: { an: true, lage: 'startet', empfaenger: 0, grund: null },
  sendet0: { an: true, lage: 'sendet', empfaenger: 0, grund: null },
  sendet2: { an: true, lage: 'sendet', empfaenger: 2, grund: null },
  nvAn: { an: true, lage: 'nicht-verfuegbar', empfaenger: 0, grund: 'NDI-Sender antwortet nicht.' },
  nvAus: { an: false, lage: 'nicht-verfuegbar', empfaenger: 0, grund: 'NDI-Ausgang startet nicht: kaputt' },
  nvOhneGrund: { an: true, lage: 'nicht-verfuegbar', empfaenger: 0, grund: null },
};

// ── PS Statusleiste master-link ──
{
  const faelle: Array<{ name: string; m: MasterLinkMeldungZeile | null | undefined; soll: string }> = [
    { name: 'undefined', m: undefined, soll: 'off unbekannt' },
    { name: 'null', m: null, soll: 'off unbekannt' },
    { name: 'aus', m: { art: 'aus' }, soll: 'off aus' },
    { name: 'sucht', m: { art: 'sucht' }, soll: 'warn sucht …' },
    { name: 'verbunden', m: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1, masterName: 'Regie-PC', suite: 'JM Production Suite' }, soll: 'ok verbunden mit Regie-PC' },
  ];
  pruefeFaelle('PS Statusleiste master-link: Meldung → Zustand und Detail, Gruppe verbindung, ohne Abschnitt', faelle, (f) => {
    const i = eintrag(grundStand({ masterLink: f.m }), 'master-link');
    return vergleiche(sd(i), f.soll) ?? (i?.group !== 'verbindung' || i.settingsSection !== undefined ? 'Kopf falsch' : null);
  });
}

// ── PS Statusleiste timer (Modell Stage-Display, W15): unbekannt · aus · verbunden · nicht gefunden, in beiden Fenstern ──
{
  const faelle = kreuz({ timer: ['undefined', 'da'], an: [false, true], verbunden: [false, true], fenster: ['editor', 'referent'] } as const);
  pruefeFaelle('PS Statusleiste timer: unbekannt, aus, verbunden, nicht gefunden; Gruppe verbindung, Sprung zu timer in beiden Fenstern', faelle, (f) => {
    const timer = f.timer === 'undefined' ? undefined : { config: { enabled: f.an, host: '10.0.0.7', port: 7777 }, verbunden: f.verbunden };
    const i = eintrag(grundStand({ timer, fenster: f.fenster }), 'timer');
    const soll = timer === undefined ? 'off unbekannt' : !f.an ? 'off aus' : f.verbunden ? 'ok verbunden' : 'warn nicht gefunden';
    return vergleiche(sd(i), soll) ?? (i?.group !== 'verbindung' || i.settingsSection !== ABSCHNITT.timer || i.label !== T.timer.titel ? 'Kopf falsch' : null);
  });
}

// ── PS Statusleiste publikum (B11): Präsentation × Liste × Startwahl × Fenster; Sprungziel nur im Editor (der Referent hat kein
// `ausgabe`). Startwahl „keine“ = ohne Startwahl (Referent); 99 steht nicht in der Liste (abgesteckt oder neue Display-id) ──
{
  const faelle = kreuz({ p: ['undefined', 'aus', 'laeuft'], liste: ['unbekannt', 'ohne', 'mit'], wahl: ['keine', null, 22, 99], fenster: ['editor', 'referent'] } as const);
  pruefeFaelle('PS Statusleiste publikum: unbekannt, aus, ‹Bildschirm›, Keiner – nur NDI; ohne Präsentation warnt gemessen offen, fehlende Startwahl wie der Abschnitt', faelle, (f) => {
    const wahl = f.wahl === 'keine' ? undefined : { bildschirm: f.wahl, nurNdi: false };
    const i = eintrag(grundStand({ praesentation: praes(f.p), bildschirme: liste(f.liste), fenster: f.fenster }), 'publikum', wahl);
    const soll =
      f.p === 'undefined' || f.liste === 'unbekannt'
        ? 'off unbekannt'
        : f.p === 'laeuft'
          ? f.liste === 'ohne'
            ? 'off Keiner – nur NDI'
            : `ok ${LABEL_22}`
          : f.wahl === 99
            ? `error ${SCREEN_TEXTE.bildschirmFehlt}`
            : f.liste === 'ohne'
              ? 'off aus'
              : `warn ${SCREEN_TEXTE.ausFensterOffen} · ${LABEL_22}`;
    const sprung = f.fenster === 'editor' ? ABSCHNITT.ausgabe : undefined;
    return vergleiche(sd(i), soll) ?? (i?.group !== 'ausgabe' || i.settingsSection !== sprung || i.label !== T.publikum.titel ? `Kopf falsch: ${i?.group}/${i?.settingsSection}` : null);
  });
}

// ── PS Statusleiste ndi: NdiStatus × Plattform; nur unter Windows (sonst kein Eintrag) ──
{
  const SOLL: Record<string, string> = {
    undefined: 'off unbekannt',
    aus: 'off aus',
    startet: 'warn startet',
    sendet0: 'ok sendet, 0 Empfänger',
    sendet2: 'ok sendet, 2 Empfänger',
    nvAn: 'error Fehler: NDI-Sender antwortet nicht.',
    nvAus: 'error Fehler: NDI-Ausgang startet nicht: kaputt',
    nvOhneGrund: 'error Fehler: nicht verfügbar',
  };
  const faelle = kreuz({ ndi: Object.keys(NDI), plattform: ['win32', 'darwin'], fenster: ['editor', 'referent'] } as const);
  pruefeFaelle('PS Statusleiste ndi: unbekannt, aus, startet, sendet n Empfänger, nicht verfügbar mit Grund; nur unter Windows', faelle, (f) => {
    const i = eintrag(grundStand({ ndi: NDI[f.ndi], plattform: f.plattform, fenster: f.fenster }), 'ndi');
    if (f.plattform !== 'win32') return i === undefined ? null : 'Eintrag außerhalb von Windows';
    return vergleiche(sd(i), SOLL[f.ndi]) ?? (i?.group !== 'ausgabe' || i.settingsSection !== ABSCHNITT.ndi || i.label !== NDI_TEXTE.titel ? 'Kopf falsch' : null);
  });
}

// ── PS Statusleiste fernsteuerung: Meldung × Modus (Port 8728) ──
{
  const MELDUNG: Record<string, FernsteuerungMeldung | null | undefined> = {
    undefined: undefined,
    null: null,
    aus: { laeuft: false, port: 8728, clients: 0 },
    belegt: { laeuft: false, port: 8728, clients: 0, fehler: BELEGT },
    fehler: { laeuft: false, port: 8728, clients: 0, fehler: 'listen EACCES: permission denied 0.0.0.0:8728' },
    bereit0: basisMeldung({ clients: 0 }),
    bereit3: basisMeldung({ clients: 3 }),
  };
  const SOLL: Record<string, string> = {
    undefined: 'off unbekannt',
    null: 'off unbekannt',
    aus: 'off aus',
    belegt: 'error Port belegt',
    fehler: 'error Fehler: listen EACCES: permission denied 0.0.0.0:8728',
    bereit0: 'ok bereit · 0 verbunden',
    bereit3: 'ok bereit · 3 verbunden',
  };
  const faelle = kreuz({ meldung: Object.keys(MELDUNG), modus: [undefined, 'open', 'secure'] } as const);
  pruefeFaelle('PS Statusleiste fernsteuerung: Meldung × Modus → unbekannt, aus, Port belegt, Fehler, bereit n verbunden', faelle, (f) => {
    const m = MELDUNG[f.meldung];
    const i = eintrag(grundStand({ fernsteuerung: m ? { ...m, modus: f.modus } : m }), 'fernsteuerung');
    return vergleiche(sd(i), SOLL[f.meldung]) ?? (i?.group !== 'fernsteuerung' || i.settingsSection !== ABSCHNITT.fernsteuerung || i.label !== REMOTE_TEXTE.titel ? 'Kopf falsch' : null);
  });
  const p = fernsteuerungAbschnitt(grundStand({ fernsteuerung: basisMeldung() }));
  gleich(
    [
      fernsteuerungAbschnitt(grundStand({ fernsteuerung: { laeuft: true, port: 9000, clients: 1 } })).port,
      fernsteuerungAbschnitt(grundStand({ fernsteuerung: { laeuft: false, port: 0, clients: 0 } })).port,
      fernsteuerungAbschnitt(grundStand()).port,
      p.companionModule,
      p.id,
    ],
    [9000, 8728, 8728, 'JM Presenter', 'fernsteuerung'],
    'PS Fernsteuerung-Abschnitt: Port aus der Meldung, sonst 8728; Companion-Modul „JM Presenter“',
  );
}

// ── PS Statusleiste handy: RemoteStatus × running × error ──
{
  const FEHLER = 'Port 7330 ist belegt — anderen Port wählen.';
  const faelle = kreuz({ handy: ['undefined', 'da'], running: [false, true], error: [null, FEHLER], fenster: ['editor', 'referent'] } as const);
  pruefeFaelle('PS Statusleiste handy: unbekannt, aus, läuft, Fehler (error); Gruppe fernsteuerung, Sprung zu handy', faelle, (f) => {
    const handy: RemoteStatus | undefined =
      f.handy === 'undefined'
        ? undefined
        : { running: f.running, url: f.running ? 'http://10.0.0.5:7330' : null, pin: null, config: { enabled: true, bind: 'all', port: 7330, pinEnabled: false }, error: f.error };
    const i = eintrag(grundStand({ handy, fenster: f.fenster }), 'handy');
    const soll = handy === undefined ? 'off unbekannt' : f.error !== null ? `error ${FEHLER}` : f.running ? 'ok läuft' : 'off aus';
    return vergleiche(sd(i), soll) ?? (i?.group !== 'fernsteuerung' || i.settingsSection !== ABSCHNITT.handy || i.label !== T.handy.titel ? 'Kopf falsch' : null);
  });
}

// ── PS Statusleiste gast-klicker: an × Lage × pausiert × Gäste ──
{
  const LAGEN: GastKlickerLage[] = ['aus', 'verbindet', 'verbunden', 'getrennt', 'abgelehnt'];
  const faelle = kreuz({ da: [false, true], an: [false, true], lage: LAGEN, pausiert: [false, true], gaeste: [0, 1, 3] } as const);
  pruefeFaelle('PS Statusleiste gast-klicker: unbekannt, aus, verbindet, verbunden n Gäste, pausiert, getrennt, abgelehnt', faelle, (f) => {
    const g: GastKlickerStatus | undefined = f.da ? { an: f.an, lage: f.lage, link: f.an ? 'https://x/k/abc' : null, gaeste: f.gaeste, pausiert: f.pausiert } : undefined;
    const i = eintrag(grundStand({ gastKlicker: g }), 'gast-klicker');
    const gaeste = f.gaeste === 1 ? '1 Gast' : `${f.gaeste} Gäste`;
    const soll =
      g === undefined
        ? 'off unbekannt'
        : !f.an || f.lage === 'aus'
          ? 'off aus'
          : f.lage === 'verbindet'
            ? 'warn verbindet …'
            : f.lage === 'getrennt'
              ? 'warn getrennt – verbindet neu'
              : f.lage === 'abgelehnt'
                ? 'error abgelehnt – Gast-Klicker aus- und wieder einschalten'
                : f.pausiert
                  ? 'warn pausiert'
                  : `ok verbunden · ${gaeste}`;
    return vergleiche(sd(i), soll) ?? (i?.group !== 'fernsteuerung' || i.settingsSection !== ABSCHNITT.gastKlicker || i.label !== T.gastKlicker.titel ? 'Kopf falsch' : null);
  });
}

// ── PS Statusleiste praesentation: unbekannt · keine · Folie n von m · Schwarz · Weiß ──
{
  const faelle = kreuz({ p: ['undefined', 'aus', 'laeuft'], screen: ['live', 'black', 'white'] as ScreenMode[], index: [0, 4] } as const);
  pruefeFaelle('PS Statusleiste praesentation: unbekannt, keine, Folie n von m, Schwarz, Weiß; Gruppe tool, ohne Sprung', faelle, (f) => {
    const p = f.p === 'undefined' ? undefined : f.p === 'aus' ? { active: false, index: 0, total: 0, screen: f.screen } : laufend({ index: f.index, total: 12, screen: f.screen });
    const i = eintrag(grundStand({ praesentation: p }), 'praesentation');
    const soll =
      p === undefined ? 'off unbekannt' : !p.active ? 'off keine' : f.screen === 'black' ? 'warn Schwarz' : f.screen === 'white' ? 'warn Weiß' : `ok Folie ${f.index + 1} von 12`;
    return vergleiche(sd(i), soll) ?? (i?.group !== 'tool' || i.settingsSection !== undefined || i.label !== T.praesentation.titel ? 'Kopf falsch' : null);
  });
}

// ── PS vor erster Antwort (Review Focus 4, Spec 7.2): alles undefined → kein ok, kein live, jede Taste gesperrt mit Grund ──
{
  const IDS = ['master-link', 'timer', 'publikum', 'ndi', 'fernsteuerung', 'handy', 'gast-klicker', 'praesentation'];
  for (const fenster of ['editor', 'referent'] as const) {
    const s = grundStand({ fenster });
    gleich(
      statusLeiste(s).map((i) => `${i.id}:${i.state}:${i.detail}`),
      IDS.map((id) => `${id}:off:unbekannt`),
      `PS vor erster Antwort (${fenster}): alle acht Einträge off unbekannt, nie ok`,
    );
    const tasten = [editorTaste(s, 3, { active: false, label: '' }), ...Object.values(referentTasten(s))];
    ok(
      tasten.every((t) => t.state === 'gesperrt' && t.disabledReason === T.grund.zustandOffen) && !kopfOnAir(s).live,
      `PS vor erster Antwort (${fenster}): Editor-Taste und die vier Referent-Tasten gesperrt mit „${T.grund.zustandOffen}“, Kopf nicht live`,
    );
  }
  gleich(
    statusLeiste(grundStand({ masterLink: null, fernsteuerung: null })).map((i) => i.state),
    ['off', 'off', 'off', 'off', 'off', 'off', 'off', 'off'],
    'PS vor erster Antwort: null (keine Brücke) ist ebenfalls unbekannt',
  );
  gleich(
    statusLeiste(grundStand({ plattform: 'darwin' })).map((i) => i.id),
    IDS.filter((id) => id !== 'ndi'),
    'PS vor erster Antwort: außerhalb von Windows fehlt nur ndi',
  );
}

// ── PS Statusleiste gesamt: Reihenfolge, Gruppen, nie live, Sprungziele nur zu Abschnitten des Fensters ──
{
  const faelle = kreuz({
    p: ['undefined', 'aus', 'laeuft'],
    liste: ['unbekannt', 'ohne', 'mit'],
    ndi: ['undefined', 'sendet2', 'nvAn'],
    fern: [undefined, basisMeldung({ clients: 2 })],
    fenster: ['editor', 'referent'],
  } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    grundStand({
      praesentation: praes(f.p, { screen: 'live' }),
      bildschirme: liste(f.liste),
      ndi: NDI[f.ndi],
      fernsteuerung: f.fern,
      fenster: f.fenster,
      masterLink: { art: 'sucht' },
      handy: { running: true, url: 'http://10.0.0.5:7330', pin: '1234', config: { enabled: true, bind: 'all', port: 7330, pinEnabled: true }, error: null },
      gastKlicker: { an: true, lage: 'verbunden', link: 'https://x/k/abc', gaeste: 2, pausiert: false },
      timer: { config: { enabled: true, host: '127.0.0.1', port: 7777 }, verbunden: true },
    });
  const IDS = ['master-link', 'timer', 'publikum', 'ndi', 'fernsteuerung', 'handy', 'gast-klicker', 'praesentation'];
  pruefeFaelle('PS Statusleiste gesamt: feste Reihenfolge, ids eindeutig, schon nach Gruppen geordnet', faelle, (f) => {
    const leiste = statusLeiste(props(f));
    const ids = leiste.map((i) => i.id).join();
    return vergleiche(ids, IDS.join()) ?? (new Set(leiste.map((i) => i.id)).size !== leiste.length ? 'ids doppelt' : null) ?? vergleiche(ordneStatus(leiste).map((i) => i.id).join(), ids);
  });
  pruefeFaelle('PS Statusleiste gesamt: die Leiste zeigt nie live (ON AIR sitzt im Kopf)', faelle, (f) => (statusLeiste(props(f)).some((i) => i.state === 'live') ? 'live' : null));
  pruefeFaelle('PS Statusleiste gesamt: Sprungziele nur zu Abschnitten aus ABSCHNITT; im Referenten nie ausgabe oder import', faelle, (f) => {
    const falsch = statusLeiste(props(f)).filter(
      (i) =>
        i.settingsSection !== undefined &&
        (!(Object.values(ABSCHNITT) as string[]).includes(i.settingsSection) ||
          (f.fenster === 'referent' && (i.settingsSection === ABSCHNITT.ausgabe || i.settingsSection === ABSCHNITT.import))),
    );
    return falsch.length === 0 ? null : `falsch: ${falsch.map((i) => `${i.id}→${i.settingsSection}`).join()}`;
  });
  gleich(
    Object.entries(ABSCHNITT),
    [
      ['ausgabe', 'ausgabe'],
      ['ndi', 'ndi'],
      ['fernsteuerung', 'fernsteuerung'],
      ['handy', 'handy'],
      ['gastKlicker', 'gast-klicker'],
      ['timer', 'timer'],
      ['import', 'import'],
    ],
    'PS Abschnitts-ids: ausgabe, ndi, fernsteuerung, handy, gast-klicker, timer, import',
  );
}

// ── PS ON AIR (B3): active × screen × undefined; live nur bei active && screen === 'live', Kopf und Editor-Taste gleich ──
{
  const faelle = kreuz({ p: ['undefined', 'da'], active: [false, true], screen: ['live', 'black', 'white'] as ScreenMode[] } as const);
  pruefeFaelle('PS ON AIR: live nur bei laufender Präsentation mit Folie, für Kopf und Editor-Taste gleich; Referent-Tasten nie live', faelle, (f) => {
    const s = grundStand({ praesentation: f.p === 'undefined' ? undefined : { active: f.active, index: 1, total: 3, screen: f.screen } });
    const soll = f.p === 'da' && f.active && f.screen === 'live';
    const kopf = kopfOnAir(s);
    const editor = editorTaste(s, 3, { active: false, label: '' }).state === 'live';
    const referent = Object.values(referentTasten(s)).some((t) => t.state === 'live');
    return vergleiche(`${kopf.live}/${editor}/${referent}/${Object.keys(kopf).join()}`, `${soll}/${soll}/false/live`);
  });
}

// ── PS Editor-Taste: Präsentieren/Beenden, gesperrt „Keine sichtbaren Folien zum Präsentieren.“ bzw. busy.label ──
{
  const faelle = kreuz({ p: ['undefined', 'aus', 'laeuft', 'schwarz'], busy: ['nein', 'ja', 'ohneText'], sichtbar: [0, 3] } as const);
  pruefeFaelle('PS Editor-Taste: Beenden in jeder laufenden Präsentation; sonst Präsentieren, gesperrt mit Grund (Lädt, busy.label, keine Folien)', faelle, (f) => {
    const p = f.p === 'undefined' ? undefined : f.p === 'aus' ? praes('aus') : laufend({ screen: f.p === 'schwarz' ? 'black' : 'live' });
    const busy = f.busy === 'nein' ? { active: false, label: '' } : { active: true, label: f.busy === 'ja' ? 'Importiere…' : ' ' };
    const t = editorTaste(grundStand({ praesentation: p }), f.sichtbar, busy);
    const soll =
      p === undefined
        ? `${T.taste.praesentieren}|gesperrt|${T.grund.zustandOffen}`
        : p.active
          ? `${T.taste.beenden}|${p.screen === 'live' ? 'live' : 'bereit'}|`
          : f.busy === 'ja'
            ? `${T.taste.praesentieren}|gesperrt|Importiere…`
            : f.busy === 'ohneText'
              ? `${T.taste.praesentieren}|gesperrt|${T.grund.beschaeftigt}`
              : f.sichtbar === 0
                ? `${T.taste.praesentieren}|gesperrt|Keine sichtbaren Folien zum Präsentieren.`
                : `${T.taste.praesentieren}|bereit|`;
    return vergleiche(`${t.label}|${t.state}|${t.disabledReason ?? ''}`, soll) ?? (t.shortcut !== undefined ? 'Kürzel ohne Kürzel' : null);
  });
}

// ── PS Referent-Tasten (B13, B6): Zurück bei Index 0 gesperrt „Erste Folie“; Weiter nach naechsterIndex mit und ohne Schleife;
// Schwarz und Weiß bereit mit wechselnder Beschriftung, nie live; Sperre nie ohne Grund ──
{
  const faelle = kreuz({ index: [0, 1, 2], total: [1, 3], schleife: [undefined, false, true], screen: ['live', 'black', 'white'] as ScreenMode[] } as const).filter(
    (f) => f.index < f.total,
  );
  pruefeFaelle('PS Referent-Tasten: Zurück, Weiter (B13), Schwarz und Weiß je Zustand, mit Kürzeln B, ←, →, W', faelle, (f) => {
    const r = referentTasten(grundStand({ fenster: 'referent', praesentation: laufend({ index: f.index, total: f.total, schleife: f.schleife, screen: f.screen }) }));
    // Unabhängig von naechsterIndex gerechnet: auf der letzten Folie sperrt Weiter, außer die Schleife springt zu einer anderen Folie.
    const weiterGesperrt = f.index >= f.total - 1 && !(f.schleife === true && f.total > 1);
    const zeile = (t: { label: string; state: string; disabledReason?: string; shortcut?: string }): string => `${t.label}|${t.state}|${t.disabledReason ?? ''}|${t.shortcut ?? ''}`;
    const ist = [r.schwarz, r.zurueck, r.weiter, r.weiss].map(zeile).join(' / ');
    const soll = [
      `${f.screen === 'black' ? `${T.taste.schwarz}${T.taste.an}` : T.taste.schwarz}|bereit||B`,
      f.index <= 0 ? `${T.taste.zurueck}|gesperrt|Erste Folie|←` : `${T.taste.zurueck}|bereit||←`,
      weiterGesperrt ? `${T.taste.weiter}|gesperrt|Letzte Folie|→` : `${T.taste.weiter}|bereit||→`,
      `${f.screen === 'white' ? `${T.taste.weiss}${T.taste.an}` : T.taste.weiss}|bereit||W`,
    ].join(' / ');
    return vergleiche(ist, soll);
  });
  const letzte = (schleife: boolean): string => referentTasten(grundStand({ praesentation: laufend({ index: 2, total: 3, schleife }) })).weiter.state;
  gleich([letzte(false), letzte(true)], ['gesperrt', 'bereit'], 'PS Referent-Tasten (B13): auf der letzten Folie ist Weiter ohne Schleife gesperrt, mit Schleife bedienbar (der Main springt zur ersten)');
  const alle = kreuz({ p: ['undefined', 'aus', 'laeuft'], index: [0, 2], schleife: [false, true] } as const);
  pruefeFaelle('PS Referent-Tasten: jede gesperrte Taste hat einen Grund, keine ist live', alle, (f) => {
    const r = referentTasten(grundStand({ praesentation: praes(f.p, { index: f.index, schleife: f.schleife }) }));
    const tasten = Object.values(r);
    if (tasten.some((t) => t.state === 'gesperrt' && !t.disabledReason?.trim())) return 'gesperrt ohne Grund';
    return tasten.some((t) => t.state === 'live') ? 'live' : null;
  });
  gleich(Object.keys(referentTasten(grundStand())), ['schwarz', 'zurueck', 'weiter', 'weiss'], 'PS Referent-Tasten: Schwarz, Zurück, Weiter, Weiß');
  gleich([T.kuerzel.schwarz, T.kuerzel.zurueck, T.kuerzel.weiter, T.kuerzel.weiss], ['B', '←', '→', 'W'], 'PS Referent-Tasten: angezeigte Kürzel sind vorhandene (B, ←, →, W), keine neuen');
}

// ── PS Publikum neu gelesen (Review Focus 5, B11): `publikum` und der Abschnitt folgen der jeweils letzten Liste ──
{
  const p = laufend();
  const folge: Array<OberflaechenStand['bildschirme']> = [undefined, bildschirme(22), bildschirme(33), bildschirme(null), bildschirme(22), undefined];
  gleich(
    folge.map((b) => sd(eintrag(grundStand({ praesentation: p, bildschirme: b }), 'publikum'))),
    ['off unbekannt', `ok ${LABEL_22}`, 'ok Bildschirm 3 · 1280×720', 'off Keiner – nur NDI', `ok ${LABEL_22}`, 'off unbekannt'],
    'PS Publikum neu gelesen: publikum folgt bildschirme (22 → 33 → ohne Publikumsfenster „Keiner – nur NDI“ → 22 → unbekannt)',
  );
  gleich(
    folge.map((b) => String(ausgabeAbschnitt(grundStand({ praesentation: p, bildschirme: b }), KEINE_WAHL).measuredId)),
    ['undefined', '22', '33', 'undefined', '22', 'undefined'],
    'PS Publikum neu gelesen: measuredId des Abschnitts folgt derselben Liste (current), nie der Wahl',
  );
  gleich(
    folge.map((b) => nurNdiLaeuft(grundStand({ praesentation: p, bildschirme: b }))),
    [false, false, false, true, false, false],
    'PS Publikum neu gelesen: nurNdiLaeuft nur bei laufender Präsentation, bekannter Liste und keiner Zeile mit current',
  );
  const nurNdi = kreuz({ p: ['undefined', 'aus', 'laeuft'], liste: ['unbekannt', 'ohne', 'mit'] } as const);
  pruefeFaelle('PS Publikum neu gelesen: nurNdiLaeuft = active, Liste bekannt, keine Zeile mit current', nurNdi, (f) =>
    vergleiche(String(nurNdiLaeuft(grundStand({ praesentation: praes(f.p), bildschirme: liste(f.liste) }))), String(f.p === 'laeuft' && f.liste === 'ohne')),
  );
}

// ── PS Pille und Statusleiste gleich (B11): active × Liste (mit current, ohne, unbekannt) × Startwahl, auch eine Wahl, die nicht
// (mehr) in der Liste steht (99: abgesteckt oder neue Display-id nach dem Wiederverbinden) ──
{
  const faelle = kreuz({ active: [false, true], liste: ['mit', 'ohne', 'unbekannt'], bildschirm: [null, 22, 33, 99], nurNdi: [false, true] } as const);
  pruefeFaelle('PS Pille und Statusleiste gleich: gleicher Zustand über alle Wahlen; nur NDI ohne error und ohne offenen Bildschirm; fehlende Wahl beide „Bildschirm fehlt“; mit current derselbe Bildschirm', faelle, (f) => {
    const s = grundStand({ praesentation: f.active ? laufend() : praes('aus'), bildschirme: liste(f.liste) });
    const wahl = { bildschirm: f.bildschirm, nurNdi: f.nurNdi };
    const v = settings.screenOutputView(ausgabeAbschnitt(s, wahl));
    const pub = eintrag(s, 'publikum', wahl);
    if (v.status.state !== pub?.state) return `Zustand Pille ${v.status.state} ${v.status.text} / Leiste ${sd(pub)}`;
    if (nurNdiLaeuft(s)) {
      if (v.status.state === 'error' || v.gemessen !== undefined || v.status.state === 'ok') return `nur NDI: Pille ${v.status.state} ${v.status.text} ${v.gemessen?.label ?? ''}`;
      return vergleiche(pub.detail, T.publikum.nurNdi);
    }
    // Ohne laufendes Publikum zählt die Startwahl: fehlt sie in der Liste, melden beide den Text des Abschnitts.
    if (f.bildschirm === 99 && f.liste !== 'unbekannt' && !(f.active && f.liste === 'mit')) {
      return vergleiche(`${v.status.state} ${v.status.text}|${sd(pub)}`, `error ${SCREEN_TEXTE.bildschirmFehlt}|error ${SCREEN_TEXTE.bildschirmFehlt}`);
    }
    if (f.liste === 'mit') {
      if (v.gemessen?.label !== LABEL_22 || !pub.detail?.includes(LABEL_22)) return `nennt nicht denselben: ${v.gemessen?.label} / ${pub.detail}`;
      if (f.active) return vergleiche(`${v.status.text}|${pub.detail}`, `${SCREEN_TEXTE.aufBildschirm(2)}|${LABEL_22}`);
    }
    return null;
  });
  // Die beiden Lagen aus der Prüfung wörtlich: Startwahl 99 fehlt in der Liste.
  const lage = (p: PresentationState, b: OberflaechenStand['bildschirme']): string => {
    const s = grundStand({ praesentation: p, bildschirme: b });
    const wahl = { bildschirm: 99, nurNdi: false };
    const v = settings.screenOutputView(ausgabeAbschnitt(s, wahl));
    return `${v.status.state} ${v.status.text} | ${sd(eintrag(s, 'publikum', wahl))}`;
  };
  gleich(
    [lage(laufend(), bildschirme(null)), lage(praes('aus') as PresentationState, bildschirme(null)), lage(praes('aus') as PresentationState, bildschirme(22))],
    [
      `off ${ABSCHNITT_TEXTE.aus} | off Keiner – nur NDI`,
      `error ${SCREEN_TEXTE.bildschirmFehlt} | error ${SCREEN_TEXTE.bildschirmFehlt}`,
      `error ${SCREEN_TEXTE.bildschirmFehlt} | error ${SCREEN_TEXTE.bildschirmFehlt}`,
    ],
    'PS Pille und Statusleiste gleich: fehlende Startwahl – bei nur NDI kein Fehler (Pille aus, Leiste Keiner – nur NDI), ohne Präsentation beide „Bildschirm fehlt“',
  );
}

// ── PS Ausgabe vor der ersten Antwort (Gesamtprüfung UX Welle 2b, M9, „Nur Gemessenes“): Solange der Präsentationszustand fehlt,
// zeigte die Pille „aus“ bzw. „aus, Fenster noch offen“ (enabled aus undefined geraten). Jetzt „unbekannt“, wie der Eintrag
// Publikum der Statusleiste; mit Antwort wie bisher ──
{
  const faelle = kreuz({ liste: ['unbekannt', 'ohne', 'mit'], bildschirm: [null, 22, 99] } as const);
  pruefeFaelle('PS Ausgabe vor der ersten Antwort: ohne Präsentationszustand zeigt die Pille „unbekannt“ (nie „aus“), gleich dem Eintrag Publikum', faelle, (f) => {
    const st = grundStand({ praesentation: undefined, bildschirme: liste(f.liste) });
    const wahl = { bildschirm: f.bildschirm, nurNdi: false };
    const v = settings.screenOutputView(ausgabeAbschnitt(st, wahl));
    return vergleiche(`${v.status.state} ${v.status.text} | ${sd(eintrag(st, 'publikum', wahl))}`, `off ${UNBEKANNT_TEXT} | off ${UNBEKANNT_TEXT}`);
  });
}

// ── PS Ausgabe-Abschnitt (B11): Startwahl, gemessener Ort aus current, Sperre bei stehender Wahl „Keiner – nur NDI“ ──
{
  const faelle = kreuz({
    p: ['undefined', 'aus', 'laeuft'],
    liste: ['unbekannt', 'ohne', 'mit'],
    bildschirm: [null, 33, 99],
    nurNdi: [false, true],
    ndi: ['undefined', 'aus', 'startet', 'sendet2', 'nvAn'],
    plattform: ['win32', 'darwin'],
  } as const);
  pruefeFaelle('PS Ausgabe-Abschnitt: enabled = active && !nurNdiLaeuft, windowOpen und measuredId aus current, kein Vollbild, locked nur bei stehender Wahl; bei nur NDI ohne fehlende Wahl', faelle, (f) => {
    const s = grundStand({ praesentation: praes(f.p), bildschirme: liste(f.liste), ndi: NDI[f.ndi], plattform: f.plattform });
    const a = ausgabeAbschnitt(s, { bildschirm: f.bildschirm, nurNdi: f.nurNdi });
    const enabled = f.p === 'laeuft' && f.liste !== 'ohne';
    // Läuft nur NDI, greift eine Wahl, die nicht in der Liste steht, nicht als Fehler: der Abschnitt bekommt dann keine Wahl.
    const gewaehlt = f.bildschirm === 99 && f.p === 'laeuft' && f.liste === 'ohne' ? null : f.bildschirm;
    const offen = f.liste === 'unbekannt' ? undefined : f.liste === 'mit';
    const steht = f.plattform === 'win32' && f.nurNdi && (f.ndi === 'startet' || f.ndi === 'sendet2');
    // Die Liste des Abschnitts trägt nur id, Name und primär; ohne Antwort bleibt sie unbekannt (nie leer erfunden). Seit M9
    // (Gesamtprüfung) auch ohne Antwort zum Präsentationszustand: dann wäre enabled geraten, der Abschnitt zeigt „unbekannt“.
    const screens = a.screens?.map((x) => `${x.id}:${x.label}:${x.primary}`).join(',');
    const sollScreens = f.liste === 'unbekannt' || f.p === 'undefined' ? undefined : '11:Bildschirm 1 (Haupt) · 2032×1144:true,22:Bildschirm 2 · 1920×1080:false,33:Bildschirm 3 · 1280×720:false';
    return (
      vergleiche(
        [a.id, a.enabled, a.windowOpen, a.selectedId, a.measuredId, a.capabilities.toggle === true, a.capabilities.fullscreen === true, a.capabilities.background === true, a.locked ?? '', typeof a.onSelect].map(String).join('|'),
        [ABSCHNITT.ausgabe, enabled, offen, gewaehlt, f.liste === 'mit' ? 22 : undefined, false, false, false, steht ? T.publikum.nurNdiGewaehlt : '', 'undefined'].map(String).join('|'),
      ) ?? vergleiche(screens, sollScreens)
    );
  });
  const gewaehlt: Array<number | null> = [];
  const a = ausgabeAbschnitt(grundStand(), { bildschirm: 22, nurNdi: false }, { startBildschirmWaehlen: (id) => gewaehlt.push(id) });
  a.onSelect?.(33);
  a.onSelect?.(null);
  gleich(gewaehlt, [33, null], 'PS Ausgabe-Abschnitt: die Wahl geht nur an startBildschirmWaehlen (gemerkt in der Wurzel-View, B11)');
}

// ── PS Verschieben möglich (B11): „Auf diesen Bildschirm“ nur bei laufender Präsentation, gemessenem Publikum und anderer Wahl ──
{
  const faelle = kreuz({ p: ['undefined', 'aus', 'laeuft'], liste: ['unbekannt', 'ohne', 'mit'], gewaehlt: [null, 22, 33, 99] } as const);
  pruefeFaelle('PS Verschieben möglich: nur wenn das Publikum gemessen auf einem Bildschirm steht und die Wahl ein anderer bekannter ist', faelle, (f) =>
    vergleiche(
      String(verschiebenMoeglich(grundStand({ praesentation: praes(f.p), bildschirme: liste(f.liste) }), f.gewaehlt)),
      String(f.p === 'laeuft' && f.liste === 'mit' && f.gewaehlt === 33),
    ),
  );
}

// ── PS NDI-Abschnitt: Ansicht aus NdiStatus, nur Schalter (Name, Auflösung und Bildrate fest) ──
{
  const faelle = kreuz({ ndi: Object.keys(NDI) } as const);
  pruefeFaelle('PS NDI-Abschnitt: enabled = an, sendet/startet gemessen, Empfänger nur beim Senden, nicht verfügbar als Fehler, Name JM Presenter', faelle, (f) => {
    const n = NDI[f.ndi];
    const p = ndiAbschnitt(grundStand({ ndi: n }));
    const fehler = n?.lage === 'nicht-verfuegbar' ? (n.grund ?? 'nicht verfügbar') : '';
    return vergleiche(
      [p.id, p.enabled, p.sending, p.starting, p.receivers, p.error ?? '', p.sourceName, JSON.stringify(p.capabilities), typeof p.onToggle].map(String).join('|'),
      [ABSCHNITT.ndi, n?.an === true, n === undefined ? undefined : n.lage === 'sendet', n?.lage === 'startet', n?.lage === 'sendet' ? n.empfaenger : undefined, fehler, 'JM Presenter', '{"toggle":true}', 'undefined']
        .map(String)
        .join('|'),
    );
  });
  const geschaltet: boolean[] = [];
  const aktionen: Pick<PresenterAktionen, 'ndiSchalten'> = { ndiSchalten: (an) => geschaltet.push(an) };
  ndiAbschnitt(grundStand({ ndi: NDI.aus }), aktionen).onToggle?.(true);
  gleich(geschaltet, [true], 'PS NDI-Abschnitt: der Schalter geht an ndiSchalten');
}

// ── PS Timer-Abschnitt (PeersSection, Modell Stage-Display): eine Zeile JM Timer mit Ein/Aus, Host und Port ──
{
  const faelle = kreuz({ timer: ['undefined', 'da'], an: [false, true], verbunden: [false, true] } as const);
  pruefeFaelle('PS Timer-Abschnitt: eine Zeile „JM Timer“, Ein/Aus und Verbindung gemessen, ohne Auto', faelle, (f) => {
    const t = f.timer === 'undefined' ? undefined : { config: { enabled: f.an, host: '10.0.0.7', port: 7788 }, verbunden: f.verbunden };
    const p = timerAbschnitt(grundStand({ timer: t }));
    const z = p.peers[0];
    return vergleiche(
      [p.id, p.peers.length, z.role, z.label, z.host, z.port, z.defaultPort, z.enabled, z.connected, z.source, JSON.stringify(p.capabilities)].map(String).join('|'),
      [ABSCHNITT.timer, 1, 'timer', 'JM Timer', t ? '10.0.0.7' : '', t ? 7788 : 7777, 7777, t?.config.enabled, t?.verbunden, undefined, '{"toggle":true}'].map(String).join('|'),
    );
  });
  const meldungen: string[] = [];
  const a: Pick<PresenterAktionen, 'timerSchalten' | 'timerSetzen'> = {
    timerSchalten: (an) => meldungen.push(`schalten ${an}`),
    timerSetzen: (host, port) => meldungen.push(`setzen ${host}:${port}`),
  };
  const p = timerAbschnitt(grundStand({ timer: { config: { enabled: false, host: '127.0.0.1', port: 7777 }, verbunden: false } }), a);
  p.onToggle?.('timer', true);
  p.onSet?.('timer', '10.0.0.9', 7778);
  gleich(meldungen, ['schalten true', 'setzen 10.0.0.9:7778'], 'PS Timer-Abschnitt: Ein/Aus geht an timerSchalten, Setzen an timerSetzen');
}

// ── Kürzel (B10, N2b 1.7). Ziele als Attrappen: gelesen werden nur tagName, type und isContentEditable ──
const ziel = (t: object): EventTarget => t as unknown as EventTarget;
const druecke = (key: string, target: EventTarget | null, extra: object = {}): string => {
  const { present, aufrufe } = presentAttrappe();
  let verhindert = 0;
  verarbeiteTaste({ key, target, preventDefault: () => void verhindert++, ...extra }, present);
  return `${aufrufe.join(',') || '–'} / preventDefault ${verhindert}`;
};
/** Wirkung heute (usePresentation.ts:47-93 vor dem Umbau), unabhängig vom Code aufgeschrieben: 16 Tasten, 18 Tastenwerte. */
const HEUTE: Record<string, string> = {
  ArrowRight: 'next',
  ArrowDown: 'next',
  PageDown: 'next',
  ' ': 'next',
  Enter: 'next',
  ArrowLeft: 'prev',
  ArrowUp: 'prev',
  PageUp: 'prev',
  Backspace: 'prev',
  Home: 'goto(0)',
  End: 'goto(9999)',
  b: 'setScreen(black)',
  B: 'setScreen(black)',
  '.': 'setScreen(black)',
  w: 'setScreen(white)',
  W: 'setScreen(white)',
  ',': 'setScreen(white)',
  Escape: 'stop',
};
const TEXTFELDER: Record<string, EventTarget> = {
  'input ohne type': ziel({ tagName: 'INPUT' }),
  'input text': ziel({ tagName: 'INPUT', type: 'text' }),
  'input number': ziel({ tagName: 'INPUT', type: 'number' }),
  'input password': ziel({ tagName: 'INPUT', type: 'password' }),
  'input search': ziel({ tagName: 'input', type: 'search' }),
  textarea: ziel({ tagName: 'TEXTAREA' }),
  contentEditable: ziel({ tagName: 'DIV', isContentEditable: true }),
};
const KEINE_TEXTFELDER: Record<string, EventTarget | null> = {
  null: null,
  select: ziel({ tagName: 'SELECT' }),
  'select klein': ziel({ tagName: 'select' }),
  button: ziel({ tagName: 'BUTTON' }),
  'input checkbox': ziel({ tagName: 'INPUT', type: 'checkbox' }),
  'input radio': ziel({ tagName: 'INPUT', type: 'radio' }),
  'input range': ziel({ tagName: 'INPUT', type: 'range' }),
  'input button': ziel({ tagName: 'INPUT', type: 'button' }),
  'input submit': ziel({ tagName: 'INPUT', type: 'submit' }),
  'input color': ziel({ tagName: 'INPUT', type: 'color' }),
  // Gesamtprüfung UX Welle 2b (I2): ein schreibgeschütztes Feld (Gast-Link) ist kein Textfeld, dort tippt niemand; der Klicker blättert.
  'input readOnly': ziel({ tagName: 'INPUT', type: 'text', readOnly: true }),
  div: ziel({ tagName: 'DIV', isContentEditable: false }),
  body: ziel({ tagName: 'BODY' }),
  'ohne tagName': ziel({}),
};

// ── PS Kürzel aus Textfeld (Review Focus 1, B10): Tippen in Feldern schaltet nicht und blättert nicht ──
{
  const faelle = [
    ...Object.entries(TEXTFELDER).map(([name, z]) => ({ name, z, soll: true })),
    ...Object.entries(KEINE_TEXTFELDER).map(([name, z]) => ({ name, z, soll: false })),
  ];
  pruefeFaelle('PS Kürzel aus Textfeld: istTextfeld true für input (text, number, password …), textarea, contentEditable; false für select, Knöpfe, checkbox, radio, range, color und schreibgeschützte Felder', faelle, (f) =>
    vergleiche(String(istTextfeld(f.z)), String(f.soll)),
  );
  const tippen = kreuz({ feld: Object.keys(TEXTFELDER), taste: ['.', ',', 'b', 'w', ' ', 'Enter', 'Backspace'] } as const);
  pruefeFaelle('PS Kürzel aus Textfeld: „.“, „,“, „b“, „w“, Leertaste, Enter und Rücktaste im Feld rufen nichts auf und kein preventDefault', tippen, (f) =>
    vergleiche(druecke(f.taste, TEXTFELDER[f.feld]), '– / preventDefault 0'),
  );
  const alle = kreuz({ feld: Object.keys(TEXTFELDER), taste: Object.keys(HEUTE) } as const);
  pruefeFaelle('PS Kürzel aus Textfeld: keines der 16 Kürzel wirkt aus einem Textfeld (B10: auch Pfeile, Pos1, Ende, Esc gehören dem Feld)', alle, (f) =>
    vergleiche(druecke(f.taste, TEXTFELDER[f.feld]), '– / preventDefault 0'),
  );
}

// ── PS Klicker bei fokussierter Auswahl (Review Focus 1, B10): select ist kein Textfeld, der Klicker blättert weiter ──
{
  gleich(
    [druecke('PageDown', KEINE_TEXTFELDER.select), druecke('PageDown', null), druecke('ArrowRight', KEINE_TEXTFELDER.select), druecke('PageUp', KEINE_TEXTFELDER.select)],
    ['next / preventDefault 1', 'next / preventDefault 1', 'next / preventDefault 1', 'prev / preventDefault 1'],
    'PS Klicker bei fokussierter Auswahl: Bild↓ auf der Bildschirmwahl ruft next genau einmal und preventDefault (hält die Auswahl fest), ohne Ziel ebenso',
  );
}

// ── PS Kürzel unverändert (N2b 1.7): alle 16 Tasten ohne Textfeld-Ziel wirken wie heute; andere Tasten wirken nicht ──
{
  const faelle = kreuz({ ziel: Object.keys(KEINE_TEXTFELDER), taste: Object.keys(HEUTE) } as const);
  pruefeFaelle('PS Kürzel unverändert: die 16 Tasten (18 Tastenwerte) lösen ohne Textfeld-Ziel dieselbe Wirkung aus wie heute, je mit preventDefault', faelle, (f) =>
    vergleiche(druecke(f.taste, KEINE_TEXTFELDER[f.ziel]), `${HEUTE[f.taste]} / preventDefault 1`),
  );
  const fremd = kreuz({ ziel: ['null', 'select', 'button'], taste: ['a', 'F11', 'F5', 'Tab', 'Delete', 'Shift', 'Control', 's', 'r', '1'] } as const);
  pruefeFaelle('PS Kürzel unverändert: andere Tasten (F11, Tab, Buchstaben, Ziffern) rufen nichts auf und kein preventDefault', fremd, (f) =>
    vergleiche(druecke(f.taste, KEINE_TEXTFELDER[f.ziel]), '– / preventDefault 0'),
  );
  gleich(Object.keys(HEUTE).length, 18, 'PS Kürzel unverändert: geprüft sind alle 18 Tastenwerte der 16 Kürzel (B/b und W/w je ein Kürzel)');
}

// ── PS Zusatztasten wie bisher (Befund zu Nr. 88/208): Außerhalb von Textfeldern prüft verarbeiteTaste keine Zusatztaste, wie der
// alte Hook. Strg+W (und Cmd+W) schaltet darum Weiß und ruft preventDefault (das Standardmenü schließt das Fenster dann nicht,
// abgeleitet); Strg+B schaltet Schwarz ──
{
  const faelle = kreuz({ ziel: ['null', 'select', 'button', 'body'], taste: ['w', 'W'], zusatz: ['ctrlKey', 'metaKey'] } as const);
  pruefeFaelle('PS Zusatztasten wie bisher: Strg+W und Cmd+W außerhalb von Textfeldern schalten Weiß, je mit preventDefault', faelle, (f) =>
    vergleiche(druecke(f.taste, KEINE_TEXTFELDER[f.ziel], { [f.zusatz]: true }), 'setScreen(white) / preventDefault 1'),
  );
  gleich(
    [druecke('b', null, { ctrlKey: true }), druecke('W', null, { ctrlKey: true, shiftKey: true })],
    ['setScreen(black) / preventDefault 1', 'setScreen(white) / preventDefault 1'],
    'PS Zusatztasten wie bisher: Strg+B schaltet Schwarz, Strg+Umschalt+W Weiß (je preventDefault)',
  );
}

// ── PS Strg+W im Textfeld (Controller-Entscheid zu Task 9, Bedenken 1): Aus einem Textfeld ruft Strg+W bzw. Cmd+W nur
// preventDefault, damit das Standardmenü das Fenster nicht schließt (das beendete die Präsentation); kein Weiß. Jede andere
// Taste im Feld bleibt nach B10 ohne Wirkung und ohne preventDefault ──
{
  const faelle = kreuz({ feld: Object.keys(TEXTFELDER), taste: ['w', 'W'], zusatz: [{ ctrlKey: true }, { metaKey: true }, { ctrlKey: true, shiftKey: true }] } as const);
  pruefeFaelle('PS Strg+W im Textfeld: Strg+W und Cmd+W rufen im Feld nur preventDefault, keine Aktion', faelle, (f) =>
    vergleiche(druecke(f.taste, TEXTFELDER[f.feld], f.zusatz), '– / preventDefault 1'),
  );
  const andere = kreuz({
    feld: Object.keys(TEXTFELDER),
    fall: ['w', 'W', 'Alt+W', 'Strg+B', 'Strg+R', 'Strg+Enter', 'Cmd+Pfeil', 'Strg+Punkt'],
  } as const);
  const FALL: Record<(typeof andere)[number]['fall'], [string, object]> = {
    w: ['w', {}],
    W: ['W', { shiftKey: true }],
    'Alt+W': ['w', { altKey: true }],
    'Strg+B': ['b', { ctrlKey: true }],
    'Strg+R': ['r', { ctrlKey: true }],
    'Strg+Enter': ['Enter', { ctrlKey: true }],
    'Cmd+Pfeil': ['ArrowRight', { metaKey: true }],
    'Strg+Punkt': ['.', { ctrlKey: true }],
  };
  pruefeFaelle('PS Strg+W im Textfeld: w ohne Strg/Cmd und jede andere Taste im Feld rufen nichts auf und kein preventDefault (B10)', andere, (f) =>
    vergleiche(druecke(FALL[f.fall][0], TEXTFELDER[f.feld], FALL[f.fall][1]), '– / preventDefault 0'),
  );
}

// ── PS Kürzel-Hook: usePresenterKeys ruft nur noch verarbeiteTaste mit window.jmpr.present (Quelltext-Wächter) ──
{
  const hook = ohneKommentare(leseText('src/renderer/src/lib/usePresentation.ts'));
  const koerper = hook.slice(hook.indexOf('export function usePresenterKeys'));
  ok(
    /import \{[^}]*\bverarbeiteTaste\b[^}]*\} from '(@\/lib|\.)\/oberflaeche'/.test(hook) &&
      /verarbeiteTaste\(\s*e\s*,\s*window\.jmpr\.present\s*\)/.test(koerper) &&
      !/\bcase\s+'/.test(hook) &&
      !/preventDefault/.test(hook) &&
      /addEventListener\('keydown'/.test(koerper) &&
      /if \(!enabled\) return;/.test(koerper),
    'PS Kürzel-Hook: usePresenterKeys ruft nur verarbeiteTaste(e, window.jmpr.present) am keydown von window, ohne eigenes switch',
  );
}

// ── Texte und Quelltext ──
{
  const aufruf = (fn: (...n: number[]) => unknown): string[] => {
    try {
      return flach(fn(2, 3));
    } catch {
      return [];
    }
  };
  const flach = (v: unknown): string[] =>
    typeof v === 'function' ? aufruf(v as (...n: number[]) => unknown) : typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(flach) : [];
  const texte = flach(PRESENTER_TEXTE);
  ok(texte.length > 0 && texte.every((t) => !t.includes('"')), 'PS Texte ohne ASCII-Anführungszeichen');
  // R5: Texte aus @jm/settings (*_TEXTE, STATUS_UNBEKANNT) und @jm/ui (MASTER_LINK_TEXTE) werden nie nachgebaut.
  const fremd = new Set([...Object.entries(settings).filter(([k]) => k.endsWith('_TEXTE')).map(([, v]) => v), MASTER_LINK_TEXTE, settings.STATUS_UNBEKANNT].flatMap(flach));
  const nachgebaut = texte.filter((t) => fremd.has(t));
  ok(fremd.size > 0 && nachgebaut.length === 0, `PS keine nachgebauten Texte: kein PRESENTER_TEXTE-Wert gleicht einem Text aus @jm/settings oder @jm/ui${nachgebaut.length ? ` (${nachgebaut.join(' | ')})` : ''}`);
  ok(
    [T.grund.keineFolien, T.publikum.nurNdi].join('|') === 'Keine sichtbaren Folien zum Präsentieren.|Keiner – nur NDI' && ABSCHNITT_TEXTE.aus === 'aus',
    'PS Texte: vorhandene Texte wörtlich übernommen (Keine sichtbaren Folien zum Präsentieren., Keiner – nur NDI)',
  );
  const code = ohneKommentare(leseText('src/renderer/src/lib/oberflaeche.ts'));
  ok(
    !/(?<![\w-])window\b|\blocalStorage\b|\bipcRenderer\b|\bdocument\b|from ['"]electron['"]/.test(code) && !/from ['"](react|\.\/pdf|@\/lib\/pdf|\.\/usePresentation|@\/lib\/usePresentation|@\/store\/[^'"]*)['"]/.test(code),
    'PS oberflaeche rein: lib/oberflaeche.ts ohne window, document, localStorage, IPC, Electron, React, pdf.ts und Store',
  );
}

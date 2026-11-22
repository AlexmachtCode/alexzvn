// UX Welle 1 · Timer-Ableitungen (Aufgabe c; Spec 5.1, 7.1–7.4, Anhang A „Timer“, E3, E9, E10): Statusleiste als Kreuzprodukt
// je Eintrag mit Erwartungstabelle, Fernsteuerungs-Abschnitt, Haupttasten, Kürzelschutz, Texte.
// Ohne window und ohne Electron.
import * as settings from '@jm/settings';
import { remoteControlView } from '@jm/settings';
import { MASTER_LINK_TEXTE, ordneStatus, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import { INITIAL_STATE, type TimetableItem } from '@shared/timer-state';
import type { MasterLinkMeldungZeile, VerbundAnzeigeZeile } from '@shared/verbund';
import {
  ABSCHNITT,
  fernsteuerungAbschnitt,
  hauptTasten,
  istEingabeZiel,
  statusLeiste,
  TIMER_TEXTE,
  verbundZeileZustand,
  type OberflaechenStand,
  type TasteZustand,
} from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { basisMeldung } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8724';

function stand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return {
    timer: INITIAL_STATE,
    connected: undefined,
    speakerOffen: undefined,
    masterLink: undefined,
    fernsteuerung: undefined,
    verbund: undefined,
    ...teil,
  };
}
const eintrag = (s: OberflaechenStand, id: string): StatusItem => statusLeiste(s).find((i) => i.id === id) as StatusItem;
const sd = (i: StatusItem): string => `${i.state} ${i.detail ?? ''}`;

// ── TI Statusleiste master-link ──
{
  const faelle: Array<{ name: string; m: MasterLinkMeldungZeile | null | undefined; soll: string }> = [
    { name: 'undefined', m: undefined, soll: 'off unbekannt' },
    { name: 'null', m: null, soll: 'off unbekannt' },
    { name: 'ohne-client', m: { art: 'ohne-client' }, soll: 'warn nicht gestartet' },
    { name: 'aus', m: { art: 'aus' }, soll: 'off aus' },
    { name: 'sucht', m: { art: 'sucht' }, soll: 'warn sucht …' },
    { name: 'verbunden', m: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1, masterName: 'Regie-PC', suite: 'JM Production Suite' }, soll: 'ok verbunden mit Regie-PC' },
    { name: 'fehler', m: { art: 'fehler', code: 'datei', text: 'Kopplungsdatei beschädigt. Neu koppeln.' }, soll: 'error Kopplungsdatei beschädigt. Neu koppeln.' },
  ];
  pruefeFaelle('TI Statusleiste master-link: Meldung → Zustand und Detail, Gruppe verbindung, ohne Abschnitt', faelle, (f) => {
    const i = eintrag(stand({ masterLink: f.m }), 'master-link');
    return vergleiche(sd(i), f.soll) ?? (i.group !== 'verbindung' || i.settingsSection !== undefined ? 'Kopf falsch' : null);
  });
}

// ── TI Statusleiste sync: undefined = noch kein Socket-Ereignis, nie „verbunden“ ──
{
  const SYNC: Record<string, string> = {
    undefined: 'off unbekannt',
    true: 'ok Verbunden mit JM Timer-Sync',
    false: 'error Keine Verbindung',
  };
  const faelle = kreuz({ connected: [undefined, true, false] } as const);
  pruefeFaelle('TI Statusleiste sync: Socket-Zustand → unbekannt, verbunden, offline (Spalte store.connected)', faelle, (f) => {
    const i = eintrag(stand({ connected: f.connected }), 'sync');
    return vergleiche(sd(i), SYNC[String(f.connected)]) ?? (i.group !== 'verbindung' || i.label !== 'Sync' || i.settingsSection !== undefined ? 'Kopf falsch' : null);
  });
}

// ── TI Statusleiste speaker (E3): isOpen/onStatus; offen = ok (gemessen), zu = off (Normalzustand) ──
{
  const SPEAKER: Record<string, string> = { undefined: 'off unbekannt', true: 'ok Fenster offen', false: 'off Fenster zu' };
  const faelle = kreuz({ offen: [undefined, true, false] } as const);
  pruefeFaelle('TI Statusleiste speaker: unbekannt, offen, zu; springt in den Abschnitt speaker', faelle, (f) => {
    const i = eintrag(stand({ speakerOffen: f.offen }), 'speaker');
    return vergleiche(sd(i), SPEAKER[String(f.offen)]) ?? (i.group !== 'ausgabe' || i.label !== 'Speaker-Fenster' || i.settingsSection !== ABSCHNITT.speaker ? 'Kopf falsch' : null);
  });
}

// ── TI Statusleiste fernsteuerung (E10 nur Meldung): Meldung × Modus ──
{
  const MELDUNG: Record<string, FernsteuerungMeldung | null | undefined> = {
    undefined: undefined,
    null: null,
    aus: { laeuft: false, port: 8724, clients: 0 },
    belegt: { laeuft: false, port: 8724, clients: 0, fehler: BELEGT },
    fehler: { laeuft: false, port: 8724, clients: 0, fehler: 'listen EACCES: permission denied 0.0.0.0:8724' },
    bereit0: basisMeldung({ clients: 0 }),
    bereit3: basisMeldung({ clients: 3 }),
  };
  const FERN: Record<string, string> = {
    undefined: 'off unbekannt',
    null: 'off unbekannt',
    aus: 'off aus',
    belegt: 'error Port belegt',
    fehler: 'error Fehler: listen EACCES: permission denied 0.0.0.0:8724',
    bereit0: 'ok bereit · 0 verbunden',
    bereit3: 'ok bereit · 3 verbunden',
  };
  const faelle = kreuz({ meldung: ['undefined', 'null', 'aus', 'belegt', 'fehler', 'bereit0', 'bereit3'], modus: [undefined, 'open', 'secure'] } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand => {
    const m = MELDUNG[f.meldung];
    return stand({ fernsteuerung: m ? { ...m, modus: f.modus } : m });
  };
  pruefeFaelle('TI Statusleiste fernsteuerung: Meldung × Modus → unbekannt, aus, Port belegt, Fehler, bereit n verbunden', faelle, (f) => {
    const i = eintrag(props(f), 'fernsteuerung');
    // Fund C1: Port fest (8724), kein Schalter; der Abschnitt zeigt dieselbe Lage nur an → reine Anzeige, kein Sprung.
    return vergleiche(sd(i), FERN[f.meldung]) ?? (i.group !== 'fernsteuerung' || 'settingsSection' in i ? 'Kopf falsch' : null);
  });
  pruefeFaelle('TI Fernsteuerung-Abschnitt: Port 8724, Modus aus der Meldung, nur Status (kein Port-Feld, kein Schalter, kein Launcher-Knopf)', faelle, (f) => {
    const p = fernsteuerungAbschnitt(props(f));
    const v = remoteControlView(p);
    const modus = f.meldung === 'undefined' || f.meldung === 'null' ? 'unbekannt' : f.modus === 'secure' ? 'gesichert' : f.modus === 'open' ? 'offen' : 'unbekannt';
    return vergleiche(
      `${p.port}/${v.modusText}/${v.sichtbar.portFeld}/${v.sichtbar.steuerung}/${v.sichtbar.imLauncher}/${p.onToggle}/${p.onPortChange}/${p.error === undefined || !p.portInUse}`,
      `8724/${modus}/false/false/false/undefined/undefined/true`,
    );
  });
  gleich(
    [
      fernsteuerungAbschnitt(stand({ fernsteuerung: { laeuft: true, port: 9000, clients: 1 } })).port,
      fernsteuerungAbschnitt(stand({ fernsteuerung: { laeuft: false, port: 0, clients: 0 } })).port,
    ],
    [9000, 8724],
    'TI Fernsteuerung-Abschnitt: Port aus der Meldung, ohne gültigen Port STEUER_PORT',
  );
}

// ── TI Statusleiste vor erster Antwort (Spec 7.2): nichts gemessen → jeder Eintrag off „unbekannt“, nie ok ──
{
  const leer = statusLeiste(stand());
  gleich(
    leer.map((i) => `${i.id}:${i.state}:${i.detail}`),
    ['master-link:off:unbekannt', 'sync:off:unbekannt', 'speaker:off:unbekannt', 'fernsteuerung:off:unbekannt'],
    'TI Statusleiste vor erster Antwort: alle vier Einträge off unbekannt',
  );
  const mitNull = statusLeiste(stand({ masterLink: null, fernsteuerung: null }));
  gleich(mitNull.map((i) => i.state), ['off', 'off', 'off', 'off'], 'TI Statusleiste vor erster Antwort: null (keine Brücke) ist ebenfalls unbekannt');
}

// ── TI Statusleiste gesamt ──
{
  const MASTER: Record<string, MasterLinkMeldungZeile | null | undefined> = {
    offen: undefined,
    verbunden: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1, masterName: 'Regie-PC', suite: 'JM Production Suite' },
    fehler: { art: 'fehler', code: 'verweigert', text: 'Master antwortet nicht.' },
  };
  const FERN: Record<string, FernsteuerungMeldung | undefined> = {
    keine: undefined,
    belegt: { laeuft: false, port: 8724, clients: 0, fehler: BELEGT },
    bereit: basisMeldung({ clients: 2 }),
  };
  const faelle = kreuz({
    master: ['offen', 'verbunden', 'fehler'],
    connected: [undefined, true, false],
    speaker: [undefined, true, false],
    fern: ['keine', 'belegt', 'bereit'],
  } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    stand({ masterLink: MASTER[f.master], connected: f.connected, speakerOffen: f.speaker, fernsteuerung: FERN[f.fern] });
  const IDS = ['master-link', 'sync', 'speaker', 'fernsteuerung'];
  pruefeFaelle('TI Statusleiste gesamt: Reihenfolge master-link, sync, speaker, fernsteuerung, ids eindeutig, schon nach Gruppen geordnet', faelle, (f) => {
    const leiste = statusLeiste(props(f));
    const ids = leiste.map((i) => i.id).join();
    return vergleiche(ids, IDS.join()) ?? (new Set(leiste.map((i) => i.id)).size !== leiste.length ? 'ids doppelt' : null) ?? vergleiche(ordneStatus(leiste).map((i) => i.id).join(), ids);
  });
  pruefeFaelle('TI Statusleiste gesamt: nie live (der Timer hat keine On-Air-Quelle)', faelle, (f) => (statusLeiste(props(f)).some((i) => i.state === 'live') ? 'live' : null));
  pruefeFaelle('TI Statusleiste gesamt: jede settingsSection ist ein Abschnitt aus ABSCHNITT', faelle, (f) => {
    const falsch = statusLeiste(props(f)).filter((i) => i.settingsSection !== undefined && !(Object.values(ABSCHNITT) as string[]).includes(i.settingsSection));
    return falsch.length === 0 ? null : `falsch: ${falsch.map((i) => i.id).join()}`;
  });
  gleich(
    statusLeiste(stand()).map((i) => `${i.group}:${i.label}`),
    ['verbindung:Master', 'verbindung:Sync', 'ausgabe:Speaker-Fenster', 'fernsteuerung:Fernsteuerung'],
    'TI Statusleiste: Gruppen und Labels',
  );
}

// ── V-Zeile in der Kopfmitte ──
{
  const FARBEN: Array<[VerbundAnzeigeZeile['farbe'], string]> = [['gruen', 'ok'], ['gelb', 'warn'], ['rot', 'error'], ['gedaempft', 'off']];
  gleich(FARBEN.map(([f]) => verbundZeileZustand(f)), FARBEN.map(([, z]) => z), 'TI V-Zeile: gruen ok, gelb warn, rot error, gedaempft off');
  gleich(verbundZeileZustand('lila' as unknown as VerbundAnzeigeZeile['farbe']), 'off', 'TI V-Zeile: unbekannte Farbe ist off, nie ok und nie live');
}

// ── TI Haupttasten ──
{
  const punkte = (n: number): TimetableItem[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, label: `Punkt ${i + 1}`, durationMs: 60_000 }));
  const faelle = kreuz({
    mode: ['clock', 'countdown', 'timetable', 'remote', 'settings'],
    lauf: ['idle', 'running', 'paused'],
    delayMs: [0, 5_000],
    anzahl: [0, 1, 3],
    aktiv: [null, 0, 1, 2],
  } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand => {
    const cd = {
      durationMs: 60_000,
      delayMs: f.delayMs,
      startedAtMs: f.lauf === 'running' ? 1_000 : null,
      pausedRemainingMs: f.lauf === 'paused' ? 30_000 : null,
    };
    return stand({ timer: { ...INITIAL_STATE, countdown: cd, timetable: { ...INITIAL_STATE.timetable, items: punkte(f.anzahl), activeIndex: f.aktiv } } });
  };
  const kurz = (t: TasteZustand | undefined): string => (t === undefined ? '–' : `${t.state}:${t.disabledReason ?? ''}`);
  pruefeFaelle('TI Haupttasten: Uhr, Remote und Farben haben keine; Countdown nur Start und Reset, Ablauf zusätzlich Prev und Next', faelle, (f) => {
    const h = hauptTasten(props(f), f.mode);
    if (f.mode !== 'countdown' && f.mode !== 'timetable') return h === null ? null : 'Haupttasten ohne Modus';
    if (h === null) return 'keine Haupttasten';
    return f.mode === 'countdown' ? (h.prev !== undefined || h.next !== undefined ? 'Prev/Next im Countdown' : null) : h.prev === undefined || h.next === undefined ? 'Prev/Next fehlen im Ablauf' : null;
  });
  pruefeFaelle('TI Haupttasten Start/Pause: Beschriftung Start, Resume, Pause wie bisher, nie gesperrt, nie live', faelle, (f) => {
    const h = hauptTasten(props(f), f.mode);
    if (h === null) return null;
    const soll = f.lauf === 'running' ? 'Pause' : f.lauf === 'paused' ? 'Resume' : 'Start';
    return vergleiche(`${h.start.label}/${h.start.state}`, `${soll}/bereit`);
  });
  pruefeFaelle('TI Haupttasten Reset: gesperrt mit Grund nur im Leerlauf ohne Delay', faelle, (f) => {
    const h = hauptTasten(props(f), f.mode);
    if (h === null) return null;
    const leer = f.lauf === 'idle' && f.delayMs === 0;
    return vergleiche(kurz(h.reset), leer ? `gesperrt:${TIMER_TEXTE.grund.nichtsZuruecksetzen}` : 'bereit:');
  });
  pruefeFaelle('TI Haupttasten Prev/Next: an den Rändern gesperrt mit Grund, ohne Punkte beide gesperrt', faelle, (f) => {
    if (f.mode !== 'timetable') return null;
    const h = hauptTasten(props(f), f.mode);
    if (h === null) return 'keine Haupttasten';
    const i = f.aktiv ?? 0;
    const G = TIMER_TEXTE.grund;
    const prev = f.anzahl === 0 ? `gesperrt:${G.keinePunkte}` : i <= 0 ? `gesperrt:${G.ersterPunkt}` : 'bereit:';
    const next = f.anzahl === 0 ? `gesperrt:${G.keinePunkte}` : i >= f.anzahl - 1 ? `gesperrt:${G.letzterPunkt}` : 'bereit:';
    return vergleiche(`${kurz(h.prev)}|${kurz(h.next)}`, `${prev}|${next}`);
  });
  pruefeFaelle('TI Haupttasten: jede gesperrte Taste hat einen nicht leeren Grund, kein live', faelle, (f) => {
    const h = hauptTasten(props(f), f.mode);
    if (h === null) return null;
    const alle = [h.start, h.reset, h.prev, h.next].filter((t): t is NonNullable<typeof t> => t !== undefined);
    return alle.some((t) => t.state === 'live' || (t.state === 'gesperrt' && !t.disabledReason?.trim())) ? 'live oder gesperrt ohne Grund' : null;
  });
  pruefeFaelle('TI Haupttasten Kürzel: nur im Countdown Leertaste und R (die Tasten gelten nur dort), im Ablauf keine', faelle, (f) => {
    const h = hauptTasten(props(f), f.mode);
    if (h === null) return null;
    const soll = f.mode === 'countdown' ? 'Leertaste/R' : 'undefined/undefined';
    return vergleiche(`${h.start.shortcut}/${h.reset.shortcut}`, soll) ?? (h.prev?.shortcut !== undefined || h.next?.shortcut !== undefined ? 'Kürzel an Prev/Next' : null);
  });
}

// ── TI Kürzel aus Panel-Feld (Befund: der Handler nahm nur INPUT und TEXTAREA aus) ──
{
  const ziel = (t: object): EventTarget => t as unknown as EventTarget;
  const faelle: Array<{ name: string; z: EventTarget | null; soll: boolean }> = [
    { name: 'input', z: ziel({ tagName: 'INPUT' }), soll: true },
    { name: 'textarea', z: ziel({ tagName: 'TEXTAREA' }), soll: true },
    { name: 'select', z: ziel({ tagName: 'SELECT' }), soll: true },
    { name: 'Kleinschreibung select', z: ziel({ tagName: 'select' }), soll: true },
    { name: 'contentEditable', z: ziel({ tagName: 'DIV', isContentEditable: true }), soll: true },
    { name: 'div', z: ziel({ tagName: 'DIV', isContentEditable: false }), soll: false },
    { name: 'button', z: ziel({ tagName: 'BUTTON' }), soll: false },
    { name: 'ohne tagName', z: ziel({}), soll: false },
    { name: 'null', z: null, soll: false },
  ];
  pruefeFaelle('TI Kürzel aus Panel-Feld: istEingabeZiel ist true für input, textarea, select und contentEditable, false für button und null', faelle, (f) =>
    vergleiche(String(istEingabeZiel(f.z)), String(f.soll)),
  );
  const code = leseText('src/renderer/src/components/Countdown.tsx');
  ok(
    /from '@\/lib\/oberflaeche'/.test(code) && /istEingabeZiel\(\s*e\.target\s*\)/.test(code) && !/tagName\s*===\s*'(INPUT|TEXTAREA)'/.test(code),
    'TI Kürzel aus Panel-Feld: Countdown.tsx filtert den Tastenhandler über istEingabeZiel, ohne eigene INPUT/TEXTAREA-Prüfung',
  );
  ok(/e\.code === 'Space'/.test(code) && /e\.code === 'KeyR'/.test(code) && !/e\.(ctrlKey|metaKey|altKey|shiftKey)/.test(code), 'TI Kürzel: Leertaste und R wie bisher, Modifikatoren bleiben ohne Wirkung (U6)');
}

// ── Texte und Quelltext ──
{
  const flach = (v: unknown): string[] => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(flach) : []);
  const texte = flach(TIMER_TEXTE);
  ok(texte.length > 0 && texte.every((t) => !t.includes('"')), 'TI Texte ohne ASCII-Anführungszeichen');
  // Texte aus @jm/settings (*_TEXTE) und @jm/ui (MASTER_LINK_TEXTE) werden nie nachgebaut: Wertegleichheit ist ein Nachbau.
  const fremd = new Set([...Object.entries(settings).filter(([k]) => k.endsWith('_TEXTE')).map(([, v]) => v), MASTER_LINK_TEXTE].flatMap(flach));
  const nachgebaut = texte.filter((t) => fremd.has(t));
  ok(fremd.size > 0 && nachgebaut.length === 0, `TI Texte nicht nachgebaut: kein TIMER_TEXTE-Wert gleicht einem Text aus @jm/settings oder @jm/ui${nachgebaut.length ? ` (${nachgebaut.join(' | ')})` : ''}`);
  gleich(
    [TIMER_TEXTE.start, TIMER_TEXTE.resume, TIMER_TEXTE.pause, TIMER_TEXTE.reset, TIMER_TEXTE.zurueck, TIMER_TEXTE.weiter],
    ['Start', 'Resume', 'Pause', 'Reset', '← Prev', 'Next →'],
    'TI Texte: Beschriftungen der Haupttasten wörtlich wie bisher',
  );
  gleich(Object.values(ABSCHNITT), ['fernsteuerung', 'speaker', 'lan', 'farben'], 'TI Abschnitts-ids');
  const code = leseText('src/renderer/src/lib/oberflaeche.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!/\bwindow\b|\blocalStorage\b|\bipcRenderer\b|\bdocument\b|from ['"]electron['"]/.test(code), 'TI oberflaeche rein: lib/oberflaeche.ts ohne window, document, localStorage, IPC und Electron');
}

// UX Welle 2a · Prompter-Ableitungen (Aufgabe c; E3 Ausgabezustand, E4 ON AIR, E11 Handy, Spec 7.2): Statusleiste als
// Kreuzprodukt je Eintrag, Haupttasten, ON AIR, Kürzelschutz, Texte. Ohne window und ohne Electron.
import * as settings from '@jm/settings';
import { ABSCHNITT_TEXTE } from '@jm/settings';
import { MASTER_LINK_TEXTE, ordneStatus, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { AusgabeArt, AusgabeZustand } from '@jm/output-window/zustand';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import { DEFAULT_CONFIG, type MasterLinkMeldungZeile, type PrompterState } from '@shared/types';
import {
  ABSCHNITT,
  ausgabeAbschnitt,
  fernsteuerungAbschnitt,
  hauptTasten,
  istEingabeZiel,
  kopfOnAir,
  PROMPTER_TEXTE,
  statusLeiste,
  type OberflaechenStand,
} from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { basisMeldung, ohneKommentare } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8727';
const ARTEN: AusgabeArt[] = ['zu', 'offen', 'bildschirm-fehlt', 'abgestuerzt'];

function zustand(teil: { playing?: boolean; remoteEnabled?: boolean; running?: boolean; urls?: string[]; speed?: number; display?: number | null } = {}): PrompterState {
  return {
    config: { ...DEFAULT_CONFIG, speed: teil.speed ?? DEFAULT_CONFIG.speed, remoteEnabled: teil.remoteEnabled ?? false, outputDisplayId: teil.display ?? null },
    transport: { playing: teil.playing ?? false, anchorEm: 0, anchorAtMs: 0, emPerSec: 1 },
    remote: { running: teil.running ?? false, urls: teil.urls ?? [] },
  };
}
function stand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { prompter: undefined, ausgabe: undefined, masterLink: undefined, fernsteuerung: undefined, ...teil };
}
const eintrag = (s: OberflaechenStand, id: string): StatusItem => statusLeiste(s).find((i) => i.id === id) as StatusItem;
const sd = (i: StatusItem): string => `${i.state} ${i.detail ?? ''}`;
const art = (a: AusgabeArt | null | undefined, displayId: number | null = 1): AusgabeZustand | null | undefined => (a === undefined || a === null ? a : { art: a, displayId });

// ── PR Statusleiste master-link ──
{
  const faelle: Array<{ name: string; m: MasterLinkMeldungZeile | null | undefined; soll: string }> = [
    { name: 'undefined', m: undefined, soll: 'off unbekannt' },
    { name: 'null', m: null, soll: 'off unbekannt' },
    { name: 'aus', m: { art: 'aus' }, soll: 'off aus' },
    { name: 'sucht', m: { art: 'sucht' }, soll: 'warn sucht …' },
    { name: 'verbunden', m: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1, masterName: 'Regie-PC', suite: 'JM Production Suite' }, soll: 'ok verbunden mit Regie-PC' },
  ];
  pruefeFaelle('PR Statusleiste master-link: Meldung → Zustand und Detail, Gruppe verbindung, ohne Abschnitt', faelle, (f) => {
    const i = eintrag(stand({ masterLink: f.m }), 'master-link');
    return vergleiche(sd(i), f.soll) ?? (i.group !== 'verbindung' || i.settingsSection !== undefined ? 'Kopf falsch' : null);
  });
}

// ── PR Statusleiste talent-monitor (E3): Art × Anzeigeliste, vor der ersten Antwort unbekannt ──
{
  const ausgaben: Record<string, AusgabeZustand | null | undefined> = {
    undefined: undefined,
    null: null,
    zu: { art: 'zu', displayId: null },
    offen: { art: 'offen', displayId: 2 },
    fehlt: { art: 'bildschirm-fehlt', displayId: 2 },
    abgestuerzt: { art: 'abgestuerzt', displayId: 2 },
  };
  const SOLL: Record<string, string> = {
    undefined: 'off unbekannt',
    null: 'off unbekannt',
    zu: 'off zu',
    offen: 'ok offen',
    fehlt: 'warn Bildschirm fehlt',
    abgestuerzt: 'error abgestürzt',
  };
  const faelle = kreuz({ a: ['undefined', 'null', 'zu', 'offen', 'fehlt', 'abgestuerzt'], liste: ['ohne', 'mit', 'fremd'] } as const);
  pruefeFaelle('PR Statusleiste talent-monitor: unbekannt, zu, offen (· Bildschirm nur mit Liste), Bildschirm fehlt, abgestürzt', faelle, (f) => {
    const bildschirme = f.liste === 'ohne' ? undefined : f.liste === 'mit' ? [{ id: 2, label: 'Talent-TV', primary: false }] : [{ id: 7, label: 'Anderer', primary: true }];
    const i = eintrag(stand({ ausgabe: ausgaben[f.a], bildschirme }), 'talent-monitor');
    const soll = f.a === 'offen' && f.liste === 'mit' ? 'ok offen · Talent-TV' : SOLL[f.a];
    return vergleiche(sd(i), soll) ?? (i.group !== 'ausgabe' || i.settingsSection !== ABSCHNITT.ausgabe ? 'Kopf falsch' : null);
  });
}

// ── PR Statusleiste fernsteuerung: Meldung × Modus ──
{
  const MELDUNG: Record<string, FernsteuerungMeldung | null | undefined> = {
    undefined: undefined,
    null: null,
    aus: { laeuft: false, port: 8727, clients: 0 },
    belegt: { laeuft: false, port: 8727, clients: 0, fehler: BELEGT },
    fehler: { laeuft: false, port: 8727, clients: 0, fehler: 'listen EACCES: permission denied 0.0.0.0:8727' },
    bereit0: basisMeldung({ clients: 0 }),
    bereit3: basisMeldung({ clients: 3 }),
  };
  const SOLL: Record<string, string> = {
    undefined: 'off unbekannt',
    null: 'off unbekannt',
    aus: 'off aus',
    belegt: 'error Port belegt',
    fehler: 'error Fehler: listen EACCES: permission denied 0.0.0.0:8727',
    bereit0: 'ok bereit · 0 verbunden',
    bereit3: 'ok bereit · 3 verbunden',
  };
  const faelle = kreuz({ meldung: Object.keys(MELDUNG), modus: [undefined, 'open', 'secure'] } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand => {
    const m = MELDUNG[f.meldung];
    return stand({ fernsteuerung: m ? { ...m, modus: f.modus } : m });
  };
  pruefeFaelle('PR Statusleiste fernsteuerung: Meldung × Modus → unbekannt, aus, Port belegt, Fehler, bereit n verbunden', faelle, (f) => {
    const i = eintrag(props(f), 'fernsteuerung');
    return vergleiche(sd(i), SOLL[f.meldung]) ?? (i.group !== 'fernsteuerung' || i.settingsSection !== ABSCHNITT.fernsteuerung ? 'Kopf falsch' : null);
  });
  gleich(
    [
      fernsteuerungAbschnitt(stand({ fernsteuerung: { laeuft: true, port: 9000, clients: 1 } })).port,
      fernsteuerungAbschnitt(stand({ fernsteuerung: { laeuft: false, port: 0, clients: 0 } })).port,
      fernsteuerungAbschnitt(stand()).port,
    ],
    [9000, 8727, 8727],
    'PR Fernsteuerung-Abschnitt: Port aus der Meldung, sonst 8727',
  );
}

// ── PR Statusleiste handy (E11): remoteEnabled × running × urls, vor der Antwort unbekannt ──
{
  const faelle = kreuz({ prompter: ['undefined', 'da'], an: [false, true], laeuft: [false, true], urls: [0, 1, 2] } as const);
  pruefeFaelle('PR Statusleiste handy: aus, läuft mit Adresszahl, nicht gestartet (ohne Grund), vor der Antwort unbekannt', faelle, (f) => {
    const p = f.prompter === 'undefined' ? undefined : zustand({ remoteEnabled: f.an, running: f.laeuft, urls: Array.from({ length: f.urls }, (_, i) => `http://10.0.0.${i + 1}:8727`) });
    const i = eintrag(stand({ prompter: p }), 'handy');
    const soll = p === undefined ? 'off unbekannt' : !f.an ? `off ${ABSCHNITT_TEXTE.aus}` : f.laeuft ? (f.urls === 0 ? `warn ${PROMPTER_TEXTE.handy.keineAdresse}` : `ok ${PROMPTER_TEXTE.handy.adressen(f.urls)}`) : `warn ${PROMPTER_TEXTE.handy.nichtGestartet}`;
    return vergleiche(sd(i), soll) ?? (i.group !== 'fernsteuerung' || i.settingsSection !== ABSCHNITT.handy ? 'Kopf falsch' : null);
  });
  gleich([PROMPTER_TEXTE.handy.adressen(1), PROMPTER_TEXTE.handy.adressen(2)], ['1 Adresse', '2 Adressen'], 'PR Statusleiste handy: Adresszahl im Singular und Plural');
}

// ── PR Statusleiste tempo: Wert wie die Oberfläche ihn zeigt ──
{
  const faelle = kreuz({ prompter: ['undefined', 'da'], speed: [0.2, 1.6, 3, 6] } as const);
  pruefeFaelle('PR Statusleiste tempo: Gruppe tool, Wert mit einer Stelle und Einheit, ohne Zustand unbekannt', faelle, (f) => {
    const p = f.prompter === 'undefined' ? undefined : zustand({ speed: f.speed });
    const i = eintrag(stand({ prompter: p }), 'tempo');
    const soll = p === undefined ? 'off unbekannt' : `ok ${f.speed.toFixed(1)} Z/s`;
    return vergleiche(sd(i), soll) ?? (i.group !== 'tool' ? 'Gruppe falsch' : null);
  });
}

// ── PR Statusleiste vor erster Antwort (Spec 7.2): nichts gemessen → jeder Eintrag off unbekannt, nie ok ──
{
  gleich(
    statusLeiste(stand()).map((i) => `${i.id}:${i.state}:${i.detail}`),
    ['master-link:off:unbekannt', 'talent-monitor:off:unbekannt', 'fernsteuerung:off:unbekannt', 'handy:off:unbekannt', 'tempo:off:unbekannt'],
    'PR Statusleiste vor erster Antwort: alle fünf Einträge off unbekannt',
  );
  gleich(
    statusLeiste(stand({ masterLink: null, ausgabe: null, fernsteuerung: null })).map((i) => i.state),
    ['off', 'off', 'off', 'off', 'off'],
    'PR Statusleiste vor erster Antwort: null (keine Brücke) ist ebenfalls unbekannt',
  );
}

// ── PR Statusleiste gesamt ──
{
  const faelle = kreuz({
    master: [undefined, { art: 'sucht' }] as Array<MasterLinkMeldungZeile | undefined>,
    ausgabe: [undefined, null, ...ARTEN] as Array<AusgabeArt | null | undefined>,
    fern: [undefined, basisMeldung({ clients: 2 })],
    prompter: [undefined, zustand({ remoteEnabled: true, running: true, urls: ['u'] })],
  } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand => stand({ masterLink: f.master, ausgabe: art(f.ausgabe), fernsteuerung: f.fern, prompter: f.prompter });
  const IDS = ['master-link', 'talent-monitor', 'fernsteuerung', 'handy', 'tempo'];
  pruefeFaelle('PR Statusleiste gesamt: Reihenfolge, ids eindeutig, schon nach Gruppen geordnet', faelle, (f) => {
    const leiste = statusLeiste(props(f));
    const ids = leiste.map((i) => i.id).join();
    return vergleiche(ids, IDS.join()) ?? (new Set(leiste.map((i) => i.id)).size !== leiste.length ? 'ids doppelt' : null) ?? vergleiche(ordneStatus(leiste).map((i) => i.id).join(), ids);
  });
  pruefeFaelle('PR Statusleiste gesamt: die Leiste zeigt nie live (ON AIR sitzt im Kopf)', faelle, (f) => (statusLeiste(props(f)).some((i) => i.state === 'live') ? 'live' : null));
  pruefeFaelle('PR Statusleiste gesamt: jede settingsSection ist ein Abschnitt aus ABSCHNITT', faelle, (f) => {
    const falsch = statusLeiste(props(f)).filter((i) => i.settingsSection !== undefined && !(Object.values(ABSCHNITT) as string[]).includes(i.settingsSection));
    return falsch.length === 0 ? null : `falsch: ${falsch.map((i) => i.id).join()}`;
  });
  pruefeFaelle('PR Statusleiste gesamt: ohne Brückenantwort ist talent-monitor nie ok', faelle, (f) => {
    const i = eintrag(props(f), 'talent-monitor');
    return (f.ausgabe === undefined || f.ausgabe === null) && i.state !== 'off' ? `state ${i.state}` : null;
  });
  gleich(Object.values(ABSCHNITT), ['ausgabe', 'fernsteuerung', 'schrift', 'leselinie', 'darstellung', 'handy'], 'PR Abschnitts-ids');
}

// ── PR Ausgabe-Abschnitt: Zustand → Props des Panels ──
{
  const faelle = kreuz({ ausgabe: [undefined, null, ...ARTEN] as Array<AusgabeArt | null | undefined>, display: [null, 2] } as const);
  pruefeFaelle('PR Ausgabe-Abschnitt: enabled = Monitor soll offen sein, selectedId aus der Einstellung, kein Vollbild, kein Hintergrund', faelle, (f) => {
    const a = art(f.ausgabe, 2);
    const p = ausgabeAbschnitt(stand({ prompter: zustand({ display: f.display }), ausgabe: a }));
    const an = a !== undefined && a !== null && a.art !== 'zu';
    const open = a === undefined || a === null ? undefined : a.art === 'offen' || a.art === 'bildschirm-fehlt';
    return vergleiche(
      `${p.id}/${p.enabled}/${p.windowOpen}/${p.selectedId}/${p.capabilities.toggle}/${p.capabilities.fullscreen}/${p.capabilities.background}`,
      `${ABSCHNITT.ausgabe}/${an}/${open}/${f.display}/true/false/false`,
    );
  });
}

// ── PR ON AIR nur mit offenem Monitor (E4): scrolling × AusgabeArt × undefined, Kopf und GO gleich ──
{
  const faelle = kreuz({ playing: [false, true], art: [undefined, null, ...ARTEN] as Array<AusgabeArt | null | undefined>, prompter: ['da', 'undefined'] } as const);
  pruefeFaelle('PR ON AIR nur mit offenem Monitor: live nur bei scrolling und art offen, für Kopf und GO-Taste gleich', faelle, (f) => {
    const s = stand({ prompter: f.prompter === 'da' ? zustand({ playing: f.playing }) : undefined, ausgabe: art(f.art) });
    const soll = f.prompter === 'da' && f.playing && f.art === 'offen';
    const kopf = kopfOnAir(s);
    const go = hauptTasten(s).go.state === 'live';
    return vergleiche(`${kopf.live}/${go}/${'label' in kopf}`, `${soll}/${soll}/false`);
  });
}

// ── PR Haupttasten ──
{
  const faelle = kreuz({ playing: [false, true], art: [undefined, ...ARTEN] as Array<AusgabeArt | undefined> } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand => stand({ prompter: zustand({ playing: f.playing }), ausgabe: art(f.art) });
  pruefeFaelle('PR Haupttasten: vier Tasten, GO wechselt zu Pause, Kürzel Leertaste und Pos1, Marken ohne Kürzel', faelle, (f) => {
    const h = hauptTasten(props(f));
    return vergleiche(
      [h.go.label, h.go.shortcut, h.anfang.label, h.anfang.shortcut, h.markeZurueck.label, h.markeZurueck.shortcut, h.markeVor.label, h.markeVor.shortcut].join('|'),
      [f.playing ? PROMPTER_TEXTE.pause : PROMPTER_TEXTE.go, 'Leertaste', PROMPTER_TEXTE.anfang, 'Pos1', PROMPTER_TEXTE.markeZurueck, undefined, PROMPTER_TEXTE.markeVor, undefined].join('|'),
    );
  });
  pruefeFaelle('PR Haupttasten: heute ist keine Taste gesperrt; eine gesperrte hätte einen Grund; nur GO kann live sein', faelle, (f) => {
    const h = hauptTasten(props(f));
    const alle = [h.go, h.anfang, h.markeZurueck, h.markeVor];
    if (alle.some((t) => t.state === 'gesperrt' && !t.disabledReason?.trim())) return 'gesperrt ohne Grund';
    if (alle.some((t) => t.state === 'gesperrt')) return 'gesperrt, aber heute nie gesperrt';
    return [h.anfang, h.markeZurueck, h.markeVor].some((t) => t.state === 'live') ? 'live an Nicht-GO' : null;
  });
  const leer = hauptTasten(stand());
  gleich([leer.go.state, leer.go.label], ['bereit', 'GO'], 'PR Haupttasten: ohne Zustand ist GO bereit, nie live');
}

// ── PR Kürzel aus Panel-Feld ──
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
  pruefeFaelle('PR Kürzel aus Panel-Feld: istEingabeZiel ist true für input, textarea, select und contentEditable, false für button und null', faelle, (f) =>
    vergleiche(String(istEingabeZiel(f.z)), String(f.soll)),
  );
  const code = ohneKommentare(leseText('src/renderer/src/lib/useHotkeys.ts'));
  ok(
    /from '@\/lib\/oberflaeche'/.test(code) && /istEingabeZiel\(\s*e\.target\s*\)/.test(code) && !/tagName\s*===\s*'(INPUT|TEXTAREA)'/.test(code),
    'PR Kürzel aus Panel-Feld: useHotkeys.ts filtert über istEingabeZiel, ohne eigene INPUT/TEXTAREA-Prüfung',
  );
  ok(
    ["case ' '", "case 'ArrowDown'", "case 'ArrowUp'", "case 'Home'", 'transport.toggle()', 'transport.nudge(e.shiftKey ? 3 : 1)', 'transport.nudge(e.shiftKey ? -3 : -1)', 'transport.reset()'].every((t) => code.includes(t)),
    'PR Kürzel: Leertaste, Pfeile (Umschalt ±3) und Pos1 wirken wie bisher',
  );
}

// ── Texte und Quelltext ──
{
  const aufruf = (fn: (n: number) => unknown): string[] => {
    try {
      return flach(fn(2));
    } catch {
      return [];
    }
  };
  const flach = (v: unknown): string[] => (typeof v === 'function' ? aufruf(v as (n: number) => unknown) : typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(flach) : []);
  const texte = flach(PROMPTER_TEXTE);
  ok(texte.length > 0 && texte.every((t) => !t.includes('"')), 'PR Texte ohne ASCII-Anführungszeichen');
  // R5: Texte aus @jm/settings (*_TEXTE, STATUS_UNBEKANNT) und @jm/ui (MASTER_LINK_TEXTE) werden nie nachgebaut.
  const fremd = new Set([...Object.entries(settings).filter(([k]) => k.endsWith('_TEXTE')).map(([, v]) => v), MASTER_LINK_TEXTE, settings.STATUS_UNBEKANNT].flatMap(flach));
  // Bewusste Ausnahmen (R7): gleiches Wort, andere Bedeutung. „offen“ = Fenster offen (nicht Modus offen der Fernsteuerung);
  // „nicht gestartet“ = Handy-Server (E11-Wortlaut), nicht der Master-Link-Client.
  const AUSNAHMEN = new Set<string>([PROMPTER_TEXTE.ausgabe.offen, PROMPTER_TEXTE.handy.nichtGestartet]);
  const nachgebaut = texte.filter((t) => fremd.has(t) && !AUSNAHMEN.has(t));
  ok(fremd.size > 0 && nachgebaut.length === 0, `PR Texte nicht nachgebaut: kein PROMPTER_TEXTE-Wert gleicht einem Text aus @jm/settings oder @jm/ui${nachgebaut.length ? ` (${nachgebaut.join(' | ')})` : ''}`);
  const code = ohneKommentare(leseText('src/renderer/src/lib/oberflaeche.ts'));
  ok(!/(?<![\w-])window\b|\blocalStorage\b|\bipcRenderer\b|\bdocument\b|from ['"]electron['"]/.test(code), 'PR oberflaeche rein: lib/oberflaeche.ts ohne window, document, localStorage, IPC und Electron');
}

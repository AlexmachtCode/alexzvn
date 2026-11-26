// UX Welle 2a · Stage-Display-Ableitungen (Aufgabe c; E3 Ausgabezustand, E4 kein ON AIR, E12 Quellen ohne Auto, Spec 7.2):
// Statusleiste als Kreuzprodukt je Eintrag, Bühnenschirm-Taste, Quellen-Abschnitt, Texte, Reinheit. Ohne window und Electron.
import * as settings from '@jm/settings';
import { ABSCHNITT_TEXTE, PEERS_TEXTE, peersView } from '@jm/settings';
import { MASTER_LINK_TEXTE, ordneStatus, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { AusgabeArt, AusgabeZustand } from '@jm/output-window/zustand';
import type { MasterLinkMeldungZeile, StageConfig, StageState } from '@shared/types';
import {
  ABSCHNITT,
  ausgabeAbschnitt,
  buehnenschirmTaste,
  quellenAbschnitt,
  STAGE_TEXTE,
  statusLeiste,
  type OberflaechenStand,
} from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { ohneKommentare } from './testzustand';

const ARTEN: AusgabeArt[] = ['zu', 'offen', 'bildschirm-fehlt', 'abgestuerzt'];

function zustand(
  teil: {
    message?: string;
    widgetMessage?: boolean;
    widgetTimer?: boolean;
    timerMessage?: string;
    display?: number | null;
    an?: [boolean, boolean, boolean];
    verbunden?: [boolean, boolean, boolean];
    /** Host aller drei Quellen (Altfehler SD-3); Standard die Vorgabe 127.0.0.1. */
    host?: string;
  } = {},
): StageState {
  const an = teil.an ?? [false, false, false];
  const v = teil.verbunden ?? [false, false, false];
  const host = teil.host ?? '127.0.0.1';
  const config: StageConfig = {
    timer: { enabled: an[0], host, port: 7777 },
    switcher: { enabled: an[1], host, port: 8723 },
    presenter: { enabled: an[2], host, port: 7330, pin: '', mode: 'ref' },
    widgets: { clock: true, timer: teil.widgetTimer ?? false, switcher: true, message: teil.widgetMessage ?? true, presenter: true },
    message: teil.message ?? '',
    outputDisplayId: teil.display ?? null,
  };
  return {
    config,
    timer: {
      connected: v[0],
      countdown: null,
      activeLabel: null,
      nextLabel: null,
      colors: { normal: '#fff', warning: '#fff', overtime: '#fff', warningAtSec: 60 },
      message: teil.timerMessage ?? '',
      blinking: false,
    },
    switcher: { connected: v[1], program: 0, preview: 0, recording: false, streaming: false, scenes: 0 },
    presenter: { connected: v[2], active: false, index: 0, total: 0, title: '', notes: '', nextTitle: null, screen: 'live', rev: 0 },
  };
}
function stand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { stage: undefined, ausgabe: undefined, masterLink: undefined, ...teil };
}
const eintrag = (s: OberflaechenStand, id: string): StatusItem => statusLeiste(s).find((i) => i.id === id) as StatusItem;
const sd = (i: StatusItem): string => `${i.state} ${i.detail ?? ''}`;
const art = (a: AusgabeArt | null | undefined, displayId: number | null = 1): AusgabeZustand | null | undefined => (a === undefined || a === null ? a : { art: a, displayId });

// ── SD Statusleiste master-link ──
{
  const faelle: Array<{ name: string; m: MasterLinkMeldungZeile | null | undefined; soll: string }> = [
    { name: 'undefined', m: undefined, soll: 'off unbekannt' },
    { name: 'null', m: null, soll: 'off unbekannt' },
    { name: 'aus', m: { art: 'aus' }, soll: 'off aus' },
    { name: 'sucht', m: { art: 'sucht' }, soll: 'warn sucht …' },
    { name: 'verbunden', m: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1, masterName: 'Regie-PC', suite: 'JM Production Suite' }, soll: 'ok verbunden mit Regie-PC' },
  ];
  pruefeFaelle('SD Statusleiste master-link: Meldung → Zustand und Detail, Gruppe verbindung, ohne Abschnitt', faelle, (f) => {
    const i = eintrag(stand({ masterLink: f.m }), 'master-link');
    return vergleiche(sd(i), f.soll) ?? (i.group !== 'verbindung' || i.settingsSection !== undefined ? 'Kopf falsch' : null);
  });
}

// ── SD Statusleiste buehnenschirm (E3): Art × Anzeigeliste, vor der ersten Antwort unbekannt ──
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
  pruefeFaelle('SD Statusleiste buehnenschirm: unbekannt, zu, offen (· Bildschirm nur mit Liste), Bildschirm fehlt, abgestürzt', faelle, (f) => {
    const bildschirme = f.liste === 'ohne' ? undefined : f.liste === 'mit' ? [{ id: 2, label: 'Bühnen-TV', primary: false }] : [{ id: 7, label: 'Anderer', primary: true }];
    const i = eintrag(stand({ ausgabe: ausgaben[f.a], bildschirme }), 'buehnenschirm');
    const soll = f.a === 'offen' && f.liste === 'mit' ? 'ok offen · Bühnen-TV' : SOLL[f.a];
    return vergleiche(sd(i), soll) ?? (i.group !== 'ausgabe' || i.settingsSection !== ABSCHNITT.ausgabe ? 'Kopf falsch' : null);
  });
}

// ── SD Statusleiste quelle-<rolle>: Zustand geladen × an × verbunden × Host (Altfehler SD-3: Vorgabe oder eingerichtet);
// SD Quellen nur wenn an ──
{
  const ROLLEN = [
    { id: 'quelle-timer', idx: 0 },
    { id: 'quelle-switcher', idx: 1 },
    { id: 'quelle-presenter', idx: 2 },
  ] as const;
  for (const r of ROLLEN) {
    const faelle = kreuz({ geladen: [false, true], an: [false, true], verbunden: [false, true], host: ['127.0.0.1', '', '  ', '10.0.0.4'] } as const);
    pruefeFaelle(`SD Statusleiste ${r.id}: unbekannt, aus, verbunden, nicht gefunden bei der Vorgabe oder leerem Host (R6), nicht erreichbar bei eingerichtetem Host (warn, nie error)`, faelle, (f) => {
      const an: [boolean, boolean, boolean] = [false, false, false];
      const v: [boolean, boolean, boolean] = [false, false, false];
      an[r.idx] = f.an;
      v[r.idx] = f.verbunden;
      const i = eintrag(stand({ stage: f.geladen ? zustand({ an, verbunden: v, host: f.host }) : undefined }), r.id);
      const warn = f.host === '10.0.0.4' ? 'nicht erreichbar' : 'nicht gefunden';
      const soll = !f.geladen ? 'off unbekannt' : !f.an ? `off ${ABSCHNITT_TEXTE.aus}` : f.verbunden ? `ok ${PEERS_TEXTE.zeileVerbunden}` : `warn ${warn}`;
      return vergleiche(sd(i), soll) ?? (i.group !== 'verbindung' || i.settingsSection !== ABSCHNITT.quellen ? 'Kopf falsch' : i.state === 'error' ? 'error' : null);
    });
  }
  gleich(
    [
      sd(eintrag(stand({ stage: zustand({ an: [true, false, false], host: '10.0.0.4' }) }), 'quelle-timer')),
      sd(eintrag(stand({ stage: zustand({ an: [true, false, false], host: '127.0.0.1' }) }), 'quelle-timer')),
    ],
    ['warn nicht erreichbar', 'warn nicht gefunden'],
    'SD-3 Statusleiste: Quelle an, nicht verbunden, Host 10.0.0.4 → „nicht erreichbar“; auf der Vorgabe 127.0.0.1 → „nicht gefunden“',
  );
  gleich(
    [
      quellenAbschnitt(stand({ stage: zustand({ host: '10.0.0.4' }) })).peers.map((r) => r.eingerichtet),
      quellenAbschnitt(stand({ stage: zustand() })).peers.map((r) => r.eingerichtet),
      quellenAbschnitt(stand({ stage: zustand({ host: '' }) })).peers.map((r) => r.eingerichtet),
      quellenAbschnitt(stand({ stage: zustand({ host: '  ' }) })).peers.map((r) => r.eingerichtet),
    ],
    [
      [true, true, true],
      [false, false, false],
      [false, false, false],
      [false, false, false],
    ],
    'SD-3 Quellenzeile: eingerichtet genau dann, wenn der Host weder die Vorgabe 127.0.0.1 noch leer ist (auch nur Leerzeichen, Ruling R6; PeerRow.eingerichtet aus @jm/settings, C5)',
  );
  gleich(
    ['', '  '].map((host) => sd(eintrag(stand({ stage: zustand({ an: [true, false, false], host }) }), 'quelle-timer'))),
    ['warn nicht gefunden', 'warn nicht gefunden'],
    'SD-3 Statusleiste (Ruling R6): Quelle an, nicht verbunden, Host leer oder nur Leerzeichen → „nicht gefunden“, nicht „nicht erreichbar“',
  );
  const faelle = kreuz({ an: [false, true], verbunden: [false, true] } as const);
  pruefeFaelle('SD Quellen nur wenn an: aus → off aus, nie error, auch wenn der Zähler verbunden meldet', faelle, (f) => {
    const s = stand({ stage: zustand({ an: [f.an, f.an, f.an], verbunden: [f.verbunden, f.verbunden, f.verbunden] }) });
    const items = ROLLEN.map((r) => eintrag(s, r.id));
    if (items.some((i) => i.state === 'error')) return 'error';
    return f.an ? null : items.every((i) => sd(i) === `off ${ABSCHNITT_TEXTE.aus}`) ? null : 'aus ist nicht off aus';
  });
}

// ── SD Quellen gleich wie Abschnitt: Statuseintrag = Zeile des Panels (eine Wahrheit) ──
{
  const faelle = kreuz({ geladen: [false, true], an: [false, true], verbunden: [false, true], idx: [0, 1, 2], host: ['127.0.0.1', '', '10.0.0.4'] } as const);
  pruefeFaelle('SD Quellen gleich wie Abschnitt: Zustand und Text des Eintrags gleichen der Panel-Zeile je Rolle, auch mit eingerichtetem Host (Altfehler SD-3)', faelle, (f) => {
    const an: [boolean, boolean, boolean] = [false, false, false];
    const v: [boolean, boolean, boolean] = [false, false, false];
    an[f.idx] = f.an;
    v[f.idx] = f.verbunden;
    const s = stand({ stage: f.geladen ? zustand({ an, verbunden: v, host: f.host }) : undefined });
    const zeile = peersView(quellenAbschnitt(s)).zeilen[f.idx];
    const i = eintrag(s, `quelle-${zeile.role}`);
    return vergleiche(`${i.state} ${i.detail}`, `${zeile.status.state} ${zeile.status.text}`);
  });
}

// ── SD Nachricht auf dem Schirm: Text × Element × Zustand ──
{
  const TEXT: Record<string, string> = { leer: '', blank: '   ', text: ' Pause 5 Min ' };
  const faelle = kreuz({
    text: ['leer', 'blank', 'text'],
    element: [false, true],
    ausgabe: [undefined, null, ...ARTEN] as Array<AusgabeArt | null | undefined>,
    geladen: [false, true],
  } as const);
  pruefeFaelle('SD Nachricht auf dem Schirm: ok nur mit Text, Element an und Schirm offen; sonst off; unbekannt nie ok', faelle, (f) => {
    const s = stand({ stage: f.geladen ? zustand({ message: TEXT[f.text], widgetMessage: f.element }) : undefined, ausgabe: art(f.ausgabe) });
    const i = eintrag(s, 'nachricht');
    const soll = f.geladen && TEXT[f.text].trim() !== '' && f.element && f.ausgabe === 'offen';
    const ist = i.state === 'ok' ? `ok ${i.detail}` : i.state;
    return vergleiche(ist, soll ? `ok ${STAGE_TEXTE.nachricht.aufSchirm}` : 'off') ?? (i.group !== 'tool' ? 'Gruppe falsch' : null);
  });
  const t = zustand({ message: '', widgetMessage: true, widgetTimer: true, timerMessage: 'Noch 2 Minuten' });
  const o = { art: 'offen', displayId: 1 } as const;
  gleich(sd(eintrag(stand({ stage: t, ausgabe: o }), 'nachricht')), `ok ${STAGE_TEXTE.nachricht.aufSchirm}`, 'SD Nachricht auf dem Schirm: die Timer-Nachricht zählt wie auf dem Schirm (buehnenNachricht)');
  gleich(
    sd(eintrag(stand({ stage: zustand({ message: 'x', widgetMessage: false }), ausgabe: o }), 'nachricht')),
    `off ${STAGE_TEXTE.nachricht.elementAus}`,
    'SD Nachricht auf dem Schirm: Element aus nennt den Grund Element aus',
  );
}

// ── SD Statusleiste vor erster Antwort (Spec 7.2) ──
{
  gleich(
    statusLeiste(stand()).map((i) => `${i.id}:${i.state}:${i.detail}`),
    ['master-link', 'quelle-timer', 'quelle-switcher', 'quelle-presenter', 'buehnenschirm', 'nachricht'].map((id) => `${id}:off:unbekannt`),
    'SD Statusleiste vor erster Antwort: alle sechs Einträge off unbekannt',
  );
  gleich(
    statusLeiste(stand({ masterLink: null, ausgabe: null })).map((i) => i.state),
    ['off', 'off', 'off', 'off', 'off', 'off'],
    'SD Statusleiste vor erster Antwort: null (keine Brücke) ist ebenfalls unbekannt',
  );
}

// ── SD Statusleiste gesamt ──
{
  const faelle = kreuz({
    master: [undefined, { art: 'sucht' }] as Array<MasterLinkMeldungZeile | undefined>,
    ausgabe: [undefined, null, ...ARTEN] as Array<AusgabeArt | null | undefined>,
    stage: [undefined, zustand({ message: 'Hallo', an: [true, true, true], verbunden: [true, false, true] })],
  } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand => stand({ masterLink: f.master, ausgabe: art(f.ausgabe), stage: f.stage });
  const IDS = ['master-link', 'quelle-timer', 'quelle-switcher', 'quelle-presenter', 'buehnenschirm', 'nachricht'];
  pruefeFaelle('SD Statusleiste gesamt: Reihenfolge, ids eindeutig, schon nach Gruppen geordnet', faelle, (f) => {
    const leiste = statusLeiste(props(f));
    const ids = leiste.map((i) => i.id).join();
    return vergleiche(ids, IDS.join()) ?? (new Set(leiste.map((i) => i.id)).size !== leiste.length ? 'ids doppelt' : null) ?? vergleiche(ordneStatus(leiste).map((i) => i.id).join(), ids);
  });
  pruefeFaelle('SD Statusleiste gesamt: nie live (E4: kein onAir) und jede settingsSection ist ein Abschnitt aus ABSCHNITT', faelle, (f) => {
    const leiste = statusLeiste(props(f));
    if (leiste.some((i) => i.state === 'live')) return 'live';
    const falsch = leiste.filter((i) => i.settingsSection !== undefined && !(Object.values(ABSCHNITT) as string[]).includes(i.settingsSection));
    return falsch.length === 0 ? null : `falsch: ${falsch.map((i) => i.id).join()}`;
  });
  pruefeFaelle('SD Statusleiste gesamt: ohne Brückenantwort ist buehnenschirm und nachricht nie ok', faelle, (f) => {
    const s = props(f);
    const falsch = ['buehnenschirm', 'nachricht'].filter((id) => (f.ausgabe === undefined || f.ausgabe === null) && eintrag(s, id).state === 'ok');
    return falsch.length === 0 ? null : `ok: ${falsch.join()}`;
  });
  gleich(Object.values(ABSCHNITT), ['ausgabe', 'quellen', 'presenter'], 'SD Abschnitts-ids');
}

// ── SD Ausgabe-Abschnitt ──
{
  const faelle = kreuz({ ausgabe: [undefined, null, ...ARTEN] as Array<AusgabeArt | null | undefined>, display: [null, 2], geladen: [false, true] } as const);
  pruefeFaelle('SD Ausgabe-Abschnitt: enabled = Schirm soll offen sein, selectedId aus der Einstellung, nur Schalter', faelle, (f) => {
    const a = art(f.ausgabe, 2);
    const p = ausgabeAbschnitt(stand({ stage: f.geladen ? zustand({ display: f.display }) : undefined, ausgabe: a }));
    const an = a !== undefined && a !== null && a.art !== 'zu';
    const open = a === undefined || a === null ? undefined : a.art === 'offen' || a.art === 'bildschirm-fehlt';
    return vergleiche(
      `${p.id}/${p.enabled}/${p.windowOpen}/${p.selectedId}/${p.capabilities.toggle}/${p.capabilities.fullscreen}/${p.capabilities.background}`,
      `${ABSCHNITT.ausgabe}/${an}/${open}/${f.geladen ? f.display : null}/true/false/false`,
    );
  });
}

// ── SD Ort aus der Messung (2a-Nachzug, UX Welle 2b): measuredId = displayId bei offen, null bei Bildschirm fehlt (das System hat
// das Fenster verschoben, der Ort ist unbekannt), sonst undefined. Die Pille nennt dann den gemessenen Bildschirm, nie den gewählten ──
{
  const faelle = kreuz({ ausgabe: [undefined, null, ...ARTEN] as Array<AusgabeArt | null | undefined>, display: [2, 5] } as const);
  pruefeFaelle('SD Ort aus der Messung: ausgabeAbschnitt setzt measuredId = displayId bei offen, null bei Bildschirm fehlt, sonst undefined', faelle, (f) => {
    const p = ausgabeAbschnitt(stand({ stage: zustand({ display: 3 }), ausgabe: art(f.ausgabe, f.display) }));
    const soll = f.ausgabe === 'offen' ? f.display : f.ausgabe === 'bildschirm-fehlt' ? null : undefined;
    return vergleiche(String(p.measuredId), String(soll)) ?? (p.selectedId !== 3 ? `selectedId ${p.selectedId}` : null);
  });
  const LISTE = [
    { id: 1, label: 'Regie', primary: true },
    { id: 2, label: 'Bühne', primary: false },
    { id: 3, label: 'Foyer', primary: false },
  ];
  // Gewählt ist Bildschirm 3 (Foyer); die Pille kommt aus screenOutputView von @jm/settings (eine Wahrheit).
  const pille = (z: AusgabeZustand | null | undefined): string => {
    const s = settings.screenOutputView(ausgabeAbschnitt(stand({ stage: zustand({ display: 3 }), ausgabe: z, bildschirme: LISTE }))).status;
    return `${s.state} ${s.text}`;
  };
  gleich(
    [pille({ art: 'offen', displayId: 2 }), pille({ art: 'offen', displayId: 9 }), pille({ art: 'bildschirm-fehlt', displayId: 2 }), pille({ art: 'zu', displayId: null })],
    ['ok auf Bildschirm 2', 'warn Bildschirm fehlt', 'warn Bildschirm fehlt', 'off aus'],
    'SD Ort aus der Messung: die Pille nennt den gemessenen Bildschirm (2), nicht den gewählten (3); unbekannter Ort oder Bildschirm fehlt → „Bildschirm fehlt“',
  );
  const code = ohneKommentare(leseText('src/renderer/src/lib/oberflaeche.ts'));
  ok(!code.includes('gemesseneLage'), 'SD Ort aus der Messung: gemesseneLage entfällt (die Zeile „Steht auf“ kommt aus @jm/settings)');
}

// ── SD Bühnenschirm-Taste: live nur bei offen, nie gesperrt, Beschriftung wie die heutigen Knöpfe ──
{
  const faelle = kreuz({ art: [undefined, null, ...ARTEN] as Array<AusgabeArt | null | undefined>, geladen: [false, true] } as const);
  pruefeFaelle('SD Bühnenschirm-Taste: live nur bei offen; bei Bildschirm fehlt und abgestürzt bereit; nie gesperrt', faelle, (f) => {
    const t = buehnenschirmTaste(stand({ stage: f.geladen ? zustand() : undefined, ausgabe: art(f.art) }));
    const label = f.art === undefined || f.art === null || f.art === 'zu' ? STAGE_TEXTE.taste.oeffnen : STAGE_TEXTE.taste.schliessen;
    return vergleiche(`${t.state}/${t.label}/${t.disabledReason}`, `${f.art === 'offen' ? 'live' : 'bereit'}/${label}/undefined`);
  });
  gleich(
    [
      eintrag(stand({ ausgabe: { art: 'bildschirm-fehlt', displayId: 2 } }), 'buehnenschirm').state,
      eintrag(stand({ ausgabe: { art: 'abgestuerzt', displayId: 2 } }), 'buehnenschirm').state,
    ],
    ['warn', 'error'],
    'SD Bühnenschirm-Taste: der Eintrag zeigt bei Bildschirm fehlt warn, bei abgestürzt error',
  );
}

// ── SD Quellen ohne manuell (E12): Zeilen ohne source, kein Auto, Ein/Aus je Quelle ──
{
  const faelle = kreuz({ geladen: [false, true], an: [false, true], verbunden: [false, true] } as const);
  pruefeFaelle('SD Quellen ohne manuell: drei Rollen, Standardports, ohne source, nur toggle; keine Quelle und nie manuell', faelle, (f) => {
    const p = quellenAbschnitt(stand({ stage: f.geladen ? zustand({ an: [f.an, f.an, f.an], verbunden: [f.verbunden, f.verbunden, f.verbunden] }) : undefined }));
    const rollen = p.peers.map((r) => `${r.role}:${r.defaultPort}`).join();
    if (rollen !== 'timer:7777,switcher:8723,presenter:7330') return `Rollen ${rollen}`;
    if (p.id !== ABSCHNITT.quellen || p.capabilities.toggle !== true || p.capabilities.auto) return 'capabilities falsch';
    if (p.peers.some((r) => r.source !== undefined)) return 'source gesetzt';
    const v = peersView(p);
    const texte = v.zeilen.map((z) => `${z.status.text}|${z.quelleText ?? ''}`).join();
    if (/manuell|gefunden ·/.test(texte) || v.zeilen.some((z) => z.quelleText !== undefined)) return `Text ${texte}`;
    if (v.zeilen.some((z) => z.status.state === 'error')) return 'error';
    const soll = !f.geladen ? 'undefined' : String(f.an);
    return vergleiche(p.peers.map((r) => String(r.enabled)).join(), `${soll},${soll},${soll}`);
  });
  const a = quellenAbschnitt(stand({ stage: zustand() }), {
    ausgabeUmschalten() {},
    bildschirmWaehlen() {},
    quelleSchalten() {},
    quelleSetzen() {},
  });
  ok(typeof a.onToggle === 'function' && typeof a.onSet === 'function' && quellenAbschnitt(stand()).onToggle === undefined, 'SD Quellen: Aktionen nur mit Aktionsobjekt (die Statusleiste bleibt lesend)');
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
  const texte = flach(STAGE_TEXTE);
  ok(texte.length > 0 && texte.every((t) => !t.includes('"')), 'SD Texte ohne ASCII-Anführungszeichen');
  // R5: Texte aus @jm/settings (*_TEXTE, STATUS_UNBEKANNT) und @jm/ui (MASTER_LINK_TEXTE) werden nie nachgebaut.
  const fremd = new Set([...Object.entries(settings).filter(([k]) => k.endsWith('_TEXTE')).map(([, v]) => v), MASTER_LINK_TEXTE, settings.STATUS_UNBEKANNT].flatMap(flach));
  // Bewusste Ausnahmen (R7): gleiches Wort, andere Bedeutung. „offen“ = Fenster offen (nicht ein Modus).
  const AUSNAHMEN = new Set<string>([STAGE_TEXTE.ausgabe.offen]);
  const nachgebaut = texte.filter((t) => fremd.has(t) && !AUSNAHMEN.has(t));
  ok(fremd.size > 0 && nachgebaut.length === 0, `SD Texte nicht nachgebaut: kein STAGE_TEXTE-Wert gleicht einem Text aus @jm/settings oder @jm/ui${nachgebaut.length ? ` (${nachgebaut.join(' | ')})` : ''}`);
  const code = ohneKommentare(leseText('src/renderer/src/lib/oberflaeche.ts'));
  ok(!/(?<![\w-])window\b|\blocalStorage\b|\bipcRenderer\b|\bdocument\b|from ['"]electron['"]/.test(code), 'SD oberflaeche rein: lib/oberflaeche.ts ohne window, document, localStorage, IPC und Electron');
  ok(!/onAir/.test(code), 'SD oberflaeche: kein onAir (E4)');
}

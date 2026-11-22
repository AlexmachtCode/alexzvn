// UX Welle 1 · Rundown-Ableitungen (Aufgabe c; Spec 5.1, 7.1–7.4, Anhang A „Rundown“, E11, E12, R15): Statusleiste als Kreuzprodukt
// je Eintrag mit Erwartungstabelle, aktive Feedbacks, Gegenstellen, Haupttasten, Kürzelschutz, Texte.
// Ohne window und ohne Electron.
import * as settings from '@jm/settings';
import { remoteControlView } from '@jm/settings';
import { MASTER_LINK_TEXTE, ordneStatus, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { KNOWN_ROLES } from '@/lib/capabilities';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { MasterLinkMeldungZeile, ToolLink, VerbundAnzeigeZeile } from '@shared/types';
import {
  ABSCHNITT,
  aktiveFeedbacks,
  fernsteuerungAbschnitt,
  gefundeneAdressen,
  gegenstellenAbschnitt,
  hauptTasten,
  istEingabeZiel,
  iveoAbschnitt,
  RUNDOWN_TEXTE,
  statusLeiste,
  verbundZeileZustand,
  type OberflaechenStand,
} from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { basisMeldung, basisState, zeile } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8731';

function stand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { state: basisState(), masterLink: undefined, fernsteuerung: undefined, verbund: undefined, ...teil };
}
const eintrag = (s: OberflaechenStand, id: string): StatusItem => statusLeiste(s).find((i) => i.id === id) as StatusItem;
const sd = (i: StatusItem): string => `${i.state} ${i.detail ?? ''}`;
const link = (teil: Partial<ToolLink> = {}): ToolLink => ({ role: 'switcher', label: 'JM Switcher', host: '10.0.0.7', port: 8721, connected: true, source: 'mdns', state: null, ...teil });
const SPEAKER = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Sprecher ${i + 1}` })) as never;

// ── RD Statusleiste master-link ──
{
  const faelle: Array<{ name: string; m: MasterLinkMeldungZeile | null | undefined; soll: string }> = [
    { name: 'undefined', m: undefined, soll: 'off unbekannt' },
    { name: 'null', m: null, soll: 'off unbekannt' },
    { name: 'ohne-client', m: { art: 'ohne-client' }, soll: 'warn nicht gestartet' },
  ];
  pruefeFaelle('RD Statusleiste master-link: unbekannt vor der Antwort, ohne Brücke, nie ok ohne Verbindung', faelle, (f) => {
    const i = eintrag(stand({ masterLink: f.m }), 'master-link');
    return i.state === 'ok' ? 'ok' : f.soll.startsWith('off') ? vergleiche(sd(i), f.soll) : null;
  });
}

// ── RD Statusleiste iveo (E12): Show × iveo × Speaker ──
{
  const faelle = kreuz({ gemerkt: [false, true], mitIveo: [false, true], n: [0, 3] } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    stand({ state: basisState({ showGemerkt: f.gemerkt, showMitIveo: f.mitIveo, iveoSpeakers: SPEAKER(f.n) }) });
  pruefeFaelle('RD Statusleiste iveo: keine Show off, Show ohne iveo off, Show mit n Speakern ok mit Zahl', faelle, (f) => {
    const i = eintrag(props(f), 'iveo');
    // Fund C1: Der Abschnitt iveo zeigt die Bindung nur (Show und Speaker kommen vom Launcher bzw. Main) → reine Anzeige.
    const kopf = i.group !== 'verbindung' || i.label !== 'iveo' || 'settingsSection' in i ? 'Kopf falsch' : null;
    if (!(f.gemerkt && f.mitIveo)) return vergleiche(sd(i), `off ${f.gemerkt ? RUNDOWN_TEXTE.iveo.showOhneIveo : RUNDOWN_TEXTE.iveo.keineShow} · nicht eingerichtet`) ?? kopf;
    // Gebunden: ohne Speaker unbekannt (nie ok), mit Speakern ok und die Zahl.
    return vergleiche(sd(i), f.n > 0 ? 'ok 3 Speaker' : 'off unbekannt') ?? kopf;
  });
  pruefeFaelle('RD iveo-Abschnitt: gebunden nur mit gemerkter Show und iveo-Bindung, Speakerzahl aus der Liste', faelle, (f) => {
    const p = iveoAbschnitt(props(f));
    const gebunden = f.gemerkt && f.mitIveo;
    return vergleiche(`${p.bound}/${p.speakerCount}/${p.delivery}`, `${gebunden}/${gebunden ? f.n : undefined}/${gebunden && f.n > 0 ? 'ok' : undefined}`);
  });
}

// ── RD aktive Feedbacks (E11): nur truthy-Feedbacks mit wahrem Wert ──
{
  const TABELLE = {
    r: {
      feedbacks: [
        { label: 'Aufnahme läuft', stateKey: 'recording', match: 'truthy' },
        { label: 'Stream läuft', stateKey: 'streaming', match: 'truthy' },
        { label: 'Szene ist auf Program', stateKey: 'program', match: 'equalsArg' },
      ],
    },
  };
  const wert: Array<[string | undefined, boolean]> = [
    ['1', true], ['an', true], ['true', true], ['2', true], ['12', true],
    ['0', false], ['', false], ['aus', false], ['01', false], [' 1', false], ['-1', false], [undefined, false], ['TRUE', false],
  ];
  pruefeFaelle(
    'RD aktive Feedbacks: wahr sind 1, an, true und positive Zahlen; 0, leer, führende Null, Leerraum und alles andere aus',
    wert.map(([w, soll]) => ({ w, soll })),
    (f) => vergleiche(String(aktiveFeedbacks({ role: 'r', state: f.w === undefined ? {} : { recording: f.w } }, TABELLE).includes('Aufnahme läuft')), String(f.soll)),
  );
  gleich(aktiveFeedbacks({ role: 'r', state: { recording: '1', streaming: 'an', program: '1' } }, TABELLE), ['Aufnahme läuft', 'Stream läuft'], 'RD aktive Feedbacks: equalsArg zählt nie, Reihenfolge der Tabelle');
  gleich(aktiveFeedbacks({ role: 'r', state: null }, TABELLE), [], 'RD aktive Feedbacks: ohne STATE-Push keine');
  gleich(aktiveFeedbacks({ role: 'unbekannt', state: { recording: '1' } }, TABELLE), [], 'RD aktive Feedbacks: unbekannte Rolle keine');
}

// ── RD Statusleiste link-<rolle> (E11): Verbindung × Quelle × Feedbacks ──
{
  const faelle = kreuz({ connected: [true, false], source: ['mdns', 'manual'], feedback: ['keins', 'zwei', 'nullwert'] } as const);
  const STATE = { keins: null, zwei: { recording: '1', streaming: 'an' }, nullwert: { recording: '0', streaming: '' } } as const;
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    stand({ state: basisState({ links: [link({ connected: f.connected, source: f.source, state: STATE[f.feedback] })] }) });
  pruefeFaelle('RD Statusleiste link-<rolle>: verbunden ok mit aktiven Feedbacks, sonst warn; manuell nennt host:port', faelle, (f) => {
    const i = eintrag(props(f), 'link-switcher');
    // Die gemessene Adresse steht immer im Text (E11, Nachbesserung): gefunden als host:port, manuell als „manuell: host:port“.
    const manuell = f.source === 'manual' ? 'manuell: 10.0.0.7:8721' : '10.0.0.7:8721';
    const fb = f.feedback === 'zwei' ? ['Aufnahme läuft', 'Stream läuft'] : [];
    const soll = f.connected
      ? `ok ${[manuell, ...fb].join(' · ')}`
      : `warn ${f.source === 'manual' ? 'manuell: 10.0.0.7:8721 · nicht verbunden' : 'gefunden · nicht verbunden'}`;
    return vergleiche(sd(i), soll) ?? (i.group !== 'verbindung' || i.label !== 'JM Switcher' || i.settingsSection !== ABSCHNITT.gegenstellen ? 'Kopf falsch' : null);
  });
  // „RD Gegenstellen manuell“: der Adresstext steht im Wortlaut „manuell: host:port“.
  const m = eintrag(stand({ state: basisState({ links: [link({ source: 'manual', host: 'regie.lan', port: 9001 })] }) }), 'link-switcher');
  ok(String(m.detail).includes('manuell: regie.lan:9001'), 'RD Gegenstellen manuell: „manuell: host:port“ im Text');
  gleich(
    statusLeiste(stand({ state: basisState({ links: [link(), link({ role: 'timer', label: 'JM Timer' })] }) })).map((i) => i.id),
    ['master-link', 'iveo', 'link-switcher', 'link-timer', 'fernsteuerung'],
    'RD Statusleiste: je Gegenstelle ein Eintrag link-<rolle>, in der Reihenfolge des Stands',
  );
}

// ── RD Gefundene Adressen: die gemessene Adresse bleibt sichtbar (Panel) ──
{
  const links = [link(), link({ role: 'timer', label: 'JM Timer', host: 'regie.lan', port: 9001, source: 'manual' }), link({ role: 'titler', label: 'JM Titler', host: '10.0.0.8', port: 8722, connected: false })];
  gleich(
    gefundeneAdressen(stand({ state: basisState({ links }) })),
    [
      { role: 'switcher', label: 'JM Switcher', text: `${RUNDOWN_TEXTE.gegenstellen.gefunden} 10.0.0.7:8721` },
      { role: 'titler', label: 'JM Titler', text: `${RUNDOWN_TEXTE.gegenstellen.gefunden} 10.0.0.8:8722` },
    ],
    'RD Gefundene Adressen: je per mDNS gefundenem Tool „gefunden: host:port“, manuelle Adressen stehen schon in der Quelle',
  );
  gleich(gefundeneAdressen(stand()), [], 'RD Gefundene Adressen: ohne Links keine Zeile');
}

// ── RD Gegenstellen-Abschnitt: Zeilen, Setzen, Auto ──
{
  const aufrufe: string[] = [];
  const a = { setEndpoint: (r: string, h: string, p: number) => void aufrufe.push(`${r}|${h}|${p}`) };
  const s = stand({ state: basisState({ links: [link({ role: 'timer', label: 'JM Timer', host: '10.0.0.9', port: 8724 })], overrides: { switcher: { host: '10.0.0.5', port: 9999 } } }) });
  const p = gegenstellenAbschnitt(s, a);
  const zeilen = Object.fromEntries(p.peers.map((r) => [r.role, r]));
  gleich(p.id, ABSCHNITT.gegenstellen, 'RD Gegenstellen-Abschnitt: id');
  ok(p.peers.length > 5 && zeilen['timer'] !== undefined && zeilen['switcher'] !== undefined, 'RD Gegenstellen-Abschnitt: eine Zeile je bekannter Rolle');
  gleich(
    [zeilen['timer'].source, zeilen['timer'].host, zeilen['timer'].connected, zeilen['switcher'].source, zeilen['switcher'].host, zeilen['switcher'].port, zeilen['switcher'].connected],
    ['mdns', '', true, 'manual', '10.0.0.5', 9999, false],
    'RD Gegenstellen-Abschnitt: gefunden = automatisch ohne Host; Override = manuell mit Host und Port; fehlender Fund = nicht verbunden',
  );
  // Eine Rolle ohne Fund und ohne Override ist weder „gefunden“ noch manuell: source fehlt (kein falsches „Quelle gefunden“).
  gleich([zeilen['presenter']?.source, zeilen['presenter']?.connected], [undefined, false], 'RD Gegenstellen-Abschnitt: ohne Fund und ohne Override keine Quelle (nicht „gefunden“), nicht verbunden');
  p.onSet?.('timer', '1.2.3.4', 8724);
  p.onAuto?.('timer');
  gleich(aufrufe, ['timer|1.2.3.4|8724', 'timer||0'], 'RD Gegenstellen-Abschnitt: Setzen schickt Host und Port, Auto entfernt den Override (host leer)');
  ok(p.capabilities.auto === true && p.capabilities.toggle !== true, 'RD Gegenstellen-Abschnitt: mit Auto, ohne Ein/Aus');
}

// ── RD Gegenstellen Abschnittsstatus (Fund B2, Ruling R31): gezählt werden nur gefundene, manuell gesetzte oder im Ablauf
// verwendete Rollen; die eigene Rolle „rundown“ hat keine Zeile; die Zeilen selbst bleiben wie gemessen ──
{
  const a = { setEndpoint: () => {} };
  const FUND = {
    keiner: undefined,
    verbunden: { connected: true, source: 'mdns' },
    getrennt: { connected: false, source: 'mdns' },
    manuell: { connected: false, source: 'manual' },
  } as const;
  const ROLLEN = [
    ['timer', 'JM Timer'],
    ['titler', 'JM Titler'],
  ] as const;
  const faelle = kreuz({
    timer: ['keiner', 'verbunden', 'getrennt', 'manuell'],
    timerOverride: [false, true],
    timerVerwendet: [false, true],
    titler: ['keiner', 'verbunden', 'getrennt', 'manuell'],
    titlerOverride: [false, true],
    titlerVerwendet: [false, true],
  } as const);
  pruefeFaelle('RD Gegenstellen Abschnittsstatus: Fund × Override × im Ablauf verwendet je Rolle → ok nur, wenn alle zählenden verbunden; ohne zählende neutral', faelle, (f) => {
    const je = ROLLEN.map(([role, label]) => {
      const fund = FUND[f[role]];
      return {
        role,
        link: fund === undefined ? undefined : link({ role, label, host: '10.0.0.9', port: 8724, connected: fund.connected, source: fund.source }),
        override: f[`${role}Override`],
        verwendet: f[`${role}Verwendet`],
      };
    });
    const rows = je.filter((r) => r.verwendet).map((r) => ({ id: `z-${r.role}`, label: 'Z', actions: [{ id: `a-${r.role}`, role: r.role, verb: 'start', args: [], enabled: true }] }));
    const s = stand({
      state: basisState({
        doc: { schemaVersion: 2, name: 'T', rows },
        links: je.flatMap((r) => (r.link ? [r.link] : [])),
        overrides: Object.fromEntries(je.filter((r) => r.override).map((r) => [r.role, { host: '10.0.0.5', port: 9999 }])),
      }),
    });
    const zaehlend = je.filter((r) => r.link !== undefined || r.override || r.verwendet);
    const verbunden = zaehlend.filter((r) => r.link?.connected === true).length;
    const soll = zaehlend.length === 0 ? 'off keine Gegenstellen' : verbunden === zaehlend.length ? 'ok verbunden' : `warn ${verbunden} von ${zaehlend.length} verbunden`;
    const v = settings.peersView(gegenstellenAbschnitt(s, a));
    return vergleiche(`${v.status.state} ${v.status.text}`, soll);
  });
  const p = gegenstellenAbschnitt(stand(), a);
  ok(p.peers.every((r) => r.role !== 'rundown') && p.peers.length === KNOWN_ROLES.length - 1, 'RD Gegenstellen Abschnittsstatus: die eigene Rolle „rundown“ hat keine Zeile (der Conductor schließt sie aus, sie würde nie gefunden)');
  // Gemessen in der Prüfung: Switcher und Timer verbunden, alles andere nicht gefunden → früher „2 von 15 verbunden“.
  const gemessen = stand({
    state: basisState({
      links: [link(), link({ role: 'timer', label: 'JM Timer', host: '10.0.0.9', port: 8724 })],
    }),
  });
  const v = settings.peersView(gegenstellenAbschnitt(gemessen, a));
  gleich(
    [`${v.status.state} ${v.status.text}`, v.zeilen.filter((z) => z.status.text === settings.PEERS_TEXTE.zeileNichtGefunden).length],
    ['ok verbunden', KNOWN_ROLES.length - 3],
    'RD Gegenstellen Abschnittsstatus: Switcher und Timer verbunden → Abschnitt „verbunden“; die übrigen Zeilen bleiben „nicht gefunden“ und lassen sich weiter setzen',
  );
}

// ── RD Statusleiste fernsteuerung: Meldung × Modus ──
{
  const MELDUNG: Record<string, FernsteuerungMeldung | null | undefined> = {
    undefined: undefined,
    null: null,
    aus: { laeuft: false, port: 8731, clients: 0 },
    belegt: { laeuft: false, port: 8731, clients: 0, fehler: BELEGT },
    fehler: { laeuft: false, port: 8731, clients: 0, fehler: 'listen EACCES: permission denied 0.0.0.0:8731' },
    bereit0: basisMeldung({ clients: 0 }),
    bereit3: basisMeldung({ clients: 3 }),
  };
  const FERN: Record<string, string> = {
    undefined: 'off unbekannt',
    null: 'off unbekannt',
    aus: 'off aus',
    belegt: 'error Port belegt',
    fehler: 'error Fehler: listen EACCES: permission denied 0.0.0.0:8731',
    bereit0: 'ok bereit · 0 verbunden',
    bereit3: 'ok bereit · 3 verbunden',
  };
  const faelle = kreuz({ meldung: ['undefined', 'null', 'aus', 'belegt', 'fehler', 'bereit0', 'bereit3'], modus: [undefined, 'open', 'secure'] } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand => {
    const m = MELDUNG[f.meldung];
    return stand({ fernsteuerung: m ? { ...m, modus: f.modus } : m });
  };
  pruefeFaelle('RD Statusleiste fernsteuerung: Meldung × Modus → unbekannt, aus, Port belegt, Fehler, bereit n verbunden', faelle, (f) => {
    const i = eintrag(props(f), 'fernsteuerung');
    // Fund C1: Port fest (8731), kein Schalter; der Abschnitt zeigt dieselbe Lage nur an → reine Anzeige, kein Sprung.
    return vergleiche(sd(i), FERN[f.meldung]) ?? (i.group !== 'fernsteuerung' || 'settingsSection' in i ? 'Kopf falsch' : null);
  });
  pruefeFaelle('RD Fernsteuerung-Abschnitt: Port 8731, nur Status (kein Port-Feld, kein Schalter, kein Launcher-Knopf)', faelle, (f) => {
    const p = fernsteuerungAbschnitt(props(f));
    const v = remoteControlView(p);
    return vergleiche(
      `${p.port}/${v.sichtbar.portFeld}/${v.sichtbar.steuerung}/${v.sichtbar.imLauncher}/${p.onToggle}/${p.onPortChange}`,
      '8731/false/false/false/undefined/undefined',
    );
  });
}

// ── RD Statusleiste vor erster Antwort (Spec 7.2): nichts gemessen → nie ok ──
{
  const leer = statusLeiste(stand());
  gleich(
    leer.map((i) => `${i.id}:${i.state}`),
    ['master-link:off', 'iveo:off', 'fernsteuerung:off'],
    'RD Statusleiste vor erster Antwort: master-link und fernsteuerung off, ohne Show iveo off, nie ok',
  );
  gleich(
    leer.filter((i) => i.id !== 'iveo').map((i) => i.detail),
    ['unbekannt', 'unbekannt'],
    'RD Statusleiste vor erster Antwort: unbekannt',
  );
  const mitNull = statusLeiste(stand({ masterLink: null, fernsteuerung: null }));
  ok(mitNull.every((i) => i.state === 'off'), 'RD Statusleiste vor erster Antwort: null (keine Brücke) ist ebenfalls unbekannt');
}

// ── RD Statusleiste gesamt ──
{
  const MASTER: Record<string, MasterLinkMeldungZeile | null | undefined> = {
    offen: undefined,
    verbunden: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1, masterName: 'Regie-PC', suite: 'JM Production Suite' },
    fehler: { art: 'fehler', code: 'verweigert', text: 'Master antwortet nicht.' },
  };
  const FERN: Record<string, FernsteuerungMeldung | undefined> = { keine: undefined, belegt: { laeuft: false, port: 8731, clients: 0, fehler: BELEGT }, bereit: basisMeldung({ clients: 2 }) };
  const LINKS: Record<string, ToolLink[]> = { keine: [], zwei: [link({ state: { recording: '1' } }), link({ role: 'timer', label: 'JM Timer', connected: false })] };
  const faelle = kreuz({ master: ['offen', 'verbunden', 'fehler'], iveo: [false, true], links: ['keine', 'zwei'], fern: ['keine', 'belegt', 'bereit'] } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    stand({
      masterLink: MASTER[f.master],
      fernsteuerung: FERN[f.fern],
      state: basisState({ links: LINKS[f.links], showGemerkt: f.iveo, showMitIveo: f.iveo, iveoSpeakers: SPEAKER(f.iveo ? 2 : 0) }),
    });
  pruefeFaelle('RD Statusleiste gesamt: Reihenfolge master-link, iveo, link-*, fernsteuerung, ids eindeutig, schon nach Gruppen geordnet', faelle, (f) => {
    const leiste = statusLeiste(props(f));
    const ids = leiste.map((i) => i.id).join();
    const soll = ['master-link', 'iveo', ...LINKS[f.links].map((l) => `link-${l.role}`), 'fernsteuerung'].join();
    return vergleiche(ids, soll) ?? (new Set(leiste.map((i) => i.id)).size !== leiste.length ? 'ids doppelt' : null) ?? vergleiche(ordneStatus(leiste).map((i) => i.id).join(), ids);
  });
  pruefeFaelle('RD Statusleiste gesamt: nie live (der Rundown hat keine On-Air-Quelle)', faelle, (f) => (statusLeiste(props(f)).some((i) => i.state === 'live') ? 'live' : null));
  pruefeFaelle('RD Statusleiste gesamt: jede settingsSection ist ein Abschnitt aus ABSCHNITT', faelle, (f) => {
    const falsch = statusLeiste(props(f)).filter((i) => i.settingsSection !== undefined && !(Object.values(ABSCHNITT) as string[]).includes(i.settingsSection));
    return falsch.length === 0 ? null : `falsch: ${falsch.map((i) => i.id).join()}`;
  });
}

// ── V-Zeile in der Kopfmitte ──
{
  const FARBEN: Array<[VerbundAnzeigeZeile['farbe'], string]> = [['gruen', 'ok'], ['gelb', 'warn'], ['rot', 'error'], ['gedaempft', 'off']];
  gleich(FARBEN.map(([f]) => verbundZeileZustand(f)), FARBEN.map(([, z]) => z), 'RD V-Zeile: gruen ok, gelb warn, rot error, gedaempft off');
  gleich(verbundZeileZustand('lila' as unknown as VerbundAnzeigeZeile['farbe']), 'off', 'RD V-Zeile: unbekannte Farbe ist off, nie ok und nie live');
}

// ── RD Haupttasten (R15) ──
{
  const faelle = kreuz({ zeilen: [0, 1, 3], index: [0, 1, 2, 5] } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    stand({ state: basisState({ doc: { schemaVersion: 2, name: 'T', rows: Array.from({ length: f.zeilen }, (_, i) => zeile(`z${i}`)) }, index: f.index }) });
  pruefeFaelle('RD Haupttasten GO: ohne scharfe Zeile gesperrt mit Grund, sonst bereit', faelle, (f) => {
    const t = hauptTasten(props(f)).go;
    const scharf = f.index < f.zeilen;
    return vergleiche(`${t.state}:${t.disabledReason ?? ''}`, scharf ? 'bereit:' : `gesperrt:${RUNDOWN_TEXTE.grund.keineZeile}`);
  });
  pruefeFaelle('RD Haupttasten Zurück und Weiter: nie gesperrt, nie live, wie heute', faelle, (f) => {
    const h = hauptTasten(props(f));
    return [h.zurueck, h.weiter].every((t) => t.state === 'bereit' && t.disabledReason === undefined) ? null : 'gesperrt oder live';
  });
  pruefeFaelle('RD Haupttasten: Beschriftung und Kürzel wie bisher (GO Leertaste, ↑, ↓), jede gesperrte mit Grund', faelle, (f) => {
    const h = hauptTasten(props(f));
    const alle = [h.go, h.zurueck, h.weiter];
    return vergleiche(alle.map((t) => `${t.label}/${t.shortcut}`).join('|'), 'GO/Leertaste|◀ Zurück/↑|Weiter ▶/↓') ?? (alle.some((t) => t.state === 'gesperrt' && !t.disabledReason?.trim()) ? 'gesperrt ohne Grund' : null);
  });
}

// ── RD Kürzel aus Panel-Feld (Befund: der Handler nahm nur INPUT, TEXTAREA und SELECT aus) ──
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
  pruefeFaelle('RD Kürzel aus Panel-Feld: istEingabeZiel ist true für input, textarea, select und contentEditable, false für button und null', faelle, (f) =>
    vergleiche(String(istEingabeZiel(f.z)), String(f.soll)),
  );
  const code = leseText('src/renderer/src/App.tsx');
  ok(
    /from '@\/lib\/oberflaeche'/.test(code) && /istEingabeZiel\(\s*e\.target\s*\)/.test(code) && !/INPUT\|TEXTAREA\|SELECT/.test(code),
    'RD Kürzel aus Panel-Feld: App.tsx filtert den Tastenhandler über istEingabeZiel, ohne eigene Tag-Prüfung',
  );
  ok(
    /e\.code === 'Space'/.test(code) && /e\.code === 'ArrowDown'/.test(code) && /e\.code === 'ArrowUp'/.test(code) && !/e\.(ctrlKey|metaKey|altKey|shiftKey|repeat)/.test(code),
    'RD Kürzel: Leertaste, Pfeil runter und hoch wie bisher, Modifikatoren und Wiederholung bleiben ohne Wirkung (U6)',
  );
}

// ── Texte und Quelltext ──
{
  const flach = (v: unknown): string[] => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(flach) : []);
  const texte = flach(RUNDOWN_TEXTE);
  ok(texte.length > 0 && texte.every((t) => !t.includes('"')), 'RD Texte ohne ASCII-Anführungszeichen');
  // Texte aus @jm/settings (*_TEXTE) und @jm/ui (MASTER_LINK_TEXTE) werden nie nachgebaut: Wertegleichheit ist ein Nachbau.
  const fremd = new Set([...Object.entries(settings).filter(([k]) => k.endsWith('_TEXTE')).map(([, v]) => v), MASTER_LINK_TEXTE].flatMap(flach));
  const nachgebaut = texte.filter((t) => fremd.has(t));
  ok(fremd.size > 0 && nachgebaut.length === 0, `RD Texte nicht nachgebaut: kein RUNDOWN_TEXTE-Wert gleicht einem Text aus @jm/settings oder @jm/ui${nachgebaut.length ? ` (${nachgebaut.join(' | ')})` : ''}`);
  gleich([RUNDOWN_TEXTE.go, RUNDOWN_TEXTE.zurueck, RUNDOWN_TEXTE.weiter], ['GO', '◀ Zurück', 'Weiter ▶'], 'RD Texte: Beschriftungen der Haupttasten wörtlich wie bisher (Transport.tsx)');
  gleich(Object.values(ABSCHNITT), ['iveo', 'fernsteuerung', 'gegenstellen'], 'RD Abschnitts-ids');
  const code = leseText('src/renderer/src/lib/oberflaeche.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!/\bwindow\b|\blocalStorage\b|\bipcRenderer\b|\bdocument\b|from ['"]electron['"]/.test(code), 'RD oberflaeche rein: lib/oberflaeche.ts ohne window, document, localStorage, IPC und Electron');
}

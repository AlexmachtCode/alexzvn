// UX Welle 1 · Q&A-Ableitungen (Aufgabe c; Spec 5.1, 7.1–7.4, Anhang A „Q&A“, E8, E13, E14, E15): Statusleiste als
// Kreuzprodukt je Eintrag, Kopplung dreifarbig, Extern ohne Geheimnisse, Haupttasten, Zählung „wartend“, Texte.
// Ohne window und ohne Electron.
import * as settings from '@jm/settings';
import { MASTER_LINK_TEXTE, ordneStatus, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { MasterLinkMeldungZeile, QaCloudInfo, QaEntry, QaState, ToolLink } from '@shared/types';
import {
  ABSCHNITT,
  externStatus,
  fernsteuerungAbschnitt,
  gefundeneAdressen,
  gegenstellenAbschnitt,
  hauptTasten,
  kopplungStatus,
  onAirKopf,
  QA_TEXTE,
  statusLeiste,
  wartendText,
  type OberflaechenStand,
} from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { basisMeldung, ohneKommentare } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8733';
const GEHEIM = 'GEHEIM-TOKEN-4711';

function cloud(teil: Partial<QaCloudInfo> = {}): QaCloudInfo {
  return {
    enabled: false,
    configured: false,
    eventId: '',
    proxyUrl: 'https://relay.example',
    streamUrl: '',
    pressUrl: '',
    pressCode: '',
    streamOpen: true,
    pressOpen: true,
    hasKey: false,
    zugang: { art: 'keiner', zeile: '', ton: 'ok', hinweis: null },
    lastError: null,
    lastPollAt: null,
    ...teil,
  };
}
function eintragQ(id: string, status: QaEntry['status'], teil: Partial<QaEntry> = {}): QaEntry {
  return { id, name: id, affiliation: '', question: '', status, source: 'operator', channel: 'operator', approved: true, at: 1, ...teil };
}
function qaState(teil: Partial<QaState> = {}): QaState {
  return {
    entries: [],
    activeId: null,
    config: {
      speakSeconds: 120,
      autoTimer: true,
      autoTitler: true,
      moderation: false,
      remoteEnabled: false,
      titlerTemplate: 'lowerthird',
      cloudEnabled: false,
      proxyUrl: '',
      eventId: '',
      pressCode: '',
      streamOpen: true,
      pressOpen: true,
    },
    remote: { running: false, urls: [] },
    cloud: cloud(),
    links: [],
    overrides: {},
    ...teil,
  };
}
function stand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { state: qaState(), masterLink: undefined, fernsteuerung: undefined, ...teil };
}
const eintrag = (s: OberflaechenStand, id: string): StatusItem => statusLeiste(s).find((i) => i.id === id) as StatusItem;
const sd = (i: StatusItem): string => `${i.state} ${i.detail ?? ''}`;
const link = (teil: Partial<ToolLink> = {}): ToolLink => ({ role: 'timer', label: 'JM Timer', host: '10.0.0.7', port: 8730, connected: true, source: 'mdns', state: null, ...teil });

// ── QA Kopplung dreifarbig (Review Focus 5, E13): aus = off, an + nicht gefunden = warn, gekoppelt = ok mit host:port ──
{
  const LINKS: Record<string, (rolle: string) => ToolLink | undefined> = {
    keiner: () => undefined,
    getrennt: (r) => link({ role: r, connected: false }),
    gekoppelt: (r) => link({ role: r, connected: true }),
    manuell: (r) => link({ role: r, connected: true, source: 'manual', host: '192.168.1.9', port: 9000 }),
    manuellGetrennt: (r) => link({ role: r, connected: false, source: 'manual', host: '192.168.1.9', port: 9000 }),
  };
  // Erwarteter Text je Gegenstelle und Schalter: aus = „aus“; kein Fund = „nicht gefunden“; gefunden, nicht verbunden = Adresse + Zeilentext.
  const TEXT: Record<string, { an: string; aus: string }> = {
    keiner: { an: 'nicht gefunden', aus: 'aus' },
    getrennt: { an: '10.0.0.7:8730 · gefunden · nicht verbunden', aus: 'aus' },
    gekoppelt: { an: '10.0.0.7:8730', aus: 'aus' },
    manuell: { an: 'manuell: 192.168.1.9:9000', aus: 'aus' },
    manuellGetrennt: { an: 'manuell: 192.168.1.9:9000 · nicht verbunden', aus: 'aus' },
  };
  const faelle = kreuz({ rolle: ['timer', 'titler'] as const, an: [false, true], link: ['keiner', 'getrennt', 'gekoppelt', 'manuell', 'manuellGetrennt'] });
  pruefeFaelle('QA Kopplung dreifarbig: je Rolle aus = off, an ohne Gegenstelle = warn, gekoppelt = ok mit host:port, nie ok ohne Gegenstelle', faelle, (f) => {
    const l = LINKS[f.link](f.rolle);
    const cfg = { ...qaState().config, ...(f.rolle === 'timer' ? { autoTimer: f.an } : { autoTitler: f.an }) };
    const i = kopplungStatus(f.rolle, stand({ state: qaState({ config: cfg, links: l ? [l] : [] }) }));
    const soll = !f.an ? 'off' : l?.connected ? 'ok' : 'warn';
    const adr = l ? `${l.host}:${l.port}` : null;
    const probleme = [
      vergleiche(i.state, soll),
      i.id === `kopplung-${f.rolle}` && i.group === 'verbindung' ? null : `id/Gruppe ${i.id} ${i.group}`,
      vergleiche(i.label, f.rolle === 'timer' ? 'Kopplung Timer' : 'Kopplung Titler'),
      vergleiche(i.settingsSection, ABSCHNITT.redezeit),
      soll === 'ok' && adr && !(i.detail ?? '').includes(adr) ? `kein ${adr} in „${i.detail}“` : null,
      soll !== 'ok' && adr && i.state === 'ok' ? 'ok trotz fehlender Gegenstelle' : null,
      vergleiche(i.detail, TEXT[f.link][f.an ? 'an' : 'aus']),
    ].filter((x) => x !== null);
    return probleme.length ? probleme.join('; ') : null;
  });
  // Die Rolle des anderen Tools darf nicht hineinspielen.
  const s = stand({ state: qaState({ config: { ...qaState().config, autoTimer: false, autoTitler: true }, links: [link({ role: 'timer', connected: true })] }) });
  gleich([kopplungStatus('timer', s).state, kopplungStatus('titler', s).state], ['off', 'warn'], 'QA Kopplung: Timer und Titler getrennt gelesen (aus + gekoppelt = off, Titler an ohne Fund = warn)');
}

// ── QA Extern Kreuzprodukt (E14): enabled × configured × lastError × lastPollAt × ton × Zugangsart × alter Key, ohne Freigabe oder Token ──
// lastPollAt (Fund C3): an und eingerichtet, aber noch keine Antwort des Relays = off „Verbinde …“ wie in der Karte, nie ok.
// settingsSection (Fund C1): nur, wo der Abschnitt „Extern“ den gezeigten Zustand ändern kann: Event erzeugen (nicht eingerichtet),
// Server-Adresse und alter Key (Fehler; Zugangszeile warn/fehler, solange der alte Key im Panel steht). Den Schalter An/Aus hat nur
// die Karte im Live-Bereich: „bereit“, „Verbinde …“ und „an“ sind darum reine Anzeige.
{
  const faelle = kreuz({
    enabled: [false, true],
    configured: [false, true],
    fehler: [null, 'Relay antwortet nicht'],
    abgeholt: [false, true],
    ton: ['ok', 'warn', 'fehler'] as const,
    art: ['freigabe', 'alter-key'] as const,
    hasKey: [false, true],
    zeile: ['', 'Zugang: Zeile vom Main'],
  });
  const mitZeile = (zeile: string, kurz: string): string => (zeile !== '' ? `${kurz} · ${zeile}` : kurz);
  pruefeFaelle('QA Extern Kreuzprodukt: Zustand, Text und Sprungziel nach Tabelle, Zeile wörtlich vom Main, nie live', faelle, (f) => {
    const c = cloud({ enabled: f.enabled, configured: f.configured, lastError: f.fehler, lastPollAt: f.abgeholt ? 1 : null, hasKey: f.hasKey, zugang: { art: f.art, zeile: f.zeile, ton: f.ton, hinweis: null } });
    const i = externStatus(stand({ state: qaState({ cloud: c }) }));
    const keyImPanel = f.hasKey || f.art !== 'freigabe';
    const soll: [string, string, string | undefined] = !f.enabled
      ? ['off', mitZeile(f.zeile, f.configured ? 'bereit' : 'aus'), f.configured ? undefined : ABSCHNITT.extern]
      : f.fehler
        ? ['error', f.fehler, ABSCHNITT.extern]
        : !f.configured
          ? ['warn', mitZeile(f.zeile, 'nicht eingerichtet'), ABSCHNITT.extern]
          : !f.abgeholt
            ? ['off', mitZeile(f.zeile, QA_TEXTE.extern.verbinde), undefined]
            : [({ ok: 'ok', warn: 'warn', fehler: 'error' } as const)[f.ton], mitZeile(f.zeile, 'an'), f.ton !== 'ok' && keyImPanel ? ABSCHNITT.extern : undefined];
    const probleme = [
      vergleiche(`${i.state} | ${i.detail} | ${i.settingsSection}`, `${soll[0]} | ${soll[1]} | ${soll[2]}`),
      i.id === 'extern' && i.group === 'verbindung' ? null : 'id/Gruppe',
      'settingsSection' in i && i.settingsSection === undefined ? 'settingsSection als undefined statt abwesend' : null,
    ].filter((x) => x !== null);
    return probleme.length ? probleme.join('; ') : null;
  });
  gleich(QA_TEXTE.extern.verbinde, 'Verbinde …', 'QA Extern: „Verbinde …“ ist der bestehende Text der Karte, wörtlich');
  const karte = ohneKommentare(leseText('src/renderer/src/components/CloudPanel.tsx'));
  ok(karte.includes('QA_TEXTE.extern.verbinde') && !karte.includes("'Verbinde …'"), 'QA Extern: die Karte und die Statusleiste lesen „Verbinde …“ aus derselben Konstante');
  const geheim = cloud({
    enabled: true,
    configured: true,
    pressCode: GEHEIM,
    eventId: GEHEIM,
    streamUrl: `https://x/${GEHEIM}`,
    pressUrl: `https://x/${GEHEIM}`,
    hasKey: true,
    zugang: { art: 'freigabe', zeile: 'Zugang ok', ton: 'ok', hinweis: GEHEIM },
  });
  ok(!JSON.stringify(externStatus(stand({ state: qaState({ cloud: geheim }) }))).includes(GEHEIM), 'QA Extern Kreuzprodukt: weder Freigabe, Token, Code noch Event-ID im Statuseintrag');
  gleich(sd(externStatus(stand())), `off ${settings.ABSCHNITT_TEXTE.aus}`, 'QA Extern: nicht eingerichtet und aus = off „aus“');
  gleich(sd(externStatus(stand({ state: qaState({ cloud: cloud({ configured: true }) }) }))), `off ${settings.REMOTE_TEXTE.bereit}`, 'QA Extern: eingerichtet, aus = off „bereit“');
}

// ── QA Statusleiste master-link ──
{
  const faelle: Array<{ name: string; m: MasterLinkMeldungZeile | null | undefined; soll: string }> = [
    { name: 'undefined', m: undefined, soll: 'off unbekannt' },
    { name: 'null', m: null, soll: 'off unbekannt' },
    { name: 'aus', m: { art: 'aus' }, soll: `off ${MASTER_LINK_TEXTE.aus}` },
  ];
  pruefeFaelle('QA Statusleiste master-link', faelle, (f) => vergleiche(sd(eintrag(stand({ masterLink: f.m }), 'master-link')), f.soll));
}

// ── QA Statusleiste saal (state.remote) ──
{
  const faelle: Array<{ name: string; remote: QaState['remote']; soll: string }> = [
    { name: 'aus', remote: { running: false, urls: [] }, soll: `off ${settings.ABSCHNITT_TEXTE.aus}` },
    { name: 'aus mit alten Adressen', remote: { running: false, urls: ['http://10.0.0.2:7782'] }, soll: `off ${settings.ABSCHNITT_TEXTE.aus}` },
    { name: 'an', remote: { running: true, urls: ['http://10.0.0.2:7782', 'http://10.0.0.3:7782'] }, soll: 'ok http://10.0.0.2:7782' },
    { name: 'an ohne Netzwerk', remote: { running: true, urls: [] }, soll: `warn ${QA_TEXTE.saal.keinNetzwerk}` },
  ];
  pruefeFaelle('QA Statusleiste saal', faelle, (f) => vergleiche(sd(eintrag(stand({ state: qaState({ remote: f.remote }) }), 'saal')), f.soll));
  gleich([eintrag(stand(), 'saal').group], ['tool'], 'QA Statusleiste saal: Gruppe tool');
}

// ── QA Statusleiste fernsteuerung ──
{
  const faelle: Array<{ name: string; m: FernsteuerungMeldung | null | undefined; zustand: string }> = [
    { name: 'undefined', m: undefined, zustand: 'off' },
    { name: 'null', m: null, zustand: 'off' },
    { name: 'Port belegt', m: { laeuft: false, port: 8733, clients: 0, fehler: BELEGT }, zustand: 'error' },
    { name: 'anderer Fehler', m: { laeuft: false, port: 8733, clients: 0, fehler: 'kaputt' }, zustand: 'error' },
    { name: 'läuft', m: basisMeldung({ clients: 2 }), zustand: 'ok' },
  ];
  pruefeFaelle('QA Statusleiste fernsteuerung: Zustand', faelle, (f) => vergleiche(eintrag(stand({ fernsteuerung: f.m }), 'fernsteuerung').state, f.zustand));
  const a = fernsteuerungAbschnitt(stand({ fernsteuerung: { laeuft: false, port: 8733, clients: 0, fehler: BELEGT } }));
  ok(a.portInUse === true && a.error === undefined && a.port === 8733, 'QA Fernsteuerung: Port belegt nur als portInUse, fester Port 8733');
  gleich(sd(eintrag(stand(), 'fernsteuerung')), 'off unbekannt', 'QA Fernsteuerung: ohne Meldung off „unbekannt“');
  // Fund C1: Port fest, kein Schalter; der Abschnitt „Fernsteuerung“ zeigt dieselbe Lage, ändert sie aber nicht → reine Anzeige.
  ok(faelle.every((f) => !('settingsSection' in eintrag(stand({ fernsteuerung: f.m }), 'fernsteuerung'))), 'QA Fernsteuerung: der Eintrag ist reine Anzeige (kein Sprung ins Panel, dort lässt sich nichts ändern)');
}

// ── QA Statusleiste vor erster Antwort (Spec 7.2): nichts gemessen → nie ok ──
{
  const leer = statusLeiste(stand());
  gleich(
    leer.map((i) => `${i.id}:${i.state}`),
    ['master-link:off', 'extern:off', 'kopplung-timer:warn', 'kopplung-titler:warn', 'fernsteuerung:off', 'saal:off'],
    'QA Statusleiste vor erster Antwort: gemessene Brücken off, Kopplungen (Standard an, keine Gegenstelle) warn, nie ok',
  );
  gleich(
    leer.filter((i) => i.id === 'master-link' || i.id === 'fernsteuerung').map((i) => i.detail),
    ['unbekannt', 'unbekannt'],
    'QA Statusleiste vor erster Antwort: unbekannt',
  );
  const mitNull = statusLeiste(stand({ masterLink: null, fernsteuerung: null }));
  ok(mitNull.filter((i) => i.id === 'master-link' || i.id === 'fernsteuerung').every((i) => i.state === 'off'), 'QA Statusleiste vor erster Antwort: null (keine Brücke) ist ebenfalls unbekannt');
}

// ── QA Statusleiste gesamt ──
{
  const MASTER: Record<string, MasterLinkMeldungZeile | null | undefined> = {
    offen: undefined,
    verbunden: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1, masterName: 'Regie-PC', suite: 'JM Production Suite' },
  };
  const FERN: Record<string, FernsteuerungMeldung | undefined> = { keine: undefined, belegt: { laeuft: false, port: 8733, clients: 0, fehler: BELEGT }, bereit: basisMeldung({ clients: 2 }) };
  const faelle = kreuz({ master: ['offen', 'verbunden'], extern: [false, true], saal: [false, true], fern: ['keine', 'belegt', 'bereit'] } as const);
  const bau = (f: (typeof faelle)[number]): OberflaechenStand =>
    stand({
      masterLink: MASTER[f.master],
      fernsteuerung: FERN[f.fern],
      state: qaState({
        remote: { running: f.saal, urls: f.saal ? ['http://10.0.0.2:7782'] : [] },
        cloud: cloud({ enabled: f.extern, configured: f.extern }),
        links: [link({ role: 'timer' }), link({ role: 'titler', label: 'JM Titler', connected: false })],
      }),
    });
  pruefeFaelle('QA Statusleiste gesamt: Reihenfolge, ids eindeutig, schon nach Gruppen geordnet, nie live', faelle, (f) => {
    const leiste = statusLeiste(bau(f));
    const ids = leiste.map((i) => i.id).join();
    return (
      vergleiche(ids, 'master-link,extern,kopplung-timer,kopplung-titler,fernsteuerung,saal') ??
      vergleiche(ordneStatus(leiste).map((i) => i.id).join(), ids) ??
      (leiste.some((i) => i.state === 'live') ? 'live' : null)
    );
  });
}

// ── QA Gegenstellen (E13): Timer, Titler; nichts erfunden ──
{
  const a = { setEndpoint: (_r: string, _h: string, _p: number) => {} };
  const leer = gegenstellenAbschnitt(stand(), a);
  gleich(leer.peers.map((p) => `${p.role}:${p.host}:${p.connected}:${p.source}`), ['timer::false:undefined', 'titler::false:undefined'], 'QA Gegenstellen: ohne Fund kein Host im Feld, nicht verbunden, keine Quelle');
  const fund = gegenstellenAbschnitt(stand({ state: qaState({ links: [link()] }) }), a);
  gleich([fund.peers[0].host, fund.peers[0].source, fund.peers[0].connected], ['', 'mdns', true], 'QA Gegenstellen: mDNS-Fund füllt das Host-Feld nicht, Quelle mdns');
  const ueber = gegenstellenAbschnitt(stand({ state: qaState({ links: [link()], overrides: { timer: { host: '192.168.1.9', port: 9000 } } }) }), a);
  gleich([ueber.peers[0].host, ueber.peers[0].port, ueber.peers[0].source], ['192.168.1.9', 9000, 'manual'], 'QA Gegenstellen: Override ist manuell');
  const aufrufe: string[] = [];
  const b = gegenstellenAbschnitt(stand(), { setEndpoint: (r, h, p) => void aufrufe.push(`${r}|${h}|${p}`) });
  b.onSet?.('timer', '10.1.1.1', 8730);
  b.onAuto?.('titler');
  gleich(aufrufe, ['timer|10.1.1.1|8730', 'titler||0'], 'QA Gegenstellen: Setzen schickt Host und Port, Auto entfernt den Override (host leer, Port 0)');
  gleich(
    gefundeneAdressen(stand({ state: qaState({ links: [link(), link({ role: 'titler', source: 'manual' })] }) })).map((x) => x.text),
    [`${QA_TEXTE.gegenstellen.gefunden} 10.0.0.7:8730`],
    'QA Gegenstellen: gefundene Adresse gemessen, manuelle nicht doppelt',
  );
}

// ── QA Haupttasten (E15): Nächste nie gesperrt, Beenden ohne Sprecher gesperrt mit Grund, Saal-Beschriftung wechselt ──
{
  const faelle = kreuz({ aktiv: [false, true], wartende: [0, 2], saal: [false, true] });
  pruefeFaelle('QA Haupttasten: je Zustand', faelle, (f) => {
    const s = qaState({
      activeId: f.aktiv ? 'a' : null,
      entries: [...(f.aktiv ? [eintragQ('a', 'active')] : []), ...Array.from({ length: f.wartende }, (_, i) => eintragQ(`w${i}`, 'waiting'))],
      remote: { running: f.saal, urls: [] },
    });
    const t = hauptTasten(stand({ state: s }));
    return (
      vergleiche(`${t.naechste.state}|${t.naechste.label}|${t.naechste.disabledReason}`, 'bereit|Nächste ▶|undefined') ??
      vergleiche(`${t.beenden.state}|${t.beenden.disabledReason}`, f.aktiv ? 'bereit|undefined' : `gesperrt|${QA_TEXTE.grund.niemandAmWort}`) ??
      vergleiche(t.beenden.label, '■ Beenden') ??
      vergleiche(`${t.saal.state}|${t.saal.disabledReason}|${t.saal.label}`, `bereit|undefined|${f.saal ? QA_TEXTE.saal.labelAn : QA_TEXTE.saal.labelAus}`)
    );
  });
  ok(hauptTasten(stand()).saal.label !== hauptTasten(stand({ state: qaState({ remote: { running: true, urls: [] } }) })).saal.label, 'QA Haupttasten: Saal-Beschriftung wechselt mit dem Zustand');
  gleich([QA_TEXTE.saal.labelAn, QA_TEXTE.saal.labelAus], ['Saal-Einreichung ◉ An', 'Saal-Einreichung ○ Aus'], 'QA Haupttasten: Saal-Wörter wie bisher (RemotePanel.tsx)');
  gleich([onAirKopf(stand()).live, onAirKopf(stand({ state: qaState({ activeId: 'a', entries: [eintragQ('a', 'active')] }) })).live], [false, true], 'QA onAir (E8): live, solange jemand am Wort ist');
}

// ── QA wartend wie heute (App.tsx:27): zählt jeden wartenden Eintrag, auch unfreigegebene ──
{
  const zaehl = (entries: QaEntry[]): string => wartendText(stand({ state: qaState({ entries }) }));
  gleich(zaehl([]), '0 wartend', 'QA wartend wie heute: leer');
  gleich(
    zaehl([eintragQ('a', 'active'), eintragQ('b', 'waiting'), eintragQ('c', 'done'), eintragQ('d', 'waiting', { source: 'remote', channel: 'stream', approved: false })]),
    '2 wartend',
    'QA wartend wie heute: zählt auch den unfreigegebenen Remote-Eintrag, nicht aktive und erledigte',
  );
}

// ── QA Texte ──
{
  const flach = (v: unknown): string[] => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(flach) : []);
  const texte = flach(QA_TEXTE);
  ok(texte.length > 0 && texte.every((t) => !t.includes('"')), 'QA Texte ohne ASCII-Anführungszeichen');
  const fremd = new Set([...Object.entries(settings).filter(([k]) => k.endsWith('_TEXTE')).map(([, v]) => v), MASTER_LINK_TEXTE].flatMap(flach));
  const nachgebaut = texte.filter((t) => fremd.has(t));
  ok(fremd.size > 0 && nachgebaut.length === 0, `QA Texte nicht nachgebaut: kein QA_TEXTE-Wert gleicht einem Text aus @jm/settings oder @jm/ui${nachgebaut.length ? ` (${nachgebaut.join(' | ')})` : ''}`);
  gleich(Object.values(ABSCHNITT), ['fernsteuerung', 'gegenstellen', 'redezeit', 'moderation', 'extern'], 'QA Abschnitts-ids');
  const code = leseText('src/renderer/src/lib/oberflaeche.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!/\bwindow\b|\blocalStorage\b|\bipcRenderer\b|\bdocument\b|from ['"]electron['"]/.test(code), 'QA oberflaeche rein: lib/oberflaeche.ts ohne window, document, localStorage, IPC und Electron');
  ok(!/Zugang|Freigabe|Token|Launcher/.test(JSON.stringify(QA_TEXTE)), 'QA Texte: keine Zugangstexte (Q1–Q12) in QA_TEXTE, sie kommen vom Main');
}

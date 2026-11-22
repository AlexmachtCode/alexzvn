// UX Welle 1 · Battle-Ableitungen (Aufgabe c; Spec 5.1, 7.1–7.4, Anhang A „Battle“, E8, E16): Statusleiste als Kreuzprodukt
// je Eintrag, Titler-Kopplung dreifarbig, Haupttasten je Zustand, Texte. Ohne window und ohne Electron.
import * as settings from '@jm/settings';
import { MASTER_LINK_TEXTE, ordneStatus, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { BattleState, ClipJob, MasterLinkMeldungZeile, ToolLink } from '@shared/types';
import {
  ABSCHNITT,
  BATTLE_TEXTE,
  fernsteuerungAbschnitt,
  gegenstellenAbschnitt,
  hauptTasten,
  onAirKopf,
  statusLeiste,
  titlerStatus,
  vsHinweis,
  type OberflaechenStand,
} from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { basisMeldung } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8734';

function battleState(teil: Partial<BattleState> = {}): BattleState {
  return {
    config: { rounds: 3, votingEnabled: true, autoTitler: true, clipSeconds: 20, recordingPath: '', clipDir: '' },
    competitors: { A: { name: 'A', crew: '' }, B: { name: 'B', crew: '' } },
    round: 2,
    rounds: [1, 2, 3].map((round) => ({ round, juryWinner: null, votesA: 0, votesB: 0 })),
    votingOpen: false,
    live: false,
    remote: { running: false, urls: [] },
    links: [],
    overrides: {},
    clips: [],
    ...teil,
  };
}
const mitConfig = (teil: Partial<BattleState['config']>, rest: Partial<BattleState> = {}): BattleState =>
  battleState({ ...rest, config: { ...battleState().config, ...teil } });
function stand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { state: battleState(), masterLink: undefined, fernsteuerung: undefined, ...teil };
}
const eintrag = (s: OberflaechenStand, id: string): StatusItem => statusLeiste(s).find((i) => i.id === id) as StatusItem;
const sd = (i: StatusItem): string => `${i.state} ${i.detail ?? ''}`;
const link = (teil: Partial<ToolLink> = {}): ToolLink => ({ role: 'titler', label: 'JM Titler', host: '10.0.0.7', port: 8735, connected: true, source: 'mdns', state: null, ...teil });
const clip = (status: ClipJob['status']): ClipJob => ({ id: status, status, outputPath: 'x.mp4', seconds: 20, at: 1 });

// ── BA Titler-Kopplung (Review Focus 5, E16): aus = off, an + nicht verbunden = warn, verbunden = ok mit host:port ──
{
  const LINKS: Record<string, ToolLink | undefined> = {
    keiner: undefined,
    getrennt: link({ connected: false }),
    gekoppelt: link(),
    manuell: link({ source: 'manual', host: '192.168.1.9', port: 9000 }),
    manuellGetrennt: link({ source: 'manual', host: '192.168.1.9', port: 9000, connected: false }),
  };
  // Erwarteter Text je Gegenstelle und Schalter: aus = „aus“; kein Fund = „nicht gefunden“; gefunden, nicht verbunden = Adresse + Zeilentext.
  const TEXT: Record<string, { an: string; aus: string }> = {
    keiner: { an: 'nicht gefunden', aus: 'aus' },
    getrennt: { an: '10.0.0.7:8735 · gefunden · nicht verbunden', aus: 'aus' },
    gekoppelt: { an: '10.0.0.7:8735', aus: 'aus' },
    manuell: { an: 'manuell: 192.168.1.9:9000', aus: 'aus' },
    manuellGetrennt: { an: 'manuell: 192.168.1.9:9000 · nicht verbunden', aus: 'aus' },
  };
  const faelle = kreuz({ an: [false, true], link: ['keiner', 'getrennt', 'gekoppelt', 'manuell', 'manuellGetrennt'] });
  pruefeFaelle('BA Titler-Kopplung: aus = off, an ohne Gegenstelle = warn, gekoppelt = ok mit host:port, nie ok ohne Gegenstelle', faelle, (f) => {
    const l = LINKS[f.link];
    const st = mitConfig({ autoTitler: f.an }, { links: l ? [l] : [] });
    const i = titlerStatus(stand({ state: st }));
    const soll = !f.an ? 'off' : l?.connected ? 'ok' : 'warn';
    const adr = l ? `${l.host}:${l.port}` : null;
    const hinweis = vsHinweis(stand({ state: st }));
    const probleme = [
      vergleiche(i.state, soll),
      i.id === 'titler' && i.group === 'verbindung' ? null : `id/Gruppe ${i.id} ${i.group}`,
      soll === 'ok' && adr && !(i.detail ?? '').includes(adr) ? `kein ${adr} in „${i.detail}“` : null,
      soll !== 'ok' && adr && i.state === 'ok' ? 'ok trotz fehlender Gegenstelle' : null,
      vergleiche(i.detail, TEXT[f.link][f.an ? 'an' : 'aus']),
      // Der Hinweis unter dem VS-Knopf steht genau bei an + nicht verbunden (= warn).
      vergleiche(hinweis, soll === 'warn' ? BATTLE_TEXTE.vsHinweis : undefined),
    ].filter((x) => x !== null);
    return probleme.length ? probleme.join('; ') : null;
  });
  gleich(
    [vsHinweis(stand({ state: mitConfig({ autoTitler: false }) })), vsHinweis(stand({ state: battleState({ links: [link()] }) })), vsHinweis(stand())],
    [undefined, undefined, BATTLE_TEXTE.vsHinweis],
    'BA Titler-Kopplung: vsHinweis nur bei autoTitler an und getrenntem Titler',
  );
}

// ── BA Voting Kreuzprodukt (Server × erlaubt × offen): Statuseintrag und Taste im Gleichschritt ──
{
  const faelle = kreuz({ server: [false, true], erlaubt: [false, true], offen: [false, true], adressen: [false, true] });
  pruefeFaelle('BA Voting Kreuzprodukt: Eintrag und Taste passen zur Sperre', faelle, (f) => {
    const st = mitConfig({ votingEnabled: f.erlaubt }, { remote: { running: f.server, urls: f.adressen ? ['http://10.0.0.2:7783'] : [] }, votingOpen: f.offen });
    const i = eintrag(stand({ state: st }), 'voting');
    const t = hauptTasten(stand({ state: st })).voting;
    const sollTaste = !f.server ? BATTLE_TEXTE.voting.serverAus : !f.erlaubt ? BATTLE_TEXTE.voting.abgeschaltet : undefined;
    const sollEintrag = !f.server
      ? `off ${settings.ABSCHNITT_TEXTE.aus}`
      : !f.erlaubt
        ? `off ${BATTLE_TEXTE.voting.abgeschaltet}`
        : !f.adressen
          ? `warn ${BATTLE_TEXTE.voting.keinNetzwerk}`
          : `ok ${f.offen ? BATTLE_TEXTE.voting.offen(2) : BATTLE_TEXTE.voting.geschlossen(2)}`;
    return (
      vergleiche(sd(i), sollEintrag) ??
      vergleiche(i.group, 'tool') ??
      vergleiche(t.state, sollTaste ? 'gesperrt' : 'bereit') ??
      vergleiche(t.disabledReason, sollTaste) ??
      vergleiche(t.label, f.offen ? BATTLE_TEXTE.voting.schliessen(2) : BATTLE_TEXTE.voting.oeffnen(2))
    );
  });
  gleich([BATTLE_TEXTE.voting.oeffnen(2), BATTLE_TEXTE.voting.schliessen(2)], ['Voting öffnen (Runde 2)', 'Voting offen (Runde 2) — schließen'], 'BA Voting: Beschriftungen wie bisher (RemotePanel.tsx)');
}

// ── BA Replay gesperrt mit Grund ──
{
  const faelle = kreuz({ quelle: ['', 'C:\\Aufnahmen\\show.mkv'], clips: [[], [clip('done')], [clip('error')], [clip('done'), clip('running')]] });
  pruefeFaelle('BA Replay gesperrt mit Grund: ohne Quelle, während ein Clip läuft; sonst bereit', faelle, (f) => {
    const laeuft = f.clips.some((c) => c.status === 'running');
    const t = hauptTasten(stand({ state: mitConfig({ recordingPath: f.quelle }, { clips: f.clips }) })).replay;
    const soll = f.quelle === '' ? BATTLE_TEXTE.replay.keineQuelle : laeuft ? BATTLE_TEXTE.replay.laeuft : undefined;
    return vergleiche(t.state, soll ? 'gesperrt' : 'bereit') ?? vergleiche(t.disabledReason, soll);
  });
  gleich([BATTLE_TEXTE.replay.keineQuelle, BATTLE_TEXTE.replay.laeuft], ['keine Aufnahme-Quelle', 'Clip läuft'], 'BA Replay: Gründe');
}

// ── BA VS nie gesperrt (E16), Nächste nie gesperrt, onAir (E8) ──
{
  const faelle = kreuz({ live: [false, true], autoTitler: [false, true], link: [undefined, link({ connected: false }), link()], server: [false, true] });
  pruefeFaelle('BA VS nie gesperrt: live nur bei VS on air, nie gesperrt, auch nicht ohne Titler', faelle, (f) => {
    const st = mitConfig({ autoTitler: f.autoTitler }, { live: f.live, links: f.link ? [f.link] : [], remote: { running: f.server, urls: [] } });
    const t = hauptTasten(stand({ state: st }));
    return (
      vergleiche(t.vs.state, f.live ? 'live' : 'bereit') ??
      vergleiche(t.vs.disabledReason, undefined) ??
      vergleiche(`${t.naechste.state}|${t.naechste.disabledReason}`, 'bereit|undefined') ??
      vergleiche(String(onAirKopf(stand({ state: st })).live), String(f.live))
    );
  });
}

// ── BA Statusleiste master-link ──
{
  const faelle: Array<{ name: string; m: MasterLinkMeldungZeile | null | undefined; soll: string }> = [
    { name: 'undefined', m: undefined, soll: 'off unbekannt' },
    { name: 'null', m: null, soll: 'off unbekannt' },
    { name: 'aus', m: { art: 'aus' }, soll: `off ${MASTER_LINK_TEXTE.aus}` },
  ];
  pruefeFaelle('BA Statusleiste master-link', faelle, (f) => vergleiche(sd(eintrag(stand({ masterLink: f.m }), 'master-link')), f.soll));
}

// ── BA Statusleiste aufnahme-quelle ──
{
  const faelle: Array<{ name: string; pfad: string; soll: string }> = [
    { name: 'leer', pfad: '', soll: `warn ${BATTLE_TEXTE.aufnahme.fehlt}` },
    { name: 'Windows-Pfad', pfad: 'C:\\Aufnahmen\\Tag 1\\show.mkv', soll: 'ok show.mkv' },
    { name: 'POSIX-Pfad', pfad: '/Users/x/show.mkv', soll: 'ok show.mkv' },
    { name: 'nur Name', pfad: 'show.mkv', soll: 'ok show.mkv' },
  ];
  pruefeFaelle('BA Statusleiste aufnahme-quelle: fehlt = warn, gesetzt = ok nur mit Dateiname', faelle, (f) => vergleiche(sd(eintrag(stand({ state: mitConfig({ recordingPath: f.pfad }) }), 'aufnahme-quelle')), f.soll));
  gleich([eintrag(stand(), 'aufnahme-quelle').group], ['tool'], 'BA Statusleiste aufnahme-quelle: Gruppe tool');
}

// ── BA Statusleiste fernsteuerung ──
{
  const faelle: Array<{ name: string; m: FernsteuerungMeldung | null | undefined; zustand: string }> = [
    { name: 'undefined', m: undefined, zustand: 'off' },
    { name: 'null', m: null, zustand: 'off' },
    { name: 'Port belegt', m: { laeuft: false, port: 8734, clients: 0, fehler: BELEGT }, zustand: 'error' },
    { name: 'anderer Fehler', m: { laeuft: false, port: 8734, clients: 0, fehler: 'kaputt' }, zustand: 'error' },
    { name: 'läuft', m: basisMeldung({ clients: 2 }), zustand: 'ok' },
  ];
  pruefeFaelle('BA Statusleiste fernsteuerung: Zustand', faelle, (f) => vergleiche(eintrag(stand({ fernsteuerung: f.m }), 'fernsteuerung').state, f.zustand));
  const a = fernsteuerungAbschnitt(stand({ fernsteuerung: { laeuft: false, port: 8734, clients: 0, fehler: BELEGT } }));
  ok(a.portInUse === true && a.error === undefined && a.port === 8734, 'BA Fernsteuerung: Port belegt nur als portInUse, fester Port 8734');
  gleich(sd(eintrag(stand(), 'fernsteuerung')), 'off unbekannt', 'BA Fernsteuerung: ohne Meldung off „unbekannt“');
}

// ── BA Statusleiste vor erster Antwort (Spec 7.2): nichts gemessen → nie ok ──
{
  const leer = statusLeiste(stand());
  gleich(
    leer.map((i) => `${i.id}:${i.state}`),
    ['master-link:off', 'titler:warn', 'fernsteuerung:off', 'voting:off', 'aufnahme-quelle:warn'],
    'BA Statusleiste vor erster Antwort: gemessene Brücken off, Titler (Standard an, keine Gegenstelle) und Quelle warn, nie ok',
  );
  gleich(
    leer.filter((i) => i.id === 'master-link' || i.id === 'fernsteuerung').map((i) => i.detail),
    ['unbekannt', 'unbekannt'],
    'BA Statusleiste vor erster Antwort: unbekannt',
  );
  const mitNull = statusLeiste(stand({ masterLink: null, fernsteuerung: null }));
  ok(mitNull.filter((i) => i.id === 'master-link' || i.id === 'fernsteuerung').every((i) => i.state === 'off'), 'BA Statusleiste vor erster Antwort: null (keine Brücke) ist ebenfalls unbekannt');
}

// ── BA Statusleiste gesamt ──
{
  const MASTER: Record<string, MasterLinkMeldungZeile | null | undefined> = {
    offen: undefined,
    verbunden: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1, masterName: 'Regie-PC', suite: 'JM Production Suite' },
  };
  const FERN: Record<string, FernsteuerungMeldung | undefined> = { keine: undefined, belegt: { laeuft: false, port: 8734, clients: 0, fehler: BELEGT }, bereit: basisMeldung({ clients: 2 }) };
  const faelle = kreuz({ master: ['offen', 'verbunden'], server: [false, true], titler: [false, true], fern: ['keine', 'belegt', 'bereit'] } as const);
  pruefeFaelle('BA Statusleiste gesamt: Reihenfolge, ids eindeutig, schon nach Gruppen geordnet, nie live', faelle, (f) => {
    const s = stand({
      masterLink: MASTER[f.master],
      fernsteuerung: FERN[f.fern],
      state: battleState({ remote: { running: f.server, urls: ['http://10.0.0.2:7783'] }, links: [link({ connected: f.titler })] }),
    });
    const leiste = statusLeiste(s);
    const ids = leiste.map((i) => i.id).join();
    return (
      vergleiche(ids, 'master-link,titler,fernsteuerung,voting,aufnahme-quelle') ??
      vergleiche(ordneStatus(leiste).map((i) => i.id).join(), ids) ??
      (leiste.some((i) => i.state === 'live') ? 'live' : null)
    );
  });
}

// ── BA Gegenstellen: nur der Titler; nichts erfunden ──
{
  const a = { setEndpoint: (_r: string, _h: string, _p: number) => {} };
  const leer = gegenstellenAbschnitt(stand(), a);
  gleich(leer.peers.map((p) => `${p.role}:${p.host}:${p.connected}:${p.source}`), ['titler::false:undefined'], 'BA Gegenstellen: ohne Fund kein Host im Feld, nicht verbunden, keine Quelle');
  const fund = gegenstellenAbschnitt(stand({ state: battleState({ links: [link()] }) }), a);
  gleich([fund.peers[0].host, fund.peers[0].source, fund.peers[0].connected], ['', 'mdns', true], 'BA Gegenstellen: mDNS-Fund füllt das Host-Feld nicht, Quelle mdns');
  const ueber = gegenstellenAbschnitt(stand({ state: battleState({ links: [link()], overrides: { titler: { host: '192.168.1.9', port: 9000 } } }) }), a);
  gleich([ueber.peers[0].host, ueber.peers[0].port, ueber.peers[0].source], ['192.168.1.9', 9000, 'manual'], 'BA Gegenstellen: Override ist manuell');
  const aufrufe: string[] = [];
  const b = gegenstellenAbschnitt(stand(), { setEndpoint: (r, h, p) => void aufrufe.push(`${r}|${h}|${p}`) });
  b.onSet?.('titler', '10.1.1.1', 8735);
  b.onAuto?.('titler');
  gleich(aufrufe, ['titler|10.1.1.1|8735', 'titler||0'], 'BA Gegenstellen: Setzen schickt Host und Port, Auto entfernt den Override (host leer, Port 0)');
}

// ── BA Texte ──
{
  const flach = (v: unknown): string[] => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(flach) : []);
  // Funktions-Texte (Runde, Sekunden, Runde n/m) gehören zu den Texten: mit Beispielwerten einsetzen.
  const mitFunktionen = (v: unknown): unknown => (typeof v === 'function' ? (v as (n: number, m: number) => string)(2, 3) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mitFunktionen(x)])) : v);
  const texte = flach(mitFunktionen(BATTLE_TEXTE));
  ok(texte.length > 0 && texte.every((t) => !t.includes('"')), 'BA Texte ohne ASCII-Anführungszeichen');
  const fremd = new Set([...Object.entries(settings).filter(([k]) => k.endsWith('_TEXTE')).map(([, v]) => v), MASTER_LINK_TEXTE].flatMap(flach));
  const nachgebaut = texte.filter((t) => fremd.has(t));
  ok(fremd.size > 0 && nachgebaut.length === 0, `BA Texte nicht nachgebaut: kein BATTLE_TEXTE-Wert gleicht einem Text aus @jm/settings oder @jm/ui${nachgebaut.length ? ` (${nachgebaut.join(' | ')})` : ''}`);
  gleich(Object.values(ABSCHNITT), ['fernsteuerung', 'gegenstellen', 'battle', 'replay', 'zuruecksetzen'], 'BA Abschnitts-ids');
  const code = leseText('src/renderer/src/lib/oberflaeche.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!/\bwindow\b|\blocalStorage\b|\bipcRenderer\b|\bdocument\b|from ['"]electron['"]/.test(code), 'BA oberflaeche rein: lib/oberflaeche.ts ohne window, document, localStorage, IPC und Electron');
}

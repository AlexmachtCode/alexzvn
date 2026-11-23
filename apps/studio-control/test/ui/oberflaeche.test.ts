// UX Welle 2b, Studio-Control c · Ableitungen (B3 ON AIR, B6, B15, B16, B17; Spec 7): Statusleiste als Kreuzprodukt je Eintrag
// und vor der ersten Antwort, ON AIR, Sperrgründe über canDo, Haupttasten je Panel, Server-Lauf-Kennung, Pillen. Ohne window.
import * as settings from '@jm/settings';
import { ABSCHNITT_TEXTE, PEERS_TEXTE, REMOTE_TEXTE } from '@jm/settings';
import { MASTER_LINK_TEXTE, UNBEKANNT, ordneStatus, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import { ROLES, canDo, type Action, type Role } from '@shared/roles';
import {
  ABSCHNITT,
  STUDIO_TEXTE,
  atemTasten,
  fernsteuerungAbschnitt,
  geraetPille,
  kopfOnAir,
  lichtTaste,
  mitEinstellungen,
  naechsterServerStand,
  obsTasten,
  sperrgrund,
  statusLeiste,
  tricasterTasten,
  type GeraeteStand,
  type Haupttaste,
  type OberflaechenStand,
} from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { basisMeldung, ohneKommentare } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8735';
const ZUSTAENDE = ['connected', 'connecting', 'polling', 'down'] as const;
type Zustand = (typeof ZUSTAENDE)[number];
type Meldung = { state: Zustand; lastError?: string; recording?: boolean; streaming?: boolean } | undefined;

function stand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return {
    umgebung: 'electron',
    benutzer: null,
    server: undefined,
    atem: undefined,
    obs: undefined,
    tricaster: undefined,
    ptz: undefined,
    audio: undefined,
    licht: undefined,
    masterLink: undefined,
    fernsteuerung: undefined,
    ...teil,
  };
}
/** Geräte aus einer Liste von Meldungen je Instanz (ids g1, g2 …); undefined = Instanz ohne Meldung. */
function geraete(...st: Meldung[]): GeraeteStand {
  const ids = st.map((_, i) => `g${i + 1}`);
  const status: GeraeteStand['status'] = {};
  st.forEach((s, i) => {
    if (s !== undefined) status[ids[i]!] = s;
  });
  return { ids, status };
}
const eintrag = (s: OberflaechenStand, id: string): StatusItem | undefined => statusLeiste(s).find((i) => i.id === id);
const sd = (i: StatusItem | undefined): string => (i === undefined ? 'fehlt' : `${i.state} ${i.detail ?? ''}`.trim());
const ROLLEN: Array<Role | undefined> = [undefined, ...ROLES];
const benutzer = (rolle: Role): OberflaechenStand['benutzer'] => ({ name: 'Anna', rolle });
const GERAETE = ['atem', 'obs', 'tricaster', 'ptz', 'audio'] as const;

// ── SC Statusleiste <id> (Geräte, B17): drei Instanzen × Zustand ──
{
  const erwartung = (zs: Meldung[]): string => {
    const m = zs.length;
    const antworten = zs.filter((z): z is NonNullable<Meldung> => z !== undefined);
    if (antworten.length === 0) return `off ${UNBEKANNT}`;
    const n = antworten.filter((z) => z.state === 'connected').length;
    if (n === m) return `ok ${PEERS_TEXTE.alleVerbunden}`;
    if (n > 0) return `warn ${PEERS_TEXTE.kVonN(n, m)}`;
    if (antworten.some((z) => z.state === 'connecting' || z.state === 'polling')) return `warn ${MASTER_LINK_TEXTE.verbindet}`;
    return `error ${antworten.find((z) => z.lastError !== undefined)?.lastError ?? STUDIO_TEXTE.getrennt}`;
  };
  const eine: Meldung[] = [undefined, ...ZUSTAENDE.map((state) => ({ state, lastError: state === 'down' ? 'Zeitüberschreitung' : undefined }))];
  pruefeFaelle('SC Statusleiste <id>: atem, obs, tricaster, ptz, audio über drei Instanzen × Zustand', kreuz({ geraet: GERAETE, a: eine, b: eine, c: eine }), (f) => {
    const zs = [f.a, f.b, f.c];
    return vergleiche(sd(eintrag(stand({ [f.geraet]: geraete(...zs) }), f.geraet)), erwartung(zs));
  });
  for (const g of GERAETE) {
    ok(eintrag(stand({ [g]: { ids: [], status: {} } }), g) === undefined, `SC Statusleiste ${g}: ohne Instanz kein Eintrag`);
    const i = eintrag(stand({ [g]: geraete({ state: 'connected' }) }), g);
    ok(i?.group === 'verbindung' && i.settingsSection === undefined, `SC Statusleiste ${g}: Gruppe verbindung, ohne Abschnitt`);
  }
  gleich(
    sd(eintrag(stand({ atem: geraete({ state: 'down' }, { state: 'down', lastError: 'a' }, { state: 'down', lastError: 'b' }) }), 'atem')),
    'error a',
    'SC Statusleiste atem: der erste lastError steht im Eintrag',
  );
}

// ── SC Statusleiste wie die Pille: Instanzen × Zustand (B17) ──
{
  pruefeFaelle('SC Statusleiste wie die Pille: keine verbunden, eine verbindet → warn wie die Pille; keine verbindet → error', kreuz({ a: ZUSTAENDE, b: [undefined, ...ZUSTAENDE] }), (f) => {
    const zs = f.b === undefined ? [{ state: f.a }] : [{ state: f.a }, { state: f.b }];
    const i = eintrag(stand({ obs: geraete(...zs) }), 'obs');
    if (zs.some((z) => z.state === 'connected')) return null;
    const verbindend = zs.find((z) => z.state === 'connecting' || z.state === 'polling');
    const soll = verbindend ? geraetPille({ state: verbindend.state }).state : geraetPille({ state: 'down' }).state;
    return i?.state === soll && (verbindend ? soll === 'warn' : soll === 'error') ? null : `Eintrag ${i?.state}, Pille ${soll}`;
  });
}

// ── SC Pillen-Bedeutung ──
{
  gleich(geraetPille(undefined), { state: 'off', text: UNBEKANNT }, 'SC Pillen-Bedeutung: ohne Meldung unbekannt (off), nie ok');
  gleich(geraetPille({ state: 'connected' }).state, 'ok', 'SC Pillen-Bedeutung: connected → ok, nie live');
  gleich(geraetPille({ state: 'connecting' }).state, 'warn', 'SC Pillen-Bedeutung: connecting → warn');
  gleich(geraetPille({ state: 'polling' }).state, 'warn', 'SC Pillen-Bedeutung: polling → warn');
  gleich(geraetPille({ state: 'down', lastError: 'kaputt' }), { state: 'error', text: 'kaputt' }, 'SC Pillen-Bedeutung: down → error mit lastError');
  gleich(geraetPille({ state: 'down' }), { state: 'error', text: STUDIO_TEXTE.getrennt }, 'SC Pillen-Bedeutung: down ohne lastError → getrennt');
  gleich(geraetPille({ state: 'seltsam' }), { state: 'off', text: UNBEKANNT }, 'SC Pillen-Bedeutung: unbekannter Zustand → unbekannt, nie ok');
  ok(ZUSTAENDE.every((state) => geraetPille({ state, lastError: 'x' }).state !== 'live'), 'SC Pillen-Bedeutung: nie live');
}

// ── SC Statusleiste server / licht / benutzer / master-link / fernsteuerung ──
{
  pruefeFaelle(
    'SC Statusleiste server: unbekannt · verbunden · getrennt',
    [
      { s: undefined, soll: `off ${UNBEKANNT}` },
      { s: true, soll: `ok ${PEERS_TEXTE.alleVerbunden}` },
      { s: false, soll: `error ${STUDIO_TEXTE.getrennt}` },
    ],
    (f) => vergleiche(sd(eintrag(stand({ server: f.s }), 'server')), f.soll),
  );
  pruefeFaelle(
    'SC Statusleiste licht: unbekannt · aus · an (ohne Rückmeldung) · Blackout (ohne Rückmeldung), Gruppe ausgabe',
    [
      { l: undefined, soll: `off ${UNBEKANNT}` },
      { l: { node: false, blackout: false }, soll: `off ${ABSCHNITT_TEXTE.aus}` },
      { l: { node: false, blackout: true }, soll: `off ${ABSCHNITT_TEXTE.aus}` },
      { l: { node: true, blackout: false }, soll: `ok ${ABSCHNITT_TEXTE.anOhneRueckmeldung}` },
      { l: { node: true, blackout: true }, soll: `warn ${STUDIO_TEXTE.licht.blackout}` },
    ],
    (f) => {
      const i = eintrag(stand({ licht: f.l }), 'licht');
      return vergleiche(sd(i), f.soll) ?? (i?.group !== 'ausgabe' ? 'Gruppe falsch' : null);
    },
  );
  pruefeFaelle(
    'SC Statusleiste benutzer: nur angemeldet, ‹Name› · ‹Rolle›, Gruppe tool',
    ROLLEN.map((r) => ({ r })),
    (f) => {
      const i = eintrag(stand({ benutzer: f.r === undefined ? null : benutzer(f.r) }), 'benutzer');
      if (f.r === undefined) return i === undefined ? null : 'Eintrag ohne Anmeldung';
      return vergleiche(sd(i), `ok Anna${STUDIO_TEXTE.trenner}${STUDIO_TEXTE.rolle[f.r]}`) ?? (i?.group !== 'tool' ? 'Gruppe falsch' : null);
    },
  );
  const link = (art: string): OberflaechenStand['masterLink'] => ({ art }) as unknown as OberflaechenStand['masterLink'];
  const ml: Array<{ m: OberflaechenStand['masterLink']; soll: string }> = [
    { m: undefined, soll: `off ${UNBEKANNT}` },
    { m: null, soll: `off ${UNBEKANNT}` },
    { m: link('aus'), soll: `off ${MASTER_LINK_TEXTE.aus}` },
    { m: link('sucht'), soll: `warn ${MASTER_LINK_TEXTE.sucht}` },
  ];
  pruefeFaelle('SC Statusleiste master-link: Meldung → masterLinkStatusItem, Gruppe verbindung', ml, (f) => {
    const i = eintrag(stand({ masterLink: f.m }), 'master-link');
    return vergleiche(sd(i), f.soll) ?? (i?.group !== 'verbindung' ? 'Gruppe falsch' : null);
  });
  const fern: Array<{ m: FernsteuerungMeldung | null | undefined; soll: string }> = [
    { m: undefined, soll: `off ${UNBEKANNT}` },
    { m: null, soll: `off ${UNBEKANNT}` },
    { m: basisMeldung(), soll: `ok ${REMOTE_TEXTE.bereitVerbunden(0)}` },
    { m: basisMeldung({ clients: 3 }), soll: `ok ${REMOTE_TEXTE.bereitVerbunden(3)}` },
    { m: { laeuft: false, port: 8735, clients: 0, fehler: BELEGT }, soll: `error ${REMOTE_TEXTE.portBelegt}` },
    { m: { laeuft: false, port: 8735, clients: 0, fehler: 'kaputt' }, soll: 'error Fehler: kaputt' },
    { m: { laeuft: false, port: 8735, clients: 0 }, soll: `off ${REMOTE_TEXTE.aus}` },
  ];
  pruefeFaelle('SC Statusleiste fernsteuerung: Meldung → Zustand, Gruppe fernsteuerung, Abschnitt fernsteuerung', fern, (f) => {
    const i = eintrag(stand({ fernsteuerung: f.m }), 'fernsteuerung');
    return vergleiche(sd(i), f.soll) ?? (i?.group !== 'fernsteuerung' || i.settingsSection !== ABSCHNITT.fernsteuerung ? 'Kopf falsch' : null);
  });
  const p = fernsteuerungAbschnitt(stand({ fernsteuerung: { laeuft: false, port: 0, clients: 2 } }));
  ok(p.port === 8735 && p.clients === undefined && p.companionModule === STUDIO_TEXTE.companionModul, 'SC Statusleiste fernsteuerung: Port 0 → 8735, Clients nur bei laufendem Server');
}

// ── SC Statusleiste vor erster Antwort ──
{
  const leer = statusLeiste(stand());
  ok(leer.every((i) => i.state === 'off' && i.detail === UNBEKANNT), 'SC Statusleiste vor erster Antwort: jeder Eintrag off und „unbekannt“, nie ok');
  gleich(
    leer.map((i) => i.id),
    ['master-link', 'server', 'licht', 'fernsteuerung'],
    'SC Statusleiste vor erster Antwort: master-link, server, licht, fernsteuerung; Geräte ohne Instanz und Benutzer fehlen',
  );
  ok(geraetPille(undefined).state === 'off' && geraetPille(undefined).text === UNBEKANNT, 'SC Statusleiste vor erster Antwort: Pille ohne Meldung unbekannt, nie error');
  const mitInstanz = statusLeiste(stand({ atem: geraete(undefined), obs: geraete(undefined, undefined) })).filter((i) => i.id === 'atem' || i.id === 'obs');
  ok(mitInstanz.length === 2 && mitInstanz.every((i) => i.state === 'off' && i.detail === UNBEKANNT), 'SC Statusleiste vor erster Antwort: Instanzen ohne Zustand sind unbekannt (off), nie ok');
  const voll = statusLeiste(stand({ atem: geraete({ state: 'connected' }), benutzer: benutzer('admin'), licht: { node: true, blackout: false } }));
  gleich(voll.map((i) => i.id), ordneStatus(voll).map((i) => i.id), 'SC Statusleiste vor erster Antwort: Reihenfolge ist die Gruppenreihenfolge der Leiste');
}

// ── SC Browser ohne Brücken ──
{
  const b = stand({ umgebung: 'browser', masterLink: link0(), fernsteuerung: basisMeldung(), atem: geraete({ state: 'connected' }) });
  const ids = statusLeiste(b).map((i) => i.id);
  ok(!ids.includes('master-link') && !ids.includes('fernsteuerung') && ids.includes('atem') && ids.includes('server'), 'SC Browser ohne Brücken: keine Einträge master-link und fernsteuerung, Geräte bleiben');
  ok(!mitEinstellungen(b) && mitEinstellungen(stand()), 'SC Browser ohne Brücken: mitEinstellungen nur im Electron-Fenster (kein ⚙ im Browser)');
}
function link0(): OberflaechenStand['masterLink'] {
  return { art: 'aus' } as unknown as OberflaechenStand['masterLink'];
}

// ── SC Server-Meldung alter Verbindung ──
{
  gleich(naechsterServerStand({ lauf: 2, verbunden: undefined }, { lauf: 2, verbunden: true }), { lauf: 2, verbunden: true }, 'SC Server-Meldung alter Verbindung: Meldung des aktuellen Laufs setzt server');
  gleich(naechsterServerStand({ lauf: 2, verbunden: true }, { lauf: 1, verbunden: false }), { lauf: 2, verbunden: true }, 'SC Server-Meldung alter Verbindung: Meldung eines alten Laufs ändert nichts');
  gleich(naechsterServerStand({ lauf: 2, verbunden: false }, { lauf: 3, verbunden: true }), { lauf: 2, verbunden: false }, 'SC Server-Meldung alter Verbindung: Meldung eines anderen Laufs ändert auch nichts');
}

// ── SC ON AIR (B3): Instanzen × state × recording × streaming; „LIVE“ vor „REC“ ──
{
  const einzel: Array<NonNullable<Meldung>> = kreuz({ state: ZUSTAENDE, recording: [undefined, false, true], streaming: [undefined, false, true] });
  const soll = (zs: Array<NonNullable<Meldung>>): { live: true; label: string } | undefined => {
    const v = zs.filter((z) => z.state === 'connected');
    if (v.some((z) => z.streaming === true)) return { live: true, label: STUDIO_TEXTE.onAirLive };
    if (v.some((z) => z.recording === true)) return { live: true, label: STUDIO_TEXTE.onAirRec };
    return undefined;
  };
  pruefeFaelle('SC ON AIR: ATEM, Zustand × recording × streaming', einzel, (f) => vergleiche(JSON.stringify(kopfOnAir(stand({ atem: geraete(f) }))), JSON.stringify(soll([f]))));
  pruefeFaelle('SC ON AIR: OBS, Zustand × recording × streaming', einzel, (f) => vergleiche(JSON.stringify(kopfOnAir(stand({ obs: geraete(f) }))), JSON.stringify(soll([f]))));
  pruefeFaelle('SC ON AIR: ATEM × OBS über alle Instanzen', kreuz({ a: einzel, b: einzel }), (f) =>
    vergleiche(JSON.stringify(kopfOnAir(stand({ atem: geraete(f.a), obs: geraete(f.b) }))), JSON.stringify(soll([f.a, f.b]))),
  );
  pruefeFaelle('SC ON AIR: zwei Instanzen am ATEM', kreuz({ a: einzel, b: einzel }), (f) => vergleiche(JSON.stringify(kopfOnAir(stand({ atem: geraete(f.a, f.b) }))), JSON.stringify(soll([f.a, f.b]))));
  gleich(kopfOnAir(stand({ atem: geraete({ state: 'connected', recording: true, streaming: true }) })), { live: true, label: 'LIVE' }, 'SC ON AIR: Stream und Aufnahme zugleich → „LIVE“ vor „REC“');
  gleich(kopfOnAir(stand({ obs: geraete({ state: 'connected', recording: true }) })), { live: true, label: 'REC' }, 'SC ON AIR: nur Aufnahme → „REC“');
  gleich(kopfOnAir(stand({ atem: geraete({ state: 'connected', recording: true }), obs: geraete({ state: 'connected', streaming: true }) })), { live: true, label: 'LIVE' }, 'SC ON AIR: REC am ATEM, Stream am OBS → „LIVE“');
  ok(kopfOnAir(stand()) === undefined, 'SC ON AIR: ohne gemessene Sendung (alles undefined) fehlt onAir');
  ok(
    kopfOnAir(stand({ tricaster: geraete({ state: 'connected', recording: true, streaming: true }), ptz: geraete({ state: 'connected', recording: true }), licht: { node: true, blackout: true } })) === undefined,
    'SC ON AIR: TriCaster, PTZ, Audio und Licht melden nie ON AIR',
  );
}

// ── SC Rolle über canDo ──
{
  const RECHTE: Action[] = ['atem:exec', 'obs:exec', 'tricaster:exec', 'ptz:exec', 'lighting:exec', 'audio:exec', 'inventory:write', 'users:write', 'audit:read'];
  pruefeFaelle('SC Rolle über canDo: Rollen-Grund genau dann, wenn canDo false ist', kreuz({ rolle: ROLLEN, recht: RECHTE, verbunden: [true, false, undefined] }), (f) => {
    const g = sperrgrund(f.rolle, f.recht, 'ATEM', f.verbunden);
    if (f.rolle === undefined) return g === STUDIO_TEXTE.grund.abgemeldet ? null : `ohne Rolle: ${g}`;
    if (!canDo(f.rolle, f.recht)) return g === STUDIO_TEXTE.grund.rolle(f.rolle) ? null : `Rollen-Grund fehlt (${g})`;
    if (f.verbunden === undefined) return g === STUDIO_TEXTE.grund.geraetUnbekannt('ATEM') ? null : `Unbekannt-Grund fehlt (${g})`;
    if (!f.verbunden) return g === STUDIO_TEXTE.grund.nichtVerbunden('ATEM') ? null : `Geräte-Grund fehlt (${g})`;
    return g === undefined ? null : `unerwarteter Grund ${g}`;
  });
  ok(sperrgrund('viewer', 'atem:exec', 'ATEM', false) === STUDIO_TEXTE.grund.rolle('viewer'), 'SC Rolle über canDo: der Rollen-Grund geht vor dem Geräte-Grund');
}

// ── SC Betrachter gesperrt mit Grund ──
{
  const ohneNode = { node: false, blackout: false };
  const alle = (s: OberflaechenStand): Array<[string, string, Haupttaste | undefined]> => [
    ...atemTasten(s, 'g1').map((t, i): [string, string, Haupttaste] => [`atem ${i}`, 'ATEM', t]),
    ...tricasterTasten(s, 'g1').map((t, i): [string, string, Haupttaste] => [`tricaster ${i}`, 'TriCaster', t]),
    ...obsTasten(s, 'g1').map((t, i): [string, string, Haupttaste] => [`obs ${i}`, 'OBS', t]),
    ['licht', 'Licht', lichtTaste(s)],
  ];
  const bau = (rolle: Role | undefined, g: GeraeteStand | undefined, licht: { node: boolean; blackout: boolean } | undefined = { node: true, blackout: false }): OberflaechenStand =>
    stand({ benutzer: rolle === undefined ? null : benutzer(rolle), atem: g, tricaster: g, obs: g, licht });
  pruefeFaelle('SC Betrachter gesperrt mit Grund: jede Haupttaste aller Panels trägt den Rollen-Grund', kreuz({ rec: [false, true], zustand: ZUSTAENDE }), (f) => {
    const grund = STUDIO_TEXTE.grund.rolle('viewer');
    const fehler = alle(bau('viewer', geraete({ state: f.zustand, recording: f.rec, streaming: f.rec }))).flatMap(([n, , t]) =>
      t !== undefined && t.disabledReason === grund && (t.state === 'gesperrt' || t.state === 'live') ? [] : [`${n}: ${t?.state} ${t?.disabledReason}`],
    );
    return fehler.length ? fehler.join('; ') : null;
  });
  pruefeFaelle('SC Betrachter gesperrt mit Grund: Bediener, nicht verbunden → Geräte-Grund (Licht ausgenommen)', kreuz({ zustand: ['connecting', 'polling', 'down'] as const }), (f) => {
    const fehler = alle(bau('operator', geraete({ state: f.zustand }))).flatMap(([n, geraet, t]) =>
      n === 'licht' || (t?.state === 'gesperrt' && t.disabledReason === STUDIO_TEXTE.grund.nichtVerbunden(geraet)) ? [] : [`${n}: ${t?.state} ${t?.disabledReason}`],
    );
    return fehler.length ? fehler.join('; ') : null;
  });
  const rec = atemTasten(bau('viewer', geraete({ state: 'connected', recording: true })), 'g1')[3]!;
  gleich([rec.label, rec.state, rec.disabledReason], [STUDIO_TEXTE.taste.rec, 'live', STUDIO_TEXTE.grund.rolle('viewer')], 'SC Betrachter gesperrt mit Grund: REC aufnehmend und Betrachter → live mit Grund (O2)');
  ok(alle(bau('operator', geraete({ state: 'connected' }))).every(([, , t]) => t?.state === 'bereit' && t.disabledReason === undefined), 'SC Betrachter gesperrt mit Grund: Bediener, verbunden → alle bereit ohne Grund');
  // Instanz ohne jedes Status-Ereignis: noch keine Antwort → „unbekannt“ (nicht „nicht verbunden“), Rolle geht vor.
  pruefeFaelle('SC Betrachter gesperrt mit Grund: Instanz ohne Status-Ereignis → Gerät unbekannt, Rolle zuerst', kreuz({ rolle: ['operator', 'viewer'] as const, art: ['keine Meldung', 'ohne Eintrag'] }), (f) => {
    const g = f.art === 'keine Meldung' ? geraete(undefined) : { ids: ['g1'], status: {} };
    const fehler = alle(bau(f.rolle, g)).flatMap(([n, geraet, t]) => {
      const soll = f.rolle === 'viewer' ? STUDIO_TEXTE.grund.rolle('viewer') : STUDIO_TEXTE.grund.geraetUnbekannt(geraet);
      return n === 'licht' || (t?.state === 'gesperrt' && t.disabledReason === soll) ? [] : [`${n}: ${t?.state} ${t?.disabledReason}`];
    });
    return fehler.length ? fehler.join('; ') : null;
  });
  gleich(lichtTaste(bau('viewer', undefined)), { label: STUDIO_TEXTE.taste.blackout, state: 'gesperrt', disabledReason: STUDIO_TEXTE.grund.rolle('viewer') }, 'SC Betrachter gesperrt mit Grund: Blackout ohne Recht gesperrt mit Rollen-Grund statt weg');
  ok(lichtTaste(bau('admin', undefined, ohneNode)) === undefined && lichtTaste(bau('viewer', undefined, ohneNode)) === undefined, 'SC Betrachter gesperrt mit Grund: Blackout ohne Node bleibt weg');
  gleich(lichtTaste(bau('operator', undefined, { node: true, blackout: true })), { label: STUDIO_TEXTE.taste.blackoutAus, state: 'bereit' }, 'SC Betrachter gesperrt mit Grund: Blackout an → „Blackout aus“, bereit (B6), nie live');
  const ohneAntwort = lichtTaste(stand({ benutzer: benutzer('operator') }));
  ok(ohneAntwort?.state === 'gesperrt' && ohneAntwort.disabledReason === STUDIO_TEXTE.grund.unbekannt, 'SC Betrachter gesperrt mit Grund: Licht ohne Antwort → gesperrt mit Grund, nicht frei');
}

// ── SC Haupttasten: Reihenfolge, live (B3), bereit (B6) ──
{
  const op = benutzer('operator');
  const T = STUDIO_TEXTE.taste;
  const mit = (extra: object = {}): GeraeteStand => geraete({ state: 'connected', ...extra });
  gleich(atemTasten(stand({ benutzer: op, atem: mit() }), 'g1').map((t) => t.label), [T.cut, T.auto, T.ftb, T.rec, T.stream], 'SC Haupttasten: ATEM Cut, Auto, FTB, REC, STREAM in dieser Reihenfolge');
  gleich(tricasterTasten(stand({ benutzer: op, tricaster: mit() }), 'g1').map((t) => t.label), [T.take, T.auto, T.fadeBlack, T.rec, T.stream], 'SC Haupttasten: TriCaster Take, Auto, Fade Black, REC, STREAM');
  gleich(obsTasten(stand({ benutzer: op, obs: mit() }), 'g1').map((t) => t.label), [T.aufnahme, T.stream], 'SC Haupttasten: OBS Aufnahme, Stream');
  pruefeFaelle('SC Haupttasten: live nur bei gemessenem recording/streaming mit connected (ATEM, OBS)', kreuz({ state: ZUSTAENDE, recording: [undefined, false, true], streaming: [undefined, false, true] }), (f) => {
    const a = atemTasten(stand({ benutzer: op, atem: geraete(f) }), 'g1').map((t) => t.state);
    const o = obsTasten(stand({ benutzer: op, obs: geraete(f) }), 'g1').map((t) => t.state);
    const c = f.state === 'connected';
    const rec = c && f.recording === true ? 'live' : c ? 'bereit' : 'gesperrt';
    const str = c && f.streaming === true ? 'live' : c ? 'bereit' : 'gesperrt';
    const ohne = c ? 'bereit' : 'gesperrt';
    return vergleiche(JSON.stringify([a, o]), JSON.stringify([[ohne, ohne, ohne, rec, str], [rec, str]]));
  });
  ok(tricasterTasten(stand({ benutzer: op, tricaster: mit({ recording: true, streaming: true }) }), 'g1').every((t) => t.state === 'bereit'), 'SC Haupttasten: TriCaster REC und STREAM sind bereit (B6), nie live');
  ok(T.tricasterHinweis === 'REC und STREAM ohne Rückmeldung', 'SC Haupttasten: Hinweis unter der TriCaster-Reihe');
  ok(atemTasten(stand({ benutzer: op, atem: mit() }), 'fremd').every((t) => t.state === 'gesperrt' && t.disabledReason !== undefined), 'SC Haupttasten: unbekannte Instanz → gesperrt mit Grund');
}

// ── SC Texte, Reinheit ──
{
  const flach = (v: unknown): string[] => {
    if (typeof v === 'string') return [v];
    if (typeof v === 'function') return flach((v as (...a: unknown[]) => unknown)('Name', 2, 3));
    return v !== null && typeof v === 'object' ? Object.values(v).flatMap(flach) : [];
  };
  const texte = flach(STUDIO_TEXTE);
  ok(texte.length > 0 && texte.every((t) => !t.includes('"')), 'SC Texte ohne ASCII-Anführungszeichen');
  const fremd = new Set([...flach(ABSCHNITT_TEXTE), ...flach(REMOTE_TEXTE), ...flach(settings.SCREEN_TEXTE), UNBEKANNT]);
  const doppelt = texte.filter((t) => fremd.has(t));
  ok(doppelt.length === 0, 'SC keine nachgebauten Texte: STUDIO_TEXTE wiederholt keinen Text aus @jm/ui und @jm/settings' + (doppelt.length ? ` (${doppelt.join(' | ')})` : ''));
  const code = ohneKommentare(leseText('src/renderer/src/lib/oberflaeche.ts'));
  ok(
    !/(?<![\w-])window\b|\blocalStorage\b|\bipcRenderer\b|\bdocument\b|from ['"]electron['"]|from ['"]@\/store/.test(code),
    'SC oberflaeche rein: lib/oberflaeche.ts ohne window, document, localStorage, IPC, Electron, Store',
  );
  ok(!/\bRANK\b|hasMinRole|['"]viewer['"]\s*[=!]==/.test(code) && /\bcanDo\(/.test(code), 'SC Rolle über canDo: oberflaeche.ts fragt nur canDo, kein Nachbau von RANK');
}

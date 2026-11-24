// UX Welle 2b, Connect c · Ableitungen (B3 ON AIR, B6, B20, B21, B22; Spec 7): Statusleiste als Kreuzprodukt je Eintrag und vor
// der ersten Antwort, ON AIR, Mangel der Zoom-Einrichtung, Haupttasten (Raum, Talkback), Halte-Knopf je Gast, „Gäste live“,
// Texte und Reinheit. Ohne window, ohne Electron. Arbeitsverzeichnis ist apps/connect; leseText liest relativ dazu.
import * as settings from '@jm/settings';
import { ABSCHNITT_TEXTE, PEERS_TEXTE, REMOTE_TEXTE } from '@jm/settings';
import { MASTER_LINK_TEXTE, UNBEKANNT, ordneStatus, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { RoomState, TalkbackMode } from '@jm/rtc/protocol';
import { onAirGuests } from '@jm/rtc/state';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import * as ndiText from '@shared/ndi-text';
import { programmAbzeichen } from '@shared/ndi-text';
import type { AppStatus, NdiProgrammLage, NdiProgrammZustand, NdiQuelleLage, ZoomAbbild, ZoomKurz, ZoomMangel, ZoomZustand } from '@shared/types';
import * as zoomText from '@shared/zoom-text';
import { BEDIEN_TEXT, gaesteZeile, ohneVorsatz, sdkZeile, slotKopfZeile, zoomZ, zoomZeile, type ZoomZ } from '@shared/zoom-text';
import {
  ABSCHNITT,
  CONNECT_TEXTE,
  fernsteuerungAbschnitt,
  gastHalten,
  kopfOnAir,
  raumTaste,
  statusLeiste,
  talkbackTaste,
  zoomMangel,
  type Haupttaste,
  type OberflaechenStand,
} from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { LAGE, ansicht, appStatus, basisMeldung, gast, ohneKommentare, raum, stand } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8737';

// ── Bausteine (appStatus, ansicht, stand, gast, raum: testzustand.ts) ──
const BASIS_KURZ: ZoomKurz = {
  zustand: 'bereit', warten: null, erlaubnis: null, slotsLaufen: 0, slotsErsatz: 0, slotsOffen: 0, slotsAn: 0, slotsGestopptEntzug: 0,
  slotKurz: [], versuch: null, maengel: [], kopieLaeuft: false, befehl: null,
};
function kurz(teil: Partial<ZoomKurz> = {}): ZoomKurz {
  return { ...BASIS_KURZ, ...teil };
}
/** Abbild mit nur den Feldern, die zoomKnoepfe und sdkZeile lesen. */
function abbild(k: ZoomKurz, fassung: string | null = '6.1.0'): ZoomAbbild {
  return {
    kurz: k,
    einrichtung: {
      sdk: { stand: 'ok', fassung, kopie: null, laden: null, text: null },
      zugang: { herkunft: 'none', clientIdEnde: null, text: null, unlesbar: false },
      anmeldung: { text: '', ton: 'ok' },
      sdkSchluessel: { herkunft: 'none' },
    },
    meldung: null,
    erneutMoeglich: false,
    pruefungLaeuft: false,
    abbauLaeuft: false,
  } as unknown as ZoomAbbild;
}
/** Eine ZoomKurz je Zeile der Tabelle Z1a–Z13 (zoomZ prüft die Zuordnung unten). */
const ZOOM_ZEILEN: Array<{ z: ZoomZ; k: ZoomKurz }> = [
  { z: 'Z1a', k: kurz({ zustand: 'einrichtung', maengel: ['sdk_fehlt'] }) },
  { z: 'Z1b', k: kurz({ zustand: 'einrichtung', maengel: ['sdk_fehlt'], kopieLaeuft: true }) },
  { z: 'Z2', k: kurz({ zustand: 'bereit' }) },
  { z: 'Z3', k: kurz({ zustand: 'startet' }) },
  { z: 'Z4', k: kurz({ zustand: 'tritt_bei' }) },
  { z: 'Z5a', k: kurz({ zustand: 'warteraum', warten: 'warteraum' }) },
  { z: 'Z5b', k: kurz({ zustand: 'warteraum', warten: 'host' }) },
  { z: 'Z6', k: kurz({ zustand: 'im_meeting', erlaubnis: 'offen' }) },
  { z: 'Z7', k: kurz({ zustand: 'im_meeting', erlaubnis: 'abgelehnt' }) },
  { z: 'Z7b', k: kurz({ zustand: 'im_meeting', erlaubnis: 'abgelehnt', slotsLaufen: 2 }) },
  { z: 'Z8', k: kurz({ zustand: 'im_meeting', erlaubnis: 'ja' }) },
  { z: 'Z9', k: kurz({ zustand: 'im_meeting', erlaubnis: 'ja', slotsLaufen: 3 }) },
  { z: 'Z9b', k: kurz({ zustand: 'im_meeting', erlaubnis: 'ja', slotsLaufen: 3, slotsErsatz: 1 }) },
  { z: 'Z10', k: kurz({ zustand: 'abriss', versuch: null }) },
  { z: 'Z11', k: kurz({ zustand: 'abriss', versuch: 2 }) },
  { z: 'Z12', k: kurz({ zustand: 'verlaesst' }) },
  { z: 'Z13', k: kurz({ zustand: 'fehler' }) },
];
const eintrag = (s: OberflaechenStand, id: string): StatusItem | undefined => statusLeiste(s).find((i) => i.id === id);
const sd = (i: StatusItem | undefined): string => (i === undefined ? 'fehlt' : `${i.state} ${i.detail ?? ''}`.trim());
const kopfOk = (i: StatusItem | undefined, id: string, group: StatusItem['group'], label: string, abschnitt?: string): string | null =>
  i === undefined
    ? 'Eintrag fehlt'
    : i.id !== id || i.group !== group || i.label !== label || i.settingsSection !== abschnitt
      ? `Kopf ${i.id}/${i.group}/${i.label}/${i.settingsSection}`
      : null;
const unbekanntOff = `off ${UNBEKANNT}`;

// ── Zuordnung der Tabelle (die Messlatte der Zoom-Fälle) ──
{
  pruefeFaelle('CN Statusleiste zoom: jede Zeile Z1a–Z13 der Testtabelle liegt auf dem Zoom-Zustand', ZOOM_ZEILEN, (f) => vergleiche(zoomZ(f.k), f.z));
}

// ── CN Statusleiste master-link ──
{
  const link = (art: string): OberflaechenStand['masterLink'] => ({ art }) as unknown as OberflaechenStand['masterLink'];
  const faelle: Array<{ m: OberflaechenStand['masterLink']; soll: string }> = [
    { m: undefined, soll: unbekanntOff },
    { m: null, soll: unbekanntOff },
    { m: link('aus'), soll: `off ${MASTER_LINK_TEXTE.aus}` },
    { m: link('sucht'), soll: `warn ${MASTER_LINK_TEXTE.sucht}` },
    { m: link('verbindet'), soll: `warn ${MASTER_LINK_TEXTE.verbindet}` },
    { m: link('ohne-client'), soll: `warn ${MASTER_LINK_TEXTE.ohneClient}` },
  ];
  pruefeFaelle('CN Statusleiste master-link: Meldung → Zustand, Gruppe verbindung, ohne Abschnitt', faelle, (f) => {
    const i = eintrag(stand({ masterLink: f.m }), 'master-link');
    return vergleiche(sd(i), f.soll) ?? kopfOk(i, 'master-link', 'verbindung', MASTER_LINK_TEXTE.label);
  });
  const ersterEintrag = statusLeiste(stand({ masterLink: link('aus') }))[0];
  ok(ersterEintrag?.id === 'master-link', 'CN Statusleiste master-link: steht in der Leiste zuerst');
}

// ── CN Statusleiste cloud-zugang ──
{
  const tonSoll = { ok: 'ok', warn: 'warn', fehler: 'error' } as const;
  const faelle = [
    { status: undefined, ton: undefined, text: undefined },
    ...kreuz({ ton: ['ok', 'warn', 'fehler'] as const, text: ['Angemeldet über den Launcher', 'Anmeldung abgelaufen', ''] }).map((f) => ({ status: true, ...f })),
  ];
  pruefeFaelle('CN Statusleiste cloud-zugang: unbekannt · ok · warn · Fehler (leerer Text = noch nicht gemeldet)', faelle, (f) => {
    const s = f.status === undefined ? stand() : stand({ status: appStatus({ cloudZugang: { text: f.text!, ton: f.ton! } }) });
    const i = eintrag(s, 'cloud-zugang');
    const soll = f.status === undefined || f.text === '' ? unbekanntOff : `${tonSoll[f.ton!]} ${f.text}`;
    return vergleiche(sd(i), soll) ?? kopfOk(i, 'cloud-zugang', 'verbindung', CONNECT_TEXTE.titel.cloud, ABSCHNITT.cloud);
  });
}

// ── CN Statusleiste raum ──
{
  const faelle = kreuz({
    room: [undefined, null, raum()] as Array<RoomState | null | undefined>,
    connected: [false, true],
    client: [false, true],
    raumabbruch: [false, true],
  });
  pruefeFaelle('CN Statusleiste raum: unbekannt · verbunden · nicht verbunden · abgebrochen', faelle, (f) => {
    const a = ansicht({ client: f.client, verbunden: f.connected, raumBekannt: f.room != null, raumabbruch: f.raumabbruch });
    const i = eintrag(stand({ room: f.room, connected: f.connected, ansicht: a }), 'raum');
    let soll: string;
    if (f.room === undefined) soll = unbekanntOff;
    else if (a.t144) soll = `error ${CONNECT_TEXTE.raum.abgebrochen}`;
    else if (f.connected) soll = `ok ${PEERS_TEXTE.alleVerbunden}`;
    else soll = `${a.gastEinladen ? 'warn' : 'off'} ${CONNECT_TEXTE.raum.nichtVerbunden}`;
    return vergleiche(sd(i), soll) ?? kopfOk(i, 'raum', 'verbindung', CONNECT_TEXTE.titel.raum);
  });
}

// ── CN Statusleiste zoom (nur Windows, Z0–Z13) ──
{
  const symbolZustand: Record<string, string> = { '●': 'ok', '△': 'warn', '◌': 'warn', '○': 'off', '✕': 'error' };
  const faelle = kreuz({ plattform: ['win32', 'darwin'], zeile: [null, ...ZOOM_ZEILEN] });
  pruefeFaelle('CN Statusleiste zoom: unbekannt · Z1a–Z13, nur Windows, Zustand wie das Symbol der Zeile, Text ohne Vorsatz', faelle, (f) => {
    const st = appStatus({ zoom: f.zeile === null ? null : f.zeile.k });
    const i = eintrag(stand({ plattform: f.plattform, status: st }), 'zoom');
    if (f.plattform !== 'win32') return i === undefined ? null : 'Eintrag unter macOS';
    if (f.zeile === null) return i === undefined ? null : 'Eintrag ohne Zoom';
    const zeile = zoomZeile(f.zeile.k)!;
    return vergleiche(sd(i), `${symbolZustand[[...zeile][0]!]} ${ohneVorsatz(zeile)}`) ?? kopfOk(i, 'zoom', 'verbindung', CONNECT_TEXTE.titel.zoom);
  });
  // Task 23 (doppeltes Symbol): Die Leiste zeigt Symbol und Namen selbst; ohneVorsatz nimmt genau „‹Symbol› Zoom: “ weg.
  pruefeFaelle('CN Statusleiste zoom: jede Zeile Z1a–Z13 beginnt mit „‹Symbol› Zoom: “, ohneVorsatz nimmt genau das weg', ZOOM_ZEILEN, (f) => {
    const zeile = zoomZeile(f.k)!;
    const vorsatz = `${[...zeile][0]!} Zoom: `;
    return zeile.startsWith(vorsatz) && symbolZustand[[...zeile][0]!] !== undefined ? vergleiche(ohneVorsatz(zeile), zeile.slice(vorsatz.length)) : `ohne Vorsatz: ${zeile}`;
  });
  gleich(sd(eintrag(stand(), 'zoom')), unbekanntOff, 'CN Statusleiste zoom: ohne Status unbekannt (nicht „kein Zoom“)');
  ok(eintrag(stand({ plattform: 'darwin' }), 'zoom') === undefined, 'CN Statusleiste zoom: unter macOS auch ohne Status kein Eintrag');
}

// ── CN Statusleiste zoom-einrichtung (B22) ──
{
  const e = eintrag(stand({ zoom: abbild(ZOOM_ZEILEN[0]!.k) }), 'zoom-einrichtung');
  gleich(e, { id: 'zoom-einrichtung', group: 'verbindung', label: CONNECT_TEXTE.titel.zoomEinrichtung, state: 'warn', detail: sdkZeile(abbild(ZOOM_ZEILEN[0]!.k)), settingsSection: ABSCHNITT.zoomEinrichtung }, 'CN Statusleiste zoom-einrichtung: warn, Text sdkZeile, Sprung zoomEinrichtung');
}

// ── CN Statusleiste programm (9 Zustände) ──
{
  const ZUSTAENDE: NdiProgrammZustand[] = ['aus', 'sucht', 'keineQuelle', 'verbunden', 'ohneBild', 'staut', 'fehler', 'neustart', 'gescheitert'];
  const soll: Record<NdiProgrammZustand, string> = {
    aus: 'off', sucht: 'warn', keineQuelle: 'warn', verbunden: 'ok', ohneBild: 'warn', staut: 'warn', fehler: 'error', neustart: 'warn', gescheitert: 'error',
  };
  const faelle = kreuz({ zustand: ['undefined', ...ZUSTAENDE] as Array<NdiProgrammZustand | 'undefined'>, plattform: ['win32', 'darwin'] });
  pruefeFaelle('CN Statusleiste programm: unbekannt · neun Zustände, Text wie das Programm-Abzeichen', faelle, (f) => {
    if (f.zustand === 'undefined') return vergleiche(sd(eintrag(stand({ plattform: f.plattform }), 'programm')), unbekanntOff);
    const lage: NdiProgrammLage = { ...LAGE, zustand: f.zustand, quelle: 'Quelle A', grund: f.zustand === 'gescheitert' ? 'absturz' : null, k: 1 };
    const i = eintrag(stand({ plattform: f.plattform, status: appStatus({ ndiProgramm: lage }) }), 'programm');
    const text = programmAbzeichen({ lage, plattform: f.plattform === 'darwin' ? 'darwin' : 'win32' }).text;
    return vergleiche(sd(i), `${soll[f.zustand]} ${text}`) ?? kopfOk(i, 'programm', 'verbindung', CONNECT_TEXTE.titel.programm);
  });
}

// ── CN Statusleiste presenter ──
{
  pruefeFaelle(
    'CN Statusleiste presenter: unbekannt · gefunden · nicht gefunden',
    [
      { s: undefined, soll: unbekanntOff },
      { s: false, soll: `off ${PEERS_TEXTE.zeileNichtGefunden}` },
      { s: true, soll: `ok ${PEERS_TEXTE.quelleGefunden}` },
    ],
    (f) => {
      const i = eintrag(stand({ status: f.s === undefined ? undefined : appStatus({ presenterLinked: f.s }) }), 'presenter');
      return vergleiche(sd(i), f.soll) ?? kopfOk(i, 'presenter', 'verbindung', CONNECT_TEXTE.titel.presenter);
    },
  );
}

// ── CN Statusleiste ndi-gaeste ──
{
  const quelle = (zustand: NdiQuelleLage['zustand'], n: number): NdiQuelleLage => ({
    schluessel: `g${n}`, art: 'kamera', label: `Quelle ${n}`, zustand, grund: zustand === 'gescheitert' ? 'absturz' : null, code: null, k: 0, empfaenger: null,
  });
  const ZS: NdiQuelleLage['zustand'][] = ['startet', 'sendet', 'ohneBild', 'neustart', 'gescheitert'];
  const mengen: NdiQuelleLage[][] = [[], ...ZS.map((z) => [quelle(z, 1)]), ...kreuz({ a: ZS, b: ZS }).map((f) => [quelle(f.a, 1), quelle(f.b, 2)])];
  const faelle = kreuz({ lagen: mengen, configured: [true, false] });
  pruefeFaelle('CN Statusleiste ndi-gaeste: Zählung je Lage (keine · starten · senden · ausgefallen), Zustand wie das Symbol, Text ohne Vorsatz', faelle, (f) => {
    const st = appStatus({ ndiGaeste: f.lagen, configured: f.configured });
    const i = eintrag(stand({ status: st }), 'ndi-gaeste');
    const zeile = gaesteZeile(st);
    const symbol = [...zeile][0]!;
    const zustand = ({ '●': 'ok', '△': 'warn', '○': 'off' } as Record<string, string>)[symbol];
    const vorsatz = `${symbol} Gäste: `;
    if (!zeile.startsWith(vorsatz) || ohneVorsatz(zeile) !== zeile.slice(vorsatz.length)) return `ohneVorsatz nimmt nicht genau „${vorsatz}“ weg: ${zeile}`;
    return vergleiche(sd(i), `${zustand} ${ohneVorsatz(zeile)}`) ?? kopfOk(i, 'ndi-gaeste', 'ausgabe', CONNECT_TEXTE.titel.ndiGaeste);
  });
  gleich(
    [ohneVorsatz('Programm: aus'), ohneVorsatz('△ Zoom:x'), ohneVorsatz('● Zoom: a · ● Zoom: b')],
    ['Programm: aus', '△ Zoom:x', 'a · ● Zoom: b'],
    'CN Statusleiste ohneVorsatz: andere Texte bleiben unverändert, weggenommen wird nur der Vorsatz am Anfang',
  );
  gleich(sd(eintrag(stand(), 'ndi-gaeste')), unbekanntOff, 'CN Statusleiste ndi-gaeste: ohne Status unbekannt');
}

// ── CN Statusleiste zoom-slots (nur Windows) ──
{
  const slot = (nr: number) => ({ nr, an: true, live: false, alarm: false, tonEin: true, modus: 'teilnehmer' as const, ziel: '', zustandWort: 'aus' });
  const faelle = kreuz({ n: [0, 2], k: [0, 1], o: [0, 1], plattform: ['win32', 'darwin'] }).filter((f) => f.k <= f.n);
  pruefeFaelle('CN Statusleiste zoom-slots: unbekannt · laufen · Ersatz · offen, nur Windows', faelle, (f) => {
    const k = kurz({
      zustand: 'im_meeting', erlaubnis: 'ja', slotsLaufen: f.n, slotsErsatz: f.k, slotsOffen: f.o, slotsAn: f.n + f.o, slotKurz: [slot(1), slot(2), slot(3)],
    });
    const i = eintrag(stand({ plattform: f.plattform, status: appStatus({ zoom: k }) }), 'zoom-slots');
    if (f.plattform !== 'win32') return i === undefined ? null : 'Eintrag unter macOS';
    const teile = [slotKopfZeile(3, f.n + f.o, f.n)];
    if (f.k > 0) teile.push(CONNECT_TEXTE.slots.ersatz(f.k));
    if (f.o > 0) teile.push(CONNECT_TEXTE.slots.offen(f.o));
    const state = f.o > 0 || f.k > 0 ? 'warn' : f.n > 0 ? 'ok' : 'off';
    return vergleiche(sd(i), `${state} ${teile.join(CONNECT_TEXTE.trenner)}`) ?? kopfOk(i, 'zoom-slots', 'ausgabe', BEDIEN_TEXT.zoomSlots);
  });
  gleich(sd(eintrag(stand(), 'zoom-slots')), unbekanntOff, 'CN Statusleiste zoom-slots: ohne Status unbekannt');
  ok(eintrag(stand({ status: appStatus({ zoom: null }) }), 'zoom-slots') === undefined, 'CN Statusleiste zoom-slots: Windows ohne Zoom-Kurzform kein Eintrag');
}

// ── CN Statusleiste fernsteuerung ──
{
  const fern: Array<{ m: FernsteuerungMeldung | null | undefined; soll: string }> = [
    { m: undefined, soll: unbekanntOff },
    { m: null, soll: unbekanntOff },
    { m: basisMeldung(), soll: `ok ${REMOTE_TEXTE.bereitVerbunden(0)}` },
    { m: basisMeldung({ clients: 3 }), soll: `ok ${REMOTE_TEXTE.bereitVerbunden(3)}` },
    { m: { laeuft: false, port: 8737, clients: 0, fehler: BELEGT }, soll: `error ${REMOTE_TEXTE.portBelegt}` },
    { m: { laeuft: false, port: 8737, clients: 0, fehler: 'kaputt' }, soll: 'error Fehler: kaputt' },
    { m: { laeuft: false, port: 8737, clients: 0 }, soll: `off ${REMOTE_TEXTE.aus}` },
  ];
  pruefeFaelle('CN Statusleiste fernsteuerung: unbekannt · bereit, n verbunden · Port belegt · Fehler, Gruppe fernsteuerung', fern, (f) => {
    const i = eintrag(stand({ fernsteuerung: f.m }), 'fernsteuerung');
    return vergleiche(sd(i), f.soll) ?? kopfOk(i, 'fernsteuerung', 'fernsteuerung', REMOTE_TEXTE.titel, ABSCHNITT.fernsteuerung);
  });
  const p = fernsteuerungAbschnitt(stand({ fernsteuerung: { laeuft: false, port: 0, clients: 2 } }));
  ok(p.port === 8737 && p.clients === undefined && p.companionModule !== undefined && p.id === ABSCHNITT.fernsteuerung, 'CN Statusleiste fernsteuerung: Port 0 → 8737, Clients nur bei laufendem Server, Abschnitt-id');
  const q = fernsteuerungAbschnitt(stand({ fernsteuerung: { laeuft: false, port: 8737, clients: 0, fehler: BELEGT } }));
  ok(q.portInUse === true && q.error === undefined, 'CN Statusleiste fernsteuerung: Port belegt nur als portInUse, nicht zugleich als Fehler');
}

// ── CN Statusleiste gaeste (Raum bei Verbindung) ──
{
  const faelle = kreuz({
    connected: [false, true],
    room: [undefined, null, raum(), raum(['approved']), raum(['lobby']), raum(['lobby', 'lobby', 'onair']), raum(['onair', 'onair']), raum(['left', 'kicked'])] as Array<RoomState | null | undefined>,
  });
  pruefeFaelle('CN Statusleiste gaeste: unbekannt · keine · n im Warteraum · n auf Sendung (live)', faelle, (f) => {
    const i = eintrag(stand({ connected: f.connected, room: f.room }), 'gaeste');
    let soll: string;
    if (!f.connected || f.room == null) soll = unbekanntOff;
    else {
      const live = onAirGuests(f.room).length;
      const lobby = f.room.guests.filter((g) => g.phase === 'lobby').length;
      const teile = [live > 0 ? CONNECT_TEXTE.gaeste.aufSendung(live) : null, lobby > 0 ? CONNECT_TEXTE.gaeste.imWarteraum(lobby) : null].filter((t): t is string => t !== null);
      soll = `${live > 0 ? 'live' : lobby > 0 ? 'warn' : 'off'} ${teile.length ? teile.join(CONNECT_TEXTE.trenner) : CONNECT_TEXTE.gaeste.keine}`;
    }
    return vergleiche(sd(i), soll) ?? kopfOk(i, 'gaeste', 'tool', CONNECT_TEXTE.titel.gaeste);
  });
}

// ── CN Gäste live: Eintrag gaeste live nur bei Gästen in onair ──
{
  const faelle = kreuz({
    connected: [false, true],
    room: [undefined, null, raum(), raum(['lobby']), raum(['approved', 'off']), raum(['onair']), raum(['approved', 'onair', 'lobby'])] as Array<RoomState | null | undefined>,
  });
  pruefeFaelle('CN Gäste live: gaeste ist live genau dann, wenn verbunden und mindestens ein Gast auf Sendung', faelle, (f) => {
    const i = eintrag(stand({ connected: f.connected, room: f.room }), 'gaeste');
    const soll = f.connected && f.room != null && onAirGuests(f.room).length > 0;
    return (i?.state === 'live') === soll ? null : `state ${i?.state} soll live ${soll}`;
  });
  const alle = statusLeiste(stand({ status: appStatus({ presenterLinked: true }), connected: true, room: raum(['onair']), fernsteuerung: basisMeldung(), zoom: abbild(ZOOM_ZEILEN[0]!.k) }));
  ok(alle.filter((i) => i.state === 'live').map((i) => i.id).join() === 'gaeste', 'CN Gäste live: kein anderer Eintrag der Leiste ist je live');
}

// ── CN Statusleiste vor erster Antwort ──
{
  const leer = statusLeiste(stand());
  ok(leer.every((i) => i.state === 'off' && i.detail === UNBEKANNT), 'CN Statusleiste vor erster Antwort: jeder Eintrag off und „unbekannt“, nie ok');
  gleich(
    leer.map((i) => i.id),
    ['master-link', 'cloud-zugang', 'raum', 'zoom', 'programm', 'presenter', 'ndi-gaeste', 'zoom-slots', 'fernsteuerung', 'gaeste'],
    'CN Statusleiste vor erster Antwort: alle zehn Einträge in der Reihenfolge der Leiste, ohne zoom-einrichtung',
  );
  gleich(leer.map((i) => i.id), ordneStatus(leer).map((i) => i.id), 'CN Statusleiste vor erster Antwort: Reihenfolge ist die Gruppenreihenfolge');
  const mac = statusLeiste(stand({ plattform: 'darwin' })).map((i) => i.id);
  gleich(mac, ['master-link', 'cloud-zugang', 'raum', 'programm', 'presenter', 'ndi-gaeste', 'fernsteuerung', 'gaeste'], 'CN Statusleiste vor erster Antwort: unter macOS ohne die Zoom-Einträge');
  ok(kopfOnAir(stand()) === undefined, 'CN Statusleiste vor erster Antwort: kein ON AIR');
  const r = raumTaste(stand(), null);
  const t = talkbackTaste(stand());
  ok(r.state === 'gesperrt' && r.disabledReason === CONNECT_TEXTE.grund.unbekannt, 'CN Statusleiste vor erster Antwort: Raum öffnen gesperrt mit Grund (Zustand unbekannt)');
  ok(t.state === 'gesperrt' && t.disabledReason === CONNECT_TEXTE.grund.raumNichtVerbunden, 'CN Statusleiste vor erster Antwort: Talkback gesperrt mit Grund');
}

// ── CN ON AIR (B3): connected × room × Raumabbruch ──
{
  const faelle = kreuz({
    connected: [false, true],
    room: [undefined, null, raum(), raum(['approved', 'lobby']), raum(['onair']), raum(['lobby', 'onair', 'off'])] as Array<RoomState | null | undefined>,
    raumabbruch: [false, true],
  });
  pruefeFaelle('CN ON AIR: nur bei connected, Raum-Zustand und mindestens einem Gast auf Sendung, sonst fehlt onAir', faelle, (f) => {
    const a = ansicht({ client: f.connected, verbunden: f.connected, raumBekannt: f.room != null, raumabbruch: f.raumabbruch });
    const s = stand({ connected: f.connected, room: f.room, ansicht: a });
    const soll = f.connected && f.room != null && onAirGuests(f.room).length > 0;
    return vergleiche(JSON.stringify(kopfOnAir(s)), JSON.stringify(soll ? { live: true } : undefined));
  });
  const live = raum(['onair']);
  ok(kopfOnAir(stand({ connected: false, room: live })) === undefined, 'CN ON AIR: ohne Verbindung nie, auch nicht mit dem letzten Stand eines Gasts auf Sendung');
  ok(kopfOnAir(stand({ connected: false, room: live, ansicht: ansicht({ raumabbruch: true, raumBekannt: true }) })) === undefined, 'CN ON AIR: nach einem Raumabbruch nie');
  gleich(kopfOnAir(stand({ connected: true, room: live })), { live: true }, 'CN ON AIR: verbunden und ein Gast auf Sendung → { live: true }');
}

// ── CN Mangel sichtbar (B22) ──
{
  const MAENGEL: ZoomMangel[][] = [[], ['sdk_fehlt'], ['sdk_defekt'], ['bridge_fehlt'], ['sdk_fehlt', 'bridge_fehlt']];
  const faelle = kreuz({ plattform: ['win32', 'darwin'], abbild: [false, true], maengel: MAENGEL, zustand: ['einrichtung', 'bereit'] as ZoomZustand[] });
  pruefeFaelle('CN Mangel sichtbar: zoomMangel nur Windows, nur mit Abbild, nur bei einrichtungOffen, Sprung zoomEinrichtung', faelle, (f) => {
    const a = f.abbild ? abbild(kurz({ zustand: f.zustand, maengel: f.maengel })) : undefined;
    const m = zoomMangel(stand({ plattform: f.plattform, zoom: a }));
    const soll = f.plattform === 'win32' && a !== undefined && f.maengel.length > 0;
    if (!soll) return m === undefined ? null : `Eintrag ohne Mangel: ${sd(m)}`;
    return vergleiche(
      JSON.stringify(m),
      JSON.stringify({ id: 'zoom-einrichtung', group: 'verbindung', label: CONNECT_TEXTE.titel.zoomEinrichtung, state: 'warn', detail: sdkZeile(a!), settingsSection: ABSCHNITT.zoomEinrichtung }),
    );
  });
  const ohne = statusLeiste(stand({ zoom: abbild(kurz({ zustand: 'bereit' })) }));
  ok(!ohne.some((i) => i.id === 'zoom-einrichtung'), 'CN Mangel sichtbar: ohne Mangel kein Eintrag in der Leiste');
  const mit = statusLeiste(stand({ zoom: abbild(kurz({ zustand: 'einrichtung', maengel: ['sdk_defekt'] })) }));
  ok(mit.some((i) => i.id === 'zoom-einrichtung' && i.state === 'warn'), 'CN Mangel sichtbar: mit Mangel steht der Eintrag in der Leiste');
}

// ── CN Haupttasten: Raum (B21, B6) ──
{
  const cloud = (configured: boolean, text: string): AppStatus => appStatus({ configured, cloudZugang: { text, ton: configured ? 'ok' : 'warn' } });
  const faelle = kreuz({
    status: [undefined, cloud(false, 'Nicht angemeldet'), cloud(false, '  '), cloud(true, 'Angemeldet')] as Array<AppStatus | undefined>,
    client: [false, true],
    raumabbruch: [false, true],
    show: [null, { room: 'Mittwoch-Plenum' }] as Array<{ room: string } | null>,
  });
  pruefeFaelle('CN Haupttasten: Raum-Taste öffnen/schließen, Beschriftung mit und ohne Show, Grund aus cloudZugang, nie live', faelle, (f) => {
    const a = ansicht({ client: f.client, verbunden: f.client, raumBekannt: f.client, raumabbruch: f.raumabbruch });
    const t = raumTaste(stand({ status: f.status, ansicht: a }), f.show);
    let soll: Haupttaste;
    if (a.raumOeffnen) {
      const label = f.show ? CONNECT_TEXTE.taste.raumMitShow(f.show.room) : CONNECT_TEXTE.taste.raumOeffnen;
      if (f.status === undefined) soll = { label, state: 'gesperrt', disabledReason: CONNECT_TEXTE.grund.unbekannt };
      else if (!f.status.configured) soll = { label, state: 'gesperrt', disabledReason: f.status.cloudZugang.text.trim() || CONNECT_TEXTE.grund.cloudZugangFehlt };
      else soll = { label, state: 'bereit' };
    } else soll = { label: CONNECT_TEXTE.taste.raumSchliessen, state: 'bereit' };
    return vergleiche(JSON.stringify(t), JSON.stringify(soll));
  });
  gleich(raumTaste(stand({ status: cloud(true, 'x') }), { room: 'Abend' }).label, 'Raum „Abend“ öffnen', 'CN Haupttasten: mit Show „Raum „‹Raum›“ öffnen“');
  gleich(raumTaste(stand({ status: cloud(true, 'x') }), null).label, 'Raum öffnen', 'CN Haupttasten: ohne Show „Raum öffnen“');
  gleich(raumTaste(stand({ status: cloud(true, 'x'), ansicht: ansicht({ client: true }) }), { room: 'Abend' }).label, 'Raum schließen', 'CN Haupttasten: mit Raum „Raum schließen“, auch mit Show');
  const g = raumTaste(stand({ status: cloud(false, '') }), null);
  ok(g.disabledReason === 'Cloud-Zugang fehlt', 'CN Haupttasten: ohne Zugangstext der Grund „Cloud-Zugang fehlt“');
}

// ── CN Haupttasten: Talkback alle (B21, B6) ──
{
  const MODI: TalkbackMode[] = ['off', 'selected', 'all'];
  const faelle = kreuz({ client: [false, true], verbunden: [false, true], modus: MODI, room: ['keiner', 'Raum'] });
  pruefeFaelle('CN Haupttasten: Talkback gehalten bereit mit „Regie spricht — alle Gäste“, ohne Raumverbindung gesperrt mit Grund', faelle, (f) => {
    const a = ansicht({ client: f.client, verbunden: f.verbunden, raumBekannt: f.room === 'Raum' });
    const r = f.room === 'Raum' ? raum([], { mode: f.modus, target: f.modus === 'selected' ? 'g1' : null }) : null;
    const t = talkbackTaste(stand({ ansicht: a, room: r, connected: f.verbunden }));
    const frei = a.wsKnoepfeBedienbar;
    const gehalten = frei && r?.talkback.mode === 'all';
    const soll: Haupttaste = frei
      ? { label: gehalten ? CONNECT_TEXTE.taste.talkbackGehalten : CONNECT_TEXTE.taste.talkback, state: 'bereit' }
      : { label: CONNECT_TEXTE.taste.talkback, state: 'gesperrt', disabledReason: CONNECT_TEXTE.grund.raumNichtVerbunden };
    return vergleiche(JSON.stringify(t), JSON.stringify(soll));
  });
  const frei = stand({ ansicht: ansicht({ client: true, verbunden: true, raumBekannt: true }), connected: true });
  gleich(talkbackTaste({ ...frei, room: raum([], { mode: 'all', target: null }) }), { label: 'Regie spricht — alle Gäste', state: 'bereit' }, 'CN Haupttasten: gehalten → „Regie spricht — alle Gäste“, bereit (B6), nie live');
  gleich(talkbackTaste({ ...frei, room: raum() }), { label: 'Talkback alle', state: 'bereit' }, 'CN Haupttasten: nicht gehalten → „Talkback alle“, bereit');
  gleich(talkbackTaste(stand()).disabledReason, 'Raum nicht verbunden', 'CN Haupttasten: Grund „Raum nicht verbunden“');
}

// ── CN Haupttasten: Halte-Knopf je Gast ──
{
  const faelle = kreuz({
    verbunden: [false, true],
    modus: ['off', 'selected', 'all'] as TalkbackMode[],
    ziel: [null, 'g1', 'g2'],
    gast: ['g1', 'g2'],
  });
  pruefeFaelle('CN Haupttasten: gastHalten aktiv nur für das gewählte Ziel bei Verbindung, gesperrt mit Grund ohne Raumverbindung', faelle, (f) => {
    const a = ansicht({ client: true, verbunden: f.verbunden, raumBekannt: true });
    const r = raum(['approved', 'approved'], { mode: f.modus, target: f.ziel });
    const h = gastHalten(stand({ ansicht: a, room: r, connected: f.verbunden }), r.guests.find((g) => g.id === f.gast)!);
    const soll = {
      aktiv: f.verbunden && f.modus === 'selected' && f.ziel === f.gast,
      ...(f.verbunden ? {} : { gesperrt: CONNECT_TEXTE.grund.raumNichtVerbunden }),
    };
    return vergleiche(JSON.stringify(h), JSON.stringify(soll));
  });
  ok(!('gesperrt' in gastHalten(stand({ ansicht: ansicht({ client: true, verbunden: true }), room: raum(['approved']) }), gast('g1', 'approved'))), 'CN Haupttasten: gastHalten bei Verbindung ohne Schlüssel gesperrt (nie leer)');
}

// ── CN Texte, Reinheit ──
{
  const flach = (v: unknown): string[] => {
    if (typeof v === 'string') return [v];
    if (typeof v === 'function') {
      try {
        return flach((v as (...a: unknown[]) => unknown)('Name', 2, 3));
      } catch {
        return [];
      }
    }
    return v !== null && typeof v === 'object' ? Object.values(v).flatMap(flach) : [];
  };
  const texte = flach(CONNECT_TEXTE);
  ok(texte.length > 0 && texte.every((t) => !t.includes('"')), 'CN Texte ohne ASCII-Anführungszeichen');
  const nurTexte = (m: Record<string, unknown>): string[] => Object.entries(m).filter(([k, v]) => /TEXT|ZEILE|TOOLTIP|FELD|NAME/i.test(k) || typeof v === 'string').flatMap(([, v]) => flach(v));
  const fremd = new Set([
    ...flach(ABSCHNITT_TEXTE),
    ...flach(REMOTE_TEXTE),
    ...flach(PEERS_TEXTE),
    ...flach(MASTER_LINK_TEXTE),
    ...flach(settings.SCREEN_TEXTE),
    ...nurTexte(ndiText as unknown as Record<string, unknown>),
    ...nurTexte(zoomText as unknown as Record<string, unknown>),
    UNBEKANNT,
  ]);
  const doppelt = texte.filter((t) => fremd.has(t));
  ok(doppelt.length === 0, 'CN keine nachgebauten Texte: CONNECT_TEXTE wiederholt keinen Text aus @jm/ui, @jm/settings, @shared/ndi-text und @shared/zoom-text' + (doppelt.length ? ` (${doppelt.join(' | ')})` : ''));
  ok(fremd.size > 200, `CN keine nachgebauten Texte: die Vergleichsmenge ist nicht leer (${fremd.size} Texte)`);
  const code = ohneKommentare(leseText('src/renderer/src/lib/oberflaeche.ts'));
  ok(
    !/(?<![\w-])window\b|\blocalStorage\b|\bipcRenderer\b|\bipc\b|\bdocument\b|from ['"]electron['"]|from ['"]@\/store/.test(code),
    'CN oberflaeche rein: lib/oberflaeche.ts ohne window, document, localStorage, IPC, Electron, Store',
  );
  // Zustandswörter des Typs (kein Text für den Bediener), auch wenn ein fremder Text gleich heißt (REMOTE_TEXTE.bereit).
  const ZUSTANDSWORTE = new Set(['bereit', 'gesperrt', 'live', 'ok', 'warn', 'error', 'off', 'win32', 'darwin', 'selected', 'all']);
  const rest = code.replace(/export const CONNECT_TEXTE = \{[\s\S]*?\n\} as const;/, '');
  ok(rest.length < code.length, 'CN keine nachgebauten Texte: der Textblock CONNECT_TEXTE ist im Quelltext gefunden');
  const literale = (rest.match(/'[^'\n]*'|`[^`\n]*`/g) ?? []).filter((t) => /\s/.test(t) || (fremd.has(t.slice(1, -1)) && !ZUSTANDSWORTE.has(t.slice(1, -1))));
  ok(literale.length === 0, 'CN keine nachgebauten Texte: außerhalb von CONNECT_TEXTE steht kein Satztext und kein Text aus den fremden Quellen im Quelltext' + (literale.length ? ` (${literale.join(' | ')})` : ''));
}

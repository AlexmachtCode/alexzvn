// Connect-Oberfläche: reine Ableitungen (UX Welle 2b, Connect c; Spec 5.1, 7.1–7.4, B3 ON AIR, B6, B20, B21, B22). Aus dem
// AppStatus des Mains, dem Raum-Zustand, der Raumverbindung (Regel V), dem Zoom-Abbild und den Meldungen von Master-Link und
// Steuerserver entstehen die Statusleiste, das ON AIR des Kopfes, der Mangel der Zoom-Einrichtung, die Haupttasten (Raum öffnen
// und schließen, Talkback alle) und der Halte-Knopf je Gast.
// Kein window, kein IPC, kein localStorage, kein Store-Import: Die Tests laufen ohne Browser. Keine Taste bekommt eine neue
// Wirkung. Texte, die es schon gibt (zoom-text, ndi-text, @jm/settings, @jm/ui), werden importiert und nie nachgebaut.
// Nur Gemessenes: `undefined` heißt „noch keine Antwort“, nie „aus“ oder „nicht verbunden“; jeder solche Eintrag liest „unbekannt“,
// und eine Haupttaste ist nie ohne Grund gesperrt.
import { PEERS_TEXTE, REMOTE_TEXTE, abschnittStatusItem, remoteControlView, type RemoteControlSectionProps } from '@jm/settings';
import { masterLinkStatusItem, ordneStatus, unbekannt, type StatusItem, type StatusState } from '@jm/ui';
import type { RoomState, Guest } from '@jm/rtc/protocol';
import { onAirGuests, lobbyCount } from '@jm/rtc/state';
import { portBelegt, STEUER_PORT, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import { programmAbzeichen } from '@shared/ndi-text';
import type { RaumAnsicht } from '@shared/raum-ansicht';
import type { AppStatus, MasterLinkMeldungZeile, NdiProgrammZustand, ZoomAbbild } from '@shared/types';
import { BEDIEN_TEXT, TRAY_NDI_TEXT, gaesteZeile, ohneVorsatz, sdkZeile, slotKopfZeile, zoomKnoepfe, zoomZ, zoomZeile, type ZoomZ } from '@shared/zoom-text';
import { ndiZahlen } from '../../../main/ndi-lage';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge (B20). */
export const ABSCHNITT = {
  fernsteuerung: 'fernsteuerung',
  cloud: 'cloud-zugang',
  zoomEinrichtung: 'zoom-einrichtung',
  zoomVorgaben: 'zoom-vorgaben',
} as const;

/**
 * Feste Texte von Connect (kein ASCII-Anführungszeichen). Texte von @jm/ui, @jm/settings, zoom-text und ndi-text stehen nicht
 * noch einmal hier: „verbunden“, „gefunden“ und „nicht gefunden“ kommen aus PEERS_TEXTE, „Zoom-Slots“ aus BEDIEN_TEXT, die Zoom-, Gäste- und Programmzeilen aus zoom-text und ndi-text.
 */
export const CONNECT_TEXTE = {
  /** Namen der Statuseinträge. */
  titel: {
    cloud: 'Cloud-Zugang',
    zoomEinrichtung: 'Zoom-Einrichtung',
    zoomVorgaben: 'Zoom-Vorgaben',
    raum: 'Raum',
    zoom: 'Zoom',
    programm: 'Programm',
    presenter: 'Presenter',
    ndiGaeste: 'Gäste (NDI)',
    gaeste: 'Gäste',
  },
  trenner: ' · ',
  raum: { nichtVerbunden: 'nicht verbunden', abgebrochen: 'abgebrochen' },
  gaeste: {
    keine: 'keine im Warteraum oder auf Sendung',
    imWarteraum: (n: number): string => `${n} im Warteraum`,
    aufSendung: (n: number): string => `${n} auf Sendung`,
  },
  slots: {
    ersatz: (k: number): string => `${k} mit Ersatzbild`,
    offen: (o: number): string => `${o} offen`,
  },
  /** Haupttasten (B21): Beschriftungen wie bisher, die Taste „Raum öffnen“ ist zugleich „Raum schließen“ (B6). */
  taste: {
    raumOeffnen: 'Raum öffnen',
    raumMitShow: (raum: string): string => `Raum „${raum}“ öffnen`,
    raumSchliessen: 'Raum schließen',
    talkback: 'Talkback alle',
    talkbackGehalten: 'Regie spricht — alle Gäste',
  },
  /** Sperrgründe der Haupttasten (B21); der Cloud-Grund kommt als Text von status.cloudZugang. */
  grund: {
    cloudZugangFehlt: 'Cloud-Zugang fehlt',
    raumNichtVerbunden: 'Raum nicht verbunden',
    unbekannt: 'Zustand unbekannt',
  },
  /**
   * Auswahlen, die sonst sofort aufs Bild gingen (Wahl ≠ Bewegung, Nachtrag Task 25): Auflösung, Ersatzbild und Bildformat eines
   * laufenden Slots und das Sprecher-Signal wirken erst mit „Setzen“ (der Knopf heißt wie PEERS_TEXTE.setzen); warum er gesperrt ist.
   */
  wahl: {
    slotUnveraendert: 'Auflösung, Ersatzbild und Bildformat sind schon so eingestellt.',
    /** Teilnehmer-Slot: „Setzen“ übernimmt auch „Person“ (Gesamtprüfung UX Welle 2b, I4); neu, für die Texttabelle. */
    slotMitPersonUnveraendert: 'Person, Auflösung, Ersatzbild und Bildformat sind schon so eingestellt.',
    /** „Setzen“ des Sprecher-Blocks übernimmt Signal und Haltezeit (I4); vorher „Das Sprecher-Signal ist schon so eingestellt.“ */
    sprecherUnveraendert: 'Sprecher-Signal und Haltezeit sind schon so eingestellt.',
    sendet: 'Wird gesendet …',
  },
} as const;

export interface OberflaechenStand {
  /** AppStatus des Mains; undefined = noch keine Antwort. */
  status: AppStatus | undefined;
  /** Raum-Zustand: undefined = noch keine Antwort, null = kein Raum-Zustand bekannt (nach dem Schließen, vor dem Öffnen). */
  room: RoomState | null | undefined;
  /** Raumverbindung (Raum-WebSocket offen). */
  connected: boolean;
  /** Regel V: was im Raum-Bereich steht und was bedienbar ist (raumAnsicht). */
  ansicht: RaumAnsicht;
  /** Zoom-Abbild (nur Windows); undefined = noch keine Antwort. */
  zoom: ZoomAbbild | undefined;
  /** `window.jmconnect.platform` (win32, darwin, …); Zoom gibt es nur unter win32. */
  plattform: string;
  /** Master-Link-Meldung: undefined = offen, null = keine Brücke. */
  masterLink: MasterLinkMeldungZeile | null | undefined;
  /** Meldung des Steuerservers (Port 8737): undefined/null = noch keine Antwort. */
  fernsteuerung: FernsteuerungMeldung | null | undefined;
}

const istWindows = (s: Pick<OberflaechenStand, 'plattform'>): boolean => s.plattform === 'win32';

// ── Fernsteuerung ──

/** Fernsteuerung: Meldung des Steuerservers (Port 8737), Einrichten nur im Launcher. */
export function fernsteuerungAbschnitt(s: Pick<OberflaechenStand, 'fernsteuerung'>): RemoteControlSectionProps {
  const m = s.fernsteuerung ?? undefined;
  // EADDRINUSE nur als portInUse: Der Fehler ginge im Abschnitt vor und verdeckte „Port belegt“.
  const belegt = portBelegt(m);
  return {
    id: ABSCHNITT.fernsteuerung,
    running: m?.laeuft,
    mode: m?.modus,
    port: m !== undefined && m.port > 0 ? m.port : STEUER_PORT,
    // Verbundene Clients zählen nur bei laufendem Server.
    clients: m?.laeuft ? m.clients : undefined,
    portInUse: belegt,
    error: m?.fehler !== undefined && !belegt ? m.fehler : undefined,
    // Der Name des Companion-Moduls ist der Name der App (Tray-Titel).
    companionModule: TRAY_NDI_TEXT.titel,
    capabilities: {},
  };
}

// ── Statusleiste ──

/** Cloud-Zugang: Ton und Text aus dem Main; ein leerer Text ist noch nicht gemeldet. */
function cloudItem(s: Pick<OberflaechenStand, 'status'>): StatusItem {
  const kopf = { id: 'cloud-zugang', group: 'verbindung', label: CONNECT_TEXTE.titel.cloud, settingsSection: ABSCHNITT.cloud } as const;
  const z = s.status?.cloudZugang;
  if (z === undefined || z.text.trim() === '') return unbekannt(kopf);
  const state: StatusState = z.ton === 'ok' ? 'ok' : z.ton === 'warn' ? 'warn' : 'error';
  return { ...kopf, state, detail: z.text };
}

/** Raum: unbekannt ohne Antwort; abgebrochen (E57), verbunden, sonst nicht verbunden (mit Client versucht Connect es weiter). */
function raumItem(s: Pick<OberflaechenStand, 'room' | 'connected' | 'ansicht'>): StatusItem {
  const kopf = { id: 'raum', group: 'verbindung', label: CONNECT_TEXTE.titel.raum } as const;
  if (s.room === undefined) return unbekannt(kopf);
  if (s.ansicht.t144) return { ...kopf, state: 'error', detail: CONNECT_TEXTE.raum.abgebrochen };
  if (s.connected) return { ...kopf, state: 'ok', detail: PEERS_TEXTE.alleVerbunden };
  return { ...kopf, state: s.ansicht.gastEinladen ? 'warn' : 'off', detail: CONNECT_TEXTE.raum.nichtVerbunden };
}

/** Zustand je Zeile Z1a–Z13 (das Symbol der Zoom-Zeile: ● ok, △ und ◌ warn, ○ off, ✕ error). */
const ZOOM_ZUSTAND: Record<Exclude<ZoomZ, 'Z0'>, StatusState> = {
  Z1a: 'warn', Z1b: 'warn', Z2: 'off', Z3: 'warn', Z4: 'warn', Z5a: 'warn', Z5b: 'warn', Z6: 'warn',
  Z7: 'warn', Z7b: 'warn', Z8: 'off', Z9: 'ok', Z9b: 'ok', Z10: 'warn', Z11: 'warn', Z12: 'warn', Z13: 'error',
};

/**
 * Zoom nur unter Windows: ohne Status unbekannt, ohne Zoom (null, Z0) kein Eintrag, sonst die Zeile aus zoom-text ohne ihren
 * Vorsatz „‹Symbol› Zoom: “ (Task 23: Symbol und Name zeigt die Leiste selbst).
 */
function zoomItems(s: Pick<OberflaechenStand, 'status' | 'plattform'>): StatusItem[] {
  if (!istWindows(s)) return [];
  const kopf = { id: 'zoom', group: 'verbindung', label: CONNECT_TEXTE.titel.zoom } as const;
  if (s.status === undefined) return [unbekannt(kopf)];
  const k = s.status.zoom;
  const zeile = zoomZeile(k);
  if (k === null || zeile === null) return [];
  return [{ ...kopf, state: ZOOM_ZUSTAND[zoomZ(k) as Exclude<ZoomZ, 'Z0'>], detail: ohneVorsatz(zeile) }];
}

/**
 * Mangel der Zoom-Einrichtung (B22): nur unter Windows, nur mit Abbild und nur, solange die Einrichtung offen ist
 * (zoomKnoepfe); der Eintrag nennt die SDK-Zeile und springt zum Abschnitt „Zoom-Einrichtung“.
 */
export function zoomMangel(s: Pick<OberflaechenStand, 'zoom' | 'plattform'>): StatusItem | undefined {
  if (!istWindows(s) || s.zoom === undefined || !zoomKnoepfe(s.zoom).einrichtungOffen) return undefined;
  return { id: 'zoom-einrichtung', group: 'verbindung', label: CONNECT_TEXTE.titel.zoomEinrichtung, state: 'warn', detail: sdkZeile(s.zoom), settingsSection: ABSCHNITT.zoomEinrichtung };
}

const PROGRAMM_ZUSTAND: Record<NdiProgrammZustand, StatusState> = {
  aus: 'off', sucht: 'warn', keineQuelle: 'warn', verbunden: 'ok', ohneBild: 'warn', staut: 'warn', fehler: 'error', neustart: 'warn', gescheitert: 'error',
};

/** Programm-Empfang: das Abzeichen (Regel P) als Text, der Zustand nach den neun Werten der Lage. */
function programmItem(s: Pick<OberflaechenStand, 'status' | 'plattform'>): StatusItem {
  const kopf = { id: 'programm', group: 'verbindung', label: CONNECT_TEXTE.titel.programm } as const;
  if (s.status === undefined) return unbekannt(kopf);
  const lage = s.status.ndiProgramm;
  return { ...kopf, state: PROGRAMM_ZUSTAND[lage.zustand], detail: programmAbzeichen({ lage, plattform: s.plattform === 'darwin' ? 'darwin' : 'win32' }).text };
}

function presenterItem(s: Pick<OberflaechenStand, 'status'>): StatusItem {
  const kopf = { id: 'presenter', group: 'verbindung', label: CONNECT_TEXTE.titel.presenter } as const;
  if (s.status === undefined) return unbekannt(kopf);
  return s.status.presenterLinked
    ? { ...kopf, state: 'ok', detail: PEERS_TEXTE.quelleGefunden }
    : { ...kopf, state: 'off', detail: PEERS_TEXTE.zeileNichtGefunden };
}

/**
 * Gast-NDI-Quellen: die Tray-Zeile (Regel R) ohne ihren Vorsatz „‹Symbol› Gäste: “ (Task 23); ausgefallen oder Cloud fehlt warn,
 * sendend ok, sonst off.
 */
function ndiGaesteItem(s: Pick<OberflaechenStand, 'status'>): StatusItem {
  const kopf = { id: 'ndi-gaeste', group: 'ausgabe', label: CONNECT_TEXTE.titel.ndiGaeste } as const;
  if (s.status === undefined) return unbekannt(kopf);
  const z = ndiZahlen(s.status.ndiGaeste);
  const state: StatusState = z.e === 0 ? (s.status.configured ? 'off' : 'warn') : z.a > 0 ? 'warn' : z.g > 0 ? 'ok' : 'off';
  return { ...kopf, state, detail: ohneVorsatz(gaesteZeile(s.status)) };
}

/** Zoom-Slots nur unter Windows und mit Zoom-Kurzform: Kopfzeile T31, dazu Ersatzbild und offene Slots. */
function zoomSlotsItems(s: Pick<OberflaechenStand, 'status' | 'plattform'>): StatusItem[] {
  if (!istWindows(s)) return [];
  const kopf = { id: 'zoom-slots', group: 'ausgabe', label: BEDIEN_TEXT.zoomSlots } as const;
  if (s.status === undefined) return [unbekannt(kopf)];
  const k = s.status.zoom;
  if (k === null) return [];
  const teile = [
    slotKopfZeile(k.slotKurz.length, k.slotsAn, k.slotsLaufen),
    ...(k.slotsErsatz > 0 ? [CONNECT_TEXTE.slots.ersatz(k.slotsErsatz)] : []),
    ...(k.slotsOffen > 0 ? [CONNECT_TEXTE.slots.offen(k.slotsOffen)] : []),
  ];
  const state: StatusState = k.slotsOffen > 0 || k.slotsErsatz > 0 ? 'warn' : k.slotsLaufen > 0 ? 'ok' : 'off';
  return [{ ...kopf, state, detail: teile.join(CONNECT_TEXTE.trenner) }];
}

/**
 * Gäste im Raum: nur bei Raumverbindung und bekanntem Raum-Zustand gemessen (sonst unbekannt). `live` genau, wenn ein Gast auf
 * Sendung ist (B3), sonst warn mit Gästen im Warteraum, sonst off.
 */
function gaesteItem(s: Pick<OberflaechenStand, 'room' | 'connected'>): StatusItem {
  const kopf = { id: 'gaeste', group: 'tool', label: CONNECT_TEXTE.titel.gaeste } as const;
  if (!s.connected || s.room === null || s.room === undefined) return unbekannt(kopf);
  const live = onAirGuests(s.room).length;
  const warte = lobbyCount(s.room);
  const teile = [...(live > 0 ? [CONNECT_TEXTE.gaeste.aufSendung(live)] : []), ...(warte > 0 ? [CONNECT_TEXTE.gaeste.imWarteraum(warte)] : [])];
  return { ...kopf, state: live > 0 ? 'live' : warte > 0 ? 'warn' : 'off', detail: teile.length > 0 ? teile.join(CONNECT_TEXTE.trenner) : CONNECT_TEXTE.gaeste.keine };
}

/**
 * Statusleiste (Spec 7): master-link, cloud-zugang, raum, zoom, zoom-einrichtung, programm, presenter, ndi-gaeste, zoom-slots,
 * fernsteuerung, gaeste; die Gruppen ordnet ordneStatus. Die Zoom-Einträge gibt es nur unter Windows.
 */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  const mangel = zoomMangel(s);
  return ordneStatus([
    masterLinkStatusItem(s.masterLink),
    cloudItem(s),
    raumItem(s),
    ...zoomItems(s),
    ...(mangel === undefined ? [] : [mangel]),
    programmItem(s),
    presenterItem(s),
    ndiGaesteItem(s),
    ...zoomSlotsItems(s),
    abschnittStatusItem(remoteControlView(fernsteuerungAbschnitt(s)), { group: 'fernsteuerung', label: REMOTE_TEXTE.titel }),
    gaesteItem(s),
  ]);
}

// ── ON AIR (B3) ──

/** ON AIR nur bei Raumverbindung, bekanntem Raum-Zustand und mindestens einem Gast auf Sendung; sonst fehlt es. */
export function kopfOnAir(s: Pick<OberflaechenStand, 'connected' | 'room'>): { live: true } | undefined {
  return s.connected && s.room !== null && s.room !== undefined && onAirGuests(s.room).length > 0 ? { live: true } : undefined;
}

// ── Haupttasten (B21, B6) ──

export interface TasteZustand {
  state: 'bereit' | 'live' | 'gesperrt';
  disabledReason?: string;
}

/** Haupttaste mit Beschriftung. */
export type Haupttaste = TasteZustand & { label: string };

/** Eine Taste: gesperrt mit dem Grund, sonst bereit. Connect meldet keine Sendung an einer Taste, nie live (B6). */
function taste(label: string, grund: string | undefined): Haupttaste {
  return grund === undefined ? { label, state: 'bereit' } : { label, state: 'gesperrt', disabledReason: grund };
}

/** Grund für „Raum öffnen“: ohne Status unbekannt, ohne Cloud-Zugang dessen Zeile (leer: „Cloud-Zugang fehlt“). */
function oeffnenGrund(status: AppStatus | undefined): string | undefined {
  if (status === undefined) return CONNECT_TEXTE.grund.unbekannt;
  if (status.configured) return undefined;
  return status.cloudZugang.text.trim() || CONNECT_TEXTE.grund.cloudZugangFehlt;
}

/**
 * Raum-Taste (B21, B6): eine Taste für „Raum öffnen“ (mit Show „Raum „‹Raum›“ öffnen“) und „Raum schließen“. Besteht kein Client,
 * steht „öffnen“ (auch nach einem Raumabbruch: öffnen meldet Connect neu an), sonst „schließen“. Öffnen ist gesperrt mit Grund,
 * solange kein Cloud-Zugang gemeldet ist; schließen hängt an keinem Status.
 */
export function raumTaste(s: Pick<OberflaechenStand, 'status' | 'ansicht'>, show: { room: string } | null): Haupttaste {
  if (!s.ansicht.raumOeffnen) return taste(CONNECT_TEXTE.taste.raumSchliessen, undefined);
  return taste(show === null ? CONNECT_TEXTE.taste.raumOeffnen : CONNECT_TEXTE.taste.raumMitShow(show.room), oeffnenGrund(s.status));
}

/** Grund, solange die Raum-WebSocket nicht bedienbar ist (Regel V). */
const raumGrund = (s: Pick<OberflaechenStand, 'ansicht'>): string | undefined => (s.ansicht.wsKnoepfeBedienbar ? undefined : CONNECT_TEXTE.grund.raumNichtVerbunden);

/** Talkback alle (B6): `bereit` mit wechselnder Beschriftung; gehalten nur bei Raumverbindung (ein alter Raum-Zustand gilt nicht). */
export function talkbackTaste(s: Pick<OberflaechenStand, 'ansicht' | 'room'>): Haupttaste {
  const grund = raumGrund(s);
  const gehalten = grund === undefined && s.room?.talkback.mode === 'all';
  return taste(gehalten ? CONNECT_TEXTE.taste.talkbackGehalten : CONNECT_TEXTE.taste.talkback, grund);
}

/** Halte-Knopf je Gast: aktiv, solange nur dieser Gast die Regie hört (nur bei Raumverbindung); gesperrt mit Grund ohne sie. */
export function gastHalten(s: Pick<OberflaechenStand, 'ansicht' | 'room'>, g: Guest): { aktiv: boolean; gesperrt?: string } {
  const grund = raumGrund(s);
  const aktiv = grund === undefined && s.room?.talkback.mode === 'selected' && s.room.talkback.target === g.id;
  return grund === undefined ? { aktiv } : { aktiv, gesperrt: grund };
}

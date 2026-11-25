// Studio-Control-Oberfläche: reine Ableitungen (UX Welle 2b, Aufgabe c; Spec 5.1, 7.1–7.4, B3 ON AIR, B6, B15, B16, B17).
// Aus den Status-Ereignissen der Geräte, dem Licht-Zustand, der Anmeldung, der Server-Meldung und den Meldungen von Master-Link
// und Steuerserver entstehen die Statusleiste, das ON AIR des Kopfes, die Sperrgründe und die Zustände der Haupttasten.
// Kein window, kein IPC, kein localStorage, kein Store- und kein Socket-Import: Die Tests laufen ohne Browser. Statusleiste und
// Panel nutzen dieselben Ableitungen (eine Wahrheit). Keine Taste bekommt eine neue Wirkung.
// Gerätezustände (Status-Ereignisse, Licht) gelten nur bei verbundenem Server als gemessen (gemeldet, Ruling Task 18).
import {
  ABSCHNITT_TEXTE,
  abschnittStatusItem,
  PEERS_TEXTE,
  REMOTE_TEXTE,
  remoteControlView,
  type RemoteControlSectionProps,
} from '@jm/settings';
import { MASTER_LINK_TEXTE, masterLinkStatusItem, ordneStatus, UNBEKANNT, unbekannt, type StatusItem, type StatusState } from '@jm/ui';
import { portBelegt, STEUER_PORT, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import { canDo, type Action, type Role } from '@shared/roles';
import type { MasterLinkMeldungZeile } from '@/sync/jms';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge. */
export const ABSCHNITT = {
  fernsteuerung: 'fernsteuerung',
} as const;

/**
 * Feste Texte von Studio-Control (kein ASCII-Anführungszeichen). Texte von @jm/ui und @jm/settings stehen nicht noch einmal
 * hier: „verbunden“, „n von m verbunden“ und „aus“ kommen aus PEERS_TEXTE und ABSCHNITT_TEXTE, „verbindet …“ aus MASTER_LINK_TEXTE.
 */
export const STUDIO_TEXTE = {
  /** ON AIR (B3): wie der Switcher, aber als eigene Texte. */
  onAirLive: 'LIVE',
  onAirRec: 'REC',
  companionModul: 'JM Studio Control',
  trenner: ' · ',
  getrennt: 'getrennt',
  benutzer: 'Benutzer',
  /** Werkzeugleiste rechts (B15): meldet ab wie bisher „Logout“ (POST /api/logout, Sitzung gelöscht). */
  abmelden: 'Abmelden',
  server: { titel: 'Server' },
  licht: { titel: 'Licht', blackout: 'Blackout (ohne Rückmeldung)' },
  /** Gerätenamen der Statuseinträge und der Sperrgründe. */
  geraet: { atem: 'ATEM', obs: 'OBS', tricaster: 'TriCaster', ptz: 'PTZ', audio: 'Audio' },
  /** Rollennamen im Kopf und in Sperrgründen (die Rolle selbst heißt im Code admin, operator, viewer). */
  rolle: { admin: 'Admin', operator: 'Bediener', viewer: 'Betrachter' } as Record<Role, string>,
  /** Haupttasten: Beschriftungen wie bisher (AtemPanel, TricasterPanel, ObsPanel, LichtPanel), ohne den alten Punkt davor. */
  taste: {
    cut: 'Cut',
    auto: 'Auto',
    ftb: 'FTB',
    rec: 'REC',
    stream: 'STREAM',
    take: 'Take',
    fadeBlack: 'Fade Black',
    aufnahme: 'Aufnahme',
    blackout: 'Blackout',
    blackoutAus: 'Blackout aus',
    /** Unter der TriCaster-Reihe: REC und STREAM schalten um, ohne dass der TriCaster antwortet (B16). */
    tricasterHinweis: 'REC und STREAM ohne Rückmeldung',
  },
  /** Sperrgründe (B16): die Rolle vor dem Gerät. */
  grund: {
    rolle: (rolle: Role): string => `Rolle ${STUDIO_TEXTE.rolle[rolle]} darf nicht schalten`,
    nichtVerbunden: (geraet: string): string => `${geraet} nicht verbunden`,
    geraetUnbekannt: (geraet: string): string => `${geraet} unbekannt`,
    abgemeldet: 'Nicht angemeldet',
    unbekannt: 'Zustand unbekannt',
  },
  /** Rollen-Auswahl im Setup (Wahl ≠ Bewegung): warum „Setzen“ gesperrt ist; der Knopf selbst heißt wie PEERS_TEXTE.setzen. */
  rollenWahl: {
    unveraendert: 'Die Rolle ist schon so eingestellt.',
    eigene: 'Du kannst deine eigene Rolle nicht ändern.',
  },
} as const;

/** Status eines Geräts, wie ihn die Status-Ereignisse melden (ATEM, OBS, TriCaster, PTZ, Audio). */
export interface GeraeteStatus {
  state: string;
  lastError?: string;
  recording?: boolean;
  streaming?: boolean;
}

/** Eingerichtete Instanzen eines Gerätetyps mit dem letzten Status je Instanz; eine Instanz ohne Eintrag hat noch nicht gemeldet. */
export interface GeraeteStand {
  ids: string[];
  status: Record<string, GeraeteStatus>;
}

export interface OberflaechenStand {
  /** Electron-Fenster (Preload da) oder Browser-Client am Socket-Server: dort fehlen Master-Link und Fernsteuerung (W2-V4). */
  umgebung: 'electron' | 'browser';
  /** Angemeldeter Benutzer; null = nicht angemeldet. */
  benutzer: { name: string; rolle: Role } | null;
  /** Server-Verbindung (Socket, nur Meldungen des aktuellen Laufs); undefined = noch keine Meldung. */
  server: boolean | undefined;
  /** Geräte je Typ; undefined = Konfiguration noch nicht geladen. */
  atem: GeraeteStand | undefined;
  obs: GeraeteStand | undefined;
  tricaster: GeraeteStand | undefined;
  ptz: GeraeteStand | undefined;
  audio: GeraeteStand | undefined;
  /** Licht: Art-Net-Node eingerichtet, Blackout gesetzt; undefined = noch keine Antwort. Es gibt keine Rückmeldung vom Node. */
  licht: { node: boolean; blackout: boolean } | undefined;
  /** Master-Link-Meldung: undefined = offen, null = keine Brücke. */
  masterLink: MasterLinkMeldungZeile | null | undefined;
  /** Meldung des Steuerservers (Port 8735): undefined/null = noch keine Antwort. */
  fernsteuerung: FernsteuerungMeldung | null | undefined;
}

// ── Server-Lauf (B15) ──

/** Meldung des Sockets mit der Lauf-Kennung seiner Verbindung. */
export interface ServerStand {
  lauf: number;
  verbunden: boolean | undefined;
}

/** Nur eine Meldung des aktuellen Sockets setzt `verbunden`; die eines anderen Laufs (alt oder fremd) ändert nichts. */
export function naechsterServerStand(s: ServerStand, e: { lauf: number; verbunden: boolean }): ServerStand {
  return e.lauf === s.lauf ? { lauf: s.lauf, verbunden: e.verbunden } : s;
}

// ── Gemessen nur mit Server (Ruling Task 18) ──

/** Gerätetypen mit Status-Ereignissen je Instanz (Statusleiste, Pillen, Sperrgründe). */
export type Geraetetyp = 'atem' | 'obs' | 'tricaster' | 'ptz' | 'audio';
const RECHT: Record<Geraetetyp, Action> = { atem: 'atem:exec', obs: 'obs:exec', tricaster: 'tricaster:exec', ptz: 'ptz:exec', audio: 'audio:exec' };

/**
 * Eine Meldung der Geräte (Status-Ereignis, Licht-Zustand) kommt über den Socket; sie gilt nur, solange der Server verbunden ist.
 * Getrennt oder vor der ersten Server-Meldung ist sie nicht gemessen (undefined): kein ON AIR, Statusleiste und Pillen „unbekannt“,
 * Haupttasten gesperrt mit Grund. Sonst bliebe die letzte Meldung („LIVE“) stehen, während der Server „getrennt“ zeigt.
 */
export function gemeldet<T>(s: Pick<OberflaechenStand, 'server'>, meldung: T | undefined): T | undefined {
  return s.server === true ? meldung : undefined;
}

/** Instanzen bleiben eingerichtet (Konfiguration), ihre Meldungen gelten ohne Server nicht. */
function gemesseneGeraete(s: Pick<OberflaechenStand, 'server'>, g: GeraeteStand | undefined): GeraeteStand | undefined {
  return g === undefined || s.server === true ? g : { ids: g.ids, status: {} };
}

/** Verbindung einer Instanz, nur gemessen mit Server: undefined, solange sie (bei verbundenem Server) nie gemeldet hat. */
export function instanzVerbunden<T extends Geraetetyp>(s: Pick<OberflaechenStand, 'server' | T>, typ: T, id: string): boolean | undefined {
  const g: GeraeteStand | undefined = s[typ];
  const m = gemeldet(s, g?.status[id]);
  return m === undefined ? undefined : m.state === 'connected';
}

/** Sperrgrund für die Bedienung einer Instanz (Haupttasten, PTZ-Halte-Knopf): Rolle zuerst, dann die gemessene Verbindung. */
export function geraetGrund<T extends Geraetetyp>(s: Pick<OberflaechenStand, 'benutzer' | 'server' | T>, typ: T, id: string): string | undefined {
  return sperrgrund(s.benutzer?.rolle, RECHT[typ], STUDIO_TEXTE.geraet[typ], instanzVerbunden(s, typ, id));
}

/**
 * Pille und Statuseintrag Licht (eine Ableitung): ohne Antwort oder ohne Server unbekannt; ohne Node „aus“; sonst nur die
 * Einstellung, der Node meldet nichts zurück: „an (ohne Rückmeldung)“ bzw. „Blackout (ohne Rückmeldung)“.
 */
export function lichtPille(s: Pick<OberflaechenStand, 'server' | 'licht'>): { state: StatusState; text: string } {
  const l = gemeldet(s, s.licht);
  if (l === undefined) return { state: 'off', text: UNBEKANNT };
  if (!l.node) return { state: 'off', text: ABSCHNITT_TEXTE.aus };
  return l.blackout ? { state: 'warn', text: STUDIO_TEXTE.licht.blackout } : { state: 'ok', text: ABSCHNITT_TEXTE.anOhneRueckmeldung };
}

// ── Geräte: Pille, Statusleiste ──

/** Pille eines Geräts (B16): connected → ok, connecting/polling → warn, down → error mit lastError, ohne Meldung unbekannt. Nie live. */
export function geraetPille(status: { state: string; lastError?: string } | undefined): { state: StatusState; text: string } {
  if (status === undefined) return { state: 'off', text: UNBEKANNT };
  switch (status.state) {
    case 'connected':
      return { state: 'ok', text: PEERS_TEXTE.alleVerbunden };
    case 'connecting':
    case 'polling':
      return { state: 'warn', text: MASTER_LINK_TEXTE.verbindet };
    case 'down': {
      const fehler = status.lastError?.trim();
      return { state: 'error', text: fehler ? fehler : STUDIO_TEXTE.getrennt };
    }
    default:
      return { state: 'off', text: UNBEKANNT };
  }
}

/**
 * Ein Eintrag je Gerätetyp, zusammengefasst über alle Instanzen (B17): alle connected → ok „verbunden“, sonst „n von m
 * verbunden“ (warn); keine verbunden, aber eine connecting/polling → warn wie die Pille; keine verbunden und keine verbindet →
 * error mit dem ersten lastError; hat keine Instanz je gemeldet → unbekannt. Ohne Instanz kein Eintrag.
 */
function geraeteItem(id: string, label: string, g: GeraeteStand | undefined): StatusItem[] {
  if (g === undefined || g.ids.length === 0) return [];
  const kopf = { id, group: 'verbindung', label } as const;
  const antworten = g.ids.flatMap((i) => (g.status[i] === undefined ? [] : [g.status[i]!]));
  if (antworten.length === 0) return [unbekannt(kopf)];
  const m = g.ids.length;
  const n = antworten.filter((a) => a.state === 'connected').length;
  if (n === m) return [{ ...kopf, state: 'ok', detail: PEERS_TEXTE.alleVerbunden }];
  if (n > 0) return [{ ...kopf, state: 'warn', detail: PEERS_TEXTE.kVonN(n, m) }];
  const verbindend = antworten.find((a) => a.state === 'connecting' || a.state === 'polling');
  if (verbindend !== undefined) return [{ ...kopf, state: geraetPille(verbindend).state, detail: geraetPille(verbindend).text }];
  const pille = geraetPille({ state: 'down', lastError: antworten.find((a) => a.lastError?.trim())?.lastError });
  return [{ ...kopf, state: pille.state, detail: pille.text }];
}

function serverItem(s: OberflaechenStand): StatusItem {
  const kopf = { id: 'server', group: 'verbindung', label: STUDIO_TEXTE.server.titel } as const;
  if (s.server === undefined) return unbekannt(kopf);
  return s.server ? { ...kopf, state: 'ok', detail: PEERS_TEXTE.alleVerbunden } : { ...kopf, state: 'error', detail: STUDIO_TEXTE.getrennt };
}

/** Licht (Art-Net): nur die Einstellung ist bekannt, der Node meldet nichts zurück; dieselbe Ableitung wie die Pille im Panel. */
function lichtItem(s: Pick<OberflaechenStand, 'server' | 'licht'>): StatusItem {
  const kopf = { id: 'licht', group: 'ausgabe', label: STUDIO_TEXTE.licht.titel } as const;
  if (gemeldet(s, s.licht) === undefined) return unbekannt(kopf);
  const p = lichtPille(s);
  return { ...kopf, state: p.state, detail: p.text };
}

function benutzerItem(b: OberflaechenStand['benutzer']): StatusItem[] {
  if (b === null) return [];
  return [{ id: 'benutzer', group: 'tool', label: STUDIO_TEXTE.benutzer, state: 'ok', detail: `${b.name}${STUDIO_TEXTE.trenner}${STUDIO_TEXTE.rolle[b.rolle]}` }];
}

/** Fernsteuerung: Meldung des Steuerservers (Port 8735), Einrichten nur im Launcher. */
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
    companionModule: STUDIO_TEXTE.companionModul,
    capabilities: {},
  };
}

/** Master-Link und Fernsteuerung gibt es nur im Electron-Fenster; im Browser fehlen auch Einstellungen (kein ⚙). */
export function mitEinstellungen(s: Pick<OberflaechenStand, 'umgebung'>): boolean {
  return s.umgebung === 'electron';
}

/**
 * Statusleiste (B17, Spec 7): master-link, server, Geräte, licht, fernsteuerung, benutzer; die Gruppen ordnet ordneStatus.
 * Geräte und Licht nur mit verbundenem Server gemessen (gemeldet), sonst „unbekannt“.
 */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  const electron = mitEinstellungen(s);
  return ordneStatus([
    ...(electron ? [masterLinkStatusItem(s.masterLink)] : []),
    serverItem(s),
    ...geraeteItem('atem', STUDIO_TEXTE.geraet.atem, gemesseneGeraete(s, s.atem)),
    ...geraeteItem('obs', STUDIO_TEXTE.geraet.obs, gemesseneGeraete(s, s.obs)),
    ...geraeteItem('tricaster', STUDIO_TEXTE.geraet.tricaster, gemesseneGeraete(s, s.tricaster)),
    ...geraeteItem('ptz', STUDIO_TEXTE.geraet.ptz, gemesseneGeraete(s, s.ptz)),
    ...geraeteItem('audio', STUDIO_TEXTE.geraet.audio, gemesseneGeraete(s, s.audio)),
    lichtItem(s),
    ...(electron ? [abschnittStatusItem(remoteControlView(fernsteuerungAbschnitt(s)), { group: 'fernsteuerung', label: REMOTE_TEXTE.titel })] : []),
    ...benutzerItem(s.benutzer),
  ]);
}

// ── ON AIR (B3) ──

const meldet = (g: GeraeteStand | undefined, was: 'streaming' | 'recording'): boolean =>
  g?.ids.some((i) => g.status[i]?.state === 'connected' && g.status[i]?.[was] === true) ?? false;

/**
 * ON AIR nur, wenn eine verbundene ATEM- oder OBS-Instanz Stream („LIVE“) oder Aufnahme („REC“) meldet und der Server verbunden
 * ist (sonst gilt keine Meldung als gemessen); sonst fehlt es.
 */
export function kopfOnAir(s: Pick<OberflaechenStand, 'server' | 'atem' | 'obs'>): { live: true; label: string } | undefined {
  const atem = gemesseneGeraete(s, s.atem);
  const obs = gemesseneGeraete(s, s.obs);
  if (meldet(atem, 'streaming') || meldet(obs, 'streaming')) return { live: true, label: STUDIO_TEXTE.onAirLive };
  if (meldet(atem, 'recording') || meldet(obs, 'recording')) return { live: true, label: STUDIO_TEXTE.onAirRec };
  return undefined;
}

// ── Sperrgründe und Haupttasten (B16) ──

/** Grund für eine gesperrte Taste: die Rolle vor dem Gerät (`verbunden` undefined = noch keine Antwort → „unbekannt“); ohne Grund ist die Taste frei. Die Rollenfrage entscheidet nur canDo. */
export function sperrgrund(rolle: Role | undefined, recht: Action, geraet: string, verbunden: boolean | undefined): string | undefined {
  if (rolle === undefined) return STUDIO_TEXTE.grund.abgemeldet;
  if (!canDo(rolle, recht)) return STUDIO_TEXTE.grund.rolle(rolle);
  if (verbunden === undefined) return STUDIO_TEXTE.grund.geraetUnbekannt(geraet);
  return verbunden ? undefined : STUDIO_TEXTE.grund.nichtVerbunden(geraet);
}

export interface TasteZustand {
  state: 'bereit' | 'live' | 'gesperrt';
  disabledReason?: string;
}

/** Haupttaste mit Beschriftung. */
export type Haupttaste = TasteZustand & { label: string };

/**
 * Eine Taste: gesperrt mit dem Grund; `live` (gemessene Sendung) behält den Grund, wenn die Rolle nicht schalten darf (O2:
 * Der Betrachter sieht die laufende Aufnahme und weiß, warum er sie nicht beenden kann).
 */
function taste(label: string, grund: string | undefined, live = false): Haupttaste {
  if (live) return grund === undefined ? { label, state: 'live' } : { label, state: 'live', disabledReason: grund };
  return grund === undefined ? { label, state: 'bereit' } : { label, state: 'gesperrt', disabledReason: grund };
}

/** Status einer verbundenen Instanz, nur mit verbundenem Server (gemeldet); sonst undefined. */
const verbundenAn = (s: Pick<OberflaechenStand, 'server'>, g: GeraeteStand | undefined, id: string): GeraeteStatus | undefined => {
  const m = gemeldet(s, g?.status[id]);
  return m?.state === 'connected' ? m : undefined;
};

/** ATEM: Cut, Auto, FTB, REC, STREAM; REC und STREAM sind live bei gemessener Sendung der verbundenen Instanz (mit Server). */
export function atemTasten(s: Pick<OberflaechenStand, 'benutzer' | 'server' | 'atem'>, id: string): Haupttaste[] {
  const T = STUDIO_TEXTE.taste;
  const st = verbundenAn(s, s.atem, id);
  const grund = geraetGrund(s, 'atem', id);
  return [taste(T.cut, grund), taste(T.auto, grund), taste(T.ftb, grund), taste(T.rec, grund, st?.recording === true), taste(T.stream, grund, st?.streaming === true)];
}

/** TriCaster: Take, Auto, Fade Black, REC, STREAM; REC und STREAM sind bereit, weil der TriCaster keine Sendung meldet (B6). */
export function tricasterTasten(s: Pick<OberflaechenStand, 'benutzer' | 'server' | 'tricaster'>, id: string): Haupttaste[] {
  const T = STUDIO_TEXTE.taste;
  const grund = geraetGrund(s, 'tricaster', id);
  return [T.take, T.auto, T.fadeBlack, T.rec, T.stream].map((label) => taste(label, grund));
}

/** OBS: Aufnahme, Stream; live bei gemessener Sendung der verbundenen Instanz (mit Server). */
export function obsTasten(s: Pick<OberflaechenStand, 'benutzer' | 'server' | 'obs'>, id: string): Haupttaste[] {
  const T = STUDIO_TEXTE.taste;
  const st = verbundenAn(s, s.obs, id);
  const grund = geraetGrund(s, 'obs', id);
  return [taste(T.aufnahme, grund, st?.recording === true), taste(T.stream, grund, st?.streaming === true)];
}

/**
 * Licht-Blackout: ohne Node bleibt die Taste weg; ohne Recht gesperrt mit dem Rollen-Grund; ohne Antwort (auch ohne
 * verbundenen Server) gesperrt mit „Zustand unbekannt“. Der Node meldet nichts zurück, deshalb nie live (B6): nur die
 * Beschriftung wechselt.
 */
export function lichtTaste(s: Pick<OberflaechenStand, 'benutzer' | 'server' | 'licht'>): Haupttaste | undefined {
  const licht = gemeldet(s, s.licht);
  if (licht !== undefined && !licht.node) return undefined;
  const grund = sperrgrund(s.benutzer?.rolle, 'lighting:exec', STUDIO_TEXTE.licht.titel, true) ?? (licht === undefined ? STUDIO_TEXTE.grund.unbekannt : undefined);
  return taste(licht?.blackout === true ? STUDIO_TEXTE.taste.blackoutAus : STUDIO_TEXTE.taste.blackout, grund);
}

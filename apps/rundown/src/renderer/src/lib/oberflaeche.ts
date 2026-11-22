// Rundown-Oberfläche: reine Ableitungen (UX Welle 1, Aufgabe c; Spec 5.1, 7.1–7.4, Anhang A „Rundown“). Aus dem Stand des
// Rundowns (RundownState, Master-Link-, Fernsteuerungs- und Verbund-Meldung) entstehen die Props der Panel-Abschnitte, die
// Statusleiste, die Zustände der Haupttasten und die Kürzel-Weiche für Eingabefelder.
// Kein window, kein IPC, kein localStorage: Die Tests laufen ohne Browser. Statusleiste und Panel nutzen dieselben
// Ableitungen (eine Wahrheit).
// Regeln: E11 Statusleiste und Gegenstellen, E12 iveo, R15 Haupttasten sperren nur wie heute, U6 Bedienlogik bleibt.
import {
  abschnittStatusItem,
  IVEO_TEXTE,
  iveoView,
  PEERS_TEXTE,
  peerZeileStatus,
  REMOTE_TEXTE,
  remoteControlView,
  type IveoSectionProps,
  type PeerRow,
  type PeersSectionProps,
  type RemoteControlSectionProps,
} from '@jm/settings';
import { masterLinkStatusItem, zahlText, type StatusItem, type StatusState } from '@jm/ui';
import { CAPABILITIES, KNOWN_ROLES } from '@/lib/capabilities';
import { portBelegt, STEUER_PORT, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { MasterLinkMeldungZeile, RundownState, ToolLink, VerbundAnzeigeZeile } from '@shared/types';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge. */
export const ABSCHNITT = {
  iveo: 'iveo',
  fernsteuerung: 'fernsteuerung',
  gegenstellen: 'gegenstellen',
} as const;

/**
 * Feste Texte des Rundowns (kein ASCII-Anführungszeichen). Die Beschriftungen der Haupttasten sind wörtlich der Bestand
 * (Transport.tsx); neu sind der Grund der gesperrten Taste und die iveo-Zustände ohne Show.
 */
export const RUNDOWN_TEXTE = {
  /** Beschriftungen der Haupttasten (Transport.tsx): wörtlich wie bisher. */
  go: 'GO',
  zurueck: '◀ Zurück',
  weiter: 'Weiter ▶',
  /** Kürzel der Tastatur-Regie (App.tsx): Leertaste = GO, Pfeil hoch = Zurück, Pfeil runter = Weiter. */
  kuerzel: { go: 'Leertaste', zurueck: '↑', weiter: '↓' },
  /** Grund der gesperrten GO-Taste: ohne scharfe Zeile (heute `disabled={!cur}` ohne Text). */
  grund: { keineZeile: 'Keine Zeile im Ablauf' },
  /** iveo (E12): Zusatz zum Status, wenn nichts eingerichtet ist; ohne Show ist das kein Fehler. */
  iveo: { keineShow: 'Keine Show', showOhneIveo: 'Show ohne iveo' },
} as const;

/** Der Rundown-Stand samt der gemessenen Meldungen; jede Meldung: undefined = noch keine Antwort, null = keine Brücke. */
export interface OberflaechenStand {
  state: RundownState;
  /** Meldung der Master-Link-Brücke: undefined = offen, null = keine Brücke (beides „unbekannt“). */
  masterLink: MasterLinkMeldungZeile | null | undefined;
  /** Meldung des Steuerservers (Port 8731): undefined/null = noch keine Antwort. */
  fernsteuerung: FernsteuerungMeldung | null | undefined;
  /** V-Zeile „Show vom Master“ für die Kopfmitte: null = Einzelplatz, undefined = offen. */
  verbund: VerbundAnzeigeZeile | null | undefined;
}

/** Aktionen des Panels, benannt nach dem heutigen Handler des Stores (`setEndpoint`; host leer = Override entfernen). */
export interface RundownAktionen {
  setEndpoint(role: string, host: string, port: number): void;
}

/** Für die Statusleiste: Die Einträge lesen nur, ein Aufruf bewirkt nichts. */
const KEINE_AKTION: RundownAktionen = { setEndpoint: () => {} };

export interface TasteZustand {
  state: 'bereit' | 'live' | 'gesperrt';
  disabledReason?: string;
}

/** Haupttaste mit Beschriftung und Kürzel (alle drei haben eines). */
export type Haupttaste = TasteZustand & { label: string; shortcut: string };

/**
 * Haupttasten (R15): GO ist ohne scharfe Zeile gesperrt, jetzt mit Grund. Zurück und Weiter sind nie gesperrt, wie heute
 * (Transport.tsx). Nie live: Der Rundown hat keine On-Air-Quelle.
 */
export function hauptTasten(s: Pick<OberflaechenStand, 'state'>): { go: Haupttaste; zurueck: Haupttaste; weiter: Haupttaste } {
  const cur = s.state.doc.rows[s.state.index];
  const T = RUNDOWN_TEXTE;
  return {
    go: {
      label: T.go,
      shortcut: T.kuerzel.go,
      ...(cur ? { state: 'bereit' as const } : { state: 'gesperrt' as const, disabledReason: T.grund.keineZeile }),
    },
    zurueck: { label: T.zurueck, shortcut: T.kuerzel.zurueck, state: 'bereit' },
    weiter: { label: T.weiter, shortcut: T.kuerzel.weiter, state: 'bereit' },
  };
}

/** Teil der Rollen-Tabelle, den die Feedback-Ableitung braucht (so ist sie ohne die volle Tabelle testbar). */
export type FeedbackTabelle = Readonly<Record<string, { feedbacks: ReadonlyArray<{ label: string; stateKey: string; match: string }> } | undefined>>;

/**
 * Wahr, wie das Protokoll es festlegt (suite-control-protocol capabilities.ts:67, Companion lib.mjs isTruthy): 'an', 'true'
 * oder eine positive ganze Zahl (Anzahl > 0, damit auch '1'). '0', leer, führende Null und Leerraum sind aus.
 */
function istWahr(v: string | undefined): boolean {
  return v === 'an' || v === 'true' || (typeof v === 'string' && /^[1-9]\d*$/.test(v));
}

/** Beschriftungen der aktiven Feedbacks einer Gegenstelle: nur `match: 'truthy'` mit wahrem Wert im letzten STATE-Push (E11). */
export function aktiveFeedbacks(link: Pick<ToolLink, 'role' | 'state'>, capabilities: FeedbackTabelle): string[] {
  const state = link.state;
  if (!state) return [];
  return (capabilities[link.role]?.feedbacks ?? []).filter((f) => f.match === 'truthy' && istWahr(state[f.stateKey])).map((f) => f.label);
}

/** iveo (E12): gebunden nur mit gemerkter Show, die eine iveo-Bindung hat; die Speakerliste kommt vom Main (gemessen). */
export function iveoAbschnitt(s: OberflaechenStand): IveoSectionProps {
  const z = s.state;
  const bound = z.showGemerkt && z.showMitIveo;
  const n = z.iveoSpeakers.length;
  return {
    id: ABSCHNITT.iveo,
    bound,
    speakerCount: bound ? n : undefined,
    // Eine Liste mit Speakern ist geliefert (ok); gebunden, aber noch leer, bleibt unbekannt, nie ok (Spec 7.2).
    delivery: bound && n > 0 ? 'ok' : undefined,
  };
}

/** Fernsteuerung: Meldung des Steuerservers, ohne Schalter und Port-Feld (fester Port 8731). */
export function fernsteuerungAbschnitt(s: OberflaechenStand): RemoteControlSectionProps {
  const m = s.fernsteuerung ?? undefined;
  // EADDRINUSE nur als portInUse: Der Fehler ginge im Abschnitt vor und verdeckte „Port belegt“.
  const belegt = portBelegt(m);
  return {
    id: ABSCHNITT.fernsteuerung,
    running: m?.laeuft,
    mode: m?.modus,
    port: m !== undefined && m.port > 0 ? m.port : STEUER_PORT,
    // Verbundene Clients zählen nur bei laufendem Server (der Abschnitt zeigt die Zahl nur bei running).
    clients: m?.laeuft ? m.clients : undefined,
    portInUse: belegt,
    error: m?.fehler !== undefined && !belegt ? m.fehler : undefined,
    capabilities: {},
  };
}

/** Eine Zeile je bekannter Rolle: Host leer = automatisch (mDNS); ein Override oder ein manueller Fund zählt als manuell. */
function peerZeile(s: OberflaechenStand, role: string): PeerRow {
  const link = s.state.links.find((l) => l.role === role);
  const override = s.state.overrides[role];
  const cap = CAPABILITIES[role];
  const manuell = override !== undefined || link?.source === 'manual';
  return {
    role,
    label: cap?.label ?? role,
    host: manuell ? (override?.host ?? link?.host ?? '') : '',
    port: override?.port ?? link?.port ?? 0,
    defaultPort: cap?.port,
    // Der Stand ist da: ein fehlender Fund heißt „nicht gefunden“, nicht „unbekannt“.
    connected: link?.connected ?? false,
    source: manuell ? 'manual' : 'mdns',
  };
}

/** Gegenstellen (E11): ersetzt das Modal ConnectionsPanel; Setzen schickt Host und Port, Auto entfernt den Override. */
export function gegenstellenAbschnitt(s: OberflaechenStand, a: RundownAktionen): PeersSectionProps {
  return {
    id: ABSCHNITT.gegenstellen,
    peers: KNOWN_ROLES.map((role) => peerZeile(s, role)),
    capabilities: { auto: true },
    onSet: (role, host, port) => a.setEndpoint(role, host, port),
    onAuto: (role) => a.setEndpoint(role, '', 0),
  };
}

/** iveo in der Statusleiste: bei ok die Zahl der Speaker, sonst steht hinter dem Status, warum nichts eingerichtet ist. */
function iveoItem(s: OberflaechenStand): StatusItem {
  const p = iveoAbschnitt(s);
  // Gebunden, aber ohne Speaker (noch nichts geliefert): kein Zusatz, es steht „unbekannt“.
  const detail = p.bound
    ? p.delivery === 'ok'
      ? `${zahlText(p.speakerCount ?? 0)} ${IVEO_TEXTE.speaker}`
      : undefined
    : s.state.showGemerkt
      ? RUNDOWN_TEXTE.iveo.showOhneIveo
      : RUNDOWN_TEXTE.iveo.keineShow;
  return abschnittStatusItem(iveoView(p), { group: 'verbindung', label: IVEO_TEXTE.titel, detail });
}

/**
 * Eine Gegenstelle als Statuseintrag (E11): verbunden → ok mit den aktiven Feedbacks als Text (ohne Feedback „verbunden“),
 * nicht verbunden → warn (nicht gefunden bzw. manuell nicht verbunden). Eine manuelle Adresse steht als „manuell: host:port“.
 */
function linkItem(link: ToolLink): StatusItem {
  const manuell = link.source === 'manual' && link.host !== '';
  const zeile = peerZeileStatus({ role: link.role, label: link.label, host: manuell ? link.host : '', port: link.port, connected: link.connected, source: link.source });
  const teile = link.connected ? [...(manuell ? [PEERS_TEXTE.quelleManuell(link.host, link.port)] : []), ...aktiveFeedbacks(link, CAPABILITIES)] : [];
  return {
    id: `link-${link.role}`,
    group: 'verbindung',
    label: link.label,
    state: zeile.state,
    detail: teile.length > 0 ? teile.join(' · ') : zeile.text,
    settingsSection: ABSCHNITT.gegenstellen,
  };
}

/** Statusleiste (E11, Anhang A): master-link, iveo, ein Eintrag je Gegenstelle, fernsteuerung. */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  return [
    masterLinkStatusItem(s.masterLink),
    iveoItem(s),
    ...s.state.links.map(linkItem),
    abschnittStatusItem(remoteControlView(fernsteuerungAbschnitt(s)), { group: 'fernsteuerung', label: REMOTE_TEXTE.titel }),
  ];
}

const VERBUND_ZUSTAND: Readonly<Record<VerbundAnzeigeZeile['farbe'], StatusState>> = {
  gruen: 'ok',
  gelb: 'warn',
  rot: 'error',
  gedaempft: 'off',
};

/** V-Zeile „Show vom Master“ als StatusPill: Farbe der Anzeige → Zustand; unbekannt → off, nie live. */
export function verbundZeileZustand(farbe: VerbundAnzeigeZeile['farbe']): StatusState {
  return Object.prototype.hasOwnProperty.call(VERBUND_ZUSTAND, farbe) ? VERBUND_ZUSTAND[farbe] : 'off';
}

/**
 * Ist das Ziel eines Tastendrucks ein Feld, in das getippt wird? Dann gehören Leertaste und Pfeile dem Feld, nicht der Regie.
 * Wie bisher INPUT, TEXTAREA und SELECT, dazu contentEditable (Felder im Einstellungs-Panel). Ein Knopf zählt nicht (O1).
 * Ohne DOM nutzbar: gelesen werden nur tagName und isContentEditable.
 */
export function istEingabeZiel(ziel: EventTarget | null): boolean {
  if (ziel === null) return false;
  const t = ziel as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof t.tagName === 'string' ? t.tagName.toUpperCase() : '';
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable === true;
}

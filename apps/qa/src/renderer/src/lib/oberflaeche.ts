// Q&A-Oberfläche: reine Ableitungen (UX Welle 1, Aufgabe c; Spec 5.1, 7.1–7.4, Anhang A „Q&A“). Aus dem Stand von Q&A
// (QaState, Master-Link- und Fernsteuerungs-Meldung) entstehen die Props der Panel-Abschnitte, die Statusleiste, die
// Zustände der Haupttasten und die Zählung „wartend“.
// Kein window, kein IPC, kein localStorage: Die Tests laufen ohne Browser. Statusleiste und Panel nutzen dieselben
// Ableitungen (eine Wahrheit). Die Statusleiste rechnet nur aus dem Store: `qa:links` kommt bis zehnmal je Sekunde.
// Regeln: E8 On-Air, E13 Kopf und Kopplung, E14 Extern, E15 „Nächste“, U6 Bedienlogik bleibt. Die Zugangstexte Q1–Q12
// stehen nicht hier: Die Zeile kommt wörtlich aus dem Main (`cloud.zugang.zeile`).
import {
  ABSCHNITT_TEXTE,
  abschnittStatusItem,
  IVEO_TEXTE,
  PEERS_TEXTE,
  peerZeileStatus,
  REMOTE_TEXTE,
  remoteControlView,
  type PeerRow,
  type PeersSectionProps,
  type RemoteControlSectionProps,
} from '@jm/settings';
import { masterLinkStatusItem, zahlText, type StatusItem } from '@jm/ui';
import { CAPABILITIES, COUPLED_ROLES, roleLabel } from '@/lib/capabilities';
import { portBelegt, STEUER_PORT, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { MasterLinkMeldungZeile, QaState } from '@shared/types';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge. */
export const ABSCHNITT = {
  fernsteuerung: 'fernsteuerung',
  gegenstellen: 'gegenstellen',
  redezeit: 'redezeit',
  moderation: 'moderation',
  extern: 'extern',
} as const;

/**
 * Feste Texte von Q&A (kein ASCII-Anführungszeichen). Die Beschriftungen der Haupttasten sind wörtlich der Bestand
 * (ActivePanel.tsx, RemotePanel.tsx); neu sind der Grund der gesperrten Taste und die Kurztexte des Extern-Eintrags.
 * Zugangstexte (Q1–Q12) stehen nicht hier, sondern kommen vom Main.
 */
export const QA_TEXTE = {
  /** Kopf (App.tsx:33): „N wartend“. */
  wartend: 'wartend',
  /** Beschriftungen der Haupttasten (ActivePanel.tsx): wörtlich wie bisher. */
  naechste: 'Nächste ▶',
  beenden: '■ Beenden',
  /** Grund der gesperrten Beenden-Taste: ohne Sprecher am Wort (Wortlaut aus ActivePanel.tsx „Niemand am Wort“). */
  grund: { niemandAmWort: 'Niemand am Wort' },
  /** Saal-Einreichung (RemotePanel.tsx): Titel und Schalter-Wörter wie bisher; „kein Netzwerk“ steht dort bei fehlender Adresse. */
  saal: {
    titel: 'Saal-Einreichung',
    labelAn: 'Saal-Einreichung ◉ An',
    labelAus: 'Saal-Einreichung ○ Aus',
    keinNetzwerk: 'kein Netzwerk',
  },
  /** Extern in der Statusleiste: Titel wie der Panel-Abschnitt (E14); „aus“, „bereit“ und „nicht eingerichtet“ kommen aus @jm/settings. */
  extern: { titel: 'Extern', an: 'an' },
  /** Gegenstellen im Panel: „gefunden:“ steht vor der gemessenen Adresse eines mDNS-Fundes. */
  gegenstellen: { gefunden: 'gefunden:' },
} as const;

/** Der Q&A-Stand samt der gemessenen Meldungen; jede Meldung: undefined = noch keine Antwort, null = keine Brücke. */
export interface OberflaechenStand {
  state: QaState;
  /** Meldung der Master-Link-Brücke: undefined = offen, null = keine Brücke (beides „unbekannt“). */
  masterLink: MasterLinkMeldungZeile | null | undefined;
  /** Meldung des Steuerservers (Port 8733): undefined/null = noch keine Antwort. */
  fernsteuerung: FernsteuerungMeldung | null | undefined;
}

/** Aktionen des Panels, benannt nach dem heutigen Handler des Stores (`setEndpoint`; host leer = Override entfernen). */
export interface QaAktionen {
  setEndpoint(role: string, host: string, port: number): void;
}

export interface TasteZustand {
  state: 'bereit' | 'live' | 'gesperrt';
  disabledReason?: string;
}

/** Haupttaste mit Beschriftung. */
export type Haupttaste = TasteZustand & { label: string };

/**
 * Haupttasten (E15): „Nächste ▶“ ist nie gesperrt, wie heute; bei leerer Warteschlange beendet sie den Sprecher (Befund 2 der
 * Funktionsliste). „■ Beenden“ ist ohne Sprecher gesperrt, mit Grund. Die Saal-Taste wechselt die Beschriftung und ist nie
 * gesperrt. Nie live: Die On-Air-Quelle ist der Kopf (onAirKopf).
 */
export function hauptTasten(s: Pick<OberflaechenStand, 'state'>): { naechste: Haupttaste; beenden: Haupttaste; saal: Haupttaste } {
  const T = QA_TEXTE;
  const amWort = s.state.activeId !== null;
  return {
    naechste: { label: T.naechste, state: 'bereit' },
    beenden: amWort ? { label: T.beenden, state: 'bereit' } : { label: T.beenden, state: 'gesperrt', disabledReason: T.grund.niemandAmWort },
    saal: { label: s.state.remote.running ? T.saal.labelAn : T.saal.labelAus, state: 'bereit' },
  };
}

/** On-Air im Kopf (E8): live, solange jemand am Wort ist. */
export function onAirKopf(s: Pick<OberflaechenStand, 'state'>): { live: boolean } {
  return { live: !!s.state.activeId };
}

/** Kopfmitte (E13): „N wartend“, Zählung wie heute (App.tsx:27): jeder Eintrag mit Status waiting, auch unfreigegebene (Befund 1). */
export function wartendText(s: Pick<OberflaechenStand, 'state'>): string {
  const n = s.state.entries.filter((e) => e.status === 'waiting').length;
  return `${n} ${QA_TEXTE.wartend}`;
}

/** Fernsteuerung: Meldung des Steuerservers, ohne Schalter und Port-Feld (fester Port 8733). */
export function fernsteuerungAbschnitt(s: Pick<OberflaechenStand, 'fernsteuerung'>): RemoteControlSectionProps {
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

/** Eine Zeile je gekoppelter Rolle: Host leer = automatisch (mDNS); ein Override oder ein manueller Fund zählt als manuell. */
function peerZeile(s: Pick<OberflaechenStand, 'state'>, role: string): PeerRow {
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
    // Ohne Fund und ohne Override gibt es keine Quelle: sonst stünde „Quelle gefunden“ bei einem Tool, das nie gefunden wurde.
    source: manuell ? 'manual' : link ? 'mdns' : undefined,
  };
}

/** Gegenstellen (E13): ersetzt das Modal ConnectionsPanel; Setzen schickt Host und Port, Auto entfernt den Override. */
export function gegenstellenAbschnitt(s: Pick<OberflaechenStand, 'state'>, a: QaAktionen): PeersSectionProps {
  return {
    id: ABSCHNITT.gegenstellen,
    peers: COUPLED_ROLES.map((role) => peerZeile(s, role)),
    capabilities: { auto: true },
    onSet: (role, host, port) => a.setEndpoint(role, host, port),
    onAuto: (role) => a.setEndpoint(role, '', 0),
  };
}

/** Per mDNS gefundene Tools mit ihrer Adresse für das Panel (manuelle stehen schon als Quelle in der Zeile; nie ins Host-Feld, das wäre ein Override). */
export function gefundeneAdressen(s: Pick<OberflaechenStand, 'state'>): Array<{ role: string; label: string; text: string }> {
  return s.state.links
    .filter((l) => COUPLED_ROLES.includes(l.role) && l.source !== 'manual' && l.host !== '')
    .map((l) => ({ role: l.role, label: l.label, text: `${QA_TEXTE.gegenstellen.gefunden} ${l.host}:${zahlText(l.port)}` }));
}

/**
 * Kopplung zu Timer oder Titler (E13), dreifarbig und nie grün ohne Gegenstelle: Schalter aus (`autoTimer`/`autoTitler` aus
 * `state.config`, dem wirksamen Wert aller drei Wege) = off; an, aber nicht verbunden = warn; verbunden = ok mit `host:port`.
 * Texte der Zeile kommen aus `peerZeileStatus` (@jm/settings), nicht von hier.
 */
export function kopplungStatus(rolle: 'timer' | 'titler', s: Pick<OberflaechenStand, 'state'>): StatusItem {
  const an = rolle === 'timer' ? s.state.config.autoTimer : s.state.config.autoTitler;
  const link = s.state.links.find((l) => l.role === rolle);
  const manuell = link?.source === 'manual' && link.host !== '';
  const zeile = peerZeileStatus({
    role: rolle,
    label: roleLabel(rolle),
    host: manuell ? link.host : '',
    port: link?.port ?? 0,
    connected: link?.connected ?? false,
    source: link?.source,
    enabled: an,
  });
  // Die gemessene Adresse steht nur bei einer Verbindung (sonst wäre „ok“ oder eine Adresse ohne Gegenstelle gelogen).
  const adresse = link?.connected && link.host !== '' ? (manuell ? PEERS_TEXTE.quelleManuell(link.host, link.port) : `${link.host}:${zahlText(link.port)}`) : undefined;
  return {
    id: `kopplung-${rolle}`,
    group: 'verbindung',
    label: roleLabel(rolle),
    state: zeile.state,
    detail: zeile.state === 'ok' && adresse ? adresse : zeile.text,
    settingsSection: ABSCHNITT.redezeit,
  };
}

/**
 * Extern (E14) aus `state.cloud`. Zustände: aus = off („aus“ bzw. „bereit“, wenn eingerichtet); an und eingerichtet =
 * Ton der Zugangszeile (ok → ok, warn → warn, fehler → error); an, aber nicht eingerichtet = warn; `lastError` bei „an“ = error.
 * Die Zugangszeile kommt wörtlich vom Main, es entstehen keine Zugangstexte. Gelesen werden nur enabled, configured,
 * zugang.zeile, zugang.ton und lastError: nie Freigabe, Token, Presse-Code oder Event-ID.
 */
export function externStatus(s: Pick<OberflaechenStand, 'state'>): StatusItem {
  const c = s.state.cloud;
  const kopf = { id: 'extern', group: 'verbindung', label: QA_TEXTE.extern.titel, settingsSection: ABSCHNITT.extern } as const;
  const zeile = c.zugang.zeile;
  const mitZeile = (kurz: string): string => (zeile !== '' ? `${kurz} · ${zeile}` : kurz);
  if (!c.enabled) return { ...kopf, state: 'off', detail: mitZeile(c.configured ? REMOTE_TEXTE.bereit : ABSCHNITT_TEXTE.aus) };
  if (c.lastError) return { ...kopf, state: 'error', detail: c.lastError };
  if (!c.configured) return { ...kopf, state: 'warn', detail: mitZeile(IVEO_TEXTE.nichtEingerichtet) };
  const ton = { ok: 'ok', warn: 'warn', fehler: 'error' } as const;
  return { ...kopf, state: ton[c.zugang.ton], detail: mitZeile(QA_TEXTE.extern.an) };
}

/** Saal-Einreichung (state.remote): aus = off; an = ok mit der ersten Adresse; an ohne Adresse = warn „kein Netzwerk“. */
function saalItem(s: Pick<OberflaechenStand, 'state'>): StatusItem {
  const r = s.state.remote;
  const kopf = { id: 'saal', group: 'tool', label: QA_TEXTE.saal.titel } as const;
  if (!r.running) return { ...kopf, state: 'off', detail: ABSCHNITT_TEXTE.aus };
  const erste = r.urls[0];
  return erste ? { ...kopf, state: 'ok', detail: erste } : { ...kopf, state: 'warn', detail: QA_TEXTE.saal.keinNetzwerk };
}

/** Statusleiste (Anhang A): master-link, extern, kopplung-timer, kopplung-titler, fernsteuerung, saal. */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  return [
    masterLinkStatusItem(s.masterLink),
    externStatus(s),
    kopplungStatus('timer', s),
    kopplungStatus('titler', s),
    abschnittStatusItem(remoteControlView(fernsteuerungAbschnitt(s)), { group: 'fernsteuerung', label: REMOTE_TEXTE.titel }),
    saalItem(s),
  ];
}

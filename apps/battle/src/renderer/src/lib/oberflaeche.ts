// Battle-Oberfläche: reine Ableitungen (UX Welle 1, Aufgabe c; Spec 5.1, 7.1–7.4, Anhang A „Battle“). Aus dem Stand von Battle
// (BattleState, Master-Link- und Fernsteuerungs-Meldung) entstehen die Props der Panel-Abschnitte, die Statusleiste und die
// Zustände der vier Haupttasten.
// Kein window, kein IPC, kein localStorage: Die Tests laufen ohne Browser. Statusleiste und Panel nutzen dieselben
// Ableitungen (eine Wahrheit). Regeln: E8 On-Air, E16 VS nie gesperrt, U6 Bedienlogik bleibt.
import {
  ABSCHNITT_TEXTE,
  abschnittStatusItem,
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
import type { BattleConfig, BattleState, MasterLinkMeldungZeile, Side, ToolLink } from '@shared/types';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge. */
export const ABSCHNITT = {
  fernsteuerung: 'fernsteuerung',
  gegenstellen: 'gegenstellen',
  battle: 'battle',
  replay: 'replay',
  zuruecksetzen: 'zuruecksetzen',
} as const;

/**
 * Feste Texte von Battle (kein ASCII-Anführungszeichen). Wörtlich der Bestand: die Voting-Beschriftungen (RemotePanel.tsx),
 * die Clip-Beschriftung (ClipPanel.tsx), „kein Netzwerk“, „Instant-Replay“, „Publikums-Voting“, die VS-Wörter (App.tsx).
 * Neu sind die Gründe der gesperrten Tasten, der Titler-Hinweis unter dem VS-Knopf (E16) und die Kurztexte der Statuseinträge.
 */
export const BATTLE_TEXTE = {
  /** Titel der tool-eigenen Panel-Abschnitte (Anhang A „Battle“, E16). */
  titel: { battle: 'Battle', replay: 'Instant-Replay', zuruecksetzen: 'Zurücksetzen' },
  /** Voting-Taste und -Eintrag (RemotePanel.tsx): Beschriftung wörtlich, Runde in Klammern. */
  voting: {
    titel: 'Publikums-Voting',
    oeffnen: (runde: number): string => `Voting öffnen (Runde ${zahlText(runde)})`,
    schliessen: (runde: number): string => `Voting offen (Runde ${zahlText(runde)}) — schließen`,
    serverAus: 'Voting-Server ist aus',
    abgeschaltet: 'Publikums-Voting ist abgeschaltet',
    geschlossen: (runde: number): string => `geschlossen (Runde ${zahlText(runde)})`,
    offen: (runde: number): string => `offen (Runde ${zahlText(runde)})`,
    keinNetzwerk: 'kein Netzwerk',
  },
  /**
   * Replay-Taste: Beschriftung wörtlich wie ClipPanel.tsx (auch „schneidet …“, solange ein Clip läuft); die Gründe sind neu.
   * Die Quelle- und Ziel-Texte sind die des alten Clip-Kastens, wörtlich.
   */
  replay: {
    label: (sekunden: number): string => `⧉ Clip (letzte ${zahlText(sekunden)}s)`,
    schneidet: 'schneidet …',
    keineQuelle: 'keine Aufnahme-Quelle',
    laeuft: 'Clip läuft',
    keineQuelleGewaehlt: 'keine Quelle gewählt',
    zielLabel: 'Zielordner',
    zielStandard: 'Standard (Videos/JM Battle Clips)',
  },
  /** Runde im Kopf (App.tsx, wörtlich): „Runde 2/3“. */
  runde: (aktuell: number, gesamt: number): string => `Runde ${zahlText(aktuell)}/${zahlText(gesamt)}`,
  /** Gegenstellen: der erste Satz des alten Erklärtexts im Modal (ConnectionsPanel.tsx, wörtlich); den Rest sagt PEERS_TEXTE.erklaerung. */
  gegenstellen: { erklaerung: 'Battle blendet die VS-Bauchbinde über den JM Titler ein.', gefunden: 'gefunden:' },
  /** Abschnitt „Zurücksetzen“ (E16): Beschriftung wie Settings.tsx; die Rückfrage nennt zusätzlich, dass ein laufendes VS ausgeht. */
  zuruecksetzen: {
    knopf: 'Battle zurücksetzen',
    frage: 'Battle zurücksetzen? Runden/Stimmen werden geleert (Namen bleiben). Ein laufendes VS geht aus.',
  },
  /** Beschriftung der Haupttaste „Nächste Runde“ (im Scoreboard steht heute nur ▶). */
  naechste: 'Nächste Runde ▶',
  /** VS-Taste (App.tsx, wörtlich). */
  vs: { an: '● VS on air', aus: '○ VS einblenden' },
  /** Hinweis unter dem VS-Knopf, wenn VS den Titler ansteuern soll (autoTitler an), der aber nicht verbunden ist (E16). */
  vsHinweis: 'Titler nicht verbunden: VS wird gesetzt, die Bauchbinde erscheint aber nicht.',
  /** Statuseintrag „Aufnahme-Quelle“. */
  aufnahme: { titel: 'Aufnahme-Quelle', fehlt: 'fehlt' },
} as const;

/** Der Battle-Stand samt der gemessenen Meldungen; jede Meldung: undefined = noch keine Antwort, null = keine Brücke. */
export interface OberflaechenStand {
  state: BattleState;
  /** Meldung der Master-Link-Brücke: undefined = offen, null = keine Brücke (beides „unbekannt“). */
  masterLink: MasterLinkMeldungZeile | null | undefined;
  /** Meldung des Steuerservers (Port 8734): undefined/null = noch keine Antwort. */
  fernsteuerung: FernsteuerungMeldung | null | undefined;
}

/** Aktionen des Panels, benannt nach dem heutigen Handler des Stores (`setEndpoint`; host leer = Override entfernen). */
export interface BattleAktionen {
  setEndpoint(role: string, host: string, port: number): void;
}

export interface TasteZustand {
  state: 'bereit' | 'live' | 'gesperrt';
  disabledReason?: string;
}

/** On-Air im Kopf (E8): live, solange die VS-Bauchbinde on air ist. */
export function onAirKopf(s: Pick<OberflaechenStand, 'state'>): { live: boolean } {
  return { live: s.state.live };
}

/** Dateiname ohne Ordner (beide Trenner); ein Pfad mit Schlusstrenner liefert den letzten Ordnernamen. */
function dateiName(pfad: string): string {
  const teile = pfad.split(/[\\/]/).filter((t) => t !== '');
  return teile[teile.length - 1] ?? pfad;
}

/**
 * Voting-Taste nach den Bedingungen von heute (RemotePanel.tsx): Ohne laufenden Server fehlt die Taste ganz, ohne
 * `votingEnabled` ist sie disabled. Die neue Taste bleibt stehen und ist in beiden Fällen gesperrt, mit Grund (Abbildung
 * „ausgeblendet“ → „gesperrt mit Grund“); der äußere Fall, der Server, geht vor.
 */
function votingTaste(s: Pick<OberflaechenStand, 'state'>): TasteZustand & { label: string } {
  const T = BATTLE_TEXTE.voting;
  const { state } = s;
  const label = state.votingOpen ? T.schliessen(state.round) : T.oeffnen(state.round);
  if (!state.remote.running) return { label, state: 'gesperrt', disabledReason: T.serverAus };
  if (!state.config.votingEnabled) return { label, state: 'gesperrt', disabledReason: T.abgeschaltet };
  return { label, state: 'bereit' };
}

/**
 * Haupttasten (E16). VS ist nie gesperrt und live, solange VS on air ist; fehlt der Titler, warnt vsHinweis, die Taste bleibt.
 * Voting wechselt die Beschriftung und sperrt wie heute. „Nächste Runde“ ist nie gesperrt: Heute ist ▶ nie disabled
 * (Scoreboard.tsx) und der Main klemmt die Runde (doGotoRound). Replay ist ohne Aufnahme-Quelle und während eines Clips
 * gesperrt (wie ClipPanel.tsx, `disabled={!recordingPath || running}`).
 */
export function hauptTasten(s: Pick<OberflaechenStand, 'state'>): {
  vs: TasteZustand;
  voting: TasteZustand & { label: string };
  naechste: TasteZustand;
  replay: TasteZustand;
} {
  const T = BATTLE_TEXTE.replay;
  const { state } = s;
  const schneidet = state.clips.some((c) => c.status === 'running');
  const replay: TasteZustand = !state.config.recordingPath
    ? { state: 'gesperrt', disabledReason: T.keineQuelle }
    : schneidet
      ? { state: 'gesperrt', disabledReason: T.laeuft }
      : { state: 'bereit' };
  return {
    vs: { state: state.live ? 'live' : 'bereit' },
    voting: votingTaste(s),
    naechste: { state: 'bereit' },
    replay,
  };
}

function titlerLink(s: Pick<OberflaechenStand, 'state'>): ToolLink | undefined {
  return s.state.links.find((l) => l.role === 'titler');
}

/** Hinweis unter dem VS-Knopf (E16): nur bei `autoTitler` an und nicht verbundenem Titler, sonst keiner. */
export function vsHinweis(s: Pick<OberflaechenStand, 'state'>): string | undefined {
  return s.state.config.autoTitler && !titlerLink(s)?.connected ? BATTLE_TEXTE.vsHinweis : undefined;
}

/** Fernsteuerung: Meldung des Steuerservers, ohne Schalter und Port-Feld (fester Port 8734). */
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
    // Nie ein Fund im Host-Feld: Das wäre ein Override.
    host: manuell ? (override?.host ?? link?.host ?? '') : '',
    port: override?.port ?? link?.port ?? 0,
    defaultPort: cap?.port,
    // Der Stand ist da: ein fehlender Fund heißt „nicht gefunden“, nicht „unbekannt“.
    connected: link?.connected ?? false,
    // Ohne Fund und ohne Override gibt es keine Quelle: sonst stünde „gefunden“ bei einem Tool, das nie gefunden wurde.
    source: manuell ? 'manual' : link ? 'mdns' : undefined,
  };
}

/** Gegenstellen: ersetzt das Modal ConnectionsPanel; Setzen schickt Host und Port, Auto entfernt den Override. */
export function gegenstellenAbschnitt(s: Pick<OberflaechenStand, 'state'>, a: BattleAktionen): PeersSectionProps {
  return {
    id: ABSCHNITT.gegenstellen,
    peers: COUPLED_ROLES.map((role) => peerZeile(s, role)),
    capabilities: { auto: true },
    onSet: (role, host, port) => a.setEndpoint(role, host, port),
    onAuto: (role) => a.setEndpoint(role, '', 0),
  };
}

/**
 * Titler-Kopplung (E16), dreifarbig und nie grün ohne Gegenstelle: `autoTitler` aus = off; an, aber nicht verbunden = warn;
 * verbunden = ok mit `host:port`. Die Zeilentexte kommen aus `peerZeileStatus` (@jm/settings), nicht von hier.
 */
export function titlerStatus(s: Pick<OberflaechenStand, 'state'>): StatusItem {
  const an = s.state.config.autoTitler;
  const link = titlerLink(s);
  const manuell = link?.source === 'manual' && link.host !== '';
  const zeile = peerZeileStatus({
    role: 'titler',
    label: roleLabel('titler'),
    host: manuell ? link.host : '',
    port: link?.port ?? 0,
    connected: link?.connected ?? false,
    source: link?.source,
    enabled: an,
  });
  // Gemessen ist die Adresse eines Fundes: verbunden steht sie allein (ok), gefunden aber nicht verbunden vor dem Zeilentext
  // (warn, nie ok). Manuell nennt der Zeilentext die Adresse schon; ohne Fund und bei „aus“ gibt es keine.
  const adresse = link && link.host !== '' ? `${link.host}:${zahlText(link.port)}` : undefined;
  const detail = !an
    ? zeile.text
    : link?.connected
      ? manuell
        ? PEERS_TEXTE.quelleManuell(link.host, link.port)
        : (adresse ?? zeile.text)
      : link?.source === 'mdns' && adresse
        ? `${adresse} · ${zeile.text}`
        : zeile.text;
  return { id: 'titler', group: 'verbindung', label: roleLabel('titler'), state: zeile.state, detail, settingsSection: ABSCHNITT.gegenstellen };
}

/**
 * Voting (state.remote, config.votingEnabled, state.votingOpen) im Gleichschritt mit der Sperre der Taste: Server aus = off
 * (die Runde spielt keine Rolle); Server an, aber `votingEnabled` aus = off „abgeschaltet“; läuft der Server ohne Adresse
 * (kein Netzwerk), warn, denn das Publikum kommt nicht heran; sonst ok mit „geschlossen“ bzw. „offen“ und der Runde. Auch
 * „geschlossen“ ist ok: Der Server läuft und das Voting ist bereit, die Runde ist nur noch nicht geöffnet.
 */
function votingItem(s: Pick<OberflaechenStand, 'state'>): StatusItem {
  const T = BATTLE_TEXTE.voting;
  const { state } = s;
  const kopf = { id: 'voting', group: 'tool', label: T.titel, settingsSection: ABSCHNITT.battle } as const;
  if (!state.remote.running) return { ...kopf, state: 'off', detail: ABSCHNITT_TEXTE.aus };
  if (!state.config.votingEnabled) return { ...kopf, state: 'off', detail: T.abgeschaltet };
  if (state.remote.urls.length === 0) return { ...kopf, state: 'warn', detail: T.keinNetzwerk };
  return { ...kopf, state: 'ok', detail: state.votingOpen ? T.offen(state.round) : T.geschlossen(state.round) };
}

/**
 * Aufnahme-Quelle (config.recordingPath): leer = warn „fehlt“ (der Clip-Knopf ist dann gesperrt); gesetzt = ok mit dem
 * Dateinamen allein. Der volle Pfad bleibt draußen: Er ist lang und die Leiste hat wenig Platz, der Name sagt, welche Aufnahme
 * gemeint ist (wie ClipPanel.tsx, das auch nur den Namen zeigt). Gemessen ist nur die Einstellung, nicht die Datei; darum steht
 * kein Wort wie „bereit“ dabei.
 */
function aufnahmeItem(s: Pick<OberflaechenStand, 'state'>): StatusItem {
  const pfad = s.state.config.recordingPath;
  const kopf = { id: 'aufnahme-quelle', group: 'tool', label: BATTLE_TEXTE.aufnahme.titel, settingsSection: ABSCHNITT.replay } as const;
  return pfad === '' ? { ...kopf, state: 'warn', detail: BATTLE_TEXTE.aufnahme.fehlt } : { ...kopf, state: 'ok', detail: dateiName(pfad) };
}

/** Statusleiste (Anhang A), schon in Gruppenfolge: master-link, titler (verbindung), fernsteuerung, voting, aufnahme-quelle (tool). */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  return [
    masterLinkStatusItem(s.masterLink),
    titlerStatus(s),
    abschnittStatusItem(remoteControlView(fernsteuerungAbschnitt(s)), { group: 'fernsteuerung', label: REMOTE_TEXTE.titel }),
    votingItem(s),
    aufnahmeItem(s),
  ];
}

/**
 * Beschriftungen der Haupttasten, die hauptTasten nicht trägt: VS (wörtlich App.tsx), Nächste Runde und Replay. Solange ein
 * Clip läuft, steht auf der Replay-Taste „schneidet …“ wie im alten Clip-Kasten (ClipPanel.tsx:56); der Grund „Clip läuft“
 * kommt aus hauptTasten dazu. Die Voting-Beschriftung liefert hauptTasten selbst.
 */
export function tastenBeschriftung(s: Pick<OberflaechenStand, 'state'>): { vs: string; naechste: string; replay: string } {
  const { state } = s;
  const schneidet = state.clips.some((c) => c.status === 'running');
  return {
    vs: state.live ? BATTLE_TEXTE.vs.an : BATTLE_TEXTE.vs.aus,
    naechste: BATTLE_TEXTE.naechste,
    replay: schneidet ? BATTLE_TEXTE.replay.schneidet : BATTLE_TEXTE.replay.label(state.config.clipSeconds),
  };
}

/** Aufnahme-Quelle am Clip-Knopf (wörtlich ClipPanel.tsx): der Dateiname oder „keine Quelle gewählt“. */
export function clipQuelleText(config: Pick<BattleConfig, 'recordingPath'>): string {
  return config.recordingPath ? dateiName(config.recordingPath) : BATTLE_TEXTE.replay.keineQuelleGewaehlt;
}

/** Zielordner im Panel (wörtlich ClipPanel.tsx): der Ordnername oder der Standard. */
export function clipZielText(config: Pick<BattleConfig, 'clipDir'>): string {
  return config.clipDir ? dateiName(config.clipDir) : BATTLE_TEXTE.replay.zielStandard;
}

/** Per mDNS gefundener Titler mit Adresse für das Panel (manuelle stehen schon als Quelle in der Zeile; nie ins Host-Feld: das wäre ein Override). */
export function gefundeneAdressen(s: Pick<OberflaechenStand, 'state'>): Array<{ role: string; label: string; text: string }> {
  return s.state.links
    .filter((l) => COUPLED_ROLES.includes(l.role) && l.source !== 'manual' && l.host !== '')
    .map((l) => ({ role: l.role, label: roleLabel(l.role), text: `${BATTLE_TEXTE.gegenstellen.gefunden} ${l.host}:${zahlText(l.port)}` }));
}

/**
 * Farben der Ecken (E16): zwei tool-eigene Tokens aus globals.css, getrennt für Hell und Dunkel. Alpha-Varianten entstehen
 * über color-mix, nie über angehängte Hex-Ziffern.
 */
export const ECKEN_FARBE: Readonly<Record<Side, string>> = { A: 'var(--battle-ecke-a)', B: 'var(--battle-ecke-b)' };

/** Farbe für „Unentschieden“: das Token der gedämpften Schrift, nicht ein Grauwert. */
export const UNENTSCHIEDEN_FARBE = 'var(--muted-foreground)';

/** Eine Farbe zu `prozent` Prozent über durchsichtig gemischt (CSS color-mix): die Alpha-Variante eines Tokens. */
export function farbeMischen(farbe: string, prozent: number): string {
  return `color-mix(in srgb, ${farbe} ${zahlText(prozent)}%, transparent)`;
}

/**
 * Kleinste sinnvolle Breite einer Haupttaste in px: Die längste Beschriftung („Voting offen (Runde 10) — schließen“) bricht in
 * der Taste um; unter 180 px würde sie dreizeilig. Geschätzt aus den Schriftmaßen, nicht im Fenster gemessen.
 */
export const TASTEN_MIN_BREITE = 180;

/** Containerbreite, ab der die vier Tasten nebeneinander stehen: 4×180 + 3 Lücken à 12 (gap-3) = 756 px. Steht als `@[756px]` in LiveBereich.tsx. */
export const TASTEN_VIER_BREITE = 4 * TASTEN_MIN_BREITE + 3 * 12;

/** Spalten der vier Haupttasten nach Breite der Inhaltsbox (Container-Query, kein Viewport): 4 ab TASTEN_VIER_BREITE, sonst 2 (2×2); nie 3+1. */
export function tastenSpalten(containerBreite: number): 2 | 4 {
  return containerBreite >= TASTEN_VIER_BREITE ? 4 : 2;
}

/**
 * Fenster in px für die Rechnung des Live-Bereichs: Mindestbreite des Fensters (main/index.ts: minWidth 980, Außenmaß), davon der
 * Windows-Rahmen (Annahme 16 = 2×8 unsichtbare Ränder; nicht gemessen), Einstellungs-Panel --panel-w, seine Trennlinie und der
 * Innenabstand p-4 des Live-Bereichs (2×16). Das Panel liegt ab 900 px Fensterbreite neben dem Inhalt (AppShell).
 */
export const FENSTER_LAYOUT = { fensterMin: 980, rahmen: 16, panel: 360, trennlinie: 1, innen: 32 } as const;

/**
 * Spalten unter den Haupttasten in px: die rechte Spalte (QR 170 px + Kartenrand und Innenabstand, aufgerundet 256 für die
 * Adresszeilen), die Lücke gap-4 und die Mindestbreite der linken Spalte (Scoreboard: drei Jury-Knöpfe à ~110 px, Lücken, Innenabstand).
 */
export const LIVE_LAYOUT = { rechts: 256, luecke: 16, linksMin: 368 } as const;

/** Containerbreite, ab der die rechte Spalte neben statt unter dem Scoreboard steht: 368 + 16 + 256 = 640 px. Steht als `@[640px]` in LiveBereich.tsx. */
export const LIVE_ZWEI_SPALTEN_BREITE = LIVE_LAYOUT.linksMin + LIVE_LAYOUT.luecke + LIVE_LAYOUT.rechts;

/** Eine oder zwei Spalten unter den Haupttasten nach Breite der Inhaltsbox. */
export function liveSpalten(containerBreite: number): 1 | 2 {
  return containerBreite >= LIVE_ZWEI_SPALTEN_BREITE ? 2 : 1;
}

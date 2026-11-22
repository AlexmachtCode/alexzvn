// Prompter-Oberfläche: reine Ableitungen (UX Welle 2a, Aufgabe c; Spec 5.1, 7.1–7.4, E3 Ausgabezustand, E4 ON AIR, E11 Handy).
// Aus dem Zustand des Prompters (Main-Zustand mit Transport, Konfiguration und Handy-Fernbedienung), dem gemessenen
// Talent-Monitor und den Meldungen von Master-Link und Steuerserver entstehen die Props der Panel-Abschnitte, die
// Statusleiste, das ON AIR des Kopfes, die Zustände der Haupttasten und die Kürzel-Weiche für Eingabefelder.
// Kein window, kein IPC, kein localStorage: Die Tests laufen ohne Browser. Statusleiste und Panel nutzen dieselben
// Ableitungen (eine Wahrheit). Keine Taste bekommt eine neue Wirkung.
import {
  ABSCHNITT_TEXTE,
  abschnittStatusItem,
  REMOTE_TEXTE,
  remoteControlView,
  type RemoteControlSectionProps,
  type ScreenOption,
  type ScreenOutputSectionProps,
  SCREEN_TEXTE,
} from '@jm/settings';
import { masterLinkStatusItem, unbekannt, type StatusItem } from '@jm/ui';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import { portBelegt, STEUER_PORT, type FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { MasterLinkMeldungZeile, PrompterState } from '@shared/types';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge. */
export const ABSCHNITT = {
  ausgabe: 'ausgabe',
  fernsteuerung: 'fernsteuerung',
  schrift: 'schrift',
  leselinie: 'leselinie',
  darstellung: 'darstellung',
  handy: 'handy',
} as const;

/** Feste Texte des Prompters (kein ASCII-Anführungszeichen). Beschriftungen der Haupttasten wie bisher (OperatorView.tsx). */
export const PROMPTER_TEXTE = {
  go: 'GO',
  pause: 'Pause',
  anfang: 'Anfang',
  markeZurueck: 'Marke zurück',
  markeVor: 'Marke vor',
  /** Kürzel: Leertaste = GO/Pause, Pos1 = Anfang; die Marken haben keines. */
  kuerzel: { go: 'Leertaste', anfang: 'Pos1' },
  /** Talent-Monitor (E3). */
  ausgabe: {
    titel: 'Talent-Monitor',
    zu: 'zu',
    offen: 'offen',
    abgestuerzt: 'abgestürzt',
    trenner: ' · ',
  },
  /** Handy-Fernbedienung (E11): der Grund für „nicht gestartet“ steht nur im Log, der Text behauptet keinen. */
  handy: {
    titel: 'Handy-Fernbedienung',
    nichtGestartet: 'nicht gestartet',
    keineAdresse: 'Keine LAN-Adresse gefunden',
    adressen: (n: number): string => (n === 1 ? '1 Adresse' : `${n} Adressen`),
  },
  tempo: { titel: 'Tempo', einheit: ' Z/s' },
  /** Live-Bereich (Aufgabe d): der Hinweis ersetzt den alten Kopfhinweis; die Kürzel selbst stehen an den Tasten. */
  live: { hinweis: 'Leertaste, Pfeiltasten und Pos1 steuern den Lauf, solange der Cursor nicht im Skript oder in einem Feld steht.' },
  companionModul: 'JM Prompter',
  /** Titel der tool-eigenen Panel-Abschnitte (Namen wie bisher in OperatorView.tsx). */
  titel: { schrift: 'Schrift', leselinie: 'Lese-Linie', darstellung: 'Darstellung' },
} as const;

export interface OberflaechenStand {
  /** Main-Zustand des Prompters; undefined = noch nicht geladen (dann „unbekannt“). */
  prompter: PrompterState | undefined;
  /** Gemessener Talent-Monitor: undefined = noch keine Antwort, null = keine Brücke (beides „unbekannt“, nie live). */
  ausgabe: AusgabeZustand | null | undefined;
  /** Master-Link-Meldung: undefined = offen, null = keine Brücke. */
  masterLink: MasterLinkMeldungZeile | null | undefined;
  /** Meldung des Steuerservers (Port 8727): undefined/null = noch keine Antwort. */
  fernsteuerung: FernsteuerungMeldung | null | undefined;
  /** Bildschirmliste, falls bekannt (frisch aus `output.displays()`); nur dafür, den offenen Bildschirm zu benennen. */
  bildschirme?: readonly ScreenOption[];
}

/** Aktionen des Panels: die View ruft damit `window.jmprompt` erst im Rückruf. */
export interface PrompterAktionen {
  ausgabeUmschalten(an: boolean): void;
  bildschirmWaehlen(id: number | null): void;
}

export interface TasteZustand {
  state: 'bereit' | 'live' | 'gesperrt';
  disabledReason?: string;
}

/** Haupttaste mit Beschriftung und, wo es eines gibt, dem Kürzel. */
export type Haupttaste = TasteZustand & { label: string; shortcut?: string };

/** `scrolling` des Steuerservers ist `transport.playing`. */
const scrollt = (s: Pick<OberflaechenStand, 'prompter'>): boolean => s.prompter?.transport.playing === true;

/** Monitor soll offen sein: Das Fenster existiert in irgendeiner Form (auch abgestürzt oder ohne Bildschirm). */
const monitorSollOffen = (a: AusgabeZustand | null | undefined): boolean => a !== undefined && a !== null && a.art !== 'zu';

/** Ausgabe auf Bildschirm (Talent-Monitor): kein Vollbild- und kein Hintergrundfeld. */
export function ausgabeAbschnitt(s: OberflaechenStand, a?: PrompterAktionen): ScreenOutputSectionProps {
  const z = s.ausgabe ?? undefined;
  return {
    id: ABSCHNITT.ausgabe,
    enabled: monitorSollOffen(z),
    windowOpen: z === undefined ? undefined : z.art === 'offen' || z.art === 'bildschirm-fehlt',
    screens: s.bildschirme === undefined ? undefined : [...s.bildschirme],
    selectedId: s.prompter?.config.outputDisplayId ?? null,
    capabilities: { toggle: true, fullscreen: false, background: false },
    ...(a === undefined ? {} : { onToggle: (an: boolean) => a.ausgabeUmschalten(an), onSelect: (id: number | null) => a.bildschirmWaehlen(id) }),
  };
}

/** Fernsteuerung: Meldung des Steuerservers (Port 8727), Einrichten nur im Launcher. */
export function fernsteuerungAbschnitt(s: OberflaechenStand): RemoteControlSectionProps {
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
    companionModule: PROMPTER_TEXTE.companionModul,
    capabilities: {},
  };
}

/** Talent-Monitor (E3): noch keine Antwort oder keine Brücke → unbekannt, nie ok. „offen“ nennt den Bildschirm nur, wenn die Liste ihn kennt. */
function talentMonitorItem(s: OberflaechenStand): StatusItem {
  const T = PROMPTER_TEXTE.ausgabe;
  const kopf = { id: 'talent-monitor', group: 'ausgabe', label: T.titel, settingsSection: ABSCHNITT.ausgabe } as const;
  const z = s.ausgabe;
  if (z === undefined || z === null) return unbekannt(kopf);
  switch (z.art) {
    case 'zu':
      return { ...kopf, state: 'off', detail: T.zu };
    case 'offen': {
      const name = z.displayId === null ? undefined : s.bildschirme?.find((b) => b.id === z.displayId)?.label;
      return { ...kopf, state: 'ok', detail: name === undefined ? T.offen : `${T.offen}${T.trenner}${name}` };
    }
    case 'bildschirm-fehlt':
      return { ...kopf, state: 'warn', detail: SCREEN_TEXTE.bildschirmFehlt };
    case 'abgestuerzt':
      return { ...kopf, state: 'error', detail: T.abgestuerzt };
  }
}

/** Handy-Fernbedienung (E11): aus → off; an, läuft, mit Adresse → ok mit Adresszahl; läuft ohne Adresse → warn; läuft nicht → warn ohne behaupteten Grund. */
function handyItem(p: PrompterState | undefined): StatusItem {
  const H = PROMPTER_TEXTE.handy;
  const kopf = { id: 'handy', group: 'fernsteuerung', label: H.titel, settingsSection: ABSCHNITT.handy } as const;
  if (p === undefined) return unbekannt(kopf);
  if (!p.config.remoteEnabled) return { ...kopf, state: 'off', detail: ABSCHNITT_TEXTE.aus };
  if (!p.remote.running) return { ...kopf, state: 'warn', detail: H.nichtGestartet };
  // Läuft, aber ohne erreichbare Adresse: das Handy könnte nicht verbinden, also nicht ok.
  return p.remote.urls.length > 0 ? { ...kopf, state: 'ok', detail: H.adressen(p.remote.urls.length) } : { ...kopf, state: 'warn', detail: H.keineAdresse };
}

/** Tempo wie der Regler es zeigt: eine Stelle und „ Z/s“. Ohne Zustand unbekannt. */
function tempoItem(p: PrompterState | undefined): StatusItem {
  const kopf = { id: 'tempo', group: 'tool', label: PROMPTER_TEXTE.tempo.titel } as const;
  if (p === undefined) return unbekannt(kopf);
  return { ...kopf, state: 'ok', detail: `${p.config.speed.toFixed(1)}${PROMPTER_TEXTE.tempo.einheit}` };
}

/** Statusleiste in fester Reihenfolge: master-link, talent-monitor, fernsteuerung, handy, tempo. */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  return [
    masterLinkStatusItem(s.masterLink),
    talentMonitorItem(s),
    abschnittStatusItem(remoteControlView(fernsteuerungAbschnitt(s)), { group: 'fernsteuerung', label: REMOTE_TEXTE.titel }),
    handyItem(s.prompter),
    tempoItem(s.prompter),
  ];
}

/** ON AIR (E4): nur wenn der Prompter scrollt und der Talent-Monitor gemessen offen ist. Kein Label (Kopf-Vorgabe). */
export function kopfOnAir(s: OberflaechenStand): { live: boolean } {
  return { live: scrollt(s) && s.ausgabe?.art === 'offen' };
}

/**
 * Haupttasten: GO/Pause (`transport.toggle`), Anfang (`transport.reset`), Marke zurück und vor (`jumpMarker`). Heute ist keine
 * davon gesperrt; ein Sperrgrund käme aus PROMPTER_TEXTE. Nur GO zeigt live, nach derselben Regel wie das ON AIR im Kopf.
 */
export function hauptTasten(s: OberflaechenStand): { go: Haupttaste; anfang: Haupttaste; markeZurueck: Haupttaste; markeVor: Haupttaste } {
  const laeuft = scrollt(s);
  const T = PROMPTER_TEXTE;
  return {
    go: { label: laeuft ? T.pause : T.go, state: kopfOnAir(s).live ? 'live' : 'bereit', shortcut: T.kuerzel.go },
    anfang: { label: T.anfang, state: 'bereit', shortcut: T.kuerzel.anfang },
    markeZurueck: { label: T.markeZurueck, state: 'bereit' },
    markeVor: { label: T.markeVor, state: 'bereit' },
  };
}

/**
 * Ist das Ziel eines Tastendrucks ein Feld, in das getippt wird? Dann gehören Leertaste, Pfeile und Pos1 dem Feld.
 * INPUT, TEXTAREA, SELECT und contentEditable; ein Knopf zählt nicht (Leertaste auf einem Knopf löst weiter GO aus).
 * Ohne DOM nutzbar: gelesen werden nur tagName und isContentEditable.
 */
export function istEingabeZiel(ziel: EventTarget | null): boolean {
  if (ziel === null) return false;
  const t = ziel as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof t.tagName === 'string' ? t.tagName.toUpperCase() : '';
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable === true;
}

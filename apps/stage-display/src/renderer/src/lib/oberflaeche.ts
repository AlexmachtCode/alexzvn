// Stage-Display-Oberfläche: reine Ableitungen (UX Welle 2a, Aufgabe c; Spec 5.1, 7.1–7.4, E3 Ausgabezustand, E4 kein ON AIR, E12 Quellen).
// Aus dem Zustand des Stage-Displays (Konfiguration und gemessene Verbindungen der drei Quellen), dem gemessenen Bühnenschirm
// und der Master-Link-Meldung entstehen die Props der Panel-Abschnitte, die Statusleiste und die Bühnenschirm-Taste.
// Kein window, kein IPC, kein localStorage: Die Tests laufen ohne Browser. Statusleiste und Panel nutzen dieselben
// Ableitungen (eine Wahrheit). Der Stage-Display hat keine Fernsteuerung und kein ON AIR.
import {
  peerZeileStatus,
  type PeerRow,
  type PeersSectionProps,
  type ScreenOption,
  type ScreenOutputSectionProps,
  SCREEN_TEXTE,
} from '@jm/settings';
import { masterLinkStatusItem, unbekannt, type StatusItem } from '@jm/ui';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import type { MasterLinkMeldungZeile, StageState } from '@shared/types';
import { buehnenNachricht } from './nachricht';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge. */
export const ABSCHNITT = {
  ausgabe: 'ausgabe',
  quellen: 'quellen',
  presenter: 'presenter',
} as const;

/** Feste Texte des Stage-Displays (kein ASCII-Anführungszeichen). Beschriftungen der Taste wie bisher (OperatorView.tsx). */
export const STAGE_TEXTE = {
  /** Bühnenschirm (E3). „Bildschirm fehlt“ kommt aus @jm/settings. */
  ausgabe: {
    titel: 'Bühnenschirm',
    zu: 'zu',
    offen: 'offen',
    abgestuerzt: 'abgestürzt',
    trenner: ' · ',
    /** Zweiter Öffnen-Knopf von früher (OperatorView): zieht ein offenes Fenster auf den gewählten Bildschirm. */
    verschieben: 'Auf diesen Bildschirm',
    /** Zusatz im Etikett des primären Bildschirms wie bisher. */
    primaer: ' · primär',
  },
  /** Haupttaste: alter Wortlaut der Knöpfe „Vollbild-Ausgabe öffnen“ und „Ausgabe schließen“. */
  taste: { oeffnen: 'Vollbild-Ausgabe öffnen', schliessen: 'Ausgabe schließen' },
  /** Quellen (E12): Namen wie bisher; „verbunden“ und „aus“ kommen aus @jm/settings. */
  quelle: {
    timer: 'JM Timer',
    switcher: 'JM Switcher',
    presenter: 'JM Presenter',
  },
  /** Live-Bereich: Überschriften und Beschriftungen wie bisher (OperatorView), die Haupttaste heißt wie unter `taste`. */
  live: {
    laedt: 'Lädt…',
    vorschau: 'Vorschau',
    nachrichtTitel: 'Nachricht (Ad-hoc, hat Vorrang vor Timer-Nachricht)',
    nachrichtPlatzhalter: 'z. B. „Bitte Plätze einnehmen“ — leer = Timer-Nachricht',
    elementeTitel: 'Anzeige-Elemente',
    elemente: {
      clock: 'Uhr',
      timer: 'Timer/Countdown',
      switcher: 'Switcher-Status',
      presenter: 'Presenter (REF)',
      message: 'Nachricht',
    },
  },
  /** Hinweise der drei Quellen wie bisher (rechts neben dem Namen); PeersSection kennt keinen Hinweis. */
  quellenHinweis: {
    timer: 'Countdown · Programmpunkt · Nachricht (Port 7777)',
    switcher: 'Program/Preview · REC/Stream (Companion-Port)',
    presenter: 'Referentenansicht: Folie · Notizen · Nächste (Fernsteuerung im Presenter aktivieren, Port 7330)',
  },
  /** Presenter-Kopplung (tool-eigen): PIN und Anzeige, Wortlaut wie bisher. */
  kopplung: {
    titel: 'Presenter-Kopplung',
    pin: 'PIN',
    pinHinweis: 'PIN nur falls die Presenter-Fernsteuerung mit PIN läuft — sonst leer lassen',
    anzeige: 'Anzeige',
    ref: 'Referenzansicht',
    main: 'Hauptansicht',
    folienHinweis: 'Folienbild erscheint, sobald eine Präsentation läuft',
  },
  /** Nachricht: ok nur, wenn sie auf dem offenen Schirm steht; sonst steht der Grund da. */
  nachricht: {
    titel: 'Nachricht',
    aufSchirm: 'auf dem Schirm',
    keine: 'keine Nachricht',
    elementAus: 'Element aus',
    schirmNichtOffen: 'Schirm nicht offen',
  },
} as const;

export interface OberflaechenStand {
  /** Main-Zustand des Stage-Displays; undefined = noch nicht geladen (dann „unbekannt“). */
  stage: StageState | undefined;
  /** Gemessener Bühnenschirm: undefined = noch keine Antwort, null = keine Brücke (beides „unbekannt“). */
  ausgabe: AusgabeZustand | null | undefined;
  /** Master-Link-Meldung: undefined = offen, null = keine Brücke. */
  masterLink: MasterLinkMeldungZeile | null | undefined;
  /** Bildschirmliste, falls bekannt (frisch aus `output.displays()`); nur dafür, den offenen Bildschirm zu benennen. */
  bildschirme?: readonly ScreenOption[];
}

/** Aktionen des Panels: die View ruft damit `window.jmstage` erst im Rückruf. */
export interface StageAktionen {
  ausgabeUmschalten(an: boolean): void;
  bildschirmWaehlen(id: number | null): void;
  quelleSchalten(role: string, enabled: boolean): void;
  quelleSetzen(role: string, host: string, port: number): void;
}

export interface TasteZustand {
  state: 'bereit' | 'live' | 'gesperrt';
  disabledReason?: string;
}

/** Haupttaste mit Beschriftung. */
export type Haupttaste = TasteZustand & { label: string };

type Rolle = 'timer' | 'switcher' | 'presenter';
const ROLLEN: readonly { role: Rolle; label: string; defaultPort: number }[] = [
  { role: 'timer', label: STAGE_TEXTE.quelle.timer, defaultPort: 7777 },
  { role: 'switcher', label: STAGE_TEXTE.quelle.switcher, defaultPort: 8723 },
  { role: 'presenter', label: STAGE_TEXTE.quelle.presenter, defaultPort: 7330 },
];

/** Schirm soll offen sein: Das Fenster existiert in irgendeiner Form (auch abgestürzt oder ohne Bildschirm). */
export const schirmSollOffen = (a: AusgabeZustand | null | undefined): boolean => a !== undefined && a !== null && a.art !== 'zu';

/** Etikett eines Bildschirms in der Auswahl, wie bisher: Name[ · primär] (Breite×Höhe). */
export function bildschirmEtikett(d: { label: string; primary: boolean; width: number; height: number }): string {
  return `${d.label}${d.primary ? STAGE_TEXTE.ausgabe.primaer : ''} (${d.width}×${d.height})`;
}

/** Der Knopf „Auf diesen Bildschirm“ gilt, solange das Ausgabefenster gemessen existiert (offen oder Bildschirm fehlt). */
export function kannVerschieben(a: AusgabeZustand | null | undefined): boolean {
  return a !== undefined && a !== null && (a.art === 'offen' || a.art === 'bildschirm-fehlt');
}

/** Ausgabe auf Bildschirm (Bühnenschirm): nur der Schalter, kein Vollbild- und kein Hintergrundfeld. */
export function ausgabeAbschnitt(s: OberflaechenStand, a?: StageAktionen): ScreenOutputSectionProps {
  const z = s.ausgabe ?? undefined;
  return {
    id: ABSCHNITT.ausgabe,
    enabled: schirmSollOffen(z),
    windowOpen: z === undefined ? undefined : z.art === 'offen' || z.art === 'bildschirm-fehlt',
    screens: s.bildschirme === undefined ? undefined : [...s.bildschirme],
    selectedId: s.stage?.config.outputDisplayId ?? null,
    capabilities: { toggle: true, fullscreen: false, background: false },
    ...(a === undefined ? {} : { onToggle: (an: boolean) => a.ausgabeUmschalten(an), onSelect: (id: number | null) => a.bildschirmWaehlen(id) }),
  };
}

/** Eine Quellenzeile: Ein/Aus aus der Konfiguration, `connected` gemessen; nie eine Quelle (kein Auto, E12). */
function quellenZeile(s: OberflaechenStand, r: (typeof ROLLEN)[number]): PeerRow {
  const q = s.stage?.config[r.role];
  const gemessen = s.stage?.[r.role].connected;
  return {
    role: r.role,
    label: r.label,
    host: q?.host ?? '',
    port: q?.port ?? r.defaultPort,
    defaultPort: r.defaultPort,
    enabled: q?.enabled,
    connected: gemessen,
  };
}

/** Quellen (E12): Ein/Aus je Quelle, ohne Auto und ohne „manuell“; die Zeile zeigt nur verbunden oder aus. */
export function quellenAbschnitt(s: OberflaechenStand, a?: StageAktionen): PeersSectionProps {
  return {
    id: ABSCHNITT.quellen,
    peers: ROLLEN.map((r) => quellenZeile(s, r)),
    capabilities: { toggle: true },
    ...(a === undefined ? {} : { onToggle: (role: string, enabled: boolean) => a.quelleSchalten(role, enabled), onSet: (role: string, host: string, port: number) => a.quelleSetzen(role, host, port) }),
  };
}

/** Bühnenschirm (E3): noch keine Antwort oder keine Brücke → unbekannt, nie ok. „offen“ nennt den Bildschirm nur, wenn die Liste ihn kennt. */
function buehnenschirmItem(s: OberflaechenStand): StatusItem {
  const T = STAGE_TEXTE.ausgabe;
  const kopf = { id: 'buehnenschirm', group: 'ausgabe', label: T.titel, settingsSection: ABSCHNITT.ausgabe } as const;
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

/** Quelle: dieselbe Zeile wie im Panel (peerZeileStatus): nicht geladen → unbekannt, aus → off „aus“, verbunden → ok, an und nicht verbunden → warn. */
function quelleItem(s: OberflaechenStand, r: (typeof ROLLEN)[number]): StatusItem {
  const st = peerZeileStatus(quellenZeile(s, r));
  return { id: `quelle-${r.role}`, group: 'verbindung', label: r.label, settingsSection: ABSCHNITT.quellen, state: st.state, detail: st.text };
}

/** Nachricht: ok nur, wenn sie wirklich auf dem offenen Schirm steht (Regeln und Trimmen wie StageScreen über buehnenNachricht). */
function nachrichtItem(s: OberflaechenStand): StatusItem {
  const T = STAGE_TEXTE.nachricht;
  const kopf = { id: 'nachricht', group: 'tool', label: T.titel } as const;
  if (s.stage === undefined) return unbekannt(kopf);
  if (!s.stage.config.widgets.message) return { ...kopf, state: 'off', detail: T.elementAus };
  if (buehnenNachricht(s.stage) === null) return { ...kopf, state: 'off', detail: T.keine };
  if (s.ausgabe === undefined || s.ausgabe === null) return unbekannt(kopf);
  return s.ausgabe.art === 'offen' ? { ...kopf, state: 'ok', detail: T.aufSchirm } : { ...kopf, state: 'off', detail: T.schirmNichtOffen };
}

/** Statusleiste in fester Reihenfolge: master-link, drei Quellen, buehnenschirm, nachricht. */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  return [masterLinkStatusItem(s.masterLink), ...ROLLEN.map((r) => quelleItem(s, r)), buehnenschirmItem(s), nachrichtItem(s)];
}

/**
 * Haupttaste „Bühnenschirm“: öffnen oder schließen (`output:open` / `output:close`). `live` nur bei gemessen offenem Schirm (E4).
 * Existiert das Fenster (offen, Bildschirm fehlt, abgestürzt), schließt die Taste; sonst öffnet sie. Nie gesperrt: sie geht immer.
 */
export function buehnenschirmTaste(s: OberflaechenStand): Haupttaste {
  const T = STAGE_TEXTE.taste;
  const a = s.ausgabe;
  const fensterDa = a !== undefined && a !== null && a.art !== 'zu';
  return { label: fensterDa ? T.schliessen : T.oeffnen, state: a?.art === 'offen' ? 'live' : 'bereit' };
}

// Titler-Oberfläche: reine Ableitungen (UX-Pilot C8; Spec 5.1, 6, 7.1–7.4, Anhang A „Titler“). Aus dem Stand des Titlers
// (Konfiguration, Status, Monitorliste, Master-Link-Meldung) entstehen die Props der Einstellungs-Abschnitte, die
// Statusleiste, der Zustand der V-Zeile und die Zustände der vier Haupttasten. Kein window, kein IPC, kein localStorage
// (G7): Die Aktionen kommen als Objekt herein, die Tests laufen ohne Browser. Statusleiste und Panel nutzen dieselben
// Ableitungen (eine Wahrheit).
// Regeln: E4 Master, E6 Fernsteuerung, E7 NDI, E8 Bildschirm, E9 iveo, E10 DataLink, E12 Haupttasten, E18 V-Zeile, E20 ids.
import {
  abschnittStatusItem,
  dataLinkView,
  iveoView,
  ndiOutputView,
  remoteControlView,
  screenOutputView,
  type DataLinkSectionProps,
  type IveoSectionProps,
  type NdiOutputSectionProps,
  type RemoteControlSectionProps,
  type ScreenOutputSectionProps,
} from '@jm/settings';
import { masterLinkStatusItem, type SelectOption, type StatusItem, type StatusState } from '@jm/ui';
import { portBelegt, STEUER_PORT } from '@shared/fernsteuerung';
import {
  DEFAULT_CONFIG,
  type DisplayInfo,
  type MasterLinkMeldungZeile,
  type PartialTitlerConfig,
  type TitlerConfig,
  type TitlerStatus,
  type VerbundAnzeigeZeile,
} from '@shared/types';
import { navGesperrt } from '@/lib/datalink-anzeige';

/** Abschnitts-ids = Panel-Anker (`einstellung-{id}`) = settingsSection der Statuseinträge (E20). */
export const ABSCHNITT = {
  iveo: 'iveo',
  ndi: 'ndi',
  bildschirm: 'bildschirm',
  fernsteuerung: 'fernsteuerung',
  datalink: 'datalink',
  stil: 'stil',
  vorlagen: 'vorlagen',
} as const;

/** Feste Texte des Titlers (G5; Freigabe OF8: T2 Labels, T3 Haupttasten, T4 bis T7, T10, T11; dazu zwei heutige Texte). */
export const TITLER_TEXTE = {
  take: 'Take',
  clear: 'Clear',
  zurueck: '◀ Eintrag',
  weiter: 'Eintrag ▶',
  ersterEintrag: 'Erster Eintrag',
  letzterEintrag: 'Letzter Eintrag',
  /** Hinweiszeile bei NDI an: wörtlich der heutige Text (Funktionsliste Nr. 9). */
  hinweisNdiAn: 'NDI-Quelle aktiv — in TriCaster/vMix/OBS als Eingang über das vorhandene Programm legen (Alpha/Key).',
  hinweisNdiAus: 'NDI unter Einstellungen › NDI-Ausgabe starten, damit die transparente Quelle im Netz erscheint. Vorschau läuft auch ohne NDI.',
  keinOrdner:
    'Kein Datenordner aktiv. Unter Einstellungen › DataLink einen Ordner wählen — oder den Titler über eine JM Show mit iveo-Daten öffnen. Abrufbare Einträge erscheinen dann hier.',
  keineGrafik: 'Keine Grafik-Vorlage gewählt — unter „Grafik-Vorlagen“ auswählen oder unter Einstellungen › Grafik-Vorlagen importieren.',
  keineVorlagen: 'Noch keine Vorlagen. Import unter Einstellungen › Grafik-Vorlagen.',
  stil: 'Stil',
  vorlagen: 'Grafik-Vorlagen',
  loeschen: 'Löschen',
  loeschenAria: (name: string) => `Vorlage „${name}“ löschen`,
  laedt: 'Lädt…',
  /** Bisheriger Hinweis bei ungerader Auflösung (Funktionsliste Nr. 54), jetzt Fehlertext des NDI-Abschnitts (E7). */
  aufloesungUngerade: 'Auflösung sollte gerade sein.',
  companionModul: 'jm-suite',
  label: { iveo: 'iveo', ndi: 'NDI', bildschirm: 'Bildschirm', fernsteuerung: 'Fernsteuerung', datalink: 'DataLink' },
} as const;

export interface OberflaechenStand {
  config: TitlerConfig;
  status: TitlerStatus;
  /** Monitorliste aus listDisplays; undefined = noch nicht geladen (dann „unbekannt“, nie eine leere Liste, E8). */
  displays: DisplayInfo[] | undefined;
  /** Meldung der Master-Link-Brücke aus useBrueckenWert: undefined = offen, null = keine Brücke (beides „unbekannt“). */
  masterLink: MasterLinkMeldungZeile | null | undefined;
}

/** Was die Abschnitte auslösen; OperatorView reicht Store und window.jmtitler herein. */
export interface TitlerAktionen {
  setConfig(patch: PartialTitlerConfig): void;
  startNdi(name: string): void;
  stopNdi(): void;
  pickFolder(): void;
  zurueckZumEigenenOrdner(): void;
}

export interface TasteZustand {
  state: 'bereit' | 'live' | 'gesperrt';
  disabledReason?: string;
}

/** Text des Hauptprozesses für einen fehlenden DataLink-Ordner (main/datalink.ts, scan); ein Test hält beide gleich. */
const ORDNER_NICHT_GEFUNDEN = 'Ordner nicht gefunden';

/** Auflösungen und Bildraten wie bisher in der Bedienung (Wert `{w}x{h}` bzw. fps). */
const AUFLOESUNGEN: SelectOption[] = [
  { value: '1920x1080', label: '1920×1080' },
  { value: '1280x720', label: '1280×720' },
];
const BILDRATEN: SelectOption[] = [25, 30, 50, 60].map((f) => ({ value: String(f), label: String(f) }));

/** Quell-Hinweise der Show (H3, H4, H7): Die Liste stammt aus einem früheren Stand. H1/H2/H5/H6 setzt der DataLink-Kern. */
const QUELL_HINWEIS: ReadonlySet<string> = new Set(['H3', 'H4', 'H7']);

/** Gemessene Trennung vom Master: Bei Quelle master gilt dann die Liste aus dem zuletzt empfangenen Stand (E9). */
const LINK_GETRENNT: ReadonlySet<string> = new Set(['ohne-client', 'aus', 'sucht', 'verbindet', 'fehler']);

/** iveo (E9): gebunden bei Datenquelle Show oder Master; die Lieferung leitet sich aus dem stehenden Hinweis ab. */
export function iveoAbschnitt(s: OberflaechenStand): IveoSectionProps {
  const art = s.status.datenQuelle.art;
  const bound = art === 'show' || art === 'master';
  const h = s.status.hinweis;
  // Kein Hinweis: Die Show lieferte → ok. Quell-Hinweis: Liste aus früherem Stand. Ein Kern-Hinweis steht im Vorrang vor
  // einem Quell-Hinweis (RANG im Kern) und kann ihn verdecken: dann ist die Lieferung unbekannt.
  const nachHinweis = h === undefined ? 'ok' : QUELL_HINWEIS.has(h.art) ? 'veraltet' : undefined;
  // Bei Quelle master kommt die Liste über den Master-Link (N1): verbunden → wie der Hinweis; getrennt → Liste aus früherem
  // Stand (ein Kern-Hinweis bleibt unbekannt); Brücke offen, ohne Brücke oder unbekannte Art → unbekannt, nie ok (Spec 7.2).
  const m = s.masterLink;
  const link = m?.art === 'verbunden' ? 'verbunden' : m && LINK_GETRENNT.has(m.art) ? 'getrennt' : 'unbekannt';
  const ueberMaster = link === 'verbunden' ? nachHinweis : link === 'getrennt' && nachHinweis !== undefined ? 'veraltet' : undefined;
  return {
    id: ABSCHNITT.iveo,
    bound,
    speakerCount: bound ? s.status.entries.length : undefined,
    delivery: !bound ? undefined : art === 'master' ? ueberMaster : nachHinweis,
  };
}

/** NDI-Ausgabe (E7): Der Hauptprozess meldet nur „Kindprozess gestartet“, keine Rückmeldung des Senders. */
export function ndiAbschnitt(s: OberflaechenStand, a: TitlerAktionen): NdiOutputSectionProps {
  const c = s.config;
  const st = s.status;
  return {
    id: ABSCHNITT.ndi,
    enabled: st.ndiActive,
    sourceName: c.ndiName,
    // Die Empfängerzahl kommt erst nach 30 gesendeten Bildern; 0 ist nicht von „noch keine Meldung“ zu unterscheiden,
    // und nach dem Stopp stünde sonst die alte Zahl hinter „aus“.
    receivers: st.ndiActive && st.connections > 0 ? st.connections : undefined,
    resolution: `${c.width}x${c.height}`,
    resolutionOptions: AUFLOESUNGEN,
    fps: String(c.fps),
    fpsOptions: BILDRATEN,
    capabilities: { toggle: true, rename: true, resolution: true, fps: true },
    error: c.width % 2 !== 0 || c.height % 2 !== 0 ? TITLER_TEXTE.aufloesungUngerade : undefined,
    onToggle: (an) => (an ? a.startNdi(c.ndiName) : a.stopNdi()),
    onRename: (name) => a.setConfig({ ndiName: name }),
    onResolution: (wert) => {
      const m = /^(\d+)x(\d+)$/.exec(wert);
      if (m && AUFLOESUNGEN.some((o) => o.value === wert)) a.setConfig({ width: Number(m[1]), height: Number(m[2]) });
    },
    onFps: (wert) => {
      if (BILDRATEN.some((o) => o.value === wert)) a.setConfig({ fps: Number(wert) });
    },
  };
}

/** Ausgabe auf Bildschirm (E8): Ob das Ausgabefenster offen ist, meldet kein Kanal → „an (ohne Rückmeldung)“. */
export function bildschirmAbschnitt(s: OberflaechenStand, a: TitlerAktionen): ScreenOutputSectionProps {
  const c = s.config;
  return {
    id: ABSCHNITT.bildschirm,
    enabled: c.secondScreenEnabled,
    screens: s.displays?.map((d) => ({ id: d.id, label: d.label, primary: d.primary })),
    selectedId: c.secondScreenDisplay === 0 ? null : c.secondScreenDisplay,
    background: c.chromaColor,
    backgroundDefault: DEFAULT_CONFIG.chromaColor,
    capabilities: { toggle: true, background: true, backgroundPicker: true },
    onToggle: (an) => a.setConfig({ secondScreenEnabled: an }),
    onSelect: (id) => a.setConfig({ secondScreenDisplay: id ?? 0 }),
    onBackground: (hex) => a.setConfig({ chromaColor: hex }),
  };
}

/** Fernsteuerung (E6): Meldung des Steuerservers (S-A3); Einrichten nur im Launcher (OF5, ohne Knopf). */
export function fernsteuerungAbschnitt(s: OberflaechenStand): RemoteControlSectionProps {
  const m = s.status.fernsteuerung;
  // EADDRINUSE nur als portInUse: Der Fehler ginge im Abschnitt vor und verdeckte „Port belegt“ (E6).
  const belegt = portBelegt(m);
  return {
    id: ABSCHNITT.fernsteuerung,
    running: m?.laeuft,
    mode: m?.modus,
    port: m !== undefined && m.port > 0 ? m.port : STEUER_PORT,
    clients: m?.clients,
    portInUse: belegt,
    error: m?.fehler !== undefined && !belegt ? m.fehler : undefined,
    companionModule: TITLER_TEXTE.companionModul,
    capabilities: {},
  };
}

/** DataLink (E10): eigener Ordner, Datenquelle (Q1–Q4, K1), Hinweis H1–H7, Sperre im Verbund (R2-Satz wörtlich, OF7). */
export function dataLinkAbschnitt(s: OberflaechenStand, a: TitlerAktionen): DataLinkSectionProps {
  const st = s.status;
  const q = st.datenQuelle;
  const fehlt = st.dataError === ORDNER_NICHT_GEFUNDEN;
  return {
    id: ABSCHNITT.datalink,
    folder: s.config.dataFolder,
    folderMissing: fehlt,
    error: st.dataError && !fehlt ? st.dataError : undefined,
    // Show, Master und frühere Show liefern Einträge ohne eigenen Ordner: kein „kein Ordner“.
    externeQuelle: q.art !== 'ordner',
    eintraege: st.entries.length,
    sourceLine: q.zeile,
    notice: st.hinweis?.text,
    backLabel: q.zurueckKnopf ?? undefined,
    onBack: q.zurueckKnopf ? () => a.zurueckZumEigenenOrdner() : undefined,
    locked: q.ordnerGesperrt,
    onPickFolder: () => a.pickFolder(),
    // Auch bei Sperre gesetzt: Der Knopf bleibt sichtbar gesperrt (C6), der Main lehnt den Patch ohnehin ab (R2).
    onClearFolder: () => a.setConfig({ dataFolder: '' }),
    capabilities: { ordnerText: true },
    onFolderText: (pfad) => a.setConfig({ dataFolder: pfad }),
  };
}

const KEINE_AKTION: TitlerAktionen = {
  setConfig: () => {},
  startNdi: () => {},
  stopNdi: () => {},
  pickFolder: () => {},
  zurueckZumEigenenOrdner: () => {},
};

/** Statusleiste in fester Reihenfolge (Anhang A, E20): master-link, iveo, ndi, bildschirm, fernsteuerung, datalink. */
export function statusLeiste(s: OberflaechenStand): StatusItem[] {
  const L = TITLER_TEXTE.label;
  const ndi = ndiOutputView(ndiAbschnitt(s, KEINE_AKTION));
  return [
    masterLinkStatusItem(s.masterLink),
    abschnittStatusItem(iveoView(iveoAbschnitt(s)), { group: 'verbindung', label: L.iveo }),
    abschnittStatusItem(ndi, { group: 'ausgabe', label: L.ndi, detail: ndi.empfaenger }),
    abschnittStatusItem(screenOutputView(bildschirmAbschnitt(s, KEINE_AKTION)), { group: 'ausgabe', label: L.bildschirm }),
    abschnittStatusItem(remoteControlView(fernsteuerungAbschnitt(s)), { group: 'fernsteuerung', label: L.fernsteuerung }),
    abschnittStatusItem(dataLinkView(dataLinkAbschnitt(s, KEINE_AKTION)), { group: 'tool', label: L.datalink }),
  ];
}

const VERBUND_ZUSTAND: Readonly<Record<VerbundAnzeigeZeile['farbe'], StatusState>> = {
  gruen: 'ok',
  gelb: 'warn',
  rot: 'error',
  gedaempft: 'off',
};

/** V-Zeile „Show vom Master“ als StatusPill (E18): Farbe der R2-Anzeige → Zustand; unbekannt → off, nie live. */
export function verbundZeileZustand(farbe: VerbundAnzeigeZeile['farbe']): StatusState {
  return Object.prototype.hasOwnProperty.call(VERBUND_ZUSTAND, farbe) ? VERBUND_ZUSTAND[farbe] : 'off';
}

/**
 * Haupttasten (E12, Anhang A): Take zeigt live und ist nie gesperrt, Clear ist nie gesperrt; ◀/▶ Eintrag nur mit Einträgen,
 * an den Rändern gesperrt mit Grund (wie navGesperrt: ohne aktiven Eintrag beide frei). Keine Kürzel (UO5).
 */
export function hauptTasten(
  live: boolean,
  activeEntry: number,
  anzahl: number,
): { take: TasteZustand; clear: TasteZustand; eintrag: { zurueck: TasteZustand; weiter: TasteZustand } | null } {
  const taste = (gesperrt: boolean, grund: string): TasteZustand => (gesperrt ? { state: 'gesperrt', disabledReason: grund } : { state: 'bereit' });
  const nav = navGesperrt(activeEntry, anzahl);
  return {
    take: { state: live ? 'live' : 'bereit' },
    clear: { state: 'bereit' },
    eintrag: anzahl > 0 ? { zurueck: taste(nav.zurueck, TITLER_TEXTE.ersterEintrag), weiter: taste(nav.weiter, TITLER_TEXTE.letzterEintrag) } : null,
  };
}

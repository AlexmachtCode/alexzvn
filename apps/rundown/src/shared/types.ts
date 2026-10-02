// Datenmodell + IPC-Typen für JM Rundown (Welle 3a, Slice 1).
//
// Der „autoritative" Zustand (Dokument + scharfe Zeile) lebt im Main-Prozess —
// so kann auch der spätere RUNDOWN-Steuerserver (Companion, Slice 3) navigieren.
// Der Renderer ist Ansicht + Editor und schickt Änderungen per IPC zurück.

import type { ShowIveoProgramRef, ShowIveoSpeaker } from '@jm/show';

/** Eine Aktion, die beim GO an ein Tool gesendet wird. */
export interface RundownAction {
  id: string;
  /** Ziel-Rolle (CAPABILITIES), z. B. 'timer', 'presenter', 'switcher'. */
  role: string;
  /** Protokoll-Verb, z. B. 'start', 'goto', 'take'. */
  verb: string;
  /** Positions-Argumente (Token nach dem Verb). */
  args: (string | number)[];
  /** Deaktivierte Aktionen werden beim GO übersprungen. */
  enabled: boolean;
  /**
   * Verzögerung in Millisekunden VOR dem Feuern dieser Aktion, relativ zur
   * vorherigen Aktion derselben GO-Sequenz (Issue #80). 0/undefined = sofort.
   * So lassen sich Multi-Aktionen einer Zeile zeitlich staffeln.
   */
  delayMs?: number;
  /**
   * Schlüssel des Ablaufpunkts, auf den ein `timer goto` zielt (Master-Link 2a,
   * Spec 6.2). Gesetzt nur durch die Auswahl im Editor oder „an diesen Punkt
   * binden“; der Main rechnet daraus erst beim Senden die Nummer aus.
   */
  zielId?: string;
}

/** Eine Zeile/Segment im Ablaufplan. */
export interface RundownRow {
  id: string;
  label: string;
  note?: string;
  actions: RundownAction[];
  /**
   * Geplante Dauer des Blocks in Millisekunden (Issue #85, Austausch mit dem JM
   * Timer). Rundown selbst feuert zeitlich nicht danach — das Feld wird beim
   * Regieplan-Import übernommen, im Editor pflegbar und beim Export mitgeschrieben,
   * damit ein Ablauf zwischen Rundown und Timer synchron bleibt. 0/undefined = ohne.
   */
  durationMs?: number;
  /**
   * 'ablauf' = Ablaufzeile: stammt aus dem Show-Ablauf, `id` ist der Schlüssel
   * des Ablaufpunkts (Master-Link 2a, Spec 4.1). Fehlt = eigene Zeile.
   */
  quelle?: 'ablauf';
  /**
   * Nur bei quelle 'ablauf': der Punkt fehlt im aktuellen Ablauf, die Zeile
   * bleibt wegen ihrer Aktionen stehen (R5). Entfallene Zeilen feuern nie.
   */
  entfallen?: true;
}

/** Das Rundown-Dokument (Speicherformat `.jmrundown`, Autosave, Gedächtnis). */
export interface RundownDoc {
  schemaVersion: 2;
  name: string;
  rows: RundownRow[];
  /** Kontext der aktuellen rows (Spec 4.4). Fehlt bei Dokumenten, die nie mit einer Show abgeglichen wurden. */
  kontext?: string;
  /** Zeilen anderer Kontexte derselben Show, je Kontext. */
  archiv?: Record<string, RundownRow[]>;
  /** true = Version-1-Dokument, dessen einmalige Titel-Zuordnung (Spec 4.9) noch aussteht. */
  zuordnungOffen?: true;
}

/** Navigationsbefehl (vom UI oder später vom RUNDOWN-Steuerserver). */
export type RundownNav =
  | { t: 'go' }
  | { t: 'next' }
  | { t: 'prev' }
  | { t: 'goto'; n: number };

/** Host/Port eines Tool-Steuer-Endpunkts. */
export interface Endpoint {
  host: string;
  port: number;
}

/** Verbindungsstatus eines vom Conductor entdeckten/konfigurierten Tools. */
export interface ToolLink {
  role: string;
  label: string;
  host: string;
  port: number;
  connected: boolean;
  /** Woher kommt der Endpunkt: mDNS-Fund oder manuelle Eingabe. */
  source: 'mdns' | 'manual';
  /** Letzter STATE-Push des Tools (Tally/Status) — Schlüssel=Wert als Strings. */
  state: Record<string, string> | null;
}

/** Was beim letzten GO tatsächlich an die Tools ging (für die UI-Quittung). */
export interface FireReport {
  rowId: string;
  rowLabel: string;
  /** Pro Aktion: Protokollzeile + ob ein verbundenes Tool sie bekam. */
  sent: { role: string; line: string; delivered: boolean }[];
}

/** Vollständiger Zustand, den der Renderer (und das Ausgabe-/Companion-Bild) sieht. */
export interface RundownState {
  doc: RundownDoc;
  /** Index der scharfen Zeile — aus `scharfId` errechnet (5.3), für Anzeige und STATE `cue=`. */
  index: number;
  /** Kennung der scharfen Zeile (5.3); null bei leerem Dokument. */
  scharfId: string | null;
  filePath: string | null;
  dirty: boolean;
  /** Vom Conductor entdeckte/verbundene Tools. */
  links: ToolLink[];
  /** Manuelle Endpunkt-Overrides je Rolle (Cross-Subnet, mDNS aus). */
  overrides: Record<string, Endpoint>;
  lastFired: FireReport | null;
  /**
   * iveo-Speaker der geöffneten Show (#11, Phase 3) — token-frei. Speist im
   * Row-Editor das Dropdown für `TITLER RECALL <name>`-Cues, damit eine
   * Programmzeile gezielt eine Speaker-Bauchbinde auslöst.
   */
  iveoSpeakers: ShowIveoSpeaker[];
  /**
   * Side Events der geöffneten Show (#11), token-frei (id + Titel). Speist im
   * Row-Editor das Dropdown für `LAUNCHER SIDEEVENT <id>`-Cues: ein GO schaltet
   * die offene Show live auf das gewählte Side Event (Ablauf=Agenda + Speaker).
   */
  iveoSideEvents: ShowIveoProgramRef[];
  /** Änderungszähler des Dokuments (5.5); der Renderer schickt ihn als `basisRev` zurück. */
  rev: number;
  /** Hinweise an den Bediener (4.6); kurze entfernt der Main nach 6 s selbst. */
  hinweise: RundownHinweis[];
  /** Abgewiesene Änderungen (5.5); geht in die React-Schlüssel der Editor-Felder ein. */
  abweisungen: number;
  /** Schlüssel des normalisierten Show-Ablaufs in Reihenfolge (6.2); leer ohne Show. */
  ablaufSchluessel: string[];
  /** Die gemerkte Show hat eine eigene Timer-Liste (6.2: Sprünge über die Nummer). */
  eigeneTimerListe: boolean;
  /** Eine Show ist gemerkt (5.2) — nur dann sind Ablaufzeilen gesperrt (4.5). */
  showGemerkt: boolean;
  /**
   * Texte mit „iveo“ statt „Show“ (4.5, 4.6): die gemerkte Show hat eine
   * iveo-Bindung. Ohne gemerkte Show entscheidet der Kontext des Dokuments.
   */
  showMitIveo: boolean;
}

/** Ein Hinweis an den Bediener (4.6). Kurze verschwinden nach 6 s, stehende per `hinweisWeg`. */
export interface RundownHinweis {
  id: number;
  text: string;
  art: 'kurz' | 'stehend';
}

// ── Preload-API (window.jmrundown) ───────────────────────────────────────────
export interface JmRundownApi {
  platform: string;
  getState: () => Promise<RundownState>;
  onState: (cb: (s: RundownState) => void) => () => void;
  /** Nur die Tool-Verbindungen/Tally (häufige Updates, ohne den ganzen Doc). */
  onLinks: (cb: (links: ToolLink[]) => void) => () => void;
  /** Navigation/Conductor (GO feuert die scharfe Zeile). */
  nav: (cmd: RundownNav) => Promise<RundownState>;
  /**
   * Test-Knopf im Editor: Aktion `actionId` der Zeile `rowId` sofort feuern. Der
   * Main löst ein Sprung-Ziel auf wie beim GO (6.2). Liefert „zugestellt"; false
   * auch, wenn das Ziel entfallen ist — dann wird nichts gesendet.
   */
  fireAction: (rowId: string, actionId: string) => Promise<boolean>;
  /** Manuellen Endpunkt setzen (host leer = Override entfernen → wieder mDNS). */
  setEndpoint: (role: string, host: string, port: number) => Promise<RundownState>;
  /** Nativen Datei-Dialog öffnen (für Pfad-Argumente, z. B. PRESENTER OPEN). Liefert den gewählten Pfad oder null. */
  pickFile: () => Promise<string | null>;
  /** Regieplan-Datei (XLSX/CSV) wählen + Bytes lesen (Issue #82). null bei Abbruch. */
  importRegieplan: () => Promise<{ name: string; bytes: Uint8Array } | null>;
  /**
   * Dokument ersetzen (Editor speichert den ganzen Doc zurück). `basisRev` ist der
   * `rev` des Stands, auf dem die Änderung beruht (5.5). Lief seitdem ein Abgleich,
   * weist der Main sie ab und zählt `abweisungen` hoch.
   */
  setDoc: (doc: RundownDoc, basisRev: number) => Promise<RundownState>;
  /** Stehenden Hinweis wegklicken (4.6). */
  hinweisWeg: (id: number) => Promise<RundownState>;
  /** „Als eigene Zeile behalten“ für eine entfallene Zeile (4.3). */
  alsEigeneZeile: (rowId: string) => Promise<RundownState>;
  /** Datei-Operationen. */
  newDoc: () => Promise<RundownState>;
  open: () => Promise<RundownState>;
  save: () => Promise<RundownState>;
  saveAs: () => Promise<RundownState>;
}

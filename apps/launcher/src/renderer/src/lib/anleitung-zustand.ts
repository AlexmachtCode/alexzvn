// Zustands-Adapter der Anleitung „Einrichtung“ (Plan, Gliederung 10.3; EP5, EP6, EP17): bildet Store-Zustände auf die
// benannten Bedingungen der Anleitungs-Datei ab. Rein und nur lesend (G3): keine Aktion, kein Fensterzugriff, kein Speicher.
// Nur `import type` (G5): Der Launcher-Selbsttest lädt die Datei mit node --experimental-strip-types.
//
// Regel G7 („Anzeigen lügen nicht“): Eine Voreinstellung zählt nie. Quelle null oder 'none', Verbund-Stand null oder mit
// Dateifehler (Rolle unbekannt, EP6), nicht geladene Steuerebene: Der zugehörige Name ist falsch.
import type { VerbundStand } from '@shared/types';

/** Zustände, die die Anleitung live liest (Bedingung `{ zustand }`). */
export const ZUSTANDS_NAMEN = [
  'quelleVerbunden', 'toolInstalliert', 'reiterWerkzeugkasten', 'reiterShow', 'einstellungenOffen',
  'systemOffen', 'verbundOffen', 'szenarienOffen', 'editorOffen', 'rolleAus', 'rolleMaster', 'rolleSlave', 'slaveGekoppelt',
  'slaveVerbunden', 'steuerebeneSicher', 'steuerebeneOffen', 'showGestartet',
] as const;
/** Ereignisse, die das Tool einmal meldet und der Fortschritt merkt (Bedingung `{ ereignis }`). */
export const EREIGNIS_NAMEN = ['showGespeichert', 'slaveWarVerbunden', 'steuerebeneAktiviert'] as const;
/** Ausdrückliche Entscheidungen des Bedieners in der Sprechblase (Bedingung `{ entscheidung }`). */
export const ENTSCHEIDUNGS_NAMEN = ['allein', 'companionVerbunden', 'showVomMaster'] as const;
export type ZustandsName = (typeof ZUSTANDS_NAMEN)[number];

/** Was der Adapter aus Store, Verbund-Store und Lese-IPC bekommt (Block D baut es in store/anleitung.ts). */
export interface AnleitungsEingang {
  settings: { source: 'proxy' | 'github' | 'none' } | null;
  states: Readonly<Record<string, { status: string }>>;
  view: 'catalog' | 'jmshow';
  settingsOpen: boolean;
  systemOpen: boolean;
  scenariosOpen: boolean;
  showEditorOpen: boolean;
  verbundOffen: boolean;
  verbund: VerbundStand | null;
  steuerebene: 'open' | 'secure' | null;
  recentShows: number;
  laufendeTools: number;
  showLaunch: boolean;
  iveoActive: boolean;
}

/** Texte der Detailzeilen L9, L10 (LAUNCHER_ANLEITUNG_TEXTE.detail aus anleitung/einrichtung.ts, Abweichung B1). */
export interface DetailTexte {
  k1(quelle: 'proxy' | 'github'): string;
  k2(n: number): string;
}

/** Installiert zählt wie in der Checkliste: jeder Status außer 'not-installed' (auch 'update-available', EP5). */
function installiert(states: AnleitungsEingang['states']): number {
  return Object.values(states).filter((s) => s.status !== 'not-installed').length;
}

/** Store → benannte Zustände (EP5). Rolle nur aus einem gelesenen Stand ohne Dateifehler (EP6). */
export function anleitungsZustand(e: AnleitungsEingang): Record<ZustandsName, boolean> {
  const v = e.verbund;
  const rolle = v !== null && (v.dateiFehler ?? null) === null ? v.rolle : null;
  const gekoppelt = rolle === 'slave' && v?.slave?.gekoppelt === true;
  return {
    quelleVerbunden: e.settings !== null && (e.settings.source === 'proxy' || e.settings.source === 'github'),
    toolInstalliert: installiert(e.states) > 0,
    reiterWerkzeugkasten: e.view === 'catalog',
    reiterShow: e.view === 'jmshow',
    einstellungenOffen: e.settingsOpen,
    systemOffen: e.systemOpen,
    verbundOffen: e.verbundOffen,
    szenarienOffen: e.scenariosOpen,
    editorOffen: e.showEditorOpen,
    rolleAus: rolle === 'aus',
    rolleMaster: rolle === 'master',
    rolleSlave: rolle === 'slave',
    slaveGekoppelt: gekoppelt,
    slaveVerbunden: gekoppelt && v?.slave?.client.art === 'verbunden',
    steuerebeneSicher: e.steuerebene === 'secure',
    steuerebeneOffen: e.steuerebene === 'open',
    showGestartet: e.recentShows > 0,
  };
}

/**
 * Am Master folgen Tools anderer Rechner der verteilten Show (`bezieher` = Abos beim Verteiler). Eine andere Show setzt dort
 * am Timer den Countdown zurück (Spec 7, docs/suite-verbund.md „Show-Daten im Verbund“).
 */
function verbundFolgt(v: VerbundStand | null): boolean {
  const s = v?.master?.showImVerbund ?? null;
  return s !== null && s.showName !== null && s.bezieher > 0;
}

/**
 * Produktion (Spec 7, EP17, OFP4): ein Tool dieses Rechners läuft, eine Show startet gerade, eine iveo-Show ist offen (der
 * Main setzt das erst mit einer Show ohne iveo zurück, also auch nach dem Beenden der Tools) oder am Master folgen Tools
 * anderer Rechner der verteilten Show.
 */
export function produktionLaeuft(e: AnleitungsEingang): boolean {
  return e.laufendeTools > 0 || e.showLaunch || e.iveoActive || verbundFolgt(e.verbund);
}

/** Detailzeilen der Kapitelübersicht (L9, L10, Bestand der Checkliste): nur mit Daten, sonst kein Eintrag. */
export function kapitelDetails(e: AnleitungsEingang, texte: DetailTexte): Partial<Record<string, string>> {
  const d: Partial<Record<string, string>> = {};
  const quelle = e.settings?.source;
  if (quelle === 'proxy' || quelle === 'github') d.k1 = texte.k1(quelle);
  const n = installiert(e.states);
  if (n > 0) d.k2 = texte.k2(n);
  return d;
}

/**
 * Ereignisse aus Zustandsübergängen (EP5): 'slaveWarVerbunden', sobald der Slave gekoppelt und verbunden ist und das
 * Ereignis noch nicht gemerkt wurde; `vorher` null (erster Blick nach dem Start) zählt als „nicht verbunden“.
 * 'steuerebeneAktiviert', sobald die Steuerebene vorher offen gelesen war und jetzt sicher ist (in dieser Sitzung aktiviert;
 * erst dann verlangt Kapitel 5 den Neustart). Eine schon beim ersten Lesen sichere Steuerebene zählt nicht: `vorher` null
 * oder noch nicht geladen ist kein „offen“.
 */
export function neueToolEreignisse(
  vorher: Readonly<Record<string, boolean>> | null,
  jetzt: Readonly<Record<string, boolean>>,
  gemerkt: Readonly<Record<string, string>>,
): string[] {
  const neu: string[] = [];
  if (jetzt.slaveVerbunden === true && vorher?.slaveVerbunden !== true && typeof gemerkt.slaveWarVerbunden !== 'string') {
    neu.push('slaveWarVerbunden');
  }
  if (jetzt.steuerebeneSicher === true && vorher?.steuerebeneOffen === true && typeof gemerkt.steuerebeneAktiviert !== 'string') {
    neu.push('steuerebeneAktiviert');
  }
  return neu;
}

// ── Ende des Moduls ──

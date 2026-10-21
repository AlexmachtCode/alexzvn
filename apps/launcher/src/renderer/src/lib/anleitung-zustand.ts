// Zustands-Adapter der Anleitung „Einrichtung“ (Plan, Gliederung 10.3; EP5, EP6, EP17): bildet Store-Zustände auf die
// benannten Bedingungen der Anleitungs-Datei ab. Rein und nur lesend (G3): keine Aktion, kein Fensterzugriff, kein Speicher.
// Nur `import type` (G5): Der Launcher-Selbsttest lädt die Datei mit node --experimental-strip-types.
//
// Regel G7 („Anzeigen lügen nicht“): Eine Voreinstellung zählt nie. Quelle null oder 'none', Verbund-Stand null oder mit
// Dateifehler (Rolle unbekannt, EP6), nicht geladene Steuerebene: Der zugehörige Name ist falsch.
import type {
  Anleitung,
  AnleitungSpeicher,
  AnleitungsAnsicht,
  AnleitungsEreignis,
  AnleitungsFortschritt,
  AnleitungsUmgebung,
  GelesenerFortschritt,
  SpeicherZustand,
  StartErgebnis,
  Zustand,
} from '@jm/ui/anleitung';
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

// ── Eingang aus den Zuständen des Launchers (Plan P12; Spec 5, 7; EP5, EP17; G7, G9) ──

/** Was der Store der Anleitung aus useTools liest: nur die Felder, die der Eingang braucht (strukturell, ohne Laufzeit-Import). */
export interface LauncherLage {
  settings: { source: 'proxy' | 'github' | 'none' } | null;
  states: Readonly<Record<string, { status: string }>>;
  view: 'catalog' | 'jmshow';
  settingsOpen: boolean;
  systemOpen: boolean;
  scenariosOpen: boolean;
  showEditorOpen: boolean;
  recentShows: readonly unknown[];
  presence: ReadonlyArray<{ running: boolean }>;
  showLaunch: object | null;
  iveoActive: object | null;
}

/** Was er aus useVerbund liest. */
export interface VerbundLage {
  offen: boolean;
  stand: VerbundStand | null;
}

/**
 * Der einzige Konstruktor von AnleitungsEingang im Renderer (G9): Zustände des Launchers und des Verbunds und die gelesene
 * Steuerebene. Hier entscheidet sich, ob die Anleitung eine Produktion sieht (EP17: Tool läuft, Show startet, iveo-Show,
 * Master mit Beziehern) und ob Kapitel 3, 5 und 6 abhaken können; eine Voreinstellung bleibt eine (null bleibt null, G7).
 * Der Launcher-Selbsttest prüft die Abbildung als Kreuz (P12).
 */
export function anleitungsEingang(t: LauncherLage, v: VerbundLage, steuerebene: 'open' | 'secure' | null): AnleitungsEingang {
  return {
    settings: t.settings ? { source: t.settings.source } : null,
    states: t.states,
    view: t.view,
    settingsOpen: t.settingsOpen,
    systemOpen: t.systemOpen,
    scenariosOpen: t.scenariosOpen,
    showEditorOpen: t.showEditorOpen,
    verbundOffen: v.offen,
    verbund: v.stand,
    steuerebene,
    recentShows: t.recentShows.length,
    laufendeTools: t.presence.filter((p) => p.running).length,
    showLaunch: t.showLaunch !== null,
    iveoActive: t.iveoActive !== null,
  };
}

// ── Treiber des Stores der Anleitung (Plan P12; Spec 3–8; EP4, EP5, EP7, EP8, EP17, EP23, EP24; G7, G8, G15) ──
// Was store/anleitung.ts entscheidet, steht hier rein und ohne Laufzeit-Import: Start (einmal je Fenster), Ereignisse,
// Merken, Abgleich mit den Zuständen des Launchers, Produktion und „unklar“ nach dem Start, „Stimme trotzdem an“. Der Store
// reicht den echten Ablaufkern aus @jm/ui/anleitung, den Speicher, die Uhr, einen Wecker und seinen Zustand herein; der
// Launcher-Selbsttest tut dasselbe mit Attrappen (P12, P14, P15).

/** Die Funktionen des Ablaufkerns, die der Treiber braucht (Gliederung 10.1; der Store reicht die echten herein). */
export interface AnleitungsKern {
  leseFortschritt(s: AnleitungSpeicher | null, schluessel: string, anleitung: string): GelesenerFortschritt;
  beimStart(a: Anleitung, g: GelesenerFortschritt, u: { bestehenderRechner: boolean }, jetzt: string): StartErgebnis;
  anleitungSchritt(a: Anleitung, f: AnleitungsFortschritt, e: AnleitungsEreignis, z: Zustand, jetzt: string): AnleitungsFortschritt;
  schreibeFortschritt(s: AnleitungSpeicher | null, schluessel: string, f: AnleitungsFortschritt): boolean;
}

/** Was der Treiber im Store liest und setzt (dieselben Felder wie AnleitungStore). */
export interface TreiberStand {
  fortschritt: AnleitungsFortschritt;
  /** Wie gelesen; 'nichtSchreibbar' nach einem Schreibfehler (G7, G8). */
  speicher: SpeicherZustand | 'nichtSchreibbar';
  /** Hinweis „Neu: geführte Einrichtung“ am Knopf (OF2, EP8); auch bei unlesbarem Speicher (EP23). */
  hinweis: boolean;
  jetzt: Zustand;
  produktion: boolean;
  /** Kurz nach dem Start: Tools sind installiert, die Presence sagt aber noch nicht, ob eins läuft (EP24). */
  produktionUnklar: boolean;
  stimmeTrotzdem: boolean;
}

/** Was der Store hereinreicht. */
export interface TreiberUmgebung {
  kern: AnleitungsKern;
  anleitung: Anleitung;
  schluessel: string;
  /** Speicher des Fensters; null, wenn schon der Zugriff wirft (G8). */
  speicher(): AnleitungSpeicher | null;
  eingang(): AnleitungsEingang;
  /** Uhr in Millisekunden. */
  uhr(): number;
  /** Ruft f einmal nach ms Millisekunden auf. */
  wecker(ms: number, f: () => void): void;
  lies(): TreiberStand;
  setze(teil: Partial<TreiberStand>): void;
}

export interface AnleitungsTreiber {
  /** Start (Spec 4, EP7, EP8): einmal je Fenster wirksam; ein zweiter Aufruf gibt das erste Ergebnis zurück (D15). */
  starte(u: { bestehenderRechner: boolean }): 'anleitung' | 'hinweis' | null;
  /** Ereignis an den Ablaufkern; vor starte ohne Wirkung (D6). */
  ereignis(e: AnleitungsEreignis): void;
  /** Abgleich mit den Zuständen des Launchers (Abos, Steuerebene, Wecker); vor starte ohne Wirkung. */
  pruefe(): void;
  zustand(): Zustand;
  /** „Stimme trotzdem an“ (U22): wirkt nur während einer Produktion und gilt bis zu ihrem Ende (G15). */
  stimmeTrotzdemAn(): void;
  /** Knopf „Erste Schritte“ (Task 15, EP20): pausieren, „Zeig mir“ beenden, Hinweis aus — bevor die Übersicht öffnet. */
  zurUebersicht(): void;
}

/**
 * Nach einem Neustart des Launchers meldet sich jedes laufende Tool spätestens mit seinem nächsten Herzschlag (HEARTBEAT_MS
 * = 10 s in @jm/app-runtime); bis dahin ist die Presence leer, obwohl Tools laufen können. Dazu 2 s Luft (EP24).
 */
export const PRESENCE_FRIST_MS = 12_000;

export function erzeugeAnleitungsTreiber(o: TreiberUmgebung): AnleitungsTreiber {
  let gestartet = false;
  let erstesErgebnis: 'anleitung' | 'hinweis' | null = null;
  let startMs = 0;
  let letzterZustand: Readonly<Record<string, boolean>> | null = null;
  const zeit = (): string => new Date(o.uhr()).toISOString();
  const zustand = (): Zustand => anleitungsZustand(o.eingang());

  /** Merken (G8): nie bei unlesbarem oder neuerem Speicher; ein Schreibfehler wird zur Diagnose, ein späterer Erfolg zu „ok“. */
  function merke(f: AnleitungsFortschritt): void {
    const { speicher } = o.lies();
    if (speicher === 'nichtLesbar' || speicher === 'neuer') return;
    if (!o.kern.schreibeFortschritt(o.speicher(), o.schluessel, f)) o.setze({ speicher: 'nichtSchreibbar' });
    else if (speicher === 'nichtSchreibbar') o.setze({ speicher: 'ok' });
  }

  function ereignis(e: AnleitungsEreignis): void {
    if (!gestartet) return;
    const vorher = o.lies().fortschritt;
    const f = o.kern.anleitungSchritt(o.anleitung, vorher, e, zustand(), zeit());
    if (JSON.stringify(f) === JSON.stringify(vorher)) return;
    o.setze({ fortschritt: f });
    merke(f);
  }

  /**
   * Abgleich (Spec 5, 7; EP5, EP17, EP24): geänderter Zustand → Kern; neue Tool-Ereignisse → Kern. „Unklar“, solange Tools
   * installiert sind, keins als laufend bekannt ist und die Frist seit dem Start läuft. Endet eine Produktion, endet auch
   * „Stimme trotzdem an“: Die nächste beginnt wieder still.
   */
  function pruefe(): void {
    if (!gestartet) return;
    const e = o.eingang();
    const z = anleitungsZustand(e);
    const produktion = produktionLaeuft(e);
    const produktionUnklar = !produktion && installiert(e.states) > 0 && o.uhr() - startMs < PRESENCE_FRIST_MS;
    const s = o.lies();
    const vorher = letzterZustand;
    const geaendert = vorher === null || ZUSTANDS_NAMEN.some((n) => z[n] !== vorher[n]);
    letzterZustand = z;
    if (geaendert || produktion !== s.produktion || produktionUnklar !== s.produktionUnklar) {
      o.setze({ jetzt: z, produktion, produktionUnklar });
    }
    if (s.produktion && !produktion && s.stimmeTrotzdem) o.setze({ stimmeTrotzdem: false });
    const neu = neueToolEreignisse(vorher, z, o.lies().fortschritt.ereignisse);
    for (const name of neu) ereignis({ art: 'toolEreignis', name });
    if (geaendert && neu.length === 0) ereignis({ art: 'zustand' });
  }

  return {
    starte: (u) => {
      if (gestartet) return erstesErgebnis;
      const g = o.kern.leseFortschritt(o.speicher(), o.schluessel, o.anleitung.id);
      const r = o.kern.beimStart(o.anleitung, g, u, zeit());
      // EP23: Ist der Speicher nicht lesbar, startet nichts von selbst; der Hinweis am Knopf zeigt trotzdem auf die Anleitung.
      o.setze({ fortschritt: r.fortschritt, speicher: g.zustand, hinweis: r.oeffnen === 'hinweis' || g.zustand === 'nichtLesbar' });
      if (r.schreiben) merke(r.fortschritt);
      gestartet = true;
      erstesErgebnis = r.oeffnen;
      startMs = o.uhr();
      o.wecker(PRESENCE_FRIST_MS, pruefe);
      pruefe();
      return r.oeffnen;
    },
    ereignis,
    pruefe,
    zustand,
    stimmeTrotzdemAn: () => {
      if (o.lies().produktion) o.setze({ stimmeTrotzdem: true });
    },
    zurUebersicht: () => {
      // „Zeig mir“ endet; ein laufender Hauptlauf pausiert — an der Rückfrage erst zurück zur Einleitung (dort bietet die Blase
      // „Später weiter“ nicht an, AbwA1), am Abschluss wie „Weiter“ (pausiert zeigte der Knopf „fortsetzen · Schritt 6 von 6“,
      // wo nichts fortzusetzen ist). Der Hinweis dieser Sitzung endet (EP8). Danach liegt keine Blase über der Übersicht (D17).
      if (o.lies().fortschritt.einzeln !== null) ereignis({ art: 'spaeter' });
      const f = o.lies().fortschritt;
      if (f.status === 'laeuft' && f.position?.ort === 'abschluss') {
        ereignis({ art: 'weiter' });
      } else if (f.status === 'laeuft') {
        if (f.position?.ort === 'rueckfrage') ereignis({ art: 'zurueck' });
        ereignis({ art: 'spaeter' });
      }
      o.setze({ hinweis: false });
    },
  };
}

// ── Startregeln (Plan P13; Spec 4, EP7–EP9) ──

/** Eingang der Startentscheidung: was die Anleitung beim Start tut, installierte und zuletzt gesehene Fassung, Notes da? */
export interface StartEingang {
  start: 'anleitung' | 'hinweis' | null;
  version: string | null;
  gesehen: string | null;
  hatNotes: boolean;
}

/**
 * „Was ist neu?“ beim Start (Spec 4, EP9): nie zugleich mit der Anleitung. Startet sie von selbst, wartet „Was ist neu?“,
 * bis sie pausiert oder endet. Beim ersten automatischen Start (noch keine Fassung gesehen) gilt die installierte Fassung
 * als gesehen — sonst käme „Was ist neu?“ beim zweiten Start ohne Update (Ist-L 11 Nr. 1).
 */
export function startEntscheidung(e: StartEingang): {
  patchNotesJetzt: boolean;
  patchNotesNachAnleitung: boolean;
  gesehenSchreiben: string | null;
} {
  const faellig = e.version !== null && e.gesehen !== e.version && e.hatNotes;
  if (e.start === 'anleitung' && e.gesehen === null && e.version !== null) {
    return { patchNotesJetzt: false, patchNotesNachAnleitung: false, gesehenSchreiben: e.version };
  }
  if (e.start === 'anleitung') return { patchNotesJetzt: false, patchNotesNachAnleitung: faellig, gesehenSchreiben: null };
  return { patchNotesJetzt: faellig, patchNotesNachAnleitung: false, gesehenSchreiben: null };
}

// ── Ansicht im Launcher (Plan P14; Spec 6, 7; EP17, EP23, EP24; G7, G15) ──

/** Umgebung der Ansicht (Spec 6, 7): Produktion oder „unklar“ (EP24) schalten die Stimme aus und lassen Eingriffe nur zeigen. */
export function anleitungsUmgebung(
  s: { produktion: boolean; produktionUnklar: boolean; stimmeAn: boolean; stimmeTrotzdem: boolean },
  vorhanden: boolean,
): AnleitungsUmgebung {
  return { produktion: s.produktion || s.produktionUnklar, stimme: { vorhanden, an: s.stimmeAn, trotzdem: s.stimmeTrotzdem } };
}

/** Speicherzustände, in denen der Fortschritt nicht gemerkt wird (G8): nicht lesbar, nicht schreibbar, neuere Fassung. */
const NICHT_GEMERKT: ReadonlyArray<TreiberStand['speicher']> = ['nichtLesbar', 'nichtSchreibbar', 'neuer'];

/**
 * Was die Sprechblase im Launcher zeigt (G7, EP23, EP24). Ist die Produktion nur unklar, gilt für Stimme und Eingriffe
 * Produktion, aber die Blase behauptet keine: ohne die Warnung U18, und statt U21 steht `stimmeWartet` (L15). Merkt der
 * Rechner den Fortschritt nicht, steht `nichtGemerkt` (U26) darunter, an jedem Schritt (auch am Neustart-Schritt, dessen
 * „Danach geht es hier weiter“ dann nicht gilt). Beide stehen im angezeigten, nicht gesprochenen Feld `wiederfinden`.
 */
export function launcherBlase(
  a: AnleitungsAnsicht,
  s: { produktionUnklar: boolean; speicher: TreiberStand['speicher'] },
  texte: { stimmeWartet: string; nichtGemerkt: string },
): AnleitungsAnsicht {
  if (a.blase === null) return a;
  const b = a.blase;
  const verdeckt = s.produktionUnklar && (b.ansage.hinweis === 'produktion' || b.ansage.hinweis === 'eingriff');
  const hinweise = [b.wiederfinden, verdeckt ? texte.stimmeWartet : null, NICHT_GEMERKT.includes(s.speicher) ? texte.nichtGemerkt : null];
  const text = hinweise.filter((h) => h !== null).join(' ');
  return {
    ...a,
    blase: {
      ...b,
      produktionsWarnung: b.produktionsWarnung && !s.produktionUnklar,
      ansage: verdeckt ? { ...b.ansage, hinweis: null } : b.ansage,
      wiederfinden: text === '' ? null : text,
    },
  };
}

// ── Knopf „Erste Schritte“ (Plan P15; Spec 4, OF2, OFP3) ──

/** Texte des Knopfs: L11 (knopf, knopfTitel), L12 (neu), U12 (fortsetzen); der Aufrufer reicht sie durch (G5). */
export interface ErsteSchritteTexte {
  knopf: string;
  knopfTitel: string;
  neu: string;
  fortsetzen(n: number, m: number): string;
}

/**
 * Sichtbarer Text, Name und Titel des Knopfs „Erste Schritte“: „Einrichtung fortsetzen · Schritt ‹n› von ‹m›“, solange die
 * Anleitung pausiert ist; sonst einmal „Neu: geführte Einrichtung“ auf bestehenden Rechnern; sonst nur das Symbol.
 * Der Name enthält den sichtbaren Text (WCAG 2.5.3), der Titel bleibt.
 */
export function ersteSchritteKnopf(
  a: { fortsetzen: { n: number; m: number } | null; hinweis: boolean },
  t: ErsteSchritteTexte,
): { text: string | null; aria: string; title: string } {
  const text = a.fortsetzen ? t.fortsetzen(a.fortsetzen.n, a.fortsetzen.m) : a.hinweis ? t.neu : null;
  return { text, aria: text === null ? t.knopf : `${t.knopf}: ${text}`, title: t.knopfTitel };
}

// ── Ende des Moduls ──

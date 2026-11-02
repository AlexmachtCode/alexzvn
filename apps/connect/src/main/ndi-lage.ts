// Reine NDI-Lage von JM Connect (Spec 22.3, 22.4, E32–E34, E42, E50–E52): je Gast-NDI-Quelle (5 Zustände) und für den
// Programm-Empfang (9 Zustände) der Zustand aus einer geschlossenen Liste und der Lebenslauf des Prozesses: Generation je
// Prozess, Neustart höchstens dreimal in Folge, Fristen, Peer-Fenster. Dazu die Leser der Utility-Leitung, die Bildwache,
// die Namensliste für T46, die Meldewege onLage/onNamen, die Zählweise e/g/b/s/a und der STATE-Teil ndi_*.
// Rein (G-C2): kein electron und keine Uhr im Modul; die Zeit kommt über jetzt() von der Hülle. Die Lage startet und
// beendet keinen Prozess selbst: Jede Methode gibt Handlungen zurück, die Hüllen (ndi-guests.ts, ndi-program.ts) führen
// sie aus.
//
// Alle Fristen der Ergänzung (OE4 a; E50: auf einer monotonen Uhr, performance.now() bzw. process.hrtime.bigint(), nie
// auf der Wanduhr):
// - 10 s bis „bereit“ nach dem Start eines Prozesses, sonst gescheitert/keinStart (Gast und Programm; hier in tick()).
// - 5 s Lebenszeichen nach „bereit“: ohne jede Meldung beendet der Main den Prozess (Gast und Programm; hier in tick()).
// - 1 s bis zum Neustart nach einem Ausfall nach „bereit“, höchstens dreimal in Folge (hier in tick()).
// - 60 s ununterbrochen nach „bereit“ setzen die Neustarts in Folge auf 0 (hier in tick()).
// - 3 s ohne Videobild: eine Gast-Quelle geht von sendet nach ohneBild (hier in tick()).
// - 3 s Bildwache des Programm-Empfangs: ohneBild und staut (hier programmBildLage(); das Utility ruft sie alle 500 ms).
// - 3 s Pausen des Programm-Empfangs zwischen zwei Suchrunden bzw. Öffnungsversuchen (src/utility/ndi-program-receiver.ts).
// - 3 s bis T140 „NDI: keine Quelle“ für einen eingelassenen Gast ohne Eintrag (Renderer, Regel G, C-EP16).
// Nur die Uhrregel des Raumabbruchs (E57, shared/raum-ansicht.ts) vergleicht bewusst mit der Wanduhr.
// Takt-Lücke (Nachtrag C, R20, R28): Treibt die Hülle tick() im Sekundentakt (`sekundenTakt`), gilt eine Lücke von mehr als
// 2,5 s zwischen zwei tick() als Hänger, Ruhezustand oder Drosselung des Main. Für die Fristen an Meldung, Start und Bild zählt
// von ihr nur ein Nenntakt (1 s): Der tick() nach der Lücke verschiebt deren Anker um die Lücke abzüglich 1 s (hier in tick()).

/** Art einer Gast-NDI-Quelle; die Bildschirm-Quelle hat den Schlüssel `‹Gast-ID›::screen` (`ndiPoolKey`). */
export type NdiArt = 'kamera' | 'bildschirm';
/** Zustand einer Gast-NDI-Quelle (22.3, 5 Werte). */
export type NdiQuelleZustand = 'startet' | 'sendet' | 'ohneBild' | 'neustart' | 'gescheitert';
/** Grund in `gescheitert` (22.3, 8 Werte; Texte T114–T119, T138, T139). */
export type NdiGastGrund = 'addon' | 'init' | 'sender' | 'startAbbruch' | 'absturz' | 'keinPeer' | 'keinStart' | 'unbekannt';

/** Öffentliche Lage einer Gast-Quelle (KF11). */
export interface NdiQuelleLage {
  /** NDI-Pool-Schlüssel (`‹Gast-ID›` bzw. `‹Gast-ID›::screen`); steht in jeder Logzeile. */
  schluessel: string;
  art: NdiArt;
  /** NDI-Name der Quelle (Namensliste für T46); steht nie im Log (E35). */
  label: string;
  zustand: NdiQuelleZustand;
  /** nur in `gescheitert` gesetzt */
  grund: NdiGastGrund | null;
  /** Exit-Code des Prozessendes, das zum Zustand führte (`neustart`, `startAbbruch`, `absturz`), sonst null. */
  code: number | null;
  /** Neustarts in Folge (0–3); in `neustart` die Nummer des laufenden Versuchs. */
  k: number;
  /** NDI-Empfänger des laufenden Prozesses; null bis zum ersten `stat` nach „bereit“. */
  empfaenger: number | null;
}

/**
 * Was die Hülle ausführen soll (C-EP1). `prozessStarten`/`prozessBeenden` nennen die Generation des Prozesses.
 * `neustartPlanen`: die Hülle ruft nach `inMs` `tick()`; den neuen Prozess startet `tick()`, sobald er fällig ist.
 * `log`: eine fertige Logzeile ohne Gast- und NDI-Namen (E35).
 */
export type NdiHandlung =
  | { art: 'prozessStarten'; teil: 'gast' | 'programm'; schluessel: string; generation: number }
  | { art: 'prozessBeenden'; teil: 'gast' | 'programm'; schluessel: string; generation: number }
  | { art: 'neustartPlanen'; teil: 'gast' | 'programm'; schluessel: string; inMs: 1000 }
  | { art: 'log'; zeile: string };

/** Leitung Gast-Utility → Main (22.3, E51); `text` nur fürs Log. */
export type GastMeldung =
  | { type: 'bereit' }
  | { type: 'abbruch'; grund: 'addon' | 'init' | 'sender' | 'unbekannt'; text: string }
  | { type: 'stat'; connections: number };

const GAST_ABBRUCH_GRUENDE = ['addon', 'init', 'sender'] as const;

/**
 * Liest eine Nachricht des Gast-Utility (E51). Unbekannte Art und `stat` ohne ganze Zahl ≥ 0: verworfen (der Grund ist für
 * eine Logzeile der Hülle, ohne Namen); `abbruch` mit unbekanntem Grund: `unbekannt` (T139). Die alten Meldungen `status`
 * und `stopped` gehören nicht zur Leitung.
 */
export function leseGastMeldung(roh: unknown): GastMeldung | { verworfen: string } {
  if (roh === null || typeof roh !== 'object') return { verworfen: 'keine Meldung' };
  const r = roh as { type?: unknown; grund?: unknown; text?: unknown; connections?: unknown };
  if (r.type === 'bereit') return { type: 'bereit' };
  if (r.type === 'abbruch') {
    const grund = GAST_ABBRUCH_GRUENDE.find((g) => g === r.grund) ?? 'unbekannt';
    return { type: 'abbruch', grund, text: typeof r.text === 'string' ? r.text : '' };
  }
  if (r.type === 'stat') {
    const n = r.connections;
    if (typeof n === 'number' && Number.isInteger(n) && n >= 0) return { type: 'stat', connections: n };
    return { verworfen: 'stat ohne gültige Empfängerzahl' };
  }
  return { verworfen: `unbekannte Art ${artName(r.type)}` };
}

/** Art einer verworfenen Meldung fürs Log: nur ein kurzes Wort, sonst „(unlesbar)“ (kein Name im Log, E35). */
function artName(t: unknown): string {
  return typeof t === 'string' && /^[A-Za-z]{1,20}$/.test(t) ? t : '(unlesbar)';
}

/** Text einer Abbruch-Meldung als eine Logzeile, höchstens 300 Zeichen. */
function einzeilig(text: string): string {
  return text.replace(/\s*\n\s*/g, ' | ').slice(0, 300) || '(ohne Text)';
}

// ── Programm-Empfang (22.4, Plan C Task C2) ──

/** Zustand des Programm-Empfangs (22.4, 9 Werte). */
export type NdiProgrammZustand = 'aus' | 'sucht' | 'keineQuelle' | 'verbunden' | 'ohneBild' | 'staut' | 'fehler' | 'neustart' | 'gescheitert';
/** Grund in `gescheitert` (22.4, 7 Werte; ohne `sender`). */
export type NdiProgrammGrund = 'addon' | 'init' | 'startAbbruch' | 'absturz' | 'keinPeer' | 'keinStart' | 'unbekannt';

/** Öffentliche Lage des Programm-Empfangs (KF11). */
export interface NdiProgrammLage {
  zustand: NdiProgrammZustand;
  /** nur in `gescheitert` gesetzt */
  grund: NdiProgrammGrund | null;
  /** Exit-Code des Prozessendes, das zum Zustand führte (`neustart`, `startAbbruch`, `absturz`), sonst null. */
  code: number | null;
  k: number;
  /** NDI-Name der Programm-Quelle; in `verbunden`, `ohneBild`, `staut` und `fehler` immer gesetzt (Leitung), sonst null.
   *  Steht nie im Log (E35). */
  quelle: string | null;
  /** Suchname aus dem Start (`JMPS_PROGRAM_NDI` oder „JM Switcher“), für T122; '' vor dem ersten Start. Nie im Log. */
  hinweis: string;
  /** Der laufende Prozess hat „bereit“ gemeldet (`sucht` gilt vor und nach „bereit“). */
  bereit: boolean;
}

/** Leitung Programm-Utility → Main (22.4, E51); `video` und `audio` gehen an den Peer und nicht durch den Leser. */
export type ProgrammMeldung =
  | { type: 'bereit' }
  | { type: 'abbruch'; grund: 'addon' | 'init' | 'unbekannt'; text: string }
  | { type: 'lage'; zustand: 'sucht' | 'keineQuelle' | 'verbunden' | 'ohneBild' | 'staut' | 'fehler'; quelle?: string };

const PROGRAMM_ABBRUCH_GRUENDE = ['addon', 'init'] as const;
/** Zustände der Leitung ohne Quelle bzw. mit Pflicht-Quelle (22.4). */
const LAGE_OHNE_QUELLE = ['sucht', 'keineQuelle'] as const;
const LAGE_MIT_QUELLE = ['verbunden', 'ohneBild', 'staut', 'fehler'] as const;

/**
 * Liest eine Nachricht des Programm-Utility (E51). Unbekannte Art, `lage` mit unbekanntem Zustand oder ohne Pflicht-Quelle:
 * verworfen; `abbruch` mit unbekanntem Grund: `unbekannt` (T139). Eine Quelle in `sucht`/`keineQuelle` fällt weg. Die alten
 * Meldungen `status` und `stopped` gehören nicht zur Leitung.
 */
export function leseProgrammMeldung(roh: unknown): ProgrammMeldung | { verworfen: string } {
  if (roh === null || typeof roh !== 'object') return { verworfen: 'keine Meldung' };
  const r = roh as { type?: unknown; grund?: unknown; text?: unknown; zustand?: unknown; quelle?: unknown };
  if (r.type === 'bereit') return { type: 'bereit' };
  if (r.type === 'abbruch') {
    const grund = PROGRAMM_ABBRUCH_GRUENDE.find((g) => g === r.grund) ?? 'unbekannt';
    return { type: 'abbruch', grund, text: typeof r.text === 'string' ? r.text : '' };
  }
  if (r.type === 'lage') {
    const ohne = LAGE_OHNE_QUELLE.find((z) => z === r.zustand);
    if (ohne) return { type: 'lage', zustand: ohne };
    const mit = LAGE_MIT_QUELLE.find((z) => z === r.zustand);
    if (!mit) return { verworfen: 'lage mit unbekanntem Zustand' };
    if (typeof r.quelle !== 'string' || r.quelle === '') return { verworfen: `lage ${mit} ohne Quelle` };
    return { type: 'lage', zustand: mit, quelle: r.quelle };
  }
  return { verworfen: `unbekannte Art ${artName(r.type)}` };
}

/** Frist der Bildwache (22.4, E34). */
const BILDWACHE_MS = 3000;

/**
 * Bildwache des Programm-Empfangs (22.4, E34), rein; das Utility ruft sie alle 500 ms. Zeiten in ms auf der monotonen Uhr:
 * `verbundenSeit` Empfänger offen seit, `letztesBild` letztes NDI-Videobild (weitergegeben oder verworfen), `wartetSeit`
 * seit wann ein weitergegebenes Bild auf die Bestätigung des Peers wartet (null: keines). Erste passende Zeile:
 * (1) ein Bild wartet seit mindestens 3 s, und in den letzten 3 s kam ein Bild → `staut`;
 * (2) seit mindestens 3 s kein Bild, gerechnet ab max(Verbinden, letztes Bild) → `ohneBild`; (3) sonst `verbunden`.
 */
export function programmBildLage(e: { jetzt: number; verbundenSeit: number; letztesBild: number | null; wartetSeit: number | null }): 'verbunden' | 'ohneBild' | 'staut' {
  const bildFrisch = e.letztesBild !== null && e.jetzt - e.letztesBild < BILDWACHE_MS;
  if (e.wartetSeit !== null && e.jetzt - e.wartetSeit >= BILDWACHE_MS && bildFrisch) return 'staut';
  if (e.jetzt - Math.max(e.verbundenSeit, e.letztesBild ?? e.verbundenSeit) >= BILDWACHE_MS) return 'ohneBild';
  return 'verbunden';
}

/** Schlüssel des Programm-Empfangs in den Handlungen (`teil: 'programm'`). */
const PROGRAMM = 'programm';

/** Interner Programm-Empfang: öffentliche Lage und Lebenslauf des aktuellen Prozesses (wie `Gast`). */
interface Programm {
  lage: NdiProgrammLage;
  generation: number;
  /** PID des Prozesses dieser Generation ab `spawn` (`prozessPid`), sonst null (E35, C-EB4). */
  pid: number | null;
  prozess: boolean;
  startUm: number;
  bereitUm: number;
  neustartAb: number | null;
  meldungUm: number;
  beendet: boolean;
}

/** Die NDI-Lage von Connect: eine Instanz für alle Gast-Quellen und den Programm-Empfang (C-EP1). */
export interface NdiLage {
  /** Einlass bzw. Beginn der Bildschirmfreigabe (22.3 Nr. 1). Ein bestehender Eintrag bleibt, wie er ist. */
  spinUp(schluessel: string, art: NdiArt, label: string): NdiHandlung[];
  /** Meldung des Prozesses der Generation `generation`, schon gelesen (`leseGastMeldung`, E51). */
  gastMeldung(schluessel: string, generation: number, m: GastMeldung): NdiHandlung[];
  /** `exit` des Prozesses der Generation `generation` (22.3 Nr. 4, 5). */
  gastExit(schluessel: string, generation: number, code: number | null): NdiHandlung[];
  /** Die Hülle hat ein Videobild an den Prozess weitergeleitet (22.3 Nr. 6). */
  videobild(schluessel: string): NdiHandlung[];
  /** Knopf „NDI neu starten“ (22.3 Nr. 9): wirkt nur in `gescheitert`. */
  gastNeustart(schluessel: string): NdiHandlung[];
  /** Kick, Weggang, Ende der Freigabe, Raum schließen, Beenden (22.3 Nr. 10). */
  tearDown(schluessel: string): NdiHandlung[];
  /** Start des Empfangs mit dem Suchnamen (Raum öffnen, 22.4). Ein laufender Prozess endet, k = 0. */
  programmStart(hinweis: string): NdiHandlung[];
  /** Meldung des Prozesses der Generation `generation`, schon gelesen (`leseProgrammMeldung`, E51). */
  programmMeldung(generation: number, m: ProgrammMeldung): NdiHandlung[];
  /** `exit` des Prozesses der Generation `generation`. */
  programmExit(generation: number, code: number | null): NdiHandlung[];
  /** Knopf „Programm neu starten“: wirkt nur in `gescheitert`. */
  programmNeustart(): NdiHandlung[];
  /** `stopProgram` (Raum schließen, Beenden): `aus`, ein geplanter Neustart entfällt, ein `exit` danach ist kein Absturz. */
  programmStop(): NdiHandlung[];
  /** Das Peer-Fenster meldet `render-process-gone` oder `closed` (22.3 Nr. 13, E50); ein Empfang in `aus` bleibt `aus`. */
  peerWeg(): NdiHandlung[];
  /**
   * Zeitgeber (22.3 Nr. 7, 11, 12, 22.4): die Hülle ruft ihn jede Sekunde und nach jedem `neustartPlanen`. Er rechnet die
   * Fristen 10 s bis „bereit“ und 5 s Lebenszeichen (E50), `sendet` → `ohneBild` nach 3 s ohne Videobild, startet fällige
   * Neustarts und setzt nach 60 s ununterbrochen die Neustarts in Folge auf 0. Mit `sekundenTakt` (Nachtrag C, R20, R28): Liegt
   * seit dem vorigen tick() mehr als TAKT_LUECKE_MS (Hänger, Ruhezustand, Drosselung), verschiebt er zuerst die Anker der Fristen
   * an Meldung, Start und Bild jedes laufenden Prozesses um die Lücke abzüglich eines Nenntakts (NENNTAKT_MS), höchstens bis
   * jetzt. Ein gesunder Prozess hatte beim vorigen tick() ein Alter von höchstens etwa 1 s und hat danach höchstens etwa 2 s,
   * unter jeder dieser Fristen; hält die Drosselung an, wächst jedes Alter je tick() um 1 s, und die Fristen greifen wieder, nur
   * langsamer. Fällige Neustarts startet auch er. Der erste tick() nach dem Anlegen ist nie eine Lücke.
   */
  tick(): NdiHandlung[];
  quelleLage(schluessel: string): NdiQuelleLage | null;
  quellen(): NdiQuelleLage[];
  programmLage(): NdiProgrammLage;
  /** NDI-Namen aller Einträge außer `gescheitert`, für T46 (E42). */
  namensListe(): string[];
  /**
   * Die Hülle meldet die PID des Prozesses der Generation `generation`, sobald er läuft (`spawn`). Ab dann steht sie in jeder
   * Logzeile dieser Generation (E35, C-EB4); eine Generation, die gerade keinem Eintrag gehört, ändert nichts. Keine
   * Handlung, kein Rückruf: die PID gehört nicht zur öffentlichen Lage.
   */
  prozessPid(generation: number, pid: number): void;
}

/** Interner Eintrag: die öffentliche Lage und der Lebenslauf des aktuellen Prozesses. */
interface Gast {
  lage: NdiQuelleLage;
  /** Generation des jüngsten Prozesses (0: noch keiner). Ereignisse anderer Generationen ändern nichts. */
  generation: number;
  /** PID des Prozesses dieser Generation, sobald die Hülle sie meldet (`spawn`, `prozessPid`); null davor (E35, C-EB4). */
  pid: number | null;
  /** Der Prozess dieser Generation zählt: gestartet, kein `exit` und nicht von der Lage aufgegeben. */
  prozess: boolean;
  /** Dieser Prozess hat „bereit“ gemeldet. */
  bereit: boolean;
  startUm: number;
  bereitUm: number;
  /** Letztes Videobild (null: keines seit „bereit“); nach einer Takt-Lücke der verschobene Anker der 3-s-Regel. */
  bildUm: number | null;
  /** Ausfall nach „bereit“ um …; der Neustart ist fällig, sobald jetzt() − neustartAb ≥ NEUSTART_MS. */
  neustartAb: number | null;
  /** Letzte Meldung dieses Prozesses (Lebenszeichen, E50). */
  meldungUm: number;
  /** Die Lage hat den Prozess wegen fehlender Lebenszeichen beendet und wartet auf sein `exit` (22.3 Nr. 12). */
  beendet: boolean;
}

/** Neustarts in Folge, danach `gescheitert/absturz` (E33). */
const NEUSTARTS_MAX = 3;
/** Pause bis zum Neustart nach einem Ausfall nach „bereit“ (E33). */
const NEUSTART_MS = 1000;
/** So lange ununterbrochen nach „bereit“, dann sind die Neustarts in Folge 0 (E33). */
const RUECKSETZEN_MS = 60_000;
/** So lange ohne Videobild, dann `sendet` → `ohneBild` (22.3 Nr. 7). */
const OHNE_BILD_MS = 3000;
/** Frist bis „bereit“ nach dem Start eines Prozesses (E50). */
const BEREIT_FRIST_MS = 10_000;
/** Lebenszeichen: so lange nach „bereit“ ohne jede Meldung, dann beendet der Main den Prozess (E50). */
const LEBENSZEICHEN_MS = 5000;
/**
 * Takt-Lücke (Nachtrag C, R20): Mehr als so lange zwischen zwei tick() bei einem Takt von 1 s heißt, der Main stand (Hänger,
 * Ruhezustand bei weiterlaufender Uhr) oder sein Zeitgeber ist gedrosselt. Die Meldungen der Utilities aus dieser Zeit kommen
 * danach erst noch an.
 */
const TAKT_LUECKE_MS = 2500;
/**
 * Nenntakt des Zeitgebers der Hülle (index.ts, 1 s; Nachtrag C, R28): So viel einer Takt-Lücke zählt für die Fristen als
 * beobachtet. Zählte nichts von ihr, froren bei anhaltender Drosselung (jeder Abstand über 2,5 s, etwa App Nap unter macOS im
 * Tray) alle Alter ein, und keine Frist griffe mehr.
 */
const NENNTAKT_MS = 1000;

/**
 * Eine NDI-Lage. `jetzt()` liefert die Zeit der Hülle (monoton, in ms). `onLage` feuert einmal beim Start (nach der Rückgabe,
 * vor jedem Ereignis der Hülle) und bei jeder Änderung der öffentlichen Lage; `onNamen` nur bei geänderter Namensliste (E52).
 * `sekundenTakt`: Die Hülle ruft tick() jede Sekunde (index.ts); dann gilt eine Lücke über TAKT_LUECKE_MS als Hänger,
 * Ruhezustand oder Drosselung (tick()). Ohne (Fälle mit springender Testuhr) rechnet jeder tick() die Fristen ohne Lückenprüfung.
 */
export function erzeugeNdiLage(o: { jetzt(): number; peerDa(): boolean; sekundenTakt?: boolean; onLage?(): void; onNamen?(): void }): NdiLage {
  const gaeste = new Map<string, Gast>();
  let naechsteGeneration = 1;
  /** Zeit des vorigen tick(); null bis zum ersten (der erste tick() nach dem Anlegen ist nie eine Lücke). */
  let letzterTick: number | null = null;
  const p: Programm = {
    lage: { zustand: 'aus', grund: null, code: null, k: 0, quelle: null, hinweis: '', bereit: false },
    generation: 0, pid: null, prozess: false, startUm: 0, bereitUm: 0, neustartAb: null, meldungUm: 0, beendet: false,
  };

  const namensListe = (): string[] =>
    [...gaeste.values()].filter((g) => g.lage.zustand !== 'gescheitert').map((g) => g.lage.label);
  const quellen = (): NdiQuelleLage[] => [...gaeste.values()].map((g) => ({ ...g.lage }));
  /** Führt eine Änderung aus und meldet danach über die Rückrufe, was sich geändert hat (E52). */
  function aendern(f: () => NdiHandlung[]): NdiHandlung[] {
    const vorNamen = JSON.stringify(namensListe());
    const vorLage = JSON.stringify([quellen(), p.lage]);
    const h = f();
    if (JSON.stringify([quellen(), p.lage]) !== vorLage) o.onLage?.();
    if (JSON.stringify(namensListe()) !== vorNamen) o.onNamen?.();
    return h;
  }
  /** Kopf jeder Logzeile einer Gast-Quelle: Schlüssel, Generation und PID dieser Generation („–“, solange die Hülle keine
   *  gemeldet hat); nie ein Name (E35, C-EB4, GG21). */
  const gastKopf = (g: Gast): string => `[ndi-lage] Gast ${g.lage.schluessel} (Generation ${g.generation}, PID ${g.pid ?? '–'})`;
  /** Logzeile eines Zustandswechsels: Kopf, Zustand, Grund, Code, Neustarts (E35). */
  function gastZeile(g: Gast, vorher: string, zusatz = ''): NdiHandlung {
    const l = g.lage;
    const grund = l.grund ? `, Grund ${l.grund}` : '';
    const code = l.code !== null ? `, Code ${l.code}` : '';
    return { art: 'log', zeile: `${gastKopf(g)}: ${vorher} → ${l.zustand}${grund}${code}, Neustarts ${l.k}${zusatz}` };
  }
  /** Ereignisse zählen nur vom laufenden Prozess der aktuellen Generation (22.3, wie ST4 6.9). */
  const aktuell = (g: Gast | undefined, generation: number): g is Gast => g !== undefined && g.generation === generation && g.prozess;
  function starteGast(g: Gast): NdiHandlung {
    g.generation = naechsteGeneration++;
    g.pid = null;
    g.prozess = true;
    g.bereit = false;
    g.startUm = o.jetzt();
    g.neustartAb = null;
    g.beendet = false;
    return { art: 'prozessStarten', teil: 'gast', schluessel: g.lage.schluessel, generation: g.generation };
  }
  const beendeGast = (g: Gast): NdiHandlung => ({ art: 'prozessBeenden', teil: 'gast', schluessel: g.lage.schluessel, generation: g.generation });
  /** `gescheitert` mit Grund; ein Prozess dieser Generation zählt nicht mehr, ein geplanter Neustart entfällt. */
  function gastGescheitert(g: Gast, grund: NdiGastGrund, code: number | null): void {
    g.lage.zustand = 'gescheitert';
    g.lage.grund = grund;
    g.lage.code = code;
    g.lage.empfaenger = null;
    g.prozess = false;
    g.bereit = false;
    g.neustartAb = null;
  }

  /** Kopf jeder Logzeile des Programm-Empfangs: Generation und PID dieser Generation („–“, solange die Hülle keine gemeldet
   *  hat); nie Quelle oder Hinweis (E35, C-EB4, GG21). */
  const programmKopf = (): string => `[ndi-lage] Programm (Generation ${p.generation}, PID ${p.pid ?? '–'})`;
  /** Logzeile des Programm-Empfangs: Kopf, Zustand, Grund, Code, Neustarts (E35). */
  function programmZeile(vorher: string, zusatz = ''): NdiHandlung {
    const l = p.lage;
    const grund = l.grund ? `, Grund ${l.grund}` : '';
    const code = l.code !== null ? `, Code ${l.code}` : '';
    return { art: 'log', zeile: `${programmKopf()}: ${vorher} → ${l.zustand}${grund}${code}, Neustarts ${l.k}${zusatz}` };
  }
  const programmAktuell = (generation: number): boolean => p.generation === generation && p.prozess;
  function starteProgramm(): NdiHandlung {
    p.generation = naechsteGeneration++;
    p.pid = null;
    p.prozess = true;
    p.lage.bereit = false;
    p.startUm = o.jetzt();
    p.neustartAb = null;
    p.beendet = false;
    return { art: 'prozessStarten', teil: 'programm', schluessel: PROGRAMM, generation: p.generation };
  }
  const beendeProgramm = (): NdiHandlung => ({ art: 'prozessBeenden', teil: 'programm', schluessel: PROGRAMM, generation: p.generation });
  function programmGescheitert(grund: NdiProgrammGrund, code: number | null): void {
    p.lage.zustand = 'gescheitert';
    p.lage.grund = grund;
    p.lage.code = code;
    p.lage.quelle = null;
    p.lage.bereit = false;
    p.prozess = false;
    p.neustartAb = null;
  }
  /** Start (Raum öffnen): ein laufender Prozess endet, k = 0, `hinweis` neu; ohne Peer-Fenster `gescheitert/keinPeer`. */
  function programmStartIntern(hinweis: string): NdiHandlung[] {
    const vorher = p.lage.zustand;
    const h: NdiHandlung[] = p.prozess ? [beendeProgramm()] : [];
    p.lage = { zustand: 'sucht', grund: null, code: null, k: 0, quelle: null, hinweis, bereit: false };
    p.prozess = false;
    p.neustartAb = null;
    if (!o.peerDa()) {
      programmGescheitert('keinPeer', null);
      return [...h, programmZeile(vorher)];
    }
    return [...h, starteProgramm(), programmZeile(vorher)];
  }
  /** `stopProgram`: `aus` (der Hinweis bleibt), ein geplanter Neustart entfällt, ein `exit` danach zählt nicht. */
  function programmStopIntern(): NdiHandlung[] {
    if (p.lage.zustand === 'aus') return [];
    const vorher = p.lage.zustand;
    const h: NdiHandlung[] = p.prozess ? [beendeProgramm()] : [];
    p.lage = { zustand: 'aus', grund: null, code: null, k: 0, quelle: null, hinweis: p.lage.hinweis, bereit: false };
    p.prozess = false;
    p.neustartAb = null;
    return [...h, programmZeile(vorher)];
  }

  /**
   * Takt-Lücke (Nachtrag C, R20, R28): Die Anker der Fristen an Meldung (5 s), Start (10 s) und Bild (3 s) jedes laufenden
   * Prozesses rücken um die Lücke abzüglich eines Nenntakts vor, höchstens bis jetzt (eine Meldung, die vor diesem tick() ankam,
   * rückt nicht hinter jetzt). Danach ist jedes Alter um höchstens 1 s größer als beim vorigen tick(): Von der Lücke zählt der
   * Nenntakt, die beobachtete Zeit davor ganz. Ein gesunder Prozess (beim vorigen tick() höchstens etwa 1 s alt) liegt damit bei
   * höchstens etwa 2 s, unter jeder dieser Fristen, auch in diesem tick(); bei anhaltender Drosselung wächst das Alter je tick()
   * um 1 s, und die Fristen greifen wieder, nur langsamer. Nicht verschoben: der Neustart-Wecker `neustartAb` (ein fälliger
   * Neustart startet in diesem tick()) und `bereitUm` als Anker der Rücksetzung nach 60 s; den Anker der 3-s-Regel trägt danach
   * `bildUm`.
   */
  function ankerVerschieben(t: number, luecke: number): void {
    const schub = luecke - NENNTAKT_MS;
    const vor = (anker: number): number => Math.min(anker + schub, t);
    for (const g of gaeste.values()) {
      if (!g.prozess) continue;
      g.startUm = vor(g.startUm);
      g.meldungUm = vor(g.meldungUm);
      if (g.bereit) g.bildUm = vor(Math.max(g.bereitUm, g.bildUm ?? g.bereitUm));
    }
    if (p.prozess) {
      p.startUm = vor(p.startUm);
      p.meldungUm = vor(p.meldungUm);
    }
  }

  /** Zeitgeber (22.3 Nr. 7, 11, 12, 22.4): Takt-Lücke, Fristen 10 s und 5 s, fällige Neustarts, `sendet` → `ohneBild`, Rücksetzung nach 60 s. */
  function tick(): NdiHandlung[] {
    const t = o.jetzt();
    if (o.sekundenTakt && letzterTick !== null && t - letzterTick > TAKT_LUECKE_MS) ankerVerschieben(t, t - letzterTick);
    letzterTick = t;
    const h: NdiHandlung[] = [];
    for (const g of gaeste.values()) {
      if (g.prozess && !g.beendet) {
        if (!g.bereit && t - g.startUm >= BEREIT_FRIST_MS) {
          const vorher = g.lage.zustand;
          h.push(beendeGast(g));
          gastGescheitert(g, 'keinStart', null);
          h.push(gastZeile(g, vorher));
          continue;
        }
        if (g.bereit && t - g.meldungUm >= LEBENSZEICHEN_MS) {
          g.beendet = true;
          h.push(beendeGast(g), { art: 'log', zeile: `${gastKopf(g)}: keine Lebenszeichen seit 5 s, der Main beendet den Prozess` });
        }
      }
      if (g.lage.zustand === 'neustart' && !g.prozess && g.neustartAb !== null && t - g.neustartAb >= NEUSTART_MS) {
        if (o.peerDa()) h.push(starteGast(g), gastZeile(g, 'neustart', ', neuer Prozess'));
        else {
          gastGescheitert(g, 'keinPeer', null);
          h.push(gastZeile(g, 'neustart'));
        }
        continue;
      }
      if (g.lage.zustand === 'sendet' && t - Math.max(g.bereitUm, g.bildUm ?? g.bereitUm) >= OHNE_BILD_MS) {
        g.lage.zustand = 'ohneBild';
        h.push(gastZeile(g, 'sendet'));
      }
      if (g.prozess && g.bereit && t - g.bereitUm >= RUECKSETZEN_MS) g.lage.k = 0;
    }
    if (p.prozess && !p.beendet) {
      if (!p.lage.bereit && t - p.startUm >= BEREIT_FRIST_MS) {
        const vorher = p.lage.zustand;
        h.push(beendeProgramm());
        programmGescheitert('keinStart', null);
        h.push(programmZeile(vorher));
      } else if (p.lage.bereit && t - p.meldungUm >= LEBENSZEICHEN_MS) {
        p.beendet = true;
        h.push(beendeProgramm(), { art: 'log', zeile: `${programmKopf()}: keine Lebenszeichen seit 5 s, der Main beendet den Prozess` });
      }
    }
    if (p.lage.zustand === 'neustart' && !p.prozess && p.neustartAb !== null && t - p.neustartAb >= NEUSTART_MS) {
      if (o.peerDa()) h.push(starteProgramm(), programmZeile('neustart', ', neuer Prozess'));
      else {
        programmGescheitert('keinPeer', null);
        h.push(programmZeile('neustart'));
      }
    }
    if (p.prozess && p.lage.bereit && t - p.bereitUm >= RUECKSETZEN_MS) p.lage.k = 0;
    return h;
  }

  // Einmal beim Start (E52, PK53): nach der Rückgabe der Lage, vor jedem Ereignis der Hülle (Mikroaufgabe, keine Uhr).
  queueMicrotask(() => o.onLage?.());

  return {
    spinUp: (schluessel, art, label) => aendern(() => {
      if (gaeste.has(schluessel)) return [];
      const g: Gast = {
        lage: { schluessel, art, label, zustand: 'startet', grund: null, code: null, k: 0, empfaenger: null },
        generation: 0, pid: null, prozess: false, bereit: false, startUm: 0, bereitUm: 0, bildUm: null, neustartAb: null,
        meldungUm: 0, beendet: false,
      };
      gaeste.set(schluessel, g);
      if (!o.peerDa()) {
        gastGescheitert(g, 'keinPeer', null);
        return [gastZeile(g, 'neu')];
      }
      return [starteGast(g), gastZeile(g, 'neu')];
    }),
    gastMeldung: (schluessel, generation, m) => aendern(() => {
      const g = gaeste.get(schluessel);
      if (!aktuell(g, generation)) return [];
      g.meldungUm = o.jetzt();
      const vorher = g.lage.zustand;
      if (m.type === 'bereit') {
        if (g.bereit) return [];
        g.bereit = true;
        g.bereitUm = o.jetzt();
        g.lage.zustand = 'sendet';
        g.lage.grund = null;
        g.lage.code = null;
        g.lage.empfaenger = null;
        return [gastZeile(g, vorher)];
      }
      if (m.type === 'abbruch') {
        const beenden = beendeGast(g);
        gastGescheitert(g, m.grund, null);
        return [beenden, gastZeile(g, vorher, `, Meldung: ${einzeilig(m.text)}`)];
      }
      if (g.bereit) g.lage.empfaenger = m.connections;
      return [];
    }),
    gastExit: (schluessel, generation, code) => aendern(() => {
      const g = gaeste.get(schluessel);
      if (!aktuell(g, generation)) return [];
      const vorher = g.lage.zustand;
      g.prozess = false;
      if (!g.bereit) {
        gastGescheitert(g, 'startAbbruch', code);
        return [gastZeile(g, vorher)];
      }
      if (g.lage.k < NEUSTARTS_MAX) {
        g.lage.zustand = 'neustart';
        g.lage.k += 1;
        g.lage.grund = null;
        g.lage.code = code;
        g.lage.empfaenger = null;
        g.bereit = false;
        g.neustartAb = o.jetzt();
        return [{ art: 'neustartPlanen', teil: 'gast', schluessel, inMs: NEUSTART_MS }, gastZeile(g, vorher)];
      }
      gastGescheitert(g, 'absturz', code);
      return [gastZeile(g, vorher)];
    }),
    videobild: (schluessel) => aendern(() => {
      const g = gaeste.get(schluessel);
      if (!g) return [];
      g.bildUm = o.jetzt();
      if (g.lage.zustand !== 'ohneBild') return [];
      g.lage.zustand = 'sendet';
      return [gastZeile(g, 'ohneBild')];
    }),
    gastNeustart: (schluessel) => aendern(() => {
      const g = gaeste.get(schluessel);
      if (!g || g.lage.zustand !== 'gescheitert') return [];
      g.lage.k = 0;
      if (!o.peerDa()) {
        gastGescheitert(g, 'keinPeer', null);
        return [gastZeile(g, 'gescheitert', ', Knopf „NDI neu starten“')];
      }
      g.lage.zustand = 'startet';
      g.lage.grund = null;
      g.lage.code = null;
      return [starteGast(g), gastZeile(g, 'gescheitert', ', Knopf „NDI neu starten“')];
    }),
    tearDown: (schluessel) => aendern(() => {
      const g = gaeste.get(schluessel);
      if (!g) return [];
      const h: NdiHandlung[] = [];
      if (g.prozess) h.push(beendeGast(g));
      gaeste.delete(schluessel);
      h.push({ art: 'log', zeile: `${gastKopf(g)}: ${g.lage.zustand} → abgebaut` });
      return h;
    }),
    programmStart: (hinweis) => aendern(() => programmStartIntern(hinweis)),
    programmMeldung: (generation, m) => aendern(() => {
      if (!programmAktuell(generation)) return [];
      p.meldungUm = o.jetzt();
      const vorher = p.lage.zustand;
      if (m.type === 'bereit') {
        if (p.lage.bereit) return [];
        p.lage.bereit = true;
        p.bereitUm = o.jetzt();
        p.lage.zustand = 'sucht';
        p.lage.grund = null;
        p.lage.code = null;
        return [programmZeile(vorher)];
      }
      if (m.type === 'abbruch') {
        const beenden = beendeProgramm();
        programmGescheitert(m.grund, null);
        return [beenden, programmZeile(vorher, `, Meldung: ${einzeilig(m.text)}`)];
      }
      if (!p.lage.bereit) return [];
      const quelle = m.quelle ?? null;
      if (m.zustand === p.lage.zustand && quelle === p.lage.quelle) return [];
      p.lage.zustand = m.zustand;
      p.lage.quelle = quelle;
      return [programmZeile(vorher)];
    }),
    programmExit: (generation, code) => aendern(() => {
      if (!programmAktuell(generation)) return [];
      const vorher = p.lage.zustand;
      p.prozess = false;
      if (!p.lage.bereit) {
        programmGescheitert('startAbbruch', code);
        return [programmZeile(vorher)];
      }
      if (p.lage.k < NEUSTARTS_MAX) {
        p.lage.zustand = 'neustart';
        p.lage.k += 1;
        p.lage.grund = null;
        p.lage.code = code;
        p.lage.quelle = null;
        p.lage.bereit = false;
        p.neustartAb = o.jetzt();
        return [{ art: 'neustartPlanen', teil: 'programm', schluessel: PROGRAMM, inMs: NEUSTART_MS }, programmZeile(vorher)];
      }
      programmGescheitert('absturz', code);
      return [programmZeile(vorher)];
    }),
    programmNeustart: () => aendern(() => {
      if (p.lage.zustand !== 'gescheitert') return [];
      p.lage.k = 0;
      if (!o.peerDa()) {
        programmGescheitert('keinPeer', null);
        return [programmZeile('gescheitert', ', Knopf „Programm neu starten“')];
      }
      p.lage.zustand = 'sucht';
      p.lage.grund = null;
      p.lage.code = null;
      return [starteProgramm(), programmZeile('gescheitert', ', Knopf „Programm neu starten“')];
    }),
    programmStop: () => aendern(programmStopIntern),
    peerWeg: () => aendern(() => {
      const h: NdiHandlung[] = [];
      for (const g of gaeste.values()) {
        if (g.lage.zustand === 'gescheitert' && g.lage.grund === 'keinPeer') continue;
        const vorher = g.lage.zustand;
        if (g.prozess) h.push(beendeGast(g));
        gastGescheitert(g, 'keinPeer', null);
        h.push(gastZeile(g, vorher, ', Peer-Fenster weg'));
      }
      if (p.lage.zustand !== 'aus' && !(p.lage.zustand === 'gescheitert' && p.lage.grund === 'keinPeer')) {
        const vorher = p.lage.zustand;
        if (p.prozess) h.push(beendeProgramm());
        programmGescheitert('keinPeer', null);
        h.push(programmZeile(vorher, ', Peer-Fenster weg'));
      }
      return h;
    }),
    tick: () => aendern(tick),
    quelleLage: (schluessel) => {
      const g = gaeste.get(schluessel);
      return g ? { ...g.lage } : null;
    },
    quellen,
    programmLage: () => ({ ...p.lage }),
    namensListe,
    prozessPid: (generation, pid) => {
      for (const g of gaeste.values()) if (g.generation === generation) g.pid = pid;
      if (p.generation === generation) p.pid = pid;
    },
  };
}

/** Zählweise der dauerhaften Anzeigen (E42): e Einträge, g bestehende (`sendet`, `ohneBild`), davon b in `ohneBild`,
 *  s startende (`startet`), a ausgefallene (`neustart`, `gescheitert`). */
export interface NdiZahlen { e: number; g: number; b: number; s: number; a: number }

export function ndiZahlen(q: readonly NdiQuelleLage[]): NdiZahlen {
  const n = (f: (z: NdiQuelleZustand) => boolean): number => q.filter((x) => f(x.zustand)).length;
  return {
    e: q.length,
    g: n((z) => z === 'sendet' || z === 'ohneBild'),
    b: n((z) => z === 'ohneBild'),
    s: n((z) => z === 'startet'),
    a: n((z) => z === 'neustart' || z === 'gescheitert'),
  };
}

/** Wort des Programm-Zustands im STATE (22.6, T136). */
const PROGRAMM_STATE_WORT: Record<NdiProgrammZustand, string> = {
  aus: 'aus', sucht: 'sucht', keineQuelle: 'keine_quelle', verbunden: 'verbunden', ohneBild: 'ohne_bild', staut: 'staut',
  fehler: 'fehler', neustart: 'neustart', gescheitert: 'gescheitert',
};
/** Programm-Zustände mit Alarm (22.6); nicht `sucht`, `keineQuelle`, `ohneBild`: die Ursache sieht Connect nicht (MS30). */
const PROGRAMM_ALARM: readonly NdiProgrammZustand[] = ['fehler', 'staut', 'neustart', 'gescheitert'];

/** STATE-Teil `ndi` (22.6): vier Schlüssel in jeder Lage, auf beiden Plattformen; ein Gast ohne Eintrag zählt nicht (T140). */
export function ndiStateKv(q: readonly NdiQuelleLage[], p: NdiProgrammLage): { ndi_sources: number; ndi_failed: number; ndi_program: string; ndi_alarm: 0 | 1 } {
  const z = ndiZahlen(q);
  return {
    ndi_sources: z.g,
    ndi_failed: z.a,
    ndi_program: PROGRAMM_STATE_WORT[p.zustand],
    ndi_alarm: z.a > 0 || PROGRAMM_ALARM.includes(p.zustand) ? 1 : 0,
  };
}

// ── Ende des Moduls ──

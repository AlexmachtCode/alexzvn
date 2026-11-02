// Reine NDI-Lage von JM Connect (Spec 22.3, E32, E33, E42, E51): je Gast-NDI-Quelle der Zustand aus einer geschlossenen
// Liste (5 Werte) und der Lebenslauf ihres Prozesses: Generation je Prozess, Neustart nach 1 s höchstens dreimal in Folge,
// 60 s ununterbrochen nach „bereit“ setzen die Folge zurück. Dazu der Leser der Gast-Leitung und die Namensliste für T46.
// Rein (G-C2): kein electron und keine Uhr im Modul; die Zeit kommt über jetzt() von der Hülle. Die Lage startet und
// beendet keinen Prozess selbst: Jede Methode gibt Handlungen zurück, die Hülle (ndi-guests.ts) führt sie aus.
// Plan C: Task C2 ergänzt den Programm-Empfang (22.4), Task C3 die Fristen, das Peer-Fenster, onLage und den STATE-Teil.

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

/** Die NDI-Lage von Connect: eine Instanz für alle Gast-Quellen. */
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
  /** Zeitgeber: jede Sekunde und nach jedem `neustartPlanen` (22.3 Nr. 7, fällige Neustarts). */
  tick(): NdiHandlung[];
  quelleLage(schluessel: string): NdiQuelleLage | null;
  quellen(): NdiQuelleLage[];
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
  bildUm: number | null;
  /** Ausfall nach „bereit“ um …; der Neustart ist fällig, sobald jetzt() − neustartAb ≥ NEUSTART_MS. */
  neustartAb: number | null;
}

/** Neustarts in Folge, danach `gescheitert/absturz` (E33). */
const NEUSTARTS_MAX = 3;
/** Pause bis zum Neustart nach einem Ausfall nach „bereit“ (E33). */
const NEUSTART_MS = 1000;
/** So lange ununterbrochen nach „bereit“, dann sind die Neustarts in Folge 0 (E33). */
const RUECKSETZEN_MS = 60_000;
/** So lange ohne Videobild, dann `sendet` → `ohneBild` (22.3 Nr. 7). */
const OHNE_BILD_MS = 3000;

/** Eine NDI-Lage. `jetzt()` liefert die Zeit der Hülle (monoton, in ms); `onNamen` nur bei geänderter Namensliste (E52). */
export function erzeugeNdiLage(o: { jetzt(): number; peerDa(): boolean; onLage?(): void; onNamen?(): void }): NdiLage {
  const gaeste = new Map<string, Gast>();
  let naechsteGeneration = 1;

  const namensListe = (): string[] =>
    [...gaeste.values()].filter((g) => g.lage.zustand !== 'gescheitert').map((g) => g.lage.label);
  const quellen = (): NdiQuelleLage[] => [...gaeste.values()].map((g) => ({ ...g.lage }));
  /** Führt eine Änderung aus und meldet danach über die Rückrufe, was sich geändert hat (E52). */
  function aendern(f: () => NdiHandlung[]): NdiHandlung[] {
    const vorNamen = JSON.stringify(namensListe());
    const h = f();
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

  /** Zeitgeber (22.3 Nr. 7): fällige Neustarts, `sendet` → `ohneBild`, Rücksetzung der Neustarts nach 60 s. */
  function tick(): NdiHandlung[] {
    const t = o.jetzt();
    const h: NdiHandlung[] = [];
    for (const g of gaeste.values()) {
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
    return h;
  }

  return {
    spinUp: (schluessel, art, label) => aendern(() => {
      if (gaeste.has(schluessel)) return [];
      const g: Gast = {
        lage: { schluessel, art, label, zustand: 'startet', grund: null, code: null, k: 0, empfaenger: null },
        generation: 0, pid: null, prozess: false, bereit: false, startUm: 0, bereitUm: 0, bildUm: null, neustartAb: null,
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
    tick: () => aendern(tick),
    quelleLage: (schluessel) => {
      const g = gaeste.get(schluessel);
      return g ? { ...g.lage } : null;
    },
    quellen,
    namensListe,
    prozessPid: (generation, pid) => {
      for (const g of gaeste.values()) if (g.generation === generation) g.pid = pid;
    },
  };
}

// ── Ende des Moduls ──

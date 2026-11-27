// Rückfrage beim Schließen des Fensters (Altfehler RE-7a; B3, D4). Rein, ohne Electron: der Hauptprozess (main/index.ts) entscheidet mit
// `schliessenEntscheid` über jedes `close` und führt die Frage mit `SchliessenAblauf`; das Fenster zeigt sie (views/SchliessenFrage.tsx).
// Läuft eine Aufnahme, fragt das Schließen im Fenster nach, ohne den Hauptprozess anzuhalten (Audioblöcke, IPC und Steuerserver laufen
// weiter). Bestätigt das Fenster die Frage nicht binnen SCHLIESSEN_RUECKFALL_MS, fragt der Hauptprozess mit einem nicht blockierenden
// nativen Dialog. Die erste Antwort gilt, aus dem Fenster oder aus dem Rückfall-Dialog.
import type { RecorderStatus } from './types';

/** So lange wartet der Hauptprozess auf „gezeigt“ aus dem Fenster, dann fragt er selbst (B3). */
export const SCHLIESSEN_RUECKFALL_MS = 1000;

/** Texte der Rückfrage, im Fenster und im nativen Rückfall-Dialog gleich (RECORDER_TEXTE.schliessen verweist hierher, K4). */
export const SCHLIESSEN_TEXTE = {
  frage: 'Aufnahme läuft. Wirklich beenden?',
  detail: 'Die Aufnahme wird abgeschlossen und gespeichert, danach schließt der Recorder.',
  beenden: 'Aufnahme beenden',
  weiter: 'Weiter aufnehmen',
} as const;

/**
 * Was ein `close` des Fensters tut: `schliessen` (bestätigt oder ohne Aufnahme, wie bisher), `fragen` (eine Aufnahme läuft) oder `warten`
 * (die Frage ist schon offen; sie bleibt offen bis zur Antwort, auch wenn die Aufnahme inzwischen endete, D4).
 */
export function schliessenEntscheid(l: { status: RecorderStatus; bestaetigt: boolean; frageOffen: boolean }): 'schliessen' | 'fragen' | 'warten' {
  if (l.bestaetigt) return 'schliessen';
  if (l.frageOffen) return 'warten';
  return l.status === 'recording' ? 'fragen' : 'schliessen';
}

/** Uhr des Ablaufs; im Betrieb setTimeout und clearTimeout, im Test eine Schein-Uhr. */
export interface SchliessenUhr {
  setze(f: () => void, ms: number): unknown;
  loesche(t: unknown): void;
}

const ECHTE_UHR: SchliessenUhr = {
  setze: (f, ms) => setTimeout(f, ms),
  loesche: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
};

/**
 * Eine offene Rückfrage (D4): `stelle` öffnet sie und startet die Frist für den Rückfall (false, wenn schon eine offen ist); `gezeigt`
 * (das Fenster zeigt sie) löscht die Frist; `antwort` schließt sie und gibt nur für die erste Antwort true.
 * Fix-Runde 1 (Befund 1): `erneut` startet die Frist einer offenen Frage neu (die Frage ging im Fenster verloren, etwa durch Neuladen),
 * `sofort` ruft den Rückfall ohne Frist (der Renderer ist weg). Steht der Rückfall schon, tun beide nichts: es gibt keinen zweiten Dialog.
 * Fix-Runde 2 (Ruling R20): läuft die Frist noch, lässt `erneut` sie stehen (der Rückfall bleibt 1 s nach dem ersten Schließen); neu beginnt
 * sie nur, wenn sie schon endete („gezeigt“).
 */
export class SchliessenAblauf {
  private istOffen = false;
  private frist: unknown = null;
  private rueckfallLaeuft = false;
  private readonly uhr: SchliessenUhr;

  constructor(uhr: SchliessenUhr = ECHTE_UHR) {
    this.uhr = uhr;
  }

  get offen(): boolean {
    return this.istOffen;
  }

  stelle(rueckfall: () => void): boolean {
    if (this.istOffen) return false;
    this.istOffen = true;
    this.rueckfallLaeuft = false;
    this.starteFrist(rueckfall);
    return true;
  }

  erneut(rueckfall: () => void): boolean {
    if (!this.istOffen || this.rueckfallLaeuft) return false;
    if (this.frist === null) this.starteFrist(rueckfall);
    return true;
  }

  sofort(rueckfall: () => void): boolean {
    if (!this.istOffen || this.rueckfallLaeuft) return false;
    this.gezeigt();
    this.rueckfallLaeuft = true;
    rueckfall();
    return true;
  }

  gezeigt(): void {
    if (this.frist === null) return;
    this.uhr.loesche(this.frist);
    this.frist = null;
  }

  antwort(): boolean {
    if (!this.istOffen) return false;
    this.istOffen = false;
    this.rueckfallLaeuft = false;
    this.gezeigt();
    return true;
  }

  private starteFrist(rueckfall: () => void): void {
    this.frist = this.uhr.setze(() => {
      this.frist = null;
      this.rueckfallLaeuft = true;
      rueckfall();
    }, SCHLIESSEN_RUECKFALL_MS);
  }
}

/** Was die Rückfrage vom Hauptprozess braucht; main/index.ts setzt dafür Fenster, Dialog und App ein. */
export interface SchliessenPorts {
  /** Gemessener Status des Aufnahmekerns. */
  status(): RecorderStatus;
  /** `recorder:schliessenFrage` an das Fenster (true stellt die Frage, false schließt sie), solange es lebt. */
  sendeFrage(offen: boolean): void;
  /** Nicht blockierender nativer Dialog; liefert den gewählten Knopf (0 = „Aufnahme beenden“). */
  frageNativ(): Promise<number>;
  /** Das Fenster schließen (wie der Knopf des Fensters). */
  schliesse(): void;
  /** Wartet ein Beenden-Wunsch der App (Mac Cmd+Q, app.quit)? */
  beendenGewuenscht(): boolean;
  /** „Weiter aufnehmen“ verwirft den Beenden-Wunsch. */
  wunschVerwerfen(): void;
  /** Die App beenden. */
  beende(): void;
  /**
   * Fix-Welle (Ruling S2-R26, I1): die Köpfe aller offenen Aufnahmedateien mit den aktuellen Größen neu schreiben, ohne zu schließen
   * (main/recorder.ts `kopfAktualisieren`).
   */
  kopfAktualisieren(): void;
}

/**
 * Die Rückfrage beim Schließen im Hauptprozess (Altfehler RE-7a; B3, D4; Fix-Runde 1, Befund 1), ohne Electron und darum mit Ports und
 * Schein-Uhr testbar. Ein `close` fragt in der Aufnahme nach; ist die Frage schon offen, geht sie erneut ans Fenster und die Frist beginnt
 * neu (das Fenster kann sie durch Neuladen oder einen Absturz verloren haben), seit Fix-Runde 2 (R20) nur, wenn sie schon endete. Nach
 * einem Neuladen (`geladen`) geht eine offene Frage erneut hin; ist der Renderer weg (`rendererWeg`), fragt sofort der native Dialog. Die
 * erste Antwort gilt, aus dem Fenster oder dem Dialog.
 */
export class SchliessenSteuerung {
  readonly ablauf: SchliessenAblauf;
  private bestaetigt = false;
  private readonly p: SchliessenPorts;

  constructor(p: SchliessenPorts, uhr?: SchliessenUhr) {
    this.p = p;
    this.ablauf = new SchliessenAblauf(uhr);
  }

  /** `close` des Fensters; true heißt: das Schließen verhindern (es wird gefragt oder die Frage ist offen). */
  beimSchliessen(): boolean {
    const e = schliessenEntscheid({ status: this.p.status(), bestaetigt: this.bestaetigt, frageOffen: this.ablauf.offen });
    if (e === 'schliessen') return false;
    // Fix-Welle (Ruling S2-R26, I1): jede Schließ-Anfrage während einer Aufnahme schreibt zuerst die Dateiköpfe mit den aktuellen Größen
    // neu. Der Installer eines Updates oder einer Deinstallation schickt WM_CLOSE und beendet etwa 1,3 s später hart; ohne diesen Schritt
    // bliebe dann der Platzhalter-Kopf stehen. Scheitert er, kommt die Frage trotzdem (die Logzeile schreibt der Aufnahmekern).
    if (this.p.status() === 'recording') {
      try {
        this.p.kopfAktualisieren();
      } catch {
        // die Frage läuft trotzdem
      }
    }
    if (e === 'fragen') {
      this.ablauf.stelle(this.rueckfall);
      this.p.sendeFrage(true);
    } else if (this.ablauf.erneut(this.rueckfall)) {
      this.p.sendeFrage(true);
    }
    return true;
  }

  /** Das Fenster hat (neu) geladen: eine offene Frage geht erneut hin, die Frist beginnt neu, wenn sie schon endete (Fix-Runde 2, R20). */
  geladen(): void {
    if (this.ablauf.erneut(this.rueckfall)) this.p.sendeFrage(true);
  }

  /** Der Renderer ist weg (Absturz, beendet): eine offene Frage geht sofort an den nativen Dialog. */
  rendererWeg(): void {
    this.ablauf.sofort(this.rueckfall);
  }

  /** Antwort des Fensters (`recorder:schliessenAntwort`). */
  antwortFenster(a: 'gezeigt' | 'beenden' | 'weiter'): void {
    if (a === 'gezeigt') this.ablauf.gezeigt();
    else this.antworte(a === 'beenden');
  }

  /**
   * Abmelden oder Herunterfahren: das Fenster schließt ohne Frage (B3). Fix-Runde 2 (Ruling R19): nur für diesen Weg. Eine offene Frage
   * schließt (im Fenster, ihre Frist endet, eine spätere Antwort des nativen Dialogs zählt nicht); der Aufrufer beendet danach mit
   * `shutdown()` die Aufnahme, darum geht das Schließen durch. Nichts gilt auf Dauer: eine neue Aufnahme im selben Fenster fragt wieder.
   */
  ohneFrage(): void {
    if (this.ablauf.antwort()) this.p.sendeFrage(false);
  }

  private readonly rueckfall = (): void => {
    this.p.sendeFrage(false);
    this.p.frageNativ().then(
      (knopf) => this.antworte(knopf === 0),
      () => this.antworte(false),
    );
  };

  private antworte(beenden: boolean): void {
    if (!this.ablauf.antwort()) return;
    if (!beenden) {
      this.p.wunschVerwerfen();
      return;
    }
    this.bestaetigt = true;
    this.p.schliesse();
    if (this.p.beendenGewuenscht()) this.p.beende();
  }
}

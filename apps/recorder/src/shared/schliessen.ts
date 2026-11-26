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
 */
export class SchliessenAblauf {
  private istOffen = false;
  private frist: unknown = null;
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
    this.frist = this.uhr.setze(() => {
      this.frist = null;
      rueckfall();
    }, SCHLIESSEN_RUECKFALL_MS);
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
    this.gezeigt();
    return true;
  }
}

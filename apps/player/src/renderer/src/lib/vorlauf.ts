// Altfehler PL-11: Vorlauf-Zeitgeber (Pre-Wait) der Cue-Show, die die Pause anhalten kann. Rein: Uhr und Zeitgeber kommen
// über `Uhr` herein (Standard: performance.now/setTimeout/clearTimeout), der Test treibt sie mit einer Schein-Uhr.

export interface Uhr {
  jetzt(): number;
  setze(f: () => void, ms: number): unknown;
  loesche(t: unknown): void;
}

/** Standard-Uhr (Fix-Welle K2): performance.now() läuft gleichmäßig weiter und springt nicht mit der Systemzeit wie Date.now(). */
export const ECHTE_UHR: Uhr = {
  jetzt: () => performance.now(),
  setze: (f, ms) => setTimeout(f, ms),
  loesche: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
};

interface Eintrag {
  f: () => void;
  /** Restzeit in ms; läuft der Zeitgeber, gilt sie ab `seit`. */
  rest: number;
  seit: number;
  timer: unknown;
  /** Schlüssel des Vorlaufs (die Cue-ID), über den `abbrechen` ihn findet (Altfehler PL-K1); ohne Schlüssel nur über `leeren`. */
  schluessel?: number;
}

export class Vorlaeufe {
  private readonly liste = new Set<Eintrag>();
  private halt = false;

  constructor(private readonly uhr: Uhr = ECHTE_UHR) {}

  /** In der Pause steht die Show still: kein Vorlauf läuft, er wartet mit seiner Restzeit auf `fortsetzen`. */
  get angehalten(): boolean {
    return this.halt;
  }

  /** Anzahl der Vorläufe, die noch nicht gestartet sind (laufend oder angehalten). */
  get anzahl(): number {
    return this.liste.size;
  }

  starte(ms: number, f: () => void, schluessel?: number): void {
    const e: Eintrag = { f, rest: ms, seit: 0, timer: undefined, schluessel };
    this.liste.add(e);
    if (!this.halt) this.laufen(e);
  }

  /**
   * Altfehler PL-K1: Nimmt alle Vorläufe mit diesem Schlüssel samt Zeitgeber heraus, laufend oder angehalten (ein Cue kann zweimal im
   * Vorlauf stehen, wenn GO ihn erneut feuert), und gibt ihre Zahl zurück. Keiner davon startet mehr; `angehalten` bleibt, wie es ist.
   */
  abbrechen(schluessel: number): number {
    let n = 0;
    for (const e of [...this.liste]) {
      if (e.schluessel !== schluessel) continue;
      if (e.timer !== undefined) this.uhr.loesche(e.timer);
      this.liste.delete(e);
      n++;
    }
    return n;
  }

  anhalten(): void {
    if (this.halt) return;
    this.halt = true;
    const jetzt = this.uhr.jetzt();
    for (const e of this.liste) {
      this.uhr.loesche(e.timer);
      e.timer = undefined;
      // Fix-Welle K2: Eine Uhr, die zurückspringt, macht die verstrichene Zeit nicht negativ; so bleibt 0 ≤ Rest ≤ Vorlaufzeit.
      e.rest = Math.max(0, e.rest - Math.max(0, jetzt - e.seit));
    }
  }

  fortsetzen(): void {
    if (!this.halt) return;
    this.halt = false;
    for (const e of [...this.liste]) this.laufen(e);
  }

  leeren(): void {
    for (const e of this.liste) if (e.timer !== undefined) this.uhr.loesche(e.timer);
    this.liste.clear();
    this.halt = false;
  }

  private laufen(e: Eintrag): void {
    e.seit = this.uhr.jetzt();
    e.timer = this.uhr.setze(() => {
      this.liste.delete(e);
      e.f();
    }, e.rest);
  }
}

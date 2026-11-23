// NDI-Lage der Caption (UX Welle 2a, E8): Wann SENDET der NDI-Sender wirklich? Der Unterprozess meldet etwa einmal je
// Sekunde `stat`, solange Bilder bei ihm ankommen. `ndiActive` heißt nur „Prozess existiert“; `ndiSendet` heißt „es kam
// zuletzt eine Meldung“ und fällt nach NDI_STILLE_MS ohne Meldung, beim Stopp und beim Ende des Prozesses.
// Rein, ohne Electron: Die Uhr ist austauschbar, der Test läuft mit einer Attrappe.
//
// Lehre aus Player (Review Aufgabe 13): Ein spätes Ereignis eines ALTEN Prozesses darf den Zustand des NEUEN nie zurücksetzen.
// NdiLage vergibt je Start eine Lauf-Kennung; stat und ende zählen nur mit der Kennung des laufenden Laufs, und jeder Lauf
// hat seinen eigenen Wachhund, der beim Stopp und beim Neustart abgeräumt wird.

/** Stille in Millisekunden, nach der „sendet“ zurückgenommen wird (Sender meldet ~1× je Sekunde). */
export const NDI_STILLE_MS = 3000;

export interface Uhr {
  setTimeout: (f: () => void, ms: number) => unknown;
  clearTimeout: (h: unknown) => void;
}

const ECHTE_UHR: Uhr = {
  setTimeout: (f, ms) => setTimeout(f, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export class NdiWachhund {
  private handle: unknown = null;
  private lebt = false;

  constructor(
    private readonly ms: number,
    private readonly onStill: () => void,
    private readonly uhr: Uhr = ECHTE_UHR,
  ) {}

  /** „Sendet“: wahr ab der ersten Meldung bis zur Stille oder zum Stopp. */
  get sendet(): boolean {
    return this.lebt;
  }

  /** Eine Meldung des Senders: „sendet“ und die Frist beginnt neu. */
  meldung(): void {
    this.lebt = true;
    if (this.handle !== null) this.uhr.clearTimeout(this.handle);
    this.handle = this.uhr.setTimeout(() => {
      this.handle = null;
      this.lebt = false;
      this.onStill();
    }, this.ms);
  }

  /** Ruft danach nichts mehr; „sendet“ ist falsch. */
  stop(): void {
    if (this.handle !== null) this.uhr.clearTimeout(this.handle);
    this.handle = null;
    this.lebt = false;
  }
}

export class NdiLage {
  private lauf = 0;
  private name: string | null = null;
  private wachhund: NdiWachhund | null = null;

  /** `onAenderung` kommt bei jeder Änderung von „sendet“ aus der Stille (nicht bei Aufrufen, die verworfen werden). */
  constructor(
    private readonly onAenderung: () => void,
    private readonly uhr: Uhr = ECHTE_UHR,
    private readonly ms: number = NDI_STILLE_MS,
  ) {}

  get sendet(): boolean {
    return this.wachhund?.sendet ?? false;
  }

  /** Name, mit dem der laufende Sender gestartet wurde; null, wenn kein Sender läuft. */
  get netzName(): string | null {
    return this.name;
  }

  /** Ein Sender startet (ein noch laufender gilt ab jetzt als alt). Gibt die Kennung des neuen Laufs zurück. */
  starte(name: string): number {
    this.wachhund?.stop();
    const lauf = ++this.lauf;
    this.name = name;
    this.wachhund = new NdiWachhund(
      this.ms,
      () => {
        if (this.lauf === lauf) this.onAenderung();
      },
      this.uhr,
    );
    return lauf;
  }

  /** Statusmeldung des Senders `lauf`. false (und keine Wirkung), wenn das nicht der laufende Lauf ist. */
  stat(lauf: number): boolean {
    if (lauf !== this.lauf || !this.wachhund) return false;
    const vorher = this.wachhund.sendet;
    this.wachhund.meldung();
    if (!vorher) this.onAenderung();
    return true;
  }

  /** Ende des Unterprozesses `lauf`. true nur beim laufenden Lauf (dann ist der Sender weg); sonst false und ohne Wirkung. */
  ende(lauf: number): boolean {
    if (lauf !== this.lauf || !this.wachhund) return false;
    this.stoppe();
    return true;
  }

  /** NDI aus: „sendet“ und Netzname zurück, der Wachhund ist abgeräumt, jede spätere Meldung des alten Laufs ist ungültig. */
  stoppe(): void {
    this.wachhund?.stop();
    this.wachhund = null;
    this.name = null;
    this.lauf++;
  }
}

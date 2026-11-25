// Welche Ausgabefenster des Players leben (UX Welle 2a, Fix-Runde 1). Rein, ohne Electron: arbeitet auf beliebigen
// Fenster-Kennungen. Der Zustand folgt den lebenden Fenstern. Seit der Altfehler-Stufe 1 trägt die Klasse auch das Fenster-Verhalten:
// `aktuelles` ist das eine Ausgabefenster (PL-T13, das Schließen eines alten lässt das neue unberührt), und `bereit` sagt, ab wann
// es auf Befehle hört (PL-N, die Ausgabeansicht meldet sich nach dem Abonnieren). Die Wartegrenze gilt je Fenster (R5).

/** Höchstens so lange wartet ein Befehl auf „bereit“ des Ausgabefensters, dann geht er trotzdem hinaus (Altfehler PL-N, A5). */
export const AUSGABE_BEREIT_MS = 5000;

export class LebendeFenster<T> {
  private readonly liste: T[] = [];
  /** Fenster, deren Schließen verlangt ist (`closed` steht noch aus); sie zählen nicht mehr als `aktuelles`. */
  private readonly schliessend = new Set<T>();
  /** Fenster, die „bereit“ gemeldet haben. */
  private readonly gemeldet = new Set<T>();
  /** Wartende je Fenster, in der Reihenfolge ihres Aufrufs. */
  private readonly wartende = new Map<T, Array<(bereit: boolean) => void>>();

  /** `beiAblauf` hört den ersten Ablauf je Fenster (einmal je Fenster, R5), etwa für eine Log-Zeile. */
  constructor(private readonly beiAblauf?: (w: T) => void) {}

  /** Ein neues Fenster ist entstanden; es gilt ab jetzt als das neueste. */
  hinzu(w: T): void {
    this.liste.push(w);
  }

  /** `closed` eines Fensters. true, wenn es das letzte lebende war (dann ist die Ausgabe zu); sonst oder bei Unbekanntem false. */
  schliesse(w: T): boolean {
    const i = this.liste.indexOf(w);
    if (i < 0) return false;
    this.liste.splice(i, 1);
    this.schliessend.delete(w);
    this.gemeldet.delete(w);
    this.gebeFrei(w, false);
    return this.liste.length === 0;
  }

  /** Absturz zählt nur beim neuesten lebenden Fenster; ein abgelöstes oder totes meldet nichts. */
  istNeuestes(w: T): boolean {
    return this.liste.length > 0 && this.liste[this.liste.length - 1] === w;
  }

  /** Das neueste lebende Fenster ohne Schließ-Wunsch; null, wenn es keines gibt. */
  aktuelles(): T | null {
    for (let i = this.liste.length - 1; i >= 0; i--) {
      if (!this.schliessend.has(this.liste[i])) return this.liste[i];
    }
    return null;
  }

  /** Das Schließen von `w` ist verlangt; bis zu seinem `closed` lebt es weiter, zählt aber nicht mehr als `aktuelles`. */
  schliesst(w: T): void {
    if (this.liste.includes(w)) this.schliessend.add(w);
  }

  /** `w` hört jetzt auf Befehle; alle Wartenden auf `w` werden in ihrer Reihenfolge frei. Ein unbekanntes `w` ist ohne Wirkung. */
  meldeBereit(w: T): void {
    if (!this.liste.includes(w)) return;
    this.gemeldet.add(w);
    this.gebeFrei(w, true);
  }

  /**
   * true, sobald (oder falls schon) `w` „bereit“ gemeldet hat; false nach `ms` oder wenn `w` vorher schließt. Ein unbekanntes
   * (schon geschlossenes) `w` ergibt sofort false. Die Frist gilt je Fenster (R5): Der erste Ablauf gibt alle Wartenden auf `w` in
   * ihrer Reihenfolge mit false frei, danach gilt `w` als bereit, und spätere Aufrufe ergeben sofort true.
   */
  bereit(w: T, ms: number): Promise<boolean> {
    if (this.gemeldet.has(w)) return Promise.resolve(true);
    if (!this.liste.includes(w)) return Promise.resolve(false);
    return new Promise<boolean>((aufloesen) => {
      const uhr = setTimeout(() => this.laufeAb(w), ms);
      const ende = (b: boolean): void => {
        clearTimeout(uhr);
        aufloesen(b);
      };
      const liste = this.wartende.get(w);
      if (liste) liste.push(ende);
      else this.wartende.set(w, [ende]);
    });
  }

  /** Erster Ablauf einer Frist für `w`: ab jetzt gilt es als bereit, alle Wartenden werden frei, der Hörer hört es einmal. */
  private laufeAb(w: T): void {
    if (!this.liste.includes(w) || this.gemeldet.has(w)) return;
    this.gemeldet.add(w);
    this.gebeFrei(w, false);
    this.beiAblauf?.(w);
  }

  private gebeFrei(w: T, bereit: boolean): void {
    const liste = this.wartende.get(w);
    this.wartende.delete(w);
    for (const ende of liste ?? []) ende(bereit);
  }
}

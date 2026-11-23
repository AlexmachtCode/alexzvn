// Welche Ausgabefenster des Players leben (UX Welle 2a, Fix-Runde 1). Rein, ohne Electron: arbeitet auf beliebigen
// Fenster-Kennungen und dient nur der MELDUNG des Ausgabezustands. Das Fenster-Verhalten (outputWindow-Referenz,
// mögliches zweites Fenster) bleibt, wie es ist; der Zustand folgt den lebenden Fenstern, nicht dieser Referenz.

export class LebendeFenster<T> {
  private readonly liste: T[] = [];

  /** Ein neues Fenster ist entstanden; es gilt ab jetzt als das neueste. */
  hinzu(w: T): void {
    this.liste.push(w);
  }

  /** `closed` eines Fensters. true, wenn es das letzte lebende war (dann ist die Ausgabe zu); sonst oder bei Unbekanntem false. */
  schliesse(w: T): boolean {
    const i = this.liste.indexOf(w);
    if (i < 0) return false;
    this.liste.splice(i, 1);
    return this.liste.length === 0;
  }

  /** Absturz zählt nur beim neuesten lebenden Fenster; ein abgelöstes oder totes meldet nichts. */
  istNeuestes(w: T): boolean {
    return this.liste.length > 0 && this.liste[this.liste.length - 1] === w;
  }
}

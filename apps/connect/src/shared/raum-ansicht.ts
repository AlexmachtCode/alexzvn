// Raum-Bereich des Hauptfensters von JM Connect als reine Regeln (Spec 22.5 Regel V, E53, E57, E58; OE3):
// - raumAnsicht: was steht und was bedienbar ist, aus „Client besteht“, Raumverbindung, Raum-Zustand bekannt und Raumabbruch.
// - raumAbbruch: Ende der Wiederverbindung nach Ablauf der Anmeldung (E57).
// - erzeugeRaumFolge: „Raum schließen“ (Knopf und Tray, eine Funktion, E58) überholt ein laufendes „Raum öffnen“ nicht (OE3).
// Rein: kein electron, keine Uhr im Modul (G-C2). raumAbbruch vergleicht als einzige Regel der Ergänzung mit der Wanduhr, die der
// Aufrufer einspeist, denn operatorBis ist Wanduhr-Zeit wie exp (E57, room.ts); alle anderen Fristen rechnen monoton (E50).
// Die Texte T141 und T144 stehen in ndi-text.ts; diese Datei entscheidet nur, ob sie stehen.

/** Eingaben der Regel V; „Client besteht“ und „Raumabbruch“ sind React-Zustände, keine Refs (22.5). */
export interface RaumAnsichtEingabe {
  client: boolean;
  verbunden: boolean;
  raumBekannt: boolean;
  raumabbruch: boolean;
}

/** Ergebnis der Regel V. `ipcKnoepfeBedienbar`: Knöpfe der Grund- und Fußzeilen gehen per IPC an den Main, immer bedienbar. */
export interface RaumAnsicht {
  raumOeffnen: boolean;
  raumSchliessen: boolean;
  gastEinladen: boolean;
  gaesteliste: boolean;
  t141: boolean;
  t144: boolean;
  t144Zusatz: boolean;
  wsKnoepfeBedienbar: boolean;
  linkErzeugenBedienbar: boolean;
  ipcKnoepfeBedienbar: true;
}

/**
 * Regel V (22.5): Ohne Client steht „Raum öffnen“, nach einem Raumabbruch dazu T144 (mit Zusatz bei bekanntem Raum-Zustand),
 * „Raum schließen“ und die Gästeliste (nur lesbar). Mit Client stehen „Gast einladen“ und „Raum schließen“, die Gästeliste,
 * sobald der Raum-Zustand bekannt ist, ohne Raumverbindung mit T141 darüber. Knöpfe über die Raum-WebSocket (Talkback, Folien,
 * Gast-Aktionen) und „Link erzeugen“ sind nur mit Raumverbindung bedienbar.
 */
export function raumAnsicht(e: RaumAnsichtEingabe): RaumAnsicht {
  const t144 = !e.client && e.raumabbruch;
  return {
    raumOeffnen: !e.client,
    raumSchliessen: e.client || e.raumabbruch,
    gastEinladen: e.client,
    gaesteliste: e.raumBekannt && (e.client || e.raumabbruch),
    t141: e.client && !e.verbunden && e.raumBekannt,
    t144,
    t144Zusatz: t144 && e.raumBekannt,
    wsKnoepfeBedienbar: e.client && e.verbunden,
    linkErzeugenBedienbar: e.client && e.verbunden,
    ipcKnoepfeBedienbar: true,
  };
}

/**
 * E57: Meldet der aktuelle Client eine Trennung und ist die Anmeldung abgelaufen (`jetzt` ≥ `operatorBis`, beides Wanduhr in
 * ms), versucht Connect es für die Bedienung nicht weiter. Verbunden gibt es nie einen Raumabbruch.
 */
export function raumAbbruch(e: { verbunden: boolean; jetzt: number; operatorBis: number }): 'anmeldungAbgelaufen' | null {
  return !e.verbunden && e.jetzt >= e.operatorBis ? 'anmeldungAbgelaufen' : null;
}

/** Reihenfolge von „Raum öffnen“ und „Raum schließen“ im Renderer (OE3, C-EP3). */
export interface RaumFolge {
  oeffnen<T>(f: () => Promise<T>): Promise<T>;
  schliessen(f: () => Promise<void>): Promise<void>;
}

/**
 * OE3: `schliessen` wartet auf jedes beim Aufruf laufende `oeffnen` (auch auf ein scheiterndes) und schließt danach; eine spät
 * zurückkommende Antwort von „Raum öffnen“ setzt so nie ein schon verworfenes Secret. Die Folge merkt jedes laufende Öffnen,
 * nicht nur das letzte: Ein zweiter Klick auf „Raum öffnen“, der am Guard des Aufrufers sofort endet (App.tsx), hebt das Warten
 * auf das erste nicht auf. `oeffnen` wartet nicht auf ein laufendes `schliessen` (unverändert wie in 0.3.0) und gibt Ergebnis
 * bzw. Fehler von `f` weiter.
 */
export function erzeugeRaumFolge(): RaumFolge {
  const laufend = new Set<Promise<void>>();
  return {
    oeffnen<T>(f: () => Promise<T>): Promise<T> {
      const p = f();
      const fertig = (): void => {
        laufend.delete(ende);
      };
      const ende: Promise<void> = p.then(fertig, fertig);
      laufend.add(ende);
      return p;
    },
    async schliessen(f: () => Promise<void>): Promise<void> {
      const warte = [...laufend];
      if (warte.length > 0) await Promise.all(warte);
      await f();
    },
  };
}

// ── Ende des Moduls ──

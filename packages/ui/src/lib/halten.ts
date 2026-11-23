// Halten-zum-Sprechen für TallyButton (Spec 3.4, E9): reine Zustandsmaschine ohne DOM.
// Je erfolgreichem Druck kommt onRelease genau einmal: über loslassen mit derselben Quelle oder über abbrechen
// (pointercancel, lostpointercapture, blur, Wechsel auf „gesperrt“, Unmount). Ein hängender Talkback wäre ein Live-Fehler.

export interface HaltenRueckrufe {
  onPress?(): void;
  onRelease?(): void;
}

export type HaltenQuelle = 'zeiger' | 'taste';

export interface HaltenSteuerung {
  readonly gehalten: boolean;
  /**
   * Ein Druck begann unter Sperre: Der click, der darauf folgt (auch nach dem Entsperren), wirkt nicht. Gesetzt und
   * gelöscht vom TallyButton (Druck unter Sperre / click, pointercancel, blur, frischer Druck); die Maschine selbst liest es nicht.
   */
  druckUnterSperre: boolean;
  druecken(quelle: HaltenQuelle): void;
  loslassen(quelle: HaltenQuelle): void;
  abbrechen(): void;
  aktualisiere(r: HaltenRueckrufe): void;
}

export function erzeugeHalten(r: HaltenRueckrufe): HaltenSteuerung {
  let rueckrufe = r;
  let gehaltenVon: HaltenQuelle | null = null;
  // Release zum Zeitpunkt des Drückens: Fehlt onRelease später im neuesten Satz, geht das Release nicht verloren.
  let gemerktesRelease: (() => void) | undefined;
  let druckUnterSperre = false;

  const loesen = (): void => {
    gehaltenVon = null;
    const release = rueckrufe.onRelease ?? gemerktesRelease;
    gemerktesRelease = undefined;
    release?.();
  };

  return {
    get gehalten(): boolean {
      return gehaltenVon !== null;
    },
    get druckUnterSperre(): boolean {
      return druckUnterSperre;
    },
    set druckUnterSperre(wert: boolean) {
      druckUnterSperre = wert;
    },
    druecken(quelle: HaltenQuelle): void {
      if (!rueckrufe.onPress && !rueckrufe.onRelease) return;
      if (gehaltenVon !== null) return;
      // Erst halten, dann melden: Wirft onPress, bleibt der Druck gehalten, und onRelease folgt trotzdem.
      gehaltenVon = quelle;
      gemerktesRelease = rueckrufe.onRelease;
      rueckrufe.onPress?.();
    },
    loslassen(quelle: HaltenQuelle): void {
      if (gehaltenVon === quelle) loesen();
    },
    abbrechen(): void {
      if (gehaltenVon !== null) loesen();
    },
    aktualisiere(neu: HaltenRueckrufe): void {
      rueckrufe = neu;
    },
  };
}

/** Das, was beobachteFensterVerlust von Fenster und Dokument braucht (window und document passen). */
export interface FensterZiel {
  addEventListener(t: string, h: () => void): void;
  removeEventListener(t: string, h: () => void): void;
  readonly visibilityState?: string;
}

/**
 * Fensterverlust beendet ein laufendes Halten (onRelease genau einmal über abbrechen): blur am Fenster und
 * visibilitychange mit visibilityState 'hidden' am Dokument. Ohne Ziel (null, z. B. ohne Browser) geschieht nichts.
 * Gibt die Abmeldung zurück, die beide Hörer wieder entfernt.
 */
export function beobachteFensterVerlust(fenster: FensterZiel | null, dokument: FensterZiel | null, halten: HaltenSteuerung): () => void {
  const beiBlur = (): void => halten.abbrechen();
  const beiSichtbarkeit = (): void => {
    if (dokument?.visibilityState === 'hidden') halten.abbrechen();
  };
  fenster?.addEventListener('blur', beiBlur);
  dokument?.addEventListener('visibilitychange', beiSichtbarkeit);
  return () => {
    fenster?.removeEventListener('blur', beiBlur);
    dokument?.removeEventListener('visibilitychange', beiSichtbarkeit);
  };
}

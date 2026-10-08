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
  druecken(quelle: HaltenQuelle): void;
  loslassen(quelle: HaltenQuelle): void;
  abbrechen(): void;
  aktualisiere(r: HaltenRueckrufe): void;
}

export function erzeugeHalten(r: HaltenRueckrufe): HaltenSteuerung {
  let rueckrufe = r;
  let gehaltenVon: HaltenQuelle | null = null;

  const loesen = (): void => {
    gehaltenVon = null;
    rueckrufe.onRelease?.();
  };

  return {
    get gehalten(): boolean {
      return gehaltenVon !== null;
    },
    druecken(quelle: HaltenQuelle): void {
      if (!rueckrufe.onPress && !rueckrufe.onRelease) return;
      if (gehaltenVon !== null) return;
      // Erst halten, dann melden: Wirft onPress, bleibt der Druck gehalten, und onRelease folgt trotzdem.
      gehaltenVon = quelle;
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

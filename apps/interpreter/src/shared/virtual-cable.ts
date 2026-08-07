// Erkennung virtueller Audio-Kabel (#208).
//
// Der Interpreter SPIELT seinen Mix in ein virtuelles Kabel hinein; Zoom greift das ANDERE Ende
// desselben Kabels als Mikrofon ab. Die Geraete sind dabei aus Sicht des KABELS benannt, nicht aus
// Sicht des Nutzers: bei VB-CABLE heisst das Wiedergabe-Geraet "CABLE Input" und das Aufnahme-
// Geraet "CABLE Output". Wer "Input" fuer "Eingang in Zoom" haelt, sucht vergeblich — genau daran
// scheiterte #208. Deshalb nennt die Oberflaeche das Gegenstueck beim exakten Namen.
//
// Bewusst eine FESTE LISTE statt der Heuristik "Ausgabe X hat ein aehnlich benanntes Eingabegeraet":
// Dante meldet "DVS Transmit 1-2" und "DVS Receive 1-2", die aber NICHT intern verbunden sind (das
// setzt Routing im Dante Controller voraus). Eine Heuristik wuerde den Operator dort in die Irre
// fuehren — im Livebetrieb der teuerste denkbare Fehler.
//
// Alle Muster sind Substring-Regexe ohne ^-Anker: Chromium stellt Geraetenamen je nach
// Standardgeraet und Sprache ein "Standard - " bzw. "Default - " voran, und die Klammerzusaetze
// schwanken zwischen Treiberversionen.

export interface CableKind {
  /** Stabile Kennung, z. B. 'vb-cable'. */
  id: string;
  /** Anzeigename fuer die Oberflaeche, z. B. 'VB-CABLE'. */
  name: string;
  /** Wiedergabe-Geraet: hier spielt der Interpreter hinein. */
  outputMatch: RegExp;
  /** Exakt das, was der Operator in Zoom als Mikrofon waehlt. */
  zoomInputLabel: string;
  /** Aufnahme-Geraet: damit wird geprueft, ob die Gegenseite existiert. */
  inputMatch: RegExp;
}

export const CABLE_KINDS: CableKind[] = [
  {
    id: 'vb-cable',
    name: 'VB-CABLE',
    outputMatch: /cable input \(vb-audio (?:virtual )?cable\)/i,
    zoomInputLabel: 'CABLE Output (VB-Audio Virtual Cable)',
    inputMatch: /cable output \(vb-audio (?:virtual )?cable\)/i,
  },
  {
    id: 'vb-cable-a',
    name: 'VB-CABLE A',
    outputMatch: /cable-a input \(vb-audio cable a\)/i,
    zoomInputLabel: 'CABLE-A Output (VB-Audio Cable A)',
    inputMatch: /cable-a output \(vb-audio cable a\)/i,
  },
  {
    id: 'vb-cable-b',
    name: 'VB-CABLE B',
    outputMatch: /cable-b input \(vb-audio cable b\)/i,
    zoomInputLabel: 'CABLE-B Output (VB-Audio Cable B)',
    inputMatch: /cable-b output \(vb-audio cable b\)/i,
  },
  {
    id: 'vb-cable-c',
    name: 'VB-CABLE C',
    outputMatch: /cable-c input \(vb-audio cable c\)/i,
    zoomInputLabel: 'CABLE-C Output (VB-Audio Cable C)',
    inputMatch: /cable-c output \(vb-audio cable c\)/i,
  },
  {
    id: 'vb-cable-d',
    name: 'VB-CABLE D',
    outputMatch: /cable-d input \(vb-audio cable d\)/i,
    zoomInputLabel: 'CABLE-D Output (VB-Audio Cable D)',
    inputMatch: /cable-d output \(vb-audio cable d\)/i,
  },
  {
    id: 'voicemeeter-aux',
    name: 'VoiceMeeter AUX',
    outputMatch: /voicemeeter aux input/i,
    zoomInputLabel: 'VoiceMeeter Aux Output (VB-Audio VoiceMeeter AUX VAIO)',
    inputMatch: /voicemeeter aux output/i,
  },
  {
    id: 'voicemeeter-vaio3',
    name: 'VoiceMeeter VAIO3',
    outputMatch: /voicemeeter vaio3 input/i,
    zoomInputLabel: 'VoiceMeeter VAIO3 Output (VB-Audio VoiceMeeter VAIO3)',
    inputMatch: /voicemeeter vaio3 output/i,
  },
  {
    id: 'voicemeeter',
    name: 'VoiceMeeter',
    outputMatch: /voicemeeter input \(vb-audio voicemeeter vaio\)/i,
    zoomInputLabel: 'VoiceMeeter Output (VB-Audio VoiceMeeter VAIO)',
    inputMatch: /voicemeeter output \(vb-audio voicemeeter vaio\)/i,
  },
];

/**
 * Erkennt das Kabel hinter einem Wiedergabe-Geraetenamen.
 * null = unbekanntes Geraet (kein Fehler — der Operator darf es trotzdem waehlen).
 */
export function detectCable(outputLabel: string): CableKind | null {
  if (!outputLabel) return null;
  return CABLE_KINDS.find((k) => k.outputMatch.test(outputLabel)) ?? null;
}

/** Existiert die Aufnahme-Gegenseite des Kabels in der Geraeteliste? */
export function counterpartPresent(kind: CableKind, inputLabels: string[]): boolean {
  return inputLabels.some((label) => kind.inputMatch.test(label));
}

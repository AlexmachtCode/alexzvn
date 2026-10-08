// Feste Texte von @jm/ui (Suite-UX-Update, G5): an einer Stelle, wörtlich aus der Spec, deutsche Anführungszeichen.
// Zahlen in Texten immer über zahlText (de-DE, Komma, ohne Tausenderpunkt).

/** Text für einen Zustand, den das Tool (noch) nicht kennt (Spec 7.2: unbekannt ist nicht ok). */
export const UNBEKANNT = 'unbekannt';

export function zahlText(n: number): string {
  return n.toLocaleString('de-DE', { useGrouping: false, maximumFractionDigits: 3 });
}

/** Wie zahlText, aber ohne Rundung (Feldtext und Grenzen: nie weniger Stellen zeigen, als die Eingabe annimmt). */
export function zahlTextVoll(n: number): string {
  return n.toLocaleString('de-DE', { useGrouping: false, maximumFractionDigits: 20 });
}

export const UI_TEXTE = {
  zustand: { ok: 'in Ordnung', warn: 'Warnung', error: 'Fehler', off: 'aus', live: 'auf Sendung' },
  onAir: 'ON AIR',
  bereit: 'bereit',
  live: 'LIVE',
  einstellungen: 'Einstellungen',
  einstellungenOeffnen: 'Einstellungen öffnen',
  einstellungenSchliessen: 'Einstellungen schließen',
  statusOeffnen: (label: string) => `${label}: Einstellungen öffnen`,
  gesperrtOhneGrund: 'gesperrt – kein Grund angegeben',
  gesperrt: (grund: string) => `Gesperrt: ${grund}`,
  nichtVerfuegbar: (label: string) => `nicht verfügbar: ${label}`,
  bitteWaehlen: '– bitte wählen –',
  zahlFehlt: 'Bitte eine Zahl eingeben.',
  ganzzahlFehlt: 'Bitte eine ganze Zahl eingeben.',
  mindestens: (min: number) => `Mindestens ${zahlTextVoll(min)}.`,
  hoechstens: (max: number) => `Höchstens ${zahlTextVoll(max)}.`,
  nochNichtUebernommen: 'Noch nicht übernommen.',
  dunkel: 'Dunkel',
  hell: 'Hell',
  themeUmschalten: (jetzt: string, ziel: string) => `Darstellung: ${jetzt}. Umschalten auf ${ziel}`,
  kuerzel: 'Kürzel',
  uhrzeit: 'Uhrzeit',
} as const;

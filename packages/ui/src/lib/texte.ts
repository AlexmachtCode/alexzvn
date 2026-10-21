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

/**
 * Statuseintrag „Master“ (Spec 3.3: Label „Master“; Detailtexte T1, Owner-Freigabe OF8). „verbindet …“ ohne Adresse:
 * Der Client wechselt beim Verbinden je Kandidat die Adresse, die Statusleiste soll nicht flackern (E4).
 */
export const MASTER_LINK_TEXTE = {
  label: 'Master',
  aus: 'aus',
  ohneClient: 'nicht gestartet',
  sucht: 'sucht …',
  verbindet: 'verbindet …',
  verbunden: 'verbunden',
  verbundenMit: (name: string) => `verbunden mit ${name}`,
} as const;

/**
 * Texte der geführten Anleitungen (Plan „Geführte Anleitungen“, Texttabelle U1–U37; gehen vor dem Release zur
 * Owner-Freigabe). Das Gerüst gilt für jedes Tool (Spec 2): kein Text nennt eine bestimmte Anleitung, U11, U12 und U34
 * nehmen den Titel der Anleitung (`Anleitung.titel`, in der Einrichtung „Einrichtung“). Der Zähler zählt Kapitel (EP3);
 * Zahlen über zahlText.
 */
export const ANLEITUNG_TEXTE = {
  zurueck: 'Zurück',
  weiter: 'Weiter',
  ueberspringen: 'Überspringen',
  spaeter: 'Später weiter',
  brauchtNicht: 'Brauche ich nicht',
  dochGebraucht: 'Doch gebraucht',
  zeigMir: 'Zeig mir',
  anleitungUeberspringen: 'Anleitung überspringen',
  jaUeberspringen: 'Ja, überspringen',
  zurAnleitung: 'Zurück zur Anleitung',
  starten: (titel: string) => `${titel} starten`,
  fortsetzen: (titel: string, n: number, m: number) => `${titel} fortsetzen · Schritt ${zahlText(n)} von ${zahlText(m)}`,
  zaehler: (n: number, m: number) => `Schritt ${zahlText(n)} von ${zahlText(m)}`,
  beenden: 'Anleitung beenden',
  schonErledigt: 'Schon erledigt',
  nurZeigen: 'Nur zeigen',
  zielFehlt: 'Das Bedienelement ist gerade nicht zu sehen.',
  produktion: 'Gerade läuft eine Produktion. Ich zeige dir nur, wo es ist; mach es, wenn die Produktion vorbei ist.',
  stimmeAn: 'Stimme an',
  stimmeAus: 'Stimme aus',
  stimmeProduktion: 'Die Stimme ist aus, weil gerade eine Produktion läuft.',
  stimmeTrotzdem: 'Stimme trotzdem an',
  ansageFehlt: 'Zu diesem Text gibt es keine Ansage.',
  ansageFehler: 'Die Ansage konnte nicht abgespielt werden.',
  speicherNichtLesbar: 'Der Fortschritt kann auf diesem Rechner nicht gelesen werden. Die Anleitung startet deshalb nicht von selbst.',
  speicherNichtSchreibbar: 'Der Fortschritt kann auf diesem Rechner nicht gemerkt werden.',
  speicherKaputt: 'Der gemerkte Fortschritt war unlesbar; die Anleitung beginnt neu.',
  speicherNeuer: 'Der Fortschritt stammt von einer neueren Fassung und bleibt unverändert.',
  zustand: { erledigt: 'erledigt', nichtGebraucht: 'nicht gebraucht', uebersprungen: 'übersprungen', offen: 'offen' },
  neustartWartet: 'Wartet auf den Neustart.',
  abgeschlossen: (titel: string) => `${titel} abgeschlossen`,
  fertig: 'Fertig',
  keineStimme: 'In dieser Fassung gibt es keine Stimme.',
  beendet: 'Anleitung beendet. Offene Schritte kannst du hier einzeln mit „Zeig mir“ ansehen.',
} as const;

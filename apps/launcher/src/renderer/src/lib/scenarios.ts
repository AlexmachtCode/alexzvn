// Szenario-Start „Was willst du produzieren?" (Onboarding B2).
//
// Kuratierte Produktions-Vorlagen: jedes Szenario bündelt ein sinnvolles Tool-Set
// + einen Ablauf-/Einstellungs-Startpunkt und füllt damit den vorhandenen Show-
// Editor vor (createShow bleibt die eine Quelle der .jmshow-Erzeugung). Macht das
// stärkste, bisher unsichtbare Konzept (die .jmshow) zur Eingangstür.
//
// Bewusst Launcher-seitig als Konstante (nicht im Manifest): dieser Slice braucht
// keinen suite.json/Proxy-Umbau. Der spätere Schritt „datengetrieben über Manifest-
// Metadaten (roles/scenarios)" kann diese Liste ablösen, ohne die UI zu ändern.

/** Vorbefüllung des Show-Editors aus einem Szenario (rein In-Memory, kein IPC). */
export interface ScenarioSeed {
  name: string;
  /** Katalog-Tool-IDs (z. B. "jm-timer"), die als „enthalten" vorausgewählt werden. */
  toolIds: string[];
  /** Startpunkt für den zentralen Ablauf (#78); Minuten optional. */
  ablauf?: { label: string; minutes?: number; note?: string }[];
  /** Q&A-Redezeit (Sekunden) → jm-qa settings.speakSeconds. */
  qaSpeakSeconds?: number;
  /** Battle-Runden → jm-battle settings.rounds. */
  battleRounds?: number;
}

export interface Scenario {
  id: string;
  emoji: string;
  title: string;
  tagline: string;
  seed: ScenarioSeed;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'konferenz',
    emoji: '🎤',
    title: 'Konferenz mit Rednern',
    tagline: 'Ablaufregie, Redezeit, Bauchbinden & Publikumsfragen — automatisch gekoppelt.',
    seed: {
      name: 'Konferenz',
      toolIds: ['jm-rundown', 'jm-timer', 'jm-titler', 'jm-qa', 'jm-presenter'],
      ablauf: [
        { label: 'Begrüßung', minutes: 5 },
        { label: 'Keynote', minutes: 30 },
        { label: 'Publikumsfragen', minutes: 15 },
        { label: 'Pause', minutes: 15 },
      ],
      qaSpeakSeconds: 120,
    },
  },
  {
    id: 'battle',
    emoji: '🥊',
    title: 'Battle-Event',
    tagline: 'VS-Bauchbinde, Jury-/Publikums-Voting per QR und Instant-Replay.',
    seed: {
      name: 'Battle',
      toolIds: ['jm-battle', 'jm-titler', 'jm-timer', 'jm-player', 'jm-switcher'],
      battleRounds: 3,
    },
  },
  {
    id: 'buehne',
    emoji: '🎭',
    title: 'Bühnenshow / Gottesdienst',
    tagline: 'Zentraler Ablauf, Bühnen-Timer, Texte auf dem Prompter & Bauchbinden.',
    seed: {
      name: 'Bühnenshow',
      toolIds: ['jm-rundown', 'jm-timer', 'jm-stage-display', 'jm-titler', 'jm-prompter', 'jm-player'],
      ablauf: [
        { label: 'Einlass', note: 'Vorprogramm/Musik' },
        { label: 'Begrüßung', minutes: 5 },
        { label: 'Programm', minutes: 60 },
        { label: 'Ausklang', minutes: 10 },
      ],
    },
  },
  {
    id: 'podcast',
    emoji: '🎙️',
    title: 'Podcast / Aufzeichnung',
    tagline: 'Mehrspur-Aufnahme, Mix, Bild-Mischung und anschließender Schnitt.',
    seed: {
      name: 'Aufzeichnung',
      toolIds: ['jm-recorder', 'jm-daw', 'jm-switcher', 'jm-titler', 'jm-editor'],
    },
  },
];

/** Anzeigename für eine Tool-ID (Fallback, wenn das Manifest den Namen nicht liefert). */
export function toolLabel(id: string): string {
  return id.replace(/^jm-/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

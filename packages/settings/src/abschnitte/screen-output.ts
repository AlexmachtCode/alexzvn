// --- @jm/settings: Ausgabe auf Bildschirm (Spec 6.2, Regeln 7.1–7.3, Plan E18) ---
//
// Heute fallen alle Tools bei einem fehlenden Bildschirm still auf den Hauptmonitor zurück. Der
// Abschnitt meldet das stattdessen: Eine gewählte id, die in der gemeldeten Liste fehlt, ist
// „Bildschirm fehlt“ – und die Auswahl springt nie still um. Ohne Liste gilt „unbekannt“.
import { zahlText } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export interface ScreenOption { id: number; label: string; primary: boolean }

export interface ScreenOutputSectionProps extends SectionInput {
  enabled: boolean;                  // Ausgabe an bzw. Fenster soll offen sein
  windowOpen?: boolean;              // gemessen; undefined = keine Rückmeldung
  screens?: ScreenOption[];          // gemessen; undefined = Liste unbekannt
  selectedId: number | null;         // null = automatisch (Hauptmonitor); Titler/Switcher übersetzen 0 → null
  fullscreen?: boolean; background?: string;
  capabilities: { toggle?: boolean; fullscreen?: boolean; background?: boolean };
  onToggle?(next: boolean): void; onSelect?(id: number | null): void; onFullscreen?(next: boolean): void;
  onBackground?(hex: string): void;
}

export const SCREEN_TEXTE = {
  titel: 'Ausgabe auf Bildschirm',
  ausgabe: 'Ausgabe',
  bildschirm: 'Bildschirm',
  vollbild: 'Vollbild',
  hintergrund: 'Hintergrund',
  automatisch: 'Automatisch (Hauptmonitor)',
  keinBildschirm: 'Kein Bildschirm gefunden',
  frueherGewaehlt: 'zuvor gewählter Bildschirm',
  aufBildschirm: (n: number) => `auf Bildschirm ${zahlText(n)}`,
  aus: ABSCHNITT_TEXTE.aus,
  bildschirmFehlt: 'Bildschirm fehlt',
  anOhneRueckmeldung: ABSCHNITT_TEXTE.anOhneRueckmeldung,
  fensterNichtOffen: 'an, Fenster nicht offen',
  ausFensterOffen: 'aus, Fenster noch offen',
  hinweis: 'Zweiten Bildschirm wählen, damit die Ausgabe nicht die Bedienoberfläche verdeckt.',
  farbeUngueltig: 'Farbe als #RRGGBB eingeben.',
} as const;

/** Wert der Auswahl für „automatisch“ (ids sind Zahlen, dieser Text kollidiert nie). */
export const SCREEN_AUTO = 'auto';

export interface ScreenOutputView extends SectionBase {
  sichtbar: { ausgabe: boolean; auswahl: boolean; vollbild: boolean; hintergrund: boolean };
  ziel?: number;                     // 1-basierte Position des Zielbildschirms in screens; fehlt = keiner
  optionen: Array<{ value: string; label: string }>;
  auswahlWert: string;               // SCREEN_AUTO oder String(selectedId)
  auswahlGesperrt: boolean;          // leere Liste: nichts zu wählen
  hinweis?: string;                  // Tipp, wenn das Ziel der Hauptmonitor ist
}

/** Position (1-basiert) des Zielbildschirms: gewählte id bzw. bei null der Hauptmonitor. 0 = nicht in der Liste. */
function zielPosition(screens: readonly ScreenOption[], selectedId: number | null): number {
  const i = selectedId === null ? screens.findIndex((s) => s.primary) : screens.findIndex((s) => s.id === selectedId);
  return i + 1;
}

function screenStatus(p: ScreenOutputSectionProps): SectionStatus {
  if (hatFehler(p)) return fehlerStatus(p.error);
  if (p.screens === undefined) return STATUS_UNBEKANNT;
  const ziel = zielPosition(p.screens, p.selectedId);
  if (p.selectedId !== null && ziel === 0) return st('error', SCREEN_TEXTE.bildschirmFehlt);
  if (!p.enabled) return p.windowOpen === true ? st('warn', SCREEN_TEXTE.ausFensterOffen) : st('off', SCREEN_TEXTE.aus);
  if (ziel === 0) return st('error', SCREEN_TEXTE.bildschirmFehlt);
  if (p.windowOpen === true) return st('ok', SCREEN_TEXTE.aufBildschirm(ziel));
  if (p.windowOpen === false) return st('error', SCREEN_TEXTE.fensterNichtOffen);
  return st('warn', SCREEN_TEXTE.anOhneRueckmeldung);
}

export function screenOutputView(p: ScreenOutputSectionProps): ScreenOutputView {
  const c = p.capabilities;
  const liste = p.screens ?? [];
  const ziel = p.screens === undefined ? 0 : zielPosition(p.screens, p.selectedId);
  const optionen =
    p.screens !== undefined && liste.length === 0
      ? [{ value: SCREEN_AUTO, label: SCREEN_TEXTE.keinBildschirm }]
      : [{ value: SCREEN_AUTO, label: SCREEN_TEXTE.automatisch }, ...liste.map((s) => ({ value: String(s.id), label: s.label }))];
  return {
    id: p.id,
    status: screenStatus(p),
    locked: p.locked,
    error: p.error,
    sichtbar: {
      ausgabe: c.toggle === true,
      auswahl: p.screens !== undefined,
      vollbild: c.fullscreen === true,
      hintergrund: c.background === true,
    },
    ziel: ziel > 0 ? ziel : undefined,
    optionen,
    auswahlWert: p.selectedId === null ? SCREEN_AUTO : String(p.selectedId),
    auswahlGesperrt: p.screens !== undefined && liste.length === 0,
    hinweis: ziel > 0 && liste[ziel - 1].primary ? SCREEN_TEXTE.hinweis : undefined,
  };
}

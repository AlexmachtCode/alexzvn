// --- @jm/settings: Ausgabe auf Bildschirm (Spec 6.2, Regeln 7.1–7.3, Plan E18) ---
//
// Heute fallen alle Tools bei einem fehlenden Bildschirm still auf den Hauptmonitor zurück. Der
// Abschnitt meldet das stattdessen: Eine gewählte id, die in der gemeldeten Liste fehlt, ist
// „Bildschirm fehlt“ – und die Auswahl springt nie still um. Ohne Liste gilt „unbekannt“.
import { zahlText } from '@jm/ui';
import { ABSCHNITT_TEXTE, fehlerStatus, hatFehler, istGesperrt, st, STATUS_UNBEKANNT, type SectionBase, type SectionInput, type SectionStatus } from '../vertrag';

export interface ScreenOption { id: number; label: string; primary: boolean }

export interface ScreenOutputSectionProps extends SectionInput {
  enabled: boolean;                  // Ausgabe an bzw. Fenster soll offen sein
  windowOpen?: boolean;              // gemessen; undefined = keine Rückmeldung
  screens?: ScreenOption[];          // gemessen; undefined = Liste unbekannt
  selectedId: number | null;         // null = automatisch (Hauptmonitor); Titler/Switcher übersetzen 0 → null
  fullscreen?: boolean; background?: string;
  backgroundDefault?: string;        // UX-Pilot C6 (OF3): Knopf „Standardfarbe ({hex})“ setzt diese Farbe
  // backgroundPicker (UX-Pilot C6, OF3): Farbwähler neben dem Textfeld
  capabilities: { toggle?: boolean; fullscreen?: boolean; background?: boolean; backgroundPicker?: boolean };
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
  // UX-Pilot C6 (T9)
  standardfarbe: (hex: string) => `Standardfarbe (${hex})`,
  farbeWaehlen: 'Farbe wählen',
} as const;

/** Wert der Auswahl für „automatisch“ (ids sind Zahlen, dieser Text kollidiert nie). */
export const SCREEN_AUTO = 'auto';

/** Gültige Hintergrundfarbe #RRGGBB (Textfeld, Farbwähler, Standardfarbe). */
export const FARBE_MUSTER = /^#[0-9a-fA-F]{6}$/;

export interface ScreenOutputView extends SectionBase {
  sichtbar: { ausgabe: boolean; auswahl: boolean; vollbild: boolean; hintergrund: boolean; standardfarbe: boolean; farbwaehler: boolean };
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
      // Nur neben einem gemeldeten Wert: ohne ihn steht „unbekannt“ und keine Eingabe (G6).
      standardfarbe: c.background === true && typeof p.background === 'string' && FARBE_MUSTER.test(p.backgroundDefault ?? ''),
      farbwaehler: c.background === true && c.backgroundPicker === true && typeof p.background === 'string',
    },
    ziel: ziel > 0 ? ziel : undefined,
    optionen,
    auswahlWert: p.selectedId === null ? SCREEN_AUTO : String(p.selectedId),
    auswahlGesperrt: p.screens !== undefined && liste.length === 0,
    hinweis: ziel > 0 && liste[ziel - 1].primary ? SCREEN_TEXTE.hinweis : undefined,
  };
}

/** „Standardfarbe ({hex})“ (Muster peerSetzen): meldet backgroundDefault nur ohne Sperre und als gültige Farbe. */
export function standardfarbe(p: ScreenOutputSectionProps): boolean {
  const hex = p.backgroundDefault ?? '';
  if (istGesperrt(p) || !FARBE_MUSTER.test(hex) || typeof p.onBackground !== 'function') return false;
  p.onBackground(hex);
  return true;
}

/** Farbwähler: meldet die gewählte Farbe nur ohne Sperre und als #RRGGBB. */
export function farbeGewaehlt(p: ScreenOutputSectionProps, hex: string): boolean {
  if (istGesperrt(p) || !FARBE_MUSTER.test(hex) || typeof p.onBackground !== 'function') return false;
  p.onBackground(hex);
  return true;
}

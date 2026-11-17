// #309: Vollbild der Referentenansicht. Der Kern kennt das Fenster nur über ein schmales Interface (ein echtes
// BrowserWindow passt ohne Cast), damit er ohne Electron prüfbar ist (test/referent-vollbild.test.ts).
// Echtes Vollbild über setFullScreen: unter Windows deckt es die Taskleiste ab. Kein Kiosk-Modus, keine
// HTML-Fullscreen-API (die verließe Chromium mit Escape – Escape beendet aber die Präsentation).
import type { ReferentConfig } from '@shared/types';

export interface VollbildFenster {
  isFullScreen(): boolean;
  setFullScreen(an: boolean): void;
  isDestroyed(): boolean;
  on(e: 'enter-full-screen', fn: () => void): unknown;
  on(e: 'leave-full-screen', fn: () => void): unknown;
  on(e: 'close', fn: () => void): unknown;
}

export interface VollbildSpeicher {
  lade(): ReferentConfig;
  speichere(c: ReferentConfig): void;
}

/** Nur ein echtes `true` schaltet Vollbild ein; fehlende oder kaputte Datei → aus. */
export function normiereReferentConfig(roh: unknown): ReferentConfig {
  const o = roh && typeof roh === 'object' ? (roh as Partial<ReferentConfig>) : {};
  return { vollbild: o.vollbild === true };
}

/** Beim Öffnen (nach `show()`): gemerktes Vollbild wiederherstellen. */
export function referentVollbildAnwenden(win: VollbildFenster, speicher: VollbildSpeicher): void {
  if (win.isDestroyed()) return;
  if (speicher.lade().vollbild) win.setFullScreen(true);
}

/**
 * Jeden echten Wechsel merken und melden – auch einen über das Standardmenü (F11) oder das System. Nach `close`
 * zählt kein Verlassen mehr: Beenden im Vollbild soll das Vollbild für die nächste Präsentation behalten.
 * (Windows meldet beim Schließen kein leave-full-screen, gemessen mit Electron 33.4.11; der Mac ist ungeprüft.)
 */
export function referentVollbildVerdrahten(
  win: VollbildFenster,
  speicher: VollbildSpeicher,
  melde: (an: boolean) => void,
): void {
  let schliesst = false;
  win.on('close', () => {
    schliesst = true;
  });
  win.on('enter-full-screen', () => {
    speicher.speichere({ vollbild: true });
    melde(true);
  });
  win.on('leave-full-screen', () => {
    if (schliesst) return;
    speicher.speichere({ vollbild: false });
    melde(false);
  });
}

/** Knopf/F11: umschalten; liefert den angeforderten Zustand (ohne offenes Fenster `false`). */
export function referentVollbildUmschalten(win: VollbildFenster | null): boolean {
  if (!win || win.isDestroyed()) return false;
  const neu = !win.isFullScreen();
  win.setFullScreen(neu);
  return neu;
}

export function referentVollbildStand(win: VollbildFenster | null): boolean {
  return win != null && !win.isDestroyed() && win.isFullScreen();
}

// Aktionen der Oberfläche (UX Welle 2a, Stage-Display d): rein, ohne window; der Store liefert die Funktionen. Eine Bildschirmwahl
// merkt nur `outputDisplayId` (setConfig) und öffnet oder verschiebt kein Fenster; das Verschieben ist der eigene Knopf.
import type { PartialStageConfig, PresenterMode, StageConfig } from '@shared/types';
import type { StageAktionen } from './oberflaeche';

export interface AktionenQuellen {
  outputDisplayId: number | null;
  setConfig(patch: PartialStageConfig): Promise<unknown>;
  openOutput(displayId?: number): Promise<unknown>;
  closeOutput(): Promise<unknown>;
}

/** Alles, was Panel und Live-Bereich auslösen können. */
export interface OberflaechenAktionen extends StageAktionen {
  /** Das offene Fenster auf den gewählten Bildschirm ziehen (derselbe Aufruf wie das Öffnen). */
  ausgabeVerschieben(): void;
  /** Nachricht setzen: wirkt mit jedem Tastendruck. */
  nachricht(text: string): void;
  widget(key: keyof StageConfig['widgets'], an: boolean): void;
  /** PIN setzen: nur Ziffern, höchstens 8 Zeichen (wie bisher). */
  pin(eingabe: string): void;
  modus(m: PresenterMode): void;
}

const QUELLEN = ['timer', 'switcher', 'presenter'] as const;
type Quelle = (typeof QUELLEN)[number];
const istQuelle = (r: string): r is Quelle => (QUELLEN as readonly string[]).includes(r);

export function baueAktionen(q: AktionenQuellen): OberflaechenAktionen {
  return {
    // Schirm an: Vollbild auf dem gewählten Bildschirm öffnen; aus: Fenster schließen (wie die alten Knöpfe).
    ausgabeUmschalten: (an) => void (an ? q.openOutput(q.outputDisplayId ?? undefined) : q.closeOutput()),
    bildschirmWaehlen: (id) => void q.setConfig({ outputDisplayId: id }),
    ausgabeVerschieben: () => void q.openOutput(q.outputDisplayId ?? undefined),
    quelleSchalten: (role, enabled) => {
      if (istQuelle(role)) void q.setConfig({ [role]: { enabled } });
    },
    quelleSetzen: (role, host, port) => {
      if (istQuelle(role)) void q.setConfig({ [role]: { host, port } });
    },
    nachricht: (text) => void q.setConfig({ message: text }),
    widget: (key, an) => void q.setConfig({ widgets: { [key]: an } }),
    pin: (eingabe) => void q.setConfig({ presenter: { pin: eingabe.replace(/\D/g, '').slice(0, 8) } }),
    modus: (m) => void q.setConfig({ presenter: { mode: m } }),
  };
}

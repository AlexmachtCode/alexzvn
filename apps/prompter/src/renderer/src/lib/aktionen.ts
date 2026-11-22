// Aktionen des Panels (UX Welle 2a, Prompter d, Fix 1): rein, ohne window; der Store liefert die Funktionen. Eine Bildschirmwahl
// merkt nur `outputDisplayId` (setConfig) und öffnet oder verschiebt kein Fenster; das Verschieben ist der eigene Knopf.
import type { PartialPrompterConfig } from '@shared/types';
import type { EinstellungenAktionen } from '@/views/Einstellungen';

export interface AktionenQuellen {
  outputDisplayId: number | null;
  setConfig(patch: PartialPrompterConfig): Promise<unknown>;
  openOutput(displayId?: number): Promise<unknown>;
  closeOutput(): Promise<unknown>;
  setRemote(an: boolean): Promise<unknown>;
}

export function baueAktionen(q: AktionenQuellen): EinstellungenAktionen {
  return {
    // Monitor an: Vollbild auf dem gewählten Bildschirm öffnen; aus: Fenster schließen (wie die alten Knöpfe).
    ausgabeUmschalten: (an) => void (an ? q.openOutput(q.outputDisplayId ?? undefined) : q.closeOutput()),
    bildschirmWaehlen: (id) => void q.setConfig({ outputDisplayId: id }),
    ausgabeVerschieben: () => void q.openOutput(q.outputDisplayId ?? undefined),
    konfigurieren: (patch) => void q.setConfig(patch),
    handyUmschalten: (an) => void q.setRemote(an),
  };
}

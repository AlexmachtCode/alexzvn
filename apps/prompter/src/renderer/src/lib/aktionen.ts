// Aktionen des Panels (UX Welle 2a, Prompter d, Fix 1): rein, ohne window; der Store liefert die Funktionen. Eine Bildschirmwahl
// merkt nur `outputDisplayId` (setConfig) und öffnet oder verschiebt kein Fenster; das Verschieben ist der eigene Knopf.
// Dazu das Lesen der Bildschirmliste (Gesamtprüfung M2: wie Stage und Player) und, seit UX Welle 2b, ihr Folgen auf das
// Bildschirm-Ereignis (folgeBildschirmen).
import type { ScreenOption } from '@jm/settings';
import type { DisplayInfo, PartialPrompterConfig } from '@shared/types';
import type { EinstellungenAktionen } from '@/views/Einstellungen';
import { bildschirmEtikett } from './oberflaeche';

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

/**
 * Bildschirmliste lesen (`output:displays`, Gesamtprüfung M2 wie Stage und Player): frisch, mit dem Etikett der Auswahl. Ein
 * Fehler ergibt undefined (unbekannt), nie die alte Liste. Ohne Preload wird nichts gesetzt. Liefert das Aufräumen: eine danach
 * eintreffende Antwort wird verworfen.
 */
export function liesBildschirme(frage: (() => Promise<DisplayInfo[]>) | undefined, setze: (liste: ScreenOption[] | undefined) => void): () => void {
  if (frage === undefined) return () => undefined;
  let weg = false;
  void frage().then(
    (liste) => {
      if (!weg) setze(liste.map((d) => ({ id: d.id, label: bildschirmEtikett(d), primary: d.primary })));
    },
    () => {
      if (!weg) setze(undefined);
    },
  );
  return () => {
    weg = true;
  };
}

/**
 * Bildschirmliste dem Bildschirm-Ereignis folgen lassen (UX Welle 2b, `output:bildschirme`): meldet sich an und liest bei jedem
 * Ereignis die Liste neu (`liesBildschirme`). Ein neues Ereignis verwirft die noch offene Antwort des vorigen, damit eine ältere
 * Liste keine neuere überschreibt. Ohne Brücke (kein Ereignis oder keine Abfrage) nichts. Liefert die Abmeldung; danach wird auch
 * eine noch eintreffende Antwort verworfen.
 */
export function folgeBildschirmen(
  onBildschirme: ((cb: () => void) => () => void) | undefined,
  frage: (() => Promise<DisplayInfo[]>) | undefined,
  setze: (liste: ScreenOption[] | undefined) => void,
): () => void {
  if (onBildschirme === undefined || frage === undefined) return () => undefined;
  let offen: () => void = () => undefined;
  const ab = onBildschirme(() => {
    offen();
    offen = liesBildschirme(frage, setze);
  });
  return () => {
    ab();
    offen();
  };
}

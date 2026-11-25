// Aktionen der Oberfläche (UX Welle 2a, Stage-Display d): rein, ohne window; der Store liefert die Funktionen. Eine Bildschirmwahl
// merkt nur `outputDisplayId` (setConfig) und öffnet oder verschiebt kein Fenster; das Verschieben ist der eigene Knopf.
// Dazu das Lesen der Bildschirmliste (Gesamtprüfung I3: wie im Player, auch bei jeder Änderung des Ausgabezustands) und, seit
// UX Welle 2b, ihr Folgen auf das Bildschirm-Ereignis (folgeBildschirmen).
import type { ScreenOption } from '@jm/settings';
import type { DisplayInfo, PartialStageConfig, PresenterMode, StageConfig } from '@shared/types';
import { bildschirmEtikett, type StageAktionen } from './oberflaeche';

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

/**
 * Bildschirmliste lesen (`output:displays`, Gesamtprüfung I3 wie im Player): frisch, mit dem Etikett der Auswahl. Ein Fehler
 * ergibt undefined (unbekannt), nie die alte Liste. Ohne Preload wird nichts gesetzt. Liefert das Aufräumen: eine danach
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

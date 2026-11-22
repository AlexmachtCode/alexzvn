// Aktionen und Abos der Player-Oberfläche (UX Welle 2a, Player d1; E14, E15): rein, ohne window und ohne Store-Import; die View
// reicht Store-Funktionen, Preload-Aufrufe und die Pad-Maschine herein. So bleiben die Abläufe in der View (auch bei
// geschlossenem Panel) und das Panel ohne Effekte.
//
// Ausgabe wie im alten Dialog „Video-Ausgabe“ (ShowView.tsx bis Welle 2a): Ein Tipp auf eine Bildschirmkarte öffnete das
// Vollbild-Ausgabefenster sofort auf diesem Bildschirm (oder zog ein offenes um) und merkte ihn. Im Panel ist das die
// Bildschirmauswahl; anders als bei Prompter und Stage-Display speichert sie nicht nur, sie öffnet. Das Vollbild wird nach
// jeder Ausgabe-Aktion neu gemessen (E14: nie geraten).
import type { ScreenOption } from '@jm/settings';
import type { DisplayInfo } from '@shared/types';
import { bildschirmEtikett, type PlayerAktionen } from '@/lib/oberflaeche';

export interface AktionenQuellen {
  /** Gewählter Ausgabe-Bildschirm aus dem Store (null = noch keiner, der Hauptprozess nimmt den primären). */
  outputDisplayId: number | null;
  /** Bildschirmliste, falls bekannt (für „Automatisch“ = der primäre Bildschirm der Liste). */
  bildschirme: readonly ScreenOption[] | undefined;
  openOutput(displayId?: number): Promise<unknown>;
  closeOutput(): Promise<unknown>;
  toggleFullscreen(): Promise<unknown>;
  /** Läuft nach jeder Ausgabe-Aktion, auch nach einem Fehler: das Vollbild neu messen. */
  nachAusgabe(): void;
}

export function baueAktionen(q: AktionenQuellen): PlayerAktionen {
  const danach = (p: Promise<unknown>): void => void p.then(q.nachAusgabe, q.nachAusgabe);
  return {
    // An: öffnen auf dem gewählten Bildschirm (sonst primär), wie ein Tipp auf dessen Karte; aus: „Ausgabe schließen“.
    ausgabeUmschalten: (an) => danach(an ? q.openOutput(q.outputDisplayId ?? undefined) : q.closeOutput()),
    // Wie der Tipp auf eine Karte: sofort öffnen bzw. umziehen. „Automatisch (Hauptmonitor)“ = die Karte des primären Bildschirms.
    bildschirmWaehlen: (id) => danach(q.openOutput(id ?? q.bildschirme?.find((b) => b.primary)?.id)),
    // Wie „Vollbild aus/an“: umschalten; der neue Wert kommt aus der Messung danach, nicht aus der Antwort.
    vollbildUmschalten: () => danach(q.toggleFullscreen()),
  };
}

/** Was das Pad-Abo von der cueEngine braucht. */
export interface PadMaschine {
  aktiveIds(): number[];
  onChange(cb: (ids: number[]) => void): () => void;
}

/**
 * Pad-Meldung abonnieren (W2-1): erst anmelden, dann mit den gerade spielenden Pads vorbelegen (dazwischen geht keine
 * Meldung verloren). Liefert die Abmeldung für das Aufräumen des Effekts.
 */
export function padsAbonnieren(maschine: PadMaschine, setze: (ids: number[]) => void): () => void {
  const ab = maschine.onChange(setze);
  setze(maschine.aktiveIds());
  return ab;
}

/**
 * Bildschirmliste lesen (`output:displays`): frisch, mit dem Etikett der alten Bildschirmkarte. Ein Fehler ergibt undefined
 * („nicht geladen“), nie die alte Liste. Ohne Preload wird nichts gesetzt. Liefert das Aufräumen: eine danach eintreffende
 * Antwort wird verworfen.
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
 * Vollbild des Ausgabefensters lesen (E14, `output:isFullscreen`): übernommen wird nur ein gemessener Wahrheitswert; null
 * (kein Fenster) oder ein Fehler ergeben null = kein Messwert. Ohne Preload wird nichts gesetzt (bleibt „nicht gefragt“).
 * Liefert das Aufräumen: eine danach eintreffende Antwort wird verworfen.
 */
export function liesVollbild(frage: (() => Promise<boolean | null>) | undefined, setze: (v: boolean | null) => void): () => void {
  if (frage === undefined) return () => undefined;
  let weg = false;
  void frage().then(
    (v) => {
      if (!weg) setze(typeof v === 'boolean' ? v : null);
    },
    () => {
      if (!weg) setze(null);
    },
  );
  return () => {
    weg = true;
  };
}

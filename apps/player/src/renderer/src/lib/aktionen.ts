// Aktionen und Abos der Player-Oberfläche (UX Welle 2a, Player d1; E14, E15): rein, ohne window und ohne Store-Import; die View
// reicht Store-Funktionen, Preload-Aufrufe und die Pad-Maschine herein. So bleiben die Abläufe in der View (auch bei
// geschlossenem Panel) und das Panel ohne Effekte.
//
// Ausgabe aus dem alten Dialog „Video-Ausgabe“ (ShowView.tsx bis Welle 2a), Fix-Runde 1 nach Ruling des Controllers: Die
// Bildschirmauswahl im Panel speichert nur (wie Prompter und Stage-Display). Ein natives <select> meldet `change` auch auf
// Pfeiltasten und Tippen eines Buchstabens; eine öffnende Auswahl hätte so das Programmbild mitten in der Show umgezogen.
// Öffnen und Schließen laufen über den Ausgabeschalter, das Umziehen eines offenen Fensters über „Auf diesen Bildschirm“ mit
// demselben Aufruf wie der alte Tipp auf die Bildschirmkarte (`openOutput(id)`). Das Vollbild wird nach jeder Ausgabe-Aktion
// neu gemessen (E14: nie geraten), und der Vollbild-Schalter schaltet nur, wenn der Messwert vom Wunsch abweicht.
import type { ScreenOption } from '@jm/settings';
import type { DisplayInfo } from '@shared/types';
import { bildschirmEtikett, type PlayerAktionen } from '@/lib/oberflaeche';

/** Die Aktionen des Panels: Ausgabe, Bildschirm und Vollbild aus lib/oberflaeche.ts, dazu „Auf diesen Bildschirm“. */
export interface EinstellungenAktionen extends PlayerAktionen {
  /** Das offene Ausgabefenster auf den gemerkten Bildschirm ziehen (`openOutput`, wie der alte Tipp auf die Karte). */
  ausgabeVerschieben(): void;
}

export interface AktionenQuellen {
  /** Gemerkter Ausgabe-Bildschirm aus dem Store (null = automatisch, der Hauptprozess nimmt den primären). */
  outputDisplayId: number | null;
  /** Gemessenes Vollbild (`output:isFullscreen`); ohne Messwert (undefined, null) schaltet der Vollbild-Schalter nie. */
  vollbild: boolean | null | undefined;
  /** Bildschirm nur merken (Store-Setter), ohne Fenster. */
  setOutputDisplayId(id: number | null): void;
  openOutput(displayId?: number): Promise<unknown>;
  closeOutput(): Promise<unknown>;
  toggleFullscreen(): Promise<unknown>;
  /** Läuft nach jeder Ausgabe-Aktion, auch nach einem Fehler: das Vollbild neu messen. */
  nachAusgabe(): void;
}

export function baueAktionen(q: AktionenQuellen): EinstellungenAktionen {
  const danach = (p: Promise<unknown>): void => void p.then(q.nachAusgabe, q.nachAusgabe);
  const aufGemerktem = (): Promise<unknown> => q.openOutput(q.outputDisplayId ?? undefined);
  return {
    // An: öffnen auf dem gemerkten Bildschirm (null → primär), wie ein Tipp auf dessen Karte; aus: „Ausgabe schließen“.
    ausgabeUmschalten: (an) => danach(an ? aufGemerktem() : q.closeOutput()),
    // Nur merken: kein Öffnen, kein Umziehen, kein Fokus. „Automatisch (Hauptmonitor)“ merkt null.
    bildschirmWaehlen: (id) => q.setOutputDisplayId(id),
    // „Auf diesen Bildschirm“: das offene Fenster auf den gemerkten Bildschirm ziehen.
    ausgabeVerschieben: () => danach(aufGemerktem()),
    // Wie „Vollbild aus/an“, aber nur, wenn der Messwert vom Wunsch abweicht: ein veralteter Schalter kehrt die Wirkung nie um.
    vollbildUmschalten: (an) => {
      if (typeof q.vollbild === 'boolean' && q.vollbild !== an) danach(q.toggleFullscreen());
    },
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

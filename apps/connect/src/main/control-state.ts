// STATE von JM Connect aus zwei Teilen (Spec 11.3): Den Raum-Teil (room, onair, lobby, active_label …)
// meldet der Operator-Renderer, den Zoom-Teil (zoom_status … zoom_cmd_rejected) die Zoom-Hülle. Jeder
// Push ersetzt nur seinen Teil; gesendet wird immer die Mischung. Vorher ersetzte jeder Renderer-Push den
// ganzen STATE und hätte die zoom_*-Werte gelöscht.
// Rein (G8: kein electron, keine Aliase), damit control-state.test.ts den Ablauf prüfen kann.

/** Ein STATE-Teil: key=value-Paare wie in SuiteState.kv. */
export type Kv = Record<string, string | number | boolean>;

/** Startwerte des Raum-Teils, bevor der Renderer zum ersten Mal meldet (wie bisher in control-server.ts). */
export const RAUM_START: Kv = { room: '', onair: 0, lobby: 0, guests: 0, talkback: 0 };

/** Raum-Teil und Zoom-Teil zu einem STATE. Die Schlüssel überschneiden sich nicht (zoom_* gehört nur Zoom). */
export function mischeState(raum: Kv, zoom: Kv): Kv {
  return { ...raum, ...zoom };
}

export interface StateSpeicher {
  /** Renderer-Push: ersetzt nur den Raum-Teil, dann senden. */
  raum(kv: Kv): void;
  /** Zoom-Hülle: ersetzt nur den Zoom-Teil, dann senden. `{}` ohne Zoom-Kern (macOS). */
  zoom(kv: Kv): void;
  /** Der aktuelle gemischte Stand (Kopie). */
  aktuell(): Kv;
}

/** Hält beide Teile und ruft `senden` nach jedem Push mit der Mischung (eine neue Kopie je Aufruf). */
export function erzeugeStateSpeicher(senden: (kv: Kv) => void, raumStart: Kv = RAUM_START): StateSpeicher {
  let raumKv: Kv = { ...raumStart };
  let zoomKv: Kv = {};
  const schicke = (): void => senden(mischeState(raumKv, zoomKv));
  return {
    raum(kv) {
      raumKv = { ...kv };
      schicke();
    },
    zoom(kv) {
      zoomKv = { ...kv };
      schicke();
    },
    aktuell: () => mischeState(raumKv, zoomKv),
  };
}

/**
 * Meldet einen STATE-Teil nur, wenn er sich geändert hat (Vergleich über JSON); der erste Aufruf meldet
 * immer, `null` gilt als leerer Teil `{}`. Für den Zoom-Teil: Spec 11.3 verlangt einen Push bei jeder
 * Änderung eines der sieben zoom_*-Werte, nicht bei jedem Abbild.
 */
export function aenderungsMelder(senden: (kv: Kv) => void): (kv: Kv | null) => void {
  let letzter: string | null = null;
  return (kv) => {
    const teil = kv ?? {};
    const json = JSON.stringify(teil);
    if (json === letzter) return;
    letzter = json;
    senden({ ...teil });
  };
}

/** Die beiden Ziele eines Steuerbefehls (index.ts): die Zoom-Hülle im Main und der Operator-Renderer (→ DO). */
export interface Steuerziele {
  zoom(cmd: { verb: string; args: string[] }): void;
  renderer(cmd: { verb: string; args: string[] }): void;
}

/**
 * Weiche für Befehle des Steuerservers (Spec 11.2, Ergänzung 0.3): zoom_* geht an die Zoom-Hülle im Main, nie an den
 * Renderer oder den DO; alles andere an den Renderer. Der Parser liefert das Verb klein.
 */
export function leiteSteuerbefehl(cmd: { verb: string; args: string[] }, ziele: Steuerziele): void {
  if (cmd.verb.startsWith('zoom_')) ziele.zoom(cmd);
  else ziele.renderer(cmd);
}

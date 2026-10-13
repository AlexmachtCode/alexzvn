import type { Command } from './timer-state';

/**
 * Verbund-Anzeige über die Preload-Brücke (Master-Link Teil 2b, Release 2, Spec 16.4/16.5).
 * Strukturgleich mit `VerbundAnzeige` aus `@jm/app-runtime`; eigener Typ, damit die Renderer-
 * Typprüfung (tsconfig.web.json) app-runtime mit seinen Electron-Typen nicht einliest (E28).
 */
export interface VerbundAnzeigeZeile {
  text: string;
  farbe: 'gruen' | 'gelb' | 'rot' | 'gedaempft';
}

/** Ändert der Befehl die Punkte des Ablaufs? Über alle Befehle: ein neuer Befehl braucht hier eine Entscheidung (Typecheck). */
const AENDERT_PUNKTE: Record<Command['type'], boolean> = {
  setDuration: false,
  start: false,
  pause: false,
  reset: false,
  addDelay: false,
  clearDelay: false,
  setColors: false,
  'tt:add': true,
  'tt:update': true,
  'tt:delete': true,
  'tt:move': true,
  'tt:setAll': true,
  'tt:replaceItems': true,
  'tt:loadItem': false,
  'tt:next': false,
  'tt:prev': false,
  'tt:clearActive': false,
  'tt:setAutoAdvance': false,
  'tt:setAutoAdvanceGrace': false,
  'msg:set': false,
  'msg:setBlink': false,
  'msg:clear': false,
};

/**
 * Ablauf von Hand (Spec 16.1, E16, E56): Ändert der Bediener außerhalb des Verbundmodus die Punkte des Ablaufs
 * (Socket :7777, Operator- und Remote-Ansicht), ersetzt das die Daten eines früheren Masters wie eine eigene Show;
 * der Main ruft dann `verbundDatenErsetzt()`. Sonst wendete der nächste Start den Zwischenspeicher an ('reload' →
 * `tt:replaceItems`), verdrängte die Liste des Bedieners, und V13 „Daten vom früheren Master …“ bliebe stehen.
 * Im Verbundmodus bleibt der Zwischenspeicher. Countdown, Navigation, Farben und Meldung ersetzen nichts: Der
 * Zwischenspeicher tauscht beim Start nur die Punkte.
 */
export function ersetztVerbundDaten(cmd: Command, imVerbundmodus: boolean): boolean {
  return !imVerbundmodus && AENDERT_PUNKTE[cmd.type] === true;
}

/**
 * Show → Timer-Aktionen (Master-Link Teil 2b, Release 2, Spec 17.1). Liest nichts und führt nichts
 * aus: Der Main ruft die Funktion für eine gelesene Show-Datei (`applyShowFromPath`) und für einen
 * Stand vom Master (`folgeMasterShow`) und führt die Aktionen mit `dispatch` aus.
 *
 * Regel (G7): aus `@jm/show` und `./timer-state` NUR Typen. Der Laufzeitimport von `./show-ablauf.ts`
 * trägt die Endung, damit der Selbsttest (`node --experimental-strip-types`) ihn ohne Pfad-Hilfe
 * auflöst (beide Timer-tsconfigs: `allowImportingTsExtensions`). Ob die Show eine eigene Timer-Liste
 * trägt, rechnet der Aufrufer mit `hatEigeneTimerListe` aus `@jm/show` (dritter Parameter).
 */
import type { Show } from '@jm/show';
import type { Command } from './timer-state';
import { ablaufToTimetable, parseTimetable } from './show-ablauf.ts';

/** Die Befehle, die eine Show im Timer auslöst (Spec 17.1). */
export type TimerAktion = Extract<Command, { type: 'tt:setAll' | 'tt:replaceItems' | 'setDuration' }>;

/**
 * `mode`:
 *  - `'initial'` (Show öffnen, neue Show vom Master): `tt:setAll` — ersetzt den Ablauf und setzt den
 *    Countdown zurück; dazu `setDuration` aus `settings.durationMs` (Zahl ≥ 0).
 *  - `'reload'` (RELOAD, neuer Stand derselben Show, Start mit Zwischenspeicher): `tt:replaceItems` —
 *    tauscht nur die Punkte, ein laufender Countdown bleibt, der aktive Punkt folgt seiner Kennung.
 * `eigeneListe`: Die Show trägt eine eigene Timer-Liste (`hatEigeneTimerListe`); sie hat Vorrang vor
 * dem Ablauf. Ohne Ablauf und ohne Liste kommt kein Punkte-Befehl.
 */
export function timerAktionenAusShow(show: Show, mode: 'initial' | 'reload', eigeneListe: boolean): TimerAktion[] {
  const settings = show.tools.find((t) => t.appId === 'jm-timer')?.settings;
  const items = eigeneListe ? parseTimetable(settings?.timetable) : ablaufToTimetable(show.ablauf);
  const aktionen: TimerAktion[] = [];
  if (items) aktionen.push(mode === 'reload' ? { type: 'tt:replaceItems', items } : { type: 'tt:setAll', items });
  const dauer = settings?.durationMs;
  if (mode === 'initial' && typeof dauer === 'number' && dauer >= 0) aktionen.push({ type: 'setDuration', ms: dauer });
  return aktionen;
}

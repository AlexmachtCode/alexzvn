// UX Welle 1, Timer d · Nachbesserung 1: Verbindungsereignisse (auch connect_error), Mindestbreiten im Ablauf, containerbasiertes
// Raster der Haupttasten und rollenbasierte Schlüssel der Tasten.
import { gleich, leseText, ok, render } from '@jm/ui/testhilfe';
import { ABLAUF_LAYOUT, anzeigeVerbindung, TASTEN_MIN_BREITE, TASTEN_VIER_BREITE, tastenSpalten, verbindungNach } from '@/lib/oberflaeche';
import { INITIAL_STATE } from '@shared/timer-state';
import { HauptTasten, tastenSchluessel } from '@/views/LiveBereich';
import { ohneKommentare } from './testzustand';

// ── Verbindung: connect, disconnect und connect_error ──
{
  gleich(
    [verbindungNach('connect'), verbindungNach('disconnect'), verbindungNach('connect_error')],
    [true, false, false],
    'TI Verbindung: connect → verbunden, disconnect und connect_error → offline',
  );
  gleich(
    [anzeigeVerbindung(false, false), anzeigeVerbindung(false, true), anzeigeVerbindung(true, false), anzeigeVerbindung(true, true)],
    [undefined, undefined, false, true],
    'TI Verbindung: vor dem ersten Ereignis undefined (unbekannt), danach der Wert des Stores',
  );
  const app = ohneKommentare(leseText('src/renderer/src/App.tsx'));
  ok(
    app.includes("on('connect_error',") && app.includes("off('connect_error',") && app.includes('verbindungNach'),
    'TI Verbindung: App.tsx abonniert connect_error und meldet es im Aufräumen ab (schlägt der erste Aufbau fehl, wird aus „unbekannt“ „offline“)',
  );
  ok(leseText('src/renderer/src/sync/client.ts').includes("socket.on('connect_error', (err) => {"), 'TI Verbindung: sync/client.ts bleibt unverändert');
}

// ── Ablauf: Mindestbreite der Liste ──
{
  const L = ABLAUF_LAYOUT;
  const textBreite = L.listeMin - L.festSpalten - L.luecken - L.innenAbstand;
  ok(textBreite / 2 >= L.textMin, `TI Ablauf-Breite: bei listeMin ${L.listeMin} px bekommen Titel und Notiz je ${textBreite / 2} px (mindestens ${L.textMin})`);
  // Fenster-Mindestbreite 1024 (main/index.ts), Sidebar 200, Panel 360 px, Ränder ≈ 148 px: ohne Mindestbreite wäre der Platz kleiner als nötig.
  const platz = 1024 - 200 - 360 - 148;
  ok(platz < L.listeMin, 'TI Ablauf-Breite: bei 1024 px mit Panel reicht der Platz nicht, die Liste muss also waagerecht scrollen');
  const q = ohneKommentare(leseText('src/renderer/src/components/Timetable.tsx'));
  ok(q.includes('overflow-x-auto') && q.includes(`min-w-[${L.listeMin}px]`), 'TI Ablauf-Breite: Kopfzeile und Zeilen liegen in einem Scroll-Behälter mit der Mindestbreite');
  const tracks = '[36px_minmax(0,1fr)_96px_120px_minmax(0,1fr)_96px_136px]';
  ok(q.includes(tracks) && leseText('src/renderer/src/components/TimetableRow.tsx').includes(tracks), 'TI Ablauf-Breite: die festen Spalten bleiben, Summe 36+96+120+96+136 = ' + L.festSpalten);
  gleich(36 + 96 + 120 + 96 + 136, L.festSpalten, 'TI Ablauf-Breite: festSpalten stimmt mit den Spalten überein');
  gleich(6 * 12, L.luecken, 'TI Ablauf-Breite: luecken = 6 Lücken à 12 px (gap-3)');
}

// ── Haupttasten: Raster nach Containerbreite, Schlüssel nach Rolle ──
{
  const q = ohneKommentare(leseText('src/renderer/src/views/LiveBereich.tsx'));
  const spalten = (n: number): Set<number> => new Set(Array.from({ length: 1101 }, (_, i) => tastenSpalten(n, 300 + i)));
  gleich([...spalten(2)], [2], 'TI Tasten-Raster: zwei Tasten (Countdown) stehen in jeder Containerbreite 300–1400 px in einer Reihe (1×2)');
  gleich([...spalten(4)].sort(), [2, 4], 'TI Tasten-Raster: vier Tasten stehen als 2×2 oder 1×4, nie 3+1 (Breite 300–1400 px)');
  gleich([tastenSpalten(4, TASTEN_VIER_BREITE - 1), tastenSpalten(4, TASTEN_VIER_BREITE)], [2, 4], `TI Tasten-Raster: die Grenze liegt bei ${TASTEN_VIER_BREITE} px = 4×${TASTEN_MIN_BREITE} + 3 Lücken à 12`);
  gleich(TASTEN_VIER_BREITE, 4 * TASTEN_MIN_BREITE + 3 * 12, 'TI Tasten-Raster: Grenzbreite aus Mindestbreite und Lücke abgeleitet');
  ok(
    q.includes('@container') && q.includes(`gap-3 @[${TASTEN_VIER_BREITE}px]:grid-cols-4`) && q.includes("RASTER_ZWEI = 'grid w-full grid-cols-2 gap-3'") && !/(sm|md|lg|xl):grid-cols/.test(q),
    'TI Tasten-Raster: Container-Query (@container, @[Wpx]:grid-cols-4) mit grid-cols-2 als Basis, keine Viewport-Breakpoints; die Klassen stehen als Literal im Quelltext (Tailwind-Scan)',
  );
  // Vier Tasten à 160 px + Lücken passen bei 1024 px mit Sidebar und Panel (Inhalt ≈ 408 px) nicht nebeneinander: 2×2.
  gleich(tastenSpalten(4, 1024 - 200 - 360 - 56), 2, 'TI Tasten-Raster: bei 1024 px mit Panel und Sidebar zwei Spalten');
  const stand = { timer: { countdown: INITIAL_STATE.countdown, timetable: { ...INITIAL_STATE.timetable, items: [{ id: 'a', label: 'A', durationMs: 1 }, { id: 'b', label: 'B', durationMs: 1 }], activeIndex: 0 } } };
  const lauf = { ...stand, timer: { ...stand.timer, countdown: { ...INITIAL_STATE.countdown, startedAtMs: 1 } } };
  const pause = { ...stand, timer: { ...stand.timer, countdown: { ...INITIAL_STATE.countdown, pausedRemainingMs: 5 } } };
  const schl = (s: typeof stand): string[] => tastenSchluessel(s, 'timetable');
  gleich([schl(stand), schl(lauf), schl(pause)], Array(3).fill(['prev', 'start', 'reset', 'next']), 'TI Tasten-Schlüssel: Rollen prev/start/reset/next, unverändert bei Start, Pause und Resume (Fokus bleibt)');
  gleich(tastenSchluessel(stand, 'countdown'), ['start', 'reset'], 'TI Tasten-Schlüssel: Countdown start/reset');
  ok(q.includes('key={rolle}') && !q.includes('key={taste.label}'), 'TI Tasten-Schlüssel: HauptTasten nutzt die Rolle als key, nie die Beschriftung');
  const html = render(<HauptTasten stand={stand} mode="timetable" aktionen={{ start() {}, pause() {}, reset() {}, prev() {}, next() {} }} />);
  ok(html.includes('@container') && html.includes('@[676px]:grid-cols-4'), 'TI Tasten-Raster: gerendert trägt die Hülle @container und das Raster @[676px]:grid-cols-4');
}

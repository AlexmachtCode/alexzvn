// UX Welle 1, Timer d · Nachbesserung 1: Verbindungsereignisse (auch connect_error), Mindestbreiten im Ablauf, containerbasiertes
// Raster der Haupttasten und rollenbasierte Schlüssel der Tasten.
import { createHash } from 'node:crypto';
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

// ── TI Anzeige-Breite: die laufende Zeit passt in ihre Spalte, auch mit Seitenleiste und offenem Panel (Fund B1) ──
// Annahmen (geschätzt aus den Schriftmaßen, nicht im Fenster gemessen): Manrope extrafett mit tabular-nums, Ziffer 0,62 em,
// Doppelpunkt 0,3 em, Minus 0,4 em, Laufweite tracking-tight −0,01 em je Zeichen; „-00:00:00“ (Überzeit) ist die breiteste
// Anzeige. Windows-Rahmen 16 px (2×8, nicht gemessen); Seitenleiste 200 px + 1 px Rand ab 1024 px Seitenbreite (lg); Panel
// 360 px (--panel-w), angedockt ab 900 px Seitenbreite; Inhalt px-7 (2×28), Modus-Ansicht px-2 (2×8).
{
  const anzeige = ohneKommentare(leseText('src/renderer/src/components/TimerDisplay.tsx'));
  const oberflaeche = ohneKommentare(leseText('src/renderer/src/views/TimerOberflaeche.tsx'));
  ok(
    anzeige.includes("fit: 'clamp(3rem, 14cqi, 14rem)'") && anzeige.includes("fullscreen: 'clamp(6rem, 22vw, 26rem)'") && anzeige.includes("preview: 'clamp(1.25rem, 3.2vw, 2rem)'"),
    'TI Anzeige-Breite: „fit“ richtet sich nach der Breite des Behälters (14cqi), „fullscreen“ (Speaker) und „preview“ bleiben am Fenster',
  );
  ok(/className="@container mx-auto h-full max-w-\[1400px\] px-7 py-6"/.test(oberflaeche), 'TI Anzeige-Breite: der Inhalt der Modus-Ansichten ist der Behälter (@container), aus dem 14cqi rechnet');
  const breiteEm = 6 * 0.62 + 2 * 0.3 + 0.4 - 9 * 0.01;
  const schrift = (basis: number): number => Math.min(224, Math.max(48, 0.14 * basis));
  const faelle: Array<{ fenster: number; panel: boolean; seite: number; behaelter: number; platz: number }> = [];
  for (let fenster = 1024; fenster <= 2560; fenster += 8) {
    for (const panel of [false, true]) {
      const seite = fenster - 16;
      const spalte = seite - (seite >= 1024 ? 201 : 0) - (panel && seite >= 900 ? 360 : 0);
      const behaelter = Math.min(1400, spalte) - 56;
      faelle.push({ fenster, panel, seite, behaelter, platz: behaelter - 16 });
    }
  }
  const zuBreit = faelle.filter((f) => breiteEm * schrift(f.behaelter) > f.platz);
  ok(zuBreit.length === 0, `TI Anzeige-Breite: in ${faelle.length} Fällen (Fenster 1024–2560 px, Panel offen/zu) passt „-00:00:00“ in die Spalte${zuBreit.length ? ` – zu breit bei ${zuBreit.slice(0, 3).map((f) => f.fenster).join(', ')} px` : ''}`);
  const vorher = faelle.filter((f) => f.panel && f.fenster >= 1040 && f.fenster <= 1300 && breiteEm * schrift(f.seite) > f.platz);
  ok(vorher.length === faelle.filter((f) => f.panel && f.fenster >= 1040 && f.fenster <= 1300).length, 'TI Anzeige-Breite: Gegenprobe: mit 14vw lief die Zeit bei 1040–1300 px mit Seitenleiste und offenem Panel in jedem Fall aus der Spalte');
  // Ablauf: die Zeit steht in der aktiven Karte neben dem Titel (p-6, Rand 1, gap-6); der Titel darf auf 0 schrumpfen (min-w-0).
  const ablaufZuBreit = faelle.filter((f) => breiteEm * schrift(f.behaelter) > f.platz - 2 * 24 - 2 - 24);
  ok(ablaufZuBreit.length === 0, 'TI Anzeige-Breite: im Ablauf passt die Zeit samt Abstand in die aktive Karte');
  const kopf = ohneKommentare(leseText('src/renderer/src/components/ModusKopf.tsx'));
  ok(
    kopf.includes('className="flex flex-wrap items-center justify-between gap-3 pb-6"') && kopf.includes('className="flex flex-wrap items-center gap-2"'),
    'TI Anzeige-Breite: der Kopf der Modus-Ansicht bricht um (flex-wrap), „XLSX importieren“ und „+ Item“ bleiben im Bild',
  );
}

// ── TI Speaker unberührt (E18): Speaker.tsx ist seit der Erhebung unverändert ──
{
  // git-Blob-Kennung des Inhalts (LF) gegen die Kennung am Erhebungsstand 210e1d9dcb; ohne git berechnet.
  const inhalt = Buffer.from(leseText('src/renderer/src/views/Speaker.tsx'), 'utf8');
  const blob = createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${inhalt.length}\0`), inhalt])).digest('hex');
  gleich(blob, '7a672179e3fc3be978aec36ca9501e9f74d84d5f', 'TI Speaker unberührt: views/Speaker.tsx ist inhaltsgleich mit dem Stand vor dem Umbau (E18), die Speaker-Anzeige rechnet weiter mit dem Fenster');
}

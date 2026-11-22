// UX Welle 1, Switcher d2 · Live-Bereich und Haupttasten (Spec 3.4, 5.1; E5, E7, E8): Cut, Auto, Aufnahme und Stream als
// TallyButtons aus liveTasten(hauptTasten(…)), das Dauer-Feld neben Auto, die Ausgabeleiste ohne LIVE/REC und ohne NDI-
// Quellwahl, das untere Panel als Collapsible. Render ohne Browser (SwitcherView importiert ohne window).
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { AudioController } from '@/core/audio';
import { hauptTasten, SWITCHER_TEXTE, UNTEN_OFFEN_AB, untenStartOffen, type OberflaechenStand } from '@/lib/oberflaeche';
import { Haupttasten, KACHEL_MIN_H, liveTasten } from '@/views/LiveBereich';
import { kreuz } from './hilfe';
import { OutputBar } from '@/views/SwitcherView';
import { attr, basisEinstellungen, basisStand, ohneKommentare, tags, text } from './testzustand';

const T = SWITCHER_TEXTE;
const aus = { recording: false, streaming: false, recPath: null, error: null, errorScope: null };
const aktion = (log: string[]) => ({
  cut: () => void log.push('cut'),
  auto: () => void log.push('auto'),
  aufnahme: () => void log.push('aufnahme'),
  stream: () => void log.push('stream'),
});
function leiste(z: Partial<OberflaechenStand> = {}, log: string[] = [], autoMs = 1000): string {
  const tasten = liveTasten(hauptTasten(basisStand(z)), aktion(log));
  return render(<Haupttasten tasten={tasten} autoMs={autoMs} onAutoMs={(ms) => void log.push(`dauer ${ms}`)} />);
}
/** Die Knöpfe (TallyButton) der Leiste in Reihenfolge: [Beschriftung, data-state, aria-disabled, sichtbarer Grund]. */
function knoepfe(html: string): Array<[string, string | undefined, string | undefined, string]> {
  return [...html.matchAll(/<button[^>]*data-state[^>]*>[\s\S]*?<\/button>/g)].map((m) => {
    const knopf = m[0];
    const label = /<span>([^<]*)<\/span>/.exec(knopf)?.[1] ?? '';
    const grund = /<span id="[^"]*"[^>]*>([^<]*)<\/span>/.exec(knopf)?.[1] ?? '';
    const tag = tags(knopf, 'button')[0];
    return [label, attr(tag, 'data-state'), attr(tag, 'aria-disabled'), grund];
  });
}

// ── Vier Tasten in fester Reihenfolge, gesperrt mit Grund, live während der Sendung ──
{
  const frei = { canTake: true, canAuto: true };
  const f = (z: Partial<OberflaechenStand>): ReturnType<typeof knoepfe> => knoepfe(leiste(z));
  gleich(
    f({}).map((k) => k[0]),
    [T.haupttaste.cut, T.haupttaste.auto, T.haupttaste.aufnehmen, T.haupttaste.streamStarten],
    'SW Live Tasten: vier TallyButtons in der Reihenfolge Cut, Auto, Aufnahme, Stream',
  );
  gleich(
    f({ canTake: false, canAuto: false }),
    [
      ['Cut', 'gesperrt', 'true', T.keineSzeneInVorschau],
      ['Auto', 'gesperrt', 'true', T.keineSzeneInVorschau],
      ['Aufnehmen', 'bereit', undefined, ''],
      ['Stream starten', 'gesperrt', 'true', T.keinStreamZiel],
    ],
    'SW Live Tasten: ohne Vorschau und Ziel sind Cut, Auto und Stream gesperrt (aria-disabled) mit sichtbarem Grund, Aufnahme bereit',
  );
  gleich(
    f({ ...frei, settings: basisEinstellungen({ rtmpUrl: 'rtmp://x/y' }) }),
    [
      ['Cut', 'bereit', undefined, ''],
      ['Auto', 'bereit', undefined, ''],
      ['Aufnehmen', 'bereit', undefined, ''],
      ['Stream starten', 'bereit', undefined, ''],
    ],
    'SW Live Tasten: mit Vorschau und Ziel sind alle vier bereit, ohne aria-disabled',
  );
  gleich(
    f({ ...frei, transitioning: true }).slice(0, 2),
    [
      ['Cut', 'bereit', undefined, ''],
      ['Auto', 'gesperrt', 'true', T.ueberblendungLaeuft],
    ],
    'SW Live Tasten: bei laufender Überblendung ist Auto gesperrt mit „Überblendung läuft“, Cut bleibt bereit (nach canTake)',
  );
  gleich(
    f({ ...frei, output: { ...aus, recording: true, streaming: true } }).slice(2),
    [
      ['Aufnahme stoppen', 'live', undefined, ''],
      ['Stream stoppen', 'live', undefined, ''],
    ],
    'SW Live Tasten: Aufnahme und Stream sind live, solange sie laufen, und tragen die Stopp-Beschriftung; Stopp nie gesperrt',
  );
  gleich(
    f({ output: { ...aus, streaming: true } })[3],
    ['Stream stoppen', 'live', undefined, ''],
    'SW Live Tasten: laufender Stream ohne Ziel bleibt stoppbar (nie live und gesperrt, E7)',
  );
  enthaelt(leiste({ output: { ...aus, recording: true } }), '>LIVE<', 'SW Live Tasten: eine laufende Aufnahme zeigt die Kennung LIVE auf dem Knopf');
  ok(
    liveTasten(hauptTasten(basisStand()), aktion([])).every((t) => !t.shortcut),
    'SW Live Tasten: keine Kürzel (E1)',
  );
  pruefeIdVerweise(leiste(), 'SW Live Tasten: id-Verweise der Sperrgründe gültig');
}

// ── SW Live Tasten: stabile Zeilenhöhe (Fund A3: „Überblendung läuft“ ließ die Zeile bei jedem Auto wachsen) ──
{
  // Höhe eines TallyButtons aus den Klassen in TallyButton.tsx und der Zeilenhöhe der Seite (--leading-normal, base.css setzt
  // sie am html; text-[15px] und text-[11px] setzen nur die Schriftgröße). Annahmen: Beschriftung und Grund stehen je in einer
  // Zeile (eine Kachel ist bei 1920 px Fensterbreite mit offenem Panel etwa 340 px breit); in sehr schmalen Kacheln (kleinstes
  // Fenster mit offenem Panel, etwa 140 px) können Beschriftung und Grund umbrechen, dann wächst die Zeile weiter wie bisher.
  const tally = leseText('../../packages/ui/src/components/TallyButton.tsx');
  const lh = Number(/--leading-normal:\s*([\d.]+)/.exec(leseText('../../packages/ui/src/tokens/typography.css'))?.[1]);
  const steuerLg = Number(/--control-h-lg:\s*(\d+)px/.exec(leseText('../../packages/ui/src/tokens/sizes.css'))?.[1]);
  ok(
    ['min-h-[var(--control-h-lg)]', 'gap-1', 'border-2', 'py-2', 'text-[15px] font-extrabold', 'text-[11px] font-semibold', 'leading-none'].every((k) => tally.includes(k) || leseText('../../packages/ui/src/lib/status.ts').includes(k)) &&
      lh === 1.55 &&
      steuerLg === 48,
    'SW Live Tasten Höhe: die Maße des TallyButtons stehen wie angenommen in den Quellen (Rand 2, py-2, gap-1, 15/11 px, Zeilenhöhe 1,55, Mindesthöhe 48)',
  );
  const rahmen = 2 * 2 + 2 * 8;
  const hoehe = (state: 'bereit' | 'live' | 'gesperrt'): number => {
    // live: Kennung LIVE in 19 px leading-none mit py-0.5 und border-2 (LIVE_FLAECHE_KLASSE), ohne Grund (im Switcher nie live und gesperrt).
    const inhalt = state === 'live' ? 19 + 4 + 4 : state === 'gesperrt' ? 15 * lh + 4 + 11 * lh : 15 * lh;
    return Math.max(steuerLg, rahmen + inhalt);
  };
  ok(KACHEL_MIN_H >= hoehe('gesperrt') && KACHEL_MIN_H - hoehe('gesperrt') < 1, `SW Live Tasten Höhe: die Kachel reserviert die Höhe einer gesperrten Taste mit einer Grundzeile (${hoehe('gesperrt').toFixed(2)} px → ${KACHEL_MIN_H} px)`);
  const faelle = kreuz({ canTake: [false, true], canAuto: [false, true], transitioning: [false, true], recording: [false, true], streaming: [false, true], ziel: ['', 'rtmp://x/y'] } as const);
  const zeilen = new Set(
    faelle.map((f) => {
      const t = hauptTasten(basisStand({ canTake: f.canTake, canAuto: f.canAuto, transitioning: f.transitioning, output: { ...aus, recording: f.recording, streaming: f.streaming }, settings: basisEinstellungen({ rtmpUrl: f.ziel }) }));
      return Math.max(KACHEL_MIN_H, ...[t.cut, t.auto, t.aufnahme, t.stream].map((x) => hoehe(x.state)));
    }),
  );
  gleich([...zeilen], [KACHEL_MIN_H], `SW Live Tasten Höhe: in allen ${faelle.length} Zuständen (Vorschau, Überblendung, Aufnahme, Stream, Ziel) bleibt die Tastenzeile ${KACHEL_MIN_H} px hoch`);
  const ohne = new Set(faelle.map((f) => {
    const t = hauptTasten(basisStand({ canTake: f.canTake, canAuto: f.canAuto, transitioning: f.transitioning, settings: basisEinstellungen({ rtmpUrl: f.ziel }) }));
    return Math.max(...[t.cut, t.auto, t.aufnahme, t.stream].map((x) => hoehe(x.state))).toFixed(2);
  }));
  gleich([...ohne].sort(), ['48.00', '64.30'], 'SW Live Tasten Höhe: Gegenprobe ohne Reservierung: die Zeile wäre je Zustand 48 oder 64,3 px hoch');
  const html = leiste({ canTake: true, canAuto: true });
  const kacheln = [...html.matchAll(/<div class="([^"]*)"><button[^>]*data-state/g)].map((m) => m[1]);
  ok(kacheln.length === 4 && kacheln.every((k) => k.split(/\s+/).includes(`min-h-[${KACHEL_MIN_H}px]`)), 'SW Live Tasten Höhe: jede der vier Kacheln trägt die Reservierung als Klasse (Literal für den Tailwind-Scan)');
}

// ── Aktionen: dieselben Handler wie heute ──
{
  const log: string[] = [];
  const tasten = liveTasten(hauptTasten(basisStand({ canTake: true, canAuto: true })), aktion(log));
  for (const t of tasten) t.onClick?.();
  gleich(log, ['cut', 'auto', 'aufnahme', 'stream'], 'SW Live Tasten: jede Taste ruft ihre Aktion (cut, auto, aufnahme, stream)');
  ok(tasten.every((t) => t.onPress === undefined && t.onRelease === undefined), 'SW Live Tasten: kein Halten (onPress und onRelease unbelegt)');
  const view = ohneKommentare(leseText('src/renderer/src/views/SwitcherView.tsx'));
  ok(
    view.includes('cut: () => engine.cut()') &&
      view.includes('auto: () => engine.auto()') &&
      view.includes('aufnahme: toggleRecording') &&
      view.includes('stream: toggleStreaming'),
    'SW Live Tasten: SwitcherView verdrahtet engine.cut(), engine.auto(), toggleRecording und toggleStreaming (Abläufe unverändert)',
  );
}

// ── Dauer-Feld neben Auto ──
{
  const log: string[] = [];
  const html = leiste({ canTake: true, canAuto: true }, log, 750);
  const auto = html.indexOf('>Auto<');
  const feld = html.indexOf('type="number"');
  const aufnahme = html.indexOf('>Aufnehmen<');
  ok(auto >= 0 && feld > auto && feld < aufnahme, 'SW Live Dauer-Feld neben Auto: das Zahlfeld steht zwischen Auto und Aufnahme');
  const eingabe = tags(html, 'input')[0];
  gleich(
    [attr(eingabe, 'type'), attr(eingabe, 'min'), attr(eingabe, 'step'), attr(eingabe, 'value')],
    ['number', '0', '50', '750'],
    'SW Live Dauer-Feld neben Auto: Zahlfeld mit min 0, Schritt 50 und dem Wert der Überblendung',
  );
  ok(text(html).includes(T.haupttaste.dauer) && text(html).includes(T.haupttaste.ms), 'SW Live Dauer-Feld neben Auto: Beschriftung „Dauer“ und Einheit „ms“');
  ok(attr(eingabe, 'disabled') === undefined, 'SW Live Dauer-Feld neben Auto: auch bei gesperrtem Auto frei einstellbar (wie heute)');
}

// ── Ausgabeleiste: keine LIVE/REC-Anzeige, keine NDI-Quellwahl; Pegel und Mute bleiben ──
{
  const audio = {
    getState: () => ({ hasDevice: true, muted: false, gain: 1, level: 0.1, error: null }),
    subscribe: () => () => undefined,
    setMuted: () => undefined,
    setGain: () => undefined,
  } as unknown as AudioController;
  const bar = (rtmpUrl: string, ndiAktiv: boolean): string =>
    render(
      <OutputBar
        rtmpUrl={rtmpUrl}
        audio={audio}
        ndiState={{ active: ndiAktiv, name: '', connections: 2, error: null }}
        onToggleNdi={() => undefined}
        onOpenMultiview={() => undefined}
        onOpenSettings={() => undefined}
      />,
    );
  const h = bar('rtmp://x/y', true);
  ok(!/●\s*REC|●\s*LIVE|>LIVE<|>REC</.test(h), 'SW Live OutputBar ohne Statusdoppel: keine LIVE/REC-Anzeige in der unteren Leiste (E8, steht im Kopf)');
  ok(
    !h.includes('<select') && !h.includes('<option') && !h.includes('Was als NDI-Quelle ausgegeben wird'),
    'SW Live OutputBar ohne Statusdoppel: keine NDI-Quellwahl mehr (E5, steht im Abschnitt Programm-Format)',
  );
  ok(
    !h.includes('Aufnehmen') && !h.includes('Stream starten') && !h.includes('Aufnahme stoppen'),
    'SW Live OutputBar ohne Statusdoppel: Aufnahme und Stream stehen nur in den Haupttasten',
  );
  enthaelt(h, 'title="Stummschalten"', 'SW Live OutputBar ohne Statusdoppel: Mute des AudioStrip bleibt');
  enthaelt(h, 'title="Pegel"', 'SW Live OutputBar ohne Statusdoppel: Pegel des AudioStrip bleibt');
  ok(text(h).includes('Multiview'), 'SW Live OutputBar ohne Statusdoppel: Multiview-Knopf bleibt');
  enthaelt(h, 'rtmp://x/y', 'SW Live OutputBar ohne Statusdoppel: Ziel-Anzeige bleibt (Nr. 30)');
  enthaelt(bar('', false), 'Stream-Ziel in den Einstellungen festlegen →', 'SW Live OutputBar ohne Statusdoppel: ohne Ziel bleibt der Link in die Einstellungen (Nr. 31)');
  pruefeIdVerweise(h, 'SW Live OutputBar: id-Verweise gültig');
}

// ── Höhe bei Mindestfenster und unteres Panel als Collapsible ──
{
  const quelle = ohneKommentare(leseText('src/renderer/src/views/SwitcherView.tsx'));
  ok(
    quelle.includes('<Collapsible') && quelle.includes('persistId="switcher.unten"'),
    'SW Live Collapsible: das untere Panel (Szenen, Ebenen, Quellen) ist ein Collapsible mit persistId switcher.unten',
  );
  ok(
    quelle.includes('untenStartOffen(window.innerHeight)'),
    'SW Live Collapsible: der Startzustand folgt der Fensterhöhe (untenStartOffen), ein gemerkter Zustand gilt vor ihm',
  );
  gleich(
    [untenStartOffen(UNTEN_OFFEN_AB - 1), untenStartOffen(UNTEN_OFFEN_AB), untenStartOffen(681), untenStartOffen(881)],
    [false, true, false, true],
    'SW Live Collapsible: bei der Mindesthöhe (681 px Inhalt) startet das Panel zu, im Standardfenster (881 px) auf',
  );
}

// ── Keine rohen Farben (Wächter über die geänderten Dateien) ──
{
  const roh =
    /(?:^|[\s"'`:!])(?:bg|text|border|ring|divide|from|via|to|fill|stroke|outline)-(?:neutral|gray|zinc|slate|stone|white|black|green|red|blue|amber|yellow|orange|emerald|lime|sky|indigo|purple|pink|rose|cyan|teal|violet|fuchsia)(?:-\d+)?(?:\/\d+)?(?=[\s"'`])/g;
  // Erlaubt, mit Obergrenze je Fundstelle: Videoflächen und Überlagerungen auf dem Bild sind Daten, keine Oberfläche.
  const erlaubt: Record<string, { max: number; grund: string }> = {
    'bg-black': { max: 4, grund: 'Monitor-Schwarz: Monitor, Multiview-Rahmen, Bildschirm-Kachel, Capture-Vorschau (Videofläche)' },
    'bg-black/80': { max: 1, grund: 'abgedunkelter Hintergrund des Multiview-Overlays (Nr. 87)' },
    'bg-black/50': { max: 3, grund: 'abgedunkelter Hintergrund der drei Auswahl-Dialoge (Nr. 90, 94, 96)' },
    'border-white/40': { max: 1, grund: 'Ebenen-Rahmen auf dem Videobild' },
    'border-white/70': { max: 1, grund: 'Ebenen-Rahmen auf dem Videobild (Hover)' },
    'bg-black/60': { max: 1, grund: 'Beschriftung der Ebene auf dem Videobild' },
    'text-white': { max: 2, grund: 'Schrift auf dem Videobild und auf dem festen Dunkelgrau des Quellen-Kürzels' },
    'border-black': { max: 1, grund: 'Griff der Ebene auf dem Videobild' },
    '!text-black': { max: 1, grund: 'Kürzel IMG auf der Erfolgsfarbe der Quelle' },
  };
  for (const datei of ['SwitcherView', 'LiveBereich']) {
    const quelle = ohneKommentare(leseText(`src/renderer/src/views/${datei}.tsx`));
    const zaehler = new Map<string, number>();
    for (const m of quelle.matchAll(roh)) {
      const k = m[0].trim().replace(/^["'`:]/, '');
      zaehler.set(k, (zaehler.get(k) ?? 0) + 1);
    }
    const zuviel = [...zaehler].filter(([k, n]) => n > (erlaubt[k]?.max ?? 0)).map(([k, n]) => `${k}×${n}`);
    ok(zuviel.length === 0, `SW Live keine rohen Farben: ${datei}.tsx hat keine rohen Farbklassen außerhalb der Erlaubnisliste${zuviel.length ? ` (${zuviel.join(', ')})` : ''}`);
  }
  ok(!/amber/.test(leseText('src/renderer/src/views/SwitcherView.tsx')), 'SW Live keine rohen Farben: amber-500 der Neu-verbinden-Taste ist durch --warning ersetzt');
}

// UX Welle 1, Timer d · Rahmen (Spec 3.1–3.3, 3.8, 5.1; E3, E9, E17, E18): AppShell mit Kopf „JM Timer“, ⚙, ThemeToggle, V-Zeile in
// der Kopfmitte und Speaker-Knopf; Sidebar mit drei Modi; das Panel ist kein Modus; die MessageBar bleibt immer sichtbar; Speaker und
// ?view=remote bleiben unberührt. Render ohne Browser und ohne window (Server-Render über den Anfangszustand des Stores).
import { enthaeltNicht, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { Sidebar } from '@/components/Sidebar';
import { anzeigeModus } from '@/lib/oberflaeche';
import type { Mode } from '@/store/timer';
import { KopfMitte } from '@/views/KopfMitte';
import { TimerOberflaeche } from '@/views/TimerOberflaeche';
import { attr, mitStore, ohneKommentare, statusEintraege, tags, text } from './testzustand';

const nichts = (): void => undefined;
const MODI: Mode[] = ['clock', 'countdown', 'timetable', 'remote', 'settings'];

// ── Kopf: JM Timer, ⚙, ThemeToggle, Statusleiste ──
{
  const html = mitStore({ mode: 'countdown' }, () => render(<TimerOberflaeche />));
  const [zahnrad] = tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
  const [thema] = tags(html, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
  ok(
    text(html).includes('JM Timer') && !html.includes('JM TIMER') && html.includes('data-bereich="inhalt"'),
    'TI Rahmen: AppShell mit Kopf „JM Timer“ (die alte Marke „JM TIMER“ der Sidebar und die alte Kopfzeile sind weg)',
  );
  gleich(
    [attr(thema, 'aria-label'), attr(zahnrad, 'aria-label'), attr(zahnrad, 'aria-expanded')],
    ['Darstellung: Dunkel. Umschalten auf Hell', 'Einstellungen öffnen', 'false'],
    'TI Rahmen: ThemeToggle (E17) und ⚙ „Einstellungen öffnen“ im Kopf, Panel beim Start zu',
  );
  gleich(
    statusEintraege(html),
    [
      ['master-link', 'off', 'Master: unbekannt'],
      ['sync', 'off', 'Sync: unbekannt'],
      ['speaker', 'off', 'Speaker-Fenster: unbekannt'],
      ['fernsteuerung', 'off', 'Fernsteuerung: unbekannt'],
    ],
    'TI Rahmen: Statusleiste vor der ersten Antwort (Master, Sync, Speaker, Fernsteuerung) ist unbekannt, nie ok, auch wenn der Store mit connected=false startet',
  );
  enthaeltNicht(html, 'Sync · Verbunden', 'TI Rahmen: die alten Pillen der Kopfzeile sind in der Statusleiste aufgegangen');
  enthaeltNicht(html, 'data-onair', 'TI Rahmen: kein On-Air im Kopf (E8: Timer hat keins)');
  pruefeIdVerweise(html, 'TI Rahmen: id-Verweise im ganzen Bedienfenster gültig');
}

// ── Kopfmitte: V-Zeile und Speaker-Knopf ──
{
  const faelle = [
    ['gruen', 'ok'],
    ['gelb', 'warn'],
    ['rot', 'error'],
    ['gedaempft', 'off'],
  ] as const;
  const ist = faelle.map(([farbe]) => {
    const html = render(<KopfMitte anzeige={{ text: `V-Zeile ${farbe}`, farbe }} speakerOffen={false} onSpeaker={nichts} />);
    const pille = tags(html, 'span').find((t) => attr(t, 'data-state') !== undefined);
    return [attr(pille, 'data-state'), attr(pille, 'title'), text(html).includes(`V-Zeile ${farbe}`)];
  });
  gleich(
    ist,
    faelle.map(([farbe, zustand]) => [zustand, `V-Zeile ${farbe}`, true]),
    'TI Rahmen: V-Zeile in der Kopfmitte: gruen/gelb/rot/gedaempft → StatusPill ok/warn/error/off mit Text und Tooltip',
  );
  const ohne = render(<KopfMitte anzeige={null} speakerOffen={undefined} onSpeaker={nichts} />);
  ok(!ohne.includes('data-state') && ohne.includes('<button'), 'TI Rahmen: ohne V-Zeile (Einzelplatz, Brücke offen) keine Pille, der Speaker-Knopf bleibt');
  const knopf = (o: boolean | undefined): string => text(render(<KopfMitte anzeige={undefined} speakerOffen={o} onSpeaker={nichts} />));
  gleich([knopf(undefined), knopf(false), knopf(true)], ['Open Speaker', 'Open Speaker', 'Speaker · Open'], 'TI Rahmen: Speaker-Knopf neben der V-Zeile, Beschriftung wie bisher (offen: „Speaker · Open“)');
  const quelle = ohneKommentare(leseText('src/renderer/src/views/KopfMitte.tsx'));
  ok(quelle.includes('onClick={onSpeaker}') && !quelle.includes('window'), 'TI Rahmen: der Speaker-Knopf ruft onSpeaker, KopfMitte liest kein window');
}

// ── TI Sidebar drei Modi ──
{
  const html = mitStore({ mode: 'timetable' }, () => render(<Sidebar />));
  const t = text(html);
  const knoepfe = tags(html, 'button');
  gleich(knoepfe.length, 3, 'TI Sidebar drei Modi: genau drei Einträge');
  ok(['Clock', 'Countdown', 'Timetable'].every((w) => t.includes(w)), 'TI Sidebar drei Modi: Uhr (Clock), Countdown, Ablauf (Timetable) mit den bisherigen Beschriftungen');
  ok(!t.includes('Remote') && !t.includes('Farben') && !t.includes('v0.1.0') && !t.includes('JM TIMER'), 'TI Sidebar drei Modi: kein „Remote“, „Farben“, „v0.1.0“ (E9) und keine zweite Marke');
  gleich(knoepfe.map((k) => attr(k, 'aria-current')), [undefined, undefined, 'page'], 'TI Sidebar drei Modi: der aktive Modus trägt aria-current');
  const fremd = mitStore({ mode: 'remote' }, () => render(<Sidebar />));
  gleich(tags(fremd, 'button').map((k) => attr(k, 'aria-current')), [undefined, 'page', undefined], 'TI Sidebar drei Modi: ein fremder Modus (remote) markiert den Countdown');
}

// ── TI Panel ist kein Modus ──
{
  gleich(
    MODI.map((m) => anzeigeModus(m)),
    ['clock', 'countdown', 'timetable', 'countdown', 'countdown'],
    'TI Panel ist kein Modus: anzeigeModus liefert nur clock|countdown|timetable, remote und settings zeigen den Countdown (kein leerer Bildschirm)',
  );
  const marken = (html: string): string[] => ['clock', 'countdown', 'timetable'].filter((m) => html.includes(`data-timer="modus-${m}"`));
  gleich(
    MODI.map((m) => marken(mitStore({ mode: m }, () => render(<TimerOberflaeche />)))),
    [['clock'], ['countdown'], ['timetable'], ['countdown'], ['countdown']],
    'TI Panel ist kein Modus: je mode genau eine Modus-Ansicht, remote und settings fallen auf den Countdown',
  );
  const offen = mitStore({ mode: 'countdown' }, () => render(<TimerOberflaeche anfangOffen />));
  ok(
    offen.includes('aria-label="Einstellungen"') &&
      offen.includes('data-timer="modus-countdown"') &&
      offen.indexOf('data-timer="modus-countdown"') < offen.indexOf('aria-label="Einstellungen"'),
    'TI Panel ist kein Modus: bei offenem Panel bleibt der Countdown gerendert (Leertaste und R gelten weiter, O1); das Panel steht daneben, nicht an seiner Stelle',
  );
  const zu = mitStore({ mode: 'countdown' }, () => render(<TimerOberflaeche />));
  ok(!zu.includes('aria-label="Einstellungen"'), 'TI Panel ist kein Modus: das Panel ist beim Start zu');
  const ober = ohneKommentare(leseText('src/renderer/src/views/TimerOberflaeche.tsx'));
  const operator = ohneKommentare(leseText('src/renderer/src/views/Operator.tsx'));
  const sidebar = ohneKommentare(leseText('src/renderer/src/components/Sidebar.tsx'));
  const verboten = [ober, operator, sidebar].flatMap((q) => ["'remote'", "'settings'", '<RemoteInfo', '<ColorPicker'].filter((z) => q.includes(z)));
  gleich(verboten, [], 'TI Panel ist kein Modus: Operator, TimerOberflaeche und Sidebar kennen remote/settings nicht als Modus und rendern RemoteInfo/ColorPicker nicht als Ansicht');
  ok(
    ober.includes('settingsOpen={panelOffen}') && ober.includes('useState(anfangOffen)') && !ober.includes('localStorage'),
    'TI Panel ist kein Modus: der Panelzustand ist ein lokaler useState (zu beim Start, nichts gemerkt)',
  );
}

// ── TI MessageBar immer sichtbar ──
{
  const faelle = MODI.flatMap((m) => [false, true].map((p) => [m, p, mitStore({ mode: m }, () => render(<TimerOberflaeche anfangOffen={p} />))] as const));
  const fehlt = faelle.filter(([, , html]) => !html.includes('data-timer="messagebar"') || !text(html).includes('Nachricht')).map(([m, p]) => `${m} ${p ? 'Panel offen' : 'Panel zu'}`);
  gleich(fehlt, [], `TI MessageBar immer sichtbar: in jedem Modus, mit und ohne Panel (${faelle.length} Fälle)`);
  const ober = ohneKommentare(leseText('src/renderer/src/views/TimerOberflaeche.tsx'));
  ok(
    ober.indexOf('<MessageBar') > 0 && ober.indexOf('<MessageBar') < ober.indexOf('<ModusInhalt'),
    'TI MessageBar immer sichtbar: die MessageBar steht im Quelltext über dem Modus-Inhalt, ohne Bedingung',
  );
}

// ── TI Speaker unberührt (E18) ──
{
  const speaker = leseText('src/renderer/src/views/Speaker.tsx');
  const app = ohneKommentare(leseText('src/renderer/src/App.tsx'));
  ok(
    !/@jm\/settings/.test(speaker) && !/AppShell/.test(speaker) && !/views\/(TimerOberflaeche|Operator)/.test(speaker),
    'TI Speaker unberührt: views/Speaker.tsx importiert weder @jm/settings noch AppShell',
  );
  ok(
    app.includes("if (view === 'speaker' || view === 'remote') return <SpeakerView />;") && app.includes("v === 'remote'"),
    'TI Speaker unberührt: ?view=speaker und ?view=remote zeigen weiter die SpeakerView, ohne den neuen Rahmen (E18)',
  );
}

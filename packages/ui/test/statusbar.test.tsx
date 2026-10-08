// Task 8 · StatusPill und StatusBar (Spec 3.3, 7; E14): Symbol und Zustandswort statt nur Farbe, feste Reihenfolge,
// Knopf nur mit Ziel UND Rückruf, Detail nur wenn geliefert, Uhr außerhalb der Status-Region.
import { StatusBar, starteUhr } from '../src/components/StatusBar';
import { StatusPill } from '../src/components/StatusPill';
import {
  LIVE_EINTRAG_KLASSE,
  STATUS_RAND_KLASSE,
  STATUS_SYMBOL,
  STATUS_SYMBOL_KLASSE,
  type StatusItem,
  type StatusState,
} from '../src/lib/status';
import { UI_TEXTE } from '../src/lib/texte';
import { fehlendeIdVerweise, gleich, leseText, ok, pruefeIdVerweise, render } from './harness';
import { attr, hatKlassen, klassen, ohneVersteckt, tags, text, zwischen } from './lib/markup';

const ZUSTAENDE: StatusState[] = ['ok', 'warn', 'error', 'off', 'live'];
/** Feste Uhr: 08.10.2026, 09:05:07 Ortszeit. */
const UHR = (): Date => new Date(2026, 9, 8, 9, 5, 7);
/** Inhalt der role="status"-Region (sie enthält keine weiteren div). */
const region = (html: string): string => {
  const r = zwischen(html, '<div role="status"', '</div>');
  return r.slice(r.indexOf('>') + 1);
};
/** Öffnendes Tag des Eintrags mit dieser id (span oder button). */
const eintrag = (html: string, id: string): string =>
  tags(html, '(?:span|button)').find((t) => attr(t, 'data-status-id') === id) ?? '';
const symbol = (s: StatusState): string =>
  `<span aria-hidden="true" class="${STATUS_SYMBOL_KLASSE[s]}">${STATUS_SYMBOL[s]}</span>`;

// ── StatusPill ──
for (const s of ZUSTAENDE) {
  const html = render(<StatusPill state={s} text="Probe" />);
  const [wurzel] = tags(html, 'span');
  ok(
    attr(wurzel, 'data-state') === s &&
      hatKlassen(wurzel, `border ${STATUS_RAND_KLASSE[s]} ${s === 'live' ? LIVE_EINTRAG_KLASSE : 'text-[var(--foreground)]'}`) &&
      html.includes(symbol(s)) &&
      html.includes(`<span class="sr-only">${UI_TEXTE.zustand[s]}: </span>`) &&
      text(ohneVersteckt(html)) === `${UI_TEXTE.zustand[s]}: Probe`,
    `StatusPill ${s}: Symbol aria-hidden, sr-only-Zustandswort, Text sichtbar, data-state`,
  );
}
{
  const live = render(<StatusPill state="live" text="Programm" />);
  const fehler = render(<StatusPill state="error" text="Programm" />);
  ok(
    STATUS_SYMBOL.live !== STATUS_SYMBOL.error &&
      STATUS_RAND_KLASSE.live !== STATUS_RAND_KLASSE.error &&
      text(ohneVersteckt(live)) !== text(ohneVersteckt(fehler)) &&
      hatKlassen(tags(live, 'span')[0], 'bg-[var(--tally-live)]') &&
      live.includes(`>${UI_TEXTE.live}<`) &&
      !fehler.includes('bg-[var(--tally-live)]') &&
      !fehler.includes(`>${UI_TEXTE.live}<`),
    'StatusPill: live und error unterscheiden sich in Symbol, Rand, Fläche, Kennung „LIVE“ und Zustandswort (Spec 4.2)',
  );
  const mitTitel = render(<StatusPill state="ok" text="kurz" title="ganzer Text" />);
  ok(attr(tags(mitTitel, 'span')[0], 'title') === 'ganzer Text', 'StatusPill: title wird durchgereicht');
}

// ── StatusBar ──
{
  const gemischt: StatusItem[] = [
    { id: 'werkzeug', group: 'tool', label: 'Werkzeug', state: 'ok' },
    { id: 'companion', group: 'fernsteuerung', label: 'Companion', state: 'off' },
    { id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'live' },
    { id: 'master', group: 'verbindung', label: 'Master', state: 'ok' },
    { id: 'iveo', group: 'verbindung', label: 'iveo', state: 'warn' },
  ];
  const html = render(<StatusBar items={gemischt} jetzt={UHR} />);
  gleich(
    tags(html, '(?:span|button)').map((t) => attr(t, 'data-status-id')).filter((x) => x !== undefined),
    ['master', 'iveo', 'ndi', 'companion', 'werkzeug'],
    'StatusBar: Reihenfolge nach Gruppen (verbindung → ausgabe → fernsteuerung → tool, in der Gruppe wie im Array)',
  );
  const [wurzel] = tags(html, 'footer');
  ok(hatKlassen(wurzel, 'h-[var(--statusbar-h)] shrink-0'), 'StatusBar: Höhe h-[var(--statusbar-h)]');
  const [statusDiv] = tags(html, 'div');
  ok(
    attr(statusDiv, 'role') === 'status' && attr(statusDiv, 'aria-live') === 'polite',
    'StatusBar: Einträge in einer role="status"-Region mit aria-live="polite"',
  );
}

// Spec 7.1: vollständiges Kreuzprodukt 5 Zustände × Detail ja/nein × settingsSection ja/nein × onOpenSection ja/nein.
{
  const fehler: string[] = [];
  let faelle = 0;
  for (const s of ZUSTAENDE) {
    for (const detail of [undefined, 'JM Titler (REGIE-PC)']) {
      for (const ziel of [undefined, 'ndi-ausgabe']) {
        for (const mitRueckruf of [false, true]) {
          faelle++;
          const item: StatusItem = {
            id: 'ndi',
            group: 'ausgabe',
            label: 'NDI',
            state: s,
            ...(detail ? { detail } : {}),
            ...(ziel ? { settingsSection: ziel } : {}),
          };
          const html = render(
            <StatusBar items={[item]} jetzt={UHR} onOpenSection={mitRueckruf ? () => undefined : undefined} />,
          );
          const r = region(html);
          const name = `${s}/${detail ? 'Detail' : 'ohne'}/${ziel ? 'Ziel' : 'ohne'}/${mitRueckruf ? 'Rückruf' : 'ohne'}`;
          const knopfSoll = ziel !== undefined && mitRueckruf;
          const knoepfe = tags(r, 'button');
          if (!r.includes(symbol(s))) fehler.push(`${name}: Symbol fehlt`);
          const gelesen = text(ohneVersteckt(r));
          const soll = `${UI_TEXTE.zustand[s]}: NDI${detail ? ` ${detail}` : ''}`;
          if (gelesen !== soll) fehler.push(`${name}: Text „${gelesen}“ statt „${soll}“`);
          if (knoepfe.length !== (knopfSoll ? 1 : 0)) fehler.push(`${name}: ${knoepfe.length} Knopf/Knöpfe`);
          if (knopfSoll && (attr(knoepfe[0], 'type') !== 'button' || attr(knoepfe[0], 'aria-label') !== 'NDI: Einstellungen öffnen')) {
            fehler.push(`${name}: Knopf ohne type=button oder aria-label`);
          }
          if (!knopfSoll && tags(r, 'span').filter((t) => attr(t, 'data-status-id') === 'ndi').length !== 1) {
            fehler.push(`${name}: Anzeige ist kein span`);
          }
          if (attr(eintrag(r, 'ndi'), 'data-state') !== s) fehler.push(`${name}: data-state`);
          if (fehlendeIdVerweise(html).length > 0) fehler.push(`${name}: fehlende ids ${fehlendeIdVerweise(html).join(',')}`);
        }
      }
    }
  }
  ok(faelle === 40 && fehler.length === 0, 'StatusBar Kreuzprodukt: 5 Zustände × Detail × settingsSection × onOpenSection (40 Fälle)');
  for (const f of fehler.slice(0, 6)) console.log(`     ${f}`);
  if (fehler.length > 6) console.log(`     … und ${fehler.length - 6} weitere`);
}

{
  const html = render(
    <StatusBar items={[{ id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'ok', detail: 'JM Titler (REGIE-PC)' }]} jetzt={UHR} />,
  );
  const detailTag = tags(html, 'span').find((t) => hatKlassen(t, 'truncate'));
  ok(
    attr(eintrag(html, 'ndi'), 'title') === 'NDI: JM Titler (REGIE-PC)' &&
      detailTag !== undefined &&
      hatKlassen(detailTag, 'truncate max-[900px]:sr-only select-text'),
    'StatusBar: Detail gekürzt, title = „{label}: {detail}“, unter 900 px max-[900px]:sr-only (vorlesbar), select-text',
  );
  const ohne = render(<StatusBar items={[{ id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'ok' }]} jetzt={UHR} />);
  ok(attr(eintrag(ohne, 'ndi'), 'title') === undefined, 'StatusBar: ohne Detail kein title');
}

{
  const html = render(
    <StatusBar
      items={[{ id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'error', detail: 'Port belegt', settingsSection: 'ndi-ausgabe' }]}
      onOpenSection={() => undefined}
      jetzt={UHR}
    />,
  );
  const [knopf] = tags(html, 'button');
  ok(attr(knopf, 'aria-label') === 'NDI: Einstellungen öffnen', 'StatusBar: Knopf aria-label „{label}: Einstellungen öffnen“');
  const beschreibung = (attr(knopf, 'aria-describedby') ?? '')
    .split(' ')
    .map((id) => text(zwischen(html, `id="${id}"`, '</span>').replace(/^[^>]*>/, '')))
    .join('');
  ok(beschreibung === 'Fehler: Port belegt', 'StatusBar: Knopf beschreibt Zustandswort und Detail per aria-describedby');
  pruefeIdVerweise(html, 'StatusBar: alle id-Verweise des Knopfs gültig');
}

{
  // E14: Hover nur als Unterstreichung. Auf einer Fläche --muted erreichte das ▲ von --status-warn hell nur 2,91 : 1 (Task 4).
  const html = render(
    <StatusBar items={[{ id: 'iveo', group: 'verbindung', label: 'iveo', state: 'warn', settingsSection: 'iveo' }]} onOpenSection={() => undefined} jetzt={UHR} />,
  );
  const [knopf] = tags(html, 'button');
  ok(
    hatKlassen(knopf, 'hover:underline') && !klassen(knopf).some((k) => k.startsWith('hover:bg-')),
    'StatusBar: Hover eines Knopfs nur als Unterstreichung, ohne Fläche (Statussymbol nie auf --muted, E14)',
  );
}

{
  const html = render(<StatusBar items={[{ id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'ok' }]} jetzt={UHR} />);
  const uhr = tags(html, 'span').find((t) => attr(t, 'data-uhr') !== undefined);
  ok(
    html.includes('09:05:07') && !region(html).includes('09:05:07') && uhr !== undefined && hatKlassen(uhr, 'tabular'),
    'StatusBar: Uhr 09:05:07 aus jetzt(), tabular, außerhalb von role=status',
  );
}

{
  const html = render(<StatusBar items={[]} jetzt={UHR} />);
  ok(
    tags(html, 'footer').length === 1 && html.includes('role="status"') && html.includes('09:05:07') &&
      tags(html, 'button').length === 0 && region(html) === '',
    'StatusBar: leere Liste → Leiste mit Uhr (Zustand ohne Sitzung)',
  );
}

{
  const html = render(
    <StatusBar items={[{ id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'live', detail: 'Programm' }]} jetzt={UHR} />,
  );
  const r = region(html);
  ok(
    hatKlassen(eintrag(html, 'ndi'), `${STATUS_RAND_KLASSE.live} ${LIVE_EINTRAG_KLASSE}`) &&
      !hatKlassen(eintrag(html, 'ndi'), 'text-[var(--foreground)]') &&
      r.includes(symbol('live')) &&
      r.includes(`<span aria-hidden="true" class="font-extrabold tracking-[0.08em]">${UI_TEXTE.live}</span>`) &&
      !r.includes('text-[var(--muted-foreground)]') &&
      !r.includes('text-[var(--brand-fg-on-dark)]'),
    'StatusBar: live-Eintrag rot gefüllt mit ■ und sichtbarem „LIVE“, Schrift und Detail in Hintergrundfarbe (Spec 3.3, 4.2; E14)',
  );
  const fehler = render(
    <StatusBar items={[{ id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'error', detail: 'Port belegt' }]} jetzt={UHR} />,
  );
  ok(
    hatKlassen(eintrag(fehler, 'ndi'), `${STATUS_RAND_KLASSE.error} text-[var(--foreground)]`) &&
      !region(fehler).includes('bg-[var(--tally-live)]') &&
      !region(fehler).includes(`>${UI_TEXTE.live}<`),
    'StatusBar: error-Eintrag nur rot umrandet, ohne Fläche und ohne „LIVE“ (Form statt nur Farbton)',
  );
}

{
  const gemeldet: string[] = [];
  const geplant: Array<{ f: () => void; ms: number }> = [];
  let angehalten: unknown;
  let t = new Date(2026, 9, 8, 9, 5, 7, 300);
  const anhalten = starteUhr(() => t, (u) => void gemeldet.push(u), {
    setTimeout: (f, ms) => {
      geplant.push({ f, ms });
      return geplant.length;
    },
    clearTimeout: (id) => {
      angehalten = id;
    },
  });
  t = new Date(2026, 9, 8, 9, 5, 8, 4);
  geplant[0]?.f();
  anhalten();
  gleich(
    [geplant.map((g) => g.ms), gemeldet, angehalten],
    [[700, 996], ['09:05:08'], 2],
    'StatusBar Uhr: tickt kurz nach der vollen Sekunde (700 ms nach 09:05:07,300), meldet hh:mm:ss aus jetzt() und plant neu; Aufräumen hält den letzten Takt an',
  );
  ok(
    leseText('src/components/StatusBar.tsx').split('useEffect(() => starteUhr(() => jetztRef.current(), setUhr), []);').length === 2,
    'StatusBar Verdrahtung: die Uhr läuft über starteUhr im Effekt (genau einmal)',
  );
}

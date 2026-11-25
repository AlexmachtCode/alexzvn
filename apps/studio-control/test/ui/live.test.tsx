// UX Welle 2b, Studio-Control d2 · Haupttasten und Halten (B16, B1, B3, B6; Muster d „Live-Bereich“): je Panel die Hauptreihe
// in heutiger Reihenfolge und Zeile, jede Taste ein TallyButton im Behälter mit der alten Mindestbreite; Blackout ohne Recht
// gesperrt mit Grund statt weg; TriCaster-Hinweis unter der Reihe, REC/STREAM nie live; PTZ hält über den Halte-Knopf aus @jm/ui.
// Render ohne Browser über die Wurzel-View (echte Verdrahtung des Stands), Rückrufe als reine Funktionen ohne DOM.
import { HalteKnopf } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { PTZ_STOP, type PtzAction } from '@shared/ptz';
import { STUDIO_TEXTE, atemTasten, type OberflaechenStand } from '@/lib/oberflaeche';
import * as atem from '@/components/video/AtemPanel';
import * as licht from '@/components/lighting/LichtPanel';
import * as obs from '@/components/video/ObsPanel';
import * as ptz from '@/components/video/PtzPanel';
import * as tricaster from '@/components/video/TricasterPanel';
import * as oberflaeche from '@/views/StudioOberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { alleVideo, angemeldeterStand, attr, bereich, geraetImStore, halteKnoepfe, ohneKommentare, oberflaecheHtml, tags, tallyTasten, text } from './testzustand';

const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const T = STUDIO_TEXTE.taste;
const ROLLE_GRUND = STUDIO_TEXTE.grund.rolle('viewer');

/** Die Wurzel-View gerendert (ohne Abbruch: ein Wurf zählt als FAIL, der Lauf geht weiter). */
function html(o: Parameters<typeof oberflaecheHtml>[1], name: string): string {
  try {
    const W = oberflaeche.StudioOberflaeche;
    if (typeof W !== 'function') throw new Error('StudioOberflaeche fehlt');
    return oberflaecheHtml(W, o, render);
  } catch (e) {
    ok(false, `${name}: Render ohne Wurf (${String(e).split(String.fromCharCode(10))[0]})`);
    return '';
  }
}
const panel = (h: string, p: string): string => bereich(h, 'data-panel', p);
const reihe = (h: string, p: string): string => bereich(h, 'data-studio', `hauptreihe-${p}`);
const LICHT_NODE = { lighting: { node: { host: '192.0.2.40', fps: 40 }, fixtures: [] }, blackout: false };
const LICHT_OHNE_NODE = { lighting: { node: null, fixtures: [] }, blackout: false };
/** Stand für die reinen Reihen-Funktionen: Bediener, Server verbunden, je Typ eine verbundene Instanz g1. */
const verbunden = (extra: Record<string, unknown> = {}): OberflaechenStand =>
  angemeldeterStand({ benutzer: { name: 'Bob', rolle: 'operator' }, atem: { ids: ['g1'], status: { g1: { state: 'connected', ...extra } } }, tricaster: { ids: ['g1'], status: { g1: { state: 'connected' } } }, obs: { ids: ['g1'], status: { g1: { state: 'connected', ...extra } } } });

// ── SC Reihenfolge je Panel: Hauptreihen nach B16, je Taste ein TallyButton im Behälter mit der alten Breite seines Panels ──
{
  const h = html({ store: alleVideo() }, 'SC Reihenfolge je Panel');
  const SOLL: Array<[string, string[], string]> = [
    ['atem', [T.cut, T.auto, T.ftb, T.rec, T.stream], 'min-w-[110px]'],
    ['tricaster', [T.take, T.auto, T.fadeBlack, T.rec, T.stream], 'min-w-[120px]'],
    ['obs', [T.aufnahme, T.stream], 'min-w-[120px]'],
  ];
  for (const [p, labels, breite] of SOLL) {
    const r = reihe(h, p);
    const tasten = tallyTasten(r);
    gleich(tasten.map((t) => t.label), labels, `SC Reihenfolge je Panel: ${p} – Reihe ${labels.join(', ')} in heutiger Reihenfolge`);
    gleich(tasten.map((t) => t.huelle), labels.map(() => breite), `SC Reihenfolge je Panel: ${p} – jede Taste ein TallyButton im Behälter ${breite} (alte Mindestbreite)`);
    ok(r !== '' && (r.match(/<button/g) ?? []).length === labels.length && tasten.every((t) => t.state === 'bereit'), `SC Reihenfolge je Panel: ${p} – die Reihe enthält nur die Haupttasten, verbunden und Admin alle bereit`);
  }
  // Heutige Zeile auch gesperrt: Der Grund bricht innerhalb der Tastenbreite um (Breite = Beschriftung, wie bisher). Sonst wird
  // jede gesperrte Taste so breit wie ihr Grund, die Reihe bricht um und spätere Tasten rücken auf alte Plätze ihrer Nachbarn
  // (gemessen in Variante A, Task 18: TriCaster-STREAM in der zweiten Zeile).
  for (const p of ['atem', 'tricaster', 'obs']) {
    const kl = attr(tags(reihe(h, p), 'div')[0], 'class') ?? '';
    ok(kl.includes('flex-wrap') && kl.includes('[&_button>span[id]]:w-0') && kl.includes('[&_button>span[id]]:min-w-full'), `SC Reihenfolge je Panel: ${p} – der Sperrgrund bricht in der alten Breite um, die Reihe bleibt eine Zeile`);
  }
  const zu = reihe(html({ store: alleVideo({ atem: { state: 'down' } }) }, 'SC Reihenfolge je Panel'), 'atem');
  ok(/<button[^>]*data-state="gesperrt"[^>]*>[\s\S]*?<\/span><span id="[^"]+"/.test(zu), 'SC Reihenfolge je Panel: der Grund steht als span mit id direkt im TallyButton (Ziel der Umbruch-Regel; Wächter gegen ein anderes Markup des Bausteins)');
  const a = panel(h, 'atem');
  const i = (s: string, t: string): number => s.indexOf(t);
  ok(i(a, '>Program<') > 0 && i(a, '>Program<') < i(a, '>Preview<') && i(a, '>Preview<') < i(a, 'hauptreihe-atem') && i(a, 'hauptreihe-atem') < i(a, 'Weitere Instanz'), 'SC Reihenfolge je Panel: ATEM – Reihe unter den Bussen Program und Preview, vor „Weitere Instanz“ (heutige Zeile)');
  const t = panel(h, 'tricaster');
  ok(i(t, 'hauptreihe-tricaster') > 0 && i(t, 'hauptreihe-tricaster') < i(t, 'PGM Vorschau') && i(t, 'PGM Vorschau') < i(t, 'DSK'), 'SC Reihenfolge je Panel: TriCaster – Reihe links neben der PGM-Vorschau, vor DSK (heutige Zeile)');
  const o = panel(h, 'obs');
  ok(i(o, '>Szenen<') > 0 && i(o, '>Szenen<') < i(o, 'hauptreihe-obs') && i(o, 'hauptreihe-obs') < i(o, 'Weitere Instanz'), 'SC Reihenfolge je Panel: OBS – Reihe unter den Szenen, vor „Weitere Instanz“ (heutige Zeile)');
  const l = panel(html({ abschnitt: 'licht', store: LICHT_NODE }, 'SC Reihenfolge je Panel'), 'licht');
  gleich(tallyTasten(reihe(l, 'licht')).map((x) => [x.label, x.huelle]), [[T.blackout, 'min-w-[110px]']], 'SC Reihenfolge je Panel: Licht – Blackout als TallyButton im Behälter min-w-[110px] (heute size sm)');
  ok(i(l, 'data-state="ok"') > 0 && i(l, 'data-state="ok"') < i(l, 'hauptreihe-licht') && i(l, 'hauptreihe-licht') < i(l, 'Art-Net Node'), 'SC Reihenfolge je Panel: Licht – Blackout im Kopf rechts nach der Pille, vor der Node-Zeile (heutige Zeile)');
  pruefeIdVerweise(h, 'SC Reihenfolge je Panel: id-Verweise gültig');
  ok(!text(h).includes('"'), 'SC Reihenfolge je Panel: kein ASCII-Anführungszeichen in den Texten');
}
{
  // Rückrufe ohne DOM: jede Taste löst genau ihren alten Befehl aus (nichts vertauscht, FTB nicht auf STREAM).
  const log: unknown[] = [];
  const reiheA = atem.atemReihe?.(verbunden(), 'g1', { id: 'g1', state: 'connected', lastChecked: 1 }, (c) => void log.push(c)) ?? [];
  reiheA.forEach((p) => p.onClick?.());
  gleich(log, [{ type: 'cut' }, { type: 'auto' }, { type: 'ftb' }, { type: 'record', on: true }, { type: 'stream', on: true }], 'SC Reihenfolge je Panel: ATEM Cut, Auto, FTB, REC (an), STREAM (an) lösen ihre heutigen Befehle aus');
  const log2: unknown[] = [];
  (atem.atemReihe?.(verbunden({ recording: true, streaming: true }), 'g1', { id: 'g1', state: 'connected', lastChecked: 1, recording: true, streaming: true }, (c) => void log2.push(c)) ?? []).slice(3).forEach((p) => p.onClick?.());
  gleich(log2, [{ type: 'record', on: false }, { type: 'stream', on: false }], 'SC Reihenfolge je Panel: ATEM REC und STREAM bei laufender Sendung schalten aus (on: false wie heute)');
  const log3: string[] = [];
  (tricaster.tricasterReihe?.(verbunden(), 'g1', (s) => void log3.push(s)) ?? []).forEach((p) => p.onClick?.());
  gleich(log3, ['main_take', 'main_auto', 'main_fade_to_black', 'record_toggle_start', 'streaming_toggle_start'], 'SC Reihenfolge je Panel: TriCaster Take, Auto, Fade Black, REC, STREAM senden ihre heutigen Kürzel');
  const log4: unknown[] = [];
  (obs.obsReihe?.(verbunden(), 'g1', (c) => void log4.push(c)) ?? []).forEach((p) => p.onClick?.());
  gleich(log4, [{ type: 'record' }, { type: 'stream' }], 'SC Reihenfolge je Panel: OBS Aufnahme und Stream senden record und stream wie heute');
  const log5: boolean[] = [];
  licht.blackoutTaste?.(angemeldeterStand({ licht: { node: true, blackout: false } }), (on) => void log5.push(on))?.onClick?.();
  licht.blackoutTaste?.(angemeldeterStand({ licht: { node: true, blackout: true } }), (on) => void log5.push(on))?.onClick?.();
  gleich(log5, [true, false], 'SC Reihenfolge je Panel: Blackout schaltet an, „Blackout aus“ schaltet aus (on: !blackout wie heute)');
  gleich(
    (atem.atemReihe?.(verbunden(), 'g1', undefined, () => undefined) ?? []).map((p) => [p.label, p.state]),
    atemTasten(verbunden(), 'g1').map((t) => [t.label, t.state]),
    'SC Reihenfolge je Panel: die Reihe zeigt genau die Ableitung atemTasten (eine Wahrheit)',
  );
}
{
  // Zustände der Reihe im Fenster: live bei gemessener Sendung, gesperrt mit sichtbarem Grund.
  const rec = tallyTasten(reihe(html({ store: alleVideo({ atem: { recording: true } }) }, 'SC Reihenfolge je Panel'), 'atem'));
  gleich(rec.map((t) => t.state), ['bereit', 'bereit', 'bereit', 'live', 'bereit'], 'SC Reihenfolge je Panel: ATEM nimmt auf → REC live, die übrigen bereit');
  const weg = tallyTasten(reihe(html({ store: alleVideo({ atem: { state: 'down', lastError: 'Zeitüberschreitung' } }) }, 'SC Reihenfolge je Panel'), 'atem'));
  ok(weg.length === 5 && weg.every((t) => t.state === 'gesperrt' && t.gesperrt && t.grund === STUDIO_TEXTE.grund.nichtVerbunden('ATEM')), 'SC Reihenfolge je Panel: ATEM getrennt → alle gesperrt, Grund „ATEM nicht verbunden“ sichtbar');
  const gast = tallyTasten(reihe(html({ rolle: 'viewer', store: alleVideo({ atem: { recording: true } }) }, 'SC Reihenfolge je Panel'), 'atem'));
  ok(
    gast[3]?.state === 'live' && gast[3].gesperrt && gast[3].grund === `Gesperrt: ${ROLLE_GRUND}` && gast.filter((_, n) => n !== 3).every((t) => t.state === 'gesperrt' && t.grund === ROLLE_GRUND),
    'SC Reihenfolge je Panel: Betrachter – REC live und gesperrt (O2), die übrigen gesperrt mit dem Rollen-Grund',
  );
  const quellen = ['components/video/AtemPanel.tsx', 'components/video/TricasterPanel.tsx', 'components/video/ObsPanel.tsx', 'components/lighting/LichtPanel.tsx'];
  gleich(quellen.filter((d) => !/<TallyButton\b/.test(QUELLE(d)) || /size="lg"/.test(QUELLE(d))), [], 'SC Reihenfolge je Panel: die Panels zeichnen die Haupttasten als TallyButton, kein Button size lg mehr');
}

// ── SC Licht ohne Recht: Blackout für viewer sichtbar und gesperrt mit Rollen-Grund; ohne Node wie heute nicht da ──
{
  const gast = tallyTasten(reihe(html({ rolle: 'viewer', abschnitt: 'licht', store: LICHT_NODE }, 'SC Licht ohne Recht'), 'licht'));
  ok(gast.length === 1 && gast[0]!.label === T.blackout && gast[0]!.state === 'gesperrt' && gast[0]!.gesperrt && gast[0]!.grund === ROLLE_GRUND && gast[0]!.title === ROLLE_GRUND, 'SC Licht ohne Recht: Betrachter sieht Blackout, gesperrt mit „Rolle Betrachter darf nicht schalten“ (sichtbar und als title)');
  for (const rolle of ['viewer', 'admin'] as const) {
    const h = html({ rolle, abschnitt: 'licht', store: LICHT_OHNE_NODE }, 'SC Licht ohne Recht');
    ok(h !== '' && reihe(h, 'licht') === '' && !text(panel(h, 'licht')).includes(T.blackout), `SC Licht ohne Recht: ohne Node kein Blackout (${rolle}, wie heute)`);
  }
  const an = tallyTasten(reihe(html({ rolle: 'operator', abschnitt: 'licht', store: { ...LICHT_NODE, blackout: true } }, 'SC Licht ohne Recht'), 'licht'));
  gleich(an.map((t) => [t.label, t.state]), [[T.blackoutAus, 'bereit']], 'SC Licht ohne Recht: Blackout an → „Blackout aus“, bereit, nie live (B6)');
  const frei = tallyTasten(reihe(html({ rolle: 'operator', abschnitt: 'licht', store: LICHT_NODE }, 'SC Licht ohne Recht'), 'licht'));
  gleich(frei.map((t) => [t.label, t.state]), [[T.blackout, 'bereit']], 'SC Licht ohne Recht: Bediener mit Node → Blackout bereit');
}

// ── SC TriCaster ohne Rückmeldung: Hinweis unter der Reihe; REC/STREAM nie live ──
{
  const h = panel(html({ store: alleVideo() }, 'SC TriCaster ohne Rückmeldung'), 'tricaster');
  const hinweis = bereich(h, 'data-studio', 'tricaster-hinweis');
  ok(text(hinweis).trim() === T.tricasterHinweis, 'SC TriCaster ohne Rückmeldung: Hinweis „REC und STREAM ohne Rückmeldung“ steht im TriCaster-Panel');
  const r = reihe(h, 'tricaster');
  const ende = r === '' ? Infinity : h.indexOf(r) + r.length;
  ok(h.indexOf('tricaster-hinweis') > ende && h.indexOf('tricaster-hinweis') < h.indexOf('PGM Vorschau'), 'SC TriCaster ohne Rückmeldung: der Hinweis steht direkt unter der Reihe (nach ihr, vor der PGM-Vorschau)');
  // Der Hinweis braucht keine eigene Höhe: Die Zelle von Reihe und Hinweis gibt sie mit -mb-6 an den Rasterabstand gap-6 zurück.
  // Gemessen ohne das (Task 18, 1024×640, einspaltiges Raster): alles darunter 24 px tiefer, die ATEM-Program-Busse lagen auf
  // den alten Preview-Plätzen.
  const raster = /<div class="([^"]*grid-cols-1[^"]*)">\s*<div class="([^"]*)"><div data-studio="hauptreihe-tricaster"/.exec(h);
  ok(raster !== null && /\bgap-6\b/.test(raster[1]!) && /(?:^|\s)-mb-6(?:\s|$)/.test(raster[2]!), 'SC TriCaster ohne Rückmeldung: der Hinweis liegt im Rasterabstand (Zelle -mb-6 bei gap-6), nichts darunter rutscht tiefer');
  const hTag = tags(hinweis, 'p')[0] ?? '';
  ok(hTag !== '' && !/\b(?:fixed|sticky|absolute)\b/.test(attr(hTag, 'class') ?? '') && !reihe(h, 'tricaster').includes('tricaster-hinweis'), 'SC TriCaster ohne Rückmeldung: der Hinweis ist ein Absatz im Fluss (nicht fixed/sticky/absolute), nicht in einer Taste');
  pruefeFaelle(
    'SC TriCaster ohne Rückmeldung: REC und STREAM nie live (Zustand × Rolle × gemeldete Flags)',
    kreuz({ state: ['connected', 'polling', 'down'] as const, rolle: ['operator', 'viewer'] as const, flag: [false, true] }),
    (f) => {
      const r = tallyTasten(reihe(html({ rolle: f.rolle, store: alleVideo({ tricaster: { state: f.state, recording: f.flag, streaming: f.flag } }) }, 'SC TriCaster ohne Rückmeldung'), 'tricaster'));
      return vergleiche(String(r.length === 5 && r.every((t) => t.state !== 'live')), 'true');
    },
  );
  const gesperrt = tallyTasten(reihe(html({ store: alleVideo({ tricaster: { state: 'down', lastError: 'Zeitüberschreitung' } }) }, 'SC TriCaster ohne Rückmeldung'), 'tricaster'));
  ok(gesperrt.length === 5 && gesperrt.every((t) => t.state === 'gesperrt' && t.grund === STUDIO_TEXTE.grund.nichtVerbunden('TriCaster')), 'SC TriCaster ohne Rückmeldung: getrennt gesperrt mit „TriCaster nicht verbunden“; der Hinweis ist kein Sperrgrund');
}

// ── SC PTZ hält über den Baustein: HalteKnopf aus @jm/ui, kein lokaler HoldButton; h-12, Beschriftung, aktiv, gesperrt ──
{
  const q = QUELLE('components/video/PtzPanel.tsx');
  ok(/import \{[^}]*\bHalteKnopf\b[^}]*\} from '@jm\/ui'/.test(q) && /<HalteKnopf\b/.test(q), 'SC PTZ hält über den Baustein: PtzPanel nutzt HalteKnopf aus @jm/ui');
  ok(!/HoldButton/.test(q) && !/onPointerDown|setPointerCapture|onLostPointerCapture/.test(q), 'SC PTZ hält über den Baustein: kein lokaler HoldButton, keine eigene Zeiger-Verdrahtung mehr');
  const mag = 25;
  const liste = ptz.ptzHalteTasten?.(mag) ?? [];
  gleich(liste.map((t) => t.label), ['↖', '↑', '↗', '←', '→', '↙', '↓', '↘', 'Wide −', 'Tele +', 'Nah', 'Fern'], 'SC PTZ hält über den Baustein: die zwölf Halte-Tasten mit der heutigen Beschriftung (Pfeile aus d.label, Wide −, Tele +, Nah, Fern)');
  const z = (a: PtzAction): string => JSON.stringify(a);
  gleich(
    liste.map((t) => `${z(t.down)}|${z(t.up)}`),
    [
      ...[[-1, 1], [0, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1]].map(([p, t]) => `${z({ kind: 'pan-tilt', pan: p! * mag, tilt: t! * mag })}|${z(PTZ_STOP)}`),
      `${z({ kind: 'zoom', speed: -mag })}|${z({ kind: 'zoom', speed: 0 })}`,
      `${z({ kind: 'zoom', speed: mag })}|${z({ kind: 'zoom', speed: 0 })}`,
      `${z({ kind: 'focus', speed: -mag })}|${z({ kind: 'focus', speed: 0 })}`,
      `${z({ kind: 'focus', speed: mag })}|${z({ kind: 'focus', speed: 0 })}`,
    ],
    'SC PTZ hält über den Baustein: Drücken und Loslassen senden die heutigen Befehle (Fahrt × Tempo, Stopp; Zoom/Fokus ±Tempo, 0)',
  );
  // Fehlt die Liste (ROT-Lauf), stehen Platzhalter da, damit der Lauf alle Prüfungen erreicht.
  const t0 = liste[1] ?? { key: 'fehlt', label: '', down: PTZ_STOP, up: PTZ_STOP };
  const t1 = liste[0] ?? t0;
  const log: string[] = [];
  const a = { halten: (t: { key: string }) => void log.push(`halten:${t.key}`), loslassen: (t: { key: string }) => void log.push(`los:${t.key}`) };
  const ruhig = ptz.halteTaste?.(t0, { gehalten: null, grund: undefined }, a);
  const gehalten = ptz.halteTaste?.(t0, { gehalten: t0.key, grund: undefined }, a);
  const anderer = ptz.halteTaste?.(t0, { gehalten: t1.key, grund: undefined }, a);
  const zu = ptz.halteTaste?.(t0, { gehalten: null, grund: 'PTZ nicht verbunden' }, a);
  ok(
    ruhig !== undefined && /(?:^|\s)h-12(?:\s|$)/.test(ruhig.className ?? '') && ruhig.label === '↑' && ruhig.title === '↑' && ruhig.aktiv === false && ruhig.gesperrt === undefined,
    'SC PTZ hält über den Baustein: className mit h-12 (48 px wie heute), label und title = heutige Beschriftung, ruhig nicht aktiv, frei ohne Grund',
  );
  ok(gehalten?.aktiv === true && anderer?.aktiv === false, 'SC PTZ hält über den Baustein: aktiv = gehalten (nur die gehaltene Taste)');
  ok(zu?.gesperrt === 'PTZ nicht verbunden', 'SC PTZ hält über den Baustein: gesperrt = der Grund aus sperrgrund');
  ruhig?.onPress();
  ruhig?.onRelease();
  gleich(log, [`halten:${t0.key}`, `los:${t0.key}`], 'SC PTZ hält über den Baustein: onPress hält, onRelease lässt los (je die eigene Taste)');
  // Halten und Loslassen im Panel: senden down bzw. up und führen den gehaltenen Zustand.
  const gesendet: PtzAction[] = [];
  let g: string | null = null;
  const h = ptz.ptzHalten?.((x) => void gesendet.push(x), (f) => (g = f(g)));
  h?.halten(t0);
  const beimHalten = g;
  h?.loslassen(t1);
  const fremdLos = g;
  h?.loslassen(t0);
  gleich([gesendet, beimHalten, fremdLos, g], [[t0.down, t1.up, t0.up], t0.key, t0.key, null], 'SC PTZ hält über den Baustein: Halten sendet down und merkt die Taste, Loslassen sendet up und gibt nur die eigene frei');
  ok(gehalten !== undefined && render(<HalteKnopf {...gehalten} />).includes('aria-pressed="true"'), 'SC PTZ hält über den Baustein: der gehaltene Knopf zeigt aria-pressed (aktiv)');
  // Im Fenster: zwölf Halte-Knöpfe mit h-12; Betrachter und getrennt gesperrt mit Grund (title „Gesperrt: …“).
  const knoepfe = (o: Parameters<typeof oberflaecheHtml>[1]): Array<{ tag: string; label: string }> => halteKnoepfe(panel(html(o, 'SC PTZ hält über den Baustein'), 'ptz'));
  const frei = knoepfe({ store: alleVideo() });
  ok(
    frei.length === 12 && frei.every((k) => /\bh-12\b/.test(attr(k.tag, 'class') ?? '') && attr(k.tag, 'aria-label') === k.label && attr(k.tag, 'title') === k.label && attr(k.tag, 'aria-pressed') === 'false' && attr(k.tag, 'aria-disabled') === undefined),
    'SC PTZ hält über den Baustein: im Panel zwölf Halte-Knöpfe, je h-12, aria-label und title = Beschriftung, ruhig und frei',
  );
  const gast = knoepfe({ rolle: 'viewer', store: alleVideo() });
  ok(gast.length === 12 && gast.every((k) => attr(k.tag, 'aria-disabled') === 'true' && attr(k.tag, 'title') === `Gesperrt: ${ROLLE_GRUND}`), 'SC PTZ hält über den Baustein: Betrachter – alle gesperrt mit dem Rollen-Grund');
  const weg = knoepfe({ store: alleVideo({ ptz: { state: 'down', lastError: 'Zeitüberschreitung' } }) });
  ok(weg.length === 12 && weg.every((k) => attr(k.tag, 'title') === `Gesperrt: ${STUDIO_TEXTE.grund.nichtVerbunden('PTZ')}`), 'SC PTZ hält über den Baustein: getrennt – alle gesperrt mit „PTZ nicht verbunden“');
  const ohne = knoepfe({ store: { ...geraetImStore('ptz') } });
  ok(ohne.length === 12 && ohne.every((k) => attr(k.tag, 'title') === `Gesperrt: ${STUDIO_TEXTE.grund.geraetUnbekannt('PTZ')}`), 'SC PTZ hält über den Baustein: ohne Status-Ereignis – gesperrt mit „PTZ unbekannt“');
  ok(!/keydown|keyup|addEventListener|accelerator/i.test(q), 'SC PTZ hält über den Baustein: keine neuen Kürzel (Halten per Leertaste/Enter bringt der Baustein, B1)');
}

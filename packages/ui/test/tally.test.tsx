// Task 9 · TallyButton (Spec 3.4, 4.2; E3, E9, Review Focus 2/5): bereit/live/gesperrt mit Form und Text,
// Halten mit Zeiger und Taste – onRelease genau einmal je Druck, auch bei Abbruch. Geprüft wird das Prop-Objekt, das
// der Baustein per Spread an den <button> hängt, dazu die Effekt-Körper und die Verdrahtung im Quelltext.
import {
  TallyButton,
  haltenBeiAbbau,
  haltenBeiZustand,
  haltenFuerRender,
  tallyKnopfProps,
  type TallyButtonProps,
  type ZeigerEreignisArt,
} from '../src/components/TallyButton';
import { erzeugeHalten, type HaltenSteuerung } from '../src/lib/halten';
import { LIVE_FLAECHE_KLASSE } from '../src/lib/status';
import { UI_TEXTE } from '../src/lib/texte';
import { gleich, leseText, ok, pruefeIdVerweise, render } from './harness';
import { attr, hatKlassen, tags, text, zwischen } from './lib/markup';

/** Text des Elements mit dieser id (öffnendes Tag beginnt mit id="…"; Inhalt ohne weitere Elemente). */
const textVonId = (html: string, id: string): string =>
  text(zwischen(html, `id="${id}"`, '</span>').replace(/^[^>]*>/, ''));

// ── Darstellung ──
{
  const html = render(<TallyButton state="bereit" label="Take" />);
  const [knopf] = tags(html, 'button');
  ok(
    attr(knopf, 'data-state') === 'bereit' &&
      hatKlassen(knopf, 'border-[var(--tally-ready)] bg-[var(--card)] text-[var(--foreground)]') &&
      !html.includes(`>${UI_TEXTE.live}<`) &&
      !html.includes('bg-[var(--tally-live)]') &&
      attr(knopf, 'aria-disabled') === undefined,
    'Tally bereit: neutrale Fläche, Rand border-[var(--tally-ready)], kein „LIVE“',
  );
  ok(
    attr(knopf, 'type') === 'button' && hatKlassen(knopf, 'min-h-[var(--control-h-lg)] w-full'),
    'Tally: type=button, min-h-[var(--control-h-lg)], w-full',
  );
}
{
  const html = render(<TallyButton state="live" label="Take" shortcut="F1" />);
  const [knopf] = tags(html, 'button');
  ok(
    hatKlassen(knopf, LIVE_FLAECHE_KLASSE) && html.includes(`>${UI_TEXTE.live}<`) && text(html).includes('Take'),
    'Tally live: LIVE_FLAECHE_KLASSE, Kennung „LIVE“, Label sichtbar',
  );
  ok(
    !/text-\[\d+px\]|text-xs|text-sm/.test(html.replace(LIVE_FLAECHE_KLASSE, '')),
    'Tally live: keine kleinere Schrift auf der LIVE-Fläche (E3: nur große Schrift, auch das Kürzel)',
  );
}
{
  const html = render(
    <TallyButton state="gesperrt" label="Take" disabledReason="Kein Signal am Eingang" onClick={() => undefined} />,
  );
  const [knopf] = tags(html, 'button');
  ok(
    attr(knopf, 'aria-disabled') === 'true' &&
      attr(knopf, 'disabled') === undefined &&
      attr(knopf, 'title') === 'Kein Signal am Eingang' &&
      textVonId(html, attr(knopf, 'aria-describedby') ?? '-') === 'Kein Signal am Eingang',
    'Tally gesperrt: aria-disabled=true (bleibt fokussierbar), Grund sichtbar, title = Grund, aria-describedby zeigt auf den Grund',
  );
  pruefeIdVerweise(html, 'Tally gesperrt: alle id-Verweise gültig');
}
{
  const html = render(<TallyButton state="gesperrt" label="Take" />);
  ok(
    text(html).includes(UI_TEXTE.gesperrtOhneGrund) && attr(tags(html, 'button')[0], 'title') === UI_TEXTE.gesperrtOhneGrund,
    'Tally gesperrt ohne Grund: „gesperrt – kein Grund angegeben“',
  );
  const leer = render(<TallyButton state="gesperrt" label="Take" disabledReason="" />);
  ok(
    text(leer).includes(UI_TEXTE.gesperrtOhneGrund) && attr(tags(leer, 'button')[0], 'title') === UI_TEXTE.gesperrtOhneGrund,
    'Tally gesperrt mit leerem Grund: ebenfalls „gesperrt – kein Grund angegeben“ (gesperrt nie ohne Grund)',
  );
}
{
  const mit = render(<TallyButton state="bereit" label="Take" shortcut="F1" />);
  ok(
    tags(mit, 'kbd').length === 1 && text(zwischen(mit, '<kbd', '</kbd>').replace(/^[^>]*>/, '')) === 'Kürzel: F1',
    'Tally: shortcut als <kbd> mit sr-only „Kürzel“',
  );
  ok(tags(render(<TallyButton state="bereit" label="Take" />), 'kbd').length === 0, 'Tally: ohne shortcut kein <kbd>');
}

// ── Knopf-Props: genau die acht Handler hängen am <button> (Spread im Baustein) ──
{
  const props = tallyKnopfProps({ state: 'bereit', label: 'Talk' }, erzeugeHalten({}), 'g');
  gleich(
    Object.keys(props).filter((k) => /^on[A-Z]/.test(k)).sort(),
    ['onBlur', 'onClick', 'onKeyDown', 'onKeyUp', 'onLostPointerCapture', 'onPointerCancel', 'onPointerDown', 'onPointerUp'],
    'Tally Knopf-Props: genau die acht Ereignis-Handler',
  );
}

// ── Halten über die Knopf-Props (mit der echten Halten-Logik aus Task 6) ──
function aufbau(teil: Partial<TallyButtonProps> = {}) {
  const z = { click: 0, press: 0, release: 0 };
  const props: TallyButtonProps = {
    state: 'bereit',
    label: 'Talk',
    onClick: () => {
      z.click++;
    },
    onPress: () => {
      z.press++;
    },
    onRelease: () => {
      z.release++;
    },
    ...teil,
  };
  const halten = erzeugeHalten(props);
  return { z, halten, h: tallyKnopfProps(props, halten, 'grund') };
}
let gefangen: number[] = [];
const ziel: ZeigerEreignisArt['currentTarget'] = { setPointerCapture: (id) => void gefangen.push(id) };
const ohneCapture: ZeigerEreignisArt['currentTarget'] = {
  setPointerCapture: () => {
    throw new Error('kein Capture');
  },
};
const zeiger = (button = 0, currentTarget: ZeigerEreignisArt['currentTarget'] = ziel): ZeigerEreignisArt => ({
  button,
  pointerId: 7,
  currentTarget,
});
const taste = (key: string, repeat = false) => ({ key, repeat, preventDefault: () => undefined });

{
  const { z, h } = aufbau();
  h.onPointerDown(zeiger());
  h.onPointerUp();
  gleich([z.press, z.release], [1, 1], 'Tally Halten: Zeiger runter/hoch → onPress und onRelease je einmal');
}
{
  gefangen = [];
  const { z, h } = aufbau();
  h.onPointerDown(zeiger());
  gleich(gefangen, [7], 'Tally Halten: setPointerCapture mit der pointerId');
  h.onPointerCancel();
  h.onLostPointerCapture();
  gleich([z.press, z.release], [1, 1], 'Tally Halten: pointercancel, danach lostpointercapture → ein onRelease');
}
{
  const { z, h } = aufbau();
  h.onPointerDown(zeiger(0, ohneCapture));
  h.onPointerCancel();
  const nachCancel = z.release;
  h.onPointerUp();
  gleich(
    [z.press, nachCancel, z.release],
    [1, 1, 1],
    'Tally Halten: pointercancel allein (Capture fehlgeschlagen, kein lostpointercapture) → sofort onRelease',
  );
}
{
  const { z, h } = aufbau();
  h.onPointerDown(zeiger());
  h.onLostPointerCapture();
  const nachVerlust = z.release;
  h.onPointerUp();
  gleich(
    [z.press, nachVerlust, z.release],
    [1, 1, 1],
    'Tally Halten: lostpointercapture allein (Capture verloren, pointerup kommt nie an) → sofort onRelease',
  );
}
{
  const { z, h } = aufbau();
  h.onPointerDown(zeiger());
  h.onPointerUp();
  h.onLostPointerCapture();
  gleich([z.press, z.release], [1, 1], 'Tally Halten: pointerup und lostpointercapture nacheinander → ein onRelease');
}
{
  const { z, h } = aufbau();
  h.onKeyDown(taste(' '));
  h.onKeyDown(taste(' ', true));
  h.onKeyDown(taste(' ', true));
  const vorKeyup = [z.press, z.release];
  h.onKeyUp(taste(' '));
  gleich([...vorKeyup, z.press, z.release], [1, 0, 1, 1], 'Tally Halten: Leertaste → onPress, Auto-Repeat ignoriert, keyup → onRelease');
}
{
  const { z, h } = aufbau();
  h.onKeyDown(taste('Enter'));
  h.onKeyDown(taste('Enter', true));
  h.onKeyUp(taste('Enter'));
  gleich([z.press, z.release], [1, 1], 'Tally Halten: Enter ebenso');
}
{
  // E9: Ein gehaltenes Enter klickt im Browser mit jeder Wiederholung erneut; nur der erste Druck darf klicken.
  const { z, h } = aufbau();
  let verhindert = 0;
  const druck = (key: string, repeat: boolean) => ({ key, repeat, preventDefault: () => void verhindert++ });
  h.onKeyDown(druck('Enter', false));
  const nachErstem = verhindert;
  h.onKeyDown(druck('Enter', true));
  h.onKeyDown(druck('Enter', true));
  h.onKeyUp(druck('Enter', false));
  h.onKeyDown(druck(' ', false));
  h.onKeyDown(druck(' ', true));
  h.onKeyUp(druck(' ', false));
  gleich(
    [nachErstem, verhindert, z.press, z.release],
    [0, 2, 2, 2],
    'Tally: Enter gehalten – Auto-Repeat ruft preventDefault (kein zweiter Klick), der erste Druck nicht; die Leertaste bleibt unberührt',
  );
}
{
  const { z, h } = aufbau();
  h.onKeyDown(taste(' ', true));
  h.onKeyUp(taste(' '));
  gleich([z.press, z.release], [0, 0], 'Tally Halten: Auto-Repeat allein (Taste war schon gedrückt) startet kein Halten');
}
{
  const { z, h } = aufbau();
  h.onPointerDown(zeiger());
  h.onKeyDown(taste(' '));
  h.onPointerUp();
  h.onKeyDown(taste(' ', true));
  h.onKeyUp(taste(' '));
  gleich([z.press, z.release], [1, 1], 'Tally Halten: Zeiger los, Leertaste noch gehalten – Auto-Repeat drückt nicht neu');
}
{
  const { z, h } = aufbau();
  h.onKeyDown(taste('a'));
  h.onKeyUp(taste('a'));
  gleich([z.press, z.release], [0, 0], 'Tally Halten: andere Taste hält nicht');
}
{
  const { z, h } = aufbau();
  h.onKeyDown(taste(' '));
  h.onBlur();
  const nachBlur = z.release;
  h.onKeyUp(taste(' '));
  gleich([z.press, nachBlur, z.release], [1, 1, 1], 'Tally Halten: Fokusverlust (blur) beim Halten → sofort onRelease, späteres keyup nichts');
  const maus = aufbau();
  maus.h.onPointerDown(zeiger());
  maus.h.onBlur();
  gleich([maus.z.press, maus.z.release], [1, 1], 'Tally Halten: Alt+Tab mit gedrückter Maus (blur) → onRelease');
}
{
  const { z, h } = aufbau();
  h.onPointerDown(zeiger(2));
  h.onPointerUp();
  gleich([z.press, z.release], [0, 0], 'Tally Halten: rechte Maustaste hält nicht');
}
{
  const { z, h, halten } = aufbau();
  h.onPointerDown(zeiger(0, ohneCapture));
  const gehalten = halten.gehalten;
  h.onPointerUp();
  ok(gehalten && z.press === 1 && z.release === 1, 'Tally Halten: setPointerCapture wirft → trotzdem gehalten und losgelassen');
  const ohneZiel = aufbau();
  ohneZiel.h.onPointerDown(zeiger(0, null));
  ohneZiel.h.onPointerUp();
  gleich([ohneZiel.z.press, ohneZiel.z.release], [1, 1], 'Tally Halten: ohne currentTarget trotzdem gehalten und losgelassen');
}
{
  gefangen = [];
  const { z, h } = aufbau();
  h.onKeyDown(taste(' '));
  h.onPointerDown(zeiger());
  h.onPointerUp();
  const mitte = z.release;
  h.onKeyUp(taste(' '));
  gleich(
    [gefangen.length, z.press, mitte, z.release],
    [0, 1, 0, 1],
    'Tally Halten: mit Taste gehalten – Zeiger fängt nicht, pointerup löst nicht, keyup löst einmal',
  );
}
{
  const { z, h } = aufbau({ state: 'gesperrt', disabledReason: 'Kein Signal' });
  h.onClick();
  h.onPointerDown(zeiger());
  h.onPointerUp();
  h.onKeyDown(taste(' '));
  h.onKeyUp(taste(' '));
  gleich([z.click, z.press, z.release], [0, 0, 0], 'Tally gesperrt: weder onClick noch onPress');
}
{
  const { z, h } = aufbau();
  h.onClick();
  gleich([z.click, z.press, z.release], [1, 0, 0], 'Tally: onClick kommt unabhängig vom Halten');
  const nurKlick = aufbau({ onPress: undefined, onRelease: undefined });
  nurKlick.h.onPointerDown(zeiger());
  nurKlick.h.onPointerUp();
  nurKlick.h.onClick();
  gleich([nurKlick.z.click, nurKlick.halten.gehalten], [1, false], 'Tally: nur onClick – Zeiger hält nichts, Klick kommt');
  gefangen = [];
  nurKlick.h.onPointerDown(zeiger());
  gleich(gefangen, [], 'Tally: nur onClick – kein setPointerCapture (Wegziehen und Loslassen löst keinen Klick aus)');
}
{
  let losgelassen = 0;
  const props: TallyButtonProps = {
    state: 'bereit',
    label: 'Talk',
    onPress: () => {
      throw new Error('Talkback nicht erreichbar');
    },
    onRelease: () => {
      losgelassen++;
    },
  };
  const h = tallyKnopfProps(props, erzeugeHalten(props), 'grund');
  let geworfen = false;
  try {
    h.onPointerDown(zeiger());
  } catch {
    geworfen = true;
  }
  h.onPointerUp();
  h.onLostPointerCapture();
  ok(geworfen && losgelassen === 1, 'Tally Halten: onPress wirft → Fehler kommt durch, onRelease trotzdem genau einmal');
}

// ── Effekt-Körper und Neu-Rendern (die Effekte selbst laufen nur im Browser) ──
{
  const z = { press: 0, release: 0 };
  const halten = erzeugeHalten({ onPress: () => void z.press++, onRelease: () => void z.release++ });
  halten.druecken('zeiger');
  haltenBeiZustand('bereit', halten);
  haltenBeiZustand('live', halten);
  const vorSperre = z.release;
  haltenBeiZustand('gesperrt', halten);
  haltenBeiZustand('gesperrt', halten);
  gleich([vorSperre, z.release], [0, 1], 'Tally Halten: Wechsel auf gesperrt beim Halten → onRelease genau einmal; bereit und live brechen nicht ab');
}
{
  const z = { release: 0 };
  const halten = erzeugeHalten({ onRelease: () => void z.release++ });
  halten.druecken('taste');
  haltenBeiAbbau(halten);
  haltenBeiAbbau(halten);
  gleich(z.release, 1, 'Tally Halten: Abbau beim Halten → onRelease genau einmal');
}
{
  const alt = { release: 0 };
  const neu = { release: 0 };
  const ref: { current: HaltenSteuerung | null } = { current: null };
  const erste = haltenFuerRender(ref, { onPress: () => undefined, onRelease: () => void alt.release++ });
  erste.druecken('zeiger');
  const zweite = haltenFuerRender(ref, { onPress: () => undefined, onRelease: () => void neu.release++ });
  zweite.loslassen('zeiger');
  ok(erste === zweite && alt.release === 0 && neu.release === 1, 'Tally Halten: neue Rückrufe nach erneutem Rendern – Loslassen ruft das neueste onRelease');
}

// ── Verdrahtung im Quelltext: Spread, beide Effekte, haltenFuerRender, kein Handler daneben ──
{
  const quelle = leseText('src/components/TallyButton.tsx');
  const baustein = quelle.slice(quelle.indexOf('export function TallyButton('));
  const PFLICHT = [
    'const haltenRef = useRef<HaltenSteuerung | null>(null);',
    'const halten = haltenFuerRender(haltenRef, p);',
    'useEffect(() => haltenBeiZustand(state, halten), [state, halten]);',
    'useEffect(() => () => haltenBeiAbbau(halten), [halten]);',
    '<button {...tallyKnopfProps(p, halten, grundId)}>',
  ];
  const fehlt = PFLICHT.filter((zeile) => baustein.split(zeile).length !== 2);
  const handlerDaneben = baustein.match(/\son[A-Z]\w*=\{/g) ?? [];
  ok(
    fehlt.length === 0 && handlerDaneben.length === 0,
    'Tally Verdrahtung: Knopf-Props per Spread, Effekte für gesperrt und Abbau, neueste Rückrufe – je genau einmal im Baustein',
  );
  for (const zeile of fehlt) console.log(`     fehlt: ${zeile}`);
  for (const zeile of handlerDaneben) console.log(`     Handler neben dem Spread: ${zeile.trim()}`);
}

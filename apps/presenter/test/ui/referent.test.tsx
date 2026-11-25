// UX Welle 2b, Presenter d2 · Referent fest dunkel, Leiste und Kopf (B4, B7, B11, B12, Muster d): AppShell mit thema „dunkel“,
// echter Titelleiste (mac={false}) und der Kopf-Aktion „■ Beenden“ ganz rechts; die Leiste unter dem Kopf trägt links Zähler,
// Titel und Uhr, rechts die Knöpfe in der Reihenfolge B12; die Bildschirmwahl merkt nur, „Auf diesen Bildschirm“ verschiebt und
// nennt seinen Sperrgrund. Ein Stand (useStand) für alles; die Kürzel bleiben im Referenten und im Publikum. Render ohne Browser
// und ohne window; Rückrufe hookloser Komponenten werden über den Elementbaum ausgelöst.
import { SCREEN_TEXTE } from '@jm/settings';
import { UNBEKANNT } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { pillenText } from '@shared/gast-klicker';
import * as ob from '@/lib/oberflaeche';
import { PRESENTER_TEXTE, referentWahl, verschiebenGrund, verschiebenMoeglich, type OberflaechenStand } from '@/lib/oberflaeche';
import * as stand from '@/lib/useStand';
import { ReferentLeiste, SchleifenKnopf, type ReferentLeisteProps } from '@/views/ReferentLeiste';
import { bildschirmBedienung, KopfBeenden, ReferentRahmen, type ReferentRahmenProps } from '@/views/ReferentOberflaeche';
import { panelTaste } from '../../../../packages/ui/src/components/SettingsPanel';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import {
  aktionenAttrappe,
  attr,
  bereich,
  bildschirme,
  elemente,
  gastStatus,
  laufend,
  ndiStatus,
  ohneKommentare,
  presentAttrappe,
  referentAttrappe,
  referentFolien,
  referentStand,
  statusEintraege,
  tags,
  text,
} from './testzustand';

const T = PRESENTER_TEXTE;
const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const ROH = (d: string): string => leseText(`src/renderer/src/${d}`);

/** Der Rahmen des Referenten mit gegebenem Stand (ohne useStand), wie ihn die Wurzel-View rendert. */
function rahmen(s: OberflaechenStand = referentStand(), teil: Partial<ReferentRahmenProps> = {}): string {
  return render(
    <ReferentRahmen
      stand={s}
      folien={referentFolien()}
      wahl={referentWahl(undefined, s.bildschirme)}
      uebersicht={false}
      aktionen={aktionenAttrappe([], false)}
      referent={referentAttrappe()}
      panelOffen={false}
      onPanel={() => undefined}
      onWahl={() => undefined}
      onVerschieben={() => undefined}
      onUebersicht={() => undefined}
      {...teil}
    />,
  );
}
/** Render ohne Abbruch: ein Wurf zählt als FAIL, der Lauf geht weiter. */
function ohneWurf(name: string, f: () => string): string {
  try {
    return f();
  } catch (e) {
    ok(false, `${name}: Render ohne Wurf (${String(e).split(String.fromCharCode(10))[0]})`);
    return '';
  }
}
const kopf = (html: string): string => html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
const leiste = (html: string): string => bereich(html, 'data-bereich', 'toolbar');
const kennungen = (html: string): string[] => [...html.matchAll(/data-presenter="([a-z-]+)"/g)].map((m) => m[1]);
const knopfIn = (html: string, kennung: string): string | undefined => tags(bereich(html, 'data-presenter', kennung), 'button')[0] ?? tags(bereich(html, 'data-presenter', kennung), 'select')[0];
const gesperrt = (tag: string | undefined): boolean => /\sdisabled=""/.test(tag ?? '');
/**
 * Der Rahmen um einen Leistenknopf (Gesamtprüfung UX Welle 2b, M6, Muster Connect MitTooltip): das span direkt vor dem Knopf mit dieser
 * Kennung; undefined, wenn der Knopf keinen Rahmen hat. Der Tooltip (Sperrgrund) steht am Rahmen, weil Chromium gesperrten Knöpfen keine
 * Mausereignisse gibt.
 */
const rahmenVon = (html: string, kennung: string): string | undefined => {
  const i = html.search(new RegExp(`<button[^>]*\\sdata-presenter="${kennung}"`));
  return i < 0 ? undefined : /<span(?:\s[^>]*)?>$/.exec(html.slice(0, i))?.[0];
};
/** Tooltip eines Leistenknopfs: am Rahmen (M6). */
const tooltip = (html: string, kennung: string): string | undefined => attr(rahmenVon(html, kennung), 'title');
const aktiv = (tag: string | undefined): boolean => /bg-\[var\(--primary\)\]/.test(attr(tag, 'class') ?? '');

/** Die Dateien des Referenten-Fensters (Wurzel, Leiste, Live-Bereich, Kopf- und Leistenbausteine, Panel). */
const REFERENT_DATEIEN = [
  'views/ReferentOberflaeche.tsx',
  'views/ReferentLeiste.tsx',
  'views/PresenterView.tsx',
  'views/Einstellungen.tsx',
  'components/GastKlickerPille.tsx',
  'components/TimerBar.tsx',
  'components/Clock.tsx',
  'components/NdiSchalter.tsx',
  'components/RemotePanel.tsx',
  'components/GastKlickerAbschnitt.tsx',
  'components/SlideCanvas.tsx',
];

// ── PS Referent fest dunkel: thema „dunkel“, echte Titelleiste, Kopf-Aktion „■ Beenden“ mit title „Esc“ (B4, B7, B12) ──
{
  const html = ohneWurf('PS Referent fest dunkel', () => rahmen());
  const k = kopf(html);
  ok(/^<div data-dichte="normal" class="dark /.test(html), 'PS Referent fest dunkel: die Wurzel des Rahmens trägt „dark“ (AppShell thema „dunkel“, Dichte normal)');
  ok(!html.includes('data-theme'), 'PS Referent fest dunkel: kein ThemeToggle im Kopf (thema „dunkel“ liest jm-theme nie)');
  ok(/<header[^>]*class="[^"]*\bpl-4\b/.test(html) && !/<header[^>]*class="[^"]*\bpl-20\b/.test(html), 'PS Referent fest dunkel: echte Titelleiste (mac={false}): kein Platz für die Mac-Ampel im Kopf');
  ok(text(k).includes('JM Presenter') && k.includes('data-zahnrad'), 'PS Referent fest dunkel: Kopf mit Logo, „JM Presenter“ und ⚙');
  const aktion = bereich(k, 'data-bereich', 'kopf-aktion');
  const [beenden] = tags(aktion, 'button');
  gleich(
    [text(aktion).trim(), attr(beenden, 'title'), attr(beenden, 'data-presenter'), tags(aktion, 'button').length],
    [T.taste.kopfBeenden, T.taste.kopfBeendenKuerzel, 'beenden', 1],
    'PS Referent fest dunkel: Kopf-Aktion „■ Beenden“ mit title „Esc“, genau ein Knopf',
  );
  ok(k.indexOf('data-zahnrad') < k.indexOf('data-bereich="kopf-aktion"') && T.taste.kopfBeenden === '■ Beenden' && T.taste.kopfBeendenKuerzel === 'Esc', 'PS Referent fest dunkel: „■ Beenden“ steht ganz rechts nach ⚙ (B7), Texte wie im Plan');
  const log: string[] = [];
  const knopf = elemente(KopfBeenden({ onBeenden: () => void log.push('beenden') })).find((e) => e.type === 'button');
  (knopf?.props.onClick as (() => void) | undefined)?.();
  gleich(log, ['beenden'], 'PS Referent fest dunkel: „■ Beenden“ beendet die Präsentation (present.stop über die Aktion beenden)');
  gleich(
    [kopf(rahmen(referentStand())).includes('data-onair="live"'), kopf(rahmen(referentStand({ praesentation: laufend({ index: 1, screen: 'black' }) }))).includes('data-onair="live"')],
    [true, false],
    'PS Referent fest dunkel: ON AIR nach B3 (live nur bei laufender Folie, bei Schwarz bereit)',
  );
  pruefeIdVerweise(html, 'PS Referent fest dunkel: id-Verweise im Referentenfenster gültig');
  ok(!text(html).includes('"'), 'PS Referent fest dunkel: kein ASCII-Anführungszeichen in den Texten des Referentenfensters');
  const theme = /\buseTheme\b|\bThemeToggle\b|jm-theme|THEME_SCHLUESSEL/;
  gleich(REFERENT_DATEIEN.filter((d) => theme.test(QUELLE(d))), [], 'PS Referent fest dunkel: keine Datei des Referenten importiert useTheme oder ThemeToggle oder liest jm-theme');
  const w = QUELLE('views/ReferentOberflaeche.tsx');
  ok(w.includes('thema="dunkel"') && w.includes('mac={false}') && w.includes('kopfAktion={') && w.includes('tool="Presenter"') && !w.includes('dichte='), 'PS Referent fest dunkel: Quelltext – AppShell tool „Presenter“, thema „dunkel“, mac={false}, kopfAktion, Dichte normal');
  ok(w.includes('status={statusLeiste(stand)}') && w.includes('onAir={kopfOnAir(stand)}'), 'PS Referent fest dunkel: Quelltext – Statusleiste ohne Startwahl (der Referent hat keine) und ON AIR aus kopfOnAir');
  const m = QUELLE('main.tsx');
  ok(m.includes('<ReferentOberflaeche />') && !m.includes('<PresenterView />') && m.includes('<AudienceView />'), 'PS Referent fest dunkel: main.tsx rendert für den Referenten ReferentOberflaeche, das Publikum unverändert AudienceView');
}

// ── PS Referent: ein Stand (Pflicht aus Task 10): die Wurzel holt den Stand nur über useStand, keine Datei des Referenten hat eigene Abos ──
{
  const ABO = /useBrueckenWert|useNdiStatus|useTimerSync|usePresentation\(|\.on(?:State|Status|Bildschirme|MasterLink|Fernsteuerung|ReferentVollbild)\(|\.displays\(|\.getState\(|\.getConfig\(|\.status\(\)|\.interfaces\(|\.referentVollbild\(|MASTER_LINK_QUELLE|FERNSTEUERUNG_QUELLE/;
  const w = QUELLE('views/ReferentOberflaeche.tsx');
  ok((w.match(/useStand\('referent', panelOffen\)/g) ?? []).length === 1 && (w.match(/\buseStand\(/g) ?? []).length === 1, "PS Referent: ReferentOberflaeche ruft useStand('referent', panelOffen) genau einmal");
  gleich(REFERENT_DATEIEN.filter((d) => ABO.test(QUELLE(d))), [], 'PS Referent: Wurzel, Leiste, Live-Bereich, Pille, Timer-Leiste, Uhr, NDI-Knopf, Handy- und Gast-Abschnitt ohne eigene Abos und Abfragen');
  ok(w.includes('useFolien()') && !/\busePresentation\(/.test(w), 'PS Referent: die Folien kommen aus useFolien (nur der Payload), der Präsentationszustand nur aus dem Stand');
  const s = QUELLE('lib/useStand.ts');
  ok(s.includes('present?.referentVollbild') && s.includes('present?.onReferentVollbild') && /timerZustand,/.test(s) && /referentVollbild,/.test(s), 'PS Referent: useStand liest auch das Vollbild des Referenten und gibt den Timer-Zustand weiter (für die Timer-Leiste)');
  ok(/useBrueckenWert\(fenster === 'referent' \? VOLLBILD_QUELLE : undefined\)/.test(s), 'PS Referent: das Vollbild des Referenten liest nur der Referent');
  const q = stand.VOLLBILD_QUELLE;
  const antwort = q === undefined ? 'fehlt' : await q.abfrage();
  gleich([antwort, q === undefined ? 'fehlt' : typeof q.ereignis(() => undefined)], [null, 'function'], 'PS Referent: VOLLBILD_QUELLE antwortet ohne window null und meldet sich ohne Wurf an');
  const remote = QUELLE('components/RemotePanel.tsx');
  ok(!/export function RemotePanel\b/.test(remote) && !remote.includes('inset-0') && !remote.includes('onClose'), 'PS Referent: die Modal-Hülle RemotePanel entfällt (Inhalt steht im Panel-Abschnitt Handy-Fernsteuerung)');
  ok(!/export function NdiSchalter\b/.test(QUELLE('components/NdiSchalter.tsx')), 'PS Referent: die Hülle NdiSchalter mit eigenem NDI-Abo entfällt (der Referent nutzt NdiKnopf mit dem Stand)');
}

// ── PS Kürzel bleiben: Referent und Publikum rufen usePresenterKeys(true); der F11-Hörer bleibt im Referenten ──
{
  const w = QUELLE('views/ReferentOberflaeche.tsx');
  const a = QUELLE('views/AudienceView.tsx');
  gleich(
    [(w.match(/usePresenterKeys\(true\)/g) ?? []).length, (a.match(/usePresenterKeys\(true\)/g) ?? []).length],
    [1, 1],
    'PS Kürzel bleiben: ReferentOberflaeche und AudienceView rufen usePresenterKeys(true) je genau einmal',
  );
  gleich(
    REFERENT_DATEIEN.filter((d) => d !== 'views/ReferentOberflaeche.tsx' && /usePresenterKeys/.test(QUELLE(d))),
    [],
    'PS Kürzel bleiben: nur die Wurzel des Referenten hängt die Kürzel an (kein zweiter Hörer im Live-Bereich oder in der Leiste)',
  );
  ok(
    /e\.key !== 'F11'\) return;\s*e\.preventDefault\(\);\s*void window\.jmpr\.present\.toggleReferentVollbild\(\);/.test(w) && /window\.addEventListener\('keydown', onKey\)/.test(w),
    'PS Kürzel bleiben: F11 schaltet im Referenten das Vollbild mit preventDefault (das Standardmenü schaltet nicht ein zweites Mal)',
  );
  const k = QUELLE('lib/usePresentation.ts');
  ok(/const onKey = \(e: KeyboardEvent\): void => verarbeiteTaste\(e, window\.jmpr\.present\);\s*window\.addEventListener\('keydown', onKey\);/.test(k), 'PS Kürzel bleiben: usePresenterKeys hängt verarbeiteTaste unverändert an window (Publikum und Referent gleich)');
}

// ── PS Strg+W im Referenten (Pflicht aus Task 9, im echten Fenster gemessen): das Panel hält Tasten aus seinen Feldern an
// (stopPropagation), verarbeiteTaste sieht sie nie; ohne preventDefault schloss Strg+W aus dem Feld „Host“ das Fenster und
// beendete die Präsentation. Darum fängt die Wurzel Strg/Cmd+W in der Erfassungsphase ab, vor dem Panel ──
{
  const ZIEL: Record<string, unknown> = { textfeld: { tagName: 'INPUT', type: 'text' }, auswahl: { tagName: 'SELECT' }, knopf: { tagName: 'BUTTON' }, keins: null };
  const abfangen = (ob as Record<string, unknown>).fensterSchliessenAbfangen as ((e: { key: string; ctrlKey?: boolean; metaKey?: boolean; target: unknown; preventDefault(): void }) => void) | undefined;
  const faelle = kreuz({ key: ['w', 'W', 'x', 'Escape', 'F11'], ctrl: [false, true], meta: [false, true], ziel: ['textfeld', 'auswahl', 'knopf', 'keins'] } as const);
  pruefeFaelle('PS Strg+W im Referenten: fensterSchliessenAbfangen ruft preventDefault genau bei Strg/Cmd+W (in jedem Ziel), sonst nichts', faelle, (f) => {
    let verhindert = false;
    if (typeof abfangen !== 'function') return 'fensterSchliessenAbfangen fehlt';
    abfangen({ key: f.key, ctrlKey: f.ctrl, metaKey: f.meta, target: ZIEL[f.ziel], preventDefault: () => void (verhindert = true) });
    return vergleiche(String(verhindert), String((f.key === 'w' || f.key === 'W') && (f.ctrl || f.meta)));
  });
  const w = QUELLE('views/ReferentOberflaeche.tsx');
  ok(
    /window\.addEventListener\('keydown', fensterSchliessenAbfangen, true\)/.test(w) && /window\.removeEventListener\('keydown', fensterSchliessenAbfangen, true\)/.test(w),
    'PS Strg+W im Referenten: die Wurzel meldet fensterSchliessenAbfangen in der Erfassungsphase am window an (vor dem Panel) und wieder ab',
  );
  ok(!/fensterSchliessenAbfangen/.test(QUELLE('views/AudienceView.tsx')) && !/fensterSchliessenAbfangen/.test(QUELLE('lib/usePresentation.ts')), 'PS Strg+W im Referenten: Publikum und usePresenterKeys bleiben unverändert');
}

// ── PS Leiste: links Zähler, Titel und Uhr; rechts die Knöpfe in der Reihenfolge B12; kein 📱, kein ⬛/⬜ ──
{
  const voll = referentStand({ gastKlicker: gastStatus({ an: true, lage: 'verbunden', link: 'https://x.invalid/k/1', gaeste: 2 }), ndi: ndiStatus('sendet', true, 2) });
  const html = ohneWurf('PS Leiste', () => rahmen(voll));
  const l = leiste(html);
  const links = bereich(l, 'data-presenter', 'leiste-links');
  const rechts = bereich(l, 'data-presenter', 'leiste-rechts');
  gleich(
    [text(bereich(links, 'data-presenter', 'zaehler')).replace(/\s+/g, ''), text(bereich(links, 'data-presenter', 'folientitel')).trim(), text(links).includes('Uhrzeit') && text(links).includes('Laufzeit')],
    ['2/3', 'Agenda', true],
    'PS Leiste: links der große Zähler „n / m“, der Titel der aktuellen Folie und die Uhr (wie im alten Kopf)',
  );
  ok(links !== '' && rechts !== '' && l.indexOf('data-presenter="leiste-links"') < l.indexOf('data-presenter="leiste-rechts"'), 'PS Leiste: die linke Gruppe steht vor der rechten');
  gleich(
    kennungen(rechts).filter((k) => k !== 'leiste-rechts'),
    ['bildschirm', 'verschieben', 'ndi', 'gast-klick', 'schleife', 'publikum-vollbild', 'vollbild', 'uebersicht'],
    'PS Leiste: rechts Bildschirmwahl, „Auf diesen Bildschirm“, NDI, Gast-Klick, Schleife, „Publikum Vollbild“, „Vollbild“, „Übersicht“ (B12)',
  );
  gleich(
    [text(bereich(rechts, 'data-presenter', 'verschieben')), text(bereich(rechts, 'data-presenter', 'publikum-vollbild')), text(bereich(rechts, 'data-presenter', 'vollbild')), text(bereich(rechts, 'data-presenter', 'uebersicht')), text(bereich(rechts, 'data-presenter', 'schleife')).startsWith('⟳ Schleife'), text(bereich(rechts, 'data-presenter', 'gast-klick')), text(bereich(rechts, 'data-presenter', 'ndi'))],
    [T.verschieben.knopf, 'Publikum Vollbild', 'Vollbild', 'Übersicht', true, pillenText(voll.gastKlicker!), 'NDI ● an · 2 Empfänger'],
    'PS Leiste: Beschriftungen der rechten Knöpfe (NDI und Gast-Klick wie bisher aus ndiSchalterText und pillenText)',
  );
  ok(!['📱', '⬛', '⬜'].some((z) => html.includes(z)), 'PS Leiste: kein 📱 (Handy steht im Panel) und kein ⬛/⬜ (Schwarz und Weiß sind Haupttasten unter der Folie)');
  ok(!text(l).includes(T.taste.kopfBeenden) && !l.includes('data-zahnrad'), 'PS Leiste: „■ Beenden“ und ⚙ stehen im Kopf, nicht in der Leiste');
  ok(!kennungen(rahmen(referentStand({ gastKlicker: gastStatus() }))).includes('gast-klick'), 'PS Leiste: die Gast-Klick-Pille erscheint nur bei eingeschaltetem Gast-Klicker (wie bisher)');
  gleich(
    [attr(knopfIn(rechts, 'bildschirm'), 'title'), tooltip(rechts, 'vollbild')],
    [T.publikum.bildschirmWahl, 'Referentenansicht im Vollbild (F11)'],
    'PS Leiste: Tooltips „Publikums-Bildschirm“ und „Referentenansicht im Vollbild (F11)“ wie bisher',
  );
  const zustand = (s: OberflaechenStand, uebersicht = false): Record<string, boolean> => {
    const r = bereich(leiste(rahmen(s, { uebersicht })), 'data-presenter', 'leiste-rechts');
    return { schleife: aktiv(knopfIn(r, 'schleife')), vollbild: aktiv(knopfIn(r, 'vollbild')), uebersicht: aktiv(knopfIn(r, 'uebersicht')), pvGesperrt: gesperrt(knopfIn(r, 'publikum-vollbild')) };
  };
  gleich(
    [zustand(referentStand()), zustand(referentStand({ praesentation: laufend({ index: 1, schleife: true }), referentVollbild: true }), true), zustand(referentStand({ bildschirme: bildschirme(null) }))],
    [
      { schleife: false, vollbild: false, uebersicht: false, pvGesperrt: false },
      { schleife: true, vollbild: true, uebersicht: true, pvGesperrt: false },
      { schleife: false, vollbild: false, uebersicht: false, pvGesperrt: true },
    ],
    'PS Leiste: Schleife, Vollbild (gemessen) und Übersicht hinterlegt, solange sie an sind; „Publikum Vollbild“ gesperrt bei nur NDI',
  );
  ok(tooltip(bereich(leiste(rahmen(referentStand({ bildschirme: bildschirme(null) }))), 'data-presenter', 'leiste-rechts'), 'publikum-vollbild') === T.publikum.keinFensterNurNdi && T.publikum.keinFensterNurNdi === 'Kein Publikumsfenster – Bild nur über NDI', 'PS Leiste: „Publikum Vollbild“ nennt bei nur NDI den alten Grund als Tooltip');
}

// ── PS „■ Beenden“ je Breite (Owner 24.11. 22:18, P2 B, ändert B7; W134; gemessen in Task N1): Bei schmalem Fenster ist „■ Beenden“
// die letzte Taste der Leiste, rechts neben der umbrechenden Gruppe; so steht es immer am Ende der ersten Leistenzeile, dort, wo es im
// zweizeiligen alten Kopf stand, und keine andere Taste rückt auf seinen alten Platz. Der Kopf behält ⚙. Bei breitem Fenster bleibt es
// wie gebaut ganz rechts im Kopf nach ⚙ (B7). Der Umschaltpunkt ist die Innenbreite, ab der der alte Kopf in jedem gemessenen Zustand
// einzeilig war ──
{
  const ab = (ob as Record<string, unknown>).REFERENT_BREIT_AB as number | undefined;
  const inLeiste = (ob as Record<string, unknown>).beendenInDerLeiste as ((innenBreite: number) => boolean) | undefined;
  ok(typeof ab === 'number' && Number.isInteger(ab) && ab > 1269 && ab <= 1490, 'PS Beenden je Breite: der Umschaltpunkt liegt über der Innenbreite von 1280 (1269 px) und höchstens bei der von 1500 (1490 px)');
  const faelle = [1013, 1100, 1269, 1400, ...(typeof ab === 'number' ? [ab - 1, ab] : []), 1490, 1910].map((breite) => ({ breite }));
  pruefeFaelle('PS Beenden je Breite: beendenInDerLeiste ist wahr genau unter dem Umschaltpunkt (1024 und 1280 schmal, 1500 und breiter im Kopf)', faelle, (f) => {
    if (typeof inLeiste !== 'function' || typeof ab !== 'number') return 'beendenInDerLeiste oder REFERENT_BREIT_AB fehlt';
    return vergleiche(String(inLeiste(f.breite)), String(f.breite < ab));
  });

  const voll = referentStand({ gastKlicker: gastStatus({ an: true, lage: 'verbunden', link: 'https://x.invalid/k/1', gaeste: 2 }), ndi: ndiStatus('sendet', true, 2) });
  const schmal = ohneWurf('PS Beenden je Breite (schmal)', () => rahmen(voll, { schmal: true }));
  const breit = ohneWurf('PS Beenden je Breite (breit)', () => rahmen(voll, { schmal: false }));
  const beenden = (html: string): string[] => tags(html, 'button').filter((t) => attr(t, 'data-presenter') === 'beenden');
  gleich(
    [beenden(schmal).length, beenden(kopf(schmal)).length, beenden(leiste(schmal)).length, bereich(kopf(schmal), 'data-bereich', 'kopf-aktion'), kopf(schmal).includes('data-zahnrad')],
    [1, 0, 1, '', true],
    'PS Beenden je Breite: schmal steht „■ Beenden“ genau einmal, in der Leiste und nicht im Kopf; der Kopf behält ⚙ und hat keine Kopf-Aktion',
  );
  gleich(
    [beenden(breit).length, beenden(kopf(breit)).length, beenden(leiste(breit)).length, beenden(bereich(kopf(breit), 'data-bereich', 'kopf-aktion')).length],
    [1, 1, 0, 1],
    'PS Beenden je Breite: breit steht „■ Beenden“ genau einmal, als Kopf-Aktion ganz rechts nach ⚙ (B7, wie gebaut)',
  );
  ok(breit !== '' && rahmen(voll) === breit, 'PS Beenden je Breite: ohne Angabe gilt die breite Lage (B7)');
  const [knopf] = beenden(leiste(schmal));
  gleich(
    [text(bereich(leiste(schmal), 'data-presenter', 'beenden')).trim(), attr(knopf, 'title'), attr(knopf, 'class') === attr(beenden(kopf(breit))[0], 'class')],
    [T.taste.kopfBeenden, T.taste.kopfBeendenKuerzel, true],
    'PS Beenden je Breite: in der Leiste derselbe Knopf wie im Kopf („■ Beenden“, title „Esc“, gleiche Klassen)',
  );

  // Reihenfolge der rechten Gruppe schmal (B12 davor unverändert) und Aufbau: „■ Beenden“ neben der umbrechenden Gruppe, nicht in ihr.
  const rechts = bereich(leiste(schmal), 'data-presenter', 'leiste-rechts');
  gleich(
    kennungen(rechts).filter((k) => k !== 'leiste-rechts'),
    ['bildschirm', 'verschieben', 'ndi', 'gast-klick', 'schleife', 'publikum-vollbild', 'vollbild', 'uebersicht', 'beenden'],
    'PS Beenden je Breite: schmal ist „■ Beenden“ die letzte Taste der rechten Gruppe, nach „Übersicht“; davor die Reihenfolge B12',
  );
  gleich(
    kennungen(bereich(leiste(breit), 'data-presenter', 'leiste-rechts')).filter((k) => k !== 'leiste-rechts'),
    ['bildschirm', 'verschieben', 'ndi', 'gast-klick', 'schleife', 'publikum-vollbild', 'vollbild', 'uebersicht'],
    'PS Beenden je Breite: breit bleibt die rechte Gruppe ohne „■ Beenden“ (Reihenfolge B12 wie gebaut)',
  );
  const umbruch = bereich(rechts, 'data-bereich', 'leiste-umbruch');
  const klasse = (html: string): string => attr(tags(html, 'div')[0], 'class') ?? '';
  const nachUmbruch = rechts.indexOf(umbruch) + umbruch.length;
  gleich(
    [
      umbruch !== '' && /\bflex-wrap\b/.test(klasse(umbruch)) && /\bjustify-end\b/.test(klasse(umbruch)),
      kennungen(umbruch).includes('uebersicht') && !kennungen(umbruch).includes('beenden'),
      umbruch !== '' && rechts.search(/data-presenter="beenden"/) > nachUmbruch,
      !/\bflex-wrap\b/.test(klasse(rechts)) && /\bitems-start\b/.test(klasse(rechts)),
      /\bshrink-0\b/.test(attr(/<div[^>]*>(?=<button[^>]*data-presenter="beenden")/.exec(rechts)?.[0], 'class') ?? ''),
    ],
    [true, true, true, true, true],
    'PS Beenden je Breite: schmal bricht nur die Gruppe um (flex-wrap, rechtsbündig); „■ Beenden“ steht danach außerhalb, nicht schrumpfend, oben bündig mit der ersten Zeile',
  );

  // Verdrahtung: derselbe Befehl in beiden Lagen (present.stop über referent.beenden), nie zwei Knöpfe.
  const attrappe = referentAttrappe();
  const props = (s: boolean): ReferentRahmenProps => ({
    stand: voll,
    folien: referentFolien(),
    wahl: null,
    uebersicht: false,
    aktionen: aktionenAttrappe([], false),
    referent: attrappe,
    panelOffen: false,
    onPanel: () => undefined,
    onWahl: () => undefined,
    onVerschieben: () => undefined,
    onUebersicht: () => undefined,
    schmal: s,
  });
  type Knoten = { props: Record<string, unknown> } | undefined;
  const shell = (s: boolean): Knoten => ReferentRahmen(props(s)) as unknown as Knoten;
  const bar = (s: boolean): Knoten => shell(s)?.props.toolbar as Knoten;
  const aktion = (k: unknown): unknown => (k as Knoten)?.props.onBeenden;
  gleich(
    [shell(true)?.props.kopfAktion, aktion(bar(true)?.props.beenden) === attrappe.beenden, aktion(shell(false)?.props.kopfAktion) === attrappe.beenden, bar(false)?.props.beenden],
    [undefined, true, true, undefined],
    'PS Beenden je Breite: schmal bekommt die Leiste „■ Beenden“ mit der Aktion beenden und der Kopf keine Kopf-Aktion; breit umgekehrt',
  );

  // Die Wurzel misst die Innenbreite beim Start und bei jeder Größenänderung (kein Abo, kein IPC) und gibt die Lage an den Rahmen.
  const w = QUELLE('views/ReferentOberflaeche.tsx');
  ok(
    (w.match(/beendenInDerLeiste\(window\.innerWidth\)/g) ?? []).length === 2 &&
      /window\.addEventListener\('resize', [A-Za-z]+\)/.test(w) &&
      /window\.removeEventListener\('resize', [A-Za-z]+\)/.test(w) &&
      /schmal=\{schmal\}/.test(w),
    'PS Beenden je Breite: Quelltext – die Wurzel liest window.innerWidth beim Start und bei resize (an- und abgemeldet) und reicht schmal an den Rahmen',
  );
}

// ── PS Leiste: Bildschirmwahl und „Auf diesen Bildschirm“ je Zustand (B11) ──
{
  const lage = (s: OberflaechenStand, gewaehlt?: number): { wert?: string; optionen: string[]; auswahlGesperrt: boolean; knopfGesperrt: boolean; grund?: string } => {
    const r = bereich(leiste(rahmen(s, { wahl: referentWahl(gewaehlt, s.bildschirme) })), 'data-presenter', 'leiste-rechts');
    const a = bereich(r, 'data-presenter', 'bildschirm');
    const k = knopfIn(r, 'verschieben');
    return {
      wert: text(/<option[^>]*selected=""[^>]*>[\s\S]*?<\/option>/.exec(a)?.[0] ?? '') || undefined,
      optionen: [...a.matchAll(/<option[^>]*>([\s\S]*?)<\/option>/g)].map((m) => text(m[1])),
      auswahlGesperrt: gesperrt(tags(a, 'select')[0]),
      knopfGesperrt: gesperrt(k),
      grund: tooltip(r, 'verschieben'),
    };
  };
  const namen = bildschirme(22).map((d) => d.label);
  gleich(
    [lage(referentStand()), lage(referentStand(), 33), lage(referentStand({ bildschirme: bildschirme(null) })), lage(referentStand({ bildschirme: undefined }))],
    [
      { wert: namen[1], optionen: namen, auswahlGesperrt: false, knopfGesperrt: true, grund: T.verschieben.gleich },
      { wert: namen[2], optionen: namen, auswahlGesperrt: false, knopfGesperrt: false, grund: undefined },
      { wert: T.publikum.nurNdi, optionen: [T.publikum.nurNdi], auswahlGesperrt: true, knopfGesperrt: true, grund: T.publikum.keinFensterNurNdi },
      { wert: UNBEKANNT, optionen: [UNBEKANNT], auswahlGesperrt: true, knopfGesperrt: true, grund: T.verschieben.unbekannt },
    ],
    'PS Leiste: die Auswahl zeigt die Wahl (sonst den gemessenen Bildschirm); „Auf diesen Bildschirm“ ist nur bei anderer Wahl bedienbar, sonst gesperrt mit title-Grund; bei nur NDI und unbekannter Liste gesperrt',
  );
}

// ── PS Auswahl merkt nur (B11): onChange der Bildschirmwahl ruft kein assignAudience; der Knopf ruft es ──
{
  const log: string[] = [];
  const props: ReferentLeisteProps = {
    stand: referentStand(),
    folien: referentFolien(),
    wahl: 22,
    uebersicht: false,
    referent: referentAttrappe(log),
    onNdi: (an) => void log.push(`ndi(${an})`),
    onGastPause: (an) => void log.push(`gastPause(${an})`),
    onWahl: (id) => void log.push(`wahl(${id})`),
    onVerschieben: () => void log.push('verschieben'),
    onUebersicht: (offen) => void log.push(`uebersicht(${offen})`),
  };
  const alle = elemente(ReferentLeiste(props));
  const auswahl = alle.find((e) => e.type === 'select');
  const ruf = (e: { props: Record<string, unknown> } | undefined, name: string, ...a: unknown[]): void => {
    const f = e?.props[name];
    if (typeof f === 'function') f(...a);
    else log.push(`fehlt:${name}`);
  };
  ruf(auswahl, 'onChange', { target: { value: '33' }, currentTarget: { value: '33' } });
  const nachWahl = [...log];
  const knopf = (k: string) => alle.find((e) => e.props.kennung === k);
  ruf(knopf('verschieben'), 'onClick');
  ruf(knopf('publikum-vollbild'), 'onClick');
  ruf(knopf('vollbild'), 'onClick');
  ruf(knopf('uebersicht'), 'onClick');
  ruf(alle.find((e) => e.type === SchleifenKnopf), 'onSchalten', true);
  gleich(nachWahl, ['wahl(33)'], 'PS Auswahl merkt nur: eine Wahl in der Leiste meldet nur die Wahl (kein assignAudience, keine Bewegung)');
  gleich(log.slice(1), ['verschieben', 'publikumVollbild', 'vollbild', 'uebersicht(true)', 'schleife(true)'], 'PS Auswahl merkt nur: „Auf diesen Bildschirm“ verschiebt; Publikum Vollbild, Vollbild, Übersicht und Schleife lösen ihre Aktion aus');
  const b: string[] = [];
  const mit = bildschirmBedienung(referentStand(), 33, (id) => void b.push(`setze(${id})`), (id) => void b.push(`verschiebe(${id})`));
  mit.onWahl(11);
  const nurGemerkt = [...b];
  mit.onVerschieben();
  bildschirmBedienung(referentStand(), 22, (id) => void b.push(`setze(${id})`), (id) => void b.push(`verschiebe(${id})`)).onVerschieben();
  bildschirmBedienung(referentStand({ bildschirme: bildschirme(null) }), 33, () => undefined, (id) => void b.push(`verschiebe(${id})`)).onVerschieben();
  gleich([nurGemerkt, b], [['setze(11)'], ['setze(11)', 'verschiebe(33)']], 'PS Auswahl merkt nur: die Wurzel merkt die Wahl nur; verschoben wird erst mit dem Knopf und nur ohne Sperrgrund (nicht auf denselben Bildschirm, nicht bei nur NDI)');
  const w = QUELLE('views/ReferentOberflaeche.tsx');
  ok(
    w.includes('bildschirmBedienung(stand, wahl, setGewaehlt, referent.verschieben)') && w.includes('referentWahl(gewaehlt, stand.bildschirme)') && !QUELLE('views/ReferentLeiste.tsx').includes('assignAudience'),
    'PS Auswahl merkt nur: Quelltext – die Wurzel verdrahtet Wahl und Knopf über bildschirmBedienung, die Leiste kennt assignAudience nicht',
  );
  ok(/verschieben: \(id\) => void preload\(\)\?\.present\?\.assignAudience\?\.\(id\)/.test(QUELLE('lib/useStand.ts')), 'PS Auswahl merkt nur: nur die Aktion verschieben ruft assignAudience');
}

// ── PS Verschieben-Grund (B11, Pflicht aus Task 9): Gründe rein abgeleitet, verschiebenMoeglich = kein Grund ──
{
  const liste = (l: 'unbekannt' | 'ohne' | 'mit') => (l === 'unbekannt' ? undefined : bildschirme(l === 'mit' ? 22 : null));
  const praes = (p: 'undefined' | 'aus' | 'laeuft') => (p === 'undefined' ? undefined : p === 'aus' ? { active: false, index: 0, total: 0, screen: 'live' as const } : laufend());
  const faelle = kreuz({ p: ['undefined', 'aus', 'laeuft'], liste: ['unbekannt', 'ohne', 'mit'], gewaehlt: [null, 22, 33, 99] } as const);
  const soll = (f: (typeof faelle)[number]): string | undefined => {
    if (f.p === 'undefined' || f.liste === 'unbekannt') return T.verschieben.unbekannt;
    if (f.p === 'laeuft' && f.liste === 'ohne') return T.publikum.keinFensterNurNdi;
    if (f.p === 'aus' || f.liste === 'ohne') return T.verschieben.keinFenster;
    if (f.gewaehlt === null) return T.verschieben.keineWahl;
    if (f.gewaehlt === 99) return SCREEN_TEXTE.bildschirmFehlt;
    return f.gewaehlt === 22 ? T.verschieben.gleich : undefined;
  };
  pruefeFaelle('PS Verschieben-Grund: Messung unbekannt, kein Publikumsfenster (nur NDI bzw. keine Präsentation), keine Wahl, Bildschirm fehlt, gleich dem gemessenen Bildschirm', faelle, (f) =>
    vergleiche(verschiebenGrund({ praesentation: praes(f.p), bildschirme: liste(f.liste) }, f.gewaehlt), soll(f)),
  );
  pruefeFaelle('PS Verschieben-Grund: verschiebenMoeglich genau dann, wenn kein Grund besteht', faelle, (f) =>
    vergleiche(String(verschiebenMoeglich({ praesentation: praes(f.p), bildschirme: liste(f.liste) }, f.gewaehlt)), String(soll(f) === undefined)),
  );
  ok(
    Object.values(T.verschieben).every((t) => typeof t === 'string' && t.trim() !== '' && !t.includes('"')) && new Set(Object.values(T.verschieben)).size === Object.values(T.verschieben).length,
    'PS Verschieben-Grund: Texte in PRESENTER_TEXTE.verschieben, verschieden, ohne ASCII-Anführungszeichen',
  );
  gleich(
    [referentWahl(undefined, bildschirme(22)), referentWahl(33, bildschirme(22)), referentWahl(99, bildschirme(22)), referentWahl(undefined, bildschirme(null)), referentWahl(33, bildschirme(null)), referentWahl(undefined, undefined), referentWahl(33, undefined)],
    [22, 33, 22, null, 33, null, null],
    'PS Verschieben-Grund: referentWahl = die gemerkte Wahl, solange sie in der Liste steht, sonst der gemessene Bildschirm; ohne Liste keine',
  );
}

// ── PS Referent-Aktionen: window.jmpr erst im Rückruf, jede Aktion ruft genau ihren alten Befehl ──
{
  const aufrufe: string[] = [];
  const g = globalThis as unknown as { window?: unknown };
  const merke = (name: string) => (...a: unknown[]) => (aufrufe.push(a.length === 0 ? name : `${name}(${a.map(String).join(',')})`), Promise.resolve(true));
  const leer = stand.referentAktionen?.();
  leer?.weiter();
  g.window = {
    jmpr: {
      present: {
        prev: merke('prev'), next: merke('next'), goto: merke('goto'), setScreen: merke('setScreen'), setSchleife: merke('setSchleife'),
        toggleAudienceFullscreen: merke('toggleAudienceFullscreen'), toggleReferentVollbild: merke('toggleReferentVollbild'), assignAudience: merke('assignAudience'), stop: merke('stop'),
      },
    },
  };
  try {
    const a = stand.referentAktionen?.();
    a?.zurueck();
    a?.weiter();
    a?.geheZu(2);
    a?.schwarz();
    a?.weiss();
    a?.schleife(true);
    a?.publikumVollbild();
    a?.vollbild();
    a?.verschieben(33);
    a?.beenden();
  } finally {
    delete g.window;
  }
  gleich(
    aufrufe,
    ['prev', 'next', 'goto(2)', 'setScreen(black)', 'setScreen(white)', 'setSchleife(true)', 'toggleAudienceFullscreen', 'toggleReferentVollbild', 'assignAudience(33)', 'stop'],
    'PS Referent-Aktionen: Zurück, Weiter, Gehe zu, Schwarz, Weiß, Schleife, Publikum Vollbild, Vollbild, Auf diesen Bildschirm und Beenden rufen ihre bisherigen Befehle (ohne window nichts, kein Wurf)',
  );
}

// ── PS Referent-Panel: ohne Ausgabe und Import, Sprungziele der Statusleiste, Panel offen schiebt den Inhalt ──
{
  const html = rahmen(referentStand(), { panelOffen: true });
  gleich([...html.matchAll(/id="einstellung-([^"]+)"/g)].map((m) => m[1]), ['ndi', 'fernsteuerung', 'handy', 'gast-klicker', 'timer'], 'PS Referent-Panel: ndi, fernsteuerung, handy, gast-klicker, timer – ohne ausgabe und import (B11)');
  ok(html.indexOf('data-presenter="live"') < html.indexOf('aria-label="Einstellungen"') && html.indexOf('</main>') < html.indexOf('aria-label="Einstellungen"'), 'PS Referent-Panel: der Live-Bereich bleibt gerendert, das Panel steht daneben');
  const eintraege = statusEintraege(rahmen());
  ok(eintraege.some(([id]) => id === 'publikum') && eintraege.some(([id]) => id === 'praesentation') && !/<button[^>]*data-status-id="publikum"/.test(rahmen()), 'PS Referent-Panel: die Statusleiste nennt das Publikum ohne Sprungziel (der Referent hat keinen Abschnitt ausgabe)');
}

// ── PS keine rohen Farben (Referent): nur Tokens; ausgenommen nur die schwarzen Folienflächen um SlideCanvas und das QR-Bild ──
{
  const roh = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow|accent)-(?:white|black|neutral|gray|grey|zinc|slate|stone|red|green|blue|yellow|amber|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b|#[0-9a-fA-F]{3,8}\b/;
  const ohneAusnahme = (d: string): string => {
    const q = QUELLE(d);
    if (d === 'components/RemotePanel.tsx') return q.replace(/\nfunction QrBild\([\s\S]*?\n}\n/, '\n');
    if (d === 'views/PresenterView.tsx') return q.replace("const FOLIENFLAECHE = 'bg-black';", '');
    return q;
  };
  const dateien = ['views/ReferentOberflaeche.tsx', 'views/ReferentLeiste.tsx', 'views/PresenterView.tsx', 'components/GastKlickerPille.tsx', 'components/TimerBar.tsx', 'components/Clock.tsx', 'components/RemotePanel.tsx', 'components/NdiSchalter.tsx'];
  gleich(dateien.filter((d) => roh.test(ohneAusnahme(d))), [], 'PS keine rohen Farben: Referent-Dateien nur mit Tokens (W2-9), der Referent bleibt trotzdem fest dunkel');
  const live = ROH('views/PresenterView.tsx');
  ok(
    live.includes("const FOLIENFLAECHE = 'bg-black';") && (QUELLE('views/PresenterView.tsx').match(/\bFOLIENFLAECHE\b/g) ?? []).length - 1 === (QUELLE('views/PresenterView.tsx').match(/<SlideCanvas\b/g) ?? []).length,
    'PS keine rohen Farben: schwarz bleibt nur die Folienfläche (FOLIENFLAECHE) um jede SlideCanvas (Programmfläche, B5)',
  );
  ok(!/AppShell|var\(--/.test(QUELLE('views/AudienceView.tsx')), 'PS keine rohen Farben: AudienceView bleibt Programmfläche ohne Rahmen und ohne Token-Umzug (B5)');
}

// ── PS Klicker bei fokussierter Auswahl im Panel (Gesamtprüfung UX Welle 2b, I2; B10, Review Focus 1): Das Panel hielt jede Taste aus
// einer Auswahl oder einem Feld an (panelTaste, stopPropagation), der USB-Klicker blieb tot, solange der Fokus nach einer Mauswahl auf
// „Netzwerkkarte“ oder im Gast-Link lag. Jetzt gibt der Referent über panelToolTasten jedes Ziel frei, das nach B10 kein Textfeld ist;
// in Textfeldern (Timer-Host, Port) gilt B10 weiter, Escape schließt weiter das Panel. Nachgespielt wird die echte Reihenfolge: erst
// der Hörer am Panel (React, Bubbling), dann usePresenterKeys am window, nur wenn das Panel die Taste nicht anhält ──
{
  const FELDER: Record<string, unknown> = {
    'Netzwerkkarte (Auswahl)': { tagName: 'SELECT' },
    'Gast-Link (schreibgeschützt)': { tagName: 'INPUT', type: 'text', readOnly: true },
    'Timer-Host (Text)': { tagName: 'INPUT', type: 'text' },
    'Port (Text)': { tagName: 'INPUT', type: 'text' },
  };
  const FREI = ['Netzwerkkarte (Auswahl)', 'Gast-Link (schreibgeschützt)'];
  const WIRKUNG: Record<string, string> = { PageDown: 'next', ArrowRight: 'next', PageUp: 'prev', ArrowLeft: 'prev', '.': 'setScreen(black)', b: 'setScreen(black)' };
  const imPanel = (key: string, target: unknown, toolTasten: ((z: unknown) => boolean) | undefined): string => {
    const { present, aufrufe } = presentAttrappe();
    let gestoppt = false;
    let verhindert = 0;
    let zu = 0;
    const e = {
      key,
      target: target as EventTarget | null,
      defaultPrevented: false,
      stopPropagation: () => void (gestoppt = true),
      preventDefault: () => {
        verhindert++;
        e.defaultPrevented = true;
      },
    };
    panelTaste(e, () => void zu++, toolTasten);
    if (!gestoppt) ob.verarbeiteTaste(e, present);
    return `${aufrufe.join(',') || '–'} / preventDefault ${verhindert}${zu > 0 ? ' / Panel zu' : ''}`;
  };
  const frei = (ob as Record<string, unknown>).referentPanelTasten as ((z: unknown) => boolean) | undefined;
  const faelle = kreuz({ feld: Object.keys(FELDER), taste: Object.keys(WIRKUNG) } as const);
  pruefeFaelle('PS Klicker bei fokussierter Auswahl im Panel: Bild↓/Bild↑/Pfeile und Schwarz blättern bzw. schalten aus Auswahl und schreibgeschütztem Feld; Textfelder behalten ihre Tasten (B10)', faelle, (f) => {
    if (typeof frei !== 'function') return 'referentPanelTasten fehlt';
    return vergleiche(imPanel(f.taste, FELDER[f.feld], frei), FREI.includes(f.feld) ? `${WIRKUNG[f.taste]} / preventDefault 1` : '– / preventDefault 0');
  });
  pruefeFaelle('PS Klicker bei fokussierter Auswahl im Panel: Escape schließt in jedem Feld nur das Panel, die Präsentation läuft weiter', Object.keys(FELDER).map((feld) => ({ feld })), (f) => {
    if (typeof frei !== 'function') return 'referentPanelTasten fehlt';
    return vergleiche(imPanel('Escape', FELDER[f.feld], frei), '– / preventDefault 1 / Panel zu');
  });
  const element = ReferentRahmen({
    stand: referentStand(),
    folien: referentFolien(),
    wahl: null,
    uebersicht: false,
    aktionen: aktionenAttrappe([], false),
    referent: referentAttrappe(),
    panelOffen: true,
    onPanel: () => undefined,
    onWahl: () => undefined,
    onVerschieben: () => undefined,
    onUebersicht: () => undefined,
  }) as unknown as { props: { panelToolTasten?: unknown } };
  ok(
    frei !== undefined && element.props.panelToolTasten === frei && !/panelToolTasten/.test(QUELLE('views/EditorOberflaeche.tsx')),
    'PS Klicker bei fokussierter Auswahl im Panel: der Referent gibt dem Rahmen referentPanelTasten (panelToolTasten), der Editor nicht (er hat keine Präsentations-Kürzel)',
  );
}

// ── PS Sperrgrund am Rahmen (Gesamtprüfung UX Welle 2b, M6; B11 „jede Taste mit Grund“, Review Focus 4): Chromium gibt gesperrten
// Knöpfen keine Mausereignisse; ein title am gesperrten Knopf kann darum unsichtbar bleiben (Connect setzt ihn deshalb an einen Rahmen,
// SlotEinstellungen MitTooltip). Vereinheitlicht ohne Messung (Ruling): Die Leistenknöpfe des Referenten tragen ihren Tooltip am
// umgebenden Rahmen, nie am Knopf – gesperrt oder nicht, damit sich das Markup beim Sperren nicht ändert ──
{
  const r = (s: OberflaechenStand, wahl?: number): string => bereich(leiste(rahmen(s, { wahl: referentWahl(wahl, s.bildschirme) })), 'data-presenter', 'leiste-rechts');
  const faelle = [
    { name: '„Auf diesen Bildschirm“ bei gleicher Wahl', html: r(referentStand()), kennung: 'verschieben', grund: T.verschieben.gleich },
    { name: '„Auf diesen Bildschirm“ bei unbekannter Liste', html: r(referentStand({ bildschirme: undefined })), kennung: 'verschieben', grund: T.verschieben.unbekannt },
    { name: '„Publikum Vollbild“ bei nur NDI', html: r(referentStand({ bildschirme: bildschirme(null) })), kennung: 'publikum-vollbild', grund: T.publikum.keinFensterNurNdi },
    { name: 'NDI vor der ersten Antwort', html: r(referentStand({ ndi: undefined })), kennung: 'ndi', grund: T.grund.zustandOffen },
  ];
  pruefeFaelle('PS Sperrgrund am Rahmen: jeder gesperrte Leistenknopf mit Grund trägt den Grund als title am Rahmen, nicht am gesperrten Knopf', faelle, (f) => {
    const knopf = knopfIn(f.html, f.kennung);
    const rahmenTag = rahmenVon(f.html, f.kennung);
    if (!gesperrt(knopf)) return 'Knopf nicht gesperrt';
    if (attr(knopf, 'title') !== undefined) return `title am gesperrten Knopf: ${attr(knopf, 'title')}`;
    if (rahmenTag === undefined) return 'kein Rahmen';
    return vergleiche(attr(rahmenTag, 'title') ?? '–', f.grund);
  });
  const frei = r(referentStand(), 33);
  ok(
    ['verschieben', 'publikum-vollbild', 'vollbild', 'uebersicht', 'ndi'].every((k) => rahmenVon(frei, k) !== undefined && attr(knopfIn(frei, k), 'title') === undefined) &&
      tooltip(frei, 'verschieben') === undefined && tooltip(frei, 'ndi') === T.ndi.tipp,
    'PS Sperrgrund am Rahmen: auch freigegeben stehen die Leistenknöpfe und NDI im Rahmen (gleiches Markup), ohne Sperrgrund ohne title bzw. mit dem alten Tipp',
  );
}

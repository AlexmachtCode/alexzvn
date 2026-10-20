// P4 · Sprechblase mit Hervorhebung (Spec 3, 3.1, 7; Plan EP10, EP11, EP18, G6, G7): DOM-Helfer mit Attrappen (findeZiel,
// blasenPlatz als Kreuz, anleitungTaste, fokusInBlase, blasenTaste und blasenFokus als Körper von Tasten-Handler und
// Fokus-Effekt), Bedienleiste genau nach `knoepfe`, Render ohne DOM (Dialog nicht modal, ids, aria-live, Zähler, Abdunkeln,
// Ziel fehlt, Produktion, Stimme), Texte U1–U37 wörtlich, Kontrast der Hervorhebung über der Abdunkelung.
import * as ui from '../src/index';
import { AnleitungsBlase, AnleitungsSchicht, bedienKnoepfe, type AnleitungsStimme } from '../src/components/AnleitungsSchicht';
import type { AnleitungsAnsicht, AnleitungsEreignis, BlasenAnsicht } from '../src/lib/anleitung';
import {
  BLASEN_GROESSE,
  ZIEL_ATTRIBUT,
  anleitungTaste,
  blasenFokus,
  blasenPlatz,
  blasenTaste,
  findeZiel,
  fokusInBlase,
  gleichesRechteck,
  type Rechteck,
  type ZielElement,
  type ZielWurzel,
} from '../src/lib/anleitung-dom';
import { ANLEITUNG_TEXTE } from '../src/lib/texte';
import { gleich, leseText, ok, pruefeIdVerweise, render } from './harness';
import { kreuz, pruefeFaelle, vergleiche } from './lib/kreuz';
import { attr, hatKlassen, klassen, ohneVersteckt, tags, text } from './lib/markup';
import { kontrast, loese, mische, modusTabelle, parseFarbe, type Rgb } from './lib/oklch';

const nichts = (): void => undefined;

// ── findeZiel mit Attrappen (EP10: erste sichtbare Instanz, nie ins Leere) ──
{
  const FENSTER = { breite: 980, hoehe: 640 };
  const el = (left: number, top: number, width: number, height: number): ZielElement => ({ getBoundingClientRect: () => ({ left, top, width, height }) });
  const gesehen: string[] = [];
  const wurzel = (elemente: ZielElement[]): ZielWurzel => ({
    querySelectorAll: (s) => {
      gesehen.push(s);
      return elemente;
    },
  });
  gleich(
    [
      findeZiel(null, 'kopf.einstellungen', FENSTER),
      findeZiel(wurzel([]), 'kopf.einstellungen', FENSTER),
      findeZiel(wurzel([el(10, 10, 0, 32)]), 'kopf.einstellungen', FENSTER),
      findeZiel(wurzel([el(1000, 10, 40, 32)]), 'kopf.einstellungen', FENSTER),
      findeZiel(wurzel([el(10, -50, 40, 40)]), 'kopf.einstellungen', FENSTER),
      findeZiel(wurzel([el(0, 0, 0, 0), el(10, 20, 30, 40)]), 'kopf.einstellungen', FENSTER),
    ],
    [null, null, null, null, null, { x: 10, y: 20, breite: 30, hoehe: 40 }],
    'P4 7: findeZiel (Wurzel null, kein Element, Fläche 0, außerhalb, oberhalb, zweites sichtbar)',
  );
  gleich(gesehen[0], `[${ZIEL_ATTRIBUT}="kopf.einstellungen"]`, 'P4 EP10: Selektor [data-anleitung="…"]');
  const vorher = gesehen.length;
  ok(findeZiel(wurzel([el(10, 20, 30, 40)]), 'kopf"]', FENSTER) === null && gesehen.length === vorher, 'P4 EP10: ungültige Kennung → null, ohne Abfrage');
  gleich(
    [gleichesRechteck(null, null), gleichesRechteck(null, { x: 0, y: 0, breite: 1, hoehe: 1 }), gleichesRechteck({ x: 1, y: 2, breite: 3, hoehe: 4 }, { x: 1, y: 2, breite: 3, hoehe: 4 })],
    [true, false, true],
    'P4: gleichesRechteck',
  );
}

// ── blasenPlatz als Kreuz (EP11: nie außerhalb, nie über dem Ziel, Mitte ohne Ziel) ──
{
  const K = kreuz({
    fenster: [
      { breite: 980, hoehe: 640 },
      { breite: 1280, hoehe: 860 },
    ],
    zx: ['links', 'mitte', 'rechts'],
    zy: ['oben', 'mitte', 'unten'],
  });
  pruefeFaelle('P4 7: blasenPlatz für Zielposition (9) × Fenster (980×640, 1280×860): im Fenster, nie über dem Ziel', K, (c) => {
    const { breite, hoehe } = c.fenster;
    const ziel: Rechteck = {
      x: c.zx === 'links' ? 8 : c.zx === 'mitte' ? (breite - 120) / 2 : breite - 128,
      y: c.zy === 'oben' ? 6 : c.zy === 'mitte' ? (hoehe - 32) / 2 : hoehe - 40,
      breite: 120,
      hoehe: 32,
    };
    const p = blasenPlatz(ziel, c.fenster, BLASEN_GROESSE);
    const b = BLASEN_GROESSE;
    const drin = p.x >= 0 && p.y >= 0 && p.x + b.breite <= breite && p.y + b.hoehe <= hoehe;
    const ueber = p.x < ziel.x + ziel.breite && ziel.x < p.x + b.breite && p.y < ziel.y + ziel.hoehe && ziel.y < p.y + b.hoehe;
    return drin && !ueber && p.seite !== 'mitte' ? null : `ist: ${JSON.stringify(p)} drin=${drin} ueber=${ueber}`;
  });
  gleich(blasenPlatz(null, { breite: 980, hoehe: 640 }, BLASEN_GROESSE), { x: 310, y: 170, seite: 'mitte' }, 'P4 EP11: ohne Ziel in der Mitte');
}

// ── Tasten und Fokus (Spec 3, EP18) ──
{
  gleich(
    [
      anleitungTaste({ key: 'Escape', defaultPrevented: false }),
      anleitungTaste({ key: 'Escape', defaultPrevented: true }),
      anleitungTaste({ key: 'Enter', defaultPrevented: false }),
      anleitungTaste({ key: 'Tab', defaultPrevented: false }),
      anleitungTaste({ key: ' ', defaultPrevented: false }),
    ],
    ['spaeter', null, null, null, null],
    'P4 3: Escape = Später weiter, nicht wenn die Taste schon jemandem gehört; Enter und Tab bleiben nativ',
  );
  const K = kreuz({ grund: ['geoeffnet', 'bedienung', 'erkannt'] as const, drin: [false, true] });
  pruefeFaelle('P4 EP18: fokusInBlase (Öffnen und Bedienen holen den Fokus, Erkennen stiehlt ihn nie)', K, (c) =>
    vergleiche(String(fokusInBlase(c.grund, c.drin)), String(c.grund !== 'erkannt' || c.drin)),
  );
  // Körper des Tasten-Handlers mit einer Ereignis-Attrappe, die stopPropagation, preventDefault und das Ereignis protokolliert
  // (Review Focus 6: Verbund- und System-Dialog hören Escape auf window; nur stopPropagation hält es von ihnen fern).
  const TASTE = kreuz({ key: ['Escape', 'Enter', 'Tab'], vergeben: [false, true], angeboten: [false, true] });
  pruefeFaelle('P4 3, EP18: blasenTaste – Escape mit angebotenem „Später weiter“ hält die Taste und meldet spaeter, sonst nichts', TASTE, (c) => {
    const protokoll: string[] = [];
    const e = { key: c.key, defaultPrevented: c.vergeben, stopPropagation: () => protokoll.push('stop'), preventDefault: () => protokoll.push('prevent') };
    const gefangen = blasenTaste(e, c.angeboten, (x: AnleitungsEreignis) => protokoll.push(x.art));
    const soll = c.key === 'Escape' && !c.vergeben && c.angeboten;
    return vergleiche(`${gefangen} ${protokoll.join(',')}`, soll ? 'true stop,prevent,spaeter' : 'false ');
  });
  // Körper des Fokus-Effekts mit einer Element-Attrappe: Erkennen stiehlt den Fokus nie (EP18).
  const FOKUS = kreuz({ grund: ['geoeffnet', 'bedienung', 'erkannt'] as const, drin: [false, true], element: [false, true] });
  pruefeFaelle('P4 EP18: blasenFokus – fokussiert nur bei Öffnen, Bedienen oder Fokus schon in der Blase, nie ohne Element', FOKUS, (c) => {
    const protokoll: string[] = [];
    const aktiv = { name: 'aktives Element' };
    const el = c.element ? { contains: (x: unknown) => c.drin && x === aktiv, focus: (o: { preventScroll: boolean }) => protokoll.push(`focus ${o.preventScroll}`) } : null;
    const geholt = blasenFokus(el, aktiv, c.grund);
    const soll = c.element && (c.grund !== 'erkannt' || c.drin);
    return vergleiche(`${geholt} ${protokoll.join(',')}`, soll ? 'true focus true' : 'false ');
  });
  // Verdrahtung in der Sprechblase (Quelltext; renderToStaticMarkup ruft weder Handler noch Effekte).
  const schicht = leseText('src/components/AnleitungsSchicht.tsx');
  ok(
    schicht.includes('onKeyDown={(e) => blasenTaste(e, blase.knoepfe.spaeter, ereignis)}') &&
      schicht.includes('blasenFokus(blaseRef.current, document.activeElement, grund.current);') &&
      !schicht.includes('.focus('),
    'P4 EP18: die Sprechblase verdrahtet Escape über blasenTaste und den Fokus über blasenFokus (kein eigenes focus())',
  );
}

// ── Bedienleiste genau nach knoepfe (Spec 3.1) ──
const BLASE: BlasenAnsicht = {
  art: 'handeln',
  kapitel: { id: 'k2', titel: 'Tools installieren' },
  zaehler: { n: 2, m: 6 },
  text: 'Wähle ein Tool und klicke auf „Installieren“.',
  ziel: 'werkzeugkasten.installieren',
  zielFehlt: null,
  wiederfinden: null,
  nurZeigen: false,
  produktionsWarnung: false,
  wartetAufNeustart: false,
  knoepfe: { zurueck: true, weiter: false, ueberspringen: true, spaeter: true, brauchtNicht: true, anleitungUeberspringen: false, jaUeberspringen: false },
  optionen: [],
  ansage: { id: 'k2.installieren', spielen: true, hinweis: null },
};
{
  const NAMEN = ['zurueck', 'weiter', 'jaUeberspringen', 'anleitungUeberspringen', 'ueberspringen', 'brauchtNicht', 'spaeter'] as const;
  const K = kreuz({ zurueck: [false, true], weiter: [false, true], ueberspringen: [false, true], spaeter: [false, true], brauchtNicht: [false, true], anleitungUeberspringen: [false, true], jaUeberspringen: [false, true] });
  pruefeFaelle('P4 3.1: bedienKnoepfe zeigt genau die angebotenen Knöpfe in fester Reihenfolge', K, (c) =>
    vergleiche(bedienKnoepfe({ ...BLASE, knoepfe: c }).map((k) => k.name).join(','), NAMEN.filter((n) => c[n]).join(',')),
  );
  const alle = { zurueck: true, weiter: true, ueberspringen: true, spaeter: true, brauchtNicht: true, anleitungUeberspringen: true, jaUeberspringen: true };
  gleich(
    bedienKnoepfe({ ...BLASE, knoepfe: alle }).map((k) => [k.name, k.text, JSON.stringify(k.ereignis)]),
    [
      ['zurueck', 'Zurück', '{"art":"zurueck"}'],
      ['weiter', 'Weiter', '{"art":"weiter"}'],
      ['jaUeberspringen', 'Ja, überspringen', '{"art":"beenden"}'],
      ['anleitungUeberspringen', 'Anleitung überspringen', '{"art":"anleitungUeberspringen"}'],
      ['ueberspringen', 'Überspringen', '{"art":"ueberspringen"}'],
      ['brauchtNicht', 'Brauche ich nicht', '{"art":"brauchtNicht","kapitel":"k2"}'],
      ['spaeter', 'Später weiter', '{"art":"spaeter"}'],
    ],
    'P4 3.1: Texte und Ereignisse der Knöpfe (Ja, überspringen = beenden; Brauche ich nicht mit Kapitel)',
  );
  ok(bedienKnoepfe({ ...BLASE, art: 'rueckfrage', kapitel: null, knoepfe: { ...alle } })[0].text === 'Zurück zur Anleitung', 'P4 4: auf der Rückfrage heißt Zurück „Zurück zur Anleitung“');
}

// ── Render ohne DOM ──
const STIMME: AnleitungsStimme = { vorhanden: true, an: true, fehler: null, umschalten: nichts, trotzdemAn: nichts };
const ZIEL: Rechteck = { x: 600, y: 120, breite: 120, hoehe: 32 };
const ansicht = (b: Partial<BlasenAnsicht> | null): AnleitungsAnsicht => ({
  blase: b === null ? null : { ...BLASE, ...b },
  kapitel: [],
  fortsetzen: null,
  hauptknopf: 'starten',
  titel: 'Einrichtung',
  abgeschlossen: false,
  beendet: false,
});
function blase(b: Partial<BlasenAnsicht>, extra: { zielRechteck?: Rechteck | null; stimme?: Partial<AnleitungsStimme> } = {}): string {
  return render(
    <AnleitungsBlase
      ansicht={ansicht(b)}
      aufEreignis={nichts}
      className="fixed inset-0 z-[65]"
      stimme={{ ...STIMME, ...extra.stimme }}
      zielRechteck={extra.zielRechteck === undefined ? ZIEL : extra.zielRechteck}
      fenster={{ breite: 980, hoehe: 640 }}
    />,
  );
}
const dialog = (html: string): string => tags(html, 'div').find((t) => attr(t, 'role') === 'dialog') ?? '';
{
  const html = blase({});
  const d = dialog(html);
  ok(
    attr(d, 'aria-modal') === 'false' && attr(d, 'tabindex') === '-1' && attr(d, 'aria-labelledby') !== undefined && attr(d, 'aria-describedby') !== undefined,
    'P4 3: Sprechblase role="dialog" aria-modal="false" tabindex="-1" mit aria-labelledby und aria-describedby',
  );
  pruefeIdVerweise(html, 'P4 3: aria-labelledby und aria-describedby zeigen auf vorhandene ids');
  const live = tags(html, 'div').find((t) => attr(t, 'aria-live') === 'polite');
  ok(live !== undefined && attr(live, 'role') === 'status', 'P4 EP18: neuer Text kommt über role="status" aria-live="polite"');
  ok(text(html).includes('Tools installieren') && text(html).includes('Schritt 2 von 6'), 'P4 3: Kopf mit Kapitel und Zähler „Schritt 2 von 6“ (U13)');
  gleich(
    tags(html, 'button').map((t) => attr(t, 'data-knopf')),
    ['zurueck', 'ueberspringen', 'brauchtNicht', 'spaeter', 'stimme'],
    'P4 3.1: gerenderte Knöpfe genau nach knoepfe, dazu der Stimmen-Schalter',
  );
  const aussen = tags(html, 'div')[0];
  ok(
    hatKlassen(aussen, 'fixed inset-0 z-[65] pointer-events-none') &&
      tags(html, 'div').filter((t) => klassen(t).includes('pointer-events-auto')).length === 1 &&
      klassen(d).includes('pointer-events-auto'),
    'P4 EP11: className der App am äußeren Container, nur die Sprechblase nimmt Klicks an',
  );
  const hervor = tags(html, 'div').find((t) => attr(t, 'data-abdunkeln') === 'ziel') ?? '';
  ok(
    hatKlassen(hervor, 'outline-[var(--tally-selected)] ring-[9999px] ring-[var(--background)]/70') &&
      (attr(hervor, 'style') ?? '').includes('left:600px') &&
      !html.includes('data-abdunkeln="flaeche"'),
    'P4 EP11: Ziel da → Rand in --tally-selected, außen 70 % --background, keine Vollfläche',
  );
}
{
  const ohneZiel = blase({ ziel: null, art: 'entscheiden', optionen: [{ knopf: 'Ja' }, { knopf: 'Nein' }] });
  ok(
    ohneZiel.includes('data-abdunkeln="flaeche"') &&
      !ohneZiel.includes('data-abdunkeln="ziel"') &&
      tags(ohneZiel, 'button').filter((t) => attr(t, 'data-option') !== undefined).length === 2,
    'P4 EP11: ohne Ziel ganzflächig abgedunkelt; Optionen als Knöpfe',
  );
  const fehlt = blase({}, { zielRechteck: null });
  const fehltMit = blase({ zielFehlt: 'Öffne zuerst den Reiter „Werkzeugkasten“.' }, { zielRechteck: null });
  ok(
    !fehlt.includes('data-abdunkeln') && text(fehlt).includes('Das Bedienelement ist gerade nicht zu sehen.') && text(fehltMit).includes('Öffne zuerst den Reiter „Werkzeugkasten“.') && !text(fehltMit).includes('gerade nicht zu sehen'),
    'P4 7: Ziel fehlt → kein Abdunkeln, U17 bzw. der Text des Schritts',
  );
  const prod = blase({ produktionsWarnung: true, nurZeigen: true, ansage: { id: 'k2.installieren', spielen: false, hinweis: 'produktion' } });
  ok(
    text(prod).includes(ANLEITUNG_TEXTE.produktion) &&
      text(ohneVersteckt(prod)).includes('Warnung: ') &&
      text(prod).includes('Nur zeigen') &&
      text(prod).includes(ANLEITUNG_TEXTE.stimmeProduktion) &&
      tags(prod, 'button').some((t) => attr(t, 'data-knopf') === 'stimme-trotzdem'),
    'P4 7: Produktion → U18 mit Symbol und Wort, Nur zeigen, U21 und Knopf U22',
  );
  const eingriff = text(blase({ text: 'Öffne jetzt deine Show.', produktionsWarnung: true, nurZeigen: true, ansage: { id: 'k6.oeffnen', spielen: false, hinweis: 'eingriff' } }));
  const eingriffHtml = blase({ produktionsWarnung: true, nurZeigen: true, ansage: { id: 'k6.oeffnen', spielen: false, hinweis: 'eingriff' } });
  ok(
    eingriff.includes(ANLEITUNG_TEXTE.produktion) &&
      eingriff.indexOf(ANLEITUNG_TEXTE.produktion) < eingriff.indexOf('Öffne jetzt deine Show.') &&
      eingriff.includes(ANLEITUNG_TEXTE.stimmeProduktion) &&
      !tags(eingriffHtml, 'button').some((t) => attr(t, 'data-knopf') === 'stimme-trotzdem' || attr(t, 'data-knopf') === 'stimme'),
    'P4 7: Eingriff in der Produktion warnt vor dem Text (U18 zuerst) und bleibt still: U21 ohne „Stimme trotzdem an“',
  );
  const STIMMEN: Array<[BlasenAnsicht['ansage']['hinweis'], string]> = [
    [null, 'Stimme aus'],
    ['aus', 'Stimme an'],
    ['keineStimme', 'In dieser Fassung gibt es keine Stimme.'],
  ];
  ok(
    STIMMEN.every(([hinweis, soll]) => text(blase({ ansage: { id: 'x', spielen: hinweis === null, hinweis } })).includes(soll)),
    'P4 6: Stimmen-Zeile je Hinweis (U20, U19, U36)',
  );
  // Kreuz Hinweis (5) × Fehler der Ansage (3): die Stimmen-Zeile zeigt GENAU die Texte und Knöpfe des Zustands, nie einen mehr
  // (Owner: Stimme an/aus in jedem Zustand erreichbar, wo sie es sein darf; G7; Launcher 0.17.0 läuft nur im Zustand keineStimme).
  {
    type Hinweis = BlasenAnsicht['ansage']['hinweis'];
    const SOLL: Record<'null' | 'aus' | 'keineStimme' | 'produktion' | 'eingriff', { knoepfe: string[]; texte: string[] }> = {
      null: { knoepfe: ['stimme'], texte: ['Stimme aus'] },
      aus: { knoepfe: ['stimme'], texte: ['Stimme an'] },
      keineStimme: { knoepfe: [], texte: [ANLEITUNG_TEXTE.keineStimme] },
      produktion: { knoepfe: ['stimme-trotzdem'], texte: [ANLEITUNG_TEXTE.stimmeProduktion, ANLEITUNG_TEXTE.stimmeTrotzdem] },
      eingriff: { knoepfe: [], texte: [ANLEITUNG_TEXTE.stimmeProduktion] },
    };
    const ALLE_TEXTE = [
      'Stimme aus', 'Stimme an', ANLEITUNG_TEXTE.keineStimme, ANLEITUNG_TEXTE.stimmeProduktion, ANLEITUNG_TEXTE.stimmeTrotzdem, ANLEITUNG_TEXTE.ansageFehlt, ANLEITUNG_TEXTE.ansageFehler,
    ];
    const FEHLERTEXT = { fehlt: ANLEITUNG_TEXTE.ansageFehlt, abspielen: ANLEITUNG_TEXTE.ansageFehler };
    const K = kreuz({ hinweis: ['null', 'aus', 'keineStimme', 'produktion', 'eingriff'] as const, fehler: [null, 'fehlt', 'abspielen'] as const });
    pruefeFaelle('P4 6, G7: Stimmen-Zeile für Hinweis (5) × Fehler der Ansage (3): genau die Knöpfe und Texte des Zustands', K, (c) => {
      const hinweis: Hinweis = c.hinweis === 'null' ? null : c.hinweis;
      const html = blase({ ansage: { id: 'x', spielen: hinweis === null, hinweis } }, { stimme: { fehler: c.fehler } });
      const knoepfe = tags(html, 'button')
        .map((t) => attr(t, 'data-knopf'))
        .filter((n): n is string => n === 'stimme' || n === 'stimme-trotzdem');
      const soll = SOLL[c.hinweis];
      const sollTexte = c.fehler === null ? soll.texte : [...soll.texte, FEHLERTEXT[c.fehler]];
      const gezeigt = text(html);
      const ist = ALLE_TEXTE.filter((t) => gezeigt.includes(t));
      return vergleiche(
        JSON.stringify([knoepfe, ist.slice().sort()]),
        JSON.stringify([soll.knoepfe, sollTexte.slice().sort()]),
      );
    });
  }
  gleich(
    [text(blase({}, { stimme: { fehler: 'fehlt' } })).includes(ANLEITUNG_TEXTE.ansageFehlt), text(blase({}, { stimme: { fehler: 'abspielen' } })).includes(ANLEITUNG_TEXTE.ansageFehler), blase({}).includes('data-hinweis="ansage"')],
    [true, true, false],
    'P4 G7: Ansage fehlt (U23) oder scheitert (U24) wird angezeigt, sonst nichts',
  );
  // Der Screenreader hört die Produktionswarnung VOR der Aufforderung: aria-describedby nennt Warnung, Text, Ziel-fehlt und
  // „Wartet auf den Neustart“ in dieser Reihenfolge (Spec 7: warnen vorher). Die Live-Region sagt ihren Anfangsinhalt nicht an.
  {
    const K = kreuz({ warnung: [false, true], zielFehlt: [false, true], neustart: [false, true] });
    pruefeFaelle('P4 7, EP18: aria-describedby = Warnung, Text, Ziel fehlt, Neustart (nur was da ist, in dieser Reihenfolge)', K, (c) => {
      const html = blase({ produktionsWarnung: c.warnung, nurZeigen: c.warnung, wartetAufNeustart: c.neustart }, { zielRechteck: c.zielFehlt ? null : ZIEL });
      const d = dialog(html);
      const ids = (attr(d, 'aria-describedby') ?? '').split(' ').filter(Boolean);
      const namen = ids.map((i) => ['warnung', 'text', 'ziel-fehlt', 'neustart'].find((n) => i.endsWith('-' + n)) ?? i);
      const soll = [c.warnung ? 'warnung' : null, 'text', c.zielFehlt ? 'ziel-fehlt' : null, c.neustart ? 'neustart' : null].filter((n) => n !== null);
      const imText = ids.every((i) => html.includes(`id="${i}"`));
      return vergleiche(JSON.stringify(namen) + imText, JSON.stringify(soll) + true);
    });
    const html = blase({ produktionsWarnung: true, nurZeigen: true, wartetAufNeustart: true }, { zielRechteck: null });
    const pos = (s: string): number => html.indexOf(s);
    const ids = (attr(dialog(html), 'aria-describedby') ?? '').split(' ');
    ok(
      ids.length === 4 && ids.every((i, n) => n === 0 || pos(`id="${ids[n - 1]}"`) < pos(`id="${i}"`)),
      'P4 7: die ids in aria-describedby stehen im Dokument in derselben Reihenfolge (Warnung vor Text)',
    );
  }
  const erledigt = blase({ art: 'schonErledigt', wiederfinden: 'Übersprungenes findest du oben.', wartetAufNeustart: true });
  ok(
    text(erledigt).includes('Schon erledigt') && text(erledigt).includes('Übersprungenes findest du oben.') && text(erledigt).includes(ANLEITUNG_TEXTE.neustartWartet),
    'P4 3.1: Schon erledigt (U15), Hinweis wiederfinden und Warten auf den Neustart (U33)',
  );
  const einleitung = blase({ art: 'einleitung', kapitel: null, zaehler: null, ziel: null });
  pruefeIdVerweise(einleitung, 'P4 3: ohne Kapitel beschriftet der Text die Sprechblase');
  ok(render(<AnleitungsSchicht ansicht={ansicht(null)} aufEreignis={nichts} className="fixed inset-0" stimme={STIMME} />) === '', 'P4 A1: ohne Sprechblase rendert die Schicht nichts');
  const ssr = render(<AnleitungsSchicht ansicht={ansicht({})} aufEreignis={nichts} className="fixed inset-0" stimme={STIMME} />);
  ok(text(ssr).includes(ANLEITUNG_TEXTE.zielFehlt) && !ssr.includes('data-abdunkeln'), 'P4 7: vor der ersten Messung (ohne DOM) zeigt die Schicht ehrlich „nicht zu sehen“');
}

// ── Texte U1–U37 wörtlich (Texttabelle 9.2; U11, U12, U34 mit dem Titel der Einrichtung) ──
{
  const T = ANLEITUNG_TEXTE;
  gleich(
    [
      T.zurueck, T.weiter, T.ueberspringen, T.spaeter, T.brauchtNicht, T.dochGebraucht, T.zeigMir, T.anleitungUeberspringen, T.jaUeberspringen,
      T.zurAnleitung, T.starten('Einrichtung'), T.fortsetzen('Einrichtung', 3, 6), T.zaehler(3, 6), T.beenden, T.schonErledigt, T.nurZeigen, T.zielFehlt, T.produktion,
      T.stimmeAn, T.stimmeAus, T.stimmeProduktion, T.stimmeTrotzdem, T.ansageFehlt, T.ansageFehler, T.speicherNichtLesbar,
      T.speicherNichtSchreibbar, T.speicherKaputt, T.speicherNeuer, T.zustand.erledigt, T.zustand.nichtGebraucht, T.zustand.uebersprungen,
      T.zustand.offen, T.neustartWartet, T.abgeschlossen('Einrichtung'), T.fertig, T.keineStimme, T.beendet,
    ],
    [
      'Zurück', 'Weiter', 'Überspringen', 'Später weiter', 'Brauche ich nicht', 'Doch gebraucht', 'Zeig mir', 'Anleitung überspringen', 'Ja, überspringen',
      'Zurück zur Anleitung', 'Einrichtung starten', 'Einrichtung fortsetzen · Schritt 3 von 6', 'Schritt 3 von 6', 'Anleitung beenden', 'Schon erledigt',
      'Nur zeigen', 'Das Bedienelement ist gerade nicht zu sehen.',
      'Gerade läuft eine Produktion. Ich zeige dir nur, wo es ist; mach es, wenn die Produktion vorbei ist.',
      'Stimme an', 'Stimme aus', 'Die Stimme ist aus, weil gerade eine Produktion läuft.', 'Stimme trotzdem an', 'Zu diesem Text gibt es keine Ansage.',
      'Die Ansage konnte nicht abgespielt werden.',
      'Der Fortschritt kann auf diesem Rechner nicht gelesen werden. Die Anleitung startet deshalb nicht von selbst.',
      'Der Fortschritt kann auf diesem Rechner nicht gemerkt werden.', 'Der gemerkte Fortschritt war unlesbar; die Anleitung beginnt neu.',
      'Der Fortschritt stammt von einer neueren Fassung und bleibt unverändert.', 'erledigt', 'nicht gebraucht', 'übersprungen', 'offen',
      'Wartet auf den Neustart.', 'Einrichtung abgeschlossen', 'Fertig', 'In dieser Fassung gibt es keine Stimme.',
      'Anleitung beendet. Offene Schritte kannst du hier einzeln mit „Zeig mir“ ansehen.',
    ],
    'P4 G2: Texte U1–U37 wörtlich aus der Texttabelle',
  );
  gleich(
    [T.starten('Titler-Einführung'), T.fortsetzen('Titler-Einführung', 2, 5), T.abgeschlossen('Titler-Einführung')],
    ['Titler-Einführung starten', 'Titler-Einführung fortsetzen · Schritt 2 von 5', 'Titler-Einführung abgeschlossen'],
    'P4 Spec 2: U11, U12 und U34 nehmen den Titel der Anleitung (das Gerüst trägt keinen Text einer bestimmten Anleitung)',
  );
  const texte: string[] = [];
  const sammle = (w: unknown): void => {
    if (typeof w === 'string') texte.push(w);
    else if (typeof w === 'function') {
      const f = w as (...a: Array<string | number>) => string;
      texte.push(f.length === 3 ? f('Titel', 1, 2) : f.length === 2 ? f(1, 2) : f('Titel'));
    } else if (w !== null && typeof w === 'object') Object.values(w).forEach(sammle);
  };
  sammle(T);
  ok(
    texte.length === 37 && texte.every((x) => !x.includes('"') && !/Einrichtung|Launcher/.test(x)),
    'P4 G2, Spec 2: 37 Texte in ANLEITUNG_TEXTE, keine ASCII-Anführungszeichen, kein Wort einer bestimmten Anleitung (Einrichtung, Launcher)',
  );
}

// ── Kontrast der Hervorhebung über der Abdunkelung (EP11: Grafik ≥ 3 : 1) ──
{
  for (const modus of ['dunkel', 'hell'] as const) {
    const t = modusTabelle(modus);
    const farbe = (name: string): { rgb: Rgb; alpha: number } => {
      const f = parseFarbe(loese(name, t));
      if (f === null) throw new Error(`keine Farbe: ${name}`);
      return f;
    };
    const hintergrund = farbe('--background').rgb;
    const flaeche = (name: string): Rgb => {
      const f = farbe(name);
      return f.alpha >= 1 ? f.rgb : mische(f.rgb, f.alpha, hintergrund);
    };
    const werte = ['--background', '--card', '--surface-raised'].map((unter) => kontrast(farbe('--tally-selected').rgb, mische(hintergrund, 0.7, flaeche(unter))));
    ok(
      werte.every((w) => w >= 3),
      `P4 EP11 ${modus}: --tally-selected über 70 % --background auf --background, --card, --surface-raised ≥ 3 · ${werte.map((w) => w.toFixed(2).replace('.', ',')).join(' / ')}`,
    );
  }
}

// ── Hook und Exporte ──
{
  const hook = leseText('src/lib/useAnleitungsZiel.ts');
  ok(
    hook.includes('useEffect(') && hook.includes('window.clearInterval(takt)') && hook.includes("window.removeEventListener('resize', messen)") && hook.includes('findeZiel(document, kennung'),
    'P4 EP11: useAnleitungsZiel misst im Effekt über findeZiel und räumt Takt und Abo auf',
  );
  ok(
    typeof ui.AnleitungsSchicht === 'function' && typeof ui.useAnleitungsZiel === 'function' && ui.ANLEITUNG_TEXTE.weiter === 'Weiter',
    'P4: Exporte aus src/index.ts (AnleitungsSchicht, useAnleitungsZiel, ANLEITUNG_TEXTE)',
  );
}

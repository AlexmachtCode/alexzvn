// P5 · Kapitelübersicht, Kapitelzeichen und Ansage (Spec 3.1, 4, 6; Plan EP20, EP21, EP22, G7): Zeile je Kapitelzustand ×
// Knöpfe als Kreuz (Symbol aria-hidden, Wort sr-only, Haken nur bei erledigt), Hauptknopf U11/U12 mit dem Titel der
// Anleitung, abgeschlossen (U34) nur bei allem erledigt, sonst beendet (U37), Knopfnamen mit dem Kapitel, Diagnosezeile genau
// bei Speicherhinweis, Stimme mit Namensnennung, Details und Aktionen der App, Ansage als reiner Effekt-Körper mit Attrappe.
import * as ui from '../src/index';
import { AnleitungsUebersicht, type AnleitungsUebersichtProps } from '../src/components/AnleitungsUebersicht';
import { anleitungAnsicht, type AnleitungsAnsicht, type KapitelZeile, type KapitelZustand } from '../src/lib/anleitung';
import { KAPITEL_SYMBOL, KAPITEL_SYMBOL_KLASSE } from '../src/lib/status';
import { ANLEITUNG_TEXTE } from '../src/lib/texte';
import { ansageFehlerFuer, ansageStand, starteAnsage, type Abspieler, type AnsageFehler } from '../src/lib/useAnsage';
import { TEST_ANLEITUNG, fortschritt } from './anleitung-format.test';
import { gleich, leseText, ok, pruefeIdVerweise, render } from './harness';
import { kreuz, pruefeFaelle, vergleiche } from './lib/kreuz';
import { attr, ohneVersteckt, tags, text } from './lib/markup';

const nichts = (): void => undefined;

// ── Kapitelzeichen (Spec 3.1: Haken nur bei erledigt, „–“ bei nicht gebraucht) ──
{
  gleich(
    [KAPITEL_SYMBOL, KAPITEL_SYMBOL_KLASSE],
    [
      { erledigt: '✓', nichtGebraucht: '–', uebersprungen: '○', offen: '○' },
      { erledigt: 'text-[var(--tally-ready)]', nichtGebraucht: 'text-[var(--status-off)]', uebersprungen: 'text-[var(--status-warn)]', offen: 'text-[var(--status-off)]' },
    ],
    'P5 3.1: KAPITEL_SYMBOL ✓ – ○ ○ und Farben je Zustand (status.ts)',
  );
  gleich(
    Object.entries(KAPITEL_SYMBOL).filter(([, s]) => s === '✓').map(([z]) => z),
    ['erledigt'],
    'P5 3.1: den Haken trägt nur „erledigt“',
  );
}

const ZEILE: KapitelZeile = { id: 'k1', nummer: 1, titel: 'Anmelden', kurz: 'Zugang hinterlegen.', zustand: 'offen', zeigMir: true, brauchtNicht: true, dochGebraucht: false };
const ANSICHT: AnleitungsAnsicht = { blase: null, kapitel: [ZEILE], fortsetzen: null, hauptknopf: 'starten', titel: 'Einrichtung', abgeschlossen: false, beendet: false };
function uebersicht(teil: Partial<AnleitungsUebersichtProps> = {}): string {
  return render(
    <AnleitungsUebersicht
      ansicht={ANSICHT}
      aufEreignis={nichts}
      titel="Willkommen bei der JM Production Suite"
      unterzeile="In sechs Schritten startklar."
      speicherHinweis={null}
      stimme={{ vorhanden: true, an: true, umschalten: nichts, namensnennung: null }}
      schliessen={nichts}
      {...teil}
    />,
  );
}
/** Die Zeilen der Liste als [Kapitel-ID, HTML der Zeile]. */
const zeilen = (html: string): Array<[string, string]> => [...html.matchAll(/<li [^>]*data-kapitel="([^"]*)"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => [m[1], m[2]]);
const knoepfe = (html: string): string[] => tags(html, 'button').map((t) => attr(t, 'data-knopf') ?? `aktion:${attr(t, 'data-aktion')}`);

// ── Zeile je Zustand × Knöpfe (G7: Symbol aria-hidden, Wort sr-only) ──
{
  const K = kreuz({
    zustand: ['erledigt', 'nichtGebraucht', 'uebersprungen', 'offen'] as KapitelZustand[],
    zeigMir: [false, true],
    brauchtNicht: [false, true],
    dochGebraucht: [false, true],
  });
  pruefeFaelle('P5 3.1: Kapitelzeile je Zustand × Zeig mir × Brauche ich nicht × Doch gebraucht', K, (c) => {
    const html = uebersicht({ ansicht: { ...ANSICHT, kapitel: [{ ...ZEILE, ...c }] } });
    const [, zeile] = zeilen(html)[0] ?? ['', ''];
    const symbol = tags(zeile, 'span')[0] ?? '';
    const ist = [
      attr(symbol, 'aria-hidden'),
      text(zeile.match(/<span aria-hidden="true"[^>]*>([^<]*)<\/span>/)?.[1] ?? ''),
      text(zeile.match(/<span class="sr-only">([\s\S]*?)<\/span>/)?.[1] ?? '') === `${ANLEITUNG_TEXTE.zustand[c.zustand]}: `,
      text(ohneVersteckt(zeile)).includes(`${ANLEITUNG_TEXTE.zustand[c.zustand]}: 1. Anmelden`),
      knoepfe(zeile).join(','),
      text(zeile).includes('✓'),
    ].join(' | ');
    const soll = [
      'true',
      KAPITEL_SYMBOL[c.zustand],
      true,
      true,
      [c.zeigMir && 'zeigMir', c.brauchtNicht && 'brauchtNicht', c.dochGebraucht && 'dochGebraucht'].filter(Boolean).join(','),
      c.zustand === 'erledigt',
    ].join(' | ');
    return vergleiche(ist, soll);
  });
}

// ── Hauptknopf, Beenden, abgeschlossen, Diagnose, Stimme, Details, Aktionen, Tipp, Fertig ──
{
  const haupt = (a: Partial<AnleitungsAnsicht>): string => text(uebersicht({ ansicht: { ...ANSICHT, ...a } }).match(/data-knopf="haupt"[^>]*>([^<]*)</)?.[1] ?? '');
  gleich(
    [haupt({}), haupt({ hauptknopf: 'fortsetzen', fortsetzen: { n: 3, m: 6 } }), haupt({ titel: 'Titler-Einführung' })],
    ['Einrichtung starten', 'Einrichtung fortsetzen · Schritt 3 von 6', 'Titler-Einführung starten'],
    'P5 4, Spec 2: Hauptknopf U11 bzw. U12 mit Kapitel n von m und dem Titel der Anleitung',
  );
  const offen = uebersicht();
  const ENDE = kreuz({ abgeschlossen: [false, true], beendet: [false, true] });
  pruefeFaelle('P5 4, G7: „Anleitung beenden“ (U14) nur offen, „‹Titel› abgeschlossen“ (U34) nur bei allem erledigt, sonst nach dem Beenden U37', ENDE, (c) => {
    const html = uebersicht({ ansicht: { ...ANSICHT, ...c } });
    const ist = [knoepfe(html).includes('beenden'), text(html).includes('Einrichtung abgeschlossen'), text(html).includes(ANLEITUNG_TEXTE.beendet)].join(' ');
    return vergleiche(ist, [!c.abgeschlossen && !c.beendet, c.abgeschlossen, c.beendet].join(' '));
  });
  const mit = uebersicht({ speicherHinweis: 'Der Fortschritt kann auf diesem Rechner nicht gemerkt werden.' });
  gleich(
    [offen.includes('data-hinweis="speicher"'), mit.includes('data-hinweis="speicher"'), text(mit).includes('nicht gemerkt werden.')],
    [false, true, true],
    'P5 G7: Diagnosezeile genau bei speicherHinweis',
  );
  // Kreuz vorhanden (2) × an (2) × Namensnennung (2): genau die Knöpfe und Hinweise des Zustands, nie einen mehr
  // (Owner: Stimme an/aus in jedem erreichbaren Zustand; Launcher 0.17.0 läuft nur mit vorhanden=false; Ruling Task 5).
  {
    const NAME = 'Stimme: MLS, CC BY 4.0';
    const K = kreuz({ vorhanden: [false, true], an: [false, true], name: [null, NAME] as Array<string | null> });
    pruefeFaelle('P5 6, G7: Stimmen-Zeile vorhanden (2) × an (2) × Namensnennung (2): genau die Knöpfe und Hinweise des Zustands', K, (c) => {
      const html = uebersicht({ stimme: { vorhanden: c.vorhanden, an: c.an, umschalten: nichts, namensnennung: c.name } });
      const ist = [
        tags(html, 'button').map((t) => attr(t, 'data-knopf')).filter((n) => n === 'stimme').join(','),
        tags(html, 'p').map((t) => attr(t, 'data-hinweis')).filter((n) => n === 'keine-stimme' || n === 'namensnennung').join(','),
        ['Stimme aus', 'Stimme an', ANLEITUNG_TEXTE.keineStimme, NAME].filter((t) => text(html).includes(t)).join('|'),
      ].join(' ; ');
      const soll = [
        c.vorhanden ? 'stimme' : '',
        [c.vorhanden ? '' : 'keine-stimme', c.vorhanden && c.name !== null ? 'namensnennung' : ''].filter(Boolean).join(','),
        [c.vorhanden ? (c.an ? 'Stimme aus' : 'Stimme an') : '', c.vorhanden ? '' : ANLEITUNG_TEXTE.keineStimme, c.vorhanden && c.name !== null ? NAME : ''].filter(Boolean).join('|'),
      ].join(' ; ');
      return vergleiche(ist, soll);
    });
  }
  const zwei: AnleitungsAnsicht = { ...ANSICHT, kapitel: [ZEILE, { ...ZEILE, id: 'k2', nummer: 2, titel: 'Tools installieren' }] };
  const html = uebersicht({
    ansicht: zwei,
    details: { k1: 'Aktiv: GitHub.' },
    aktionen: { k2: { knopf: 'Auswählen / Werkzeugkasten', ausfuehren: nichts } },
    tipp: 'Tipp: Das JM Kochbuch (oben) hat Anleitungen & Best Practices.',
  });
  const [[, k1], [, k2]] = zeilen(html);
  gleich(
    [text(k1).includes('Aktiv: GitHub.'), text(k2).includes('Aktiv: GitHub.'), knoepfe(k2)[0], knoepfe(k1).includes('aktion:k2')],
    [true, false, 'aktion:k2', false],
    'P5 EP20: Detail und direkte Aktion stehen genau am eigenen Kapitel',
  );
  gleich(
    tags(k2, 'button').map((t) => attr(t, 'aria-label')),
    ['Auswählen / Werkzeugkasten: Tools installieren', 'Zeig mir: Tools installieren', 'Brauche ich nicht: Tools installieren'],
    'P5 3: Knöpfe je Kapitel tragen das Kapitel im Namen (Screenreader, Spec 4 „Zeig mir: Rechner koppeln“)',
  );
  ok(
    text(html).includes('Tipp: Das JM Kochbuch (oben) hat Anleitungen & Best Practices.') && knoepfe(html).at(-1) === 'schliessen' && text(html).trim().endsWith('Fertig'),
    'P5 EP20: Tipp und „Fertig“ (U35) zum Schließen',
  );
  pruefeIdVerweise(html, 'P5 4: Übersicht mit Überschrift über aria-labelledby');
}

// ── Mit echter Ansicht aus dem Kern ──
{
  const ansicht = anleitungAnsicht(
    TEST_ANLEITUNG,
    fortschritt({ status: 'pausiert', position: { ort: 'kapitel', kapitel: 'k2', schritt: 'k2.allein', nurZeigen: false, warErfuellt: false }, nichtGebraucht: ['k3'] }),
    { quelle: true },
    { produktion: false, stimme: { vorhanden: true, an: true, trotzdem: false } },
  );
  const html = uebersicht({ ansicht });
  gleich(
    zeilen(html).map(([id, z]) => `${id}:${text(z.match(/<span aria-hidden="true"[^>]*>([^<]*)<\/span>/)?.[1] ?? '')}:${knoepfe(z).join('+')}`),
    ['k1:✓:zeigMir', 'k2:○:zeigMir+brauchtNicht', 'k3:–:zeigMir+dochGebraucht'],
    'P5 4: Übersicht aus der Ansicht (k1 erledigt, k2 offen, k3 nicht gebraucht)',
  );
  ok(text(html).includes('Probe fortsetzen · Schritt 2 von 3'), 'P5 4: pausiert → „‹Titel› fortsetzen · Schritt 2 von 3“ mit dem Titel der Anleitung (Probe)');
  const beendet = uebersicht({
    ansicht: anleitungAnsicht(TEST_ANLEITUNG, fortschritt({ status: 'abgeschlossen', uebersprungen: ['k2'] }), { quelle: true }, { produktion: false, stimme: { vorhanden: true, an: true, trotzdem: false } }),
  });
  gleich(
    [text(beendet).includes('abgeschlossen'), text(beendet).includes(ANLEITUNG_TEXTE.beendet), knoepfe(beendet).includes('beenden'), zeilen(beendet).map(([, z]) => z.includes('✓'))],
    [false, true, false, [true, false, false]],
    'P5 Spec 2: nach „Ja, überspringen“ mit offenen Kapiteln kein „abgeschlossen“, sondern „Anleitung beendet“ (U37)',
  );
}

// ── Ansage: Körper des Effekts mit Attrappe (Spec 6; G7) ──
{
  const protokoll: string[] = [];
  const abspieler = (ergebnis: 'ok' | 'abgelehnt' | 'wirft'): ((url: string) => Abspieler) => (url) => {
    if (ergebnis === 'wirft') throw new Error('kein Audio');
    protokoll.push(`neu ${url}`);
    return {
      play: () => {
        protokoll.push('play');
        return ergebnis === 'ok' ? Promise.resolve() : Promise.reject(new Error('NotAllowedError'));
      },
      pause: () => protokoll.push('pause'),
    };
  };
  const fehler: AnsageFehler[] = [];
  const roh: Array<AnsageFehler | null> = [];
  const melde = (f: AnsageFehler | null): void => {
    roh.push(f);
    if (f !== null) fehler.push(f);
  };
  starteAnsage('a.ogg', 'k1.zugang', false, abspieler('ok'), melde);
  starteAnsage('a.ogg', null, true, abspieler('ok'), melde);
  const ohneDatei = [...fehler];
  starteAnsage(null, 'k1.zugang', true, abspieler('ok'), melde);
  const stopp = starteAnsage('a.ogg', 'k1.zugang', true, abspieler('ok'), melde);
  stopp();
  const nachStopp = [...protokoll];
  starteAnsage('b.ogg', 'k1.oeffnen', true, abspieler('abgelehnt'), melde);
  const spaet = starteAnsage('c.ogg', 'k1.oeffnen', true, abspieler('abgelehnt'), melde);
  spaet();
  starteAnsage('d.ogg', 'k1.oeffnen', true, abspieler('wirft'), melde);
  await new Promise((fertig) => setTimeout(fertig, 0));
  gleich(
    [ohneDatei, nachStopp, fehler],
    [[], ['neu a.ogg', 'play', 'pause'], ['fehlt', 'abspielen', 'abspielen']],
    'P5 6: starteAnsage – aus/ohne ID nichts, ohne Datei „fehlt“, Stopp pausiert, abgelehntes play „abspielen“, nach dem Stopp still, Wurf „abspielen“',
  );
  gleich(
    [
      ansageFehlerFuer(null, 'a', true),
      ansageFehlerFuer({ id: 'a', fehler: 'fehlt' }, 'a', true),
      ansageFehlerFuer({ id: 'a', fehler: 'fehlt' }, 'b', true),
      ansageFehlerFuer({ id: 'a', fehler: 'abspielen' }, 'a', false),
    ],
    [null, 'fehlt', null, null],
    'P5 G7: angezeigter Fehler nur für die aktuelle Ansage und nur, solange gespielt wird',
  );
  // G7: ein neuer Lauf setzt die Fehleranzeige zurück – Fehler, dann erneuter Lauf derselben ID mit Erfolg → kein Fehler mehr
  {
    let stand: ReturnType<typeof ansageStand> = null;
    const setze = (f: AnsageFehler | null): void => {
      stand = ansageStand('x', f);
    };
    starteAnsage(null, 'x', true, abspieler('ok'), setze);
    const nachFehler = ansageFehlerFuer(stand, 'x', true);
    starteAnsage('e.ogg', 'x', true, abspieler('ok'), setze);
    await new Promise((fertig) => setTimeout(fertig, 0));
    gleich(
      [nachFehler, ansageFehlerFuer(stand, 'x', true), ansageStand('x', null), ansageStand('x', 'fehlt')],
      ['fehlt', null, null, { id: 'x', fehler: 'fehlt' }],
      'P5 G7: Fehleranzeige wird bei jedem neuen Lauf zurückgesetzt (Fehler → erneuter Lauf mit Erfolg → kein Fehler)',
    );
    const vorher = roh.length;
    starteAnsage('f.ogg', 'y', true, abspieler('ok'), melde);
    starteAnsage('f.ogg', 'y', false, abspieler('ok'), melde);
    gleich(roh.slice(vorher), [null, null], 'P5 G7: jeder Lauf meldet zuerst „kein Fehler“ (null), auch wenn nicht gespielt wird');
  }
  const quelle = leseText('src/lib/useAnsage.ts');
  const effekt = quelle.slice(quelle.indexOf('useEffect(() => {'));
  ok(
    effekt.includes('new Audio(u)') && quelle.indexOf('new Audio(') > quelle.indexOf('useEffect(() => {') && quelle.includes('return ansageFehlerFuer(stand, id, spielen);'),
    'P5 6: useAnsage erzeugt Audio nur im Effekt und zeigt den Fehler über ansageFehlerFuer',
  );
  ok(typeof ui.AnleitungsUebersicht === 'function' && typeof ui.useAnsage === 'function', 'P5: Exporte aus src/index.ts (AnleitungsUebersicht, useAnsage)');
}

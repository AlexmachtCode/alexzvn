// P3 · Ansicht geführter Anleitungen (Spec 3, 3.1, 4, 6, 7; Gliederung 11 A1–A6; EP3, EP17, G7, G15). K4: Ort × Art × Bedingung
// (jetzt, beim Betreten) × Modus × Produktion × Eingriff × Stimme × Kapitelzustand → Knöpfe, Zähler, nur zeigen, Warnung,
// Ansage (eine Zeile je Ausgabefeld); K4b: Status × Ort × alles erledigt (nein, erledigt, gemischt mit nicht gebraucht) ×
// „Zeig mir“ → Fortsetzen, Hauptknopf, abgeschlossen, beendet; K5: Haken genau bei erfüllter Bedingung. Erwartungen stehen
// als eigene Regeln im Test.
import * as ui from '../src/index';
import {
  anleitungAnsicht,
  anleitungSchritt,
  leererFortschritt,
  type Anleitung,
  type AnleitungsAnsicht,
  type AnleitungsFortschritt,
  type AnleitungsKapitel,
  type AnleitungsPosition,
  type AnleitungsSchritt,
  type AnleitungsStatus,
  type AnleitungsUmgebung,
  type BlasenAnsicht,
  type Bedingung,
  type SchrittArt,
} from '../src/lib/anleitung';
import { TEST_ANLEITUNG, fortschritt } from './anleitung-format.test';
import { gleich, ok } from './harness';
import { kreuz, pruefeFaelle, vergleiche } from './lib/kreuz';

const JETZT = '2026-10-19T12:00:00.000Z';
const OHNE: AnleitungsUmgebung = { produktion: false, stimme: { vorhanden: true, an: true, trotzdem: false } };

/** Drei Kapitel; das Ziel ist ein Schritt in k2, an erster oder zweiter Stelle. */
function probe(art: SchrittArt, eingriff: boolean, stelle: 'erster' | 'zweiter'): Anleitung {
  const ziel: AnleitungsSchritt = {
    id: 'k2.ziel',
    art,
    text: 'Ziel.',
    eingriff,
    ...(art === 'handeln' ? { erledigtWenn: { zustand: 'bed' } } : {}),
    ...(art === 'entscheiden' ? { optionen: [{ knopf: 'Ja', entscheidung: 'ja' }] } : {}),
  };
  const anderer: AnleitungsSchritt = { id: stelle === 'erster' ? 'k2.nach' : 'k2.vor', art: 'erklaeren', text: 'Anderer.' };
  const kap = (id: string, schritte: AnleitungsSchritt[], erledigtWenn: Bedingung): AnleitungsKapitel => ({
    id,
    titel: id.toUpperCase(),
    kurz: `${id}.`,
    erledigt: `${id} ist erledigt.`,
    erledigtWenn,
    brauchtNicht: true,
    schritte,
  });
  return {
    format: 1,
    id: 'ansicht',
    titel: 'Ansicht',
    einleitung: { id: 'einleitung', art: 'erklaeren', text: 'Los.' },
    rueckfrage: { id: 'rueckfrage', art: 'erklaeren', text: 'Wirklich?' },
    abschluss: { id: 'abschluss', art: 'erklaeren', text: 'Fertig.' },
    wiederfinden: 'Oben.',
    kapitel: [
      kap('k1', [{ id: 'k1.a', art: 'erklaeren', text: 'A.' }], { zustand: 'k1Fertig' }),
      kap('k2', stelle === 'erster' ? [ziel, anderer] : [anderer, ziel], { zustand: 'kFertig' }),
      kap('k3', [{ id: 'k3.a', art: 'erklaeren', text: 'A.' }], { zustand: 'k3Fertig' }),
    ],
  };
}
const PROBEN = new Map<string, Anleitung>();
const probeFuer = (art: SchrittArt, eingriff: boolean, stelle: 'erster' | 'zweiter'): Anleitung => {
  const schluessel = `${art}|${eingriff}|${stelle}`;
  if (!PROBEN.has(schluessel)) PROBEN.set(schluessel, probe(art, eingriff, stelle));
  return PROBEN.get(schluessel) as Anleitung;
};

// ── K4: die Sprechblase ──
const K4 = kreuz({
  ort: ['einleitung', 'rueckfrage', 'abschluss', 'schonErledigt', 'schritt'],
  art: ['erklaeren', 'handeln', 'entscheiden', 'neustart'] as SchrittArt[],
  stelle: ['erster', 'zweiter'] as Array<'erster' | 'zweiter'>,
  lauf: ['haupt', 'einzeln'],
  nurZeigen: [false, true],
  war: [false, true],
  bed: [false, true],
  produktion: [false, true],
  eingriff: [false, true],
  vorhanden: [false, true],
  an: [false, true],
  trotzdem: [false, true],
  kz: ['offen', 'uebersprungen', 'nichtGebraucht', 'erledigt'],
})
  .filter((c) => c.ort === 'schritt' || (c.art === 'erklaeren' && c.stelle === 'erster' && !c.nurZeigen && !c.war && !c.eingriff))
  .filter((c) => c.lauf === 'haupt' || c.ort === 'schritt')
  // „Schon erledigt“ gibt es nur bei erledigtem Kapitel; der Kern führt den Ort sonst nach (Regel 11, Fortsetzen).
  .filter((c) => c.ort !== 'schonErledigt' || c.kz === 'erledigt');
type K4Fall = (typeof K4)[number];

const BLASEN = new WeakMap<K4Fall, BlasenAnsicht | null>();
function blaseVon(c: K4Fall): BlasenAnsicht | null {
  if (BLASEN.has(c)) return BLASEN.get(c) ?? null;
  const ort: AnleitungsPosition =
    c.ort === 'schritt'
      ? { ort: 'kapitel', kapitel: 'k2', schritt: 'k2.ziel', nurZeigen: c.nurZeigen, warErfuellt: c.war }
      : c.ort === 'schonErledigt'
        ? { ort: 'kapitel', kapitel: 'k2', schritt: null, nurZeigen: false, warErfuellt: false }
        : ({ ort: c.ort } as AnleitungsPosition);
  const haupt = c.lauf === 'haupt';
  const f: AnleitungsFortschritt = {
    ...leererFortschritt('ansicht'),
    status: haupt ? 'laeuft' : 'pausiert',
    position: haupt ? ort : { ort: 'kapitel', kapitel: 'k1', schritt: 'k1.a', nurZeigen: false, warErfuellt: false },
    einzeln: haupt ? null : (ort as Extract<AnleitungsPosition, { ort: 'kapitel' }>),
    uebersprungen: c.kz === 'uebersprungen' ? ['k2'] : [],
    nichtGebraucht: c.kz === 'nichtGebraucht' ? ['k2'] : [],
    neustart: c.ort === 'schritt' && c.art === 'neustart' && haupt && !c.nurZeigen ? { schritt: 'k2.ziel', seit: JETZT } : null,
  };
  const u: AnleitungsUmgebung = { produktion: c.produktion, stimme: { vorhanden: c.vorhanden, an: c.an, trotzdem: c.trotzdem } };
  const blase = anleitungAnsicht(probeFuer(c.art, c.eingriff, c.stelle), f, { bed: c.bed, kFertig: c.kz === 'erledigt' }, u).blase;
  BLASEN.set(c, blase);
  return blase;
}

{
  const schritt = (c: K4Fall): boolean => c.ort === 'schritt';
  const kapitelOrt = (c: K4Fall): boolean => c.ort === 'schritt' || c.ort === 'schonErledigt';
  const zeigen = (c: K4Fall): boolean => schritt(c) && (c.nurZeigen || (c.produktion && c.eingriff));
  const zeile = (feld: string, ist: (b: BlasenAnsicht) => string, soll: (c: K4Fall) => string): void =>
    pruefeFaelle(`P3 K4: ${feld} (Ort × Art × Bedingung × Modus × Produktion × Eingriff × Stimme × Kapitelzustand)`, K4, (c) => {
      const b = blaseVon(c);
      return b === null ? 'keine Blase' : vergleiche(ist(b), soll(c));
    });

  zeile('art', (b) => b.art, (c) => (c.ort === 'schritt' ? c.art : c.ort));
  zeile(
    'weiter (A2)',
    (b) => String(b.knoepfe.weiter),
    (c) => {
      if (c.ort === 'rueckfrage') return 'false';
      if (!schritt(c)) return 'true';
      if (c.art === 'erklaeren') return 'true';
      if (c.art === 'entscheiden') return 'false';
      if (c.art === 'neustart') return String(zeigen(c));
      return String(zeigen(c) || c.war);
    },
  );
  zeile('zurueck (Regel 5)', (b) => String(b.knoepfe.zurueck), (c) => String(c.lauf === 'haupt' ? c.ort !== 'einleitung' : c.stelle === 'zweiter'));
  zeile(
    'ueberspringen, spaeter, anleitungUeberspringen, jaUeberspringen',
    (b) => [b.knoepfe.ueberspringen, b.knoepfe.spaeter, b.knoepfe.anleitungUeberspringen, b.knoepfe.jaUeberspringen].join(' '),
    (c) => [kapitelOrt(c), c.ort !== 'rueckfrage', c.ort === 'einleitung', c.ort === 'rueckfrage'].join(' '),
  );
  zeile(
    'brauchtNicht',
    (b) => String(b.knoepfe.brauchtNicht),
    (c) => String(kapitelOrt(c) && c.kz !== 'erledigt' && c.kz !== 'nichtGebraucht'),
  );
  zeile('zaehler (EP3: Kapitel, nicht Schritte)', (b) => (b.zaehler === null ? '-' : `${b.zaehler.n}/${b.zaehler.m}`), (c) => (kapitelOrt(c) ? '2/3' : '-'));
  zeile(
    'nurZeigen und produktionsWarnung (A4)',
    (b) => `${b.nurZeigen} ${b.produktionsWarnung}`,
    (c) => `${zeigen(c)} ${schritt(c) && c.produktion && c.eingriff}`,
  );
  zeile('wartetAufNeustart', (b) => String(b.wartetAufNeustart), (c) => String(schritt(c) && c.art === 'neustart' && c.lauf === 'haupt' && !c.nurZeigen));
  zeile(
    'ansage (A5; Eingriff in der Produktion nie gesprochen, Spec 7)',
    (b) => `${b.ansage.id} ${b.ansage.spielen} ${b.ansage.hinweis}`,
    (c) => {
      const id = c.ort === 'schritt' ? 'k2.ziel' : c.ort === 'schonErledigt' ? 'k2.erledigt' : c.ort;
      const eingriffJetzt = schritt(c) && c.produktion && c.eingriff;
      const hinweis = !c.vorhanden ? 'keineStimme' : !c.an ? 'aus' : eingriffJetzt ? 'eingriff' : c.produktion && !c.trotzdem ? 'produktion' : 'null';
      return `${id} ${c.vorhanden && c.an && (!c.produktion || c.trotzdem) && !eingriffJetzt} ${hinweis}`;
    },
  );
  zeile(
    'text, kapitel und optionen',
    (b) => `${b.text} ${b.kapitel?.id ?? '-'} ${b.optionen.length}`,
    (c) => {
      const text = c.ort === 'schritt' ? 'Ziel.' : c.ort === 'schonErledigt' ? 'k2 ist erledigt.' : { einleitung: 'Los.', rueckfrage: 'Wirklich?', abschluss: 'Fertig.' }[c.ort];
      return `${text} ${kapitelOrt(c) ? 'k2' : '-'} ${schritt(c) && c.art === 'entscheiden' ? 1 : 0}`;
    },
  );
}

// ── K4b: Fortsetzen, Hauptknopf, abgeschlossen, beendet, Blase da ──
{
  const ORTE = ['-', 'einleitung', 'rueckfrage', 'abschluss', 'k1', 'k2', 'k3'];
  const K4B = kreuz({
    status: ['nieGestartet', 'laeuft', 'pausiert', 'durchlaufen', 'abgeschlossen'] as AnleitungsStatus[],
    ort: ORTE,
    // nein: kein Kapitel fertig; erledigt: alle drei erfüllt; gemischt: k1 und k2 erfüllt, k3 nicht gebraucht (G7)
    alles: ['nein', 'erledigt', 'gemischt'],
    einzeln: [false, true],
  });
  const bau = (c: (typeof K4B)[number]): { a: Anleitung; f: AnleitungsFortschritt; z: Record<string, boolean> } => {
    const a = probeFuer('erklaeren', false, 'erster');
    const position: AnleitungsPosition | null =
      c.ort === '-'
        ? null
        : c.ort.startsWith('k')
          ? { ort: 'kapitel', kapitel: c.ort, schritt: a.kapitel.find((k) => k.id === c.ort)?.schritte[0].id ?? null, nurZeigen: false, warErfuellt: false }
          : ({ ort: c.ort } as AnleitungsPosition);
    const f: AnleitungsFortschritt = {
      ...leererFortschritt('ansicht'),
      status: c.status,
      position,
      einzeln: c.einzeln ? { ort: 'kapitel', kapitel: 'k3', schritt: 'k3.a', nurZeigen: false, warErfuellt: false } : null,
      nichtGebraucht: c.alles === 'gemischt' ? ['k3'] : [],
    };
    const z: Record<string, boolean> =
      c.alles === 'erledigt' ? { k1Fertig: true, kFertig: true, k3Fertig: true } : c.alles === 'gemischt' ? { k1Fertig: true, kFertig: true } : {};
    return { a, f, z };
  };
  const ansicht = (c: (typeof K4B)[number]): AnleitungsAnsicht => {
    const { a, f, z } = bau(c);
    return anleitungAnsicht(a, f, z, OHNE);
  };
  const fertig = (c: (typeof K4B)[number]): boolean => c.alles !== 'nein';
  const pausiert = (c: (typeof K4B)[number]): boolean => c.status === 'pausiert' && !fertig(c);
  pruefeFaelle('P3 K4b: fortsetzen nur pausiert und nicht alles erledigt oder nicht gebraucht, n = Kapitel des Orts (A3)', K4B, (c) => {
    const v = ansicht(c).fortsetzen;
    const n = c.ort === 'abschluss' ? 3 : c.ort.startsWith('k') ? Number(c.ort.slice(1)) : 1;
    return vergleiche(v === null ? '-' : `${v.n}/${v.m}`, pausiert(c) ? `${n}/3` : '-');
  });
  pruefeFaelle('P3 K4b: hauptknopf fortsetzen genau dann, sonst starten', K4B, (c) =>
    vergleiche(ansicht(c).hauptknopf, pausiert(c) ? 'fortsetzen' : 'starten'),
  );
  // Der Knopf sagt, was starten tut: fortsetzen = am gemerkten Ort weiter, starten = vorn beginnen (erstes offenes Kapitel, sonst Kapitel 1).
  pruefeFaelle('P3 K4b: hauptknopf × Wirkung von starten (fortsetzen setzt fort, starten beginnt vorn)', K4B, (c) => {
    const { a, f, z } = bau(c);
    const knopf = anleitungAnsicht(a, f, z, OHNE).hauptknopf;
    const p = anleitungSchritt(a, f, { art: 'starten' }, z, JETZT).position;
    const ist = p === null ? '-' : p.ort !== 'kapitel' ? p.ort : `${p.kapitel}:${p.schritt ?? ''}`;
    const vorn = fertig(c) ? 'k1:' : 'k1:k1.a';
    const gemerkt = c.ort === '-' ? vorn : c.ort.startsWith('k') ? `${c.ort}:${c.ort === 'k2' ? 'k2.ziel' : `${c.ort}.a`}` : c.ort;
    return vergleiche(`${knopf} ${ist}`, pausiert(c) ? `fortsetzen ${gemerkt}` : `starten ${vorn}`);
  });
  pruefeFaelle('P3 K4b: abgeschlossen genau bei jedem Kapitel erledigt oder nicht gebraucht, nie nur wegen des Status (Spec 2, 4)', K4B, (c) =>
    vergleiche(String(ansicht(c).abgeschlossen), String(fertig(c))),
  );
  pruefeFaelle('P3 K4b: beendet genau bei Status abgeschlossen mit offenem Kapitel (G7)', K4B, (c) =>
    vergleiche(String(ansicht(c).beendet), String(c.status === 'abgeschlossen' && !fertig(c))),
  );
  pruefeFaelle('P3 K4b: Sprechblase nur bei „Zeig mir“ oder laufendem Hauptlauf (A1)', K4B, (c) =>
    vergleiche(String(ansicht(c).blase !== null), String(c.einzeln || (c.status === 'laeuft' && c.ort !== '-'))),
  );
}

// ── K4c: Der Fortsetzen-Knopf nennt das Kapitel, in dem „starten“ wirklich weitergeht (G7, Owner-Regel: der Knopf lügt in
// keinem erreichbaren Zustand) ──
// Auch wenn der gemerkte Schritt nach einem Rollenwechsel in der Pause nicht mehr gilt (der Kern führt den Ort dann nach,
// Regel 11) und wenn kein Ort gemerkt ist (Beginn beim ersten offenen Kapitel). Soll: der Zähler der Sprechblase nach dem
// Klick; ohne Zähler (Einleitung, Rückfrage) 1, am Abschluss m. Kein Fortsetzen nur, wenn alles erledigt ist.
{
  const A = TEST_ANLEITUNG;
  const kapitelOrte = A.kapitel.flatMap((k) =>
    [null, ...k.schritte.map((s) => s.id)].map((schritt): AnleitungsPosition => ({ ort: 'kapitel', kapitel: k.id, schritt, nurZeigen: false, warErfuellt: false })),
  );
  const ORTE: Array<AnleitungsPosition | null> = [null, { ort: 'einleitung' }, { ort: 'rueckfrage' }, { ort: 'abschluss' }, ...kapitelOrte];
  const K4C = kreuz({ ort: ORTE.map((_, i) => i), rolle: ['-', 'rolleAus', 'rolleMaster', 'rolleSlave'], quelle: [false, true], sicher: [false, true] });
  const zustand = (c: (typeof K4C)[number]): Record<string, boolean> => ({ quelle: c.quelle, sicher: c.sicher, ...(c.rolle === '-' ? {} : { [c.rolle]: true }) });
  pruefeFaelle('P3 K4c, G7: fortsetzen.n = Kapitel, in dem starten weitergeht (gemerkter Ort × Rolle nach der Pause × Quelle × sicher)', K4C, (c) => {
    const z = zustand(c);
    const f = fortschritt({ status: 'pausiert', position: ORTE[c.ort] });
    const vorher = anleitungAnsicht(A, f, z, OHNE);
    if (vorher.fortsetzen === null) return vorher.abgeschlossen ? null : 'kein Fortsetzen, obwohl nicht alles erledigt ist';
    const nach = anleitungSchritt(A, f, { art: 'starten' }, z, JETZT);
    const zaehler = anleitungAnsicht(A, nach, z, OHNE).blase?.zaehler ?? null;
    const soll = zaehler !== null ? zaehler.n : nach.position?.ort === 'abschluss' ? A.kapitel.length : 1;
    return vergleiche(`${vorher.fortsetzen.n}/${vorher.fortsetzen.m}`, `${soll}/${A.kapitel.length}`);
  });
  // Der gemessene Fall (Einrichtung: Pause an k3.slave, dann Rolle Master) als Probe: Pause an k2.slave, Rolle wird Master.
  const pause = fortschritt({ status: 'pausiert', position: { ort: 'kapitel', kapitel: 'k2', schritt: 'k2.slave', nurZeigen: false, warErfuellt: false } });
  const knopf = anleitungAnsicht(A, pause, { rolleMaster: true }, OHNE).fortsetzen;
  const weiter = anleitungSchritt(A, pause, { art: 'starten' }, { rolleMaster: true }, JETZT);
  const ort = weiter.position?.ort === 'kapitel' ? `${weiter.position.kapitel}:${weiter.position.schritt ?? ''}` : weiter.position?.ort;
  gleich(
    [knopf, ort, anleitungAnsicht(A, weiter, { rolleMaster: true }, OHNE).blase?.zaehler],
    [{ n: 3, m: 3 }, 'k3:k3.sicher', { n: 3, m: 3 }],
    'P3 K4c, G7: Pause an k2.slave, dann Rolle Master — der Knopf sagt „3 von 3“, Fortsetzen landet in k3 mit „3 von 3“',
  );
}

// ── K5: Haken genau bei erfüllter Bedingung, „–“ nicht gebraucht, übersprungen bleibt offen (Spec 3.1, G7) ──
{
  const K5 = kreuz({ erfuellt: [false, true], nichtGebraucht: [false, true], uebersprungen: [false, true], brauchtNicht: [false, true] });
  pruefeFaelle('P3 K5: Kapitelzeile je Bedingung × Markierung (Haken genau bei erfüllter Bedingung)', K5, (c) => {
    const basisAnleitung = probeFuer('erklaeren', false, 'erster');
    const a: Anleitung = { ...basisAnleitung, kapitel: basisAnleitung.kapitel.map((k) => (k.id === 'k2' ? { ...k, brauchtNicht: c.brauchtNicht } : k)) };
    const f = { ...leererFortschritt('ansicht'), nichtGebraucht: c.nichtGebraucht ? ['k2'] : [], uebersprungen: c.uebersprungen ? ['k2'] : [] };
    const zeile = anleitungAnsicht(a, f, { kFertig: c.erfuellt }, OHNE).kapitel[1];
    const zustand = c.erfuellt ? 'erledigt' : c.nichtGebraucht ? 'nichtGebraucht' : c.uebersprungen ? 'uebersprungen' : 'offen';
    const soll = {
      id: 'k2',
      nummer: 2,
      titel: 'K2',
      kurz: 'k2.',
      zustand,
      zeigMir: true,
      brauchtNicht: c.brauchtNicht && zustand !== 'erledigt' && zustand !== 'nichtGebraucht',
      dochGebraucht: zustand === 'nichtGebraucht',
    };
    return vergleiche(JSON.stringify(zeile), JSON.stringify(soll));
  });
}

// ── Einzelfälle (Spec 3.1, 4, 6, 7) ──
{
  const A = TEST_ANLEITUNG;
  const einleitung = fortschritt({ status: 'laeuft', position: { ort: 'einleitung' } });
  const k1 = anleitungSchritt(A, einleitung, { art: 'weiter' }, { quelle: true }, JETZT);
  const b = anleitungAnsicht(A, k1, { quelle: true }, OHNE).blase;
  gleich(
    [b?.art, b?.knoepfe.weiter, b?.text, b?.ansage.id, b?.zaehler],
    ['schonErledigt', true, 'Die Quelle ist schon verbunden.', 'k1.erledigt', { n: 1, m: 3 }],
    'P3 3.1: Release-Bau (Kapitel 1 erledigt) zeigt beim ersten Durchlauf „Schon erledigt“ mit Weiter',
  );
  const zeig = anleitungSchritt(A, fortschritt(), { art: 'starten', kapitel: 'k1' }, { quelle: true }, JETZT);
  const zb = anleitungAnsicht(A, zeig, { quelle: true }, OHNE).blase;
  gleich(
    [zb?.art, zb?.nurZeigen, zb?.knoepfe.weiter, zb?.knoepfe.zurueck, zb?.knoepfe.brauchtNicht],
    ['handeln', true, true, false, false],
    'P3 3.1: „Zeig mir“ auf erledigtem Kapitel läuft nur zeigen mit Weiter, ohne Zurück vor den ersten Schritt',
  );
  const zaehler = kreuz({
    rolle: ['rolleAus', 'rolleMaster', 'rolleSlave', '-'],
    ng: [false, true],
    ueb: [false, true],
    ort: ['k1.oeffnen', 'k2', 'k3.sicher'],
  });
  pruefeFaelle('P3 EP3: m = Zahl der Kapitel, n = Kapitelnummer, unabhängig von Rolle und Markierungen', zaehler, (c) => {
    const kapitel = c.ort.slice(0, 2);
    const schritt = c.ort === 'k2' ? (c.rolle === 'rolleMaster' ? 'k2.master' : c.rolle === 'rolleSlave' ? 'k2.slave' : 'k2.allein') : c.ort;
    const f = fortschritt({
      status: 'laeuft',
      position: { ort: 'kapitel', kapitel, schritt, nurZeigen: false, warErfuellt: false },
      nichtGebraucht: c.ng ? ['k2'] : [],
      uebersprungen: c.ueb ? ['k1'] : [],
    });
    const z = anleitungAnsicht(A, f, c.rolle === '-' ? {} : { [c.rolle]: true }, OHNE).blase?.zaehler;
    return vergleiche(z === undefined || z === null ? '-' : `${z.n}/${z.m}`, `${kapitel.slice(1)}/3`);
  });
  const neu = fortschritt({
    status: 'laeuft',
    position: { ort: 'kapitel', kapitel: 'k3', schritt: 'k3.neustart', nurZeigen: false, warErfuellt: false },
    neustart: { schritt: 'k3.neustart', seit: JETZT },
  });
  const still = anleitungAnsicht(A, neu, {}, OHNE).blase;
  const live = anleitungAnsicht(A, neu, {}, { produktion: true, stimme: { vorhanden: true, an: true, trotzdem: false } }).blase;
  const trotzdem = anleitungAnsicht(A, neu, {}, { produktion: true, stimme: { vorhanden: true, an: true, trotzdem: true } }).blase;
  gleich(
    [still?.wartetAufNeustart, still?.knoepfe.weiter, still?.produktionsWarnung, live?.nurZeigen, live?.knoepfe.weiter, live?.produktionsWarnung, live?.ansage.hinweis, trotzdem?.ansage.spielen, trotzdem?.ansage.hinweis],
    [true, false, false, true, true, true, 'eingriff', false, 'eingriff'],
    'P3 7: Neustart-Schritt wartet ohne Weiter; in der Produktion nur zeigen mit Warnung, Stimme aus, auch mit „Stimme trotzdem an“',
  );
  const beendet = anleitungAnsicht(A, fortschritt({ status: 'abgeschlossen', uebersprungen: ['k2'] }), { quelle: true }, OHNE);
  gleich(
    [beendet.titel, beendet.abgeschlossen, beendet.beendet, beendet.kapitel.map((k) => k.zustand)],
    ['Probe', false, true, ['erledigt', 'uebersprungen', 'offen']],
    'P3 4: „Ja, überspringen“ mit offenen Kapiteln ist beendet, nicht abgeschlossen (Spec 2 Anti-Ziel); titel aus der Anleitung',
  );
  const zugang = anleitungAnsicht(A, fortschritt({ status: 'laeuft', position: { ort: 'kapitel', kapitel: 'k1', schritt: 'k1.zugang', nurZeigen: false, warErfuellt: false } }), {}, OHNE).blase;
  gleich(
    [zugang?.ziel, zugang?.zielFehlt, zugang?.wiederfinden],
    ['einstellungen.zugang', 'Öffne zuerst die Einstellungen.', 'Übersprungenes findest du oben unter Hilfe.'],
    'P3 5: Ziel, Text bei fehlendem Ziel und Hinweis „wo man es später findet“ (A2a)',
  );
  ok(anleitungAnsicht(A, fortschritt({ status: 'pausiert' }), {}, OHNE).blase === null, 'P3 A1: pausiert ohne „Zeig mir“ → keine Sprechblase');
  ok(typeof ui.anleitungAnsicht === 'function', 'P3: Exporte aus src/index.ts');
}

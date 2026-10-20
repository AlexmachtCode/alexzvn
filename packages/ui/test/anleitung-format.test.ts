// P1 · Format geführter Anleitungen (Spec 3.1, 5, 6, 7; Plan EP1, EP2, EP6, G5, G8): Bedingungen als Kreuz, Kapitelzustand
// mit Vorrang, geltende Schritte je Rolle, Prüfung der Anleitung je Regel, Sprechtexte, Fortschritt normalisieren und
// Rundreise, keine Laufzeit-Importe in anleitung.ts. Die Fixtur TEST_ANLEITUNG nutzen auch P2, P3 und P5.
import * as perPaket from '@jm/ui/anleitung';
import * as ui from '../src/index';
import {
  ANLEITUNG_FORMAT,
  ID_MUSTER,
  ZIEL_MUSTER,
  bedingungErfuellt,
  geltendeSchritte,
  kapitelZustand,
  leererFortschritt,
  normalisiereFortschritt,
  pruefeAnleitung,
  sprechTexte,
  type Anleitung,
  type AnleitungsFortschritt,
  type AnleitungsKapitel,
  type AnleitungsSchritt,
  type Bedingung,
  type NamensListen,
} from '../src/lib/anleitung';
import { gleich, leseText, ok } from './harness';
import { kreuz, pruefeFaelle, vergleiche } from './lib/kreuz';

/** Namen, die das Probe-Tool kennt. */
export const TEST_NAMEN: NamensListen = {
  zustaende: ['quelle', 'offen', 'rolleAus', 'rolleMaster', 'rolleSlave', 'sicher'],
  ereignisse: ['gespeichert'],
  entscheidungen: ['allein'],
};

/** Drei Kapitel: zwei Handlungen, Rollen-Varianten mit Entscheidung, Eingriff mit Neustart (Muster der Einrichtung). */
export const TEST_ANLEITUNG: Anleitung = {
  format: 1,
  id: 'probe',
  titel: 'Probe',
  einleitung: { id: 'einleitung', art: 'erklaeren', text: 'Willkommen. Drei Kapitel folgen.' },
  rueckfrage: { id: 'rueckfrage', art: 'erklaeren', text: 'Wirklich überspringen?', ziel: 'kopf.hilfe' },
  abschluss: { id: 'abschluss', art: 'erklaeren', text: 'Das war alles. Oben findest du jedes Kapitel.', ziel: 'kopf.hilfe' },
  wiederfinden: 'Übersprungenes findest du oben unter Hilfe.',
  kapitel: [
    {
      id: 'k1',
      titel: 'Quelle',
      kurz: 'Die Quelle verbinden.',
      erledigt: 'Die Quelle ist schon verbunden.',
      erledigtWenn: { zustand: 'quelle' },
      brauchtNicht: true,
      schritte: [
        { id: 'k1.oeffnen', art: 'handeln', text: 'Öffne die Einstellungen.', ziel: 'kopf.einstellungen', erledigtWenn: { zustand: 'offen' } },
        {
          id: 'k1.zugang',
          art: 'handeln',
          text: 'Trage den Zugang ein.',
          sprechtext: 'Trage hier den Zugang ein.',
          ziel: 'einstellungen.zugang',
          zielFehlt: 'Öffne zuerst die Einstellungen.',
          ueberspringenHinweis: true,
          erledigtWenn: { zustand: 'quelle' },
        },
      ],
    },
    {
      id: 'k2',
      titel: 'Rolle',
      kurz: 'Die Rolle wählen.',
      erledigt: 'Die Rolle steht schon.',
      erledigtWenn: { eineVon: [{ zustand: 'rolleMaster' }, { alle: [{ zustand: 'rolleAus' }, { entscheidung: 'allein' }] }] },
      brauchtNicht: true,
      schritte: [
        {
          id: 'k2.allein',
          art: 'entscheiden',
          text: 'Arbeitest du allein?',
          giltWenn: { nicht: { eineVon: [{ zustand: 'rolleMaster' }, { zustand: 'rolleSlave' }] } },
          optionen: [{ knopf: 'Allein', entscheidung: 'allein' }, { knopf: 'Verbund' }],
        },
        { id: 'k2.master', art: 'erklaeren', text: 'Der Master verteilt die Show.', giltWenn: { zustand: 'rolleMaster' } },
        { id: 'k2.slave', art: 'erklaeren', text: 'Der Slave folgt dem Master.', giltWenn: { zustand: 'rolleSlave' } },
      ],
    },
    {
      id: 'k3',
      titel: 'Steuerung',
      kurz: 'Die Steuerung sichern.',
      erledigt: 'Die Steuerung ist schon sicher.',
      erledigtWenn: { eineVon: [{ zustand: 'sicher' }, { ereignis: 'gespeichert' }] },
      brauchtNicht: true,
      schritte: [
        { id: 'k3.sicher', art: 'handeln', text: 'Aktiviere den sicheren Modus.', ziel: 'system.sicher', eingriff: true, erledigtWenn: { zustand: 'sicher' } },
        { id: 'k3.neustart', art: 'neustart', text: 'Starte neu. Danach geht es hier weiter.', eingriff: true },
        { id: 'k3.danach', art: 'erklaeren', text: 'Jetzt ist alles sicher.' },
      ],
    },
  ],
};

/** Fortschritt der Probe mit einzelnen Feldern. */
export function fortschritt(teil: Partial<AnleitungsFortschritt> = {}): AnleitungsFortschritt {
  return { ...leererFortschritt('probe'), ...teil };
}

// ── Konstanten und Muster ──
{
  ok(ANLEITUNG_FORMAT === 1, 'P1 8: ANLEITUNG_FORMAT ist 1');
  gleich(
    ['einleitung', 'k1', 'k1.zugang', 'k2.koppeln-master', 'k1.Zugang', 'k1..x', 'K1', 'k1 x', ''].map((id) => ID_MUSTER.test(id)),
    [true, true, true, true, false, false, false, false, false],
    'P1 EP10: ID_MUSTER (klein, Punkte, Bindestrich nach dem ersten Teil)',
  );
  gleich(
    ['kopf.einstellungen', 'verbund.koppeln-master', 'a.b.c', 'einstellungen', 'Kopf.x', 'kopf.', 'kopf x.y'].map((z) => ZIEL_MUSTER.test(z)),
    [true, true, true, false, false, false, false],
    'P1 EP10: ZIEL_MUSTER (mindestens bereich.name)',
  );
}

// ── Bedingungen (Spec 7: lesen nur; fehlender Name = false) ──
{
  const FORMEN: Record<string, Bedingung> = {
    zustand: { zustand: 'x' },
    ereignis: { ereignis: 'x' },
    entscheidung: { entscheidung: 'x' },
    alle: { alle: [{ zustand: 'x' }, { ereignis: 'x' }] },
    eineVon: { eineVon: [{ entscheidung: 'x' }, { zustand: 'x' }] },
    nicht: { nicht: { zustand: 'x' } },
  };
  const faelle = kreuz({
    form: Object.keys(FORMEN),
    zustand: [true, false, undefined] as const,
    ereignis: [true, false],
    entscheidung: [true, false],
  });
  pruefeFaelle('P1 7: bedingungErfuellt über alle sechs Formen × Zustand × Ereignis × Entscheidung', faelle, (c) => {
    const z: Record<string, boolean> = c.zustand === undefined ? {} : { x: c.zustand };
    const f = fortschritt({ ereignisse: c.ereignis ? { x: 'T1' } : {}, entscheidungen: c.entscheidung ? { x: 'T1' } : {} });
    const zx = c.zustand === true;
    const soll: Record<string, boolean> = {
      zustand: zx,
      ereignis: c.ereignis,
      entscheidung: c.entscheidung,
      alle: zx && c.ereignis,
      eineVon: c.entscheidung || zx,
      nicht: !zx,
    };
    return vergleiche(String(bedingungErfuellt(FORMEN[c.form], z, f)), String(soll[c.form]));
  });
  const leer = fortschritt();
  gleich(
    [
      bedingungErfuellt({ alle: [] }, {}, leer),
      bedingungErfuellt({ eineVon: [] }, {}, leer),
      bedingungErfuellt({ zustand: 'constructor' }, {}, leer),
      bedingungErfuellt({ ereignis: 'toString' }, {}, leer),
      bedingungErfuellt({ entscheidung: 'hasOwnProperty' }, {}, leer),
      bedingungErfuellt({ nicht: { nicht: { zustand: 'x' } } }, { x: true }, leer),
    ],
    [true, false, false, false, false, true],
    'P1 7: alle([]) ist wahr, eineVon([]) falsch, geerbte Namen (constructor, toString) zählen nie, doppelt nicht',
  );
}

// ── Kapitelzustand (Spec 3.1: Vorrang erledigt > nicht gebraucht > übersprungen > offen) ──
{
  const faelle = kreuz({ erfuellt: [true, false], nichtGebraucht: [true, false], uebersprungen: [true, false] });
  pruefeFaelle('P1 3.1: kapitelZustand mit Vorrang erledigt > nichtGebraucht > uebersprungen > offen', faelle, (c) => {
    const f = fortschritt({ nichtGebraucht: c.nichtGebraucht ? ['k1'] : [], uebersprungen: c.uebersprungen ? ['k1'] : [] });
    const soll = c.erfuellt ? 'erledigt' : c.nichtGebraucht ? 'nichtGebraucht' : c.uebersprungen ? 'uebersprungen' : 'offen';
    return vergleiche(kapitelZustand(TEST_ANLEITUNG, 'k1', { quelle: c.erfuellt }, f), soll);
  });
  ok(kapitelZustand(TEST_ANLEITUNG, 'gibt-es-nicht', {}, fortschritt()) === 'offen', 'P1 3.1: unbekanntes Kapitel ist offen');
}

// ── Geltende Schritte je Rolle (Spec 5, EP6: Rolle unbekannt = Einzelplatz-Schritte) ──
{
  const ids = (z: Record<string, boolean>): string[] => geltendeSchritte(TEST_ANLEITUNG, 'k2', z, fortschritt()).map((s) => s.id);
  gleich(
    [ids({ rolleAus: true }), ids({ rolleMaster: true }), ids({ rolleSlave: true }), ids({})],
    [['k2.allein'], ['k2.master'], ['k2.slave'], ['k2.allein']],
    'P1 5: geltendeSchritte je Rolle (aus, Master, Slave, unbekannt)',
  );
  gleich(
    [geltendeSchritte(TEST_ANLEITUNG, 'k1', {}, fortschritt()).map((s) => s.id), geltendeSchritte(TEST_ANLEITUNG, 'gibt-es-nicht', {}, fortschritt())],
    [['k1.oeffnen', 'k1.zugang'], []],
    'P1 5: ohne giltWenn gelten alle Schritte; unbekanntes Kapitel hat keine',
  );
}

// ── Prüfung der Anleitung (Spec 7: Test gegen stillen Bruch; je Regel ein Befund) ──
{
  gleich(pruefeAnleitung(TEST_ANLEITUNG, TEST_NAMEN), [], 'P1 7: pruefeAnleitung findet an der Probe nichts');

  type Aenderung = (a: Anleitung) => Anleitung;
  const schritt = (id: string, teil: Partial<AnleitungsSchritt>): Aenderung => (a) => ({
    ...a,
    kapitel: a.kapitel.map((k) => ({ ...k, schritte: k.schritte.map((s) => (s.id === id ? { ...s, ...teil } : s)) })),
  });
  const kapitel = (id: string, teil: Partial<AnleitungsKapitel>): Aenderung => (a) => ({
    ...a,
    kapitel: a.kapitel.map((k) => (k.id === id ? { ...k, ...teil } : k)),
  });
  const REGELN: Array<{ regel: string; aendere: Aenderung; soll: string[] }> = [
    { regel: 'doppelte ID', aendere: schritt('k1.zugang', { id: 'k1.oeffnen' }), soll: ['ID doppelt: k1.oeffnen'] },
    { regel: 'reservierte ID ‹Kapitel›.erledigt', aendere: schritt('k3.danach', { id: 'k3.erledigt' }), soll: ['ID doppelt: k3.erledigt'] },
    { regel: 'Schritt-ID gegen ID_MUSTER', aendere: schritt('k2.allein', { id: 'k2.Allein' }), soll: ['ID ungültig: k2.Allein'] },
    { regel: 'Anleitungs-ID gegen ID_MUSTER', aendere: (a) => ({ ...a, id: 'Probe' }), soll: ['ID ungültig: Probe'] },
    { regel: 'Schritt-ID ohne Kapitel-Präfix', aendere: schritt('k1.oeffnen', { id: 'k2.oeffnen' }), soll: ['Schritt ohne Kapitel-Präfix: k2.oeffnen in k1'] },
    { regel: 'handeln ohne erledigtWenn', aendere: schritt('k1.oeffnen', { erledigtWenn: undefined }), soll: ['handeln ohne erledigtWenn: k1.oeffnen'] },
    { regel: 'erklaeren mit erledigtWenn', aendere: schritt('k3.danach', { erledigtWenn: { zustand: 'sicher' } }), soll: ['erledigtWenn nur bei handeln: k3.danach'] },
    { regel: 'entscheiden ohne Optionen', aendere: schritt('k2.allein', { optionen: [] }), soll: ['entscheiden ohne Optionen: k2.allein'] },
    { regel: 'Optionen an erklaeren', aendere: schritt('k3.danach', { optionen: [{ knopf: 'Gut' }] }), soll: ['Optionen nur bei entscheiden: k3.danach'] },
    { regel: 'unbekannter Zustand', aendere: kapitel('k1', { erledigtWenn: { zustand: 'quelleX' } }), soll: ['unbekannter Zustand: quelleX (k1)'] },
    {
      regel: 'unbekanntes Ereignis',
      aendere: kapitel('k3', { erledigtWenn: { eineVon: [{ zustand: 'sicher' }, { ereignis: 'gespeichertX' }] } }),
      soll: ['unbekanntes Ereignis: gespeichertX (k3)'],
    },
    {
      regel: 'unbekannte Entscheidung an einer Option',
      aendere: schritt('k2.allein', { optionen: [{ knopf: 'Allein', entscheidung: 'alleinX' }, { knopf: 'Verbund' }] }),
      soll: ['unbekannte Entscheidung: alleinX (k2.allein.option1)'],
    },
    {
      regel: 'unbekannter Name in giltWenn',
      aendere: schritt('k2.master', { giltWenn: { zustand: 'rolleMeister' } }),
      soll: ['unbekannter Zustand: rolleMeister (k2.master)'],
    },
    { regel: 'Ziel gegen ZIEL_MUSTER', aendere: schritt('k1.oeffnen', { ziel: 'einstellungen' }), soll: ['Ziel ungültig: einstellungen (k1.oeffnen)'] },
    { regel: 'leerer Text', aendere: schritt('k3.danach', { text: '  ' }), soll: ['Text leer: k3.danach'] },
    { regel: 'leerer Kurztext', aendere: kapitel('k2', { kurz: '' }), soll: ['Text leer: k2.kurz'] },
    {
      regel: 'ASCII-Anführungszeichen',
      aendere: schritt('k1.zugang', { text: 'Klicke auf "Speichern".' }),
      soll: ['ASCII-Anführungszeichen: k1.zugang'],
    },
    { regel: 'mehr als drei Sätze', aendere: schritt('k3.danach', { text: 'Eins. Zwei! Drei? Vier.' }), soll: ['mehr als drei Sätze: k3.danach'] },
    { regel: 'drei Sätze sind erlaubt', aendere: schritt('k3.danach', { text: 'Eins. Zwei! Drei?' }), soll: [] },
    { regel: 'Kapitel ohne Schritt', aendere: kapitel('k3', { schritte: [] }), soll: ['Kapitel ohne Schritt: k3'] },
    {
      regel: 'feste ID der Einleitung',
      aendere: (a) => ({ ...a, einleitung: { ...a.einleitung, id: 'start' } }),
      soll: ['feste ID erwartet: einleitung (ist start)'],
    },
    { regel: 'leeres wiederfinden', aendere: (a) => ({ ...a, wiederfinden: '' }), soll: ['Text leer: wiederfinden'] },
  ];
  pruefeFaelle('P1 7: pruefeAnleitung meldet je Regel genau ihren Befund', REGELN, (r) =>
    vergleiche(JSON.stringify(pruefeAnleitung(r.aendere(TEST_ANLEITUNG), TEST_NAMEN)), JSON.stringify(r.soll)),
  );
}

// ── Sprechtexte (Spec 6: zu jedem gesprochenen Text eine Ansage) ──
{
  gleich(
    sprechTexte(TEST_ANLEITUNG).map((t) => t.id),
    ['einleitung', 'rueckfrage', 'abschluss', 'k1.erledigt', 'k1.oeffnen', 'k1.zugang', 'k2.erledigt', 'k2.allein', 'k2.master', 'k2.slave', 'k3.erledigt', 'k3.sicher', 'k3.neustart', 'k3.danach'],
    'P1 6: sprechTexte in fester Reihenfolge (einleitung, rueckfrage, abschluss, je Kapitel erledigt und alle Schritte)',
  );
  const nach = new Map(sprechTexte(TEST_ANLEITUNG).map((t) => [t.id, t.text]));
  gleich(
    [nach.get('k1.zugang'), nach.get('k1.oeffnen'), nach.get('k2.erledigt')],
    ['Trage hier den Zugang ein.', 'Öffne die Einstellungen.', 'Die Rolle steht schon.'],
    'P1 6: sprechtext vor text, Kapitel-Ansage ‹Kapitel›.erledigt spricht den Text „Schon erledigt“',
  );
}

// ── Fortschritt normalisieren (G8: jedes Feld geprüft, Rundreise) ──
{
  gleich(
    [null, [], 'x', 3, undefined].map((roh) => normalisiereFortschritt(roh, 'probe')),
    [null, null, null, null, null],
    'P1 G8: normalisiereFortschritt ohne Objekt → null',
  );
  gleich(normalisiereFortschritt({}, 'probe'), leererFortschritt('probe'), 'P1 G8: leeres Objekt → leererFortschritt');
  const VOLL: AnleitungsFortschritt = {
    format: 1,
    anleitung: 'probe',
    status: 'pausiert',
    position: { ort: 'kapitel', kapitel: 'k3', schritt: 'k3.neustart', nurZeigen: true, warErfuellt: true },
    einzeln: { ort: 'kapitel', kapitel: 'k2', schritt: null, nurZeigen: false, warErfuellt: true },
    uebersprungen: ['k1'],
    nichtGebraucht: ['k2'],
    ereignisse: { gespeichert: '2026-10-19T10:00:00.000Z', 'neustart:k3.neustart': '2026-10-19T10:05:00.000Z' },
    entscheidungen: { allein: '2026-10-19T10:01:00.000Z' },
    neustart: { schritt: 'k3.neustart', seit: '2026-10-19T10:04:00.000Z' },
    hinweisGesehen: true,
  };
  gleich(
    Object.keys(VOLL),
    Object.keys(leererFortschritt('probe')),
    'P1 G9: die Rundreise-Fixtur füllt jedes Feld von leererFortschritt',
  );
  gleich(normalisiereFortschritt(JSON.parse(JSON.stringify(VOLL)), 'probe'), VOLL, 'P1 G8: Rundreise JSON → normalisiereFortschritt behält jedes Feld');
  const FALSCH: Record<string, unknown> = {
    status: 'laeuftNicht',
    position: { ort: 'irgendwo' },
    einzeln: { ort: 'einleitung' },
    uebersprungen: 'k1',
    nichtGebraucht: { 0: 'k2' },
    ereignisse: ['gespeichert'],
    entscheidungen: 'allein',
    neustart: { schritt: 3, seit: 'T' },
    hinweisGesehen: 'ja',
  };
  const leer = leererFortschritt('probe') as unknown as Record<string, unknown>;
  pruefeFaelle(
    'P1 G8: jedes falsch getypte Feld bekommt die Vorgabe, die übrigen Felder bleiben',
    Object.keys(FALSCH).map((feld) => ({ feld })),
    ({ feld }) =>
      vergleiche(
        JSON.stringify(normalisiereFortschritt({ ...VOLL, [feld]: FALSCH[feld] }, 'probe')),
        JSON.stringify({ ...VOLL, [feld]: leer[feld] }),
      ),
  );
  gleich(
    normalisiereFortschritt(
      {
        uebersprungen: [1, 'k1', 'k1', null],
        ereignisse: { a: 'T', b: 3 },
        position: { ort: 'kapitel', kapitel: 'k1', schritt: null, nurZeigen: 'ja' },
      },
      'probe',
    ),
    fortschritt({ uebersprungen: ['k1'], ereignisse: { a: 'T' }, position: { ort: 'kapitel', kapitel: 'k1', schritt: null, nurZeigen: false, warErfuellt: false } }),
    'P1 G8: Listen ohne Fremdes und Doppeltes, Zeiten nur als Text, Wahrheitswerte nur true',
  );
}

// ── Keine Laufzeit-Importe (G5: strip-types lädt @jm/ui/anleitung) und Exporte ──
{
  const zeilen = leseText('src/lib/anleitung.ts').split('\n');
  const verboten = zeilen.filter(
    (z) =>
      (/^\s*import\s/.test(z) && !/^\s*import\s+type\s/.test(z)) ||
      (/^\s*export\s+(\*|\{[^}]*\})\s+from\s/.test(z) && !/^\s*export\s+type\s/.test(z)) ||
      /^\s*(export\s+)?(const\s+)?(enum|namespace)\s/.test(z) ||
      /\brequire\(/.test(z),
  );
  ok(verboten.length === 0, 'P1 G5: anleitung.ts hat keine Laufzeit-Importe (nur import type), kein enum, kein namespace');
  for (const z of verboten) console.log(`     ${z}`);
  ok(
    perPaket.pruefeAnleitung === pruefeAnleitung && perPaket.bedingungErfuellt === bedingungErfuellt && perPaket.ANLEITUNG_FORMAT === 1,
    'P1 G5: @jm/ui/anleitung ist dasselbe Modul (Paket-Export ./anleitung)',
  );
  ok(
    [ui.bedingungErfuellt, ui.geltendeSchritte, ui.kapitelZustand, ui.pruefeAnleitung, ui.sprechTexte, ui.leererFortschritt, ui.normalisiereFortschritt].every(
      (f) => typeof f === 'function',
    ) && ui.ID_MUSTER === ID_MUSTER && ui.ZIEL_MUSTER === ZIEL_MUSTER,
    'P1: Exporte aus src/index.ts',
  );
}

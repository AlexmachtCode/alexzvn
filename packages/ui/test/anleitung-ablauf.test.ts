// P2 · Ablauf geführter Anleitungen (Spec 3, 3.1, 4, 8; Gliederung 11 Regeln 1–13, Start, Speicher; EP3, EP4, EP7, EP8, G8).
// K1: Ereignis × Ort × Status × „Zeig mir“ × Modus × Bedingung × Markierungen × gilt nur, wenn → neuer Fortschritt, eine
// Zeile je Ereignisart;
// K2: Start; K3: Neustart-Rundreise; Speicher-Attrappen; Folgen aus der Einrichtung. Die Erwartung rechnet ein eigenes
// Modell der Reihenfolge (sollNach) über eine feste Mini-Anleitung, nicht der Kern.
import * as ui from '../src/index';
import {
  anleitungSchritt,
  beimStart,
  kapitelZustand,
  leererFortschritt,
  leseFortschritt,
  schreibeFortschritt,
  type Anleitung,
  type AnleitungsEreignis,
  type AnleitungsFortschritt,
  type AnleitungsPosition,
  type AnleitungsStatus,
  type AnleitungSpeicher,
  type KapitelPosition,
  type KapitelZustand,
  type SpeicherZustand,
} from '../src/lib/anleitung';
import { TEST_ANLEITUNG, fortschritt } from './anleitung-format.test';
import { gleich, ok } from './harness';
import { kreuz, pruefeFaelle, vergleiche } from './lib/kreuz';

const JETZT = '2026-10-19T12:00:00.000Z';
const FRUEHER = '2026-10-19T11:00:00.000Z';
const STATUS: readonly AnleitungsStatus[] = ['nieGestartet', 'laeuft', 'pausiert', 'durchlaufen', 'abgeschlossen'];

/** Kurzform eines Orts: `kapitel:schritt` (leer = „Schon erledigt“), dazu /zeigen und /war. */
function ortText(p: AnleitungsPosition | null): string {
  if (p === null) return '-';
  if (p.ort !== 'kapitel') return p.ort;
  return `${p.kapitel}:${p.schritt ?? ''}${p.nurZeigen ? '/zeigen' : ''}${p.warErfuellt ? '/war' : ''}`;
}

/** Kurzform eines Fortschritts für Vergleich und Ausgabe. */
function kurz(f: AnleitungsFortschritt): string {
  const zeiten = (r: Record<string, string>): string => Object.entries(r).map(([k, v]) => `${k}@${v}`).join(',');
  return [
    f.status,
    `haupt=${ortText(f.position)}`,
    `einzeln=${ortText(f.einzeln)}`,
    `ueb=${f.uebersprungen.join(',')}`,
    `ng=${f.nichtGebraucht.join(',')}`,
    `ereig=${zeiten(f.ereignisse)}`,
    `ents=${zeiten(f.entscheidungen)}`,
    `neustart=${f.neustart === null ? '-' : `${f.neustart.schritt}@${f.neustart.seit}`}`,
  ].join(' ');
}

// ── Mini-Anleitung für K1 und K3: a erledigt mit „bed“, b mit der Entscheidung bWahl, c mit cFertig. In c gilt c.mitR nur
// mit dem Zustand r, c.ohneR nur ohne r (Kapitel je nach Rolle, Spec 5): Eintritt, Weiter und Zurück laufen nur über die
// geltenden Schritte ──
const ABLAUF: Anleitung = {
  format: 1,
  id: 'ablauf',
  titel: 'Ablauf',
  einleitung: { id: 'einleitung', art: 'erklaeren', text: 'Los.' },
  rueckfrage: { id: 'rueckfrage', art: 'erklaeren', text: 'Wirklich?' },
  abschluss: { id: 'abschluss', art: 'erklaeren', text: 'Fertig.' },
  wiederfinden: 'Oben.',
  kapitel: [
    {
      id: 'a',
      titel: 'A',
      kurz: 'A.',
      erledigt: 'A ist erledigt.',
      erledigtWenn: { zustand: 'bed' },
      brauchtNicht: true,
      schritte: [
        { id: 'a.tun', art: 'handeln', text: 'Tu es.', erledigtWenn: { zustand: 'bed' } },
        { id: 'a.info', art: 'erklaeren', text: 'Info.' },
      ],
    },
    {
      id: 'b',
      titel: 'B',
      kurz: 'B.',
      erledigt: 'B ist erledigt.',
      erledigtWenn: { entscheidung: 'bWahl' },
      brauchtNicht: true,
      schritte: [
        { id: 'b.wahl', art: 'entscheiden', text: 'Wähle.', optionen: [{ knopf: 'Ja', entscheidung: 'bWahl' }, { knopf: 'Weiter' }] },
        { id: 'b.neu', art: 'neustart', text: 'Neu starten.' },
      ],
    },
    {
      id: 'c',
      titel: 'C',
      kurz: 'C.',
      erledigt: 'C ist erledigt.',
      erledigtWenn: { zustand: 'cFertig' },
      brauchtNicht: false,
      schritte: [
        { id: 'c.mitR', art: 'erklaeren', text: 'Nur mit r.', giltWenn: { zustand: 'r' } },
        { id: 'c.info', art: 'erklaeren', text: 'Info C.' },
        { id: 'c.ohneR', art: 'erklaeren', text: 'Nur ohne r.', giltWenn: { nicht: { zustand: 'r' } } },
      ],
    },
  ],
};
const KAP = ['a', 'b', 'c'];
const SCHRITTE: Record<string, readonly string[]> = { a: ['a.tun', 'a.info'], b: ['b.wahl', 'b.neu'], c: ['c.mitR', 'c.info', 'c.ohneR'] };
/** „gilt nur, wenn“ der Mini-Anleitung, als eigene Regel des Tests (nicht über den Kern). */
const GILT: Record<string, (r: boolean) => boolean> = { 'c.mitR': (r) => r, 'c.ohneR': (r) => !r };
const ART: Record<string, string> = {
  'a.tun': 'handeln',
  'a.info': 'erklaeren',
  'b.wahl': 'entscheiden',
  'b.neu': 'neustart',
  'c.mitR': 'erklaeren',
  'c.info': 'erklaeren',
  'c.ohneR': 'erklaeren',
};

const ORTE = ['einleitung', 'rueckfrage', 'abschluss', 'a:', 'a:a.tun', 'a:a.info', 'b:', 'b:b.wahl', 'b:b.neu', 'c:', 'c:c.info', '-'];
const EINZELN = ['-', 'a:a.tun', 'a:a.info', 'b:b.wahl', 'b:b.neu', 'c:c.info'];
const hatSchritt = (o: string): boolean => /^[abc]:[a-z]/.test(o);

/**
 * Grundzustände: Hauptlauf-Ort × „Zeig mir“ × Status × Modus × warErfuellt × bed × a übersprungen × b nicht gebraucht ×
 * cFertig × r (welche Schritte in c gelten).
 */
const BASIS = kreuz({
  ort: ORTE,
  einzeln: EINZELN,
  status: STATUS,
  nurZeigen: [false, true],
  war: [false, true],
  bed: [false, true],
  ueb: [false, true],
  ng: [false, true],
  cFertig: [false, true],
  r: [false, true],
}).filter((c) => (c.einzeln === '-' ? hatSchritt(c.ort) || (!c.nurZeigen && !c.war) : c.ort === '-' || c.ort === 'a:a.tun'));
type Basis = (typeof BASIS)[number];

function ortAusText(o: string, nurZeigen: boolean, war: boolean): AnleitungsPosition | null {
  if (o === '-') return null;
  if (!o.includes(':')) return { ort: o } as AnleitungsPosition;
  const [kapitel, schritt] = o.split(':');
  return { ort: 'kapitel', kapitel, schritt: schritt === '' ? null : schritt, nurZeigen, warErfuellt: war };
}

function basis(c: Basis): AnleitungsFortschritt {
  const position = c.einzeln === '-' ? ortAusText(c.ort, c.nurZeigen, c.war) : ortAusText(c.ort, false, false);
  const einzeln = c.einzeln === '-' ? null : (ortAusText(c.einzeln, c.nurZeigen, c.war) as KapitelPosition);
  const fuehrtNeustart = c.ort === 'b:b.neu' && position?.ort === 'kapitel' && !position.nurZeigen;
  return {
    ...leererFortschritt('ablauf'),
    status: c.status,
    position,
    einzeln,
    uebersprungen: c.ueb ? ['a'] : [],
    nichtGebraucht: c.ng ? ['b'] : [],
    neustart: fuehrtNeustart && (c.status === 'laeuft' || c.status === 'pausiert') ? { schritt: 'b.neu', seit: FRUEHER } : null,
  };
}
const zustandVon = (c: Basis): Record<string, boolean> => ({ bed: c.bed, cFertig: c.cFertig, r: c.r });

interface Ort {
  o: string;
  zeigen: boolean;
  war: boolean;
}
interface Modell {
  status: AnleitungsStatus;
  haupt: Ort | null;
  einzeln: Ort | null;
  ueb: string[];
  ng: string[];
  ereig: string[];
  ents: string[];
  neustart: string;
}

function modellText(m: Modell): string {
  const o = (x: Ort | null): string => (x === null ? '-' : `${x.o}${x.zeigen ? '/zeigen' : ''}${x.war ? '/war' : ''}`);
  return [m.status, `haupt=${o(m.haupt)}`, `einzeln=${o(m.einzeln)}`, `ueb=${m.ueb.join(',')}`, `ng=${m.ng.join(',')}`, `ereig=${m.ereig.join(',')}`, `ents=${m.ents.join(',')}`, `neustart=${m.neustart}`].join(' ');
}

/** Erwarteter Fortschritt nach einem Ereignis, gerechnet über die Reihenfolge der Mini-Anleitung (Regeln 1–13, A2). */
function sollNach(c: Basis, e: AnleitungsEreignis): string {
  const f = basis(c);
  const ortM = (p: AnleitungsPosition | null): Ort | null =>
    p === null ? null : p.ort !== 'kapitel' ? { o: p.ort, zeigen: false, war: false } : { o: `${p.kapitel}:${p.schritt ?? ''}`, zeigen: p.nurZeigen, war: p.warErfuellt };
  const m: Modell = {
    status: f.status,
    haupt: ortM(f.position),
    einzeln: ortM(f.einzeln),
    ueb: [...f.uebersprungen],
    ng: [...f.nichtGebraucht],
    ereig: [],
    ents: [],
    neustart: f.neustart === null ? '-' : `b.neu@${FRUEHER}`,
  };
  const kapZ = (k: string): KapitelZustand => {
    const erledigt = k === 'a' ? c.bed : k === 'b' ? m.ents.length > 0 : c.cFertig;
    return erledigt ? 'erledigt' : m.ng.includes(k) ? 'nichtGebraucht' : m.ueb.includes(k) ? 'uebersprungen' : 'offen';
  };
  const fertigOderNicht = (k: string): boolean => kapZ(k) === 'erledigt' || kapZ(k) === 'nichtGebraucht';
  const ort = (o: string, zeigen = false): Ort => ({ o, zeigen: o.includes(':') && zeigen, war: o === 'a:a.tun' && c.bed });
  const kapVon = (o: string): string => o.split(':')[0];
  const schrittVon = (o: string): string => o.split(':')[1] ?? '';
  /** Die geltenden Schritte eines Kapitels (Reihenfolge der Datei, `giltWenn` nach GILT mit r). */
  const geltend = (k: string): readonly string[] => SCHRITTE[k].filter((s) => GILT[s]?.(c.r) ?? true);
  const eintritt = (ab: number): string => {
    for (let i = ab; i < KAP.length; i++) {
      const k = KAP[i];
      if (kapZ(k) === 'nichtGebraucht') continue;
      return kapZ(k) === 'erledigt' ? `${k}:` : `${k}:${geltend(k)[0]}`;
    }
    return 'abschluss';
  };
  const folge = (o: string): string => {
    const k = kapVon(o);
    const g = geltend(k);
    const i = schrittVon(o) === '' ? Infinity : g.indexOf(schrittVon(o));
    return i + 1 < g.length ? `${k}:${g[i + 1]}` : eintritt(KAP.indexOf(k) + 1);
  };
  const folgeEinzeln = (o: string): string | null => {
    const k = kapVon(o);
    const g = geltend(k);
    const i = g.indexOf(schrittVon(o));
    return i + 1 < g.length ? `${k}:${g[i + 1]}` : null;
  };
  const letzterVor = (vor: number): string => {
    for (let j = vor - 1; j >= 0; j--) {
      const k = KAP[j];
      if (kapZ(k) !== 'nichtGebraucht') return `${k}:${geltend(k)[geltend(k).length - 1]}`;
    }
    return 'einleitung';
  };
  const vor = (o: string, einzeln: boolean): string | null => {
    if (o === 'einleitung') return null;
    if (o === 'rueckfrage') return 'einleitung';
    if (o === 'abschluss') return letzterVor(KAP.length);
    const k = kapVon(o);
    const g = geltend(k);
    const i = g.indexOf(schrittVon(o));
    if (i > 0) return `${k}:${g[i - 1]}`;
    return einzeln ? null : letzterVor(KAP.indexOf(k));
  };
  const setzeHaupt = (o: string, zeigen = false): void => {
    m.haupt = ort(o, zeigen);
    m.neustart = m.status === 'laeuft' && o === 'b:b.neu' && !zeigen ? (m.neustart === '-' ? `b.neu@${JETZT}` : m.neustart) : '-';
  };
  const aktiv = m.einzeln !== null ? 'einzeln' : m.status === 'laeuft' && m.haupt !== null ? 'haupt' : null;
  const blase = aktiv === 'einzeln' ? m.einzeln : aktiv === 'haupt' ? m.haupt : null;
  const weiterDa = (b: Ort): boolean => {
    if (b.o === 'einleitung' || b.o === 'abschluss') return true;
    if (b.o === 'rueckfrage') return false;
    const art = ART[schrittVon(b.o)];
    if (art === undefined) return true;
    return art === 'erklaeren' || (art === 'neustart' && b.zeigen) || (art === 'handeln' && (b.zeigen || b.war));
  };
  const vorwaerts = (): void => {
    if (aktiv === 'einzeln' && m.einzeln !== null) {
      const n = folgeEinzeln(m.einzeln.o);
      m.einzeln = n === null ? null : ort(n, m.einzeln.zeigen);
    } else if (m.haupt !== null) {
      if (m.haupt.o === 'einleitung') setzeHaupt(eintritt(0));
      else if (m.haupt.o === 'abschluss') {
        m.status = KAP.every(fertigOderNicht) ? 'abgeschlossen' : 'durchlaufen';
        m.haupt = null;
        m.neustart = '-';
      } else setzeHaupt(folge(m.haupt.o));
    }
  };
  const hinter = (k: string): void => {
    if (aktiv === 'einzeln') m.einzeln = null;
    else setzeHaupt(eintritt(KAP.indexOf(k) + 1));
  };
  const nachZustand = (): void => {
    if (blase === null || !blase.o.includes(':')) return;
    if (schrittVon(blase.o) === '') {
      // „Schon erledigt“ (Hauptlauf): fällt die Bedingung des Kapitels weg, wird der erste geltende Schritt betreten (Regel 11).
      if (aktiv === 'haupt' && kapZ(kapVon(blase.o)) !== 'erledigt') setzeHaupt(eintritt(KAP.indexOf(kapVon(blase.o))));
      return;
    }
    const art = ART[schrittVon(blase.o)];
    const erfuellt = art === 'handeln' && c.bed;
    if (art === 'handeln' && !blase.zeigen && !blase.war && erfuellt) {
      if (aktiv === 'einzeln') {
        const n = folgeEinzeln(blase.o);
        m.einzeln = n === null ? null : ort(n, blase.zeigen);
      } else setzeHaupt(folge(blase.o));
      return;
    }
    blase.war = erfuellt;
  };

  switch (e.art) {
    case 'starten':
      if (e.kapitel !== undefined) {
        m.einzeln = ort(`${e.kapitel}:${geltend(e.kapitel)[0]}`, kapZ(e.kapitel) === 'erledigt');
        break;
      }
      {
        const vorher = m.status;
        const alt = m.haupt;
        m.status = 'laeuft';
        m.einzeln = null;
        // Fortsetzen (Regel 1): „Schon erledigt“, dessen Kapitel nicht mehr erledigt ist, betritt den ersten geltenden Schritt (Regel 11).
        if (vorher === 'pausiert' && alt !== null && !KAP.every(fertigOderNicht)) {
          setzeHaupt(schrittVon(alt.o) === '' && alt.o.includes(':') && kapZ(kapVon(alt.o)) !== 'erledigt' ? eintritt(KAP.indexOf(kapVon(alt.o))) : alt.o);
        }
        else {
          const offen = KAP.find((k) => !fertigOderNicht(k));
          setzeHaupt(offen !== undefined ? `${offen}:${geltend(offen)[0]}` : kapZ('a') === 'erledigt' ? 'a:' : 'a:a.tun');
        }
      }
      break;
    case 'weiter':
      if (blase !== null && weiterDa(blase)) vorwaerts();
      break;
    case 'zurueck':
      if (blase !== null) {
        const v = vor(blase.o, aktiv === 'einzeln');
        if (v !== null && aktiv === 'einzeln') m.einzeln = ort(v, true);
        else if (v !== null) setzeHaupt(v, true);
      }
      break;
    case 'ueberspringen':
      if (blase !== null && blase.o.includes(':')) {
        const k = kapVon(blase.o);
        if (kapZ(k) !== 'erledigt' && !m.ueb.includes(k)) m.ueb.push(k);
        hinter(k);
      }
      break;
    case 'spaeter':
      if (aktiv === 'einzeln') m.einzeln = null;
      else if (aktiv === 'haupt' && m.haupt !== null && m.haupt.o !== 'rueckfrage') {
        m.status = 'pausiert';
        if (m.haupt.o !== 'b:b.neu') m.neustart = '-';
      }
      break;
    case 'option':
      if (blase !== null && schrittVon(blase.o) === 'b.wahl') {
        if (e.index === 0) {
          m.ents.push(`bWahl@${JETZT}`);
          hinter('b');
        } else if (e.index === 1) vorwaerts();
      }
      break;
    case 'anleitungUeberspringen':
      if (aktiv === 'haupt' && m.haupt?.o === 'einleitung') setzeHaupt('rueckfrage');
      break;
    case 'beenden':
      m.status = 'abgeschlossen';
      m.haupt = null;
      m.einzeln = null;
      m.neustart = '-';
      break;
    case 'brauchtNicht': {
      const k = e.kapitel;
      if (k !== 'c' && !fertigOderNicht(k)) {
        m.ng.push(k);
        m.ueb = m.ueb.filter((x) => x !== k);
        if (m.einzeln !== null && kapVon(m.einzeln.o) === k) m.einzeln = null;
        if (m.haupt !== null && m.haupt.o.includes(':') && kapVon(m.haupt.o) === k) setzeHaupt(eintritt(KAP.indexOf(k) + 1));
      }
      break;
    }
    case 'dochGebraucht':
      m.ng = m.ng.filter((x) => x !== e.kapitel);
      break;
    case 'zustand':
      nachZustand();
      break;
    case 'toolEreignis':
      m.ereig.push(`${e.name}@${JETZT}`);
      nachZustand();
      break;
  }
  return modellText(m);
}

// ── K1: jede Ereignisart über alle Grundzustände ──
{
  const EREIGNISSE: Array<[string, AnleitungsEreignis]> = [
    ['starten', { art: 'starten' }],
    ['starten(a) „Zeig mir“', { art: 'starten', kapitel: 'a' }],
    ['weiter', { art: 'weiter' }],
    ['zurueck', { art: 'zurueck' }],
    ['ueberspringen', { art: 'ueberspringen' }],
    ['spaeter', { art: 'spaeter' }],
    ['option(0) mit Entscheidung', { art: 'option', index: 0 }],
    ['option(1) ohne Entscheidung', { art: 'option', index: 1 }],
    ['anleitungUeberspringen', { art: 'anleitungUeberspringen' }],
    ['beenden', { art: 'beenden' }],
    ['brauchtNicht(a)', { art: 'brauchtNicht', kapitel: 'a' }],
    ['brauchtNicht(b)', { art: 'brauchtNicht', kapitel: 'b' }],
    ['brauchtNicht(c) ohne „Brauche ich nicht“', { art: 'brauchtNicht', kapitel: 'c' }],
    ['dochGebraucht(b)', { art: 'dochGebraucht', kapitel: 'b' }],
    ['zustand', { art: 'zustand' }],
    ['toolEreignis', { art: 'toolEreignis', name: 'gemeldet' }],
    ['starten(c) „Zeig mir“ (gilt nur, wenn)', { art: 'starten', kapitel: 'c' }],
  ];
  for (const [name, e] of EREIGNISSE) {
    pruefeFaelle(`P2 K1: ${name} nach den Regeln 1–13 (Ort × Status × Zeig mir × Modus × Bedingung × Markierungen × gilt nur, wenn)`, BASIS, (c) =>
      vergleiche(kurz(anleitungSchritt(ABLAUF, basis(c), e, zustandVon(c), JETZT)), sollNach(c, e)),
    );
  }
}

// ── Speicher-Attrappen (G8) ──
function speicher(start: Record<string, string> = {}, wirft: { lesen?: boolean; schreiben?: boolean } = {}): AnleitungSpeicher & { daten: Record<string, string> } {
  const daten: Record<string, string> = { ...start };
  return {
    daten,
    getItem: (k) => {
      if (wirft.lesen) throw new Error('gesperrt');
      return Object.prototype.hasOwnProperty.call(daten, k) ? daten[k] : null;
    },
    setItem: (k, v) => {
      if (wirft.schreiben) throw new Error('voll');
      daten[k] = v;
    },
  };
}
const S = 'jmps:anleitung:probe';
{
  const FAELLE: Array<{ fall: string; s: AnleitungSpeicher | null; soll: SpeicherZustand }> = [
    { fall: 'kein Speicher', s: null, soll: 'nichtLesbar' },
    { fall: 'getItem wirft', s: speicher({ [S]: '{"format":1}' }, { lesen: true }), soll: 'nichtLesbar' },
    { fall: 'nichts gespeichert', s: speicher(), soll: 'leer' },
    { fall: 'kaputtes JSON', s: speicher({ [S]: '{kaputt' }), soll: 'kaputt' },
    { fall: 'JSON null', s: speicher({ [S]: 'null' }), soll: 'kaputt' },
    { fall: 'JSON-Liste', s: speicher({ [S]: '[1]' }), soll: 'kaputt' },
    { fall: 'ohne format', s: speicher({ [S]: '{"status":"laeuft"}' }), soll: 'kaputt' },
    { fall: "format '1' als Text", s: speicher({ [S]: '{"format":"1"}' }), soll: 'kaputt' },
    { fall: 'format 1.5', s: speicher({ [S]: '{"format":1.5}' }), soll: 'kaputt' },
    { fall: 'format 0', s: speicher({ [S]: '{"format":0}' }), soll: 'kaputt' },
    { fall: 'format 2 (neuere Fassung)', s: speicher({ [S]: '{"format":2,"status":"laeuft"}' }), soll: 'neuer' },
    { fall: 'format 1', s: speicher({ [S]: '{"format":1,"status":"pausiert"}' }), soll: 'ok' },
  ];
  pruefeFaelle('P2 G8: leseFortschritt je Speicherlage', FAELLE, (c) => vergleiche(leseFortschritt(c.s, S, 'probe').zustand, c.soll));
  const gelesen = leseFortschritt(speicher({ [S]: '{"format":1,"status":"pausiert","hinweisGesehen":"ja"}' }), S, 'probe');
  gleich(gelesen.fortschritt, fortschritt({ status: 'pausiert' }), 'P2 G8: ok liefert den normalisierten Fortschritt (falsch getyptes Feld → Vorgabe)');
  ok(
    ['nichtLesbar', 'leer', 'kaputt', 'neuer'].every((z) => FAELLE.filter((c) => c.soll === z).every((c) => leseFortschritt(c.s, S, 'probe').fortschritt === null)),
    'P2 G8: außer ok liefert leseFortschritt keinen Fortschritt',
  );
  const voll = speicher();
  let wurf = false;
  let ergebnis: boolean[] = [];
  try {
    ergebnis = [schreibeFortschritt(null, S, fortschritt()), schreibeFortschritt(speicher({}, { schreiben: true }), S, fortschritt()), schreibeFortschritt(voll, S, fortschritt({ status: 'laeuft' }))];
  } catch {
    wurf = true;
  }
  gleich([wurf, ...ergebnis], [false, false, false, true], 'P2 G8: schreibeFortschritt wirft nie, false ohne Speicher und bei Wurf, true sonst');
  gleich(leseFortschritt(voll, S, 'probe'), { fortschritt: fortschritt({ status: 'laeuft' }), zustand: 'ok' as const }, 'P2 G8: geschrieben → gelesen ergibt denselben Fortschritt');
}

// ── K2: Start (Speicherlage × bestehender Rechner × gespeicherter Status × Neustart × Hinweis gesehen) ──
{
  const K2 = kreuz({
    speicher: ['ok', 'leer', 'nichtLesbar', 'kaputt', 'neuer'] as const,
    bestehend: [false, true],
    status: STATUS,
    neustart: [false, true],
    hinweis: [false, true],
  });
  pruefeFaelle('P2 K2: beimStart → oeffnen, schreiben, Status und Ort (Spec 4, EP7, EP8)', K2, (c) => {
    const ort: AnleitungsPosition | null = c.neustart
      ? { ort: 'kapitel', kapitel: 'k3', schritt: 'k3.neustart', nurZeigen: false, warErfuellt: false }
      : c.status === 'laeuft' || c.status === 'pausiert'
        ? { ort: 'kapitel', kapitel: 'k1', schritt: 'k1.zugang', nurZeigen: false, warErfuellt: false }
        : null;
    const gespeichert =
      c.speicher === 'ok'
        ? fortschritt({ status: c.status, position: ort, neustart: c.neustart ? { schritt: 'k3.neustart', seit: FRUEHER } : null, hinweisGesehen: c.hinweis })
        : null;
    const r = beimStart(TEST_ANLEITUNG, { fortschritt: gespeichert, zustand: c.speicher }, { bestehenderRechner: c.bestehend }, JETZT);
    let soll: string;
    if (c.speicher === 'nichtLesbar' || c.speicher === 'neuer') soll = 'null false nieGestartet -';
    else if (c.speicher === 'kaputt') soll = 'null true nieGestartet -';
    else if (c.speicher === 'leer') soll = c.bestehend ? 'hinweis true nieGestartet -' : 'anleitung true laeuft einleitung';
    else if (c.neustart) soll = 'anleitung true laeuft k3:k3.danach';
    else if (c.status === 'laeuft') soll = 'null true pausiert k1:k1.zugang';
    else if (c.status === 'nieGestartet' && c.bestehend && !c.hinweis) soll = 'hinweis true nieGestartet -';
    else soll = `null false ${c.status} ${ortText(ort)}`;
    return vergleiche(`${r.oeffnen} ${r.schreiben} ${r.fortschritt.status} ${ortText(r.fortschritt.position)}`, soll);
  });
  const nach = beimStart(
    TEST_ANLEITUNG,
    {
      zustand: 'ok',
      fortschritt: fortschritt({
        status: 'pausiert',
        position: { ort: 'kapitel', kapitel: 'k3', schritt: 'k3.neustart', nurZeigen: false, warErfuellt: false },
        neustart: { schritt: 'k3.neustart', seit: FRUEHER },
        einzeln: { ort: 'kapitel', kapitel: 'k1', schritt: 'k1.oeffnen', nurZeigen: false, warErfuellt: false },
      }),
    },
    { bestehenderRechner: false },
    JETZT,
  ).fortschritt;
  gleich(
    [nach.ereignisse, nach.neustart, nach.einzeln],
    [{ 'neustart:k3.neustart': JETZT }, null, null],
    'P2 EP7: nach verlangtem Neustart Ereignis neustart:‹Schritt› gemerkt, neustart gelöscht, „Zeig mir“ beendet',
  );
  const hinweis = beimStart(TEST_ANLEITUNG, { zustand: 'leer', fortschritt: null }, { bestehenderRechner: true }, JETZT).fortschritt;
  ok(hinweis.hinweisGesehen && hinweis.status === 'nieGestartet', 'P2 EP8: bestehender Rechner bekommt den Hinweis genau einmal (hinweisGesehen gemerkt)');
}

// ── K3: Neustart-Rundreise (schreiben → lesen → beimStart) über alle Grundzustände ──
{
  pruefeFaelle('P2 K3: jeder Grundzustand übersteht schreiben → lesen → Start (laeuft → pausiert, Neustart → weiter)', BASIS, (c) => {
    const s = speicher();
    const f = basis(c);
    if (!schreibeFortschritt(s, S, f)) return 'nicht geschrieben';
    const r = beimStart(ABLAUF, leseFortschritt(s, S, 'ablauf'), { bestehenderRechner: false }, JETZT);
    let soll: AnleitungsFortschritt = { ...f, einzeln: null };
    if (f.neustart !== null) {
      soll = {
        ...soll,
        status: 'laeuft',
        position: { ort: 'kapitel', kapitel: 'c', schritt: 'c.info', nurZeigen: false, warErfuellt: false },
        ereignisse: { 'neustart:b.neu': JETZT },
        neustart: null,
      };
    } else if (f.status === 'laeuft') soll = { ...soll, status: 'pausiert' };
    return vergleiche(kurz(r.fortschritt), kurz(soll));
  });
}

// ── Fortsetzen führt den Ort nach dem Zustand jetzt nach (Regel 1, 11; Fix-Runde 1 zu P3) ──
{
  const A = TEST_ANLEITUNG;
  const ort = (k: string, schritt: string | null) => ({ ort: 'kapitel' as const, kapitel: k, schritt, nurZeigen: false, warErfuellt: false });
  // „Schon erledigt“ von k1, Später, Quelle fällt weg (zustand bewegt den pausierten Lauf nicht), Fortsetzen → erster Schritt statt Lüge.
  let f = fortschritt({ status: 'laeuft', position: ort('k1', null) });
  f = anleitungSchritt(A, f, { art: 'spaeter' }, { quelle: true }, JETZT);
  f = anleitungSchritt(A, f, { art: 'zustand' }, {}, JETZT);
  const still = ortText(f.position);
  f = anleitungSchritt(A, f, { art: 'starten' }, {}, JETZT);
  gleich([f.status, still, ortText(f.position)], ['laeuft', 'k1:', 'k1:k1.oeffnen'], 'P2 1/11: Fortsetzen auf „Schon erledigt“ ohne erledigtes Kapitel betritt den ersten geltenden Schritt');
  // Gegenprobe: bleibt das Kapitel erledigt, bleibt „Schon erledigt“.
  let g = fortschritt({ status: 'laeuft', position: ort('k1', null) });
  g = anleitungSchritt(A, g, { art: 'spaeter' }, { quelle: true }, JETZT);
  g = anleitungSchritt(A, g, { art: 'starten' }, { quelle: true }, JETZT);
  gleich([g.status, ortText(g.position)], ['laeuft', 'k1:'], 'P2 1: Fortsetzen auf „Schon erledigt“ bei weiter erledigtem Kapitel bleibt dort');
  // Der gemerkte Schritt gilt nicht mehr (Rolle Master → Slave): Fortsetzen geht zum nächsten geltenden Schritt.
  let h = fortschritt({ status: 'laeuft', position: ort('k2', 'k2.master') });
  h = anleitungSchritt(A, h, { art: 'spaeter' }, { rolleMaster: true }, JETZT);
  h = anleitungSchritt(A, h, { art: 'zustand' }, { rolleSlave: true }, JETZT);
  h = anleitungSchritt(A, h, { art: 'starten' }, { rolleSlave: true }, JETZT);
  gleich([h.status, ortText(h.position)], ['laeuft', 'k2:k2.slave'], 'P2 1/11: Fortsetzen auf einem Schritt, der nicht mehr gilt, betritt den nächsten geltenden');
  // Gegenprobe: gilt der Schritt weiter, bleibt er.
  let i = fortschritt({ status: 'laeuft', position: ort('k2', 'k2.master') });
  i = anleitungSchritt(A, i, { art: 'spaeter' }, { rolleMaster: true }, JETZT);
  i = anleitungSchritt(A, i, { art: 'starten' }, { rolleMaster: true }, JETZT);
  gleich([i.status, ortText(i.position)], ['laeuft', 'k2:k2.master'], 'P2 1: Fortsetzen auf einem weiter geltenden Schritt bleibt dort');
}

// ── Folgen aus der Einrichtung (Spec 3, 3.1, 4) ──
{
  const A = TEST_ANLEITUNG;
  const s = speicher();
  let st = beimStart(A, leseFortschritt(s, S, 'probe'), { bestehenderRechner: false }, JETZT);
  let f = anleitungSchritt(A, st.fortschritt, { art: 'weiter' }, {}, JETZT);
  const k1 = ortText(f.position);
  f = anleitungSchritt(A, f, { art: 'zustand' }, { offen: true }, JETZT);
  const k1Zugang = ortText(f.position);
  f = anleitungSchritt(A, f, { art: 'spaeter' }, { offen: true }, JETZT);
  schreibeFortschritt(s, S, f);
  st = beimStart(A, leseFortschritt(s, S, 'probe'), { bestehenderRechner: false }, JETZT);
  const nachNeustart = `${st.oeffnen} ${st.fortschritt.status} ${ortText(st.fortschritt.position)}`;
  f = anleitungSchritt(A, st.fortschritt, { art: 'starten' }, { offen: true }, JETZT);
  gleich(
    [k1, k1Zugang, nachNeustart, `${f.status} ${ortText(f.position)}`],
    ['k1:k1.oeffnen', 'k1:k1.zugang', 'null pausiert k1:k1.zugang', 'laeuft k1:k1.zugang'],
    'P2 4: erster Start → k1 → erkannt → Später weiter → Neustart → pausiert → Fortsetzen am gleichen Ort',
  );
}
{
  const A = TEST_ANLEITUNG;
  const s = speicher();
  let f = fortschritt({ status: 'laeuft', position: { ort: 'kapitel', kapitel: 'k3', schritt: 'k3.sicher', nurZeigen: false, warErfuellt: false } });
  f = anleitungSchritt(A, f, { art: 'zustand' }, { sicher: true }, JETZT);
  const amNeustart = `${ortText(f.position)} ${f.neustart?.schritt}`;
  schreibeFortschritt(s, S, f);
  const st = beimStart(A, leseFortschritt(s, S, 'probe'), { bestehenderRechner: false }, JETZT);
  gleich(
    [amNeustart, st.oeffnen, st.fortschritt.status, ortText(st.fortschritt.position), Object.keys(st.fortschritt.ereignisse)],
    ['k3:k3.neustart k3.neustart', 'anleitung', 'laeuft', 'k3:k3.danach', ['neustart:k3.neustart']],
    'P2 EP7: k3.sicher erkannt → k3.neustart merkt den Neustart → Neustart → von selbst weiter bei k3.danach',
  );
}
{
  const A = TEST_ANLEITUNG;
  let f = fortschritt({ status: 'laeuft', position: { ort: 'kapitel', kapitel: 'k1', schritt: 'k1.zugang', nurZeigen: false, warErfuellt: false } });
  f = anleitungSchritt(A, f, { art: 'zurueck' }, {}, JETZT);
  const zurueck = ortText(f.position);
  f = anleitungSchritt(A, f, { art: 'zustand' }, { offen: true }, JETZT);
  const erkannt = ortText(f.position);
  f = anleitungSchritt(A, f, { art: 'weiter' }, { offen: true }, JETZT);
  gleich(
    [zurueck, erkannt, ortText(f.position)],
    ['k1:k1.oeffnen/zeigen', 'k1:k1.oeffnen/zeigen/war', 'k1:k1.zugang'],
    'P2 3.1: Zurück → nur zeigen → erfüllte Bedingung geht nicht von selbst weiter → Weiter führt wieder',
  );
}
{
  const A = TEST_ANLEITUNG;
  const am = fortschritt({ status: 'laeuft', position: { ort: 'kapitel', kapitel: 'k2', schritt: 'k2.allein', nurZeigen: false, warErfuellt: false } });
  const aus = anleitungSchritt(A, am, { art: 'option', index: 0 }, { rolleAus: true }, JETZT);
  const unbekannt = anleitungSchritt(A, am, { art: 'option', index: 0 }, {}, JETZT);
  gleich(
    [kapitelZustand(A, 'k2', { rolleAus: true }, aus), ortText(aus.position), kapitelZustand(A, 'k2', {}, unbekannt), aus.entscheidungen],
    ['erledigt', 'k3:k3.sicher', 'offen', { allein: JETZT }],
    'P2 3.1: Entscheidung „allein“ beendet Kapitel 2 nur mit Rolle aus (eine Voreinstellung zählt nie)',
  );
  const master = anleitungSchritt(A, am, { art: 'zustand' }, { rolleMaster: true }, JETZT);
  ok(ortText(master.position) === 'k2:k2.master', 'P2 11: gilt der Schritt nicht mehr (Rolle jetzt Master) → nächster geltender Schritt k2.master');
}
{
  const A = TEST_ANLEITUNG;
  const alt = fortschritt({ status: 'laeuft', position: { ort: 'kapitel', kapitel: 'k1', schritt: 'k1.alt', nurZeigen: false, warErfuellt: false } });
  const fremd = fortschritt({ status: 'pausiert', position: { ort: 'kapitel', kapitel: 'k9', schritt: 'k9.x', nurZeigen: false, warErfuellt: false } });
  let wurf = false;
  let ergebnis: string[] = [];
  try {
    ergebnis = [
      ortText(anleitungSchritt(A, alt, { art: 'zustand' }, {}, JETZT).position),
      ortText(beimStart(A, { zustand: 'ok', fortschritt: fremd }, { bestehenderRechner: false }, JETZT).fortschritt.position),
      ortText(anleitungSchritt(A, fortschritt({ einzeln: { ort: 'kapitel', kapitel: 'k2', schritt: 'k2.weg', nurZeigen: false, warErfuellt: false } }), { art: 'weiter' }, {}, JETZT).einzeln),
    ];
  } catch {
    wurf = true;
  }
  gleich([wurf, ...ergebnis], [false, 'k1:k1.oeffnen', 'k1:k1.oeffnen', '-'], 'P2 13: unbekannte Schritt- oder Kapitel-ID im gespeicherten Ort → nächster gültiger Ort, nie ein Wurf');
  const eingriff = anleitungSchritt(A, fortschritt({ status: 'laeuft', position: { ort: 'kapitel', kapitel: 'k3', schritt: 'k3.sicher', nurZeigen: false, warErfuellt: false } }), { art: 'weiter' }, {}, JETZT);
  ok(ortText(eingriff.position) === 'k3:k3.neustart', 'P2 A2: der Kern nimmt Weiter bei Eingriff-Schritten an (die Ansicht bietet es nur in der Produktion an)');
  ok(
    [ui.anleitungSchritt, ui.beimStart, ui.leseFortschritt, ui.schreibeFortschritt].every((fn) => typeof fn === 'function'),
    'P2: Exporte aus src/index.ts',
  );
}

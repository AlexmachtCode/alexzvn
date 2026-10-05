// Titler-Selbsttest ohne Electron (tsx): npm run selftest -w @jm/titler
// Master-Link Teil 2b, Spec 9.3: DataLink-Kern (Schlüssel, aktiver Eintrag, Abruf), Datenquelle und
// Speaker-TSV. Kein Netz, kein Fenster, kein Electron-Import: Die CI installiert ohne Postinstalls
// (Spec 9.5), ein Electron-Import bräche hier ab.
import path, { join } from 'node:path';
import { createShow, type Show, type ShowIveoSpeaker } from '@jm/show';
import {
  eigenerOrdner,
  gleicheShowPfad,
  istIveoDataOrdner,
  quellSchritt,
  quellZeile,
  startZustand,
  uebergang,
  zurueckKnopf,
  type GemerkteShow,
  type QuellZustand,
} from '../src/shared/datenquelle';
import {
  companionWerte,
  ersatzSchluessel,
  fuehreZusammen,
  HALTEN_NACH_SENDUNG_MS,
  hinweisLogZeile,
  hinweisText,
  istErsatzSchluessel,
  KENNUNG_SPALTE,
  kernSicht,
  leererKern,
  neueListe,
  parseKvDatei,
  parseTable,
  rufeAb,
  rufeSchluesselAb,
  schritt,
  SCHLUESSEL_MAX,
  setzeSendung,
  uhrTick,
  uhrzeit,
  waehleHinweis,
  type DataEntry,
  type Hinweis,
  type KernZustand,
} from '../src/shared/datalink-kern';
import { resolveVars } from '../src/shared/vars';
import { iveoDataDir, speakersTsvText } from '../src/main/iveo-show';

let failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) console.log(`ok   ${msg}`);
  else {
    failed++;
    console.error(`FAIL ${msg}`);
  }
}

// ── datalink-kern: Tabellen lesen, Schlüssel bilden, zusammenführen (Spec 7.2; 9.3 Nr. 1, 2) ──
{
  // Speaker-TSV mit @kennung hinten (SP4).
  const tsv = speakersTsvText([
    { id: 's-1', name: 'Ada Lovelace', title: 'Mathematik' },
    { id: 's-3', name: 'Alan', title: 'Informatik' },
  ]);
  ok(
    tsv === 'name\tfunktion\ttitle\t@kennung\nAda Lovelace\tMathematik\tMathematik\ts-1\nAlan\tInformatik\tInformatik\ts-3\n',
    'speakersTsvText: Kopf name/funktion/title/@kennung, je Speaker eine Zeile, \\n am Ende',
  );
  ok(
    speakersTsvText([{ id: ' s-7 ', name: 'Ana\tSilva', title: 'Leitung\nPresse' }]).split('\n')[1] === 'Ana Silva\tLeitung Presse\tLeitung Presse\ts-7',
    'speakersTsvText: Tab und Zeilenumbruch in Zellen werden zu Leerzeichen, Kennung getrimmt',
  );
  ok(iveoDataDir('userdata') === join('userdata', 'iveo-data'), 'iveoDataDir: <userData>/iveo-data, ohne Electron');

  // Nr. 1: Die Spalte @kennung wird zum Schlüssel, nie zur Variable.
  const liste = parseTable(tsv, 'speakers.tsv');
  ok(liste.length === 2 && liste[0].key === 's-1' && liste[1].key === 's-3', 'Nr. 1: @kennung landet in key');
  ok(
    JSON.stringify(liste[0].vars) === '{"name":"Ada Lovelace","funktion":"Mathematik","title":"Mathematik"}',
    'Nr. 1: @kennung steht nicht in vars',
  );
  ok(liste[0].label === 'Ada Lovelace' && liste[0].datei === 'speakers.tsv', 'Label aus name, datei = Dateiname');
  ok(resolveVars('{{@kennung}}', liste[0].vars) === '{{@kennung}}', 'Nr. 1: {{@kennung}} löst nie auf (kein Platzhalter)');
  ok(resolveVars('{{name}} · {{funktion}}', liste[0].vars) === 'Ada Lovelace · Mathematik', 'name und funktion lösen weiter auf');
  ok(KENNUNG_SPALTE === '@kennung' && SCHLUESSEL_MAX === 200, 'Konstanten KENNUNG_SPALTE und SCHLUESSEL_MAX');

  const gross = parseTable('Name;@Kennung;Firma\nGrace;g-1;Navy\n', 'gaeste.csv');
  ok(
    gross[0].key === 'g-1' && JSON.stringify(gross[0].vars) === '{"Name":"Grace","Firma":"Navy"}' && gross[0].label === 'Grace',
    '@Kennung in anderer Schreibweise ist ebenfalls der Schlüssel',
  );

  // Rundreise: speakersTsvText → parseTable → key === id; ohne id ein Ersatz-Schlüssel.
  const rund = parseTable(
    speakersTsvText([
      { id: 's-1', name: 'Ada Lovelace', title: 'Mathematik' },
      { id: 's-9', name: 'Hedy' },
      { name: 'Ohne Kennung', title: 'Gast' },
    ]),
    'speakers.tsv',
  );
  ok(rund.map((e) => e.key).join(',') === 's-1,s-9,ersatz:speakers.tsv|Ohne Kennung', 'Rundreise: key === id, ohne id Ersatz-Schlüssel');
  ok(rund[1].vars.funktion === '' && rund[1].label === 'Hedy', 'Rundreise: leere Funktion bleibt leer, Kennung verschiebt nichts');

  // Nr. 2: Ersatz-Schlüssel.
  ok(ersatzSchluessel('speakers.tsv', 'Alan') === 'ersatz:speakers.tsv|Alan', 'Nr. 2: ersatzSchluessel für eine Tabellenzeile');
  ok(ersatzSchluessel('gast.txt') === 'ersatz:gast.txt', 'Nr. 2: ersatzSchluessel für eine schlüssel=wert-Datei');
  ok(istErsatzSchluessel('ersatz:gast.txt') && !istErsatzSchluessel('s-1'), 'istErsatzSchluessel');
  const alans = fuehreZusammen([parseTable('name\tfunktion\nAlan\tInformatik\nAlan\tMathematik\nHedy\t\n', 'speakers.tsv')]);
  ok(
    alans.map((e) => e.key).join(',') === 'ersatz:speakers.tsv|Alan,ersatz:speakers.tsv|Alan#2,ersatz:speakers.tsv|Hedy',
    'Nr. 2: ohne Spalte → ersatz:speakers.tsv|Alan, zweiter Alan → #2',
  );
  const gast = parseKvDatei('# Gast der Woche\nname=Dr. Schmidt\nfunktion: Chefarzt\n', 'gast.txt');
  ok(
    gast !== null && gast.key === 'ersatz:gast.txt' && gast.label === 'Dr. Schmidt' && gast.datei === 'gast.txt',
    'Nr. 2: gast.txt mit name=Dr. Schmidt → key ersatz:gast.txt, Label „Dr. Schmidt“',
  );
  ok(JSON.stringify(gast?.vars) === '{"name":"Dr. Schmidt","funktion":"Chefarzt"}', 'schlüssel=wert: Variablen wie bisher');
  ok(parseKvDatei('funktion=Moderation\n', 'moderation.txt')?.label === 'moderation', 'schlüssel=wert ohne name: Label = Dateiname ohne Endung');
  ok(parseKvDatei('funktion=X\n', 'a.b.txt')?.label === 'a.b', 'schlüssel=wert: nur die letzte Endung fällt weg');
  ok(parseKvDatei('# nur Kommentar\n\n', 'leer.txt') === null, 'schlüssel=wert ohne Variablen → null');

  // @kennung als erste Spalte: Das Label kommt aus name, nie aus der Kennung.
  const vorn = parseTable('@kennung,name,firma\nk-1,Hedy,MGM\n,Grace,Navy\n', 'gaeste.csv');
  ok(vorn[0].key === 'k-1' && vorn[0].label === 'Hedy', '@kennung vorn: Label aus name');
  ok(vorn[1].key === 'ersatz:gaeste.csv|Grace' && vorn[1].label === 'Grace', '@kennung vorn und leer → Ersatz-Schlüssel');
  ok(parseTable('@kennung;firma\nk-1;MGM\n', 'firmen.csv')[0].label === 'MGM', '@kennung vorn ohne Label-Spalte: Rückfall ist die erste andere Spalte');
  const tabVorn = parseTable('@kennung\tname\tfunktion\n\tGrace\tNavy\n', 'gaeste.tsv');
  ok(
    tabVorn[0].key === 'ersatz:gaeste.tsv|Grace' && tabVorn[0].vars.name === 'Grace' && tabVorn[0].vars.funktion === 'Navy',
    'TSV mit leerer @kennung vorn: keine Spalte verschiebt sich',
  );

  // Schlüssel über 200 Zeichen werden gekürzt; zusammenführen ist stabil.
  const lang = (label: string): DataEntry => ({ key: 'k'.repeat(250), label, datei: 'lang.csv', vars: {} });
  const eingabe = [[lang('A'), lang('B')], alans];
  const erst = fuehreZusammen(eingabe);
  ok(erst[0].key === 'k'.repeat(200), 'Schlüssel mit 250 Zeichen → 200');
  ok(erst[1].key === 'k'.repeat(198) + '#2', 'doppelter langer Schlüssel: Zusatz #2 bleibt in 200 Zeichen');
  ok(eingabe[0][0].key.length === 250, 'fuehreZusammen verändert die Eingabe nicht');
  const keys = (l: DataEntry[]): string => l.map((e) => e.key).join('|');
  ok(keys(fuehreZusammen(eingabe)) === keys(erst), 'fuehreZusammen zweimal mit gleicher Eingabe → dieselben Schlüssel');
  ok(keys(fuehreZusammen([erst])) === keys(erst), 'fuehreZusammen ist idempotent');
  ok(erst.length === 5 && erst[2].label === 'Alan' && erst[4].label === 'Hedy', 'fuehreZusammen hält die Reihenfolge der Dateien');
}

// ── Hilfen für die Kern-Fälle (B9, B10) ──
/** Liste wie aus der Speaker-TSV gelesen: speakersTsvText → parseTable → fuehreZusammen. */
function tsvListe(speakers: ShowIveoSpeaker[], datei = 'speakers.tsv'): DataEntry[] {
  return fuehreZusammen([parseTable(speakersTsvText(speakers), datei)]);
}
/** Kernzustand direkt gebaut: Liste, Schlüssel des aktiven Eintrags, auf Sendung. */
function kernMit(eintraege: DataEntry[], aktiv: string | null, aufSendung = false): KernZustand {
  return { ...leererKern(), eintraege, aktiv, aufSendung };
}
const ADA: ShowIveoSpeaker = { id: 's-1', name: 'Ada', title: 'Mathematik' };
const GRACE: ShowIveoSpeaker = { id: 's-2', name: 'Grace', title: 'Navy' };
const ALAN: ShowIveoSpeaker = { id: 's-3', name: 'Alan', title: 'Informatik' };
const HEDY: ShowIveoSpeaker = { id: 's-4', name: 'Hedy', title: 'Film' };
const NEU: ShowIveoSpeaker = { id: 's-5', name: 'Neu', title: 'Gast' };
/** Derselbe Ordner, eigene Dateien (leere Liste wird nicht gehalten). */
const GLEICH = { andererOrdner: false, leerHalten: false };

// ── datalink-kern: aktiver Eintrag über den Schlüssel (Spec 7.3, 7.5, 7.8, 7.9; 9.3 Nr. 3–10, 13–19) ──
{
  const vier = tsvListe([ADA, GRACE, ALAN, HEDY]);
  const fuenf = tsvListe([NEU, ADA, GRACE, ALAN, HEDY]);

  // Nr. 3: Alan bleibt Alan.
  const nr3 = neueListe(kernMit(vier, 's-3', true), fuenf, GLEICH);
  ok(kernSicht(nr3.zustand).activeIndex === 3 && companionWerte(nr3.zustand).entry === 'Alan', 'Nr. 3: „Neu“ davor → aktiv bleibt Alan, jetzt Stelle 4');
  ok(nr3.log.length === 1 && nr3.log[0] === 'DataLink: „Alan“ hält seinen Eintrag (jetzt Nr. 4 von 5).', 'Nr. 3: Logzeile A1 mit neuer Stelle');
  ok(kernSicht(nr3.zustand).variables.name === 'Alan' && nr3.zustand.hinweis === null, 'Nr. 3: Variablen von Alan, kein Hinweis');
  ok(neueListe(nr3.zustand, fuenf, GLEICH).log.length === 0, 'A1 ohne neue Stelle: keine Logzeile');

  // Gegenprobe (9.3): eine Variante, die die Stelle statt des Schlüssels hält, muss an Fall 3 scheitern.
  function neueListeNachStelle(alt: KernZustand, neu: DataEntry[]): KernZustand {
    const stelle = alt.eintraege.findIndex((e) => e.key === alt.aktiv);
    const bleibt = stelle >= 0 && stelle < neu.length ? stelle : 0;
    return { ...alt, eintraege: neu, aktiv: neu.length ? neu[bleibt].key : null };
  }
  const fall3 = (zz: KernZustand): boolean => kernSicht(zz).activeIndex === 3 && companionWerte(zz).entry === 'Alan';
  const variante = neueListeNachStelle(kernMit(vier, 's-3', true), fuenf);
  ok(fall3(nr3.zustand) && !fall3(variante), 'Gegenprobe: der Kern besteht Fall 3, die Variante „Stelle halten“ nicht');
  ok(companionWerte(variante).entry === 'Grace', 'Gegenprobe: … die Variante zeigt Grace statt Alan');

  // Nr. 4: neue Funktion bei gleichem Schlüssel.
  const nr4 = neueListe(nr3.zustand, tsvListe([NEU, ADA, GRACE, { ...ALAN, title: 'Kryptographie' }, HEDY]), GLEICH);
  ok(
    kernSicht(nr4.zustand).activeIndex === 3 && kernSicht(nr4.zustand).variables.funktion === 'Kryptographie',
    'Nr. 4: neue Funktion → derselbe Eintrag, neue Variablen',
  );

  // Nr. 5: Schlüssel fehlt, auf Sendung → A2.
  const ohneAlan = tsvListe([NEU, ADA, GRACE, HEDY]);
  const nr5 = neueListe(kernMit(vier, 's-3', true), ohneAlan, GLEICH);
  const s5 = kernSicht(nr5.zustand);
  ok(s5.activeIndex === -1 && s5.gehalten?.label === 'Alan', 'Nr. 5: auf Sendung → gehalten, kein Eintrag markiert (A2)');
  ok(s5.variables.name === 'Alan' && s5.variables.funktion === 'Informatik', 'Nr. 5: Variablen eingefroren');
  ok(JSON.stringify(s5.hinweis) === '{"art":"H1","label":"Alan"}', 'Nr. 5: Hinweis H1');
  ok(nr5.log.length === 1 && nr5.log[0] === 'DataLink: aktiver Eintrag „Alan“ nicht mehr in der Liste, auf Sendung gehalten.', 'Nr. 5: Logzeile A2');
  ok(nr5.zustand.gehalten?.grund === 'A2' && nr5.zustand.gehalten.key === 's-3', 'Nr. 5: gehalten mit grund A2 und dem Schlüssel');
  const nochmal = neueListe(nr5.zustand, ohneAlan, GLEICH);
  ok(nochmal.zustand.gehalten?.label === 'Alan' && nochmal.zustand.hinweis?.art === 'H1' && nochmal.log.length === 0, 'A2: erneutes Einlesen ohne Alan → bleibt gehalten, keine neue Logzeile');

  // Nr. 6: Schlüssel fehlt, nicht auf Sendung → A3.
  const nr6 = neueListe(kernMit(vier, 's-3', false), ohneAlan, GLEICH);
  const s6 = kernSicht(nr6.zustand);
  ok(s6.activeIndex === -1 && s6.gehalten === undefined && JSON.stringify(s6.variables) === '{}', 'Nr. 6: nicht auf Sendung → kein aktiver Eintrag, leere Variablen (A3)');
  ok(JSON.stringify(s6.hinweis) === '{"art":"H2","label":"Alan"}', 'Nr. 6: Hinweis H2');
  ok(nr6.log.length === 1 && nr6.log[0] === 'DataLink: aktiver Eintrag „Alan“ nicht mehr in der Liste, kein aktiver Eintrag.', 'Nr. 6: Logzeile A3');

  // Nr. 7: gehalten, Sendung endet → 1 s später kein Eintrag (übergebene Uhr).
  ok(HALTEN_NACH_SENDUNG_MS === 1000, 'HALTEN_NACH_SENDUNG_MS = 1000');
  const aus = setzeSendung(nr5.zustand, false, 1000).zustand;
  ok(aus.wegAbMs === 2000 && aus.aufSendung === false, 'Nr. 7: Sendung endet bei 1000 → Frist 2000');
  ok(setzeSendung(aus, false, 1500).zustand.wegAbMs === 2000, 'Nr. 7: eine wiederholte Meldung „nicht auf Sendung“ verschiebt die Frist nicht');
  const t1999 = uhrTick(aus, 1999);
  ok(t1999.zustand.gehalten?.label === 'Alan' && t1999.log.length === 0, 'Nr. 7: bei 1999 noch gehalten');
  const t2000 = uhrTick(aus, 2000);
  const s7 = kernSicht(t2000.zustand);
  ok(s7.gehalten === undefined && s7.activeIndex === -1 && JSON.stringify(s7.variables) === '{}', 'Nr. 7: bei 2000 kein Eintrag mehr (A4)');
  ok(JSON.stringify(s7.hinweis) === '{"art":"H2","label":"Alan"}' && t2000.zustand.wegAbMs === null, 'Nr. 7: … Hinweis H2, Frist weg');
  ok(t2000.log.length === 1 && t2000.log[0] === 'DataLink: aktiver Eintrag „Alan“ nicht mehr in der Liste, kein aktiver Eintrag.', 'Nr. 7: … Logzeile A4');
  const take = setzeSendung(aus, true, 1500).zustand;
  ok(take.wegAbMs === null && uhrTick(take, 5000).zustand.gehalten?.label === 'Alan', 'Nr. 7: TAKE bei 1500 → bleibt gehalten');
  ok(setzeSendung(kernMit(vier, 's-3', true), false, 1000).zustand.wegAbMs === null, 'Ende der Sendung ohne gehaltenen Eintrag: keine Frist');
  ok(uhrTick(nr3.zustand, 99_999).zustand === nr3.zustand, 'uhrTick ohne Frist: unverändert');

  // Nr. 8: gehalten, Schlüssel kommt zurück → A5.
  const nr8 = neueListe(nr5.zustand, fuenf, GLEICH);
  const s8 = kernSicht(nr8.zustand);
  ok(s8.activeIndex === 3 && s8.gehalten === undefined && s8.hinweis === null, 'Nr. 8: Schlüssel zurück → wieder aktiv, Hinweis weg (A5)');
  const nr8b = neueListe(aus, fuenf, GLEICH);
  ok(nr8b.zustand.aktiv === 's-3' && nr8b.zustand.wegAbMs === null, 'Nr. 8: … auch innerhalb der Frist, die Frist entfällt');

  // Nach A10 gehalten (Zustand direkt gebaut, den Abruf gibt es erst in B10): nie wieder aktiv; A4 → H5.
  const a10: KernZustand = {
    ...kernMit(fuenf, null, true),
    gehalten: { key: 's-3', label: 'Alan', datei: 'speakers.tsv', vars: { name: 'Alan' }, grund: 'A10', ref: 'Niemand' },
    hinweis: { art: 'H6', ref: 'Niemand', label: 'Alan' },
  };
  const a10neu = neueListe(a10, fuenf, GLEICH);
  ok(a10neu.zustand.aktiv === null && a10neu.zustand.gehalten?.grund === 'A10', 'A10: beim Neueinlesen nie wieder aktiv, auch wenn der Schlüssel in der Liste steht');
  const a10ende = uhrTick(setzeSendung(a10, false, 0).zustand, 1000);
  ok(a10ende.zustand.gehalten === null && JSON.stringify(a10ende.zustand.hinweis) === '{"art":"H5","ref":"Niemand"}' && a10ende.log.length === 0, 'A4 nach A10: H6 wird zu H5, ohne Logzeile');

  // Nr. 9: Liste komplett ersetzt.
  const nr9 = neueListe(kernMit(vier, 's-3', true), tsvListe([{ id: 's-7', name: 'Zoe' }, ALAN, { id: 's-8', name: 'Max' }]), GLEICH);
  ok(kernSicht(nr9.zustand).activeIndex === 1 && companionWerte(nr9.zustand).entry === 'Alan', 'Nr. 9: Liste ersetzt, Alan an anderer Stelle → Alan');

  // Nr. 10: Liste schrumpft unter die alte Stelle.
  const nr10 = neueListe(nr3.zustand, tsvListe([ADA, ALAN]), GLEICH);
  ok(kernSicht(nr10.zustand).activeIndex === 1 && companionWerte(nr10.zustand).entry === 'Alan', 'Nr. 10: Liste schrumpft unter die alte Stelle → weiter Alan');

  // Nr. 13: Companion-Werte.
  ok(JSON.stringify(companionWerte(nr3.zustand)) === '{"entry":"Alan","entryIndex":4,"entryCount":5}', 'Nr. 13: Companion aktiv');
  ok(JSON.stringify(companionWerte(nr5.zustand)) === '{"entry":"Alan","entryIndex":0,"entryCount":4}', 'Nr. 13: Companion gehalten');
  ok(JSON.stringify(companionWerte(nr6.zustand)) === '{"entry":"","entryIndex":0,"entryCount":4}', 'Nr. 13: Companion keiner');

  // Nr. 14: anderer Ordner (A8/A9), erster Start, A7.
  const gaeste = fuehreZusammen([parseTable('name,firma\nZoe,ACME\nMax,Muster\n', 'gaeste.csv')]);
  const wechsel = { andererOrdner: true, leerHalten: false };
  const nr14 = neueListe(kernMit(vier, 's-3', false), gaeste, wechsel);
  ok(kernSicht(nr14.zustand).activeIndex === 0 && nr14.zustand.hinweis === null && nr14.log.length === 0, 'Nr. 14: anderer Ordner, nicht auf Sendung, Schlüssel fehlt → Eintrag 1 (A9)');
  const a8 = neueListe(kernMit(vier, 's-3', true), gaeste, wechsel);
  ok(a8.zustand.gehalten?.label === 'Alan' && a8.zustand.hinweis?.art === 'H1', 'A8: anderer Ordner auf Sendung, Schlüssel fehlt → gehalten (A2)');
  ok(neueListe(kernMit(vier, 's-3', true), fuenf, wechsel).zustand.aktiv === 's-3', 'A8: anderer Ordner, Schlüssel gefunden → A1');
  ok(kernSicht(neueListe(nr6.zustand, gaeste, wechsel).zustand).activeIndex === 0 && neueListe(nr6.zustand, gaeste, wechsel).zustand.hinweis === null, 'A9 ohne aktiven Eintrag: Eintrag 1, alter Hinweis weg');
  // A8 ohne aktiven Eintrag: Nach A3/A4 ist nichts aktiv, ein TAKE zeigt leere Platzhalter. Ein Ordnerwechsel auf Sendung
  // (Ordnerwahl, K1, andere Show) darf die Bauchbinde nicht ohne Abruf auf Person 1 springen lassen.
  const ohneEintragAuf: KernZustand = { ...kernMit(vier, null, true), hinweis: { art: 'H2', label: 'Alan' } };
  const a8leer = neueListe(ohneEintragAuf, gaeste, wechsel);
  const s8leer = kernSicht(a8leer.zustand);
  ok(
    s8leer.activeIndex === -1 && s8leer.gehalten === undefined && JSON.stringify(s8leer.variables) === '{}' && s8leer.entries.length === 2 &&
      JSON.stringify(a8leer.zustand.hinweis) === '{"art":"H2","label":"Alan"}' && a8leer.log.length === 0,
    'A8 ohne aktiven Eintrag: anderer Ordner auf Sendung → bleibt ohne Eintrag, leere Variablen, Hinweis bleibt',
  );
  ok(kernSicht(neueListe(leererKern(), vier, { andererOrdner: true, leerHalten: true }).zustand).activeIndex === 0, 'erster Start (anderer Ordner, nichts aktiv) → Eintrag 1');
  ok(kernSicht(neueListe(leererKern(), vier, GLEICH).zustand).activeIndex === -1, 'gleicher Ordner, nichts aktiv → bleibt ohne Eintrag');
  const a7 = neueListe(nr3.zustand, [], { andererOrdner: false, leerHalten: true });
  ok(a7.zustand === nr3.zustand && a7.log.length === 0, 'A7: leere Liste bei leerHalten → unverändert');
  const leerWechsel = neueListe(kernMit(vier, 's-3', false), [], { andererOrdner: true, leerHalten: true });
  ok(leerWechsel.zustand.eintraege.length === 0 && leerWechsel.zustand.aktiv === null && leerWechsel.zustand.hinweis === null, 'Wechsel auf einen leeren Ordner: Liste leer, ohne Hinweis (kein A7)');

  // Nr. 15 und 16: Brücke zwischen Ersatz-Schlüssel und Kennung (5.3, 7.3).
  const ohneIds = tsvListe([{ name: 'Ada', title: 'Mathematik' }, { name: 'Alan', title: 'Informatik' }]);
  const mitIds = tsvListe([ADA, ALAN]);
  for (const sendung of [true, false]) {
    const wie = sendung ? 'auf Sendung' : 'ohne Sendung';
    const hin = neueListe(kernMit(ohneIds, 'ersatz:speakers.tsv|Alan', sendung), mitIds, GLEICH);
    ok(hin.zustand.aktiv === 's-3' && hin.zustand.gehalten === null && hin.zustand.hinweis === null, `Nr. 15: Brücke Ersatz → Kennung (${wie}): derselbe Eintrag, neuer Schlüssel, kein Hinweis`);
    ok(hin.log.length === 1 && hin.log[0] === 'DataLink: „Alan“ hält seinen Eintrag, Schlüssel wechselt (ersatz:speakers.tsv|Alan → s-3).', `Nr. 15: … Logzeile Brücke (${wie})`);
    const zurueck = neueListe(kernMit(mitIds, 's-3', sendung), ohneIds, GLEICH);
    ok(zurueck.zustand.aktiv === 'ersatz:speakers.tsv|Alan' && zurueck.zustand.gehalten === null && zurueck.zustand.hinweis === null, `Nr. 16: Brücke Kennung → Ersatz (${wie})`);
    ok(zurueck.log[0] === 'DataLink: „Alan“ hält seinen Eintrag, Schlüssel wechselt (s-3 → ersatz:speakers.tsv|Alan).', `Nr. 16: … Logzeile Brücke (${wie})`);
  }
  const schreibweise = neueListe(kernMit(tsvListe([{ name: 'ALAN   TURING' }]), 'ersatz:speakers.tsv|ALAN   TURING', true), tsvListe([{ id: 's-3', name: 'Alan Turing' }]), GLEICH);
  ok(schreibweise.zustand.aktiv === 's-3', 'Brücke: Label ohne Rücksicht auf Groß-/Kleinschreibung, Leerraum zusammengefasst');

  // Nr. 17: Brücke beim gehaltenen Eintrag → A5.
  const gehaltenErsatz = neueListe(kernMit(ohneIds, 'ersatz:speakers.tsv|Alan', true), tsvListe([{ name: 'Ada' }]), GLEICH).zustand;
  const nr17 = neueListe(gehaltenErsatz, mitIds, GLEICH);
  ok(gehaltenErsatz.gehalten?.key === 'ersatz:speakers.tsv|Alan', 'Nr. 17: Vorbedingung: Alan mit Ersatz-Schlüssel gehalten');
  ok(nr17.zustand.aktiv === 's-3' && nr17.zustand.gehalten === null && nr17.zustand.hinweis === null, 'Nr. 17: Brücke beim gehaltenen Eintrag → wieder aktiv mit der Kennung (A5)');
  ok(nr17.log.length === 1 && nr17.log[0] === 'DataLink: „Alan“ hält seinen Eintrag, Schlüssel wechselt (ersatz:speakers.tsv|Alan → s-3).', 'Nr. 17: … Logzeile Brücke');

  // Nr. 18: kein eindeutiger Kandidat → A2 bzw. A3.
  const doppelt = tsvListe([ADA, ALAN, { id: 's-8', name: 'Alan', title: 'Zweiter' }]);
  const andereDatei = fuehreZusammen([parseTable(speakersTsvText([ADA]), 'speakers.tsv'), parseTable(speakersTsvText([ALAN]), 'gaeste.tsv')]);
  for (const [liste, wo] of [[doppelt, 'Name zweimal in der Datei'], [andereDatei, 'Name nur in einer anderen Datei']] as const) {
    const auf = neueListe(kernMit(ohneIds, 'ersatz:speakers.tsv|Alan', true), liste, GLEICH);
    ok(auf.zustand.aktiv === null && auf.zustand.gehalten?.label === 'Alan' && auf.zustand.hinweis?.art === 'H1', `Nr. 18: ${wo}, auf Sendung → keine Brücke, A2`);
    const ab = neueListe(kernMit(ohneIds, 'ersatz:speakers.tsv|Alan', false), liste, GLEICH);
    ok(ab.zustand.aktiv === null && ab.zustand.gehalten === null && ab.zustand.hinweis?.art === 'H2', `Nr. 18: ${wo}, ohne Sendung → keine Brücke, A3`);
  }

  // Nr. 19: zwei verschiedene Kennungen, gleicher Name → nie überbrücken.
  const andereKennung = tsvListe([ADA, { id: 's-9', name: 'Alan', title: 'Informatik' }]);
  const n19auf = neueListe(kernMit(mitIds, 's-3', true), andereKennung, GLEICH);
  ok(n19auf.zustand.aktiv === null && n19auf.zustand.gehalten?.key === 's-3' && !n19auf.log.some((l) => l.includes('Schlüssel wechselt')), 'Nr. 19: s-3 → s-9 gleicher Name, auf Sendung → keine Brücke, A2');
  const n19ab = neueListe(kernMit(mitIds, 's-3', false), andereKennung, GLEICH);
  ok(n19ab.zustand.aktiv === null && n19ab.zustand.hinweis?.art === 'H2', 'Nr. 19: … ohne Sendung → keine Brücke, A3');

  // Review Focus 1: eigene CSV wird beim Speichern kurz leer oder halb gelesen (Quelle ordner, leerHalten:false).
  const csv = 'name,funktion\nAda,Mathematik\nAlan,Informatik\n';
  const eigene = fuehreZusammen([parseTable(csv, 'gaeste.csv')]);
  const alanCsv = 'ersatz:gaeste.csv|Alan';
  const leerAuf = neueListe(kernMit(eigene, alanCsv, true), fuehreZusammen([parseTable('', 'gaeste.csv')]), GLEICH);
  ok(kernSicht(leerAuf.zustand).activeIndex === -1 && leerAuf.zustand.gehalten?.label === 'Alan' && leerAuf.zustand.hinweis?.art === 'H1', 'Review 1: CSV leer gelesen, auf Sendung → Alan gehalten mit H1, nicht Eintrag 1');
  const halb = neueListe(kernMit(eigene, alanCsv, true), fuehreZusammen([parseTable('name,funktion\nAda,Mathematik\n', 'gaeste.csv')]), GLEICH);
  ok(halb.zustand.gehalten?.label === 'Alan' && companionWerte(halb.zustand).entry === 'Alan' && kernSicht(halb.zustand).activeIndex === -1, 'Review 1: CSV halb gelesen → gehalten, Ada wird nicht aktiv');
  const zurueckAuf = neueListe(leerAuf.zustand, eigene, GLEICH);
  ok(kernSicht(zurueckAuf.zustand).activeIndex === 1 && zurueckAuf.zustand.hinweis === null, 'Review 1: Zeile kommt zurück → Alan wieder aktiv (A5), ohne Hinweis');
  const leerAus = neueListe(kernMit(eigene, alanCsv, false), [], GLEICH);
  ok(kernSicht(leerAus.zustand).activeIndex === -1 && leerAus.zustand.hinweis?.art === 'H2', 'Review 1: ohne Sendung → kein aktiver Eintrag (A3)');
  ok(kernSicht(neueListe(leerAus.zustand, eigene, GLEICH).zustand).activeIndex === -1, 'Review 1: … nach dem Zurückkommen wird nicht von selbst Eintrag 1 aktiv');
  ok(neueListe(leerAus.zustand, eigene, GLEICH).zustand.hinweis === null, 'Fix 1: … der Hinweis H2 endet, wenn die Zeile wieder in der Liste steht');
  const ohneAlanCsv = fuehreZusammen([parseTable('name,funktion\nAda,Mathematik\n', 'gaeste.csv')]);
  ok(neueListe(leerAus.zustand, ohneAlanCsv, GLEICH).zustand.hinweis?.art === 'H2', 'Fix 1: … fehlt die Zeile weiter, bleibt H2');
  const a4h2 = uhrTick(setzeSendung(leerAuf.zustand, false, 0).zustand, HALTEN_NACH_SENDUNG_MS + 1);
  ok(a4h2.zustand.hinweis?.art === 'H2' && neueListe(a4h2.zustand, eigene, GLEICH).zustand.hinweis === null, 'Fix 1: A4 → H2 → Person kommt zurück → Hinweis weg');

  // Hinweise: Texte wörtlich (7.8), Logzeilen (7.9), Vorrang.
  const lokal = new Date(2026, 8, 29, 9, 58).toISOString();
  ok(uhrzeit(lokal) === '09:58', 'uhrzeit: Ortszeit hh:mm');
  ok(uhrzeit('gestern') === '--:--', 'uhrzeit: unlesbar → --:--');
  const H1: Hinweis = { art: 'H1', label: 'Alan' };
  const H2: Hinweis = { art: 'H2', label: 'Alan' };
  const H3: Hinweis = { art: 'H3' };
  const H4: Hinweis = { art: 'H4', grund: 'EBUSY' };
  const H5: Hinweis = { art: 'H5', ref: 'Niemand' };
  const H6: Hinweis = { art: 'H6', ref: 'Niemand', label: 'Alan' };
  const H7: Hinweis = { art: 'H7', seit: lokal };
  ok(hinweisText(H1) === '„Alan“ ist nicht mehr in der Liste. Die Bauchbinde bleibt stehen, bis du sie ausblendest oder einen Eintrag abrufst.', 'H1 wörtlich');
  ok(hinweisText(H2) === '„Alan“ ist nicht mehr in der Liste. Bitte einen Eintrag abrufen.', 'H2 wörtlich');
  ok(hinweisText(H3) === 'Liste aus früherem Stand: Die Show enthält gerade keine Speaker.', 'H3 wörtlich');
  ok(hinweisText(H4) === 'Liste aus früherem Stand: Show nicht lesbar (EBUSY).', 'H4 wörtlich');
  ok(hinweisText(H5) === 'Abruf „Niemand“: nicht in der Liste. Bitte einen Eintrag abrufen.', 'H5 wörtlich');
  ok(hinweisText(H6) === 'Abruf „Niemand“: nicht in der Liste. Auf Sendung bleibt „Alan“, bis du sie ausblendest oder einen Eintrag abrufst.', 'H6 wörtlich');
  ok(hinweisText(H7) === 'Liste aus früherem Stand: Speakerliste von iveo nicht abrufbar (seit 09:58).', 'H7 wörtlich, Ortszeit aus speakerVeraltetSeit');
  ok(hinweisLogZeile(H7) === 'iveo: Show meldet Speakerliste nicht abrufbar seit 09:58, Liste aus früherem Stand.', 'Logzeile H7');
  ok(hinweisLogZeile(H3) === 'iveo: Show ohne Speaker, Liste aus früherem Stand bleibt.', 'Logzeile H3');
  ok([H1, H2, H4, H5, H6].every((h) => hinweisLogZeile(h) === null), 'keine Logzeile für H1, H2, H4, H5, H6');
  ok(waehleHinweis(H3, H7) === H7 && waehleHinweis(H7, H3) === H7, 'Vorrang: H7 vor H3');
  ok(waehleHinweis(H7, H4) === H4, 'Vorrang: H4 vor H7');
  ok(waehleHinweis(H4, H2) === H2 && waehleHinweis(H4, H5) === H5, 'Vorrang: H2/H5 vor H4');
  ok(waehleHinweis(H5, H6) === H6 && waehleHinweis(H2, H1) === H1, 'Vorrang: H1/H6 vor H2/H5');
  ok(waehleHinweis(H1, H6) === H1 && waehleHinweis(H6, H1) === H6, 'gleicher Rang: der zuerst übergebene');
  ok(waehleHinweis(null, undefined) === null && waehleHinweis() === null, 'kein Hinweis → null');
}

// ── datalink-kern: Abruf, @-Form, Klick, Weiter/Zurück, ohne Treffer (Spec 7.4, 7.3 A6/A10/A11; 9.3 Nr. 11, 12, 20, 21) ──
{
  const fuenf = tsvListe([NEU, ADA, GRACE, ALAN, HEDY]);
  const frei = kernMit(fuenf, null);

  // Nr. 11: Nummer, Schlüssel, Label exakt, Teilstring — danach hält der Titler den Schlüssel.
  ok(rufeAb(frei, '3').zustand.aktiv === 's-2', 'Nr. 11: „3“ → Nummer 3 (Grace)');
  ok(rufeAb(frei, 'S-4').zustand.aktiv === 's-4', 'Nr. 11: Schlüssel exakt, ohne Groß-/Kleinschreibung');
  ok(rufeAb(frei, '  alan ').zustand.aktiv === 's-3', 'Nr. 11: Label exakt (getrimmt, ohne Groß-/Kleinschreibung)');
  ok(rufeAb(frei, 'ra').zustand.aktiv === 's-2', 'Nr. 11: Label als Teilstring, erster Treffer');
  const vorrang: DataEntry[] = [
    { key: 'k-1', label: 'Beta', datei: 'a.csv', vars: {} },
    { key: 'beta', label: 'Gamma', datei: 'a.csv', vars: {} },
    { key: 'k-3', label: 'Anabel', datei: 'a.csv', vars: {} },
    { key: 'k-4', label: 'Ana', datei: 'a.csv', vars: {} },
  ];
  ok(rufeAb(kernMit(vorrang, null), 'BETA').zustand.aktiv === 'beta', 'Reihenfolge: Schlüssel vor Label');
  ok(rufeAb(kernMit(vorrang, null), 'ana').zustand.aktiv === 'k-4', 'Reihenfolge: Label exakt vor Teilstring');
  const gehalten = neueListe(kernMit(fuenf, 's-3', true), tsvListe([NEU, ADA]), GLEICH).zustand;
  const a6 = rufeAb(setzeSendung(gehalten, false, 0).zustand, '2');
  ok(
    a6.zustand.aktiv === 's-1' && a6.zustand.gehalten === null && a6.zustand.hinweis === null && a6.zustand.wegAbMs === null && a6.log.length === 0,
    'A6: Abruf mit Treffer → gewählter Eintrag; gehalten, Hinweis und Frist weg',
  );

  // Nr. 12: Weiter und Zurück.
  ok(schritt(frei, 1).zustand.aktiv === 's-5' && schritt(frei, -1).zustand.aktiv === 's-5', 'Nr. 12: Weiter und Zurück ohne aktiven Eintrag → Eintrag 1');
  ok(schritt(gehalten, 1).zustand.aktiv === 's-5' && schritt(gehalten, 1).zustand.gehalten === null, 'Nr. 12: … auch bei gehaltenem Eintrag (wirkt wie A6)');
  ok(schritt(kernMit(fuenf, 's-2'), 1).zustand.aktiv === 's-3' && schritt(kernMit(fuenf, 's-2'), -1).zustand.aktiv === 's-1', 'Weiter/Zurück von der Stelle des aktiven Eintrags');
  ok(schritt(kernMit(fuenf, 's-4'), 1).zustand.aktiv === 's-4' && schritt(kernMit(fuenf, 's-5'), -1).zustand.aktiv === 's-5', 'Weiter/Zurück begrenzt auf die Liste, kein Umlauf');
  const leer = kernMit([], null);
  ok(schritt(leer, 1).zustand === leer, 'Weiter bei leerer Liste → unverändert');

  // Nr. 20: Abruf ohne Treffer (unbekannter Name, Nummer 7 bei 5 Einträgen).
  for (const ref of ['Niemand', '7']) {
    const aus = rufeAb(kernMit(fuenf, 's-3', false), ref);
    ok(
      aus.zustand.aktiv === null && aus.zustand.gehalten === null && JSON.stringify(aus.zustand.hinweis) === JSON.stringify({ art: 'H5', ref }),
      `Nr. 20: „${ref}“ ohne Sendung → kein aktiver Eintrag, H5 (A11)`,
    );
    ok(aus.log.length === 1 && aus.log[0] === `DataLink: Abruf „${ref}“ ohne Treffer, kein aktiver Eintrag.`, `Nr. 20: „${ref}“ … Logzeile A11`);
    const auf = rufeAb(kernMit(fuenf, 's-3', true), ref);
    ok(
      auf.zustand.aktiv === null && auf.zustand.gehalten?.label === 'Alan' && auf.zustand.gehalten.grund === 'A10' && auf.zustand.gehalten.ref === ref,
      `Nr. 20: „${ref}“ auf Sendung → Alan gehalten, grund A10 (A10)`,
    );
    ok(JSON.stringify(auf.zustand.hinweis) === JSON.stringify({ art: 'H6', ref, label: 'Alan' }), `Nr. 20: „${ref}“ … Hinweis H6`);
    ok(kernSicht(auf.zustand).variables.name === 'Alan' && kernSicht(auf.zustand).activeIndex === -1, `Nr. 20: „${ref}“ … Variablen eingefroren, nichts markiert`);
    ok(auf.log[0] === `DataLink: Abruf „${ref}“ ohne Treffer, auf Sendung gehalten.`, `Nr. 20: „${ref}“ … Logzeile A10`);
  }
  const leerAus = rufeAb(kernMit([], null, false), '1');
  ok(JSON.stringify(leerAus.zustand.hinweis) === '{"art":"H5","ref":"1"}' && leerAus.zustand.aktiv === null, 'Nr. 20: leere Liste, ohne Sendung → H5');
  const leerAuf = rufeAb(kernMit([], null, true), 'Alan');
  ok(leerAuf.zustand.gehalten === null && leerAuf.zustand.hinweis?.art === 'H5', 'Nr. 20: leere Liste auf Sendung, vorher kein Eintrag → H5, nichts gehalten');
  ok(leerAuf.log[0] === 'DataLink: Abruf „Alan“ ohne Treffer, kein aktiver Eintrag.', 'Nr. 20: … Logzeile „kein aktiver Eintrag“');
  const vonGehalten = rufeAb(gehalten, 'Niemand');
  ok(vonGehalten.zustand.gehalten?.label === 'Alan' && vonGehalten.zustand.gehalten.grund === 'A10' && vonGehalten.zustand.hinweis?.art === 'H6', 'Nr. 20: ein gehaltener Eintrag bleibt bei A10 gehalten, jetzt mit grund A10 und H6');
  const h6 = rufeAb(kernMit(fuenf, 's-3', true), 'Niemand').zustand;
  const wieder = rufeAb(h6, 'Grace');
  ok(wieder.zustand.aktiv === 's-2' && wieder.zustand.hinweis === null && wieder.zustand.gehalten === null, 'Nr. 20: danach ein Abruf mit Treffer → Hinweis weg');
  const ende = setzeSendung(h6, false, 10_000).zustand;
  const h5 = uhrTick(ende, 11_000);
  ok(h5.zustand.gehalten === null && JSON.stringify(h5.zustand.hinweis) === '{"art":"H5","ref":"Niemand"}' && h5.log.length === 0, 'Nr. 20: H6 → H5 nach Ende der Sendung + 1 s, ohne Logzeile');
  const h6NeueListe = neueListe(h6, fuenf, GLEICH).zustand;
  ok(h6NeueListe.aktiv === null && h6NeueListe.gehalten?.grund === 'A10', 'A10: beim Neueinlesen nie wieder aktiv, auch wenn der Schlüssel in der Liste steht (nach rufeAb)');

  // Nr. 21: @-Form.
  ok(rufeAb(frei, '@s-3 Alan').zustand.aktiv === 's-3', 'Nr. 21: @-Form, die Kennung trifft');
  ok(rufeAb(frei, '@S-3').zustand.aktiv === 's-3', 'Nr. 21: @-Form ohne Namen, ohne Groß-/Kleinschreibung');
  ok(rufeAb(frei, '@x-404   alan ').zustand.aktiv === 's-3', 'Nr. 21: Kennung fehlt, Name genau gleich → trifft');
  const teil = rufeAb(kernMit(fuenf, 's-1', false), '@x-404 Ala');
  ok(teil.zustand.aktiv === null && JSON.stringify(teil.zustand.hinweis) === '{"art":"H5","ref":"Ala"}', 'Nr. 21: Name nur als Teilstring → kein Treffer (A11), ⟨ref⟩ ist der Name');
  const teilAuf = rufeAb(kernMit(fuenf, 's-1', true), '@x-404 Ala');
  ok(teilAuf.zustand.gehalten?.label === 'Ada' && JSON.stringify(teilAuf.zustand.hinweis) === '{"art":"H6","ref":"Ala","label":"Ada"}', 'Nr. 21: … auf Sendung A10 mit H6');
  ok(JSON.stringify(rufeAb(frei, '@x-404').zustand.hinweis) === '{"art":"H5","ref":"x-404"}', 'Nr. 21: ohne Namen ist ⟨ref⟩ die Kennung');
  const zwanzig: DataEntry[] = Array.from({ length: 20 }, (_v, i) => ({ key: i === 2 ? '17' : `k${i + 1}`, label: `Person ${i + 1}`, datei: 'liste.csv', vars: {} }));
  ok(rufeAb(kernMit(zwanzig, null), '@17').zustand.aktiv === '17', 'Nr. 21: @17 trifft den Schlüssel „17“');
  ok(rufeAb(kernMit(zwanzig, null), '17').zustand.aktiv === 'k17', 'Nr. 21: 17 trifft die Nummer 17');
  ok(rufeAb(frei, '@').zustand === frei, '„@“ allein bleibt wirkungslos');
  ok(JSON.stringify(rufeAb(frei, '0').zustand.hinweis) === '{"art":"H5","ref":"0"}', 'Nummer 0 → ohne Treffer');

  // Klick über den Schlüssel.
  ok(rufeSchluesselAb(frei, 's-4').zustand.aktiv === 's-4', 'Klick: der Schlüssel trifft');
  ok(rufeSchluesselAb(frei, 'S-4').zustand.aktiv === null, 'Klick: nur der Schlüssel exakt');
  const klick = rufeSchluesselAb(kernMit(fuenf, 's-1', false), 'ersatz:speakers.tsv|Weg');
  ok(klick.zustand.aktiv === null && JSON.stringify(klick.zustand.hinweis) === '{"art":"H5","ref":"ersatz:speakers.tsv|Weg"}', 'Ein Schlüssel nicht in der Liste → H5 mit dem Schlüssel');
  const klickAuf = rufeSchluesselAb(kernMit(fuenf, 's-1', true), 'ersatz:speakers.tsv|Weg');
  ok(klickAuf.zustand.gehalten?.label === 'Ada' && klickAuf.zustand.hinweis?.art === 'H6', '… auf Sendung H6, Ada gehalten');
  ok(rufeSchluesselAb(frei, '').zustand === frei, 'Klick mit leerem Schlüssel → unverändert');

  // Leerer ref.
  const vorher = kernMit(fuenf, 's-2', true);
  ok(rufeAb(vorher, '').zustand === vorher && rufeAb(vorher, '   ').zustand === vorher && rufeAb(vorher, '').log.length === 0, 'Leerer ref → Zustand unverändert');

  // Review Focus 5: zwei Speaker gleichen Namens mit verschiedenen Kennungen.
  const ana = tsvListe([{ id: 's-7', name: 'Ana Silva', title: 'Presse' }, { id: 's-9', name: 'Ana Silva', title: 'Technik' }, ADA]);
  const zAna = kernMit(ana, null);
  ok(rufeAb(zAna, '@s-9 Ana Silva').zustand.aktiv === 's-9', 'Review 5: @s-9 Ana Silva trifft genau s-9');
  ok(rufeAb(zAna, 'Ana Silva').zustand.aktiv === 's-7', 'Review 5: der reine Name trifft die erste, s-7');
  const s9 = setzeSendung(rufeAb(zAna, '@s-9 Ana Silva').zustand, true, 0).zustand;
  const weg = neueListe(s9, tsvListe([{ id: 's-7', name: 'Ana Silva', title: 'Presse' }, ADA]), GLEICH);
  ok(weg.zustand.gehalten?.key === 's-9' && weg.zustand.aktiv === null && weg.zustand.hinweis?.art === 'H1', 'Review 5: s-9 verschwindet auf Sendung → gehalten (A2)');
  ok(kernSicht(weg.zustand).variables.funktion === 'Technik' && !weg.log.some((l) => l.includes('Schlüssel wechselt')), 'Review 5: … keine Brücke auf s-7, gezeichnet bleibt s-9');
}

// ── datenquelle: Datenquelle, gemerkte Show, Übergang, Q1–Q3, K1 (Spec 7.6, 7.7, 7.8; 9.3 „datenquelle“, Nr. 22) ──
{
  // Windows-Pfade auf jeder Plattform gleich aufgelöst (die CI läuft unter Linux). Die Produktion
  // übergibt path.resolve; einen Fall damit gibt es unten bei Review Focus 2.
  const aufloesen = path.win32.resolve;
  const IVEO = 'C:\\Users\\op\\AppData\\Roaming\\JM Titler\\iveo-data';
  const P1 = 'C:\\Shows\\Tag1.jmshow';
  const P2 = 'C:\\Shows\\Tag2.jmshow';
  function showMit(name: string, speakers: ShowIveoSpeaker[], speakerVeraltetSeit?: string): Show {
    const iveo: NonNullable<Show['iveo']> = { event: 'cop31' };
    if (speakers.length) iveo.speakers = speakers;
    if (speakerVeraltetSeit) iveo.speakerVeraltetSeit = speakerVeraltetSeit;
    return { ...createShow(name), iveo };
  }
  const mit = showMit('Tag 1', [ADA, ALAN]);
  const ohne1 = showMit('Tag 1', []);
  const ohne2 = showMit('Tag 2', []);
  const zShow: QuellZustand = { art: 'show', showPfad: P1, showName: 'Tag 1', quellHinweis: null };
  const zOrdner: QuellZustand = { art: 'ordner', showPfad: null, showName: null, quellHinweis: null };
  const zFrueher = startZustand(null, true);
  const alle = [['show', zShow], ['ordner', zOrdner], ['frueher', zFrueher]] as const;

  // 7.7: Show-Deep-Link oder RELOAD, Show mit Speakern → show, gemerkt diese Show.
  for (const [art, z] of alle) {
    for (const weg of ['deepLink', 'reload'] as const) {
      const s = quellSchritt(z, { t: 'gelesen', weg, pfad: P1, show: mit, gleicheShow: art === 'show' });
      ok(s.zustand.art === 'show' && s.zustand.showName === 'Tag 1' && s.zustand.quellHinweis === null && s.beobachte === 'iveo-data', `7.7: ${weg}, Show mit Speakern, von ${art} → show`);
      ok(s.tsv?.length === 2 && s.tsv[1].id === 's-3', `7.7: ${weg} von ${art} … TSV mit den Speakern der Show`);
      ok(
        JSON.stringify(s.merke) === JSON.stringify({ t: 'schreiben', wert: { showPfad: P1, showName: 'Tag 1', mitSpeakern: true } }) && s.log.length === 1 && s.log[0] === `Show gemerkt: ${P1}`,
        `7.7: ${weg} von ${art} … gemerkt mit Speakern, Logzeile „Show gemerkt“`,
      );
      ok(s.vorlage === (weg === 'deepLink'), `7.7: ${weg} von ${art} … Vorlage nur beim Deep-Link`);
    }
  }

  // 7.6/7.7: Show-Deep-Link, andere Show ohne Speaker → ordner, gemerkt ohne Speaker.
  for (const [art, z] of alle) {
    const s = quellSchritt(z, { t: 'gelesen', weg: 'deepLink', pfad: P2, show: ohne2, gleicheShow: false });
    ok(s.zustand.art === 'ordner' && s.beobachte === 'eigener' && s.tsv === null && s.zustand.quellHinweis === null, `7.6/7.7: andere Show ohne Speaker, von ${art} → ordner, keine TSV, kein Hinweis`);
    ok(JSON.stringify(s.merke) === JSON.stringify({ t: 'schreiben', wert: { showPfad: P2, showName: 'Tag 2', mitSpeakern: false } }) && s.vorlage, `7.7: … von ${art} gemerkt ohne Speaker (RELOAD wirkt weiter), Vorlage`);
  }

  // 7.6/7.7: RELOAD oder Show-Deep-Link, dieselbe Show ohne Speaker → unverändert, H3.
  for (const weg of ['reload', 'deepLink'] as const) {
    const s = quellSchritt(zShow, { t: 'gelesen', weg, pfad: P1, show: ohne1, gleicheShow: true });
    ok(s.zustand.art === 'show' && s.tsv === null && s.beobachte === 'iveo-data' && s.merke.t === 'bleibt', `7.6/7.7: ${weg}, dieselbe Show ohne Speaker → show bleibt, alte TSV bleibt`);
    ok(JSON.stringify(s.zustand.quellHinweis) === '{"art":"H3"}' && s.log.length === 0, `7.6/7.7: ${weg} … Hinweis H3`);
  }
  const zOrdnerMitShow = quellSchritt(zOrdner, { t: 'gelesen', weg: 'deepLink', pfad: P2, show: ohne2, gleicheShow: false }).zustand;
  const reloadOrdner = quellSchritt(zOrdnerMitShow, { t: 'gelesen', weg: 'reload', pfad: P2, show: ohne2, gleicheShow: true });
  ok(reloadOrdner.zustand.art === 'ordner' && reloadOrdner.zustand.quellHinweis === null && reloadOrdner.beobachte === 'eigener' && reloadOrdner.merke.t === 'bleibt', '7.7: RELOAD derselben Show ohne Speaker bei ordner → ordner, kein Hinweis');
  const reloadFrueher = quellSchritt(zFrueher, { t: 'gelesen', weg: 'reload', pfad: P1, show: ohne1, gleicheShow: true });
  ok(reloadFrueher.zustand.art === 'frueher' && reloadFrueher.zustand.quellHinweis === null && reloadFrueher.beobachte === 'iveo-data', '7.7: dieselbe Show ohne Speaker bei frueher → frueher, kein Hinweis');

  // 7.7: Start ohne Deep-Link (Kachel, Neustart).
  const gemerktMit: GemerkteShow = { showPfad: P1, showName: 'Tag 1', mitSpeakern: true };
  const gemerktOhne: GemerkteShow = { showPfad: P2, showName: 'Tag 2', mitSpeakern: false };
  const startShow = startZustand(gemerktMit, false);
  ok(JSON.stringify(startShow) === JSON.stringify({ art: 'show', showPfad: P1, showName: 'Tag 1', quellHinweis: null }), 'startZustand: gemerkte Show mit Speakern → show');
  const startOrdner = startZustand(gemerktOhne, false);
  ok(startOrdner.art === 'ordner' && startOrdner.showPfad === P2, 'startZustand: gemerkte Show ohne Speaker → ordner');
  ok(startZustand(null, false).art === 'ordner' && startZustand(null, true).art === 'frueher', 'startZustand: ohne gemerkte Show ordner, nach dem Übergang frueher');
  const st1 = quellSchritt(startShow, { t: 'gelesen', weg: 'start', pfad: P1, show: mit, gleicheShow: false });
  ok(st1.zustand.art === 'show' && st1.tsv?.length === 2 && st1.beobachte === 'iveo-data', '7.7: Start, gemerkte Show lesbar → wie Deep-Link');
  ok(st1.vorlage === false && st1.merke.t === 'bleibt' && st1.log.length === 0, '7.7: … ohne Vorlagen-Import, gemerkte Show unverändert');
  const st2 = quellSchritt(startShow, { t: 'gelesen', weg: 'start', pfad: P1, show: ohne1, gleicheShow: false });
  ok(st2.zustand.art === 'show' && st2.tsv === null && st2.zustand.quellHinweis?.art === 'H3', '7.6: Start, gemerkte Show jetzt ohne Speaker → dieselbe Show, alte TSV bleibt, H3');
  const st3 = quellSchritt(startOrdner, { t: 'gelesen', weg: 'start', pfad: P2, show: ohne2, gleicheShow: false });
  ok(st3.zustand.art === 'ordner' && st3.beobachte === 'eigener' && st3.merke.t === 'bleibt', '7.7: Start, gemerkte Show ohne Speaker lesbar → ordner, unverändert');

  // 7.6/7.7: Start, gemerkte Show nicht lesbar.
  const nl5 = quellSchritt(startShow, { t: 'nichtLesbar', weg: 'start', pfad: P1, grund: 'EBUSY', gemerkt: gemerktMit });
  ok(nl5.zustand.art === 'show' && JSON.stringify(nl5.zustand.quellHinweis) === '{"art":"H4","grund":"EBUSY"}' && nl5.beobachte === 'iveo-data' && nl5.tsv === null, '7.6/7.7: Start, nicht lesbar, mitSpeakern → show mit vorhandener TSV, H4');
  ok(nl5.merke.t === 'bleibt' && nl5.vorlage === false && nl5.zustand.showName === 'Tag 1', '7.7: … gemerkte Show bleibt (ein späteres RELOAD versucht es erneut)');
  const nl6 = quellSchritt(startOrdner, { t: 'nichtLesbar', weg: 'start', pfad: P2, grund: 'ENOENT', gemerkt: gemerktOhne });
  ok(nl6.zustand.art === 'ordner' && nl6.beobachte === 'eigener' && nl6.zustand.quellHinweis === null && nl6.merke.t === 'bleibt', '7.7: Start, nicht lesbar, ohne Speaker → ordner, gemerkte Show bleibt');
  ok(nl6.log.length === 1 && nl6.log[0] === 'Gemerkte Show nicht lesbar (ENOENT), eigener Ordner gilt.', '7.7: … Logzeile');

  // 7.6: RELOAD bzw. Deep-Link nicht lesbar → Art und Liste bleiben, H4 nur bei show.
  for (const [art, z] of alle) {
    const s = quellSchritt(z, { t: 'nichtLesbar', weg: 'reload', pfad: P1, grund: 'kein gültiges JSON', gemerkt: null });
    ok(s.zustand.art === art && s.tsv === null && s.merke.t === 'bleibt' && s.beobachte === (art === 'ordner' ? 'eigener' : 'iveo-data'), `7.6: RELOAD nicht lesbar bei ${art} → Art und Liste bleiben`);
    ok(
      art === 'show' ? JSON.stringify(s.zustand.quellHinweis) === '{"art":"H4","grund":"kein gültiges JSON"}' : s.zustand.quellHinweis === null,
      `7.6: RELOAD nicht lesbar bei ${art} … H4 nur bei show`,
    );
  }

  // 7.7: Ordner gewählt, Knopf „Zurück zum eigenen Ordner“.
  for (const [art, z] of alle) {
    for (const t of ['ordnerGewaehlt', 'zurueckZumOrdner'] as const) {
      const s = quellSchritt(z, { t });
      ok(
        s.zustand.art === 'ordner' && s.zustand.showPfad === null && s.zustand.quellHinweis === null && s.merke.t === 'loeschen' && s.beobachte === 'eigener' && s.tsv === null && !s.vorlage,
        `7.7: ${t} bei ${art} → ordner, gemerkte Show gelöscht`,
      );
    }
  }

  // 7.6 / Nr. 22: Merker speakerVeraltetSeit → H7.
  const merker = new Date(2026, 8, 29, 9, 58).toISOString();
  const mitMerker = quellSchritt(zShow, { t: 'gelesen', weg: 'reload', pfad: P1, show: showMit('Tag 1', [ADA], merker), gleicheShow: true });
  ok(JSON.stringify(mitMerker.zustand.quellHinweis) === JSON.stringify({ art: 'H7', seit: merker }) && mitMerker.tsv?.length === 1, 'Nr. 22: Show mit Merker → Liste gilt, H7');
  ok(
    mitMerker.zustand.quellHinweis !== null && hinweisText(mitMerker.zustand.quellHinweis) === 'Liste aus früherem Stand: Speakerliste von iveo nicht abrufbar (seit 09:58).',
    'Nr. 22: … Text mit Ortszeit',
  );
  ok(quellSchritt(zShow, { t: 'gelesen', weg: 'reload', pfad: P1, show: mit, gleicheShow: true }).zustand.quellHinweis === null, 'Nr. 22: ohne Merker kein H7');
  const merkerOhneSpeaker = quellSchritt(zShow, { t: 'gelesen', weg: 'reload', pfad: P1, show: showMit('Tag 1', [], merker), gleicheShow: true });
  ok(merkerOhneSpeaker.zustand.quellHinweis?.art === 'H7', 'dieselbe Show ohne Speaker, mit Merker → H7 statt H3');

  // Übergang (7.7): config.dataFolder zeigt auf iveo-data.
  const ueb = uebergang(IVEO, IVEO, null, aufloesen);
  ok(ueb.dataFolderLeeren && ueb.frueher, 'Übergang: dataFolder auf iveo-data, keine gemerkte Show → leeren, frueher');
  ok(ueb.log.length === 1 && ueb.log[0] === 'DataLink: Ordner iveo-data war von einer Show gesetzt, kein eigener Ordner mehr eingetragen.', 'Übergang: Logzeile');
  const uebMit = uebergang(`${IVEO}\\`, IVEO, gemerktMit, aufloesen);
  ok(uebMit.dataFolderLeeren && !uebMit.frueher, 'Übergang mit gemerkter Show: leeren, aber nicht frueher');
  ok(JSON.stringify(uebergang('D:\\Bauchbinden', IVEO, null, aufloesen)) === '{"dataFolderLeeren":false,"frueher":false,"log":[]}', 'Übergang: ein eigener Ordner bleibt unberührt');
  ok(!uebergang('', IVEO, null, aufloesen).dataFolderLeeren, 'Übergang: leerer Ordner → nichts zu tun');
  const zUeb = startZustand(null, ueb.frueher);
  ok(zUeb.art === 'frueher' && quellZeile(zUeb, '', 4) === 'Quelle: Speaker aus einer früheren Show', 'Übergang: die alte Liste bleibt sichtbar (Q3)');
  const danach = quellSchritt(zUeb, { t: 'gelesen', weg: 'deepLink', pfad: P2, show: ohne2, gleicheShow: false });
  ok(danach.zustand.art === 'ordner' && danach.beobachte === 'eigener' && danach.tsv === null, 'Übergang, dann andere Show ohne Speaker → ordner, eigener Ordner beobachtet, keine TSV');
  const nachLeeren = eigenerOrdner('', IVEO, aufloesen);
  ok(nachLeeren === '' && quellZeile(danach.zustand, nachLeeren, 0) === '', 'Übergang: … ohne eigenen Ordner leer, nicht die Speaker der vorigen Show');
  ok(eigenerOrdner('c:/users/op/appdata/roaming/jm titler/IVEO-DATA/', IVEO, aufloesen) === '', 'dataFolder von Hand auf iveo-data (andere Schreibweise) → kein eigener Ordner');
  ok(istIveoDataOrdner('c:/users/op/appdata/roaming/jm titler/IVEO-DATA/', IVEO, aufloesen), 'istIveoDataOrdner: Schreibweise egal');
  ok(eigenerOrdner('D:\\Bauchbinden', IVEO, aufloesen) === 'D:\\Bauchbinden', 'eigenerOrdner: ein echter Ordner bleibt');
  ok(!istIveoDataOrdner(`${IVEO}-alt`, IVEO, aufloesen), 'istIveoDataOrdner: ein ähnlicher Name ist nicht iveo-data');

  // Q1–Q3, K1 wörtlich (7.8).
  ok(quellZeile(zShow, 'D:\\Bauchbinden', 12) === 'Quelle: Show „Tag 1“ · 12 Speaker', 'Q1 wörtlich');
  ok(quellZeile(zOrdner, 'D:\\Bauchbinden', 3) === 'Quelle: eigener Ordner D:\\Bauchbinden', 'Q2 wörtlich');
  ok(quellZeile(zFrueher, '', 7) === 'Quelle: Speaker aus einer früheren Show', 'Q3 wörtlich');
  ok(quellZeile(zOrdner, '', 0) === '', 'ordner ohne eigenen Ordner → keine Quellzeile');
  ok(zurueckKnopf(zShow, 'D:\\Bauchbinden\\') === 'Zurück zum eigenen Ordner (Bauchbinden)', 'K1 wörtlich, Ordnername = letzter Pfadteil');
  ok(zurueckKnopf(zShow, '/home/op/Gäste') === 'Zurück zum eigenen Ordner (Gäste)', 'K1: auch mit /');
  ok(
    zurueckKnopf(zShow, '') === null && zurueckKnopf(zOrdner, 'D:\\Bauchbinden') === null && zurueckKnopf(zFrueher, 'D:\\Bauchbinden') === null,
    'K1 nur bei Quelle show und einem eigenen Ordner',
  );

  // Review Focus 2: dieselbe Show in anderer Pfad-Schreibweise.
  ok(gleicheShowPfad('C:\\Shows\\Tag1.jmshow', 'c:/shows/tag1.jmshow', path.win32.resolve), 'Review 2: C:\\Shows\\Tag1.jmshow = c:/shows/tag1.jmshow');
  ok(!gleicheShowPfad(P1, P2, aufloesen) && !gleicheShowPfad('', P1, aufloesen), 'gleicheShowPfad: andere Show bzw. leer → nein');
  ok(gleicheShowPfad(path.resolve('Shows', 'Tag1.jmshow'), path.join('Shows', '.', 'TAG1.jmshow'), path.resolve), 'gleicheShowPfad mit path.resolve: relativ = absolut, Groß-/Kleinschreibung egal');
  const r2 = quellSchritt(zShow, { t: 'gelesen', weg: 'deepLink', pfad: 'c:/shows/tag1.jmshow', show: ohne1, gleicheShow: gleicheShowPfad(P1, 'c:/shows/tag1.jmshow', aufloesen) });
  ok(r2.zustand.art === 'show' && r2.zustand.quellHinweis?.art === 'H3' && r2.tsv === null && r2.beobachte === 'iveo-data', 'Review 2: Deep-Link derselben Show ohne Speaker → bleibt show mit H3, keine Liste verloren');

  // Review Focus 4 (Quellseite): H4, danach nimmt das nächste lesbare RELOAD H4 weg.
  const kaputt = quellSchritt(zShow, { t: 'nichtLesbar', weg: 'reload', pfad: P1, grund: 'kein gültiges JSON', gemerkt: null });
  ok(
    kaputt.zustand.quellHinweis !== null && hinweisText(kaputt.zustand.quellHinweis) === 'Liste aus früherem Stand: Show nicht lesbar (kein gültiges JSON).',
    'Review 4: RELOAD mit halbem JSON → H4, Liste bleibt',
  );
  const geheilt = quellSchritt(kaputt.zustand, { t: 'gelesen', weg: 'reload', pfad: P1, show: mit, gleicheShow: true });
  ok(geheilt.zustand.quellHinweis === null && geheilt.tsv?.length === 2, 'Review 4: das nächste lesbare RELOAD nimmt H4 weg');
  const geheiltOhne = quellSchritt(kaputt.zustand, { t: 'gelesen', weg: 'reload', pfad: P1, show: ohne1, gleicheShow: true });
  ok(geheiltOhne.zustand.quellHinweis?.art === 'H3', 'Review 4: … auch ohne Speaker (dann H3 statt H4)');
}

// ── B12 · show-quelle.ts: gemerkte Show (Spec 7.7) und Show sicher lesen (7.6, G10, Review Focus 4) ──
// Importe im Block (await import), damit sich keine Namen mit den Importen aus B8–B11 überschneiden.
{
  const { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const sq = await import('../src/main/show-quelle');
  const iveoShow = await import('../src/main/iveo-show');
  const tmp = mkdtempSync(join(tmpdir(), 'jmtitler-'));
  try {
    // gemerkte Show: Rundreise, atomar, tolerant gelesen
    const userData = join(tmp, 'userData');
    const gemerkt = join(userData, 'show-zuletzt.json');
    ok(sq.GEMERKT_DATEI === 'show-zuletzt.json', 'B12: Datei heißt show-zuletzt.json (G6)');
    ok(sq.leseGemerkteShow(userData) === null, 'B12: ohne Datei → null');
    const wert = { showPfad: 'C:\\Shows\\Tag 1.jmshow', showName: 'Tag 1', mitSpeakern: true };
    ok(sq.schreibeGemerkteShow(userData, wert) === true, 'B12: schreiben → true, Ordner wird angelegt');
    ok(JSON.stringify(sq.leseGemerkteShow(userData)) === JSON.stringify(wert), 'B12: Rundreise schreiben/lesen');
    ok(JSON.stringify(readdirSync(userData)) === JSON.stringify(['show-zuletzt.json']), 'B12: nur show-zuletzt.json, keine .tmp-Datei');
    const wert2 = { showPfad: 'D:\\Gala.jmshow', showName: 'Gala', mitSpeakern: false };
    sq.schreibeGemerkteShow(userData, wert2);
    ok(JSON.stringify(sq.leseGemerkteShow(userData)) === JSON.stringify(wert2), 'B12: zweites Schreiben ersetzt den Stand');
    writeFileSync(gemerkt, '{"showPfad":"C:\\\\Shows\\\\Ta');
    ok(sq.leseGemerkteShow(userData) === null, 'B12: kaputtes JSON → null');
    writeFileSync(gemerkt, JSON.stringify({ ...wert, mitSpeakern: 'ja' }));
    ok(sq.leseGemerkteShow(userData) === null, "B12: mitSpeakern 'ja' → null");
    writeFileSync(gemerkt, JSON.stringify({ ...wert, showPfad: '' }));
    ok(sq.leseGemerkteShow(userData) === null, 'B12: leerer showPfad → null');
    writeFileSync(gemerkt, JSON.stringify({ showPfad: wert.showPfad, mitSpeakern: true }));
    ok(sq.leseGemerkteShow(userData) === null, 'B12: showName fehlt → null');
    writeFileSync(gemerkt, '[1,2]');
    ok(sq.leseGemerkteShow(userData) === null, 'B12: kein Objekt → null');
    sq.schreibeGemerkteShow(userData, wert);
    sq.loescheGemerkteShow(userData);
    ok(sq.leseGemerkteShow(userData) === null && readdirSync(userData).length === 0, 'B12: loescheGemerkteShow → danach null, Datei weg');
    sq.loescheGemerkteShow(userData);
    ok(readdirSync(userData).length === 0, 'B12: zweimal löschen wirft nicht');
    const userData2 = join(tmp, 'userData2');
    mkdirSync(join(userData2, 'show-zuletzt.json'), { recursive: true });
    ok(sq.schreibeGemerkteShow(userData2, wert) === false, 'B12: Umbenennen scheitert (Ziel ist ein Ordner) → false');
    ok(readdirSync(userData2).every((n) => !n.endsWith('.tmp')), 'B12: gescheitertes Schreiben räumt die Zwischendatei weg');

    // Show sicher lesen (Review Focus 4, G10)
    const showPfad = join(tmp, 'Tag1.jmshow');
    writeFileSync(
      showPfad,
      JSON.stringify({ schemaVersion: 1, name: 'Tag 1', tools: [], iveo: { event: 'cop31', speakers: [{ name: 'Ada Lovelace' }] } }),
    );
    const gut = sq.leseShowSicher(showPfad);
    ok('show' in gut && gut.show.name === 'Tag 1', 'B12: gültige Show → show.name');
    ok('show' in gut && gut.show.iveo?.speakers?.[0]?.name === 'Ada Lovelace', 'B12: Speaker der Show gelesen');
    writeFileSync(showPfad, '{"schemaVersion":1,"name":"Geheimname","iveo":{"speakers":[{"name":"Ada Lo');
    const halb = sq.leseShowSicher(showPfad);
    ok('grund' in halb && halb.grund === 'kein gültiges JSON', 'B12: halb geschriebene Show → kein gültiges JSON');
    ok(!JSON.stringify(halb).includes('Geheimname') && !JSON.stringify(halb).includes('Ada'), 'B12: Grund enthält keinen Dateiinhalt (G10)');
    const fehlt = sq.leseShowSicher(join(tmp, 'fehlt.jmshow'));
    ok('grund' in fehlt && fehlt.grund === 'ENOENT', 'B12: fehlende Datei → ENOENT');
    const gesperrt = sq.leseShowSicher(showPfad, () => {
      throw Object.assign(new Error('x'), { code: 'EBUSY' });
    });
    ok('grund' in gesperrt && gesperrt.grund === 'EBUSY', 'B12: gesperrte Datei (EBUSY) → EBUSY (Review Focus 4)');
    const ohneCode = sq.leseShowSicher(showPfad, () => {
      throw new Error('C:\\geheim\\inhalt');
    });
    ok('grund' in ohneCode && ohneCode.grund === 'nicht lesbar', 'B12: Fehler ohne code → nicht lesbar, ohne Fehlertext');
    let gelesenerPfad = '';
    const injiziert = sq.leseShowSicher(showPfad, (p) => {
      gelesenerPfad = p;
      return JSON.stringify({ schemaVersion: 1, name: 'Injiziert', tools: [] });
    });
    ok(gelesenerPfad === showPfad && 'show' in injiziert && injiziert.show.name === 'Injiziert', 'B12: injizierter Leser bekommt den Pfad');

    // writeSpeakersTsv mit echtem fs (B8), Kopf aus G3
    const dir = iveoShow.iveoDataDir(tmp);
    ok(dir === join(tmp, 'iveo-data'), 'B12: iveoDataDir = <userData>/iveo-data');
    ok(iveoShow.writeSpeakersTsv(dir, [{ id: 's-1', name: 'Ada Lovelace', title: 'Moderation' }, { name: 'Grace' }]) === dir, 'B12: writeSpeakersTsv legt den Ordner an und liefert ihn');
    const zeilen = readFileSync(join(dir, 'speakers.tsv'), 'utf8').split('\n');
    ok(zeilen[0] === 'name\tfunktion\ttitle\t@kennung', 'B12: speakers.tsv beginnt mit name\\tfunktion\\ttitle\\t@kennung');
    ok(zeilen[1] === 'Ada Lovelace\tModeration\tModeration\ts-1', 'B12: Kennung steht hinten');
    ok(zeilen[2] === 'Grace\t\t\t' && zeilen[3] === '' && zeilen.length === 4, 'B12: Speaker ohne Kennung → leere Spalte, Zeilenende am Schluss');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ── B13 · datalink.ts über den Kern: echter Ordner, Sendung, 1-s-Uhr (Spec 7.1, 7.3, 7.5, 9.3 Nr. 3/5/7) ──
{
  const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const datalink = await import('../src/main/datalink');
  const tmp = mkdtempSync(join(tmpdir(), 'jmtitler-'));
  const datei = join(tmp, 'speakers.tsv');
  const tsv = (zeilen: string[]): string => ['name\tfunktion\ttitle\t@kennung', ...zeilen].join('\n') + '\n';
  const NEU = 'Neu\tGast\tGast\ts-0';
  const ADA = 'Ada\tMathematik\tMathematik\ts-1';
  const GRACE = 'Grace\tCompiler\tCompiler\ts-2';
  const ALAN = 'Alan\tInformatik\tInformatik\ts-3';
  const HEDY = 'Hedy\tFunk\tFunk\ts-4';
  const logs: string[] = [];
  let meldungen = 0;
  try {
    writeFileSync(datei, tsv([ADA, GRACE, ALAN, HEDY]));
    datalink.startDataWatch(tmp, () => meldungen++, { leerHalten: true, log: (m: string) => logs.push(m) });
    let d = datalink.getDataState();
    ok(meldungen >= 1, 'B13: startDataWatch meldet den Stand an den Rückruf');
    ok(d.entries.map((e) => e.key).join(',') === 's-1,s-2,s-3,s-4', 'B13: Schlüssel kommen aus @kennung');
    ok(d.activeIndex === 0, 'B13: erster Start → Eintrag 1');
    datalink.recallSchluessel('s-2');
    ok(datalink.getDataState().companion.entry === 'Grace', 'B13: recallSchluessel trifft genau den Schlüssel');
    datalink.recall('Alan');
    d = datalink.getDataState();
    ok(d.activeIndex === 2 && d.variables.funktion === 'Informatik', 'B13: recall per Name → Alan aktiv, seine Variablen');
    ok(!('@kennung' in d.variables), 'B13: @kennung steht nicht in den Variablen');
    ok(JSON.stringify(d.companion) === JSON.stringify({ entry: 'Alan', entryIndex: 3, entryCount: 4 }), 'B13: Companion-Werte für Alan (3 von 4)');
    datalink.setzeAufSendung(true);

    // 9.3 Nr. 3 mit echter Datei: „Neu“ kommt davor → Alan bleibt Alan, jetzt Nr. 4
    writeFileSync(datei, tsv([NEU, ADA, GRACE, ALAN, HEDY]));
    datalink.rescanJetzt();
    d = datalink.getDataState();
    ok(JSON.stringify(d.companion) === JSON.stringify({ entry: 'Alan', entryIndex: 4, entryCount: 5 }), 'B13: Alan bleibt Alan, jetzt Nr. 4 von 5');
    ok(logs.includes('DataLink: „Alan“ hält seinen Eintrag (jetzt Nr. 4 von 5).'), 'B13: Logzeile A1 erreicht den Log-Rückruf');

    // 9.3 Nr. 5: Alan fällt weg, auf Sendung → gehalten (A2)
    writeFileSync(datei, tsv([NEU, ADA, GRACE, HEDY]));
    datalink.rescanJetzt();
    d = datalink.getDataState();
    ok(d.gehalten?.label === 'Alan' && d.activeIndex === -1, 'B13: Alan gehalten, kein Eintrag markiert (A2)');
    ok(d.variables.funktion === 'Informatik', 'B13: eingefrorene Variablen von Alan');
    ok(d.companion.entry === 'Alan' && d.companion.entryIndex === 0 && d.companion.entryCount === 4, 'B13: Companion: entry Alan, entry_index 0');
    ok(d.hinweis?.art === 'H1', 'B13: Hinweis H1');
    ok(logs.includes('DataLink: aktiver Eintrag „Alan“ nicht mehr in der Liste, auf Sendung gehalten.'), 'B13: Logzeile A2');

    // 9.3 Nr. 7 mit echter Uhr: Sendung endet → 1 s später kein Eintrag (A4)
    datalink.setzeAufSendung(false);
    ok(datalink.getDataState().gehalten?.label === 'Alan', 'B13: direkt nach dem Ende der Sendung noch gehalten');
    await new Promise((fertig) => setTimeout(fertig, 1100));
    d = datalink.getDataState();
    ok(d.activeIndex === -1 && d.gehalten === undefined, 'B13: 1,1 s nach der Sendung kein aktiver und kein gehaltener Eintrag');
    ok(d.hinweis?.art === 'H2' && Object.keys(d.variables).length === 0, 'B13: Hinweis H2, leere Variablen');
    ok(d.companion.entry === '' && d.companion.entryIndex === 0, 'B13: Companion leer');

    // A7: Quelle Show (leerHalten) und die Datei ist leer → Liste bleibt
    writeFileSync(datei, '');
    datalink.rescanJetzt();
    ok(datalink.getDataState().entries.length === 4, 'B13: leere Datei bei leerHalten → Liste bleibt (A7)');

    // A7 gilt nur im selben Ordner (B9): Wechsel auf einen leeren Ordner leert Liste und Quellen.
    const leer = join(tmp, 'leer');
    mkdirSync(leer);
    datalink.startDataWatch(leer, () => meldungen++, { leerHalten: true, log: (m: string) => logs.push(m) });
    d = datalink.getDataState();
    ok(d.entries.length === 0 && d.sources.length === 0, 'B13: Wechsel auf einen leeren Ordner → keine Einträge, keine Quellen (A7 nur im selben Ordner)');
  } finally {
    datalink.stopDataWatch();
    rmSync(tmp, { recursive: true, force: true });
  }
  ok(datalink.getDataState().entries.length === 0, 'B13: stopDataWatch setzt den Kern zurück');
}

if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
  process.exit(1);
}
console.log('\nALLE TESTS OK');

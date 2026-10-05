// Titler-Selbsttest ohne Electron (tsx): npm run selftest -w @jm/titler
// Master-Link Teil 2b, Spec 9.3: DataLink-Kern (Schlüssel, aktiver Eintrag, Abruf), Datenquelle und
// Speaker-TSV. Kein Netz, kein Fenster, kein Electron-Import: Die CI installiert ohne Postinstalls
// (Spec 9.5), ein Electron-Import bräche hier ab.
import { join } from 'node:path';
import type { ShowIveoSpeaker } from '@jm/show';
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

if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
  process.exit(1);
}
console.log('\nALLE TESTS OK');

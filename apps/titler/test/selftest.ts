// Titler-Selbsttest ohne Electron (tsx): npm run selftest -w @jm/titler
// Master-Link Teil 2b, Spec 9.3: DataLink-Kern (Schlüssel, aktiver Eintrag, Abruf), Datenquelle und
// Speaker-TSV. Kein Netz, kein Fenster, kein Electron-Import: Die CI installiert ohne Postinstalls
// (Spec 9.5), ein Electron-Import bräche hier ab.
import { join } from 'node:path';
import {
  ersatzSchluessel,
  fuehreZusammen,
  istErsatzSchluessel,
  KENNUNG_SPALTE,
  parseKvDatei,
  parseTable,
  SCHLUESSEL_MAX,
  type DataEntry,
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

if (failed > 0) {
  console.error(`\n${failed} FEHLGESCHLAGEN`);
  process.exit(1);
}
console.log('\nALLE TESTS OK');

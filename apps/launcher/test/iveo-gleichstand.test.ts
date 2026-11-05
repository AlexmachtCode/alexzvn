// Anmeldung Z1-F · Gleichstand-Wächter: die feste iveo-Liste und ihre Normalisierung gibt es zweimal, im Worker
// (services/release-proxy/konto-kern.js) und im Launcher (packages/iveo/src/client.ts). Dieser Test importiert beide und vergleicht
// die Listen und über eine Fall-Tabelle: erlaubt auf beiden Seiten gleich, und wenn erlaubt, dann gleiche kanonische Form.
// Ohne Electron, ohne Netz (tsx). Läuft in selftest:konto.
import { IVEO_ERLAUBTE_BASEN as LISTE_LAUNCHER, iveoBasisErlaubt as erlaubtLauncher, kanonischeIveoBasis } from '@jm/iveo';
import { iveoHinterlegenBasis } from '../src/main/konto/iveo-zentral';
// @ts-ignore reines JS ohne Typen
import { IVEO_ERLAUBTE_BASEN as LISTE_WORKER, iveoBasisErlaubt as erlaubtWorker, normalisiereBasis } from '../../../services/release-proxy/konto-kern.js';

import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const PROD = 'https://app.my-iveo.de/api/v1';
const STAGING = 'https://staging-dev.my-iveo.de/api/v1';

ck('F.1: die Listen sind gleich (Inhalt und Reihenfolge)', JSON.stringify([...LISTE_LAUNCHER]) === JSON.stringify([...LISTE_WORKER]));
ck('F.1: die Liste ist genau Production und Staging', JSON.stringify([...LISTE_WORKER]) === JSON.stringify([PROD, STAGING]));

const NBSP = String.fromCharCode(0xa0);
const FAELLE: string[] = [
  // Schreibweisen der beiden erlaubten Basen
  PROD, STAGING, 'HTTPS://APP.MY-IVEO.DE/API/V1', 'https://APP.my-iveo.de/api/v1', 'Https://App.My-Iveo.De/api/v1',
  'app.my-iveo.de/api/v1', 'staging-dev.my-iveo.de/api/v1', 'APP.MY-IVEO.DE/api/v1',
  // Port 443, anderer Port, http
  'https://app.my-iveo.de:443/api/v1', 'HTTPS://APP.my-iveo.de:443/api/v1/', 'app.my-iveo.de:443/api/v1', 'https://staging-dev.my-iveo.de:443/api/v1',
  'https://app.my-iveo.de:8443/api/v1', 'https://app.my-iveo.de:80/api/v1', 'http://app.my-iveo.de/api/v1', 'http://app.my-iveo.de:443/api/v1',
  // Schrägstriche am Ende und doppelt
  `${PROD}/`, `${PROD}//`, `${PROD}///`, `${STAGING}/`, 'app.my-iveo.de/api/v1/', 'https://app.my-iveo.de/api/v1//',
  'https://app.my-iveo.de//api/v1', 'https://app.my-iveo.de/api//v1',
  // Leerraum außen
  ` ${PROD}`, `${PROD} `, `\t${PROD}\n`, `  ${STAGING}  `, ` app.my-iveo.de/api/v1/ `,
  // Leerraum innen und Steuerzeichen
  'https://app.my-iveo.de/api/v1 /', 'https://app.my-iveo.de/api /v1', 'https://app.my-iveo.de /api/v1', 'https://app.my- iveo.de/api/v1',
  `https://app.my-iveo.de/api/v1${NBSP}`, `https://app.my-iveo.de/api/v1/${NBSP}/`, 'https://app.my-iveo.de/api/v1\u0007', 'https://app.my-iveo.de/api/v1\u007f',
  // Zugangsdaten, Query, Fragment
  'https://user@app.my-iveo.de/api/v1', 'https://user:pw@app.my-iveo.de/api/v1', 'https://app.my-iveo.de@evil.example/api/v1',
  'https://evil.example@app.my-iveo.de/api/v1', 'https://app.my-iveo.de/api/v1?x=1', 'https://app.my-iveo.de/api/v1#frag',
  'https://app.my-iveo.de/api/v1/?', 'https://app.my-iveo.de/api/v1/#', 'https://app.my-iveo.de?/api/v1', 'https://app.my-iveo.de#/api/v1',
  // Pfad
  'https://app.my-iveo.de', 'https://app.my-iveo.de/', 'https://app.my-iveo.de/api', 'https://app.my-iveo.de/api/v2', 'https://app.my-iveo.de/API/V1',
  'https://app.my-iveo.de/api/v1/x', 'https://app.my-iveo.de/api/v1/../v1', 'https://app.my-iveo.de/api/./v1', 'https://app.my-iveo.de/x/../api/v1',
  'https://app.my-iveo.de/api/v1%2F', 'https://app.my-iveo.de/api/%76%31', 'https://app.my-iveo.de/api/v1;x',
  // Unicode und Homoglyphen
  'https://app.my-iveo.dé/api/v1', 'https://äpp.my-iveo.de/api/v1', 'https://app.my-ıveo.de/api/v1', 'https://app.my‐iveo.de/api/v1',
  'https://app.my-iveo.de。/api/v1', 'https://app。my-iveo.de/api/v1', 'https://ａpp.my-iveo.de/api/v1', 'https://app.my-iveo.de／api/v1',
  'https://app.my-iveo.de/api/v１', 'https://​app.my-iveo.de/api/v1', 'https://app.my-iveo.de​/api/v1',
  // Host mit Punkt am Ende, Schwesterhosts, fremde Hosts
  'https://app.my-iveo.de./api/v1', 'https://app.my-iveo.de.evil.example/api/v1', 'https://evil.example/app.my-iveo.de/api/v1',
  'https://xapp.my-iveo.de/api/v1', 'https://app.my-iveo.de.com/api/v1', 'https://my-iveo.de/api/v1', 'https://www.my-iveo.de/api/v1',
  'https://staging.my-iveo.de/api/v1', 'https://x.my-iveo.de/api/v1', 'https://app.my-iveo.com/api/v1', 'https://example.com/api/v1',
  'https://127.0.0.1/api/v1', 'http://127.0.0.1:8080/api/v1', 'https://[::1]/api/v1', 'https://localhost/api/v1',
  // Andere Schemas, kaputt, leer
  'ftp://app.my-iveo.de/api/v1', 'file:///api/v1', 'javascript://app.my-iveo.de/api/v1', 'wss://app.my-iveo.de/api/v1', '//app.my-iveo.de/api/v1',
  'https:/app.my-iveo.de/api/v1', 'https:app.my-iveo.de/api/v1', 'https://', 'https:///api/v1', 'http://', '', ' ', '/', '|', 'a|b',
  `${PROD}|cop31`, 'https://app.my-iveo.de:/api/v1', 'https://app.my-iveo.de:443:443/api/v1', 'https://app.my-iveo.de:abc/api/v1',
  'https://app.my-iveo.de:0443/api/v1', 'https://app.my-iveo.de:00443/api/v1', 'https://app.my-iveo.de:65536/api/v1',
];

ck(`F.1: die Fall-Tabelle hat mindestens 40 Eingaben (${FAELLE.length})`, FAELLE.length >= 40);

// AR84: keine Ausnahmen. Der Launcher ist so streng wie der Worker; jede Abweichung in eine Richtung macht den Test rot.
const abw: string[] = [];
let erlaubtAnzahl = 0;
for (const eingabe of FAELLE) {
  const w = erlaubtWorker(eingabe) as boolean;
  const l = erlaubtLauncher(eingabe) as boolean;
  if (w || l) erlaubtAnzahl++;
  if (w !== l) {
    abw.push(`erlaubt verschieden: ${JSON.stringify(eingabe)} Worker=${w} Launcher=${l}`);
    continue;
  }
  if (w) {
    const kw = normalisiereBasis(eingabe) as string | null;
    const kl = kanonischeIveoBasis(eingabe);
    if (kw !== kl) abw.push(`kanonische Form verschieden: ${JSON.stringify(eingabe)} Worker=${kw} Launcher=${kl}`);
  }
}
for (const a of abw) console.log(`      ${a}`);
ck(`F.1 AR84: erlaubt ist auf beiden Seiten gleich, und wenn erlaubt, ist die kanonische Form gleich, ohne Ausnahme (${FAELLE.length} Fälle, ${erlaubtAnzahl} erlaubt, ${abw.length} Abweichungen)`,
  abw.length === 0);
// Beim Hinterlegen geht die kanonische Form an den Worker: iveoHinterlegenBasis (Launcher) liefert für jede Eingabe genau das, was der Worker
// als Basis speichern würde, oder null, wo der Worker ablehnt.
{
  const h: string[] = [];
  for (const e of FAELLE) {
    const ist = iveoHinterlegenBasis(e, PROD);
    const soll = erlaubtWorker(e) ? (normalisiereBasis(e) as string) : null;
    if (ist !== soll && !(e.trim() === '' && ist === PROD)) h.push(`${JSON.stringify(e)}: ist ${ist} soll ${soll}`);
  }
  for (const a of h) console.log(`      ${a}`);
  ck(`F.1 AR84: iveoHinterlegenBasis schickt die kanonische Form des Workers oder lehnt ab (${FAELLE.length} Fälle, ${h.length} Abweichungen)`, h.length === 0);
}
ck('F.1: die Tabelle enthält erlaubte und abgelehnte Fälle (der Vergleich ist nicht leer)', erlaubtAnzahl >= 10 && erlaubtAnzahl < FAELLE.length - 10);

{
  const huelle = readFileSync(new URL('../src/main/konto/huelle.ts', import.meta.url), 'utf8').split('\r\n').join('\n');
  ck('F.1 AR84: die Hülle ersetzt die Basis der Admin-Aktion durch die geprüfte kanonische Form, bevor sie an den Worker geht',
    huelle.includes("const basis = iveoHinterlegenBasis(a.basis, resolveIveoBaseUrl());") && huelle.includes("aktion = { ...a, basis };"));
}

// Nicht-Texte: der Worker bekommt JSON, der Launcher nur Texte oder undefined; beides lehnt ab.
ck('F.1: Nicht-Texte und undefined sind auf beiden Seiten nicht erlaubt', [undefined, null, 5, {}, []].every((x) => erlaubtWorker(x) === false)
  && erlaubtLauncher(undefined) === false);

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

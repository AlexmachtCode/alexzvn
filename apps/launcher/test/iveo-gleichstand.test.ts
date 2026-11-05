// Anmeldung Z1-F · Gleichstand-Wächter: die feste iveo-Liste und ihre Normalisierung gibt es zweimal, im Worker
// (services/release-proxy/konto-kern.js) und im Launcher (packages/iveo/src/client.ts). Dieser Test importiert beide und vergleicht
// die Listen und über eine Fall-Tabelle: erlaubt auf beiden Seiten gleich, und wenn erlaubt, dann gleiche kanonische Form.
// Ohne Electron, ohne Netz (tsx). Läuft in selftest:konto.
import { IVEO_ERLAUBTE_BASEN as LISTE_LAUNCHER, iveoBasisErlaubt as erlaubtLauncher, kanonischeIveoBasis } from '@jm/iveo';
// @ts-ignore reines JS ohne Typen
import { IVEO_ERLAUBTE_BASEN as LISTE_WORKER, iveoBasisErlaubt as erlaubtWorker, normalisiereBasis } from '../../../services/release-proxy/konto-kern.js';

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

// Bekannte Abweichungen (Befund von Z1-F, der Controller entscheidet über das Angleichen; hier NICHT angeglichen). Ausnahmslos in
// der Richtung „Launcher lässt zu, Worker lehnt ab“: der Launcher nutzt new URL (kürzt ../ und ./, entfernt leeres Query/Fragment,
// Steuerzeichen am Ende, leeren Port, führende Nullen im Port, Unicode-Punkt und Fullwidth-Zeichen im Host, Null-Breite-Zeichen,
// „//host“ ohne Schema), der Worker prüft Zeichen und Aufbau selbst und lehnt das alles ab. Der Worker ist hier der strengere Teil;
// das Hinterlegen mit solcher Schreibweise scheitert also am Worker (iveo-basis-unbekannt), nie umgekehrt. Dieser Wächter nagelt
// die Menge fest: jede NEUE Abweichung und jede behobene macht ihn rot.
const BEKANNT: readonly string[] = [
  'https://app.my-iveo.de/api/v1', 'https://app.my-iveo.de/api/v1/?', 'https://app.my-iveo.de/api/v1/#',
  'https://app.my-iveo.de/api/v1/../v1', 'https://app.my-iveo.de/api/./v1', 'https://app.my-iveo.de/x/../api/v1',
  'https://app。my-iveo.de/api/v1', 'https://ａpp.my-iveo.de/api/v1', 'https://​app.my-iveo.de/api/v1',
  'https://app.my-iveo.de​/api/v1', '//app.my-iveo.de/api/v1', 'https://app.my-iveo.de:/api/v1',
  'https://app.my-iveo.de:0443/api/v1', 'https://app.my-iveo.de:00443/api/v1',
];

const abw: string[] = [];
const abwEingaben: string[] = [];
let erlaubtAnzahl = 0;
for (const eingabe of FAELLE) {
  const w = erlaubtWorker(eingabe) as boolean;
  const l = erlaubtLauncher(eingabe) as boolean;
  if (w || l) erlaubtAnzahl++;
  if (w !== l) {
    abwEingaben.push(eingabe);
    abw.push(`erlaubt verschieden: ${JSON.stringify(eingabe)} Worker=${w} Launcher=${l}`);
    continue;
  }
  if (w) {
    const kw = normalisiereBasis(eingabe) as string | null;
    const kl = kanonischeIveoBasis(eingabe);
    if (kw !== kl) {
      abwEingaben.push(eingabe);
      abw.push(`kanonische Form verschieden: ${JSON.stringify(eingabe)} Worker=${kw} Launcher=${kl}`);
    }
  }
}
for (const a of abw) console.log(`      ${a}`);
ck(`F.1: Abweichungen zwischen Worker und Launcher sind genau die bekannten (${abw.length} von ${FAELLE.length} Fällen)`,
  JSON.stringify(abwEingaben) === JSON.stringify(BEKANNT));
ck(`F.1: keine bekannte Abweichung läuft in die gefährliche Richtung (Worker erlaubt, Launcher lehnt ab) und keine Form weicht ab`,
  abwEingaben.every((e) => erlaubtLauncher(e) === true && erlaubtWorker(e) === false));
ck(`F.1: alle übrigen Fälle (${FAELLE.length - abwEingaben.length}) stimmen überein: erlaubt gleich und kanonische Form gleich`,
  FAELLE.filter((e) => !BEKANNT.includes(e)).every((e) => erlaubtWorker(e) === erlaubtLauncher(e)
    && (!erlaubtWorker(e) || normalisiereBasis(e) === kanonischeIveoBasis(e))));
ck('F.1: die Tabelle enthält erlaubte und abgelehnte Fälle (der Vergleich ist nicht leer)', erlaubtAnzahl >= 10 && erlaubtAnzahl < FAELLE.length - 10);

// Nicht-Texte: der Worker bekommt JSON, der Launcher nur Texte oder undefined; beides lehnt ab.
ck('F.1: Nicht-Texte und undefined sind auf beiden Seiten nicht erlaubt', [undefined, null, 5, {}, []].every((x) => erlaubtWorker(x) === false)
  && erlaubtLauncher(undefined) === false);

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

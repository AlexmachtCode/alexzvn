// Selbsttest des Q&A-Zugangs zum Cloud-Relay (Anmeldung im Launcher, Teil 1; Plan P29–P31, Vertrag 10.9, Verhalten 11.3)
// — ohne Electron und ohne Netz, zweites Glied von `npm run selftest -w @jm/qa`:
//   node --experimental-strip-types test/cloud-zugang.test.ts   (im Ordner apps/qa)
// Form wie test/selftest.ts: „ok   …“ auf stdout, „FAIL …“ auf stderr, Schluss „ALLE TESTS OK“ bzw. „‹n› FEHLER“.
// Kreuzprodukte sind je eine Zeile mit „(‹n› Fälle)“; bei Abweichung folgen bis zu fünf Fälle mit ist/soll (G12).
// Zeiten entstehen aus Ortszeit-Bestandteilen (new Date(J, M, T, h, m)), damit Datum und Uhrzeit in jeder Zeitzone stimmen.
// cloud.ts, index.ts und die Oberfläche laden Electron bzw. React; sie prüft dieser Test über Quelltext-Wächter (P30, P31).
import { readFileSync } from 'node:fs';
import type { FreigabeGrund } from '@jm/app-runtime/freigabe';
import {
  ERNEUERN_VOR_MS, FREIGABE_ABSTAND_MS, GRUND_TEXT, QA_TEXT, QA_VORGABE_URL, effektiveProxyUrl, erneuernFaellig, grundText,
  leseFreigabe, nachAblehnung, versuchErlaubt, waehleZugang, zugangsKopf, zugangsZeile,
  type QaFreigabe, type QaZugang, type QaZugangsLage,
} from '../src/main/cloud-zugang.ts';

let failed = 0;
function eq(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failed++;
    console.error(`FAIL ${msg}\n  erwartet: ${e}\n  bekommen: ${a}`);
  } else {
    console.log(`ok   ${msg}`);
  }
}
/** Ein Kreuzprodukt als eine Zeile; bei Abweichung die ersten fünf Fälle mit ist/soll. */
function faelle(msg: string, liste: ReadonlyArray<{ fall: string; ist: unknown; soll: unknown }>): void {
  const falsch = liste.filter((x) => JSON.stringify(x.ist) !== JSON.stringify(x.soll));
  const name = `${msg} (${liste.length} Fälle)`;
  if (falsch.length) {
    failed++;
    console.error(`FAIL ${name}`);
    for (const x of falsch.slice(0, 5)) console.error(`  ${x.fall}: ist ${JSON.stringify(x.ist)}, soll ${JSON.stringify(x.soll)}`);
  } else {
    console.log(`ok   ${name}`);
  }
}
/** Quelltext einer Datei relativ zu diesem Test, mit LF (Arbeitsbaum CRLF, G13). */
function quelle(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

const STUNDE = 3600_000;
const JETZT = new Date(2026, 10, 2, 10, 0).getTime(); // 02.11.2026 10:00 Ortszeit
const EVENT = 'evt_0123456789ab';
const ANDERES = 'evt_ba9876543210';
const KONTO = { name: 'Maria Schmidt', stufe: 'kollege' };
const frei = (bis: number, ziel = EVENT, token = 'jm1.test.frei'): QaFreigabe => ({ token, bis, ziel, konto: KONTO });
const BIS_72 = new Date(2026, 10, 5, 10, 0).getTime(); // 05.11.2026 10:00, Rest 72 h
const BIS_12 = new Date(2026, 10, 2, 22, 30).getTime(); // 02.11.2026 22:30, Rest 12,5 h

// --- P29 10.9 QR1: Zugangswahl ----------------------------------------------------------------------------------------
{
  const freigaben: Array<[string, QaFreigabe | null, boolean]> = [
    ['gültig 72 h', frei(BIS_72), true],
    ['gültig 12 h', frei(BIS_12), true],
    ['abgelaufen', frei(JETZT - STUNDE), false],
    ['genau jetzt', frei(JETZT), false],
    ['anderes Ziel', frei(BIS_72, ANDERES), false],
    ['ohne Token', frei(BIS_72, EVENT, ''), false],
    ['keine', null, false],
  ];
  const keys: Array<[string, string, string | null]> = [['Key', 'test-alter-key', 'test-alter-key'], ['Key mit Leerzeichen', '  test-alter-key ', 'test-alter-key'], ['leer', '', null], ['nur Leerzeichen', '   ', null]];
  const events: Array<[string, string]> = [['Event', EVENT], ['ohne Event', '']];
  const liste: Array<{ fall: string; ist: unknown; soll: unknown }> = [];
  for (const [fn, f, gueltig] of freigaben) {
    for (const [kn, key, keySoll] of keys) {
      for (const [en, eventId] of events) {
        const z = waehleZugang({ freigabe: f, proxyKey: key, eventId, jetzt: JETZT });
        const soll = gueltig && eventId ? 'freigabe' : keySoll !== null ? `alter-key:${keySoll}` : 'keiner';
        const ist = z.art === 'freigabe' ? (z.f === f ? 'freigabe' : 'freigabe (Kopie)') : z.art === 'alter-key' ? `alter-key:${z.key}` : 'keiner';
        liste.push({ fall: `${fn} × ${kn} × ${en}`, ist, soll });
      }
    }
  }
  faelle('P29 10.9 QR1: Zugangswahl, gültige Freigabe für dieses Event vor altem Key vor keinem (Freigabe × Key × Event)', liste);
}

// --- P29 10.9: Kopfzeilen an /qa/:id --------------------------------------------------------------------------------
eq(
  [zugangsKopf({ art: 'freigabe', f: frei(BIS_72) }), zugangsKopf({ art: 'alter-key', key: 'test-alter-key' }), zugangsKopf({ art: 'keiner' })],
  [{ Authorization: 'Bearer jm1.test.frei' }, { 'X-Proxy-Key': 'test-alter-key' }, {}],
  'P29 10.9: zugangsKopf — Freigabe als Bearer, alter Key als X-Proxy-Key, sonst keine Kopfzeile',
);

// --- P29 11.3 QR2: erneuernFaellig und 30-s-Abstand ----------------------------------------------------------------------
faelle('P29 11.3 QR2: erneuernFaellig (keine, anderes Ziel, Rest 72 h, genau 24 h, 24 h minus 1 ms, abgelaufen, ohne Event)', [
  { fall: 'keine', ist: erneuernFaellig(null, EVENT, JETZT), soll: true },
  { fall: 'anderes Ziel', ist: erneuernFaellig(frei(BIS_72, ANDERES), EVENT, JETZT), soll: true },
  { fall: 'Rest 72 h', ist: erneuernFaellig(frei(BIS_72), EVENT, JETZT), soll: false },
  { fall: 'genau 24 h', ist: erneuernFaellig(frei(JETZT + ERNEUERN_VOR_MS), EVENT, JETZT), soll: false },
  { fall: '24 h minus 1 ms', ist: erneuernFaellig(frei(JETZT + ERNEUERN_VOR_MS - 1), EVENT, JETZT), soll: true },
  { fall: 'abgelaufen', ist: erneuernFaellig(frei(JETZT - 1), EVENT, JETZT), soll: true },
  { fall: 'ohne Event', ist: erneuernFaellig(null, '', JETZT), soll: false },
]);
eq(
  [ERNEUERN_VOR_MS, FREIGABE_ABSTAND_MS, versuchErlaubt(null, JETZT), versuchErlaubt(JETZT - 29_999, JETZT), versuchErlaubt(JETZT - 30_000, JETZT)],
  [86_400_000, 30_000, true, false, true],
  'P29 11.3 QR2/QR4: höchstens ein Versuch beim Launcher je 30 s (erster sofort, 29,999 s nein, 30 s ja)',
);

// --- P29 11.3 QR5: Antwort des Relays je Zugang ----------------------------------------------------------------------
{
  const liste: Array<{ fall: string; ist: unknown; soll: unknown }> = [];
  for (const art of ['freigabe', 'alter-key', 'keiner'] as Array<QaZugang['art']>) {
    for (const status of [0, 200, 400, 401, 403, 404, 429, 500, 503]) {
      const soll = status === 401 || status === 403 ? (art === 'freigabe' ? 'freigabe-verwerfen' : art === 'alter-key' ? 'key-abgelehnt' : null) : null;
      liste.push({ fall: `${art} × ${status}`, ist: nachAblehnung(art, status), soll });
    }
  }
  faelle('P29 11.3 QR5: 401/403 mit Freigabe → verwerfen (Q11), mit altem Key → nicht wiederholen (Q6d), sonst nichts (Zugang × Status)', liste);
}

// --- P29 G8: Normalisierer für qa.cloud.secret --------------------------------------------------------------------------
eq(
  [
    leseFreigabe({ token: 'jm1.test.frei', bis: BIS_72, ziel: EVENT, konto: { name: 'Maria Schmidt', stufe: 'kollege', extra: 1 }, extra: 2 }),
    leseFreigabe(null), leseFreigabe('jm1.test.frei'), leseFreigabe({ token: '', bis: BIS_72, ziel: EVENT, konto: KONTO }),
    leseFreigabe({ token: 'jm1.test.frei', bis: '1', ziel: EVENT, konto: KONTO }), leseFreigabe({ token: 'jm1.test.frei', bis: BIS_72, ziel: '', konto: KONTO }),
    leseFreigabe({ token: 'jm1.test.frei', bis: BIS_72, ziel: EVENT, konto: { name: 'X', stufe: 'gast' } }),
    leseFreigabe({ token: 'jm1.test.frei', bis: BIS_72, ziel: EVENT }),
  ],
  [frei(BIS_72), null, null, null, null, null, null, null],
  'P29 G8: leseFreigabe nimmt nur eine vollständige Freigabe (Token, bis, Ziel, Konto mit Stufe) und keine fremden Felder',
);

// --- P29 3: Vorgabe-URL ------------------------------------------------------------------------------------------------
eq(
  [QA_VORGABE_URL, effektiveProxyUrl(''), effektiveProxyUrl('   '), effektiveProxyUrl(' http://127.0.0.1:8787 '), effektiveProxyUrl('https://test.example')],
  ['https://jm-suite-proxy.jm-production-suite.workers.dev', QA_VORGABE_URL, QA_VORGABE_URL, 'http://127.0.0.1:8787', 'https://test.example'],
  'P29 3: Server-Adresse leer → Vorgabe-URL (Worker der Suite), eingetragen → getrimmt die eingetragene',
);

// --- P29 11.3 G7: Zeile „Zugang“ als Kreuzprodukt -------------------------------------------------------------------------
const Q3: Record<FreigabeGrund, string> = {
  'kein-launcher': 'Kein Launcher mit Anmeldung gefunden. Starte den Launcher und melde dich dort an.',
  'launcher-unecht': 'Der Launcher hat sich nicht ausgewiesen. Starte den Launcher neu.',
  'launcher-zu-alt': 'Der Launcher ist zu alt für diese Freigabe. Aktualisiere den Launcher.',
  'unbekannter-zweck': 'Der Launcher ist zu alt für diese Freigabe. Aktualisiere den Launcher.',
  'niemand-angemeldet': 'Im Launcher ist niemand angemeldet. Melde dich im Launcher an (oben rechts).',
  abgelaufen: 'Die Anmeldung im Launcher ist abgelaufen. Melde dich im Launcher neu an.',
  entzogen: 'Dein Zugang wurde beim letzten Start des Launchers nicht bestätigt. Frag einen Admin.',
  'kein-recht': 'Dein Konto darf Q&A extern nicht nutzen. Frag einen Admin.',
  'server-nicht-erreichbar': 'Der Server ist gerade nicht erreichbar. Ich versuche es weiter.',
  fehler: 'Freigabe fehlgeschlagen: ungueltig',
};
const Q2_72 = 'Freigabe vom Launcher (Maria Schmidt · Kollege), gültig bis 05.11.2026 10:00.';
const Q2_12 = 'Freigabe vom Launcher (Maria Schmidt · Kollege), gültig bis 02.11.2026 22:30.';
const Q4_12 = 'Die Freigabe gilt noch bis 22:30. Für eine neue Freigabe muss der Launcher laufen.';
const Q5 = 'Die Freigabe ist abgelaufen. Starte den Launcher, damit Q&A eine neue bekommt.';
const Q6C = 'Zugang über den alten Proxy-Key (Übergang).';
const Q6D = 'Der Server nimmt den alten Proxy-Key nicht mehr an. Melde dich im Launcher an.';
const Q12 = 'Extern ist an und wartet auf eine Freigabe: ';
const VORUEBERGEHEND = ['kein-launcher', 'niemand-angemeldet', 'abgelaufen', 'server-nicht-erreichbar'];
type Fall = 'freigabe 72 h' | 'freigabe 12 h' | 'alter Key' | 'keiner' | 'keiner, Freigabe abgelaufen';
/** Die Regeln der Zeile, Zeile für Zeile aus 11.3 und der Texttabelle 9.10 (unabhängig von der Umsetzung formuliert). */
function soll(fall: Fall, grund: FreigabeGrund | null, eventDa: boolean, extern: boolean, abgelehnt: boolean): { text: string; ton: string } {
  const grundTon = grund !== null && VORUEBERGEHEND.includes(grund) ? 'warn' : 'fehler';
  switch (fall) {
    case 'freigabe 72 h':
      return { text: Q2_72, ton: 'ok' };
    case 'freigabe 12 h':
      if (grund === null) return { text: Q2_12, ton: 'ok' };
      if (grund === 'kein-launcher') return { text: Q4_12, ton: 'warn' };
      return { text: `${Q2_12} ${Q3[grund]}`, ton: 'warn' };
    case 'alter Key':
      return abgelehnt ? { text: Q6D, ton: 'fehler' } : { text: Q6C, ton: 'warn' };
    default: {
      if (!eventDa) return abgelehnt ? { text: Q6D, ton: 'fehler' } : { text: '', ton: 'warn' };
      const abgelaufen = fall === 'keiner, Freigabe abgelaufen';
      if (grund === 'kein-launcher' && abgelaufen) return { text: Q5, ton: 'warn' };
      if (grund !== null) return { text: extern ? Q12 + Q3[grund] : Q3[grund], ton: grundTon };
      if (abgelehnt) return { text: Q6D, ton: 'fehler' };
      if (abgelaufen) return { text: Q5, ton: 'warn' };
      return extern ? { text: 'Verbinde …', ton: 'warn' } : { text: '', ton: 'warn' };
    }
  }
}
{
  const gruende: Array<FreigabeGrund | null> = [null, 'kein-launcher', 'launcher-zu-alt', 'launcher-unecht', 'niemand-angemeldet', 'abgelaufen',
    'entzogen', 'kein-recht', 'server-nicht-erreichbar', 'unbekannter-zweck', 'fehler'];
  const zugaenge: Array<[Fall, QaZugang]> = [
    ['freigabe 72 h', { art: 'freigabe', f: frei(BIS_72) }],
    ['freigabe 12 h', { art: 'freigabe', f: frei(BIS_12) }],
    ['alter Key', { art: 'alter-key', key: 'test-alter-key' }],
    ['keiner', { art: 'keiner' }],
    ['keiner, Freigabe abgelaufen', { art: 'keiner' }],
  ];
  const liste: Array<{ fall: string; ist: unknown; soll: unknown }> = [];
  for (const [fall, zugang] of zugaenge) {
    for (const grund of gruende) {
      for (const eventDa of [true, false]) {
        // Eine Freigabe gehört immer zu einem Event: ohne Event gibt es weder eine gültige noch eine abgelaufene.
        if (!eventDa && (zugang.art === 'freigabe' || fall === 'keiner, Freigabe abgelaufen')) continue;
        for (const extern of [true, false]) {
          for (const abgelehnt of [false, true]) {
            const lage: QaZugangsLage = {
              zugang, letzterGrund: grund, jetzt: JETZT, eventDa, extern, altKeyAbgelehnt: abgelehnt,
              detail: grund === 'fehler' ? 'ungueltig' : null, freigabeAbgelaufen: fall === 'keiner, Freigabe abgelaufen',
            };
            liste.push({
              fall: `${fall} × ${grund ?? 'kein Grund'} × ${eventDa ? 'Event' : 'ohne Event'} × ${extern ? 'Extern an' : 'Extern aus'}${abgelehnt ? ' × Key abgelehnt' : ''}`,
              ist: zugangsZeile(lage),
              soll: soll(fall, grund, eventDa, extern, abgelehnt),
            });
          }
        }
      }
    }
  }
  faelle('P29 11.3 G7: Zeile „Zugang“ (Zugang × Grund × Event × Extern × alter Key abgelehnt; Extern an sagt, worauf es wartet)', liste);
}

// --- P29 Review Focus 1: Q&A startet vor dem Launcher; Neustart bei geschlossenem Launcher --------------------------------
{
  // Q&A startet vor dem Launcher: keine Freigabe, Extern an, der Launcher fehlt → Extern bleibt an und sagt, worauf es wartet.
  const vorher = waehleZugang({ freigabe: null, proxyKey: '', eventId: EVENT, jetzt: JETZT });
  const z1 = zugangsZeile({ zugang: vorher, letzterGrund: 'kein-launcher', jetzt: JETZT, eventDa: true, extern: true, altKeyAbgelehnt: false });
  // Q&A stürzt ab, der Launcher ist geschlossen: die gespeicherte Freigabe trägt den Neustart (QR7), ohne Launcher.
  const nachNeustart = waehleZugang({ freigabe: frei(BIS_72), proxyKey: '', eventId: EVENT, jetzt: JETZT });
  eq(
    [vorher.art, z1, nachNeustart.art, zugangsKopf(nachNeustart), erneuernFaellig(frei(BIS_72), EVENT, JETZT)],
    ['keiner', { text: Q12 + Q3['kein-launcher'], ton: 'warn' }, 'freigabe', { Authorization: 'Bearer jm1.test.frei' }, false],
    'P29 Review 1: Q&A vor dem Launcher wartet mit Q12; nach einem Neustart bei geschlossenem Launcher gilt die gespeicherte Freigabe',
  );
}

// --- P29 G2: Texte wörtlich, ohne ASCII-Anführungszeichen ---------------------------------------------------------------
{
  const texte = [
    QA_TEXT.freigabe('‹Name›', '‹Stufe›', '‹Datum›', '‹Zeit›'), grundText('fehler', '‹Detail›'), QA_TEXT.baldAb('‹Zeit›'), QA_TEXT.abgelaufen,
    QA_TEXT.keyGeloescht, QA_TEXT.altKey, QA_TEXT.keyAbgelehnt, QA_TEXT.keinEvent, QA_TEXT.keinSchluessel, QA_TEXT.quittierenFehler(401),
    QA_TEXT.loeschenFehler(401), QA_TEXT.freigabeAbgelehnt, QA_TEXT.wartet('‹Grund aus Q3›'),
  ];
  eq(texte, [
    'Freigabe vom Launcher (‹Name› · ‹Stufe›), gültig bis ‹Datum› ‹Zeit›.',
    'Freigabe fehlgeschlagen: ‹Detail›',
    'Die Freigabe gilt noch bis ‹Zeit›. Für eine neue Freigabe muss der Launcher laufen.',
    'Die Freigabe ist abgelaufen. Starte den Launcher, damit Q&A eine neue bekommt.',
    'Der alte Proxy-Key wurde gelöscht; Q&A nutzt jetzt die Freigabe des Launchers.',
    'Zugang über den alten Proxy-Key (Übergang).',
    'Der Server nimmt den alten Proxy-Key nicht mehr an. Melde dich im Launcher an.',
    'Noch kein Event. Erzeuge zuerst ein Event.',
    'Kein Event-Schlüssel. Erzeuge zuerst ein Event mit „Neues Event“.',
    'Quittieren fehlgeschlagen (HTTP 401)',
    'Löschen im Relay fehlgeschlagen (HTTP 401)',
    'Der Server hat die Freigabe abgelehnt. Ich hole eine neue beim Launcher.',
    'Extern ist an und wartet auf eine Freigabe: ‹Grund aus Q3›',
  ], 'P29 G2: Q2, Q3i, Q4, Q5, Q6b, Q6c, Q6d, Q8, Q9, Q10, Q11, Q12 wörtlich nach der Texttabelle 9.10');
  const { fehler: _q3i, ...q3 } = Q3;
  const modul = quelle('../src/main/cloud-zugang.ts');
  eq([GRUND_TEXT, modul.includes('"')], [q3, false], 'P29 G2: Q3a–Q3h wörtlich; cloud-zugang.ts ohne ASCII-Anführungszeichen');
}

// --- P29 G9: rein ------------------------------------------------------------------------------------------------------
{
  const modul = quelle('../src/main/cloud-zugang.ts');
  const importe = modul.split('\n').filter((z) => /^import\b/.test(z));
  eq(importe, ["import type { FreigabeGrund } from '@jm/app-runtime/freigabe';"], 'P29 G9: cloud-zugang.ts lädt nichts zur Laufzeit (nur ein Typ aus @jm/app-runtime/freigabe, kein Electron)');
}

// --- P30: Q&A-Main (Quelltext-Wächter; cloud.ts und index.ts laden Electron und laufen hier nicht) ---------------------
/** Ausschnitt ab `start` bis vor das erste `ende` dahinter ('' wenn eines fehlt). */
function ausschnitt(text: string, start: string, ende: string): string {
  const a = text.indexOf(start);
  const b = a < 0 ? -1 : text.indexOf(ende, a + start.length);
  return a < 0 || b < 0 ? '' : text.slice(a, b);
}
{
  const cloud = quelle('../src/main/cloud.ts');
  const index = quelle('../src/main/index.ts');
  const zuweisungen = index.split('\n').filter((z) => /\bcloudSecrets = \{/.test(z));
  eq(
    [
      cloud.includes("const EMPTY: CloudSecrets = { publicJwk: null, privateJwk: null, proxyKey: '', freigabe: null };"),
      ausschnitt(cloud, 'export function loadSecrets(', '\n}\n').includes('freigabe: leseFreigabe(obj.freigabe),'),
      index.includes("let cloudSecrets: CloudSecrets = { publicJwk: null, privateJwk: null, proxyKey: '', freigabe: null };"),
      ausschnitt(index, 'async function cloudGenerateEvent(', '\n}\n').includes('cloudSecrets = { ...cloudSecrets, publicJwk, privateJwk, freigabe: null };'),
      index.includes("cloudSecrets = { ...cloudSecrets, proxyKey: String(key || '').trim() };"),
      zuweisungen.length,
      zuweisungen.filter((z) => !z.includes('{ ...cloudSecrets,')),
      // Fixrunde 1 (AR64): Token und alter Key nur aus \x21-\x7e (sonst trägt fetch den Wert in die Fehlermeldung)
      [leseFreigabe(frei(BIS_72))?.token, leseFreigabe(frei(BIS_72, EVENT, 'jm1.a\r\nb')), leseFreigabe(frei(BIS_72, EVENT, 'jm1.a€b')), leseFreigabe(frei(BIS_72, EVENT, 'jm1.a b'))],
      ausschnitt(index, "ipcMain.handle('qa:setProxyKey'", '\n  });').includes("if (!/^[\\x21-\\x7e]*$/.test(String(key || '').trim())) key = '';"),
    ],
    [true, true, true, true, true, 4, [], ['jm1.test.frei', null, null, null], true],
    'P30 G8: CloudSecrets.freigabe in allen fünf Konstruktoren (cloud.ts EMPTY, loadSecrets; index.ts Start, Neues Event, alter Key), jede weitere Zuweisung mit ...cloudSecrets',
  );

  const holen = ausschnitt(index, 'function freigabeHolen(', '\n}\n');
  const leeren = "cloudSecrets = { ...cloudSecrets, freigabe: f, proxyKey: '' };";
  eq(
    [
      index.includes("import { holeFreigabe, type FreigabeGrund } from '@jm/app-runtime/freigabe';"),
      holen.includes("holeFreigabe({ appId: 'jm-qa', zweck: 'qa-relay', ziel: eventId }, { appDataDir: app.getPath('appData') })"),
      holen.includes('erneuernFaellig(cloudSecrets.freigabe, eventId, jetzt)') && holen.includes('versuchErlaubt(freigabeVersuchAm, jetzt)'),
      holen.includes('if (freigabeLaeuft) return freigabeLaeuft;') && holen.includes('if (getConfig().eventId !== eventId) return;'),
      holen.includes(leeren) && holen.indexOf(leeren) < holen.indexOf('saveSecrets(app.getPath'),
      (index.match(/proxyKey: ''/g) ?? []).length,
      // Fixrunde 1 (AR64): das Token geht durch leseFreigabe; finally gibt die Sperre frei
      holen.includes('const f = leseFreigabe({ token: e.freigabe,') && holen.includes('if (!f) {'),
      holen.includes('.finally(() => {\n    freigabeLaeuft = null;\n  });'),
    ],
    [true, true, true, true, true, 2, true, true],
    'P30 QR2/QR3/QR6: holeFreigabe mit appId jm-qa, Zweck qa-relay, Ziel Event-ID, nur fällig, höchstens alle 30 s, nie doppelt; die Freigabe leert den alten Key, publicJwk und privateJwk bleiben',
  );

  const ein = ausschnitt(index, 'async function cloudEnable(', '\n}\n');
  const einPfad = ausschnitt(ein, 'if (enabled) {', '} else {');
  eq(
    [
      (index.match(/cloudEnabled: false/g) ?? []).length,
      ausschnitt(index, 'async function cloudPurge(', '\n}\n').includes('patchConfig({ cloudEnabled: false });'),
      einPfad.length > 0 && !einPfad.includes('cloudEnabled: false'),
      einPfad.includes('cloudError = QA_TEXT.keinEvent;') && einPfad.includes('await startCloudPoll();'),
      index.includes('if (getConfig().cloudEnabled) void cloudEnable(true);'),
    ],
    [1, true, true, true, true],
    'P30 EP22/QR7: cloudEnabled false nur im Ausschalt-Pfad („Event beenden“); „An“ bleibt an ohne Zugang oder Event (Q8); der Start stellt „Extern“ wieder her',
  );

  const takt = ausschnitt(index, 'async function cloudPollTick(', '\n}\n');
  eq(
    [
      takt.indexOf('await freigabeHolen();') >= 0 && takt.indexOf('await freigabeHolen();') < takt.indexOf('zugang = aktuellerZugang();'),
      takt.includes("if (zugang.art === 'keiner') {") && takt.indexOf("if (zugang.art === 'keiner') {") < takt.indexOf('await openEvent('),
      takt.includes('await openEvent(cfg, cloudSecrets, zugang);') && takt.includes('await pollPending(cfg, cloudSecrets, zugang);')
        && takt.includes('await ackItems(cfg, zugang, acked);'),
      takt.includes('nachAblehnung(zugang.art, err instanceof RelayFehler ? err.status : 0)'),
      takt.includes('cloudSecrets = { ...cloudSecrets, freigabe: null };') && takt.includes('cloudError = QA_TEXT.freigabeAbgelehnt;'),
      takt.includes('altKeyAbgelehnt = true;') && takt.includes('cloudError = QA_TEXT.keyAbgelehnt;'),
      ausschnitt(index, 'function aktuellerZugang(', '\n}\n').includes("proxyKey: altKeyAbgelehnt ? '' : cloudSecrets.proxyKey,"),
      ausschnitt(index, 'function cloudCfg(', '\n}\n').includes('proxyUrl: effektiveProxyUrl(c.proxyUrl),'),
      // Fixrunde 1 (AR64): nach jedem Warten prüft der Takt, ob Extern noch läuft und das Event gleich ist (vor dem Zugang und vor dem Öffnen)
      takt.indexOf('if (!cloudTimer || getConfig().eventId !== cfg.eventId) {') > takt.indexOf('await freigabeHolen();')
        && takt.indexOf('if (!cloudTimer || getConfig().eventId !== cfg.eventId) {') < takt.indexOf('zugang = aktuellerZugang();')
        && takt.lastIndexOf('if (!cloudTimer || getConfig().eventId !== cfg.eventId) {') > takt.indexOf('await openEvent(')
        && takt.lastIndexOf('if (!cloudTimer || getConfig().eventId !== cfg.eventId) {') < takt.indexOf('await pollPending('),
      // nur die abgelehnte Freigabe verwerfen, danach speichern, ein Fehler dabei ist kein Absturz
      takt.includes("cloudSecrets.freigabe?.token === zugang.f.token")
        && /cloudSecrets = \{ \.\.\.cloudSecrets, freigabe: null \};\n\s+try \{\n\s+saveSecrets\(app\.getPath\('userData'\), cloudSecrets\);\n\s+\} catch \(e\) \{/.test(takt),
    ],
    [true, true, true, true, true, true, true, true, true, true],
    'P30 QR1/QR4/QR5: Takt holt erst die Freigabe, pausiert ohne Zugang, öffnet, holt ab und quittiert mit dem Zugang; 401/403 verwirft die Freigabe (Q11) bzw. den alten Key (Q6d); Vorgabe-URL',
  );

  const ack = ausschnitt(cloud, 'export async function ackItems(', '\n}\n');
  const purge = ausschnitt(cloud, 'export async function purgeEvent(', '\n}\n');
  eq(
    [
      ack.includes('if (!res.ok) throw new RelayFehler(QA_TEXT.quittierenFehler(res.status), res.status);'),
      purge.includes('if (!res.ok) throw new RelayFehler(QA_TEXT.loeschenFehler(res.status), res.status);'),
      cloud.includes('X-Proxy-Key'),
      (cloud.match(/zugangsKopf\(zugang\)/g) ?? []).length,
      cloud.includes('throw new Error(QA_TEXT.keinSchluessel);') && !cloud.includes('erst „Neues Event"'),
      // Fixrunde 1 (AR64): auch Öffnen und Abruf melden einen Nicht-ok-Status als RelayFehler (sonst greift 401/403 nie)
      ausschnitt(cloud, 'export async function openEvent(', '\n}\n').includes('if (!res.ok) throw new RelayFehler(`Öffnen fehlgeschlagen (HTTP ${res.status})`, res.status);'),
      ausschnitt(cloud, 'export async function pollPending(', '\n}\n').includes('if (!res.ok) throw new RelayFehler(`Abruf fehlgeschlagen (HTTP ${res.status})`, res.status);'),
    ],
    [true, true, false, 4, true, true, true],
    'P30 QR8, Q9, Q10: ack und purge prüfen res.ok; Kopfzeile nur über zugangsKopf (kein X-Proxy-Key in cloud.ts); Q9 ohne ASCII-Schlusszeichen',
  );

  const logs = [...cloud.split('\n'), ...index.split('\n')].filter((z) => z.includes('getLog()'));
  eq(logs.filter((z) => /token|e\.freigabe|proxyKey|cloudSecrets/.test(z)), [], 'P30 G4: keine Log-Zeile mit Freigabe, Token oder Key');
}

// --- P30 G6: qa.cloud.secret im Verhalten (Nachbesserung Abschluss, sicherheit:12) ------------------------------------------
// Attrappe des Verschlüsselers (umkehrbar, ohne Klartext): in der Datei steht nur dessen Ausgabe; ohne Schlüsselspeicher bleibt
// die Freigabe (befristet, 72 h) nur im Speicher. cloud.ts schreibt nur, was geheimnisDatei liefert (Quelltext-Wächter).
{
  const modulZugang = (await import('../src/main/cloud-zugang.ts')) as {
    geheimnisDatei?: (s: { freigabe: QaFreigabe | null }, v: { verfuegbar(): boolean; verschluesseln(text: string): Uint8Array }) => Uint8Array;
  };
  const geheimnisDatei = modulZugang.geheimnisDatei;
  const f: QaFreigabe = { token: 'jm1.test-freigabe-p30.sig', bis: BIS_72, ziel: EVENT, konto: KONTO };
  const s = {
    publicJwk: { kty: 'RSA', n: 'test-n', e: 'AQAB' }, privateJwk: { kty: 'RSA', n: 'test-n', e: 'AQAB', d: 'test-privat-d' },
    proxyKey: 'test-alter-key-p30', freigabe: f,
  };
  const zu = (t: string): Uint8Array => new TextEncoder().encode(`v1:${Buffer.from(t, 'utf8').toString('base64').split('').reverse().join('')}`);
  const text = (b: Uint8Array): string => new TextDecoder().decode(b);
  const mit = geheimnisDatei ? text(geheimnisDatei(s, { verfuegbar: () => true, verschluesseln: zu })) : '';
  eq([mit === text(zu(JSON.stringify(s))), ['jm1.', 'test-freigabe-p30', 'test-privat-d', 'test-alter-key-p30'].filter((x) => mit.includes(x))], [true, []],
    'P30 G6: mit Schlüsselspeicher steht in qa.cloud.secret nur die Ausgabe des Verschlüsselers (weder Freigabe noch Schlüssel noch alter Key im Klartext)');
  const ohne = geheimnisDatei ? text(geheimnisDatei(s, { verfuegbar: () => false, verschluesseln: () => { throw new Error('kein Schlüsselspeicher'); } })) : '';
  eq([ohne.includes('jm1.'), ohne.includes('test-freigabe-p30'), ohne ? (JSON.parse(ohne) as { freigabe: unknown }).freigabe : 'fehlt'], [false, false, null],
    'P30 G6: ohne Schlüsselspeicher bleibt die Freigabe nur im Speicher (qa.cloud.secret ohne Freigabe; Schlüsselpaar und alter Key wie in Q&A 0.5.0)');
  eq(ausschnitt(quelle('../src/main/cloud.ts'), 'export function saveSecrets(', '\n}\n').includes('  writeFileSync(secretPath(userDataDir), geheimnisDatei(s, {'), true,
    'P30 G6: saveSecrets schreibt nur, was geheimnisDatei liefert (safeStorage als Verschlüsseler)');
}

// --- P31: Oberfläche (Quelltext-Wächter; React läuft hier nicht) ------------------------------------------------------
{
  const settings = quelle('../src/renderer/src/components/Settings.tsx');
  const panel = quelle('../src/renderer/src/components/CloudPanel.tsx');
  const typen = quelle('../src/shared/types.ts');
  const info = ausschnitt(quelle('../src/main/index.ts'), 'function buildCloudInfo(', '\n}\n');
  const rueckgabe = ausschnitt(info, 'return {', '\n  };');
  eq(
    [
      settings.includes('<Row label="Server-Adresse" hint="Vorgabe: Server der Suite. Nur für Entwicklung und Fehlersuche ändern.">'),
      settings.includes('placeholder={cloud.proxyUrl}') && info.includes('proxyUrl: cfg.proxyUrl,'),
      settings.includes('<Row label="Alter Proxy-Key (Übergang)" hint="Nur noch kurz gültig. Mit Anmeldung im Launcher brauchst du ihn nicht.">'),
      panel.includes('Für Fragen per Livestream oder Presse: im Launcher anmelden und hier ein Event erzeugen.'),
      ['Proxy-URL', 'Basis-URL des Q&A-Relays', 'Zugriffs-Key des Proxys', 'Hinterlegt (verschlüsselt gespeichert).', 'In den Einstellungen Proxy-URL']
        .filter((t) => settings.includes(t) || panel.includes(t)),
    ],
    [true, true, true, true, []],
    'P31 9.10: Q1 (Platzhalter = wirksame Adresse), Q6a und Q7 wörtlich in Settings.tsx und CloudPanel.tsx, die alten Texte sind weg',
  );
  const keyFeld = "{cloud.hasKey || cloud.zugang.art !== 'freigabe' ? (";
  eq(
    [
      settings.includes(keyFeld) && settings.indexOf(keyFeld) < settings.indexOf('<Row label="Alter Proxy-Key (Übergang)"'),
      (settings.match(/<Row label="Alter Proxy-Key/g) ?? []).length,
      settings.includes(') : cloud.zugang.hinweis ? ('),
      settings.includes('{cloud.zugang.zeile}') && panel.includes('{cloud.zugang.zeile}'),
    ],
    [true, 1, true, true],
    'P31 Q6a/Q6b/Q12: Feld alter Key nur bei gespeichertem Key oder ohne Freigabe, danach Q6b; Zugangszeile in Einstellungen und CloudPanel',
  );
  eq(
    [
      panel.includes('disabled={!cloud.configured && !cloud.enabled}'),
      panel.includes('hasKey'),
      info.includes('const configured = !!(cfg.proxyUrl && c.eventId && cloudSecrets.publicJwk);'),
      info.includes('cloudSecrets.proxyKey &&') || info.includes('&& cloudSecrets.proxyKey)'),
    ],
    [true, false, true, false],
    'P31 3/10: An-Knopf hängt nicht am Key (configured = Server-Adresse, Event, Schlüsselpaar)',
  );
  eq(
    [
      typen.includes("zugang: { art: 'freigabe' | 'alter-key' | 'keiner'; zeile: string; ton: 'ok' | 'warn' | 'fehler'; hinweis: string | null };"),
      info.includes('const zeile = zugangsZeile({') && rueckgabe.includes('zeile: zeile.text,') && rueckgabe.includes('ton: zeile.ton,'),
      rueckgabe.includes('hinweis: altKeyGeloescht && !cloudSecrets.proxyKey ? QA_TEXT.keyGeloescht : null,'),
      /token|zugang\.f\b|cloudSecrets\.freigabe/.test(rueckgabe),
    ],
    [true, true, true, false],
    'P31 G8/G4: QaCloudInfo.zugang im einzigen Konstruktor buildCloudInfo (zugangsZeile, Q6b), keine Freigabe an den Renderer',
  );
}

// ── Ende der Fälle ──
console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);

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

// ── Ende der Fälle ──
console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);

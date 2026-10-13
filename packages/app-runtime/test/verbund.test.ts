// Selbsttest Verbund der Tool-Seite (Master-Link Teil 2b, Release 2, Spec 19.4) — ohne Electron, mit tsx:
//   npm run selftest -w @jm/app-runtime      (läuft nach dem CSP-Test aus test/selftest.ts)
//
// Jeder Block lädt seine Module mit `await import(…)` INNERHALB des Blocks. Fehlt das Modul einer
// späteren Aufgabe, laufen die Blöcke davor durch, dann bricht der Lauf mit ERR_MODULE_NOT_FOUND ab.
// Blöcke späterer Aufgaben kommen direkt vor die Zeile „// ── Abschluss“.
// Kein Test lädt Electron (die CI installiert ohne Postinstalls), keiner öffnet einen Socket.

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

// ── C11 · Anzeige V1–V15 (Spec 16.4) ─────────────────────────────────────────
{
  const { verbundAnzeige, kuerzeShowName } = await import('../src/verbund-anzeige');
  const { fehlerText } = await import('@jm/master-link');
  const uhr = (ms: number): string => `U${ms}`; // feste „Uhrzeit“: macht ⟨hh:mm⟩ im Test eindeutig
  const show = (name: string) => ({ schemaVersion: 1, name, tools: [] });
  const A = { masterId: 'M1', masterName: 'Regie-PC', epoche: 'e1', folge: 3, schluessel: 'aaaaaaaaaaaaaaaa', show: show('Gala'), mitDokument: [], empfangenAm: 1000 };
  const L = ' · letzter Stand: Gala U1000';
  const mit = (angewendet: typeof A | null, extra: Record<string, unknown> = {}) => ({ masterName: 'Regie-PC', angewendet, ...extra });
  const zeile = (d: unknown) => verbundAnzeige(d as never, uhr);
  const gleich = (name: string, d: unknown, text: string, farbe: string): void => {
    const a = zeile(d);
    check(name, a !== null && a.text === text && a.farbe === farbe, a);
  };

  check('C11 V1: einzelplatz → keine Anzeige', zeile({ art: 'einzelplatz' }) === null);
  gleich('C11 V2 ohne angewendet', { art: 'warte', ...mit(null) }, 'Verbunden mit Regie-PC · Show wird geladen…', 'gelb');
  gleich('C11 V2 mit angewendet (Zusatz L)', { art: 'warte', ...mit(A) }, `Verbunden mit Regie-PC · Show wird geladen…${L}`, 'gelb');
  gleich('C11 V3 ohne angewendet', { art: 'ohne-daten', ...mit(null) }, 'Regie-PC antwortet nicht auf die Anfrage nach Show-Daten (Launcher-Update am Master nötig?)', 'gelb');
  gleich('C11 V3 mit angewendet', { art: 'ohne-daten', ...mit(A) }, `Regie-PC antwortet nicht auf die Anfrage nach Show-Daten (Launcher-Update am Master nötig?)${L}`, 'gelb');
  const neuer = { ...A, folge: 4, show: show('Gala neu'), empfangenAm: 2000 };
  gleich('C11 V4 mit angewendet: Name und Zeit des ANGEWENDETEN Stands', { art: 'aktuell', letzter: neuer, ...mit(A) }, 'Show vom Master: Gala · Stand U1000', 'gruen');
  gleich('C11 V4 ohne angewendet: Name und Zeit des empfangenen Stands', { art: 'aktuell', letzter: neuer, ...mit(null) }, 'Show vom Master: Gala neu · Stand U2000', 'gruen');
  gleich('C11 V4 angewendet von anderem Master → empfangener Stand', { art: 'aktuell', letzter: { ...neuer, masterId: 'M2' }, ...mit(A) }, 'Show vom Master: Gala neu · Stand U2000', 'gruen');
  const ohne = (grund: string) => ({ ...A, folge: 5, show: null, grund, empfangenAm: 3000 });
  gleich('C11 V5 keine-show, etwas angewendet', { art: 'aktuell', letzter: ohne('keine-show'), ...mit(A) }, `Regie-PC hat keine Show offen${L}`, 'gelb');
  gleich('C11 V6 keine-show, nichts angewendet', { art: 'aktuell', letzter: ohne('keine-show'), ...mit(null) }, 'Regie-PC hat keine Show offen', 'gedaempft');
  gleich('C11 V7 zu-gross mit angewendet', { art: 'aktuell', letzter: ohne('zu-gross'), ...mit(A) }, `Show am Master zu groß für den Verbund${L}`, 'rot');
  gleich('C11 V7 zu-gross ohne angewendet', { art: 'aktuell', letzter: ohne('zu-gross'), ...mit(null) }, 'Show am Master zu groß für den Verbund', 'rot');
  gleich('C11 V8 nicht-lesbar mit angewendet', { art: 'aktuell', letzter: ohne('nicht-lesbar'), ...mit(A) }, `Show am Master nicht lesbar${L}`, 'rot');
  gleich('C11 V8 nicht-lesbar ohne angewendet', { art: 'aktuell', letzter: ohne('nicht-lesbar'), ...mit(null) }, 'Show am Master nicht lesbar', 'rot');
  for (const client of [{ art: 'sucht' }, { art: 'verbindet', adresse: '10.0.0.5' }, { art: 'aus' }]) {
    gleich(`C11 V9 getrennt (${client.art}), etwas angewendet`, { art: 'getrennt', client, ...mit(A) }, `Regie-PC nicht verbunden${L}`, 'gelb');
    gleich(`C11 V10 getrennt (${client.art}), nichts angewendet`, { art: 'getrennt', client, ...mit(null) }, 'Suche Regie-PC…', 'gelb');
  }
  const CODES = ['zeit', 'nicht-gefunden', 'verweigert', 'netz', 'kein-master', 'zertifikat', 'uhr', 'protokoll', 'unbekannt', 'signatur', 'ersetzt', 'datei', 'sonstig'] as const;
  for (const code of CODES) {
    const text = fehlerText(code, { masterName: 'Regie-PC', adresse: '10.0.0.5', errCode: 'EXYZ', suite: '0.14.0', masterProtokoll: 1 });
    const client = { art: 'fehler', code, text };
    gleich(`C11 V11 ${code}: Text des Clients unverändert`, { art: 'getrennt', client, ...mit(null) }, text, 'rot');
    gleich(`C11 V11 ${code}: Text des Clients + Zusatz L`, { art: 'getrennt', client, ...mit(A) }, `${text}${L}`, 'rot');
  }
  check('C11 V11: 13 verschiedene Client-Texte geprüft', new Set(CODES.map((c) => fehlerText(c, { masterName: 'Regie-PC' }))).size === 13);
  gleich('C11 V12 ohne angewendet', { art: 'warte', ...mit(null, { fehler: 'EBUSY' }) }, 'Show vom Master nicht übernommen: EBUSY', 'rot');
  gleich('C11 V12 mit angewendet: „in Benutzung“ statt Zusatz L', { art: 'aktuell', letzter: neuer, ...mit(A, { fehler: 'EBUSY' }) }, 'Show vom Master nicht übernommen: EBUSY · in Benutzung: Gala U1000', 'rot');
  gleich('C11 V13 entkoppelt gelb', { art: 'frueher', grund: 'entkoppelt', ...mit(A) }, `Daten vom früheren Master Regie-PC (nicht mehr gekoppelt)${L}`, 'gelb');
  gleich('C11 V13 datei rot', { art: 'frueher', grund: 'datei', ...mit(A) }, `Kopplungsdatei beschädigt. Neu koppeln.${L}`, 'rot');
  gleich('C11 V14 datei-defekt', { art: 'datei-defekt' }, 'Kopplungsdatei beschädigt. Neu koppeln.', 'rot');
  const verworfen = { grund: 'folge', seit: 5 };
  gleich('C11 V15 ohne angewendet', { art: 'warte', ...mit(null, { verworfen }) }, 'Show-Daten von Regie-PC nicht lesbar (Tool-Update nötig?)', 'rot');
  gleich('C11 V15 mit angewendet', { art: 'aktuell', letzter: neuer, ...mit(A, { verworfen }) }, `Show-Daten von Regie-PC nicht lesbar (Tool-Update nötig?)${L}`, 'rot');

  // Vorrang V12 > V15 > alle anderen, in jeder Lage außer einzelplatz/datei-defekt
  const lagen = [
    { art: 'warte' }, { art: 'ohne-daten' }, { art: 'aktuell', letzter: neuer }, { art: 'aktuell', letzter: ohne('zu-gross') },
    { art: 'getrennt', client: { art: 'sucht' } }, { art: 'getrennt', client: { art: 'fehler', code: 'netz', text: 'Netz weg' } },
    { art: 'frueher', grund: 'entkoppelt' }, { art: 'frueher', grund: 'datei' },
  ];
  check('C11 Vorrang: V12 vor V15 vor allen anderen', lagen.every((l) => zeile({ ...l, ...mit(A, { fehler: 'EBUSY', verworfen }) })?.text.startsWith('Show vom Master nicht übernommen: EBUSY')));
  check('C11 Vorrang: V15 vor allen anderen', lagen.every((l) => zeile({ ...l, ...mit(A, { verworfen }) })?.text.startsWith('Show-Daten von Regie-PC nicht lesbar')));
  const mitZusatz = lagen.filter((l) => l !== lagen[2]); // alle außer V4 (aktuell mit Show)
  check(
    'C11 Zusatz L genau dann, wenn angewendet nicht null (sieben Lagen)',
    mitZusatz.length === 7 && mitZusatz.every((l) => zeile({ ...l, ...mit(A) })!.text.endsWith(L) && !zeile({ ...l, ...mit(null) })!.text.includes(' · letzter Stand: ')),
  );
  check('C11 V4 hat keinen Zusatz L', !zeile({ art: 'aktuell', letzter: neuer, ...mit(A) })!.text.includes('letzter Stand'));

  // ⟨S⟩: höchstens 40 Zeichen (Code Points)
  const n40 = 'A'.repeat(40);
  check('C11 kuerzeShowName: 40 Zeichen bleiben', kuerzeShowName(n40) === n40);
  check('C11 kuerzeShowName: 41 → 39 + …', kuerzeShowName('B'.repeat(41)) === `${'B'.repeat(39)}…`);
  const emoji = `${'C'.repeat(39)}🎬`;
  check('C11 kuerzeShowName: Emoji an Stelle 40 bleibt ganz', kuerzeShowName(emoji) === emoji);
  const emoji41 = `${'C'.repeat(38)}🎬🎤X`;
  check('C11 kuerzeShowName: 41 Code Points mit Emoji → 39 + …, kein halbes Emoji', kuerzeShowName(emoji41) === `${'C'.repeat(38)}🎬…`);
  const lang = { ...A, show: show('D'.repeat(50)) };
  check('C11 lange Shownamen werden in jeder Zeile gekürzt', zeile({ art: 'warte', ...mit(lang) })!.text.endsWith(`${'D'.repeat(39)}… U1000`));
  // Vorgabe-Uhrzeit: hh:mm in Ortszeit dieses Rechners
  const ortszeit = new Date(2026, 9, 8, 9, 5, 0).getTime();
  const v4 = verbundAnzeige({ art: 'aktuell', letzter: { ...A, empfangenAm: ortszeit }, ...mit({ ...A, empfangenAm: ortszeit }) } as never);
  check('C11 Vorgabe-Uhrzeit hh:mm (Ortszeit)', v4?.text === 'Show vom Master: Gala · Stand 09:05', v4);
}

// ── Abschluss ────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

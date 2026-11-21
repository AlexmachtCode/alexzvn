// Regeln und Texte des Zugangs über den Launcher (Anmeldung Teil 2, Task 10). Rein: kein Electron, keine Datei.
// npm run selftest -w @jm/connect
process.env.TZ = 'Europe/Berlin';
import type { FreigabeGrund } from '@jm/app-runtime/freigabe';
import type { ProxyKeySource } from '../src/shared/types';

const r = await import('../src/main/zugang/regeln');
const {
  waehleZugang, erneuernFaellig, versuchErlaubt, zugangsKopf, leseFreigabe, leseGehalten, geheimnisDatei, leseFehlerCode,
  altKeyVerworfen, nachAblehnung, grundText, jwtGrundText, ZUGANG_TEXT, cloudZeile, anmeldungZeile,
} = r;
type ConnectFreigabe = import('../src/main/zugang/regeln').ConnectFreigabe;
type ZugangsLage = import('../src/main/zugang/regeln').ZugangsLage;
type ZoomAnmeldungLage = import('../src/main/zugang/regeln').ZoomAnmeldungLage;
type ConnectZweck = import('../src/main/zugang/regeln').ConnectZweck;
type JwtGrund = import('../src/main/zugang/regeln').JwtGrund;

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
/** Tabelle: je Zeile [Name, Ist, Soll]; Ist ist ein Wert oder { text, ton } (verglichen als `text|ton`). */
function kreuz(name: string, zeilen: ReadonlyArray<readonly [string, unknown, unknown]>): void {
  const form = (v: unknown): unknown => (typeof v === 'object' && v !== null && 'text' in v && 'ton' in v ? `${(v as { text: string }).text}|${(v as { ton: string }).ton}` : v);
  const falsch = zeilen.filter(([, ist, soll]) => form(ist) !== soll);
  if (falsch.length === 0) { pass++; console.log(`  ok  ${name} (${zeilen.length} Zeilen)`); return; }
  fail++;
  console.log(`FAIL  ${name}: ${falsch.length} von ${zeilen.length} weichen ab`);
  for (const [n, ist, soll] of falsch.slice(0, 5)) console.log(`      ${n}\n        ist:  ${String(form(ist))}\n        soll: ${String(soll)}`);
}

const J = new Date(2026, 10, 20, 9, 0).getTime();
const F = (o: Partial<ConnectFreigabe> = {}): ConnectFreigabe => ({ zweck: 'connect-raum', token: 'jm1.test-a', bis: J + 72 * 3600_000, ziel: 'cop31-tag1', konto: { name: 'Maria S.', stufe: 'kollege' }, ...o });
const lage = (o: Partial<ZugangsLage> = {}): ZugangsLage => ({
  wahl: 'keiner', konto: { name: 'Maria S.', stufe: 'kollege' }, bis: J + 72 * 3600_000, letzterGrund: null, detail: null,
  altHerkunft: 'none' as ProxyKeySource, altAbgelehnt: false, versucht: false, geloescht: false, ...o,
});
const alage = (o: Partial<ZoomAnmeldungLage> = {}): ZoomAnmeldungLage => ({
  quelle: 'keine', grund: null, detail: null, konto: { name: 'Maria S.', stufe: 'kollege' }, freigabeBis: J + 72 * 3600_000,
  devTtlS: null, versucht: false, geloescht: false, ...o,
});

ck('T10 QR1: Freigabe für dieses Ziel vor altem Key vor keinem; abgelehnter alter Key zählt nicht',
  waehleZugang({ freigabe: F(), ziel: 'cop31-tag1', altKey: 'k', altAbgelehnt: false, jetzt: J }).art === 'freigabe'
    && waehleZugang({ freigabe: F(), ziel: 'cop31-tag2', altKey: 'k', altAbgelehnt: false, jetzt: J }).art === 'alter-key'
    && waehleZugang({ freigabe: F({ bis: J }), ziel: 'cop31-tag1', altKey: null, altAbgelehnt: false, jetzt: J }).art === 'keiner'
    && waehleZugang({ freigabe: null, ziel: 'x', altKey: 'k', altAbgelehnt: true, jetzt: J }).art === 'keiner');
ck('T10 QR2: erneuern ohne Freigabe, bei anderem Ziel, unter 24 h Rest; Abstand 30 s',
  erneuernFaellig(null, 'a', J) && erneuernFaellig(F(), 'anders', J) && erneuernFaellig(F({ bis: J + 86_399_999 }), 'cop31-tag1', J)
    && !erneuernFaellig(F({ bis: J + 86_400_000 }), 'cop31-tag1', J) && versuchErlaubt(null, J) && !versuchErlaubt(J - 29_999, J) && versuchErlaubt(J - 30_000, J));
ck('T10: Kopfzeilen je Zweck',
  JSON.stringify(zugangsKopf('connect-raum', { art: 'freigabe', f: F() })) === '{"Authorization":"Bearer jm1.test-a"}'
    && JSON.stringify(zugangsKopf('connect-raum', { art: 'alter-key', key: 'k1' })) === '{"X-Proxy-Key":"k1"}'
    && JSON.stringify(zugangsKopf('zoom-sdk', { art: 'alter-key', key: 'k2' })) === '{"X-Zoom-Sdk-Key":"k2"}'
    && JSON.stringify(zugangsKopf('zoom-jwt', { art: 'keiner' })) === '{}');
ck('T10 G4: leseFreigabe verwirft Token mit Steuerzeichen oder Leerraum, fremden Zweck, unendliches bis, leeres Ziel, fremde Stufe',
  leseFreigabe(F(), 'connect-raum') !== null && [{ token: 'jm1.a b' }, { token: 'jm1.a\n' }, { zweck: 'zoom-jwt' }, { bis: Infinity }, { ziel: '' }, { konto: { name: 'x', stufe: 'chef' } }]
    .every((o) => leseFreigabe({ ...F(), ...o }, 'connect-raum') === null));
ck('T10 QR2: ohne Ziel nie fällig', erneuernFaellig(null, '', J) === false && erneuernFaellig(F(), '', J) === false);
ck('T10: Stufe als Code an die Texte: Anzeigename Admin/Kollege/Externer',
  ZUGANG_TEXT.cloudFreigabe('A', 'admin', 'd', 'z') === 'Cloud-Zugang über den Launcher (A · Admin), gültig bis d z.'
    && ZUGANG_TEXT.anmeldungServer('E', 'externer', 'd', 'z') === 'Zoom-Anmeldung über den Launcher (E · Externer), Freigabe gültig bis d z.');
ck('T10 G6: geheimnisDatei: mit Schlüsselspeicher nur die Ausgabe des Verschlüsselers; ohne → null',
  geheimnisDatei({ 'connect-raum': F() }, { verfuegbar: () => true, verschluesseln: (t) => new TextEncoder().encode('E:' + t.length) }) !== null
    && geheimnisDatei({ 'connect-raum': F() }, { verfuegbar: () => false, verschluesseln: () => { throw new Error('nie'); } }) === null);
ck('T10 G6: geheimnisDatei gibt genau die Bytes des Verschlüsselers zurück',
  new TextDecoder().decode(geheimnisDatei({ 'connect-raum': F() }, { verfuegbar: () => true, verschluesseln: () => new TextEncoder().encode('BYTES') }) ?? new Uint8Array()) === 'BYTES');
ck('T10 OE5: nur 401 nicht-angemeldet oder alter-key-abgelaufen verwirft den alten Key; 403 nie',
  altKeyVerworfen(401, 'nicht-angemeldet') && altKeyVerworfen(401, 'alter-key-abgelaufen') && !altKeyVerworfen(403, 'raum-vergeben') && !altKeyVerworfen(401, null));

// Ergänzend: leseGehalten, leseFehlerCode, nachAblehnung
{
  const g = leseGehalten({ 'connect-raum': F(), 'zoom-jwt': F({ zweck: 'zoom-jwt', ziel: 'meeting-sdk' }), 'zoom-sdk': { ...F({ zweck: 'zoom-sdk', ziel: 'win-x64' }), token: 'a b' }, fremd: F() });
  ck('T10: leseGehalten behält gültige Freigaben je Zweck, verwirft ungültige und fremde Schlüssel',
    g['connect-raum']?.token === 'jm1.test-a' && g['zoom-jwt']?.ziel === 'meeting-sdk' && g['zoom-sdk'] === undefined && !('fremd' in g)
      && Object.keys(leseGehalten(null)).length === 0 && Object.keys(leseGehalten('x')).length === 0);
  ck('T10: leseGehalten verwirft eine Freigabe unter dem Schlüssel eines anderen Zwecks',
    leseGehalten({ 'connect-raum': F({ zweck: 'zoom-jwt' }) })['connect-raum'] === undefined);
}
ck('T10: leseFehlerCode nur [a-z-] 1 bis 40 Zeichen im Feld code',
  leseFehlerCode({ code: 'raum-vergeben' }) === 'raum-vergeben' && leseFehlerCode({ code: 'A' }) === null && leseFehlerCode({ code: 'a'.repeat(41) }) === null
    && leseFehlerCode({ code: '' }) === null && leseFehlerCode(null) === null && leseFehlerCode('x') === null && leseFehlerCode({ code: 5 }) === null);
ck('T10: nachAblehnung: Freigabe 401 → verwerfen, 403 raum-vergeben → nichts; alter Key nur bei altKeyVerworfen; keiner nie',
  nachAblehnung('freigabe', 401, null) === 'freigabe-verwerfen' && nachAblehnung('freigabe', 403, 'keine-freigabe') === 'freigabe-verwerfen'
    && nachAblehnung('freigabe', 403, 'raum-vergeben') === null && nachAblehnung('freigabe', 500, null) === null
    && nachAblehnung('alter-key', 401, 'nicht-angemeldet') === 'key-abgelehnt' && nachAblehnung('alter-key', 403, 'raum-vergeben') === null
    && nachAblehnung('alter-key', 401, null) === null && nachAblehnung('keiner', 401, 'nicht-angemeldet') === null);

kreuz('T10: Gründe CG1–CG10 wörtlich (T3), N2 nur für zoom-sdk mit detail kein-jm-rechner', [
  ['CG1', grundText('connect-raum', 'kein-launcher'), 'Kein Launcher mit Anmeldung gefunden. Starte den Launcher und melde dich dort an.'],
  ['CG2', grundText('connect-raum', 'launcher-unecht'), 'Der Launcher hat sich nicht ausgewiesen. Starte den Launcher neu.'],
  ['CG3 launcher-zu-alt', grundText('connect-raum', 'launcher-zu-alt'), 'Der Launcher ist zu alt für Connect. Launcher aktualisieren (ab 0.19.0).'],
  ['CG3 unbekannter-zweck', grundText('zoom-jwt', 'unbekannter-zweck'), 'Der Launcher ist zu alt für Connect. Launcher aktualisieren (ab 0.19.0).'],
  ['CG4', grundText('connect-raum', 'niemand-angemeldet'), 'Im Launcher ist niemand angemeldet. Melde dich im Launcher an (oben rechts).'],
  ['CG5', grundText('connect-raum', 'abgelaufen'), 'Die Anmeldung im Launcher ist abgelaufen. Melde dich im Launcher neu an.'],
  ['CG6', grundText('connect-raum', 'entzogen'), 'Dein Zugang wurde beim letzten Start des Launchers nicht bestätigt. Frag einen Admin.'],
  ['CG7a', grundText('connect-raum', 'kein-recht'), 'Dein Konto darf den Cloud-Raum nicht nutzen. Frag einen Admin.'],
  ['CG7b', grundText('zoom-jwt', 'kein-recht'), 'Dein Konto darf Zoom auf diesem Rechner nicht nutzen. Externe brauchen eine Zoom-Freigabe und einen JM-Rechner.'],
  ['CG7c', grundText('zoom-sdk', 'kein-recht'), 'Dein Konto darf das Zoom-SDK nicht laden. Wähle den SDK-Ordner von Hand („SDK-Ordner wählen …“).'],
  ['CG7c anderes Detail', grundText('zoom-sdk', 'kein-recht', 'etwas-anderes'), 'Dein Konto darf das Zoom-SDK nicht laden. Wähle den SDK-Ordner von Hand („SDK-Ordner wählen …“).'],
  ['CG8', grundText('zoom-sdk', 'kein-recht', 'kein-jm-rechner'),
    '„Zoom-SDK laden“ gibt es nur auf JM-Rechnern. Wähle den SDK-Ordner von Hand („SDK-Ordner wählen …“) oder bitte einen Admin, diesen Rechner als JM-Rechner zu markieren.'],
  ['N2 nur zoom-sdk: connect-raum', grundText('connect-raum', 'kein-recht', 'kein-jm-rechner'), 'Dein Konto darf den Cloud-Raum nicht nutzen. Frag einen Admin.'],
  ['N2 nur zoom-sdk: zoom-jwt', grundText('zoom-jwt', 'kein-recht', 'kein-jm-rechner'),
    'Dein Konto darf Zoom auf diesem Rechner nicht nutzen. Externe brauchen eine Zoom-Freigabe und einen JM-Rechner.'],
  ['CG9', grundText('connect-raum', 'server-nicht-erreichbar'), 'Der Server ist gerade nicht erreichbar. Ich versuche es weiter.'],
  ['CG10 mit Detail', grundText('connect-raum', 'fehler', 'HTTP 502'), 'Freigabe fehlgeschlagen: HTTP 502'],
  ['CG10 ohne Detail', grundText('zoom-sdk', 'fehler'), 'Freigabe fehlgeschlagen: fehler'],
  ['ZA8', jwtGrundText('server-abgelehnt'), 'Der Server hat die Freigabe für Zoom abgelehnt. Ich hole beim nächsten Versuch eine neue beim Launcher.'],
  ['ZA9', jwtGrundText('nicht-eingerichtet'), 'Die Zoom-Anmeldung ist auf dem Server nicht eingerichtet. Sag einem Admin Bescheid.'],
  ['ZA10', jwtGrundText('server-fehler', 'HTTP 502'), 'Der Server hat kein Zoom-Anmelde-Token geliefert (HTTP 502). Ich versuche es beim nächsten Beitritt erneut.'],
  ['FreigabeGrund über zoom-jwt', jwtGrundText('kein-recht'), grundText('zoom-jwt', 'kein-recht')],
  ['FreigabeGrund fehler über zoom-jwt', jwtGrundText('fehler', 'x'), 'Freigabe fehlgeschlagen: x'],
]);

const GRUENDE: ReadonlyArray<readonly [FreigabeGrund, string, 'warn' | 'fehler']> = [
  ['kein-launcher', 'Kein Launcher mit Anmeldung gefunden. Starte den Launcher und melde dich dort an.', 'warn'],
  ['launcher-unecht', 'Der Launcher hat sich nicht ausgewiesen. Starte den Launcher neu.', 'fehler'],
  ['launcher-zu-alt', 'Der Launcher ist zu alt für Connect. Launcher aktualisieren (ab 0.19.0).', 'fehler'],
  ['unbekannter-zweck', 'Der Launcher ist zu alt für Connect. Launcher aktualisieren (ab 0.19.0).', 'fehler'],
  ['niemand-angemeldet', 'Im Launcher ist niemand angemeldet. Melde dich im Launcher an (oben rechts).', 'warn'],
  ['abgelaufen', 'Die Anmeldung im Launcher ist abgelaufen. Melde dich im Launcher neu an.', 'warn'],
  ['entzogen', 'Dein Zugang wurde beim letzten Start des Launchers nicht bestätigt. Frag einen Admin.', 'fehler'],
  ['kein-recht', 'Dein Konto darf den Cloud-Raum nicht nutzen. Frag einen Admin.', 'fehler'],
  ['server-nicht-erreichbar', 'Der Server ist gerade nicht erreichbar. Ich versuche es weiter.', 'warn'],
  ['fehler', 'Freigabe fehlgeschlagen: HTTP 500', 'fehler'],
];
const PROXY_ZEILE = 'Cloud-Zugang über den alten Proxy-Key (Übergang).';
kreuz('T10 G7: Cloud-Zeile als Kreuzprodukt (Wahl × Grund × abgelehnt × gelöscht × Umgebung)', [
  ['Freigabe', cloudZeile(lage({ wahl: 'freigabe' }), J), 'Cloud-Zugang über den Launcher (Maria S. · Kollege), gültig bis 23.11.2026 09:00.|ok'],
  ['Freigabe bald ab, kein Launcher', cloudZeile(lage({ wahl: 'freigabe', bis: J + 3600_000, letzterGrund: 'kein-launcher' }), J),
    'Cloud-Zugang über den Launcher (Maria S. · Kollege), gültig bis 20.11.2026 10:00. Kein Launcher mit Anmeldung gefunden. Starte den Launcher und melde dich dort an.|warn'],
  ['Freigabe bald ab, ohne Grund', cloudZeile(lage({ wahl: 'freigabe', bis: J + 3600_000 }), J), 'Cloud-Zugang über den Launcher (Maria S. · Kollege), gültig bis 20.11.2026 10:00.|ok'],
  ['Freigabe mit Grund, aber noch lange gültig', cloudZeile(lage({ wahl: 'freigabe', letzterGrund: 'kein-launcher' }), J),
    'Cloud-Zugang über den Launcher (Maria S. · Kollege), gültig bis 23.11.2026 09:00.|ok'],
  ['Freigabe genau 24 h Rest, mit Grund', cloudZeile(lage({ wahl: 'freigabe', bis: J + 86_400_000, letzterGrund: 'fehler', detail: 'x' }), J),
    'Cloud-Zugang über den Launcher (Maria S. · Kollege), gültig bis 21.11.2026 09:00.|ok'],
  ['Freigabe knapp unter 24 h, Fehler mit Detail', cloudZeile(lage({ wahl: 'freigabe', bis: J + 86_340_000, letzterGrund: 'fehler', detail: 'HTTP 500' }), J),
    'Cloud-Zugang über den Launcher (Maria S. · Kollege), gültig bis 21.11.2026 08:59. Freigabe fehlgeschlagen: HTTP 500|warn'],
  ['Admin', cloudZeile(lage({ wahl: 'freigabe', konto: { name: 'Ada', stufe: 'admin' } }), J), 'Cloud-Zugang über den Launcher (Ada · Admin), gültig bis 23.11.2026 09:00.|ok'],
  ['Externer', cloudZeile(lage({ wahl: 'freigabe', konto: { name: 'Eva', stufe: 'externer' } }), J), 'Cloud-Zugang über den Launcher (Eva · Externer), gültig bis 23.11.2026 09:00.|ok'],
  ['alter Key', cloudZeile(lage({ wahl: 'alter-key' }), J), `${PROXY_ZEILE}|warn`],
  ['alter Key mit Grund', cloudZeile(lage({ wahl: 'alter-key', letzterGrund: 'unbekannter-zweck' }), J),
    'Cloud-Zugang über den alten Proxy-Key (Übergang). Der Launcher ist zu alt für Connect. Launcher aktualisieren (ab 0.19.0).|warn'],
  ['alter Key, Grund fehler mit Detail', cloudZeile(lage({ wahl: 'alter-key', letzterGrund: 'fehler', detail: 'HTTP 502' }), J),
    `${PROXY_ZEILE} Freigabe fehlgeschlagen: HTTP 502|warn`],
  ['alter Key abgelehnt', cloudZeile(lage({ wahl: 'keiner', altAbgelehnt: true }), J), 'Der Server nimmt den alten Proxy-Key nicht mehr an. Melde dich im Launcher an.|fehler'],
  ['alter Key abgelehnt, kein Launcher (CZ3 + Grund)', cloudZeile(lage({ wahl: 'keiner', altAbgelehnt: true, versucht: true, letzterGrund: 'kein-launcher' }), J),
    'Der Server nimmt den alten Proxy-Key nicht mehr an. Melde dich im Launcher an. Kein Launcher mit Anmeldung gefunden. Starte den Launcher und melde dich dort an.|fehler'],
  ['alter Key abgelehnt, Launcher zu alt', cloudZeile(lage({ wahl: 'keiner', altAbgelehnt: true, versucht: true, letzterGrund: 'launcher-zu-alt' }), J),
    'Der Server nimmt den alten Proxy-Key nicht mehr an. Melde dich im Launcher an. Der Launcher ist zu alt für Connect. Launcher aktualisieren (ab 0.19.0).|fehler'],
  ['alter Key abgelehnt, kein Recht', cloudZeile(lage({ wahl: 'keiner', altAbgelehnt: true, versucht: true, letzterGrund: 'kein-recht' }), J),
    'Der Server nimmt den alten Proxy-Key nicht mehr an. Melde dich im Launcher an. Dein Konto darf den Cloud-Raum nicht nutzen. Frag einen Admin.|fehler'],
  ['nichts versucht', cloudZeile(lage({ wahl: 'keiner' }), J), 'Connect holt die Freigabe für den Cloud-Raum beim Launcher, sobald du einen Raum öffnest.|ok'],
  ['kein Recht', cloudZeile(lage({ wahl: 'keiner', versucht: true, letzterGrund: 'kein-recht' }), J), 'Dein Konto darf den Cloud-Raum nicht nutzen. Frag einen Admin.|fehler'],
  ['gelöscht', cloudZeile(lage({ wahl: 'freigabe', geloescht: true }), J).text.endsWith(' Der alte Proxy-Key wurde gelöscht; Connect nutzt jetzt die Freigabe des Launchers.'), true],
  ['gelöscht, ok bleibt ok', cloudZeile(lage({ wahl: 'freigabe', geloescht: true }), J).ton, 'ok'],
  ['gelöscht, keiner: ohne CZ5', cloudZeile(lage({ wahl: 'keiner', geloescht: true }), J),
    'Connect holt die Freigabe für den Cloud-Raum beim Launcher, sobald du einen Raum öffnest.|ok'],
  ['keiner, kein Recht, gelöscht: ohne CZ5', cloudZeile(lage({ wahl: 'keiner', versucht: true, letzterGrund: 'kein-recht', geloescht: true }), J),
    'Dein Konto darf den Cloud-Raum nicht nutzen. Frag einen Admin.|fehler'],
  ['alter Key, gelöscht: ohne CZ5', cloudZeile(lage({ wahl: 'alter-key', geloescht: true }), J), `${PROXY_ZEILE}|warn`],
  ['Umgebung', cloudZeile(lage({ wahl: 'alter-key', altHerkunft: 'env' }), J).text.endsWith(' Entwicklungsmodus: JMPS_PROXY_KEY gesetzt.'), true],
  ['Freigabe, Umgebung und gelöscht, Reihenfolge CZ5 vor CZ6', cloudZeile(lage({ wahl: 'freigabe', altHerkunft: 'env', geloescht: true }), J),
    'Cloud-Zugang über den Launcher (Maria S. · Kollege), gültig bis 23.11.2026 09:00. Der alte Proxy-Key wurde gelöscht; Connect nutzt jetzt die Freigabe des Launchers. Entwicklungsmodus: JMPS_PROXY_KEY gesetzt.|ok'],
  ['alter Key, Umgebung und gelöscht: nur CZ6', cloudZeile(lage({ wahl: 'alter-key', altHerkunft: 'env', geloescht: true }), J),
    `${PROXY_ZEILE} Entwicklungsmodus: JMPS_PROXY_KEY gesetzt.|warn`],
  ['gespeicherter Key: kein Zusatz', cloudZeile(lage({ wahl: 'alter-key', altHerkunft: 'stored' }), J), `${PROXY_ZEILE}|warn`],
  ...GRUENDE.map((g): [string, unknown, unknown] => [`keiner, versucht, ${g[0]}`,
    cloudZeile(lage({ wahl: 'keiner', versucht: true, letzterGrund: g[0], detail: 'HTTP 500' }), J), `${g[1]}|${g[2]}`]),
]);
kreuz('T10 G7: Zeile Zoom-Anmeldung (Quelle × Grund × gelöscht × Entwicklung)', [
  ['Server', anmeldungZeile(alage({ quelle: 'server' }), J), 'Zoom-Anmeldung über den Launcher (Maria S. · Kollege), Freigabe gültig bis 23.11.2026 09:00.|ok'],
  ['lokal', anmeldungZeile(alage({ quelle: 'lokal' }), J), 'Zoom-Anmeldung über die alten Zugangsdaten dieses Rechners (Übergang).|warn'],
  ['lokal, Launcher zu alt', anmeldungZeile(alage({ quelle: 'lokal', grund: 'launcher-zu-alt' }), J),
    'Zoom-Anmeldung über die alten Zugangsdaten dieses Rechners (Übergang). Der Launcher ist zu alt für Connect. Launcher aktualisieren (ab 0.19.0).|warn'],
  ['keine, nie versucht', anmeldungZeile(alage({ quelle: 'keine' }), J), 'Zoom-Anmeldung über den Launcher; die Freigabe holt Connect beim ersten Beitritt.|ok'],
  ['keine, Server abgelehnt', anmeldungZeile(alage({ quelle: 'keine', versucht: true, grund: 'server-abgelehnt' }), J),
    'Zoom-Anmeldung: Der Server hat die Freigabe für Zoom abgelehnt. Ich hole beim nächsten Versuch eine neue beim Launcher.|fehler'],
  ['keine, nicht eingerichtet', anmeldungZeile(alage({ quelle: 'keine', versucht: true, grund: 'nicht-eingerichtet' }), J),
    'Zoom-Anmeldung: Die Zoom-Anmeldung ist auf dem Server nicht eingerichtet. Sag einem Admin Bescheid.|fehler'],
  ['keine, Server-Fehler', anmeldungZeile(alage({ quelle: 'keine', versucht: true, grund: 'server-fehler', detail: 'HTTP 502' }), J),
    'Zoom-Anmeldung: Der Server hat kein Zoom-Anmelde-Token geliefert (HTTP 502). Ich versuche es beim nächsten Beitritt erneut.|warn'],
  ['keine, kein Recht (Zweck zoom-jwt)', anmeldungZeile(alage({ quelle: 'keine', versucht: true, grund: 'kein-recht' }), J),
    'Zoom-Anmeldung: Dein Konto darf Zoom auf diesem Rechner nicht nutzen. Externe brauchen eine Zoom-Freigabe und einen JM-Rechner.|fehler'],
  ['keine, kein Launcher', anmeldungZeile(alage({ quelle: 'keine', versucht: true, grund: 'kein-launcher' }), J),
    'Zoom-Anmeldung: Kein Launcher mit Anmeldung gefunden. Starte den Launcher und melde dich dort an.|warn'],
  ['keine, abgelaufen', anmeldungZeile(alage({ quelle: 'keine', versucht: true, grund: 'abgelaufen' }), J),
    'Zoom-Anmeldung: Die Anmeldung im Launcher ist abgelaufen. Melde dich im Launcher neu an.|warn'],
  ['keine, niemand angemeldet', anmeldungZeile(alage({ quelle: 'keine', versucht: true, grund: 'niemand-angemeldet' }), J),
    'Zoom-Anmeldung: Im Launcher ist niemand angemeldet. Melde dich im Launcher an (oben rechts).|warn'],
  ['keine, Server nicht erreichbar', anmeldungZeile(alage({ quelle: 'keine', versucht: true, grund: 'server-nicht-erreichbar' }), J),
    'Zoom-Anmeldung: Der Server ist gerade nicht erreichbar. Ich versuche es weiter.|warn'],
  ['keine, entzogen', anmeldungZeile(alage({ quelle: 'keine', versucht: true, grund: 'entzogen' }), J),
    'Zoom-Anmeldung: Dein Zugang wurde beim letzten Start des Launchers nicht bestätigt. Frag einen Admin.|fehler'],
  ['keine, Launcher unecht', anmeldungZeile(alage({ quelle: 'keine', versucht: true, grund: 'launcher-unecht' }), J),
    'Zoom-Anmeldung: Der Launcher hat sich nicht ausgewiesen. Starte den Launcher neu.|fehler'],
  ['keine, Fehler mit Detail', anmeldungZeile(alage({ quelle: 'keine', versucht: true, grund: 'fehler', detail: 'x1' }), J), 'Zoom-Anmeldung: Freigabe fehlgeschlagen: x1|fehler'],
  ['gelöscht', anmeldungZeile(alage({ quelle: 'server', geloescht: true }), J).text.endsWith(' Die alten Zoom-Zugangsdaten wurden gelöscht; Connect meldet sich jetzt über den Launcher bei Zoom an.'), true],
  ['gelöscht, keine, nie versucht: ohne ZA5', anmeldungZeile(alage({ quelle: 'keine', geloescht: true }), J),
    'Zoom-Anmeldung über den Launcher; die Freigabe holt Connect beim ersten Beitritt.|ok'],
  ['gelöscht, lokal: ohne ZA5', anmeldungZeile(alage({ quelle: 'lokal', geloescht: true }), J), 'Zoom-Anmeldung über die alten Zugangsdaten dieses Rechners (Übergang).|warn'],
  ['gelöscht, keine, kein Recht: ohne ZA5', anmeldungZeile(alage({ quelle: 'keine', versucht: true, grund: 'kein-recht', geloescht: true }), J),
    'Zoom-Anmeldung: Dein Konto darf Zoom auf diesem Rechner nicht nutzen. Externe brauchen eine Zoom-Freigabe und einen JM-Rechner.|fehler'],
  ['Entwicklung', anmeldungZeile(alage({ quelle: 'server', devTtlS: 1860 }), J).text.endsWith(' Entwicklungsmodus: JMPS_ZOOM_JWT_TTL_S gesetzt, der Server stellt das Zoom-Anmelde-Token mit 1860 s Laufzeit aus.'), true],
  ['Entwicklung und gelöscht, Reihenfolge ZA5 vor ZA11', anmeldungZeile(alage({ quelle: 'server', devTtlS: 1860, geloescht: true }), J),
    'Zoom-Anmeldung über den Launcher (Maria S. · Kollege), Freigabe gültig bis 23.11.2026 09:00. Die alten Zoom-Zugangsdaten wurden gelöscht; Connect meldet sich jetzt über den Launcher bei Zoom an. Entwicklungsmodus: JMPS_ZOOM_JWT_TTL_S gesetzt, der Server stellt das Zoom-Anmelde-Token mit 1860 s Laufzeit aus.|ok'],
  ['Entwicklung, lokal (P6)', anmeldungZeile(alage({ quelle: 'lokal', devTtlS: 1860 }), J).text.includes('Entwicklungsmodus'), false],
  ['Entwicklung, keine (P6)', anmeldungZeile(alage({ quelle: 'keine', devTtlS: 1860 }), J).text.includes('Entwicklungsmodus'), false],
  ['Entwicklung, lokal: genau ZA2', anmeldungZeile(alage({ quelle: 'lokal', devTtlS: 1860 }), J), 'Zoom-Anmeldung über die alten Zugangsdaten dieses Rechners (Übergang).|warn'],
]);

/** Alle Nutzertexte des Moduls, soweit sie sich aufzählen lassen. */
function alleTexte(): string[] {
  const ts: string[] = [];
  const zwecke: ConnectZweck[] = ['connect-raum', 'zoom-jwt', 'zoom-sdk'];
  const gruende: FreigabeGrund[] = ['kein-launcher', 'launcher-zu-alt', 'launcher-unecht', 'niemand-angemeldet', 'abgelaufen', 'entzogen', 'kein-recht', 'server-nicht-erreichbar', 'unbekannter-zweck', 'fehler'];
  for (const z of zwecke) for (const g of gruende) for (const d of [undefined, 'kein-jm-rechner', 'HTTP 500']) ts.push(grundText(z, g, d));
  for (const g of ['server-abgelehnt', 'server-fehler', 'nicht-eingerichtet'] as JwtGrund[]) ts.push(jwtGrundText(g), jwtGrundText(g, 'HTTP 502'));
  const t = ZUGANG_TEXT;
  ts.push(t.cloudFreigabe('N', 'kollege', '20.11.2026', '09:00'), t.cloudAltKey, t.cloudAltAbgelehnt, t.cloudNochNicht, t.cloudGeloescht, t.cloudEnv,
    t.raumNicht('g'), t.raumVergeben, t.raumFreigabeAbgelehnt, t.altProxyKey, t.anmeldungServer('N', 'kollege', '20.11.2026', '09:00'), t.anmeldungLokal,
    t.anmeldungKeine('g'), t.anmeldungNochNicht, t.zugangGeloescht, t.sdkGeloescht, t.ohneAnmeldung('g'), t.serverAbgelehnt, t.nichtEingerichtet,
    t.serverFehler('HTTP 502'), t.entwicklungTtl(1860));
  for (const w of ['freigabe', 'alter-key', 'keiner'] as const) {
    for (const g of [null, ...gruende]) for (const geloescht of [false, true]) for (const alt of [false, true]) for (const env of ['none', 'env'] as const) {
      ts.push(cloudZeile(lage({ wahl: w, letzterGrund: g, geloescht, altAbgelehnt: alt, altHerkunft: env, bis: J + 3600_000 }), J).text);
    }
  }
  for (const q of ['server', 'lokal', 'keine'] as const) {
    for (const g of [null, ...gruende, 'server-abgelehnt', 'server-fehler', 'nicht-eingerichtet'] as Array<JwtGrund | null>) {
      ts.push(anmeldungZeile(alage({ quelle: q, grund: g, detail: 'HTTP 502', geloescht: true, devTtlS: 60 }), J).text);
    }
  }
  return ts;
}
ck('T10: Aufzählung der Texte ist nicht leer und enthält Umlaute (Prüfung greift)', alleTexte().length > 100 && alleTexte().some((t) => t.includes('ü')));
ck('T10: kein Text enthält ASCII-Anführungszeichen', alleTexte().every((t) => !t.includes('"')));
ck('T10: SDK-Hinweise nutzen „ “', grundText('zoom-sdk', 'kein-recht').includes('„SDK-Ordner wählen …“'));
ck('T10: Texte ZA6, CZ7 bis CZ10, ZA7 wörtlich',
  ZUGANG_TEXT.sdkGeloescht === 'Der alte SDK-Schlüssel wurde gelöscht; „Zoom-SDK laden“ läuft jetzt über den Launcher.'
    && ZUGANG_TEXT.raumNicht('Grund.') === 'Raum öffnen nicht möglich: Grund.'
    && ZUGANG_TEXT.raumVergeben === 'Dieser Cloud-Raum gehört gerade einem anderen Konto oder Rechner. Schließe ihn dort oder wähle im Show-Editor eine andere Raum-ID.'
    && ZUGANG_TEXT.raumFreigabeAbgelehnt === 'Der Server hat die Freigabe abgelehnt. Ich hole eine neue beim Launcher; bitte noch einmal „Raum öffnen“.'
    && ZUGANG_TEXT.altProxyKey === 'Alter Proxy-Key: hinterlegt, nur noch im Übergang.'
    && ZUGANG_TEXT.ohneAnmeldung('Grund.') === 'Ohne Zoom-Anmeldung kein Beitritt. Grund.');
ck('T10: Konstanten', r.APP_ID === 'jm-connect' && r.ZIEL_ZOOM_JWT === 'meeting-sdk' && r.ZIEL_ZOOM_SDK === 'win-x64' && r.ERNEUERN_VOR_MS === 86_400_000 && r.FREIGABE_ABSTAND_MS === 30_000);

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

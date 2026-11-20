// Anmeldung im Launcher (Teil 1) · P7: gemeinsame Typen und Rechte (src/shared/konto.ts) — ohne Electron, ohne Netz (tsx):
//   npm run selftest:konto -w @jm/launcher      (erstes Glied der Kette)
// Form „ck“: `  ok  ‹Name›` / `FAIL  ‹Name›`, Schluss `‹n› ok, ‹m› fehlgeschlagen.`, Exit 1 bei Fehlern.
// `darf` läuft gegen dieselbe Falltabelle wie der Worker (services/release-proxy/test/rechte-faelle.json, Block A Task 1),
// `kurzName` gegen die Funktion des Workers selbst (services/release-proxy/konto-kern.js).
// Die Helfer `kreuz` und `pruefeFaelle` nutzen auch die übrigen konto-*.test.ts; die Prüfungen dieser Datei laufen nur,
// wenn sie selbst gestartet wird (ein Import startet sie nicht).
import { readFileSync } from 'node:fs';
import { darf, kurzName, STUFE_TEXT, type Funktion, type KontoStand, type Stufe } from '../src/shared/konto';
import { kurzName as kurzNameWorker } from '../../../services/release-proxy/konto-kern.js';

/** Kreuzprodukt benannter Achsen: kreuz({ a: [1, 2], b: ['x'] }) → [{ a: 1, b: 'x' }, { a: 2, b: 'x' }]. */
export function kreuz<T extends Record<string, readonly unknown[]>>(achsen: T): Array<{ [K in keyof T]: T[K][number] }> {
  let faelle: Array<Record<string, unknown>> = [{}];
  for (const [name, werte] of Object.entries(achsen)) {
    faelle = faelle.flatMap((f) => werte.map((w) => ({ ...f, [name]: w })));
  }
  return faelle as Array<{ [K in keyof T]: T[K][number] }>;
}

/**
 * Eine Falltabelle prüfen: `pruefe` liefert null (stimmt) oder einen Text „Fall: ist …, soll …“. Ergebnis ist der Name für
 * eine einzige Testzeile „‹name› (‹n› Fälle)“, bei Abweichung mit den ersten fünf Fällen (G12), und ob alles stimmt.
 */
export function pruefeFaelle<F>(name: string, faelle: readonly F[], pruefe: (f: F) => string | null): { name: string; ok: boolean } {
  const fehler: string[] = [];
  for (const f of faelle) {
    const t = pruefe(f);
    if (t !== null) fehler.push(t);
  }
  const zeile = `${name} (${faelle.length} Fälle)`;
  return fehler.length === 0 ? { name: zeile, ok: true } : { name: `${zeile} — ${fehler.slice(0, 5).join('; ')}`, ok: false };
}

const ALS_HAUPTDATEI = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('test/konto-rechte.test.ts');

if (ALS_HAUPTDATEI) {
  let pass = 0, fail = 0;
  const ck = (name: string, cond: boolean): void => {
    if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
  };

  // --- P7 9.1: darf an der gemeinsamen Falltabelle ----------------------------------------------------------------
  interface Fall {
    name: string;
    stand: null | { stufe: Stufe; tools: string[]; events: string[]; zoom: boolean; jm: boolean; plattform: 'win' | 'mac'; exp: 'gueltig' | 'abgelaufen' };
    funktion: Funktion;
    event?: string | null;
    erwartet: boolean;
  }
  const JETZT = Date.UTC(2026, 9, 21, 10, 0, 0);
  const FAELLE = JSON.parse(readFileSync(new URL('../../../services/release-proxy/test/rechte-faelle.json', import.meta.url), 'utf8')) as Fall[];
  /** Stand aus einem Fall wie im Worker-Test: `gueltig` = jetzt + 1 h, `abgelaufen` = genau jetzt (Grenze). */
  const standAus = (s: NonNullable<Fall['stand']>): KontoStand => ({
    kid: 'k-test', email: 'test@example.org', name: 'Test Person', art: 'passwort', stufe: s.stufe,
    tools: s.tools as KontoStand['tools'], events: s.events, zoom: s.zoom, zoomBis: null, jm: s.jm, plattform: s.plattform,
    gid: 'g-test', iat: JETZT - 3600_000, exp: s.exp === 'gueltig' ? JETZT + 3600_000 : JETZT, kontoBis: null,
    angemeldetSeit: JETZT - 3600_000,
  });
  const r1 = pruefeFaelle('P7 9.1: darf wie der Worker, gemeinsame Tabelle rechte-faelle.json', FAELLE, (f) => {
    const ist = darf(f.stand ? standAus(f.stand) : null, f.funktion, { event: f.event ?? undefined, jetzt: JETZT });
    return ist === f.erwartet ? null : `${f.name}: ist ${ist}, soll ${f.erwartet}`;
  });
  ck(r1.name, r1.ok);

  const FUNKTIONEN: Funktion[] = ['launcher-update', 'katalog', 'kochbuch', 'feedback', 'ki-entwurf', 'connect-raum', 'zoom', 'qa', 'iveo', 'admin'];
  const STUFEN: Stufe[] = ['admin', 'kollege', 'externer'];
  const luecken = [
    ...FUNKTIONEN.filter((f) => !FAELLE.some((c) => c.funktion === f && c.stand === null)).map((f) => `${f} ohne Stand`),
    ...kreuz({ f: FUNKTIONEN, s: STUFEN, e: ['gueltig', 'abgelaufen'] as const })
      .filter(({ f, s, e }) => !FAELLE.some((c) => c.funktion === f && c.stand?.stufe === s && c.stand.exp === e))
      .map(({ f, s, e }) => `${f}/${s}/${e}`),
  ];
  ck(`P7 9.1: Falltabelle deckt jede Funktion ohne Stand und je Stufe gültig/abgelaufen ab (${FAELLE.length} Fälle)${luecken.length ? ` — fehlt: ${luecken.slice(0, 5).join(', ')}` : ''}`,
    FAELLE.length > 0 && luecken.length === 0);

  // --- P7 kurzName wie konto-kern.js --------------------------------------------------------------------------------
  const NAMEN = ['Maria Schmidt', 'maria schmidt', '  Anna  Maria   Weber ', 'Ömer Çelik', 'Jan', '', '   ', 'łukasz żółw',
    'Jean-Luc de la Croix', 'X Æ', 'Ana\tLima'];
  const MAILS = ['maria.schmidt@jakobsmedien.com', 'ext@firma.de', 'ohne-at', '', '@nur-domain.de'];
  const r2 = pruefeFaelle('P7 4.2: kurzName wie konto-kern.js, Name × E-Mail', kreuz({ n: NAMEN, m: MAILS }), ({ n, m }) => {
    const ist = kurzName(n, m);
    const soll = kurzNameWorker(n, m) as string;
    return ist === soll ? null : `${JSON.stringify(n)}/${JSON.stringify(m)}: ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`;
  });
  ck(r2.name, r2.ok);
  ck('P7 4.2: kurzName „Maria Schmidt“ → „Maria S.“, ein Wort bleibt, ohne Namen der Teil vor dem @',
    kurzName('Maria Schmidt', 'm@x.de') === 'Maria S.' && kurzName('Jan', 'j@x.de') === 'Jan'
    && kurzName('', 'maria.schmidt@jakobsmedien.com') === 'maria.schmidt');

  // --- P7 K5: Stufen-Namen wörtlich ---------------------------------------------------------------------------------
  ck('P7 K5: STUFE_TEXT wörtlich (Admin / Kollege / Externer)',
    JSON.stringify(STUFE_TEXT) === JSON.stringify({ admin: 'Admin', kollege: 'Kollege', externer: 'Externer' }));

  // --- P7 G9: shared/konto.ts lädt nichts zur Laufzeit -------------------------------------------------------------
  const quelle = readFileSync(new URL('../src/shared/konto.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const importZeilen = quelle.split('\n').filter((z) => /^\s*import\b/.test(z) || /\brequire\(/.test(z) || /\bimport\(/.test(z));
  ck(`P7 G9: src/shared/konto.ts ohne Laufzeit-Import (${importZeilen.length} Import-Zeilen, kein electron, kein node:)`,
    importZeilen.every((z) => /^\s*import type\b/.test(z)) && !quelle.includes("'electron'") && !quelle.includes("'node:"));

  console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
  process.exit(fail === 0 ? 0 : 1);
}

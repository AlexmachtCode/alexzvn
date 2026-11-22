// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (UX Welle 2a, Prompter e; Spec 10 „Kein Funktionsverlust“). Jede der 123 Zeilen in den
// Abschnitten 1–7 von docs/ux/funktionslisten/prompter.md ist in „künftig wo“ abgehakt: „✓ “ und ein Ort des Ortsregisters,
// „unverändert (…)“, „entfällt (…, E…)“ oder „ersetzt durch {Ort} (…, E…)“. E-Verweise nur auf E1–E15 dieses Plans. Jede
// genannte Datei existiert, Groß- und Kleinschreibung wie im Repo. Dazu Querprüfungen gegen den Code (Kürzel und Filter,
// Panel-Tasten nach O1, die Abläufe in den immer gemounteten Teilen statt im Panel, Tooltips R-T6a, Hook in der Wurzel R-T6b).
// Läuft im Paketordner apps/prompter (npm run selftest -w @jm/prompter).
// „unverändert (…)“ darf keine Datei nennen, die seit der Erhebung (d7cdd79ce0) geändert wurde, außer sie bekam nur die lesenden
// Brücken bzw. den Ausgabezustand (E2, E3): dann steht der Hinweis im Haken. Der Abgleich der statischen Liste GEAENDERT mit
// git läuft nur mit JM_FUNKTIONSLISTE_GIT=1.
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';

const LISTE = '../../docs/ux/funktionslisten/prompter.md';

/** Ortsregister: Rahmen, Kopf, Skript, Live-Bereich, Statusleiste, Panel je Abschnitt, Ausgabefenster und Handy-Seite. */
const ABSCHNITTE = ['Ausgabe', 'Fernsteuerung', 'Schrift', 'Lese-Linie', 'Darstellung', 'Handy-Fernbedienung'];
const ORTE: readonly string[] = [
  'Rahmen',
  'Kopf',
  'Skript',
  'Live-Bereich',
  'Live-Bereich Vorschau',
  'Live-Bereich Transport',
  'Live-Bereich Tempo',
  'Statusleiste',
  'Panel',
  ...ABSCHNITTE.map((a) => `Panel ${a}`),
  'Ausgabefenster',
  'Handy-Seite',
];

/** Zeilen insgesamt und je Abschnitt 1–7, wie Task 2 die Liste angelegt hat. */
const GESAMT = 123;
const JE_ABSCHNITT = [32, 7, 39, 8, 6, 13, 18];

const ERHEBUNG = 'd7cdd79ce0';

/**
 * Alle Dateien von apps/prompter, die seit der Erhebung geändert, angelegt oder gelöscht wurden, als Pfad ab der Repo-Wurzel. Ein
 * „unverändert (…)“ darf sie nur nennen, wenn der Haken E2 oder E3 nennt und die Datei nur die lesenden Brücken bekam (NUR_MELDUNG).
 * Mit JM_FUNKTIONSLISTE_GIT=1 prüft der Test unten, dass git dieselbe Menge kennt.
 */
const GEAENDERT = [
  'package.json',
  'src/main/control-server.ts',
  'src/main/index.ts',
  'src/preload/index.ts',
  'src/renderer/src/App.tsx',
  'src/renderer/src/components/Regler.tsx',
  'src/renderer/src/globals.css',
  'src/renderer/src/lib/aktionen.ts',
  'src/renderer/src/lib/bruecken.ts',
  'src/renderer/src/lib/oberflaeche.ts',
  'src/renderer/src/lib/useHotkeys.ts',
  'src/renderer/src/views/Einstellungen.tsx',
  'src/renderer/src/views/LiveBereich.tsx',
  'src/renderer/src/views/OperatorView.tsx',
  'src/renderer/src/views/PrompterOberflaeche.tsx',
  'src/shared/fernsteuerung.ts',
  'src/shared/types.ts',
  'test/ui/bruecken.test.ts',
  'test/ui/funktionsliste.test.ts',
  'test/ui/hilfe.ts',
  'test/ui/live.test.tsx',
  'test/ui/oberflaeche.test.ts',
  'test/ui/panel.test.tsx',
  'test/ui/rahmen.test.tsx',
  'test/ui/selftest.ts',
  'test/ui/testzustand.ts',
  'test/ui/werkzeug.test.tsx',
  'tsconfig.test.json',
].map((p) => `apps/prompter/${p}`);

/** Geänderte Dateien außerhalb von apps/prompter, die ein unverändert-Haken zitieren könnte (Task 1, W2-2: Ausgabezustand). */
const PAKETE_GEAENDERT = [
  'packages/output-window/package.json',
  'packages/output-window/src/index.ts',
  'packages/output-window/src/zustand.ts',
  'packages/output-window/test/selftest.ts',
  'packages/output-window/test/zustand.test.ts',
];

/**
 * Dateien, die nur die lesenden Brücken bekamen: main/index.ts und main/control-server.ts die Fernsteuerungs-Meldung (E2) und den
 * Ausgabezustand (E3), preload/index.ts beide Brücken, shared/types.ts die Typen dazu, das Fenster-Paket den Ausgabezustand (E3).
 */
const NUR_MELDUNG = new Set(
  [
    'apps/prompter/src/main/index.ts',
    'apps/prompter/src/main/control-server.ts',
    'apps/prompter/src/preload/index.ts',
    'apps/prompter/src/shared/types.ts',
    'packages/output-window/src/index.ts',
  ],
);

const GEAENDERT_KANON = new Set([...GEAENDERT, ...PAKETE_GEAENDERT]);

/** Alle seit der Erhebung geänderten Dateien des Repos laut git; null, wenn der Klon keinen Verlauf hat. */
function gitGeaendert(): Set<string> | null {
  try {
    const aus = execFileSync('git', ['diff', '--name-only', `${ERHEBUNG}..HEAD`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return new Set(aus.split(/\r?\n/).filter((n) => n !== ''));
  } catch {
    return null;
  }
}
// Nur auf Anforderung: ohne JM_FUNKTIONSLISTE_GIT=1 sagt der Test nichts über git; die statische Liste ist der Wächter.
const GIT_PRUEFEN = process.env.JM_FUNKTIONSLISTE_GIT === '1';
const GIT = GIT_PRUEFEN ? gitGeaendert() : null;
if (GIT_PRUEFEN && GIT === null) console.log(`PR Funktionsliste: kein git-Verlauf bis ${ERHEBUNG} (flacher Klon); die Prüfung gegen git entfällt`);

/** Datei in Backticks: Pfad mit Endung, aufgelöst nach der Pfadregel im Kopf der Liste. */
const PFAD = /`([A-Za-z0-9_./-]+\.(?:tsx|ts|css|html|json|md|mjs))`/g;
/** Nur die Entscheidungen E1–E15 dieses Plans sind erlaubte Verweise. */
const VERWEIS = /\bE(?:[1-9]|1[0-5])\b/;
const FREMD = /\b(?:E(?:0|1[6-9]|[2-9]\d)|E\d{3,}|OF\d+)\b/;

interface Zeile {
  abschnitt: number;
  nr: number;
  zellen: string[];
}

function zeilen(text: string): Zeile[] {
  const liste: Zeile[] = [];
  let abschnitt = 0;
  for (const z of text.split('\n')) {
    const kopf = /^## (\d+) · /.exec(z);
    if (kopf) {
      abschnitt = Number(kopf[1]);
      continue;
    }
    if (/^## /.test(z)) abschnitt = 0;
    const nr = /^\|\s*(\d+)\s*\|/.exec(z);
    if (nr && abschnitt >= 1 && abschnitt <= 7) {
      liste.push({ abschnitt, nr: Number(nr[1]), zellen: z.split('|').slice(1, -1).map((s) => s.trim()) });
    }
  }
  return liste;
}

/** Pfadregel der Liste: Repo-Wurzel, apps/prompter/src (main, preload, shared, renderer) oder der Renderer. */
function aufgeloest(pfad: string): string {
  if (/^(?:apps|packages|docs)\//.test(pfad)) return `../../${pfad}`;
  if (/^(?:main|preload|shared|renderer)\//.test(pfad)) return `src/${pfad}`;
  return `src/renderer/src/${pfad}`;
}

/** Kanonischer Pfad ab der Repo-Wurzel nach der Pfadregel der Liste. */
function kanon(pfad: string): string {
  const a = aufgeloest(pfad);
  return a.startsWith('../../') ? a.slice('../../'.length) : `apps/prompter/${a}`;
}

/** Gibt es die Datei mit genau dieser Schreibweise? Jeder Pfadteil wird mit dem Verzeichnisinhalt verglichen. */
function gibtEs(pfad: string): boolean {
  let ort = '';
  for (const teil of aufgeloest(pfad).split('/')) {
    if (teil !== '..') {
      try {
        if (!readdirSync(ort === '' ? '.' : ort).includes(teil)) return false;
      } catch {
        return false;
      }
    }
    ort = ort === '' ? teil : `${ort}/${teil}`;
  }
  return existsSync(ort);
}

/** Ort am Anfang des Texts: der längste passende Eintrag des Ortsregisters, danach Leerzeichen, Doppelpunkt, Komma oder Ende. */
function ortAm(text: string): string | undefined {
  return [...ORTE]
    .sort((a, b) => b.length - a.length)
    .find((o) => text.startsWith(o) && /^(?:[ :,]|$)/.test(text.slice(o.length)));
}

/** null = Zeile abgehakt; sonst der erste Grund, warum nicht. */
function zeilenFehler(z: Zeile): string | null {
  if (z.zellen.length !== 7) return `${z.zellen.length} statt 7 Spalten`;
  const k = z.zellen[6];
  if (!k.startsWith('✓ ')) return '„künftig wo“ ohne Haken';
  const rest = k.slice(2);
  const ohneCode = k.replace(/`[^`]*`/g, '');
  if (ohneCode.includes('"')) return 'ASCII-Anführungszeichen';
  if (FREMD.test(ohneCode)) return 'Verweis außerhalb von E1–E15';
  let form: string | undefined;
  if (rest.startsWith('unverändert (')) form = 'unverändert';
  else if (rest.startsWith('entfällt (')) form = 'entfällt';
  else if (rest.startsWith('ersetzt durch ')) form = ortAm(rest.slice('ersetzt durch '.length)) && 'ersetzt durch';
  else form = ortAm(rest);
  if (form === undefined) return `Ort nicht aus dem Ortsregister: ${rest.slice(0, 40)}`;
  if (form === 'ersetzt durch' && !VERWEIS.test(ohneCode)) return '„ersetzt durch“ ohne E-Verweis';
  if (form === 'entfällt' && !VERWEIS.test(ohneCode)) return '„entfällt“ ohne E-Verweis';
  const pfade = [...k.matchAll(PFAD)].map((m) => m[1]);
  if (form !== 'entfällt' && pfade.length === 0) return 'Ort ohne Datei';
  const fehlt = pfade.filter((p) => !gibtEs(p));
  if (fehlt.length > 0) return `Datei fehlt: ${fehlt.join(', ')}`;
  // „unverändert“ nennt nur Dateien, die seit der Erhebung unverändert sind; Dateien mit nur den lesenden Brücken (E2, E3) mit Hinweis.
  if (form === 'unverändert') {
    const veraendert = pfade.filter((p) => GEAENDERT_KANON.has(kanon(p)) || GIT?.has(kanon(p)) === true);
    if (veraendert.length > 0 && !/\bE[23]\b/.test(ohneCode)) return `unverändert mit geänderter Datei (${veraendert.join(', ')}) ohne Hinweis auf E2 oder E3`;
    if (veraendert.some((p) => !NUR_MELDUNG.has(kanon(p)))) return `unverändert mit einer Datei, die mehr als die lesenden Brücken bekam (${veraendert.join(', ')})`;
  }
  return null;
}

const text = leseText(LISTE);
const alle = zeilen(text);

gleich(alle.length, GESAMT, 'PR Funktionsliste: 123 Zeilen in den Abschnitten 1–7 (Stand Task 2)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'PR Funktionsliste: Zeilen je Abschnitt wie in Task 2 (32/7/39/8/6/13/18)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'PR Funktionsliste: Nummern fortlaufend ab 1',
);
ok(!text.replace(/`[^`]*`/g, '').includes('"') && !text.includes('\r'), 'PR Funktionsliste: keine ASCII-Anführungszeichen außerhalb von Code, kein CR');

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `PR Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

// ── Die Menge der geänderten Dateien stimmt mit git überein (nur mit JM_FUNKTIONSLISTE_GIT=1 und Verlauf) ──
{
  if (GIT !== null) {
    const fehlend = [...GIT].filter((n) => n.startsWith('apps/prompter/') && !GEAENDERT_KANON.has(n));
    ok(fehlend.length === 0, `PR Funktionsliste: GEAENDERT nennt alle seit ${ERHEBUNG} geänderten Dateien von apps/prompter (fehlt: ${fehlend.join(', ') || 'nichts'})`);
    const zuviel = GEAENDERT.filter((n) => !GIT.has(n));
    ok(zuviel.length === 0, `PR Funktionsliste: GEAENDERT nennt keine Datei, die git nicht als geändert kennt (zu viel: ${zuviel.join(', ') || 'nichts'})`);
    const pakete = [...GIT].filter((n) => !n.startsWith('apps/prompter/') && !n.startsWith('docs/') && !n.startsWith('.superpowers/'));
    const paketFehlt = pakete.filter((n) => !PAKETE_GEAENDERT.includes(n) && /^packages\/output-window\//.test(n));
    ok(paketFehlt.length === 0, `PR Funktionsliste: PAKETE_GEAENDERT nennt alle geänderten Dateien von packages/output-window (fehlt: ${paketFehlt.join(', ') || 'nichts'})`);
    const zitiert = alle.filter((z) => z.zellen[6].startsWith('✓ unverändert (')).flatMap((z) => [...z.zellen[6].matchAll(PFAD)].map((m) => kanon(m[1])));
    const getroffen = zitiert.filter((n) => !n.startsWith('apps/prompter/') && pakete.includes(n));
    ok(getroffen.every((n) => NUR_MELDUNG.has(n)), `PR Funktionsliste: keine in einem unverändert-Haken zitierte Datei außerhalb von apps/prompter bekam mehr als den Ausgabezustand (${getroffen.join(', ') || 'keine'})`);
  }
  // Negativprobe: andere Schreibweisen derselben geänderten Datei werden erkannt, eine unveränderte nicht.
  const synth = (pfad: string, zusatz = ''): Zeile => ({ abschnitt: 3, nr: 0, zellen: ['0', '', '', '', '', '', `✓ unverändert (\`${pfad}\`): x${zusatz}`] });
  ok(
    ['views/LiveBereich.tsx', 'renderer/src/views/LiveBereich.tsx', 'apps/prompter/src/renderer/src/views/LiveBereich.tsx'].every((p) => (zeilenFehler(synth(p)) ?? '').includes('geänderter Datei')) &&
      (zeilenFehler(synth('views/LiveBereich.tsx', ' (E2)')) ?? '').includes('mehr als die lesenden Brücken') &&
      (zeilenFehler(synth('lib/useHotkeys.ts', ' (E3)')) ?? '').includes('mehr als die lesenden Brücken') &&
      zeilenFehler(synth('main/index.ts', ' (E2)')) === null &&
      zeilenFehler(synth('main/index.ts', ' (E3)')) === null &&
      zeilenFehler(synth('main/docx.ts')) === null,
    'PR Funktionsliste: eine geänderte Datei wird in jeder Schreibweise erkannt; E2 und E3 entlasten nur Dateien mit den lesenden Brücken; eine unveränderte Datei ist frei',
  );
}

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const quelle = (pfad: string): string => (gibtEs(pfad) ? readFileSync(aufgeloest(pfad), 'utf8') : '');
const beginnt = (nr: number, ...orte: string[]): boolean => orte.some((o) => kuenftig(nr).startsWith(`✓ ${o}`));

// ── Pflichtzeilen Tastatur (Nr. 93–98): der Hook in der Wurzel-View, die Kürzel wie bisher, E1 keine neuen ──
{
  const hook = quelle('lib/useHotkeys.ts');
  ok(
    [93, 94, 95, 96, 97, 98].every((nr) => beginnt(nr, 'Live-Bereich Transport') && kuenftig(nr).includes('`lib/useHotkeys.ts`') && /\bE1\b/.test(kuenftig(nr))),
    'PR Funktionsliste Nr. 93–98 (Pflichtzeilen Tastatur): Live-Bereich Transport, Hook lib/useHotkeys.ts, keine neuen Kürzel (E1)',
  );
  ok(
    hook.includes("case ' ':") && hook.includes("case 'ArrowDown':") && hook.includes("case 'ArrowUp':") && hook.includes("case 'Home':") &&
      hook.includes('e.shiftKey ? 3 : 1') && hook.includes('e.shiftKey ? -3 : -1') && hook.includes('transport.toggle()') && hook.includes('transport.reset()'),
    'PR Funktionsliste Nr. 93–98: Leertaste, Pfeil runter/hoch (Umschalt 3 em, sonst 1 em) und Pos1 wirken wie bisher',
  );
  ok(
    quelle('views/PrompterOberflaeche.tsx').includes('usePrompterHotkeys()') && quelle('views/PrompterOutputView.tsx').includes('usePrompterHotkeys()') && /R-T6b/.test(kuenftig(93)),
    'PR Funktionsliste Nr. 93: der Hook läuft in der Wurzel-View (auch bei „Lädt…“ und offenem Panel) und weiter im Ausgabefenster (R-T6b)',
  );
  ok(
    ['INPUT', 'TEXTAREA', 'SELECT', 'isContentEditable'].every((w) => quelle('lib/oberflaeche.ts').includes(w)) && hook.includes('istEingabeZiel(e.target)') && beginnt(99, 'Panel') && kuenftig(99).includes('SELECT'),
    'PR Funktionsliste Nr. 99: der Filter istEingabeZiel lässt INPUT, TEXTAREA, SELECT und contentEditable aus (die Neuerung SELECT steht im Haken)',
  );
  ok(beginnt(90, 'Ausgabefenster') && kuenftig(90).includes('`views/PrompterOutputView.tsx`'), 'PR Funktionsliste Nr. 90: die Kürzel gelten im Ausgabefenster über denselben Hook');
}

// ── Pflichtpunkt Panel-Tasten (Nr. 103, O1): Feld behält Tasten, Leertaste auf Knopf/Schalter geht ans Tool, Escape schließt ──
ok(
  zeile(103)?.zellen[1] === 'Panel-Tasten' &&
    beginnt(103, 'Panel ') &&
    ['Leertaste', 'Escape', 'Feld', 'Schalter', 'O1'].every((w) => kuenftig(103).includes(w)),
  'PR Funktionsliste Nr. 103 (Pflichtpunkt Panel-Tasten): Leertaste und Escape, je für Feld und Knopf/Schalter (Spec 10, O1)',
);
{
  const panel = quelle('packages/ui/src/components/SettingsPanel.tsx');
  ok(panel.includes('Escape') && panel.includes('defaultPrevented'), 'PR Funktionsliste Nr. 103: SettingsPanel schließt mit Escape, nur wenn nicht defaultPrevented');
  const wurzel = quelle('views/PrompterOberflaeche.tsx');
  ok(
    wurzel.includes('<LiveBereich') && wurzel.includes('settings={<Einstellungen') && !quelle('views/Einstellungen.tsx').includes('<LiveBereich'),
    'PR Funktionsliste Nr. 103/105: das Panel ist kein eigener Bildschirm, der Live-Bereich mit dem Hook bleibt bei offenem Panel gemountet',
  );
}
ok(beginnt(102, 'Panel') && beginnt(100, 'Panel'), 'PR Funktionsliste Nr. 100/102: Wirkung auf Knöpfe und Auswahl und die fehlenden Kürzel stehen beim Panel');

// ── Rückgeholtes (Pattern e: wiederherstellen statt streichen): Tooltips R-T6a, Hook R-T6b ──
{
  const lb = quelle('views/LiveBereich.tsx');
  ok(
    [11, 13].every((nr) => beginnt(nr, 'Live-Bereich Transport') && /R-T6a/.test(kuenftig(nr)) && kuenftig(nr).includes('Abschnitt')) &&
      lb.includes('title={tipp}') &&
      quelle('lib/oberflaeche.ts').includes("markeZurueck: 'Voriger Abschnitt'") &&
      quelle('lib/oberflaeche.ts').includes("markeVor: 'Nächster Abschnitt'"),
    'PR Funktionsliste Nr. 11/13: die Tooltips „Voriger Abschnitt“ und „Nächster Abschnitt“ der Marken-Tasten sind wieder da (R-T6a)',
  );
  ok(beginnt(3, 'Rahmen') && /R-T6b/.test(kuenftig(3)), 'PR Funktionsliste Nr. 3: die Kürzel gelten schon während „Lädt…“ (R-T6b)');
}

// ── Wortlaut der übernommenen Bedienelemente: Beschriftungen stehen weiter dort, wo der Haken sie hinlegt ──
{
  const wurzel = quelle('views/PrompterOberflaeche.tsx');
  const panel = quelle('views/Einstellungen.tsx');
  const live = quelle('views/LiveBereich.tsx');
  ok(
    ['Skript', 'Zeilen mit', 'Datei laden', '.docx, .txt oder .md laden (ersetzt das Skript)', 'Skript hier eintippen oder einfügen…', 'Datei konnte nicht geladen werden:', 'Lädt…', 'spellCheck={false}'].every((w) => wurzel.includes(w)) &&
      [6, 7, 8, 33].every((nr) => beginnt(nr, 'Skript')) && beginnt(3, 'Rahmen'),
    'PR Funktionsliste Nr. 3/6/7/8/33: Skript-Spalte, Datei laden, Tooltip, Platzhalter, Alert und „Lädt…“ in views/PrompterOberflaeche.tsx',
  );
  ok(
    ['Vorschau', '↑ zurück', '↓ vor', 'aktionen.nudge(-3)', 'aktionen.nudge(3)', 'aktionen.tempo(', 'PrompterScroller', 'onMarkers'].every((w) => live.includes(w)) &&
      [9, 10].every((nr) => beginnt(nr, 'Live-Bereich Vorschau')) &&
      [11, 12, 13, 14, 15, 16].every((nr) => beginnt(nr, 'Live-Bereich Transport')) &&
      beginnt(17, 'Live-Bereich Tempo') &&
      quelle('lib/oberflaeche.ts').includes("tempo: { titel: 'Tempo', einheit: ' Z/s' }"),
    'PR Funktionsliste Nr. 9–17: Vorschau, Marken, GO/Pause, Anfang, ±3 und Tempo stehen im Live-Bereich',
  );
  ok(
    ['Schriftgröße', 'Zeilenabstand', 'Seitenrand', 'Lese-Linie anzeigen', 'Position', 'Spiegeln ⇄', 'Spiegeln ⇅', 'Fett', 'Fernbedienung aktiv', 'Am Handy im selben WLAN scannen oder URL öffnen:', 'RemoteQr', 'handyUmschalten'].every((w) => panel.includes(w)) &&
      [18, 19, 20].every((nr) => beginnt(nr, 'Panel Schrift')) &&
      [21, 22].every((nr) => beginnt(nr, 'Panel Lese-Linie')) &&
      [23, 24, 25].every((nr) => beginnt(nr, 'Panel Darstellung')) &&
      [29, 30, 31, 32].every((nr) => beginnt(nr, 'Panel Handy-Fernbedienung')),
    'PR Funktionsliste Nr. 18–25 und 29–32: Schrift, Lese-Linie, Darstellung und Handy-Fernbedienung im Panel mit dem alten Wortlaut',
  );
  ok(
    [26, 27, 28].every((nr) => beginnt(nr, 'Panel Ausgabe')) &&
      panel.includes('ScreenOutputSection') &&
      panel.includes('kannVerschieben(stand.ausgabe)') &&
      panel.includes('aktionen.ausgabeVerschieben') &&
      quelle('lib/oberflaeche.ts').includes("verschieben: 'Auf diesen Bildschirm'") &&
      quelle('lib/oberflaeche.ts').includes("primaer: ' · primär'") &&
      /\bkannVerschieben\b/.test(kuenftig(27)) &&
      kuenftig(26).includes('verschiebt kein Fenster'),
    'PR Funktionsliste Nr. 26–28: Bildschirmwahl (merkt nur), Schalter öffnen/schließen und der Knopf „Auf diesen Bildschirm“ im Panel Ausgabe',
  );
  ok(
    [37, 38, 46].every((nr) => beginnt(nr, 'Statusleiste')) &&
      /E11/.test(kuenftig(37)) &&
      /E2/.test(kuenftig(38)) &&
      quelle('lib/oberflaeche.ts').includes("id: 'handy'") &&
      quelle('lib/oberflaeche.ts').includes("abschnittStatusItem(remoteControlView(fernsteuerungAbschnitt(s))") &&
      [37, 38, 39].every((nr) => zeile(nr)?.zellen[1] === 'Meldung'),
    'PR Funktionsliste Nr. 37/38/46: stille Startfehler und der Steuerserver sind jetzt als Einträge der Statusleiste sichtbar (E2, E11)',
  );
}

// ── Abläufe aus Abschnitt 3: bleiben im Main und in den immer gemounteten Teilen, nicht im Panel (E15) ──
{
  const main = quelle('main/index.ts');
  const wurzel = quelle('views/PrompterOberflaeche.tsx');
  const panel = quelle('views/Einstellungen.tsx');
  ok(
    ['scroll', 'speed', 'faster', 'slower', 'top'].every((a) => main.includes(`case '${a}'`)) && [40, 41, 42, 43, 44].every((nr) => kuenftig(nr).startsWith('✓ unverändert (`main/index.ts`')),
    'PR Funktionsliste Nr. 40–44: die Companion-Befehle SCROLL, SPEED, FASTER, SLOWER, TOP laufen unverändert im Main',
  );
  ok(
    ['toggle', 'play', 'pause', 'nudge', 'reset'].every((a) => main.includes(`case '${a}'`)) && [47, 48, 49, 50, 51].every((nr) => kuenftig(nr).startsWith('✓ unverändert (`main/index.ts`')),
    'PR Funktionsliste Nr. 47–51: die Handy-Befehle toggle, play, pause, nudge, reset laufen unverändert im Main',
  );
  ok(
    quelle('main/control-server.ts').includes('CONTROL_PORT = 8727') && quelle('shared/fernsteuerung.ts').includes('STEUER_PORT = 8727') && beginnt(46, 'Statusleiste') && kuenftig(46).includes('8727'),
    'PR Funktionsliste Nr. 46: der Steuerserver (Port 8727) bleibt, seine Lage steht in der Statusleiste',
  );
  ok(
    quelle('App.tsx').includes('load()') && quelle('store/prompter.ts').includes('onState') && beginnt(68, 'Rahmen') && kuenftig(68).includes('`App.tsx`') && kuenftig(68).includes('`store/prompter.ts`'),
    'PR Funktionsliste Nr. 68: das Laden und Abonnieren des Zustands läuft in App und Store, oberhalb des Panels',
  );
  ok(
    wurzel.includes('useBrueckenWert(MASTER_LINK_QUELLE)') && wurzel.includes('useBrueckenWert(FERNSTEUERUNG_QUELLE)') && wurzel.includes('useBrueckenWert(AUSGABE_QUELLE)') && wurzel.includes('output.displays()'),
    'PR Funktionsliste Nr. 46/68: Brücken und Bildschirmliste laufen in der Wurzel-View, auch bei geschlossenem Panel',
  );
  ok(
    ['window.', 'useEffect', 'setInterval', 'addEventListener', 'usePrompter('].every((w) => !panel.replace(/\/\/.*$/gm, '').includes(w)),
    'PR Funktionsliste: Einstellungen.tsx hat keinen Zugriff auf window, keine Effekte und keinen Store (E15)',
  );
  ok(
    kuenftig(78).includes('PrompterOutputView') && /\bE6\b/.test(kuenftig(78)) && quelle('renderer/src/main.tsx').includes("'#output'") && quelle('renderer/src/main.tsx').includes('<PrompterOutputView />'),
    'PR Funktionsliste Nr. 78: #output lädt weiter die PrompterOutputView (E6)',
  );
  ok(
    [34, 35, 36, 39, 55, 56, 57, 69, 71, 72, 75, 76, 77].every((nr) => kuenftig(nr).startsWith('✓ unverändert (')),
    'PR Funktionsliste: Dateidialog, Dateileser, Fernbedienungs-Autostart, mDNS, Token, Konfiguration, Show, Einzelinstanz und Programmende sind unverändert',
  );
}

// ── Abgrenzung Handy-Seite und Ausgabefenster: unverändert, Handy-Seite ohne jede Änderung ──
{
  ok(
    [79, 80, 81, 82, 83, 84, 85, 86].every((nr) => kuenftig(nr).startsWith('✓ unverändert (`main/remote-page.ts`') && kuenftig(nr).includes('Handy-Seite')) && !GEAENDERT_KANON.has('apps/prompter/src/main/remote-page.ts'),
    'PR Funktionsliste Nr. 79–86: die Handy-Seite (main/remote-page.ts) ist unverändert',
  );
  const ausgabe = quelle('views/PrompterOutputView.tsx');
  ok(
    [87, 88, 89, 90, 91, 92].every((nr) => kuenftig(nr).startsWith('✓ unverändert (') || beginnt(nr, 'Ausgabefenster')) &&
      !GEAENDERT_KANON.has('apps/prompter/src/renderer/src/views/PrompterOutputView.tsx') &&
      !ausgabe.includes('AppShell') &&
      !ausgabe.includes('@jm/settings'),
    'PR Funktionsliste Nr. 87–92: das Ausgabefenster (views/PrompterOutputView.tsx) ist unverändert, ohne AppShell und ohne @jm/settings (E6)',
  );
}

// ── Gemerkte Zustände: kein localStorage, nichts im Renderer gemerkt außer der Konfigurationsdatei im Main ──
{
  const wurzel = quelle('views/PrompterOberflaeche.tsx');
  ok(
    !wurzel.includes('localStorage') && !quelle('views/Einstellungen.tsx').includes('localStorage') && !quelle('views/LiveBereich.tsx').includes('localStorage'),
    'PR Funktionsliste Nr. 106–123: die Oberfläche merkt nichts selbst, alle Werte liegen weiter in der Konfigurationsdatei des Main',
  );
  const config = quelle('main/config.ts');
  ok(
    ['script', 'fontScale', 'lineHeight', 'speed', 'mirrorH', 'mirrorV', 'marginXPct', 'readingLine', 'readingLinePct', 'bold', 'outputDisplayId', 'remoteEnabled'].every((f) => quelle('shared/types.ts').includes(f)) && config.length > 0,
    'PR Funktionsliste Nr. 106–118: alle gemerkten Konfigurationsfelder gibt es weiter',
  );
}

// ── Kein window.confirm im Renderer, das eine window.alert steht in der Wurzel-View (Nr. 33) ──
{
  const dateien = ['App.tsx', 'views/PrompterOberflaeche.tsx', 'views/LiveBereich.tsx', 'views/Einstellungen.tsx', 'views/PrompterOutputView.tsx', 'components/PrompterScroller.tsx', 'components/RemoteQr.tsx', 'components/Regler.tsx', 'lib/useHotkeys.ts', 'lib/oberflaeche.ts', 'lib/aktionen.ts', 'lib/bruecken.ts'];
  ok(dateien.every((d) => !/\bwindow\.confirm\(/.test(quelle(d))), 'PR Funktionsliste Nr. 33: weiter kein window.confirm im Renderer');
  ok(dateien.filter((d) => /\bwindow\.alert\(/.test(quelle(d))).join() === 'views/PrompterOberflaeche.tsx', 'PR Funktionsliste Nr. 33: das einzige window.alert steht bei „Datei laden“ in der Wurzel-View');
}

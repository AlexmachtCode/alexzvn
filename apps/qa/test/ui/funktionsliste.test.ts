// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (UX Welle 1, Q&A e; Spec 10 „Kein Funktionsverlust“). Jede der 135 Zeilen in den Abschnitten
// 1–7 von docs/ux/funktionslisten/qa.md ist in „künftig wo“ abgehakt: „✓ “ und ein Ort des Ortsregisters, „unverändert (…)“,
// „entfällt (…, E…)“ oder „ersetzt durch {Ort} (…, E…)“. E-Verweise nur auf E1–E18. Jede genannte Datei existiert, Groß- und
// Kleinschreibung wie im Repo. „unverändert (…)“ nennt die Datei in der Klammer und darf keine Datei nennen, die seit der
// Erhebung (210e1d9dcb) geändert wurde, außer sie bekam nur die lesende Fernsteuerungs-Meldung (E2, R18): dann steht der Hinweis
// im Haken. Dazu Querprüfungen gegen den Code (Haupttasten, Kürzel, Eingabefilter, Panel-Tasten nach O1, die Abläufe in den
// immer gemounteten Teilen statt im Panel, Statuseinträge, die ersetzten und die geänderten Elemente aus Task 21).
// Läuft im Paketordner apps/qa (npm run selftest -w @jm/qa, zweiter Lauf).
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { PEERS_TEXTE, peerSetzen, peerSetzenGrund } from '@jm/settings';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { gefundeneAdressen, gegenstellenAbschnitt, hauptTasten, onAirKopf, QA_TEXTE, statusLeiste, wartendText, type OberflaechenStand } from '@/lib/oberflaeche';
import { cloud, eintragQ, ohneKommentare, qaState, toolLink } from './testzustand';

const LISTE = '../../docs/ux/funktionslisten/qa.md';
const ERHEBUNG = '210e1d9dcb';

/** Panel-Abschnitte von Q&A (Titel der @jm/settings-Abschnitte und der tool-eigenen Abschnitte, E13, E14). */
const ABSCHNITTE = ['Fernsteuerung', 'Gegenstellen', 'Redezeit und Kopplung', 'Moderation', 'Extern'];

/**
 * Ortsregister des Plans. „Panel“ allein steht für die Panel-Tasten nach O1 (gilt für das ganze Panel, kein Abschnitt) und für das
 * Ersetzen der Overlays durch das Panel (Nr. 56, 126, 127).
 */
const ORTE: readonly string[] = [
  'Kopf',
  'Kopfmitte',
  'Live-Bereich am Wort',
  'Live-Bereich Warteschlange',
  'Live-Bereich Formular',
  'Live-Bereich Erledigt',
  'rechte Spalte Saal',
  'rechte Spalte Extern',
  'Statusleiste',
  'Saal-Handy-Seite',
  'Panel',
  ...ABSCHNITTE.map((a) => `Panel ${a}`),
];

/** Zeilen insgesamt und je Abschnitt 1–7, wie Task 18 die Liste angelegt hat. */
const GESAMT = 135;
const JE_ABSCHNITT = [55, 26, 36, 0, 5, 7, 6];

/**
 * Alle Dateien von apps/qa, die seit der Erhebung (210e1d9dcb) geändert oder gelöscht wurden, in der Schreibweise der Liste. Ein
 * „unverändert (…)“ darf sie nur nennen, wenn der Haken E2 nennt (R18, nur die lesende Fernsteuerungs-Meldung). Läuft der Test in
 * einem Klon mit Verlauf, prüft er unten zusätzlich, dass git keine weitere Datei kennt.
 */
const GEAENDERT = [
  'App.tsx',
  'components/ActivePanel.tsx',
  'components/AddForm.tsx',
  'components/CloudPanel.tsx',
  'components/ConnectionsPanel.tsx',
  'components/Queue.tsx',
  'components/RemotePanel.tsx',
  'components/Settings.tsx',
  'globals.css',
  'lib/bruecken.ts',
  'lib/oberflaeche.ts',
  'main/control-server.ts',
  'main/index.ts',
  'package.json',
  'preload/index.ts',
  'shared/fernsteuerung.ts',
  'shared/types.ts',
  'test/cloud-zugang.test.ts',
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
  'views/Einstellungen.tsx',
  'views/LiveBereich.tsx',
  'views/QaOberflaeche.tsx',
];

/** Geänderte Dateien außerhalb von apps/qa, die ein Haken zitieren könnte (Stand: keine; die zitierten packages/-Dateien sind unverändert). */
const PAKETE_GEAENDERT: string[] = [];

/** Kanonischer Pfad ab der Repo-Wurzel, gleich welche Schreibweise der Haken wählt (kurz, mit renderer/src/ oder mit apps/qa/). */
function kanon(pfad: string): string {
  if (/^[A-Za-z.]+\.json$/.test(pfad)) return `apps/qa/${pfad}`; // Dateien der Paketwurzel (package.json, tsconfig.test.json)
  const a = aufgeloest(pfad);
  return a.startsWith('../../') ? a.slice('../../'.length) : `apps/qa/${a}`;
}

const GEAENDERT_KANON = new Set([...GEAENDERT.map(kanon), ...PAKETE_GEAENDERT]);
const NUR_MELDUNG = new Set(['main/index.ts', 'main/control-server.ts', 'preload/index.ts', 'shared/types.ts'].map(kanon));

/** Alle seit der Erhebung geänderten Dateien des Repos laut git (Pfade ab der Wurzel); null, wenn der Klon keinen Verlauf hat. */
function gitGeaendert(): Set<string> | null {
  try {
    const aus = execFileSync('git', ['diff', '--name-only', `${ERHEBUNG}..HEAD`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return new Set(aus.split(/\r?\n/).filter((n) => n !== ''));
  } catch {
    return null;
  }
}
const GIT = gitGeaendert();
if (GIT === null) console.log(`QA Funktionsliste: kein git-Verlauf bis ${ERHEBUNG} (flacher Klon); die Prüfung gegen git entfällt, die statischen Listen gelten`);

/** Datei in Backticks: Pfad mit Endung, aufgelöst nach der Pfadregel im Kopf der Liste. */
const PFAD = /`([A-Za-z0-9_./-]+\.(?:tsx|ts|css|html|json|md|mjs))`/g;
/** Nach „unverändert (“ steht sofort die Datei. */
const UNVERAENDERT = /^unverändert \(`[A-Za-z0-9_./-]+\.(?:tsx|ts|css|html|json|md|mjs)`/;
/** Nur die Entscheidungen E1–E18 dieses Plans sind erlaubte Verweise. */
const VERWEIS = /\bE(?:[1-9]|1[0-8])\b/;
const FREMD = /\b(?:E(?:0|19|[2-9]\d)|E\d{3,}|OF\d+)\b/;

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
    const nr = /^\| (\d+) \|/.exec(z);
    if (nr && abschnitt >= 1 && abschnitt <= 7) {
      liste.push({ abschnitt, nr: Number(nr[1]), zellen: z.split(/(?<!\\)\|/).slice(1, -1).map((s) => s.trim()) });
    }
  }
  return liste;
}

/** Pfadregel der Liste: Repo-Wurzel, apps/qa/src (main, preload, shared, renderer), test/ im Paket oder der Renderer. */
function aufgeloest(pfad: string): string {
  if (/^(?:apps|packages|docs)\//.test(pfad)) return `../../${pfad}`;
  if (/^test\//.test(pfad)) return pfad;
  if (/^(?:main|preload|shared|renderer)\//.test(pfad)) return `src/${pfad}`;
  return `src/renderer/src/${pfad}`;
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
  if (FREMD.test(ohneCode)) return 'Verweis außerhalb von E1–E18';
  let form: string | undefined;
  if (rest.startsWith('unverändert')) form = UNVERAENDERT.test(rest) ? 'unverändert' : undefined;
  else if (rest.startsWith('entfällt (')) form = 'entfällt';
  else if (rest.startsWith('ersetzt durch ')) form = ortAm(rest.slice('ersetzt durch '.length)) && 'ersetzt durch';
  else form = ortAm(rest);
  if (form === undefined) return rest.startsWith('unverändert') ? '„unverändert“ ohne Datei in der Klammer' : `Ort nicht aus dem Ortsregister: ${rest.slice(0, 40)}`;
  if (form === 'ersetzt durch' && !VERWEIS.test(ohneCode)) return '„ersetzt durch“ ohne E-Verweis';
  if (form === 'entfällt' && !VERWEIS.test(ohneCode)) return '„entfällt“ ohne E-Verweis';
  const pfade = [...k.matchAll(PFAD)].map((m) => m[1]);
  if (form !== 'entfällt' && pfade.length === 0) return 'Ort ohne Datei';
  const fehlt = pfade.filter((p) => !gibtEs(p));
  if (fehlt.length > 0) return `Datei fehlt: ${fehlt.join(', ')}`;
  // R13/R18: „unverändert“ nennt nur Dateien, die es seit der Erhebung nicht verändert hat; die vier Dateien mit der lesenden
  // Fernsteuerungs-Meldung (E2) und nur sie dürfen es mit diesem Hinweis.
  if (form === 'unverändert') {
    const veraendert = pfade.filter((p) => GEAENDERT_KANON.has(kanon(p)) || GIT?.has(kanon(p)) === true);
    if (veraendert.length > 0 && !/\bE2\b/.test(ohneCode)) return `unverändert mit geänderter Datei (${veraendert.join(', ')}) ohne Hinweis auf E2`;
    if (veraendert.some((p) => !NUR_MELDUNG.has(kanon(p)))) {
      return `unverändert mit einer Datei, die mehr als die Fernsteuerungs-Meldung bekam (${veraendert.join(', ')})`;
    }
  }
  return null;
}

const alle = zeilen(leseText(LISTE));

gleich(alle.length, GESAMT, 'QA Funktionsliste: 135 Zeilen in den Abschnitten 1–7 (Stand Task 18)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'QA Funktionsliste: Zeilen je Abschnitt wie in Task 18 (55/26/36/0/5/7/6)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'QA Funktionsliste: Nummern fortlaufend ab 1',
);

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `QA Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const quelle = (pfad: string): string => (gibtEs(pfad) ? readFileSync(aufgeloest(pfad), 'utf8') : '');

/** Alle .ts und .tsx unter src/renderer/src, mit Pfad (für Prüfungen über den ganzen Renderer). */
function rendererDateien(ordner = 'src/renderer/src'): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const p = `${ordner}/${n}`;
    return statSync(p).isDirectory() ? rendererDateien(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}
const renderer = rendererDateien();

// ── Die Menge der geänderten Dateien stimmt mit git überein, wenn der Klon den Verlauf hat (sonst keine Aussage) ──
{
  if (GIT !== null) {
    const fehlend = [...GIT].filter((n) => n.startsWith('apps/qa/') && !GEAENDERT_KANON.has(n) && n !== 'apps/qa/test/ui/funktionsliste.test.ts');
    ok(fehlend.length === 0, `QA Funktionsliste: GEAENDERT nennt alle seit ${ERHEBUNG} geänderten Dateien von apps/qa (fehlt: ${fehlend.join(', ') || 'nichts'})`);
    const pakete = [...GIT].filter((n) => !n.startsWith('apps/qa/') && !n.startsWith('docs/') && !n.startsWith('.superpowers/'));
    const zitiert = alle.filter((z) => UNVERAENDERT.test(z.zellen[6].slice(2))).flatMap((z) => [...z.zellen[6].matchAll(PFAD)].map((m) => kanon(m[1])));
    const getroffen = zitiert.filter((n) => !n.startsWith('apps/qa/') && pakete.includes(n));
    ok(getroffen.length === 0 || getroffen.every((n) => PAKETE_GEAENDERT.includes(n)), `QA Funktionsliste: keine in einem unverändert-Haken zitierte Datei außerhalb von apps/qa wurde geändert (${getroffen.join(', ') || 'keine'})`);
  }
  ok(!GEAENDERT.some((d) => ['main/cloud.ts', 'main/cloud-zugang.ts', 'main/config.ts', 'main/coupling.ts', 'main/remote-page.ts', 'shared/queue.ts', 'store/useQa.ts'].includes(d)), 'QA Funktionsliste: die als unverändert geführten Dateien stehen nicht in GEAENDERT');
  // Negativprobe: andere Schreibweisen derselben geänderten Datei werden erkannt.
  const synth = (pfad: string): Zeile => ({ abschnitt: 3, nr: 0, zellen: ['0', '', '', '', '', '', `✓ unverändert (\`${pfad}\`): x`] });
  ok(
    ['App.tsx', 'renderer/src/App.tsx', 'apps/qa/src/renderer/src/App.tsx'].every((p) => (zeilenFehler(synth(p)) ?? '').includes('geänderter Datei')) &&
      zeilenFehler(synth('apps/qa/src/main/cloud.ts')) === null &&
      zeilenFehler(synth('apps/qa/src/main/index.ts')) !== null,
    'QA Funktionsliste: eine geänderte Datei wird in jeder Schreibweise (kurz, renderer/src/…, apps/qa/…) erkannt, eine unveränderte nicht',
  );
}

// ── Gelöschte Dateien: Settings.tsx und ConnectionsPanel.tsx gibt es nicht mehr, kein Haken nennt sie ──
ok(
  !gibtEs('components/Settings.tsx') && !gibtEs('components/ConnectionsPanel.tsx') && alle.every((z) => !/components\/(?:Settings|ConnectionsPanel)\.tsx/.test(z.zellen[6])),
  'QA Funktionsliste: Settings.tsx und ConnectionsPanel.tsx sind gelöscht und kein Haken nennt sie als neuen Ort',
);

// ── Pflichtzeilen Tastatur (Nr. 123–129) ──
{
  const t = hauptTasten({ state: qaState() });
  ok(
    [t.naechste, t.beenden, t.saal].every((x) => !('shortcut' in x)) &&
      renderer.every((d) => !/\b(?:keydown|keyup|addEventListener)\b/.test(ohneKommentare(readFileSync(d, 'utf8')))) &&
      kuenftig(123).startsWith('✓ Live-Bereich am Wort') &&
      /\bE1\b/.test(kuenftig(123)),
    'QA Funktionsliste Nr. 123: weiter keine Kürzel; die Haupttasten tragen keines und im Renderer steht kein keydown, keyup und addEventListener (E1)',
  );
  const add = quelle('components/AddForm.tsx');
  ok(
    (add.match(/onKeyDown=\{\(e\) => e\.key === 'Enter' && submit\(\)\}/g) ?? []).length === 3 && kuenftig(124).startsWith('✓ Live-Bereich Formular'),
    'QA Funktionsliste Nr. 124: Enter in den drei Feldern des Formulars macht dasselbe wie „Hinzufügen“',
  );
  ok(
    !/onKeyDown|Escape/.test(ohneKommentare(quelle('components/Queue.tsx'))) &&
      !/onKeyDown|Escape/.test(ohneKommentare(quelle('views/Einstellungen.tsx'))) &&
      kuenftig(125).startsWith('✓ Live-Bereich Warteschlange') &&
      kuenftig(125).includes('R21'),
    'QA Funktionsliste Nr. 125: weiter kein Enter- und kein Escape-Handler im Bearbeiten-Formular und im Panel; die Redezeit übernimmt bei Enter oder Verlassen (R21)',
  );
  ok(
    kuenftig(126).startsWith('✓ ersetzt durch Panel (') && /\bE13\b/.test(kuenftig(126)) && quelle('packages/ui/src/components/SettingsPanel.tsx').includes('Escape'),
    'QA Funktionsliste Nr. 126: das Modal wird das Panel, Escape schließt es (E13)',
  );
  ok(
    kuenftig(128).startsWith('✓ Live-Bereich Warteschlange') &&
      !/tabIndex/.test(quelle('components/Queue.tsx')) &&
      /user-select:\s*none/.test(quelle('globals.css')),
    'QA Funktionsliste Nr. 128: die Zeilen der Warteschlange sind keine Tabulatorziele, der Text bleibt nicht markierbar',
  );
  const main = quelle('main/index.ts');
  ok(
    !/setApplicationMenu|globalShortcut|new Tray|before-input-event/.test(main) && kuenftig(129).startsWith('✓ unverändert (`main/index.ts`') && /\bE2\b/.test(kuenftig(129)),
    'QA Funktionsliste Nr. 129 (Menü): der Hauptprozess bleibt ohne Menü, globales Kürzel, Tray und before-input-event',
  );
}

// ── Pflichtpunkt Panel (Nr. 127, O1): Feld behält Tasten, Leertaste auf Knopf/Schalter geht ans Tool, Escape schließt ──
ok(
  zeile(127)?.zellen[1] === 'Pflichtpunkt Panel' &&
    kuenftig(127).startsWith('✓ Panel (') &&
    ['Leertaste', 'Escape', 'Feld', 'Schalter', 'O1', 'ohne Wirkung'].every((w) => kuenftig(127).includes(w)),
  'QA Funktionsliste Nr. 127 (Pflichtpunkt Panel): Leertaste und Escape, je für Feld und Knopf/Schalter; in Q&A bleibt die Leertaste ohne Wirkung, weil es kein Tool-Kürzel gibt (Spec 10, O1)',
);
{
  const panel = quelle('packages/ui/src/components/SettingsPanel.tsx');
  ok(
    panel.includes('Escape') && panel.includes('defaultPrevented') && /verbrauchtTasten/.test(panel),
    'QA Funktionsliste Nr. 126/127: SettingsPanel schließt mit Escape, nur wenn nicht defaultPrevented; Felder behalten ihre Tasten',
  );
}

// ── Abläufe aus Abschnitt 3: Renderer-Abläufe in den immer gemounteten Teilen, nicht im Panel; Main-Abläufe im Main ──
{
  const app = quelle('App.tsx');
  const store = quelle('store/useQa.ts');
  const panel = ohneKommentare(quelle('views/Einstellungen.tsx'));
  const oberflaeche = quelle('views/QaOberflaeche.tsx');
  ok(
    app.includes('void load()') && app.includes('Lädt …') && store.includes('window.jmqa.onState') && store.includes('window.jmqa.onLinks') && store.includes('subscribed') && !panel.includes('load('),
    'QA Funktionsliste Nr. 3/83: Laden und das einmalige Abonnement von onState und onLinks laufen in App und Store, nicht im Panel',
  );
  ok(
    ['window', 'useEffect', 'addEventListener', 'setInterval', 'setTimeout', 'localStorage', 'useQa'].every((w) => !panel.includes(w)),
    'QA Funktionsliste: Einstellungen.tsx hat kein window, keinen Effekt und keinen Store (G7, G8); nur AlterKey hält den eingetippten Key',
  );
  ok(
    oberflaeche.includes('useBrueckenWert(MASTER_LINK_QUELLE)') &&
      oberflaeche.includes('useBrueckenWert(FERNSTEUERUNG_QUELLE)') &&
      !panel.includes('useBrueckenWert') &&
      [90, 117].every((nr) => kuenftig(nr).startsWith('✓ Statusleiste')),
    'QA Funktionsliste Nr. 90/117: die Brücken werden in der Oberfläche gelesen, nicht im Panel; Fernsteuerung und Master-Link stehen in der Statusleiste',
  );
  // Abläufe im Hauptprozess: die genannten Funktionen und Befehle stehen im Main.
  const main = quelle('main/index.ts');
  ok(
    ['next', 'end', 'clear', 'extend'].every((v) => main.includes(`case '${v}'`)) &&
      ['doActivate', 'doEnd', 'doNext', 'applyCouplingActivate', 'applyCouplingEnd', 'cloudEnable', 'cloudGenerateEvent', 'cloudPurge', 'freigabeHolen', 'applyShowFromDeepLink', 'requestSingleInstanceLock', 'setWindowOpenHandler'].every((w) => main.includes(w)) &&
      [84, 85, 86, 87, 91, 92, 93, 95, 107, 108, 109, 115, 116].every((nr) => kuenftig(nr).startsWith('✓ unverändert (') && /\bE2\b/.test(kuenftig(nr))),
    'QA Funktionsliste Nr. 84–87/91–95/107–109/115/116: Fernsteuerung, Kopplung, Show, Extern und Fenster leben weiter im Hauptprozess',
  );
  ok(
    ['main/cloud.ts', 'main/cloud-zugang.ts', 'main/config.ts', 'main/coupling.ts', 'main/remote-page.ts', 'main/datei-atomar.ts', 'shared/queue.ts', 'store/useQa.ts'].every((d) => gibtEs(d)) &&
      [78, 79, 80, 131, 133].every((nr) => kuenftig(nr).startsWith('✓ unverändert (') && !/\bE2\b/.test(kuenftig(nr))) &&
      [119, 120, 121, 122].every((nr) => kuenftig(nr).startsWith('✓ Saal-Handy-Seite (`main/remote-page.ts`)')),
    'QA Funktionsliste Nr. 78–80/119–122/131/133: Zugangstexte, Konfiguration, Geheimnisse und Handy-Seite liegen in ihren unveränderten Dateien',
  );
}

// ── Haupttasten (Nr. 13, 14, 15, 37) ──
{
  const leer = hauptTasten({ state: qaState() });
  const amWort = hauptTasten({ state: qaState({ entries: [eintragQ('a', 'active')], activeId: 'a' }) });
  const saalAn = hauptTasten({ state: qaState({ remote: { running: true, urls: ['http://x'] } }) });
  ok(
    leer.beenden.state === 'gesperrt' &&
      leer.beenden.disabledReason === QA_TEXTE.grund.niemandAmWort &&
      amWort.beenden.state === 'bereit' &&
      leer.naechste.state === 'bereit' &&
      amWort.naechste.state === 'bereit' &&
      leer.naechste.label === amWort.naechste.label &&
      leer.naechste.label === 'Nächste ▶' &&
      leer.beenden.label === '■ Beenden' &&
      kuenftig(13).includes('Niemand am Wort') &&
      kuenftig(14).includes('E15') &&
      kuenftig(15).includes('zweite Fundstelle'),
    'QA Funktionsliste Nr. 13–15: „Nächste ▶“ nie gesperrt und mit gleicher Beschriftung, „■ Beenden“ nur ohne Sprecher gesperrt mit Grund (E15)',
  );
  ok(
    leer.saal.label === 'Saal-Einreichung ○ Aus' && saalAn.saal.label === 'Saal-Einreichung ◉ An' && leer.saal.state === 'bereit' && saalAn.saal.state === 'bereit' && kuenftig(37).startsWith('✓ Live-Bereich am Wort') && kuenftig(37).includes('setRemote(!remote.running)'),
    'QA Funktionsliste Nr. 37: die Saal-Taste wechselt Wörter An und Aus, Zustand bereit, Handler setRemote(!remote.running)',
  );
  ok(onAirKopf({ state: qaState({ activeId: 'a' }) }).live && !onAirKopf({ state: qaState() }).live, 'QA Funktionsliste Nr. 13: On-Air im Kopf, solange jemand am Wort ist (E8)');
  const live = quelle('views/LiveBereich.tsx');
  ok(
    live.includes('a.next') && live.includes('a.endActive') && live.includes('a.setRemote(!s.state.remote.running)') && live.includes('<TallyButton'),
    'QA Funktionsliste Nr. 13/14/37: die Haupttasten sind TallyButtons mit den Handlern next, endActive und setRemote',
  );
}

// ── Kopf und Kopfmitte (Nr. 4–8, 12) ──
{
  const wartend = wartendText({ state: qaState({ entries: [eintragQ('a', 'waiting'), eintragQ('b', 'waiting', { source: 'remote', channel: 'press', approved: false }), eintragQ('c', 'done')] }) });
  ok(
    wartend === '2 wartend' && kuenftig(5).startsWith('✓ Kopfmitte') && kuenftig(5).includes('Befund 1'),
    'QA Funktionsliste Nr. 5: „N wartend“ in der Kopfmitte zählt wie heute auch die nicht freigegebenen Einträge',
  );
  ok(
    kuenftig(6).startsWith('✓ ersetzt durch Kopf') &&
      kuenftig(7).startsWith('✓ ersetzt durch Kopf') &&
      quelle('packages/ui/src/components/AppHeader.tsx').includes('data-zahnrad') &&
      kuenftig(4).includes('R12') &&
      kuenftig(8).includes('E17'),
    'QA Funktionsliste Nr. 4/6–8: „Verbindungen“ und „Einstellungen“ sind ersetzt durch ⚙ im Kopf (E13); Q&A hatte keine Markenzeile, R12 trifft nicht zu',
  );
  ok(
    QA_TEXTE.leer === 'Niemand am Wort. „Nächste“ ruft die erste Wortmeldung auf.' && quelle('components/ActivePanel.tsx').includes('QA_TEXTE.leer') && kuenftig(12).includes('R9'),
    'QA Funktionsliste Nr. 12: der Leertext steht wörtlich als QA_TEXTE.leer, mit typografischem Anführungszeichen (R9)',
  );
}

// ── Statusleiste: Master-Link, Extern, Kopplungen, Fernsteuerung, Saal (Nr. 52, 53, 81, 90, 117) ──
{
  const stand = (state = qaState(), teil: Partial<OberflaechenStand> = {}): OberflaechenStand => ({ state, masterLink: undefined, fernsteuerung: undefined, ...teil });
  const eintrag = (s: OberflaechenStand, id: string) => statusLeiste(s).find((i) => i.id === id);
  gleich(
    statusLeiste(stand()).map((i) => i.id),
    ['master-link', 'extern', 'kopplung-timer', 'kopplung-titler', 'fernsteuerung', 'saal'],
    'QA Funktionsliste Nr. 52/90/117: die Statusleiste hat master-link, extern, kopplung-timer, kopplung-titler, fernsteuerung und saal',
  );
  const aus = qaState({ config: { ...qaState().config, autoTimer: false } });
  const gesucht = qaState();
  const verbunden = qaState({ links: [toolLink()] });
  ok(
    eintrag(stand(aus), 'kopplung-timer')?.state === 'off' &&
      eintrag(stand(gesucht), 'kopplung-timer')?.state === 'warn' &&
      eintrag(stand(verbunden), 'kopplung-timer')?.state === 'ok' &&
      eintrag(stand(verbunden), 'kopplung-timer')?.detail?.includes('10.0.0.7') === true &&
      kuenftig(53).startsWith('✓ ersetzt durch Statusleiste') &&
      /\bE13\b/.test(kuenftig(53)),
    'QA Funktionsliste Nr. 53: die Kopplung ist dreifarbig (aus = off, nicht gefunden = warn, gekoppelt = ok mit Adresse), nie grün ohne Gegenstelle (E13)',
  );
  ok(
    eintrag(stand(), 'fernsteuerung')?.state === 'off' &&
      eintrag(stand(qaState(), { fernsteuerung: { laeuft: true, port: 8733, clients: 1, modus: 'open' } }), 'fernsteuerung')?.state === 'ok' &&
      quelle('shared/fernsteuerung.ts') !== '' &&
      kuenftig(90).includes('Port 8733') &&
      kuenftig(90).includes('main/control-server.ts'),
    'QA Funktionsliste Nr. 90: das Start-Ergebnis des Steuerservers steht als Eintrag fernsteuerung in der Statusleiste, bis zur ersten Meldung unbekannt (off)',
  );
  ok(
    eintrag(stand(), 'saal')?.state === 'off' && eintrag(stand(qaState({ remote: { running: true, urls: ['http://10.0.0.5:7782'] } })), 'saal')?.state === 'ok',
    'QA Funktionsliste Nr. 36/37: der Eintrag saal ist aus oder an mit Adresse',
  );
  ok(
    eintrag(stand(), 'extern')?.state === 'off' && eintrag(stand(qaState({ cloud: cloud({ enabled: true, configured: true, lastError: 'kaputt' }) })), 'extern')?.state === 'error' && kuenftig(49).includes('Statuseintrag extern'),
    'QA Funktionsliste Nr. 41/49: der Eintrag extern ist aus oder zeigt den Fehler',
  );
  // Kein Toast, kein alert, kein prompt im Renderer (Nr. 81); genau ein confirm in CloudPanel.tsx (Nr. 77, R19).
  const treffer = renderer.flatMap((d) => (ohneKommentare(readFileSync(d, 'utf8')).match(/\b(?:window\.)?(?:alert|prompt|confirm)\(/g) ?? []).map((m) => `${d}:${m}`));
  gleich(treffer, ['src/renderer/src/components/CloudPanel.tsx:confirm('], 'QA Funktionsliste Nr. 77/81: genau ein confirm im Renderer (Event beenden), kein alert, kein prompt (R19)');
  ok(kuenftig(77).startsWith('✓ rechte Spalte Extern') && quelle('components/CloudPanel.tsx').includes('Event beenden und alle externen Einreichungen im Relay löschen?'), 'QA Funktionsliste Nr. 77: die Rückfrage steht wörtlich vor „Event beenden & Daten löschen“');
}

// ── Gegenstellen (Nr. 70–76): Host-Feld nicht mehr vorbelegt, Setzen mit Grund, Auto ──
{
  const aufrufe: string[] = [];
  const a = { setEndpoint: (role: string, host: string, port: number) => void aufrufe.push(`${role}|${host}|${port}`) };
  const gefunden = qaState({ links: [toolLink({ connected: true, source: 'mdns' })] });
  const manuell = qaState({ links: [toolLink({ connected: false, source: 'manual', host: 'rec.lan', port: 9000 })], overrides: { timer: { host: 'rec.lan', port: 9000 } } });
  const zeileTimer = (s: ReturnType<typeof qaState>) => gegenstellenAbschnitt({ state: s }, a).peers.find((p) => p.role === 'timer');
  ok(
    zeileTimer(gefunden)?.host === '' &&
      zeileTimer(gefunden)?.port === 8730 &&
      zeileTimer(manuell)?.host === 'rec.lan' &&
      gefundeneAdressen({ state: gefunden }).some((g) => g.text === `${QA_TEXTE.gegenstellen.gefunden} 10.0.0.7:8730`) &&
      kuenftig(73).includes('nicht mehr') &&
      kuenftig(73).includes('Verlust an Bequemlichkeit') &&
      kuenftig(74).includes('Standardport'),
    'QA Funktionsliste Nr. 73/74: das Host-Feld ist nur bei einem manuellen Endpunkt vorbelegt, ein Fund steht als „gefunden: host:port“ (Verlust gegenüber heute, benannt); der Port bleibt vorbelegt',
  );
  const p = gegenstellenAbschnitt({ state: gefunden }, a);
  const peer = p.peers[0];
  ok(
    peerSetzen(p, peer, ' 10.0.0.9 ', 8730) &&
      !peerSetzen(p, peer, 'x', null) &&
      !peerSetzen(p, peer, 'x', 9, false) &&
      peerSetzenGrund(false, null, true) === PEERS_TEXTE.setzenOhnePort &&
      aufrufe.join(';') === 'timer|10.0.0.9|8730' &&
      kuenftig(75).includes(PEERS_TEXTE.setzenOhnePort),
    'QA Funktionsliste Nr. 75: „Setzen“ schickt Host (getrimmt) und Port; ohne gültigen Port gesperrt mit Grund, statt den Override zu entfernen',
  );
  p.onAuto?.('titler');
  ok(aufrufe.at(-1) === 'titler||0' && kuenftig(76).includes('aria-label „Auto: <Tool>“'), 'QA Funktionsliste Nr. 76: „Auto“ entfernt den Override (setEndpoint mit leerem Host), der Tooltip ist durch Erklärtext und aria-label ersetzt (R8)');
  ok(
    kuenftig(71).includes('PEERS_TEXTE.erklaerung') && kuenftig(71).includes('R9') && gegenstellenAbschnitt({ state: gefunden }, a).peers.map((x) => x.role).join(',') === 'timer,titler' && kuenftig(70).startsWith('✓ ersetzt durch Panel Gegenstellen'),
    'QA Funktionsliste Nr. 70–72: nur Timer und Titler; der Erklärtext ist geteilt (Satz 1 aus QA_TEXTE, Rest aus PEERS_TEXTE)',
  );
}

// ── Panel-Abschnitte Redezeit, Moderation, Extern: Texte wörtlich und Klemmwert (Nr. 55–69) ──
{
  const e = quelle('views/Einstellungen.tsx');
  ok(
    ['Redezeit (Sekunden)', 'Setzt den JM Timer beim Ans-Wort-Holen.', 'Redezeit-Timer automatisch', 'JM Timer setzen + starten, wenn jemand ans Wort kommt.', 'Bauchbinde automatisch', 'JM Titler beim Ans-Wort-Holen ein-/ausblenden. Name/Funktion werden mitgesendet — ein Titler mit text-Befehl übernimmt sie automatisch.', 'Titler-Vorlage', 'Saal-Einreichungen müssen erst freigegeben werden, bevor sie aufgerufen werden.'].every((t) => e.includes(t)) &&
      QA_TEXTE.kopplung.erklaerung.startsWith('Standardmäßig aktiv: Redezeit (Timer) und Bauchbinde (Titler)') &&
      [57, 58, 59, 60].every((nr) => kuenftig(nr).startsWith('✓ Panel Redezeit und Kopplung')) &&
      kuenftig(61).startsWith('✓ Panel Moderation') &&
      kuenftig(55).startsWith('✓ Panel Redezeit und Kopplung'),
    'QA Funktionsliste Nr. 55/57–61: Beschriftungen und Hinweise der Redezeit-, Kopplungs- und Moderationsfelder stehen wörtlich im Panel',
  );
  const feld = /<NumberInput value=\{config\.speakSeconds\}[\s\S]*?\/>/.exec(e)?.[0] ?? '';
  ok(
    feld !== '' &&
      !/\bmin=|\bmax=|ganzzahl/.test(feld) &&
      e.includes('Math.max(5, v)') &&
      kuenftig(57).includes('R21') &&
      kuenftig(57).includes('leeres Feld') &&
      kuenftig(57).includes('früher wurde 5 gespeichert') &&
      kuenftig(57).includes('Enter oder Verlassen'),
    'QA Funktionsliste Nr. 57: Redezeit ohne Grenzen im Feld, Klemmwert Math.max(5, v) im Handler (R21); das leere Feld wird abgewiesen (benannt)',
  );
  ok(
    [
      'Fragen von außerhalb des Saal-WLANs — Ende-zu-Ende verschlüsselt über den Cloud-Relay. Presse per Zugangscode. Alle externen Einreichungen sind freigabepflichtig.',
      'Vorgabe: Server der Suite. Nur für Entwicklung und Fehlersuche ändern.',
      'Alter Proxy-Key (Übergang)',
      'Nur noch kurz gültig. Mit Anmeldung im Launcher brauchst du ihn nicht.',
      "cloud.hasKey || cloud.zugang.art !== 'freigabe'",
      'Noch kein Event erzeugt.',
      'Event erzeugen',
      'Neues Event',
      'Nur mit diesem Code kann Presse einreichen (leer = Presse-Kanal aus).',
      'z. B. PRESSE-2026',
      'Fehler: {cloud.lastError}',
    ].every((t) => e.includes(t)) && [62, 63, 64, 65, 66, 67, 68, 69].every((nr) => /^✓ (?:ersetzt durch )?Panel Extern/.test(kuenftig(nr))) && /\bE14\b/.test(kuenftig(63)),
    'QA Funktionsliste Nr. 62–69: der Extern-Block steht mit allen Texten wörtlich im Panel-Abschnitt Extern (E14)',
  );
  ok(
    quelle('components/RemotePanel.tsx').includes('Aus. Anschalten, damit der Saal Fragen per Handy (QR) einreichen kann.') &&
      quelle('components/CloudPanel.tsx').includes('Für Fragen per Livestream oder Presse: im Launcher anmelden und hier ein Event erzeugen.') &&
      quelle('components/CloudPanel.tsx').includes('Aus. Anschalten, damit Fragen per Livestream-QR und von der Presse eingehen.') &&
      kuenftig(40).includes('Haupttaste') &&
      kuenftig(43).includes('Panel-Abschnitt Extern'),
    'QA Funktionsliste Nr. 40/43/51: die freigegebenen Texte bleiben wörtlich, die Haken nennen den verschobenen Ort (Text für die Tabelle des Owners)',
  );
}

// ── Live-Bereich: Karten, Warteschlange, Hinweis auf die entfallene Kopplungskarte (Nr. 16–36, 52–54) ──
{
  const q = quelle('components/Queue.tsx');
  ok(
    ['Keine offenen Wortmeldungen.', 'wartet auf Freigabe', 'Freigeben', '▶ Ans Wort', 'Erledigte entfernen', 'Abbrechen', 'Speichern', 'Funktion / Medium', 'Frage (optional)', 'Kontakt:', 'hoch', 'runter', 'bearbeiten', 'entfernen'].every((w) => q.includes(w)),
    'QA Funktionsliste Nr. 16–32: Warteschlange und Erledigt behalten Leertext, Marken, Knöpfe und Tooltips',
  );
  const live = quelle('views/LiveBereich.tsx');
  ok(
    live.includes('<RemotePanel') && live.includes('<CloudPanel') && live.includes('<Queue') && live.includes('<AddForm') && live.includes('<ActivePanel') && !/Kopplung/.test(ohneKommentare(live).replace(/\/\/.*$/gm, '')),
    'QA Funktionsliste Nr. 35/52: der Live-Bereich trägt Sprecher, Warteschlange, Formular, Saal und Extern; die Kopplungskarte gibt es nicht mehr (E13)',
  );
  ok(
    [52, 53].every((nr) => kuenftig(nr).startsWith('✓ ersetzt durch Statusleiste')) && kuenftig(54).startsWith('✓ ersetzt durch Panel Redezeit und Kopplung') && /\bE13\b/.test(kuenftig(54)),
    'QA Funktionsliste Nr. 52–54: die Kopplungskarte ist ersetzt durch Statuseinträge und Panel-Schalter (E13)',
  );
}

// ── Theme und Gemerktes (Nr. 8, 130, 135) ──
{
  ok(
    renderer.every((d) => !/\b(?:localStorage|sessionStorage|persistId|indexedDB)\b/.test(ohneKommentare(readFileSync(d, 'utf8')))) &&
      quelle('packages/ui/src/lib/theme.ts').includes("'jm-theme'") &&
      [130, 135].every((nr) => /\bE17\b/.test(kuenftig(nr))) &&
      kuenftig(130).includes('jm-theme'),
    'QA Funktionsliste Nr. 130/135: der Renderer merkt sich selbst nichts, nur das Theme im geteilten Hook (E17)',
  );
}

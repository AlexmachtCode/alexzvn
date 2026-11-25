// ─────────────────────────────────────────────────────────────────────────────
// Funktionsliste nach dem Umbau (UX Welle 2b, Studio-Control e; Spec 10 „Kein Funktionsverlust“). Jede der 195 Zeilen in den
// Abschnitten 1–7 von docs/ux/funktionslisten/studio-control.md ist in „künftig wo“ abgehakt, in genau einer Form: „✓ “ und ein
// Ort des Ortsregisters (Plan Task 19), „✓ unverändert (…)“, „✓ entfällt (…, B…)“ oder „✓ ersetzt durch {Ort} (…, B…)“. Das
// Register ist streng: Nach dem Ort folgt genau „ (“, ein bloßes „Panel“ oder ein Ort mit angehängtem Wort gilt nicht.
// Verweise nur auf B1–B22 (Plan 2b), im Haken und in der ganzen Liste. Jede genannte Datei existiert, Groß- und Kleinschreibung
// wie im Repo; in den Spalten 1–6 auch die seit der Erhebung gelöschten (GELOESCHT). Zeilenangaben im Haken liegen in der Datei
// von heute, an den Pflichtzeilen auch am richtigen Code. „heute wo“ bleibt beim Stand der Erhebung (481c998c08, Prüfsumme).
// Dazu Querprüfungen gegen den Code: Pflichtzeilen Verben, Tastatur, Standardmenü und Panel-Tasten (O1), die Abläufe aus
// Abschnitt 3 in der Wurzel statt im Panel (B8), Tray und Browser, die Zeilen aus N2b 2.1, die Festlegungen aus Task 16 bis 18
// und der Abschluss der Befunde 1–13.
// Läuft im Paketordner apps/studio-control (npm run selftest -w @jm/studio-control), eingehängt in test/ui/selftest.ts.
// „unverändert (…)“ und der Ort „Tray (unverändert)“ nennen keine Datei, die seit der Erhebung geändert wurde, außer sie bekam
// nur, was der Plan erlaubt (Master-Link und Fernsteuerungs-Meldung B2, Lauf-Kennung und Wurzel-View in R/App.tsx B15): dann
// nennt der Haken diesen Verweis. Seit der Altfehler-Stufe 1 (Plan 2026-11-25, Ruling R6) darf er auch eine Datei nennen, die ein
// Befund dieser Stufe geändert hat, wenn er ihn als „Altfehler <ID>“ nennt und die Liste der ID die Datei enthält (ALTFEHLER); für
// eine solche Datei reicht der B-Verweis allein nicht mehr. Der Abgleich mit git läuft nur mit JM_FUNKTIONSLISTE_GIT=1, gegen den
// Arbeitsbaum (auch vor dem Commit; neue Dateien erst nach git add).
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { REMOTE_TEXTE } from '@jm/settings';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import { STUDIO_TEXTE, gemeldet, lichtTaste, tricasterTasten, type OberflaechenStand } from '@/lib/oberflaeche';
import { REITER } from '@/views/Werkzeugleiste';
import { ohneKommentare, rendererDateien } from './testzustand';

const LISTE = '../../docs/ux/funktionslisten/studio-control.md';
const ERHEBUNG = '481c998c08';
/** Letzter Stand der Liste vor dem Abhaken (Task 14, Fix-Runde 1). */
const LISTE_VORHER = '50a7c942a0';

/**
 * Ortsregister (Plan Task 19): Anmeldung, Kopf, Werkzeugleiste, Reiter Video/Audio/Licht/Setup, Panel ‹Gerät› (die Karten der
 * Gerätepanels in den Reitern), Statusleiste, Panel ‹Abschnitt› (die Abschnitte im Einstellungs-Panel: Fernsteuerung; der Abschnitt
 * Browser-Zugang aus Altfehler SC-S1 ist neu und hat keine Zeile der Erhebung), Tray (unverändert), Browser.
 */
const REITER_NAMEN = ['Video', 'Audio', 'Licht', 'Setup'];
const GERAETE = ['TriCaster', 'ATEM', 'OBS', 'PTZ', 'Audio', 'Licht'];
const ABSCHNITTE = ['Fernsteuerung'];
const UNVERAENDERT_ORTE = ['Tray (unverändert)'];
const ORTE: readonly string[] = [
  'Anmeldung',
  'Kopf',
  'Werkzeugleiste',
  ...REITER_NAMEN.map((r) => `Reiter ${r}`),
  ...GERAETE.map((g) => `Panel ${g}`),
  'Statusleiste',
  ...ABSCHNITTE.map((a) => `Panel ${a}`),
  ...UNVERAENDERT_ORTE,
  'Browser',
];

/** Zeilen insgesamt und je Abschnitt 1–7, wie Task 14 die Liste angelegt hat (e868daf936); Abschnitt 4 in drei Teiltabellen. */
const GESAMT = 195;
const JE_ABSCHNITT = [100, 25, 40, 8, 1, 7, 14];
const TEILTABELLEN: Record<string, [number, number]> = { '4a': [166, 169], '4b': [170, 172], '4c': [173, 173] };

/** Prüfsumme der Spalte „heute wo“ aller 195 Zeilen (Stand der Erhebung, wie Task 14 sie schrieb): sie bleibt (Ruling Task 12). */
const HEUTE_WO_SHA256 = '5ae3be383818f9aac2600f801d53344efd21bb3aeff84a1dc0e639fed21be532';
/** Korrekturen in Task 19 an den Spalten 1–6 (Nr. → Spaltenindex): Nr. 99 und 100 bekamen den Vermerk „N2b 2.1 Nr. 16“ (Kopf). */
const KORRIGIERT: Record<number, number[]> = { 99: [2], 100: [2] };

/** Seit der Erhebung gelöscht (Task 17 und 18); sie stehen nur noch in den Spalten 1–6, nie im Haken. */
const GELOESCHT = ['R/components/AppShell.tsx', 'R/components/ComingSoon.tsx', 'R/components/Topbar.tsx', 'R/components/ui/StatusPill.tsx'];

/** Alle Dateien von apps/studio-control, die seit der Erhebung geändert, angelegt oder gelöscht wurden (Pfad ab apps/studio-control). */
const GEAENDERT = [
  'package.json',
  'src/main/auth/bootstrap.ts',
  'src/main/gateway/control-gateway.ts',
  'src/main/index.ts',
  'src/main/server.ts',
  'src/preload/index.ts',
  'src/renderer/src/App.tsx',
  'src/renderer/src/components/AppShell.tsx',
  'src/renderer/src/components/ComingSoon.tsx',
  'src/renderer/src/components/Topbar.tsx',
  'src/renderer/src/components/audio/AudioPanel.tsx',
  'src/renderer/src/components/lighting/LichtPanel.tsx',
  'src/renderer/src/components/setup/DiscoverPanel.tsx',
  'src/renderer/src/components/setup/UserManager.tsx',
  'src/renderer/src/components/ui/StatusPill.tsx',
  'src/renderer/src/components/video/AtemPanel.tsx',
  'src/renderer/src/components/video/AuditLogPanel.tsx',
  'src/renderer/src/components/video/ObsPanel.tsx',
  'src/renderer/src/components/video/PtzPanel.tsx',
  'src/renderer/src/components/video/TricasterPanel.tsx',
  'src/renderer/src/globals.css',
  'src/renderer/src/lib/bruecken.ts',
  'src/renderer/src/lib/oberflaeche.ts',
  'src/renderer/src/sync/jms.d.ts',
  'src/renderer/src/views/Audio.tsx',
  'src/renderer/src/views/Einstellungen.tsx',
  'src/renderer/src/views/Licht.tsx',
  'src/renderer/src/views/Login.tsx',
  'src/renderer/src/views/Setup.tsx',
  'src/renderer/src/views/StudioOberflaeche.tsx',
  'src/renderer/src/views/Video.tsx',
  'src/renderer/src/views/Werkzeugleiste.tsx',
  'src/shared/fernsteuerung.ts',
  'test/ui/benutzer.test.tsx',
  'test/ui/bruecken.test.ts',
  'test/ui/funktionsliste.test.ts',
  'test/ui/hilfe.ts',
  'test/ui/live.test.tsx',
  'test/ui/oberflaeche.test.ts',
  'test/ui/panel.test.tsx',
  'test/ui/panels.test.tsx',
  'test/ui/rahmen.test.tsx',
  'test/ui/rueckspiel.test.tsx',
  'test/ui/selftest.ts',
  'test/ui/testzustand.ts',
  'test/ui/werkzeug.test.tsx',
  'tsconfig.test.json',
].map((p) => `apps/studio-control/${p}`);

/** Geänderte Quelldateien der Pakete seit der Erhebung (Bausteine Task 1–3, Bildschirm-Ereignis Task 4), die ein Haken zitieren könnte. */
const PAKETE_GEAENDERT = [
  // Gesamtprüfung UX Welle 2b: Field.tsx (M1), SettingsPanel.tsx (I2, Opt-in toolTasten), StatusBar.tsx und lib/status.ts (I1).
  'packages/output-window/src/bildschirme.ts',
  'packages/output-window/src/index.ts',
  'packages/settings/src/SectionFrame.tsx',
  'packages/settings/src/abschnitte/ScreenOutputSection.tsx',
  'packages/settings/src/abschnitte/screen-output.ts',
  'packages/ui/src/components/AppHeader.tsx',
  'packages/ui/src/components/AppShell.tsx',
  'packages/ui/src/components/Field.tsx',
  'packages/ui/src/components/HalteKnopf.tsx',
  'packages/ui/src/components/SettingsPanel.tsx',
  'packages/ui/src/components/StatusBar.tsx',
  'packages/ui/src/components/TallyButton.tsx',
  'packages/ui/src/index.ts',
  'packages/ui/src/lib/halten.ts',
  'packages/ui/src/lib/status.ts',
  'packages/ui/src/tokens/sizes.css',
];

/**
 * Geänderte Dateien, die nur bekamen, was der Plan erlaubt, und der Verweis, der das belegt: Main, Preload und Typdatei die
 * lesenden Brücken (Master-Link, Fernsteuerungs-Meldung aus onStatus, B2); R/App.tsx nur die Lauf-Kennung des Sockets und die
 * Wurzel-View statt der Anmelde-Weiche (B15) – der Socket-Effekt samt switch ist zeichengleich (mit git geprüft, unten).
 */
const ERLAUBT = new Map<string, readonly string[]>([
  ['apps/studio-control/src/main/index.ts', ['B2']],
  ['apps/studio-control/src/main/server.ts', ['B2']],
  ['apps/studio-control/src/main/gateway/control-gateway.ts', ['B2']],
  ['apps/studio-control/src/preload/index.ts', ['B2']],
  ['apps/studio-control/src/renderer/src/sync/jms.d.ts', ['B2']],
  ['apps/studio-control/src/renderer/src/App.tsx', ['B15']],
]);

/**
 * Altfehler Runde 1, Stufe 1 (Plan 2026-11-25, Ruling R6 wie im Player): je erlaubter Studio-Control-ID die Dateien (ab der
 * Repo-Wurzel), die der Befund geändert hat. „Altfehler <ID>“ im Haken entlastet ein „unverändert (…)“ oder „Tray (unverändert)“,
 * das eine geänderte Datei nennt, nur, wenn die Liste dieser ID die Datei enthält; dann für die ganze Änderung des Befunds. Eine
 * Datei aus einer Liste bekam mehr, als ihr Eintrag in ERLAUBT deckt: Dort reicht der B-Verweis allein nicht mehr. Erlaubt sind
 * genau SC-S1 bis SC-S3 (die Player-IDs gelten nur im Player); Task 6 trägt die Dateien von SC-S2 ein.
 */
const ALTFEHLER = new Map<string, readonly string[]>([
  [
    'SC-S1',
    [
      'src/main/auth/bootstrap.ts',
      'src/main/index.ts',
      'src/preload/index.ts',
      'src/renderer/src/sync/jms.d.ts',
      'src/renderer/src/lib/bruecken.ts',
      'src/renderer/src/lib/oberflaeche.ts',
      'src/renderer/src/views/Einstellungen.tsx',
      'src/renderer/src/views/StudioOberflaeche.tsx',
    ].map((p) => `apps/studio-control/${p}`),
  ],
  ['SC-S2', []],
  ['SC-S3', ['src/main/gateway/control-gateway.ts', 'src/main/server.ts'].map((p) => `apps/studio-control/${p}`)],
]);
/** Alle Dateien, die ein Altfehler der Stufe geändert hat. */
const ALTFEHLER_DATEIEN = new Set([...ALTFEHLER.values()].flat());
/** Verweis „Altfehler <ID>“ auf eine der erlaubten IDs; die ID steht in Gruppe 1. */
const ALTFEHLER_VERWEIS = new RegExp(`\\bAltfehler (${[...ALTFEHLER.keys()].join('|')})(?![\\w-])`, 'g');
/** Die Altfehler-IDs, die ein Text (ohne Code) als Verweis nennt. */
const altfehlerIds = (text: string): string[] => [...text.matchAll(ALTFEHLER_VERWEIS)].map((m) => m[1]);
/** Entlastet einer der Verweise die Datei (kanonischer Pfad)? */
const entlastet = (ids: readonly string[], datei: string): boolean => ids.some((id) => ALTFEHLER.get(id)?.includes(datei) === true);

const GEAENDERT_KANON = new Set([...GEAENDERT, ...PAKETE_GEAENDERT]);

function git(args: string[]): string | null {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\r\n/g, '\n');
  } catch {
    return null;
  }
}
// Nur auf Anforderung: ohne JM_FUNKTIONSLISTE_GIT=1 sagt der Test nichts über git; die statischen Listen sind der Wächter.
const GIT_PRUEFEN = process.env.JM_FUNKTIONSLISTE_GIT === '1';
const GIT_LISTE = GIT_PRUEFEN ? git(['diff', '--name-only', ERHEBUNG]) : null;
const GIT = GIT_LISTE === null ? null : new Set(GIT_LISTE.split('\n').filter((n) => n !== ''));
if (GIT_PRUEFEN && GIT === null) console.log(`SC Funktionsliste: kein git-Verlauf bis ${ERHEBUNG} (flacher Klon); die Prüfung gegen git entfällt`);

/** Datei in Backticks (Pfad mit Endung, optional mit Zeilen „:a-b“) oder nur Zeilen „:a-b“ zur zuletzt genannten Datei im Feld. */
const VERWEIS_DATEI = /`([A-Za-z0-9_./-]+\.(?:tsx|ts|css|html|json|md|mjs|png))(?::(\d+)(?:-(\d+))?)?`|`:(\d+)(?:-(\d+))?`/g;
/** Erlaubte Verweise: nur B1–B22 (Plan 2b). */
const VERWEIS = /\bB(?:[1-9]|1\d|2[0-2])\b/;
const FREMD = /\b(?:B(?:0|2[3-9]|[3-9]\d|\d{3,})|E\d+)\b/;

interface Zeile {
  abschnitt: number;
  teil: string;
  nr: number;
  zellen: string[];
}

function zeilen(text: string): Zeile[] {
  const liste: Zeile[] = [];
  let abschnitt = 0;
  let teil = '';
  for (const z of text.split('\n')) {
    const kopf = /^## (\d+) · /.exec(z);
    if (kopf) {
      abschnitt = Number(kopf[1]);
      teil = '';
      continue;
    }
    if (/^## /.test(z)) abschnitt = 0;
    const unter = /^### (\d[a-z]) · /.exec(z);
    if (unter) teil = unter[1];
    const nr = /^\|\s*(\d+)\s*\|/.exec(z);
    if (nr && abschnitt >= 1 && abschnitt <= 7) {
      liste.push({ abschnitt, teil, nr: Number(nr[1]), zellen: z.split('|').slice(1, -1).map((s) => s.trim()) });
    }
  }
  return liste;
}

/** Pfadregel der Liste: Repo-Wurzel (apps, packages, docs), `R/…` = src/renderer/src/…, sonst relativ zu apps/studio-control. */
function aufgeloest(pfad: string): string {
  if (/^(?:apps|packages|docs)\//.test(pfad)) return `../../${pfad}`;
  if (pfad.startsWith('R/')) return `src/renderer/src/${pfad.slice(2)}`;
  return pfad;
}

/** Kanonischer Pfad ab der Repo-Wurzel nach der Pfadregel der Liste. */
function kanon(pfad: string): string {
  const a = aufgeloest(pfad);
  return a.startsWith('../../') ? a.slice('../../'.length) : `apps/studio-control/${a}`;
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

const quelleCache = new Map<string, string>();
/** Inhalt einer Datei von heute (LF), leer, wenn es sie nicht gibt. */
function quelle(pfad: string): string {
  if (!quelleCache.has(pfad)) quelleCache.set(pfad, gibtEs(pfad) ? readFileSync(aufgeloest(pfad), 'utf8').replace(/\r\n/g, '\n') : '');
  return quelleCache.get(pfad) ?? '';
}
const zeilenZahl = (inhalt: string): number => (inhalt === '' ? 0 : inhalt.replace(/\n$/, '').split('\n').length);

const altCache = new Map<string, number>();
/** Zeilenzahl der Datei in der Erhebung (git); -1 ohne Verlauf oder ohne Datei. */
function altZeilen(pfad: string): number {
  if (!altCache.has(pfad)) {
    const inhalt = git(['show', `${ERHEBUNG}:${kanon(pfad)}`]);
    altCache.set(pfad, inhalt === null ? -1 : zeilenZahl(inhalt));
  }
  return altCache.get(pfad) ?? -1;
}

interface Verweis {
  datei: string;
  von?: number;
  bis?: number;
}

/** Alle Datei- und Zeilenverweise eines Felds; „:a-b“ allein gilt für die zuletzt genannte Datei. Ohne Datei davor: datei ''. */
function verweise(zelle: string): Verweis[] {
  const aus: Verweis[] = [];
  let letzte = '';
  for (const m of zelle.matchAll(VERWEIS_DATEI)) {
    if (m[1] !== undefined) {
      letzte = m[1];
      aus.push({ datei: m[1], ...(m[2] === undefined ? {} : { von: Number(m[2]), bis: Number(m[3] ?? m[2]) }) });
    } else {
      aus.push({ datei: letzte, von: Number(m[4]), bis: Number(m[5] ?? m[4]) });
    }
  }
  return aus;
}

/** Ort am Anfang des Texts: genau ein Eintrag des Ortsregisters, unmittelbar gefolgt von „ (“ (kein Präfix-Rückfall). */
function ortAm(text: string): string | undefined {
  return ORTE.find((o) => text.startsWith(`${o} (`));
}

/** Die Form des Hakens und, bei Ort und „ersetzt durch“, der Ort. */
function form(k: string): { form: 'unverändert' | 'entfällt' | 'ersetzt durch' | 'Ort'; ort?: string } | undefined {
  const rest = k.slice(2);
  if (rest.startsWith('unverändert (')) return { form: 'unverändert' };
  if (rest.startsWith('entfällt (')) return { form: 'entfällt' };
  if (rest.startsWith('ersetzt durch ')) {
    const ort = ortAm(rest.slice('ersetzt durch '.length));
    return ort === undefined ? undefined : { form: 'ersetzt durch', ort };
  }
  const ort = ortAm(rest);
  return ort === undefined ? undefined : { form: 'Ort', ort };
}

/** Datei- und Zeilenprüfung eines Felds mit Verweisen auf heutige Dateien; null = in Ordnung. */
function verweisFehler(feld: string): string | null {
  const vs = verweise(feld);
  if (vs.some((v) => v.datei === '')) return 'Zeilenangabe ohne Datei davor';
  const dateien = [...new Set(vs.map((v) => v.datei))];
  const fehlt = dateien.filter((d) => !gibtEs(d));
  if (fehlt.length > 0) return `Datei fehlt: ${fehlt.join(', ')}`;
  const ausserhalb = vs.filter((v) => v.von !== undefined && (v.von < 1 || (v.bis ?? 0) < v.von || (v.bis ?? 0) > zeilenZahl(quelle(v.datei))));
  if (ausserhalb.length > 0) return `Zeilen außerhalb der Datei: ${ausserhalb.map((v) => `${v.datei}:${v.von}-${v.bis}`).join(', ')}`;
  return null;
}

/** null = Zeile abgehakt; sonst der erste Grund, warum nicht. */
function zeilenFehler(z: Zeile): string | null {
  if (z.zellen.length !== 7) return `${z.zellen.length} statt 7 Spalten`;
  const k = z.zellen[6];
  if (!k.startsWith('✓ ')) return '„künftig wo“ ohne Haken';
  const ohneCode = k.replace(/`[^`]*`/g, '');
  if (ohneCode.includes('"')) return 'ASCII-Anführungszeichen';
  if (FREMD.test(ohneCode)) return 'Verweis außerhalb von B1–B22';
  const f = form(k);
  if (f === undefined) return `Ort nicht aus dem Ortsregister: ${k.slice(2, 50)}`;
  if ((f.form === 'ersetzt durch' || f.form === 'entfällt') && !VERWEIS.test(ohneCode)) return `„${f.form}“ ohne B-Verweis`;
  if (/entf(?:ä|a)llt/.test(ohneCode) && !VERWEIS.test(ohneCode)) return '„entfällt“ im Text ohne B-Verweis';
  const dateien = [...new Set(verweise(k).map((v) => v.datei).filter((d) => d !== ''))];
  if (f.form !== 'entfällt' && dateien.length === 0) return 'Ort ohne Datei';
  const vf = verweisFehler(k);
  if (vf !== null) return vf;
  // „unverändert“ und „Tray (unverändert)“: nur Dateien, die seit der Erhebung gleich sind, oder erlaubte mit ihrem Verweis; eine
  // Datei, die ein Altfehler der Stufe geändert hat, nur mit „Altfehler <ID>“, dessen Liste sie nennt (R6).
  if (f.form === 'unverändert' || (f.ort !== undefined && UNVERAENDERT_ORTE.includes(f.ort))) {
    const ids = altfehlerIds(ohneCode);
    for (const d of dateien) {
      const kd = kanon(d);
      if (!GEAENDERT_KANON.has(kd) && GIT?.has(kd) !== true) continue;
      if (entlastet(ids, kd)) continue;
      if (ALTFEHLER_DATEIEN.has(kd)) return `unverändert mit ${d} ohne Altfehler-Verweis, dessen Liste sie nennt`;
      const refs = ERLAUBT.get(kd);
      if (refs === undefined) return `unverändert mit geänderter Datei ${d}`;
      if (!refs.some((r) => new RegExp(`\\b${r}\\b`).test(ohneCode))) return `unverändert mit ${d} ohne Verweis auf ${refs.join(' oder ')}`;
    }
  }
  return null;
}

const text = leseText(LISTE);
const alle = zeilen(text);
const kopfText = text.slice(0, text.indexOf('\n---\n'));

gleich(alle.length, GESAMT, 'SC Funktionsliste: 195 Zeilen in den Abschnitten 1–7 (Stand Task 14)');
gleich(
  JE_ABSCHNITT.map((_, i) => alle.filter((z) => z.abschnitt === i + 1).length),
  JE_ABSCHNITT,
  'SC Funktionsliste: Zeilen je Abschnitt wie in Task 14 (100/25/40/8/1/7/14)',
);
gleich(
  alle.map((z) => z.nr),
  alle.map((_, i) => i + 1),
  'SC Funktionsliste: Nummern fortlaufend ab 1',
);
gleich(
  Object.keys(TEILTABELLEN).map((t) => alle.filter((z) => z.teil === t).map((z) => z.nr)),
  Object.values(TEILTABELLEN).map(([von, bis]) => Array.from({ length: bis - von + 1 }, (_, i) => von + i)),
  'SC Funktionsliste: Abschnitt 4 mit den Teiltabellen 4a Tray (166–169), 4b Browser (170–172), 4c Ladescreen (173)',
);
ok(!text.replace(/`[^`]*`/g, '').includes('"') && !text.includes('\r'), 'SC Funktionsliste: keine ASCII-Anführungszeichen außerhalb von Code, kein CR');
ok(!FREMD.test(text.replace(/`[^`]*`/g, '')), 'SC Funktionsliste: in der ganzen Liste nur Verweise B1–B22 (kein E-Verweis)');
ok(ORTE.every((o) => kopfText.includes(o)) && !kopfText.includes('bleibt leer'), 'SC Funktionsliste: der Kopf nennt das Ortsregister und sagt nicht mehr „bleibt leer“');
gleich(REITER.map((r) => r.label), REITER_NAMEN, 'SC Funktionsliste: die Orte „Reiter …“ heißen wie die Tabs der Werkzeugleiste');
gleich(
  GERAETE,
  [STUDIO_TEXTE.geraet.tricaster, STUDIO_TEXTE.geraet.atem, STUDIO_TEXTE.geraet.obs, STUDIO_TEXTE.geraet.ptz, STUDIO_TEXTE.geraet.audio, STUDIO_TEXTE.licht.titel],
  'SC Funktionsliste: die Orte „Panel ‹Gerät›“ heißen wie die Geräte in STUDIO_TEXTE (Statusleiste, Sperrgründe)',
);
{
  const karte: Array<[string, string]> = [
    ['R/components/video/TricasterPanel.tsx', 'tricaster'],
    ['R/components/video/AtemPanel.tsx', 'atem'],
    ['R/components/video/ObsPanel.tsx', 'obs'],
    ['R/components/video/PtzPanel.tsx', 'ptz'],
    ['R/components/audio/AudioPanel.tsx', 'audio'],
    ['R/components/lighting/LichtPanel.tsx', 'licht'],
  ];
  ok(karte.every(([d, k]) => quelle(d).includes(`data-panel="${k}"`)), 'SC Funktionsliste: zu jedem Ort „Panel ‹Gerät›“ gibt es die Karte mit data-panel');
}
gleich(ABSCHNITTE, [REMOTE_TEXTE.titel], 'SC Funktionsliste: der Ort „Panel ‹Abschnitt›“ heißt wie der Abschnitt Fernsteuerung im Panel (Browser-Zugang ist neu, ohne Zeile der Erhebung)');

for (const z of alle) {
  const f = zeilenFehler(z);
  ok(f === null, `SC Funktionsliste Nr. ${z.nr} abgehakt${f === null ? '' : ` – ${f}`}`);
}

// ── Spalten 1–6: jede genannte Datei gibt es heute oder ist seit der Erhebung gelöscht; „heute wo“ bleibt beim Stand der Erhebung ──
{
  const fehlt: string[] = [];
  const zeilenFalsch: string[] = [];
  for (const z of alle) {
    for (const zelle of z.zellen.slice(0, 6)) {
      for (const v of verweise(zelle)) {
        if (v.datei === '') fehlt.push(`Nr. ${z.nr}: Zeilenangabe ohne Datei`);
        else if (!gibtEs(v.datei) && !GELOESCHT.includes(v.datei)) fehlt.push(`Nr. ${z.nr}: ${v.datei}`);
        else if (GIT_PRUEFEN && v.bis !== undefined) {
          const n = altZeilen(v.datei);
          if (n >= 0 && v.bis > n) zeilenFalsch.push(`Nr. ${z.nr}: ${v.datei}:${v.bis} > ${n}`);
        }
      }
    }
  }
  ok(fehlt.length === 0, `SC Funktionsliste: jede in den Spalten 1–6 genannte Datei gibt es oder sie ist gelöscht (fehlt: ${fehlt.join('; ') || 'nichts'})`);
  if (GIT_PRUEFEN) ok(zeilenFalsch.length === 0, `SC Funktionsliste: die Zeilenangaben der Spalten 1–6 liegen in den Dateien der Erhebung (${zeilenFalsch.join('; ') || 'alle'})`);
  ok(
    GELOESCHT.every((d) => !gibtEs(d)) && GELOESCHT.every((d) => !alle.some((z) => z.zellen[6]?.includes(`\`${d}`))),
    'SC Funktionsliste: die gelöschten Dateien (AppShell, ComingSoon, Topbar, lokale StatusPill) gibt es nicht mehr und kein Haken nennt sie',
  );
  const heuteWo = createHash('sha256').update(alle.map((z) => z.zellen[5]).join('\n')).digest('hex');
  gleich(heuteWo, HEUTE_WO_SHA256, 'SC Funktionsliste: „heute wo“ bleibt beim Stand der Erhebung (eine Spalte, ein Stand; heutige Zeilen stehen im Haken)');
  if (GIT_PRUEFEN) {
    const vorher = git(['show', `${LISTE_VORHER}:docs/ux/funktionslisten/studio-control.md`]);
    if (vorher !== null) {
      const alt = new Map(zeilen(vorher).map((z) => [z.nr, z.zellen] as const));
      const anders = alle.flatMap((z) =>
        z.zellen.slice(0, 6).flatMap((zelle, i) => (zelle === alt.get(z.nr)?.[i] || KORRIGIERT[z.nr]?.includes(i) === true ? [] : [`Nr. ${z.nr} Spalte ${i + 1}`])),
      );
      ok(anders.length === 0, `SC Funktionsliste: Spalten 1–6 gleich dem Stand ${LISTE_VORHER}, außer den Korrekturen in Task 19 (anders: ${anders.join(', ') || 'nichts'})`);
    }
  }
}

// ── Die Mengen der geänderten Dateien stimmen mit git überein (nur mit JM_FUNKTIONSLISTE_GIT=1 und Verlauf) ──
{
  if (GIT !== null) {
    const fehlend = [...GIT].filter((n) => n.startsWith('apps/studio-control/') && !GEAENDERT_KANON.has(n));
    ok(fehlend.length === 0, `SC Funktionsliste: GEAENDERT nennt alle seit ${ERHEBUNG} geänderten Dateien von apps/studio-control (fehlt: ${fehlend.join(', ') || 'nichts'})`);
    const zuviel = GEAENDERT.filter((n) => !GIT.has(n));
    ok(zuviel.length === 0, `SC Funktionsliste: GEAENDERT nennt keine Datei, die git nicht als geändert kennt (zu viel: ${zuviel.join(', ') || 'nichts'})`);
    const pakete = [...GIT].filter((n) => /^packages\/[^/]+\/src\//.test(n));
    const paketFehlt = pakete.filter((n) => !PAKETE_GEAENDERT.includes(n));
    const paketZuviel = PAKETE_GEAENDERT.filter((n) => !GIT.has(n));
    ok(paketFehlt.length === 0 && paketZuviel.length === 0, `SC Funktionsliste: PAKETE_GEAENDERT gleich den geänderten Quelldateien der Pakete (fehlt: ${paketFehlt.join(', ') || 'nichts'}; zu viel: ${paketZuviel.join(', ') || 'nichts'})`);
    // R/App.tsx steht in ERLAUBT (B15): der Socket-Effekt (Bedingung, connect und switch) ist zeichengleich mit der Erhebung.
    const effekt = (s: string): string => s.slice(s.indexOf("if (!token && !window.jms?.isElectron)"), s.indexOf('return () => {'));
    const appAlt = git(['show', `${ERHEBUNG}:apps/studio-control/src/renderer/src/App.tsx`]);
    if (appAlt !== null) {
      const ohneLauf = (s: string): string => s.replace(/onConnectionChange: \(verbunden\) => \{\n\s*setConnected\(verbunden\);\n[^\n]*\n\s*\},/, 'onConnectionChange: setConnected,');
      ok(effekt(appAlt).length > 500 && ohneLauf(effekt(quelle('R/App.tsx'))) === effekt(appAlt), 'SC Funktionsliste: der Socket-Effekt in R/App.tsx ist bis auf die Lauf-Kennung (B15) zeichengleich mit der Erhebung');
    }
  }
  // Negativproben: eine geänderte Datei in jeder Schreibweise, eine erlaubte nur mit ihrem Verweis, eine unveränderte frei.
  const synth = (k: string): Zeile => ({ abschnitt: 3, teil: '', nr: 0, zellen: ['0', '', '', '', '', '', k] });
  ok(
    ['R/components/video/AtemPanel.tsx', 'src/renderer/src/components/video/AtemPanel.tsx', 'apps/studio-control/src/renderer/src/components/video/AtemPanel.tsx'].every((p) =>
      (zeilenFehler(synth(`✓ unverändert (\`${p}\`): x`)) ?? '').includes('geänderter Datei'),
    ) &&
      (zeilenFehler(synth('✓ unverändert (`R/App.tsx`, B2): x')) ?? '').includes('ohne Verweis auf B15') &&
      zeilenFehler(synth('✓ unverändert (`R/App.tsx`, B15): x')) === null &&
      zeilenFehler(synth('✓ unverändert (`src/main/auth/middleware.ts`): x')) === null &&
      (zeilenFehler(synth('✓ unverändert (`packages/ui/src/components/TallyButton.tsx`): x')) ?? '').includes('geänderter Datei'),
    'SC Funktionsliste: unverändert erkennt geänderte Dateien in jeder Schreibweise; B15 entlastet nur R/App.tsx; unveränderte Dateien sind frei',
  );
  // Altfehler-Stufe 1 (R6): „Altfehler <ID>“ entlastet eine geänderte Datei nur, wenn die Liste der ID sie nennt; nur mit dem Wort
  // „Altfehler“ und nur SC-S1 bis SC-S3. Für eine Datei aus einer Liste reicht B2 allein nicht mehr (sie bekam mehr als die Brücken).
  const ohneAltfehler = (k: string): boolean => (zeilenFehler(synth(k)) ?? '').includes('ohne Altfehler-Verweis');
  ok(
    ohneAltfehler('✓ unverändert (`src/main/index.ts`): x') &&
      ohneAltfehler('✓ unverändert (`src/main/index.ts`, B2): x') &&
      zeilenFehler(synth('✓ unverändert (`src/main/index.ts`, B2, Altfehler SC-S1): x')) === null &&
      zeilenFehler(synth('✓ unverändert (`src/main/auth/bootstrap.ts`, Altfehler SC-S1): x')) === null &&
      zeilenFehler(synth('✓ unverändert (`src/main/server.ts`, B2, Altfehler SC-S3): x')) === null &&
      zeilenFehler(synth('✓ unverändert (`src/main/gateway/control-gateway.ts`, B2, Altfehler SC-S3): x')) === null &&
      zeilenFehler(synth('✓ Tray (unverändert) (`src/main/index.ts`, B2, Altfehler SC-S1): x')) === null &&
      ohneAltfehler('✓ Tray (unverändert) (`src/main/index.ts`, B2): x') &&
      ohneAltfehler('✓ unverändert (`src/main/auth/bootstrap.ts`): x'),
    'SC Funktionsliste: „Altfehler SC-S1“ bzw. „SC-S3“ entlastet eine Datei aus der eigenen Liste; B2 allein entlastet sie nicht mehr',
  );
  ok(
    ohneAltfehler('✓ unverändert (`src/main/index.ts`, B2, Altfehler SC-S3): x') &&
      ohneAltfehler('✓ unverändert (`src/main/server.ts`, B2, Altfehler SC-S1): x') &&
      ohneAltfehler('✓ unverändert (`src/main/index.ts`, B2, Altfehler SC-S2): x') &&
      ohneAltfehler('✓ unverändert (`src/main/index.ts`, B2, SC-S1): x') &&
      ['SC-S4', 'SC-S10', 'SC-S1a', 'PL-N', 'SC-5'].every((id) => ohneAltfehler(`✓ unverändert (\`src/main/index.ts\`, B2, Altfehler ${id}): x`)) &&
      /mit src\/main\/server\.ts ohne/.test(zeilenFehler(synth('✓ unverändert (`src/main/index.ts`, `src/main/server.ts`, B2, Altfehler SC-S1): x')) ?? ''),
    'SC Funktionsliste: eine Altfehler-ID, deren Liste die Datei nicht nennt, ohne das Wort „Altfehler“ oder außerhalb von SC-S1 bis SC-S3 entlastet nichts; nennt ein Haken zwei Dateien, entlastet die ID nur die eigene (R6)',
  );
  ok(
    ALTFEHLER_DATEIEN.size > 0 && [...ALTFEHLER_DATEIEN].every((n) => GEAENDERT_KANON.has(n)) && [...ALTFEHLER.keys()].join() === 'SC-S1,SC-S2,SC-S3',
    `SC Funktionsliste: genau die IDs SC-S1 bis SC-S3, jede Datei einer Altfehler-Liste steht in GEAENDERT (nicht: ${[...ALTFEHLER_DATEIEN].filter((n) => !GEAENDERT_KANON.has(n)).join(', ') || 'nichts'})`,
  );
  if (GIT !== null) ok([...ALTFEHLER_DATEIEN].every((n) => GIT.has(n)), `SC Funktionsliste: jede Datei einer Altfehler-Liste ist laut git geändert (nicht: ${[...ALTFEHLER_DATEIEN].filter((n) => !GIT.has(n)).join(', ') || 'nichts'})`);
  ok(
    zeilenFehler(synth('✓ entfällt (x, B1)')) === null &&
      zeilenFehler(synth('✓ entfällt (x, B22)')) === null &&
      ['B0', 'B23', 'E15', 'E16', 'E2'].every((r) => (zeilenFehler(synth(`✓ entfällt (x, ${r})`)) ?? '').includes('Verweis außerhalb')) &&
      (zeilenFehler(synth('✓ entfällt (x)')) ?? '').includes('ohne B-Verweis') &&
      (zeilenFehler(synth('✓ ersetzt durch Panel ATEM (`R/components/video/AtemPanel.tsx`)')) ?? '').includes('ohne B-Verweis') &&
      (zeilenFehler(synth('✓ Panel ATEM (`R/components/video/AtemPanel.tsx`): Pille entfällt')) ?? '').includes('ohne B-Verweis'),
    'SC Funktionsliste: nur B1–B22 gelten (B0, B23 und jedes E nicht); entfällt und ersetzt brauchen einen B-Verweis',
  );
  ok(
    ['Panel', 'Panel Gibtsnicht', 'Reiter Video Foo', 'Reiter', 'Kopfleiste', 'Tray', 'Gerätepanel ATEM', 'Panel atem', 'Statusleiste Server'].every((o) =>
      (zeilenFehler(synth(`✓ ${o} (\`R/views/StudioOberflaeche.tsx\`): x`)) ?? '').includes('Ortsregister'),
    ) &&
      (zeilenFehler(synth('✓ ersetzt durch Panel (`R/views/Einstellungen.tsx`, B8): x')) ?? '').includes('Ortsregister') &&
      ORTE.every((o) => zeilenFehler(synth(`✓ ${o} (\`${UNVERAENDERT_ORTE.includes(o) ? 'src/main/auth/middleware.ts' : 'R/views/StudioOberflaeche.tsx'}\`): x`)) === null),
    'SC Funktionsliste: das Ortsregister ist streng (kein bloßes „Panel“, kein angehängtes Wort, Groß- und Kleinschreibung zählt); jeder Eintrag gilt',
  );
  ok(
    (zeilenFehler(synth('✓ Panel ATEM')) ?? '').includes('Ortsregister') &&
      (zeilenFehler(synth('✓ Panel ATEM (B16): x')) ?? '').includes('Ort ohne Datei') &&
      (zeilenFehler(synth('✓ Panel ATEM (`R/components/video/AtemPanel.tsx:900-901`)')) ?? '').includes('Zeilen außerhalb') &&
      (zeilenFehler(synth('✓ Panel ATEM (`R/components/video/Gibtsnicht.tsx`)')) ?? '').includes('Datei fehlt') &&
      (zeilenFehler(synth('✓ Panel ATEM (`r/components/video/AtemPanel.tsx`)')) ?? '').includes('Datei fehlt') &&
      (zeilenFehler(synth('✓ Kopf (`R/components/Topbar.tsx`): x')) ?? '').includes('Datei fehlt') &&
      (zeilenFehler(synth('✓ Panel ATEM (`:12-14`, `R/components/video/AtemPanel.tsx`)')) ?? '').includes('ohne Datei davor'),
    'SC Funktionsliste: Ort mit Datei, Zeilen in der Datei, Schreibweise wie im Repo, keine gelöschte Datei im Haken',
  );
}

/** Der ganze Renderer ohne Kommentare (Kommentare nennen alte Texte wie „Logout“ beim Namen). */
const rendererQuelle = (): string => rendererDateien().map((d) => ohneKommentare(quelle(`R/${d}`))).join('\n');

const zeile = (nr: number): Zeile | undefined => alle.find((z) => z.nr === nr);
const element = (nr: number): string => zeile(nr)?.zellen[2] ?? '';
const kuenftig = (nr: number): string => zeile(nr)?.zellen[6] ?? '';
const beginnt = (nr: number, ...orte: string[]): boolean => orte.some((o) => form(kuenftig(nr))?.form === 'Ort' && form(kuenftig(nr))?.ort === o);
const ersetzt = (nr: number, ort: string): boolean => form(kuenftig(nr))?.form === 'ersetzt durch' && form(kuenftig(nr))?.ort === ort;
const entfaellt = (nr: number): boolean => form(kuenftig(nr))?.form === 'entfällt';
const unveraendert = (nr: number): boolean => form(kuenftig(nr))?.form === 'unverändert';
const nennt = (nr: number, ...woerter: string[]): boolean => woerter.every((w) => kuenftig(nr).includes(w));
const mitVerweis = (nr: number, ...refs: string[]): boolean => refs.every((r) => new RegExp(`\\b${r}\\b`).test(kuenftig(nr).replace(/`[^`]*`/g, '')));

/** Der im Haken der Zeile für `datei` zitierte Bereich als Quelltext von heute; leer, wenn der Haken die Datei ohne Zeilen nennt. */
function zitiert(nr: number, datei: string): string {
  return verweise(kuenftig(nr))
    .filter((x) => x.datei === datei && x.von !== undefined && x.bis !== undefined)
    .map((v) => quelle(datei).split('\n').slice((v.von ?? 1) - 1, v.bis).join('\n'))
    .join('\n');
}
const zeigtAuf = (nr: number, datei: string, ...woerter: string[]): boolean => {
  const z = zitiert(nr, datei);
  return z !== '' && woerter.every((w) => z.includes(w));
};

// ── Pflichtzeilen Verben (Nr. 139–155): Companion-Befehle unverändert im Gateway (Port 8735), Rückmeldung STATE ──
{
  const gw = quelle('src/main/gateway/control-gateway.ts');
  const verben: Array<[number, string]> = [
    [140, "case 'atem_program'"],
    [141, "case 'atem_preview'"],
    [142, "case 'atem_cut'"],
    [143, "case 'atem_auto'"],
    [144, "case 'atem_ftb'"],
    [145, "case 'atem_record'"],
    [146, "case 'atem_stream'"],
    [147, "case 'obs_scene'"],
    [148, "case 'obs_record'"],
    [149, "case 'obs_stream'"],
    [150, "verb !== 'tricaster_shortcut'"],
    [151, "case 'ptz_preset'"],
    [152, "case 'ptz_power'"],
    [153, "case 'audio_mute'"],
    [154, "case 'audio_fader'"],
    [155, "verb !== 'lighting_blackout'"],
  ];
  const falsch = verben.filter(([nr, fall]) => !gw.includes(fall) || !unveraendert(nr) || !zeigtAuf(nr, 'src/main/gateway/control-gateway.ts', fall) || !mitVerweis(nr, 'B2'));
  ok(falsch.length === 0, `SC Funktionsliste Nr. 140–155 (Verben): jeder Haken unverändert mit B2 und zeigt auf seinen Fall im Gateway (falsch: ${falsch.map(([n]) => n).join(', ') || 'keine'})`);
  ok(
    gw.includes('export const CONTROL_PORT = 8735;') && quelle('src/shared/fernsteuerung.ts').includes('export const STEUER_PORT = 8735;') && unveraendert(139) && zeigtAuf(139, 'src/main/gateway/control-gateway.ts', 'function buildState'),
    'SC Funktionsliste Nr. 139: Port 8735 und die STATE-Rückmeldung bleiben, der Haken zeigt auf buildState',
  );
  ok(
    beginnt(138, 'Statusleiste') && mitVerweis(138, 'B2') && zeigtAuf(138, 'src/main/gateway/control-gateway.ts', 'onStatus', 'server.start(CONTROL_PORT)') && nennt(138, 'Panel Fernsteuerung'),
    'SC Funktionsliste Nr. 138: das Gateway ist jetzt als Eintrag Fernsteuerung sichtbar (Meldung aus onStatus, B2), Start auf CONTROL_PORT wie bisher',
  );
}

// ── Pflichtzeilen Tastatur (Nr. 175–180): keine neuen Kürzel (B1), Standardmenü, Halten per Taste über den Baustein ──
{
  const renderer = rendererQuelle();
  ok(
    !/addEventListener\(\s*'key/.test(renderer) && !renderer.includes('onKeyDown') && !renderer.includes('shortcut=') && beginnt(175, 'Werkzeugleiste') && mitVerweis(175, 'B1') && nennt(175, 'keine eigenen Kürzel'),
    'SC Funktionsliste Nr. 175: weiter keine eigenen Kürzel im Renderer (kein Tastenhörer, kein shortcut an Tasten, B1)',
  );
  const main = readdirSync('src/main', { recursive: true })
    .map((d) => String(d).replace(/\\/g, '/'))
    .filter((d) => d.endsWith('.ts'))
    .map((d) => quelle(`src/main/${d}`))
    .join('\n');
  ok(!main.includes('setApplicationMenu') && !main.includes('globalShortcut'), 'SC Funktionsliste Nr. 176: weiter kein eigenes Menü und kein globalShortcut im Main (Electron-Standardmenü)');
  ok(
    zeile(176)?.zellen[1] === 'Kürzel' && unveraendert(176) && mitVerweis(176, 'B2') && ['Standardmenü', 'Strg+R', 'Strg+W', 'Panel'].every((w) => kuenftig(176).includes(w)) && zeigtAuf(176, 'src/main/index.ts', 'new BrowserWindow', 'autoHideMenuBar'),
    'SC Funktionsliste Nr. 176 (Pflichtzeile Standardmenü): abgehakt mit Strg+R und Strg+W, der Haken zeigt auf das Hauptfenster',
  );
  ok(beginnt(177, 'Anmeldung') && zeigtAuf(177, 'R/views/Login.tsx', 'onSubmit={submit}'), 'SC Funktionsliste Nr. 177: Enter im Feld sendet weiter das Formular (Anmeldung)');
  ok(
    beginnt(178, 'Werkzeugleiste') && nennt(178, 'Enter', 'TallyButton') && mitVerweis(178, 'B16') && quelle('packages/ui/src/components/TallyButton.tsx').includes("e.key === 'Enter' && e.repeat"),
    'SC Funktionsliste Nr. 178: Leertaste und Enter auf Knöpfen; die Haupttasten (TallyButton) lösen ein gehaltenes Enter nur einmal aus',
  );
  const ptz = ohneKommentare(quelle('R/components/video/PtzPanel.tsx'));
  ok(
    ptz.includes('<HalteKnopf') && !ptz.includes('HoldButton') && !ptz.includes('onPointerDown') && [59, 61, 62, 179].every((nr) => beginnt(nr, 'Panel PTZ') && nennt(nr, 'HalteKnopf') && mitVerweis(nr, 'B1', 'B16')),
    'SC Funktionsliste Nr. 59/61/62/179: Joystick, Zoom und Fokus halten über den HalteKnopf, auch per Leertaste oder Enter (B1, B16)',
  );
  ok(zeigtAuf(179, 'R/components/video/PtzPanel.tsx', '<HalteKnopf') && nennt(179, 'Leertaste', 'Enter') && nennt(59, 'h-12', 'genau einmal'), 'SC Funktionsliste Nr. 179: der Haken zeigt auf den Halte-Knopf, Höhe h-12, Loslassen genau einmal');
  // Nachtrag Task 19 (Ruling zu Bedenken 2, Global Constraint „Wahl ≠ Bewegung“): die Rollen-Auswahl ändert nur den Entwurf, erst
  // „Setzen“ ruft updateRole; Nr. 90 und 180 nennen den neuen Ablauf und zeigen auf Auswahl, Knopf und Zeilen-Bedienung.
  ok(
    [90, 180].every((nr) => beginnt(nr, 'Reiter Setup') && nennt(nr, '„Setzen“', 'Wahl ≠ Bewegung', 'Entwurf', 'Befund 9')) &&
      zeigtAuf(180, 'R/components/setup/UserManager.tsx', 'onChange={(e) => zeile.waehlen(', 'onClick={() => void zeile.setzen()}') &&
      zeigtAuf(90, 'R/components/setup/UserManager.tsx', 'export function rollenZeile', 'a.updateRole(id, gesendet)', 'async function updateRole') &&
      !/onChange={(e) => updateRole/.test(ohneKommentare(quelle('R/components/setup/UserManager.tsx'))),
    'SC Funktionsliste Nr. 90/180: die Rollen-Auswahl wählt nur in den Entwurf, erst „Setzen“ ändert die Rolle (Wahl ≠ Bewegung, Befund 9 erledigt)',
  );
}

// ── Pflichtpunkt Panel-Tasten (Nr. 181, O1): Feld behält Tasten, Leertaste auf Knopf/Schalter geht ans Tool, Escape schließt ──
{
  ok(
    zeile(181)?.zellen[1] === 'Panel-Tasten' && beginnt(181, 'Panel Fernsteuerung') && ['Leertaste', 'Escape', 'Feld', 'Knopf', 'Schalter', 'O1'].every((w) => kuenftig(181).includes(w)) && mitVerweis(181, 'B8'),
    'SC Funktionsliste Nr. 181 (Pflichtpunkt Panel-Tasten): Leertaste und Escape, je für Feld und Knopf/Schalter (Spec 10, O1)',
  );
  const panel = quelle('packages/ui/src/components/SettingsPanel.tsx');
  ok(panel.includes("e.key === 'Escape'") && panel.includes('defaultPrevented') && panel.includes("'SELECT'") && zeigtAuf(181, 'packages/ui/src/components/SettingsPanel.tsx', 'export function panelTaste'), 'SC Funktionsliste Nr. 181: SettingsPanel schließt mit Escape (nur ohne defaultPrevented), Felder samt Auswahl behalten ihre Tasten');
  const wurzel = quelle('R/views/StudioOberflaeche.tsx');
  ok(
    wurzel.includes('settings={benutzer !== null && mitEinstellungen(stand) ? <Einstellungen stand={stand} /> : undefined}') && !quelle('R/views/Einstellungen.tsx').includes('<Video'),
    'SC Funktionsliste Nr. 181: das Panel ist kein eigener Bildschirm (nur nach der Anmeldung und nur im Electron-Fenster), der Reiter bleibt gemountet',
  );
}

// ── Abläufe aus Abschnitt 3: Socket und Abos in der Wurzel, nicht im Panel (B8); Main unverändert bis auf die lesende Meldung (B2) ──
{
  const panel = ohneKommentare(quelle('R/views/Einstellungen.tsx'));
  ok(
    ['window.', 'useEffect', 'addEventListener', 'useApp(', 'useSession(', 'connect(', 'emitWithAck', 'useBrueckenWert('].every((w) => !panel.includes(w)),
    'SC Funktionsliste Abschnitt 3: Einstellungen.tsx hat keinen Zugriff auf window, keine Effekte, keinen Store, keinen Socket und kein Abo (B8)',
  );
  const app = ohneKommentare(quelle('R/App.tsx'));
  ok(
    (app.match(/connect\(resolveServerUrl\(\), token, \{/g) ?? []).length === 1 &&
      app.includes('if (!token && !window.jms?.isElectron)') &&
      app.includes('}, [token, setConnected, clearSession]);') &&
      rendererDateien().filter((d) => ohneKommentare(quelle(`R/${d}`)).includes('connect(resolveServerUrl()')).length === 1,
    'SC Funktionsliste Nr. 126: der Socket verbindet genau einmal in der Wurzel (R/App.tsx), auch vor der Anmeldung im Electron-Fenster',
  );
  const wurzel = ohneKommentare(quelle('R/views/StudioOberflaeche.tsx'));
  ok(
    (wurzel.match(/useBrueckenWert\(MASTER_LINK_QUELLE\)/g) ?? []).length === 1 &&
      (wurzel.match(/useBrueckenWert\(FERNSTEUERUNG_QUELLE\)/g) ?? []).length === 1 &&
      rendererDateien().filter((d) => ohneKommentare(quelle(`R/${d}`)).includes('useBrueckenWert(')).length === 1,
    'SC Funktionsliste Nr. 138/163: Master-Link und Fernsteuerung je genau einmal in der Wurzel-View abonniert, auch bei geschlossenem Panel',
  );
  ok(beginnt(126, 'Statusleiste') && mitVerweis(126, 'B15') && zeigtAuf(126, 'R/App.tsx', 'naechsterServerStand', 'connect(resolveServerUrl(), token, {'), 'SC Funktionsliste Nr. 126: der Haken zeigt auf den Socket-Effekt mit Lauf-Kennung (B15)');
  ok(
    [127, 128].every((nr) => unveraendert(nr) && mitVerweis(nr, 'B15')) && zeigtAuf(127, 'R/App.tsx', 'switch (event)', 'case EVENTS.USERS_STATE') && zeigtAuf(128, 'R/App.tsx', 'EVENTS.TRICASTER_STATUS'),
    'SC Funktionsliste Nr. 127/128: Stand vom Server und toter Zweig unverändert (App.tsx bekam nur Lauf-Kennung und Wurzel-View, B15)',
  );
  const mainUnveraendert = [1, 2, 3, 129, 130, 131, 132, 134, 135, 136, 137, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 164, 165, 173, 174, 176, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192];
  const nichtUnveraendert = mainUnveraendert.filter((nr) => !unveraendert(nr));
  ok(nichtUnveraendert.length === 0, `SC Funktionsliste Abschnitt 1/3/5/7: Fenster, Server, Rechte, Gateway-Verben, Treiber, Licht-Ausgabe, Start, Ende und Dateien laufen unverändert (nicht so: ${nichtUnveraendert.join(', ') || 'keine'})`);
  ok(
    [163, 125].every((nr) => beginnt(nr, 'Statusleiste') && mitVerweis(nr, 'B2')) && zeigtAuf(163, 'src/preload/index.ts', 'jmps:master-link') && zeigtAuf(125, 'R/lib/oberflaeche.ts', 'export function fernsteuerungAbschnitt'),
    'SC Funktionsliste Nr. 125/163: Startfehler des Gateways und Master-Link stehen jetzt in der Statusleiste (B2)',
  );
}

// ── Zusatzfenster (Abschnitt 4): Tray unverändert, Browser ohne Brücken, Ladescreen unverändert ──
{
  const index = quelle('src/main/index.ts');
  ok(
    [166, 167, 168, 169].every((nr) => beginnt(nr, 'Tray (unverändert)') && nennt(nr, '`src/main/index.ts') && mitVerweis(nr, 'B2')) &&
      ["'Fenster verbergen' : 'Fenster anzeigen'", "label: 'LAN-URLs'", "label: 'JM Studio Control beenden'", 'tray.setToolTip(`JM Studio Control · :${SERVER_PORT}`)'].every((w) => index.includes(w)),
    'SC Funktionsliste Nr. 166–169: das Tray-Menü bleibt (src/main/index.ts bekam nur die lesende Meldung, B2)',
  );
  ok(zeigtAuf(167, 'src/main/index.ts', 'function rebuildTrayMenu') && zeigtAuf(168, 'src/main/index.ts', "label: 'LAN-URLs'") && zeigtAuf(169, 'src/main/index.ts', 'app.quit()'), 'SC Funktionsliste Nr. 167–169: die Haken zeigen auf das Tray-Menü');
  ok(
    [170, 171, 172].every((nr) => beginnt(nr, 'Browser')) &&
      zeigtAuf(170, 'R/lib/bruecken.ts', 'export function umgebung') &&
      zeigtAuf(172, 'R/lib/oberflaeche.ts', 'export function mitEinstellungen') &&
      nennt(172, 'kein ⚙', 'Master-Link', 'Fernsteuerung') &&
      mitVerweis(172, 'B15'),
    'SC Funktionsliste Nr. 170–172: im Browser derselbe Renderer, ohne ⚙, ohne Master-Link und Fernsteuerung (B15)',
  );
  ok(unveraendert(173) && nennt(173, '`packages/app-runtime/src/index.ts'), 'SC Funktionsliste Nr. 173: der Ladescreen der Laufzeit bleibt');
  ok(unveraendert(174) && mitVerweis(174, 'B5'), 'SC Funktionsliste Nr. 174: kein Ausgabefenster; die PGM-Vorschau bleibt eine Programmfläche (B5)');
}

// ── Rahmen, Anmeldung, Kopf und Werkzeugleiste (Task 17): jedes entfallene oder ersetzte Element hat seinen Ort mit Verweis ──
{
  const wurzel = quelle('R/views/StudioOberflaeche.tsx');
  const renderer = rendererQuelle();
  ok(
    beginnt(8, 'Anmeldung') && nennt(8, 'ON AIR', 'nach der Anmeldung', 'leere Statusleiste') && mitVerweis(8, 'B15') && zeigtAuf(8, 'R/views/StudioOberflaeche.tsx', 'status={benutzer === null ? [] : statusLeiste(stand)}'),
    'SC Funktionsliste Nr. 8: Anmeldung im Rahmen mit leerer Statusleiste, ohne ⚙ und ohne ON AIR (ON AIR erst nach der Anmeldung, B15)',
  );
  ok(
    wurzel.includes('onAir={benutzer === null ? undefined : kopfOnAir(stand)}') && ersetzt(12, 'Kopf') && mitVerweis(12, 'B3', 'B9', 'B15') && zeigtAuf(12, 'R/views/StudioOberflaeche.tsx', 'kopfOnAir(stand)') && nennt(12, '„Control“', 'ON AIR'),
    'SC Funktionsliste Nr. 12: Kopf aus AppShell, „Control“ entfällt (B9), ON AIR nur nach der Anmeldung bei gemessener Sendung (B3)',
  );
  ok(ersetzt(4, 'Kopf') && mitVerweis(4, 'B15') && nennt(4, 'pt-1.5', 'Statusleiste') && zeigtAuf(4, 'R/views/StudioOberflaeche.tsx', 'pt-1.5'), 'SC Funktionsliste Nr. 4: AppShell statt des eigenen Rahmens, Inhalt mit oberem Rand pt-1.5 (Tastenplatz, Task 18)');
  ok(ersetzt(13, 'Werkzeugleiste') && mitVerweis(13, 'B15') && zeigtAuf(13, 'R/views/Werkzeugleiste.tsx', '<Tabs items={REITER}'), 'SC Funktionsliste Nr. 13: die Reiter sind Tabs in der Werkzeugleiste (B15)');
  ok(
    entfaellt(14) && mitVerweis(14, 'B15') && ['Kumo', 'Coming soon', 'Geräte · Benutzer'].every((w) => kuenftig(14).includes(w)) && !renderer.includes('Coming soon') && !renderer.includes('TriCaster · PTZ · Kumo'),
    'SC Funktionsliste Nr. 14: die Reiter-Hinweise entfallen (B15), im Renderer steht keiner mehr',
  );
  ok(ersetzt(15, 'Statusleiste') && mitVerweis(15, 'B15') && nennt(15, 'unbekannt', 'getrennt') && zeigtAuf(15, 'R/lib/oberflaeche.ts', 'function serverItem') && !renderer.includes('SyncPill'), 'SC Funktionsliste Nr. 15: „Sync“/„Offline“ ist ersetzt durch den Eintrag Server der Statusleiste (B15)');
  ok(beginnt(16, 'Werkzeugleiste') && nennt(16, 'Bediener', 'Betrachter') && zeigtAuf(16, 'R/views/Werkzeugleiste.tsx', 'STUDIO_TEXTE.rolle[benutzer.rolle]'), 'SC Funktionsliste Nr. 16: Benutzer und Rolle (deutsch) rechts in der Werkzeugleiste');
  ok(ersetzt(17, 'Kopf') && mitVerweis(17, 'B4') && nennt(17, 'jm-theme') && !renderer.includes("'Light'") && !renderer.includes("'Dark'"), 'SC Funktionsliste Nr. 17: „Light“/„Dark“ ist ersetzt durch den ThemeToggle im Kopf, gemerkt in jm-theme (B4)');
  ok(
    ersetzt(18, 'Werkzeugleiste') && mitVerweis(18, 'B15') && nennt(18, '„Abmelden“', '/api/logout') && zeigtAuf(18, 'R/views/Werkzeugleiste.tsx', 'STUDIO_TEXTE.abmelden') && !renderer.includes('Logout'),
    'SC Funktionsliste Nr. 18: „Logout“ ist ersetzt durch „Abmelden“ in der Werkzeugleiste, dieselbe Anfrage (B15)',
  );
  ok(beginnt(79, 'Reiter Setup') && nennt(79, 'Tabs') && zeigtAuf(79, 'R/views/Setup.tsx', '<Tabs items={reiter}'), 'SC Funktionsliste Nr. 79: Setup bleibt Reiter, die Unterreiter sind Tabs');
  ok(
    [9, 10, 11, 113, 177].every((nr) => beginnt(nr, 'Anmeldung')) && zeigtAuf(11, 'R/views/Login.tsx', "apiFetch<{ token: string; user: SessionUser }>('/api/login'"),
    'SC Funktionsliste Nr. 9–11, 113, 177: Anmeldung mit denselben Feldern, derselben Anfrage und denselben Fehlertexten',
  );
  ok(beginnt(193, 'Werkzeugleiste') && mitVerweis(193, 'B4', 'B15') && nennt(193, 'jm-theme', 'Panel'), 'SC Funktionsliste Nr. 193: Abschnitt bleibt im Store (nicht gemerkt), Hell/Dunkel jetzt gemerkt (B4), Panel nicht gemerkt');
}

// ── Gerätepanels (Task 18) und die Festlegungen aus Task 16 bis 18: Haupttasten, Pillen, Server getrennt, TriCaster, Blackout ──
{
  const stand = (teil: Partial<OberflaechenStand>): OberflaechenStand => ({
    umgebung: 'electron',
    benutzer: { name: 'Admin', rolle: 'admin' },
    server: true,
    atem: undefined,
    obs: undefined,
    tricaster: { ids: ['t1'], status: { t1: { state: 'connected', recording: true, streaming: true } } },
    ptz: undefined,
    audio: undefined,
    licht: { node: true, blackout: false },
    masterLink: null,
    fernsteuerung: null,
    erstPasswort: null,
    ...teil,
  });
  const HAUPT: Record<number, string> = { 24: 'TriCaster', 25: 'TriCaster', 26: 'TriCaster', 27: 'TriCaster', 28: 'TriCaster', 41: 'ATEM', 42: 'ATEM', 43: 'ATEM', 44: 'ATEM', 45: 'ATEM', 52: 'OBS', 53: 'OBS', 73: 'Licht' };
  const falsch = Object.entries(HAUPT).filter(([nr, g]) => !beginnt(Number(nr), `Panel ${g}`) || !mitVerweis(Number(nr), 'B16') || !nennt(Number(nr), 'TallyButton'));
  ok(falsch.length === 0, `SC Funktionsliste Haupttasten (Nr. 24–28, 41–45, 52, 53, 73): im Gerätepanel als TallyButton nach B16 (falsch: ${falsch.map(([n]) => n).join(', ') || 'keine'})`);
  ok(
    [24, 41].every((nr) => nennt(nr, 'Rolle Betrachter darf nicht schalten')) && nennt(24, 'TriCaster unbekannt', 'TriCaster nicht verbunden') && nennt(41, 'ATEM unbekannt', 'ATEM nicht verbunden') && nennt(52, 'OBS unbekannt') &&
      STUDIO_TEXTE.grund.geraetUnbekannt('ATEM') === 'ATEM unbekannt' && STUDIO_TEXTE.grund.rolle('viewer') === 'Rolle Betrachter darf nicht schalten',
    'SC Funktionsliste Nr. 24/41/52: Sperrgründe Rolle vor Gerät, ohne Statusmeldung „‹Gerät› unbekannt“ (Task 16)',
  );
  ok(
    zeigtAuf(24, 'R/components/video/TricasterPanel.tsx', 'min-w-[120px]') && zeigtAuf(41, 'R/components/video/AtemPanel.tsx', 'min-w-[110px]') && zeigtAuf(52, 'R/components/video/ObsPanel.tsx', 'min-w-[120px]') && zeigtAuf(73, 'R/components/lighting/LichtPanel.tsx', 'min-w-[110px]'),
    'SC Funktionsliste Haupttasten: die Haken zeigen auf die Behälter mit der alten Mindestbreite (ATEM 110, TriCaster und OBS 120, Licht 110)',
  );
  ok(
    zeigtAuf(24, 'R/components/video/TricasterPanel.tsx', "'main_take'") && zeigtAuf(26, 'R/components/video/TricasterPanel.tsx', "'main_fade_to_black'") && zeigtAuf(27, 'R/components/video/TricasterPanel.tsx', "'record_toggle_start'") && zeigtAuf(28, 'R/components/video/TricasterPanel.tsx', "'streaming_toggle_start'"),
    'SC Funktionsliste Nr. 24–28: die TriCaster-Tasten senden dieselben Kürzel (der Haken zeigt auf HAUPT_KUERZEL)',
  );
  const tc = tricasterTasten(stand({}), 't1');
  ok(
    [27, 28].every((nr) => nennt(nr, STUDIO_TEXTE.taste.tricasterHinweis, 'nie live', 'fester Beschriftung') && mitVerweis(nr, 'B6')) &&
      tc.every((t) => t.state === 'bereit') &&
      tc.map((t) => t.label).join(' · ') === 'Take · Auto · Fade Black · REC · STREAM',
    'SC Funktionsliste Nr. 27/28: TriCaster REC/STREAM mit fester Beschriftung, nie live, Hinweis „REC und STREAM ohne Rückmeldung“ (B6)',
  );
  ok(
    [44, 45, 52, 53].every((nr) => mitVerweis(nr, 'B3') && nennt(nr, 'live', 'ON AIR')) && nennt(44, '● REC') && nennt(53, '„STREAM“'),
    'SC Funktionsliste Nr. 44/45/52/53: REC/STREAM bzw. Aufnahme/Stream live nur bei gemessener Sendung, dazu ON AIR (B3); der Punkt „● “ entfällt',
  );
  const betrachter = lichtTaste(stand({ benutzer: { name: 'Gast', rolle: 'viewer' } }));
  const ohneServer = lichtTaste(stand({ server: false }));
  ok(
    nennt(73, 'Rolle Betrachter darf nicht schalten', 'sichtbar', 'Zustand unbekannt', 'nie live') && mitVerweis(73, 'B6') && nennt(133, 'Blackout', 'sichtbar') &&
      betrachter?.state === 'gesperrt' && betrachter.disabledReason === 'Rolle Betrachter darf nicht schalten' &&
      ohneServer?.state === 'gesperrt' && ohneServer.disabledReason === STUDIO_TEXTE.grund.unbekannt &&
      lichtTaste(stand({ licht: { node: false, blackout: false } })) === undefined,
    'SC Funktionsliste Nr. 73/133: Blackout für Betrachter sichtbar und gesperrt, ohne Server gesperrt „Zustand unbekannt“, ohne Node weg',
  );
  ok(
    nennt(15, 'Gerätezustände', 'ON AIR') && zeigtAuf(15, 'R/lib/oberflaeche.ts', 's.server === true') &&
      gemeldet({ server: false }, 1) === undefined && gemeldet({ server: undefined }, 1) === undefined && gemeldet({ server: true }, 1) === 1,
    'SC Funktionsliste Nr. 15: ohne verbundenen Server gilt kein Gerätezustand als gemessen (Statusleiste unbekannt, kein ON AIR, Task 18)',
  );
  ok(
    nennt(39, 'ausgeblendet') && nennt(51, STUDIO_TEXTE.grund.unbekannt) && nennt(124, STUDIO_TEXTE.grund.unbekannt) && zeigtAuf(124, 'R/components/video/ObsPanel.tsx', 'STUDIO_TEXTE.grund.unbekannt'),
    'SC Funktionsliste Nr. 39/51/124: ohne Server ist die gemeldete Auswahl ausgeblendet, die OBS-Szenenzeile sagt „Zustand unbekannt“ (Task 18 Fix-Runde 1)',
  );
  const pillen: Array<[number, string]> = [
    [21, 'TriCaster'],
    [36, 'ATEM'],
    [48, 'OBS'],
    [56, 'PTZ'],
  ];
  ok(
    pillen.every(([nr, g]) => ersetzt(nr, `Panel ${g}`) && mitVerweis(nr, 'B16') && nennt(nr, 'StatusPill', 'unbekannt')) &&
      ersetzt(72, 'Panel Licht') && mitVerweis(72, 'B16') && nennt(72, 'an (ohne Rückmeldung)', 'unbekannt') &&
      beginnt(67, 'Reiter Audio') && nennt(67, 'StatusPill') &&
      !rendererQuelle().includes('@/components/ui/StatusPill'),
    'SC Funktionsliste Nr. 21/36/48/56/67/72: Pillen über StatusPill aus @jm/ui, ohne Meldung „unbekannt“, Licht „an (ohne Rückmeldung)“ (B16)',
  );
  ok(nennt(6, 'StatusPill') && mitVerweis(6, 'B16') && ersetzt(6, 'Panel TriCaster'), 'SC Funktionsliste Nr. 6: die lokale Pille ist gelöscht, Input, SectionHeader und Headline bleiben (B16)');
  ok(nennt(76, 'gemeldetem Blackout') && zeigtAuf(76, 'R/components/lighting/LichtPanel.tsx', 'blackout={blackoutGemeldet}'), 'SC Funktionsliste Nr. 76: Leuchten-Karten dimmen nur bei gemeldetem Blackout (Task 18 Fix-Runde 1)');
}

// ── Pflichtzeilen aus N2b 2.1 (✏️, ❌, ➕; Plan Teil 3): jede Zeile behält ihren Vermerk und ist abgehakt ──
{
  const n2b: Record<number, number[]> = {
    6: [24, 25, 26, 27, 28, 30, 31, 32, 34],
    7: [69, 70, 73],
    14: [138],
    16: [22, 33, 37, 46, 49, 54, 57, 66, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104],
    18: [14],
    19: [6],
    22: [8, 126],
    26: [4, 6],
    27: [21, 36, 48, 56, 67, 72],
    28: [120],
    29: [29],
    30: [182],
    31: [168],
    32: [7],
  };
  /** Nummern der Vermerke „N2b 2.1 Nr. …“ im Element, bis zur Klammer oder einem anderen N2b-Vermerk. */
  const vermerke = (el: string): Set<number> => {
    const s = new Set<number>();
    for (const m of el.matchAll(/N2b 2\.1(?!\d) Nr\.([^)]*?)(?=\)|N2b|$)/g)) for (const n of m[1].matchAll(/(?:^|[ ,])(\d+)\b/g)) s.add(Number(n[1]));
    return s;
  };
  const fehlt = Object.entries(n2b).flatMap(([n, nrs]) => nrs.filter((nr) => !vermerke(element(nr)).has(Number(n)) || zeilenFehler(zeile(nr) as Zeile) !== null).map((nr) => `${n}→${nr}`));
  ok(fehlt.length === 0, `SC Funktionsliste: jede Zeile aus N2b 2.1 mit ✏️, ❌ oder ➕ hat ihren Vermerk und ist abgehakt (fehlt: ${fehlt.join(', ') || 'nichts'})`);
  ok(/16 \(➕\) → 22, 33, 37, 46, 49, 54, 57, 66, 94 bis 104;/.test(kopfText) && /Korrekturen in Task 19[^\n]*Nr\. 99 und 100/.test(kopfText), 'SC Funktionsliste: der Kopf nennt die Zuordnung zu N2b 2.1 und die Korrektur an Nr. 99 und 100');
}

// ── Befunde 1–13 (Abschnitt 10): jeder ist abgeschlossen – erledigt, offen mit Ziel (→) oder überholt –, mit Beleg ──
{
  const teil = text.slice(text.indexOf('## 10 · Befunde'));
  const befunde = teil.split(/\n(?=\d+\. \*\*)/).filter((b) => /^\d+\. \*\*/.test(b));
  gleich(befunde.map((b) => Number(/^(\d+)\./.exec(b)?.[1])), Array.from({ length: 13 }, (_, i) => i + 1), 'SC Funktionsliste Befunde: 13 Befunde in Abschnitt 10');
  /** Der Stand eines Befunds in Teilen: jeder beginnt mit erledigt, überholt oder „offen →“ (Ziel), getrennt durch „; “. */
  const teile = (b: string): string[] | undefined => {
    const st = b.split('**Stand Task 19:**');
    return st.length === 2 ? st[1].trim().split(/; (?=(?:erledigt|offen|überholt)\b)/) : undefined;
  };
  const falsch = befunde.flatMap((b, i) => {
    const t = teile(b);
    if (t === undefined) return [`${i + 1} (kein oder mehr als ein Stand)`];
    if (!t.every((s) => /^(?:erledigt|überholt|offen →)/.test(s))) return [`${i + 1} (Teil ohne erledigt, überholt oder offen → Ziel)`];
    const s = t.join('; ');
    if (verweise(s).filter((v) => v.datei !== '').length === 0) return [`${i + 1} (ohne Beleg)`];
    const vf = verweisFehler(s);
    return vf === null ? [] : [`${i + 1} (${vf})`];
  });
  ok(falsch.length === 0, `SC Funktionsliste Befunde 1–13: jeder mit „Stand Task 19:“ erledigt, offen → Ziel oder überholt und mit Beleg (falsch: ${falsch.join(', ') || 'keine'})`);
  const status = (i: number): string[] => (teile(befunde[i - 1] ?? '') ?? []).map((s) => /^(erledigt|überholt|offen)/.exec(s)?.[1] ?? '');
  ok(
    [4, 6, 8, 12].every((i) => status(i).join() === 'offen') && [3, 9, 13].every((i) => status(i).join() === 'erledigt') && status(10).join() === 'erledigt,offen' && status(11).join() === 'erledigt,offen',
    'SC Funktionsliste Befunde: Loopback (4), Inventar (6), stille Fehler (8) und Tray (12) offen mit Ziel; Kopf (3), Wahl wirkt sofort (9, Nachtrag „Setzen“) und Simulation (13) erledigt; toter Code (10) und Gateway (11) teils erledigt, teils offen',
  );
  const b11 = befunde[10] ?? '';
  ok(
    /erledigt:[^;]*Altfehler SC-S3[^;]*control\.json/.test(b11) && !/liest „control\.json“ weiter nicht/.test(b11),
    'SC Funktionsliste Befund 11: das Lesen von control.json ist erledigt (Altfehler SC-S3), offen bleiben Schnittstellen, gatewayStatus() und TriCaster',
  );
}

// ── Altfehler SC-S1 und SC-S3 (Stufe 1): Erst-Zugang, Gateway und Laufzeit-Dateien nennen den Befund am richtigen Code ──
{
  ok(
    [134, 191].every((nr) => unveraendert(nr) && mitVerweis(nr, 'Altfehler SC-S1') && nennt(nr, 'Browser-Zugang')) &&
      zeigtAuf(191, 'src/main/auth/bootstrap.ts', 'export function erstPasswortDatei', 'const credentialsPath = erstPasswortDatei();') &&
      zeigtAuf(134, 'src/main/auth/bootstrap.ts', "const password = DEV_SEED ? 'Admin' : generatePassword();"),
    'SC Funktionsliste Nr. 134/191: Erst-Zugang und Datei first-run-credentials.txt wie bisher, ihren Ort nennt jetzt das Panel unter Browser-Zugang (Altfehler SC-S1)',
  );
  ok(
    beginnt(138, 'Statusleiste') && mitVerweis(138, 'B2', 'Altfehler SC-S3') && nennt(138, '„control.json“', '„secure“') && !nennt(138, 'Suite-Konfiguration nicht gelesen') &&
      zeigtAuf(138, 'src/main/gateway/control-gateway.ts', 'appDataDir,', 'onStatus', 'server.start(CONTROL_PORT)') &&
      zeigtAuf(138, 'src/main/server.ts', "startControlGateway(app.getPath('appData'), onMeldung)"),
    'SC Funktionsliste Nr. 138: das Gateway liest jetzt control.json (appDataDir aus server.ts), im Modus secure nur mit Schlüssel (Altfehler SC-S3)',
  );
  ok(
    unveraendert(192) && mitVerweis(192, 'B2', 'Altfehler SC-S3') && nennt(192, '„control.json“') && !nennt(192, 'liest Studio-Control weiter nicht'),
    'SC Funktionsliste Nr. 192: control.json liest jetzt das Gateway (Altfehler SC-S3); die übrigen Laufzeit-Dateien wie bisher',
  );
}

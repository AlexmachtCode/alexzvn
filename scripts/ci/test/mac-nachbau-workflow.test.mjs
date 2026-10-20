// Statischer Test für .github/workflows/mac-nachbau.yml (Mac-Nachbau, Entwurf mac-fassungen Stufe 1): nur Hand-Start,
// Rechte je Job, kein actions/checkout im Bau, Hochlade-Job ohne Code aus dem Repo, Eingaben nur über env, erlaubte Apps
// wie im Prüfer, feste Runner, x64 vor arm64, Beilagen-Namen wie im Sammler; dazu (R18–R21) der Prüfer im echten Lauf
// ohne --probe, kein Secret im Bau, die Konfiguration aus dem Tag nur geprüft und die Tag-Prüfung über den ganzen Text.
// Ohne js-yaml: Der Worktree hat kein node_modules, js-yaml liegt nur transitiv im Lockfile (electron-builder, astro),
// und der Test soll überall ohne npm ci laufen. Die Regeln lesen diese eine, von uns geschriebene Datei zeilenweise (Kommentarzeilen zählen nicht, CRLF egal).
// Jede Regel hat eine Gegenprobe: dieselbe Datei mit einem absichtlichen Fehler muss genau diesen Fehler melden.
//   node scripts/ci/test/mac-nachbau-workflow.test.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPS } from '../pruefe-mac-nachbau.mjs';
import { beilagenNamen } from '../sammle-ffmpeg-beilagen.mjs';

const hier = dirname(fileURLToPath(import.meta.url));
const original = readFileSync(join(hier, '..', '..', '..', '.github', 'workflows', 'mac-nachbau.yml'), 'utf8').replace(/\r\n/g, '\n');

let failures = 0;
function assert(cond, name) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

const tiefe = (z) => z.length - z.trimStart().length;
/** Zeilen unter Zeile i, die tiefer eingerückt sind als `ab` (Leerzeilen gehören dazu). */
function unter(zeilen, i, ab = tiefe(zeilen[i])) {
  const aus = [];
  for (let k = i + 1; k < zeilen.length && (zeilen[k].trim() === '' || tiefe(zeilen[k]) > ab); k++) aus.push(zeilen[k]);
  return aus;
}
const werte = (zeilen) => zeilen.map((z) => z.trim()).filter((z) => z !== '');
/** Inhalt aller run:-Schlüssel (Block mit | oder einzeilig). */
function runs(zeilen) {
  const aus = [];
  zeilen.forEach((z, i) => {
    const m = /^(\s*)(- )?run:\s*(.*)$/.exec(z);
    if (!m) return;
    if (m[3] !== '|' && m[3] !== '>') aus.push(m[3]);
    else aus.push(unter(zeilen, i, m[1].length + (m[2] ? 2 : 0)).join('\n'));
  });
  return aus;
}

/** Alle Regelverstöße einer Workflow-Datei. */
function pruefeWorkflow(text) {
  const fehler = [];
  const zeilen = text.replace(/\r\n/g, '\n').split('\n').filter((z) => !/^\s*#/.test(z));
  const oben = (name) => {
    const i = zeilen.indexOf(`${name}:`);
    return i < 0 ? [] : unter(zeilen, i);
  };

  const on = oben('on');
  const ausloeser = werte(on.filter((z) => tiefe(z) === 2));
  if (ausloeser.join() !== 'workflow_dispatch:') fehler.push(`R1 Auslöser: nur workflow_dispatch, gefunden ${ausloeser.join(' ') || 'keiner'}`);
  const eingabe = (name) => {
    const i = on.indexOf(`      ${name}:`);
    return i < 0 ? {} : Object.fromEntries(werte(unter(on, i)).map((z) => z.split(/:\s*/, 2)));
  };
  const eingaben = werte(on.filter((z) => tiefe(z) === 6));
  const tag = eingabe('tag');
  const probe = eingabe('probe');
  if (eingaben.join() !== 'tag:,probe:' || tag.required !== 'true' || tag.type !== 'string' || probe.type !== 'boolean' || probe.default !== 'true') {
    fehler.push('R2 Eingaben: genau tag (Pflicht, string) und probe (boolean, Vorgabe true)');
  }
  if (werte(oben('permissions')).join() !== 'contents: read') fehler.push('R3 oberste Rechte: nur contents: read');
  const apps = werte(oben('env')).find((z) => z.startsWith('ERLAUBTE_APPS:'))?.slice('ERLAUBTE_APPS:'.length).trim().split(/\s+/).sort() ?? [];
  if (apps.join() !== Object.keys(APPS).sort().join()) fehler.push(`R4 ERLAUBTE_APPS (${apps.join(' ')}) weicht von APPS im Prüfer ab (${Object.keys(APPS).join(' ')})`);

  const jobs = {};
  let job = null;
  for (const z of oben('jobs')) {
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(z);
    if (m) jobs[(job = m[1])] = [];
    else if (job) jobs[job].push(z);
  }
  if (Object.keys(jobs).join() !== 'bau,hochladen') fehler.push(`R5 Jobs: genau bau und hochladen, gefunden ${Object.keys(jobs).join(' ')}`);
  const rechte = (j) => {
    const i = (jobs[j] ?? []).indexOf('    permissions:');
    return i < 0 ? '' : werte(unter(jobs[j], i)).join();
  };
  const bau = jobs.bau ?? [];
  const hoch = jobs.hochladen ?? [];
  const bauText = bau.join('\n');
  const hochRuns = runs(hoch).join('\n');

  if (rechte('bau') !== 'contents: read') fehler.push('R6 bau: Rechte nur contents: read');
  if (/actions\/checkout/.test(bauText)) fehler.push('R7 bau: kein actions/checkout (Quellen per git init/fetch ohne Anmeldedaten)');
  const matrix = [...bauText.matchAll(/- art: (\S+)\n\s+runner: (\S+)/g)].map((m) => `${m[1]}=${m[2]}`).join();
  if (matrix !== 'arm64=macos-26,x64=macos-26-intel' || !bau.includes('    runs-on: ${{ matrix.runner }}') || /-latest/.test(bauText)
    || !bau.includes('      fail-fast: false')) {
    fehler.push(`R8 bau: Runner fest arm64=macos-26 und x64=macos-26-intel, nie -latest, fail-fast aus (gefunden ${matrix || 'keine Matrix'})`);
  }
  const bauRuns = runs(bau).join('\n');
  if (!bauRuns.includes('npx electron-builder --mac dmg "--$ART" --publish never') || !bauRuns.includes('node werkzeug/scripts/ci/pruefe-mac-nachbau.mjs')
    || !bauRuns.includes('node werkzeug/scripts/ci/sammle-ffmpeg-beilagen.mjs')) {
    fehler.push('R9 bau: electron-builder nur für die Job-Art, Prüfer und Sammler aus werkzeug/');
  }
  if ([...runs(zeilen).join('\n').matchAll(/>>\s*(\S+)/g)].some((m) => m[1] !== '"$GITHUB_OUTPUT"')) {
    fehler.push('R10 >> nur nach $GITHUB_OUTPUT (nichts an die Konfiguration aus dem Tag anhängen)');
  }

  if (!hoch.includes('    needs: bau') || !hoch.includes('    if: ${{ inputs.probe == false }}')) fehler.push('R11 hochladen: needs bau und nur bei probe=false');
  if (rechte('hochladen') !== 'contents: write') fehler.push('R12 hochladen: Rechte contents: write');
  const uses = hoch.filter((z) => /^\s*(- )?uses:/.test(z)).map((z) => z.trim().replace(/^- /, ''));
  if (uses.some((u) => u !== 'uses: actions/download-artifact@v4') || uses.length !== 2
    || /\b(npm|npx|node|git)\b|werkzeug|\.\/|\.mjs/.test(hochRuns)) {
    fehler.push('R13 hochladen: kein Code aus dem Repo (nur download-artifact und gh, kein git/npm/node)');
  }
  const uploads = hochRuns.split('\n').filter((z) => z.includes('gh release upload')).map((z) => z.trim());
  const upload = (was) => `gh release upload "$TAG" ${was} --repo "$GITHUB_REPOSITORY" --clobber`;
  if (uploads.join('\n') !== [upload('"${dmg_x64[0]}"'), upload('"${dmg_arm64[0]}"'), upload('"${beilagen[@]}"')].join('\n')) {
    fehler.push('R14 hochladen: erst x64-DMG, dann arm64-DMG, dann Beilagen, je ein gh release upload');
  }
  const namen = ['x64', 'arm64'].flatMap((a) => [beilagenNamen(a).lizenz, beilagenNamen(a).angaben].map((n) => `pakete/${a}/${n}`));
  if (!namen.every((n) => hochRuns.includes(n)) || !hochRuns.includes(`pakete/x64/${beilagenNamen('x64').quellen}`)) {
    fehler.push('R15 hochladen: Beilagen-Namen wie beilagenNamen() im Sammler');
  }
  if (!hochRuns.includes('gh release view') || /gh release (create|edit|delete)/.test(zeilen.join('\n'))) fehler.push('R16 Release muss existieren, nie anlegen');

  const eingabeZeilen = zeilen.filter((z) => z.includes('inputs.'));
  const erlaubt = (z) => /^\s+[A-Z][A-Z0-9_]*: \$\{\{ inputs\.(tag|probe) \}\}$/.test(z) || z === '    if: ${{ inputs.probe == false }}';
  if (!eingabeZeilen.every(erlaubt) || runs(zeilen).some((r) => r.includes('${{'))) fehler.push('R17 Eingaben nur über env, kein ${{ }} in run');

  // Im echten Lauf muss der Prüfer ohne --probe laufen: Nur dann bricht ein leerer Lesestand (oder ein Lauf ohne macOS) ab.
  const probeZeilen = bauRuns.split('\n').filter((z) => z.includes('--probe')).map((z) => z.trim());
  if (probeZeilen.join('\n') !== 'if [ "$PROBE" = "true" ]; then set -- --probe; else set --; fi' || !bau.includes('          PROBE: ${{ inputs.probe }}')
    || !bauRuns.includes('--lesestand werkzeug/scripts/ci/mac-nachbau-lesestand.json "$@"')) {
    fehler.push('R18 bau: Prüfer mit --probe nur bei probe=true, Lesestand aus werkzeug/');
  }
  if (/\bsecrets\.|github\.token/.test(bauText)) fehler.push('R19 bau: kein Secret und kein Token (dort läuft fremder Code aus npm ci)');
  const konfig = ['grep -q \'^electronVersion:\' "$cfg" ||', 'grep -q \'^npmRebuild: false\' "$cfg" ||', 'git diff --exit-code -- "$cfg"'];
  if (!konfig.every((k) => bauRuns.includes(k))) fehler.push('R20 bau: Konfiguration aus dem Tag wird geprüft (electronVersion, npmRebuild: false, unverändert), nicht ergänzt');
  // grep prüft zeilenweise: Ein Tag mit Zeilenumbruch bestand die Prüfung, und eine zweite Zeile app=… landete in
  // $GITHUB_OUTPUT (am Skript gemessen 20.10.2026; ob die API so ein Tag annimmt, ist ungeprüft). [[ =~ ]] prüft den
  // ganzen Text, in beiden Jobs.
  const alleRuns = runs(zeilen).join('\n');
  const zaehle = (s) => alleRuns.split(s).length - 1;
  if (zaehle("muster='^[a-z][a-z-]*-v[0-9]+\\.[0-9]+\\.[0-9]+$'") !== 2 || zaehle('if [[ ! "$TAG" =~ $muster ]]; then') !== 2
    || /\$TAG"?\s*\|\s*grep/.test(alleRuns)) {
    fehler.push('R21 Tag-Prüfung über den ganzen Text ([[ =~ ]]) in bau und hochladen, nie zeilenweise per grep');
  }
  return fehler;
}

/** Die Datei mit genau einer absichtlichen Änderung; null, wenn die Stelle nicht (genau einmal) vorkommt. */
function mutiere(alt, neu) {
  return original.split(alt).length === 2 ? original.replace(alt, neu) : null;
}
function gegenprobe(regel, alt, neu, name) {
  const text = mutiere(alt, neu);
  const f = text === null ? null : pruefeWorkflow(text);
  assert(f !== null && f.some((x) => x.startsWith(regel)), `${regel} Gegenprobe: ${name}${text === null ? ' (Stelle nicht gefunden)' : ''}`);
}

console.log('mac-nachbau.yml — Regeln:');
{
  const f = pruefeWorkflow(original);
  assert(f.length === 0, `W0: der Workflow hält alle Regeln ein${f.length ? ` (verletzt: ${f.join('; ')})` : ''}`);
  assert(f.length === 0 && pruefeWorkflow(original.replace(/\n/g, '\r\n')).length === 0, 'W0: dieselbe Datei mit CRLF (Windows-Checkout) ebenso');
}
console.log('mac-nachbau.yml — Gegenproben:');
gegenprobe('R1', '  workflow_dispatch:\n', '  push:\n    tags: ["editor-v*"]\n  workflow_dispatch:\n', 'Tag-Push als zweiter Auslöser');
gegenprobe('R2', '        default: true', '        default: false', 'probe mit Vorgabe false');
gegenprobe('R3', 'permissions:\n  contents: read\n\nenv:', 'permissions:\n  contents: write\n\nenv:', 'oberste Rechte write');
gegenprobe('R4', '  ERLAUBTE_APPS: editor', '  ERLAUBTE_APPS: editor titler', 'titler erlaubt, ohne Prüfer-Eintrag');
gegenprobe('R5', '  hochladen:\n', '  nebenbei:\n    runs-on: ubuntu-latest\n  hochladen:\n', 'dritter Job');
gegenprobe('R6','    permissions:\n      contents: read\n    steps:', '    permissions:\n      contents: write\n    steps:', 'bau mit Schreibrecht');
gegenprobe('R7', '      - uses: actions/setup-node@v5', '      - uses: actions/checkout@v5\n      - uses: actions/setup-node@v5', 'actions/checkout im bau');
gegenprobe('R8', '            runner: macos-26-intel', '            runner: macos-latest', 'Intel-Job auf macos-latest');
gegenprobe('R9', 'npx electron-builder --mac dmg "--$ART" --publish never', 'npx electron-builder --mac --publish never', 'electron-builder ohne Zielnamen und Art (baute beide DMGs)');
gegenprobe('R10', '          grep -q \'^npmRebuild: false\'', '          printf \'npmRebuild: false\\n\' >> "$cfg"\n          grep -q \'^npmRebuild: false\'', 'npmRebuild an die Konfiguration anhängen');
gegenprobe('R11', '    if: ${{ inputs.probe == false }}\n', '', 'hochladen auch im Probe-Lauf');
gegenprobe('R12', '    permissions:\n      contents: write', '    permissions:\n      contents: read', 'hochladen ohne Schreibrecht');
gegenprobe('R13', '          set -euo pipefail\n          muster=', '          set -euo pipefail\n          node werkzeug/scripts/ci/pruefe-mac-nachbau.mjs\n          muster=', 'node im Hochlade-Job');
gegenprobe('R14', 'gh release upload "$TAG" "${dmg_x64[0]}"', 'gh release upload "$TAG" "${dmg_arm64[0]}" "${dmg_x64[0]}"', 'beide DMGs in einem Aufruf, arm64 zuerst');
gegenprobe('R15', 'pakete/arm64/ffmpeg-mac-arm64.README.txt', 'pakete/arm64/ffmpeg-arm64.README.txt', 'Beilage anders benannt als im Sammler');
gegenprobe('R16', '>/dev/null 2>&1; then', '>/dev/null 2>&1 || gh release create "$TAG" --repo "$GITHUB_REPOSITORY"; then', 'Release anlegen, wenn es fehlt');
gegenprobe('R17', '          TAG: ${{ steps.tag.outputs.tag }}\n          REPO:', '          TAG: ${{ steps.tag.outputs.tag }}\n          X: ${{ inputs.tag }}-\n          REPO:', 'Eingabe als Teil eines env-Werts');
gegenprobe('R17', '          node werkzeug/scripts/ci/pruefe-mac-nachbau.mjs', '          echo "${{ inputs.tag }}"\n          node werkzeug/scripts/ci/pruefe-mac-nachbau.mjs', 'Eingabe direkt im run-Skript');
gegenprobe('R17', '        run: npm run build -w "@jm/$APP"', '        run: npm run build -w "@jm/${{ steps.tag.outputs.app }}"', 'Step-Ausgabe (aus der Eingabe) direkt im run-Skript');
gegenprobe('R18', 'then set -- --probe; else set --; fi', 'then set -- --probe; else set -- --probe; fi', 'Prüfer auch im echten Lauf mit --probe (leerer Lesestand ginge durch)');
gegenprobe('R19', '        run: npm run build -w "@jm/$APP"', '          JMPS_PROXY_KEY: ${{ secrets.JMPS_PROXY_KEY }}\n        run: npm run build -w "@jm/$APP"', 'Secret im Bau-Job (fremder Code aus npm ci läse es)');
gegenprobe('R20', '          grep -q \'^electronVersion:\' "$cfg" || { echo "::error::$cfg trägt kein electronVersion; dieser Workflow hängt nichts an."; exit 1; }\n', '', 'Prüfung auf electronVersion im Tag entfernt');
gegenprobe('R21', 'if [[ ! "$TAG" =~ $muster ]]; then\n            echo "::error::Tag „$TAG“ hat nicht die Form ‹App›-v‹Version›."',
  'if ! printf \'%s\' "$TAG" | grep -Eq "$muster"; then\n            echo "::error::Tag „$TAG“ hat nicht die Form ‹App›-v‹Version›."', 'Tag im Hochlade-Job zeilenweise per grep geprüft');

console.log(failures === 0 ? '\nAlle mac-nachbau-Workflow-Tests bestanden.' : `\n${failures} mac-nachbau-Workflow-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);

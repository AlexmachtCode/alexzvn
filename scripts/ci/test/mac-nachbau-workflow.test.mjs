// Statischer Test für .github/workflows/mac-nachbau.yml (Mac-Nachbau, Entwurf mac-fassungen Stufe 1): nur Hand-Start,
// Rechte je Job, kein actions/checkout im Bau, Hochlade-Job ohne Code aus dem Repo, Eingaben nur über env, erlaubte Apps
// wie im Prüfer, feste Runner, x64 vor arm64, Beilagen-Namen wie im Sammler; dazu (R18–R21) der Prüfer im echten Lauf
// ohne --probe, kein Secret im Bau, die Konfiguration aus dem Tag nur geprüft und die Tag-Prüfung über den ganzen Text;
// (R22–R26) ein Fehler von Prüfer oder Sammler beendet den Job, ein Secret nur für gh im Hochlade-Schritt, die
// Freigabeliste in beiden Jobs, und jede Prüfung im Skript bricht ab. R13 ist eine Positivliste der Befehle im Hochlade-Job.
// Seit der Gesamtprüfung (R28–R30): Werkzeug nur aus github.sha, Hochladen nur aus einem Lauf von main, Uploads nacheinander.
// Ohne js-yaml: Der Worktree hat kein node_modules, js-yaml liegt nur transitiv im Lockfile (electron-builder, astro),
// und der Test soll überall ohne npm ci laufen. Die Regeln lesen diese eine, von uns geschriebene Datei zeilenweise
// (CRLF egal). R1–R26 überspringen Zeilen, die mit # beginnen; YAML-Kommentare sind das nur außerhalb von Block-Werten.
// R27 liest darum den ganzen Text: In keiner solchen Zeile steht ${{, und in einem run-Block steht gar keine.
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
/** Inhalt aller run:-Schlüssel. Beginnt der Wert mit | oder >, ist er ein Block (|, |-, |+, >-, |2 …; ein einfacher
 *  YAML-Wert darf so nicht beginnen). Sonst zählen die tiefer eingerückten Folgezeilen mit: Auch ein einfacher oder
 *  angeführter Wert darf über mehrere Zeilen gehen. */
function runs(zeilen) {
  const aus = [];
  zeilen.forEach((z, i) => {
    const m = /^(\s*)(- )?run:\s*(.*)$/.exec(z);
    if (!m) return;
    const folge = unter(zeilen, i, m[1].length + (m[2] ? 2 : 0));
    aus.push((/^[|>]/.test(m[3]) ? folge : [m[3], ...folge]).join('\n'));
  });
  return aus;
}
/** Zeilen ohne Einrückung und ohne Leerzeilen, für Vergleiche über mehrere Zeilen. */
const trimmt = (t) => t.split('\n').map((z) => z.trim()).filter((z) => z !== '').join('\n');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Steht `block` (eine oder mehrere ganze Zeilen) im getrimmten Text? */
const steht = (t, block) => new RegExp(`^${esc(block)}$`, 'm').test(trimmt(t));
/** Wie oft auf `kopf` (eine oder mehrere Zeilen) eine ::error::-Meldung, exit 1 und fi folgen: eine Prüfung, die abbricht. */
function abbrueche(t, kopf) {
  return (trimmt(t).match(new RegExp(`^${esc(kopf)}\\necho "::error::[^\\n]*"\\nexit 1\\nfi$`, 'gm')) ?? []).length;
}
/** Befehle eines bash-Skripts, grob gelesen: Anführungstexte werden zu Q, Feld-Zuweisungen zu name=. Dann beginnt an
 *  jeder Befehlsstelle (Zeilenanfang, nach ; && || | &, nach if/then/else/elif/do/while/until, ! { ( und einem
 *  case-Muster) ein Stück, dessen Anfang der Befehl ist. $( ), Backticks und <( >( verbietet R13 vorher ganz. */
function befehle(skript) {
  let t = '';
  for (let i = 0; i < skript.length; i++) {
    const c = skript[i];
    if (c === "'") {
      const e = skript.indexOf("'", i + 1);
      i = e < 0 ? skript.length : e;
      t += 'Q';
    } else if (c === '"') {
      let k = i + 1;
      while (k < skript.length && skript[k] !== '"') k += skript[k] === '\\' ? 2 : 1;
      i = k;
      t += 'Q';
    } else if (c === '\\') {
      t += skript[i + 1] === '\n' ? ' ' : 'Q';
      i++;
    } else t += c;
  }
  t = t.replace(/\b([A-Za-z_]\w*)=\([^)]*\)/g, '$1=').replace(/[<>]&/g, '>');
  const aus = [];
  for (let s of t.split(/\n|;|&&|\|\||[|&]/)) {
    let alt;
    do {
      alt = s;
      s = s.trim().replace(/^(?:(?:if|then|else|elif|do|while|until)(?=\s|$)|[!{(]|[^\s()]*\))/, '');
    } while (s !== alt);
    if (s) aus.push(s);
  }
  return aus;
}
/** Was im Hochlade-Skript als Befehl stehen darf; alles andere (bash, sh, source, eval, curl, node, PATH=…) ist fremd. */
const HOCH_BEFEHLE = [/^set -euo pipefail$/, /^shopt -s nullglob$/, /^echo /, /^exit 1$/, /^\[ .* \]$/, /^\[\[ .* \]\]$/,
  /^cmp -s \S+ \S+$/, /^for [a-z_]+ in( \S+)+$/, /^case \S+ in$/, /^(fi|done|esac|\})$/, /^[a-z_][a-z0-9_]*=\S*$/,
  /^gh release (view|upload) /];
/** Verweis auf ein Secret oder das Token, auch in Klammer-Schreibweise. */
const GEHEIM = /\bsecrets\b|\bgithub\s*(?:\.|\[\s*['"])\s*token\b/i;

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
  // Positivliste: Dieser Job hat das Schreibrecht, und das Artefakt kommt aus einem Job, in dem fremder Code aus npm ci lief.
  const fremd = befehle(hochRuns).filter((b) => !HOCH_BEFEHLE.some((r) => r.test(b)));
  if (uses.some((u) => u !== 'uses: actions/download-artifact@v4') || uses.length !== 2
    || /\b(npm|npx|node|git)\b|werkzeug|\.\/|\.mjs/.test(hochRuns) || /\$\(|`|[<>]\(/.test(hochRuns) || fremd.length) {
    fehler.push('R13 hochladen: kein Code aus dem Repo oder dem Artefakt (nur download-artifact; Befehle nur set, shopt, echo, '
      + `exit 1, [ ], [[ ]], cmp, for, case, Zuweisungen und gh release view/upload)${fremd.length ? `, fremd: ${fremd.join(' | ')}` : ''}`);
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
  const releaseDa = 'if gh release view "$TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then\necho "Release $TAG gefunden."\nelse';
  if (abbrueche(hochRuns, releaseDa) !== 1 || /\bgh\s+(api|release\s+(create|edit|delete))\b/.test(zeilen.join('\n'))) {
    fehler.push('R16 Release muss existieren, sonst Abbruch; nie anlegen (kein gh release create/edit/delete, kein gh api)');
  }

  const eingabeZeilen = zeilen.filter((z) => z.includes('inputs.'));
  const erlaubt = (z) => /^\s+[A-Z][A-Z0-9_]*: \$\{\{ inputs\.(tag|probe) \}\}$/.test(z) || z === '    if: ${{ inputs.probe == false }}';
  if (!eingabeZeilen.every(erlaubt) || runs(zeilen).some((r) => r.includes('${{'))) fehler.push('R17 Eingaben nur über env, kein ${{ }} in run');

  // Im echten Lauf muss der Prüfer ohne --probe laufen: Nur dann bricht ein leerer Lesestand (oder ein Lauf ohne macOS) ab.
  const probeZeilen = bauRuns.split('\n').filter((z) => z.includes('--probe')).map((z) => z.trim());
  if (probeZeilen.join('\n') !== 'if [ "$PROBE" = "true" ]; then set -- --probe; else set --; fi' || !bau.includes('          PROBE: ${{ inputs.probe }}')
    || !bauRuns.includes('--lesestand werkzeug/scripts/ci/mac-nachbau-lesestand.json "$@"')) {
    fehler.push('R18 bau: Prüfer mit --probe nur bei probe=true, Lesestand aus werkzeug/');
  }
  if (bau.some((z) => GEHEIM.test(z))) fehler.push('R19 bau: kein Secret und kein Token (dort läuft fremder Code aus npm ci)');
  const bauT = trimmt(bauRuns);
  const konfig = [/^cfg="apps\/\$APP\/electron-builder\.yml"$/m, /^grep -q '\^electronVersion:' "\$cfg" \|\| \{ echo "::error::[^"\n]*"; exit 1; \}$/m,
    /^grep -q '\^npmRebuild: false' "\$cfg" \|\| \{ echo "::error::[^"\n]*"; exit 1; \}$/m, /^git diff --exit-code -- "\$cfg"$/m];
  if (!konfig.every((k) => k.test(bauT))) {
    fehler.push('R20 bau: Konfiguration aus dem Tag wird geprüft (electronVersion, npmRebuild: false, unverändert), sonst Abbruch; nicht ergänzt');
  }
  // grep prüft zeilenweise: Ein Tag mit Zeilenumbruch bestand die Prüfung, und eine zweite Zeile app=… landete in
  // $GITHUB_OUTPUT (am Skript gemessen 20.10.2026; ob die API so ein Tag annimmt, ist ungeprüft). [[ =~ ]] prüft den
  // ganzen Text, in jedem der beiden Jobs genau einmal, und bricht ab. Wer sie durch grep ersetzt, verliert den Block.
  const alleRuns = runs(zeilen).join('\n');
  const tagPruefung = "muster='^[a-z][a-z-]*-v[0-9]+\\.[0-9]+\\.[0-9]+$'\nif [[ ! \"$TAG\" =~ $muster ]]; then";
  if (abbrueche(bauRuns, tagPruefung) !== 1 || abbrueche(hochRuns, tagPruefung) !== 1) {
    fehler.push('R21 Tag-Prüfung über den ganzen Text ([[ =~ ]], nicht zeilenweise per grep) in bau und hochladen, je einmal und mit Abbruch');
  }
  // Ein Fehler von Prüfer oder Sammler muss den Bau-Job beenden: Sonst entsteht das Artefakt, und hochladen hängt ein
  // ungeprüftes Paket an (Prüfung Task 3, Runde 1, W1). shell: bash heißt bei GitHub bash -eo pipefail; ein || ist nur
  // als zweite Bedingung oder mit Abbruch erlaubt; kein Schritt im Bau wird übersprungen.
  const zeilenMit = (s) => bauT.split('\n').filter((z) => z.includes(s));
  const aufruf = (skript, letzte, ende) => {
    const a = zeilenMit(`werkzeug/scripts/ci/${skript}`);
    const e = zeilenMit(letzte);
    return a.length === 1 && a[0].startsWith(`node werkzeug/scripts/ci/${skript} `) && e.length === 1 && e[0].endsWith(ende);
  };
  const shells = werte(zeilen.filter((z) => /^\s*(- )?shell:/.test(z))).map((z) => z.replace(/^- /, ''));
  if (zeilen.some((z) => z.includes('continue-on-error')) || /(^|[\s;])set\s+\+/m.test(alleRuns)
    || /\|\|(?!\s*(?:\[ |\{ echo "::error::[^"\n]*"; exit 1; \}))/.test(alleRuns) || shells.some((s) => s !== 'shell: bash')
    || bau.some((z) => /^\s*(- )?if:/.test(z)) || !aufruf('pruefe-mac-nachbau.mjs', '--lesestand werkzeug/', '"$@"')
    || !aufruf('sammle-ffmpeg-beilagen.mjs', '--ziel ', '--ziel paket')) {
    fehler.push('R22 bau: Fehler von Prüfer und Sammler beenden den Job (kein continue-on-error, kein set +, kein || ohne Abbruch, '
      + 'nur shell: bash, kein if: im Bau, Aufrufe beginnen mit node und enden auf "$@" bzw. --ziel paket)');
  }
  // Das einzige Secret ist das Token für gh im Hochlade-Schritt. Ein Secret im obersten env erreichte auch npm ci im Bau.
  const tokenZeile = '          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}';
  if (zeilen.filter((z) => GEHEIM.test(z)).join('\n') !== tokenZeile || !hoch.includes(tokenZeile)
    || werte(oben('env')).some((z) => !z.startsWith('ERLAUBTE_APPS:'))) {
    fehler.push('R23 Secret nur als GH_TOKEN im Hochlade-Schritt, oberstes env nur ERLAUBTE_APPS');
  }
  const freigabe = (t) => (trimmt(t).match(new RegExp('^app="\\$\\{TAG%-v\\*\\}"\\n(?:version="\\$\\{TAG##\\*-v\\}"\\n)?'
    + 'case " \\$ERLAUBTE_APPS " in\\n\\*" \\$app "\\*\\) ;;\\n\\*\\) echo "::error::App „\\$app“ ist für den Nachbau nicht freigegeben'
    + '[^"\\n]*"; exit 1 ;;\\nesac$', 'gm')) ?? []).length;
  if (freigabe(bauRuns) !== 1 || freigabe(hochRuns) !== 1) fehler.push('R24 Freigabeliste ERLAUBTE_APPS in bau und hochladen geprüft, sonst Abbruch');
  const mengen = 'shopt -s nullglob\nfor art in x64 arm64; do\ndmgs=(pakete/$art/*.dmg)\nalle=(pakete/$art/*)\n'
    + 'if [ ${#dmgs[@]} -ne 1 ] || [ ${#alle[@]} -ne 4 ]; then';
  const dmgName = /^case "\$\{dmgs\[0\]\}" in\n\*"-\$version-mac-\$art\.dmg"\) ;;\n\*\) echo "::error::[^\n]*"; exit 1 ;;\nesac$/m;
  const beilage = 'for f in "${beilagen[@]}"; do\nif [ ! -s "$f" ]; then echo "::error::Beilage fehlt oder ist leer: $f"; exit 1; fi\ndone';
  if (abbrueche(hochRuns, mengen) !== 1 || !dmgName.test(trimmt(hochRuns)) || !steht(hochRuns, beilage)
    || abbrueche(hochRuns, 'if ! cmp -s pakete/x64/ffmpeg-QUELLEN.txt pakete/arm64/ffmpeg-QUELLEN.txt; then') !== 1) {
    fehler.push('R25 hochladen: je Art ein DMG und vier Dateien, DMG-Name mit Version und Art, Beilagen nicht leer, '
      + 'gleicher Quellen-Hinweis, sonst Abbruch');
  }
  if (!steht(bauRuns, "ist=$(node -p 'process.arch')") || abbrueche(bauRuns, 'if [ "$ist" != "$ART" ]; then') !== 1
    || abbrueche(bauRuns, 'ist=$(node -p "require(\'./apps/\' + process.env.APP + \'/package.json\').version")\nif [ "$ist" != "$VERSION" ]; then') !== 1) {
    fehler.push('R26 bau: Runner-Art (Node = Job-Art) und Version im Tag geprüft, sonst Abbruch');
  }
  // R1–R26 lesen `zeilen` ohne die Zeilen, die mit # beginnen. In einem run- oder anderen Block-Wert ist so eine Zeile
  // aber Text (mit js-yaml gemessen), und GitHub setzt ${{ }} darin ein, bevor bash ihn liest. In einem mehrzeiligen
  // Anführungstext ist sie nicht einmal ein bash-Kommentar: Nach dem schließenden " folgt ein Befehl, den R13 nie sähe
  // (Prüfung Task 3, Runde 2, W1). R27 liest darum den ungefilterten Text: ${{ in keiner solchen Zeile, auch nicht im
  // YAML-Kommentar, der es nicht braucht; in einem run-Block gar keine solche Zeile (Kommentare stehen über dem Schritt).
  const roh = text.replace(/\r\n/g, '\n').split('\n');
  const raute = (z) => /^\s*#/.test(z);
  if (roh.some((z) => raute(z) && z.includes('${{')) || runs(roh).some((r) => r.split('\n').some(raute))) {
    fehler.push('R27 Zeilen, die mit # beginnen: nie ${{ }} (in run- und Block-Werten setzt GitHub es ein), in run-Blöcken gar keine');
  }
  // Prüfer, Sammler, Lesestand und Hinweis kommen aus dem Commit dieses Workflows (github.sha), nie aus dem Tag: Für
  // editor-v0.5.0 fehlten sie dort und der Bau scheiterte sicher, ab Stufe 2 trügen neue Tags aber eigene, ältere
  // Fassungen (Gesamtprüfung, Befund 3). Nur die eine git-show-Zeile schreibt nach werkzeug/.
  const holeWerkzeug = 'git -c protocol.version=2 fetch -q --no-tags --depth=1 origin "$WERKZEUG_SHA"\nmkdir -p werkzeug/scripts/ci\n'
    + 'for f in pruefe-mac-nachbau.mjs sammle-ffmpeg-beilagen.mjs mac-nachbau-lesestand.json ffmpeg-quellen-hinweis.txt; do\n'
    + 'git show "$WERKZEUG_SHA:scripts/ci/$f" > "werkzeug/scripts/ci/$f"\ndone';
  const schreibtWerkzeug = bauT.split('\n').filter((z) => z.includes('werkzeug') && (z.includes('>') || /(^|\s)(cp|mv|ln|tee|install|rsync|curl|wget)\s/.test(z)));
  if (werte(bau.filter((z) => /^\s+WERKZEUG_SHA:/.test(z))).join('\n') !== 'WERKZEUG_SHA: ${{ github.sha }}' || !steht(bauRuns, holeWerkzeug)
    || schreibtWerkzeug.join('\n') !== 'git show "$WERKZEUG_SHA:scripts/ci/$f" > "werkzeug/scripts/ci/$f"'
    || !bauRuns.includes('--hinweis werkzeug/scripts/ci/ffmpeg-quellen-hinweis.txt --ziel paket')) {
    fehler.push('R28 bau: Prüfer, Sammler, Lesestand und Quellen-Hinweis nur aus github.sha nach werkzeug/, nie aus dem Tag; der Sammler liest den Hinweis von dort');
  }
  // Hochladen nur aus einem Lauf von main: Sonst nähme ein echter Lauf von einem Arbeitszweig Prüfer, Lesestand und
  // Hinweis aus diesem Zweig, ohne PR und Owner-OK (Gesamtprüfung, Befund 8). Schutz gegen Versehen, nicht gegen
  // Schreibrecht. Die Prüfung steht vor dem ersten gh-Aufruf, und kein env setzt eine GITHUB_-Variable.
  const nurMain = 'if [ "$GITHUB_REF" != "refs/heads/main" ]; then';
  if (abbrueche(hochRuns, nurMain) !== 1 || !(hochRuns.indexOf(nurMain) < hochRuns.indexOf('gh release'))
    || zeilen.some((z) => /^\s+GITHUB_[A-Z0-9_]*\s*:/.test(z))) {
    fehler.push('R29 hochladen: nur aus einem Lauf von main (GITHUB_REF vor dem ersten gh geprüft, sonst Abbruch; keine GITHUB_-Variable im env)');
  }
  // Zwei echte Läufe zugleich löschten sich per --clobber gegenseitig die Uploads (Gesamtprüfung, Befund 9). Feste Gruppe
  // ohne ${{ }}; ein laufender Upload wird nie abgebrochen, auch nicht über eine zweite concurrency-Angabe.
  const reihe = '    concurrency:\n      group: mac-nachbau-hochladen\n      cancel-in-progress: false';
  if (!hoch.join('\n').includes(reihe) || zeilen.filter((z) => z.includes('cancel-in-progress')).join('\n') !== '      cancel-in-progress: false') {
    fehler.push('R30 hochladen: concurrency mac-nachbau-hochladen, laufende Uploads nie abbrechen (kein cancel-in-progress: true)');
  }
  return fehler;
}

/** Die Datei mit absichtlichen Änderungen [alt, neu]; null, wenn eine Stelle nicht genau einmal vorkommt. */
function mutiere(paare) {
  let text = original;
  for (const [alt, neu] of paare) {
    if (text.split(alt).length !== 2) return null;
    text = text.replace(alt, () => neu);
  }
  return text;
}
/** alt/neu: eine Änderung; oder alt als Liste von Paaren [alt, neu] und neu leer, wenn ein Fehler zwei Stellen braucht. */
function gegenprobe(regel, alt, neu, name) {
  const text = mutiere(Array.isArray(alt) ? alt : [[alt, neu]]);
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
// Prüfung Task 3, Runde 1: Lücken W1 (Prüfer-Ergebnis, Secret oben) und K1 (Hochlade-Befehle, Blockköpfe, Abbrüche).
gegenprobe('R13', '          shopt -s nullglob\n', '          shopt -s nullglob\n          bash pakete/x64/ffmpeg-QUELLEN.txt\n', 'Inhalt aus dem Artefakt mit bash ausführen');
gegenprobe('R13', '          shopt -s nullglob\n', '          shopt -s nullglob\n          echo "$(sh pakete/x64/ffmpeg-QUELLEN.txt)"\n', 'Befehl in $( ) zwischen Anführungszeichen');
gegenprobe('R13', '          shopt -s nullglob\n', '          shopt -s nullglob\n          PATH="pakete/x64:$PATH"\n', 'PATH auf das Artefakt umbiegen (gh käme von dort)');
gegenprobe('R13', '            pakete/x64/ffmpeg-QUELLEN.txt\n          )', '            werkzeug/scripts/ci/ffmpeg-quellen-hinweis.txt\n          )', 'Hinweis aus dem Repo statt aus dem Bau-Artefakt');
gegenprobe('R16', '            echo "::error::Zum Tag $TAG gibt es kein Release; dieser Workflow legt keins an."\n            exit 1\n',
  '            gh api -X POST "repos/$GITHUB_REPOSITORY/releases" -f tag_name="$TAG"\n', 'Release per gh api anlegen statt abbrechen');
gegenprobe('R16', 'dieser Workflow legt keins an."\n            exit 1\n', 'dieser Workflow legt keins an."\n', 'fehlendes Release meldet nur');
gegenprobe('R16', '          gh release upload "$TAG" "${dmg_x64[0]}"', '          gh api -X PATCH "repos/$GITHUB_REPOSITORY/releases/tags/$TAG" -f draft=false\n          gh release upload "$TAG" "${dmg_x64[0]}"',
  'Release per gh api ändern');
gegenprobe('R17', '        run: npm run build -w "@jm/$APP"', '        run: |-\n          npm run build -w "@jm/${{ steps.tag.outputs.app }}"', 'Step-Ausgabe in einem Block run: |-');
gegenprobe('R17', '        run: npm run build -w "@jm/$APP"', '        run: npm run build\n          -w "@jm/${{ steps.tag.outputs.app }}"', 'Step-Ausgabe in der Folgezeile eines einfachen Werts');
gegenprobe('R20', 'trägt kein npmRebuild: false; dieser Workflow hängt nichts an."; exit 1; }', 'trägt kein npmRebuild: false; dieser Workflow hängt nichts an."; }',
  'Prüfung auf npmRebuild meldet nur und bricht nicht ab');
gegenprobe('R21', '          muster=\'^[a-z][a-z-]*-v[0-9]+\\.[0-9]+\\.[0-9]+$\'\n          if [[ ! "$TAG" =~ $muster ]]; then\n            echo "::error::Tag „$TAG“ hat nicht die Form ‹App›-v‹Version›."\n            exit 1\n          fi\n',
  '', 'Tag-Prüfung im Hochlade-Job ganz entfernt');
gegenprobe('R21', '(z. B. editor-v0.5.0)."\n            exit 1\n', '(z. B. editor-v0.5.0)."\n', 'Tag-Prüfung im Bau meldet nur und bricht nicht ab');
gegenprobe('R22', '      - name: Prüfen (ein DMG dieser Art, ffmpeg-Art, Lesestand, Laufzeitprobe, minos)\n',
  '      - name: Prüfen (ein DMG dieser Art, ffmpeg-Art, Lesestand, Laufzeitprobe, minos)\n        continue-on-error: true\n', 'Prüfer-Schritt mit continue-on-error');
gegenprobe('R22', '    timeout-minutes: 60\n', '    timeout-minutes: 60\n    continue-on-error: true\n', 'Bau-Job mit continue-on-error');
gegenprobe('R22', '--lesestand werkzeug/scripts/ci/mac-nachbau-lesestand.json "$@"', '--lesestand werkzeug/scripts/ci/mac-nachbau-lesestand.json "$@" || true', 'Prüfer-Aufruf mit || true');
gegenprobe('R22', '--ziel paket\n', '--ziel paket || true\n', 'Sammler-Aufruf mit || true');
gegenprobe('R22', 'npx electron-builder --mac dmg "--$ART" --publish never', 'npx electron-builder --mac dmg "--$ART" --publish never || true', 'electron-builder mit || true');
gegenprobe('R22', [['          node werkzeug/scripts/ci/sammle-ffmpeg-beilagen.mjs', '          if node werkzeug/scripts/ci/sammle-ffmpeg-beilagen.mjs'],
  ['--ziel paket\n', '--ziel paket; then :; fi\n']], '', 'Sammler in if (bash -e greift dort nicht)');
gegenprobe('R22', '          if [ "$PROBE" = "true" ]; then', '          set +e\n          if [ "$PROBE" = "true" ]; then', 'set +e vor dem Prüfer');
gegenprobe('R22', '      - name: ffmpeg-Lizenz und Build-Angaben einsammeln\n        shell: bash\n', '      - name: ffmpeg-Lizenz und Build-Angaben einsammeln\n        shell: bash {0}\n',
  'Sammler-Schritt mit bash ohne -e');
gegenprobe('R22', '      - name: Prüfen (ein DMG dieser Art, ffmpeg-Art, Lesestand, Laufzeitprobe, minos)\n',
  '      - name: Prüfen (ein DMG dieser Art, ffmpeg-Art, Lesestand, Laufzeitprobe, minos)\n        if: ${{ matrix.art == \'x64\' }}\n', 'Prüfer-Schritt im arm64-Job übersprungen');
gegenprobe('R22', '          node werkzeug/scripts/ci/pruefe-mac-nachbau.mjs', '          ! node werkzeug/scripts/ci/pruefe-mac-nachbau.mjs', 'Ergebnis des Prüfers mit ! umgekehrt');
// Anker ist die Leerzeile vor jobs:, nicht ERLAUBTE_APPS: Die Liste wächst mit Stufe 2.
gegenprobe('R23', '\n\njobs:\n', '\n  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n\njobs:\n', 'Secret im obersten env (erreicht auch npm ci im Bau)');
gegenprobe('R23', '\n\njobs:\n', '\n  NODE_OPTIONS: --require ./werkzeug/x.js\n\njobs:\n', 'zweite Variable im obersten env');
gegenprobe('R23', '    timeout-minutes: 15\n', '    timeout-minutes: 15\n    env:\n      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n', 'Token für den ganzen Hochlade-Job (auch download-artifact)');
gegenprobe('R23', [['          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n', ''],
  ['          CSC_IDENTITY_AUTO_DISCOVERY: "false"\n', '          CSC_IDENTITY_AUTO_DISCOVERY: "false"\n          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n']], '', 'Token im Bau statt im Hochlade-Job');
gegenprobe('R24', '          case " $ERLAUBTE_APPS " in\n            *" $app "*) ;;\n            *) echo "::error::App „$app“ ist für den Nachbau nicht freigegeben (erlaubt: $ERLAUBTE_APPS)."; exit 1 ;;\n          esac\n',
  '', 'Freigabeliste im Bau entfernt');
gegenprobe('R24', '          case " $ERLAUBTE_APPS " in\n            *" $app "*) ;;\n            *) echo "::error::App „$app“ ist für den Nachbau nicht freigegeben."; exit 1 ;;\n          esac\n',
  '', 'Freigabeliste im Hochlade-Job entfernt');
gegenprobe('R25', '            if [ ${#dmgs[@]} -ne 1 ] || [ ${#alle[@]} -ne 4 ]; then\n              echo "::error::Für $art genau ein DMG und vier Dateien erwartet, gefunden ${#dmgs[@]} DMG und ${#alle[@]} Dateien."\n              exit 1\n            fi\n',
  '', 'Mengenprüfung (ein DMG, vier Dateien) entfernt');
gegenprobe('R25', 'passt nicht zu Version $version und Art $art."; exit 1 ;;', 'passt nicht zu Version $version und Art $art." ;;', 'falscher DMG-Name meldet nur');
gegenprobe('R25', 'then echo "::error::Beilage fehlt oder ist leer: $f"; exit 1; fi', 'then echo "::warning::Beilage fehlt oder ist leer: $f"; fi', 'leere Beilage nur als Warnung');
gegenprobe('R25', '          if ! cmp -s pakete/x64/ffmpeg-QUELLEN.txt pakete/arm64/ffmpeg-QUELLEN.txt; then\n            echo "::error::Der Quellen-Hinweis der beiden Bau-Jobs ist verschieden."\n            exit 1\n          fi\n',
  '', 'Vergleich der Quellen-Hinweise entfernt');
gegenprobe('R26', '            echo "::error::Der Job für $ART läuft mit Node für $ist."\n            exit 1\n', '            echo "::warning::Der Job für $ART läuft mit Node für $ist."\n', 'Runner-Art nur als Warnung');
gegenprobe('R26', '            echo "::error::apps/$APP/package.json nennt $ist, das Tag $VERSION."\n            exit 1\n', '            echo "::error::apps/$APP/package.json nennt $ist, das Tag $VERSION."\n',
  'falsche Version im Tag meldet nur');
gegenprobe('R26', '          ist=$(node -p \'process.arch\')', '          ist="$ART"', 'Runner-Art nicht gemessen, sondern gesetzt');
// Prüfung Task 3, Runde 2, W1: Zeilen, die mit # beginnen, in run- und Block-Werten (Q26, Q27 und Q29 der Prüfung).
gegenprobe('R27', '          version="${TAG##*-v}"\n', '          version="${TAG##*-v}"\n          # Tag aus der Eingabe: ${{ inputs.tag }} (geht nur über env ins Skript)\n',
  'Eingabe in einer bash-Kommentarzeile im Hochlade-Skript (GitHub setzt sie vor bash ein)');
gegenprobe('R27', '          echo "tag=$TAG" >> "$GITHUB_OUTPUT"\n', '          # gestartet mit ${{ inputs.tag }}\n          echo "tag=$TAG" >> "$GITHUB_OUTPUT"\n',
  'Eingabe in einer bash-Kommentarzeile im Tag-Schritt');
gegenprobe('R27', '          if [ "$PROBE" = "true" ]; then', '          # Schlüssel: ${{ secrets.JMPS_PROXY_KEY }}\n          if [ "$PROBE" = "true" ]; then',
  'Secret in einer bash-Kommentarzeile im Prüfer-Skript des Bau-Jobs');
gegenprobe('R27', '          PROBE: ${{ inputs.probe }}\n', '          PROBE: ${{ inputs.probe }}\n          NOTIZ: |\n            # ${{ secrets.JMPS_PROXY_KEY }}\n',
  'Secret in einer #-Zeile eines Block-Werts im env (kein run-Block)');
gegenprobe('R27', '          if gh release view "$TAG"', '          echo "Pakete:\n          # "; bash pakete/x64/ffmpeg-QUELLEN.txt; echo "\n          "\n          if gh release view "$TAG"',
  '#-Zeile in einem mehrzeiligen Anführungstext versteckt einen Befehl aus dem Artefakt (ohne ${{ }})');
// Gesamtprüfung, Befund 3: Werkzeug aus dem Tag statt aus github.sha blieb grün.
gegenprobe('R28', 'git show "$WERKZEUG_SHA:scripts/ci/$f"', 'git show "refs/tags/$TAG:scripts/ci/$f"', 'Prüfer, Sammler, Lesestand und Hinweis aus dem Tag statt aus github.sha');
gegenprobe('R28', '          WERKZEUG_SHA: ${{ github.sha }}', '          WERKZEUG_SHA: ${{ github.ref }}', 'Werkzeug vom Stand des Zweigs beim Holen statt vom gestarteten Commit');
gegenprobe('R28', '          echo "Prüfer, Sammler, Lesestand und Quellen-Hinweis aus $WERKZEUG_SHA"\n',
  '          git show "refs/tags/$TAG:scripts/ci/mac-nachbau-lesestand.json" > werkzeug/scripts/ci/mac-nachbau-lesestand.json\n'
  + '          echo "Prüfer, Sammler, Lesestand und Quellen-Hinweis aus $WERKZEUG_SHA"\n', 'Lesestand danach aus dem Tag überschrieben');
gegenprobe('R28', '--hinweis werkzeug/scripts/ci/ffmpeg-quellen-hinweis.txt', '--hinweis scripts/ci/ffmpeg-quellen-hinweis.txt', 'Quellen-Hinweis aus dem Quellbaum des Tags');
// Gesamtprüfung, Befund 8 (echter Lauf von einem Arbeitszweig) und 9 (zwei echte Läufe zugleich).
const nurMainBlock = '          if [ "$GITHUB_REF" != "refs/heads/main" ]; then\n'
  + '            echo "::error::Hochladen nur aus einem Lauf von main, gestartet wurde von $GITHUB_REF: Prüfer, Lesestand und Quellen-Hinweis kämen sonst aus einem Zweig ohne PR."\n'
  + '            exit 1\n          fi\n';
gegenprobe('R29', nurMainBlock, '', 'Prüfung auf main entfernt');
gegenprobe('R29', 'aus einem Zweig ohne PR."\n            exit 1\n', 'aus einem Zweig ohne PR."\n', 'Lauf von einem anderen Zweig meldet nur');
gegenprobe('R29', [[nurMainBlock, ''], ['          echo "Hochgeladen:', `${nurMainBlock}          echo "Hochgeladen:`]], '', 'Prüfung auf main erst nach den Uploads');
gegenprobe('R29', '          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n', '          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n          GITHUB_REF: refs/heads/main\n', 'GITHUB_REF im env auf main gesetzt');
gegenprobe('R30', '    concurrency:\n      group: mac-nachbau-hochladen\n      cancel-in-progress: false\n', '', 'concurrency im Hochlade-Job entfernt');
gegenprobe('R30', '      cancel-in-progress: false', '      cancel-in-progress: true', 'ein neuer Lauf bricht den laufenden Upload ab');
gegenprobe('R30', '\n\njobs:\n', '\n\nconcurrency:\n  group: mac-nachbau\n  cancel-in-progress: true\n\njobs:\n', 'oberste concurrency bricht laufende Läufe ab');

console.log(failures === 0 ? '\nAlle mac-nachbau-Workflow-Tests bestanden.' : `\n${failures} mac-nachbau-Workflow-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);

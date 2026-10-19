// Selbsttest für tools/pruefe-mac-paket.mjs (iveo-Paket, Spec 10.2; E39, EP7): nachgebaute release-Ordner in einem
// Temp-Ordner (nie ein Ordner namens release im Repo, .gitignore:6). Sauber → grün; die Gegenproben der Spec: mit
// zoom-bridge → rot, mit jm_ndi.node → rot, nur ein DMG → rot; dazu die Kommandozeile mit Exit 0, 1 und 2.
//   node apps/connect/test/pruefe-mac-paket.test.mjs
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pruefeMacPaket } from '../tools/pruefe-mac-paket.mjs';

const hier = dirname(fileURLToPath(import.meta.url));
const skript = join(hier, '..', 'tools', 'pruefe-mac-paket.mjs');

let failures = 0;
function assert(cond, name) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

/** Legt eine Datei samt Ordnern an. */
function datei(pfad, inhalt = '') {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}

const ordner = [];
/** Ein Mac-Bau wie von electron-builder (dmg arm64 + x64, EP7): zwei DMGs samt Beiwerk, zwei .app mit app.asar. */
function sauber() {
  const d = mkdtempSync(join(tmpdir(), 'jm-mac-paket-'));
  ordner.push(d);
  datei(join(d, 'JM Connect-0.3.0-mac-arm64.dmg'), 'dmg');
  datei(join(d, 'JM Connect-0.3.0-mac-x64.dmg'), 'dmg');
  datei(join(d, 'JM Connect-0.3.0-mac-arm64.dmg.blockmap'), 'x');
  datei(join(d, 'latest-mac.yml'), 'x');
  for (const m of ['mac-arm64', 'mac']) {
    const res = join(d, m, 'JM Connect.app', 'Contents', 'Resources');
    datei(join(res, 'app.asar'), 'asar');
    datei(join(res, 'icon.png'), 'png');
  }
  return d;
}
const lauf = (...args) => spawnSync(process.execPath, [skript, ...args], { encoding: 'utf8' });

try {
  console.log('pruefe-mac-paket — macOS ohne Zoom und ohne NDI:');
  {
    const d = sauber();
    const r = pruefeMacPaket(d);
    assert(r.ok && r.fehler.length === 0, 'P38 10.2: sauberer Bau (zwei DMGs arm64/x64, zwei .app ohne zoom-bridge und ohne jm_ndi.node) → in Ordnung');
    const k = lauf(d);
    assert(k.status === 0 && k.stdout.startsWith('pruefe-mac-paket: in Ordnung'), 'P38 10.2: Kommandozeile, sauberer Bau → Exit 0');
  }
  {
    const d = sauber();
    mkdirSync(join(d, 'mac-arm64', 'JM Connect.app', 'Contents', 'Resources', 'zoom-bridge'), { recursive: true });
    const r = pruefeMacPaket(d);
    assert(!r.ok && r.fehler.some((f) => f.startsWith('Ordner zoom-bridge im Mac-Paket:') && f.includes('mac-arm64')),
      'P38 10.2 Gegenprobe: Ordner zoom-bridge in der arm64-App → rot, mit Pfad');
    const k = lauf(d);
    assert(k.status === 1 && k.stderr.includes('pruefe-mac-paket: Ordner zoom-bridge im Mac-Paket:'),
      'P38 10.2: Kommandozeile mit zoom-bridge → Exit 1, Grund auf stderr');
  }
  {
    const d = sauber();
    datei(join(d, 'mac', 'JM Connect.app', 'Contents', 'Resources', 'bin', 'mac', 'jm_ndi.node'), 'addon');
    const r = pruefeMacPaket(d);
    assert(!r.ok && r.fehler.some((f) => f.startsWith('NDI-Addon im Mac-Paket') && f.includes('jm_ndi.node')),
      'P38 10.2 Gegenprobe: bin/mac/jm_ndi.node in der x64-App → rot (OF1 Variante A)');
  }
  {
    const d = sauber();
    rmSync(join(d, 'JM Connect-0.3.0-mac-x64.dmg'));
    const r = pruefeMacPaket(d);
    assert(!r.ok && r.fehler.includes('genau zwei DMGs erwartet, gefunden 1: JM Connect-0.3.0-mac-arm64.dmg.')
      && r.fehler.includes('genau ein DMG mit „x64“ im Namen erwartet, gefunden 0.'),
    'P38 10.2 Gegenprobe: nur ein DMG → rot (Zahl und fehlende Architektur)');
  }
  {
    const d = sauber();
    rmSync(join(d, 'JM Connect-0.3.0-mac-x64.dmg'));
    datei(join(d, 'JM Connect-0.3.0-mac-arm64-kopie.dmg'), 'dmg');
    const r = pruefeMacPaket(d);
    assert(!r.ok && r.fehler.length === 2 && r.fehler.includes('genau ein DMG mit „arm64“ im Namen erwartet, gefunden 2.'),
      'P38 10.2: zwei DMGs, beide arm64 → rot');
  }
  {
    const d = sauber();
    rmSync(join(d, 'mac'), { recursive: true });
    const r = pruefeMacPaket(d);
    assert(!r.ok && r.fehler.length === 1 && r.fehler[0] === 'genau zwei „JM Connect.app“ unter mac*/ erwartet, gefunden 1.',
      'P38 EP7: nur eine .app unter mac*/ → rot (sicherer Fehlschlag)');
  }
  {
    const r = pruefeMacPaket(join(tmpdir(), 'jm-mac-paket-gibt-es-nicht'));
    assert(!r.ok && r.fehler.length === 1 && r.fehler[0].startsWith('Ordner „'), 'P38 10.2: release-Ordner fehlt → rot');
    const k = lauf();
    assert(k.status === 2 && k.stderr.includes('Aufruf: node apps/connect/tools/pruefe-mac-paket.mjs <release-Ordner>'),
      'P38 10.2: Kommandozeile ohne Ordner → Exit 2 mit Aufruf');
  }
  {
    // Gesamtprüfung Befund 7 (EP7 „sicherer Fehlschlag“): Node löst das Hauptmodul über realpath auf, argv[1] nur mit resolve.
    // Über einen Ordner-Link (Junction unter Windows, Symlink sonst) aufgerufen, muss das Skript trotzdem prüfen, statt still
    // mit Exit 0 zu enden. Die Kopie liegt im Temp-Ordner; der Link wird zuerst einzeln entfernt (nie rekursiv durch ihn).
    const echt = mkdtempSync(join(tmpdir(), 'jm-mac-paket-skript-'));
    ordner.push(echt);
    copyFileSync(skript, join(echt, 'pruefe-mac-paket.mjs'));
    const linkOrdner = mkdtempSync(join(tmpdir(), 'jm-mac-paket-link-'));
    const link = join(linkOrdner, 'werkzeug');
    symlinkSync(echt, link, 'junction');
    try {
      const ohne = spawnSync(process.execPath, [join(link, 'pruefe-mac-paket.mjs')], { encoding: 'utf8' });
      const d = sauber();
      const mitZoom = sauber();
      mkdirSync(join(mitZoom, 'mac', 'JM Connect.app', 'Contents', 'Resources', 'zoom-bridge'), { recursive: true });
      const gut = spawnSync(process.execPath, [join(link, 'pruefe-mac-paket.mjs'), d], { encoding: 'utf8' });
      const schlecht = spawnSync(process.execPath, [join(link, 'pruefe-mac-paket.mjs'), mitZoom], { encoding: 'utf8' });
      assert(ohne.status === 2 && gut.status === 0 && gut.stdout.startsWith('pruefe-mac-paket: in Ordnung') && schlecht.status === 1,
        'Gesamt-Fix EP7: Aufruf über einen Ordner-Link → die Kommandozeile prüft (Exit 2 ohne Ordner, 0 sauber, 1 mit zoom-bridge), nie still Exit 0');
    } finally {
      unlinkSync(link);
      rmSync(linkOrdner, { recursive: true, force: true });
    }
  }
} finally {
  for (const d of ordner) rmSync(d, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAlle pruefe-mac-paket-Tests bestanden.' : `\n${failures} pruefe-mac-paket-Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);

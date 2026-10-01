#!/usr/bin/env node
// Baut das Einsatzpaket der Zoom-Bridge (README Abschnitt "Einsatzpaket").
//
//   npm run release:build    -w @jm/zoom-bridge   -> release\JM-Zoom-Bridge-<v>-win-x64.zip (OEFFENTLICH)
//   npm run release:komplett -w @jm/zoom-bridge   -> zusaetzlich ...-KOMPLETT-NICHT-VEROEFFENTLICHEN.zip
//
// ZWEI PAKETE, UND WARUM: das Repo ist oeffentlich, und die Weitergabe-Lizenz
// der Zoom-SDK-DLLs ist ungeklaert (Owner-Entscheidung 01.10.2026). Das
// oeffentliche Paket enthaelt darum KEINE einzige Datei aus <Zoom-SDK>\x64\bin
// - der WAECHTER unten bricht den Bau ab, wenn doch. Das Komplett-Paket
// enthaelt sie und wird NIE veroeffentlicht (der Name sagt es, und es liegt
// wie alles hier unter release\, das git ignoriert).
//
// Inhalt (beide Pakete, Komplett zusaetzlich mit den SDK-Dateien in bin\):
//   Zoom-Bridge starten.cmd   Doppelklick -> start.ps1 (reines ASCII)
//   start.ps1                 fragt ab, startet zoom-join.exe (UTF-8 MIT BOM, CRLF)
//   zoom-join.exe             die Steuerung als Node "Single Executable Application"
//   LIESMICH.txt              fuer den Operator (UTF-8 MIT BOM, CRLF)
//   bin\zoom-bridge.exe       FRISCH gebaut - siehe Pruefung unten
//   bin\Processing.NDI.Lib.x64.dll   die NDI-Laufzeit (liefert die Suite schon
//                                    in ihren oeffentlichen Installern mit)
//   LIZENZEN\Processing.NDI.Lib.Licenses.txt
//
// Die Quellen der Textdateien liegen in paket\, NICHT in release\: die
// Wurzel-.gitignore ignoriert jeden Ordner namens "release".
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');
const komplett = process.argv.includes('--komplett');

const version = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).version;
const name = `JM-Zoom-Bridge-${version}`;
const releaseDir = join(pkg, 'release');
const bau = join(releaseDir, '.bau');
const oeffentlich = join(releaseDir, name);
const komplettBasis = join(releaseDir, '.komplett');
const komplettOrdner = join(komplettBasis, name);
const zipOeffentlich = join(releaseDir, `${name}-win-x64.zip`);
const zipKomplett = join(releaseDir, `${name}-win-x64-KOMPLETT-NICHT-VEROEFFENTLICHEN.zip`);

// postject: der Wert, den Nodes SEA-Dokumentation fuer die Sicherung nennt.
const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const POSTJECT = 'postject@1.0.0-alpha.6';

function abbruch(msg) {
  console.error(`\n[release] ABBRUCH: ${msg}`);
  process.exit(1);
}
const schritt = (msg) => console.log(`[release] ${msg}`);

/** Startet ein Programm; bricht mit seiner Ausgabe ab, wenn es scheitert. */
function lauf(exe, args, opts = {}) {
  const r = spawnSync(exe, args, { encoding: 'utf8', ...opts });
  if (r.error) abbruch(`${exe} liess sich nicht starten: ${r.error.message}`);
  if (r.status !== 0) {
    abbruch(`${exe} ${args.join(' ')}\n  Rueckgabewert ${r.status}\n${r.stdout ?? ''}${r.stderr ?? ''}`);
  }
  return r;
}

/** Alle Dateien unter `dir`, rekursiv, als Pfade relativ zu `dir`. */
function dateienUnter(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) for (const q of dateienUnter(p)) out.push(join(e.name, q));
    else out.push(e.name);
  }
  return out;
}

/** Neueste Aenderungszeit unter `dir` (rekursiv). */
function neuesteAenderung(dir) {
  let max = 0;
  for (const f of dateienUnter(dir)) max = Math.max(max, statSync(join(dir, f)).mtimeMs);
  return max;
}

/**
 * Textdatei ins Paket schreiben: Zeilenenden CRLF, wahlweise mit BOM. Die
 * Quellen werden von git je nach core.autocrlf mit LF oder CRLF ausgecheckt -
 * normalisiert wird darum HIER, nicht im Repo.
 */
function textdatei(quelle, ziel, { bom, nurAscii = false }) {
  let t = readFileSync(quelle, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  if (nurAscii && /[^\x00-\x7F]/.test(t)) abbruch(`${quelle} muss reines ASCII sein (cmd.exe liest in der OEM-Codepage).`);
  writeFileSync(ziel, (bom ? '\uFEFF' : '') + t, 'utf8');
}

// Die Dateinamen in <Zoom-SDK 7.1.5.43953>\x64\bin, rekursiv, ohne Doppelte -
// fuer den Waechter, wenn ZOOM_SDK_DIR NICHT gesetzt ist. Erzeugt am
// 01.10.2026 aus dem echten SDK (153 Dateien, 152 verschiedene Namen). Ist
// ZOOM_SDK_DIR gesetzt, gilt stattdessen die ECHTE Liste aus dem SDK.
const SDK_NAMEN_7_1_5 = [
  "amd_ags_x64.dll", "annoter.dll", "aomagent.dll", "aomhost64.exe", "archival.pcm", "asproxy.dll",
  "avcodec_zm-61.dll", "avformat_zm-61.dll", "avutil_zm-59.dll", "cares.dll", "clap-high.pcm",
  "clap-medium.pcm", "clDNN64.dll", "cmmbiz.dll", "CmmBrowserEngine.dll", "Cmmlib.dll", "CptControl.exe",
  "CptInstall.exe", "CptShare.dll", "CptUwpCapture.dll", "crashrpt_lang.ini", "dingdong.pcm",
  "dingdong1.pcm", "directui_license.txt", "double_beep.pcm", "Droplet.pcm", "DuiLib.dll",
  "duilib_license.txt", "dvf.dll", "G Arpeggio.pcm", "G Step.pcm", "Gamelan.pcm", "leave.pcm", "libcml.dll",
  "libcrypto-3-zm.dll", "libcurl.dll", "libmagic.dll", "libmpg123.dll", "libssl-3-zm.dll",
  "localization.xml", "mcm.dll", "mdnsclient.dll", "mdnsresponder.dll", "meeting_chat_chime.pcm",
  "meeting_raisehand_chime.pcm", "mfAdapter.dll", "mkldnn.dll", "msaalib.dll", "mute.pcm",
  "nanosvg_LICENSE.txt", "nydus.dll", "percussion.pcm", "percussion_pause.pcm", "Pizzicato Strings.pcm",
  "record_start.pcm", "record_stop.pcm", "Reed Organ.pcm", "reslib.dll", "ring.pcm", "ringtone.xml",
  "ring_spatial.pcm", "ryzen_ai_vart.dll", "sdk.dll", "sdkExt.dll", "Silent.pcm", "ssb_sdk.dll",
  "swresample_zm-5.dll", "swscale_zm-8.dll", "tp.dll", "turbojpeg.dll", "UIBase.dll", "Ukulele G.pcm",
  "Ukulele.pcm", "unmute.pcm", "util.dll", "Vibraphone.pcm", "viper.dll", "viperex.dll",
  "viper_async_device.dll", "WebView2Loader.dll", "wr_ding.pcm", "XmppDll.dll", "zApp.dll", "zAppRes.dll",
  "zAppUI.dll", "zbt.dll", "zBusinessUIComponent.dll", "zCommonChatRes.dll", "zContext.dll",
  "zCrashReport64.dll", "zCrashReport64.exe", "zcsairhost.exe", "zcscpthost.exe", "zCSCptService.exe",
  "zData.dll", "zEventTracker.dll", "zKBCrypto.dll", "zLang_de.dll", "zLang_es.dll", "zLang_fr.dll",
  "zLang_id.dll", "zLang_it.dll", "zLang_jp.dll", "zLang_korean.dll", "zLang_nl.dll", "zLang_pl.dll",
  "zLang_ptg.dll", "zLang_ru.dll", "zLang_sv.dll", "zLang_tr.dll", "zLang_vi.dll", "zLang_zh_cn.dll",
  "zLang_zh_tw.dll", "zLooper.dll", "zlt.dll", "zmbRecord.dll", "zmbTranscode.dll", "ZMDB.dll", "zmp.dll",
  "zMsgAppCommon.dll", "zm_conf_universal_ui.dll", "zm_conf_universal_ui_plugin.dll", "zNet.dll",
  "zNetUtils.dll", "zoom.manifest", "zoombase_crypto_shared.dll", "ZoomDocConverter.exe", "ZoomProxy.dll",
  "ZoomTask.dll", "ZoomTelemetry.dll", "zoom_meeting_bridge.dll", "zPSApp.dll", "zPTApp.dll", "zSDK.dll",
  "zTelemetryBiz.dll", "zTscoder.exe", "ZUI.dll", "zUIClient.dll", "zUnifyWebViewApp.dll", "zVideoApp.dll",
  "zVideoAppFrame.dll", "zVideoAppPlugin.dll", "zVideoUI.dll", "zVideoUIPlugin.dll", "zVideoUIPluginRes.dll",
  "zWBUI.dll", "zWBUIRes.dll", "zWebService.dll", "zWebview2Agent.exe", "zWinRes.dll", "zzhost.dll",
  "ZZHostIPCSDK.dll",
];

// --- 1. Vorbedingungen ---------------------------------------------------------
if (process.platform !== 'win32') abbruch('das Einsatzpaket wird nur unter Windows gebaut.');

const sdkDir = process.env.ZOOM_SDK_DIR;
const sdkBin = sdkDir ? join(sdkDir, 'x64', 'bin') : null;
if (komplett) {
  if (!sdkBin || !existsSync(join(sdkBin, 'sdk.dll'))) {
    abbruch('release:komplett braucht ZOOM_SDK_DIR mit x64\\bin\\sdk.dll darin.');
  }
  if (!existsSync(join(sdkDir, 'OSS-LICENSE.pdf'))) abbruch(`OSS-LICENSE.pdf fehlt in ${sdkDir}`);
}

// zoom-bridge.exe muss AUS DEM AKTUELLEN STAND gebaut sein. Ein Paket mit einer
// alten .exe saehe aus wie der neue Stand und waere es nicht - eine Abnahme
// im Projekt maesse dann etwas anderes als das, was im Repo steht.
const bridgeExe = join(pkg, 'build', 'Release', 'zoom-bridge.exe');
if (!existsSync(bridgeExe)) abbruch(`${bridgeExe} fehlt - erst ZOOM_SDK_DIR und NDI_SDK_DIR setzen und \`npm run rebuild -w @jm/zoom-bridge\`.`);
const quellenStand = Math.max(neuesteAenderung(join(pkg, 'native')), statSync(join(pkg, 'CMakeLists.txt')).mtimeMs);
if (statSync(bridgeExe).mtimeMs <= quellenStand) {
  abbruch(
    'build\\Release\\zoom-bridge.exe ist AELTER als eine Datei in native\\ oder CMakeLists.txt.\n' +
      '  Erst neu bauen: ZOOM_SDK_DIR und NDI_SDK_DIR setzen, dann `npm run rebuild -w @jm/zoom-bridge`.',
  );
}

// Die NDI-Laufzeit samt Lizenztext DANEBEN - nur ein Ordner, der beides hat.
const ndiKandidaten = [
  process.env.NDI_RUNTIME_DIR_V6,
  'C:\\Program Files\\NDI\\NDI 6 Runtime\\v6',
  process.env.NDI_SDK_DIR && join(process.env.NDI_SDK_DIR, 'Bin', 'x64'),
  'C:\\Program Files\\NDI\\NDI 6 SDK\\Bin\\x64',
].filter(Boolean);
const ndiDir = ndiKandidaten.find(
  (d) => existsSync(join(d, 'Processing.NDI.Lib.x64.dll')) && existsSync(join(d, 'Processing.NDI.Lib.Licenses.txt')),
);
if (!ndiDir) abbruch(`NDI-Laufzeit mit Lizenztext nicht gefunden. Gesucht in:\n  ${ndiKandidaten.join('\n  ')}`);

// --- 2. Die Start-EXE ------------------------------------------------------------
rmSync(bau, { recursive: true, force: true });
mkdirSync(bau, { recursive: true });

schritt('buendle cli\\zoom-join.mjs (esbuild) …');
let esbuild;
try {
  esbuild = await import('esbuild');
} catch {
  abbruch('esbuild nicht gefunden - im Repo-Wurzelverzeichnis `npm install` ausfuehren.');
}
const buendel = join(bau, 'zoom-join.cjs');
await esbuild.build({
  entryPoints: [join(pkg, 'cli', 'zoom-join.mjs')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outfile: buendel,
  logLevel: 'warning',
  // import.meta gibt es in CommonJS nicht - esbuild setzte {} ein, und
  // src/bridge.ts ruft beim LADEN fileURLToPath(import.meta.url) (binPath()).
  // Das waere ein Absturz vor der ersten Zeile. __filename ist in einer
  // Single Executable Application die EXE selbst (gemessen, Node 24.16).
  define: {
    'import.meta.url': '__jm_import_meta_url',
    __JM_ZOOM_BRIDGE_VERSION__: JSON.stringify(version),
  },
  banner: { js: "const __jm_import_meta_url = require('node:url').pathToFileURL(__filename).href;" },
});

schritt('setze die Single Executable Application zusammen …');
const seaConfig = join(bau, 'sea-config.json');
const blob = join(bau, 'sea-prep.blob');
writeFileSync(
  seaConfig,
  JSON.stringify({ main: buendel, output: blob, disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false }),
);
lauf(process.execPath, ['--experimental-sea-config', seaConfig]);
const startExe = join(bau, 'zoom-join.exe');
copyFileSync(process.execPath, startExe);

// Die Signatur von node.exe entfernen, wie es Nodes SEA-Anleitung verlangt -
// nach dem Einsetzen des Blobs waere sie ohnehin ungueltig. Ohne signtool
// geht es auch (postject warnt dann "signature seems corrupted").
const kits = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
const signtool = existsSync(kits)
  ? readdirSync(kits)
      .filter((d) => /^10\./.test(d))
      .sort()
      .reverse()
      .map((d) => join(kits, d, 'x64', 'signtool.exe'))
      .find((p) => existsSync(p))
  : undefined;
if (signtool) lauf(signtool, ['remove', '/s', startExe]);
else schritt('signtool nicht gefunden - die Signatur von node.exe bleibt (ungueltig) stehen.');

// npx ist eine .cmd - die startet Node nur ueber die Shell. Darum EINE
// fertige Befehlszeile mit selbst gesetzten Anfuehrungszeichen (Pfade mit
// Leerzeichen); eine Argumentliste mit shell:true verbindet Node bloss mit
// Leerzeichen und warnt davor (DEP0190).
const q = (a) => `"${a}"`;
lauf(['npx', '--yes', POSTJECT, q(startExe), 'NODE_SEA_BLOB', q(blob), '--sentinel-fuse', SEA_FUSE].join(' '), [], { shell: true });

// Lebenszeichen: die EXE muss starten, ihre Fassung nennen und - hier ohne
// bin\ daneben - mit Rueckgabe 1 und der Meldung zu zoom-bridge.exe enden.
const env = { ...process.env };
delete env.ZOOM_SDK_DIR;
const probe = spawnSync(startExe, [], { encoding: 'utf8', env, timeout: 30_000 });
if (probe.status !== 1 || !probe.stdout.includes(`JM Zoom Bridge ${version}`) || !probe.stderr.includes('zoom-bridge.exe fehlt')) {
  abbruch(`die Start-EXE verhaelt sich nicht wie erwartet (Rueckgabe ${probe.status}):\n${probe.stdout}${probe.stderr}`);
}
schritt(`zoom-join.exe startet: "${probe.stdout.trim().split('\n')[0]}"`);

// --- 3. Oeffentliches Paket zusammensetzen ---------------------------------------
schritt(`setze ${name} zusammen …`);
rmSync(oeffentlich, { recursive: true, force: true });
mkdirSync(join(oeffentlich, 'bin'), { recursive: true });
mkdirSync(join(oeffentlich, 'LIZENZEN'), { recursive: true });
const paket = join(pkg, 'paket');
textdatei(join(paket, 'Zoom-Bridge starten.cmd'), join(oeffentlich, 'Zoom-Bridge starten.cmd'), { bom: false, nurAscii: true });
textdatei(join(paket, 'start.ps1'), join(oeffentlich, 'start.ps1'), { bom: true });
textdatei(join(paket, 'LIESMICH.txt'), join(oeffentlich, 'LIESMICH.txt'), { bom: true });
copyFileSync(startExe, join(oeffentlich, 'zoom-join.exe'));
copyFileSync(bridgeExe, join(oeffentlich, 'bin', 'zoom-bridge.exe'));
copyFileSync(join(ndiDir, 'Processing.NDI.Lib.x64.dll'), join(oeffentlich, 'bin', 'Processing.NDI.Lib.x64.dll'));
copyFileSync(join(ndiDir, 'Processing.NDI.Lib.Licenses.txt'), join(oeffentlich, 'LIZENZEN', 'Processing.NDI.Lib.Licenses.txt'));

// --- 4. DER WAECHTER -------------------------------------------------------------
// Keine Datei im oeffentlichen Paket darf so heissen wie eine Datei im
// Zoom-SDK x64\bin. Gegen die ECHTE Liste, wenn ZOOM_SDK_DIR gesetzt ist -
// sonst gegen die feste Liste oben. Verglichen ohne Gross-/Kleinschreibung,
// weil Windows-Dateinamen sie nicht unterscheiden.
const echteListe = sdkBin && existsSync(sdkBin);
const sdkNamen = new Set(
  (echteListe ? dateienUnter(sdkBin).map((f) => f.split(/[\\/]/).pop()) : SDK_NAMEN_7_1_5).map((n) => n.toLowerCase()),
);
const oeffentlicheDateien = dateienUnter(oeffentlich);
const verboten = oeffentlicheDateien.filter((f) => sdkNamen.has(f.split(/[\\/]/).pop().toLowerCase()));
if (verboten.length > 0) {
  abbruch(`Zoom-SDK-Dateien im OEFFENTLICHEN Paket:\n  ${verboten.join('\n  ')}`);
}
schritt(
  `Waechter: keine der ${sdkNamen.size} Zoom-SDK-Dateinamen im oeffentlichen Paket ` +
    `(geprueft gegen ${echteListe ? `das SDK unter ${sdkBin}` : 'die feste Liste fuer 7.1.5.43953'}).`,
);
// start.ps1 MUSS mit BOM ausgeliefert werden (Windows PowerShell 5.1).
if (!readFileSync(join(oeffentlich, 'start.ps1')).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
  abbruch('start.ps1 hat keinen UTF-8-BOM.');
}

// --- 5. ZIP ------------------------------------------------------------------------
// Das tar von Windows (bsdtar) - NICHT das aus Git Bash, das kein ZIP kann.
const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
if (!existsSync(tar)) abbruch(`${tar} fehlt (Windows 10 1803 oder neuer noetig).`);

function zippe(zip, basis, ordnerName) {
  rmSync(zip, { force: true });
  lauf(tar, ['-a', '-c', '-f', zip, '-C', basis, ordnerName]);
}

function sha256(datei) {
  return createHash('sha256').update(readFileSync(datei)).digest('hex');
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

zippe(zipOeffentlich, releaseDir, name);
// Gegenprobe am fertigen ZIP: was drin steht, nicht was hineingehen sollte.
const imZip = lauf(tar, ['-t', '-f', zipOeffentlich]).stdout.split(/\r?\n/).filter((l) => l && !l.endsWith('/'));
const imZipVerboten = imZip.filter((p) => sdkNamen.has(p.split('/').pop().toLowerCase()));
if (imZipVerboten.length > 0) abbruch(`Zoom-SDK-Dateien im oeffentlichen ZIP:\n  ${imZipVerboten.join('\n  ')}`);

console.log(`\nOEFFENTLICH  ${zipOeffentlich}`);
console.log(`  ${mb(statSync(zipOeffentlich).size)}, sha256 ${sha256(zipOeffentlich)}`);
for (const f of imZip) console.log(`    ${f}`);

// --- 6. Komplett-Paket (nie veroeffentlichen) ---------------------------------------
if (komplett) {
  schritt('setze das KOMPLETT-Paket zusammen (NICHT veroeffentlichen) …');
  rmSync(komplettBasis, { recursive: true, force: true });
  mkdirSync(komplettBasis, { recursive: true });
  cpSync(oeffentlich, komplettOrdner, { recursive: true });
  // Keine SDK-Datei darf eine eigene ueberschreiben (zoom-bridge.exe, die
  // NDI-Laufzeit) - sonst liefe im Projekt etwas anderes als gebaut.
  const eigene = new Set(dateienUnter(join(komplettOrdner, 'bin')).map((f) => f.toLowerCase()));
  const kollision = dateienUnter(sdkBin).filter((f) => eigene.has(f.toLowerCase()));
  if (kollision.length > 0) abbruch(`SDK-Dateien wuerden eigene ueberschreiben:\n  ${kollision.join('\n  ')}`);
  cpSync(sdkBin, join(komplettOrdner, 'bin'), { recursive: true });
  copyFileSync(join(sdkDir, 'OSS-LICENSE.pdf'), join(komplettOrdner, 'LIZENZEN', 'OSS-LICENSE.pdf'));
  const sdkAnzahl = dateienUnter(sdkBin).length;
  const imBin = dateienUnter(join(komplettOrdner, 'bin')).length;
  if (imBin !== sdkAnzahl + 2 || !existsSync(join(komplettOrdner, 'bin', 'sdk.dll'))) {
    abbruch(`bin\\ hat ${imBin} Dateien, erwartet ${sdkAnzahl} aus dem SDK + 2 eigene.`);
  }
  zippe(zipKomplett, komplettBasis, name);
  const imKomplett = lauf(tar, ['-t', '-f', zipKomplett]).stdout.split(/\r?\n/).filter((l) => l && !l.endsWith('/'));
  console.log(`\nKOMPLETT (NICHT VEROEFFENTLICHEN)  ${zipKomplett}`);
  console.log(`  ${mb(statSync(zipKomplett).size)}, ${imKomplett.length} Dateien (davon ${sdkAnzahl} aus <Zoom-SDK>\\x64\\bin), sha256 ${sha256(zipKomplett)}`);
  for (const f of imKomplett.filter((p) => !/\/bin\/./.test(p) || /\/bin\/(zoom-bridge\.exe|Processing\.NDI\.Lib\.x64\.dll|sdk\.dll)$/.test(p))) {
    console.log(`    ${f}`);
  }
  console.log(`    … plus ${sdkAnzahl - 1} weitere SDK-Dateien in bin\\`);
}

console.log(`\nzoom-bridge.exe aus build\\Release vom ${new Date(statSync(bridgeExe).mtimeMs).toLocaleString('de-DE')}`);
console.log(`NDI-Laufzeit aus ${ndiDir}`);
console.log(`(Quellen: ${relative(pkg, paket)}\\, Ergebnis: ${relative(pkg, releaseDir)}\\ - von git ignoriert)`);

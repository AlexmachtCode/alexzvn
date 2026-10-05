// Was in eine Auslieferung der Zoom-Bridge darf - und was nie (Spec Stage 4,
// Abschnitte 5.1 und 10). EIN Modul fuer beide Bauwege:
//   - scripts/build-release.mjs (Einsatzpaket der Konsolen-Steuerung)
//   - apps/connect/tools/bundle-zoom-bridge.mjs und tools/after-pack.cjs (JM Connect)
// So gibt es genau EINE Namensliste, EINE VC-Laufzeit-Suche und EINE
// Frische-Pruefung - eine zweite Kopie liefe frueher oder spaeter auseinander.
//
// ALLES HIER WIRFT oder liefert ein Ergebnis, nichts ruft process.exit(): ein
// electron-builder-Haken darf den Bau nur ueber eine Ausnahme abbrechen, und
// build-release.mjs faengt sie mit seinem abbruch().
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Ordner des Bridge-Pakets (packages/zoom-bridge). */
const PAKET = join(dirname(fileURLToPath(import.meta.url)), '..');

// Die Dateinamen in <Zoom-SDK 7.1.5.43953>\x64\bin, rekursiv, ohne Doppelte -
// fuer den Waechter, wenn ZOOM_SDK_DIR NICHT gesetzt ist. Erzeugt am
// 01.10.2026 aus dem echten SDK (153 Dateien, 152 verschiedene Namen). Ist
// ZOOM_SDK_DIR gesetzt, gilt stattdessen die ECHTE Liste aus dem SDK.
export const SDK_NAMEN_7_1_5 = [
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

// Die VC-Laufzeit, die zoom-bridge.exe UND die Zoom-DLLs brauchen (gemessen:
// 79 von 119 Dateien in x64\bin + Bridge brauchen msvcp140.dll; dazu einmal
// msvcp140_codecvt_ids.dll). Das Zoom-SDK liefert sie fuer x64 NICHT mit.
export const VC_PFLICHT = ['msvcp140.dll', 'msvcp140_codecvt_ids.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'];

/** Alle Dateien unter `dir`, rekursiv, als Pfade relativ zu `dir`. */
export function dateienUnter(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) for (const q of dateienUnter(p)) out.push(join(e.name, q));
    else out.push(e.name);
  }
  return out;
}

/** Neueste Aenderungszeit unter `dir` (rekursiv). */
export function neuesteAenderung(dir) {
  let max = 0;
  for (const f of dateienUnter(dir)) max = Math.max(max, statSync(join(dir, f)).mtimeMs);
  return max;
}

/** Linker-Fassung einer PE-Datei (Optional Header: MajorLinkerVersion.MinorLinkerVersion). Wirft bei Nicht-PE. */
export function linkerFassung(datei) {
  const b = readFileSync(datei);
  const pe = b.length >= 0x40 ? b.readUInt32LE(0x3c) : -1;
  if (pe < 0 || pe + 28 > b.length || b.toString('latin1', pe, pe + 4) !== 'PE\0\0') {
    throw new Error(`${datei} ist keine PE-Datei.`);
  }
  return [b[pe + 24 + 2], b[pe + 24 + 3]];
}

/** Dateifassung aus VS_FIXEDFILEINFO (Signatur 0xFEEF04BD), als [a, b, c, d]; null ohne Versionsressource. */
export function dateiFassung(datei) {
  const b = readFileSync(datei);
  const i = b.indexOf(Buffer.from([0xbd, 0x04, 0xef, 0xfe]));
  if (i < 0 || i + 16 > b.length) return null;
  const ms = b.readUInt32LE(i + 8);
  const ls = b.readUInt32LE(i + 12);
  return [ms >>> 16, ms & 0xffff, ls >>> 16, ls & 0xffff];
}

/** a >= b, komponentenweise (gleich lange Zahlenlisten). */
export function mindestens(a, b) {
  for (let i = 0; i < b.length; i++) {
    if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i];
  }
  return true;
}

/**
 * Sucht die Visual-C++-Laufzeit (Microsoft.VC14x.CRT mit allen VC_PFLICHT-Dateien):
 * VC_CRT_DIR, die Visual-Studio-Instanz aus build\CMakeCache.txt des Bridge-Pakets
 * und jede Visual-Studio-Installation unter "Program Files". `brauchbar` ist nach
 * Fassung absteigend sortiert; `kandidaten` nennt alle durchsuchten Ordner (fuer
 * die Abbruchmeldung).
 */
export function findeVcLaufzeit(pkgDir = PAKET) {
  const kandidaten = [];
  if (process.env.VC_CRT_DIR) kandidaten.push(process.env.VC_CRT_DIR);
  const cache = join(pkgDir, 'build', 'CMakeCache.txt');
  const vsWurzeln = new Set();
  if (existsSync(cache)) {
    const m = /^CMAKE_GENERATOR_INSTANCE:INTERNAL=(.+)$/m.exec(readFileSync(cache, 'utf8'));
    if (m) vsWurzeln.add(m[1].trim());
  }
  // Nur Ordner, und ein unlesbarer Ordner ist leer statt ein Absturz.
  const ordnerIn = (d) => {
    try {
      return readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  };
  for (const pf of ['C:\\Program Files (x86)\\Microsoft Visual Studio', 'C:\\Program Files\\Microsoft Visual Studio']) {
    for (const jahr of ordnerIn(pf)) for (const ed of ordnerIn(join(pf, jahr))) vsWurzeln.add(join(pf, jahr, ed));
  }
  for (const w of vsWurzeln) {
    const redist = join(w, 'VC', 'Redist', 'MSVC');
    for (const v of ordnerIn(redist)) {
      const x64 = join(redist, v, 'x64');
      for (const d of ordnerIn(x64)) if (/^Microsoft\.VC\d+\.CRT$/i.test(d)) kandidaten.push(join(x64, d));
    }
  }
  const brauchbar = kandidaten
    .filter((d) => VC_PFLICHT.every((f) => existsSync(join(d, f))))
    .map((d) => ({ dir: d, fassung: dateiFassung(join(d, 'msvcp140.dll')) ?? [0, 0, 0, 0] }))
    .sort((a, b) => (mindestens(a.fassung, b.fassung) ? -1 : 1));
  return { brauchbar, kandidaten };
}

/**
 * Die EINE Auswahlregel fuer die VC-Laufzeit, die neben zoom-bridge.exe liegt
 * (Einsatzpaket UND JM-Connect-Installer): die neueste brauchbare, mindestens so
 * neu wie der Linker, der `exe` gebaut hat (die STL ist nur rueckwaerts kompatibel).
 * Liefert { ok: true, vcLaufzeit, linker, dateien } (dateien = alle *.dll des
 * Ordners) oder { ok: false, text } - die Aufrufer rufen nur noch ihr abbruch(text).
 */
export function waehleVcLaufzeit(pkgDir, exe) {
  let linker;
  try {
    linker = linkerFassung(exe);
  } catch (e) {
    return { ok: false, text: e.message };
  }
  const vc = findeVcLaufzeit(pkgDir);
  const vcLaufzeit = vc.brauchbar[0];
  if (!vcLaufzeit) {
    return {
      ok: false,
      text:
        `Visual-C++-Laufzeit (Microsoft.VC14x.CRT mit ${VC_PFLICHT.join(', ')}) nicht gefunden.\n` +
        `  Gesucht in:\n  ${vc.kandidaten.join('\n  ') || '(keine Visual-Studio-Installation gefunden)'}\n` +
        '  Mit VC_CRT_DIR auf den Ordner ...\VC\Redist\MSVC\<Fassung>\x64\Microsoft.VC14x.CRT zeigen.',
    };
  }
  if (!mindestens(vcLaufzeit.fassung, linker)) {
    return {
      ok: false,
      text:
        `Die Visual-C++-Laufzeit ${vcLaufzeit.fassung.join('.')} (${vcLaufzeit.dir}) ist AELTER als der Linker ${linker.join('.')}, ` +
        'der zoom-bridge.exe gebaut hat - die Bridge koennte damit abstuerzen. Die Redist-Dateien desselben Toolsets nehmen (VC_CRT_DIR).',
    };
  }
  const dateien = readdirSync(vcLaufzeit.dir).filter((f) => /\.dll$/i.test(f));
  return { ok: true, vcLaufzeit, linker, dateien };
}

/**
 * zoom-bridge.exe muss AUS DEM AKTUELLEN STAND gebaut sein: vorhanden und
 * juenger als jede Datei in native\ und als CMakeLists.txt. Ein Paket mit einer
 * alten .exe saehe aus wie der neue Stand und waere es nicht.
 */
export function bridgeExeFrisch(pkgDir) {
  const exe = join(pkgDir, 'build', 'Release', 'zoom-bridge.exe');
  if (!existsSync(exe)) {
    return { ok: false, text: `${exe} fehlt - erst ZOOM_SDK_DIR und NDI_SDK_DIR setzen und \`npm run rebuild -w @jm/zoom-bridge\`.` };
  }
  const quellenStand = Math.max(neuesteAenderung(join(pkgDir, 'native')), statSync(join(pkgDir, 'CMakeLists.txt')).mtimeMs);
  if (statSync(exe).mtimeMs <= quellenStand) {
    return {
      ok: false,
      text:
        'build\\Release\\zoom-bridge.exe ist AELTER als eine Datei in native\\ oder CMakeLists.txt.\n' +
        '  Erst neu bauen: ZOOM_SDK_DIR und NDI_SDK_DIR setzen, dann `npm run rebuild -w @jm/zoom-bridge`.',
    };
  }
  return { ok: true, exe };
}

/**
 * Die verbotenen Dateinamen, klein geschrieben: die ECHTE Liste aus `sdkBin`
 * (rekursiv), wenn der Ordner existiert, sonst SDK_NAMEN_7_1_5. Klein, weil
 * Windows-Dateinamen Gross-/Kleinschreibung nicht unterscheiden.
 */
export function sdkNamen(opts = {}) {
  const { sdkBin } = opts;
  const echt = Boolean(sdkBin) && existsSync(sdkBin);
  const namen = echt ? dateienUnter(sdkBin).map((f) => f.split(/[\\/]/).pop()) : SDK_NAMEN_7_1_5;
  return new Set(namen.map((n) => n.toLowerCase()));
}

/** Waechter fuer Ordner: alle Dateien unter `ordner` (relativ), die wie eine Zoom-SDK-Datei heissen. */
export function verboteneZoomDateien(ordner, opts = {}) {
  const namen = sdkNamen(opts);
  return dateienUnter(ordner).filter((f) => namen.has(f.split(/[\\/]/).pop().toLowerCase()));
}

/**
 * Inhaltsverzeichnis einer .asar: liest nur den 16-Byte-Kopf (die JSON-Laenge
 * steht als UInt32LE bei Byte 12) und das JSON ab Byte 16 - nie den Dateiinhalt.
 * Liefert jeden DATEI-Eintrag als Pfad mit "/"; ein Knoten mit "files" ist ein Ordner.
 */
export function asarEintraege(datei) {
  const fd = openSync(datei, 'r');
  try {
    const kopf = Buffer.alloc(16);
    if (readSync(fd, kopf, 0, 16, 0) < 16) throw new Error(`${datei} ist keine .asar (Kopf kuerzer als 16 Byte).`);
    const laenge = kopf.readUInt32LE(12);
    const json = Buffer.alloc(laenge);
    if (readSync(fd, json, 0, laenge, 16) < laenge) throw new Error(`${datei} ist keine .asar (Inhaltsverzeichnis abgeschnitten).`);
    const baum = JSON.parse(json.toString('utf8'));
    const out = [];
    const gehe = (knoten, vorne) => {
      for (const [name, kind] of Object.entries(knoten ?? {})) {
        const pfad = vorne ? `${vorne}/${name}` : name;
        if (kind && typeof kind === 'object' && kind.files && typeof kind.files === 'object') gehe(kind.files, pfad);
        else out.push(pfad);
      }
    };
    gehe(baum.files, '');
    return out;
  } finally {
    closeSync(fd);
  }
}

/**
 * Waechter fuer den INHALT jeder .asar unter `ordner` (Spec 10.3): meldet jeden
 * Eintrag, dessen Name in der SDK-Liste steht, der unter node_modules/@jm/zoom-bridge/
 * liegt (die Bridge wird gebuendelt, ihr Paketordner gehoert nie in die app.asar)
 * oder der auf .zip endet (in ein ZIP sieht kein Namensvergleich hinein).
 * Ergebnis "<asar relativ zu ordner>:<eintrag>", jeder Eintrag hoechstens einmal.
 */
export function verboteneAsarEintraege(ordner, opts = {}) {
  const namen = sdkNamen(opts);
  const treffer = new Set();
  for (const rel of dateienUnter(ordner).filter((f) => /\.asar$/i.test(f))) {
    for (const eintrag of asarEintraege(join(ordner, rel))) {
      const name = eintrag.split('/').pop().toLowerCase();
      if (namen.has(name) || `/${eintrag}`.includes('/node_modules/@jm/zoom-bridge/') || /\.zip$/i.test(eintrag)) {
        treffer.add(`${rel}:${eintrag}`);
      }
    }
  }
  return [...treffer];
}

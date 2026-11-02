// Waechter 2 (Spec Stage 4, 10.3; Spec Zoom-Slots 22.7, E56): electron-builder ruft diesen Haken, nachdem
// release\win-unpacked bzw. release/mac*/ steht und BEVOR Installer oder DMG entstehen. Er bricht den Bau ab, wenn eine
// Datei aus <Zoom-SDK>\x64\bin im fertigen Ordner liegt - auch in app.asar.unpacked und als Eintrag IN jeder .asar -,
// wenn eine .asar eine .node-Datei unter node_modules/@jm/ndi/ enthaelt (die NDI-Kopie, die der Lader sonst statt
// resources/bin/<plat>/jm_ndi.node faende; E56, dieselbe Regel wie tools/pruefe-mac-paket.mjs), unter Windows, wenn
// resources\zoom-bridge\zoom-bridge.exe fehlt, und in einem Paket mit NDI-Laufzeit, wenn die Lizenzbedingungen LIZENZ.txt
// oder unter Windows der Lizenztext Processing.NDI.Lib.Licenses.txt neben der Laufzeit fehlen oder leer sind (Spec 22.8
// LP4, LP5; Owner-Frage OFC4). Derselbe Waechter-Code wie im Einsatzpaket
// (packages/zoom-bridge/scripts/auslieferung.mjs), keine zweite Liste und kein zweiter asar-Leser.
// CommonJS, weil electron-builder Haken mit der Endung .cjs per require() laedt.
const { existsSync, readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
exports.default = async function afterPack(context) {
  const modul = join(__dirname, '..', '..', '..', 'packages', 'zoom-bridge', 'scripts', 'auslieferung.mjs');
  const { verboteneZoomDateien, verboteneAsarEintraege, sdkNamenQuellen, asarEintraege, dateienUnter } = await import(pathToFileURL(modul).href);
  const sdkBin = process.env.ZOOM_SDK_DIR && join(process.env.ZOOM_SDK_DIR, 'x64', 'bin');
  const treffer = [
    ...verboteneZoomDateien(context.appOutDir, { sdkBin }),   // Dateien im Ordner, auch app.asar.unpacked
    ...verboteneAsarEintraege(context.appOutDir, { sdkBin }), // Einträge IN jeder .asar darunter
  ];
  if (treffer.length) throw new Error(`Zoom-SDK-Dateien im Installer:\n  ${treffer.join('\n  ')}`);
  // NDI-Regel (E56), auf beiden Plattformen: jede .node-Datei unter node_modules/@jm/ndi/ in jeder .asar darunter.
  const ndiKopien = [];
  for (const rel of dateienUnter(context.appOutDir).filter((f) => /\.asar$/i.test(f))) {
    for (const eintrag of asarEintraege(join(context.appOutDir, rel))) {
      if (/\.node$/i.test(eintrag) && `/${eintrag}`.includes('/node_modules/@jm/ndi/')) ndiKopien.push(`${rel}:${eintrag}`);
    }
  }
  if (ndiKopien.length) throw new Error(`NDI-Kopie in der app.asar (Spec 22.7, E56):\n  ${ndiKopien.join('\n  ')}`);
  if (context.electronPlatformName === 'win32' && !existsSync(join(context.appOutDir, 'resources', 'zoom-bridge', 'zoom-bridge.exe'))) {
    throw new Error('zoom-bridge.exe fehlt im Installer (prepackage gelaufen?).');
  }
  // Lizenzpflichten in jedem Paket mit NDI-Laufzeit (Spec 22.8 LP4, LP5; ueber 22.8 hinaus, Owner-Frage OFC4, C4E16): im
  // Resources-Ordner die Lizenzbedingungen LIZENZ.txt (FR16, kommt ueber extraResources), unter Windows neben der Laufzeit
  // ihr Lizenztext Processing.NDI.Lib.Licenses.txt (bundle-ndi.mjs), je nicht leer. Ohne Laufzeit im Paket keine Pflicht
  // (Tag connect-v0.3.0 hat seinen eigenen Haken; die Altfaelle des Tests bauen kein NDI ein). macOS: die Lizenzdatei der
  // Laufzeit in bin/mac prueft tools/pruefe-mac-paket.mjs.
  const plattform = context.electronPlatformName;
  const resOrdner = plattform === 'win32' ? [join(context.appOutDir, 'resources')]
    : plattform === 'darwin' ? readdirSync(context.appOutDir).filter((n) => n.endsWith('.app')).map((n) => join(context.appOutDir, n, 'Contents', 'Resources'))
    : [];
  const lizenzFehlt = [];
  const beigelegt = new Set();
  for (const res of resOrdner) {
    const win = plattform === 'win32';
    const bin = join(res, 'bin', win ? 'win' : 'mac');
    if (!existsSync(join(bin, win ? 'Processing.NDI.Lib.x64.dll' : 'libndi.dylib'))) continue;
    const pflicht = [['LIZENZ.txt', join(res, 'LIZENZ.txt')]];
    if (win) pflicht.push(['Processing.NDI.Lib.Licenses.txt', join(bin, 'Processing.NDI.Lib.Licenses.txt')]);
    for (const [name, p] of pflicht) {
      if (existsSync(p) && statSync(p).isFile() && statSync(p).size > 0) beigelegt.add(name);
      else lizenzFehlt.push(p);
    }
  }
  if (lizenzFehlt.length) throw new Error(`Lizenzdateien fehlen oder sind leer (Spec 22.8 LP4, LP5):\n  ${lizenzFehlt.join('\n  ')}`);
  // Erfolgszeile fuers Bauprotokoll (Spec 13 Nr. 7, Nachbesserung B85): Waechter 1 (bundle-zoom-bridge.mjs) und Waechter 2
  // stehen dort beide. Den Zoom-Teil prueft kein eigener Test (der Haken ruft nur die geteilten Waechter-Funktionen aus
  // auslieferung.mjs); den NDI-Teil und die Lizenzdateien samt Zeile prueft test/after-pack.test.mjs (PK57, OFC4). Die
  // Lizenzdateien nennt die Zeile nur, wenn sie geprueft sind (Paket mit NDI-Laufzeit).
  const lizenzTeil = beigelegt.size ? `; neben der NDI-Laufzeit beigelegt: ${[...beigelegt].join(', ')}` : '';
  console.log(`[after-pack] Wächter 2: keine Zoom-SDK-Dateien im Installer, keine NDI-Kopie in der app.asar (${context.appOutDir}; geprüft gegen ${sdkNamenQuellen({ sdkBin })}${lizenzTeil}).`);
};

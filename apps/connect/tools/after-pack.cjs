// Waechter 2 (Spec Stage 4, 10.3): electron-builder ruft diesen Haken, nachdem
// release\win-unpacked steht und BEVOR der NSIS-Installer entsteht. Er bricht den
// Bau ab, wenn eine Datei aus <Zoom-SDK>\x64\bin im fertigen Ordner liegt - auch
// in app.asar.unpacked und als Eintrag IN jeder .asar - und unter Windows, wenn
// resources\zoom-bridge\zoom-bridge.exe fehlt. Derselbe Waechter-Code wie im
// Einsatzpaket (packages/zoom-bridge/scripts/auslieferung.mjs), keine zweite Liste.
// CommonJS, weil electron-builder Haken mit der Endung .cjs per require() laedt.
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
exports.default = async function afterPack(context) {
  const modul = join(__dirname, '..', '..', '..', 'packages', 'zoom-bridge', 'scripts', 'auslieferung.mjs');
  const { verboteneZoomDateien, verboteneAsarEintraege } = await import(pathToFileURL(modul).href);
  const sdkBin = process.env.ZOOM_SDK_DIR && join(process.env.ZOOM_SDK_DIR, 'x64', 'bin');
  const treffer = [
    ...verboteneZoomDateien(context.appOutDir, { sdkBin }),   // Dateien im Ordner, auch app.asar.unpacked
    ...verboteneAsarEintraege(context.appOutDir, { sdkBin }), // Einträge IN jeder .asar darunter
  ];
  if (treffer.length) throw new Error(`Zoom-SDK-Dateien im Installer:\n  ${treffer.join('\n  ')}`);
  if (context.electronPlatformName === 'win32' && !existsSync(join(context.appOutDir, 'resources', 'zoom-bridge', 'zoom-bridge.exe'))) {
    throw new Error('zoom-bridge.exe fehlt im Installer (prepackage gelaufen?).');
  }
};

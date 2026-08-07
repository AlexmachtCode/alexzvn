// Laedt das native Addon (jm_decklink.node).
//
// Anders als @jm/ndi gibt es hier NICHTS mitzuliefern: die DeckLink-Implementierung
// kommt zur Laufzeit ueber COM aus dem installierten Desktop-Video-Treiber. Deshalb
// kein PATH-Gefummel, kein DLL-Buendeln, kein resources/bin-Sonderweg.
const path = require('node:path');
const fs = require('node:fs');

function bundledBinDir() {
  const res = process.resourcesPath;
  if (!res || process.platform !== 'win32') return null;
  const dir = path.join(res, 'bin', 'win');
  return fs.existsSync(path.join(dir, 'jm_decklink.node')) ? dir : null;
}

let addon;
try {
  const bundled = bundledBinDir();
  addon = bundled
    ? require(path.join(bundled, 'jm_decklink.node'))
    : require('bindings')('jm_decklink');
} catch (err) {
  throw new Error(
    '@jm/decklink: natives Addon konnte nicht geladen werden.\n' +
      '  Build (Windows): DECKLINK_SDK_DIR setzen, dann `npm run rebuild -w @jm/decklink`\n' +
      '  Laufzeit: Blackmagic Desktop Video installiert?\n' +
      'Urspruenglicher Fehler: ' +
      (err && err.message ? err.message : String(err)),
  );
}

module.exports = addon;

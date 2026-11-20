// Testhilfe für Task 6/7 (Auffrisch-Runde): lässt tools/bundle-ndi.mjs einer App an einer KOPIE in einem Temp-Baum laufen.
// Das echte apps/<app>/resources/ bleibt unberührt, SDK und Addon sind Attrappen, die CI (Linux) braucht kein NDI-SDK.
// Die Plattform wird per --import überschrieben, so läuft auch der Mac-Zweig auf jedem OS (bis zu otool, das es dort nicht gibt).
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Führt eine KOPIE von apps/<app>/tools/bundle-ndi.mjs in einem Temp-Baum aus, das echte resources/ der App bleibt
 * unberührt: <tmp>/apps/<app>/tools/bundle-ndi.mjs, <tmp>/packages/ndi/build/Release/jm_ndi.node (Attrappe) und ein
 * SDK <tmp>/sdk als Attrappe. Die Plattform setzt ein per --import geladenes Modul (process.platform), der Lauf geht mit
 * NDI_SDK_DIR=<tmp>/sdk; der Temp-Baum wird danach gelöscht.
 *  - win32:  sdk/Bin/x64/Processing.NDI.Lib.x64.dll und je nach `lizenz` Processing.NDI.Lib.Licenses.txt (Text, 0 Byte, fehlt)
 *  - darwin: sdk/lib/macOS/libndi.dylib; Kopien von apps/connect/tools/bundle-ndi.mjs und pruefe-mac-paket.mjs; Lizenz
 *            'da' = libndi_licenses.txt dreimal gleich (bin/, lib/macOS/, licenses/) plus eine Datei unter examples/,
 *            'leer' = libndi_licenses.txt mit 0 Byte, 'fehlt' = keine. Ein erfolgreicher Lauf endet am fehlenden otool.
 * @param {string} app  Ordner unter apps/
 * @param {'fehlt'|'leer'|'da'} lizenz
 * @param {{ plattform?: 'win32'|'darwin' }} [optionen]  Standard win32
 * @returns {{ status: number|null, ausgabe: string, kopiert: string[]|null }}
 *   ausgabe = stdout + stderr; kopiert = sortierte Dateinamen in <tmp>/apps/<app>/resources/bin/<win|mac>, null ohne Ordner
 */
export function probeNdiBuendel(app, lizenz, { plattform = 'win32' } = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'ndi-buendel-'));
  try {
    const tools = join(tmp, 'apps', app, 'tools');
    mkdirSync(tools, { recursive: true });
    copyFileSync(join(repo, 'apps', app, 'tools', 'bundle-ndi.mjs'), join(tools, 'bundle-ndi.mjs'));
    const addon = join(tmp, 'packages', 'ndi', 'build', 'Release');
    mkdirSync(addon, { recursive: true });
    writeFileSync(join(addon, 'jm_ndi.node'), 'attrappe');
    const sdk = join(tmp, 'sdk');
    const text = lizenz === 'da' ? 'Lizenztext der Attrappe\n' : lizenz === 'leer' ? '' : null;
    const ablegen = (ordner, name) => {
      mkdirSync(join(sdk, ordner), { recursive: true });
      writeFileSync(join(sdk, ordner, name), text);
    };
    if (plattform === 'win32') {
      mkdirSync(join(sdk, 'Bin', 'x64'), { recursive: true });
      writeFileSync(join(sdk, 'Bin', 'x64', 'Processing.NDI.Lib.x64.dll'), 'attrappe');
      if (text !== null) ablegen(join('Bin', 'x64'), 'Processing.NDI.Lib.Licenses.txt');
    } else {
      const connect = join(tmp, 'apps', 'connect', 'tools');
      mkdirSync(connect, { recursive: true });
      for (const n of ['bundle-ndi.mjs', 'pruefe-mac-paket.mjs']) copyFileSync(join(repo, 'apps', 'connect', 'tools', n), join(connect, n));
      mkdirSync(join(sdk, 'lib', 'macOS'), { recursive: true });
      writeFileSync(join(sdk, 'lib', 'macOS', 'libndi.dylib'), 'attrappe');
      if (text !== null) {
        for (const o of ['bin', join('lib', 'macOS'), 'licenses']) ablegen(o, 'libndi_licenses.txt');
        if (lizenz === 'da') {
          mkdirSync(join(sdk, 'examples'), { recursive: true });
          writeFileSync(join(sdk, 'examples', 'licenses.txt'), 'Beispiel');
        }
      }
    }
    const override = join(tmp, 'plattform.mjs');
    writeFileSync(override, `Object.defineProperty(process, 'platform', { value: ${JSON.stringify(plattform)} });\n`);
    const r = spawnSync(process.execPath, ['--import', pathToFileURL(override).href, join(tools, 'bundle-ndi.mjs')], {
      env: { ...process.env, NDI_SDK_DIR: sdk },
      encoding: 'utf8',
    });
    const ziel = join(tmp, 'apps', app, 'resources', 'bin', plattform === 'win32' ? 'win' : 'mac');
    return {
      status: r.status,
      ausgabe: `${r.stdout ?? ''}${r.stderr ?? ''}`,
      kopiert: existsSync(ziel) ? readdirSync(ziel).sort() : null,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

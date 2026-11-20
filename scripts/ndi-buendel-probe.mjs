// Testhilfe für Task 6/7 (Auffrisch-Runde): lässt tools/bundle-ndi.mjs einer App an einer KOPIE in einem Temp-Baum laufen.
// Das echte apps/<app>/resources/ bleibt unberührt, SDK und Addon sind Attrappen, die CI (Linux) braucht kein NDI-SDK.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Führt eine KOPIE von apps/<app>/tools/bundle-ndi.mjs in einem Temp-Baum aus, das echte resources/ der App bleibt
 * unberührt: <tmp>/apps/<app>/tools/bundle-ndi.mjs, <tmp>/packages/ndi/build/Release/jm_ndi.node (Attrappe),
 * <tmp>/sdk/Bin/x64/Processing.NDI.Lib.x64.dll (Attrappe) und je nach `lizenz` Processing.NDI.Lib.Licenses.txt mit Text,
 * mit 0 Byte oder gar nicht. Lauf mit NDI_SDK_DIR=<tmp>/sdk; der Temp-Baum wird danach gelöscht.
 * @param {string} app  Ordner unter apps/
 * @param {'fehlt'|'leer'|'da'} lizenz
 * @returns {{ status: number|null, ausgabe: string, kopiert: string[]|null }}
 *   ausgabe = stdout + stderr; kopiert = sortierte Dateinamen in <tmp>/apps/<app>/resources/bin/win, null ohne Ordner
 */
export function probeNdiBuendel(app, lizenz) {
  const tmp = mkdtempSync(join(tmpdir(), 'ndi-buendel-'));
  try {
    const tools = join(tmp, 'apps', app, 'tools');
    mkdirSync(tools, { recursive: true });
    copyFileSync(join(repo, 'apps', app, 'tools', 'bundle-ndi.mjs'), join(tools, 'bundle-ndi.mjs'));
    const addon = join(tmp, 'packages', 'ndi', 'build', 'Release');
    mkdirSync(addon, { recursive: true });
    writeFileSync(join(addon, 'jm_ndi.node'), 'attrappe');
    const bin = join(tmp, 'sdk', 'Bin', 'x64');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'Processing.NDI.Lib.x64.dll'), 'attrappe');
    if (lizenz === 'leer') writeFileSync(join(bin, 'Processing.NDI.Lib.Licenses.txt'), '');
    if (lizenz === 'da') writeFileSync(join(bin, 'Processing.NDI.Lib.Licenses.txt'), 'Lizenztext der Attrappe\n');
    const r = spawnSync(process.execPath, [join(tools, 'bundle-ndi.mjs')], {
      env: { ...process.env, NDI_SDK_DIR: join(tmp, 'sdk') },
      encoding: 'utf8',
    });
    const ziel = join(tmp, 'apps', app, 'resources', 'bin', 'win');
    return {
      status: r.status,
      ausgabe: `${r.stdout ?? ''}${r.stderr ?? ''}`,
      kopiert: existsSync(ziel) ? readdirSync(ziel).sort() : null,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

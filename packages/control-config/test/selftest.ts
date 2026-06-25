// Mini-Selbsttest (kein Framework): node --experimental-strip-types test/selftest.ts
// Reines node:fs/os/path — kein Electron nötig (appData-Root = temp-Verzeichnis).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  controlConfigPath,
  readControlConfig,
  writeControlConfig,
  controlServerOptions,
} from '../src/index.ts';

let failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) console.log(`ok   ${msg}`);
  else {
    failed++;
    console.error(`FAIL ${msg}`);
  }
}
const eq = (a: unknown, b: unknown, msg: string): void => ok(JSON.stringify(a) === JSON.stringify(b), msg);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jmcc-'));

// Fehlende Datei → leere Konfig → open (kein Verhaltenswechsel).
eq(readControlConfig(dir), {}, 'fehlende Konfig → {}');
eq(controlServerOptions(readControlConfig(dir)), {}, 'leere Konfig → keine Server-Optionen (open)');

ok(controlConfigPath(dir).endsWith(path.join('JM Production Suite', 'control.json')), 'controlConfigPath unter Suite-Dir');

// Schreiben + Lesen (secure + Token + Bind).
writeControlConfig(dir, { mode: 'secure', token: 'T0KEN', bindHost: '0.0.0.0', signKey: 'SK' });
const cfg = readControlConfig(dir);
eq(cfg, { mode: 'secure', token: 'T0KEN', bindHost: '0.0.0.0', signKey: 'SK' }, 'read = write (round-trip)');
eq(
  controlServerOptions(cfg),
  { mode: 'secure', bindHost: '0.0.0.0', auth: { token: 'T0KEN' } },
  'controlServerOptions: token → auth, mode/bindHost übernommen',
);

// TLS inline.
writeControlConfig(dir, { mode: 'secure', token: 'T', tls: { cert: 'C', key: 'K' }, tlsFingerprint: 'ff' });
const opts = controlServerOptions(readControlConfig(dir));
eq(opts.tls, { cert: 'C', key: 'K' }, 'controlServerOptions: TLS inline durchgereicht');

// Defensive: Müll/Teilschrott wird ignoriert.
fs.writeFileSync(controlConfigPath(dir), '{ kaputt');
eq(readControlConfig(dir), {}, 'defektes JSON → {}');
fs.writeFileSync(controlConfigPath(dir), JSON.stringify({ mode: 'unsinn', token: 123, extra: 'x' }));
eq(readControlConfig(dir), {}, 'unbekannte/falsch-typisierte Felder → {}');

fs.rmSync(dir, { recursive: true, force: true });
console.log(failed === 0 ? '\nALLE TESTS OK' : `\n${failed} FEHLER`);
process.exit(failed === 0 ? 0 : 1);

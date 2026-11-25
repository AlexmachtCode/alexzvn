// Selbsttest des Ausgabefenster-Zustands (UX Welle 2a) und des Bildschirm-Ereignisses (UX Welle 2b). Läuft ohne Electron:
// `npm run selftest -w @jm/output-window`.
import { bildschirmeTests } from './bildschirme.test.ts';
import { zustandTests } from './zustand.test.ts';

let failures = 0;
function assert(cond: boolean, name: string): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
  }
}

zustandTests(assert);
await bildschirmeTests(assert);

if (failures) {
  console.error(`\n${failures} Selbsttest(s) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle @jm/output-window-Selbsttests grün.');

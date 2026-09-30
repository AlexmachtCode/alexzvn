// Selbsttests @jm/master-link — npm run selftest -w @jm/master-link
// Jede Testdatei exportiert laufe(); die Reihenfolge ist fest, damit Ausgaben lesbar bleiben.
import { bilanz } from './helfer';
import { laufe as code } from './code.test';

for (const laufe of [code]) {
  await laufe();
}
bilanz();

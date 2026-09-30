// Selbsttests @jm/master-link — npm run selftest -w @jm/master-link
// Jede Testdatei exportiert laufe(); die Reihenfolge ist fest, damit Ausgaben lesbar bleiben.
import { bilanz } from './helfer';
import { laufe as code } from './code.test';
import { laufe as beweis } from './beweis.test';
import { laufe as rahmen } from './rahmen.test';

for (const laufe of [code, beweis, rahmen]) {
  await laufe();
}
bilanz();

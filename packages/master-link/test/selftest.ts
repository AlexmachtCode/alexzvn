// Selbsttests @jm/master-link — npm run selftest -w @jm/master-link
// Jede Testdatei exportiert laufe(); die Reihenfolge ist fest, damit Ausgaben lesbar bleiben.
import { bilanz } from './helfer';
import { laufe as code } from './code.test';
import { laufe as beweis } from './beweis.test';
import { laufe as rahmen } from './rahmen.test';
import { laufe as adresswahl } from './adresswahl.test';
import { laufe as fehler } from './fehler.test';

for (const laufe of [code, beweis, rahmen, adresswahl, fehler]) {
  await laufe();
}
bilanz();

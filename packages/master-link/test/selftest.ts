// Selbsttests @jm/master-link — npm run selftest -w @jm/master-link
// Jede Testdatei exportiert laufe(); die Reihenfolge ist fest, damit Ausgaben lesbar bleiben.
import { bilanz } from './helfer';
import { laufe as code } from './code.test';
import { laufe as beweis } from './beweis.test';
import { laufe as rahmen } from './rahmen.test';
import { laufe as adresswahl } from './adresswahl.test';
import { laufe as fehler } from './fehler.test';
import { laufe as datei } from './datei.test';
import { laufe as speicher } from './speicher.test';
import { laufe as mdns } from './mdns.test';

for (const laufe of [code, beweis, rahmen, adresswahl, fehler, datei, speicher, mdns]) {
  await laufe();
}
bilanz();

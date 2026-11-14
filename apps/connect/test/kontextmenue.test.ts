// Rechtsklick-Menü für Eingabefelder (#301) OHNE Electron (tsx): npm run selftest -w @jm/connect
// Die Vorlage ist eine reine Funktion; die Anbindung an die Fenster (browser-window-created) steht in index.ts.
import { readFileSync } from 'node:fs';
import { kontextMenueVorlage } from '../src/main/kontextmenue';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

const alle = { canCut: true, canCopy: true, canPaste: true };

ck('K1 nicht bearbeitbar → kein Menü (null)', kontextMenueVorlage({ isEditable: false, editFlags: alle }) === null);

const v = kontextMenueVorlage({ isEditable: true, editFlags: alle });
ck('K2 bearbeitbar → genau drei Einträge', Array.isArray(v) && v.length === 3);
ck('K3 Reihenfolge und Rollen: cut, copy, paste', !!v && v[0].role === 'cut' && v[1].role === 'copy' && v[2].role === 'paste');
ck('K4 deutsche Texte', !!v && v[0].label === 'Ausschneiden' && v[1].label === 'Kopieren' && v[2].label === 'Einfügen');
ck('K5 alle Flags true → alle enabled', !!v && v.every((e) => e.enabled === true));

// Passwortfeld: Electron meldet canCut/canCopy selbst als false, Einfügen bleibt möglich.
const pw = kontextMenueVorlage({ isEditable: true, editFlags: { canCut: false, canCopy: false, canPaste: true } });
ck('K6 Passwortfeld: Ausschneiden/Kopieren aus, Einfügen an', !!pw && pw[0].enabled === false && pw[1].enabled === false && pw[2].enabled === true);

const gemischt = kontextMenueVorlage({ isEditable: true, editFlags: { canCut: true, canCopy: true, canPaste: false } });
ck('K7 Zwischenablage leer: nur Einfügen aus', !!gemischt && gemischt[0].enabled === true && gemischt[1].enabled === true && gemischt[2].enabled === false);

// Nicht bearbeitbar gewinnt auch gegen gesetzte Flags (z. B. markierter Text auf einer Fläche).
ck('K8 nicht bearbeitbar trotz canCopy → null', kontextMenueVorlage({ isEditable: false, editFlags: { canCut: false, canCopy: true, canPaste: false } }) === null);

// Anbindung (Quelltext, Electron läuft im Test nicht): einmal global, deckt Haupt- und Peer-Fenster.
const index = readFileSync(new URL('../src/main/index.ts', import.meta.url), 'utf8');
ck('K9 index.ts: browser-window-created + context-menu → kontextMenueVorlage', /browser-window-created/.test(index) && /'context-menu'/.test(index) && /kontextMenueVorlage\(params\)/.test(index));
const modul = readFileSync(new URL('../src/main/kontextmenue.ts', import.meta.url), 'utf8');
ck('K10 kontextmenue.ts importiert aus electron nur Typen', !/import\s+(?!type)[^;]*from 'electron'/.test(modul));

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

#!/usr/bin/env node
// Belegt OHNE Meeting, dass der native Befehlsleser "audio":true/false
// wirklich liest - und dass ein Wert, der WEDER true NOCH false ist, gemeldet
// wird statt still als "an" durchzugehen. Ohne diesen Beleg saehe ein
// ignorierter Schalter genauso aus wie ein befolgter - er ist bis zum ersten
// echten Ton unsichtbar.
//
// WAS DIESER LAUF NICHT ZEIGT: ob je ein Ton fliesst. Er prueft genau eine
// stderr-Zeile je Abo und eine stdout-Zeile fuer den unlesbaren Fall, ohne
// SDK-Anmeldung, ohne Meeting, ohne NDI-Empfaenger.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { binPath } from '../src/bridge.ts';

const require = createRequire(import.meta.url);
// Nebenwirkung: haengt die NDI-Laufzeit an process.env.PATH (siehe
// packages/ndi/index.js). Ohne sie startet zoom-bridge.exe gar nicht.
require('@jm/ndi');

const zoomBin = process.env.ZOOM_SDK_DIR ? `${process.env.ZOOM_SDK_DIR}\\x64\\bin;` : '';
const child = spawn(binPath(), [], {
  windowsHide: true,
  env: { ...process.env, PATH: `${zoomBin}${process.env.PATH}` },
});

let err = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', (d) => { err += d; });

// stdout MITLESEN, nicht nur stderr: der vierte Fall unten wird als
// JSON-Ereignis gemeldet (Maschinenkanal), waehrend die drei bestehenden
// Faelle an einer Klartextzeile haengen (Menschenkanal).
let out = '';
child.stdout.setEncoding('utf8');
child.stdout.on('data', (d) => { out += d; });

child.stdin.write('{"cmd":"videoSubscribe","id":42,"audio":false}\n');
child.stdin.write('{"cmd":"videoSubscribe","id":43,"audio":true}\n');
child.stdin.write('{"cmd":"videoSubscribe","id":44}\n');
// VIERTER FALL (Schlusspruefung, Important 6): ein Wert, der WEDER true NOCH
// false ist. Vorher warf main.cpp den Rueckgabewert von boolFromJson() weg -
// dieses Abo bekam still Ton AN, und stderr meldete zufrieden "Ton-Schalter
// fuer 45: an". Ein Bediener haette den doppelten Ton im Saal nirgends
// erklaert bekommen.
child.stdin.write('{"cmd":"videoSubscribe","id":45,"audio":"false"}\n');
child.stdin.end();

child.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Kindprozess endete mit ${code}.`);
    console.error('Vermutlich fehlt %ZOOM_SDK_DIR%\\x64\\bin auf PATH oder das Programm existiert nicht.');
    process.exit(1);
  }
  const zeilen = err.split(/\r?\n/);
  // Das KOMMA hinter der Kennung gehoert zum Suchmuster: ohne es faende
  // "videoSubscribe 4" auch die Zeilen fuer 42, 43, 44 und 45.
  const fuer = (id) => zeilen.find((z) => z.includes(`videoSubscribe ${id},`)) ?? '';
  const faelle = [
    // Auf den GANZEN Ausdruck pruefen, nicht auf "an"/"aus" allein: "an"
    // steckt in genug deutschen Woertern, um irgendwann zufaellig zu passen -
    // eine Zusicherung, die aus Versehen gruen wird, prueft nichts mehr.
    ['audio:false wird gelesen', fuer(42).includes('Ton-Schalter aus')],
    ['audio:true wird gelesen', fuer(43).includes('Ton-Schalter an')],
    ['ohne Feld gilt die Vorgabe an', fuer(44).includes('Ton-Schalter an')],
    // ZWEI Zusicherungen fuer den vierten Fall, und beide werden gebraucht:
    // die erste belegt, dass GEMELDET wird, die zweite, dass der Schalter
    // nicht still auf "an" durchgeht. Eine Meldung, nach der das Abo trotzdem
    // mit Ton angelegt wuerde, waere kein Fortschritt - und eine ausbleibende
    // Zeile allein waere kein Beleg, sie koennte auch heissen, dass der
    // Befehl irgendwo anders liegengeblieben ist.
    ['ein unlesbarer Ton-Schalter wird gemeldet', out.includes('"code":"videoBadAudioFlag"')],
    ['ein unlesbarer Ton-Schalter geht NICHT still als an durch', fuer(45) === ''],
  ];
  let schlecht = 0;
  for (const [name, ok] of faelle) {
    console.log(`  [${name}] ${ok ? 'OK' : 'FEHLGESCHLAGEN'}`);
    if (!ok) schlecht++;
  }
  if (schlecht > 0) {
    console.error('\nFEHLGESCHLAGEN — der Ton-Schalter kommt nicht an.');
    // BEIDE Kanaele ausgeben: seit dem vierten Fall haengt eine der
    // Zusicherungen an stdout, und ein Fehlschlag, dessen Beleg man nicht
    // sieht, ist nur eine halbe Meldung.
    console.error('Rohausgabe stderr:\n' + err);
    console.error('Rohausgabe stdout:\n' + out);
    process.exit(2);
  }
  console.log('\nOK — der native Befehlsleser liest den Ton-Schalter.');
});

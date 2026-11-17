#!/usr/bin/env node
// Prueft OHNE Zoom, OHNE Meeting und OHNE Anmeldung, dass die Bridge einen
// NDI-Sender aufmacht, den ein anderer Prozess auch FINDET. Sucht mit dem
// bestehenden Addon aus packages/ndi - das ist ein unabhaengiger Zeuge:
// derselbe Code, mit dem der Switcher seine Quellen findet. Seit #310 prueft
// derselbe Zeuge auch die EINGEPASSTEN Bilder (16:9-Rahmen mit durchsichtigen
// Seiten), die --ndi-selftest direkt und ueber den Versatzweg sendet - siehe
// Rueckgabe 7 unten.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { binPath } from '../src/bridge.ts';
import { LineSplitter, parseWireEvent } from '../src/protocol.ts';

const require = createRequire(import.meta.url);
// Laedt das native NDI-Addon UND haengt dabei (Nebenwirkung von
// packages/ndi/index.js, ensureNdiRuntimeOnPath()) das Verzeichnis der
// NDI-Laufzeit-DLL vorn an process.env.PATH - fuer DIESEN Prozess. Der
// Spawn unten erbt process.env und damit auch diese Erweiterung, SOFERN wir
// PATH weiter unten nicht durch ein eigenes env-Objekt ersetzen, ohne es
// wieder mit hineinzunehmen.
const ndi = require('@jm/ndi');

// ABWEICHUNG VOM BRIEF, GEMESSEN: Name OHNE Doppelpunkt - siehe den
// gleichlautenden Kommentar bei s.open(...) in native/main.cpp. Die NDI-SDK
// ersetzt ':' im Quellnamen durch ein Leerzeichen (Quellname dient zugleich
// als mDNS/Bonjour-Dienstname); mit Doppelpunkt haette dieser Pruefstand auf
// KEINEM Rechner je "gefunden" liefern koennen. Muss mit dem Namen in
// native/main.cpp (s.open(...)) uebereinstimmen.
const ERWARTET = 'JM Connect – Zoom Selbsttest';

// ABWEICHUNG VOM BRIEF, GEMESSEN: --ndi-selftest ruft Zooms InitSDK NIE auf,
// BRAUCHT die Zoom-SDK-DLL aber trotzdem zum Laden - zoom-bridge.exe ist
// weiterhin gegen sdk.lib (Zoom-SDK-Importbibliothek) UND jetzt zusaetzlich
// gegen die NDI-Importbibliothek gebunden, und der Windows-Lader loest ALLE
// eingebundenen DLLs beim Prozessstart auf, BEVOR main() ueberhaupt laeuft -
// unabhaengig davon, ob der Code den Zoom-Teil je aufruft. Ohne
// %ZOOM_SDK_DIR%\x64\bin auf PATH scheitert der Start deshalb mit
// STATUS_DLL_NOT_FOUND (0xC0000135) - ein Zoom-EINRICHTUNGSFEHLER, der sich
// sonst als "NDI-Quelle nicht gefunden" tarnen wuerde (siehe die
// Ursachen-Unterscheidung weiter unten, die genau das auseinanderhaelt).
// GEMESSEN vor dieser Zeile: der Kindprozess kam nie bis zur ersten
// emitRaw()-Zeile, weder auf stdout noch auf stderr. Dieselbe Abhaengigkeit
// dokumentiert bereits README.md Abschnitt 8 und loest bereits test/join.mjs
// auf demselben Weg (env.PATH = "<sdk>/x64/bin;" + process.env.PATH). Hier
// derselbe Weg, nur mit dem bereits (durch require('@jm/ndi') oben) um die
// NDI-Laufzeit erweiterten process.env als Grundlage, damit beide
// Erweiterungen gemeinsam gelten.
const zoomBin = process.env.ZOOM_SDK_DIR ? `${process.env.ZOOM_SDK_DIR}\\x64\\bin;` : '';
const child = spawn(binPath(), ['--ndi-selftest'], {
  windowsHide: true,
  env: { ...process.env, PATH: `${zoomBin}${process.env.PATH}` },
});
// NACHBESSERUNG (Runde 1, Befund 1): Exitcode UND Rohausgabe des Kindes
// werden ausgewertet, nicht nur "wurde die Quelle gefunden" - vorher meldeten
// ein falscher Name, ein nicht startender Prozess (z. B. fehlendes
// %ZOOM_SDK_DIR%\x64\bin auf PATH, siehe Kommentar oben) und ein
// fehlgeschlagenes NDIlib_initialize() alle DIESELBE Meldung
// "FEHLGESCHLAGEN ... wurde nicht gefunden" - drei Ursachen hinter einem
// Namen, gegen die Kernregel "eine Ursache, ein Name". Mitgelesen wird per
// LineSplitter/parseWireEvent (derselbe Zerleger wie in src/bridge.ts), nicht
// per Text-Grep auf die Rohzeile.
//
// Rueckgabewerte dieses Pruefstands, EINE Ursache je Wert:
//   0 - Quelle gefunden UND Ton angekommen.
//   1 - Quelle nicht gefunden (Sammelfall, letzter Ausweg).
//   2 - ndiInitFailed: die NDI-Laufzeit fehlt auf diesem Rechner.
//   3 - die Bruecke kam nie bis "sending".
//   4 - videoSenderFailed: NDIlib_send_create ist fehlgeschlagen.
//   5 - Quelle gefunden, aber KEIN Ton angekommen. Das ist NICHT derselbe
//       Fall wie 3: 3 heisst "kam nie bis sending" (die Quelle warb also nie
//       fuer sich), 5 heisst "die Quelle warb, aber schwieg beim Ton" - zwei
//       verschiedene Orte zum Suchen, die dieselbe Zahl gegeneinander
//       verwechselbar gemacht haette.
//   6 - Quelle gefunden, aber createReceiver() ist FEHLGESCHLAGEN (wirft in
//       @jm/ndi statt false zurueckzugeben). Auch das ist NICHT derselbe Fall
//       wie 5: 5 heisst "verbunden, aber nichts gehoert" - ein Befund UEBER
//       DEN TONWEG. 6 heisst "gar nicht erst verbunden" - ein Befund UEBER
//       DIE NDI-VERBINDUNG selbst, bevor der Tonweg ueberhaupt geprueft
//       werden konnte. Wer 5 liest, sucht im Audio-Pfad; wer 6 liest, sucht
//       in der NDI-Empfaenger-Anlage - unterschiedliche Stellen, darum
//       unterschiedliche Zahlen.
//   7 - Quelle gefunden UND Ton angekommen, aber ein eingepasstes Bild (#310)
//       fehlt oder stimmt nicht. --ndi-selftest sendet je Durchlauf einen
//       fertigen 1920x1080-Rahmen DIREKT (sendUYVA) und ein 360x640-Rohbild
//       ueber den VERSATZWEG (sendI420Einpassen, Rahmen 1280x720, Staffel).
//       Ein Bild gilt, wenn es als BGRA ankommt und in der mittleren Zeile
//       an den Seiten (x = 8 und x = Breite - 9) durchsichtig, in der Mitte
//       (x = Breite / 2) deckend ist - siehe ALPHA_* unten. Eigene Zahl, NICHT
//       5: 5 sucht im Tonweg, 7 im Bildweg des Einpassens (Rahmen, Alpha,
//       Staffel) - Ton und Verbindung sind bei 7 bereits belegt.
//       Ausgewertet NACH 5 und 6: fehlt der Ton oder die Verbindung, sagt ein
//       fehlendes Bild nichts Eigenes mehr.
let sawSending = false;
let sawNdiInitFailed = false;
let sawVideoSenderFailed = false;
let spawnError = null;
const splitter = new LineSplitter();

// NUR aufgesetzt, NICHT hier schon abgewartet - das muss NACH der
// Sucheschleife UND der Tonpruefung unten passieren, sonst wuerde auf das
// Prozessende gewartet, BEVOR ueberhaupt einmal gesucht oder empfangen wurde,
// und die fuenf Sekunden Sendezeit waeren dafuer verloren.
const exitPromise = new Promise((resolve) => {
  child.on('exit', (code) => resolve(code));
  // Eine gescheiterte spawn() (z. B. binPath() zeigt ins Leere) darf nicht
  // als unbeantwortete Promise haengen bleiben - dann waere aus einem
  // gemeldeten Fehler ein STILLER Haenger geworden.
  child.on('error', (e) => {
    spawnError = e;
    resolve(null);
  });
});

child.stdout.setEncoding('utf8');
child.stdout.on('data', (d) => {
  process.stdout.write(`  bridge: ${d}`);
  for (const line of splitter.push(d)) {
    const ev = parseWireEvent(line);
    if (!ev) continue;
    if (ev.ev === 'ndiSelftest' && ev.state === 'sending') sawSending = true;
    if (ev.ev === 'error' && ev.code === 'ndiInitFailed') sawNdiInitFailed = true;
    if (ev.ev === 'error' && ev.code === 'videoSenderFailed') sawVideoSenderFailed = true;
  }
});
child.stderr.setEncoding('utf8');
child.stderr.on('data', (d) => process.stderr.write(`  [bridge] ${d}`));

// Der Sender sendet jetzt fuenf Sekunden (150 Durchlaeufe à 33 ms, siehe
// Kommentar im --ndi-selftest-Zweig von native/main.cpp) - bewusst laenger
// als frueher (zwei Sekunden): Suche UND Tonempfang muessen BEIDE noch in
// die Sendezeit passen. Innerhalb dieser Zeit mehrfach suchen: NDI-Erkennung
// im Netz braucht ein paar hundert Millisekunden.
//
// Gemerkt wird der VOLLE Fundname, nicht nur ein Ja/Nein: createReceiver()
// unten braucht ihn woertlich (mit Rechnername/Prozess-Suffix, wie ihn NDI
// im Netz bewirbt).
let gefundenName = null;
for (let i = 0; i < 8 && !gefundenName; i++) {
  for (const s of ndi.findSources(250)) {
    if (String(s).includes(ERWARTET)) {
      gefundenName = s;
      break;
    }
  }
}

// Bildpruefung (#310, Rueckgabe 7). Der Empfaenger in @jm/ndi fordert
// NDIlib_recv_color_format_BGRX_BGRA an; Alpha ist Byte 3 jedes
// 4-Byte-Bildpunkts, Zeile ueber lineStride. GEMESSEN 17.11.2026: auch das
// I420-Schwarz 640x360 (ohne Alpha gesendet) kommt als BGRA an, nicht als
// BGRX - die FourCC allein belegt also KEIN Alpha. Belegt wird es erst durch
// die durchsichtigen Seiten (ALPHA_RAND_MAX).
const FOURCC_BGRA = 0x41524742;
// ANNAHME (Brief): NDI komprimiert Alpha verlustbehaftet - Seiten gelten bis
// 8 als durchsichtig, die Mitte ab 247 als deckend. Die Messwerte stehen in
// jeder Ausgabe, damit eine Abweichung sichtbar wird, statt still zu passen.
const ALPHA_RAND_MAX = 8;
const ALPHA_MITTE_MIN = 247;
// Je Rahmengroesse: wie viele Bilder kamen, die erste Messung, die erste
// FALSCHE Messung. Ein falsches Bild unter richtigen bleibt falsch.
const bilder = new Map([
  ['1920x1080', { gesehen: 0, erste: null, falsch: null }],
  ['1280x720', { gesehen: 0, erste: null, falsch: null }],
]);
// Was sonst ankam (Groesse + Format) - nur fuer die Fehlermeldung: "kam
// nicht" und "kam in anderer Groesse" sind verschiedene Befunde.
const andereBilder = new Set();

function fourCCName(c) {
  return String.fromCharCode(c & 0xff, (c >>> 8) & 0xff, (c >>> 16) & 0xff, (c >>> 24) & 0xff);
}

function bildMessen(f) {
  const zeile = Math.floor(f.height / 2) * f.lineStride;
  const mitteX = Math.floor(f.width / 2);
  const alpha = (x) => f.data[zeile + x * 4 + 3];
  const m = zeile + mitteX * 4;
  return {
    fourCC: f.fourCC,
    links: alpha(8),
    mitteX,
    mitte: alpha(mitteX),
    rechtsX: f.width - 9,
    rechts: alpha(f.width - 9),
    bgr: [f.data[m], f.data[m + 1], f.data[m + 2]],
  };
}

function messungStimmt(m) {
  return (
    m.fourCC === FOURCC_BGRA && m.links <= ALPHA_RAND_MAX && m.rechts <= ALPHA_RAND_MAX && m.mitte >= ALPHA_MITTE_MIN
  );
}

function messText(m) {
  return (
    `${fourCCName(m.fourCC)}, Alpha x=8: ${m.links}, x=${m.mitteX}: ${m.mitte}, x=${m.rechtsX}: ${m.rechts}; ` +
    `BGR x=${m.mitteX}: ${m.bgr.join('/')}`
  );
}

function bildPruefen(f) {
  const groesse = `${f.width}x${f.height}`;
  const e = bilder.get(groesse);
  if (!e) {
    andereBilder.add(`${groesse} ${fourCCName(f.fourCC)}`);
    return;
  }
  const m = bildMessen(f);
  e.gesehen++;
  if (!e.erste) {
    e.erste = m;
    console.log(`  bild ${groesse}: ${messText(m)}`);
  }
  if (!messungStimmt(m) && !e.falsch) {
    e.falsch = m;
    if (e.gesehen > 1) console.log(`  bild ${groesse} (Bild ${e.gesehen}) FALSCH: ${messText(m)}`);
  }
}

function alleBilderGeprueft() {
  for (const e of bilder.values()) if (e.gesehen === 0) return false;
  return true;
}

// Ein Text je Groesse: Messwert des (ersten falschen bzw. ersten) Bildes oder
// "nicht empfangen" samt dem, was stattdessen kam.
function bildBefund(groesse, e) {
  if (e.gesehen === 0) {
    const sonst = andereBilder.size ? [...andereBilder].join(', ') : 'nichts';
    return `nicht empfangen; empfangen wurde: ${sonst}`;
  }
  return `${messText(e.falsch ?? e.erste)}; ${e.gesehen} Bild(er) ${groesse}`;
}

// Tonpruefung: NUR moeglich, waehrend das Kind noch sendet - darum HIER, vor
// dem Warten auf das Prozessende (exitPromise) weiter unten. Ohne das waere
// der Sender laengst zu (TerminateProcess), bevor wir auch nur verbunden
// haetten. Dasselbe gilt seit #310 fuer die Bildpruefung oben.
let tonGesehen = false;
// Getrennt von tonGesehen gehalten: "nicht verbunden bekommen" (Code 6) und
// "verbunden, aber stumm" (Code 5) sind zwei verschiedene Ursachen und
// duerfen nicht ueber denselben Ja/Nein-Wert zusammenfallen - sonst waere
// receiverFehler nur eine Textzeile fuer Menschen, aber fuer die
// Rueckgabewert-Entscheidung unten unsichtbar (dieselbe Falle, die schon
// beim vorherigen Rueckgabewert 3-vs-5 vermieden wurde).
let receiverFehler = null;
if (gefundenName) {
  let empfangBereit = false;
  try {
    empfangBereit = ndi.createReceiver(gefundenName);
  } catch (e) {
    // Nichts verschwindet still: eine gescheiterte Verbindung zur GEFUNDENEN
    // Quelle ist eine eigene, meldenswerte Ueberraschung, kein Grund, die
    // Tonpruefung wortlos zu ueberspringen.
    receiverFehler = e instanceof Error ? e.message : String(e);
    console.error(`\n  createReceiver('${gefundenName}') ist fehlgeschlagen: ${receiverFehler}`);
  }
  if (empfangBereit) {
    // Bis zu 40 * 250 ms Budget (#310: frueher 20, nur Ton), bricht frueher
    // ab, sobald Ton UND je ein Bild beider Einpass-Groessen geprueft sind.
    // So grosszuegig, weil die Suche oben schon bis zu 2 s gekostet haben
    // kann (150-Durchlaeufe-Kommentar oben) - ein zu knappes Budget wuerde
    // einer Quelle, die tatsaechlich sendet, faelschlich "stumm" oder "ohne
    // Bild" vorwerfen. receive() kehrt zurueck, sobald EIN Frame da ist; die
    // 40 zaehlen also Frames (Ton, Schwarz 640x360, beide Rahmen), nicht 10 s.
    for (let i = 0; i < 40 && !(tonGesehen && alleBilderGeprueft()); i++) {
      const f = ndi.receive(250);
      if (f && f.type === 'audio' && !tonGesehen) {
        tonGesehen = true;
        console.log(`  audio: ${f.sampleRate} Hz, ${f.channels} Kanal/Kanaele, ${f.samples} Abtastwerte`);
      }
      if (f && f.type === 'video') bildPruefen(f);
    }
    // Nicht offen lassen: der Prozess endet zwar gleich danach, aber ein
    // Receiver, der nie geschlossen wird, ist ein Aufraeum-Schritt, der
    // fehlt - und genau das soll dieser Pruefstand fuer den PRODUKTIVEN Code
    // vorleben, nicht selbst unterlassen.
    ndi.closeReceiver();
  }
}

const exitCode = await exitPromise;

if (gefundenName) {
  if (tonGesehen) {
    // Rueckgabe 7 (#310): erst hier, nach Verbindung (6) und Ton (5) - beide
    // sind belegt, sobald tonGesehen gilt.
    const falsch = [...bilder].filter(([, e]) => e.gesehen === 0 || e.falsch);
    if (falsch.length > 0) {
      const teile = falsch.map(
        ([groesse, e]) => `eingepasstes Bild ${groesse} fehlt oder stimmt nicht (${bildBefund(groesse, e)})`,
      );
      console.error(`\nTEILWEISE — die Quelle "${ERWARTET}" hat Ton geliefert, aber ${teile.join('; ')}.`);
      process.exit(7);
    }
    const ok = [...bilder].map(([groesse, e]) => `${groesse}: ${bildBefund(groesse, e)}`);
    console.log(
      `\nOK — die Quelle "${ERWARTET}" war auffindbar und hat Ton UND beide eingepassten Bilder geliefert ` +
        `(${ok.join(' | ')}).`,
    );
    process.exit(0);
  }
  // !== null, NICHT der blosse Wahrheitswert (Schlusspruefung, M15): ein
  // Error mit leerer message setzt receiverFehler auf '' - wahrheitswertig
  // falsch, obwohl createReceiver() nachweislich gescheitert ist. Rueckgabe 6
  // fiele dann still auf 5 zurueck, also genau die Vermischung zweier
  // Ursachen, gegen die der Kommentar an receiverFehler oben argumentiert.
  if (receiverFehler !== null) {
    // Code 6, NICHT 5: siehe Kommentar oben - "nicht verbunden" ist eine
    // andere Ursache als "verbunden, aber stumm" und braucht darum einen
    // eigenen Rueckgabewert, keinen geteilten.
    console.error(
      `\nEINRICHTUNGSFEHLER — die Quelle "${ERWARTET}" war auffindbar, aber createReceiver() ist ` +
        `fehlgeschlagen (${receiverFehler}).`,
    );
    process.exit(6);
  }
  console.error(`\nTEILWEISE — die Quelle "${ERWARTET}" war auffindbar, aber es kam KEIN Ton an.`);
  process.exit(5);
}

// Ab hier: NICHT gefunden. Vier unterscheidbare Ursachen, vier Meldungen,
// vier Rueckgabewerte - siehe Kommentar oben.
if (sawNdiInitFailed) {
  console.error(`\nEINRICHTUNGSFEHLER — die NDI-Laufzeit fehlt auf diesem Rechner (ndiInitFailed).`);
  process.exit(2);
}
if (sawVideoSenderFailed) {
  console.error(`\nEINRICHTUNGSFEHLER — NDIlib_send_create ist fehlgeschlagen (videoSenderFailed).`);
  process.exit(4);
}
if (!sawSending) {
  const grund = spawnError ? `spawn-Fehler: ${spawnError.message}` : `Exitcode ${exitCode}`;
  console.error(
    `\nEINRICHTUNGSFEHLER — die Bridge kam nie bis "sending" (${grund}). ` +
      'Vermutlich fehlt %ZOOM_SDK_DIR%\\x64\\bin auf PATH (siehe Kommentar oben) oder das Programm existiert nicht.',
  );
  process.exit(3);
}
console.error(`\nFEHLGESCHLAGEN — die Quelle "${ERWARTET}" wurde nicht gefunden.`);
process.exit(1);

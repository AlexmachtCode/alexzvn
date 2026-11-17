// Prüfstand für den GEPACKTEN Presenter (#298/#299, NDI #303): startet die Exe mit
// Remote-Debugging, steuert sie per Chrome DevTools Protocol und legt echte
// Dateien ab (`Input.dispatchDragEvent` mit `data.files`). Die Gruppe `ndi`
// empfängt die NDI-Quelle der App mit `@jm/ndi` und prüft die Bildpunkte.
//
//   npm run dist:dir          (Windows: mit NDI_SDK_DIR, bündelt NDI ins Paket)
//   node test/pruefstand.mjs [--exe <pfad>] [--nur <gruppe,…>]
//
// Gruppen: siehe GRUPPEN unten. Ausgabe je Fall „  ok  …“ / „FAIL  …“ /
// „skip  … (Grund)“, zuletzt die Summe. Exit 1 bei FAIL, Exit 2, wenn der
// Prüfstand gar nicht laufen kann.
//
// Jede Gruppe startet die App mit eigenem USERPROFILE im Testordner (appData und
// userData liegen dann dort, gemessen) und einer offenen Steuer-Konfiguration nur für
// 127.0.0.1. Das echte Profil des Rechners (%APPDATA%\@jm\presenter, auch die echte
// Steuer-Konfiguration mit TLS und Anmeldung) wird weder gelesen noch geändert; ohne
// eigenes Profil startet der Prüfstand keine App. Zweite Instanzen bekommen dasselbe
// Profil, sonst griffe der Single-Instance-Lock nicht. Läuft schon ein JM Presenter,
// bricht der Prüfstand trotzdem ab (gleicher Prozessname, Steuer- und Debug-Port), statt
// still mit der falschen App zu reden. Er beendet nur Prozessbäume, die er selbst gestartet hat.
// Windows, Node ≥ 22 (globales WebSocket); pdf-lib, fflate, @jm/ndi und @electron/asar
// (über electron-builder) aus dem Workspace.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFHexString, rgb } from 'pdf-lib';
import { strToU8, zipSync, zlibSync } from 'fflate';
import { zaehleBilder } from './ndi-messung.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const BILD = 'JM Presenter.exe';
const PORT = 9333;
/** TCP-Steuerserver der App (src/main/control-server.ts). */
const STEUER_PORT = 8728;
const LIBREOFFICE = 'C:\\Program Files\\LibreOffice';
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- Ergebnisse

const stand = { ok: 0, fail: 0, skip: 0 };

class Ueberspringen extends Error {}

function ueberspringe(grund) {
  throw new Ueberspringen(grund);
}

function erwarte(bedingung, meldung) {
  if (!bedingung) throw new Error(meldung);
}

async function fall(name, fn) {
  try {
    await fn();
    stand.ok++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    if (e instanceof Ueberspringen) {
      stand.skip++;
      console.log(`skip  ${name} (${e.message})`);
    } else {
      stand.fail++;
      console.log(`FAIL  ${name} – ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

/** Ruft `fn` wiederholt auf, bis `passt(wert)`; liefert den letzten Wert (auch nach Ablauf). */
async function bisWert(fn, passt, ms = 10_000, takt = 100) {
  const ende = Date.now() + ms;
  for (;;) {
    let wert;
    try {
      wert = await fn();
    } catch {
      wert = undefined;
    }
    if (passt(wert) || Date.now() > ende) return wert;
    await pause(takt);
  }
}

/** Wartet, bis `fn()` wahr ist; liefert den letzten Wert (falsy nach Ablauf). */
function warteBis(fn, ms = 10_000, takt = 100) {
  return bisWert(fn, Boolean, ms, takt);
}

// ---------------------------------------------------------------- Prozesse

function presenterLaeuft() {
  const aus = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${BILD}`, '/FO', 'CSV', '/NH'], {
    encoding: 'utf8',
  });
  return aus.includes(`"${BILD}"`);
}

function toeteBaum(pid) {
  try {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    // schon beendet
  }
}

/**
 * Vom Prüfstand gestartete Apps; werden auch bei Fehlern und Strg+C beendet – aber nur, solange ihr Prozess noch
 * läuft (`beendet === null`): Die PID eines beendeten Prozesses kann Windows schon neu vergeben haben, und
 * `taskkill /T` träfe dann einen fremden Prozessbaum.
 */
const laufende = new Set();
process.on('exit', () => {
  for (const app of laufende) if (app.beendet === null) toeteBaum(app.pid);
});
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => process.exit(130));

/**
 * Umgebung ohne ELECTRON_RUN_AS_NODE (sonst startet die Exe als reines Node), dazu `extra`
 * (Schlüssel ohne Rücksicht auf Groß-/Kleinschreibung ersetzt). `extra` muss ein eigenes
 * Profil setzen (siehe eigenesProfil): Ohne liefe die App im echten Profil des Rechners.
 */
function appUmgebung(extra = {}) {
  if (!extra.USERPROFILE) throw new Error('App nur mit eigenem USERPROFILE starten (echtes Profil nie anfassen)');
  const weg = new Set(['ELECTRON_RUN_AS_NODE', ...Object.keys(extra).map((k) => k.toUpperCase())]);
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !weg.has(k.toUpperCase()))),
    ...extra,
  };
}

/** Startet die Exe mit Remote-Debugging. */
function starteApp(exe, args, extra) {
  const kind = spawn(exe, [`--remote-debugging-port=${PORT}`, ...args], { env: appUmgebung(extra), stdio: 'ignore' });
  const app = { pid: kind.pid, ziele: [], beendet: null };
  kind.on('exit', (code, signal) => {
    app.beendet = `Code ${code ?? signal}`;
  });
  kind.on('error', (e) => {
    app.beendet = e.message;
  });
  if (kind.pid) laufende.add(app);
  return app;
}

async function beendeApp(app) {
  for (const ziel of app.ziele) ziel.schliesse();
  // Hat sich die App schon selbst beendet (Fälle 11 und 14), gehört die PID evtl. schon einem fremden Prozess.
  if (app.pid && app.beendet === null) toeteBaum(app.pid);
  laufende.delete(app);
  // Erst wenn alle Prozesse weg sind, ist der Single-Instance-Lock frei.
  const weg = await warteBis(() => !presenterLaeuft(), 15_000, 250);
  if (!weg) throw new Error('Presenter-Prozesse laufen nach taskkill weiter');
}

/**
 * Startet die Exe noch einmal mit `args`, wie Windows bei Doppelklick/„Öffnen mit“: OHNE
 * Remote-Debugging. Sie reicht ihre Kommandozeile an die laufende App weiter und beendet sich
 * selbst (Single-Instance-Lock). Wartet, bis sie weg ist. `extra` = dasselbe Profil wie die
 * laufende App, sonst findet sie deren Lock nicht und startet als erste Instanz.
 */
async function zweiteInstanz(exe, args, extra) {
  const kind = spawn(exe, args, { env: appUmgebung(extra), stdio: 'ignore' });
  const app = { pid: kind.pid, ziele: [], beendet: null };
  if (kind.pid) laufende.add(app);
  const ende = await new Promise((res) => {
    const t = setTimeout(() => res(null), 15_000);
    kind.on('exit', (code, signal) => {
      clearTimeout(t);
      res(`Code ${code ?? signal}`);
    });
    kind.on('error', (e) => {
      clearTimeout(t);
      res(e.message);
    });
  });
  laufende.delete(app);
  if (ende === null) {
    if (kind.pid) toeteBaum(kind.pid);
    throw new Error('zweite Instanz beendet sich nicht (Single-Instance-Lock?)');
  }
}

/**
 * Startet die App mit dem Profil `extra` (eigenesProfil), öffnet den Editor, führt `fn(app, editor)`
 * aus, beendet die App immer.
 */
async function mitApp(gruppe, exe, args, fn, extra) {
  let app = null;
  try {
    app = starteApp(exe, args, extra);
    const editor = await oeffneEditor(app);
    await fn(app, editor);
  } catch (e) {
    stand.fail++;
    console.log(`FAIL  ${gruppe}: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    try {
      if (app) await beendeApp(app);
    } catch (e) {
      stand.fail++;
      console.log(`FAIL  ${gruppe}: ${e.message}`);
    }
  }
}

/**
 * Eigenes Benutzerprofil unter `dir`: Mit umgelenktem USERPROFILE liegen appData und userData der
 * gepackten App darin (gemessen). Dort eine OFFENE Steuer-Konfiguration nur für 127.0.0.1 – ohne sie
 * lauschte der Steuerserver offen auf allen Adressen. Die echte Konfiguration des Rechners (TLS +
 * Anmeldung) wird weder gelesen noch geändert.
 */
function eigenesProfil(dir) {
  const suite = path.join(dir, 'AppData', 'Roaming', 'JM Production Suite');
  fs.mkdirSync(suite, { recursive: true });
  fs.mkdirSync(path.join(dir, 'AppData', 'Local'), { recursive: true });
  fs.writeFileSync(path.join(suite, 'control.json'), JSON.stringify({ mode: 'open', bindHost: '127.0.0.1' }));
  return { USERPROFILE: dir };
}

// ---------------------------------------------------------------- CDP

/** Eine CDP-Verbindung zu einem Fenster (Seite). */
class Ziel {
  #ws;
  #naechste = 0;
  #offen = new Map();
  #warter = [];
  #dialogWarter = null;

  constructor(ws, info) {
    this.#ws = ws;
    this.id = info.id;
    this.url = info.url;
    /** Alle Rückfragen (alert/confirm) dieser Seite. */
    this.dialoge = [];
    /** Rückfragen, die niemand erwartet hat (werden sofort mit „Abbrechen“ beantwortet). */
    this.unerwartet = [];
    ws.addEventListener('message', (ev) => this.#nachricht(JSON.parse(String(ev.data))));
    ws.addEventListener('close', () => {
      for (const { rej } of this.#offen.values()) rej(new Error('CDP-Verbindung geschlossen'));
      this.#offen.clear();
    });
  }

  static async verbinde(info) {
    const ws = new WebSocket(info.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error(`keine CDP-Verbindung zu ${info.url}`)), {
        once: true,
      });
    });
    const ziel = new Ziel(ws, info);
    await ziel.send('Page.enable');
    return ziel;
  }

  send(method, params = {}, ms = 30_000) {
    const id = ++this.#naechste;
    return new Promise((res, rej) => {
      const t = setTimeout(() => {
        this.#offen.delete(id);
        rej(new Error(`CDP ${method}: keine Antwort nach ${ms} ms`));
      }, ms);
      this.#offen.set(id, {
        res: (v) => {
          clearTimeout(t);
          res(v);
        },
        rej: (e) => {
          clearTimeout(t);
          rej(e);
        },
      });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Nächstes Ereignis `methode` (Parameter), sonst Fehler nach `ms`. */
  warteAuf(methode, ms = 10_000) {
    return new Promise((res, rej) => {
      const w = { methode, res: null };
      const t = setTimeout(() => {
        this.#warter = this.#warter.filter((x) => x !== w);
        rej(new Error(`kein ${methode} nach ${ms} ms`));
      }, ms);
      w.res = (p) => {
        clearTimeout(t);
        res(p);
      };
      this.#warter.push(w);
    });
  }

  /** Die nächste Rückfrage bleibt offen und wird geliefert; der Aufrufer beantwortet sie. */
  naechsteRueckfrage(ms = 15_000) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => {
        this.#dialogWarter = null;
        rej(new Error(`keine Rückfrage nach ${ms} ms`));
      }, ms);
      this.#dialogWarter = (p) => {
        clearTimeout(t);
        res(p);
      };
    });
  }

  beantworte(accept) {
    return this.send('Page.handleJavaScriptDialog', { accept });
  }

  schliesse() {
    try {
      this.#ws.close();
    } catch {
      // schon zu
    }
  }

  #nachricht(m) {
    if (m.id !== undefined) {
      const o = this.#offen.get(m.id);
      if (!o) return;
      this.#offen.delete(m.id);
      if (m.error) o.rej(new Error(`CDP: ${m.error.message}`));
      else o.res(m.result);
      return;
    }
    if (m.method === 'Page.javascriptDialogOpening') {
      this.dialoge.push(m.params);
      if (this.#dialogWarter) {
        const w = this.#dialogWarter;
        this.#dialogWarter = null;
        w(m.params);
      } else {
        // Eine offene Rückfrage blockiert die Seite; nie hängen bleiben.
        this.unerwartet.push(m.params.message);
        void this.beantworte(false).catch(() => {});
      }
    }
    for (const w of this.#warter.filter((x) => x.methode === m.method)) {
      this.#warter = this.#warter.filter((x) => x !== w);
      w.res(m.params);
    }
  }
}

async function zielListe() {
  const antwort = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return antwort.json();
}

/** Verbindet sich mit dem Fenster, dessen URL `urlTeil` enthält (z. B. `view=editor`). */
async function oeffneZiel(app, urlTeil, ms = 30_000) {
  const ende = Date.now() + ms;
  for (;;) {
    if (app.beendet !== null) throw new Error(`App hat sich beendet (${app.beendet})`);
    let info;
    try {
      info = (await zielListe()).find((t) => t.type === 'page' && t.url.includes(urlTeil));
    } catch {
      // Debug-Port noch nicht offen
    }
    if (info) {
      const ziel = await Ziel.verbinde(info);
      app.ziele.push(ziel);
      return ziel;
    }
    if (Date.now() > ende) throw new Error(`kein Fenster mit „${urlTeil}“ nach ${ms} ms`);
    await pause(200);
  }
}

async function oeffneEditor(app) {
  const editor = await oeffneZiel(app, 'view=editor');
  const bereit = await warteBis(
    () => auswerten(editor, `document.readyState === 'complete' && !!window.jmpr && !!document.querySelector('header')`),
    20_000,
  );
  erwarte(bereit, 'Editor-Fenster wird nicht fertig');
  return editor;
}

/** `Runtime.evaluate` (wartet auf Promises) – nur DOM, `window.jmpr`, `location`. */
async function auswerten(ziel, js, ms) {
  const r = await ziel.send(
    'Runtime.evaluate',
    { expression: js, awaitPromise: true, returnByValue: true },
    ms,
  );
  if (r.exceptionDetails) {
    throw new Error(`JS: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
  }
  return r.result.value;
}

/** Ausdruck, der die DOM-Sonde `fn` mit `args` im Fenster aufruft (fn darf nichts von hier benutzen). */
function imDom(fn, ...args) {
  return `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(', ')})`;
}

const dateiDaten = (pfade) => ({ items: [], files: pfade, dragOperationsMask: 1 });

/** Ein Schritt eines Ziehvorgangs: dragEnter, dragOver, drop oder dragCancel. */
function ziehe(ziel, type, x, y, data) {
  return ziel.send('Input.dispatchDragEvent', { type, x, y, data });
}

/** Legt echte Dateien bei (x, y) ab: dragEnter → dragOver → drop. */
async function ablegen(ziel, pfade, x, y) {
  const data = dateiDaten(pfade);
  for (const type of ['dragEnter', 'dragOver', 'drop']) await ziehe(ziel, type, x, y, data);
}

// ---------------------------------------------------------------- DOM-Sonden
// Laufen im Fenster (per imDom). Lesen nur, was auf dem Bildschirm steht.

function domFolienZahl() {
  const kopf = [...document.querySelectorAll('div')].find((e) => /^Folien · \d+$/.test(e.textContent.trim()));
  return kopf ? Number(kopf.textContent.replace(/\D+/g, '')) : null;
}

function domFehlerZeile() {
  const leiste = [...document.querySelectorAll('div')].find((e) => e.className.includes('bg-[var(--destructive)]'));
  return leiste?.querySelector('span')?.textContent ?? '';
}

function domEnthaelt(text) {
  return document.body.textContent.includes(text);
}

/** Je Knopf, dessen Text `text` enthält: true = bedienbar. */
function domKnoepfe(text) {
  return [...document.querySelectorAll('button')].filter((b) => b.textContent.includes(text)).map((b) => !b.disabled);
}

function domAusgewaehlterTitel() {
  return document.querySelector('input[placeholder="Folientitel"]')?.value ?? null;
}

function domMitte() {
  return { x: Math.round(innerWidth / 2), y: Math.round(innerHeight / 2) };
}

/** Merkt sich passiv (ohne preventDefault), welche Zieh-Ereignisse mit welchen Typen ankommen. */
function domZiehenMitschreiben() {
  if (!window.__pruefstandZiehen) {
    for (const typ of ['dragenter', 'dragover', 'drop']) {
      addEventListener(typ, (e) => window.__pruefstandZiehen.push(`${typ}:${[...e.dataTransfer.types].join('+')}`), true);
    }
  }
  window.__pruefstandZiehen = [];
}

const gezogen = (ziel) => auswerten(ziel, 'window.__pruefstandZiehen ?? []');

/** Legt eine in der Seite erzeugte Datei (ohne Pfad auf der Platte) in der Fenstermitte ab. */
function domLegeOhnePfadAb(name) {
  const dt = new DataTransfer();
  dt.items.add(new File([new Uint8Array([37, 80, 68, 70, 45])], name, { type: 'application/pdf' }));
  const ziel = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  if (!ziel || !dt.types.includes('Files')) return false;
  ziel.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  return true;
}

function domFolienMitten() {
  return [...document.querySelectorAll('aside [draggable="true"]')].map((e) => {
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
}

/** Zahl aus „Folien · N“, null = keine Folienliste (leerer Editor oder fremde Seite). */
const folienZahl = (ziel) => auswerten(ziel, imDom(domFolienZahl));
const fehlerZeile = (ziel) => auswerten(ziel, imDom(domFehlerZeile));
const flaecheSichtbar = (ziel) => auswerten(ziel, imDom(domEnthaelt, 'Dateien hier ablegen'));

async function aktuelleUrl(ziel) {
  try {
    return await auswerten(ziel, 'location.href', 5_000);
  } catch {
    // Seite hängt oder ist weg: Adresse aus der Zielliste
    return (await zielListe()).find((t) => t.id === ziel.id)?.url ?? '(Fenster weg)';
  }
}

// ---------------------------------------------------------------- Testdateien

/**
 * Ein PDF mit Kennwort (Standard-Sicherheit, R2). pdf-lib verschlüsselt nicht; es reicht ein
 * /Encrypt-Eintrag, dessen /U nicht zum leeren Kennwort passt: pdf.js verlangt dann ein
 * Kennwort (PasswordException „No password given“, gemessen mit pdfjs-dist 4.10).
 */
async function geschuetztesPdf() {
  const doc = await PDFDocument.create();
  doc.addPage([480, 270]);
  const ctx = doc.context;
  const sicherheit = ctx.obj({
    Filter: 'Standard',
    V: 1,
    R: 2,
    O: PDFHexString.of('11'.repeat(32)),
    U: PDFHexString.of('22'.repeat(32)),
    P: -4,
  });
  ctx.trailerInfo.Encrypt = ctx.register(sicherheit);
  const id = PDFHexString.of('0123456789abcdef0123456789abcdef');
  ctx.trailerInfo.ID = ctx.obj([id, id]);
  return doc.save({ useObjectStreams: false });
}

/** Ein PDF mit einer Seite `breite`×`hoehe`, ganz in `farbe` gefüllt. */
async function gefuelltesPdf(breite, hoehe, farbe) {
  const doc = await PDFDocument.create();
  doc.addPage([breite, hoehe]).drawRectangle({ x: 0, y: 0, width: breite, height: hoehe, color: farbe });
  return doc.save();
}

/** CRC-32 wie in PNG (Polynom 0xEDB88320). */
function crc32(bytes) {
  let c = ~0;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function pngBlock(typ, daten) {
  const kopf = Buffer.alloc(8);
  kopf.writeUInt32BE(daten.length, 0);
  kopf.write(typ, 4, 'latin1');
  const pruefsumme = Buffer.alloc(4);
  pruefsumme.writeUInt32BE(crc32(Buffer.concat([kopf.subarray(4), daten])), 0);
  return Buffer.concat([kopf, daten, pruefsumme]);
}

/** RGBA-PNG (8 Bit, ohne Zeilenfilter); `zeile(y)` liefert [r, g, b, a] für die ganze Zeile y. */
function rgbaPng(breite, hoehe, zeile) {
  const laenge = 1 + breite * 4; // Filterbyte 0 + Bildpunkte
  const roh = new Uint8Array(laenge * hoehe);
  for (let y = 0; y < hoehe; y++) {
    const farbe = zeile(y);
    for (let x = 0; x < breite; x++) roh.set(farbe, y * laenge + 1 + x * 4);
  }
  const kopf = Buffer.alloc(13); // Bittiefe 8, Farbtyp 6 (RGBA), Kompression/Filter/Zeilensprung 0
  kopf.writeUInt32BE(breite, 0);
  kopf.writeUInt32BE(hoehe, 4);
  kopf[8] = 8;
  kopf[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngBlock('IHDR', kopf),
    pngBlock('IDAT', Buffer.from(zlibSync(roh))),
    pngBlock('IEND', Buffer.alloc(0)),
  ]);
}

async function baueTestdateien() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jmpr-pruefstand-'));
  const p = (name) => path.join(dir, name);
  const pdf = async (seiten) => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < seiten; i++) doc.addPage([480, 270]);
    return doc.save();
  };
  const eins = await pdf(1);
  const d = {
    dir,
    a: p('a.pdf'),
    eins: p('eins.pdf'),
    maerz: p('Präsentation März.PDF'),
    png: p('b.png'),
    rtf: p('brief.rtf'),
    mp4: p('film.mp4'),
    ordner: p('ordner'),
    projekt: p('Projekt.jmpres'),
    show: p('show.jmshow'),
    kaputt: p('kaputt.pdf'),
    geschuetzt: p('geschuetzt.pdf'),
    /** 201 Bilder: eins mehr, als der Hauptprozess je Aufruf annimmt. */
    viele: Array.from({ length: 201 }, (_, i) => p(path.join('viele', `bild-${String(i + 1).padStart(3, '0')}.png`))),
    profil: p('profil'),
    // NDI (#303)
    quer: p('quer.pdf'),
    hoch: p('hoch.pdf'),
    bild: p('bild.png'),
    ndiProjekt: p('ndi.jmpres'),
    ndiProfil: p('ndi-profil'),
  };
  fs.writeFileSync(d.a, await pdf(2));
  fs.writeFileSync(d.eins, eins);
  fs.writeFileSync(d.maerz, await pdf(1));
  fs.writeFileSync(d.png, Buffer.from(PNG_1X1, 'base64'));
  fs.writeFileSync(d.rtf, '{\\rtf1\\ansi Hallo}');
  fs.writeFileSync(d.mp4, Uint8Array.of(0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50));
  fs.mkdirSync(d.ordner);
  // 0 Byte: pdf.js meldet „The PDF file is empty“.
  fs.writeFileSync(d.kaputt, new Uint8Array(0));
  fs.writeFileSync(d.geschuetzt, await geschuetztesPdf());
  fs.mkdirSync(p('viele'));
  for (const v of d.viele) fs.writeFileSync(v, Buffer.from(PNG_1X1, 'base64'));
  // Format wie src/renderer/src/lib/project-file.ts
  const manifest = {
    schemaVersion: 1,
    name: 'Projekt',
    sources: [{ id: 'src1', kind: 'pdf', name: 'eins.pdf', pageCount: 1 }],
    slides: [
      { id: 's1', sourceId: 'src1', pageIndex: 0, title: 'Projektfolie', notes: '', hidden: false, overlays: [] },
    ],
  };
  fs.writeFileSync(
    d.projekt,
    zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)), 'sources/src1': eins }, { level: 0 }),
  );
  // Format wie packages/show; das Dokument relativ zur Show-Datei
  fs.writeFileSync(
    d.show,
    JSON.stringify({ schemaVersion: 1, name: 'Prüfstand', tools: [{ appId: 'jm-presenter', document: 'Projekt.jmpres' }] }),
  );
  // NDI (#303): quer (schwarz, füllt 16:9), hoch (weiß, schmaler), Bild oben rot deckend, unten durchsichtig.
  const quer = await gefuelltesPdf(480, 270, rgb(0, 0, 0));
  const hoch = await gefuelltesPdf(270, 480, rgb(1, 1, 1));
  const bild = rgbaPng(900, 1600, (y) => (y < 800 ? [255, 0, 0, 255] : [0, 0, 0, 0]));
  fs.writeFileSync(d.quer, quer);
  fs.writeFileSync(d.hoch, hoch);
  fs.writeFileSync(d.bild, bild);
  const ndiManifest = {
    schemaVersion: 1,
    name: 'NDI',
    sources: [
      { id: 'quer', kind: 'pdf', name: 'quer.pdf', pageCount: 1 },
      { id: 'hoch', kind: 'pdf', name: 'hoch.pdf', pageCount: 1 },
      { id: 'bild', kind: 'image', name: 'bild.png', pageCount: 1 },
    ],
    slides: [
      { id: 'n1', sourceId: 'quer', pageIndex: 0, title: 'quer', notes: '', hidden: false, overlays: [] },
      { id: 'n2', sourceId: 'hoch', pageIndex: 0, title: 'hoch', notes: '', hidden: false, overlays: [] },
      { id: 'n3', sourceId: 'bild', pageIndex: 0, title: 'Bild', notes: '', hidden: false, overlays: [] },
    ],
    wiedergabe: { uebergang: { art: 'blende', dauerMs: 1000 }, schleife: false, standzeitSek: 10 },
  };
  fs.writeFileSync(
    d.ndiProjekt,
    zipSync(
      { 'manifest.json': strToU8(JSON.stringify(ndiManifest)), 'sources/quer': quer, 'sources/hoch': hoch, 'sources/bild': bild },
      { level: 0 },
    ),
  );
  return d;
}

// ---------------------------------------------------------------- Gruppen

async function gruppeAblage({ exe, d }) {
  const umgebung = eigenesProfil(path.join(d.dir, 'profil-ablage'));
  await mitApp('ablage', exe, [], async (_app, ed) => {
    const { x, y } = await auswerten(ed, imDom(domMitte));

    // Seiten-JS darf keine Pfade an den Hauptprozess schicken; der Preload holt sie selbst.
    await fall('Hauptwelt ohne Pfad-Kanal: window.jmpr.files.importPaths und .pfadFuer gibt es nicht', async () => {
      const typen = await auswerten(ed, '[typeof window.jmpr.files.importPaths, typeof window.jmpr.files.pfadFuer]');
      erwarte(JSON.stringify(typen) === '["undefined","undefined"]', `importPaths/pfadFuer: ${typen.join(' / ')}`);
    });

    await fall('leerer Editor: a.pdf (2 Seiten) + b.png ablegen → Folien · 3, keine Fehlerzeile', async () => {
      erwarte((await folienZahl(ed)) === null, 'Editor ist nicht leer');
      await ablegen(ed, [d.a, d.png], x, y);
      const n = await bisWert(() => folienZahl(ed), (v) => v === 3);
      erwarte(n === 3, `Folien · ${n ?? '–'} statt 3`);
      const f = await fehlerZeile(ed);
      erwarte(f === '', `Fehlerzeile: „${f}“`);
    });

    await fall('„Präsentation März.PDF“ wird angehängt → Folien · 4, erste Folie bleibt ausgewählt', async () => {
      await ablegen(ed, [d.maerz], x, y);
      const n = await bisWert(() => folienZahl(ed), (v) => v === 4);
      erwarte(n === 4, `Folien · ${n ?? '–'} statt 4`);
      const titel = await auswerten(ed, imDom(domAusgewaehlterTitel));
      erwarte(titel === 'a 1', `ausgewählt ist „${titel}“ statt „a 1“`);
    });

    await fall('brief.rtf + film.mp4 → Folien · 5, Fehlerzeile nennt film.mp4', async () => {
      if (!fs.existsSync(LIBREOFFICE)) ueberspringe(`${LIBREOFFICE} fehlt`);
      await ablegen(ed, [d.rtf, d.mp4], x, y);
      const n = await bisWert(() => folienZahl(ed), (v) => v === 5, 120_000, 250);
      erwarte(n === 5, `Folien · ${n ?? '–'} statt 5`);
      const soll = 'Nicht unterstützt, übersprungen: film.mp4';
      const f = await bisWert(() => fehlerZeile(ed), (v) => v?.includes(soll), 5_000);
      erwarte(f?.includes(soll), `Fehlerzeile: „${f}“`);
    });

    await fall('Ordner ablegen → Folienzahl gleich, Fehlerzeile nennt ihn, Import-Knopf wieder bedienbar', async () => {
      const vorher = await folienZahl(ed);
      await ablegen(ed, [d.ordner], x, y);
      const soll = 'Nicht unterstützt, übersprungen: ordner';
      const f = await bisWert(() => fehlerZeile(ed), (v) => v?.includes(soll));
      erwarte(f?.includes(soll), `Fehlerzeile: „${f}“`);
      const n = await folienZahl(ed);
      erwarte(n === vorher, `Folien · ${n ?? '–'} statt ${vorher ?? '–'}`);
      // „PDF / Bilder importieren“ (leerer Editor) bzw. „+ PDF / Bilder“ (Werkzeugleiste)
      const k = await bisWert(() => auswerten(ed, imDom(domKnoepfe, 'PDF / Bilder')), (v) => v?.length > 0 && v.every(Boolean), 5_000);
      erwarte(k?.length > 0 && k.every(Boolean), `Import-Knopf gesperrt (busy hängt): ${JSON.stringify(k)}`);
    });

    await fall('beim Ziehen einer Datei steht „Dateien hier ablegen“ im Fenster, nach dem Ablegen nicht mehr', async () => {
      const vorher = await folienZahl(ed);
      const data = dateiDaten([d.eins]);
      let abgelegt = false;
      try {
        await ziehe(ed, 'dragEnter', x, y, data);
        await ziehe(ed, 'dragOver', x, y, data);
        erwarte(await warteBis(() => flaecheSichtbar(ed), 3_000), 'keine Ablege-Fläche beim dragOver');
        await ziehe(ed, 'drop', x, y, data);
        abgelegt = true;
      } finally {
        if (!abgelegt) await ziehe(ed, 'dragCancel', x, y, data).catch(() => {});
      }
      erwarte(await warteBis(async () => !(await flaecheSichtbar(ed)), 3_000), 'Ablege-Fläche bleibt nach dem drop');
      const n = await bisWert(() => folienZahl(ed), (v) => v === vorher + 1);
      erwarte(n === vorher + 1, `Folien · ${n ?? '–'} statt ${vorher + 1}`);
    });

    // Kein Umsortier-Test: CDP kann kein dragstart auslösen, die Folienliste sieht also kein
    // eigenes Ziehen. Geprüft wird nur, dass Ziehen OHNE Dateien (text/plain, wie beim
    // Umsortieren) keine Ablege-Fläche zeigt und nichts importiert.
    await fall('Ziehen ohne Dateien (text/plain, von Folie 1 nach Folie 3) → keine Ablege-Fläche, Folienzahl gleich', async () => {
      const vorher = await folienZahl(ed);
      const m = await auswerten(ed, imDom(domFolienMitten));
      erwarte(m.length >= 3, `nur ${m.length} Folien in der Liste`);
      const data = { items: [{ mimeType: 'text/plain', data: 'x' }], dragOperationsMask: 1 };
      await auswerten(ed, imDom(domZiehenMitschreiben));
      await ziehe(ed, 'dragEnter', m[0].x, m[0].y, data);
      await ziehe(ed, 'dragOver', m[2].x, m[2].y, data);
      await pause(300);
      const flaeche = await flaecheSichtbar(ed);
      await ziehe(ed, 'drop', m[2].x, m[2].y, data);
      // Sonst misst der Fall nichts: Das Ziehen muss die Seite ohne Dateien erreicht haben.
      const gesehen = await gezogen(ed);
      erwarte(gesehen.includes('dragenter:text/plain'), `Ziehen kam nicht an (Messung ungültig): ${JSON.stringify(gesehen)}`);
      erwarte(!flaeche, 'Ablege-Fläche erscheint beim Umsortieren');
      await pause(500);
      const n = await folienZahl(ed);
      erwarte(n === vorher, `Folien · ${n ?? '–'} statt ${vorher}`);
    });

    // CDP-dragCancel allein liefert der Seite KEIN dragleave (gemessen, Electron 33). Das
    // Verlassen des Fensters wird darum mit einem dragOver außerhalb der Seite nachgestellt.
    await fall('Datei-Ziehen verlässt das Fenster → Ablege-Fläche verschwindet, nichts importiert', async () => {
      const vorher = await folienZahl(ed);
      const data = dateiDaten([d.eins]);
      let da = false;
      let weg = false;
      try {
        await ziehe(ed, 'dragEnter', x, y, data);
        await ziehe(ed, 'dragOver', x, y, data);
        da = await warteBis(() => flaecheSichtbar(ed), 3_000);
        await ziehe(ed, 'dragOver', -40, -40, data);
        weg = await warteBis(async () => !(await flaecheSichtbar(ed)), 3_000);
      } finally {
        await ziehe(ed, 'dragCancel', -40, -40, data).catch(() => {});
      }
      erwarte(da, 'keine Ablege-Fläche beim dragOver');
      erwarte(weg, 'Ablege-Fläche bleibt nach dem Verlassen');
      await pause(500);
      const n = await folienZahl(ed);
      erwarte(n === vorher, `Folien · ${n ?? '–'} statt ${vorher}`);
    });

    await fall('Projekt.jmpres allein aufs ungespeicherte Deck → Rückfrage, bestätigt → Folien · 1', async () => {
      const rueckfrage = ed.naechsteRueckfrage(15_000);
      const ab = ablegen(ed, [d.projekt], x, y);
      ab.catch(() => {});
      const p = await rueckfrage;
      await ed.beantworte(true);
      await ab;
      erwarte(p.message.includes('„Projekt.jmpres“ öffnen'), `Rückfrage: „${p.message}“`);
      const n = await bisWert(() => folienZahl(ed), (v) => v === 1);
      erwarte(n === 1, `Folien · ${n ?? '–'} statt 1`);
    });

    await fall('Projekt.jmpres zusammen mit a.pdf → keine Rückfrage, +2 Folien, Fehlerzeile nennt das Projekt', async () => {
      const vorher = await folienZahl(ed);
      const unerwartetVorher = ed.unerwartet.length;
      await ablegen(ed, [d.projekt, d.a], x, y);
      const n = await bisWert(() => folienZahl(ed), (v) => v === vorher + 2);
      const soll = 'Projektdatei nur einzeln ablegen, übersprungen: Projekt.jmpres';
      const f = await bisWert(() => fehlerZeile(ed), (v) => v?.includes(soll), 5_000);
      await pause(300);
      const neu = ed.unerwartet.slice(unerwartetVorher);
      erwarte(neu.length === 0, `unerwartete Rückfrage: „${neu.join(' | ')}“`);
      erwarte(n === vorher + 2, `Folien · ${n ?? '–'} statt ${vorher + 2}`);
      erwarte(f?.includes(soll), `Fehlerzeile: „${f}“`);
    });

    await fall('a.pdf + kaputt.pdf (0 Byte) + b.png → Folien +3, Fehlerzeile nennt „kaputt.pdf“', async () => {
      const vorher = await folienZahl(ed);
      await ablegen(ed, [d.a, d.kaputt, d.png], x, y);
      const n = await bisWert(() => folienZahl(ed), (v) => v === vorher + 3);
      const soll = '„kaputt.pdf“ konnte nicht gelesen werden (beschädigt oder kennwortgeschützt).';
      const f = await bisWert(() => fehlerZeile(ed), (v) => v?.includes(soll), 5_000);
      erwarte(n === vorher + 3, `Folien · ${n ?? '–'} statt ${vorher + 3}, Fehlerzeile „${f}“`);
      erwarte(f?.includes(soll), `Fehlerzeile: „${f}“`);
    });

    await fall('geschuetzt.pdf (Kennwort) + b.png → Folien +1, Fehlerzeile nennt „geschuetzt.pdf“', async () => {
      const vorher = await folienZahl(ed);
      await ablegen(ed, [d.geschuetzt, d.png], x, y);
      const n = await bisWert(() => folienZahl(ed), (v) => v === vorher + 1);
      const soll = '„geschuetzt.pdf“ konnte nicht gelesen werden (beschädigt oder kennwortgeschützt).';
      const f = await bisWert(() => fehlerZeile(ed), (v) => v?.includes(soll), 5_000);
      erwarte(n === vorher + 1, `Folien · ${n ?? '–'} statt ${vorher + 1}, Fehlerzeile „${f}“`);
      erwarte(f?.includes(soll), `Fehlerzeile: „${f}“`);
    });

    // Hinweise des Hauptprozesses (nicht unterstützt) und des Editors (nicht lesbar) stehen zusammen.
    await fall('film.mp4 + kaputt.pdf + b.png → Folien +1, Fehlerzeile nennt film.mp4 UND „kaputt.pdf“', async () => {
      const vorher = await folienZahl(ed);
      await ablegen(ed, [d.mp4, d.kaputt, d.png], x, y);
      const n = await bisWert(() => folienZahl(ed), (v) => v === vorher + 1);
      const soll = 'Nicht unterstützt, übersprungen: film.mp4 · „kaputt.pdf“ konnte nicht gelesen werden (beschädigt oder kennwortgeschützt).';
      const f = await bisWert(() => fehlerZeile(ed), (v) => v === soll, 5_000);
      erwarte(n === vorher + 1, `Folien · ${n ?? '–'} statt ${vorher + 1}`);
      erwarte(f === soll, `Fehlerzeile: „${f}“`);
    });

    // Eine Datei aus dem Browser oder einer Mail hat keinen Pfad. CDP-Ablegen liefert immer
    // Pfade; darum hier ein drop-Ereignis mit einer in der Seite erzeugten Datei.
    await fall('Datei ohne Pfad (z. B. aus dem Browser) → Folienzahl gleich, Fehlerzeile „Ohne Dateipfad, übersprungen: mail.pdf …“', async () => {
      const vorher = await folienZahl(ed);
      erwarte(await auswerten(ed, imDom(domLegeOhnePfadAb, 'mail.pdf')), 'drop-Ereignis ließ sich nicht auslösen');
      const soll = 'Ohne Dateipfad, übersprungen: mail.pdf (bitte zuerst speichern und dann hineinziehen).';
      const f = await bisWert(() => fehlerZeile(ed), (v) => v?.includes(soll), 5_000);
      erwarte(f?.includes(soll), `Fehlerzeile: „${f}“`);
      await pause(300);
      const n = await folienZahl(ed);
      erwarte(n === vorher, `Folien · ${n ?? '–'} statt ${vorher}`);
    });

    // Zuletzt: danach hat das Deck über 200 Folien.
    await fall('201 Bilder auf einmal ablegen → alle kommen an (Folien +201), keine Fehlerzeile', async () => {
      const vorher = await folienZahl(ed);
      await ablegen(ed, d.viele, x, y);
      const n = await bisWert(() => folienZahl(ed), (v) => v === vorher + 201, 30_000, 250);
      const f = await fehlerZeile(ed);
      erwarte(n === vorher + 201, `Folien · ${n ?? '–'} statt ${vorher + 201}, Fehlerzeile „${f}“`);
      erwarte(f === '', `Fehlerzeile: „${f}“`);
    });
  }, umgebung);
}

const FREMDE_SEITE = 'file:///C:/Windows/win.ini';

/** Löst eine Navigation aus, die die Seite selbst anstößt (Ablegen per CDP navigiert nicht, gemessen). */
async function seitenNavigation(ziel) {
  const vorher = await aktuelleUrl(ziel);
  await auswerten(ziel, `void (location.href = ${JSON.stringify(FREMDE_SEITE)})`).catch(() => {});
  await pause(1_000);
  return { vorher, nachher: await aktuelleUrl(ziel) };
}

async function ablegenUndPruefen(ziel, pfade) {
  const vorher = await aktuelleUrl(ziel);
  const { x, y } = await auswerten(ziel, imDom(domMitte));
  await auswerten(ziel, imDom(domZiehenMitschreiben));
  await ablegen(ziel, pfade, x, y);
  await pause(1_000);
  const nachher = await aktuelleUrl(ziel);
  // Sonst misst der Fall nichts: Das Ziehen muss die Seite mit Dateien erreicht haben.
  const gesehen = await gezogen(ziel);
  return { vorher, nachher, gesehen };
}

const domKlickePraesentieren = () => {
  const k = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('▶ Präsentieren'));
  if (!k || k.disabled) return false;
  k.click();
  return true;
};

/** Seiten (Fenster) der App laut /json/list. */
async function seiten() {
  return (await zielListe()).filter((t) => t.type === 'page');
}

/** `window.open(url)` mit Nutzergeste (sonst könnte ein Popup-Blocker statt der App entscheiden). */
async function fensterOeffnen(ziel, url) {
  const r = await ziel.send('Runtime.evaluate', {
    expression: `window.open(${JSON.stringify(url)}) === null`,
    userGesture: true,
    returnByValue: true,
  });
  return r.result?.value;
}

// Die Fälle „… ablegen → Adresse gleich“ sind Regressionswachen, KEIN Beweis für den
// Navigations-Wächter: Ablegen per CDP löst in Electron 33 nie eine Navigation aus (gemessen
// vor dem Wächter, Ruling R6). Den Wächter beweisen die Fälle „Seitennavigation … abgewiesen“.
async function gruppeNavigation({ exe, d }) {
  const umgebung = eigenesProfil(path.join(d.dir, 'profil-navigation'));
  await mitApp('navigation', exe, [], async (app, ed) => {
    await fall('leerer Editor: Ablegen per CDP → Adresse gleich (Regressionswache, kein Wächter-Beweis)', async () => {
      const { vorher, nachher, gesehen } = await ablegenUndPruefen(ed, [d.a]);
      console.log(`      URL vorher:  ${vorher}`);
      console.log(`      URL nachher: ${nachher}`);
      erwarte(nachher === vorher, 'Seite ist weg-navigiert');
      erwarte(gesehen.includes('dragenter:Files'), `Ziehen kam nicht an (Messung ungültig): ${JSON.stringify(gesehen)}`);
    });

    let referent = null;
    let publikum = null;
    await fall('Präsentation starten: Deck per Ablegen füllen, ▶ Präsentieren, beide Fenster erscheinen', async () => {
      const { x, y } = await auswerten(ed, imDom(domMitte));
      await ablegen(ed, [d.a], x, y);
      const n = await bisWert(() => folienZahl(ed), (v) => v === 2);
      erwarte(n === 2, `Folien · ${n ?? '–'} statt 2`);
      erwarte(await warteBis(() => auswerten(ed, imDom(domKlickePraesentieren)), 10_000), 'Knopf „▶ Präsentieren“ nicht bedienbar');
      referent = await oeffneZiel(app, 'view=presenter');
      publikum = await oeffneZiel(app, 'view=audience');
      for (const z of [referent, publikum]) {
        const bereit = await warteBis(() => auswerten(z, `document.readyState === 'complete' && !!window.jmpr`), 20_000);
        erwarte(bereit, `${z.url} wird nicht fertig`);
      }
    });

    for (const [name, hole] of [['Referent', () => referent], ['Publikum', () => publikum]]) {
      await fall(`${name}: eins.pdf ablegen → Präsentation weiter aktiv, Index gleich, Adresse gleich (Regressionswache)`, async () => {
        const z = hole();
        if (!z) ueberspringe('Fenster fehlt (Präsentation nicht gestartet)');
        const vorher = await auswerten(z, 'window.jmpr.present.getState()');
        erwarte(vorher?.active === true, `Präsentation nicht aktiv: ${JSON.stringify(vorher)}`);
        const r = await ablegenUndPruefen(z, [d.eins]);
        erwarte(r.nachher === r.vorher, `Seite ist weg-navigiert: ${r.nachher}`);
        erwarte(r.gesehen.includes('dragenter:Files'), `Ziehen kam nicht an (Messung ungültig): ${JSON.stringify(r.gesehen)}`);
        const nachher = await auswerten(z, 'window.jmpr.present.getState()');
        erwarte(nachher?.active === true, `Präsentation nicht mehr aktiv: ${JSON.stringify(nachher)}`);
        erwarte(nachher.index === vorher.index, `Index ${nachher.index} statt ${vorher.index}`);
      });

      await fall(`${name}: Seitennavigation auf eine fremde Adresse wird abgewiesen`, async () => {
        const z = hole();
        if (!z) ueberspringe('Fenster fehlt (Präsentation nicht gestartet)');
        const { vorher, nachher } = await seitenNavigation(z);
        erwarte(nachher === vorher, `Seite navigiert: ${nachher}`);
      });

      await fall(`${name}: window.open('https://example.org') öffnet kein Fenster`, async () => {
        const z = hole();
        if (!z) ueberspringe('Fenster fehlt (Präsentation nicht gestartet)');
        const vorher = (await seiten()).map((t) => t.id);
        const abgewiesen = await fensterOeffnen(z, 'https://example.org');
        await pause(1_000);
        const neu = (await seiten()).filter((t) => !vorher.includes(t.id));
        erwarte(neu.length === 0, `neue Seite(n): ${neu.map((t) => t.url || '(leer)').join(', ')}`);
        erwarte(abgewiesen === true, 'window.open lieferte ein Fenster');
      });
    }

    // Zuletzt: Gelingt die Navigation (ohne Sperre), ist der Editor danach weg.
    await fall('Editor: Seitennavigation auf eine fremde Adresse wird abgewiesen', async () => {
      const { vorher, nachher } = await seitenNavigation(ed);
      erwarte(nachher === vorher, `Seite navigiert: ${nachher}`);
    });

    await fall('Editor: Neu laden geht weiter → view=editor wieder da', async () => {
      await auswerten(ed, 'window.__vorNeuladen = 1');
      await auswerten(ed, 'void location.reload()').catch(() => {});
      const ok = await warteBis(
        () => auswerten(ed, `window.__vorNeuladen === undefined && document.readyState === 'complete' && location.href.includes('view=editor') && !!window.jmpr && !!document.querySelector('header')`),
        20_000,
      );
      erwarte(ok, `nach dem Neuladen: ${await aktuelleUrl(ed)} unerwartet=${JSON.stringify(ed.unerwartet)} ${JSON.stringify(await auswerten(ed, '[window.__vorNeuladen, document.readyState, !!window.jmpr, !!document.querySelector("header")]').catch((e) => String(e)))}`);
    });
  }, umgebung);
}

const FRAGE_SATZ = 'Im Presenter liegt schon eine Präsentation.';
const VERLUST_SATZ = 'Beim Ersetzen gehen nicht gespeicherte Änderungen verloren.';

/** Die offene Frage „ersetzen oder anhängen?“ (Titel = ihr zugänglicher Name), sonst null. */
function domFrage() {
  const boxen = document.querySelectorAll('[role="dialog"]');
  if (!boxen.length) return null;
  const box = boxen[0];
  const kopfId = box.getAttribute('aria-labelledby');
  const fokus = document.activeElement;
  return {
    anzahl: boxen.length,
    titel: (kopfId && document.getElementById(kopfId)?.textContent.trim()) || '',
    text: box.textContent,
    knoepfe: [...box.querySelectorAll('button')].map((b) => b.textContent.trim()),
    fokus: fokus && box.contains(fokus) ? fokus.textContent.trim() : null,
  };
}

function domKlickeInFrage(text) {
  const k = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === text);
  if (!k || k.disabled) return false;
  k.click();
  return true;
}

function domKlickeAusblenden() {
  const k = document.querySelector('button[title="Ausblenden"]');
  if (!k) return false;
  k.click();
  return true;
}

const frage = (ziel) => auswerten(ziel, imDom(domFrage));
const keineFrage = async (ziel) =>
  (await frage(ziel)) === null && !(await auswerten(ziel, imDom(domEnthaelt, FRAGE_SATZ)));

async function drueckeEscape(ziel) {
  for (const type of ['rawKeyDown', 'keyUp']) {
    await ziel.send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  }
}

/**
 * Beendet eine laufende Präsentation, startet sie neu mit ▶ Präsentieren und prüft das Paket fürs
 * Publikum: so viele Folien wie im Editor, jede mit den Bytes ihrer Quelle. Fehlen die Quellen,
 * bleiben Vorschau und Publikum schwarz, und Speichern verliert die PDFs.
 */
async function praesentiereUndPruefeQuellen(ed) {
  if ((await auswerten(ed, 'window.jmpr.present.getState()'))?.active) {
    await auswerten(ed, 'window.jmpr.present.stop()');
    const aus = await warteBis(async () => (await auswerten(ed, 'window.jmpr.present.getState()'))?.active === false, 10_000);
    erwarte(aus, 'laufende Präsentation endet nicht');
  }
  const n = await folienZahl(ed);
  erwarte(await warteBis(() => auswerten(ed, imDom(domKlickePraesentieren)), 10_000), 'Knopf „▶ Präsentieren“ nicht bedienbar');
  const p = await bisWert(
    () => auswerten(ed, 'window.jmpr.present.getPayload().then((p) => p && { folien: p.slides.length, mitQuelle: p.slides.filter((s) => p.sources[s.sourceId]?.bytes?.length > 0).length })'),
    (v) => v != null,
    10_000,
  );
  erwarte(p?.folien === n, `Publikum bekommt ${p?.folien ?? '–'} Folien statt ${n}`);
  erwarte(p.mitQuelle === p.folien, `nur ${p.mitQuelle} von ${p.folien} Folien mit Quelle (Vorschau/Publikum schwarz)`);
}

async function gruppeDoppelklick({ exe, d }) {
  const umgebung = eigenesProfil(path.join(d.dir, 'profil-doppelklick'));
  /** Zweite Instanz mit `args` im Profil der laufenden App. */
  const zweite = (args) => zweiteInstanz(exe, args, umgebung);
  await mitApp('doppelklick', exe, [d.maerz], async (app, ed) => {
    /** Zweite Instanz mit `pfad` (wie ein Doppelklick); liefert die Frage, sobald eine da ist. */
    const zweitesOeffnen = async (pfad) => {
      await zweite([pfad]);
      return bisWert(() => frage(ed), (v) => v !== null);
    };
    const klicke = async (text) => erwarte(await auswerten(ed, imDom(domKlickeInFrage, text)), `kein Knopf „${text}“ in der Frage`);

    await fall('Start mit „Präsentation März.PDF“ als Argument → Folien · 1, keine Frage', async () => {
      const n = await bisWert(() => folienZahl(ed), (v) => v === 1);
      erwarte(n === 1, `Folien · ${n ?? '–'} statt 1`);
      erwarte(await keineFrage(ed), `Frage im Fenster: ${JSON.stringify(await frage(ed))}`);
    });

    await fall('zweite Instanz mit a.pdf → Frage „a.pdf“ öffnen, Knöpfe Ersetzen/Anhängen/Abbrechen, Fokus auf Anhängen, Folien · 1', async () => {
      const f = await zweitesOeffnen(d.a);
      erwarte(f?.titel === '„a.pdf“ öffnen', `Titel „${f?.titel ?? '(keine Frage)'}“`);
      erwarte(f.text.includes(FRAGE_SATZ), `Text: „${f.text}“`);
      erwarte(JSON.stringify(f.knoepfe) === JSON.stringify(['Ersetzen', 'Anhängen', 'Abbrechen']), `Knöpfe ${JSON.stringify(f.knoepfe)}`);
      erwarte(f.fokus === 'Anhängen', `Fokus auf ${f.fokus ?? '(nichts in der Frage)'}`);
      const n = await folienZahl(ed);
      erwarte(n === 1, `Folien · ${n ?? '–'} statt 1`);
    });

    await fall('Frage offen: zweite Instanz mit b.png, dann noch einmal a.pdf → dieselbe EINE Frage „2 Dateien öffnen“', async () => {
      await zweite([d.png]);
      await zweite([d.a]);
      let f = await bisWert(() => frage(ed), (v) => v?.titel === '2 Dateien öffnen');
      erwarte(f?.titel === '2 Dateien öffnen', `Titel „${f?.titel ?? '(keine Frage)'}“`);
      // Nach der Sammelzeit ist auch die zweite a.pdf sicher angekommen (und darf nichts ändern).
      await pause(1_500);
      f = await frage(ed);
      erwarte(f?.anzahl === 1, `${f?.anzahl ?? 0} Fragen im Fenster`);
      erwarte(f.titel === '2 Dateien öffnen', `danach Titel „${f.titel}“`);
    });

    await fall('Anhängen → Folien · 4 (2 Seiten + Bild), Frage weg', async () => {
      await klicke('Anhängen');
      const n = await bisWert(() => folienZahl(ed), (v) => v === 4);
      erwarte(n === 4, `Folien · ${n ?? '–'} statt 4`);
      erwarte(await keineFrage(ed), 'Frage bleibt stehen');
    });

    await fall('Show-Link per zweiter Instanz → lädt weiter Projekt.jmpres (Folien · 1), keine Frage, keine Fehlerzeile', async () => {
      await zweite([`jmps://open?show=${encodeURIComponent(d.show)}`]);
      const n = await bisWert(() => folienZahl(ed), (v) => v === 1);
      erwarte(n === 1, `Folien · ${n ?? '–'} statt 1`);
      // Würde der Link als Datei genommen, käme das erst nach der Sammelzeit an.
      await pause(1_500);
      erwarte(await keineFrage(ed), `Frage im Fenster: ${JSON.stringify(await frage(ed))}`);
      const f = await fehlerZeile(ed);
      erwarte(f === '', `Fehlerzeile: „${f}“`);
    });

    // Über den Brief hinaus: Ohne diesen Fall bewiese der nächste nichts, denn jedes
    // importierte Deck gilt schon als ungespeichert. Das Show-Projekt ist frisch geladen.
    await fall('ungeändertes Projekt: a.pdf + eins.pdf → „2 PDFs öffnen“ ohne Verlust-Hinweis, Escape schließt, Folien · 1', async () => {
      await zweite([d.a]);
      await zweite([d.eins]);
      const f = await bisWert(() => frage(ed), (v) => v?.titel === '2 PDFs öffnen');
      erwarte(f?.titel === '2 PDFs öffnen', `Titel „${f?.titel ?? '(keine Frage)'}“`);
      erwarte(f.text.includes(FRAGE_SATZ), `Text: „${f.text}“`);
      erwarte(!f.text.includes(VERLUST_SATZ), `Verlust-Hinweis ohne Änderung: „${f.text}“`);
      await drueckeEscape(ed);
      erwarte(await warteBis(() => keineFrage(ed), 3_000), 'Escape schließt die Frage nicht');
      await pause(300);
      const n = await folienZahl(ed);
      erwarte(n === 1, `Folien · ${n ?? '–'} statt 1`);
    });

    await fall('Folie ausgeblendet (ungespeichert): a.pdf → Verlust-Hinweis; Abbrechen → Folien · 1; erneut, Ersetzen → Folien · 2 ohne weitere Rückfrage', async () => {
      erwarte(await auswerten(ed, imDom(domKlickeAusblenden)), 'kein Knopf „Ausblenden“');
      let f = await zweitesOeffnen(d.a);
      erwarte(f?.text.includes(VERLUST_SATZ), `ohne Verlust-Hinweis: „${f?.text ?? '(keine Frage)'}“`);
      await klicke('Abbrechen');
      erwarte(await warteBis(() => keineFrage(ed), 3_000), 'Frage bleibt nach Abbrechen');
      await pause(300);
      let n = await folienZahl(ed);
      erwarte(n === 1, `nach Abbrechen Folien · ${n ?? '–'} statt 1`);

      const unerwartetVorher = ed.unerwartet.length;
      f = await zweitesOeffnen(d.a);
      erwarte(f !== null, 'keine Frage beim zweiten Mal');
      await klicke('Ersetzen');
      n = await bisWert(() => folienZahl(ed), (v) => v === 2);
      erwarte(n === 2, `nach Ersetzen Folien · ${n ?? '–'} statt 2`);
      const neu = ed.unerwartet.slice(unerwartetVorher);
      erwarte(neu.length === 0, `weitere Rückfrage: „${neu.join(' | ')}“`);
    });

    await fall('Präsentation läuft: a.pdf per zweiter Instanz, Ersetzen → Publikum behält seine Folienzahl', async () => {
      const { x, y } = await auswerten(ed, imDom(domMitte));
      await ablegen(ed, [d.png], x, y);
      let n = await bisWert(() => folienZahl(ed), (v) => v === 3);
      erwarte(n === 3, `vor dem Präsentieren Folien · ${n ?? '–'} statt 3`);
      erwarte(await warteBis(() => auswerten(ed, imDom(domKlickePraesentieren)), 10_000), 'Knopf „▶ Präsentieren“ nicht bedienbar');
      const publikum = await oeffneZiel(app, 'view=audience');
      const zahl = () => auswerten(publikum, 'window.jmpr.present.getPayload().then((p) => p?.slides.length ?? null)');
      const vorher = await bisWert(zahl, (v) => typeof v === 'number', 20_000);
      erwarte(vorher === 3, `Publikum hat ${vorher ?? '–'} Folien statt 3`);

      const f = await zweitesOeffnen(d.a);
      erwarte(f !== null, 'keine Frage');
      await klicke('Ersetzen');
      n = await bisWert(() => folienZahl(ed), (v) => v === 2);
      erwarte(n === 2, `Editor: Folien · ${n ?? '–'} statt 2`);
      const nachher = await zahl();
      erwarte(nachher === vorher, `Publikum hat ${nachher ?? '–'} Folien statt ${vorher}`);
      const s = await auswerten(publikum, 'window.jmpr.present.getState()');
      erwarte(s?.active === true, `Präsentation nicht mehr aktiv: ${JSON.stringify(s)}`);
    });

    // Beim Kaltstart hält der Hauptprozess Lieferungen zurück, bis der Editor geladen ist, und
    // schickt sie dann direkt hintereinander. Nachgestellt, ohne auf Zeit zu wetten: Editor neu
    // laden und vor dem ersten Skript anhalten (Debugger), zwei getrennte Lieferungen auslösen
    // (Abstand > Sammelzeit), dann weiterlaufen lassen.
    await fall('zwei Lieferungen direkt hintereinander in den leeren Editor → a.pdf lädt (Folien · 2), b.png fragt', async () => {
      await ed.send('Debugger.enable');
      const { breakpointId } = await ed.send('Debugger.setInstrumentationBreakpoint', { instrumentation: 'beforeScriptExecution' });
      try {
        const angehalten = ed.warteAuf('Debugger.paused', 15_000);
        await ed.send('Page.reload');
        await angehalten;
        await zweite([d.a]);
        await pause(1_500);
        await zweite([d.png]);
        await pause(1_500);
      } finally {
        await ed.send('Debugger.removeBreakpoint', { breakpointId }).catch(() => {});
        await ed.send('Debugger.resume').catch(() => {});
        await ed.send('Debugger.disable').catch(() => {});
      }
      const bereit = await warteBis(
        () => auswerten(ed, `document.readyState === 'complete' && !!window.jmpr && !!document.querySelector('header')`),
        20_000,
      );
      erwarte(bereit, 'Editor wird nach dem Neuladen nicht fertig');
      const f = await bisWert(() => frage(ed), (v) => v?.titel === '„b.png“ öffnen');
      const n = await bisWert(() => folienZahl(ed), (v) => v === 2);
      const fehler = await fehlerZeile(ed);
      erwarte(f?.titel === '„b.png“ öffnen', `Frage „${f?.titel ?? '(keine)'}“ bei Folien · ${n ?? '–'}, Fehlerzeile „${fehler}“`);
      erwarte(n === 2, `Folien · ${n ?? '–'} statt 2`);
      erwarte(fehler === '', `Fehlerzeile: „${fehler}“`);
      await klicke('Abbrechen');
    });

    // Ein Show-Link legt ein neues Projekt hin; eine alte Frage legte ihre Dateien sonst darauf.
    await fall('Frage offen, dann Show-Link → Frage weg, Projekt.jmpres geladen (Folien · 1), keine Fehlerzeile', async () => {
      const f = await zweitesOeffnen(d.png);
      erwarte(f?.titel === '„b.png“ öffnen', `Titel „${f?.titel ?? '(keine Frage)'}“`);
      await zweite([`jmps://open?show=${encodeURIComponent(d.show)}`]);
      const n = await bisWert(() => folienZahl(ed), (v) => v === 1);
      erwarte(n === 1, `Folien · ${n ?? '–'} statt 1`);
      erwarte(await warteBis(() => keineFrage(ed), 3_000), `Frage bleibt stehen: ${JSON.stringify(await frage(ed))}`);
      const fehler = await fehlerZeile(ed);
      erwarte(fehler === '', `Fehlerzeile: „${fehler}“`);
    });

    // Ersetzen ist ein Tausch: Erst wenn die neue Datei gelesen ist, geht das alte Deck.
    for (const [datei, art] of [[d.kaputt, '0 Byte'], [d.geschuetzt, 'Kennwort']]) {
      const name = path.basename(datei);
      await fall(`${name} (${art}) per zweiter Instanz, Ersetzen → Deck bleibt (Folienzahl gleich), Fehlerzeile nennt „${name}“`, async () => {
        // Unabhängig vom Fall davor: eine dort stehen gebliebene Frage hätte diese Datei geschluckt.
        if (await frage(ed)) {
          await klicke('Abbrechen');
          erwarte(await warteBis(() => keineFrage(ed), 3_000), 'alte Frage lässt sich nicht schließen');
        }
        const vorher = await folienZahl(ed);
        const f = await zweitesOeffnen(datei);
        erwarte(f?.titel === `„${name}“ öffnen`, `Titel „${f?.titel ?? '(keine Frage)'}“`);
        await klicke('Ersetzen');
        const soll = `„${name}“ konnte nicht gelesen werden (beschädigt oder kennwortgeschützt).`;
        const fehler = await bisWert(() => fehlerZeile(ed), (v) => v?.includes(soll), 5_000);
        const n = await folienZahl(ed);
        erwarte(fehler?.includes(soll), `Fehlerzeile: „${fehler}“`);
        erwarte(n === vorher, `Folien · ${n ?? '–'} statt ${vorher}`);
      });
    }

    await fall('nach gescheitertem Ersetzen: ▶ Präsentieren gibt dem Publikum jede Folie samt Quelle', async () => {
      await praesentiereUndPruefeQuellen(ed);
    });
  }, umgebung);
}

/**
 * Schickt eine Zeile an den Steuerserver. Nur an einen OFFENEN Server (Begrüßung „STATE …“);
 * fordert er eine Anmeldung, wird der Fall übersprungen, ohne etwas zu senden.
 */
async function steuerbefehl(zeile, ms = 15_000) {
  const ende = Date.now() + ms;
  for (;;) {
    try {
      return await new Promise((res, rej) => {
        const s = net.connect(STEUER_PORT, '127.0.0.1');
        let puffer = '';
        const t = setTimeout(() => {
          s.destroy();
          rej(new Error('keine Begrüßung vom Steuerserver'));
        }, 5_000);
        s.setEncoding('utf8');
        s.on('data', (teil) => {
          puffer += teil;
          if (!puffer.includes('\n')) return;
          clearTimeout(t);
          const erste = puffer.split('\n')[0];
          if (!erste.startsWith('STATE')) {
            // Dann gilt NICHT die Testkonfiguration (Umlenkung greift nicht): nichts senden.
            s.destroy();
            rej(new Ueberspringen(`Steuerserver verlangt Anmeldung (Begrüßung „${erste.slice(0, 12)}…“) – Testprofil greift nicht`));
            return;
          }
          s.end(`${zeile}\n`, () => res());
        });
        s.on('error', (e) => {
          clearTimeout(t);
          rej(e);
        });
      });
    } catch (e) {
      // Der Server startet erst nach dem Editor-Fenster: Verbindungsfehler eine Weile wiederholen.
      if (e instanceof Ueberspringen || Date.now() > ende) throw e;
      await pause(250);
    }
  }
}

async function gruppeSteuerbefehl({ exe, d }) {
  const umgebung = eigenesProfil(d.profil);
  await mitApp('steuerbefehl', exe, [], async (_app, ed) => {
    const oeffne = (pfad) => steuerbefehl(`PRESENTER OPEN ${pfad}`);
    const klicke = async (text) => erwarte(await auswerten(ed, imDom(domKlickeInFrage, text)), `kein Knopf „${text}“ in der Frage`);

    await fall('PRESENTER OPEN a.pdf ins leere Deck → Folien · 2, keine Frage', async () => {
      erwarte((await folienZahl(ed)) === null, 'Editor ist nicht leer');
      await oeffne(d.a);
      const n = await bisWert(() => folienZahl(ed), (v) => v === 2);
      erwarte(n === 2, `Folien · ${n ?? '–'} statt 2`);
      erwarte(await keineFrage(ed), `Frage im Fenster: ${JSON.stringify(await frage(ed))}`);
    });

    await fall('PRESENTER OPEN Projekt.jmpres aufs ungespeicherte Deck → Projekt geladen (Folien · 1), keine Rückfrage', async () => {
      const unerwartetVorher = ed.unerwartet.length;
      await oeffne(d.projekt);
      const n = await bisWert(() => folienZahl(ed), (v) => v === 1);
      erwarte(n === 1, `Folien · ${n ?? '–'} statt 1`);
      const titel = await bisWert(() => auswerten(ed, imDom(domAusgewaehlterTitel)), (v) => v === 'Projektfolie', 3_000);
      erwarte(titel === 'Projektfolie', `ausgewählt ist „${titel}“ statt „Projektfolie“`);
      const neu = ed.unerwartet.slice(unerwartetVorher);
      erwarte(neu.length === 0, `Rückfrage: „${neu.join(' | ')}“`);
    });

    await fall('PRESENTER OPEN a.pdf aufs gefüllte Deck → ersetzt ohne Frage (Folien · 2)', async () => {
      await oeffne(d.a);
      const n = await bisWert(() => folienZahl(ed), (v) => v === 2);
      erwarte(n === 2, `Folien · ${n ?? '–'} statt 2`);
      erwarte(await keineFrage(ed), `Frage im Fenster: ${JSON.stringify(await frage(ed))}`);
      const titel = await auswerten(ed, imDom(domAusgewaehlterTitel));
      erwarte(titel === 'a 1', `ausgewählt ist „${titel}“ statt „a 1“`);
    });

    await fall('Frage offen (b.png per zweiter Instanz), dann PRESENTER OPEN eins.pdf → Frage weg, Folien · 1', async () => {
      await zweiteInstanz(exe, [d.png], umgebung);
      const f = await bisWert(() => frage(ed), (v) => v !== null);
      erwarte(f?.titel === '„b.png“ öffnen', `Titel „${f?.titel ?? '(keine Frage)'}“`);
      await oeffne(d.eins);
      const n = await bisWert(() => folienZahl(ed), (v) => v === 1);
      erwarte(n === 1, `Folien · ${n ?? '–'} statt 1`);
      erwarte(await warteBis(() => keineFrage(ed), 3_000), `Frage bleibt stehen: ${JSON.stringify(await frage(ed))}`);
    });

    await fall('PRESENTER OPEN kaputt.pdf → Deck bleibt (Folien · 1, Quelle da), Fehlerzeile nennt „kaputt.pdf“', async () => {
      await oeffne(d.kaputt);
      const soll = '„kaputt.pdf“ konnte nicht gelesen werden (beschädigt oder kennwortgeschützt).';
      const fehler = await bisWert(() => fehlerZeile(ed), (v) => v?.includes(soll), 5_000);
      const n = await folienZahl(ed);
      erwarte(n === 1, `Folien · ${n ?? '–'} statt 1`);
      // PRESENTER OPEN fragt nie.
      erwarte(await keineFrage(ed), `Frage im Fenster: ${JSON.stringify(await frage(ed))}`);
      // Erst die Quellen, dann der Text: so zeigt ein Fehlschlag beides getrennt.
      await praesentiereUndPruefeQuellen(ed);
      erwarte(fehler?.includes(soll), `Fehlerzeile: „${fehler}“`);
    });
  }, umgebung);
}

// ---------------------------------------------------------------- NDI (#303)
// Der Prüfstand empfängt die NDI-Quelle der App selbst (@jm/ndi). `receive()` blockiert: Während einer
// Messung ruht der CDP-Verkehr, darum steht dabei nie eine CDP-Antwort aus.

const NDI_ENDUNG = '(JM Presenter)';
/** FourCC „BGRA“ (Bytes B, G, R, A). */
const FOURCC_BGRA = 0x41524742;
/** Die drei Messpunkte: Ecke oben links, Mitte, Ecke unten rechts. */
const MESSPUNKTE = [[5, 5], [960, 540], [1915, 1075]];
/** Bildfolie (bild.png 900×1600 → 608×1080 mittig): oben rot, unten durchsichtig, daneben frei. */
const BILD_PUNKTE = [[960, 270], [960, 810], [100, 540]];
/**
 * „Ganz durchsichtig“ nach der Bildfolie: die Messpunkte plus das rote (960,270). Die drei Messpunkte allein
 * sind schon auf der Bildfolie durchsichtig – ohne den vierten bewiese der Fall nichts.
 */
const LEER_PUNKTE = [...MESSPUNKTE, [960, 270]];
const KEINER = 'Keiner – nur NDI';
const NDI_AN_1 = 'NDI ● an · 1 Empfänger';
const NUR_NDI_TITEL = 'Kein Publikumsfenster – Bild nur über NDI';

/** Bildpunkt (x, y) eines NDI-Bilds als [b, g, r, a]; Zeilen über lineStride. */
function pixel(bild, x, y) {
  const o = y * bild.lineStride + x * 4;
  return [bild.data[o], bild.data[o + 1], bild.data[o + 2], bild.data[o + 3]];
}

/**
 * NDI überträgt verlustbehaftet (YUV): Ohne Presenter, Sender und Empfänger nur über @jm/ndi, kam Schwarz
 * [0,0,0,255] als [1,0,1,255] an, Grau 64 als [65,64,65], Grau 200 als [200,200,201]; Alpha 0 und 255 blieben
 * genau (gemessen 15.11.2026, NDI 6). Farbkanäle darum ±2, Alpha exakt.
 */
const NDI_TOLERANZ = 2;
const pixelEtwa = (bild, x, y, soll) =>
  pixel(bild, x, y).every((v, i) => (i === 3 ? v === soll[3] : Math.abs(v - soll[i]) <= NDI_TOLERANZ));
const durchsichtig = (bild, punkte) => punkte.every(([x, y]) => pixel(bild, x, y)[3] === 0);
const zeigtBildfolie = (b) => pixelEtwa(b, 960, 270, [0, 0, 255, 255]) && durchsichtig(b, [[960, 810], [100, 540]]);

/** Für Meldungen: „(x,y)=[b,g,r,a] …“. */
function messwerte(bild, punkte = MESSPUNKTE) {
  if (!bild) return '(kein Bild)';
  return punkte.map(([x, y]) => `(${x},${y})=[${pixel(bild, x, y).join(',')}]`).join(' ');
}

/** Leert die Warteschlange des Empfängers und wartet höchstens `ms` auf das nächste Videobild. Blockiert. */
function frischesBild(ndi, ms = 2_000) {
  while (ndi.receive(0) !== null) {
    // ältere Bilder verwerfen
  }
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    const f = ndi.receive(100);
    if (f?.type === 'video') return f;
  }
  return null;
}

/** Holt frische Bilder, bis `passt(bild)`; liefert das letzte Bild (auch nach Ablauf, null = gar keins). Blockiert. */
function bisBild(ndi, passt, ms) {
  const ende = Date.now() + ms;
  let bild = null;
  for (;;) {
    bild = frischesBild(ndi, Math.max(100, ende - Date.now())) ?? bild;
    if ((bild && passt(bild)) || Date.now() >= ende) return bild;
  }
}

/** Die Quelle DIESES Rechners: endet auf „(JM Presenter)“, beginnt mit dem Rechnernamen (groß/klein egal). */
function eigeneQuelle(ndi, ms) {
  const rechner = os.hostname().toLowerCase();
  const ende = Date.now() + ms;
  for (;;) {
    const q = ndi.findSources(500).find((s) => s.endsWith(NDI_ENDUNG) && s.toLowerCase().startsWith(rechner));
    if (q || Date.now() >= ende) return q ?? null;
  }
}

/** Sucht die eigene Quelle, verbindet den Empfänger neu und wartet aufs erste Bild; wirft, wenn nichts kommt. */
function verbindeNdi(ndi, ms = 10_000) {
  const quelle = eigeneQuelle(ndi, ms);
  erwarte(quelle, `keine NDI-Quelle „${os.hostname()} ${NDI_ENDUNG}“ nach ${ms} ms`);
  erwarte(ndi.createReceiver(quelle), `kein Empfänger für „${quelle}“`);
  const bild = frischesBild(ndi, ms);
  erwarte(bild, `von „${quelle}“ kommt binnen ${ms} ms kein Bild`);
  return { quelle, bild };
}

function domAuswahl() {
  const s = document.querySelector('select[title="Publikums-Bildschirm"]');
  if (!s) return null;
  return {
    wert: s.value,
    text: s.selectedOptions[0]?.textContent.trim() ?? '',
    optionen: [...s.options].map((o) => ({ wert: o.value, text: o.textContent.trim(), gesperrt: o.disabled })),
  };
}

/** Setzt das Auswahlfeld (React): nativer value-Setter, dann ein sprudelndes change-Ereignis. */
function domWaehle(wert) {
  const s = document.querySelector('select[title="Publikums-Bildschirm"]');
  if (!s) return false;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, wert);
  s.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/** Der NDI-Knopf ist der Knopf, dessen Text mit „NDI“ beginnt; `klicken` drückt ihn, wenn er bedienbar ist. */
function domNdiKnopf(klicken) {
  const k = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('NDI'));
  if (!k) return null;
  const vorher = { text: k.textContent.trim(), gesperrt: k.disabled };
  if (klicken && !k.disabled) k.click();
  return vorher;
}

function domVollbild() {
  const k = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Vollbild');
  return k ? { gesperrt: k.disabled, titel: k.title } : null;
}

const ndiStatus = (ziel) => auswerten(ziel, 'window.jmpr.ndi.status()');
const bisLage = (ziel, lage, ms) => bisWert(() => ndiStatus(ziel), (s) => s?.lage === lage, ms);
const ndiKnopf = async (ziel) => (await auswerten(ziel, imDom(domNdiKnopf, false)))?.text ?? null;
const auswahl = (ziel) => auswerten(ziel, imDom(domAuswahl));
const praesentation = (ziel) => auswerten(ziel, 'window.jmpr.present.getState()');
const seiteMit = async (teil) => (await seiten()).find((t) => t.url.includes(teil)) ?? null;

async function fensterFertig(ziel) {
  const ok = await warteBis(() => auswerten(ziel, `document.readyState === 'complete' && !!window.jmpr`), 20_000);
  erwarte(ok, `${ziel.url} wird nicht fertig`);
}

/** Nur lesen (user32): je Top-Level-Fenster der JM-Presenter-Prozesse eine Zeile „1|Titel“ (sichtbar) oder „0|Titel“. */
const FENSTER_PS = `
$ProgressPreference = 'SilentlyContinue'
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class JmprFenster {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  public static List<string> Liste(HashSet<uint> pids) {
    var aus = new List<string>();
    EnumWindows((h, l) => {
      uint pid;
      GetWindowThreadProcessId(h, out pid);
      if (!pids.Contains(pid)) return true;
      var titel = new StringBuilder(256);
      GetWindowText(h, titel, 256);
      if (titel.Length > 0) aus.Add((IsWindowVisible(h) ? "1|" : "0|") + titel.ToString());
      return true;
    }, IntPtr.Zero);
    return aus;
  }
}
'@
$pids = New-Object 'System.Collections.Generic.HashSet[uint32]'
Get-Process -Name 'JM Presenter' -ErrorAction SilentlyContinue | ForEach-Object { [void]$pids.Add([uint32]$_.Id) }
[JmprFenster]::Liste($pids) | ForEach-Object { $_ }
`;

/** Ist das Fenster mit dem (ASCII-)Titel `titel` wirklich sichtbar? true/false, null = kein solches Fenster. */
function fensterSichtbar(titel) {
  const aus = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(FENSTER_PS, 'utf16le').toString('base64')], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], // Fortschritts-CLIXML der PowerShell nicht in die Prüfstand-Ausgabe
  });
  const zeile = aus.split(/\r?\n/).find((z) => z.slice(2) === titel);
  return zeile ? zeile.startsWith('1|') : null;
}

/**
 * Wartet höchstens `ms`, bis das Fenster mit `titel` gefunden ist (der per CDP gesetzte Titel kommt verzögert an).
 * Liefert `{ wert: true | false | null, fehler: null }` oder `{ wert: undefined, fehler }`, wenn die Abfrage selbst
 * scheitert – ein kaputtes Messgerät darf nie als Befund über die App erscheinen.
 */
async function messeFenster(titel, ms) {
  let fehler = null;
  const wert = await bisWert(
    () => {
      try {
        const v = fensterSichtbar(titel);
        fehler = null;
        return v;
      } catch (e) {
        fehler = String(e?.message ?? e).split(/\r?\n/)[0];
        return undefined;
      }
    },
    (v) => typeof v === 'boolean',
    ms,
  );
  return { wert, fehler };
}

/** Prüft eine Fenster-Messung: erst ob gemessen wurde, dann den Befund. */
function erwarteFenster(messung, soll, was) {
  erwarte(messung.wert !== undefined, `Messung gescheitert (Fenster-Abfrage per PowerShell/user32): ${messung.fehler}`);
  const ist = messung.wert === null ? 'nicht gefunden' : messung.wert ? 'sichtbar' : 'unsichtbar';
  erwarte(messung.wert === soll, `${was} ${ist}`);
}

/** @electron/asar aus dem Workspace (über electron-builder); ohne Kopf-Zwischenspeicher, die Archive ändern sich. */
function asarModul() {
  const asar = createRequire(import.meta.url)('@electron/asar');
  asar.uncacheAll();
  return asar;
}

/** Was am Original nach dem Fall 15 noch genauso sein muss. */
function fingerabdruck(exe) {
  const res = path.join(path.dirname(exe), 'resources');
  const archiv = path.join(res, 'app.asar');
  const st = fs.statSync(archiv);
  const eintraege = asarModul().listPackage(archiv).map((f) => f.replace(/\\/g, '/'));
  return {
    asar: `${st.size} Byte, ${st.mtime.toISOString()}`,
    ndiImAsar: eintraege.includes('/node_modules/@jm/ndi/index.js'),
    bin: fs.readdirSync(path.join(res, 'bin', 'win')).sort().join(', '),
  };
}

/**
 * Kopie der gepackten App unter `ziel` ohne NDI: resources/bin/win gelöscht, @jm/ndi aus app.asar entfernt
 * (extractAll, löschen, createPackage). Das Original bleibt unberührt. Liefert die Exe der Kopie.
 */
async function kopieOhneNdi(exe, ziel) {
  fs.cpSync(path.dirname(exe), ziel, { recursive: true });
  fs.rmSync(path.join(ziel, 'resources', 'bin', 'win'), { recursive: true });
  const archiv = path.join(ziel, 'resources', 'app.asar');
  const entpackt = `${ziel}-app`;
  asarModul().extractAll(archiv, entpackt);
  const paket = path.join(entpackt, 'node_modules', '@jm', 'ndi');
  erwarte(fs.existsSync(paket), 'node_modules/@jm/ndi fehlt schon in der app.asar der Kopie');
  fs.rmSync(paket, { recursive: true });
  await asarModul().createPackage(entpackt, archiv);
  fs.rmSync(entpackt, { recursive: true });
  return path.join(ziel, path.basename(exe));
}

/** App A, Fälle 1–11: Start mit ndi.jmpres, NDI einschalten, „Keiner – nur NDI“, Bildpunkte, Absturz, Aus/An, Ende. */
async function ndiMitProjekt(exe, d, ndi, umgebung) {
  await mitApp('ndi (App A)', exe, [d.ndiProjekt], async (app, ed) => {
    await fall('1 erster Start: ndi.jmpres geladen (Folien · 3), Status { an: false, lage: aus }, kein Fenster view=ndi, Knopf „NDI aus“', async () => {
      const n = await bisWert(() => folienZahl(ed), (v) => v === 3);
      erwarte(n === 3, `Folien · ${n ?? '–'} statt 3`);
      const s = await ndiStatus(ed);
      erwarte(s?.an === false && s.lage === 'aus', `Status ${JSON.stringify(s)}`);
      erwarte(!(await seiteMit('view=ndi')), 'Fenster view=ndi ist schon da');
      const k = await bisWert(() => ndiKnopf(ed), (v) => v === 'NDI aus', 5_000);
      erwarte(k === 'NDI aus', `Knopf „${k}“`);
    });

    await fall('2 setzeAn(true) → binnen 10 s sendet, view=ndi da, Quelle gefunden; Bild 1920×1080, BGRA, 25/1, an den Messpunkten durchsichtig; ndi-config.json im Testprofil', async () => {
      await auswerten(ed, 'window.jmpr.ndi.setzeAn(true)');
      const s = await bisLage(ed, 'sendet', 10_000);
      erwarte(s?.lage === 'sendet', `Status ${JSON.stringify(s)}`);
      erwarte(await seiteMit('view=ndi'), 'kein Fenster view=ndi');
      const { quelle, bild } = verbindeNdi(ndi);
      console.log(`      Quelle: ${quelle}`);
      erwarte(bild.width === 1920 && bild.height === 1080, `Bild ${bild.width}×${bild.height}`);
      erwarte(bild.fourCC === FOURCC_BGRA, `FourCC 0x${bild.fourCC.toString(16)} statt BGRA`);
      erwarte(bild.fpsN === 25 && bild.fpsD === 1, `Bildrate ${bild.fpsN}/${bild.fpsD}`);
      erwarte(durchsichtig(bild, MESSPUNKTE), `ohne Präsentation nicht durchsichtig: ${messwerte(bild)}`);
      const config = path.join(d.ndiProfil, 'AppData', 'Roaming', '@jm', 'presenter', 'ndi-config.json');
      erwarte(fs.existsSync(config), `${config} fehlt – userData nicht im Testprofil?`);
    });

    await fall(`3 Knopf zeigt „${NDI_AN_1}“ binnen 5 s`, async () => {
      const k = await bisWert(() => ndiKnopf(ed), (v) => v === NDI_AN_1, 5_000);
      erwarte(k === NDI_AN_1, `Knopf „${k}“`);
    });

    let referent = null;
    let bildschirm = null;
    /** Referentenansicht, gemessen sobald sie fertig ist (Fall 4), geprüft im eigenen Fall. */
    const imReferenten = { knopf: null, editorKnopf: null, vollbild: null };
    await fall('4 Auswahl „Keiner – nur NDI“, ▶ Präsentieren → view=presenter, nach 3 s kein view=audience; NDI (960,540) schwarz deckend, (5,5) deckend', async () => {
      bildschirm = (await auswahl(ed))?.wert ?? null;
      erwarte(/^\d+$/.test(bildschirm ?? ''), `vorher kein Bildschirm gewählt: „${bildschirm}“`);
      const waehlbar = (a) => a?.optionen.some((o) => o.text === KEINER && !o.gesperrt);
      const w = await bisWert(() => auswahl(ed), waehlbar, 5_000);
      erwarte(waehlbar(w), `„${KEINER}“ nicht wählbar: ${JSON.stringify(w?.optionen)}`);
      erwarte(await auswerten(ed, imDom(domWaehle, 'keiner')), 'kein Auswahlfeld „Publikums-Bildschirm“');
      const a = await bisWert(() => auswahl(ed), (v) => v?.text === KEINER, 3_000);
      erwarte(a?.text === KEINER, `Auswahl zeigt „${a?.text}“`);
      erwarte(await warteBis(() => auswerten(ed, imDom(domKlickePraesentieren)), 10_000), 'Knopf „▶ Präsentieren“ nicht bedienbar');
      const start = Date.now();
      referent = await oeffneZiel(app, 'view=presenter', 15_000);
      await fensterFertig(referent);
      imReferenten.editorKnopf = await ndiKnopf(ed);
      imReferenten.knopf = await bisWert(() => ndiKnopf(referent), (v) => v === imReferenten.editorKnopf, 2_000);
      imReferenten.vollbild = await bisWert(() => auswerten(referent, imDom(domVollbild)), (v) => v != null, 2_000);
      await pause(Math.max(0, start + 3_000 - Date.now()));
      erwarte(!(await seiteMit('view=audience')), 'Publikumsfenster view=audience ist offen');
      const bild = frischesBild(ndi);
      erwarte(bild && pixelEtwa(bild, 960, 540, [0, 0, 0, 255]) && pixel(bild, 5, 5)[3] === 255, `NDI ${messwerte(bild)}`);
    });

    await fall(`4 Referentenansicht: NDI-Knopf binnen 2 s wie im Editor („${NDI_AN_1}“), „Vollbild“ gesperrt mit „${NUR_NDI_TITEL}“`, async () => {
      const { knopf, editorKnopf, vollbild } = imReferenten;
      erwarte(editorKnopf === NDI_AN_1 && knopf === editorKnopf, `Referent „${knopf}“, Editor „${editorKnopf}“`);
      erwarte(vollbild?.gesperrt === true && vollbild.titel === NUR_NDI_TITEL, `Vollbild ${JSON.stringify(vollbild)}`);
    });

    await fall('5 present.next() → in 1,5 s mindestens 5 Bilder mit (960,540)-Blau zwischen 10 und 245 (Blende); danach (960,540) weiß deckend, (100,540) durchsichtig', async () => {
      await auswerten(ed, 'window.jmpr.present.next()');
      const blau = [];
      const ende = Date.now() + 1_500;
      while (Date.now() < ende) {
        const f = ndi.receive(100);
        if (f?.type === 'video') blau.push(pixel(f, 960, 540)[0]);
      }
      const zwischen = blau.filter((b) => b > 10 && b < 245).length;
      console.log(`      Blende: ${zwischen} von ${blau.length} Bildern dazwischen`);
      erwarte(zwischen >= 5, `nur ${zwischen} Zwischenbilder (Blau je Bild: ${blau.join(' ')})`);
      const hochkant = (b) => pixelEtwa(b, 960, 540, [255, 255, 255, 255]) && durchsichtig(b, [[100, 540]]);
      const bild = bisBild(ndi, hochkant, 3_000);
      erwarte(bild && hochkant(bild), `NDI ${messwerte(bild, [[960, 540], [100, 540]])}`);
    });

    // „Nach 1,5 s“ = Blende (1 s) plus Verzug des NDI-Wegs; danach höchstens 1 s Nachlauf.
    await fall('6 present.next() (Bild) → nach 1,5 s (960,270) rot deckend, (960,810) und (100,540) durchsichtig', async () => {
      await auswerten(ed, 'window.jmpr.present.next()');
      await pause(1_500);
      const bild = bisBild(ndi, zeigtBildfolie, 1_000);
      erwarte(bild && zeigtBildfolie(bild), `NDI ${messwerte(bild, BILD_PUNKTE)}`);
    });

    await fall('7 zaehleBilder 10 s → mindestens 248 Bilder, keine Lücke über 80 ms', async () => {
      const r = zaehleBilder(ndi, 10_000);
      console.log(`      Bilder ${r.bilder} von 250, längste Lücke ${r.laengsteLueckeMs} ms, Lücken über 80 ms: ${r.luecken80}`);
      erwarte(r.bilder >= 248, `nur ${r.bilder} Bilder`);
      erwarte(r.luecken80 === 0, `${r.luecken80} Lücken über 80 ms (längste ${r.laengsteLueckeMs} ms)`);
    });

    await fall('8 Schwarzbild → durchsichtig; zurück → Bildfolie; Weißbild → (100,540) weiß deckend; zurück', async () => {
      const schirm = (art) => auswerten(ed, `window.jmpr.present.setScreen(${JSON.stringify(art)})`);
      await schirm('black');
      let bild = bisBild(ndi, (b) => durchsichtig(b, LEER_PUNKTE), 3_000);
      erwarte(bild && durchsichtig(bild, LEER_PUNKTE), `Schwarzbild: ${messwerte(bild, LEER_PUNKTE)}`);
      await schirm('black');
      bild = bisBild(ndi, zeigtBildfolie, 3_000);
      erwarte(bild && zeigtBildfolie(bild), `zurück vom Schwarzbild: ${messwerte(bild, BILD_PUNKTE)}`);
      await schirm('white');
      const weiss = (b) => pixelEtwa(b, 100, 540, [255, 255, 255, 255]);
      bild = bisBild(ndi, weiss, 3_000);
      erwarte(bild && weiss(bild), `Weißbild: ${messwerte(bild, [[100, 540]])}`);
      await schirm('white');
      bild = bisBild(ndi, zeigtBildfolie, 3_000);
      erwarte(bild && zeigtBildfolie(bild), `zurück vom Weißbild: ${messwerte(bild, BILD_PUNKTE)}`);
      const p = await praesentation(ed);
      erwarte(p?.screen === 'live', `Bildschirm-Modus ${p?.screen}`);
    });

    // Genau EIN Absturz: ein zweiter binnen 60 s hieße absichtlich „nicht verfügbar“.
    await fall('8a NDI-Bild stürzt einmal ab (Page.crash) → binnen 10 s wieder sendet mit neuem view=ndi; Auswahl bleibt „Keiner – nur NDI“, Präsentation aktiv, kein view=audience', async () => {
      const alt = await seiteMit('view=ndi');
      erwarte(alt, 'kein Fenster view=ndi');
      await auswerten(ed, 'window.__ndiLagen = []; window.jmpr.ndi.onStatus((s) => window.__ndiLagen.push(s.lage)); true');
      const bildFenster = await oeffneZiel(app, 'view=ndi');
      bildFenster.send('Page.crash').catch(() => {}); // antwortet nicht mehr
      const neu = await bisWert(
        async () => {
          const s = await seiteMit('view=ndi');
          return s && s.id !== alt.id && (await ndiStatus(ed))?.lage === 'sendet' ? s : null;
        },
        Boolean,
        10_000,
      );
      const lagen = await auswerten(ed, 'window.__ndiLagen');
      erwarte(neu, `nach 10 s kein neues view=ndi mit „sendet“ (Status-Folge ${JSON.stringify(lagen)})`);
      erwarte(lagen.includes('startet'), `Absturz nicht über den Ersatz gelaufen (Status-Folge ${JSON.stringify(lagen)})`);
      const a = await auswahl(ed);
      erwarte(a?.text === KEINER, `Auswahl zeigt „${a?.text}“`);
      const p = await praesentation(ed);
      erwarte(p?.active === true, `Präsentation ${JSON.stringify(p)}`);
      erwarte(!(await seiteMit('view=audience')), 'Publikumsfenster view=audience ist offen');
      const bild = bisBild(ndi, zeigtBildfolie, 5_000);
      erwarte(bild && zeigtBildfolie(bild), `NDI nach dem Absturz: ${messwerte(bild, BILD_PUNKTE)}`);
    });

    await fall('9 NDI-Knopf der Referentenansicht aus → binnen 2 s „NDI aus“ in Editor und Referent; Präsentation aktiv, view=presenter bleibt, Auswahl zurück auf den Bildschirm; setzeAn(true) → wieder sendet', async () => {
      erwarte(referent, 'keine Referentenansicht');
      const k = await auswerten(referent, imDom(domNdiKnopf, true));
      erwarte(k && !k.gesperrt, `NDI-Knopf der Referentenansicht nicht bedienbar: ${JSON.stringify(k)}`);
      const beide = await bisWert(
        async () => [await ndiKnopf(ed), await ndiKnopf(referent)],
        (v) => v?.every((t) => t === 'NDI aus'),
        2_000,
      );
      erwarte(beide?.every((t) => t === 'NDI aus'), `Editor „${beide?.[0]}“, Referent „${beide?.[1]}“`);
      const p = await praesentation(ed);
      erwarte(p?.active === true, `Präsentation ${JSON.stringify(p)}`);
      erwarte(await seiteMit('view=presenter'), 'Referentenansicht ist weg');
      const a = await bisWert(() => auswahl(ed), (v) => v?.wert === bildschirm, 2_000);
      erwarte(a?.wert === bildschirm && a.text !== KEINER, `Auswahl „${a?.text}“ (${a?.wert}) statt Bildschirm ${bildschirm}`);
      await auswerten(ed, 'window.jmpr.ndi.setzeAn(true)');
      const s = await bisLage(ed, 'sendet', 10_000);
      erwarte(s?.lage === 'sendet', `Status ${JSON.stringify(s)}`);
      // Review Focus 3: NDI an während einer Präsentation zeigt die laufende Folie (der Empfänger verbindet neu).
      const bild = bisBild(ndi, zeigtBildfolie, 10_000);
      erwarte(bild && zeigtBildfolie(bild), `NDI nach dem Einschalten: ${messwerte(bild, BILD_PUNKTE)}`);
    });

    await fall('10 present.stop() → binnen 2 s an den drei Messpunkten (und am roten (960,270)) durchsichtig', async () => {
      await auswerten(ed, 'window.jmpr.present.stop()');
      const bild = bisBild(ndi, (b) => durchsichtig(b, LEER_PUNKTE), 2_000);
      erwarte(bild && durchsichtig(bild, LEER_PUNKTE), `NDI ${messwerte(bild, LEER_PUNKTE)}`);
    });

    await fall('11 Editor per window.close() schließen (keine Präsentation) → binnen 15 s kein Presenter-Prozess', async () => {
      const p = await praesentation(ed);
      erwarte(p?.active === false, `Präsentation läuft noch: ${JSON.stringify(p)}`);
      await auswerten(ed, 'void window.close()', 5_000).catch(() => {});
      erwarte(await warteBis(() => !presenterLaeuft(), 15_000, 250), 'Presenter-Prozess läuft weiter (NDI-Fenster hält die App?)');
    });
  }, umgebung);
}

/** App B, Fälle 12–14: Neustart mit gemerktem Schalter, NDI an während der Präsentation, zweite Instanz. */
async function ndiNeustart(exe, d, ndi, umgebung) {
  await mitApp('ndi (App B)', exe, [], async (app, ed) => {
    await fall('12 Neustart ohne Zutun: binnen 10 s sendet, Quelle wieder da', async () => {
      const s = await bisLage(ed, 'sendet', 10_000);
      erwarte(s?.lage === 'sendet', `Status ${JSON.stringify(s)}`);
      verbindeNdi(ndi);
    });

    let referent = null;
    await fall('13 setzeAn(false); a.pdf ablegen, normal präsentieren (Publikumsfenster, „Vollbild“ bedienbar); setzeAn(true) → binnen 5 s NDI (960,540) weiß deckend', async () => {
      await auswerten(ed, 'window.jmpr.ndi.setzeAn(false)');
      const aus = await bisLage(ed, 'aus', 5_000);
      erwarte(aus?.lage === 'aus', `Status ${JSON.stringify(aus)}`);
      const { x, y } = await auswerten(ed, imDom(domMitte));
      await ablegen(ed, [d.a], x, y);
      const n = await bisWert(() => folienZahl(ed), (v) => v === 2);
      erwarte(n === 2, `Folien · ${n ?? '–'} statt 2`);
      const a = await auswahl(ed);
      erwarte(/^\d+$/.test(a?.wert ?? ''), `kein Bildschirm gewählt: ${JSON.stringify(a)}`);
      erwarte(await warteBis(() => auswerten(ed, imDom(domKlickePraesentieren)), 10_000), 'Knopf „▶ Präsentieren“ nicht bedienbar');
      referent = await oeffneZiel(app, 'view=presenter', 15_000);
      await oeffneZiel(app, 'view=audience', 15_000);
      await fensterFertig(referent);
      const vb = await bisWert(() => auswerten(referent, imDom(domVollbild)), (v) => v != null, 5_000);
      erwarte(vb?.gesperrt === false && vb.titel === '', `Vollbild ${JSON.stringify(vb)}`);
      const t0 = Date.now();
      await auswerten(ed, 'window.jmpr.ndi.setzeAn(true)');
      const weiss = (b) => pixelEtwa(b, 960, 540, [255, 255, 255, 255]);
      const bild = bisBild(ndi, weiss, 5_000);
      console.log(`      weiß nach ${Date.now() - t0} ms`);
      erwarte(bild && weiss(bild), `NDI ${messwerte(bild)}`);
    });

    // Sichtbar heißt hier das echte Fenster (user32 IsWindowVisible), nicht document.visibilityState: Das NDI-Fenster
    // läuft ohne Hintergrund-Drosselung und meldet „visible“, obwohl es nie gezeigt wird (gemessen 15.11.2026).
    // Gefunden wird es über einen Prüf-Titel, den der Prüfstand per CDP setzt.
    await fall('14 Editor per window.close() (Präsentation läuft), zweite Instanz → Fenster view=ndi bleibt unsichtbar; present.stop() im Referentenfenster → binnen 15 s kein Presenter-Prozess', async () => {
      erwarte(referent, 'keine Referentenansicht');
      const bildFenster = await oeffneZiel(app, 'view=ndi');
      const marke = 'JM Presenter NDI-Pruefstand';
      await auswerten(bildFenster, `document.title = ${JSON.stringify(marke)}`);
      const vorher = await messeFenster(marke, 5_000);
      console.log(`      view=ndi: document.visibilityState „${await auswerten(bildFenster, 'document.visibilityState')}“, Fenster-Messung ${JSON.stringify(vorher)}`);
      erwarteFenster(vorher, false, 'Fenster des NDI-Bilds vorher');
      await auswerten(ed, 'void window.close()', 5_000).catch(() => {});
      erwarte(await warteBis(async () => !(await seiteMit('view=editor')), 5_000), 'Editor bleibt offen');
      const p = await praesentation(referent);
      erwarte(p?.active === true, `Präsentation ${JSON.stringify(p)}`);
      await zweiteInstanz(exe, [], umgebung);
      await pause(1_000);
      erwarteFenster(await messeFenster(marke, 2_000), false, 'Fenster des NDI-Bilds nach der zweiten Instanz');
      // Gegenprobe: Dieselbe Messung sieht ein gezeigtes Fenster (sonst bewiese „unsichtbar“ nichts).
      const gegen = 'JM Presenter Referent-Pruefstand';
      await auswerten(referent, `document.title = ${JSON.stringify(gegen)}`);
      erwarteFenster(await messeFenster(gegen, 5_000), true, 'Gegenprobe: Referentenfenster');
      await auswerten(referent, 'void window.jmpr.present.stop()', 5_000).catch(() => {});
      erwarte(await warteBis(() => !presenterLaeuft(), 15_000, 250), 'Presenter-Prozess läuft weiter (NDI-Fenster hält die App?)');
    });
  }, umgebung);
}

/** App C, Fall 15: Kopie ohne NDI mit gemerktem Schalter „an“ – kein Absturz, Präsentation geht. */
async function ndiFehlt(exe, d, umgebung) {
  let original = null;
  let kopie = null;
  await fall('15 Kopie ohne NDI: resources/bin/win weg, @jm/ndi nicht in app.asar; Schalter im Profil gemerkt an', async () => {
    original = fingerabdruck(exe); // im Fall: einem Paket ohne NDI fehlt resources/bin/win, das ist ein FAIL, kein Abbruch
    const config = path.join(d.ndiProfil, 'AppData', 'Roaming', '@jm', 'presenter', 'ndi-config.json');
    const gemerkt = JSON.parse(fs.readFileSync(config, 'utf8'));
    erwarte(gemerkt.an === true, `ndi-config.json: ${JSON.stringify(gemerkt)}`);
    const exeKopie = await kopieOhneNdi(exe, path.join(d.dir, 'ohne-ndi'));
    const res = path.join(path.dirname(exeKopie), 'resources');
    erwarte(!fs.existsSync(path.join(res, 'bin', 'win')), 'resources/bin/win ist noch da');
    const eintraege = asarModul().listPackage(path.join(res, 'app.asar')).map((f) => f.replace(/\\/g, '/'));
    erwarte(!eintraege.some((f) => f.startsWith('/node_modules/@jm/ndi')), '@jm/ndi steckt noch in app.asar');
    erwarte(eintraege.includes('/out/main/index.cjs'), 'app.asar der Kopie ohne out/main/index.cjs');
    kopie = exeKopie;
  });
  if (kopie) {
    await mitApp('ndi (App C)', kopie, [], async (app, ed) => {
      await fall('15 Start ohne NDI → Knopf „NDI nicht verfügbar“ binnen 10 s, Fenster view=ndi geht mit dem Sender zu; ▶ Präsentieren mit a.pdf → view=presenter und view=audience; App lebt nach 5 s', async () => {
        const k = await bisWert(() => ndiKnopf(ed), (v) => v === 'NDI nicht verfügbar', 10_000);
        const s = await ndiStatus(ed);
        erwarte(k === 'NDI nicht verfügbar', `Knopf „${k}“, Status ${JSON.stringify(s)}`);
        console.log(`      Grund: ${s?.grund}`);
        // Endet der Sender, schließt auch das NDI-Fenster – es zeichnete sonst jede Folie weiter und schickte sie ins Leere.
        erwarte(await warteBis(async () => !(await seiteMit('view=ndi')), 5_000), 'Fenster view=ndi bleibt offen, obwohl der Sender tot ist');
        const { x, y } = await auswerten(ed, imDom(domMitte));
        await ablegen(ed, [d.a], x, y);
        const n = await bisWert(() => folienZahl(ed), (v) => v === 2);
        erwarte(n === 2, `Folien · ${n ?? '–'} statt 2`);
        erwarte(await warteBis(() => auswerten(ed, imDom(domKlickePraesentieren)), 10_000), 'Knopf „▶ Präsentieren“ nicht bedienbar');
        await oeffneZiel(app, 'view=presenter', 15_000);
        await oeffneZiel(app, 'view=audience', 15_000);
        await pause(5_000);
        erwarte(app.beendet === null && presenterLaeuft(), `App lebt nicht mehr (${app.beendet})`);
        const p = await praesentation(ed);
        erwarte(p?.active === true, `Präsentation ${JSON.stringify(p)}`);
      });
    }, umgebung);
  }
  await fall('15 Original release/win-unpacked unberührt (app.asar samt @jm/ndi, resources/bin/win)', async () => {
    erwarte(original, 'Original vorher nicht gemessen');
    const nachher = fingerabdruck(exe);
    erwarte(JSON.stringify(nachher) === JSON.stringify(original), `vorher ${JSON.stringify(original)}, nachher ${JSON.stringify(nachher)}`);
    erwarte(nachher.ndiImAsar && nachher.bin.includes('jm_ndi.node'), `Original ohne NDI: ${JSON.stringify(nachher)}`);
  });
}

async function gruppeNdi({ exe, d }) {
  let ndi = null;
  // Ohne Empfang misst die Gruppe nichts: FAIL, nie überspringen.
  await fall('@jm/ndi lädt, NDI-Laufzeit startet (Empfang für die Messungen)', async () => {
    const modul = createRequire(import.meta.url)('@jm/ndi');
    erwarte(modul.init(), 'ndi.init() liefert false');
    ndi = modul;
  });
  if (!ndi) return;
  const umgebung = eigenesProfil(d.ndiProfil);
  try {
    await ndiMitProjekt(exe, d, ndi, umgebung);
    await ndiNeustart(exe, d, ndi, umgebung);
    await ndiFehlt(exe, d, umgebung);
  } finally {
    try {
      ndi.destroy();
    } catch {
      // schon zu
    }
  }
}

// ---------------------------------------------------------------- Gruppe vollbild (#309)

/**
 * Füllt das Fenster den GANZEN Bildschirm (Taskleiste verdeckt), nicht nur die Arbeitsfläche? Bis 1 px Rundung
 * (gebrochene Windows-Skalierung).
 */
function domVollbildMass() {
  return Math.abs(window.innerWidth - screen.width) <= 1 && Math.abs(window.innerHeight - screen.height) <= 1;
}

/** Knopf mit GENAU diesem Text: { aktiv } (hervorgehoben wie „Übersicht“), oder null ohne Knopf. */
function domKnopfGenau(text) {
  const k = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
  return k ? { aktiv: k.className.includes('bg-[var(--primary)]') } : null;
}

function domKlickeKnopfGenau(text) {
  const k = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
  if (!k || k.disabled) return false;
  k.click();
  return true;
}

/**
 * Kopf der Referentenansicht bei der aktuellen Breite: Knöpfe rechts aus dem Fenster, zweizeilig umgebrochene Knöpfe
 * (höher als eine Zeile, 32 px) und ob „■ Beenden“ ganz sichtbar ist (Review-Befund: der zusätzliche Knopf verdrängte ihn).
 */
function domKopfMass() {
  const knoepfe = [...document.querySelectorAll('header button')];
  const w = window.innerWidth;
  const ausserhalb = knoepfe.filter((b) => b.getBoundingClientRect().right > w + 0.5).map((b) => b.textContent.trim());
  const umgebrochen = knoepfe.filter((b) => b.getBoundingClientRect().height > 33).map((b) => b.textContent.trim());
  const r = knoepfe.find((b) => b.textContent.includes('Beenden'))?.getBoundingClientRect();
  // Folienzähler „1 / 2“ (erstes Kind des Kopfs) in EINER Zeile: Die beiden Zahlen stehen auf derselben Grundlinie.
  const [nr, von] = [...(document.querySelector('header > div')?.querySelectorAll('span') ?? [])].map((s) => s.getBoundingClientRect());
  const zaehlerEinzeilig = !!nr && !!von && Math.abs(nr.bottom - von.bottom) < 8;
  return {
    breite: w, ausserhalb, umgebrochen, zaehlerEinzeilig,
    beenden: !!r && r.left >= 0 && r.right <= w + 0.5 && r.bottom <= window.innerHeight,
  };
}

async function drueckeF11(ziel) {
  for (const type of ['rawKeyDown', 'keyUp']) {
    await ziel.send('Input.dispatchKeyEvent', { type, key: 'F11', code: 'F11', windowsVirtualKeyCode: 122 });
  }
}

/** Zustand des Referentenfensters: was der Main meldet, das Maß im Fenster und der Knopf „Vollbild“. */
async function vollbildLage(referent) {
  return {
    main: await auswerten(referent, 'window.jmpr.present.referentVollbild()'),
    mass: await auswerten(referent, imDom(domVollbildMass)),
    knopf: (await auswerten(referent, imDom(domKnopfGenau, 'Vollbild')))?.aktiv ?? null,
  };
}

const lageText = (l) => JSON.stringify(l);
const istVoll = (l) => l?.main === true && l.mass === true && l.knopf === true;
const istNormal = (l) => l?.main === false && l.mass === false && l.knopf === false;

/** Deck sicherstellen (nach einem Neustart ist der Editor leer), ▶ Präsentieren, Referentenfenster fertig. */
async function referentOeffnen(app, ed, d) {
  if ((await folienZahl(ed)) !== 2) {
    const { x, y } = await auswerten(ed, imDom(domMitte));
    await ablegen(ed, [d.a], x, y);
    erwarte((await bisWert(() => folienZahl(ed), (v) => v === 2)) === 2, 'Deck mit 2 Folien lädt nicht');
  }
  // Ein eben beendetes Referentenfenster darf nicht mehr in der Liste stehen, sonst verbände oeffneZiel das alte.
  erwarte(await warteBis(async () => !(await zielListe()).some((t) => t.url.includes('view=presenter')), 10_000), 'altes Referentenfenster bleibt');
  erwarte(await warteBis(() => auswerten(ed, imDom(domKlickePraesentieren)), 10_000), 'Knopf „▶ Präsentieren“ nicht bedienbar');
  const referent = await oeffneZiel(app, 'view=presenter', 15_000);
  await fensterFertig(referent);
  erwarte(await warteBis(() => auswerten(referent, imDom(domKnopfGenau, 'Vollbild')).then((k) => k !== null), 10_000), 'Knopf „Vollbild“ fehlt');
  return referent;
}

async function praesentationBeenden(ed, referent) {
  // Escape schließt das Fenster schon beim Drücken – das Loslassen findet dann keine Verbindung mehr (gewollt).
  await drueckeEscape(referent).catch(() => {});
  const aus = await warteBis(async () => (await auswerten(ed, 'window.jmpr.present.getState()'))?.active === false, 10_000);
  erwarte(aus, 'Escape beendet die Präsentation nicht');
}

async function gruppeVollbild({ exe, d }) {
  const profil = path.join(d.dir, 'profil-vollbild');
  const umgebung = eigenesProfil(profil);
  const config = path.join(profil, 'AppData', 'Roaming', '@jm', 'presenter', 'referent-config.json');
  const gemerkt = () => (fs.existsSync(config) ? JSON.parse(fs.readFileSync(config, 'utf8')) : null);

  await mitApp('vollbild', exe, [], async (app, ed) => {
    let referent = null;
    await fall('1 Kopf der Referentenansicht: „Publikum Vollbild“ und „Vollbild“, normales Fenster beim ersten Start', async () => {
      referent = await referentOeffnen(app, ed, d);
      erwarte((await auswerten(referent, imDom(domKnopfGenau, 'Publikum Vollbild'))) !== null, 'Knopf „Publikum Vollbild“ fehlt');
      const l = await vollbildLage(referent);
      erwarte(istNormal(l), `nicht normal: ${lageText(l)}`);
    });

    await fall('2 Knopf „Vollbild“ → Referentenfenster deckt den ganzen Bildschirm, Knopf hervorgehoben', async () => {
      if (!referent) ueberspringe('Referentenfenster fehlt');
      erwarte(await auswerten(referent, imDom(domKlickeKnopfGenau, 'Vollbild')), 'Knopf „Vollbild“ nicht bedienbar');
      const l = await bisWert(() => vollbildLage(referent), istVoll);
      erwarte(istVoll(l), `kein Vollbild: ${lageText(l)}`);
    });

    await fall('3 F11 schaltet genau einmal: aus, dann wieder an', async () => {
      if (!referent) ueberspringe('Referentenfenster fehlt');
      await drueckeF11(referent);
      const aus = await bisWert(() => vollbildLage(referent), istNormal);
      erwarte(istNormal(aus), `F11 schaltet nicht aus: ${lageText(aus)}`);
      await pause(1_000); // ein zweites (doppeltes) Umschalten käme hier
      const still = await vollbildLage(referent);
      erwarte(istNormal(still), `nach F11 wieder umgesprungen: ${lageText(still)}`);
      await drueckeF11(referent);
      const an = await bisWert(() => vollbildLage(referent), istVoll);
      erwarte(istVoll(an), `F11 schaltet nicht an: ${lageText(an)}`);
    });

    await fall('4 referent-config.json im Testprofil merkt vollbild: true', async () => {
      erwarte(gemerkt()?.vollbild === true, `${config}: ${JSON.stringify(gemerkt())}`);
    });

    await fall('5 Escape im Vollbild beendet; gemerkt bleibt true; nächste Präsentation öffnet im Vollbild', async () => {
      if (!referent) ueberspringe('Referentenfenster fehlt');
      await praesentationBeenden(ed, referent);
      erwarte(gemerkt()?.vollbild === true, `nach Escape gemerkt: ${JSON.stringify(gemerkt())}`);
      referent = await referentOeffnen(app, ed, d);
      const l = await bisWert(() => vollbildLage(referent), istVoll);
      erwarte(istVoll(l), `neue Referentenansicht nicht im Vollbild: ${lageText(l)}`);
    });
  }, umgebung);

  await mitApp('vollbild (Neustart)', exe, [], async (app, ed) => {
    let referent = null;
    await fall('6 App neu gestartet (selbes Profil): Referentenansicht öffnet im Vollbild', async () => {
      referent = await referentOeffnen(app, ed, d);
      const l = await bisWert(() => vollbildLage(referent), istVoll);
      erwarte(istVoll(l), `nach Neustart nicht im Vollbild: ${lageText(l)}`);
    });

    await fall('7 Knopf „Vollbild“ aus, beenden, neu präsentieren → normales Fenster', async () => {
      if (!referent) ueberspringe('Referentenfenster fehlt');
      erwarte(await auswerten(referent, imDom(domKlickeKnopfGenau, 'Vollbild')), 'Knopf „Vollbild“ nicht bedienbar');
      const aus = await bisWert(() => vollbildLage(referent), istNormal);
      erwarte(istNormal(aus), `Knopf schaltet nicht aus: ${lageText(aus)}`);
      await praesentationBeenden(ed, referent);
      erwarte(gemerkt()?.vollbild === false, `gemerkt: ${JSON.stringify(gemerkt())}`);
      referent = await referentOeffnen(app, ed, d);
      await pause(1_500); // ein (falsches) Vollbild beim Öffnen käme nach ready-to-show
      const l = await vollbildLage(referent);
      erwarte(istNormal(l), `nicht normal: ${lageText(l)}`);
    });

    // 1097 px = 1920×1080 bei 175 %; 1280 px = 150 % (häufigster Laptop); 1024 = minWidth des Referentenfensters.
    await fall('8 Kopf bei 1024, 1097 und 1280 px Breite: kein Knopf abgeschnitten oder umgebrochen, „■ Beenden“ ganz sichtbar', async () => {
      if (!referent) ueberspringe('Referentenfenster fehlt');
      try {
        for (const breite of [1024, 1097, 1280]) {
          await referent.send('Emulation.setDeviceMetricsOverride', { width: breite, height: 800, deviceScaleFactor: 1, mobile: false });
          await pause(300);
          const k = await auswerten(referent, imDom(domKopfMass));
          // Zum Ansehen von Hand: PRUEFSTAND_BILDER=<Ordner> legt je Breite ein PNG der Referentenansicht ab.
          if (process.env.PRUEFSTAND_BILDER) {
            const { data } = await referent.send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(path.join(process.env.PRUEFSTAND_BILDER, `referent-${breite}.png`), Buffer.from(data, 'base64'));
          }
          erwarte(Math.abs(k.breite - breite) <= 1, `Breite ${k.breite} statt ${breite} (Emulation greift nicht)`);
          erwarte(k.beenden, `${breite} px: „■ Beenden“ nicht ganz sichtbar: ${JSON.stringify(k)}`);
          erwarte(k.ausserhalb.length === 0 && k.umgebrochen.length === 0, `${breite} px: ${JSON.stringify(k)}`);
          erwarte(k.zaehlerEinzeilig, `${breite} px: Folienzähler umgebrochen: ${JSON.stringify(k)}`);
        }
      } finally {
        await referent.send('Emulation.clearDeviceMetricsOverride', {}).catch(() => {});
      }
    });
  }, umgebung);
}

const GRUPPEN = {
  ablage: gruppeAblage,
  navigation: gruppeNavigation,
  doppelklick: gruppeDoppelklick,
  steuerbefehl: gruppeSteuerbefehl,
  ndi: gruppeNdi,
  vollbild: gruppeVollbild,
};

// ---------------------------------------------------------------- Ablauf

function abbruch(meldung) {
  console.error(meldung);
  process.exit(2);
}

function leseArgumente(argv) {
  const opt = { exe: path.join(HIER, '..', 'release', 'win-unpacked', BILD), nur: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--exe' && argv[i + 1]) opt.exe = path.resolve(argv[++i]);
    else if (argv[i] === '--nur' && argv[i + 1]) opt.nur = argv[++i].split(',').map((g) => g.trim()).filter(Boolean);
    else abbruch(`Prüfstand: unbekanntes Argument „${argv[i]}“ (erlaubt: --exe <pfad>, --nur <gruppe,…>)`);
  }
  return opt;
}

const opt = leseArgumente(process.argv.slice(2));
const gruppen = opt.nur ?? Object.keys(GRUPPEN);
const unbekannt = gruppen.filter((g) => !Object.hasOwn(GRUPPEN, g));
if (unbekannt.length) {
  abbruch(`Prüfstand: unbekannte Gruppe ${unbekannt.join(', ')} (bekannt: ${Object.keys(GRUPPEN).join(', ')})`);
}
if (process.platform !== 'win32') abbruch('Prüfstand: läuft nur unter Windows.');
if (!fs.existsSync(opt.exe)) abbruch(`Prüfstand: ${opt.exe} fehlt – erst „npm run dist:dir“.`);
if (presenterLaeuft()) {
  abbruch('Prüfstand: ein Presenter läuft schon (Single-Instance-Lock) – bitte erst schließen.');
}

console.log(`Prüfstand: ${opt.exe}`);
const dateien = await baueTestdateien();
try {
  for (const g of gruppen) {
    console.log(`[${g}]`);
    await GRUPPEN[g]({ exe: opt.exe, d: dateien });
  }
} finally {
  // Die App hält Dateien im Testprofil evtl. noch kurz nach dem Beenden.
  fs.rmSync(dateien.dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}
console.log(`pruefstand: ${stand.ok} ok, ${stand.fail} FAIL, ${stand.skip} übersprungen`);
process.exit(stand.fail ? 1 : 0);

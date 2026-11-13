// Prüfstand für den GEPACKTEN Presenter (#298/#299): startet die Exe mit
// Remote-Debugging, steuert sie per Chrome DevTools Protocol und legt echte
// Dateien ab (`Input.dispatchDragEvent` mit `data.files`).
//
//   npm run dist:dir
//   node test/pruefstand.mjs [--exe <pfad>] [--nur <gruppe,…>]
//
// electron liegt ans Workspace-Root gehoistet; electron-builder findet die Version lokal
// dann nicht (CI schreibt sie in die Config). Lokal also, in Git Bash:
//   npm run dist:dir -- -c.electronVersion=$(node -p "require('electron/package.json').version") -c.npmRebuild=false
//
// Gruppen: siehe GRUPPEN unten. Ausgabe je Fall „  ok  …“ / „FAIL  …“ /
// „skip  … (Grund)“, zuletzt die Summe. Exit 1 bei FAIL, Exit 2, wenn der
// Prüfstand gar nicht laufen kann.
//
// Gepackte und installierte App teilen Single-Instance-Lock und userData: Läuft
// schon ein JM Presenter, bricht der Prüfstand ab, statt still mit der falschen
// App zu reden. Er beendet nur Prozessbäume, die er selbst gestartet hat.
// Windows, Node ≥ 22 (globales WebSocket); pdf-lib und fflate aus dem Workspace.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { strToU8, zipSync } from 'fflate';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const BILD = 'JM Presenter.exe';
const PORT = 9333;
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

/** Vom Prüfstand gestartete Apps; werden auch bei Fehlern und Strg+C beendet. */
const laufende = new Set();
process.on('exit', () => {
  for (const app of laufende) toeteBaum(app.pid);
});
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => process.exit(130));

/** Startet die Exe mit Remote-Debugging. Umgebung ohne ELECTRON_RUN_AS_NODE. */
function starteApp(exe, args = []) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => k.toUpperCase() !== 'ELECTRON_RUN_AS_NODE'),
  );
  const kind = spawn(exe, [`--remote-debugging-port=${PORT}`, ...args], { env, stdio: 'ignore' });
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
  if (app.pid) toeteBaum(app.pid);
  laufende.delete(app);
  // Erst wenn alle Prozesse weg sind, ist der Single-Instance-Lock frei.
  const weg = await warteBis(() => !presenterLaeuft(), 15_000, 250);
  if (!weg) throw new Error('Presenter-Prozesse laufen nach taskkill weiter');
}

/** Startet die App, öffnet den Editor, führt `fn(app, editor)` aus, beendet die App immer. */
async function mitApp(gruppe, exe, args, fn) {
  const app = starteApp(exe, args);
  try {
    const editor = await oeffneEditor(app);
    await fn(app, editor);
  } catch (e) {
    stand.fail++;
    console.log(`FAIL  ${gruppe}: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    try {
      await beendeApp(app);
    } catch (e) {
      stand.fail++;
      console.log(`FAIL  ${gruppe}: ${e.message}`);
    }
  }
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
  };
  fs.writeFileSync(d.a, await pdf(2));
  fs.writeFileSync(d.eins, eins);
  fs.writeFileSync(d.maerz, await pdf(1));
  fs.writeFileSync(d.png, Buffer.from(PNG_1X1, 'base64'));
  fs.writeFileSync(d.rtf, '{\\rtf1\\ansi Hallo}');
  fs.writeFileSync(d.mp4, Uint8Array.of(0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50));
  fs.mkdirSync(d.ordner);
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
  return d;
}

// ---------------------------------------------------------------- Gruppen

async function gruppeAblage({ exe, d }) {
  await mitApp('ablage', exe, [], async (_app, ed) => {
    const { x, y } = await auswerten(ed, imDom(domMitte));

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

    await fall('Folie 1 auf Folie 3 ziehen (ohne Dateien) → keine Ablege-Fläche, Folienzahl gleich', async () => {
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
  });
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

async function gruppeNavigation({ exe, d }) {
  await mitApp('navigation', exe, [], async (app, ed) => {
    await fall('Ablegen aufs leere Editor-Fenster lässt die Seite stehen', async () => {
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
      await fall(`${name}: eins.pdf ablegen → Adresse gleich, Präsentation weiter aktiv, Index gleich`, async () => {
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
  });
}

const GRUPPEN = {
  ablage: gruppeAblage,
  navigation: gruppeNavigation,
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
  fs.rmSync(dateien.dir, { recursive: true, force: true });
}
console.log(`pruefstand: ${stand.ok} ok, ${stand.fail} FAIL, ${stand.skip} übersprungen`);
process.exit(stand.fail ? 1 : 0);

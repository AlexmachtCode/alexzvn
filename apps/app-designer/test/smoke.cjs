// End-to-End-Smoke-Test der exportierten Bundles — in echtem Chromium, von file://.
//
//   npx electron test/smoke.cjs <bundle-ordner> <vorlage>
//     vorlage: wheel | quiz | memory | dragdrop
//
// Prüft, was Typecheck und Unit-Tests NICHT sehen können:
//   • lädt die Seite unter file:// überhaupt (ESM/CORS/CSP-Fallen)?
//   • rendert die Runtime das Spiel?
//   • feuert die Interaktion die Regelkette bis zum Szenenwechsel?
//   • bleibt die Konsole frei von Fehlern?
//
// CJS, nicht ESM: Electron 33 lädt einen .mjs-Main-Entry als CommonJS und stirbt.

const { app, BrowserWindow } = require('electron');
const { pathToFileURL } = require('node:url');
const { join, resolve } = require('node:path');

// Electron warnt bei jeder Seite ohne CSP. Das exportierte Bundle trägt bewusst
// keine: es soll in jedem Browser und von file:// laufen, wo 'self' gegen eine
// opaque Origin nichts trifft. Die Warnung beschreibt die Testumgebung, nicht das
// Artefakt — sie würde hier jeden Lauf rot färben.
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const bundleDir = resolve(process.argv[2] || '');
const template = process.argv[3] || 'wheel';
if (!process.argv[2]) {
  console.error('usage: electron test/smoke.cjs <bundle-ordner> <wheel|quiz|memory|dragdrop>');
  process.exit(1);
}

const errors = [];
const fail = (msg) => {
  console.error(`  FEHLER  ${msg}`);
  errors.push(msg);
};
const ok = (msg) => console.log(`  ok  ${msg}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.commandLine.appendSwitch('disable-gpu');

/** Tippt ein Element an (echter Klick über die DOM-API der Seite). */
const clickJs = (sel) => `document.querySelector(${JSON.stringify(sel)}).click(); true`;
const nodeSel = (id) => `[data-node-id="${id}"]`;

// ── Die vier Spieltypen ──────────────────────────────────────────────────────

async function checkWheel(js) {
  const wheel = 'wheel_tpl_main';
  const sectors = await js(`document.querySelectorAll('${nodeSel(wheel)} svg path').length`);
  sectors === 6 ? ok('6 Sektoren gezeichnet') : fail(`erwartet 6 Sektoren, gefunden ${sectors}`);

  const v0 = await vars(js);
  v0.drehungen === 0 ? ok('Variablen initialisiert (drehungen=0)') : fail(`Startvariablen: ${JSON.stringify(v0)}`);

  await js(clickJs(nodeSel(wheel)));
  console.log('  …  Rad gedreht, warte auf Stillstand + Regelkette');
  await wait(6200);

  const v1 = await vars(js);
  v1.drehungen === 1 ? ok('Regel "onWheelStop → addVar" gefeuert') : fail(`drehungen=${v1.drehungen}`);
  ['gewinn', 'niete', 'hauptpreis'].includes(v1.ergebnis)
    ? ok(`Ergebnis in Variable: "${v1.ergebnis}"`)
    : fail(`unerwartetes Ergebnis: ${JSON.stringify(v1.ergebnis)}`);

  const gone = !(await js(`!!document.querySelector('${nodeSel(wheel)}')`));
  gone ? ok('Bedingte Regel auf $result hat die Szene gewechselt') : fail('Szene wurde nicht gewechselt');
}

async function checkQuiz(js) {
  const quiz = 'quiz_quiz_main';
  const buttons = `${nodeSel(quiz)} button`;
  const count = await js(`document.querySelectorAll('${buttons}').length`);
  count === 4 ? ok('4 Antwortkacheln gerendert') : fail(`erwartet 4 Antworten, gefunden ${count}`);

  // Antworten sind gemischt — die richtige über den Text suchen, nicht über den Index.
  const answerOf = (text) =>
    `Array.from(document.querySelectorAll('${buttons}')).find(b => b.textContent.trim() === ${JSON.stringify(text)})`;

  // Frage 1 absichtlich FALSCH beantworten: der Punktezähler darf nicht steigen.
  await js(`${answerOf('12')}.click(); true`);
  await wait(400);
  let v = await vars(js);
  v.punkte === 0 ? ok('falsche Antwort zählt keinen Punkt') : fail(`punkte=${v.punkte} nach falscher Antwort`);

  const marked = await js(`${answerOf('✗  12')} != null`);
  marked ? ok('falsche Antwort ist markiert (✗ + Farbe)') : fail('keine Rückmeldung auf die falsche Antwort');

  // Gesperrt: ein zweiter Tipp darf nicht zählen.
  const disabled = await js(`Array.from(document.querySelectorAll('${buttons}')).every(b => b.disabled)`);
  disabled ? ok('alle Kacheln nach der Antwort gesperrt') : fail('Kacheln bleiben nach der Antwort klickbar');

  await wait(1500); // advanceMs
  // Frage 2 und 3 richtig.
  await js(`${answerOf('Kondensator')}.click(); true`);
  await wait(1900);
  v = await vars(js);
  v.punkte === 1 ? ok('richtige Antwort zählt einen Punkt') : fail(`punkte=${v.punkte} nach richtiger Antwort`);

  await js(`${answerOf('Network Device Interface')}.click(); true`);
  await wait(2200);
  v = await vars(js);
  v.punkte === 2 ? ok('Punktestand nach der letzten Frage: 2') : fail(`punkte=${v.punkte}`);

  const gone = !(await js(`!!document.querySelector('${nodeSel(quiz)}')`));
  gone ? ok('onComplete hat zur Ergebnisseite gewechselt') : fail('kein Wechsel zur Ergebnisseite');

  const shown = await js(`document.querySelector('${nodeSel('text_quiz_final')}').textContent`);
  shown === '2' ? ok('Ergebnisseite zeigt die gebundene Variable (2)') : fail(`Ergebnisseite zeigt "${shown}"`);
}

async function checkMemory(js) {
  const mem = 'memory_mem_main';
  const cards = `${nodeSel(mem)} button`;
  const count = await js(`document.querySelectorAll('${cards}').length`);
  count === 12 ? ok('12 Karten (6 Paare) gerendert') : fail(`erwartet 12 Karten, gefunden ${count}`);

  const backs = await js(
    `Array.from(document.querySelectorAll('${cards}')).every(b => b.textContent.trim() === '?')`,
  );
  backs ? ok('alle Karten liegen verdeckt') : fail('Karten starten nicht verdeckt');

  // Zwei ungleiche Karten: das Brett muss sperren und beide zurückdrehen.
  await js(`document.querySelectorAll('${cards}')[0].click(); true`);
  const first = await js(`document.querySelectorAll('${cards}')[0].textContent`);
  const other = await js(
    `Array.from(document.querySelectorAll('${cards}')).findIndex(b => b.textContent.trim() === '?' )`,
  );
  await js(`document.querySelectorAll('${cards}')[${other}].click(); true`);
  await wait(120);

  const openNow = await js(
    `Array.from(document.querySelectorAll('${cards}')).filter(b => b.textContent.trim() !== '?').length`,
  );
  openNow === 2 ? ok('zwei Karten offen') : fail(`${openNow} Karten offen statt 2`);

  // Während der Sperre darf ein dritter Tipp nichts aufdecken.
  await js(
    `const i = Array.from(document.querySelectorAll('${cards}')).findIndex(b => b.textContent.trim() === '?');` +
      `document.querySelectorAll('${cards}')[i].click(); true`,
  );
  const duringLock = await js(
    `Array.from(document.querySelectorAll('${cards}')).filter(b => b.textContent.trim() !== '?').length`,
  );
  duringLock === 2 ? ok('Brett ist gesperrt, solange zurückgedreht wird') : fail(`${duringLock} Karten offen`);

  await wait(1200);
  const afterFlip = await js(
    `Array.from(document.querySelectorAll('${cards}')).filter(b => b.textContent.trim() !== '?').length`,
  );
  afterFlip === 0 ? ok('ungleiche Karten wieder verdeckt') : fail(`${afterFlip} Karten blieben offen`);
  void first;

  // Jetzt gezielt alle Paare aufdecken: Karten mit gleichem Paar über die
  // sichtbaren Beschriftungen zu finden ginge nicht (sie sind verdeckt) — also
  // decken wir sie paarweise per Brute-Force auf.
  await solveMemory(js, cards);

  const v = await vars(js);
  v.paare === 6 ? ok('alle 6 Paare gefunden (Zähler stimmt)') : fail(`paare=${v.paare}`);

  await wait(700);
  const gone = !(await js(`!!document.querySelector('${nodeSel(mem)}')`));
  gone ? ok('onComplete hat zur Endszene gewechselt') : fail('kein Wechsel zur Endszene');
}

/**
 * Deckt alle Paare auf. Die Zuordnung ist von außen unsichtbar, also probieren
 * wir Kombinationen und merken uns, was hinter jeder Karte steckt.
 */
async function solveMemory(js, cards) {
  const PAIRS = {
    Berlin: 'Deutschland',
    Paris: 'Frankreich',
    Rom: 'Italien',
    Madrid: 'Spanien',
    Wien: 'Österreich',
    Oslo: 'Norwegen',
  };
  const partner = { ...PAIRS };
  for (const [a, b] of Object.entries(PAIRS)) partner[b] = a;

  const known = new Map(); // Beschriftung → Kartenindex
  const total = 12;

  for (let i = 0; i < total; i++) {
    const done = await js(`document.querySelectorAll('${cards}')[${i}].style.opacity === '0.55'`);
    if (done) continue;

    await js(`document.querySelectorAll('${cards}')[${i}].click(); true`);
    const label = (await js(`document.querySelectorAll('${cards}')[${i}].textContent`)).trim();
    const mate = partner[label];

    if (known.has(mate)) {
      await js(`document.querySelectorAll('${cards}')[${known.get(mate)}].click(); true`);
      await wait(60);
      known.delete(mate);
    } else {
      known.set(label, i);
      // Karte wieder schließen, indem eine zweite, garantiert ungleiche gewählt wird
      // wäre langsam — stattdessen den Zurückdreh-Timer abwarten.
      const nextIdx = await js(
        `Array.from(document.querySelectorAll('${cards}')).findIndex((b,j) => j !== ${i} && b.textContent.trim() === '?' && b.style.opacity !== '0.55')`,
      );
      if (nextIdx >= 0) {
        await js(`document.querySelectorAll('${cards}')[${nextIdx}].click(); true`);
        const label2 = (await js(`document.querySelectorAll('${cards}')[${nextIdx}].textContent`)).trim();
        if (partner[label2] === label) {
          known.delete(label);
          await wait(60);
        } else {
          known.set(label2, nextIdx);
          await wait(1100); // flipBackMs
        }
      }
    }
  }
}

async function checkDragDrop(js) {
  const zoneM = 'zone_dnd_mammals';
  const zoneB = 'zone_dnd_birds';

  const v0 = await vars(js);
  v0.abgelegt === 0 ? ok('Zähler startet bei 0') : fail(`abgelegt=${v0.abgelegt}`);

  // Falsche Zone: Hund (saeugetier) auf die Vogel-Fläche → muss abprallen.
  await drag(js, 'item_dnd_dog', zoneB);
  await wait(150);
  let v = await vars(js);
  v.abgelegt === 0 ? ok('falsche Fläche nimmt das Element nicht an') : fail(`abgelegt=${v.abgelegt} nach Fehlwurf`);

  const home = await js(
    `(() => { const e = document.querySelector('${nodeSel('item_dnd_dog')}');` +
      `return e.style.left === '120px' && e.style.top === '220px'; })()`,
  );
  home ? ok('abgelehntes Element springt an seinen Platz zurück') : fail('Element blieb auf der falschen Fläche');

  // Richtig zuordnen.
  await drag(js, 'item_dnd_dog', zoneM);
  await wait(120);
  v = await vars(js);
  v.abgelegt === 1 ? ok('korrekte Ablage zählt (abgelegt=1)') : fail(`abgelegt=${v.abgelegt}`);

  // Erneut ziehen: gesperrt, der Zähler darf sich nicht bewegen.
  await drag(js, 'item_dnd_dog', zoneM);
  await wait(120);
  v = await vars(js);
  v.abgelegt === 1
    ? ok('abgelegtes Element ist gesperrt — der Zähler zählt Elemente, nicht Vorgänge')
    : fail(`abgelegt=${v.abgelegt} nach erneutem Ziehen`);

  await drag(js, 'item_dnd_cat', zoneM);
  await drag(js, 'item_dnd_eagle', zoneB);
  await drag(js, 'item_dnd_owl', zoneB);
  await wait(900); // delayMs der Szenen-Regel

  v = await vars(js);
  v.abgelegt === 4 ? ok('alle vier zugeordnet') : fail(`abgelegt=${v.abgelegt}`);

  const gone = !(await js(`!!document.querySelector('${nodeSel('item_dnd_owl')}')`));
  gone ? ok('Szenen-Regel auf onVarChange hat gewechselt') : fail('kein Wechsel zur Endszene');
}

/** Simuliert einen Pointer-Drag vom Element in die Mitte der Zielfläche. */
async function drag(js, itemId, zoneId) {
  await js(`(() => {
    const item = document.querySelector('${nodeSel(itemId)}');
    const zone = document.querySelector('${nodeSel(zoneId)}');
    const a = item.getBoundingClientRect();
    const b = zone.getBoundingClientRect();
    const from = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
    const to = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    const opts = (p) => ({ pointerId: 1, bubbles: true, cancelable: true, clientX: p.x, clientY: p.y });
    item.setPointerCapture = () => {};
    item.releasePointerCapture = () => {};
    item.dispatchEvent(new PointerEvent('pointerdown', opts(from)));
    item.dispatchEvent(new PointerEvent('pointermove', opts(to)));
    item.dispatchEvent(new PointerEvent('pointerup', opts(to)));
    return true;
  })()`);
}

const CHECKS = { wheel: checkWheel, quiz: checkQuiz, memory: checkMemory, dragdrop: checkDragDrop };

async function vars(js) {
  return JSON.parse(await js(`JSON.stringify(window.JMApp.handle.getVars())`));
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  // Jede Konsolen-Meldung ab Warnstufe ist verdächtig: CSP-Verstöße, CORS-Blocks
  // und fehlgeschlagene Script-Loads melden sich genau hier.
  const consoleErrors = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) consoleErrors.push(message);
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => fail(`Laden fehlgeschlagen: ${desc} (${code})`));

  const url = pathToFileURL(join(bundleDir, 'index.html')).href;
  console.log(`\n[${template}]  ${url}\n`);
  await win.loadURL(url);

  const js = (code) => win.webContents.executeJavaScript(code, true);

  const booted = await js(`!!(window.JMApp && window.JMApp.handle)`);
  booted ? ok('Runtime gebootet') : fail('Runtime nicht gebootet');
  const stage = await js(`!!document.querySelector('[data-jmapp-stage]')`);
  stage ? ok('Bühne gerendert') : fail('Keine Bühne im DOM');

  const check = CHECKS[template];
  if (!check) fail(`unbekannte Vorlage: ${template}`);
  else if (booted) await check(js);

  if (consoleErrors.length === 0) {
    ok('Konsole frei von Fehlern (kein CSP-/CORS-Problem unter file://)');
  } else {
    for (const m of consoleErrors) fail(`Konsole: ${m}`);
  }

  console.log(errors.length === 0 ? `\n[${template}] bestanden.\n` : `\n[${template}] ${errors.length} Fehler.\n`);
  app.exit(errors.length === 0 ? 0 : 1);
});

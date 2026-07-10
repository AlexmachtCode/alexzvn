// End-to-End-Smoke-Test des exportierten Bundles — in echtem Chromium, von file://.
//
//   npx electron test/smoke.cjs <bundle-ordner>
//
// Prüft genau das, was Typecheck und Unit-Tests NICHT sehen können:
//   • lädt die Seite unter file:// überhaupt (ESM/CORS/CSP-Fallen)?
//   • rendert die Runtime die Bühne und das Rad?
//   • feuert ein Tipp aufs Rad die Regelkette bis zum bedingten Szenenwechsel?
//   • bleibt die Konsole frei von Fehlern?
//
// CJS, nicht ESM: Electron 33 lädt einen .mjs-Main-Entry als CommonJS und stirbt.

const { app, BrowserWindow } = require('electron');
const { pathToFileURL } = require('node:url');
const { join, resolve } = require('node:path');

const bundleDir = resolve(process.argv[2] || '');
if (!process.argv[2]) {
  console.error('usage: electron test/smoke.cjs <bundle-ordner>');
  process.exit(1);
}

// Electron warnt bei jeder Seite ohne CSP. Das exportierte Bundle trägt bewusst
// keine: es soll in jedem Browser und von file:// laufen, wo 'self' gegen eine
// opaque Origin nichts trifft. Die Warnung beschreibt die Testumgebung, nicht das
// Artefakt — sie würde hier jeden Lauf rot färben.
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const errors = [];
const fail = (msg) => {
  console.error(`  FEHLER  ${msg}`);
  errors.push(msg);
};
const ok = (msg) => console.log(`  ok  ${msg}`);

app.commandLine.appendSwitch('disable-gpu');

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
  console.log(`\nLade ${url}\n`);
  await win.loadURL(url);

  const js = (code) => win.webContents.executeJavaScript(code, true);

  // 1. Die Runtime ist gestartet und hat die Bühne aufgebaut.
  const booted = await js(`!!(window.JMApp && window.JMApp.handle)`);
  booted ? ok('Runtime gebootet (window.JMApp.handle)') : fail('Runtime nicht gebootet');

  const stage = await js(`!!document.querySelector('[data-jmapp-stage]')`);
  stage ? ok('Bühne gerendert') : fail('Keine Bühne im DOM');

  // 2. Die Startszene zeigt das Rad.
  const wheelId = 'wheel_tpl_main';
  const hasWheel = await js(`!!document.querySelector('[data-node-id="${wheelId}"] svg')`);
  hasWheel ? ok('Glücksrad als SVG gerendert') : fail('Glücksrad fehlt');

  const sectors = await js(`document.querySelectorAll('[data-node-id="${wheelId}"] svg path').length`);
  sectors === 6 ? ok('6 Sektoren gezeichnet') : fail(`erwartet 6 Sektoren, gefunden ${sectors}`);

  const vars0 = JSON.parse(await js(`JSON.stringify(window.JMApp.handle.getVars())`));
  vars0.drehungen === 0 && vars0.ergebnis === ''
    ? ok('Variablen initialisiert (drehungen=0)')
    : fail(`Startvariablen falsch: ${JSON.stringify(vars0)}`);

  // 3. Aufs Rad tippen → drehen → onWheelStop → Regelkette → bedingter Szenenwechsel.
  //    spinMs 4200 + delayMs 800 der goToScene-Aktion, plus Reserve.
  await js(`document.querySelector('[data-node-id="${wheelId}"]').click(); true`);
  console.log('  …  Rad gedreht, warte auf Stillstand + Regelkette');
  await new Promise((r) => setTimeout(r, 6200));

  const vars1 = JSON.parse(await js(`JSON.stringify(window.JMApp.handle.getVars())`));
  vars1.drehungen === 1
    ? ok('Regel "onWheelStop → addVar" gefeuert (drehungen=1)')
    : fail(`drehungen sollte 1 sein, ist ${vars1.drehungen}`);

  ['gewinn', 'niete', 'hauptpreis'].includes(vars1.ergebnis)
    ? ok(`Ergebnis in Variable geschrieben: "${vars1.ergebnis}"`)
    : fail(`unerwartetes Ergebnis: ${JSON.stringify(vars1.ergebnis)}`);

  // Szenenwechsel: das Rad darf nicht mehr im DOM stehen.
  const stillOnWheelScene = await js(`!!document.querySelector('[data-node-id="${wheelId}"]')`);
  !stillOnWheelScene
    ? ok('Bedingte Regel hat die Szene gewechselt')
    : fail('Szene wurde nicht gewechselt — Bedingung auf $result greift nicht');

  // 4. Keine Konsolen-Fehler (CSP, CORS, fehlende Assets).
  if (consoleErrors.length === 0) {
    ok('Konsole frei von Fehlern (kein CSP-/CORS-Problem unter file://)');
  } else {
    for (const m of consoleErrors) fail(`Konsole: ${m}`);
  }

  console.log(errors.length === 0 ? '\nSmoke-Test bestanden.\n' : `\n${errors.length} Fehler.\n`);
  app.exit(errors.length === 0 ? 0 : 1);
});

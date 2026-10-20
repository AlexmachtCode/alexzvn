// Prüfer für den Mac-Nachbau aus einem bestehenden Tag (.github/workflows/mac-nachbau.yml; Entwurf mac-fassungen,
// Stufe 1; Owner-Freigabe 20.10.2026, F1–F4). Läuft im Bau-Job je Mac-Art nach electron-builder, vor dem Artefakt:
//
//   node scripts/ci/pruefe-mac-nachbau.mjs --app editor --version 0.5.0 --art arm64 \
//     --release apps/editor/release --lesestand scripts/ci/mac-nachbau-lesestand.json [--probe]
//
// Geprüft: genau ein DMG (das der Job-Art, Name wie artifactName), genau eine .app; App-Programm und ffmpeg haben die
// Job-Art (Mach-O-Kopf, auch Fat); ffprobe ist die Job-Art oder, im arm64-Job, die festgelegte Ausnahme x86_64
// (ffprobe-static 3.1.0 hat kein arm64-Programm); SHA-256 von ffmpeg und ffprobe gegen den Lesestand (Abweichung =
// Abbruch; leer = mit --probe Warnung samt Messwerten, sonst Abbruch). Unter macOS dazu: ffmpeg -version (im Intel-Job
// auch ffprobe -version) muss mit 0 enden; minos von App-Programm und ffmpeg wird gedruckt, über macOS 11 = Warnung.
// Ohne macOS entfallen Laufzeitprobe und minos: mit --probe nur ein Hinweis, sonst Abbruch.
// Exit 0: in Ordnung (Hinweise auf stdout, Warnungen als ::warning::). Exit 1: jede Abweichung als Zeile auf stderr.
// Exit 2: Aufruf falsch. Nur node:-Module: Der Workflow holt diese Datei aus seinem eigenen Commit (werkzeug/).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/** Apps, die der Nachbau kennt. Stufe 2 erweitert die Liste, zusammen mit ERLAUBTE_APPS im Workflow. */
export const APPS = { editor: { produkt: 'JM Editor' } };

/** Mac-Arten: CPU-Typ im Mach-O-Kopf, Name für otool -arch, Ausgabeordner von electron-builder 24.13.3. */
export const ARTEN = {
  arm64: { cpu: 0x0100000c, otool: 'arm64', ordner: 'mac-arm64' },
  x64: { cpu: 0x01000007, otool: 'x86_64', ordner: 'mac' },
};

const MH_MAGIC = 0xfeedface;
const MH_MAGIC_64 = 0xfeedfacf;
const FAT_MAGIC = 0xcafebabe;
const FAT_MAGIC_64 = 0xcafebabf;
const HEX64 = /^[0-9a-f]{64}$/;

function artVonCpu(cpu) {
  for (const [art, a] of Object.entries(ARTEN)) if (a.cpu === cpu) return art;
  return `unbekannt:0x${cpu.toString(16).padStart(8, '0')}`;
}

/** Mac-Arten aus dem Mach-O-Kopf (dünn oder Fat), in Dateireihenfolge; null = kein Mach-O. */
export function machoArten(kopf) {
  if (!kopf || kopf.length < 8) return null;
  const le = kopf.readUInt32LE(0);
  if (le === MH_MAGIC_64 || le === MH_MAGIC) return [artVonCpu(kopf.readUInt32LE(4))];
  const be = kopf.readUInt32BE(0);
  if (be === MH_MAGIC_64 || be === MH_MAGIC) return [artVonCpu(kopf.readUInt32BE(4))];
  if (be !== FAT_MAGIC && be !== FAT_MAGIC_64) return null;
  const n = kopf.readUInt32BE(4);
  const groesse = be === FAT_MAGIC ? 20 : 32;
  // Java-Klassen beginnen auch mit cafebabe; dort steht an dieser Stelle die Klassenfassung (ab 45), nie eine kleine Zahl.
  if (n < 1 || n > 30 || kopf.length < 8 + n * groesse) return null;
  return Array.from({ length: n }, (_, i) => artVonCpu(kopf.readUInt32BE(8 + i * groesse)));
}

/** minos aus der Ausgabe von otool -l: LC_BUILD_VERSION (minos) vor LC_VERSION_MIN_MACOSX (version); null = keins. */
export function leseMinos(otoolText) {
  let build = null;
  let alt = null;
  for (const block of String(otoolText).split(/^Load command \d+\s*$/m)) {
    const cmd = /^\s*cmd (\S+)\s*$/m.exec(block)?.[1];
    if (cmd === 'LC_BUILD_VERSION' && build === null) build = /^\s*minos (\S+)\s*$/m.exec(block)?.[1] ?? null;
    if (cmd === 'LC_VERSION_MIN_MACOSX' && alt === null) alt = /^\s*version (\S+)\s*$/m.exec(block)?.[1] ?? null;
  }
  return build ?? alt;
}

/** Liegt minos über macOS 11.0? Electron 33 läuft ab macOS 11; ein Teil, der mehr verlangt, startet dort nicht. */
export function ueberMacos11(minos) {
  const [a = 0, b = 0] = String(minos).split('.').map((n) => parseInt(n, 10) || 0);
  return a > 11 || (a === 11 && b > 0);
}

/** Name des DMG wie artifactName "${productName}-${version}-${os}-${arch}.${ext}" und der Katalog (suite.json). */
export function erwarteterDmgName(app, version, art) {
  return `${APPS[app].produkt}-${version}-mac-${art}.dmg`;
}

/** Pfade in der gepackten App (extraResources resources → Contents/Resources, bundle-ffmpeg nach bin/mac). */
export function appPfade(release, app, art) {
  const produkt = APPS[app].produkt;
  const contents = join(release, ARTEN[art].ordner, `${produkt}.app`, 'Contents');
  const bin = join(contents, 'Resources', 'bin', 'mac');
  return { programm: join(contents, 'MacOS', produkt), ffmpeg: join(bin, 'ffmpeg'), ffprobe: join(bin, 'ffprobe') };
}

function kopfVon(pfad) {
  const fd = openSync(pfad, 'r');
  try {
    const puffer = Buffer.alloc(4096);
    return puffer.subarray(0, readSync(fd, puffer, 0, puffer.length, 0));
  } finally {
    closeSync(fd);
  }
}

const sha256 = (pfad) => createHash('sha256').update(readFileSync(pfad)).digest('hex');
const liste = (namen) => `${namen.length}${namen.length ? `: ${namen.join(', ')}` : ''}`;

/**
 * Prüft den release-Ordner eines Bau-Jobs. `macos` ist { starte(pfad, args) → { status, error?, stdout, stderr },
 * otool(pfad, otoolArt) → string } oder null (nicht unter macOS: Laufzeitprobe und minos entfallen; mit probe ein
 * Hinweis, sonst ein Fehler).
 */
export function pruefeMacNachbau({ release, app, version, art, lesestand, probe }, macos) {
  const fehler = [];
  const warnungen = [];
  const hinweise = [];
  const gemessen = {};
  const ergebnis = () => ({ ok: fehler.length === 0, fehler, warnungen, hinweise, gemessen });
  if (!existsSync(release) || !statSync(release).isDirectory()) {
    fehler.push(`Ordner „${release}“ fehlt.`);
    return ergebnis();
  }
  const eintraege = readdirSync(release, { withFileTypes: true });
  const dmgs = eintraege.filter((e) => e.isFile() && e.name.endsWith('.dmg')).map((e) => e.name).sort();
  const dmg = erwarteterDmgName(app, version, art);
  if (dmgs.length !== 1 || dmgs[0] !== dmg) fehler.push(`genau ein DMG „${dmg}“ erwartet, gefunden ${liste(dmgs)}.`);
  const apps = eintraege
    .filter((e) => e.isDirectory() && e.name.startsWith('mac'))
    .flatMap((e) => readdirSync(join(release, e.name), { withFileTypes: true })
      .filter((a) => a.isDirectory() && a.name.endsWith('.app'))
      .map((a) => `${e.name}/${a.name}`))
    .sort();
  const app1 = `${ARTEN[art].ordner}/${APPS[app].produkt}.app`;
  if (apps.length !== 1 || apps[0] !== app1) {
    fehler.push(`genau eine App „${app1}“ erwartet, gefunden ${liste(apps)}.`);
    return ergebnis();
  }

  const pfade = appPfade(release, app, art);
  const artenVon = (name, pfad) => {
    if (!existsSync(pfad)) {
      fehler.push(`${name} fehlt: ${pfad}`);
      return null;
    }
    const arten = machoArten(kopfVon(pfad));
    if (!arten) fehler.push(`${name} ist kein Mach-O-Programm: ${pfad}`);
    return arten;
  };
  const programm = artenVon('App-Programm', pfade.programm);
  if (programm && !programm.includes(art)) fehler.push(`App-Programm hat ${programm.join('+')}, erwartet ${art}.`);
  const ffmpeg = artenVon('ffmpeg', pfade.ffmpeg);
  if (ffmpeg && !ffmpeg.includes(art)) fehler.push(`ffmpeg hat ${ffmpeg.join('+')}, erwartet ${art} (die Mac-Art der App).`);
  const ffprobe = artenVon('ffprobe', pfade.ffprobe);
  if (ffprobe && !ffprobe.includes(art)) {
    if (art === 'arm64' && ffprobe.join() === 'x64') {
      hinweise.push('Ausnahme: ffprobe ist ein Intel-Programm (x86_64); ffprobe-static 3.1.0 liefert unter darwin/arm64 kein arm64-Programm. Auf Apple Silicon braucht der Medien-Import Rosetta 2.');
    } else {
      fehler.push(`ffprobe hat ${ffprobe.join('+')}, erwartet ${art}${art === 'arm64' ? ' oder die festgelegte Ausnahme x64' : ''}.`);
    }
  }

  if (ffmpeg && ffprobe) {
    gemessen.ffmpeg = sha256(pfade.ffmpeg);
    gemessen.ffprobe = sha256(pfade.ffprobe);
    hinweise.push(`SHA-256 ffmpeg ${gemessen.ffmpeg}, ffprobe ${gemessen.ffprobe}`);
    const e = lesestand?.[app]?.[version]?.[art];
    const werte = `Gemessen: ffmpeg ${gemessen.ffmpeg}, ffprobe ${gemessen.ffprobe}.`;
    if (e === undefined) {
      const vorschlag = JSON.stringify({ [app]: { [version]: { [art]: { ffmpeg: gemessen.ffmpeg, ffprobe: gemessen.ffprobe } } } });
      if (probe) warnungen.push(`Lesestand für ${app} ${version} ${art} ist leer. ${werte} Zum Nachtragen (mit Owner-OK): ${vorschlag}`);
      else fehler.push(`Lesestand für ${app} ${version} ${art} ist leer; ohne Lesestand wird nicht hochgeladen. ${werte}`);
    } else if (!e || typeof e !== 'object' || !HEX64.test(String(e.ffmpeg)) || !HEX64.test(String(e.ffprobe))) {
      fehler.push(`Lesestand für ${app} ${version} ${art} ist unvollständig oder ungültig (erwartet ffmpeg und ffprobe als SHA-256 in Kleinbuchstaben).`);
    } else {
      for (const name of ['ffmpeg', 'ffprobe']) {
        if (e[name] !== gemessen[name]) fehler.push(`SHA-256 von ${name} weicht vom Lesestand ab: gemessen ${gemessen[name]}, Lesestand ${e[name]}.`);
      }
    }
  }

  if (!macos) {
    // Fail closed: Nach F3 ist die Laufzeitprobe die Bedingung fürs Hochladen ohne Abnahme auf einem echten Mac.
    if (probe) hinweise.push('macOS-Teile (Laufzeitprobe, minos) übersprungen: nur unter macOS.');
    else fehler.push('Laufzeitprobe und minos fehlen (nur unter macOS); ohne sie wird nicht hochgeladen.');
    return ergebnis();
  }
  const starte = (name, pfad) => {
    const r = macos.starte(pfad, ['-version']);
    if (r.status === 0) {
      hinweise.push(`Laufzeitprobe ${name}: ${String(r.stdout).split(/\r?\n/)[0]}`);
      return;
    }
    const grund = r.error ? (r.error.code ?? String(r.error)) : `Rückgabe ${r.status}`;
    const zeile = String(r.stderr ?? '').split(/\r?\n/)[0];
    fehler.push(`Laufzeitprobe: ${name} -version endete mit ${grund}${zeile ? ` (${zeile})` : ''}.`);
  };
  if (ffmpeg?.includes(art)) starte('ffmpeg', pfade.ffmpeg);
  if (art === 'x64') {
    if (ffprobe?.includes('x64')) starte('ffprobe', pfade.ffprobe);
  } else {
    hinweise.push('Laufzeitprobe ffprobe nur im Intel-Job (x64).');
  }
  for (const [name, pfad, arten] of [['App-Programm', pfade.programm, programm], ['ffmpeg', pfade.ffmpeg, ffmpeg]]) {
    if (!arten?.includes(art)) continue;
    const minos = leseMinos(macos.otool(pfad, ARTEN[art].otool));
    if (minos === null) {
      warnungen.push(`minos von ${name} nicht lesbar (otool -l).`);
      continue;
    }
    hinweise.push(`minos ${name}: ${minos}`);
    if (ueberMacos11(minos)) warnungen.push(`minos von ${name} ist ${minos}, also über macOS 11 (Electron 33 läuft ab macOS 11).`);
  }
  return ergebnis();
}

/** Die echten macOS-Werkzeuge (nur unter darwin benutzt). */
const MACOS = {
  starte: (pfad, args) => spawnSync(pfad, args, { encoding: 'utf8', timeout: 60_000 }),
  otool: (pfad, arch) => {
    const r = spawnSync('otool', ['-arch', arch, '-l', pfad], { encoding: 'utf8', timeout: 60_000 });
    return r.status === 0 ? r.stdout : '';
  },
};

const AUFRUF = 'Aufruf: node scripts/ci/pruefe-mac-nachbau.mjs --app <app> --version <x.y.z> --art arm64|x64 --release <Ordner> --lesestand <json> [--probe]';

function hauptprogramm(argv) {
  let werte;
  try {
    ({ values: werte } = parseArgs({
      args: argv.slice(2),
      options: {
        app: { type: 'string' }, version: { type: 'string' }, art: { type: 'string' },
        release: { type: 'string' }, lesestand: { type: 'string' }, probe: { type: 'boolean', default: false },
      },
    }));
  } catch (e) {
    console.error(`pruefe-mac-nachbau: ${e.message}`);
    console.error(AUFRUF);
    return 2;
  }
  const { app, version, art, release, probe } = werte;
  if (!app || !version || !art || !release || !werte.lesestand) {
    console.error(AUFRUF);
    return 2;
  }
  if (!Object.hasOwn(APPS, app)) {
    console.error(`pruefe-mac-nachbau: App „${app}“ ist nicht freigegeben (bekannt: ${Object.keys(APPS).join(', ')}).`);
    return 2;
  }
  if (!Object.hasOwn(ARTEN, art)) {
    console.error(`pruefe-mac-nachbau: Art „${art}“ unbekannt (arm64 oder x64).`);
    return 2;
  }
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`pruefe-mac-nachbau: Version „${version}“ hat nicht die Form x.y.z.`);
    return 2;
  }
  let lesestand;
  try {
    lesestand = JSON.parse(readFileSync(resolve(werte.lesestand), 'utf8'));
  } catch (e) {
    console.error(`pruefe-mac-nachbau: Lesestand „${werte.lesestand}“ unlesbar: ${e.message}`);
    return 1;
  }
  const r = pruefeMacNachbau({ release: resolve(release), app, version, art, lesestand, probe },
    process.platform === 'darwin' ? MACOS : null);
  for (const h of r.hinweise) console.log(`pruefe-mac-nachbau: ${h}`);
  for (const w of r.warnungen) console.log(`::warning::pruefe-mac-nachbau: ${w}`);
  if (r.ok) {
    console.log(`pruefe-mac-nachbau: in Ordnung (${app} ${version} ${art}${probe ? ', Probe' : ''}).`);
    return 0;
  }
  for (const f of r.fehler) console.error(`pruefe-mac-nachbau: ${f}`);
  return 1;
}

/** Hauptprogramm? Beide Seiten über realpath, sonst endete ein Aufruf über einen Ordner-Link still mit Exit 0 (EP7). */
function istHauptprogramm(arg) {
  if (!arg) return false;
  try {
    return realpathSync(resolve(arg)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (istHauptprogramm(process.argv[1])) process.exitCode = hauptprogramm(process.argv);

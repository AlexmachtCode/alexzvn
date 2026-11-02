// Prüfung des fertigen Mac-Baus von JM Connect, ab 0.4.0 mit NDI (Spec Zoom-Slots 22.7, E45, E46, E54, E56; davor
// iveo-Paket, Spec 10.2; E39, EP7). Läuft im Workflow .github/workflows/connect-mac.yml. Der holt GENAU DIESE EINE Datei
// aus dem Commit des Workflows (git show "$WERKZEUG_SHA:…" nach werkzeug/), auch wenn der gebaute Tag sie noch nicht oder
// in alter Fassung kennt (connect-v0.3.0). Darum nur node:-Module und alles in dieser Datei: Versionsregel, Mach-O- und
// asar-Leser, Lesestände, Fassungsprüfung und das Muster der NDI-Zeile.
//
//   node apps/connect/tools/pruefe-mac-paket.mjs <release-Ordner> --ndi ja|nein [--probe]
//   node apps/connect/tools/pruefe-mac-paket.mjs --ndi-fuer <Version>
//   node apps/connect/tools/pruefe-mac-paket.mjs --ndi-sdk <Wurzel> --ndi-paket <Paket>
//
// Paket: genau zwei DMGs (arm64, x64) mit derselben Version, die ohne --probe zu --ndi passen muss (ndiErwartet); genau
// zwei „JM Connect.app“ unter mac*/, in keiner ein Ordner zoom-bridge, in jeder eine lesbare app.asar ohne .node-Datei
// unter node_modules/@jm/ndi/ (E56). Mit --ndi nein: keine jm_ndi.node. Mit --ndi ja je App: genau eine jm_ndi.node, und
// zwar in bin/mac/, dazu bin/mac/libndi.dylib und mindestens eine Lizenzdatei (.txt) in bin/mac/; beide Mach-O-Dateien
// enthalten die Architektur der App (Mach-O-Kopf von Contents/MacOS/JM Connect, nie der Ordnername); keine SDK-Reste;
// Contents/Resources/LIZENZ.txt (Lizenzbedingungen nach FR16, LP5) liegt bei und ist nicht leer (Owner-Frage OFC4).
// Exit 0: in Ordnung (eine Zeile; mit --ndi ja danach je App „App ‹Architektur›: ‹Pfad›“ für lipo, otool und die
// Ladeprobe im Workflow). Exit 1: jede Abweichung als eigene Zeile auf stderr. Exit 2: falscher Aufruf.
// --ndi-fuer druckt ja oder nein (E45). --ndi-sdk/--ndi-paket prüft das geladene NDI-SDK für Apple gegen den Mac-Lesestand
// (E54) und druckt die NDI-Zeile für die Notes (22.7 Nr. 2); Exit 0 nur, wenn alles dem Lesestand gleicht.
// Zoom-SDK-Dateien prüft schon der After-Pack-Wächter (tools/after-pack.cjs), der den Bau sonst abbricht.
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = 'JM Connect.app';

/** Alle Pfade unter `wurzel` mit dem letzten Teil `name` (Ordner bzw. Datei), ohne Verknüpfungen zu folgen. */
function finde(wurzel, name, art) {
  const treffer = [];
  const gehe = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isSymbolicLink()) continue;
      const p = join(d, e.name);
      if (e.name === name && (art === 'ordner' ? e.isDirectory() : e.isFile())) treffer.push(p);
      if (e.isDirectory()) gehe(p);
    }
  };
  gehe(wurzel);
  return treffer;
}

/** Kleinste Version, ab der das Mac-Paket NDI enthalten muss (Spec 22.7, E45). */
const NDI_AB = [0, 4, 0];

/**
 * Muss das Mac-Paket der Version `version` NDI enthalten? 'ja' ab 0.4.0, sonst 'nein' (E45). Vergleicht Zahl für Zahl,
 * nie als Zeichenkette (0.10.0 kommt nach 0.4.0). Wirft bei einer Version, die nicht ‹Zahl›.‹Zahl›.‹Zahl› ist.
 */
export function ndiErwartet(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  if (!m) throw new Error(`Version „${version}“ hat nicht die Form ‹Zahl›.‹Zahl›.‹Zahl›.`);
  const v = m.slice(1).map(Number);
  for (let i = 0; i < 3; i++) if (v[i] !== NDI_AB[i]) return v[i] > NDI_AB[i] ? 'ja' : 'nein';
  return 'ja';
}

/** CPU-Typen aus <mach/machine.h>, benannt wie lipo -archs. */
const CPU_NAMEN = new Map([[0x0100000c, 'arm64'], [0x01000007, 'x86_64'], [12, 'arm'], [7, 'i386']]);

/**
 * Architekturen einer Mach-O-Datei aus ihrem Kopf (E46): dünn (MH_MAGIC_64 bzw. MH_MAGIC, beide Byte-Reihenfolgen) eine,
 * universell (FAT_MAGIC bzw. FAT_MAGIC_64, big-endian) eine je Eintrag, in der Reihenfolge der Datei. Leer, wenn `puffer`
 * kein Mach-O-Kopf ist; ein universeller Kopf mit mehr als 20 Einträgen gilt nicht (wie file(1): eine Java-Klasse beginnt
 * ebenfalls mit 0xCAFEBABE, an dieser Stelle steht dort ihre Fassung ab 45).
 */
export function machOArchitekturen(puffer) {
  const b = Buffer.isBuffer(puffer) ? puffer : Buffer.from(puffer);
  if (b.length < 8) return [];
  const name = (t) => CPU_NAMEN.get(t) ?? `cpu-0x${t.toString(16)}`;
  const be = b.readUInt32BE(0);
  if (be === 0xcafebabe || be === 0xcafebabf) {
    const n = b.readUInt32BE(4);
    const groesse = be === 0xcafebabe ? 20 : 32;
    if (n < 1 || n > 20 || b.length < 8 + n * groesse) return [];
    const out = [];
    for (let i = 0; i < n; i++) out.push(name(b.readUInt32BE(8 + i * groesse)));
    return out;
  }
  const le = b.readUInt32LE(0);
  if (le === 0xfeedfacf || le === 0xfeedface) return [name(b.readUInt32LE(4))];
  if (be === 0xfeedfacf || be === 0xfeedface) return [name(b.readUInt32BE(4))];
  return [];
}

/** Die ersten 4096 Byte einer Datei (genug für jeden Mach-O-Kopf mit bis zu 20 Einträgen). */
function kopfVon(pfad) {
  const fd = openSync(pfad, 'r');
  try {
    const b = Buffer.alloc(4096);
    return b.subarray(0, readSync(fd, b, 0, 4096, 0));
  } finally {
    closeSync(fd);
  }
}

const istDatei = (p) => existsSync(p) && statSync(p).isFile();

/**
 * Jede .node-Datei unter node_modules/@jm/ndi/ in einer .asar (E56; dieselbe Regel wie Wächter 2, tools/after-pack.cjs).
 * Liest nur den 16-Byte-Kopf (Länge des Inhaltsverzeichnisses als UInt32LE bei Byte 12) und das JSON ab Byte 16, wie
 * asarEintraege in packages/zoom-bridge/scripts/auslieferung.mjs; hier nachgebaut, weil der Workflow nur diese Datei holt.
 * Wirft bei einem Kopf unter 16 Byte und bei einem abgeschnittenen oder unlesbaren Inhaltsverzeichnis.
 */
export function asarNdiNodeEintraege(asarPfad) {
  const fd = openSync(asarPfad, 'r');
  try {
    const kopf = Buffer.alloc(16);
    if (readSync(fd, kopf, 0, 16, 0) < 16) throw new Error(`${asarPfad} ist keine .asar (Kopf kürzer als 16 Byte).`);
    const laenge = kopf.readUInt32LE(12);
    if (16 + laenge > fstatSync(fd).size) throw new Error(`${asarPfad} ist keine .asar (Inhaltsverzeichnis abgeschnitten).`);
    const json = Buffer.alloc(laenge);
    readSync(fd, json, 0, laenge, 16);
    const baum = JSON.parse(json.toString('utf8'));
    const out = [];
    const gehe = (knoten, vorne) => {
      for (const [name, kind] of Object.entries(knoten ?? {})) {
        const pfad = vorne ? `${vorne}/${name}` : name;
        if (kind && typeof kind === 'object' && kind.files && typeof kind.files === 'object') gehe(kind.files, pfad);
        else if (/\.node$/i.test(name) && `/${pfad}`.includes('/node_modules/@jm/ndi/')) out.push(pfad);
      }
    };
    gehe(baum.files, '');
    return out;
  } finally {
    closeSync(fd);
  }
}

/** SDK-Reste unter `wurzel` (22.7): Dateien *.h, *.pdf, *.pkg und Ordner „NDI SDK for Apple“, ohne Verknüpfungen zu folgen. */
function sdkReste(wurzel) {
  const treffer = [];
  const gehe = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isSymbolicLink()) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === 'NDI SDK for Apple') treffer.push(p);
        gehe(p);
      } else if (/\.(h|pdf|pkg)$/i.test(e.name)) treffer.push(p);
    }
  };
  gehe(wurzel);
  return treffer;
}

/** Version im DMG-Namen: die erste Gruppe -‹Zahl›.‹Zahl›.‹Zahl›- (artifactName, apps/connect/electron-builder.yml:3). */
const DMG_VERSION = /-(\d+\.\d+\.\d+)-/;

/**
 * Prüft einen release-Ordner von electron-builder (Spec 22.7; davor iveo-Spec 10.2). `ndi` ist Pflicht ('ja' oder
 * 'nein'); ohne `probe` muss es zur Version aus den DMG-Namen passen. Ergebnis: ok, jede Abweichung als Zeile, die
 * Version der DMGs (null, wenn unlesbar) und je App der Pfad samt Architektur (nur mit ndi 'ja', aus dem Mach-O-Kopf).
 */
export function pruefeMacPaket(releaseOrdner, { ndi, probe = false } = {}) {
  if (ndi !== 'ja' && ndi !== 'nein') throw new TypeError(`pruefeMacPaket: ndi muss 'ja' oder 'nein' sein, nicht ${JSON.stringify(ndi)}.`);
  if (!existsSync(releaseOrdner) || !statSync(releaseOrdner).isDirectory()) {
    return { ok: false, fehler: [`Ordner „${releaseOrdner}“ fehlt.`], version: null, apps: [] };
  }
  const fehler = [];
  const eintraege = readdirSync(releaseOrdner, { withFileTypes: true });
  const dmgs = eintraege.filter((e) => e.isFile() && e.name.endsWith('.dmg')).map((e) => e.name).sort();
  if (dmgs.length !== 2) fehler.push(`genau zwei DMGs erwartet, gefunden ${dmgs.length}${dmgs.length ? `: ${dmgs.join(', ')}` : ''}.`);
  for (const arch of ['arm64', 'x64']) {
    const n = dmgs.filter((name) => name.includes(arch)).length;
    if (n !== 1) fehler.push(`genau ein DMG mit „${arch}“ im Namen erwartet, gefunden ${n}.`);
  }
  // Version nur bei genau zwei DMGs: stimmt schon die Zahl nicht, kommt kein weiterer Fehler zur Version dazu (22.7).
  let version = null;
  if (dmgs.length === 2) {
    const vs = dmgs.map((name) => DMG_VERSION.exec(name)?.[1] ?? null);
    if (vs.includes(null)) {
      dmgs.forEach((name, i) => { if (vs[i] === null) fehler.push(`DMG ohne Version im Namen (-‹Zahl›.‹Zahl›.‹Zahl›-): ${name}`); });
    } else if (vs[0] !== vs[1]) {
      fehler.push(`die DMGs nennen verschiedene Versionen: ${vs[0]} und ${vs[1]}.`);
    } else {
      version = vs[0];
      const soll = ndiErwartet(version);
      if (!probe && soll !== ndi) fehler.push(`--ndi ${ndi} passt nicht zur Version ${version}: erwartet --ndi ${soll} (nur ein Probelauf mit --probe darf abweichen).`);
    }
  }
  const apps = eintraege
    .filter((e) => e.isDirectory() && e.name.startsWith('mac'))
    .map((e) => join(releaseOrdner, e.name, APP))
    .filter((p) => existsSync(join(p, 'Contents', 'Resources')) && statSync(join(p, 'Contents', 'Resources')).isDirectory());
  if (apps.length !== 2) fehler.push(`genau zwei „${APP}“ unter mac*/ erwartet, gefunden ${apps.length}.`);
  const ergebnis = [];
  for (const app of apps) {
    const res = join(app, 'Contents', 'Resources');
    for (const p of finde(res, 'zoom-bridge', 'ordner')) fehler.push(`Ordner zoom-bridge im Mac-Paket: ${p}`);
    // Mit --ndi nein wie mit --ndi ja: Fehlt die app.asar oder ist ihr Kopf unlesbar, fiele die Prüfung sonst still weg.
    const asar = join(res, 'app.asar');
    if (!existsSync(asar)) fehler.push(`app.asar fehlt: ${asar}`);
    else {
      try {
        for (const e of asarNdiNodeEintraege(asar)) fehler.push(`NDI-Kopie in der app.asar (E56): ${asar}:${e}`);
      } catch (err) {
        fehler.push(`app.asar unlesbar: ${asar} (${err.message})`);
      }
    }
    const addons = finde(res, 'jm_ndi.node', 'datei');
    if (ndi === 'nein') {
      for (const p of addons) fehler.push(`NDI-Addon im Mac-Paket (--ndi nein): ${p}`);
      ergebnis.push({ app, arch: null });
      continue;
    }
    // --ndi ja: Architektur aus dem Mach-O-Kopf der App, nie aus dem Ordnernamen (mac*/ ist ungemessen, iveo-EP7).
    const haupt = join(app, 'Contents', 'MacOS', 'JM Connect');
    const archs = istDatei(haupt) ? machOArchitekturen(kopfVon(haupt)) : [];
    const arch = archs.length === 1 ? archs[0] : null;
    if (!arch) fehler.push(`Architektur der App nicht eindeutig (${archs.length ? archs.join(', ') : 'kein Mach-O-Kopf'}): ${haupt}`);
    const bin = join(res, 'bin', 'mac');
    if (addons.length !== 1) fehler.push(`genau eine jm_ndi.node erwartet, gefunden ${addons.length}: ${app}`);
    for (const p of addons) if (resolve(p) !== resolve(join(bin, 'jm_ndi.node'))) fehler.push(`jm_ndi.node außerhalb von bin/mac: ${p}`);
    const lib = join(bin, 'libndi.dylib');
    if (!istDatei(lib)) fehler.push(`libndi.dylib fehlt: ${lib}`);
    const lizenzen = existsSync(bin) && statSync(bin).isDirectory()
      ? readdirSync(bin, { withFileTypes: true }).filter((e) => e.isFile() && /\.txt$/i.test(e.name)) : [];
    if (!lizenzen.length) fehler.push(`keine Lizenzdatei der NDI-Laufzeit (.txt) in ${bin}`);
    // Lizenzbedingungen nach FR16 (LP5) in jedem Paket mit NDI, über 22.8 hinaus (Owner-Frage OFC4, C4E15).
    const bedingungen = join(res, 'LIZENZ.txt');
    if (!istDatei(bedingungen) || statSync(bedingungen).size === 0) fehler.push(`Lizenzbedingungen fehlen oder sind leer (LIZENZ.txt, LP5): ${bedingungen}`);
    if (arch) {
      for (const d of [join(bin, 'jm_ndi.node'), lib]) {
        if (!istDatei(d)) continue;
        const a = machOArchitekturen(kopfVon(d));
        if (!a.includes(arch)) fehler.push(`${basename(d)} ohne ${arch} (enthält ${a.length ? a.join(', ') : 'keinen Mach-O-Kopf'}), App ${arch}: ${d}`);
      }
    }
    for (const p of sdkReste(res)) fehler.push(`SDK-Rest im Mac-Paket: ${p}`);
    ergebnis.push({ app, arch });
  }
  if (ndi === 'ja' && ergebnis.length === 2 && ergebnis.every((x) => x.arch)) {
    const archs = ergebnis.map((x) => x.arch).sort();
    if (archs.join(' ') !== 'arm64 x86_64') fehler.push(`je eine App arm64 und x86_64 erwartet, gefunden ${archs.join(' und ')}.`);
  }
  return { ok: fehler.length === 0, fehler, version, apps: ergebnis };
}

/**
 * Lesestand (E54): die zuletzt gelesene SDK-Fassung je Plattform, ihr Kennzeichen (Windows: Dateiversion der DLL; Mac:
 * SHA-256 des Pakets) und die SHA-256 von Lizenz (NDI SDK License Agreement.pdf) und Doku (NDI SDK Documentation.pdf,
 * „fehlt“, wenn es sie nicht gibt). Nachziehen nur mit Owner-OK, nachdem er Lizenz und Doku gelesen hat.
 * Windows: gelesen am 18.10.2026 an C:\Program Files\NDI\NDI 6 SDK (SDK 6.3.2; LQ21, LQ22), nachgemessen am 19.10.2026.
 */
export const NDI_LESESTAND_WINDOWS = Object.freeze({
  kennzeichen: '6.3.2.0',
  lizenz: '11ae13ae038d5af06d2fd5f9e55cbbdb97e75d2526656a0dbaa4dafcb7bf48e6',
  doku: 'e9d3a84ece970f3181b23cdef6433cb205e940d28abe61d4d9d1e7477a81cc6b',
});
/** Mac: noch nicht gelesen. Der erste Probelauf endet darum an der Fassungsprüfung (22.15); der Owner gibt die Werte frei. */
export const NDI_LESESTAND_MAC = null;

/**
 * Fassungsprüfung (E54): Gleicht die gemessene Fassung dem Lesestand? `gemessen` = { kennzeichen, lizenz (SHA-256 oder
 * null, wenn die Lizenz fehlt), doku (SHA-256 oder 'fehlt'), datum? (der Lizenz) }. Bricht ab bei fehlender Lizenz, leerem
 * Lesestand, neuem Kennzeichen (neue Fassung, auch mit gleichem Lizenztext), abweichender Lizenz oder Doku. Die Meldung
 * nennt die gemessenen Werte, was abweicht und ob Lizenz und Doku den unter Windows gelesenen gleichen.
 */
export function pruefeNdiLesestand(gemessen, lesestand) {
  const win = NDI_LESESTAND_WINDOWS;
  const werte = `Kennzeichen ${gemessen.kennzeichen}, Lizenz ${gemessen.lizenz ?? 'fehlt'}${gemessen.datum ? ` vom ${gemessen.datum}` : ''}, Doku ${gemessen.doku}`;
  const windows = `Lizenz ${gemessen.lizenz === win.lizenz ? 'gleich' : 'nicht gleich'} der unter Windows gelesenen, Doku ${gemessen.doku === win.doku ? 'gleich' : 'nicht gleich'} der unter Windows gelesenen`;
  const abbruch = (was) => ({
    weiter: false,
    meldung: `Fassungsprüfung: Abbruch, ${was}. Gemessen: ${werte}. ${windows}. Lizenz und Doku (Abschnitt 3 und 4) lesen und den Lesestand erst mit Owner-OK nachziehen (Spec 22.7, E54).`,
  });
  if (!gemessen.lizenz) return abbruch('Lizenz fehlt');
  if (!lesestand) return abbruch('Lesestand leer');
  const ab = [];
  if (gemessen.kennzeichen !== lesestand.kennzeichen) ab.push(`neue Fassung (Kennzeichen ${gemessen.kennzeichen}, gelesen ${lesestand.kennzeichen})`);
  if (gemessen.lizenz !== lesestand.lizenz) ab.push(`Lizenz weicht ab (gelesen ${lesestand.lizenz})`);
  if (gemessen.doku !== lesestand.doku) ab.push(`Doku weicht ab (gelesen ${lesestand.doku})`);
  if (ab.length) return abbruch(ab.join('; '));
  return { weiter: true, meldung: `Fassungsprüfung: weiter, alles gleich dem Lesestand. Gemessen: ${werte}. ${windows}.` };
}

/**
 * Muster der NDI-Zeile für die Notes (22.7 Nr. 2), über die ganze Zeichenkette. Nur Mittel, die JavaScript (RegExp) und
 * bash ([[ … =~ … ]], POSIX ERE) gleich lesen. Der Job hochladen in connect-mac.yml führt es Zeichen für Zeichen gleich
 * als feste Zeichenkette im env (Workflow-Prüfung im Plan C, Task C17).
 */
export const NDI_ZEILE_MUSTER = String.raw`^Enthaltene NDI-Laufzeit unter macOS: ([0-9]+(\.[0-9]+)+|unbekannt) \(SHA-256: Paket [0-9a-f]{64}, Laufzeit [0-9a-f]{64}, Lizenz [0-9a-f]{64} vom [0-9]{2}\.[0-9]{2}\.[0-9]{4}, Doku ([0-9a-f]{64}|fehlt)\)$`;

/** Die NDI-Zeile aus den gemessenen Werten (22.7 Nr. 2): { fassung, paket, laufzeit, lizenz, datum, doku }. */
export function macNdiZeile(werte) {
  return `Enthaltene NDI-Laufzeit unter macOS: ${werte.fassung} (SHA-256: Paket ${werte.paket}, Laufzeit ${werte.laufzeit}, Lizenz ${werte.lizenz} vom ${werte.datum}, Doku ${werte.doku})`;
}

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const zwei = (n) => String(n).padStart(2, '0');

/** Dateiliste der Wurzel bis zur zweiten Ebene, nur Namen und Größen, ohne Verknüpfungen zu folgen. */
function dateiliste(wurzel) {
  const out = [];
  const gehe = (d, vorne, ebene) => {
    let es;
    try {
      es = readdirSync(d, { withFileTypes: true });
    } catch (err) {
      out.push(`${vorne || '.'}: unlesbar (${err.code ?? err.message})`);
      return;
    }
    es.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of es) {
      const rel = vorne ? `${vorne}/${e.name}` : e.name;
      const p = join(d, e.name);
      if (e.isSymbolicLink()) out.push(`${rel} (Verknüpfung)`);
      else if (e.isDirectory()) {
        out.push(`${rel}/`);
        if (ebene < 2) gehe(p, rel, ebene + 1);
      } else out.push(`${rel} (${statSync(p).size} Byte)`);
    }
  };
  gehe(wurzel, '', 1);
  return out;
}

/**
 * Fassungsprüfung des geladenen NDI-SDK für Apple (22.7 Nr. 2, E54): misst SHA-256 von Paket, Laufzeit
 * (lib/macOS/libndi.dylib), Lizenz (NDI SDK License Agreement.pdf an der Wurzel) und Doku (Documentation/NDI SDK
 * Documentation.pdf, sonst „fehlt“), die Fassung aus Version.txt (erste Zahlengruppe, sonst „unbekannt“) und das Datum der
 * Lizenz (Änderungsdatum, UTC). Baut die NDI-Zeile VOR dem Vergleich mit dem Lesestand und prüft sie gegen
 * NDI_ZEILE_MUSTER; Orte im Apple-SDK sind Annahme AN37. Ergebnis: ok, alle Zeilen fürs Protokoll, die NDI-Zeile.
 */
export function pruefeNdiSdk(wurzel, paket, lesestand = NDI_LESESTAND_MAC) {
  const zeilen = [`Fassungsprüfung NDI-SDK für Apple: Wurzel ${wurzel}, Paket ${paket}`, 'Dateiliste der Wurzel (zwei Ebenen, Namen und Größen):'];
  for (const z of dateiliste(wurzel)) zeilen.push(`  ${z}`);
  const laufzeitPfad = join(wurzel, 'lib', 'macOS', 'libndi.dylib');
  const lizenzPfad = join(wurzel, 'NDI SDK License Agreement.pdf');
  const dokuPfad = join(wurzel, 'Documentation', 'NDI SDK Documentation.pdf');
  const fehlt = [];
  if (!istDatei(paket)) fehlt.push(`Paket fehlt: ${paket}`);
  if (!istDatei(laufzeitPfad)) fehlt.push('Laufzeit fehlt: lib/macOS/libndi.dylib');
  if (fehlt.length) {
    for (const f of fehlt) zeilen.push(`Fassungsprüfung: Abbruch, ${f}.`);
    return { ok: false, zeilen, ndiZeile: null };
  }
  const versionTxt = join(wurzel, 'Version.txt');
  const fassung = istDatei(versionTxt) ? (/[0-9]+(?:\.[0-9]+)+/.exec(readFileSync(versionTxt, 'utf8'))?.[0] ?? 'unbekannt') : 'unbekannt';
  const werte = { fassung, paket: sha256(paket), laufzeit: sha256(laufzeitPfad), lizenz: null, datum: null, doku: istDatei(dokuPfad) ? sha256(dokuPfad) : 'fehlt' };
  if (istDatei(lizenzPfad)) {
    const m = statSync(lizenzPfad).mtime;
    werte.lizenz = sha256(lizenzPfad);
    werte.datum = `${zwei(m.getUTCDate())}.${zwei(m.getUTCMonth() + 1)}.${m.getUTCFullYear()}`;
  }
  zeilen.push(`Fassung ${fassung} (${istDatei(versionTxt) ? 'aus Version.txt' : 'Version.txt fehlt'})`);
  zeilen.push(`SHA-256 Paket ${werte.paket}`, `SHA-256 Laufzeit ${werte.laufzeit}`);
  zeilen.push(`SHA-256 Lizenz ${werte.lizenz ?? 'fehlt'}${werte.datum ? ` vom ${werte.datum}` : ''}`, `SHA-256 Doku ${werte.doku}`);
  let ndiZeile = null;
  if (werte.lizenz) {
    ndiZeile = macNdiZeile(werte);
    zeilen.push(ndiZeile);
    if (!new RegExp(NDI_ZEILE_MUSTER).test(ndiZeile)) {
      zeilen.push('Fassungsprüfung: Abbruch, die NDI-Zeile passt nicht zu NDI_ZEILE_MUSTER.');
      return { ok: false, zeilen, ndiZeile: null };
    }
  }
  const r = pruefeNdiLesestand({ kennzeichen: werte.paket, lizenz: werte.lizenz, doku: werte.doku, datum: werte.datum }, lesestand);
  zeilen.push(r.meldung);
  return { ok: r.weiter, zeilen, ndiZeile: r.weiter ? ndiZeile : null };
}

const AUFRUF = [
  'Aufruf: node apps/connect/tools/pruefe-mac-paket.mjs <release-Ordner> --ndi ja|nein [--probe]',
  '       node apps/connect/tools/pruefe-mac-paket.mjs --ndi-fuer <Version>',
  '       node apps/connect/tools/pruefe-mac-paket.mjs --ndi-sdk <Wurzel> --ndi-paket <Paket>',
].join('\n');

/** Argumente der Kommandozeile; `fehler` beim ersten Aufruffehler. */
function leseArgumente(args) {
  const o = { ordner: [], ndi: undefined, probe: false, ndiFuer: undefined, ndiSdk: undefined, ndiPaket: undefined, fehler: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const wert = () => {
      if (i + 1 >= args.length) o.fehler ??= `${a} ohne Wert`;
      return args[++i];
    };
    if (a === '--ndi') o.ndi = wert();
    else if (a === '--probe') o.probe = true;
    else if (a === '--ndi-fuer') o.ndiFuer = wert();
    else if (a === '--ndi-sdk') o.ndiSdk = wert();
    else if (a === '--ndi-paket') o.ndiPaket = wert();
    else if (a.startsWith('--')) o.fehler ??= `unbekannte Angabe ${a}`;
    else o.ordner.push(a);
  }
  return o;
}

function hauptprogramm(argv) {
  const o = leseArgumente(argv.slice(2));
  const aufruf = (grund) => {
    console.error(`pruefe-mac-paket: ${grund}`);
    console.error(AUFRUF);
    return 2;
  };
  if (o.fehler) return aufruf(o.fehler);
  const sonst = o.ordner.length > 0 || o.ndi !== undefined || o.probe;
  if (o.ndiFuer !== undefined) {
    if (sonst || o.ndiSdk !== undefined || o.ndiPaket !== undefined) return aufruf('--ndi-fuer steht allein.');
    try {
      console.log(ndiErwartet(o.ndiFuer));
      return 0;
    } catch (err) {
      return aufruf(err.message);
    }
  }
  if (o.ndiSdk !== undefined || o.ndiPaket !== undefined) {
    if (o.ndiSdk === undefined || o.ndiPaket === undefined || sonst) return aufruf('--ndi-sdk und --ndi-paket gehören zusammen und stehen allein.');
    const r = pruefeNdiSdk(resolve(o.ndiSdk), resolve(o.ndiPaket));
    for (const z of r.zeilen) console.log(z);
    return r.ok ? 0 : 1;
  }
  if (o.ordner.length !== 1) return aufruf(o.ordner.length ? 'mehr als ein Ordner.' : 'Ordner fehlt.');
  if (o.ndi !== 'ja' && o.ndi !== 'nein') {
    return aufruf(o.ndi === undefined ? '--ndi fehlt (ja oder nein, Spec 22.7).' : `--ndi ${o.ndi}: erlaubt sind ja und nein.`);
  }
  const r = pruefeMacPaket(resolve(o.ordner[0]), { ndi: o.ndi, probe: o.probe });
  if (!r.ok) {
    for (const f of r.fehler) console.error(`pruefe-mac-paket: ${f}`);
    return 1;
  }
  const lauf = `zwei DMGs arm64 und x64, Version ${r.version}${o.probe ? ', Probelauf' : ''}`;
  if (o.ndi === 'nein') {
    console.log(`pruefe-mac-paket: in Ordnung (${lauf}; zwei JM Connect.app ohne zoom-bridge und ohne jm_ndi.node, app.asar ohne NDI-Kopie).`);
    return 0;
  }
  console.log(`pruefe-mac-paket: in Ordnung (${lauf}; zwei JM Connect.app mit NDI (arm64 und x86_64) und Lizenzdatei, ohne zoom-bridge, app.asar ohne NDI-Kopie, Lizenzbedingungen LIZENZ.txt beigelegt).`);
  for (const { app, arch } of [...r.apps].sort((a, b) => (a.arch < b.arch ? -1 : 1))) console.log(`pruefe-mac-paket: App ${arch}: ${app}`);
  return 0;
}

/**
 * Läuft diese Datei als Hauptprogramm? Node löst das Hauptmodul über realpath auf, setzt argv[1] aber nur mit resolve: Unter
 * einem symbolischen Link oder einer Junction wären beide verschieden, und die Prüfung endete still mit Exit 0 (gegen den
 * sicheren Fehlschlag aus EP7). Darum beide Seiten über realpath vergleichen.
 */
function istHauptprogramm(arg) {
  if (!arg) return false;
  try {
    return realpathSync(resolve(arg)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (istHauptprogramm(process.argv[1])) process.exitCode = hauptprogramm(process.argv);

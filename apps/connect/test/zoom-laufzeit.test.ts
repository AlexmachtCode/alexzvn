// Laufzeit-Ordner der Zoom-Bridge OHNE Electron und OHNE echtes SDK (tsx): npm run selftest -w @jm/connect
// Spec 12.3: Temp-Ordner mit erzeugten PE-Dateien. Kopierfehler, Platz und Uhr sind eingespeist.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { KT } from '../src/main/zoom/klartext';
import {
  BRIDGE_EXE, EIGENE_NAMEN_FEST, eigeneQuellen, kindPfad, laufzeitOrdner, NDI_DLL, pfadVarianten, PLATZ_RESERVE_BYTES,
  pruefeLaufzeit, pruefeSdkOrdner, richteEin, STEMPEL_DATEI, type KopieStand, type LaufzeitPfade, type SdkWahl, type Stempel,
} from '../src/main/zoom/laufzeit';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}

// ── Testhilfen ──
const TEMP = mkdtempSync(join(tmpdir(), 'jmc-laufzeit-'));
let nr = 0;
/** Frischer Unterordner im Temp-Ordner. */
function ordner(name: string): string {
  const d = join(TEMP, `${++nr}-${name}`);
  mkdirSync(d, { recursive: true });
  return d;
}

const X64 = 0x8664;
const X86 = 0x014c;
const F_OK: [number, number, number, number] = [7, 1, 5, 43953];

/** PE-Puffer (eigene Kopie der Hilfe aus Aufgabe 1): 0x200 Bytes, MZ, e_lfanew 0x80, PE\0\0, Maschinentyp, VS_FIXEDFILEINFO bei 0x100. */
function machePe(maschine: number, fassung: [number, number, number, number] | null): Buffer {
  const b = Buffer.alloc(0x200);
  b.write('MZ', 0, 'latin1');
  b.writeUInt32LE(0x80, 0x3c);
  b.write('PE\0\0', 0x80, 'latin1');
  b.writeUInt16LE(maschine, 0x84);
  if (fassung) {
    b.set([0xbd, 0x04, 0xef, 0xfe], 0x100);
    b.writeUInt32LE(((fassung[0] << 16) | fassung[1]) >>> 0, 0x108);
    b.writeUInt32LE(((fassung[2] << 16) | fassung[3]) >>> 0, 0x10c);
  }
  return b;
}

/** Sieben Dateien neben sdk.dll, zwei davon in Unterordnern wie im echten SDK. */
const SDK_DATEIEN = ['CptHost.exe', 'zVideoApp.dll', 'zAudio.dll', 'turbojpeg.dll', 'zmb.dll', 'language/de.txt', 'ringtone/r.pcm'];

/** SDK-Wurzel mit version.txt und x64/bin (sdk.dll + 7 Dateien + `extra`). Liefert die Wurzel. */
function baueSdk(wurzel: string, o: { maschine?: number; fassung?: [number, number, number, number] | null; extra?: string[] } = {}): string {
  const bin = join(wurzel, 'x64', 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(wurzel, 'version.txt'), 'v7.1.5.43953');
  writeFileSync(join(bin, 'sdk.dll'), machePe(o.maschine ?? X64, o.fassung === undefined ? F_OK : o.fassung));
  for (const [i, p] of [...SDK_DATEIEN, ...(o.extra ?? [])].entries()) {
    const f = join(bin, ...p.split('/'));
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, Buffer.alloc(100 + i * 10, 0x41 + i));
  }
  return wurzel;
}

/** Ressourcen wie im Paket: zoom-bridge/zoom-bridge.exe, zoom-bridge/vcruntime140.dll, bin/win/<NDI-DLL>. */
function baueRessourcen(dir: string): string {
  mkdirSync(join(dir, 'zoom-bridge'), { recursive: true });
  mkdirSync(join(dir, 'bin', 'win'), { recursive: true });
  writeFileSync(join(dir, 'zoom-bridge', BRIDGE_EXE), 'bridge-1');
  writeFileSync(join(dir, 'zoom-bridge', 'vcruntime140.dll'), 'vc');
  writeFileSync(join(dir, 'bin', 'win', NDI_DLL), 'ndi');
  return dir;
}

function sha(datei: string): string {
  return createHash('sha256').update(readFileSync(datei)).digest('hex');
}

function wahlVon(w: SdkWahl): Extract<SdkWahl, { ok: true }> {
  if (!w.ok) throw new Error(`Wahl gescheitert: ${w.text}`);
  return w;
}

const ruhig = (): void => {};

/** Ausgangslage: ein fertig eingerichteter Laufzeit-Ordner. */
async function eingerichtet(name: string): Promise<{ pfade: LaufzeitPfade; ziel: string; dir: string }> {
  const dir = ordner(name);
  const pfade: LaufzeitPfade = { basis: join(dir, 'zoom-laufzeit'), ressourcen: baueRessourcen(join(dir, 'res')) };
  const r = await richteEin({ wahl: wahlVon(pruefeSdkOrdner(baueSdk(join(dir, 'sdk')), pfade.ressourcen)), pfade, fortschritt: ruhig });
  if (!r.ok) throw new Error(`Ausgangslage: ${r.text}`);
  return { pfade, ziel: laufzeitOrdner(pfade), dir };
}

/** Zweites SDK neben der Ausgangslage, mit einer zusätzlichen Datei neu.dll (9 Dateien). */
function zweitesSdk(dir: string, pfade: LaufzeitPfade): Extract<SdkWahl, { ok: true }> {
  return wahlVon(pruefeSdkOrdner(baueSdk(join(dir, 'sdk2'), { extra: ['neu.dll'] }), pfade.ressourcen));
}

console.log('— 12.3 Nr. 1 und 7: Ordnerwahl, eigene Dateien');
{
  const d = ordner('wahl');
  const res = baueRessourcen(join(d, 'res'));
  const w = baueSdk(join(d, 'sdk'));
  const bin = join(w, 'x64', 'bin');
  for (const [name, gewaehlt] of [['Wurzel', w], ['x64', join(w, 'x64')], ['x64/bin', bin]]) {
    const r = pruefeSdkOrdner(gewaehlt, res);
    ck(`${name} erkannt, bin = x64/bin, Fassung 7.1.5.43953`, r.ok && r.bin === bin && r.fassung === '7.1.5.43953');
  }
  const r = wahlVon(pruefeSdkOrdner(w, res));
  ck('8 Dateien, Pfade mit „/“, Unterordner mitgezählt',
    r.dateien.length === 8 && r.dateien.some((x) => x.pfad === 'language/de.txt') && r.dateien.some((x) => x.pfad === 'ringtone/r.pcm'));
  ck('bytesGesamt = Summe der Dateigrößen', r.bytesGesamt > 0 && r.bytesGesamt === r.dateien.reduce((s, x) => s + x.bytes, 0));
  ck('version.txt (außerhalb von x64/bin) gehört nicht dazu', !r.dateien.some((x) => x.pfad.includes('version')));

  ck('leerer Ordner → S1', JSON.stringify(pruefeSdkOrdner(ordner('leer'), res)) === JSON.stringify({ ok: false, text: KT.S1 }));
  ck('x86 → S2', JSON.stringify(pruefeSdkOrdner(baueSdk(ordner('x86'), { maschine: X86 }), res)) === JSON.stringify({ ok: false, text: KT.S2 }));
  ck('Fassung 7.1.6.1 → S3', JSON.stringify(pruefeSdkOrdner(baueSdk(ordner('716'), { fassung: [7, 1, 6, 1] }), res)) === JSON.stringify({ ok: false, text: KT.S3('7.1.6.1') }));
  ck('ohne Versionsangabe → S3b', JSON.stringify(pruefeSdkOrdner(baueSdk(ordner('ohne'), { fassung: null }), res)) === JSON.stringify({ ok: false, text: KT.S3b }));
  const kaputt = baueSdk(ordner('kaputt'));
  writeFileSync(join(kaputt, 'x64', 'bin', 'sdk.dll'), 'keine PE-Datei');
  ck('sdk.dll ist keine PE-Datei → S3b', JSON.stringify(pruefeSdkOrdner(kaputt, res)) === JSON.stringify({ ok: false, text: KT.S3b }));

  // Nr. 7: eigener Dateiname im SDK → S4 (nur Dateiname, ohne Groß-/Kleinschreibung, auch in Unterordnern)
  ck('VCRuntime140.dll im SDK → S4', JSON.stringify(pruefeSdkOrdner(baueSdk(ordner('vc'), { extra: ['VCRuntime140.dll'] }), res)) === JSON.stringify({ ok: false, text: KT.S4('VCRuntime140.dll') }));
  ck('zoom-bridge.exe in einem Unterordner des SDK → S4', JSON.stringify(pruefeSdkOrdner(baueSdk(ordner('br'), { extra: ['tief/zoom-bridge.exe'] }), res)) === JSON.stringify({ ok: false, text: KT.S4('zoom-bridge.exe') }));
  ck('EIGENE_NAMEN_FEST: die sechs festen Namen', EIGENE_NAMEN_FEST.length === 6 && EIGENE_NAMEN_FEST.includes('vcruntime140_1.dll') && EIGENE_NAMEN_FEST.includes('msvcp140_codecvt_ids.dll'));

  const q = eigeneQuellen(res);
  ck('eigeneQuellen: Bridge-Ordner flach + NDI-DLL, sortiert', JSON.stringify(q.map((x) => x.pfad)) === JSON.stringify([NDI_DLL, 'vcruntime140.dll', BRIDGE_EXE]));
  ck('eigeneQuellen: quelle zeigt auf die Ressource', q[0].quelle === join(res, 'bin', 'win', NDI_DLL) && q.every((x) => existsSync(x.quelle)));
  ck('eigeneQuellen ohne Ressourcen → leer', eigeneQuellen(join(d, 'gibt-es-nicht')).length === 0);
  ck('laufzeitOrdner = basis/7.1.5.43953', laufzeitOrdner({ basis: 'B', ressourcen: 'R' }) === join('B', '7.1.5.43953'));

  // Ein Name, den nur die Ressourcen kennen (nicht in EIGENE_NAMEN_FEST), zählt ebenfalls.
  writeFileSync(join(res, 'zoom-bridge', 'msvcp140_atomic_wait.dll'), 'x');
  ck('Name aus den Ressourcen im SDK → S4', JSON.stringify(pruefeSdkOrdner(baueSdk(ordner('res-name'), { extra: ['msvcp140_atomic_wait.dll'] }), res)) === JSON.stringify({ ok: false, text: KT.S4('msvcp140_atomic_wait.dll') }));
}

console.log('— 12.3 Nr. 2: Kopie mit Fortschritt, Stempel');
{
  const d = ordner('kopie');
  const pfade: LaufzeitPfade = { basis: join(d, 'zoom-laufzeit'), ressourcen: baueRessourcen(join(d, 'res')) };
  const wahl = wahlVon(pruefeSdkOrdner(baueSdk(join(d, 'sdk')), pfade.ressourcen));
  const staende: KopieStand[] = [];
  const r = await richteEin({ wahl, pfade, fortschritt: (k) => staende.push(k), werkzeuge: { jetzt: () => new Date('2026-10-02T12:00:00.000Z') } });
  const ziel = laufzeitOrdner(pfade);
  ck('Einrichtung ok, Ordner = basis/7.1.5.43953', r.ok && r.ordner === ziel);
  ck('Fortschritt nach jeder Datei: 1 … 8 von 8', staende.length === 8 && staende.every((k, i) => k.dateien === i + 1 && k.dateienGesamt === 8));
  ck('Bytes steigen bis bytesGesamt', staende[7].bytes === wahl.bytesGesamt && staende.every((k, i) => k.bytesGesamt === wahl.bytesGesamt && (i === 0 || k.bytes > staende[i - 1].bytes)));
  ck('alle SDK-Dateien da, auch in Unterordnern', wahl.dateien.every((x) => existsSync(join(ziel, ...x.pfad.split('/')))));
  ck('eigene Dateien da', [BRIDGE_EXE, 'vcruntime140.dll', NDI_DLL].every((n) => existsSync(join(ziel, n))));
  const st = JSON.parse(readFileSync(join(ziel, STEMPEL_DATEI), 'utf8')) as Stempel;
  ck('Stempel: format 1, Fassung, Zeit', st.format === 1 && st.sdkFassung === '7.1.5.43953' && st.eingerichtetAm === '2026-10-02T12:00:00.000Z');
  ck('Stempel: alle SDK-Dateien mit Größe', JSON.stringify(st.sdkDateien) === JSON.stringify(wahl.dateien));
  ck('Stempel: eigene Dateien mit SHA-256',
    JSON.stringify(st.eigeneDateien) === JSON.stringify([NDI_DLL, 'vcruntime140.dll', BRIDGE_EXE].map((p) => ({ pfad: p, sha256: sha(join(ziel, p)) }))));
  ck('Rückgabe trägt denselben Stempel', r.ok && JSON.stringify(r.stempel) === JSON.stringify(st));
  ck('kein .teil, kein .alt übrig', !existsSync(`${ziel}.teil`) && !existsSync(`${ziel}.alt`));
}

console.log('— 12.3 Nr. 3: Kopierfehler bei Datei 5 → S6, vorige Einrichtung unverändert');
{
  const { pfade, ziel, dir } = await eingerichtet('fehler5');
  const vorher = readFileSync(join(ziel, STEMPEL_DATEI));
  let n = 0;
  const r = await richteEin({
    wahl: zweitesSdk(dir, pfade), pfade, fortschritt: ruhig,
    werkzeuge: {
      copyFile: async (von, nach) => {
        if (++n === 5) throw Object.assign(new Error('E/A-Fehler'), { code: 'EIO' });
        copyFileSync(von, nach);
      },
    },
  });
  ck('Ergebnis S6 mit dem Fehlercode', JSON.stringify(r) === JSON.stringify({ ok: false, text: KT.S6('EIO') }));
  ck('.teil gelöscht', !existsSync(`${ziel}.teil`));
  ck('Stempel byte-gleich', readFileSync(join(ziel, STEMPEL_DATEI)).equals(vorher));
  ck('neue Datei nicht in der alten Einrichtung', !existsSync(join(ziel, 'neu.dll')) && existsSync(join(ziel, 'sdk.dll')));
}

console.log('— 12.3 Nr. 4: zu wenig Platz → S5, nichts angelegt');
{
  const d = ordner('platz');
  const pfade: LaufzeitPfade = { basis: join(d, 'lokal', 'JM Connect', 'zoom-laufzeit'), ressourcen: baueRessourcen(join(d, 'res')) };
  const wahl = wahlVon(pruefeSdkOrdner(baueSdk(join(d, 'sdk')), pfade.ressourcen));
  let gefragt = '';
  let kopiert = 0;
  const r = await richteEin({
    wahl, pfade, fortschritt: ruhig,
    werkzeuge: {
      statfs: async (p) => { gefragt = p; return { bavail: 10, bsize: 4096 }; },
      copyFile: async () => { kopiert++; },
    },
  });
  const gebraucht = Math.ceil((wahl.bytesGesamt + PLATZ_RESERVE_BYTES) / (1024 * 1024));
  ck('S5 mit gebraucht 101 MB, frei 0 MB', gebraucht === 101 && JSON.stringify(r) === JSON.stringify({ ok: false, text: KT.S5(101, 0) }));
  ck('statfs am nächsten existierenden Vorfahren (basis gibt es noch nicht)', gefragt === d);
  ck('nichts kopiert, nichts angelegt', kopiert === 0 && !existsSync(pfade.basis));
}

console.log('— 12.3 Nr. 8: zweite Einrichtung ersetzt die erste, Geschwister nur mit gültigem Stempel weg');
{
  const { pfade, ziel, dir } = await eingerichtet('tausch');
  const andere = join(pfade.basis, '7.1.4.1');
  mkdirSync(andere);
  writeFileSync(join(andere, STEMPEL_DATEI), JSON.stringify({ format: 1, sdkFassung: '7.1.4.1', eingerichtetAm: '2026-01-01T00:00:00.000Z', sdkDateien: [], eigeneDateien: [] }));
  const fremd = join(pfade.basis, '7.0.0.1');
  mkdirSync(fremd);
  writeFileSync(join(fremd, 'notiz.txt'), 'nicht von Connect');
  const kaputt = join(pfade.basis, '7.0.0.2');
  mkdirSync(kaputt);
  writeFileSync(join(kaputt, STEMPEL_DATEI), '{ kein JSON');
  const r = await richteEin({ wahl: zweitesSdk(dir, pfade), pfade, fortschritt: ruhig });
  ck('zweite Einrichtung ok', r.ok);
  ck('neue SDK-Datei ist da', existsSync(join(ziel, 'neu.dll')));
  const st = JSON.parse(readFileSync(join(ziel, STEMPEL_DATEI), 'utf8')) as Stempel;
  ck('Stempel nennt 9 SDK-Dateien inkl. neu.dll', st.sdkDateien.length === 9 && st.sdkDateien.some((x) => x.pfad === 'neu.dll'));
  ck('Geschwister 7.1.4.1 mit gültigem Stempel gelöscht', !existsSync(andere));
  ck('Geschwister 7.0.0.1 ohne Stempel bleibt', existsSync(join(fremd, 'notiz.txt')));
  ck('Geschwister mit unlesbarem Stempel bleibt', existsSync(kaputt));
  ck('kein .alt, kein .teil übrig', !existsSync(`${ziel}.alt`) && !existsSync(`${ziel}.teil`));
}

console.log('— 6.1 Schritt 8: Nachprüfung scheitert → S7');
{
  const { pfade, ziel, dir } = await eingerichtet('nachpruefung');
  const vorher = readFileSync(join(ziel, STEMPEL_DATEI));
  let n = 0;
  const r = await richteEin({
    wahl: zweitesSdk(dir, pfade), pfade, fortschritt: ruhig,
    werkzeuge: { copyFile: async (von, nach) => { if (++n === 3) writeFileSync(nach, ''); else copyFileSync(von, nach); } },
  });
  ck('Datei 3 leer kopiert → S7 (8 von 9 Dateien)', JSON.stringify(r) === JSON.stringify({ ok: false, text: KT.S7(8, 9) }));
  ck('.teil gelöscht, alte Einrichtung unverändert', !existsSync(`${ziel}.teil`) && readFileSync(join(ziel, STEMPEL_DATEI)).equals(vorher));

  const r2 = await richteEin({
    wahl: zweitesSdk(ordner('nachpruefung-pe'), pfade), pfade, fortschritt: ruhig,
    werkzeuge: {
      copyFile: async (von, nach) => {
        if (nach.endsWith('sdk.dll')) writeFileSync(nach, machePe(X64, [7, 1, 6, 1])); // gleiche Größe, andere Fassung
        else copyFileSync(von, nach);
      },
    },
  });
  ck('Kopie der sdk.dll mit anderer Fassung → S7 (8 von 9 Dateien)', JSON.stringify(r2) === JSON.stringify({ ok: false, text: KT.S7(8, 9) }));
}

console.log('— Review Focus 3, Teil richteEin: Abbruch während der Kopie (AbortSignal)');
{
  const { pfade, ziel, dir } = await eingerichtet('abbruch');
  const vorher = readFileSync(join(ziel, STEMPEL_DATEI));
  const ac = new AbortController();
  let n = 0;
  const staende: KopieStand[] = [];
  const r = await richteEin({
    wahl: zweitesSdk(dir, pfade), pfade, signal: ac.signal, fortschritt: (k) => staende.push(k),
    werkzeuge: { copyFile: async (von, nach) => { if (++n === 3) ac.abort(); copyFileSync(von, nach); } },
  });
  ck('Ergebnis: abgebrochen (S6)', JSON.stringify(r) === JSON.stringify({ ok: false, text: KT.S6('abgebrochen') }));
  ck('nach Datei 3 keine weitere Datei kopiert', n === 3 && staende.length === 3);
  ck('<ziel>.teil gelöscht', !existsSync(`${ziel}.teil`));
  ck('vorher eingerichteter Ordner und Stempel unverändert',
    readFileSync(join(ziel, STEMPEL_DATEI)).equals(vorher) && !existsSync(join(ziel, 'neu.dll')) && existsSync(join(ziel, 'sdk.dll')));
}

console.log('— Fix-Runde 1: Aufräumen nach dem Tausch meldet Fehler, überspringt aber kein Geschwister');
{
  const { pfade, ziel, dir } = await eingerichtet('aufraeumen');
  const andere = join(pfade.basis, '7.1.4.1');
  mkdirSync(andere);
  writeFileSync(join(andere, STEMPEL_DATEI), JSON.stringify({ format: 1, sdkFassung: '7.1.4.1', eingerichtetAm: '2026-01-01T00:00:00.000Z', sdkDateien: [], eigeneDateien: [] }));
  const r = await richteEin({
    wahl: zweitesSdk(dir, pfade), pfade, fortschritt: ruhig,
    werkzeuge: { loesche: (pfad) => { if (pfad.endsWith('.alt')) throw Object.assign(new Error('gesperrt'), { code: 'EBUSY' }); rmSync(pfad, { recursive: true, force: true }); } },
  });
  ck('Einrichtung bleibt ok trotz Aufräumfehler', r.ok && existsSync(join(ziel, 'neu.dll')));
  ck('Aufräumfehler mit Code im Ergebnis', r.ok && r.aufraeumFehler === 'EBUSY');
  ck('Geschwister trotzdem gelöscht', !existsSync(andere));
  const r2 = await richteEin({ wahl: zweitesSdk(ordner('aufraeumen-ok'), pfade), pfade, fortschritt: ruhig });
  ck('ohne Fehler: aufraeumFehler null', r2.ok && r2.aufraeumFehler === null);
}

console.log('— 12.3 Nr. 9: Programmstart');
{
  const d = ordner('start');
  const leer: LaufzeitPfade = { basis: join(d, 'zoom-laufzeit'), ressourcen: baueRessourcen(join(d, 'res')) };
  ck('kein Laufzeit-Ordner → sdk_fehlt', JSON.stringify(pruefeLaufzeit(leer)) === JSON.stringify({ ok: false, mangel: 'sdk_fehlt' }));
  const { pfade, ziel } = await eingerichtet('start-ok');
  ck('alles in Ordnung → ok, nichts ersetzt', JSON.stringify(pruefeLaufzeit(pfade)) === JSON.stringify({ ok: true, ordner: ziel, ersetzt: [] }));
  rmSync(join(ziel, 'sdk.dll'));
  ck('Stempel da, sdk.dll gelöscht → sdk_defekt (nicht „Bereit“)',
    JSON.stringify(pruefeLaufzeit(pfade)) === JSON.stringify({ ok: false, mangel: 'sdk_defekt', datei: 'sdk.dll' }));
}

console.log('— 12.3 Nr. 5: Prüfung vor dem Start (Schritte 1–3)');
{
  const { pfade, ziel, dir } = await eingerichtet('pruefung');
  const quelle = (p: string): string => join(dir, 'sdk', 'x64', 'bin', ...p.split('/'));
  const defekt = (datei: string): string => JSON.stringify({ ok: false, mangel: 'sdk_defekt', datei });

  rmSync(join(ziel, 'zVideoApp.dll'));
  ck('fehlende SDK-Datei → sdk_defekt mit ihrem Pfad', JSON.stringify(pruefeLaufzeit(pfade)) === defekt('zVideoApp.dll'));
  writeFileSync(join(ziel, 'zVideoApp.dll'), Buffer.alloc(3));
  ck('SDK-Datei mit anderer Größe → sdk_defekt', JSON.stringify(pruefeLaufzeit(pfade)) === defekt('zVideoApp.dll'));
  copyFileSync(quelle('zVideoApp.dll'), join(ziel, 'zVideoApp.dll'));
  writeFileSync(join(ziel, 'zusatz.dat'), 'vom SDK selbst geschrieben');
  ck('zusätzliche Datei → in Ordnung', pruefeLaufzeit(pfade).ok === true);
  rmSync(join(ziel, 'language', 'de.txt'));
  ck('fehlende Datei im Unterordner → Pfad mit „/“', JSON.stringify(pruefeLaufzeit(pfade)) === defekt('language/de.txt'));
  copyFileSync(quelle('language/de.txt'), join(ziel, 'language', 'de.txt'));

  writeFileSync(join(ziel, 'sdk.dll'), machePe(X86, F_OK)); // gleiche Größe, aber 32 Bit
  ck('sdk.dll mit gleicher Größe, aber 32 Bit → sdk_defekt (sdk.dll)', JSON.stringify(pruefeLaufzeit(pfade)) === defekt('sdk.dll'));
  writeFileSync(join(ziel, 'sdk.dll'), machePe(X64, [7, 1, 5, 1]));
  ck('sdk.dll mit anderer Fassung → sdk_defekt (sdk.dll)', JSON.stringify(pruefeLaufzeit(pfade)) === defekt('sdk.dll'));
  writeFileSync(join(ziel, 'sdk.dll'), machePe(X64, F_OK));
  ck('sdk.dll wieder richtig → ok', pruefeLaufzeit(pfade).ok === true);

  const stempelPfad = join(ziel, STEMPEL_DATEI);
  const st = JSON.parse(readFileSync(stempelPfad, 'utf8')) as Stempel;
  writeFileSync(stempelPfad, JSON.stringify({ ...st, sdkFassung: '7.1.6.1' }));
  ck('Stempel mit sdkFassung 7.1.6.1 → sdk_defekt (Stempel)', JSON.stringify(pruefeLaufzeit(pfade)) === defekt(STEMPEL_DATEI));
  writeFileSync(stempelPfad, JSON.stringify({ ...st, format: 2 }));
  ck('Stempel mit format 2 → sdk_defekt (Stempel)', JSON.stringify(pruefeLaufzeit(pfade)) === defekt(STEMPEL_DATEI));
  writeFileSync(stempelPfad, '{ kein JSON');
  ck('Stempel unlesbar → sdk_defekt (Stempel)', JSON.stringify(pruefeLaufzeit(pfade)) === defekt(STEMPEL_DATEI));
  rmSync(stempelPfad);
  ck('Stempel fehlt → sdk_defekt (Stempel)', JSON.stringify(pruefeLaufzeit(pfade)) === defekt(STEMPEL_DATEI));
}

console.log('— 12.3 Nr. 6: eigene Dateien abgleichen (Schritt 4)');
{
  const { pfade, ziel } = await eingerichtet('eigene');
  const exeRes = join(pfade.ressourcen, 'zoom-bridge', BRIDGE_EXE);
  writeFileSync(exeRes, 'bridge-2');
  ck('geänderte zoom-bridge.exe → ersetzt', JSON.stringify(pruefeLaufzeit(pfade)) === JSON.stringify({ ok: true, ordner: ziel, ersetzt: [BRIDGE_EXE] }));
  ck('Inhalt im Laufzeit-Ordner neu', readFileSync(join(ziel, BRIDGE_EXE), 'utf8') === 'bridge-2');
  const st = JSON.parse(readFileSync(join(ziel, STEMPEL_DATEI), 'utf8')) as Stempel;
  ck('Stempel: SHA-256 der neuen EXE', st.eigeneDateien.find((x) => x.pfad === BRIDGE_EXE)?.sha256 === sha(exeRes));
  ck('Stempel: SDK-Teil unverändert', st.sdkFassung === '7.1.5.43953' && st.sdkDateien.length === 8);
  ck('zweiter Aufruf → nichts ersetzt', JSON.stringify(pruefeLaufzeit(pfade)) === JSON.stringify({ ok: true, ordner: ziel, ersetzt: [] }));
  rmSync(join(ziel, NDI_DLL));
  ck('fehlende NDI-DLL im Laufzeit-Ordner → wieder da',
    JSON.stringify(pruefeLaufzeit(pfade)) === JSON.stringify({ ok: true, ordner: ziel, ersetzt: [NDI_DLL] }) && existsSync(join(ziel, NDI_DLL)));
  writeFileSync(join(pfade.ressourcen, 'zoom-bridge', 'vcruntime140_1.dll'), 'vc1');
  const r = pruefeLaufzeit(pfade);
  ck('neue Ressource → kopiert und im Stempel',
    r.ok && JSON.stringify(r.ersetzt) === JSON.stringify(['vcruntime140_1.dll'])
    && (JSON.parse(readFileSync(join(ziel, STEMPEL_DATEI), 'utf8')) as Stempel).eigeneDateien.some((x) => x.pfad === 'vcruntime140_1.dll'));
  rmSync(exeRes);
  ck('Ressource zoom-bridge.exe fehlt → bridge_fehlt', JSON.stringify(pruefeLaufzeit(pfade)) === JSON.stringify({ ok: false, mangel: 'bridge_fehlt' }));
}

console.log('— 12.2 Fall 4b: kindPfad und pfadVarianten (Path-Falle 3.2-4, M6)');
{
  ck('kindPfad({ Path: C:\\A }, L) → L;C:\\A', kindPfad({ Path: 'C:\\A' }, 'L') === 'L;C:\\A');
  ck('kindPfad({ PATH: X }, L) → L;X', kindPfad({ PATH: 'X' }, 'L') === 'L;X');
  ck('kindPfad({}, L) → L', kindPfad({}, 'L') === 'L');
  ck('PATH geht vor Path', kindPfad({ Path: 'Y', PATH: 'X' }, 'L') === 'L;X');
  ck('leerer geerbter Wert → nur der Ordner', kindPfad({ PATH: '' }, 'L') === 'L');
  ck('pfadVarianten({ Path, PATH, path }) → [Path, path]', JSON.stringify(pfadVarianten({ Path: 'a', PATH: 'b', path: 'c' })) === JSON.stringify(['Path', 'path']));
  ck('pfadVarianten ohne andere Schreibweise → []', pfadVarianten({ PATH: 'b', HOME: 'h' }).length === 0);
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
rmSync(TEMP, { recursive: true, force: true });
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

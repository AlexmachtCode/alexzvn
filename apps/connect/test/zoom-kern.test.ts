// Zoom-Kern OHNE Electron (tsx): echte Bridge gegen die Attrappe packages/zoom-bridge/test/fake-bridge.mjs.
//   npm run selftest -w @jm/connect   ·   einzeln: npx tsx apps/connect/test/zoom-kern.test.ts
// Spec 12.2 ohne die 4b-Fälle (15, 15b, 15c, 16–18, 22, 25, Fernsteuer-Teile von 13 und 21).
// Laufzeit, Zugangsdaten und Einstellungen sind Attrappen; die Bridge-Fabrik setzt FAKE_SDK_FASSUNG
// IMMER auf '7.1.5 (43953)' — die Prüfung im Kern bleibt exakt (G1), nur Fall 7 überschreibt den Wert.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Bridge, type BridgeEvent, type Command } from '@jm/zoom-bridge';
import { SDK_FASSUNG } from '@jm/zoom-bridge/sdk';
import {
  ANZEIGENAME_VORGABE,
  erzeugeZoomKern,
  type BridgeArt,
  type BridgeFabrik,
  type LaufzeitDienste,
  type ZoomFristen,
  type ZoomKern,
  type ZugangDaten,
  type ZugangStand,
} from '../src/main/zoom/kern';
import { KT } from '../src/main/zoom/klartext';
import {
  laufzeitOrdner,
  richteEin,
  STEMPEL_DATEI,
  type EinrichtungsErgebnis,
  type LaufzeitPfade,
  type LaufzeitPruefung,
} from '../src/main/zoom/laufzeit';
import type { ZoomAbbild, ZoomErgebnis, ZoomKurz } from '../src/shared/types';
import { kartenZeile, stateKvAus, zoomZ } from '../src/shared/zoom-text';

const HIER = dirname(fileURLToPath(import.meta.url));
const FAKE = join(HIER, '..', '..', '..', 'packages', 'zoom-bridge', 'test', 'fake-bridge.mjs');
/** Synthetisch (G12) — keine echte Meeting-Nummer. */
const NUMMER = '7'.repeat(10);
const KENNCODE = 'KENNCODE-PROBE-71';

let pass = 0, fail = 0, skip = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
function ueberspringe(name: string): void {
  skip++;
  console.log(`  --  ${name} (übersprungen: nur unter Windows)`);
}
function warte(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
/** Wartet, bis `pred` zutrifft (Takt 20 ms); liefert, ob es rechtzeitig zutraf. */
async function bis(pred: () => boolean, ms = 4000): Promise<boolean> {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (pred()) return true;
    await warte(20);
  }
  return pred();
}
// Gesamtwache: hängt ein Fall, endet der Lauf rot statt nie.
const wache = setTimeout(() => {
  console.log('FAIL  Gesamtlaufzeit über 180 s – ein Fall hängt');
  process.exit(1);
}, 180_000);
wache.unref();

interface Probe {
  kern: ZoomKern;
  logs: string[];
  abbilder: ZoomAbbild[];
  kurze: ZoomKurz[];
  starts(): number;
  /** Befehle aus FAKE_LOGDATEI; ohne Argument die aller Starts in Reihenfolge. */
  befehle(startNr?: number): Array<Record<string, unknown>>;
  ereignisse: Array<{ startNr: number; ev: BridgeEvent }>;
  einst: { anzeigename: string; versatzMs: number; laufzeit: { dir: string; fassung: string; eingerichtetAm: string } | null };
  zugangGespeichert: ZugangDaten[];
  richteEinAufrufe(): number;
  /** Laufzeit-Ordner, den die Vorgabe von `pruefe` meldet. */
  ordner: string;
  /** Die Pfade, mit denen der Kern erzeugt ist (für das echte richteEin). */
  pfade: LaufzeitPfade;
  /** kern.beenden(2000), jede gebaute Bridge stoppen, Temp-Ordner löschen. */
  aufraeumen(): Promise<void>;
}
interface BaueOptionen {
  /** Stellschrauben der Attrappe je Start (1., 2., … Bridge). */
  stell?: (startNr: number) => Record<string, string>;
  /** FAKE_SCRIPT, Vorgabe 'steuerung'. */
  skript?: string;
  zugang?: Partial<ZugangStand>;
  speichernLiefert?: 'stored' | 'session';
  laufzeit?: Partial<LaufzeitDienste>;
  fristen?: Partial<ZoomFristen>;
  gastLabels?: () => string[];
  env?: Record<string, string | undefined>;
  /** false = Befehl verschlucken (Q8). */
  sendeFilter?: (cmd: Command) => boolean;
  versatzMs?: number;
  anzeigename?: string;
}

function baueKern(o: BaueOptionen = {}): Probe {
  const tmp = mkdtempSync(join(tmpdir(), 'jm-zoom-kern-'));
  const ordner = join(tmp, 'laufzeit');
  const pfade: LaufzeitPfade = { basis: join(tmp, 'basis'), ressourcen: join(tmp, 'ressourcen') };
  let startZahl = 0;
  let richteEinZahl = 0;
  const bruecken: BridgeArt[] = [];
  const logs: string[] = [];
  const abbilder: ZoomAbbild[] = [];
  const kurze: ZoomKurz[] = [];
  const ereignisse: Probe['ereignisse'] = [];
  const zugangGespeichert: ZugangDaten[] = [];
  const einst: Probe['einst'] = { anzeigename: o.anzeigename ?? ANZEIGENAME_VORGABE, versatzMs: o.versatzMs ?? 0, laufzeit: null };
  let zugang: ZugangStand = {
    daten: { clientId: 'test-id-1234', clientSecret: 'test-secret' },
    herkunft: 'stored',
    unlesbar: false,
    ...o.zugang,
  };
  const fabrik: BridgeFabrik = (opts, nr) => {
    startZahl += 1;
    const b = new Bridge({
      ...opts,
      exePath: process.execPath,
      exeArgs: [FAKE],
      env: {
        ...opts.env,
        FAKE_SCRIPT: o.skript ?? 'steuerung',
        FAKE_SDK_FASSUNG: '7.1.5 (43953)',
        FAKE_LOGDATEI: join(tmp, `befehle-${nr}.log`),
        ...(o.stell?.(nr) ?? {}),
      },
      onEvent: (ev, s) => {
        ereignisse.push({ startNr: nr, ev });
        opts.onEvent?.(ev, s);
      },
    });
    const art: BridgeArt = {
      start: () => b.start(),
      send: (cmd) => {
        if (o.sendeFilter && !o.sendeFilter(cmd)) return;
        b.send(cmd);
      },
      stop: () => b.stop(),
      get session() {
        return b.session;
      },
    };
    bruecken.push(art);
    return art;
  };
  const richteEinVorgabe = o.laufzeit?.richteEin;
  const laufzeit: Partial<LaufzeitDienste> = {
    pruefe: () => ({ ok: true, ordner, ersetzt: [] }),
    ...o.laufzeit,
  };
  if (richteEinVorgabe) {
    laufzeit.richteEin = (e) => {
      richteEinZahl += 1;
      return richteEinVorgabe(e);
    };
  }
  const kern = erzeugeZoomKern({
    pfade,
    zugang: {
      lesen: () => ({ ...zugang }),
      speichern: (dd) => {
        zugangGespeichert.push({ ...dd });
        const herkunft = o.speichernLiefert ?? 'stored';
        if (zugang.herkunft !== 'env') zugang = { daten: { ...dd }, herkunft, unlesbar: false };
        return herkunft;
      },
      loeschen: () => {
        if (zugang.herkunft !== 'env') zugang = { daten: null, herkunft: 'none', unlesbar: false };
      },
    },
    einstellungen: {
      anzeigename: () => einst.anzeigename,
      setzeAnzeigename: (n) => {
        einst.anzeigename = n;
      },
      versatzMs: () => einst.versatzMs,
      setzeVersatzMs: (ms) => {
        einst.versatzMs = ms;
      },
      setzeLaufzeit: (v) => {
        einst.laufzeit = { ...v };
      },
    },
    gastLabels: o.gastLabels ?? (() => []),
    log: (z) => logs.push(z),
    onAbbild: (a) => abbilder.push(a),
    onKurz: (k) => kurze.push(k),
    bridgeFabrik: fabrik,
    laufzeit,
    env: o.env,
    fristen: { anmeldeMs: 3000, joinTimeoutMs: 3000, killTimeoutMs: 2000, ...o.fristen },
  });
  return {
    kern,
    logs,
    abbilder,
    kurze,
    ereignisse,
    einst,
    zugangGespeichert,
    ordner,
    pfade,
    starts: () => startZahl,
    befehle: (startNr) => {
      const nummern = startNr === undefined ? Array.from({ length: startZahl }, (_, i) => i + 1) : [startNr];
      const aus: Array<Record<string, unknown>> = [];
      for (const n of nummern) {
        const datei = join(tmp, `befehle-${n}.log`);
        if (!existsSync(datei)) continue;
        for (const z of readFileSync(datei, 'utf8').split('\n')) if (z.trim()) aus.push(JSON.parse(z) as Record<string, unknown>);
      }
      return aus;
    },
    richteEinAufrufe: () => richteEinZahl,
    aufraeumen: async () => {
      await kern.beenden(2000);
      await Promise.all(bruecken.map((b) => b.stop()));
      try {
        rmSync(tmp, { recursive: true, force: true });
      } catch {
        // Windows: eine Datei ist noch offen — der Temp-Ordner bleibt liegen, der Test nicht hängen.
      }
    },
  };
}

/** Befehlsnamen eines Starts (oder aller Starts). */
function cmds(p: Probe, startNr?: number): string[] {
  return p.befehle(startNr).map((c) => String(c.cmd));
}
/** Zustandsfolge aus den onKurz-Meldungen, ohne direkte Wiederholungen. */
function folge(p: Probe): string[] {
  const aus: string[] = [];
  for (const k of p.kurze) if (aus.at(-1) !== k.zustand) aus.push(k.zustand);
  return aus;
}
const ok = (r: { ok: boolean }): boolean => r.ok;
const text = (r: { ok: true } | { ok: false; text: string }): string | null => (r.ok ? null : r.text);

// ── Aufgabe 10: Einrichtung, Mängel, Sperre, Drossel ─────────────────────────
console.log('— Mängel beim Start (Fall 1, erster Teil)');
{
  const p = baueKern({ zugang: { daten: null, herkunft: 'none' }, laufzeit: { pruefe: () => ({ ok: false, mangel: 'sdk_fehlt' }) } });
  const k = p.kern.kurz();
  ck('Laufzeit fehlt + kein Zugang → einrichtung', k.zustand === 'einrichtung' && zoomZ(k) === 'Z1a');
  ck('… Mängel in der Reihenfolge Laufzeit, Zugang', JSON.stringify(k.maengel) === '["sdk_fehlt","zugang_fehlt"]');
  ck('… STATE zoom_status=einrichtung, zoom_alarm=0', p.kern.stateKv()?.zoom_status === 'einrichtung' && p.kern.stateKv()?.zoom_alarm === 0);
  const a = p.kern.abbild();
  ck('… SDK „fehlt“ ohne Fassung, Zugang „none“ ohne Client-ID', a.einrichtung.sdk.stand === 'fehlt' && a.einrichtung.sdk.fassung === null
    && a.einrichtung.zugang.herkunft === 'none' && a.einrichtung.zugang.clientIdEnde === null);
  ck('… läuft nichts', !p.kern.laeuft());
  ck('… Sperre offen in Z1a', p.kern.einrichtungSperre().ok);
  await p.aufraeumen();
}
{
  const p = baueKern();
  const a = p.kern.abbild();
  ck('alles eingerichtet → bereit ohne Mängel', a.kurz.zustand === 'bereit' && a.kurz.maengel.length === 0 && p.kern.stateKv()?.zoom_status === 'bereit');
  ck('… SDK ok mit 7.1.5.43953, Client-ID endet auf 1234, kein Text',
    a.einrichtung.sdk.stand === 'ok' && a.einrichtung.sdk.fassung === SDK_FASSUNG && a.einrichtung.sdk.text === null
    && a.einrichtung.zugang.herkunft === 'stored' && a.einrichtung.zugang.clientIdEnde === '1234' && a.einrichtung.zugang.text === null);
  ck('… Client-Secret nirgends im Abbild', !JSON.stringify(a).includes('test-secret'));
  ck('… Anzeigename und Versatz aus den Einstellungen, nichts bestätigt',
    a.anzeigename === 'JM Connect' && a.versatz.gewuenschtMs === 0 && a.versatz.bestaetigtMs === null);
  ck('… keine Meldung, kein „Erneut“, keine Teilnehmer, keine Soll-Einträge, kein Abriss',
    a.meldung === null && !a.erneutMoeglich && a.teilnehmer.length === 0 && a.soll.length === 0 && a.abriss === null && !a.pruefungLaeuft);
  ck('… Log nennt den Startzustand', p.logs.some((z) => z.startsWith('[zoom] ') && z.includes('bereit')));
  await p.aufraeumen();
}
{
  const p = baueKern({ zugang: { daten: null, herkunft: 'none', unlesbar: true } });
  ck('Zugang unlesbar → Mangel zugang_unlesbar, Text A5',
    JSON.stringify(p.kern.kurz().maengel) === '["zugang_unlesbar"]' && p.kern.abbild().einrichtung.zugang.text === KT.A5);
  await p.aufraeumen();
}
{
  const p = baueKern({ laufzeit: { pruefe: () => ({ ok: false, mangel: 'sdk_defekt', datei: 'sdk.dll' }) } });
  const a = p.kern.abbild();
  ck('Laufzeit defekt → Stand „defekt“, Text S9 mit Datei', a.einrichtung.sdk.stand === 'defekt' && a.einrichtung.sdk.text === KT.S9('sdk.dll'));
  await p.aufraeumen();
}
{
  const p = baueKern({ laufzeit: { pruefe: () => ({ ok: false, mangel: 'bridge_fehlt' }) } });
  ck('Bridge fehlt → Mangel bridge_fehlt, Text S8',
    JSON.stringify(p.kern.kurz().maengel) === '["bridge_fehlt"]' && p.kern.abbild().einrichtung.sdk.text === KT.S8);
  await p.aufraeumen();
}

console.log('— Zugangsdaten wählen und entfernen (6.1, A1–A6)');
{
  const p = baueKern({ zugang: { daten: null, herkunft: 'none' } });
  const dir = mkdtempSync(join(tmpdir(), 'jm-zoom-zugang-'));
  const kaputt = join(dir, 'kaputt.json');
  writeFileSync(kaputt, '{ "clientId": "x", "clientSecret": GEHEIM-INHALT');
  const r1 = p.kern.zugangWaehlen(kaputt);
  ck('kaputtes JSON → A1', text(r1) === KT.A1);
  ck('… der Inhalt steht weder im Abbild noch im Log',
    !JSON.stringify(p.kern.abbild()).includes('GEHEIM-INHALT') && !p.logs.some((z) => z.includes('GEHEIM-INHALT')));
  const leer = join(dir, 'leer.json');
  writeFileSync(leer, '{}');
  ck('ohne Felder → A2', text(p.kern.zugangWaehlen(leer)) === KT.A2);
  ck('fehlende Datei → A3 mit ENOENT', text(p.kern.zugangWaehlen(join(dir, 'fehlt.json'))) === KT.A3('ENOENT'));
  ck('… der letzte Fehler steht im Abbild, nichts gespeichert',
    p.kern.abbild().einrichtung.zugang.text === KT.A3('ENOENT') && p.zugangGespeichert.length === 0 && p.kern.kurz().zustand === 'einrichtung');
  const gut = join(dir, 'gut.json');
  writeFileSync(gut, '\uFEFF{"clientId":"datei-id-1234","clientSecret":"datei-secret"}');
  const r4 = p.kern.zugangWaehlen(gut);
  ck('gültige Datei mit BOM → ok und gespeichert', ok(r4) && p.zugangGespeichert.length === 1
    && p.zugangGespeichert[0].clientId === 'datei-id-1234' && p.zugangGespeichert[0].clientSecret === 'datei-secret');
  const a = p.kern.abbild();
  ck('… Mangel weg, bereit, Client-ID endet auf 1234, kein Fehlertext',
    a.kurz.zustand === 'bereit' && a.einrichtung.zugang.herkunft === 'stored' && a.einrichtung.zugang.clientIdEnde === '1234' && a.einrichtung.zugang.text === null);
  ck('… Secret weder im Abbild noch im Log', !JSON.stringify(a).includes('datei-secret') && !p.logs.some((z) => z.includes('datei-secret')));
  ck('Entfernen → Mangel zugang_fehlt, einrichtung', ok(p.kern.zugangLoeschen()) && JSON.stringify(p.kern.kurz().maengel) === '["zugang_fehlt"]'
    && p.kern.kurz().zustand === 'einrichtung');
  rmSync(dir, { recursive: true, force: true });
  await p.aufraeumen();
}
{
  const p = baueKern({ zugang: { daten: null, herkunft: 'none' }, speichernLiefert: 'session' });
  const dir = mkdtempSync(join(tmpdir(), 'jm-zoom-zugang-'));
  const gut = join(dir, 'gut.json');
  writeFileSync(gut, '{"clientId":"sitzung-9876","clientSecret":"s"}');
  ck('ohne Schlüsselbund → ok, Herkunft session, Text A4',
    ok(p.kern.zugangWaehlen(gut)) && p.kern.abbild().einrichtung.zugang.herkunft === 'session' && p.kern.abbild().einrichtung.zugang.text === KT.A4);
  rmSync(dir, { recursive: true, force: true });
  await p.aufraeumen();
}
{
  const p = baueKern({ zugang: { daten: { clientId: 'umgebung-5555', clientSecret: 'u' }, herkunft: 'env' } });
  ck('Herkunft Umgebung → Text A6, Client-ID endet auf 5555',
    p.kern.abbild().einrichtung.zugang.text === KT.A6 && p.kern.abbild().einrichtung.zugang.clientIdEnde === '5555');
  ck('… Entfernen lässt keinen Mangel entstehen', ok(p.kern.zugangLoeschen()) && p.kern.kurz().maengel.length === 0 && p.kern.kurz().zustand === 'bereit');
  await p.aufraeumen();
}

console.log('— SDK-Ordner wählen (6.1), Sperre S10, Review Focus 4');
{
  let lzStand: LaufzeitPruefung = { ok: false, mangel: 'sdk_fehlt' };
  let freigabe: (e: EinrichtungsErgebnis) => void = () => {};
  let signal: AbortSignal | undefined;
  const MiB = 1024 * 1024;
  const p = baueKern({
    laufzeit: {
      pruefe: () => lzStand,
      pruefeOrdner: () => ({
        ok: true, bin: 'C:/SDK/x64/bin', fassung: SDK_FASSUNG,
        dateien: [{ pfad: 'sdk.dll', bytes: MiB }, { pfad: 'a.dll', bytes: MiB }, { pfad: 'language/de.txt', bytes: MiB }],
        bytesGesamt: 3 * MiB,
      }),
      richteEin: (e) => {
        signal = e.signal;
        e.fortschritt({ dateien: 1, dateienGesamt: 3, bytes: MiB, bytesGesamt: 3 * MiB });
        return new Promise<EinrichtungsErgebnis>((resolve) => {
          freigabe = resolve;
        });
      },
    },
  });
  ck('vorher: einrichtung (SDK fehlt)', p.kern.kurz().zustand === 'einrichtung');
  const lauf = p.kern.sdkWaehlen('C:/SDK');
  ck('während der Kopie: Z1b, kopieLaeuft, SDK-Stand „kopiert“',
    zoomZ(p.kern.kurz()) === 'Z1b' && p.kern.kurz().kopieLaeuft && p.kern.abbild().einrichtung.sdk.stand === 'kopiert');
  ck('… Kartenzeile mit Fortschritt', kartenZeile(p.kern.abbild(), Date.now()) === 'Zoom-SDK wird kopiert: 1 von 3 Dateien (1 von 3 MB).');
  ck('… laeuft()', p.kern.laeuft());
  ck('… einrichtungSperre() → S10', text(p.kern.einrichtungSperre()) === KT.S10);
  // Ohne Sperre käme hier eine zweite Kopie, die nie endet — darum mit Frist statt blankem await.
  const zweit = await Promise.race([p.kern.sdkWaehlen('C:/SDK'), warte(1000).then((): ZoomErgebnis => ({ ok: false, text: '(keine Antwort)' }))]);
  ck('Review Focus 4: zweiter Klick während der Kopie → S10', text(zweit) === KT.S10);
  ck('… richteEin genau einmal aufgerufen', p.richteEinAufrufe() === 1);
  ck('… Zugangsdaten wählen und entfernen ebenfalls S10',
    text(p.kern.zugangWaehlen('C:/egal.json')) === KT.S10 && text(p.kern.zugangLoeschen()) === KT.S10);
  lzStand = { ok: true, ordner: p.ordner, ersetzt: [] };
  freigabe({
    ok: true, ordner: p.ordner,
    stempel: { format: 1, sdkFassung: SDK_FASSUNG, eingerichtetAm: '2026-10-02T10:00:00.000Z', sdkDateien: [], eigeneDateien: [] },
    aufraeumFehler: null,
  });
  const r = await lauf;
  ck('nach der Kopie: ok, bereit, keine Mängel', ok(r) && p.kern.kurz().zustand === 'bereit' && p.kern.kurz().maengel.length === 0
    && !p.kern.kurz().kopieLaeuft && p.kern.abbild().einrichtung.sdk.kopie === null);
  ck('… Laufzeit in den Einstellungen', p.einst.laufzeit?.dir === p.ordner && p.einst.laufzeit?.fassung === SDK_FASSUNG
    && p.einst.laufzeit?.eingerichtetAm === '2026-10-02T10:00:00.000Z');
  ck('… Signal nicht abgebrochen, nichts läuft mehr', signal?.aborted === false && !p.kern.laeuft());
  await p.aufraeumen();
}
{
  const p = baueKern({ laufzeit: { pruefeOrdner: () => ({ ok: false, text: KT.S1 }) } });
  const r = await p.kern.sdkWaehlen('C:/leer');
  ck('kein SDK im Ordner → S1, auch als Text im Abbild', text(r) === KT.S1 && p.kern.abbild().einrichtung.sdk.text === KT.S1);
  ck('… Zustand bleibt bereit, keine Kopie', p.kern.kurz().zustand === 'bereit' && !p.kern.kurz().kopieLaeuft);
  await p.aufraeumen();
}
{
  const p = baueKern({
    laufzeit: {
      pruefeOrdner: () => ({ ok: true, bin: 'X', fassung: SDK_FASSUNG, dateien: [{ pfad: 'sdk.dll', bytes: 1 }], bytesGesamt: 1 }),
      richteEin: async () => ({ ok: false, text: KT.S6('EIO') }),
    },
  });
  const r = await p.kern.sdkWaehlen('C:/SDK');
  ck('Kopierfehler → S6, Text im Abbild, bisherige Einrichtung bleibt (bereit)',
    text(r) === KT.S6('EIO') && p.kern.abbild().einrichtung.sdk.text === KT.S6('EIO') && p.kern.kurz().zustand === 'bereit' && p.einst.laufzeit === null);
  await p.aufraeumen();
}
{
  let signal: AbortSignal | undefined;
  let freigabe: (e: EinrichtungsErgebnis) => void = () => {};
  const p = baueKern({
    laufzeit: {
      pruefe: () => ({ ok: false, mangel: 'sdk_fehlt' }),
      pruefeOrdner: () => ({ ok: true, bin: 'X', fassung: SDK_FASSUNG, dateien: [{ pfad: 'sdk.dll', bytes: 1 }], bytesGesamt: 1 }),
      richteEin: (e) => {
        signal = e.signal;
        return new Promise<EinrichtungsErgebnis>((resolve) => {
          freigabe = resolve;
        });
      },
    },
  });
  const lauf = p.kern.sdkWaehlen('C:/SDK');
  let beendet = false;
  const b1 = p.kern.beenden(2000);
  const b2 = p.kern.beenden(2000);
  void b1.then(() => {
    beendet = true;
  });
  await warte(200);
  ck('beenden während der Kopie: Signal abgebrochen, wartet auf das Ende der Kopie (Spec 6.1)', signal?.aborted === true && !beendet);
  ck('… zweiter Aufruf bekommt dasselbe Versprechen', b1 === b2);
  const t0 = Date.now();
  freigabe({ ok: false, text: KT.S6('abgebrochen') });
  await b1;
  ck('… kehrt zurück, sobald die Kopie ihr Ergebnis hat (nicht erst nach der Frist)', Date.now() - t0 < 1000);
  ck('… die Kopie endet mit S6, kein „nicht rechtzeitig“ im Log',
    text(await lauf) === KT.S6('abgebrochen') && !p.logs.includes('[zoom] SDK-Kopie nicht rechtzeitig abgebrochen'));
  await p.aufraeumen();
}
{
  const p = baueKern({
    laufzeit: {
      pruefe: () => ({ ok: false, mangel: 'sdk_fehlt' }),
      pruefeOrdner: () => ({ ok: true, bin: 'X', fassung: SDK_FASSUNG, dateien: [{ pfad: 'sdk.dll', bytes: 1 }], bytesGesamt: 1 }),
      // Eine Kopie, die nie fertig wird (hängendes Laufwerk): beenden darf nicht länger als die Frist warten.
      richteEin: () => new Promise<EinrichtungsErgebnis>(() => {}),
    },
  });
  void p.kern.sdkWaehlen('C:/SDK');
  const t0 = Date.now();
  let dauer = -1;
  // warte(600) hält die Ereignisschleife wach: die Frist läuft über einen unref-Zeitgeber.
  await Promise.all([
    p.kern.beenden(300).then(() => {
      dauer = Date.now() - t0;
    }),
    warte(600),
  ]);
  ck('Kopie hängt → beenden kehrt nach der Frist (300 ms) zurück, Log „SDK-Kopie nicht rechtzeitig abgebrochen“',
    dauer >= 250 && dauer < 600 && p.logs.includes('[zoom] SDK-Kopie nicht rechtzeitig abgebrochen'));
  await p.aufraeumen();
}

console.log('— Review Focus 3: Connect wird während der SDK-Kopie beendet (echtes richteEin)');
{
  const quelle = mkdtempSync(join(tmpdir(), 'jm-zoom-sdk-'));
  const dateien = ['a.dll', 'b.dll', 'c.dll', 'd.dll', 'sdk.dll'].map((pfad) => ({ pfad, bytes: 4 }));
  for (const x of dateien) writeFileSync(join(quelle, x.pfad), 'NEU!');
  let kopiert = 0;
  let ergebnisDa = false;
  const p = baueKern({
    laufzeit: {
      pruefe: () => ({ ok: false, mangel: 'sdk_fehlt' }),
      pruefeOrdner: () => ({ ok: true, bin: quelle, fassung: SDK_FASSUNG, dateien, bytesGesamt: 20 }),
      // Das echte richteEin aus laufzeit.ts; jede Datei braucht 150 ms, damit das Beenden mitten in die Kopie fällt.
      richteEin: (e) => {
        const r = richteEin({
          ...e,
          werkzeuge: {
            copyFile: async (von, nach) => {
              copyFileSync(von, nach);
              kopiert += 1;
              await warte(150);
            },
          },
        });
        void r.then(() => {
          ergebnisDa = true;
        });
        return r;
      },
    },
  });
  const ziel = laufzeitOrdner(p.pfade);
  mkdirSync(ziel, { recursive: true });
  writeFileSync(join(ziel, 'sdk.dll'), 'ALT!');
  writeFileSync(join(ziel, STEMPEL_DATEI), JSON.stringify({ format: 1, sdkFassung: SDK_FASSUNG, eingerichtetAm: '2026-01-01T00:00:00.000Z', sdkDateien: [], eigeneDateien: [] }));
  const vorher = readFileSync(join(ziel, STEMPEL_DATEI));
  const lauf = p.kern.sdkWaehlen(quelle);
  ck('Kopie läuft in <ziel>.teil', (await bis(() => kopiert >= 1, 2000)) && existsSync(`${ziel}.teil`));
  await p.kern.beenden(5000);
  ck('Review Focus 3: beenden kehrt erst zurück, wenn richteEin sein Ergebnis geliefert hat', ergebnisDa);
  ck('… <ziel>.teil ist gelöscht', !existsSync(`${ziel}.teil`));
  ck('… nach der laufenden Datei keine weitere kopiert (1 von 5)', kopiert === 1);
  ck('… vorher eingerichteter Ordner und Stempel unverändert',
    readFileSync(join(ziel, STEMPEL_DATEI)).equals(vorher) && readFileSync(join(ziel, 'sdk.dll'), 'utf8') === 'ALT!' && !existsSync(join(ziel, 'a.dll')));
  ck('… sdkWaehlen liefert S6 (abgebrochen)', text(await lauf) === KT.S6('abgebrochen'));
  rmSync(quelle, { recursive: true, force: true });
  await p.aufraeumen();
}

console.log('— Bild-Versatz speichern (6.7), Schließen/Meldung in Z1/Z2 (6.8)');
{
  const p = baueKern();
  ck('Versatz 1001 → Q13, nicht gespeichert', text(p.kern.versatz({ ms: 1001 })) === KT.Q13 && p.einst.versatzMs === 0);
  ck('Versatz 1.5 → Q13, nicht gespeichert', text(p.kern.versatz({ ms: 1.5 })) === KT.Q13 && p.einst.versatzMs === 0);
  ck('Versatz -1 → Q13', text(p.kern.versatz({ ms: -1 })) === KT.Q13);
  ck('Versatz 250 → gespeichert und im Abbild', ok(p.kern.versatz({ ms: 250 })) && p.einst.versatzMs === 250
    && p.kern.abbild().versatz.gewuenschtMs === 250 && p.kern.abbild().versatz.bestaetigtMs === null);
  p.kern.schliessen();
  p.kern.meldungWeg();
  ck('Schließen und Meldung quittieren in Z2 ohne Meldung: bereit, nichts gemerkt',
    p.kern.kurz().zustand === 'bereit' && p.kern.abbild().meldung === null && !p.kern.abbild().erneutMoeglich);
  await p.aufraeumen();
}
{
  const p = baueKern({ zugang: { daten: null, herkunft: 'none' } });
  p.kern.schliessen();
  ck('Schließen in Z1a ändert nichts', p.kern.kurz().zustand === 'einrichtung' && JSON.stringify(p.kern.kurz().maengel) === '["zugang_fehlt"]');
  await p.aufraeumen();
}

console.log('— Abbild-Drossel (ABBILD_TAKT_MS 100)');
{
  const p = baueKern();
  await warte(150);
  const vorher = p.abbilder.length;
  const kurzVorher = p.kurze.length;
  const t0 = Date.now();
  for (let i = 0; i < 30; i++) p.kern.versatz({ ms: i });
  const dauer = Date.now() - t0;
  await warte(250);
  const neu = p.abbilder.slice(vorher);
  ck('30 Änderungen in unter 50 ms', dauer < 50);
  ck('… höchstens 3 Abbilder in 250 ms', neu.length >= 1 && neu.length <= 3);
  ck('… das letzte trägt den letzten Stand (29)', neu.at(-1)?.versatz.gewuenschtMs === 29);
  ck('… Kurzform unverändert → kein onKurz', p.kurze.length === kurzVorher);
  await p.aufraeumen();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen, ${skip} übersprungen.`);
process.exit(fail === 0 ? 0 : 1);

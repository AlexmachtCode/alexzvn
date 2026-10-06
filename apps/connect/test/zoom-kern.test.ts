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
  BRIDGE_EXE,
  laufzeitOrdner,
  richteEin,
  STEMPEL_DATEI,
  type EinrichtungsErgebnis,
  type LaufzeitPfade,
  type LaufzeitPruefung,
} from '../src/main/zoom/laufzeit';
import type { SdkLadenDienste } from '../src/main/zoom/sdk-laden';
import { SDK_PAKET } from '../src/main/zoom/sdk-paket';
import type { ProxyKeySource, ZoomAbbild, ZoomErgebnis, ZoomKurz } from '../src/shared/types';
import {
  kartenZeile,
  stateKvAus,
  TEXT_A4_SCHREIBFEHLER,
  TEXT_SDK_SCHLUESSEL_NUR_SITZUNG_ENTFERNT,
  TEXT_ZUGANG_NUR_SITZUNG_ENTFERNT,
  zoomZ,
} from '../src/shared/zoom-text';

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
  /** Werte, mit denen der Kern sdkSchluessel.speichern() aufrief (nur im Test sichtbar). */
  sdkSchluesselGespeichert: string[];
  sdkSchluesselGeloescht(): number;
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
  /** Die EXE startet, die der Kern wählt (`join(ordner, BRIDGE_EXE)`), statt Node + Attrappe — für Spawn-Fehler. */
  exeAusKern?: boolean;
  /** start() scheitert mit diesem Fehler, ohne ein Kind zu starten (Spawn-Fehler mit beliebigem Code). */
  startFehler?: () => Error;
  /** SDK-Schlüssel beim Start (Spec SDK nachladen 4.2); Vorgabe: keiner. */
  sdkSchluessel?: { wert: string | null; herkunft: ProxyKeySource };
  /** Was sdkSchluessel.speichern() meldet; Vorgabe 'stored'. */
  sdkSchluesselLiefert?: 'stored' | 'session';
  /** Was zugang.loeschen() bzw. sdkSchluessel.loeschen() meldet; false = Einstellungsdatei nicht schreibbar. Vorgabe true. */
  zugangLoeschenLiefert?: boolean;
  sdkSchluesselLoeschenLiefert?: boolean;
  /** Dienste für „Zoom-SDK laden“ (Attrappen); ohne Angabe die echten aus sdk-laden.ts gegen https://proxy.test. */
  sdkLaden?: Partial<SdkLadenDienste>;
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
  let sdkSchluessel: { wert: string | null; herkunft: ProxyKeySource } = { wert: null, herkunft: 'none', ...o.sdkSchluessel };
  const sdkSchluesselGespeichert: string[] = [];
  let sdkSchluesselGeloescht = 0;
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
      exePath: o.exeAusKern ? opts.exePath : process.execPath,
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
      start: () => (o.startFehler ? Promise.reject(o.startFehler()) : b.start()),
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
        return o.zugangLoeschenLiefert ?? true;
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
    sdkSchluessel: {
      lesen: () => ({ ...sdkSchluessel }),
      speichern: (w) => {
        sdkSchluesselGespeichert.push(w);
        const herkunft = o.sdkSchluesselLiefert ?? 'stored';
        if (sdkSchluessel.herkunft !== 'env') sdkSchluessel = { wert: w, herkunft };
        return herkunft;
      },
      loeschen: () => {
        sdkSchluesselGeloescht += 1;
        if (sdkSchluessel.herkunft !== 'env') sdkSchluessel = { wert: null, herkunft: 'none' };
        return o.sdkSchluesselLoeschenLiefert ?? true;
      },
    },
    gastLabels: o.gastLabels ?? (() => []),
    log: (z) => logs.push(z),
    onAbbild: (a) => abbilder.push(a),
    onKurz: (k) => kurze.push(k),
    bridgeFabrik: fabrik,
    laufzeit,
    proxyUrl: () => 'https://proxy.test',
    sdkLaden: o.sdkLaden,
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
    sdkSchluesselGespeichert,
    sdkSchluesselGeloescht: () => sdkSchluesselGeloescht,
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
  const q = baueKern({ zugang: { daten: { clientId: 'sitzung-9876', clientSecret: 's' }, herkunft: 'session', grund: 'schreibfehler' } });
  ck('session + schreibfehler → Karte nennt die Datei, nicht den Schlüsselbund',
    q.kern.abbild().einrichtung.zugang.text === TEXT_A4_SCHREIBFEHLER && q.kern.abbild().einrichtung.zugang.grund === 'schreibfehler');
  await q.aufraeumen();
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

console.log('— Datei-Weg: Logzeile unverändert (Regression)');
for (const [herk, zeile] of [['stored', '[zoom] Zugangsdaten hinterlegt (verschlüsselt)'], ['session', '[zoom] Zugangsdaten hinterlegt (nur für diese Sitzung)']] as const) {
  const p = baueKern({ zugang: { daten: null, herkunft: 'none' }, speichernLiefert: herk });
  const dir = mkdtempSync(join(tmpdir(), 'jm-zoom-zugang-'));
  const gut = join(dir, 'gut.json');
  writeFileSync(gut, '{"clientId":"datei-id-1234","clientSecret":"datei-secret"}');
  ck(`zugangWaehlen (${herk}) → Logzeile wörtlich`, ok(p.kern.zugangWaehlen(gut)) && p.logs.includes(zeile));
  rmSync(dir, { recursive: true, force: true });
  await p.aufraeumen();
}

console.log('— Zugangsdaten von Hand eintragen (A7, S10, A4)');
{
  const p = baueKern({ zugang: { daten: null, herkunft: 'none' } });
  const r = p.kern.zugangEintragen({ clientId: '  id-test-4321 \t', clientSecret: ' geheim-test\n' });
  ck('Eintragen → ok, gespeichert, Werte getrimmt', ok(r) && p.zugangGespeichert.length === 1
    && p.zugangGespeichert[0].clientId === 'id-test-4321' && p.zugangGespeichert[0].clientSecret === 'geheim-test');
  const a = p.kern.abbild();
  ck('… Zustand wie nach dem Datei-Weg: bereit, stored, Ende 4321, kein Fehlertext',
    a.kurz.zustand === 'bereit' && a.einrichtung.zugang.herkunft === 'stored' && a.einrichtung.zugang.clientIdEnde === '4321' && a.einrichtung.zugang.text === null);
  ck('… Logzeile ohne Wert, mit „von Hand, verschlüsselt“', p.logs.includes('[zoom] Zugangsdaten hinterlegt (von Hand, verschlüsselt)'));
  ck('… weder ID noch Secret in einer Logzeile',
    !p.logs.some((z) => z.includes('id-test-4321') || z.includes('geheim-test') || z.includes('id-test') || z.includes('geheim')));
  ck('… Abbild: nur die letzten 4 Zeichen der ID, kein Secret',
    !JSON.stringify(a).includes('id-test-4321') && !JSON.stringify(a).includes('geheim'));
  await p.aufraeumen();
}
{
  const falsch: Array<[string, { clientId: string; clientSecret: string }]> = [
    ['ID leer', { clientId: '', clientSecret: 'geheim-test' }],
    ['Secret leer', { clientId: 'id-test', clientSecret: '' }],
    ['ID nur Leerraum', { clientId: '  \t ', clientSecret: 'geheim-test' }],
    ['Secret nur Leerraum', { clientId: 'id-test', clientSecret: ' \n ' }],
    ['ID mit Leerzeichen in der Mitte', { clientId: 'id test', clientSecret: 'geheim-test' }],
    ['Secret mit Leerzeichen in der Mitte', { clientId: 'id-test', clientSecret: 'geheim test' }],
    ['ID mit Tabulator in der Mitte', { clientId: 'id\ttest', clientSecret: 'geheim-test' }],
    ['Secret mit Zeilenumbruch in der Mitte', { clientId: 'id-test', clientSecret: 'geheim\ntest' }],
  ];
  for (const [name, e] of falsch) {
    const p = baueKern({ zugang: { daten: null, herkunft: 'none' } });
    const r = p.kern.zugangEintragen(e);
    ck(`${name} → A7, nichts gespeichert, Zustand bleibt`, text(r) === KT.A7 && p.zugangGespeichert.length === 0
      && p.kern.kurz().zustand === 'einrichtung');
    ck('… A7 ist ein Eingabefehler: kein A7 im Abbild', !JSON.stringify(p.kern.abbild()).includes(KT.A7));
    const teile = [e.clientId, e.clientSecret, e.clientId.trim(), e.clientSecret.trim(), 'id-test', 'geheim']
      .flatMap((w) => [w, ...w.split(/\s+/)]).filter((w) => w.length >= 3);
    ck('… weder ID noch Secret (auch getrimmt oder in Teilen) in einer Logzeile',
      !p.logs.some((z) => teile.some((w) => z.includes(w))));
    await p.aufraeumen();
  }
}
{
  const p = baueKern({ zugang: { daten: null, herkunft: 'none' }, speichernLiefert: 'session' });
  ck('ohne Schlüsselbund → ok, Herkunft session, Text A4, Log „nur für diese Sitzung“',
    ok(p.kern.zugangEintragen({ clientId: 'id-test-9876', clientSecret: 'geheim-test' })) && p.kern.abbild().einrichtung.zugang.herkunft === 'session'
    && p.kern.abbild().einrichtung.zugang.text === KT.A4 && p.logs.includes('[zoom] Zugangsdaten hinterlegt (von Hand, nur für diese Sitzung)'));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_AUTH_CODE: '2' }) });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Vorbereitung: Zustand fehler (B9)', p.kern.kurz().zustand === 'fehler' && p.kern.abbild().meldung !== null);
  const r = p.kern.zugangEintragen({ clientId: 'id-test-1111', clientSecret: 'geheim-test' });
  ck('im Zustand fehler: zuerst schließen, dann speichern → bereit, Meldung weg',
    ok(r) && p.zugangGespeichert.length === 1 && p.kern.kurz().zustand === 'bereit' && p.kern.abbild().meldung === null);
  await p.aufraeumen();
}
{
  const p = baueKern();
  ck('Vorbereitung: im Meeting', await insMeeting(p));
  const r = p.kern.zugangEintragen({ clientId: 'id-test-2222', clientSecret: 'geheim-test' });
  ck('während Zoom läuft → S10, nichts gespeichert, Zustand bleibt', text(r) === KT.S10 && p.zugangGespeichert.length === 0
    && p.kern.kurz().zustand === 'im_meeting');
  await p.aufraeumen();
}
{
  const MiB = 1024 * 1024;
  let freigabe: (e: EinrichtungsErgebnis) => void = () => {};
  const p = baueKern({
    laufzeit: {
      pruefe: () => ({ ok: false, mangel: 'sdk_fehlt' }),
      pruefeOrdner: () => ({ ok: true, bin: 'C:/SDK/x64/bin', fassung: SDK_FASSUNG, dateien: [{ pfad: 'sdk.dll', bytes: MiB }], bytesGesamt: MiB }),
      richteEin: () => new Promise<EinrichtungsErgebnis>((resolve) => {
        freigabe = resolve;
      }),
    },
  });
  const lauf = p.kern.sdkWaehlen('C:/SDK');
  ck('während der SDK-Kopie → S10, nichts gespeichert',
    text(p.kern.zugangEintragen({ clientId: 'id-test-3333', clientSecret: 'geheim-test' })) === KT.S10 && p.zugangGespeichert.length === 0);
  freigabe({ ok: false, text: KT.S6('EIO') });
  await lauf;
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

console.log('— Fix-Runde 1: Diagnosen der Laufzeit ins Log (Spec 8.7)');
{
  const p = baueKern({ laufzeit: { pruefe: () => ({ ok: false, mangel: 'sdk_defekt', datei: 'zoom-bridge.exe', detail: 'EBUSY' }) } });
  ck('Startprüfung: detail steht im Log', p.logs.includes('[zoom] Laufzeit defekt: zoom-bridge.exe (EBUSY)'));
  await p.aufraeumen();
}
{
  const p = baueKern({ laufzeit: { pruefe: () => ({ ok: true, ordner: 'x', ersetzt: ['zoom-bridge.exe'] }) } });
  ck('Startprüfung: ersetzte Dateien stehen im Log', p.logs.includes('[zoom] Eigene Dateien ersetzt: zoom-bridge.exe'));
  await p.aufraeumen();
}
{
  let aufrufe = 0;
  const p = baueKern({
    laufzeit: {
      pruefe: () => (++aufrufe === 1
        ? { ok: false, mangel: 'sdk_fehlt' }
        : { ok: false, mangel: 'sdk_defekt', datei: 'sdk.dll', detail: 'EPERM' }),
      pruefeOrdner: () => ({ ok: true, bin: 'C:/SDK/x64/bin', fassung: SDK_FASSUNG, dateien: [{ pfad: 'sdk.dll', bytes: 1 }], bytesGesamt: 1 }),
      richteEin: async (e) => ({
        ok: true, ordner: e.pfade.basis,
        stempel: { format: 1, sdkFassung: SDK_FASSUNG, eingerichtetAm: '2026-10-02T10:00:00.000Z', sdkDateien: [], eigeneDateien: [] },
        aufraeumFehler: 'EBUSY',
      }),
    },
  });
  await p.kern.sdkWaehlen('C:/SDK');
  ck('Einrichtung: aufraeumFehler steht im Log', p.logs.includes('[zoom] Aufräumen nach der Einrichtung unvollständig (EBUSY)'));
  ck('… Prüfung nach der Einrichtung: detail steht im Log', p.logs.includes('[zoom] Laufzeit defekt: sdk.dll (EPERM)'));
  await p.aufraeumen();
}

// ── Aufgabe 11: Startfolge, Generationen, „Einrichtung prüfen“ ──────────────
console.log('— Einrichtung prüfen (Fall 24, 28), Startfolge S-d');
{
  const p = baueKern({ versatzMs: 120 });
  const lauf = p.kern.pruefen();
  ck('Fall 24: während der Prüfung Zustand bereit, pruefungLaeuft, laeuft()',
    p.kern.kurz().zustand === 'bereit' && p.kern.abbild().pruefungLaeuft && p.kern.laeuft());
  ck('… zweiter Aufruf während der Prüfung → ok:false ohne Text', text(await p.kern.pruefen()) === '');
  ck('… Einrichtung währenddessen gesperrt (S10)', text(p.kern.einrichtungSperre()) === KT.S10);
  const r = await lauf;
  const m = p.kern.abbild().meldung;
  ck('Fall 24: Ergebnis ok, Meldung info mit „7.1.5“', ok(r) && m?.art === 'info' && m.text === KT.PRUEFUNG_OK && m.text.includes('7.1.5'));
  ck('… danach bereit, keine Prüfung, keine Bridge', p.kern.kurz().zustand === 'bereit' && !p.kern.abbild().pruefungLaeuft && !p.kern.laeuft());
  ck('… der Zustand war durchgehend bereit', p.kurze.every((k) => k.zustand === 'bereit'));
  ck('… Befehle init, auth, videoDelay, quit — kein join', cmds(p, 1).join(',') === 'init,auth,videoDelay,quit');
  const c = p.befehle(1);
  ck('… videoDelay mit dem gespeicherten Versatz (120)', c[2].ms === 120);
  const teile = String(c[1].jwt ?? '').split('.');
  const nutzlast = teile.length === 3 ? (JSON.parse(Buffer.from(teile[1], 'base64url').toString('utf8')) as { iat: number; exp: number }) : null;
  ck('… JWT gilt 12 h (JWT_GUELTIG_S)', nutzlast !== null && nutzlast.exp - nutzlast.iat === 43_200);
  ck('… das JWT steht nirgends im Log', !p.logs.some((z) => z.includes(String(c[1].jwt))));
  ck('6.9: Ereignisse der gestoppten Bridge stehen nur im Log', p.logs.includes('[zoom] (Abbau) bye'));
  p.kern.meldungWeg();
  ck('Fall 28: meldungWeg → Meldung weg, Zustand bereit', p.kern.abbild().meldung === null && p.kern.kurz().zustand === 'bereit');
  await p.aufraeumen();
}
{
  const p = baueKern({ versatzMs: 2000 });
  await p.kern.pruefen();
  ck('gespeicherter Versatz außerhalb 0–1000 → videoDelay 0', p.befehle(1)[2]?.cmd === 'videoDelay' && p.befehle(1)[2]?.ms === 0);
  await p.aufraeumen();
}

console.log('— Startfolge: Fehler (Fall 24b, 7, 6, B9, S9) und Umgebung (Fall 4)');
{
  const p = baueKern({ stell: () => ({ FAKE_AUTH_SOFORTFEHLER: '3' }) });
  const t0 = Date.now();
  const r = await p.kern.pruefen();
  ck('Fall 24b: Sofortfehler der Anmeldung → B18 binnen 1 s (nicht B16)',
    text(r) === KT.B18('SDKERR_INVALID_PARAMETER') && Date.now() - t0 < 1000);
  ck('… Meldung fehler, Zustand bereit, Bridge beendet',
    p.kern.abbild().meldung?.art === 'fehler' && p.kern.kurz().zustand === 'bereit' && !p.kern.laeuft());
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_NDI_FEHLER: '1' }) });
  const r = await p.kern.pruefen();
  ck('Fall 24b: ndiInitFailed → Q7, nicht „Einrichtung in Ordnung“', text(r) === KT.Q7 && p.kern.abbild().meldung?.text === KT.Q7);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_SDK_FASSUNG: '7.1.6 (99999)' }) });
  const r = await p.kern.pruefen();
  ck('Fall 7: falsche SDK-Fassung → B7', text(r) === KT.B7('7.1.6 (99999)'));
  ck('… Bridge gestoppt, kein join', !p.kern.laeuft() && !cmds(p).includes('join'));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_AUTH_CODE: '2' }) });
  const r = await p.kern.pruefen();
  ck('Anmeldung abgelehnt (Code 2) → B9 mit AUTHRET_KEYORSECRETWRONG', text(r) === KT.B9('AUTHRET_KEYORSECRETWRONG'));
  ck('… detail AUTHRET_KEYORSECRETWRONG (2)', p.kern.abbild().meldung?.detail === 'AUTHRET_KEYORSECRETWRONG (2)');
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_INIT_FEHLER: '1' }) });
  const r = await p.kern.pruefen();
  ck('init scheitert → B8 (der spätere auth-Fehler ändert nichts)', text(r) === KT.B8('SDKERR_WRONG_USAGE'));
  ck('… der spätere Fehler steht nur als (Abbau) im Log', p.logs.some((z) => z.startsWith('[zoom] (Abbau) Fehler where=auth')));
  await p.aufraeumen();
}
{
  let n = 0;
  const p = baueKern({
    laufzeit: { pruefe: () => (++n === 1 ? { ok: true, ordner: 'C:/laufzeit', ersetzt: [] } : { ok: false, mangel: 'sdk_defekt', datei: 'sdk.dll' }) },
  });
  const r = await p.kern.pruefen();
  ck('Laufzeit vor dem Start defekt → S9, Zustand einrichtung', text(r) === KT.S9('sdk.dll') && p.kern.kurz().zustand === 'einrichtung'
    && JSON.stringify(p.kern.kurz().maengel) === '["sdk_defekt"]');
  ck('… Meldung S9 im Abbild, keine Bridge gestartet', p.kern.abbild().meldung?.text === KT.S9('sdk.dll') && p.starts() === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({ skript: 'stuck', fristen: { killTimeoutMs: 300 } });
  const r = await p.kern.pruefen();
  ck('Drehbuch stuck meldet „7.1.5 (attrappe)“ → B7', text(r) === KT.B7('7.1.5 (attrappe)'));
  ck('… stop() endet per Kill → Log „Zoom-Bridge hart beendet“', p.logs.includes('[zoom] Zoom-Bridge hart beendet') && !p.kern.laeuft());
  await p.aufraeumen();
}
{
  process.env.ZOOM_SDK_CLIENT_SECRET = 'PROBE-SECRET-AUS-DER-UMGEBUNG';
  const geerbt = process.env.PATH ?? '';
  const p = baueKern({
    skript: 'envprobe',
    stell: () => ({ ENV_PROBE_NAMES: 'ZOOM_SDK_CLIENT_ID,ZOOM_SDK_CLIENT_SECRET,ZOOM_SDK_CREDENTIALS' }),
    fristen: { anmeldeMs: 500 },
  });
  const r = await p.kern.pruefen();
  delete process.env.ZOOM_SDK_CLIENT_SECRET;
  const probe = p.ereignisse.find((x) => x.ev.ev === 'envprobe')?.ev as unknown as { seen: Record<string, boolean>; path?: string } | undefined;
  ck('Fall 4: die Attrappe hat ihre Umgebung gemeldet', probe !== undefined);
  ck('… keine der drei ZOOM_SDK_*-Variablen beim Kind',
    probe !== undefined && Object.keys(probe.seen).length === 3 && Object.values(probe.seen).every((v) => v === false));
  const pfad = probe?.path ?? '';
  const i = pfad.indexOf(p.ordner);
  ck('… PATH: Laufzeit-Ordner vor dem geerbten Wert, geerbter Wert vollständig', i >= 0 && pfad.indexOf(geerbt, i + p.ordner.length) > i);
  ck('… ohne Antwort auf die Anmeldung → B16', text(r) === KT.B16);
  await p.aufraeumen();
}
if (process.platform === 'win32') {
  const p = baueKern({ stell: () => ({ FAKE_SOFORT_ENDE: '0xC0000135' }) });
  const r = await p.kern.pruefen();
  ck('Fall 6: DLL-Tod beim Start → B3', text(r) === KT.B3);
  ck('… nennt nicht die Zugangsdaten als Ursache', !String(text(r)).includes('Client-ID oder Client-Secret stimmen nicht'));
  ck('… Bridge abgebaut', !p.kern.laeuft());
  await p.aufraeumen();
} else {
  ueberspringe('Fall 6: DLL-Tod beim Start → B3');
}

// ── Aufgabe 12: Beitritt bis im_meeting, Erlaubnis, Geheimnisse ──────────────
/** Beitritt mit NUMMER und `kenncode`; wartet auf im_meeting mit Erlaubnis „ja“. */
async function insMeeting(p: Probe, kenncode = KENNCODE): Promise<boolean> {
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode, anzeigename: 'JM Connect' });
  return r.ok && (await bis(() => p.kern.kurz().zustand === 'im_meeting' && p.kern.kurz().erlaubnis === 'ja'));
}

console.log('— Beitritt (Fall 1 zweiter Teil, 2, 5, 8, 24c), Review Focus 1 und 5');
{
  const p = baueKern({ zugang: { daten: null, herkunft: 'none' } });
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 1: Zugangsdaten fehlen → B17, keine Bridge', text(r) === KT.B17 && p.starts() === 0);
  ck('… Zustand einrichtung, STATE zoom_status=einrichtung', p.kern.kurz().zustand === 'einrichtung' && p.kern.stateKv()?.zoom_status === 'einrichtung');
  ck('… nichts im Arbeitsspeicher', !p.kern.abbild().erneutMoeglich);
  await p.aufraeumen();
}
{
  let n = 0;
  const p = baueKern({
    laufzeit: { pruefe: () => (++n === 1 ? { ok: true, ordner: 'C:/laufzeit', ersetzt: [] } : { ok: false, mangel: 'sdk_defekt', datei: 'sdk.dll' }) },
  });
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('5.3: Laufzeit beim Beitritt defekt → S9, Zustand einrichtung, keine Bridge',
    text(r) === KT.S9('sdk.dll') && p.kern.kurz().zustand === 'einrichtung' && p.starts() === 0);
  ck('… Nummer und Kenncode verworfen (kein „Erneut“), Meldung S9', !p.kern.abbild().erneutMoeglich && p.kern.abbild().meldung?.text === KT.S9('sdk.dll'));
  await p.aufraeumen();
}
{
  const p = baueKern({ versatzMs: 40 });
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: '  JM Connect  ' });
  ck('Fall 2: Beitritt angenommen, Anzeigename getrimmt gespeichert', ok(r) && p.einst.anzeigename === 'JM Connect');
  ck('… im_meeting mit Erlaubnis ja', await bis(() => p.kern.kurz().zustand === 'im_meeting' && p.kern.kurz().erlaubnis === 'ja'));
  const c = p.befehle(1);
  ck('… Befehlsfolge init, auth, videoDelay (40), join', c.slice(0, 4).map((x) => x.cmd).join(',') === 'init,auth,videoDelay,join' && c[2].ms === 40);
  ck('… join mit Nummer, Kenncode und Anzeigename', c[3].meetingId === NUMMER && c[3].passcode === KENNCODE && c[3].displayName === 'JM Connect');
  const t = p.kern.abbild().teilnehmer;
  ck('… Teilnehmer ohne eigene Zeile (100), Host zuerst', t.length === 2 && !t.some((x) => x.id === 100) && t[0].id === 16778240 && t[0].rolle === 'host');
  ck('… Zustandsfolge startet → tritt_bei → im_meeting', folge(p).join(',') === 'startet,tritt_bei,im_meeting');
  ck('… STATE im_meeting, privilege 1, alarm 0, erneutMoeglich',
    p.kern.stateKv()?.zoom_status === 'im_meeting' && p.kern.stateKv()?.zoom_privilege === 1 && p.kern.stateKv()?.zoom_alarm === 0 && p.kern.abbild().erneutMoeglich);
  ck('… Log „Beitritt gestartet (Anzeigename „JM Connect“)“', p.logs.includes('[zoom] Beitritt gestartet (Anzeigename „JM Connect“)'));
  ck('Fall 27: im Meeting → Zugang entfernen und SDK wählen → S10', text(p.kern.zugangLoeschen()) === KT.S10 && text(await p.kern.sdkWaehlen('C:/SDK')) === KT.S10);
  ck('… Zugangsdaten unverändert', p.kern.abbild().einrichtung.zugang.herkunft === 'stored' && p.kern.kurz().maengel.length === 0);
  ck('… beitreten und pruefen im Meeting → ok:false ohne Text',
    text(await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' })) === '' && text(await p.kern.pruefen()) === '');
  await p.aufraeumen();
}
{
  const p = baueKern();
  ck('Fall 3: im Meeting', await insMeeting(p));
  const alles = JSON.stringify(p.kern.abbild()) + JSON.stringify(p.kern.stateKv()) + JSON.stringify(p.kern.kurz());
  ck('Fall 3: Nummer und Kenncode weder im Abbild noch in STATE/Kurzform', !alles.includes(NUMMER) && !alles.includes(KENNCODE));
  const kernZeilen = p.logs.filter((z) => z.startsWith('[zoom] '));
  ck('… nicht in [zoom]-Zeilen', kernZeilen.length > 0 && !kernZeilen.some((z) => z.includes(NUMMER) || z.includes(KENNCODE)));
  const echo = p.logs.find((z) => z.startsWith('[zoom-bridge] ATTRAPPE empfing:') && z.includes('"join"'));
  ck('… die Echo-Zeile der Attrappe erscheint nur maskiert', echo !== undefined && echo.includes('•••') && !echo.includes(NUMMER) && !echo.includes(KENNCODE));
  ck('… keine Zeile enthält Nummer, Kenncode oder Secret', !p.logs.some((z) => z.includes(NUMMER) || z.includes(KENNCODE) || z.includes('test-secret')));
  await p.aufraeumen();
}
{
  const p = baueKern();
  ck('Fall 3 (leerer Kenncode): im Meeting', await insMeeting(p, ''));
  ck('… keine Zeile mit „•••“ zwischen Einzelzeichen', !p.logs.some((z) => /•••.•••/.test(z)));
  const echo = p.logs.find((z) => z.startsWith('[zoom-bridge] ATTRAPPE empfing:') && z.includes('"join"'));
  ck('… die Echo-Zeile ist lesbar, die Nummer maskiert', echo !== undefined && echo.includes('"passcode":""') && echo.includes('"meetingId":"•••"'));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_AUTH_CODE: '2' }) });
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 5: Anmeldung abgelehnt → B9, Zustand fehler', text(r) === KT.B9('AUTHRET_KEYORSECRETWRONG') && p.kern.kurz().zustand === 'fehler');
  ck('… kein join in der Befehlsfolge', !cmds(p).includes('join'));
  ck('… Meldung fehler, erneutMoeglich, STATE alarm 1',
    p.kern.abbild().meldung?.art === 'fehler' && p.kern.abbild().erneutMoeglich && p.kern.stateKv()?.zoom_alarm === 1);
  await p.aufraeumen();
}
{
  // Fall 7 über den Beitritt: nur hier kann „kein join“ rot werden („Einrichtung prüfen“ sendet nie join).
  const p = baueKern({ stell: () => ({ FAKE_SDK_FASSUNG: '7.1.6 (99999)' }) });
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 7 (Beitritt): falsche SDK-Fassung → B7, Zustand fehler', text(r) === KT.B7('7.1.6 (99999)') && p.kern.kurz().zustand === 'fehler');
  ck('… Bridge gestoppt, kein join in der Befehlsfolge', !p.kern.laeuft() && cmds(p).includes('init') && !cmds(p).includes('join'));
  await p.aufraeumen();
}
for (const code of [63, 503, 504, 4]) {
  const p = baueKern({ stell: () => ({ FAKE_BEITRITT_SCHEITERT: String(code) }) });
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  await bis(() => p.kern.kurz().zustand === 'fehler');
  const m = p.kern.abbild().meldung;
  const erwartet = code === 63 ? 'Beitritt gescheitert: Das Meeting gehört nicht zum Zoom-Konto dieser App. JM Connect kann nur Meetings im eigenen Zoom-Konto betreten. Bitte das Meeting im eigenen Konto anlegen.'
    : code === 4 ? 'Beitritt gescheitert: falscher Kenncode.'
    : 'Beitritt gescheitert: Zoom verlangt für dieses Meeting einen Beitritt im Namen eines angemeldeten Nutzers (OBF-Token). Das kann JM Connect nicht — nur Meetings im eigenen Zoom-Konto.';
  ck(`Fall 8 (Code ${code}): join gesendet, dann fehler mit dem Klartext`, ok(r) && p.kern.kurz().zustand === 'fehler' && m?.text === erwartet);
  ck(`… detail mit SDK-Namen und Code ${code}`, m?.detail?.endsWith(` (${code})`) === true && m.detail.startsWith('MEETING_FAIL_'));
  await warte(200);
  ck(`… kein zweiter Bridge-Start, erneutMoeglich (Code ${code})`, p.starts() === 1 && p.kern.abbild().erneutMoeglich);
  if (code === 4) {
    const e = await p.kern.erneut();
    // erneut() kehrt zurück, sobald join gesendet ist; die Attrappe schreibt den Befehl erst
    // danach in ihr Protokoll (eigener Prozess). Ohne Warten ein Wettlauf, rot im ersten
    // Linux-CI-Lauf am 2026-10-06.
    await bis(() => p.befehle(2).some((c) => c.cmd === 'join'));
    ck('erneut() nach fehler: neuer Start mit den Daten im Arbeitsspeicher', ok(e) && p.starts() === 2
      && p.befehle(2).find((c) => c.cmd === 'join')?.meetingId === NUMMER && p.befehle(2).find((c) => c.cmd === 'join')?.passcode === KENNCODE);
  }
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_AUTH_SOFORTFEHLER: '3' }) });
  const t0 = Date.now();
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 24c: Sofortfehler → fehler mit B18 binnen 1 s', text(r) === KT.B18('SDKERR_INVALID_PARAMETER') && p.kern.kurz().zustand === 'fehler' && Date.now() - t0 < 1000);
  ck('… kein join', !cmds(p).includes('join'));
  await p.aufraeumen();
}
{
  const p = baueKern();
  ck('erneut() ohne gemerkte Nummer → ok:false ohne Text, keine Bridge', text(await p.kern.erneut()) === '' && p.starts() === 0);
  const erster = p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  const zweiter = await p.kern.beitreten({ nummer: NUMMER, kenncode: 'KENNCODE-PROBE-ZWEI', anzeigename: 'Zweiter Name' });
  ck('Review Focus 1: zweiter Klick während startet → ok:false ohne Text', text(zweiter) === '');
  ck('… erster Beitritt läuft weiter', ok(await erster) && (await bis(() => p.kern.kurz().zustand === 'im_meeting')));
  ck('… genau eine Bridge, join mit den Daten des ersten Aufrufs', p.starts() === 1
    && p.befehle(1).filter((c) => c.cmd === 'join').length === 1 && p.befehle(1).find((c) => c.cmd === 'join')?.passcode === KENNCODE
    && p.einst.anzeigename === 'JM Connect');
  await p.aufraeumen();
}
{
  const p = baueKern();
  const r1 = await p.kern.beitreten({ nummer: '12a45', kenncode: KENNCODE, anzeigename: 'JM Connect' });
  const r2 = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: '   ' });
  const r2leer = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: '' });
  const r3 = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'x'.repeat(65) });
  ck('Review Focus 5: Nummer mit Buchstaben → N0', text(r1) === KT.N0);
  ck('… Anzeigename leer oder nur Leerzeichen → N0b, 65 Zeichen → N0b', text(r2) === KT.N0b && text(r2leer) === KT.N0b && text(r3) === KT.N0b);
  ck('… keine Bridge, Zustand unverändert, nichts gespeichert', p.starts() === 0 && p.kern.kurz().zustand === 'bereit'
    && !p.kern.abbild().erneutMoeglich && p.einst.anzeigename === 'JM Connect');
  ck('… weder Nummer noch Kenncode in Text oder Log',
    ![text(r1), text(r2), text(r2leer), text(r3), ...p.logs].some((z) => (z ?? '').includes(NUMMER) || (z ?? '').includes(KENNCODE) || (z ?? '').includes('12a45')));
  ck('… 64 Zeichen sind erlaubt', ok(await p.kern.beitreten({ nummer: NUMMER, kenncode: '', anzeigename: 'x'.repeat(64) })));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_PRIVILEGE: 'nein' }) });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 10: Erlaubnis abgelehnt → Z7', await bis(() => p.kern.kurz().erlaubnis === 'abgelehnt') && zoomZ(p.kern.kurz()) === 'Z7');
  ck('… STATE zoom_alarm=1, zoom_privilege=0', p.kern.stateKv()?.zoom_alarm === 1 && p.kern.stateKv()?.zoom_privilege === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_PRIVILEGE: 'offen' }) });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Erlaubnis angefragt, keine Antwort → Z6, alarm 0',
    await bis(() => p.kern.kurz().zustand === 'im_meeting') && (await warte(200), zoomZ(p.kern.kurz()) === 'Z6') && p.kern.stateKv()?.zoom_alarm === 0);
  await p.aufraeumen();
}

// ── Aufgabe 13: Warteraum, Abriss (4a), Meeting-Ende, Verlassen, Beenden ─────
console.log('— Warteraum und Einlass (Fall 9, 9b, 9c)');
{
  const p = baueKern({ stell: () => ({ FAKE_WARTERAUM: '1' }), fristen: { joinTimeoutMs: 500 } });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 9: im Warteraum (Z5a)', await bis(() => p.kern.kurz().zustand === 'warteraum') && zoomZ(p.kern.kurz()) === 'Z5a');
  await warte(1000);
  ck('… nach 1 s noch im Warteraum, keine Meldung', p.kern.kurz().zustand === 'warteraum' && p.kern.abbild().meldung === null);
  ck('… STATE warteraum, alarm 0', p.kern.stateKv()?.zoom_status === 'warteraum' && p.kern.stateKv()?.zoom_alarm === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_WARTERAUM: '1', FAKE_EINLASS_MS: '300' }) });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 9b: Einlass → im_meeting', await bis(() => p.kern.kurz().zustand === 'im_meeting'));
  ck('… Folge warteraum → tritt_bei → im_meeting', folge(p).join(',').endsWith('warteraum,tritt_bei,im_meeting'));
  ck('… nie abriss, zoom_alarm nie 1', !folge(p).includes('abriss') && p.kurze.every((k) => stateKvAus(k)?.zoom_alarm !== 1));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_WARTERAUM: '1', FAKE_EINLASS_MS: '300', FAKE_EINLASS_HAENGT: '1' }), fristen: { joinTimeoutMs: 500 } });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Fall 9c: Einlass hängt → fehler', await bis(() => p.kern.kurz().zustand === 'fehler'));
  ck('… mit CE, erneutMoeglich', p.kern.abbild().meldung?.text === KT.CE && p.kern.abbild().erneutMoeglich);
  await p.aufraeumen();
}

console.log('— Meeting-Ende (Fall 19, 28), Beenden (Fall 20)');
{
  const p = baueKern({ stell: () => ({ FAKE_MEETING_ENDE_MS: '400' }) });
  ck('Fall 19: im Meeting', await insMeeting(p));
  ck('… nach dem Ende bereit mit Meldung', await bis(() => p.kern.kurz().zustand === 'bereit' && p.kern.abbild().meldung !== null));
  const a = p.kern.abbild();
  ck('… Meldung genau „Meeting beendet: vom Gastgeber beendet.“ (warnung)', a.meldung?.text === 'Meeting beendet: vom Gastgeber beendet.' && a.meldung.art === 'warnung');
  ck('… erneutMoeglich, Soll-Liste leer', a.erneutMoeglich && a.soll.length === 0 && a.kurz.sollOffen === 0);
  await warte(300);
  ck('… kein Wiederbeitritt (eine Bridge), STATE bereit/alarm 0', p.starts() === 1 && p.kern.stateKv()?.zoom_status === 'bereit' && p.kern.stateKv()?.zoom_alarm === 0);
  p.kern.schliessen();
  ck('… Schließen → Meldung weg, erneutMoeglich false', p.kern.abbild().meldung === null && !p.kern.abbild().erneutMoeglich);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_MEETING_ENDE_MS: '400' }) });
  await insMeeting(p);
  await bis(() => p.kern.abbild().meldung !== null);
  p.kern.meldungWeg();
  ck('Fall 28: meldungWeg nach Meeting-Ende → Meldung weg, Nummer bleibt (erneutMoeglich)', p.kern.abbild().meldung === null && p.kern.abbild().erneutMoeglich);
  ck('… erneut() startet eine neue Bridge', ok(await p.kern.erneut()) && p.starts() === 2);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ABGANG_MS: '200' }) });
  await insMeeting(p);
  const t0 = Date.now();
  await p.kern.beenden(15_000);
  const dauer = Date.now() - t0;
  ck('Fall 20: beenden → quit gesendet, Ende vor der Frist', cmds(p, 1).includes('quit') && dauer < 15_000 && dauer >= 150);
  ck('… Zustand verlaesst, nichts läuft mehr', p.kern.kurz().zustand === 'verlaesst' && !p.kern.laeuft() && p.kern.kurz().quellen === 0);
  ck('… kein „nicht rechtzeitig“ im Log', !p.logs.includes('[zoom] Zoom-Bridge nicht rechtzeitig beendet'));
  await p.aufraeumen();
}
{
  const p = baueKern({ skript: 'stuck', fristen: { killTimeoutMs: 300 } });
  const lauf = p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  const t0 = Date.now();
  await p.kern.beenden(15_000);
  ck('Fall 20 (stuck): Ende per Kill nach killTimeoutMs', Date.now() - t0 < 2000 && p.logs.includes('[zoom] Zoom-Bridge hart beendet'));
  ck('… der abgebrochene Beitritt liefert ok:false ohne Text', text(await lauf) === '');
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ABGANG_MS: '5000' }), fristen: { killTimeoutMs: 10_000 } });
  await insMeeting(p);
  const t0 = Date.now();
  await p.kern.beenden(300);
  ck('beenden mit kurzer Frist → kehrt nach der Frist zurück, Log „nicht rechtzeitig“',
    Date.now() - t0 < 1500 && p.logs.includes('[zoom] Zoom-Bridge nicht rechtzeitig beendet'));
  await p.aufraeumen();
}

console.log('— Verlassen (Fall 26, Review Focus 2) und Abriss in 4a');
{
  const p = baueKern();
  await insMeeting(p);
  const vorher = p.kurze.length;
  await p.kern.verlassen();
  const danach = p.kurze.slice(vorher);
  ck('Review Focus 2: Verlassen → verlaesst, dann bereit', danach.map((k) => k.zustand).join(',').startsWith('verlaesst') && p.kern.kurz().zustand === 'bereit');
  ck('… keine Meldung, kein „Meeting beendet“, erneutMoeglich false',
    p.kern.abbild().meldung === null && !p.logs.some((z) => z.includes('Meeting beendet')) && !p.kern.abbild().erneutMoeglich);
  ck('… zoom_alarm blieb 0', danach.every((k) => k.zustand !== 'fehler') && p.kern.stateKv()?.zoom_alarm === 0);
  ck('… das ended der stoppenden Bridge steht nur im Log', p.logs.some((z) => z.startsWith('[zoom] (Abbau) status ended')));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_VERBINDUNG_HAENGT_MS: '200' }), fristen: { joinTimeoutMs: 20_000 } });
  await insMeeting(p);
  ck('Fall 26: Zoom verbindet neu → abriss (Z10)', await bis(() => p.kern.kurz().zustand === 'abriss') && zoomZ(p.kern.kurz()) === 'Z10');
  ck('… Abbild abriss { versuch: null, versuche: 5, naechsterUm: null }, STATE alarm 1',
    JSON.stringify(p.kern.abbild().abriss) === '{"versuch":null,"versuche":5,"naechsterUm":null}' && p.kern.stateKv()?.zoom_alarm === 1);
  await p.kern.verlassen();
  ck('… Verlassen → bereit, keine Meldung, kein fehler, alarm 0', p.kern.kurz().zustand === 'bereit' && p.kern.abbild().meldung === null
    && !folge(p).includes('fehler') && p.kern.stateKv()?.zoom_alarm === 0);
  ck('… Soll-Liste, Nummer und Kenncode leer', p.kern.abbild().soll.length === 0 && !p.kern.abbild().erneutMoeglich);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_VERBINDUNG_WEG_MS: '300' }) });
  await insMeeting(p);
  ck('4a: Verbindung weg → fehler', await bis(() => p.kern.kurz().zustand === 'fehler'));
  ck('… „Verbindung verloren: Wiederverbinden fehlgeschlagen (Code 2).“',
    p.kern.abbild().meldung?.text === 'Verbindung verloren: Wiederverbinden fehlgeschlagen (Code 2).');
  ck('… vorher abriss, erneutMoeglich', folge(p).join(',').endsWith('abriss,fehler') && p.kern.abbild().erneutMoeglich);
  await warte(300);
  ck('… kein Wiederbeitritt in 4a (eine Bridge)', p.starts() === 1 && p.kern.kurz().zustand === 'fehler');
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ABSTURZ_MS: '200' }) });
  await insMeeting(p);
  ck('4a: Absturz im Meeting → fehler', await bis(() => p.kern.kurz().zustand === 'fehler'));
  const absturz = p.ereignisse.find((x) => x.ev.ev === 'error' && (x.ev as { where?: string }).where === 'exit')?.ev as { detail?: string } | undefined;
  ck('… Text „Verbindung verloren: Die Zoom-Bridge ist abgestürzt (…). Details im Log.“',
    absturz !== undefined && p.kern.abbild().meldung?.text === 'Verbindung verloren: ' + KT.UE_ABSTURZ(String(absturz.detail)));
  ck('… erneutMoeglich, eine Bridge', p.kern.abbild().erneutMoeglich && p.starts() === 1);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_VERBINDUNG_HAENGT_MS: '100' }), fristen: { joinTimeoutMs: 300 } });
  await insMeeting(p);
  ck('4a: Neuverbindung hängt → fehler', await bis(() => p.kern.kurz().zustand === 'fehler'));
  const m = p.kern.abbild().meldung;
  ck('… Text Verbindung verloren + UE_RECONNECT, detail RECONNECT_TIMEOUT', m?.text === 'Verbindung verloren: ' + KT.UE_RECONNECT
    && m.detail === 'RECONNECT_TIMEOUT (reconnectTimeout)');
  await warte(400);
  ck('… das ended der stoppenden Bridge ändert nichts (kein R6, weiter fehler)',
    p.kern.kurz().zustand === 'fehler' && p.kern.abbild().meldung?.text === 'Verbindung verloren: ' + KT.UE_RECONNECT);
  await p.aufraeumen();
}
{
  const p = baueKern();
  const lauf = p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  await p.kern.verlassen();
  ck('Verlassen während startet → bereit, keine Meldung', p.kern.kurz().zustand === 'bereit' && p.kern.abbild().meldung === null);
  ck('… der Beitritt liefert ok:false ohne Text', text(await lauf) === '');
  await warte(300);
  ck('… auch danach bereit, kein join, eine Bridge', p.kern.kurz().zustand === 'bereit' && !cmds(p).includes('join') && p.starts() === 1);
  await p.aufraeumen();
}

// ── Aufgabe 14: Quellen, Laden/Entladen, Ton, Versatz, Kollision ─────────────
const ANNA = 16778240;
const BEN = 16778241;
const CARLA = 16778242;
function zeile(p: Probe, id: number): ZoomAbbild['teilnehmer'][number] | undefined {
  return p.kern.abbild().teilnehmer.find((t) => t.id === id);
}

console.log('— Laden und Entladen (Fall 10, 10b, 11, 12)');
{
  const p = baueKern({ stell: () => ({ FAKE_PRIVILEGE: 'nein' }) });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  await bis(() => p.kern.kurz().erlaubnis === 'abgelehnt');
  ck('Fall 10: Laden ohne Erlaubnis → Q1, kein videoSubscribe',
    text(await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false })) === KT.Q1 && !cmds(p).includes('videoSubscribe'));
  await p.aufraeumen();
}
{
  const p = baueKern();
  ck('Laden außerhalb des Meetings → ok:false ohne Text', text(await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false })) === '');
  await insMeeting(p);
  ck('Laden eines Unbekannten → Q2', text(await p.kern.laden({ id: 4242, ton: true, trotzBetriebsgroesse: false })) === KT.Q2);
  ck('Ton-Schalter Ben aus (ohne Quelle) → ok, nur Bens Zeile', ok(p.kern.ton({ id: BEN, an: false }))
    && zeile(p, BEN)?.tonVorwahl === false && zeile(p, ANNA)?.tonVorwahl === true);
  const r = await p.kern.laden({ id: BEN, ton: zeile(p, BEN)?.tonVorwahl ?? true, trotzBetriebsgroesse: false });
  // laden() kehrt nach dem Senden zurück; die Attrappe protokolliert im eigenen Prozess danach
  // (Wettlauf, rot im Linux-CI-Lauf am 2026-10-06).
  await bis(() => p.befehle(1).some((c) => c.cmd === 'videoSubscribe'));
  const sub = p.befehle(1).find((c) => c.cmd === 'videoSubscribe');
  ck('Fall 11: videoSubscribe mit 720p und Ton nach Schalter (aus)', ok(r) && sub?.id === BEN && sub.resolution === '720p' && sub.audio === false);
  ck('… Quelle „JM Connect – Zoom Ben“, ohne Ton geladen', await bis(() => zeile(p, BEN)?.quelle?.ndiName === 'JM Connect – Zoom Ben')
    && (await bis(() => zeile(p, BEN)?.quelle?.ton === 'aus')));
  ck('… STATE zoom_sources=1, zoom_live=1, Z9b (erstes Bild steht aus)', p.kern.stateKv()?.zoom_sources === 1 && p.kern.stateKv()?.zoom_live === 1
    && zoomZ(p.kern.kurz()) === 'Z9b');
  ck('Ton-Schalter bei geladener Quelle → Q14', text(p.kern.ton({ id: BEN, an: true })) === KT.Q14);
  ck('Entladen → ok', ok(await p.kern.entladen({ aboId: BEN })));
  ck('… Quelle weg, STATE zoom_sources=0, zoom_live=0',
    (await bis(() => p.kern.kurz().quellen === 0)) && p.kern.stateKv()?.zoom_sources === 0 && p.kern.stateKv()?.zoom_live === 0);
  ck('Entladen einer unbekannten Quelle → Q2', text(await p.kern.entladen({ aboId: 4242 })) === KT.Q2);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ENTZUG_MS: '200' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Fall 10b: Anna geladen', await bis(() => p.kern.kurz().quellen === 1));
  ck('… Erlaubnis entzogen', await bis(() => p.kern.kurz().erlaubnis === 'entzogen'));
  ck('… Z7b mit „vom Host entzogen“', zoomZ(p.kern.kurz()) === 'Z7b' && String(kartenZeile(p.kern.abbild(), Date.now())).includes('vom Host entzogen'));
  await p.kern.entladen({ aboId: ANNA });
  await bis(() => p.kern.kurz().quellen === 0);
  const zeileZ7 = String(kartenZeile(p.kern.abbild(), Date.now()));
  ck('… nach dem Entladen Z7 mit „Der Host hat sie entzogen.“, nicht Z6', zoomZ(p.kern.kurz()) === 'Z7' && zeileZ7.includes('Der Host hat sie entzogen.'));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_TEILNEHMER: '6' }) });
  await insMeeting(p);
  const ids = p.kern.abbild().teilnehmer.map((t) => t.id);
  for (const id of ids.slice(0, 5)) await p.kern.laden({ id, ton: true, trotzBetriebsgroesse: false });
  ck('Fall 12: fünf Quellen geladen', ids.length === 6 && (await bis(() => p.kern.kurz().quellen === 5)));
  const sechs = await p.kern.laden({ id: ids[5], ton: true, trotzBetriebsgroesse: false });
  ck('… die 6. ohne trotzBetriebsgroesse → Q9 mit „6.“', text(sechs) === KT.Q9(6));
  ck('… mit trotzBetriebsgroesse geladen', ok(await p.kern.laden({ id: ids[5], ton: true, trotzBetriebsgroesse: true }))
    && (await bis(() => p.kern.kurz().quellen === 6)));
  await p.aufraeumen();
}

console.log('— Doppelname, Versatz, Kollision, Q8 (Fall 13, 21, 23)');
{
  const p = baueKern({ stell: () => ({ FAKE_DOPPELNAME: '1' }) });
  await insMeeting(p);
  ck('Fall 13: beide „Anna“ tragen doppelname', zeile(p, ANNA)?.doppelname === true && zeile(p, BEN)?.doppelname === true && zeile(p, BEN)?.name === 'Anna');
  p.kern.ton({ id: BEN, an: false });
  ck('… Ton der einen umschalten ändert die andere nicht', zeile(p, BEN)?.tonVorwahl === false && zeile(p, ANNA)?.tonVorwahl === true);
  await p.aufraeumen();
}
{
  const p = baueKern();
  await insMeeting(p);
  const vorher = cmds(p, 1).filter((c) => c === 'videoDelay').length;
  ck('Fall 21: 1001 → Q13', text(p.kern.versatz({ ms: 1001 })) === KT.Q13);
  ck('… 1.5 → Q13', text(p.kern.versatz({ ms: 1.5 })) === KT.Q13);
  await warte(100);
  ck('… dabei kein videoDelay gesendet, nichts gespeichert', cmds(p, 1).filter((c) => c === 'videoDelay').length === vorher && p.einst.versatzMs === 0);
  ck('… 250 → ok', ok(p.kern.versatz({ ms: 250 })));
  ck('… videoDelay 250 gesendet und bestätigt', await bis(() => p.kern.abbild().versatz.bestaetigtMs === 250)
    && p.befehle(1).filter((c) => c.cmd === 'videoDelay').at(-1)?.ms === 250);
  ck('… gespeichert', p.einst.versatzMs === 250 && p.kern.abbild().versatz.gewuenschtMs === 250);
  await p.aufraeumen();
}
{
  let labels: string[] = [];
  const p = baueKern({ gastLabels: () => labels });
  await insMeeting(p);
  ck('ohne Gast-Label keine Kollision', zeile(p, ANNA)?.kollision === null);
  labels = ['JM Connect – zoom anna'];
  p.kern.gastLabelsGeaendert();
  ck('Fall 23: Gast „JM Connect – zoom anna“ → Annas Zeile trägt Q10', zeile(p, ANNA)?.kollision === KT.Q10('JM Connect – Zoom Anna') && zeile(p, BEN)?.kollision === null);
  const vorher = p.abbilder.length;
  p.kern.gastLabelsGeaendert();
  ck('… gastLabelsGeaendert() stößt ein Abbild an', await bis(() => p.abbilder.length > vorher, 500));
  await p.aufraeumen();
}
{
  const p = baueKern({ sendeFilter: (c) => c.cmd !== 'videoSubscribe', fristen: { aboAntwortMs: 300 } });
  await insMeeting(p);
  ck('Q8: Laden ohne Antwort der Bridge → ok', ok(await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false })));
  ck('… nach aboAntwortMs trägt Annas Zeile Q8', await bis(() => zeile(p, ANNA)?.fehler === KT.Q8, 1500));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_ABSTURZ_MS: '400' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('6.9: Quelle geladen, dann stürzt die Bridge ab → fehler', (await bis(() => p.kern.kurz().quellen === 1))
    && (await bis(() => p.kern.kurz().zustand === 'fehler')));
  ck('… ohne unsubscribed verwirft der Kern nach stop() die Quellen dieser Generation (n = 0, zoom_live=0)',
    (await bis(() => p.kern.kurz().quellen === 0)) && p.kern.stateKv()?.zoom_live === 0);
  await p.aufraeumen();
}

// ── Aufgabe 15: Soll-Liste und Abgleich ──────────────────────────────────────
console.log('— Teilnehmer-Wiederbeitritt (Fall 14, 14b)');
{
  const p = baueKern({ stell: () => ({ FAKE_WIEDERBEITRITT_MS: '600', FAKE_RUECKKEHR_MS: '200' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  ck('Fall 14: Anna geladen', await bis(() => p.kern.kurz().quellen === 1));
  ck('… beim Weggang black/participantLeft, Soll-Stand verwaist', await bis(() => p.kern.abbild().soll[0]?.stand === 'verwaist', 2000)
    && p.kern.abbild().soll[0]?.aboId === ANNA && p.kern.kurz().sollOffen === 1);
  ck('… danach hängt die Quelle unter 16778250 (reboundByName)', await bis(() => zeile(p, 16778250)?.quelle?.bildGrund === 'reboundByName', 2000));
  await warte(600);
  const c = cmds(p, 1);
  ck('… Connect sendet weder videoUnsubscribe noch ein zweites videoSubscribe',
    !c.includes('videoUnsubscribe') && c.filter((x) => x === 'videoSubscribe').length === 1);
  ck('… eine Quelle, Soll-Liste erfüllt', p.kern.kurz().quellen === 1 && p.kern.kurz().sollOffen === 0);
  await p.aufraeumen();
}
{
  let abgemeldetVorNeuemAbo: boolean | null = null;
  const p: Probe = baueKern({
    stell: () => ({ FAKE_WIEDERBEITRITT_MS: '600', FAKE_RUECKKEHR_MS: '200', FAKE_RUECKKEHR_NAME: 'anna' }),
    // Hält fest, ob das alte Abo schon abgemeldet war, als das neue gesendet wurde (neuLaden im Abgleich).
    sendeFilter: (c) => {
      if (c.cmd === 'videoSubscribe' && c.id === 16778250) {
        abgemeldetVorNeuemAbo = p.ereignisse.some((x) => x.ev.ev === 'video'
          && (x.ev as { id?: number }).id === 16778240 && (x.ev as { state?: string }).state === 'unsubscribed');
      }
      return true;
    },
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: false, trotzBetriebsgroesse: false });
  await bis(() => p.kern.kurz().quellen === 1);
  const alterName = zeile(p, ANNA)?.quelle?.ndiName ?? '';
  ck('Fall 14b: „anna“ kommt zurück', await bis(() => zeile(p, 16778250) !== undefined, 2000));
  ck('… Connect lädt neu: genau ein videoUnsubscribe (16778240) und ein videoSubscribe (16778250)',
    await bis(() => p.befehle(1).some((x) => x.cmd === 'videoSubscribe' && x.id === 16778250), 2000)
    && p.befehle(1).filter((x) => x.cmd === 'videoUnsubscribe').map((x) => x.id).join(',') === '16778240'
    && p.befehle(1).filter((x) => x.cmd === 'videoSubscribe').map((x) => x.id).join(',') === '16778240,16778250');
  ck('… mit dem Ton des Soll-Eintrags (aus)', p.befehle(1).find((x) => x.cmd === 'videoSubscribe' && x.id === 16778250)?.audio === false);
  ck('… das neue Abo erst, nachdem die Bridge das alte abgemeldet hat', abgemeldetVorNeuemAbo === true);
  ck('… neuer NDI-Name normiert gleich dem alten, ohne „ (2)“', await bis(() => zeile(p, 16778250)?.quelle !== null && zeile(p, 16778250)?.quelle !== undefined)
    && (zeile(p, 16778250)?.quelle?.ndiName ?? '').toLocaleLowerCase('de') === alterName.toLocaleLowerCase('de')
    && !(zeile(p, 16778250)?.quelle?.ndiName ?? '').includes(' (2)'));
  ck('… Soll-Liste erfüllt, eine Quelle', p.kern.kurz().sollOffen === 0 && (await bis(() => p.kern.kurz().quellen === 1)));
  await p.aufraeumen();
}

{
  // Fall 14c: Der Bediener lädt von Hand, bevor der Abgleich handelt -> Laden Schritt 3 meldet das alte Abo selbst ab.
  let abgemeldetVorNeuemAbo: boolean | null = null;
  const p: Probe = baueKern({
    stell: () => ({ FAKE_WIEDERBEITRITT_MS: '600', FAKE_RUECKKEHR_MS: '200', FAKE_RUECKKEHR_NAME: 'anna' }),
    sendeFilter: (c) => {
      if (c.cmd === 'videoSubscribe' && c.id === 16778250) {
        abgemeldetVorNeuemAbo = p.ereignisse.some((x) => x.ev.ev === 'video'
          && (x.ev as { id?: number }).id === 16778240 && (x.ev as { state?: string }).state === 'unsubscribed');
      }
      return true;
    },
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: false, trotzBetriebsgroesse: false });
  await bis(() => p.kern.kurz().quellen === 1);
  ck('Fall 14c: „anna“ kommt zurück', await bis(() => zeile(p, 16778250) !== undefined, 2000));
  ck('… Bediener lädt 16778250 von Hand, vor dem Abgleich', ok(await p.kern.laden({ id: 16778250, ton: false, trotzBetriebsgroesse: false })));
  // Wie Fall 11: erst warten, bis die Attrappe das neue Abo protokolliert hat.
  await bis(() => p.befehle(1).some((x) => x.cmd === 'videoSubscribe' && x.id === 16778250));
  ck('… Laden meldet das alte Abo selbst ab (16778240), dann abonniert es das neue',
    p.befehle(1).filter((x) => x.cmd === 'videoUnsubscribe').map((x) => x.id).join(',') === '16778240'
    && p.befehle(1).filter((x) => x.cmd === 'videoSubscribe').map((x) => x.id).join(',') === '16778240,16778250');
  ck('… das neue Abo erst, nachdem die Bridge das alte abgemeldet hat (Laden Schritt 3)', abgemeldetVorNeuemAbo === true);
  await warte(600);
  ck('… der Abgleich danach schickt nichts mehr dazu',
    p.befehle(1).filter((x) => x.cmd === 'videoUnsubscribe').length === 1
    && p.befehle(1).filter((x) => x.cmd === 'videoSubscribe').length === 2
    && p.kern.kurz().sollOffen === 0 && p.kern.kurz().quellen === 1);
  await p.aufraeumen();
}

console.log('— Soll-Liste nach „Erneut beitreten“ (4a-Ersatz für Fall 15), Vergessen, Lebenslauf');
{
  const p = baueKern({
    stell: (n): Record<string, string> =>
      n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '800', FAKE_DOPPELNAME: '1', FAKE_TEILNEHMER: '3' } : { FAKE_DOPPELNAME: '1', FAKE_TEILNEHMER: '3' },
  });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  await p.kern.laden({ id: CARLA, ton: false, trotzBetriebsgroesse: false });
  ck('Anna und Carla geladen', await bis(() => p.kern.kurz().quellen === 2));
  ck('Verbindung weg → fehler mit „Verbindung verloren: …“', await bis(() => p.kern.kurz().zustand === 'fehler', 3000)
    && String(p.kern.abbild().meldung?.text).startsWith('Verbindung verloren: '));
  ck('… Soll-Liste bleibt (zwei offene Einträge)', await bis(() => p.kern.kurz().sollOffen === 2));
  ck('erneut() → zweiter Start, im Meeting', ok(await p.kern.erneut()) && (await bis(() => p.kern.kurz().zustand === 'im_meeting' && p.kern.kurz().erlaubnis === 'ja')));
  await warte(600);
  const subs = p.befehle(2).filter((c) => c.cmd === 'videoSubscribe');
  ck('… Abgleich abonniert nur Carla (eindeutig), mit ihrem Ton', subs.length === 1 && subs[0].id === CARLA && subs[0].audio === false);
  const s = p.kern.abbild().soll;
  ck('… Anna steht als doppelname im Abbild, sollOffen 1', s.length === 1 && s[0].name === 'Anna' && s[0].stand === 'doppelname' && s[0].doppelname && p.kern.kurz().sollOffen === 1);
  ck('… STATE zoom_alarm=1 trotz Erlaubnis', p.kern.stateKv()?.zoom_privilege === 1 && p.kern.stateKv()?.zoom_alarm === 1);
  p.kern.sollVerwerfen({ name: 'ANNA ' });
  ck('sollVerwerfen(„ANNA “) entfernt den Eintrag, Alarm aus', p.kern.abbild().soll.length === 0 && p.kern.kurz().sollOffen === 0 && p.kern.stateKv()?.zoom_alarm === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_MEETING_ENDE_MS: '800' }) });
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  await bis(() => p.kern.kurz().quellen === 1);
  ck('Lebenslauf: Meeting-Ende leert die Soll-Liste', await bis(() => p.kern.kurz().zustand === 'bereit', 3000) && p.kern.kurz().sollOffen === 0
    && p.kern.abbild().soll.length === 0);
  ck('… und nach dem Abbau keine Quelle mehr', await bis(() => p.kern.kurz().quellen === 0));
  ck('… erneut() startet ohne Soll-Einträge (kein Abo)', ok(await p.kern.erneut()) && (await bis(() => p.kern.kurz().erlaubnis === 'ja'))
    && (await warte(500), !cmds(p, 2).includes('videoSubscribe')));
  await p.aufraeumen();
}
{
  const p = baueKern();
  await insMeeting(p);
  await p.kern.laden({ id: ANNA, ton: true, trotzBetriebsgroesse: false });
  await bis(() => p.kern.kurz().quellen === 1);
  await p.kern.verlassen();
  ck('Lebenslauf: Verlassen leert die Soll-Liste und die Quellen', p.kern.kurz().sollOffen === 0 && p.kern.kurz().quellen === 0);
  ck('… neuer Beitritt danach ohne Abo', await insMeeting(p) && (await warte(500), !cmds(p, 2).includes('videoSubscribe')));
  await p.aufraeumen();
}

// ── Gesamtprüfung: Spawn-Diagnose (Abnahme 5 misst M7, Text B2) ──────────────
// Node nennt den EXE-Pfad nur, wenn der Start ASYNCHRON scheitert („spawn <pfad> ENOENT“). EPERM und
// UNKNOWN wirft spawn() synchron als „spawn EPERM“/„spawn UNKNOWN“ OHNE Pfad (gemessen, Node 24): den
// Pfad muss der Kern selbst anhängen, aber nur, wenn er nicht schon in der Meldung steht.
console.log('— Spawn-Fehler: Code und EXE-Pfad im Log, keine Beenden-Zeile ohne Prozess');
const START_GESCHEITERT = '[zoom] Start der Zoom-Bridge gescheitert: ';
/** Wie oft `teil` in `zeile` vorkommt. */
const vorkommen = (zeile: string, teil: string): number => zeile.split(teil).length - 1;
{
  const p = baueKern({ exeAusKern: true });
  const exe = join(p.ordner, BRIDGE_EXE);
  const r = await p.kern.pruefen();
  ck('Spawn ENOENT (Laufzeit-Ordner ohne zoom-bridge.exe) → B1, Zustand bereit, keine Bridge',
    text(r) === KT.B1 && p.kern.abbild().meldung?.detail === 'ENOENT' && p.kern.kurz().zustand === 'bereit' && !p.kern.laeuft());
  const zeile = p.logs.find((z) => z.startsWith(START_GESCHEITERT)) ?? '';
  ck('… Log nennt Code und versuchten EXE-Pfad, den Pfad genau einmal', zeile.includes('ENOENT') && vorkommen(zeile, exe) === 1);
  ck('… keine Beenden-Zeile für einen Prozess, der nie lief',
    !p.logs.some((z) => z.includes('wird beendet') || z.includes('Rückgabewert') || z.includes('hart beendet')));
  await p.aufraeumen();
}
if (process.platform === 'win32') {
  const p = baueKern({ exeAusKern: true });
  const exe = join(p.ordner, BRIDGE_EXE);
  mkdirSync(p.ordner, { recursive: true });
  writeFileSync(exe, 'Keine ausfuehrbare Datei, nur Text.\r\n');
  const r = await p.kern.pruefen();
  ck('Textdatei als zoom-bridge.exe → synchron „spawn UNKNOWN“ → B2, Detail UNKNOWN, keine Bridge',
    text(r) === KT.B2('UNKNOWN') && p.kern.abbild().meldung?.detail === 'UNKNOWN' && p.kern.kurz().zustand === 'bereit' && !p.kern.laeuft());
  const zeile = p.logs.find((z) => z.startsWith(START_GESCHEITERT)) ?? '';
  ck('… Log nennt Code UND versuchten EXE-Pfad, obwohl Nodes Meldung keinen Pfad hat; den Pfad genau einmal',
    zeile.includes('UNKNOWN') && vorkommen(zeile, exe) === 1);
  ck('… keine Beenden-Zeile', !p.logs.some((z) => z.includes('wird beendet') || z.includes('Rückgabewert') || z.includes('hart beendet')));
  await p.aufraeumen();
} else {
  ueberspringe('Textdatei als zoom-bridge.exe → „spawn UNKNOWN“, Code und EXE-Pfad im Log');
}
{
  const grund = 'Start von einer Richtlinie verweigert';
  const p = baueKern({ startFehler: () => new Error(grund) });
  const exe = join(p.ordner, BRIDGE_EXE);
  const r = await p.kern.pruefen();
  ck('Spawn-Fehler ohne code → B2 „unbekannt“', text(r) === KT.B2('unbekannt') && p.kern.abbild().meldung?.detail === 'unbekannt');
  const zeile = p.logs.find((z) => z.startsWith(START_GESCHEITERT)) ?? '';
  ck('… die Fehlermeldung steht trotzdem im Log, dazu der versuchte EXE-Pfad genau einmal',
    zeile.startsWith(START_GESCHEITERT + grund) && vorkommen(zeile, exe) === 1);
  ck('… keine Beenden-Zeile', !p.logs.some((z) => z.includes('wird beendet') || z.includes('Rückgabewert')));
  await p.aufraeumen();
}

console.log('— SDK-Schlüssel eintragen und entfernen (Spec SDK nachladen 4.2, S18, S10)');
{
  const p = baueKern();
  ck('anfangs: Abbild ohne SDK-Schlüssel (none)', p.kern.abbild().einrichtung.sdkSchluessel.herkunft === 'none');
  const r = p.kern.sdkSchluesselEintragen({ schluessel: '  sdk-geheim-test \t\n' });
  ck('Review Focus SDK-4: eingefügt mit Leerraum und Zeilenumbruch → ok, getrimmt gespeichert',
    ok(r) && p.sdkSchluesselGespeichert.length === 1 && p.sdkSchluesselGespeichert[0] === 'sdk-geheim-test');
  ck('… Abbild: Herkunft stored', p.kern.abbild().einrichtung.sdkSchluessel.herkunft === 'stored');
  ck('… Logzeile ohne Wert', p.logs.includes('[zoom] SDK-Schlüssel hinterlegt (verschlüsselt)'));
  ck('… der Wert steht weder im Log noch im Abbild',
    !p.logs.some((z) => z.includes('sdk-geheim')) && !JSON.stringify(p.kern.abbild()).includes('sdk-geheim'));
  ck('… Zustand unverändert (bereit)', p.kern.kurz().zustand === 'bereit');
  for (const w of ['', '   ', 'sdk geheim', 'sdk\tgeheim', 'sdk\ngeheim', 'sdk€geheim']) {
    ck(`${JSON.stringify(w)} → S18, nichts gespeichert`,
      text(p.kern.sdkSchluesselEintragen({ schluessel: w })) === KT.S18 && p.sdkSchluesselGespeichert.length === 1);
  }
  ck('… Abweisung im Log, ohne Wert', p.logs.includes('[zoom] SDK-Schlüssel abgewiesen: ' + KT.S18) && !p.logs.some((z) => z.includes('sdk geheim')));
  ck('… S18 ist ein Eingabefehler: nicht im Abbild', !JSON.stringify(p.kern.abbild()).includes(KT.S18));
  const l = p.kern.sdkSchluesselLoeschen();
  ck('Entfernen → ok, Herkunft none, Log', ok(l) && p.sdkSchluesselGeloescht() === 1
    && p.kern.abbild().einrichtung.sdkSchluessel.herkunft === 'none' && p.logs.includes('[zoom] SDK-Schlüssel entfernt'));
  await p.aufraeumen();
}
{
  const p = baueKern({ sdkSchluesselLiefert: 'session' });
  ck('ohne Schlüsselbund: hinterlegt nur für diese Sitzung',
    ok(p.kern.sdkSchluesselEintragen({ schluessel: 'sdk-test' })) && p.kern.abbild().einrichtung.sdkSchluessel.herkunft === 'session'
      && p.logs.includes('[zoom] SDK-Schlüssel hinterlegt (nur für diese Sitzung)'));
  await p.aufraeumen();
}
{
  const p = baueKern({ sdkSchluessel: { wert: 'sdk-test', herkunft: 'env' } });
  ck('aus der Umgebung: Abbild env, der Wert nirgends',
    p.kern.abbild().einrichtung.sdkSchluessel.herkunft === 'env' && !JSON.stringify(p.kern.abbild()).includes('sdk-test'));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_AUTH_CODE: '2' }) });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Vorbereitung: Zustand fehler (B9)', p.kern.kurz().zustand === 'fehler');
  const r = p.kern.sdkSchluesselEintragen({ schluessel: 'sdk-test' });
  ck('im Zustand fehler: zuerst schließen, dann speichern → bereit, Meldung weg',
    ok(r) && p.sdkSchluesselGespeichert.length === 1 && p.kern.kurz().zustand === 'bereit' && p.kern.abbild().meldung === null);
  await p.aufraeumen();
}
{
  const p = baueKern();
  ck('Vorbereitung: im Meeting', await insMeeting(p));
  ck('während Zoom läuft: SDK-Schlüssel eintragen und entfernen → S10, nichts geändert',
    text(p.kern.sdkSchluesselEintragen({ schluessel: 'sdk-test' })) === KT.S10 && text(p.kern.sdkSchluesselLoeschen()) === KT.S10
      && p.sdkSchluesselGespeichert.length === 0 && p.sdkSchluesselGeloescht() === 0);
  await p.aufraeumen();
}
{
  let freigabe: (e: EinrichtungsErgebnis) => void = () => {};
  const p = baueKern({
    laufzeit: {
      pruefeOrdner: () => ({ ok: true, bin: 'X', fassung: SDK_FASSUNG, dateien: [{ pfad: 'sdk.dll', bytes: 1 }], bytesGesamt: 1 }),
      richteEin: () => new Promise<EinrichtungsErgebnis>((resolve) => {
        freigabe = resolve;
      }),
    },
  });
  const lauf = p.kern.sdkWaehlen('C:/SDK');
  ck('während der SDK-Kopie: SDK-Schlüssel eintragen und entfernen → S10',
    text(p.kern.sdkSchluesselEintragen({ schluessel: 'sdk-test' })) === KT.S10 && text(p.kern.sdkSchluesselLoeschen()) === KT.S10
      && p.sdkSchluesselGespeichert.length === 0);
  freigabe({ ok: false, text: KT.S6('EIO') });
  await lauf;
  await p.aufraeumen();
}
{
  // G2: Weder der SDK-Schlüssel noch der Proxy-Schlüssel erreichen die Zoom-Bridge (sie lädt die Zoom-DLLs).
  const vorher = { sdk: process.env.JMPS_ZOOM_SDK_KEY, proxy: process.env.JMPS_PROXY_KEY };
  process.env.JMPS_ZOOM_SDK_KEY = 'sdk-test';
  process.env.JMPS_PROXY_KEY = 'sdk-test';
  const p = baueKern({
    skript: 'envprobe',
    stell: () => ({ ENV_PROBE_NAMES: 'JMPS_ZOOM_SDK_KEY,JMPS_PROXY_KEY' }),
    fristen: { anmeldeMs: 500 },
  });
  await p.kern.pruefen();
  for (const [name, wert] of [['JMPS_ZOOM_SDK_KEY', vorher.sdk], ['JMPS_PROXY_KEY', vorher.proxy]] as const) {
    if (wert === undefined) delete process.env[name];
    else process.env[name] = wert;
  }
  const probe = p.ereignisse.find((x) => x.ev.ev === 'envprobe')?.ev as unknown as { seen: Record<string, boolean> } | undefined;
  ck('G2: Bridge-Umgebung ohne JMPS_ZOOM_SDK_KEY und JMPS_PROXY_KEY',
    probe !== undefined && JSON.stringify(probe.seen) === '{"JMPS_ZOOM_SDK_KEY":false,"JMPS_PROXY_KEY":false}');
  await p.aufraeumen();
}
if (process.platform === 'win32') {
  // G2 (Fix-Runde 1): Windows liest process.env ohne Rücksicht auf Groß-/Kleinschreibung, bridge.ts mischt aber
  // ein einfaches Objekt ein - eine abweichend geschriebene Variable darf trotzdem nicht bis zur Bridge reichen.
  const vorher = { sdk: process.env.JMPS_ZOOM_SDK_KEY, proxy: process.env.JMPS_PROXY_KEY };
  delete process.env.JMPS_ZOOM_SDK_KEY;
  delete process.env.JMPS_PROXY_KEY;
  process.env.Jmps_Zoom_Sdk_Key = 'sdk-test';
  process.env.Jmps_Proxy_Key = 'sdk-test';
  const p = baueKern({
    skript: 'envprobe',
    stell: () => ({ ENV_PROBE_NAMES: 'JMPS_ZOOM_SDK_KEY,JMPS_PROXY_KEY' }),
    fristen: { anmeldeMs: 500 },
  });
  await p.kern.pruefen();
  delete process.env.Jmps_Zoom_Sdk_Key;
  delete process.env.Jmps_Proxy_Key;
  for (const [name, wert] of [['JMPS_ZOOM_SDK_KEY', vorher.sdk], ['JMPS_PROXY_KEY', vorher.proxy]] as const) {
    if (wert !== undefined) process.env[name] = wert;
  }
  const probe = p.ereignisse.find((x) => x.ev.ev === 'envprobe')?.ev as unknown as { seen: Record<string, boolean> } | undefined;
  ck('G2: Bridge-Umgebung ohne die Schlüssel auch in gemischter Schreibung (Windows)',
    probe !== undefined && JSON.stringify(probe.seen) === '{"JMPS_ZOOM_SDK_KEY":false,"JMPS_PROXY_KEY":false}');
  await p.aufraeumen();
}

console.log('— sdkWaehlen wörtlich (Regression zur Teilung in pruefeUndRichteEin, Spec SDK nachladen 4.3 Schritt 6)');
const REG_WAHL = {
  ok: true as const, bin: 'C:/SDK/x64/bin', fassung: SDK_FASSUNG,
  dateien: [{ pfad: 'sdk.dll', bytes: 1 }, { pfad: 'a.dll', bytes: 2 }], bytesGesamt: 3,
};
const REG_STEMPEL = { format: 1 as const, sdkFassung: SDK_FASSUNG, eingerichtetAm: '2026-10-06T10:00:00.000Z', sdkDateien: [], eigeneDateien: [] };
{
  let gewaehlt: [string, string] | null = null;
  let kopieWaehrend: number | null = null;
  const p: Probe = baueKern({
    laufzeit: {
      pruefeOrdner: (g, r) => {
        gewaehlt = [g, r];
        return REG_WAHL;
      },
      richteEin: async (e) => {
        e.fortschritt({ dateien: 2, dateienGesamt: 2, bytes: 3, bytesGesamt: 3 });
        kopieWaehrend = p.kern.abbild().einrichtung.sdk.kopie?.bytes ?? null;
        return { ok: true, ordner: p.ordner, stempel: REG_STEMPEL, aufraeumFehler: null };
      },
    },
  });
  const vor = p.logs.length;
  const r = await p.kern.sdkWaehlen('C:/SDK');
  ck('Erfolg aus bereit: Logzeilen wörtlich und in dieser Reihenfolge', ok(r) && JSON.stringify(p.logs.slice(vor)) === JSON.stringify([
    '[zoom] Zoom-SDK 7.1.5.43953 wird kopiert (2 Dateien)',
    '[zoom] Zustand bereit → einrichtung',
    `[zoom] Zoom-SDK eingerichtet in ${p.ordner}`,
    '[zoom] Zustand einrichtung → bereit',
  ]));
  ck('… pruefeOrdner(ordner, ressourcen), Kopie-Fortschritt im Abbild, Laufzeit gespeichert',
    JSON.stringify(gewaehlt) === JSON.stringify(['C:/SDK', p.pfade.ressourcen]) && kopieWaehrend === 3
      && JSON.stringify(p.einst.laufzeit) === JSON.stringify({ dir: p.ordner, fassung: SDK_FASSUNG, eingerichtetAm: '2026-10-06T10:00:00.000Z' }));
  ck('… danach bereit, keine Kopie, kein Text', p.kern.kurz().zustand === 'bereit' && p.kern.abbild().einrichtung.sdk.kopie === null
    && p.kern.abbild().einrichtung.sdk.text === null);
  await p.aufraeumen();
}
{
  const p = baueKern({ laufzeit: { pruefeOrdner: () => ({ ok: false, text: KT.S1 }), richteEin: async () => ({ ok: false, text: 'darf nicht laufen' }) } });
  const vor = p.logs.length;
  const r = await p.kern.sdkWaehlen('C:/leer');
  ck('Abweisung: genau eine Logzeile, kein Zustandswechsel, keine Kopie',
    text(r) === KT.S1 && JSON.stringify(p.logs.slice(vor)) === JSON.stringify([`[zoom] SDK-Ordner abgewiesen: ${KT.S1}`])
      && p.richteEinAufrufe() === 0 && p.kern.kurz().zustand === 'bereit' && p.kern.abbild().einrichtung.sdk.text === KT.S1);
  await p.aufraeumen();
}
{
  const p = baueKern({ laufzeit: { pruefeOrdner: () => REG_WAHL, richteEin: async () => ({ ok: false, text: KT.S6('EIO') }) } });
  const vor = p.logs.length;
  const r = await p.kern.sdkWaehlen('C:/SDK');
  ck('Kopierfehler: Logzeilen wörtlich', text(r) === KT.S6('EIO') && JSON.stringify(p.logs.slice(vor)) === JSON.stringify([
    '[zoom] Zoom-SDK 7.1.5.43953 wird kopiert (2 Dateien)',
    '[zoom] Zustand bereit → einrichtung',
    `[zoom] Einrichtung des Zoom-SDK gescheitert: ${KT.S6('EIO')}`,
    '[zoom] Zustand einrichtung → bereit',
  ]));
  await p.aufraeumen();
}
{
  const p = baueKern({
    laufzeit: {
      pruefeOrdner: () => REG_WAHL,
      richteEin: async () => {
        throw Object.assign(new Error('Zugriff verweigert'), { code: 'EACCES' });
      },
    },
  });
  const r = await p.kern.sdkWaehlen('C:/SDK');
  ck('richteEin wirft: S6 mit dem Code, nicht mit der Meldung', text(r) === KT.S6('EACCES')
    && p.logs.includes(`[zoom] Einrichtung des Zoom-SDK gescheitert: ${KT.S6('EACCES')}`) && p.kern.kurz().zustand === 'bereit');
  await p.aufraeumen();
}
{
  let lzStand: LaufzeitPruefung = { ok: false, mangel: 'sdk_fehlt' };
  const p: Probe = baueKern({
    laufzeit: {
      pruefe: () => lzStand,
      pruefeOrdner: () => REG_WAHL,
      richteEin: async () => {
        lzStand = { ok: true, ordner: p.ordner, ersetzt: [] };
        return { ok: true, ordner: p.ordner, stempel: REG_STEMPEL, aufraeumFehler: 'EBUSY' };
      },
    },
  });
  const vor = p.logs.length;
  const r = await p.kern.sdkWaehlen('C:/SDK');
  ck('aus einrichtung mit Aufräumfehler: Logzeilen wörtlich', ok(r) && JSON.stringify(p.logs.slice(vor)) === JSON.stringify([
    '[zoom] Zoom-SDK 7.1.5.43953 wird kopiert (2 Dateien)',
    `[zoom] Zoom-SDK eingerichtet in ${p.ordner}`,
    '[zoom] Aufräumen nach der Einrichtung unvollständig (EBUSY)',
    '[zoom] Zustand einrichtung → bereit',
  ]));
  await p.aufraeumen();
}

console.log('— Zoom-SDK laden (Spec SDK nachladen 4.3, 4.4; Tests 6 Kern; Review Focus SDK-1, SDK-2, SDK-5)');
const LADE_MIB = 1024 * 1024;
const LINK = 'https://signed.test/zoom-77?sig=geheim-link';
const SCHLUESSEL: { wert: string; herkunft: 'stored' } = { wert: 'sdk-geheim-test', herkunft: 'stored' };
/** Attrappen für das Laden: alles klappt, einzelne Schritte überschreibbar. */
function ladeDienste(o: Partial<SdkLadenDienste> = {}): Partial<SdkLadenDienste> {
  return {
    freierPlatz: async () => 10 * 1024 * LADE_MIB,
    holeLink: async () => ({ ok: true, url: LINK, size: SDK_PAKET.bytes }),
    lade: async (e) => {
      mkdirSync(dirname(e.ziel), { recursive: true });
      writeFileSync(e.ziel, 'zip');
      e.fortschritt(SDK_PAKET.bytes);
      e.beimPruefen?.();
      return { ok: true };
    },
    entpacke: async (e) => {
      mkdirSync(e.ordner, { recursive: true });
      writeFileSync(join(e.ordner, 'sdk.dll'), 'MZ');
      return { ok: true };
    },
    ...o,
  };
}
const arbeitsordner = (p: Probe): string => join(p.pfade.basis, 'laden');
/** Phase und Bytes des Ladens | Zeile Z… | Sperre | laeuft() — für die Phasenfolge. */
function ladeStand(p: Probe): string {
  const l = p.kern.abbild().einrichtung.sdk.laden;
  return `${l ? `${l.phase}:${l.bytes}` : 'kein-laden'}|${zoomZ(p.kern.kurz())}|${text(p.kern.einrichtungSperre()) === KT.S10 ? 'S10' : 'frei'}|${p.kern.laeuft() ? 'laeuft' : 'ruht'}`;
}
{
  let lzStand: LaufzeitPruefung = { ok: false, mangel: 'sdk_fehlt' };
  const gesehen: string[] = [];
  let linkEingabe: Parameters<SdkLadenDienste['holeLink']>[0] | undefined;
  let ladeEingabe: Parameters<SdkLadenDienste['lade']>[0] | undefined;
  let entpackEingabe: Parameters<SdkLadenDienste['entpacke']>[0] | undefined;
  let gewaehlt: string | undefined;
  let platzPfad: string | undefined;
  let resteBeimPlatz: boolean | undefined;
  let resteBeimLink: boolean | undefined;
  const p: Probe = baueKern({
    sdkSchluessel: SCHLUESSEL,
    laufzeit: {
      pruefe: () => lzStand,
      pruefeOrdner: (g) => {
        gewaehlt = g;
        return { ok: true, bin: g, fassung: SDK_FASSUNG, dateien: [{ pfad: 'sdk.dll', bytes: 2 }], bytesGesamt: 2 };
      },
      richteEin: async (e) => {
        e.fortschritt({ dateien: 1, dateienGesamt: 1, bytes: 2, bytesGesamt: 2 });
        gesehen.push(`kopie ${ladeStand(p)} kopie=${p.kern.abbild().einrichtung.sdk.kopie?.bytes}`);
        lzStand = { ok: true, ordner: p.ordner, ersetzt: [] };
        return { ok: true, ordner: p.ordner, stempel: REG_STEMPEL, aufraeumFehler: null };
      },
    },
    sdkLaden: ladeDienste({
      freierPlatz: async (pfad) => {
        platzPfad = pfad;
        resteBeimPlatz = existsSync(arbeitsordner(p));
        return 10 * 1024 * LADE_MIB;
      },
      holeLink: async (e) => {
        linkEingabe = e;
        resteBeimLink = existsSync(arbeitsordner(p));
        gesehen.push(`link ${ladeStand(p)}`);
        return { ok: true, url: LINK, size: SDK_PAKET.bytes };
      },
      lade: async (e) => {
        ladeEingabe = e;
        mkdirSync(dirname(e.ziel), { recursive: true });
        writeFileSync(e.ziel, 'zip');
        e.fortschritt(63 * LADE_MIB);
        gesehen.push(`download ${ladeStand(p)}`);
        e.beimPruefen?.();
        gesehen.push(`pruefen ${ladeStand(p)}`);
        return { ok: true };
      },
      entpacke: async (e) => {
        entpackEingabe = e;
        gesehen.push(`entpacken ${ladeStand(p)}`);
        mkdirSync(e.ordner, { recursive: true });
        writeFileSync(join(e.ordner, 'sdk.dll'), 'MZ');
        return { ok: true };
      },
    }),
  });
  // Review Focus SDK-5: Reste eines abgebrochenen früheren Laufs liegen im Arbeitsordner.
  mkdirSync(join(arbeitsordner(p), 'sdk'), { recursive: true });
  writeFileSync(join(arbeitsordner(p), `${SDK_PAKET.datei}.teil`), 'alt');
  writeFileSync(join(arbeitsordner(p), 'sdk', 'alt.dll'), 'alt');
  const vor = p.logs.length;
  const r = await p.kern.sdkLaden();
  ck('Erfolg → ok, bereit, keine Mängel, nichts läuft mehr',
    ok(r) && p.kern.kurz().zustand === 'bereit' && p.kern.kurz().maengel.length === 0 && !p.kern.laeuft());
  ck('… Phasen link → download → pruefen → entpacken, danach die Kopie (laden dann null), überall Z1b und S10',
    JSON.stringify(gesehen) === JSON.stringify([
      'link link:0|Z1b|S10|laeuft',
      `download download:${63 * LADE_MIB}|Z1b|S10|laeuft`,
      `pruefen pruefen:${63 * LADE_MIB}|Z1b|S10|laeuft`,
      `entpacken entpacken:${63 * LADE_MIB}|Z1b|S10|laeuft`,
      'kopie kein-laden|Z1b|S10|laeuft kopie=2',
    ]));
  ck('Review Focus SDK-5: Reste des früheren Laufs waren schon vor der Platzmessung weg (A12), erst recht vor dem Link',
    resteBeimPlatz === false && resteBeimLink === false);
  ck('… Link: Proxy-Adresse, SDK-Schlüssel, gepinnte Fassung',
    linkEingabe?.base === 'https://proxy.test' && linkEingabe?.schluessel === 'sdk-geheim-test' && linkEingabe?.fassung === SDK_FASSUNG);
  ck('… Download: Link und Größe vom Proxy, ZIP im Arbeitsordner, erwartet = SDK_PAKET',
    ladeEingabe?.url === LINK && ladeEingabe?.size === SDK_PAKET.bytes && ladeEingabe?.ziel === join(arbeitsordner(p), SDK_PAKET.datei)
      && ladeEingabe?.erwartet.sha256 === SDK_PAKET.sha256 && ladeEingabe?.erwartet.bytes === SDK_PAKET.bytes);
  ck('… Entpacken nach laden/sdk, derselbe Ordner geht in pruefeOrdner',
    entpackEingabe?.zip === join(arbeitsordner(p), SDK_PAKET.datei) && entpackEingabe?.ordner === join(arbeitsordner(p), 'sdk')
      && gewaehlt === join(arbeitsordner(p), 'sdk'));
  ck('… Platz am Laufzeit-Ordner gemessen', platzPfad === p.pfade.basis);
  ck('… ZIP und Entpackordner danach weg', !existsSync(arbeitsordner(p)));
  const sdk = p.kern.abbild().einrichtung.sdk;
  ck('… Laufzeit in den Einstellungen, Abbild ohne laden, kopie und Text',
    p.einst.laufzeit?.dir === p.ordner && sdk.laden === null && sdk.kopie === null && sdk.text === null);
  ck('… Logzeilen wörtlich', JSON.stringify(p.logs.slice(vor)) === JSON.stringify([
    '[zoom] Zoom-SDK wird geladen (143 MB)',
    '[zoom] SDK-Link angefragt bei proxy.test',
    '[zoom] Zoom-SDK geladen und geprüft',
    '[zoom] Zoom-SDK 7.1.5.43953 wird kopiert (1 Dateien)',
    `[zoom] Zoom-SDK eingerichtet in ${p.ordner}`,
    '[zoom] Zustand einrichtung → bereit',
  ]));
  const alles = p.logs.join('\n') + JSON.stringify(p.kern.abbild()) + JSON.stringify(p.abbilder);
  ck('… weder SDK-Schlüssel noch Link in Log oder Abbild', !alles.includes('sdk-geheim') && !alles.includes('signed.test') && !alles.includes('geheim-link'));
  await p.aufraeumen();
}
const LADE_FEHLER: Array<[string, Partial<SdkLadenDienste>, string]> = [
  ['Schlüssel abgelehnt', { holeLink: async () => ({ ok: false, art: 'schluessel' }) }, KT.S12],
  ['gedrosselt 125 s', { holeLink: async () => ({ ok: false, art: 'gedrosselt', sekunden: 125 }) }, KT.S13(125)],
  ['Proxy nicht erreichbar', { holeLink: async () => ({ ok: false, art: 'proxy', grund: 'ENOTFOUND' }) }, KT.S14('ENOTFOUND')],
  ['kein passendes Paket auf dem Proxy', { holeLink: async () => ({ ok: false, art: 'fehlt' }) }, KT.S15],
  ['Download abgerissen', { lade: async () => ({ ok: false, art: 'unvollstaendig', grund: 'UND_ERR_SOCKET' }) }, KT.S16('UND_ERR_SOCKET')],
  ['Prüfsumme falsch', { lade: async () => ({ ok: false, art: 'pruefsumme' }) }, KT.S16b],
  ['Entpacken gescheitert', {
    entpacke: async (e) => {
      mkdirSync(e.ordner, { recursive: true });
      writeFileSync(join(e.ordner, 'halb.dll'), 'x');
      return { ok: false, art: 'entpacken', grund: 'Exit 1' };
    },
  }, KT.S16c('Exit 1')],
  ['Ausnahme in einem Dienst', {
    holeLink: async () => {
      throw Object.assign(new Error('E/A'), { code: 'EIO' });
    },
  }, KT.S16('EIO')],
];
for (const [name, dienste, soll] of LADE_FEHLER) {
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    laufzeit: {
      pruefeOrdner: () => {
        throw new Error('pruefeOrdner darf nicht laufen');
      },
      richteEin: async () => ({ ok: false, text: 'richteEin darf nicht laufen' }),
    },
    sdkLaden: ladeDienste(dienste),
  });
  const r = await p.kern.sdkLaden();
  const sdk = p.kern.abbild().einrichtung.sdk;
  ck(`${name} → Text wörtlich, im Abbild, im Log`, text(r) === soll && sdk.text === soll
    && p.logs.includes(`[zoom] Laden des Zoom-SDK gescheitert: ${soll}`));
  ck('… bisherige Einrichtung unverändert: bereit, keine Kopie, keine Einstellung, Arbeitsordner weg, nichts läuft',
    p.kern.kurz().zustand === 'bereit' && p.richteEinAufrufe() === 0 && p.einst.laufzeit === null && sdk.laden === null
      && !existsSync(arbeitsordner(p)) && !p.kern.laeuft() && !p.kern.kurz().kopieLaeuft);
  await p.aufraeumen();
}
{
  let linkGefragt = false;
  const bedarf = SDK_PAKET.bytes + 2 * SDK_PAKET.bytesEntpackt + 100 * LADE_MIB;
  let frei = bedarf - 1;
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    sdkLaden: ladeDienste({
      freierPlatz: async () => frei,
      holeLink: async () => {
        linkGefragt = true;
        return { ok: false, art: 'fehlt' };
      },
    }),
  });
  const r = await p.kern.sdkLaden();
  ck('Platzmangel (1 Byte zu wenig) → S5 mit ZIP + 2 × entpackt + 100 MB (gebraucht 872 MB, frei 871 MB)',
    text(r) === KT.S5(872, 871) && p.kern.abbild().einrichtung.sdk.text === KT.S5(872, 871));
  ck('… kein Link angefragt, Zustand bereit, nichts angelegt', !linkGefragt && p.kern.kurz().zustand === 'bereit' && !existsSync(arbeitsordner(p)));
  frei = bedarf;
  await p.kern.sdkLaden();
  ck('… genau genug Platz → es geht weiter zum Link', linkGefragt);
  await p.aufraeumen();
}
{
  let linkGefragt = false;
  const p = baueKern({
    sdkLaden: ladeDienste({
      holeLink: async () => {
        linkGefragt = true;
        return { ok: false, art: 'fehlt' };
      },
    }),
  });
  const vor = p.logs.length;
  const r = await p.kern.sdkLaden();
  ck('ohne SDK-Schlüssel → S11, kein Link, Zustand bleibt, kein Text im Abbild',
    text(r) === KT.S11 && !linkGefragt && p.kern.kurz().zustand === 'bereit' && p.kern.abbild().einrichtung.sdk.text === null);
  ck('… Log: nur die Abweisung', JSON.stringify(p.logs.slice(vor)) === JSON.stringify(['[zoom] Zoom-SDK laden abgewiesen: ' + KT.S11]));
  await p.aufraeumen();
}
{
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    sdkLaden: ladeDienste({
      holeLink: async () => {
        throw new Error('holeLink darf nicht laufen');
      },
    }),
  });
  ck('Vorbereitung: im Meeting', await insMeeting(p));
  ck('im Meeting → S10, nichts geladen', text(await p.kern.sdkLaden()) === KT.S10 && p.kern.abbild().einrichtung.sdk.laden === null
    && p.kern.kurz().zustand === 'im_meeting');
  await p.aufraeumen();
}
{
  let linkAufrufe = 0;
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    sdkLaden: ladeDienste({
      holeLink: (e) => {
        linkAufrufe++;
        return new Promise((resolve) => e.signal.addEventListener('abort', () => resolve({ ok: false, art: 'abgebrochen' }), { once: true }));
      },
    }),
  });
  const lauf = p.kern.sdkLaden();
  ck('während des Ladens: Z1b, laeuft(), Sperre S10',
    (await bis(() => linkAufrufe === 1)) && zoomZ(p.kern.kurz()) === 'Z1b' && p.kern.laeuft() && text(p.kern.einrichtungSperre()) === KT.S10);
  const zweit = await Promise.race([p.kern.sdkLaden(), warte(1000).then((): ZoomErgebnis => ({ ok: false, text: '(keine Antwort)' }))]);
  ck('Review Focus SDK-1: zweiter Klick auf „Zoom-SDK laden“ → S10, der Link wird nur einmal angefragt',
    text(zweit) === KT.S10 && linkAufrufe === 1);
  ck('… SDK-Ordner wählen, Zugangsdaten entfernen und SDK-Schlüssel eintragen ebenfalls S10',
    text(await p.kern.sdkWaehlen('C:/SDK')) === KT.S10 && text(p.kern.zugangLoeschen()) === KT.S10
      && text(p.kern.sdkSchluesselEintragen({ schluessel: 'sdk-test' })) === KT.S10);
  p.kern.sdkLadenAbbrechen();
  const r = await lauf;
  ck('Abbrechen → S17, als Text im Abbild', text(r) === KT.S17 && p.kern.abbild().einrichtung.sdk.text === KT.S17);
  ck('… Log „abgebrochen“, kein „gescheitert“',
    p.logs.includes('[zoom] Laden des Zoom-SDK abgebrochen') && !p.logs.some((z) => z.includes('Laden des Zoom-SDK gescheitert')));
  ck('… Zustand zurück auf bereit, Arbeitsordner weg, nichts läuft',
    p.kern.kurz().zustand === 'bereit' && !existsSync(arbeitsordner(p)) && !p.kern.laeuft() && p.kern.abbild().einrichtung.sdk.laden === null);
  await p.aufraeumen();
}
{
  let freigabe: (e: EinrichtungsErgebnis) => void = () => {};
  let linkGefragt = false;
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    laufzeit: {
      pruefeOrdner: () => REG_WAHL,
      richteEin: () => new Promise<EinrichtungsErgebnis>((resolve) => {
        freigabe = resolve;
      }),
    },
    sdkLaden: ladeDienste({
      holeLink: async () => {
        linkGefragt = true;
        return { ok: false, art: 'fehlt' };
      },
    }),
  });
  const wahl = p.kern.sdkWaehlen('C:/SDK');
  ck('während der Kopie aus „SDK-Ordner wählen …“: „Zoom-SDK laden“ → S10, kein Link, kein Laden im Abbild',
    (await bis(() => p.kern.kurz().kopieLaeuft)) && text(await p.kern.sdkLaden()) === KT.S10 && !linkGefragt
      && p.kern.abbild().einrichtung.sdk.laden === null);
  freigabe({ ok: false, text: KT.S6('EIO') });
  await wahl;
  await p.aufraeumen();
}
{
  let entpackLaeuft = false;
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    laufzeit: { richteEin: async () => ({ ok: false, text: 'richteEin darf nicht laufen' }) },
    sdkLaden: ladeDienste({
      entpacke: (e) => {
        entpackLaeuft = true;
        return new Promise((resolve) =>
          e.signal.addEventListener('abort', () => resolve({ ok: false, art: 'entpacken', grund: 'abgebrochen' }), { once: true }));
      },
    }),
  });
  const lauf = p.kern.sdkLaden();
  ck('Vorbereitung: Entpacken läuft', (await bis(() => entpackLaeuft)) && p.kern.abbild().einrichtung.sdk.laden?.phase === 'entpacken');
  p.kern.sdkLadenAbbrechen();
  ck('Abbrechen beim Entpacken → S17 (nicht S16c), keine Kopie', text(await lauf) === KT.S17 && p.richteEinAufrufe() === 0);
  await p.aufraeumen();
}
{
  let signal: AbortSignal | undefined;
  let freigabe: (e: EinrichtungsErgebnis) => void = () => {};
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    laufzeit: {
      pruefeOrdner: () => REG_WAHL,
      richteEin: (e) => {
        signal = e.signal;
        return new Promise<EinrichtungsErgebnis>((resolve) => {
          freigabe = resolve;
        });
      },
    },
    sdkLaden: ladeDienste(),
  });
  const lauf = p.kern.sdkLaden();
  ck('Vorbereitung: nach dem Laden läuft die Kopie',
    (await bis(() => signal !== undefined)) && p.kern.abbild().einrichtung.sdk.laden === null && p.kern.kurz().kopieLaeuft);
  p.kern.sdkLadenAbbrechen();
  ck('„Abbrechen“ während der Kopie greift nicht mehr (Spec 4.3)', signal?.aborted === false);
  freigabe({ ok: false, text: KT.S6('EIO') });
  const r = await lauf;
  ck('… Kopierfehler danach: S6 im Abbild und in „Laden … gescheitert“, bereit, Arbeitsordner weg',
    text(r) === KT.S6('EIO') && p.kern.abbild().einrichtung.sdk.text === KT.S6('EIO') && p.kern.kurz().zustand === 'bereit'
      && p.logs.includes(`[zoom] Laden des Zoom-SDK gescheitert: ${KT.S6('EIO')}`) && !existsSync(arbeitsordner(p)));
  await p.aufraeumen();
}
{
  const p = baueKern({ sdkSchluessel: SCHLUESSEL, laufzeit: { pruefeOrdner: () => ({ ok: false, text: KT.S4('vcruntime140.dll') }) }, sdkLaden: ladeDienste() });
  const r = await p.kern.sdkLaden();
  ck('geladenes Paket von pruefeOrdner abgewiesen → Text, eigene Logzeile und „Laden … gescheitert“, bereit, Arbeitsordner weg',
    text(r) === KT.S4('vcruntime140.dll') && p.logs.includes(`[zoom] Geladenes Zoom-SDK abgewiesen: ${KT.S4('vcruntime140.dll')}`)
      && p.logs.includes(`[zoom] Laden des Zoom-SDK gescheitert: ${KT.S4('vcruntime140.dll')}`)
      && p.kern.kurz().zustand === 'bereit' && !p.kern.kurz().kopieLaeuft && !existsSync(arbeitsordner(p)));
  await p.aufraeumen();
}
{
  let loeschAufrufe = 0;
  const p: Probe = baueKern({
    sdkSchluessel: SCHLUESSEL,
    laufzeit: {
      pruefeOrdner: () => REG_WAHL,
      richteEin: async () => ({ ok: true, ordner: p.ordner, stempel: REG_STEMPEL, aufraeumFehler: null }),
    },
    sdkLaden: ladeDienste({
      loesche: (pfad) => {
        loeschAufrufe++;
        if (loeschAufrufe === 2) throw Object.assign(new Error('belegt'), { code: 'EBUSY' });
        rmSync(pfad, { recursive: true, force: true });
      },
    }),
  });
  const r = await p.kern.sdkLaden();
  ck('Aufräumfehler am Ende → trotzdem ok, nur geloggt', ok(r) && loeschAufrufe === 2
    && p.logs.includes('[zoom] Aufräumen nach dem Laden unvollständig (EBUSY)'));
  await p.aufraeumen();
}
{
  let linkLaeuft = false;
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    sdkLaden: ladeDienste({
      holeLink: (e) => {
        linkLaeuft = true;
        return new Promise((resolve) =>
          e.signal.addEventListener('abort', () => setTimeout(() => resolve({ ok: false, art: 'abgebrochen' }), 150), { once: true }));
      },
    }),
  });
  const lauf = p.kern.sdkLaden();
  ck('Vorbereitung: das Laden hängt am Link', await bis(() => linkLaeuft));
  mkdirSync(arbeitsordner(p), { recursive: true });
  writeFileSync(join(arbeitsordner(p), `${SDK_PAKET.datei}.teil`), 'halb');
  const t0 = Date.now();
  await p.kern.beenden(2000);
  ck('Review Focus SDK-2: beenden bricht ab und wartet, bis das Laden aufgeräumt hat',
    Date.now() - t0 >= 100 && !existsSync(arbeitsordner(p)) && !p.logs.some((z) => z.includes('nicht rechtzeitig')));
  ck('… das Laden endet mit S17', text(await lauf) === KT.S17);
  await p.aufraeumen();
}
{
  let freigabe: () => void = () => {};
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    sdkLaden: ladeDienste({
      holeLink: () => new Promise((resolve) => {
        freigabe = () => resolve({ ok: false, art: 'abgebrochen' });
      }),
    }),
  });
  const lauf = p.kern.sdkLaden();
  // Hält die Ereignisschleife wach: mitFrist nutzt einen unref-Zeitgeber, und sonst wartet hier nichts.
  const spaeter = setTimeout(() => freigabe(), 2000);
  await warte(50);
  await p.kern.beenden(300);
  ck('beenden mit Frist: hört das Laden den Abbruch nicht, steht es nach der Frist im Log',
    p.logs.includes('[zoom] Laden des Zoom-SDK nicht rechtzeitig abgebrochen'));
  clearTimeout(spaeter);
  freigabe();
  await lauf;
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_AUTH_CODE: '2' }), sdkSchluessel: SCHLUESSEL, sdkLaden: ladeDienste({ holeLink: async () => ({ ok: false, art: 'fehlt' }) }) });
  await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: 'JM Connect' });
  ck('Vorbereitung: Zustand fehler (B9)', p.kern.kurz().zustand === 'fehler');
  const r = await p.kern.sdkLaden();
  ck('im Zustand fehler: zuerst schließen, dann laden → S15, bereit, Meldung weg',
    text(r) === KT.S15 && p.kern.kurz().zustand === 'bereit' && p.kern.abbild().meldung === null);
  await p.aufraeumen();
}
console.log('— S12 gilt dem damaligen Schlüssel (Gesamtprüfung: Task 7 minor 3, Abnahme 0.2.2 Schritt 4 → 5)');
{
  const p = baueKern({ sdkSchluessel: SCHLUESSEL, sdkLaden: ladeDienste({ holeLink: async () => ({ ok: false, art: 'schluessel' }) }) });
  await p.kern.sdkLaden();
  ck('Vorbereitung: S12 im Abbild', p.kern.abbild().einrichtung.sdk.text === KT.S12);
  ck('neuer SDK-Schlüssel nach S12 → ok, die Ablehnung steht nicht mehr im Abbild',
    ok(p.kern.sdkSchluesselEintragen({ schluessel: 'sdk-test' })) && p.kern.abbild().einrichtung.sdk.text === null);
  await p.kern.sdkLaden();
  ck('Vorbereitung: wieder S12', p.kern.abbild().einrichtung.sdk.text === KT.S12);
  ck('SDK-Schlüssel entfernen nach S12 → die Ablehnung steht nicht mehr im Abbild',
    ok(p.kern.sdkSchluesselLoeschen()) && p.kern.abbild().einrichtung.sdk.text === null
      && p.kern.abbild().einrichtung.sdkSchluessel.herkunft === 'none');
  await p.aufraeumen();
}
{
  const p = baueKern({ sdkSchluessel: SCHLUESSEL, sdkLaden: ladeDienste({ holeLink: async () => ({ ok: false, art: 'fehlt' }) }) });
  await p.kern.sdkLaden();
  ck('ein anderer Ladefehler (S15) bleibt nach neuem SDK-Schlüssel stehen',
    ok(p.kern.sdkSchluesselEintragen({ schluessel: 'sdk-test' })) && p.kern.abbild().einrichtung.sdk.text === KT.S15);
  await p.aufraeumen();
}
{
  // Ein Schlüssel aus der Umgebung hat Vorrang und gilt weiter: Ein eingetragener Wert ändert an S12 nichts.
  const p = baueKern({ sdkSchluessel: { wert: 'sdk-test', herkunft: 'env' }, sdkLaden: ladeDienste({ holeLink: async () => ({ ok: false, art: 'schluessel' }) }) });
  await p.kern.sdkLaden();
  ck('Schlüssel aus der Umgebung: S12 bleibt nach einem eingetragenen Schlüssel stehen (Umgebung hat Vorrang)',
    ok(p.kern.sdkSchluesselEintragen({ schluessel: 'sdk-geheim-test' })) && p.kern.abbild().einrichtung.sdk.text === KT.S12);
  await p.aufraeumen();
}
console.log('— Diagnose von tar.exe im Log (Gesamtprüfung: Task 5 minor 2)');
{
  const AUSGABE = "tar.exe: Can't create 'sdk\\x64\\bin\\sdk.dll': Write failed";
  const p = baueKern({
    sdkSchluessel: SCHLUESSEL,
    laufzeit: { richteEin: async () => ({ ok: false, text: 'richteEin darf nicht laufen' }) },
    sdkLaden: ladeDienste({ entpacke: async () => ({ ok: false, art: 'entpacken', grund: 'Exit 1', ausgabe: AUSGABE }) }),
  });
  const r = await p.kern.sdkLaden();
  const zeile = p.logs.indexOf(`[zoom] Ausgabe von tar.exe: ${AUSGABE}`);
  ck('Entpacken mit Ausgabe → eigene Logzeile vor „Laden … gescheitert“',
    zeile >= 0 && zeile < p.logs.indexOf(`[zoom] Laden des Zoom-SDK gescheitert: ${KT.S16c('Exit 1')}`));
  ck('… Text bleibt S16c mit dem Code, die Ausgabe steht nicht im Abbild',
    text(r) === KT.S16c('Exit 1') && p.kern.abbild().einrichtung.sdk.text === KT.S16c('Exit 1')
      && !JSON.stringify(p.kern.abbild()).includes('Write failed'));
  await p.aufraeumen();
}
console.log('— Entfernen bei nicht schreibbarer Einstellungsdatei (Gesamtprüfung: Task 3 minor 1, Task 4 minor 1)');
{
  const p = baueKern({ sdkSchluessel: SCHLUESSEL, sdkSchluesselLoeschenLiefert: false });
  const vor = p.logs.length;
  const r = p.kern.sdkSchluesselLoeschen();
  ck('SDK-Schlüssel entfernen, Datei nicht schreibbar → „nur für diese Sitzung entfernt“, Herkunft none',
    text(r) === TEXT_SDK_SCHLUESSEL_NUR_SITZUNG_ENTFERNT && p.sdkSchluesselGeloescht() === 1
      && p.kern.abbild().einrichtung.sdkSchluessel.herkunft === 'none');
  ck('… die Logzeile sagt es, statt „SDK-Schlüssel entfernt“', JSON.stringify(p.logs.slice(vor))
    === JSON.stringify(['[zoom] SDK-Schlüssel nur für diese Sitzung entfernt (Einstellungsdatei nicht schreibbar)']));
  await p.aufraeumen();
}
{
  const p = baueKern({ zugangLoeschenLiefert: false });
  const vor = p.logs.length;
  const r = p.kern.zugangLoeschen();
  ck('Zugangsdaten entfernen, Datei nicht schreibbar → „nur für diese Sitzung entfernt“, Mangel zugang_fehlt',
    text(r) === TEXT_ZUGANG_NUR_SITZUNG_ENTFERNT && p.kern.kurz().zustand === 'einrichtung' && p.kern.kurz().maengel.includes('zugang_fehlt'));
  ck('… die Logzeile sagt es, statt „Zugangsdaten entfernt“',
    p.logs.slice(vor).includes('[zoom] Zugangsdaten nur für diese Sitzung entfernt (Einstellungsdatei nicht schreibbar)')
      && !p.logs.slice(vor).includes('[zoom] Zugangsdaten entfernt'));
  await p.aufraeumen();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen, ${skip} übersprungen.`);
process.exit(fail === 0 ? 0 : 1);

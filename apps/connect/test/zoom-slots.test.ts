// Zoom-Slots im Kern OHNE Electron (tsx): echte Bridge gegen die Attrappe packages/zoom-bridge/test/fake-bridge.mjs, nur im
// neuen Slot-Vertrag (ohne den Altweg-Schalter der Attrappe). Spec 11.4 (PK1–PK36) und 11.11 (KF1–KF3); KF4 steht in zoom-teile.test.ts.
//   npm run selftest -w @jm/connect   ·   einzeln: npx tsx apps/connect/test/zoom-slots.test.ts
// Fabrik und Einstellungs-Attrappe wie zoom-kern.test.ts (baueKern), dazu die Slot-Felder der Einstellungen (Spec 7.2, 7.10):
// Lesen und Schreiben lassen sich scheitern lassen. Testdaten nur aus den Namen der Attrappe (Anna, Ben, Carla).
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Bridge, type BridgeEvent, type Command, type Session } from '@jm/zoom-bridge';
import {
  ANZEIGENAME_VORGABE,
  erzeugeZoomKern,
  type BridgeArt,
  type BridgeFabrik,
  type ZoomFristen,
  type ZoomKern,
} from '../src/main/zoom/kern';
import type { LaufzeitPfade } from '../src/main/zoom/laufzeit';
import type {
  ZoomAbbild, ZoomErgebnis, ZoomKurz, ZoomSlotEinstellung, ZoomSlotLage, ZoomSlotVorgaben, ZoomSprecherEinstellung,
} from '../src/shared/types';

const HIER = dirname(fileURLToPath(import.meta.url));
const FAKE = join(HIER, '..', '..', '..', 'packages', 'zoom-bridge', 'test', 'fake-bridge.mjs');
/** Synthetisch (G12) — keine echte Meeting-Nummer. */
const NUMMER = '7'.repeat(10);
const KENNCODE = 'KENNCODE-PROBE-72';
/** Kennungen der Attrappe (Drehbuch steuerung): Anna, Ben, Carla; Anna kommt bei FAKE_WIEDERBEITRITT_MS als 16778250 zurück. */
const ANNA = 16778240;
const BEN = 16778241;
const CARLA = 16778242;
const ANNA_ZURUECK = 16778250;

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
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
// Gesamtwache (G-B6, B-EP17): hängt ein Fall, endet der Lauf rot statt nie. Plan B, Task B17 setzt sie nach Messung.
const wache = setTimeout(() => {
  console.log('FAIL  Gesamtlaufzeit über 240 s – ein Fall hängt');
  process.exit(1);
}, 240_000);
wache.unref();

/** Ein Slot mit den Vorgaben eines neuen Slots (Spec 7.6) und den angegebenen Abweichungen. */
function slotEinst(nr: number, teil: Partial<ZoomSlotEinstellung> = {}): ZoomSlotEinstellung {
  return {
    nr, ndiName: `Zoom ${nr}`, modus: 'teilnehmer', person: '', an: false, aufloesung: '720p', ersatzbild: 'transparent',
    tonAn: true, tonArt: 'mischton', computerton: true, ohneKamera: true, ...teil,
  };
}

interface SlotEinstellungen {
  slots: ZoomSlotEinstellung[];
  /** Zahl der Aufrufe von setzeSlots (jede Änderung schreibt sofort, B-EP12). */
  schreibvorgaenge: number;
  vorgaben: ZoomSlotVorgaben;
  sprecher: ZoomSprecherEinstellung;
  vorschau: boolean;
  ueber5: boolean;
  /** Bild-Versatz (zoom_delay, 6.7): gespeicherter Wert und „nur diese Sitzung“ nach einem Schreibfehler (L14). */
  versatzMs: number;
  versatzNurSitzung: boolean;
}
interface Probe {
  kern: ZoomKern;
  logs: string[];
  abbilder: ZoomAbbild[];
  kurze: ZoomKurz[];
  starts(): number;
  /** Befehle aus FAKE_LOGDATEI; ohne Argument die aller Starts in Reihenfolge. */
  befehle(startNr?: number): Array<Record<string, unknown>>;
  /** Befehle, die der Kern an die Bridge `startNr` gab, im Testprozess mitgeschrieben (sofort, ohne die Datei der Attrappe). */
  gesendet(startNr?: number): Array<Record<string, unknown>>;
  ereignisse: Array<{ startNr: number; ev: BridgeEvent }>;
  /** Ein Ereignis so an den Kern geben, als käme es von der Bridge `startNr` (Generationsregel, PK22). */
  einspeisen(startNr: number, ev: Record<string, unknown>): void;
  einst: SlotEinstellungen;
  aufraeumen(): Promise<void>;
}
interface BaueOptionen {
  /** Stellschrauben der Attrappe je Start (1., 2., … Bridge). */
  stell?: (startNr: number) => Record<string, string>;
  skript?: string;
  fristen?: Partial<ZoomFristen>;
  /** false = Befehl verschlucken. */
  sendeFilter?: (cmd: Command) => boolean;
  ereignis?: (ev: BridgeEvent, startNr: number) => BridgeEvent;
  sitzung?: (s: Session, startNr: number) => Session;
  wiederbeitrittPlanMs?: readonly number[];
  gastLabels?: () => string[];
  /** Gespeicherte Slots beim Anlegen des Kerns (connect-settings.json, zoomSlots). */
  slots?: ZoomSlotEinstellung[];
  vorgaben?: ZoomSlotVorgaben;
  sprecher?: ZoomSprecherEinstellung;
  vorschau?: boolean;
  ueber5?: boolean;
  /** Was die Setter der Slot-Felder melden; false = Einstellungsdatei nicht schreibbar (nur diese Sitzung, T92). */
  schreibenLiefert?: boolean;
  einstellungsLage?: { gesichert: string | null; verworfen: number };
}

function baueKern(o: BaueOptionen = {}): Probe {
  const tmp = mkdtempSync(join(tmpdir(), 'jm-zoom-slots-'));
  const ordner = join(tmp, 'laufzeit');
  const pfade: LaufzeitPfade = { basis: join(tmp, 'basis'), ressourcen: join(tmp, 'ressourcen') };
  let startZahl = 0;
  const bruecken: BridgeArt[] = [];
  const eingaenge = new Map<number, (ev: BridgeEvent, s: Session) => void>();
  const sitzungen = new Map<number, () => Session>();
  const logs: string[] = [];
  const abbilder: ZoomAbbild[] = [];
  const kurze: ZoomKurz[] = [];
  const ereignisse: Probe['ereignisse'] = [];
  const gesendet: Array<{ startNr: number; cmd: Record<string, unknown> }> = [];
  const einst: SlotEinstellungen = {
    slots: (o.slots ?? []).map((s) => ({ ...s })),
    schreibvorgaenge: 0,
    vorgaben: o.vorgaben ?? { aufloesung: '720p', tonAn: true },
    sprecher: o.sprecher ?? { signal: 'sprecherVideo', haltezeitMs: 1000 },
    vorschau: o.vorschau ?? true,
    ueber5: o.ueber5 ?? false,
    versatzMs: 0,
    versatzNurSitzung: false,
  };
  const liefert = (): boolean => o.schreibenLiefert ?? true;
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
      onEvent: (roh, s) => {
        const ev = o.ereignis ? o.ereignis(roh, nr) : roh;
        ereignisse.push({ startNr: nr, ev });
        opts.onEvent?.(ev, s);
      },
    });
    if (opts.onEvent) eingaenge.set(nr, opts.onEvent);
    sitzungen.set(nr, () => b.session);
    const art: BridgeArt = {
      start: () => b.start(),
      send: (cmd) => {
        if (o.sendeFilter && !o.sendeFilter(cmd)) return;
        gesendet.push({ startNr: nr, cmd: { ...cmd } as Record<string, unknown> });
        b.send(cmd);
      },
      stop: () => b.stop(),
      get session() {
        return o.sitzung ? o.sitzung(b.session, nr) : b.session;
      },
    };
    bruecken.push(art);
    return art;
  };
  const kern = erzeugeZoomKern({
    pfade,
    zugang: {
      lesen: () => ({ daten: { clientId: 'test-id-1234', clientSecret: 'test-secret' }, herkunft: 'stored', unlesbar: false }),
      speichern: () => 'stored',
      loeschen: () => true,
    },
    einstellungen: {
      anzeigename: () => ANZEIGENAME_VORGABE,
      setzeAnzeigename: () => {},
      versatzMs: () => einst.versatzMs,
      setzeVersatzMs: (ms) => {
        einst.versatzMs = ms;
        einst.versatzNurSitzung = !liefert();
        return liefert();
      },
      versatzNurSitzung: () => einst.versatzNurSitzung,
      setzeLaufzeit: () => {},
      slots: () => einst.slots.map((s) => ({ ...s })),
      setzeSlots: (s) => {
        einst.schreibvorgaenge += 1;
        if (liefert()) einst.slots = s.map((x) => ({ ...x }));
        return liefert();
      },
      vorgaben: () => ({ ...einst.vorgaben }),
      setzeVorgaben: (v) => {
        if (liefert()) einst.vorgaben = { ...v };
        return liefert();
      },
      sprecher: () => ({ ...einst.sprecher }),
      setzeSprecher: (s) => {
        if (liefert()) einst.sprecher = { ...s };
        return liefert();
      },
      vorschau: () => einst.vorschau,
      setzeVorschau: (an) => {
        if (liefert()) einst.vorschau = an;
        return liefert();
      },
      ueber5: () => einst.ueber5,
      setzeUeber5: (an) => {
        if (liefert()) einst.ueber5 = an;
        return liefert();
      },
      einstellungsLage: () => o.einstellungsLage ?? { gesichert: null, verworfen: 0 },
    },
    sdkSchluessel: { lesen: () => ({ wert: null, herkunft: 'none' }), speichern: () => 'stored', loeschen: () => true },
    gastLabels: o.gastLabels ?? (() => []),
    log: (z) => logs.push(z),
    onAbbild: (a) => abbilder.push(a),
    onKurz: (k) => kurze.push(k),
    bridgeFabrik: fabrik,
    laufzeit: { pruefe: () => ({ ok: true, ordner, ersetzt: [] }) },
    proxyUrl: () => 'https://proxy.test',
    fristen: { anmeldeMs: 3000, joinTimeoutMs: 3000, killTimeoutMs: 2000, ...o.fristen },
    wiederbeitrittPlanMs: o.wiederbeitrittPlanMs ?? [30, 30, 30, 30, 30],
  });
  return {
    kern,
    logs,
    abbilder,
    kurze,
    ereignisse,
    einst,
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
    gesendet: (startNr) => gesendet.filter((g) => startNr === undefined || g.startNr === startNr).map((g) => g.cmd),
    einspeisen: (startNr, ev) => {
      const ein = eingaenge.get(startNr);
      const s = sitzungen.get(startNr);
      if (ein && s) ein(ev as unknown as BridgeEvent, s());
    },
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

/** Beitritt mit NUMMER; wartet auf im_meeting mit Erlaubnis „ja“. */
async function insMeeting(p: Probe): Promise<boolean> {
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: ANZEIGENAME_VORGABE });
  return r.ok && (await bis(() => p.kern.kurz().zustand === 'im_meeting' && p.kern.kurz().erlaubnis === 'ja'));
}
/** Lage eines Slots im Abbild. */
function lage(p: Probe, nr: number): ZoomSlotLage | undefined {
  return p.kern.abbild().slots.find((s) => s.einstellung.nr === nr);
}
/** Slot-Befehle (slotOn, slotSet, slotOff) an die Bridge `startNr` (oder an alle), in Reihenfolge. */
function slotBefehle(p: Probe, startNr?: number, nr?: number): Array<Record<string, unknown>> {
  return p.befehle(startNr).filter((c) => String(c.cmd).startsWith('slot') && (nr === undefined || c.slot === nr));
}
/** Wie slotBefehle, aber aus dem Mitschrieb des Testprozesses (für „kein …“-Prüfungen nach einer Wartezeit; G-B4). */
function slotGesendet(p: Probe, startNr?: number, nr?: number): Array<Record<string, unknown>> {
  return p.gesendet(startNr).filter((c) => String(c.cmd).startsWith('slot') && (nr === undefined || c.slot === nr));
}
/** Kurzform-Eintrag eines Slots (zoom_slot{n}_* in Plan B, Task B18). */
function slotKurz(p: Probe, nr: number): ZoomKurz['slotKurz'][number] | undefined {
  return p.kern.kurz().slotKurz.find((s) => s.nr === nr);
}
const ok = (r: { ok: boolean }): boolean => r.ok;
const text = (r: ZoomErgebnis | { ok: false; nachfrage: true; text: string }): string | null => (r.ok ? null : r.text);

// ── Plan B, Task B12: Kern-Umstieg (PK1, PK2, PK4, PK5, PK6, PK22, PK26, PK31, PK33, KF1–KF3) ──

console.log('— PK1 · Slots anlegen: Nummern 1, 2, 3, frei gewordene Nummer, höchstens 16, jede Änderung gespeichert');
{
  const p = baueKern();
  const drei = [p.kern.slotAnlegen(), p.kern.slotAnlegen(), p.kern.slotAnlegen()];
  ck('PK1: drei neue Slots bekommen die Nummern 1, 2, 3', drei.map((r) => (r.ok ? r.nr : 0)).join(',') === '1,2,3');
  ck('… gespeichert als „Zoom 1“ bis „Zoom 3“ mit den Vorgaben eines neuen Slots (7.6), Start aus',
    p.einst.slots.map((s) => s.ndiName).join('|') === 'Zoom 1|Zoom 2|Zoom 3'
      && p.einst.slots.every((s) => JSON.stringify(s) === JSON.stringify(slotEinst(s.nr))));
  ck('… Löschen von Slot 2 macht die Nummer frei', ok(p.kern.slotLoeschen(2)) && p.einst.slots.map((s) => s.nr).join(',') === '1,3');
  const vier = p.kern.slotAnlegen();
  ck('… der nächste neue Slot bekommt die 2', vier.ok && vier.nr === 2 && p.einst.slots.map((s) => s.nr).join(',') === '1,2,3');
  for (let i = 0; i < 13; i += 1) p.kern.slotAnlegen();
  ck('… 16 Slots angelegt und gespeichert', p.kern.abbild().slots.length === 16 && p.einst.slots.length === 16);
  ck('… der 17. → T32', text(p.kern.slotAnlegen()) === 'Höchstens 16 Slots. Zuerst einen Slot löschen.' && p.einst.slots.length === 16);
  ck('… jede Änderung schrieb sofort (17 Anlegen, 1 Löschen)', p.einst.schreibvorgaenge === 18);
  await p.aufraeumen();
}

console.log('— PK26 · Löschen nur ausgeschaltet (T36), danach ist die Nummer frei');
{
  const p = baueKern({ slots: [slotEinst(1, { an: true }), slotEinst(2)] });
  ck('PK26: Slot 1 ist an → T36, nichts gelöscht', text(p.kern.slotLoeschen(1)) === 'Zum Löschen den Slot erst ausschalten.'
    && p.einst.slots.length === 2 && p.kern.abbild().slots.length === 2);
  ck('… ausgeschaltet und gelöscht', ok(p.kern.slotStart(1, false)) && ok(p.kern.slotLoeschen(1))
    && p.einst.slots.map((s) => s.nr).join(',') === '2' && lage(p, 1) === undefined);
  const neu = p.kern.slotAnlegen();
  ck('… die Nummer 1 ist wieder frei', neu.ok && neu.nr === 1);
  await p.aufraeumen();
}

console.log('— PK2 · Beitritt mit Teilnehmer-Slot „Anna“ und Sprecher-Slot: je ein slotOn mit allen Feldern, n = 2');
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true }), slotEinst(2, { modus: 'sprecher', an: true, aufloesung: '1080p', ersatzbild: 'schwarz' })],
  });
  ck('PK2: im Meeting mit Erlaubnis', await insMeeting(p));
  ck('… je ein slotOn', await bis(() => slotBefehle(p, 1).filter((c) => c.cmd === 'slotOn').length === 2, 3000));
  const an = slotBefehle(p, 1).filter((c) => c.cmd === 'slotOn');
  const eins = an.find((c) => c.slot === 1);
  const zwei = an.find((c) => c.slot === 2);
  ck('… Slot 1: alle Felder aus der Einstellung, Ziel Anna, Ton nach der Abbildung 7.1',
    JSON.stringify(eins) === JSON.stringify({
      cmd: 'slotOn', slot: 1, ndi: 'Zoom 1', mode: 'participant', id: ANNA, resolution: '720p', audio: 'mix', shareAudio: true,
      fallback: 'transparent', showNoVideo: true,
    }));
  ck('… Slot 2: Modus speaker ohne Ziel (die Bridge wählt), 1080p, schwarz',
    JSON.stringify(zwei) === JSON.stringify({
      cmd: 'slotOn', slot: 2, ndi: 'Zoom 2', mode: 'speaker', resolution: '1080p', audio: 'mix', shareAudio: true, fallback: 'black',
      showNoVideo: true,
    }));
  ck('… n = 2 (Teilnehmer zeigt, Sprecher mit Ersatzbild), k = 1', await bis(() => p.kern.kurz().slotsLaufen === 2 && p.kern.kurz().slotsErsatz === 1, 3000));
  const kv = p.kern.stateKv();
  ck('… STATE zoom_sources=2, zoom_live=1', kv?.zoom_sources === 2 && kv.zoom_live === 1);
  ck('… Kurzform je Slot: Slot 1 an, live, Ziel „Anna“; Slot 2 Modus sprecher, Zustandswort ersatz',
    JSON.stringify(slotKurz(p, 1)) === JSON.stringify({ nr: 1, an: true, live: true, alarm: false, tonEin: true, modus: 'teilnehmer', ziel: 'Anna', zustandWort: 'zeigt' })
      && slotKurz(p, 2)?.modus === 'sprecher' && slotKurz(p, 2)?.zustandWort === 'ersatz' && slotKurz(p, 2)?.ziel === '');
  await p.aufraeumen();
}

console.log('— PK31 · Ton-Abbildung (7.1): jede Zeile der Tabelle als slotOn-Felder, „Ton eingeschaltet“ nach 8.2');
{
  // tonAn, tonArt, computerton → audio, shareAudio (Tabelle 7.1, Zeilen 1–6), dazu ein Freigabe-Slot nur mit Computerton.
  const ZEILEN: Array<[Partial<ZoomSlotEinstellung>, string, boolean, boolean]> = [
    [{ tonAn: false, computerton: false }, 'off', false, false],
    [{ tonAn: false, computerton: true }, 'off', true, false],
    [{ tonAn: true, tonArt: 'mischton', computerton: false }, 'mix', false, true],
    [{ tonAn: true, tonArt: 'mischton', computerton: true }, 'mix', true, true],
    [{ tonAn: true, tonArt: 'person', computerton: false }, 'person', false, true],
    [{ tonAn: true, tonArt: 'person', computerton: true }, 'person', true, true],
    [{ modus: 'freigabe', tonAn: false, computerton: true }, 'off', true, true],
  ];
  const p = baueKern({ ueber5: true, slots: ZEILEN.map(([t], i) => slotEinst(i + 1, { an: true, ...t })) });
  await insMeeting(p);
  ck('PK31: sieben slotOn', await bis(() => slotBefehle(p, 1).filter((c) => c.cmd === 'slotOn').length === 7, 3000));
  ZEILEN.forEach(([t, audio, share, tonEin], i) => {
    const c = slotBefehle(p, 1, i + 1).find((x) => x.cmd === 'slotOn');
    ck(`… Zeile ${i + 1} ${JSON.stringify(t)} → audio ${audio}, shareAudio ${share}, Ton eingeschaltet ${tonEin}`,
      c?.audio === audio && c.shareAudio === share && slotKurz(p, i + 1)?.tonEin === tonEin);
  });
  await p.aufraeumen();
}

console.log('— PK4 · Rückkehr (#262): beim Weggang T16 und zoom_alarm=1, nach der Rückkehr genau ein slotSet {id}, Ton wieder live');
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true, tonArt: 'person' })],
    stell: () => ({ FAKE_WIEDERBEITRITT_MS: '1200', FAKE_RUECKKEHR_MS: '700' }),
  });
  await insMeeting(p);
  ck('PK4: Slot 1 zeigt Anna, Person-Ton läuft', await bis(() => lage(p, 1)?.text === 'Zeigt Anna.' && lage(p, 1)?.ton === 'live', 3000));
  ck('… Anna geht: T16, zoom_alarm=1, zoom_slot1_alarm=1',
    await bis(() => lage(p, 1)?.text === 'Wartet auf Anna · Ersatzbild transparent', 3000)
      && p.kern.stateKv()?.zoom_alarm === 1 && slotKurz(p, 1)?.alarm === true);
  ck('… nach der Rückkehr: slotSet {slot: 1, id: 16778250}', await bis(() => slotBefehle(p, 1).some((c) => c.cmd === 'slotSet'), 3000)
    && JSON.stringify(slotBefehle(p, 1).filter((c) => c.cmd === 'slotSet')) === JSON.stringify([{ cmd: 'slotSet', slot: 1, id: ANNA_ZURUECK }]));
  ck('… T15 und Ton wieder live', await bis(() => lage(p, 1)?.text === 'Zeigt Anna.' && lage(p, 1)?.ton === 'live', 3000));
  await warte(400);
  ck('… genau ein slotOn und kein slotOff, genau ein slotSet', JSON.stringify(slotBefehle(p, 1).map((c) => c.cmd)) === '["slotOn","slotSet"]');
  ck('… zoom_alarm wieder 0', p.kern.stateKv()?.zoom_alarm === 0 && slotKurz(p, 1)?.alarm === false);
  await p.aufraeumen();
}

console.log('— PK5 · Rückkehr als „anna “ (normierter Name) wie PK4');
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })],
    stell: () => ({ FAKE_WIEDERBEITRITT_MS: '1200', FAKE_RUECKKEHR_MS: '700', FAKE_RUECKKEHR_NAME: 'anna ' }),
  });
  await insMeeting(p);
  ck('PK5: Slot 1 zeigt Anna', await bis(() => lage(p, 1)?.text === 'Zeigt Anna.', 3000));
  ck('… nach der Rückkehr als „anna “: slotSet {slot: 1, id: 16778250}, kein Neustart',
    await bis(() => slotBefehle(p, 1).some((c) => c.cmd === 'slotSet' && c.id === ANNA_ZURUECK), 4000)
      && JSON.stringify(slotBefehle(p, 1).map((c) => c.cmd)) === '["slotOn","slotSet"]');
  ck('… zeigt die zurückgekehrte Person („anna “)', await bis(() => lage(p, 1)?.text === 'Zeigt anna .', 3000));
  await p.aufraeumen();
}

console.log('— PK6 · Doppelname: kein Raten, Handwahl, Kamera aus ohne Alarm, kein Sprung auf einen Namensvetter, Warteraum');
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })],
    stell: () => ({ FAKE_DOPPELNAME: '1', FAKE_KAMERA_AUS_MS: `${ANNA}:1500`, FAKE_WIEDERBEITRITT_MS: '2600', FAKE_RUECKKEHR_MS: '900' }),
  });
  await insMeeting(p);
  ck('PK6: zwei „Anna“ → slotOn mit id 0', await bis(() => slotBefehle(p, 1).some((c) => c.cmd === 'slotOn'), 3000)
    && slotBefehle(p, 1).find((c) => c.cmd === 'slotOn')?.id === 0);
  ck('… T13 mit Wahl, zoom_slot1_alarm=1', await bis(() => lage(p, 1)?.text
    === 'Name doppelt: „Anna“ ist 2-mal im Meeting. Bitte unten die richtige Person wählen. · Ersatzbild transparent', 3000)
    && lage(p, 1)?.doppelt === 2 && lage(p, 1)?.wahl?.map((w) => w.id).sort().join(',') === `${ANNA},${BEN}` && slotKurz(p, 1)?.alarm === true);
  ck('… Handwahl Anna → slotSet {slot: 1, id: Anna}', ok(p.kern.slotPersonWaehlen(1, ANNA))
    && (await bis(() => slotBefehle(p, 1).some((c) => c.cmd === 'slotSet' && c.id === ANNA), 2000)));
  ck('… zeigt Anna, kein Alarm', await bis(() => lage(p, 1)?.text === 'Zeigt Anna.', 2000) && slotKurz(p, 1)?.alarm === false);
  ck('… Kamera aus → T19, zoom_slot1_alarm=0 (kein T13 mehr)', await bis(() => lage(p, 1)?.text === 'Anna: Kamera aus · Ersatzbild transparent', 3000)
    && slotKurz(p, 1)?.alarm === false && lage(p, 1)?.doppelt === 1);
  ck('… die gewählte Anna geht, die zweite ist noch da → T13b, kein slotSet auf die zweite',
    await bis(() => lage(p, 1)?.zweifel === true, 4000)
      && lage(p, 1)?.text === '„Anna“ hat das Meeting verlassen; eine andere Person mit diesem Namen ist noch da. Ist sie gemeint, unten wählen. · Ersatzbild transparent'
      && !slotBefehle(p, 1).some((c) => c.cmd === 'slotSet' && c.id === BEN) && slotKurz(p, 1)?.alarm === true);
  ck('… sie kommt neu beigetreten zurück → T13 mit Wahl (zwei Kandidaten)', await bis(() => lage(p, 1)?.doppelt === 2, 3000)
    && lage(p, 1)?.wahl?.map((w) => w.id).sort().join(',') === `${BEN},${ANNA_ZURUECK}`
    && !slotBefehle(p, 1).some((c) => c.cmd === 'slotSet' && (c.id === BEN || c.id === ANNA_ZURUECK)));
  await p.aufraeumen();
}
{
  // Ohne Handwahl: A lief allein, B („Anna“, tritt später bei) kommt dazu, A bleibt gezeigt; A geht → kein Sprung auf B.
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })],
    stell: () => ({ FAKE_TEILNEHMER: '2', FAKE_BEITRITT_MS: '900', FAKE_WIEDERBEITRITT_MS: '1800', FAKE_RUECKKEHR_MS: '5000' }),
    sitzung: (s) => {
      const c = s.participants.get(CARLA);
      if (!c) return s;
      const participants = new Map(s.participants);
      participants.set(CARLA, { ...c, name: 'Anna' });
      return { ...s, participants };
    },
  });
  await insMeeting(p);
  ck('PK6 (ohne Handwahl): A allein → zeigt Anna', await bis(() => lage(p, 1)?.text === 'Zeigt Anna.', 3000));
  ck('… B tritt als zweite „Anna“ bei → A bleibt gezeigt, kein Alarm', await bis(() => p.kern.abbild().teilnehmer.length === 3, 3000)
    && (await warte(500), lage(p, 1)?.text === 'Zeigt Anna.') && slotKurz(p, 1)?.alarm === false);
  ck('… A geht → T13b, kein slotSet auf B', await bis(() => lage(p, 1)?.zweifel === true, 3000)
    && !slotBefehle(p, 1).some((c) => c.cmd === 'slotSet' && c.id === CARLA));
  await p.aufraeumen();
}
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })],
    sitzung: (s) => {
      const a = s.participants.get(ANNA);
      if (!a) return s;
      const participants = new Map(s.participants);
      participants.set(ANNA, { ...a, inWaitingRoom: true });
      return { ...s, participants };
    },
  });
  await insMeeting(p);
  ck('PK6 (Warteraum): die einzige „Anna“ im Warteraum zählt mit → slotOn mit id 0, T17',
    await bis(() => lage(p, 1)?.text === 'Wartet auf Anna (im Warteraum) · Ersatzbild transparent', 3000)
      && slotBefehle(p, 1).find((c) => c.cmd === 'slotOn')?.id === 0 && lage(p, 1)?.imWarteraum === true);
  await p.aufraeumen();
}

console.log('— PK22 · Ereignisse der alten Generation ändern keine Slot-Lage außer dem Abbau (ST4 6.9)');
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })],
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '900' } : {}),
  });
  await insMeeting(p);
  ck('PK22: Slot 1 zeigt Anna in Bridge 1', await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000));
  ck('… nach dem Wiederbeitritt zeigt Slot 1 Anna in Bridge 2', await bis(() => p.starts() === 2 && p.kern.kurz().zustand === 'im_meeting', 5000)
    && (await bis(() => lage(p, 1)?.zustand === 'zeigt' && slotBefehle(p, 2).some((c) => c.cmd === 'slotOn'), 3000)));
  p.einspeisen(1, { ev: 'slot', slot: 1, state: 'fallback', mode: 'participant', target: 0, share: 0, reason: 'participantLeft', sent: 'transparent', ndi: 'Zoom 1' });
  ck('… ein spätes slot fallback der alten Bridge ändert nichts, steht nur im Log', lage(p, 1)?.zustand === 'zeigt' && lage(p, 1)?.grund === 'frames'
    && p.logs.includes('[zoom] (Abbau) slot 1 fallback (participantLeft)'));
  p.einspeisen(1, { ev: 'slot', slot: 1, state: 'off', mode: 'participant', target: 0, share: 0, reason: 'meetingEnded', sent: 'none', ndi: 'Zoom 1' });
  ck('… auch ein spätes slot off der alten Bridge baut den Sender der neuen nicht ab', lage(p, 1)?.zustand === 'zeigt' && p.kern.kurz().slotsLaufen === 1);
  await p.aufraeumen();
}

console.log('— PK33 · Quelltext: kein Zweig mehr für video und audio (Altweg)');
{
  const dateien: string[] = [];
  const sammle = (ordner: string): void => {
    for (const n of readdirSync(ordner)) {
      const pfad = join(ordner, n);
      if (statSync(pfad).isDirectory()) sammle(pfad);
      else if (/\.(ts|tsx)$/.test(n)) dateien.push(pfad);
    }
  };
  sammle(join(HIER, '..', 'src'));
  const MUSTER = [/case 'video'/, /case 'audio'/, /ev === 'video'/, /ev === 'audio'/];
  const treffer = dateien.flatMap((d) => readFileSync(d, 'utf8').split(/\r?\n/).map((z, i) => ({ d, i, z }))
    .filter((x) => MUSTER.some((m) => m.test(x.z))).map((x) => `${x.d.slice(x.d.lastIndexOf('src'))}:${x.i + 1}`));
  ck(`PK33: in apps/connect/src kein case 'video'/'audio', kein ev === 'video'/'audio'${treffer.length ? ` (${treffer.join(', ')})` : ''}`,
    dateien.length > 20 && treffer.length === 0);
}

console.log('— KF1 · slotLage(): jedes Feld aus der Lage (Rundlauf mit abweichenden Werten)');
{
  const besonders = slotEinst(1, {
    ndiName: 'Bühne links', person: 'Anna', an: true, aufloesung: '1080p', ersatzbild: 'schwarz', tonArt: 'person', computerton: false, ohneKamera: false,
  });
  const p = baueKern({ slots: [besonders, slotEinst(2, { person: 'Anna', an: true, tonAn: false })] });
  await insMeeting(p);
  ck('KF1: beide Slots zeigen Anna', await bis(() => lage(p, 1)?.zustand === 'zeigt' && lage(p, 2)?.zustand === 'zeigt' && lage(p, 1)?.ton === 'live', 3000));
  const l = lage(p, 1);
  ck('… einstellung: alle elf Felder wie gespeichert', JSON.stringify(l?.einstellung) === JSON.stringify(besonders));
  ck('… zustand zeigt, grund frames, gesendet none, zielName Anna', l?.zustand === 'zeigt' && l.grund === 'frames' && l.gesendet === 'none' && l.zielName === 'Anna');
  ck('… doppelt 1, kein Zweifel, nicht im Warteraum, keine Wahl', l?.doppelt === 1 && !l.zweifel && !l.imWarteraum && l.wahl === null);
  ck('… Ton: live/packets, gemessen und eingestellt „person“', l?.ton === 'live' && l.tonGrund === 'packets' && l.tonQuelle === 'person'
    && l.tonEingestellt === 'person');
  ck('… nicht offen, lief schon, zeigte schon, anderer Slot 2', l?.offen === false && l.liefSchon && l.zeigteSchon && l.andererSlot === 2
    && lage(p, 2)?.andererSlot === 1);
  ck('… Zustandszeile T15, Tonzeile T58c (gemessene Quelle), keine Fehlerzeile', l?.text === 'Zeigt Anna.'
    && l.tonText === 'Ton: Anna · läuft (32,0 kHz, mono)' && l.fehler === null && l.voruebergehend === false && l.anNurMeeting === false);
  ck('… Slot 2 ohne Ton: Tonzeile T58a, eingestellt none', lage(p, 2)?.tonText === 'Ton: aus' && lage(p, 2)?.tonEingestellt === 'none');
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: () => ({ FAKE_DOPPELNAME: '1' }) });
  await insMeeting(p);
  ck('KF1 (Doppelname): doppelt 2, Wahl mit Kennzeichen „Host“ (Anna ist Host), offen', await bis(() => lage(p, 1)?.zustand === 'ersatz', 3000)
    && JSON.stringify(lage(p, 1)?.wahl?.sort((a, b) => a.id - b.id)) === JSON.stringify([
      { id: ANNA, name: 'Anna', hinweis: 'Host' }, { id: BEN, name: 'Anna', hinweis: '' }])
    && lage(p, 1)?.offen === true && lage(p, 1)?.zielName === 'Anna');
  await p.aufraeumen();
}

console.log('— KF2 · kurz(): n, k, o, e, gestoppt durch Entzug und je Slot die Werte für STATE');
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true }), slotEinst(2, { modus: 'sprecher', an: true, tonAn: false }), slotEinst(3, { modus: 'freigabe' })],
  });
  ck('KF2: vor dem Beitritt e = 2, n = 0, Zustandswörter wartet, wartet, aus', JSON.stringify(p.kern.kurz().slotKurz.map((s) => s.zustandWort)) === '["wartet","wartet","aus"]'
    && p.kern.kurz().slotsAn === 2 && p.kern.kurz().slotsLaufen === 0);
  await insMeeting(p);
  ck('… im Meeting: n = 2, k = 1, o = 0, e = 2, gestoppt 0', await bis(() => p.kern.kurz().slotsLaufen === 2 && lage(p, 1)?.zustand === 'zeigt', 3000)
    && p.kern.kurz().slotsErsatz === 1 && p.kern.kurz().slotsOffen === 0 && p.kern.kurz().slotsAn === 2 && p.kern.kurz().slotsGestopptEntzug === 0);
  ck('… slotKurz je Feld', JSON.stringify(p.kern.kurz().slotKurz) === JSON.stringify([
    { nr: 1, an: true, live: true, alarm: false, tonEin: true, modus: 'teilnehmer', ziel: 'Anna', zustandWort: 'zeigt' },
    { nr: 2, an: true, live: false, alarm: false, tonEin: false, modus: 'sprecher', ziel: '', zustandWort: 'ersatz' },
    { nr: 3, an: false, live: false, alarm: false, tonEin: true, modus: 'freigabe', ziel: '', zustandWort: 'aus' },
  ]));
  await p.aufraeumen();
}

console.log('— KF3 · abbild(): Vorgaben, Sprecher, Vorschau, Zustimmung über 5, Messwerte, Einstellungsdatei');
{
  const p = baueKern({
    vorgaben: { aufloesung: '1080p', tonAn: false }, sprecher: { signal: 'aktivesVideo', haltezeitMs: 2500 }, vorschau: false, ueber5: true,
    einstellungsLage: { gesichert: 'connect-settings.unlesbar-20261020-101010.json', verworfen: 2 }, schreibenLiefert: false,
  });
  const a = p.kern.abbild();
  ck('KF3: vorgaben, sprecher, vorschauAn, ueber5 aus den Einstellungen', JSON.stringify(a.vorgaben) === '{"aufloesung":"1080p","tonAn":false}'
    && JSON.stringify(a.sprecher) === '{"signal":"aktivesVideo","haltezeitMs":2500}' && a.vorschauAn === false && a.ueber5 === true);
  ck('… vorschauVerfuegbar, Messwerte leer (nichts gemeldet)', a.vorschauVerfuegbar === true
    && JSON.stringify(a.messwerte) === '{"bridge":null,"slots":[],"freigaben":null,"sprecherSignale":[]}');
  ck('… einstellungen.gesichert (T90), Hinweis T91 mit der Zahl', a.einstellungen.gesichert === 'connect-settings.unlesbar-20261020-101010.json'
    && a.einstellungen.nurSitzung === false && a.hinweise.includes('2 gespeicherte Slots waren unvollständig oder doppelt und wurden nicht übernommen.'));
  const r = p.kern.slotAnlegen();
  ck('… Schreiben scheitert: Slot angelegt, nurSitzung (T92)', r.ok && p.kern.abbild().einstellungen.nurSitzung === true
    && p.kern.abbild().slots.length === 1 && p.einst.slots.length === 0);
  ck('… ein neuer Slot nimmt die Vorgaben (1080p, Ton aus)', p.kern.abbild().slots[0]?.einstellung.aufloesung === '1080p'
    && p.kern.abbild().slots[0]?.einstellung.tonAn === false);
  await p.aufraeumen();
}

console.log('— KF3 (Hülle) · main/zoom.ts gibt dem Kern die Slot-Felder aus settings.ts, je Feld der passende Leser und Setter');
{
  // Leser und Setter haben paarweise denselben Typ (B-EP16): Eine Vertauschung bestünde die Typprüfung. Darum wörtlich.
  const huelle = readFileSync(new URL('../src/main/zoom.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const VERDRAHTUNG = [
    'slots: zoomSlots,', 'setzeSlots: setzeZoomSlots,', 'vorgaben: zoomSlotVorgaben,', 'setzeVorgaben: setzeZoomSlotVorgaben,',
    'sprecher: zoomSprecher,', 'setzeSprecher: setzeZoomSprecher,', 'vorschau: zoomVorschau,', 'setzeVorschau: setzeZoomVorschau,',
    'ueber5: zoomSlotsUeber5,', 'setzeUeber5: setzeZoomSlotsUeber5,', 'einstellungsLage,',
  ];
  ck('KF3 (Hülle): die elf Zeilen der Slot-Felder stehen wörtlich und in dieser Folge in erzeugeZoomKern({ einstellungen })',
    huelle.includes(VERDRAHTUNG.map((z) => `        ${z}`).join('\n')));
}

// ── Plan B, Task B13: Fernsteuerung, vorübergehende Slots, anNurMeeting, „Behalten“, Nachfrage ab dem 6., Übergang ──
/** Ein Fernsteuer-Befehl, wie ihn der Steuerserver liefert (verb klein, args an Leerzeichen getrennt). */
function befehl(p: Probe, verb: string, ...args: string[]): void {
  p.kern.steuerbefehl({ verb, args });
}
/** `zoom_cmd/zoom_cmd_rejected` aus dem STATE. */
function cmdKv(p: Probe): string {
  return `${p.kern.stateKv()?.zoom_cmd}/${p.kern.stateKv()?.zoom_cmd_rejected}`;
}
const letzterHinweis = (p: Probe): string | undefined => p.kern.abbild().hinweise.at(-1);
const gespeichert = (p: Probe, nr: number): ZoomSlotEinstellung | undefined => p.einst.slots.find((s) => s.nr === nr);

console.log('— PK12 · Nachfrage ab dem 6. eingeschalteten Slot (7.4, E4): T40, Zustimmung gespeichert, Verfall bei höchstens 5');
{
  const p = baueKern({ slots: [1, 2, 3, 4, 5, 6].map((nr) => slotEinst(nr, { an: nr <= 5 })) });
  const r = p.kern.slotStart(6, true);
  ck('PK12: sechster Start → Nachfrage mit T40, nichts geändert', !r.ok && 'nachfrage' in r && r.nachfrage
    && r.text === 'Mehr als 5 Zoom-Slots gleichzeitig sind nicht gemessen. Den 6. Slot trotzdem einschalten? Ob dieser Rechner es schafft, zeigen die Messwerte.'
    && lage(p, 6)?.einstellung.an === false && gespeichert(p, 6)?.an === false && p.einst.ueber5 === false);
  ck('… mit trotz → an, Zustimmung gespeichert', ok(p.kern.slotStart(6, true, true)) && gespeichert(p, 6)?.an === true && p.einst.ueber5 === true
    && p.kern.abbild().ueber5 === true);
  const vorher = p.einst.slots.map((s) => ({ ...s }));
  await p.aufraeumen();
  const q = baueKern({ slots: vorher, ueber5: true });
  await insMeeting(q);
  ck('… ein neuer Kern mit diesen Einstellungen startet beim Beitritt alle 6', await bis(() => slotBefehle(q, 1).filter((c) => c.cmd === 'slotOn').length === 6, 3000)
    && !q.kern.abbild().slots.some((s) => s.zustand === 'zurueckgestellt'));
  ck('… zurück auf 5 → Zustimmung weg', ok(q.kern.slotStart(6, false)) && q.einst.ueber5 === false && q.kern.abbild().ueber5 === false);
  await q.aufraeumen();
}
{
  const p = baueKern({ slots: [1, 2, 3, 4, 5].map((nr) => slotEinst(nr, { an: true })) });
  await insMeeting(p);
  const r = p.kern.slotAusPerson(ANNA);
  ck('PK12: „Als Slot laden“ als 6. → ebenso die Nachfrage, kein Slot angelegt', !r.ok && 'nachfrage' in r && r.text.includes('Den 6. Slot trotzdem einschalten?')
    && p.kern.abbild().slots.length === 5);
  ck('… mit trotz → angelegt, an, Zustimmung gespeichert', ok(p.kern.slotAusPerson(ANNA, true)) && p.kern.abbild().slots.length === 6 && p.einst.ueber5 === true);
  await p.aufraeumen();
}
{
  // Etwa nach einem Absturz mit einem zoom_load-Slot als 6.: gespeichert ist die Zustimmung, eingeschaltet sind nur 5 (RR7).
  const p = baueKern({ ueber5: true, slots: [1, 2, 3, 4, 5].map((nr) => slotEinst(nr, { an: true })) });
  ck('PK12: gespeicherte Zustimmung bei höchstens 5 eingeschalteten Slots → verfällt beim Anlegen des Kerns',
    p.einst.ueber5 === false && p.kern.abbild().ueber5 === false);
  await p.aufraeumen();
}

console.log('— PK23 · Übergang (E13): „Als Slot laden“ legt einen dauerhaften Slot nach der Übergangs-Namensregel an');
{
  const p = baueKern();
  ck('PK23: leere Einstellungen → keine Slots (die Karte zeigt T30)', p.kern.abbild().slots.length === 0);
  await insMeeting(p);
  ck('… „Als Slot laden“ für Anna → dauerhafter Slot 1 „JM Connect – Zoom Anna“, an, gespeichert', ok(p.kern.slotAusPerson(ANNA))
    && JSON.stringify(gespeichert(p, 1)) === JSON.stringify(slotEinst(1, { ndiName: 'JM Connect – Zoom Anna', person: 'Anna', an: true }))
    && lage(p, 1)?.voruebergehend === false);
  ck('… besteht der Name schon an einem anderen Slot → „ (2)“', ok(p.kern.slotAendern(1, { person: 'Ben' })) && ok(p.kern.slotAusPerson(ANNA))
    && gespeichert(p, 2)?.ndiName === 'JM Connect – Zoom Anna (2)');
  await p.aufraeumen();
}

console.log('— PK24 · NDI-Namen im Kern (E26): T43, T44, T45, T47; T46 nur als Warnung; 60 Code-Punkte');
{
  const p = baueKern({ slots: [slotEinst(1), slotEinst(2)], gastLabels: () => ['Bühne Gast'] });
  ck('PK24: leer → T43', text(p.kern.slotAendern(1, { ndiName: '' })) === 'Der NDI-Name muss 1 bis 60 Zeichen lang sein.');
  ck('… 61 Zeichen → T43', text(p.kern.slotAendern(1, { ndiName: 'x'.repeat(61) })) === 'Der NDI-Name muss 1 bis 60 Zeichen lang sein.');
  ck('… Doppelpunkt → T44', text(p.kern.slotAendern(1, { ndiName: 'Bühne: links' }))
    === 'Ein Doppelpunkt ist im NDI-Namen nicht erlaubt (NDI macht daraus ein Leerzeichen).');
  ck('… Name von Slot 2 → T45', text(p.kern.slotAendern(1, { ndiName: 'zoom 2' })) === 'Diesen NDI-Namen trägt schon Slot 2.');
  ck('… Steuerzeichen → T47', text(p.kern.slotAendern(1, { ndiName: 'Bühne\tlinks' })) === 'Steuerzeichen sind im NDI-Namen nicht erlaubt.');
  ck('… nichts davon gespeichert', gespeichert(p, 1)?.ndiName === 'Zoom 1');
  ck('… 59 Zeichen und ein Emoji sind 60 Code-Punkte → gültig', ok(p.kern.slotAendern(1, { ndiName: `${'x'.repeat(59)}🎤` }))
    && gespeichert(p, 1)?.ndiName === `${'x'.repeat(59)}🎤`);
  ck('… Name eines Browser-Gasts → gespeichert, T46 als Warnung unter „Hinweise“', ok(p.kern.slotAendern(2, { ndiName: 'Bühne Gast' }))
    && gespeichert(p, 2)?.ndiName === 'Bühne Gast'
    && letzterHinweis(p) === 'NDI-Name doppelt: Ein Browser-Gast sendet ebenfalls als „Bühne Gast“. Im Switcher ist nicht sicher, welche Quelle ankommt. Einen der beiden umbenennen.'
    && !p.logs.some((z) => z.includes('Bühne Gast')));
  ck('… am eingeschalteten Slot gesperrt → T35', ok(p.kern.slotStart(2, true)) && text(p.kern.slotAendern(2, { ndiName: 'Neu' }))
    === 'Den NDI-Namen erst ändern, wenn der Slot ausgeschaltet ist.');
  await p.aufraeumen();
}
{
  // T46 an der Kachel (7.5 Nr. 9, E42): jedes Abbild prüft gegen die aktuelle Gast-Liste; zoomGastLabelsGeaendert schickt ein neues.
  const gaeste: string[] = [];
  const T46 = 'NDI-Name doppelt: Ein Browser-Gast sendet ebenfalls als „Bühne links“. Im Switcher ist nicht sicher, welche Quelle ankommt. Einen der beiden umbenennen.';
  const p = baueKern({ slots: [slotEinst(1, { ndiName: 'Bühne links', an: true }), slotEinst(2)], gastLabels: () => [...gaeste] });
  const imAbbild = (): string | null | undefined => p.abbilder.at(-1)?.slots.find((s) => s.einstellung.nr === 1)?.ndiWarnung;
  ck('PK24 (Kachel): ohne Gast dieses Namens keine Warnung an der Kachel', lage(p, 1)?.ndiWarnung === null && lage(p, 2)?.ndiWarnung === null);
  gaeste.push('bühne links');
  p.kern.gastLabelsGeaendert();
  ck('… ein Gast sendet später als „bühne links“ → T46 an Slot 1 (gleicher Name nach 6.2), auch im gesendeten Abbild; Slot 2 ohne',
    lage(p, 1)?.ndiWarnung === T46 && lage(p, 2)?.ndiWarnung === null && (await bis(() => imAbbild() === T46, 1000)));
  gaeste.length = 0;
  p.kern.gastLabelsGeaendert();
  ck('… der Gast geht → die Warnung fällt, auch im gesendeten Abbild', lage(p, 1)?.ndiWarnung === null && (await bis(() => imAbbild() === null, 1000)));
  await p.aufraeumen();
}

console.log('— PK35 · Übergangs-Namensregel im Kern: normiereSlot verwirft den so angelegten Slot nicht');
{
  const { normiereSlots } = await import('../src/main/zoom/einstellungen');
  const p = baueKern({
    sitzung: (s) => {
      const a = s.participants.get(ANNA);
      if (!a) return s;
      const participants = new Map(s.participants);
      participants.set(ANNA, { ...a, name: 'Moderation: Anna' });
      return { ...s, participants };
    },
  });
  await insMeeting(p);
  ck('PK35: „Moderation: Anna“ → „JM Connect – Zoom Moderation␣␣Anna“ (zwei Leerzeichen wie 0.3.0)', ok(p.kern.slotAusPerson(ANNA))
    && gespeichert(p, 1)?.ndiName === 'JM Connect – Zoom Moderation  Anna');
  const n = normiereSlots(p.einst.slots);
  ck('… normiereSlot verwirft ihn nicht und ändert den Namen nicht', n.verworfen === 0 && n.slots[0]?.ndiName === 'JM Connect – Zoom Moderation  Anna');
  await p.aufraeumen();
}

console.log('— PK13 · Companion: zoom_slot, zoom_slot_mode, zoom_slot_person, zoom_slot_audio (8.3)');
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Carla' }), slotEinst(2), slotEinst(3, { modus: 'freigabe', tonAn: true, computerton: true })] });
  await insMeeting(p);
  befehl(p, 'zoom_slot', '3', 'ON');
  ck('PK13: zoom_slot 3 ON → an und gespeichert, zoom_cmd ok', cmdKv(p) === 'ok/0' && lage(p, 3)?.einstellung.an === true && gespeichert(p, 3)?.an === true);
  befehl(p, 'zoom_slot', '3', 'TOGGLE');
  ck('… TOGGLE → aus', cmdKv(p) === 'ok/0' && lage(p, 3)?.einstellung.an === false && gespeichert(p, 3)?.an === false);
  befehl(p, 'zoom_slot', '3', 'toggle');
  ck('… toggle (ohne Groß-/Kleinschreibung) → wieder an', cmdKv(p) === 'ok/0' && lage(p, 3)?.einstellung.an === true);
  befehl(p, 'zoom_slot', '3', 'OFF');
  ck('… OFF → aus', cmdKv(p) === 'ok/0' && lage(p, 3)?.einstellung.an === false);
  befehl(p, 'zoom_slot', '7', 'ON');
  ck('… zoom_slot 7 ON ohne Slot 7 → F9, rejected 1', cmdKv(p) === 'f9/1' && letzterHinweis(p) === 'Companion: Slot „7“ gibt es nicht.');
  befehl(p, 'zoom_slot', '1', 'X');
  ck('… zoom_slot 1 X → F13', cmdKv(p) === 'f13/1' && letzterHinweis(p) === 'Companion: Wert „X“ ungültig — erlaubt sind ON, OFF und TOGGLE.');
  befehl(p, 'zoom_slot_mode', '2', 'freigabe');
  ck('… zoom_slot_mode 2 freigabe → Modus gespeichert', cmdKv(p) === 'ok/0' && gespeichert(p, 2)?.modus === 'freigabe');
  befehl(p, 'zoom_slot_mode', '2', 'galerie');
  ck('… zoom_slot_mode 2 galerie → F10', cmdKv(p) === 'f10/1'
    && letzterHinweis(p) === 'Companion: Modus „galerie“ unbekannt — erlaubt sind teilnehmer, sprecher und freigabe.');
  befehl(p, 'zoom_slot_mode', '1', 'sprecher');
  befehl(p, 'zoom_slot_person', '1', 'Anna', 'Maria');
  ck('… zoom_slot_person 1 Anna Maria → Person „Anna Maria“, Modus Teilnehmer', cmdKv(p) === 'ok/0' && gespeichert(p, 1)?.person === 'Anna Maria'
    && gespeichert(p, 1)?.modus === 'teilnehmer');
  befehl(p, 'zoom_slot_person', '1');
  ck('… ohne Namen → F11', cmdKv(p) === 'f11/1' && letzterHinweis(p) === 'Companion: Slot 1: kein Anzeigename angegeben.');
  befehl(p, 'zoom_slot_audio', '3', 'OFF');
  ck('… zoom_slot_audio 3 OFF am Freigabe-Slot mit Computerton → Ton und Computerton aus, Ton eingeschaltet 0',
    cmdKv(p) === 'ok/0' && gespeichert(p, 3)?.tonAn === false && gespeichert(p, 3)?.computerton === false && slotKurz(p, 3)?.tonEin === false);
  befehl(p, 'zoom_slot_audio', '3', 'ON');
  ck('… ON stellt beide wieder her', cmdKv(p) === 'ok/0' && gespeichert(p, 3)?.tonAn === true && gespeichert(p, 3)?.computerton === true
    && slotKurz(p, 3)?.tonEin === true);
  befehl(p, 'zoom_slot_audio', '3', 'TOGGLE');
  ck('… TOGGLE löst über „Ton eingeschaltet“ auf → aus', slotKurz(p, 3)?.tonEin === false);
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { modus: 'sprecher', tonAn: false, tonArt: 'person' })] });
  befehl(p, 'zoom_slot_audio', '1', 'ON');
  ck('PK13: zoom_slot_audio ON bei Tonart Person außerhalb des Modus Teilnehmer → ausgeführt mit Warnung F12, rejected 0',
    cmdKv(p) === 'f12/0' && gespeichert(p, 1)?.tonAn === true
    && letzterHinweis(p) === 'Companion: Slot 1: Person-Ton gibt es nur im Modus Teilnehmer, der Slot sendet keinen Meeting-Ton.');
  await p.aufraeumen();
}

console.log('— PK13 · Companion: zoom_load und zoom_unload über vorübergehende Slots (7.2, 8.3, 8.4)');
{
  const p = baueKern({ stell: (n): Record<string, string> => (n === 1 ? { FAKE_PRIVILEGE: 'offen' } : { FAKE_DOPPELNAME: '1' }) });
  befehl(p, 'zoom_load', 'Anna');
  ck('PK13: zoom_load ohne Meeting → F4 „nicht im Meeting“, rejected 1', cmdKv(p) === 'f4/1'
    && letzterHinweis(p) === 'Companion: Laden nicht möglich — nicht im Meeting.');
  befehl(p, 'zoom_load');
  ck('… ohne Namen → F1', cmdKv(p) === 'f1/1' && letzterHinweis(p) === 'Companion: kein Anzeigename angegeben.');
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: ANZEIGENAME_VORGABE });
  ck('… im Meeting ohne Aufnahme-Erlaubnis → F4 „keine Aufnahme-Erlaubnis“', r.ok
    && (await bis(() => p.kern.kurz().zustand === 'im_meeting', 4000)) && (befehl(p, 'zoom_load', 'Anna'), cmdKv(p) === 'f4/1')
    && letzterHinweis(p) === 'Companion: Laden nicht möglich — keine Aufnahme-Erlaubnis.' && p.kern.abbild().slots.length === 0);
  await p.kern.verlassen();
  ck('… zwei „Anna“ → F3 mit der Zahl', (await insMeeting(p)) && (befehl(p, 'zoom_load', 'Anna'), cmdKv(p) === 'f3/1')
    && letzterHinweis(p) === 'Companion: „Anna“ ist nicht eindeutig (2 Personen) — bitte in Connect von Hand laden.');
  befehl(p, 'zoom_load', 'Zora');
  ck('… niemand namens „Zora“ → F2', cmdKv(p) === 'f2/1' && letzterHinweis(p) === 'Companion: niemand namens „Zora“ im Meeting.'
    && p.kern.abbild().slots.length === 0);
  befehl(p, 'zoom_xyz');
  ck('… ein unbekanntes Verb bleibt F7', cmdKv(p) === 'f7/1' && letzterHinweis(p) === 'Companion: unbekannter Befehl „zoom_xyz“.');
  ck('… das Log nennt Kennung und Verb, nie einen Namen', p.logs.includes('[zoom] Hinweis: Companion: F3 (zoom_load)')
    && !p.logs.some((z) => z.includes('Zora')));
  await p.aufraeumen();
}
{
  const p = baueKern({
    sitzung: (s) => {
      const a = s.participants.get(ANNA);
      if (!a) return s;
      const participants = new Map(s.participants);
      participants.set(ANNA, { ...a, inWaitingRoom: true });
      return { ...s, participants };
    },
  });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Anna');
  ck('PK13: zoom_load für eine Person im Warteraum → F4 „die Person ist im Warteraum“', cmdKv(p) === 'f4/1'
    && letzterHinweis(p) === 'Companion: Laden nicht möglich — die Person ist im Warteraum.' && p.kern.abbild().slots.length === 0);
  await p.aufraeumen();
}
{
  const p = baueKern();
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  ck('PK13: zoom_load Ben → vorübergehender Slot 1 „JM Connect – Zoom Ben“, an, nicht gespeichert', cmdKv(p) === 'ok/0'
    && lage(p, 1)?.voruebergehend === true && lage(p, 1)?.einstellung.ndiName === 'JM Connect – Zoom Ben' && lage(p, 1)?.einstellung.person === 'Ben'
    && lage(p, 1)?.einstellung.an === true && p.einst.slots.length === 0);
  ck('… läuft', await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000));
  befehl(p, 'zoom_load', 'ben');
  ck('… ein zweites zoom_load Ben nimmt denselben Slot', cmdKv(p) === 'ok/0' && p.kern.abbild().slots.length === 1);
  befehl(p, 'zoom_unload', 'Ben');
  ck('… zoom_unload Ben → ausgeschaltet und gelöscht', cmdKv(p) === 'ok/0' && (await bis(() => lage(p, 1) === undefined, 3000))
    && slotBefehle(p, 1).some((c) => c.cmd === 'slotOff' && c.slot === 1) && p.kern.kurz().slotsLaufen === 0);
  befehl(p, 'zoom_unload', 'Ben');
  ck('… noch einmal → F5', cmdKv(p) === 'f5/1' && letzterHinweis(p) === 'Companion: kein eingeschalteter Teilnehmer-Slot mit „Ben“.');
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_TEILNEHMER: '17' }) });
  await insMeeting(p);
  const namen = p.kern.abbild().teilnehmer.map((t) => t.name);
  let ergebnisse = '';
  for (const n of namen) {
    befehl(p, 'zoom_load', ...n.split(' '));
    ergebnisse += cmdKv(p) === 'ok/0' ? '' : `${n}:${cmdKv(p)} `;
    befehl(p, 'zoom_unload', ...n.split(' '));
    await bis(() => p.kern.abbild().slots.length === 0, 2000);
  }
  ck(`PK13: 17 verschiedene Namen nacheinander per zoom_load und zoom_unload → nie F14${ergebnisse ? ` (${ergebnisse})` : ''}`,
    namen.length === 17 && ergebnisse === '' && p.kern.abbild().slots.length === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: Array.from({ length: 16 }, (_, i) => slotEinst(i + 1)) });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Anna');
  ck('PK13: 16 belegte Slots → zoom_load F14, rejected 1', cmdKv(p) === 'f14/1'
    && letzterHinweis(p) === 'Companion: kein freier Slot (höchstens 16, vorübergehende eingerechnet).' && p.kern.abbild().slots.length === 16);
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Ben' })], stell: (n): Record<string, string> => (n === 1 ? { FAKE_MEETING_ENDE_MS: '3000' } : {}) });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Anna');
  befehl(p, 'zoom_load', 'Ben');
  ck('PK13: zoom_load Ben schaltet den ausgeschalteten dauerhaften Slot 1 nur für dieses Meeting ein; gespeichert bleibt an: false',
    cmdKv(p) === 'ok/0' && lage(p, 1)?.anNurMeeting === true && lage(p, 1)?.einstellung.an === true && gespeichert(p, 1)?.an === false
    && slotKurz(p, 1)?.an === true);
  ck('… Anna in einem vorübergehenden Slot 2', lage(p, 2)?.voruebergehend === true && lage(p, 2)?.einstellung.person === 'Anna');
  ck('… beide laufen', await bis(() => p.kern.kurz().slotsLaufen === 2, 3000));
  ck('… nach dem Meeting-Ende: Slot 2 gelöscht, Slot 1 aus, anNurMeeting weg, gespeichert unverändert',
    (await bis(() => p.kern.kurz().zustand === 'bereit', 4000)) && lage(p, 2) === undefined && lage(p, 1)?.einstellung.an === false
      && lage(p, 1)?.anNurMeeting === false && p.einst.slots.length === 1 && gespeichert(p, 1)?.an === false);
  ck('… ein neuer Beitritt startet keinen früheren zoom_load-Slot', (await insMeeting(p)) && (await warte(800), slotGesendet(p, 2).length === 0));
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Ben' }), slotEinst(2, { person: 'Anna' })] });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  befehl(p, 'zoom_unload', 'Ben');
  ck('PK13: zoom_unload Ben → der dauerhafte Slot 1 geht nur aus und bleibt gespeichert', cmdKv(p) === 'ok/0' && lage(p, 1)?.einstellung.an === false
    && lage(p, 1)?.anNurMeeting === false && p.einst.slots.length === 2);
  befehl(p, 'zoom_load', 'Ben');
  ck('… „Behalten“ hebt anNurMeeting auf und speichert die Start-Taste', lage(p, 1)?.anNurMeeting === true && ok(p.kern.slotBehalten(1))
    && lage(p, 1)?.anNurMeeting === false && gespeichert(p, 1)?.an === true);
  befehl(p, 'zoom_load', 'Anna');
  befehl(p, 'zoom_slot', '2', 'ON');
  ck('… zoom_slot 2 ON hebt anNurMeeting ebenso auf und speichert', lage(p, 2)?.anNurMeeting === false && gespeichert(p, 2)?.an === true);
  befehl(p, 'zoom_slot', '2', 'OFF');
  befehl(p, 'zoom_load', 'Anna');
  ck('… „Stopp“ und „Start“ an der Kachel ebenso', lage(p, 2)?.anNurMeeting === true && ok(p.kern.slotStart(2, false))
    && ok(p.kern.slotStart(2, true)) && lage(p, 2)?.anNurMeeting === false && gespeichert(p, 2)?.an === true);
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [...[1, 2, 3, 4, 5].map((nr) => slotEinst(nr, { an: true })), slotEinst(6)] });
  befehl(p, 'zoom_slot', '6', 'ON');
  ck('PK13: der 6. per Companion → F8, an, Zustimmung gesetzt, zoom_cmd_rejected=0', cmdKv(p) === 'f8/0' && lage(p, 6)?.einstellung.an === true
    && p.einst.ueber5 === true && letzterHinweis(p) === 'Companion: 6. Slot eingeschaltet — mehr als 5 sind nicht gemessen.');
  await p.aufraeumen();
}
{
  const p = baueKern({
    slots: [1, 2, 3, 4, 5].map((nr) => slotEinst(nr, { an: true })),
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_MEETING_ENDE_MS: '2500' } : {}),
  });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  ck('PK13: zoom_load als 6. eingeschalteter Slot (F8 aus 0.3.0) → f8/0, vorübergehender Slot 6 an, Zustimmung gesetzt',
    cmdKv(p) === 'f8/0' && letzterHinweis(p) === 'Companion: 6. Slot eingeschaltet — mehr als 5 sind nicht gemessen.'
    && lage(p, 6)?.voruebergehend === true && lage(p, 6)?.einstellung.an === true && p.einst.ueber5 === true);
  ck('… Slot 6 startet (nicht zurückgestellt)', await bis(() => slotGesendet(p, 1, 6).some((c) => c.cmd === 'slotOn'), 3000)
    && lage(p, 6)?.zustand !== 'zurueckgestellt');
  ck('… mit dem Meeting-Ende verschwindet Slot 6, und die Zustimmung verfällt (7.4, RR7)', (await bis(() => p.kern.kurz().zustand === 'bereit', 5000))
    && lage(p, 6) === undefined && p.einst.ueber5 === false && p.kern.abbild().ueber5 === false);
  await p.aufraeumen();
}
{
  const p = baueKern();
  await insMeeting(p);
  befehl(p, 'zoom_delay', '300');
  ck('PK13: zoom_delay 300 (Fall 21 aus 0.3.0) → ok, gespeichert, videoDelay 300 an die Bridge', cmdKv(p) === 'ok/0' && p.einst.versatzMs === 300
    && (await bis(() => p.befehle(1).some((c) => c.cmd === 'videoDelay' && c.ms === 300), 2000)));
  befehl(p, 'zoom_delay', '1001');
  ck('… zoom_delay 1001 → F6, rejected 1, nichts gespeichert', cmdKv(p) === 'f6/1' && p.einst.versatzMs === 300
    && letzterHinweis(p) === 'Companion: Versatz „1001“ ungültig — erlaubt sind ganze Zahlen von 0 bis 1000.');
  await p.aufraeumen();
}
{
  const p = baueKern({ schreibenLiefert: false });
  befehl(p, 'zoom_delay', '200');
  ck('PK13: zoom_delay, Einstellungsdatei nicht schreibbar → zoom_cmd=ok (L14), das Abbild sagt „nur Sitzung“', cmdKv(p) === 'ok/0'
    && p.kern.abbild().versatz.nurSitzung && p.einst.versatzMs === 200);
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true }), slotEinst(2, { person: 'anna', an: true }), slotEinst(3, { person: 'Ben', an: true })] });
  await insMeeting(p);
  ck('PK13: zwei Slots für „Anna“ und einer für Ben laufen', await bis(() => p.kern.kurz().slotsLaufen === 3, 3000));
  befehl(p, 'zoom_unload', 'Anna');
  ck('… zoom_unload Anna → beide Anna-Slots aus und gespeichert aus, Bens bleibt an, ok', cmdKv(p) === 'ok/0'
    && gespeichert(p, 1)?.an === false && gespeichert(p, 2)?.an === false && gespeichert(p, 3)?.an === true
    && (await bis(() => p.kern.kurz().slotsLaufen === 1, 3000))
    && JSON.stringify(slotGesendet(p, 1).filter((c) => c.cmd === 'slotOff').map((c) => c.slot)) === '[1,2]');
  await p.aufraeumen();
}
{
  const p = baueKern();
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  befehl(p, 'zoom_load', 'Ben');
  ck('PK13: Taste prellt (zweimal zoom_load Ben vor der Antwort) → ok, rejected 0, ein Slot ohne „(2)“', cmdKv(p) === 'ok/0'
    && p.kern.abbild().slots.length === 1 && lage(p, 1)?.einstellung.ndiName === 'JM Connect – Zoom Ben');
  ck('… genau ein slotOn', await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000) && (await warte(300), slotGesendet(p, 1).filter((c) => c.cmd === 'slotOn').length === 1));
  befehl(p, 'zoom_unload', 'Ben');
  befehl(p, 'zoom_unload', 'Ben');
  ck('… Taste prellt bei zoom_unload: das zweite meldet F5 (8.3: kein eingeschalteter Slot mehr, Vorgabe OFP12), der Slot geht weg, keine Fehlerzeile',
    cmdKv(p) === 'f5/1' && (await bis(() => lage(p, 1) === undefined, 3000))
    && slotGesendet(p, 1).filter((c) => c.cmd === 'slotOff').length === 1 && !p.abbilder.some((a) => a.slots.some((s) => s.fehler !== null)));
  await p.aufraeumen();
}

console.log('— PK32 · Vorübergehender Slot „Behalten“: dauerhaft, gespeichert, überlebt das Meeting-Ende');
{
  const p = baueKern({ stell: () => ({ FAKE_MEETING_ENDE_MS: '1500' }) });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  ck('PK32: zoom_load Ben → vorübergehend', lage(p, 1)?.voruebergehend === true && p.einst.slots.length === 0);
  ck('… slotBehalten → dauerhaft und gespeichert (an)', ok(p.kern.slotBehalten(1)) && lage(p, 1)?.voruebergehend === false
    && gespeichert(p, 1)?.ndiName === 'JM Connect – Zoom Ben' && gespeichert(p, 1)?.an === true);
  ck('… überlebt das Meeting-Ende, bleibt eingeschaltet', (await bis(() => p.kern.kurz().zustand === 'bereit', 4000))
    && lage(p, 1)?.einstellung.an === true && p.einst.slots.length === 1);
  await p.aufraeumen();
}
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

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

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

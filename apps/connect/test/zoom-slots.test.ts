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
  type ZoomKernAbhaengigkeiten,
} from '../src/main/zoom/kern';
import type { LaufzeitPfade } from '../src/main/zoom/laufzeit';
import type {
  ZoomAbbild, ZoomErgebnis, ZoomKurz, ZoomSlotEinstellung, ZoomSlotLage, ZoomSlotVorgaben, ZoomSprecherEinstellung,
} from '../src/shared/types';
import { kartenZeile, zoomZ, zoomZeile } from '../src/shared/zoom-text';

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
// Gesamtwache (G-B6, B-EP17): hängt ein Fall, endet der Lauf rot statt nie. Plan B, Task B17: gemessen 118 s (117,6 s), die
// Wache steht auf dem Doppelten, auf volle 10 s aufgerundet (Slot-Spec 11.4).
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
  /** Schalter „Person im NDI-Namen“ (#287). */
  personImNdiNamen: boolean;
  vorschau: boolean;
  ueber5: boolean;
  /** Bild-Versatz (zoom_delay, 6.7): gespeicherter Wert und „nur diese Sitzung“ nach einem Schreibfehler (L14). */
  versatzMs: number;
  versatzNurSitzung: boolean;
  /** Was die Setter melden (Startwert aus BaueOptionen); `scheitert`: diese Felder scheitern dazu (Nachtrag B, M2, NB9). */
  schreibenLiefert: boolean;
  scheitert: Set<SlotFeld>;
  /** Felder, deren letztes Schreiben scheiterte, wie die …Sitzung-Werte in settings.ts; daraus einstellungsLage().nurSitzung (T92, NB9). */
  nurSitzung: Set<SlotFeld>;
}
/** Die Slot-Felder der Einstellungsdatei mit eigenem Setter (Spec 7.2). */
type SlotFeld = 'slots' | 'vorgaben' | 'sprecher' | 'personImNdiNamen' | 'vorschau' | 'ueber5';
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
  /** Schalter „Person im NDI-Namen“ (#287); fehlt = aus. */
  personImNdiNamen?: boolean;
  vorschau?: boolean;
  ueber5?: boolean;
  /** Was die Setter der Slot-Felder melden; false = Einstellungsdatei nicht schreibbar (nur diese Sitzung, T92). */
  schreibenLiefert?: boolean;
  /** Nur diese Felder lassen sich nicht schreiben (Nachtrag B, M2). */
  scheitert?: SlotFeld[];
  einstellungsLage?: { gesichert: string | null; verworfen: number };
  /** Laufzeit-Dienste (Mangel im Wiederbeitritt, PK11); fehlt = immer eingerichtet. */
  laufzeit?: ZoomKernAbhaengigkeiten['laufzeit'];
  /** Startwert des Hauptfensters (7.7); fehlt = wie die Hülle vor dem ersten Fenster: nicht sichtbar. */
  fensterSichtbar?: boolean;
  onVorschau?: ZoomKernAbhaengigkeiten['onVorschau'];
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
    personImNdiNamen: o.personImNdiNamen ?? false,
    vorschau: o.vorschau ?? true,
    ueber5: o.ueber5 ?? false,
    versatzMs: 0,
    versatzNurSitzung: false,
    schreibenLiefert: o.schreibenLiefert ?? true,
    scheitert: new Set(o.scheitert ?? []),
    nurSitzung: new Set(),
  };
  const liefert = (feld?: SlotFeld): boolean => einst.schreibenLiefert && (feld === undefined || !einst.scheitert.has(feld));
  /** Ein Setter schreibt `feld`: Ergebnis wie liefert(), dazu die Lage „nur diese Sitzung“ wie settings.ts (NB9). */
  const geschrieben = (feld: SlotFeld): boolean => {
    const ok = liefert(feld);
    if (ok) einst.nurSitzung.delete(feld);
    else einst.nurSitzung.add(feld);
    return ok;
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
      letztesMeeting: () => null,
      meetingMerken: () => ({ kenncodeGespeichert: false }),
      meetingVergessen: () => true,
      slots: () => einst.slots.map((s) => ({ ...s })),
      setzeSlots: (s) => {
        einst.schreibvorgaenge += 1;
        const ok = geschrieben('slots');
        if (ok) einst.slots = s.map((x) => ({ ...x }));
        return ok;
      },
      vorgaben: () => ({ ...einst.vorgaben }),
      setzeVorgaben: (v) => {
        const ok = geschrieben('vorgaben');
        if (ok) einst.vorgaben = { ...v };
        return ok;
      },
      sprecher: () => ({ ...einst.sprecher }),
      setzeSprecher: (s) => {
        const ok = geschrieben('sprecher');
        if (ok) einst.sprecher = { ...s };
        return ok;
      },
      personImNdiNamen: () => einst.personImNdiNamen,
      setzePersonImNdiNamen: (an) => {
        // Wie settings.ts: Scheitert das Schreiben, gilt der Wert für diese Sitzung (T92).
        einst.personImNdiNamen = an;
        return geschrieben('personImNdiNamen');
      },
      vorschau: () => einst.vorschau,
      setzeVorschau: (an) => {
        const ok = geschrieben('vorschau');
        if (ok) einst.vorschau = an;
        return ok;
      },
      ueber5: () => einst.ueber5,
      setzeUeber5: (an) => {
        const ok = geschrieben('ueber5');
        if (ok) einst.ueber5 = an;
        return ok;
      },
      einstellungsLage: () => ({ ...(o.einstellungsLage ?? { gesichert: null, verworfen: 0 }), nurSitzung: einst.nurSitzung.size > 0 }),
    },
    sdkSchluessel: { lesen: () => ({ wert: null, herkunft: 'none' }), speichern: () => 'stored', loeschen: () => true },
    gastLabels: o.gastLabels ?? (() => []),
    log: (z) => logs.push(z),
    onAbbild: (a) => abbilder.push(a),
    onKurz: (k) => kurze.push(k),
    bridgeFabrik: fabrik,
    laufzeit: o.laufzeit ?? { pruefe: () => ({ ok: true, ordner, ersetzt: [] }) },
    proxyUrl: () => 'https://proxy.test',
    fristen: { anmeldeMs: 3000, joinTimeoutMs: 3000, killTimeoutMs: 2000, ...o.fristen },
    wiederbeitrittPlanMs: o.wiederbeitrittPlanMs ?? [30, 30, 30, 30, 30],
    ...(o.fensterSichtbar !== undefined ? { fensterSichtbar: o.fensterSichtbar } : {}),
    ...(o.onVorschau ? { onVorschau: o.onVorschau } : {}),
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
  // Nachtrag B (M2): Mit ueber5 und keinem eingeschalteten Slot verfällt die Zustimmung schon beim Anlegen des Kerns; dieses
  // Schreiben scheitert hier, darum steht T92 (vorher still, das war der Befund M2).
  ck('… einstellungen.gesichert (T90), Hinweis T91 mit der Zahl; T92 aus dem gescheiterten Verfall der Zustimmung (M2)',
    a.einstellungen.gesichert === 'connect-settings.unlesbar-20261020-101010.json'
    && a.einstellungen.nurSitzung === true && a.hinweise.includes('2 gespeicherte Slots waren unvollständig oder doppelt und wurden nicht übernommen.'));
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
    'sprecher: zoomSprecher,', 'setzeSprecher: setzeZoomSprecher,',
    // #287: Schalter „Person im NDI-Namen“; gleicher Typ wie vorschau/ueber5, darum ebenfalls wörtlich.
    'personImNdiNamen: zoomPersonImNdiNamen,', 'setzePersonImNdiNamen: setzeZoomPersonImNdiNamen,',
    'vorschau: zoomVorschau,', 'setzeVorschau: setzeZoomVorschau,',
    'ueber5: zoomSlotsUeber5,', 'setzeUeber5: setzeZoomSlotsUeber5,', 'einstellungsLage,',
  ];
  ck('KF3 (Hülle): die dreizehn Zeilen der Slot-Felder stehen wörtlich und in dieser Folge in erzeugeZoomKern({ einstellungen })',
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
// ── Plan B, Task B14: Erlaubnis, Entzug, Wiederbeitritt, Zoom verbindet neu, Fehlerstände, Hinweise, Ton-Abo-Fehler ──
/**
 * Ein `slot`-Ereignis, wie es die Bridge `startNr` meldet (eingespeist, PK29). Mit `ndi` wie jedes Ereignis der Bridge (6.3): Der
 * Name eines Slots aus slotEinst ist „Zoom {nr}“; ein Ereignis mit anderem Namen gehört nicht zum Slot (Nachtrag B, I-3).
 */
function slotEv(slot: number, state: string, target: number, reason: string, mode = 'participant'): Record<string, unknown> {
  return { ev: 'slot', slot, state, mode, target, share: 0, reason, sent: state === 'live' ? 'none' : 'transparent', ndi: `Zoom ${slot}` };
}
const T104_ABO = 'Ton nicht verfügbar (AUDIO_SUBSCRIBE_FAILED) — das Bild läuft ohne Ton. Für einen neuen Versuch den Ton aus- und wieder einschalten.';

console.log('— PK3 · Erlaubnis offen, Entzug und Wiedererteilung (0.12, T12b, T82)');
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: () => ({ FAKE_PRIVILEGE: 'offen' }) });
  const r = await p.kern.beitreten({ nummer: NUMMER, kenncode: KENNCODE, anzeigename: ANZEIGENAME_VORGABE });
  ck('PK3: erster Beitritt, Erlaubnis offen → Z6, zoom_alarm=0, kein slotOn', r.ok && (await bis(() => p.kern.kurz().zustand === 'im_meeting', 4000))
    && (await warte(600), zoomZ(p.kern.kurz()) === 'Z6') && p.kern.stateKv()?.zoom_alarm === 0 && slotGesendet(p, 1).length === 0
    && lage(p, 1)?.text === 'Wartet auf die Aufnahme-Erlaubnis des Hosts.');
  await p.aufraeumen();
}
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true }), slotEinst(2, { modus: 'sprecher', an: true })],
    stell: () => ({ FAKE_ENTZUG_MS: '1200', FAKE_ERTEILUNG_MS: '1500' }),
  });
  await insMeeting(p);
  ck('PK3: beide Slots laufen', await bis(() => p.kern.kurz().slotsLaufen === 2, 3000));
  const vorher = slotBefehle(p, 1).filter((c) => c.cmd === 'slotOn').map((c) => JSON.stringify(c));
  ck('… nach dem Entzug T12b, Z7 mit T82, zoom_alarm=1', await bis(() => lage(p, 1)?.text
    === 'Gestoppt: Der Host hat die Aufnahme-Erlaubnis entzogen. Erteilt er sie wieder, startet der Slot von selbst.'
    && zoomZ(p.kern.kurz()) === 'Z7'
    && kartenZeile(p.kern.abbild(), Date.now())
      === 'Aufnahme-Erlaubnis vom Host entzogen, Slots gestoppt. Erteilt der Host sie im Zoom-Client wieder, startet Connect die eingeschalteten Slots von selbst.'
    && p.kern.stateKv()?.zoom_alarm === 1, 3000));
  ck('… nach der Wiedererteilung beide wieder gestartet, mit unveränderten Einstellungen', await bis(() => p.kern.kurz().slotsLaufen === 2
    && slotBefehle(p, 1).filter((c) => c.cmd === 'slotOn').length === 4, 4000)
    && JSON.stringify(slotBefehle(p, 1).filter((c) => c.cmd === 'slotOn').slice(2).map((c) => JSON.stringify(c))) === JSON.stringify(vorher));
  await p.aufraeumen();
}

console.log('— PK11 · Meeting-Ende und Mangel im Wiederbeitritt: Slots, Sitzung und Alarm (7.2, 7.3 Nr. 8, RR1)');
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true }), slotEinst(2, { person: 'Ben' }), slotEinst(3, { person: 'Carla', an: true })],
    stell: (n): Record<string, string> => (n === 1
      ? { FAKE_TEILNEHMER: '4', FAKE_MEETING_ENDE_MS: '2500', FAKE_SLOT_FEHLER: '3:slotRendererFailed' } : {}),
  });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  befehl(p, 'zoom_load', 'Dora');
  ck('PK11: vor dem Ende: Slot 1 lief, Slot 2 nur dieses Meeting, Slot 3 gescheitert, Slot 4 vorübergehend, zoom_alarm=1',
    await bis(() => lage(p, 1)?.liefSchon === true && lage(p, 3)?.zustand === 'gescheitert', 2000)
      && lage(p, 2)?.anNurMeeting === true && lage(p, 4)?.voruebergehend === true && p.kern.stateKv()?.zoom_alarm === 1);
  ck('… nach dem Meeting-Ende: dauerhafte gespeichert und eingeschaltet, vorübergehender gelöscht, anNurMeeting aus',
    (await bis(() => p.kern.kurz().zustand === 'bereit', 4000)) && lage(p, 4) === undefined && lage(p, 2)?.einstellung.an === false
      && lage(p, 1)?.einstellung.an === true && lage(p, 3)?.einstellung.an === true && p.einst.slots.map((s) => `${s.nr}:${s.an}`).join(',') === '1:true,2:false,3:true');
  ck('… T11b, liefSchon, zeigteSchon und Fehlerstände gelöscht, zoom_alarm=0',
    lage(p, 1)?.text === 'Wartet auf den Beitritt zu einem Meeting.' && lage(p, 3)?.text === 'Wartet auf den Beitritt zu einem Meeting.'
      && p.kern.abbild().slots.every((s) => !s.liefSchon && !s.zeigteSchon && !s.offen) && p.kern.stateKv()?.zoom_alarm === 0);
  await p.aufraeumen();
}
{
  let pruefungen = 0;
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true }), slotEinst(3, { person: 'Carla', an: true })],
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_TEILNEHMER: '3', FAKE_VERBINDUNG_WEG_MS: '1800', FAKE_SLOT_FEHLER: '3:slotRendererFailed' } : {}),
    // Aufrufe von pruefe: 1 beim Anlegen des Kerns, 2 Start 1, 3 Versuch 1 → Mangel (Muster zoom-kern.test.ts „Mangel vor Versuch 2“).
    laufzeit: {
      pruefe: () => (++pruefungen === 3 ? { ok: false, mangel: 'sdk_defekt', datei: 'sdk.dll' } : { ok: true, ordner: 'C:/laufzeit', ersetzt: [] }),
    },
  });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  ck('PK11 (Mangel): Slot 1 lief, Slot 3 gescheitert, Slot 2 vorübergehend', await bis(() => lage(p, 1)?.liefSchon === true
    && lage(p, 3)?.zustand === 'gescheitert' && lage(p, 2)?.voruebergehend === true, 2000));
  ck('… Mangel im Wiederbeitritt (Z1a): vorübergehender gelöscht, liefSchon und Fehlerstände gelöscht, jedes zoom_slot{n}_alarm=0',
    (await bis(() => p.kern.kurz().zustand === 'einrichtung', 6000)) && zoomZ(p.kern.kurz()) === 'Z1a' && lage(p, 2) === undefined
      && p.kern.abbild().slots.every((s) => !s.liefSchon && !s.zeigteSchon) && p.kern.kurz().slotKurz.every((s) => !s.alarm)
      && lage(p, 3)?.zustand === 'ohne_meeting' && p.kern.stateKv()?.zoom_alarm === 0);
  await p.aufraeumen();
}
/** Ruling 08.10.2026 (7.3 Nr. 8): ein Abbild ohne vorübergehenden Slot, ohne `anNurMeeting` und ohne Slot-Alarm. */
const ohneMeetingSlots = (a: ZoomAbbild): boolean =>
  a.slots.every((s) => !s.voruebergehend && !s.anNurMeeting) && a.kurz.slotKurz.every((s) => !s.alarm);
console.log('— PK11 · Verlassen und Beenden leeren vor dem Abbau, Meeting-Ende und „Schließen“ ebenso (Ruling 08.10.2026, 7.3 Nr. 8)');
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Ben' })], stell: () => ({ FAKE_ABGANG_MS: '800' }), fristen: { abbildTaktMs: 0 } });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  befehl(p, 'zoom_load', 'Anna');
  const geladen = (await bis(() => p.kern.kurz().slotsLaufen === 2, 3000)) && lage(p, 1)?.anNurMeeting === true && lage(p, 2)?.voruebergehend === true;
  const ab = p.abbilder.length;
  await p.kern.verlassen();
  const inZ12 = p.abbilder.slice(ab).filter((a) => a.kurz.zustand === 'verlaesst');
  ck('PK11 (Verlassen): ab dem ersten Abbild in Z12 kein vorübergehender Slot, kein anNurMeeting, kein Slot-Alarm',
    geladen && inZ12.length > 0 && inZ12.every(ohneMeetingSlots));
  ck('… danach bereit: Slot 1 aus (gespeichert aus), Slot 2 gelöscht, zoom_alarm=0', p.kern.kurz().zustand === 'bereit'
    && lage(p, 1)?.einstellung.an === false && gespeichert(p, 1)?.an === false && lage(p, 2) === undefined && p.kern.stateKv()?.zoom_alarm === 0);
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Ben' })], stell: () => ({ FAKE_ABGANG_MS: '800' }), fristen: { abbildTaktMs: 0 } });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  befehl(p, 'zoom_load', 'Anna');
  const geladen = await bis(() => p.kern.kurz().slotsLaufen === 2, 3000);
  const ab = p.abbilder.length;
  await p.kern.beenden(5000);
  const inZ12 = p.abbilder.slice(ab).filter((a) => a.kurz.zustand === 'verlaesst');
  ck('PK11 (Beenden im Meeting): ab dem ersten Abbild in Z12 kein vorübergehender Slot, kein anNurMeeting, kein Slot-Alarm',
    geladen && inZ12.length > 0 && inZ12.every(ohneMeetingSlots));
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Ben' })], stell: () => ({ FAKE_MEETING_ENDE_MS: '1500', FAKE_ABGANG_MS: '600' }), fristen: { abbildTaktMs: 0 } });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  befehl(p, 'zoom_load', 'Anna');
  const geladen = await bis(() => p.kern.kurz().slotsLaufen === 2, 3000);
  const ende = await bis(() => p.kern.kurz().zustand === 'bereit', 4000);
  await bis(() => !p.kern.laeuft(), 3000);
  const abMeeting = p.abbilder.slice(Math.max(0, p.abbilder.findIndex((a) => a.kurz.zustand === 'im_meeting')));
  const nachEnde = abMeeting.slice(Math.max(0, abMeeting.findIndex((a) => a.kurz.zustand === 'bereit')));
  ck('PK11 (Meeting-Ende): ab dem ersten Abbild in bereit kein vorübergehender Slot, kein anNurMeeting, auch während die Bridge abbaut',
    geladen && ende && nachEnde[0]?.kurz.zustand === 'bereit' && nachEnde.every(ohneMeetingSlots));
  await p.aufraeumen();
}
{
  // „Schließen“ nach „Abbrechen“ (R7, Z13): Bis dahin bleibt der vorübergehende Slot (7.2: nicht bei Z11), danach in keinem Abbild.
  const p = baueKern({
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '800' } : n === 2 ? { FAKE_BEITRITT_SCHEITERT: '2' } : {}),
    wiederbeitrittPlanMs: [30, 1500, 30, 30, 30],
    fristen: { abbildTaktMs: 0 },
  });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  const bereitZumAbbruch = (await bis(() => p.kern.kurz().slotsLaufen === 1, 3000)) && (await bis(() => p.kern.kurz().versuch === 2, 5000));
  p.kern.abbrechen();
  const imFehler = p.kern.kurz().zustand === 'fehler' && lage(p, 1)?.voruebergehend === true;
  const ab = p.abbilder.length;
  p.kern.schliessen();
  await warte(300);
  ck('PK11 („Schließen“ nach R7): bereit, ab dem nächsten Abbild kein vorübergehender Slot mehr',
    bereitZumAbbruch && imFehler && p.kern.kurz().zustand === 'bereit' && p.abbilder.length > ab && p.abbilder.slice(ab).every(ohneMeetingSlots)
    && lage(p, 1) === undefined);
  await p.aufraeumen();
}

console.log('— PK18 · Aufbaufehler: T23 mit T101, Fehlerstand ohne neuen Versuch, „Stopp“/„Start“, neue Bridge (7.3 Nr. 2)');
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true }), slotEinst(2, { person: 'Ben', an: true })],
    stell: () => ({ FAKE_SLOT_FEHLER: '2:slotRendererFailed' }),
  });
  await insMeeting(p);
  ck('PK18: Slot 2 → T23 mit T101, keine Fehlerzeile daneben, zoom_slot2_alarm=1, Slot 1 läuft', await bis(() => lage(p, 2)?.zustand === 'gescheitert', 3000)
    && lage(p, 2)?.text === 'Gescheitert: Der Slot ließ sich nicht aufbauen (SLOT_RENDERER_FAILED). Details im Log. Für einen neuen Versuch „Stopp“ und wieder „Start“.'
    && lage(p, 2)?.fehler === null && slotKurz(p, 2)?.alarm === true && (await bis(() => lage(p, 1)?.zustand === 'zeigt', 2000)));
  p.einspeisen(1, { ev: 'roster', list: [] });
  await warte(800);
  ck('… ein späteres roster startet Slot 2 nicht neu', slotGesendet(p, 1, 2).filter((c) => c.cmd === 'slotOn').length === 1
    && lage(p, 2)?.zustand === 'gescheitert');
  ck('… „Stopp“/„Start“ versucht es (die Attrappe scheitert nur beim ersten Mal)', ok(p.kern.slotStart(2, false)) && ok(p.kern.slotStart(2, true))
    && (await bis(() => lage(p, 2)?.zustand === 'zeigt', 3000)) && slotBefehle(p, 1, 2).filter((c) => c.cmd === 'slotOn').length === 2);
  await p.aufraeumen();
}
{
  const p = baueKern({
    slots: [slotEinst(2, { person: 'Ben', an: true })],
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_SLOT_FEHLER: '2:slotSenderFailed', FAKE_VERBINDUNG_WEG_MS: '1200' } : {}),
  });
  await insMeeting(p);
  ck('PK18: Fehlerstand gescheitert', await bis(() => lage(p, 2)?.zustand === 'gescheitert', 3000));
  ck('… eine neue Bridge (Wiederbeitritt) löscht ihn: Slot 2 startet in Bridge 2', await bis(() => slotBefehle(p, 2, 2).some((c) => c.cmd === 'slotOn'), 6000)
    && (await bis(() => lage(p, 2)?.zustand === 'zeigt', 3000)));
  await p.aufraeumen();
}
{
  // Wettlauf R2 aus 0.3.0: Connect führt die Erlaubnis als „ja“, die Bridge lehnt das slotOn trotzdem ab (am echten SDK der
  // Übergang bis zum privilege-Ereignis). T100 an der Fehlerzeile (9.6, 10.9), kein Fehlerstand: Der Slot wartet (7.3 Nr. 2).
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: () => ({ FAKE_SLOT_FEHLER: '1:slotNoPrivilege' }), fristen: { abbildTaktMs: 0 } });
  await insMeeting(p);
  ck('PK18 (slotNoPrivilege bei Erlaubnis „ja“): T100 an der Fehlerzeile, kein SZ8, SZ11 mit T14, zoom_slot1_alarm=0',
    (await bis(() => lage(p, 1)?.fehler === 'Keine Aufnahme-Erlaubnis — der Host muss sie im Zoom-Client erteilen.', 3000))
    && p.kern.kurz().erlaubnis === 'ja' && lage(p, 1)?.zustand === 'geplant' && lage(p, 1)?.text === 'Startet …'
    && !p.abbilder.some((a) => a.slots.some((s) => s.zustand === 'gescheitert')) && slotKurz(p, 1)?.alarm === false);
  p.einspeisen(1, { ev: 'roster', list: [] });
  ck('… der nächste Abgleich startet ihn, mit live fällt die Fehlerzeile (10.9)', (await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000))
    && lage(p, 1)?.fehler === null && slotGesendet(p, 1, 1).filter((c) => c.cmd === 'slotOn').length === 2);
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })] });
  await insMeeting(p);
  ck('PK18 (Fehlerzeile, 10.9): Slot 1 zeigt Anna', await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000));
  p.einspeisen(1, { ev: 'error', where: 'slot', code: 'slotBadResolution', name: 'SLOT_BAD_RESOLUTION', slot: 1 });
  ck('… die Bridge lehnt eine Einstellung am laufenden Slot ab → T103 an der Fehlerzeile, kein Fehlerstand, kein Hinweis',
    lage(p, 1)?.fehler === 'Die Zoom-Bridge hat die Einstellung abgelehnt (SLOT_BAD_RESOLUTION). Details im Log.'
    && lage(p, 1)?.zustand === 'zeigt' && p.kern.abbild().hinweise.length === 0);
  p.einspeisen(1, slotEv(1, 'live', ANNA, 'frames'));
  ck('… das nächste slot live löscht sie', lage(p, 1)?.fehler === null);
  p.einspeisen(1, { ev: 'error', where: 'slot', code: 'slotBadResolution', name: 'SLOT_BAD_RESOLUTION', slot: 1 });
  ck('… „Stopp“ löscht sie ebenso', lage(p, 1)?.fehler !== null && ok(p.kern.slotStart(1, false)) && lage(p, 1)?.fehler === null);
  await p.aufraeumen();
}

console.log('— PK19 · Keine Antwort: T21 nach der Frist, kein neuer Versuch (7.3 Nr. 2)');
{
  const p = baueKern({ slots: [slotEinst(3, { person: 'Carla', an: true })], stell: () => ({ FAKE_SLOT_STUMM: '3', FAKE_TEILNEHMER: '3' }), fristen: { aboAntwortMs: 600 } });
  await insMeeting(p);
  ck('PK19: slotOn ohne Antwort → T21, zoom_slot3_alarm=1', await bis(() => lage(p, 3)?.text
    === 'Keine Antwort der Zoom-Bridge. Für einen neuen Versuch „Stopp“ und wieder „Start“.', 3000) && slotKurz(p, 3)?.alarm === true);
  p.einspeisen(1, { ev: 'roster', list: [] });
  await warte(800);
  ck('… ein roster nach Ablauf der Frist sendet kein slotOn', slotGesendet(p, 1, 3).filter((c) => c.cmd === 'slotOn').length === 1);
  await p.aufraeumen();
}

console.log('— PK20 · Wiederbeitritt mit neuer Bridge (Z11): alle eingeschalteten Slots neu, T87 erst nach den Antworten');
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true }), slotEinst(3, { person: 'Carla', an: true })],
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_TEILNEHMER: '3', FAKE_VERBINDUNG_WEG_MS: '1500' } : { FAKE_TEILNEHMER: '3', FAKE_SLOT_STUMM: '3' }),
    fristen: { aboAntwortMs: 1500 },
  });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  ck('PK20: drei Slots laufen, Slot 2 vorübergehend', await bis(() => p.kern.kurz().slotsLaufen === 3, 3000) && lage(p, 2)?.voruebergehend === true);
  ck('… im Wiederbeitritt (Z11) zoom_alarm=1', await bis(() => zoomZ(p.kern.kurz()) === 'Z11', 4000) && p.kern.stateKv()?.zoom_alarm === 1);
  ck('… Bridge 2 startet alle drei neu, auch den vorübergehenden', await bis(() => [1, 2, 3].every((nr) => slotBefehle(p, 2, nr).some((c) => c.cmd === 'slotOn')), 6000));
  ck('… T87 noch nicht, solange Slot 3 ohne Antwort ist', await bis(() => lage(p, 1)?.zustand === 'zeigt' && lage(p, 2)?.zustand === 'zeigt', 3000)
    && !p.kern.abbild().hinweise.some((h) => h.startsWith('Wieder im Meeting.')));
  ck('… nach Ablauf seiner Frist T87 mit den Zahlen aus 10.11', await bis(() => p.kern.abbild().hinweise.includes('Wieder im Meeting. 2 Slots laufen wieder. 1 nicht gestartet (siehe Kachel).'), 4000)
    && p.kern.abbild().hinweise.filter((h) => h.startsWith('Wieder im Meeting.')).length === 1);
  await p.aufraeumen();
}

console.log('— PK21 · Zoom verbindet selbst neu (Z10), neue Kennungen per roster');
{
  const NEU = 16778260;
  let neu = false;
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })],
    stell: () => ({ FAKE_VERBINDUNG_HAENGT_MS: '1000', FAKE_VERBINDUNG_ZURUECK_MS: '800' }),
    ereignis: (ev) => {
      if (ev.ev === 'status' && (ev as unknown as { status: string }).status === 'reconnecting') neu = true;
      return ev;
    },
    // Nach dem Neuverbinden trägt Anna eine neue Kennung (wie nach einem echten Z10 möglich, 7.3 Nr. 5).
    sitzung: (s) => {
      const a = s.participants.get(ANNA);
      if (!neu || !a) return s;
      const participants = new Map(s.participants);
      participants.delete(ANNA);
      participants.set(NEU, { ...a, id: NEU });
      return { ...s, participants };
    },
  });
  await insMeeting(p);
  ck('PK21: Slot 1 zeigt Anna', await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000));
  ck('… in Z10: zoom_slot1_live=0, _state=wartet, _target leer; der Slot bleibt eingeschaltet', await bis(() => zoomZ(p.kern.kurz()) === 'Z10', 3000)
    && slotKurz(p, 1)?.live === false && slotKurz(p, 1)?.zustandWort === 'wartet' && slotKurz(p, 1)?.ziel === '' && lage(p, 1)?.einstellung.an === true);
  ck('… nach dem roster slotSet {slot: 1, id: neu}, kein slotOff, kein zweites slotOn', await bis(() => slotBefehle(p, 1, 1)
    .some((c) => c.cmd === 'slotSet' && c.id === NEU), 4000) && !slotBefehle(p, 1, 1).some((c) => c.cmd === 'slotOff')
    && slotBefehle(p, 1, 1).filter((c) => c.cmd === 'slotOn').length === 1);
  await p.aufraeumen();
}

console.log('— PK28 · Erlaubnis flattert: spätes slot off/privilegeRevoked bei Erlaubnis „ja“ → neuer Abgleich (B14)');
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: () => ({ FAKE_ENTZUG_MS: '800', FAKE_ERTEILUNG_MS: '100', FAKE_ABBAU_MS: '700' }) });
  await insMeeting(p);
  ck('PK28: Slot 1 zeigt Anna', await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000));
  ck('… nach dem späten Abbau bei Erlaubnis „ja“: SZ11 mit T14', await bis(() => lage(p, 1)?.zustand === 'geplant', 4000)
    && lage(p, 1)?.text === 'Startet …' && p.kern.kurz().erlaubnis === 'ja');
  ck('… der Abgleich startet ihn wieder', await bis(() => slotBefehle(p, 1, 1).filter((c) => c.cmd === 'slotOn').length === 2, 3000)
    && (await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000)));
  await p.aufraeumen();
}

console.log('— PK29 · Alarm beim Weggang (FR7), Personenwechsel (RR9), Ereignis im Flug (N3)');
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: () => ({ FAKE_WIEDERBEITRITT_MS: '1200', FAKE_RUECKKEHR_MS: '5000' }) });
  await insMeeting(p);
  ck('PK29: gezeigte Person geht → zoom_alarm=1, zoom_slot1_alarm=1', (await bis(() => lage(p, 1)?.zeigteSchon === true, 3000))
    && (await bis(() => lage(p, 1)?.grund === 'participantLeft', 3000)) && p.kern.stateKv()?.zoom_alarm === 1 && slotKurz(p, 1)?.alarm === true);
  await p.aufraeumen();
}
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })],
    sitzung: (s) => {
      if (!s.participants.has(ANNA)) return s;
      const participants = new Map(s.participants);
      participants.delete(ANNA);
      return { ...s, participants };
    },
  });
  await insMeeting(p);
  ck('PK29: Slot „Anna“ in einem Meeting ohne Anna → T16, zoom_alarm=0', await bis(() => lage(p, 1)?.text === 'Wartet auf Anna · Ersatzbild transparent', 3000)
    && p.kern.stateKv()?.zoom_alarm === 0 && slotKurz(p, 1)?.alarm === false);
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: () => ({ FAKE_TEILNEHMER: '1' }) });
  await insMeeting(p);
  ck('PK29: Slot zeigte Anna', await bis(() => lage(p, 1)?.zeigteSchon === true, 3000));
  ck('… Person auf Ben (nicht im Meeting), Anna bleibt → slotSet {id: 0}, T16, zoom_slot1_alarm=0', ok(p.kern.slotAendern(1, { person: 'Ben' }))
    && (await bis(() => slotBefehle(p, 1, 1).some((c) => c.cmd === 'slotSet' && c.id === 0), 2000))
    && (await bis(() => lage(p, 1)?.text === 'Wartet auf Ben · Ersatzbild transparent', 2000)) && slotKurz(p, 1)?.alarm === false);
  await p.aufraeumen();
}
{
  let halten = true;
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })],
    stell: () => ({ FAKE_TEILNEHMER: '1', FAKE_KAMERA_AUS_MS: `${ANNA}:1200` }),
    sendeFilter: (c) => !(halten && c.cmd === 'slotSet' && c.slot === 1),
  });
  await insMeeting(p);
  ck('PK29 (im Flug): Slot zeigt Anna mit Kamera aus (T19)', await bis(() => lage(p, 1)?.text === 'Anna: Kamera aus · Ersatzbild transparent', 4000));
  p.kern.slotAendern(1, { person: 'Ben' });
  p.einspeisen(1, slotEv(1, 'live', ANNA, 'frames'));
  ck('… slotSet {id: 0} zurückgehalten, die Bridge meldet slot live mit Ziel Anna → zeigteSchon bleibt aus, kein Alarm',
    lage(p, 1)?.zeigteSchon === false && slotKurz(p, 1)?.alarm === false && !slotBefehle(p, 1, 1).some((c) => c.cmd === 'slotSet'));
  halten = false;
  p.einspeisen(1, { ev: 'roster', list: [] });
  ck('… nach dem slotSet T16, zoom_slot1_alarm=0', await bis(() => lage(p, 1)?.text === 'Wartet auf Ben · Ersatzbild transparent', 3000)
    && slotKurz(p, 1)?.alarm === false);
  await p.aufraeumen();
}

console.log('— PK30 · Abo abgelehnt: T20c mit Handgriff, Alarm, kein neuer Versuch (B51)');
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: () => ({ FAKE_ABO_FEHLER: '1:9' }) });
  await insMeeting(p);
  ck('PK30: T20c mit dem SDK-Fehlernamen, zoom_slot1_alarm=1, zoom_alarm=1', await bis(() => lage(p, 1)?.text
    === 'Anna: Zoom hat das Abo abgelehnt (SDKERR_NORECORDINGINPROCESS) · Ersatzbild transparent. Für einen neuen Versuch „Stopp“ und wieder „Start“.', 3000)
    && slotKurz(p, 1)?.alarm === true && p.kern.stateKv()?.zoom_alarm === 1);
  p.einspeisen(1, { ev: 'roster', list: [] });
  await warte(800);
  ck('… kein automatischer neuer Versuch', slotGesendet(p, 1, 1).filter((c) => c.cmd !== 'slotOff').length === 1);
  await p.aufraeumen();
}

console.log('— PK34 · Fehler ohne Slot, Wettlauf, slotReconnecting, Ton-Abo-Fehler, Q6, T106 (B62; W2, W6)');
{
  let schlucken = true;
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true }), slotEinst(2, { person: 'Ben', an: true }), slotEinst(3, { modus: 'sprecher', an: true, tonAn: false })],
    sendeFilter: (c) => !(schlucken && c.cmd === 'slotOn' && c.slot === 3),
  });
  await insMeeting(p);
  ck('PK34: Slots 1 und 2 laufen, slotOn für Slot 3 verschluckt', await bis(() => p.kern.kurz().slotsLaufen === 2 && lage(p, 3)?.zustand === 'startet', 3000));
  p.einspeisen(1, { ev: 'error', where: 'slot', code: 'slotReconnecting', name: 'SLOT_RECONNECTING', slot: 3 });
  ck('… slotReconnecting: kein Text, kein Fehlerstand, die Frist ist beantwortet (SZ11)', lage(p, 3)?.zustand === 'geplant' && lage(p, 3)?.fehler === null
    && p.kern.abbild().hinweise.length === 0);
  schlucken = false;
  p.einspeisen(1, { ev: 'roster', list: [] });
  ck('… der nächste Abgleich startet den Slot', await bis(() => lage(p, 3)?.zustand !== 'geplant' && slotBefehle(p, 1, 3).some((c) => c.cmd === 'slotOn'), 3000));
  p.einspeisen(1, { ev: 'error', where: 'slot', code: 'slotBadNumber', name: 'SLOT_BAD_NUMBER' });
  ck('… slotBadNumber (ohne Slot) → „Hinweise“ T103', p.kern.abbild().hinweise.at(-1) === 'Die Zoom-Bridge hat die Einstellung abgelehnt (SLOT_BAD_NUMBER). Details im Log.');
  p.einspeisen(1, { ev: 'error', where: 'slot', code: 'slotNotOn', name: 'SLOT_NOT_ON', slot: 1 });
  ck('… slotNotOn: kein Text, kein SZ8', lage(p, 1)?.fehler === null && lage(p, 1)?.zustand !== 'gescheitert' && p.kern.abbild().hinweise.length === 1);
  const tonVorher = p.kern.abbild().slots.map((s) => s.tonText).join('|');
  p.einspeisen(1, { ev: 'error', where: 'audio', code: 'audioQueueOverflow', name: 'AUDIO_QUEUE_OVERFLOW', dropped: 12 });
  ck('… audioQueueOverflow → nur Hinweis Q6, keine Tonzeile ändert sich', p.kern.abbild().hinweise.at(-1) === 'Ton: 12 Pakete verworfen — dieser PC kommt nicht hinterher.'
    && p.kern.abbild().slots.map((s) => s.tonText).join('|') === tonVorher);
  p.einspeisen(1, { ev: 'error', where: 'audio', code: 'audioBufferMismatch', name: 'AUDIO_BUFFER_MISMATCH', slot: 2 });
  ck('… audioBufferMismatch mit slot → Hinweis T106, keine Tonzeile ändert sich', p.kern.abbild().hinweise.at(-1)
    === 'Ton: ein fehlerhaftes Paket in Slot 2 verworfen (audioBufferMismatch). Der Ton läuft mit dem nächsten gültigen Paket weiter.'
    && p.kern.abbild().slots.map((s) => s.tonText).join('|') === tonVorher);
  p.einspeisen(1, { ev: 'error', where: 'audio', code: 'audioSubscribeFailed', name: 'AUDIO_SUBSCRIBE_FAILED', slot: 1 });
  ck('… Ton-Abo-Fehler → T104 an jeder Kachel mit Ton (1, 2), nicht an Slot 3 (Ton aus)', lage(p, 1)?.tonText === T104_ABO
    && lage(p, 2)?.tonText === T104_ABO && lage(p, 3)?.tonText === 'Ton: aus');
  p.einspeisen(1, { ev: 'slotAudio', slot: 2, state: 'off', source: 'none', configured: 'mix', reason: 'audioUnavailable' });
  p.einspeisen(1, { ev: 'slotAudio', slot: 1, state: 'waiting', source: 'none', configured: 'mix', reason: 'command' });
  ck('… danach waiting/command eines anderen Slots → T104 nur noch am Slot mit eigenem off/audioUnavailable',
    lage(p, 1)?.tonText !== T104_ABO && lage(p, 2)?.tonText === T104_ABO);
  p.einspeisen(1, { ev: 'error', where: 'audio', code: 'audioSubscribeFailed', name: 'AUDIO_SUBSCRIBE_FAILED' });
  p.einspeisen(1, { ev: 'privilege', canRecordRaw: false, source: 'broadcast' });
  ck('… der Entzug löscht den Merker', p.kern.kurz().erlaubnis === 'entzogen' && lage(p, 1)?.tonText !== T104_ABO);
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: (n): Record<string, string> => (n === 1 ? { FAKE_MEETING_ENDE_MS: '1500' } : {}) });
  await insMeeting(p);
  await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000);
  p.einspeisen(1, { ev: 'error', where: 'audio', code: 'audioSubscribeFailed', name: 'AUDIO_SUBSCRIBE_FAILED' });
  ck('PK34: Ton-Abo-Fehler gesetzt', lage(p, 1)?.tonText === T104_ABO);
  ck('… Meeting-Ende und neue Bridge löschen den Merker', (await bis(() => p.kern.kurz().zustand === 'bereit', 4000)) && (await insMeeting(p))
    && (await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000)) && lage(p, 1)?.tonText !== T104_ABO);
  await p.aufraeumen();
}
{
  // slotReconnecting über die Attrappe (Vertrag 3.5): Ein slotOn erreicht die Bridge, während sie neu verbindet. Das reconnecting
  // hält der Test zurück, bis die Antwort da ist (es kreuzt sich mit dem slotOn); danach Z10, inMeeting und der Abgleich.
  let zurueck: BridgeEvent | null = null;
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true }), slotEinst(3, { modus: 'sprecher', tonAn: false })],
    stell: () => ({ FAKE_VERBINDUNG_HAENGT_MS: '1000', FAKE_VERBINDUNG_ZURUECK_MS: '1500' }),
    ereignis: (ev) => {
      if (zurueck !== null || ev.ev !== 'status' || (ev as unknown as { status: string }).status !== 'reconnecting') return ev;
      zurueck = ev;
      return { ev: 'zurueckgehalten' } as unknown as BridgeEvent;
    },
  });
  await insMeeting(p);
  ck('PK34 (Attrappe): die Bridge verbindet neu, Connect sieht es noch nicht', (await bis(() => zurueck !== null, 3000)) && p.kern.kurz().zustand === 'im_meeting');
  const an = p.kern.slotStart(3, true);
  ck('… Slot 3 ein: slotOn → slotReconnecting, kein Text, kein Fehlerstand, die Frist ist beantwortet (SZ11)', ok(an)
    && (await bis(() => p.ereignisse.some((x) => x.ev.ev === 'error' && (x.ev as unknown as { code: string }).code === 'slotReconnecting'), 2000))
    && lage(p, 3)?.zustand === 'geplant' && lage(p, 3)?.fehler === null && p.kern.abbild().hinweise.length === 0);
  if (zurueck !== null) p.einspeisen(1, zurueck as unknown as Record<string, unknown>);
  ck('… Z10; nach inMeeting startet der Abgleich Slot 3 (ohne eingespeistes roster)', zoomZ(p.kern.kurz()) === 'Z10'
    && (await bis(() => slotGesendet(p, 1, 3).filter((c) => c.cmd === 'slotOn').length === 2 && lage(p, 3)?.zustand === 'ersatz', 5000)));
  await p.aufraeumen();
}

// ── Plan B, Task B15: Modi, Sprecher, Freigabe, Kamera, Ton am laufenden Slot, Auflösung, Umbenennung ──
/** Das letzte slotSet an Slot `nr` (Bridge 1), ohne Feldreihenfolge zu raten: als JSON. */
const letztesSlotSet = (p: Probe, nr: number): string => JSON.stringify(slotBefehle(p, 1, nr).filter((c) => c.cmd === 'slotSet').at(-1) ?? null);
/** Wartet, bis das letzte slotSet an Slot `nr` dem Soll entspricht (die Attrappe schreibt ihre Befehlsdatei erst beim Empfang). */
const bisSlotSet = (p: Probe, nr: number, soll: Record<string, unknown>): Promise<boolean> => bis(() => letztesSlotSet(p, nr) === JSON.stringify(soll), 2000);
/** Ereignisse `ev` für Slot `nr` (alle Bridges), roh. */
function slotEreignisse(p: Probe, ev: string, nr: number): Array<Record<string, unknown>> {
  return p.ereignisse.map((x) => x.ev as unknown as Record<string, unknown>).filter((e) => e.ev === ev && e.slot === nr);
}
/** Eine Zeile mit „0 Bilder/s“ als ganzer Zahl (nicht „30 Bilder/s“, Spec 10.7). */
const NULL_BILDER = /(^|\D)0 Bilder\/s/;

console.log('— PK7 · Moduswechsel am laufenden Slot: nur slotSet {mode}, Grund modeChanged, Tonweg (7.1, 6.10; N1)');
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })],
    stell: () => ({ FAKE_TEILNEHMER: '3', FAKE_SPRECHER_FOLGE: `300:${BEN}`, FAKE_FREIGABEN: `400:${CARLA}:101:begin` }),
  });
  await insMeeting(p);
  ck('PK7: Slot 1 zeigt Anna', await bis(() => lage(p, 1)?.text === 'Zeigt Anna.', 3000));
  await warte(500);
  const tonVorher = slotEreignisse(p, 'slotAudio', 1).length;
  ck('… auf Sprecher: slotSet nur mit mode, Grund modeChanged, dann T25', ok(p.kern.slotAendern(1, { modus: 'sprecher' }))
    && (await bisSlotSet(p, 1, { cmd: 'slotSet', slot: 1, mode: 'speaker' }))
    && (await bis(() => lage(p, 1)?.text === 'Zeigt Ben (Sprecher).', 3000))
    && slotEreignisse(p, 'slot', 1).some((e) => e.mode === 'speaker' && e.reason === 'modeChanged'));
  ck('… Teilnehmer → Sprecher: kein slotAudio (der Tonweg bleibt mix)', slotEreignisse(p, 'slotAudio', 1).length === tonVorher);
  ck('… auf Freigabe: slotSet {mode: share}, slotAudio mit configured mixShare, die Tonzeile nennt die neue Quelle',
    ok(p.kern.slotAendern(1, { modus: 'freigabe' })) && (await bisSlotSet(p, 1, { cmd: 'slotSet', slot: 1, mode: 'share' }))
      && (await bis(() => lage(p, 1)?.text === 'Zeigt die Freigabe von Carla.', 3000))
      && slotEreignisse(p, 'slotAudio', 1).slice(tonVorher).some((e) => e.configured === 'mixShare')
      && (await bis(() => lage(p, 1)?.tonText?.startsWith('Ton: Mischton + Computerton') === true, 2000)));
  const tonFreigabe = slotEreignisse(p, 'slotAudio', 1).length;
  ck('… zurück auf Teilnehmer: slotSet {mode: participant, id: Anna}, configured mix, T15', ok(p.kern.slotAendern(1, { modus: 'teilnehmer' }))
    && (await bisSlotSet(p, 1, { cmd: 'slotSet', slot: 1, mode: 'participant', id: ANNA }))
    && (await bis(() => lage(p, 1)?.text === 'Zeigt Anna.', 3000))
    && slotEreignisse(p, 'slotAudio', 1).slice(tonFreigabe).some((e) => e.configured === 'mix')
    && (await bis(() => lage(p, 1)?.tonText?.startsWith('Ton: Mischton ·') === true, 2000)));
  ck('… nie slotOff, nur ein slotOn, NDI-Name unverändert', !slotBefehle(p, 1, 1).some((c) => c.cmd === 'slotOff')
    && slotBefehle(p, 1, 1).filter((c) => c.cmd === 'slotOn').length === 1 && lage(p, 1)?.einstellung.ndiName === 'Zoom 1');
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Zora', an: true })] });
  await insMeeting(p);
  ck('PK7 (ohne Ziel): Teilnehmer „Zora“, nicht im Meeting → T16', await bis(() => lage(p, 1)?.text === 'Wartet auf Zora · Ersatzbild transparent', 3000));
  ck('… auf Sprecher mit leerer Erinnerung → die Bridge meldet mode speaker, T26', ok(p.kern.slotAendern(1, { modus: 'sprecher' }))
    && (await bis(() => slotEreignisse(p, 'slot', 1).at(-1)?.mode === 'speaker', 2000)) && (await bis(() => lage(p, 1)?.text === 'Wartet auf eine sprechende Person · Ersatzbild transparent', 3000)));
  ck('… auf Freigabe ohne Freigabe → mode share, T29c', ok(p.kern.slotAendern(1, { modus: 'freigabe' }))
    && (await bis(() => slotEreignisse(p, 'slot', 1).at(-1)?.mode === 'share', 2000)) && (await bis(() => lage(p, 1)?.text === 'Wartet auf eine Bildschirmfreigabe · Ersatzbild transparent', 3000)));
  ck('… zurück auf Teilnehmer → mode participant, T16', ok(p.kern.slotAendern(1, { modus: 'teilnehmer' }))
    && (await bis(() => slotEreignisse(p, 'slot', 1).at(-1)?.mode === 'participant', 2000)) && (await bis(() => lage(p, 1)?.text === 'Wartet auf Zora · Ersatzbild transparent', 3000)));
  ck('… nie T20 („erstes Bild steht noch aus“), auch nicht als Grund modeChanged ohne Ziel',
    !p.abbilder.some((a) => a.slots.some((s) => s.text.includes('erstes Bild steht noch aus')))
    && !slotEreignisse(p, 'slot', 1).some((e) => e.target === 0 && e.reason === 'modeChanged'));
  await p.aufraeumen();
}

console.log('— PK9 · Bildausfall (T19b); „Kamera aus“ in der Teilnehmerliste folgt videoStatus auch ohne laufenden Slot');
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: () => ({ FAKE_KEIN_BILD_MS: `${ANNA}:900`, FAKE_KAMERA_AUS_MS: `${BEN}:900` }) });
  await insMeeting(p);
  ck('PK9: Bildausfall → T19b', await bis(() => lage(p, 1)?.text === 'Anna: Zoom liefert gerade kein Bild · Ersatzbild transparent', 3000));
  ck('… Ben (ohne Slot): Kamera aus in der Teilnehmerliste', await bis(() => p.kern.abbild().teilnehmer.find((t) => t.id === BEN)?.kamera === 'aus', 3000));
  await p.aufraeumen();
}

console.log('— PK10 · Zwei Freigaben: T28b mit der neuesten, nach ihrem Ende T28');
{
  const p = baueKern({
    slots: [slotEinst(1, { modus: 'freigabe', an: true })],
    stell: () => ({ FAKE_TEILNEHMER: '3', FAKE_FREIGABEN: `300:${BEN}:101:begin,700:${CARLA}:102:begin,1700:${CARLA}:102:end` }),
  });
  await insMeeting(p);
  ck('PK10: zwei Freigaben → T28b mit Carla', await bis(() => lage(p, 1)?.text === 'Zeigt die Freigabe von Carla (die neueste von 2: Ben, Carla).', 3000));
  ck('… Carla endet → T28 mit Ben', await bis(() => lage(p, 1)?.text === 'Zeigt die Freigabe von Ben.', 3000));
  ck('… die Freigaben stehen in den Messwerten', p.kern.abbild().messwerte.freigaben?.list.length === 1);
  await p.aufraeumen();
}

console.log('— PK13 · zoom_slot_audio am laufenden Freigabe-Slot: slotSet mit beiden Ton-Feldern');
{
  const p = baueKern({
    slots: [slotEinst(3, { modus: 'freigabe', an: true, tonAn: true, computerton: true })],
    stell: () => ({ FAKE_TEILNEHMER: '3', FAKE_FREIGABEN: `300:${CARLA}:101:begin` }),
  });
  await insMeeting(p);
  ck('PK13: Slot 3 zeigt die Freigabe', await bis(() => lage(p, 3)?.zustand === 'zeigt', 3000));
  befehl(p, 'zoom_slot_audio', '3', 'OFF');
  ck('… OFF → slotSet {audio: off, shareAudio: false}, zoom_slot3_audio=0',
    (await bisSlotSet(p, 3, { cmd: 'slotSet', slot: 3, audio: 'off', shareAudio: false })) && slotKurz(p, 3)?.tonEin === false);
  befehl(p, 'zoom_slot_audio', '3', 'ON');
  ck('… ON stellt beide wieder her', (await bisSlotSet(p, 3, { cmd: 'slotSet', slot: 3, audio: 'mix', shareAudio: true }))
    && slotKurz(p, 3)?.tonEin === true);
  await p.aufraeumen();
}

console.log('— PK14 · Ton am laufenden Slot: immer beide Felder; T75, T75b, T58f (B2, N9-1, RN4, RN5)');
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })] });
  await insMeeting(p);
  ck('PK14: Slot 1 zeigt Anna', await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000));
  ck('… Ton aus → slotSet {audio: off, shareAudio: true} (beide Felder), keine Ablehnung', ok(p.kern.slotAendern(1, { tonAn: false }))
    && (await bisSlotSet(p, 1, { cmd: 'slotSet', slot: 1, audio: 'off', shareAudio: true }))
    && (await warte(300), !p.ereignisse.some((x) => x.ev.ev === 'error')));
  ck('… nur der Computerton geändert → wieder beide Felder', ok(p.kern.slotAendern(1, { computerton: false }))
    && (await bisSlotSet(p, 1, { cmd: 'slotSet', slot: 1, audio: 'off', shareAudio: false })));
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { modus: 'sprecher', an: true, tonArt: 'person' })], stell: () => ({ FAKE_SPRECHER_FOLGE: `300:${BEN}` }) });
  await insMeeting(p);
  ck('PK14: Tonart Person im Modus Sprecher → slotOn mit audio person, die Bridge meldet off/personNotInMode → T75',
    (await bis(() => lage(p, 1)?.tonText === 'Ton: Person-Ton gibt es nur im Modus Teilnehmer. Der Slot sendet keinen Meeting-Ton.', 3000))
      && (await bis(() => slotBefehle(p, 1, 1).find((c) => c.cmd === 'slotOn')?.audio === 'person', 2000)));
  await p.aufraeumen();
}
for (const tonArt of ['mischton', 'person'] as const) {
  const p = baueKern({
    slots: [slotEinst(1, { modus: 'freigabe', an: true, tonAn: false, tonArt })],
    stell: () => ({ FAKE_TEILNEHMER: '3', FAKE_FREIGABEN: `900:${CARLA}:101:begin,2000:${CARLA}:101:end` }),
  });
  await insMeeting(p);
  ck(`PK14 (nur Computerton, Tonart ${tonArt}): niemand teilt → T58f`, await bis(() => lage(p, 1)?.tonText === 'Ton: Computerton · wartet auf eine Bildschirmfreigabe', 3000));
  ck('… die Freigabe beginnt → nach den ersten Paketen T58c', await bis(() => lage(p, 1)?.tonText === 'Ton: Computerton · läuft (32,0 kHz, mono)', 3000));
  ck('… sie endet → T58f, nie T75', await bis(() => lage(p, 1)?.tonText === 'Ton: Computerton · wartet auf eine Bildschirmfreigabe', 3000)
    && !p.abbilder.some((a) => a.slots.some((s) => s.tonText?.includes('Person-Ton gibt es nur'))));
  await p.aufraeumen();
}
{
  const p = baueKern({
    slots: [slotEinst(1, { modus: 'freigabe', an: true, tonAn: true, tonArt: 'person', computerton: true })],
    stell: () => ({ FAKE_TEILNEHMER: '3', FAKE_FREIGABEN: `900:${CARLA}:101:begin,2000:${CARLA}:101:end,2800:${BEN}:102:begin` }),
  });
  await insMeeting(p);
  const T75 = 'Ton: Person-Ton gibt es nur im Modus Teilnehmer. Der Slot sendet keinen Meeting-Ton.';
  const T75B = 'Ton: Person-Ton gibt es nur im Modus Teilnehmer; es läuft nur der Computerton.';
  ck('PK14 (RN5): ohne gezeigte Freigabe T75', await bis(() => lage(p, 1)?.tonText === T75, 3000));
  ck('… Freigabe beginnt → T75b, sobald der Computerton gemessen hinausgeht', await bis(() => lage(p, 1)?.tonText === T75B, 3000));
  ck('… endet → T75', await bis(() => lage(p, 1)?.tonText === T75, 3000));
  ck('… beginnt wieder → T75b', await bis(() => lage(p, 1)?.tonText === T75B, 3000));
  ck('… die Bridge bleibt dabei auf off/personNotInMode', slotEreignisse(p, 'slotAudio', 1).slice(1)
    .every((e) => e.state === 'off' && e.reason === 'personNotInMode'));
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { modus: 'freigabe', an: true })], stell: () => ({ FAKE_TEILNEHMER: '3', FAKE_FREIGABEN: `300:${CARLA}:101:begin` }) });
  await insMeeting(p);
  ck('PK14 (rateMismatch): Freigabe-Slot mit Mischton und Computerton zeigt die Freigabe', await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000));
  // Die Attrappe kennt keinen Mischer (6.13): slotStats mit beiden Formaten und das slotAudio der Bridge werden eingespeist.
  p.einspeisen(1, {
    ev: 'slotStats', slot: 1, fallbackFps: 0, heldFrames: 0, workUs: 0, copyUs: 0, previewUs: 0, memKb: 0, resWanted: '720p', foreignFrames: 0,
    lateFrames: 0, tooFrequent: 0, noShareData: 0, rendererNew: 0, rendererLost: 0, audioRate: 32000, audioCh: 1, shareAudioRate: 48000, shareAudioCh: 2,
  });
  p.einspeisen(1, { ev: 'slotAudio', slot: 1, state: 'live', source: 'share', configured: 'mixShare', reason: 'rateMismatch' });
  ck('… slotAudio live/rateMismatch → T76 mit beiden Formaten aus slotStats (10.6 Regel 5, Vorgabe OFP10)', lage(p, 1)?.tonText
    === 'Ton: Mischton und Computerton passen nicht zusammen (32,0 kHz, mono und 48,0 kHz, 2 Kanäle). Es läuft nur der Computerton.');
  p.einspeisen(1, { ev: 'slotAudio', slot: 1, state: 'live', source: 'mixShare', configured: 'mixShare', reason: 'packets' });
  ck('… passen die Formate wieder (packets), steht T58c', lage(p, 1)?.tonText?.startsWith('Ton: Mischton + Computerton · läuft (') === true);
  await p.aufraeumen();
}

console.log('— PK15 · Auflösung: T50, T51, T51c; nie „0 Bilder/s“ (10.7)');
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true, aufloesung: '1080p' }), slotEinst(2, { person: 'Ben', an: true }),
      slotEinst(3, { modus: 'freigabe', an: true, aufloesung: '1080p' })],
    stell: () => ({ FAKE_TEILNEHMER: '3', FAKE_AUFLOESUNG_GELIEFERT: '1280x720', FAKE_FREIGABEN: `300:${CARLA}:101:begin`, FAKE_KAMERA_AUS_MS: `${ANNA}:3200` }),
  });
  await insMeeting(p);
  ck('PK15: 1080p und 1280×720 → T51', await bis(() => lage(p, 1)?.messText === '1080p gewünscht · Zoom liefert 1280×720 · 30 Bilder/s', 4000));
  ck('KF1 (Messzeile): geliefert {1280, 720, 30} und zuletzt {1280, 720} kommen durch slotLage', JSON.stringify(lage(p, 1)?.geliefert)
    === '{"b":1280,"h":720,"fps":30}' && JSON.stringify(lage(p, 1)?.zuletzt) === '{"b":1280,"h":720}');
  ck('… 720p und 1280×720 → T50', await bis(() => lage(p, 2)?.messText === '720p · Zoom liefert 1280×720 · 30 Bilder/s', 4000));
  ck('… Freigabe-Slot 1080p mit 1280×720 → T50', await bis(() => lage(p, 3)?.messText === '1080p · Zoom liefert 1280×720 · 30 Bilder/s', 4000));
  ck('… nach Kamera aus → T51c', await bis(() => lage(p, 1)?.messText === '1080p · zuletzt 1280×720 · jetzt kein Bild', 5000));
  ck('KF1 (Messzeile): ohne Bild geliefert null, zuletzt {1280, 720}', lage(p, 1)?.geliefert === null
    && JSON.stringify(lage(p, 1)?.zuletzt) === '{"b":1280,"h":720}');
  await warte(2300);
  ck('… auch nach dem nächsten slotStats T51c, nie „0 Bilder/s“', lage(p, 1)?.messText === '1080p · zuletzt 1280×720 · jetzt kein Bild'
    && !p.abbilder.some((a) => a.slots.some((s) => NULL_BILDER.test(s.messText ?? ''))));
  await p.aufraeumen();
}
for (const [geliefert, stufe, soll] of [
  ['960x720', '720p', '720p · Zoom liefert 960×720 · 30 Bilder/s'],
  ['720x1280', '720p', '720p · Zoom liefert 720×1280 · 30 Bilder/s'],
  ['1920x1200', '1080p', '1080p · Zoom liefert 1920×1200 · 30 Bilder/s'],
] as const) {
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true, aufloesung: stufe })], stell: () => ({ FAKE_AUFLOESUNG_GELIEFERT: geliefert }) });
  await insMeeting(p);
  ck(`PK15: ${stufe} und ${geliefert} → T50`, await bis(() => lage(p, 1)?.messText === soll, 4000));
  await p.aufraeumen();
}

console.log('— PK25 · Umbenennung der gezeigten Person (B8): Kachel, gespeicherte Person, Rückkehr unter neuem und altem Namen');
for (const rueckkehrName of ['Annette', 'Anna'] as const) {
  let umbenannt = false;
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })],
    stell: (n): Record<string, string> => (n === 1
      ? { FAKE_WIEDERBEITRITT_MS: '1500', FAKE_RUECKKEHR_MS: '400', FAKE_RUECKKEHR_NAME: rueckkehrName, FAKE_MEETING_ENDE_MS: '3500' } : {}),
    sitzung: (s) => {
      const a = s.participants.get(ANNA);
      if (!umbenannt || !a) return s;
      const participants = new Map(s.participants);
      participants.set(ANNA, { ...a, name: 'Annette' });
      return { ...s, participants };
    },
  });
  await insMeeting(p);
  ck(`PK25 (Rückkehr als „${rueckkehrName}“): Slot 1 zeigt Anna`, await bis(() => lage(p, 1)?.text === 'Zeigt Anna.', 3000));
  umbenannt = true;
  p.einspeisen(1, { ev: 'renamed', id: ANNA, name: 'Annette' });
  ck('… die Kachel nennt den neuen Namen, gespeichert bleibt Anna', lage(p, 1)?.text === 'Zeigt Annette.' && gespeichert(p, 1)?.person === 'Anna');
  ck('… Rückkehr → slotSet auf die neue Kennung', await bis(() => slotBefehle(p, 1, 1).some((c) => c.cmd === 'slotSet' && c.id === ANNA_ZURUECK), 4000));
  ck('… nach dem Meeting-Ende gilt der gespeicherte Name', (await bis(() => p.kern.kurz().zustand === 'bereit', 4000))
    && lage(p, 1)?.zielName === 'Anna' && lage(p, 1)?.einstellung.person === 'Anna');
  await p.aufraeumen();
}

console.log('— PK29 · Sprecher → Teilnehmer mit abwesender Person; spätes slot live mit mode speaker (RR9, N3)');
{
  const p = baueKern({ slots: [slotEinst(1, { modus: 'sprecher', person: 'Zora', an: true })], stell: () => ({ FAKE_SPRECHER_FOLGE: `300:${BEN}` }) });
  await insMeeting(p);
  ck('PK29: der Sprecher-Slot zeigt Ben', await bis(() => lage(p, 1)?.text === 'Zeigt Ben (Sprecher).', 3000));
  ck('… auf Teilnehmer mit „Zora“ (abwesend) → T16, kein Alarm', ok(p.kern.slotAendern(1, { modus: 'teilnehmer' }))
    && (await bis(() => lage(p, 1)?.text === 'Wartet auf Zora · Ersatzbild transparent', 3000)) && slotKurz(p, 1)?.alarm === false);
  p.einspeisen(1, slotEv(1, 'live', BEN, 'frames', 'speaker'));
  ck('… ein spätes slot live mit mode speaker setzt zeigteSchon nicht', lage(p, 1)?.zeigteSchon === false && slotKurz(p, 1)?.alarm === false);
  await p.aufraeumen();
}

console.log('— PK8 · Sprecher: speakerConfig in der Startfolge und nach jeder Änderung, letzte 20 Signale, T25 (7.6)');
{
  const folge = Array.from({ length: 22 }, (_, i) => `${200 + i * 40}:${i % 2 === 0 ? BEN : CARLA}`).join(',');
  const p = baueKern({
    slots: [slotEinst(1, { modus: 'sprecher', an: true })],
    sprecher: { signal: 'aktivesVideo', haltezeitMs: 1500 },
    stell: () => ({ FAKE_TEILNEHMER: '3', FAKE_SPRECHER_FOLGE: folge, FAKE_SPRECHER_SIGNAL: 'activeVideo' }),
  });
  await insMeeting(p);
  ck('PK8: Startfolge mit den gespeicherten Werten', JSON.stringify(p.befehle(1).find((c) => c.cmd === 'speakerConfig'))
    === JSON.stringify({ cmd: 'speakerConfig', signal: 'activeVideo', holdMs: 1500 }));
  ck('… nach allen 22 Signalen: die letzten 20 in den Messwerten, mit Namen',
    await bis(() => p.ereignisse.filter((x) => x.ev.ev === 'speakerSignal').length === 22, 4000) && p.kern.abbild().messwerte.sprecherSignale.length === 20
    && p.kern.abbild().messwerte.sprecherSignale.at(-1)?.ids[0] === CARLA
    && JSON.stringify(p.kern.abbild().messwerte.sprecherSignale.at(-1)?.namen) === '["Carla"]');
  ck('… T25 mit dem Namen der zuletzt gezeigten Person (nach der Haltezeit)', await bis(() => lage(p, 1)?.text === 'Zeigt Carla (Sprecher).', 4000));
  const vorher = p.befehle(1).filter((c) => c.cmd === 'speakerConfig').length;
  ck('… sprecherSetzen: gespeichert und speakerConfig gesendet', ok(p.kern.sprecherSetzen({ signal: 'sprecherVideo', haltezeitMs: 500 }))
    && JSON.stringify(p.einst.sprecher) === '{"signal":"sprecherVideo","haltezeitMs":500}'
    && (await bis(() => p.befehle(1).some((c) => c.cmd === 'speakerConfig' && c.signal === 'speakerVideo' && c.holdMs === 500), 2000)));
  ck('… Haltezeit 6 s → T74, nichts gespeichert, nichts gesendet', text(p.kern.sprecherSetzen({ signal: 'sprecherVideo', haltezeitMs: 6000 }))
    === 'Haltezeit: erlaubt sind 0 bis 5 Sekunden.' && p.einst.sprecher.haltezeitMs === 500
    && (await warte(300), p.befehle(1).filter((c) => c.cmd === 'speakerConfig').length === vorher + 1));
  await p.aufraeumen();
}

console.log('— 7.6 · Vorgaben für neue Slots');
{
  const p = baueKern();
  const r = ok(p.kern.vorgabenSetzen({ aufloesung: '1080p', tonAn: false })) ? p.kern.slotAnlegen() : null;
  ck('vorgabenSetzen speichert, der nächste neue Slot übernimmt sie', r?.ok === true && JSON.stringify(p.einst.vorgaben) === '{"aufloesung":"1080p","tonAn":false}'
    && gespeichert(p, r.nr ?? 0)?.aufloesung === '1080p' && gespeichert(p, r.nr ?? 0)?.tonAn === false && p.kern.abbild().vorgaben.aufloesung === '1080p');
  await p.aufraeumen();
}

// ── Plan B, Task B16: Vorschau, Fenster, Messwerte, Log ──
/** N4b.2: true, wenn keine Logzeile einen dieser Namen als ganzes Wort enthält (Muster aus zoom-kern.test.ts, 7.8). */
function keinTeilnehmernameImLog(p: Probe, namen: readonly string[]): boolean {
  return !p.logs.some((z) => namen.some((n) => new RegExp(`(?<![\\p{L}\\p{N}])${n}(?![\\p{L}\\p{N}])`, 'iu').test(z)));
}
/** Die Namen der Attrappe (fake-bridge.mjs, Drehbuch steuerung). */
const ATTRAPPEN_NAMEN = ['Anna', 'Ben', 'Carla', 'Dora', 'Emil', 'Frieda'];
/** Das letzte previewMode an die Bridge `startNr`. */
const letztesPreviewMode = (p: Probe, startNr = 1): unknown => p.befehle(startNr).filter((c) => c.cmd === 'previewMode').at(-1)?.on;

console.log('— PK16 · Vorschau: Push statt Abbild, nicht im Log, previewMode in der Startfolge, Schalter, Fenster, fremdes Ziel (7.7)');
{
  const bilder: Array<{ nr: number; ziel: number; w: number; h: number; jpeg: string }> = [];
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], fensterSichtbar: true, onVorschau: (b) => bilder.push(b) });
  await insMeeting(p);
  ck('PK16: Startfolge mit previewMode {on: true} (Schalter an, Fenster sichtbar)', JSON.stringify(p.befehle(1).find((c) => c.cmd === 'previewMode'))
    === JSON.stringify({ cmd: 'previewMode', on: true }));
  ck('… Vorschaubilder kommen als Push mit Nummer und Ziel', await bis(() => bilder.some((b) => b.nr === 1 && b.ziel === ANNA && b.jpeg.length > 100), 3000));
  const jpeg = bilder[0]?.jpeg ?? 'fehlt';
  ck('… nicht im Abbild, nicht im Log', !JSON.stringify(p.kern.abbild()).includes(jpeg.slice(0, 40)) && !p.logs.some((z) => z.includes(jpeg.slice(0, 40))));
  p.einspeisen(1, { ev: 'preview', slot: 1, target: BEN, w: 1, h: 1, jpeg: 'RlJFTUQ=' });
  ck('… ein Vorschaubild mit fremdem Ziel wird verworfen', !bilder.some((b) => b.jpeg === 'RlJFTUQ='));
  p.kern.fensterSichtbar(false);
  ck('… Fenster verborgen oder minimiert → previewMode {on: false}', await bis(() => letztesPreviewMode(p) === false, 2000));
  p.kern.fensterSichtbar(true);
  ck('… wieder sichtbar → previewMode {on: true}', await bis(() => letztesPreviewMode(p) === true, 2000));
  ck('… Schalter aus → previewMode {on: false}, gespeichert, im Abbild', ok(p.kern.vorschauSetzen(false)) && p.einst.vorschau === false
    && p.kern.abbild().vorschauAn === false && (await bis(() => letztesPreviewMode(p) === false, 2000)));
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })] });
  await insMeeting(p);
  ck('PK16: ohne Startwert gilt das Fenster als nicht sichtbar → Startfolge mit previewMode {on: false}', letztesPreviewMode(p) === false);
  const detailVorher = p.kern.abbild().vorschauDetail;
  p.einspeisen(1, { ev: 'error', where: 'slot', code: 'previewUnavailable', name: 'PREVIEW_UNAVAILABLE', detail: '0x80004005' });
  p.einspeisen(1, { ev: 'error', where: 'slot', code: 'previewUnavailable', name: 'PREVIEW_UNAVAILABLE', detail: '0x80004005' });
  ck('… previewUnavailable → vorschauVerfuegbar falsch, T57 einmal unter „Hinweise“', p.kern.abbild().vorschauVerfuegbar === false
    && p.kern.abbild().hinweise.filter((h) => h === 'Vorschau nicht verfügbar (0x80004005). Bild und Ton laufen unverändert.').length === 1
    && lage(p, 1)?.fehler === null);
  ck('… das Abbild trägt {detail} für T57 an der Kachel (HRESULT, 6.4), vorher null', detailVorher === null
    && p.kern.abbild().vorschauDetail === '0x80004005');
  await p.aufraeumen();
}

console.log('— PK17 · Messwerte und Log ohne Namen (7.8, 0.23)');
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true }), slotEinst(2, { modus: 'sprecher', an: true }), slotEinst(3, { modus: 'freigabe', an: true })],
    stell: () => ({
      FAKE_TEILNEHMER: '3', FAKE_NAMENSZEILE: '1', FAKE_SPRECHER_FOLGE: `300:${BEN},600:${CARLA}`, FAKE_FREIGABEN: `400:${CARLA}:101:begin`,
      FAKE_WIEDERBEITRITT_MS: '1500', FAKE_RUECKKEHR_MS: '300',
    }),
  });
  await insMeeting(p);
  ck('PK17: slotStats und bridgeStats im Abbild', await bis(() => p.kern.abbild().messwerte.slots.length === 3 && p.kern.abbild().messwerte.bridge !== null, 4000));
  ck('… Rückkehr der gezeigten Person: Logzeile mit dem Vergleich der persistentId (MS16)', await bis(() => p.logs.includes('[zoom] Slot 1: Rückkehr: persistentId fehlt'), 4000));
  await bis(() => p.kern.abbild().messwerte.slots.some((m) => m.slot === 1 && m.w !== undefined), 4000);
  const text = p.kern.messwerteText();
  ck('… messwerteText: Prozess, Slots als „Slot {nr} ({Modus})“, Rückkehr, Freigabe, Sprecher', text.includes('Zoom-Bridge: 1,5 % eines Kerns')
    && text.includes('Slot 1 (Teilnehmer): 1280×720, 30 Bilder/s') && text.includes('Slot 2 (Aktiver Sprecher): ')
    && text.includes('Rückkehr in Slot 1: persistentId fehlt') && text.includes('Freigabe-Rückrufe (letzte 10)') && text.includes('Sprecher-Signale (letzte 20)'));
  ck('… ohne Teilnehmernamen und ohne NDI-Namen', !ATTRAPPEN_NAMEN.some((n) => new RegExp(`(?<![\\p{L}\\p{N}])${n}(?![\\p{L}\\p{N}])`, 'u').test(text))
    && !['Zoom 1', 'Zoom 2', 'Zoom 3'].some((n) => text.includes(n)));
  const reihen = text.split('\n').filter((z) => z.includes(' | ') && !z.startsWith('Freigabe-Rückrufe') && !z.startsWith('Sprecher-Signale'));
  ck('… Spalte „Uhrzeit“ in T63c und T65: Empfang in Connect als hh:mm:ss.mmm, nicht die Uhr der Bridge', reihen.length >= 3
    && reihen.every((z) => /^\d{2}:\d{2}:\d{2}\.\d{3} \| /.test(z)));
  ck('… Namensprobe der Bridge erscheint maskiert', await bis(() => p.logs.includes('[zoom-bridge] Namensprobe: ‹Name›, ‹Name›, ‹Name›'), 2000));
  ck('… Logzeilen je Slot, Sprecher-Signale und Freigabe-Rückrufe', p.logs.some((z) => /^\[zoom\] Slot 1 \(teilnehmer\): live\//.test(z))
    && p.logs.some((z) => z.startsWith('[zoom] Sprecher-Signale: ')) && p.logs.some((z) => z.startsWith('[zoom] Freigabe-Rückruf: ')));
  ck('… keine Logzeile nennt einen Teilnehmernamen', keinTeilnehmernameImLog(p, ATTRAPPEN_NAMEN));
  ck('… der eigene Anzeigename bleibt im Log, Karte und Abbild behalten die Namen', p.logs.includes('[zoom] Beitritt gestartet (Anzeigename „JM Connect“)')
    && p.kern.abbild().teilnehmer.some((t) => t.name === 'Ben'));
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(2, { modus: 'sprecher', an: true })], stell: () => ({ FAKE_TEILNEHMER: '3', FAKE_SPRECHER_FOLGE: `300:${BEN}` }) });
  await insMeeting(p);
  ck('PK17 (T67, MS13): der Sprecher-Slot zeigt Ben', await bis(() => lage(p, 2)?.text === 'Zeigt Ben (Sprecher).', 3000));
  // Ben spricht weiter, zwei Rückrufe melden ihn abwechselnd (Video-Sprecher, Ton-Aktivität mit Carla): zehn Signale, kein Wechsel des Slots.
  for (let i = 0; i < 10; i += 1) {
    p.einspeisen(1, { ev: 'speakerSignal', signal: i % 2 === 0 ? 'speakerVideo' : 'activeAudio', ids: i % 2 === 0 ? [BEN] : [CARLA, BEN], ms: 10_000 + i * 100 });
  }
  const t67 = (): string | undefined => p.kern.messwerteText().split('\n').find((z) => z.startsWith('Wechsel pro Minute: '));
  ck('… zehn Signale, der Slot bleibt bei Ben → „Wechsel pro Minute: 0“ (T67 zählt die Wechsel des Slots, nicht die Signale)', t67() === 'Wechsel pro Minute: 0');
  p.einspeisen(1, slotEv(2, 'live', CARLA, 'speakerChanged', 'speaker'));
  ck('… der Slot wechselt auf Carla → ein Wechsel, Rate über 0', /^Wechsel pro Minute: [1-9]/.test(t67() ?? ''));
  await p.aufraeumen();
}

console.log('— PK17 · Log ohne Namen: Fernsteuerung, Übergangsnamen, Rückkehr unter „anna“, zweite Bridge (7.8, 0.23, N4b.2; 11.10)');
{
  const p = baueKern({ slots: [slotEinst(1, { ndiName: 'Bühne links', person: 'Carla', an: true })], stell: () => ({ FAKE_TEILNEHMER: '3' }) });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  ck('PK17 (Fernsteuerung): zoom_load Ben → vorübergehender Slot 2 „JM Connect – Zoom Ben“ läuft', cmdKv(p) === 'ok/0'
    && (await bis(() => lage(p, 2)?.zustand === 'zeigt', 3000)));
  ck('… „Als Slot laden“ für Anna → Slot 3 „JM Connect – Zoom Anna“ läuft', ok(p.kern.slotAusPerson(ANNA))
    && (await bis(() => lage(p, 3)?.zustand === 'zeigt', 3000)));
  befehl(p, 'zoom_slot_person', '1', 'Anna', 'Maria');
  befehl(p, 'zoom_unload', 'Ben');
  await bis(() => lage(p, 2) === undefined, 3000);
  ck('… keine Logzeile nennt einen Teilnehmernamen (auch nicht „Anna Maria“), keine Zeile von Connect einen NDI-Namen der Slots',
    keinTeilnehmernameImLog(p, [...ATTRAPPEN_NAMEN, 'Maria'])
    && !p.logs.some((z) => z.startsWith('[zoom] ') && ['Bühne links', 'JM Connect – Zoom Ben', 'JM Connect – Zoom Anna'].some((n) => z.includes(n))));
  await p.aufraeumen();
}
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })],
    stell: () => ({ FAKE_WIEDERBEITRITT_MS: '600', FAKE_RUECKKEHR_MS: '200', FAKE_RUECKKEHR_NAME: 'anna', FAKE_NAMENSZEILE: '1' }),
  });
  await insMeeting(p);
  ck('PK17 (Rückkehr als „anna“, aus 0.3.0): slotSet auf die neue Kennung, kein Teilnehmername im Log',
    (await bis(() => slotBefehle(p, 1, 1).some((c) => c.cmd === 'slotSet' && c.id === ANNA_ZURUECK), 3000))
    && keinTeilnehmernameImLog(p, [...ATTRAPPEN_NAMEN, 'anna']));
  await p.aufraeumen();
}
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true }), slotEinst(2, { person: 'Carla', an: true, tonAn: false }), slotEinst(3, { person: 'Dora', an: true })],
    stell: (n): Record<string, string> => (n === 1
      ? { FAKE_VERBINDUNG_WEG_MS: '800', FAKE_TEILNEHMER: '4', FAKE_NAMENSZEILE: '1' }
      : { FAKE_DOPPELNAME: '1', FAKE_TEILNEHMER: '4', FAKE_NAMENSZEILE: '1' }),
  });
  await insMeeting(p);
  ck('PK17 (Wiederbeitritt mit zweiter Bridge und Doppelname, aus 0.3.0): T87 erscheint',
    await bis(() => p.kern.abbild().hinweise.some((h) => h.startsWith('Wieder im Meeting.')), 8000) && p.starts() === 2);
  ck('… kein Teilnehmername im Log, auch nicht aus der zweiten Bridge (Namensprobe mit vier maskierten Namen)',
    p.logs.some((z) => z.startsWith('[zoom-bridge] Namensprobe: ‹Name›, ‹Name›, ‹Name›, ‹Name›')) && keinTeilnehmernameImLog(p, ATTRAPPEN_NAMEN));
  await p.aufraeumen();
}

// ── Plan B, Task B17: macOS-Weiche und Drehbuch „Slots“ ──
console.log('— PK36 · Drehbuch „Slots“ von Anfang bis Ende: jede Kachel, Kopfzeile, Teilnehmerliste und STATE nach jedem Schritt (10.2–10.11)');
{
  const { stateKvAus, slotKopfZeile } = await import('../src/shared/zoom-text');
  // Jedes Abbild wird gesendet (abbildTaktMs 0); geprüft wird hinterher die FOLGE der Abbilder, nicht ein Zeitpunkt. Die Attrappe hat
  // eine eigene Uhr, manche Zwischenstände halten nur 200–300 ms (G-B7): Ein Schritt passt, wenn ein Abbild nach dem des vorigen Schritts
  // in jeder Kachel Zustands- und Fehlerzeile, eine der erlaubten Ton- und Messzeilen, Kopfzeile, Slot-Kopf, Teilnehmerliste
  // (Slot-Nummern je Person, T39), die vier STATE-Schlüssel und je Slot die Werte für zoom_slot{n}_* (slotKurz, B18) trifft.
  const p = baueKern({
    skript: 'slots', fristen: { abbildTaktMs: 0 },
    slots: [slotEinst(1, { person: 'Anna', an: true }), slotEinst(2, { modus: 'sprecher', an: true }), slotEinst(3, { modus: 'freigabe', an: true })],
  });
  await insMeeting(p);
  interface Schritt {
    name: string; texte: string[]; kopf: string; kv: string; sk: string[]; tn: string; kz?: string;
    ton: string[][]; mess: Array<Array<string | null>>; karte?: string;
  }
  const kvVon = (a: ZoomAbbild): string => {
    const s = stateKvAus(a.kurz);
    return `${s?.zoom_sources}/${s?.zoom_live}/${s?.zoom_privilege}/${s?.zoom_alarm}`;
  };
  /** je Slot nr:an live alarm tonEin:Modus:Ziel:Zustandswort (die Quelle von zoom_slot{n}_*, Plan B, Task B18) */
  const skVon = (a: ZoomAbbild): string[] => a.kurz.slotKurz
    .map((s) => `${s.nr}:${Number(s.an)}${Number(s.live)}${Number(s.alarm)}${Number(s.tonEin)}:${s.modus}:${s.ziel}:${s.zustandWort}`);
  const tnVon = (a: ZoomAbbild): string => a.teilnehmer.map((t) => `${t.name}:${t.slotNrn.join(',')}`).join('|');
  const passt = (a: ZoomAbbild, s: Schritt): boolean => JSON.stringify(a.slots.map((x) => x.text)) === JSON.stringify(s.texte)
    && a.slots.every((x) => x.fehler === null) && zoomZeile(a.kurz) === s.kopf && kvVon(a) === s.kv
    && JSON.stringify(skVon(a)) === JSON.stringify(s.sk) && tnVon(a) === s.tn
    && slotKopfZeile(a.slots.length, a.kurz.slotsAn, a.kurz.slotsLaufen) === (s.kz ?? '3 von 16 Slots · 3 eingeschaltet · 3 laufen')
    && s.ton.every((erlaubt, i) => erlaubt.includes(a.slots[i]?.tonText ?? '–'))
    && s.mess.every((erlaubt, i) => erlaubt.includes(a.slots[i]?.messText ?? null))
    && (s.karte === undefined || kartenZeile(a, Date.now()) === s.karte);
  /** Index des ersten Abbilds ab `ab`, das zum Schritt passt, sonst -1. */
  const finde = (s: Schritt, ab: number): number => {
    for (let i = ab; i < p.abbilder.length; i += 1) if (passt(p.abbilder[i], s)) return i;
    return -1;
  };
  /** Prüft die Schritte in ihrer Folge; ein fehlender Schritt nennt das letzte Abbild mit seinen Zustandszeilen. */
  const pruefeFolge = (schritte: Schritt[], ab: number): number[] => {
    const gefunden: number[] = [];
    let von = ab;
    for (const s of schritte) {
      const i = finde(s, von);
      gefunden.push(i);
      ck(`PK36: ${s.name}`, i >= 0);
      if (i >= 0) von = i;
      else {
        const gleich = p.abbilder.slice(von).filter((a) => JSON.stringify(a.slots.map((x) => x.text)) === JSON.stringify(s.texte)).at(-1);
        const a = gleich ?? p.abbilder.at(-1);
        if (a) {
          console.log(`      ist: ${a.slots.map((x) => `${x.text} / ${x.tonText} / ${x.messText} / ${x.fehler}`).join(' || ')}`);
          console.log(`           ${zoomZeile(a.kurz)} || ${kvVon(a)} || ${skVon(a).join(' ')} || ${tnVon(a)}`);
        }
      }
    }
    return gefunden;
  };
  const ANNA_ZEIGT = 'Zeigt Anna.';
  const BEN_SPRICHT = 'Zeigt Ben (Sprecher).';
  const OHNE_FREIGABE = 'Wartet auf eine Bildschirmfreigabe · Ersatzbild transparent';
  const FREIGABE_BEN = 'Zeigt die Freigabe von Ben.';
  // Ton (10.6): ein laufender Mischton-Slot wartet auf das erste Paket oder läuft; der Freigabe-Slot (Mischton + Computerton) ohne
  // gezeigte Freigabe hat keinen Computerton (T58g), mit Freigabe kommen beide; ohne Sender T58h.
  const MIX = ['Ton: Mischton · wartet auf das erste Paket', 'Ton: Mischton · läuft (32,0 kHz, mono)'];
  const FG_OHNE = ['Ton: Mischton + Computerton · wartet auf das erste Paket', 'Ton: Mischton · läuft (32,0 kHz, mono) · Computerton kommt nicht an'];
  const FG_MIT = [...FG_OHNE, 'Ton: Mischton + Computerton · läuft (32,0 kHz, mono)'];
  // Messzeile (10.7): vor dem ersten slotStats des Ziels T51b, danach T50 (1280×720 bei 720p); ohne Bild T51c (die Attrappe meldet
  // alle 2 s, darum ist je Schritt die Zeile vor und nach dem nächsten slotStats erlaubt; „0 Bilder/s“ nie).
  const KEIN = '720p gewünscht · noch kein Bild';
  const LIEFERT = '720p · Zoom liefert 1280×720 · 30 Bilder/s';
  const ZULETZT = '720p · zuletzt 1280×720 · jetzt kein Bild';
  const SK_ALLE = ['1:1101:teilnehmer:Anna:zeigt', '2:1101:sprecher:Ben:zeigt', '3:1101:freigabe:Ben:zeigt'];
  const SK_OHNE_FREIGABE = ['1:1101:teilnehmer:Anna:zeigt', '2:1101:sprecher:Ben:zeigt', '3:1001:freigabe::ersatz'];
  const ALLE_LAUFEN = {
    texte: [ANNA_ZEIGT, BEN_SPRICHT, FREIGABE_BEN], kopf: '● Zoom: 3 Slots laufen', kv: '3/1/1/0', sk: SK_ALLE, tn: 'Anna:1|Ben:2,3|Carla:',
    ton: [MIX, MIX, FG_MIT], mess: [[KEIN, LIEFERT, ZULETZT], [KEIN, LIEFERT], [KEIN, LIEFERT]],
  };
  const drehbuch: Schritt[] = [
    {
      name: 'Start: Anna gezeigt, Sprecher und Freigabe ohne Ziel (T15, T26, T29c; Z9b)',
      texte: [ANNA_ZEIGT, 'Wartet auf eine sprechende Person · Ersatzbild transparent', OHNE_FREIGABE], kopf: '● Zoom: 3 Slots laufen, 2 mit Ersatzbild',
      kv: '3/1/1/0', sk: ['1:1101:teilnehmer:Anna:zeigt', '2:1001:sprecher::ersatz', '3:1001:freigabe::ersatz'], tn: 'Anna:1|Ben:|Carla:',
      ton: [MIX, MIX, FG_OHNE], mess: [[KEIN, LIEFERT], [KEIN], [KEIN]],
    },
    {
      name: '800 ms: Sprecher Ben (T25)', texte: [ANNA_ZEIGT, BEN_SPRICHT, OHNE_FREIGABE], kopf: '● Zoom: 3 Slots laufen, 1 mit Ersatzbild', kv: '3/1/1/0',
      sk: SK_OHNE_FREIGABE, tn: 'Anna:1|Ben:2|Carla:', ton: [MIX, MIX, FG_OHNE], mess: [[KEIN, LIEFERT], [KEIN, LIEFERT], [KEIN]],
    },
    {
      name: '2000 ms: Annas Kamera aus (T19; zoom_slot1_live=0, _target leer)',
      texte: ['Anna: Kamera aus · Ersatzbild transparent', BEN_SPRICHT, OHNE_FREIGABE], kopf: '● Zoom: 3 Slots laufen, 2 mit Ersatzbild', kv: '3/1/1/0',
      sk: ['1:1001:teilnehmer::ersatz', '2:1101:sprecher:Ben:zeigt', '3:1001:freigabe::ersatz'], tn: 'Anna:1|Ben:2|Carla:',
      ton: [MIX, MIX, FG_OHNE], mess: [[ZULETZT, KEIN], [KEIN, LIEFERT], [KEIN]],
    },
    {
      name: '2600 ms: Kamera wieder an', texte: [ANNA_ZEIGT, BEN_SPRICHT, OHNE_FREIGABE], kopf: '● Zoom: 3 Slots laufen, 1 mit Ersatzbild', kv: '3/1/1/0',
      sk: SK_OHNE_FREIGABE, tn: 'Anna:1|Ben:2|Carla:', ton: [MIX, MIX, FG_OHNE], mess: [[ZULETZT, KEIN, LIEFERT], [KEIN, LIEFERT], [KEIN]],
    },
    { name: '3000 ms: Freigabe Ben (T28; Z9)', ...ALLE_LAUFEN },
    {
      name: '3200 ms: Freigabe Carla, die neueste von 2 (T28b)', ...ALLE_LAUFEN,
      texte: [ANNA_ZEIGT, BEN_SPRICHT, 'Zeigt die Freigabe von Carla (die neueste von 2: Ben, Carla).'],
      sk: ['1:1101:teilnehmer:Anna:zeigt', '2:1101:sprecher:Ben:zeigt', '3:1101:freigabe:Carla:zeigt'], tn: 'Anna:1|Ben:2|Carla:3',
    },
    { name: '3800 ms: Carla endet, wieder Ben (T28)', ...ALLE_LAUFEN },
    {
      name: '4400 ms: Anna geht (T16; zoom_alarm=1, zoom_slot1_alarm=1, zoom_slot1_live=0)', ...ALLE_LAUFEN,
      texte: ['Wartet auf Anna · Ersatzbild transparent', BEN_SPRICHT, FREIGABE_BEN], kopf: '● Zoom: 3 Slots laufen, 1 mit Ersatzbild', kv: '3/1/1/1',
      sk: ['1:1011:teilnehmer::ersatz', '2:1101:sprecher:Ben:zeigt', '3:1101:freigabe:Ben:zeigt'], tn: 'Ben:2,3|Carla:',
      mess: [[KEIN, ZULETZT], [KEIN, LIEFERT], [KEIN, LIEFERT]],
    },
    { name: '4900 ms: Anna kommt zurück (T15)', ...ALLE_LAUFEN },
    {
      name: '5600 ms: Entzug, die Slots laufen noch (Z7b, T83; Karte „Connect stoppt 3 Slots …“)', ...ALLE_LAUFEN,
      kopf: '△ Zoom: 3 Slots laufen, Aufnahme-Erlaubnis fehlt', kv: '3/1/0/1', karte: 'Aufnahme-Erlaubnis vom Host entzogen. Connect stoppt 3 Slots …',
    },
    { name: '6200 ms: Wiedererteilung (Z9)', ...ALLE_LAUFEN },
    {
      name: '6500 ms: später Abbau bei Erlaubnis „ja“ → SZ11 mit T14 (Z8), Ton T58h, keine Messzeile',
      texte: ['Startet …', 'Startet …', 'Startet …'], kopf: '○ Zoom: im Meeting, kein Slot läuft', kv: '0/0/1/0',
      sk: ['1:1001:teilnehmer::startet', '2:1001:sprecher::startet', '3:1001:freigabe::startet'], tn: 'Anna:|Ben:|Carla:',
      kz: '3 von 16 Slots · 3 eingeschaltet · 0 laufen',
      ton: [['Ton: Mischton, sobald der Slot läuft'], ['Ton: Mischton, sobald der Slot läuft'], ['Ton: Mischton + Computerton, sobald der Slot läuft']],
      mess: [[null], [null], [null]],
    },
    { name: '… der Abgleich startet alle drei wieder', ...ALLE_LAUFEN },
  ];
  // Das Drehbuch endet nach 6500 ms; danach startet der Abgleich die Slots. Gewartet wird höchstens 12 s auf den letzten Schritt.
  await bis(() => {
    let ab = 0;
    for (const s of drehbuch) { ab = finde(s, ab); if (ab < 0) return false; }
    return true;
  }, 12_000);
  const stellen = pruefeFolge(drehbuch, 0);
  const [, nachBen, nachKameraAus] = stellen;
  ck('… Carla (1100 ms) blieb innerhalb der Haltezeit: Slot 2 zeigte nie Carla', nachBen >= 0 && nachKameraAus >= 0
    && !p.abbilder.slice(nachBen, nachKameraAus).some((a) => a.slots[1]?.text.includes('Carla')));
  const eins = slotBefehle(p, 1, 1).map((c) => (c.cmd === 'slotSet' && c.id === ANNA_ZURUECK ? 'Rückkehr' : String(c.cmd)));
  ck('… Rückkehr über slotSet mit der neuen Kennung, ohne Neustart', eins.slice(0, eins.indexOf('Rückkehr') + 1).join(',') === 'slotOn,Rückkehr');
  const ende = stellen.at(-1) ?? -1;
  ck('Moduswechsel durch den Test: Slot 2 auf Teilnehmer „Carla“ → slotSet {mode, id}, T15', ok(p.kern.slotAendern(2, { modus: 'teilnehmer', person: 'Carla' })));
  const carla: Schritt = {
    name: '… Slot 2 zeigt Carla', ...ALLE_LAUFEN, texte: [ANNA_ZEIGT, 'Zeigt Carla.', FREIGABE_BEN],
    sk: ['1:1101:teilnehmer:Anna:zeigt', '2:1101:teilnehmer:Carla:zeigt', '3:1101:freigabe:Ben:zeigt'], tn: 'Anna:1|Ben:3|Carla:2',
  };
  await bis(() => finde(carla, Math.max(ende, 0)) >= 0, 4000);
  pruefeFolge([carla], Math.max(ende, 0));
  ck('… in keinem Abbild eine Fehlerzeile oder „0 Bilder/s“', !p.abbilder.some((a) => a.slots.some((s) => s.fehler !== null || NULL_BILDER.test(s.messText ?? ''))));
  await p.aufraeumen();
}

console.log('— PK27 · macOS: keine zoom_*-Schlüssel, kein Slot-Aufruf an eine Bridge (7.11, E30)');
{
  const { zoomAktiv, zoomStateTeil } = await import('../src/main/zoom/plattform');
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })] });
  const kv = p.kern.stateKv();
  ck('PK27: unter Windows aktiv, der STATE-Teil trägt die zoom_*-Schlüssel', zoomAktiv('win32')
    && kv !== null && Object.keys(kv).length > 0 && Object.keys(kv).every((k) => k.startsWith('zoom_'))
    && JSON.stringify(zoomStateTeil('win32', kv)) === JSON.stringify(kv));
  ck('… unter macOS nicht aktiv, kein zoom_*-Schlüssel', !zoomAktiv('darwin') && JSON.stringify(zoomStateTeil('darwin', kv)) === '{}');
  ck('… ohne Werte kein Teil', JSON.stringify(zoomStateTeil('win32', null)) === '{}');
  const huelle = readFileSync(new URL('../src/main/zoom.ts', import.meta.url), 'utf8');
  ck('… die Hülle legt den Kern nur über zoomAktiv an (ohne Kern kein Slot-Aufruf an eine Bridge) und meldet den STATE über zoomStateTeil',
    huelle.includes('!zoomAktiv(process.platform)') && huelle.includes('zoomStateTeil(process.platform, ') && !huelle.includes("process.platform !== 'win32'"));
  await p.aufraeumen();
}

// ── Plan B, Task B23: PK33 endgültig — kein Altweg mehr in Connect (Spec 7.10, 6.18, 0.20; Gliederung A-EP1, A-EP7) ──
{
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const dateien = (ordner: string): string[] => readdirSync(ordner).flatMap((n) => {
    const p = join(ordner, n);
    return statSync(p).isDirectory() ? dateien(p) : /\.(ts|tsx|mjs|cjs|js)$/.test(n) ? [p] : [];
  });
  const treffer = (liste: string[], muster: RegExp): string[] => liste.flatMap((p) => readFileSync(p, 'utf8').split(/\r?\n/)
    .flatMap((z, i) => (muster.test(z) ? [`${p.slice(p.lastIndexOf('connect'))}:${i + 1}`] : [])));
  const quelle = dateien(fileURLToPath(new URL('../src/', import.meta.url)));
  const tests = dateien(fileURLToPath(new URL('./', import.meta.url)));
  // Die Namen stehen hier zerlegt, damit diese Datei sich nicht selbst findet.
  const ALT = ['FAKE_' + 'ALTWEG', 'FAKE_' + 'ABO_VERZOEGERUNG_MS'];
  const imCode = treffer(quelle, /\bvideo(Un)?[Ss]ubscribe\b/);
  ck('B23 PK33: in apps/connect/src kein videoSubscribe und kein videoUnsubscribe (auch nicht im Kommentar)', quelle.length > 20 && imCode.length === 0);
  if (imCode.length) console.log(`      Treffer: ${imCode.join(' / ')}`);
  const imTest = treffer(tests, new RegExp(`\\b(${ALT.join('|')})\\b`));
  ck(`B23 A-EP1: kein Connect-Test setzt ${ALT.join(' oder ')} (die Attrappe kennt beide nicht mehr)`, tests.length > 5 && imTest.length === 0);
  if (imTest.length) console.log(`      Treffer: ${imTest.join(' / ')}`);
  const aboAlt = treffer(tests, new RegExp('FAKE_' + "ABO_FEHLER: *'[^':]*'"));
  ck('B23 A-EP7: Connect-Tests setzen den Abo-Fehler der Attrappe nur im Format „nr:sdk“', aboAlt.length === 0);
  if (aboAlt.length) console.log(`      Treffer: ${aboAlt.join(' / ')}`);
}

// ── Nachtrag B zu Plan B: Slot-Wahrheit nach später Antwort (NB8, I-1), Nummer bis slot off reserviert (NB2/NB7, I-2 bis I-6) ──
/** Was die Attrappe `startNr` nach ihren eigenen Ereignissen hält (wie Session.slots): je Sender NDI-Name, Modus, Ziel, Ton. */
interface AttrappenSender { ndi: string; mode: string; target: number; state: string; sent: string; ton: string }
function sender(p: Probe, startNr = 1): Map<number, AttrappenSender> {
  const m = new Map<number, AttrappenSender>();
  for (const { startNr: n, ev } of p.ereignisse) {
    if (n !== startNr) continue;
    const e = ev as unknown as Record<string, unknown> & { slot: number };
    if (e.ev === 'slot') {
      if (e.state === 'off') m.delete(e.slot);
      else {
        m.set(e.slot, {
          ton: m.get(e.slot)?.ton ?? 'off/none', ndi: String(e.ndi), mode: String(e.mode), target: Number(e.target), state: String(e.state), sent: String(e.sent),
        });
      }
    } else if (e.ev === 'slotAudio') {
      const s = m.get(e.slot);
      if (s) s.ton = `${String(e.state)}/${String(e.configured)}`;
    }
  }
  return m;
}
/** Die Attrappe `startNr` hat für diese Nummer einen Sender gemeldet (die späte Antwort ist angekommen). */
function meldeteSender(p: Probe, nr: number, startNr = 1): boolean {
  return p.ereignisse.some((x) => x.startNr === startNr && x.ev.ev === 'slot'
    && (x.ev as unknown as { slot: number }).slot === nr && (x.ev as unknown as { state: string }).state !== 'off');
}
const zaehle = (p: Probe, cmd: string, nr: number, startNr = 1): number => slotGesendet(p, startNr, nr).filter((c) => c.cmd === cmd).length;
const TEILNEHMER_EREIGNISSE = ['joined', 'left', 'renamed', 'videoStatus'];
/** Nach dem roster des Beitritts kam kein Teilnehmer-Ereignis (kein Auslöser des Abgleichs). */
const keinTeilnehmerEreignis = (p: Probe): boolean => p.ereignisse.filter((x) => x.ev.ev === 'roster').length === 1
  && !p.ereignisse.some((x) => TEILNEHMER_EREIGNISSE.includes(x.ev.ev));

console.log('— NB8 · Slot-Wahrheit: was sich während des slotOn ändert, geht nach der Antwort als ein slotSet nach (I-1)');
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna' })], stell: () => ({ FAKE_SLOT_SPAET: '1:500', FAKE_SPRECHER_FOLGE: `200:${BEN}` }) });
  await insMeeting(p);
  befehl(p, 'zoom_slot', '1', 'ON');
  befehl(p, 'zoom_slot_mode', '1', 'sprecher');
  ck('NB8 (1): ON und MODE sprecher im selben Tick (Companion) → die Bridge endet im Sprecher-Modus und zeigt den Sprecher Ben',
    await bis(() => sender(p).get(1)?.mode === 'speaker' && sender(p).get(1)?.target === BEN && sender(p).get(1)?.state === 'live', 4000));
  ck('… Kachel und zoom_slot1_mode stimmen mit der Bridge überein; ein slotOn, danach genau ein slotSet {mode: speaker}',
    (await bis(() => lage(p, 1)?.text === 'Zeigt Ben (Sprecher).', 2000))
    && (p.kern.stateKv() as Record<string, unknown> | null)?.zoom_slot1_mode === 'sprecher'
    && (await warte(300), zaehle(p, 'slotOn', 1) === 1)
    && JSON.stringify(slotGesendet(p, 1, 1).filter((c) => c.cmd === 'slotSet')) === JSON.stringify([{ cmd: 'slotSet', slot: 1, mode: 'speaker' }]));
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna' })], stell: () => ({ FAKE_SLOT_SPAET: '1:500' }) });
  await insMeeting(p);
  befehl(p, 'zoom_slot', '1', 'ON');
  befehl(p, 'zoom_slot_audio', '1', 'OFF');
  ck('NB8 (2): ON und Ton aus im selben Tick → die Bridge endet ohne Ton und zeigt Anna',
    await bis(() => sender(p).get(1)?.ton === 'off/none' && sender(p).get(1)?.target === ANNA && sender(p).get(1)?.state === 'live', 4000));
  ck('… nach der Antwort genau ein slotSet {audio: off, shareAudio: false}; Kachel und zoom_slot1_audio sagen Ton aus',
    (await warte(300), JSON.stringify(slotGesendet(p, 1, 1).filter((c) => c.cmd === 'slotSet'))
      === JSON.stringify([{ cmd: 'slotSet', slot: 1, audio: 'off', shareAudio: false }]))
    && slotKurz(p, 1)?.tonEin === false && lage(p, 1)?.einstellung.tonAn === false);
  await p.aufraeumen();
}
{
  const p = baueKern({
    slots: [slotEinst(1, { modus: 'sprecher', an: true })], stell: () => ({ FAKE_SLOT_SPAET: '1:400', FAKE_SPRECHER_FOLGE: `100:${CARLA}`, FAKE_TEILNEHMER: '3' }),
  });
  await insMeeting(p);
  ck('NB8 (3): der Sprecher-Slot läuft und zeigt Carla', await bis(() => sender(p).get(1)?.mode === 'speaker' && sender(p).get(1)?.target === CARLA
    && lage(p, 1)?.zustand === 'zeigt', 4000));
  befehl(p, 'zoom_slot_mode', '1', 'teilnehmer');
  befehl(p, 'zoom_slot_person', '1', 'Ben');
  ck('… MODE teilnehmer (Antwort verzögert), gleich danach PERSON Ben → die Bridge zeigt Ben ohne ein weiteres Teilnehmer-Ereignis',
    await bis(() => sender(p).get(1)?.mode === 'participant' && sender(p).get(1)?.target === BEN && lage(p, 1)?.zustand === 'zeigt', 4000)
    && keinTeilnehmerEreignis(p));
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: () => ({ FAKE_SLOT_SPAET: '1:500', FAKE_DOPPELNAME: '1' }) });
  await insMeeting(p);
  ck('NB8 (4): zwei „Anna“ → das slotOn ohne Ziel ist unterwegs', (await bis(() => zaehle(p, 'slotOn', 1) === 1, 2000))
    && slotGesendet(p, 1, 1)[0]?.id === 0 && !meldeteSender(p, 1));
  ck('… Handwahl der zweiten „Anna“, während slotOn im Flug ist', ok(p.kern.slotPersonWaehlen(1, BEN)));
  ck('… die Bridge zeigt die gewählte Person ohne ein weiteres Teilnehmer-Ereignis', await bis(() => sender(p).get(1)?.target === BEN
    && sender(p).get(1)?.state === 'live', 4000) && keinTeilnehmerEreignis(p));
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: () => ({ FAKE_SLOT_SPAET: '1:500' }) });
  await insMeeting(p);
  await bis(() => zaehle(p, 'slotOn', 1) === 1, 2000);
  ck('NB8 (5): Auflösung 1080p und Ersatzbild schwarz, während slotOn im Flug ist → gespeichert, noch kein slotSet',
    ok(p.kern.slotAendern(1, { aufloesung: '1080p', ersatzbild: 'schwarz' })) && gespeichert(p, 1)?.aufloesung === '1080p' && zaehle(p, 'slotSet', 1) === 0);
  ck('… nach der Antwort genau ein slotSet mit beiden Feldern', (await bis(() => zaehle(p, 'slotSet', 1) === 1, 3000))
    && JSON.stringify(slotGesendet(p, 1, 1).find((c) => c.cmd === 'slotSet')) === JSON.stringify({ cmd: 'slotSet', slot: 1, resolution: '1080p', fallback: 'black' }));
  ck('… die Bridge endet richtig: mit der neuen Auflösung umgehängt (Ersatzbild schwarz), danach Bild; kein weiteres slotSet',
    await bis(() => p.ereignisse.some((x) => x.ev.ev === 'slot' && (x.ev as unknown as { slot: number }).slot === 1
      && (x.ev as unknown as { reason: string }).reason === 'resolutionChanged' && (x.ev as unknown as { sent: string }).sent === 'black')
      && sender(p).get(1)?.state === 'live', 3000) && (await warte(300), zaehle(p, 'slotSet', 1) === 1));
  await p.aufraeumen();
}

console.log('— NB2/NB7 · Slot-Wahrheit: kein Sender, den Connect nicht kennt; die Nummer bleibt bis slot off reserviert (I-2 bis I-6)');
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: () => ({ FAKE_SLOT_SPAET: '1:500' }) });
  await insMeeting(p);
  await bis(() => zaehle(p, 'slotOn', 1) === 1, 2000);
  ck('NB2/NB7 (6): „Stopp“ und „Löschen“, während slotOn im Flug ist → für den Bediener sofort weg (Karte, Zählung, STATE)',
    ok(p.kern.slotStart(1, false)) && ok(p.kern.slotLoeschen(1)) && lage(p, 1) === undefined && slotKurz(p, 1) === undefined
    && p.kern.kurz().slotsAn === 0 && p.einst.slots.length === 0);
  ck('… die späte Antwort baut den Sender, Connect stoppt ihn mit genau einem slotOff; am Ende hält die Bridge keinen Sender',
    (await bis(() => meldeteSender(p, 1) && sender(p).size === 0, 4000)) && (await warte(300), zaehle(p, 'slotOff', 1) === 1) && lage(p, 1) === undefined);
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_SLOT_SPAET: '1:1200' }), fristen: { aboAntwortMs: 400 } });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  befehl(p, 'zoom_unload', 'Ben');
  ck('NB2/NB7 (7): zoom_load Ben, gleich zoom_unload → der vorübergehende Slot wartet auf die Antwort', lage(p, 1)?.voruebergehend === true
    && lage(p, 1)?.einstellung.an === false && zaehle(p, 'slotOn', 1) === 1);
  ck('… Fristablauf vor der Antwort: zuerst slotOff, dann gelöscht', (await bis(() => lage(p, 1) === undefined, 2000)) && zaehle(p, 'slotOff', 1) === 1
    && p.logs.indexOf('[zoom] Slot 1 wird gestoppt (Antwort steht aus)') >= 0
    && p.logs.indexOf('[zoom] Slot 1 wird gestoppt (Antwort steht aus)') < p.logs.indexOf('[zoom] Slot 1 gelöscht (vorübergehend)'));
  ck('… die späte Antwort hinterlässt keinen Sender', await bis(() => meldeteSender(p, 1) && sender(p).size === 0, 3000));
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_SLOT_STUMM: '1' }), fristen: { aboAntwortMs: 400 } });
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  befehl(p, 'zoom_unload', 'Ben');
  ck('NB2/NB7 (7, Antwort nie): Fristablauf → slotOff, dann gelöscht', (await bis(() => lage(p, 1) === undefined, 2000)) && zaehle(p, 'slotOff', 1) === 1);
  ck('… die Bridge hält keinen Sender (slotNotOn): die Nummer ist wieder frei, zoom_load Anna bekommt die 1',
    (await bis(() => p.ereignisse.some((x) => x.ev.ev === 'error' && (x.ev as unknown as { code: string }).code === 'slotNotOn'), 2000))
    && (befehl(p, 'zoom_load', 'Anna'), lage(p, 1)?.einstellung.person === 'Anna') && !meldeteSender(p, 1));
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: () => ({ FAKE_SLOT_SPAET: '1:600' }) });
  await insMeeting(p);
  await bis(() => zaehle(p, 'slotOn', 1) === 1, 2000);
  const neu = ok(p.kern.slotStart(1, false)) && ok(p.kern.slotLoeschen(1)) ? p.kern.slotAnlegen() : { ok: false };
  ck('NB2/NB7 (8): Löschen im Flug, sofort „Slot hinzufügen“ → die 1 bleibt verdeckt reserviert, der neue Slot bekommt die 2',
    neu.ok && 'nr' in neu && neu.nr === 2 && p.kern.abbild().slots.map((s) => s.einstellung.nr).join(',') === '2');
  ck('… Person Ben und Start', ok(p.kern.slotAendern(2, { person: 'Ben' })) && ok(p.kern.slotStart(2, true)));
  ck('… am Ende läuft genau ein Sender: Slot 2 unter „Zoom 2“ mit Ben; der späte Sender der 1 ist wieder weg', await bis(() => meldeteSender(p, 1)
    && sender(p).size === 1 && sender(p).get(2)?.ndi === 'Zoom 2' && sender(p).get(2)?.target === BEN && lage(p, 2)?.zustand === 'zeigt', 4000));
  ck('… der neue Slot übernahm den alten Sender nie (an die 1 nur slotOn und slotOff), danach ist die 1 wieder frei',
    slotGesendet(p, 1, 1).map((c) => c.cmd).join(',') === 'slotOn,slotOff' && p.kern.slotAnlegen().nr === 1);
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })] });
  await insMeeting(p);
  ck('NB2/NB7 (9): Slot 1 zeigt Anna', await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000));
  // Connect verliert den Sender (eingespeistes slot off), die Attrappe hält ihn weiter: das neue slotOn trifft auf slotAlreadyOn.
  p.einspeisen(1, { ev: 'slot', slot: 1, state: 'off', mode: 'participant', target: ANNA, share: 0, reason: 'command', sent: 'none', ndi: 'Zoom 1' });
  ck('… slotAlreadyOn ohne bekannten Sender → slotOff, nach dessen slot off ein neues slotOn',
    await bis(() => slotGesendet(p, 1, 1).map((c) => c.cmd).join(',') === 'slotOn,slotOn,slotOff,slotOn', 3000));
  ck('… am Ende läuft der Slot mit dem richtigen NDI-Namen', await bis(() => lage(p, 1)?.zustand === 'zeigt' && sender(p).size === 1
    && sender(p).get(1)?.ndi === 'Zoom 1' && sender(p).get(1)?.target === ANNA, 3000));
  p.einspeisen(1, { ev: 'roster', list: [] });
  await warte(600);
  ck('… keine slotOn-Flut: ein späteres roster startet nichts', zaehle(p, 'slotOn', 1) === 3 && zaehle(p, 'slotOff', 1) === 1);
  p.einspeisen(1, { ev: 'slot', slot: 9, state: 'starting', mode: 'participant', target: BEN, share: 0, reason: 'command', sent: 'transparent', ndi: 'Fremd 9' });
  p.einspeisen(1, { ev: 'slot', slot: 9, state: 'live', mode: 'participant', target: BEN, share: 0, reason: 'frames', sent: 'none', ndi: 'Fremd 9' });
  p.einspeisen(1, { ev: 'slotAudio', slot: 10, state: 'waiting', source: 'none', configured: 'mix', reason: 'command' });
  p.einspeisen(1, { ev: 'slotAudio', slot: 10, state: 'live', source: 'mix', configured: 'mix', reason: 'packets' });
  ck('I-3: Nicht-off-Ereignisse für Nummern ohne Connect-Slot → je Sender genau ein slotOff, keine Kachel; die Logzeile ohne NDI-Namen',
    zaehle(p, 'slotOff', 9) === 1 && zaehle(p, 'slotOff', 10) === 1 && p.kern.abbild().slots.length === 1 && !p.logs.some((z) => z.includes('Fremd')));
  ck('… beide Nummern sind reserviert, bis die Bridge antwortet (slotNotOn), dann wieder frei',
    await bis(() => p.ereignisse.filter((x) => x.ev.ev === 'error' && (x.ev as unknown as { code: string }).code === 'slotNotOn').length === 2, 2000)
    && (await warte(100), JSON.stringify(Array.from({ length: 9 }, () => p.kern.slotAnlegen().nr)) === JSON.stringify([2, 3, 4, 5, 6, 7, 8, 9, 10])));
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: () => ({ FAKE_SLOT_SPAET: '1:500' }) });
  await insMeeting(p);
  await bis(() => zaehle(p, 'slotOn', 1) === 1, 2000);
  ck('NB2/NB7 (10): „Stopp“, NDI-Name „Bühne Anna“ und „Start“, während das erste slotOn im Flug ist', ok(p.kern.slotStart(1, false))
    && ok(p.kern.slotAendern(1, { ndiName: 'Bühne Anna' })) && ok(p.kern.slotStart(1, true)));
  ck('… die späte Antwort trägt den alten NDI-Namen → genau ein slotOff; danach läuft genau ein Sender unter „Bühne Anna“ mit Anna',
    (await bis(() => sender(p).size === 1 && sender(p).get(1)?.ndi === 'Bühne Anna' && sender(p).get(1)?.target === ANNA && lage(p, 1)?.zustand === 'zeigt', 5000))
    && (await warte(300), zaehle(p, 'slotOff', 1) === 1)
    && p.ereignisse.some((x) => x.ev.ev === 'slot' && (x.ev as unknown as { ndi: string }).ndi === 'Zoom 1'));
  await p.aufraeumen();
}
{
  // #287 (Review Focus 5): wie (10), aber nur die Person wechselt. Der Name eines Senders ist der seines slotOn; ohne bekannten
  // Sender gilt das zuletzt gesendete slotOn. Die späte Antwort auf das ältere mit anderem Namen bleibt fremd.
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], personImNdiNamen: true, stell: () => ({ FAKE_SLOT_SPAET: '1:500' }) });
  await insMeeting(p);
  await bis(() => zaehle(p, 'slotOn', 1) === 1, 2000);
  ck('#287 (NB2/NB7 (10) mit Person): das slotOn „Zoom 1 (Anna)“ ist im Flug; „Stopp“, Person Ben und „Start“ → slotOn „Zoom 1 (Ben)“',
    slotGesendet(p, 1, 1)[0]?.ndi === 'Zoom 1 (Anna)' && ok(p.kern.slotStart(1, false)) && ok(p.kern.slotAendern(1, { person: 'Ben' }))
    && ok(p.kern.slotStart(1, true)) && slotGesendet(p, 1, 1)[1]?.cmd === 'slotOn' && slotGesendet(p, 1, 1)[1]?.ndi === 'Zoom 1 (Ben)');
  ck('… die späte Antwort trägt „Zoom 1 (Anna)“ → genau ein slotOff; am Ende läuft genau ein Sender „Zoom 1 (Ben)“ mit Ben',
    (await bis(() => sender(p).size === 1 && sender(p).get(1)?.ndi === 'Zoom 1 (Ben)' && sender(p).get(1)?.target === BEN && lage(p, 1)?.zustand === 'zeigt', 5000))
    && (await warte(300), zaehle(p, 'slotOff', 1) === 1)
    && p.ereignisse.some((x) => x.ev.ev === 'slot' && (x.ev as unknown as { ndi: string }).ndi === 'Zoom 1 (Anna)'));
  ck('… keine Logzeile nennt Anna oder Ben', !p.logs.some((z) => /(?<![\p{L}\p{N}])(?:Anna|Ben)(?![\p{L}\p{N}])/u.test(z)));
  await p.aufraeumen();
}
{
  // #287 (Review Task 2, Minor 2): Rückfall in senderNameFuer. Wurde der Slot seit dem offenen slotOn umbenannt und nicht neu
  // gestartet, gilt der neue NDI-Name des Slots: Die späte Antwort mit dem Namen des slotOn bleibt fremd und wird nie übernommen.
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], personImNdiNamen: true, stell: () => ({ FAKE_SLOT_SPAET: '1:500' }) });
  await insMeeting(p);
  await bis(() => zaehle(p, 'slotOn', 1) === 1, 2000);
  ck('#287 (Umbenennen ohne Neustart): „Stopp“ und NDI-Name „Bühne“, während „Zoom 1 (Anna)“ im Flug ist; kein „Start“',
    slotGesendet(p, 1, 1)[0]?.ndi === 'Zoom 1 (Anna)' && ok(p.kern.slotStart(1, false)) && ok(p.kern.slotAendern(1, { ndiName: 'Bühne' })));
  ck('… die späte Antwort ist fremd: genau ein slotOff über „fremder Sender“, nie übernommen (kein liefSchon), die Bridge hält am Ende keinen Sender',
    (await bis(() => meldeteSender(p, 1) && sender(p).size === 0, 4000)) && (await warte(300), zaehle(p, 'slotOff', 1) === 1)
    && p.logs.some((z) => z.startsWith('[zoom] Slot 1: fremder Sender')) && !p.logs.includes('[zoom] Slot 1 wird gestoppt')
    && lage(p, 1)?.liefSchon === false && lage(p, 1)?.zustand === 'aus' && zaehle(p, 'slotOn', 1) === 1);
  await p.aufraeumen();
}

// ── #287, Fix-Runde 1 (Ruling): Der Name vom Einschalten bleibt über automatische Neustarts stehen, bis der Slot aus ist ──
console.log('— #287 · Startname: Entzug, Schalter, Z11 behalten ihn; „Stopp“/„Start“ und Meeting-Ende bilden ihn neu');
/** ndi der slotOn an Slot `nr` (alle Bridges), in Reihenfolge. */
const startNamen = (p: Probe, nr = 1): string[] => slotGesendet(p, undefined, nr).filter((c) => c.cmd === 'slotOn').map((c) => String(c.ndi));
const KEIN_NAME_IM_LOG = (p: Probe): boolean => !p.logs.some((z) => /(?<![\p{L}\p{N}])(?:Anna|Ben)(?![\p{L}\p{N}])/u.test(z));
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })], personImNdiNamen: true, stell: () => ({ FAKE_ENTZUG_MS: '2000', FAKE_ERTEILUNG_MS: '800' }),
  });
  await insMeeting(p);
  ck('#287 Startname (Entzug): Slot 1 läuft als „Zoom 1 (Anna)“', (await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000))
    && startNamen(p).join('|') === 'Zoom 1 (Anna)');
  ck('… Person Ben am laufenden Slot → nur slotSet, die Bridge zeigt Ben', ok(p.kern.slotAendern(1, { person: 'Ben' }))
    && (await bis(() => sender(p).get(1)?.target === BEN, 2000)) && startNamen(p).length === 1);
  ck('… Entzug und Wiedererteilung: der automatische Neustart geht wieder als „Zoom 1 (Anna)“, mit Ben als Ziel, der Slot zeigt Ben',
    (await bis(() => startNamen(p).length === 2 && lage(p, 1)?.zustand === 'zeigt' && sender(p).get(1)?.target === BEN, 6000))
    && startNamen(p)[1] === 'Zoom 1 (Anna)' && slotGesendet(p, 1, 1).filter((c) => c.cmd === 'slotOn')[1]?.id === BEN
    && sender(p).get(1)?.ndi === 'Zoom 1 (Anna)' && KEIN_NAME_IM_LOG(p));
  await p.aufraeumen();
}
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })], personImNdiNamen: true, stell: () => ({ FAKE_ENTZUG_MS: '2000', FAKE_ERTEILUNG_MS: '800' }),
  });
  await insMeeting(p);
  ck('#287 Startname (Schalter aus): Slot 1 läuft als „Zoom 1 (Anna)“', (await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000))
    && startNamen(p).join('|') === 'Zoom 1 (Anna)');
  ck('… Schalter aus, während er läuft → kein Befehl', ok(p.kern.personImNdiNamenSetzen(false)) && (await warte(200), slotGesendet(p, 1, 1).length === 1));
  ck('… Entzug und Wiedererteilung: der automatische Neustart bleibt „Zoom 1 (Anna)“ (nicht „Zoom 1“)',
    (await bis(() => startNamen(p).length === 2 && lage(p, 1)?.zustand === 'zeigt', 6000)) && startNamen(p)[1] === 'Zoom 1 (Anna)'
    && sender(p).get(1)?.ndi === 'Zoom 1 (Anna)');
  await p.aufraeumen();
}
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })], personImNdiNamen: true,
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_VERBINDUNG_WEG_MS: '1800' } : {}),
  });
  await insMeeting(p);
  ck('#287 Startname (Z11): Slot 1 läuft als „Zoom 1 (Anna)“, dann Person Ben', (await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000))
    && ok(p.kern.slotAendern(1, { person: 'Ben' })) && (await bis(() => sender(p).get(1)?.target === BEN, 2000)));
  ck('… nach dem Abriss baut die neue Bridge den Slot wieder als „Zoom 1 (Anna)“ (Ziel Ben)',
    (await bis(() => p.starts() === 2 && slotGesendet(p, 2, 1).some((c) => c.cmd === 'slotOn') && lage(p, 1)?.zustand === 'zeigt', 8000))
    && slotGesendet(p, 2, 1).find((c) => c.cmd === 'slotOn')?.ndi === 'Zoom 1 (Anna)' && slotGesendet(p, 2, 1).find((c) => c.cmd === 'slotOn')?.id === BEN
    && sender(p, 2).get(1)?.ndi === 'Zoom 1 (Anna)' && KEIN_NAME_IM_LOG(p));
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], personImNdiNamen: true });
  await insMeeting(p);
  ck('#287 Startname (Stopp/Start): Slot 1 läuft als „Zoom 1 (Anna)“, dann Person Ben', (await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000))
    && ok(p.kern.slotAendern(1, { person: 'Ben' })));
  ck('… „Stopp“ des Bedieners, dann „Start“ → „Zoom 1 (Ben)“', ok(p.kern.slotStart(1, false)) && (await bis(() => lage(p, 1)?.zustand === 'aus', 3000))
    && ok(p.kern.slotStart(1, true)) && startNamen(p).join('|') === 'Zoom 1 (Anna)|Zoom 1 (Ben)'
    && (await bis(() => lage(p, 1)?.zustand === 'zeigt' && sender(p).get(1)?.ndi === 'Zoom 1 (Ben)', 3000)));
  await p.aufraeumen();
}
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })], personImNdiNamen: true,
    stell: (n): Record<string, string> => (n === 1 ? { FAKE_MEETING_ENDE_MS: '2000' } : {}),
  });
  await insMeeting(p);
  ck('#287 Startname (Meeting-Ende): Slot 1 läuft als „Zoom 1 (Anna)“, dann Person Ben', (await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000))
    && ok(p.kern.slotAendern(1, { person: 'Ben' })));
  ck('… nach dem Meeting-Ende und einem neuen Beitritt startet der Slot als „Zoom 1 (Ben)“',
    (await bis(() => p.kern.kurz().zustand === 'bereit', 5000)) && (await insMeeting(p))
    && (await bis(() => slotGesendet(p, 2, 1).some((c) => c.cmd === 'slotOn'), 3000))
    && slotGesendet(p, 2, 1).find((c) => c.cmd === 'slotOn')?.ndi === 'Zoom 1 (Ben)');
  await p.aufraeumen();
}
console.log('— NB8 · Gegenfall ohne Verzögerung: ein normaler Start bleibt bei genau einem slotOn je Slot');
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true }), slotEinst(2, { modus: 'sprecher', an: true }), slotEinst(3, { modus: 'freigabe', an: true })],
    stell: () => ({ FAKE_TEILNEHMER: '3', FAKE_SPRECHER_FOLGE: `200:${BEN}`, FAKE_FREIGABEN: `300:${CARLA}:101:begin` }),
  });
  await insMeeting(p);
  ck('NB8 (11): alle drei Slots zeigen Bild', await bis(() => [1, 2, 3].every((nr) => lage(p, nr)?.zustand === 'zeigt'), 4000));
  await warte(600);
  ck('… je Slot genau ein slotOn, kein slotSet und kein slotOff (Befehlszählung)',
    slotGesendet(p, 1).map((c) => `${String(c.cmd)} ${String(c.slot)}`).join(',') === 'slotOn 1,slotOn 2,slotOn 3');
  await p.aufraeumen();
}

// ── Nachtrag B zu Plan B: Kleinbefunde (NB1, M1, NB11, NB13, NB16, NB17/NB18, NB19, NB9, M2, NB5, M3) ──
console.log('— Nachtrag B · Kleinbefunde: Start-Taste, Fristen, Messwerte, Vorschau, T92, NDI-Name, „Als Slot laden“');
{
  const p = baueKern();
  await insMeeting(p);
  befehl(p, 'zoom_load', 'Ben');
  ck('NB1: zoom_load Ben → der vorübergehende Slot 1 zeigt Ben', await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000));
  befehl(p, 'zoom_unload', 'Ben');
  ck('… zoom_unload und gleich „Start“ an der Kachel', ok(p.kern.slotStart(1, true)) && lage(p, 1)?.einstellung.an === true);
  ck('… das slot off des entladenen Senders löscht den neu gestarteten Slot nicht, er läuft wieder',
    (await bis(() => zaehle(p, 'slotOn', 1) === 2 && lage(p, 1)?.zustand === 'zeigt', 3000)) && lage(p, 1)?.voruebergehend === true);
  await p.aufraeumen();
}
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true }), slotEinst(2, { person: 'Ben', an: true })],
    stell: () => ({ FAKE_ABO_FEHLER: '1:9', FAKE_SLOT_FEHLER: '2:slotRendererFailed' }),
  });
  await insMeeting(p);
  const T20C = 'Anna: Zoom hat das Abo abgelehnt (SDKERR_NORECORDINGINPROCESS) · Ersatzbild transparent. Für einen neuen Versuch „Stopp“ und wieder „Start“.';
  ck('M1: Slot 1 läuft mit T20c, Slot 2 ist gescheitert', (await bis(() => lage(p, 1)?.text === T20C, 3000))
    && (await bis(() => lage(p, 2)?.zustand === 'gescheitert', 3000)));
  befehl(p, 'zoom_slot', '1', 'ON');
  ck('… zoom_slot 1 ON am laufenden Slot: nichts geändert (T20c bleibt, kein zweites slotOn), zoom_cmd ok', cmdKv(p) === 'ok/0'
    && lage(p, 1)?.text === T20C && slotKurz(p, 1)?.alarm === true);
  ck('… „Start“ an der Kachel ebenso', ok(p.kern.slotStart(1, true)) && lage(p, 1)?.text === T20C && (await warte(300), zaehle(p, 'slotOn', 1) === 1));
  befehl(p, 'zoom_slot', '2', 'ON');
  ck('… an einem Slot ohne Sender bleibt das Wiederholen: zoom_slot 2 ON versucht es neu', await bis(() => zaehle(p, 'slotOn', 2) === 2
    && lage(p, 2)?.zustand === 'zeigt', 3000));
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: () => ({ FAKE_SLOT_SPAET: '1:800' }) });
  await insMeeting(p);
  await bis(() => zaehle(p, 'slotOn', 1) === 1, 2000);
  p.einspeisen(1, { ev: 'error', where: 'audio', code: 'audioSubscribeFailed', name: 'AUDIO_SUBSCRIBE_FAILED', slot: 1 });
  ck('NB11: ein Ton-Fehler mit Slot beendet die Antwortfrist des slotOn nicht (SZ3 bleibt)', lage(p, 1)?.zustand === 'startet');
  p.einspeisen(1, { ev: 'roster', list: [] });
  await warte(400);
  ck('… ein Abgleich danach schickt kein zweites slotOn; die Antwort kommt an', zaehle(p, 'slotOn', 1) === 1
    && (await bis(() => lage(p, 1)?.zustand === 'zeigt', 2000)) && zaehle(p, 'slotOn', 1) === 1);
  await p.aufraeumen();
}
{
  const p = baueKern({
    slots: [slotEinst(1, { person: 'Anna', an: true })], fristen: { aboAntwortMs: 400 },
    stell: () => ({ FAKE_SLOT_SPAET: '1:900', FAKE_ENTZUG_MS: '1500', FAKE_ERTEILUNG_MS: '300' }),
  });
  await insMeeting(p);
  ck('NB13: die Antwort kommt nach der Frist → T21 (keine_antwort)', await bis(() => lage(p, 1)?.zustand === 'keine_antwort', 2000));
  ck('… der späte Sender kommt an, der Slot zeigt Anna', await bis(() => lage(p, 1)?.zustand === 'zeigt', 2000));
  ck('… nach Entzug und Wiedererteilung startet er von selbst wieder (der Fehlerstand fiel mit dem späten Sender)',
    await bis(() => zaehle(p, 'slotOn', 1) === 2 && lage(p, 1)?.zustand === 'zeigt', 5000));
  await p.aufraeumen();
}
{
  const bilder: Array<{ nr: number; ziel: number }> = [];
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], onVorschau: (b) => bilder.push(b) });
  await insMeeting(p);
  await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000);
  const stats = {
    ev: 'slotStats', slot: 1, fallbackFps: 0, heldFrames: 0, workUs: 0, copyUs: 0, previewUs: 0, memKb: 0, resWanted: '720p', foreignFrames: 0,
    lateFrames: 0, tooFrequent: 0, noShareData: 0, rendererNew: 0, rendererLost: 0,
  };
  p.einspeisen(1, { ...stats, w: 1280, h: 720, fps: 30 });
  p.einspeisen(1, { ...stats });
  ck('NB16: ein slotStats ohne Größe überschreibt die bekannte letzte Größe nicht', JSON.stringify(lage(p, 1)?.zuletzt) === JSON.stringify({ b: 1280, h: 720 }));
  p.einspeisen(1, { ev: 'preview', slot: 1, target: ANNA, w: 1, h: 1, jpeg: 'RlJFTUQ=' });
  ck('NB19: Fenster nicht sichtbar → ein Vorschaubild im Flug wird verworfen', bilder.length === 0);
  p.kern.fensterSichtbar(true);
  p.einspeisen(1, { ev: 'preview', slot: 1, target: ANNA, w: 1, h: 1, jpeg: 'RlJFTUQ=' });
  ck('… sichtbar → es kommt an', bilder.length === 1 && bilder[0]?.ziel === ANNA);
  await p.aufraeumen();
}
console.log('— NB17/NB18 · Messwerte und Rückkehr gehören zu Bridge und Meeting: Meeting-Ende und neue Bridge leeren sie');
const T65_KOPF = 'Sprecher-Signale (letzte 20): Uhrzeit | Video-Sprecher | Aktives Video | Ton-Aktivität';
/** Alle Mess-Teile, die NB17/NB18 betreffen: T61, T62c, T63c, T65 mit Zeile, T66, T67. */
function messwerteVoll(p: Probe): boolean {
  const z = p.kern.messwerteText().split('\n');
  const t65 = z.indexOf(T65_KOPF);
  return z.some((l) => l.startsWith('Zoom-Bridge: ')) && z.includes('Rückkehr in Slot 1: persistentId fehlt')
    && z.some((l) => l.startsWith('Freigabe-Rückrufe (letzte 10): ')) && t65 >= 0 && z.length > t65 + 1 && /^\d\d:/.test(z[t65 + 1] ?? '')
    && z.some((l) => l.startsWith('Lücke beim Wechsel: ')) && z.some((l) => l.startsWith('Wechsel pro Minute: '));
}
const MESS_STATS = {
  ev: 'slotStats', slot: 2, fallbackFps: 0, heldFrames: 0, workUs: 0, copyUs: 0, previewUs: 0, memKb: 0, resWanted: '720p', foreignFrames: 0,
  lateFrames: 0, tooFrequent: 0, noShareData: 0, rendererNew: 0, rendererLost: 0, gapMs: 120,
};
const MESS_SLOTS = [slotEinst(1, { person: 'Anna', an: true }), slotEinst(2, { modus: 'sprecher', an: true }), slotEinst(3, { modus: 'freigabe', an: true })];
const MESS_STELL = {
  FAKE_TEILNEHMER: '3', FAKE_SPRECHER_FOLGE: `200:${BEN}`, FAKE_FREIGABEN: `300:${CARLA}:101:begin`, FAKE_WIEDERBEITRITT_MS: '500', FAKE_RUECKKEHR_MS: '200',
};
{
  const p = baueKern({ slots: MESS_SLOTS, stell: () => ({ ...MESS_STELL, FAKE_MEETING_ENDE_MS: '3800' }) });
  await insMeeting(p);
  await bis(() => lage(p, 2)?.zustand === 'zeigt', 3000);
  p.einspeisen(1, MESS_STATS);
  ck('NB17/NB18: im Meeting füllen sich T61, T62c, T63c, T65, T66 und T67', await bis(() => messwerteVoll(p), 3500));
  ck('… nach dem Meeting-Ende sind Messwerte, Freigaben, Sprecher-Signale, Lücken, Wechsel und Rückkehr leer',
    (await bis(() => p.kern.kurz().zustand === 'bereit', 3000)) && p.kern.abbild().messwerte.bridge === null && p.kern.abbild().messwerte.freigaben === null
    && p.kern.abbild().messwerte.sprecherSignale.length === 0 && p.kern.messwerteText() === T65_KOPF);
  await p.aufraeumen();
}
{
  const p = baueKern({
    slots: MESS_SLOTS, wiederbeitrittPlanMs: [30, 30, 30, 30, 30],
    stell: (n): Record<string, string> => (n === 1 ? { ...MESS_STELL, FAKE_VERBINDUNG_WEG_MS: '3800' } : { FAKE_TEILNEHMER: '3' }),
  });
  await insMeeting(p);
  await bis(() => lage(p, 2)?.zustand === 'zeigt', 3000);
  p.einspeisen(1, MESS_STATS);
  ck('NB17/NB18 (neue Bridge): mit der ersten Bridge füllen sich die Messwerte', await bis(() => messwerteVoll(p), 3500));
  ck('… die neue Bridge (Wiederbeitritt) beginnt ohne die Messwerte und die Rückkehr der alten', (await bis(() => p.starts() === 2, 6000))
    && p.kern.abbild().messwerte.bridge === null && p.kern.abbild().messwerte.freigaben === null
    && p.kern.abbild().messwerte.sprecherSignale.length === 0 && p.kern.messwerteText() === T65_KOPF);
  await p.aufraeumen();
}
console.log('— NB9/M2 · T92 kommt aus settings.ts: steht genau, solange ein Slot-Feld nur in dieser Sitzung gilt; jeder Setter meldet es');
{
  const p = baueKern({ schreibenLiefert: false });
  ck('NB9: Schreiben scheitert → T92', ok(p.kern.slotAnlegen()) && p.kern.abbild().einstellungen.nurSitzung === true);
  p.einst.schreibenLiefert = true;
  ck('… das nächste Schreiben gelingt → T92 fällt', ok(p.kern.slotAnlegen()) && p.kern.abbild().einstellungen.nurSitzung === false);
  p.einst.scheitert.add('vorgaben');
  ck('… Vorgaben nicht schreibbar → T92', ok(p.kern.vorgabenSetzen({ aufloesung: '360p', tonAn: false })) && p.kern.abbild().einstellungen.nurSitzung === true);
  p.einst.scheitert.clear();
  ck('… ein späteres erfolgreiches Schreiben der Slots hebt T92 nicht auf, solange die Vorgaben nur in der Sitzung gelten',
    ok(p.kern.slotAnlegen()) && p.kern.abbild().einstellungen.nurSitzung === true);
  ck('… erst mit den Vorgaben fällt T92', ok(p.kern.vorgabenSetzen({ aufloesung: '720p', tonAn: true })) && p.kern.abbild().einstellungen.nurSitzung === false);
  await p.aufraeumen();
}
const T92_LOG = '[zoom] Slots nur für diese Sitzung gemerkt (Einstellungsdatei nicht schreibbar)';
{
  const p = baueKern({ ueber5: true, scheitert: ['ueber5'], slots: [slotEinst(1, { an: true })] });
  ck('M2: Verfall der Zustimmung beim Anlegen des Kerns, Datei nicht schreibbar → T92 und die Logzeile',
    p.kern.abbild().einstellungen.nurSitzung === true && p.logs.includes(T92_LOG));
  await p.aufraeumen();
}
{
  const p = baueKern({ scheitert: ['ueber5'], slots: [1, 2, 3, 4, 5, 6].map((nr) => slotEinst(nr, { an: nr <= 5 })) });
  ck('M2: „Trotzdem einschalten“ (6. Slot), nur die Zustimmung nicht schreibbar → T92 und die Logzeile', ok(p.kern.slotStart(6, true, true))
    && p.kern.abbild().einstellungen.nurSitzung === true && p.logs.includes(T92_LOG));
  await p.aufraeumen();
}
{
  const p = baueKern({ scheitert: ['ueber5'], slots: [1, 2, 3, 4, 5, 6].map((nr) => slotEinst(nr, { an: nr <= 5 })) });
  befehl(p, 'zoom_slot', '6', 'ON');
  ck('M2: der 6. per Companion (F8), nur die Zustimmung nicht schreibbar → T92 und die Logzeile', cmdKv(p) === 'f8/0'
    && p.kern.abbild().einstellungen.nurSitzung === true && p.logs.includes(T92_LOG));
  await p.aufraeumen();
}
{
  const p = baueKern({ slots: [slotEinst(1)] });
  ck('NB5: ein NDI-Name nur aus Leerzeichen → T43 wie ein leerer, nichts gespeichert',
    text(p.kern.slotAendern(1, { ndiName: '   ' })) === 'Der NDI-Name muss 1 bis 60 Zeichen lang sein.' && gespeichert(p, 1)?.ndiName === 'Zoom 1');
  ck('… ebenso mit geschütztem Leerzeichen', text(p.kern.slotAendern(1, { ndiName: ' \u00a0 ' })) === 'Der NDI-Name muss 1 bis 60 Zeichen lang sein.');
  ck('… Leerzeichen am Rand eines Namens bleiben erlaubt und unverändert (Übergangs-Namensregel, W4)',
    ok(p.kern.slotAendern(1, { ndiName: ' Bühne ' })) && gespeichert(p, 1)?.ndiName === ' Bühne ');
  await p.aufraeumen();
}
{
  const p = baueKern({ stell: () => ({ FAKE_DOPPELNAME: '1' }) });
  await insMeeting(p);
  ck('M3: „Als Slot laden“ für die zweite „Anna“ → der neue Slot zeigt genau sie, ohne „Welche Person?“', ok(p.kern.slotAusPerson(BEN))
    && slotGesendet(p, 1, 1).find((c) => c.cmd === 'slotOn')?.id === BEN && (await bis(() => lage(p, 1)?.zustand === 'zeigt', 3000))
    && lage(p, 1)?.doppelt === 1 && sender(p).get(1)?.target === BEN);
  ck('… gespeichert ist nur der Name', gespeichert(p, 1)?.person === 'Anna' && !('gewaehlteId' in (gespeichert(p, 1) ?? {})));
  await p.aufraeumen();
}

// ── Nachtrag C zu Plan C (R15, Re-Review Nachtrag B Minor 1): slotEntfernen behält eine bestehende Reservierung ──
console.log('— Nachtrag C · R15: „Löschen“ nach dem slotOff einer Reservierung schickt kein zweites slotOff (I-3, einmal je Sender)');
{
  const fehlerCode = (p: Probe, code: string): boolean =>
    p.ereignisse.some((x) => x.ev.ev === 'error' && (x.ev as unknown as { code: string; slot?: number }).code === code && (x.ev as unknown as { slot?: number }).slot === 1);
  const p = baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true })], stell: () => ({ FAKE_SLOT_SPAET: '1:500' }) });
  await insMeeting(p);
  await bis(() => zaehle(p, 'slotOn', 1) === 1, 2000);
  // Muster von NB2/NB7 (10), aber „Start“ 300 ms später: Die Antwort auf das slotOn A (alter Name) kommt so deutlich vor der
  // Antwort auf das slotOn B, und dazwischen lässt sich „Stopp“ und „Löschen“ drücken.
  ck('Nachtrag C R15: „Stopp“ und NDI-Name „Bühne Anna“, während slotOn A im Flug ist', ok(p.kern.slotStart(1, false))
    && ok(p.kern.slotAendern(1, { ndiName: 'Bühne Anna' })));
  await warte(300);
  ck('… „Start“ 300 ms danach: slotOn B geht hinaus, A ist noch unbeantwortet', ok(p.kern.slotStart(1, true))
    && (await bis(() => zaehle(p, 'slotOn', 1) === 2, 1000)) && !meldeteSender(p, 1));
  ck('… die Antwort auf A trägt den alten NDI-Namen → die Nummer ist reserviert, genau ein slotOff',
    (await bis(() => meldeteSender(p, 1) && zaehle(p, 'slotOff', 1) === 1, 3000)) && !fehlerCode(p, 'slotAlreadyOn'));
  const vorB = !fehlerCode(p, 'slotAlreadyOn');
  ck('… vor der Antwort auf B „Stopp“ und „Löschen“ → kein zweites slotOff, die bestehende Reservierung bleibt',
    vorB && ok(p.kern.slotStart(1, false)) && ok(p.kern.slotLoeschen(1)) && lage(p, 1) === undefined && zaehle(p, 'slotOff', 1) === 1);
  ck('… am Ende: B bekam slotAlreadyOn, genau ein slotOff an die 1, kein slotNotOn, die Bridge hält keinen Sender, die Nummer ist frei',
    (await bis(() => fehlerCode(p, 'slotAlreadyOn') && sender(p).size === 0, 4000)) && (await warte(400), zaehle(p, 'slotOff', 1) === 1)
      && !fehlerCode(p, 'slotNotOn') && p.kern.slotAnlegen().nr === 1);
  await p.aufraeumen();
}

// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

// UX Welle 2a · Interpreter-Ableitungen (Aufgabe c; E3/E4/E10): Statusleiste als Kreuzprodukt je Eintrag, vor der ersten Antwort,
// Wechselhinweis, Ducking-Anzeige, Haupttaste, ON AIR, Vorgabe gegen Messung, Texte und Quelltext. Ohne window und ohne Electron.
import { readdirSync, readFileSync } from 'node:fs';
import * as settings from '@jm/settings';
import { AUDIO_TEXTE, audioDeviceView } from '@jm/settings';
import { MASTER_LINK_TEXTE, UNBEKANNT, ordneStatus, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { EngineState } from '@/core/engine';
import {
  ABSCHNITT,
  INTERPRETER_TEXTE,
  geraeteAbschnitt,
  hauptTaste,
  kopfOnAir,
  statusLeiste,
  type Einstellungen,
  type GeraeteStand,
  type OberflaechenStand,
} from '@/lib/oberflaeche';
import { UI_TEXTE } from '../../../../packages/ui/src/lib/texte';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { ohneKommentare } from './testzustand';

const EIN = [{ deviceId: 'a', label: 'Mikro A' }, { deviceId: 'b', label: 'Mikro B' }];
const AUS = [{ deviceId: 'k', label: 'CABLE Input (VB-Audio Virtual Cable)' }, { deviceId: 'l', label: 'Lautsprecher' }];

const motor = (p: Partial<EngineState> = {}): EngineState => ({ running: false, ducking: false, floorDb: -Infinity, interpreterDb: -Infinity, error: null, startedOutputId: null, ...p });
const einst = (p: Partial<Einstellungen> = {}): Einstellungen => ({ floorId: 'a', interpreterId: 'b', outputId: '', bypass: false, ...p });
const stand = (p: Partial<OberflaechenStand> = {}): OberflaechenStand => ({ engine: motor(), einstellungen: einst(), geraete: { eingaenge: EIN, ausgaenge: AUS, labelsAvailable: true }, masterLink: { art: 'aus' }, gestartet: null, ...p });
const leer: OberflaechenStand = { engine: undefined, einstellungen: undefined, geraete: undefined, masterLink: undefined, gestartet: null };
const eintrag = (s: OberflaechenStand, id: string): StatusItem => {
  const i = statusLeiste(s).find((x) => x.id === id);
  if (i === undefined) throw new Error(`kein Eintrag ${id}`);
  return i;
};
const zeile = (i: StatusItem): string => `${i.state} ${i.detail}`;

const LISTEN = {
  undefined: undefined,
  ohneNamen: { eingaenge: EIN, ausgaenge: AUS, labelsAvailable: false },
  leer: { eingaenge: [], ausgaenge: [], labelsAvailable: true },
  mit: { eingaenge: EIN, ausgaenge: AUS, labelsAvailable: true },
} as const satisfies Record<string, GeraeteStand | undefined>;
type ListenName = keyof typeof LISTEN;
const listeNamen = Object.keys(LISTEN) as ListenName[];
/** Eine Liste zählt nur als Messung, wenn Namen lesbar sind (ohne Freigabe sind auch die IDs leer). */
const gemessen = (n: ListenName): boolean => n === 'leer' || n === 'mit';

// ── IN Statusleiste floor, dolmetscher ──
for (const [id, feld] of [['floor', 'floorId'], ['dolmetscher', 'interpreterId']] as const) {
  pruefeFaelle(
    `IN Statusleiste ${id}: Einstellung gegen gemessene Liste`,
    kreuz({ liste: listeNamen, wert: ['', 'a', 'b', 'x'], einst: [true, false] }),
    (f) => {
      const s = stand({ geraete: LISTEN[f.liste], einstellungen: f.einst ? einst({ [feld]: f.wert }) : undefined });
      const i = eintrag(s, id);
      let soll: string;
      if (!f.einst || !gemessen(f.liste)) soll = `off ${UNBEKANNT}`;
      else if (f.wert === '') soll = `warn ${AUDIO_TEXTE.keinGeraet}`;
      else if (f.liste === 'mit' && EIN.some((d) => d.deviceId === f.wert)) soll = `ok ${EIN.find((d) => d.deviceId === f.wert)?.label}`;
      else soll = `error ${AUDIO_TEXTE.nichtGefunden}`;
      return vergleiche(zeile(i), soll) ?? (i.settingsSection === ABSCHNITT.geraete ? null : 'settingsSection');
    },
  );
}

// ── IN Statusleiste ausgabe ──
pruefeFaelle(
  'IN Statusleiste ausgabe: Liste, Einstellung und gestartetes Gerät',
  kreuz({ liste: listeNamen, wert: ['', 'k', 'x'], lauf: ['gestoppt', 'laeuft-k', 'laeuft-leer', 'laeuft-ohne-id', 'ohne-motor'] as const }),
  (f) => {
    const motorStand = f.lauf === 'ohne-motor' ? undefined : f.lauf === 'gestoppt' ? motor() : motor({ running: true, startedOutputId: f.lauf === 'laeuft-k' ? 'k' : f.lauf === 'laeuft-leer' ? '' : null });
    const s = stand({ geraete: LISTEN[f.liste], einstellungen: einst({ outputId: f.wert }), engine: motorStand });
    const i = eintrag(s, 'ausgabe');
    const gestartet = motorStand?.running === true && motorStand.startedOutputId !== null ? motorStand.startedOutputId : undefined;
    const wirksam = gestartet ?? f.wert;
    let soll: string;
    if (!gemessen(f.liste)) soll = `off ${UNBEKANNT}`;
    else if (wirksam === '') soll = f.liste === 'leer' ? `off ${AUDIO_TEXTE.keinGeraet}` : `ok ${INTERPRETER_TEXTE.geraete.standard}`;
    else if (f.liste === 'mit' && AUS.some((d) => d.deviceId === wirksam)) soll = `ok ${AUS.find((d) => d.deviceId === wirksam)?.label}`;
    else soll = `error ${AUDIO_TEXTE.nichtGefunden}`;
    if (gestartet !== undefined && gestartet !== f.wert && soll.startsWith('ok ')) soll = `warn ${soll.slice(3)} · ${INTERPRETER_TEXTE.wechselWirktNachNeustart}`;
    return vergleiche(zeile(i), soll);
  },
);

// ── IN Statusleiste floor, dolmetscher im Lauf (Fix-Runde 1): das gestartete Gerät, Abweichung der Einstellung warnt ──
// Die Engine liest die Eingänge nur in start() (engine.ts:156-157). Im Lauf zeigt der Eintrag das Gerät, mit dem die View
// engine.start gerufen hat (stand.gestartet), wie ausgabe das gestartete Ausgabegerät; weicht die Einstellung ab, wird ein ok zu
// warn mit „· Wirkt erst nach Stopp und erneutem Start.“. Ohne Lauf wie bisher die Einstellung.
for (const [id, feld] of [['floor', 'floorId'], ['dolmetscher', 'interpreterId']] as const) {
  pruefeFaelle(
    `IN Statusleiste ${id} im Lauf: gestartetes Gerät, Abweichung warnt, ohne Lauf die Einstellung`,
    kreuz({ liste: listeNamen, wert: ['', 'a', 'b', 'x'], start: ['a', 'b', 'x', 'kein'] as const, lauf: ['gestoppt', 'laeuft', 'ohne-motor'] as const, einst: [true, false] }),
    (f) => {
      const gestartet = f.start === 'kein' ? null : { floorId: 'b', interpreterId: 'a', [feld]: f.start };
      const motorStand = f.lauf === 'ohne-motor' ? undefined : motor({ running: f.lauf === 'laeuft' });
      const s = stand({ geraete: LISTEN[f.liste], einstellungen: f.einst ? einst({ [feld]: f.wert }) : undefined, engine: motorStand, gestartet });
      const i = eintrag(s, id);
      const laeuft = f.lauf === 'laeuft';
      // Wirksam: im Lauf das gestartete Gerät (ohne Aufzeichnung unbekannt), sonst die Einstellung.
      const wirksam = laeuft ? (f.start === 'kein' ? undefined : f.start) : f.einst ? f.wert : undefined;
      let soll: string;
      if (!f.einst || !gemessen(f.liste) || wirksam === undefined) soll = `off ${UNBEKANNT}`;
      else if (wirksam === '') soll = `warn ${AUDIO_TEXTE.keinGeraet}`;
      else if (f.liste === 'mit' && EIN.some((d) => d.deviceId === wirksam)) soll = `ok ${EIN.find((d) => d.deviceId === wirksam)?.label}`;
      else soll = `error ${AUDIO_TEXTE.nichtGefunden}`;
      if (laeuft && wirksam !== undefined && wirksam !== f.wert && soll.startsWith('ok ')) soll = `warn ${soll.slice(3)} · ${INTERPRETER_TEXTE.wechselWirktNachNeustart}`;
      return vergleiche(zeile(i), soll) ?? (i.settingsSection === ABSCHNITT.geraete ? null : 'settingsSection');
    },
  );
}
{
  // Das Szenario der Prüfung: Mix läuft mit Floor a, der Operator stellt Floor im Panel auf b.
  const s = stand({ engine: motor({ running: true, floorDb: -20, interpreterDb: -30 }), einstellungen: einst({ floorId: 'b', interpreterId: 'b' }), gestartet: { floorId: 'a', interpreterId: 'b' } });
  gleich(
    [zeile(eintrag(s, 'floor')), zeile(eintrag(s, 'dolmetscher'))],
    [`warn Mikro A · ${INTERPRETER_TEXTE.wechselWirktNachNeustart}`, 'ok Mikro B'],
    'IN Statusleiste floor im Lauf: Floor im Lauf auf b gestellt → warn „Mikro A · Wirkt erst nach Stopp und erneutem Start.“ (das Gerät, das der Mix nimmt), Dolmetscher unverändert ok',
  );
  const d = stand({ engine: motor({ running: true }), einstellungen: einst({ floorId: 'a', interpreterId: 'a' }), gestartet: { floorId: 'a', interpreterId: 'b' } });
  gleich(
    [zeile(eintrag(d, 'floor')), zeile(eintrag(d, 'dolmetscher'))],
    ['ok Mikro A', `warn Mikro B · ${INTERPRETER_TEXTE.wechselWirktNachNeustart}`],
    'IN Statusleiste dolmetscher im Lauf: Dolmetscher im Lauf auf a gestellt → warn mit dem gestarteten Gerät „Mikro B“, Floor unverändert ok',
  );
  const aus = zeile(eintrag(stand({ engine: motor({ running: true, startedOutputId: 'k' }), einstellungen: einst({ outputId: 'l' }) }), 'ausgabe'));
  ok(zeile(eintrag(s, 'floor')).endsWith(` · ${INTERPRETER_TEXTE.wechselWirktNachNeustart}`) && aus.endsWith(` · ${INTERPRETER_TEXTE.wechselWirktNachNeustart}`), 'IN Statusleiste floor im Lauf: derselbe Hinweis wie ausgabe (INTERPRETER_TEXTE.wechselWirktNachNeustart, nicht nachgebaut)');
  gleich([zeile(eintrag(stand({ einstellungen: einst({ floorId: 'b' }), gestartet: { floorId: 'a', interpreterId: 'b' } }), 'floor'))], ['ok Mikro B'], 'IN Statusleiste floor im Lauf: ohne Lauf zählt die Einstellung, eine alte Aufzeichnung wirkt nicht');
}

// ── IN Pegel im Panel (Fix-Runde 1): nur unter der Wahl, deren Wert das gestartete Gerät ist ──
pruefeFaelle(
  'IN Pegel im Panel: Pegel nur im Lauf und nur unter der Wahl mit dem gestarteten Gerät (nie der Pegel eines anderen Geräts unter dem neuen Namen)',
  kreuz({ laeuft: [true, false], floor: ['a', 'b'], dolm: ['a', 'b'], startFloor: ['a', 'b', 'kein'] as const, startDolm: ['a', 'b'] as const }),
  (f) => {
    const gestartet = f.startFloor === 'kein' ? null : { floorId: f.startFloor, interpreterId: f.startDolm };
    const s = stand({ engine: motor({ running: f.laeuft, floorDb: -20, interpreterDb: -30 }), einstellungen: einst({ floorId: f.floor, interpreterId: f.dolm }), gestartet });
    const w = audioDeviceView(geraeteAbschnitt(s)).wahlen;
    const soll = [
      f.laeuft && gestartet !== null && gestartet.floorId === f.floor ? AUDIO_TEXTE.pegelWert(-20) : undefined,
      f.laeuft && gestartet !== null && gestartet.interpreterId === f.dolm ? AUDIO_TEXTE.pegelWert(-30) : undefined,
      undefined,
    ];
    return vergleiche(JSON.stringify(w.map((x) => x.pegel?.text)), JSON.stringify(soll));
  },
);
gleich(
  audioDeviceView(geraeteAbschnitt(stand({ engine: motor({ running: true, floorDb: -20 }), einstellungen: einst({ floorId: 'b' }), gestartet: { floorId: 'a', interpreterId: 'b' } }))).wahlen.map((w) => [w.key, w.status.text, w.pegel?.text]),
  [['floor', 'Mikro B', undefined], ['dolmetscher', 'Mikro B', AUDIO_TEXTE.keinSignal], ['ausgabe', INTERPRETER_TEXTE.geraete.standard, undefined]],
  'IN Pegel im Panel: das Panel zeigt die Einstellung (neues Gerät) ohne den Pegel des alten Geräts; der Dolmetscher läuft unverändert mit Pegel',
);

// ── IN Statusleiste ducking ──
// Gesamtprüfung M6: im Stillstand (Motor läuft nicht) ist der Eintrag grau (off), der Text bleibt; mit Überbrücken weiter
// „überbrückt“ (warn), auch im Stillstand.
pruefeFaelle(
  'IN Statusleiste ducking: abgesenkt, offen, überbrückt; im Stillstand off mit demselben Text',
  kreuz({ motor: ['ohne', 'mit'] as const, einst: [true, false], ducking: [true, false], bypass: [true, false], laeuft: [true, false] }),
  (f) => {
    const s = stand({ engine: f.motor === 'ohne' ? undefined : motor({ running: f.laeuft, ducking: f.ducking }), einstellungen: f.einst ? einst({ bypass: f.bypass }) : undefined });
    const i = eintrag(s, 'ducking');
    let soll: string;
    if (f.motor === 'ohne' || !f.einst) soll = `off ${UNBEKANNT}`;
    else if (f.bypass) soll = `warn ${INTERPRETER_TEXTE.ducking.ueberbrueckt}`;
    else soll = `${f.laeuft ? 'ok' : 'off'} ${f.ducking ? INTERPRETER_TEXTE.ducking.abgesenkt : INTERPRETER_TEXTE.ducking.offen}`;
    return vergleiche(zeile(i), soll) ?? (i.settingsSection === ABSCHNITT.ducking ? null : 'settingsSection');
  },
);

// ── IN Statusleiste fehler ──
pruefeFaelle(
  'IN Statusleiste fehler: nichts, Text, ohne Antwort',
  kreuz({ motor: ['ohne', 'ok', 'fehler'] as const }),
  (f) => {
    const s = stand({ engine: f.motor === 'ohne' ? undefined : motor({ error: f.motor === 'fehler' ? 'setSinkId rejected' : null }) });
    const soll = f.motor === 'ohne' ? `off ${UNBEKANNT}` : f.motor === 'ok' ? `ok ${INTERPRETER_TEXTE.fehler.keiner}` : 'error setSinkId rejected';
    return vergleiche(zeile(eintrag(s, 'fehler')), soll);
  },
);

// ── IN Statusleiste master-link ──
gleich(zeile(eintrag(stand({ masterLink: { art: 'aus' } }), 'master-link')), `off ${MASTER_LINK_TEXTE.aus}`, 'IN Statusleiste master-link: Meldung aus der Brücke');
gleich(zeile(eintrag(stand({ masterLink: null }), 'master-link')), `off ${UNBEKANNT}`, 'IN Statusleiste master-link: keine Brücke ist unbekannt');

// ── IN Statusleiste vor erster Antwort ──
{
  const items = statusLeiste(leer);
  gleich(ordneStatus(items).map((i) => i.id).sort(), ['ausgabe', 'dolmetscher', 'ducking', 'fehler', 'floor', 'master-link'], 'IN Statusleiste vor erster Antwort: alle sechs Einträge sind da');
  ok(items.every((i) => i.state === 'off' && i.detail === UNBEKANNT), 'IN Statusleiste vor erster Antwort: jeder Eintrag ist aus und unbekannt, nie ok');
  // Nur die Geräteliste fehlt: Motor und Einstellung antworten, die Geräte-Einträge bleiben unbekannt.
  const ohneListe = statusLeiste(stand({ geraete: undefined }));
  ok(['floor', 'dolmetscher', 'ausgabe'].every((id) => zeile(ohneListe.find((i) => i.id === id) as StatusItem) === `off ${UNBEKANNT}`), 'IN Statusleiste vor erster Antwort: ohne gemessene Liste sind die Geräte unbekannt (der Anfangswert [] ist keine Messung)');
}

// ── IN Wechselhinweis je Wahl ──
{
  const p = geraeteAbschnitt(stand());
  gleich(p.choices.map((c) => c.key), ['floor', 'dolmetscher', 'ausgabe'], 'IN Wechselhinweis je Wahl: drei Wahlen');
  ok(p.choices.every((c) => c.changeWarning === INTERPRETER_TEXTE.wechselWirktNachNeustart), 'IN Wechselhinweis je Wahl: alle drei tragen wechselWirktNachNeustart');
  gleich(INTERPRETER_TEXTE.wechselWirktNachNeustart, 'Wirkt erst nach Stopp und erneutem Start.', 'IN Wechselhinweis je Wahl: Wortlaut W2-V3');
  ok(audioDeviceView(p).wahlen.every((w) => (w.hinweis ?? '').includes(INTERPRETER_TEXTE.wechselWirktNachNeustart)), 'IN Wechselhinweis je Wahl: der Hinweis erscheint in jeder Wahl der Sicht');
  ok(p.choices.every((c) => c.lockedReason === undefined) && p.capabilities.level === true && p.capabilities.refresh !== true, 'IN Wechselhinweis je Wahl: kein lockedReason, Pegel ja, Aktualisieren nein');
  gleich(p.choices.map((c) => c.direction), ['input', 'input', 'output'], 'IN Wechselhinweis je Wahl: Richtungen');
  ok(p.choices[0].required === true && p.choices[1].required === true && p.choices[2].required !== true, 'IN Wechselhinweis je Wahl: Eingänge Pflicht, Ausgabe nicht');
  gleich(p.choices[2].defaultLabel, INTERPRETER_TEXTE.geraete.standard, 'IN Wechselhinweis je Wahl: Standardoption der Ausgabe');
  // Wächter: der Satz des gemeinsamen Abschnitts (Wechsel stoppt) kommt in der App nicht vor, weder als Text noch über die Konstante.
  const quellen = (readdirSync('src/renderer/src', { recursive: true }) as string[]).filter((n) => /\.tsx?$/.test(n)).map((n) => ohneKommentare(readFileSync(`src/renderer/src/${n}`, 'utf8')));
  ok(quellen.length >= 5 && quellen.every((q) => !q.includes(AUDIO_TEXTE.wechselStoppt) && !q.includes('wechselStoppt')), 'IN Wechselhinweis je Wahl: AUDIO_TEXTE.wechselStoppt kommt in der App nicht vor');
  // Pegel nur bei laufendem Motor und nur aus der Messung.
  const pegel = audioDeviceView(geraeteAbschnitt(stand({ engine: motor({ running: true, floorDb: -20, interpreterDb: -Infinity }), gestartet: { floorId: 'a', interpreterId: 'b' } }))).wahlen;
  gleich(pegel.map((w) => w.pegel?.text), [AUDIO_TEXTE.pegelWert(-20), AUDIO_TEXTE.keinSignal, undefined], 'IN Wechselhinweis je Wahl: Pegel nur gemessen, Ausgabe ohne Pegel');
  ok(audioDeviceView(geraeteAbschnitt(stand())).wahlen.every((w) => w.pegel === undefined), 'IN Wechselhinweis je Wahl: ohne laufenden Motor kein Pegel');
}

// ── IN Ducking-Anzeige ──
pruefeFaelle(
  'IN Ducking-Anzeige: bei bypass überbrückt, nie offen',
  kreuz({ ducking: [true, false], laeuft: [true, false] }),
  (f) => {
    const i = eintrag(stand({ engine: motor({ running: f.laeuft, ducking: f.ducking }), einstellungen: einst({ bypass: true }) }), 'ducking');
    const offen: string = INTERPRETER_TEXTE.ducking.offen;
    return i.detail === INTERPRETER_TEXTE.ducking.ueberbrueckt && i.detail !== offen && i.state === 'warn' ? null : `${zeile(i)}`;
  },
);
gleich([INTERPRETER_TEXTE.ducking.abgesenkt, INTERPRETER_TEXTE.ducking.offen, INTERPRETER_TEXTE.ducking.ueberbrueckt], ['abgesenkt', 'offen', 'überbrückt'], 'IN Ducking-Anzeige: Wortlaut');

// ── IN Haupttaste ──
const GRUND = 'Erst beide Eingänge wählen';
pruefeFaelle(
  'IN Haupttaste: gesperrt genau wie bisher (disabled = !floorId || !interpreterId), auch während des Laufs',
  kreuz({ motor: ['ohne', 'aus', 'laeuft'] as const, floor: ['', 'a'], dolm: ['', 'b'], einst: [true, false] }),
  (f) => {
    const s = stand({ engine: f.motor === 'ohne' ? undefined : motor({ running: f.motor === 'laeuft' }), einstellungen: f.einst ? einst({ floorId: f.floor, interpreterId: f.dolm }) : undefined });
    const t = hauptTaste(s);
    const laeuft = f.motor === 'laeuft';
    const ist = `${t.state} ${t.label} ${t.disabledReason}`;
    if (f.motor === 'ohne' || !f.einst) return vergleiche(ist, `gesperrt Starten ${INTERPRETER_TEXTE.grund.zustandOffen}`);
    if (f.floor === '' || f.dolm === '') return vergleiche(ist, `gesperrt ${laeuft ? 'Stoppen' : 'Starten'} ${GRUND}`);
    return vergleiche(ist, `${laeuft ? 'live Stoppen' : 'bereit Starten'} undefined`);
  },
);
{
  const t = hauptTaste(stand({ engine: motor({ running: true }), einstellungen: einst({ floorId: '' }) }));
  ok(t.state === 'gesperrt' && t.disabledReason === GRUND, 'IN Haupttaste: läuft, Eingang wieder auf „— bitte wählen —“: bleibt gesperrt (Befund 2, wie bisher)');
  ok(hauptTaste(stand({ engine: motor({ error: 'x' }) })).state === 'bereit', 'IN Haupttaste: ein Fehler sperrt nicht');
  ok(hauptTaste(stand({ geraete: undefined })).state === 'bereit', 'IN Haupttaste: die Geräteliste sperrt nicht (wie bisher)');
  gleich(INTERPRETER_TEXTE.grund.eingaengeFehlen, GRUND, 'IN Haupttaste: Grund wörtlich wie App.tsx:96');
}

// ── IN ON AIR ──
pruefeFaelle(
  'IN ON AIR: nur running, Beschriftung MIX AKTIV',
  kreuz({ motor: ['ohne', 'aus', 'laeuft'] as const, ducking: [true, false], fehler: [true, false] }),
  (f) => {
    const a = kopfOnAir(stand({ engine: f.motor === 'ohne' ? undefined : motor({ running: f.motor === 'laeuft', ducking: f.ducking, error: f.fehler ? 'e' : null }) }));
    return a.live === (f.motor === 'laeuft') && a.label === 'MIX AKTIV' ? null : JSON.stringify(a);
  },
);
ok(kopfOnAir(leer).live === false, 'IN ON AIR: vor der ersten Antwort nie live');

// ── IN Vorgabe vs. gemessen ──
pruefeFaelle(
  'IN Vorgabe vs. gemessen: Standard nur bei leerer ID, ok nie ohne Messung, Panel und Leiste gleich',
  kreuz({ liste: listeNamen, wert: ['', 'k', 'x'], floor: ['', 'a', 'x'], einst: [true, false], lauf: [false, true], startFloor: ['a', 'b', 'kein'] as const }),
  (f) => {
    // Fix-Runde 1: im Lauf auch mit gestartetem Floor; die Ausgabe ist im Lauf mit der Einstellung gestartet (kein Wechsel).
    const gestartet = f.startFloor === 'kein' ? null : { floorId: f.startFloor, interpreterId: 'b' };
    const s = stand({ geraete: LISTEN[f.liste], einstellungen: f.einst ? einst({ outputId: f.wert, floorId: f.floor }) : undefined, engine: motor({ running: f.lauf, startedOutputId: f.lauf ? f.wert : null }), gestartet });
    const items = statusLeiste(s);
    const aus = items.find((i) => i.id === 'ausgabe') as StatusItem;
    const floor = items.find((i) => i.id === 'floor') as StatusItem;
    if (f.wert !== '' && aus.detail === INTERPRETER_TEXTE.geraete.standard) return 'unbekannte ID zeigt Standard';
    if ((!gemessen(f.liste) || !f.einst) && [aus, floor].some((i) => i.state === 'ok')) return 'ok ohne Messung';
    if (f.einst && f.liste === 'mit' && f.wert === 'x' && aus.state !== 'error') return 'unbekannte Ausgabe nicht als Fehler';
    // Im Lauf ist ein ok-Floor nur das gestartete Gerät und nur, wenn die Einstellung gleich ist; ohne Aufzeichnung unbekannt.
    if (f.lauf && floor.state === 'ok' && (gestartet === null || gestartet.floorId !== f.floor)) return 'Floor ok im Lauf, obwohl der Mix ein anderes Gerät nimmt';
    if (f.lauf && gestartet === null && floor.detail !== UNBEKANNT) return 'Floor im Lauf ohne gestartetes Gerät nicht unbekannt';
    const gestartetName = gestartet === null ? undefined : EIN.find((d) => d.deviceId === gestartet.floorId)?.label;
    if (f.lauf && f.einst && f.liste === 'mit' && gestartetName !== undefined && !(floor.detail ?? '').startsWith(gestartetName)) return 'Floor zeigt im Lauf nicht das gestartete Gerät';
    // Eine Wahrheit: derselbe Text und Zustand wie die Sicht des Abschnitts, solange Einstellung und wirksames Gerät gleich sind.
    const sicht = audioDeviceView(geraeteAbschnitt(s)).wahlen;
    const w = sicht.find((x) => x.key === 'ausgabe');
    if (!(w !== undefined && w.status.state === aus.state && w.status.text === aus.detail)) return 'Panel und Leiste weichen ab (ausgabe)';
    const wf = sicht.find((x) => x.key === 'floor');
    const gleichesGeraet = !f.lauf || (gestartet !== null && gestartet.floorId === f.floor);
    if (gleichesGeraet && !(wf !== undefined && wf.status.state === floor.state && wf.status.text === floor.detail)) return 'Panel und Leiste weichen ab (floor)';
    return null;
  },
);

// ── IN Texte ohne ASCII-Anführungszeichen ──
{
  const aufruf = (fn: (...a: never[]) => unknown): string[] => {
    try {
      return flach((fn as (...a: unknown[]) => unknown)('x', 2, 3));
    } catch {
      return [];
    }
  };
  const flach = (v: unknown): string[] => (typeof v === 'function' ? aufruf(v as (...a: never[]) => unknown) : typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(flach) : []);
  const texte = flach(INTERPRETER_TEXTE);
  ok(texte.length > 0 && texte.every((t) => !t.includes('"')), 'IN Texte ohne ASCII-Anführungszeichen');
  // R5: Texte aus @jm/settings (*_TEXTE, STATUS_UNBEKANNT), @jm/ui (MASTER_LINK_TEXTE, UI_TEXTE) werden nie nachgebaut. Keine Ausnahmen.
  const fremd = new Set([...Object.entries(settings).filter(([k]) => k.endsWith('_TEXTE')).map(([, v]) => v), MASTER_LINK_TEXTE, UI_TEXTE, settings.STATUS_UNBEKANNT, UNBEKANNT].flatMap(flach));
  // Einzige Ausnahme: ducking.offen ist das vorgegebene Anzeigewort (Aufgabe 30, E10) und gleicht zufällig dem Kapitelzustand „offen“ der
  // Anleitung (ANLEITUNG_TEXTE), ohne ihn nachzubauen: andere Domäne, anderer Sinn.
  const AUSNAHMEN = new Set<string>([INTERPRETER_TEXTE.ducking.offen]);
  const nachgebaut = texte.filter((t) => fremd.has(t) && !AUSNAHMEN.has(t));
  ok(fremd.size > 0 && fremd.has(UI_TEXTE.onAir) && nachgebaut.length === 0, `IN Texte nicht nachgebaut: kein INTERPRETER_TEXTE-Wert gleicht einem Text aus @jm/settings oder @jm/ui (UI_TEXTE eingeschlossen)${nachgebaut.length ? ` (${nachgebaut.join(' | ')})` : ''}`);
  // E10: der alte Satz „Der Mix geht auf den Systemstandard“ steht nicht mehr in den Texten, die Ausgabe-Meldung sagt, was wirklich passiert.
  ok(texte.every((t) => !t.includes('Der Mix geht auf den Systemstandard')) && INTERPRETER_TEXTE.ausgabeNichtVerfuegbar.includes('Start'), 'IN Texte E10: kein Systemstandard-Versprechen bei fehlendem Gerät');
}

// ── IN oberflaeche rein ──
{
  const code = ohneKommentare(leseText('src/renderer/src/lib/oberflaeche.ts'));
  ok(!/(?<![\w-])window\b|\blocalStorage\b|\bipcRenderer\b|\bdocument\b|\bjminterpreter\b|\bglobalThis\b|\bnavigator\b|from ['"]electron['"]|from ['"]@\/store\//.test(code), 'IN oberflaeche rein: lib/oberflaeche.ts ohne window, document, navigator, globalThis, jminterpreter, localStorage, IPC, Electron und Store');
  ok(!/from ['"]@\/core\/engine['"]/.test(code.replace(/import type [^;]*from ['"]@\/core\/engine['"];/g, '')), 'IN oberflaeche rein: aus dem Motor nur Typen');
}

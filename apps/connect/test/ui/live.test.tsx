// UX Welle 2b, Connect d1 und d2 · Live-Bereich (B19, B21, B6, W2-6; Muster d; Regel V): Haupttasten Raum und Talkback alle je
// Zustand (Grund sichtbar), Halte-Knopf je Gast (Loslassen genau einmal, auch beim Aushängen der Gastzeile), „Raum schließen“
// nach einem Raumabbruch neben T144, Reihenfolge der Blöcke und je Gastzeile unverändert; seit Task 24 die Zoom-Spalte
// (Reihenfolge, Slot-Einstellungen je Kachel, Kennzeichen-Platz je Teilnehmerzeile). Render ohne Browser; Klicks und Halten über
// die reinen Verdrahtungen der Bausteine (tallyHandler, halteKnopfProps), wie im Presenter- und Studio-Control-Test.
import { gleich, leseText, ok, render } from '@jm/ui/testhilfe';
import type { RoomState } from '@jm/rtc/protocol';
import { NDI_TEXT } from '@shared/ndi-text';
import type { ZoomAbbild } from '@shared/types';
import { BEDIEN_TEXT, KANDIDAT_KENNZEICHEN, SLOT_FELD } from '@shared/zoom-text';
import { CONNECT_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import { CloudRaum, gastTalkback, haupttasten, type CloudRaumProps } from '@/views/CloudRaum';
import { slotAufrufeAus, ZoomSpalte } from '@/views/ZoomSpalte';
import type { ZoomAufrufe } from '@/zoom/aufrufe';
import { SlotEinstellungen } from '@/zoom/SlotEinstellungen';
import { halteKnopfProps } from '../../../../packages/ui/src/components/HalteKnopf';
import { haltenBeiAbbau, haltenFuerRender, tallyHandler, type TallyButtonProps } from '../../../../packages/ui/src/components/TallyButton';
import { erzeugeHalten, type HaltenSteuerung } from '../../../../packages/ui/src/lib/halten';
import {
  EINLADUNG,
  SHOW,
  aktionenAttrappe,
  ansicht,
  appStatus,
  attr,
  bereich,
  bereiche,
  gast,
  halteKnoepfe,
  knopfTexte,
  ohneKommentare,
  offenerRaum,
  raum,
  slotLage,
  stand,
  tags,
  tallyTasten,
  teilnehmer,
  text,
  zoomAbbild,
  zoomSpeicher,
} from './testzustand';

const T = CONNECT_TEXTE;
const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const klick = (p: TallyButtonProps): void => tallyHandler(p, erzeugeHalten({})).onClick();
const zeiger = { button: 0, pointerId: 1, currentTarget: { setPointerCapture: () => undefined } };

/** Die linke Spalte mit Vorgaben; `teil` überschreibt einzelne Props. */
function spalte(s: OberflaechenStand, teil: Partial<CloudRaumProps> = {}, log: string[] = []): string {
  return render(<CloudRaum stand={s} show={null} error={null} invites={[]} guestName="" aktionen={aktionenAttrappe(log)} {...teil} />);
}
const haupt = (html: string): ReturnType<typeof tallyTasten> => tallyTasten(bereich(html, 'data-connect', 'haupttasten'));

// ── CN Haupttasten: Raum und Talkback alle je Zustand, gesperrt nie ohne Grund, Grund sichtbar (B21, B6) ──
{
  const FAELLE: Array<[string, OberflaechenStand, [string, string, string | undefined], [string, string, string | undefined]]> = [
    ['vor der ersten Antwort', stand(), [T.taste.raumOeffnen, 'gesperrt', T.grund.unbekannt], [T.taste.talkback, 'gesperrt', T.grund.raumNichtVerbunden]],
    ['ohne Cloud-Zugang', stand({ status: appStatus({ configured: false, cloudZugang: { text: 'Kein Launcher gefunden.', ton: 'fehler' } }), room: null }), [T.taste.raumOeffnen, 'gesperrt', 'Kein Launcher gefunden.'], [T.taste.talkback, 'gesperrt', T.grund.raumNichtVerbunden]],
    ['ohne Raum', stand({ status: appStatus(), room: null }), [T.taste.raumOeffnen, 'bereit', undefined], [T.taste.talkback, 'gesperrt', T.grund.raumNichtVerbunden]],
    ['Client ohne Verbindung', stand({ status: appStatus(), room: null, ansicht: ansicht({ client: true }) }), [T.taste.raumSchliessen, 'bereit', undefined], [T.taste.talkback, 'gesperrt', T.grund.raumNichtVerbunden]],
    ['offener Raum', offenerRaum(raum(['approved'])), [T.taste.raumSchliessen, 'bereit', undefined], [T.taste.talkback, 'bereit', undefined]],
    ['Talkback alle gehalten', offenerRaum(raum(['approved'], { mode: 'all', target: null })), [T.taste.raumSchliessen, 'bereit', undefined], [T.taste.talkbackGehalten, 'bereit', undefined]],
    ['nach Raumabbruch', stand({ status: appStatus(), room: raum(['approved']), ansicht: ansicht({ raumabbruch: true, raumBekannt: true }) }), [T.taste.raumOeffnen, 'bereit', undefined], [T.taste.talkback, 'gesperrt', T.grund.raumNichtVerbunden]],
  ];
  for (const [name, s, [rl, rs, rg], [tl, ts, tg]] of FAELLE) {
    const [r, t] = haupttasten(s, null, aktionenAttrappe());
    gleich([r.label, r.state, r.disabledReason, t.label, t.state, t.disabledReason], [rl, rs, rg, tl, ts, tg], `CN Haupttasten: ${name} – Raum „${rl}“ ${rs}, Talkback „${tl}“ ${ts}`);
    const tasten = haupt(spalte(s));
    ok(
      tasten.length === 2 && tasten.every((x, i) => {
        const soll = i === 0 ? [rl, rs, rg] : [tl, ts, tg];
        return x.state === soll[1] && x.text.startsWith(soll[0] ?? '') && (soll[1] === 'gesperrt' ? attr(x.tag, 'aria-disabled') === 'true' && x.text.endsWith(soll[2] ?? '-') && attr(x.tag, 'title') === soll[2] : attr(x.tag, 'aria-disabled') === undefined);
      }),
      `CN Haupttasten: ${name} – gerendert als TallyButton, gesperrt mit aria-disabled und sichtbarem Grund`,
    );
  }
  const [mitShow] = haupttasten(stand({ status: appStatus(), room: null }), SHOW, aktionenAttrappe());
  gleich(mitShow.label, T.taste.raumMitShow(SHOW.room), 'CN Haupttasten: mit Show „Raum „‹Raum›“ öffnen“ (deutsche Anführungszeichen)');
  const log: string[] = [];
  const a = aktionenAttrappe(log);
  klick(haupttasten(stand({ status: appStatus(), room: null }), null, a)[0]);
  klick(haupttasten(offenerRaum(raum()), null, a)[0]);
  klick(haupttasten(stand({ status: appStatus({ configured: false }), room: null }), null, a)[0]);
  gleich(log, ['raumOeffnen', 'raumSchliessen'], 'CN Haupttasten: Raum öffnen ruft openRoom, Raum schließen ruft closeRoom; gesperrt wirkt der Klick nicht');
  const tb = haupttasten(offenerRaum(raum()), null, a)[1];
  const h = erzeugeHalten({ onPress: tb.onPress, onRelease: tb.onRelease });
  log.length = 0;
  tallyHandler(tb, h).onPointerDown(zeiger);
  tallyHandler(tb, h).onPointerUp();
  tallyHandler(tb, h).onKeyDown({ key: ' ', repeat: false, preventDefault: () => undefined });
  tallyHandler(tb, h).onKeyUp({ key: ' ', repeat: false, preventDefault: () => undefined });
  gleich(log, ['talkbackDown:alle', 'talkbackUp', 'talkbackDown:alle', 'talkbackUp'], 'CN Haupttasten: Talkback alle hält per Zeiger und per Leertaste (Drücken spricht alle an, Loslassen schaltet aus, B1)');
  const html = spalte(stand());
  const raster = bereich(html, 'data-connect', 'haupttasten');
  ok(/\bgrid\b/.test(attr(raster.match(/^<div[^>]*>/)?.[0], 'class') ?? '') && /\bgap-3\b/.test(attr(raster.match(/^<div[^>]*>/)?.[0], 'class') ?? '') && haupt(html).length <= 4, 'CN Haupttasten: höchstens vier TallyButtons in grid gap-3 (Muster d)');
}

// ── CN Live ohne Klick: die Haupttasten stehen beim Start sichtbar da, ohne Klick und ohne Raum ──
{
  const start = spalte(stand());
  ok(haupt(start).length === 2 && !/hidden/.test(bereich(start, 'data-connect', 'haupttasten').match(/^<div[^>]*>/)?.[0] ?? ''), 'CN Live ohne Klick: Raum und Talkback alle stehen beim Start (vor der ersten Antwort) im Cloud-Raum');
}

// ── CN Talkback Gast verschwindet: die Gastzeile wird während des Haltens ausgehängt → talkbackUp genau einmal ──
{
  const log: string[] = [];
  const a = aktionenAttrappe(log);
  const s = offenerRaum(raum(['approved']));
  const g = s.room!.guests[0]!;
  const p = gastTalkback(s, g, a);
  const ref: { current: HaltenSteuerung | null } = { current: null };
  const halten = haltenFuerRender(ref, p);
  const knopf = halteKnopfProps(p, halten);
  knopf.onPointerDown(zeiger);
  haltenBeiAbbau(halten);
  knopf.onPointerUp();
  haltenBeiAbbau(halten);
  gleich(log, [`talkbackDown:${g.id}`, 'talkbackUp'], 'CN Talkback Gast verschwindet: Aushängen beim Halten → talkbackUp genau einmal, ein spätes Loslassen sendet nichts mehr');
  const q = QUELLE('views/CloudRaum.tsx');
  ok(/canHearTalkback\(g\) && <HalteKnopf \{\.\.\.gastTalkback\(stand, g, aktionen\)\} \/>/.test(q) && !/PttButton|onPointerDown|setPointerCapture/.test(q), 'CN Talkback Gast verschwindet: je Gast der Halte-Knopf aus @jm/ui in der Gastzeile (kein PttButton, keine eigene Zeiger-Verdrahtung)');
  gleich([p.label, p.title, p.aktiv, p.gesperrt], ['🎙', `Halten: nur ${g.name} hört die Regie`, false, undefined], 'CN Talkback Gast verschwindet: Beschriftung und Hilfetext wie bisher, frei mit Raumverbindung');
  const gehalten = gastTalkback(offenerRaum(raum(['approved'], { mode: 'selected', target: g.id })), g, a);
  const ohne = gastTalkback(stand({ status: appStatus(), room: raum(['approved']), ansicht: ansicht({ client: true, raumBekannt: true }) }), g, a);
  gleich([gehalten.aktiv, ohne.aktiv, ohne.gesperrt], [true, false, T.grund.raumNichtVerbunden], 'CN Talkback Gast verschwindet: aktiv nur für den gehaltenen Gast, ohne Raumverbindung gesperrt mit Grund');
  log.length = 0;
  p.onPress();
  p.onRelease();
  gleich(log, [`talkbackDown:${g.id}`, 'talkbackUp'], 'CN Talkback Gast verschwindet: Drücken spricht nur diesen Gast an, Loslassen schaltet aus');
}

// ── CN Gästeliste: je Zeile Name, Abzeichen, Halte-Knopf, 📊, Phase und Gast-Aktionen in der alten Reihenfolge ──
{
  const r: RoomState = { room: 'raum-1', standbyId: null, talkback: { mode: 'off', target: null }, guests: [
    gast('g1', 'joining'), gast('g2', 'lobby'), gast('g3', 'approved', { hasScreen: true }), gast('g4', 'onair', { canAdvance: true }), gast('g5', 'off'),
    gast('g6', 'disconnected'), gast('g7', 'left'), gast('g8', 'kicked'),
  ] };
  const html = spalte(offenerRaum(r));
  const zeilen = bereiche(html, 'data-connect', 'gast');
  gleich(zeilen.map((z) => text(z.match(/<span[^>]*>([^<]*)<\/span>/)?.[0] ?? '')), ['Gast g1', 'Gast g2', 'Gast g3', 'Gast g4', 'Gast g5', 'Gast g6'], 'CN Gästeliste: alle Gäste außer verlassen und entfernt, in der Reihenfolge des Raums');
  gleich(
    zeilen.map((z) => knopfTexte(z)),
    [[], ['Freigeben', 'Ablehnen'], ['🎙', '📊', 'Auf Sendung', 'Standby', 'Entfernen'], ['🎙', '📊', 'Aus Sendung', 'Entfernen'], ['🎙', '📊', 'Auf Sendung', 'Standby', 'Entfernen'], []],
    'CN Gästeliste: Knöpfe je Phase in der alten Reihenfolge (🎙 und 📊 nur mit Rückkanal, GuestActions unverändert)',
  );
  const z3 = zeilen[2] ?? '';
  const reihe = ['Gast g3', '🖥 Bildschirm', '🎙', '📊', 'freigegeben', 'Auf Sendung'].map((t) => text(z3).indexOf(t));
  ok(reihe.every((i, k) => i >= 0 && (k === 0 || i > reihe[k - 1]!)), 'CN Gästeliste: Name, 🖥 Bildschirm, 🎙, 📊, Phase, Aktionen in dieser Reihenfolge je Zeile');
  ok(halteKnoepfe(html).length === 3 && halteKnoepfe(html).every((k) => k.label === '🎙'), 'CN Gästeliste: je Gast mit Rückkanal ein Halte-Knopf 🎙 (freigegeben, auf Sendung, aus Sendung)');
  const log: string[] = [];
  const zu = spalte(stand({ status: appStatus(), room: r, ansicht: ansicht({ client: true, raumBekannt: true }) }), {}, log);
  const gastKnoepfe = (h: string): string[] => bereiche(h, 'data-connect', 'gast').flatMap((z) => [...z.matchAll(/<button[^>]*>/g)].map((m) => m[0]));
  ok(gastKnoepfe(zu).length === 16 && gastKnoepfe(zu).every((b) => /\sdisabled=""/.test(b) || attr(b, 'aria-disabled') === 'true'), 'CN Gästeliste: ohne Raumverbindung sind alle Gast-Knöpfe gesperrt (Regel V), die Liste bleibt lesbar');
  ok(text(zu).includes(NDI_TEXT.t141) && text(spalte(offenerRaum(raum()))).includes('Noch keine Gäste — Link erzeugen und teilen.'), 'CN Gästeliste: T141 ohne Verbindung, Leerzeile ohne Gäste wie bisher');
  const q = QUELLE('views/CloudRaum.tsx');
  ok(/<GuestActions guest=\{g\} send=\{aktionen\.send\} gesperrt=\{!ansicht\.wsKnoepfeBedienbar\} \/>/.test(q), 'CN Gästeliste: GuestActions bekommt send aus der Wurzel-View und die Sperre aus raumAnsicht');
}

// ── CN Raum schließen nach Raumabbruch: normaler Knopf neben T144, nicht in der Haupttasten-Reihe; die Einladen-Zeile hat keinen ──
{
  const log: string[] = [];
  const abbruch = stand({ status: appStatus(), room: raum(['approved']), ansicht: ansicht({ raumabbruch: true, raumBekannt: true }) });
  const html = spalte(abbruch, {}, log);
  const zeile = bereich(html, 'data-connect', 'raum-schliessen');
  ok(knopfTexte(zeile).join('|') === T.taste.raumSchliessen && tallyTasten(zeile).length === 0, 'CN Raum schließen nach Raumabbruch: ein normaler Knopf „Raum schließen“ (kein TallyButton)');
  ok(html.indexOf('data-connect="t144"') >= 0 && html.indexOf('data-connect="t144"') < html.indexOf('data-connect="raum-schliessen"') && html.indexOf('data-connect="raum-schliessen"') < html.indexOf('data-connect="haupttasten"'), 'CN Raum schließen nach Raumabbruch: direkt unter T144, über den Haupttasten');
  ok(!/\b(?:w-full|flex-1|grow|ml-auto)\b/.test(zeile), 'CN Raum schließen nach Raumabbruch: der Knopf steht links und wird nicht gedehnt (Tastenplatz: links außerhalb der alten Plätze)');
  for (const [name, s] of [
    ['ohne Raum', stand({ status: appStatus(), room: null })],
    ['offener Raum', offenerRaum(raum(['approved']))],
    ['Client ohne Verbindung', stand({ status: appStatus(), room: null, ansicht: ansicht({ client: true }) })],
  ] as const) {
    ok(!spalte(s).includes('data-connect="raum-schliessen"'), `CN Raum schließen nach Raumabbruch: kein zweiter Knopf ${name}`);
  }
  const einladen = bereich(spalte(offenerRaum(raum())), 'data-connect', 'einladen');
  ok(einladen !== '' && !knopfTexte(einladen).includes(T.taste.raumSchliessen) && knopfTexte(einladen).includes('Link erzeugen'), 'CN Raum schließen nach Raumabbruch: die Einladen-Zeile hat kein zweites „Raum schließen“ mehr (B21)');
  const q = QUELLE('views/CloudRaum.tsx');
  ok(q.includes('{!ansicht.gastEinladen && ansicht.raumSchliessen && (') && q.includes('onClick={() => aktionen.raumSchliessen()}'), 'CN Raum schließen nach Raumabbruch: Bedingung wie bisher (raumSchliessen && !gastEinladen), Wirkung closeRoom');
}

// ── CN Cloud-Raum Reihenfolge: Fehler, T141/T144, Show, Haupttasten, Einladen, Einladungen, Kopfzeile, Gästeliste (B19) ──
{
  const sucht = appStatus({ ndiProgramm: { zustand: 'sucht', grund: null, code: null, k: 0, quelle: null, hinweis: 'JM Switcher', bereit: false } });
  const s = stand({ status: sucht, room: raum(['approved']), connected: false, ansicht: ansicht({ client: true, raumBekannt: true }) });
  const html = spalte(s, { error: 'Fehler X', show: SHOW, invites: [EINLADUNG] });
  const BLOECKE = ['fehler', 't141', 'show', 'haupttasten', 'einladen', 'einladungen', 'kopfzeile', 'gaesteliste'];
  const lage = BLOECKE.map((b) => html.indexOf(`data-connect="${b}"`));
  ok(lage.every((i, k) => i >= 0 && (k === 0 || i > lage[k - 1]!)), `CN Cloud-Raum Reihenfolge: ${BLOECKE.join(', ')} (B19)`);
  const ab = spalte(stand({ status: appStatus(), room: raum(['approved']), ansicht: ansicht({ raumabbruch: true, raumBekannt: true }) }), { error: 'Fehler X', show: SHOW });
  const lage2 = ['fehler', 't144', 'raum-schliessen', 'show', 'haupttasten', 'gaesteliste'].map((b) => ab.indexOf(`data-connect="${b}"`));
  ok(lage2.every((i, k) => i >= 0 && (k === 0 || i > lage2[k - 1]!)), 'CN Cloud-Raum Reihenfolge: nach Raumabbruch Fehler, T144, Raum schließen, Show, Haupttasten, Gästeliste');
  ok(text(html).includes('Fehler X') && !text(spalte(stand())).includes('Fehler X'), 'CN Cloud-Raum Reihenfolge: das Fehlerfeld steht nur mit Fehler');
}

// ── CN Kopfzeile: Zählung nur mit Raumverbindung, sonst nur bei Programm-Empfang; Presenter-Abzeichen, Programm, Link T133 ──
{
  const mit = bereich(spalte(offenerRaum(raum(['lobby', 'onair']))), 'data-connect', 'kopfzeile');
  ok(text(mit).includes('2 Gäste · 1 im Warteraum · 1 auf Sendung') && text(mit).includes(NDI_TEXT.t133) && text(mit).includes(NDI_TEXT.t120), 'CN Kopfzeile: mit Raumverbindung Zählung, Programm-Abzeichen und Link T133');
  const ohne = spalte(stand({ status: appStatus(), room: null }));
  ok(!ohne.includes('data-connect="kopfzeile"'), 'CN Kopfzeile: ohne Raumverbindung und mit Programm „aus“ keine Kopfzeile (E53)');
  const sucht = spalte(stand({ status: appStatus({ ndiProgramm: { zustand: 'sucht', grund: null, code: null, k: 0, quelle: null, hinweis: 'JM Switcher', bereit: false }, presenterLinked: true }), room: null }));
  const k = bereich(sucht, 'data-connect', 'kopfzeile');
  ok(text(k).includes(NDI_TEXT.t121) && text(k).includes('📊 Presenter') && !/\d+ Gäste/.test(text(k)), 'CN Kopfzeile: ohne Raumverbindung bei Programm-Empfang ohne Zählung, mit „📊 Presenter“');
}

// ── Zoom-Spalte (Task 24; B19, B20, W2-5, W2-6): Render der rechten Spalte mit einem Abbild aus stand.zoom ──

/** Die Zoom-Spalte mit Abbild (stand.zoom) und einem lebenden ZoomAufrufe. */
function zoomSpalte(a: ZoomAbbild | undefined, z: ZoomAufrufe = zoomSpeicher(), ladeFehler: string | null = null): string {
  return render(<ZoomSpalte stand={stand({ status: appStatus(), room: null, zoom: a })} zoom={z} ladeFehler={ladeFehler} />);
}

// ── CN Slot-Einstellungen je Kachel: jede Kachel hat ihren Knopf „Einstellungen“, die Felder gehören zur Kachel (W2-6) ──
{
  const a = zoomAbbild({ slots: [slotLage(2, {}, { modus: 'sprecher' }), slotLage(1)] });
  const html = zoomSpalte(a);
  const kacheln = bereiche(html, 'data-connect', 'kachel');
  gleich(kacheln.map((k) => text(k).match(/^(\d+) · /)?.[1]), ['1', '2'], 'CN Slot-Einstellungen je Kachel: die Kacheln stehen nach Nummer in der Zoom-Spalte');
  ok(kacheln.every((k) => knopfTexte(k).filter((t) => t === SLOT_FELD.einstellungen).length === 1), 'CN Slot-Einstellungen je Kachel: jede Kachel hat genau einen Knopf „Einstellungen“ (W2-6)');
  const einst = render(<SlotEinstellungen lage={slotLage(1)} teilnehmer={[]} aufrufe={slotAufrufeAus(zoomSpeicher(), null, () => undefined)} />);
  ok(
    [SLOT_FELD.ndiName, SLOT_FELD.modus, SLOT_FELD.person, SLOT_FELD.aufloesung, SLOT_FELD.ton].every((t) => text(einst).includes(t)) && knopfTexte(einst).includes(BEDIEN_TEXT.loeschen),
    'CN Slot-Einstellungen je Kachel: die Felder eines Slots (NDI-Name, Modus, Person, Auflösung, Ton, Löschen) bleiben Slot-Einstellungen',
  );
  const q = QUELLE('zoom/SlotKachel.tsx');
  ok(/\{einstellungenAuf && <SlotEinstellungen lage=\{lage\} teilnehmer=\{a\.teilnehmer\} aufrufe=\{aufrufe\} \/>\}/.test(q) && /const \[einstellungenAuf, setEinstellungenAuf\] = useState\(false\);/.test(q), 'CN Slot-Einstellungen je Kachel: die Kachel klappt ihre eigenen Einstellungen auf (je Kachel, ungemerkt)');
  ok(!kacheln.some((k) => text(k).includes(SLOT_FELD.vorgaben(a.vorgaben.aufloesung, a.vorgaben.tonAn)) || text(k).includes(BEDIEN_TEXT.personImNdiNamen)), 'CN Slot-Einstellungen je Kachel: Zoom-Vorgaben stehen nicht in einer Kachel (Panel, B20)');
}

// ── CN Kennzeichen-Platz: je Teilnehmerzeile ein leerer Platz data-connect="kennzeichen" für #317 Stufe B (B19, W2-6) ──
{
  const a = zoomAbbild({
    kurz: { zustand: 'im_meeting', erlaubnis: 'ja' },
    teilnehmer: [teilnehmer(101, 'Anna Berger', { rolle: 'host' }), teilnehmer(102, 'Ben Kraus', { kamera: 'aus' }), teilnehmer(103, 'Cem Aydin', { imWarteraum: true })],
  });
  const zeilen = bereiche(zoomSpalte(a), 'data-connect', 'teilnehmer');
  ok(
    zeilen.length === 3 && zeilen.every((z) => (z.match(/data-connect="kennzeichen"/g) ?? []).length === 1 && text(bereich(z, 'data-connect', 'kennzeichen')) === ''),
    'CN Kennzeichen-Platz: jede Teilnehmerzeile hat genau einen leeren Platz data-connect="kennzeichen"',
  );
  gleich(zeilen.map((z) => text(z).split(' ')[0]), ['Anna', 'Ben', 'Cem'], 'CN Kennzeichen-Platz: die Teilnehmerzeilen in der Reihenfolge des Kerns (Host zuerst)');
  ok(text(zeilen[0] ?? '').includes(KANDIDAT_KENNZEICHEN.host) && text(zeilen[1] ?? '').includes(KANDIDAT_KENNZEICHEN.kameraAus) && text(zeilen[2] ?? '').includes(KANDIDAT_KENNZEICHEN.imWarteraum), 'CN Kennzeichen-Platz: die Kennzeichen Host, Kamera aus, im Warteraum stehen wie bisher');
}

// ── CN Zoom-Spalte: Reihenfolge nach B19, vor dem ersten Abbild nur „Zoom-Meeting“, Meldungsdetail markierbar ──
{
  const a = zoomAbbild({
    kurz: { zustand: 'im_meeting', erlaubnis: 'ja' },
    meldung: { art: 'warnung', text: 'Ton läuft über.', detail: 'audio overrun 0x8004' },
    slots: [slotLage(1)], teilnehmer: [teilnehmer(101, 'Anna Berger')], hinweise: ['Fernsteuerung: zoom_slot 9 abgelehnt.'],
  });
  const html = zoomSpalte(a);
  const BLOECKE = ['zoom-kopf', 'zoom-meldung', 'zoom-laufend', 'zoom-versatz', 'zoom-slots', 'zoom-teilnehmer', 'zoom-messwerte', 'zoom-hinweise', 'zoom-fuss'];
  const lage = BLOECKE.map((b) => html.indexOf(`data-connect="${b}"`));
  ok(lage.every((i, k) => i >= 0 && (k === 0 || i > lage[k - 1]!)), `CN Zoom-Spalte: ${BLOECKE.join(', ')} in dieser Reihenfolge (B19)`);
  const bereit = zoomSpalte(zoomAbbild());
  ok(bereit.indexOf('data-connect="zoom-beitritt"') > bereit.indexOf('data-connect="zoom-kopf"') && bereit.indexOf('data-connect="zoom-beitritt"') < bereit.indexOf('data-connect="zoom-versatz"'), 'CN Zoom-Spalte: ohne Meeting steht der Beitritt zwischen Kopf und Bild-Versatz');
  const meldung = bereich(html, 'data-connect', 'zoom-meldung');
  ok(tags(meldung, 'p').length >= 2 && tags(meldung, 'p').every((t) => /\bselect-text\b/.test(attr(t, 'class') ?? '')), 'CN Zoom-Spalte: Meldung und ihr Detail sind markierbar (select-text, trotz body user-select none)');
  const vor = zoomSpalte(undefined, zoomSpeicher(), 'zoomGet abgelehnt');
  ok(text(vor).includes('Zoom-Meeting') && text(vor).includes('zoomGet abgelehnt') && knopfTexte(vor).length === 0, 'CN Zoom-Spalte: vor dem ersten Abbild nur „Zoom-Meeting“ und der Ladefehler, kein Knopf (Nr. 52)');
  const q = QUELLE('views/ZoomSpalte.tsx') + QUELLE('zoom/ZoomCard.tsx');
  ok(!/\bmt-6\b/.test(q), 'CN Zoom-Spalte: kein mt-6-Versatz mehr, die Spalte beginnt auf der Höhe des Cloud-Raums');
}

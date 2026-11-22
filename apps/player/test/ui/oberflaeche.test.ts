// UX Welle 2a · Player-Ableitungen (Aufgabe c; W2-1/E4 ON AIR, E3 Ausgabezustand, E7 Pause/Weiter, E14 Vollbild nur
// gemessen, W2-10 Fußleiste, Spec 7.2): ON AIR als Wahrheitstabelle, Statusleiste als Kreuzprodukt je Eintrag, Transport
// und Fußleiste, Panel-Abschnitte, Kürzelschutz, Texte. Ohne window und ohne Electron.
import * as settings from '@jm/settings';
import { SCREEN_TEXTE } from '@jm/settings';
import { MASTER_LINK_TEXTE, ordneStatus, type StatusItem } from '@jm/ui';
import { gleich, leseText, ok } from '@jm/ui/testhilfe';
import type { AusgabeArt, AusgabeZustand } from '@jm/output-window/zustand';
import type { FernsteuerungMeldung } from '@shared/fernsteuerung';
import type { MasterLinkMeldungZeile, ShowCue } from '@shared/types';
import {
  ABSCHNITT,
  ausgabeAbschnitt,
  fernsteuerungAbschnitt,
  fussleistenTasten,
  istEingabeZiel,
  kopfOnAir,
  PLAYER_TEXTE,
  showSpielt,
  standbyText,
  statusLeiste,
  transportTasten,
  type OberflaechenStand,
  type PlayerZustand,
} from '@/lib/oberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { basisMeldung, ohneKommentare, showCue } from './testzustand';

const BELEGT = 'listen EADDRINUSE: address already in use :::8725';
const ARTEN: AusgabeArt[] = ['zu', 'offen', 'bildschirm-fehlt', 'abgestuerzt'];
const FORTSCHRITT = { currentTime: 1, duration: 10 };

// Cue 1 Audio mit Beschriftung, Cue 2 Video ohne Beschriftung (Dateiname), Cue 3 ohne Medium.
const CUES: ShowCue[] = [showCue(1, { label: 'Intro' }), showCue(2, { kind: 'video' }), showCue(3, { ohneMedium: true })];

function spieler(z: Partial<PlayerZustand> = {}): PlayerZustand {
  return {
    activeShowId: 1,
    showCues: CUES,
    standbyIndex: 0,
    playingCueIds: [],
    vorlaufCueIds: [],
    showPaused: false,
    videoCue: null,
    videoProgress: null,
    outputDisplayId: null,
    ...z,
  };
}
function stand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { player: undefined, pads: undefined, ausgabe: undefined, vollbild: undefined, masterLink: undefined, fernsteuerung: undefined, ...teil };
}
const eintrag = (s: OberflaechenStand, id: string): StatusItem => statusLeiste(s).find((i) => i.id === id) as StatusItem;
const sd = (i: StatusItem): string => `${i.state} ${i.detail ?? ''}`;
const art = (a: AusgabeArt | null | undefined, displayId: number | null = 1): AusgabeZustand | null | undefined => (a === undefined || a === null ? a : { art: a, displayId });

// ── PL ON AIR Wahrheitstabelle (W2-1, E4): live = showSpielt oder mindestens ein Pad ──
{
  const video = { id: 2, index: 1, autoContinue: false };
  const tabelle: Array<{ fall: string; p: PlayerZustand; pads: number[]; live: boolean }> = [
    { fall: 'nur Vorlauf', p: spieler({ playingCueIds: [1], vorlaufCueIds: [1] }), pads: [], live: false },
    { fall: 'Audio-Cue spielt', p: spieler({ playingCueIds: [1] }), pads: [], live: true },
    { fall: 'Video vor dem ersten Fortschritt', p: spieler({ playingCueIds: [2], videoCue: video }), pads: [], live: false },
    { fall: 'Video mit Fortschritt', p: spieler({ playingCueIds: [2], videoCue: video, videoProgress: FORTSCHRITT }), pads: [], live: true },
    { fall: 'pausiert mit Audio-Cue', p: spieler({ playingCueIds: [1], showPaused: true }), pads: [], live: false },
    { fall: 'pausiert, ein Pad spielt', p: spieler({ playingCueIds: [1], showPaused: true }), pads: [7], live: true },
    { fall: 'nur ein Pad', p: spieler(), pads: [7], live: true },
    { fall: 'nichts', p: spieler(), pads: [], live: false },
    // Fix vor Prüfung: GO auf Video-Cue 2, während Video-Cue 1 lief; Video 2 endet. Die alte Video-ID bleibt in playingCueIds
    // (Companion wie bisher), videoCue ist null. Hier steht Cue 2 (Video) für die veraltete ID.
    { fall: 'veraltetes Video (Video-ID in playingCueIds, kein videoCue)', p: spieler({ playingCueIds: [2] }), pads: [], live: false },
    { fall: 'Audio-Cue spielt neben veralteter Video-ID', p: spieler({ playingCueIds: [1, 2] }), pads: [], live: true },
  ];
  for (const t of tabelle) {
    const kopf = kopfOnAir(stand({ player: t.p, pads: t.pads }));
    gleich([kopf.live, 'label' in kopf], [t.live, false], `PL ON AIR Wahrheitstabelle: ${t.fall} → live ${t.live}`);
  }
  pruefeFaelle('PL ON AIR Wahrheitstabelle: pads noch undefined wie ohne Pad', tabelle, (t) =>
    vergleiche(String(kopfOnAir(stand({ player: t.p, pads: undefined })).live), String(kopfOnAir(stand({ player: t.p, pads: [] })).live)),
  );
  pruefeFaelle('PL ON AIR Wahrheitstabelle: showSpielt ist live ohne Pads', tabelle, (t) => vergleiche(String(showSpielt({ player: t.p })), String(kopfOnAir(stand({ player: t.p, pads: [] })).live)));
  gleich(
    [kopfOnAir(stand()).live, kopfOnAir(stand({ pads: [] })).live, kopfOnAir(stand({ pads: [7] })).live, showSpielt({ player: undefined })],
    [false, false, true, false],
    'PL ON AIR Wahrheitstabelle: Store noch nicht da → Show nie live, ein gemeldetes Pad schon',
  );
  gleich(
    [
      showSpielt({ player: spieler({ playingCueIds: [2] }) }),
      eintrag(stand({ player: spieler({ playingCueIds: [2] }) }), 'show').detail,
      eintrag(stand({ player: spieler({ playingCueIds: [1, 2] }) }), 'show').detail,
      showSpielt({ player: spieler({ playingCueIds: [99] }) }),
    ],
    [false, 'Standby Cue 1 · Intro', '1 laufend', true],
    'PL ON AIR Wahrheitstabelle: veraltete Video-ID zählt weder für ON AIR noch als laufend; Audio daneben ergibt 1 laufend; ID ohne Listeneintrag zählt (Seite an)',
  );

  // Kreuzprodukt mit eigenem Orakel in Szenen-Sprache: Audio-Cue 1 (keiner, im Vorlauf, spielt), Video-Cue 2 (keiner, im
  // Vorlauf, gestartet ohne Fortschritt, mit Fortschritt, veraltet = noch in playingCueIds ohne videoCue), Pause, Pads.
  const faelle = kreuz({
    audio: ['keiner', 'vorlauf', 'spielt'],
    video: ['keiner', 'vorlauf', 'ohneFortschritt', 'mitFortschritt', 'veraltet'],
    pausiert: [false, true],
    pads: ['undefined', 'leer', 'eins'],
  } as const);
  pruefeFaelle('PL ON AIR Wahrheitstabelle: Kreuzprodukt Audio × Video × Pause × Pads gegen das Szenen-Orakel', faelle, (f) => {
    const playing: number[] = [];
    const vorlauf: number[] = [];
    if (f.audio !== 'keiner') playing.push(1);
    if (f.audio === 'vorlauf') vorlauf.push(1);
    if (f.video !== 'keiner') playing.push(2);
    if (f.video === 'vorlauf') vorlauf.push(2);
    const gestartet = f.video === 'ohneFortschritt' || f.video === 'mitFortschritt';
    const p = spieler({
      playingCueIds: playing,
      vorlaufCueIds: vorlauf,
      showPaused: f.pausiert,
      videoCue: gestartet ? video : null,
      videoProgress: f.video === 'mitFortschritt' ? FORTSCHRITT : null,
    });
    const pads = f.pads === 'undefined' ? undefined : f.pads === 'leer' ? [] : [7];
    const showWirklich = !f.pausiert && (f.audio === 'spielt' || f.video === 'mitFortschritt');
    const soll = showWirklich || f.pads === 'eins';
    return vergleiche(`${showSpielt({ player: p })}/${kopfOnAir(stand({ player: p, pads })).live}`, `${showWirklich}/${soll}`);
  });
}

// ── PL Statusleiste master-link ──
{
  const faelle: Array<{ name: string; m: MasterLinkMeldungZeile | null | undefined; soll: string }> = [
    { name: 'undefined', m: undefined, soll: 'off unbekannt' },
    { name: 'null', m: null, soll: 'off unbekannt' },
    { name: 'aus', m: { art: 'aus' }, soll: 'off aus' },
    { name: 'sucht', m: { art: 'sucht' }, soll: 'warn sucht …' },
    { name: 'verbunden', m: { art: 'verbunden', adresse: '10.0.0.5:8740', seit: 1, masterName: 'Regie-PC', suite: 'JM Production Suite' }, soll: 'ok verbunden mit Regie-PC' },
  ];
  pruefeFaelle('PL Statusleiste master-link: Meldung → Zustand und Detail, Gruppe verbindung, ohne Abschnitt', faelle, (f) => {
    const i = eintrag(stand({ masterLink: f.m }), 'master-link');
    return vergleiche(sd(i), f.soll) ?? (i.group !== 'verbindung' || i.settingsSection !== undefined ? 'Kopf falsch' : null);
  });
}

// ── PL Statusleiste video-ausgabe (E3): Art × Anzeigeliste, vor der ersten Antwort unbekannt ──
{
  const ausgaben: Record<string, AusgabeZustand | null | undefined> = {
    undefined: undefined,
    null: null,
    zu: { art: 'zu', displayId: null },
    offen: { art: 'offen', displayId: 2 },
    fehlt: { art: 'bildschirm-fehlt', displayId: 2 },
    abgestuerzt: { art: 'abgestuerzt', displayId: 2 },
  };
  const SOLL: Record<string, string> = {
    undefined: 'off unbekannt',
    null: 'off unbekannt',
    zu: 'off zu',
    offen: 'ok offen',
    fehlt: `warn ${SCREEN_TEXTE.bildschirmFehlt}`,
    abgestuerzt: 'error abgestürzt',
  };
  const faelle = kreuz({ a: ['undefined', 'null', 'zu', 'offen', 'fehlt', 'abgestuerzt'], liste: ['ohne', 'mit', 'fremd'] } as const);
  pruefeFaelle('PL Statusleiste video-ausgabe: unbekannt, zu, offen (· Bildschirm nur mit Liste), Bildschirm fehlt, abgestürzt', faelle, (f) => {
    const bildschirme = f.liste === 'ohne' ? undefined : f.liste === 'mit' ? [{ id: 2, label: 'Beamer', primary: false }] : [{ id: 7, label: 'Anderer', primary: true }];
    const i = eintrag(stand({ ausgabe: ausgaben[f.a], bildschirme }), 'video-ausgabe');
    const soll = f.a === 'offen' && f.liste === 'mit' ? 'ok offen · Beamer' : SOLL[f.a];
    return vergleiche(sd(i), soll) ?? (i.group !== 'ausgabe' || i.settingsSection !== ABSCHNITT.ausgabe || i.label !== PLAYER_TEXTE.ausgabe.titel ? 'Kopf falsch' : null);
  });
}

// ── PL Statusleiste fernsteuerung: Meldung × Modus (Port 8725) ──
{
  const MELDUNG: Record<string, FernsteuerungMeldung | null | undefined> = {
    undefined: undefined,
    null: null,
    aus: { laeuft: false, port: 8725, clients: 0 },
    belegt: { laeuft: false, port: 8725, clients: 0, fehler: BELEGT },
    fehler: { laeuft: false, port: 8725, clients: 0, fehler: 'listen EACCES: permission denied 0.0.0.0:8725' },
    bereit0: basisMeldung({ clients: 0 }),
    bereit3: basisMeldung({ clients: 3 }),
  };
  const SOLL: Record<string, string> = {
    undefined: 'off unbekannt',
    null: 'off unbekannt',
    aus: 'off aus',
    belegt: 'error Port belegt',
    fehler: 'error Fehler: listen EACCES: permission denied 0.0.0.0:8725',
    bereit0: 'ok bereit · 0 verbunden',
    bereit3: 'ok bereit · 3 verbunden',
  };
  const faelle = kreuz({ meldung: Object.keys(MELDUNG), modus: [undefined, 'open', 'secure'] } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand => {
    const m = MELDUNG[f.meldung];
    return stand({ fernsteuerung: m ? { ...m, modus: f.modus } : m });
  };
  pruefeFaelle('PL Statusleiste fernsteuerung: Meldung × Modus → unbekannt, aus, Port belegt, Fehler, bereit n verbunden', faelle, (f) => {
    const i = eintrag(props(f), 'fernsteuerung');
    return vergleiche(sd(i), SOLL[f.meldung]) ?? (i.group !== 'fernsteuerung' || i.settingsSection !== ABSCHNITT.fernsteuerung ? 'Kopf falsch' : null);
  });
  gleich(
    [
      fernsteuerungAbschnitt(stand({ fernsteuerung: { laeuft: true, port: 9000, clients: 1 } })).port,
      fernsteuerungAbschnitt(stand({ fernsteuerung: { laeuft: false, port: 0, clients: 0 } })).port,
      fernsteuerungAbschnitt(stand()).port,
      fernsteuerungAbschnitt(stand()).companionModule,
    ],
    [9000, 8725, 8725, 'JM Player'],
    'PL Fernsteuerung-Abschnitt: Port aus der Meldung, sonst 8725; Companion-Modul JM Player',
  );
}

// ── PL Statusleiste show: Store → Standby ‹Name› · n laufend · pausiert; vor dem Laden unbekannt ──
{
  const video = { id: 2, index: 1, autoContinue: false };
  const LAUF: Record<string, Partial<PlayerZustand>> = {
    nichts: {},
    vorlauf: { playingCueIds: [1], vorlaufCueIds: [1] },
    videoOhneFortschritt: { playingCueIds: [2], videoCue: video },
    audio: { playingCueIds: [1] },
    zwei: { playingCueIds: [1, 2], videoCue: video, videoProgress: FORTSCHRITT },
    // Fix vor Prüfung: veraltete Video-ID (Video beendet, ID noch in playingCueIds) zählt nicht als laufend.
    veraltetesVideo: { playingCueIds: [2] },
    audioUndVeraltet: { playingCueIds: [1, 2] },
  };
  const ZAHL: Record<string, number> = { nichts: 0, vorlauf: 0, videoOhneFortschritt: 0, audio: 1, zwei: 2, veraltetesVideo: 0, audioUndVeraltet: 1 };
  // Ohne Cue-Liste (ohneShow) ist ID 2 nicht als Video erkennbar und zählt (Irrtum zur Seite „an“, wie das frühe Ende von
  // showAudio.play); ein laufender Cue ohne Listeneintrag kann wirklich klingen (Vorlauf-Zeitgeber eines entfernten Cues).
  const ZAHL_OHNE_LISTE: Record<string, number> = { ...ZAHL, veraltetesVideo: 1, audioUndVeraltet: 2 };
  const STANDBY: Record<number, string> = { 0: 'Cue 1 · Intro', 1: 'Cue 2 · m102.mp4', 2: 'Cue 3 · —', 3: '— Ende —' };
  const faelle = kreuz({ player: ['undefined', 'ohneShow', 'da'], pausiert: [false, true], lauf: Object.keys(LAUF), standby: [0, 1, 2, 3] } as const);
  pruefeFaelle('PL Statusleiste show: unbekannt, pausiert (warn), n laufend (ok, nur wirklich spielende), keine Show gewählt, sonst Standby ‹Name› (off)', faelle, (f) => {
    const p =
      f.player === 'undefined'
        ? undefined
        : spieler({ ...LAUF[f.lauf], showPaused: f.pausiert, standbyIndex: f.standby, ...(f.player === 'ohneShow' ? { activeShowId: null, showCues: [], standbyIndex: 0 } : {}) });
    const i = eintrag(stand({ player: p }), 'show');
    const n = (f.player === 'ohneShow' ? ZAHL_OHNE_LISTE : ZAHL)[f.lauf];
    const soll =
      p === undefined
        ? 'off unbekannt'
        : f.pausiert
          ? 'warn pausiert'
          : n > 0
            ? `ok ${n} laufend`
            : f.player === 'ohneShow'
              ? 'off keine Show gewählt'
              : `off Standby ${STANDBY[f.standby]}`;
    return vergleiche(sd(i), soll) ?? (i.group !== 'tool' || i.settingsSection !== undefined || i.label !== PLAYER_TEXTE.show.titel ? 'Kopf falsch' : null);
  });
  gleich(
    [0, 1, 2, 3, 9].map((standbyIndex) => standbyText(spieler({ standbyIndex }))).concat(standbyText(undefined)),
    ['Cue 1 · Intro', 'Cue 2 · m102.mp4', 'Cue 3 · —', '— Ende —', '— Ende —', '— Ende —'],
    'PL Statusleiste show: Standby-Text wie die Standby-Anzeige (Beschriftung, sonst Dateiname, sonst —; ohne Cue — Ende —)',
  );
}

// ── PL Statusleiste pads: Pad-Meldung der cueEngine → n Pads spielen, sonst off ──
{
  const faelle: Array<{ pads: number[] | undefined; soll: string }> = [
    { pads: undefined, soll: 'off unbekannt' },
    { pads: [], soll: 'off kein Pad spielt' },
    { pads: [5], soll: 'ok 1 Pad spielt' },
    { pads: [5, 6], soll: 'ok 2 Pads spielen' },
    { pads: [5, 6, 9], soll: 'ok 3 Pads spielen' },
  ];
  pruefeFaelle('PL Statusleiste pads: unbekannt, kein Pad spielt (off), n Pads spielen (ok); Gruppe tool, ohne Abschnitt', faelle, (f) => {
    const i = eintrag(stand({ pads: f.pads }), 'pads');
    return vergleiche(sd(i), f.soll) ?? (i.group !== 'tool' || i.settingsSection !== undefined || i.label !== PLAYER_TEXTE.pads.titel ? 'Kopf falsch' : null);
  });
}

// ── PL Statusleiste vor erster Antwort (Spec 7.2): nichts gemessen → jeder Eintrag off unbekannt, nie ok ──
{
  gleich(
    statusLeiste(stand()).map((i) => `${i.id}:${i.state}:${i.detail}`),
    ['master-link:off:unbekannt', 'video-ausgabe:off:unbekannt', 'fernsteuerung:off:unbekannt', 'show:off:unbekannt', 'pads:off:unbekannt'],
    'PL Statusleiste vor erster Antwort: alle fünf Einträge off unbekannt',
  );
  gleich(
    statusLeiste(stand({ masterLink: null, ausgabe: null, fernsteuerung: null, vollbild: null })).map((i) => i.state),
    ['off', 'off', 'off', 'off', 'off'],
    'PL Statusleiste vor erster Antwort: null (keine Brücke) ist ebenfalls unbekannt',
  );
}

// ── PL Statusleiste gesamt ──
{
  const faelle = kreuz({
    master: [undefined, { art: 'sucht' }] as Array<MasterLinkMeldungZeile | undefined>,
    ausgabe: [undefined, null, ...ARTEN] as Array<AusgabeArt | null | undefined>,
    fern: [undefined, basisMeldung({ clients: 2 })],
    player: [undefined, spieler({ playingCueIds: [1] }), spieler({ showPaused: true })],
    pads: [undefined, [], [4]],
  } as const);
  const props = (f: (typeof faelle)[number]): OberflaechenStand =>
    stand({ masterLink: f.master, ausgabe: art(f.ausgabe), fernsteuerung: f.fern, player: f.player, pads: f.pads === undefined ? undefined : [...f.pads] });
  const IDS = ['master-link', 'video-ausgabe', 'fernsteuerung', 'show', 'pads'];
  pruefeFaelle('PL Statusleiste gesamt: Reihenfolge, ids eindeutig, schon nach Gruppen geordnet', faelle, (f) => {
    const leiste = statusLeiste(props(f));
    const ids = leiste.map((i) => i.id).join();
    return vergleiche(ids, IDS.join()) ?? (new Set(leiste.map((i) => i.id)).size !== leiste.length ? 'ids doppelt' : null) ?? vergleiche(ordneStatus(leiste).map((i) => i.id).join(), ids);
  });
  pruefeFaelle('PL Statusleiste gesamt: die Leiste zeigt nie live (ON AIR sitzt im Kopf)', faelle, (f) => (statusLeiste(props(f)).some((i) => i.state === 'live') ? 'live' : null));
  pruefeFaelle('PL Statusleiste gesamt: jede settingsSection ist ein Abschnitt aus ABSCHNITT', faelle, (f) => {
    const falsch = statusLeiste(props(f)).filter((i) => i.settingsSection !== undefined && !(Object.values(ABSCHNITT) as string[]).includes(i.settingsSection));
    return falsch.length === 0 ? null : `falsch: ${falsch.map((i) => i.id).join()}`;
  });
  pruefeFaelle('PL Statusleiste gesamt: ohne Antwort ist kein Eintrag ok (video-ausgabe, show, pads)', faelle, (f) => {
    const s = props(f);
    const falsch: string[] = [];
    if ((f.ausgabe === undefined || f.ausgabe === null) && eintrag(s, 'video-ausgabe').state !== 'off') falsch.push('video-ausgabe');
    if (f.player === undefined && eintrag(s, 'show').state !== 'off') falsch.push('show');
    if (f.pads === undefined && eintrag(s, 'pads').state !== 'off') falsch.push('pads');
    return falsch.length ? falsch.join() : null;
  });
  gleich(Object.values(ABSCHNITT), ['ausgabe', 'fernsteuerung'], 'PL Abschnitts-ids');
}

// ── PL Vollbild nie geraten (E14) und Ausgabe-Abschnitt: Zustand → Props des Panels ──
{
  const faelle = kreuz({
    ausgabe: [undefined, null, ...ARTEN] as Array<AusgabeArt | null | undefined>,
    vollbild: [undefined, null, false, true] as Array<boolean | null | undefined>,
    display: [null, 2],
  } as const);
  pruefeFaelle('PL Vollbild nie geraten: ohne Messwert (vollbild undefined oder null) fehlt fullscreen in den Capabilities und im Wert', faelle, (f) => {
    const p = ausgabeAbschnitt(stand({ player: spieler({ outputDisplayId: f.display }), ausgabe: art(f.ausgabe, 2), vollbild: f.vollbild }));
    if (f.vollbild === undefined || f.vollbild === null) return 'fullscreen' in p.capabilities || 'fullscreen' in p ? 'fullscreen geraten' : null;
    return null;
  });
  pruefeFaelle('PL Vollbild nie geraten: gemessen → fullscreen angeboten mit dem Messwert; ein gemessenes zu widerlegt einen alten Wert', faelle, (f) => {
    const p = ausgabeAbschnitt(stand({ player: spieler({ outputDisplayId: f.display }), ausgabe: art(f.ausgabe, 2), vollbild: f.vollbild }));
    const gemessen = typeof f.vollbild === 'boolean' && f.ausgabe !== 'zu';
    return vergleiche(`${p.capabilities.fullscreen}/${p.fullscreen}`, gemessen ? `true/${f.vollbild}` : 'undefined/undefined');
  });
  pruefeFaelle('PL Ausgabe-Abschnitt: enabled = Fenster soll offen sein, windowOpen gemessen, selectedId aus dem Store, toggle an, kein Hintergrund', faelle, (f) => {
    const a = art(f.ausgabe, 2);
    const p = ausgabeAbschnitt(stand({ player: spieler({ outputDisplayId: f.display }), ausgabe: a, vollbild: f.vollbild }));
    const an = a !== undefined && a !== null && a.art !== 'zu';
    const open = a === undefined || a === null ? undefined : a.art === 'offen' || a.art === 'bildschirm-fehlt';
    return vergleiche(`${p.id}/${p.enabled}/${p.windowOpen}/${p.selectedId}/${p.capabilities.toggle}/${p.capabilities.background}/${p.screens}`, `${ABSCHNITT.ausgabe}/${an}/${open}/${f.display}/true/undefined/undefined`);
  });
  const aufrufe: string[] = [];
  const aktionen = {
    ausgabeUmschalten: (an: boolean) => aufrufe.push(`ausgabe ${an}`),
    bildschirmWaehlen: (id: number | null) => aufrufe.push(`bildschirm ${id}`),
    vollbildUmschalten: (an: boolean) => aufrufe.push(`vollbild ${an}`),
  };
  const mit = ausgabeAbschnitt(stand({ player: spieler(), ausgabe: art('offen'), vollbild: true, bildschirme: [{ id: 1, label: 'Beamer', primary: false }] }), aktionen);
  mit.onToggle?.(false);
  mit.onSelect?.(1);
  mit.onFullscreen?.(false);
  const ohne = ausgabeAbschnitt(stand({ player: spieler(), ausgabe: art('offen'), vollbild: null }), aktionen);
  gleich(
    [aufrufe, ohne.onFullscreen === undefined, typeof ohne.onSelect, mit.screens],
    [['ausgabe false', 'bildschirm 1', 'vollbild false'], true, 'function', [{ id: 1, label: 'Beamer', primary: false }]],
    'PL Ausgabe-Abschnitt: Aktionen gehen an die View; ohne gemessenes Vollbild gibt es keinen Vollbild-Rückruf',
  );
  gleich(ausgabeAbschnitt(stand()).selectedId, null, 'PL Ausgabe-Abschnitt: ohne Store ist die Auswahl automatisch (null)');
}

// ── PL Transport: vier Haupttasten der Cue-Show; GO nie live, Pause/Weiter bereit mit wechselnder Beschriftung (E4, E7) ──
{
  const LAUF: Record<string, Partial<PlayerZustand>> = {
    leer: {},
    vorlauf: { playingCueIds: [1], vorlaufCueIds: [1] },
    spielt: { playingCueIds: [1] },
  };
  const faelle = kreuz({ player: ['da', 'undefined'], standby: [0, 3], lauf: Object.keys(LAUF), pausiert: [false, true] } as const);
  const T = PLAYER_TEXTE;
  pruefeFaelle('PL Transport: Beschriftungen, Kürzel (GO Leertaste, Stop Esc), Tooltip an Panik, Zustände und Gründe wie heute (ShowView.tsx:188-209)', faelle, (f) => {
    const p = f.player === 'undefined' ? undefined : spieler({ ...LAUF[f.lauf], showPaused: f.pausiert, standbyIndex: f.standby });
    const t = transportTasten({ player: p });
    const standby = p !== undefined && f.standby === 0;
    // heute: disabled={playingCueIds.length === 0 && !showPaused}
    const pauseGesperrt = p === undefined || (p.playingCueIds.length === 0 && !p.showPaused);
    const ist = [
      t.go.label, t.go.shortcut, t.go.state, t.go.disabledReason,
      t.pauseWeiter.label, t.pauseWeiter.shortcut, t.pauseWeiter.state, t.pauseWeiter.disabledReason,
      t.stop.label, t.stop.shortcut, t.stop.state, t.stop.disabledReason,
      t.panik.label, t.panik.shortcut, t.panik.state, t.panik.disabledReason, t.panik.tipp,
    ];
    const soll = [
      'GO', 'Leertaste', standby ? 'bereit' : 'gesperrt', standby ? undefined : T.grund.keinStandby,
      p?.showPaused ? '▶ Weiter' : '❚❚ Pause', undefined, pauseGesperrt ? 'gesperrt' : 'bereit', pauseGesperrt ? T.grund.keinCueLaeuft : undefined,
      '■ Stop', 'Esc', 'bereit', undefined,
      '⛔ Panik', undefined, 'bereit', undefined, 'Sofort alles stoppen',
    ];
    return vergleiche(ist.map(String).join('|'), soll.map(String).join('|'));
  });
  pruefeFaelle('PL Transport: nie live (GO nie, Pause/Weiter E7, Stop und Panik), gesperrt nie ohne Grund', faelle, (f) => {
    const p = f.player === 'undefined' ? undefined : spieler({ ...LAUF[f.lauf], showPaused: f.pausiert, standbyIndex: f.standby });
    const alle = Object.values(transportTasten({ player: p }));
    if (alle.some((t) => t.state === 'live')) return 'live';
    return alle.some((t) => t.state === 'gesperrt' && !t.disabledReason?.trim()) ? 'gesperrt ohne Grund' : null;
  });
  pruefeFaelle('PL Transport: Fußleiste = Stop und Panik mit denselben Werten, ohne Kürzel (W2-10)', faelle, (f) => {
    const p = f.player === 'undefined' ? undefined : spieler({ ...LAUF[f.lauf], showPaused: f.pausiert, standbyIndex: f.standby });
    const t = transportTasten({ player: p });
    const fuss = fussleistenTasten({ player: p });
    const { shortcut: _s, ...stopOhne } = t.stop;
    if (Object.keys(fuss).join() !== 'stop,panik') return `Tasten ${Object.keys(fuss).join()}`;
    if ('shortcut' in fuss.stop || 'shortcut' in fuss.panik) return 'Kürzel in der Fußleiste';
    return vergleiche(JSON.stringify([fuss.stop, fuss.panik]), JSON.stringify([stopOhne, t.panik]));
  });
}

// ── PL Kürzel aus Panel-Feld: istEingabeZiel wie Prompter; beide Filter nutzen es, sonst wirken die Tasten wie bisher ──
{
  const ziel = (t: object): EventTarget => t as unknown as EventTarget;
  const faelle: Array<{ name: string; z: EventTarget | null; soll: boolean }> = [
    { name: 'input', z: ziel({ tagName: 'INPUT' }), soll: true },
    { name: 'textarea', z: ziel({ tagName: 'TEXTAREA' }), soll: true },
    { name: 'select', z: ziel({ tagName: 'SELECT' }), soll: true },
    { name: 'Kleinschreibung select', z: ziel({ tagName: 'select' }), soll: true },
    { name: 'contentEditable', z: ziel({ tagName: 'DIV', isContentEditable: true }), soll: true },
    { name: 'div', z: ziel({ tagName: 'DIV', isContentEditable: false }), soll: false },
    { name: 'button', z: ziel({ tagName: 'BUTTON' }), soll: false },
    { name: 'ohne tagName', z: ziel({}), soll: false },
    { name: 'null', z: null, soll: false },
  ];
  pruefeFaelle('PL Kürzel aus Panel-Feld: istEingabeZiel ist true für input, textarea, select und contentEditable, false für button und null', faelle, (f) =>
    vergleiche(String(istEingabeZiel(f.z)), String(f.soll)),
  );
  const importiert = (code: string): boolean => /import \{[^}]*\bistEingabeZiel\b[^}]*\} from '@\/lib\/oberflaeche';/.test(code);
  const show = ohneKommentare(leseText('src/renderer/src/views/ShowView.tsx'));
  ok(
    importiert(show) && (show.match(/if \(istEingabeZiel\(e\.target\)\) return;/g) ?? []).length === 1 && !/tagName\s*===/.test(show),
    'PL Kürzel aus Panel-Feld: ShowView.tsx filtert über istEingabeZiel, ohne eigene tagName-Prüfung',
  );
  ok(
    /if \(addOpen \|\| outputOpen \|\| editCue\) return;/.test(show) &&
      /if \(e\.code === 'Space'\) \{\s*e\.preventDefault\(\);\s*showGo\(\);\s*\} else if \(e\.key === 'Escape'\) \{\s*showStop\(\);\s*\}/.test(show) &&
      /window\.addEventListener\('keydown', onKey\);/.test(show),
    'PL Kürzel: Cue-Show wie bisher (kein offener Dialog, Leertaste = GO mit preventDefault, Escape = Stop, Hörer am window)',
  );
  const sb = ohneKommentare(leseText('src/renderer/src/views/SoundboardView.tsx'));
  ok(
    importiert(sb) && (sb.match(/if \(istEingabeZiel\(e\.target\)\) return;/g) ?? []).length === 1 && !/tagName\s*===/.test(sb),
    'PL Kürzel aus Panel-Feld: SoundboardView.tsx filtert über istEingabeZiel, ohne eigene tagName-Prüfung',
  );
  ok(
    /const key = normalizeKey\(e\);\s*const cue = cues\.find\(\(c\) => c\.hotkey && c\.hotkey\.toUpperCase\(\) === key\.toUpperCase\(\)\);\s*if \(cue\) \{\s*e\.preventDefault\(\);\s*trigger\(cue\);\s*\}/.test(sb) &&
      /window\.addEventListener\('keydown', onKey\);/.test(sb),
    'PL Kürzel: Pad-Tasten wie bisher (erstes Pad mit der Taste, preventDefault nur bei Treffer, Hörer am window)',
  );
}

// ── Texte und Quelltext ──
{
  const aufruf = (fn: (...n: number[]) => unknown): string[] => {
    try {
      return flach(fn(2, 2));
    } catch {
      return [];
    }
  };
  const flach = (v: unknown): string[] => (typeof v === 'function' ? aufruf(v as (...n: number[]) => unknown) : typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(flach) : []);
  const texte = [...flach(PLAYER_TEXTE), PLAYER_TEXTE.pads.spielen(0), PLAYER_TEXTE.pads.spielen(1)];
  ok(texte.length > 0 && texte.every((t) => !t.includes('"')), 'PL Texte ohne ASCII-Anführungszeichen');
  gleich(
    [PLAYER_TEXTE.pads.spielen(0), PLAYER_TEXTE.pads.spielen(1), PLAYER_TEXTE.pads.spielen(2), PLAYER_TEXTE.show.laufend(1), PLAYER_TEXTE.standby.cue(3, 'Intro')],
    ['kein Pad spielt', '1 Pad spielt', '2 Pads spielen', '1 laufend', 'Cue 3 · Intro'],
    'PL Texte: Zahlwörter im Singular und Plural, Cue-Text wie die Standby-Anzeige',
  );
  // R5: Texte aus @jm/settings (*_TEXTE, STATUS_UNBEKANNT) und @jm/ui (MASTER_LINK_TEXTE) werden nie nachgebaut.
  const fremd = new Set([...Object.entries(settings).filter(([k]) => k.endsWith('_TEXTE')).map(([, v]) => v), MASTER_LINK_TEXTE, settings.STATUS_UNBEKANNT].flatMap(flach));
  // Bewusste Ausnahme (R7, wie Prompter): „offen“ = Ausgabefenster offen, nicht der Modus offen der Fernsteuerung.
  const AUSNAHMEN = new Set<string>([PLAYER_TEXTE.ausgabe.offen]);
  const nachgebaut = texte.filter((t) => fremd.has(t) && !AUSNAHMEN.has(t));
  ok(fremd.size > 0 && nachgebaut.length === 0, `PL Texte nicht nachgebaut: kein PLAYER_TEXTE-Wert gleicht einem Text aus @jm/settings oder @jm/ui${nachgebaut.length ? ` (${nachgebaut.join(' | ')})` : ''}`);
  const code = ohneKommentare(leseText('src/renderer/src/lib/oberflaeche.ts'));
  ok(!/(?<![\w-])window\b|\blocalStorage\b|\bipcRenderer\b|\bdocument\b|from ['"]electron['"]|from ['"]@\/store\//.test(code), 'PL oberflaeche rein: lib/oberflaeche.ts ohne window, document, localStorage, IPC, Electron und Store');
}

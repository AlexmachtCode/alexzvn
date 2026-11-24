// UX Welle 2b, Studio-Control d2 · Gerätepanels (B16, B17; Ruling Task 18): Pillen über StatusPill aus @jm/ui mit den
// Ableitungen geraetPille und lichtPille (eine Wahrheit mit der Statusleiste), keine lokale Pille mehr, nur Tokens (außer der
// Programmfläche PgmPreview), Verdrahtung je Gerätetyp über den echten Store und ohne verbundenen Server nichts gemessen.
// Render ohne Browser über die Wurzel-View.
import { existsSync } from 'node:fs';
import { ABSCHNITT_TEXTE } from '@jm/settings';
import { UNBEKANNT } from '@jm/ui';
import { gleich, leseText, ok, render } from '@jm/ui/testhilfe';
import { STUDIO_TEXTE, geraetPille } from '@/lib/oberflaeche';
import { DiscoverPanel } from '@/components/setup/DiscoverPanel';
import * as oberflaeche from '@/views/StudioOberflaeche';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import {
  alleVideo,
  attr,
  bereich,
  geraetImStore,
  halteKnoepfe,
  KONFIG,
  mitStore,
  STORE_SCHLUESSEL,
  ohneKommentare,
  oberflaecheHtml,
  pillen,
  rendererDateien,
  statusEintraege,
  tags,
  tallyTasten,
  text,
  type Typ,
} from './testzustand';

const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const panel = (h: string, p: string): string => bereich(h, 'data-panel', p);
const reihe = (h: string, p: string): string => bereich(h, 'data-studio', `hauptreihe-${p}`);
const ABSCHNITT_JE_TYP: Record<Typ, 'video' | 'audio'> = { tricaster: 'video', atem: 'video', obs: 'video', ptz: 'video', audio: 'audio' };
const NAME: Record<Typ, string> = { tricaster: 'TriCaster', atem: 'ATEM', obs: 'OBS', ptz: 'PTZ', audio: 'Audio' };
const VERBINDEND: Record<Typ, string> = { tricaster: 'polling', atem: 'connecting', obs: 'connecting', ptz: 'polling', audio: 'connecting' };
const LICHT = (node: boolean, blackout = false): Record<string, unknown> => ({ lighting: { node: node ? { host: '192.0.2.40', fps: 40 } : null, fixtures: [] }, blackout });

function html(o: Parameters<typeof oberflaecheHtml>[1], name: string): string {
  try {
    const W = oberflaeche.StudioOberflaeche;
    if (typeof W !== 'function') throw new Error('StudioOberflaeche fehlt');
    return oberflaecheHtml(W, o, render);
  } catch (e) {
    ok(false, `${name}: Render ohne Wurf (${String(e).split(String.fromCharCode(10))[0]})`);
    return '';
  }
}

// ── SC Pillen: alle Geräte-Pillen über geraetPille (StatusPill aus @jm/ui); Licht „an (ohne Rückmeldung)“ ──
{
  const TYPEN: Typ[] = ['tricaster', 'atem', 'obs', 'ptz', 'audio'];
  const meldungen = (typ: Typ): Array<Record<string, unknown> | undefined> => [
    undefined,
    { state: 'connected' },
    { state: VERBINDEND[typ] },
    { state: 'down', lastError: 'Zeitüberschreitung (keine Antwort)' },
    { state: 'down' },
  ];
  pruefeFaelle(
    'SC Pillen: die Pille jedes Gerätepanels ist geraetPille der Meldung (unbekannt · verbunden · verbindet … · lastError · getrennt)',
    TYPEN.flatMap((typ) => meldungen(typ).map((m, n) => ({ typ, n }))),
    (f) => {
      const m = meldungen(f.typ)[f.n];
      const p = pillen(panel(html({ abschnitt: ABSCHNITT_JE_TYP[f.typ], store: geraetImStore(f.typ, m) }, 'SC Pillen'), f.typ))[0];
      const soll = geraetPille(m as { state: string; lastError?: string } | undefined);
      return vergleiche(JSON.stringify(p), JSON.stringify([soll.state, soll.text]));
    },
  );
  const lichtPille = (store: Record<string, unknown>): [string | undefined, string] | undefined => pillen(panel(html({ abschnitt: 'licht', store }, 'SC Pillen'), 'licht'))[0];
  gleich(
    [lichtPille(LICHT(true)), lichtPille(LICHT(true, true)), lichtPille(LICHT(false))],
    [['ok', ABSCHNITT_TEXTE.anOhneRueckmeldung], ['warn', STUDIO_TEXTE.licht.blackout], ['off', ABSCHNITT_TEXTE.aus]],
    'SC Pillen: Licht „an (ohne Rückmeldung)“ statt „Output → Host“, Blackout „Blackout (ohne Rückmeldung)“, ohne Node „aus“ (wie der Statuseintrag)',
  );
  gleich(lichtPille({}), ['off', UNBEKANNT], 'SC Pillen: Licht vor der ersten Antwort unbekannt');
  const alt = ['Idle', 'Connected', 'Polling', 'Offline', 'Verbinde', 'Output →', 'Kein Node', 'Suche …', 'Bereit'];
  const allesHtml = [
    html({ store: alleVideo() }, 'SC Pillen'),
    html({ store: alleVideo({ tricaster: { state: 'down' }, atem: { state: 'connecting' }, obs: { state: 'down' }, ptz: { state: 'polling' } }) }, 'SC Pillen'),
    html({ abschnitt: 'licht', store: LICHT(true) }, 'SC Pillen'),
    html({ abschnitt: 'licht', store: LICHT(false) }, 'SC Pillen'),
    html({ abschnitt: 'audio', store: geraetImStore('audio') }, 'SC Pillen'),
  ];
  // Im ganzen Inhalt gesucht (die alte Pille war ein span ohne data-state und fiele bei pillen() durch).
  const panelText = (h: string): string => text(bereich(h, 'data-bereich', 'inhalt'));
  ok(allesHtml.every((h) => panelText(h).trim().length > 0), 'SC Pillen: die Panels für die Textprobe sind gerendert');
  gleich(alt.filter((a) => allesHtml.some((h) => panelText(h).includes(a))), [], 'SC Pillen: keine alten Pillentexte mehr (Idle, Connected · v…, Polling …, Offline, Verbinde …, Output →, Kein Node, Suche …, Bereit)');
  const scan = mitStore({ discovery: { running: true, results: [] } } as never, () => render(<DiscoverPanel />));
  gleich(pillen(scan), [['warn', 'Scanning']], 'SC Pillen: Discovery „Scanning“ als StatusPill aus @jm/ui (warn)');
  // Wächter: keine Datei importiert die lokale Pille; sie ist gelöscht; kein Nachbau.
  gleich(rendererDateien().filter((d) => /from\s+['"]@\/components\/ui\/StatusPill['"]/.test(leseText(`src/renderer/src/${d}`))), [], 'SC Pillen: keine Datei importiert @/components/ui/StatusPill mehr');
  ok(!existsSync('src/renderer/src/components/ui/StatusPill.tsx'), 'SC Pillen: components/ui/StatusPill.tsx ist gelöscht');
  gleich(rendererDateien().filter((d) => /\bfunction\s+(?:StatusPill|StatusBadge|Badge)\b/.test(QUELLE(d))), [], 'SC Pillen: kein eigener Pillen-Baustein (StatusPill, StatusBadge, Badge)');
  const geraete = ['video/TricasterPanel.tsx', 'video/AtemPanel.tsx', 'video/ObsPanel.tsx', 'video/PtzPanel.tsx', 'audio/AudioPanel.tsx'];
  gleich(
    geraete.filter((d) => !/import \{[^}]*\bStatusPill\b[^}]*\} from '@jm\/ui'/.test(QUELLE(`components/${d}`)) || !/<StatusPill \{\.\.\.geraetPille\(/.test(QUELLE(`components/${d}`))),
    [],
    'SC Pillen: jedes Gerätepanel zeigt seine Pille als StatusPill aus @jm/ui mit geraetPille',
  );
  ok(/<StatusPill \{\.\.\.lichtPille\(/.test(QUELLE('components/lighting/LichtPanel.tsx')), 'SC Pillen: das Licht-Panel zeigt lichtPille (dieselbe Ableitung wie der Statuseintrag)');
}

// ── SC keine rohen Farben (außer PgmPreview, der Programmfläche) ──
{
  const ROH_FARBE = /\b(?:text|bg|border|from|via|to|accent)-(?:white|black|red|green|blue|yellow|gray|zinc|neutral|slate|amber|emerald|rose|teal)(?:-\d+)?\b|#[0-9a-fA-F]{3,8}\b|rgba?\(/;
  const dateien = rendererDateien().filter((d) => (d.startsWith('components/') || ['views/Video.tsx', 'views/Audio.tsx', 'views/Licht.tsx'].includes(d)) && d !== 'components/video/PgmPreview.tsx');
  ok(dateien.length >= 15, `SC keine rohen Farben: geprüft werden die Panels und ihre Ansichten (${dateien.length} Dateien)`);
  gleich(dateien.filter((d) => ROH_FARBE.test(QUELLE(d))), [], 'SC keine rohen Farben: nur Tokens in Panels und Ansichten (außer PgmPreview)');
  ok(ROH_FARBE.test(QUELLE('components/video/PgmPreview.tsx')), 'SC keine rohen Farben: die Probe erkennt rohe Farben (PgmPreview behält sie als Programmfläche, B5)');
}

// ── SC Verdrahtung je Gerätetyp (Controller-Ruling): ids und Status-Tabelle jedes Typs erreichen Statusleiste und Panel ──
{
  const TYPEN: Typ[] = ['atem', 'obs', 'tricaster', 'ptz', 'audio'];
  for (const typ of TYPEN) {
    const h = html({ abschnitt: ABSCHNITT_JE_TYP[typ], store: geraetImStore(typ, { state: 'connected' }) }, `SC Verdrahtung ${typ}`);
    const eintraege = statusEintraege(h);
    const geraeteIds = eintraege.map(([id]) => id).filter((id) => TYPEN.includes(id as Typ));
    gleich(geraeteIds, [typ], `SC Verdrahtung je Gerätetyp: ${typ} – nur der eigene Eintrag in der Statusleiste (ids aus der eigenen Konfiguration)`);
    gleich(eintraege.find(([id]) => id === typ)?.slice(1), ['ok', `${NAME[typ]}: verbunden`], `SC Verdrahtung je Gerätetyp: ${typ} – Eintrag ok „verbunden“ (Status aus der eigenen Tabelle)`);
    const p = panel(h, typ);
    gleich(pillen(p)[0], ['ok', 'verbunden'], `SC Verdrahtung je Gerätetyp: ${typ} – Pille im Panel „verbunden“`);
    let bedienbar: boolean;
    if (typ === 'ptz') bedienbar = halteKnoepfe(p).length === 12 && halteKnoepfe(p).every((k) => attr(k.tag, 'aria-disabled') === undefined);
    else if (typ === 'audio') bedienbar = tags(p, 'input').filter((t) => attr(t, 'type') === 'range').length === 4 && tags(p, 'input').every((t) => !/\sdisabled=""/.test(t));
    else bedienbar = tallyTasten(reihe(p, typ)).length > 0 && tallyTasten(reihe(p, typ)).every((t) => t.state === 'bereit');
    ok(bedienbar, `SC Verdrahtung je Gerätetyp: ${typ} – die Bedienung des Panels ist frei (Haupttasten bereit bzw. Halte-Knöpfe und Fader frei)`);
    // Eine Meldung mit derselben id in der Status-Tabelle eines anderen Typs zählt nicht: der Typ bleibt unbekannt.
    const fremd: Typ = typ === 'atem' ? 'obs' : 'atem';
    const id = KONFIG[typ].id as string;
    const quer = html({ abschnitt: ABSCHNITT_JE_TYP[typ], store: { ...geraetImStore(typ), [STORE_SCHLUESSEL[fremd][1]]: { [id]: { id, state: 'connected', lastChecked: 1 } } } }, `SC Verdrahtung ${typ}`);
    gleich(statusEintraege(quer).find(([x]) => x === typ)?.slice(1), ['off', `${NAME[typ]}: ${UNBEKANNT}`], `SC Verdrahtung je Gerätetyp: ${typ} – eine Meldung in der Status-Tabelle von ${fremd} zählt nicht`);
    gleich(pillen(panel(quer, typ))[0], ['off', UNBEKANNT], `SC Verdrahtung je Gerätetyp: ${typ} – auch die Pille bleibt unbekannt`);
  }
  const l = html({ abschnitt: 'licht', store: LICHT(true) }, 'SC Verdrahtung licht');
  gleich(statusEintraege(l).find(([id]) => id === 'licht')?.slice(1), ['ok', `Licht: ${ABSCHNITT_TEXTE.anOhneRueckmeldung}`], 'SC Verdrahtung je Gerätetyp: licht – Licht-Zustand aus dem Store erreicht die Statusleiste');
  gleich([pillen(panel(l, 'licht'))[0], tallyTasten(reihe(l, 'licht')).map((t) => t.state)], [['ok', ABSCHNITT_TEXTE.anOhneRueckmeldung], ['bereit']], 'SC Verdrahtung je Gerätetyp: licht – Pille und Blackout im Panel aus demselben Stand');
  const lb = html({ abschnitt: 'licht', store: LICHT(true, true) }, 'SC Verdrahtung licht');
  gleich(
    [statusEintraege(lb).find(([id]) => id === 'licht')?.[1], tallyTasten(reihe(lb, 'licht')).map((t) => t.label)],
    ['warn', [STUDIO_TEXTE.taste.blackoutAus]],
    'SC Verdrahtung je Gerätetyp: licht – Blackout aus dem Store erreicht Statusleiste und Taste („Blackout aus“)',
  );
}

// ── SC Server getrennt (Ruling Task 18) im Fenster: ohne verbundenen Server kein ON AIR, Pillen unbekannt, alles gesperrt ──
{
  const sendung = alleVideo({ atem: { streaming: true, recording: true }, obs: { recording: true } });
  pruefeFaelle('SC Server getrennt: Panels ohne verbundenen Server (getrennt, noch keine Meldung)', kreuz({ server: [false, undefined] as const }), (f) => {
    const h = html({ server: f.server, store: sendung }, 'SC Server getrennt');
    const fehler: string[] = [];
    if (h.includes('data-onair')) fehler.push('ON AIR');
    for (const typ of ['tricaster', 'atem', 'obs', 'ptz'] as const) {
      const p = panel(h, typ);
      if (JSON.stringify(pillen(p)[0]) !== JSON.stringify(['off', UNBEKANNT])) fehler.push(`${typ} Pille ${JSON.stringify(pillen(p)[0])}`);
      if (statusEintraege(h).find(([id]) => id === typ)?.[1] !== 'off') fehler.push(`${typ} Eintrag`);
    }
    for (const typ of ['tricaster', 'atem', 'obs'] as const) {
      const r = tallyTasten(reihe(h, typ));
      if (r.length === 0 || !r.every((t) => t.state === 'gesperrt' && t.grund === STUDIO_TEXTE.grund.geraetUnbekannt(NAME[typ]))) fehler.push(`${typ} Tasten ${JSON.stringify(r.map((t) => [t.state, t.grund]))}`);
    }
    const ptzKnoepfe = halteKnoepfe(panel(h, 'ptz'));
    if (!ptzKnoepfe.every((k) => attr(k.tag, 'title') === `Gesperrt: ${STUDIO_TEXTE.grund.geraetUnbekannt('PTZ')}`)) fehler.push('ptz Halte-Knöpfe');
    const busse = tags(panel(h, 'atem'), 'button').filter((t) => /\bw-12\b/.test(attr(t, 'class') ?? ''));
    if (busse.length !== 16 || !busse.every((t) => /\sdisabled=""/.test(t)) || busse.some((t) => /style="/.test(t))) fehler.push('ATEM-Busse frei oder mit gemeldeter Auswahl');
    if (text(panel(h, 'obs')).includes('Kamera 2')) fehler.push('OBS-Szenen trotz getrenntem Server');
    return fehler.length ? fehler.join('; ') : null;
  });
  const mit = html({ server: true, store: sendung }, 'SC Server getrennt');
  ok(mit.includes('data-onair="live"') && tallyTasten(reihe(mit, 'atem'))[4]?.state === 'live', 'SC Server getrennt: mit verbundenem Server zählen dieselben Meldungen (ON AIR LIVE, STREAM live)');
  const lichtOhne = html({ server: false, abschnitt: 'licht', store: LICHT(false) }, 'SC Server getrennt');
  gleich(
    [pillen(panel(lichtOhne, 'licht'))[0], tallyTasten(reihe(lichtOhne, 'licht')).map((t) => [t.label, t.state, t.grund])],
    [['off', UNBEKANNT], [[STUDIO_TEXTE.taste.blackout, 'gesperrt', STUDIO_TEXTE.grund.unbekannt]]],
    'SC Server getrennt: Licht ohne Server unbekannt, Blackout gesperrt mit „Zustand unbekannt“ (wie vor der ersten Antwort)',
  );
}

// UX Welle 1, Battle d · Live-Bereich (Spec 3.4, 5.1, Anhang A „Battle“; E8, E16, R10, R16): die Ecken A/B immer sichtbar, darunter vier
// Haupttasten als TallyButtons (VS, Voting, Nächste Runde, Replay) im Containerraster, darunter Scoreboard, Ergebnis und die Karten
// Publikums-Voting (QR) und Instant-Replay. Render ohne Browser und ohne window.
import { Button } from '@jm/ui';
import { gleich, leseText, ok, render } from '@jm/ui/testhilfe';
import { Competitors } from '@/components/Competitors';
import { ClipPanel } from '@/components/ClipPanel';
import { Scoreboard } from '@/components/Scoreboard';
import {
  BATTLE_TEXTE,
  FENSTER_LAYOUT,
  LIVE_LAYOUT,
  LIVE_ZWEI_SPALTEN_BREITE,
  liveSpalten,
  TASTEN_MIN_BREITE,
  TASTEN_VIER_BREITE,
  tastenSpalten,
  type OberflaechenStand,
} from '@/lib/oberflaeche';
import { HauptTasten, LiveBereich, liveTasten, tastenSchluessel, type LiveAktionen, type TastenAktionen } from '@/views/LiveBereich';
import { attr, battleState, bereich, clipJob, elemente, mitConfig, ohneKommentare, tags, text, toolLink } from './testzustand';

const T = BATTLE_TEXTE;
const stand = (state = battleState()): Pick<OberflaechenStand, 'state'> => ({ state });
const MIT_SERVER = { running: true, urls: ['http://10.0.0.5:7790'] };
function tastenAktionen(log: string[] = []): TastenAktionen {
  return {
    setLive: (an) => void log.push(`setLive(${an})`),
    setVotingOpen: (offen) => void log.push(`setVotingOpen(${offen})`),
    nextRound: () => void log.push('nextRound'),
    clip: () => void log.push('clip'),
  };
}
function aktionen(log: string[] = []): LiveAktionen {
  return {
    ...tastenAktionen(log),
    setCompetitor: (side, patch) => void log.push(`setCompetitor(${side},${JSON.stringify(patch)})`),
    swapCompetitors: () => void log.push('swap'),
    prevRound: () => void log.push('prevRound'),
    gotoRound: (n) => void log.push(`gotoRound(${n})`),
    setJuryWinner: (n, w) => void log.push(`setJuryWinner(${n},${w})`),
    clearVotes: (n) => void log.push(`clearVotes(${n})`),
    setRemote: (an) => void log.push(`setRemote(${an})`),
    pickRecording: () => void log.push('pickRecording'),
    setConfig: (p) => void log.push(`setConfig(${JSON.stringify(p)})`),
  };
}
const zeile = (s: Pick<OberflaechenStand, 'state'>): string[] =>
  liveTasten(s, tastenAktionen()).map((t) => `${t.label}:${t.state}${t.disabledReason ? `(${t.disabledReason})` : ''}`);

// ── BA Live Tasten: vier, Reihenfolge VS, Voting, Nächste Runde, Replay; je Zustand ──
{
  gleich(
    zeile(stand()),
    ['○ VS einblenden:bereit', `Voting öffnen (Runde 2):gesperrt(${T.voting.serverAus})`, 'Nächste Runde ▶:bereit', `⧉ Clip (letzte 20s):gesperrt(${T.replay.keineQuelle})`],
    'BA Live Tasten: vier Tasten in der Reihenfolge VS, Voting, Nächste Runde, Replay; im Grundzustand sind Voting (Server aus) und Replay (keine Quelle) mit Grund gesperrt',
  );
  const voll = battleState({ live: true, remote: MIT_SERVER, votingOpen: true, config: { ...battleState().config, recordingPath: 'C:\\Aufnahmen\\show.mkv' } });
  gleich(
    zeile(stand(voll)),
    ['● VS on air:live', 'Voting offen (Runde 2) — schließen:bereit', 'Nächste Runde ▶:bereit', '⧉ Clip (letzte 20s):bereit'],
    'BA Live Tasten: VS on air ist live, das Voting wechselt seine Beschriftung, Replay ist mit Quelle bereit',
  );
  gleich(
    zeile(stand(mitConfig({ votingEnabled: false, recordingPath: 'C:\\Aufnahmen\\show.mkv' }, { remote: MIT_SERVER }))).slice(1, 2),
    [`Voting öffnen (Runde 2):gesperrt(${T.voting.abgeschaltet})`],
    'BA Live Tasten: bei laufendem Server, aber abgeschaltetem Publikums-Voting ist die Voting-Taste mit diesem Grund gesperrt',
  );
  // Der Wechsel „Clip läuft“: die Beschriftung von heute („schneidet …“, ClipPanel.tsx:56) UND der Grund „Clip läuft“.
  const schneidet = mitConfig({ recordingPath: 'C:\\Aufnahmen\\show.mkv' }, { clips: [clipJob('done'), clipJob('running')] });
  gleich(zeile(stand(schneidet))[3], `${T.replay.schneidet}:gesperrt(${T.replay.laeuft})`, 'BA Live Tasten: während ein Clip läuft zeigt die Replay-Taste „schneidet …“ und den Grund „Clip läuft“');
  gleich([T.replay.schneidet, T.replay.laeuft], ['schneidet …', 'Clip läuft'], 'BA Live Tasten: die Wörter von heute (ClipPanel.tsx) stehen wörtlich in BATTLE_TEXTE');
  ok(
    [stand(), stand(voll)].every((s) => liveTasten(s, tastenAktionen()).every((t) => t.onPress === undefined && t.onRelease === undefined && t.shortcut === undefined)),
    'BA Live Tasten: kein Halten und keine Kürzel (UO5: es gibt keine neuen Kürzel)',
  );
  const log: string[] = [];
  liveTasten(stand(), tastenAktionen(log)).forEach((t) => t.onClick?.());
  liveTasten(stand(voll), tastenAktionen(log)).forEach((t) => t.onClick?.());
  gleich(
    log,
    ['setLive(true)', 'setVotingOpen(true)', 'nextRound', 'clip', 'setLive(false)', 'setVotingOpen(false)', 'nextRound', 'clip'],
    'BA Live Tasten: Klick ruft setLive(!live), setVotingOpen(!votingOpen), nextRound() und clip() (Handler wie heute)',
  );
  gleich(tastenSchluessel(stand()), ['vs', 'voting', 'naechste', 'replay'], 'BA Live Tasten: die Rollen der vier Tasten in Anzeigereihenfolge');
  const q = ohneKommentare(leseText('src/renderer/src/views/LiveBereich.tsx'));
  ok(
    q.includes('key={rolle}') && q.includes('export function tastenSchluessel(') && q.includes('rollenTasten(s, KEINE)') && q.includes('rollenTasten(stand, aktionen).map') && !/key=\{[^}]*label[^}]*\}/.test(q) && !/key="(vs|voting|naechste|replay)"/.test(q),
    'BA Live Tasten: HauptTasten rendert aus rollenTasten und vergibt key={rolle}; tastenSchluessel() kommt aus derselben Quelle, nie die Beschriftung (R10)',
  );
  // Der Wechsel der Beschriftung ändert die Rolle nicht: dieselben Schlüssel in jedem Zustand (der Test pinnt, was gerendert wird).
  const volle = battleState({ live: true, remote: MIT_SERVER, votingOpen: true, clips: [clipJob('running')] });
  gleich([tastenSchluessel(stand()), tastenSchluessel(stand(volle))], [['vs', 'voting', 'naechste', 'replay'], ['vs', 'voting', 'naechste', 'replay']], 'BA Live Tasten: die Rollen bleiben in jedem Zustand gleich, auch wenn sich Beschriftungen ändern');
}

// ── BA Live Tasten gerendert: aria-disabled, Grund sichtbar, höchstens vier ──
{
  const grund = render(<HauptTasten stand={stand()} aktionen={tastenAktionen()} />);
  const frei = render(<HauptTasten stand={stand(mitConfig({ recordingPath: 'C:\\x.mkv' }, { remote: MIT_SERVER }))} aktionen={tastenAktionen()} />);
  const sperre = (html: string): Array<string | undefined> => tags(html, 'button').map((t) => attr(t, 'aria-disabled'));
  gleich([tags(grund, 'button').length, tags(frei, 'button').length], [4, 4], 'BA Live Tasten: gerendert genau vier TallyButtons (höchstens vier)');
  gleich([sperre(grund), sperre(frei)], [[undefined, 'true', undefined, 'true'], [undefined, undefined, undefined, undefined]], 'BA Live Tasten: VS und Nächste Runde sind nie gesperrt; Voting und Replay tragen aria-disabled nur mit ihrem Grund');
  ok(text(grund).includes(T.voting.serverAus) && text(grund).includes(T.replay.keineQuelle) && !text(frei).includes(T.voting.serverAus) && !text(frei).includes(T.replay.keineQuelle), 'BA Live Tasten: die Sperrgründe stehen sichtbar neben den Tasten und verschwinden mit der Sperre');
  const laeuft = render(<HauptTasten stand={stand(mitConfig({ recordingPath: 'C:\\x.mkv' }, { clips: [clipJob('running')] }))} aktionen={tastenAktionen()} />);
  ok(text(laeuft).includes('schneidet …') && text(laeuft).includes('Clip läuft'), 'BA Live Tasten: bei laufendem Clip stehen „schneidet …“ und „Clip läuft“ beide sichtbar an der Replay-Taste');
}

// ── BA Hinweis bei getrenntem Titler (E16): der VS-Knopf bleibt, der Hinweis steht darunter ──
{
  const faelle: Array<[string, Parameters<typeof battleState>[0], boolean]> = [
    ['an, kein Titler', {}, true],
    ['an, getrennt', { links: [toolLink({ connected: false })] }, true],
    ['an, verbunden', { links: [toolLink()] }, false],
    ['aus, kein Titler', { config: { ...battleState().config, autoTitler: false } }, false],
  ];
  for (const [name, teil, soll] of faelle) {
    const html = render(<HauptTasten stand={stand(battleState(teil))} aktionen={tastenAktionen()} />);
    const hinweis = bereich(html, 'vs-hinweis');
    const vsKnopf = tags(html, 'button')[0];
    ok(
      (hinweis !== '') === soll && (!soll || text(hinweis).includes(T.vsHinweis)) && attr(vsKnopf, 'aria-disabled') === undefined,
      `BA Hinweis bei getrenntem Titler: ${name}: Hinweis ${soll ? 'steht da' : 'fehlt'}, der VS-Knopf ist nie gesperrt`,
    );
  }
  const html = render(<HauptTasten stand={stand()} aktionen={tastenAktionen()} />);
  ok(html.indexOf('data-ba="vs-hinweis"') > html.indexOf('data-state') && html.indexOf('data-ba="vs-hinweis"') < html.indexOf('Voting öffnen'), 'BA Hinweis bei getrenntem Titler: der Hinweis steht unter dem VS-Knopf, vor der Voting-Taste');
}

// ── BA Scoreboard bleibt: ◀, Rundenknöpfe, Jury A/Unentschieden/B, Stimmen zurücksetzen ohne Rückfrage ──
{
  const log: string[] = [];
  const st = battleState({ rounds: [{ round: 1, juryWinner: 'A', votesA: 3, votesB: 1 }, { round: 2, juryWinner: null, votesA: 0, votesB: 0 }, { round: 3, juryWinner: 'tie', votesA: 0, votesB: 0 }] });
  const baum = Scoreboard({ state: st, aktionen: aktionen(log) });
  const knoepfe = elemente(baum, (e) => e.type === 'button' || e.type === Button);
  const nach = (inhalt: string): { props: Record<string, unknown> } | undefined => knoepfe.find((k) => k.props.children === inhalt);
  (nach('◀')?.props.onClick as () => void)();
  (nach('zurücksetzen')?.props.onClick as () => void)();
  const runden = knoepfe.filter((k) => typeof k.props.title === 'string' && /^Runde \d/.test(k.props.title));
  runden.forEach((k) => (k.props.onClick as () => void)());
  const jury = knoepfe.filter((k) => k.props['aria-pressed'] !== undefined);
  jury.forEach((k) => (k.props.onClick as () => void)());
  gleich(
    log,
    ['prevRound', 'clearVotes(2)', 'gotoRound(1)', 'gotoRound(2)', 'gotoRound(3)', 'setJuryWinner(2,A)', 'setJuryWinner(2,tie)', 'setJuryWinner(2,B)'],
    'BA Scoreboard bleibt: ◀, die drei Rundenknöpfe, Jury A / Unentschieden / B und „zurücksetzen“ der Stimmen rufen die Handler von heute, die Stimmen ohne Rückfrage',
  );
  gleich(jury.map((k) => k.props.children), ['Alpha', 'Unentschieden', 'Bravo'], 'BA Scoreboard bleibt: die Jury-Knöpfe tragen die Namen der Ecken und „Unentschieden“');
  const aktiv = battleState({ rounds: [{ round: 1, juryWinner: null, votesA: 0, votesB: 0 }, { round: 2, juryWinner: 'B', votesA: 0, votesB: 0 }, { round: 3, juryWinner: null, votesA: 0, votesB: 0 }] });
  const log2: string[] = [];
  const aktivBaum = Scoreboard({ state: aktiv, aktionen: aktionen(log2) });
  const knopfB = elemente(aktivBaum, (e) => e.props['aria-pressed'] === true)[0];
  (knopfB.props.onClick as () => void)();
  gleich(log2, ['setJuryWinner(2,null)'], 'BA Scoreboard bleibt: ein zweiter Klick auf die gewählte Jury-Seite nimmt die Wertung zurück (wie bisher)');
  const html = render(<Scoreboard state={st} aktionen={aktionen()} />);
  ok(text(html).includes('Jury — Runde 2') && text(html).includes('Publikum — Runde 2') && !text(html).includes('▶'), 'BA Scoreboard bleibt: Jury- und Publikumsteil stehen, das ▶ ist als Haupttaste „Nächste Runde ▶“ nach oben gezogen');
  const q = ohneKommentare(leseText('src/renderer/src/components/Scoreboard.tsx'));
  ok(!/\bconfirm\b/.test(q) && !q.includes('useBattle') && !q.includes('nextRound'), 'BA Scoreboard bleibt: die Stimmen werden ohne Rückfrage zurückgesetzt; das Scoreboard hat weder confirm noch Store noch nextRound');
}

// ── BA Clip-Quelle am Knopf: Quelle und Länge im Live-Bereich, der Zielordner nicht ──
{
  const log: string[] = [];
  const st = mitConfig({ recordingPath: 'C:\\Aufnahmen\\show.mkv', clipSeconds: 30 }, { clips: [clipJob('done', { id: 'a' }), clipJob('running', { id: 'b' }), clipJob('error', { id: 'c', error: 'kaputt' })] });
  const html = render(<LiveBereich state={st} aktionen={aktionen(log)} />);
  const karte = bereich(html, 'replay');
  const t = text(karte);
  ok(t.includes('Instant-Replay') && t.includes('Aufnahme …') && t.includes('show.mkv') && t.includes('Länge') && t.includes('Sekunden (letzte)'), 'BA Clip-Quelle am Knopf: Quelle (Dateiname) und Länge stehen im Live-Bereich beim Clip');
  ok(!t.includes('Zielordner') && !text(html).includes('Zielordner'), 'BA Clip-Quelle am Knopf: der Zielordner steht nicht mehr im Live-Bereich (Panel-Abschnitt Instant-Replay)');
  ok(t.includes('x.mp4') && t.includes('20s …') && t.includes('kaputt'), 'BA Clip-Quelle am Knopf: die Clip-Liste zeigt fertig (Dateiname), laufend (Sekunden) und Fehler (Text)');
  gleich(tags(karte, 'span').filter((s) => attr(s, 'data-state') !== undefined).map((s) => attr(s, 'data-state')), ['ok', 'warn', 'error'], 'BA Clip-Quelle am Knopf: die Clips tragen Zustand mit Symbol (ok, warn, error), nicht nur Farbe');
  const leer = text(bereich(render(<ClipPanel state={battleState()} aktionen={aktionen()} />), 'replay'));
  ok(leer.includes('keine Quelle gewählt'), 'BA Clip-Quelle am Knopf: ohne Quelle steht „keine Quelle gewählt“ (Text wie bisher)');
  const baum = ClipPanel({ state: st, aktionen: aktionen(log) });
  (elemente(baum, (e) => e.type === Button && e.props.children === 'Aufnahme …')[0].props.onClick as () => void)();
  gleich(log, ['pickRecording'], 'BA Clip-Quelle am Knopf: „Aufnahme …“ ruft pickRecording()');
}

// ── BA Live Raster: Containerbreite, vier Tasten nie 3+1 ──
{
  const q = ohneKommentare(leseText('src/renderer/src/views/LiveBereich.tsx'));
  const arten = new Set(Array.from({ length: 1901 }, (_, i) => tastenSpalten(100 + i)));
  gleich([...arten].sort(), [2, 4], 'BA Live Raster: je Containerbreite 100–2000 px genau 2 oder 4 Spalten, nie 3 (kein 3+1)');
  gleich([tastenSpalten(TASTEN_VIER_BREITE - 1), tastenSpalten(TASTEN_VIER_BREITE)], [2, 4], `BA Live Raster: die Grenze zwischen 2×2 und 1×4 liegt bei ${TASTEN_VIER_BREITE} px`);
  gleich(TASTEN_VIER_BREITE, 4 * TASTEN_MIN_BREITE + 3 * 12, 'BA Live Raster: die Grenzbreite ist aus Mindestbreite und Lücke abgeleitet (4×180 + 3×12)');
  ok(
    q.includes('@container') && q.includes('grid-cols-2') && q.includes('@[756px]:grid-cols-4') && !/grid-cols-3/.test(q) && !/(sm|md|lg|xl):grid-cols/.test(q) && TASTEN_VIER_BREITE === 756,
    'BA Live Raster: Container-Query (@container, grid-cols-2 als Basis, @[756px] vier in einer Reihe), keine Viewport-Breakpoints, nie grid-cols-3; die Klasse steht als Literal im Quelltext (Tailwind-Scan)',
  );
  const html = render(<HauptTasten stand={stand()} aktionen={tastenAktionen()} />);
  ok(html.includes('@container') && html.includes('@[756px]:grid-cols-4'), 'BA Live Raster: gerendert trägt die Hülle @container und das Raster');
  const dom = [...html.matchAll(/<button[^>]*>[\s\S]*?<\/button>/g)].map((m) => text(m[0]).slice(0, 4));
  gleich(dom, ['○ VS', 'Voti', 'Näch', '⧉ Cl'], 'BA Live Raster: die Tab-Reihenfolge im Markup ist VS, Voting, Nächste Runde, Replay');
}

// ── BA Live Breite: bei Mindestfenster 980 × 660 mit Panel (R16) ──
{
  const F = FENSTER_LAYOUT;
  const L = LIVE_LAYOUT;
  const client = F.fensterMin - F.rahmen;
  const mitPanel = client - F.panel - F.trennlinie;
  const inhalt = (b: number): number => b - F.innen;
  gleich([client, mitPanel, inhalt(mitPanel), inhalt(client)], [964, 603, 571, 932], 'BA Live Breite: bei 980 px Fenster (964 px Seite, Windows-Rahmen 16 als Annahme) bleiben dem Inhalt mit Panel 603 px, nach dem Innenabstand 571 px; ohne Panel 932 px');
  gleich([tastenSpalten(inhalt(mitPanel)), tastenSpalten(inhalt(client))], [2, 4], 'BA Live Breite: die vier Haupttasten stehen mit Panel 2×2 (je 279 px), ohne Panel in einer Reihe');
  ok((inhalt(mitPanel) - 12) / 2 >= TASTEN_MIN_BREITE, 'BA Live Breite: jede Taste im 2×2 ist bei Mindestfenster mindestens so breit wie die Mindestbreite');
  gleich(L.linksMin + L.luecke + L.rechts, LIVE_ZWEI_SPALTEN_BREITE, 'BA Live Breite: zwei Spalten brauchen linke Mindestbreite 368 + Lücke 16 + rechte Spalte 256 = 640');
  gleich([liveSpalten(LIVE_ZWEI_SPALTEN_BREITE - 1), liveSpalten(LIVE_ZWEI_SPALTEN_BREITE)], [1, 2], `BA Live Breite: die Grenze zwischen einer und zwei Spalten liegt bei ${LIVE_ZWEI_SPALTEN_BREITE} px`);
  gleich([liveSpalten(inhalt(mitPanel)), liveSpalten(inhalt(client))], [1, 2], 'BA Live Breite: bei 980 px mit Panel stehen Voting und Replay unter dem Scoreboard (eine Spalte), ohne Panel daneben');
  const breit = 1200 - F.rahmen - F.panel - F.trennlinie;
  gleich([tastenSpalten(inhalt(breit)), liveSpalten(inhalt(breit))], [4, 2], 'BA Live Breite: im Standardfenster 1200 px mit Panel stehen vier Tasten in einer Reihe und zwei Spalten darunter');
  const q = ohneKommentare(leseText('src/renderer/src/views/LiveBereich.tsx'));
  ok(q.includes('@[640px]:grid-cols-[minmax(0,1fr)_256px]') && LIVE_ZWEI_SPALTEN_BREITE === 640 && L.rechts === 256, 'BA Live Breite: das Literal @[640px] und die rechte Spalte 256 px gleichen den Konstanten');
  ok(
    q.includes('min-h-0 flex-1 overflow-y-auto') && /data-ba="oben" className="[^"]*shrink-0/.test(q) && q.includes('h-full min-h-0 flex-col'),
    'BA Live Breite: der Bereich unter den Haupttasten scrollt selbst (min-h-0, overflow-y-auto), die Zone mit Ecken und Tasten ist shrink-0: nichts überlappt die Haupttasten (R16)',
  );
  ok(q.includes('min-w-0') && !q.includes('w-80') && !q.includes('w-[320px]'), 'BA Live Breite: die alte feste Spalte w-80 ist weg, die Spalten tragen min-w-0');
  const main = leseText('src/main/index.ts');
  ok(main.includes('minWidth: 980') && main.includes('minHeight: 660'), 'BA Live Breite: die Fenster-Mindestgröße im Main ist 980 × 660 (unverändert)');
  ok(/--panel-w:\s*360px/.test(leseText('../../packages/ui/src/tokens/sizes.css')), 'BA Live Breite: die Panelbreite ist 360 px (unverändert)');
}

// ── BA Live Element: Ecken ohne Klick sichtbar, Ergebnis bei decided ──
{
  const st = battleState({ competitors: { A: { name: 'Alpha', crew: 'Berlin' }, B: { name: 'Bravo', crew: '' } } });
  const html = render(<Competitors state={st} aktionen={aktionen()} />);
  ok(
    html.includes('value="Alpha"') && html.includes('value="Bravo"') && html.includes('value="Berlin"') && text(html).includes('Ecke A') && text(html).includes('Ecke B') && text(html).includes('Rundensiege'),
    'BA Live Element: beide Ecken mit Namen, Crew und Rundensiegen stehen ohne Klick im Live-Element',
  );
  ok(tags(html, 'button').length === 1 && attr(tags(html, 'button')[0], 'aria-label') === 'Ecken tauschen', 'BA Live Element: der Tausch-Knopf „Ecken tauschen“ bleibt zwischen den Ecken');
  const q = ohneKommentare(leseText('src/renderer/src/components/Competitors.tsx'));
  ok(
    q.includes("aktionen.setCompetitor(side, { name: e.target.value })") && q.includes("aktionen.setCompetitor(side, { crew: e.target.value })") && !/debounce|setTimeout|onBlur/.test(q),
    'BA Live Element: die Namensfelder schreiben bei jedem Tastendruck (kein Entprellen, kein Schreiben erst beim Verlassen)',
  );
  ok(!/const Card\s*=/.test(q) && /function Ecke\(/.test(q), 'BA Live Element: die Ecke ist eine Komponente auf Modulebene, nicht in der Komponente (das Feld behält den Fokus beim Tippen)');
  const offen = render(<LiveBereich state={st} aktionen={aktionen()} />);
  ok(!offen.includes('data-ba="ergebnis"'), 'BA Live Element: ohne entschiedene Runden keine Ergebnis-Karte');
  const entschieden = battleState({ rounds: [1, 2, 3].map((round) => ({ round, juryWinner: 'B' as const, votesA: 0, votesB: 0 })) });
  const fertig = render(<LiveBereich state={entschieden} aktionen={aktionen()} />);
  ok(text(bereich(fertig, 'ergebnis')).includes('🏆 Bravo'), 'BA Live Element: bei decided erscheint die Ergebnis-Karte mit dem Sieger');
  const unentschieden = battleState({ rounds: [1, 2].map((round) => ({ round, juryWinner: round === 1 ? ('A' as const) : ('B' as const), votesA: 0, votesB: 0 })), config: { ...battleState().config, rounds: 2 } });
  ok(text(bereich(render(<LiveBereich state={unentschieden} aktionen={aktionen()} />), 'ergebnis')).includes('🤝 Unentschieden'), 'BA Live Element: bei Gleichstand erscheint „🤝 Unentschieden“');
  ok(offen.indexOf('data-ba="ecken"') < offen.indexOf('data-state="bereit"') && bereich(offen, 'oben').includes('data-ba="ecken"') && !bereich(offen, 'unten').includes('data-ba="ecken"'), 'BA Live Element: die Ecken stehen in der festen oberen Zone über den Haupttasten, nicht im scrollenden Bereich');
}

// ── BA Live Bereich: Spalten, QR bleibt schwarz auf weiß ──
{
  const html = render(<LiveBereich state={battleState({ remote: MIT_SERVER })} aktionen={aktionen()} />);
  const links = bereich(html, 'spalte-links');
  const rechts = bereich(html, 'spalte-rechts');
  ok(links.includes('Jury — Runde 2') && !links.includes('Publikums-Voting'), 'BA Live Bereich: links Scoreboard (und Ergebnis)');
  ok(rechts.includes('Publikums-Voting') && rechts.includes('Instant-Replay') && text(rechts).includes('http://10.0.0.5:7790'), 'BA Live Bereich: rechts die Karten Publikums-Voting (mit Adresse) und Instant-Replay');
  ok(html.indexOf('data-ba="spalte-links"') < html.indexOf('data-ba="spalte-rechts"'), 'BA Live Bereich: im Markup folgt die rechte Spalte auf das Scoreboard (darunter bei einer Spalte)');
  const aus = render(<LiveBereich state={battleState()} aktionen={aktionen()} />);
  ok(text(bereich(aus, 'voting')).includes('Aus. Anschalten') && !bereich(aus, 'voting').includes('<img'), 'BA Live Bereich: bei ausgeschaltetem Server steht der Aus-Text (wie bisher), kein QR');
  const remote = ohneKommentare(leseText('src/renderer/src/components/RemotePanel.tsx'));
  ok(remote.includes('bg-white') && (remote.match(/bg-white/g) ?? []).length === 1 && !remote.includes('setVotingOpen'), 'BA Live Bereich: die QR-Kachel ist die einzige weiße Fläche; das Öffnen und Schließen des Votings ist aus der Karte in die Haupttaste gezogen');
  ok(ohneKommentare(leseText('src/renderer/src/lib/qr.ts')).includes("dark: '#000000', light: '#ffffff'"), 'BA Live Bereich: der QR bleibt schwarz auf weiß (lib/qr.ts unverändert)');
}

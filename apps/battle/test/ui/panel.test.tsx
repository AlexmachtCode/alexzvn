// UX Welle 1, Battle d · Einstellungs-Panel und Farben (Spec 3.6, 4, 5.1, 6, Anhang A „Battle“; E16, E17): Fernsteuerung (nur Status) und
// Gegenstellen aus @jm/settings (PeersSection ersetzt das Modal ConnectionsPanel), dahinter die tool-eigenen Abschnitte „Battle“,
// „Instant-Replay“ und „Zurücksetzen“ (mit Rückfrage). Dazu die Wächter der Farben: keine rohen Farbklassen, Ecken-Tokens in Hell und
// Dunkel, color-mix statt Hex-Alpha. Render ohne Browser und ohne window.
import { PEERS_TEXTE, REMOTE_TEXTE } from '@jm/settings';
import { Button, Field, NumberInput, Toggle } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { readdirSync } from 'node:fs';
import { Scoreboard } from '@/components/Scoreboard';
import {
  ABSCHNITT,
  BATTLE_TEXTE,
  clipZielText,
  ECKEN_FARBE,
  farbeMischen,
  gefundeneAdressen,
  statusLeiste,
  UNENTSCHIEDEN_FARBE,
  type OberflaechenStand,
} from '@/lib/oberflaeche';
import { Einstellungen, type EinstellungenAktionen } from '@/views/Einstellungen';
import { abschnitt, battleState, elemente, mitConfig, ohneKommentare, text, toolLink } from './testzustand';

const T = BATTLE_TEXTE;
function stand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { state: battleState(), masterLink: undefined, fernsteuerung: undefined, ...teil };
}
function aktionen(log: string[] = []): EinstellungenAktionen {
  return {
    setEndpoint: (r, h, p) => void log.push(`endpoint(${r}|${h}|${p})`),
    setConfig: (p) => void log.push(`config(${JSON.stringify(p)})`),
    pickClipDir: () => void log.push('pickClipDir'),
    reset: () => void log.push('reset'),
  };
}
const panel = (s: OberflaechenStand, log: string[] = []): string => render(<Einstellungen stand={s} aktionen={aktionen(log)} />);
const titel = (html: string): string[] => [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
/** Das Field mit dieser Beschriftung im unausgewerteten Baum von Einstellungen (die Abschnitte sind Funktionen, keine Komponenten). */
const feld = (s: OberflaechenStand, label: string, log: string[] = []): { props: Record<string, unknown> } =>
  elemente(Einstellungen({ stand: s, aktionen: aktionen(log) }), (e) => e.type === Field && e.props.label === label)[0] ?? { props: {} };
const kind = (f: { props: Record<string, unknown> }, typ: unknown): { props: Record<string, unknown> } => elemente(f, (e) => e.type === typ)[0] ?? { props: {} };

// ── BA Panel Abschnitte: Reihenfolge und Anker ──
{
  const html = panel(stand());
  gleich(Object.values(ABSCHNITT).filter((id) => !html.includes(`id="einstellung-${id}"`)), [], 'BA Panel Abschnitte: Anker für alle ABSCHNITT-Werte (fernsteuerung, gegenstellen, battle, replay, zuruecksetzen)');
  gleich(
    titel(html),
    [REMOTE_TEXTE.titel, PEERS_TEXTE.titel, T.titel.battle, T.titel.replay, T.titel.zuruecksetzen],
    'BA Panel Abschnitte: Fernsteuerung, Gegenstellen, Battle, Instant-Replay, Zurücksetzen in der Reihenfolge von ABSCHNITT (Anhang A, E16)',
  );
  gleich([T.titel.battle, T.titel.replay, T.titel.zuruecksetzen], ['Battle', 'Instant-Replay', 'Zurücksetzen'], 'BA Panel Abschnitte: die Titel der tool-eigenen Abschnitte nach Anhang A');
  const ziele = statusLeiste(stand({ state: battleState({ links: [toolLink()] }) })).map((i) => i.settingsSection).filter((z): z is string => typeof z === 'string');
  gleich(ziele.filter((z) => !html.includes(`id="einstellung-${z}"`)), [], 'BA Panel Abschnitte: jeder Statuseintrag mit Abschnitt findet seinen Anker');
  gleich(ziele, [ABSCHNITT.gegenstellen, ABSCHNITT.fernsteuerung, ABSCHNITT.battle, ABSCHNITT.replay], 'BA Panel Abschnitte: Titler springt in „Gegenstellen“, Fernsteuerung in ihren Abschnitt, Voting in „Battle“, Aufnahme-Quelle in „Instant-Replay“ (Master nicht)');
  pruefeIdVerweise(html, 'BA Panel Abschnitte: id-Verweise gültig');
  ok(!text(html).includes('"'), 'BA Panel Abschnitte: kein ASCII-Anführungszeichen in den Texten des Panels');
}

// ── BA Panel Battle: Felder, Schalter, Klemmwerte ──
{
  const log: string[] = [];
  const s = stand({ state: mitConfig({ rounds: 5, votingEnabled: false, autoTitler: true }) });
  const runden = kind(feld(s, 'Runden', log), NumberInput);
  gleich([runden.props.value, feld(s, 'Runden').props.hint], [5, 'Anzahl der Battle-Runden.'], 'BA Panel Battle: Runden zeigt den Wert der Konfiguration, Hilfetext wörtlich wie bisher');
  const wirkt = (v: number): string => {
    const l: string[] = [];
    (kind(feld(s, 'Runden', l), NumberInput).props.onChange as (n: number) => void)(v);
    return l[0];
  };
  gleich([wirkt(0), wirkt(1), wirkt(7), wirkt(99)], ['config({"rounds":1})', 'config({"rounds":1})', 'config({"rounds":7})', 'config({"rounds":20})'], 'BA Panel Battle: Runden wirken zwischen 1 und 20 geklemmt (0 → 1, 99 → 20), wie das alte Feld');
  gleich(
    [kind(feld(s, 'Publikums-Voting'), Toggle).props.checked, kind(feld(s, 'VS-Bauchbinde automatisch'), Toggle).props.checked],
    [false, true],
    'BA Panel Battle: die Schalter zeigen votingEnabled und autoTitler',
  );
  const l2: string[] = [];
  (kind(feld(s, 'Publikums-Voting', l2), Toggle).props.onChange as (an: boolean) => void)(true);
  (kind(feld(s, 'VS-Bauchbinde automatisch', l2), Toggle).props.onChange as (an: boolean) => void)(false);
  gleich(l2, ['config({"votingEnabled":true})', 'config({"autoTitler":false})'], 'BA Panel Battle: die Schalter schreiben votingEnabled und autoTitler');
  gleich(
    [feld(s, 'Publikums-Voting').props.hint, feld(s, 'VS-Bauchbinde automatisch').props.hint],
    ['Abstimmung per QR/Handy zulassen.', 'JM Titler bei VS-Live mit den Namen ein-/ausblenden (text-Befehl vorwärtskompatibel).'],
    'BA Panel Battle: die Hilfetexte stehen wörtlich wie im alten Modal',
  );
}

// ── BA Panel Instant-Replay: Zielordner, Quelle bleibt am Clip-Knopf ──
{
  const log: string[] = [];
  const baum = Einstellungen({ stand: stand(), aktionen: aktionen(log) });
  const html = panel(stand());
  const replay = abschnitt(html, ABSCHNITT.replay);
  ok(text(replay).includes('Zielordner …') && text(replay).includes(T.replay.zielStandard), 'BA Panel Instant-Replay: Knopf „Zielordner …“ und der Standard-Text (wörtlich wie im alten Kasten)');
  ok(!text(replay).includes('Aufnahme …') && !text(replay).includes('Länge'), 'BA Panel Instant-Replay: Aufnahme-Quelle und Länge bleiben am Clip-Knopf im Live-Bereich');
  const mit = panel(stand({ state: mitConfig({ clipDir: 'D:\\Videos\\Battle Clips' }) }));
  ok(text(abschnitt(mit, ABSCHNITT.replay)).includes('Battle Clips') && abschnitt(mit, ABSCHNITT.replay).includes('title="D:\\Videos\\Battle Clips"'), 'BA Panel Instant-Replay: ein gewählter Ordner steht mit Namen da, der volle Pfad im Tooltip');
  gleich([clipZielText({ clipDir: '' }), clipZielText({ clipDir: 'D:\\a\\b' }), clipZielText({ clipDir: '/x/y/' })], [T.replay.zielStandard, 'b', 'y'], 'BA Panel Instant-Replay: Ordnername ohne Pfad, leer = Standard');
  const knopf = elemente(baum, (e) => e.props.children === 'Zielordner …')[0];
  (knopf.props.onClick as () => void)();
  gleich(log, ['pickClipDir'], 'BA Panel Instant-Replay: „Zielordner …“ ruft pickClipDir()');
}

// ── BA Panel Zurücksetzen: mit Rückfrage, nennt das laufende VS ──
{
  const log: string[] = [];
  const baum = Einstellungen({ stand: stand(), aktionen: aktionen(log) });
  const knopf = elemente(baum, (e) => e.type === Button && e.props.children === T.zuruecksetzen.knopf)[0];
  const alt = (globalThis as { confirm?: unknown }).confirm;
  const fragen: string[] = [];
  try {
    (globalThis as { confirm?: unknown }).confirm = (q: string): boolean => (fragen.push(q), false);
    (knopf.props.onClick as () => void)();
    gleich(log, [], 'BA Panel Zurücksetzen: bei „Abbrechen“ in der Rückfrage geschieht nichts');
    (globalThis as { confirm?: unknown }).confirm = (q: string): boolean => (fragen.push(q), true);
    (knopf.props.onClick as () => void)();
    gleich(log, ['reset'], 'BA Panel Zurücksetzen: nach „OK“ ruft der Knopf reset()');
  } finally {
    (globalThis as { confirm?: unknown }).confirm = alt;
  }
  gleich(fragen, [T.zuruecksetzen.frage, T.zuruecksetzen.frage], 'BA Panel Zurücksetzen: die Rückfrage ist BATTLE_TEXTE.zuruecksetzen.frage');
  ok(
    T.zuruecksetzen.frage.startsWith('Battle zurücksetzen? Runden/Stimmen werden geleert (Namen bleiben).') && T.zuruecksetzen.frage.endsWith('Ein laufendes VS geht aus.') && !T.zuruecksetzen.frage.includes('"'),
    'BA Panel Zurücksetzen: der alte Text steht am Anfang, dazu der Satz „Ein laufendes VS geht aus.“ (E16)',
  );
  ok(text(abschnitt(panel(stand()), ABSCHNITT.zuruecksetzen)).includes('Battle zurücksetzen'), 'BA Panel Zurücksetzen: der Knopf trägt die Beschriftung von bisher');
  const scoreboard = ohneKommentare(leseText('src/renderer/src/components/Scoreboard.tsx'));
  ok(!/\bconfirm\b/.test(scoreboard), 'BA Panel Zurücksetzen: nur dieser Reset fragt zurück; die Stimmen im Scoreboard bleiben ohne Rückfrage (E16)');
}

// ── BA Panel Gegenstellen: Erklärung und gefundene Adresse ──
{
  const html = panel(stand({ state: battleState({ links: [toolLink({ source: 'mdns' })] }) }));
  ok(text(html).includes(T.gegenstellen.erklaerung) && T.gegenstellen.erklaerung === 'Battle blendet die VS-Bauchbinde über den JM Titler ein.', 'BA Panel Gegenstellen: der erste Satz des alten Erklärtexts steht unter der Zeile (Rest: PEERS_TEXTE.erklaerung)');
  ok(text(html).includes('JM Titler · gefunden: 10.0.0.7:8735'), 'BA Panel Gegenstellen: die Adresse eines mDNS-Fundes steht im Panel (das Modal zeigte sie)');
  gleich(
    [gefundeneAdressen(stand({ state: battleState({ links: [toolLink({ source: 'manual' })] }) })).length, gefundeneAdressen(stand({ state: battleState({ links: [toolLink({ host: '' })] }) })).length, gefundeneAdressen(stand()).length],
    [0, 0, 0],
    'BA Panel Gegenstellen: manuelle Funde (stehen schon als Quelle in der Zeile) und Rollen ohne Adresse zeigen keine zweite Zeile',
  );
}

// ── BA Panel Quelltext: keine Effekte, kein window, kein Store ──
{
  const q = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(!q.includes('useEffect') && !/\bwindow\b/.test(q) && !q.includes('useBattle('), 'BA Panel Abschnitte: Einstellungen.tsx ohne window, ohne useEffect und ohne Store (G7, G8)');
  const ober = ohneKommentare(leseText('src/renderer/src/views/BattleOberflaeche.tsx'));
  ok(ober.includes('settings={<Einstellungen'), 'BA Panel Abschnitte: das Panel hängt über settings am AppShell');
}

// ── BA keine rohen Farben: Wächter über den ganzen Renderer ──
{
  const wurzel = 'src/renderer/src';
  const dateien = (ordner: string): string[] =>
    readdirSync(ordner, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dateien(`${ordner}/${e.name}`) : /\.(ts|tsx)$/.test(e.name) ? [`${ordner}/${e.name}`] : []));
  const alle = dateien(wurzel);
  ok(alle.length >= 12, `BA keine rohen Farben: der Wächter liest die Dateien des Renderers (${alle.length})`);
  const roh = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow|decoration|accent|caret|placeholder)-(?:neutral|green|red|yellow|gray|zinc|slate|stone|amber|orange|lime|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d/;
  const treffer: string[] = [];
  for (const d of alle) {
    const q = ohneKommentare(leseText(d));
    if (roh.test(q)) treffer.push(`${d}: ${q.match(roh)?.[0]}`);
    if (/\b(?:neutral|green|red|yellow)-\d{2,3}\b/.test(q)) treffer.push(`${d}: ${q.match(/\b(?:neutral|green|red|yellow)-\d{2,3}\b/)?.[0]}`);
    if (d !== `${wurzel}/lib/qr.ts` && /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-zA-Z-])/.test(q.replace(/'#'|"#"/g, ''))) treffer.push(`${d}: Hex-Farbe`);
    if (d !== `${wurzel}/components/RemotePanel.tsx` && /\b(?:bg|text|border)-(?:white|black)\b/.test(q)) treffer.push(`${d}: white/black`);
  }
  gleich(treffer, [], 'BA keine rohen Farben: 0× neutral-*, green-*, red-*, yellow-* (und andere Palettenfarben) und keine Hex-Farbe im Renderer; erlaubt sind die QR-Hex in lib/qr.ts und bg-white der QR-Kachel');
  ok(/\bbg-white\b/.test(ohneKommentare(leseText(`${wurzel}/components/RemotePanel.tsx`))) && /dark: '#000000', light: '#ffffff'/.test(leseText(`${wurzel}/lib/qr.ts`)), 'BA keine rohen Farben: die QR-Kachel bleibt weiß, der QR schwarz auf weiß');
  const css = leseText(`${wurzel}/globals.css`).replace(/\/\*[\s\S]*?\*\//g, '');
  const hexe = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
  gleich(hexe.sort(), ['#0b66c2', '#3da5ff', '#c62828', '#ff5c5c'], 'BA keine rohen Farben: in globals.css stehen Hex-Farben nur als die vier Ecken-Tokens');
}

// ── BA Ecken-Tokens: hell und dunkel getrennt, color-mix statt Hex-Alpha ──
{
  const css = leseText('src/renderer/src/globals.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const block = (selektor: RegExp): string => css.match(selektor)?.[1] ?? '';
  const dunkel = block(/:root,\s*\.dark\s*\{([^}]*)\}/);
  const hell = block(/\.light\s*\{([^}]*)\}/);
  const wert = (b: string, name: string): string | undefined => b.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))?.[1];
  gleich([wert(dunkel, '--battle-ecke-a'), wert(dunkel, '--battle-ecke-b')], ['#3da5ff', '#ff5c5c'], 'BA Ecken-Tokens: dunkel (:root, .dark) tragen die Farben von bisher');
  const [ha, hb] = [wert(hell, '--battle-ecke-a'), wert(hell, '--battle-ecke-b')];
  ok(ha !== undefined && hb !== undefined && ha !== '#3da5ff' && hb !== '#ff5c5c', 'BA Ecken-Tokens: hell (.light) definiert beide Tokens eigens, nicht als Kopie der dunklen');
  ok(css.indexOf('.light') > css.indexOf(':root,'), 'BA Ecken-Tokens: .light steht nach :root und .dark (gleiche Wertigkeit: die spätere Regel gewinnt)');
  // Kontrast der Schrift in Eckfarbe (Zähler, Jury-Knopf) auf dem Kartengrund: WCAG-Leuchtdichte der sRGB-Farben.
  const lin = (c: number): number => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const leucht = (h: string): number => {
    const n = parseInt(h.slice(1), 16);
    return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  const kontrast = (a: string, b: string): number => (Math.max(leucht(a), leucht(b)) + 0.05) / (Math.min(leucht(a), leucht(b)) + 0.05);
  // Kartengrund aus @jm/ui: hell oklch(0.985 0 0) ≈ #fafafa, dunkel oklch(0.215 0 0) ≈ #191919 (Grauwerte, nachgerechnet).
  const faelle: Array<[string, string | undefined, string]> = [
    ['hell A', ha, '#fafafa'],
    ['hell B', hb, '#fafafa'],
    ['dunkel A', wert(dunkel, '--battle-ecke-a'), '#191919'],
    ['dunkel B', wert(dunkel, '--battle-ecke-b'), '#191919'],
  ];
  for (const [name, farbe, grund] of faelle) ok(farbe !== undefined && kontrast(farbe, grund) >= 4.5, `BA Ecken-Tokens: Kontrast ${name} auf dem Kartengrund mindestens 4,5 : 1 (${farbe && kontrast(farbe, grund).toFixed(2)})`);
  // Die hellen Dunkel-Farben wären auf Hell zu schwach: Das ist der Grund für die zweite Definition.
  ok(kontrast('#3da5ff', '#fafafa') < 3 && kontrast('#ff5c5c', '#fafafa') < 3.1, 'BA Ecken-Tokens: Gegenprobe: die dunklen Farben hätten auf dem hellen Kartengrund unter 3,1 : 1');

  gleich(ECKEN_FARBE, { A: 'var(--battle-ecke-a)', B: 'var(--battle-ecke-b)' }, 'BA Ecken-Tokens: ECKEN_FARBE verweist auf die Tokens');
  gleich([farbeMischen(ECKEN_FARBE.A, 13), farbeMischen(UNENTSCHIEDEN_FARBE, 20)], ['color-mix(in srgb, var(--battle-ecke-a) 13%, transparent)', 'color-mix(in srgb, var(--muted-foreground) 20%, transparent)'], 'BA Ecken-Tokens: Alpha-Varianten sind color-mix über durchsichtig');
  const st = battleState({ rounds: [{ round: 1, juryWinner: 'A', votesA: 0, votesB: 0 }, { round: 2, juryWinner: 'B', votesA: 0, votesB: 0 }, { round: 3, juryWinner: 'tie', votesA: 0, votesB: 0 }] });
  const html = render(<Scoreboard state={st} aktionen={{ prevRound() {}, gotoRound() {}, setJuryWinner() {}, clearVotes() {} }} />).replace(/&amp;/g, '&');
  ok(
    html.includes('color-mix(in srgb, var(--battle-ecke-a) 20%') && html.includes('color-mix(in srgb, var(--battle-ecke-b) 20%') && html.includes('color-mix(in srgb, var(--muted-foreground) 20%'),
    'BA Ecken-Tokens: gerendert tragen die Rundenknöpfe der Jury-Seiten color-mix mit den Tokens (A, B, Unentschieden)',
  );
  const quellen = ['components/Scoreboard.tsx', 'components/Competitors.tsx', 'lib/oberflaeche.ts'].map((d) => ohneKommentare(leseText(`src/renderer/src/${d}`)));
  ok(quellen.every((q) => !/\$\{[^}]*\}[0-9a-fA-F]{2}['"`]/.test(q) && !/#3da5ff|#ff5c5c|#a3a3a3|#3f3f46|#d4d4d8/i.test(q)), 'BA Ecken-Tokens: kein Hex-Alpha (angehängte Ziffern) und keine der alten Hex-Farben mehr in Scoreboard, Ecken und Ableitungen');
}

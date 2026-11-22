// UX Welle 1, Q&A d · Live-Bereich (Spec 3.4, 5.1, Anhang A „Q&A“; E8, E13, E14, E15, R10, R16, R19): der Sprecher am Wort immer
// sichtbar, darunter drei Haupttasten als TallyButtons (Nächste, Beenden, Saal-Einreichung) im Containerraster, darunter
// Warteschlange, Hinzufügen und Erledigt; QR-Karten (Saal, Extern) rechts bzw. darunter. Render ohne Browser und ohne window.
import { gleich, leseText, ok, render } from '@jm/ui/testhilfe';
import { ActivePanel } from '@/components/ActivePanel';
import { CloudAnsicht } from '@/components/CloudPanel';
import { Queue } from '@/components/Queue';
import {
  FENSTER_LAYOUT,
  LIVE_LAYOUT,
  LIVE_ZWEI_SPALTEN_BREITE,
  liveSpalten,
  QA_TEXTE,
  TASTEN_DREI_BREITE,
  TASTEN_MIN_BREITE,
  TASTEN_ZWEI_BREITE,
  tastenAnordnung,
  type OberflaechenStand,
} from '@/lib/oberflaeche';
import { HauptTasten, LiveBereich, liveTasten, tastenSchluessel, type LiveAktionen } from '@/views/LiveBereich';
import { attr, bereich, cloud, eintragQ, elemente, ohneKommentare, qaState, tags, text, toolLink } from './testzustand';

const T = QA_TEXTE;
const stand = (teil: Parameters<typeof qaState>[0] = {}): Pick<OberflaechenStand, 'state'> => ({ state: qaState(teil) });
const amWort = { activeId: 'a', entries: [eintragQ('a', 'active', { name: 'Frau Muster', affiliation: 'Stadtwerke', question: 'Wann kommt der Bus?' }), eintragQ('b', 'waiting')] };
function aktionen(log: string[] = []): LiveAktionen {
  return { next: () => void log.push('next'), endActive: () => void log.push('endActive'), setRemote: (an) => void log.push(`setRemote(${an})`) };
}
const zeile = (s: Pick<OberflaechenStand, 'state'>): string[] =>
  liveTasten(s, aktionen()).map((t) => `${t.label}:${t.state}${t.disabledReason ? `(${t.disabledReason})` : ''}${t.shortcut ? `[${t.shortcut}]` : ''}`);

// ── QA Live Tasten: je Zustand, Klick, key je Rolle ──
{
  gleich(
    [zeile(stand()), zeile(stand(amWort)), zeile(stand({ ...amWort, remote: { running: true, urls: ['http://10.0.0.5:7782'] } }))],
    [
      ['Nächste ▶:bereit', `■ Beenden:gesperrt(${T.grund.niemandAmWort})`, `${T.saal.labelAus}:bereit`],
      ['Nächste ▶:bereit', '■ Beenden:bereit', `${T.saal.labelAus}:bereit`],
      ['Nächste ▶:bereit', '■ Beenden:bereit', `${T.saal.labelAn}:bereit`],
    ],
    'QA Live Tasten: Nächste nie gesperrt (E15), Beenden ohne Sprecher gesperrt mit Grund, die Saal-Taste wechselt die Beschriftung; nie live, ohne Kürzel (UO5)',
  );
  ok(
    [stand(), stand(amWort)].every((s) => liveTasten(s, aktionen()).every((t) => t.state !== 'live' && t.onPress === undefined && t.shortcut === undefined)),
    'QA Live Tasten: keine live-Zustände (E8: die On-Air-Quelle ist der Kopf), kein Halten, keine Kürzel',
  );
  const log: string[] = [];
  const bedienen = (s: Pick<OberflaechenStand, 'state'>): void => liveTasten(s, aktionen(log)).forEach((t) => t.onClick?.());
  bedienen(stand());
  bedienen(stand({ remote: { running: true, urls: [] } }));
  gleich(log, ['next', 'endActive', 'setRemote(true)', 'next', 'endActive', 'setRemote(false)'], 'QA Live Tasten: Klick ruft next(), endActive() und setRemote(!remote.running) (Handler wie heute)');
  gleich(tastenSchluessel(), ['naechste', 'beenden', 'saal'], 'QA Live Tasten: die Rollen der drei Tasten in Anzeigereihenfolge');
  const q = ohneKommentare(leseText('src/renderer/src/views/LiveBereich.tsx'));
  ok(q.includes('key="naechste"') && q.includes('key="beenden"') && q.includes('key="saal"') && !q.includes('key={taste.label}') && !q.includes('key={t.label}'), 'QA Live Tasten: jede Taste hat einen festen key je Rolle (naechste, beenden, saal), nie die Beschriftung (R10)');
}

// ── QA Live Tasten gerendert: aria-disabled, Grund sichtbar, höchstens vier ──
{
  const ohne = render(<HauptTasten stand={stand()} aktionen={aktionen()} />);
  const mit = render(<HauptTasten stand={stand(amWort)} aktionen={aktionen()} />);
  const sperre = (html: string): Array<string | undefined> => tags(html, 'button').map((t) => attr(t, 'aria-disabled'));
  gleich([tags(ohne, 'button').length, tags(mit, 'button').length], [3, 3], 'QA Live Tasten: gerendert genau drei TallyButtons (höchstens vier)');
  gleich([sperre(ohne), sperre(mit)], [[undefined, 'true', undefined], [undefined, undefined, undefined]], 'QA Live Tasten: Beenden trägt ohne Sprecher aria-disabled, sonst keine Taste');
  ok(text(ohne).includes(T.grund.niemandAmWort) && !text(mit).includes(T.grund.niemandAmWort), 'QA Live Tasten: der Sperrgrund „Niemand am Wort“ steht sichtbar neben der Taste und verschwindet mit dem Sprecher');
}

// ── QA Live Raster: Containerbreite, nie eine Waise ──
{
  const q = ohneKommentare(leseText('src/renderer/src/views/LiveBereich.tsx'));
  const arten = new Set(Array.from({ length: 1901 }, (_, i) => tastenAnordnung(100 + i)));
  gleich([...arten].sort(), ['erste-oben', 'gestapelt', 'reihe'], 'QA Live Raster: je Containerbreite 100–2000 px genau eine von drei Anordnungen: eine Reihe, Nächste oben mit Beenden und Saal darunter, gestapelt; nie 2+1 ohne breite erste Taste');
  gleich(
    [tastenAnordnung(TASTEN_ZWEI_BREITE - 1), tastenAnordnung(TASTEN_ZWEI_BREITE), tastenAnordnung(TASTEN_DREI_BREITE - 1), tastenAnordnung(TASTEN_DREI_BREITE)],
    ['gestapelt', 'erste-oben', 'erste-oben', 'reihe'],
    `QA Live Raster: die Grenzen liegen bei ${TASTEN_ZWEI_BREITE} px (2×140 + Lücke 12) und ${TASTEN_DREI_BREITE} px (3×140 + 2 Lücken)`,
  );
  gleich([TASTEN_ZWEI_BREITE, TASTEN_DREI_BREITE], [2 * TASTEN_MIN_BREITE + 12, 3 * TASTEN_MIN_BREITE + 24], 'QA Live Raster: Grenzbreiten aus Mindestbreite und Lücke abgeleitet');
  ok(
    q.includes('@container') && q.includes('@[444px]:grid-cols-3') && q.includes('@[292px]:grid-cols-2') && q.includes('@[292px]:col-span-2') && q.includes('@[444px]:col-span-1') && q.includes('grid-cols-1') && !/(sm|md|lg|xl):grid-cols/.test(q),
    'QA Live Raster: Container-Query (@container, @[292px] Nächste breit oben, @[444px] eine Reihe) mit grid-cols-1 als Basis, keine Viewport-Breakpoints; die Klassen stehen als Literal im Quelltext (Tailwind-Scan)',
  );
  ok(TASTEN_ZWEI_BREITE === 292 && TASTEN_DREI_BREITE === 444, 'QA Live Raster: die Literale 292 und 444 im Quelltext gleichen den Konstanten');
  const html = render(<HauptTasten stand={stand()} aktionen={aktionen()} />);
  ok(html.includes('@container') && html.includes('@[444px]:grid-cols-3') && html.includes('@[292px]:grid-cols-2'), 'QA Live Raster: gerendert trägt die Hülle @container und das Raster');
  const dom = [...html.matchAll(/<button[^>]*>[\s\S]*?<\/button>/g)].map((m) => text(m[0]).slice(0, 4));
  gleich(dom, ['Näch', '■ Be', 'Saal'], 'QA Live Raster: die Tab-Reihenfolge im Markup ist Nächste, Beenden, Saal');
}

// ── QA Live Breite: bei Mindestfenster 960 × 640 mit Panel (R16) ──
{
  const F = FENSTER_LAYOUT;
  const L = LIVE_LAYOUT;
  const client = F.fensterMin - F.rahmen;
  const mitPanel = client - F.panel - F.trennlinie;
  const ohnePanel = client;
  gleich([client, mitPanel, ohnePanel], [944, 583, 944], 'QA Live Breite: bei 960 px Fenster (944 px Seite) bleiben dem Inhalt mit Panel 583 px, ohne Panel 944 px');
  const inhalt = (b: number): number => b - F.innen;
  gleich([inhalt(mitPanel), inhalt(ohnePanel)], [551, 912], 'QA Live Breite: die Inhaltsbox hinter dem Innenabstand p-4 ist 551 px mit Panel, 912 px ohne');
  gleich([tastenAnordnung(inhalt(mitPanel)), tastenAnordnung(inhalt(ohnePanel))], ['reihe', 'reihe'], 'QA Live Breite: die drei Haupttasten stehen bei 960 px mit und ohne Panel in einer Reihe');
  gleich(L.linksMin + L.luecke + L.rechts, LIVE_ZWEI_SPALTEN_BREITE, 'QA Live Breite: zwei Spalten brauchen linke Mindestbreite 368 + Lücke 16 + rechte Spalte 256');
  gleich([liveSpalten(LIVE_ZWEI_SPALTEN_BREITE - 1), liveSpalten(LIVE_ZWEI_SPALTEN_BREITE)], [1, 2], `QA Live Breite: die Grenze zwischen einer und zwei Spalten liegt bei ${LIVE_ZWEI_SPALTEN_BREITE} px`);
  gleich([liveSpalten(inhalt(mitPanel)), liveSpalten(inhalt(ohnePanel))], [1, 2], 'QA Live Breite: bei 960 px mit Panel stehen die QR-Karten unter der Warteschlange (eine Spalte), ohne Panel daneben');
  const breit = 1180 - F.rahmen - F.panel - F.trennlinie;
  gleich([liveSpalten(inhalt(breit)), inhalt(breit) - L.luecke - L.rechts >= L.linksMin], [2, true], 'QA Live Breite: im Standardfenster 1180 px mit Panel stehen zwei Spalten, die linke bleibt über ihrer Mindestbreite');
  const q = ohneKommentare(leseText('src/renderer/src/views/LiveBereich.tsx'));
  ok(q.includes('@[640px]:grid-cols-[minmax(0,1fr)_256px]') && LIVE_ZWEI_SPALTEN_BREITE === 640 && L.rechts === 256, 'QA Live Breite: das Literal @[640px] und die rechte Spalte 256 px gleichen den Konstanten');
  ok(
    q.includes('min-h-0 flex-1 overflow-y-auto') && q.includes('shrink-0') && /data-qa="oben" className="[^"]*shrink-0/.test(q),
    'QA Live Breite: der Bereich unter den Haupttasten scrollt selbst (min-h-0, overflow-y-auto), die Zone mit Sprecher und Tasten ist shrink-0: nichts überlappt die Haupttasten',
  );
  ok(q.includes('min-w-0') && !q.includes('w-80') && !q.includes('w-[320px]'), 'QA Live Breite: die alte feste Spalte w-80 ist weg, die Spalten tragen min-w-0');
  ok(leseText('src/main/index.ts').includes('minWidth: 960') && leseText('src/main/index.ts').includes('minHeight: 640'), 'QA Live Breite: die Fenster-Mindestgröße im Main ist 960 × 640 (unverändert)');
  ok(/--panel-w:\s*360px/.test(leseText('../../packages/ui/src/tokens/sizes.css')), 'QA Live Breite: die Panelbreite ist 360 px (unverändert)');
}

// ── QA Live Element: der Sprecher ohne Klick sichtbar ──
{
  const timer = toolLink({ state: { remaining: '01:23', running: '1', overrun: '0' } as never });
  const html = render(<ActivePanel state={qaState({ ...amWort, links: [timer] })} />);
  const t = text(html);
  ok(t.includes('Frau Muster') && t.includes('Stadtwerke') && t.includes('Wann kommt der Bus?') && t.includes('Am Wort'), 'QA Live Element: Name, Funktion und Frage des Sprechers stehen ohne Klick im Live-Element');
  ok(t.includes('⏱ 01:23') && html.includes('Redezeit (vom JM Timer)'), 'QA Live Element: die Redezeit aus dem Timer-STATE steht mit ihrem Tooltip da');
  ok(!tags(html, 'button').length, 'QA Live Element: das Live-Element hat keine eigenen Knöpfe mehr (die Haupttasten stehen darunter)');
  const leer = text(render(<ActivePanel state={qaState()} />));
  ok(leer.includes(T.leer) && !leer.includes('"') && T.leer === 'Niemand am Wort. „Nächste“ ruft die erste Wortmeldung auf.', 'QA Live Element: der Leertext nennt „Nächste“ mit typografischen Anführungszeichen (R9: vorher ein ASCII-Zeichen)');
  const voll = render(<LiveBereich state={qaState(amWort)} aktionen={aktionen()} />);
  ok(voll.indexOf('Frau Muster') < voll.indexOf('data-state="bereit"'), 'QA Live Element: im Live-Bereich steht der Sprecher über den Haupttasten');
  ok(bereich(voll, 'oben').includes('Frau Muster') && !bereich(voll, 'unten').includes('Frau Muster'), 'QA Live Element: der Sprecher steht in der festen oberen Zone, nicht im scrollenden Bereich');
}

// ── QA Live Bereich: Spalten, QR-Karten bleiben ──
{
  const html = render(<LiveBereich state={qaState({ remote: { running: true, urls: ['http://10.0.0.5:7782'] }, cloud: cloud() })} aktionen={aktionen()} />);
  const unten = bereich(html, 'unten');
  const links = bereich(html, 'spalte-links');
  const rechts = bereich(html, 'spalte-rechts');
  ok(links.includes('Warteschlange') && links.includes('Wortmeldung hinzufügen') && !links.includes('Saal-Einreichung'), 'QA Live Bereich: links Warteschlange und Hinzufügen');
  ok(rechts.includes('Saal-Einreichung') && rechts.includes('Extern (Stream &amp; Presse)'), 'QA Live Bereich: rechts die Karten Saal-Einreichung und Extern (Stream & Presse)');
  ok(links.length > 0 && rechts.length > 0 && unten.indexOf('data-qa="spalte-links"') < unten.indexOf('data-qa="spalte-rechts"'), 'QA Live Bereich: im Markup folgen die QR-Karten auf Warteschlange und Hinzufügen (unter dem Raster bei einer Spalte)');
  const remote = render(<LiveBereich state={qaState({ remote: { running: true, urls: ['http://10.0.0.5:7782'] } })} aktionen={aktionen()} />);
  const saalKarte = bereich(remote, 'spalte-rechts').split('Extern (Stream')[0];
  ok(text(saalKarte).includes('http://10.0.0.5:7782') && tags(saalKarte, 'button').length === 0, 'QA Live Bereich: die Saal-Adresse steht in der Karte, die Karte selbst hat keinen Schalter mehr');
  const saal = ohneKommentare(leseText('src/renderer/src/components/RemotePanel.tsx'));
  ok(!saal.includes('setRemote') && !saal.includes('◉ An'), 'QA Live Bereich: der Saal-Schalter ist aus der Karte in die Haupttaste gezogen (setRemote steht nur noch in der Oberfläche)');
}

// ── QA Erledigte entfernen bleibt ──
{
  const config = qaState().config;
  const mitErledigt = render(<Queue entries={[eintragQ('a', 'done', { name: 'Herr Alt' }), eintragQ('b', 'waiting')]} config={config} />);
  const ohneErledigt = render(<Queue entries={[eintragQ('b', 'waiting')]} config={config} />);
  const knoepfe = (h: string): string[] => [...h.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]));
  ok(knoepfe(mitErledigt).includes('Erledigte entfernen') && !knoepfe(ohneErledigt).includes('Erledigte entfernen'), 'QA Erledigte entfernen bleibt: der Knopf steht neben „Erledigt“, solange es einen erledigten Eintrag gibt');
  ok(text(mitErledigt).includes('Erledigt') && text(mitErledigt).includes('Herr Alt'), 'QA Erledigte entfernen bleibt: die Erledigt-Liste zeigt die Namen');
  const q = ohneKommentare(leseText('src/renderer/src/components/Queue.tsx'));
  ok(q.includes('onClick={() => void clearDone()}') && q.includes('Erledigte entfernen'), 'QA Erledigte entfernen bleibt: der Knopf ruft clearDone() ohne Rückfrage wie heute');
  ok(!q.includes('confirm('), 'QA Erledigte entfernen bleibt: keine neue Rückfrage');
  const kanal = render(<Queue entries={[eintragQ('s', 'waiting', { channel: 'stream', source: 'remote', approved: false }), eintragQ('p', 'waiting', { channel: 'press' }), eintragQ('l', 'waiting', { channel: 'lan' })]} config={config} />);
  ok(['Saal', 'Stream', 'Presse'].every((k) => text(kanal).includes(k)) && text(kanal).includes('wartet auf Freigabe') && text(kanal).includes('Freigeben') && text(kanal).includes('▶ Ans Wort'), 'QA Erledigte entfernen bleibt: Kanal-Badges, Freigabe-Marke, Freigeben und Ans Wort bleiben in der Warteschlange');
}

// ── QA Event beenden mit Rückfrage (R19: der einzige confirm) ──
{
  const log: string[] = [];
  const aktion = { cloudEnable: (an: boolean) => void log.push(`enable(${an})`), cloudPurge: () => void log.push('purge'), setCloudConfig: (p: unknown) => void log.push(`config(${JSON.stringify(p)})`) };
  const baum = CloudAnsicht({ cloud: cloud({ enabled: true, configured: true, streamUrl: 'https://relay.example/s', pressCode: 'P' }), qr: '', aktionen: aktion });
  const purge = elemente(baum, (e) => e.props.children === 'Event beenden & Daten löschen')[0];
  const g = globalThis as unknown as { confirm?: (t: string) => boolean };
  const vorher = g.confirm;
  const gefragt: string[] = [];
  try {
    g.confirm = (t) => (gefragt.push(t), false);
    (purge.props.onClick as () => void)();
    const nachNein = [...log];
    g.confirm = (t) => (gefragt.push(t), true);
    (purge.props.onClick as () => void)();
    gleich([nachNein, log, gefragt], [[], ['purge'], ['Event beenden und alle externen Einreichungen im Relay löschen?', 'Event beenden und alle externen Einreichungen im Relay löschen?']], 'QA Event beenden mit Rückfrage: „Abbrechen“ löscht nichts, „OK“ ruft cloudPurge; die Frage ist wörtlich die bisherige');
  } finally {
    g.confirm = vorher;
  }
  const html = render(<CloudAnsicht cloud={cloud({ enabled: true, configured: true, streamUrl: 'https://relay.example/s' })} qr="" aktionen={aktion} />);
  ok(text(html).includes('Event beenden & Daten löschen'), 'QA Event beenden mit Rückfrage: der Knopf „Event beenden & Daten löschen“ steht in der Extern-Karte, solange Extern an ist');
  ok(!text(render(<CloudAnsicht cloud={cloud()} qr="" aktionen={aktion} />)).includes('Event beenden'), 'QA Event beenden mit Rückfrage: ohne laufendes Extern gibt es den Knopf nicht (wie heute)');
  const dateien = ['App.tsx', 'views/QaOberflaeche.tsx', 'views/LiveBereich.tsx', 'views/Einstellungen.tsx', 'components/ActivePanel.tsx', 'components/Queue.tsx', 'components/AddForm.tsx', 'components/RemotePanel.tsx', 'components/CloudPanel.tsx'];
  const treffer = dateien.flatMap((d) => (ohneKommentare(leseText(`src/renderer/src/${d}`)).match(/\bconfirm\(/g) ?? []).map(() => d));
  gleich(treffer, ['components/CloudPanel.tsx'], 'QA Event beenden mit Rückfrage: im ganzen Renderer gibt es genau einen confirm, in CloudPanel.tsx (R19)');
  const q = ohneKommentare(leseText('src/renderer/src/components/CloudPanel.tsx'));
  ok(q.includes("if (confirm('Event beenden und alle externen Einreichungen im Relay löschen?')) aktionen.cloudPurge();"), 'QA Event beenden mit Rückfrage: die Rückfrage steht vor dem Löschen im Quelltext');
}

// ── Quelltext-Wächter: Tokens, Bausteine, Abläufe ──
{
  const dateien = [
    'App.tsx', 'views/QaOberflaeche.tsx', 'views/Einstellungen.tsx', 'views/LiveBereich.tsx',
    'components/ActivePanel.tsx', 'components/Queue.tsx', 'components/AddForm.tsx', 'components/RemotePanel.tsx', 'components/CloudPanel.tsx',
  ];
  // Rohe Tailwind-Farbklassen; die weiße Fläche der QR-Bilder (Spec: QR schwarz auf weiß) steht nur in <img>-Tags und wird vorher abgezogen.
  const roh = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow)-(?:white|black|neutral|gray|grey|zinc|slate|stone|red|green|blue|yellow|amber|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b/;
  const code = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`)).replace(/<img[\s\S]*?\/>/g, '');
  gleich(dateien.filter((d) => roh.test(code(d))), [], 'QA Live Tasten: keine rohen Farbklassen in den geänderten Dateien (QR-Bilder weiß ausgenommen), nur Tokens');
  const qr = dateien.flatMap((d) => [...ohneKommentare(leseText(`src/renderer/src/${d}`)).matchAll(/<img[\s\S]*?\/>/g)].map((m) => m[0]));
  ok(qr.length === 2 && qr.every((i) => i.includes('bg-white')), 'QA Live Tasten: beide QR-Bilder (Saal, Extern) bleiben schwarz auf weiß');
  const lokal = dateien.filter((d) => /const (inp|iconBtn|topBtn|endBtn|nextBtn) =|function Row\(/.test(code(d)));
  gleich(lokal, [], 'QA Live Tasten: keine lokalen Knopf-Klassenketten und kein lokales Row mehr (Button, TextInput, Field aus @jm/ui)');
  const ober = code('views/QaOberflaeche.tsx');
  const einst = code('views/Einstellungen.tsx');
  ok(!einst.includes('useEffect') && !/\bwindow\b/.test(einst) && !einst.includes('useQa'), 'QA Live Tasten: views/Einstellungen.tsx ohne window, ohne useEffect und ohne Store (G7, G8); die Abläufe liegen in der View');
  ok(ober.includes('useBrueckenWert') && !ober.includes('setProxyKey('), 'QA Live Tasten: die Brücken laufen in der View, das Panel ruft nur Rückrufe');
  ok(leseText('src/renderer/src/globals.css').includes('packages/settings/src'), 'QA Live Tasten: globals.css scannt @jm/settings (Klassen der Abschnitte)');
}

// ── QA Live: Texte ohne ASCII-Anführungszeichen ──
{
  const html = render(<LiveBereich state={qaState(amWort)} aktionen={aktionen()} />) + render(<LiveBereich state={qaState()} aktionen={aktionen()} />);
  const platzhalter = tags(html, 'input').map((t) => attr(t, 'placeholder') ?? '');
  ok(!text(html).includes('"') && platzhalter.every((p) => !p.includes('"')), 'QA Live Tasten: kein ASCII-Anführungszeichen in den gerenderten Texten und Platzhaltern (nur „ “)');
}

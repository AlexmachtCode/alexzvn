// UX Welle 1, Switcher d1 · Rahmen (Spec 3.1, 3.8, 5.1, 7; E6, E8, E17, E18): AppShell mit Kopf (JM Switcher, ⚙, Hell/Dunkel,
// On-Air), Werkzeugleiste mit der Projekt-Leiste und Statusleiste aus lib/oberflaeche.ts. Render ohne Browser und ohne window:
// Die Brücken bleiben offen, Master und Fernsteuerung zeigen „unbekannt“. Der Mischer bleibt gemountet (Review Focus 1).
import { readFileSync } from 'node:fs';
import { AppShell } from '@jm/ui';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { SWITCHER_TEXTE, UNTEN_OFFEN_AB, onAirKopf, untenStartOffen } from '@/lib/oberflaeche';
import { SwitcherRahmen } from '@/views/SwitcherOberflaeche';
import { Werkzeugleiste } from '@/views/Werkzeugleiste';
import { attr, basisStand, ohneKommentare, statusEintraege, tags, text } from './testzustand';

const nichts = (): void => undefined;
const inhalt = (html: string): string => /<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? '';
// Der Mischer braucht Canvas und Browser (SwitcherView erzeugt seine Controller beim Rendern); der Rahmen wird mit einem
// Stellvertreter gerendert, der wie der Mischer nur Kind des AppShell ist.
const MISCHER = 'MISCHER-STELLVERTRETER';
const rahmen = (anfangOffen = false): string =>
  render(<SwitcherRahmen anfangOffen={anfangOffen}>{() => <div data-mischer="">{MISCHER}</div>}</SwitcherRahmen>);

// ── Kopf und Statusleiste im Rahmen (Server-Render des Anfangszustands) ──
{
  const html = rahmen();
  const [zahnrad] = tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
  const [thema] = tags(html, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
  ok(
    html.includes('data-bereich="inhalt"') && text(html).includes('JM Switcher') && !html.includes('JM SWITCHER') && !html.includes('Video-Mischer'),
    'SW Rahmen Kopf: AppShell mit „JM Switcher“, ohne die alte Kopfzeile',
  );
  gleich(
    [attr(thema, 'aria-label'), attr(zahnrad, 'aria-label'), attr(zahnrad, 'aria-expanded')],
    ['Darstellung: Dunkel. Umschalten auf Hell', 'Einstellungen öffnen', 'false'],
    'SW Rahmen Kopf: Hell/Dunkel (E17) und ⚙ „Einstellungen öffnen“, Panel beim Start zu',
  );
  ok(
    html.includes('data-onair="bereit"') && !html.includes('role="tab"') && !html.includes('<aside'),
    'SW Rahmen Kopf: On-Air zeigt „bereit“ ohne Aufnahme und Stream (E8), keine Reiter, kein offenes Panel',
  );
  gleich(
    statusEintraege(html).map(([id]) => id),
    ['master-link', 'ndi', 'bildschirm', 'aufnahme', 'stream', 'fernsteuerung', 'audio'],
    'SW Rahmen Statusleiste Reihenfolge: Verbindung, Ausgaben, Fernsteuerung, Tool (Anhang A)',
  );
  const unbekannt = statusEintraege(html).filter(([id]) => id === 'master-link' || id === 'fernsteuerung');
  gleich(
    unbekannt.map(([id, zustand, tip]) => [id, zustand, tip]),
    [
      ['master-link', 'off', 'Master: unbekannt'],
      ['fernsteuerung', 'off', 'Fernsteuerung: aus'],
    ],
    'SW Rahmen Statusleiste Reihenfolge: ohne Brücke „unbekannt“, Fernsteuerung nach der Einstellung (R4: im Store standardmäßig aus), nie ok (Spec 7.2)',
  );
  pruefeIdVerweise(html, 'SW Rahmen: id-Verweise im Rahmen gültig');
}

// ── Mischer bleibt gemountet (Review Focus 1) ──
{
  const quelle = ohneKommentare(leseText('src/renderer/src/views/SwitcherOberflaeche.tsx'));
  const anzahl = (quelle.match(/<SwitcherView[\s>/]/g) ?? []).length;
  ok(anzahl === 1, `SW Rahmen Mischer bleibt gemountet: SwitcherView steht genau einmal in SwitcherOberflaeche (${anzahl})`);
  const start = quelle.search(/<SwitcherView[\s>/]/);
  const tag = quelle.slice(start, quelle.indexOf('>', start) + 1);
  ok(!/\bkey=/.test(tag), 'SW Rahmen Mischer bleibt gemountet: SwitcherView ohne key (Panel- oder Fensterzustand würde ihn neu mounten)');
  const davor = quelle.slice(0, start).trimEnd();
  ok(
    !/(&&|\?|:|\|\||\bif\s*\([^)]*\)\s*)$/.test(davor) && !/\bhidden\b/.test(tag),
    'SW Rahmen Mischer bleibt gemountet: SwitcherView steht unbedingt da, nicht hinter &&, ?: oder hidden',
  );
  const settingsA = quelle.indexOf('settings={');
  const settingsE = quelle.indexOf('settingsOpen=');
  ok(
    settingsA >= 0 && settingsE > settingsA && !(start > settingsA && start < settingsE),
    'SW Rahmen Mischer bleibt gemountet: SwitcherView steht nicht innerhalb von settings',
  );
  ok(
    /<SwitcherRahmen>\{\(anschluss\) => <SwitcherView /.test(quelle) && /<AppShell[\s\S]*\{children\(\{/.test(quelle),
    'SW Rahmen Mischer bleibt gemountet: SwitcherView ist über SwitcherRahmen das Kind des AppShell',
  );
}
{
  // Render: Die Kinder des Rahmens sind bei offenem und geschlossenem Panel gleich vorhanden.
  const zu = rahmen();
  const offen = rahmen(true);
  ok(offen.includes('<aside') || offen.includes('einstellung-ndi'), 'SW Rahmen Mischer bleibt gemountet: Das Panel ist mit anfangOffen offen (Gegenprobe)');
  ok(inhalt(zu).includes(MISCHER) && inhalt(offen).includes(MISCHER), 'SW Rahmen Mischer bleibt gemountet: Das Kind steht bei offenem und geschlossenem Panel im main');
  gleich(inhalt(offen), inhalt(zu), 'SW Rahmen Mischer bleibt gemountet: Kinder bei settingsOpen true und false identisch');
  ok(!inhalt(offen).includes('einstellung-') && offen.includes('einstellung-ndi'), 'SW Rahmen Mischer bleibt gemountet: Panel-Anker stehen nur im Panel, nicht im Mischer');
}

// ── On-Air im Kopf (E8) ──
{
  const kopf = (live: boolean, label?: string): string =>
    render(
      <AppShell tool="Switcher" onAir={{ live, label }} status={[]} settingsOpen={false} onSettingsChange={nichts}>
        <span />
      </AppShell>,
    );
  const aus = { recording: false, streaming: false, recPath: null, error: null, errorScope: null };
  const live = onAirKopf(basisStand({ output: { ...aus, streaming: true } }));
  const rec = onAirKopf(basisStand({ output: { ...aus, recording: true } }));
  const beide = onAirKopf(basisStand({ output: { ...aus, streaming: true, recording: true } }));
  enthaelt(kopf(live.live, live.label), '>LIVE<', 'SW Rahmen Kopf: Stream → On-Air „LIVE“ im Kopf');
  enthaelt(kopf(rec.live, rec.label), '>REC<', 'SW Rahmen Kopf: nur Aufnahme → On-Air „REC“ im Kopf');
  enthaelt(kopf(beide.live, beide.label), '>LIVE<', 'SW Rahmen Kopf: Stream und Aufnahme → „LIVE“ geht vor „REC“');
  const quelle = ohneKommentare(leseText('src/renderer/src/views/SwitcherOberflaeche.tsx'));
  ok(quelle.includes('onAir={onAirKopf(stand)}'), 'SW Rahmen Kopf: On-Air kommt aus onAirKopf(stand) (E8)');
  ok(SWITCHER_TEXTE.onAirLive === 'LIVE' && SWITCHER_TEXTE.onAirRec === 'REC', 'SW Rahmen Kopf: Kennungen LIVE und REC');
}

// ── Werkzeugleiste mit der Projekt-Leiste (E6) ──
{
  const log: string[] = [];
  const mit = (pfad: string | null): string =>
    render(
      <Werkzeugleiste
        name="Gala 2026"
        pfad={pfad}
        aktionen={{ neu: () => void log.push('neu'), oeffnen: () => void log.push('oeffnen'), speichern: () => void log.push('speichern'), speichernUnter: () => void log.push('speichernUnter') }}
      />,
    );
  const neu = mit(null);
  const knoepfe = tags(neu, 'button');
  gleich(
    [...neu.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1])),
    ['Neu', 'Öffnen…', 'Speichern', 'Speichern unter…'],
    'SW Werkzeugleiste Projekt: Neu, Öffnen, Speichern, Speichern unter in dieser Reihenfolge',
  );
  ok(knoepfe.length === 4 && knoepfe.every((t) => attr(t, 'disabled') === undefined), 'SW Werkzeugleiste Projekt: vier Knöpfe, keiner gesperrt');
  ok(text(neu).includes('Projekt') && text(neu).includes('Gala 2026'), 'SW Werkzeugleiste Projekt: Name des Projekts steht da');
  enthaelt(neu, '· ungespeichert', 'SW Werkzeugleiste Projekt: ohne Datei steht „· ungespeichert“');
  enthaelt(neu, 'title="Nicht gespeichert"', 'SW Werkzeugleiste Projekt: ohne Datei zeigt der Name „Nicht gespeichert“');
  const gespeichert = mit('C:\\Shows\\gala.jmswitch');
  ok(!gespeichert.includes('ungespeichert'), 'SW Werkzeugleiste Projekt: mit Datei entfällt „· ungespeichert“');
  enthaelt(gespeichert, 'title="C:\\Shows\\gala.jmswitch"', 'SW Werkzeugleiste Projekt: mit Datei zeigt der Name den Pfad');
  const quelle = ohneKommentare(leseText('src/renderer/src/views/Werkzeugleiste.tsx'));
  ok(
    ['onClick={aktionen.neu}', 'onClick={aktionen.oeffnen}', 'onClick={aktionen.speichern}', 'onClick={aktionen.speichernUnter}'].every((z) => quelle.includes(z)),
    'SW Werkzeugleiste Projekt: jeder Knopf ruft seine Aktion',
  );
  // Im Rahmen: die Leiste steht in der Toolbar, nicht mehr im Mischer.
  const html = rahmen();
  const bar = /data-bereich="toolbar"[^>]*>([\s\S]*?)<div data-bereich="inhalt"/.exec(html)?.[1] ?? '';
  ok(text(bar).includes('Speichern unter…') && text(bar).includes('Neu'), 'SW Werkzeugleiste Projekt: Die Projekt-Leiste steht in der Toolbar des Rahmens (E6)');
  const view = ohneKommentare(leseText('src/renderer/src/views/SwitcherView.tsx'));
  ok(!view.includes('Speichern unter…') && !view.includes('ungespeichert'), 'SW Werkzeugleiste Projekt: Der Mischer hat keine eigene Projekt-Leiste mehr');
  ok(
    view.includes("window.confirm('Neues Projekt anlegen? Nicht gespeicherte Änderungen gehen verloren.')"),
    'SW Werkzeugleiste Projekt: Die Rückfrage bei „Neu“ bleibt wörtlich (E6)',
  );
}

// ── Toast über der Statusleiste und Mindesthöhe ──
{
  const view = readFileSync('src/renderer/src/views/SwitcherView.tsx', 'utf8').replace(/\r\n/g, '\n');
  const stelle = view.indexOf('{notice && (');
  const zeile = view.slice(stelle, view.indexOf('\n', view.indexOf('fixed', stelle)));
  ok(
    zeile.includes('fixed') && zeile.includes('bottom-[calc(var(--statusbar-h)') && !/\bbottom-5\b/.test(zeile),
    'SW Rahmen Toast über der Statusleiste: Der Hinweis-Toast sitzt um die Höhe der Statusleiste höher (--statusbar-h), nicht auf ihr',
  );
  // Mindesthöhe 720 (main/index.ts) ist die Außenhöhe samt Fensterrahmen (default frame): Titelleiste 31 + unterer Rand 8 = 39 px
  // (Windows bei 100 %; Annahme, nicht gemessen) → 681 px Inhalt. Davon gehen ab: Kopf, Toolbar, Statusleiste (sizes.css) und im
  // Mischer Monitor-Rand, Haupttasten (Taste mit zweizeiligem Grund), Ausgabeleiste und das untere Panel (Collapsible).
  const groessen = leseText('../../packages/ui/src/tokens/sizes.css');
  const px = (name: string): number => Number(new RegExp(`--${name}:\\s*(\\d+)px`).exec(groessen)?.[1]);
  const main = leseText('src/main/index.ts');
  const minHoehe = Number(/minHeight:\s*(\d+)/.exec(main)?.[1]);
  const rahmen39 = 31 + 8;
  const inhalt720 = minHoehe - rahmen39;
  const toolbar = 12 + 32 + 1; // py-1.5 beidseits + Button sm (h-8) + border-b
  const randMonitor = 40; // py-5 des Monitor-Bereichs
  const taste = 16 + 23 + 4 + 33; // py-2 beidseits + Beschriftung 15 px (Zeile 23) + gap-1 + Grund 11 px in zwei Zeilen
  const haupttasten = taste + 12; // pb-3
  const ausgabeLeiste = 56; // h-14
  const untenZu = 1 + 16 + 15; // border-t + py-2 beidseits + Kopfzeile des Collapsible
  const untenOffen = untenZu + 10 + 300; // space-y-2.5 + h-[300px]
  const fest = px('header-h') + toolbar + px('statusbar-h') + randMonitor + haupttasten + ausgabeLeiste;
  const monitorZu = inhalt720 - fest - untenZu;
  const monitorOffen = inhalt720 - fest - untenOffen;
  const brauchbar = 180; // 16:9 bei 320 px Breite, gut die Hälfte der Monitorbreite (rund 500 px) im Mindestfenster 1120 px
  ok(
    view.includes('h-[300px]') && view.includes('px-6 h-14') && minHoehe === 720,
    `SW Rahmen Mindesthöhe: das untere Panel hat 300 px Inhalt, die Ausgabeleiste 56 px (Mindesthöhe ${minHoehe})`,
  );
  ok(
    monitorOffen < brauchbar && monitorZu >= brauchbar,
    `SW Rahmen Mindesthöhe: bei ${minHoehe} px außen (${inhalt720} px Inhalt) blieben bei offenem Panel ${monitorOffen} px für die Monitore (unbrauchbar, < ${brauchbar}), bei zugeklapptem ${monitorZu} px`,
  );
  ok(
    !untenStartOffen(inhalt720) && untenStartOffen(UNTEN_OFFEN_AB) && UNTEN_OFFEN_AB - fest - untenOffen >= brauchbar,
    `SW Rahmen Mindesthöhe: bei ${inhalt720} px Inhalt startet das untere Panel zu; ab ${UNTEN_OFFEN_AB} px offen bleiben ${UNTEN_OFFEN_AB - fest - untenOffen} px für die Monitore (≥ ${brauchbar})`,
  );
}

// ── Quelltext ──
{
  const quelle = ohneKommentare(leseText('src/renderer/src/views/SwitcherOberflaeche.tsx'));
  const fehlt = [
    'useBrueckenWert(MASTER_LINK_QUELLE)',
    'useBrueckenWert(FERNSTEUERUNG_QUELLE)',
    'status={statusLeiste(stand)}',
    'tool="Switcher"',
    'toolbar={<Werkzeugleiste',
    'settingsOpen={panelOffen}',
    'settingsSection={panelAbschnitt}',
    'setPanelOffen(offen);',
    'setPanelAbschnitt(abschnitt);',
    'window.jmswitch.screen',
    'listDisplays()',
  ].filter((z) => !quelle.includes(z));
  ok(fehlt.length === 0, 'SW Rahmen Quelltext: Brücken im Rahmen (auch bei geschlossenem Panel), Statusleiste, Toolbar, Panel-Zustand, Monitorliste');
  for (const z of fehlt) console.log(`     fehlt: ${z}`);
  ok(
    !/localStorage|sessionStorage/.test(quelle),
    'SW Rahmen Quelltext: Der Panel-Zustand wird nirgends gemerkt (Panel beim Start zu)',
  );
  const roh = /\b(?:bg|text|border)-(?:neutral|gray|zinc|slate|white|black|green|red|blue|amber|yellow)(?:-\d+)?\b/;
  const betroffen = ['SwitcherOberflaeche', 'Werkzeugleiste', 'Einstellungen'].filter((n) => roh.test(ohneKommentare(leseText(`src/renderer/src/views/${n}.tsx`))));
  ok(betroffen.length === 0, `SW Rahmen Quelltext: keine rohen Farbklassen in den neuen Dateien${betroffen.length ? ` (${betroffen.join(', ')})` : ''}`);
  const alt = readFileSyncOderNull('src/renderer/src/components/Topbar.tsx');
  ok(alt === null, 'SW Rahmen Quelltext: components/Topbar.tsx und die Reiter entfallen');
  const app = ohneKommentare(leseText('src/renderer/src/App.tsx'));
  ok(app.includes('<SwitcherOberflaeche') && !app.includes('Topbar') && !app.includes('SettingsView') && !app.includes('hidden'), 'SW Rahmen Quelltext: App rendert nur SwitcherOberflaeche');
  const index = leseText('src/renderer/index.html');
  ok(index.includes('<html lang="de" class="dark">'), 'SW Rahmen Quelltext: index.html behält class="dark" (E17)');
  const out = ohneKommentare(leseText('src/renderer/src/views/OutputView.tsx'));
  ok(!out.includes('AppShell'), 'SW Rahmen Quelltext: Das Ausgabefenster ?view=output bleibt ohne AppShell (E18)');
}

function readFileSyncOderNull(pfad: string): string | null {
  try {
    return readFileSync(pfad, 'utf8');
  } catch {
    return null;
  }
}

// UX Welle 2a, Stage-Display d · Rahmen (Spec 3.1, 3.8, 5.1; E4, E5, E6, E16): AppShell mit Kopf „JM Stage Display“, ⚙, ThemeToggle
// und Statusleiste, ohne ON AIR; das Panel ist kein eigener Bildschirm (der Live-Bereich bleibt gemountet); die Ausgabeansicht
// und die Programmfläche bleiben unberührt; Farben als Quelltext-Wächter. Render ohne Browser und ohne window.
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { StageOberflaeche } from '@/views/StageOberflaeche';
import { attr, mitStore, ohneKommentare, stageZustand, statusEintraege, tags, text } from './testzustand';

const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));

// ── SD Rahmen: Kopf, ⚙, ThemeToggle, Statusleiste, kein ON AIR ──
{
  const html = mitStore({ state: stageZustand() }, () => render(<StageOberflaeche />));
  const [zahnrad] = tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
  const [thema] = tags(html, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
  ok(
    text(html).includes('JM Stage Display') && !html.includes('JM STAGE DISPLAY') && html.includes('data-bereich="inhalt"'),
    'SD Rahmen: AppShell mit Kopf „JM Stage Display“ (die alte Marke „JM STAGE DISPLAY“ ist weg)',
  );
  ok(!text(html).includes('Bühnen-/Crew-Schirm'), 'SD Rahmen: der alte Untertitel „Bühnen-/Crew-Schirm“ entfällt (E16)');
  gleich(
    [attr(thema, 'aria-label'), attr(zahnrad, 'aria-label'), attr(zahnrad, 'aria-expanded')],
    ['Darstellung: Dunkel. Umschalten auf Hell', 'Einstellungen öffnen', 'false'],
    'SD Rahmen: ThemeToggle (E5) und ⚙ „Einstellungen öffnen“ im Kopf, Panel beim Start zu',
  );
  gleich(
    statusEintraege(html).map(([id]) => id).sort(),
    ['buehnenschirm', 'master-link', 'nachricht', 'quelle-presenter', 'quelle-switcher', 'quelle-timer'],
    'SD Rahmen: Statusleiste mit Master-Link, den drei Quellen, Bühnenschirm und Nachricht',
  );
  ok(statusEintraege(html).every(([, zustand]) => zustand === 'off'), 'SD Rahmen: vor der ersten Antwort und mit ausgeschalteten Quellen ist nichts ok');
  ok(!html.includes('data-onair'), 'SD Rahmen: kein ON AIR im Kopf (E4)');
  pruefeIdVerweise(html, 'SD Rahmen: id-Verweise im ganzen Bedienfenster gültig');
}

// ── SD Rahmen: Zustand vor dem Laden ──
{
  const html = mitStore({ state: null }, () => render(<StageOberflaeche />));
  ok(text(html).includes('Lädt…') && text(html).includes('JM Stage Display'), 'SD Rahmen: vor dem Laden steht der Rahmen mit „Lädt…“, die Statusleiste ist unbekannt');
  ok(statusEintraege(html).length === 6 && statusEintraege(html).every(([, zustand]) => zustand === 'off'), 'SD Rahmen: vor dem Laden ist kein Statuseintrag ok');
}

// ── SD Rahmen: das Panel ist kein Bildschirm, die Live-Ansicht bleibt ──
{
  const offen = mitStore({ state: stageZustand() }, () => render(<StageOberflaeche anfangOffen />));
  const zu = mitStore({ state: stageZustand() }, () => render(<StageOberflaeche />));
  ok(
    offen.includes('aria-label="Einstellungen"') && offen.includes('data-stage="live"') && offen.indexOf('data-stage="live"') < offen.indexOf('aria-label="Einstellungen"'),
    'SD Rahmen: bei offenem Panel bleibt der Live-Bereich gerendert (O1); das Panel steht daneben',
  );
  ok(!zu.includes('aria-label="Einstellungen"') && zu.includes('data-stage="live"'), 'SD Rahmen: das Panel ist beim Start zu');
  const ober = QUELLE('views/StageOberflaeche.tsx');
  ok(
    ober.includes('settingsOpen={panelOffen}') && ober.includes('useState(anfangOffen)') && !ober.includes('localStorage'),
    'SD Rahmen: der Panelzustand ist ein lokaler useState (zu beim Start, nichts gemerkt)',
  );
  ok(
    ober.includes('useBrueckenWert(MASTER_LINK_QUELLE)') && ober.includes('useBrueckenWert(AUSGABE_QUELLE)') && ober.includes('status={statusLeiste(stand)}') && !ober.includes('onAir'),
    'SD Rahmen: Brücken und Statusleiste laufen in der View, auch bei geschlossenem Panel; kein onAir',
  );
  ok(ober.includes('tool="Stage Display"') && !ober.includes('tool="JM'), 'SD Rahmen: tool ohne „JM “ (der Kopf ergänzt es)');
}

// ── SD Rahmen: die Bildschirmliste kommt in der View, beim Start und beim Öffnen; ein Fehler setzt auf unbekannt ──
{
  const ober = QUELLE('views/StageOberflaeche.tsx');
  ok(ober.includes('output.displays()') && ober.includes('[panelOffen]'), 'SD Rahmen: die Bildschirmliste wird in der View geholt, beim Start und bei jedem Öffnen des Panels');
  ok(/\(\) => \{\s*if \(!weg\) setBildschirme\(undefined\);/.test(ober), 'SD Rahmen: bei einem Fehler der Abfrage fällt die Liste auf „nicht geladen“ zurück (undefined), nie die alte Liste');
  ok(ober.includes("if (gestartet.current && !panelOffen) return;"), 'SD Rahmen: beim Schließen des Panels wird nicht neu geholt');
}

// ── SD Ausgabe unberührt (E6) ──
{
  const roh = leseText('src/renderer/src/views/StageOutputView.tsx');
  ok(!/@jm\/settings/.test(roh) && !/AppShell/.test(roh), 'SD Ausgabe unberührt: views/StageOutputView.tsx importiert weder @jm/settings noch AppShell');
  const main = QUELLE('main.tsx');
  ok(main.includes("'#output'") && main.includes('<StageOutputView />') && main.includes('<App />'), 'SD Ausgabe unberührt: #output zeigt weiter die StageOutputView, sonst die App');
  ok(!leseText('src/renderer/src/App.tsx').includes('OperatorView') && QUELLE('App.tsx').includes('<StageOberflaeche />'), 'SD Ausgabe unberührt: die App zeigt die neue Oberfläche, die alte OperatorView ist weg');
}

// ── SD keine rohen Farben ──
{
  const dateien = ['views/StageOberflaeche.tsx', 'views/Einstellungen.tsx', 'views/LiveBereich.tsx', 'lib/aktionen.ts', 'App.tsx'];
  // Rohe Tailwind-Farbklassen und Hex-Werte; components/StageScreen.tsx und views/StageOutputView.tsx sind Programmflächen und bleiben.
  const roh = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow)-(?:white|black|neutral|gray|grey|zinc|slate|stone|red|green|blue|yellow|amber|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b|#[0-9a-fA-F]{3,8}\b/;
  gleich(dateien.filter((d) => roh.test(QUELLE(d))), [], 'SD keine rohen Farben: keine rohen Farbklassen und Hex-Werte in den geänderten Dateien, nur Tokens');
}

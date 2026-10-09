// Task 23 · Galerie (Spec 3.10): jeder Baustein in jedem Zustand, jeder Abschnitt in seinen Zuständen, beide Modi,
// der Rahmen in 1200 und 800 px. Dazu die Klassen-Probe gegen ein Stück echtes, minifiziertes CSS: Die volle Probe
// braucht `vite build` und läuft deshalb nur lokal (E21); hier wird geprüft, dass sie Fehlendes überhaupt erkennt.
import { readdirSync } from 'node:fs';
import type { StatusState } from '../src/lib/status';
import { UI_TEXTE } from '../src/lib/texte';
import { Galerie, RAHMEN_ANSICHTEN } from '../galerie/Galerie';
import { haltenProbeZustand, uiBeispiele } from '../galerie/beispiele-ui';
import { settingsBeispiele } from '../galerie/beispiele-settings';
import { leseShellParameter, shellAdresse, ShellSeite, type ShellParameter } from '../galerie/ShellSeite';
import {
  classNameLiterale,
  hatBewegungAbfrage,
  hatKlasse,
  hatKompaktRegel,
  hatSchmalAbfrage,
  hatToken,
  NEUE_TOKENS,
  PFLICHTKLASSEN,
} from '../galerie/pruefe-klassen';
import { enthaelt, enthaeltNicht, gleich, leseText, ok, pruefeIdVerweise, render } from './harness';

// ── Vollständigkeit: diese Namen muss jede Spalte zeigen (Liste unabhängig vom Galerie-Code) ──
const UI_NAMEN = [
  'farben', 'auswahl', 'groessen', 'groessen-kompakt',
  'statuspill-ok', 'statuspill-warn', 'statuspill-error', 'statuspill-off', 'statuspill-live',
  'statusbar-gemischt', 'statusbar-knoepfe', 'statusbar-leer',
  'tally-bereit', 'tally-live', 'tally-live-gesperrt', 'tally-gesperrt', 'tally-gesperrt-ohne-grund', 'tally-halten',
  'eingabe-text', 'eingabe-text-fehler', 'eingabe-text-gesperrt', 'eingabe-zahl', 'eingabe-zahl-einheit',
  'eingabe-zahl-ohne-feld', 'eingabe-schalter', 'eingabe-schalter-gesperrt', 'eingabe-auswahl', 'eingabe-auswahl-leer',
  'eingabe-auswahl-fehlt', 'eingabe-auswahl-fehler', 'eingabe-auswahl-gesperrt',
  'theme',
  'panel',
  'kopf-live', 'kopf-bereit', 'kopf-mac', 'kopf-panel-offen',
];

// Erwarteter Zustand der Statuspille je Abschnitts-Beispiel (Regeln aus Task 17–22). „unbekannt“ ist off.
const SETTINGS_SOLL: Record<string, Exclude<StatusState, 'live'>> = {
  'ndi-ok': 'ok', 'ndi-warn': 'warn', 'ndi-startet': 'warn', 'ndi-error': 'error', 'ndi-aus': 'off',
  'ndi-ohne-name': 'off', 'ndi-gesperrt': 'ok', 'ndi-fehlertext': 'error',
  'bildschirm-ok': 'ok', 'bildschirm-warn': 'warn', 'bildschirm-error': 'error', 'bildschirm-unbekannt': 'off',
  'bildschirm-aus': 'off', 'bildschirm-keiner': 'off', 'bildschirm-gesperrt': 'ok', 'bildschirm-fehlertext': 'error',
  'fernsteuerung-ok': 'ok', 'fernsteuerung-warn': 'warn', 'fernsteuerung-error': 'error',
  'fernsteuerung-unbekannt': 'off', 'fernsteuerung-aus': 'off', 'fernsteuerung-gesperrt': 'ok',
  'fernsteuerung-fehlertext': 'error', 'fernsteuerung-launcher-gesichert': 'ok',
  'fernsteuerung-launcher-unvollstaendig': 'warn', 'fernsteuerung-launcher-offen': 'ok',
  'fernsteuerung-launcher-unbekannt': 'off',
  'audio-ok': 'ok', 'audio-warn': 'warn', 'audio-error': 'error', 'audio-unbekannt': 'off',
  'audio-drei-wahlen': 'error', 'audio-leer': 'off', 'audio-gesperrt': 'ok', 'audio-fehlertext': 'error',
  'iveo-ok': 'ok', 'iveo-warn': 'warn', 'iveo-aus': 'off', 'iveo-unbekannt': 'off', 'iveo-gesperrt': 'ok',
  'iveo-fehlertext': 'error',
  'datalink-ok': 'ok', 'datalink-warn': 'warn', 'datalink-error': 'error', 'datalink-unbekannt': 'off',
  'datalink-aus': 'off', 'datalink-gesperrt': 'ok', 'datalink-fehlertext': 'error',
  'gegenstellen-ok': 'ok', 'gegenstellen-warn': 'warn', 'gegenstellen-unbekannt': 'off', 'gegenstellen-aus': 'off',
  'gegenstellen-schalter': 'ok', 'gegenstellen-gesperrt': 'ok', 'gegenstellen-fehlertext': 'error',
};
const ABSCHNITTE = ['ndi', 'bildschirm', 'fernsteuerung', 'audio', 'iveo', 'datalink', 'gegenstellen'];

// Was jedes UI-Beispiel sichtbar machen muss (Texte aus UI_TEXTE, Pflichtklassen aus 9.7).
const UI_PRUEFUNG: Record<string, string[]> = {
  'statuspill-ok': ['data-state="ok"'],
  'statuspill-warn': ['data-state="warn"'],
  'statuspill-error': ['data-state="error"'],
  'statuspill-off': ['data-state="off"'],
  'statuspill-live': ['data-state="live"'],
  'statusbar-gemischt': ['role="status"', 'h-[var(--statusbar-h)]'],
  'statusbar-knoepfe': ['<button', UI_TEXTE.statusOeffnen('NDI')],
  'statusbar-leer': ['role="status"', 'tabular'],
  // „Take-Klicks: 0“: eigener Zähler des reinen Klick-Knopfs „Take“, Messgerät für Owner-Prüfpunkt 7 (Take ziehen).
  'tally-bereit': ['border-[var(--tally-ready)]', 'min-h-[var(--control-h-lg)]', '>Take<', 'Take-Klicks: 0'],
  'tally-live': [UI_TEXTE.live, 'text-[19px]'],
  // Owner-Entscheid O2 (09.10.2026): auf Sendung und gesperrt – LIVE-Fläche und Kennung bleiben, dazu Sperre und Grund.
  'tally-live-gesperrt': ['data-state="live"', `>${UI_TEXTE.live}<`, 'text-[19px]', 'aria-disabled="true"', UI_TEXTE.gesperrt('Während der Überblendung gesperrt')],
  'tally-gesperrt': ['aria-disabled="true"', 'Nur im Live-Modus'],
  'tally-gesperrt-ohne-grund': ['aria-disabled="true"', UI_TEXTE.gesperrtOhneGrund],
  'tally-halten': ['in 2 s sperren (dabei halten)', 'in 2 s live sperren (dabei halten)', 'in 2 s ausblenden (dabei halten)', 'wieder einblenden', '>live + gesperrt<'],
  // Owner-Entscheid O3 (09.10.2026): --field-border ist freigegeben und hat eine Farbkachel.
  'farben': ['--field-border'],
  'eingabe-text-fehler': ['aria-invalid="true"'],
  'eingabe-text-gesperrt': ['disabled=""', UI_TEXTE.gesperrt('Vom Master vorgegeben')],
  'eingabe-zahl': ['Werte unter 1024 lehnt dieses Beispiel ab'],
  'eingabe-zahl-einheit': ['>s<'],
  'eingabe-schalter': ['role="switch"'],
  'eingabe-auswahl-leer': [UI_TEXTE.bitteWaehlen],
  'eingabe-auswahl-fehlt': [UI_TEXTE.nichtVerfuegbar('Shure MV7')],
  'eingabe-auswahl-fehler': ['aria-invalid="true"', 'Bitte einen Eingang wählen.'],
  'theme': [UI_TEXTE.themeUmschalten(UI_TEXTE.dunkel, UI_TEXTE.hell)],
  'panel': ['aria-label="Einstellungen"', 'data-hervorgehoben="true"'],
  'kopf-live': [UI_TEXTE.onAir, 'h-[var(--header-h)]', 'pl-4'],
  'kopf-bereit': [UI_TEXTE.bereit],
  'kopf-mac': ['pl-20'],
  'kopf-panel-offen': ['aria-expanded="true"', 'AUFNAHME'],
};

/** Erste Statuspille im HTML (Toggle nutzt data-state="an|aus" und zählt nicht). */
function ersterZustand(html: string): string | undefined {
  return /data-state="(ok|warn|error|off|live)"/.exec(html)?.[1];
}

// ── Inhalt der Galerie ──
{
  for (const modus of ['dark', 'light'] as const) {
    gleich(uiBeispiele(modus).map((b) => b.name), UI_NAMEN, `Galerie ${modus}: alle ${UI_NAMEN.length} Baustein-Beispiele`);
    gleich(
      settingsBeispiele(modus).map((b) => b.name).sort(),
      Object.keys(SETTINGS_SOLL).sort(),
      `Galerie ${modus}: alle ${Object.keys(SETTINGS_SOLL).length} Abschnitts-Beispiele`,
    );
  }
  for (const a of ABSCHNITTE) {
    const namen = Object.keys(SETTINGS_SOLL).filter((n) => n.startsWith(`${a}-`));
    const zustaende = new Set(namen.map((n) => SETTINGS_SOLL[n]));
    ok(
      ['ok', 'warn', 'error', 'off'].every((z) => zustaende.has(z as 'ok')) &&
        namen.includes(`${a}-gesperrt`) &&
        namen.includes(`${a}-fehlertext`) &&
        (a === 'ndi' || namen.includes(`${a}-unbekannt`)),
      `Galerie: Abschnitt ${a} zeigt ok, Warnung, Fehler, aus/unbekannt, gesperrt und Fehlertext`,
    );
  }

  for (const b of settingsBeispiele('dark')) {
    const html = render(b.element);
    const soll = SETTINGS_SOLL[b.name];
    const zusatz = b.name.endsWith('-unbekannt')
      ? html.includes('unbekannt')
      : b.name.endsWith('-gesperrt')
        ? html.includes('Gesperrt: ')
        : b.name.endsWith('-fehlertext')
          ? html.includes('data-fehler="true"') && html.includes('Fehler: ')
          : true;
    ok(ersterZustand(html) === soll && zusatz, `Abschnitts-Beispiel ${b.name}: Statuspille ${soll}`);
  }
  enthaelt(
    render(settingsBeispiele('dark').find((b) => b.name === 'fernsteuerung-launcher-gesichert')!.element),
    '0000-0000-0000-0000',
    'Launcher-Vollform: das frisch erzeugte Beispiel-Token ist sichtbar',
  );
  const dreiWahlen = render(settingsBeispiele('dark').find((b) => b.name === 'audio-drei-wahlen')!.element);
  ok((dreiWahlen.match(/>Pegel: /g) ?? []).length === 3, 'Abschnitts-Beispiel audio-drei-wahlen: Pegel je Wahl, auch für den Ausgang (E26)');

  enthaeltNicht(
    render(settingsBeispiele('dark').find((b) => b.name === 'audio-leer')!.element),
    '>System-Standard<',
    'Abschnitts-Beispiel audio-leer: Pille „aus“ und Auswahl widersprechen sich nicht (kein gewählter System-Standard)',
  );

  for (const b of uiBeispiele('dark')) {
    const pruefung = UI_PRUEFUNG[b.name];
    if (!pruefung) continue;
    const html = render(b.element);
    const fehlt = pruefung.filter((teil) => !html.includes(teil));
    ok(fehlt.length === 0, `Baustein-Beispiel ${b.name}: ${pruefung.join(' · ')}`);
  }
  // Owner-Prüfpunkt 7 (Take ziehen) misst nur am reinen Klick-Knopf: Ohne Halten setzt TallyButton keinen Pointer Capture
  // (Ruling T9). Darum übergibt der Baustein mit dem Take-Zähler weder onPress noch onRelease.
  const takeProbe = leseText('galerie/beispiele-ui.tsx')
    .split(/\n(?=function |export function )/)
    .filter((teil) => teil.includes('Take-Klicks'));
  ok(
    takeProbe.length === 1 && takeProbe[0].includes('onClick=') && !/onPress|onRelease/.test(takeProbe[0]),
    'Galerie Take-Zähler: genau ein Baustein zählt „Take-Klicks“, als reiner Klick-Knopf (onClick, ohne onPress/onRelease)',
  );
  // „Auf Sendung und gesperrt“ (O2) in beiden Modi, nicht nur in der dunklen Spalte.
  for (const modus of ['dark', 'light'] as const) {
    const beispiel = uiBeispiele(modus).find((b) => b.name === 'tally-live-gesperrt');
    const marken = UI_PRUEFUNG['tally-live-gesperrt'];
    const fehlt = beispiel ? marken.filter((teil) => !render(beispiel.element).includes(teil)) : marken;
    ok(fehlt.length === 0, `Galerie ${modus}: Beispiel „auf Sendung und gesperrt“ – LIVE-Fläche, Kennung, Sperre und Grund`);
  }
  // HaltenProbe: Der Grund geht nur bei „gesperrt“ und „live + gesperrt“ an den Knopf; sonst wäre „live“ seit O2 gesperrt.
  gleich(
    (['bereit', 'live', 'gesperrt', 'live-gesperrt'] as const).map((wahl) => haltenProbeZustand(wahl)),
    [
      { state: 'bereit' },
      { state: 'live' },
      { state: 'gesperrt', disabledReason: 'Zum Ausprobieren gesperrt' },
      { state: 'live', disabledReason: 'Zum Ausprobieren gesperrt' },
    ],
    'Galerie HaltenProbe: Grund nur bei „gesperrt“ und „live + gesperrt“',
  );
  const panel = render(uiBeispiele('light').find((b) => b.name === 'panel')!.element);
  ok((panel.match(/data-hervorgehoben="true"/g) ?? []).length === 1, 'Panel-Beispiel: genau ein Anker hervorgehoben');

  const html = render(<Galerie />);
  ok(/data-modus="dark"[^>]*class="dark /.test(html) && /data-modus="light"[^>]*class="light /.test(html), 'Galerie: zwei Spalten, .dark und .light');
  const alle = [...UI_NAMEN, ...Object.keys(SETTINGS_SOLL)];
  const nichtZweimal = alle.filter((n) => html.split(`data-beispiel="${n}"`).length - 1 !== 2);
  gleich(nichtZweimal, [], `Galerie: jedes der ${alle.length} Beispiele genau einmal je Spalte`);
  pruefeIdVerweise(html, 'Galerie: alle id-Verweise (for, aria-describedby, aria-controls) gültig');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  gleich(ids.filter((id, i) => ids.indexOf(id) !== i), [], 'Galerie: keine id doppelt (Anker beider Spalten getrennt)');
  for (const r of RAHMEN_ANSICHTEN) {
    enthaelt(html, `src="${shellAdresse(r.parameter).replace(/&/g, '&amp;')}" width="${r.breite}"`, `Galerie: Rahmen ${r.titel}`);
  }
  gleich(
    RAHMEN_ANSICHTEN.map((r) => `${r.breite}:${r.parameter.modus}:${r.parameter.sitzung ? 'sitzung' : 'ohne'}`).sort(),
    ['1200:dark:ohne', '1200:dark:sitzung', '1200:light:sitzung', '800:dark:sitzung', '800:light:sitzung'],
    'Galerie: Rahmen in 1200 px und 800 px (schmal), je Dunkel und Hell, dazu der Rahmen ohne Sitzung',
  );
}

// ── Rahmen-Seite (AppShell fensterfüllend, für die iframes) ──
{
  gleich(
    leseShellParameter(new URLSearchParams('?ansicht=shell&modus=light&panel=1&dichte=kompakt&sitzung=0')),
    { modus: 'light', panel: true, dichte: 'kompakt', sitzung: false },
    'ShellSeite: Parameter lesen',
  );
  gleich(
    leseShellParameter(new URLSearchParams('?modus=blau&panel=ja&dichte=eng&sitzung=nein')),
    { modus: 'dark', panel: false, dichte: 'normal', sitzung: true },
    'ShellSeite: fremde Werte → Dunkel, Panel zu, normal, mit Sitzung',
  );
  const kombis: ShellParameter[] = [];
  for (const modus of ['dark', 'light'] as const)
    for (const panel of [false, true])
      for (const dichte of ['normal', 'kompakt'] as const)
        for (const sitzung of [false, true]) kombis.push({ modus, panel, dichte, sitzung });
  ok(
    kombis.every((k) => JSON.stringify(leseShellParameter(new URLSearchParams(shellAdresse(k)))) === JSON.stringify(k)),
    'ShellSeite: shellAdresse und leseShellParameter passen für alle 16 Kombinationen zusammen',
  );
  const offen = render(<ShellSeite modus="light" panel dichte="kompakt" sitzung />);
  ok(
    offen.startsWith('<div class="light ') &&
      offen.includes('data-dichte="kompakt"') &&
      offen.includes('aria-label="Einstellungen"') &&
      offen.includes('data-hervorgehoben="true"'),
    'ShellSeite hell, Panel offen, kompakt: Klasse light, data-dichte, Panel mit hervorgehobenem Abschnitt',
  );
  ok(/<input[^>]*inputMode="numeric"/i.test(offen) || /<input[^>]*inputmode="numeric"/.test(offen), 'ShellSeite, Panel offen: Zahlenfeld im Panel (Escape-Kette des NumberInput prüfbar)');
  enthaelt(offen, `aria-label="${UI_TEXTE.statusOeffnen('Companion')}"`, 'ShellSeite: Statuseintrag öffnet seinen Abschnitt');
  const zu = render(<ShellSeite modus="dark" panel={false} dichte="normal" sitzung />);
  ok(zu.startsWith('<div class="dark ') && !zu.includes('aria-label="Einstellungen"'), 'ShellSeite dunkel, Panel zu: kein Panel');
  const ohneSitzung = render(<ShellSeite modus="dark" panel dichte="normal" sitzung={false} />);
  ok(
    ohneSitzung.includes('data-uhr') &&
      !ohneSitzung.includes('data-status-id') &&
      !ohneSitzung.includes('data-zahnrad') &&
      !ohneSitzung.includes('aria-label="Einstellungen"'),
    'ShellSeite ohne Sitzung: leere Statusleiste mit Uhr, kein ⚙, kein Panel (Spec 3.8)',
  );
}

// ── Klassen-Probe: erkennt sie Vorhandenes und Fehlendes? (Ausschnitt aus dem gemessenen Galerie-CSS) ──
{
  const css = String.raw`:root,.dark{--tally-live:oklch(62% .23 27);--surface-raised:oklch(25% 0 0)}.h-\[var\(--control-h-lg\)\]{height:var(--control-h-lg)}.h-\[var\(--statusbar-h\)\]{height:var(--statusbar-h)}@media not all and (min-width:900px){.max-\[900px\]\:sr-only{clip-path:inset(50%);white-space:nowrap;border-width:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}}:where(.space-y-2\.5>:not(:last-child)){margin-block-end:0}`;
  ok(hatKlasse(css, 'h-[var(--statusbar-h)]'), 'Probe: findet eine escapte Arbiträrklasse');
  ok(hatKlasse(css, 'max-[900px]:sr-only'), 'Probe: findet eine Klasse mit Variante');
  ok(hatKlasse(css, 'space-y-2.5'), 'Probe: findet eine Klasse in :where(…)');
  ok(!hatKlasse(css, 'h-[var(--control-h)]'), 'Probe: h-[var(--control-h-lg)] zählt nicht als h-[var(--control-h)]');
  ok(!hatKlasse(css, 'h-[var(--header-h)]'), 'Probe: fehlende Klasse wird erkannt');
  ok(hatToken(css, '--tally-live') && !hatToken(css, '--statusbar-h'), 'Probe: Token nur als Definition, nicht als var()');
  ok(
    hatSchmalAbfrage(css) && hatSchmalAbfrage('@media (width < 900px){}') && !hatSchmalAbfrage('@media (width < 1200px){}') && !hatBewegungAbfrage(css),
    'Probe: Medienabfrage schmal (minifiziert und unminifiziert) und motion-safe getrennt erkannt',
  );
  ok(
    hatKompaktRegel('[data-dichte=kompakt]{--header-h:36px}') &&
      hatKompaktRegel('[data-dichte="kompakt"] {\n  --header-h: 36px;\n}') &&
      !hatKompaktRegel('[data-dichte="normal"] {}'),
    'Probe: Dichte-Regel minifiziert (Galerie) und unminifiziert (electron-vite) erkannt',
  );
  gleich(
    classNameLiterale('<b className="a b-[x] group" /><i className={cn("c")} />'),
    ['a', 'b-[x]', 'group'],
    'Probe: classNameLiterale liest nur className="…"',
  );
  ok(
    NEUE_TOKENS.length === 13 && NEUE_TOKENS.includes('--field-border') && PFLICHTKLASSEN.length === 13,
    'Probe: 13 Token-Namen (mit --field-border, Owner-Freigabe O3) und 13 Pflichtklassen',
  );
}

// ── Quellregeln der Galerie (statisch, laufen in der CI) ──
{
  const galerieCss = leseText('galerie/galerie.css');
  ok(
    galerieCss.includes('@source "../src";') &&
      galerieCss.includes('@source "../../settings/src";') &&
      galerieCss.includes('@source not "./pruefe-klassen.ts";'),
    'galerie.css: @source auf beide Pakete, Klassen-Probe vom Scan ausgenommen',
  );
  ok(/body\s*\{\s*overflow:\s*auto;\s*\}/.test(galerieCss), 'galerie.css: body scrollt (base.css sperrt das Scrollen)');
  const vite = leseText('vite.config.ts');
  ok(
    vite.includes("host: '127.0.0.1'") && vite.includes('port: 5199') && vite.includes('strictPort: true') && !vite.includes('host: true'),
    'vite.config.ts: nur 127.0.0.1:5199, strictPort',
  );
  const treffer: string[] = [];
  for (const datei of readdirSync('galerie')) {
    if (datei === 'pruefe-klassen.ts' || !/\.(tsx?|html|css)$/.test(datei)) continue;
    const text = leseText(`galerie/${datei}`);
    for (const k of [...PFLICHTKLASSEN, 'motion-safe']) if (text.includes(k)) treffer.push(`${datei}: ${k}`);
  }
  gleich(treffer, [], 'Galerie-Quelltext ohne Pflichtklassen (sonst verdeckte er ein fehlendes @source "../src")');
  enthaeltNicht(leseText('galerie/main.tsx'), 'electron', 'Galerie: kein Electron');
}

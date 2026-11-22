// UX Welle 1, Rundown d · Rahmen (Spec 3.1–3.3, 3.8, 5.1; E11, E17): AppShell mit Kopf „JM Rundown“, ⚙, ThemeToggle, V-Zeile in der
// Kopfmitte, die Datei-Leiste in der Werkzeugleiste, der Transport unter der Liste und der RowEditor mit unverändertem key.
// Render ohne Browser und ohne window (der Stand kommt als Prop).
import { enthaeltNicht, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { RUNDOWN_TEXTE } from '@/lib/oberflaeche';
import { KopfMitte } from '@/views/KopfMitte';
import { RundownOberflaeche, type RundownViewAktionen } from '@/views/RundownOberflaeche';
import { Werkzeugleiste } from '@/views/Werkzeugleiste';
import { basisState, zeile, attr, bereich, ohneKommentare, statusEintraege, tags, text } from './testzustand';

const KEINE: RundownViewAktionen = {
  nav() {},
  setDoc() {},
  neu() {},
  oeffnen() {},
  regieplan() {},
  exportieren() {},
  speichern() {},
  speichernUnter() {},
  setEndpoint() {},
  hinweisWeg() {},
  alsEigeneZeile() {},
};
const T = RUNDOWN_TEXTE;
const DATEI = { ...KEINE, umbenennen() {} };
const mitZeilen = basisState({ doc: { schemaVersion: 2, name: 'Mein Ablauf', rows: [zeile('a'), zeile('b'), zeile('c')] }, index: 1 });
const seite = (state = mitZeilen, anfangOffen = false): string => render(<RundownOberflaeche state={state} notice={null} aktionen={KEINE} anfangOffen={anfangOffen} />);

// ── RD Rahmen: Kopf, ⚙, ThemeToggle, Statusleiste ──
{
  const html = seite();
  const [zahnrad] = tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
  const [thema] = tags(html, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
  ok(text(html).includes('JM Rundown') && html.includes('data-bereich="inhalt"'), 'RD Rahmen: AppShell mit Kopf „JM Rundown“ (die alte Kopfzeile ist weg)');
  gleich(
    [attr(thema, 'aria-label'), attr(zahnrad, 'aria-label'), attr(zahnrad, 'aria-expanded')],
    ['Darstellung: Dunkel. Umschalten auf Hell', 'Einstellungen öffnen', 'false'],
    'RD Rahmen: ThemeToggle (E17) und ⚙ „Einstellungen öffnen“ im Kopf, Panel beim Start zu',
  );
  gleich(
    statusEintraege(html),
    [
      ['master-link', 'off', 'Master: unbekannt'],
      ['iveo', 'off', 'iveo: Keine Show · nicht eingerichtet'],
      ['fernsteuerung', 'off', 'Fernsteuerung: unbekannt'],
    ],
    'RD Rahmen: Statusleiste vor der ersten Antwort (Master, iveo, Fernsteuerung) ist unbekannt bzw. aus, nie ok',
  );
  enthaeltNicht(html, 'data-onair', 'RD Rahmen: kein On-Air im Kopf (E8: der Rundown hat keins)');
  enthaeltNicht(html, 'Verbindungen …', 'RD Rahmen: der Knopf „Verbindungen …“ der alten Statusleiste ist weg (Panel-Abschnitt Gegenstellen)');
  pruefeIdVerweise(html, 'RD Rahmen: id-Verweise im ganzen Bedienfenster gültig');
  const offen = seite(mitZeilen, true);
  ok(offen.includes('aria-label="Einstellungen"') && !html.includes('aria-label="Einstellungen"'), 'RD Rahmen: das Panel ist beim Start zu und öffnet über den Anfangszustand');
}

// ── RD Rahmen: Gegenstellen als Statuseinträge (E11) ──
{
  const link = { role: 'switcher', label: 'JM Switcher', host: '10.0.0.7', port: 8721, connected: true, source: 'mdns' as const, state: null };
  const ids = statusEintraege(seite(basisState({ links: [link] }))).map((e) => e[0]);
  gleich(ids, ['master-link', 'iveo', 'link-switcher', 'fernsteuerung'], 'RD Rahmen: je Gegenstelle ein Statuseintrag link-<rolle> zwischen iveo und Fernsteuerung (ToolLinks geht darin auf)');
}

// ── RD Rahmen: V-Zeile in der Kopfmitte ──
{
  const faelle = [
    ['gruen', 'ok'],
    ['gelb', 'warn'],
    ['rot', 'error'],
    ['gedaempft', 'off'],
  ] as const;
  const ist = faelle.map(([farbe]) => {
    const html = render(<KopfMitte anzeige={{ text: `V-Zeile ${farbe}`, farbe }} />);
    const pille = tags(html, 'span').find((t) => attr(t, 'data-state') !== undefined);
    return [attr(pille, 'data-state'), attr(pille, 'title'), text(html).includes(`V-Zeile ${farbe}`)];
  });
  gleich(ist, faelle.map(([farbe, zustand]) => [zustand, `V-Zeile ${farbe}`, true]), 'RD Rahmen: V-Zeile in der Kopfmitte: gruen/gelb/rot/gedaempft → StatusPill ok/warn/error/off mit Text und Tooltip');
  gleich([render(<KopfMitte anzeige={null} />), render(<KopfMitte anzeige={undefined} />)].map((h) => h.includes('data-state')), [false, false], 'RD Rahmen: ohne V-Zeile (Einzelplatz, Brücke offen) keine Pille');
  const quelle = ohneKommentare(leseText('src/renderer/src/views/KopfMitte.tsx'));
  ok(!/\bwindow\b/.test(quelle), 'RD Rahmen: KopfMitte liest kein window');
  const ober = ohneKommentare(leseText('src/renderer/src/views/RundownOberflaeche.tsx'));
  ok(ober.includes('useBrueckenWert(VERBUND_QUELLE)') && ober.includes('headerCenter={<KopfMitte'), 'RD Rahmen: die V-Zeile kommt über VERBUND_QUELLE in headerCenter');
}

// ── RD Werkzeugleiste Datei ──
{
  const html = seite();
  const leiste = html.slice(html.indexOf('data-bereich="toolbar"'), html.indexOf('data-bereich="inhalt"'));
  const knoepfe = tags(leiste, 'button');
  const beschriftung = [...leiste.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]));
  gleich(
    beschriftung,
    [T.datei.neu, T.datei.oeffnen, T.datei.regieplan, T.datei.exportieren, T.datei.speichern, T.datei.speichernUnter],
    'RD Werkzeugleiste Datei: Neu, Öffnen, Regieplan…, Export…, Speichern, Speichern unter … in der Werkzeugleiste des AppShell, in dieser Reihenfolge',
  );
  gleich(knoepfe.map((t) => attr(t, 'title')), [undefined, undefined, T.datei.regieplanTitel, T.datei.exportierenTitel, undefined, undefined], 'RD Werkzeugleiste Datei: die Tooltips von Regieplan… und Export… bleiben wörtlich');
  const feld = tags(leiste, 'input')[0];
  gleich([attr(feld, 'value'), attr(feld, 'aria-label')], ['Mein Ablauf', T.datei.namensfeld], 'RD Werkzeugleiste Datei: das Namensfeld zeigt den Namen des Ablaufs');
  const quelle = ohneKommentare(leseText('src/renderer/src/views/Werkzeugleiste.tsx'));
  ok(
    quelle.includes('key={`${state.doc.name}|${state.filePath ?? \'\'}|${state.abweisungen}`}') && quelle.includes('defaultValue={state.doc.name}') && quelle.includes('onBlur='),
    'RD Werkzeugleiste Datei: das Namensfeld behält seinen key (Name, Datei, Abweisungen) und bleibt ungesteuert mit Speichern bei onBlur',
  );
  const dirty = (d: boolean): string => text(render(<Werkzeugleiste state={basisState({ dirty: d })} notice={null} aktionen={DATEI} />));
  ok(dirty(true).includes(T.datei.ungespeichert) && !dirty(false).includes(T.datei.ungespeichert), 'RD Werkzeugleiste Datei: „• ungespeichert“ steht nur bei dirty');
  ok(text(render(<Werkzeugleiste state={basisState()} notice="Import fertig" aktionen={DATEI} />)).includes('Import fertig'), 'RD Werkzeugleiste Datei: die kurze Rückmeldung (Import, Export) steht weiter neben dem Namen');
  const log: string[] = [];
  const a = { ...DATEI, neu: () => void log.push('neu'), oeffnen: () => void log.push('oeffnen'), regieplan: () => void log.push('regieplan'), exportieren: () => void log.push('exportieren'), speichern: () => void log.push('speichern'), speichernUnter: () => void log.push('speichernUnter') };
  const roh = Werkzeugleiste({ state: basisState(), notice: null, aktionen: a });
  const klicks: Array<() => void> = [];
  const sammle = (n: unknown): void => {
    if (Array.isArray(n)) n.forEach(sammle);
    else if (n && typeof n === 'object' && 'props' in n) {
      const p = (n as { props: { onClick?: () => void; children?: unknown } }).props;
      if (p.onClick) klicks.push(p.onClick);
      sammle(p.children);
    }
  };
  sammle(roh);
  klicks.forEach((k) => k());
  gleich(log, ['neu', 'oeffnen', 'regieplan', 'exportieren', 'speichern', 'speichernUnter'], 'RD Werkzeugleiste Datei: jeder Knopf ruft seine Aktion (die Abläufe liegen in App.tsx)');
}

// ── RD Transport unter der Liste (E11) ──
{
  const html = seite();
  const links = bereich(html, 'spalte-liste');
  const editor = bereich(html, 'spalte-editor');
  ok(links.includes('data-rundown="transport"') && !editor.includes('data-rundown="transport"'), 'RD Transport unter der Liste: der Transport steht in der linken Spalte, nicht in der Editor-Spalte');
  ok(
    links.indexOf('data-rundown="liste"') >= 0 && links.indexOf('data-rundown="liste"') < links.indexOf('data-rundown="transport"'),
    'RD Transport unter der Liste: im Markup folgt der Transport auf die Liste',
  );
  const transport = bereich(html, 'transport');
  const t = text(transport);
  ok(t.includes(`${T.transport.scharf}Zeile b`) && t.includes('2 / 3'), 'RD Transport unter der Liste: die scharfe Zeile und der Zähler (2 / 3) stehen im Transport');
  const gefeuert = render(
    <RundownOberflaeche
      state={basisState({ ...mitZeilen, lastFired: { rowId: 'a', rowLabel: 'Zeile a', sent: [{ role: 'timer', line: 'timer start', delivered: true }, { role: 'titler', line: 'titler clear', delivered: false }] } })}
      notice={null}
      aktionen={KEINE}
    />,
  );
  const q = text(bereich(gefeuert, 'transport'));
  ok(q.includes(`${T.transport.zuletztGefeuert} Zeile a`) && q.includes('timer start') && q.includes('titler clear ⚠'), 'RD Transport unter der Liste: die Quittung nennt die zuletzt gefeuerte Zeile und je Aktion „zugestellt“ oder ⚠');
  ok(text(bereich(render(<RundownOberflaeche state={mitZeilen} notice={null} aktionen={KEINE} />), 'transport')).includes('2 / 3') && text(bereich(seite(basisState()), 'transport')).includes('0 / 0'), 'RD Transport unter der Liste: der Zähler zeigt 0 / 0 ohne Zeilen');
  // Wächter am Quelltext: Der Transport ist nicht mehr das letzte Kind über der Statusleiste (wie in App.tsx), sondern Teil der linken Spalte.
  const ober = ohneKommentare(leseText('src/renderer/src/views/RundownOberflaeche.tsx'));
  const app = ohneKommentare(leseText('src/renderer/src/App.tsx'));
  ok(
    ober.indexOf('<RundownList') > 0 && ober.indexOf('<Transport') > ober.indexOf('<RundownList') && ober.indexOf('<Transport') < ober.indexOf('<RowEditor') && !app.includes('<Transport'),
    'RD Transport unter der Liste: im Quelltext steht <Transport> nach der Liste und vor dem Editor; App.tsx setzt keinen Transport mehr unter den Inhalt',
  );
}

// ── RD RowEditor bleibt ──
{
  const ober = ohneKommentare(leseText('src/renderer/src/views/RundownOberflaeche.tsx'));
  const einst = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(ober.includes('key={`${selectedRow.id}:${state.abweisungen}`}'), 'RD RowEditor bleibt: der key des Editors (Zeilen-Id und Abweisungen) ist unverändert');
  ok(!einst.includes('RowEditor') && !einst.includes('RundownList'), 'RD RowEditor bleibt: der Editor und die Liste stehen nicht im Panel');
  const zu = seite();
  const offen = seite(mitZeilen, true);
  const editor = (h: string): string => bereich(h, 'spalte-editor');
  ok(editor(zu).includes('Zeilen-Titel') && editor(offen).includes('Zeilen-Titel'), 'RD RowEditor bleibt: der Editor ist mit zu- und mit aufgeklapptem Panel gerendert (er wird beim Öffnen nicht abgebaut)');
  ok(offen.indexOf('data-rundown="spalte-editor"') < offen.indexOf('aria-label="Einstellungen"'), 'RD RowEditor bleibt: das Panel steht neben dem Inhalt, der Editor steht davor');
  ok(editor(seite(basisState())).includes('Keine Zeile gewählt.') && !editor(seite(basisState())).includes('Zeilen-Titel'), 'RD RowEditor bleibt: ohne Zeile steht „Keine Zeile gewählt.“');
  ok(ober.includes('const aendere = (d: RundownDoc): void => aktionen.setDoc(d, state.rev)'), 'RD RowEditor bleibt: jede Bearbeitung läuft über aendere mit state.rev (5.5)');
}

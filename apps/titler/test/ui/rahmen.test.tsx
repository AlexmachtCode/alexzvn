// UX-Pilot C9 · Rahmen des Titlers (Spec 3.1–3.3, 3.8, 3.9, 5.1, 7, 8; E5, E11, E14, E15, E18, E20): AppShell mit
// Kopfzeile (V-Zeile in der Mitte, ON AIR, Hell/Dunkel, ⚙), Statusleiste aus lib/oberflaeche.ts und einem Panel, das beim
// Start zu ist. Render ohne Browser und ohne window: Die Brücken bleiben offen, der Master-Eintrag zeigt „unbekannt“.
import { enthaelt, enthaeltNicht, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { MasterLinkMeldungZeile, VerbundAnzeigeZeile } from '@shared/types';
import { MASTER_LINK_QUELLE, VERBUND_QUELLE } from '@/lib/bruecken';
import { Einstellungen } from '@/views/Einstellungen';
import { VerbundZeile } from '@/views/KopfMitte';
import { OperatorView } from '@/views/OperatorView';
import {
  attr,
  basisConfig,
  basisStand,
  basisStatus,
  mitStore,
  ohneKommentare,
  protokollAktionen,
  statusEintraege,
  tags,
  text,
} from './testzustand';

// ── Brücken-Quellen (lib/bruecken.ts) ──
{
  ok(typeof window === 'undefined', 'Rahmen: Der Testlauf hat kein window (wie der Server-Render)');
  let ergebnis: unknown;
  try {
    const antworten = [await MASTER_LINK_QUELLE.abfrage(), await VERBUND_QUELLE.abfrage()];
    let gemeldet = 0;
    const ab = [MASTER_LINK_QUELLE.ereignis(() => void gemeldet++), VERBUND_QUELLE.ereignis(() => void gemeldet++)];
    for (const f of ab) f();
    ergebnis = [antworten, ab.map((f) => typeof f), gemeldet];
  } catch (e) {
    ergebnis = String(e);
  }
  gleich(ergebnis, [[null, null], ['function', 'function'], 0], 'Brücken ohne window: Abfrage null, Ereignis gibt eine Abmeldung und meldet nichts (G7)');
}
{
  // Mit nachgestelltem Preload: Jede Quelle nimmt ihren eigenen Kanal (Abfrage und Ereignis), nie den der anderen.
  const log: string[] = [];
  const meldung: MasterLinkMeldungZeile = { art: 'verbunden', adresse: '10.0.0.5:8723', seit: 1, masterName: 'Regie-PC', suite: 's' };
  const zeile: VerbundAnzeigeZeile = { text: 'Show vom Master: Probe · Stand 09:05', farbe: 'gruen' };
  const g = globalThis as { window?: unknown };
  g.window = {
    jmtitler: {
      masterLink: async () => (log.push('masterLink'), meldung),
      onMasterLink: (cb: (m: MasterLinkMeldungZeile) => void) => (log.push('onMasterLink'), cb(meldung), () => void log.push('ab masterLink')),
      verbundAnzeige: async () => (log.push('verbundAnzeige'), zeile),
      onVerbundAnzeige: (cb: (a: VerbundAnzeigeZeile | null) => void) => (log.push('onVerbundAnzeige'), cb(zeile), () => void log.push('ab verbund')),
    },
  };
  try {
    const ereignisse: unknown[] = [];
    const ab1 = MASTER_LINK_QUELLE.ereignis((w) => void ereignisse.push(w));
    const ab2 = VERBUND_QUELLE.ereignis((w) => void ereignisse.push(w));
    const antworten = [await MASTER_LINK_QUELLE.abfrage(), await VERBUND_QUELLE.abfrage()];
    ab1();
    ab2();
    gleich(
      [log, ereignisse, antworten],
      [
        ['onMasterLink', 'onVerbundAnzeige', 'masterLink', 'verbundAnzeige', 'ab masterLink', 'ab verbund'],
        [meldung, zeile],
        [meldung, zeile],
      ],
      'Brücken mit Preload: MASTER_LINK_QUELLE nimmt masterLink/onMasterLink, VERBUND_QUELLE verbundAnzeige/onVerbundAnzeige',
    );
  } finally {
    delete g.window;
  }
}

// ── Kopfzeile Mitte (VerbundZeile, E18) ──
{
  const faelle = [
    ['gruen', 'ok'],
    ['gelb', 'warn'],
    ['rot', 'error'],
    ['gedaempft', 'off'],
  ] as const;
  const ist = faelle.map(([farbe]) => {
    const html = render(<VerbundZeile anzeige={{ text: `V-Zeile ${farbe}`, farbe }} />);
    const pille = tags(html, 'span').find((t) => attr(t, 'data-state') !== undefined);
    return [attr(pille, 'data-state'), attr(pille, 'title'), text(html).endsWith(`V-Zeile ${farbe}`)];
  });
  gleich(
    ist,
    faelle.map(([farbe, zustand]) => [zustand, `V-Zeile ${farbe}`, true]),
    'VerbundZeile: gruen/gelb/rot/gedaempft → StatusPill ok/warn/error/off mit Text und Tooltip (E18)',
  );
  gleich(
    [render(<VerbundZeile anzeige={null} />), render(<VerbundZeile anzeige={undefined} />)],
    ['', ''],
    'VerbundZeile: ohne V-Zeile (Einzelplatz, Brücke offen) nichts',
  );
  const alle = faelle.map(([farbe]) => render(<VerbundZeile anzeige={{ text: 'x', farbe }} />)).join('');
  ok(
    !/--warning|text-\[var\(--(success|destructive|warning)\)\]/.test(alle) && alle.includes('overflow-hidden'),
    'VerbundZeile: keine Statusfarbe auf Wörtern, kein Gelb --warning (Spec 4.2); die Hülle schneidet ab (overflow-hidden)',
  );
  const lang = 'Show vom Master: Jahresgala mit langem Namen · Stand 09:05';
  const kurz = render(<VerbundZeile anzeige={{ text: lang, farbe: 'gelb' }} />);
  const pille = tags(kurz, 'span').find((t) => attr(t, 'data-state') !== undefined);
  ok(
    kurz.includes(`<span class="min-w-0 truncate">${lang}</span>`) && (attr(pille, 'class') ?? '').includes('max-w-full') && attr(pille, 'title') === lang,
    'VerbundZeile: kürzt mit „…“ (truncate am Text, Pille höchstens so breit wie ihr Platz), der volle Text steht im Tooltip (2b-Spec 16.5, G4)',
  );
}

// ── Bedienfenster im Rahmen (Server-Render über den Anfangszustand des Stores) ──
{
  const html = mitStore({ config: basisConfig(), status: basisStatus() }, () => render(<OperatorView />));
  const [zahnrad] = tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
  const [thema] = tags(html, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
  ok(
    html.includes('data-bereich="inhalt"') && text(html).includes('JM Titler') && !html.includes('Live-CG') && !html.includes('JM TITLER'),
    'Rahmen: AppShell mit „JM Titler“, ohne alte Kopfzeile (kein „Live-CG → NDI“, E18)',
  );
  gleich(
    [attr(thema, 'aria-label'), attr(zahnrad, 'aria-label'), attr(zahnrad, 'aria-expanded')],
    ['Darstellung: Dunkel. Umschalten auf Hell', 'Einstellungen öffnen', 'false'],
    'Kopfzeile rechts: Hell/Dunkel (E15) und ⚙ „Einstellungen öffnen“',
  );
  ok(
    html.includes('data-onair="bereit"') && !html.includes('<aside') && !html.includes('role="tab"'),
    'Rahmen beim Start: ON AIR zeigt „bereit“ (E11), Panel zu (E14), keine Reiter mehr',
  );
  gleich(
    statusEintraege(html),
    [
      ['master-link', 'off', 'Master: unbekannt'],
      ['iveo', 'off', 'iveo: nicht eingerichtet'],
      ['ndi', 'off', 'NDI: aus'],
      ['bildschirm', 'off', 'Bildschirm: unbekannt'],
      ['fernsteuerung', 'off', 'Fernsteuerung: unbekannt'],
      ['datalink', 'off', 'DataLink: kein Ordner'],
    ],
    'Statusleiste im Rahmen: Reihenfolge E20; ohne Brücke, Monitorliste und Steuerserver-Meldung „unbekannt“, nie ok (Spec 7.2)',
  );
  enthaeltNicht(html, 'Suite getrennt', 'Rahmen: die alte Pille „Suite …“ ist weg (ersetzt durch Statusleiste › Fernsteuerung)');
  enthaeltNicht(html, 'NDI ·', 'Rahmen: die alte Pille „NDI · …“ ist weg (ersetzt durch Statusleiste › NDI)');
  const [vorschau] = tags(html, 'canvas');
  gleich([attr(vorschau, 'width'), attr(vorschau, 'height')], ['960', '540'], 'Rahmen: das erste <canvas> ist die CG-Vorschau 960×540 (R2-Durchgang)');
  pruefeIdVerweise(html, 'Rahmen: id-Verweise im Bedienfenster gültig');
}
{
  const html = mitStore(null, () => render(<OperatorView />));
  enthaelt(html, 'Lädt…', 'Rahmen: ohne Zustand weiter „Lädt…“ (Nr. 1 unverändert)');
}

// ── Panel-Inhalt (views/Einstellungen.tsx) ──
{
  const log: string[] = [];
  const stand = basisStand({
    status: basisStatus({
      datenQuelle: { art: 'show', zeile: 'Quelle: Show „Probe“ · 3 Speaker', zurueckKnopf: 'Zurück zum eigenen Ordner (Daten)', ohneOrdner: false },
    }),
  });
  const html = render(<Einstellungen stand={stand} aktionen={protokollAktionen(log)} />);
  ok(
    ['DataLink', 'iveo', 'Zurück zum eigenen Ordner (Daten)'].every((t) => text(html).includes(t)) && log.length === 0,
    'Panel-Inhalt: DataLink, iveo und K1 rendern ohne window; Rendern löst keine Aktion aus',
  );
  const quelle = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(!quelle.includes('window') && !quelle.includes('useEffect'), 'Panel-Inhalt: views/Einstellungen.tsx ohne window und ohne useEffect (G7, G8)');
}

// ── Quelltext ──
{
  const quelle = leseText('src/renderer/src/views/OperatorView.tsx');
  const fehlt = [
    'useBrueckenWert(MASTER_LINK_QUELLE)',
    'useBrueckenWert(VERBUND_QUELLE)',
    'headerCenter={<VerbundZeile anzeige={verbund} />}',
    'status={statusLeiste(stand)}',
    'useState<DisplayInfo[] | undefined>(undefined)',
    'window.jmtitler.remote.onCommand(',
    'window.jmtitler.onFileOpened(',
    'window.jmtitler.remote.reportState(',
    'window.jmtitler.listDisplays()',
    '.then(setDisplays, () => setDisplays(undefined))',
  ].filter((z) => !quelle.includes(z));
  ok(
    fehlt.length === 0,
    'Quelltext OperatorView: Brücken, Kopfmitte, Statusleiste, Monitorliste offen (auch nach einem Ladefehler, E8); die Effekte bleiben hier (G8)',
  );
  for (const z of fehlt) console.log(`     fehlt: ${z}`);
  // Was der Server-Render nicht zeigen kann (live = true, ein Klick auf ⚙, einen Statuseintrag oder einen Knopf im Panel),
  // hält der Quelltext fest (Review Focus 1 und 2).
  const onAir = ['const { live, take, clear } = useTitlerEngine(resolved, ndiActive, previewRef, { graphic });', 'onAir={{ live }}'].filter(
    (z) => !quelle.includes(z),
  );
  ok(onAir.length === 0, 'Quelltext OperatorView: ON AIR folgt nur der Engine-Größe live (E11; der Server-Render kennt nur live = false)');
  for (const z of onAir) console.log(`     fehlt: ${z}`);
  const panel = [
    'settingsOpen={panelOffen}',
    'settingsSection={panelAbschnitt}',
    'setPanelOffen(offen);',
    'setPanelAbschnitt(abschnitt);',
    'aktionen={aktionen}',
    'setConfig: (patch) => void setConfig(patch),',
    'startNdi: (name) => void startNdi(name),',
    'stopNdi: () => void stopNdi(),',
    'pickFolder: () => void pickFolder(),',
    'zurueckZumEigenenOrdner: () => void window.jmtitler.zurueckZumEigenenOrdner(),',
  ].filter((z) => !quelle.includes(z));
  ok(
    panel.length === 0,
    'Quelltext OperatorView: ⚙ und Statuseintrag öffnen das Panel am Abschnitt, die Aktionen des Panels gehen an Store und Preload (Review Focus 2)',
  );
  for (const z of panel) console.log(`     fehlt: ${z}`);
  const verboten = ['localStorage', 'titler.operator.tab', 'Tabs', 'VerbundAbzeichen', 'VERBUND_FARBE', 'suiteClients'].filter((z) =>
    quelle.includes(z),
  );
  ok(verboten.length === 0, 'Quelltext OperatorView: kein Reiter, kein localStorage, keine alte Kopfzeile (E14, E18)');
  for (const z of verboten) console.log(`     gefunden: ${z}`);
  const bruecken = ohneKommentare(leseText('src/renderer/src/lib/bruecken.ts'));
  ok(
    bruecken.includes("typeof window === 'undefined' ? undefined : window.jmtitler") && (bruecken.match(/window\.jmtitler/g) ?? []).length === 1,
    'Quelltext lib/bruecken.ts: window.jmtitler genau einmal, hinter dem typeof-Wächter (E5)',
  );
  const preload = leseText('src/preload/index.ts');
  ok(
    preload.includes("verbundAnzeige: () => (ipcRenderer.invoke('jmps:verbund-anzeige')") &&
      preload.includes('onVerbundAnzeige: (cb) => {') &&
      preload.includes('masterLink: ') &&
      preload.includes('onMasterLink: '),
    'Quelltext Preload: verbundAnzeige und onVerbundAnzeige (R2-Durchgang, G4) sowie masterLink und onMasterLink (S-A4) stehen da',
  );
}

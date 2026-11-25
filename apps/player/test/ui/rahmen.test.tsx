// UX Welle 2a, Player d1 · Rahmen (Spec 3.1, 3.8, 5.1, 5.3, 10; E4, E5, E6, E14, E15, E16; O1): AppShell mit Kopf „JM Player“,
// ⚙, ThemeToggle und Statusleiste; Bibliothek, Soundboard und Cue-Show als Tabs in der Werkzeugleiste; das Panel ist kein
// eigener Bildschirm (die gewählte Ansicht samt Transport bleibt gemountet, nichts Spielendes wird umgebaut); die Cue- und
// Pad-Dialoge laufen über Modal aus @jm/ui mit unverändertem Inhalt; die Ausgabeansicht bleibt unberührt; Tasten als
// Wächter. Render ohne Browser und ohne window.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { padsAbonnieren } from '@/lib/aktionen';
import { AddCuesModal, CueSettingsModal } from '@/views/ShowView';
import { CueEditor } from '@/views/SoundboardView';
import { PlayerOberflaeche, type Reiter } from '@/views/PlayerOberflaeche';
import { panelTaste } from '../../../../packages/ui/src/components/SettingsPanel';
import { attr, element, medium, mitStore, ohneKommentare, show as eineShow, showCue, statusEintraege, tags, text } from './testzustand';

const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const GELADEN = { loading: false };
const MIT_SHOW = { loading: false, shows: [eineShow(1, 'Gala')], activeShowId: 1, showCues: [showCue(1), showCue(2)], standbyIndex: 0 };
/** Der Inhalt des AppShell (`<main>…</main>`), ohne Kopf, Werkzeugleiste, Panel und Statusleiste. */
const inhalt = (html: string): string => element(html, 'main', '');
/** Die Werkzeugleiste: vom Bereich toolbar bis zum Bereich inhalt. */
function werkzeugleiste(html: string): string {
  const a = html.indexOf('data-bereich="toolbar"');
  const b = html.indexOf('data-bereich="inhalt"');
  return a >= 0 && b > a ? html.slice(a, b) : '';
}
/** Alle Quelldateien unter src/renderer/src (relativ zu apps/player). */
function quellen(d = 'src/renderer/src'): string[] {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? quellen(`${d}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${d}/${e.name}`] : []));
}

// ── PL Rahmen: Kopf, ⚙, ThemeToggle, Tabs in der Werkzeugleiste, Statusleiste ──
{
  const html = mitStore(GELADEN, () => render(<PlayerOberflaeche />));
  const [zahnrad] = tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
  const [thema] = tags(html, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
  ok(
    text(html).includes('JM Player') && !html.includes('JM PLAYER') && html.includes('data-bereich="inhalt"'),
    'PL Rahmen: AppShell mit Kopf „JM Player“ (die alte Marke „JM PLAYER“ ist weg)',
  );
  ok(!text(html).includes('Player · Bibliothek · Soundboard'), 'PL Rahmen: der alte Untertitel „Player · Bibliothek · Soundboard“ entfällt (E16)');
  gleich(
    [attr(thema, 'aria-label'), attr(zahnrad, 'aria-label'), attr(zahnrad, 'aria-expanded')],
    ['Darstellung: Dunkel. Umschalten auf Hell', 'Einstellungen öffnen', 'false'],
    'PL Rahmen: ThemeToggle (E5) und ⚙ „Einstellungen öffnen“ im Kopf, Panel beim Start zu',
  );
  const knopfTexte = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]).trim());
  ok(!knopfTexte.includes('Light') && !knopfTexte.includes('Dark'), 'PL Rahmen: kein lokaler Theme-Knopf „Light“/„Dark“ mehr (E5)');
  ok(!existsSync('src/renderer/src/components/Topbar.tsx'), 'PL Rahmen: components/Topbar.tsx samt lokalem Theme-Knopf ist gelöscht');
  gleich(quellen().filter((d) => /Topbar/.test(ohneKommentare(leseText(d)))), [], 'PL Rahmen: keine Quelldatei verweist mehr auf Topbar');

  const leiste = werkzeugleiste(html);
  const reiter = [...leiste.matchAll(/(<button[^>]*role="tab"[^>]*>)([\s\S]*?)<\/button>/g)].map((m) => ({ gewaehlt: attr(m[1], 'aria-selected'), text: text(m[2]) }));
  ok(leiste.includes('role="tablist"'), 'PL Rahmen: die Werkzeugleiste trägt die Tabs (role=tablist, E14)');
  gleich(
    reiter.map((r) => [r.gewaehlt, ['Bibliothek', 'Soundboard', 'Cue-Show'].find((l) => r.text.startsWith(l))]),
    [['true', 'Bibliothek'], ['false', 'Soundboard'], ['false', 'Cue-Show']],
    'PL Rahmen: drei Reiter Bibliothek, Soundboard, Cue-Show in der alten Reihenfolge; beim Start ist die Bibliothek gewählt',
  );
  gleich(
    reiter.map((r) => ['Medien · Playlists', 'Sofort-Cues · Hotkeys', 'GO · QLab-Stil'].find((h) => r.text.endsWith(h))),
    ['Medien · Playlists', 'Sofort-Cues · Hotkeys', 'GO · QLab-Stil'],
    'PL Rahmen: die Zusatztexte der alten Navigation bleiben an ihren Reitern',
  );
  gleich(
    statusEintraege(html).map(([id, zustand]) => [id, zustand]),
    [
      ['master-link', 'off'],
      ['video-ausgabe', 'off'],
      ['fernsteuerung', 'off'],
      ['show', 'off'],
      ['pads', 'off'],
    ],
    'PL Rahmen: Statusleiste mit Master, Video-Ausgabe, Fernsteuerung, Cue-Show und Pads; vor der ersten Antwort ist nichts ok',
  );
  ok(html.includes('data-onair="bereit"') && !html.includes('data-onair="live"'), 'PL Rahmen: ON AIR im Kopf, nicht live, solange nichts spielt (E4)');
  pruefeIdVerweise(html, 'PL Rahmen: id-Verweise im ganzen Bedienfenster gültig');
}

// ── PL Rahmen: vor dem Laden ──
{
  const html = render(<PlayerOberflaeche />);
  const showEintrag = statusEintraege(html).find(([id]) => id === 'show');
  ok(text(html).includes('JM Player') && text(html).includes('Lade Bibliothek…'), 'PL Rahmen: vor dem Laden steht der Rahmen, die Bibliothek zeigt „Lade Bibliothek…“');
  ok(statusEintraege(html).every(([, zustand]) => zustand === 'off') && (showEintrag?.[2] ?? '').includes('unbekannt'), 'PL Rahmen: vor dem Laden ist kein Statuseintrag ok, die Cue-Show ist unbekannt');
}

// ── PL Rahmen: Verdrahtung in der View ──
{
  const ober = QUELLE('views/PlayerOberflaeche.tsx');
  ok(ober.includes('tool="Player"') && !ober.includes('tool="JM'), 'PL Rahmen: tool ohne „JM “ (der Kopf ergänzt es)');
  ok(ober.includes('toolbar={') && ober.includes('<Tabs') && ober.includes('value={reiter}') && ober.includes('onChange={setReiter}'), 'PL Rahmen: die Tabs stehen in toolbar und schalten nur den Reiter');
  ok(
    ober.includes('useBrueckenWert(MASTER_LINK_QUELLE)') && ober.includes('useBrueckenWert(FERNSTEUERUNG_QUELLE)') && ober.includes('useBrueckenWert(AUSGABE_QUELLE)') &&
      ober.includes('status={statusLeiste(stand)}') && ober.includes('onAir={kopfOnAir(stand)}'),
    'PL Rahmen: Brücken, Statusleiste und ON AIR laufen in der View, auch bei geschlossenem Panel',
  );
  ok(
    ober.includes('settingsOpen={panelOffen}') && ober.includes('useState(anfangOffen)') && !ober.includes('localStorage'),
    'PL Rahmen: der Panelzustand ist ein lokaler useState (zu beim Start, nichts gemerkt)',
  );
  const app = QUELLE('App.tsx');
  ok(app.includes('<PlayerOberflaeche />') && app.includes('void load()'), 'PL Rahmen: App lädt den Store einmal und zeigt die neue Oberfläche');
}

// ── PL Wiedergabe bleibt: das Panel baut nichts um ──
{
  for (const r of ['library', 'soundboard', 'show'] as Reiter[]) {
    const zu = mitStore(MIT_SHOW, () => render(<PlayerOberflaeche anfangReiter={r} />));
    const offen = mitStore(MIT_SHOW, () => render(<PlayerOberflaeche anfangReiter={r} anfangOffen />));
    ok(offen.includes('aria-label="Einstellungen"') && !zu.includes('aria-label="Einstellungen"'), `PL Wiedergabe bleibt (${r}): das Panel ist offen bzw. zu`);
    ok(inhalt(zu) !== '' && inhalt(offen) === inhalt(zu), `PL Wiedergabe bleibt (${r}): der Inhalt ist bei offenem und geschlossenem Panel Zeichen für Zeichen gleich (das Panel steht daneben)`);
  }
  const cueShow = mitStore(MIT_SHOW, () => render(<PlayerOberflaeche anfangReiter="show" anfangOffen />));
  ok(
    ['Standby', 'Cue 1 · m101.wav', '❚❚ Pause', '■ Stop', '⛔ Panik', '▦ Ausgabe', '+ Cue'].every((w) => text(inhalt(cueShow)).includes(w)),
    'PL Wiedergabe bleibt: bei offenem Panel zeigt die Cue-Show Standby, Transport, „▦ Ausgabe“ und „+ Cue“ (Leertaste und Esc gelten weiter, O1)',
  );
  const ober = QUELLE('views/PlayerOberflaeche.tsx');
  ok(!/\bkey=/.test(ober), 'PL Wiedergabe bleibt: der Rahmen setzt keinen key (der Panelzustand steckt in keinem key)');
  ok(
    ober.includes("{reiter === 'library' ? <Bibliothek /> : reiter === 'soundboard' ? <Soundboard panelOffen={panelOffen} /> : <CueShow onAusgabe={ausgabeOeffnen} />}"),
    'PL Wiedergabe bleibt: die Weiche der Ansichten hängt nur am Reiter (wie bisher in App.tsx: der Wechsel baut die alte Ansicht ab, das Panel nicht)',
  );
  const weiche = ober.slice(ober.indexOf("{reiter === 'library'"), ober.indexOf("{reiter === 'library'") + 140);
  ok(!/panel/i.test(weiche.replace('panelOffen={panelOffen}', '')), 'PL Wiedergabe bleibt: der Panelzustand steht in keiner Bedingung um die aktive Ansicht');
  ok(
    ober.includes('const Bibliothek = memo(LibraryView)') && ober.includes('const Soundboard = memo(SoundboardView)') && ober.includes('const CueShow = memo(ShowView)') &&
      /const ausgabeOeffnen = useCallback\(/.test(ober),
    'PL Wiedergabe bleibt: die Ansichten sind memo und bekommen stabile Rückrufe (Panel, Statusleiste und Videofortschritt rendern sie nicht neu)',
  );
  const rahmen = ['views/PlayerOberflaeche.tsx', 'views/Einstellungen.tsx', 'App.tsx', 'lib/aktionen.ts'].map((d) => [d, QUELLE(d)] as const);
  gleich(
    rahmen.filter(([, q]) => /stopAll|showAudio|showPanic|showStop|\.panic\(|\.forget\(|\.suspend\(/.test(q)).map(([d]) => d),
    [],
    'PL Wiedergabe bleibt: Rahmen, Panel und Aktionen stoppen keine Wiedergabe (kein stopAll, showAudio, showPanic, showStop)',
  );
  ok(
    (ober.match(/cueEngine/g) ?? []).length === 2 && ober.includes('padsAbonnieren(cueEngine, setPads)') && ober.includes("import { cueEngine } from '@/lib/cues'"),
    'PL Wiedergabe bleibt: der Rahmen nutzt die Pad-Maschine nur für die Pad-Meldung',
  );
  ok(
    ober.includes('useState<number[] | undefined>(undefined)') && /useEffect\(\(\) => padsAbonnieren\(cueEngine, setPads\), \[\]\)/.test(ober),
    'PL Wiedergabe bleibt: pads ist undefined bis zum Abo; das Abo läuft einmal und meldet sich im Aufräumen ab',
  );
}

// ── PL Wiedergabe bleibt: Pad-Abo (vorbelegt, abgemeldet) ──
{
  const log: string[] = [];
  let hoerer: ((ids: number[]) => void) | undefined;
  const maschine = {
    aktiveIds: () => [4, 7],
    onChange: (cb: (ids: number[]) => void) => {
      log.push('an');
      hoerer = cb;
      return () => {
        log.push('ab');
        hoerer = undefined;
      };
    },
  };
  const werte: Array<number[] | undefined> = [];
  const ab = padsAbonnieren(maschine, (ids) => void werte.push(ids));
  hoerer?.([9]);
  ab();
  hoerer?.([1]);
  gleich([log, werte], [['an', 'ab'], [[4, 7], [9]]], 'PL Wiedergabe bleibt: das Pad-Abo meldet sich an, belegt mit aktiveIds() vor und meldet sich im Aufräumen ab');
}

// ── PL Dialoge über Modal ──
{
  const show = QUELLE('views/ShowView.tsx');
  const sb = QUELLE('views/SoundboardView.tsx');
  gleich(
    [show.includes('fixed inset-0'), sb.includes('fixed inset-0')],
    [false, false],
    'PL Dialoge über Modal: kein handgebautes Overlay (fixed inset-0) mehr in ShowView.tsx und SoundboardView.tsx',
  );
  const importiertModal = (q: string): boolean => /import \{[^}]*\bModal\b[^}]*\} from '@jm\/ui';/.test(q);
  gleich(
    [importiertModal(show), (show.match(/<Modal\b/g) ?? []).length, importiertModal(sb), (sb.match(/<Modal\b/g) ?? []).length],
    [true, 2, true, 1],
    'PL Dialoge über Modal: Cue bearbeiten und Cues hinzufügen (ShowView), Pad belegen (SoundboardView) über Modal aus @jm/ui',
  );
  gleich(
    [...show.matchAll(/<Modal\b[^>]*>/g), ...sb.matchAll(/<Modal\b[^>]*>/g)].filter((m) => /\btitle=/.test(m[0])).length,
    0,
    'PL Dialoge über Modal: die Dialoge behalten ihre eigene Überschrift (kein zusätzlicher Kopf mit ✕)',
  );
  ok(
    show.includes('const schliesseHinzufuegen = useCallback(() => setAddOpen(false), [])') &&
      show.includes('const schliesseCue = useCallback(() => setEditCue(null), [])') &&
      sb.includes('const schliessePad = useCallback(() => setEditSlot(null), [])') &&
      !/onClose=\{\(\) =>/.test(show) &&
      !/onClose=\{\(\) =>/.test(sb),
    'PL Dialoge über Modal: die Schließen-Rückrufe sind stabil (useCallback); sonst holte Modal bei jeder Store-Änderung (Videofortschritt) den Fokus neu',
  );
}
{
  const dlg = render(<CueSettingsModal cue={showCue(1, { label: 'Gong', preWaitSec: 1.5, gainDb: -3, loop: true, autoContinue: true })} onClose={() => undefined} />);
  const felder = tags(dlg, 'input');
  ok(dlg.includes('role="dialog"') && dlg.includes('aria-modal="true"'), 'PL Dialoge über Modal: Cue bearbeiten ist ein Dialog (role=dialog, aria-modal)');
  gleich(
    [text(element(dlg, 'h2', '')), ['Beschriftung', 'Pre-Wait (s)', 'Fade-In (s)', 'Fade-Out (s)', 'Gain (dB)', 'Loop', 'Auto-Continue', 'Abbrechen', 'Speichern'].filter((w) => !text(dlg).includes(w))],
    ['Cue bearbeiten', []],
    'PL Dialoge über Modal: Cue bearbeiten behält Titel, Feldnamen und Knöpfe',
  );
  gleich(
    felder.map((t) => [attr(t, 'type') ?? 'text', attr(t, 'value') ?? (t.includes(' checked') ? 'an' : ''), attr(t, 'step') ?? '', attr(t, 'min') ?? '', attr(t, 'placeholder') ?? '']),
    [
      ['text', 'Gong', '', '', 'm101.wav'],
      ['number', '1.5', '0.5', '0', ''],
      ['number', '0', '0.5', '0', ''],
      ['number', '0', '0.5', '0', ''],
      ['number', '-3', '1', '', ''],
      ['checkbox', 'an', '', '', ''],
      ['checkbox', 'an', '', '', ''],
    ],
    'PL Dialoge über Modal: Cue bearbeiten mit denselben Feldern, Startwerten, Schritten und dem Platzhalter Dateiname',
  );
  ok(text(dlg).includes('m101.wav') && text(dlg).includes('Hinweis: Loop-Cues enden nie von selbst — Auto-Continue greift dann nicht.'), 'PL Dialoge über Modal: Dateiname unter dem Titel und Loop-Hinweis wie bisher');
  const leer = render(<CueSettingsModal cue={showCue(2, { ohneMedium: true })} onClose={() => undefined} />);
  ok(text(leer).includes('Medium fehlt') && tags(leer, 'input').some((t) => attr(t, 'placeholder') === 'Cue-Name'), 'PL Dialoge über Modal: ohne Medium „Medium fehlt“ und Platzhalter „Cue-Name“');
}
{
  const leer = mitStore({ items: [] }, () => render(<AddCuesModal onClose={() => undefined} />));
  const gesperrt = tags(leer, 'button').filter((t) => attr(t, 'disabled') !== undefined);
  ok(leer.includes('role="dialog"') && text(element(leer, 'h2', '')) === 'Cues hinzufügen', 'PL Dialoge über Modal: Cues hinzufügen ist ein Dialog mit altem Titel');
  ok(
    text(leer).includes('Medien aus der Bibliothek auswählen — sie werden ans Ende der Show angehängt.') && text(leer).includes('Bibliothek ist leer.') && gesperrt.length === 1 && gesperrt[0] === tags(leer, 'button').at(-1) && text(leer).includes('Abbrechen') && text(leer).includes('Hinzufügen'),
    'PL Dialoge über Modal: Cues hinzufügen mit altem Text, Leerzustand, „Abbrechen“ und gesperrtem „Hinzufügen“',
  );
  const voll = mitStore({ items: [medium(2), medium(1, 'video')] }, () => render(<AddCuesModal onClose={() => undefined} />));
  ok(text(voll).indexOf('m1.mp4') < text(voll).indexOf('m2.wav') && text(voll).includes('▦') && text(voll).includes('♪') && tags(voll, 'input').filter((t) => attr(t, 'type') === 'checkbox').length === 2, 'PL Dialoge über Modal: Liste nach Dateiname mit Art-Symbol und Kontrollkästchen');
}
{
  const dlg = mitStore({ items: [] }, () => render(<CueEditor slot={2} playlistId={1} cue={null} onClose={() => undefined} />));
  const [hotkey] = tags(dlg, 'input').filter((t) => attr(t, 'placeholder') === 'Taste drücken…');
  const gesperrt = tags(dlg, 'button').filter((t) => attr(t, 'disabled') !== undefined);
  ok(dlg.includes('role="dialog"') && text(element(dlg, 'h2', '')) === 'Pad 3 belegen', 'PL Dialoge über Modal: Pad belegen ist ein Dialog mit Platznummer im Titel');
  ok(
    ['Medium', 'Bibliothek leer', 'Beschriftung', 'Hotkey', 'Loop', 'Pad leeren', 'Abbrechen', 'Speichern'].every((w) => text(dlg).includes(w)) && hotkey !== undefined && attr(hotkey, 'readonly') !== undefined && gesperrt.length === 1 && gesperrt[0] === tags(dlg, 'button').at(-1),
    'PL Dialoge über Modal: Pad belegen mit Medium, Beschriftung, Hotkey (schreibgeschützt, „Taste drücken…“), Loop, „Pad leeren“, „Abbrechen“ und gesperrtem „Speichern“ ohne Medium',
  );
}

// ── PL Ausgabe unberührt (E6): Zeichen für Zeichen wie vor der Welle, bis auf die zwei Zeilen der Meldung „bereit“ (Altfehler PL-N) ──
{
  const roh = leseText('src/renderer/src/views/OutputView.tsx');
  const bereit =
    '    // Altfehler PL-N: erst jetzt hört die Ansicht zu; der Main hält Befehle bis zu dieser Meldung zurück (höchstens 5000 ms).\n' +
    '    window.jmplay.output.meldeBereit();\n';
  gleich(
    [roh.split(bereit).length - 1, createHash('sha256').update(roh.replace(bereit, '')).digest('hex')],
    [1, 'f4f2d318cb0c47ed8abc288b0881807e5027467ec99d0a5a25c621b1b16b8354'],
    'PL Ausgabe unberührt: views/OutputView.tsx ist Zeichen für Zeichen wie vor der Welle, bis auf die zwei Zeilen der Meldung „bereit“ (Altfehler PL-N)',
  );
  ok(!/@jm\/settings/.test(roh) && !/AppShell/.test(roh) && roh.includes('className="fixed inset-0 bg-black"'), 'PL Ausgabe unberührt: die Ausgabeansicht bleibt schwarz, ohne @jm/settings und ohne AppShell');
  const main = QUELLE('main.tsx');
  ok(main.includes("'#output'") && main.includes('{isOutput ? <OutputView /> : <App />}'), 'PL Ausgabe unberührt: #output zeigt weiter die OutputView, sonst die App');
}

// ── PL Tasten: Filter der Cue-Show und Escape bei offenem Panel (O1) ──
{
  const show = QUELLE('views/ShowView.tsx');
  ok(
    show.includes('if (addOpen || editCue) return;') && !show.includes('outputOpen') && show.includes('if (istEingabeZiel(e.target)) return;'),
    'PL Tasten: die Cue-Show sperrt Leertaste und Esc bei offenem Dialog (Cues hinzufügen, Cue bearbeiten) und in Feldern; die Bedingung outputOpen ist mit dem Modal weg',
  );
  ok(
    /if \(e\.code === 'Space'\) \{\s*e\.preventDefault\(\);\s*showGo\(\);\s*\} else if \(e\.key === 'Escape'\) \{\s*showStop\(\);/.test(show) &&
      show.includes("window.addEventListener('keydown', onKey);") &&
      show.includes('}, [addOpen, editCue, showGo, showStop]);'),
    'PL Tasten: Leertaste = GO, Esc = Stop wie bisher, Hörer am window in der Bubble-Phase',
  );
  ok(QUELLE('views/SoundboardView.tsx').includes('if (!padTasteErlaubt(e, { dialogOffen: editSlot != null, panelOffen })) return;'), 'PL Tasten: die Pad-Tasten laufen über padTasteErlaubt (Altfehler PL-4), das istEingabeZiel nutzt');
  const ereignis = (key: string, ziel: unknown, log: string[]) => ({
    key,
    defaultPrevented: false,
    target: ziel,
    stopPropagation: () => void log.push('stop'),
    preventDefault: () => void log.push('prevent'),
  });
  const knopf = { tagName: 'BUTTON', type: 'button' };
  const leer: string[] = [];
  panelTaste(ereignis(' ', knopf, leer), () => void leer.push('zu'));
  const esc: string[] = [];
  panelTaste(ereignis('Escape', knopf, esc), () => void esc.push('zu'));
  const feld: string[] = [];
  panelTaste(ereignis(' ', { tagName: 'INPUT', type: 'number' }, feld), () => void feld.push('zu'));
  gleich(
    [leer, esc, feld],
    [[], ['stop', 'prevent', 'zu'], ['stop']],
    'PL Tasten: im Panel geht die Leertaste auf einem Knopf ans Tool (GO), Escape bleibt im Panel und schließt es (erreicht Esc = Stop am window nicht), ein Feld behält seine Tasten (O1)',
  );
  const ober = QUELLE('views/PlayerOberflaeche.tsx');
  const shell = ohneKommentare(leseText('../../packages/ui/src/components/AppShell.tsx'));
  const panel = ohneKommentare(leseText('../../packages/ui/src/components/SettingsPanel.tsx'));
  // Seit der Gesamtprüfung UX Welle 2b (I2) reicht das Panel das Opt-in toolTasten mit; der Player gibt es nicht an (unverändert).
  ok(
    ober.includes('<AppShell') && !ober.includes('panelToolTasten') && ober.includes('settings={<Einstellungen') && shell.includes('<SettingsPanel') && /onKeyDown: \(e\) => panelTaste\(e, p\.onClose[,)]/.test(panel),
    'PL Tasten: das Panel ist das SettingsPanel des AppShell, sein onKeyDown läuft über panelTaste',
  );
  const modal = ohneKommentare(leseText('../../packages/ui/src/components/Modal.tsx'));
  ok(
    modal.includes("document.addEventListener('keydown', onKeyDown, true)") && /if \(e\.key === 'Escape'\) \{\s*e\.stopPropagation\(\);\s*onClose\(\);/.test(modal),
    'PL Tasten: Escape in einem Dialog schließt ihn (Modal, Capture-Phase) und erreicht Esc = Stop nicht',
  );
}

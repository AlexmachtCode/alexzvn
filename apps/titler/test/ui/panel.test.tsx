// UX-Pilot C11 · Einstellungs-Panel (Spec 3.6, 5.1, 6, 10; Anhang A „Titler“ › Einstellungen; E6–E10, E13, E24; OF3,
// OF4, OF5, OF7): fünf Abschnitte aus @jm/settings mit den Props aus lib/oberflaeche.ts, dahinter „Stil“ und
// „Grafik-Vorlagen“. Jeder Statuseintrag mit Panel-Abschnitt findet seinen Anker. Render ohne Browser und ohne window.
import { readdirSync } from 'node:fs';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { ordnerWahlGesperrt, type QuellZustand } from '@shared/datenquelle';
import { statusLeiste, TITLER_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import { Einstellungen } from '@/views/Einstellungen';
import { panelTaste } from '../../../../packages/ui/src/components/SettingsPanel';
import { attr, basisConfig, basisStand, basisStatus, eintraege, MONITORE, ohneKommentare, protokollAktionen, tags, text, VORLAGEN } from './testzustand';

const nichts = (): void => undefined;
function panel(stand: OberflaechenStand, log: string[] = []): string {
  return render(
    <Einstellungen
      stand={stand}
      aktionen={protokollAktionen(log)}
      templates={VORLAGEN}
      activeGraphicId="v1"
      onPickImport={() => void log.push('onPickImport')}
      onDropImport={() => void log.push('onDropImport')}
      onDeleteTemplate={(t) => void log.push(`onDeleteTemplate ${t.id}`)}
    />,
  );
}
/** Der Abschnitt mit dem Anker einstellung-{id}: vom Anker bis zum nächsten Anker (bzw. bis zum Ende). */
function abschnitt(html: string, id: string): string {
  const a = html.indexOf(`id="einstellung-${id}"`);
  if (a < 0) return '';
  const b = html.indexOf('id="einstellung-', a + 1);
  return html.slice(a, b < 0 ? undefined : b);
}
const titel = (html: string): string[] => [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
const MASTER: QuellZustand = { art: 'master', showPfad: null, showName: 'Gala', quellHinweis: null, master: { masterId: 'm1', masterName: 'Regie-PC', schluessel: null } };

// ── Reihenfolge und Anker ──
{
  const log: string[] = [];
  const stand = basisStand({ displays: MONITORE });
  const html = panel(stand, log);
  gleich(
    titel(html),
    ['iveo', 'NDI-Ausgabe', 'Ausgabe auf Bildschirm', 'Fernsteuerung', 'DataLink', TITLER_TEXTE.stil, TITLER_TEXTE.vorlagen],
    'Panel: Abschnitte iveo, NDI-Ausgabe, Ausgabe auf Bildschirm, Fernsteuerung, DataLink, Stil, Grafik-Vorlagen (Anhang A)',
  );
  const ziele = statusLeiste(stand)
    .map((i) => i.settingsSection)
    .filter((z): z is string => typeof z === 'string');
  gleich(
    ziele.filter((z) => !html.includes(`id="einstellung-${z}"`)),
    [],
    'Panel: jeder Statuseintrag mit Abschnitt (iveo, ndi, bildschirm, fernsteuerung, datalink) findet seinen Anker (E20)',
  );
  gleich(ziele.length, 5, 'Panel: fünf Statuseinträge springen ins Panel, der Master-Eintrag nicht (E4)');
  pruefeIdVerweise(html, 'Panel: id-Verweise gültig (Beschriftungen, Hinweise, Sperrgründe)');
  gleich(log, [], 'Panel: Rendern löst keine Aktion aus');
}

// ── Verbund: DataLink gesperrt bei Quelle master (R2-Satz, OF7), K1 bei Quelle show ──
{
  const satz = ordnerWahlGesperrt(MASTER) ?? '';
  const master = basisStand({
    config: basisConfig({ dataFolder: 'D:\\Daten' }),
    status: basisStatus({
      entries: eintraege(3),
      datenQuelle: { art: 'master', zeile: 'Quelle: Show vom Master „Gala“', zurueckKnopf: null, ohneOrdner: false, ordnerGesperrt: satz },
    }),
  });
  const dl = abschnitt(panel(master), 'datalink');
  ok(
    satz.startsWith('Im Verbund kommen die Speaker vom Master „Regie-PC“.') && text(dl).includes(`Gesperrt: ${satz}`),
    'Panel › DataLink bei Quelle master: „Gesperrt: Im Verbund kommen die Speaker vom Master „…“ …“ (R2-Satz wörtlich, OF7)',
  );
  const bedien = [...tags(dl, 'button'), ...tags(dl, 'input')];
  gleich(
    [bedien.length, bedien.filter((t) => attr(t, 'disabled') !== undefined).length],
    [3, 3],
    'Panel › DataLink bei Quelle master: Ordnerpfad, „Ordner wählen …“ und „Ordner entfernen“ stehen da und sind gesperrt',
  );
  const show = basisStand({
    config: basisConfig({ dataFolder: 'D:\\Daten' }),
    status: basisStatus({
      entries: eintraege(3),
      datenQuelle: { art: 'show', zeile: 'Quelle: Show „Probe“ · 3 Speaker', zurueckKnopf: 'Zurück zum eigenen Ordner (Daten)', ohneOrdner: false },
    }),
  });
  const log: string[] = [];
  const k1 = render(
    <Einstellungen
      stand={show}
      aktionen={protokollAktionen(log)}
      templates={[]}
      activeGraphicId=""
      onPickImport={nichts}
      onDropImport={nichts}
      onDeleteTemplate={nichts}
    />,
  );
  const knopf = tags(abschnitt(k1, 'datalink'), 'button').filter((t) => attr(t, 'disabled') === undefined);
  ok(
    text(abschnitt(k1, 'datalink')).includes('Zurück zum eigenen Ordner (Daten)') && knopf.length === 3 && !text(k1).includes('Gesperrt:'),
    'Panel › DataLink bei Quelle show mit eigenem Ordner: K1 „Zurück zum eigenen Ordner (…)“, nichts gesperrt',
  );
  // Der Statuseintrag DataLink springt bei einem Fehler hierher: Der Abschnitt zeigt ihn im Kopf und unter den Feldern (E10).
  const mitFehler = (dataError: string): unknown => {
    const dl = abschnitt(panel(basisStand({ config: basisConfig({ dataFolder: 'D:\\Daten' }), status: basisStatus({ dataError, datenQuelle: { art: 'ordner', zeile: '', zurueckKnopf: null, ohneOrdner: false } }) })), 'datalink');
    const pille = tags(dl, 'span').find((t) => attr(t, 'data-state') !== undefined);
    const zeile = /<p data-fehler="true"[^>]*>([\s\S]*?)<\/p>/.exec(dl);
    return [attr(pille, 'data-state'), text(dl).includes(dataError === 'Ordner nicht gefunden' ? 'Ordner fehlt' : `Fehler: ${dataError}`), zeile ? text(zeile[1]) : null];
  };
  gleich(
    [mitFehler('EACCES: permission denied'), mitFehler('Ordner nicht gefunden')],
    [
      ['error', true, '⚠ EACCES: permission denied'],
      ['error', true, null],
    ],
    'Panel › DataLink mit Fehler: „Fehler: …“ im Kopf und ⚠ mit dem Text unter den Feldern; „Ordner nicht gefunden“ als „Ordner fehlt“ (E10)',
  );
}

// ── Abschnitte im Einzelnen ──
{
  const stand = basisStand({
    displays: MONITORE,
    status: basisStatus({ fernsteuerung: { laeuft: true, port: 8726, clients: 2, modus: 'open' } }),
  });
  const html = panel(stand);
  const fs = text(abschnitt(html, 'fernsteuerung'));
  ok(
    fs.includes('8726') && fs.includes('„jm-suite“') && fs.includes('bereit · 2 verbunden') && !fs.includes('Im Launcher einrichten'),
    'Panel › Fernsteuerung: Port 8726, Companion-Modul „jm-suite“, „bereit · 2 verbunden“, ohne „Im Launcher einrichten“ (E6, OF5)',
  );
  const iv = abschnitt(html, 'iveo');
  ok(
    text(iv).includes('Das Zugriffstoken bleibt im Launcher.') && tags(iv, 'input').length === 0 && !text(iv).includes('Im Launcher einrichten'),
    'Panel › iveo: „Das Zugriffstoken bleibt im Launcher.“, kein Token-Feld, kein Launcher-Knopf (E9, OF5)',
  );
  const ndi = abschnitt(html, 'ndi');
  const labels = (h: string): string[] => [...h.matchAll(/<label for="[^"]+"[^>]*>([^<]*)<\/label>/g)].map((m) => m[1]);
  gleich(
    [labels(ndi), tags(ndi, 'button').map((t) => attr(t, 'role'))],
    [['Ausgabe', 'Quellenname', 'Auflösung', 'Bildrate'], ['switch']],
    'Panel › NDI-Ausgabe: Schalter „Ausgabe“, Quellenname, Auflösung, Bildrate (E7)',
  );
  const bs = abschnitt(html, 'bildschirm');
  ok(
    labels(bs).join('|') === 'Ausgabe|Bildschirm|Hintergrund' &&
      tags(bs, 'input').some((t) => attr(t, 'type') === 'color') &&
      text(bs).includes('Standardfarbe (#00B140)') &&
      tags(bs, 'option').length === 3,
    'Panel › Ausgabe auf Bildschirm: Schalter, Auswahl (automatisch + 2 Monitore), Hintergrund mit Farbwähler, „Standardfarbe (#00B140)“ (E8, OF3)',
  );
  const stil = abschnitt(html, 'stil');
  ok(
    ['Unten', 'Oben', 'Größe', 'Balken', 'Text', 'Akzent'].every((t) => text(stil).includes(t)) &&
      tags(stil, 'input').filter((t) => attr(t, 'type') === 'color').length === 3 &&
      tags(stil, 'input').filter((t) => attr(t, 'type') === 'range').length === 1,
    'Panel › Stil: „Unten“, „Oben“, Größe und drei Farben (Nr. 38–41)',
  );
  const gv = abschnitt(html, 'vorlagen');
  ok(
    text(gv).includes('Datei importieren…') &&
      text(gv).includes('oder .psd / .jmtitler hierher ziehen') &&
      text(gv).includes('Textebenen werden zu füllbaren Feldern') &&
      !gv.includes('opacity-0'),
    'Panel › Grafik-Vorlagen: „Datei importieren…“, Ablagefläche, Beschreibung (Nr. 20); „Löschen“ sichtbar (kein opacity-0, E13)',
  );
  gleich(
    tags(gv, 'button')
      .filter((t) => attr(t, 'aria-label')?.startsWith('Vorlage „'))
      .map((t) => attr(t, 'aria-label')),
    VORLAGEN.map((v) => TITLER_TEXTE.loeschenAria(v.name)),
    'Panel › Grafik-Vorlagen: je Vorlage „Löschen“ mit aria-label „Vorlage „{Name}“ löschen“ (T7)',
  );
}

// ── Ausgabe auf Bildschirm, solange die Monitorliste nicht geladen ist (displays undefined, E8): „unbekannt“, keine Liste ──
{
  const bs = abschnitt(panel(basisStand({ displays: undefined })), 'bildschirm');
  const pille = tags(bs, 'span').find((t) => attr(t, 'data-state') !== undefined);
  gleich(
    [attr(pille, 'data-state'), text(bs).includes('unbekannt'), tags(bs, 'select').length, text(bs).includes('Kein Bildschirm gefunden')],
    ['off', true, 0, false],
    'Panel › Ausgabe auf Bildschirm bei nicht geladener Monitorliste: „unbekannt“ statt einer leeren Liste (E8, Spec 7.2)',
  );
}

// ── Aktionen aus dem Panel (ohne DOM über die Props der Abschnitte geprüft in C8; hier: Rendern ruft nichts) ──
{
  const log: string[] = [];
  panel(basisStand({ status: basisStatus({ ndiActive: true, connections: 2 }) }), log);
  gleich(log, [], 'Panel mit NDI an: Rendern ruft weder startNdi noch stopNdi noch setConfig');
}

// ── G8 und Texte ──
{
  const einst = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(!einst.includes('useEffect') && !einst.includes('window.'), 'Quelltext Einstellungen: ohne useEffect und ohne window. (G7, G8)');
  const op = leseText('src/renderer/src/views/OperatorView.tsx');
  gleich(
    ['window.jmtitler.remote.onCommand(', 'window.jmtitler.onFileOpened(', 'window.jmtitler.remote.reportState(', 'window.jmtitler.listDisplays()'].filter(
      (z) => !op.includes(z),
    ),
    [],
    'Quelltext OperatorView: Fernsteuer-Befehle, Show-Vorlagen-Import, reportState und Monitorliste laufen auch bei zugeklapptem Panel (G8)',
  );
  const views = readdirSync('src/renderer/src/views').filter((d) => d.endsWith('.tsx'));
  const alt = views.filter((d) => /Reiter|rechts starten|titler\.style|titler\.operator\.tab/.test(ohneKommentare(leseText(`src/renderer/src/views/${d}`))));
  gleich(alt, [], 'Texte: in views/*.tsx kein „Reiter“, kein „rechts starten“, kein titler.style, kein titler.operator.tab (Befund 16, E14)');
  const felder = leseText('src/renderer/src/views/felder.tsx');
  ok(
    felder.includes('export function Slider(') && felder.includes('export function ColorField(') && !felder.includes('function Field(') && !felder.includes('function Labeled('),
    'Quelltext felder.tsx: nur noch Slider und ColorField (Field und Labeled entfallen, E23)',
  );
}

// ── Pflichtpunkt Panel (Nr. 96): Leertaste und Escape mit Fokus im Panel (O1) ──
{
  const ndi = abschnitt(panel(basisStand()), 'ndi');
  const [schalter] = tags(ndi, 'button');
  ok(attr(schalter, 'role') === 'switch' && attr(schalter, 'type') === 'button', 'Pflichtpunkt Panel: der NDI-Schalter ist ein <button role="switch">');
  const quellen = (d: string): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? quellen(`${d}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${d}/${e.name}`] : []));
  const tasten = quellen('src').filter((d) => /keydown|onKeyDown|globalShortcut|before-input-event/.test(leseText(d)));
  gleich(tasten, [], 'Pflichtpunkt Panel: apps/titler/src hat keinen Tastenhandler (kein keydown, onKeyDown, globalShortcut, before-input-event)');
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
  panelTaste(ereignis(' ', { tagName: 'INPUT', type: 'text' }, feld), () => void feld.push('zu'));
  gleich(
    [leer, esc, feld],
    [[], ['stop', 'prevent', 'zu'], ['stop']],
    'Pflichtpunkt Panel: Leertaste auf dem Schalter bleibt unberührt (löst ihn nativ aus), Escape schließt das Panel, ein Textfeld behält die Leertaste (O1)',
  );
}

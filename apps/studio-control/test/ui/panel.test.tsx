// UX Welle 2b, Studio-Control d1 · Das Panel (B8, B15; Studio-Control-Block „Panel“): die Fernsteuerung
// (RemoteControlSection, Modul „JM Studio Control“, Port 8735) und darunter seit Altfehler SC-S1 der Abschnitt Browser-Zugang (Ort
// der Datei mit dem Erst-Passwort, nie das Passwort), nur im Electron-Fenster; im Browser und vor der Anmeldung fehlt settings ganz
// (kein ⚙). Das Panel hat keine Effekte: Master-Link, Fernsteuerungs-Meldung und Socket laufen in der Wurzel bzw. der Wurzel-View,
// auch bei geschlossenem Panel; den Ort der Datei liest die Wurzel-View beim Öffnen des Panels (A9). Render ohne Browser und ohne window.
import { RemoteControlSection, REMOTE_TEXTE } from '@jm/settings';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { ABSCHNITT, fernsteuerungAbschnitt, statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import * as panel from '@/views/Einstellungen';
import * as oberflaeche from '@/views/StudioOberflaeche';
import { angemeldeterStand, anker, attr, basisMeldung, bereich, grundStand, ohneKommentare, rendererDateien, statusEintraege, tags, text } from './testzustand';

const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const BELEGT = 'listen EADDRINUSE: address already in use :::8735';
/** Panel-Anker unter der Fernsteuerung: der Abschnitt Browser-Zugang (Altfehler SC-S1). */
const ZUGANG = 'browser-zugang';
const DATEI = String.raw`C:\Users\Test\AppData\Roaming\@jm\studio-control\first-run-credentials.txt`;

function einstellungen(s: OberflaechenStand): string {
  const Panel = panel.Einstellungen;
  if (typeof Panel !== 'function') {
    ok(false, 'SC Panel: Einstellungen fehlt');
    return '';
  }
  return render(<Panel stand={s} />);
}

function rahmen(s: OberflaechenStand, panelOffen: boolean): string {
  const Rahmen = oberflaeche.StudioRahmen;
  if (typeof Rahmen !== 'function') {
    ok(false, 'SC Panel: StudioRahmen fehlt');
    return '';
  }
  return render(
    <Rahmen stand={s} abschnitt="video" onAbschnitt={() => undefined} onAbmelden={() => undefined} panelOffen={panelOffen} onPanel={() => undefined}>
      <div data-studio="inhalt-probe" />
    </Rahmen>,
  );
}

const zahnrad = (html: string): string[] => tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
/** HTML ohne die von useId erzeugten Kennungen (sie hängen vom Platz im Baum ab), für den Vergleich zweier Renderings. */
const ohneIds = (html: string): string => html.replace(/\s(?:id|for|aria-describedby|aria-labelledby|aria-controls)="[^"]*"/g, '');
const panelTeil = (html: string): string => {
  const a = html.indexOf('aria-label="Einstellungen"');
  return a < 0 ? '' : html.slice(a);
};

// ── SC Panel: die Fernsteuerung mit den Props aus fernsteuerungAbschnitt (eine Wahrheit mit der Statusleiste), darunter Browser-Zugang ──
{
  const faelle: Array<[string, OberflaechenStand]> = [
    ['vor der ersten Meldung', grundStand()],
    ['bereit, 2 verbunden', grundStand({ fernsteuerung: basisMeldung({ clients: 2, modus: 'open' }) })],
    ['Port belegt', grundStand({ fernsteuerung: basisMeldung({ laeuft: false, clients: 0, fehler: BELEGT }) })],
  ];
  for (const [name, s] of faelle) {
    const html = einstellungen(s);
    gleich(anker(html), [ABSCHNITT.fernsteuerung, ZUGANG], `SC Panel: ${name} – zwei Abschnitte, erst die Fernsteuerung, darunter Browser-Zugang (Anker einstellung-fernsteuerung, einstellung-browser-zugang)`);
    ok(html !== '' && ohneIds(html).includes(ohneIds(render(<RemoteControlSection {...fernsteuerungAbschnitt(s)} />))),`SC Panel: ${name} – der Abschnitt bekommt seine Props aus fernsteuerungAbschnitt (dieselbe Ableitung wie die Statusleiste)`);
  }
  const html = einstellungen(grundStand());
  ok(text(html).includes('JM Studio Control') && text(html).includes('8735'), 'SC Panel: die Fernsteuerung nennt das Companion-Modul „JM Studio Control“ und Port 8735');
  ok(text(einstellungen(grundStand({ fernsteuerung: basisMeldung({ laeuft: false, clients: 0, fehler: BELEGT }) }))).includes(REMOTE_TEXTE.portBelegt), 'SC Panel: bei gehaltenem Port 8735 zeigt der Abschnitt „Port belegt“');
  const ziele = statusLeiste(angemeldeterStand()).map((i) => i.settingsSection).filter((z): z is string => typeof z === 'string');
  gleich(ziele.filter((z) => !anker(html).includes(z)), [], 'SC Panel: jeder Statuseintrag mit Sprungziel findet seinen Anker im Panel');
  pruefeIdVerweise(html, 'SC Panel: id-Verweise gültig');
  ok(!text(html).includes('"'), 'SC Panel: kein ASCII-Anführungszeichen in den Texten des Panels');
}

// ── SC Panel: nur im Electron-Fenster und nur angemeldet; im Browser fehlt settings ganz ──
{
  const electron = rahmen(angemeldeterStand(), false);
  gleich(zahnrad(electron).length, 1, 'SC Panel: Electron und angemeldet – ⚙ im Kopf');
  const offen = rahmen(angemeldeterStand(), true);
  const p = panelTeil(offen);
  ok(p !== '' && offen.includes('data-studio="inhalt-probe"'), 'SC Panel: offen steht das Panel neben dem Inhalt, der Inhalt bleibt gerendert');
  gleich(anker(p), [ABSCHNITT.fernsteuerung, ZUGANG], 'SC Panel: das offene Panel enthält die Fernsteuerung und darunter Browser-Zugang');
  ok(attr(zahnrad(offen)[0], 'aria-expanded') === 'true', 'SC Panel: ⚙ zeigt das offene Panel (aria-expanded)');
  const browser = rahmen(angemeldeterStand({ umgebung: 'browser' }), true);
  ok(zahnrad(browser).length === 0 && panelTeil(browser) === '' && anker(browser).length === 0, 'SC Panel: im Browser kein ⚙ und kein Panel, auch wenn panelOffen gesetzt ist');
  ok(!/<button[^>]*data-status-id=/.test(browser) && statusEintraege(browser).length > 0, 'SC Panel: im Browser ist kein Statuseintrag ein Knopf (ohne settings kein Sprungziel)');
  const vorher = rahmen(angemeldeterStand({ benutzer: null }), true);
  ok(zahnrad(vorher).length === 0 && panelTeil(vorher) === '', 'SC Panel: vor der Anmeldung kein ⚙ und kein Panel, auch im Electron-Fenster');
  ok(/<button[^>]*data-status-id="fernsteuerung"/.test(electron), 'SC Panel: im Electron-Fenster öffnet der Eintrag Fernsteuerung das Panel (Knopf mit Sprungziel)');
}

// ── SC Panel: keine Effekte im Panel; Abos und Panelzustand in der Wurzel-View, der Socket in der Wurzel ──
{
  const p = QUELLE('views/Einstellungen.tsx');
  ok(
    !/\buse[A-Z]\w*\(|\bwindow\b|\blocalStorage\b|\bemit\w*\(|\bconnect\(|apiFetch|useSession|useApp/.test(p),
    'SC Panel: Einstellungen.tsx ohne Hooks, Effekte, window, Store, Socket und Abfragen (B8); es zeichnet nur den Stand',
  );
  const wurzel = QUELLE('views/StudioOberflaeche.tsx');
  gleich(
    [(wurzel.match(/useBrueckenWert\(MASTER_LINK_QUELLE\)/g) ?? []).length, (wurzel.match(/useBrueckenWert\(FERNSTEUERUNG_QUELLE\)/g) ?? []).length],
    [1, 1],
    'SC Panel: die Wurzel-View liest Master-Link und Fernsteuerung je genau einmal, unabhängig vom Panel (feste Quelle, kein panelOffen davor)',
  );
  gleich(
    rendererDateien().filter((d) => !['views/StudioOberflaeche.tsx', 'lib/bruecken.ts'].includes(d) && /MASTER_LINK_QUELLE|FERNSTEUERUNG_QUELLE|ERST_PASSWORT_QUELLE|useBrueckenWert/.test(QUELLE(d))),
    [],
    'SC Panel: keine andere Datei abonniert Master-Link, Fernsteuerung oder den Ort der Passwort-Datei (nicht Panel, Werkzeugleiste oder Reiter)',
  );
  ok(wurzel.includes('useState(anfangOffen)') && wurzel.includes('settingsOpen={panelOffen}') && !/localStorage|persistId/.test(wurzel), 'SC Panel: der Panelzustand ist ein lokaler useState der Wurzel-View (zu beim Start, nichts gemerkt)');
  ok(/if \(!user\) \{\s*setPanelOffen\(false\);/.test(wurzel), 'SC Panel: nach dem Abmelden ist das Panel zu (bei der nächsten Anmeldung zu wie beim Start)');
  ok(!/\buse[A-Z]\w*\(/.test(QUELLE('views/Werkzeugleiste.tsx')), 'SC Panel: die Werkzeugleiste hat keine Hooks und keine Effekte (Rückrufe kommen aus der Wurzel-View)');
}

// ── SC Panel Browser-Zugang (Altfehler SC-S1): Titel, Pfad und Pille aus browserZugang; nur der Ort, nie ein Passwort ──
{
  const zugang = (s: OberflaechenStand): string => bereich(einstellungen(s), 'id', `einstellung-${ZUGANG}`);
  const mit = zugang(grundStand({ erstPasswort: { datei: DATEI, vorhanden: true } }));
  ok(mit !== '' && text(mit).includes('Browser-Zugang') && text(mit).includes(DATEI), 'SC Panel Browser-Zugang: mit Datei zeigt der Abschnitt den Titel „Browser-Zugang“ und den Pfad der Datei');
  ok(
    text(mit).includes(`Das Erst-Passwort für „Admin“ steht in der Datei ${DATEI}. Nach der ersten Anmeldung das Passwort ändern und die Datei löschen.`),
    'SC Panel Browser-Zugang: mit Datei steht der ganze Satz mit dem Pfad im Abschnitt',
  );
  const ohne = zugang(grundStand({ erstPasswort: { datei: DATEI, vorhanden: false } }));
  ok(
    text(ohne).includes('Keine Datei mit Erst-Passwort vorhanden. Konten verwaltet Setup › Benutzer.') && !text(ohne).includes(DATEI),
    'SC Panel Browser-Zugang: ohne Datei kein Pfad, dafür der Hinweis auf Setup › Benutzer',
  );
  const unbekannt = [zugang(grundStand()), zugang(grundStand({ erstPasswort: null }))];
  ok(unbekannt.every((h) => h !== '' && text(h).includes('Ort der Passwort-Datei unbekannt.')), 'SC Panel Browser-Zugang: vor der Antwort und ohne Brücke „Ort der Passwort-Datei unbekannt.“');
  const pille = (h: string): string | undefined => attr(tags(h, 'span').find((t) => attr(t, 'data-state') !== undefined), 'data-state');
  gleich([pille(mit), pille(ohne), pille(unbekannt[0]!)], ['warn', 'ok', 'off'], 'SC Panel Browser-Zugang: die Pille zeigt warn mit Datei, ok ohne Datei, off ohne Antwort');
  ok(!text(mit).includes('"') && !/password:/i.test(text(mit)), 'SC Panel Browser-Zugang: kein ASCII-Anführungszeichen und keine Zeile aus der Datei (kein „password:“)');
  pruefeIdVerweise(einstellungen(grundStand({ erstPasswort: { datei: DATEI, vorhanden: true } })), 'SC Panel Browser-Zugang: id-Verweise gültig');
  const p = QUELLE('views/Einstellungen.tsx');
  ok(
    /<RemoteControlSection[\s\S]*<SectionFrame/.test(p) && p.includes('browserZugang(stand.erstPasswort)') && p.includes('browserZugangStatus(stand.erstPasswort)'),
    'SC Panel Browser-Zugang: Einstellungen zeigt den SectionFrame unter der Fernsteuerung, Titel, Satz und Pille aus browserZugang',
  );
  const wurzel = QUELLE('views/StudioOberflaeche.tsx');
  ok(
    (wurzel.match(/useBrueckenWert\(panelOffen \? ERST_PASSWORT_QUELLE : undefined\)/g) ?? []).length === 1 && (wurzel.match(/ERST_PASSWORT_QUELLE/g) ?? []).length === 2 && /\berstPasswort,\s/.test(wurzel),
    'SC Panel Browser-Zugang: die Wurzel-View liest den Ort der Datei nur bei offenem Panel, bei jedem Öffnen neu (A9), und gibt ihn in den Stand',
  );
}

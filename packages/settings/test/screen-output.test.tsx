// ScreenOutputSection (Spec 6.2, 7, Plan E18): fehlender Bildschirm wird gemeldet, nie still ersetzt.
import { enthaelt, enthaeltNicht, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import {
  abschnittStatusItem,
  SCREEN_TEXTE,
  ScreenOutputSection,
  screenOutputView,
  type ScreenOption,
  type ScreenOutputSectionProps,
  type SectionStatus,
} from '../src/index';
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';

const s = (state: SectionStatus['state'], text: string): SectionStatus => ({ state, text });
const U = s('off', 'unbekannt');
const AUS = s('off', 'aus');
const AUS_OFFEN = s('warn', 'aus, Fenster noch offen');
const FEHLT = s('error', 'Bildschirm fehlt');
const OHNE = s('warn', 'an (ohne Rückmeldung)');
const NICHT_OFFEN = s('error', 'an, Fenster nicht offen');
const AUF_1 = s('ok', 'auf Bildschirm 1');
const AUF_2 = s('ok', 'auf Bildschirm 2');
const FEHLER = s('error', 'Fehler: Testfehler');

const ZWEI: ScreenOption[] = [
  { id: 11, label: 'Monitor 1 · 1920×1080', primary: true },
  { id: 22, label: 'Monitor 2 · 1920×1080', primary: false },
];
const LISTEN = { unbekannt: undefined, leer: [] as ScreenOption[], zwei: ZWEI };
const WAHL = { auto: null, vorhanden: 22, fehlt: 99 };

// Tabelle Eingang → status. Zeile = Liste|Wahl; Spalten = enabled false (windowOpen undefined, false, true),
// dann enabled true (windowOpen undefined, false, true). Ein gesetzter error schlägt alles (FEHLER).
const TABELLE: Record<string, SectionStatus[]> = {
  'unbekannt|auto': [U, U, U, U, U, U],
  'unbekannt|vorhanden': [U, U, U, U, U, U],
  'unbekannt|fehlt': [U, U, U, U, U, U],
  'leer|auto': [AUS, AUS, AUS_OFFEN, FEHLT, FEHLT, FEHLT],
  'leer|vorhanden': [FEHLT, FEHLT, FEHLT, FEHLT, FEHLT, FEHLT],
  'leer|fehlt': [FEHLT, FEHLT, FEHLT, FEHLT, FEHLT, FEHLT],
  'zwei|auto': [AUS, AUS, AUS_OFFEN, OHNE, NICHT_OFFEN, AUF_1],
  'zwei|vorhanden': [AUS, AUS, AUS_OFFEN, OHNE, NICHT_OFFEN, AUF_2],
  'zwei|fehlt': [FEHLT, FEHLT, FEHLT, FEHLT, FEHLT, FEHLT],
};
const SPALTE = (enabled: boolean, windowOpen: boolean | undefined): number =>
  (enabled ? 3 : 0) + (windowOpen === undefined ? 0 : windowOpen ? 2 : 1);

const basis: ScreenOutputSectionProps = { id: 'bildschirm', enabled: true, selectedId: null, capabilities: {} };

{
  const faelle = kreuz({
    enabled: [false, true],
    windowOpen: [undefined, false, true],
    liste: ['unbekannt', 'leer', 'zwei'],
    wahl: ['auto', 'vorhanden', 'fehlt'],
    error: [undefined, 'Testfehler'],
  } as const);
  const props = (f: (typeof faelle)[number]): ScreenOutputSectionProps => ({
    ...basis,
    enabled: f.enabled,
    windowOpen: f.windowOpen,
    screens: LISTEN[f.liste],
    selectedId: WAHL[f.wahl],
    error: f.error,
  });
  pruefeFaelle('Bildschirm Kreuzprodukt: Eingang → status aus der Tabelle', faelle, (f) => {
    const soll = f.error ? FEHLER : TABELLE[`${f.liste}|${f.wahl}`][SPALTE(f.enabled, f.windowOpen)];
    return vergleiche(statusText(screenOutputView(props(f)).status), statusText(soll));
  });
  pruefeFaelle('Bildschirm Kreuzprodukt: Auswahl springt nie still um (Wert bleibt die gewählte id)', faelle, (f) =>
    vergleiche(screenOutputView(props(f)).auswahlWert, f.wahl === 'auto' ? 'auto' : String(WAHL[f.wahl])),
  );
  pruefeFaelle('Bildschirm Kreuzprodukt: ok nur mit gemessen offenem Fenster', faelle, (f) =>
    screenOutputView(props(f)).status.state === 'ok' && f.windowOpen !== true ? 'ok ohne windowOpen === true' : null,
  );
}

{
  gleich(screenOutputView({ ...basis, screens: ZWEI }).hinweis, SCREEN_TEXTE.hinweis, 'Bildschirm: Tipp, wenn das Ziel der Hauptmonitor ist');
  gleich(screenOutputView({ ...basis, screens: ZWEI, selectedId: 22 }).hinweis, undefined, 'Bildschirm: kein Tipp auf dem zweiten Bildschirm');
  gleich(screenOutputView({ ...basis, screens: [] }).optionen, [{ value: 'auto', label: 'Kein Bildschirm gefunden' }], 'Bildschirm leer: einzige Option „Kein Bildschirm gefunden“');
  ok(screenOutputView({ ...basis, screens: [] }).auswahlGesperrt && !screenOutputView({ ...basis, screens: ZWEI }).auswahlGesperrt, 'Bildschirm: Auswahl nur bei leerer Liste gesperrt');
  gleich(
    [SCREEN_TEXTE.titel, SCREEN_TEXTE.bildschirm, SCREEN_TEXTE.vollbild, SCREEN_TEXTE.hintergrund, SCREEN_TEXTE.automatisch],
    ['Ausgabe auf Bildschirm', 'Bildschirm', 'Vollbild', 'Hintergrund', 'Automatisch (Hauptmonitor)'],
    'Bildschirm: Titel, Feldnamen und Automatik-Option wörtlich',
  );
}

// ── Darstellung ──
const alle: ScreenOutputSectionProps = {
  ...basis,
  windowOpen: true,
  screens: ZWEI,
  selectedId: 22,
  fullscreen: true,
  background: '#00B140',
  capabilities: { toggle: true, fullscreen: true, background: true },
};
{
  const html = render(<ScreenOutputSection {...alle} />);
  for (const t of ['>Ausgabe auf Bildschirm<', '>Ausgabe<', '>Bildschirm<', '>Vollbild<', '>Hintergrund<']) enthaelt(html, t, `Bildschirm alle capabilities: ${t}`);
  ok((html.match(/role="switch"/g) ?? []).length === 2, 'Bildschirm alle capabilities: zwei Schalter (Ausgabe, Vollbild)');
  enthaelt(html, '>Automatisch (Hauptmonitor)</option>', 'Bildschirm: feste Option „Automatisch (Hauptmonitor)“');
  enthaelt(html, '>Monitor 2 · 1920×1080</option>', 'Bildschirm: gemeldete Bildschirme als Optionen');
  enthaelt(html, 'value="#00B140"', 'Bildschirm: Hintergrund als Eingabe');
  enthaelt(html, 'auf Bildschirm 2', 'Bildschirm: Status „auf Bildschirm {n}“');
  pruefeIdVerweise(html, 'Bildschirm: alle id-Verweise gültig');
  ok(vor(html, '>Ausgabe<', '>Bildschirm<') && vor(html, '>Bildschirm<', '>Vollbild<') && vor(html, '>Vollbild<', '>Hintergrund<'), 'Bildschirm: Felder in fester Reihenfolge');
  gleich(bewegungsVerstoesse(html), [], 'Bildschirm: Übergänge nur motion-safe (G8)');
}
{
  const FELD = { toggle: 'ausgabe', fullscreen: 'vollbild', background: 'hintergrund' } as const;
  const faelle = kreuz({ toggle: [false, true], fullscreen: [false, true], background: [false, true] } as const);
  pruefeFaelle('Bildschirm capabilities: jedes Feld genau dann sichtbar, wenn seine eigene Capability gesetzt ist', faelle, (c) => {
    const s = screenOutputView({ ...alle, capabilities: c }).sichtbar;
    const falsch = (Object.keys(FELD) as Array<keyof typeof FELD>).filter((cap) => s[FELD[cap]] !== c[cap]);
    return falsch.length === 0 && s.auswahl ? null : `falsch: ${falsch.join(', ') || 'auswahl'}`;
  });
  const BESCHRIFTUNG = { toggle: '>Ausgabe<', fullscreen: '>Vollbild<', background: '>Hintergrund<' } as const;
  const daneben: string[] = [];
  for (const cap of Object.keys(BESCHRIFTUNG) as Array<keyof typeof BESCHRIFTUNG>) {
    const html = render(<ScreenOutputSection {...alle} capabilities={{ [cap]: true } as ScreenOutputSectionProps['capabilities']} />);
    for (const [andere, t] of Object.entries(BESCHRIFTUNG)) if (html.includes(t) !== (andere === cap)) daneben.push(`${cap}: ${t}`);
  }
  gleich(daneben, [], 'Bildschirm je Capability allein: genau ihr Feld erscheint, kein anderes');
}
{
  const html = render(<ScreenOutputSection {...alle} capabilities={{}} />);
  for (const t of ['>Ausgabe<', '>Vollbild<', '>Hintergrund<']) enthaeltNicht(html, t, `Bildschirm ohne capabilities: ${t} ausgeblendet`);
  ok((html.match(/<select/g) ?? []).length === 1 && !html.includes('role="switch"'), 'Bildschirm ohne capabilities: nur die Auswahl bleibt');
}
{
  const html = render(<ScreenOutputSection {...alle} selectedId={99} />);
  enthaelt(html, '>nicht verfügbar: zuvor gewählter Bildschirm</option>', 'Bildschirm fehlt: Auswahl zeigt „nicht verfügbar: …“ statt still den Hauptmonitor');
  enthaelt(html, 'Bildschirm fehlt', 'Bildschirm fehlt: Statustext');
}
{
  const html = render(<ScreenOutputSection {...alle} screens={[]} />);
  ok(/<select[^>]*disabled=""/.test(html), 'Bildschirm leere Liste: Auswahl gesperrt');
  enthaelt(html, 'Kein Bildschirm gefunden', 'Bildschirm leere Liste: Grund in der Auswahl sichtbar');
}
{
  // G6/Spec 7.2: Capability gesetzt, Wert nicht gemeldet – kein Schalter, der „aus“ behauptet (wie der Steuerserver, Task 19).
  const html = render(<ScreenOutputSection {...alle} fullscreen={undefined} />);
  ok((html.match(/role="switch"/g) ?? []).length === 1, 'Bildschirm fullscreen unbekannt: nur der Schalter Ausgabe, keiner, der „aus“ behauptet');
  ok(vor(html, '>Vollbild<', '>unbekannt</div>'), 'Bildschirm fullscreen unbekannt: Vollbild als „unbekannt“');
}
{
  const html = render(<ScreenOutputSection {...alle} screens={undefined} />);
  enthaeltNicht(html, '<select', 'Bildschirm Liste unbekannt: keine Auswahl (nichts Erfundenes)');
  enthaelt(html, '>unbekannt</div>', 'Bildschirm Liste unbekannt: Anzeige „unbekannt“');
}
{
  const html = render(<ScreenOutputSection {...alle} background="grün" />);
  enthaelt(html, 'Farbe als #RRGGBB eingeben.', 'Bildschirm: ungültige Farbe zeigt den Fehlertext am Feld');
  enthaelt(html, 'aria-invalid="true"', 'Bildschirm: ungültige Farbe setzt aria-invalid');
  pruefeIdVerweise(html, 'Bildschirm: Fehlertext per aria-describedby verknüpft');
}
{
  // E27: Der Text-Entwurf meldet nur eine gültige Farbe; „Noch nicht übernommen.“ steht als Feldfehler (Task 17).
  const quelle = leseText('src/abschnitte/ScreenOutputSection.tsx');
  ok(
    quelle.includes('const gesperrt = istGesperrt(view);') &&
      quelle.includes("useTextEntwurf(p.background ?? '', (neu) => p.onBackground?.(neu), (neu) => FARBE.test(neu), gesperrt)") &&
      quelle.includes('error={farbeFalsch ? SCREEN_TEXTE.farbeUngueltig : farbe.fehler}') &&
      quelle.includes('<TextInput {...farbe.feld} disabled={sperre} />'),
    'Bildschirm Verdrahtung: Hintergrund wird nur als gültige Farbe gemeldet, „Noch nicht übernommen.“ als Feldfehler (E27), die Sperre geht an den Entwurf',
  );
}
{
  const html = render(<ScreenOutputSection {...alle} locked="Vom Master vorgegeben" />);
  const z = sperrZaehlung(html);
  ok(z.alle === 4 && z.gesperrt === 4, `Bildschirm locked: alle Bedienelemente disabled (${z.gesperrt} von ${z.alle})`);
  ok(vor(html, 'Gesperrt: Vom Master vorgegeben', 'role="switch"'), 'Bildschirm locked: Grund sichtbar vor den Feldern');
}
{
  const html = render(<ScreenOutputSection {...alle} error="Fenster abgestürzt" />);
  ok(nachLetztem(html, 'data-fehler="true"', '<input'), 'Bildschirm error: Fehlertext nach den Feldern');
  enthaelt(html, 'Fehler: Fenster abgestürzt', 'Bildschirm error: Statustext');
}
{
  const p: ScreenOutputSectionProps = { ...alle, selectedId: 99 };
  const view = screenOutputView(p);
  const item = abschnittStatusItem(view, { group: 'ausgabe', label: 'Bildschirm' });
  const html = render(<ScreenOutputSection {...p} />);
  ok(item.state === 'error' && html.includes(`data-state="${item.state}"`) && html.includes(`>${item.detail}</span>`), 'Bildschirm: abschnittStatusItem = Statuspille (Zustand und Text)');
}

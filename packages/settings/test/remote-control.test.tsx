// RemoteControlSection (Spec 6.2 Absatz Fernsteuerung, 7, Plan E15, E16): Tool-Anzeige und Launcher-Vollform.
import { enthaelt, enthaeltNicht, gleich, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import {
  abschnittStatusItem,
  REMOTE_TEXTE,
  RemoteControlSection,
  remoteControlView,
  type RemoteControlLauncherProps,
  type RemoteControlSectionProps,
  type SectionStatus,
} from '../src/index';
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';

const s = (state: SectionStatus['state'], text: string): SectionStatus => ({ state, text });
const U = s('off', 'unbekannt');
const AUS = s('off', 'aus');
const BEREIT = s('ok', 'bereit');
const BEREIT_0 = s('ok', 'bereit · 0 verbunden');
const BEREIT_2 = s('ok', 'bereit · 2 verbunden');
const BELEGT = s('error', 'Port belegt');
const NEUSTART = s('warn', 'Neustart nötig');
const FEHLER = s('error', 'Fehler: Testfehler');

// Tabelle Tool: Zeile = running|clients, Spalten = (portInUse, restartRequired) in der Folge
// (–, –), (–, true), (true, –), (true, true). error schlägt alles; mode ändert den Tool-Status nie.
const TOOL: Record<string, [SectionStatus, SectionStatus, SectionStatus, SectionStatus]> = {
  'undefined|undefined': [U, NEUSTART, BELEGT, BELEGT],
  'undefined|0': [U, NEUSTART, BELEGT, BELEGT],
  'undefined|2': [U, NEUSTART, BELEGT, BELEGT],
  'false|undefined': [AUS, NEUSTART, BELEGT, BELEGT],
  'false|0': [AUS, NEUSTART, BELEGT, BELEGT],
  'false|2': [AUS, NEUSTART, BELEGT, BELEGT],
  'true|undefined': [BEREIT, NEUSTART, BELEGT, BELEGT],
  'true|0': [BEREIT_0, NEUSTART, BELEGT, BELEGT],
  'true|2': [BEREIT_2, NEUSTART, BELEGT, BELEGT],
};
const SPALTE = (portInUse?: boolean, restartRequired?: boolean): number => (portInUse ? 2 : 0) + (restartRequired ? 1 : 0);

const basis: RemoteControlSectionProps = { id: 'fernsteuerung', capabilities: {} };

{
  const faelle = kreuz({
    running: [undefined, false, true],
    clients: [undefined, 0, 2],
    portInUse: [undefined, true],
    restartRequired: [undefined, true],
    error: [undefined, 'Testfehler'],
    mode: [undefined, 'open', 'secure'],
  } as const);
  pruefeFaelle('Fernsteuerung Tool Kreuzprodukt: Eingang → status aus der Tabelle', faelle, (f) => {
    const soll = f.error ? FEHLER : TOOL[`${f.running}|${f.clients}`][SPALTE(f.portInUse, f.restartRequired)];
    return vergleiche(statusText(remoteControlView({ ...basis, ...f }).status), statusText(soll));
  });
  pruefeFaelle('Fernsteuerung Tool Kreuzprodukt: Clientzahl nur bei running === true, nie erfunden', faelle, (f) =>
    vergleiche(remoteControlView({ ...basis, ...f }).verbundenText, f.running === true && f.clients !== undefined ? String(f.clients) : undefined),
  );
  pruefeFaelle('Fernsteuerung Tool Kreuzprodukt: Modus offen/gesichert/unbekannt', faelle, (f) =>
    vergleiche(remoteControlView({ ...basis, ...f }).modusText, f.mode === 'open' ? 'offen' : f.mode === 'secure' ? 'gesichert' : 'unbekannt'),
  );
}

const OFFEN_OK = s('ok', 'offen');
const GES_OK = s('ok', 'gesichert');
const GES_HALB = s('warn', 'gesichert (unvollständig)');
const nichts = (): void => {};
const launcher = (l: Partial<RemoteControlLauncherProps>): RemoteControlLauncherProps => ({
  hasToken: false,
  hasTls: false,
  busy: false,
  onActivate: nichts,
  onDeactivate: nichts,
  ...l,
});
{
  // Tabelle Launcher: Zeile = mode, Spalten = (hasToken, hasTls) in der Folge (f,f), (f,t), (t,f), (t,t).
  const LAUNCHER: Record<string, [SectionStatus, SectionStatus, SectionStatus, SectionStatus]> = {
    undefined: [U, U, U, U],
    open: [OFFEN_OK, OFFEN_OK, OFFEN_OK, OFFEN_OK],
    secure: [GES_HALB, GES_HALB, GES_HALB, GES_OK],
  };
  const faelle = kreuz({
    mode: [undefined, 'open', 'secure'],
    hasToken: [false, true],
    hasTls: [false, true],
    revealedToken: [undefined, 'tok-123'],
    error: [undefined, 'Testfehler'],
  } as const);
  pruefeFaelle('Fernsteuerung Launcher Kreuzprodukt: Eingang → status aus der Tabelle', faelle, (f) => {
    const p: RemoteControlSectionProps = {
      ...basis,
      variante: 'launcher',
      mode: f.mode,
      error: f.error,
      launcher: launcher({ hasToken: f.hasToken, hasTls: f.hasTls, revealedToken: f.revealedToken }),
    };
    const soll = f.error ? FEHLER : LAUNCHER[`${f.mode}`][(f.hasToken ? 2 : 0) + (f.hasTls ? 1 : 0)];
    return vergleiche(statusText(remoteControlView(p).status), statusText(soll));
  });
  gleich(remoteControlView({ ...basis, variante: 'launcher', mode: 'secure' }).status, GES_HALB, 'Fernsteuerung Launcher ohne launcher-Props: gesichert gilt als unvollständig');
  gleich(remoteControlView(basis).variante, 'tool', 'Fernsteuerung: Vorgabe variante tool');
}

// ── Darstellung Tool ──
const tool: RemoteControlSectionProps = {
  ...basis,
  running: true,
  mode: 'secure',
  port: 8729,
  clients: 2,
  companionModule: 'packages/companion-jm-switcher',
  onOpenLauncher: nichts,
  launcher: launcher({ hasToken: true, hasTls: true, revealedToken: '0000-0000-0000-0000', tlsFingerprint: 'AB:CD', onCopyToken: nichts }),
};
{
  const html = render(<RemoteControlSection {...tool} />);
  for (const t of ['>Fernsteuerung<', '>Modus<', '>gesichert<', '>Port<', '>8729<', '>Verbunden<', '>2<']) enthaelt(html, t, `Fernsteuerung Tool: ${t}`);
  enthaelt(
    html,
    'Für ein Stream Deck über Bitfocus Companion: Modul „packages/companion-jm-switcher“. Dort Host (IP dieses Rechners) und Port eintragen.',
    'Fernsteuerung Tool: Companion-Hinweis mit Modulname',
  );
  enthaelt(html, '>Im Launcher einrichten</button>', 'Fernsteuerung Tool: Knopf „Im Launcher einrichten“ mit Rückruf (E15)');
  enthaelt(html, 'type="button"', 'Fernsteuerung Tool: Knopf ist type="button"');
  enthaeltNicht(html, '0000-0000-0000-0000', 'Fernsteuerung Tool: Token erscheint nie, auch wenn launcher.revealedToken gesetzt ist');
  const v = remoteControlView(tool).sichtbar;
  ok(!v.token && !v.tokenKopieren && !v.fingerabdruck && !v.aktionen && !v.tokenHinweis, 'Fernsteuerung Tool: Sicht gibt kein Launcher-Feld frei (Token, Fingerabdruck, Knöpfe)');
  enthaeltNicht(html, 'AB:CD', 'Fernsteuerung Tool: kein TLS-Fingerabdruck');
  enthaeltNicht(html, 'Aktivieren', 'Fernsteuerung Tool: keine Launcher-Knöpfe');
  enthaeltNicht(html, '<input', 'Fernsteuerung Tool ohne portEditable: Port nur als Anzeige');
  ok(vor(html, '>Modus<', '>Port<') && vor(html, '>Port<', '>Verbunden<') && vor(html, '>Verbunden<', 'Bitfocus') && vor(html, 'Bitfocus', 'Im Launcher einrichten'), 'Fernsteuerung Tool: Felder in fester Reihenfolge (Spec 6.2)');
  gleich(bewegungsVerstoesse(html), [], 'Fernsteuerung Tool: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)');
}
{
  const faelle = kreuz({ portEditable: [false, true], enableToggle: [false, true] } as const);
  pruefeFaelle('Fernsteuerung capabilities: Schalter genau mit enableToggle, Zahlenfeld genau mit portEditable', faelle, (c) => {
    const s = remoteControlView({ ...tool, capabilities: c }).sichtbar;
    return s.steuerung === c.enableToggle && s.portFeld === c.portEditable && s.port ? null : `steuerung ${s.steuerung}, portFeld ${s.portFeld}`;
  });
  const nurPort = render(<RemoteControlSection {...tool} enabled capabilities={{ portEditable: true }} />);
  const nurSchalter = render(<RemoteControlSection {...tool} enabled capabilities={{ enableToggle: true }} />);
  ok(
    nurPort.includes('<input') && !nurPort.includes('role="switch"') && nurSchalter.includes('role="switch"') && !nurSchalter.includes('<input'),
    'Fernsteuerung je Capability allein: genau ihr Feld erscheint, kein anderes',
  );
}
{
  const html = render(<RemoteControlSection {...tool} onOpenLauncher={undefined} />);
  enthaeltNicht(html, 'Im Launcher einrichten', 'Fernsteuerung Tool ohne Rückruf: kein Knopf (ausgeblendet, nicht ausgegraut)');
  enthaeltNicht(render(<RemoteControlSection {...tool} companionModule={undefined} />), 'Bitfocus', 'Fernsteuerung Tool ohne companionModule: kein Hinweis');
}
{
  const html = render(<RemoteControlSection {...tool} running={undefined} clients={0} />);
  enthaeltNicht(html, '>Verbunden<', 'Fernsteuerung running unbekannt: kein Feld „Verbunden“');
  enthaeltNicht(html, '0 verbunden', 'Fernsteuerung running unbekannt: nie „0 verbunden“ (Ist-Fehler Titler „Suite getrennt“)');
  enthaelt(html, '>unbekannt</span>', 'Fernsteuerung running unbekannt: Statuspille „unbekannt“');
}
{
  const html = render(<RemoteControlSection {...tool} mode={undefined} port={undefined} />);
  ok((html.match(/>unbekannt<\/div>/g) ?? []).length === 2 && vor(html, '>Modus<', '>unbekannt</div>'), 'Fernsteuerung: unbekannter Modus und Port als „unbekannt“');
}
{
  const html = render(<RemoteControlSection {...tool} enabled capabilities={{ portEditable: true, enableToggle: true }} />);
  enthaelt(html, 'role="switch"', 'Fernsteuerung enableToggle: Schalter');
  enthaelt(html, 'value="8729"', 'Fernsteuerung portEditable: Port als Zahlenfeld');
  pruefeIdVerweise(html, 'Fernsteuerung: alle id-Verweise gültig');
  const gesperrt = render(<RemoteControlSection {...tool} enabled capabilities={{ portEditable: true, enableToggle: true }} locked="Vom Master vorgegeben" />);
  const z = sperrZaehlung(gesperrt);
  ok(z.alle === 3 && z.gesperrt === 3, `Fernsteuerung locked: alle Bedienelemente disabled (${z.gesperrt} von ${z.alle})`);
  ok(vor(gesperrt, 'Gesperrt: Vom Master vorgegeben', 'role="switch"'), 'Fernsteuerung locked: Grund vor den Feldern');
}
{
  const html = render(<RemoteControlSection {...tool} error="Steuerserver abgestürzt" />);
  ok(nachLetztem(html, 'data-fehler="true"', 'Im Launcher einrichten'), 'Fernsteuerung error: Fehlertext nach den Feldern');
  enthaelt(html, 'Fehler: Steuerserver abgestürzt', 'Fernsteuerung error: Statustext');
}

// ── Darstellung Launcher-Vollform ──
{
  const html = render(<RemoteControlSection {...basis} variante="launcher" mode="open" onOpenLauncher={nichts} launcher={launcher({})} />);
  enthaelt(html, '>Aktivieren</button>', 'Launcher offen: Knopf „Aktivieren“');
  enthaeltNicht(html, 'Deaktivieren', 'Launcher offen: kein „Deaktivieren“');
  enthaeltNicht(html, 'Im Launcher einrichten', 'Launcher: kein Verweis auf sich selbst');
  enthaeltNicht(html, '>Port<', 'Launcher: kein Port');
  enthaelt(html, 'Wirkt beim nächsten Start jedes Tools.', 'Launcher: Hinweis „Wirkt beim nächsten Start jedes Tools.“');
}
{
  const l = launcher({ hasToken: true, hasTls: true, revealedToken: '0000-0000-0000-0000', tlsFingerprint: 'AB:CD', onCopyToken: nichts });
  const html = render(<RemoteControlSection {...basis} variante="launcher" mode="secure" launcher={l} />);
  for (const t of ['>Erneuern</button>', '>Deaktivieren</button>', 'Einmalig sichtbar – jetzt in Companion und Clients übernehmen:', '>0000-0000-0000-0000<', '>Token kopieren</button>', '>TLS-Fingerabdruck<', '>AB:CD<']) {
    enthaelt(html, t, `Launcher gesichert, Token frisch: ${t}`);
  }
  enthaeltNicht(html, 'nur beim Erzeugen oder Erneuern', 'Launcher Token frisch: kein „nur beim Erzeugen“-Hinweis');
  const spaeter = render(<RemoteControlSection {...basis} variante="launcher" mode="secure" launcher={{ ...l, revealedToken: undefined }} />);
  enthaeltNicht(spaeter, '0000-0000-0000-0000', 'Launcher später: Token nicht mehr sichtbar');
  enthaeltNicht(spaeter, 'Token kopieren', 'Launcher später: kein „Token kopieren“');
  enthaelt(spaeter, 'Das Token wird aus Sicherheitsgründen nur beim Erzeugen oder Erneuern angezeigt.', 'Launcher später: Hinweis zum Token');
  const busy = sperrZaehlung(render(<RemoteControlSection {...basis} variante="launcher" mode="secure" launcher={{ ...l, busy: true }} />));
  ok(busy.gesperrt === 2, `Launcher busy: Erneuern und Deaktivieren gesperrt (${busy.gesperrt})`);
  const zu = sperrZaehlung(render(<RemoteControlSection {...basis} variante="launcher" mode="secure" launcher={l} locked="Vom Master vorgegeben" />));
  ok(zu.alle === 3 && zu.gesperrt === 3, `Launcher locked: alle Bedienelemente disabled (${zu.gesperrt} von ${zu.alle})`);
  gleich(bewegungsVerstoesse(html), [], 'Launcher: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)');
}
{
  const view = remoteControlView({ ...tool, running: undefined });
  const item = abschnittStatusItem(view, { group: 'fernsteuerung', label: 'Companion' });
  const html = render(<RemoteControlSection {...tool} running={undefined} />);
  ok(item.state === 'off' && item.detail === 'unbekannt' && html.includes(`data-state="${item.state}"`) && html.includes(`>${item.detail}</span>`), 'Fernsteuerung: abschnittStatusItem = Statuspille (Zustand und Text)');
  gleich(REMOTE_TEXTE.titel, 'Fernsteuerung', 'Fernsteuerung: Titel wörtlich');
}

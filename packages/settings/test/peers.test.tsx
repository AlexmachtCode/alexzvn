// PeersSection „Gegenstellen“ (Spec 6.2, UO4, 7): unbekannt ist nicht „nicht gefunden“, Aus zählt nicht mit.
import { enthaelt, enthaeltNicht, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import {
  abschnittStatusItem,
  PEERS_TEXTE,
  peerAuto,
  PeersSection,
  peerSetzen,
  peerSetzenGrund,
  peersView,
  peerToggle,
  peerZeileStatus,
  type PeerRow,
  type PeersSectionProps,
  type SectionStatus,
} from '../src/index';
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';

const s = (state: SectionStatus['state'], text: string): SectionStatus => ({ state, text });
const U = s('off', 'unbekannt');
const AUS = s('off', 'aus');
const VERB = s('ok', 'verbunden');
const NG = s('warn', 'nicht gefunden');
const MAN = s('warn', 'manuell: 10.0.0.5:7777 · nicht verbunden');
const KEINE = s('off', 'keine Gegenstellen');
const FEHLER = s('error', 'Fehler: Testfehler');

const zeile = (r: Partial<PeerRow>): PeerRow => ({ role: 'timer', label: 'JM Timer', host: '', port: 7777, ...r });
const basis: PeersSectionProps = { id: 'gegenstellen', peers: [], capabilities: {} };

// Tabelle je Zeile: Zeile = enabled|connected; Spalten = source|host in der Folge
// (mdns, ''), (mdns, gesetzt), (manual, ''), (manual, gesetzt), (undefined, ''), (undefined, gesetzt).
const ZEILE: Record<string, SectionStatus[]> = {
  'undefined|undefined': [U, U, U, U, U, U],
  'undefined|false': [NG, NG, NG, MAN, NG, NG],
  'undefined|true': [VERB, VERB, VERB, VERB, VERB, VERB],
  'true|undefined': [U, U, U, U, U, U],
  'true|false': [NG, NG, NG, MAN, NG, NG],
  'true|true': [VERB, VERB, VERB, VERB, VERB, VERB],
  'false|undefined': [AUS, AUS, AUS, AUS, AUS, AUS],
  'false|false': [AUS, AUS, AUS, AUS, AUS, AUS],
  'false|true': [AUS, AUS, AUS, AUS, AUS, AUS],
};
const QUELLE = { mdns: 0, manual: 2, undefined: 4 };
// Abschnitt mit genau dieser einen Zeile: Zeilen-Status → Abschnitts-Status.
const EINE: Record<string, SectionStatus> = {
  [statusText(U)]: U,
  [statusText(AUS)]: KEINE,
  [statusText(VERB)]: VERB,
  [statusText(NG)]: s('warn', '0 von 1 verbunden'),
  [statusText(MAN)]: s('warn', '0 von 1 verbunden'),
};

{
  const faelle = kreuz({
    enabled: [undefined, true, false],
    connected: [undefined, false, true],
    source: ['mdns', 'manual', undefined],
    host: ['', '10.0.0.5'],
    error: [undefined, 'Testfehler'],
  } as const);
  const row = (f: (typeof faelle)[number]): PeerRow => zeile({ enabled: f.enabled, connected: f.connected, source: f.source, host: f.host });
  const sollZeile = (f: (typeof faelle)[number]): SectionStatus => ZEILE[`${f.enabled}|${f.connected}`][QUELLE[`${f.source}`] + (f.host ? 1 : 0)];
  pruefeFaelle('Gegenstellen Kreuzprodukt je Zeile: Eingang → status aus der Tabelle', faelle, (f) =>
    vergleiche(statusText(peerZeileStatus(row(f))), statusText(sollZeile(f))),
  );
  pruefeFaelle('Gegenstellen Kreuzprodukt eine Zeile: Abschnitt aus der Tabelle, error schlägt alles', faelle, (f) => {
    const soll = f.error ? FEHLER : EINE[statusText(sollZeile(f))];
    return vergleiche(statusText(peersView({ ...basis, error: f.error, peers: [row(f)] }).status), statusText(soll));
  });
}
{
  // Drei Zeilen, je Zeile aus, unbekannt, verbunden oder Warnung (4³ = 64 Fälle). Erwartung hängt nur von der
  // Anzahl je Art ab: Schlüssel = aus·unbekannt·verbunden·warn.
  const ART: Record<string, Partial<PeerRow>> = {
    aus: { enabled: false, connected: true },
    unbekannt: { connected: undefined },
    verbunden: { connected: true },
    warn: { connected: false, source: 'mdns' },
  };
  const DREI: Record<string, string> = {
    '3000': 'off keine Gegenstellen', '2100': 'off unbekannt', '2010': 'ok verbunden', '2001': 'warn 0 von 1 verbunden',
    '1200': 'off unbekannt', '1110': 'off unbekannt', '1101': 'warn 0 von 2 verbunden', '1020': 'ok verbunden',
    '1011': 'warn 1 von 2 verbunden', '1002': 'warn 0 von 2 verbunden', '0300': 'off unbekannt', '0210': 'off unbekannt',
    '0201': 'warn 0 von 3 verbunden', '0120': 'off unbekannt', '0111': 'warn 1 von 3 verbunden', '0102': 'warn 0 von 3 verbunden',
    '0030': 'ok verbunden', '0021': 'warn 2 von 3 verbunden', '0012': 'warn 1 von 3 verbunden', '0003': 'warn 0 von 3 verbunden',
  };
  const ARTEN = ['aus', 'unbekannt', 'verbunden', 'warn'] as const;
  const faelle = kreuz({ a: ARTEN, b: ARTEN, c: ARTEN } as const);
  pruefeFaelle('Gegenstellen Kreuzprodukt drei Zeilen: Abschnitt aus der Tabelle, Aus zählt nicht mit', faelle, (f) => {
    const arten = [f.a, f.b, f.c];
    const schluessel = ARTEN.map((a) => arten.filter((x) => x === a).length).join('');
    const peers = arten.map((a, i) => zeile({ role: `r${i}`, ...ART[a] }));
    return vergleiche(statusText(peersView({ ...basis, peers }).status), DREI[schluessel]);
  });
  gleich(peersView(basis).status, KEINE, 'Gegenstellen ohne Zeilen: „keine Gegenstellen“');
}
{
  // Ohne capabilities.toggle (Rundown, Q&A, Battle) kennt das Tool kein Aus je Gegenstelle: ein weggelassenes enabled heißt
  // „an“ (PeerRow: enabled nur mit capabilities.toggle). Das bleibt so.
  const v = peersView({ ...basis, peers: [zeile({ connected: true, source: 'mdns' })], capabilities: { auto: true } });
  ok(v.zeilen[0].aktiv === true && statusText(v.status) === 'ok verbunden', 'Gegenstellen ohne toggle: enabled weggelassen = an (kein Aus-Zustand im Tool)');
}
{
  // Mit capabilities.toggle (Stage-Display) meldet das Tool Ein/Aus je Quelle. Fehlt enabled, ist es unbekannt (G6, Spec 7.2):
  // die Zeile zählt nicht als aktiv, und der Abschnitt behauptet weder „verbunden“ noch „keine Gegenstellen“.
  const mitSchalter: PeersSectionProps = { ...basis, capabilities: { toggle: true } };
  const faelle = kreuz({ connected: [undefined, false, true] } as const);
  pruefeFaelle('Gegenstellen mit toggle, enabled nicht gemeldet: Zeile nicht aktiv (unbekannt), Abschnitt „unbekannt“', faelle, (f) => {
    const v = peersView({ ...mitSchalter, peers: [zeile({ connected: f.connected, source: 'mdns' })] });
    return v.zeilen[0].aktiv !== undefined ? `aktiv: ${v.zeilen[0].aktiv}` : vergleiche(statusText(v.status), 'off unbekannt');
  });
  // Zwei Zeilen, je Zeile aus, offen (enabled nicht gemeldet), verbunden, Warnung oder unbekannt (5² = 25 Fälle).
  // Schlüssel = Anzahl aus·offen·verbunden·warn·unbekannt. Offene Zeilen zählen nie in n; sie verhindern „ok“ und „keine“.
  const ART: Record<string, Partial<PeerRow>> = {
    aus: { enabled: false, connected: true },
    offen: { enabled: undefined, connected: true },
    verbunden: { enabled: true, connected: true },
    warn: { enabled: true, connected: false, source: 'mdns' },
    unbekannt: { enabled: true, connected: undefined },
  };
  const ZWEI: Record<string, string> = {
    '20000': 'off keine Gegenstellen', '11000': 'off unbekannt', '10100': 'ok verbunden', '10010': 'warn 0 von 1 verbunden',
    '10001': 'off unbekannt', '02000': 'off unbekannt', '01100': 'off unbekannt', '01010': 'warn 0 von 1 verbunden',
    '01001': 'off unbekannt', '00200': 'ok verbunden', '00110': 'warn 1 von 2 verbunden', '00101': 'off unbekannt',
    '00020': 'warn 0 von 2 verbunden', '00011': 'warn 0 von 2 verbunden', '00002': 'off unbekannt',
  };
  const ARTEN = ['aus', 'offen', 'verbunden', 'warn', 'unbekannt'] as const;
  const paare = kreuz({ a: ARTEN, b: ARTEN } as const);
  pruefeFaelle('Gegenstellen mit toggle, zwei Zeilen: Abschnitt aus der Tabelle, nicht gemeldetes enabled zählt nicht als aktiv', paare, (f) => {
    const arten = [f.a, f.b];
    const schluessel = ARTEN.map((a) => arten.filter((x) => x === a).length).join('');
    const peers = arten.map((a, i) => zeile({ role: `r${i}`, ...ART[a] }));
    return vergleiche(statusText(peersView({ ...mitSchalter, peers }).status), ZWEI[schluessel]);
  });
}

// ── Darstellung ──
const rundown: PeersSectionProps = {
  ...basis,
  peers: [
    zeile({ connected: true, source: 'mdns' }),
    zeile({ role: 'titler', label: 'JM Titler', host: '10.0.0.5', port: 7777, connected: false, source: 'manual' }),
    zeile({ role: 'switcher', label: 'JM Switcher', port: 0, defaultPort: 8729, connected: undefined, source: 'mdns' }),
  ],
  capabilities: { auto: true },
  onSet: () => {},
  onAuto: () => {},
};
{
  const html = render(<PeersSection {...rundown} />);
  for (const t of ['>Gegenstellen<', '>JM Timer<', '>JM Titler<', '>JM Switcher<', PEERS_TEXTE.erklaerung, 'placeholder="leer = automatisch"', '>gefunden<', '>manuell: 10.0.0.5:7777<']) {
    enthaelt(html, t, `Gegenstellen Rundown-Muster: ${t}`);
  }
  ok((html.match(/>Setzen<\/button>/g) ?? []).length === 3 && (html.match(/>Auto<\/button>/g) ?? []).length === 3, 'Gegenstellen: je Zeile „Setzen“ und „Auto“');
  ok((html.match(/>Host</g) ?? []).length === 3 && (html.match(/>Port</g) ?? []).length === 3 && (html.match(/>Verbunden</g) ?? []).length === 3, 'Gegenstellen: je Zeile Host, Port, Verbunden');
  enthaelt(html, 'value="10.0.0.5"', 'Gegenstellen: manueller Host im Feld');
  enthaelt(html, 'value="8729"', 'Gegenstellen: Port 0 zeigt den Standardport');
  enthaelt(html, '>1 von 3 verbunden</span>', 'Gegenstellen: Abschnitt „1 von 3 verbunden“ (Warnung schlägt unbekannt, unbekannt zählt in n)');
  ok(vor(html, '>Host<', '>Port<') && vor(html, '>Port<', '>Quelle<') && vor(html, '>Quelle<', '>Verbunden<'), 'Gegenstellen: Felder je Zeile in fester Reihenfolge');
  pruefeIdVerweise(html, 'Gegenstellen: alle id-Verweise gültig (mehrere Zeilen, eindeutige ids)');
  enthaeltNicht(html, 'role="switch"', 'Gegenstellen ohne toggle: kein Schalter');
  const gruppen = [...html.matchAll(/<div role="group" aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
  const namen = gruppen.map((id) => new RegExp(`id="${id}"[^>]*>([^<]*)<`).exec(html)?.[1]);
  gleich(namen, ['JM Timer', 'JM Titler', 'JM Switcher'], 'Gegenstellen: jede Zeile ist eine benannte Gruppe (role="group", aria-labelledby auf den Namen)');
  ok(
    html.includes('aria-label="Setzen: JM Titler"') && html.includes('aria-label="Auto: JM Switcher"'),
    'Gegenstellen: Knöpfe nennen ihre Gegenstelle („Setzen: JM Titler“, „Auto: JM Switcher“)',
  );
  gleich(bewegungsVerstoesse(html), [], 'Gegenstellen: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)');
}
{
  const stage: PeersSectionProps = {
    ...basis,
    peers: [
      zeile({ host: '10.0.0.7', connected: true, enabled: true }),
      zeile({ role: 'presenter', label: 'Presenter', host: '10.0.0.8', port: 7790, connected: undefined, enabled: false }),
    ],
    capabilities: { toggle: true },
    onSet: () => {},
    onToggle: () => {},
  };
  const html = render(<PeersSection {...stage} />);
  ok((html.match(/role="switch"/g) ?? []).length === 2, 'Gegenstellen Stage-Muster: je Zeile ein Schalter');
  enthaeltNicht(html, '>Auto</button>', 'Gegenstellen Stage-Muster: kein „Auto“ (ausgeblendet, nicht ausgegraut)');
  enthaeltNicht(html, 'mDNS', 'Gegenstellen Stage-Muster: keine Erklärung zu Auto');
  enthaeltNicht(html, 'placeholder=', 'Gegenstellen Stage-Muster: kein Platzhalter „leer = automatisch“');
  enthaeltNicht(html, '>Quelle<', 'Gegenstellen Stage-Muster: ohne source keine Quelle');
  enthaelt(html, '>verbunden</span>', 'Gegenstellen Stage-Muster: ausgeschaltete Zeile zählt nicht, Abschnitt „verbunden“');
  // G6/Spec 7.2: enabled nicht gemeldet – kein Schalter, der „an“ behauptet, sondern „unbekannt“ (wie Vollbild, Transparenz).
  const offen = render(<PeersSection {...stage} peers={[stage.peers[0], { ...stage.peers[1], enabled: undefined }]} />);
  ok((offen.match(/role="switch"/g) ?? []).length === 1, 'Gegenstellen Stage-Muster, enabled nicht gemeldet: nur der Schalter der gemeldeten Zeile');
  ok(
    offen.includes('data-anzeige="Aktiv"') && vor(offen, '>Presenter<', 'data-anzeige="Aktiv"') && vor(offen, 'data-anzeige="Aktiv"', '>unbekannt</div>'),
    'Gegenstellen Stage-Muster, enabled nicht gemeldet: „Aktiv“ als „unbekannt“ in der Zeile Presenter',
  );
}
{
  const html = render(<PeersSection {...rundown} onSet={undefined} onAuto={undefined} />);
  enthaeltNicht(html, '</button>', 'Gegenstellen ohne Rückrufe: keine Knöpfe');
  enthaeltNicht(html, PEERS_TEXTE.erklaerung, 'Gegenstellen ohne Rückrufe: keine Erklärung zu Setzen und Auto');
  const nurAuto = render(<PeersSection {...rundown} onSet={undefined} />);
  enthaeltNicht(nurAuto, PEERS_TEXTE.erklaerung, 'Gegenstellen nur mit Auto: keine Erklärung zum Setzen');
  const nurSetzen = render(<PeersSection {...rundown} onAuto={undefined} />);
  enthaeltNicht(nurSetzen, PEERS_TEXTE.erklaerung, 'Gegenstellen nur mit Setzen: keine Erklärung zu Auto');
}
{
  const html = render(<PeersSection {...rundown} locked="Vom Master vorgegeben" />);
  const z = sperrZaehlung(html);
  ok(z.alle === 12 && z.gesperrt === 12, `Gegenstellen locked: alle Bedienelemente disabled (${z.gesperrt} von ${z.alle})`);
  ok(vor(html, 'Gesperrt: Vom Master vorgegeben', '>JM Timer<'), 'Gegenstellen locked: Grund vor den Feldern');
}
{
  const html = render(<PeersSection {...rundown} error="mDNS-Suche abgebrochen" />);
  ok(nachLetztem(html, 'data-fehler="true"', 'data-rolle='), 'Gegenstellen error: Fehlertext nach allen Zeilen');
}
{
  const item = abschnittStatusItem(peersView(rundown), { group: 'verbindung', label: 'Gegenstellen' });
  const html = render(<PeersSection {...rundown} />);
  ok(item.state === 'warn' && html.includes(`>${item.detail}</span>`), 'Gegenstellen: abschnittStatusItem = Statuspille (Zustand und Text)');
}

// ── Verhalten: Rückrufe, Entwurf, Sperre, Quelle ──
{
  const aufrufe: unknown[][] = [];
  const mit: PeersSectionProps = { ...basis, onSet: (...a) => aufrufe.push(['set', ...a]), onAuto: (...a) => aufrufe.push(['auto', ...a]), onToggle: (...a) => aufrufe.push(['toggle', ...a]) };
  const r = zeile({ role: 'titler', host: '', port: 0, defaultPort: 8729 });
  ok(peerSetzen(mit, r, '  10.0.0.5  ', 7790) === true, 'Gegenstellen Setzen: Aufruf gemeldet');
  gleich(aufrufe, [['set', 'titler', '10.0.0.5', 7790]], 'Gegenstellen Setzen: Rolle, Host ohne Leerraum und der gezeigte Port gehen an onSet');
  aufrufe.length = 0;
  ok(peerSetzen(mit, r, '10.0.0.5', null) === false && aufrufe.length === 0, 'Gegenstellen Setzen: Port leer oder ungültig löst keinen Aufruf aus (nie der Port 0 des Modells)');
  ok(
    peerSetzen(mit, r, '10.0.0.5', 7790, false) === false && aufrufe.length === 0,
    'Gegenstellen Setzen: ungültiger Port-Entwurf („abc“, „70000“, leer) löst keinen Aufruf aus, auch nicht mit dem letzten gültigen Port',
  );
  ok(peerSetzen({ ...basis }, r, 'h', 1) === false, 'Gegenstellen Setzen ohne onSet: kein Aufruf, kein Absturz');
  const entwurf = peerAuto(mit, { ...r, host: '' });
  gleich(aufrufe, [['auto', 'titler']], 'Gegenstellen Auto: onAuto mit der Rolle');
  gleich(entwurf, { host: '', port: 8729 }, 'Gegenstellen Auto: Entwurf zurück auf automatisch (Host leer, Port wie angezeigt), auch wenn row.host schon leer war');
  gleich(peerAuto({ ...basis }, r), { host: '', port: 8729 }, 'Gegenstellen Auto ohne onAuto: kein Aufruf, Entwurf trotzdem zurückgesetzt');
  aufrufe.length = 0;
  peerToggle(mit, r, false);
  peerToggle(mit, r, true);
  gleich(aufrufe, [['toggle', 'titler', false], ['toggle', 'titler', true]], 'Gegenstellen Toggle: Rolle und neuer Zustand gehen an onToggle');
  peerToggle({ ...basis }, r, true);
  ok(aufrufe.length === 2, 'Gegenstellen Toggle ohne onToggle: kein Aufruf');
}
{
  // Quelle und Verbunden dürfen sich nicht widersprechen: manuell ohne Host ist automatisch.
  const leer = peersView({ ...basis, peers: [zeile({ source: 'manual', host: '', connected: false })] }).zeilen[0];
  gleich(statusText(leer.status), 'warn nicht gefunden', 'Gegenstellen manuell ohne Host: Verbunden „nicht gefunden“');
  gleich(leer.quelleText, undefined, 'Gegenstellen manuell ohne Host: keine Quelle „manuell: :7777“');
  const html = render(<PeersSection {...basis} peers={[zeile({ source: 'manual', host: '', connected: false })]} capabilities={{ auto: true }} onSet={() => {}} onAuto={() => {}} />);
  enthaeltNicht(html, 'manuell: :', 'Gegenstellen manuell ohne Host: in der Darstellung keine Quelle ohne Host');
  gleich(peersView({ ...basis, peers: [zeile({ source: 'manual', host: '10.0.0.5', connected: false })] }).zeilen[0].quelleText, 'manuell: 10.0.0.5:7777', 'Gegenstellen manuell mit Host: Quelle „manuell: Host:Port“');
}
{
  // Sperre: Schalter, Felder und Knöpfe im Stage-Muster; Setzen ohne gültigen Port gesperrt.
  const stage: PeersSectionProps = { ...basis, peers: [zeile({ host: '10.0.0.7', connected: true, enabled: true })], capabilities: { toggle: true }, onSet: () => {}, onToggle: () => {} };
  const z = sperrZaehlung(render(<PeersSection {...stage} locked="Vom Master vorgegeben" />));
  ok(z.alle === 4 && z.gesperrt === 4, `Gegenstellen locked im Stage-Muster: Schalter, Host, Port und Setzen disabled (${z.gesperrt} von ${z.alle})`);
  // Stage-Muster meldet Ein/Aus je Zeile (enabled); ohne Meldung stünde „Aktiv: unbekannt“ statt des Schalters.
  const ohnePort = render(<PeersSection {...stage} peers={[zeile({ port: 0, enabled: true })]} />);
  const zp = sperrZaehlung(ohnePort);
  ok(zp.alle === 4 && zp.gesperrt === 1 && /<button[^>]*disabled=""[^>]*>Setzen</.test(ohnePort), `Gegenstellen ohne gültigen Port: nur Setzen disabled (${zp.gesperrt} von ${zp.alle})`);
  // Gesperrt nie ohne Grund (Spec 6.1): der Grund steht sichtbar beim Knopf und ist ihm per aria-describedby zugeordnet.
  const grundId = /<p id="([^"]+)"[^>]*>Setzen geht erst mit einem gültigen Port\.<\/p>/.exec(ohnePort)?.[1];
  ok(
    grundId !== undefined && new RegExp(`<button[^>]*aria-describedby="${grundId}"[^>]*>Setzen<`).test(ohnePort),
    'Gegenstellen ohne gültigen Port: Grund „Setzen geht erst mit einem gültigen Port.“ sichtbar und am Knopf (aria-describedby)',
  );
  pruefeIdVerweise(ohnePort, 'Gegenstellen ohne gültigen Port: alle id-Verweise gültig');
  const gesperrtOhnePort = render(<PeersSection {...stage} peers={[zeile({ port: 0, enabled: true })]} locked="Vom Master vorgegeben" />);
  enthaeltNicht(gesperrtOhnePort, PEERS_TEXTE.setzenOhnePort, 'Gegenstellen locked ohne Port: nur der Sperrgrund des Abschnitts, kein zweiter Grund am Knopf');
  enthaelt(render(<PeersSection {...stage} />), '>Setzen</button>', 'Gegenstellen mit gültigem Port: Setzen ohne Grund');
  enthaeltNicht(render(<PeersSection {...stage} />), PEERS_TEXTE.setzenOhnePort, 'Gegenstellen mit gültigem Port: kein Grund am Knopf');
}
{
  // Setzen ist gesperrt, solange das Portfeld keinen gültigen Port zeigt: leer (port null) oder ein ungültiger Entwurf, den
  // NumberInput nicht meldet (der lokale Port stünde sonst beim letzten gültigen Wert). Gesperrt nennt den Abschnitt selbst.
  gleich(
    [
      peerSetzenGrund(false, 7777, true),
      peerSetzenGrund(false, 7777, false),
      peerSetzenGrund(false, null, true),
      peerSetzenGrund(false, null, false),
      peerSetzenGrund(true, 7777, false),
      peerSetzenGrund(true, null, true),
    ],
    [undefined, PEERS_TEXTE.setzenOhnePort, PEERS_TEXTE.setzenOhnePort, PEERS_TEXTE.setzenOhnePort, undefined, undefined],
    'Gegenstellen Setzen-Grund: ohne gültigen Port (leer oder ungültiger Entwurf) „Setzen geht erst mit einem gültigen Port.“, gesperrt ohne eigenen Grund',
  );
  gleich(PEERS_TEXTE.setzenOhnePort, 'Setzen geht erst mit einem gültigen Port.', 'Gegenstellen: Text des Setzen-Grunds wörtlich');
}
{
  // Der Klick selbst läuft ohne DOM nicht; die Verdrahtung wird an der Quelle geprüft (Auto verwirft den lokalen Entwurf).
  const q = leseText('src/abschnitte/PeersSection.tsx').replace(/\s+/g, ' ');
  ok(q.includes('const e = peerAuto(p, row); setHost(e.host); setPort(e.port);'), 'Gegenstellen Auto: der Klick setzt Host und Port des Entwurfs zurück');
  const fehlt = [
    'onEntwurfGueltig={setPortGueltig}',
    'const setzenGrund = peerSetzenGrund(gesperrt, port, portGueltig);',
    'peerSetzen(p, row, host, port, portGueltig)',
    'disabled={gesperrt || setzenGrund !== undefined}',
  ].filter((z) => !q.includes(z));
  ok(fehlt.length === 0, 'Gegenstellen Setzen: gleicher Host/Port wie im Feld, gesperrt ohne gültigen Port oder bei ungültigem Port-Entwurf');
  for (const z of fehlt) console.log(`     fehlt: ${z}`);
}

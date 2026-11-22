// UX Welle 1, Q&A d · Einstellungs-Panel (Spec 3.6, 5.1, 6, Anhang A „Q&A“; E13, E14): Fernsteuerung (nur Status) und Gegenstellen
// aus @jm/settings (PeersSection ersetzt das Modal ConnectionsPanel), dahinter die tool-eigenen Abschnitte „Redezeit und Kopplung“,
// „Moderation“ und „Extern“ (Inhalt des alten Einstellungs-Overlays). Jeder Statuseintrag mit Abschnitt findet seinen Anker.
// Render ohne Browser und ohne window.
import { PEERS_TEXTE, REMOTE_TEXTE } from '@jm/settings';
import { Field, NumberInput, Select, TextInput, Toggle } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { ABSCHNITT, QA_TEXTE, statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import { TON } from '@/lib/zugang-ton';
import { CAPABILITIES, COUPLED_ROLES } from '@/lib/capabilities';
import { Einstellungen, type EinstellungenAktionen } from '@/views/Einstellungen';
import { abschnitt, attr, basisMeldung, cloud, elemente, ohneKommentare, qaState, tags, text, toolLink } from './testzustand';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';

const T = QA_TEXTE;
function stand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { state: qaState(), masterLink: undefined, fernsteuerung: undefined, ...teil };
}
function aktionen(log: string[] = []): EinstellungenAktionen {
  return {
    setEndpoint: (r, h, p) => void log.push(`endpoint(${r}|${h}|${p})`),
    setConfig: (p) => void log.push(`config(${JSON.stringify(p)})`),
    setCloudConfig: (p) => void log.push(`cloudConfig(${JSON.stringify(p)})`),
    setProxyKey: (k) => void log.push(`key(${k})`),
    cloudGenerateEvent: () => void log.push('event'),
  };
}
const panel = (s: OberflaechenStand, log: string[] = []): string => render(<Einstellungen stand={s} aktionen={aktionen(log)} />);
const titel = (html: string): string[] => [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
/** Das Field mit dieser Beschriftung im unausgewerteten Baum von Einstellungen (die Abschnitte sind Funktionen, keine Komponenten). */
const feld = (s: OberflaechenStand, label: string, log: string[] = []): { props: Record<string, unknown> } =>
  elemente(Einstellungen({ stand: s, aktionen: aktionen(log) }), (e) => e.type === Field && e.props.label === label)[0] ?? { props: {} };
const kind = (f: { props: Record<string, unknown> }, typ: unknown): { props: Record<string, unknown> } => elemente(f, (e) => e.type === typ)[0] ?? { props: {} };

// ── QA Panel Abschnitte: Reihenfolge und Anker ──
{
  const s = stand();
  const html = panel(s);
  gleich(Object.values(ABSCHNITT).filter((id) => !html.includes(`id="einstellung-${id}"`)), [], 'QA Panel Abschnitte: Anker für alle ABSCHNITT-Werte (fernsteuerung, gegenstellen, redezeit, moderation, extern)');
  gleich(titel(html), [REMOTE_TEXTE.titel, PEERS_TEXTE.titel, T.titel.redezeit, T.titel.moderation, T.extern.titel], 'QA Panel Abschnitte: Fernsteuerung, Gegenstellen, Redezeit und Kopplung, Moderation, Extern in der Reihenfolge von ABSCHNITT (Anhang A, E13, E14)');
  gleich([T.titel.redezeit, T.titel.moderation, T.extern.titel], ['Redezeit und Kopplung', 'Moderation', 'Extern'], 'QA Panel Abschnitte: die Titel der tool-eigenen Abschnitte nach Anhang A');
  const ziele = statusLeiste(stand({ state: qaState({ links: [toolLink(), toolLink({ role: 'titler', label: 'JM Titler', port: 8710 })] }) })).map((i) => i.settingsSection).filter((z): z is string => typeof z === 'string');
  gleich(ziele.filter((z) => !html.includes(`id="einstellung-${z}"`)), [], 'QA Panel Abschnitte: jeder Statuseintrag mit Abschnitt (extern, kopplung-timer, kopplung-titler, fernsteuerung) findet seinen Anker');
  gleich(ziele, [ABSCHNITT.extern, ABSCHNITT.redezeit, ABSCHNITT.redezeit, ABSCHNITT.fernsteuerung], 'QA Panel Abschnitte: Extern springt in „Extern“, beide Kopplungen in „Redezeit und Kopplung“, Fernsteuerung in ihren Abschnitt (Master-Link und Saal nicht)');
  pruefeIdVerweise(html, 'QA Panel Abschnitte: id-Verweise gültig');
  ok(!text(html).includes('"'), 'QA Panel Abschnitte: kein ASCII-Anführungszeichen in den Texten des Panels');
  ok(T.kopplung.erklaerung.startsWith('Standardmäßig aktiv: Redezeit (Timer) und Bauchbinde (Titler)') && text(abschnitt(html, ABSCHNITT.redezeit)).includes(T.kopplung.erklaerung), 'QA Panel Abschnitte: der Erklärtext der alten Kopplungskarte steht als Beschreibung des Abschnitts „Redezeit und Kopplung“');
}

// ── QA Panel Redezeit und Kopplung: Felder, Schalter, Klemmwert ──
{
  const faelle = kreuz({ autoTimer: [false, true], autoTitler: [false, true], vorlage: ['lowerthird', 'banner', 'ticker'] as const });
  pruefeFaelle('QA Panel Redezeit: Schalter und Vorlage zeigen den Wert der Konfiguration', faelle, (f) => {
    const s = stand({ state: qaState({ config: { ...qaState().config, autoTimer: f.autoTimer, autoTitler: f.autoTitler, titlerTemplate: f.vorlage } }) });
    const schalter = (l: string): unknown => kind(feld(s, l), Toggle).props.checked;
    const wahl = kind(feld(s, 'Titler-Vorlage', []), Select).props.value;
    const h = abschnitt(panel(s), ABSCHNITT.redezeit);
    const an = tags(h, 'button').filter((t) => attr(t, 'role') === 'switch').map((t) => attr(t, 'aria-checked'));
    return (
      vergleiche(String(schalter('Redezeit-Timer automatisch')), String(f.autoTimer)) ??
      vergleiche(String(schalter('Bauchbinde automatisch')), String(f.autoTitler)) ??
      vergleiche(String(wahl), f.vorlage) ??
      vergleiche(an.join(','), `${f.autoTimer},${f.autoTitler}`)
    );
  });
  const log: string[] = [];
  const s = stand();
  (kind(feld(s, 'Redezeit-Timer automatisch', log), Toggle).props.onChange as (v: boolean) => void)(false);
  (kind(feld(s, 'Bauchbinde automatisch', log), Toggle).props.onChange as (v: boolean) => void)(false);
  (kind(feld(s, 'Titler-Vorlage', log), Select).props.onChange as (v: string) => void)('ticker');
  gleich(log, ['config({"autoTimer":false})', 'config({"autoTitler":false})', 'config({"titlerTemplate":"ticker"})'], 'QA Panel Redezeit: die Schalter und die Vorlage schicken genau ihr Feld an setConfig (die Schalter der Kopplungskarte leben nur noch hier, E13)');
  const zahl = kind(feld(s, 'Redezeit (Sekunden)', log), NumberInput);
  const sek: string[] = [];
  const zl = (kind(feld(stand(), 'Redezeit (Sekunden)', sek), NumberInput).props.onChange as (v: number) => void);
  [1, 4, 5, 90, 3600].forEach((v) => zl(v));
  gleich(sek, ['config({"speakSeconds":5})', 'config({"speakSeconds":5})', 'config({"speakSeconds":5})', 'config({"speakSeconds":90})', 'config({"speakSeconds":3600})'], 'QA Panel Redezeit: der Klemmwert Math.max(5, …) wirkt wie heute: nie weniger als 5 Sekunden an setConfig');
  gleich([zahl.props.value, zahl.props.min, zahl.props.max], [120, 5, 3600], 'QA Panel Redezeit: das Zahlenfeld zeigt speakSeconds mit den Grenzen 5 und 3600 des alten Feldes');
  const html = abschnitt(panel(stand()), ABSCHNITT.redezeit);
  const t = text(html);
  ok(
    ['Redezeit (Sekunden)', 'Setzt den JM Timer beim Ans-Wort-Holen.', 'Redezeit-Timer automatisch', 'JM Timer setzen + starten, wenn jemand ans Wort kommt.', 'Bauchbinde automatisch',
      'JM Titler beim Ans-Wort-Holen ein-/ausblenden. Name/Funktion werden mitgesendet — ein Titler mit text-Befehl übernimmt sie automatisch.', 'Titler-Vorlage', 'Bauchbinde', 'Banner', 'Ticker'].every((x) => t.includes(x)),
    'QA Panel Redezeit: alle Beschriftungen und Hinweise des alten Overlays stehen wörtlich im Abschnitt',
  );
  ok(src('views/Einstellungen.tsx').includes('Math.max(5,'), 'QA Panel Redezeit: der Klemmwert Math.max(5, …) steht im Quelltext');
}

// ── QA Panel Moderation ──
{
  const m = abschnitt(panel(stand({ state: qaState({ config: { ...qaState().config, moderation: true } }) })), ABSCHNITT.moderation);
  ok(text(m).includes('Saal-Einreichungen müssen erst freigegeben werden, bevor sie aufgerufen werden.') && m.includes('aria-checked="true"'), 'QA Panel Moderation: Schalter „Moderation“ mit dem Hinweis wörtlich, Zustand aus der Konfiguration');
  const log: string[] = [];
  (kind(feld(stand(), 'Moderation', log), Toggle).props.onChange as (v: boolean) => void)(true);
  gleich(log, ['config({"moderation":true})'], 'QA Panel Moderation: der Schalter schickt moderation an setConfig');
}

// ── QA Panel Gegenstellen: Timer und Titler mit Setzen und Auto, gefundene Adresse ──
{
  const log: string[] = [];
  const html = panel(stand(), log);
  const g = abschnitt(html, ABSCHNITT.gegenstellen);
  gleich([...g.matchAll(/data-rolle="([^"]*)"/g)].map((m) => m[1]), COUPLED_ROLES, 'QA Panel Gegenstellen: je gekoppelte Rolle (Timer, Titler) eine Zeile');
  const knoepfe = tags(g, 'button').map((t) => attr(t, 'aria-label'));
  gleich(COUPLED_ROLES.map((r) => [knoepfe.includes(PEERS_TEXTE.setzenFuer(CAPABILITIES[r].label)), knoepfe.includes(PEERS_TEXTE.autoFuer(CAPABILITIES[r].label))]), [[true, true], [true, true]], 'QA Panel Gegenstellen: je Rolle Setzen und Auto (Override entfernen)');
  ok(!g.includes('role="switch"'), 'QA Panel Gegenstellen: ohne An/Aus-Schalter (die Schalter stehen in „Redezeit und Kopplung“)');
  ok(text(g).includes(PEERS_TEXTE.erklaerung) && text(g).includes(T.gegenstellen.erklaerung), 'QA Panel Gegenstellen: die Erklärung aus @jm/settings und der Satz „Q&A koppelt …“ stehen da (der alte Erklärtext des Modals ist aufgeteilt)');
  const ohne = text(g);
  ok(!ohne.includes(`${T.gegenstellen.gefunden} `), 'QA Panel Gegenstellen: ohne Fund steht keine Adresse');
  const mit = panel(stand({ state: qaState({ links: [toolLink()] }) }));
  ok(text(mit).includes('gefunden: 10.0.0.7:8730'), 'QA Panel Gegenstellen: die per mDNS gefundene Adresse steht im Panel');
  const t = mit.slice(mit.indexOf('data-rolle="timer"'), mit.indexOf('data-rolle="titler"'));
  gleich(tags(t, 'input').map((x) => attr(x, 'value')).slice(0, 1), [''], 'QA Panel Gegenstellen: das Host-Feld bleibt leer (sonst machte Setzen aus einem Fund einen Override)');
  const q = Einstellungen({ stand: stand(), aktionen: aktionen(log) });
  const peers = elemente(q, (e) => typeof e.props.onSet === 'function')[0];
  (peers.props.onSet as (r: string, h: string, p: number) => void)('titler', '10.0.0.9', 8710);
  (peers.props.onAuto as (r: string) => void)('timer');
  gleich(log, ['endpoint(titler|10.0.0.9|8710)', 'endpoint(timer||0)'], 'QA Panel Gegenstellen: Setzen schickt Host und Port, Auto entfernt den Override (setEndpoint mit leerem Host)');
}

// ── QA Panel Fernsteuerung: nur Status ──
{
  const f = abschnitt(panel(stand({ fernsteuerung: basisMeldung({ clients: 2 }) })), ABSCHNITT.fernsteuerung);
  ok(text(f).includes('8733') && !f.includes('role="switch"') && !tags(f, 'input').length, 'QA Panel Fernsteuerung: zeigt Port 8733 und nur den Status (kein Schalter, kein Port-Feld)');
  const belegt = panel(stand({ fernsteuerung: { laeuft: false, port: 8733, clients: 0, modus: 'open', fehler: 'listen EADDRINUSE: address already in use :::8733' } }));
  ok(text(abschnitt(belegt, ABSCHNITT.fernsteuerung)).includes('belegt'), 'QA Panel Fernsteuerung: mit belegtem Port steht „belegt“');
}

// ── QA Extern wörtlich: alle Q-Texte aus dem Bestand im neuen Abschnitt ──
{
  const voll = cloud({
    enabled: true,
    configured: true,
    eventId: 'E-42',
    proxyUrl: 'https://relay.example',
    pressCode: 'PRESSE-1',
    hasKey: true,
    zugang: { art: 'alter-key', zeile: 'Zeile aus dem Main', ton: 'warn', hinweis: null },
    lastError: 'Noch kein Event. Erzeuge zuerst ein Event.',
  });
  const html = abschnitt(panel(stand({ state: qaState({ cloud: voll, config: { ...qaState().config, eventId: 'E-42', pressCode: 'PRESSE-1', proxyUrl: 'https://mein.relay' } }) })), ABSCHNITT.extern);
  const t = text(html);
  const q = (hint: string): boolean => t.includes(hint);
  ok(
    q('Fragen von außerhalb des Saal-WLANs — Ende-zu-Ende verschlüsselt über den Cloud-Relay. Presse per Zugangscode. Alle externen Einreichungen sind freigabepflichtig.') &&
      q('Server-Adresse') && q('Vorgabe: Server der Suite. Nur für Entwicklung und Fehlersuche ändern.') &&
      q('Alter Proxy-Key (Übergang)') && q('Nur noch kurz gültig. Mit Anmeldung im Launcher brauchst du ihn nicht.') &&
      q('Event') && q('ID: E-42') && q('Neues Event') &&
      q('Presse-Zugangscode') && q('Nur mit diesem Code kann Presse einreichen (leer = Presse-Kanal aus).') &&
      q('Fehler: Noch kein Event. Erzeuge zuerst ein Event.') && q('Zeile aus dem Main') && q('Speichern'),
    'QA Extern wörtlich: Einleitung, Server-Adresse (Q1), alter Proxy-Key (Q6a), Event, Presse-Zugangscode, Fehlerzeile und Zugangszeile stehen wörtlich im Abschnitt „Extern“',
  );
  gleich(
    [attr(tags(html, 'input')[0], 'placeholder'), attr(tags(html, 'input')[0], 'value'), tags(html, 'input').map((x) => attr(x, 'placeholder'))],
    ['https://relay.example', 'https://mein.relay', ['https://relay.example', '•••••• (ändern)', 'z. B. PRESSE-2026']],
    'QA Extern wörtlich: Q1 – der Platzhalter der Server-Adresse ist die wirksame Adresse (cloud.proxyUrl), das Feld zeigt den eigenen Wert; Platzhalter von Key („•••••• (ändern)“) und Presse-Code',
  );
  ok(attr(tags(html, 'input')[1], 'type') === 'password', 'QA Extern wörtlich: das Key-Feld ist ein Passwortfeld');
  ok(html.includes(`text-[11px] ${TON.warn}`), 'QA Extern wörtlich: die Zugangszeile trägt die Farbe ihres Tons (TON)');
  const frisch = abschnitt(panel(stand()), ABSCHNITT.extern);
  ok(text(frisch).includes('Noch kein Event erzeugt.') && text(frisch).includes('Event erzeugen') && !text(frisch).includes('Neues Event'), 'QA Extern wörtlich: ohne Event steht „Noch kein Event erzeugt.“ und der Knopf „Event erzeugen“');
  gleich(tags(frisch, 'input').filter((x) => attr(x, 'placeholder') === 'Key').length, 1, 'QA Extern wörtlich: ohne gespeicherten Key heißt der Platzhalter „Key“');
  const flach = (v: unknown): string[] => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(flach) : []);
  ok(!/Zugang|Freigabe|Token|Launcher/.test(flach(QA_TEXTE).join(' ')), 'QA Extern wörtlich: die Zugangstexte (Q1–Q12) stehen nicht in QA_TEXTE, sondern wörtlich in Einstellungen.tsx und im Main');
}

// ── QA Extern wörtlich: der alte Proxy-Key unter derselben Bedingung (cloud.hasKey || art !== 'freigabe') ──
{
  const faelle = kreuz({ hasKey: [false, true], art: ['freigabe', 'alter-key', 'keiner'] as const, hinweis: [null, 'Der alte Proxy-Key wurde gelöscht; Q&A nutzt jetzt die Freigabe des Launchers.'] });
  pruefeFaelle('QA Extern wörtlich: Feld alter Proxy-Key nur bei gespeichertem Key oder ohne Freigabe, sonst nur der Hinweis Q6b', faelle, (f) => {
    const s = stand({ state: qaState({ cloud: cloud({ hasKey: f.hasKey, zugang: { art: f.art, zeile: '', ton: 'ok', hinweis: f.hinweis } }) }) });
    const t = text(abschnitt(panel(s), ABSCHNITT.extern));
    const feldDa = t.includes('Alter Proxy-Key (Übergang)');
    const hinweisDa = t.includes('Der alte Proxy-Key wurde gelöscht; Q&A nutzt jetzt die Freigabe des Launchers.');
    const soll = f.hasKey || f.art !== 'freigabe';
    return vergleiche(`${feldDa}|${hinweisDa}`, `${soll}|${!soll && f.hinweis !== null}`);
  });
}

// ── QA Extern wörtlich: Rückrufe und Zugangszeile ──
{
  const log: string[] = [];
  const s = stand();
  (kind(feld(s, 'Server-Adresse', log), TextInput).props.onChange as (v: string) => void)('https://x.y');
  (kind(feld(s, 'Presse-Zugangscode', log), TextInput).props.onChange as (v: string) => void)('P-1');
  const ereignis = elemente(Einstellungen({ stand: s, aktionen: aktionen(log) }), (e) => e.props.children === 'Event erzeugen')[0];
  (ereignis.props.onClick as () => void)();
  gleich(log, ['cloudConfig({"proxyUrl":"https://x.y"})', 'cloudConfig({"pressCode":"P-1"})', 'event'], 'QA Extern wörtlich: Server-Adresse und Presse-Code gehen sofort an setCloudConfig, „Event erzeugen“ ruft cloudGenerateEvent (ohne Rückfrage wie heute)');
  const arten = kreuz({ ton: ['ok', 'warn', 'fehler'] as const });
  pruefeFaelle('QA Extern wörtlich: die Zugangszeile steht in der Farbe ihres Tons und fehlt bei leerer Zeile', arten, (f) => {
    const h = abschnitt(panel(stand({ state: qaState({ cloud: cloud({ zugang: { art: 'keiner', zeile: 'ZEILE', ton: f.ton, hinweis: null } }) }) })), ABSCHNITT.extern);
    const da = h.match(new RegExp(`<div class="[^"]*${TON[f.ton].replace(/[[\]()]/g, '\\$&')}[^"]*">ZEILE</div>`)) !== null;
    const leer = !text(abschnitt(panel(stand()), ABSCHNITT.extern)).includes('ZEILE');
    return vergleiche(`${da}|${leer}`, 'true|true');
  });
}

// ── QA Extern wörtlich: Quelltext der Einstellungen ──
{
  const q = ohneKommentare(src('views/Einstellungen.tsx'));
  ok(!q.includes('useEffect') && !/\bwindow\b/.test(q) && !q.includes('useQa(') && !/(^|\n)\s*(export )?const TON\b/.test(q), 'QA Panel Abschnitte: Einstellungen.tsx ohne window, ohne useEffect und ohne Store (G7, G8), TON nur aus lib/zugang-ton');
  ok(q.includes('<PeersSection {...gegenstellenAbschnitt(stand, aktionen)}') && q.includes('<RemoteControlSection {...fernsteuerungAbschnitt(stand)}'), 'QA Panel Abschnitte: die gemeinsamen Abschnitte bekommen ihre Props aus lib/oberflaeche.ts (eine Wahrheit mit der Statusleiste)');
  ok(q.includes("aktionen.setProxyKey(key);") && q.includes("setKey('');") && q.indexOf('aktionen.setProxyKey(key);') < q.indexOf("setKey('');"), 'QA Extern wörtlich: „Speichern“ schickt den Key und leert danach das Feld');
}

function src(d: string): string {
  return leseText(`src/renderer/src/${d}`);
}

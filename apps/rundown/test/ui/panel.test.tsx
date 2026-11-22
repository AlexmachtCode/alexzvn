// UX Welle 1, Rundown d · Einstellungs-Panel (Spec 3.6, 5.1, 6, Anhang A „Rundown“; E11, E12): iveo (nur Anzeige), Fernsteuerung (nur
// Status) und die Gegenstellen aus @jm/settings (PeersSection ersetzt das Modal ConnectionsPanel). Jeder Statuseintrag mit Abschnitt
// findet seinen Anker. Render ohne Browser und ohne window.
import { IVEO_TEXTE, PEERS_TEXTE, REMOTE_TEXTE } from '@jm/settings';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { existsSync } from 'node:fs';
import { CAPABILITIES, KNOWN_ROLES } from '@/lib/capabilities';
import { ABSCHNITT, statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import { Einstellungen } from '@/views/Einstellungen';
import { attr, basisMeldung, basisState, ohneKommentare, tags, text } from './testzustand';

function stand(teil: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { state: basisState(), masterLink: undefined, fernsteuerung: undefined, verbund: undefined, ...teil };
}
const panel = (s: OberflaechenStand, log: string[] = []): string =>
  render(<Einstellungen stand={s} aktionen={{ setEndpoint: (r, h, p) => void log.push(`${r}|${h}|${p}`) }} />);
/** Der Abschnitt mit dem Anker einstellung-{id}: vom Anker bis zum nächsten Anker (bzw. bis zum Ende). */
function abschnitt(html: string, id: string): string {
  const a = html.indexOf(`id="einstellung-${id}"`);
  if (a < 0) return '';
  const b = html.indexOf('id="einstellung-', a + 1);
  return html.slice(a, b < 0 ? undefined : b);
}
const titel = (html: string): string[] => [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);

// ── RD Panel Abschnitte: Reihenfolge und Anker ──
{
  const s = stand();
  const html = panel(s);
  gleich(
    Object.values(ABSCHNITT).filter((id) => !html.includes(`id="einstellung-${id}"`)),
    [],
    'RD Panel Abschnitte: Anker für alle ABSCHNITT-Werte (iveo, fernsteuerung, gegenstellen)',
  );
  gleich(titel(html), [IVEO_TEXTE.titel, REMOTE_TEXTE.titel, PEERS_TEXTE.titel], 'RD Panel Abschnitte: iveo, Fernsteuerung, Gegenstellen in der Reihenfolge von ABSCHNITT (Anhang A, E11, E12)');
  const links = [{ role: 'switcher', label: 'JM Switcher', host: '10.0.0.7', port: 8721, connected: true, source: 'mdns' as const, state: null }];
  const ziele = statusLeiste(stand({ state: basisState({ links }) })).map((i) => i.settingsSection).filter((z): z is string => typeof z === 'string');
  gleich(ziele.filter((z) => !html.includes(`id="einstellung-${z}"`)), [], 'RD Panel Abschnitte: jeder Statuseintrag mit Abschnitt (iveo, link-<rolle>, fernsteuerung) findet seinen Anker');
  gleich(ziele, [ABSCHNITT.iveo, ABSCHNITT.gegenstellen, ABSCHNITT.fernsteuerung], 'RD Panel Abschnitte: drei Statuseinträge springen ins Panel (Master-Link nicht)');
  pruefeIdVerweise(html, 'RD Panel Abschnitte: id-Verweise gültig');
  ok(!text(html).includes('"'), 'RD Panel Abschnitte: kein ASCII-Anführungszeichen in den Texten des Panels');
}

// ── RD Panel Abschnitte: Gegenstellen mit Setzen und Auto je Rolle ──
{
  const log: string[] = [];
  const html = panel(stand(), log);
  const g = abschnitt(html, ABSCHNITT.gegenstellen);
  const zeilen = [...g.matchAll(/data-rolle="([^"]*)"/g)].map((m) => m[1]);
  gleich(zeilen, [...KNOWN_ROLES], 'RD Panel Abschnitte: Gegenstellen führt jede bekannte Rolle als eine Zeile');
  const knoepfe = tags(g, 'button').map((t) => attr(t, 'aria-label'));
  gleich(knoepfe.filter((l) => KNOWN_ROLES.some((r) => l === PEERS_TEXTE.setzenFuer(CAPABILITIES[r].label))).length, KNOWN_ROLES.length, 'RD Panel Abschnitte: je Rolle ein Knopf Setzen');
  gleich(knoepfe.filter((l) => KNOWN_ROLES.some((r) => l === PEERS_TEXTE.autoFuer(CAPABILITIES[r].label))).length, KNOWN_ROLES.length, 'RD Panel Abschnitte: je Rolle ein Knopf Auto (Override entfernen)');
  ok(text(g).includes(PEERS_TEXTE.erklaerung), 'RD Panel Abschnitte: die Erklärung (mDNS oder manuell) steht aus @jm/settings, nicht nachgebaut');
  gleich(log, [], 'RD Panel Abschnitte: Rendern löst keine Aktion aus');
  const ohneSchalter = !g.includes('role="switch"');
  ok(ohneSchalter, 'RD Panel Abschnitte: Gegenstellen ohne An/Aus-Schalter (nur Setzen und Auto)');
  const q = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(q.includes('<PeersSection {...gegenstellenAbschnitt(stand, aktionen)}') && q.includes('<IveoSection {...iveoAbschnitt(stand)}') && q.includes('<RemoteControlSection {...fernsteuerungAbschnitt(stand)}'), 'RD Panel Abschnitte: die Abschnitte bekommen ihre Props aus lib/oberflaeche.ts (eine Wahrheit mit der Statusleiste)');
}

// ── RD Panel Abschnitte: iveo und Fernsteuerung nur Anzeige ──
{
  const i = abschnitt(panel(stand({ state: basisState({ showGemerkt: true, showMitIveo: true, iveoSpeakers: Array.from({ length: 3 }, (_, n) => ({ name: `S${n}` })) as never }) })), ABSCHNITT.iveo);
  ok(text(i).includes('3') && !tags(i, 'input').length, 'RD Panel Abschnitte: iveo zeigt die Zahl der Sprecher und hat kein Eingabefeld (nie ein Token-Feld)');
  const f = abschnitt(panel(stand({ fernsteuerung: basisMeldung({ clients: 2 }) })), ABSCHNITT.fernsteuerung);
  ok(text(f).includes('8731') && !f.includes('role="switch"') && !tags(f, 'input').length, 'RD Panel Abschnitte: Fernsteuerung zeigt Port 8731 und nur den Status (kein Schalter, kein Port-Feld)');
  const belegt = panel(stand({ fernsteuerung: { laeuft: false, port: 8731, clients: 0, modus: 'open', fehler: 'listen EADDRINUSE: address already in use :::8731' } }));
  ok(text(abschnitt(belegt, ABSCHNITT.fernsteuerung)).includes('belegt'), 'RD Panel Abschnitte: Fernsteuerung mit belegtem Port nennt „belegt“');
}

// ── RD Panel Abschnitte: Gegenstellen rufen setEndpoint ──
{
  const log: string[] = [];
  const q = Einstellungen({ stand: stand(), aktionen: { setEndpoint: (r, h, p) => void log.push(`${r}|${h}|${p}`) } });
  const gefunden: Array<{ onSet?: (r: string, h: string, p: number) => void; onAuto?: (r: string) => void }> = [];
  const sammle = (n: unknown): void => {
    if (Array.isArray(n)) n.forEach(sammle);
    else if (n && typeof n === 'object' && 'props' in n) {
      const p = (n as { props: { onSet?: never; onAuto?: never; children?: unknown } }).props;
      if (p.onSet) gefunden.push(p);
      sammle(p.children);
    }
  };
  sammle(q);
  gefunden[0]?.onSet?.('switcher', '10.0.0.9', 8721);
  gefunden[0]?.onAuto?.('timer');
  gleich(log, ['switcher|10.0.0.9|8721', 'timer||0'], 'RD Panel Abschnitte: Setzen schickt Host und Port, Auto entfernt den Override (setEndpoint mit leerem Host)');
}

// ── RD Panel Gegenstellen: Adresse und Leerzustand ──
{
  const link = { role: 'switcher', label: 'JM Switcher', host: '10.0.0.7', port: 8721, connected: true, source: 'mdns' as const, state: null };
  const KEIN = 'Noch keine Tools gefunden — Suite-Tools im selben Netz starten (mDNS) oder Verbindungen manuell setzen.';
  const ohne = panel(stand());
  const mit = panel(stand({ state: basisState({ links: [link] }) }));
  ok(text(ohne).includes(KEIN) && !text(mit).includes(KEIN), 'RD Panel Gegenstellen: der Leertext der alten Statusleiste steht wörtlich da, solange kein Tool gefunden ist, und verschwindet mit dem ersten Fund');
  ok(abschnitt(ohne, ABSCHNITT.gegenstellen).includes(KEIN) || ohne.indexOf(KEIN) > ohne.indexOf(`id="einstellung-${ABSCHNITT.gegenstellen}"`), 'RD Panel Gegenstellen: der Leertext steht im Gegenstellen-Bereich');
  ok(text(mit).includes('gefunden: 10.0.0.7:8721'), 'RD Panel Gegenstellen: die per mDNS gefundene Adresse (host:port) steht im Panel');
  const sw = mit.slice(mit.indexOf('data-rolle="switcher"'), mit.indexOf('data-rolle="', mit.indexOf('data-rolle="switcher"') + 1));
  gleich(tags(sw, 'input').map((t) => attr(t, 'value')).slice(0, 1), [''], 'RD Panel Gegenstellen: das Host-Feld bleibt leer (sonst würde Setzen aus einem Fund einen manuellen Override machen)');
  const keinFund = text(abschnitt(ohne, ABSCHNITT.gegenstellen));
  ok(!keinFund.includes('gefunden: ') , 'RD Panel Gegenstellen: ohne Fund steht keine Adresse und keine Quelle „gefunden“ im Abschnitt');
  ok(!/Quelle\s*gefunden/.test(keinFund), 'RD Panel Gegenstellen: eine Rolle ohne Fund zeigt nie „Quelle gefunden“');
}

// ── Quelltext: das Panel hat keine Abläufe, das alte Modal ist weg ──
{
  const q = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(!q.includes('useEffect') && !/\bwindow\b/.test(q) && !q.includes('useState'), 'RD Panel Abschnitte: Einstellungen.tsx ohne window, ohne useEffect und ohne eigenen Zustand (G7, G8)');
  gleich(['components/ConnectionsPanel.tsx', 'components/ToolLinks.tsx'].filter((d) => existsSync(`src/renderer/src/${d}`)), [], 'RD Panel Abschnitte: das Modal ConnectionsPanel und die Leiste ToolLinks sind entfernt (PeersSection und Statuseinträge ersetzen sie)');
}

// UX Welle 1, Timer d · Einstellungs-Panel (Spec 3.6, 5.1, 6, Anhang A „Timer“; E3, E9, E10): Fernsteuerung (nur Status), die
// tool-eigenen Abschnitte Speaker-Fenster, LAN-Fernbedienung (Inhalt von RemoteInfo) und Farben (Inhalt von ColorPicker). Jeder
// Statuseintrag mit Abschnitt findet seinen Anker. Render ohne Browser und ohne window.
import { ABSCHNITT_TEXTE } from '@jm/settings';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { ABSCHNITT, statusLeiste, TIMER_TEXTE, type OberflaechenStand, type TimerAktionen } from '@/lib/oberflaeche';
import { INITIAL_STATE } from '@shared/timer-state';
import { Einstellungen } from '@/views/Einstellungen';
import { attr, basisMeldung, mitStore, ohneKommentare, tags, text } from './testzustand';

const T = TIMER_TEXTE;
function stand(z: Partial<OberflaechenStand> = {}): OberflaechenStand {
  return { timer: INITIAL_STATE, connected: undefined, speakerOffen: undefined, masterLink: undefined, fernsteuerung: undefined, verbund: undefined, ...z };
}
function aktionen(log: string[] = []): TimerAktionen {
  return { toggleSpeaker: () => void log.push('toggleSpeaker') };
}
const panel = (s: OberflaechenStand, log: string[] = []): string => mitStore({}, () => render(<Einstellungen stand={s} aktionen={aktionen(log)} />));
/** Der Abschnitt mit dem Anker einstellung-{id}: vom Anker bis zum nächsten Anker (bzw. bis zum Ende). */
function abschnitt(html: string, id: string): string {
  const a = html.indexOf(`id="einstellung-${id}"`);
  if (a < 0) return '';
  const b = html.indexOf('id="einstellung-', a + 1);
  return html.slice(a, b < 0 ? undefined : b);
}
const titel = (html: string): string[] => [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);

// ── TI Panel Abschnitte: Reihenfolge und Anker ──
{
  const log: string[] = [];
  const s = stand();
  const html = panel(s, log);
  gleich(
    Object.values(ABSCHNITT).filter((id) => !html.includes(`id="einstellung-${id}"`)),
    [],
    'TI Panel Abschnitte: Anker für alle ABSCHNITT-Werte (fernsteuerung, speaker, lan, farben)',
  );
  gleich(
    titel(html),
    ['Fernsteuerung', T.titel.speaker, T.titel.lan, T.titel.farben],
    'TI Panel Abschnitte: Fernsteuerung, Speaker-Fenster, LAN-Fernbedienung, Farben in dieser Reihenfolge (Anhang A, E3, E9)',
  );
  const ziele = statusLeiste(s).map((i) => i.settingsSection).filter((z): z is string => typeof z === 'string');
  gleich(ziele.filter((z) => !html.includes(`id="einstellung-${z}"`)), [], 'TI Panel Abschnitte: jeder Statuseintrag mit Abschnitt (speaker, fernsteuerung) findet seinen Anker');
  gleich(ziele, [ABSCHNITT.speaker, ABSCHNITT.fernsteuerung], 'TI Panel Abschnitte: zwei Statuseinträge springen ins Panel, Master und Sync nicht; LAN-Fernbedienung hat keinen Eintrag (E10)');
  pruefeIdVerweise(html, 'TI Panel Abschnitte: id-Verweise gültig');
  gleich(log, [], 'TI Panel Abschnitte: Rendern löst keine Aktion aus');
}

// ── Fernsteuerung: nur Status, „Im Launcher einrichten“ als Text ──
{
  const html = panel(stand({ fernsteuerung: basisMeldung({ clients: 2 }) }));
  const f = abschnitt(html, ABSCHNITT.fernsteuerung);
  ok(
    f.includes(ABSCHNITT_TEXTE.imLauncherEinrichten) && !f.includes('role="switch"') && !tags(f, 'button').length && !tags(f, 'input').length,
    'TI Panel Abschnitte: Fernsteuerung zeigt nur den Status und den Hinweis „Im Launcher einrichten“ (kein Schalter, kein Port-Feld, kein Knopf ohne Handler)',
  );
  ok(text(f).includes('8724') && text(f).includes('2'), 'TI Panel Abschnitte: Fernsteuerung zeigt Port 8724 und die Zahl der Verbundenen');
  const belegt = panel(stand({ fernsteuerung: { laeuft: false, port: 8724, clients: 0, modus: 'open', fehler: 'listen EADDRINUSE: address already in use :::8724' } }));
  ok(text(abschnitt(belegt, ABSCHNITT.fernsteuerung)).includes('belegt'), 'TI Panel Abschnitte: Fernsteuerung mit belegtem Port nennt „belegt“');
}

// ── Speaker-Fenster (E3) ──
{
  const label = (o: boolean | undefined): string[] => {
    const a = abschnitt(panel(stand({ speakerOffen: o })), ABSCHNITT.speaker);
    return [...a.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]));
  };
  gleich([label(undefined), label(false), label(true)], [[T.speaker.oeffnen], [T.speaker.oeffnen], [T.speaker.schliessen]], 'TI Panel Abschnitte: Speaker-Fenster mit einem Knopf Öffnen bzw. Schließen je nach Zustand (E3)');
  const a = abschnitt(panel(stand()), ABSCHNITT.speaker);
  ok(text(a).includes(T.speaker.hinweis) && !a.includes('<select'), 'TI Panel Abschnitte: Speaker-Fenster nennt den Hinweis zum zweiten Bildschirm und bietet keine Bildschirmwahl (E3)');
  const quelle = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(quelle.includes('onClick={aktionen.toggleSpeaker}') || quelle.includes('onClick={() => aktionen.toggleSpeaker()}'), 'TI Panel Abschnitte: der Speaker-Knopf ruft die Aktion toggleSpeaker');
}

// ── LAN-Fernbedienung (Inhalt von RemoteInfo) und Farben (Inhalt von ColorPicker) ──
{
  const html = panel(stand());
  const lan = abschnitt(html, ABSCHNITT.lan);
  ok(
    text(lan).includes('Speaker-View im Browser öffnen') && text(lan).includes('Firewall: Port 7777') && text(lan).includes('Netzwerk-Adressen werden ermittelt…'),
    'TI Panel Abschnitte: LAN-Fernbedienung trägt die Texte der alten Remote-Ansicht (URLs, Hinweise) wörtlich',
  );
  const farben = abschnitt(html, ABSCHNITT.farben);
  ok(
    ['Normal', 'Warning', 'Overtime', 'Warning-Schwelle', 'Auf JM-Defaults zurücksetzen'].every((w) => text(farben).includes(w)) && tags(farben, 'input').filter((t) => attr(t, 'type') === 'color').length === 3,
    'TI Panel Abschnitte: Farben trägt Vorschau, drei Farbfelder, Warning-Schwelle und „Auf JM-Defaults zurücksetzen“ der alten Farben-Ansicht',
  );
  ok(!text(html).includes('"'), 'TI Panel Abschnitte: kein ASCII-Anführungszeichen in den Texten des Panels');
  for (const d of ['RemoteInfo', 'ColorPicker']) {
    const q = ohneKommentare(leseText(`src/renderer/src/components/${d}.tsx`));
    ok(!q.includes('SectionHeader') && !q.includes('./ui/'), `TI Panel Abschnitte: ${d}.tsx nutzt keine lokalen Ersatzbausteine mehr`);
  }
}

// ── Quelltext: das Panel hat keine Abläufe ──
{
  const q = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(!q.includes('useEffect') && !/\bwindow\b/.test(q) && !q.includes('sendCommand'), 'TI Panel Abschnitte: Einstellungen.tsx ohne window, ohne useEffect und ohne Socket-Befehle (G7, G8)');
}

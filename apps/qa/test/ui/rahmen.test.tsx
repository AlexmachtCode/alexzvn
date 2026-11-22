// UX Welle 1, Q&A d · Rahmen (Spec 3.1–3.3, 3.8, 5.1; E8, E13, E17): AppShell mit Kopf „JM Q&A“, „N wartend“ in der Kopfmitte,
// On-Air aus dem Sprecher am Wort, Hell/Dunkel, ⚙ und einem Panel, das beim Start zu ist; die Statusleiste aus lib/oberflaeche.ts.
// Die Kopplungskarte, das Einstellungs-Overlay und das Modal ConnectionsPanel sind weg. Render ohne Browser und ohne window.
import { ordneStatus } from '@jm/ui';
import { enthaeltNicht, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { existsSync } from 'node:fs';
import { statusLeiste } from '@/lib/oberflaeche';
import { QaOberflaeche, type QaViewAktionen } from '@/views/QaOberflaeche';
import { attr, eintragQ, ohneKommentare, qaState, statusEintraege, tags, text, toolLink } from './testzustand';

const KEINE: QaViewAktionen = {
  next() {},
  endActive() {},
  setRemote() {},
  setEndpoint() {},
  setConfig() {},
  setCloudConfig() {},
  setProxyKey() {},
  cloudGenerateEvent() {},
};
const seite = (state = qaState(), anfangOffen = false): string => render(<QaOberflaeche state={state} aktionen={KEINE} anfangOffen={anfangOffen} />);
const amWort = qaState({ activeId: 'a', entries: [eintragQ('a', 'active'), eintragQ('b', 'waiting'), eintragQ('c', 'waiting')] });

// ── QA Rahmen: Kopf, Kopfmitte, On-Air, ⚙, ThemeToggle, Panel zu ──
{
  const html = seite();
  const [zahnrad] = tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
  const [thema] = tags(html, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
  ok(text(html).includes('JM Q&A') && html.includes('data-bereich="inhalt"'), 'QA Rahmen: AppShell mit Kopf „JM Q&A“ (die alte Kopfzeile ist weg)');
  gleich(
    [attr(thema, 'aria-label'), attr(zahnrad, 'aria-label'), attr(zahnrad, 'aria-expanded')],
    ['Darstellung: Dunkel. Umschalten auf Hell', 'Einstellungen öffnen', 'false'],
    'QA Rahmen: ThemeToggle (E17) und ⚙ „Einstellungen öffnen“ im Kopf, Panel beim Start zu',
  );
  const offen = seite(qaState(), true);
  ok(offen.includes('aria-label="Einstellungen"') && !html.includes('aria-label="Einstellungen"'), 'QA Rahmen: das Panel ist beim Start zu und öffnet über den Anfangszustand');
  enthaeltNicht(html, 'Verbindungen', 'QA Rahmen: der Kopf-Knopf „Verbindungen“ ist weg (Panel-Abschnitt Gegenstellen)');
  enthaeltNicht(html, '>Einstellungen<', 'QA Rahmen: der Kopf-Knopf „Einstellungen“ ist weg (⚙)');
  pruefeIdVerweise(html + offen, 'QA Rahmen: id-Verweise im ganzen Bedienfenster gültig');
  ok(!text(html + offen).includes('"'), 'QA Rahmen: kein ASCII-Anführungszeichen in den gerenderten Texten');
}

// ── QA Rahmen: „N wartend“ in der Kopfmitte (E13), Zählung wie heute ──
{
  const mitte = (h: string): string => text(h.slice(h.indexOf('data-bereich="mitte"'), h.indexOf('data-bereich="onair"') >= 0 ? h.indexOf('data-bereich="onair"') : undefined));
  ok(mitte(seite()).includes('0 wartend'), 'QA Rahmen: ohne Wartende steht „0 wartend“ in der Kopfmitte');
  ok(mitte(seite(amWort)).includes('2 wartend'), 'QA Rahmen: „2 wartend“ in der Kopfmitte, der Sprecher am Wort zählt nicht mit');
  const unfrei = qaState({ entries: [eintragQ('a', 'waiting'), eintragQ('b', 'waiting', { source: 'remote', channel: 'stream', approved: false })] });
  ok(mitte(seite(unfrei)).includes('2 wartend'), 'QA Rahmen: die Zahl zählt auch den unfreigegebenen Eintrag, Zählung unverändert (E13)');
  const html2 = seite(amWort);
  const inhalt2 = html2.slice(html2.indexOf('data-bereich="inhalt"'));
  ok(!text(inhalt2).includes('wartend') && mitte(html2).includes('2 wartend'), 'QA Rahmen: „2 wartend“ steht in der Kopfmitte und kommt im Inhalt nicht vor');
}

// ── QA Rahmen: On-Air (E8) ──
{
  const live = seite(amWort);
  const bereit = seite();
  ok(live.includes('data-onair="live"') && !live.includes('data-onair="bereit"'), 'QA Rahmen: mit Sprecher am Wort zeigt der Kopf ON AIR (E8)');
  ok(bereit.includes('data-onair="bereit"') && !bereit.includes('data-onair="live"'), 'QA Rahmen: ohne Sprecher zeigt der Kopf „bereit“, nie ON AIR');
  const q = ohneKommentare(leseText('src/renderer/src/views/QaOberflaeche.tsx'));
  ok(q.includes('onAir={onAirKopf(stand)}'), 'QA Rahmen: die On-Air-Quelle ist onAirKopf aus lib/oberflaeche.ts');
}

// ── QA Rahmen: Statusleiste vor der ersten Antwort ──
{
  const html = seite();
  gleich(
    statusEintraege(html),
    [
      ['master-link', 'off', 'Master: unbekannt'],
      ['extern', 'off', 'Extern: aus'],
      ['kopplung-timer', 'warn', 'Kopplung Timer: nicht gefunden'],
      ['kopplung-titler', 'warn', 'Kopplung Titler: nicht gefunden'],
      ['fernsteuerung', 'off', 'Fernsteuerung: unbekannt'],
      ['saal', 'off', 'Saal-Einreichung: aus'],
    ],
    'QA Rahmen: Statusleiste vor der ersten Antwort: Master und Fernsteuerung unbekannt (off), Extern und Saal aus, beide Kopplungen an und nicht gefunden (warn), nie ok',
  );
  gleich(
    statusEintraege(html).map((e) => e[0]),
    ordneStatus(statusLeiste({ state: qaState(), masterLink: undefined, fernsteuerung: undefined })).map((i) => i.id),
    'QA Rahmen: die Leiste zeigt die Einträge in der Reihenfolge von ordneStatus (eine Wahrheit mit lib/oberflaeche.ts)',
  );
}

// ── QA Kopplungskarte entfällt (E13) ──
{
  const link = toolLink();
  const html = seite(qaState({ links: [link, toolLink({ role: 'titler', label: 'JM Titler', port: 8710 })] }));
  // Bis zur Statusleiste (footer): Deren Einträge heißen jetzt „Kopplung Timer“ und „Kopplung Titler“ (Fund C2) und gehören nicht zum Live-Bereich.
  const ende = html.indexOf('<footer');
  const inhalt = html.slice(html.indexOf('data-bereich="inhalt"'), ende >= 0 ? ende : undefined);
  const lebendig = text(inhalt);
  ok(!lebendig.includes('Kopplung') && !lebendig.includes('Auto-Kopplung') && !lebendig.includes('aktiviert · nicht gefunden') && !lebendig.includes('gekoppelt ·'), 'QA Kopplungskarte entfällt: die Karte „Kopplung“ steht nicht mehr im Live-Bereich (E13)');
  const knoepfe = tags(inhalt, 'button').map((t) => attr(t, 'title'));
  ok(!knoepfe.includes('Auto-Kopplung ausschalten') && !knoepfe.includes('Auto-Kopplung einschalten'), 'QA Kopplungskarte entfällt: die An/Aus-Knöpfe der Karte sind weg, die Schalter stehen nur im Panel');
  const ist = statusEintraege(html).filter((e) => e[0]?.startsWith('kopplung-'));
  gleich(ist, [['kopplung-timer', 'ok', 'Kopplung Timer: 10.0.0.7:8730'], ['kopplung-titler', 'ok', 'Kopplung Titler: 10.0.0.7:8710']], 'QA Kopplungskarte entfällt: beide Kopplungen stehen dreifarbig in der Statusleiste als „Kopplung Timer“ und „Kopplung Titler“ (verbunden = ok mit host:port)');
  const quellen = ['views/QaOberflaeche.tsx', 'views/LiveBereich.tsx', 'App.tsx'].map((d) => ohneKommentare(leseText(`src/renderer/src/${d}`)));
  ok(quellen.every((q) => !q.includes('COUPLED_ROLES') && !q.includes('Auto-Kopplung')), 'QA Kopplungskarte entfällt: Wächter am Quelltext: keine Kopplungskarte mehr in App, Oberfläche und Live-Bereich');
}

// ── QA Rahmen: Overlay und Modal sind weg, die Abläufe bleiben in der View ──
{
  const alt = ['components/Settings.tsx', 'components/ConnectionsPanel.tsx'].filter((d) => existsSync(`src/renderer/src/${d}`));
  gleich(alt, [], 'QA Rahmen: das Einstellungs-Overlay (Settings.tsx) und das Modal ConnectionsPanel sind entfernt (Panel-Abschnitte ersetzen sie)');
  const html = seite(qaState(), true);
  enthaeltNicht(html, 'fixed inset-0', 'QA Rahmen: kein Vollbild-Overlay mehr im Bedienfenster, auch nicht bei offenem Panel');
  const ober = ohneKommentare(leseText('src/renderer/src/views/QaOberflaeche.tsx'));
  ok(
    ober.includes('useBrueckenWert(MASTER_LINK_QUELLE)') && ober.includes('useBrueckenWert(FERNSTEUERUNG_QUELLE)') && ober.includes('status={statusLeiste(stand)}') && ober.includes('headerCenter={'),
    'QA Rahmen: Brücken, Kopfmitte und Statusleiste laufen in der View, auch bei geschlossenem Panel',
  );
  const app = ohneKommentare(leseText('src/renderer/src/App.tsx'));
  ok(app.includes('void load();') && app.includes('<QaOberflaeche') && !app.includes('showSettings') && !app.includes('showConnections'), 'QA Rahmen: App.tsx lädt weiter den Stand (immer gemountet) und setzt nur QaOberflaeche zusammen');
  ok(!ober.includes('localStorage') && !ober.includes('persistId'), 'QA Rahmen: der Panelzustand ist lokal und wird nicht gemerkt');
}

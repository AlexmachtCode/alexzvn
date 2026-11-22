// UX Welle 1, Battle d · Rahmen (Spec 3.1–3.3, 3.8, 5.1; E8, E16, E17): AppShell mit Kopf „JM Battle“, „Runde n/m“ in der Kopfmitte,
// On-Air aus dem VS, Hell/Dunkel, ⚙ und einem Panel, das beim Start zu ist; die Statusleiste aus lib/oberflaeche.ts. Die Kopf-Knöpfe
// „VS“, „Verbindungen“ und „Einstellungen“ sowie die Modals Settings und ConnectionsPanel sind weg. Render ohne Browser und ohne window.
import { ordneStatus } from '@jm/ui';
import { enthaeltNicht, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { existsSync } from 'node:fs';
import { statusLeiste } from '@/lib/oberflaeche';
import { BattleOberflaeche, type BattleViewAktionen } from '@/views/BattleOberflaeche';
import { attr, battleState, mitConfig, ohneKommentare, statusEintraege, tags, text, toolLink } from './testzustand';

const KEINE: BattleViewAktionen = {
  setLive() {},
  setVotingOpen() {},
  nextRound() {},
  clip() {},
  setCompetitor() {},
  swapCompetitors() {},
  prevRound() {},
  gotoRound() {},
  setJuryWinner() {},
  clearVotes() {},
  setRemote() {},
  pickRecording() {},
  pickClipDir() {},
  setConfig() {},
  setEndpoint() {},
  reset() {},
};
const seite = (state = battleState(), anfangOffen = false): string => render(<BattleOberflaeche state={state} aktionen={KEINE} anfangOffen={anfangOffen} />);

// ── BA Rahmen: Kopf, Kopfmitte, ThemeToggle, ⚙, Panel zu ──
{
  const html = seite();
  const [zahnrad] = tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
  const [thema] = tags(html, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
  ok(text(html).includes('JM Battle') && html.includes('data-bereich="inhalt"'), 'BA Rahmen: AppShell mit Kopf „JM Battle“ (die alte Kopfzeile ist weg)');
  gleich(
    [attr(thema, 'aria-label'), attr(zahnrad, 'aria-label'), attr(zahnrad, 'aria-expanded')],
    ['Darstellung: Dunkel. Umschalten auf Hell', 'Einstellungen öffnen', 'false'],
    'BA Rahmen: ThemeToggle (E17, Battle bekommt den Hell-Modus zum ersten Mal) und ⚙ „Einstellungen öffnen“ im Kopf, Panel beim Start zu',
  );
  const offen = seite(battleState(), true);
  ok(offen.includes('aria-label="Einstellungen"') && !html.includes('aria-label="Einstellungen"'), 'BA Rahmen: das Panel ist beim Start zu und öffnet über den Anfangszustand');
  enthaeltNicht(html, 'Verbindungen', 'BA Rahmen: der Kopf-Knopf „Verbindungen“ ist weg (Panel-Abschnitt Gegenstellen)');
  enthaeltNicht(html, '>Einstellungen<', 'BA Rahmen: der Kopf-Knopf „Einstellungen“ ist weg (⚙)');
  pruefeIdVerweise(html + offen, 'BA Rahmen: id-Verweise im ganzen Bedienfenster gültig');
  ok(!text(html + offen).includes('"'), 'BA Rahmen: kein ASCII-Anführungszeichen in den gerenderten Texten');
}

// ── BA Rahmen: „Runde n/m“ in der Kopfmitte ──
{
  const mitte = (h: string): string => text(h.slice(h.indexOf('data-bereich="mitte"'), h.indexOf('data-bereich="onair"') >= 0 ? h.indexOf('data-bereich="onair"') : undefined));
  ok(mitte(seite()).includes('Runde 2/3'), 'BA Rahmen: „Runde 2/3“ steht in der Kopfmitte (Text wie die alte Kopfzeile)');
  const fuenf = battleState({ round: 5, rounds: [1, 2, 3, 4, 5].map((round) => ({ round, juryWinner: null, votesA: 0, votesB: 0 })) });
  ok(mitte(seite(fuenf)).includes('Runde 5/5'), 'BA Rahmen: die Runde folgt dem Stand');
  const html = seite();
  ok(!text(html.slice(html.indexOf('data-bereich="inhalt"'))).includes('Runde 2/3'), 'BA Rahmen: „Runde 2/3“ steht nur im Kopf, nicht doppelt im Inhalt');
}

// ── BA Rahmen: On-Air (E8) ──
{
  const live = seite(battleState({ live: true }));
  const bereit = seite();
  ok(live.includes('data-onair="live"') && !live.includes('data-onair="bereit"'), 'BA Rahmen: bei VS on air zeigt der Kopf ON AIR (E8)');
  ok(bereit.includes('data-onair="bereit"') && !bereit.includes('data-onair="live"'), 'BA Rahmen: ohne VS zeigt der Kopf „bereit“, nie ON AIR');
  const q = ohneKommentare(leseText('src/renderer/src/views/BattleOberflaeche.tsx'));
  ok(q.includes('onAir={onAirKopf(stand)}'), 'BA Rahmen: die On-Air-Quelle ist onAirKopf aus lib/oberflaeche.ts');
}

// ── BA Rahmen: Statusleiste vor der ersten Antwort ──
{
  const html = seite();
  const ist = statusEintraege(html);
  gleich(
    ist.map((e) => [e[0], e[1]]),
    [
      ['master-link', 'off'],
      ['titler', 'warn'],
      ['fernsteuerung', 'off'],
      ['voting', 'off'],
      ['aufnahme-quelle', 'warn'],
    ],
    'BA Rahmen: Statusleiste vor der ersten Antwort: Master und Fernsteuerung unbekannt (off), Voting aus (off), Titler an und nicht gefunden (warn), Aufnahme-Quelle fehlt (warn), nie ok',
  );
  gleich([ist[0][2], ist[2][2]], ['Master: unbekannt', 'Fernsteuerung: unbekannt'], 'BA Rahmen: Master-Link und Fernsteuerung zeigen „unbekannt“ statt eines Zustands');
  gleich(
    ist.map((e) => e[0]),
    ordneStatus(statusLeiste({ state: battleState(), masterLink: undefined, fernsteuerung: undefined })).map((i) => i.id),
    'BA Rahmen: die Leiste zeigt die Einträge in der Reihenfolge von ordneStatus (eine Wahrheit mit lib/oberflaeche.ts)',
  );
  const verbunden = statusEintraege(seite(battleState({ links: [toolLink()] }))).filter((e) => e[0] === 'titler');
  gleich(verbunden, [['titler', 'ok', 'Kopplung Titler: 10.0.0.7:8735']], 'BA Rahmen: ein verbundener Titler steht als „Kopplung Titler“ mit host:port als ok in der Leiste (E16, C2)');
  const aus = statusEintraege(seite(mitConfig({ autoTitler: false }))).filter((e) => e[0] === 'titler');
  gleich(aus.map((e) => e[1]), ['off'], 'BA Rahmen: bei „VS automatisch“ aus ist der Titler-Eintrag off, nie warn');
}

// ── BA Rahmen: Modals sind weg, die Abläufe bleiben in der View ──
{
  const alt = ['components/Settings.tsx', 'components/ConnectionsPanel.tsx'].filter((d) => existsSync(`src/renderer/src/${d}`));
  gleich(alt, [], 'BA Rahmen: das Einstellungs-Modal (Settings.tsx) und das Modal ConnectionsPanel sind entfernt (Panel-Abschnitte ersetzen sie)');
  const html = seite(battleState(), true);
  enthaeltNicht(html, 'fixed inset-0', 'BA Rahmen: kein Vollbild-Overlay mehr im Bedienfenster, auch nicht bei offenem Panel');
  const ober = ohneKommentare(leseText('src/renderer/src/views/BattleOberflaeche.tsx'));
  ok(
    ober.includes('useBrueckenWert(MASTER_LINK_QUELLE)') && ober.includes('useBrueckenWert(FERNSTEUERUNG_QUELLE)') && ober.includes('status={statusLeiste(stand)}') && ober.includes('headerCenter={'),
    'BA Rahmen: Brücken, Kopfmitte und Statusleiste laufen in der View, auch bei geschlossenem Panel',
  );
  const app = ohneKommentare(leseText('src/renderer/src/App.tsx'));
  ok(app.includes('void load();') && app.includes('<BattleOberflaeche') && !app.includes('showSettings') && !app.includes('showConnections'), 'BA Rahmen: App.tsx lädt weiter den Stand (immer gemountet) und setzt nur BattleOberflaeche zusammen');
  const store = ohneKommentare(leseText('src/renderer/src/store/useBattle.ts'));
  ok(store.includes('let subscribed = false;') && store.includes('if (!subscribed) {'), 'BA Rahmen: das subscribed-Flag im Store bleibt (ein Abonnement, auch nach erneutem load)');
  ok(!ober.includes('localStorage') && !ober.includes('persistId'), 'BA Rahmen: der Panelzustand ist lokal und wird nicht gemerkt');
  ok(leseText('src/renderer/index.html').includes('class="dark"'), 'BA Rahmen: index.html behält class="dark" (Dunkel ist der Start)');
}

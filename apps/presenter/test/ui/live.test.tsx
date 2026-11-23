// UX Welle 2b, Presenter d2 · Live-Bereich des Referenten (B6, B12, B13, Muster d): aktuelle Folie, darunter eine Reihe
// Schwarz · Zurück · „Gehe zu“ · Weiter · Weiß mit vier TallyButtons samt Kürzelzeile (B, ←, →, W), rechts Timer-Leiste, nächste
// Folie und Notizen; die Folienübersicht liegt nur im Inhalt. Render ohne Browser und ohne window; Rückrufe hookloser Komponenten
// werden über den Elementbaum ausgelöst.
import { TallyButton } from '@jm/ui';
import { gleich, leseText, ok, render } from '@jm/ui/testhilfe';
import { PRESENTER_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import * as live_ from '@/views/PresenterView';
import { geheZuIndex, HauptTasten, PresenterView, Uebersicht } from '@/views/PresenterView';
import { ReferentRahmen } from '@/views/ReferentOberflaeche';
import { aktionenAttrappe, attr, bereich, elemente, laufend, ohneKommentare, referentAttrappe, referentFolien, referentStand, tags, text, timerZustand } from './testzustand';

const T = PRESENTER_TEXTE;
const live = (s: OberflaechenStand = referentStand(), uebersicht = false, folien: ReturnType<typeof referentFolien> | null = referentFolien(), log: string[] = []): string =>
  render(<PresenterView stand={s} folien={folien} referent={referentAttrappe(log)} uebersicht={uebersicht} onUebersicht={(o) => void log.push(`uebersicht(${o})`)} />);
const TASTEN = ['taste-schwarz', 'taste-zurueck', 'taste-weiter', 'taste-weiss'] as const;
/** Haupttaste im HTML: Zustand, Beschriftung, Kürzel in der eigenen Zeile, Sperrgrund. */
const taste = (html: string, k: (typeof TASTEN)[number]): { state?: string; label: string; kuerzel: string; zeile: boolean; grund?: string } => {
  const b = bereich(html, 'data-presenter', k);
  const [knopf] = tags(b, 'button');
  const zeile = bereich(b, 'data-kuerzel-zeile', '');
  const label = text(/<span>([^<]*)<\/span>/.exec(b)?.[1] ?? '');
  return { state: attr(knopf, 'data-state'), label, kuerzel: text(zeile).slice(-1), zeile: zeile !== '', grund: attr(knopf, 'title') };
};

// ── PS Reihenfolge unter der Folie: Schwarz, Zurück, „Gehe zu“, Weiter, Weiß; vier TallyButton mit Kürzeln (B12) ──
{
  const html = live();
  const reihe = bereich(html, 'data-presenter', 'tasten');
  gleich(
    [...reihe.matchAll(/data-presenter="(taste-[a-z]+|gehe-zu)"/g)].map((m) => m[1]),
    ['taste-schwarz', 'taste-zurueck', 'gehe-zu', 'taste-weiter', 'taste-weiss'],
    'PS Reihenfolge unter der Folie: Schwarz · Zurück · „Gehe zu“ · Weiter · Weiß (Zurück und Weiter links und rechts von „Gehe zu“, Schwarz und Weiß an den Rändern)',
  );
  gleich(
    TASTEN.map((k) => taste(html, k)),
    [
      { state: 'bereit', label: T.taste.schwarz, kuerzel: 'B', zeile: true, grund: undefined },
      { state: 'bereit', label: T.taste.zurueck, kuerzel: '←', zeile: true, grund: undefined },
      { state: 'bereit', label: T.taste.weiter, kuerzel: '→', zeile: true, grund: undefined },
      { state: 'bereit', label: T.taste.weiss, kuerzel: 'W', zeile: true, grund: undefined },
    ],
    'PS Reihenfolge unter der Folie: vier TallyButton mit Kürzelzeile (B, ←, →, W), auf Folie 2 alle bereit',
  );
  ok((reihe.match(/data-state="/g) ?? []).length === 4 && (reihe.match(/data-kuerzel-zeile=""/g) ?? []).length === 4, 'PS Reihenfolge unter der Folie: genau vier Haupttasten, jede mit eigener Kürzelzeile');
  ok(
    /^<div data-presenter="tasten" class="[^"]*\bitems-stretch\b/.test(reihe) && TASTEN.every((k) => new RegExp(`<div data-presenter="${k}" class="[^"]*\\bflex\\b[^"]*\\bmin-w-24\\b[^"]*\\bflex-1\\b`).test(reihe)),
    'PS Reihenfolge unter der Folie: die vier Tasten einer Zeile sind gleich hoch (items-stretch, Hülle flex): bricht eine Beschriftung um („Schwarz · an“ bei 1024 breit, gemessen 92 px), wachsen alle mit',
  );
  const g = bereich(reihe, 'data-presenter', 'gehe-zu');
  ok(g.startsWith('<form') && attr(tags(g, 'input')[0], 'placeholder') === 'Folie' && text(g).includes('Gehe zu') && attr(tags(g, 'button')[0], 'type') === 'submit', 'PS Reihenfolge unter der Folie: „Gehe zu“ bleibt Feld „Folie“ und Knopf „Gehe zu“ (Absenden springt)');
  const aktuell = bereich(html, 'data-presenter', 'aktuelle-folie');
  ok(aktuell.includes('<canvas') && html.indexOf('data-presenter="aktuelle-folie"') < html.indexOf('data-presenter="tasten"'), 'PS Reihenfolge unter der Folie: die Reihe steht unter der aktuellen Folie, die Folie ohne Klick sichtbar');
}

// ── PS Haupttasten je Zustand (B13, B6): Sperren mit Grund, Schwarz und Weiß als Umschalter, nie live ──
{
  const fall = (s: OberflaechenStand) => TASTEN.map((k) => taste(live(s), k)).map((t) => `${t.state}:${t.label}${t.grund ? `:${t.grund}` : ''}`);
  gleich(
    [
      fall(referentStand({ praesentation: laufend({ index: 0 }) })),
      fall(referentStand({ praesentation: laufend({ index: 2 }) })),
      fall(referentStand({ praesentation: laufend({ index: 2, schleife: true }) })),
      fall(referentStand({ praesentation: laufend({ index: 1, screen: 'black' }) })),
      fall(referentStand({ praesentation: laufend({ index: 1, screen: 'white' }) })),
      fall(referentStand({ praesentation: undefined })),
    ],
    [
      [`bereit:${T.taste.schwarz}`, `gesperrt:${T.taste.zurueck}:${T.grund.ersteFolie}`, `bereit:${T.taste.weiter}`, `bereit:${T.taste.weiss}`],
      [`bereit:${T.taste.schwarz}`, `bereit:${T.taste.zurueck}`, `gesperrt:${T.taste.weiter}:${T.grund.letzteFolie}`, `bereit:${T.taste.weiss}`],
      [`bereit:${T.taste.schwarz}`, `bereit:${T.taste.zurueck}`, `bereit:${T.taste.weiter}`, `bereit:${T.taste.weiss}`],
      [`bereit:${T.taste.schwarz}${T.taste.an}`, `bereit:${T.taste.zurueck}`, `bereit:${T.taste.weiter}`, `bereit:${T.taste.weiss}`],
      [`bereit:${T.taste.schwarz}`, `bereit:${T.taste.zurueck}`, `bereit:${T.taste.weiter}`, `bereit:${T.taste.weiss}${T.taste.an}`],
      [T.taste.schwarz, T.taste.zurueck, T.taste.weiter, T.taste.weiss].map((l) => `gesperrt:${l}:${T.grund.zustandOffen}`),
    ],
    'PS Haupttasten je Zustand: Zurück gesperrt auf der ersten Folie, Weiter auf der letzten nur ohne Schleife; Schwarz/Weiß „ · an“ während der Pause; vor der ersten Antwort alle mit „Lädt …“',
  );
  ok(!live(referentStand()).includes('data-state="live"') && !live(referentStand({ praesentation: laufend({ index: 1, screen: 'black' }) })).includes('data-state="live"'), 'PS Haupttasten je Zustand: keine Haupttaste des Referenten ist je live (B3)');
  const log: string[] = [];
  const alle = elemente(HauptTasten({ stand: referentStand(), anzahl: 3, referent: referentAttrappe(log) }));
  const tb = alle.filter((e) => e.type === TallyButton);
  for (const e of tb) (e.props.onClick as (() => void) | undefined)?.();
  gleich(
    [tb.map((e) => [e.props.label, e.props.shortcut, e.props.kuerzelZeile]), log],
    [
      [
        [T.taste.schwarz, 'B', true],
        [T.taste.zurueck, '←', true],
        [T.taste.weiter, '→', true],
        [T.taste.weiss, 'W', true],
      ],
      ['schwarz', 'zurueck', 'weiter', 'weiss'],
    ],
    'PS Haupttasten je Zustand: Schwarz, Zurück, Weiter und Weiß lösen ihre Aktion aus (setScreen black, prev, next, setScreen white)',
  );
  gleich(
    [geheZuIndex('3', 3), geheZuIndex('1', 3), geheZuIndex('0', 3), geheZuIndex('4', 3), geheZuIndex('', 3), geheZuIndex('2', 0)],
    [2, 0, null, null, null, null],
    'PS Haupttasten je Zustand: „Gehe zu“ springt nur auf Folie 1 bis m (Index n - 1), sonst nichts (wie bisher doJump)',
  );
}

// ── PS Gehe zu verlässt das Feld (Fix-Runde 1 zu Task 11): Durch B10 wirkt aus dem Feld „Folie“ kein Kürzel; blieb der Fokus
// nach dem Absenden dort, waren USB-Klicker und Tasten tot (gemessen: „3“, Enter, PageDown/PageUp/B ohne Wirkung). Nach jedem
// Absenden (Enter oder Knopf, gültig oder nicht) verlässt der Fokus darum die Form ──
{
  const lv = live_ as Record<string, unknown>;
  const absenden = lv.geheZuAbsenden as ((eingabe: string, anzahl: number, a: { geheZu(i: number): void; leere(): void; verlasse(): void }) => void) | undefined;
  const verlasseFeld = lv.verlasseFeld as ((bereich: { contains(z: unknown): boolean }, aktiv: unknown) => void) | undefined;
  const lauf = (eingabe: string): string[] => {
    const log: string[] = [];
    if (typeof absenden !== 'function') return ['geheZuAbsenden fehlt'];
    absenden(eingabe, 3, { geheZu: (i) => void log.push(`geheZu(${i})`), leere: () => void log.push('leere'), verlasse: () => void log.push('verlasse') });
    return log;
  };
  gleich(
    [lauf('3'), lauf('1'), lauf('9'), lauf('0'), lauf('')],
    [['geheZu(2)', 'leere', 'verlasse'], ['geheZu(0)', 'leere', 'verlasse'], ['leere', 'verlasse'], ['leere', 'verlasse'], ['leere', 'verlasse']],
    'PS Gehe zu verlässt das Feld: gültig springt es, dann leert es das Feld und verlässt die Form; ungültig leert es nur und verlässt die Form ebenfalls (sonst bliebe der Klicker tot)',
  );
  const blur: string[] = [];
  const ziel = (name: string) => ({ blur: () => void blur.push(name) });
  const drin = ziel('feld');
  const knopf = ziel('knopf');
  const draussen = ziel('draussen');
  const form = { contains: (z: unknown) => z === drin || z === knopf };
  if (typeof verlasseFeld === 'function') {
    verlasseFeld(form, drin);
    verlasseFeld(form, knopf);
    verlasseFeld(form, draussen);
    verlasseFeld(form, null);
  }
  gleich(blur, ['feld', 'knopf'], 'PS Gehe zu verlässt das Feld: verlasseFeld nimmt den Fokus nur von Feld oder Knopf der Form, nie von einem Element außerhalb, und übersteht null');
  const q = ohneKommentare(leseText('src/renderer/src/views/PresenterView.tsx'));
  ok(
    /const form = e\.currentTarget;\s*geheZuAbsenden\(jump, anzahl, \{[\s\S]*?verlasse: \(\) => verlasseFeld\(form, document\.activeElement\)/.test(q),
    'PS Gehe zu verlässt das Feld: Quelltext – onSubmit (Enter und Knopf) ruft geheZuAbsenden, verlasse nimmt den Fokus aus der Form',
  );
}

// ── PS Übersicht im Inhalt: die Folienübersicht liegt im Live-Bereich innerhalb von main, nicht über Kopf und Leiste (B12) ──
{
  const html = live(referentStand(), true);
  const u = bereich(html, 'data-presenter', 'uebersicht-flaeche');
  ok(/^<div data-presenter="live" class="relative /.test(html) && /^<div data-presenter="uebersicht-flaeche" class="absolute inset-0 /.test(u), 'PS Übersicht im Inhalt: die Übersicht ist eine Fläche absolute inset-0 im Live-Bereich (relative), nicht über dem ganzen Fenster');
  const folien = [...u.matchAll(/<button[^>]*data-presenter="uebersicht-folie"[^>]*>/g)].map((m) => m[0]);
  gleich(
    [text(u).includes('Folienübersicht'), text(u).includes('schließen ✕'), folien.length, folien.map((f) => /ring-\[var\(--primary\)\]/.test(f))],
    [true, true, 3, [false, true, false]],
    'PS Übersicht im Inhalt: Titel „Folienübersicht“, „schließen ✕“, je Folie ein Knopf, die aktuelle hervorgehoben',
  );
  ok(!live(referentStand(), false).includes('uebersicht-flaeche'), 'PS Übersicht im Inhalt: geschlossen ist keine Übersicht gerendert');
  const r = render(
    <ReferentRahmen
      stand={referentStand()}
      folien={referentFolien()}
      wahl={22}
      uebersicht
      aktionen={aktionenAttrappe([], false)}
      referent={referentAttrappe()}
      panelOffen={false}
      onPanel={() => undefined}
      onWahl={() => undefined}
      onVerschieben={() => undefined}
      onUebersicht={() => undefined}
    />,
  );
  const pos = ['</header>', 'data-bereich="toolbar"', '<main', 'data-presenter="uebersicht-flaeche"', '</main>'].map((t) => r.indexOf(t));
  ok(pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])), 'PS Übersicht im Inhalt: im Rahmen steht die Übersicht nach Kopf und Leiste innerhalb von main');
  const log: string[] = [];
  const ue = elemente(Uebersicht({ folien: referentFolien(), index: 1, onGeheZu: (i) => void log.push(`geheZu(${i})`), onSchliessen: () => void log.push('schliessen') }));
  const knoepfe = ue.filter((e) => e.type === 'button');
  (knoepfe[0]?.props.onClick as (() => void) | undefined)?.();
  (knoepfe[3]?.props.onClick as (() => void) | undefined)?.();
  gleich(log, ['schliessen', 'geheZu(2)', 'schliessen'], 'PS Übersicht im Inhalt: „schließen ✕“ schließt; ein Klick auf eine Folie springt dorthin und schließt (wie bisher)');
}

// ── PS Live-Bereich: nächste Folie, Notizen, Timer-Leiste und Laden wie bisher ──
{
  const naechste = (s: OberflaechenStand): string => text(bereich(live(s), 'data-presenter', 'naechste-folie'));
  gleich(
    [naechste(referentStand()), naechste(referentStand({ praesentation: laufend({ index: 2 }) })), naechste(referentStand({ praesentation: laufend({ index: 2, schleife: true }) })), bereich(live(referentStand()), 'data-presenter', 'naechste-folie').includes('<canvas')],
    ['', 'Ende der Präsentation', '', true],
    'PS Live-Bereich: „Nächste Folie“ zeigt die folgende, mit Schleife nach der letzten die erste, sonst „Ende der Präsentation“',
  );
  gleich(
    [text(bereich(live(referentStand()), 'data-presenter', 'notizen')), text(bereich(live(referentStand({ praesentation: laufend({ index: 0 }) })), 'data-presenter', 'notizen'))],
    ['Drei Punkte nennen.', 'Keine Notizen'],
    'PS Live-Bereich: Notizen der aktuellen Folie, sonst „Keine Notizen“',
  );
  ok(text(live(referentStand({ timerZustand: timerZustand() }))).includes('JM Timer') && text(live(referentStand({ timerZustand: timerZustand() }))).includes('Keynote') && !text(live(referentStand({ timerZustand: timerZustand({ connected: false }) }))).includes('JM Timer') && !text(live(referentStand())).includes('JM Timer'), 'PS Live-Bereich: die Timer-Leiste erscheint nur bei verbundenem JM Timer (aus dem Stand)');
  const laden = live(referentStand(), false, null);
  ok(text(laden).includes('Lade Präsentation…') && !laden.includes('data-presenter="tasten"'), 'PS Live-Bereich: bis der Payload da ist „Lade Präsentation…“, ohne Tasten (wie bisher)');
  ok(text(live()).includes('Aktuelle Folie') && text(live()).includes('Nächste Folie') && text(live()).includes('Notizen'), 'PS Live-Bereich: Beschriftungen „Aktuelle Folie“, „Nächste Folie“, „Notizen“ wie bisher');
  ok(!text(live()).includes('"'), 'PS Live-Bereich: kein ASCII-Anführungszeichen in den Texten');
}

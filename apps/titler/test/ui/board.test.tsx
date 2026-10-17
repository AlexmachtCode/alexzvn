// UX-Pilot C12 · Recall-Board, Hell/Dunkel in den Zusatzfenstern, Feinschliff (Spec 5.3, 7.2, 8; Anhang A „Titler“ ›
// Besonderheiten; E15, E22; OF1): Das Board bleibt ohne AppShell, zeigt beim Laden „Lädt…“ statt „0 Einträge“, übernimmt
// das gemerkte Theme und behält seinen Hinweis-Filter. Das Ausgabefenster bleibt byte-gleich. Keine ASCII-Anführungszeichen
// in Nutzertexten. Render ohne Browser über den Anfangszustand des Stores.
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { enthaelt, enthaeltNicht, gleich, leseText, ok, render } from '@jm/ui/testhilfe';
import type { TitlerStatus } from '@shared/types';
import { TITLER_TEXTE } from '@/lib/oberflaeche';
import { Bedienung } from '@/views/Bedienung';
import { Einstellungen } from '@/views/Einstellungen';
import { LiveBereich } from '@/views/LiveBereich';
import { OperatorView } from '@/views/OperatorView';
import { RecallBoard } from '@/views/RecallBoard';
import { basisConfig, basisStand, basisStatus, eintraege, mitStore, MONITORE, ohneKommentare, protokollAktionen, text, VORLAGEN } from './testzustand';

const nichts = (): void => undefined;
const board = (status: TitlerStatus | null): string =>
  mitStore(status ? { config: basisConfig(), status } : null, () => render(<RecallBoard />));

// ── Board ohne AppShell, Laden ──
{
  const html = board(basisStatus({ entries: eintraege(3), activeEntry: 1 }));
  ok(
    !html.includes('data-bereich="inhalt"') && !html.includes('data-status-id') && text(html).includes('RECALL-BOARD') && text(html).includes('3 Einträge'),
    'Recall-Board: bleibt ohne AppShell (keine Statusleiste, kein Panel), Kopf mit „RECALL-BOARD“ und Zahl (Anhang A)',
  );
  const laden = board(null);
  ok(
    text(laden).includes(TITLER_TEXTE.laedt) && !text(laden).includes('0 Einträge') && !text(laden).includes('Keine Einträge'),
    'Recall-Board beim Laden: „Lädt…“ statt „0 Einträge“ und „Keine Einträge …“ (E22)',
  );
  enthaelt(text(board(basisStatus())), 'Keine Einträge.', 'Recall-Board geladen ohne Einträge: weiter „Keine Einträge. …“ (Nr. 89)');
}

// ── Board-Hinweis: nur H1, H5, H6 und die Karte B1 (OF1-Vorgabe, Spec 7.8) ──
{
  const arten = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7'] as const;
  const gezeigt = arten.filter((art) => text(board(basisStatus({ entries: eintraege(2), hinweis: { art, text: `Hinweis ${art}` } }))).includes(`Hinweis ${art}`));
  gleich(gezeigt, ['H1', 'H5', 'H6'], 'Recall-Board: Hinweis nur bei H1, H5, H6 (Board-Filter bleibt, OF1)');
  enthaelt(
    text(board(basisStatus({ entries: eintraege(2), gehalten: { label: 'Dr. Weiß' } }))),
    'Auf Sendung, nicht in der Liste: Dr. Weiß',
    'Recall-Board: Karte B1 bei einem gehaltenen Eintrag',
  );
}

// ── Theme: Board übernimmt Hell/Dunkel, Ausgabefenster unverändert ──
{
  const quelle = ohneKommentare(leseText('src/renderer/src/views/RecallBoard.tsx'));
  ok(quelle.includes('useTheme()') && !quelle.includes('ThemeToggle'), 'Recall-Board: ruft useTheme() (gemerktes Hell/Dunkel beim Öffnen), ohne eigenen Schalter (E15)');
  // Die Hashes sichern G1 und G3 für den Pilot (Stand main 5e5b234ec3, Text mit LF). Ändert eine spätere Aufgabe eine der
  // drei Dateien gewollt (etwa die Folgeaufgaben zum Import-Dialog), setzt sie die Hashes in derselben Änderung neu.
  const hash = (d: string): string => createHash('sha256').update(leseText(d)).digest('hex');
  const ist = [hash('src/renderer/src/views/OutputView.tsx'), hash('src/renderer/src/lib/engine.ts'), hash('src/renderer/src/views/ImportDialog.tsx')];
  const soll = [
    '7155aa32faa170b09262745d671a45511505b3d2f972596687edb025278aba3f',
    'd14816e8cf54ec9018910f12f56114d3b7eba095c5be02515eed385f1c51996a',
    '8b35b4b9b4c2d19a075dab6d146021b2b03e0ab9afeb62671f17579f45a8d691',
  ];
  gleich(ist, soll, 'Ausgabefenster, Engine und Import-Dialog byte-gleich mit main 5e5b234ec3 (Spec 5.3, G1, G3; Inhalt mit LF)');
  if (ist.join() !== soll.join()) console.log('     Gewollte Änderung nach dem Pilot? Dann die Hashes in test/ui/board.test.tsx neu setzen.');
  ok(!leseText('src/renderer/src/views/OutputView.tsx').includes('useTheme'), 'Ausgabefenster: kein useTheme (bleibt wie bisher, G3)');
}

// ── Warnfarbe Orange statt Gelb (Spec 4.2, E25) ──
{
  const views = readdirSync('src/renderer/src/views').filter((d) => d.endsWith('.tsx'));
  const gelb = views.filter((d) => ohneKommentare(leseText(`src/renderer/src/views/${d}`)).includes('--warning'));
  const html = board(basisStatus({ entries: eintraege(2), hinweis: { art: 'H1', text: 'Hinweis H1' }, gehalten: { label: 'Dr. Weiß' } }));
  gleich(
    [gelb, (html.match(/var\(--status-warn\)/g) ?? []).length],
    [[], 3],
    'Farben: keine Datei in views/*.tsx nutzt Gelb --warning; Hinweisband und Karte B1 im Board sind orange (--status-warn, Spec 4.2, E25)',
  );
}

// ── Keine ASCII-Anführungszeichen in Nutzertexten (G5, Befund 9) ──
{
  // Quelltext: kein „…" (öffnendes deutsches, schließendes ASCII-Zeichen) außerhalb von Kommentaren.
  const views = readdirSync('src/renderer/src/views').filter((d) => d.endsWith('.tsx'));
  const falsch = views.filter((d) => /„[^“"\n]*"/.test(ohneKommentare(leseText(`src/renderer/src/views/${d}`))));
  gleich(falsch, [], 'Texte: in views/*.tsx schließt kein „ mit einem ASCII-Anführungszeichen (G5, Befund 9)');
  enthaelt(leseText('src/renderer/src/views/RecallBoard.tsx'), 'Kein Eintrag passt zu „{q}“.', 'Recall-Board: „Kein Eintrag passt zu „{q}“.“ mit „ “ (Nr. 91)');
  // Gerendert: kein &quot; in Textknoten (React maskiert " im Text als &quot;).
  const status = basisStatus({
    entries: eintraege(3),
    activeEntry: 0,
    hinweis: { art: 'H3', text: 'Hinweis' },
    datenQuelle: { art: 'show', zeile: 'Quelle: Show „Probe“ · 3 Speaker', zurueckKnopf: 'Zurück zum eigenen Ordner (Daten)', ohneOrdner: false },
  });
  const seiten = [
    mitStore({ config: basisConfig(), status }, () => render(<OperatorView />)),
    board(status),
    render(<LiveBereich previewRef={{ current: null }} live={false} ndiActive={false} activeEntry={0} anzahl={3} onTake={nichts} onClear={nichts} onSchritt={nichts} />),
    render(<Bedienung config={basisConfig({ template: 'graphic' })} status={status} templates={VORLAGEN} setConfig={nichts} onSelectTemplate={nichts} onOpenBoard={nichts} onRecall={nichts} />),
    render(
      <Einstellungen
        stand={basisStand({ status, displays: MONITORE })}
        aktionen={protokollAktionen([])}
        templates={VORLAGEN}
        activeGraphicId="v1"
        onPickImport={nichts}
        onDropImport={nichts}
        onDeleteTemplate={nichts}
      />,
    ),
  ];
  const textknoten = seiten.map((h) => h.replace(/<[^>]*>/g, '')).join('\n');
  enthaeltNicht(textknoten, '&quot;', 'Texte: gerendertes Bedienfenster, Board, Live-Bereich, Bedienung und Panel ohne ASCII-Anführungszeichen');
}

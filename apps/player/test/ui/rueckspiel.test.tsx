// UX Welle 2b, Task 26 · Rückspiel der Regel „Wahl ≠ Bewegung im Altbestand“ (regeln.md, Task 19/25) in den Player: Die
// Show-Auswahl der Cue-Show löste bei jeder Änderung (auch per Pfeiltaste) sofort `selectShow` aus, und das räumt die laufende Show
// (Show-Töne hart aus, Ausgabefenster schwarz, Vorlauf weg; panikDerShow). Jetzt hält die Auswahl nur einen Entwurf; erst der eigene
// Knopf „Setzen“ wählt die Show (dasselbe selectShow wie bisher), frei nur bei Unterschied, gesperrt während des Aufrufs.
// „Umbenennen“ und „Löschen“ wirken weiter auf die aktive Show und sind gesperrt, solange ein Entwurf offen ist (sonst nennt die
// Auswahl eine andere Show als die, die gelöscht würde). „+ Neu“ bleibt ein Knopf. Ein Entwurf gilt nur zur Show, auf der er
// entstand: wählt Companion oder „+ Neu“ eine andere Show, fällt er weg. Geprüft als reine Funktion (showWahl), im Render der
// Cue-Show und als Quelltext-Wächter.
import { PEERS_TEXTE } from '@jm/settings';
import { gleich, leseText, ok, render } from '@jm/ui/testhilfe';
import { PLAYER_TEXTE } from '@/lib/oberflaeche';
import * as showModul from '@/views/ShowView';
import { attr, mitStore, ohneKommentare, show as eineShow, showCue, tags, text } from './testzustand';

const T = (PLAYER_TEXTE as unknown as { showWahl?: { titel: string; unveraendert: string; laeuft: string; erstSetzen: string } }).showWahl;
ok(T !== undefined && Object.values(T).every((t) => t.length > 0 && !t.includes('"')), 'PL Rückspiel Wahl ≠ Bewegung: die Texte der Show-Wahl stehen in PLAYER_TEXTE.showWahl (ohne ASCII-Anführungszeichen)');

type Entwurf = { basis: number | null; id: number } | null;
interface Wahl {
  wert: number | '';
  setzenGrund: string | undefined;
  entwurfOffen: boolean;
  waehlen(id: number): void;
  setzen(): Promise<void>;
}
const showWahl = (showModul as unknown as { showWahl?: (a: unknown) => Wahl }).showWahl;
ok(typeof showWahl === 'function', 'PL Rückspiel Wahl ≠ Bewegung: views/ShowView.tsx exportiert die reine Bedienung showWahl');

const SHOWS = [eineShow(1, 'Gala'), eineShow(2, 'Probe'), eineShow(3, 'Matinee')];

/** Ein Modell der Cue-Show: Entwurf und „wählt gerade“ wie in ShowView, selectShow zeichnet auf. */
function modell(aktiv: number | null, entwurf: Entwurf = null, laeuft = false) {
  const m = { aktiv, entwurf, laeuft, gewaehlt: [] as number[], laeuftWaehrend: [] as boolean[] };
  const w = (): Wahl =>
    showWahl!({
      shows: SHOWS,
      aktiv: m.aktiv,
      entwurf: m.entwurf,
      laeuft: m.laeuft,
      setzeEntwurf: (f: (e: Entwurf) => Entwurf) => (m.entwurf = f(m.entwurf)),
      setzeLaeuft: (an: boolean) => (m.laeuft = an),
      waehleShow: async (id: number) => {
        m.gewaehlt.push(id);
        m.laeuftWaehrend.push(m.laeuft);
        m.aktiv = id;
      },
    });
  return { m, w };
}

if (typeof showWahl === 'function' && T !== undefined) {
  // ── Ohne Entwurf: die Auswahl zeigt die aktive Show, „Setzen“ gesperrt mit Grund ──
  {
    const { w } = modell(1);
    gleich([w().wert, w().setzenGrund, w().entwurfOffen], [1, T.unveraendert, false], 'PL Rückspiel Wahl ≠ Bewegung: ohne Entwurf zeigt die Auswahl die aktive Show, „Setzen“ ist gesperrt mit „schon gewählt“');
  }
  // ── Wählen ändert nur den Entwurf, ruft nie selectShow ──
  {
    const { m, w } = modell(1);
    w().waehlen(2);
    w().waehlen(3);
    gleich([m.gewaehlt, m.entwurf, w().wert, w().setzenGrund, w().entwurfOffen], [[], { basis: 1, id: 3 }, 3, undefined, true], 'PL Rückspiel Wahl ≠ Bewegung: Durchblättern der Auswahl (auch per Pfeiltaste) ändert nur den Entwurf, selectShow läuft nicht, „Setzen“ ist frei');
    w().waehlen(1);
    gleich([m.entwurf, w().setzenGrund], [null, T.unveraendert], 'PL Rückspiel Wahl ≠ Bewegung: zurück auf die aktive Show fällt der Entwurf weg');
  }
  // ── „Setzen“ wählt genau einmal die Show des Entwurfs, gesperrt während des Aufrufs, danach kein Entwurf ──
  {
    const { m, w } = modell(1, { basis: 1, id: 2 });
    await w().setzen();
    gleich([m.gewaehlt, m.laeuftWaehrend, m.laeuft, m.entwurf, w().wert], [[2], [true], false, null, 2], 'PL Rückspiel Wahl ≠ Bewegung: „Setzen“ ruft selectShow genau einmal mit der gewählten Show, gesperrt während des Aufrufs, danach zeigt die Auswahl wieder die aktive Show');
    const lauf = modell(1, { basis: 1, id: 2 }, true);
    await lauf.w().setzen();
    gleich([lauf.w().setzenGrund, lauf.m.gewaehlt], [T.laeuft, []], 'PL Rückspiel Wahl ≠ Bewegung: während des Aufrufs ist „Setzen“ gesperrt mit Grund und tut nichts');
    const ohne = modell(1);
    await ohne.w().setzen();
    gleich(ohne.m.gewaehlt, [], 'PL Rückspiel Wahl ≠ Bewegung: ohne Entwurf tut „Setzen“ nichts');
  }
  // ── Ein Entwurf gilt nur zur Show, auf der er entstand, und nur zu einer vorhandenen Show ──
  {
    const fremd = modell(3, { basis: 1, id: 2 });
    gleich([fremd.w().wert, fremd.w().entwurfOffen, fremd.w().setzenGrund], [3, false, T.unveraendert], 'PL Rückspiel Wahl ≠ Bewegung: wählt Companion oder „+ Neu“ eine andere Show, fällt der alte Entwurf weg (die Auswahl zeigt die neue aktive Show)');
    const weg = modell(1, { basis: 1, id: 99 });
    gleich([weg.w().wert, weg.w().entwurfOffen], [1, false], 'PL Rückspiel Wahl ≠ Bewegung: ein Entwurf auf eine gelöschte Show gilt nicht');
  }
}

// ── Render der Cue-Show: „Setzen“ im Kopf, gesperrt mit Grund, an freier Stelle vor „▦ Ausgabe“ ──
{
  let html = '';
  try {
    html = mitStore({ loading: false, shows: SHOWS, activeShowId: 1, showCues: [showCue(1, { label: 'Intro' })], standbyIndex: 0 }, () => render(<showModul.ShowView onAusgabe={() => undefined} />));
  } catch (e) {
    ok(false, `PL Rückspiel Wahl ≠ Bewegung: Cue-Show rendert ohne Wurf (${String(e).split(String.fromCharCode(10))[0]})`);
  }
  const knoepfe = [...html.matchAll(/(<button[^>]*>)([\s\S]*?)<\/button>/g)].map((m) => ({ tag: m[1], text: text(m[2]).trim() }));
  const kopf = knoepfe.slice(0, knoepfe.findIndex((k) => k.text === '+ Cue') + 1).map((k) => k.text);
  const setzen = knoepfe.find((k) => attr(k.tag, 'aria-label') === PEERS_TEXTE.setzenFuer(T?.titel ?? 'Show'));
  gleich(kopf, ['+ Neu', 'Umbenennen', 'Löschen', PEERS_TEXTE.setzen, '▦ Ausgabe', '+ Cue'], 'PL Rückspiel Wahl ≠ Bewegung: der Kopf der Cue-Show hat „Setzen“ als erste Taste der rechten Gruppe, vor „▦ Ausgabe“ (alle übrigen Tasten an ihrer Stelle)');
  ok(
    setzen !== undefined && /\sdisabled=""/.test(setzen.tag) && attr(setzen.tag, 'title') === T?.unveraendert && (attr(setzen.tag, 'aria-describedby') ?? '') !== '',
    'PL Rückspiel Wahl ≠ Bewegung: ohne Entwurf ist „Setzen“ gesperrt, der Grund steht als title und per aria-describedby',
  );
  const auswahl = tags(html, 'select')[0];
  ok(auswahl !== undefined && html.includes('<option value="1" selected="">Gala</option>'), 'PL Rückspiel Wahl ≠ Bewegung: die Auswahl zeigt die aktive Show');
  ok(['Umbenennen', 'Löschen'].every((t) => !/\sdisabled=""/.test(knoepfe.find((k) => k.text === t)?.tag ?? ' disabled=""')), 'PL Rückspiel Wahl ≠ Bewegung: ohne Entwurf sind „Umbenennen“ und „Löschen“ bedienbar');
}

// ── Verdrahtung (Quelltext-Wächter): die Auswahl ruft selectShow nicht mehr, „Setzen“ und Sperren gehen über showWahl ──
{
  const q = ohneKommentare(leseText('src/renderer/src/views/ShowView.tsx'));
  ok(
    /onChange=\{\(e\) => wahl\.waehlen\(Number\(e\.target\.value\)\)\}/.test(q) && !/onChange=\{\(e\) => void selectShow\(/.test(q) && q.includes('waehleShow: selectShow') && q.includes('onClick={() => void wahl.setzen()}'),
    'PL Rückspiel Wahl ≠ Bewegung: die Show-Auswahl ändert nur den Entwurf (wahl.waehlen), selectShow läuft nur über „Setzen“',
  );
  ok((q.match(/disabled=\{wahl\.entwurfOffen\}/g) ?? []).length === 2, 'PL Rückspiel Wahl ≠ Bewegung: „Umbenennen“ und „Löschen“ sind gesperrt, solange ein Entwurf offen ist');
}

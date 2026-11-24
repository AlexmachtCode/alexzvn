// UX Welle 2b, Task 26 · Rückspiel der Regel „Wahl ≠ Bewegung im Altbestand“ (regeln.md, Task 19/25) in den Player: Die
// Show-Auswahl der Cue-Show löste bei jeder Änderung (auch per Pfeiltaste) sofort `selectShow` aus, und das räumt die laufende Show
// (Show-Töne hart aus, Ausgabefenster schwarz, Vorlauf weg; panikDerShow). Jetzt hält die Auswahl nur einen Entwurf; erst der eigene
// Knopf „Setzen“ wählt die Show (dasselbe selectShow wie bisher), gesperrt während des Aufrufs. „Setzen“ steht nur bei Unterschied
// (offener Entwurf) oder während der Wahl im Kopf: ein immer sichtbares „Setzen“ ließ den Kopf in schmalen Fenstern umbrechen
// (gemessen, t26-auswertung.json), dann rückten „▦ Ausgabe“, „+ Cue“ und die Cue-Liste; ohne Entwurf steht jede Taste wie bisher.
// „Umbenennen“ und „Löschen“ wirken weiter auf die aktive Show und sind gesperrt, solange ein Entwurf offen ist (sonst nennt die
// Auswahl eine andere Show als die, die gelöscht würde). „+ Neu“ bleibt ein Knopf. Ein Entwurf gilt nur zur Show, auf der er
// entstand: wählt Companion oder „+ Neu“ eine andere Show, fällt er weg. Geprüft als reine Funktion (showWahl), im Render der
// Cue-Show und als Quelltext-Wächter.
import { PEERS_TEXTE } from '@jm/settings';
import { gleich, leseText, ok, render } from '@jm/ui/testhilfe';
import { PLAYER_TEXTE } from '@/lib/oberflaeche';
import * as showModul from '@/views/ShowView';
import type { ShowWahl } from '@/views/ShowView';
import { attr, mitStore, ohneKommentare, show as eineShow, showCue, tags, text } from './testzustand';

const T = (PLAYER_TEXTE as unknown as { showWahl?: { titel: string; laeuft: string; erstSetzen: string } }).showWahl;
ok(T !== undefined && Object.values(T).every((t) => t.length > 0 && !t.includes('"')), 'PL Rückspiel Wahl ≠ Bewegung: die Texte der Show-Wahl stehen in PLAYER_TEXTE.showWahl (ohne ASCII-Anführungszeichen)');

type Entwurf = { basis: number | null; id: number } | null;
interface Wahl {
  wert: number | '';
  setzenSichtbar: boolean;
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
  // ── Ohne Entwurf: die Auswahl zeigt die aktive Show, kein „Setzen“ im Kopf ──
  {
    const { w } = modell(1);
    gleich([w().wert, w().setzenSichtbar, w().setzenGrund, w().entwurfOffen], [1, false, undefined, false], 'PL Rückspiel Wahl ≠ Bewegung: ohne Entwurf zeigt die Auswahl die aktive Show, „Setzen“ steht nicht im Kopf (alle Tasten wie bisher)');
  }
  // ── Wählen ändert nur den Entwurf, ruft nie selectShow ──
  {
    const { m, w } = modell(1);
    w().waehlen(2);
    w().waehlen(3);
    gleich([m.gewaehlt, m.entwurf, w().wert, w().setzenSichtbar, w().setzenGrund, w().entwurfOffen], [[], { basis: 1, id: 3 }, 3, true, undefined, true], 'PL Rückspiel Wahl ≠ Bewegung: Durchblättern der Auswahl (auch per Pfeiltaste) ändert nur den Entwurf, selectShow läuft nicht, „Setzen“ erscheint frei');
    w().waehlen(1);
    gleich([m.entwurf, w().setzenSichtbar], [null, false], 'PL Rückspiel Wahl ≠ Bewegung: zurück auf die aktive Show fällt der Entwurf weg, „Setzen“ verschwindet');
  }
  // ── „Setzen“ wählt genau einmal die Show des Entwurfs, gesperrt während des Aufrufs, danach kein Entwurf ──
  {
    const { m, w } = modell(1, { basis: 1, id: 2 });
    await w().setzen();
    gleich([m.gewaehlt, m.laeuftWaehrend, m.laeuft, m.entwurf, w().wert, w().setzenSichtbar], [[2], [true], false, null, 2, false], 'PL Rückspiel Wahl ≠ Bewegung: „Setzen“ ruft selectShow genau einmal mit der gewählten Show, gesperrt während des Aufrufs, danach zeigt die Auswahl die aktive Show und „Setzen“ verschwindet');
    const lauf = modell(1, { basis: 1, id: 2 }, true);
    await lauf.w().setzen();
    gleich([lauf.w().setzenSichtbar, lauf.w().setzenGrund, lauf.m.gewaehlt], [true, T.laeuft, []], 'PL Rückspiel Wahl ≠ Bewegung: während des Aufrufs bleibt „Setzen“ sichtbar, gesperrt mit Grund, und tut nichts');
    const ohne = modell(1);
    await ohne.w().setzen();
    gleich(ohne.m.gewaehlt, [], 'PL Rückspiel Wahl ≠ Bewegung: ohne Entwurf tut „Setzen“ nichts');
  }
  // ── Ein Entwurf gilt nur zur Show, auf der er entstand, und nur zu einer vorhandenen Show ──
  {
    const fremd = modell(3, { basis: 1, id: 2 });
    gleich([fremd.w().wert, fremd.w().entwurfOffen, fremd.w().setzenSichtbar], [3, false, false], 'PL Rückspiel Wahl ≠ Bewegung: wählt Companion oder „+ Neu“ eine andere Show, fällt der alte Entwurf weg (die Auswahl zeigt die neue aktive Show)');
    const weg = modell(1, { basis: 1, id: 99 });
    gleich([weg.w().wert, weg.w().entwurfOffen], [1, false], 'PL Rückspiel Wahl ≠ Bewegung: ein Entwurf auf eine gelöschte Show gilt nicht');
  }
}

// ── Render der Cue-Show ohne Entwurf: der Kopf trägt dieselben Tasten in derselben Folge wie bisher, kein „Setzen“ ──
{
  let html = '';
  try {
    html = mitStore({ loading: false, shows: SHOWS, activeShowId: 1, showCues: [showCue(1, { label: 'Intro' })], standbyIndex: 0 }, () => render(<showModul.ShowView onAusgabe={() => undefined} />));
  } catch (e) {
    ok(false, `PL Rückspiel Wahl ≠ Bewegung: Cue-Show rendert ohne Wurf (${String(e).split(String.fromCharCode(10))[0]})`);
  }
  const knoepfe = [...html.matchAll(/(<button[^>]*>)([\s\S]*?)<\/button>/g)].map((m) => ({ tag: m[1], text: text(m[2]).trim() }));
  const kopf = knoepfe.slice(0, knoepfe.findIndex((k) => k.text === '+ Cue') + 1).map((k) => k.text);
  gleich(kopf, ['+ Neu', 'Umbenennen', 'Löschen', '▦ Ausgabe', '+ Cue'], 'PL Rückspiel Wahl ≠ Bewegung: ohne Entwurf trägt der Kopf der Cue-Show genau die Tasten von heute, ohne „Setzen“');
  const auswahl = tags(html, 'select')[0];
  ok(auswahl !== undefined && html.includes('<option value="1" selected="">Gala</option>'), 'PL Rückspiel Wahl ≠ Bewegung: die Auswahl zeigt die aktive Show');
  ok(['Umbenennen', 'Löschen'].every((t) => !/\sdisabled=""/.test(knoepfe.find((k) => k.text === t)?.tag ?? ' disabled=""')), 'PL Rückspiel Wahl ≠ Bewegung: ohne Entwurf sind „Umbenennen“ und „Löschen“ bedienbar');
}

// ── Verdrahtung (Quelltext-Wächter): die Auswahl ruft selectShow nicht mehr, „Setzen“ und Sperren gehen über showWahl ──
{
  const q = ohneKommentare(leseText('src/renderer/src/views/ShowView.tsx'));
  ok(
    /onChange=\{\(e\) => wahl\.waehlen\(Number\(e\.target\.value\)\)\}/.test(q) && !/onChange=\{\(e\) => void selectShow\(/.test(q) && q.includes('waehleShow: selectShow') && q.includes('onClick={() => void wahl.setzen()}') && /<div className="ml-auto flex items-center gap-2">\s*(?:\{\}\s*)?<ShowSetzen wahl=\{wahl\} grundId=\{setzenGrundId\} \/>\s*<Button size="sm" variant="ghost" onClick=\{onAusgabe\}>/.test(q),
    'PL Rückspiel Wahl ≠ Bewegung: die Show-Auswahl ändert nur den Entwurf (wahl.waehlen), selectShow läuft nur über „Setzen“ (ShowSetzen vorn in der rechten Gruppe, vor „▦ Ausgabe“)',
  );
  ok((q.match(/disabled=\{wahl\.entwurfOffen\}/g) ?? []).length === 2, 'PL Rückspiel Wahl ≠ Bewegung: „Umbenennen“ und „Löschen“ sind gesperrt, solange ein Entwurf offen ist');
}

// ── ShowSetzen (hooklos): nichts ohne Entwurf; mit Entwurf frei; während der Wahl gesperrt mit Grund (title, aria-describedby) ──
{
  const ShowSetzen = (showModul as unknown as { ShowSetzen?: (p: { wahl: ShowWahl; grundId: string }) => React.JSX.Element | null }).ShowSetzen;
  ok(typeof ShowSetzen === 'function', 'PL Rückspiel Wahl ≠ Bewegung: views/ShowView.tsx exportiert die hooklose Taste ShowSetzen');
  if (typeof ShowSetzen === 'function' && typeof showWahl === 'function' && T !== undefined) {
    const taste = (entwurf: Entwurf, laeuft: boolean): string => render(<ShowSetzen wahl={modell(1, entwurf, laeuft).w() as unknown as ShowWahl} grundId="show-grund" />);
    const ohne = taste(null, false);
    const frei = taste({ basis: 1, id: 2 }, false);
    const lauf = taste({ basis: 1, id: 2 }, true);
    const knopf = (h: string): string | undefined => tags(h, 'button')[0];
    ok(ohne === '', 'PL Rückspiel Wahl ≠ Bewegung: ohne Entwurf und ohne laufende Wahl zeichnet ShowSetzen nichts');
    ok(
      attr(knopf(frei), 'aria-label') === PEERS_TEXTE.setzenFuer(T.titel) && text(frei).trim() === PEERS_TEXTE.setzen && !/\sdisabled=""/.test(knopf(frei) ?? '') && attr(knopf(frei), 'aria-describedby') === undefined,
      'PL Rückspiel Wahl ≠ Bewegung: mit offenem Entwurf steht „Setzen“ (Bezeichnung „Setzen: Show“) und ist frei',
    );
    ok(
      /\sdisabled=""/.test(knopf(lauf) ?? '') && attr(knopf(lauf), 'title') === T.laeuft && attr(knopf(lauf), 'aria-describedby') === 'show-grund' && lauf.includes(`<span id="show-grund" class="sr-only">${T.laeuft}</span>`),
      'PL Rückspiel Wahl ≠ Bewegung: während der Wahl ist „Setzen“ gesperrt, der Grund steht als title und per aria-describedby',
    );
  }
}

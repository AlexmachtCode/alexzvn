// UX Welle 2b, Task 26 · Rückspiel der Regeln aus 2b in den Presenter (regeln.md):
// - „select-text“ (Regel Task 23/24, Connect): die Fehlerzeile des Editors (Import, Office-Konvertierung, Öffnen, Speichern, PDF;
//   oft mit Pfad) und die Kopplungs-Adresse der Handy-Fernsteuerung sind trotz body { user-select: none } markierbar.
// - „Laufende Aufrufe in der Wurzel“ (Regel Task 24, Connect): „beschäftigt“ der Abschnitte Handy-Fernsteuerung und Gast-Klicker
//   liegt in der Wurzel-View (Editor und Referent), nicht im Panel. Das Panel stirbt beim Schließen; ein Wiederöffnen während eines
//   laufenden Aufrufs gab bisher Schalter und „Setzen“ frei. Der ungesicherte Entwurf von Netzwerkkarte und Port stirbt weiter mit
//   dem Panel (benannte Grenze, wie die Gegenstellen).
// Render ohne Browser; die Wurzel-Verdrahtung als Quelltext-Wächter, die Lauf-Logik als reine Funktion.
import { PEERS_TEXTE } from '@jm/settings';
import { gleich, leseText, ok, render } from '@jm/ui/testhilfe';
import { HandyFelder, handyBedienung } from '@/components/RemotePanel';
import { ABSCHNITT, PRESENTER_TEXTE, type StartWahl } from '@/lib/oberflaeche';
import { EditorView } from '@/views/EditorView';
import { Einstellungen, type EinstellungenAktionen } from '@/views/Einstellungen';
import { abschnitt, aktionenAttrappe, attr, bekannterStand, gastStatus, handyStatus, mitStore, NETZWERKKARTEN, ohneKommentare, tags, text } from './testzustand';

const H = PRESENTER_TEXTE.handy;
const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const WAHL: StartWahl = { bildschirm: 22, nurNdi: false };
const markierbar = (tag: string | undefined): boolean => (attr(tag, 'class') ?? '').split(/\s+/).includes('select-text');
const gesperrt = (tag: string | undefined): boolean => /\sdisabled=""/.test(tag ?? '');
const schalter = (html: string): string[] => tags(html, 'button').filter((t) => attr(t, 'role') === 'switch');

const aufrufe = await import('@/lib/aufrufe').catch((e: unknown) => {
  ok(false, `PS Rückspiel laufende Aufrufe: lib/aufrufe.ts lädt (${String(e).split(String.fromCharCode(10))[0]})`);
  return null;
});

// ── PS Rückspiel select-text: Fehlerzeile des Editors ──
{
  const fehler = 'C:\\Vorträge\\Keynote.pptx: LibreOffice nicht gefunden';
  const html = mitStore({ error: fehler }, () => render(<EditorView />));
  const zeile = tags(html, 'span').find((t) => html.includes(`${t}${fehler}</span>`));
  ok(zeile !== undefined && markierbar(zeile), 'PS Rückspiel select-text: die Fehlerzeile des Editors (mit Pfad) ist markierbar (select-text, trotz body user-select none)');
}

// ── PS Rückspiel select-text: Kopplungs-Adresse der Handy-Fernsteuerung ──
{
  const url = 'http://10.0.0.5:7330/?t=abc123';
  const st = handyStatus({ running: true, url, pin: '4711', config: { enabled: true, bind: 'all', port: 7330, pinEnabled: true } });
  const b = handyBedienung({ status: st, entwurf: {}, busy: false, setzeEntwurf: () => undefined, anwenden: async () => undefined });
  const html = render(<HandyFelder status={st} netzwerkkarten={NETZWERKKARTEN} busy={false} grundId="handy-grund" bedienung={b} />);
  const link = tags(html, 'a').find((t) => attr(t, 'href') === url);
  ok(link !== undefined && markierbar(link), 'PS Rückspiel select-text: die Kopplungs-Adresse der Handy-Fernsteuerung ist markierbar (select-text)');
}

// ── PS Rückspiel laufende Aufrufe: imLauf hält den Schlüssel genau für die Dauer des Aufrufs ──
if (aufrufe !== null) {
  let laufend: ReadonlySet<string> = aufrufe.KEIN_AUFRUF;
  const setze = (f: (s: ReadonlySet<string>) => ReadonlySet<string>): void => {
    laufend = f(laufend);
  };
  let fertig: () => void = () => undefined;
  const p = aufrufe.imLauf(setze as never, 'handy', () => new Promise<void>((r) => (fertig = r)));
  const waehrend = [...laufend];
  fertig();
  await p;
  gleich([waehrend, [...laufend]], [['handy'], []], 'PS Rückspiel laufende Aufrufe: imLauf setzt den Schlüssel vor dem Aufruf und nimmt ihn nach dem Ende weg');
  let wurf = '';
  await aufrufe.imLauf(setze as never, 'gastKlicker', () => Promise.reject(new Error('abgelehnt'))).catch((e: unknown) => (wurf = String(e)));
  ok(wurf.includes('abgelehnt') && laufend.size === 0, 'PS Rückspiel laufende Aufrufe: ein scheiternder Aufruf gibt den Schlüssel frei und reicht den Fehler weiter (wie bisher try/finally)');
}

// ── PS Rückspiel laufende Aufrufe: mitLaufendenAufrufen führt Handy und Gast-Klicker unter ihrem Schlüssel, Kopieren ohne ──
if (aufrufe !== null) {
  let laufend: ReadonlySet<string> = aufrufe.KEIN_AUFRUF;
  const setze = (f: (s: ReadonlySet<string>) => ReadonlySet<string>): void => {
    laufend = f(laufend);
  };
  const log: string[] = [];
  const merke = async (n: string): Promise<void> => void log.push(`${n}:${[...laufend].join(',')}`);
  const basis: EinstellungenAktionen = {
    ...aktionenAttrappe(),
    handyAnwenden: () => merke('handy'),
    gastKlicker: {
      setzeAn: () => merke('an'),
      pause: () => merke('pause'),
      neuerLink: () => merke('neu'),
      kopieren: async () => {
        await merke('kopieren');
        return true;
      },
    },
  };
  const a = aufrufe.mitLaufendenAufrufen(basis, new Set(['handy']), setze as never);
  await a.handyAnwenden({ enabled: true, bind: 'all', port: 7330, pinEnabled: true });
  await a.gastKlicker.setzeAn(true);
  await a.gastKlicker.pause(true);
  await a.gastKlicker.neuerLink();
  await a.gastKlicker.kopieren('l');
  gleich(log, ['handy:handy', 'an:gastKlicker', 'pause:gastKlicker', 'neu:gastKlicker', 'kopieren:'], 'PS Rückspiel laufende Aufrufe: Handy-Anwenden läuft unter „handy“, An/Aus, Pause und Neuer Link unter „gastKlicker“, Kopieren ohne Schlüssel');
  ok([...a.laeuft].join(',') === 'handy' && laufend.size === 0, 'PS Rückspiel laufende Aufrufe: die Aktionen tragen den Lauf-Stand der Wurzel (laeuft), danach ist nichts mehr laufend');
}

// ── PS Rückspiel laufende Aufrufe: das Panel liest „beschäftigt“ aus der Wurzel – auch nach Schließen und Wiederöffnen ──
{
  const link = 'https://jm-gast-klicker.invalid/k/abcdefabcdef';
  const s = bekannterStand({
    handy: handyStatus({ running: true, url: 'http://10.0.0.5:7330/?t=x', pin: '4711', config: { enabled: true, bind: 'all', port: 7330, pinEnabled: true } }),
    gastKlicker: gastStatus({ an: true, lage: 'verbunden', link, gaeste: 1 }),
  });
  // Jeder Render ist ein frisch geöffnetes Panel (das Panel rendert zu nichts, der Abschnitt wird neu eingehängt).
  const oeffne = (laeuft: ReadonlySet<string>): string => render(<Einstellungen stand={s} aktionen={{ ...aktionenAttrappe(), laeuft } as never} startWahl={WAHL} />);
  const handy = (html: string): { server: boolean; pin: boolean; setzen: boolean; grund: boolean } => {
    const h = abschnitt(html, ABSCHNITT.handy);
    const [server, pin] = schalter(h);
    const setzen = tags(h, 'button').find((t) => attr(t, 'aria-label') === PEERS_TEXTE.setzenFuer(H.titel));
    return { server: gesperrt(server), pin: gesperrt(pin), setzen: gesperrt(setzen), grund: text(h).includes(H.setzenLaeuft) };
  };
  const gast = (html: string): boolean[] => {
    const g = abschnitt(html, ABSCHNITT.gastKlicker);
    const knopf = (t: string): string | undefined => [...g.matchAll(/(<button[^>]*>)([\s\S]*?)<\/button>/g)].find((m) => text(m[2]).trim() === t)?.[1];
    const pause = knopf(PRESENTER_TEXTE.gastKlicker.pausieren);
    const neu = knopf(PRESENTER_TEXTE.gastKlicker.neuerLink);
    ok(pause !== undefined && neu !== undefined, 'PS Rückspiel laufende Aufrufe: Gast-Klicker an mit Link zeigt Pause und Neuer Link');
    return [gesperrt(schalter(g)[0]), gesperrt(pause), gesperrt(neu)];
  };
  const erst = oeffne(new Set(['handy', 'gastKlicker']));
  const wieder = oeffne(new Set(['handy', 'gastKlicker']));
  gleich(
    [handy(erst), handy(wieder)],
    [{ server: true, pin: true, setzen: true, grund: true }, { server: true, pin: true, setzen: true, grund: true }],
    'PS Rückspiel laufende Aufrufe: läuft Handy-Anwenden in der Wurzel, sind Server-Schalter, PIN-Schalter und „Setzen“ gesperrt („Wird angewendet …“), auch im wieder geöffneten Panel',
  );
  gleich([gast(erst), gast(wieder)], [[true, true, true], [true, true, true]], 'PS Rückspiel laufende Aufrufe: läuft ein Gast-Klicker-Aufruf in der Wurzel, sind Schalter, Pause und Neuer Link gesperrt, auch im wieder geöffneten Panel');
  const frei = oeffne(new Set());
  gleich([handy(frei).server, handy(frei).pin, gast(frei)], [false, false, [false, false, false]], 'PS Rückspiel laufende Aufrufe: ohne laufenden Aufruf sind dieselben Knöpfe bedienbar');
}

// ── PS Rückspiel laufende Aufrufe: Verdrahtung (Quelltext-Wächter) ──
{
  const remote = QUELLE('components/RemotePanel.tsx');
  const abschnittQuelle = /export function HandyAbschnitt\([\s\S]*?\n}\n/.exec(remote)?.[0] ?? '';
  const gastQuelle = QUELLE('components/GastKlickerAbschnitt.tsx');
  ok(
    abschnittQuelle !== '' && !abschnittQuelle.includes('setBusy') && !/useState\((false|true)\)/.test(abschnittQuelle) && !gastQuelle.includes('setBusy'),
    'PS Rückspiel laufende Aufrufe: HandyAbschnitt und GastKlickerAbschnitt halten kein eigenes „beschäftigt“ (useState) mehr',
  );
  const e = QUELLE('views/Einstellungen.tsx');
  ok(e.includes("busy={aktionen.laeuft.has('handy')}") && e.includes("busy={aktionen.laeuft.has('gastKlicker')}"), 'PS Rückspiel laufende Aufrufe: das Panel reicht „beschäftigt“ aus aktionen.laeuft an beide Abschnitte');
  for (const w of ['views/EditorOberflaeche.tsx', 'views/ReferentOberflaeche.tsx']) {
    const q = QUELLE(w);
    ok(/useState<LaufendeAufrufe>\(KEIN_AUFRUF\)/.test(q) && q.includes('mitLaufendenAufrufen(standAktionen(stand), laufend, setLaufend)'), `PS Rückspiel laufende Aufrufe: ${w} hält die laufenden Aufrufe als Wurzel-View (useState) und reicht sie mit den Aktionen ans Panel`);
  }
}

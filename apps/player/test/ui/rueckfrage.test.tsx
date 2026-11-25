// Altfehler PL-10, Ruling R16 (Fix-Welle F2): Die Rückfragen beim Entfernen eines Cues während der Show und eines Mediums, das Cues
// oder Pads benutzen, laufen als Fenster im Fenster (Modal aus @jm/ui) statt als window.confirm: Das Player-Fenster läuft weiter
// (Companion, Ende eines Cues, Vorläufe). Render ohne Browser; die Knöpfe drückt der Test über den Elementbaum der Rückfrage (sie hat
// selbst keine Hooks). Die hooklosen Abläufe cueEntfernen und mediumEntfernen laufen gegen Attrappen; gegen den echten Store prüft
// store.test.ts.
import { isValidElement, type ReactNode } from 'react';
import { Button, Modal } from '@jm/ui';
import { gleich, ok, render } from '@jm/ui/testhilfe';
import * as oberflaecheModul from '@/lib/oberflaeche';
import { PLAYER_TEXTE } from '@/lib/oberflaeche';
import { EntfernenFrage } from '@/views/EntfernenFrage';
import * as bibliothekModul from '@/views/LibraryView';
import * as showModul from '@/views/ShowView';
import { attr, medium, showCue, tags, text } from './testzustand';

type Rueckfrage = { frage: string; entfernen: () => void };

/** Text eines Knopfinhalts (nur Zeichenketten und Zahlen, wie in der Rückfrage). */
function inhalt(n: ReactNode): string {
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(inhalt).join('');
  if (isValidElement(n)) return inhalt((n.props as { children?: ReactNode }).children);
  return '';
}

/** Alle Knöpfe (Button aus @jm/ui) im Elementbaum, in Reihenfolge, mit Text und onClick. */
function knoepfe(n: ReactNode): Array<{ text: string; klick: () => void }> {
  const aus: Array<{ text: string; klick: () => void }> = [];
  const gehe = (k: ReactNode): void => {
    if (Array.isArray(k)) {
      k.forEach(gehe);
      return;
    }
    if (!isValidElement(k)) return;
    const props = k.props as { children?: ReactNode; onClick?: () => void };
    if (k.type === Button) aus.push({ text: inhalt(props.children), klick: () => props.onClick?.() });
    gehe(props.children);
  };
  gehe(n);
  return aus;
}

// ── Texte der Knöpfe in PLAYER_TEXTE ──
{
  const T = (PLAYER_TEXTE as unknown as { rueckfrage?: { abbrechen?: string; entfernen?: string } }).rueckfrage;
  gleich([T?.abbrechen, T?.entfernen], ['Abbrechen', 'Entfernen'], 'PL-10 R16 Texte: „Abbrechen“ und „Entfernen“ stehen in PLAYER_TEXTE.rueckfrage');
}

// ── Render: Fenster im Fenster mit dem Fragetext und den zwei Knöpfen, „Abbrechen“ zuerst (Modal fokussiert beim Öffnen das erste
// fokussierbare Element), kein Kopf mit ✕ ──
{
  const frage = PLAYER_TEXTE.cueEntfernen(2, 'Einspieler');
  const html = render(<EntfernenFrage rueckfrage={{ frage, entfernen: () => undefined }} onSchliessen={() => undefined} />);
  const texte = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]).trim());
  ok(html.includes('role="dialog"') && html.includes('aria-modal="true"'), 'PL-10 R16 Rückfrage: ein Fenster im Fenster (Modal, role=dialog, aria-modal)');
  gleich(
    [text(html).includes(frage), texte, tags(html, 'button').every((t) => attr(t, 'type') !== 'submit'), html.includes('aria-label="Schließen"'), tags(html, 'input').length],
    [true, ['Abbrechen', 'Entfernen'], true, false, 0],
    'PL-10 R16 Rückfrage: zeigt den Fragetext und genau „Abbrechen“ (zuerst, bekommt beim Öffnen den Fokus) und „Entfernen“; kein ✕-Kopf, kein Feld',
  );
  const medienFrage = PLAYER_TEXTE.mediumEntfernen('Gong', 2, 1);
  const html2 = render(<EntfernenFrage rueckfrage={{ frage: medienFrage, entfernen: () => undefined }} onSchliessen={() => undefined} />);
  ok(text(html2).includes(medienFrage), 'PL-10 R16 Rückfrage: auch der Text für ein benutztes Medium steht im Fenster');
}

// ── Knöpfe: „Abbrechen“ schließt nur, „Entfernen“ schließt und entfernt; Escape und Hintergrund schließen wie „Abbrechen“ ──
{
  const log: string[] = [];
  const schliessen = (): void => void log.push('zu');
  const baum = EntfernenFrage({ rueckfrage: { frage: 'x', entfernen: () => void log.push('entfernen') }, onSchliessen: schliessen });
  const k = knoepfe(baum);
  gleich(k.map((x) => x.text), ['Abbrechen', 'Entfernen'], 'PL-10 R16 Knöpfe im Elementbaum: „Abbrechen“, dann „Entfernen“');
  k.find((x) => x.text === 'Abbrechen')?.klick();
  const nachAbbrechen = [...log];
  k.find((x) => x.text === 'Entfernen')?.klick();
  gleich([nachAbbrechen, log], [['zu'], ['zu', 'zu', 'entfernen']], 'PL-10 R16 „Abbrechen“ entfernt nichts (schließt nur), „Entfernen“ schließt und entfernt');
  const props = (isValidElement(baum) ? baum.props : {}) as { onClose?: unknown; closeOnBackdrop?: unknown };
  ok(isValidElement(baum) && baum.type === Modal && props.onClose === schliessen && props.closeOnBackdrop !== false, 'PL-10 R16 Escape und Klick auf den Hintergrund schließen über onClose wie „Abbrechen“ (Modal aus @jm/ui)');
}

// ── entfernenOderFragen: ohne Frage sofort, sonst die Rückfrage; entfernt wird erst über sie ──
{
  const f = (oberflaecheModul as unknown as { entfernenOderFragen?: (frage: string | null, entfernen: () => void, fragen: (r: Rueckfrage) => void) => void }).entfernenOderFragen;
  const log: string[] = [];
  let offen: Rueckfrage | undefined;
  f?.(null, () => void log.push('sofort'), () => void log.push('gefragt'));
  f?.('Frage?', () => void log.push('entfernt'), (r) => {
    offen = r;
    log.push(`gefragt ${r.frage}`);
  });
  const vorher = [...log];
  offen?.entfernen();
  gleich([typeof f, vorher, log], ['function', ['sofort', 'gefragt Frage?'], ['sofort', 'gefragt Frage?', 'entfernt']], 'PL-10 R16 entfernenOderFragen: ohne Frage sofort entfernen, mit Frage nur fragen; entfernt wird erst über die Rückfrage');
}

// ── cueEntfernen (ShowView, hooklos): läuft die Show, öffnet es die Rückfrage; entfernt wird erst mit „Entfernen“ ──
{
  const cueEntfernen = (showModul as unknown as { cueEntfernen?: (a: unknown) => void }).cueEntfernen;
  const lauf = (stand: { playingCueIds: number[]; videoCue: unknown }, cue = showCue(7, { label: 'Intro' }), index = 2) => {
    const log: string[] = [];
    let offen: Rueckfrage | undefined;
    cueEntfernen?.({ stand, cue, index, entferne: (id: number) => void log.push(`entferne ${id}`), fragen: (r: Rueckfrage) => (offen = r) });
    return { log, offen };
  };
  const ruhig = lauf({ playingCueIds: [], videoCue: null });
  gleich([typeof cueEntfernen, ruhig.log, ruhig.offen], ['function', ['entferne 7'], undefined], 'PL-10 R16 cueEntfernen: ruht die Show, wird der Cue sofort entfernt (wie bisher, ohne Rückfrage)');
  const laeuft = lauf({ playingCueIds: [3], videoCue: null });
  const vorher = [...laeuft.log];
  laeuft.offen?.entfernen();
  gleich(
    [vorher, laeuft.offen?.frage, laeuft.log],
    [[], 'Die Show läuft. Cue 3 „Intro“ trotzdem entfernen?', ['entferne 7']],
    'PL-10 R16 cueEntfernen: läuft die Show, kommt die Rückfrage (Nummer ab 1, Name wie in der Zeile) und entfernt nichts; erst „Entfernen“ entfernt den Cue',
  );
  const video = lauf({ playingCueIds: [], videoCue: { id: 9 } }, showCue(8, { label: '' }), 0);
  gleich([video.log, video.offen?.frage], [[], 'Die Show läuft. Cue 1 „m108.wav“ trotzdem entfernen?'], 'PL-10 R16 cueEntfernen: ein laufendes Video zählt, ohne Beschriftung steht der Dateiname');
}

// ── mediumEntfernen (LibraryView, hooklos): benutzen Cues oder Pads das Medium, kommt die Rückfrage, sonst wird es sofort entfernt ──
{
  const mediumEntfernen = (bibliothekModul as unknown as { mediumEntfernen?: (a: unknown) => Promise<void> }).mediumEntfernen;
  const lauf = async (n: { cues: number; pads: number }) => {
    const log: string[] = [];
    let offen: Rueckfrage | undefined;
    await mediumEntfernen?.({
      item: medium(5),
      nutzung: async (id: number) => {
        log.push(`nutzung ${id}`);
        return n;
      },
      entferne: (id: number) => void log.push(`entferne ${id}`),
      fragen: (r: Rueckfrage) => (offen = r),
    });
    return { log, offen };
  };
  const frei = await lauf({ cues: 0, pads: 0 });
  gleich([typeof mediumEntfernen, frei.log, frei.offen], ['function', ['nutzung 5', 'entferne 5'], undefined], 'PL-10 R16 mediumEntfernen: ein ungenutztes Medium geht sofort (wie bisher, ohne Rückfrage)');
  const benutzt = await lauf({ cues: 2, pads: 1 });
  const vorher = [...benutzt.log];
  benutzt.offen?.entfernen();
  gleich(
    [vorher, benutzt.offen?.frage, benutzt.log],
    [['nutzung 5'], PLAYER_TEXTE.mediumEntfernen('Titel 5', 2, 1), ['nutzung 5', 'entferne 5']],
    'PL-10 R16 mediumEntfernen: benutzt, kommt die Rückfrage mit der Anzahl und entfernt nichts; erst „Entfernen“ entfernt das Medium',
  );
}

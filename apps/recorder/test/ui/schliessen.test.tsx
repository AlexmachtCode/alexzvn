// Altfehler RE-7a (Plan 2026-11-26, Task 7; B3, D4): Läuft eine Aufnahme, fragt das Schließen des Fensters nach („Aufnahme läuft. Wirklich
// beenden?“), im Fenster wie die Rückfrage des Players (Modal aus @jm/ui, Ruling R16), ohne den Hauptprozess anzuhalten. Bestätigt das
// Fenster die Frage nicht binnen 1 s, fragt der Hauptprozess mit einem nicht blockierenden nativen Dialog; die erste Antwort gilt.
// Reine Teile (shared/schliessen.ts) mit einer Schein-Uhr, die Rückfrage als Render und über den Elementbaum (sie hat keine Hooks); den
// Hauptprozess (main/index.ts) prüft altfehler.test.ts am Quelltext. Ohne window und ohne Electron.
import { isValidElement, type ReactNode } from 'react';
import { Button, Modal } from '@jm/ui';
import { gleich, leseText, ok, render } from '@jm/ui/testhilfe';
import { SCHLIESSEN_RUECKFALL_MS, SCHLIESSEN_TEXTE, SchliessenAblauf, schliessenEntscheid } from '@shared/schliessen';
import { RECORDER_TEXTE } from '@/lib/oberflaeche';
import { RecorderOberflaeche } from '@/views/RecorderOberflaeche';
import { SchliessenFrage } from '@/views/SchliessenFrage';
import { kreuz, pruefeFaelle, vergleiche } from './hilfe';
import { attr, mitStore, ohneKommentare, tags, text } from './testzustand';

// ── RE-7a schliessenEntscheid: nur eine laufende Aufnahme fragt; bestätigt schließt; offene Frage wartet (D4) ──
{
  gleich(
    [
      schliessenEntscheid({ status: 'recording', bestaetigt: false, frageOffen: false }),
      schliessenEntscheid({ status: 'armed', bestaetigt: false, frageOffen: false }),
      schliessenEntscheid({ status: 'idle', bestaetigt: false, frageOffen: false }),
      schliessenEntscheid({ status: 'recording', bestaetigt: true, frageOffen: false }),
      schliessenEntscheid({ status: 'recording', bestaetigt: false, frageOffen: true }),
    ],
    ['fragen', 'schliessen', 'schliessen', 'schliessen', 'warten'],
    'RE-7a schliessenEntscheid: recording → fragen; armed, idle → schliessen; recording + bestaetigt → schliessen; recording + frageOffen → warten',
  );
  const faelle = kreuz({ status: ['idle', 'armed', 'recording'], bestaetigt: [false, true], frageOffen: [false, true] } as const);
  pruefeFaelle('RE-7a schliessenEntscheid (Kreuzprodukt): bestätigt schließt immer; eine offene Frage wartet, auch wenn die Aufnahme inzwischen endete (D4)', faelle, (f) =>
    vergleiche(schliessenEntscheid(f), f.bestaetigt ? 'schliessen' : f.frageOffen ? 'warten' : f.status === 'recording' ? 'fragen' : 'schliessen'),
  );
}

// ── RE-7a SchliessenAblauf mit Schein-Uhr: 1-s-Frist für den Rückfall, „gezeigt“ löscht sie, die erste Antwort gilt (D4) ──
class ScheinUhr {
  jetzt = 0;
  private n = 0;
  private laeuft: Array<{ id: number; bis: number; f: () => void }> = [];
  setze = (f: () => void, ms: number): unknown => {
    const id = ++this.n;
    this.laeuft.push({ id, bis: this.jetzt + ms, f });
    return id;
  };
  loesche = (t: unknown): void => {
    this.laeuft = this.laeuft.filter((x) => x.id !== t);
  };
  vor(ms: number): void {
    this.jetzt += ms;
    const faellig = this.laeuft.filter((x) => x.bis <= this.jetzt);
    this.laeuft = this.laeuft.filter((x) => x.bis > this.jetzt);
    for (const x of faellig) x.f();
  }
}
{
  gleich(SCHLIESSEN_RUECKFALL_MS, 1000, 'RE-7a SCHLIESSEN_RUECKFALL_MS ist 1000 (B3: nicht binnen 1 s bestätigt → nativer Dialog)');
  const uhr = new ScheinUhr();
  const a = new SchliessenAblauf(uhr);
  let rueckfall = 0;
  const r = (): void => void rueckfall++;
  const erstes = a.stelle(r);
  const zweites = a.stelle(r);
  uhr.vor(999);
  const bei999 = rueckfall;
  uhr.vor(1);
  const bei1000 = rueckfall;
  uhr.vor(5000);
  gleich([erstes, zweites, a.offen, bei999, bei1000, rueckfall], [true, false, true, 0, 1, 1], 'RE-7a SchliessenAblauf: stelle → true, zweites stelle → false (schon offen); ohne „gezeigt“ ruft die Uhr den Rückfall nach 1000 ms genau einmal, nicht bei 999');
  const antworten = [a.antwort(), a.antwort()];
  gleich([antworten, a.offen, a.stelle(r)], [[true, false], false, true], 'RE-7a SchliessenAblauf: die erste Antwort gilt (true), die zweite nicht (false); danach ist die Frage zu und eine neue lässt sich stellen');

  const uhr2 = new ScheinUhr();
  const b = new SchliessenAblauf(uhr2);
  let n2 = 0;
  b.stelle(() => void n2++);
  uhr2.vor(400);
  b.gezeigt();
  uhr2.vor(5000);
  gleich([n2, b.offen], [0, true], 'RE-7a SchliessenAblauf: mit „gezeigt“ kommt der Rückfall nie, die Frage bleibt offen bis zur Antwort');

  const uhr3 = new ScheinUhr();
  const c = new SchliessenAblauf(uhr3);
  let n3 = 0;
  c.stelle(() => void n3++);
  uhr3.vor(300);
  const antwort = c.antwort();
  uhr3.vor(5000);
  gleich([antwort, n3, c.offen], [true, 0, false], 'RE-7a SchliessenAblauf: eine Antwort vor Ablauf der Frist löscht sie (kein Rückfall danach)');
}

// ── RE-7a Texte: SCHLIESSEN_TEXTE wörtlich, RECORDER_TEXTE.schliessen ist dieselbe Konstante ──
{
  gleich(
    SCHLIESSEN_TEXTE,
    {
      frage: 'Aufnahme läuft. Wirklich beenden?',
      detail: 'Die Aufnahme wird abgeschlossen und gespeichert, danach schließt der Recorder.',
      beenden: 'Aufnahme beenden',
      weiter: 'Weiter aufnehmen',
    },
    'RE-7a Texte: SCHLIESSEN_TEXTE wörtlich wie im Plan (Frage der Spec)',
  );
  ok((RECORDER_TEXTE as unknown as { schliessen?: unknown }).schliessen === SCHLIESSEN_TEXTE, 'RE-7a Texte: RECORDER_TEXTE.schliessen ist SCHLIESSEN_TEXTE (ein Wortlaut, importiert, K4)');
}

/** Text eines Knopfinhalts (nur Zeichenketten und Zahlen). */
function inhalt(n: ReactNode): string {
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(inhalt).join('');
  if (isValidElement(n)) return inhalt((n.props as { children?: ReactNode }).children);
  return '';
}
/** Alle Knöpfe (Button aus @jm/ui) im Elementbaum, in Reihenfolge, mit Text, Variante und onClick. */
function knoepfe(n: ReactNode): Array<{ text: string; variant: unknown; klick: () => void }> {
  const aus: Array<{ text: string; variant: unknown; klick: () => void }> = [];
  const gehe = (k: ReactNode): void => {
    if (Array.isArray(k)) {
      k.forEach(gehe);
      return;
    }
    if (!isValidElement(k)) return;
    const props = k.props as { children?: ReactNode; onClick?: () => void; variant?: unknown };
    if (k.type === Button) aus.push({ text: inhalt(props.children), variant: props.variant, klick: () => props.onClick?.() });
    gehe(props.children);
  };
  gehe(n);
  return aus;
}

// ── RE-7a Fenster: die Rückfrage ist ein Fenster im Fenster, „Weiter aufnehmen“ zuerst (bekommt beim Öffnen den Fokus) ──
{
  const html = render(<SchliessenFrage onWeiter={() => undefined} onBeenden={() => undefined} />);
  const texte = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]).trim());
  ok(html.includes('role="dialog"') && html.includes('aria-modal="true"'), 'RE-7a Fenster: die Rückfrage ist ein Fenster im Fenster (Modal, role=dialog, aria-modal)');
  gleich(
    [text(html).includes(SCHLIESSEN_TEXTE.frage), text(html).includes(SCHLIESSEN_TEXTE.detail), texte, html.includes('aria-label="Schließen"'), tags(html, 'button').every((t) => attr(t, 'type') === 'button')],
    [true, true, ['Weiter aufnehmen', 'Aufnahme beenden'], false, true],
    'RE-7a Fenster: Frage und Detail, erster Knopf „Weiter aufnehmen“ (Fokus beim Öffnen), zweiter „Aufnahme beenden“; kein ✕-Kopf',
  );
  const log: string[] = [];
  const weiter = (): void => void log.push('weiter');
  const baum = SchliessenFrage({ onWeiter: weiter, onBeenden: () => void log.push('beenden') });
  const k = knoepfe(baum);
  gleich([k.map((x) => x.text), k.map((x) => x.variant)], [['Weiter aufnehmen', 'Aufnahme beenden'], ['ghost', 'destructive']], 'RE-7a Fenster: Knöpfe im Elementbaum in dieser Reihenfolge, „Aufnahme beenden“ destructive');
  k.find((x) => x.text === 'Aufnahme beenden')?.klick();
  const nachBeenden = [...log];
  k.find((x) => x.text === 'Weiter aufnehmen')?.klick();
  gleich([nachBeenden, log], [['beenden'], ['beenden', 'weiter']], 'RE-7a Fenster: ein Klick auf „Aufnahme beenden“ ruft onBeenden genau einmal (und nicht onWeiter), „Weiter aufnehmen“ ruft onWeiter');
  const props = (isValidElement(baum) ? baum.props : {}) as { onClose?: unknown; closeOnBackdrop?: unknown; title?: unknown };
  ok(isValidElement(baum) && baum.type === Modal && props.onClose === weiter && props.closeOnBackdrop !== false && props.title === undefined, 'RE-7a Fenster: Modal bekommt onClose === onWeiter (Escape und Hintergrund = weiter aufnehmen)');
}

// ── RE-7a Verdrahtung: die Oberfläche zeigt die Rückfrage, solange der Store sie offen meldet, und reicht Weiter/Beenden durch ──
{
  const offen = mitStore({ schliessenFrage: true } as never, () => render(<RecorderOberflaeche />));
  const zu = mitStore({ schliessenFrage: false } as never, () => render(<RecorderOberflaeche />));
  ok(text(offen).includes(SCHLIESSEN_TEXTE.frage) && offen.includes('role="dialog"') && !text(zu).includes(SCHLIESSEN_TEXTE.frage), 'RE-7a Verdrahtung: bei schliessenFrage zeigt die Oberfläche die Rückfrage, sonst nicht');
  const ober = ohneKommentare(leseText('src/renderer/src/views/RecorderOberflaeche.tsx'));
  ok(
    ober.includes('const schliessenFrage = useRec((s) => s.schliessenFrage);') &&
      /const schliessenWeiter = useCallback\(\(\) => schliessenAntworten\('weiter'\), \[schliessenAntworten\]\);/.test(ober) &&
      /const schliessenBeenden = useCallback\(\(\) => schliessenAntworten\('beenden'\), \[schliessenAntworten\]\);/.test(ober) &&
      ober.includes('{schliessenFrage && <SchliessenFrage onWeiter={schliessenWeiter} onBeenden={schliessenBeenden} />}'),
    'RE-7a Verdrahtung: RecorderOberflaeche liest schliessenFrage aus dem Store, onWeiter und onBeenden sind stabil (useCallback) und rufen die Store-Aktion',
  );
}

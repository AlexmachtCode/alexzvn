// Altfehler RE-7a (Plan 2026-11-26, Task 7; B3, D4): Läuft eine Aufnahme, fragt das Schließen des Fensters nach („Aufnahme läuft. Wirklich
// beenden?“), im Fenster wie die Rückfrage des Players (Modal aus @jm/ui, Ruling R16), ohne den Hauptprozess anzuhalten. Bestätigt das
// Fenster die Frage nicht binnen 1 s, fragt der Hauptprozess mit einem nicht blockierenden nativen Dialog; die erste Antwort gilt.
// Reine Teile (shared/schliessen.ts) mit einer Schein-Uhr, die Rückfrage als Render und über den Elementbaum (sie hat keine Hooks); den
// Hauptprozess (main/index.ts) prüft altfehler.test.ts am Quelltext. Ohne window und ohne Electron.
import { isValidElement, type ReactNode } from 'react';
import { Button, Modal } from '@jm/ui';
import { gleich, leseText, ok, render } from '@jm/ui/testhilfe';
import * as schliessenModul from '@shared/schliessen';
import { SCHLIESSEN_RUECKFALL_MS, SCHLIESSEN_TEXTE, SchliessenAblauf, schliessenEntscheid } from '@shared/schliessen';
import type { RecorderStatus } from '@shared/types';
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

// ── Fix-Runde 1 (Task 7, Befund 1): eine offene Frage darf nicht hängen bleiben. Lädt das Fenster neu oder stürzt der Renderer ab, nachdem
// es „gezeigt“ gemeldet hat, steht die Frage nirgends mehr. Darum stellt ein weiteres Schließen sie erneut und startet die Frist neu
// (`erneut`), ein Neuladen stellt sie erneut, und ist der Renderer weg, fragt sofort der native Dialog (`sofort`). ──
type Ablauf2 = SchliessenAblauf & { erneut?: (r: () => void) => boolean; sofort?: (r: () => void) => boolean };
{
  const uhr = new ScheinUhr();
  const a = new SchliessenAblauf(uhr) as Ablauf2;
  let n = 0;
  const r = (): void => void n++;
  const vorStellen = a.erneut?.(r);
  a.stelle(r);
  a.gezeigt();
  uhr.vor(5000);
  const erneut = a.erneut?.(r);
  uhr.vor(999);
  const bei999 = n;
  uhr.vor(1);
  const bei1000 = n;
  const nachRueckfall = a.erneut?.(r);
  uhr.vor(5000);
  gleich(
    [typeof a.erneut, vorStellen, erneut, bei999, bei1000, nachRueckfall, n, a.offen],
    ['function', false, true, 0, 1, false, 1, true],
    'RE-7a Fix-Runde 1 SchliessenAblauf.erneut: ohne offene Frage false; bei offener Frage true und die 1-s-Frist beginnt neu (Rückfall nach 1000 ms, nicht bei 999); steht schon der native Dialog, false (kein zweiter)',
  );
  const uhr2 = new ScheinUhr();
  const b = new SchliessenAblauf(uhr2) as Ablauf2;
  let m = 0;
  const r2 = (): void => void m++;
  const vorStellen2 = b.sofort?.(r2);
  b.stelle(r2);
  b.gezeigt();
  const sofort = b.sofort?.(r2);
  const gleichDanach = m;
  uhr2.vor(5000);
  const zweites = b.sofort?.(r2);
  gleich(
    [typeof b.sofort, vorStellen2, sofort, gleichDanach, m, zweites, b.offen, b.antwort(), b.offen],
    ['function', false, true, 1, 1, false, true, true, false],
    'RE-7a Fix-Runde 1 SchliessenAblauf.sofort: ohne offene Frage false; bei offener Frage sofort genau einmal der Rückfall (keine Frist mehr danach), ein zweites Mal nicht; die Frage bleibt offen bis zur Antwort',
  );
}

/** Ports der Steuerung als Attrappe: Schein-Uhr, Protokoll aller Wirkungen, ein nativer Dialog, der auf eine Antwort wartet. */
interface SteuerungPorts {
  status(): RecorderStatus;
  sendeFrage(offen: boolean): void;
  frageNativ(): Promise<number>;
  schliesse(): void;
  beendenGewuenscht(): boolean;
  wunschVerwerfen(): void;
  beende(): void;
}
interface Steuerung {
  beimSchliessen(): boolean;
  geladen(): void;
  rendererWeg(): void;
  antwortFenster(a: 'gezeigt' | 'beenden' | 'weiter'): void;
  ohneFrage(): void;
}
const SteuerungKlasse = (schliessenModul as unknown as { SchliessenSteuerung?: new (p: SteuerungPorts, uhr?: ScheinUhr) => Steuerung }).SchliessenSteuerung;
function steuerung(anfang: RecorderStatus = 'recording') {
  const uhr = new ScheinUhr();
  const log: string[] = [];
  let lage = anfang;
  let wunsch = false;
  let antworteNativ: ((n: number) => void) | null = null;
  const ports: SteuerungPorts = {
    status: () => lage,
    sendeFrage: (offen) => void log.push(`frage ${offen}`),
    frageNativ: () => {
      log.push('nativ');
      return new Promise<number>((r) => (antworteNativ = r));
    },
    schliesse: () => void log.push('schliesse'),
    beendenGewuenscht: () => wunsch,
    wunschVerwerfen: () => {
      wunsch = false;
      log.push('wunsch weg');
    },
    beende: () => void log.push('beende'),
  };
  const s = SteuerungKlasse ? new SteuerungKlasse(ports, uhr) : null;
  return {
    s,
    uhr,
    log,
    status: (x: RecorderStatus) => void (lage = x),
    wunsch: (w: boolean) => void (wunsch = w),
    nativ: async (n: number) => {
      antworteNativ?.(n);
      for (let i = 0; i < 5; i++) await Promise.resolve();
    },
  };
}
{
  ok(typeof SteuerungKlasse === 'function', 'RE-7a Fix-Runde 1: shared/schliessen.ts hat SchliessenSteuerung (die Rückfrage des Hauptprozesses, Ports statt Electron)');
  // Befund 1 (b): Neuladen bei offener Frage. Das neue Fenster bekommt die Frage erneut, die Frist beginnt neu; nach der Antwort schließt es.
  {
    const t = steuerung();
    const verhindert = t.s?.beimSchliessen();
    t.s?.antwortFenster('gezeigt');
    t.uhr.vor(5000);
    t.s?.geladen();
    const nachLaden = [...t.log];
    t.uhr.vor(999);
    const keinRueckfall = !t.log.includes('nativ');
    t.s?.antwortFenster('gezeigt');
    t.uhr.vor(5000);
    t.s?.antwortFenster('beenden');
    const danach = t.s?.beimSchliessen();
    gleich(
      [verhindert, nachLaden, keinRueckfall, t.log, danach],
      [true, ['frage true', 'frage true'], true, ['frage true', 'frage true', 'schliesse'], false],
      'RE-7a Fix-Runde 1 Neuladen bei offener Frage: das neu geladene Fenster bekommt die Frage erneut (die Frist beginnt neu), nach „Aufnahme beenden“ schließt das Fenster, das nächste close geht durch',
    );
  }
  // Befund 1 (a): die Frage ging verloren (Neuladen ohne Meldung); das nächste Schließen fragt erneut, der Rückfall beginnt neu.
  {
    const t = steuerung();
    t.s?.beimSchliessen();
    t.s?.antwortFenster('gezeigt');
    t.uhr.vor(3000);
    const verhindert = t.s?.beimSchliessen();
    t.uhr.vor(999);
    const bei999 = [...t.log];
    t.uhr.vor(1);
    const bei1000 = [...t.log];
    await t.nativ(0);
    gleich(
      [verhindert, bei999, bei1000, t.log],
      [true, ['frage true', 'frage true'], ['frage true', 'frage true', 'frage false', 'nativ'], ['frage true', 'frage true', 'frage false', 'nativ', 'schliesse']],
      'RE-7a Fix-Runde 1 Schließen bei offener Frage: die Frage geht erneut ans Fenster und der Rückfall beginnt neu (nativer Dialog nach 1000 ms, nicht bei 999); „Aufnahme beenden“ im nativen Dialog schließt',
    );
  }
  // Befund 1 (b): der Renderer ist weg (Absturz): der native Dialog fragt sofort; „Weiter aufnehmen“ lässt das Fenster offen, danach fragt ein
  // Schließen neu.
  {
    const t = steuerung();
    t.s?.beimSchliessen();
    t.s?.antwortFenster('gezeigt');
    t.s?.rendererWeg();
    const sofort = [...t.log];
    t.uhr.vor(5000);
    await t.nativ(1);
    const nachWeiter = [...t.log];
    const neu = t.s?.beimSchliessen();
    gleich(
      [sofort, nachWeiter, neu, t.log.at(-1)],
      [['frage true', 'frage false', 'nativ'], ['frage true', 'frage false', 'nativ', 'wunsch weg'], true, 'frage true'],
      'RE-7a Fix-Runde 1 Renderer weg: der native Rückfall fragt sofort (einmal, kein zweiter nach der Frist); „Weiter aufnehmen“ verwirft den Wunsch, das Fenster bleibt; ein neues Schließen fragt wieder',
    );
  }
  // Ohne offene Frage tun Neuladen und Absturz nichts; steht schon der native Dialog, stellen sie die Frage nicht noch einmal.
  {
    const t = steuerung();
    t.s?.geladen();
    t.s?.rendererWeg();
    const ohneFrage = [...t.log];
    t.s?.beimSchliessen();
    t.uhr.vor(1000);
    t.s?.geladen();
    t.s?.beimSchliessen();
    t.s?.rendererWeg();
    gleich(
      [ohneFrage, t.log],
      [[], ['frage true', 'frage false', 'nativ']],
      'RE-7a Fix-Runde 1: ohne offene Frage tun Neuladen und Absturz nichts; steht der native Dialog schon, gibt es keine zweite Frage und keinen zweiten Dialog',
    );
  }
  // D4: die erste Antwort gilt, auch eine späte aus dem Fenster neben dem nativen Dialog; endet die Aufnahme während der Frage, bleibt sie offen.
  {
    const t = steuerung();
    t.s?.beimSchliessen();
    t.uhr.vor(1000);
    t.status('armed');
    const verhindert = t.s?.beimSchliessen();
    t.s?.antwortFenster('weiter');
    await t.nativ(0);
    gleich(
      [verhindert, t.log],
      [true, ['frage true', 'frage false', 'nativ', 'wunsch weg']],
      'RE-7a Fix-Runde 1 (D4): endet die Aufnahme während der Frage, wartet das Schließen weiter; die erste Antwort gilt (hier „Weiter aufnehmen“ aus dem Fenster), die spätere aus dem nativen Dialog nicht',
    );
  }
  // B3 und Beenden-Wunsch (Cmd+Q): Abmelden oder Herunterfahren schließen ohne Frage; „Aufnahme beenden“ nach einem Wunsch beendet die App.
  {
    const t = steuerung();
    t.s?.ohneFrage();
    const durch = t.s?.beimSchliessen();
    const t2 = steuerung();
    t2.wunsch(true);
    t2.s?.beimSchliessen();
    t2.s?.antwortFenster('gezeigt');
    t2.s?.antwortFenster('beenden');
    const t3 = steuerung('armed');
    const ohneAufnahme = t3.s?.beimSchliessen();
    gleich(
      [durch, t.log, t2.log, ohneAufnahme, t3.log],
      [false, [], ['frage true', 'schliesse', 'beende'], false, []],
      'RE-7a Fix-Runde 1: nach ohneFrage (Abmelden, Herunterfahren) schließt das Fenster ohne Frage; „Aufnahme beenden“ auf einen Beenden-Wunsch hin beendet die App; ohne Aufnahme schließt es wie bisher',
    );
  }
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

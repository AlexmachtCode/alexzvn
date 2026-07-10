// ─────────────────────────────────────────────────────────────────────────────
// Quiz: Frage, Antwortkacheln, sofortige Rückmeldung.
//
// Die Rückmeldung ist doppelt kodiert (Farbe + Zeichen), damit sie auch bei
// Rot-Grün-Schwäche und auf schlecht kalibrierten Messe-Displays ankommt.
//
// Nach der Antwort sind alle Kacheln gesperrt: auf einem Touchscreen tippen
// Besucher zweimal, und die zweite Antwort dürfte weder zählen noch weiterspringen.
// ─────────────────────────────────────────────────────────────────────────────

import type { QuizNode } from '../model';
import { shuffled, type Widget, type WidgetContext } from './widget';

export interface QuizWidget extends Widget {
  /** Nächste Frage. Nach der letzten passiert nichts mehr (onComplete kam schon). */
  next(): void;
}

export function createQuiz(node: QuizNode, ctx: WidgetContext): QuizWidget {
  const p = node.props;

  const root = document.createElement('div');
  root.style.cssText = 'display:flex;flex-direction:column;gap:4%;width:100%;height:100%;';

  const questionEl = document.createElement('div');
  questionEl.style.cssText =
    `flex:0 0 auto;display:flex;align-items:center;justify-content:center;text-align:center;` +
    `font-size:${p.questionFontSize}px;font-weight:700;color:${p.textColor};` +
    `white-space:pre-wrap;word-break:break-word;`;

  const imageEl = document.createElement('div');
  imageEl.style.cssText = 'flex:1 1 auto;display:none;align-items:center;justify-content:center;min-height:0;';

  const answersEl = document.createElement('div');
  answersEl.style.cssText = 'flex:0 0 auto;display:grid;grid-template-columns:1fr 1fr;gap:2%;';

  root.append(questionEl, imageEl, answersEl);

  let order: number[] = [];
  let cursor = 0;
  let locked = false;
  let correctCount = 0;
  let advanceTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const clearTimer = (): void => {
    if (advanceTimer) clearTimeout(advanceTimer);
    advanceTimer = null;
  };

  function currentQuestion(): QuizNode['props']['questions'][number] | null {
    const idx = order[cursor];
    return idx == null ? null : (p.questions[idx] ?? null);
  }

  function renderQuestion(): void {
    const q = currentQuestion();
    if (!q) return;
    locked = false;
    clearTimer();

    questionEl.textContent = q.text;

    imageEl.textContent = '';
    if (q.imageAssetId) {
      const img = document.createElement('img');
      img.src = ctx.resolveAsset(q.imageAssetId);
      img.alt = '';
      img.draggable = false;
      img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
      imageEl.appendChild(img);
      imageEl.style.display = 'flex';
    } else {
      imageEl.style.display = 'none';
    }

    if (p.indexVar) ctx.setVar(p.indexVar, cursor + 1);

    answersEl.textContent = '';
    const answers = p.shuffleAnswers ? shuffled(q.answers) : q.answers;
    // Einspaltig, sobald nur zwei Antworten da sind — zwei riesige Kacheln
    // nebeneinander lesen sich auf einem Hochkant-Terminal schlecht.
    answersEl.style.gridTemplateColumns = answers.length <= 2 ? '1fr' : '1fr 1fr';

    for (const a of answers) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText =
        `padding:2.5% 3%;border:0;cursor:pointer;font-family:inherit;font-weight:600;` +
        `background:${p.answerColor};color:${p.textColor};border-radius:${node.props.answerFontSize / 3}px;` +
        `font-size:${p.answerFontSize}px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;`;
      btn.textContent = a.text;
      btn.addEventListener('click', () => answer(a.correct, a.text, btn));
      answersEl.appendChild(btn);
    }
  }

  function answer(correct: boolean, text: string, btn: HTMLButtonElement): void {
    if (locked || destroyed) return;
    locked = true;

    for (const el of Array.from(answersEl.children) as HTMLButtonElement[]) {
      el.disabled = true;
      el.style.cursor = 'default';
    }
    btn.style.background = correct ? p.correctColor : p.wrongColor;
    btn.style.color = '#ffffff';
    // Zweiter Kanal neben der Farbe.
    btn.textContent = `${correct ? '✓' : '✗'}  ${text}`;

    if (correct) {
      correctCount++;
      if (p.scoreVar) ctx.setVar(p.scoreVar, correctCount);
    }
    ctx.fire(correct ? 'onCorrect' : 'onWrong', text);

    const last = cursor >= order.length - 1;
    if (last) {
      // onComplete erst nach der Rückmeldung — sonst wechselt die Szene, bevor
      // der Besucher sieht, ob er richtig lag.
      advanceTimer = setTimeout(() => ctx.fire('onComplete', correctCount), Math.max(300, p.advanceMs));
      return;
    }
    if (p.advanceMs > 0) advanceTimer = setTimeout(next, p.advanceMs);
  }

  function next(): void {
    if (destroyed || cursor >= order.length - 1) return;
    cursor++;
    renderQuestion();
  }

  // `reset()` rendert die erste Frage und schreibt die Variablen. Der Player ruft
  // es, wenn die Szene vollständig im DOM steht — würde die Factory das selbst
  // tun, feuerten `onVarChange`-Regeln in eine halb gebaute Szene.
  function reset(): void {
    clearTimer();
    cursor = 0;
    correctCount = 0;
    locked = false;
    order = p.questions.map((_, i) => i);
    if (p.shuffleQuestions) order = shuffled(order);
    if (p.scoreVar) ctx.setVar(p.scoreVar, 0);
    renderQuestion();
  }

  return {
    el: root,
    next,
    reset,
    destroy() {
      destroyed = true;
      clearTimer();
    },
  };
}

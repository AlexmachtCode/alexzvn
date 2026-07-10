// ─────────────────────────────────────────────────────────────────────────────
// Memory: Karten umdrehen, Paare finden.
//
// Bleiben `matchLabel`/`matchAssetId` eines Paares leer, zeigen beide Karten
// dasselbe (klassisches Memory). Sonst entsteht ein Zuordnungsspiel Begriff ↔
// Bild — der eigentliche Wissensvermittler auf einem Messestand.
//
// Zwei Regeln, die auf einem Touch-Terminal über Frust entscheiden:
//   • während zwei ungleiche Karten zurückklappen, ist alles gesperrt
//   • eine bereits offene Karte reagiert nicht auf einen zweiten Tipp
// ─────────────────────────────────────────────────────────────────────────────

import type { MemoryNode } from '../model';
import { faceContent, shuffled, type Widget, type WidgetContext } from './widget';

interface Card {
  pairId: string;
  label: string;
  assetId: string | null;
  /** Beschriftung des Paares — für `$result` bei `onMatch`. */
  pairLabel: string;
  el: HTMLElement;
  faceEl: HTMLElement;
  open: boolean;
  matched: boolean;
}

export function createMemory(node: MemoryNode, ctx: WidgetContext): Widget {
  const p = node.props;

  const grid = document.createElement('div');
  const columns = Math.max(1, Math.round(p.columns));
  grid.style.cssText =
    `display:grid;width:100%;height:100%;gap:${p.gap}px;` +
    `grid-template-columns:repeat(${columns}, 1fr);grid-auto-rows:1fr;`;

  let cards: Card[] = [];
  let firstOpen: Card | null = null;
  let busy = false;
  let matches = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const clearTimer = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  function showBack(c: Card): void {
    c.el.style.background = p.backColor;
    c.faceEl.textContent = p.backLabel;
    c.faceEl.style.color = '#ffffff';
  }

  function showFace(c: Card): void {
    c.el.style.background = p.faceColor;
    c.faceEl.style.color = p.textColor;
    faceContent(c.faceEl, { label: c.label, assetId: c.assetId }, ctx);
  }

  function build(): void {
    grid.textContent = '';
    cards = [];

    const raw: Omit<Card, 'el' | 'faceEl' | 'open' | 'matched'>[] = [];
    for (const pair of p.pairs) {
      const hasOwnMatch = !!(pair.matchLabel || pair.matchAssetId);
      raw.push({ pairId: pair.id, label: pair.label, assetId: pair.assetId, pairLabel: pair.label });
      raw.push({
        pairId: pair.id,
        label: hasOwnMatch ? pair.matchLabel : pair.label,
        assetId: hasOwnMatch ? pair.matchAssetId : pair.assetId,
        pairLabel: pair.label,
      });
    }

    for (const r of shuffled(raw)) {
      const el = document.createElement('button');
      el.type = 'button';
      el.style.cssText =
        `display:flex;align-items:center;justify-content:center;border:0;cursor:pointer;` +
        `border-radius:${p.radius}px;font-size:${p.fontSize}px;font-weight:700;font-family:inherit;` +
        `padding:4%;overflow:hidden;touch-action:manipulation;-webkit-tap-highlight-color:transparent;` +
        `transition:background 140ms ease;`;

      const faceEl = document.createElement('span');
      faceEl.style.cssText =
        'display:flex;align-items:center;justify-content:center;width:100%;height:100%;pointer-events:none;';
      el.appendChild(faceEl);

      const card: Card = { ...r, el, faceEl, open: false, matched: false };
      showBack(card);
      el.addEventListener('click', () => flip(card));
      grid.appendChild(el);
      cards.push(card);
    }
  }

  function flip(c: Card): void {
    if (destroyed || busy || c.open || c.matched) return;

    c.open = true;
    showFace(c);

    if (!firstOpen) {
      firstOpen = c;
      return;
    }

    const other = firstOpen;
    firstOpen = null;

    if (other.pairId === c.pairId) {
      c.matched = true;
      other.matched = true;
      c.el.style.cursor = 'default';
      other.el.style.cursor = 'default';
      c.el.style.opacity = '0.55';
      other.el.style.opacity = '0.55';

      matches++;
      if (p.matchesVar) ctx.setVar(p.matchesVar, matches);
      ctx.fire('onMatch', c.pairLabel);

      if (matches === p.pairs.length) {
        // Kurz stehen lassen: das letzte Paar soll man noch sehen.
        timer = setTimeout(() => ctx.fire('onComplete', matches), 500);
      }
      return;
    }

    // Ungleich → beide zurück. Solange ist das Brett gesperrt.
    busy = true;
    timer = setTimeout(() => {
      timer = null;
      busy = false;
      if (destroyed) return;
      for (const card of [other, c]) {
        card.open = false;
        showBack(card);
      }
    }, p.flipBackMs);
  }

  // `reset()` mischt und baut das Brett. Der Player ruft es, wenn die Szene
  // vollständig im DOM steht — würde die Factory das selbst tun, feuerten
  // `onVarChange`-Regeln in eine halb gebaute Szene.
  function reset(): void {
    clearTimer();
    firstOpen = null;
    busy = false;
    matches = 0;
    if (p.matchesVar) ctx.setVar(p.matchesVar, 0);
    build();
  }

  return {
    el: grid,
    reset,
    destroy() {
      destroyed = true;
      clearTimer();
    },
  };
}

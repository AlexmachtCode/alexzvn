// Gemeinsame Schnittstelle der Spiel-Widgets.
//
// Ein Widget baut sein eigenes DOM, meldet Trigger über `fire` und weiß nichts
// von Regeln, Szenen oder dem restlichen Dokument. Der Player übersetzt die
// gemeldeten Trigger in Regelketten — so bleibt jedes Spiel für sich testbar.

import type { TriggerType, VarValue } from '../logic';

export interface WidgetContext {
  /** Asset-ID → URL. Unterscheidet Sandbox, Kiosk und Export. */
  resolveAsset: (id: string) => string;
  /** Trigger an den Player melden; `result` füllt `$result` in Bedingungen. */
  fire: (trigger: TriggerType, result?: VarValue) => void;
  /** Zahlenvariable setzen (Punkte, gefundene Paare, Fragennummer). */
  setVar: (name: string, value: VarValue) => void;
}

export interface Widget {
  el: HTMLElement;
  /** In den Ausgangszustand (neu mischen, erste Frage, Karten zurück). */
  reset(): void;
  destroy(): void;
}

/** Fisher-Yates. Kopiert, damit das Dokument unangetastet bleibt. */
export function shuffled<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Karte/Antwort/Kachel — überall dieselbe Optik für Bild-oder-Text. */
export function faceContent(
  el: HTMLElement,
  face: { label?: string; assetId?: string | null },
  ctx: WidgetContext,
): void {
  el.textContent = '';
  if (face.assetId) {
    const img = document.createElement('img');
    img.src = ctx.resolveAsset(face.assetId);
    img.alt = face.label ?? '';
    img.draggable = false;
    img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;pointer-events:none;';
    el.appendChild(img);
    return;
  }
  el.textContent = face.label ?? '';
}

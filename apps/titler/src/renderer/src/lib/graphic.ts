import type { GraphicTemplate, TitlerConfig } from '@shared/types';
import { resolveSlots } from '@shared/vars';
import type { EngineGraphic } from './engine';

/**
 * Aktive Grafik-Vorlage (#162) für den Render-Loop bestimmen: die per
 * `config.activeGraphicId` gewählte Vorlage aus der Library + ihre aufgelösten
 * Slot-Texte. `undefined`, wenn kein Grafik-Template aktiv/gefunden ist (dann
 * zeichnet drawGraphic nichts — Guard gegen gelöschte activeGraphicId).
 */
export function activeGraphic(
  config: TitlerConfig,
  templates: GraphicTemplate[],
  variables: Record<string, string>,
): EngineGraphic | undefined {
  if (config.template !== 'graphic') return undefined;
  const tpl = templates.find((t) => t.id === config.activeGraphicId);
  if (!tpl) return undefined;
  return { tpl, slotText: resolveSlots(tpl, config.slotText, variables) };
}

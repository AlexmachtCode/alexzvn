import { useEffect, useMemo, useRef } from 'react';
import { DEFAULT_CONFIG, type TitlerConfig } from '@shared/types';
import { resolveConfigVars } from '@shared/vars';
import { useTitler } from '@/store/titler';
import { useTitlerEngine } from '@/lib/engine';
import { activeGraphic } from '@/lib/graphic';

/**
 * Ausgabe-Fenster für den 2. Bildschirm (#161): zeigt denselben CG wie NDI, aber
 * auf Chroma-Green statt transparent — für externe Hardware-Keyer (vMix/ATEM/
 * TriCaster). Eigener Renderer-Prozess; Config + Variablen kommen per Broadcast
 * aus dem Main (store), On-Air wird vom Operator über den Main hierher gepusht.
 *
 * Der Canvas hat die Programm-Auflösung als Backing-Store und wird per CSS
 * `object-fit: contain` auf den Monitor skaliert. So bleibt die Bauchbinde im
 * korrekten Seitenverhältnis; etwaige Ränder sind ohnehin grün (unsichtbar für
 * den Keyer).
 */
export function OutputView(): React.JSX.Element {
  const state = useTitler((s) => s.state);
  const onAir = useTitler((s) => s.onAir);
  const templates = useTitler((s) => s.templates);

  const config: TitlerConfig = state?.config ?? DEFAULT_CONFIG;
  const variables = state?.status.variables ?? {};

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resolved = useMemo(() => resolveConfigVars(config, variables), [config, variables]);
  const graphic = useMemo(() => activeGraphic(config, templates, variables), [config, templates, variables]);
  // Kein NDI im Output-Fenster; Hintergrund = Chroma-Green.
  const { take, clear } = useTitlerEngine(resolved, false, canvasRef, { bg: config.chromaColor, graphic });

  // On-Air-Push (vom Main) treibt die Ein-/Ausblendung.
  useEffect(() => {
    if (onAir) take();
    else clear();
  }, [onAir, take, clear]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: config.chromaColor,
        overflow: 'hidden',
        cursor: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        width={config.width}
        height={config.height}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}

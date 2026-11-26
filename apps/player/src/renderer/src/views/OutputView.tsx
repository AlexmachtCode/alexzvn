import { useEffect, useRef, useState } from 'react';
import type { OutputCommand } from '@shared/types';

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * Schlankes Video-Ausgabefenster (2. Screen). Läuft im selben Renderer-Bundle
 * unter #output, ohne Store/Haupt-UI. Reagiert auf OutputCommands vom Haupt-
 * fenster und treibt ein Vollbild-`<video>` mit Fade (Opazität + Volume-Rampe).
 */
export function OutputView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rampRef = useRef<number | null>(null);
  const [fadeMs, setFadeMs] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const stopRamp = (): void => {
      if (rampRef.current != null) {
        cancelAnimationFrame(rampRef.current);
        rampRef.current = null;
      }
    };
    const rampVolume = (to: number, ms: number): void => {
      stopRamp();
      if (ms <= 0) {
        v.volume = clamp01(to);
        return;
      }
      const from = v.volume;
      const start = performance.now();
      const step = (now: number): void => {
        const t = Math.min(1, (now - start) / ms);
        v.volume = clamp01(from + (to - from) * t);
        if (t < 1) rampRef.current = requestAnimationFrame(step);
        else rampRef.current = null;
      };
      rampRef.current = requestAnimationFrame(step);
    };
    const clearSource = (): void => {
      v.pause();
      v.removeAttribute('src');
      v.load();
    };

    const off = window.jmplay.output.onCommand((cmd: OutputCommand) => {
      switch (cmd.type) {
        case 'load': {
          const target = Math.min(1, Math.pow(10, (cmd.gainDb || 0) / 20));
          v.loop = cmd.loop;
          v.src = cmd.url;
          v.currentTime = 0;
          setFadeMs(cmd.fadeInSec * 1000);
          v.volume = cmd.fadeInSec > 0 ? 0 : target;
          setVisible(true);
          void v.play().catch(() => {});
          if (cmd.fadeInSec > 0) rampVolume(target, cmd.fadeInSec * 1000);
          break;
        }
        case 'stop': {
          setFadeMs(cmd.fadeOutSec * 1000);
          setVisible(false);
          if (cmd.fadeOutSec > 0) {
            rampVolume(0, cmd.fadeOutSec * 1000);
            window.setTimeout(clearSource, cmd.fadeOutSec * 1000 + 90);
          } else {
            clearSource();
          }
          break;
        }
        case 'pause':
          v.pause();
          break;
        case 'resume':
          void v.play().catch(() => {});
          break;
        case 'black':
          setFadeMs(0);
          setVisible(false);
          clearSource();
          break;
      }
    });
    // Altfehler PL-N: erst jetzt hört die Ansicht zu; der Main hält Befehle bis zu dieser Meldung zurück (höchstens 5000 ms).
    window.jmplay.output.meldeBereit();

    const onEnded = (): void => {
      if (!v.loop) void window.jmplay.output.notifyEnded();
    };
    v.addEventListener('ended', onEnded);

    // Wiedergabe-Position ans Hauptfenster melden (Issue #41). `timeupdate` feuert
    // ~4×/s während der Wiedergabe; `loadedmetadata` liefert die Dauer sofort.
    const onTime = (): void => {
      if (Number.isFinite(v.duration)) {
        void window.jmplay.output.reportTime({ currentTime: v.currentTime, duration: v.duration });
      }
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onTime);

    return () => {
      off();
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onTime);
      stopRamp();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black" style={{ cursor: 'none' }}>
      <video
        ref={videoRef}
        className="h-full w-full bg-black object-contain transition-opacity"
        style={{ opacity: visible ? 1 : 0, transitionDuration: `${fadeMs}ms` }}
        playsInline
      />
    </div>
  );
}

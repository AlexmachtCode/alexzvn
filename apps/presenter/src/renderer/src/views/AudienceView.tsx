import { useEffect, useRef, useState } from 'react';
import type { Slide } from '@shared/types';
import { SlideCanvas } from '@/components/SlideCanvas';
import { usePresentation, usePresenterKeys } from '@/lib/usePresentation';
import { uebergangFuer } from '../../../shared/wiedergabe';

/** Eine gestapelte Folie. Die oberste ist die aktuelle; darunter bleibt die alte, bis der Wechsel fertig ist. */
interface Schicht {
  key: number;
  slide: Slide;
  /** 0 = Schnitt. */
  blendeMs: number;
  /** Gemalt (und bei Überblendung: Einblenden gestartet). */
  sichtbar: boolean;
}

export function AudienceView() {
  const { slides, state, wiedergabe } = usePresentation();
  usePresenterKeys(true);

  const current = slides?.[state.index] ?? null;
  const [schichten, setSchichten] = useState<Schicht[]>([]);
  const zaehler = useRef(0);

  // #293: Neue Folie oben auflegen. Der Übergang gehört zur hereinkommenden Folie (wie in PowerPoint);
  // die allererste Folie kommt ohne Übergang.
  useEffect(() => {
    if (!current) {
      setSchichten([]);
      return;
    }
    setSchichten((alt) => {
      const oben = alt[alt.length - 1];
      if (oben && oben.slide.id === current.id) return alt;
      const u = uebergangFuer(current, wiedergabe);
      zaehler.current += 1;
      const neu: Schicht = {
        key: zaehler.current,
        slide: current,
        blendeMs: oben && u.art === 'blende' ? u.dauerMs : 0,
        sichtbar: false,
      };
      // Beim schnellen Weiterklicken höchstens zwei alte Schichten halten.
      return [...alt.slice(-2), neu];
    });
  }, [current, wiedergabe]);

  /** Alles unter dieser Schicht ist verdeckt → weg damit. */
  const fertig = (key: number): void =>
    setSchichten((alt) => {
      const i = alt.findIndex((s) => s.key === key);
      return i <= 0 ? alt : alt.slice(i);
    });

  const gemalt = (s: Schicht): void => {
    if (s.blendeMs <= 0) {
      // Schnitt: die alte Folie bleibt stehen, bis die neue gemalt ist — kein Schwarzblitz.
      setSchichten((alt) => alt.map((x) => (x.key === s.key ? { ...x, sichtbar: true } : x)));
      fertig(s.key);
      return;
    }
    // Überblendung: zwei Frames warten, damit der Browser die Deckkraft 0 sicher gezeichnet hat.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setSchichten((alt) => alt.map((x) => (x.key === s.key ? { ...x, sichtbar: true } : x))),
      ),
    );
    // Sicherung, falls transitionend ausbleibt (z. B. Fenster verdeckt).
    setTimeout(() => fertig(s.key), s.blendeMs + 300);
  };

  // Pause screens cover the slide entirely (B/W keys, remote, presenter buttons).
  if (state.screen === 'black') {
    return <div className="h-full w-full bg-black" />;
  }
  if (state.screen === 'white') {
    return <div className="h-full w-full bg-white" />;
  }

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {schichten.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">Bereit</div>
      )}
      {schichten.map((s) => (
        <div
          key={s.key}
          className="absolute inset-0 flex items-center justify-center"
          style={{
            opacity: s.blendeMs > 0 && !s.sichtbar ? 0 : 1,
            transition: s.blendeMs > 0 ? `opacity ${s.blendeMs}ms ease-in-out` : 'none',
          }}
          onTransitionEnd={(e) => {
            if (e.propertyName === 'opacity' && s.sichtbar) fertig(s.key);
          }}
        >
          <SlideCanvas slide={s.slide} maxWidth={1920} onGemalt={() => gemalt(s)} />
        </div>
      ))}
    </div>
  );
}

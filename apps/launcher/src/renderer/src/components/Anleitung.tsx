import { useEffect } from 'react';
import {
  ANLEITUNG_TEXTE,
  AnleitungsSchicht,
  anleitungAnsicht,
  noDragRegion,
  useAnsage,
  type AnleitungsAnsicht,
} from '@jm/ui';
import { EINRICHTUNG, LAUNCHER_ANLEITUNG_TEXTE } from '@/anleitung/einrichtung';
import { ansageUrl, STIMME_VORHANDEN } from '@/anleitung/stimme';
import { anleitungsUmgebung, launcherBlase } from '@/lib/anleitung-zustand';
import { useAnleitung } from '@/store/anleitung';
import { useTools } from '@/store/tools';

// Geführte Anleitung im Launcher (Spec 3, 6, 7; Plan P14): Hervorhebung, Sprechblase und Ansage über allen Dialogen.
// Ebene z-[65]: über den Dialogen (z-40/z-50) und dem Show-Lade-Overlay (z-[60]), unter der Meldung (z-[70], Wächter M1).
// Die Ebene fängt keine Klicks (pointer-events-none), nur die Sprechblase; über dem Kopf braucht sie noDragRegion, sonst
// schluckt die Zieh-Fläche ihre Klicks. In der Produktion (ein Tool läuft, eine Show startet, eine iveo-Show ist aktiv, am
// Master folgen Tools der verteilten Show) und kurz nach dem Start, solange das unklar ist, ist die Stimme aus und
// eingreifende Schritte zeigen nur (G15, EP24). Die Anleitung bedient nichts (G3).

/** Ansicht der Anleitung aus Fortschritt, Zustand, Produktion und Stimme — geteilt mit Kapitelübersicht und Kopf. */
export function useAnleitungsAnsicht(): AnleitungsAnsicht {
  const fortschritt = useAnleitung((s) => s.fortschritt);
  const jetzt = useAnleitung((s) => s.jetzt);
  const produktion = useAnleitung((s) => s.produktion);
  const produktionUnklar = useAnleitung((s) => s.produktionUnklar);
  const stimmeAn = useAnleitung((s) => s.stimmeAn);
  const stimmeTrotzdem = useAnleitung((s) => s.stimmeTrotzdem);
  const umgebung = anleitungsUmgebung({ produktion, produktionUnklar, stimmeAn, stimmeTrotzdem }, STIMME_VORHANDEN);
  return anleitungAnsicht(EINRICHTUNG, fortschritt, jetzt, umgebung);
}

export function Anleitung() {
  const ansicht = useAnleitungsAnsicht();
  const produktionUnklar = useAnleitung((s) => s.produktionUnklar);
  const speicher = useAnleitung((s) => s.speicher);
  const ereignis = useAnleitung((s) => s.ereignis);
  const stimmeAn = useAnleitung((s) => s.stimmeAn);
  const stimmeUmschalten = useAnleitung((s) => s.stimmeUmschalten);
  const stimmeTrotzdemAn = useAnleitung((s) => s.stimmeTrotzdemAn);
  const ladeSteuerebene = useAnleitung((s) => s.ladeSteuerebene);
  const onboardingOpen = useTools((s) => s.onboardingOpen);
  // EP23, EP24: bei „unklar“ keine behauptete Produktion (L15 statt U21); merkt der Rechner nichts, sagt es die Blase (U26).
  const gezeigt = launcherBlase(ansicht, { produktionUnklar, speicher }, { stimmeWartet: LAUNCHER_ANLEITUNG_TEXTE.stimmeWartet, nichtGemerkt: ANLEITUNG_TEXTE.speicherNichtSchreibbar });
  const id = gezeigt.blase?.ansage.id ?? null;
  const spielen = gezeigt.blase?.ansage.spielen ?? false;
  const fehler = useAnsage(id ? ansageUrl(id) : null, id, spielen);

  // EP19: Steuerebene alle 5 s nachlesen (nur Lese-IPC), solange Sprechblase oder Kapitelübersicht offen sind — nach dem
  // Aktivieren geht Kapitel 5 von selbst zu Token und QR, ohne dass jemand das Fenster neu fokussiert.
  const sichtbar = ansicht.blase !== null || onboardingOpen;
  useEffect(() => {
    if (!sichtbar) return;
    const t = setInterval(() => void ladeSteuerebene(), 5000);
    return () => clearInterval(t);
  }, [sichtbar, ladeSteuerebene]);

  return (
    <AnleitungsSchicht
      ansicht={gezeigt}
      aufEreignis={ereignis}
      className="pointer-events-none fixed inset-0 z-[65]"
      blasenStil={noDragRegion}
      stimme={{ vorhanden: STIMME_VORHANDEN, an: stimmeAn, fehler, umschalten: stimmeUmschalten, trotzdemAn: stimmeTrotzdemAn }}
    />
  );
}

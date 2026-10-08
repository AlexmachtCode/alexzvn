// --- @jm/settings: Text-Entwurf für Eingaben, die erst beim Verlassen gelten ---
//
// Ein Quellenname oder eine Farbe soll nicht bei jedem Tastendruck beim Tool ankommen (ein NDI-
// Sender startete sonst je Buchstabe neu). Enter und Verlassen übernehmen, Escape verwirft einen
// geänderten Entwurf und verbraucht die Taste (das Panel bleibt offen, Plan E8). Ein gemeldeter Text
// wird nur einmal gemeldet; kommt er nicht innerhalb der Frist als Wert zurück, steht „Noch nicht
// übernommen.“ am Feld (E27, dieselben Regeln wie zahlSchritt in @jm/ui).
import { starteFrist } from '@jm/ui';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ABSCHNITT_TEXTE } from './vertrag';

/** Props des Eingabefelds (per Spread an TextInput). */
export interface TextFeld {
  value: string;
  onChange(value: string): void;
  onBlur(): void;
  onKeyDown(e: KeyboardEvent<HTMLInputElement>): void;
}

/** feld geht an TextInput, fehler (nach der Frist „Noch nicht übernommen.“) an Field. */
export interface TextEntwurf {
  feld: TextFeld;
  fehler?: string;
}

/** Text wie getippt; geaendert = weicht vom Wert ab; gesendet = gemeldet, aber noch nicht zurückgekommen (E27). */
export interface TextZustand {
  text: string;
  geaendert: boolean;
  gesendet?: string;
  fehler?: string;
}

export type TextEreignis =
  | { art: 'tippen'; text: string }
  | { art: 'uebernehmen' } // Enter oder Verlassen
  | { art: 'verwerfen' } // Escape
  | { art: 'aussen'; wert: string } // neuer Wert von außen
  | { art: 'frist' }; // die Frist nach dem Melden ist um

export function textZustandAus(wert: string): TextZustand {
  return { text: wert, geaendert: false };
}

/**
 * Ein Schritt des Entwurfs (dieselben Regeln wie zahlSchritt in @jm/ui). neu nur, wenn ein geänderter, gültiger Text
 * übernommen wird, der vom Wert abweicht und noch nicht gemeldet ist. verbraucht = Escape hat einen geänderten Entwurf
 * verworfen (dann gehört Escape dem Feld, nicht dem Panel).
 */
export function textSchritt(
  z: TextZustand,
  e: TextEreignis,
  wert: string,
  gueltig: (neu: string) => boolean = () => true,
): { z: TextZustand; neu?: string; verbraucht: boolean } {
  if (e.art === 'tippen') return { z: { text: e.text, geaendert: e.text !== wert }, verbraucht: false };
  if (e.art === 'uebernehmen') {
    const neu = z.text.trim();
    if (!z.geaendert || neu === wert) return { z: textZustandAus(wert), verbraucht: false };
    if (neu === z.gesendet || !gueltig(neu)) return { z, verbraucht: false };
    return { z: { text: z.text, geaendert: true, gesendet: neu }, neu, verbraucht: false };
  }
  if (e.art === 'verwerfen') return { z: textZustandAus(wert), verbraucht: z.geaendert };
  if (e.art === 'frist') {
    return { z: z.gesendet === undefined || z.fehler ? z : { ...z, fehler: ABSCHNITT_TEXTE.nochNichtUebernommen }, verbraucht: false };
  }
  // aussen: ein ungeänderter oder schon gemeldeter Entwurf folgt; ein angefangener bleibt stehen (nichts Getipptes geht verloren)
  if (!z.geaendert || z.gesendet !== undefined || z.text.trim() === e.wert) return { z: textZustandAus(e.wert), verbraucht: false };
  return { z, verbraucht: false };
}

/**
 * Text-Entwurf für ein Feld, das erst bei Enter oder Verlassen gilt. Wie NumberInput (Task 10): Jeder Schritt rechnet
 * textSchritt auf dem Stand in der Ref und schreibt Ref und State sofort; kein Updater liest eine Ref, die danach
 * überschrieben wird.
 */
export function useTextEntwurf(wert: string, uebernehmen: (neu: string) => void, gueltig?: (neu: string) => boolean): TextEntwurf {
  const [z, setZ] = useState<TextZustand>(() => textZustandAus(wert));
  const zRef = useRef(z);
  const wertRef = useRef(wert);
  wertRef.current = wert;
  const rueckrufe = useRef({ uebernehmen, gueltig });
  rueckrufe.current = { uebernehmen, gueltig };

  const schritt = (e: TextEreignis): { verbraucht: boolean } => {
    const r = textSchritt(zRef.current, e, wertRef.current, rueckrufe.current.gueltig);
    zRef.current = r.z;
    setZ(r.z);
    if (r.neu !== undefined) rueckrufe.current.uebernehmen(r.neu);
    return r;
  };
  const schrittRef = useRef(schritt);
  schrittRef.current = schritt;

  useEffect(() => {
    schrittRef.current({ art: 'aussen', wert });
  }, [wert]);
  useEffect(
    () => (z.gesendet === undefined ? undefined : starteFrist(() => schrittRef.current({ art: 'frist' }))),
    [z.gesendet],
  );

  return {
    fehler: z.fehler,
    feld: {
      value: z.text,
      onChange: (text) => schritt({ art: 'tippen', text }),
      onBlur: () => schritt({ art: 'uebernehmen' }),
      onKeyDown: (e) => {
        if (e.key === 'Enter') schritt({ art: 'uebernehmen' });
        else if (e.key === 'Escape' && schritt({ art: 'verwerfen' }).verbraucht) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
    },
  };
}

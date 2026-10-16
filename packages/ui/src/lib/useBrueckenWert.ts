// Hook zur lesenden Status-Brücke (Plan E5): undefined, solange weder Antwort noch Ereignis da ist (die App zeigt dann
// „unbekannt“), null ohne Quelle oder bei Ablehnung, sonst der zuletzt gemeldete Wert. Eine späte Antwort nach einem
// Ereignis meldet verbindeBruecke gar nicht erst. Anmelden und Abfragen nur im Effekt, nie beim Rendern (Render-Tests
// laufen ohne window). Die Quelle muss stabil sein (modulweite Konstante oder useMemo), sonst meldet sich der Hook bei
// jedem Rendern neu an. Den Zustandsübergang rechnen hookSchritt und hookWert, den Körper des Effekts hookAbo: rein und
// ohne DOM getestet; der Hook selbst ruft nur sie.
import { useEffect, useState } from 'react';
import { verbindeBruecke, type BrueckenQuelle } from './bruecke';

/** Was der Hook sich merkt: den zuletzt gemeldeten Wert und die Quelle, für die er gilt. */
export interface HookZustand<T> {
  fuer: BrueckenQuelle<T> | undefined;
  wert: T | null | undefined;
}

/** Zustandsübergang bei einer Meldung: Jede Meldung ersetzt den Wert, auch „sucht“ oder null nach „verbunden“. */
export function hookSchritt<T>(_alt: HookZustand<T>, quelle: BrueckenQuelle<T>, wert: T | null): HookZustand<T> {
  return { fuer: quelle, wert };
}

/** Rückgabe des Hooks: ohne Quelle null; für eine neue Quelle undefined, denn was die alte meldete, gilt nicht mehr. */
export function hookWert<T>(z: HookZustand<T>, quelle: BrueckenQuelle<T> | undefined): T | null | undefined {
  if (!quelle) return null;
  return z.fuer === quelle ? z.wert : undefined;
}

/**
 * Körper des Effekts: verbindet die Quelle (erst anmelden, dann abfragen) und gibt jede Meldung über hookSchritt an setZ
 * weiter, auch „sucht“ oder null nach einem Wert. Ohne Quelle meldet er nichts an. Rückgabe: abmelden.
 */
export function hookAbo<T>(
  quelle: BrueckenQuelle<T> | undefined,
  setZ: (schritt: (alt: HookZustand<T>) => HookZustand<T>) => void,
): (() => void) | undefined {
  if (!quelle) return undefined;
  return verbindeBruecke(quelle, (wert) => setZ((alt) => hookSchritt(alt, quelle, wert)));
}

export function useBrueckenWert<T>(quelle: BrueckenQuelle<T> | undefined): T | null | undefined {
  const [z, setZ] = useState<HookZustand<T>>({ fuer: quelle, wert: undefined });
  useEffect(() => hookAbo(quelle, setZ), [quelle]);
  return hookWert(z, quelle);
}

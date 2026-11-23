// Task 6 · Halten-zum-Sprechen (Spec 3.4, E9, Review Focus 2): onPress und onRelease je Druck genau einmal.
// Loslassen zählt nur über dieselbe Quelle (Zeiger bzw. Taste); abbrechen (pointercancel, lostpointercapture, blur,
// Wechsel auf gesperrt, Unmount) löst immer, aber nie ein zweites Mal.
import { beobachteFensterVerlust, erzeugeHalten, type FensterZiel, type HaltenQuelle, type HaltenRueckrufe } from '../src/lib/halten';
import { ok } from './harness';

function mitZaehler(): { z: { press: number; release: number }; rueckrufe: HaltenRueckrufe } {
  const z = { press: 0, release: 0 };
  return {
    z,
    rueckrufe: {
      onPress: () => {
        z.press++;
      },
      onRelease: () => {
        z.release++;
      },
    },
  };
}

{
  const { z, rueckrufe } = mitZaehler();
  const h = erzeugeHalten(rueckrufe);
  h.druecken('zeiger');
  const nachErstem = z.press === 1 && z.release === 0 && h.gehalten;
  h.druecken('zeiger');
  h.druecken('taste');
  ok(nachErstem && z.press === 1 && z.release === 0, 'Halten: druecken → onPress einmal; zweites druecken nichts');
}

{
  const { z, rueckrufe } = mitZaehler();
  const h = erzeugeHalten(rueckrufe);
  h.druecken('zeiger');
  h.loslassen('zeiger');
  const nachErstem = z.release === 1 && !h.gehalten;
  h.loslassen('zeiger');
  ok(nachErstem && z.press === 1 && z.release === 1, 'Halten: loslassen → onRelease einmal; zweites loslassen nichts');
}

{
  const { z, rueckrufe } = mitZaehler();
  const h = erzeugeHalten(rueckrufe);
  h.druecken('zeiger');
  h.loslassen('zeiger'); // pointerup
  h.abbrechen(); // lostpointercapture kommt danach
  ok(z.press === 1 && z.release === 1, 'Halten: loslassen + abbrechen (pointerup + lostpointercapture) → ein onRelease');
}

{
  const { z, rueckrufe } = mitZaehler();
  const h = erzeugeHalten(rueckrufe);
  h.abbrechen();
  ok(z.press === 0 && z.release === 0 && !h.gehalten, 'Halten: abbrechen ohne druecken → nichts');
}

{
  const { z, rueckrufe } = mitZaehler();
  const h = erzeugeHalten(rueckrufe);
  h.druecken('taste');
  h.loslassen('zeiger');
  const nochGehalten = h.gehalten && z.release === 0;
  h.abbrechen();
  ok(
    nochGehalten && z.release === 1 && !h.gehalten,
    "Halten: mit Taste gehalten, loslassen('zeiger') löst nicht; abbrechen löst einmal",
  );
}

{
  let release = 0;
  const h = erzeugeHalten({
    onPress: () => {
      throw new Error('Talkback-Fehler');
    },
    onRelease: () => {
      release++;
    },
  });
  let geworfen = '';
  try {
    h.druecken('zeiger');
  } catch (e) {
    geworfen = (e as Error).message;
  }
  const gehaltenNachWurf = h.gehalten;
  h.loslassen('zeiger');
  ok(
    geworfen === 'Talkback-Fehler' && gehaltenNachWurf && release === 1 && !h.gehalten,
    'Halten: onPress wirft → gehalten bleibt true, Fehler weitergeworfen, loslassen ruft onRelease einmal',
  );
}

{
  let release = 0;
  const h = erzeugeHalten({
    onPress: () => undefined,
    onRelease: () => {
      release++;
      throw new Error('Release-Fehler');
    },
  });
  h.druecken('taste');
  let geworfen = false;
  try {
    h.loslassen('taste');
  } catch {
    geworfen = true;
  }
  let zweiterWurf = false;
  try {
    h.abbrechen();
  } catch {
    zweiterWurf = true;
  }
  ok(
    geworfen && !zweiterWurf && release === 1 && !h.gehalten,
    'Halten: onRelease wirft → trotzdem losgelassen, kein zweites onRelease',
  );
}

{
  const h = erzeugeHalten({});
  h.druecken('zeiger');
  ok(!h.gehalten, 'Halten: ohne onPress und onRelease hält nichts');
  let release = 0;
  const nurRelease = erzeugeHalten({
    onRelease: () => {
      release++;
    },
  });
  nurRelease.druecken('zeiger');
  nurRelease.abbrechen();
  ok(release === 1, 'Halten: nur onRelease gesetzt → Druck zählt, onRelease kommt');
}

{
  const alt = mitZaehler();
  const neu = mitZaehler();
  const h = erzeugeHalten(alt.rueckrufe);
  h.druecken('zeiger');
  h.aktualisiere(neu.rueckrufe);
  h.loslassen('zeiger');
  ok(
    alt.z.press === 1 && alt.z.release === 0 && neu.z.release === 1,
    'Halten: aktualisiere – onRelease der neuesten Rückrufe wird gerufen',
  );
}

// Kreuzprodukt: jede Folge aus {druecken zeiger/taste, loslassen zeiger/taste, abbrechen} bis Länge 4 (780 Folgen).
{
  type Schritt = 'dz' | 'dt' | 'lz' | 'lt' | 'ab';
  const SCHRITTE: readonly Schritt[] = ['dz', 'dt', 'lz', 'lt', 'ab'];
  const QUELLE: Record<'z' | 't', HaltenQuelle> = { z: 'zeiger', t: 'taste' };
  const folgen: Schritt[][] = [];
  const baue = (praefix: Schritt[]): void => {
    if (praefix.length > 0) folgen.push(praefix);
    if (praefix.length === 4) return;
    for (const s of SCHRITTE) baue([...praefix, s]);
  };
  baue([]);

  const fehler: string[] = [];
  for (const folge of folgen) {
    const { z, rueckrufe } = mitZaehler();
    const h = erzeugeHalten(rueckrufe);
    let gehaltenVon: HaltenQuelle | null = null; // Erwartung: wer den laufenden Druck begonnen hat
    for (const schritt of folge) {
      const vorher = { ...z };
      const quelle = QUELLE[schritt[1] as 'z' | 't'];
      let erwartetPress = vorher.press;
      let erwartetRelease = vorher.release;
      if (schritt[0] === 'd') {
        h.druecken(quelle);
        if (gehaltenVon === null) {
          erwartetPress++;
          gehaltenVon = quelle;
        }
      } else if (schritt[0] === 'l') {
        h.loslassen(quelle);
        if (gehaltenVon === quelle) {
          erwartetRelease++;
          gehaltenVon = null;
        }
      } else {
        h.abbrechen();
        if (gehaltenVon !== null) {
          erwartetRelease++;
          gehaltenVon = null;
        }
      }
      const offen = z.press - z.release;
      if (
        z.press !== erwartetPress ||
        z.release !== erwartetRelease ||
        offen < 0 ||
        offen > 1 ||
        h.gehalten !== (gehaltenVon !== null)
      ) {
        fehler.push(`${folge.join(' ')} (bei ${schritt}: press ${z.press}, release ${z.release}, gehalten ${h.gehalten})`);
        break;
      }
    }
    h.abbrechen();
    if (z.press !== z.release) fehler.push(`${folge.join(' ')} (nach abbrechen: press ${z.press} ≠ release ${z.release})`);
  }
  ok(fehler.length === 0 && folgen.length === 780, `Halten: Kreuzprodukt Quelle × Abfolge (${folgen.length} Folgen bis Länge 4)`);
  for (const zeile of fehler.slice(0, 5)) console.log(`     ${zeile}`);
}

// Befund Fix-Runde 1: Fehlt onRelease im neuesten Satz (Handler weg, weil gesperrt), muss das Release zum schon
// gemeldeten onPress trotzdem genau einmal kommen (der Rückruf vom Zeitpunkt des Drückens).
{
  const { z, rueckrufe } = mitZaehler();
  const h = erzeugeHalten(rueckrufe);
  h.druecken('zeiger');
  h.aktualisiere({});
  h.abbrechen();
  h.abbrechen();
  ok(z.press === 1 && z.release === 1 && !h.gehalten, 'Halten: onRelease fehlt im neuesten Satz → Release des alten Satzes genau einmal');
}

{
  const alt = mitZaehler();
  const neu = mitZaehler();
  const h = erzeugeHalten(alt.rueckrufe);
  h.druecken('taste');
  h.aktualisiere(neu.rueckrufe);
  h.loslassen('taste');
  ok(alt.z.release === 0 && neu.z.release === 1, 'Halten: ist onRelease im neuesten Satz gesetzt, gewinnt der neueste');
}

// ── UX Welle 2b, Task 2: Loslassen bei Fensterverlust ──

/** Attrappe eines Ziels: merkt sich die Hörer je Ereignis; senden() ruft sie auf. */
function attrappe(sichtbarkeit?: string): FensterZiel & { hoerer: Map<string, Array<() => void>>; zustand: { v?: string }; senden(t: string): void } {
  const hoerer = new Map<string, Array<() => void>>();
  const zustand = { v: sichtbarkeit };
  return {
    hoerer,
    zustand,
    get visibilityState(): string | undefined {
      return zustand.v;
    },
    addEventListener(t, h) {
      hoerer.set(t, [...(hoerer.get(t) ?? []), h]);
    },
    removeEventListener(t, h) {
      hoerer.set(t, (hoerer.get(t) ?? []).filter((x) => x !== h));
    },
    senden(t) {
      for (const h of [...(hoerer.get(t) ?? [])]) h();
    },
  };
}
const anzahl = (a: { hoerer: Map<string, Array<() => void>> }): number => [...a.hoerer.values()].reduce((n, l) => n + l.length, 0);

{
  const fenster = attrappe();
  const dokument = attrappe('visible');
  const { z, rueckrufe } = mitZaehler();
  const h = erzeugeHalten(rueckrufe);
  const ab = beobachteFensterVerlust(fenster, dokument, h);
  fenster.senden('blur');
  dokument.senden('visibilitychange');
  ok(z.release === 0, 'X Halten Fensterverlust: ohne Halten ruft weder blur noch visibilitychange etwas');
  h.druecken('zeiger');
  dokument.senden('visibilitychange');
  ok(z.release === 0 && h.gehalten, 'X Halten Fensterverlust: visibilitychange mit visible bricht nicht ab');
  fenster.senden('blur');
  fenster.senden('blur');
  ok(z.press === 1 && z.release === 1 && !h.gehalten, 'X Halten Fensterverlust: blur am Fenster während des Haltens → onRelease genau einmal');
  h.druecken('taste');
  dokument.zustand.v = 'hidden';
  dokument.senden('visibilitychange');
  dokument.senden('visibilitychange');
  ok(z.press === 2 && z.release === 2 && !h.gehalten, 'X Halten Fensterverlust: visibilitychange mit hidden → onRelease genau einmal');
  ok(anzahl(fenster) === 1 && anzahl(dokument) === 1, 'X Halten Fensterverlust: je ein Hörer an Fenster und Dokument');
  ab();
  ok(anzahl(fenster) === 0 && anzahl(dokument) === 0, 'X Halten Fensterverlust: die Abmeldung entfernt beide Hörer');
  h.druecken('zeiger');
  fenster.senden('blur');
  ok(z.release === 2, 'X Halten Fensterverlust: nach der Abmeldung wirkt blur nicht mehr');
}
{
  const m = mitZaehler();
  const h = erzeugeHalten(m.rueckrufe);
  const ab1 = beobachteFensterVerlust(null, null, h);
  h.druecken('zeiger');
  ab1();
  ok(m.z.release === 0 && h.gehalten, 'X Halten Fensterverlust: ohne Ziele geschieht nichts, die Abmeldung ist trotzdem aufrufbar');
  const nurFenster = attrappe();
  const ab2 = beobachteFensterVerlust(nurFenster, null, h);
  nurFenster.senden('blur');
  ab2();
  ok(m.z.release === 1, 'X Halten Fensterverlust: nur Fenster ohne Dokument genügt');
}
// Regression (Bestand erzeugeHalten): nach abbrechen meldet ein späteres pointerup nichts.
{
  const m = mitZaehler();
  const h = erzeugeHalten(m.rueckrufe);
  h.druecken('zeiger');
  h.abbrechen();
  h.loslassen('zeiger');
  ok(m.z.press === 1 && m.z.release === 1, 'X Halten Regression: nach abbrechen meldet ein späteres Loslassen (pointerup) nichts');
}

// Altfehler PL-11 (Vorlauf angehalten in der Pause), PL-16a (Fernbefehl prüft die Nummer) und PL-K1 (Vorlauf eines gelöschten Cues
// abbrechen, Stufe 2): reine Module, ohne Store.
import { gleich, ok } from '@jm/ui/testhilfe';
import { pruefeFernNummer } from '@/lib/fernbefehl';
import { PLAYER_TEXTE } from '@/lib/oberflaeche';
import * as vorlaufModul from '@/lib/vorlauf';
import { Vorlaeufe, type Uhr } from '@/lib/vorlauf';

/**
 * Schein-Uhr: fester Zeitwert, Zeitgeber als Liste; `vor(ms)` rückt die Zeit vor und lässt fällige Zeitgeber laufen, `zurueck(ms)`
 * stellt sie zurück (wie eine Systemuhr, die springt), ohne einen Zeitgeber auszulösen. `gesetzt` sind die Fristen aller `setze`.
 */
function scheinUhr(): Uhr & { vor(ms: number): void; zurueck(ms: number): void; offen(): number; gesetzt: number[] } {
  let jetzt = 10_000;
  let zaehler = 0;
  const liste = new Map<number, { an: number; f: () => void }>();
  const gesetzt: number[] = [];
  return {
    gesetzt,
    jetzt: () => jetzt,
    setze(f, ms) {
      const id = ++zaehler;
      gesetzt.push(ms);
      liste.set(id, { an: jetzt + ms, f });
      return id;
    },
    zurueck(ms) {
      jetzt -= ms;
    },
    loesche(t) {
      liste.delete(t as number);
    },
    vor(ms) {
      jetzt += ms;
      for (const [id, z] of [...liste]) {
        if (z.an <= jetzt && liste.has(id)) {
          liste.delete(id);
          z.f();
        }
      }
    },
    offen: () => liste.size,
  };
}

{
  const uhr = scheinUhr();
  const v = new Vorlaeufe(uhr);
  let n = 0;
  v.starte(1000, () => n++);
  uhr.vor(999);
  const vorher = n;
  uhr.vor(1);
  gleich([vorher, n, v.anzahl], [0, 1, 0], 'PL-11 Vorlauf startet nach ms');
}
{
  const uhr = scheinUhr();
  const v = new Vorlaeufe(uhr);
  let n = 0;
  v.starte(1000, () => n++);
  uhr.vor(300);
  v.anhalten();
  uhr.vor(5000);
  const gehalten = n;
  v.fortsetzen();
  uhr.vor(699);
  const bei699 = n;
  uhr.vor(1);
  gleich([gehalten, bei699, n, v.angehalten], [0, 0, 1, false], 'PL-11 anhalten nach 300 von 1000 ms: nichts startet; fortsetzen: startet nach weiteren 700 ms, nicht bei 699');
}
{
  const uhr = scheinUhr();
  const v = new Vorlaeufe(uhr);
  let n = 0;
  v.anhalten();
  v.starte(200, () => n++);
  uhr.vor(1000);
  const gehalten = n;
  const anzahl = v.anzahl;
  v.fortsetzen();
  uhr.vor(199);
  const bei199 = n;
  uhr.vor(1);
  gleich([gehalten, anzahl, bei199, n], [0, 1, 0, 1], 'PL-11 starte im angehaltenen Zustand wartet auf fortsetzen');
}
{
  const uhr = scheinUhr();
  const v = new Vorlaeufe(uhr);
  let n = 0;
  v.starte(100, () => n++);
  v.anhalten();
  v.starte(100, () => n++);
  v.leeren();
  v.fortsetzen();
  uhr.vor(1000);
  gleich([n, v.angehalten, v.anzahl, uhr.offen()], [0, false, 0, 0], 'PL-11 leeren: nichts startet mehr, angehalten false');
}
{
  const uhr = scheinUhr();
  const v = new Vorlaeufe(uhr);
  let n = 0;
  v.starte(1000, () => n++);
  uhr.vor(300);
  v.anhalten();
  uhr.vor(400);
  v.anhalten();
  v.fortsetzen();
  uhr.vor(699);
  const bei699 = n;
  uhr.vor(1);
  gleich([bei699, n], [0, 1], 'PL-11 zweimal anhalten ändert die Restzeit nicht');
}

{
  // Die Uhr steht nicht bei 0, und starte geschieht nach dem Vorrücken: die Restzeit hängt an der Startzeit des Laufs.
  const uhr = scheinUhr();
  const v = new Vorlaeufe(uhr);
  let n = 0;
  uhr.vor(7777);
  v.starte(1000, () => n++);
  uhr.vor(300);
  v.anhalten();
  uhr.vor(9000);
  v.fortsetzen();
  uhr.vor(699);
  const bei699 = n;
  uhr.vor(1);
  gleich([bei699, n], [0, 1], 'PL-11 Restzeit bei Uhr nicht bei 0 und Start nach dem Vorrücken: 300 von 1000 ms, dann 700 ms');
}
{
  // Pause, Weiter, Pause, Weiter: die Restzeiten addieren sich (300 + 200 verbraucht, 500 bleiben).
  const uhr = scheinUhr();
  const v = new Vorlaeufe(uhr);
  let n = 0;
  v.starte(1000, () => n++);
  uhr.vor(300);
  v.anhalten();
  uhr.vor(4000);
  v.fortsetzen();
  uhr.vor(200);
  v.anhalten();
  uhr.vor(4000);
  v.fortsetzen();
  uhr.vor(499);
  const bei499 = n;
  uhr.vor(1);
  gleich([bei499, n], [0, 1], 'PL-11 zweimal Pause und Weiter: Vorlauf startet nach 500 weiteren ms, nicht bei 499');
}
{
  // Fix-Welle K2: Springt die Uhr zwischen Start und Pause zurück, wird die Restzeit nicht größer als die Vorlaufzeit (0 ≤ Rest ≤ ms).
  const uhr = scheinUhr();
  const v = new Vorlaeufe(uhr);
  let n = 0;
  v.starte(1000, () => n++);
  uhr.vor(300);
  uhr.zurueck(5000);
  v.anhalten();
  v.fortsetzen();
  uhr.vor(1000);
  gleich([n, Math.max(...uhr.gesetzt) <= 1000, uhr.gesetzt.every((ms) => ms >= 0)], [1, true, true], 'PL-11 Uhr springt zurück: die Restzeit wird nicht größer als die Vorlaufzeit, der Vorlauf startet spätestens nach ms');
}
{
  // Fix-Welle K2: dasselbe über zwei Pausen; vorwärts gesprungen bleibt die Restzeit bei 0 (startet sofort nach Weiter).
  const uhr = scheinUhr();
  const v = new Vorlaeufe(uhr);
  let n = 0;
  v.starte(1000, () => n++);
  uhr.vor(400);
  v.anhalten();
  v.fortsetzen();
  uhr.zurueck(60_000);
  v.anhalten();
  v.fortsetzen();
  uhr.vor(599);
  const bei599 = n;
  uhr.vor(1);
  const zurueckOk = [bei599, n, uhr.gesetzt.at(-1)];
  // Vorwärts gesprungen (zurueck mit negativem Wert löst keinen Zeitgeber aus): der Rest ist 0, nie negativ; Weiter startet sofort.
  const uhr2 = scheinUhr();
  const v2 = new Vorlaeufe(uhr2);
  let n2 = 0;
  v2.starte(1000, () => n2++);
  uhr2.zurueck(-5000);
  v2.anhalten();
  v2.fortsetzen();
  uhr2.vor(0);
  gleich(
    [zurueckOk, n2, uhr2.gesetzt.at(-1)],
    [[0, 1, 600], 1, 0],
    'PL-11 Uhr springt zurück nach einer Pause: Rest bleibt 600 von 1000 ms (nicht mehr); vorwärts gesprungen ist er 0 und Weiter startet sofort (0 ≤ Rest ≤ ms)',
  );
}
{
  // Fix-Welle K2: Die Standard-Uhr ist performance.now (springt nicht mit der Systemzeit), nicht Date.now.
  const uhr = (vorlaufModul as unknown as { ECHTE_UHR?: Uhr }).ECHTE_UHR;
  const a = uhr?.jetzt();
  const p = performance.now();
  ok(typeof a === 'number' && Math.abs(a - p) < 1000 && Math.abs(a - Date.now()) > 1e9, 'PL-11 Standard-Uhr der Vorläufe ist performance.now() (fest gegen Sprünge der Systemzeit)');
}

// Altfehler PL-K1: Ein Vorlauf merkt den Schlüssel seines Cues; `abbrechen` nimmt genau dessen Vorläufe, laufend oder angehalten.
// Zugriff ohne Wurf, solange es `abbrechen` nicht gibt: der Lauf zeigt dann FAIL statt eines Ladefehlers des Moduls.
const abbrechen = (v: Vorlaeufe, schluessel: number): number | undefined => (v as unknown as { abbrechen?: (s: number) => number }).abbrechen?.(schluessel);
{
  const uhr = scheinUhr();
  const v = new Vorlaeufe(uhr);
  let a = 0;
  let b = 0;
  v.starte(1000, () => a++, 13);
  v.starte(1000, () => b++, 14);
  const weg = abbrechen(v, 13);
  uhr.vor(1000);
  gleich([weg, a, b, v.anzahl], [1, 0, 1, 0], 'PL-K1 abbrechen nimmt nur die Vorläufe dieses Cues: einer abgebrochen, a startet nie, b startet nach 1000 ms, keiner offen');
}
{
  const uhr = scheinUhr();
  const v = new Vorlaeufe(uhr);
  let a = 0;
  v.starte(1000, () => a++, 13);
  v.anhalten();
  const weg = abbrechen(v, 13);
  const angehaltenDanach = v.angehalten;
  v.fortsetzen();
  uhr.vor(1000);
  gleich([weg, angehaltenDanach, a, v.angehalten, v.anzahl], [1, true, 0, false, 0], 'PL-K1 abbrechen im angehaltenen Zustand: der Vorlauf startet auch nach fortsetzen nicht; angehalten bleibt, bis fortsetzen kommt');
}
{
  const uhr = scheinUhr();
  const v = new Vorlaeufe(uhr);
  let a = 0;
  v.starte(1000, () => a++, 13);
  v.starte(500, () => a++, 13);
  const zwei = abbrechen(v, 13);
  const keiner = abbrechen(v, 99);
  uhr.vor(1000);
  gleich([zwei, keiner, a, v.anzahl, uhr.offen()], [2, 0, 0, 0, 0], 'PL-K1 zweimal derselbe Cue: abbrechen(13) nimmt beide Vorläufe samt Zeitgeber, abbrechen(99) keinen');
}
{
  const r = (v: 'CUE' | 'STANDBY', n: number, a: number) => pruefeFernNummer(v, n, a);
  gleich(
    [r('CUE', 0, 5), r('CUE', 6, 5), r('CUE', -1, 5), r('CUE', 1, 5), r('CUE', 5, 5)],
    [
      { ok: false, hinweis: 'Companion „CUE 0“ abgelehnt: Die Show hat 5 Cues.', log: 'Fernbefehl abgelehnt: CUE 0 (Show hat 5 Cues)' },
      { ok: false, hinweis: 'Companion „CUE 6“ abgelehnt: Die Show hat 5 Cues.', log: 'Fernbefehl abgelehnt: CUE 6 (Show hat 5 Cues)' },
      { ok: false, hinweis: 'Companion „CUE -1“ abgelehnt: Die Show hat 5 Cues.', log: 'Fernbefehl abgelehnt: CUE -1 (Show hat 5 Cues)' },
      { ok: true },
      { ok: true },
    ],
    'PL-16a 5 Cues: 0, 6 und -1 abgelehnt, 1 und 5 gültig',
  );
  const eins = r('CUE', 2, 1);
  const keine = r('CUE', 1, 0);
  ok(
    !eins.ok && !keine.ok && eins.hinweis === 'Companion „CUE 2“ abgelehnt: Die Show hat 1 Cue.' && keine.hinweis === 'Companion „CUE 1“ abgelehnt: Die Show hat keine Cues.' && keine.log === 'Fernbefehl abgelehnt: CUE 1 (Show hat 0 Cues)',
    'PL-16a Einzahl „1 Cue“ und „keine Cues“',
  );
  const sb = r('STANDBY', 9, 4);
  ok(!sb.ok && sb.hinweis === 'Companion „STANDBY 9“ abgelehnt: Die Show hat 4 Cues.' && sb.log === 'Fernbefehl abgelehnt: STANDBY 9 (Show hat 4 Cues)', 'PL-16a STANDBY im Hinweis und in der Log-Zeile');
}

ok(
  PLAYER_TEXTE.fernbefehlAbgelehnt('CUE', 7, 5) === 'Companion „CUE 7“ abgelehnt: Die Show hat 5 Cues.' &&
    PLAYER_TEXTE.fernbefehlAbgelehnt('STANDBY', 2, 1) === 'Companion „STANDBY 2“ abgelehnt: Die Show hat 1 Cue.' &&
    PLAYER_TEXTE.fernbefehlAbgelehnt('CUE', 1, 0) === 'Companion „CUE 1“ abgelehnt: Die Show hat keine Cues.',
  'PL-16a der Ablehnungstext steht in PLAYER_TEXTE (Einzahl, keine Cues)',
);

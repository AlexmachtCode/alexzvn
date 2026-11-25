// Altfehler PL-11 (Vorlauf angehalten in der Pause) und PL-16a (Fernbefehl prüft die Nummer): reine Module, ohne Store.
import { gleich, ok } from '@jm/ui/testhilfe';
import { pruefeFernNummer } from '@/lib/fernbefehl';
import { Vorlaeufe, type Uhr } from '@/lib/vorlauf';

/** Schein-Uhr: fester Zeitwert, Zeitgeber als Liste; `vor(ms)` rückt die Zeit vor und lässt fällige Zeitgeber laufen. */
function scheinUhr(): Uhr & { vor(ms: number): void; offen(): number } {
  let jetzt = 0;
  let zaehler = 0;
  const liste = new Map<number, { an: number; f: () => void }>();
  return {
    jetzt: () => jetzt,
    setze(f, ms) {
      const id = ++zaehler;
      liste.set(id, { an: jetzt + ms, f });
      return id;
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

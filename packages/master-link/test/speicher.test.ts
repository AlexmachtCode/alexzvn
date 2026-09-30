import { generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { abschnitt, gleich, pruefe, tempOrdner, warte } from './helfer';
import { erzeugeTestZertifikat } from './zertifikate';
import {
  DateiVerbund, leseMitBak, loescheMitBak, pruefeIdentitaet, pruefeVerbund, schreibeMitBak, SpeicherVerbund,
  type VerbundEintrag,
} from '../src/speicher';

const eintrag = (rechnerId: string, dieserRechner = false): VerbundEintrag => ({
  rechnerId, name: rechnerId, schluessel: 'P', gekoppeltAm: 1, zuletztGesehen: null, letzteAdresse: null, dieserRechner,
});

export async function laufe(): Promise<void> {
  const z = erzeugeTestZertifikat();
  const id = { masterId: 'm-1', name: 'Regie-PC', zertifikat: z.cert, schluessel: z.key };

  abschnitt('Speicher: Prüfen');
  gleich(pruefeIdentitaet(id), id, 'gültige Identität');
  gleich(pruefeIdentitaet({ ...id, zertifikat: 'kein PEM' }), null, 'unlesbares Zertifikat → null');
  // GEMESSEN (Spec 7.2): sonst blieb der Master in „lausch-fehler“ (alle 10 s neu, .bak nie versucht) oder zeigte
  // „läuft“, obwohl jeder Handshake scheiterte (Ed25519-Schlüssel zum RSA-Zertifikat).
  const abgelehnt = (raw: unknown): boolean => pruefeIdentitaet(raw) === null;
  const ed25519Pem = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  gleich([
    abgelehnt({ ...id, schluessel: 'kein PEM' }),
    abgelehnt({ ...id, schluessel: erzeugeTestZertifikat().key }),
    abgelehnt({ ...id, schluessel: ed25519Pem }),
    abgelehnt({ ...id, zertifikat: `${z.cert}-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n` }),
  ], [true, true, true, true], 'Schlüssel unlesbar, fremd, Ed25519 zum RSA-Zertifikat; kaputter 2. Zertifikatsblock → null');
  gleich(pruefeVerbund({ version: 1, rechner: [eintrag('a')] }), { version: 1, rechner: [eintrag('a')] }, 'gültiger Verbund');
  gleich(pruefeVerbund({ version: 1, rechner: [{ rechnerId: 'a' }] }), null, 'kaputter Eintrag → ganzer Verbund null');

  abschnitt('Speicher: .bak (Spec 7.3)');
  const o = tempOrdner();
  const pfad = join(o, 'verbund.json');
  gleich(leseMitBak(pfad, pruefeVerbund), { art: 'fehlt' }, 'nichts da → fehlt');
  schreibeMitBak(pfad, JSON.stringify({ version: 1, rechner: [eintrag('a')] }), pruefeVerbund);
  pruefe(!existsSync(`${pfad}.bak`), 'erste Schreibung ohne .bak');
  schreibeMitBak(pfad, JSON.stringify({ version: 1, rechner: [eintrag('a'), eintrag('b')] }), pruefeVerbund);
  gleich(JSON.parse(readFileSync(`${pfad}.bak`, 'utf8')).rechner.length, 1, '.bak hält die vorige gültige Fassung');
  writeFileSync(pfad, '\u0000\u0000\u0000');
  const r = leseMitBak(pfad, pruefeVerbund);
  pruefe(r.art === 'ok' && r.ausBak && r.wert.rechner.length === 1, 'Hauptdatei genullt (Stromausfall) → aus .bak');
  writeFileSync(`${pfad}.bak`, 'Müll');
  gleich(leseMitBak(pfad, pruefeVerbund), { art: 'beschaedigt' }, 'beides kaputt → beschädigt (NIE „leer“)');
  loescheMitBak(pfad);
  gleich(leseMitBak(pfad, pruefeVerbund), { art: 'fehlt' }, 'loescheMitBak entfernt beide');

  abschnitt('Speicher: Verbund im Speicher');
  const v = new SpeicherVerbund([eintrag('selbst', true), eintrag('a')]);
  v.setze({ ...eintrag('a'), name: 'neu' });
  gleich(v.liste().map((e) => e.name), ['selbst', 'neu'], 'setze ersetzt gleiche rechnerId (genau ein Eintrag)');
  v.entferne('selbst');
  gleich(v.liste().length, 2, '„dieser Rechner“ ist nicht entfernbar');
  v.setzeDiesenRechner(eintrag('selbst-neu', true));
  gleich(v.liste().filter((e) => e.dieserRechner).map((e) => e.rechnerId), ['selbst-neu'], 'setzeDiesenRechner ersetzt den eigenen Eintrag');
  v.gesehen('a', 5000, '10.0.0.9', false);
  gleich([v.finde('a')?.zuletztGesehen, v.finde('a')?.letzteAdresse], [5000, '10.0.0.9'], 'gesehen merkt Zeit und Adresse');
  v.entferneFremde();
  gleich(v.liste().map((e) => e.rechnerId), ['selbst-neu'], 'entferneFremde lässt nur „dieser Rechner“');

  abschnitt('Speicher: Datei-Verbund');
  const o2 = tempOrdner();
  const p2 = join(o2, 'verbund.json');
  const dv = new DateiVerbund(p2, { version: 1, rechner: [] }, { schreibIntervallMs: 200 });
  dv.setze(eintrag('a'));
  gleich(JSON.parse(readFileSync(p2, 'utf8')).rechner.length, 1, 'setze schreibt sofort');
  const vorher = statSync(p2).mtimeMs;
  dv.gesehen('a', 1, null, false);
  dv.gesehen('a', 2, null, false);
  await warte(30);
  pruefe(statSync(p2).mtimeMs === vorher || JSON.parse(readFileSync(p2, 'utf8')).rechner[0].zuletztGesehen !== 2,
    'gesehen innerhalb des Intervalls schreibt nicht sofort');
  await warte(250);
  gleich(JSON.parse(readFileSync(p2, 'utf8')).rechner[0].zuletztGesehen, 2, 'nach dem Intervall nachgeschrieben');
  dv.gesehen('a', 3, null, true);
  gleich(JSON.parse(readFileSync(p2, 'utf8')).rechner[0].zuletztGesehen, 3, 'sofort = true (Trennen) schreibt sofort');
  dv.gesehen('a', 4, null, false);
  dv.schliesse();
  gleich(JSON.parse(readFileSync(p2, 'utf8')).rechner[0].zuletztGesehen, 4, 'schliesse holt offene Schreibung nach');
}

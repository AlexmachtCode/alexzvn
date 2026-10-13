// Show-Daten im Verbund (Teil 2b, Spec 13.1–13.3): Inhalt von abo, stand und aenderung prüfen und kodieren.
import { abschnitt, gleich, pruefe } from './helfer';
import { dekodiere } from '../src/rahmen';
import {
  antwortFassung, kodiereAbo, kodiereStand, pruefeAbo, pruefeStand, SHOW_FASSUNG, zeilenBytes, type StandInhalt,
} from '../src/show-daten';

export async function laufe(): Promise<void> {
  abschnitt('Show-Daten: pruefeAbo (Teil 2b, Spec 13.2)');
  gleich(SHOW_FASSUNG, 1, 'Show-Daten: Fassung 1');
  gleich(pruefeAbo({ t: 'abo', art: 'show', fassung: 1 }), { ok: true, wert: { art: 'show', fassung: 1 } },
    'pruefeAbo: Fassung 1 → gültig, der Wert trägt nur art und fassung');
  gleich(pruefeAbo({ t: 'abo', art: 'show', fassung: 2 }), { ok: true, wert: { art: 'show', fassung: 2 } },
    'pruefeAbo: Fassung 2 (ein künftiges Tool) → gültig');
  const ungueltigeAbos: Array<[string, unknown, string]> = [
    ['art fehlt', { t: 'abo', fassung: 1 }, 'art'],
    ["art 'Show'", { t: 'abo', art: 'Show', fassung: 1 }, 'art'],
    ['fassung 0', { t: 'abo', art: 'show', fassung: 0 }, 'fassung'],
    ['fassung 1.5', { t: 'abo', art: 'show', fassung: 1.5 }, 'fassung'],
    ["fassung '1'", { t: 'abo', art: 'show', fassung: '1' }, 'fassung'],
    ['fassung fehlt', { t: 'abo', art: 'show' }, 'fassung'],
    ['kein Objekt', 'abo', 'art'],
    ['null', null, 'art'],
  ];
  for (const [was, o, grund] of ungueltigeAbos) gleich(pruefeAbo(o), { ok: false, grund }, `pruefeAbo: ${was} → ungültig (${grund})`);

  abschnitt('Show-Daten: pruefeStand, jede Regel der Tabelle 13.2');
  const basis = {
    t: 'stand', art: 'show', fassung: 1, epoche: '3f2a9c1e-0b7d-4c55-9e21-7a1d2b3c4d5e', folge: 0,
    schluessel: '0123456789abcdef', show: { schemaVersion: 1, name: 'COP31', tools: [] }, mitDokument: ['jm-rundown'],
  };
  const mit = (teil: Record<string, unknown>, ohne?: string): Record<string, unknown> => {
    const o: Record<string, unknown> = { ...basis, ...teil };
    if (ohne) delete o[ohne];
    return o;
  };
  const gilt = (o: unknown, was: string): void => pruefe(pruefeStand(o).ok, `pruefeStand: ${was} → gültig`);
  const giltNicht = (o: unknown, grund: string, was: string): void =>
    gleich(pruefeStand(o), { ok: false, grund }, `pruefeStand: ${was} → ungültig (${grund})`);

  gleich(pruefeStand(basis), {
    ok: true,
    wert: { art: 'show', fassung: 1, epoche: basis.epoche, folge: 0, schluessel: basis.schluessel, show: basis.show, mitDokument: ['jm-rundown'] },
  }, 'pruefeStand: vollständiger Stand → gültig, der Wert ohne t');
  gilt(mit({ t: 'aenderung', folge: 7 }), 'aenderung mit denselben Feldern');
  gilt(mit({ fassung: 2 }), 'fassung 2');
  gilt(mit({ epoche: 'a'.repeat(64) }), 'epoche mit 64 Zeichen');
  gilt(mit({ epoche: 'Abc-09' }), 'epoche aus Buchstaben, Ziffern und -');
  gilt(mit({ folge: Number.MAX_SAFE_INTEGER }), 'folge MAX_SAFE_INTEGER');
  gilt(mit({ schluessel: null, show: null, grund: 'keine-show' }), 'schluessel null ohne Show');
  for (const g of ['keine-show', 'zu-gross', 'nicht-lesbar']) gilt(mit({ show: null, grund: g }), `show null mit grund ${g}`);
  gilt(mit({ mitDokument: Array.from({ length: 64 }, (_, i) => `jm-tool-${i}`) }), 'mitDokument mit 64 Einträgen');
  gilt(mit({ mitDokument: ['a'.repeat(64)] }), 'mitDokument-Eintrag mit 64 Zeichen');
  const ohneListe = pruefeStand(mit({}, 'mitDokument'));
  gleich(ohneListe.ok ? ohneListe.wert.mitDokument : null, [], 'pruefeStand: mitDokument fehlt → []');
  const ungueltigeStaende: Array<[string, Record<string, unknown>, string]> = [
    ["art 'Show'", mit({ art: 'Show' }), 'art'],
    ['fassung 0', mit({ fassung: 0 }), 'fassung'],
    ['fassung 1.5', mit({ fassung: 1.5 }), 'fassung'],
    ['epoche mit 65 Zeichen', mit({ epoche: 'a'.repeat(65) }), 'epoche'],
    ['epoche leer', mit({ epoche: '' }), 'epoche'],
    ['epoche mit Leerzeichen', mit({ epoche: 'a b' }), 'epoche'],
    ['epoche mit Umlaut', mit({ epoche: 'ä' }), 'epoche'],
    ['epoche fehlt', mit({}, 'epoche'), 'epoche'],
    ['folge -1', mit({ folge: -1 }), 'folge'],
    ['folge 1.5', mit({ folge: 1.5 }), 'folge'],
    ['folge MAX_SAFE_INTEGER + 1', mit({ folge: Number.MAX_SAFE_INTEGER + 1 }), 'folge'],
    ["folge 'x'", mit({ folge: 'x' }), 'folge'],
    ['schluessel mit Großbuchstaben', mit({ schluessel: '0123456789ABCDEF' }), 'schluessel'],
    ['schluessel mit 15 Zeichen', mit({ schluessel: '0123456789abcde' }), 'schluessel'],
    ['schluessel mit 17 Zeichen', mit({ schluessel: '0123456789abcdef0' }), 'schluessel'],
    ['schluessel fehlt', mit({}, 'schluessel'), 'schluessel'],
    ['show als Array', mit({ show: [] }), 'show'],
    ['show als Text', mit({ show: 'COP31' }), 'show'],
    ['show fehlt', mit({}, 'show'), 'show'],
    ['grund neben einem Show-Objekt', mit({ grund: 'zu-gross' }), 'grund'],
    ['show null ohne grund', mit({ show: null }), 'grund'],
    ['unbekannter grund', mit({ show: null, grund: 'weg' }), 'grund'],
    ['mitDokument mit 65 Einträgen', mit({ mitDokument: Array.from({ length: 65 }, (_, i) => `jm-tool-${i}`) }), 'mitDokument'],
    ["mitDokument mit 'A'", mit({ mitDokument: ['A'] }), 'mitDokument'],
    ['mitDokument-Eintrag mit 65 Zeichen', mit({ mitDokument: ['a'.repeat(65)] }), 'mitDokument'],
    ['mitDokument-Eintrag leer', mit({ mitDokument: [''] }), 'mitDokument'],
    ['mitDokument als Text', mit({ mitDokument: 'jm-rundown' }), 'mitDokument'],
  ];
  for (const [was, o, grund] of ungueltigeStaende) giltNicht(o, grund, was);
  giltNicht([basis], 'art', 'Array statt Objekt');

  abschnitt('Show-Daten: kodieren (Teil 2b, Spec 13.1)');
  gleich(kodiereAbo(), '{"t":"abo","art":"show","fassung":1}\n', 'kodiereAbo: Fassung 1, genau eine Zeile');
  const stand: StandInhalt = {
    art: 'show', fassung: 1, epoche: 'e-1', folge: 3, schluessel: '0123456789abcdef',
    show: { name: 'Zeile\nmit Umbruch und Bär' }, mitDokument: [],
  };
  for (const t of ['stand', 'aenderung'] as const) {
    const zeile = kodiereStand(t, stand);
    pruefe(zeile.indexOf('\n') === zeile.length - 1, `kodiereStand(${t}): genau eine Zeile mit \\n (auch mit Umbruch im Show-Namen)`);
    const d = dekodiere(zeile.slice(0, -1));
    pruefe(d.art === 'nachricht' && d.n.t === t, `kodiereStand(${t}) → dekodiere → Nachricht ${t}`);
    gleich(d.art === 'nachricht' ? pruefeStand(d.n) : null, { ok: true, wert: stand }, `kodiereStand(${t}) → dekodiere → pruefeStand ok, Inhalt gleich`);
  }
  const ohneShow: StandInhalt = { art: 'show', fassung: 1, epoche: 'e-1', folge: 4, schluessel: null, show: null, grund: 'keine-show', mitDokument: [] };
  gleich(kodiereStand('stand', ohneShow),
    '{"t":"stand","art":"show","fassung":1,"epoche":"e-1","folge":4,"schluessel":null,"show":null,"grund":"keine-show","mitDokument":[]}\n',
    'kodiereStand: feste Feldreihenfolge, grund nur ohne Show');
  gleich(zeilenBytes('ä'), 2, 'zeilenBytes zählt ä als 2 Byte');
  gleich(zeilenBytes(kodiereAbo()), 37, 'zeilenBytes einer Abo-Zeile samt \\n');
  gleich([antwortFassung(5), antwortFassung(1)], [1, 1], 'antwortFassung: höchstens die eigene Fassung (5 → 1, 1 → 1)');
}

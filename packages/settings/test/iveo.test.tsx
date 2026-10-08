// IveoSection (Spec 6.2, 7, Plan E15): verbunden nur gemessen, nie ein Token-Feld.
import { enthaelt, enthaeltNicht, gleich, ok, render } from '@jm/ui/testhilfe';
import { abschnittStatusItem, IVEO_TEXTE, IveoSection, iveoView, type IveoSectionProps, type SectionStatus } from '../src/index';
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';

const s = (state: SectionStatus['state'], text: string): SectionStatus => ({ state, text });
const U = s('off', 'unbekannt');
const NICHT = s('off', 'nicht eingerichtet');
const V = s('ok', 'verbunden');
const VG = s('ok', 'verbunden · Gala 2026');
const ALT_SEIT = s('warn', 'Liste aus früherem Stand (seit 09:05)');
const ALT = s('warn', 'Liste aus früherem Stand');
const FEHLER = s('error', 'Fehler: Testfehler');

// Ortszeit 09:05, damit formatUhrzeitKurz in jeder Zeitzone „09:05“ liefert.
const SEIT = new Date(2026, 9, 8, 9, 5).toISOString();
const STALE = { gueltig: SEIT, kaputt: 'kaputt', fehlt: undefined };

// Tabelle Eingang → status. Zeile = bound|delivery; Spalten = (staleSince, eventName) in der Folge
// (gültig, –), (gültig, gesetzt), (kaputt, –), (kaputt, gesetzt), (fehlt, –), (fehlt, gesetzt). error schlägt alles.
const TABELLE: Record<string, SectionStatus[]> = {
  'false|undefined': [NICHT, NICHT, NICHT, NICHT, NICHT, NICHT],
  'false|ok': [NICHT, NICHT, NICHT, NICHT, NICHT, NICHT],
  'false|veraltet': [NICHT, NICHT, NICHT, NICHT, NICHT, NICHT],
  'true|undefined': [U, U, U, U, U, U],
  'true|ok': [V, VG, V, VG, V, VG],
  'true|veraltet': [ALT_SEIT, ALT_SEIT, ALT, ALT, ALT, ALT],
};
const STALE_SPALTE = { gueltig: 0, kaputt: 2, fehlt: 4 };

const basis: IveoSectionProps = { id: 'iveo', bound: true };

{
  const faelle = kreuz({
    bound: [false, true],
    delivery: [undefined, 'ok', 'veraltet'],
    stale: ['gueltig', 'kaputt', 'fehlt'],
    eventName: [undefined, 'Gala 2026'],
    error: [undefined, 'Testfehler'],
  } as const);
  const props = (f: (typeof faelle)[number]): IveoSectionProps => ({
    ...basis,
    bound: f.bound,
    delivery: f.delivery,
    staleSince: STALE[f.stale],
    eventName: f.eventName,
    error: f.error,
  });
  pruefeFaelle('iveo Kreuzprodukt: Eingang → status aus der Tabelle', faelle, (f) => {
    const soll = f.error ? FEHLER : TABELLE[`${f.bound}|${f.delivery}`][STALE_SPALTE[f.stale] + (f.eventName ? 1 : 0)];
    return vergleiche(statusText(iveoView(props(f)).status), statusText(soll));
  });
  pruefeFaelle('iveo Kreuzprodukt: ok nur mit gemessener Lieferung', faelle, (f) =>
    iveoView(props(f)).status.state === 'ok' && f.delivery !== 'ok' ? 'ok ohne delivery ok' : null,
  );
}

{
  gleich(
    [IVEO_TEXTE.titel, IVEO_TEXTE.event, IVEO_TEXTE.buehne, IVEO_TEXTE.speaker, IVEO_TEXTE.tokenImLauncher],
    ['iveo', 'Event', 'Bühne', 'Speaker', 'Das Zugriffstoken bleibt im Launcher.'],
    'iveo: Titel, Feldnamen und Token-Hinweis wörtlich',
  );
}

// ── Darstellung ──
const alle: IveoSectionProps = {
  ...basis,
  delivery: 'ok',
  eventName: 'Gala 2026',
  stage: 'Saal 1',
  speakerCount: 12,
  onOpenLauncher: () => {},
};
{
  const html = render(<IveoSection {...alle} />);
  for (const t of ['>iveo<', '>Event<', '>Gala 2026<', '>Bühne<', '>Saal 1<', '>Speaker<', '>12<', 'Das Zugriffstoken bleibt im Launcher.', '>Im Launcher einrichten</button>']) {
    enthaelt(html, t, `iveo alle Angaben: ${t}`);
  }
  enthaelt(html, '>verbunden · Gala 2026</span>', 'iveo: Statuspille „verbunden · {Event}“');
  enthaeltNicht(html, '<input', 'iveo: kein Eingabefeld (das Token bleibt im Launcher)');
  enthaeltNicht(html, '>Token<', 'iveo: kein Token-Feld');
  gleich(sperrZaehlung(html), { alle: 1, gesperrt: 0 }, 'iveo: einziges Bedienelement ist der Knopf');
  ok(vor(html, '>Event<', '>Bühne<') && vor(html, '>Bühne<', '>Speaker<'), 'iveo: Felder in fester Reihenfolge');
  gleich(bewegungsVerstoesse(html), [], 'iveo: Übergänge nur motion-safe oder mit motion-reduce:transition-none (G8)');
}
{
  const html = render(<IveoSection {...alle} stage={undefined} speakerCount={undefined} onOpenLauncher={undefined} />);
  enthaeltNicht(html, '>Bühne<', 'iveo ohne Bühne: Feld ausgeblendet (Bühne ist heute nicht belegt)');
  enthaeltNicht(html, '>Speaker<', 'iveo ohne Speakerzahl: Feld ausgeblendet');
  enthaeltNicht(html, 'Im Launcher einrichten', 'iveo ohne Rückruf: kein Knopf (E15)');
}
{
  const html = render(<IveoSection {...alle} bound={false} />);
  enthaelt(html, '>nicht eingerichtet</span>', 'iveo ungebunden: „nicht eingerichtet“');
  enthaeltNicht(html, 'Gala 2026', 'iveo ungebunden: keine Event-Angaben');
  enthaelt(html, 'Im Launcher einrichten', 'iveo ungebunden: Knopf zum Einrichten bleibt');
}
{
  const html = render(<IveoSection {...alle} locked="Vom Master vorgegeben" />);
  gleich(sperrZaehlung(html), { alle: 1, gesperrt: 1 }, 'iveo locked: Knopf disabled');
  ok(vor(html, 'Gesperrt: Vom Master vorgegeben', '>Event<'), 'iveo locked: Grund vor den Feldern');
}
{
  const html = render(<IveoSection {...alle} error="iveo-Antwort unlesbar" />);
  ok(nachLetztem(html, 'data-fehler="true"', 'Im Launcher einrichten'), 'iveo error: Fehlertext nach den Feldern');
}
{
  const p: IveoSectionProps = { ...alle, delivery: 'veraltet', staleSince: SEIT };
  const item = abschnittStatusItem(iveoView(p), { group: 'verbindung', label: 'iveo' });
  const html = render(<IveoSection {...p} />);
  ok(item.state === 'warn' && html.includes(`data-state="${item.state}"`) && html.includes(`>${item.detail}</span>`), 'iveo: abschnittStatusItem = Statuspille (Zustand und Text)');
}

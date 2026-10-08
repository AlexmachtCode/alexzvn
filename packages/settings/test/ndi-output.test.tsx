// NdiOutputSection (Spec 6.2, 7): Ableitung als Kreuzprodukt, Darstellung je capabilities, Sperre, Fehler.
import { enthaelt, enthaeltNicht, gleich, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { abschnittStatusItem, NDI_TEXTE, NdiOutputSection, ndiOutputView, type NdiOutputSectionProps, type SectionStatus } from '../src/index';
import { textSchritt, textZustandAus } from '../src/entwurf';
import { leseText } from '@jm/ui/testhilfe';
import { bewegungsVerstoesse, kreuz, nachLetztem, pruefeFaelle, sperrZaehlung, statusText, vergleiche, vor } from './hilfe';

const s = (state: SectionStatus['state'], text: string): SectionStatus => ({ state, text });
const AUS = s('off', 'aus');
const STARTET = s('warn', 'startet');
const SENDET = s('ok', 'sendet');
const AN_OHNE = s('warn', 'an (ohne Rückmeldung)');
const AN_NICHT = s('error', 'an, sendet aber nicht');
const AUS_NOCH = s('warn', 'aus, sendet aber noch');
const FEHLER = s('error', 'Fehler: Testfehler');

// Tabelle Eingang → status. Zeile = enabled|sending, Spalte = starting undefined | false | true.
// Ein gesetzter error schlägt jede Zeile (FEHLER). sourceName und receivers ändern den Status nie.
const TABELLE: Record<string, [SectionStatus, SectionStatus, SectionStatus]> = {
  'false|undefined': [AUS, AUS, STARTET],
  'false|false': [AUS, AUS, STARTET],
  'false|true': [AUS_NOCH, AUS_NOCH, STARTET],
  'true|undefined': [AN_OHNE, AN_OHNE, STARTET],
  'true|false': [AN_NICHT, AN_NICHT, STARTET],
  'true|true': [SENDET, SENDET, STARTET],
};
const SPALTE = { undefined: 0, false: 1, true: 2 } as const;

const basis: NdiOutputSectionProps = { id: 'ndi', enabled: true, sourceName: 'JM Titler', capabilities: {} };

{
  const faelle = kreuz({
    enabled: [false, true],
    sending: [undefined, false, true],
    starting: [undefined, false, true],
    error: [undefined, 'Testfehler'],
    sourceName: ['', 'JM Titler'],
    receivers: [undefined, 0, 3],
  } as const);
  pruefeFaelle('NDI Kreuzprodukt: Eingang → status aus der Tabelle', faelle, (f) => {
    const soll = f.error ? FEHLER : TABELLE[`${f.enabled}|${f.sending}`][SPALTE[`${f.starting}`]];
    return vergleiche(statusText(ndiOutputView({ ...basis, ...f }).status), statusText(soll));
  });
  pruefeFaelle('NDI Kreuzprodukt: nie live, unbekanntes Senden nie ok', faelle, (f) => {
    const v = ndiOutputView({ ...basis, ...f });
    if (v.status.state === 'live') return 'live';
    return f.sending !== true && v.status.state === 'ok' ? 'ok ohne gemessenes Senden' : null;
  });
  pruefeFaelle('NDI Kreuzprodukt: Empfänger nur, wenn gemessen; „0 Empfänger“ nur bei 0', faelle, (f) =>
    vergleiche(ndiOutputView({ ...basis, ...f }).empfaenger, f.receivers === undefined ? undefined : `${f.receivers} Empfänger`),
  );
  pruefeFaelle('NDI Kreuzprodukt: Hinweis „Kein Quellenname eingetragen.“ genau bei leerem Namen', faelle, (f) =>
    vergleiche(ndiOutputView({ ...basis, ...f }).hinweis, f.sourceName === '' ? 'Kein Quellenname eingetragen.' : undefined),
  );
}

{
  gleich(ndiOutputView({ ...basis, networkName: 'REGIE-PC (JM Titler)' }).hinweis, 'Im Netz: REGIE-PC (JM Titler)', 'NDI: Vorschau „Im Netz: {name}“ nur mit networkName');
  gleich(ndiOutputView({ ...basis, sourceName: '   ', networkName: 'X' }).hinweis, 'Kein Quellenname eingetragen.', 'NDI: Name nur aus Leerzeichen gilt als leer');
  gleich(ndiOutputView({ ...basis, error: '' }).status, AN_OHNE, 'NDI: leerer error zählt nicht als Fehler');
  gleich(
    [NDI_TEXTE.titel, NDI_TEXTE.ausgabe, NDI_TEXTE.quellenname, NDI_TEXTE.aufloesung, NDI_TEXTE.bildrate, NDI_TEXTE.transparenz],
    ['NDI-Ausgabe', 'Ausgabe', 'Quellenname', 'Auflösung', 'Bildrate', 'Transparenz'],
    'NDI: Titel und Feldnamen wörtlich (Spec 6.2)',
  );
}

// ── Darstellung ──
const alle: NdiOutputSectionProps = {
  ...basis,
  sending: true,
  receivers: 2,
  networkName: 'REGIE-PC (JM Titler)',
  resolution: '1920x1080',
  resolutionOptions: [{ value: '1920x1080', label: '1920 × 1080' }],
  fps: '50',
  fpsOptions: [{ value: '50', label: '50' }],
  transparency: true,
  capabilities: { toggle: true, rename: true, resolution: true, fps: true, transparency: true },
};
{
  const html = render(<NdiOutputSection {...alle} />);
  for (const t of ['>NDI-Ausgabe<', '>Ausgabe<', '>Quellenname<', '>Auflösung<', '>Bildrate<', '>Transparenz<']) {
    enthaelt(html, t, `NDI alle capabilities: ${t}`);
  }
  ok((html.match(/role="switch"/g) ?? []).length === 2, 'NDI alle capabilities: zwei Schalter (Ausgabe, Transparenz) mit role="switch"');
  ok((html.match(/<select/g) ?? []).length === 2, 'NDI alle capabilities: zwei Auswahlen (Auflösung, Bildrate)');
  enthaelt(html, 'value="JM Titler"', 'NDI: Quellenname als Eingabe mit dem Wert');
  enthaelt(html, 'Im Netz: REGIE-PC (JM Titler)', 'NDI: Vorschau des Namens im Netz sichtbar');
  enthaelt(html, '2 Empfänger', 'NDI: gemessene Empfänger sichtbar');
  pruefeIdVerweise(html, 'NDI: alle aria-describedby/for-Verweise zeigen auf vorhandene ids');
  ok(vor(html, '>Ausgabe<', '>Quellenname<') && vor(html, '>Quellenname<', '>Auflösung<') && vor(html, '>Auflösung<', '>Bildrate<') && vor(html, '>Bildrate<', '>Transparenz<'), 'NDI: Felder in fester Reihenfolge');
  gleich(sperrZaehlung(html).gesperrt, 0, 'NDI ohne Sperre: kein Bedienelement disabled');
  gleich(bewegungsVerstoesse(html), [], 'NDI: Übergänge nur motion-safe (G8)');
}
// capabilities (Spec 6.1 „ausblenden, nicht ausgrauen“, Spec 11 „sichtbare Felder je capabilities“)
{
  const FELD = { toggle: 'ausgabe', rename: 'umbenennen', resolution: 'aufloesung', fps: 'bildrate', transparency: 'transparenz' } as const;
  const faelle = kreuz({ toggle: [false, true], rename: [false, true], resolution: [false, true], fps: [false, true], transparency: [false, true] } as const);
  pruefeFaelle('NDI capabilities: jedes Feld genau dann sichtbar, wenn seine eigene Capability gesetzt ist', faelle, (c) => {
    const s = ndiOutputView({ ...basis, capabilities: c }).sichtbar;
    const falsch = (Object.keys(FELD) as Array<keyof typeof FELD>).filter((cap) => s[FELD[cap]] !== c[cap]);
    return falsch.length === 0 ? null : `falsch: ${falsch.join(', ')}`;
  });
  const BESCHRIFTUNG = { toggle: '>Ausgabe<', resolution: '>Auflösung<', fps: '>Bildrate<', transparency: '>Transparenz<' } as const;
  const daneben: string[] = [];
  for (const cap of Object.keys(BESCHRIFTUNG) as Array<keyof typeof BESCHRIFTUNG>) {
    const html = render(<NdiOutputSection {...alle} capabilities={{ [cap]: true } as NdiOutputSectionProps['capabilities']} />);
    for (const [andere, t] of Object.entries(BESCHRIFTUNG)) if (html.includes(t) !== (andere === cap)) daneben.push(`${cap}: ${t}`);
  }
  const nurName = render(<NdiOutputSection {...alle} capabilities={{ rename: true }} />);
  if (!nurName.includes('<input') || nurName.includes('role="switch"') || nurName.includes('<select')) daneben.push('rename: nur das Eingabefeld');
  gleich(daneben, [], 'NDI je Capability allein: genau ihr Feld erscheint, kein anderes');
}
{
  const html = render(<NdiOutputSection {...alle} capabilities={{}} />);
  for (const t of ['>Ausgabe<', '>Auflösung<', '>Bildrate<', '>Transparenz<']) {
    enthaeltNicht(html, t, `NDI ohne capabilities: ${t} ausgeblendet (nicht ausgegraut)`);
  }
  gleich(sperrZaehlung(html), { alle: 0, gesperrt: 0 }, 'NDI ohne capabilities: kein Bedienelement');
  enthaelt(html, '>Quellenname<', 'NDI ohne rename: Quellenname als Anzeige');
  enthaeltNicht(html, '<input', 'NDI ohne rename: kein Eingabefeld');
  enthaelt(html, '>JM Titler</div>', 'NDI ohne rename: Name als Text');
  enthaelt(html, '2 Empfänger', 'NDI ohne toggle: Empfänger trotzdem sichtbar');
}
{
  const html = render(<NdiOutputSection {...alle} receivers={undefined} />);
  enthaeltNicht(html, 'Empfänger', 'NDI receivers undefined: keine Empfängerzahl, auch nicht 0');
  enthaelt(render(<NdiOutputSection {...alle} receivers={0} />), '0 Empfänger', 'NDI receivers 0: „0 Empfänger“');
}
{
  // G6/Spec 7.2: Capability gesetzt, Wert nicht gemeldet – kein Schalter, der „aus“ behauptet (wie der Steuerserver, Task 19).
  const html = render(<NdiOutputSection {...alle} transparency={undefined} />);
  ok((html.match(/role="switch"/g) ?? []).length === 1, 'NDI transparency unbekannt: nur der Schalter Ausgabe, keiner, der „aus“ behauptet');
  ok(vor(html, '>Transparenz<', '>unbekannt</div>'), 'NDI transparency unbekannt: Transparenz als „unbekannt“');
}
{
  const html = render(<NdiOutputSection {...alle} locked="Vom Master vorgegeben" />);
  const z = sperrZaehlung(html);
  ok(z.alle === 5 && z.gesperrt === 5, `NDI locked: alle Bedienelemente disabled (${z.gesperrt} von ${z.alle})`);
  enthaelt(html, 'Gesperrt: Vom Master vorgegeben', 'NDI locked: Grund sichtbar');
  ok(vor(html, 'data-gesperrt="true"', 'role="switch"'), 'NDI locked: Grund vor den Feldern');
}
{
  const html = render(<NdiOutputSection {...alle} error="NDI-Laufzeit fehlt" />);
  enthaelt(html, 'data-state="error"', 'NDI error: Statuspille error');
  enthaelt(html, 'Fehler: NDI-Laufzeit fehlt', 'NDI error: Statustext „Fehler: {detail}“');
  ok(nachLetztem(html, 'data-fehler="true"', 'role="switch"'), 'NDI error: Fehlertext nach den Feldern');
}
{
  const p: NdiOutputSectionProps = { ...alle, sending: undefined };
  const view = ndiOutputView(p);
  const item = abschnittStatusItem(view, { group: 'ausgabe', label: 'NDI' });
  const html = render(<NdiOutputSection {...p} />);
  ok(
    item.state === view.status.state && html.includes(`data-state="${item.state}"`) && html.includes(`>${item.detail}</span>`),
    'NDI: abschnittStatusItem = Statuspille (Zustand und Text)',
  );
  gleich(item.detail, 'an (ohne Rückmeldung)', 'NDI: Statusleiste zeigt „an (ohne Rückmeldung)“');
}
// Text-Entwurf (E27, dieselben Regeln wie zahlSchritt in Task 7): Wert von außen, einmal melden, Frist, gültig, Escape
{
  const z0 = textZustandAus('JM Titler');
  gleich(
    [
      textSchritt(z0, { art: 'aussen', wert: 'REGIE' }, 'JM Titler').z.text,
      textSchritt({ text: 'JM Tit', geaendert: true }, { art: 'aussen', wert: 'REGIE' }, 'JM Titler').z.text,
      textSchritt({ text: 'REGIE ', geaendert: true }, { art: 'aussen', wert: 'REGIE' }, 'JM Titler').z.text,
    ],
    ['REGIE', 'JM Tit', 'REGIE'],
    'Text-Entwurf: Wert von außen folgt nur ohne angefangenen Entwurf (oder wenn der Entwurf ihm schon entspricht)',
  );
  const gemeldet = textSchritt({ text: 'REGIE', geaendert: true }, { art: 'uebernehmen' }, 'JM Titler');
  const nochmal = textSchritt(gemeldet.z, { art: 'uebernehmen' }, 'JM Titler');
  gleich(
    [gemeldet.neu, gemeldet.z, nochmal.neu],
    ['REGIE', { text: 'REGIE', geaendert: true, gesendet: 'REGIE' }, undefined],
    'Text-Entwurf: Enter oder Verlassen meldet einen geänderten Text genau einmal (kein Neustart je Fokuswechsel)',
  );
  const frist = textSchritt(gemeldet.z, { art: 'frist' }, 'JM Titler');
  gleich(
    [frist.z.fehler, frist.z.text, textSchritt(frist.z, { art: 'aussen', wert: 'REGIE-PC' }, 'REGIE-PC').z, textSchritt(z0, { art: 'frist' }, 'JM Titler').z],
    ['Noch nicht übernommen.', 'REGIE', { text: 'REGIE-PC', geaendert: false }, z0],
    'Text-Entwurf: ohne Antwort nach der Frist „Noch nicht übernommen.“, der Text bleibt; die Antwort des Tools schließt den Entwurf',
  );
  const farbe = (t: string): boolean => /^#[0-9a-fA-F]{6}$/.test(t);
  gleich(
    [
      textSchritt({ text: '#12', geaendert: true }, { art: 'uebernehmen' }, '#000000', farbe).neu,
      textSchritt({ text: 'REG', geaendert: true }, { art: 'verwerfen' }, 'JM Titler'),
      textSchritt(z0, { art: 'verwerfen' }, 'JM Titler').verbraucht,
    ],
    [undefined, { z: { text: 'JM Titler', geaendert: false }, verbraucht: true }, false],
    'Text-Entwurf: ungültiger Text wird nicht gemeldet; Escape verwirft einen geänderten Entwurf und gehört dann dem Feld',
  );
  const entwurf = leseText('src/entwurf.ts');
  const ndi = leseText('src/abschnitte/NdiOutputSection.tsx');
  ok(
    entwurf.split("schrittRef.current({ art: 'aussen', wert });").length === 2 &&
      entwurf.split("starteFrist(() => schrittRef.current({ art: 'frist' }))").length === 2 &&
      ndi.includes('error={name.fehler}') &&
      ndi.includes('<TextInput {...name.feld} disabled={sperre} />'),
    'Text-Entwurf Verdrahtung: Wert von außen und Frist im Effekt, „Noch nicht übernommen.“ als Feldfehler am Quellennamen',
  );
}

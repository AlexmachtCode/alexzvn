// Anmeldung im Launcher, Anzeigen (Plan P24, P25): Kopf „angemeldet als …“, Punkt am Zahnrad, Hinweis im Werkzeugkasten und
// die Zeilen der Dialoge — reine Funktionen, als Kreuzprodukt (G7, G12). Ohne Electron, ohne Fenster:
//   npm run selftest:konto -w @jm/launcher   (tsx; Form „ck“)
import { readFileSync } from 'node:fs';
import type { KontoAnsicht, KontoStand, KontoZustand, Stufe } from '../src/shared/konto';
import { STUFE_TEXT } from '../src/shared/konto';
import {
  datumText, initialen, KOPF_BREIT_AB_PX, KOPF_FARBE_KLASSE, KOPF_TEXTE, kontoKopf, sitzungGueltig,
  TEXT_WERKZEUGKASTEN_OHNE_ANMELDUNG, werkzeugkastenHinweis, zahnradName, zahnradPunkt, type KopfFarbe,
} from '../src/renderer/src/lib/konto-anzeige';

import type { AnmeldeSchritt } from '../src/shared/konto';
import {
  abmeldeFrage, ANMELDE_TEXTE, anmeldeAnzeige, ausgabeZeilen, hinweisZeilen, KONTO_TEXTE, kontoKnoepfe, kontoZeilen, ZOOM_TEXTE, zoomConnectHinweis,
  zoomFehlerText, zoomFormular, zoomHinweis, zoomKnopfSichtbar, zoomStand, zustandsZeile,
} from '../src/renderer/src/lib/konto-dialog';

import type { KontoIveoEvent } from '../src/shared/types';
import { abgleichKnoepfe, editorEventWahl, editorIveoLage, IVEO_TEXTE, ZUGANG_TEXTE, zugangsAbzeichen } from '../src/renderer/src/lib/konto-zugang';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
/** Kreuzprodukt als EINE Testzeile (G12): bei Abweichung die ersten fünf Fälle mit ist/soll. */
function kreuz(name: string, faelle: Array<[string, string, string]>): void {
  const abw = faelle.filter(([, ist, soll]) => ist !== soll);
  ck(`${name} (${faelle.length} Fälle)${abw.length ? ` — ${abw.length} abweichend: ${abw.slice(0, 5).map(([f, ist, soll]) => `${f}: ist ${ist} / soll ${soll}`).join('; ')}` : ''}`,
    abw.length === 0);
}

const JETZT = new Date(2026, 9, 21, 10, 0, 0).getTime();
const TAG = 86_400_000;
function stand(stufe: Stufe, extra: Partial<KontoStand> = {}): KontoStand {
  return {
    kid: 'k1', email: 'maria.schmidt@jakobsmedien.com', name: 'Maria Schmidt', art: 'google', stufe, tools: [], events: [],
    zoom: stufe !== 'externer', zoomBis: null, jm: true, plattform: 'win', gid: 'g1', iat: JETZT - 3_600_000,
    exp: JETZT + 29 * TAG, kontoBis: null, angemeldetSeit: JETZT - TAG, ...extra,
  };
}
function ansicht(zustand: KontoZustand, s: KontoStand | null, extra: Partial<KontoAnsicht> = {}): KontoAnsicht {
  return {
    zustand, stand: s, grund: null, gueltigBis: s?.exp ?? null, rechnerName: 'REGIE-01', plattform: 'win', hinweise: [],
    devVariablen: [], zoomAnfrage: null, adminOffen: 0, ausgaben: [], letztePruefung: null, ...extra,
  };
}
const ZUSTAENDE: KontoZustand[] = ['nicht-angemeldet', 'pruefe', 'angemeldet', 'offline', 'server-nicht-erreichbar', 'abgelaufen',
  'entzogen', 'entzogen-laeuft', 'kein-schluesselspeicher'];
const STUFEN: Array<Stufe | null> = [null, 'admin', 'kollege', 'externer'];
const MIT_SITZUNG: KontoZustand[] = ['pruefe', 'angemeldet', 'offline', 'server-nicht-erreichbar', 'entzogen-laeuft'];
const STUFEN_FARBEN: KopfFarbe[] = ['admin', 'kollege', 'externer'];

// --- P24 4.2, G7: Kopf in jedem Zustand (Zustand × Stufe × breit × offene Anfragen) ----------------------------------
{
  const faelle: Array<[string, string, string]> = [];
  const regeln: Array<[string, string, string]> = [];
  const sollText = (z: KontoZustand, s: KontoStand | null, breit: boolean): string => {
    if (z === 'nicht-angemeldet') return 'Anmelden';
    if (z === 'kein-schluesselspeicher') return 'Anmelden nicht möglich';
    if (z === 'abgelaufen') return 'Anmeldung abgelaufen';
    if (z === 'entzogen') return 'Zugang entzogen';
    if (s === null || !breit) return '';
    if (z === 'angemeldet' || z === 'pruefe') return `Maria S. · ${STUFE_TEXT[s.stufe]}`;
    if (z === 'offline' || z === 'server-nicht-erreichbar') return 'Maria S. · offline';
    return 'Maria S. · Zugang entzogen';
  };
  const sollTitel = (z: KontoZustand, s: KontoStand | null): string => {
    if (z === 'nicht-angemeldet') return 'Anmelden: Installieren, Updates, iveo und Q&A extern gibt es erst nach der Anmeldung.';
    if (z === 'kein-schluesselspeicher') return 'Auf diesem Rechner ist keine Anmeldung möglich (kein Schlüsselspeicher).';
    if (z === 'abgelaufen') return 'Anmeldung abgelaufen. Klicke, um dich neu anzumelden.';
    if (z === 'entzogen') return 'Zugang beim letzten Start entzogen. Klicke für Einzelheiten.';
    if (s === null) return '';
    const datum = datumText(s.exp);
    if (z === 'angemeldet') return `Angemeldet als Maria Schmidt (maria.schmidt@jakobsmedien.com) · ${STUFE_TEXT[s.stufe]}`;
    if (z === 'pruefe') return `Angemeldet als Maria Schmidt · ${STUFE_TEXT[s.stufe]}. Die Anmeldung wird gerade mit dem Server abgeglichen.`;
    if (z === 'offline') return `Offline. Anmeldung gültig bis ${datum}.`;
    if (z === 'server-nicht-erreichbar') return `Server nicht erreichbar. Anmeldung gültig bis ${datum}.`;
    return 'Zugang entzogen. Diese Sitzung läuft bis zum Neustart des Launchers weiter.';
  };
  for (const z of ZUSTAENDE) for (const st of STUFEN) for (const breit of [true, false]) for (const offen of [0, 3]) {
    const s = st === null ? null : stand(st);
    const a = ansicht(z, s, { adminOffen: offen });
    const k = kontoKopf(a, breit);
    const fall = `${z}/${st ?? 'ohne Stand'}/${breit ? 'breit' : 'schmal'}/${offen}`;
    faelle.push([fall, `${k.text}|${k.titel}`, `${sollText(z, s, breit)}|${sollTitel(z, s)}`]);
    // G7: nie „angemeldet“ ohne gültige Sitzung; Stufenfarbe nie ohne das Wort der Stufe; Kreis nur mit Stand und Sitzung.
    const angemeldetGezeigt = k.titel.startsWith('Angemeldet als') || / · (Admin|Kollege|Externer)$/.test(k.text);
    const farbeOhneWort = STUFEN_FARBEN.includes(k.farbe) && !(s !== null && `${k.text} ${k.titel}`.includes(STUFE_TEXT[s.stufe]) && k.stufe === k.farbe);
    const kreisFalsch = (k.initialen !== null) !== (s !== null && MIT_SITZUNG.includes(z));
    const datumFehlt = (z === 'offline' || z === 'server-nicht-erreichbar') && s !== null && !k.titel.includes(datumText(s.exp));
    const ohneAktion = k.aktion === null;
    const sollOhneAktion = s === null && MIT_SITZUNG.includes(z);
    regeln.push([fall,
      `${angemeldetGezeigt && !(sitzungGueltig(a) && (z === 'angemeldet' || z === 'pruefe'))}/${farbeOhneWort}/${kreisFalsch}/${datumFehlt}/${ohneAktion}`,
      `false/false/false/false/${sollOhneAktion}`]);
  }
  for (const breit of [true, false]) {
    const k = kontoKopf(null, breit);
    faelle.push([`vor dem Laden/${breit ? 'breit' : 'schmal'}`, `${k.text}|${k.titel}|${k.aktion}`, '||null']);
  }
  // EP30, EP31 (Nachbesserung Block B): der Server antwortet, die Prüfung scheitert an seiner Einrichtung bzw. an der Uhr —
  // der Titel nennt den Grund (K13a, K13b), der Text bleibt K3.
  for (const [grund, titel] of [['nicht-eingerichtet', 'Anmeldung auf dem Server nicht eingerichtet.'], ['uhr', 'Die Uhr dieses Rechners geht falsch.']] as const) {
    const s = stand('kollege');
    const k = kontoKopf(ansicht('server-nicht-erreichbar', s, { grund }), true);
    faelle.push([`server-nicht-erreichbar/${grund}`, `${k.text}|${k.titel}`, `Maria S. · offline|${titel} Anmeldung gültig bis ${datumText(s.exp)}.`]);
  }
  kreuz('P24 4.2: Kopf je Zustand, Stufe, Breite und offenen Anfragen — Text und Titel (K1–K18) wie die Tabelle', faelle);
  kreuz('P24 4.2, G7: nie „angemeldet“ ohne gültige Sitzung, Stufenfarbe nur mit dem Wort, Kreis nur mit Stand, offline mit Datum, ohne Stand kein Knopf', regeln);
}

// --- P24 9.1: Texte wörtlich, ohne ASCII-Anführungszeichen ------------------------------------------------------------
{
  const T = KOPF_TEXTE;
  const texte: Array<[string, string, string]> = [
    ['K1', T.anmelden, 'Anmelden'],
    ['K2', T.angemeldet('Maria S.', 'Kollege'), 'Maria S. · Kollege'],
    ['K3', T.offline('Maria S.'), 'Maria S. · offline'],
    ['K4', T.entzogenLaeuft('Maria S.'), 'Maria S. · Zugang entzogen'],
    ['K5', `${STUFE_TEXT.admin} / ${STUFE_TEXT.kollege} / ${STUFE_TEXT.externer}`, 'Admin / Kollege / Externer'],
    ['K6', T.abgelaufen, 'Anmeldung abgelaufen'],
    ['K7', T.entzogen, 'Zugang entzogen'],
    ['K8', T.keinSchluesselspeicher, 'Anmelden nicht möglich'],
    ['K10', T.titelAngemeldet('Maria Schmidt', 'm@x.de', 'Admin'), 'Angemeldet als Maria Schmidt (m@x.de) · Admin'],
    ['K11', T.titelPruefe('Maria Schmidt', 'Admin'), 'Angemeldet als Maria Schmidt · Admin. Die Anmeldung wird gerade mit dem Server abgeglichen.'],
    ['K12', T.titelOffline('20.11.2026'), 'Offline. Anmeldung gültig bis 20.11.2026.'],
    ['K13', T.titelServer('20.11.2026'), 'Server nicht erreichbar. Anmeldung gültig bis 20.11.2026.'],
    ['K13a', T.titelNichtEingerichtet('20.11.2026'), 'Anmeldung auf dem Server nicht eingerichtet. Anmeldung gültig bis 20.11.2026.'],
    ['K13b', T.titelUhr('20.11.2026'), 'Die Uhr dieses Rechners geht falsch. Anmeldung gültig bis 20.11.2026.'],
    ['K14', T.titelAbgelaufen, 'Anmeldung abgelaufen. Klicke, um dich neu anzumelden.'],
    ['K15', T.titelEntzogen, 'Zugang beim letzten Start entzogen. Klicke für Einzelheiten.'],
    ['K16', T.titelEntzogenLaeuft, 'Zugang entzogen. Diese Sitzung läuft bis zum Neustart des Launchers weiter.'],
    ['K17', T.titelKeinSchluesselspeicher, 'Auf diesem Rechner ist keine Anmeldung möglich (kein Schlüsselspeicher).'],
    ['K18', T.titelNichtAngemeldet, 'Anmelden: Installieren, Updates, iveo und Q&A extern gibt es erst nach der Anmeldung.'],
    ['M3', zahnradName(2), 'Einstellungen, 2 offene Zoom-Anfragen'],
    ['M3 ohne', zahnradName(0), 'Einstellungen'],
    ['F5', TEXT_WERKZEUGKASTEN_OHNE_ANMELDUNG, 'Nicht angemeldet: Installieren und Updates gehen erst nach der Anmeldung (oben rechts).'],
  ];
  kreuz('P24 9.1: K1–K18, M3, F5 wörtlich', texte);
  ck('P24 G2: keine ASCII-Anführungszeichen in den Texten des Kopfs', texte.every(([, ist]) => !ist.includes('"')));
  ck('P24 OFP5: Text neben dem Kreis erst ab 1180 px Fensterbreite', KOPF_BREIT_AB_PX === 1180);
  ck('P24 G2: Datum TT.MM.JJJJ in Ortszeit, auch an der Jahresgrenze',
    datumText(new Date(2026, 0, 5, 0, 0, 1).getTime()) === '05.01.2026' && datumText(new Date(2026, 11, 31, 23, 59, 59).getTime()) === '31.12.2026');
  ck('P24 4.2: Initialen aus erstem und letztem Wort, sonst E-Mail',
    initialen('Maria Schmidt', 'x@y') === 'MS' && initialen('anna maria berg', 'x@y') === 'AB' && initialen('Ole', 'x@y') === 'O'
    && initialen('  ', 'kim@x.de') === 'K');
}

// --- P24 7: Punkt am Zahnrad und F5 im Werkzeugkasten ------------------------------------------------------------------
{
  const punkt: Array<[string, string, string]> = [];
  const f5: Array<[string, string, string]> = [];
  for (const z of ZUSTAENDE) for (const st of STUFEN) {
    const s = st === null ? null : stand(st);
    for (const offen of [0, 1, 4]) {
      const a = ansicht(z, s, { adminOffen: offen });
      const gueltig = s !== null && MIT_SITZUNG.includes(z);
      punkt.push([`${z}/${st ?? '-'}/${offen}`, String(zahnradPunkt(a)), String(gueltig && st === 'admin' ? offen : 0)]);
    }
    for (const quelle of [null, 'none', 'proxy', 'github'] as const) {
      const a = ansicht(z, s);
      const gueltig = s !== null && MIT_SITZUNG.includes(z);
      const soll = !gueltig && z !== 'pruefe' && quelle === 'none' ? TEXT_WERKZEUGKASTEN_OHNE_ANMELDUNG : 'null';
      f5.push([`${z}/${st ?? '-'}/${quelle}`, String(werkzeugkastenHinweis(a, quelle)), soll]);
    }
  }
  punkt.push(['vor dem Laden', String(zahnradPunkt(null)), '0']);
  f5.push(['vor dem Laden', String(werkzeugkastenHinweis(null, 'none')), 'null']);
  kreuz('P24 7: Punkt am Zahnrad nur für Admins mit gültiger Sitzung und offenen Anfragen (Zustand × Stufe × Anfragen)', punkt);
  kreuz('P24 F5: Hinweis im Werkzeugkasten nur ohne gültige Sitzung und ohne andere Quelle, nie vor dem Laden', f5);
}

// --- P24 4.2: Kontrast der Initialen (Stufenfarben aus den Tokens, gemessen an colors.css) ------------------------------
{
  const css = readFileSync(new URL('../../../packages/ui/src/tokens/colors.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const block = (kopf: RegExp): string => {
    const i = css.search(kopf);
    return i < 0 ? '' : css.slice(i, css.indexOf('\n  }', i));
  };
  const marke = block(/:root \{\n {4}--brand-yellow:/);
  const dunkel = block(/:root,\n {2}\.dark \{/);
  const hell = block(/\.light \{/);
  type Farbe = { rgb: [number, number, number]; alpha: number };
  const lies = (q: string): Map<string, string> => new Map([...q.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const oklchZuSrgb = (L: number, C: number, H: number): [number, number, number] => {
    const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    return lin.map((c) => { const x = Math.min(1, Math.max(0, c)); return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055; }) as [number, number, number];
  };
  const farbe = (name: string, thema: Map<string, string>): Farbe => {
    const marken = lies(marke);
    let wert = thema.get(name) ?? marken.get(name) ?? '';
    for (let i = 0; i < 4 && wert.startsWith('var('); i++) { const n = /var\(--([\w-]+)\)/.exec(wert)?.[1] ?? ''; wert = thema.get(n) ?? marken.get(n) ?? ''; }
    const m = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/.exec(wert);
    if (!m) throw new Error(`Farbe ${name} nicht lesbar: ${wert}`);
    return { rgb: oklchZuSrgb(Number(m[1]), Number(m[2]), Number(m[3])), alpha: m[4] ? Number(m[4]) : 1 };
  };
  // Wie der Browser: Deckkraft im sRGB-Raum über dem Untergrund mischen.
  const ueber = (oben: Farbe, unten: [number, number, number]): [number, number, number] =>
    oben.rgb.map((c, i) => c * oben.alpha + unten[i] * (1 - oben.alpha)) as [number, number, number];
  const leucht = (rgb: [number, number, number]): number => {
    const lin = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const kontrast = (x: [number, number, number], y: [number, number, number]): number => {
    const [h, d] = [leucht(x), leucht(y)].sort((p, q) => q - p);
    return (h + 0.05) / (d + 0.05);
  };
  const werte: string[] = [];
  let ok = true;
  for (const [themaName, thema] of [['dunkel', lies(dunkel)], ['hell', lies(hell)]] as const) {
    // Untergrund des Kopfs: --card zu 60 % über --background (Header.tsx: bg-[var(--card)]/60).
    const kopf = ueber({ ...farbe('card', thema), alpha: 0.6 }, farbe('background', thema).rgb);
    for (const f of ['admin', 'kollege', 'externer', 'gedaempft'] as const) {
      const klasse = KOPF_FARBE_KLASSE[f];
      const bg = /bg-\[var\(--([\w-]+)\)\]/.exec(klasse)?.[1] ?? '';
      const fg = /text-\[var\(--([\w-]+)\)\]/.exec(klasse)?.[1];
      const grund = ueber(farbe(bg, thema), kopf);
      const schrift: [number, number, number] = fg ? ueber(farbe(fg, thema), grund) : klasse.includes('text-black') ? [0, 0, 0] : [1, 1, 1];
      const k = kontrast(grund, schrift);
      werte.push(`${themaName} ${f} ${k.toFixed(2)}`);
      if (!(k >= 4.5)) ok = false;
    }
  }
  ck(`P24 4.2: Kontrast der Initialen in den Stufenfarben und gedämpft ≥ 4,5 : 1, hell und dunkel (${werte.join(', ')})`,
    ok && marke.length > 0 && dunkel.length > 0 && hell.length > 0);
  ck('P24 4.2: Stufenfarben aus den Tokens (--primary Admin, --success Kollege, --accent Externer)',
    KOPF_FARBE_KLASSE.admin.includes('bg-[var(--primary)]') && KOPF_FARBE_KLASSE.kollege.includes('bg-[var(--success)]')
    && KOPF_FARBE_KLASSE.externer.includes('bg-[var(--accent)]'));
}

// --- P24 G9: die Bibliothek lädt aus Aliasen nur Typen, zur Laufzeit nur src/shared/konto.ts ---------------------------
{
  const q = readFileSync(new URL('../src/renderer/src/lib/konto-anzeige.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const importe = q.split('\n').filter((z) => /^import\b/.test(z));
  ck(`P24 G9: lib/konto-anzeige.ts — aus Aliasen nur import type, zur Laufzeit nur ../../../shared/konto (${importe.length} Import-Zeilen)`,
    importe.length === 2 && importe.every((z) => z.startsWith('import type ') || z.endsWith("from '../../../shared/konto';"))
    && !/window\.|localStorage|from 'react'|from 'zustand'/.test(q));
}

// --- P25 4.2: Zeilen des Konto-Dialogs (Zustand × Stufe × JM-Rechner × Plattform × Zoom-Freigabe) -----------------------
{
  const faelle: Array<[string, string, string]> = [];
  for (const z of MIT_SITZUNG) for (const st of ['admin', 'kollege', 'externer'] as const) for (const jm of [true, false])
    for (const pf of ['win', 'mac'] as const) for (const zoomBis of [null, JETZT + 5 * TAG, JETZT - TAG]) {
      const s = stand(st, { jm, plattform: pf, zoomBis, kontoBis: st === 'externer' ? JETZT + 60 * TAG : null, art: st === 'externer' ? 'passwort' : 'google' });
      const zeilen = kontoZeilen(ansicht(z, s, { plattform: pf }), JETZT);
      const wert = (b: string): string => zeilen.find((x) => x.bezeichner === b)?.wert ?? '-';
      const sollZoom = pf === 'mac' ? 'auf dem Mac nicht verfügbar' : st !== 'externer' ? 'auf diesem Rechner erlaubt'
        : zoomBis !== null && zoomBis > JETZT
          ? (jm ? `freigegeben bis ${datumText(zoomBis)}` : `freigegeben bis ${datumText(zoomBis)}, wirkt hier nicht (kein JM-Rechner)`)
          : 'nicht freigegeben';
      const sollBez = `Name,E-Mail,Anmeldeart,Stufe,Angemeldet seit,${st === 'externer' ? 'Zugang bis,' : ''}Dieser Rechner,Zoom`;
      faelle.push([`${z}/${st}/${jm ? 'JM' : 'kein JM'}/${pf}/${zoomBis === null ? 'ohne' : zoomBis > JETZT ? 'künftig' : 'vorbei'}`,
        `${zeilen.map((x) => x.bezeichner).join(',')}|${wert('Anmeldeart')}|${wert('Stufe')}|${wert('Dieser Rechner')}|${wert('Zoom')}`,
        `${sollBez}|${st === 'externer' ? 'E-Mail und Passwort' : 'Google-Firmenkonto'}|${STUFE_TEXT[st]}|REGIE-01 · ${jm ? 'JM-Rechner' : 'kein JM-Rechner'}|${sollZoom}`]);
    }
  for (const z of ['nicht-angemeldet', 'abgelaufen', 'entzogen', 'kein-schluesselspeicher'] as const) {
    faelle.push([`${z}/ohne Stand`, String(kontoZeilen(ansicht(z, null), JETZT).length), '0']);
  }
  kreuz('P25 4.2, EP18: Zeilen des Konto-Dialogs (Zustand × Stufe × JM-Rechner × Plattform × Zoom-Freigabe, K21–K24)', faelle);
}

// --- P25 8: „Zoom anfragen“, Stand der Anfrage, Hinweise Z5–Z7 -----------------------------------------------------------
{
  const knopf: Array<[string, string, string]> = [];
  for (const z of ZUSTAENDE) for (const st of STUFEN) for (const zoomBis of [null, JETZT + TAG, JETZT - TAG])
    for (const anfrage of [null, 'offen', 'abgelehnt'] as const) {
      const s = st === null ? null : stand(st, { zoomBis });
      const a = ansicht(z, s, { zoomAnfrage: anfrage === null ? null : { id: 'z1', zustand: anfrage, zweck: 'Gala', von: JETZT, bis: JETZT + TAG, am: JETZT - TAG } });
      const soll = s !== null && MIT_SITZUNG.includes(z) && st === 'externer' && !(zoomBis !== null && zoomBis > JETZT) && anfrage !== 'offen';
      knopf.push([`${z}/${st ?? '-'}/${zoomBis === null ? 'ohne' : zoomBis > JETZT ? 'künftig' : 'vorbei'}/${anfrage ?? 'keine'}`,
        String(zoomKnopfSichtbar(a, JETZT)), String(soll)]);
    }
  kreuz('P25 8, EP16: „Zoom anfragen“ nur für Externe mit Sitzung, ohne gültige Freigabe und ohne offene Anfrage', knopf);
  const hinweis: Array<[string, string, string]> = [];
  for (const pf of ['win', 'mac'] as const) for (const jm of [true, false]) for (const st of ['admin', 'kollege', 'externer'] as const) {
    hinweis.push([`${pf}/${jm ? 'JM' : 'kein JM'}/${st}`, zoomHinweis(ansicht('angemeldet', stand(st, { jm, plattform: pf }), { plattform: pf })),
      pf === 'mac' ? ZOOM_TEXTE.hinweisMac : jm ? ZOOM_TEXTE.hinweisJm : ZOOM_TEXTE.hinweisKeinJm]);
  }
  kreuz('P25 8, EP18: Hinweis im Zoom-Formular Z5–Z7 (Plattform × JM-Rechner × Stufe)', hinweis);
  // EP34 (Nachbesserung Block D, spec:4): Connect nutzt die Freigabe erst mit Teil 2 — Z11 steht genau dort, wo die Zeile „Zoom“
  // unter Windows steht (mit Stand), nie auf dem Mac (dort sagt K24 „nicht verfügbar“) und nie ohne Stand.
  const connect: Array<[string, string, string]> = [];
  for (const z of ZUSTAENDE) for (const pf of ['win', 'mac'] as const) for (const st of STUFEN) {
    const a = ansicht(z, st === null ? null : stand(st, { plattform: pf }), { plattform: pf });
    connect.push([`${z}/${pf}/${st ?? '-'}`, String(zoomConnectHinweis(a)), st !== null && pf === 'win' ? ZOOM_TEXTE.connect : 'null']);
  }
  connect.push(['vor dem Laden', String(zoomConnectHinweis(null)), 'null']);
  kreuz('P25 8, EP34: Z11 unter der Zeile Zoom — nur mit Stand und nur unter Windows', connect);
  const stand3 = (zustand: 'offen' | 'freigegeben' | 'abgelehnt'): string | null =>
    zoomStand(ansicht('angemeldet', stand('externer'), { zoomAnfrage: { id: 'z1', zustand, zweck: 'Gala', von: JETZT, bis: JETZT + 3 * TAG, am: JETZT - TAG } }));
  kreuz('P25 8: Stand der Zoom-Anfrage Z9a–Z9c mit Datum', [
    ['offen', String(stand3('offen')), `Zoom-Anfrage offen seit ${datumText(JETZT - TAG)}.`],
    ['freigegeben', String(stand3('freigegeben')), `Zoom freigegeben bis ${datumText(JETZT + 3 * TAG)}.`],
    ['abgelehnt', String(stand3('abgelehnt')), `Zoom-Anfrage abgelehnt am ${datumText(JETZT - TAG)}.`],
    ['keine', String(zoomStand(ansicht('angemeldet', stand('externer')))), 'null'],
  ]);
  // Zeitpunkte als Ortszeit „TT.MM.JJJJ HH:MM:SS.mmm“ (die Ausgabe hängt so nicht von der Zeitzone des Rechners ab).
  const zeit = (ms: number): string => {
    const d = new Date(ms);
    const p = (n: number, l = 2): string => String(n).padStart(l, '0');
    return `${datumText(ms)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
  };
  const f = (zweck: string, von: string, bis: string): string => {
    const r = zoomFormular({ zweck, von, bis }, JETZT);
    return r.ok ? `ok|${r.zweck}|${zeit(r.von)}|${zeit(r.bis)}` : `fehler|${r.text}`;
  };
  kreuz('P25 8, EP15: Zoom-Formular — Zweck nötig, „Bis“ nach „Von“, Von ab Tagesbeginn, Bis bis Tagesende der Ortszeit', [
    ['leerer Zweck', f('  ', '2026-11-10', '2026-11-12'), 'fehler|Nenne Zweck oder Event.'],
    ['Bis vor Von', f('Gala', '2026-11-12', '2026-11-10'), 'fehler|„Bis“ muss nach „Von“ liegen.'],
    ['ungültiges Datum', f('Gala', '2026-02-30', '2026-03-01'), 'fehler|„Bis“ muss nach „Von“ liegen.'],
    ['ohne Daten', f('Gala', '', ''), 'fehler|„Bis“ muss nach „Von“ liegen.'],
    ['ein Tag', f('Gala', '2026-11-10', '2026-11-10'), 'ok|Gala|10.11.2026 00:00:00.000|10.11.2026 23:59:59.999'],
    ['drei Tage, Zweck getrimmt', f(' Gala ', '2026-11-10', '2026-11-12'), 'ok|Gala|10.11.2026 00:00:00.000|12.11.2026 23:59:59.999'],
  ]);
  kreuz('P25 8: Fehler der Zoom-Anfrage (Z10c, sonst Texte des Anmelde-Dialogs)', [
    ['konflikt', zoomFehlerText('konflikt'), 'Es gibt schon eine offene Zoom-Anfrage.'],
    ['netz', zoomFehlerText('netz'), ANMELDE_TEXTE.netz],
    ['zu-viele', zoomFehlerText('zu-viele'), ANMELDE_TEXTE.zuViele],
    ['nicht-noetig', zoomFehlerText('nicht-noetig'), ANMELDE_TEXTE.server],
  ]);
}

// --- P25 4.2, 6.1: Zustandszeile, Hinweise, Knöpfe, Rückfrage, Ausgaben --------------------------------------------------
{
  const s = stand('kollege');
  const bis = datumText(s.exp);
  const uhr = (ms: number): string => `${String(new Date(ms).getHours()).padStart(2, '0')}:${String(new Date(ms).getMinutes()).padStart(2, '0')}`;
  kreuz('P25 4.2: Zustandszeile K25a–K25o je Zustand und Grund (ohne Zeile in pruefe, nicht-angemeldet und in angemeldet ohne Grund)', [
    ['offline', String(zustandsZeile(ansicht('offline', s))), KONTO_TEXTE.offline(bis)],
    ['server', String(zustandsZeile(ansicht('server-nicht-erreichbar', s))), KONTO_TEXTE.server(bis)],
    ['server, nicht eingerichtet (EP31)', String(zustandsZeile(ansicht('server-nicht-erreichbar', s, { grund: 'nicht-eingerichtet' }))), KONTO_TEXTE.serverNichtEingerichtet(bis)],
    ['server, Uhr falsch (EP30)', String(zustandsZeile(ansicht('server-nicht-erreichbar', s, { grund: 'uhr' }))), KONTO_TEXTE.serverUhr(bis)],
    ['abgelaufen 30 Tage', String(zustandsZeile(ansicht('abgelaufen', null, { grund: 'dreissig-tage' }))), KONTO_TEXTE.abgelaufenDreissig],
    ['abgelaufen Zugang bis', String(zustandsZeile(ansicht('abgelaufen', null, { grund: 'zugang-bis', gueltigBis: JETZT - TAG }))), KONTO_TEXTE.abgelaufenBis(datumText(JETZT - TAG))],
    ['abgelaufen Zugang bis ohne Datum', String(zustandsZeile(ansicht('abgelaufen', null, { grund: 'zugang-bis', gueltigBis: null }))), 'Anmeldung abgelaufen'],
    ['abgelaufen Google-Anmeldung (OFP8)', String(zustandsZeile(ansicht('abgelaufen', null, { grund: 'google-neu' }))), KONTO_TEXTE.abgelaufenGoogle],
    ['entzogen gesperrt', String(zustandsZeile(ansicht('entzogen', null, { grund: 'gesperrt' }))), 'Dein Zugang wurde beim letzten Start nicht mehr bestätigt: Zugang gesperrt. Frag einen Admin nach einem Zugang.'],
    ['entzogen gelöscht', String(zustandsZeile(ansicht('entzogen', null, { grund: 'geloescht' }))), KONTO_TEXTE.entzogen('Zugang gelöscht')],
    ['entzogen abgelaufen', String(zustandsZeile(ansicht('entzogen', null, { grund: 'zugang-abgelaufen' }))), KONTO_TEXTE.entzogen('Zugang abgelaufen')],
    ['entzogen Gerät', String(zustandsZeile(ansicht('entzogen', null, { grund: 'geraet-unbekannt' }))), KONTO_TEXTE.entzogen('dieser Rechner ist dem Server unbekannt')],
    ['entzogen läuft (ohne Grund: gesperrt)', String(zustandsZeile(ansicht('entzogen-laeuft', s))), KONTO_TEXTE.entzogenLaeuft('Zugang gesperrt')],
    // Nachfix 1 (Nachprüfung 1, Befund 4): „Zugang bis“ erreicht, die Sitzung läuft weiter (spec:1) — der Grund steht in der Zeile.
    ['entzogen läuft, Zugang bis erreicht', String(zustandsZeile(ansicht('entzogen-laeuft', s, { grund: 'zugang-abgelaufen' }))), 'Dein Zugang gilt nicht mehr: Zugang abgelaufen. Was schon läuft, läuft weiter; beim nächsten Start des Launchers bist du abgemeldet.'],
    ['entzogen läuft, Gerät', String(zustandsZeile(ansicht('entzogen-laeuft', s, { grund: 'geraet-unbekannt' }))), KONTO_TEXTE.entzogenLaeuft('dieser Rechner ist dem Server unbekannt')],
    ['kein Schlüsselspeicher', String(zustandsZeile(ansicht('kein-schluesselspeicher', null))), KONTO_TEXTE.keinSchluesselspeicher],
    ['angemeldet', String(zustandsZeile(ansicht('angemeldet', s))), 'null'],
    // Nachfix 1 (Befund 1): der Server verlängert ein Google-Konto im Betrieb nicht mehr (OFP8), die Sitzung gilt bis zu ihrem Ende.
    ['angemeldet, Google 90 Tage (im Betrieb)', String(zustandsZeile(ansicht('angemeldet', s, { grund: 'google-neu' }))), `Kollegen melden sich spätestens alle 90 Tage neu mit Google an. Diese Anmeldung gilt noch bis ${bis} ${uhr(s.exp)}; danach meldest du dich neu an.`],
    ['pruefe', String(zustandsZeile(ansicht('pruefe', s))), 'null'],
    ['nicht angemeldet', String(zustandsZeile(ansicht('nicht-angemeldet', null))), 'null'],
    ['vor dem Laden', String(zustandsZeile(null)), 'null'],
  ]);
  kreuz('P25 G7: jede Diagnose wird angezeigt (K25i, K25j, K32, K31 nur mit Namen)', [
    ['Sitzung unlesbar', hinweisZeilen(ansicht('nicht-angemeldet', null, { hinweise: ['sitzung-unlesbar'] })).join(' | '), KONTO_TEXTE.sitzungUnlesbar],
    ['Gerät neu', hinweisZeilen(ansicht('angemeldet', s, { hinweise: ['geraet-neu'] })).join(' | '), KONTO_TEXTE.geraetNeu],
    ['GitHub gelöscht', hinweisZeilen(ansicht('angemeldet', s, { hinweise: ['github-geloescht'] })).join(' | '), KONTO_TEXTE.githubGeloescht],
    ['Entwicklung', hinweisZeilen(ansicht('angemeldet', s, { devVariablen: ['JMPS_PROXY_KEY', 'JMPS_IVEO_TOKEN'] })).join(' | '), 'Entwicklungsmodus: JMPS_PROXY_KEY, JMPS_IVEO_TOKEN gesetzt.'],
    ['nichts', hinweisZeilen(ansicht('angemeldet', s)).join(' | '), ''],
  ]);
  const knoepfe: Array<[string, string, string]> = ZUSTAENDE.map((z) => {
    const a = ansicht(z, MIT_SITZUNG.includes(z) ? s : null);
    const soll = MIT_SITZUNG.includes(z) ? 'abmelden,schliessen' : z === 'abgelaufen' || z === 'entzogen' ? 'neu-anmelden,schliessen'
      : z === 'nicht-angemeldet' ? 'anmelden,schliessen' : 'schliessen';
    return [z, kontoKnoepfe(a).join(','), soll];
  });
  knoepfe.push(['pruefe ohne Stand', kontoKnoepfe(ansicht('pruefe', null)).join(','), 'schliessen']);
  kreuz('P25 6.1, EP26: Knöpfe des Konto-Dialogs (Abmelden nur mit Sitzung, Anmelden nur ohne)', knoepfe);
  ck('P25 EP26: Rückfrage vor dem Abmelden — mit offener iveo-Show K27b, sonst K27a',
    abmeldeFrage(true) === 'Abmelden? Der iveo-Abgleich der offenen Show stoppt; laufende Tools arbeiten weiter.'
    && abmeldeFrage(false) === 'Abmelden? Laufende Tools arbeiten weiter; neue Freigaben gibt es erst nach einer neuen Anmeldung.');
  const bisAusgabe = new Date(2026, 9, 24, 9, 5).getTime();
  const mitAusgabe = ansicht('angemeldet', s, { ausgaben: [{ appId: 'jm-qa', zweck: 'qa-relay', ziel: 'ev1', bis: bisAusgabe, am: JETZT }] });
  kreuz('P25 EP8: An Tools ausgegeben (K29b mit Tool, Zweck, Datum und Uhrzeit; leer K29c), ohne Token', [
    ['eine', ausgabeZeilen(mitAusgabe, (id) => (id === 'jm-qa' ? 'JM Q&A' : id)).join(' | '), 'JM Q&A · Q&A extern · bis 24.10.2026 09:05'],
    ['keine', ausgabeZeilen(ansicht('angemeldet', s), (id) => id).join(' | '), 'Noch nichts an Tools ausgegeben.'],
  ]);
}

// --- P25 4.1, AA6: Anmelde-Dialog je Schritt -------------------------------------------------------------------------------
{
  const w = (bisAb: number, browserOffen = true): AnmeldeSchritt =>
    ({ art: 'wartet', code: 'K7M-2QX', adresse: 'https://jm.test/konto/anmelden?v=v1', bis: JETZT + bisAb, browserOffen });
  const z = (s: AnmeldeSchritt): string => {
    const x = anmeldeAnzeige(s, JETZT);
    return `${x.text}|${x.code}|${x.frist}|${x.hinweis}|${x.knoepfe.join(',')}`;
  };
  const T = ANMELDE_TEXTE;
  kreuz('P25 4.1, AA6: Anmelde-Dialog je Schritt — Code nur beim Warten, Frist m:ss, Hinweis, Knöpfe', [
    ['ruhe', z({ art: 'ruhe' }), 'null|null|null|null|abbrechen'],
    ['startet', z({ art: 'startet' }), 'null|null|null|null|abbrechen'],
    ['wartet 4:59', z(w(299_500)), `${T.wartet}|K7M-2QX|Gültig noch 4:59|${T.selbstOeffnen}|kopieren,abbrechen`],
    ['wartet 1:01', z(w(61_000)), `${T.wartet}|K7M-2QX|Gültig noch 1:01|${T.selbstOeffnen}|kopieren,abbrechen`],
    ['wartet 0:00', z(w(0)), `${T.wartet}|K7M-2QX|Gültig noch 0:00|${T.selbstOeffnen}|kopieren,abbrechen`],
    ['wartet vorbei', z(w(-5_000)), `${T.wartet}|K7M-2QX|Gültig noch 0:00|${T.selbstOeffnen}|kopieren,abbrechen`],
    ['Browser ging nicht auf', z(w(120_000, false)), `${T.wartet}|K7M-2QX|Gültig noch 2:00|${T.browser}|kopieren,abbrechen`],
    ['abgelaufen', z({ art: 'abgelaufen' }), `${T.abgelaufen}|null|null|null|neu-starten,schliessen`],
    ['abgelehnt', z({ art: 'abgelehnt' }), `${T.abgelehnt}|null|null|null|neu-starten,schliessen`],
    ['fertig', z({ art: 'fertig', kurzName: 'Maria S.', stufe: 'kollege' }), 'null|null|null|null|schliessen'],
    ['abgebrochen', z({ art: 'abgebrochen' }), 'null|null|null|null|schliessen'],
    ['Netz', z({ art: 'fehler', code: 'netz' }), `${T.netz}|null|null|null|erneut,schliessen`],
    ['nicht eingerichtet', z({ art: 'fehler', code: 'nicht-eingerichtet' }), `${T.nichtEingerichtet}|null|null|null|schliessen`],
    ['zu viele', z({ art: 'fehler', code: 'zu-viele' }), `${T.zuViele}|null|null|null|erneut,schliessen`],
    ['Server', z({ art: 'fehler', code: 'server' }), `${T.server}|null|null|null|erneut,schliessen`],
    ['Uhr (EP30)', z({ art: 'fehler', code: 'uhr' }), `${T.uhr}|null|null|null|erneut,schliessen`],
    ['Browser', z({ art: 'fehler', code: 'browser' }), `${T.browser}|null|null|null|schliessen`],
    ['kein Schlüsselspeicher', z({ art: 'fehler', code: 'kein-schluesselspeicher' }), `${KONTO_TEXTE.keinSchluesselspeicher}|null|null|null|schliessen`],
  ]);
}

// --- P25 9.1–9.3: Texte wörtlich, ohne ASCII-Anführungszeichen; Bibliothek ohne Laufzeit-Import aus Aliasen ----------------
{
  const K = KONTO_TEXTE, Z = ZOOM_TEXTE, A = ANMELDE_TEXTE;
  kreuz('P25 9.1–9.3: K20–K29, K31, Z1–Z11, K40–K55 wörtlich', [
    ['K20', K.titel, 'Konto'],
    ['K21', [K.name, K.email, K.anmeldeart, K.stufe, K.seit, K.bis, K.rechner, K.zoom].join(' / '), 'Name / E-Mail / Anmeldeart / Stufe / Angemeldet seit / Zugang bis / Dieser Rechner / Zoom'],
    ['K22', `${K.artGoogle} / ${K.artPasswort}`, 'Google-Firmenkonto / E-Mail und Passwort'],
    ['K23', `${K.rechnerJm('R')} / ${K.rechnerKeinJm('R')}`, 'R · JM-Rechner / R · kein JM-Rechner'],
    ['K24', [K.zoomErlaubt, K.zoomMac, K.zoomBis('D'), K.zoomBisKeinJm('D'), K.zoomNicht].join(' / '),
      'auf diesem Rechner erlaubt / auf dem Mac nicht verfügbar / freigegeben bis D / freigegeben bis D, wirkt hier nicht (kein JM-Rechner) / nicht freigegeben'],
    ['K25a', K.offline('D'), 'Offline. Die Anmeldung gilt auf diesem Rechner bis D. Was den Server braucht (Installieren, Updates, iveo, Q&A extern), geht erst wieder mit Internet.'],
    ['K25b', K.server('D'), 'Der Server ist gerade nicht erreichbar. Die Anmeldung gilt weiter bis D; ich versuche es im Hintergrund erneut.'],
    ['K25m', K.serverNichtEingerichtet('D'), 'Der Server antwortet, aber die Anmeldung ist dort noch nicht eingerichtet. Die Anmeldung gilt weiter bis D; ich versuche es im Hintergrund erneut. Sag einem Admin Bescheid.'],
    ['K25n', K.serverUhr('D'), 'Die Uhr dieses Rechners geht mehr als 5 Minuten falsch, darum lehnt der Server die Prüfung ab. Stelle Datum und Uhrzeit richtig. Die Anmeldung gilt weiter bis D; ich versuche es im Hintergrund erneut.'],
    ['K25c', K.abgelaufenDreissig, 'Deine Anmeldung ist abgelaufen: Sie wurde seit mindestens 30 Tagen nicht mehr beim Server erneuert. Melde dich neu an.'],
    ['K25d', K.abgelaufenBis('D'), 'Dein Zugang galt bis D. Frag einen Admin nach einer Verlängerung.'],
    ['K25k', K.abgelaufenGoogle, 'Kollegen melden sich spätestens alle 90 Tage neu mit Google an. Melde dich neu an.'],
    ['K25o', K.googleNeuLaeuft('D', 'Z'), 'Kollegen melden sich spätestens alle 90 Tage neu mit Google an. Diese Anmeldung gilt noch bis D Z; danach meldest du dich neu an.'],
    ['K25e', K.entzogen('G'), 'Dein Zugang wurde beim letzten Start nicht mehr bestätigt: G. Frag einen Admin nach einem Zugang.'],
    ['K25f', Object.values(K.grund).join(' / '), 'Zugang gesperrt / Zugang gelöscht / Zugang abgelaufen / dieser Rechner ist dem Server unbekannt'],
    ['K25g', K.entzogenLaeuft('G'), 'Dein Zugang gilt nicht mehr: G. Was schon läuft, läuft weiter; beim nächsten Start des Launchers bist du abgemeldet.'],
    ['K25h', K.keinSchluesselspeicher, 'Auf diesem Rechner gibt es keinen sicheren Schlüsselspeicher. Eine Anmeldung ist hier deshalb nicht möglich.'],
    ['K25i', K.sitzungUnlesbar, 'Die gespeicherte Anmeldung war auf diesem Rechner nicht lesbar. Melde dich neu an.'],
    ['K25j', K.geraetNeu, 'Der Schlüssel dieses Rechners war nicht lesbar; der Rechner meldet sich als neues Gerät an. Ein Admin markiert ihn bei Bedarf neu als JM-Rechner.'],
    ['K26', [K.abmelden, K.neuAnmelden, K.anmelden, K.schliessen].join(' / '), 'Abmelden / Neu anmelden / Anmelden / Schließen'],
    ['K27c', `${K.jaAbmelden} / ${K.abbrechen}`, 'Abmelden / Abbrechen'],
    ['K29a', K.ausgaben, 'An Tools ausgegeben'],
    ['K29d', K.zweck['qa-relay'], 'Q&A extern'],
    ['K31', K.entwicklung('X'), 'Entwicklungsmodus: X gesetzt.'],
    ['Z1, Z2', `${Z.knopf} / ${Z.titel}`, 'Zoom anfragen / Zoom anfragen'],
    ['Z3, Z4, Z8', `${Z.zweck} / ${Z.von} / ${Z.bis} / ${Z.senden}`, 'Zweck oder Event / Von / Bis / Anfrage senden'],
    ['Z5–Z7 (Teil 1, EP34)', `${Z.hinweisJm} / ${Z.hinweisKeinJm} / ${Z.hinweisMac}`,
      'Dieser Rechner ist ein JM-Rechner. / Dieser Rechner ist kein JM-Rechner. Eine Freigabe gilt für Externe nur auf JM-Rechnern. / Auf dem Mac gibt es Zoom in Connect nicht. Eine Freigabe gilt nur für JM-Rechner unter Windows.'],
    ['Z9b (Teil 1, EP34)', Z.freigegeben('D'), 'Zoom freigegeben bis D.'],
    ['Z11 (Teil 1, EP34)', Z.connect, 'Connect nutzt Zoom-Freigaben erst mit einem kommenden Update; bis dahin gilt Zoom in Connect wie bisher.'],
    ['K40', A.titel, 'Im Browser anmelden'],
    ['K41', A.vergleichen, 'Der Browser zeigt gleich denselben Code. Bestätige dort nur, wenn er übereinstimmt.'],
    ['K42, K43', `${A.code} / ${A.frist('4:59')}`, 'Code / Gültig noch 4:59'],
    ['K44', `${A.kopieren} / ${A.kopiert}`, 'Adresse kopieren / Adresse kopiert'],
    ['K45', A.selbstOeffnen, 'Geht der Browser nicht auf, kopiere die Adresse und öffne sie selbst.'],
    ['K46, K47', `${A.abbrechen} / ${A.wartet}`, 'Abbrechen / Warte auf die Bestätigung im Browser …'],
    ['K48', `${A.abgelaufen} / ${A.neuStarten}`, 'Der Code ist abgelaufen. Starte die Anmeldung neu. / Neu starten'],
    ['K49', A.abgelehnt, 'Im Browser wurde „Nein, abbrechen“ gewählt. Es wurde nichts angemeldet.'],
    ['K50', `${A.netz} / ${A.erneut}`, 'Der Server ist nicht erreichbar. Prüfe die Internetverbindung und versuche es erneut. / Erneut versuchen'],
    ['K51', A.nichtEingerichtet, 'Die Anmeldung ist auf dem Server noch nicht eingerichtet.'],
    ['K52', A.browser, 'Der Browser ließ sich nicht öffnen. Kopiere die Adresse und öffne sie selbst.'],
    ['K53', A.server, 'Beim Server ist etwas schiefgegangen. Versuche es in ein paar Minuten erneut.'],
    ['K54', A.zuViele, 'Zu viele Anmeldeversuche von diesem Anschluss. Versuche es in ein paar Minuten erneut.'],
    ['K55', A.uhr, 'Die Uhr dieses Rechners geht falsch, darum lehnt der Server die Anmeldung ab. Stelle Datum und Uhrzeit richtig und versuche es erneut.'],
  ]);
  const alle: string[] = [];
  const sammle = (x: unknown): void => {
    if (typeof x === 'string') alle.push(x);
    else if (typeof x === 'function') alle.push(String((x as (...a: string[]) => string)('A', 'B', 'C', 'D')));
    else if (x && typeof x === 'object') Object.values(x).forEach(sammle);
  };
  [KONTO_TEXTE, ZOOM_TEXTE, ANMELDE_TEXTE].forEach(sammle);
  ck(`P25 G2: keine ASCII-Anführungszeichen in den Texten der Dialoge (${alle.length} Zeichenketten)`, alle.length > 60 && alle.every((t) => !t.includes('"')));
  const q = readFileSync(new URL('../src/renderer/src/lib/konto-dialog.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const importe = q.split('\n').filter((zeile) => /^import\b/.test(zeile));
  ck(`P25 G9: lib/konto-dialog.ts — aus Aliasen nur import type, zur Laufzeit nur ../../../shared/konto und ./konto-anzeige (${importe.length} Import-Zeilen)`,
    importe.length === 3 && importe.every((z2) => z2.startsWith('import type ') || z2.endsWith("from '../../../shared/konto';") || z2.endsWith("from './konto-anzeige';"))
    && !/window\.|localStorage|from 'react'|from 'zustand'/.test(q));
}

// --- P28 3, EP12, T21: Abzeichen der Einstellungen (Zustand × Stufe × Entwicklungs-Variable) -------------------------------
{
  const faelle: Array<[string, string, string]> = [];
  for (const z of ZUSTAENDE) for (const st of [null, 'kollege'] as const) for (const dev of [[], ['JMPS_PROXY_KEY']]) {
    const soll = dev.length > 0 ? 'entwicklung' : st !== null && MIT_SITZUNG.includes(z) ? 'angemeldet' : 'nicht-angemeldet';
    faelle.push([`${z}/${st ?? '-'}/${dev.length ? 'dev' : '-'}`, zugangsAbzeichen(ansicht(z, st === null ? null : stand(st), { devVariablen: dev })).art, soll]);
  }
  faelle.push(['vor der ersten Ansicht', zugangsAbzeichen(null).art, 'nicht-angemeldet']);
  kreuz('P28 T21: „Angemeldet“ nur mit gültiger Sitzung, „Entwicklung“ mit gesetzter Variable', faelle);
}

// --- P28 6.4, EP13, I5–I5c: iveo-Block im Show-Editor (Ansicht × Events) ---------------------------------------------------
{
  const ev: KontoIveoEvent = { key: 'https://app.my-iveo.de/api/v1|cop31', basis: 'https://app.my-iveo.de/api/v1', slug: 'cop31', name: 'COP31' };
  const lage = (a: KontoAnsicht | null, e: KontoIveoEvent[] | null): string => {
    const l = editorIveoLage(a, e);
    return `${l.fall}|${l.text ?? '-'}`;
  };
  const an = ansicht('angemeldet', stand('externer'));
  kreuz('P28 I5b, I5c: nicht angemeldet → I5b, keine Events → I5c, sonst die Auswahl', [
    ['vor der ersten Ansicht', lage(null, null), 'laedt|-'],
    ['nicht angemeldet', lage(ansicht('nicht-angemeldet', null), [ev]), `nicht-angemeldet|${IVEO_TEXTE.nichtAngemeldet}`],
    ['abgelaufen', lage(ansicht('abgelaufen', stand('kollege')), [ev]), `nicht-angemeldet|${IVEO_TEXTE.nichtAngemeldet}`],
    ['angemeldet, noch nicht geladen', lage(an, null), 'laedt|-'],
    ['angemeldet, keine Events', lage(an, []), `keine|${IVEO_TEXTE.keineEvents}`],
    ['angemeldet, Events', lage(an, [ev]), 'auswahl|-'],
    ['offline mit Sitzung', lage(ansicht('offline', stand('kollege')), [ev]), 'auswahl|-'],
  ]);
  const zwei: KontoIveoEvent[] = [ev, { key: 'https://iveo.test/api/v1|cop31', basis: 'https://iveo.test/api/v1', slug: 'cop31', name: 'COP31 Test' }];
  kreuz('P28 I5, EP13: gewählt wird über den Schlüssel ‹Basis›|‹Slug› — gültige Wahl bleibt, sonst das Event der Show, sonst keins', [
    ['gültige Wahl', editorEventWahl(zwei, zwei[1].key, '', null), zwei[1].key],
    ['Wahl nicht (mehr) in der Liste, Show mit Basis', editorEventWahl(zwei, 'weg|x', 'https://iveo.test/api/v1', 'cop31'), zwei[1].key],
    ['Show ohne Basis: erstes Event mit dem Slug', editorEventWahl(zwei, '', '', 'cop31'), ev.key],
    ['Show mit fremder Basis', editorEventWahl(zwei, '', 'https://anders.test/api/v1', 'cop31'), ''],
    ['keine Show, keine Wahl', editorEventWahl(zwei, '', '', null), ''],
    ['keine Events', editorEventWahl([], ev.key, '', 'cop31'), ''],
  ]);
}

// --- P28 EP14, OFP3, I7, I9: „Abgleich hier“ im Side-Events-Panel (Stand × Ansicht) ----------------------------------------
{
  const faelle: Array<[string, string, string]> = [];
  const ansichten: Array<[string, KontoAnsicht | null, boolean]> = [
    ['angemeldet', ansicht('angemeldet', stand('kollege')), true], ['offline', ansicht('offline', stand('externer')), true],
    ['nicht angemeldet', ansicht('nicht-angemeldet', null), false], ['abgelaufen', ansicht('abgelaufen', stand('kollege')), false],
    ['vor der ersten Ansicht', null, false],
  ];
  for (const [name, a, gueltig] of ansichten) {
    const k = (ab: Parameters<typeof abgleichKnoepfe>[0]): string => {
      const r = abgleichKnoepfe(ab, a);
      return `${r.knopf ?? '-'}|${r.warnung === null ? '-' : r.warnung === IVEO_TEXTE.warnung ? 'I9' : r.warnung}`;
    };
    faelle.push([`${name}/keine Show`, k(undefined), '-|-']);
    for (const hier of [true, false]) for (const moeglich of [true, false]) {
      const soll = hier ? 'beenden|-' : moeglich && gueltig ? 'uebernehmen|I9' : '-|-';
      faelle.push([`${name}/hier ${hier}/möglich ${moeglich}`, k({ key: 'https://app.my-iveo.de/api/v1|cop31', hier, moeglich }), soll]);
    }
  }
  kreuz('P28 EP14: „übernehmen“ (mit I9) nur angemeldet und mit Token für das Event, „beenden“ nur, wo dieser Rechner abgleicht', faelle);
}

// --- P28 9.8, 9.9: Texte T20–T23 und I5–I9 wörtlich, ohne ASCII-Anführungszeichen -------------------------------------------
{
  // I6 steht als Text im Panel (A-D7, Nachbesserung Block D, code:1) und wird im Launcher-Selbsttest wörtlich geprüft.
  kreuz('P28 9.8, 9.9: T20–T23, I5–I9 (ohne I6) wörtlich', [
    ['T20', `${ZUGANG_TEXTE.feld} / ${ZUGANG_TEXTE.hinweis}`, 'Server-Adresse / Vorgabe: Server der Suite. Nur für Entwicklung und Fehlersuche ändern.'],
    ['T21', [ZUGANG_TEXTE.angemeldet, ZUGANG_TEXTE.nichtAngemeldet, ZUGANG_TEXTE.entwicklung].join(' / '), 'Angemeldet / Nicht angemeldet / Entwicklung'],
    ['T22', ZUGANG_TEXTE.zeile, 'Downloads, Updates und iveo laufen über deine Anmeldung.'],
    ['T23', ZUGANG_TEXTE.env, 'Die Server-Adresse wird per Umgebungsvariable gesetzt und kann hier nicht überschrieben werden.'],
    ['I5', `${IVEO_TEXTE.bezeichner} / ${IVEO_TEXTE.waehlen}`, 'iveo-Event / Event wählen'],
    ['I5b', IVEO_TEXTE.nichtAngemeldet, 'Für iveo im Launcher anmelden (oben rechts).'],
    ['I5c', IVEO_TEXTE.keineEvents, 'Für dein Konto ist noch kein iveo-Event hinterlegt. Ein Admin hinterlegt Events in der Admin-Maske.'],
    ['I5d', IVEO_TEXTE.gebunden, 'Dieser Rechner gleicht die Show mit iveo ab.'],
    ['I7', `${IVEO_TEXTE.uebernehmen} / ${IVEO_TEXTE.beenden}`, 'Abgleich hier übernehmen / Abgleich hier beenden'],
    ['I8', IVEO_TEXTE.ansehen, 'Side Events des Tages ansehen (Live-Umschalten nur am Rechner, der die Show abgleicht).'],
    ['I9', IVEO_TEXTE.warnung, 'Gleicht ein anderer Rechner diese Show noch ab, beende dort den Abgleich, sonst schreiben beide die Show.'],
  ]);
  const alle = [...Object.values(ZUGANG_TEXTE), ...Object.values(IVEO_TEXTE)];
  ck(`P28 G2: keine ASCII-Anführungszeichen in T20–T23, I5–I9 ohne I6 (${alle.length} Zeichenketten)`, alle.length === 16 && alle.every((t) => !t.includes('"')));
}

// ── Ende der Fälle (Dialoge) ──

console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);

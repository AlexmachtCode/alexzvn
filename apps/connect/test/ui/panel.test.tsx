// UX Welle 2b, Connect d1 und d2 · Panel (B8, B20, B22; Muster d): die Abschnitte „Fernsteuerung“ (RemoteControlSection, Port 8737)
// und „Cloud-Zugang“ (heutige CloudZugangKarte als Panel-Abschnitt ohne Effekt), seit Task 24 dazu „Zoom-Einrichtung“ und
// „Zoom-Vorgaben“ (nur Windows). Die Adresse liest die Wurzel-View über getProxy und reicht sie als proxyAdresse herein; Speichern
// und „Key entfernen“ gehen als Aktionen an die Wurzel-View. Das Zoom-Abbild kommt nur aus stand.zoom, die laufenden Aufrufe und
// Antworten als ZoomAufrufe aus der Wurzel-View, dasselbe Objekt für Panel und Zoom-Spalte. Render ohne Browser; Speichern über die
// reine Funktion speichern, Zoom-Aufrufe über die reinen Verdrahtungen (einrichtungAufrufe, vorgabenAufrufe, slotAufrufeAus).
import type { ReactNode } from 'react';
import { PEERS_TEXTE, REMOTE_TEXTE } from '@jm/settings';
import { UNBEKANNT } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { JmConnectApi, ZoomErgebnis, ZoomSprecherEinstellung, ZoomSprecherSignal } from '@shared/types';
import { BEDIEN_TEXT, PERSON_IM_NDI_NAMEN_TOOLTIP, SLOT_FELD, SPRECHER_TEXT, sdkKnopf, sdkZeile } from '@shared/zoom-text';
import { ZUGANG_TEXT } from '../../src/main/zugang/regeln';
import { statusKlick } from '../../../../packages/ui/src/components/AppShell';
import { ABSCHNITT, CONNECT_TEXTE, statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import { CloudZugang, speichern } from '@/views/CloudZugang';
import { ConnectRahmen } from '@/views/ConnectOberflaeche';
import { Einstellungen } from '@/views/Einstellungen';
import { slotAufrufeAus } from '@/views/ZoomSpalte';
import type { ZoomAufrufe } from '@/zoom/aufrufe';
import { einrichtungAufrufe } from '@/zoom/ZoomEinrichtung';
import { vorgabenAufrufe } from '@/zoom/ZoomVorgaben';
import * as Vorgaben from '@/zoom/ZoomVorgaben';
import {
  abschnitt, aktionenAttrappe, appStatus, attr, basisMeldung, bereich, bereiche, knopfTexte, ohneKommentare, offenerRaum, raum, slotLage, stand,
  statusEintraege, tags, text, zoomAbbild, zoomSpeicher,
} from './testzustand';

const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));

function rahmen(s: OberflaechenStand, panelOffen: boolean, zoom: ZoomAufrufe = zoomSpeicher(), panelAbschnitt?: string): string {
  return render(
    <ConnectRahmen
      stand={s} show={null} error={null} invites={[]} guestName="" aktionen={aktionenAttrappe()} proxyAdresse="https://cloud.example"
      zoom={zoom} zoomLadeFehler={null} panelOffen={panelOffen} panelAbschnitt={panelAbschnitt} onPanel={() => undefined}
    />,
  );
}
const panel = (html: string): string => html.match(/<aside[\s\S]*<\/aside>/)?.[0] ?? '';
const anker = (html: string): string[] => [...html.matchAll(/id="einstellung-([^"]+)"/g)].map((m) => m[1]);
const inhalt = (html: string): string => html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';

// ── CN Panel Fernsteuerung und Cloud: Anker fernsteuerung und cloud; „Key entfernen“ und Adresse wie heute; nicht mehr im Live-Bereich ──
{
  const s = stand({ status: appStatus({ proxyKeySource: 'stored', cloudZugang: { text: 'Cloud-Zugang über den alten Proxy-Key (Übergang).', ton: 'warn' } }), room: null, fernsteuerung: basisMeldung({ clients: 2 }) });
  const offen = rahmen(s, true);
  const p = panel(offen);
  const ids = anker(p);
  gleich(ids.slice(0, 2), [ABSCHNITT.fernsteuerung, ABSCHNITT.cloud], 'CN Panel Fernsteuerung und Cloud: Anker einstellung-fernsteuerung und einstellung-cloud-zugang, in dieser Reihenfolge vorn (B20)');
  const fs = abschnitt(p, ABSCHNITT.fernsteuerung);
  ok(text(fs).includes(REMOTE_TEXTE.titel) && text(fs).includes('8737'), 'CN Panel Fernsteuerung und Cloud: Fernsteuerung mit Port 8737 aus fernsteuerungAbschnitt');
  const cz = abschnitt(p, ABSCHNITT.cloud);
  ok(text(cz).toLowerCase().includes(CONNECT_TEXTE.titel.cloud.toLowerCase()) && text(cz).includes('Cloud-Zugang über den alten Proxy-Key (Übergang).'), 'CN Panel Fernsteuerung und Cloud: Abschnitt „Cloud-Zugang“ mit der Zugangszeile aus dem Main (status.cloudZugang)');
  const [feld] = tags(cz, 'input');
  gleich([attr(feld, 'value'), attr(feld, 'placeholder')], ['https://cloud.example', 'https://…workers.dev'], 'CN Panel Fernsteuerung und Cloud: Feld „Adresse“ mit der Adresse aus getProxy und dem alten Platzhalter');
  ok(text(cz).includes('Adresse') && cz.includes(`for="${attr(feld, 'id')}"`), 'CN Panel Fernsteuerung und Cloud: das Feld trägt die Beschriftung „Adresse“');
  gleich(knopfTexte(cz), ['Key entfernen', 'Speichern'], 'CN Panel Fernsteuerung und Cloud: mit altem Key „Key entfernen“ und „Speichern“ (Schließen übernimmt ✕ des Panels)');
  ok(text(cz).includes(ZUGANG_TEXT.altProxyKey), 'CN Panel Fernsteuerung und Cloud: neben „Key entfernen“ die Zeile CZ10 wie bisher');
  for (const quelle of ['none', 'env', 'session'] as const) {
    const t = knopfTexte(abschnitt(panel(rahmen(stand({ status: appStatus({ proxyKeySource: quelle }) }), true)), ABSCHNITT.cloud));
    ok(t.includes('Key entfernen') === (quelle === 'session'), `CN Panel Fernsteuerung und Cloud: „Key entfernen“ nur bei hinterlegtem Key (stored, session), Herkunft ${quelle}`);
  }
  const vorher = render(<CloudZugang status={undefined} proxyAdresse={undefined} aktionen={aktionenAttrappe()} />);
  ok(text(vorher).includes(UNBEKANNT) && attr(tags(vorher, 'input')[0], 'value') === '', 'CN Panel Fernsteuerung und Cloud: vor der ersten Antwort „unbekannt“ und ein leeres Feld (keine geratene Adresse)');
  const m = inhalt(offen);
  ok(!text(m).includes('Cloud-Zugang:') && !knopfTexte(m).includes('ändern') && !m.includes('workers.dev') && !knopfTexte(m).includes('Key entfernen'), 'CN Panel Fernsteuerung und Cloud: die Cloud-Karte steht nicht mehr im Live-Bereich (keine Zeile, kein „ändern“, kein Feld)');
  ok(panel(rahmen(s, false)) === '', 'CN Panel Fernsteuerung und Cloud: Panel zu → kein Abschnitt gerendert');
  const leiste = new Map(statusEintraege(rahmen(s, false)).map(([id]) => [id, id]));
  ok(leiste.has('cloud-zugang') && leiste.has('fernsteuerung'), 'CN Panel Fernsteuerung und Cloud: Statusleiste mit Cloud-Zugang und Fernsteuerung');
  const knoepfe = tags(rahmen(s, false), 'button').filter((t) => ['cloud-zugang', 'fernsteuerung'].includes(attr(t, 'data-status-id') ?? ''));
  ok(knoepfe.length === 2, 'CN Panel Fernsteuerung und Cloud: beide Statuseinträge sind Knöpfe zum Abschnitt (settingsSection)');
  pruefeIdVerweise(p, 'CN Panel Fernsteuerung und Cloud: id-Verweise im Panel gültig');
}

// ── CN Panel Cloud speichern: setProxy über die Wurzel-View, busy sperrt, danach gilt die gespeicherte Adresse ──
{
  const log: string[] = [];
  const zustand: string[] = [];
  await speichern('https://neu.example', aktionenAttrappe(log), { busy: (b) => void zustand.push(`busy:${b}`), url: (u) => void zustand.push(`url:${u}`) });
  gleich([log, zustand], [['proxySpeichern:https://neu.example'], ['busy:true', 'url:null', 'busy:false']], 'CN Panel Cloud speichern: setProxy mit der Eingabe, solange gesperrt, danach zeigt das Feld die gespeicherte Adresse');
  const fehler: string[] = [];
  const a = { ...aktionenAttrappe(), proxySpeichern: () => Promise.reject(new Error('kaputt')) };
  const r = await speichern('x', a, { busy: (b) => void fehler.push(`busy:${b}`), url: () => void fehler.push('url') }).then(() => 'ok', () => 'abgelehnt');
  gleich([r, fehler], ['abgelehnt', ['busy:true', 'busy:false']], 'CN Panel Cloud speichern: scheitert setProxy, ist der Knopf wieder frei und die Eingabe bleibt (wie bisher, finally)');
  const q = QUELLE('views/CloudZugang.tsx');
  ok(/if \(e\.key === 'Enter' && !busy\) void speichern\(/.test(q) && /disabled=\{busy\}/.test(q), 'CN Panel Cloud speichern: Enter speichert, nicht während gespeichert wird; „Speichern“ gesperrt, solange gespeichert wird');
  ok(/onClick=\{\(\) => void aktionen\.keyEntfernen\(\)\}/.test(q) && !q.includes('window.'), 'CN Panel Cloud speichern: „Key entfernen“ ruft die Aktion der Wurzel-View (setProxy mit leerem Key), ohne Rückfrage');
  const html = render(<CloudZugang status={appStatus()} proxyAdresse={null} aktionen={aktionenAttrappe()} />);
  ok(attr(tags(html, 'input')[0], 'value') === '', 'CN Panel Cloud speichern: scheiterte getProxy (null), bleibt das Feld leer wie bisher');
}

// ── CN Panel ohne Effekt: CloudZugang.tsx und Einstellungen.tsx ohne useEffect; getProxy in der Wurzel-View (B8) ──
{
  const dateien = ['views/CloudZugang.tsx', 'views/Einstellungen.tsx'];
  gleich(dateien.filter((d) => /\buse(?:Layout)?Effect\b/.test(QUELLE(d))), [], 'CN Panel ohne Effekt: CloudZugang.tsx und Einstellungen.tsx enthalten kein useEffect (B8)');
  gleich(dateien.filter((d) => /\bwindow\b|useBrueckenWert|onStatus|getProxy|setProxy/.test(QUELLE(d))), [], 'CN Panel ohne Effekt: kein window, keine Brücke, kein IPC im Panel; Stand und Aktionen kommen aus der Wurzel-View');
  const wurzel = QUELLE('views/ConnectOberflaeche.tsx');
  ok(wurzel.includes('window.jmconnect.getProxy()') && /useEffect\(\(\) => \{\n\s*void window\.jmconnect\.getProxy\(\)/.test(wurzel), 'CN Panel ohne Effekt: getProxy steht in einem Effekt der Wurzel-View');
  ok(/window\.jmconnect\.setProxy\(\{ url \}\)/.test(wurzel) && /window\.jmconnect\.setProxy\(\{ key: '' \}\)/.test(wurzel), 'CN Panel ohne Effekt: Speichern und „Key entfernen“ rufen setProxy in der Wurzel-View, wie bisher mit { url } bzw. { key: \'\' }');
  const html = render(<Einstellungen stand={offenerRaum(raum())} aktionen={aktionenAttrappe()} proxyAdresse="https://cloud.example" />);
  ok(html.includes('einstellung-fernsteuerung') && html.includes('einstellung-cloud-zugang'), 'CN Panel ohne Effekt: Einstellungen rendert ohne window und ohne Effekt beide Abschnitte');
}

// ── CN Panel Abschnitte: Anker für alle ABSCHNITT-Werte; Einrichtung und Vorgaben nicht mehr in der Zoom-Spalte; macOS ohne Zoom ──
{
  const a = zoomAbbild({ slots: [slotLage(1)] });
  const s = stand({ status: appStatus(), room: null, zoom: a });
  const offen = rahmen(s, true);
  const p = panel(offen);
  gleich(anker(p), Object.values(ABSCHNITT), 'CN Panel Abschnitte: unter Windows je ABSCHNITT-Wert ein Anker, Fernsteuerung, Cloud-Zugang, Zoom-Einrichtung, Zoom-Vorgaben (B20)');
  const ein = abschnitt(p, ABSCHNITT.zoomEinrichtung);
  ok(
    text(ein).toLowerCase().includes(CONNECT_TEXTE.titel.zoomEinrichtung.toLowerCase()) && text(ein).includes(sdkZeile(a)) && text(ein).includes(a.einrichtung.anmeldung.text)
      && [sdkKnopf(a), 'Zoom-SDK laden', 'Einrichtung prüfen'].every((k) => knopfTexte(ein).includes(k)),
    'CN Panel Abschnitte: „Zoom-Einrichtung“ mit SDK-Zeile, Zoom-Anmeldung, „Neu wählen …“, „Zoom-SDK laden“ und „Einrichtung prüfen“ (Nr. 60–68)',
  );
  const vg = abschnitt(p, ABSCHNITT.zoomVorgaben);
  ok(
    text(vg).toLowerCase().includes(CONNECT_TEXTE.titel.zoomVorgaben.toLowerCase()) && text(vg).includes(SLOT_FELD.vorgaben(a.vorgaben.aufloesung, a.vorgaben.tonAn))
      && text(vg).includes(SLOT_FELD.aufloesung) && text(vg).includes(BEDIEN_TEXT.personImNdiNamen) && tags(vg, 'span').some((t) => attr(t, 'title') === PERSON_IM_NDI_NAMEN_TOOLTIP)
      && Object.values(SPRECHER_TEXT.signal).every((t) => text(vg).includes(t)) && text(vg).includes(SPRECHER_TEXT.T73(a.sprecher.haltezeitMs)),
    'CN Panel Abschnitte: „Zoom-Vorgaben“ mit Slot-Vorgaben (T77, Auflösung, Ton), „Person im NDI-Namen“ samt Tooltip und den Sprecher-Einstellungen (Signal, Haltezeit T73; Nr. 80, 82, 83)',
  );
  const spalte = bereich(inhalt(offen), 'data-connect', 'zoom-spalte');
  ok(
    spalte !== '' && !knopfTexte(spalte).includes('Einrichtung') && !text(spalte).includes(sdkZeile(a)) && !knopfTexte(spalte).includes('Zoom-SDK laden')
      && !knopfTexte(spalte).includes('Einrichtung prüfen') && !knopfTexte(spalte).includes(BEDIEN_TEXT.vorgaben) && !knopfTexte(spalte).includes(BEDIEN_TEXT.sprecherEinstellungen)
      && !text(spalte).includes(BEDIEN_TEXT.personImNdiNamen) && !text(spalte).includes(SLOT_FELD.vorgaben(a.vorgaben.aufloesung, a.vorgaben.tonAn)),
    'CN Panel Abschnitte: Einrichtung und Vorgaben (Slot-Vorgaben, Sprecher-Einstellungen, „Person im NDI-Namen“) stehen nicht mehr in der Zoom-Spalte (B20)',
  );
  ok(text(spalte).includes(BEDIEN_TEXT.vorschau) && knopfTexte(spalte).includes(BEDIEN_TEXT.slotHinzufuegen), 'CN Panel Abschnitte: Vorschau-Schalter und „Slot hinzufügen“ bleiben in der Zoom-Spalte (W2-5)');
  const mangel = zoomAbbild({ kurz: { zustand: 'einrichtung', maengel: ['sdk_fehlt'] }, einrichtung: { ...a.einrichtung, sdk: { ...a.einrichtung.sdk, stand: 'fehlt', fassung: null } } });
  const mp = rahmen(stand({ status: appStatus(), room: null, zoom: mangel }), true);
  ok(
    text(abschnitt(panel(mp), ABSCHNITT.zoomEinrichtung)).includes('Zoom ist gesperrt, bis das Zoom-SDK eingerichtet ist.') && !text(bereich(inhalt(mp), 'data-connect', 'zoom-spalte')).includes(sdkZeile(mangel)),
    'CN Panel Abschnitte: bei einem Mangel steht der Sperr-Hinweis im Panel, die Einrichtung steht nicht mehr offen in der Spalte (B22)',
  );
  const mac = rahmen(stand({ plattform: 'darwin', status: appStatus(), zoom: a }), true);
  gleich(anker(panel(mac)), [ABSCHNITT.fernsteuerung, ABSCHNITT.cloud], 'CN Panel Abschnitte: unter macOS keine Zoom-Abschnitte (W2-5)');
  const vor = panel(rahmen(stand({ status: appStatus() }), true));
  ok(
    anker(vor).length === 4 && [ABSCHNITT.zoomEinrichtung, ABSCHNITT.zoomVorgaben].every((id) => text(abschnitt(vor, id)).includes(UNBEKANNT) && knopfTexte(abschnitt(vor, id)).length === 0),
    'CN Panel Abschnitte: vor dem ersten Abbild stehen beide Zoom-Abschnitte mit „unbekannt“ und ohne Knopf (nichts geraten)',
  );
  pruefeIdVerweise(p, 'CN Panel Abschnitte: id-Verweise im Panel mit den Zoom-Abschnitten gültig');
  ok(panel(rahmen(s, false)) === '', 'CN Panel Abschnitte: Panel zu → kein Zoom-Abschnitt gerendert');
}

// ── CN Antwort am Ort: Panel-Aufruf am Ort „einrichtung“ (bzw. „vorgaben“), Spalten-Aufruf an seinem Ort, beide über dasselbe ZoomAufrufe ──
{
  const z = zoomSpeicher();
  const nein = (t: string) => (): Promise<ZoomErgebnis> => Promise.resolve({ ok: false, text: t });
  const SDK = 'Der gewählte Ordner enthält kein Zoom-SDK.';
  const r = await einrichtungAufrufe(z, () => ({ zoomSdkWaehlen: nein(SDK) }) as unknown as JmConnectApi).sdkWaehlen();
  gleich([r, z.antwort, [...z.laeuft]], [{ ok: false, text: SDK }, { ort: 'einrichtung', text: SDK }, []], 'CN Antwort am Ort: ein abgelehnter Aufruf aus dem Panel („SDK-Ordner wählen …“) steht am Ort „einrichtung“; danach läuft nichts mehr');
  const a = zoomAbbild({ slots: [slotLage(1), slotLage(2)] });
  const s = stand({ status: appStatus(), room: null, zoom: a });
  const h1 = rahmen(s, true, z);
  ok(text(abschnitt(panel(h1), ABSCHNITT.zoomEinrichtung)).includes(SDK) && !text(inhalt(h1)).includes(SDK), 'CN Antwort am Ort: die Antwort steht im Abschnitt „Zoom-Einrichtung“ des Panels, nicht in der Spalte');
  await slotAufrufeAus(z, null, () => undefined).fuehreAus('behalten:2', 'slot:2', nein('Antwort an Kachel 2'));
  gleich(z.antwort, { ort: 'slot:2', text: 'Antwort an Kachel 2' }, 'CN Antwort am Ort: ein abgelehnter Aufruf aus der Spalte (Kachel 2) steht an seinem Ort und ersetzt die Panel-Antwort (eine Antwort für beide)');
  const h2 = rahmen(s, true, z);
  const kacheln = bereiche(inhalt(h2), 'data-connect', 'kachel');
  ok(
    kacheln.length === 2 && text(kacheln[1] ?? '').includes('Antwort an Kachel 2') && !text(kacheln[0] ?? '').includes('Antwort an Kachel 2') && !text(panel(h2)).includes('Antwort an Kachel 2') && !text(h2).includes(SDK),
    'CN Antwort am Ort: die Antwort steht an Kachel 2, nicht an Kachel 1 und nicht im Panel; die alte Panel-Antwort ist weg',
  );
  await vorgabenAufrufe(z, () => ({ zoomSlotVorgaben: nein('Antwort an den Vorgaben') }) as unknown as JmConnectApi).vorgaben({ aufloesung: '1080p', tonAn: true });
  const h3 = rahmen(s, true, z);
  ok(
    z.antwort?.ort === 'vorgaben' && text(abschnitt(panel(h3), ABSCHNITT.zoomVorgaben)).includes('Antwort an den Vorgaben') && !text(inhalt(h3)).includes('Antwort an den Vorgaben'),
    'CN Antwort am Ort: ein abgelehnter Aufruf der Zoom-Vorgaben steht im Abschnitt „Zoom-Vorgaben“ (Ort „vorgaben“), nicht in der Spalte',
  );
  const wurf = await z.fuehreAus('x', null, () => Promise.reject(new Error('IPC weg')));
  gleich([wurf, z.antwort], [{ ok: false, text: 'IPC weg' }, { ort: 'karte', text: 'IPC weg' }], 'CN Antwort am Ort: ein unerwarteter Fehler ohne eigenen Ort steht wie bisher am Ort „karte“');
  ok(text(bereich(inhalt(rahmen(s, false, z)), 'data-connect', 'zoom-spalte')).includes('IPC weg'), 'CN Antwort am Ort: „karte“ ist die Zoom-Spalte (unter der Statuszeile)');
  let mitten: string[] = [];
  await z.fuehreAus('sdk', 'einrichtung', () => {
    mitten = [...z.laeuft];
    return Promise.resolve({ ok: true });
  });
  gleich([mitten, [...z.laeuft], z.antwort], [['sdk'], [], null], 'CN Antwort am Ort: während des Aufrufs steht sein Schlüssel in laeuft (Doppelklick-Schutz Nr. 103), ein neuer Aufruf löscht die alte Antwort');
  const wurzel = QUELLE('views/ConnectOberflaeche.tsx');
  const rahmenFn = wurzel.slice(wurzel.indexOf('export function ConnectRahmen('), wurzel.indexOf('\n}\n', wurzel.indexOf('export function ConnectRahmen(')));
  ok((rahmenFn.match(/zoom=\{p\.zoom\}/g) ?? []).length === 2 && rahmenFn.includes('<Einstellungen') && rahmenFn.includes('<ZoomSpalte'), 'CN Antwort am Ort: ConnectRahmen gibt dasselbe ZoomAufrufe an Einstellungen und ZoomSpalte');
}

// ── CN Zoom-Abbild bleibt: Abo des Abbilds und laufende Aufrufe in der Wurzel-View; Panel ohne Effekte (B8, B20) ──
{
  const wurzel = QUELLE('views/ConnectOberflaeche.tsx');
  const ZOOM_ABLAEUFE = ['window.jmconnect.zoomGet()', 'window.jmconnect.onZoom(', 'fuehreZoomAus(', 'useState<ReadonlySet<string>>'];
  gleich(ZOOM_ABLAEUFE.filter((x) => !wurzel.includes(x)), [], 'CN Zoom-Abbild bleibt: Abo des Abbilds (zoomGet, onZoom) und die laufenden Aufrufe (laeuft, fuehreZoomAus) stehen in der Wurzel-View');
  const ANDERE = [
    'App.tsx', 'views/CloudRaum.tsx', 'views/Einstellungen.tsx', 'views/CloudZugang.tsx', 'views/Fusszeile.tsx', 'views/ZoomSpalte.tsx', 'zoom/ZoomCard.tsx',
    'zoom/ZoomEinrichtung.tsx', 'zoom/ZoomVorgaben.tsx', 'zoom/SlotBereich.tsx', 'zoom/SlotKachel.tsx', 'zoom/SlotEinstellungen.tsx', 'zoom/Messwerte.tsx',
  ];
  gleich(ANDERE.flatMap((d) => ZOOM_ABLAEUFE.filter((x) => QUELLE(d).includes(x)).map((x) => `${d}: ${x}`)), [], 'CN Zoom-Abbild bleibt: kein Abo des Abbilds und kein laufender Aufruf in Spalte, Panel oder Zoom-Bausteinen');
  ok(/useEffect\(\(\) => \{[\s\S]{0,300}window\.jmconnect\s*\.zoomGet\(\)/.test(wurzel) && /const aus = window\.jmconnect\.onZoom\(/.test(wurzel), 'CN Zoom-Abbild bleibt: zoomGet und onZoom in einem Effekt der Wurzel-View (Abo und Abbestellen)');
  ok(/zoom: zoomAbbild,/.test(wurzel) && !/zoom: undefined/.test(wurzel), 'CN Zoom-Abbild bleibt: der Stand trägt das Abbild aus dem Abo (stand.zoom), nicht mehr undefined');
  const rahmenFn = wurzel.slice(wurzel.indexOf('export function ConnectRahmen('), wurzel.indexOf('\n}\n', wurzel.indexOf('export function ConnectRahmen(')));
  ok(!/\babbild=\{/.test(rahmenFn) && /<ZoomSpalte stand=\{stand\}/.test(rahmenFn) && /<Einstellungen stand=\{stand\}/.test(rahmenFn), 'CN Zoom-Abbild bleibt: Spalte und Panel bekommen das Abbild nur über stand (keine zweite Prop)');
  const PANEL = ['views/Einstellungen.tsx', 'views/CloudZugang.tsx', 'zoom/ZoomEinrichtung.tsx', 'zoom/ZoomVorgaben.tsx'];
  gleich(PANEL.filter((d) => /\buse(?:Layout)?Effect\b/.test(QUELLE(d))), [], 'CN Zoom-Abbild bleibt: der Panel-Inhalt (Einstellungen, Cloud-Zugang, Zoom-Einrichtung, Zoom-Vorgaben) hat kein useEffect (B8)');
  gleich(PANEL.filter((d) => /\.on[A-Z]\w*\(|useBrueckenWert|zoomGet|getProxy|onStatus/.test(QUELLE(d))), [], 'CN Zoom-Abbild bleibt: kein Abo und keine Brücke im Panel-Inhalt');
  gleich(PANEL.filter((d) => /\bwindow\b/.test(QUELLE(d).replace(/\(\) => window\.jmconnect/g, ''))), [], 'CN Zoom-Abbild bleibt: der Panel-Inhalt liest window nur als Zielgeber der Aufrufe (() => window.jmconnect), nie beim Rendern');
  const i = wurzel.indexOf('window.jmconnect.zoomGet()');
  const effekt = i < 0 ? 'panelOffen' : wurzel.slice(Math.max(0, i - 400), i + 900);
  ok(!/panelOffen|panelAbschnitt/.test(effekt), 'CN Zoom-Abbild bleibt: das Abo hängt nicht am Panel-Zustand (bleibt über Panel-Wechsel stabil)');
}

// ── CN Mangel öffnet das Panel: Statuseintrag zoom-einrichtung (warn, sdkZeile, settingsSection) nur unter Windows mit Mangel ──
{
  const fehlt = zoomAbbild({ kurz: { zustand: 'einrichtung', maengel: ['sdk_fehlt'] } });
  const s = stand({ status: appStatus({ zoom: fehlt.kurz }), room: null, zoom: fehlt });
  const eintrag = statusLeiste(s).find((x) => x.id === 'zoom-einrichtung');
  gleich([eintrag?.state, eintrag?.detail, eintrag?.settingsSection], ['warn', sdkZeile(fehlt), ABSCHNITT.zoomEinrichtung], 'CN Mangel öffnet das Panel: mit Mangel ein Eintrag „Zoom-Einrichtung“ (warn, SDK-Zeile) mit Sprung zum Abschnitt (B22)');
  const knopf = tags(rahmen(s, false), 'button').find((t) => attr(t, 'data-status-id') === 'zoom-einrichtung');
  ok(knopf !== undefined && attr(knopf, 'data-state') === 'warn', 'CN Mangel öffnet das Panel: der Eintrag ist in der Statusleiste ein Knopf');
  const log: string[] = [];
  statusKlick({ settings: <span /> as ReactNode, onSettingsChange: (offen: boolean, id?: string) => void log.push(`${offen}:${id ?? ''}`) })?.(eintrag?.settingsSection ?? '');
  gleich(log, [`true:${ABSCHNITT.zoomEinrichtung}`], 'CN Mangel öffnet das Panel: der Klick öffnet das Panel am Abschnitt „Zoom-Einrichtung“');
  const offen = rahmen(s, true, zoomSpeicher(), ABSCHNITT.zoomEinrichtung);
  ok(panel(offen).includes(`id="einstellung-${ABSCHNITT.zoomEinrichtung}"`) && text(abschnitt(panel(offen), ABSCHNITT.zoomEinrichtung)).includes(sdkZeile(fehlt)), 'CN Mangel öffnet das Panel: dort steht die Einrichtung mit dem Mangel');
  const ohne = (st: OberflaechenStand): boolean => !statusLeiste(st).some((x) => x.id === 'zoom-einrichtung');
  ok(
    ohne(stand({ status: appStatus(), zoom: zoomAbbild() })) && ohne(stand({ status: appStatus({ zoom: fehlt.kurz }) })) && ohne(stand({ plattform: 'darwin', status: appStatus(), zoom: fehlt })),
    'CN Mangel öffnet das Panel: kein Eintrag ohne Mangel, ohne Abbild und unter macOS',
  );
  const wurzel = QUELLE('views/ConnectOberflaeche.tsx');
  ok(/setPanelOffen\(offen\);\n\s*setPanelAbschnitt\(abschnitt\);/.test(wurzel) && /onSettingsChange=\{p\.onPanel\}/.test(wurzel), 'CN Mangel öffnet das Panel: der Statuseintrag führt über onPanel zu Panel offen und Abschnitt (Wurzel-View)');
}

// ── CN Sprecher-Signal mit „Setzen“ (Nachtrag Task 25, Befund 11; „Wahl ≠ Bewegung“): die Optionsfelder im Panel „Zoom-Vorgaben“
// wählen nur einen Entwurf (Pfeiltasten in der Gruppe wechseln die Wahl), erst „Setzen“ schickt speakerConfig über zoomSprecher wie
// bisher. Ohne Effekt (B8): der Entwurf merkt den gemeldeten Wert, gegen den er gewählt wurde. ──
{
  const pruefe = async (name: string, f: () => boolean | Promise<boolean>): Promise<void> => {
    let r = false;
    try {
      r = await f();
    } catch (e) {
      console.log(`     ${e instanceof Error ? e.message : String(e)}`);
    }
    ok(r, name);
  };
  const W = CONNECT_TEXTE.wahl;
  const signale = Object.keys(SPRECHER_TEXT.signal) as ZoomSprecherSignal[];
  const gemeldet: ZoomSprecherEinstellung = { signal: signale[0]!, haltezeitMs: 1000 };
  const anders = signale[1]!;
  const bedienung = (beschaeftigt = false, antwort = true) => {
    const gesendet: ZoomSprecherEinstellung[] = [];
    let entwurf: Vorgaben.SignalEntwurf | null = null;
    const jetzt = (g: ZoomSprecherEinstellung = gemeldet) =>
      Vorgaben.sprecherWahl({
        gemeldet: g,
        entwurf,
        setzeEntwurf: (f) => {
          entwurf = f(entwurf);
        },
        beschaeftigt,
        sende: (s) => {
          gesendet.push(s);
          return Promise.resolve(antwort);
        },
      });
    return { gesendet, jetzt };
  };

  await pruefe('CN Sprecher-Signal: eine Wahl (auch per Pfeiltaste) sendet nichts, „Setzen“ sendet genau einmal das gewählte Signal mit der gemeldeten Haltezeit', async () => {
    const b = bedienung();
    b.jetzt().waehlen(anders);
    const vorher = b.gesendet.length;
    const w = b.jetzt();
    const frei = w.wert === anders && w.setzenGrund === undefined;
    await w.setzen();
    await b.jetzt().setzen();
    return vorher === 0 && frei && JSON.stringify(b.gesendet) === JSON.stringify([{ ...gemeldet, signal: anders }]);
  });
  await pruefe('CN Sprecher-Signal: „Setzen“ ohne Abweichung gesperrt mit Grund (auch nach Rückwahl), während des Aufrufs gesperrt, dann sendet es nichts', async () => {
    const b = bedienung();
    const leer = b.jetzt().setzenGrund === W.sprecherUnveraendert;
    b.jetzt().waehlen(anders);
    b.jetzt().waehlen(gemeldet.signal);
    const zurueck = b.jetzt().setzenGrund === W.sprecherUnveraendert;
    await b.jetzt().setzen();
    const c = bedienung(true);
    c.jetzt().waehlen(anders);
    const sendet = c.jetzt().setzenGrund === W.sendet;
    await c.jetzt().setzen();
    return leer && zurueck && sendet && b.gesendet.length === 0 && c.gesendet.length === 0;
  });
  await pruefe('CN Sprecher-Signal: der Entwurf gilt nur gegen das gemeldete Signal, gegen das er gewählt wurde; eine Ablehnung lässt ihn stehen', async () => {
    const b = bedienung();
    b.jetzt().waehlen(anders);
    const neu = b.jetzt({ ...gemeldet, signal: signale[2] ?? anders });
    const c = bedienung(false, false);
    c.jetzt().waehlen(anders);
    await c.jetzt().setzen();
    return neu.wert === (signale[2] ?? anders) && neu.setzenGrund === W.sprecherUnveraendert && c.jetzt().setzenGrund === undefined && c.jetzt().wert === anders;
  });
  await pruefe('CN Sprecher-Signal: im Panel steht unter den Optionsfeldern „Setzen“ (ohne Abweichung gesperrt, Grund als Tooltip), die Optionsfelder senden nicht selbst', () => {
    const a = zoomAbbild();
    const vg = abschnitt(panel(rahmen(stand({ status: appStatus(), room: null, zoom: a }), true)), ABSCHNITT.zoomVorgaben);
    const setzen = bereich(vg, 'data-connect', 'sprecher-setzen');
    const knopf = tags(setzen, 'button')[0];
    const q = QUELLE('zoom/ZoomVorgaben.tsx');
    return knopfTexte(vg).filter((t) => t === PEERS_TEXTE.setzen).length === 1 && knopf !== undefined && /\sdisabled=""/.test(knopf)
      && tags(setzen, 'span').some((t) => attr(t, 'title') === W.sprecherUnveraendert)
      && q.includes('onChange={() => signal.waehlen(s)}') && !/onChange=\{\(\) => void sendeSprecher\(\{ \.\.\.a\.sprecher, signal: s \}\)\}/.test(q) && q.includes('onClick={() => void signal.setzen()}');
  });
}

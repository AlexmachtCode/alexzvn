// UX Welle 2b, Connect d1 · Rahmen (B4, B8, B9, B19, B3; Muster d; Spec 3.1, 3.8): AppShell mit Kopf „JM Connect“, ThemeToggle, ⚙
// und ON AIR nur bei gemessener Sendung; T145 als erste Zeile des Inhalts; zwei Spalten (links Cloud-Raum, rechts bis Task 24 die
// unveränderte ZoomCard), unter macOS eine Spalte mit MAC_ZEILE; die Pflicht-Fußzeile immer, in main nach beiden Spalten.
// Wächter am Quelltext: Raum-Client, Abos und Fernbefehle in der Wurzel-View, nichts hängt am Panel-Zustand; keine rohen Farben.
// Render ohne Browser und ohne window (Effekte laufen in renderToStaticMarkup nicht).
import { REMOTE_TEXTE } from '@jm/settings';
import { STATUS_SYMBOL, UNBEKANNT } from '@jm/ui';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { NDI_TEXT } from '@shared/ndi-text';
import type { ZoomKurz } from '@shared/types';
import { MAC_ZEILE, gaesteZeile, ohneVorsatz, zoomZeile } from '@shared/zoom-text';
import { CONNECT_TEXTE, statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import { ConnectOberflaeche, ConnectRahmen } from '@/views/ConnectOberflaeche';
import { aktionenAttrappe, appStatus, attr, bereich, ohneKommentare, offenerRaum, raum, stand, statusEintraege, tags, text } from './testzustand';

const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const ROH = (d: string): string => leseText(`src/renderer/src/${d}`);

/** Der Rahmen mit einem gegebenen Stand (ohne die Wurzel-View), wie ConnectOberflaeche ihn rendert. */
function rahmen(s: OberflaechenStand, panelOffen = false, log: string[] = []): string {
  return render(
    <ConnectRahmen
      stand={s}
      show={null}
      error={null}
      invites={[]}
      guestName=""
      aktionen={aktionenAttrappe(log)}
      proxyAdresse="https://cloud.example"
      panelOffen={panelOffen}
      onPanel={() => undefined}
    />,
  );
}
/** Render ohne Abbruch: ein Wurf zählt als FAIL, der Lauf geht weiter. */
function ohneWurf(name: string, f: () => string): string {
  try {
    return f();
  } catch (e) {
    ok(false, `${name}: Render ohne Wurf (${String(e).split(String.fromCharCode(10))[0]})`);
    return '';
  }
}
const kopf = (html: string): string => html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
const inhalt = (html: string): string => html.match(/<main[\s\S]*<\/main>/)?.[0] ?? '';

// ── CN Rahmen: Kopf „JM Connect“, ThemeToggle, ⚙, T145 erste Zeile des Inhalts, kein Untertitel im Kopf ──
{
  const html = ohneWurf('CN Rahmen', () => rahmen(stand()));
  const k = kopf(html);
  const [thema] = tags(k, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
  const [zahnrad] = tags(k, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
  ok(text(k).includes('JM Connect') && !text(k).includes(NDI_TEXT.t145) && !k.includes('data-bereich="mitte"'), 'CN Rahmen: Kopf „JM Connect“ aus dem AppShell, ohne Untertitel und ohne Mitte (B9, E16)');
  gleich(
    [attr(thema, 'aria-label'), attr(zahnrad, 'aria-label'), attr(zahnrad, 'aria-expanded')],
    ['Darstellung: Dunkel. Umschalten auf Hell', 'Einstellungen öffnen', 'false'],
    'CN Rahmen: ThemeToggle und ⚙ „Einstellungen öffnen“ im Kopf, Panel beim Start zu (B4)',
  );
  const m = inhalt(html);
  const ersteZeile = /<main[^>]*>(?:<div[^>]*>)*<p[^>]*data-connect="untertitel"[^>]*>([^<]*)<\/p>/.exec(m);
  ok(ersteZeile !== null && ersteZeile[1] === NDI_TEXT.t145, 'CN Rahmen: T145 ist die erste Zeile des Inhalts (vor den Spalten, B9)');
  /** Die erste Nennung von NDI im Text liegt in T145 und trägt das ®. */
  const ersteNdiInT145 = (h: string): boolean => {
    const t = text(h);
    const i = t.indexOf('NDI');
    const j = t.indexOf(NDI_TEXT.t145);
    return i >= 0 && j >= 0 && i >= j && i < j + NDI_TEXT.t145.length && t.slice(i, i + 4) === 'NDI®';
  };
  ok(ersteNdiInT145(html), 'CN Rahmen: die erste Nennung von NDI im Fenster ist T145 mit ® (LP3, PK52), auch mit Statusleiste');
  const offen = ohneWurf('CN Rahmen offen', () => rahmen(offenerRaum(raum(['onair'])), true));
  ok(ersteNdiInT145(offen), 'CN Rahmen: auch mit offenem Panel und Gästen steht vor T145 kein NDI (Panel und Statusleiste folgen im Fenster nach dem Inhalt)');
  ok(!html.includes('data-onair'), 'CN Rahmen: vor der ersten Antwort kein ON AIR im Kopf (B3: onAir fehlt)');
  ok(offen.includes('data-onair="live"') && !rahmen(offenerRaum(raum(['approved']))).includes('data-onair'), 'CN Rahmen: ON AIR live nur mit einem Gast auf Sendung bei Raumverbindung, sonst fehlt die Anzeige (B3)');
  gleich(
    statusEintraege(html).map(([id]) => id),
    statusLeiste(stand()).map((i) => i.id),
    'CN Rahmen: die Statusleiste zeigt genau die Einträge aus statusLeiste (eine Wahrheit)',
  );
  ok(statusEintraege(html).every(([, z]) => z === 'off'), 'CN Rahmen: vor der ersten Antwort ist kein Statuseintrag ok');
  ok(!/Steuerport \d+|● Raum verbunden|○ Raum nicht verbunden/.test(text(html)), 'CN Rahmen: die alten Kopfzeilen (Steuerport, Raum verbunden, Zoom-Zeile) entfallen, die Statusleiste meldet sie (Spec 7)');
  pruefeIdVerweise(html, 'CN Rahmen: id-Verweise im ganzen Fenster gültig (Panel zu)');
  pruefeIdVerweise(offen, 'CN Rahmen: id-Verweise im ganzen Fenster gültig (Panel offen)');
  const wurzel = ohneWurf('CN Rahmen Wurzel-View', () => render(<ConnectOberflaeche />));
  ok(wurzel.includes('JM Connect') && wurzel.includes(NDI_TEXT.t145), 'CN Rahmen: die Wurzel-View rendert ohne window (Render-Test ohne Electron)');
}

// ── CN Rahmen Statusleiste: Zoom- und Gäste-Zeilen ohne eigenes Symbol und ohne Namen (ohneVorsatz), Programm wie das Abzeichen ──
{
  const k: ZoomKurz = {
    zustand: 'einrichtung', warten: null, erlaubnis: null, slotsLaufen: 0, slotsErsatz: 0, slotsOffen: 0, slotsAn: 0, slotsGestopptEntzug: 0,
    slotKurz: [], versuch: null, maengel: ['sdk_fehlt'], kopieLaeuft: false, befehl: null,
  };
  const st = appStatus({ zoom: k });
  const html = rahmen(stand({ status: st }));
  const titel = new Map(statusEintraege(html).map(([id, , t]) => [id, t]));
  gleich(
    [titel.get('zoom'), titel.get('ndi-gaeste')],
    [`${CONNECT_TEXTE.titel.zoom}: ${ohneVorsatz(zoomZeile(k)!)}`, `${CONNECT_TEXTE.titel.ndiGaeste}: ${ohneVorsatz(gaesteZeile(st))}`],
    'CN Rahmen Statusleiste: Zoom und Gäste (NDI) ohne das Symbol und den Namen ihrer Zeile (kein Symbol doppelt)',
  );
  ok(
    Object.values(STATUS_SYMBOL).every((sym) => !(titel.get('zoom') ?? '').includes(`: ${sym}`)) && !/: [●○△◌✕] /.test(titel.get('zoom') ?? '') && !/: [●○△◌✕] /.test(titel.get('ndi-gaeste') ?? ''),
    'CN Rahmen Statusleiste: im Detail steht kein zweites Zustandssymbol',
  );
}

// ── CN Fußzeile immer: T134 und beide Knöpfe in main nach beiden Spalten, ohne Bedingung ──
{
  for (const [name, s] of [
    ['vor der ersten Antwort', stand()],
    ['offener Raum', offenerRaum(raum(['lobby', 'onair']))],
    ['macOS', stand({ plattform: 'darwin', status: appStatus() })],
  ] as const) {
    const html = rahmen(s);
    const m = inhalt(html);
    const fuss = bereich(m, 'data-connect', 'fusszeile');
    const spalten = m.indexOf('data-connect="spalten"');
    ok(
      fuss !== '' && text(fuss).includes(NDI_TEXT.t134) && text(fuss).includes(NDI_TEXT.t142Logordner) && text(fuss).includes(NDI_TEXT.t142Lizenz)
        && spalten >= 0 && m.indexOf('data-connect="fusszeile"') > m.indexOf(bereich(m, 'data-connect', 'spalten')) + bereich(m, 'data-connect', 'spalten').length - 1,
      `CN Fußzeile immer: T134, „Logordner öffnen“ und „Lizenzbedingungen“ in main nach beiden Spalten (${name})`,
    );
  }
  const q = QUELLE('views/ConnectOberflaeche.tsx');
  ok(/\n\s*<Fusszeile \/>\n/.test(q) && !/[&?|:]\s*<Fusszeile/.test(q) && !/\(\s*<Fusszeile/.test(q), 'CN Fußzeile immer: <Fusszeile /> steht ohne Bedingung im Rahmen (kein &&, kein ?:)');
  const f = QUELLE('views/Fusszeile.tsx');
  ok(!/useState|useEffect|\?|&&/.test(f.slice(f.indexOf('export function Fusszeile('))), 'CN Fußzeile immer: die Fußzeile selbst hat keine Bedingung und keinen Zustand (scrollt im Inhalt mit, nicht fixed)');
  ok(!/\bfixed\b|\bsticky\b/.test(f), 'CN Fußzeile immer: nicht fixed, nicht sticky (scrollt mit, Hinweis-Regel)');
}

// ── CN macOS nur links: eine Spalte, MAC_ZEILE unter dem Cloud-Raum, keine Zoom-Spalte (W2-5) ──
{
  const mac = rahmen(stand({ plattform: 'darwin', status: appStatus() }));
  const win = rahmen(stand({ plattform: 'win32', status: appStatus() }));
  const spaltenMac = bereich(mac, 'data-connect', 'spalten');
  const spaltenWin = bereich(win, 'data-connect', 'spalten');
  const cloudMac = bereich(spaltenMac, 'data-connect', 'cloud-raum');
  ok(
    !mac.includes('data-connect="zoom-spalte"') && !text(mac).includes('Zoom-Meeting') && /@\[56rem\]:grid-cols-2/.test(attr(tags(spaltenWin, 'div')[0], 'class') ?? '') && !/grid-cols-2/.test(attr(tags(spaltenMac, 'div')[0], 'class') ?? ''),
    'CN macOS nur links: unter macOS eine Spalte ohne Zoom-Spalte; unter Windows zwei Spalten ab 56rem (Container-Query, B19)',
  );
  const mz = bereich(cloudMac, 'data-connect', 'mac-zeile');
  ok(mz !== '' && text(mz) === MAC_ZEILE && cloudMac.indexOf('data-connect="mac-zeile"') > cloudMac.indexOf('data-connect="cloud"'), 'CN macOS nur links: MAC_ZEILE (T95) steht unter dem Cloud-Raum in der linken Spalte');
  ok(!win.includes('data-connect="mac-zeile"') && bereich(spaltenWin, 'data-connect', 'zoom-spalte').includes('Zoom-Meeting'), 'CN macOS nur links: unter Windows rechts die Zoom-Spalte mit der unveränderten ZoomCard, keine MAC_ZEILE');
  ok(spaltenWin.indexOf('data-connect="cloud-raum"') < spaltenWin.indexOf('data-connect="zoom-spalte"'), 'CN macOS nur links: links der Cloud-Raum, rechts Zoom (B19)');
  const q = QUELLE('views/ConnectOberflaeche.tsx');
  ok(q.includes("stand.plattform === 'win32'") && q.includes('{MAC_ZEILE}') && !Object.values({ q, a: QUELLE('views/CloudRaum.tsx') }).some((t) => t.includes(MAC_ZEILE)), 'CN macOS nur links: die Weiche liest stand.plattform; T95 kommt aus zoom-text.ts, nie als Literal');
}

// ── CN Raum bleibt: Raum-Client, Abos und Fernbefehle in der Wurzel-View; kein key und keine Bedingung hängt am Panel-Zustand ──
{
  const wurzel = QUELLE('views/ConnectOberflaeche.tsx');
  const andere = ['views/CloudRaum.tsx', 'views/Einstellungen.tsx', 'views/CloudZugang.tsx', 'views/Fusszeile.tsx', 'App.tsx'].map((d) => [d, QUELLE(d)] as const);
  const ABLAEUFE = [
    'new SignallingClient(',
    'window.jmconnect.getStatus()',
    'window.jmconnect.getShow()',
    'window.jmconnect.onShow(',
    'window.jmconnect.onStatus(',
    'window.jmconnect.onControlCommand(',
    'window.jmconnect.onTrayCommand(',
    'window.jmconnect.pushControlState(',
    'window.jmconnect.openRoom(',
    'window.jmconnect.closeRoom()',
    'window.jmconnect.getProxy()',
    'useBrueckenWert(MASTER_LINK_QUELLE)',
    'useBrueckenWert(FERNSTEUERUNG_QUELLE)',
  ];
  gleich(ABLAEUFE.filter((a) => !wurzel.includes(a)), [], 'CN Raum bleibt: Raum-Client, Abos, Fernbefehle, STATE und Brücken stehen in der Wurzel-View (ConnectOberflaeche)');
  gleich(andere.flatMap(([d, t]) => ABLAEUFE.filter((a) => t.includes(a)).map((a) => `${d}: ${a}`)), [], 'CN Raum bleibt: kein Ablauf in Spalte, Panel, Fußzeile oder App.tsx');
  const zeilen = wurzel.split('\n').filter((z) => /\bpanelOffen\b/.test(z)).map((z) => z.trim());
  ok(
    zeilen.length > 0 && zeilen.every((z) => /useState|settingsOpen=\{p\.panelOffen\}|panelOffen=\{panelOffen\}|panelOffen: boolean;|setPanelOffen\(offen\)/.test(z)),
    `CN Raum bleibt: der Panel-Zustand steht nur in useState und settingsOpen, an keiner Bedingung (${zeilen.length} Zeilen)`,
  );
  ok(!/\bkey=/.test(wurzel) && !/panelOffen\s*(?:&&|\?|===|!==)/.test(wurzel) && !/[!(]\s*panelOffen\b/.test(wurzel), 'CN Raum bleibt: kein key und keine Bedingung am Panel-Zustand in der Wurzel-View (die Spalten hängen sich beim Öffnen nicht aus)');
  const app = QUELLE('App.tsx');
  ok(/<ConnectOberflaeche \/>/.test(app) && !/useState|useEffect|useRef/.test(app), 'CN Raum bleibt: App.tsx rendert nur die Wurzel-View, ohne eigenen Zustand');
}

// ── CN keine rohen Farben: geänderte Dateien nur mit Tokens; ausgenommen nur das QR-Bild der Einladung (QrBild, B5) ──
{
  const roh = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow|accent)-(?:white|black|neutral|gray|grey|zinc|slate|stone|red|green|blue|yellow|amber|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b|#[0-9a-fA-F]{3,8}\b/;
  const dateien = ['App.tsx', 'main.tsx', 'globals.css', 'views/ConnectOberflaeche.tsx', 'views/CloudRaum.tsx', 'views/Fusszeile.tsx', 'views/Einstellungen.tsx', 'views/CloudZugang.tsx'];
  const QR = /\nfunction QrBild\([\s\S]*?\n}\n/;
  const ohneQr = (d: string, q: string): string => (d === 'views/CloudRaum.tsx' ? q.replace(QR, '\n') : q);
  gleich(dateien.filter((d) => roh.test(ohneQr(d, QUELLE(d)))), [], 'CN keine rohen Farben: keine rohen Farbklassen und Hex-Werte in den geänderten Dateien, nur Tokens (W2-9)');
  const qr = QR.exec(ROH('views/CloudRaum.tsx'))?.[0] ?? '';
  ok(qr.includes('bg-white') && qr.includes('<img'), 'CN keine rohen Farben: das QR-Bild der Einladung (QrBild) bleibt auf weißem Grund (B5, lib/qr.ts)');
  ok(roh.test('text-neutral-400') && roh.test('#121212') && !roh.test('text-[var(--muted-foreground)]'), 'CN keine rohen Farben: die Probe erkennt rohe Farben und lässt Tokens durch');
  const css = ROH('globals.css');
  ok(!css.includes('#121212') && !css.includes('system-ui, -apple-system'), 'CN keine rohen Farben: globals.css ohne den alten festen Hintergrund #121212 und ohne die alte Schrift');
}

// ── CN Rahmen Texte: kein ASCII-Anführungszeichen im gerenderten Text der Oberfläche ──
{
  const html = rahmen(offenerRaum(raum(['lobby', 'approved', 'onair'])), true);
  ok(!text(html).includes('"'), 'CN Rahmen Texte: kein ASCII-Anführungszeichen im gerenderten Text (Rahmen, Cloud-Raum, Panel)');
  enthaelt(text(html), REMOTE_TEXTE.titel, 'CN Rahmen Texte: das offene Panel zeigt den Abschnitt Fernsteuerung');
  const vorher = statusLeiste(stand());
  ok(vorher.every((i) => i.detail === UNBEKANNT), 'CN Rahmen Texte: vor der ersten Antwort liest jeder Statuseintrag „unbekannt“');
}

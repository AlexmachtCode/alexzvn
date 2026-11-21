// UX Welle 1, Switcher d1 · Einstellungs-Panel (Spec 3.6, 5.1, 6; E4, E5; Anhang A „Switcher“ › Einstellungen): vier gemeinsame
// Abschnitte aus @jm/settings (NDI-Ausgabe, Ausgabe auf Bildschirm, Fernsteuerung, Programm-Audio) mit den Props aus
// lib/oberflaeche.ts, dahinter die tool-eigenen Abschnitte „Streaming“, „Aufnahme“ und „Programm-Format“. Render ohne Browser.
import { REMOTE_TEXTE } from '@jm/settings';
import { enthaelt, gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { ABSCHNITT, statusLeiste, SWITCHER_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import { Einstellungen } from '@/views/Einstellungen';
import { attr, basisEinstellungen, basisStand, ohneKommentare, protokollAktionen, tags, text } from './testzustand';

function panel(stand: OberflaechenStand, log: string[] = []): string {
  return render(<Einstellungen stand={stand} aktionen={protokollAktionen(log)} />);
}
/** Der Abschnitt mit dem Anker einstellung-{id}: vom Anker bis zum nächsten Anker (bzw. bis zum Ende). */
function abschnitt(html: string, id: string): string {
  const a = html.indexOf(`id="einstellung-${id}"`);
  if (a < 0) return '';
  const b = html.indexOf('id="einstellung-', a + 1);
  return html.slice(a, b < 0 ? undefined : b);
}
const titel = (html: string): string[] => [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);

// ── Anker und Reihenfolge ──
{
  const log: string[] = [];
  const stand = basisStand();
  const html = panel(stand, log);
  const ids = Object.values(ABSCHNITT);
  gleich(
    ids.filter((id) => !html.includes(`id="einstellung-${id}"`)),
    [],
    'SW Panel Abschnitte: Anker einstellung-<id> für alle sieben ABSCHNITT-Werte',
  );
  gleich(
    [...html.matchAll(/id="einstellung-([a-z]+)"/g)].map((m) => m[1]),
    ['ndi', 'bildschirm', 'fernsteuerung', 'audio', 'streaming', 'aufnahme', 'format'],
    'SW Panel Abschnitte: Reihenfolge NDI, Bildschirm, Fernsteuerung, Audio, dann Streaming, Aufnahme, Programm-Format (Anhang A)',
  );
  gleich(
    titel(html).slice(-3),
    [SWITCHER_TEXTE.titel.streaming, SWITCHER_TEXTE.titel.aufnahme, SWITCHER_TEXTE.titel.format],
    'SW Panel Abschnitte: Die tool-eigenen Titel heißen Streaming, Aufnahme, Programm-Format',
  );
  const ziele = statusLeiste(stand)
    .map((i) => i.settingsSection)
    .filter((z): z is string => typeof z === 'string');
  gleich(
    ziele.filter((z) => !html.includes(`id="einstellung-${z}"`)),
    [],
    'SW Panel Abschnitte: Jeder Statuseintrag mit Abschnitt findet seinen Anker (E14)',
  );
  pruefeIdVerweise(html, 'SW Panel Abschnitte: id-Verweise gültig (Beschriftungen, Hinweise, Sperrgründe)');
  gleich(log, [], 'SW Panel Abschnitte: Rendern löst keine Aktion aus');
  ok(!html.includes('"Streaming (RTMP)"') && !text(html).includes('NDI-Ausgabe & Programm-Format'), 'SW Panel Abschnitte: die alten Kartentitel sind weg');
}

// ── Port-Feld nur hier ──
{
  const html = panel(basisStand());
  const fern = abschnitt(html, ABSCHNITT.fernsteuerung);
  ok(text(fern).includes(REMOTE_TEXTE.port) && tags(fern, 'input').length > 0, 'SW Panel Abschnitte: Das Port-Feld steht in der Fernsteuerung des Panels');
  const aus = panel(basisStand({ settings: basisEinstellungen({ controlEnabled: false }) }));
  ok(abschnitt(aus, ABSCHNITT.fernsteuerung).length > 0, 'SW Panel Abschnitte: Die Fernsteuerung bleibt auch ausgeschaltet im Panel (Schalter)');
  const view = ohneKommentare(leseText('src/renderer/src/views/SwitcherView.tsx'));
  ok(!view.includes('REMOTE_TEXTE') && !/controlPort[^;\n]*onChange/.test(view), 'SW Panel Abschnitte: Der Mischer hat kein eigenes Port-Feld');
  ok(!ohneKommentare(leseText('src/renderer/src/App.tsx')).includes('SettingsView'), 'SW Panel Abschnitte: Es gibt keinen Reiter „Einstellungen“ mehr');
}

// ── Tool-eigene Abschnitte: Felder und Hinweise wie heute (Texte wörtlich) ──
{
  const s = basisEinstellungen({ rtmpUrl: 'rtmp://live.example/app/key', streamBitrateKbps: 4500, recordBitrateKbps: 16000, programResolution: '1080p', outputFps: 30 });
  const html = panel(basisStand({ settings: s }));
  const stream = abschnitt(html, ABSCHNITT.streaming);
  enthaelt(stream, 'value="rtmp://live.example/app/key"', 'SW Panel Streaming: Das RTMP-Ziel steht im Feld');
  const t = text(stream);
  ok(
    t.includes('RTMP-Ziel') && t.includes('Vollständige URL inkl. Streamkey (z. B. YouTube-/Twitch-Ingest oder lokaler nginx-rtmp).'),
    'SW Panel Streaming: Beschriftung und Hinweis des RTMP-Ziels wörtlich wie heute',
  );
  ok(
    t.includes('Stream-Bitrate') && t.includes('Video-Bitrate des H.264-Streams (x264). Empfohlen für Full-HD 1080p: 6.000–12.000 kbit/s.'),
    'SW Panel Streaming: Stream-Bitrate mit Empfehlung für 1080p (6.000–12.000 kbit/s)',
  );
  const hd = text(abschnitt(panel(basisStand({ settings: basisEinstellungen({ programResolution: '720p' }) })), ABSCHNITT.streaming));
  ok(hd.includes('Empfohlen für HD 720p: 3.000–6.000 kbit/s.'), 'SW Panel Streaming: Empfehlung folgt der Auflösung (720p)');
  ok(t.includes('1920×1080 @ 30 fps') && t.includes('stille AAC-Spur (keine Audioquelle gewählt)'), 'SW Panel Streaming: Auflösung, Bildrate und Ton im Hinweis');
  const mitTon = text(abschnitt(panel(basisStand({ settings: basisEinstellungen({ audioInputId: 'mic1' }) })), ABSCHNITT.streaming));
  ok(mitTon.includes('Programm-Ton der gewählten Audioquelle'), 'SW Panel Streaming: mit Audioquelle steht „Programm-Ton der gewählten Audioquelle“');

  const aufnahme = text(abschnitt(html, ABSCHNITT.aufnahme));
  ok(
    aufnahme.includes('Aufnahme-Bitrate') &&
      aufnahme.includes('Video-Bitrate der WebM-Aufnahme. Empfohlen für Full-HD 1080p: 16.000–32.000 kbit/s.') &&
      aufnahme.includes('Aufnahmen werden als WebM gespeichert (Speicherort wird beim Start abgefragt). Für MP4 die Datei im JM Media Converter umwandeln.'),
    'SW Panel Aufnahme: Bitrate mit Empfehlung und Hinweis zu WebM wörtlich wie heute',
  );

  const formatHtml = abschnitt(html, ABSCHNITT.format);
  const f = text(formatHtml);
  ok(
    f.includes('NDI-Quelle') && f.includes('Programm-Auflösung') && f.includes('Ausgabe-Bildrate'),
    'SW Panel Format: NDI-Quelle, Programm-Auflösung und Ausgabe-Bildrate (E5)',
  );
  const optionen = [...formatHtml.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]);
  gleich(
    optionen,
    ['Program', 'Multiview', 'HD 720p (1280×720)', 'Full-HD 1080p (1920×1080)', '25 fps', '30 fps', '50 fps', '60 fps'],
    'SW Panel Format: Optionen der NDI-Quelle, Auflösung und Bildrate wie heute',
  );
  ok(
    f.includes('Eine geänderte Bildrate greift, sobald weder Aufnahme noch Sendung läuft — solange eine von beiden läuft, behält auch eine neu gestartete zweite Ausgabe die bisherige Rate.') &&
      f.includes('Auflösung und Bildrate gelten für alle Ausgaben — NDI, Aufnahme, RTMP und den zweiten Bildschirm.') &&
      f.includes('Das Multiview bleibt 720p und zeigt Program + Preview groß plus alle Szenen als Kacheln mit Tally.'),
    'SW Panel Format: die Hinweistexte zu Bildrate, Auflösung und Multiview wörtlich wie heute',
  );
  const selects = tags(formatHtml, 'select');
  ok(selects.length === 3, 'SW Panel Format: drei Auswahlfelder');
  ok(/<option value="1080p" selected/.test(formatHtml) || /<option[^>]*value="1080p"[^>]*selected/.test(formatHtml), 'SW Panel Format: die gewählte Auflösung ist markiert');
  const ndi = abschnitt(html, ABSCHNITT.ndi);
  ok(!ndi.includes('<select') && !text(ndi).includes('Multiview'), 'SW Panel Format: Der NDI-Abschnitt hat nur Schalter und Name, die Quellwahl liegt im Programm-Format (E5)');
  ok(attr(tags(ndi, 'input').find((t) => attr(t, 'type') === 'text'), 'value') === 'JM Switcher', 'SW Panel Format: Der NDI-Abschnitt zeigt den Namen als Feld');
}

// ── Messwerte aus dem Rahmen ──
{
  const ohne = panel(basisStand({ displays: undefined, audioGeraete: undefined }));
  ok(
    text(abschnitt(ohne, ABSCHNITT.bildschirm)).includes('Bildschirmunbekannt') && text(abschnitt(ohne, ABSCHNITT.audio)).includes('Programm-Audiounbekannt'),
    'SW Panel Abschnitte: Ohne Monitorliste und Geräteliste zeigt das Panel „unbekannt“, nie eine leere Liste (E4)',
  );
  const mit = panel(basisStand());
  ok(text(abschnitt(mit, ABSCHNITT.audio)).includes('Mikrofon 1'), 'SW Panel Abschnitte: Die gemessene Geräteliste steht in der Audiowahl');
  ok(text(abschnitt(mit, ABSCHNITT.bildschirm)).includes('2560×1440'), 'SW Panel Abschnitte: Die gemessene Monitorliste steht in der Bildschirmwahl');
}

// ── Quelltext ──
{
  const quelle = leseText('src/renderer/src/views/Einstellungen.tsx');
  const code = ohneKommentare(quelle);
  ok(!/\buseEffect\b/.test(code), 'SW Panel keine Effekte: views/Einstellungen.tsx ohne useEffect (G7, G8)');
  ok(!/\bwindow\b|\blocalStorage\b|\bjmswitch\b/.test(code), 'SW Panel keine Effekte: views/Einstellungen.tsx ohne window, localStorage und IPC');
  ok(
    ['NdiOutputSection', 'ScreenOutputSection', 'RemoteControlSection', 'AudioDeviceSection', 'ndiAbschnitt(', 'bildschirmAbschnitt(', 'fernsteuerungAbschnitt(', 'audioAbschnitt('].every((z) => code.includes(z)),
    'SW Panel Abschnitte: Die vier gemeinsamen Abschnitte kommen aus @jm/settings mit den Ableitungen aus lib/oberflaeche.ts',
  );
  ok(
    ['ABSCHNITT.streaming', 'ABSCHNITT.aufnahme', 'ABSCHNITT.format'].every((z) => code.includes(`PanelAnker id={${z}}`)),
    'SW Panel Abschnitte: die tool-eigenen Abschnitte sind PanelAnker mit den ABSCHNITT-ids',
  );
}

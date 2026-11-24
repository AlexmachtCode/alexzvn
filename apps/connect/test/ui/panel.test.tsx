// UX Welle 2b, Connect d1 · Panel-Grundstock (B8, B20; Muster d): die Abschnitte „Fernsteuerung“ (RemoteControlSection, Port 8737)
// und „Cloud-Zugang“ (heutige CloudZugangKarte als Panel-Abschnitt ohne Effekt). Die Adresse liest die Wurzel-View über getProxy
// und reicht sie als proxyAdresse herein; Speichern und „Key entfernen“ gehen als Aktionen an die Wurzel-View. Die Karte steht
// nicht mehr im Live-Bereich. Render ohne Browser; Speichern über die reine Funktion speichern.
import { REMOTE_TEXTE } from '@jm/settings';
import { UNBEKANNT } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { ZUGANG_TEXT } from '../../src/main/zugang/regeln';
import { ABSCHNITT, CONNECT_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import { CloudZugang, speichern } from '@/views/CloudZugang';
import { ConnectRahmen } from '@/views/ConnectOberflaeche';
import { Einstellungen } from '@/views/Einstellungen';
import { abschnitt, aktionenAttrappe, appStatus, attr, basisMeldung, knopfTexte, ohneKommentare, offenerRaum, raum, stand, statusEintraege, tags, text } from './testzustand';

const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));

function rahmen(s: OberflaechenStand, panelOffen: boolean): string {
  return render(
    <ConnectRahmen stand={s} show={null} error={null} invites={[]} guestName="" aktionen={aktionenAttrappe()} proxyAdresse="https://cloud.example" panelOffen={panelOffen} onPanel={() => undefined} />,
  );
}
const panel = (html: string): string => html.match(/<aside[\s\S]*<\/aside>/)?.[0] ?? '';
const inhalt = (html: string): string => html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';

// ── CN Panel Fernsteuerung und Cloud: Anker fernsteuerung und cloud; „Key entfernen“ und Adresse wie heute; nicht mehr im Live-Bereich ──
{
  const s = stand({ status: appStatus({ proxyKeySource: 'stored', cloudZugang: { text: 'Cloud-Zugang über den alten Proxy-Key (Übergang).', ton: 'warn' } }), room: null, fernsteuerung: basisMeldung({ clients: 2 }) });
  const offen = rahmen(s, true);
  const p = panel(offen);
  const ids = [...p.matchAll(/id="einstellung-([^"]+)"/g)].map((m) => m[1]);
  gleich(ids, [ABSCHNITT.fernsteuerung, ABSCHNITT.cloud], 'CN Panel Fernsteuerung und Cloud: Anker einstellung-fernsteuerung und einstellung-cloud-zugang, in dieser Reihenfolge (B20)');
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

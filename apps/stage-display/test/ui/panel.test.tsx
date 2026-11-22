// UX Welle 2a, Stage-Display d · Einstellungs-Panel (Spec 3.6, 6; E3, E12, E15): Ausgabe auf Bildschirm und Gegenstellen aus
// @jm/settings, dahinter „Presenter-Kopplung“ (PIN, Anzeige). Jeder Statuseintrag mit Abschnitt findet seinen Anker. Die Aktionen
// laufen über lib/aktionen.ts mit Attrappen. Render ohne Browser.
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import type { PartialStageConfig } from '@shared/types';
import { baueAktionen, type OberflaechenAktionen } from '@/lib/aktionen';
import { ABSCHNITT, bildschirmEtikett, statusLeiste, STAGE_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import { Einstellungen } from '@/views/Einstellungen';
import { abschnitt, attr, ohneKommentare, stageZustand, tags, text } from './testzustand';

const T = STAGE_TEXTE;
const stand = (z: Partial<OberflaechenStand> = {}): OberflaechenStand => ({ stage: stageZustand(), ausgabe: undefined, masterLink: undefined, ...z });
function fake(log: string[] = [], outputDisplayId: number | null = null): OberflaechenAktionen {
  return baueAktionen({
    outputDisplayId,
    setConfig: async (p: PartialStageConfig) => void log.push(`setConfig${JSON.stringify(p)}`),
    openOutput: async (id) => void log.push(`open${id}`),
    closeOutput: async () => void log.push('close'),
  });
}
const panel = (s: OberflaechenStand, log: string[] = []): string => render(<Einstellungen stand={s} aktionen={fake(log)} />);
const titel = (html: string): string[] => [...html.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
const schalter = (html: string): string[] => tags(html, 'button').filter((t) => attr(t, 'role') === 'switch').map((t) => attr(t, 'aria-checked') ?? '');

// ── SD Panel Abschnitte: Anker und Reihenfolge ──
{
  const log: string[] = [];
  const s = stand();
  const html = panel(s, log);
  gleich(Object.values(ABSCHNITT).filter((id) => !html.includes(`id="einstellung-${id}"`)), [], 'SD Panel Abschnitte: Anker für alle ABSCHNITT-Werte (ausgabe, quellen, presenter)');
  gleich(titel(html), ['Ausgabe auf Bildschirm', 'Gegenstellen', T.kopplung.titel], 'SD Panel Abschnitte: Ausgabe auf Bildschirm, Gegenstellen, dann Presenter-Kopplung');
  const ziele = statusLeiste(s).map((i) => i.settingsSection).filter((z): z is string => typeof z === 'string');
  gleich(ziele.filter((z) => !html.includes(`id="einstellung-${z}"`)), [], 'SD Panel Abschnitte: jeder Statuseintrag mit Abschnitt findet seinen Anker');
  pruefeIdVerweise(html, 'SD Panel Abschnitte: id-Verweise gültig');
  gleich(log, [], 'SD Panel Abschnitte: Rendern löst keine Aktion aus');
  ok(!text(html).includes('"'), 'SD Panel Abschnitte: kein ASCII-Anführungszeichen in den Texten des Panels');
  ok(!html.includes('data-stage="verschieben"') && !text(html).includes('Vollbild') && !text(html).includes('Hintergrund'), 'SD Panel Abschnitte: kein Vollbild- und kein Hintergrundfeld, kein Verschieben ohne Fenster');
}

// ── Ausgabe (E3, E15: ohne Effekte) ──
{
  const aus = (z: AusgabeZustand | null | undefined, b?: OberflaechenStand['bildschirme']): string => abschnitt(panel(stand({ ausgabe: z, bildschirme: b })), ABSCHNITT.ausgabe);
  const zu = aus({ art: 'zu', displayId: null });
  const offen = aus({ art: 'offen', displayId: 1 }, [{ id: 1, label: 'Bühne (1920×1080)', primary: false }]);
  gleich([schalter(zu), schalter(offen)], [['false'], ['true']], 'SD Panel Abschnitte: der Ausgabeschalter folgt dem gemessenen Zustand (zu = aus, offen = an)');
  ok(text(offen).includes('Bühne (1920×1080)'), 'SD Panel Abschnitte: die frisch geholte Bildschirmliste steht in der Auswahl');
  const q = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(!q.includes('useEffect') && !/\bwindow\b/.test(q) && !q.includes('useStage') && !q.includes('jmstage'), 'SD Panel Abschnitte: Einstellungen.tsx ohne window, ohne useEffect und ohne Store (E15)');
}

// ── Gegenstellen (E12) ──
{
  const state = stageZustand({ config: { timer: { enabled: true, host: '10.0.0.4', port: 7777 }, presenter: { enabled: true, host: '127.0.0.1', port: 7330, pin: '', mode: 'ref' } }, verbunden: [true, false, false] });
  const html = panel(stand({ stage: state }));
  const q = abschnitt(html, ABSCHNITT.quellen);
  gleich(schalter(q), ['true', 'false', 'true'], 'SD Panel Abschnitte: Gegenstellen mit Ein/Aus je Quelle (Timer, Switcher, Presenter) aus der Konfiguration');
  ok(['JM Timer', 'JM Switcher', 'JM Presenter'].every((n) => text(q).includes(n)), 'SD Panel Abschnitte: die drei Quellen heißen wie bisher');
  ok(text(q).includes('verbunden') && !text(q).includes('manuell') && !text(q).includes('Auto'), 'SD Panel Abschnitte: die Zeile zeigt nur verbunden oder aus, nie „manuell“ oder „Auto“');
  ok(
    [T.quellenHinweis.timer, T.quellenHinweis.switcher, T.quellenHinweis.presenter].every((h) => text(html).includes(h)) &&
      T.quellenHinweis.timer === 'Countdown · Programmpunkt · Nachricht (Port 7777)' &&
      T.quellenHinweis.switcher === 'Program/Preview · REC/Stream (Companion-Port)' &&
      T.quellenHinweis.presenter === 'Referentenansicht: Folie · Notizen · Nächste (Fernsteuerung im Presenter aktivieren, Port 7330)',
    'SD Panel Abschnitte: die drei Quellen-Hinweise stehen mit altem Wortlaut im Panel',
  );
}

// ── Presenter-Kopplung ──
{
  const state = stageZustand({ config: { presenter: { enabled: true, host: 'h', port: 7330, pin: '1234', mode: 'main' } } });
  const html = panel(stand({ stage: state }));
  const k = abschnitt(html, ABSCHNITT.presenter);
  const [pin] = tags(k, 'input');
  gleich(
    [attr(pin, 'value'), attr(pin, 'placeholder'), attr(pin, 'inputMode'), attr(pin, 'title')],
    ['1234', 'PIN', 'numeric', 'PIN nur falls die Presenter-Fernsteuerung mit PIN läuft — sonst leer lassen'],
    'SD Panel Abschnitte: das PIN-Feld trägt Platzhalter „PIN“, Zifferntastatur und den alten Tooltip',
  );
  ok(text(k).includes('PIN nur falls die Presenter-Fernsteuerung mit PIN läuft — sonst leer lassen'), 'SD Panel Abschnitte: die Hinweiszeile zur PIN steht da');
  const modi = tags(k, 'button').filter((t) => attr(t, 'aria-pressed') !== undefined);
  gleich(modi.map((t) => attr(t, 'aria-pressed')), ['false', 'true'], 'SD Panel Abschnitte: Anzeige Referenz/Haupt als Knopfpaar mit aria-pressed, der gewählte Modus ist gedrückt');
  ok(['Anzeige', 'Referenzansicht', 'Hauptansicht', 'Folienbild erscheint, sobald eine Präsentation läuft'].every((w) => text(k).includes(w)), 'SD Panel Abschnitte: Beschriftungen der Anzeige wie bisher');
  const ohne = abschnitt(panel(stand({ stage: undefined })), ABSCHNITT.presenter);
  ok(!ohne.includes('<input') && text(ohne).includes('unbekannt'), 'SD Panel Abschnitte: ohne Zustand steht „unbekannt“ und kein erfundener Wert');
}

// ── Verschieben: nur bei gemessen existierendem Fenster, mit dem alten Wortlaut ──
{
  const knopf = (z: AusgabeZustand | null | undefined): string[] => tags(panel(stand({ ausgabe: z })), 'button').filter((t) => attr(t, 'data-stage') === 'verschieben').map(() => 'da');
  gleich(
    [knopf(undefined), knopf(null), knopf({ art: 'zu', displayId: null }), knopf({ art: 'abgestuerzt', displayId: 1 }), knopf({ art: 'offen', displayId: 1 }), knopf({ art: 'bildschirm-fehlt', displayId: 5 })],
    [[], [], [], [], ['da'], ['da']],
    'SD Panel Abschnitte: der Knopf „Auf diesen Bildschirm“ steht nur bei offenem oder fehlendem Bildschirm, nicht bei zu, abgestürzt oder unbekannt',
  );
  ok(text(panel(stand({ ausgabe: { art: 'offen', displayId: 1 } }))).includes('Auf diesen Bildschirm'), 'SD Panel Abschnitte: der Knopf trägt den alten Wortlaut „Auf diesen Bildschirm“');
  ok(ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx')).includes('onClick={aktionen.ausgabeVerschieben}'), 'SD Panel Abschnitte: der Knopf ruft die Aktion ausgabeVerschieben');
  gleich(
    [bildschirmEtikett({ label: 'Display 1', primary: true, width: 1920, height: 1080 }), bildschirmEtikett({ label: 'Bühne', primary: false, width: 1280, height: 720 })],
    ['Display 1 · primär (1920×1080)', 'Bühne (1280×720)'],
    'SD Panel Abschnitte: Etikett der Bildschirmauswahl wie bisher, primärer Bildschirm mit „ · primär“',
  );
}

// ── Aktionen: Verdrahtung mit Attrappen ──
{
  const log: string[] = [];
  const a = fake(log, 2);
  a.bildschirmWaehlen(3);
  gleich(log, ['setConfig{"outputDisplayId":3}'], 'SD Aktionen: eine Bildschirmwahl ruft nur setConfig und öffnet oder verschiebt kein Fenster');
  log.length = 0;
  a.bildschirmWaehlen(null);
  gleich(log, ['setConfig{"outputDisplayId":null}'], 'SD Aktionen: „Automatisch“ speichert null');
  log.length = 0;
  a.ausgabeVerschieben();
  a.ausgabeUmschalten(true);
  a.ausgabeUmschalten(false);
  gleich(log, ['open2', 'open2', 'close'], 'SD Aktionen: „Auf diesen Bildschirm“ und das Öffnen nutzen den gewählten Bildschirm, aus schließt');
  log.length = 0;
  fake(log, null).ausgabeUmschalten(true);
  gleich(log, ['openundefined'], 'SD Aktionen: ohne gewählten Bildschirm öffnet der Aufruf ohne Kennung (primär), wie bisher');
  log.length = 0;
  a.quelleSchalten('timer', true);
  a.quelleSchalten('presenter', false);
  a.quelleSchalten('unbekannt', true);
  gleich(log, ['setConfig{"timer":{"enabled":true}}', 'setConfig{"presenter":{"enabled":false}}'], 'SD Aktionen: Quelle ein/aus schreibt enabled der Rolle, eine fremde Rolle nichts');
  log.length = 0;
  a.quelleSetzen('switcher', '10.1.1.1', 8723);
  gleich(log, ['setConfig{"switcher":{"host":"10.1.1.1","port":8723}}'], 'SD Aktionen: Host und Port einer Quelle werden zusammen gesetzt');
  log.length = 0;
  a.nachricht('Pause');
  a.widget('presenter', false);
  gleich(log, ['setConfig{"message":"Pause"}', 'setConfig{"widgets":{"presenter":false}}'], 'SD Aktionen: Nachricht (jeder Tastendruck) und Anzeige-Element schreiben sofort');
  log.length = 0;
  a.pin('12a3-4567890');
  a.modus('main');
  gleich(log, ['setConfig{"presenter":{"pin":"12345678"}}', 'setConfig{"presenter":{"mode":"main"}}'], 'SD Aktionen: PIN nur Ziffern, höchstens 8 Zeichen; Modus schreibt presenter.mode');
}

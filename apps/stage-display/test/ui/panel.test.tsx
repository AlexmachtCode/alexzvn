// UX Welle 2a, Stage-Display d · Einstellungs-Panel (Spec 3.6, 6; E3, E12, E15): Ausgabe auf Bildschirm und Gegenstellen aus
// @jm/settings, dahinter „Presenter-Kopplung“ (PIN, Anzeige). Jeder Statuseintrag mit Abschnitt findet seinen Anker. Die Aktionen
// laufen über lib/aktionen.ts mit Attrappen. Render ohne Browser.
import { PEERS_TEXTE, SCREEN_TEXTE } from '@jm/settings';
import { Button, TextInput } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import type { AusgabeZustand } from '@jm/output-window/zustand';
import type { PartialStageConfig } from '@shared/types';
import { PinFeld, PinFeldAnsicht } from '@/components/PinFeld';
import * as aktionenModul from '@/lib/aktionen';
import { baueAktionen, type OberflaechenAktionen } from '@/lib/aktionen';
import { ABSCHNITT, bildschirmEtikett, statusLeiste, STAGE_TEXTE, type OberflaechenStand } from '@/lib/oberflaeche';
import { Einstellungen } from '@/views/Einstellungen';
import { abschnitt, attr, elemente, ohneKommentare, stageZustand, tags, text } from './testzustand';

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
  gleich(Object.values(ABSCHNITT).filter((id) => id !== ABSCHNITT.presenter && !html.includes(`id="einstellung-${id}"`)), [], 'SD Panel Abschnitte: Anker für ausgabe und quellen');
  gleich(titel(html), ['Ausgabe auf Bildschirm', 'Gegenstellen'], 'SD Panel Abschnitte: bei ausgeschaltetem Presenter nur Ausgabe auf Bildschirm und Gegenstellen');
  const mitPresenter = panel(stand({ stage: stageZustand({ config: { presenter: { enabled: true, host: 'h', port: 7330, pin: '', mode: 'ref' } } }) }));
  gleich(titel(mitPresenter), ['Ausgabe auf Bildschirm', 'Gegenstellen', T.kopplung.titel], 'SD Panel Abschnitte: bei eingeschaltetem Presenter folgt Presenter-Kopplung');
  gleich(Object.values(ABSCHNITT).filter((id) => !mitPresenter.includes(`id="einstellung-${id}"`)), [], 'SD Panel Abschnitte: Anker für alle ABSCHNITT-Werte (ausgabe, quellen, presenter)');
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
  // Nur die Knöpfe der Gruppe „Anzeige“: „Anzeigen“ am PIN-Feld trägt seit Altfehler SD-5 ebenfalls aria-pressed.
  const modi = tags(k.slice(k.indexOf('data-stage="modus"')), 'button').filter((t) => attr(t, 'aria-pressed') !== undefined);
  gleich(modi.map((t) => attr(t, 'aria-pressed')), ['false', 'true'], 'SD Panel Abschnitte: Anzeige Referenz/Haupt als Knopfpaar mit aria-pressed, der gewählte Modus ist gedrückt');
  ok(['Anzeige', 'Referenzansicht', 'Hauptansicht', 'Folienbild erscheint, sobald eine Präsentation läuft'].every((w) => text(k).includes(w)), 'SD Panel Abschnitte: Beschriftungen der Anzeige wie bisher');
  for (const [name, st] of [['ohne Zustand', undefined], ['Presenter aus', stageZustand()]] as const) {
    const h = panel(stand({ stage: st }));
    ok(!text(h).includes(T.kopplung.titel) && !text(h).includes('Referenzansicht') && !text(h).includes('Folienbild erscheint') && !tags(h, 'input').some((t) => attr(t, 'placeholder') === 'PIN') && !h.includes(`id="einstellung-${ABSCHNITT.presenter}"`),
      `SD Panel Abschnitte: ${name}: keine Presenter-Kopplung, kein PIN-Feld, keine Referenzansicht`);
  }
  ok(text(html).includes(T.kopplung.titel) && text(html).includes('Referenzansicht') && tags(html, 'input').some((t) => attr(t, 'placeholder') === 'PIN'), 'SD Panel Abschnitte: Presenter an: Presenter-Kopplung, PIN-Feld und Referenzansicht stehen da');
}

// ── SD-5 (Altfehler Stufe 2): die PIN steht verdeckt im Feld, „Anzeigen“ zeigt sie, sie gilt erst mit „Setzen“ (kein Enter) ──
{
  const log: string[] = [];
  const ansicht = (sichtbar: boolean): ReturnType<typeof elemente> =>
    elemente(
      PinFeldAnsicht({ entwurf: '1234', sichtbar, onTippen: (t) => void log.push(`tippen:${t}`), onAnzeigen: () => void log.push('anzeigen'), onSetzen: () => void log.push('setzen') }),
    );
  const feld = (baum: ReturnType<typeof elemente>) => baum.find((e) => e.type === TextInput);
  const knopf = (baum: ReturnType<typeof elemente>, beschriftung: string) => baum.find((e) => e.type === Button && e.props.children === beschriftung);
  const zu = ansicht(false);
  const auf = ansicht(true);
  gleich([feld(zu)?.props.type, feld(auf)?.props.type], ['password', 'text'], 'SD-5 PinFeldAnsicht verdeckt: das Feld ist ein Passwortfeld, mit „Anzeigen“ ein Textfeld');
  gleich(
    [knopf(zu, 'Anzeigen')?.props['aria-pressed'], knopf(auf, 'Verbergen')?.props['aria-pressed'], knopf(zu, 'Verbergen'), knopf(auf, 'Anzeigen')],
    [false, true, undefined, undefined],
    'SD-5 PinFeldAnsicht verdeckt: der Knopf heißt verdeckt „Anzeigen“ (aria-pressed false), sichtbar „Verbergen“ (aria-pressed true)',
  );
  const f = feld(zu)?.props ?? {};
  gleich(
    [f.value, f.inputMode, f.autoComplete, f.placeholder, f.title, f.onKeyDown],
    ['1234', 'numeric', 'off', 'PIN', 'PIN nur falls die Presenter-Fernsteuerung mit PIN läuft — sonst leer lassen', undefined],
    'SD-5 PinFeldAnsicht: Entwurf im Feld, Zifferntastatur, ohne Autovervollständigen, Platzhalter und Tooltip wie bisher, kein Tastenhörer',
  );
  (f.onChange as ((t: string) => void) | undefined)?.('9');
  const nachTippen = [...log];
  (knopf(zu, PEERS_TEXTE.setzen)?.props.onClick as (() => void) | undefined)?.();
  gleich([nachTippen, log], [['tippen:9'], ['tippen:9', 'setzen']], 'SD-5 Tippen setzt nicht: onChange ruft nur onTippen; „Setzen“ ruft onSetzen genau einmal');
  log.length = 0;
  (knopf(zu, 'Anzeigen')?.props.onClick as (() => void) | undefined)?.();
  gleich(log, ['anzeigen'], 'SD-5 PinFeldAnsicht: „Anzeigen“ ruft onAnzeigen');
  gleich(
    [knopf(zu, PEERS_TEXTE.setzen)?.props.type, knopf(zu, 'Anzeigen')?.props.type, T.kopplung.anzeigen, T.kopplung.verbergen, PEERS_TEXTE.setzen],
    ['button', 'button', 'Anzeigen', 'Verbergen', 'Setzen'],
    'SD-5 PinFeldAnsicht: zwei Knöpfe vom Typ button; „Anzeigen“ und „Verbergen“ stehen in STAGE_TEXTE.kopplung, „Setzen“ kommt aus PEERS_TEXTE (D7)',
  );
}
{
  // Verdrahtung: das Panel zeigt die PIN verdeckt mit „Anzeigen“ und „Setzen“; das PinFeld bekommt die gemerkte PIN und aktionen.pin.
  const log: string[] = [];
  const a = fake(log);
  const s = stand({ stage: stageZustand({ config: { presenter: { enabled: true, host: 'h', port: 7330, pin: '1234', mode: 'ref' } } }) });
  const k = abschnitt(render(<Einstellungen stand={s} aktionen={a} />), ABSCHNITT.presenter);
  const [pin] = tags(k, 'input');
  ok(
    attr(pin, 'type') === 'password' && /<button[^>]*>Anzeigen<\/button>/.test(k) && /<button[^>]*>Setzen<\/button>/.test(k),
    'SD-5 Einstellungen verdrahtet: im Abschnitt Presenter-Kopplung steht das PIN-Feld als type="password" mit den Knöpfen „Anzeigen“ und „Setzen“',
  );
  const felder = elemente(Einstellungen({ stand: s, aktionen: a })).filter((e) => e.type === PinFeld);
  ok(felder.length === 1 && felder[0].props.wert === '1234' && felder[0].props.setzen === a.pin, 'SD-5 Einstellungen verdrahtet: genau ein PinFeld mit wert = presenter.pin und setzen = aktionen.pin');
  gleich(log, [], 'SD-5 Einstellungen verdrahtet: Rendern setzt keine PIN');
  const q = ohneKommentare(leseText('src/renderer/src/components/PinFeld.tsx'));
  ok(q.length > 0 && !/onKeyDown|keydown|addEventListener/.test(q), 'SD-5 Wächter: components/PinFeld.tsx hat keinen Tastenhörer (kein Enter, gilt erst mit „Setzen“)');
  ok(
    /useEffect\(\(\) => setEntwurf\(wert\), \[wert\]\);/.test(q) && q.includes('onSetzen={() => setzen(entwurf)}'),
    'SD-5 Wächter: PinFeld übernimmt eine neue PIN von außen in den Entwurf (wie PeerZeile) und „Setzen“ ruft setzen(entwurf)',
  );
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
  a.entwurf('Pause');
  a.senden('Pause');
  a.senden('');
  a.widget('presenter', false);
  gleich(
    log,
    ['setConfig{"nachrichtEntwurf":"Pause"}', 'setConfig{"message":"Pause"}', 'setConfig{"message":""}', 'setConfig{"widgets":{"presenter":false}}'],
    'SD-1 Aktionen: der Entwurf schreibt nur nachrichtEntwurf, Senden schreibt message (leer nimmt sie herunter, C6); Anzeige-Element schreibt sofort',
  );
  log.length = 0;
  a.pin('12a3-4567890');
  a.modus('main');
  gleich(log, ['setConfig{"presenter":{"pin":"12345678"}}', 'setConfig{"presenter":{"mode":"main"}}'], 'SD Aktionen: PIN nur Ziffern, höchstens 8 Zeichen; Modus schreibt presenter.mode');
}

// ── SD Ort aus der Messung (2a-Nachzug, UX Welle 2b; löst die Zeile data-stage="lage" aus Gesamtprüfung I3 ab): der Abschnitt
// „Ausgabe auf Bildschirm“ selbst nennt den gemessenen Bildschirm – die Pille und die Zeile „Steht auf“ aus @jm/settings –, nie den
// nur gewählten (Wahl ≠ Bewegung). Ohne gemessenen Ort (Bildschirm fehlt) keine Zeile „Steht auf“ ──
{
  const LISTE = [
    { id: 1, label: 'Regie · primär (1920×1080)', primary: true },
    { id: 2, label: 'Bühne (1920×1080)', primary: false },
    { id: 3, label: 'Foyer (1280×720)', primary: false },
  ];
  const s = (z: AusgabeZustand | null | undefined, b: OberflaechenStand['bildschirme'] | 'ohne' = LISTE): OberflaechenStand =>
    stand({ stage: stageZustand({ config: { outputDisplayId: 3 } }), ausgabe: z, ...(b === 'ohne' ? {} : { bildschirme: b }) });
  const aus = (st: OberflaechenStand): string => abschnitt(panel(st), ABSCHNITT.ausgabe);
  /** Wert der Zeile „Steht auf“ im Ausgabe-Abschnitt, sonst null. */
  const stehtAuf = (st: OberflaechenStand): string | null => {
    const t = text(aus(st));
    const i = t.indexOf(SCREEN_TEXTE.stehtAuf);
    return i < 0 ? null : t.slice(i + SCREEN_TEXTE.stehtAuf.length).trim();
  };
  const gemessen2 = s({ art: 'offen', displayId: 2 });
  ok((stehtAuf(gemessen2) ?? '').startsWith('Bühne (1920×1080)'), 'SD Ort aus der Messung: gemessen auf Bildschirm 2, Bildschirm 3 gewählt → „Steht auf“ nennt Bildschirm 2');
  ok(!(stehtAuf(gemessen2) ?? '').includes('Foyer') && text(aus(gemessen2)).includes('auf Bildschirm 2'), 'SD Ort aus der Messung: die Pille sagt „auf Bildschirm 2“, keine Zeile nennt den nur gewählten Bildschirm als Ort');
  gleich(
    [stehtAuf(s({ art: 'bildschirm-fehlt', displayId: 2 })), stehtAuf(s({ art: 'offen', displayId: 2 }, 'ohne')), stehtAuf(s({ art: 'offen', displayId: 9 }))],
    [null, null, null],
    'SD Ort aus der Messung: Bildschirm fehlt, Liste unbekannt oder gemessener Bildschirm nicht in der Liste → keine Zeile „Steht auf“, kein geratener Name',
  );
  ok(text(aus(s({ art: 'bildschirm-fehlt', displayId: 2 }))).includes('Bildschirm fehlt'), 'SD Ort aus der Messung: bei abgezogenem Bildschirm sagt die Pille „Bildschirm fehlt“');
  gleich(
    [stehtAuf(s(undefined)), stehtAuf(s(null)), stehtAuf(s({ art: 'zu', displayId: null })), stehtAuf(s({ art: 'abgestuerzt', displayId: 2 }))],
    [null, null, null, null],
    'SD Ort aus der Messung: keine Zeile „Steht auf“, solange kein Fenster gemessen offen ist (unbekannt, keine Brücke, zu, abgestürzt)',
  );
  const alle = [undefined, null, { art: 'zu', displayId: null }, { art: 'offen', displayId: 2 }, { art: 'bildschirm-fehlt', displayId: 2 }, { art: 'abgestuerzt', displayId: 2 }] as Array<AusgabeZustand | null | undefined>;
  ok(alle.every((z) => !panel(s(z)).includes('data-stage="lage"')), 'SD Ort aus der Messung: keine Zeile data-stage="lage" mehr');
  const q = ohneKommentare(leseText('src/renderer/src/views/Einstellungen.tsx'));
  ok(!q.includes('gemesseneLage') && !q.includes('data-stage="lage"'), 'SD Ort aus der Messung: Einstellungen.tsx nutzt gemesseneLage nicht mehr');
}

// ── Gesamtprüfung I3: die Bildschirmliste kommt beim Start, bei jedem Öffnen des Panels und bei jeder Änderung des Ausgabezustands
// frisch; ein Fehler setzt sie auf unbekannt zurück, nie die alte Liste ──
{
  const lies = (aktionenModul as Record<string, unknown>).liesBildschirme as
    | ((frage: (() => Promise<Array<{ id: number; label: string; primary: boolean; width: number; height: number }>>) | undefined, setze: (l: OberflaechenStand['bildschirme'] | undefined) => void) => () => void)
    | undefined;
  ok(typeof lies === 'function', 'SD Bildschirmliste: lib/aktionen.ts liest die Liste mit liesBildschirme');
  const werte: Array<OberflaechenStand['bildschirme'] | undefined> = [];
  if (typeof lies === 'function') {
    const setze = (l: OberflaechenStand['bildschirme'] | undefined): void => void werte.push(l);
    const liste = [
      { id: 1, label: 'Regie', primary: true, width: 1920, height: 1080 },
      { id: 2, label: 'Bühne', primary: false, width: 1280, height: 720 },
    ];
    lies(async () => liste, setze);
    lies(async () => Promise.reject(new Error('weg')), setze);
    lies(undefined, setze);
    const ab = lies(async () => liste, setze);
    ab();
    await new Promise((r) => setTimeout(r, 0));
  }
  gleich(
    werte,
    [
      [
        { id: 1, label: 'Regie · primär (1920×1080)', primary: true },
        { id: 2, label: 'Bühne (1280×720)', primary: false },
      ],
      undefined,
    ],
    'SD Bildschirmliste: die Antwort kommt mit dem Etikett „Name[ · primär] (B×H)“; ein Fehler ergibt unbekannt (undefined), nie die alte Liste; ohne Preload nichts; eine überholte Antwort wird verworfen',
  );
  const ober = ohneKommentare(leseText('src/renderer/src/views/StageOberflaeche.tsx'));
  ok(
    ober.includes('useEffect(() => liesBildschirme(window.jmstage?.output?.displays, setBildschirme), [ausgabe]);') &&
      /useEffect\(\(\) => \{\s*if \(!panelOffen\) return undefined;\s*return liesBildschirme\(window\.jmstage\?\.output\?\.displays, setBildschirme\);\s*\}, \[panelOffen\]\);/.test(ober),
    'SD Bildschirmliste: die View holt die Liste beim Start und bei jeder Änderung des Ausgabezustands ([ausgabe]) und bei jedem Öffnen des Panels',
  );
}

// ── SD Bildschirmliste folgt dem Ereignis (UX Welle 2b, Task 4; Review Focus 5): folgeBildschirmen meldet sich am Bildschirm-Ereignis
// an und liest bei jedem Ereignis die Liste neu (liesBildschirme); ohne Brücke nichts; die Abmeldung wirkt, auch auf eine Antwort,
// die danach noch eintrifft; eine ältere Antwort überschreibt keine neuere ──
{
  type Liste = Array<{ id: number; label: string; primary: boolean; width: number; height: number }>;
  type Folge = (onBildschirme: ((cb: () => void) => () => void) | undefined, frage: (() => Promise<Liste>) | undefined, setze: (l: OberflaechenStand['bildschirme'] | undefined) => void) => () => void;
  const folge = (aktionenModul as Record<string, unknown>).folgeBildschirmen as Folge | undefined;
  ok(typeof folge === 'function', 'SD Bildschirmliste folgt dem Ereignis: lib/aktionen.ts hat folgeBildschirmen');
  const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
  const A: Liste = [{ id: 1, label: 'Regie', primary: true, width: 1920, height: 1080 }];
  const B: Liste = [...A, { id: 2, label: 'Talent', primary: false, width: 1280, height: 720 }];
  /** Attrappe der Brücke: merkt den Hörer, zählt An- und Abmeldungen. */
  const bruecke = (): { on: (cb: () => void) => () => void; feuere(): void; an: number; ab: number } => {
    const b = { an: 0, ab: 0, hoerer: [] as Array<() => void> };
    return {
      on: (cb) => {
        b.an++;
        b.hoerer.push(cb);
        return () => {
          b.ab++;
          b.hoerer = b.hoerer.filter((h) => h !== cb);
        };
      },
      feuere: () => b.hoerer.forEach((h) => h()),
      get an() {
        return b.an;
      },
      get ab() {
        return b.ab;
      },
    };
  };
  const ergebnis: unknown[] = [];
  if (typeof folge === 'function') {
    // Ablauf: Anmelden (liest nichts), Ereignis → Liste A, Ereignis → Liste B, Ereignis mit Fehler → unbekannt, Abmelden, Ereignis → nichts.
    const br = bruecke();
    let fragen = 0;
    let antwort: () => Promise<Liste> = async () => A;
    const werte: Array<OberflaechenStand['bildschirme'] | undefined> = [];
    const ab = folge(br.on, () => (fragen++, antwort()), (l) => void werte.push(l));
    await tick();
    ergebnis.push(['angemeldet', br.an, fragen, werte.length]);
    br.feuere();
    await tick();
    antwort = async () => B;
    br.feuere();
    await tick();
    antwort = async () => Promise.reject(new Error('weg'));
    br.feuere();
    await tick();
    ergebnis.push(['drei Ereignisse', fragen, werte.map((l) => (l === undefined ? 'unbekannt' : l.map((x) => x.label).join('+')))]);
    ab();
    antwort = async () => A;
    br.feuere();
    await tick();
    ergebnis.push(['abgemeldet', br.ab, fragen, werte.length]);

    // Eine Antwort, die erst nach der Abmeldung eintrifft, setzt nichts mehr.
    const br2 = bruecke();
    let loese: (l: Liste) => void = () => undefined;
    const spaet: unknown[] = [];
    const ab2 = folge(br2.on, () => new Promise<Liste>((r) => (loese = r)), (l) => void spaet.push(l));
    br2.feuere();
    ab2();
    loese(B);
    await tick();
    ergebnis.push(['spät nach Abmeldung', spaet.length]);

    // Zwei Ereignisse kurz nacheinander: die Antwort des älteren kommt zuletzt und wird verworfen.
    const br3 = bruecke();
    const loeser: Array<(l: Liste) => void> = [];
    const reihe: string[] = [];
    folge(br3.on, () => new Promise<Liste>((r) => void loeser.push(r)), (l) => void reihe.push(l === undefined ? 'unbekannt' : l.map((x) => x.label).join('+')));
    br3.feuere();
    br3.feuere();
    loeser[1]?.(B);
    await tick();
    loeser[0]?.(A);
    await tick();
    ergebnis.push(['älter nach neuer', reihe]);

    // Ohne Brücke nichts: kein Ereignis-Zugang oder keine Abfrage → keine Anmeldung, keine Frage, nichts gesetzt.
    const br4 = bruecke();
    const ohne: unknown[] = [];
    let fragen4 = 0;
    const ab4 = folge(undefined, async () => (fragen4++, A), (l) => void ohne.push(l));
    const ab5 = folge(br4.on, undefined, (l) => void ohne.push(l));
    br4.feuere();
    await tick();
    ab4();
    ab5();
    ergebnis.push(['ohne Brücke', br4.an, fragen4, ohne.length, typeof ab4, typeof ab5]);
  }
  gleich(
    ergebnis,
    [
      ['angemeldet', 1, 0, 0],
      ['drei Ereignisse', 3, ['Regie · primär (1920×1080)', 'Regie · primär (1920×1080)+Talent (1280×720)', 'unbekannt']],
      ['abgemeldet', 1, 3, 3],
      ['spät nach Abmeldung', 0],
      ['älter nach neuer', ['Regie · primär (1920×1080)+Talent (1280×720)']],
      ['ohne Brücke', 0, 0, 0, 'function', 'function'],
    ],
    'SD Bildschirmliste folgt dem Ereignis: jedes Ereignis fragt und setzt die Liste (Fehler → unbekannt), ohne Brücke nichts, die Abmeldung wirkt auch auf späte Antworten, eine ältere Antwort überschreibt keine neuere',
  );
  const wurzel = ohneKommentare(leseText('src/renderer/src/views/StageOberflaeche.tsx'));
  ok(
    /useEffect\(\(\) => folgeBildschirmen\(window\.jmstage\?\.output\?\.onBildschirme, window\.jmstage\?\.output\?\.displays, setBildschirme\), \[\]\);/.test(wurzel),
    'SD Bildschirmliste folgt dem Ereignis: die Wurzel-View ruft folgeBildschirmen in einem Effekt (einmal, mit Abmeldung beim Abbau)',
  );
}

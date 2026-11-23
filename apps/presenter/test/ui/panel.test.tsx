// UX Welle 2b, Presenter d1 · Das gemeinsame Panel (B8, B11, Presenter-Block „Panel“): eine Komponente für Editor und Referent,
// das Fenster kommt nur aus stand.fenster, die Startwahl nur im Editor. Editor: ausgabe (+ Zeile „Keiner – nur NDI“), ndi
// (Windows), fernsteuerung, handy, gast-klicker, timer, import; Referent ohne ausgabe und import. Das Panel hat keine Effekte;
// Abos, Abfragen und window bleiben in der Wurzel bzw. in useStand. Render ohne Browser und ohne window.
import { PEERS_TEXTE, REMOTE_TEXTE, SCREEN_TEXTE } from '@jm/settings';
import { Button, Select, TextInput, Toggle, UNBEKANNT } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { chatText } from '@shared/gast-klicker';
import type { DisplayInfo, RemoteConfig, RemoteStatus } from '@shared/types';
import { HandyFelder, handyBedienung, handyEntwurfMit, handyWerte, type HandyBedienung, type HandyEntwurf } from '@/components/RemotePanel';
import { ABSCHNITT, ausgabeAbschnitt, bildschirmWahl, nurNdiZeile, PRESENTER_TEXTE, startBildschirm, statusLeiste, vorgabeBildschirm, type OberflaechenStand, type StartWahl } from '@/lib/oberflaeche';
import { standAktionen, TIMER_EINSTELLUNG_QUELLE } from '@/lib/useStand';
import { Einstellungen } from '@/views/Einstellungen';
import { abschnitt, aktionenAttrappe, attr, bekannterStand, bereich, bildschirme, elemente, gastStatus, grundStand, handyStatus, laufend, ndiStatus, NETZWERKKARTEN, ohneKommentare, tags, text } from './testzustand';

const T = PRESENTER_TEXTE;
const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const WAHL: StartWahl = { bildschirm: 22, nurNdi: false };
const panel = (s: OberflaechenStand, startWahl?: StartWahl, log: string[] = []): string =>
  render(<Einstellungen stand={s} aktionen={aktionenAttrappe(log, s.fenster === 'editor')} {...(startWahl === undefined ? {} : { startWahl })} />);
const anker = (html: string): string[] => [...html.matchAll(/id="einstellung-([^"]+)"/g)].map((m) => m[1]);
const schalter = (html: string): string[] => tags(html, 'button').filter((t) => attr(t, 'role') === 'switch');
const gesperrt = (tag: string | undefined): boolean => /\sdisabled=""/.test(tag ?? '');
const gewaehlt = (html: string): string | undefined => text(/<option[^>]*selected=""[^>]*>[\s\S]*?<\/option>/.exec(html)?.[0] ?? '') || undefined;
const knopfTexte = (html: string): string[] => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]).trim());

// ── PS Panel Editor: Anker für alle ABSCHNITT-Werte, Reihenfolge, Sprungziele der Statusleiste ──
{
  const log: string[] = [];
  const s = bekannterStand();
  const html = panel(s, WAHL, log);
  gleich(anker(html), ['ausgabe', 'ndi', 'fernsteuerung', 'handy', 'gast-klicker', 'timer', 'import'], 'PS Panel Editor: Anker für alle ABSCHNITT-Werte in der Reihenfolge ausgabe, ndi, fernsteuerung, handy, gast-klicker, timer, import');
  gleich(Object.values(ABSCHNITT).filter((id) => !anker(html).includes(id)), [], 'PS Panel Editor: kein ABSCHNITT-Wert ohne Anker (unter Windows)');
  const ziele = statusLeiste(s, WAHL).map((i) => i.settingsSection).filter((z): z is string => typeof z === 'string');
  gleich(ziele.filter((z) => !anker(html).includes(z)), [], 'PS Panel Editor: jeder Statuseintrag mit Sprungziel findet seinen Anker');
  gleich(log, [], 'PS Panel Editor: Rendern löst keine Aktion aus');
  pruefeIdVerweise(html, 'PS Panel Editor: id-Verweise gültig');
  ok(!text(html).includes('"'), 'PS Panel Editor: kein ASCII-Anführungszeichen in den Texten des Panels');
  const darwin = panel(bekannterStand({ plattform: 'darwin' }), WAHL);
  gleich(anker(darwin), ['ausgabe', 'fernsteuerung', 'handy', 'gast-klicker', 'timer', 'import'], 'PS Panel Editor: ohne Windows fehlt nur der NDI-Abschnitt (NDI gibt es nur unter Windows)');
}

// ── PS Panel Editor: „Keiner – nur NDI“ nur unter Windows, gesperrt mit Grund nach B11 (Regel Toolbar.tsx:181-185) ──
{
  const zeile = (s: OberflaechenStand, wahl: StartWahl = WAHL): { da: boolean; an?: string; gesperrt: boolean; grund: boolean; abschnittGesperrt: boolean; auswahlGesperrt: boolean } => {
    const html = panel(s, wahl);
    const z = bereich(html, 'data-presenter', 'nur-ndi');
    const [k] = schalter(z);
    const a = abschnitt(html, ABSCHNITT.ausgabe);
    return {
      da: z !== '' && text(z).includes(T.publikum.nurNdi),
      an: attr(k, 'aria-checked'),
      gesperrt: gesperrt(k),
      grund: text(z).includes(`Gesperrt: ${T.publikum.nurNdiGesperrt}`),
      abschnittGesperrt: a.includes('data-gesperrt="true"') && text(a).includes(T.publikum.nurNdiGewaehlt),
      auswahlGesperrt: gesperrt(tags(a, 'select')[0]),
    };
  };
  const nein = { bildschirm: 22, nurNdi: false };
  const ja = { bildschirm: 22, nurNdi: true };
  gleich(
    [
      zeile(bekannterStand({ ndi: ndiStatus('aus') }), nein),
      zeile(bekannterStand({ ndi: undefined }), nein),
      zeile(bekannterStand({ ndi: ndiStatus('sendet', true, 1) }), nein),
      zeile(bekannterStand({ ndi: ndiStatus('sendet', true, 1) }), ja),
      zeile(bekannterStand({ ndi: ndiStatus('startet') }), ja),
      zeile(bekannterStand({ ndi: ndiStatus('nicht-verfuegbar', true, 0, 'weg') }), ja),
    ],
    [
      { da: true, an: 'false', gesperrt: true, grund: true, abschnittGesperrt: false, auswahlGesperrt: false },
      { da: true, an: 'false', gesperrt: true, grund: true, abschnittGesperrt: false, auswahlGesperrt: false },
      { da: true, an: 'false', gesperrt: false, grund: false, abschnittGesperrt: false, auswahlGesperrt: false },
      { da: true, an: 'true', gesperrt: false, grund: false, abschnittGesperrt: true, auswahlGesperrt: true },
      { da: true, an: 'true', gesperrt: false, grund: false, abschnittGesperrt: true, auswahlGesperrt: true },
      { da: true, an: 'false', gesperrt: true, grund: true, abschnittGesperrt: false, auswahlGesperrt: false },
    ],
    'PS Panel Editor: „Keiner – nur NDI“ als Schalter unter dem Abschnitt – gesperrt mit Grund, solange NDI kein Bild liefert und die Wahl nicht steht; steht sie (auch während „startet“), ist der Abschnitt gesperrt',
  );
  ok(!zeile(bekannterStand({ plattform: 'darwin', ndi: ndiStatus('sendet', true, 1) }), ja).da, 'PS Panel Editor: ohne Windows keine Zeile „Keiner – nur NDI“');
  gleich(
    [nurNdiZeile(bekannterStand({ fenster: 'referent' }), ja).sichtbar, nurNdiZeile(bekannterStand({ plattform: 'linux' }), ja).sichtbar, nurNdiZeile(bekannterStand(), ja).sichtbar],
    [false, false, true],
    'PS Panel Editor: nurNdiZeile ist nur im Editor unter Windows sichtbar',
  );
}

// ── PS Panel Editor: Startbildschirm – Vorgabe wie heute der erste nicht-primäre, als echte id; „Automatisch (Hauptmonitor)“ wählt
// den Hauptmonitor als echte id, damit Anzeige und Main übereinstimmen (Main nimmt bei null den ersten nicht-primären, windows.ts:195-203) ──
{
  const liste = bildschirme(null);
  const ohneHaupt: DisplayInfo[] = liste.filter((d) => !d.primary);
  gleich(
    [vorgabeBildschirm(undefined), vorgabeBildschirm([]), vorgabeBildschirm(liste), vorgabeBildschirm([liste[0]])],
    [null, null, 22, 11],
    'PS Panel Editor: Vorgabe des Startbildschirms – ohne Liste keine, sonst der erste nicht-primäre, mit nur dem Hauptbildschirm dieser (wie Toolbar.tsx:49-51)',
  );
  gleich(
    [startBildschirm(undefined, liste), startBildschirm(33, liste), startBildschirm(99, liste), startBildschirm(undefined, undefined), startBildschirm(11, liste)],
    [22, 33, 99, null, 11],
    'PS Panel Editor: Startbildschirm = die Wahl, sonst die Vorgabe aus der aktuellen Liste; eine fehlende Wahl bleibt stehen (Abschnitt meldet „Bildschirm fehlt“)',
  );
  gleich(
    [bildschirmWahl(null, liste), bildschirmWahl(33, liste), bildschirmWahl(null, undefined), bildschirmWahl(null, ohneHaupt)],
    [11, 33, undefined, undefined],
    'PS Panel Editor: „Automatisch (Hauptmonitor)“ (null) wird zur id des Hauptbildschirms; ohne bekannten Hauptbildschirm gilt wieder die Vorgabe',
  );
  const zeige = (bildschirm: number | null): [string | undefined, boolean, boolean] => {
    const a = abschnitt(panel(bekannterStand(), { bildschirm, nurNdi: false }), ABSCHNITT.ausgabe);
    return [gewaehlt(a), text(a).includes(SCREEN_TEXTE.hinweis), gesperrt(tags(a, 'select')[0])];
  };
  gleich(
    [zeige(startBildschirm(undefined, liste)), zeige(startBildschirm(bildschirmWahl(null, liste), liste))],
    [
      [liste[1].label, false, false],
      [liste[0].label, true, false],
    ],
    'PS Panel Editor: die Auswahl zeigt die Vorgabe als echten Bildschirm (nicht „Automatisch“); nach „Automatisch (Hauptmonitor)“ steht dort der Hauptmonitor samt Tipp – beides ist, wohin der Main öffnet',
  );
  const log: string[] = [];
  ausgabeAbschnitt(bekannterStand(), WAHL, aktionenAttrappe(log).startwahl).onSelect?.(null);
  gleich(log, ['start(null)'], 'PS Panel Editor: die Auswahl meldet nur an die Wurzel (startBildschirmWaehlen); sie öffnet und verschiebt nichts');
  const wurzel = QUELLE('views/EditorOberflaeche.tsx');
  ok(
    /startBildschirmWaehlen: \(id\) => setGewaehlt\(bildschirmWahl\(id, stand\.bildschirme\)\)/.test(wurzel) && /bildschirm: startBildschirm\(gewaehlt, stand\.bildschirme\)/.test(wurzel),
    'PS Panel Editor: Quelltext – die Wurzel merkt die Wahl über bildschirmWahl und leitet den Startbildschirm über startBildschirm ab',
  );
  ok(
    QUELLE('components/Toolbar.tsx').includes('startZielFuer(startWahl.nurNdi, stand.ndi ?? NDI_STATUS_AUS, startWahl.bildschirm)'),
    'PS Panel Editor: Quelltext – „Präsentieren“ startet mit derselben Startwahl (startZielFuer wie bisher)',
  );
}

// ── PS Panel Editor: Ausgabe zeigt bei laufender Präsentation den gemessenen Bildschirm (measuredId = current), kein Vollbild ──
{
  const a = abschnitt(panel(bekannterStand({ praesentation: laufend(), bildschirme: bildschirme(33) }), WAHL), ABSCHNITT.ausgabe);
  ok(text(a).includes(SCREEN_TEXTE.aufBildschirm(3)) && text(a).includes(SCREEN_TEXTE.stehtAuf) && text(a).includes(bildschirme(33)[2].label), 'PS Panel Editor: bei laufender Präsentation nennt die Pille den gemessenen Bildschirm, „Steht auf“ seinen Namen (nicht die Wahl 22)');
  // Nur der Abschnitt selbst (sein Anker-Element), ohne die Zeile „Keiner – nur NDI“ darunter.
  const nurAbschnitt = bereich(panel(bekannterStand({ praesentation: laufend(), bildschirme: bildschirme(33) }), WAHL), 'id', `einstellung-${ABSCHNITT.ausgabe}`);
  ok(nurAbschnitt !== '' && schalter(nurAbschnitt).length === 0 && !text(nurAbschnitt).includes(SCREEN_TEXTE.vollbild) && !text(nurAbschnitt).includes(SCREEN_TEXTE.hintergrund), 'PS Panel Editor: Ausgabe ohne Schalter, ohne Vollbild und ohne Hintergrund (B11)');
  const unbekannt = abschnitt(panel(bekannterStand({ bildschirme: undefined }), WAHL), ABSCHNITT.ausgabe);
  ok(text(unbekannt).includes(UNBEKANNT) && tags(unbekannt, 'select').length === 0, 'PS Panel Editor: ohne Bildschirmliste steht „unbekannt“, keine Auswahl');
}

// ── PS Panel Editor: NDI (Windows), Fernsteuerung ──
{
  const n = (s: OberflaechenStand['ndi']): string => abschnitt(panel(bekannterStand({ ndi: s }), WAHL), ABSCHNITT.ndi);
  gleich(
    [attr(schalter(n(ndiStatus('aus')))[0], 'aria-checked'), attr(schalter(n(ndiStatus('sendet', true, 2)))[0], 'aria-checked'), text(n(ndiStatus('sendet', true, 2))).includes('2 Empfänger'), text(n(ndiStatus('nicht-verfuegbar', true, 0, 'Addon fehlt'))).includes('Addon fehlt')],
    ['false', 'true', true, true],
    'PS Panel Editor: NDI-Abschnitt mit Schalter (capabilities toggle), Empfängerzahl beim Senden, Grund bei „nicht verfügbar“',
  );
  const html = panel(bekannterStand(), WAHL);
  ok(text(abschnitt(html, ABSCHNITT.ndi)).includes('JM Presenter') && text(bereich(html, 'data-presenter', 'ndi-hinweis')) === T.ndi.tipp, 'PS Panel Editor: NDI nennt Quellenname, Auflösung und Bildrate als Hinweis (wie der Tooltip des Schalters)');
  const f = abschnitt(html, ABSCHNITT.fernsteuerung);
  ok(text(f).includes('8728') && text(f).includes('Modul „JM Presenter“') && schalter(f).length === 0, 'PS Panel Editor: Fernsteuerung zeigt Port 8728 und das Companion-Modul „JM Presenter“, ohne Schalter');
}

// ── PS Panel Editor: Handy-Fernsteuerung (Inhalt von RemotePanel.tsx:62-128) ──
{
  const h = (z: Partial<OberflaechenStand>): string => abschnitt(panel(bekannterStand(z), WAHL), ABSCHNITT.handy);
  const vorher = h({ handy: undefined });
  ok(text(vorher).includes(T.handy.titel) && text(vorher).includes(UNBEKANNT) && schalter(vorher).length === 0, 'PS Panel Editor: Handy vor der ersten Antwort „unbekannt“, kein Schalter');
  const aus = h({});
  gleich(
    [schalter(aus).map((t) => attr(t, 'aria-checked')), text(aus).includes(T.handy.serverAus), text(aus).includes(T.handy.hinweisAus), gewaehlt(aus), attr(tags(aus, 'input')[0], 'value'), text(aus).includes(REMOTE_TEXTE.port), text(aus).includes(T.handy.pin)],
    [['false', 'true'], true, true, NETZWERKKARTEN[0].label, '7330', true, true],
    'PS Panel Editor: Handy aus – Server-Schalter aus, Netzwerkkarte, Port 7330 und PIN-Schutz wie im alten Fenster',
  );
  ok(text(h({ netzwerkkarten: undefined })).includes(UNBEKANNT) && tags(h({ netzwerkkarten: undefined }), 'select').length === 0, 'PS Panel Editor: Netzwerkkarten noch nicht gelesen → „unbekannt“, keine Auswahl');
  const an = h({ handy: handyStatus({ running: true, url: 'http://10.0.0.5:7330', pin: '4711', config: { enabled: true, bind: '10.0.0.5', port: 7330, pinEnabled: true } }) });
  gleich(
    [attr(schalter(an)[0], 'aria-checked'), text(an).includes(T.handy.serverAn), text(an).includes(T.handy.hinweisAn), text(an).includes('http://10.0.0.5:7330'), text(an).includes('4711'), text(an).includes(T.handy.amHandy), gewaehlt(an)],
    ['true', true, true, true, true, true, NETZWERKKARTEN[1].label],
    'PS Panel Editor: Handy läuft – Adresse, PIN und QR-Kopplung',
  );
  const ohnePin = h({ handy: handyStatus({ running: true, url: 'http://10.0.0.5:7330', pin: null }) });
  ok(text(ohnePin).includes(T.handy.ohnePin), 'PS Panel Editor: Handy ohne PIN – der Hinweis „Ohne PIN — jeder im Netzwerk kann steuern.“');
  ok(text(h({ handy: handyStatus({ error: 'Port 7330 ist belegt — anderen Port wählen.' }) })).includes('Port 7330 ist belegt'), 'PS Panel Editor: Handy zeigt den Startfehler des Servers');
}

// ── PS Panel Handy: Netzwerkkarte und Port wirken erst mit „Setzen“ (Global Constraint „Wahl ≠ Bewegung“, Entscheid zu Task 12) ──
// Eine native Auswahl feuert change auch per Tastatur, und im Panel behält die Auswahl ihre Tasten (O1): Pfeile auf
// „Netzwerkkarte“ dürfen den Handy-Server nicht mitten in der Show neu binden. Netzwerkkarte und Port ändern nur den Entwurf;
// nur „Setzen“ wendet ihn an (Muster Host und Port der Gegenstellen). Fix-Runde 1: Jede Anwendung sendet genau den angewandten
// Stand (status.config), außer den Feldern, die gerade bewusst geändert werden – „Setzen“ die geänderten Felder des Entwurfs,
// der Server-Schalter enabled, der PIN-Schalter pinEnabled –, nie eine zwischengespeicherte Kopie. Der Entwurf hält nur die
// geänderten Felder, überlebt einen Schalterdruck und fällt nach einem erfolgreichen „Setzen“ weg; danach folgt das Panel dem
// angewandten Stand, auch Änderungen aus dem anderen Fenster (Editor und Referent können beide ein Panel offen haben).
{
  const H = T.handy;
  const stand = (config: Partial<RemoteConfig> = {}, running = true): RemoteStatus =>
    handyStatus({ running, url: running ? 'http://10.0.0.5:7330' : null, pin: running ? '4711' : null, config: { enabled: running, bind: 'all', port: 7330, pinEnabled: true, ...config } });
  /** Ein Panel als Modell: Stand, Entwurf und beschäftigt wie in HandyAbschnitt; anwenden zeichnet auf und gelingt oder scheitert. */
  interface Modell {
    status: RemoteStatus;
    entwurf: HandyEntwurf;
    busy: boolean;
    gesendet: RemoteConfig[];
    b(): HandyBedienung;
  }
  const modell = (status: RemoteStatus = stand(), scheitert = false): Modell => {
    const m: Modell = {
      status,
      entwurf: {},
      busy: false,
      gesendet: [],
      b: () =>
        handyBedienung({
          status: m.status,
          entwurf: m.entwurf,
          busy: m.busy,
          setzeEntwurf: (e) => {
            m.entwurf = e;
          },
          anwenden: (c) => {
            m.gesendet.push(c);
            return scheitert ? Promise.reject(new Error('IPC')) : Promise.resolve(undefined);
          },
        }),
    };
    return m;
  };
  /** Lässt die Antwort von anwenden und ihre Folgen durchlaufen. */
  const warte = async (): Promise<void> => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  const A = { bind: 'all', port: 7330 };

  {
    const m = modell();
    const schritte: HandyEntwurf[] = [];
    for (const tu of [() => m.b().netzwerkkarte('10.0.0.5'), () => m.b().port('7331'), () => m.b().port('7a3x'), () => m.b().port(''), () => m.b().port('7330'), () => m.b().netzwerkkarte('all')]) {
      tu();
      schritte.push(m.entwurf);
    }
    gleich(
      [m.gesendet, schritte],
      [[], [{ bind: '10.0.0.5' }, { bind: '10.0.0.5', port: 7331 }, { bind: '10.0.0.5', port: 73 }, { bind: '10.0.0.5', port: 0 }, { bind: '10.0.0.5' }, {}]],
      'PS Panel Handy: Wahl der Netzwerkkarte und Tippen im Port ändern nur den Entwurf (nur Ziffern), ohne Anwenden; ein Wert gleich dem angewandten Stand ist kein Entwurf',
    );
    gleich(
      [handyEntwurfMit({}, 'port', 7330, A), handyEntwurfMit({ port: 7331 }, 'port', 7330, A), handyEntwurfMit({}, 'bind', '10.0.0.5', A), handyWerte({ port: 7331 }, { bind: '10.0.0.5', port: 7400 }), handyWerte({}, A)],
      [{}, {}, { bind: '10.0.0.5' }, { bind: '10.0.0.5', port: 7331 }, A],
      'PS Panel Handy: der Entwurf hält nur geänderte Felder; angezeigt wird je Feld der Entwurf, sonst der angewandte Stand',
    );
  }
  {
    const m = modell();
    m.b().port('7331');
    m.b().setzen();
    gleich(m.gesendet, [{ enabled: true, bind: 'all', port: 7331, pinEnabled: true }], 'PS Panel Handy: „Setzen“ wendet einmal an – Port aus dem Entwurf, Netzwerkkarte und PIN angewandt, enabled aus running');
  }
  {
    // Befund 1 der Prüfung: angewandt, danach fremde Änderung.
    const m = modell();
    m.b().port('7331');
    m.b().setzen();
    await warte();
    m.status = stand({ port: 7331 });
    const nachSetzen = [m.entwurf, m.b().werte.port, m.b().setzenGrund];
    m.status = stand({ port: 7400 });
    const nachFremd = [m.b().werte.port, m.b().setzenGrund];
    m.b().setzen();
    gleich(
      [nachSetzen, nachFremd, m.gesendet.length],
      [[{}, 7331, H.setzenUnveraendert], [7400, H.setzenUnveraendert], 1],
      'PS Panel Handy: nach „Setzen“ fällt der Entwurf weg; eine spätere Änderung aus dem anderen Fenster zeigt das Panel, „Setzen“ bleibt gesperrt und nimmt sie nicht zurück',
    );
  }
  {
    // Befund 2 der Prüfung: PIN im anderen Fenster geändert, danach Server-Schalter und „Setzen“ hier.
    const m = modell();
    m.b().port('7331');
    m.status = stand({ pinEnabled: false });
    m.b().server();
    m.b().setzen();
    gleich(
      m.gesendet,
      [
        { enabled: false, bind: 'all', port: 7330, pinEnabled: false },
        { enabled: true, bind: 'all', port: 7331, pinEnabled: false },
      ],
      'PS Panel Handy: eine PIN-Änderung aus dem anderen Fenster geht mit Server-Schalter und „Setzen“ hinaus, nie ein alter Wert',
    );
  }
  {
    const m = modell();
    m.b().port('7331');
    m.status = stand({ bind: '10.0.0.5' });
    m.b().pin(false);
    m.b().setzen();
    gleich(
      m.gesendet,
      [
        { enabled: true, bind: '10.0.0.5', port: 7330, pinEnabled: false },
        { enabled: true, bind: '10.0.0.5', port: 7331, pinEnabled: true },
      ],
      'PS Panel Handy: ein nicht geändertes Feld kommt immer aus dem angewandten Stand (fremde Netzwerkkarte bleibt), der PIN-Schalter sendet nur seinen Wert neu',
    );
  }
  {
    const m = modell();
    m.b().port('7331');
    m.b().server();
    m.b().pin(false);
    await warte();
    const nachSchaltern = m.entwurf;
    const f = modell(stand(), true);
    f.b().port('7331');
    f.b().setzen();
    await warte();
    gleich(
      [nachSchaltern, f.entwurf, f.gesendet.length],
      [{ port: 7331 }, { port: 7331 }, 1],
      'PS Panel Handy: ein offener Entwurf überlebt Server- und PIN-Schalter; scheitert „Setzen“, bleibt er stehen',
    );
  }
  {
    const grund = (entwurf: HandyEntwurf, busy = false): string | undefined => {
      const m = modell();
      m.entwurf = entwurf;
      m.busy = busy;
      return m.b().setzenGrund;
    };
    gleich(
      [grund({}), grund({ port: 1023 }), grund({ port: 65536 }), grund({ port: 0 }), grund({ port: 1024 }), grund({ port: 65535 }), grund({ bind: '10.0.0.5' }), grund({ bind: '10.0.0.5' }, true)],
      [H.setzenUnveraendert, H.setzenPort, H.setzenPort, H.setzenPort, undefined, undefined, undefined, H.setzenLaeuft],
      'PS Panel Handy: „Setzen“ gesperrt mit Grund – nichts geändert, Port außerhalb 1024 bis 65535, wird angewendet',
    );
    gleich(
      [[{}, false], [{ port: 80 }, false], [{ bind: '10.0.0.5' }, true]].map(([entwurf, busy]) => {
        const m = modell();
        m.entwurf = entwurf as HandyEntwurf;
        m.busy = busy as boolean;
        m.b().setzen();
        return m.gesendet.length;
      }),
      [0, 0, 0],
      'PS Panel Handy: ein gesperrtes „Setzen“ wendet nichts an',
    );
  }
  {
    // Je ein eigener Rückruf, damit ein Vertauschen (Auswahl an setzen, Feld an netzwerkkarte) auffällt.
    const bedienung: HandyBedienung = {
      netzwerkkarte: () => undefined,
      port: () => undefined,
      setzen: () => undefined,
      server: () => undefined,
      pin: () => undefined,
      werte: A,
      setzenGrund: undefined,
    };
    const ohnePin = stand({ pinEnabled: false });
    const felder = (b: HandyBedienung): ReturnType<typeof elemente> => elemente(HandyFelder({ status: ohnePin, netzwerkkarten: NETZWERKKARTEN, busy: false, grundId: 'handy-grund', bedienung: b }));
    const els = felder(bedienung);
    const auswahl = els.find((e) => e.type === Select);
    const feld = els.find((e) => e.type === TextInput);
    const knopf = els.find((e) => e.type === Button && e.props.children === PEERS_TEXTE.setzen);
    const [server, pin] = els.filter((e) => e.type === Toggle);
    // Nur Wahrheitswerte vergleichen: gleich vergleicht als JSON, dort wären eine Funktion und undefined beide null.
    gleich(
      [
        auswahl?.props.onChange === bedienung.netzwerkkarte,
        feld?.props.onChange === bedienung.port,
        feld !== undefined && feld.props.onBlur === undefined,
        knopf?.props.onClick === bedienung.setzen,
        knopf?.props.disabled === false,
        knopf !== undefined && knopf.props['aria-describedby'] === undefined,
        server?.props.onChange === bedienung.server,
        pin?.props.onChange === bedienung.pin,
        pin?.props.checked === false,
      ],
      [true, true, true, true, true, true, true, true, true],
      'PS Panel Handy: Verdrahtung – Auswahl und Port-Feld nur an den Entwurf, kein onBlur, „Setzen“ ruft setzen, der PIN-Schalter zeigt den angewandten Stand',
    );
    const zu = felder({ ...bedienung, setzenGrund: H.setzenUnveraendert });
    const knopfZu = zu.find((e) => e.type === Button && e.props.children === PEERS_TEXTE.setzen);
    const grund = zu.find((e) => e.props.id === 'handy-grund');
    gleich([knopfZu?.props.disabled, knopfZu?.props['aria-describedby'], grund?.props.children], [true, 'handy-grund', H.setzenUnveraendert], 'PS Panel Handy: gesperrtes „Setzen“ nennt seinen Grund sichtbar (aria-describedby)');
  }
  {
    const html = panel(bekannterStand({ handy: stand() }), WAHL);
    const h = abschnitt(html, ABSCHNITT.handy);
    const setzen = tags(h, 'button').find((t) => attr(t, 'aria-label') === PEERS_TEXTE.setzenFuer(H.titel));
    ok(setzen !== undefined && gesperrt(setzen) && text(h).includes(PEERS_TEXTE.setzen) && text(h).includes(H.setzenUnveraendert), 'PS Panel Handy: im Panel steht „Setzen“, gesperrt mit „nichts geändert“, solange es keinen Entwurf gibt');
    pruefeIdVerweise(html, 'PS Panel Handy: id-Verweise des Sperrgrunds gültig');
  }
  {
    const q = QUELLE('components/RemotePanel.tsx');
    const abschnittQuelle = /export function HandyAbschnitt\([\s\S]*?\n}\n/.exec(q)?.[0] ?? '';
    ok(
      !q.includes('onBlur') && abschnittQuelle.includes('handyBedienung(') && abschnittQuelle.includes('<HandyFelder') && !/apply\(\{ (bind|port)/.test(q),
      'PS Panel Handy: Quelltext – kein Übernehmen beim Verlassen, keine Anwendung aus Auswahl oder Feld; HandyAbschnitt verdrahtet über handyBedienung',
    );
    ok(
      !/useState[^;]*status\./.test(abschnittQuelle) && !abschnittQuelle.includes('pinEnabled'),
      'PS Panel Handy: Quelltext – kein Zustand aus dem gemeldeten Stand und keine eigene PIN-Kopie in HandyAbschnitt (nichts Angewandtes zwischengespeichert)',
    );
    ok([H.setzenUnveraendert, H.setzenPort, H.setzenLaeuft].every((t: string) => t.length > 0 && !t.includes('"')), 'PS Panel Handy: die Sperrgründe stehen in PRESENTER_TEXTE');
  }
}

// ── PS Panel Editor: Gast-Klicker (Inhalt von GastKlickerAbschnitt.tsx) ──
{
  const g = (s: OberflaechenStand['gastKlicker']): string => abschnitt(panel(bekannterStand({ gastKlicker: s }), WAHL), ABSCHNITT.gastKlicker);
  const vorher = g(undefined);
  ok(text(vorher).includes(UNBEKANNT) && gesperrt(schalter(vorher)[0]), 'PS Panel Editor: Gast-Klicker vor der ersten Antwort „unbekannt“, Schalter gesperrt');
  const aus = g(gastStatus());
  ok(text(aus).includes(T.gastKlicker.aus) && attr(schalter(aus)[0], 'aria-checked') === 'false' && !gesperrt(schalter(aus)[0]) && tags(aus, 'input').length === 0, 'PS Panel Editor: Gast-Klicker aus – Schalter bedienbar, kein Link');
  const link = 'https://jm-gast-klicker.invalid/k/abcdefabcdef';
  const an = g(gastStatus({ an: true, lage: 'verbunden', link, gaeste: 2 }));
  gleich(
    [text(an).includes(T.gastKlicker.an), text(an).includes('verbunden · 2 Gäste'), attr(tags(an, 'input')[0], 'value'), knopfTexte(an).filter((t) => t !== ''), text(an).includes(T.gastKlicker.hinweis)],
    [true, true, link, [T.gastKlicker.kopieren, T.gastKlicker.pausieren, T.gastKlicker.neuerLink], true],
    'PS Panel Editor: Gast-Klicker an – Statuszeile, Link, „Für den Zoom-Chat kopieren“, „Gast-Klick pausieren“, „Neuer Link“ und Hinweis',
  );
  const pause = g(gastStatus({ an: true, lage: 'verbunden', link, gaeste: 1, pausiert: true }));
  ok(knopfTexte(pause).includes(T.gastKlicker.fortsetzen) && tags(pause, 'button').some((t) => attr(t, 'aria-pressed') === 'true'), 'PS Panel Editor: pausiert – „Gast-Klick fortsetzen“, gedrückt');
  ok(text(g(gastStatus({ an: true, lage: 'verbindet', link }))).includes('⚠'), 'PS Panel Editor: an, aber nicht verbunden – die Statuszeile steht als Fehler (wie bisher rot)');
}

// ── PS Panel Editor: Timer (PeersSection mit Ein/Aus) und Import ──
{
  const html = panel(bekannterStand({ timer: { config: { enabled: true, host: '10.0.0.9', port: 7777 }, verbunden: true } }), WAHL);
  const t = abschnitt(html, ABSCHNITT.timer);
  ok(text(t).includes(T.timer.titel) && attr(schalter(t)[0], 'aria-checked') === 'true' && tags(t, 'input').some((i) => attr(i, 'value') === '10.0.0.9'), 'PS Panel Editor: Timer als Gegenstelle „JM Timer“ mit Schalter, Host und Port (Modell Stage-Display)');
  ok(text(bereich(html, 'data-presenter', 'timer-hinweis')) === T.timer.erklaerung, 'PS Panel Editor: Timer mit der Erklärung „Zeigt den Countdown des JM Timers live in der Referentenansicht.“');
  const i = abschnitt(html, ABSCHNITT.import);
  ok(text(i).includes(T.import.einzelschritte) && text(i).includes(T.import.experimentell) && text(i).includes(T.import.erklaerung) && attr(schalter(i)[0], 'aria-checked') === 'false', 'PS Panel Editor: Import mit „PPTX-Aufbau-Animationen als Einzelschritte“, Marke „experimentell“ und Erklärung (localStorage jmpr.expandPptxBuilds, ohne Browser aus)');
  const q = QUELLE('views/Einstellungen.tsx');
  ok(q.includes('getExpandPptxBuilds') && q.includes('setExpandPptxBuilds'), 'PS Panel Editor: Import liest und merkt die Einstellung über lib/settings.ts (jmpr.expandPptxBuilds)');
}

// ── PS Panel Referent: ohne ausgabe und import (B11), auch wenn eine Startwahl mitkäme ──
{
  const s = bekannterStand({ fenster: 'referent', praesentation: laufend(), bildschirme: bildschirme(22) });
  const html = panel(s);
  gleich(anker(html), ['ndi', 'fernsteuerung', 'handy', 'gast-klicker', 'timer'], 'PS Panel Referent: Anker ndi, fernsteuerung, handy, gast-klicker, timer – ohne ausgabe und import');
  ok(!html.includes('data-presenter="nur-ndi"') && !text(html).includes(SCREEN_TEXTE.titel), 'PS Panel Referent: keine Ausgabe-Wahl und kein „Keiner – nur NDI“ (die Live-Wahl steht in der Leiste, P2-A)');
  gleich(anker(panel(s, WAHL)), anker(html), 'PS Panel Referent: das Fenster kommt nur aus stand.fenster – eine Startwahl ändert nichts');
  const ziele = statusLeiste(s).map((i) => i.settingsSection).filter((z): z is string => typeof z === 'string');
  gleich(ziele.filter((z) => !anker(html).includes(z)), [], 'PS Panel Referent: jeder Statuseintrag mit Sprungziel findet seinen Anker');
  pruefeIdVerweise(html, 'PS Panel Referent: id-Verweise gültig');
}

// ── PS Panel ohne Effekte (B8): kein useEffect, kein window, kein Store im Panel und in den Abschnitts-Inhalten ──
{
  const q = QUELLE('views/Einstellungen.tsx');
  ok(!q.includes('useEffect') && !/\bwindow\b/.test(q) && !q.includes('useProject') && !q.includes('jmpr'), 'PS Panel ohne Effekte: Einstellungen.tsx ohne useEffect, ohne window und ohne Store (E15)');
  const gast = QUELLE('components/GastKlickerAbschnitt.tsx');
  ok(!gast.includes('useEffect') && !/\bwindow\b/.test(gast) && !gast.includes('navigator'), 'PS Panel ohne Effekte: GastKlickerAbschnitt ohne Effekt und ohne window (Status und Aktionen kommen herein)');
  const remote = QUELLE('components/RemotePanel.tsx');
  const handy = /export function HandyAbschnitt\([\s\S]*?\n}\n/.exec(remote)?.[0] ?? '';
  ok(handy !== '' && !handy.includes('useEffect') && !/\bwindow\b/.test(handy), 'PS Panel ohne Effekte: HandyAbschnitt ohne Effekt und ohne window (das QR-Bild rechnet QrBild)');
  const s = QUELLE('lib/useStand.ts');
  ok(s.includes('window.confirm(PRESENTER_TEXTE.gastKlicker.neuerLinkFrage)') && T.gastKlicker.neuerLinkFrage === 'Neuen Link erzeugen? Der alte Link funktioniert dann nicht mehr.', 'PS Panel ohne Effekte: window.confirm bei „Neuer Link“ bleibt, mit dem alten Wortlaut, im Rückruf der Wurzel');
}

// ── PS Panel-Aktionen (standAktionen): rufen window.jmpr erst im Rückruf, mit den alten Regeln ──
{
  const aufrufe: string[] = [];
  let ja = false;
  const g = globalThis as unknown as { window?: unknown };
  const nav = globalThis.navigator as unknown as Record<string, unknown>;
  g.window = {
    confirm: (t: string) => (aufrufe.push(`confirm(${t})`), ja),
    jmpr: {
      ndi: { setzeAn: (an: boolean) => (aufrufe.push(`ndi(${an})`), Promise.resolve(ndiStatus(an ? 'startet' : 'aus'))) },
      timer: { apply: (c: unknown) => (aufrufe.push(`timer(${JSON.stringify(c)})`), Promise.resolve(c)) },
      remote: { apply: (c: unknown) => (aufrufe.push(`remote(${JSON.stringify(c)})`), Promise.resolve(handyStatus())) },
      gastKlicker: {
        setzeAn: (an: boolean) => (aufrufe.push(`gastAn(${an})`), Promise.resolve(gastStatus())),
        pause: (an: boolean) => (aufrufe.push(`gastPause(${an})`), Promise.resolve(gastStatus())),
        neuerLink: () => (aufrufe.push('gastNeuerLink'), Promise.resolve(gastStatus())),
      },
    },
  };
  Object.defineProperty(nav, 'clipboard', { value: { writeText: (t: string) => (aufrufe.push(`clip(${t})`), Promise.resolve()) }, configurable: true });
  const gemeldet: unknown[] = [];
  const ab = TIMER_EINSTELLUNG_QUELLE.ereignis((c) => void gemeldet.push(c));
  let kopiert: unknown;
  try {
    const a = standAktionen(bekannterStand({ timer: { config: { enabled: false, host: '10.0.0.1', port: 7777 }, verbunden: false } }));
    a.ndiSchalten(true);
    a.timerSchalten(true);
    a.timerSetzen('  ', 0);
    a.timerSetzen('10.0.0.2', 7780);
    standAktionen(grundStand()).timerSchalten(true);
    await a.handyAnwenden({ enabled: true, bind: 'all', port: 7331, pinEnabled: false });
    await a.gastKlicker.setzeAn(true);
    await a.gastKlicker.pause(true);
    await a.gastKlicker.neuerLink();
    ja = true;
    await a.gastKlicker.neuerLink();
    kopiert = await a.gastKlicker.kopieren('L');
  } finally {
    ab();
    delete g.window;
    delete nav.clipboard;
  }
  const frage = T.gastKlicker.neuerLinkFrage;
  gleich(
    aufrufe,
    [
      'ndi(true)',
      'timer({"enabled":true,"host":"10.0.0.1","port":7777})',
      'timer({"enabled":false,"host":"127.0.0.1","port":7777})',
      'timer({"enabled":false,"host":"10.0.0.2","port":7780})',
      'remote({"enabled":true,"bind":"all","port":7331,"pinEnabled":false})',
      'gastAn(true)',
      'gastPause(true)',
      `confirm(${frage})`,
      `confirm(${frage})`,
      'gastNeuerLink',
      `clip(${chatText('L')})`,
    ],
    'PS Panel-Aktionen: NDI schalten, Timer an/aus und setzen (leerer Host → 127.0.0.1, Port außerhalb 1 bis 65535 → 7777), Handy anwenden, Gast-Klicker; „Neuer Link“ erst nach window.confirm; kopiert den Chat-Text',
  );
  gleich([gemeldet.length, kopiert, typeof (globalThis as { window?: unknown }).window], [3, true, 'undefined'], 'PS Panel-Aktionen: jede Timer-Änderung meldet sich sofort beim Stand; ohne Timer-Einstellung nichts; danach wieder ohne window');
}

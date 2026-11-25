// UX Welle 2b, Studio-Control d1 · Rahmen, Anmeldung und Reiter (B15, B3, B4; Muster d; Spec 3.1, 3.8): AppShell aus @jm/ui mit
// Kopf „JM Studio Control“ und ThemeToggle. Vor der Anmeldung leere Statusleiste, kein ⚙, keine Werkzeugleiste, die Anmeldung im
// Inhalt; danach Tabs Video · Audio · Licht · Setup in der Werkzeugleiste, rechts „‹Benutzer› · ‹Rolle›“ und „Abmelden“.
// Wächter: Der Socket-Effekt bleibt in der Wurzel (App.tsx) und läuft vor der Anmeldung wie heute (N2b 2.10); kein lokaler
// Rahmen mehr (AppShell, Topbar, ComingSoon gelöscht). Render ohne Browser und ohne window: Effekte laufen in
// renderToStaticMarkup nicht, und ohne window ist die Umgebung „browser“.
import { existsSync } from 'node:fs';
import { ABSCHNITT_TEXTE } from '@jm/settings';
import { UNBEKANNT } from '@jm/ui';
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { App } from '@/App';
import { STUDIO_TEXTE, statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import type { Section } from '@/store/app';
import * as oberflaeche from '@/views/StudioOberflaeche';
import * as leiste from '@/views/Werkzeugleiste';
import {
  angemeldeterStand,
  attr,
  bereich,
  elemente,
  grundStand,
  knopfTexte,
  mitSitzung,
  mitStore,
  ohneKommentare,
  rendererDateien,
  sitzungsBenutzer,
  statusEintraege,
  tags,
  text,
} from './testzustand';

const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));
const STREAMT = { atem: [{ id: 'a1', name: 'ATEM Mini', host: '192.0.2.10' }], atemStatuses: { a1: { id: 'a1', state: 'connected' as const, streaming: true, lastChecked: 1 } } };

/** Render ohne Abbruch: ein Wurf (etwa window beim Rendern oder ein fehlender Export) zählt als FAIL, der Lauf geht weiter. */
function ohneWurf(name: string, f: () => string): string {
  try {
    return f();
  } catch (e) {
    ok(false, `${name}: Render ohne Wurf (${String(e).split(String.fromCharCode(10))[0]})`);
    return '';
  }
}

const kopf = (html: string): string => html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
const werkzeug = (html: string): string => bereich(html, 'data-bereich', 'toolbar');
const inhalt = (html: string): string => bereich(html, 'data-bereich', 'inhalt');
const reiterTexte = (html: string): string[] => [...html.matchAll(/<button[^>]*role="tab"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]!).trim());
const gewaehlt = (html: string): string[] => [...html.matchAll(/<button[^>]*role="tab"[^>]*aria-selected="true"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]!).trim());
const zahnrad = (html: string): string[] => tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
const thema = (html: string): string[] => tags(html, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
// React 18 schreibt beim Server-Render autoComplete in der Schreibweise der Prop.
const anmeldung = (html: string): boolean => /autocomplete="username"/i.test(html) && html.includes('type="password"') && knopfTexte(html).includes('Anmelden');
const alteReste = ['Coming soon', 'Kumo', 'Logout', 'Light', 'Dark', 'Sync', 'Offline', 'JM STUDIO'];

/** Der Rahmen mit einem gegebenen Stand (ohne Stores), wie ihn die Wurzel-View rendert. */
function rahmen(s: OberflaechenStand, abschnitt: Section = 'video', panelOffen = false, log: string[] = []): string {
  const Rahmen = oberflaeche.StudioRahmen;
  if (typeof Rahmen !== 'function') throw new Error('StudioRahmen fehlt');
  return render(
    <Rahmen stand={s} abschnitt={abschnitt} onAbschnitt={(a) => log.push(`abschnitt:${a}`)} onAbmelden={() => log.push('abmelden')} panelOffen={panelOffen} onPanel={(o) => log.push(`panel:${o}`)}>
      <div data-studio="inhalt-probe" />
    </Rahmen>,
  );
}

// ── SC Login-Rahmen leer: Kopf „JM Studio Control“ mit ThemeToggle, leere Statusleiste, kein ⚙, keine Reiter, Anmeldung im Inhalt ──
{
  const html = ohneWurf('SC Login-Rahmen leer', () => render(<App />));
  const k = kopf(html);
  ok(text(k).includes('JM Studio Control'), 'SC Login-Rahmen leer: Kopf „JM Studio Control“ aus dem AppShell von @jm/ui');
  gleich(thema(k).map((t) => attr(t, 'aria-label')), ['Darstellung: Dunkel. Umschalten auf Hell'], 'SC Login-Rahmen leer: genau ein ThemeToggle im Kopf (Start dunkel, B4)');
  ok(html.includes('<footer') && statusEintraege(html).length === 0, 'SC Login-Rahmen leer: die Statusleiste steht und ist leer (status={[]}, B15)');
  gleich(zahnrad(html).length, 0, 'SC Login-Rahmen leer: kein ⚙ (ohne settings)');
  ok(werkzeug(html) === '' && !html.includes('role="tablist"') && reiterTexte(html).length === 0, 'SC Login-Rahmen leer: keine Werkzeugleiste und keine Reiter');
  ok(anmeldung(inhalt(html)), 'SC Login-Rahmen leer: das Anmeldeformular (Benutzer, Passwort, „Anmelden“) steht im Inhalt des Rahmens');
  ok(!html.includes('data-onair'), 'SC Login-Rahmen leer: keine ON-AIR-Anzeige vor der Anmeldung');
  gleich(text(html).split('JM Studio Control').length - 1, 1, 'SC Login-Rahmen leer: „JM Studio Control“ steht genau einmal (im Kopf; die Karte wiederholt Logo und Titel nicht)');
  gleich(alteReste.filter((r) => text(html).includes(r)), [], 'SC Login-Rahmen leer: keine alten Kopftexte (Logout, Light/Dark, Sync, Offline, JM STUDIO)');
  pruefeIdVerweise(html, 'SC Login-Rahmen leer: id-Verweise gültig');
  ok(!text(html).includes('"'), 'SC Login-Rahmen leer: kein ASCII-Anführungszeichen in den Texten');
}
{
  // Auch im Electron-Fenster mit allen Antworten (Socket vor der Anmeldung, Master-Link, Steuerserver, ATEM streamt): leer.
  const s = angemeldeterStand({ benutzer: null, atem: { ids: ['a1'], status: { a1: { state: 'connected', streaming: true } } } });
  const html = ohneWurf('SC Login-Rahmen leer', () => rahmen(s, 'video', true));
  ok(
    statusEintraege(html).length === 0 && zahnrad(html).length === 0 && werkzeug(html) === '' && !html.includes('aria-label="Einstellungen"'),
    'SC Login-Rahmen leer: im Electron-Fenster vor der Anmeldung ebenso leer, ohne ⚙ und ohne Panel, auch wenn alles geantwortet hat',
  );
  ok(anmeldung(inhalt(html)) && !html.includes('data-studio="inhalt-probe"'), 'SC Login-Rahmen leer: der Rahmen zeigt vor der Anmeldung die Anmeldung, nicht den Inhalt');
  ok(!html.includes('data-onair'), 'SC Login-Rahmen leer: kein ON AIR vor der Anmeldung, auch wenn ein ATEM streamt');
  const app = ohneWurf('SC Login-Rahmen leer', () => mitStore(STREAMT, () => render(<App />)));
  ok(app !== '' && !app.includes('data-onair') && statusEintraege(app).length === 0, 'SC Login-Rahmen leer: die Wurzel zeigt ohne Sitzung kein ON AIR und keinen Eintrag, auch mit Geräten im Store');
}

// ── SC Rahmen angemeldet: Tabs mit vier Reitern, rechts Benutzer · Rolle und „Abmelden“; kein „Coming soon“, kein „Kumo“ ──
{
  const html = ohneWurf('SC Rahmen angemeldet', () => mitSitzung({ token: 't', user: sitzungsBenutzer() }, () => render(<App />)));
  const w = werkzeug(html);
  gleich(reiterTexte(w), ['Video', 'Audio', 'Licht', 'Setup'], 'SC Rahmen angemeldet: Tabs mit den vier Reitern Video, Audio, Licht, Setup in der Werkzeugleiste');
  gleich((leiste.REITER ?? []).map((r) => r.key), ['video', 'audio', 'licht', 'setup'], 'SC Rahmen angemeldet: die Reiter tragen die Abschnitte des Stores (store/app.ts Section)');
  ok(w.includes('role="tablist"') && !kopf(html).includes('role="tab"'), 'SC Rahmen angemeldet: die Reiter sind Tabs aus @jm/ui (role tablist) und stehen nicht im Kopf');
  gleich(gewaehlt(w), ['Video'], 'SC Rahmen angemeldet: gewählt ist der Abschnitt des Stores (Vorgabe Video)');
  gleich(text(bereich(w, 'data-studio', 'benutzer')), 'Admin · Admin', 'SC Rahmen angemeldet: rechts „‹Benutzer› · ‹Rolle›“ mit dem deutschen Rollennamen');
  const knoepfe = knopfTexte(w);
  ok(knoepfe[knoepfe.length - 1] === 'Abmelden' && STUDIO_TEXTE.abmelden === 'Abmelden', 'SC Rahmen angemeldet: „Abmelden“ ist der letzte Knopf der Werkzeugleiste (Text aus STUDIO_TEXTE)');
  ok(
    w.indexOf('role="tablist"') < w.indexOf('data-studio="benutzer"') && w.indexOf('data-studio="benutzer"') < w.indexOf('data-studio="abmelden"'),
    'SC Rahmen angemeldet: Reihenfolge links Tabs, rechts Benutzer · Rolle, dann „Abmelden“',
  );
  ok(!knopfTexte(kopf(html)).includes('Abmelden') && thema(kopf(html)).length === 1, 'SC Rahmen angemeldet: der Kopf trägt ThemeToggle, aber weder Reiter noch „Abmelden“ (Kopf frei für ON AIR, S3-A)');
  gleich(alteReste.filter((r) => text(html).includes(r)), [], 'SC Rahmen angemeldet: kein „Coming soon“, kein „Kumo“, kein Logout, Light/Dark, Sync/Offline, JM STUDIO');
  gleich(zahnrad(html).length, 0, 'SC Rahmen angemeldet: im Browser (ohne window.jms) kein ⚙');
  gleich(statusEintraege(html).map(([id]) => id), ['server', 'licht', 'benutzer'], 'SC Rahmen angemeldet: Statusleiste im Browser mit Server, Licht und Benutzer (ohne Master-Link und Fernsteuerung, W2-V4)');
  gleich(
    statusEintraege(html).filter(([id]) => id !== 'benutzer').map(([, z, t]) => [z, t]),
    [['off', `Server: ${UNBEKANNT}`], ['off', `Licht: ${UNBEKANNT}`]],
    'SC Rahmen angemeldet: vor der ersten Antwort sind Server und Licht unbekannt (off mit „unbekannt“), nicht ok und nicht aus',
  );
  const i = inhalt(html);
  // Rand des Inhalts (Task 18, Fix-Runde 1): seitlich und unten wie bisher (px-7, pb-6), oben nur pt-1.5 (5,625 px statt 22,5 px).
  // Kopf 44 + Werkzeugleiste 51 legen den Inhalt 35 px tiefer als der alte Kopf 60; mit dem kleineren oberen Rand rücken die Tasten
  // auf 18 px an ihre alten Plätze heran, und keine folgenreiche Taste liegt im selben Zustand auf dem alten Platz einer anderen
  // (gemessen: mit py-6 lagen PTZ-Presets 1–6 auf 7–12 und OBS-Szenen bei 1024 auf Aufnahme/Stream).
  const rand = /<div class="([^"]*\bmax-w-\[1400px\][^"]*)"/.exec(i)?.[1] ?? '';
  ok(
    i.includes('TriCaster') && /\bpx-7\b/.test(rand) && /(?:^|\s)pt-1\.5(?:\s|$)/.test(rand) && /\bpb-6\b/.test(rand) && !/\bpy-6\b/.test(rand),
    'SC Rahmen angemeldet: der Inhalt zeigt den Abschnitt Video mit Rand px-7, pt-1.5, pb-6 (oben kleiner, wegen der Tastenplätze)',
  );
  pruefeIdVerweise(html, 'SC Rahmen angemeldet: id-Verweise gültig');
  ok(!text(html).includes('"'), 'SC Rahmen angemeldet: kein ASCII-Anführungszeichen in den Texten');
}
{
  const rolleText = (rolle: 'admin' | 'operator' | 'viewer', name: string): string =>
    text(bereich(werkzeug(ohneWurf('SC Rahmen angemeldet', () => mitSitzung({ token: 't', user: sitzungsBenutzer({ username: name, role: rolle }) }, () => render(<App />)))), 'data-studio', 'benutzer'));
  gleich([rolleText('operator', 'Bediener'), rolleText('viewer', 'Gast')], ['Bediener · Bediener', 'Gast · Betrachter'], 'SC Rahmen angemeldet: die Rolle steht deutsch (Bediener, Betrachter) statt operator/viewer');
  const setup = ohneWurf('SC Rahmen angemeldet', () => mitSitzung({ token: 't', user: sitzungsBenutzer() }, () => mitStore({ section: 'setup' }, () => render(<App />))));
  gleich(gewaehlt(werkzeug(setup)), ['Setup'], 'SC Rahmen angemeldet: der gewählte Reiter folgt dem Abschnitt im Store');
  const unter = inhalt(setup);
  gleich([unter.includes('role="tablist"'), reiterTexte(unter), gewaehlt(unter)], [true, ['Inventar', 'Discovery', 'Benutzer'], ['Inventar']], 'SC Rahmen angemeldet: Setup-Unterreiter als Tabs aus @jm/ui (Inventar, Discovery, Benutzer; Vorgabe Inventar)');
  const gast = ohneWurf('SC Rahmen angemeldet', () => mitSitzung({ token: 't', user: sitzungsBenutzer({ role: 'viewer' }) }, () => mitStore({ section: 'setup' }, () => render(<App />))));
  gleich(reiterTexte(inhalt(gast)), ['Inventar', 'Discovery'], 'SC Rahmen angemeldet: ohne users:read fehlt der Unterreiter Benutzer (wie bisher nur Admin)');
}
{
  // Electron-Fenster, angemeldet: ⚙ und die volle Statusleiste aus statusLeiste (eine Wahrheit).
  const s = angemeldeterStand();
  const html = ohneWurf('SC Rahmen angemeldet', () => rahmen(s));
  gleich(zahnrad(html).map((t) => attr(t, 'aria-label')), ['Einstellungen öffnen'], 'SC Rahmen angemeldet: im Electron-Fenster ⚙ „Einstellungen öffnen“, Panel beim Start zu');
  gleich(statusEintraege(html).map(([id]) => id), statusLeiste(s).map((i) => i.id), 'SC Rahmen angemeldet: die Statusleiste ist statusLeiste(stand) (Master-Link, Server, Licht, Fernsteuerung, Benutzer)');
  ok(html.includes('data-studio="inhalt-probe"') && !anmeldung(html), 'SC Rahmen angemeldet: angemeldet zeigt der Rahmen den Inhalt, nicht die Anmeldung');
  ok(!html.includes('data-onair'), 'SC Rahmen angemeldet: ohne gemessene Sendung keine ON-AIR-Anzeige, auch kein „bereit“ (B3)');
  const live = rahmen(angemeldeterStand({ atem: { ids: ['a1'], status: { a1: { state: 'connected', streaming: true } } } }));
  ok(live.includes('data-onair="live"') && text(bereich(live, 'data-onair', 'live')).includes('LIVE'), 'SC Rahmen angemeldet: ON AIR „LIVE“, wenn ein verbundener ATEM streamt (kopfOnAir, B3)');
  // Die Wurzel-View mit verbundenem Server (die Server-Meldung kommt aus App.tsx; ohne sie gilt kein Gerätezustand als gemessen).
  const Wurzel = oberflaeche.StudioOberflaeche;
  const wurzel = (server: boolean | undefined, patch: Parameters<typeof mitStore>[0]): string =>
    ohneWurf('SC Rahmen angemeldet', () => mitSitzung({ token: 't', user: sitzungsBenutzer() }, () => mitStore(patch, () => render(<Wurzel server={server} />))));
  const app = wurzel(true, STREAMT);
  ok(app.includes('data-onair="live"') && statusEintraege(app).some(([id, z]) => id === 'atem' && z === 'ok'), 'SC Rahmen angemeldet: die Wurzel liest die Geräte aus dem Store (ATEM verbunden → Eintrag ok, Stream → ON AIR)');
  const ohneServer = ohneWurf('SC Rahmen angemeldet', () => mitSitzung({ token: 't', user: sitzungsBenutzer() }, () => mitStore(STREAMT, () => render(<App />))));
  ok(
    !ohneServer.includes('data-onair') && statusEintraege(ohneServer).some(([id, z, t]) => id === 'atem' && z === 'off' && t === `ATEM: ${UNBEKANNT}`),
    'SC Rahmen angemeldet: vor der ersten Server-Meldung (App ohne Socket) kein ON AIR und ATEM unbekannt, auch wenn der Store einen streamenden ATEM hält (Ruling Task 18)',
  );
  // Zustand UND Titel: „unbekannt“ und „aus“ sind beide off, nur der Titel unterscheidet sie.
  // server ausdrücklich (kein Vorgabewert: ein Vorgabewert schluckte ein übergebenes undefined).
  const licht = (server: boolean | undefined, lighting: object | undefined): [string | undefined, string | undefined] | undefined => {
    const e = statusEintraege(wurzel(server, lighting === undefined ? {} : { lighting: lighting as never })).find(([id]) => id === 'licht');
    return e === undefined ? undefined : [e[1], e[2]];
  };
  gleich(
    [licht(true, undefined), licht(true, { node: { host: '192.0.2.20' }, fixtures: [] }), licht(true, { node: null, fixtures: [] })],
    [['off', `Licht: ${UNBEKANNT}`], ['ok', `Licht: ${ABSCHNITT_TEXTE.anOhneRueckmeldung}`], ['off', `Licht: ${ABSCHNITT_TEXTE.aus}`]],
    'SC Rahmen angemeldet: Licht unbekannt, bis der Server den Licht-Zustand geschickt hat; dann an (ohne Rückmeldung) bzw. aus',
  );
  gleich(
    [licht(false, { node: { host: '192.0.2.20' }, fixtures: [] }), licht(undefined, { node: null, fixtures: [] })],
    [['off', `Licht: ${UNBEKANNT}`], ['off', `Licht: ${UNBEKANNT}`]],
    'SC Rahmen angemeldet: ohne verbundenen Server ist Licht unbekannt, auch mit gemeldetem Zustand im Store (Ruling Task 18)',
  );
}
{
  // Rückrufe der Werkzeugleiste ohne DOM: Tabs wählen den Abschnitt, „Abmelden“ meldet ab; Rendern löst nichts aus.
  const log: string[] = [];
  const Leiste = leiste.Werkzeugleiste;
  const baum = typeof Leiste === 'function' ? Leiste({ abschnitt: 'video', onAbschnitt: (a: Section) => void log.push(`abschnitt:${a}`), benutzer: { name: 'Admin', rolle: 'admin' }, onAbmelden: () => void log.push('abmelden') }) : null;
  const alle = elemente(baum);
  gleich(log, [], 'SC Rahmen angemeldet: Rendern der Werkzeugleiste löst keine Aktion aus');
  const tabs = alle.find((e) => Array.isArray(e.props.items));
  const knopf = alle.find((e) => e.props['data-studio'] === 'abmelden');
  (tabs?.props.onChange as ((k: string) => void) | undefined)?.('licht');
  (knopf?.props.onClick as (() => void) | undefined)?.();
  gleich(log, ['abschnitt:licht', 'abmelden'], 'SC Rahmen angemeldet: Tabs setzen den Abschnitt, „Abmelden“ ruft onAbmelden');
  const rlog: string[] = [];
  rahmen(angemeldeterStand(), 'audio', false, rlog);
  gleich(rlog, [], 'SC Rahmen angemeldet: Rendern des Rahmens löst nichts aus');
}
{
  // Abmelden wie bisher (Topbar.tsx:37-44): POST /api/logout mit Token, Netzfehler verschluckt, Sitzung immer gelöscht.
  const ab = oberflaeche.abmelden;
  const lauf = async (ergebnis: 'ok' | 'fehler'): Promise<string[]> => {
    const log: string[] = [];
    if (typeof ab !== 'function') return ['fehlt'];
    const api = async (pfad: string, init?: { method?: string; token?: string | null }): Promise<never> => {
      log.push(`${init?.method} ${pfad} ${init?.token}`);
      if (ergebnis === 'fehler') throw new Error('Failed to fetch');
      return {} as never;
    };
    try {
      await ab('tok', () => void log.push('clearSession'), api);
    } catch {
      log.push('wurf');
    }
    return log;
  };
  gleich([await lauf('ok'), await lauf('fehler')], [['POST /api/logout tok', 'clearSession'], ['POST /api/logout tok', 'clearSession']], 'SC Rahmen angemeldet: „Abmelden“ schickt POST /api/logout mit dem Token und löscht die Sitzung, auch bei Netzfehler (wie bisher)');
}
{
  // Geänderte und neue Dateien: nur Tokens, keine neuen Kürzel, kein eigener Theme-Schalter.
  const dateien = ['App.tsx', 'views/StudioOberflaeche.tsx', 'views/Werkzeugleiste.tsx', 'views/Einstellungen.tsx', 'views/Login.tsx', 'views/Setup.tsx'];
  const ROH_FARBE = /\b(?:text|bg|border|from|via|to)-(?:white|black|red|green|blue|yellow|gray|zinc|neutral|slate|amber|emerald|rose|teal)(?:-\d+)?\b|#[0-9a-fA-F]{3,8}\b|rgba?\(/;
  gleich(dateien.filter((d) => existsSync(`src/renderer/src/${d}`) && ROH_FARBE.test(QUELLE(d))), [], 'SC Rahmen angemeldet: keine rohen Farben in den geänderten Dateien (nur Tokens)');
  gleich(dateien.filter((d) => !existsSync(`src/renderer/src/${d}`) || /keydown|keyup|addEventListener|accelerator/i.test(QUELLE(d))), [], 'SC Rahmen angemeldet: keine neuen Kürzel (kein keydown, B1)');
  ok(!rendererDateien().some((d) => /classList\.toggle\('(?:dark|light)'/.test(QUELLE(d))) && /<html[^>]*class="dark"/.test(leseText('src/renderer/index.html')), 'SC Rahmen angemeldet: kein eigener Theme-Schalter mehr; index.html behält class="dark" (B4)');
  ok(/tool="Studio Control"/.test(QUELLE('views/StudioOberflaeche.tsx')), 'SC Rahmen angemeldet: tool „Studio Control“ ohne „JM “ (der Kopf zeigt „JM Studio Control“)');
}

// ── SC Socket bleibt: der Socket-Effekt steht in der Wurzel und hängt nicht am Panel- oder Reiterzustand (N2b 2.10) ──
{
  const app = QUELLE('App.tsx');
  const ruf = 'connect(resolveServerUrl(), token, {';
  gleich(app.split(ruf).length - 1, 1, 'SC Socket bleibt: App.tsx baut den Socket genau einmal (connect(resolveServerUrl(), token, …))');
  gleich(
    rendererDateien().filter((d) => d !== 'App.tsx' && d !== 'sync/client.ts' && (/\bconnect\(\s*resolveServerUrl/.test(QUELLE(d)) || /import\s*\{[^}]*\bconnect\b[^}]*\}\s*from\s*'@\/sync\/client'/.test(QUELLE(d)))),
    [],
    'SC Socket bleibt: keine andere Datei verbindet den Socket (nicht Rahmen, Panel, Werkzeugleiste oder ein Reiter)',
  );
  const nachRuf = app.slice(app.indexOf(ruf));
  gleich(/\n {2}\}, \[([^\]]*)\]\);/.exec(nachRuf)?.[1], 'token, setConnected, clearSession', 'SC Socket bleibt: der Effekt hängt nur an Token und Sitzungsaktionen wie bisher, nicht an Panel, Reiter oder Abschnitt');
  const koerper = app.slice(app.indexOf('export function App('));
  const effekt = koerper.indexOf('useEffect(');
  ok(effekt > 0 && !/\breturn\b/.test(koerper.slice(0, effekt).replace(/\(\) => [^;]*;/g, '')), 'SC Socket bleibt: kein return vor dem Effekt in App (der Effekt läuft in jedem Zustand)');
  ok(koerper.slice(effekt, koerper.indexOf(ruf)).includes('if (!token && !window.jms?.isElectron) {'), 'SC Socket bleibt: ohne Token verbindet nur das Electron-Fenster (vor der Anmeldung wie heute), der Browser erst mit Token');
  gleich((app.match(/\bfunction\s+[A-Z]\w*/g) ?? []).length, 1, 'SC Socket bleibt: App.tsx hat genau eine Komponente (der Effekt steckt in keiner Unterkomponente hinter der Anmeldung)');
  ok(!/if \(!user\)/.test(app) && /<StudioOberflaeche\b/.test(app) && /<App \/>/.test(QUELLE('main.tsx')), 'SC Socket bleibt: main.tsx rendert App; App rendert die eine Wurzel-View für Anmeldung und Rahmen, ohne Login-Weiche um den Effekt');
  ok(!/\bsection\b|panelOffen|setSection|useApp\(\(/.test(app), 'SC Socket bleibt: App liest weder Abschnitt noch Panelzustand');
  ok(/onConnectionChange:[\s\S]*?setConnected\([\s\S]*?naechsterServerStand\(/.test(nachRuf) && /\+\+lauf\.current/.test(app), 'SC Socket bleibt: jede Verbindung bekommt eine Lauf-Kennung; nur Meldungen des aktuellen Sockets setzen server (naechsterServerStand, B15), setConnected bleibt');
  const app2 = ohneWurf('SC Socket bleibt', () => render(<App />));
  ok(anmeldung(app2), 'SC Socket bleibt: die Komponente mit dem Socket-Effekt rendert schon vor der Anmeldung (App zeigt die Anmeldung)');
}

// ── SC kein lokaler Rahmen: keine Datei importiert @/components/AppShell oder @/components/Topbar ──
{
  const IMPORT = /from\s+['"][^'"]*components\/(?:AppShell|Topbar|ComingSoon)['"]/;
  gleich(rendererDateien().filter((d) => IMPORT.test(leseText(`src/renderer/src/${d}`))), [], 'SC kein lokaler Rahmen: keine Datei importiert @/components/AppShell, @/components/Topbar oder ComingSoon');
  gleich(['components/AppShell.tsx', 'components/Topbar.tsx', 'components/ComingSoon.tsx'].filter((d) => existsSync(`src/renderer/src/${d}`)), [], 'SC kein lokaler Rahmen: AppShell.tsx, Topbar.tsx und ComingSoon.tsx sind gelöscht');
  gleich(rendererDateien().filter((d) => /\bfunction\s+(?:AppShell|Topbar|ComingSoon)\b/.test(QUELLE(d))), [], 'SC kein lokaler Rahmen: kein eigener Baustein namens AppShell, Topbar oder ComingSoon');
  ok(/import \{[^}]*\bAppShell\b[^}]*\} from '@jm\/ui'/.test(QUELLE('views/StudioOberflaeche.tsx')), 'SC kein lokaler Rahmen: der Rahmen ist AppShell aus @jm/ui');
}

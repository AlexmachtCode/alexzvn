// Galerie: jeder Baustein aus @jm/ui in jedem Zustand (Spec 3.10).
// Regel für diese Datei: keine Pflichtklasse der Bausteine (Liste PFLICHTKLASSEN in pruefe-klassen.ts), auch nicht im
// Kommentar, und keine Bewegungs-Variante. Maße und Token-Farben stehen als `style`. Sonst erzeugte Tailwind die Klassen
// aus der Galerie, und die Klassen-Probe sähe ein fehlendes `@source "../src"` nicht (Test „Galerie-Quelltext ohne
// Pflichtklassen“).
import { useState, type CSSProperties, type ReactElement } from 'react';
import {
  AppHeader,
  Button,
  Field,
  NumberInput,
  PanelAnker,
  Select,
  SettingsPanel,
  SettingsSection,
  StatusBar,
  StatusPill,
  TallyButton,
  TextInput,
  ThemeToggle,
  Toggle,
  type StatusItem,
  type StatusState,
  type TallyButtonProps,
} from '../src/index';
import { UI_TEXTE } from '../src/lib/texte';

export type Modus = 'dark' | 'light';
export interface Beispiel {
  /** Eindeutiger Name je Spalte, steht als data-beispiel im HTML. */
  name: string;
  /** Überschrift der Gruppe in der Galerie. */
  gruppe: string;
  /** Bildunterschrift: Zustand in Worten. */
  titel: string;
  element: ReactElement;
}

const nichts = (): void => undefined;

const FARBEN: Array<{ name: string; hinweis: string }> = [
  { name: '--tally-live', hinweis: 'auf Sendung' },
  { name: '--tally-ready', hinweis: 'bereit / ok' },
  { name: '--tally-selected', hinweis: 'ausgewählt' },
  { name: '--status-warn', hinweis: 'Warnung' },
  { name: '--status-error', hinweis: 'Fehler' },
  { name: '--status-off', hinweis: 'aus / unbekannt' },
  { name: '--surface-raised', hinweis: 'Panel-Fläche' },
  { name: '--field-border', hinweis: 'Rand von Eingabefeldern' },
];
const GROESSEN: Array<{ name: string; normal: string; kompakt: string; breite?: boolean }> = [
  { name: '--header-h', normal: '44 px', kompakt: '36 px' },
  { name: '--statusbar-h', normal: '28 px', kompakt: '24 px' },
  { name: '--control-h', normal: '32 px', kompakt: '32 px' },
  { name: '--control-h-lg', normal: '48 px', kompakt: '48 px' },
  { name: '--panel-w', normal: '360 px', kompakt: '360 px', breite: true },
];

function Farbkacheln(): React.JSX.Element {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {FARBEN.map((f) => (
        <li key={f.name} className="flex items-center gap-2 text-[11px]">
          <span
            aria-hidden="true"
            className="inline-block h-6 w-10 rounded-[var(--radius-md)] border border-[var(--border)]"
            style={{ background: `var(${f.name})` }}
          />
          <code>{f.name}</code>
          <span className="text-[var(--muted-foreground)]">{f.hinweis}</span>
        </li>
      ))}
    </ul>
  );
}

function Auswahlkachel({ modus }: { modus: Modus }): React.JSX.Element {
  // E5: hell ist „ausgewählt“ dunkel mit gelber Kante; die Kante ist eine Regel der Komponente, nicht des Tokens.
  const stil: CSSProperties = {
    background: 'var(--tally-selected)',
    color: 'var(--primary-foreground)',
    border: modus === 'light' ? '2px solid var(--brand-yellow)' : '2px solid transparent',
  };
  return (
    <div className="flex gap-2">
      <span className="rounded-[var(--radius-md)] px-3 py-2 text-xs font-bold" style={stil}>
        Kamera 2 (ausgewählt)
      </span>
      <span className="rounded-[var(--radius-md)] border-2 border-[var(--border)] px-3 py-2 text-xs">Kamera 3</span>
    </div>
  );
}

function Groessen({ kompakt }: { kompakt: boolean }): React.JSX.Element {
  return (
    <div data-dichte={kompakt ? 'kompakt' : undefined} className="space-y-1.5">
      {GROESSEN.map((g) => (
        <div key={g.name} className="flex items-center gap-2 text-[11px]">
          <span
            aria-hidden="true"
            className="inline-block rounded-[var(--radius-sm)] bg-[var(--secondary)]"
            style={g.breite ? { width: `var(${g.name})`, height: 8, maxWidth: '100%' } : { height: `var(${g.name})`, width: 24 }}
          />
          <code>{g.name}</code>
          <span className="text-[var(--muted-foreground)]">{kompakt ? g.kompakt : g.normal}</span>
        </div>
      ))}
    </div>
  );
}

const STATUS_GEMISCHT: StatusItem[] = [
  { id: 'sendung', group: 'tool', label: 'Bauchbinde', state: 'live', detail: 'auf Sendung seit 09:41' },
  { id: 'datalink', group: 'tool', label: 'DataLink', state: 'warn', detail: 'keine Datei im Ordner' },
  { id: 'ndi', group: 'ausgabe', label: 'NDI', state: 'ok', detail: 'sendet · 2 Empfänger' },
  { id: 'master', group: 'verbindung', label: 'Master', state: 'ok', detail: 'verbunden mit REGIE-PC' },
  { id: 'companion', group: 'fernsteuerung', label: 'Companion', state: 'off', detail: 'unbekannt' },
  { id: 'bildschirm', group: 'ausgabe', label: 'Bildschirm', state: 'error', detail: 'Bildschirm fehlt' },
];

function StatusBarMitKnoepfen(): React.JSX.Element {
  const [zuletzt, setZuletzt] = useState('–');
  const items = STATUS_GEMISCHT.map((i) => (i.id === 'sendung' ? i : { ...i, settingsSection: i.id }));
  return (
    <div className="space-y-1">
      <StatusBar items={items} onOpenSection={setZuletzt} />
      <p className="text-[11px] text-[var(--muted-foreground)]">Zuletzt geöffneter Abschnitt: {zuletzt}</p>
    </div>
  );
}

export type HaltenProbeWahl = 'bereit' | 'live' | 'gesperrt' | 'live-gesperrt';

const PROBE_WAHLEN: Array<{ wahl: HaltenProbeWahl; text: string }> = [
  { wahl: 'bereit', text: 'bereit' },
  { wahl: 'live', text: 'live' },
  { wahl: 'gesperrt', text: 'gesperrt' },
  { wahl: 'live-gesperrt', text: 'live + gesperrt' },
];

/**
 * Zustand und Grund des Probe-Knopfs je Wahl. Der Grund geht nur bei „gesperrt“ und „live + gesperrt“ mit: Seit dem
 * Owner-Entscheid O2 (09.10.2026) sperrt ein Grund auch einen Knopf im Zustand live.
 */
export function haltenProbeZustand(wahl: HaltenProbeWahl): Pick<TallyButtonProps, 'state' | 'disabledReason'> {
  if (wahl === 'gesperrt') return { state: 'gesperrt', disabledReason: 'Zum Ausprobieren gesperrt' };
  if (wahl === 'live-gesperrt') return { state: 'live', disabledReason: 'zum Ausprobieren' };
  return { state: wahl };
}

function HaltenProbe(): React.JSX.Element {
  const [wahl, setWahl] = useState<HaltenProbeWahl>('bereit');
  const [sichtbar, setSichtbar] = useState(true);
  const [zahl, setZahl] = useState({ gedrueckt: 0, losgelassen: 0, klicks: 0 });
  return (
    <div className="space-y-2">
      {sichtbar ? (
        <TallyButton
          {...haltenProbeZustand(wahl)}
          label="Sprechen (halten)"
          shortcut="Leertaste"
          onPress={() => setZahl((z) => ({ ...z, gedrueckt: z.gedrueckt + 1 }))}
          onRelease={() => setZahl((z) => ({ ...z, losgelassen: z.losgelassen + 1 }))}
          onClick={() => setZahl((z) => ({ ...z, klicks: z.klicks + 1 }))}
        />
      ) : (
        <p className="text-[11px]">Knopf ausgeblendet (Unmount)</p>
      )}
      <p className="tabular text-[11px]">
        gedrückt {zahl.gedrueckt} · losgelassen {zahl.losgelassen} · Klicks {zahl.klicks}
      </p>
      <div className="flex flex-wrap gap-2">
        {PROBE_WAHLEN.map((w) => (
          <Button key={w.wahl} type="button" size="sm" variant="outline" uppercase={false} onClick={() => setWahl(w.wahl)}>
            {w.text}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          uppercase={false}
          onClick={() => window.setTimeout(() => setWahl('gesperrt'), 2000)}
        >
          in 2 s sperren (dabei halten)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          uppercase={false}
          onClick={() => window.setTimeout(() => setWahl('live-gesperrt'), 2000)}
        >
          in 2 s live sperren (dabei halten)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          uppercase={false}
          onClick={() => window.setTimeout(() => setSichtbar(false), 2000)}
        >
          in 2 s ausblenden (dabei halten)
        </Button>
        <Button type="button" size="sm" variant="outline" uppercase={false} onClick={() => setSichtbar(true)}>
          wieder einblenden
        </Button>
      </div>
    </div>
  );
}

// Reiner Klick-Knopf (ohne Halten) mit eigenem Zähler: Messgerät für Owner-Prüfpunkt 7 „Take ziehen“ (drücken, vom Knopf
// wegziehen, loslassen: der Zähler bleibt gleich). Ohne Halten setzt TallyButton keinen Pointer Capture (Ruling T9).
function TakeProbe(): React.JSX.Element {
  const [klicks, setKlicks] = useState(0);
  return (
    <div className="space-y-2">
      <TallyButton state="bereit" label="Take" shortcut="Enter" onClick={() => setKlicks((n) => n + 1)} />
      <p className="tabular text-[11px]">{`Take-Klicks: ${klicks}`}</p>
    </div>
  );
}

function TextBeispiel(p: { fehler?: string; gesperrt?: string }): React.JSX.Element {
  const [wert, setWert] = useState(p.fehler ? '' : 'JM Titler');
  return (
    <Field label="Quellenname" hint="So heißt die Quelle im NDI-Netz." error={p.fehler} lockedReason={p.gesperrt}>
      <TextInput value={wert} onChange={setWert} />
    </Field>
  );
}

function ZahlBeispiel(p: { einheit?: string; ohneFeld?: boolean }): React.JSX.Element {
  const [wert, setWert] = useState<number | null>(p.einheit ? 5 : 8731);
  if (p.ohneFeld) return <NumberInput value={wert} onChange={setWert} min={1} max={65535} ganzzahl aria-label="Port" />;
  return p.einheit ? (
    <Field label="Vorlauf" hint="0 bis 60 Sekunden, Komma erlaubt.">
      <NumberInput value={wert} onChange={setWert} min={0} max={60} unit={p.einheit} />
    </Field>
  ) : (
    <Field
      label="Port"
      hint="1 bis 65535. Enter oder Verlassen übernimmt, Escape verwirft. Werte unter 1024 lehnt dieses Beispiel ab (nach 2 s „Noch nicht übernommen.“)."
    >
      <NumberInput
        value={wert}
        onChange={(n) => {
          if (n >= 1024) setWert(n);
        }}
        min={1}
        max={65535}
        ganzzahl
      />
    </Field>
  );
}

function SchalterBeispiel(p: { gesperrt?: string }): React.JSX.Element {
  const [an, setAn] = useState(true);
  return (
    <Field label="Transparenz" lockedReason={p.gesperrt}>
      <Toggle checked={an} onChange={setAn} />
    </Field>
  );
}

const GERAETE = [
  { value: 'mic-1', label: 'Focusrite USB (Eingang 1/2)' },
  { value: 'mic-2', label: 'Dante Virtual Soundcard' },
];
function AuswahlBeispiel(p: { start: string; gesperrt?: string; fehler?: string }): React.JSX.Element {
  const [wert, setWert] = useState(p.start);
  return (
    <Field label="Eingang" error={p.fehler} lockedReason={p.gesperrt}>
      <Select options={GERAETE} value={wert} onChange={setWert} placeholder={UI_TEXTE.bitteWaehlen} fehlendLabel="Shure MV7" />
    </Field>
  );
}

function PanelBeispiel({ modus }: { modus: Modus }): React.JSX.Element {
  const [offen, setOffen] = useState(true);
  const [abschnitt, setAbschnitt] = useState<string | undefined>(`${modus}-panel-b`);
  const anker = [
    { id: `${modus}-panel-a`, titel: 'Abschnitt A' },
    { id: `${modus}-panel-b`, titel: 'Abschnitt B' },
    { id: `${modus}-panel-c`, titel: 'Abschnitt C' },
  ];
  return (
    <div className="relative flex overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]" style={{ height: 380 }}>
      <div className="flex-1 space-y-2 p-3 text-xs">
        <p>Inhalt (Live-Bedienung)</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" uppercase={false} onClick={() => setOffen(!offen)}>
            {offen ? 'Panel schließen' : 'Panel öffnen'}
          </Button>
          {anker.map((a) => (
            <Button
              key={a.id}
              type="button"
              size="sm"
              variant="ghost"
              uppercase={false}
              onClick={() => {
                setOffen(true);
                setAbschnitt(a.id);
              }}
            >
              zu {a.titel}
            </Button>
          ))}
        </div>
      </div>
      <SettingsPanel open={offen} onClose={() => setOffen(false)} sectionId={abschnitt}>
        {anker.map((a) => (
          <PanelAnker key={a.id} id={a.id}>
            <SettingsSection title={a.titel} description="Escape schließt das Panel, solange der Fokus darin liegt.">
              <p className="text-xs" style={{ minHeight: 80 }}>
                Inhalt von {a.titel}
              </p>
            </SettingsSection>
          </PanelAnker>
        ))}
      </SettingsPanel>
    </div>
  );
}

function Tallys({ children }: { children: ReactElement }): React.JSX.Element {
  return <div style={{ width: 240 }}>{children}</div>;
}

const ZUSTAENDE: Array<{ state: StatusState; text: string }> = [
  { state: 'ok', text: 'verbunden' },
  { state: 'warn', text: 'an (ohne Rückmeldung)' },
  { state: 'error', text: 'Port belegt' },
  { state: 'off', text: 'unbekannt' },
  { state: 'live', text: 'auf Sendung' },
];

export function uiBeispiele(modus: Modus): Beispiel[] {
  const kopfMitte = <span className="text-xs text-[var(--muted-foreground)]">Show: Fachtagung 2026 · vom Master</span>;
  return [
    { name: 'farben', gruppe: 'Tokens', titel: 'Farben mit fester Bedeutung (als Fläche)', element: <Farbkacheln /> },
    { name: 'auswahl', gruppe: 'Tokens', titel: 'Ausgewählt: --tally-selected, hell mit gelber Kante', element: <Auswahlkachel modus={modus} /> },
    { name: 'groessen', gruppe: 'Tokens', titel: 'Größen (Dichte normal)', element: <Groessen kompakt={false} /> },
    { name: 'groessen-kompakt', gruppe: 'Tokens', titel: 'Größen (data-dichte="kompakt")', element: <Groessen kompakt /> },
    ...ZUSTAENDE.map((z) => ({
      name: `statuspill-${z.state}`,
      gruppe: 'StatusPill',
      titel: `${UI_TEXTE.zustand[z.state]}`,
      element: <StatusPill state={z.state} text={z.text} />,
    })),
    { name: 'statusbar-gemischt', gruppe: 'StatusBar', titel: 'Gruppen gemischt übergeben, Leiste ordnet; ohne Knöpfe', element: <StatusBar items={STATUS_GEMISCHT} /> },
    { name: 'statusbar-knoepfe', gruppe: 'StatusBar', titel: 'Einträge mit Abschnitt öffnen das Panel', element: <StatusBarMitKnoepfen /> },
    { name: 'statusbar-leer', gruppe: 'StatusBar', titel: 'Ohne Sitzung: nur die Uhr', element: <StatusBar items={[]} /> },
    { name: 'tally-bereit', gruppe: 'TallyButton', titel: 'bereit', element: <Tallys><TakeProbe /></Tallys> },
    { name: 'tally-live', gruppe: 'TallyButton', titel: 'live', element: <Tallys><TallyButton state="live" label="Bauchbinde 1" shortcut="Enter" onClick={nichts} /></Tallys> },
    { name: 'tally-live-gesperrt', gruppe: 'TallyButton', titel: 'auf Sendung und gesperrt', element: <Tallys><TallyButton state="live" label="Kamera 2" disabledReason="während der Überblendung" onClick={nichts} /></Tallys> },
    { name: 'tally-gesperrt', gruppe: 'TallyButton', titel: 'gesperrt mit Grund', element: <Tallys><TallyButton state="gesperrt" label="Clear" disabledReason="Nur im Live-Modus" onClick={nichts} /></Tallys> },
    { name: 'tally-gesperrt-ohne-grund', gruppe: 'TallyButton', titel: 'gesperrt ohne Grund (Fehler des Tools, sichtbar gemacht)', element: <Tallys><TallyButton state="gesperrt" label="Clear" onClick={nichts} /></Tallys> },
    { name: 'tally-halten', gruppe: 'TallyButton', titel: 'Halten zum Sprechen: Zähler zum Ausprobieren', element: <Tallys><HaltenProbe /></Tallys> },
    { name: 'eingabe-text', gruppe: 'Eingaben', titel: 'Text mit Hilfe', element: <TextBeispiel /> },
    { name: 'eingabe-text-fehler', gruppe: 'Eingaben', titel: 'Text mit Fehler', element: <TextBeispiel fehler="Bitte einen Namen eintragen." /> },
    { name: 'eingabe-text-gesperrt', gruppe: 'Eingaben', titel: 'Text gesperrt', element: <TextBeispiel gesperrt="Vom Master vorgegeben" /> },
    { name: 'eingabe-zahl', gruppe: 'Eingaben', titel: 'Zahl (ganzzahlig, 1–65535)', element: <ZahlBeispiel /> },
    { name: 'eingabe-zahl-einheit', gruppe: 'Eingaben', titel: 'Zahl mit Einheit', element: <ZahlBeispiel einheit="s" /> },
    { name: 'eingabe-zahl-ohne-feld', gruppe: 'Eingaben', titel: 'Zahl ohne Field (aria-label)', element: <ZahlBeispiel ohneFeld /> },
    { name: 'eingabe-schalter', gruppe: 'Eingaben', titel: 'Schalter', element: <SchalterBeispiel /> },
    { name: 'eingabe-schalter-gesperrt', gruppe: 'Eingaben', titel: 'Schalter gesperrt', element: <SchalterBeispiel gesperrt="Während der Sendung gesperrt" /> },
    { name: 'eingabe-auswahl', gruppe: 'Eingaben', titel: 'Auswahl', element: <AuswahlBeispiel start="mic-1" /> },
    { name: 'eingabe-auswahl-leer', gruppe: 'Eingaben', titel: 'Auswahl ohne Wert (Platzhalter)', element: <AuswahlBeispiel start="" /> },
    { name: 'eingabe-auswahl-fehlt', gruppe: 'Eingaben', titel: 'Gewähltes Gerät fehlt: bleibt gewählt', element: <AuswahlBeispiel start="mic-9" /> },
    { name: 'eingabe-auswahl-fehler', gruppe: 'Eingaben', titel: 'Auswahl mit Fehler', element: <AuswahlBeispiel start="" fehler="Bitte einen Eingang wählen." /> },
    { name: 'eingabe-auswahl-gesperrt', gruppe: 'Eingaben', titel: 'Auswahl gesperrt', element: <AuswahlBeispiel start="mic-2" gesperrt="Gesperrt, solange der Eingang offen ist" /> },
    { name: 'theme', gruppe: 'ThemeToggle', titel: 'zeigt den Zustand; wirkt auf <html>, die Spalten bleiben fest', element: <ThemeToggle /> },
    { name: 'panel', gruppe: 'SettingsPanel', titel: 'offen, Abschnitt B angesprungen', element: <PanelBeispiel modus={modus} /> },
    { name: 'kopf-live', gruppe: 'AppHeader', titel: 'On Air live, ⚙ vorhanden', element: <AppHeader tool="Titler" center={kopfMitte} onAir={{ live: true }} settingsAvailable settingsOpen={false} onSettingsToggle={nichts} mac={false} /> },
    { name: 'kopf-bereit', gruppe: 'AppHeader', titel: 'On Air bereit', element: <AppHeader tool="Switcher" onAir={{ live: false }} settingsAvailable settingsOpen={false} onSettingsToggle={nichts} mac={false} /> },
    { name: 'kopf-mac', gruppe: 'AppHeader', titel: 'macOS: Platz für die Ampel, ohne On Air und ohne ⚙', element: <AppHeader tool="Copy" mac /> },
    { name: 'kopf-panel-offen', gruppe: 'AppHeader', titel: 'Panel offen, eigenes On-Air-Label', element: <AppHeader tool="Recorder" onAir={{ live: true, label: 'AUFNAHME' }} settingsAvailable settingsOpen onSettingsToggle={nichts} mac={false} /> },
  ];
}

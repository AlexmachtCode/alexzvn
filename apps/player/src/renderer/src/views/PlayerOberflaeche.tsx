// Oberfläche des Players (UX Welle 2a, Player d1; Spec 3.1, 3.8, 5.1; E4, E5, E14, E15, E16): AppShell mit Kopf (JM Player,
// ON AIR, Hell/Dunkel, ⚙), Statusleiste aus lib/oberflaeche.ts und Einstellungs-Panel. Bibliothek, Soundboard und Cue-Show
// sind Tabs in der Werkzeugleiste (E14); im Inhalt steht die gewählte Ansicht.
// Die Weiche hängt nur am Reiter, wie bisher in App.tsx: Ein Reiterwechsel baut die alte Ansicht ab (ihre Tastenhörer, Suchfelder
// und die Vorschau der Bibliothek), die Wiedergabe von Show und Pads liegt im Store und in den Klangmaschinen und läuft
// weiter. Das Panel ist kein eigener Bildschirm: Es steht im AppShell neben dem Inhalt, steckt in keinem key und keiner
// Bedingung um die Ansicht; die Ansicht samt Leertaste und Esc bleibt gemountet. Die Ansichten sind memo, damit
// Statusleiste, Panel und Videofortschritt sie nicht neu rendern.
// Brücken, Pad-Meldung, Bildschirmliste, Vollbild und die Hinweisleiste laufen hier, auch bei geschlossenem Panel; das Panel
// selbst hat keine Effekte (E15). window.jmplay nur in Effekten und Rückrufen, nie beim Rendern.
import { memo, useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ScreenOption } from '@jm/settings';
import { AppShell, cn, Tabs, useBrueckenWert, type TabItem } from '@jm/ui';
import { baueAktionen, liesBildschirme, liesVollbild, padsAbonnieren } from '@/lib/aktionen';
import { AUSGABE_QUELLE, FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE } from '@/lib/bruecken';
import { cueEngine } from '@/lib/cues';
import { ABSCHNITT, kopfOnAir, statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import { usePlayer } from '@/store/player';
import { Einstellungen } from './Einstellungen';
import { LibraryView } from './LibraryView';
import { ShowView } from './ShowView';
import { SoundboardView } from './SoundboardView';

export type Reiter = 'library' | 'soundboard' | 'show';

const Bibliothek = memo(LibraryView);
const Soundboard = memo(SoundboardView);
const CueShow = memo(ShowView);

/** Die drei Reiter mit den Texten der alten Navigation: Name, ab großer Fensterbreite der Zusatz. */
const REITER: TabItem<Reiter>[] = [
  { key: 'library', label: 'Bibliothek', hint: 'Medien · Playlists' },
  { key: 'soundboard', label: 'Soundboard', hint: 'Sofort-Cues · Hotkeys' },
  { key: 'show', label: 'Cue-Show', hint: 'GO · QLab-Stil' },
].map((r) => ({
  key: r.key as Reiter,
  label: (
    <>
      <span>{r.label}</span>
      <span className="hidden text-[10px] font-semibold tracking-[0.12em] opacity-70 lg:inline">{r.hint}</span>
    </>
  ),
}));

/**
 * Abstand der Hinweisleiste vom unteren Fensterrand je Reiter (Player d2): über der Leiste unten, nie über Statusleiste, Stop
 * oder Panik. Bibliothek und Soundboard: über der Fußleiste (Rand, py-3 und eine TallyButton-Höhe, dazu 0,75 rem Luft).
 * Cue-Show: über dem Transport (Standby, Rand, py-3 und die feste Tastenzeile, rund 143 px bei --text-base 15 px), dazu Luft.
 * Vorher lag der Hinweis 1,25 rem über der Statusleiste und deckte 4 s lang Fußleiste und Transport (gemessen, t16-messung.mjs).
 */
const HINWEIS_UNTEN: Record<Reiter, string> = {
  library: 'bottom-[calc(var(--statusbar-h)+var(--control-h-lg)+2.25rem)]',
  soundboard: 'bottom-[calc(var(--statusbar-h)+var(--control-h-lg)+2.25rem)]',
  show: 'bottom-[calc(var(--statusbar-h)+10.5rem)]',
};

export function PlayerOberflaeche({
  anfangOffen = false,
  anfangReiter = 'library',
}: {
  /** Panel beim Start offen (nur für Tests; im Betrieb zu, nichts gemerkt). */
  anfangOffen?: boolean;
  /** Reiter beim Start (nur für Tests; im Betrieb immer die Bibliothek, nicht gemerkt). */
  anfangReiter?: Reiter;
}): React.JSX.Element {
  const geladen = usePlayer((s) => !s.loading);
  const player = usePlayer(
    useShallow((s) => ({
      activeShowId: s.activeShowId,
      showCues: s.showCues,
      standbyIndex: s.standbyIndex,
      playingCueIds: s.playingCueIds,
      vorlaufCueIds: s.vorlaufCueIds,
      showPaused: s.showPaused,
      videoCue: s.videoCue,
      videoProgress: s.videoProgress,
      outputDisplayId: s.outputDisplayId,
    })),
  );
  const openOutput = usePlayer((s) => s.openOutput);
  const closeOutput = usePlayer((s) => s.closeOutput);
  const setOutputDisplayId = usePlayer((s) => s.setOutputDisplayId);
  const notice = usePlayer((s) => s.notice);
  const setNotice = usePlayer((s) => s.setNotice);

  // Reiter: Start immer Bibliothek, nicht gemerkt (wie bisher).
  const [reiter, setReiter] = useState<Reiter>(anfangReiter);

  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt; offen über ⚙, einen Statuseintrag oder „▦ Ausgabe“.
  const [panelOffen, setPanelOffen] = useState(anfangOffen);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);
  const ausgabeOeffnen = useCallback(() => {
    setPanelOffen(true);
    setPanelAbschnitt(ABSCHNITT.ausgabe);
  }, []);

  // Lesende Brücken (Spec 3.9): undefined, bis eine Antwort oder ein Ereignis da ist; ohne Preload null.
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);
  const fernsteuerung = useBrueckenWert(FERNSTEUERUNG_QUELLE);
  const ausgabe = useBrueckenWert(AUSGABE_QUELLE);

  // Pad-Meldung der cueEngine (W2-1): undefined bis zum Abo, dann vorbelegt mit den spielenden Pads; Abmeldung im Aufräumen.
  const [pads, setPads] = useState<number[] | undefined>(undefined);
  useEffect(() => padsAbonnieren(cueEngine, setPads), []);

  // Bildschirmliste: beim Start und bei jedem Öffnen des Panels frisch (undefined, bis eine Antwort da ist; ein Fehler setzt
  // sie auf unbekannt zurück).
  const [bildschirme, setBildschirme] = useState<ScreenOption[] | undefined>(undefined);
  useEffect(() => liesBildschirme(window.jmplay?.output?.displays, setBildschirme), []);

  // Vollbild (E14): gemessen bei jeder Änderung des Ausgabezustands, bei jedem Öffnen des Panels und nach jeder Ausgabe-Aktion,
  // nie geraten (das Ausgabefenster kann das Vollbild auch ohne diese Ereignisse wechseln, z. B. F11).
  const [vollbild, setVollbild] = useState<boolean | null | undefined>(undefined);
  useEffect(() => liesVollbild(window.jmplay?.output?.isFullscreen, setVollbild), [ausgabe]);
  const vollbildNeuLesen = useCallback(() => void liesVollbild(window.jmplay?.output?.isFullscreen, setVollbild), []);

  // Bei jedem Öffnen des Panels: Bildschirmliste und Vollbild frisch (beim Schließen nichts).
  useEffect(() => {
    if (!panelOffen) return undefined;
    const listeAb = liesBildschirme(window.jmplay?.output?.displays, setBildschirme);
    const vollbildAb = liesVollbild(window.jmplay?.output?.isFullscreen, setVollbild);
    return () => {
      listeAb();
      vollbildAb();
    };
  }, [panelOffen]);

  // Hinweisleiste (Import, „zur Playlist hinzugefügt“): verschwindet nach 4 Sekunden (wie bisher in App.tsx).
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);

  // Ein Stand für Statusleiste, Panel und ON AIR (lib/oberflaeche.ts): alle zeigen dieselbe Ableitung.
  const stand: OberflaechenStand = {
    player: geladen ? player : undefined,
    pads,
    ausgabe,
    vollbild,
    masterLink,
    fernsteuerung,
    ...(bildschirme === undefined ? {} : { bildschirme }),
  };
  const aktionen = baueAktionen({
    outputDisplayId: player.outputDisplayId,
    vollbild,
    setOutputDisplayId,
    openOutput,
    closeOutput,
    toggleFullscreen: () => window.jmplay.output.toggleFullscreen(),
    nachAusgabe: vollbildNeuLesen,
  });

  return (
    <AppShell
      tool="Player"
      onAir={kopfOnAir(stand)}
      status={statusLeiste(stand)}
      toolbar={<Tabs items={REITER} value={reiter} onChange={setReiter} fill={false} />}
      settings={<Einstellungen stand={stand} aktionen={aktionen} />}
      settingsOpen={panelOffen}
      settingsSection={panelAbschnitt}
      onSettingsChange={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    >
      {reiter === 'library' ? <Bibliothek /> : reiter === 'soundboard' ? <Soundboard /> : <CueShow onAusgabe={ausgabeOeffnen} />}

      {notice && (
        <div className={cn('pointer-events-none fixed inset-x-0 flex justify-center px-6', HINWEIS_UNTEN[reiter])}>
          <div
            className="pointer-events-auto rounded-[var(--radius-lg)] border border-[var(--primary)]/40
                       bg-[var(--card)] px-4 py-2.5 text-sm font-semibold shadow-lg max-w-xl text-center"
          >
            {notice}
          </div>
        </div>
      )}
    </AppShell>
  );
}

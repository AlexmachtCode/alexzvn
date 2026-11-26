// Oberfläche des Recorders (UX Welle 2a, Recorder d; Spec 3.1, 3.8, 5.1; E4, E5, E13, E15, E16): AppShell mit Kopf (JM Audio
// Recorder, ON AIR nur bei recording, Hell/Dunkel, ⚙), Statusleiste aus lib/oberflaeche.ts und Einstellungs-Panel. Im Inhalt
// oben der Live-Bereich (Preset-Leiste, Hinweise, Tasten, Uhr, Marke, Ziel, Verstärkung, Meter), darunter der Arbeitsbereich mit
// dem Zeitplan. Das Panel ist kein eigener Bildschirm: Es steht im AppShell neben dem Inhalt, steckt in keinem key und in keiner
// Bedingung um den Live-Bereich; nichts hier baut Meter oder Live-Bereich um, auch nicht während einer Aufnahme.
// Abläufe in der View, auch bei geschlossenem Panel: die Brücken (Master-Link, Fernsteuerung, gemessener Zustand), das Abo der
// Main-Meldung und der Toast. init() bleibt im App-Wurzelknoten (App.tsx). window.jmrec nur in Effekten und Rückrufen.
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AppShell, useBrueckenWert } from '@jm/ui';
import { PresetLeiste } from '@/components/PresetLeiste';
import { meldungAbonnieren, panelAktionen } from '@/lib/aktionen';
import { FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE, ZUSTAND_QUELLE } from '@/lib/bruecken';
import { kopfOnAir, statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import { useRec } from '@/store/recorder';
import { Einstellungen } from './Einstellungen';
import { LiveBereich, type LiveAktionen } from './LiveBereich';
import { ScheduleCard } from './RecorderView';

export function RecorderOberflaeche({
  anfangOffen = false,
}: {
  /** Panel beim Start offen (nur für Tests; im Betrieb zu, nichts gemerkt). */
  anfangOffen?: boolean;
}): React.JSX.Element {
  // Gemerkter Wunsch und Startlage aus dem Store (RecorderZustand); der Zustand des Aufnahmekerns kommt getrennt (zustand).
  const recorder = useRec(
    useShallow((s) => ({ deviceIndex: s.deviceIndex, channels: s.channels, sampleRate: s.sampleRate, loading: s.loading, hinweisEingang: s.hinweisEingang })),
  );
  const devices = useRec((s) => s.devices);
  const peaks = useRec((s) => s.peaks);
  const gainDb = useRec((s) => s.gainDb);
  const hinweisOrdner = useRec((s) => s.hinweisOrdner);
  const netzordnerOffen = useRec((s) => s.netzordnerOffen);
  const dir = useRec((s) => s.dir);
  const fileName = useRec((s) => s.fileName);
  const separateTracks = useRec((s) => s.separateTracks);
  const notice = useRec((s) => s.notice);
  const setNotice = useRec((s) => s.setNotice);

  // Store-Aktionen unter ihrem Namen (dieselben wie in der alten RecorderView).
  const selectDevice = useRec((s) => s.selectDevice);
  const refreshDevices = useRec((s) => s.refreshDevices);
  const setChannels = useRec((s) => s.setChannels);
  const setSampleRate = useRec((s) => s.setSampleRate);
  const pickDir = useRec((s) => s.pickDir);
  const setFileName = useRec((s) => s.setFileName);
  const setSeparateTracks = useRec((s) => s.setSeparateTracks);
  const arm = useRec((s) => s.arm);
  const disarm = useRec((s) => s.disarm);
  const record = useRec((s) => s.record);
  const stop = useRec((s) => s.stop);
  const setGain = useRec((s) => s.setGain);
  const hinweiseSchliessen = useRec((s) => s.hinweiseSchliessen);
  const netzordnerUebernehmen = useRec((s) => s.netzordnerUebernehmen);

  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt; offen über ⚙ oder einen Statuseintrag.
  const [panelOffen, setPanelOffen] = useState(anfangOffen);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);

  // Lesende Brücken (Spec 3.9): undefined, bis eine Antwort oder ein Ereignis da ist; ohne Preload null.
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);
  const fernsteuerung = useBrueckenWert(FERNSTEUERUNG_QUELLE);
  // Gemessener Zustand (Übergabe Task 20): einmal getState beim Einhängen, danach onState; ein späterer Push gewinnt. Nie der
  // Zustand des Stores, der mit IDLE beginnt und nie fragt. null (kein Preload, Ablehnung) heißt unbekannt.
  const gemessen = useBrueckenWert(ZUSTAND_QUELLE);
  const zustand = gemessen ?? undefined;

  // Meldung des Hauptprozesses bis „OK“ (E13, Ruling P3): eigenes Abo, getrennt vom Toast des Stores; eine neuere ersetzt die ältere.
  const [meldung, setMeldung] = useState<string | null>(null);
  useEffect(() => meldungAbonnieren(window.jmrec?.onNotice, setMeldung), []);

  // Toast (Nr. 54): wie bisher in App.tsx, 5 s nach jeder Änderung des Textes leer.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice, setNotice]);

  // Ein Stand für Statusleiste, Panel, ON AIR und Haupttasten (lib/oberflaeche.ts): alle zeigen dieselbe Ableitung.
  const stand: OberflaechenStand = { recorder, zustand, geraete: devices, meldung, masterLink, fernsteuerung };
  const panel = panelAktionen({ selectDevice, refreshDevices, setChannels, setSampleRate, pickDir, setFileName, setSeparateTracks });
  const live: LiveAktionen = {
    arm: () => void arm(),
    disarm: () => void disarm(),
    record: () => void record(),
    stop: () => void stop(),
    setGain,
    hinweiseSchliessen,
    netzordnerUebernehmen: () => void netzordnerUebernehmen(),
    meldungQuittieren: () => setMeldung(null),
    dateiZeigen: (pfad) => void window.jmrec.shell.reveal(pfad),
  };

  return (
    <AppShell
      tool="Audio Recorder"
      onAir={kopfOnAir(stand)}
      status={statusLeiste(stand)}
      settings={<Einstellungen stand={stand} ziel={{ dir, fileName, separateTracks }} aktionen={panel} />}
      settingsOpen={panelOffen}
      settingsSection={panelAbschnitt}
      onSettingsChange={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    >
      <div className="relative mx-auto max-w-[1100px] space-y-4 px-5 py-4">
        {/* Toast (Nr. 54; Fix-Runde 1 und 2, Rulings): oben mittig über der Preset-Leiste (nicht live-kritisch), nie über Tasten,
            Uhr, Marke, Metern, Meldung oder Statusleiste. Er scrollt mit dem Inhalt (absolut im oberen Bereich dieses Wrappers,
            weder sticky noch fixed): Scrollt main, wandert er mit der Preset-Leiste aus dem Bild. Höhe 0 und außerhalb des Flusses
            (nimmt keinen Platz, nichts verschiebt sich), so breit wie der Inhalt (nie über dem Panel). */}
        {notice && (
          <div data-recorder="toast-ebene" className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-0 items-start justify-center px-6">
            <div
              data-recorder="toast"
              className="pointer-events-auto mt-2 rounded-[var(--radius-lg)] border border-[var(--primary)]/40
                         bg-[var(--card)] px-4 py-2.5 text-sm font-semibold shadow-lg max-w-2xl text-center truncate"
            >
              {notice}
            </div>
          </div>
        )}
        <LiveBereich stand={stand} werte={{ peaks, gainDb, hinweisOrdner, dir, netzordnerOffen }} aktionen={live} presets={<PresetLeiste />} />
        <div data-recorder="arbeitsbereich">
          <ScheduleCard zustand={zustand} />
        </div>
      </div>
    </AppShell>
  );
}

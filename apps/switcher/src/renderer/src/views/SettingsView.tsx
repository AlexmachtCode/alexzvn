import { useEffect, useState } from 'react';
import {
  useSettings,
  RESOLUTIONS,
  OUTPUT_FPS_OPTIONS,
  recommendedBitrate,
  type ProgramResolution,
} from '@/store/settings';
import type { ControlStatus, DisplayInfo } from '@shared/types';

export function SettingsView() {
  const {
    rtmpUrl,
    streamBitrateKbps,
    recordBitrateKbps,
    controlEnabled,
    controlPort,
    audioInputId,
    ndiOutputName,
    programResolution,
    outputFps,
    secondScreenEnabled,
    secondScreenDisplayId,
    setRtmpUrl,
    setStreamBitrateKbps,
    setRecordBitrateKbps,
    setControlEnabled,
    setControlPort,
    setAudioInputId,
    setNdiOutputName,
    setProgramResolution,
    setOutputFps,
    setSecondScreenEnabled,
    setSecondScreenDisplayId,
  } = useSettings();

  const [ctrl, setCtrl] = useState<ControlStatus>({ running: false, port: controlPort, clients: 0 });
  useEffect(() => {
    void window.jmswitch.control.getStatus().then(setCtrl);
    return window.jmswitch.control.onStatus(setCtrl);
  }, []);

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const scanAudio = (): void => {
    void listAudioInputs().then(setAudioDevices).catch(() => setAudioDevices([]));
  };
  useEffect(() => {
    scanAudio();
  }, []);

  // Angeschlossene Monitore für die Zweitbildschirm-Auswahl (aktualisierbar, falls einer dazukommt).
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const scanDisplays = (): void => {
    void window.jmswitch.screen
      .listDisplays()
      .then(setDisplays)
      .catch(() => setDisplays([]));
  };
  useEffect(() => {
    scanDisplays();
  }, []);

  return (
    <div className="h-full overflow-auto scroll-thin px-6 py-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Einstellungen</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Stream-Ziel und Qualität. Aufnahme &amp; Stream startest du in der Mischer-Ansicht.
          </p>
        </div>

        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-5 flex flex-col gap-5">
          <h2 className="text-[11px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
            Streaming (RTMP)
          </h2>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">RTMP-Ziel</span>
            <input
              type="text"
              value={rtmpUrl}
              onChange={(e) => setRtmpUrl(e.target.value)}
              placeholder="rtmp://server/app/streamkey"
              className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)]"
            />
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Vollständige URL inkl. Streamkey (z. B. YouTube-/Twitch-Ingest oder lokaler nginx-rtmp).
            </span>
          </label>

          <label className="flex flex-col gap-1.5 max-w-xs">
            <span className="text-sm font-bold">Stream-Bitrate</span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={500}
                max={20000}
                step={250}
                value={streamBitrateKbps}
                onChange={(e) => setStreamBitrateKbps(Number(e.target.value))}
                className="h-10 w-32 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-center tabular text-[var(--foreground)]"
              />
              <span className="text-sm text-[var(--muted-foreground)]">kbit/s</span>
            </span>
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Video-Bitrate des H.264-Streams (x264). Empfohlen für{' '}
              {programResolution === '1080p' ? 'Full-HD 1080p' : 'HD 720p'}:{' '}
              {recommendedBitrate(programResolution, 'stream').min.toLocaleString('de-DE')}–
              {recommendedBitrate(programResolution, 'stream').max.toLocaleString('de-DE')} kbit/s.
            </span>
          </label>

          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed border-t border-[var(--border)]/60 pt-4">
            Auflösung:{' '}
            <span className="font-semibold text-[var(--foreground)]">
              {RESOLUTIONS[programResolution].w}×{RESOLUTIONS[programResolution].h} @ {outputFps} fps
            </span>{' '}
            · Ton:{' '}
            {audioInputId
              ? 'Programm-Ton der gewählten Audioquelle'
              : 'stille AAC-Spur (keine Audioquelle gewählt)'}
            . Der Stream wird aus dem Program-Bild kodiert (libx264, zerolatency) — die Auflösung
            folgt der Programm-Auflösung, es wird nie hochskaliert. Eine geänderte Bildrate wirkt
            bei laufender Aufnahme oder Sendung erst beim nächsten Start.
          </p>
        </section>

        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-5 flex flex-col gap-5">
          <h2 className="text-[11px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
            NDI-Ausgabe
          </h2>
          <label className="flex flex-col gap-1.5 max-w-md">
            <span className="text-sm font-bold">NDI-Quellname</span>
            <input
              type="text"
              value={ndiOutputName}
              onChange={(e) => setNdiOutputName(e.target.value)}
              placeholder="JM Switcher"
              className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)]"
            />
            <span className="text-[11px] text-[var(--muted-foreground)]">
              So erscheint die Ausgabe im Netz (z. B. als Eingang in TriCaster, vMix, OBS oder einem
              NDI-Monitor). In der Mischer-Leiste wählst du, ob das Program-Bild oder das Multiview
              gesendet wird, und schaltest die Ausgabe live an/aus.
            </span>
          </label>
          <div className="flex flex-wrap gap-5 border-t border-[var(--border)]/60 pt-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold">Programm-Auflösung</span>
              <select
                value={programResolution}
                onChange={(e) => setProgramResolution(e.target.value as ProgramResolution)}
                className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)]"
              >
                {(Object.keys(RESOLUTIONS) as ProgramResolution[]).map((r) => (
                  <option key={r} value={r}>
                    {r === '1080p' ? 'Full-HD 1080p' : 'HD 720p'} ({RESOLUTIONS[r].w}×{RESOLUTIONS[r].h})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold">NDI-Bildrate</span>
              <select
                value={outputFps}
                onChange={(e) => setOutputFps(Number(e.target.value))}
                className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)]"
              >
                {OUTPUT_FPS_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f} fps
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
            Gilt für NDI, Aufnahme und RTMP — das Programm wird in dieser Auflösung komponiert
            (kein Hochskalieren). <span className="font-semibold text-[var(--foreground)]">1080p</span> ist
            echtes Full-HD und kostet mehr Rechenleistung; auf schwächeren Rechnern
            <span className="font-semibold text-[var(--foreground)]"> 720p</span> wählen. Das Multiview
            bleibt 720p und zeigt Program + Preview groß plus alle Szenen als Kacheln mit Tally.
          </p>
        </section>

        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-5 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[11px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
              Zweiter Bildschirm
            </h2>
            <button
              type="button"
              onClick={scanDisplays}
              className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted-foreground)] hover:text-[var(--primary)]"
            >
              Monitore aktualisieren
            </button>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={secondScreenEnabled}
              onChange={(e) => setSecondScreenEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-bold">Programm-Ausgabe im Vollbild auf einem Monitor</span>
          </label>
          <label className="flex flex-col gap-1.5 max-w-md">
            <span className="text-sm font-bold">Monitor</span>
            <select
              value={
                displays.some((d) => d.id === secondScreenDisplayId)
                  ? secondScreenDisplayId
                  : (displays.find((d) => d.primary)?.id ?? displays[0]?.id ?? 0)
              }
              onChange={(e) => setSecondScreenDisplayId(Number(e.target.value))}
              disabled={displays.length === 0}
              className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)] disabled:opacity-50"
            >
              {displays.length === 0 && <option value={0}>Kein Monitor gefunden</option>}
              {displays.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                  {d.primary ? ' · Hauptmonitor' : ''}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
            Zeigt das On-Air-Programmbild formatfüllend auf dem gewählten Monitor — per HDMI direkt an
            Beamer, Kontrollmonitor oder Encoder. Läuft unabhängig von NDI und der Aufnahme; wähle für die
            Regie am besten einen anderen Monitor als den mit der Bedienoberfläche.
          </p>
        </section>

        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-5 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[11px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
              Programm-Audio
            </h2>
            <button
              type="button"
              onClick={scanAudio}
              className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted-foreground)] hover:text-[var(--primary)]"
            >
              Geräte aktualisieren
            </button>
          </div>

          <label className="flex flex-col gap-1.5 max-w-md">
            <span className="text-sm font-bold">Audioquelle</span>
            <select
              value={audioInputId}
              onChange={(e) => setAudioInputId(e.target.value)}
              className="h-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)]"
            >
              <option value="">— Kein Ton (stille Spur) —</option>
              {audioDevices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Audiogerät ${i + 1}`}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Mikro / Line-In / Capture-Ton. Wird in Aufnahme + Stream gemischt; Pegel &amp; Mute in der
              Mischer-Leiste. Audio folgt (noch) nicht der Bildquelle — feste Programm-Audioquelle.
            </span>
          </label>
        </section>

        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-5 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[11px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
              Fernsteuerung (Bitfocus Companion)
            </h2>
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
              <span
                className="size-2 rounded-full"
                style={{ background: ctrl.running ? 'var(--success)' : 'var(--muted-foreground)' }}
              />
              {ctrl.running ? `aktiv · Port ${ctrl.port} · ${ctrl.clients} Client(s)` : 'aus'}
            </span>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={controlEnabled}
              onChange={(e) => setControlEnabled(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            <span className="text-sm font-bold">TCP-Steuerserver aktivieren</span>
          </label>

          <label className="flex flex-col gap-1.5 max-w-xs">
            <span className="text-sm font-bold">Port</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={controlPort}
              onChange={(e) => setControlPort(Number(e.target.value))}
              className="h-10 w-32 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-center tabular text-[var(--foreground)]"
            />
          </label>

          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed border-t border-[var(--border)]/60 pt-4">
            Zeilenprotokoll (PREVIEW/PROGRAM/CUT/AUTO/RECORD/STREAM) für ein Stream-Deck via
            Bitfocus Companion — Modul: <span className="font-semibold text-[var(--foreground)]">packages/companion-jm-switcher</span>.
            Im Companion-Modul Host (IP dieses Rechners) + Port eintragen.
          </p>
        </section>

        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-5 flex flex-col gap-5">
          <h2 className="text-[11px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
            Aufnahme
          </h2>
          <label className="flex flex-col gap-1.5 max-w-xs">
            <span className="text-sm font-bold">Aufnahme-Bitrate</span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={1000}
                max={60000}
                step={500}
                value={recordBitrateKbps}
                onChange={(e) => setRecordBitrateKbps(Number(e.target.value))}
                className="h-10 w-32 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-center tabular text-[var(--foreground)]"
              />
              <span className="text-sm text-[var(--muted-foreground)]">kbit/s</span>
            </span>
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Video-Bitrate der WebM-Aufnahme. Empfohlen für{' '}
              {programResolution === '1080p' ? 'Full-HD 1080p' : 'HD 720p'}:{' '}
              {recommendedBitrate(programResolution, 'record').min.toLocaleString('de-DE')}–
              {recommendedBitrate(programResolution, 'record').max.toLocaleString('de-DE')} kbit/s.
            </span>
          </label>
          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed border-t border-[var(--border)]/60 pt-4">
            Aufnahmen werden als <span className="font-semibold text-[var(--foreground)]">WebM</span>{' '}
            gespeichert (Speicherort wird beim Start abgefragt). Für MP4 die Datei im
            <span className="font-semibold text-[var(--foreground)]"> JM Media Converter</span> umwandeln.
          </p>
        </section>
      </div>
    </div>
  );
}

/** Audio-Eingänge auflisten; bei leeren Labels kurz Permission anfordern. */
async function listAudioInputs(): Promise<MediaDeviceInfo[]> {
  let devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = (): MediaDeviceInfo[] => devices.filter((d) => d.kind === 'audioinput');
  if (inputs().length === 0 || inputs().every((d) => !d.label)) {
    let probe: MediaStream | null = null;
    try {
      probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      devices = await navigator.mediaDevices.enumerateDevices();
    } finally {
      probe?.getTracks().forEach((t) => t.stop());
    }
  }
  return inputs();
}

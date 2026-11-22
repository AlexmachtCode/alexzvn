// Oberfläche des Prompters (UX Welle 2a, Aufgabe d; Spec 3.1, 3.8, 5.1; E4, E5, E6): AppShell mit Kopf (JM Prompter, ON AIR, ⚙,
// Hell/Dunkel), Statusleiste aus lib/oberflaeche.ts und Einstellungs-Panel. Im Inhalt links das Skript (Textarea und „Datei laden“),
// rechts der Live-Bereich. Das Panel ist kein eigener Bildschirm: Es steht im AppShell neben dem Inhalt, der Live-Bereich bleibt samt
// Leertaste gemountet. Brücken, Bildschirmliste und Aktionen laufen hier, auch bei geschlossenem Panel; das Panel selbst hat keine
// Effekte (E15). Die Ausgabeansicht (#output) ist davon unberührt (E6).
import { useEffect, useState } from 'react';
import type { ScreenOption } from '@jm/settings';
import { AppShell, Button, useBrueckenWert } from '@jm/ui';
import { positionEm } from '@shared/types';
import { AUSGABE_QUELLE, FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE } from '@/lib/bruecken';
import { kopfOnAir, statusLeiste, type OberflaechenStand } from '@/lib/oberflaeche';
import { usePrompter } from '@/store/prompter';
import { Einstellungen, type EinstellungenAktionen } from './Einstellungen';
import { LiveBereich, type LiveAktionen } from './LiveBereich';

export function PrompterOberflaeche({
  anfangOffen = false,
}: {
  /** Panel beim Start offen (nur für Tests; im Betrieb zu, nichts gemerkt). */
  anfangOffen?: boolean;
}): React.JSX.Element {
  const state = usePrompter((s) => s.state);
  const setConfig = usePrompter((s) => s.setConfig);
  const importScript = usePrompter((s) => s.importScript);
  const setMarkers = usePrompter((s) => s.setMarkers);
  const markersEm = usePrompter((s) => s.markersEm);
  const openOutput = usePrompter((s) => s.openOutput);
  const closeOutput = usePrompter((s) => s.closeOutput);
  const setRemote = usePrompter((s) => s.setRemote);

  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt; offen über ⚙ oder einen Statuseintrag.
  const [panelOffen, setPanelOffen] = useState(anfangOffen);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);

  // Bildschirmliste: frisch beim Öffnen des Panels (undefined, bis eine Antwort da ist; ohne Preload bleibt sie unbekannt).
  const [bildschirme, setBildschirme] = useState<ScreenOption[] | undefined>(undefined);
  useEffect(() => {
    if (!panelOffen || !window.jmprompt?.output) return;
    let weg = false;
    void window.jmprompt.output.displays().then(
      (liste) => {
        if (!weg) setBildschirme(liste.map((d) => ({ id: d.id, label: `${d.label} (${d.width}×${d.height})`, primary: d.primary })));
      },
      () => undefined,
    );
    return () => {
      weg = true;
    };
  }, [panelOffen]);

  // Lesende Brücken (Spec 3.9): undefined, bis eine Antwort oder ein Ereignis da ist; ohne Preload null.
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);
  const fernsteuerung = useBrueckenWert(FERNSTEUERUNG_QUELLE);
  const ausgabe = useBrueckenWert(AUSGABE_QUELLE);

  // Ein Stand für Statusleiste, Panel, ON AIR und Haupttasten (lib/oberflaeche.ts): alle zeigen dieselbe Ableitung.
  const stand: OberflaechenStand = { prompter: state ?? undefined, ausgabe, masterLink, fernsteuerung, ...(bildschirme === undefined ? {} : { bildschirme }) };

  // window.jmprompt nur in den Rückrufen, nie beim Rendern.
  const marke = (richtung: 1 | -1): void => {
    if (!state) return;
    const pos = positionEm(state.transport);
    if (richtung > 0) {
      const weiter = markersEm.find((m) => m > pos + 0.05);
      if (weiter != null) void window.jmprompt.transport.seek(weiter);
    } else {
      const zurueck = [...markersEm].reverse().find((m) => m < pos - 0.05);
      void window.jmprompt.transport.seek(zurueck ?? 0);
    }
  };
  const live: LiveAktionen = {
    toggle: () => void window.jmprompt.transport.toggle(),
    anfang: () => void window.jmprompt.transport.reset(),
    marke,
    nudge: (d) => void window.jmprompt.transport.nudge(d),
    tempo: (v) => void setConfig({ speed: v }),
  };
  const aktionen: EinstellungenAktionen = {
    // Monitor an: Vollbild auf dem gewählten Bildschirm öffnen; aus: Fenster schließen (wie die alten Knöpfe).
    ausgabeUmschalten: (an) => void (an ? openOutput(state?.config.outputDisplayId ?? undefined) : closeOutput()),
    // Bildschirm wählen; ist der Monitor offen, zieht er auf den gewählten Bildschirm um (früher „Auf diesen Bildschirm“).
    bildschirmWaehlen: (id) =>
      void setConfig({ outputDisplayId: id }).then(() => (ausgabe?.art === 'offen' ? openOutput(id ?? undefined) : undefined)),
    konfigurieren: (patch) => void setConfig(patch),
    handyUmschalten: (an) => void setRemote(an),
  };

  return (
    <AppShell
      tool="Prompter"
      onAir={kopfOnAir(stand)}
      status={statusLeiste(stand)}
      settings={<Einstellungen stand={stand} aktionen={aktionen} />}
      settingsOpen={panelOffen}
      settingsSection={panelAbschnitt}
      onSettingsChange={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    >
      {!state ? (
        <div className="grid h-full place-items-center text-[var(--muted-foreground)]">Lädt…</div>
      ) : (
        <div className="flex h-full min-h-0">
          {/* Skript */}
          <div className="flex min-w-0 flex-1 flex-col border-r border-[var(--border)]/60">
            <div className="flex items-center gap-2 px-5 pb-2 pt-4">
              <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Skript</h3>
              <span className="text-[11px] text-[var(--muted-foreground)]">
                Zeilen mit <code className="text-[var(--foreground)]"># </code> werden zu Abschnitts-Marken
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                uppercase={false}
                className="ml-auto"
                title=".docx, .txt oder .md laden (ersetzt das Skript)"
                onClick={() => {
                  void importScript().catch((e: unknown) => window.alert(`Datei konnte nicht geladen werden: ${e instanceof Error ? e.message : String(e)}`));
                }}
              >
                📄 Datei laden
              </Button>
            </div>
            <textarea
              value={state.config.script}
              onChange={(e) => void setConfig({ script: e.target.value })}
              spellCheck={false}
              className="mx-5 mb-5 min-h-0 flex-1 resize-none rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--input)] p-4 text-[15px] font-medium leading-relaxed outline-none focus:border-[var(--primary)]/60"
              placeholder="Skript hier eintippen oder einfügen…"
            />
          </div>

          {/* Live-Bereich */}
          <div className="w-[400px] shrink-0 overflow-auto">
            <div className="p-5">
              <LiveBereich state={state} stand={stand} aktionen={live} onMarkers={setMarkers} />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

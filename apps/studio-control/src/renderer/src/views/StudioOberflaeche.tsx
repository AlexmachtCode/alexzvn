// Studio-Control im Werkzeug-Rahmen (UX Welle 2b, Studio-Control d1; B15, B3, B4, B8, B17; Muster d): AppShell aus @jm/ui mit Kopf
// „JM Studio Control“, ThemeToggle und ON AIR (nur bei gemessener Sendung), Statusleiste aus lib/oberflaeche.ts und dem Panel.
// Vor der Anmeldung: leere Statusleiste, kein ⚙, keine Werkzeugleiste, die Anmeldung im Inhalt. Danach Tabs Video · Audio · Licht ·
// Setup in der Werkzeugleiste, rechts „‹Benutzer› · ‹Rolle›“ und „Abmelden“; das Panel (nur Fernsteuerung) nur im Electron-Fenster.
// Die Wurzel-View (StudioOberflaeche) rendert vor und nach der Anmeldung, hält den einen Stand, den Panelzustand und die Abos von
// Master-Link und Fernsteuerung; sie bleibt über Panel- und Reiterwechsel stabil, die Abos laufen auch bei geschlossenem Panel.
// Der Socket steht eine Ebene höher in der Wurzel (App.tsx), die Server-Verbindung kommt als gemessener Wert herein. Der Rahmen
// (StudioRahmen) zeichnet nur, was er bekommt: eine Wahrheit für Kopf, Werkzeugleiste, Statusleiste und Panel.
// Die Reiter-Ansichten sind memo und bekommen den einen Stand (Task 18): Pillen, Sperrgründe und Haupttasten der Panels kommen
// aus denselben Ableitungen wie Statusleiste und ON AIR. Der Stand ist gemerkt (useMemo), damit Panel- und Abschnittswechsel die
// offene Ansicht nicht neu rendern. Der Abschnitt bleibt im Store (store/app.ts), nicht gemerkt.
import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AppShell, useBrueckenWert } from '@jm/ui';
import { DEFAULT_LIGHTING_CONFIG } from '@shared/lighting';
import { FERNSTEUERUNG_QUELLE, MASTER_LINK_QUELLE, umgebung } from '@/lib/bruecken';
import { kopfOnAir, mitEinstellungen, statusLeiste, type GeraeteStand, type GeraeteStatus, type OberflaechenStand } from '@/lib/oberflaeche';
import { useApp, type Section } from '@/store/app';
import { useSession } from '@/store/session';
import { apiFetch } from '@/sync/client';
import { AudioView } from './Audio';
import { Einstellungen } from './Einstellungen';
import { LichtView } from './Licht';
import { LoginView } from './Login';
import { SetupView } from './Setup';
import { VideoView } from './Video';
import { Werkzeugleiste } from './Werkzeugleiste';

const Video = memo(VideoView);
const Audio = memo(AudioView);
const Licht = memo(LichtView);
const Setup = memo(SetupView);

export interface StudioRahmenProps {
  stand: OberflaechenStand;
  abschnitt: Section;
  onAbschnitt(abschnitt: Section): void;
  onAbmelden(): void;
  panelOffen: boolean;
  panelAbschnitt?: string;
  onPanel(offen: boolean, abschnitt?: string): void;
  /** Inhalt nach der Anmeldung (der gewählte Reiter); vorher steht dort die Anmeldung. */
  children: ReactNode;
}

/**
 * Der Rahmen von Studio-Control: angemeldet ist, wer im Stand einen Benutzer hat. Vorher nur Kopf, leere Statusleiste und die
 * Anmeldung (B15); ON AIR erst danach, wie alles, was die Geräte melden. Das Panel gibt es nur im Electron-Fenster (W2-V4).
 */
export function StudioRahmen({ stand, abschnitt, onAbschnitt, onAbmelden, panelOffen, panelAbschnitt, onPanel, children }: StudioRahmenProps): React.JSX.Element {
  const benutzer = stand.benutzer;
  return (
    <AppShell
      tool="Studio Control"
      onAir={benutzer === null ? undefined : kopfOnAir(stand)}
      status={benutzer === null ? [] : statusLeiste(stand)}
      toolbar={benutzer === null ? undefined : <Werkzeugleiste abschnitt={abschnitt} onAbschnitt={onAbschnitt} benutzer={benutzer} onAbmelden={onAbmelden} />}
      settings={benutzer !== null && mitEinstellungen(stand) ? <Einstellungen stand={stand} /> : undefined}
      settingsOpen={panelOffen}
      settingsSection={panelAbschnitt}
      onSettingsChange={onPanel}
    >
      {benutzer === null ? <LoginView /> : children}
    </AppShell>
  );
}

/** Abmelden wie bisher „Logout“: POST /api/logout mit dem Token, ein Netzfehler wird verschluckt, die Sitzung immer gelöscht. */
export async function abmelden(
  token: string | null,
  clearSession: () => void,
  api: (pfad: string, init: { method: string; token: string | null }) => Promise<unknown> = apiFetch,
): Promise<void> {
  try {
    await api('/api/logout', { method: 'POST', token });
  } catch {
    // Netzfehler: die Sitzung wird trotzdem gelöscht (wie bisher).
  }
  clearSession();
}

/** Ein Gerätetyp für den Stand: eingerichtete Instanzen (ids) und der letzte Status je Instanz. */
function geraete(ids: string[], status: Record<string, GeraeteStatus>): GeraeteStand {
  return { ids, status };
}

export function StudioOberflaeche({
  server,
  anfangOffen = false,
}: {
  /** Server-Verbindung des aktuellen Sockets (App.tsx, Lauf-Kennung); undefined = noch keine Meldung. */
  server: boolean | undefined;
  /** Panel beim Start offen (nur für Tests; im Betrieb zu, nichts gemerkt). */
  anfangOffen?: boolean;
}): React.JSX.Element {
  const user = useSession((s) => s.user);
  const token = useSession((s) => s.token);
  const clearSession = useSession((s) => s.clearSession);
  const section = useApp((s) => s.section);
  const setSection = useApp((s) => s.setSection);

  // Geräte für Statusleiste und ON AIR: die ids flach verglichen (Regler und Fader ändern die Konfiguration, nicht die ids),
  // die Status-Tabellen ändern sich nur mit einem Status-Ereignis.
  const atemIds = useApp(useShallow((s) => s.atem.map((c) => c.id)));
  const obsIds = useApp(useShallow((s) => s.obs.map((c) => c.id)));
  const tricasterIds = useApp(useShallow((s) => s.tricasters.map((c) => c.id)));
  const ptzIds = useApp(useShallow((s) => s.ptzCameras.map((c) => c.id)));
  const audioIds = useApp(useShallow((s) => s.audioConsoles.map((c) => c.id)));
  const status = useApp(
    useShallow((s) => ({ atem: s.atemStatuses, obs: s.obsStatuses, tricaster: s.tricasterStatuses, ptz: s.ptzStatuses, audio: s.audioStatuses })),
  );
  // Licht: bekannt erst, wenn der Server den Licht-Zustand geschickt hat. Bis dahin hält der Store die Vorgabe
  // DEFAULT_LIGHTING_CONFIG (dasselbe Objekt); jede Meldung ersetzt es (setLighting), sie wird nie zurückgesetzt.
  const lichtGemeldet = useApp((s) => s.lighting !== DEFAULT_LIGHTING_CONFIG);
  const lichtNode = useApp((s) => s.lighting.node !== null);
  const blackout = useApp((s) => s.blackout);

  // Lesende Brücken (Spec 3.9): undefined, bis eine Antwort da ist; ohne Preload (Browser) null. Auch bei geschlossenem Panel.
  const masterLink = useBrueckenWert(MASTER_LINK_QUELLE);
  const fernsteuerung = useBrueckenWert(FERNSTEUERUNG_QUELLE);

  // Einstellungs-Panel (Spec 3.1, 3.6): zu beim Start, nichts gemerkt; offen über ⚙ oder einen Statuseintrag.
  const [panelOffen, setPanelOffen] = useState(anfangOffen);
  const [panelAbschnitt, setPanelAbschnitt] = useState<string | undefined>(undefined);
  // Nach dem Abmelden (Knopf oder abgewiesenes Token) ist das Panel zu; die nächste Anmeldung beginnt wie der Start.
  useEffect(() => {
    if (!user) {
      setPanelOffen(false);
      setPanelAbschnitt(undefined);
    }
  }, [user]);

  // Ein Stand für Statusleiste, ON AIR, Panel und Gerätepanels (lib/oberflaeche.ts): alle zeigen dieselbe Ableitung.
  const ort = umgebung();
  const stand: OberflaechenStand = useMemo(
    () => ({
      umgebung: ort,
      benutzer: user ? { name: user.username, rolle: user.role } : null,
      server,
      atem: geraete(atemIds, status.atem),
      obs: geraete(obsIds, status.obs),
      tricaster: geraete(tricasterIds, status.tricaster),
      ptz: geraete(ptzIds, status.ptz),
      audio: geraete(audioIds, status.audio),
      licht: lichtGemeldet ? { node: lichtNode, blackout } : undefined,
      masterLink,
      fernsteuerung,
    }),
    [ort, user, server, atemIds, obsIds, tricasterIds, ptzIds, audioIds, status, lichtGemeldet, lichtNode, blackout, masterLink, fernsteuerung],
  );

  return (
    <StudioRahmen
      stand={stand}
      abschnitt={section}
      onAbschnitt={setSection}
      onAbmelden={() => void abmelden(token, clearSession)}
      panelOffen={panelOffen}
      panelAbschnitt={panelAbschnitt}
      onPanel={(offen, abschnitt) => {
        setPanelOffen(offen);
        setPanelAbschnitt(abschnitt);
      }}
    >
      {/* Der alte Rand des Inhalts (vorher im lokalen AppShell): höchstens 1400 breit, px-7 py-6. */}
      <div className="mx-auto h-full max-w-[1400px] px-7 py-6">
        {section === 'video' && <Video stand={stand} />}
        {section === 'audio' && <Audio stand={stand} />}
        {section === 'licht' && <Licht stand={stand} />}
        {section === 'setup' && <Setup />}
      </div>
    </StudioRahmen>
  );
}

import { create } from 'zustand';
import { useChangelog } from '@/store/changelog';
import { useCookbook } from '@/store/cookbook';
import { useVerbund } from './verbund';
import { useAnleitung } from './anleitung';
import type {
  ActionResult,
  AnhangOrdnerStand,
  FeedbackInput,
  HealthEntry,
  InstallProgress,
  IveoAbgleichStatus,
  IveoSideEventsResult,
  LauncherUpdate,
  PresenceRecord,
  RecentShow,
  ShowLaunchTool,
  SuiteSettingsInput,
  SuiteSettingsView,
  ToolManifest,
  ToolState,
} from '@shared/types';
import type { Show } from '@jm/show';
import type { ScenarioSeed } from '@/lib/scenarios';
import {
  anhangListeSchritt,
  leererAnhangZustand,
  type AnhangListenEreignis,
  type AnhangListenZustand,
} from '@/lib/anhang-liste';

function byId(states: ToolState[]): Record<string, ToolState> {
  return Object.fromEntries(states.map((s) => [s.id, s]));
}

/** Aktiver Reiter der Launcher-Shell (#157). */
export type LauncherView = 'catalog' | 'jmshow';

const LAST_VIEW_KEY = 'jmps:lastView';

/** Zuletzt aktiven Reiter lesen (#157) — Fallback Werkzeugkasten. */
function readLastView(): LauncherView {
  try {
    return localStorage.getItem(LAST_VIEW_KEY) === 'jmshow' ? 'jmshow' : 'catalog';
  } catch {
    return 'catalog';
  }
}

/** Laufender Show-Start (#76): Tool-Liste + Ergebnis fürs Lade-Overlay. */
export interface ShowLaunchState {
  name: string;
  tools: ShowLaunchTool[];
  /** Nach dem Start: Tools, die nicht starteten (nicht installiert/Fehler). */
  missing: string[];
  /** true, sobald der Startlauf durch ist (Tools booten ggf. noch). */
  done: boolean;
  /** Zeitpunkt von `done` (ms) für den Auto-Close-Timeout. */
  doneAt: number;
}

interface ToolsStore {
  tools: ToolManifest[];
  states: Record<string, ToolState>;
  busy: Record<string, boolean>;
  progress: Record<string, InstallProgress>;
  settings: SuiteSettingsView | null;
  settingsOpen: boolean;
  loading: boolean;
  notice: string | null;
  version: string | null;
  launcherUpdate: LauncherUpdate | null;
  updatingAll: boolean;
  presence: PresenceRecord[];
  health: HealthEntry[];
  systemOpen: boolean;
  showEditorOpen: boolean;
  /** iveo-Live-Umschalter (#11): Zustand der offenen iveo-Show (null = keine). */
  iveoActive: { event: string; day?: string; activeProgramId?: string; canSwitch: boolean } | null;
  sideEvents: IveoSideEventsResult | null;
  /** iveo-Abgleich (Spec 7.6): letzter Zustand; ok=false zeigt das Panel als Störung. */
  iveoSync: IveoAbgleichStatus | null;
  sideEventsOpen: boolean;
  /**
   * Anhang-Listen der Side Events (iveo-Paket, Spec 8.1, E18): aufgeklappte Liste, aktives Side Event, Listen, Stand und
   * Fehler. Kein Dauer-Cache — jede Änderung geht durch den reinen Helfer anhangListeSchritt (lib/anhang-liste.ts).
   */
  anhaenge: AnhangListenZustand;
  /** Ablage in Side-Event-Ordnern (iveo-Paket, Spec 9.13–9.15): letzter Stand aus dem Main; null = noch keiner. */
  anhangOrdner: AnhangOrdnerStand | null;
  /** Uhr des Renderers für Kopfzeile und Zeilen (9.15): alle 15 s neu, nur solange das Panel offen ist. */
  ordnerUhr: number;
  /** Schalter „Anhänge in Side-Event-Ordnern ablegen“ (9.14). */
  setzeAnhangOrdner: (an: boolean) => Promise<void>;
  /** „Ordner öffnen“ (9.13, E35): nur die programId, ohne Kennung der Basisordner; nie ein Pfad. */
  oeffneAnhangOrdner: (programId?: string) => Promise<void>;
  openSideEvents: () => void;
  closeSideEvents: () => void;
  loadSideEvents: (day?: string) => Promise<void>;
  switchSideEvent: (programId?: string, day?: string) => Promise<void>;
  /** Anhang-Liste eines Side Events auf- bzw. zuklappen (📎). */
  toggleMaterials: (programId: string) => void;
  /** „Erneut versuchen“ (L2): die Liste noch einmal laden. */
  retryMaterials: (programId: string) => void;
  /** Nur der Abruf; Liste, Stand und Fehler übernimmt der Helfer. */
  loadMaterials: (programId: string) => Promise<void>;
  downloadMaterial: (programId: string, materialId: string) => Promise<void>;
  /** Aktiver Reiter der Shell (#157). */
  view: LauncherView;
  setView: (view: LauncherView) => void;
  /** Zuletzt geöffnete Shows (#157) für die 1-Klick-Wiederöffnung. */
  recentShows: RecentShow[];
  loadRecentShows: () => Promise<void>;
  openShowPath: (path: string) => Promise<void>;
  /** Lade-Overlay beim Öffnen einer Show (#76); null = kein Start läuft. */
  showLaunch: ShowLaunchState | null;
  dismissShowLaunch: () => void;
  load: () => Promise<void>;
  loadPresence: () => Promise<void>;
  loadHealth: () => Promise<void>;
  openShow: () => Promise<void>;
  openShowEditor: () => void;
  closeShowEditor: () => void;
  saveShow: (show: Show, targetPath?: string, neuGebunden?: boolean) => Promise<boolean>;
  openSystem: () => void;
  closeSystem: () => void;
  checkUpdates: () => Promise<void>;
  loadLauncherUpdate: () => Promise<void>;
  updateLauncher: () => Promise<void>;
  open: (id: string) => Promise<void>;
  install: (id: string) => Promise<void>;
  update: (id: string) => Promise<void>;
  updateAll: () => Promise<void>;
  uninstall: (id: string) => Promise<void>;
  setNotice: (notice: string | null) => void;
  openSettings: () => void;
  closeSettings: () => void;
  saveSettings: (input: SuiteSettingsInput) => Promise<void>;
  feedbackOpen: boolean;
  openFeedback: () => void;
  closeFeedback: () => void;
  submitFeedback: (input: FeedbackInput) => Promise<ActionResult>;
  /** Sichtbare Patch Notes: { app, optional hervorgehobene Version } oder null. */
  patchNotes: { app: string; highlight?: string } | null;
  openPatchNotes: (view?: { app: string; highlight?: string }) => void;
  closePatchNotes: () => void;
  /** Erste-Schritte-Assistent (Onboarding B1): beim allerersten Start automatisch. */
  onboardingOpen: boolean;
  openOnboarding: () => void;
  closeOnboarding: (persist?: boolean) => void;
  /** Szenario-Start „Was willst du produzieren?" (Onboarding B2). */
  scenariosOpen: boolean;
  openScenarios: () => void;
  closeScenarios: () => void;
  /** Vorbefüllung, die der Show-Editor beim Öffnen übernimmt (null = leerer Editor). */
  editorSeed: ScenarioSeed | null;
  /** Editor mit einem Szenario-Seed öffnen (schließt den Szenario-Picker). */
  openShowEditorWith: (seed: ScenarioSeed) => void;
  /** Seed nach Übernahme durch den Editor löschen. */
  clearEditorSeed: () => void;
}

const SEEN_VERSION_KEY = 'jmps:lastSeenVersion';
const ONBOARDED_KEY = 'jmps:onboardedV1';

function readSeenVersion(): string | null {
  try {
    return localStorage.getItem(SEEN_VERSION_KEY);
  } catch {
    return null;
  }
}

/** Wurde der Erste-Schritte-Assistent schon gesehen/weggeklickt? (Onboarding B1) */
function readOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return false;
  }
}

let progressSubscribed = false;

/** iveo-Paket, Spec 9.15: Takt der Renderer-Uhr für Kopfzeile und Zeilen der Ablage, solange das Panel offen ist. */
const ORDNER_UHR_MS = 15_000;
let ordnerUhrTimer: ReturnType<typeof setInterval> | null = null;

export const useTools = create<ToolsStore>((set) => {
  async function run(
    id: string,
    action: () => Promise<ActionResult>,
    refresh = false,
  ): Promise<void> {
    set((s) => ({ busy: { ...s.busy, [id]: true } }));
    try {
      const res = await action();
      if (res.message) set({ notice: res.message });
      if (refresh) {
        // checkUpdates liefert die plattenbasierten Zustände inkl. Live-Update-
        // Overlay — nach (De-)Installation also direkt der aktuelle Stand.
        const states = await window.jmps.checkUpdates();
        set({ states: byId(states) });
      }
    } catch (e) {
      set({ notice: (e as Error).message });
    } finally {
      set((s) => ({ busy: { ...s.busy, [id]: false } }));
    }
  }

  /**
   * iveo-Paket, Spec 8.1 (E18): jede Änderung der Anhang-Listen geht durch den reinen Helfer; der Store führt nur aus —
   * laden (immer, auch bei vorhandener Liste) und dem Main die Beobachtung melden (8.4 Nr. 3).
   */
  function anhangSchritt(e: AnhangListenEreignis): void {
    const r = anhangListeSchritt(useTools.getState().anhaenge, e);
    set({ anhaenge: r.zustand });
    // Schließen und Event-Wechsel melden dem Main immer [] (8.1), auch wenn der Helfer dazu nichts sagt.
    const beobachte = r.beobachte ?? (e.art === 'panelZu' || e.art === 'eventWechsel' ? [] : null);
    if (beobachte) void window.jmps.watchIveoMaterials({ programIds: beobachte }).catch(() => {});
    if (r.laden) void useTools.getState().loadMaterials(r.laden);
  }

  return {
    tools: [],
    states: {},
    busy: {},
    progress: {},
    settings: null,
    settingsOpen: false,
    feedbackOpen: false,
    loading: true,
    notice: null,
    version: null,
    launcherUpdate: null,
    updatingAll: false,
    presence: [],
    health: [],
    systemOpen: false,
    showEditorOpen: false,
    onboardingOpen: false,
    scenariosOpen: false,
    editorSeed: null,
    iveoActive: null,
    sideEvents: null,
    iveoSync: null,
    sideEventsOpen: false,
    anhaenge: leererAnhangZustand(null),
    anhangOrdner: null,
    ordnerUhr: Date.now(),
    view: readLastView(),
    recentShows: [],
    showLaunch: null,
    patchNotes: null,

    load: async () => {
      if (!progressSubscribed) {
        progressSubscribed = true;
        window.jmps.onProgress((p) => {
          set((s) => ({ progress: { ...s.progress, [p.id]: p } }));
          // Abschluss (auch verzögert, nachdem ein interaktiver Installer durch
          // ist) → Zustände nachladen, damit die Tool-Karte auf „installiert"
          // umschlägt, ohne dass der User das Fenster neu fokussieren muss.
          if (p.phase === 'done') void useTools.getState().checkUpdates();
        });
        window.jmps.onAppEvent(async (e) => {
          if (e.type === 'notice') {
            set({ notice: e.message });
          } else if (e.type === 'manifest-changed') {
            const [tools, states] = await Promise.all([
              window.jmps.listTools(),
              window.jmps.getState(),
            ]);
            set({ tools, states: byId(states) });
          } else if (e.type === 'changelog-changed') {
            // Live aktualisierte App-Patchnotes übernehmen (Issue #19).
            await useChangelog.getState().load();
          } else if (e.type === 'cookbook-changed') {
            // Live aktualisierte Kochbuch-Rezepte übernehmen.
            await useCookbook.getState().load();
          } else if (e.type === 'presence-changed') {
            // Ein Tool ist gestartet/gestoppt → Health-Dashboard auffrischen.
            await useTools.getState().loadPresence();
          } else if (e.type === 'health-changed') {
            // Live-Zustand eines entdeckten Steuer-Endpunkts hat sich geändert.
            await useTools.getState().loadHealth();
          } else if (e.type === 'verbund-changed') {
            // Master-Link: Rolle/Kopplung/Teilnehmer/Client-Zustand geändert → Kopfanzeige + Modal.
            await useVerbund.getState().lade();
          } else if (e.type === 'show-launch-start') {
            // Show wird geöffnet (#76): Overlay zeigen, Presence frisch holen.
            set({ showLaunch: { name: e.name, tools: e.tools, missing: [], done: false, doneAt: 0 } });
            await useTools.getState().loadPresence();
          } else if (e.type === 'show-launch-done') {
            set((s) =>
              s.showLaunch
                ? { showLaunch: { ...s.showLaunch, missing: e.missing, done: true, doneAt: Date.now() } }
                : {},
            );
            // Recent-Liste auffrischen (auch bei Deep-Link-Start ohne UI-Aktion, #157).
            await useTools.getState().loadRecentShows();
          } else if (e.type === 'iveo-active-changed') {
            // iveo-Show geöffnet / aktives Side Event geändert (#11).
            const vorher = useTools.getState().iveoActive;
            set({
              iveoActive: e.event
                ? { event: e.event, day: e.day, activeProgramId: e.activeProgramId, canSwitch: e.canSwitch }
                : null,
            });
            // iveo-Paket, Spec 8.1: anderes Event → alle Listen leeren und zuklappen; danach, auch bei gleichem Event, die
            // geänderte Kennung des aktiven Side Events melden (sonst verwürfe der Helfer dessen erste Meldung).
            if ((vorher?.event ?? '') !== e.event) anhangSchritt({ art: 'eventWechsel' });
            const aktiv = e.activeProgramId ?? null;
            if (useTools.getState().anhaenge.aktiv !== aktiv) anhangSchritt({ art: 'aktivWechsel', id: aktiv });
            if (useTools.getState().sideEventsOpen) await useTools.getState().loadSideEvents();
          } else if (e.type === 'iveo-sync-status') {
            // iveo-Abgleich gestört bzw. wieder in Ordnung (Spec 7.6) → Statuszeile im Panel.
            set({ iveoSync: { ok: e.ok, text: e.text, seit: e.seit } });
          } else if (e.type === 'iveo-anhaenge') {
            // iveo-Paket, Spec 8.4: Ergebnis des Anhang-Wächters; der Helfer übernimmt es nur für eine beobachtete Liste.
            anhangSchritt({ art: 'ergebnis', id: e.programId, abgerufen: e.abgerufen, ok: e.ok, materials: e.materials, error: e.error });
          } else if (e.type === 'iveo-anhang-ordner') {
            // iveo-Paket, Spec 9.15: neuer Stand der Ablage (bei jeder Änderung, Fortschritt höchstens einmal je Sekunde).
            set({ anhangOrdner: e.stand });
          }
        });
        // Nach Rückkehr zum Launcher (z. B. wenn der NSIS-Installer durch ist
        // oder der Rechner wieder online geht) Status + Updates neu prüfen —
        // sonst bliebe die Karte bis zum Reload veraltet.
        window.addEventListener('focus', () => {
          void useTools.getState().checkUpdates();
          void useTools.getState().loadLauncherUpdate();
          void useTools.getState().loadPresence();
          void useTools.getState().loadHealth();
        });
        // Hintergrund: regelmäßig auf Updates prüfen, auch ohne Fokuswechsel —
        // so aktualisiert ein länger offener Launcher seine Update-Badges selbst.
        // (Die Versionsabfrage ist serverseitig 5 min gecacht; 30 min reicht.)
        setInterval(() => {
          void useTools.getState().checkUpdates();
          void useTools.getState().loadLauncherUpdate();
        }, 30 * 60 * 1000);
      }
      const [tools, states, settings, version] = await Promise.all([
        window.jmps.listTools(),
        window.jmps.getState(),
        window.jmps.getSettings(),
        window.jmps.getVersion(),
        useChangelog.getState().load(),
        useCookbook.getState().load(),
      ]);
      set({ tools, states: byId(states), settings, version, loading: false });
      // Beim allerersten Start den Erste-Schritte-Assistenten zeigen (B1); sonst
      // — nach einem Launcher-Update — genau einmal „Was ist neu?", sofern für die
      // Version Notes vorliegen. Nie beides gleichzeitig aufpoppen.
      if (!readOnboarded()) {
        set({ onboardingOpen: true });
      } else if (version && readSeenVersion() !== version && useChangelog.getState().entryFor('launcher', version)) {
        set({ patchNotes: { app: 'launcher', highlight: version } });
      }
      // Zustände sofort rendern, die (langsameren, online) Prüfungen danach.
      void useTools.getState().checkUpdates();
      void useTools.getState().loadLauncherUpdate();
      void useTools.getState().loadPresence();
      void useTools.getState().loadHealth();
      void useVerbund.getState().lade();
      void useTools.getState().loadRecentShows();
    },

    loadPresence: async () => {
      try {
        set({ presence: await window.jmps.getPresence() });
      } catch {
        // Hub nicht erreichbar → bestehenden Stand behalten
      }
    },

    loadHealth: async () => {
      try {
        set({ health: await window.jmps.getHealth() });
      } catch {
        // Aggregator nicht erreichbar → bestehenden Stand behalten
      }
    },

    setView: (view) => {
      set({ view });
      try {
        localStorage.setItem(LAST_VIEW_KEY, view);
      } catch {
        // nur In-Memory, wenn localStorage nicht verfügbar ist
      }
    },

    loadRecentShows: async () => {
      try {
        set({ recentShows: await window.jmps.getRecentShows() });
      } catch {
        // kein Zugriff → bestehenden Stand behalten
      }
    },

    openShowPath: async (path) => {
      const res = await window.jmps.openShowPath(path);
      if (res.message) set({ notice: res.message });
      // Wie openShow: nach dem Start Presence + Recent-Liste auffrischen.
      void useTools.getState().loadPresence();
      void useTools.getState().loadRecentShows();
    },

    openShow: async () => {
      const res = await window.jmps.openShow();
      if (res.message) set({ notice: res.message });
      // Nach dem koordinierten Start meldet sich Presence neu → Dashboard frisch.
      void useTools.getState().loadPresence();
      void useTools.getState().loadRecentShows();
    },

    openShowEditor: () => set({ showEditorOpen: true }),
    closeShowEditor: () => set({ showEditorOpen: false }),

    openScenarios: () => set({ scenariosOpen: true }),
    closeScenarios: () => set({ scenariosOpen: false }),
    openShowEditorWith: (seed) => set({ editorSeed: seed, showEditorOpen: true, scenariosOpen: false }),
    clearEditorSeed: () => set({ editorSeed: null }),
    dismissShowLaunch: () => set({ showLaunch: null }),
    saveShow: async (show, targetPath, neuGebunden) => {
      const res = await window.jmps.saveShow(show, targetPath, neuGebunden);
      if (res.message) set({ notice: res.message });
      // Geführte Anleitung, Kapitel 4 (EP5): „Show gespeichert“ gibt es nur als Ereignis, gemeldet erst, wenn der Main ok
      // sagt (Abbruch im Speicherdialog liefert ok: false). Der Fortschritt merkt es; gespeichert hat der Bediener.
      if (res.ok) useAnleitung.getState().toolEreignis('showGespeichert');
      return res.ok;
    },

    openSystem: () => {
      set({ systemOpen: true });
      void useTools.getState().loadPresence();
      void useTools.getState().loadHealth();
    },
    closeSystem: () => set({ systemOpen: false }),

    openOnboarding: () => {
      set({ onboardingOpen: true });
      void useTools.getState().loadPresence();
    },
    closeOnboarding: (persist = true) => {
      if (persist) {
        try {
          localStorage.setItem(ONBOARDED_KEY, '1');
        } catch {
          // localStorage nicht verfügbar → nur In-Memory schließen
        }
      }
      set({ onboardingOpen: false });
    },

    openSideEvents: () => {
      set({ sideEventsOpen: true });
      void useTools.getState().loadSideEvents();
      // iveo-Paket, Spec 8.1, 8.4 Nr. 3: jede Anmeldung, auch [], lässt den Main den Stand der beobachteten Listen neu
      // senden — die Zahl am 📎 des aktiven Side Events steht nach dem Wiederöffnen sofort wieder da (L6).
      void window.jmps.watchIveoMaterials({ programIds: [] }).catch(() => {});
      // iveo-Paket, Spec 9.15: Stand der Ablage beim Öffnen holen. Die Kopfzeile bewertet der Renderer mit seiner eigenen Uhr
      // („überfällig“, „kein Fortschritt“), neu alle 15 s, solange das Panel offen ist — auch wenn der Takt im Main steht.
      void window.jmps.anhangOrdnerStand().then((stand) => set({ anhangOrdner: stand })).catch(() => {});
      set({ ordnerUhr: Date.now() });
      if (ordnerUhrTimer === null) ordnerUhrTimer = setInterval(() => set({ ordnerUhr: Date.now() }), ORDNER_UHR_MS);
    },
    closeSideEvents: () => {
      set({ sideEventsOpen: false });
      if (ordnerUhrTimer !== null) {
        clearInterval(ordnerUhrTimer);
        ordnerUhrTimer = null;
      }
      // iveo-Paket, Spec 8.1 (E18): Schließen leert alle Listen und klappt sie zu (kein Dauer-Cache, Ursache von #264).
      anhangSchritt({ art: 'panelZu' });
    },
    loadSideEvents: async (day) => {
      try {
        const res = await window.jmps.listIveoSideEvents(day ? { day } : undefined);
        // Der Main liefert den Abgleich-Zustand mit: kam das Ereignis, bevor dieses
        // Fenster zuhörte, zeigt das Panel die Störung trotzdem (Spec 7.6).
        set(res.syncStatus ? { sideEvents: res, iveoSync: res.syncStatus } : { sideEvents: res });
      } catch {
        // Kein Cache / kein Main-Zugriff → bestehenden Stand behalten
      }
    },
    switchSideEvent: async (programId, day) => {
      const res = await window.jmps.switchIveoSideEvent({ programId, day });
      if (res.message) set({ notice: res.message });
      // Nach dem Umschalten die Liste (aktives Side Event) auffrischen.
      const cur = useTools.getState().sideEvents?.day;
      await useTools.getState().loadSideEvents(day ?? cur);
    },
    toggleMaterials: (programId) => {
      // iveo-Paket, Spec 8.1: Aufklappen lädt immer (kein „nur ohne Liste“, Ursache von #264); Zuklappen meldet ab.
      if (useTools.getState().anhaenge.materialsOffen === programId) anhangSchritt({ art: 'zuklappen' });
      else anhangSchritt({ art: 'aufklappen', id: programId });
    },
    retryMaterials: (programId) => anhangSchritt({ art: 'aufklappen', id: programId }),
    loadMaterials: async (programId) => {
      // iveo-Paket, Spec 8.1, 8.6: nur der Abruf. Liste, Stand und Fehler übernimmt der Helfer; ein Ergebnis mit älterem
      // abgerufen als dem gespeicherten verwirft er (Abruf und Wächter können sich kreuzen). Den Fehlertext T11 bildet
      // anhangAnzeige, ohne Text die Variante ohne Doppelpunkt.
      try {
        const res = await window.jmps.listIveoMaterials({ programId });
        anhangSchritt({
          art: 'ergebnis',
          id: programId,
          abgerufen: res.abgerufen ?? new Date().toISOString(),
          ok: res.ok,
          ...(res.ok ? { materials: res.materials ?? [] } : { error: res.error }),
        });
      } catch (e) {
        anhangSchritt({ art: 'ergebnis', id: programId, abgerufen: new Date().toISOString(), ok: false, error: (e as Error).message });
      }
    },
    downloadMaterial: async (programId, materialId) => {
      const res = await window.jmps.downloadIveoMaterial({ programId, materialId });
      if (res.message) set({ notice: res.message });
    },
    setzeAnhangOrdner: async (an) => {
      try {
        set({ anhangOrdner: await window.jmps.setzeAnhangOrdner({ an }) });
      } catch {
        // Main nicht erreichbar → bestehenden Stand behalten; das nächste Ereignis bringt den wahren Stand.
      }
    },
    oeffneAnhangOrdner: async (programId) => {
      // E35: nur die programId (ohne: Basisordner); den Pfad kennt nur der Main. Ein Fehler kommt als Notice (T31).
      const res = await window.jmps.oeffneAnhangOrdner(programId ? { programId } : {});
      if (res.message) set({ notice: res.message });
    },

    checkUpdates: async () => {
      try {
        const states = await window.jmps.checkUpdates();
        set({ states: byId(states) });
      } catch {
        // offline / Quelle nicht erreichbar → bestehende Zustände behalten
      }
    },

    loadLauncherUpdate: async () => {
      try {
        set({ launcherUpdate: await window.jmps.getLauncherUpdate() });
      } catch {
        // offline / kein Token → kein Launcher-Update-Hinweis
      }
    },

    updateLauncher: () => run('launcher', () => window.jmps.updateLauncher()),

    open: (id) => run(id, () => window.jmps.open(id)),
    install: (id) => run(id, () => window.jmps.install(id), true),
    update: (id) => run(id, () => window.jmps.update(id), true),
    updateAll: async () => {
      // Schnappschuss der aktuell aktualisierbaren Tools nehmen (die Liste
      // ändert sich, während die Updates durchlaufen) und sequentiell updaten —
      // nicht parallel, sonst starten mehrere Installer gleichzeitig.
      const { states, update } = useTools.getState();
      const ids = Object.values(states)
        .filter((s) => s.status === 'update-available')
        .map((s) => s.id);
      if (ids.length === 0) return;
      set({ updatingAll: true });
      try {
        for (const id of ids) await update(id);
      } finally {
        set({ updatingAll: false });
      }
    },
    uninstall: (id) => run(id, () => window.jmps.uninstall(id), true),
    setNotice: (notice) => set({ notice }),

    openSettings: () => set({ settingsOpen: true }),
    closeSettings: () => set({ settingsOpen: false }),
    saveSettings: async (input) => {
      const settings = await window.jmps.setSettings(input);
      set({ settings, settingsOpen: false, notice: 'Einstellungen gespeichert.' });
    },

    openFeedback: () => set({ feedbackOpen: true }),
    closeFeedback: () => set({ feedbackOpen: false }),
    submitFeedback: async (input) => {
      const res = await window.jmps.submitFeedback(input);
      set({ notice: res.message ?? (res.ok ? 'Danke!' : 'Senden fehlgeschlagen.') });
      if (res.ok) set({ feedbackOpen: false });
      return res;
    },

    openPatchNotes: (view) => set({ patchNotes: view ?? { app: 'launcher' } }),
    closePatchNotes: () =>
      set((s) => {
        // Launcher-Notes als „gesehen" merken → erscheinen nicht erneut für diese Version.
        if (s.patchNotes?.app === 'launcher' && s.version) {
          try {
            localStorage.setItem(SEEN_VERSION_KEY, s.version);
          } catch {
            // localStorage nicht verfügbar → ignorieren
          }
        }
        return { patchNotes: null };
      }),
  };
});

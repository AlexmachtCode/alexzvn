import { ANLEITUNG_TEXTE, AnleitungsUebersicht, Card, type AnleitungsEreignis } from '@jm/ui';
import { LAUNCHER_ANLEITUNG_TEXTE as L } from '@/anleitung/einrichtung';
import { NAMENSNENNUNG, STIMME_VORHANDEN } from '@/anleitung/stimme';
import { kapitelDetails } from '@/lib/anleitung-zustand';
import { useAnleitung, type AnleitungStore } from '@/store/anleitung';
import { useTools } from '@/store/tools';
import { useVerbund } from '@/store/verbund';
import { useAnleitungsAnsicht } from './Anleitung';

// Kapitelübersicht „Erste Schritte“ der geführten Anleitung (Spec 4, OF1, EP20; früher die Checkliste B1).
//
// Die Checkliste geht in der Kapitelübersicht auf: je Kapitel Zeichen und Zustand (Haken nur bei erledigt), Kurztext,
// Detailzeile und die direkte Aktion der Checkliste (Einstellungen, Werkzeugkasten, Verbund, Vorlage, System), dazu
// „Zeig mir“ und „Brauche ich nicht“. Die Aktionen sind Klicks des Bedieners; die Anleitung selbst bedient nichts (G3).
//
// z-40 (unter den Detail-Dialogen mit z-50): Öffnet eine Aktion einen Dialog, legt er sich darüber, und die Übersicht
// bleibt als Rücksprung-Ebene. „Werkzeugkasten“ wechselt die Hauptansicht und schließt die Übersicht; Starten und
// „Zeig mir“ schließen sie auch, damit die Hervorhebung frei liegt.

/** Diagnosezeile des Speichers (G7, G8): jeder Zustand außer „ok“ und „leer“ wird angezeigt. */
const SPEICHER_HINWEIS: Readonly<Record<AnleitungStore['speicher'], string | null>> = {
  ok: null,
  leer: null,
  nichtLesbar: ANLEITUNG_TEXTE.speicherNichtLesbar,
  nichtSchreibbar: ANLEITUNG_TEXTE.speicherNichtSchreibbar,
  kaputt: ANLEITUNG_TEXTE.speicherKaputt,
  neuer: ANLEITUNG_TEXTE.speicherNeuer,
};

export function OnboardingModal() {
  const open = useTools((s) => s.onboardingOpen);
  const close = useTools((s) => s.closeOnboarding);
  // Detailzeilen L9, L10 hängen an Quelle und Tool-Zuständen: beide abonnieren, damit sie live mitgehen.
  const settings = useTools((s) => s.settings);
  const states = useTools((s) => s.states);
  const openSettings = useTools((s) => s.openSettings);
  const openSystem = useTools((s) => s.openSystem);
  const openScenarios = useTools((s) => s.openScenarios);
  const setView = useTools((s) => s.setView);
  const oeffneVerbund = useVerbund((s) => s.oeffne);
  const ansicht = useAnleitungsAnsicht();
  const ereignis = useAnleitung((s) => s.ereignis);
  const speicher = useAnleitung((s) => s.speicher);
  const stimmeAn = useAnleitung((s) => s.stimmeAn);
  const stimmeUmschalten = useAnleitung((s) => s.stimmeUmschalten);

  if (!open) return null;

  const fertig = Object.fromEntries(ansicht.kapitel.map((k) => [k.id, k.zustand === 'erledigt']));
  const aufEreignis = (e: AnleitungsEreignis): void => {
    ereignis(e);
    if (e.art === 'starten') close();
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 backdrop-blur-sm px-6">
      <Card className="relative w-full max-w-xl p-6 jm-fade-in">
        <button
          type="button"
          onClick={close}
          aria-label={L.schliessen}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-[var(--radius)] border border-[var(--border)]
                     text-[var(--muted-foreground)] transition-colors hover:bg-[var(--highlight)] hover:text-[var(--foreground)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <AnleitungsUebersicht
          ansicht={ansicht}
          aufEreignis={aufEreignis}
          titel={L.titel}
          unterzeile={L.unterzeile}
          tipp={L.tipp}
          details={kapitelDetails({ ...useAnleitung.getState().eingang(), settings, states }, L.detail)}
          aktionen={{
            k1: { knopf: L.aktion.k1(fertig.k1), ausfuehren: openSettings },
            k2: { knopf: L.aktion.k2(fertig.k2), ausfuehren: () => { close(); setView('catalog'); } },
            k3: { knopf: L.aktion.k3, ausfuehren: oeffneVerbund },
            k4: { knopf: L.aktion.k4, ausfuehren: openScenarios },
            k5: { knopf: L.aktion.k5, ausfuehren: openSystem },
          }}
          speicherHinweis={SPEICHER_HINWEIS[speicher]}
          stimme={{ vorhanden: STIMME_VORHANDEN, an: stimmeAn, umschalten: stimmeUmschalten, namensnennung: NAMENSNENNUNG }}
          schliessen={close}
        />
      </Card>
    </div>
  );
}

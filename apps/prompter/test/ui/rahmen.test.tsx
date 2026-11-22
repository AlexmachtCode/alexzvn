// UX Welle 2a, Prompter d · Rahmen (Spec 3.1, 3.8, 5.1; E4, E5, E6): AppShell mit Kopf „JM Prompter“, ⚙, ThemeToggle und
// Statusleiste; das Panel ist kein eigener Bildschirm (die Live-Ansicht bleibt gemountet); die Ausgabeansicht bleibt
// unberührt; Hotkeys und Farben als Quelltext-Wächter. Render ohne Browser und ohne window.
import { gleich, leseText, ok, pruefeIdVerweise, render } from '@jm/ui/testhilfe';
import { DEFAULT_CONFIG, type PrompterState } from '@shared/types';
import { PrompterOberflaeche } from '@/views/PrompterOberflaeche';
import { attr, mitStore, ohneKommentare, statusEintraege, tags, text } from './testzustand';

const STATE: PrompterState = {
  config: DEFAULT_CONFIG,
  transport: { playing: false, anchorEm: 0, anchorAtMs: 0, emPerSec: 1 },
  remote: { running: false, urls: [] },
};
const QUELLE = (d: string): string => ohneKommentare(leseText(`src/renderer/src/${d}`));

// ── PR Rahmen: Kopf, ⚙, ThemeToggle, Statusleiste ──
{
  const html = mitStore({ state: STATE }, () => render(<PrompterOberflaeche />));
  const [zahnrad] = tags(html, 'button').filter((t) => attr(t, 'data-zahnrad') !== undefined);
  const [thema] = tags(html, 'button').filter((t) => attr(t, 'data-theme') !== undefined);
  ok(
    text(html).includes('JM Prompter') && !html.includes('JM PROMPTER') && html.includes('data-bereich="inhalt"'),
    'PR Rahmen: AppShell mit Kopf „JM Prompter“ (die alte Marke „JM PROMPTER“ ist weg)',
  );
  gleich(
    [attr(thema, 'aria-label'), attr(zahnrad, 'aria-label'), attr(zahnrad, 'aria-expanded')],
    ['Darstellung: Dunkel. Umschalten auf Hell', 'Einstellungen öffnen', 'false'],
    'PR Rahmen: ThemeToggle (E5) und ⚙ „Einstellungen öffnen“ im Kopf, Panel beim Start zu',
  );
  gleich(
    statusEintraege(html).map(([id, zustand]) => [id, zustand]),
    [
      ['master-link', 'off'],
      ['talent-monitor', 'off'],
      ['fernsteuerung', 'off'],
      ['handy', 'off'],
      ['tempo', 'ok'],
    ],
    'PR Rahmen: Statusleiste mit Master, Talent-Monitor, Fernsteuerung, Handy und Tempo; vor der ersten Antwort ist nichts außer dem Tempo ok',
  );
  ok(html.includes('data-onair="bereit"') && !html.includes('data-onair="live"'), 'PR Rahmen: ON AIR im Kopf, aber nicht live, solange der Talent-Monitor nicht als offen gemessen ist (E4)');
  pruefeIdVerweise(html, 'PR Rahmen: id-Verweise im ganzen Bedienfenster gültig');
}

// ── PR Rahmen: Zustand vor dem Laden ──
{
  const html = mitStore({ state: null }, () => render(<PrompterOberflaeche />));
  ok(text(html).includes('Lädt…') && text(html).includes('JM Prompter'), 'PR Rahmen: vor dem Laden steht der Rahmen mit „Lädt…“, die Statusleiste ist unbekannt');
  ok(statusEintraege(html).every(([, zustand]) => zustand === 'off'), 'PR Rahmen: vor dem Laden ist kein Statuseintrag ok');
}

// ── PR Rahmen: das Panel ist kein Bildschirm, die Live-Ansicht bleibt ──
{
  const offen = mitStore({ state: STATE }, () => render(<PrompterOberflaeche anfangOffen />));
  const zu = mitStore({ state: STATE }, () => render(<PrompterOberflaeche />));
  ok(
    offen.includes('aria-label="Einstellungen"') && offen.includes('data-prompter="live"') && offen.indexOf('data-prompter="live"') < offen.indexOf('aria-label="Einstellungen"'),
    'PR Rahmen: bei offenem Panel bleibt der Live-Bereich gerendert (Leertaste gilt weiter, O1); das Panel steht daneben',
  );
  ok(!zu.includes('aria-label="Einstellungen"') && zu.includes('data-prompter="live"'), 'PR Rahmen: das Panel ist beim Start zu');
  const ober = QUELLE('views/PrompterOberflaeche.tsx');
  ok(
    ober.includes('settingsOpen={panelOffen}') && ober.includes('useState(anfangOffen)') && !ober.includes('localStorage'),
    'PR Rahmen: der Panelzustand ist ein lokaler useState (zu beim Start, nichts gemerkt)',
  );
  ok(
    ober.includes('useBrueckenWert(MASTER_LINK_QUELLE)') && ober.includes('useBrueckenWert(FERNSTEUERUNG_QUELLE)') && ober.includes('useBrueckenWert(AUSGABE_QUELLE)') &&
      ober.includes('status={statusLeiste(stand)}') && ober.includes('onAir={kopfOnAir(stand)}'),
    'PR Rahmen: Brücken, Statusleiste und ON AIR laufen in der View, auch bei geschlossenem Panel',
  );
}

// ── PR Hotkeys bleiben ──
{
  const live = QUELLE('views/LiveBereich.tsx');
  const ausgabe = QUELLE('views/PrompterOutputView.tsx');
  ok(live.includes('usePrompterHotkeys()'), 'PR Hotkeys bleiben: die Live-Ansicht ruft usePrompterHotkeys (immer gemountet, nie vom Panel abhängig)');
  ok(ausgabe.includes('usePrompterHotkeys()'), 'PR Hotkeys bleiben: PrompterOutputView ruft usePrompterHotkeys weiter');
  const bedingt = /(if|&&|\?)[^;\n]*usePrompterHotkeys\(\)/.test(live);
  ok(!bedingt, 'PR Hotkeys bleiben: der Aufruf in der Live-Ansicht steht ohne Bedingung');
  ok(!QUELLE('views/Einstellungen.tsx').includes('usePrompterHotkeys'), 'PR Hotkeys bleiben: das Panel ruft den Hook nicht');
  const hk = leseText('src/renderer/src/lib/useHotkeys.ts');
  ok(hk.includes('istEingabeZiel(e.target)'), 'PR Hotkeys bleiben: der Hook nutzt weiter den Filter istEingabeZiel');
}

// ── PR Ausgabe unberührt (E6) ──
{
  const roh = leseText('src/renderer/src/views/PrompterOutputView.tsx');
  ok(!/@jm\/settings/.test(roh) && !/AppShell/.test(roh), 'PR Ausgabe unberührt: views/PrompterOutputView.tsx importiert weder @jm/settings noch AppShell');
  ok(roh.includes('className="fixed inset-0 bg-black"') && roh.includes("cursor: 'none'"), 'PR Ausgabe unberührt: die Ausgabeansicht bleibt schwarz und ohne Zeiger (Programmfläche)');
  const main = QUELLE('main.tsx');
  ok(main.includes("'#output'") && main.includes('<PrompterOutputView />') && main.includes('<App />'), 'PR Ausgabe unberührt: #output zeigt weiter die PrompterOutputView, sonst die App');
}

// ── PR keine rohen Farben ──
{
  const dateien = ['views/PrompterOberflaeche.tsx', 'views/Einstellungen.tsx', 'views/LiveBereich.tsx', 'components/Regler.tsx', 'App.tsx'];
  // Rohe Tailwind-Farbklassen und Hex-Werte; QR (components/RemoteQr.tsx) und die Ausgabeansicht bleiben schwarz/weiß (Programmflächen).
  const roh = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow)-(?:white|black|neutral|gray|grey|zinc|slate|stone|red|green|blue|yellow|amber|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b|#[0-9a-fA-F]{3,8}\b/;
  gleich(dateien.filter((d) => roh.test(QUELLE(d))), [], 'PR keine rohen Farben: keine rohen Farbklassen und Hex-Werte in den geänderten Dateien, nur Tokens');
  const alt = dateien.filter((d) => /OperatorView/.test(QUELLE(d)));
  gleich(alt, [], 'PR keine rohen Farben: nichts importiert mehr die alte OperatorView');
}

# Suite-UX-Roadmap — übersichtliche Steuerpulte (#165)

## Problem

Die Steuer-Oberflächen der Suite sind mit jedem Feature-Zyklus voller geworden. Der
Titler ist das erste Tool, bei dem die Seitenleiste durch DataLink, iveo, Grafik-/PSD-
Import, Recall und den 2. Bildschirm zu einer sehr langen, flachen Sektionsliste
angewachsen ist (#165). Dasselbe Muster kündigt sich bei anderen Control-lastigen Apps
an (Switcher, Timer, Q&A, Rundown). Ohne ein gemeinsames Ordnungsprinzip driftet jede
App in ein eigenes Settings-Layout (mal Modal, mal Card-Liste, mal Tab).

## Leitprinzip

> **Live-Bedienung sichtbar, Einrichtung weggeräumt.**

Konkret pro Tool:

1. **Das primäre Live-Feld bleibt immer sichtbar** (Titler: das Namensfeld/„Inhalt";
   analog bei anderen Tools das jeweils wichtigste Bedienelement) — nie hinter einem
   Reiter oder Accordion.
2. **Sekundäre Live-Bereiche sind ausklappbar** (`Collapsible`) und merken sich ihren
   Auf-/Zu-Zustand pro Arbeitsplatz.
3. **Einrichtung/Konfiguration liegt in einem eigenen Reiter „Einstellungen"** (`Tabs`),
   getrennt von der Live-Steuerung — DataLink-Quelle, iveo-Status, Ausgabe (NDI/2.
   Bildschirm), Fernsteuerung/Netzwerk.

## Geteilte Bausteine (Fundament)

Neu in [`@jm/ui`](../../packages/ui/src/index.ts) — einmal gebaut, überall nutzbar
(homogener Stack: React 18 + electron-vite + Tailwind v4 + CSS-Variablen-Tokens):

| Baustein | Zweck |
|---|---|
| [`Collapsible`](../../packages/ui/src/components/Collapsible.tsx) | Ausklappbarer Abschnitt (Disclosure), Open-State optional persistiert (`persistId`) |
| [`SettingsSection`](../../packages/ui/src/components/SettingsSection.tsx) | Immer sichtbarer Abschnitt mit uppercase-Header + Beschreibung (ersetzt die pro App lokal kopierten `Section`-Helfer) |
| [`Tabs`](../../packages/ui/src/components/Tabs.tsx) | Segmentierte Umschaltung (z. B. „Steuerung" / „Einstellungen") |

Vorhandene geteilte **Backends**, an die die Einstellungs-Sektionen andocken:
[`@jm/control-config`](../../packages/control-config/) (Control-Server/Token),
[`@jm/iveo`](../../packages/iveo/) (Event-/Speaker-Daten).

## Wiederkehrende Einstellungs-Sektionen

Diese Sektionen tauchen quer über die Suite auf und sollten mittelfristig als geteilte,
vorkonfigurierte Sektions-Komponenten existieren (statt pro App neu gebaut):

- **DataLink** — Datenquelle/Watchfolder wählen.
- **iveo** — Status der Event-/Speaker-Anbindung (single-holder-Token bleibt im Launcher).
- **Ausgabe** — NDI-Quelle, Auflösung/fps, 2. Bildschirm.
- **Fernsteuerung/Netzwerk** — Control-Server/Companion-Port, Token (Backend `@jm/control-config`).

## Rollout-Phasen

### Phase 1 — Fundament + Titler-Pilot ✅ (dieser PR, feat/suite-ux-165)
- `Collapsible`, `SettingsSection`, `Tabs` in `@jm/ui`.
- Titler [`OperatorView`](../../apps/titler/src/renderer/src/views/OperatorView.tsx) auf
  zwei Reiter umgebaut: **Steuerung** (Vorlage, Inhalt/Namensfeld immer sichtbar,
  Grafik-Vorlagen/Daten-Recall/Stil ausklappbar) + **Einstellungen** (DataLink, iveo-
  Status, Ausgabe NDI, 2. Bildschirm). Kein Funktionsverlust; iveo-Status neu.

### Phase 2 — Switcher
[`SettingsView`](../../apps/switcher/src/renderer/views/SettingsView.tsx) nutzt schon
Card-Sektionen (Streaming/NDI/Audio/Companion/Aufnahme) — auf die geteilten Primitive
heben (`SettingsSection`/`Collapsible`). Geringer Aufwand, hoher Konsistenzgewinn.

### Phase 3 — Timer
[`Sidebar`](../../apps/timer/src/renderer/components/Sidebar.tsx) hat bereits ein
Settings-als-Tab-Muster mit eigenen `components/ui/`-Primitiven — diese durch die
`@jm/ui`-Bausteine ersetzen, damit die Suite eine Quelle der Wahrheit hat.

### Phase 4 — Q&A + Rundown (inkl. Token-Migration)
[`Q&A Settings`](../../apps/qa/src/renderer/components/Settings.tsx) (Modal) und
[`Rundown`](../../apps/rundown/src/renderer/src/App.tsx) nutzen noch rohe
`neutral-*`-Tailwind-Klassen statt der `@jm/ui`-Tokens. Hier: Modal → Reiter/Collapsible
**und** Migration auf die CSS-Variablen-Tokens (`var(--*)`). Q&A wird durch #166
ohnehin angefasst → dort gleich mitziehen.

### Phase 5 — Geteilte Sektions-Komponenten
Wenn 3–4 Apps dasselbe Muster tragen, die wiederkehrenden Sektionen (DataLink, iveo,
Ausgabe, Fernsteuerung) als vorkonfigurierte, an die geteilten Backends verdrahtete
Komponenten nach `@jm/ui` (oder ein `@jm/settings`-Paket) heben — Duplikat-UI über die
Suite reduzieren.

## Nicht-Ziele

- Kein Redesign der Live-Bedienlogik — nur Anordnung/Gruppierung.
- Keine Änderung an den Steuer-/Netzwerk-Protokollen.
- Der Rollout ist inkrementell und pro App unabhängig freigebbar; kein Big-Bang.

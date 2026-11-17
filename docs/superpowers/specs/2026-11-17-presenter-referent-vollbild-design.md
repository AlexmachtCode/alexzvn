# Presenter: Referentenansicht im Vollbild (#309)

**Stand:** 17.11.2026, Vorschlag vom Owner freigegeben („309 passt“). Kurzes Design (kleine Änderung).

## Absicht

Die Show-Crew meldet (#309): In der Referentenansicht bleibt die Windows-Taskleiste sichtbar – das stört das Bild und
kostet Platz. Gewünscht ist ein echtes Vollbild der Referentenansicht, „auf Knopfdruck oder per Einstellung“, das die
Taskleiste zuverlässig verdeckt.

## Ist-Zustand (origin/main bf45fba713, Presenter 0.13.0)

- `openPresenterWindow` (`src/main/windows.ts`) öffnet ein normales Fenster in der Arbeitsfläche des Hauptbildschirms,
  höchstens 1500×920 – die Taskleiste bleibt daneben sichtbar.
- Der Knopf „Vollbild“ im Kopf der Referentenansicht (`PresenterView.tsx`) schaltet das **Publikumsfenster**
  (`toggleAudienceFullscreen`), nicht die Referentenansicht. Vermutlich hat die Crew genau den probiert.
- Escape beendet die Präsentation (`usePresenterKeys`), wie in PowerPoint.

## Ziele

1. Neuer Knopf „Vollbild“ im Kopf der Referentenansicht schaltet das **Referentenfenster** ins echte Vollbild und zurück.
2. Taste **F11** in der Referentenansicht macht dasselbe.
3. Vollbild auf dem Bildschirm, auf dem das Referentenfenster gerade steht.
4. Der Zustand wird gemerkt: Lief die Referentenansicht zuletzt im Vollbild, öffnet die nächste Präsentation sie wieder im
   Vollbild (= „per Einstellung“). Auch über einen Neustart der App.
5. Der bisherige Knopf heißt „Publikum Vollbild“; seine Wirkung bleibt.

## Nicht-Ziele

- Kein Kiosk-Modus.
- Escape bleibt „Präsentation beenden“ und verlässt das Vollbild nicht eigens.
- Keine Wahl, auf welchem Bildschirm das Referentenfenster öffnet; am Publikumsfenster ändert sich nichts.

## Anti-Ziele

- Nichts, was die Bedienung aussperrt (Alt+Tab, andere Programme bleiben erreichbar).
- Kein Weg, der mitten in der Show versehentlich die Präsentation beendet oder das Publikumsbild ändert.

## Ansätze

| Ansatz | Bewertung |
|---|---|
| **A – Electron `BrowserWindow.setFullScreen`** | **Gewählt.** Unter Windows deckt es die Taskleiste ab; auf dem Mac entsteht ein eigener Vollbild-Bereich. Dasselbe Mittel nutzt schon das Publikumsfenster. |
| B – Kiosk-Modus (`setKiosk`) | Verworfen: hält das Fenster zwanghaft vorn, die Bedienung anderer Programme leidet (Anti-Ziel). |
| C – Randloses Fenster in Bildschirmgröße, immer oben | Verworfen: von Hand nachgebautes Vollbild, Taskleiste kann je nach Windows-Einstellung trotzdem darüber erscheinen. |
| D – HTML-Fullscreen-API im Renderer | Verworfen: Chromium verlässt sie mit Escape – das kollidiert mit „Escape = Präsentation beenden“. |

## Entscheidungen (Owner)

- Knopf + F11 + gemerkter Zustand, wie oben (freigegeben 17.11.2026).
- Auslieferung als Presenter 0.13.1 im COP-Release-Fenster 18–06 Uhr; Changelog-Texte legt die Sitzung dem Owner vor.

## Calls der Sitzung (zur Prüfung)

- Gemerkt wird im Main-Prozess in `userData/referent-config.json` (`{ "vollbild": boolean }`), nach dem Muster von
  `timer-config.json`. Grund: Das Fenster entsteht im Main; so steht der Zustand vor dem ersten Bild fest.
- Gemerkt wird bei jedem tatsächlichen Wechsel des Fensters (`enter-full-screen`/`leave-full-screen`), damit auch ein
  Ausstieg über das System (z. B. grüner Knopf auf dem Mac) zählt. Beim Schließen des Fensters ändert sich nichts.
- Der neue Knopf zeigt den aktuellen Zustand (hervorgehoben im Vollbild); der Main meldet jeden Wechsel an die
  Referentenansicht.
- Nur ein Bildschirm (Probe ohne Beamer): keine Sonderbehandlung. Publikums- und Referentenfenster liegen dann
  übereinander wie heute schon.

## Offen für den Bau

- Mac: nur per CI gebaut, nicht von Hand geprüft (kein Mac in der Sitzung).

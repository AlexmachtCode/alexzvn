# Texte zur Freigabe — Switcher 0.12.1 (Audio-Abzug) und drei Korrekturen aus UX Welle 1

Stand: Branch `fix/switcher-audio-abzug`. Anlass:
- Befund der Gesamtprüfung UX Welle 1: Der Audio-Eintrag des Switchers blieb grün, wenn das Gerät während der Show abgezogen wurde.
- Drei ungenaue Stellen in den Dokumenten (Abnahme TI4d, Rundown-Handbuch, CL-SW2).

Owner 22.11.2026: Fix und Doku-Korrekturen „ja“; neue Texte vor der Verwendung freigeben.

Nach der Freigabe (Prüfung 22.11.): Nur die Erklärung „Wann“ zu SW-A1 ist angepasst, weil „Gerät getrennt“ jetzt „Gerät nicht gefunden“ vorgeht. Damit zeigt die Statusleiste nach dem Abziehen wirklich den Text aus CL-SW5 und dem Handbuch. Die freigegebenen Texte selbst sind unverändert.

Das Datum des Changelog-Eintrags 0.12.1 ist ein Platzhalter und wird am Tag der Veröffentlichung gesetzt. Die freigegebene Texttabelle von Welle 1 (`docs/ux/welle1-texte.md`) bleibt unverändert; ersetzt werden die Stellen, die dort genannt sind.

## Neuer Statustext

| Nr. | Wo | Text | Wann |
| --- | --- | --- | --- |
| SW-A1 | Statusleiste „Audio“ und Panel ⚙ › Audiogerät | „Fehler: Gerät getrennt“ | Die Eingangsspur des gewählten Geräts endet, zum Beispiel weil es abgezogen wurde. Der Text geht „Gerät nicht gefunden“ vor, auch wenn das Gerät in der neu gelesenen Liste fehlt. Steckt dasselbe Gerät wieder, verschwindet der Fehler von selbst (spätestens nach etwa 2 s). Zeigt „Standard“ oder „Kommunikation“ danach auf ein anderes Gerät, bleibt der Fehler stehen, bis Du neu wählst. |

## Changelog Switcher 0.12.1 (neu)

| Nr. | Text |
| --- | --- |
| CL-SW5 | „Audio: Wird das Audiogerät während der Show abgezogen, zeigt die Statusleiste jetzt „Fehler: Gerät getrennt“ statt weiter grün. Die Geräteliste wird beim An- und Abstecken neu gelesen.“ |
| CL-SW6 | „Steckt das Gerät wieder, verbindet der Switcher es von selbst; der Ton kommt auch in eine laufende Aufnahme oder Sendung zurück.“ |

## Korrekturen

**CL-SW2** (Changelog Switcher 0.12.0, schon veröffentlicht). Die Stelle „wo es eine Einstellung gibt“ ist mehrdeutig: Die Aufnahme hat eine Einstellung (Bitrate), ihr Eintrag öffnet das Panel aber nicht.

- alt: „… Sie zeigt nur, was der Switcher wirklich weiß; ein Klick auf einen Eintrag öffnet, wo es eine Einstellung gibt, das Panel am passenden Abschnitt.“
- neu: „… Sie zeigt nur, was der Switcher wirklich weiß; ein Klick auf einen Eintrag öffnet das Panel am passenden Abschnitt, wenn sich der gezeigte Zustand dort ändern lässt.“

**Switcher-Handbuch**, Zeile „Kein Ton im Stream“ (`packages/cookbook/content/tool-manuals/tool-jm-switcher.md`).

- alt: „Audioquelle im Panel ⚙ › Audiogerät zugeordnet (Statusleiste „Audio“)? Pegel/Mute in der Ausgabeleiste prüfen“
- neu: „Audioquelle im Panel ⚙ › Audiogerät zugeordnet (Statusleiste „Audio“)? Pegel/Mute in der Ausgabeleiste prüfen. Steht „Fehler: Gerät getrennt“, das Gerät wieder einstecken: Der Switcher verbindet es von selbst.“

**Rundown-Handbuch**, Zeile „Tool wird nicht gefunden“ (`packages/cookbook/content/tool-manuals/tool-jm-rundown.md`). „nicht gefunden“ steht nur, wenn das Tool im Netz fehlt; sonst zeigt die Zeile einen der beiden anderen Zustände.

- alt: „… im Panel ⚙ › Gegenstellen steht es dann auf „nicht gefunden“. Gleiches Subnetz? …“
- neu: „… im Panel ⚙ › Gegenstellen steht es dann auf „nicht gefunden“ (kein Eintrag im Netz), „gefunden · nicht verbunden“ oder „manuell: ‹Host›:‹Port› · nicht verbunden“. Gleiches Subnetz? …“

**Abnahme TI4d** (`docs/ux/ABNAHME-UX-Welle-1.md`). Der Timer zeigt keine Zeile „Steuerserver“, weil er sie nicht anbietet.

- alt: „… unter ⚙ › Fernsteuerung stehen Steuerserver, Modus und Port (ein Hinweis auf das Companion-Modul steht dort nicht).“
- neu: „… unter ⚙ › Fernsteuerung stehen Modus, Port, bei laufendem Server Verbunden, und „Im Launcher einrichten“ (eine Zeile Steuerserver und ein Hinweis auf das Companion-Modul stehen dort nicht).“

Freigabe: ☒ alle Texte wie hier ☐ mit Änderungen (bitte je Nr. notieren) — Owner 22.11.2026 09:40: „texte ok“.

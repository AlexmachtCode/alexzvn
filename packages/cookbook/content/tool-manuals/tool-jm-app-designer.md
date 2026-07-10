---
id: tool-jm-app-designer
title: "JM App Designer — Messe-Lernspiele ohne Programmieren"
category: Tool-Manuals
difficulty: einfach
setupTimeMin: 20
teamSize: "1"
tags: [app-designer, messe, quiz, gluecksrad, memory, drag-and-drop, kiosk, export, manual]
relatedTools: [jm-app-designer, jm-grafiktool]
prerequisites:
  - JM App Designer installiert (über den Launcher)
  - Für den Terminal-Betrieb ein zweiter Bildschirm, idealerweise mit Touch
  - Bilder und Töne fertig zugeschnitten (der Designer bearbeitet sie nicht)
equipmentOwner: jm
crewRoles:
  - Redaktion
lastReviewed: 2026-07-10
owner: tech@jakobsmedien.com
summary: "Baukasten für interaktive Messe- und Lernspiele - Glücksrad, Quiz, Memory, Zuordnen per Ziehen. Regeln als Wenn-Dann-Liste, Sandbox zum Testen, Ausgabe als Touch-Terminal oder als eigenständiges Web-Bundle, das per Doppelklick auch vom USB-Stick läuft."
---

## Zutaten

### Voraussetzungen
- JM App Designer (über den Launcher)
- Ein zweiter Bildschirm für den Terminal-Betrieb (Touch empfohlen)
- Bilder als PNG oder JPG, Töne als MP3 oder WAV, fertig zugeschnitten

### Wie eine App aufgebaut ist
- Eine App besteht aus Szenen. Jede Szene enthält Elemente: Text, Bild, Schaltfläche, Spiel.
- Was passieren soll, schreiben Sie als Regel: Wenn etwas geschieht, dann tue dies.
- Variablen merken sich Punkte, Runden oder Ergebnisse über Szenen hinweg.
- Der Export erzeugt einen Ordner, der in jedem Browser läuft, ohne Server und ohne installierte Suite.

### Die vier Spiele
- Glücksrad: Sektoren mit Gewichten. Die Feldgröße ist die Gewinnchance.
- Quiz: Fragen mit sofortiger Rückmeldung, Punktezähler, Ergebnisseite.
- Memory: Karten umdrehen. Mit Gegenstück wird ein Zuordnungsspiel daraus, etwa Begriff zu Bild.
- Zieh-Element und Ablagefläche: Zuordnen per Ziehen, mit Gruppen.

## Schritt-für-Schritt

### Einrichtung
- Neu aus Vorlage wählen. Vier fertige, spielbare Beispiele stehen bereit, dazu eine leere App.
- Elemente links hinzufügen, auf der Bühne ziehen und skalieren.
- Beim Ziehen rastet das Element an Nachbarn und Bühnenmitte ein, eine gelbe Hilfslinie zeigt woran. Alt hebt das Einrasten auf.
- Rechts unter Eigenschaften das gewählte Element einstellen: Farben, Größen, Fragen, Kartenpaare, Radfelder.
- Regeln hängen an einem Element oder an der Szene. Der Editor bietet nur Auslöser an, die zum Typ passen.
- Aufbau einer Regel: Wenn (Auslöser), optional und (Bedingung), dann (eine oder mehrere Aktionen).
- Der Sonderwert $result trägt das Ergebnis des Auslösers: beim Rad das gezogene Feld, beim Quiz die gewählte Antwort.
- Beispiel Glücksrad: Wenn Rad bleibt stehen, und $result ist gleich gewinn, dann Szene wechseln zu Gewonnen.
- Beispiel Zählen: Wenn richtig beantwortet, dann Variable punkte erhöhen um 1.
- Für alles-geschafft gibt es keinen eigenen Auslöser. Zählen Sie hoch und prüfen Sie den Stand mit einer Szenen-Regel auf Variable ändert sich.
- Strg+Z macht rückgängig, Strg+Umschalt+Z stellt wieder her. Ein Zieh-Vorgang ist ein Schritt, kein Pixel.
- In den App-Einstellungen die Ruhezeit setzen (Zurück nach Sekunden). Auf einem Terminal ist das Pflicht.

### Im Betrieb
- Der Reiter Testen öffnet die Sandbox. Dort läuft genau das, was später exportiert wird.
- Unten sehen Sie live die Variablen und ein Protokoll, welche Regel gefeuert hat. Damit finden Sie den Grund, warum etwas nicht passiert, statt zu raten.
- Von vorn setzt das Spiel zurück. Neu laden ist nach dem Import neuer Medien nötig.
- Auf Terminal starten zeigt die App im Vollbild auf dem gewählten Bildschirm. Escape beendet sie wieder.
- Am Stand einmal warten und zuschauen, ob die Ruhezeit greift.

### Ausgabe
- Exportieren erzeugt einen Ordner mit index.html, runtime.js und assets.
- Ein Doppelklick auf die index.html genügt. Der Ordner läuft vom USB-Stick, aus einer Freigabe oder von einem Webserver.
- Immer den ganzen Ordner weitergeben, nicht nur die index.html.
- Der Export meldet die Gesamtgröße. Ab etwa 50 MB lohnt ein zweiter Blick auf die Videos.

## Profi-Tipps
- Feldgröße ist Gewinnchance. Beim Glücksrad bestimmt das Gewicht die Sektorgröße. Was der Besucher sieht, ist die echte Wahrscheinlichkeit.
- Ohne Ruhezeit steht der Stand nach dem ersten Besucher für immer auf der Gewinnseite. 60 Sekunden sind ein guter Anfang. Die Ruhezeit gilt auch im exportierten Bundle.
- Die Option Bleibt nach korrekter Ablage liegen am Zieh-Element an lassen. Sonst zählt eine Regel abgelegt plus 1 die Ablage-Vorgänge statt der Elemente, und wer ein Element herauszieht und neu ablegt, gewinnt zu früh.
- Beim Memory ergibt ein leeres Gegenstück ein klassisches Memory. Tragen Sie eines ein, wird ein Zuordnungsspiel daraus: Begriff zu Bild, Stadt zu Land. Das ist der eigentliche Wissensvermittler.
- Zwei Antworten im Quiz stehen untereinander, drei und mehr im Raster. Für ein Hochkant-Terminal sind zwei angenehmer.
- Schriften und Medien liegen im Bundle. Laden Sie nichts aus dem Netz nach, auf der Messe gibt es kein verlässliches WLAN.
- Die App läuft in Sandbox, Terminal und Export auf derselben Laufzeit. Was in der Vorschau lief, läuft auch beim Kunden.
- Regeln sind Daten, kein Programmcode. Der Designer führt nie etwas aus, was nicht in der Aktionsliste steht. Ein Bundle kann deshalb gefahrlos weitergegeben werden.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| Regel feuert nicht | Reiter Testen, unten ins Protokoll schauen. Steht der Auslöser dort, scheitert die Bedingung. Steht er nicht dort, ist die Regel aus oder hängt am falschen Element. |
| Exportierte App bleibt schwarz | Wurde der ganze Ordner kopiert? runtime.js und assets gehören neben die index.html. |
| Bild fehlt in der Sandbox | Nach dem Import einmal auf Neu laden tippen. |
| Zieh-Element lässt sich nicht bewegen | Liegt es schon richtig? Nach korrekter Ablage ist es festgestellt. Zum freien Sortieren die Option ausschalten. |
| Terminal zeigt noch das Spiel des letzten Besuchers | Ruhezeit in den App-Einstellungen setzen (Zurück nach Sekunden). |
| Besucher schließt das Terminal | Alt+Tab und Task-Manager kann kein Programm sperren. Ein wirklich abgeriegeltes Terminal richten Sie in Windows unter Zugewiesener Zugriff ein. |
| Zähler steht zu hoch | Läuft die Regel abgelegt plus 1 an der Ablagefläche und ist am Zieh-Element die Option Bleibt liegen an? |

## Checklisten

### Vor der Messe
- [ ] Alle Szenen in der Sandbox durchgespielt, auch die Verliererpfade
- [ ] Ruhezeit gesetzt (Zurück nach Sekunden)
- [ ] Auf dem echten Terminal mit dem Finger getestet, nicht nur mit der Maus
- [ ] Exportiert und die index.html per Doppelklick geprüft
- [ ] Rechtschreibung der Fragen und Antworten geprüft
- [ ] Bundle-Größe vertretbar, Videos falls nötig verkleinert

### Am Stand
- [ ] Terminal im Vollbild gestartet
- [ ] Ruhezeit greift, einmal warten und zuschauen
- [ ] Bildschirmschoner und Energiesparen am Rechner aus
- [ ] Ton hörbar, falls das Spiel welchen nutzt
- [ ] Ersatz-Bundle auf einem USB-Stick dabei

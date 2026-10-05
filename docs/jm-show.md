# JM Show — eine ganze Produktion auf einen Klick

> **Kurzfassung:** Eine `.jmshow`-Datei beschreibt eine komplette Produktion
> (Gottesdienst, Event, Sendung). Du öffnest sie im **Launcher**, und der startet
> automatisch alle beteiligten Tools — jedes lädt dabei seinen eigenen Teil
> (Ablaufplan, Folien, Moderationsskript, Bühnen-Anzeige). Kein manuelles
> Öffnen, kein IP-Eintippen.

Diese Anleitung richtet sich an Kolleg:innen, die JM Show **benutzen** wollen.
Die technischen Details zur Auto-Erkennung im Netzwerk stehen in
[suite-discovery.md](suite-discovery.md).

---

## 1. Wozu JM Show?

Bisher hieß Vorbereitung: Timer öffnen und Ablaufplan eintippen, Presenter
öffnen und Foliensatz laden, Prompter öffnen und Skript laden, Stage Display
öffnen und die IP-Adressen der Quellen eintragen. Bei jeder Produktion aufs Neue.

Mit JM Show machst du das **einmal**, speicherst es als `.jmshow`-Datei und
öffnest beim nächsten Mal nur noch diese eine Datei. Alles fährt koordiniert
hoch und ist vorbereitet.

---

## 2. Was steckt in einer `.jmshow`?

Eine `.jmshow` ist eine kleine, gut lesbare JSON-Textdatei. Sie listet die
beteiligten Tools auf und sagt pro Tool, **was** es laden soll:

| Feld | Bedeutung |
|---|---|
| `name` | Anzeigename der Produktion |
| `tools[]` | Liste der beteiligten Tools |
| `tools[].appId` | Welches Tool, z. B. `jm-timer`, `jm-presenter` |
| `tools[].document` | Pfad zum Dokument des Tools (z. B. Foliensatz, Skript) |
| `tools[].network` | `host`/`port` einer Quelle — für Stage Display im LAN |
| `tools[].settings` | Tool-eigene Einstellungen (z. B. Timer-Ablaufplan, Presenter-PIN) |
| `ablauf[]` | Zentraler Ablauf: Programmpunkte mit Titel, Dauer, Notiz und fester Kennung (`id`) — lesen Rundown und Timer (Abschnitt 8) |

Die gültigen Tool-IDs (`appId`) sind dieselben wie die App-IDs der Suite:
`jm-timer`, `jm-presenter`, `jm-prompter`, `jm-stage-display`, `jm-switcher`, …

---

## 3. Eine Show anlegen (Launcher)

1. Im **Launcher** den **Show-Editor** öffnen.
2. Einen **Namen** vergeben (z. B. „Sonntagsgottesdienst 10:00").
3. Pro Tool, das mitlaufen soll, das **Häkchen** setzen und je nach Tool:
   - **Dokument auswählen** (Presenter-Foliensatz `.jmpres`, Prompter-Skript
     `.docx`/`.txt`/`.md`),
   - bei vernetzten Quellen den **Host** eintragen (oder leer lassen → siehe
     unten „Ein Rechner vs. mehrere Rechner"),
   - beim **Timer** den **Ablaufplan** direkt im Editor eintippen.
4. **Speichern** → es entsteht eine `.jmshow`-Datei (am besten im
   Produktionsordner neben den Folien/Skripten ablegen).

> **Tipp:** Lege Folien und Skripte **relativ** zur `.jmshow` ab (z. B. einen
> Unterordner `folien/` und `skripte/`). Relative Pfade in der Show werden immer
> relativ zum Ablageort der `.jmshow`-Datei aufgelöst — so bleibt der ganze
> Produktionsordner verschiebbar und kopierbar.

---

## 4. Eine Show öffnen

Im Launcher **„Show öffnen"** wählen und die `.jmshow`-Datei auswählen. Der
Launcher startet daraufhin **alle** in der Show referenzierten Tools und gibt
jedem den Show-Link mit. Jedes Tool lädt dann selbstständig seinen Teil.

Was die einzelnen Tools beim Öffnen tun:

| Tool | Lädt aus der Show … |
|---|---|
| **Timer** | den **Ablaufplan** (`settings.timetable`) und optional die Countdown-Dauer (`settings.durationMs`). Der Timer hat kein eigenes Dokumentformat — seine Daten stehen direkt in der Show. |
| **Presenter** | den referenzierten **Foliensatz** (`document`) und öffnet ihn im Editor. |
| **Prompter** | das referenzierte **Skript** (`document`, `.docx`/`.txt`/`.md`) und springt an den Anfang. |
| **Stage Display** | **verbindet sich** mit allen Quellen, die in derselben Show stehen (Timer/Switcher/Presenter) — Host/Port aus deren `network`-Angabe, sonst Standard/localhost. Die Presenter-PIN kommt aus `settings.pin`. |
| **Rundown** | den **zentralen Ablauf** (`ablauf`) als Zeilen, bzw. sein referenziertes `.jmrundown` (relativ zur Show). Ändert sich der Ablauf, gleicht er ab, statt neu aufzubauen (Abschnitt 8). |

> Für Power-User: Der Launcher startet die Tools über den Deep-Link
> `jmps://open?show=<pfad>`. Den kann man auch direkt aufrufen (z. B. aus einem
> Skript) — jedes installierte Tool reagiert darauf.

---

## 5. Ein Rechner vs. mehrere Rechner

**Alles auf einem Rechner** (häufigster Fall): Lass die Host-Felder leer. Die
Tools laufen lokal, Stage Display verbindet sich automatisch auf `localhost`.

**Verteilt auf mehrere Rechner** (z. B. Timer am FOH, Stage Display backstage):
Hier gibt es zwei Wege —

- **Host fest eintragen:** Trag bei der Quelle in der Show die IP des
  jeweiligen Rechners ein (`network.host`). Eindeutig, aber bricht, wenn sich
  die IP ändert.
- **Auto-Erkennung (empfohlen):** Lass den Host leer. Stage Display findet
  aktive Quellen (Timer, Switcher, Presenter) **automatisch im LAN** per mDNS
  und trägt deren Adresse selbst ein. Kein IP-Tippen, robust gegen wechselnde
  IPs. Details: [suite-discovery.md](suite-discovery.md).

> **Wichtig:** Die Auto-Erkennung liefert nur die **Adresse**, nicht das
> Geheimnis. Eine Presenter-**PIN** musst du weiterhin in der Show (oder am
> Stage Display) hinterlegen.

---

## 6. Beispiel: eine vollständige `.jmshow`

```json
{
  "schemaVersion": 1,
  "name": "Sonntagsgottesdienst 10:00",
  "updatedAt": "2026-06-23T08:00:00.000Z",
  "tools": [
    {
      "appId": "jm-timer",
      "settings": {
        "timetable": [
          { "label": "Begruessung",  "durationMs": 300000 },
          { "label": "Lobpreis",     "durationMs": 1200000, "note": "4 Lieder" },
          { "label": "Predigt",      "durationMs": 2400000 }
        ]
      }
    },
    {
      "appId": "jm-presenter",
      "document": "folien/sonntag.jmpres",
      "settings": { "pin": "1234" }
    },
    {
      "appId": "jm-prompter",
      "document": "skripte/moderation.docx"
    },
    {
      "appId": "jm-stage-display"
    }
  ]
}
```

Diese Show öffnet vier Tools: Der **Timer** bekommt einen Ablaufplan
(5 / 20 / 40 Minuten), der **Presenter** lädt `folien/sonntag.jmpres`, der
**Prompter** lädt `skripte/moderation.docx`, und das **Stage Display**
verbindet sich automatisch mit Timer und Presenter (Adresse per Auto-Erkennung,
PIN `1234`). `durationMs` ist in **Millisekunden** (5 min = 300000).

---

## 7. Häufige Stolpersteine

- **Anführungszeichen im JSON:** Wenn du die Datei von Hand bearbeitest, nutze
  gerade ASCII-Anführungszeichen (`"`) und validiere das JSON vor dem Speichern.
  Am einfachsten: über den Show-Editor im Launcher pflegen.
- **Dokument nicht gefunden:** Pfade sind relativ zur `.jmshow`. Wird der
  Foliensatz/das Skript verschoben, ohne die Show anzupassen, lädt das Tool
  leer. Produktionsordner am Stück halten.
- **Stage Display findet die Quelle nicht:** Quelle muss laufen **und** ihren
  Server/Remote aktiv haben (Presenter/Prompter annoncieren nur bei
  eingeschalteter Fernsteuerung, Switcher nur bei laufendem Steuerserver).
  Außerdem müssen beide Rechner im selben Netz/Subnetz sein und mDNS darf nicht
  durch die Firewall blockiert sein. Siehe [suite-discovery.md](suite-discovery.md).
- **Ältere Show-Dateien:** Das Format wird beim Öffnen automatisch auf das
  aktuelle Schema migriert — ältere `.jmshow` öffnen also weiterhin.

---

## 8. Rundown folgt dem Ablauf (iveo)

Seit Rundown 0.6.0, Timer 0.13.0 und Launcher 0.13.0 trägt jeder Punkt des
zentralen Ablaufs eine **feste Kennung** (`ablauf[].id`): die iveo-ID, bei Punkten
aus dem Show-Editor eine beim Anlegen erzeugte. Darüber halten Timer und Rundown
ihren Punkt, auch wenn sich die Reihenfolge ändert.

**Was beim Abgleich passiert.** Ändert sich der Ablauf — eine iveo-Änderung, die
der Launcher abfragt, oder Speichern im Show-Editor —, bekommen Timer, Titler und
Rundown ein Neu-Laden. Der Rundown gleicht dann ab, statt neu aufzubauen:

- Die Zeilen aus dem Ablauf stehen in dessen Reihenfolge. Titel, Notiz und Dauer
  kommen aus der Show, die Aktionen bleiben an ihrer Zeile.
- Neue Punkte erscheinen an ihrer Stelle, ohne Aktionen.
- Eigene Zeilen wandern mit dem Ablaufpunkt über ihnen.
- Ein weggefallener Punkt ohne Aktionen verschwindet. Hat er Aktionen, bleibt er
  als „in iveo entfallen“ bzw. „in der Show entfallen“ stehen, feuert nie und wird
  beim Weiterschalten übersprungen. „Als eigene Zeile behalten“ macht ihn zu einer
  normalen eigenen Zeile.
- Die scharfe Zeile bleibt scharf, auch an neuer Stelle. Entfällt sie, wird die
  nächste Zeile scharf, und ein Hinweis bleibt stehen.
- Ein kurzer Hinweis fasst den Abgleich zusammen, z. B.
  „iveo: 2 geändert · 1 neu · neu sortiert“.

**Was im Rundown gesperrt ist.** Titel, Notiz und Dauer einer Ablaufzeile ändert
man in iveo bzw. im Show-Editor; der Rundown zeigt dazu „kommt aus iveo“ bzw.
„kommt aus der Show, im Show-Editor ändern“. Aktionen sind frei. Duplizieren
ergibt immer eine eigene Zeile.

**Side Events.** Schaltet der Launcher auf ein anderes Side Event oder eine
andere Tagesübersicht, merkt sich der Rundown Zeilen und Aktionen je Side Event
bzw. Tagesübersicht. Beim Zurückschalten ist alles wieder da.

**Timer-Sprünge.** Eine Aktion „Timer springe zu“ zielt auf den Ablaufpunkt,
nicht auf eine Nummer. Umgerechnet wird beim Senden, also auch nach einem
Umsortieren richtig. Ist das Ziel entfallen, wird nichts gesendet. Ältere
Sprünge mit fester Nummer bleiben, bis man sie mit „an diesen Punkt binden“
bindet.

**Neustart.** Der Rundown merkt sich die zuletzt geöffnete Show samt Stand und
scharfer Zeile. Ein Start über die Launcher-Kachel kehrt zu ihr zurück, ohne den
Timer zurückzusetzen. „Show öffnen“ setzt den Timer dagegen wie bisher zurück.

**Eigene `.jmrundown` in der Show.** Auch sie wird mit dem Ablauf abgeglichen.
In die Datei geschrieben wird nur bei „Speichern“.

**Show-Editor.** Speichern ändert nur, was im Formular steht: Tool-Einstellungen,
Port und der Zeitpunkt des letzten iveo-Abgleichs bleiben, Dauern sekundengenau.
Speichert man die gerade offene Show, laden Timer, Titler und Rundown sofort neu.

**Wenn der Abgleich hakt.** Scheitert eine iveo-Abfrage, bleibt der Ablauf, wie
er ist. Das Side-Events-Panel im Launcher zeigt dann „iveo-Abgleich gestört:
<Grund> (seit <Uhrzeit>)“, etwa „Token ungültig oder widerrufen“ oder „kein
iveo-Token auf diesem Rechner, nur Offline-Ablauf“.

**Titler hält seinen Speaker.** Seit Titler 0.10.0, Launcher 0.14.0 und
Rundown 0.7.0 hält die Bauchbinde ihre Person, nicht ihre Nummer in der Liste:
Der Titler merkt sich den abgerufenen Speaker über einen Ersatz-Schlüssel aus
Datei und Namen. Kommt in iveo ein Speaker davor dazu oder schaltet der Launcher
auf ein anderes Side Event um, bleibt dieselbe Person auf Sendung, und
Korrekturen aus iveo erscheinen sofort. Die iveo-Kennung der Speaker wird laut
Owner-Entscheidung vom 05.10.2026 noch nicht in Show, Titler und Rundown
übernommen. Fehlt die Person in der neuen Liste, bleibt die Bauchbinde stehen,
bis man sie ausblendet oder einen Eintrag abruft; Daten / Recall zeigt dazu
einen Hinweis. Ein Abruf ohne Treffer lässt nie still den vorherigen Speaker
aktiv. Der Rundown ruft Speaker über den aktuellen Namen ab; die Form
`TITLER RECALL @⟨Kennung⟩ ⟨Name⟩` versteht der Titler bereits. Eine Show
überschreibt den eigenen DataLink-Ordner des Titlers nicht mehr; „Zurück zum
eigenen Ordner“ in den Einstellungen führt zu ihm zurück. Ist die Speakerliste
von iveo nicht abrufbar, behält die Show ihre Speaker; Panel und Titler sagen
dann „aus früherem Stand“.

**Grenzen.** Das gilt am Einzelplatz: Tools auf einem anderen Rechner lesen
weiter ihre eigene Show-Datei (folgt mit Release 2 von Master-Link Teil 2b).
Sprünge aus Companion (`RUNDOWN GOTO n`, `TIMER GOTO n`) sowie
`TITLER RECALL <nr>`, Weiter und Zurück im Titler bleiben nummernbasiert. Wird
eine Show-Datei umbenannt oder verschoben, beginnt der Rundown für sie neu. Ein
älterer Rundown (bis 0.5), der eine neue `.jmrundown` speichert, verliert deren
Archiv und Markierungen.

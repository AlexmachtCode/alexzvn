# Abnahme JM Connect 0.2.2 (Zoom-SDK nachladen, Owner, echte Hardware)

Spec: `docs/superpowers/specs/2026-10-06-connect-zoom-sdk-laden-design.md`, Abschnitt 7 (Schritte), Texte aus Abschnitt 5.

- Getestet wird der Bau von connect-v0.2.2 auf einem **JM-eigenen** Rechner. Kunden-Rechner sind ausgeschlossen (Spec 1, Zoom-Lizenz §6.1).
- Der SDK-Schlüssel steht **nie** in dieser Datei, in Notizen, Screenshots oder Berichten; `<SDK-Schlüssel>` bleibt Platzhalter.
- Schritt 7 ist neu gegenüber Spec 7 und prüft die Log-Regel aus Spec 4.3.
- Scheitert Schritt 2 beim Entpacken (S16c, „… ließ sich nicht entpacken (Exit …)“), steht die Ursache von tar.exe im Log: „[zoom] Ausgabe von tar.exe: …“ (Platte, Rechte, Virenscanner, Pfadlänge). Kommt S12 oder S15, obwohl Schlüssel und Release stimmen, zeigt das Worker-Log des Proxys die Fehleinrichtung („zoom-sdk: Secret ZOOM_SDK_KEY fehlt …“ bzw. „zoom-sdk: GitHub 404 …“).

**Getesteter Bau** (vom Owner auszufüllen):

| Installer | SHA-256 | Datum | Rechner |
| --- | --- | --- | --- |
| `JM Connect-0.2.2-win-x64.exe` | | | |

**Voraussetzungen:**
- Der Proxy mit der Route `/zoom-sdk/:fassung` ist deployt, das Secret `ZOOM_SDK_KEY` ist gesetzt, und das `GITHUB_TOKEN` des Proxys darf `AlexmachtCode/jm-zoom-sdk` lesen.
- Im privaten Repo liegt das Release `zoom-sdk-7.1.5.43953` mit dem einen Asset `zoom-sdk-win-x64-7.1.5.43953.zip`.
- Die Zoom-Zugangsdaten sind eingetragen; sonst meldet Schritt 3 B17 statt PRUEFUNG_OK.
- Auf dem Laufwerk von `%LOCALAPPDATA%` sind mindestens 872 MB frei (ZIP, Entpackordner, Kopie und 100 MB Reserve).

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| 1 | Einrichtung aufklappen. In der Zeile „SDK-Schlüssel“ auf „Eintragen …“, `<SDK-Schlüssel>` einfügen (verdeckt; „anzeigen“ zeigt ihn), „Speichern“ | Die Eingabe klappt zu, die Zeile zeigt „SDK-Schlüssel: hinterlegt“. Im Log steht „[zoom] SDK-Schlüssel hinterlegt (verschlüsselt)“ und **kein** Wert | |
| 2 | Connect beenden, den Ordner `%LOCALAPPDATA%\JM Connect\zoom-laufzeit\7.1.5.43953` löschen, Connect starten. In der Zeile „Zoom-SDK“ auf „Zoom-SDK laden“ | Erst „Zoom-SDK wird geladen … x von 143 MB“ mit Balken und „Abbrechen“, dann „Zoom-SDK wird entpackt …“, danach die Kopieranzeige. „Zoom-SDK wird geprüft …“ steht dazwischen höchstens einen Augenblick (die Prüfung dauert nur Millisekunden); fehlt es, ist der Schritt trotzdem bestanden. Zuletzt „Zoom-SDK 7.1.5.43953 eingerichtet“ und Zustand „bereit“. Kopfzeile und Tray zeigen währenddessen „◌ Zoom: Einrichtung läuft“. Der Ordner `zoom-laufzeit\laden` ist danach weg | |
| 3 | „Einrichtung prüfen“ | „Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953), Anmeldung bei Zoom erfolgreich.“ (PRUEFUNG_OK) | |
| 4 | SDK-Schlüssel „Entfernen“, dann „Eintragen …“ mit einem falschen Schlüssel, danach „Zoom-SDK laden“ | S12: „Der Proxy hat den SDK-Schlüssel abgelehnt. Bitte den Schlüssel prüfen.“ Die bisherige Einrichtung bleibt („Zoom-SDK 7.1.5.43953 eingerichtet“) | |
| 5 | Den richtigen Schlüssel wieder eintragen, „Zoom-SDK laden“; während „Zoom-SDK wird geladen … x von 143 MB“ steht, auf „Abbrechen“ | Gleich nach dem Eintragen ist S12 aus der Zeile „Zoom-SDK“ verschwunden. Nach „Abbrechen“ S17 in grauer Schrift: „Laden abgebrochen. Die bisherige Einrichtung bleibt unverändert.“ Der Ordner `zoom-laufzeit\laden` fehlt oder ist leer, die alte Einrichtung ist unverändert | |
| 6 | Netz trennen (WLAN aus bzw. Kabel ziehen), „Zoom-SDK laden“ | S14: „Der Proxy ist nicht erreichbar (…). Bitte die Netzverbindung prüfen oder den SDK-Ordner von Hand wählen.“ In der Klammer steht nur ein Code wie ENOTFOUND, nie ein Link | |
| 7 | Logordner („Logordner öffnen“) nach dem SDK-Schlüssel und nach „sig=“ durchsuchen | Kein Treffer. Vom Proxy steht nur der Host in „[zoom] SDK-Link angefragt bei …“ | |

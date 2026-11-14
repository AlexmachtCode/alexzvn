# JM Presenter: NDI-Ausgang mit Alphakanal (#303) — Entwurf

Stand 2026-11-14 · Größe: Projekt · Ansatz B (Owner-Wahl 14.11.) · Ziel: Release noch während der COP (Fenster 18–06 Uhr)

## Anlass und Warum

Im Live-Betrieb kommen oft kurzfristig Bilder in ungünstigen Formaten (Hochkant vom Handy, WhatsApp-Bilder mit anderem Seitenverhältnis). Heute werden sie während der laufenden Session zugeschnitten und neu hochgeladen, damit die Bildregie sie sauber zeigen kann. Ziel: Der Presenter gibt sein Bild zusätzlich als NDI-Quelle aus; was das Bild auf der 16:9-Fläche nicht ausfüllt, ist **transparent**. Die Regie (OBS, vMix, TriCaster) legt die Quelle direkt über das Livebild — kein Zuschneiden mehr.

## Ziele

1. Eine NDI-Quelle **„JM Presenter“** (das NDI-SDK ergänzt den Rechnernamen selbst), **1920×1080, 25 fps**, BGRA mit Alphakanal, **nur Windows**.
2. **Inhalt = Publikumsbild:** aktuelle Folie bzw. aktuelles Bild, ohne Beschnitt eingepasst (contain, wie heute), mit Einblendungen (Text-/Bild-Overlays) und den eingestellten Übergängen (Schnitt/Überblendung).
3. **Transparenz:** freie Ränder transparent; ein Bild mit eigener Transparenz (PNG) bleibt transparent; PDF-/PowerPoint-Folien bleiben deckend (weiße Seite).
4. **Unabhängig vom Publikums-Bildschirm:** Die NDI-Quelle läuft auch ohne Publikumsfenster (z. B. Laptop ohne zweiten Monitor). Issue: „parallel oder alternativ“. **Owner 14.11.: Weg (a)** — das Bildschirm-Auswahlfeld „Publikums-Bildschirm“ bekommt den Eintrag **„Keiner – nur NDI“**. Damit startet „Präsentation starten“ nur die Referentenansicht, kein Publikumsfenster; das Bild geht ausschließlich über NDI. Schließen der Referentenansicht beendet die Präsentation wie heute. *Meine Entscheidung:* Der Eintrag ist nur wählbar, solange NDI an ist; wird NDI ausgeschaltet, während „Keiner“ gewählt ist, gilt beim nächsten Start wieder die bisherige Bildschirmwahl (sonst gäbe es eine Präsentation ohne jede Ausgabe). Die Start-/Stopp-Logik ändert sich nur für diesen neuen Fall.
5. **Zustände:** Pause „Schwarz“ → in NDI **vollständig transparent** (sonst läge Schwarz über dem Livebild); Pause „Weiß“ → weiß; nichts geöffnet bzw. Präsentation gestoppt → vollständig transparent.
6. **Bedienung:** ein Schalter „NDI“ in der Werkzeugleiste des Presenters, Vorgabe **aus**, zeigt an/aus und die Zahl verbundener Empfänger. Der letzte Zustand wird gemerkt — nach einem Neustart kommt NDI von selbst wieder.

```
[◀] [▶]  Publikums-Bildschirm: [Monitor 2 ▾]  [⛶ Vollbild]   [ NDI ● an · 2 Empfänger ]
```

## Nicht-Ziele (erste Fassung)

Mac; Einstellungen für Name/Auflösung/Bildrate; Companion-/Steuerbefehl für NDI; Ton; Video-Inhalte.
Stage Display im Modus „Keiner – nur NDI“: bekommt dann kein Folienbild (es fotografiert heute das Publikumsfenster ab). Owner 14.11.: wird über das eigene Vorhaben „Stage Display zeigt eine beliebige NDI-Quelle“ (Owner-Idee 06.11.) gelöst, das dann die Presenter-Quelle anzeigen kann — nicht Teil dieses Releases.

## Anti-Ziele (wäre ein Fehlschlag, selbst wenn es „funktioniert“)

- Der Bildschirm-Ausgang verändert sich oder ruckelt.
- Der Presenter reagiert beim Weiterschalten spürbar träger.
- Bildschirm und NDI zeigen verschiedene Folien oder verschiedene Übergänge.
- Fehlt die NDI-Laufzeit oder scheitert der Sender, stürzt der Presenter ab oder die Präsentation hängt. (Richtig: Schalter meldet „NDI nicht verfügbar“, alles andere läuft weiter.)

## Rahmen

- Während der COP Releases nur 18–06 Uhr Berlin; Patch-Notes zur Owner-Freigabe. Version **Presenter 0.13.0**.
- **Release-Weg ändert sich:** Der Presenter wird heute per CI (`.github/workflows/suite-release.yml`, macOS + Windows) gebaut. NDI-Apps (Titler, Connect, Switcher …) werden lokal gebaut, weil das NDI-SDK in der CI fehlt (`npmRebuild: false`, Addon lokal). → Windows-Installer **lokal** mit gebündeltem NDI (wie Titler), Mac weiter per CI **ohne** NDI (Mac ist Nicht-Ziel; der Mac-Presenter muss trotz der neuen Abhängigkeit bauen und starten, NDI-Schalter dort „nicht verfügbar“ oder ausgeblendet). `suite-release.yml` entsprechend anpassen (Vorbild: Connect mit `connect-mac.yml`).
- Bestehendes Muster wiederverwenden, nicht neu erfinden: Titler (`apps/titler`): `src/utility/ndi-sender.ts` (Utility-Prozess), `src/main/ndi/sender-process.ts` (fork, MessageChannelMain, Port über den Main weitergereicht), `tools/bundle-ndi.mjs`, zusätzlicher Main-Entry in `electron.vite.config.ts`, `extraResources`. `@jm/ndi`: `sendVideoBGRA(buf, w, h, fpsN, fpsD)`, straight alpha, ein Sender je Prozess, `connections()`.

## Ansätze

- **A — Offscreen-Fenster spiegelt die Publikumsansicht** (Electron `offscreen` + `paint`): automatisch exakter Spiegel inkl. CSS-Überblendung; aber in der Suite unerprobt, bei 1080p in Electron als rechenhungrig bekannt, liefert vormultipliziertes Alpha (Umrechnung je Bildpunkt). Verworfen: Versuch mit offenem Ausgang, passt nicht zu „live während der COP“.
- **B — Eigenes 1920×1080-Zeichenbild in einem versteckten Fenster** (Titler-/Untertitel-Muster) — **gewählt**: dreifach erprobt, straight alpha direkt aus `getImageData`, planbare Last, belastet weder Bedienfenster noch Publikumsbildschirm. Preis: Übergänge/Pausen werden für NDI ein zweites Mal gezeichnet → Gleichlauf-Schutz (unten).
- **C — Publikumsfenster abfilmen** (desktopCapturer/capturePage): kein Alpha, braucht immer den Bildschirm. Verworfen.

## Entwurf (entschieden)

- **Verstecktes NDI-Fenster** (`show: false`, 1920×1080, `backgroundThrottling: false`), eigene Ansicht im Presenter-Renderer. Es entsteht beim Einschalten von NDI und verschwindet beim Ausschalten; unabhängig davon, ob ein Publikumsfenster offen ist.
- **Zustand:** dieselbe Quelle wie die Publikumsansicht (`present:state`, Projekt/Folien). `broadcastAll` in `src/main/windows.ts` kennt heute nur Editor-, Presenter- und Publikumsfenster → das NDI-Fenster muss mitbedient werden.
- **Zeichnen:** je Takt `clearRect` (transparent), Folie/Bild mit den vorhandenen Zeichenfunktionen (`lib/pdf.ts` `renderBase`, `lib/paint.ts`) eingepasst, Overlays darüber, Überblendung über `globalAlpha` mit Dauer/Regeln aus `src/shared/wiedergabe.ts` (`uebergangFuer`). Pause Schwarz/leer = nur `clearRect`; Weiß = weiß füllen.
- **Senden (Last-Entscheidung nach Bauenden-Prüfung):** Der **Utility-Prozess** hält das zuletzt erhaltene Bild und sendet es selbst stetig mit 25 fps (`sendVideoBGRA(…, 1920, 1080, 25, 1)`), auch bei Standbild. Das NDI-Fenster zeichnet und liest (`getImageData` → RGBA→BGRA → MessagePort) **nur, wenn sich etwas ändert**: Folienwechsel, Pausewechsel, und während einer Überblendung je Takt (25 fps). So kostet ein Standbild im Renderer praktisch nichts.
- **Sender-Lebensdauer:** Ist NDI an, existiert der Sender ab App-Start — auch ohne Projekt und ohne laufende Präsentation — und liefert dann Transparenz. Er verschwindet nicht beim Stoppen einer Präsentation. Das NDI-Fenster bekommt bei jedem Präsentationsstart/-stopp die Folien neu (eigene Übergabe; `getPayload` beim Laden reicht nicht, weil der Payload nur während einer Präsentation existiert). Doppelte Quelldaten im Speicher vermeiden, wo es ohne Umbau geht.
- **Empfängerzahl:** `connections()` etwa jede Sekunde an die Werkzeugleiste.
- **Schalterzustand:** kleine JSON-Datei in `userData` (Muster `src/main/remote-config.ts`).
- **Fehlerfall:** Utility-Prozess endet oder Addon/Laufzeit fehlt → Schalter zeigt „NDI nicht verfügbar“ bzw. aus, Log-Zeile, kein Absturz, Präsentation unberührt.
- **Gleichlauf-Schutz (Teilschutz, bewusst):** Die Publikumsansicht wird NICHT umgebaut (Anti-Ziel). Gemeinsam ist nur das Statische — welche Folie, welche Pause, welcher Übergang mit welcher Dauer — als reine Funktion, die beide Ansichten nutzen; ein Test prüft dafür gleiche Ergebnisse. Das Timing der NDI-Überblendung ist eigener Code und bildet die Bildschirm-Blende nach (gleiche Schichtreihenfolge und gleicher Deckkraftverlauf wie der CSS-Stapel in `AudienceView`, damit transparente Ränder während der Blende gleich aussehen). Der Test schützt also die Entscheidung, nicht das Bild der Blende.
- **Ort des Schalters:** in der Editor-Werkzeugleiste (`components/Toolbar.tsx`, neben dem Bildschirm-Auswahlfeld) UND in der Referentenansicht (`views/PresenterView.tsx`), beide an denselben Zustand gebunden — bedienbar auch ohne laufende Präsentation.
- **Mac-CI:** `@jm/ndi` wird nirgends statisch importiert; nur der Utility-Prozess lädt es, und er wird nur gestartet, wenn seine Datei und das Addon vorhanden sind. So baut und startet das Mac-Paket aus der CI ohne NDI.

## Abnahme

1. In OBS oder vMix (und wenn möglich TriCaster) erscheint „<Rechner> (JM Presenter)“; ein Hochkant-Bild liegt mit transparenten Rändern über einem Livebild.
2. Überblendung und Schnitt sind in der NDI-Quelle wie auf dem Bildschirm zu sehen.
3. Pause Schwarz → Quelle transparent; Weiß → weiß; Präsentation gestoppt → transparent.
4. Ohne Publikums-Bildschirm (nur NDI) funktioniert alles.
5. Neustart mit NDI an → Quelle kommt von selbst wieder.
6. Auf dem Show-Rechner der Kollegen (bzw. dem schwächsten vorgesehenen): 25 fps über 30 Minuten ohne verlorene Bilder im NDI-Monitor, auch während Überblendungen; CPU-Last bei Standbild und während einer Überblendung gemessen und notiert; Weiterschalten ohne spürbare Verzögerung; Bildschirm-Ausgang unverändert. **Keine adaptive Bildrate:** schafft ein Rechner die 25 fps während Überblendungen nicht, wird gestoppt und dem Owner berichtet, statt still herunterzuregeln.
7. Ohne NDI-Laufzeit (bzw. Mac-Paket): Presenter startet, Schalter „nicht verfügbar“.

## Dem Bauenden überlassen

Name und Aufbau der NDI-Ansicht/Route; Kopie vs. Transfer der Bildpuffer; genaue Taktsteuerung; Detailgestaltung des Schalters im Stil der Werkzeugleiste; Form der gemeinsamen Zustandsfunktion; wie `suite-release.yml` den Presenter aufteilt (Vorbild Connect).

## Meine Entscheidungen (zur Prüfung durch den Owner)

- NDI-Name fest „JM Presenter“.
- Empfängerzahl in der Werkzeugleiste.
- Schalter merkt sich den Zustand (Vorgabe aus).
- Stetiger 25-fps-Strom auch bei Standbild.
- Release-Weg: Windows lokal mit NDI, Mac per CI ohne NDI.

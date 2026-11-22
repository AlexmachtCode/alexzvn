# UX-Update Welle 1: Entscheidungen während der Umsetzung (R1–R31)

Bei der Umsetzung von Welle 1 waren an einigen Stellen Plan, Spec und Code nicht eindeutig. Diese Entscheidungen sind hier
festgehalten, damit die Verweise „R1“ bis „R31“ in den Funktionslisten (`docs/ux/funktionslisten/*.md`, Spalte „künftig
wo“) und in den Tests nachlesbar sind. Die Entscheidungen E1 bis E18 stehen im Plan
(`docs/superpowers/plans/2026-11-21-ux-welle1.md`). Jede Entscheidung gilt, bis der Owner sie ändert.

- **R1** Switcher, Fernsteuerung: Der Kanal `control:status` bleibt mit dem Typ `ControlStatus` und bekommt nur die
  optionalen Felder `modus` und `fehler`. Die Fernsteuerungs-Meldung lebt wie beim Titler in `shared/fernsteuerung.ts`,
  dazu zwei Umsetzer zwischen `ControlStatus` und Meldung. So bleiben Kanal, Namen und bestehende Felder gleich.
- **R2** Q&A: Das Umziehen der Quelltext-Wächter in `apps/qa/test/cloud-zugang.test.ts` auf die neuen Dateien ist eine
  erlaubte Änderung eines bestehenden Tests. Maßstab: gleiche Zahl und gleiche Strenge der Zusicherungen, belegt mit einer
  Gegenprobe.
- **R3** Switcher: Das Start-Ereignis der Fernsteuerung trägt den angefragten Port, weil der Port einstellbar ist; sonst
  nennte „Port belegt“ den Standardport statt des eingestellten.
- **R4** Switcher: Statuseintrag und Abschnitt Fernsteuerung richten sich zuerst nach der Einstellung „Steuerport an“.
  Aus ergibt „aus“ ohne alten Fehler; an ergibt die Meldung des Servers (unbekannt, Port belegt, Fehler, läuft mit Clients).
- **R5** Switcher: Eigene Texte, die Texte aus `@jm/ui` oder `@jm/settings` nachtippten („bereit“, „startet“), verletzen
  die Vorgabe, gemeinsame Texte nie nachzubauen; der Switcher nutzt die gemeinsamen Texte.
- **R6** Switcher, Audio: Die Geräteliste entsteht beim Start nur per `enumerateDevices`, ohne Mikrofon-Probe; die Probe
  bleibt beim Öffnen der Audio-Einstellung bzw. bei „Neu suchen“. Eine unbrauchbare Startliste ergibt „unbekannt“.
- **R7** Switcher: Im Wächter gegen nachgebaute Texte ist „Auto“ ausgenommen. Es ist die heutige Beschriftung der Taste und
  zufällig gleich einem gemeinsamen Text mit anderem Zweck (Gegenstellen).
- **R8** Switcher: „Monitore aktualisieren“ und die alten Erklärtexte der Einstellungskarten (NDI, Untertitel, Audio) stehen
  wörtlich wieder im Panel, weil keine Entscheidung ihr Entfallen deckte (Spec 10: wiederherstellen statt streichen).
- **R9** Alle: Ein bestehender Text, der einen nicht mehr vorhandenen Ort nennt, wird nur als neuer Text in der
  Textkonstante des Werkzeugs angepasst; der alte Wortlaut steht in `docs/ux/welle1-texte.md` unter „Entfällt“, der neue
  zur Freigabe in der Tabelle. Ein reiner Tausch ASCII-Anführungszeichen gegen „ “ ist keine Umformulierung, steht aber
  ebenfalls dort.
- **R10** Timer (und alle Haupttasten): Haupttasten bekommen einen festen React-Schlüssel je Rolle, nie die Beschriftung.
  Sonst verlöre die Taste Start/Pause beim Wechsel den Fokus, und Tab- und Enter-Bedienung bräche.
- **R11** Timer: Die Anzeige-Abfragen der LAN-Fernbedienung (Adressen alle 4 s, Auth lesen) laufen als Ausnahme im Panel. Es
  sind reine Anzeigen, kein Statuseintrag hängt daran, und sie liefen früher auch nur in der sichtbaren Ansicht.
- **R12** Timer und Switcher: Die Zeilen neben dem Toolnamen („Live Production“, „Video-Mischer · Program / Preview“)
  entfallen nach der freigegebenen Spec 3.2 (links nur Logo und Toolname). Beide stehen unter „Entfällt“.
- **R13** Alle Funktionslisten: Ein Haken darf nichts Falsches behaupten, etwa „unverändert“ für eine geänderte Datei oder
  einen falschen Verweis. Die Liste ist die Grundlage der Abnahme.
- **R14** Fernsteuerung: Ein Startfehler des Steuerservers wird geloggt; früher erschien er als unbehandelte Ablehnung im
  Log des Hauptprozesses, ohne Logzeile wäre er nirgends zu sehen.
- **R15** Rundown: Die Haupttasten sperren nur, was heute gesperrt ist. GO ist ohne scharfe Zeile gesperrt, jetzt mit Grund;
  ◀ Zurück und Weiter ▶ bleiben wie heute nie gesperrt.
- **R16** Rundown: Liste und Transport dürfen sich bei 960 × 640 mit offenem Panel nicht überlappen; die Liste scrollt in
  einem eigenen Behälter, die Tasten neben GO bleiben frei.
- **R17** Rundown: Ist der Transport schmaler als 292 px (nur im kleinsten Fenster mit offenem Panel), stehen die drei
  Tasten untereinander, GO zuoberst; zwei Tasten nebeneinander brauchen 292 px.
- **R18** Funktionslisten: Zeilen zu einer Datei, die nur die lesenden Brücken bekam (E2: Fernsteuerungs-Meldung,
  Master-Link), dürfen „✓ unverändert (‹Datei›)“ tragen, mit dem Zusatz, dass nur E2 hinzukam und die Zeile nicht berührt
  ist. Der Test erzwingt den Zusatz.
- **R19** Q&A: Die Liste nennt einen Bestätigungsdialog (Karte Extern, „Event beenden & Daten löschen“), nicht zwei wie der
  Plan. Die Liste folgt dem Code.
- **R20** Gegenstellen (`@jm/settings`): Ein per mDNS gefundenes, aber nicht verbundenes Tool heißt „gefunden · nicht
  verbunden“ (gemeinsamer Text GE1); Q&A zeigt dazu `host:port`.
- **R21** Q&A, Redezeit (ebenso Battle, Runden und Clip-Länge): Die Wirkung bleibt. Unter 5 wird beim Übernehmen 5, keine
  Obergrenze. Übernommen wird bei Enter oder beim Verlassen des Feldes statt je Tastendruck (Zahlenfeld aus `@jm/ui`).
- **R22** Tests: Ein Test, der nichts zusichert, oder dessen Name mehr verspricht als die Prüfung, wird nachgeschärft.
- **R23** Funktionslisten: Der Abgleich mit git läuft nur auf Wunsch (`JM_FUNKTIONSLISTE_GIT=1`), nicht im normalen
  Selbsttest; dort schützen die statischen Listen. Er läuft einmal am Ende der Welle.
- **R24** Q&A und Battle: Die Karten der rechten Spalte (Saal und Extern; Publikums-Voting und Instant-Replay) bleiben immer
  offen, ohne Einklappen. Es sind Live-Werkzeuge.
- **R25** Battle: Kontrast der Jury-Taste B in Hell, Farb-Wächter auch gegen 8-stelliges Hex und `rgb()`, und ein Test der
  Tastenschlüssel mit Bezug zum Gerenderten. Der neue Hell-Modus muss lesbar sein; der Kontrast wird aus den Farbwerten
  gerechnet.
- **R26** Alle Zahlenfelder: ↑ und ↓ ändern den Wert nicht mehr, weil das Zahlenfeld aus `@jm/ui` ein Textfeld ist (schon im
  abgenommenen Titler so). In Welle 1 kein Wiederherstellen; es steht in den Listen und in der Abnahme.
- **R27** Battle: „Einstellungs-Fenster wird Panel“ verweist auf E16, weil E16 die Einstellungen von Battle in Abschnitte des
  Panels verlegt.
- **R28** Texttabelle (`docs/ux/welle1-texte.md`): Alle Hinweise zur Vorlage für den Owner (Ortshinweise, interne Kürzel,
  ungenaue Notizen) und ein sichtbarer Text außerhalb der Textkonstante werden behoben. Der Owner gibt nach diesem
  Dokument frei; es muss wahr und vollständig sein.
- **R29** Gesamtprüfung: Sie lief in drei Bereichen (A: `@jm/ui`, `@jm/settings`, Steuerprotokoll, Switcher, CI; B: Timer,
  Rundown; C: Q&A, Battle), danach folgte eine Nachbesserung mit der vollständigen Fundliste.
- **R30** Rundown: Der Satz zur Lage von GO in der Abnahme (RDZ1) und die Abweichung von R17 im Code (gestapelt stand GO
  nicht zuoberst) wurden gemeinsam in der Nachbesserung behoben.
- **R31** Rundown, Gegenstellen: Die eigene Rolle „rundown“ hat keine Zeile. Der Abschnittsstatus zählt nur Rollen, die
  gefunden, manuell gesetzt oder in einer Aktion des Ablaufs verwendet sind; die Zeilen selbst zeigen weiter den gemessenen
  Zustand, damit sich auch ein noch nicht gefundenes Tool setzen lässt.

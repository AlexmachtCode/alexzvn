# UX-Update Welle 1 „Live-Kern“: Switcher, Timer, Rundown, Q&A, Battle

Stand 21.11.2026. Kurzer Entwurf; das fachliche Wie steht in der freigegebenen Spec
`docs/superpowers/specs/2026-10-08-suite-ux-update-design.md` (Owner 08.10., „spec passt“, Vorgaben UO1–UO8). Dieses
Dokument hält nur fest, was am 21.11. für Block 4 entschieden wurde. Owner-Freigabe 21.11. („passt“).

## Warum

Owner 21.11. nach der COP31: Die Tools haben gut unterstützt, sie müssen aber benutzerfreundlicher werden. Das UX-Update
ist dafür der Weg. Welle 0 (Fundament `@jm/ui` + `@jm/settings`) und der Titler-Pilot (Titler 0.12.0, 17.10.) sind
ausgeliefert und abgenommen. Laut Spec 9.2 beginnt Welle 1 erst nach der Abnahme des Pilots; das ist erfüllt.

## Ziele

- Die fünf Live-Kern-Apps bekommen das Bediengefühl des Titler-Piloten nach Spec und Anhang A („B Sendepult mit Dichte von
  A“):
  - Statusleiste unten, Tally-Farben, große Haupttasten;
  - Einstellungen aufgeräumt im Panel aus `@jm/settings`;
  - Hell/Dunkel.
- Kein Funktionsverlust (Spec 10): Jede App bekommt vor dem Umbau eine Funktionsliste aus dem Code, nach dem Umbau wird
  jeder Punkt abgehakt. Ein Punkt ohne Haken blockiert die Welle.

## Nicht-Ziele

- Bedienlogik, Protokolle, Ports, IPC und Hauptprozesse ändern sich nicht (Spec U6, Abschnitt 10).
- **Live-Sicherheit (Lane F) ist in diesem Block nicht enthalten.** Die Owner-Antwort 21.11. nennt keine Show-Momente, in
  denen es knapp wurde. Lane F bleibt in der Roadmap geparkt, bis es konkrete Anlässe gibt.
- Keine anderen Apps (Welle 2 und 3).
- #317 Stufe B wird später gemacht, eigener Entwurf.

## Anti-Ziele

- Eine Funktion, ein Tastaturkürzel oder ein Zustand ist nach dem Umbau nicht mehr erreichbar.
- Eine Statuszeile zeigt einen Zustand anders als heute ehrlich an (Lehre „Statuszeile lügt leichter als Schweigen“).
- Ein Umbau unterbricht etwas, das live läuft. Beispiel: Der Mischer des Switchers bleibt gemountet, während die
  Einstellungen offen sind.

## Ansätze

- **Gewählt: eine Welle, gesammelt** (Spec 9.1).
  - Ein Branch und ein Plan für die fünf Apps, gebaut in der Reihenfolge Switcher, Timer, Rundown, Q&A, Battle.
  - Jede App bekommt einen eigenen Minor-Sprung und eigene Release-Notes.
  - Released wird nach der Owner-Abnahme der ganzen Welle, nur mit Owner-Freigabe.
  - Der Owner kann jede App ansehen, sobald sie fertig ist; seine Rückmeldung fließt in die nächste App ein.
- Verworfen: je App ein eigener Plan und ein eigener Release. Das brächte Nutzen früher, widerspricht aber Spec 9.1. Das
  Ansehen je App liefert die frühe Rückmeldung auch so.

## Festgelegt (Owner 21.11.)

- **Vorgaben:** Umfang, Haupttasten, Statuseinträge, Einstellungen und Risiken je App stehen in Spec Anhang A, „Welle 1“.
- **Vor dem Umbau** kommen die Vormerkungen aus Fundament und Pilot dran (Pilot-Plan „Bewusst nicht in diesem Plan“,
  Fundament-Plan „Vorgemerkt für die Wellen“):
  - TallyButton „Klick nach dem Entsperren“;
  - die Lücke im E3-Wächter `text-base`/`font-*`;
  - StatusBar ohne `whitespace-nowrap`;
  - AppHeader-On-Air ohne `role="status"`.
- **Je Tool in seiner Welle:** die Master-Link-Brücke (Preload) und die Fernsteuerungs-Meldung.
- **Texte:** Neue sichtbare Texte (Beschriftungen, Status- und Sperrtexte, Release-Notes) gehen vor dem Release als
  Tabelle zur Owner-Freigabe, wie in Anmeldung Teil 2.
- **Umsetzung:** subagent-driven, ein Helfer je Aufgabe, eine Prüfung je Aufgabe, eine Gesamtprüfung am Ende.

## Dem Bauenden überlassen

- Der Zuschnitt der Aufgaben je App, nach dem Muster des Titler-Piloten: Funktionsliste, Ableitungen, Rahmen,
  Live-Bereich, Panel, Abhaken.
- Die Teststruktur je App, nach dem Titler-Testwerkzeug.
- Was nach dem Bau einer App am Plan der nächsten App nachgezogen wird.

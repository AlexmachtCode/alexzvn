# UX-Update Welle 2: Entscheidungen während der Umsetzung (W1–W133)

Bei der Umsetzung von Welle 2a (Caption, Interpreter, Prompter, Stage Display, Recorder, Player) waren an einigen Stellen
Plan, Spec und Code nicht eindeutig. Diese Entscheidungen sind hier festgehalten. W1 bis W63 gehören zu Welle 2a; Welle 2b
(Presenter, Studio-Control, Connect und der Nachzug für Prompter, Stage Display und Player) steht ab W64 im Abschnitt
„Welle 2b“ am Ende, mit eigener Einleitung. Für Welle 2a gilt: Die Funktionslisten
(`docs/ux/funktionslisten/*.md`, Spalte „künftig wo“), die Texttabelle (`docs/ux/welle2a-texte.md`) und die Tests nennen sie
als „Ruling Task ‹n›“, „Ruling P‹n›“, „Ruling R-T‹n›“ oder „Ruling Gesamtprüfung ‹Punkt›“; die Klammer hinter jeder Nummer
nennt diese Herkunft. Die
Entscheidungen E1 bis E16 stehen im Plan (`docs/superpowers/plans/2026-11-22-ux-welle2a.md`); R1 bis R31 aus Welle 1
(`docs/ux/welle1-entscheidungen.md`) gelten weiter, wo sie passen. „Die Bedienlogik bleibt“ meint die Regel U6 der Spec:
Main, Preload, IPC und Store-Logik ändern sich nur an den im Plan erlaubten Stellen. Jede Entscheidung gilt, bis der Owner
sie ändert. Zu jeder stehen der Grund und der Preis, falls sie sich als falsch erweist.

## Übergreifend

- **W1** (P2) Abhängigkeiten: `npm install` lief nur im Wurzelordner dieses Arbeitsbaums. Danach wurde jedes Mal geprüft,
  dass die Paket-Verknüpfungen unter `node_modules/@jm` mit großem `C:` beginnen; bei kleinen Verknüpfungen wäre nichts von
  selbst umgestellt, sondern zurückgefragt worden. Grund: In diesem Arbeitsordner ergab die Installation nachweislich große
  Verknüpfungen; kleine führen zu doppelt geladenem React und schwankenden Tests. Preis bei Irrtum: eine Rückfrage.
- **W2** (P4) Feldschutz je App: Die Prüfung, ob der Fokus in einem Feld liegt (`istEingabeZiel`), steht in Prompter und
  Player je in `lib/oberflaeche.ts`, wie beim Timer in Welle 1, nicht in einem gemeinsamen Paket. Grund: Welle 2a baut
  keinen neuen gemeinsamen Baustein. Preis: zwei kleine Kopien.
- **W3** (R-T2) Laufzeitdateien in den Funktionslisten: Dateien, die erst zur Laufzeit im Benutzerordner der App entstehen
  (z. B. `prompter-config.json`, `control.json`), dürfen in Code-Schrift stehen, wenn die Zeile sie als Laufzeitdatei
  kennzeichnet. Die Existenzprüfung gilt nur für Dateien im Repository, und der Abhak-Test prüft nur die Dateien der Spalte
  „künftig wo“. Grund: Sonst wäre jede Laufzeitdatei ein falscher Befund. Preis bei Irrtum: eine Umformulierung.
- **W4** (E16, während Task 6) Untertitel im Kopf: Der Plan bekam die Entscheidung E16. Die eigenen Untertitel der alten
  Köpfe (z. B. Prompter „Teleprompter“) entfallen in allen sechs Apps; der alte Wortlaut steht in der Texttabelle unter
  „Entfällt“ (EN1). Der Listentest erlaubt dafür E1 bis E16. Grund: Der gemeinsame Kopf zeigt nach Spec 3.2 nur Logo und
  „JM ‹Tool›“ und kennt keinen Untertitel; ein Nachbau in der Kopfmitte wäre ein Sonderweg. Preis: ein Satz je App in der
  Texttabelle.
- **W5** (Z1) Texttabelle: Vier kleinere Befunde aus der Prüfung der Texttabelle wurden behoben, weil die Tabelle das
  Freigabedokument des Owners ist. Der Abschnitt „Geänderte Bedienung“ nennt die geänderten Tastenplätze (Caption: Raster
  statt Kopfzeile; Recorder: „Eingang öffnen“ rechts bei geschlossenem Eingang; Interpreter: Taste 37 px tiefer). IN6 nennt
  die verbleibende alte Karte „Das Ausgabegerät wurde geändert …“ neben dem neuen Hinweis. Frage 1 nennt jetzt auch die
  Option „so lassen“; entschieden ist sie damit nicht, die Antwort gibt der Owner. Frage 2 nennt die Nebenwirkungen
  (angehaltene Ton-Cues kommen nach einem Video-Start erst über Pause und Weiter zurück; ON AIR kann nach dem Ende eines
  Cues in der Pause fälschlich an bleiben). Preis: einige Sätze.
- **W6** (ohne Task) Testbau je App: Ein Testbau (`win-unpacked`) jeder App nach dem Umbau ihrer Oberfläche wurde in der
  Nacht nicht angeboten, weil der Owner nicht erreichbar war. Stattdessen gibt es ein Angebot aller sechs Testbauten nach der
  Gesamtprüfung. Preis: Rückmeldungen des Owners konnten nicht mehr in die Arbeit an den späteren Apps einfließen.

## Prompter

- **W7** (Task 4) Laufzustand: Ob der Text läuft, liest die Oberfläche aus `transport.playing`. Grund: Der Zustandstyp
  kennt kein `scrolling`; der Hauptprozess leitet den Fernsteuerungswert `scrolling` selbst daraus ab (`main/index.ts:90`).
  Preis: nichts.
- **W8** (Task 4) Handy-Fernbedienung ohne Adresse: E11 ist genauer gefasst. Ist die Handy-Fernbedienung an und ihr Server
  läuft, aber es gibt keine LAN-Adresse, steht der Eintrag auf Warnung mit dem vorhandenen Text „Keine LAN-Adresse
  gefunden“; „in Ordnung“ gibt es nur mit mindestens einer Adresse. Grund: Sonst behauptete „in Ordnung“ eine Erreichbarkeit,
  die es ohne Adresse nicht gibt. Preis: ein eigener Text weniger.
- **W9** (Task 4) Gemeinsame Texte: Der Wächter gegen nachgebaute Texte aus `@jm/ui` und `@jm/settings` (R5, Muster Timer)
  bleibt Pflicht. E3 erlaubt gleiche Wörter in mehreren Apps, aber kein Nachbauen gemeinsamer Texte: Gleicht ein Text in
  `PROMPTER_TEXTE` einem gemeinsamen, wird der gemeinsame genutzt; Ausnahmen sind begründet wie R7. Preis bei Irrtum: eine
  Umstellung.
- **W10** (Task 4) Ausnahmen im Text-Wächter: „offen“ (das Fenster, nicht der Modus der Fernsteuerung) und „nicht
  gestartet“ (der Handy-Server, E11) bleiben eigene Texte, mit Begründung im Test, wie R7. Grund: gleiche Wörter, andere
  Bedeutung. Preis bei Irrtum: zwei Texte.
- **W11** (R-T5a) „Keine LAN-Adresse gefunden“: Statusleiste und Panel-Abschnitt „Handy-Fernbedienung“ nutzen denselben Text
  aus `PROMPTER_TEXTE`. Der alte Wortlaut mit Schlusspunkt (`OperatorView.tsx:241`) steht nach R9 in der Texttabelle unter
  „Entfällt“ (EN10). Grund: eine Quelle statt zwei. Preis: ein Punkt.
- **W12** (R-T6a) Tooltips der Marken-Tasten: „Voriger Abschnitt“ und „Nächster Abschnitt“ sind wieder da, über ein Element
  mit `title` um die Taste, ohne Änderung an `@jm/ui`. Grund: Was beim Umbau verloren ging, wird wiederhergestellt statt
  gestrichen. Preis: ein Element je Taste.
- **W13** (R-T6b) Tastenkürzel beim Laden: Die Kürzel wirken wieder schon, solange „Lädt…“ steht. `usePrompterHotkeys()`
  sitzt dafür in der immer eingehängten Wurzel-View `PrompterOberflaeche.tsx` vor der Lade-Bedingung, wie im alten
  `OperatorView`; der Wächter „PR Hotkeys bleiben“ zog mit. Grund: So war es vor dem Umbau. Preis: eine Zeile.
- **W14** (Task 6, beim Bau angenommen, nicht vom Owner) Abhaken der Prompter-Liste: Angenommen wurden der Ort-Haken
  für Zeile 5 und 101 (der alte Tastenhinweis im Kopf ist jetzt Kürzel auf den Tasten und ein Hinweis unter dem Tempo), für Zeile 26 der gemeinsame Text
  „Automatisch (Hauptmonitor)“ statt „Primärer Bildschirm“ (R5, alter Wortlaut als EN8 unter „Entfällt“) und der
  zusätzliche Ort „Rahmen“ im Ortsregister. Grund: Der Haken beschreibt den neuen Aufbau richtig. Ein Preis ist nicht
  festgehalten.

## Stage Display

- **W15** (Task 9) Quellen in der Statusleiste: Die Einträge „JM Timer“, „JM Switcher“ und „JM Presenter“ übernehmen Text
  und Zustand aus der Zeile des Abschnitts „Gegenstellen“. Eine eingeschaltete, nicht verbundene Quelle heißt „nicht
  gefunden“ (gemeinsamer Text); ein eigenes „getrennt“ gibt es nicht mehr. Grund: eine Wahrheit für Panel und Statusleiste
  (Architektur Welle 1, R5). Preis: ein eigener Text weniger.
- **W16** (Task 9, beim Bau angenommen, nicht vom Owner) Eintrag „Nachricht“: Er liest, was die Bühne wirklich zeigt
  (`buehnenNachricht`), also auch eine Nachricht des Timers. Die einzige Haupttaste hat kein Rollenfeld (siehe W20). Grund: Der Eintrag soll wiedergeben, was
  auf dem Schirm steht. Ein Preis ist nicht festgehalten.
- **W17** (Task 10) Host und Port: Der gemeinsame Abschnitt „Gegenstellen“ übernimmt Host und Port mit dem Knopf „Setzen“
  (`packages/settings/src/abschnitte/PeersSection.tsx:64`), nicht bei Enter oder beim Verlassen des Feldes, wie E12 schreibt.
  E12 sagt zugleich, dass das Port-Feld aus dem Abschnitt kommt; der Abschnitt ist die Vorgabe. Die Funktionsliste führt
  Nr. 16 und 17 als „ersetzt durch Setzen (E12)“. Preis bei Irrtum: eine Nacharbeit im Baustein (Welle 2b, X1) oder in der App.
- **W18** (Task 10) Ladezustand: Solange der Hauptprozess nicht geantwortet hat, stehen Kopf und Statusleiste schon da, im
  Inhalt „Lädt…“ (Nr. 3). Grund: Der Rahmen steht wie beim Prompter vor der Lade-Bedingung. Preis bei Irrtum: eine kleine
  Rückänderung.
- **W19** (Task 10) Presenter-Kopplung nur mit Quelle: PIN-Feld, PIN-Hinweis, der Umschalter „Anzeige“ und der
  Folien-Hinweis (Nr. 28 bis 31) stehen wie bisher nur bei eingeschalteter Presenter-Quelle. Grund: Sie immer zu zeigen,
  wäre eine Verhaltensänderung außerhalb der erlaubten Liste (die Bedienlogik bleibt). Preis: eine Nacharbeitsrunde.
- **W20** (Task 10) Kein fester Schlüssel für die Haupttaste: R10 (fester React-Schlüssel je Rolle) entfällt für die
  einzige Haupttaste „Bühnenschirm“. Grund: Ein einzelnes Element außerhalb einer Liste wird nicht neu eingehängt; der
  Schlüssel hätte keine Wirkung. Preis bei Irrtum: ein key-Attribut.

## Player

- **W21** (P1) Bündelung des Ausgabefensters: `@jm/output-window` steht in `internalPackages` von
  `apps/player/electron.vite.config.ts`, wie beim Prompter (`apps/prompter/electron.vite.config.ts:14`). Grund: Sonst lädt
  der gebaute Hauptprozess zur Laufzeit TypeScript-Quelltext. Preis bei Irrtum: ein etwas größeres Bündel.
- **W22** (Task 13) Zweites Ausgabefenster: Dass nach schnellem Schließen und Öffnen ein zweites Ausgabefenster möglich ist
  (unbedingtes `outputWindow = null` in `closeOutputWindow` und im `closed`-Hörer), bleibt, weil die Bedienlogik bleibt. Es
  ist ein Altfehler und dem Owner gemeldet. Geändert ist nur die Meldung: Der Zustand folgt den Fenstern, die wirklich
  leben. Preis bei Irrtum: wie heute ein zweites Ausgabefenster nach schnellem Schließen und Öffnen.
- **W23** (Task 14) Pause-Merker: `showPaused` wird wahr gehalten. Stop hebt die Pause auf (wie Panik schon), ebenso der
  Start eines Cues, auch nach Ablauf seines Vorlaufs. Grund: Bisher blieb der Merker nach Stop in der Pause bzw. beim Start
  in der Pause stehen, während Ton lief (Funktionsliste Befund 11, Nr. 98/99); ON AIR baut auf dem Merker auf und zeigte
  sonst „aus“, während Ton läuft. Ton und Video verhalten sich wie bisher; sichtbar ändern sich nur die Beschriftung
  Pause/Weiter und Companion `paused` in diesen zwei Fällen (Funktionsliste, Changelog CL-PL4). Ob es so bleibt, ist offen:
  Die Texttabelle fragt den Owner danach (Offene Frage 2, „so behalten“ oder „zurücknehmen“). Preis bei Irrtum: zwei Zeilen
  Rückbau.
- **W24** (Task 14) Video zählt nicht über die Cue-Liste: ON AIR und der Eintrag „Cue-Show“ zählen aus `playingCueIds` nur
  Cues, die kein Video sind; ein Video zählt nur über `videoCue` und `videoProgress`. `playingCueIds` selbst bleibt für
  Companion. Grund: Sonst hielte eine liegengebliebene Video-ID (GO auf ein Video, während ein Video läuft) ON AIR und
  „1 laufend“ an, obwohl nichts läuft. Eine Audio-ID nach frühem Rücksprung von `showAudio.play` bleibt ein Rest-Fehlalarm in
  Richtung „an“, also auf der sicheren Seite. Preis bei Irrtum: eine Zeile.
- **W25** (Task 14) Video-Start in der Pause: W23 gilt auch beim Start eines Video-Cues in der Pause. Grund: Sonst zeigte
  ON AIR „aus“, während das Video läuft, und das ist die gefährliche Richtung. Dass angehaltene Ton-Cues danach erst über
  Pause und Weiter zurückkommen, ist ein Randfall. Preis bei Irrtum: die Einschränkung auf Ton-Starts.
- **W26** (Task 14) Show wählen stoppt keine Pads: Show wählen und Show löschen räumen die laufende Show wie bisher, stoppen
  aber keine Pads; nur die Panik-Taste und Companion `panic` stoppen die Pads. Grund: W2-10 meint die Panik-Taste; Pads beim
  Öffnen einer Show zu stoppen, wäre eine neue, nicht verlangte Wirkung. Preis bei Irrtum: zwei Zeilen und ein Test.
- **W27** (Task 14) ON AIR und Ausklingen: ON AIR folgt dem Zustand der Show; das Ausklingen nach Stop (Fade-Out plus 60 ms
  Ton, Ausblendung des Videos) zählt nicht. Das steht als Ausnahme in der Funktionsliste und ist ein Abnahmepunkt. Grund:
  Das Ausklingen zu messen, bräuchte eine neue Meldung aus `showAudio` und dem Ausgabefenster außerhalb der erlaubten Liste;
  Stop heißt „das Programm geht raus“. Preis bei Irrtum: eine Meldung aus `showAudio` (wie bei der `cueEngine`) in einer
  Folgewelle.
- **W28** (Task 14) Panik zuerst an die Pads: `showPanic` ruft `cueEngine.stopAll()` als Erstes. Grund: Die Pads laufen in
  einer eigenen Maschine; ein werfender Hörer oder Befehl der Show darf sie nicht weiterlaufen lassen. Die Reihenfolge war
  nicht vorgegeben und liegt innerhalb von W2-10. Preis: nichts.
- **W29** (Task 14) Ladendes Pad: Ein Pad, das noch lädt, wird von `stopAll` verworfen (Generationszähler in der
  `cueEngine`). Grund: W2-10 verspricht „Panik stoppt Pads“; sonst startete ein Companion-Pad nach der Panik. Das wirkt auch
  für „■ Alle stoppen“, was dessen Wortlaut entspricht. Preis bei Irrtum: der Zähler.
- **W30** (Task 15) Escape in Dialogen: Escape schließt die drei Dialoge („Cue bearbeiten“, „Cues hinzufügen“, „Pad ‹n›
  belegen“; `Modal` aus `@jm/ui`, E14) und verwirft dabei die Eingaben, auch im Feld „Hotkey“ des Pad-Dialogs, wo Escape früher
  nichts tat. Grund: Das ist das Verhalten des gemeinsamen Dialogs. Es ist ein Abnahmepunkt. Preis bei Irrtum: eine
  Tastenausnahme im Pad-Feld.
- **W31** (Task 15) Pad-Tasten bei offenem Dialog: Pad-Tasten lösen bei offenem Pad-Dialog nichts aus, solange der Fokus in
  einem Feld steht (Feldschutz aus Task 14, Nr. 134). Grund: gewollte Folge des Feldschutzes. Preis: nichts.
- **W32** (Task 15, abgelöst durch W33) „Automatisch (Hauptmonitor)“ öffnete auf dem primären Bildschirm und merkte dessen
  Kennung, weil der Store kein Zurücksetzen auf „kein Bildschirm“ kannte; die Auswahl zeigte danach den Namen. Preis bei
  Irrtum: ein Store-Setter für null.
- **W33** (Task 15) Bildschirmwahl merkt nur: Wie bei Prompter und Stage Display speichert die Bildschirmwahl nur (neuer,
  rein zusätzlicher Store-Setter für `outputDisplayId`, Zahl oder null). Der Schalter „Ausgabe“ öffnet auf dem gewählten
  Bildschirm; ist das Fenster offen oder fehlt sein Bildschirm, zieht der Knopf „Auf diesen Bildschirm“ es um; „Automatisch
  (Hauptmonitor)“ merkt null. Grund: Tastatur auf der fokussierten Auswahl (Pfeile, Buchstabensuche, etwa die Pad-Taste „B“)
  verschob sonst das laufende Ausgabefenster und nahm ihm den Fokus. Der Grundsatz der Suite, dass eine Wahl keine Bewegung
  ist, geht der Planzeile „Tipp öffnet sofort“ vor, weil aus den Bildschirmkarten eine Auswahlliste wurde. Preis: ein Klick
  mehr als bisher; bei Irrtum zurück auf sofortiges Öffnen und Abgabe des Fokus.
- **W34** (Task 15) Vollbild nur nach Messung: Beim Öffnen des Panels wird das Vollbild neu gelesen; der Schalter „Vollbild“
  schaltet nur, wenn der gemessene Wert abweicht. Grund: Sonst kehrte ein veralteter Schalter die Wirkung auf der
  Programmausgabe um. Ein Vollbildwechsel ohne Meldung (F11, Übergang auf dem Mac) bei offenem Panel kann einen Klick noch
  umkehren; das ist ein Abnahmepunkt. Preis: eine Abfrage.
- **W35** (Task 16) Reihenfolge im Transport: wie bisher „❚❚ Pause“ bzw. „▶ Weiter“, „■ Stop“, „⛔ Panik“, GO ganz rechts
  (alt `ShowView.tsx:188-209` bei `d7cdd79ce0`). Grund: Die Folge GO, Pause, Stop, Panik setzte Panik auf den Platz, an dem
  die Hand bisher GO fand; die Gefahr wäre Panik statt GO. Stop vor Panik bleibt auch in der Fußleiste. Preis: nichts.
- **W36** (Task 16) Plätze der Fußleiste: Stop und Panik stehen in der Fußleiste in den Spalten 2 und 3, an denselben
  Plätzen wie im Transport; Spalte 4 bleibt leer. Grund: Sonst läge Panik der Fußleiste beim Reiterwechsel genau auf dem
  GO-Platz der Cue-Show. Preis: eine Klasse.

## Recorder

- **W37** (P3) Meldung mit „OK“: Eine Meldung des Hauptprozesses steht im Live-Bereich mit einem Knopf „OK“, der sie
  quittiert; ein Test prüft das. Grund: Ohne diese Festlegung war die Quittung zwischen der Ableitung (Task 20) und der
  Darstellung (Task 21) nicht verbunden. Preis: ein Test mehr.
- **W38** (Task 20) Nur der gemessene Aufnahmezustand: Die Oberfläche hält den gemessenen Zustand des Hauptprozesses
  getrennt (`zustand`); Aufnahme, Zeitplan, ON AIR und die Haupttasten lesen nur ihn. Ohne ihn sind sie „unbekannt“ bzw.
  gesperrt mit dem Grund „Aufnahmezustand wird abgefragt…“. Gefüllt wird er einmal beim Einhängen über `jmrec.getState()`
  und danach über `onState`; der Store bleibt. Grund: Vorher lasen diese Stellen den Vorgabewert IDLE des Stores als
  Antwort; nach einem Neuladen des Fensters während einer Aufnahme stand dort „keine Aufnahme“. Preis: eine Abfrage beim
  Start.
- **W39** (Task 21) Tastenfolge: „Aufnahme“ bzw. „Stopp“ links, „Eingang öffnen“ bzw. „Eingang schließen“ rechts. Das
  entspricht dem bisherigen Bild bei offenem Eingang und während der Aufnahme (alt `RecorderView.tsx:146-176`); „Eingang
  schließen“, das auch eine Aufnahme beendet, liegt nie auf dem Platz von „Stopp“. Preis: Bei geschlossenem Eingang wandert
  „Eingang öffnen“ nach rechts; bei Irrtum ein Tausch.
- **W40** (Task 21) Kanäle und Samplerate: Beide sind `NumberInput` aus `@jm/ui`. Übernommen wird bei Enter oder beim
  Verlassen des Feldes, die Pfeiltasten ändern nichts, das Gerätemaximum gilt auch für getippte Werte, und ein ungültiger Wert
  nennt einen Fehler, statt still begrenzt zu werden; wie R21, R26 und E12. Die Funktionsliste führt Nr. 116 und 117 als
  Änderung. Preis bei Irrtum: ein eigener Feldbaustein.
- **W41** (Task 21) Platz des kurzen Hinweises: Der Toast steht oben mittig unter dem Kopf über der Preset-Leiste, die nicht
  live-kritisch ist, und nie über Tasten, Uhr, Marke, Pegel oder Statusleiste; das ist gemessen. Grund: Unten mittig
  überdeckte er bei 920 × 620 die einzige sichtbare Pegelzeile, genau bei „Aufnahme läuft als …“ und „Geplante Aufnahme
  gestartet“. Preis: eine Positionsänderung.
- **W42** (Task 21) Aufnahme-Taste bei geschlossenem Eingang: Sie ist gesperrt und nennt den Grund „Erst den Eingang öffnen“
  (Wortlaut der alten Meldung). Companion RECORD geht weiter über den Store (Nr. 80). Grund: Die Taste konnte dort nie
  gelingen (der Hauptprozess lehnt ab), und ohne Zielordner öffnete sie vorher den Ordnerdialog; früher gab es dort keine
  Aufnahme-Taste. Preis bei Irrtum: eine Zeile.
- **W43** (Task 21) Pegel vor Hinweisen: Die Pegel haben Vorrang vor dem Hinweisband. Hinweise schrumpfen zuerst bis auf ein
  Band, eine Meldung mit „OK“ bleibt sichtbar. Grund: Die Pegel sind das Live-Element. Preis: eine Schrumpf-Regel.
- **W44** (Task 21) Der Toast scrollt mit: Er ist über der Preset-Leiste verankert und scrollt mit dem Inhalt, weder
  klebend noch fest. Grund: Klebend deckte er bei gescrolltem Inhalt Tasten, Uhr und Marke bzw. die Meldung mit „OK“ und
  schluckte 5 s lang Klicks. Preis: Ein Hinweis ist nicht zu sehen, solange der Inhalt gescrollt ist; er bleibt wie bisher
  nur 5 s.
- **W45** (Task 22) Zwei Aussagen der Recorder-Liste: Zwei kleinere Befunde wurden hochgestuft und behoben. Der Kopfsatz
  „Haken nennen jede geänderte Datei“ war falsch, und Nr. 17, 19, 116 und 117 nannten nicht, dass die alte Begrenzung
  abrundete und das Zahlenfeld jetzt „Bitte eine ganze Zahl eingeben.“ meldet. Grund: eine falsche Aussage bzw. eine
  verdeckte Verhaltensänderung in der Liste, die Grundlage der Abnahme ist. Preis: zwei Sätze.

## Caption

- **W46** (Task 24) Zwei Folgen von E8 für Companion: Endet der NDI-Sender, steht `connections` auf 0, und eine späte
  Meldung eines alten Sender-Prozesses setzt `connections` nicht mehr. Beide gelten als Folgen von E8 (Funktionsliste Nr. 82,
  83 und 95, Texttabelle). Grund: Beide machen den Wert wahrer. Preis: nichts.
- **W47** (Task 25 und 26) Mikrofonfehler bleibt stehen: `micError` bleibt wie bisher bis zum nächsten erfolgreichen Start
  stehen (`App.tsx:112-114`), auch nach Stopp oder Gerätewechsel. Grund: Die Bedienlogik bleibt; es ist ein Altfehler der
  Caption-Liste. Preis bei Irrtum: ein Zurücksetzen beim Stopp.
- **W48** (Task 26, abgelöst durch W51) Raster mit getauschter unterer Reihe: oben Start/Stopp und Hold, unten links NDI,
  unten rechts Leeren. Grund: Eine Reihe aus vier Tasten passt bei 900 px mit Panel nicht, und mit der ersten Belegung hätte
  die Hand am alten NDI-Platz „Leeren“ getroffen. Preis: ein Tausch.
- **W49** (Task 26) Tasten über der Live-Zeile: wie bisher. Grund: Die Live-Zeile wächst bis auf 8 Zeilen und würde Tasten
  darunter verschieben. Das weicht vom Muster „Live-Element zuerst“ ab. Preis: nichts.
- **W50** (Task 26) Quellname, Wahlen und zweiter Schalter: Der NDI-Quellname gilt nach Enter oder beim Verlassen des
  Feldes, ohne Leerzeichen am Rand (gemeinsamer Abschnitt „NDI-Ausgabe“, wie E12 und R21). Gerät, Modell, Engine, Auflösung
  und Bildrate wirken wie bisher sofort (die Bedienlogik bleibt). Der Abschnitt „NDI-Ausgabe“ hat einen Schalter „Ausgabe“
  als zweiten Weg, wie der Ausgabeschalter des Players. Alle drei Punkte sind Abnahmepunkte. Ein Preis ist nicht
  festgehalten.
- **W51** (Task 26, ersetzt W48) Tastenplätze: NDI liegt oben links auf seinem alten Platz, rechts daneben Start/Stopp,
  darunter Hold und Leeren. Auf den alten Plätzen von Start, Hold und Leeren (Kopfzeile oben rechts) liegen jetzt ON AIR,
  Hell/Dunkel und ⚙, die nichts beenden oder leeren. Maßstab ist die Standardgröße 1100 × 780. Bei 900 px brach die alte
  Kopfzeile um; dort zählt nur, dass soweit messbar keine zerstörende Taste (Stopp, Leeren, NDI aus) auf dem alten Platz
  einer anderen liegt, und das ist ein Abnahmepunkt beim Owner. Grund: Mit W48 lag bei 1100 × 780 die neue Start/Stopp-Taste
  fast deckungsgleich auf dem alten NDI-Knopf; die Hand zum NDI hätte Stopp getroffen und die Erkennung beendet. Preis: ein
  Tausch.
- **W52** (Task 26) Dunkles Schachbrett: Das Schachbrett hinter der NDI-Vorschau bleibt in Hell und Dunkel dunkel wie
  bisher (`#2a2a2a` und `#1c1c1c` als nur dunkle Tokens). Grund: Sonst stünde bei ausgeschaltetem Band weiße Schrift auf
  fast weißem Grund; die Vorschau ist die Live-Kontrolle. Preis: zwei Tokens.

## Interpreter

- **W53** (Task 30) Taste vor der ersten Antwort: Die Haupttaste ist gesperrt mit „Lädt …“, bis die Engine zum ersten Mal
  antwortet; das ist neu und dauert einen Bildaufbau, wie bei Caption. Die Kabel-Erkennung bleibt bei der Kabel-Karte und
  nicht im Eintrag „Ausgabegerät“. Preis: nichts.
- **W54** (Task 31) Platz der Haupttaste: oben rechts in derselben Spalte, 37 px tiefer und breiter. Auf dem alten Platz
  liegt bei 900 px ein Teil des Hell/Dunkel-Schalters, der nur die Darstellung ändert, nie den Mix. Preis: nichts.
- **W55** (Task 31) Keine leere Wahl: „– bitte wählen –“ ist nach einer Wahl nicht mehr wählbar (gemeinsamer Abschnitt
  „Audiogerät“, Pflichtwahl). Grund: Der Mix braucht beide Eingänge; das Leeren hatte keine eigene Wirkung außer Befund 2
  (gesperrte Stopp-Taste im Betrieb), dessen Weg über die Oberfläche damit entfällt. Funktionsliste Nr. 8, 9 und 80 sowie
  die Texttabelle (EN33) nennen es. Preis bei Irrtum: eine Leer-Option im Abschnitt.
- **W56** (Task 31) Gestartetes Gerät: Floor und Dolmetscher zeigen wie „Ausgabegerät“ im Betrieb das Gerät, mit dem
  gestartet wurde. Weicht die Einstellung ab, steht der Eintrag auf Warnung mit „Wirkt erst nach Stopp und erneutem Start.“;
  den Pegel im Panel zeigt nur die Wahl, die dem gestarteten Gerät entspricht. Dafür merkt sich nur der Renderer die an
  `engine.start` übergebenen Geräte; die Bedienlogik bleibt. Grund: Vorher zeigte die Statusleiste im Betrieb die
  Einstellung grün als Gerät, obwohl die Engine die Eingänge nur beim Start liest; der Pegel unter einer geänderten Wahl
  gehörte noch zum alten Gerät. Preis: ein Merker.

## Gesamtprüfung (Fix-Welle)

Die Gesamtprüfung des ganzen Branches fand drei wichtige Punkte (I1 bis I3) und einige kleine (M1 bis M7). Die folgenden
Entscheidungen gelten für die Fix-Welle danach.

- **W57** (Gesamtprüfung I1, nachgeschärft durch W62) Tastenplätze des Prompters: wieder die alte Anordnung. Oben liegen
  „⏮ Marke“, GO (breit) und „Marke ⏭“, unten „↑ zurück“, „⟲ Anfang“ und „↓ vor“; alle sechs sind TallyButtons. „Anfang“ (an
  den Anfang und pausieren) liegt nie neben GO. Grund: Mit dem Umbau lag „Anfang“ dort, wo die Hand GO und „Marke ⏭“ sucht;
  ein Klick hätte den Text des Talents an den Anfang gesetzt und angehalten. Die Regel „Tastenplätze wie heute“ entstand erst
  in Task 16 und wird hier nachträglich angewandt. Preis: Muster d erlaubt höchstens vier TallyButtons, hier sind es sechs.
- **W58** (Gesamtprüfung I2) ON AIR im Player: Ein Video-Cue zählt für ON AIR und „‹n› laufend“ nur, solange der gemessene
  Ausgabezustand offen ist oder der Bildschirm fehlt. Zu (auch nach Alt+F4), abgestürzt und unbekannt zählen nicht; Ton und
  Pads bleiben, wie sie sind. Geändert ist nur der Renderer, der Store bleibt. Grund: Nur der Knopf leert den Video-Cue im
  Store; nach Alt+F4 oder einem Absturz blieb ON AIR an, und die Statusleiste widersprach der Lampe. Companion meldet den
  Cue wie bisher weiter als spielend. Preis: nichts.
- **W59** (Gesamtprüfung I3) Gemessener Bildschirm im Panel: `@jm/settings` bleibt unverändert, die Arbeit am Baustein gehört
  zu Welle 2b (X1). Prompter, Stage Display und Player lesen die Bildschirmliste bei jeder Änderung des Ausgabezustands neu.
  Der Abschnitt „Ausgabe auf Bildschirm“ hat keinen Prop für den gemessenen Ort. Deshalb steht darunter eine eigene Zeile mit
  dem gemessenen Ort, solange das Fenster da ist, in den Worten der Statusleiste („Talent-Monitor: offen · ‹Bildschirm›“,
  „Bühnenschirm: …“, „Video-Ausgabe: …“). Es gibt dafür keinen neuen Text. Die Pille des Abschnitts nennt weiter den
  gewählten Bildschirm; das ist ein Abnahmepunkt (G7) und ein Auftrag für Welle 2b. Grund: Eine Wahl verschiebt nichts
  (W33), die Pille nannte also einen Ort, den niemand gemessen hat. Preis: eine Zeile.
- **W60** (Gesamtprüfung, kleine Punkte) In derselben Fix-Welle:
  - M1: Startfehler der vier Steuerserver (Prompter, Player, Recorder, Caption) kommen zusätzlich ins Protokoll, wie beim
    Timer; den Teil mit ok:false ergänzt W62.
  - M2: Der Prompter holt seine Bildschirmliste wie Stage Display und Player: beim Start, bei jedem Öffnen des Panels und bei
    jeder Änderung des Ausgabezustands; ein Fehler macht sie unbekannt.
  - M6: Der Interpreter zeigt „Ducking“ im Stillstand grau statt grün, der Text bleibt; mit Überbrücken weiter „überbrückt“.
  - M7: veraltete Kommentare im Player.
  - Dazu kommt der fehlende Wächter für den Weg Stille → Status → Renderer in Caption.

  Grund: Das ist billig und war die Empfehlung der Gesamtprüfung; ein Wurf beim Start stand seit 2a nur noch in der
  Statusleiste und war nach der Show nicht mehr nachlesbar. Preis: nichts.
- **W61** (Gesamtprüfung, nicht beurteilt) Die zwölf Punkte, die die Gesamtprüfung nicht beurteilt hat, bleiben wie entschieden
  bzw. als Owner-Frage oder Abnahmepunkt:
  - Panik in der Bibliothek stoppt die Vorschau nicht (Owner-Frage 1).
  - Die Wahlen in Caption wirken sofort (W50).
  - Ein zweites Ausgabefenster im Player ist ein Altfehler.
  - Escape außerhalb des Panels gehört zum gemeinsamen `@jm/ui`.
  - Die Leertaste auf Knöpfen löst wie entschieden aus (O1).
  - Der Ausklang nach Stop zählt nicht für ON AIR (W27).
  - Die Suche im Netz ersetzt beim Stage Display einen Host (Altfehler, Owner-Frage 3).
  - ARM und „Eingang schließen“ im Recorder sind Altfehler (U6).
  - `micError` in Caption ist Abnahmepunkt CAZ2.
  - Der Render-Takt ohne Fehlergrenze ist ein altes Muster.
  - Hell-Modus, Mac und das echte Fenster prüft die Abnahme.
  - Die Handbücher wurden nur stichprobenhaft geprüft.

  Grund: Jeder Punkt ist schon entschieden, liegt beim Owner, gehört zu einem gemeinsamen Baustein oder ist ein Altfehler,
  den die Welle nach U6 nicht ändert. Preis: nichts.
- **W62** (Gesamtprüfung I1, nachgeschärft; ersetzt die Rasterbreiten aus W57) GO und Anfang liegen je über zwei Spalten eines
  Rasters mit vier Spalten. Oben: „⏮ Marke“ | GO über zwei Spalten | „Marke ⏭“. Unten: „↑ zurück“ | „Anfang“ über zwei
  Spalten | „↓ vor“. „Anfang“ bleibt genau unter GO wie früher. Im selben Zug protokolliert M1 wie der Timer auch einen
  Start mit ok:false (z. B. Port belegt), und dieses Dokument nimmt die Entscheidungen der Gesamtprüfung als W57 bis W62 auf.
  Grund: Im Raster mit drei Spalten passte der Inhalt von GO im Betrieb nicht in seinen Platz; zu lesen war nur
  „VE Pause Leerta…“. Gemessen nach dem Umbau: GO ist über zwei Spalten 175 px breit, in der Mindestgröße 162 px. Der Inhalt
  braucht im Betrieb („LIVE“, „Pause“ und „Leertaste“ in 19 px) aber 268 px, GO blieb also im Betrieb abgeschnitten; gelöst
  ist das mit W63. „Anfang“ ist breiter als früher und reicht bis an den inneren Rand der alten Plätze von „↑ zurück“ und
  „↓ vor“ (Abnahme PRZ4). Preis: eine Nachmessung.
- **W63** (Gesamtprüfung, letzte Änderung der Fix-Welle) Kürzel-Hinweis an GO nur in Ruhe: GO zeigt „Leertaste“ nur, solange der
  Text steht; im Lauf zeigt die Taste nur „LIVE“ (bei offenem Monitor) und „Pause“. Die Leertaste wirkt weiter, und der Satz
  unter dem Tempo nennt sie; „Pos1“ an „Anfang“ bleibt. `@jm/ui` bleibt unverändert. Grund: Mit dem Hinweis passte der Inhalt von
  GO im Betrieb auch mit W62 nicht in seinen Platz. Gemessen danach: Der Inhalt im Lauf ist 125 px breit; GO ist 175 px breit,
  in der Mindestgröße 162 px, und hat dort innen gerade 1 px Luft. In beiden Größen wird nichts mehr abgeschnitten. Preis: der
  sichtbare Kürzel-Hinweis an GO während des Laufs (Abnahmepunkt PRZ4).

## Welle 2b

Bei der Umsetzung von Welle 2b (Presenter, Studio-Control, Connect und der Nachzug für Prompter, Stage Display und Player;
Plan `docs/superpowers/plans/2026-11-23-ux-welle2b.md`, Spec `docs/superpowers/specs/2026-11-22-ux-welle2-design.md`) fielen
diese Entscheidungen. Die Festlegungen B1 bis B22 stehen im Plan, E15 und E16 aus 2a gelten weiter. Die Funktionslisten
(`docs/ux/funktionslisten/{presenter,studio-control,connect,prompter,stage-display,player}.md`) und die Texttabelle
(`docs/ux/welle2b-texte.md`) nennen die Entscheidungen als „Ruling Task ‹n›“ oder „(Ruling)“; die Klammer hinter jeder Nummer
nennt den Task. Zwei Owner-Entscheide tragen mehrere Einträge: am 23.11. 13:31 „alles mit deiner empfehlung“ (B10, B11, B13,
B18, das Referent-Panel ohne Ausgabe, die Planübersicht vom 23.11. 13:15) und am 24.11. 16:09 „f1-3 und z1 mit deiner
empfehlumg“ (Connect F1 A, F2 B bei 1280 × 860 und A bei 980 × 640 und für die Kacheln, F3 A, Z1 A). Offen sind die
Owner-Fragen P1 und P2 (Texttabelle, „Offene Fragen“). Jede Entscheidung gilt, bis der Owner sie ändert; zu jeder stehen der
Grund und der Preis, falls sie sich als falsch erweist.

### Vorbereitung

- **W64** (Vorbereitung) Das Arbeitsprotokoll der Welle trägt einen anderen Dateinamen als im Plan genannt. Grund: Der Name
  hat keine Wirkung auf den Inhalt. Preis: nichts.
- **W65** (Vorab-Prüfung) Alle 35 Befunde der Vorab-Prüfung des Plans wurden vor Task 1 in den Plan eingearbeitet, in einem
  eigenen Commit. Grund: Jeder Befund hätte einen frischen Bauenden getroffen (Vite-Import in den Presenter-Tests, das
  Prüfskript aus 2a, ein roter Token-Test, ein zu früher Wächter, ein fehlendes Skript für die Typprüfung) oder wich von der
  Spec ab (macOS in einer Spalte, Panel ohne Effekte). Preis: die Zeit der Planänderung; ein falscher Vorschlag zeigt sich in
  der Prüfung des Tasks.
- **W66** (Vorab-Prüfung, Befund 10) Der PTZ-Halte-Knopf behält 48 px Höhe über eine Klasse; Tooltip und Name für
  Screenreader sind die heutige Beschriftung, aktiv heißt gehalten. Grund: die Trefferfläche im Live-Betrieb. Preis: nichts,
  falls 32 px gereicht hätten.
- **W67** (Vorab-Prüfung, Befund 19) Der Owner-Block des Plans nennt auch die Bestätigung der Planübersicht vom 23.11. 13:15:
  der Nachzug direkt nach den Bausteinen und die Tastenfolge Schwarz · Zurück · Gehe zu · Weiter · Weiß im Referenten. Die
  Texttabelle nennt die Folge unter „Geänderte Bedienung“ als Abweichung von W2-3. Grund: Der Owner hat beides mit „alles mit
  deiner empfehlung“ bestätigt. Preis: eine Rückfrage, falls er die Folge anders verstanden hat.

### Bausteine

- **W68** (Task 2) Vor der Prüfung lief die Galerie-Prüfung nach, und das neue Maß `--tally-h-kuerzel` steht wie jedes neue
  Token im Paket eingetragen (Liste der neuen Tokens, Größen-Kachel der Galerie). Grund: Der Auftrag verlangt die ganze
  Prüfkette; ein nicht eingetragenes Token fiele sonst erst im Build auf. Preis: eine Runde beim Bau.
- **W69** (Task 2, festgelegt durch die Messung in Task 4) `--tally-h-kuerzel` startete mit geschätzten 72 px; Task 4 maß am
  echten Prompter-Knopf und durfte das Maß korrigieren. Gemessen: gesperrt mit 72 px brauchte die Taste 89 px, das Maß steht
  jetzt bei 90 px, alle sechs Prompter-Tasten sind in Ruhe, im Lauf und gesperrt 90 px hoch. Grund: Messung am echten Knopf
  statt Schätzung. Preis: eine Korrektur in `@jm/ui` während Task 4.

### Nachzug und Ablauf

- **W70** (Task 4, nimmt W63 zurück) Der Überlauf der rechten Spalte des Prompters in der Mindestgröße 940 × 620 ist
  angenommen: 53 px statt bisher 2 px. Vorschau, Tastenraster und Tempo-Regler bleiben ohne Scrollen sichtbar, nur der Satz
  unter dem Tempo braucht Scrollen. GO trägt „Leertaste“ damit wieder in jedem Zustand, auch im Lauf. Grund: Der sichtbare
  Tastenhinweis wiegt schwerer als der Satz. Preis: zurück auf W63, falls der Owner es anders sieht; der Satz ist der einzige
  Ort, der die Pfeiltasten nennt (Geänderte Bedienung, Abnahmepunkt).
- **W71** (Task 4) Die Zeilen der Funktionslisten zum Nachzug (Prompter Nr. 26, 68 und 92, bei Stage Display und Player die
  entsprechenden) verweisen auf den Plan-Block „2a-Nachzug (Task 4–6)“ bzw. auf die Regel „lesendes Bildschirm-Ereignis“,
  nicht auf ein B. Grund: B1 bis B22 enthalten dafür keine Festlegung; der Plan verlangte den B-Verweis irrtümlich. Preis:
  nichts.
- **W72** (Task 4) Jeder Task, der die Kürzelzeile des TallyButton nutzt (laut Plan auch Task 18 und 23), misst die 90 px am
  echten Fenster nach. Grund: Ein zweizeiliger Sperrgrund sprengt sie; die Reserve ist 0,8 px bei Skalierung 1,26. Preis: eine
  Messung je Task.
- **W73** (Ablauf, ab Task 6) Ein Auftrag enthält nur die Festlegungen seiner App: Zog er den App-Block mit, der im Plan
  zwischen dem letzten Task eines Blocks und dem ersten des nächsten steht (Task 6 den Presenter-Block, Task 12 den von
  Studio-Control, Task 19 den von Connect), wurde er vor der Kopfzeile des nächsten Blocks gekürzt. Grund: Sonst bekäme der
  Bauende fremde Festlegungen. Preis: nichts.
- **W74** (Task 6) Zwei Lücken im Video-Beleg für ON AIR im Player wurden vor der Prüfung geschlossen, soweit es ohne
  Hauptprozess, Store und IPC ging: Fortschritt belegt ein Video nur bei gemessen offener Ausgabe, und der Beleg fällt beim
  Wechsel einer vorhandenen Fensterkennung zurück. Grund: Genau das ist der Fehler hinter CL-PL2, den der Task beheben soll.
  Preis: eine Runde beim Bau.
- **W75** (Task 6) Ein Restfall bleibt offen: Kommt die Position des alten Fensters erst nach dem Wiederöffnen an, kann der
  Beleg kurz falsch stehen. Grund: Die Meldungen tragen keine Fensterkennung, der Hauptprozess darf in Task 6 nicht geändert
  werden, und das „zu“ kommt erst nach dem Ende des alten Renderers (die Prüfung hat das an der Laufzeit nachgesehen). Preis: ein
  kurz falscher ON-AIR-Beleg in einem Fall, der im Betrieb nicht auftritt.

### Presenter

- **W76** (Task 7) Die Tastenplatz-Regel im Referenten prüft gegen die Vereinigung der alten Rechtecke aller gemessenen
  Zustände derselben Fenstergröße; die Kopfknöpfe wanderten mit Schleifen-Countdown, NDI-Text und Gast-Klick-Pille. Grund: die
  strengere Lesart, keine folgenreiche Taste darf auf irgendeinem alten Platz einer anderen liegen. Preis: Konflikte, die nur
  aus zustandsabhängigen Breiten kommen, werden einzeln entschieden.
- **W77** (Task 9) Strg+W bzw. Cmd+W aus einem Textfeld von Referent oder Publikum wird abgefangen und tut nichts; außerhalb von
  Feldern schaltet es wie bisher Weiß. Grund: Mit dem Feldschutz aus B10 hätte sonst das Standardmenü das Fenster geschlossen
  und die laufende Präsentation beendet, ein neuer zerstörerischer Weg. Preis: Strg+W im Feld tut nichts (bisher: Weiß).
- **W78** (Task 9) Bei „Keiner – nur NDI“ zeigt die Pille nie einen Fehler. Sonst folgt der Statuseintrag „Publikum“ bei einer
  fehlenden Startwahl dem gemeinsamen Abschnitt „Ausgabe auf Bildschirm“ (eine Wahrheit), `@jm/settings` bleibt möglichst
  unverändert. Grund: Der Auftrag verlangt „bei nur NDI kein Fehler“ und Gleichheit von Pille und Statusleiste. Preis: nichts;
  sähe der Owner eine fehlende Startwahl im Ruhezustand lieber nicht in der Statusleiste, sagt er es bei der Freigabe der Texte.
- **W79** (Task 10) Die Tastenplatz-Regel gilt in der weiten Lesart aus 2a: Keine folgenreiche Taste liegt auf dem alten Platz
  irgendeiner anderen Taste, auch eines harmlosen Reiters. Die Plan-Formulierung „einer anderen folgenreichen Taste“ war zu
  eng. Grund: Ein Gewohnheitsklick auf den Reiter „Übergänge“ hätte sonst die Präsentation auf dem Beamer gestartet. Preis:
  weitere Auswertungen in Task 11, 18 und 24.
- **W80** (Task 10) Die Lage der Editor-Werkzeugleiste aus B14 bleibt. Der Konflikt ist vollständig ausgewertet (14 Konflikte,
  42 Treffer: „Präsentieren“ bzw. „Beenden“ auf dem alten Reiter „Übergänge“, NDI auf dem alten Reiter „Folie“) und steht als
  Owner-Frage P1 in der Texttabelle, mit der Alternative „Präsentieren und NDI oben rechts im Kopf wie früher“. Grund: B14 ist
  vom Owner bestätigt, die Alternative ändert den Rahmen. Preis: ein Umbau der Werkzeugleiste, falls der Owner die Alternative
  wählt.
- **W81** (Task 11, verschärft durch W83) Die 9 Tastenplatz-Konflikte des Referenten bei 1024 × 620 bleiben ungebaut und gehen
  als Owner-Frage P2 an den Owner; die schwersten: altes „Publikum Vollbild“ → neues „■ Beenden“, altes „■ Beenden“ → neue
  Schleife. Bei 1500 × 920 gibt es keinen Konflikt. Grund: wie W80; B7 und B12 sind Plan-Festlegungen, und die Begründung von
  B7 („Beenden auf dem alten Platz“) stimmt nur bei 1500. Preis: ein Umbau von Kopf und Leiste bei schmalem Fenster, falls der
  Owner es will.
- **W82** (Task 11) Der Erfassungs-Hörer `fensterSchliessenAbfangen` (nur `preventDefault` bei Strg+W bzw. Cmd+W, auch in
  Feldern des Panels) setzt W77 um. Gemessen: Vor der Korrektur schloss Strg+W aus einem Feld des Panels den Referenten; danach
  nicht mehr, und Weiß außerhalb von Feldern bleibt. Grund: im echten Fenster vorher und nachher belegt. Preis: nichts, wenn
  richtig; offen bleibt der Weg am Mac (Cmd+W über das Menü), den die Abnahme prüft.
- **W83** (Task 11, verschärft W81; der Zeitpunkt ist durch W128 und W133 geändert) Die Owner-Frage P2 nennt den Treffer altes
  „Publikum Vollbild“ → neues „■ Beenden“ ausdrücklich als Risiko „Show endet durch Fehlklick“, nicht nur als Tabellenzeile,
  und muss vor jedem Release beantwortet sein. Grund: Unter B7 ist der Treffer im 44 px hohen Kopf nicht vermeidbar; die
  Prüfung hat das nachgerechnet. Preis: ein Umbau von Kopf und Leiste bei schmalem Fenster, falls der Owner es will.
- **W84** (Task 12) Die Presenter-Liste erlaubt als Verweise B1 bis B22 sowie E15 und E16. Grund: Der Plan übernimmt E15 und
  E16 ausdrücklich („gelten auch hier, außer B9“). Preis: nichts.
- **W85** (Task 12) Die Spalte „heute wo“ bleibt beim Stand `481c998c08`; die heutigen Zeilen stehen im Haken. Grund: sonst
  zwei Stände in einer Spalte. Preis: nichts.
- **W86** (Task 12) Nr. 125/206 und 88/208 (das alte Verhalten) dürfen „abgeleitet“ bleiben. Grund: Der alte Hook ist
  identisch und am Knopf (Nr. 205) bzw. im Referenten (Task 11) gemessen. Preis: eine falsche Altbeschreibung ohne Folgen für
  die neue Bedienung.
- **W87** (Task 12) Netzwerkkarte und Port der Handy-Fernsteuerung wirken erst mit einem eigenen Knopf „Setzen“, wie Host und
  Port des JM Timers; nur im Renderer, derselbe Befehl. Die Schalter für Server und PIN-Schutz wirken weiter sofort. Grund:
  „Wahl ≠ Bewegung“ ist bindend; seit dem Panel wählt die Tastatur dort, und jede Wahl band den Handy-Server neu, ein
  verbundenes Handy fiel mitten in der Show. Preis: ein Klick mehr beim Einrichten (Geänderte Bedienung, Text „Setzen“).
- **W88** (Task 12) Der Prüfungs-Hinweis „PIN-Schutz aus lokalem Zustand, nie nachgeführt“ wurde zu einem wichtigen Befund und
  in derselben Runde behoben. Grund: gleiche Wirkung wie der wichtige Befund der Prüfung: Eine Änderung aus dem anderen Fenster
  würde still zurückgedreht, und der Neustart des Servers trennt die Handys. Preis: eine kleine Zusatzänderung.

### Studio-Control

- **W89** (Task 13) Die Zeile `@source` für `@jm/ui` in `globals.css` von Studio-Control kommt samt Wächter mit Task 15, wie im
  Plan; eine frühere Zuordnung zu Task 14 war falsch. Preis: nichts.
- **W90** (Task 14) Die Vorher-Messung legt Geräte mit Adressen aus TEST-NET-1 an (192.0.2.x, RFC 5737), damit kein echtes
  Gerät im Netz angesprochen wird. Port 7778 lauscht dabei auf allen Schnittstellen, mit dem Entwickler-Konto im
  Wegwerf-Profil; die Läufe bleiben kurz und werden sofort beendet. Grund: Ein echtes Gerät zu treffen, wäre ein Eingriff in
  einen laufenden Betrieb. Preis: nichts.
- **W91** (Task 14, erweitert durch W92) Fehlende alte Rechtecke (PTZ-Presets, Licht-Blackout mit Node, OBS mit Szenen,
  REC und STREAM aktiv) werden im echten Fenster nachgemessen, indem der Zustand im Renderer gesetzt wird; kein Netz, im
  Ergebnis als „simuliert“ markiert. Grund: Ein angelegter Licht-Node könnte sACN senden und eine echte Lichtanlage im Netz
  schwarz schalten. Preis: Abweichungen, falls echte Gerätemeldungen andere Lagen ergeben (Abnahme mit Gerät).
- **W92** (Task 14, erweitert W91) Die Zustände, die die Prüfung vermisste (Formulare, Discovery, Kreuzzustände wie verbunden
  × Formular offen), werden ebenso nachgemessen, nicht nur offengelegt. Grund: Die Tastenplatz-Prüfung in Task 18 baut auf der
  Vereinigung aller alten Plätze. Preis: ein weiterer Messlauf.
- **W93** (Task 14) Nr. 133 der Liste („nur lesen (*:read)“) ist korrigiert: Der Betrachter hat weder `users:read` noch
  `audit:read`. Grund: Die Sperrgründe in Task 17 bauen auf den Rollenzeilen. Preis: eine Zeile.
- **W94** (Task 15) Die Abfrage `studio:fernsteuerung` antwortet aus der im Hauptprozess gehaltenen letzten Meldung statt über
  `gatewayStatus()`, wie der Wortlaut von B2 sagt. Grund: `gatewayStatus()` kennt weder Modus noch Fehler; die Meldung kommt aus
  derselben Quelle (`onStatus`). Preis: nichts.
- **W95** (Task 16) Ein Gerät ohne Statusmeldung ist „unbekannt“, nie „nicht verbunden“: Die Sperre kennt drei Lagen
  (verbunden, nicht verbunden, noch keine Antwort), der Grund heißt dann „‹Gerät› unbekannt“ und steht nach dem Rollen-Grund;
  Statusleiste und Pille zeigen ohne jede Meldung „unbekannt“. Grund: „Nur Gemessenes“ geht der Plan-Signatur vor; die
  Erweiterung ist abwärtsverträglich. Preis: ein neuer Text (SC30).
- **W96** (Task 16) REC und STREAM des TriCasters behalten eine feste Beschriftung. Grund: Sie ändert sich heute nie; ohne
  Rückmeldung gibt es keinen Zustand, auf den B6 wechseln könnte, und der Hinweis „REC und STREAM ohne Rückmeldung“ trägt es.
  Preis: nichts.
- **W97** (Task 16) Der Mischfall aus B17 und die Stufen (Server getrennt als Fehler, Licht an als in Ordnung, Blackout als
  Warnung) gelten wie beim Bau festgelegt. Grund: Das passt zu den gemeinsamen Pillen und zu Spec 7; die Prüfung durfte
  widersprechen und hat es nicht getan. Ein Preis ist nicht festgehalten.
- **W98** (Task 17) ON AIR erscheint erst nach der Anmeldung. Grund: B15 hält den Anmelde-Rahmen leer (leere Statusleiste,
  kein ⚙), ON AIR gehört dazu. Preis: Wer die App mitten in einer Sendung neu startet, sieht ON AIR erst nach dem Anmelden
  (Geänderte Bedienung).
- **W99** (Task 17, umgesetzt in Task 18) Ohne verbundenen Server gilt kein Gerätezustand als gemessen: kein ON AIR, Pillen
  und Statusleiste „unbekannt“, Haupttasten gesperrt mit Grund. Grund: Sonst bliebe „LIVE“ stehen, während der Server
  „getrennt“ zeigt; unbekannt ist nie live. Preis: eine kleine Änderung der Ableitung.
- **W100** (Task 18) Ohne Server sind auch die normalen Knöpfe gesperrt (Busse, Szenen, Makros, Presets, Fader, Mute,
  Leuchten-Regler), und die gemeldete Auswahl ist ausgeblendet. Grund: Ohne Server ist kein Gerätezustand gemessen, und kein
  Befehl kommt an; eine gezeigte Program-Auswahl wäre ungemessen. Preis: Bei einem kurzen Server-Abriss sieht der Bediener keine
  letzte Auswahl (Geänderte Bedienung).
- **W101** (Task 18, ersetzt durch W103) Die Tastenplatz-Treffer aus dem neuen Rahmen (Inhalt 35 px tiefer; PTZ-Presets 1 bis 6
  auf den alten Plätzen von 7 bis 12, OBS-Szenen bei 1024 auf Aufnahme und Stream) sollten als Owner-Frage gehen, mit der Option
  „oberer Inhaltsrand weg“. Grund: Der Rahmen kommt aus Task 17 und B15, nicht aus Task 18. Preis: das Fehlklick-Risiko auf den
  Presets bis zur Antwort.
- **W102** (Task 18) Dass die Umbruch-Regel der Reihen ins Markup des TallyButton greift, ging ungewertet an die Prüfung. Grund:
  Die Kopplung an Baustein-Markup ist eine Qualitätsfrage, und ein Test bewacht sie; die Prüfung ließ es als kleinen Punkt
  stehen. Preis: höchstens eine Fix-Runde.
- **W103** (Task 18, ersetzt W101) Der Tastenplatz-Befund wird in Task 18 behoben statt als Owner-Frage gestellt: Ursache war
  der obere Innenrand des Inhalts, kein Maß aus Plan oder Owner-Entscheid (B15 legt Kopf und Werkzeugleiste fest, nicht den
  Rand). Abgenommen wird nach drei Zählungen: (a) keine Taste im selben Zustand auf dem alten Platz einer folgenreichen Taste,
  (b) keine Haupttaste auf einer anderen Haupttaste über das hinaus, was die alte Oberfläche mit sich selbst trifft, (c) jeder
  übrige Treffer je Paar mit Ursache. Gemessen danach: (a) 0 statt 191. Grund: Die Tastenplatz-Regel der Welle ist bindend.
  Preis: Der Inhalt sitzt enger unter der Werkzeugleiste (rund 6 statt 24 px Abstand); er beginnt 18 px tiefer als in der
  alten Oberfläche, vor der Korrektur waren es 35 px.
- **W104** (Task 18) Dass die Leuchten-Karten ohne Server nach dem rohen Blackout-Wert des Stores dimmten, wurde zu einem
  wichtigen Befund und behoben. Grund: Sie zeigten einen ungemessenen Blackout, während die Pille „unbekannt“ sagte; das
  verletzt W99. Preis: eine Zeile.
- **W105** (Task 18) „Nicht verbunden.“ im OBS-Panel bei unbekanntem Zustand wurde zu einem wichtigen Befund; dort steht jetzt
  „Zustand unbekannt“, „Nicht verbunden.“ bleibt für gemessen getrennt. Grund: Es widersprach W95. Preis: ein Text (SC32,
  EN22).
- **W106** (Task 18) Zählung (b) aus W103 gilt je Tastenpaar (Größe, neue Taste, alte Taste). Grund: Die alte Oberfläche trifft
  sich mit genau diesen acht Paaren (ATEM Cut/Auto ↔ OBS Aufnahme/Stream zwischen verschiedenen Zuständen) selbst, weil die Lage
  vom Zustand abhing; im selben Zustand und innerhalb einer Reihe sind es 0. Die strenge Lesart (gleiches altes Rechteck) ist
  ohne Änderung an B16 und der Zustandslogik nicht erreichbar. Preis: Ein Gewohnheitsklick zwischen ATEM und OBS über
  Zustände hinweg bleibt so möglich wie heute.
- **W107** (Task 19) Die Rollen-Auswahl im Reiter Setup › Benutzer hält nur einen Entwurf; erst ein eigener Knopf „Setzen“ je
  Zeile ändert die Rolle (derselbe Aufruf wie bisher), frei nur bei einer Abweichung, die eigene Zeile bleibt gesperrt. Grund:
  „Wahl ≠ Bewegung“ gilt in jeder Aufgabe; eine Pfeiltaste auf der Auswahl änderte Rechte sofort. Vorgang wie W87. Preis: ein
  Klick mehr beim Rollenwechsel (Geänderte Bedienung, Text „Setzen“).
- **W108** (Task 19) TriCaster-Version und ATEM-Modell entfallen in der Pille. Grund: Sie sind weder Bedienelement noch
  Einstellung (Spec 10 zählt Information nicht als Funktion), B16 legt die Pille auf die gemeinsame Geräte-Pille fest; die
  Texttabelle nennt es unter „Entfällt“ (EN17), der Owner kann sie zurückwünschen, etwa als Tooltip. Preis: Version und Modell
  stehen nur noch am Gerät.

### Connect

- **W109** (Task 20) Als Isolation der Messungen dient eine Netzwache, die über `NODE_OPTIONS` geladen wird: Der Hauptprozess
  verweigert jeden Verbindungsaufbau zu einem Host, jedes UDP-Binden und jeden Hilfsprozess; der Quelltext bleibt unverändert.
  Grund: Das ist strenger als verlangt, kein Paket hat den Rechner verlassen, und für die Oberfläche gleicht es „kein Presenter
  im Netz, kein Launcher“. Preis: Zustände mit verbundenem Presenter fehlen echt gemessen; ohne echten Presenter wären sie
  ohnehin nicht isoliert messbar. Task 24 nutzt dieselbe Wache.
- **W110** (Task 20) Die Funktionsliste liest die Zoom-Module des Hauptprozesses vollständig (ausgenommen das Paket
  `@jm/zoom-bridge` und das Laden des SDK); die Meldungstexte gehören in den Abschnitt „Dialoge und Meldungen“. Grund: Diese
  Module bestimmen sichtbare Zustände und tragen die Texte aus Spec 8.1 bis 8.6. Preis: eine Runde ohne neue Zeilen, falls es
  unnötig war; es kamen 19 Zeilen dazu.
- **W111** (Task 20) Drei Hinweise der Prüfung wurden zu wichtigen Befunden: Belege zur Fernsteuerung lagen je vier Zeilen
  daneben; „nur über das Tray“ widersprach dem Code (das Standardmenü kann beenden); der Doppelklick-Schutz der Zoom-Knöpfe
  hatte keine eigene Zeile, obwohl B20 genau diesen Zustand verlegt. Grund: Task 25 übernimmt Belege und könnte sonst den Verlust
  nicht sehen; eine Zeile gegen den Code gilt in dieser Prüfung als wichtig. Preis: drei kleine Textänderungen.
- **W112** (Task 21) Die Zeile `@source` für `@jm/ui` in Connects `index.css` gehört zu Task 23. Grund: Der Auftrag legt
  `index.css`, `index.html` und die Schrift ausdrücklich in Task 23, und Connect hat kein `globals.css`. Preis: Task 23 bringt
  `@source` samt Wächter mit.
- **W113** (Task 21) Die bestehende Selbsttest-Kette von Connect bleibt vollständig, der neue Oberflächen-Selbsttest wird
  angehängt; der CI-Schritt behält seinen Befehl, nur sein Name nennt die Oberfläche. Grund: Der Auftrag nennt nur den Namen
  des Schritts, und der bestehende Selbsttest bleibt grün. Preis: ein umbenannter Schritt.
- **W114** (Task 22) Nach einem Raumabbruch zeigt die Raum-Taste „Raum öffnen“; das zusätzliche „Raum schließen“ bleibt als
  normaler Knopf (seit Task 24 unter den Haupttasten). Grund: B21 regelt nur den Fall mit Client (dort entfällt das zweite
  „Raum schließen“ der Einladen-Zeile); eine Umschalt-Taste kann nicht beides, und Öffnen ist der Weg nach vorn. Preis:
  Wünscht der Owner nach einem Raumabbruch „Raum schließen“ als Haupttaste, folgt ein kleiner Nachtrag (W131).
- **W115** (Task 23) Die Bewertung der Tastenplätze und jede Lage-Korrektur der linken Spalte gehören zu Task 24, der gegen die
  Vorher-Messung misst und nach den drei Zählungen aus W103 und W106 abnimmt; er darf dafür auch die Datei des Cloud-Raums
  ändern. Die Vorab-Treffer aus Task 23 (Gast-Tasten auf dem alten „Talkback alle“, Talkback auf dem alten „Raum schließen“)
  sind seine ersten Prüfpunkte. Grund: Die Messung gehört zum messenden Task, wie in Task 18. Preis: Task 24 ändert eine Datei
  aus Task 23.
- **W116** (Task 23) Ein Doppelklick auf die eine Raum-Taste wird nicht abgefangen; die Frage nach einer kurzen Sperre nach dem
  Umschalten ging an den Owner. Grund: Ein eben geöffneter Raum hat noch keine Gäste, und während des Öffnens ist ein zweiter
  Klick schon gesperrt. Preis: versehentliches Öffnen und Schließen in der Sendung, später mit einer kurzen Sperre behebbar.
  Der Owner hat es am 24.11. 16:09 hingenommen (Z1 A).
- **W117** (Task 23) Zwei Änderungen außerhalb der Dateiliste sind angenommen: der Test `zoom-teile.test.ts`, der die alte
  Wurzel-Datei las, und die Zeile `font-src 'self' data:` in der Inhaltsrichtlinie (CSP) des Fensters. Grund: Der Test musste mitziehen; die Zeile folgt aus
  dem verlangten Wechsel auf die Schrift Manrope und entspricht der Richtlinie zur Laufzeit. Preis: eine Zeile zurücknehmen.
- **W118** (Task 24) Die übrigen Tastenplatz-Treffer werden nicht in Task 24 umgebaut, sondern als Owner-Fragen F1 bis F3
  gestellt. Grund: B19 (Owner-freigegeben) legt zwei Spalten und die Blockfolge fest, die alte Oberfläche war eine einzige
  720 px breite Spalte, und ein Abstand löst es laut Rechnung nicht; Vorbild W80. Die Prüfung fand bei 1280 × 860 trotzdem 21
  gefährliche Treffer, die aus der Umsetzung kamen; sie sind behoben (Gast-Aktionen auf eigener Zeile ab dem Zeilenanfang,
  21 → 0). Der Owner hat am 24.11. 16:09 entschieden: F1 A, F2 B bei 1280 × 860 (W122) und A bei 980 × 640 und für die
  Kacheln, F3 A. Preis: das Fehlklick-Risiko bei 980 × 640 und an den Kacheln, wie in der Texttabelle beschrieben.
- **W119** (Task 24) Dass Beschriftungen der Statusleiste ineinanderlaufen, ist ein Fehler des gemeinsamen Bausteins außerhalb
  von Task 24; er geht mit Beleg an die Schlussprüfung, für alle Apps der Welle. Preis: eine sichtbar überlappende
  Statusleiste in den Testbauten bis dahin.
- **W120** (Task 24) Ein Beleg der Owner-Frage F2 (der Suchbereich der Rechnung) passte nicht zum abgelegten Skript und ist in
  derselben Runde berichtigt. Grund: Eine Owner-Frage mit falschem Beleg führt den Owner. Preis: ein Satz.
- **W121** (Task 25) Befund 11 („Wahl ≠ Bewegung“ an laufenden Zoom-Slots) wird behoben, nicht als Owner-Frage gestellt: An
  einem laufenden Slot halten Auflösung, Ersatzbild und Bildformat und im Panel das Sprecher-Signal nur einen Entwurf, ein
  eigener Knopf „Setzen“ übernimmt (frei nur bei Unterschied, der Entwurf fällt danach weg). Die Schalter Ton, Computerton,
  ohne Kamera und Vorschau bleiben sofort, ebenso die Vorgaben und „Person im NDI-Namen“ (sie wirken erst beim nächsten Start);
  ein gestoppter Slot wählt direkt. Grund: Die Regel der Welle ist bindend, Vorbild W107; ein Durchblättern der Auflösung eines
  laufenden Slots mit den Pfeiltasten schaltete das NDI-Bild mehrfach um. Preis: ein Klick mehr an laufenden Slots (Geänderte
  Bedienung).
- **W122** (Task 24, nach dem Owner-Entscheid vom 24.11. 16:09) F2 B ist als Nachtrag zu Task 24 gebaut, nach dem Nachtrag zu
  Task 25; im selben Arbeitsbaum arbeitet nie mehr als ein Bauender. In der breiten Gästeliste (ab 34rem, gleicher Umbruch wie
  die Aktionszeile) stehen 🎙 und 📊 vor dem Namen; nachgemessen wie in Task 24. Gemessen danach bei 1280 × 860: bedienbare
  Treffer im selben Zustand 54 → 10, nur die Kachel-Taste Start/Stopp, keiner gefährlich. Preis: eine weitere Messrunde
  (rund 1 h).
- **W123** (Task 25) „Setzen“ an einer laufenden Kachel ist eine Kachel-Taste wie Start/Stopp; seine Treffer fallen unter
  F2 A, werden aber in der Funktionsliste (Nr. 95, Befunde 1 und 2) und in der Texttabelle offen benannt und in der Nachmessung
  zu F2 B als Kreuzzustände gezählt (Gäste × laufende Kacheln mit offenen Einstellungen). Kein Umbau: Die linke Kachelspalte
  liegt bei 1280 ganz im alten 720-px-Band, ein freier Platz fehlt. Gemessen: 4 Treffer bei 1280 × 860 (2 bedienbar, nur mit
  Entwurf), keiner auf einem alten „Entfernen“ oder „Auf Sendung“; die Texttabelle kennzeichnet sie als nach dem Entscheid
  gemessen. Grund: Der Owner hat F2 A für die Kacheln hingenommen. Preis: Will der Owner „Setzen“ verlegt haben, zeigt es die
  Texttabelle.
- **W124** (Task 25) Die Fix-Runde von Task 25 begann erst nach dem Nachtrag zu F2 B (W122), dessen Nachmessung die
  Kreuzzustände für „Setzen“ und Start/Stopp mitmaß. Grund: Im selben Arbeitsbaum arbeitet nie mehr als ein Bauender. Ein Preis
  ist nicht festgehalten.

### Rückspiel in die früheren Apps

- **W125** (Task 26) Die neuen Mess-Regeln (die drei Zählungen aus W103 und W106, Kreuzzustände) werden für Presenter und
  Studio-Control an den vorhandenen Messdaten ausgewertet; eine neue Messung im echten Fenster gibt es nur, wenn ein
  Rückspiel-Commit eine Taste verschiebt. Grund: Die Lagen des Presenters sind ohnehin Owner-Fragen P1 und P2, Studio-Control ist
  in Task 18 nach den drei Zählungen abgenommen. Preis: Lücken bei Kreuzzuständen dieser Apps bleiben unentdeckt; sie sind
  benannt.
- **W126** (Task 26) Die Änderung im Hauptprozess von Prompter (Port 8727) und Player (Port 8725) ist angenommen: Geändert ist
  nur die Quelle von `modus` in der Fernsteuerungs-Meldung (der Modus der meldenden Instanz statt einer Modulvariable); Port,
  Verben und Ablauf bleiben. Grund: Die Meldung gibt es dort seit 2a; die Ausnahmeliste der Welle nennt 8728, 8735 und 8737
  nur, weil 2b dort Meldungen neu einführt. Preis: zwei Zeilen je App zurück.
- **W127** (Task 26) Im Player erscheint „Setzen“ der Show-Auswahl nur bei offenem Entwurf, vorn in der rechten Gruppe des
  Kopfs. Grund: „Wahl ≠ Bewegung“ bleibt erfüllt (die Auswahl bewegt nichts, „Setzen“ übernimmt); die immer sichtbare Form
  verschob laut Messung bei 1040 × 660 Tasten im Ruhezustand. Die Prüfung hat es angenommen; in der Fix-Runde fällt ein Entwurf
  bei jedem Wechsel der aktiven Show weg. Preis: Die Form an Studio-Control und Connect angleichen und neu messen.

### Texttabelle, Handbücher und Abnahme

- **W128** (Z1, ändert den Zeitpunkt aus W83; die Grenze „vor Z2“ ändert W133) Die Texttabelle entstand vor der Antwort auf
  P1 und P2: Beide stehen zuoberst unter „Offene Fragen“, P2 mit dem Risiko „Show endet durch Fehlklick“. Vor den Handbüchern
  und vor jedem Release sollte die Antwort da sein; bei P2 = B folgt ein Nachtrag (Referent-Kopf bei schmalem Fenster, neue
  Messung), und die Tabelle wird nachgezogen. Grund: Warten blockierte Versionen, Changelog und Texte, die nicht an P2 hängen.
  Preis: ein Nachtrag an Texttabelle und Changelog.
- **W129** (Z1) Die Offenen Fragen 3 bis 5 tragen je eine Empfehlung: 3 → A hinnehmen (der Sprung um 2 px nur während der
  Pause; B verschöbe ein gemeinsames Maß auch im Prompter, dort ungemessen); 4 → mit ins Altfehler-Thema (die Welle formuliert
  vorhandene Texte nicht um, ein Text-Nachtrag wäre dasselbe Thema); 5 → ja, alle (wie der Owner-Entscheid zu 2a vom 23.11.
  12:25). Grund: Der Owner entscheidet regelmäßig „mit deiner Empfehlung“. Preis: drei Wörter in der Tabelle.
- **W130** (Z1) Sechs kleinere Hinweise der Prüfung zur Texttabelle wurden zu wichtigen Befunden und behoben: P2 untertrieb das
  Risiko (auch der Treffer altes „⬜“ → neues „■ Beenden“ beendet die Show), CL-SC3 nannte die Pillen deutsch trotz roher
  Gerätefehler, CL-PS1 nannte einen Abschnitt „JM Timer“, den es nicht gibt, die Zahl der Zustände je Größe stimmte nicht (70,
  nicht 140), „90 px in allen Zuständen“ widersprach Frage 3, und X3 nannte den Referenten nicht. Grund: Die Tabelle ist das
  Freigabedokument des Owners, der Changelog geht an die Crew; jede falsche Aussage führt die Entscheidung oder die Crew in
  die Irre. Preis: eine Fix-Runde Text.
- **W131** (Z1) „Raum schließen“ als Haupttaste nach einem Raumabbruch wird keine Owner-Frage. Grund: W114 nennt die Frage nur
  als Preis „falls falsch“; der Eintrag unter „Geänderte Bedienung“ reicht. Preis: Wünscht der Owner es bei der Abnahme, folgt
  ein kleiner Nachtrag.
- **W132** (Z1) Dass der Server von Studio-Control (Port 7778) nach dem ersten Start mit frischem Profil bis rund 110 s auf
  allen Schnittstellen mit einem bekannten Konto erreichbar war (gemessen in Task 14), steht in Offener Frage 5 unter
  Studio-Control, als gemessen und sicherheitsrelevant gekennzeichnet. In der Fix-Runde präzisiert: Das Konto legte der
  Entwickler-Schalter der Messung an; ohne ihn legt die App ein Zufallspasswort ab (laut Code). Grund: Es ist ein Altfehler, und
  die Bedienlogik bleibt in der Welle. Ein Preis ist nicht festgehalten.
- **W133** (Z2, ändert W128) Handbücher und Abnahme-Datei entstanden ohne Antwort auf P1 und P2: Sie beschreiben die gebaute
  Lage (B14 im Editor, B7 im Referenten) und markieren die betroffenen Stellen mit „abhängig von Owner-Frage P1“ bzw. „P2“. Ist
  eine Antwort B, folgt nach dem Umbau ein Nachtrag an genau diesen Stellen; vor jedem Release bleibt die Antwort Pflicht.
  Grund: Warten blockierte Handbücher, Abnahme, Entscheidungen und Roadmap der übrigen fünf Apps. Preis: ein Absatz je Handbuch
  und Abnahme neu.

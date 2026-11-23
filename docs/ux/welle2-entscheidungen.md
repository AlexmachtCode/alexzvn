# UX-Update Welle 2a: Entscheidungen während der Umsetzung (W1–W62)

Bei der Umsetzung von Welle 2a (Caption, Interpreter, Prompter, Stage Display, Recorder, Player) waren an einigen Stellen
Plan, Spec und Code nicht eindeutig. Diese Entscheidungen sind hier festgehalten. Die Funktionslisten
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
  braucht im Betrieb („LIVE“, „Pause“ und „Leertaste“ in 19 px) aber 268 px, GO bleibt also im Betrieb abgeschnitten. Lesbar
  wird GO erst mit einem TallyButton, der sein Kürzel umbricht oder verkleinert (Welle 2b). „Anfang“ ist breiter als früher und
  reicht bis an den inneren Rand der alten Plätze von „↑ zurück“ und „↓ vor“ (Abnahme PRZ4). Preis: eine Nachmessung.

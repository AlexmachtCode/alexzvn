# Abnahme JM Connect 0.4.0 (Zoom-Slots, Lasttest, NDI; Owner, echte Hardware)

Spec: `docs/superpowers/specs/2026-10-17-connect-zoom-slots-design.md`, Abschnitt 12 (Regeln, Voraussetzungen, die Schritte A1 bis L1, die Lasttabelle und das Kriterium stehen hier wörtlich), Messpunkte aus 17.2 (MS1 bis MS28); Ergänzung FR13: Gruppe N aus 22.12 mit den Messpunkten MS30 bis MS36 aus 22.13. Pläne: `docs/superpowers/plans/2026-10-19-connect-zoom-slots-a-bridge.md`, `docs/superpowers/plans/2026-10-19-connect-zoom-slots-b-connect-companion.md`, `docs/superpowers/plans/2026-10-19-connect-zoom-slots-c-ndi.md`.

T-Nummern verweisen auf die Texttabelle der Spec (T1 bis T106 in Abschnitt 9, T107 bis T146 in 22.9); die Kachel zeigt den Text wörtlich, mit den eingesetzten Werten. Zwei Ergänzungen am Wortlaut von Abschnitt 12, damit jeder Messpunkt einen Schritt mit Feld hat (Regel 5): G2 notiert zusätzlich „Empfang laut Zoom“ (T62b, MS24), K1–K10 nennt MS14. Dazu nennt K12 die Annahme AN15 aus 17.1, die der Vergleich prüft (Ort laut 17.1: Lasttest, MS19, K12).

**Regeln:**
- Getesteter Bau ist der **veröffentlichte Pre-Release** aus dem Launcher (B.7), nicht ein interner Bau; SHA-256 des Installers in „Getesteter Bau“.
- Der native Teil ist geändert → Gruppe L (Gegenprobe der bisherigen Funktionen) ist Pflicht (`ABNAHME-0.3.0.md:8`).
- Meeting-Nummer, Kenncode und echte Teilnehmernamen nie in die Datei, nur `<Name>` (`ABNAHME-0.3.0.md:9`); die Messwerte-Kopie ist schon ohne Namen (0.23).
- Companion mit Modul 0.3.0 aus dem Release; für A3 zusätzlich ein Rechner mit Connect 0.3.0 oder eine Switcher-Show, die unter 0.3.0 eingerichtet wurde.
- Jeder Messpunkt aus 17.2 hat einen Schritt, der sein Feld füllt (Nachbesserung B80); was hier kein Feld hat, ist kein Messpunkt.
- Ergänzung FR13 (22.12, vom Owner am 18.10.2026 freigegeben): Gruppe N (ND1–ND17) unter Windows und macOS ist Pflicht, mit den Messpunkten MS30–MS36 (22.13); für sie gilt dieselbe Regel.

**Getesteter Bau** (vom Owner auszufüllen):

| Bau | SHA-256 | Datum | Raum-PC |
| --- | --- | --- | --- |
| `JM Connect-0.4.0-win-x64.exe` (Pre-Release `connect-v0.4.0`, über den Launcher installiert) | | | |
| `jm-suite-companion-0.3.0.tgz` (Modul 0.3.0, aus dem Release) | | | |
| `JM.Connect-0.4.0-mac-arm64.dmg` (Release `connect-v0.4.0`, aus `connect-mac.yml`, über den Launcher installiert; ND9) | | | |
| `JM.Connect-0.4.0-mac-x64.dmg` (Release `connect-v0.4.0`, aus `connect-mac.yml`; ND12) | | | |

**Raum-PC** (vom Owner auszufüllen):

| Prozessor | Grafikkarte | Arbeitsspeicher | HD-Video im Zoom-Konto (AN24) |
| --- | --- | --- | --- |
| | | | |

**Voraussetzungen** (Nachbesserung B5, B40; Nachfix W8): Raum-PC mit Windows (Prozessor, Grafikkarte, Arbeitsspeicher notieren); Meeting im eigenen Zoom-Konto, Host im Zoom-Client; die Kontoeinstellung für HD-Video notieren (ob das Konto 1080p zulässt, ist **Annahme** AN24); **mindestens 9 verschiedene Kamera-Quellen** für Gruppe K (Teilnehmer-Geräte, weitere Zoom-Clients auf einem zweiten Rechner oder virtuelle Kameras), möglichst alle für 1080p eingerichtet (Kamera, HD im Zoom-Client; für eine aussagekräftige Zeile „9 Slots, 1080p“ müssen es neun sein, die 1080p allein liefern, K0), und zwei mit gleichem Namen; zwei Geräte können den Bildschirm teilen, eines mit Computerton; ein Teilnehmer mit angemeldetem Zoom-Konto (für MS16); JM Switcher und ein NDI-Monitor im Netz, im Switcher ein eigenes Hintergrundbild unter dem Slot-Eingang (für transparent); ein Browser-Gast mit einem Namen gleich einem Slot (L1); Companion mit Modul 0.3.0; Task-Manager mit den Spalten CPU, GPU („3D“ und „Video Decode“) und Arbeitsspeicher; eine Stoppuhr (H1, D6). Reichen die Kamera-Quellen nicht, gilt die Regel unter der Lasttabelle.

## A · Installation

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| A1 | Connect 0.4.0 über den Launcher installieren (Update von 0.3.0) | Version sichtbar; Einrichtung, Zugang, Versatz unverändert; Abschnitt „Zoom-Slots“ mit T30 | |
| A2 | Slots anlegen: „Zoom 1 Moderation“ (Teilnehmer `<Name A>`), „Zoom 2 Sprecher“ (Sprecher), „Zoom 3 Freigabe“ (Freigabe), Connect beenden und aus dem Launcher neu starten | alle drei unverändert da; im Switcher noch keine Quelle | |
| A3a | Übergang mit einem Switcher-Eingang aus 0.3.0 (Quelle „‹Rechner› (JM Connect – Zoom <Name B>)“): im Meeting `<Name B>` „Als Slot laden“ (Nachbesserung B79 f) | der alte Eingang zeigt das Bild ohne Neueinrichtung; der Slot ist dauerhaft (kein T96). Dass dauerhafte Slots Neustart und Meeting-Ende überstehen, prüfen A2 und J3, denn A3b löscht diesen Slot (Fünfte Runde N7) | |
| A3b | Den Slot aus A3a ausschalten und löschen, dann `zoom_load <Name B>` per Companion (Nachfix W5: Solange ein Teilnehmer-Slot dieses Namens besteht, legt `zoom_load` keinen neuen an, 8.3) | ein neuer vorübergehender Slot mit T96 und dem alten NDI-Namen; der alte Eingang zeigt wieder Bild ohne Neueinrichtung; nach dem nächsten neuen Beitritt (spätestens D5) ist der Slot weg (7.3 Nr. 8); dass vorübergehende Slots mit dem Meeting enden, prüft J3 an einem eigenen Slot (Sechste Runde RN8) | |
| A4 | Connect 0.4.0 unter macOS starten (mit der Ergänzung FR13 Pflicht, Ablauf in ND9; vorher „falls ein Mac da ist“) | T95 an der Stelle der Zoom-Karte | |

## B · Teilnehmer

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| B1 | Beitreten, Erlaubnis erteilen | die eingeschalteten Slots starten von selbst; Quellen „‹Rechner› (Zoom 1 Moderation)“ usw. im Switcher; Kachel T15 | |
| B2 | `<Name A>` verlässt das Meeting und kommt nach mehr als 1 s zurück (#262) | T16 mit Ersatzbild, `zoom_alarm` = 1, dann wieder T15 mit Ton; der Switcher-Eingang bleibt verbunden (kein Neuverbinden sichtbar) | |
| B2b | dasselbe mit dem angemeldeten Konto | T62c notieren (MS16) | |
| B3 | Zwei Geräte mit gleichem Namen; Slot auf diesen Namen; Person wählen; dann schaltet die gewählte Person die Kamera aus | T13, Companion-Feedback „braucht einen Eingriff“; nach der Wahl Bild; nach Kamera aus T19 ohne Alarm | |
| B4 | `<Name A>` schaltet die Kamera aus und an | T19, Ersatzbild; Teilnehmerliste zeigt „Kamera aus“ | |
| B5 | Doppel-Abo vor dem Lasttest: Slot 1 Teilnehmer `<Name A>`, Slot 2 Sprecher, `<Name A>` spricht; dann zwei Freigabe-Slots, B teilt (Nachbesserung B35) | je Slot: Bild ja/nein, Bilder/s, geliefert B×H, Kachel (T97?) notieren (MS21) | |

## C · Ersatzbilder

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| C1 | Ersatzbild nacheinander transparent, eingefroren, schwarz, weiß, je Kamera aus; dann bei schon ausgeschalteter Kamera auf „eingefroren“ umstellen | transparent: im Switcher liegt das Hintergrundbild sichtbar darunter (MS12); eingefroren: letztes Bild; schwarz; weiß; Umstellen bei aus: T60 und transparent | |

## D · Sprecher

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| D1 | zwei Personen wechseln sich im Abstand von etwa 2 s ab, Haltezeit 1 s; danach T69 notieren | Slot folgt ohne Dauerflackern; Lücke (T66) notieren (MS13); „zu häufige Aufrufe“ und „fremde Bilder“ aus T69 (MS4, MS11) | |
| D2 | Signal nacheinander auf alle drei stellen, je D1 wiederholen | notieren, welches Signal passt; Spotlight durch den Host einmal je Signal (MS7) | |
| D3 | „Teilnehmer ohne Kamera zeigen“ aus, dann an; je eine Person ohne Kamera spricht, je Signal (Nachbesserung B49) | aus: Slot bleibt bei der vorigen Person; an: notieren, ob das Signal die Person ohne Kamera überhaupt meldet (Slot zeigt T27 bzw. bleibt; MS7) | |
| D4 | JM Connect selbst ist stumm; prüfen, dass der eigene Teilnehmer nie gezeigt wird | nie | |
| D5 | neuer Beitritt mit **allen** Slots auf Ton aus (kein `JoinVoip`), D1 wiederholen (Nachbesserung B36) | notieren, ob Sprecher-Signale kommen (Signal-Tabelle T65; MS22) | |
| D6 | Sprecher-Slot mit Mischton: Klatschen vor der Kamera, im Switcher Bild gegen Ton (Nachbesserung B80) | Versatz Bild–Ton notieren (MS18) | |

## E · Freigabe

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| E1 | Person B teilt den Bildschirm, pausiert, teilt weiter, beendet | T28, T29 mit gehaltenem Bild, T28, T29c; Auflösung und Bildrate notieren (MS1); T63c: Rückrufe und Freigabe-Kennung bei Pause notieren (MS6) | |
| E2 | Stehender Bildschirm 60 s; dann Maus bewegen | T29b, kein Ersatzbild-Flackern, die Kachel bleibt ruhig (kein Wechsel unter 2 s, Nachbesserung B66) | |
| E3 | A und B teilen gleichzeitig, dann endet B | Slot zeigt B (neueste, T28b), dann A | |
| E4 | Freigabe mit Computerton: Computerton an/aus; dann Ton Mischton dazu; T63/T64/T64c ansehen | Ton der Freigabe in derselben NDI-Quelle; aus → still; mit Mischton: notieren, ob der Computerton doppelt klingt (MS8, MS9); Kennung des Freigabe-Tons notieren (MS28); zum Schluss bei Ton aus und Computerton an die Freigabe beenden: Tonzeile T58f (Fünfte Runde, `noShare`) | |
| E4b | Slot mit Ton Person auf die teilende Person, während sie Ton teilt (Nachbesserung B80) | notieren, ob ihr Person-Ton den Computerton enthält (MS9, zweite Frage) | |
| E5 | Connect beitreten, während schon jemand teilt | notieren, ob der Slot die laufende Freigabe sofort zeigt (`seeded`, MS3) | |
| E6 | Connect ist im Meeting, B teilt schon, **dann** einen Freigabe-Slot einschalten (Nachbesserung B38) | Slot zeigt die Freigabe; nie T29c, solange B teilt | |
| E7 | B verlässt das Meeting, während B teilt (AN9) | Slot geht auf die nächstjüngere Freigabe bzw. T29c | |
| E8 | reine Computerton-Freigabe nach einer laufenden Bildschirmfreigabe (Nachbesserung B37) | Slot bleibt bei der Bildschirmfreigabe; Typ und Rückrufe in T63c notieren (MS23) | |
| E9 | Freigabe beginnen und sofort `rendererNew`/`noShareData` in T69 notieren | MS27 | |

## F · Ton

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| F1 | Slot 1 Ton Person, Slot 2 Mischton, Slot 3 aus; dann am laufenden Slot umschalten; Companion „Ton aus“ an einem Freigabe-Slot mit Computerton | jeweils der richtige Ton; Umschalten ohne Neustart der Quelle; Companion „Ton aus“ macht die Quelle still, `zoom_slot{n}_audio` = 0 | |

## G · Moduswechsel

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| G1 | Slot 1 laufend (Ton nach Vorgabe: Mischton, Computerton an) von Teilnehmer auf Sprecher, auf Freigabe, zurück | der Switcher-Eingang bleibt verbunden; die Tonzeile passt nach jedem Wechsel zum neuen Modus (10.6: in Freigabe mit Computerton, sonst nur Mischton), und der Ton läuft danach wieder (T58c; Restnachfix N1); Zähler „neue Renderer“ und „Renderer-Typ“ aus T69 notieren (MS5) | |
| G2 | Auflösung am laufenden Slot von 720p auf 1080p und zurück (Nachbesserung B48) | „Renderer meldet“ (T62) und geliefert B×H notieren (MS2); dazu „Empfang laut Zoom“ (T62b) notieren (MS24) | |

## H · Anzeige

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| H1 | Kacheln, Vorschau, Messwerte ansehen; Fenster minimieren und zurückholen; „Messwerte kopieren“; bei 9 Slots Start-Klick → Kachel mit Stoppuhr | Vorschau etwa 2 Bilder/s, nach dem Minimieren aus und danach wieder an; Kopie ohne Namen; Verzögerung notieren (MS15) | |

## I · Companion

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| I1 | Slot ein/aus/umschalten, Modus, Person, Ton je Slot; Variablen und Feedbacks ansehen; alte Befehle `zoom_load`, `zoom_unload`, `zoom_delay`; 17 verschiedene Namen nacheinander laden und entladen; `zoom_load` auf den Namen eines ausgeschalteten dauerhaften Slots (Restrunde RR7) | alles wirkt; `zoom_slot{n}_target` nennt die gezeigte Person; alte Befehle wie in 0.3.0 (vorübergehende Slots, kein F14); der dauerhafte Slot zeigt T96b und ist nach dem Meeting-Ende (J3) wieder aus | |
| I1 Zusatz | Feldprobe, kein Spec-Schritt (Nachtrag B, NB8): eine Companion-Taste mit den zwei Aktionen `ZOOM_SLOT n ON` und `ZOOM_SLOT_MODE n sprecher` an einem ausgeschalteten Teilnehmer-Slot | Bridge und Kachel zeigen Sprecher: die Kachel „Zeigt … (Sprecher).“ mit der sprechenden Person, `zoom_slot{n}_mode` = sprecher, im Switcher wechselt das Bild der Quelle mit dem Sprecher | |

## J · Abbau

**Nur im Testmeeting, nie auf Sendung:** J1 bis J3 entziehen die Aufnahme-Erlaubnis, trennen das Netz für 60 s und beenden das Meeting; sie stören jedes laufende Meeting (Hinweis aus Nachtrag B, NB26; die Schritte selbst stehen wörtlich wie in der Spec).

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| J1 | Host entzieht die Erlaubnis, erteilt sie wieder, **während** B den Bildschirm teilt und ein Freigabe-Slot läuft (Nachfix W3) | Bild und Ton aller Slots stoppen sofort, T12b; danach laufen alle wieder, Sprecher-Slot zeigt sofort wieder den Sprecher, der Freigabe-Slot sofort wieder Bs Freigabe (nie T29c, solange B teilt) | |
| J2 | Netzwerkkabel 60 s ziehen | Z10/Z11, danach laufen die Slots wieder; notieren, ob der Switcher selbst neu verbindet (MS17) | |
| J3 | Kurz vorher per Companion `zoom_load <Name C>` (vorübergehender Slot, T96); dann beendet der Host das Meeting, **während** eine Freigabe und ein Sprecher-Slot laufen; dann Beenden aus dem Tray (Nachbesserung B34; Sechste Runde RN8) | **kein Absturz der Bridge** (Log: kein Rückgabewert eines Absturzes, Muster `packages/zoom-bridge/ABNAHME-STAGE3.md:264-267`); nach dem Meeting-Ende, vor dem Beenden: die dauerhaften Slots stehen weiter in der Karte, der vorübergehende Slot für `<Name C>` ist weg (der aus A3b ging schon mit einem neuen Beitritt, A3b), der dauerhafte Slot aus I1 (`zoom_load`, T96b) ist wieder aus und ohne T96b (Fünfte Runde N7); Connect endet binnen 15 s; notieren, welche Rückrufe zwischen `disconnecting` und `ended` kamen (MS26) | |
| J4 | Netzwerkkabel 5 s ziehen (Z10 kurz, wie A3 aus 0.3.0, `ABNAHME-0.3.0.md:33`; Nachbesserung B80) | Slots laufen weiter oder wieder; „vom SDK abgebaute Renderer“ aus T69 notieren (MS25); kein Absturz | |
| J Zusatz | Feldprobe, kein Spec-Schritt (Nachtrag B, NB2/NB7; im Testmeeting): einen Slot starten und innerhalb von 2 s „Stopp“, „Löschen“, „Slot hinzufügen“ (Person eintragen) und „Start“ | Der neue Slot zeigt seine Person unter seinem NDI-Namen; kein verwaister Sender (im NDI-Monitor keine Quelle mehr mit dem NDI-Namen des gelöschten Slots) | |

## K · Lasttest (#261)

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| K0 | Vor K1 jede Kamera-Quelle einzeln mit genau einem laufenden Slot, je 30 s in 720p und in 1080p (Nachfix W8; Siebte Runde, Schlussprüfung S6). Freigaben misst K0 nicht: Ihre Bilder/s hängen am Bildinhalt (bei stehendem Bildschirm liefert Zoom kaum Bilder, 0.5), und 10.7 nimmt sie vom Größenvergleich aus (Achte Runde, Feinschliff FS5) | je Kamera-Quelle geliefert B×H und Bilder/s notieren (die Bilder/s sind der Maßstab von Kriterium (1) unten); „liefert die Stufe allein“ = kürzere Seite mindestens die Nennhöhe (Regel 10.7); daraus je Stufe die Zahl der Kamera-Quellen, die sie allein liefern (MS10) | |
| K1–K10 | 1, 3, 5, 7, 9 Slots je in 720p und 1080p, je 5 min (Tabelle unten); bei 6 die Nachfrage T40 einmal | Felder vollständig; „schafft dieser Rechner“ je Stufe ja/nein nach dem Kriterium unten; Lastwerte je Zeile (MS14) | |
| K11 | bei 5 und 9 Slots Vorschau aus und wieder an | CPU-Unterschied notieren (MS15) | |
| K12 | zwei Slots auf dieselbe Person gegen zwei Slots auf verschiedene Personen, je 720p (Nachbesserung B5) | Prozess-CPU und GPU „Video Decode“ beider Fälle notieren (MS19); der Vergleich prüft die **Annahme** AN15, dass jeder Renderer eine eigene Dekodierung kostet | |

**Lasttest (Gruppe K), je Stufe eine Zeile:**

| Slots | Auflösung | Rechner | je Slot: geliefert B×H, Bilder/s, Bridge-Anteil (ms/s) | Prozess-CPU (T61) | System-CPU | GPU 3D / Video Decode (Task-Manager) | Arbeitsspeicher | Bild ruckelfrei im Switcher | Ton ruckelfrei | verschiedene Quellen | davon liefern die Stufe allein (K0) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 720p | | | | | | | | | | |
| 1 | 1080p | | | | | | | | | | |
| 3 | 720p | | | | | | | | | | |
| 3 | 1080p | | | | | | | | | | |
| 5 | 720p | | | | | | | | | | |
| 5 | 1080p | | | | | | | | | | |
| 7 | 720p | | | | | | | | | | |
| 7 | 1080p | | | | | | | | | | |
| 9 | 720p | | | | | | | | | | |
| 9 | 1080p | | | | | | | | | | |

Je Stufe zeigt jeder Slot eine **eigene** Kamera-Quelle auf einem Teilnehmer-Slot. Reichen die Quellen nicht, werden Sprecher- und Freigabe-Slots aufgefüllt, die Spalte „verschiedene Quellen“ nennt die Zahl, und eine Stufe mit weniger verschiedenen Quellen als Slots gilt als **nicht aussagekräftig für #261**, bis K12 (MS19) zeigt, ob doppelt belegte Slots eine eigene Dekodierung kosten. Ebenso gilt eine Stufe für die Frage nach einer HD-Grenze (MS10) als **nicht aussagekräftig für #261**, wenn weniger ihrer Kamera-Quellen die Stufe allein liefern (letzte Spalte, aus K0), als Slots laufen (Nachfix W8; Freigaben zählen in der letzten Spalte nicht, wie in 10.7, eine mit einer Freigabe aufgefüllte Stufe ist für MS10 also nicht aussagekräftig; Achte Runde, Feinschliff FS5): Liefert eine Quelle schon allein nur 720p, sagt ihr 720p-Bild in der 1080p-Zeile nichts über eine Grenze, die Zoom bei mehreren Abos zieht (Hinweise darauf nur beim Custom-UI-Container, `customized_video_container.h:197-199`). Die Lastwerte der Zeile (MS14) bleiben gültig, mit den tatsächlich gelieferten Größen. Die Messwerte-Kopie (T68) jeder Stufe kommt unter die Tabelle.

**Kriterium „schafft dieser Rechner“** (Vorschlag der Spec, Owner-Frage FR9; Nachbesserung B73): eine Stufe gilt als geschafft, wenn über die 5 Minuten (1) jeder Teilnehmer- und Sprecher-Slot mindestens 90 % der Bildrate liefert, die seine Quelle allein in derselben Auflösung lieferte (K0; ein Sprecher-Slot gemessen an der Quelle, die er gerade zeigt; Siebte Runde, Schlussprüfung S6), (2) `fallbackFps` bei laufendem Bild 0 bleibt, (3) T61 keine verworfenen Ton-Pakete und keine verworfenen Zoom-Ereignisse zeigt, (4) Bild und Ton im Switcher ruckelfrei sind. Für Freigabe-Slots gilt (1) nicht, weil ihre Bilder/s am Bildinhalt hängen und 10.7 sie vom Größenvergleich ausnimmt; für sie gelten nur (2) bis (4), und (2) heißt bei ihnen: bei laufender Freigabe nach ihrem ersten Bild nie ein Ersatzbild (Zustand nie `fallback`, `sent` nur `none` oder `held`), denn `fallbackFps` zählt auch die Haltebilder (6.17), die ein Freigabe-Slot bei stehendem Bildschirm gewollt sendet (0.5, 6.9) (Achte Runde, Feinschliff FS5). Die Betriebsgröße (5, `zoom-text.ts:40-45`) ändert erst eine Owner-Entscheidung nach der Abnahme; der Lasttest liefert die Grundlage.

**Messwerte-Kopien je Stufe** („Messwerte kopieren“, T68, ohne Namen; vom Owner einzufügen):

- 1 Slot, 720p:
- 1 Slot, 1080p:
- 3 Slots, 720p:
- 3 Slots, 1080p:
- 5 Slots, 720p:
- 5 Slots, 1080p:
- 7 Slots, 720p:
- 7 Slots, 1080p:
- 9 Slots, 720p:
- 9 Slots, 1080p:

## L · Gegenprobe

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| L1 | „Einrichtung prüfen“, Warteraum und Einlass, Versatz per Klatschtest, zwei Browser-Gäste parallel zu 5 Slots, einer davon mit dem NDI-Namen eines Slots, Log durchsuchen nach Kenncode, Meeting-Nummer und Teilnehmernamen | wie in 0.3.0; T46 an der Kachel; notieren, welche Quelle der Switcher zeigt (MS20); im Log keiner der Werte | |

## N · NDI (Ergänzung FR13)

**Voraussetzungen zusätzlich zu 12:** ein Mac mit Apple Silicon und macOS 15 mit Launcher 0.16.0; für ND12 ein Intel-Mac oder Rosetta auf dem Apple-Silicon-Mac; ein Browser-Gast; der JM Switcher mit NDI-Ausgang „JM Switcher“ (Programm); unter Windows der Task-Manager mit der Ansicht „Details“ (PID), auf dem Mac die Aktivitätsanzeige; Zugriff auf den Installationsordner von Connect unter Windows (ND5); eine geöffnete Show (ND15); eine Firewall-Regel am Raum-PC, die die Adresse des Proxys sperrt, ohne das LAN zu trennen (ND16, ND17); für ND17 das Recht, die Uhr des Raum-PCs zu stellen (automatische Zeit aus). „Getesteter Bau“ nennt zusätzlich die SHA-256 beider DMGs. A4 ist Pflicht (12).

| # | Schritt | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| ND1 | Windows: Raum öffnen, Gast einlassen, Gast teilt den Bildschirm; im Switcher beide Quellen als Eingang wählen | je Quelle T108 mit einer Empfängerzahl ≥ 1, Programm-Abzeichen T123, Tray T131, STATE `ndi_sources=2`, `ndi_alarm=0`; T133 öffnet ndi.video; T134 sichtbar, daneben „Logordner öffnen“ und „Lizenzbedingungen“ (T142); im Untertitel T145 | |
| ND2 | Windows: am Gast-Gerät die Kamera im Browser stoppen bzw. das Netz 10 s trennen | sobald im Switcher-Eingang kein neues Bild kommt, spätestens nach 4 s T109; danach wieder T108; notieren, welche Handlung das Bild anhielt und ob der Gast bei der Netztrennung den Raum verließ (dann `tearDown`, kein Abzeichen; MS35) | |
| ND3 | Windows: PID des Kamera-Senders aus dem Log („Logordner öffnen“ in der Fußzeile), den Prozess im Task-Manager beenden | T110 (k = 1), Tray T129, `ndi_alarm=1`, Log mit Code und PID; danach T108, `ndi_alarm=0`; notieren, ob und nach wie vielen Sekunden der Switcher-Eingang wieder Bild zeigt (MS31) | |
| ND4 | Windows: denselben Sender viermal hintereinander beenden, jeweils, wenn T108 wieder steht, binnen 60 s (ein Beenden vor dem `bereit` des neuen Prozesses ergäbe T117) | nach dem vierten Mal T111 mit T118, kein Neustart von selbst; „NDI neu starten“ → T107, dann T108 | |
| ND5 | Windows: Connect beenden, im Installationsordner `resources\bin\win\jm_ndi.node` umbenennen (nicht die DLL: Fehlt nur sie, lädt der Lader eine installierte NDI-Laufzeit, `packages/ndi/index.js:29-53`, und die Zoom-Bridge nutzt dieselbe DLL, `apps/connect/src/main/zoom/laufzeit.ts:8`, `:19`, `:93-94`; eine zweite Kopie in der `app.asar` gibt es seit E56 nicht mehr, Erfolgszeile von Wächter 2 im Bauprotokoll), starten, Raum öffnen, Gast einlassen | Gastzeile T111 mit T114, Programm-Grundzeile T128 mit T114, kein Neustart von selbst, „Logordner öffnen“ öffnet den Logordner; Datei zurück, Connect neu starten: alles wie ND1 | |
| ND6 | Windows: im Switcher den NDI-Ausgang ausschalten, nach 10 s wieder einschalten | nach spätestens 4 s T124, `ndi_program=ohne_bild`, `ndi_alarm=0`; notieren, ob das Abzeichen ohne Handgriff wieder T123 zeigt und nach wie vielen Sekunden (MS30) | |
| ND7 | Windows: Switcher beenden, Raum schließen und wieder öffnen, dann Switcher starten | T122 mit Tooltip (ohne den macOS-Zusatz), danach T123 | |
| ND8 | Windows: PID des Programm-Empfängers aus dem Log, Prozess beenden; danach wie ND4 viermal hintereinander, jeweils, wenn T123 wieder steht, binnen 60 s | T127 (k = 1), `ndi_alarm=1`, danach T123, `ndi_alarm=0`; nach dem vierten Mal T128 mit T118, kein Neustart von selbst; „Programm neu starten“ → T121, dann T123 | |
| ND9 | Mac (Apple Silicon): Connect 0.4.0 über den Launcher installieren und starten; die Handgriffe für Gatekeeper notieren (MS33); fragt macOS nach dem lokalen Netzwerk (Text T135), erlauben und notieren, wann (MS32) | T95 an der Stelle der Zoom-Karte; T134 in der Fußzeile und im Fenster „Über JM Connect“, T145 im Untertitel; T133; „Lizenzbedingungen“ öffnet `LIZENZ.txt`; „Logordner öffnen“ öffnet den Logordner (Pfad für D17 notieren); ND1 wie unter Windows: Gast und Bildschirm als NDI-Quelle im Switcher am Windows-Rechner, Programm T123, die Gäste sehen und hören das Programm; STATE ohne `zoom_*`, mit `ndi_*` | |
| ND10 | Mac: in den Systemeinstellungen den Zugriff auf das lokale Netzwerk entziehen, Connect neu starten, Gast einlassen | notieren, was Gastzeile, Programm-Abzeichen (T122 mit macOS-Zusatz?) und Switcher zeigen (MS32); danach den Zugriff wieder erlauben | |
| ND11 | Mac: ND3, ND4 und ND8 (PID aus dem Log über „Logordner öffnen“ in der Fußzeile, beenden in der Aktivitätsanzeige) | wie unter Windows; nach ND4 öffnet „Logordner öffnen“ an der Grundzeile den Logordner | |
| ND12 | Mac x64: das x64-DMG aus dem Release auf einem Intel-Mac oder unter Rosetta starten, Gast einlassen | Gast als NDI-Quelle im Switcher, Programm T123 (das universelle Addon lädt in der x64-App) | |
| ND13 | Paketinhalt und Lizenzbedingungen nach der Installation über den Launcher: im Mac-Paket `JM Connect.app/Contents/Resources/bin/mac/` und `Contents/Resources/LIZENZ.txt`, im Windows-Installationsordner `resources\bin\win\` und `resources\LIZENZ.txt`; in Connect „Lizenzbedingungen“ | Mac: `jm_ndi.node`, `libndi.dylib`, Lizenzdatei der NDI-Laufzeit; Windows: `Processing.NDI.Lib.Licenses.txt`; beide: `LIZENZ.txt` mit dem Text nach FR16, „Lizenzbedingungen“ öffnet ihn; die Mac-Installation über den Launcher lief ohne Lizenzfenster und ohne Hänger durch | |
| ND14 | Windows: Der Gast teilt eine Folie und lässt sie 10 s unverändert, dann bewegt er die Maus | notieren, ob die Bildschirm-Quelle in der Pause T109 zeigt (MS34); danach T108 | |
| ND15 | Windows mit geöffneter Show: Gast einlassen, Connect beenden und wieder öffnen, denselben Raum öffnen; der Gast bleibt eingelassen | Gastzeile T140 (teilt der Gast, auch für die Bildschirm-Quelle); Tray-Gästezeile und `ndi_alarm` zählen ihn nicht (FR17, Vorgabe A); dann den Gast entfernen und neu einladen: notieren, ob danach T108 kommt (MS36) | |
| ND16 | Windows: bei laufendem Gast und Programm den Proxy per Firewall sperren (das LAN bleibt), währenddessen den Kamera-Sender beenden (wie ND3), nach 30 s freigeben | T141 über der Gästeliste, die Gastzeile zeigt T110 und danach den aktuellen Zustand, das Programm-Abzeichen bleibt stehen; „Raum öffnen“ erscheint nicht, „Entfernen“, Talkback, Folien und „Link erzeugen“ sind gesperrt (ein Klick auf „Entfernen“ bewirkt nichts; Talkback für alle, während der Sperre gehalten, ergibt im Log keine neue Talkback-Zeile), „Raum schließen“ und „Logordner öffnen“ bleiben bedienbar; nach der Freigabe verschwindet T141, und „Entfernen“ ist wieder bedienbar | |
| ND17 | Windows mit geöffneter Show: Raum öffnen, Gast einlassen und auf Sendung nehmen; die automatische Zeit ausschalten und die Uhr des Raum-PCs um 8 h 5 min vorstellen (für Connect ist die Anmeldung damit abgelaufen, für den DO nicht, E57; die Fristen der Ergänzung laufen monoton und sehen den Sprung nicht, E50); den Proxy wie in ND16 sperren und nach 30 s freigeben; dann „Raum öffnen“; zuletzt im Tray-Menü „Raum schließen“ und die automatische Zeit wieder einschalten | nach der Sperre T144 mit dem Zusatz zur Gästeliste statt T141, ohne die Meldung des Wachhunds (T146); „Raum öffnen“ und „Raum schließen“ bedienbar, Gast-Aktionen und Talkback gesperrt, Gastzeile und NDI-Abzeichen bleiben; nach der Freigabe bleibt T144 stehen (kein Versuch der Bedienung mehr, obwohl der DO den alten Token noch annähme; der versteckte Peer verbindet weiter, RS29); nach „Raum öffnen“ verbunden, T144 weg, der Gast weiter auf Sendung, sein Link öffnet den Raum nach Neuladen wieder; notieren, wie lange Bild und Rückkanal aussetzen; nach „Raum schließen“ im Tray (E58) steht im Fenster nur „Raum öffnen“, und der Link des Gasts führt nicht mehr in den Raum | |

## Messungen

| # | Frage | Wo gemessen | Ergebnis |
| --- | --- | --- | --- |
| MS1 | Hält eine Freigabe die gewählte Auflösung ein? Welche Größe und Bildrate hat sie (Bildschirm, Fenster, ungerade Maße → `slotBufferMismatch`?) | E1 | |
| MS2 | Hält der Renderer die Auflösung über `unSubscribe`+`subscribe`; was meldet `getResolution()` nach dem Setzen? (Ob eine Stufe auch ohne Umhängen wirkt, prüft 0.4.0 nicht, 6.11.) | G2, K | |
| MS3 | Meldet Zoom laufende Freigaben beim Ankommen nach (`seeded`)? In welcher Reihenfolge? | E5, E6 | |
| MS4 | Kommen nach dem Umhängen Bilder mit fremder `GetSourceID()` (`foreignFrames`)? Was liefert `GetSourceID()` bei VIDEO und SHARE (`gapUngeprueft`)? | D1, G1 | |
| MS5 | Darf ein Renderer zwischen VIDEO und SHARE wechseln (`rendererNew`, `rawType`)? | G1 | |
| MS6 | Was kommt während `Sharing_Pause` (keine Bilder, Standbilder, `RawData_Off`)? Ist die Freigabe-Kennung gesetzt, und zieht der Typ-Nachtrag eine Kennung 0 nach (T63c)? | E1 | |
| MS7 | Unterschied der drei Sprecher-Signale, auch bei Spotlight; Bedeutung von 0; Meldungen über den eigenen Teilnehmer; Form der Liste; melden sie Personen ohne Kamera? | D2, D3 | |
| MS8 | Kommt Freigabe-Ton trotz `EnablePlayMeetingAudio(false)`; Rate und Kanäle? | E4 | |
| MS9 | Enthält der Mischton den Computerton; enthält der Ton der teilenden Person ihn? | E4, E4b | |
| MS10 | Gelieferte Größe je Slot bei 720p und 1080p mit 1, 3, 5, 7, 9 Slots; gilt eine HD-Grenze? (360p misst die Abnahme nicht, Entwurf B.6; Nachbesserung B73). Aussagekräftig nur für Zeilen, deren Kamera-Quellen die Stufe allein liefern (Nachfix W8); Freigaben zählen nicht, wie in 10.7 (Achte Runde, Feinschliff FS5) | K0, K | |
| MS11 | Liefert `subscribe` bei schnellem Wechsel `SDKERR_TOO_FREQUENT_CALL` (`tooFrequent`)? | D1 | |
| MS12 | Zeigt der JM Switcher das transparente Ersatzbild durchsichtig, ohne Ruckler beim Formatwechsel? | C1 | |
| MS13 | Lücke beim Sprecherwechsel (`gapMs`), Wechsel pro Minute | D1 | |
| MS14 | Last je Stufe: Bridge-Anteil, Prozess, System, GPU, Speicher | K | |
| MS15 | Kosten der Vorschau (CPU an/aus); Verzögerung von Klick bis Kachel bei 9 Slots | K11, H1 | |
| MS16 | Hält die `persistentId` bei angemeldeten Zoom-Konten über Weggang und Wiederbeitritt (T62c)? | B2b | |
| MS17 | Verbindet der Switcher nach Entzug oder Wiederbeitritt (neuer Sender, gleicher Name) selbst neu? | J1, J2 | |
| MS18 | Laufen Bild und Ton von Sprecher- und Freigabe-Slot gleich (Mischton; kein Versatz bei Freigabe)? | D6, E4 | |
| MS19 | Kosten mehrere Slots auf dieselbe Person doppelt? | K12 | |
| MS20 | Was tut NDI mit zwei gleichnamigen Sendern (Slot und Browser-Gast; ST4 M8)? | L1 | |
| MS21 | Beliefert Zoom zwei Renderer auf dieselbe Kennung (VIDEO) bzw. dieselbe Freigabe (SHARE) zugleich? Je Slot Bild ja/nein, Bilder/s, B×H | B5 | |
| MS22 | Kommen die Sprecher-Signale ohne `JoinVoip`? | D5 | |
| MS23 | Welche Folge von Zustand und Typ meldet Zoom je Freigabe-Art (Bildschirm, Fenster, Whiteboard, reiner Computerton)? | E8, E1 | |
| MS24 | Was sagen `GetUserVideoSize`, die HD-Einstellungen und `recvResolution`/`recvFps` neben der gemessenen Größe (T62b)? | K, G2 | |
| MS25 | Kommt `onRendererBeDestroyed` bei Z10, Z11 oder Meeting-Ende (`rendererLost`)? | J2, J3, J4 | |
| MS26 | Welche Rückrufe kommen zwischen `DISCONNECTING` und `ENDED`? | J3 | |
| MS27 | Liefert `subscribe(SHARE)` bei `Sharing_Other_Share_Begin` sofort oder zuerst 29 (`noShareData`)? | E9 | |
| MS28 | Welche Kennung trägt der Freigabe-Ton (`shareAudioLastId`), gleich der `userid` aus `ZoomSDKSharingSourceInfo`? | E4 | |
| MS30 | Kommt das Programmbild nach Aus- und Wiedereinschalten des Switcher-NDI-Ausgangs ohne Handgriff zurück (NDI verbindet selbst neu)? Nach wie vielen Sekunden? | ND6 | |
| MS31 | Verbindet der JM Switcher nach dem Neustart eines Gast-Senders (neuer Prozess, gleicher NDI-Name) selbst neu? Nach wie vielen Sekunden? | ND3 | |
| MS32 | macOS 15: Fragt macOS nach dem Zugriff auf das lokale Netzwerk, und wann (erster Start, Öffnen des Raums)? Was zeigen Gastzeile, Programm-Abzeichen und Switcher, wenn der Zugriff fehlt? | ND9, ND10 | |
| MS33 | Welche Handgriffe verlangt macOS 15 beim ersten Start für das unsignierte DMG mit NDI, das der Launcher installiert hat? | ND9 | |
| MS34 | Zeigt eine laufende Bildschirm-Quelle bei 10 s unveränderter Folie T109 (liefert der Browser dann keine Bilder)? | ND14 | |
| MS35 | Welche Handlung am Gast-Gerät hält die Bilder an (Kamera im Browser stoppen, Netz 10 s trennen), und verlässt der Gast bei der Netztrennung den Raum? | ND2 | |
| MS36 | Hat ein eingelassener Gast ohne NDI-Quelle (T140) nach Entfernen und neuem Einladen wieder eine Quelle? | ND15 | |

Entfallen: **MS29** („Kommt `RawData_Off` innerhalb von `unSubscribe()` oder danach?“, Restrunde RR2).

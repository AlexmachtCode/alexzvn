# Connect 0.4.5: Hochkant-Zuschaltungen in 16:9 einpassen (#310) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neue Slot-Einstellung „Bildformat“ (`original` | `einpassen`): Im Modus „16:9 einpassen“ setzt die Bridge jedes Nicht-16:9-Bild eines Teilnehmer- oder Sprecher-Slots bilinear verkleinert/vergrößert mittig in einen 16:9-Rahmen der Slot-Auflösung, Ränder durchsichtig (UYVA); Ersatzbilder folgen derselben Einpassung; „Original“ bleibt bytegleich.

**Architecture:** Eine reine Kopfdatei `bild_einpassen.h` (Fläche, Achsen, Rahmen, Festkomma-Bilinear in YCbCr) wird dreimal benutzt: im Bild-Rückruf (SDK-Thread, eigener Live-Rahmen, ohne Warteschlange → `sendUYVA`), beim Ausgeben aus der Versatz-Warteschlange (`Bildart::Einpassen`: Rohbild + Zielrahmen, eingepasst außerhalb der Sender-Sperre durch den „Staffelhalter“) und im Ersatzbild-Herzschlag (Hauptthread, eigener Ersatz-Rahmen). Die Leitung bekommt das Feld `frame: 'native' | 'fit'` (auf `slotOn` optional), `slotStats` meldet `outW/outH`; Connect speichert `bildformat`, schickt es mit, zeigt es in den Einstellungen und in der Messzeile.

**Tech Stack:** C++17 (MSVC + g++ im CI; Zoom Meeting SDK 7.1.5.43953, NDI 6), TypeScript, Electron/React, tsx-Tests, Node-Selbsttests, CMake.

**Spec:** `docs/superpowers/specs/2026-11-17-connect-zoom-einpassen-design.md` (vom Owner freigegeben 17.11.2026, bindend). P = `packages/zoom-bridge`, C = `apps/connect`.

## Global Constraints

- Arbeitsordner JEDES Befehls: `C:/Users/alexk/alexzvn/.claude/worktrees/connect-einpassen-310` (Branch `feat/connect-310-einpassen`), immer mit großem `C:`. In Bash jede Kette mit `cd "C:/Users/alexk/alexzvn/.claude/worktrees/connect-einpassen-310" && …` beginnen; nie npm aus einem anderen Ordner (läuft sonst still in der Hauptkopie oder scheitert, vitest mit kleinem `c:` startet nicht). Vor Task 1 einmal `npm ci` im Worktree-Wurzelordner.
- `git add` nur mit expliziten Pfaden, einzeln; danach `git status --short` lesen (ein fehlender Pfad kippt den ganzen Befehl). Jede Commit-Nachricht endet mit Leerzeile + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Bridge bauen (Bash): `ZOOM_SDK_DIR='C:\Users\alexk\Documents\Jakobs Medien\Production Suite\SDKs\zoom-c-sharp-wrapper-7.1.5.43953' npm run rebuild -w @jm/zoom-bridge`; `NDI_SDK_DIR` ist gesetzt. Dieselbe Variable vor `slot-test`, `command-probe`, `bool-probe`, `kachel-probe`, `delay-probe`, `ndi-probe`.
- CI läuft Node 22 (tsx: typlose `.js` = CommonJS): neue Testhelfer nur als `.ts`/`.mjs`. Vor dem Abschluss beide Selbsttests zusätzlich mit Node 22 vorn im PATH (`/c/Users/alexk/AppData/Local/npm-cache/_npx/52027bd8fc0022aa/node_modules/node/bin`).
- Edit/Write dekodieren `\uXXXX` zu echten Zeichen: in Quelltext `\u{…}`/`\x..` oder das echte Zeichen schreiben.
- Werte: Connect `bildformat: 'original' | 'einpassen'` (Vorgabe `'original'`) → Leitung `frame: 'native' | 'fit'` → nativ `enum class Bildformat : uint8_t { Native, Fit }` mit `BILDFORMAT_NAMEN = {"native", "fit"}` (der Selbsttest A4 verlangt Aufzählungsnamen = Katalognamen). Neue Werte stehen HINTEN in Katalogen und Aufzählungen.
- „Original“ bytegleich wie origin/main bf45fba713: kein zusätzliches Kopieren, kein anderes Format, keine andere Größe; der Weg bleibt `sender.sendI420(buf, w, h)`.
- Einpassen nur, wenn `einpassenNoetig(fit, freigabe, w, h)`: Teilnehmer/Sprecher, nicht 16:9 innerhalb 1 % (`|w·9 − h·16| ≤ h·16/100`). Rahmen = Nennauflösung des Slots (640×360, 1280×720, 1920×1080); Fläche mittig, Breite/Höhe/linker Rand gerade; Ränder UYVY 128/16/128/16 + Alpha 0, Fläche Alpha 255; YCbCr bleibt (begrenzter Bereich), keine Farbumrechnung; bilinear in Festkomma.
- Die Einpassung blockiert nie einen Zoom-Rückruf: keine fremde Sperre während des Skalierens (die Sender-Sperre `mutex_` ist beim Skalieren offen, Rahmen nur per `try_lock`), kein Speicheranlegen pro Bild (Rahmen einmal mit `RAHMEN_MAX_BYTES` reserviert).
- NDI-Quellnamen bleiben; Umschalten wirkt per `slotSet` ohne Neuabo und ohne Umbenennen.
- Messgrenze der reinen Einpassung: Median ≤ 2 ms und 95. Perzentil ≤ 4 ms je Bild (720×1280 → 1920×1080 und 360×640 → 1280×720, je 500 Bilder, optimiert gebaut). Reißt sie: STOPP, Owner fragen (Ansatz 3, libyuv) – nicht weiterbauen.
- `bild_einpassen.h`: nur Standard-Header, keine Uhr (G-A2), kein `min`/`max` (wird nach `windows.h` eingebunden); Logik-Tests sauber unter `cl /W4 /WX` und `g++ -Wall -Werror` (Verengung nur mit `static_cast`, keine unbenutzten Hilfsfunktionen, kein signed/unsigned-Vergleich).
- `Slot::bildAnkunft` ruft keine `slot\w*(`-Funktion (Selbsttest AF4); neue Helfer heißen darum `eingepasstSenden`, `einfarbigeQuelle`, `kopieEingepasstSenden`.
- Neue `native/*_test.cpp`: drei Einträge – `TESTDATEIEN` in `scripts/logik-test.mjs`, CMake `add_executable(<name>-test native/<name>_test.cpp)` + `/utf-8`, Ziel und Programm im npm-Skript `slot-test`.
- Texte deutsch, Umlaute wörtlich, keine ASCII-Anführungszeichen in Nutzer- und Changelog-Texten („…“).
- Auslieferung NICHT Teil des Plans: nur Version 0.4.5 + Changelog-Entwurf zur Owner-Freigabe. Release erst nach Testmeeting, während COP31 nur 18–06 Uhr Berlin oder an einem vom Owner genannten Off-Tag.

## Review Focus

1. Handy dreht, während der Bild-Versatz läuft → rohe und einzupassende Bilder bleiben in Ankunftsreihenfolge, keins doppelt oder verloren, kein Thread wartet auf eine Einpassung. Tests: Task 3 `test_einpassen_reihenfolge_310`, `test_entnehmen_wie_release_310`; Task 9 `ndi-probe` (Versatz-Weg).
2. Slot-Auflösung ändert sich mitten in eingepassten Bildern (720p → 1080p und zurück) → nächstes Bild im neuen Rahmen, keine Reste der alten Fläche in den Rändern, kein Neuanlegen des Puffers. Test: Task 1 `t_rahmen_wechsel`.
3. Bildformat wechselt während eines Aussetzers → das nächste Ersatzbild folgt der neuen Einstellung (Spec „Für den Bau offen“). Tests: Task 1 `t_einpassen_noetig`; Task 5 Wächter „Entscheidung je Herzschlag aus `s.format.load()`“.
4. 16:9-nahe, ungerade oder winzige Größen (1920×1088, 721×1281, 1×1) → 16:9-nahe gehen unverändert, sonst gerade Fläche, nie Lesen hinter dem Puffer, nie Absturz. Tests: Task 1 `t_ist16zu9`, `t_bild_flaeche_invarianten`, `t_ungerade_quelle`, `t_zu_klein`.
5. Freigabe-Slot mit gespeichertem „einpassen“ (auch nach Moduswechsel) → nie eingepasst, Feld ausgegraut mit Hinweis. Tests: Task 1 `t_einpassen_noetig` (Freigabe → nie); Task 4 Wächter (`mode.load() == SlotMode::Share` in der Entscheidung); Task 5 Wächter `case Sent::Held`; Task 8 UI-Wächter.

## Präzisierungen gegenüber dem Entwurf (vom Plan entschieden)

1. Aufzählung `Bildformat { Native, Fit }` statt `{ Original, Einpassen }` – Selbsttest A4 (`test/selftest.ts:3200-3220`) gleicht Aufzählungsnamen mit dem Katalog ab.
2. Fehlerschlüssel `slotBadFrame` (`SLOT_BAD_FRAME`), Muster `slotBad…`; Prüfstelle direkt nach `slotBadFallback`.
3. Die Spec-Methode `sendUyvaBild` ist die vorhandene, bisher ungenutzte `NdiSender::sendUYVA` (gleiche Bedeutung: direkt über `fillFrameUyva`); keine zweite Methode.
4. Warteschlangen-Art heißt `Bildart::Einpassen` (Rohbild I420 + `rahmenW/rahmenH`); das „`Bildart::Uyva`“ im Spec-Abschnitt „Prüfen“ ist diese Art.
5. Ausgeben mit Einpassen: Fällige Bilder werden nicht nur in `pump` (Hauptthread), sondern auch beim Einreihen (SDK-Thread) ausgegeben. Darum hält der Sender EINEN Ausgaberahmen, den nur der „Staffelhalter“ (`ausgabeLaeuft_`) benutzt: entnehmen unter `mutex_`, einpassen ohne `mutex_`, senden unter `mutex_`; wer die Staffel nicht hat, reiht nur ein. Reihenfolge bleibt, niemand wartet.
6. Ersatzbilder entscheiden je Herzschlag aus aktueller Einstellung + Zooms letzter Größe (nicht aus `ausgabeW`); ein Wechsel im Aussetzer wirkt beim nächsten Ersatzbild. Rahmen = Nennauflösung wie beim Livebild.
7. Schwarz/Weiß eingepasst: einfarbige I420-Quelle in Zooms Größe, Ergebnis im Ersatz-Rahmen zwischengespeichert (Schlüssel `inhalt`); Kachel und eingefroren werden je Herzschlag (100 ms) neu eingepasst.
8. `slotStats.outW/outH` nur, wenn im Fenster ein Bild kam UND das letzte eingepasst war (`ausgabe ≠ lastW/lastH`).
9. Messzeile: die bestehende Regel T51 bleibt – „1080p gewünscht · Zoom liefert 720×1280 · 23,5 Bilder/s · NDI 1920×1080 eingepasst“ (das Spec-Beispiel ohne „gewünscht“ widerspräche T51).
10. Neue Texte tragen `#310` statt T-Nummer (T133–T139 belegt die NDI-Spec 22; Muster #287/#306).
11. Zeitmessung: `node scripts/logik-test.mjs --messung` (npm `einpassen-messung`), mit `-O2` bzw. `/O2`; nicht im CI (der CI-Rechner ist kein Show-Rechner).
12. Connect schickt `frame` in jedem `slotOn` (direkt nach `fallback`), auch bei Freigabe (die Bridge ignoriert es dort).
13. Live-Rahmen per `try_lock`: Kommt ein zweiter Rückruf desselben Slots gleichzeitig (Threadfrage E15 offen), geht dessen Bild über `sendI420Einpassen` (Ausgaberahmen des Senders), nie wartend.
14. Alpha 255 der Fläche schreibt `rahmenVorbereiten` (nur bei Geometriewechsel); `einpassen` schreibt nur die UYVY-Werte der Fläche.
15. Oberfläche: Hinweis als Tooltip des Felds; im Modus Freigabe Feld gesperrt und Hinweis sichtbar daneben.
16. Handbuch `tool-jm-connect.md` bekommt die Einstellung (Spec schweigt; jede Slot-Einstellung steht dort).

## Dateien

| Datei | Aufgabe |
|---|---|
| P `native/bild_einpassen.h` (neu), `native/bild_einpassen_test.cpp` (neu), `native/bild_einpassen_messung.cpp` (neu) | reine Einpassung, Logik-Test, Zeitmessung |
| P `scripts/logik-test.mjs`, `CMakeLists.txt`, `package.json` | Testdatei, Schalter `--messung`, CMake-Ziel, `slot-test`, `einpassen-messung` |
| P `src/protocol.ts`, `src/index.ts`, `README.md` | `SLOT_FRAMES`, `frame`, `slotBadFrame`, `outW/outH` |
| P `native/slot_logic.h`, `native/slot_logic_test.cpp` | `Bildformat`, `BILDFORMAT_NAMEN`, `ZielStand::ausgabeW/H` |
| P `native/main.cpp`, `native/video.h` | Lesen von `frame`, „Felder gelesen“, `--ndi-selftest` |
| P `native/delay_line.h`, `native/delay_line_test.cpp` | `Bildart::Einpassen`, `pushEinpassen`, `entnehmen`, `zuruecklegen` |
| P `native/ndi_sender.h/.cpp` | `direktFrei`, `sendI420Einpassen`, Staffel in `releaseDueLocked`, `speicherBytes` |
| P `native/video.cpp` | `Slot::format`, atomares `res`, Live-/Ersatz-Rahmen, `eingepasstSenden`, Ersatzbilder, `slotStats` |
| P `test/selftest.ts`, `test/fake-bridge.mjs`, `test/slot-pruefung-faelle.json`, `test/command-probe.mjs`, `test/ndi-probe.mjs` | Wächter, Attrappe, Fälle, Prüfstände |
| C `src/shared/types.ts`, `src/main/zoom/{einstellungen,slot-eingabe,slots,kern,klartext}.ts` | Einstellung, Abbildung, Weitergabe, Fehlertext, Messzeile |
| C `src/shared/zoom-text.ts`, `src/renderer/src/zoom/SlotEinstellungen.tsx` | Texte, Auswahlfeld |
| C `test/{zoom-teile,zoom-settings,zoom-slots-abgleich,zoom-slots,zoom-text}.test.ts` | Feldzahl 11 → 12, Abbildung, Umschalten, Messzeile, Texte |
| `packages/cookbook/content/tool-manuals/tool-jm-connect.md`, `packages/cookbook/cookbook.json`, C `package.json`, `package-lock.json` | Handbuch, Version 0.4.5 |

---

### Task 1: Reine Einpassung `bild_einpassen.h` mit Logik-Test und Zeitmessung

**Files:**
- Create: `packages/zoom-bridge/native/bild_einpassen.h`, `packages/zoom-bridge/native/bild_einpassen_test.cpp`, `packages/zoom-bridge/native/bild_einpassen_messung.cpp`
- Modify: `packages/zoom-bridge/scripts/logik-test.mjs:29` (TESTDATEIEN, Schalter `--messung`), `packages/zoom-bridge/CMakeLists.txt` (Ende), `packages/zoom-bridge/package.json` (`slot-test`, neues `einpassen-messung`), `packages/zoom-bridge/test/selftest.ts:3238` (G-A2-Liste)

**Interfaces:**
- Consumes: nichts.
- Produces (Namensraum `einpass`, alles `inline`):
  - `struct Rechteck { int x = 0, y = 0, w = 0, h = 0; };` mit `operator==`/`operator!=`
  - `struct Stelle { int32_t i0 = 0; int32_t i1 = 0; uint32_t f = 0; };` – Quellindex links/oben, rechts/unten, Gewicht von `i1` in 1/256
  - `struct Rahmen { std::vector<uint8_t> daten; int W = 0, H = 0; Rechteck flaeche{}; uint32_t inhalt = 0; int quelleW = 0, quelleH = 0; std::vector<Stelle> yx, yy, cx, cy; };` – `daten` = UYVA W×H: UYVY-Ebene `W·H·2` (Zeilenabstand `2·W`), direkt dahinter Alpha `W·H`
  - `inline constexpr int RAHMEN_MAX_W = 1920, RAHMEN_MAX_H = 1080; inline constexpr size_t RAHMEN_MAX_BYTES = 1920u * 1080u * 3u;`
  - `size_t i420Bytes(int w, int h)` → `w·h + 2·(w/2)·(h/2)`, 0 bei `w ≤ 0 || h ≤ 0`; `size_t uyvaBytes(int W, int H)` → `W·H·3`
  - `bool ist16zu9(int w, int h)`; `bool einpassenNoetig(bool fitGewaehlt, bool freigabe, int w, int h)` → `fitGewaehlt && !freigabe && w > 0 && h > 0 && !ist16zu9(w, h)`
  - `Rechteck bildFlaeche(int w, int h, int W, int H)`; `void achse(int quelle, int ziel, std::vector<Stelle>& aus)`
  - `void rahmenVorbereiten(Rahmen& r, int W, int H, Rechteck flaeche)`; `void einpassen(const uint8_t* i420, int w, int h, Rahmen& r)`
  - `void einfarbigI420(std::vector<uint8_t>& aus, int w, int h, uint8_t y, uint8_t u, uint8_t v)`; `size_t speicherBytes(const Rahmen& r)`

- [ ] **Step 1: Failing test schreiben** – `native/bild_einpassen_test.cpp` nach dem Muster `kachel_logik_test.cpp` (`CHECK`-Makro, Summenzeile `"%d Pruefungen, %d gefallen."`, Rückgabe 0/1). Hilfen im Test: `uyvy(r, x, y)` liefert `{U, Y, V}` des Bildpunkts (U/V des Paars), `alpha(r, x, y)`. Prüfungen:

```cpp
void t_ist16zu9() {
  CHECK(ist16zu9(640, 360) && ist16zu9(1280, 720) && ist16zu9(1920, 1080) && ist16zu9(1920, 1088));
  CHECK(ist16zu9(176, 100) && ist16zu9(179, 100) && !ist16zu9(175, 100) && !ist16zu9(180, 100));   // Grenze 1 %
  CHECK(!ist16zu9(720, 1280) && !ist16zu9(1280, 800) && !ist16zu9(640, 480));
  CHECK(!ist16zu9(0, 0) && !ist16zu9(16, 0) && !ist16zu9(-16, -9));
}
void t_einpassen_noetig() {
  CHECK(einpassenNoetig(true, false, 720, 1280));
  CHECK(!einpassenNoetig(false, false, 720, 1280) && !einpassenNoetig(true, true, 720, 1280));   // Original, Freigabe
  CHECK(!einpassenNoetig(true, false, 1280, 720) && !einpassenNoetig(true, false, 0, 0));
}
void t_bild_flaeche() {
  CHECK(bildFlaeche(720, 1280, 1920, 1080) == (Rechteck{656, 0, 608, 1080}));
  CHECK(bildFlaeche(360, 640, 1280, 720) == (Rechteck{436, 0, 406, 720}));
  CHECK(bildFlaeche(360, 640, 640, 360) == (Rechteck{218, 0, 202, 360}));
  CHECK(bildFlaeche(640, 480, 1920, 1080) == (Rechteck{240, 0, 1440, 1080}));
  CHECK(bildFlaeche(2560, 1080, 1920, 1080) == (Rechteck{0, 135, 1920, 810}));
  CHECK(bildFlaeche(721, 1281, 1920, 1080) == (Rechteck{656, 0, 608, 1080}));
  CHECK(bildFlaeche(0, 1280, 1920, 1080) == Rechteck{} && bildFlaeche(720, 1280, 0, 0) == Rechteck{});
}
// Für w, h in 2..2000 (Schritt 37) und jeden Rahmen 640×360, 1280×720, 1920×1080:
// x, w, h gerade; 0 ≤ x, x + fw ≤ W; 0 ≤ y, y + fh ≤ H; 0 ≤ (W − fw − x) − x ≤ 2; H − fh − y == y;
// fw == W oder fh == H; |fw·h − fh·w| ≤ max(w, h).
void t_bild_flaeche_invarianten();
void t_achse() {   // s = std::vector<Stelle>
  achse(4, 2, s); CHECK(s.size() == 2 && s[0].i0 == 0 && s[0].i1 == 1 && s[0].f == 128 && s[1].i0 == 2 && s[1].i1 == 3 && s[1].f == 128);
  achse(2, 4, s); CHECK(s[0].i0 == 0 && s[0].f == 0 && s[1].i0 == 0 && s[1].i1 == 1 && s[1].f == 64 && s[2].f == 192
                        && s[3].i0 == 1 && s[3].i1 == 1 && s[3].f == 0);
  achse(3, 3, s); CHECK(s[0].i0 == 0 && s[1].i0 == 1 && s[2].i0 == 2 && s[2].i1 == 2 && s[0].f + s[1].f + s[2].f == 0);
  achse(1, 3, s); // alle i0 == i1 == 0, f == 0
}
void t_rahmen_raender();   // rahmenVorbereiten(r, 1920, 1080, {656,0,608,1080}): daten.size() == 1920*1080*3;
                           // uyvy(0,0) == {128,16,128}; alpha(0,540) == 0, alpha(655,540) == 0, alpha(656,540) == 255,
                           // alpha(1263,540) == 255, alpha(1264,540) == 0, alpha(1919,1079) == 0;
                           // nach einpassen eines Bildes: Randbildpunkte unverändert {128,16,128}, Alpha 0
void t_farbtreue();        // einfarbigI420(q, 720, 1280, 81, 90, 240) → jeder Flächenpunkt {U 90, Y 81, V 240}, 0 Abweichungen;
                           // dasselbe für 360×640 → 1280×720
void t_identitaet();       // Quelle 608×1080 mit Y[x,y] = (x*7 + y*3) & 0xFF in 1920×1080: Fläche {656,0,608,1080},
                           // Y der Fläche == Quelle Bildpunkt für Bildpunkt
void t_verkleinern_glaettet();   // 720×1280 mit Y-Spalten abwechselnd 16/235: mehr als 1/4 der Flächen-Y liegt echt
                                 // zwischen 16 und 235 (bilinear, keine Pixelwahl)
void t_vergroessern_rampe();     // 360×640, Y(x) = 16 + 219*x/359: Zeile 360 der Fläche steigt nie ab, erster Wert ≤ 18, letzter ≥ 233
void t_ungerade_quelle();        // 361×641 einfarbig (50/100/200) in einem Puffer i420Bytes(361,641) + 4096 Byte 0 dahinter:
                                 // jeder Flächenpunkt genau 50/100/200 (nichts hinter dem Puffer gelesen); Fläche gerade
void t_zu_klein();               // einpassen mit w = 1 oder h = 1 oder i420 = nullptr: daten unverändert (Vergleich mit Kopie)
void t_rahmen_wechsel();         // erst 1920×1080 mit Fläche für 720×1280 (einfarbig Y 200 eingepasst), dann
                                 // rahmenVorbereiten(r, 1280, 720, bildFlaeche(360,640,1280,720)): daten.data() unverändert,
                                 // size == 1280*720*3, alpha(435,360) == 0, alpha(436,360) == 255, uyvy(435,360) == {128,16,128}
void t_inhalt();                 // r.inhalt = 7; gleiche Geometrie erneut → 7; andere Geometrie → 0
void t_speicher();               // speicherBytes(Rahmen{}) == 0; nach erstem rahmenVorbereiten ≥ RAHMEN_MAX_BYTES
void t_einfarbig();              // einfarbigI420(v, 4, 2, 16, 128, 128): size 12, v[0..7] == 16, v[8..11] == 128;
                                 // (3, 3): size 11
```

Dazu in derselben Änderung: `'native/bild_einpassen_test.cpp'` an `TESTDATEIEN` anhängen; CMake `add_executable(bild-einpassen-test native/bild_einpassen_test.cpp)` + `target_compile_options(bild-einpassen-test PRIVATE /utf-8)`; im npm-Skript `slot-test` ` bild-einpassen-test` an die `--target`-Liste und `&& build\\Release\\bild-einpassen-test.exe` ans Ende; in `selftest.ts:3238` `'bild_einpassen.h'` an die G-A2-Liste.

- [ ] **Step 2: Rot bestätigen**

Run: `npm run logik-test -w @jm/zoom-bridge`
Expected: `logik-test: bild_einpassen_test.cpp: Übersetzen gescheitert` (Header fehlt), Rückgabe 1.

- [ ] **Step 3: `native/bild_einpassen.h` umsetzen** (Signaturen oben). Festgelegte Rechnung:

```text
ist16zu9:   w > 0 && h > 0 && |w·9 − h·16| · 100 ≤ h·16          (int64)
bildFlaeche (int64-Produkte; ungültige Maße → Rechteck{}):
  höhenbegrenzt (w·H < W·h): fh = H & ~1;  fw = 2·⌊(H·w + h) / (2·h)⌋
  sonst:                     fw = W & ~1;  fh = 2·⌊(W·h + w) / (2·w)⌋
  fw auf [2, W & ~1], fh auf [2, H & ~1] begrenzen;  x = ((W − fw) / 2) & ~1;  y = (H − fh) / 2
achse(quelle ≥ 1, ziel ≥ 1)  – Mittenpunkt-Abbildung in 16.16:
  schritt = (quelle << 16) / ziel;  p(d) = schritt/2 − 32768 + d·schritt   (int64)
  p auf [0, (quelle − 1) << 16] klemmen;  i0 = p >> 16;  f = (p >> 8) & 255;  i1 = (i0 + 1 < quelle) ? i0 + 1 : quelle − 1
Bildpunkt (uint32):  oben  = q[i0y][i0x]·(256 − fx) + q[i0y][i1x]·fx
                     unten = q[i1y][i0x]·(256 − fx) + q[i1y][i1x]·fx
                     wert  = (oben·(256 − fy) + unten·fy + 32768) >> 16
einpassen (nur wenn i420, w ≥ 2, h ≥ 2, flaeche.w/h ≥ 2, daten.size() == uyvaBytes(W,H); sonst nichts schreiben):
  Achsen neu nur bei (w,h) ≠ (quelleW,quelleH): yx = achse(w, fw), yy = achse(h, fh),
  cx = achse(w/2, fw/2), cy = achse(h/2, fh)   (4:2:0 → 4:2:2: Chroma je Ausgabezeile abgetastet)
  Ebenen: Y bei 0 (Abstand w), U bei w·h (Abstand w/2, h/2 Zeilen), V bei w·h + (w/2)·(h/2)
  Ziel: Zeile (y + oy), Byte (x + ox)·2 + 1 = Y; je Paar j: Byte (x + 2j)·2 = U, +2 = V; Alpha nicht anfassen
rahmenVorbereiten: nur wenn W, H oder flaeche anders: daten.reserve(max(RAHMEN_MAX_BYTES, uyvaBytes)) beim ersten Mal,
  yx/cx.reserve(RAHMEN_MAX_W), yy/cy.reserve(RAHMEN_MAX_H); resize(uyvaBytes); UYVY ganz 128/16/128/16, Alpha 0,
  Alpha der Fläche 255; W/H/flaeche merken; inhalt = 0; quelleW = quelleH = 0
speicherBytes = daten.capacity() + (yx, yy, cx, cy).capacity() · sizeof(Stelle)
```

`min`/`max` nicht verwenden (Bedingungsausdrücke); `<cstddef>`, `<cstdint>`, `<vector>` reichen.

- [ ] **Step 4: Grün bestätigen**

Run: `npm run logik-test -w @jm/zoom-bridge` und `npm run selftest -w @jm/zoom-bridge`
Expected: `logik-test: bild_einpassen_test.cpp: <n> Pruefungen, 0 gefallen. (Rückgabe 0)`, alle übrigen Dateien unverändert grün; `Alle Selbsttests bestanden.`

- [ ] **Step 5: Zeitmessung schreiben** – `native/bild_einpassen_messung.cpp` (eigenes `main`, `<chrono>` erlaubt, kein `_test.cpp`): Quellen mit Verlauf (nicht einfarbig), je Fall `rahmenVorbereiten` einmal, 20 Bilder Anlauf, dann 500-mal nur `einpassen` mit `steady_clock` gemessen; Median = sortiert[250], P95 = sortiert[475]; Prüfsumme der Ausgabe drucken (sonst optimiert der Compiler die Arbeit weg); je Fall die Zeile `Messung 720x1280 -> 1920x1080: Median %.2f ms, P95 %.2f ms (Grenze 2 / 4 ms)`, `CHECK(median <= 2.0)`, `CHECK(p95 <= 4.0)`, Summenzeile wie oben. In `logik-test.mjs`: `--messung` übersetzt statt `TESTDATEIEN` nur `native/bild_einpassen_messung.cpp`, zusätzlich `-O2` (g++/clang++) bzw. `/O2` (cl), sonst gleicher Ablauf und gleiche Auswertung; npm-Skript `"einpassen-messung": "node scripts/logik-test.mjs --messung"`. Selbsttest: `scripts['einpassen-messung'] === 'node scripts/logik-test.mjs --messung'` und `logik-test.mjs` enthält `'native/bild_einpassen_messung.cpp'`.

- [ ] **Step 6: Messen (Tor)**

Run: `npm run einpassen-messung -w @jm/zoom-bridge`
Expected: zwei `Messung …`-Zeilen, `4 Pruefungen, 0 gefallen.`, Rückgabe 0. Beide Zeilen wörtlich in den Commit-Text übernehmen. Rot → STOPP, Zahlen an den Owner (Ansatz 3).

- [ ] **Step 7: Commit**

```bash
git add packages/zoom-bridge/native/bild_einpassen.h
git add packages/zoom-bridge/native/bild_einpassen_test.cpp
git add packages/zoom-bridge/native/bild_einpassen_messung.cpp
git add packages/zoom-bridge/scripts/logik-test.mjs
git add packages/zoom-bridge/CMakeLists.txt
git add packages/zoom-bridge/package.json
git add packages/zoom-bridge/test/selftest.ts
git status --short
git commit -m "feat(zoom-bridge): reine 16:9-Einpassung mit Logik-Test und Zeitmessung (#310)" -m "<die zwei Messzeilen>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Leitungsfeld `frame` und Fehlerschlüssel `slotBadFrame` (Protokoll, Attrappe, nativ, Connect-Fehlertext)

**Files:**
- Modify: P `src/protocol.ts:71,141-185,208-231`, `src/index.ts:21,41`, `test/fake-bridge.mjs:19,125-155,~815,~842`, `test/slot-pruefung-faelle.json`, `test/selftest.ts` (2601, 2626, 2643-2653, 2729-2733, 2789-2791, 3202-3213, 3751), `test/command-probe.mjs:98-123`, `native/slot_logic.h:24-80`, `native/slot_logic_test.cpp` (`a4_namen`), `native/video.h:37-59`, `native/main.cpp:260-340`, `native/video.cpp:136,1782-1786,1839`, `README.md:306-307,694`
- Modify: C `src/main/zoom/klartext.ts:407`, `src/main/zoom/kern.ts:324-327`, `test/zoom-text.test.ts:1008-1015`

**Interfaces:**
- Consumes: nichts.
- Produces: `export const SLOT_FRAMES = ['native', 'fit'] as const; export type SlotFrame` (aus `src/protocol.ts` und `src/index.ts`); Command `slotOn { …; fallback: SlotFallback; frame?: SlotFrame; showNoVideo: boolean }`, `slotSet { …; frame?: SlotFrame }`; `SlotFehler` enthält `'slotBadFrame'` (22 Schlüssel); `slotlogic::Bildformat { Native, Fit }`, `BILDFORMAT_NAMEN[2]`, `name(Bildformat)`; `SlotBefehl::frame`, `SlotAenderung::{frameGesetzt, frame}`; `Slot::format` (`std::atomic<Bildformat>`, Vorgabe `Native`).

- [ ] **Step 1: Failing tests schreiben**
  - `slot-pruefung-faelle.json` (Zeile = voller gültiger slotOn der Tabelle mit Änderung): „frame fit ist gültig“ (`"frame":"fit"` → `slotNoPrivilege`, mitSlot, stderr true); „frame native ist gültig“ (dito); „frame unbekannt (quer)“ → `slotBadFrame`, mitSlot, stderr false; „frame als Zahl“ (`"frame":1`) → `slotBadFrame`; „erster Fehler gewinnt: fallback und frame falsch → slotBadFallback“; „erster Fehler gewinnt: frame und Schalter falsch → slotBadFrame“ (`"frame":"quer"`, `"shareAudio":"ja"`); „slotSet frame unbekannt → slotBadFrame“ (`{"cmd":"slotSet","slot":6,"frame":"quer"}`); „slotSet frame fit ohne laufenden Slot → slotNotOn“. Die Zeilen ohne `frame` bleiben unverändert gültig (Beleg: optional).
  - `selftest.ts`: `assert(liste(SLOT_FRAMES) === 'native,fit', 'A1 #310: SLOT_FRAMES native, fit')` (Import in 2601); 2643/2653 `21` → `22` samt Text; PT4 `paket.SLOT_FRAMES === SLOT_FRAMES`; A2-Paare `['SLOT_FRAMES', SLOT_FRAMES]`; A4-Paare `['Bildformat', 'BILDFORMAT_NAMEN', 'SLOT_FRAMES', protokollA4.SLOT_FRAMES]`; Prüffolge 3751 `'"slotBadFrame"'` zwischen `'"slotBadFallback"'` und `'"slotBadFlag"'`.
  - `slot_logic_test.cpp` `a4_namen`: `CHECK(gleich(name(Bildformat::Native), "native")); CHECK(gleich(name(Bildformat::Fit), "fit"));`
  - `command-probe.mjs`: in jeder erwarteten Zeile `Felder gelesen: slotOn …` nach `Ersatzbild <wert>` den Teil `, Format native` einfügen; der slotSet-Fall 9 sendet zusätzlich `frame: 'fit'` und erwartet `… Ersatzbild black, Format fit, Computerton nein, …`; neuer Fall `vollerSlotOn(11, { frame: 'fit' })` → `'Felder gelesen: slotOn 11, Aufloesung 720p, Ersatzbild transparent, Format fit, Computerton ja, ohne Kamera ja, Ziel 42'`.
  - Connect `zoom-text.test.ts`: `ERWARTET` + `slotBadFrame: T103`; `21` → `22`.

- [ ] **Step 2: Rot bestätigen**

Run: `npm run selftest -w @jm/zoom-bridge`
Expected: `FEHLGESCHLAGEN`-Zeilen zu `SLOT_FRAMES`, 22 Schlüsseln, `BILDFORMAT_NAMEN` und den neuen Tabellenfällen; `… Selbsttest(s) fehlgeschlagen.`

- [ ] **Step 3: Umsetzen**
  - `protocol.ts`: `SLOT_FRAMES`/`SlotFrame` nach `SLOT_FALLBACKS` (Kommentar: nur Teilnehmer/Sprecher, bei share ohne Wirkung, auf slotOn optional, fehlt = native); `'slotBadFrame'` direkt nach `'slotBadFallback'` in `SLOT_ERROR_KEYS`, `slotBadFrame: 'SLOT_BAD_FRAME'`; Felder in beiden Commands; Prüffolge-Kommentar Nr. 4: „frame vorhanden, aber unlesbar oder unbekannt → slotBadFrame (fehlt = native)“. `index.ts` exportiert `SLOT_FRAMES` und `type SlotFrame`.
  - `fake-bridge.mjs`: `const SLOT_FRAMES = ['native', 'fit'];` nach `SLOT_FALLBACKS`; `AUSWAHLFELDER` bekommt ein viertes Element `optional` und den Eintrag `['frame', SLOT_FRAMES, 'slotBadFrame', true]` nach `fallback`; in `pruefeFelder` `if (f.art === 'fehlt' && (!pflicht || optional)) continue;`; `slotOn` legt `frame: 'native'` vor `...werte` an; `slotSet` übernimmt `w.frame`. Kopfdoku um `frame` ergänzen.
  - `slot_logic.h`: `enum class Bildformat : uint8_t { Native, Fit };  // SLOT_FRAMES (#310)`, `BILDFORMAT_NAMEN[2] = {"native", "fit"}`, `static_assert(… Fit) + 1 == 2, "BILDFORMAT_NAMEN")`, `name(Bildformat)`.
  - `video.h`: `slotlogic::Bildformat frame = slotlogic::Bildformat::Native;` in `SlotBefehl` (nach `fallback`); `bool frameGesetzt = false; slotlogic::Bildformat frame = …;` in `SlotAenderung`.
  - `main.cpp` slotOn: nach der Fallback-Zeile `if (leseName(line, "frame", slotlogic::BILDFORMAT_NAMEN, &b.frame) == Lesung::Schlecht) { emitSlotFehler("slotBadFrame", nr); return; }` (Fehlt = Native); „Felder gelesen“ nach `Ersatzbild …` um `L", Format " + breit(slotlogic::BILDFORMAT_NAMEN[…])`. slotSet: dasselbe Lesen nach `fallback` mit `a.frameGesetzt`, Logteil nur wenn gesetzt, an derselben Stelle.
  - `video.cpp`: `std::atomic<Bildformat> format{Bildformat::Native};` nach `fallback` (Zeile 136); slotOn `s.format = b.frame;`; slotSet `if (a.frameGesetzt) s.format = a.frame;` direkt nach der Fallback-Zeile (kein Umhängen). Noch ohne Wirkung auf das Bild.
  - Connect `klartext.ts`: `slotBadFrame: (e) => SLOT_KT.T103(e.name),` nach `slotBadFallback`; `kern.ts` `AUFBAU_FEHLER` + `'slotBadFrame'`.
  - `README.md` P: Zeile `slotOn`/`slotSet` um `frame` (`native`/`fit`, optional, fehlt = `native`, #310), Fehlertabelle `slotBadFrame` in die Zeile mit `slotBadFallback`.

- [ ] **Step 4: Grün bestätigen**

Run: `npm run selftest -w @jm/zoom-bridge`, `npm run logik-test -w @jm/zoom-bridge`, `npm run typecheck -w @jm/zoom-bridge`, `npm run typecheck -w @jm/connect`, `npm run selftest -w @jm/connect`
Expected: `Alle Selbsttests bestanden.`, `Alle Auslieferungs-Tests bestanden.`; alle logik-test-Dateien `0 gefallen`; beide Typprüfungen ohne Ausgabe; jede Connect-Testdatei `… ok, 0 fehlgeschlagen.`

- [ ] **Step 5: Nativ gegenprüfen** – Bridge bauen (Global Constraints), dann `ZOOM_SDK_DIR='…' npm run command-probe -w @jm/zoom-bridge` und `ZOOM_SDK_DIR='…' npm run bool-probe -w @jm/zoom-bridge`
Expected: `OK — alle <n> Faelle des nativen Befehlslesers wie erwartet`; bool-probe ohne `FEHLGESCHLAGEN`.

- [ ] **Step 6: Commit** – die oben genannten Dateien einzeln stagen, `git status --short`, Nachricht `feat(zoom-bridge): Feld frame (native/fit) an slotOn/slotSet, Fehler slotBadFrame (#310)`.

---

### Task 3: Warteschlange und Sender – `Bildart::Einpassen`, Staffel, Einpassen außerhalb der Sperre

**Files:**
- Modify: P `native/delay_line.h:15,78-85,100-160`, `native/delay_line_test.cpp`, `native/ndi_sender.h`, `native/ndi_sender.cpp:139-164,205-260,268-325`, `test/selftest.ts:3518-3550`

**Interfaces:**
- Consumes: Task 1 `einpass::rahmenVorbereiten`, `bildFlaeche`, `einpassen`, `i420Bytes`, `speicherBytes`, `Rahmen`.
- Produces:
  - `enum class Bildart : uint8_t { I420, Schwarz, Weiss, Transparent, Kachel, Einpassen };` – `Frame` + `int rahmenW = 0, rahmenH = 0;` (nur bei `Einpassen`)
  - `int DelayLine::pushEinpassen(const uint8_t* buf, size_t len, int w, int h, int rahmenW, int rahmenH, TimePoint arrival)` – Kopie aus dem Vorrat wie `pushFrame`; `rahmenW/H ≤ 0` → 0, nichts abgelegt; `pushBild(Bildart::Einpassen, …)` legt nichts ab
  - `Released DelayLine::entnehmen(TimePoint now, std::chrono::milliseconds delay, std::vector<Frame>& aus)` – dieselbe Fälligkeits- und Schwallregel wie `release` (ein privater Helfer für beide), hängt die auszugebenden Bilder in Reihenfolge an `aus` (muss leer sein)
  - `void DelayLine::zuruecklegen(std::vector<Frame>& aus)` – Puffer in den Vorrat (Deckel `kMaxSpare`), `aus` danach leer
  - `bool NdiSender::direktFrei()` – unter `mutex_`: `send_ && (ohneVersatz_ || (versatzMsLocked() == 0 && delay_.size() == 0 && !ausgabeLaeuft_))`
  - `void NdiSender::sendI420Einpassen(const uint8_t* i420, int w, int h, int rahmenW, int rahmenH)` – immer in die Warteschlange (`pushEinpassen`, Länge `einpass::i420Bytes`), `letzteBildBytes_` nachführen, dann ausgeben
  - `NdiSender::sendUYVA(const uint8_t*, int, int)` (vorhanden) = Direktweg des Rahmens; Kommentar auf #310 nachziehen
  - privat: `int releaseDueLocked(std::unique_lock<std::mutex>& lock, bool nachlauf)`, `bool ausgabeLaeuft_ = false;`, `std::vector<DelayLine::Frame> faellig_;`, `einpass::Rahmen ausgabeRahmen_;`, `size_t ausgabeRahmenBytes_ = 0;` (unter `mutex_`)

- [ ] **Step 1: Failing tests schreiben** (`delay_line_test.cpp`, in `main` eintragen; Hilfe `einpassBild(d, kennung, ms)` = `pushEinpassen(bild(k).data(), kLen, kW, kH, 16, 9, at(ms))`)
  - `test_einpassen_traegt_rahmen_310`: nach Push und `release(at(100), 0ms, …)` sieht die Senke `art == Bildart::Einpassen`, `w == 4`, `h == 2`, `rahmenW == 16`, `rahmenH == 9`, `data[0] == kennung`; eine Änderung am Quellpuffer nach dem Push ändert das Bild nicht (Kopie).
  - `test_einpassen_nur_ueber_pusheinpassen_310`: `pushBild(Bildart::Einpassen, 4, 2, at(0)) == 0`, `pushEinpassen(…, 0, 9, …) == 0`, `size() == 0`.
  - `test_einpassen_reihenfolge_310`: I420(1), Einpassen(2), Schwarz → `entnehmen(at(500), 100ms, aus)` → Kennungen `{1, 2, 0xFF}`, `r.sent == 3`, `r.dropped == 0`; danach Einpassen(3), I420(4) → `{3, 4}`.
  - `test_entnehmen_wie_release_310`: zwei gleich gefüllte Leitungen (10 fällige Bilder + eines bei 900 ms): `release` und `entnehmen` liefern dieselbe Kennung `{10}`, `sent 1`, `dropped 9`; in beiden wartet das späte Bild (`size() == 1`).
  - `test_zuruecklegen_fuellt_vorrat_310`: zwei Bilder mit Daten + ein Schwarz entnommen, `zuruecklegen` → `spareBuffers() == 2`, `aus.empty()`.

- [ ] **Step 2: Rot bestätigen**

Run: `npm run logik-test -w @jm/zoom-bridge`
Expected: `logik-test: delay_line_test.cpp: Übersetzen gescheitert` (`pushEinpassen`, `entnehmen`, `Bildart::Einpassen` unbekannt).

- [ ] **Step 3: `delay_line.h` umsetzen** (Interfaces oben; `release` auf den gemeinsamen Helfer umstellen, Verhalten unverändert).

- [ ] **Step 4: Grün bestätigen**

Run: `npm run logik-test -w @jm/zoom-bridge`
Expected: `logik-test: delay_line_test.cpp: <n> Pruefungen, 0 gefallen. (Rückgabe 0)`; die bisherigen Fälle bleiben grün.

- [ ] **Step 5: Wächter schreiben** (`selftest.ts`, Block „A9 NDI-Sender“): Bildart-Liste um `'Bildart::Einpassen'`; `releaseDueLocked`: `if (ausgabeLaeuft_)` vor `entnehmen(`, `ausgabeLaeuft_ = true` vor der Schleife und `= false` nach `zuruecklegen(`, im Einpassen-Zweig `lock.unlock()` vor `einpass::einpassen(` und `lock.lock()` danach, `sendUYVALocked(` nach `lock.lock()`; die Direktbedingungen von `sendI420`, `sendErsatz`, `sendKachel` und der Rumpf von `direktFrei` enthalten `!ausgabeLaeuft_`; `speicherBytes` zählt `ausgabeRahmenBytes_`. Run `npm run selftest -w @jm/zoom-bridge` → Expected: die neuen Wächter `FEHLGESCHLAGEN`.

- [ ] **Step 6: Sender umbauen** – `sendI420`, `sendErsatz`, `sendKachel`, `pump`, `sendI420Einpassen` nehmen `std::unique_lock<std::mutex> lock(mutex_)` und melden Verworfenes nach `lock.unlock()`. Direktbedingung jeweils `ohneVersatz_ || (versatz == 0 && delay_.size() == 0 && !ausgabeLaeuft_)`. Die Senke (`Schwarz`/`Weiss`/`Transparent`/`Kachel`/`I420`) bleibt als Lambda im Rumpf von `releaseDueLocked` (Wächter 3471-3475, 3540-3548). Ablauf:

```text
releaseDueLocked(lock, nachlauf):                // Aufrufer hält mutex_ über lock
  if (ausgabeLaeuft_) return 0                   // ein anderer Thread hält die Staffel; dieses Bild geht beim nächsten Anstoß
  jetzt = Clock::now();  versatz = ms(versatzMsLocked())
  r = delay_.entnehmen(nachlauf ? jetzt − kNachlaufKarenz : jetzt, versatz, faellig_)
  Zähler wie bisher (imNachlauf/beimEinreihen += r.sent, verworfen += r.dropped)
  ausgabeLaeuft_ = true
  für b in faellig_ (Reihenfolge):
    b.art != Einpassen:  if (send_) senke(b)
    sonst:  lock.unlock()
            einpass::rahmenVorbereiten(ausgabeRahmen_, b.rahmenW, b.rahmenH, einpass::bildFlaeche(b.w, b.h, b.rahmenW, b.rahmenH))
            einpass::einpassen(b.data.data(), b.w, b.h, ausgabeRahmen_)
            lock.lock()
            ausgabeRahmenBytes_ = einpass::speicherBytes(ausgabeRahmen_)
            if (send_) sendUYVALocked(ausgabeRahmen_.daten.data(), b.rahmenW, b.rahmenH)   // close() kann dazwischen laufen
  delay_.zuruecklegen(faellig_);  ausgabeLaeuft_ = false;  return r.dropped
```

Ohne `Einpassen`-Bilder in der Schlange wird die Sperre nie geöffnet – „Original“ verhält sich wie bisher.

- [ ] **Step 7: Grün bestätigen und bauen**

Run: `npm run selftest -w @jm/zoom-bridge`, `npm run logik-test -w @jm/zoom-bridge`, dann Bridge bauen (Global Constraints) und `ZOOM_SDK_DIR='…' npm run delay-probe -w @jm/zoom-bridge`
Expected: `Alle Selbsttests bestanden.`; logik-test grün; Bau ohne Fehler; delay-probe grün wie auf main.

- [ ] **Step 8: Commit** – Nachricht `feat(zoom-bridge): Bildart Einpassen, Staffel beim Ausgeben, Einpassen außerhalb der Sender-Sperre (#310)`.

---

### Task 4: Livebild – Einpassen in `Slot::bildAnkunft`

**Files:**
- Modify: P `native/video.cpp` (Slot-Struktur 126-220, Helfer nach `nominalHeight` ~405, `bildAnkunft` 2165-2277), `native/slot_logic.h:473-487`, `native/slot_logic_test.cpp`, `test/selftest.ts` (bei 3676-3681)

**Interfaces:**
- Consumes: Task 1 (`einpassenNoetig`, `Rahmen`, `rahmenVorbereiten`, `bildFlaeche`, `einpassen`, `speicherBytes`), Task 2 (`Slot::format`), Task 3 (`direktFrei`, `sendI420Einpassen`, `sendUYVA`).
- Produces:
  - `void eingepasstSenden(NdiSender& sender, const uint8_t* i420, int w, int h, int W, int H, einpass::Rahmen& rahmen, uint32_t inhalt)` (video.cpp, anonymer Namensraum): `!sender.direktFrei()` → `sender.sendI420Einpassen(i420, w, h, W, H)`; sonst `rahmenVorbereiten(rahmen, W, H, bildFlaeche(w, h, W, H))`, einpassen nur wenn `inhalt == 0 || rahmen.inhalt != inhalt` (danach `rahmen.inhalt = inhalt`), dann `sender.sendUYVA(rahmen.daten.data(), W, H)`
  - `Slot`: `std::atomic<ZoomSDKResolution> res{ZoomSDKResolution_720P};` (statt des einfachen Felds; alle Lese- und Schreibstellen bleiben textgleich), `einpass::Rahmen liveRahmen;` + `std::mutex liveRahmenM;` (nur SDK-Thread, nur `try_lock`), `std::atomic<size_t> liveRahmenBytes{0};`
  - `ZielStand` + `int ausgabeW = 0, ausgabeH = 0;` (am Ende, in `operator==`) – was zuletzt ins NDI ging

- [ ] **Step 1: Failing tests schreiben**
  - `slot_logic_test.cpp` `zielstand_ausgabe_310()`: `ZielStand z; z.ausgabeW = 1920; z.ausgabeH = 1080;` → `z != ZielStand{}`; `zielStandNeu(z, 5)` → `z.ausgabeW == 0 && z.ausgabeH == 0`.
  - `selftest.ts` (bei 3676): im Rumpf von `bildAnkunft` steht `einpass::einpassenNoetig(format.load() == Bildformat::Fit, mode.load() == SlotMode::Share, w, h)` nach dem Riegel; `liveRahmenM.try_lock()` vor `eingepasstSenden(`, im Sonst-Zweig `sendI420Einpassen(`; `res.load()` liefert die Rahmengröße; `sender.sendI420(buf, w, h)` steht weiter da; im Sonst-Zweig des zweiten Riegels `z.ausgabeW =`; `vorschauBild(nr, aboZiel, buf,` unverändert. Rumpf von `eingepasstSenden`: `direktFrei()` vor `einpass::rahmenVorbereiten(` vor `einpass::einpassen(` vor `sendUYVA(`, dazu `sendI420Einpassen(`.

- [ ] **Step 2: Rot bestätigen**

Run: `npm run logik-test -w @jm/zoom-bridge` und `npm run selftest -w @jm/zoom-bridge`
Expected: `slot_logic_test.cpp: Übersetzen gescheitert` (`ausgabeW` fehlt); die neuen Wächter `FEHLGESCHLAGEN`.

- [ ] **Step 3: Umsetzen** – `ZielStand` erweitern; `#include "bild_einpassen.h"` in video.cpp; `res` atomar; Helfer `eingepasstSenden`; in `bildAnkunft` statt der Zeile `sender.sendI420(buf, w, h);`:

```text
einpassen = einpass::einpassenNoetig(format.load() == Bildformat::Fit, mode.load() == SlotMode::Share, w, h)
ausW = w; ausH = h
einpassen: r = res.load(); ausW = nominalWidth(r); ausH = nominalHeight(r)
           if (liveRahmenM.try_lock()) { eingepasstSenden(sender, buf, w, h, ausW, ausH, liveRahmen, 0);
                                         liveRahmenBytes = einpass::speicherBytes(liveRahmen); liveRahmenM.unlock(); }
           else sender.sendI420Einpassen(buf, w, h, ausW, ausH)
sonst:     sender.sendI420(buf, w, h)                                 // „Original“: unverändert
```

Im Sperr-Block nach `bildAnnehmen(z, w, h, jetzt)`: `z.ausgabeW = ausW; z.ausgabeH = ausH;`. Kopie, Vorschau, Zähler bleiben (Vorschau bekommt das Rohbild); `workUs` enthält die Einpassung.

- [ ] **Step 4: Grün bestätigen und bauen**

Run: `npm run logik-test -w @jm/zoom-bridge`, `npm run selftest -w @jm/zoom-bridge`, Bridge bauen
Expected: alles grün, Bau ohne Fehler und ohne neue Warnungen in `video.cpp`.

- [ ] **Step 5: Commit** – Nachricht `feat(zoom-bridge): Livebild im Modus fit in den 16:9-Rahmen einpassen (#310)`.

---

### Task 5: Ersatzbilder im Modus „einpassen“

**Files:**
- Modify: P `native/video.cpp` (Slot-Struktur, `ersatzbildTick` 1566-1590, Helfer davor), `test/selftest.ts` (Block „#306 ersatzbildTick“ ~3400)

**Interfaces:**
- Consumes: Task 1 (`einfarbigI420`, `einpassenNoetig`, `i420Bytes`), Task 4 (`eingepasstSenden`, `res`).
- Produces (nur Hauptthread): `Slot` + `einpass::Rahmen ersatzRahmen; std::vector<uint8_t> ersatzQuelle; Sent ersatzQuelleArt = Sent::None; int ersatzQuelleW = 0, ersatzQuelleH = 0;`; `const uint8_t* einfarbigeQuelle(Slot& s, Sent art, int w, int h)` (füllt bei anderer Art/Größe neu: Y 16 bzw. 235, U/V 128); `void kopieEingepasstSenden(Slot& s, int W, int H)` (hält `s.last.m` über dem Senden wie `sendCopy`; leere Kopie: nichts); `constexpr uint32_t INHALT_SCHWARZ = 1, INHALT_WEISS = 2;`

- [ ] **Step 1: Wächter schreiben** (`selftest.ts`): Im Block `if (e.jetztSenden && e.sent != Sent::None)` steht `einpass::einpassenNoetig(s.format.load() == Bildformat::Fit, lage.modus == SlotMode::Share, w, h)` (je Herzschlag neu, Review Focus 3) und `nominalWidth(s.res)`/`nominalHeight(s.res)` als Rahmen; `case Sent::Transparent:` enthält `sendTransparent(`; `case Sent::Black:`/`White:` enthalten `sendBlack(`/`sendWhite(` und `eingepasstSenden(` mit `einfarbigeQuelle(`; `case Sent::Freeze:` enthält `sendCopy(s.last)` und `kopieEingepasstSenden(`; `case Sent::Held:` enthält `sendCopy(s.last)` und kein `eingepasst` (Review Focus 5); `case Sent::Tile:` enthält `eingepasstSenden(` und `i420Bytes(`. Die vorhandenen #306-Wächter (3400-3407) bleiben unverändert grün. Run `npm run selftest -w @jm/zoom-bridge` → Expected: die neuen Wächter `FEHLGESCHLAGEN`.

- [ ] **Step 2: Umsetzen** – im Sendeblock nach `w`/`h`: `W = nominalWidth(s.res)`, `H = nominalHeight(s.res)`, `einpassen = …` (siehe Wächter); dann je Fall:

| `e.sent` | einpassen | sonst (wie heute) |
|---|---|---|
| Transparent | `sendTransparent(W, H)` | `sendTransparent(w, h)` |
| Black / White | `eingepasstSenden(s.sender, einfarbigeQuelle(s, e.sent, w, h), w, h, W, H, s.ersatzRahmen, INHALT_SCHWARZ bzw. INHALT_WEISS)` | `sendBlack(w, h)` / `sendWhite(w, h)` |
| Freeze | `kopieEingepasstSenden(s, W, H)` | `sendCopy(s.last)` |
| Held | – (nur Freigabe) | `sendCopy(s.last)` (eigener `case`) |
| Tile | `g`, `k = kachelFuer(…)` wie heute; nur wenn `k && k->size() == einpass::i420Bytes(g.w, g.h)`: `eingepasstSenden(s.sender, k->data(), g.w, g.h, W, H, s.ersatzRahmen, 0)` | `sendKachel(k, g.w, g.h)` |

`kachelFuer` wird in beiden Wegen genau einmal gerufen; `sendKachel(` bleibt vor dem ersten `break;` des Tile-Falls (Wächter 3401-3404).

- [ ] **Step 3: Grün bestätigen und bauen**

Run: `npm run selftest -w @jm/zoom-bridge`, Bridge bauen, `ZOOM_SDK_DIR='…' npm run kachel-probe -w @jm/zoom-bridge`
Expected: `Alle Selbsttests bestanden.`; Bau fehlerfrei; kachel-probe grün wie auf main.

- [ ] **Step 4: Commit** – Nachricht `feat(zoom-bridge): Ersatzbilder im Modus fit in dieselbe Fläche einpassen (#310)`.

---

### Task 6: Connect – Einstellung `bildformat` bis zur Bridge

**Files:**
- Modify: C `src/shared/types.ts:220-240`, `src/main/zoom/einstellungen.ts:86-95,190-225`, `src/main/zoom/slot-eingabe.ts:45-48`, `src/main/zoom/slots.ts:128-157`, `src/main/zoom/kern.ts:2613-2626`
- Test: C `test/zoom-teile.test.ts:318-360`, `test/zoom-settings.test.ts:164-173`, `test/zoom-slots-abgleich.test.ts:26-29,180-210`, `test/zoom-slots.test.ts:62-65,380-392,560-570`

**Interfaces:**
- Consumes: Task 2 `SlotFrame` (`@jm/zoom-bridge/protocol`), `frame` an `slotOn`/`slotSet`.
- Produces: `export type ZoomSlotBildformat = 'original' | 'einpassen';`, `ZoomSlotEinstellung.bildformat` (zwölftes Feld, Vorgabe `'original'`); `export const istSlotBildformat: (v: unknown) => v is ZoomSlotBildformat` (einstellungen.ts); `export const BILDFORMAT_ZU_BRIDGE: Record<ZoomSlotBildformat, SlotFrame> = { original: 'native', einpassen: 'fit' }` (slots.ts); `slotOnBefehl` setzt `frame` direkt nach `fallback`; `slotSetFuer` setzt `frame` nur bei Änderung.

- [ ] **Step 1: Failing tests schreiben**
  - zoom-teile: `voll` + `bildformat: 'einpassen'`, Texte „elf“ → „zwölf“, Schlüsselliste + `'bildformat'`; unbekannter Wert (`bildformat: 'quer'`) und fehlender → `'original'`; `neuerSlot`-Erwartung + `bildformat: 'original'`; `pruefeSlotEingabe` gut: `aenderung` mit `bildformat: 'einpassen'`, schlecht: `{ nr: 2, aenderung: { bildformat: 'quer' } }` → `null`.
  - zoom-settings: `ABWEICHUNG` + `['bildformat', { bildformat: 'einpassen' }]`, `11` → `12` (drei Stellen).
  - zoom-slots-abgleich: `einstellung()` + `bildformat: 'original'`; `ck('#310 BILDFORMAT_ZU_BRIDGE', j(BILDFORMAT_ZU_BRIDGE) === j({ original: 'native', einpassen: 'fit' }))`; `abweichend` + `bildformat: 'einpassen'`, Erwartung + `frame: 'fit'`; Sprecher-/Freigabe-Erwartungen + `frame: 'native'`.
  - zoom-slots: `slotEinst()` + `bildformat: 'original'`; die `JSON.stringify`-Erwartungen der slotOn-Befehle (385, 390) + `frame: 'native'` direkt nach `fallback`; „alle elf“ → „alle zwölf“ (`besonders` + `bildformat: 'einpassen'`); neuer Block: laufender Slot 1 (Anna), `p.kern.slotAendern(1, { bildformat: 'einpassen' })` → `bisSlotSet(p, 1, { cmd: 'slotSet', slot: 1, frame: 'fit' })`, danach `zaehle(p, 'slotOn', 1) === 1`, `zaehle(p, 'slotOff', 1) === 0`, `sender(p).get(1)?.ndi === 'Zoom 1'` (kein Neuabo, kein Umbenennen); zurück auf `'original'` → `slotSet` mit `frame: 'native'`.

- [ ] **Step 2: Rot bestätigen**

Run: `npm run selftest -w @jm/connect`
Expected: `FAIL`-Zeilen in zoom-teile, zoom-settings, zoom-slots-abgleich, zoom-slots; Rückgabe ≠ 0.

- [ ] **Step 3: Umsetzen** – Typ und Feld; `BILDFORMATE`-Record + `istSlotBildformat`; `neuerSlot` und `normiereSlot` (Destrukturierung, `bildformat: istSlotBildformat(bildformat) ? bildformat : 'original'`, Kommentar „zwölf Felder“); `AENDERBAR.bildformat = istSlotBildformat`; `BILDFORMAT_ZU_BRIDGE` + `frame` in `slotOnBefehl`; `slotSetFuer`: `if (neu.bildformat !== alt.bildformat) set.frame = BILDFORMAT_ZU_BRIDGE[neu.bildformat];` nach der Fallback-Zeile. `connect-settings.json` braucht keine Umstellung (`zoomSlotsFassung` bleibt 1).

- [ ] **Step 4: Grün bestätigen**

Run: `npm run typecheck -w @jm/connect` und `npm run selftest -w @jm/connect`
Expected: Typprüfung ohne Ausgabe; jede Datei `… ok, 0 fehlgeschlagen.`

- [ ] **Step 5: Commit** – Nachricht `feat(connect): Slot-Einstellung Bildformat (original/einpassen) an die Bridge (#310)`.

---

### Task 7: Messwerte – `outW/outH`, Speicher, Messzeile

**Files:**
- Modify: P `native/video.cpp:1612-1690` (`slotStatsMelden`), `src/protocol.ts:318-325`, `test/fake-bridge.mjs:~760-770`, `test/selftest.ts` (Block „A2 Attrappe — Messwerte“ ~2997), `README.md` (slotStats, Speicher ~661, Absatz Bildformat bei den Ersatzbildern ~624)
- Modify: C `src/main/zoom/kern.ts:378-382,754-756,2133-2141,2272`, `src/shared/zoom-text.ts:1015-1045`
- Test: C `test/zoom-text.test.ts:1418-1430`, `test/zoom-slots.test.ts`

**Interfaces:**
- Consumes: Task 4 (`ZielStand::ausgabeW/H`, `liveRahmenBytes`), Task 5 (`ersatzRahmen`, `ersatzQuelle`), Task 3 (`speicherBytes` mit Ausgaberahmen), Task 6 (`bildformat`).
- Produces: `slotStats` + `outW?: number; outH?: number;`; Connect `mess.eingepasst: { b: number; h: number } | null`; `MessEingabe.eingepasst?: { b: number; h: number } | null`; `MESS_ZEILE.eingepasst: (b: number, h: number) => string` = `` ` · NDI ${b}×${h} eingepasst` `` (#310).

- [ ] **Step 1: Failing tests schreiben**
  - `zoom-text.test.ts` SOLL: `['#310 eingepasst', m({ stufe: '1080p', geliefert: { b: 720, h: 1280, fps: 23.5 }, eingepasst: { b: 1920, h: 1080 } }), '1080p gewünscht · Zoom liefert 720×1280 · 23,5 Bilder/s · NDI 1920×1080 eingepasst']`; `['#310 ohne Bild kein NDI-Teil', m({ geliefert: null, eingepasst: { b: 1920, h: 1080 } }), '720p · zuletzt 1280×720 · jetzt kein Bild']`; `['#310 nicht eingepasst', m({ eingepasst: null }), '720p · Zoom liefert 1280×720 · 25 Bilder/s']`.
  - `selftest.ts` Attrappe: `fahreSteuerung({ FAKE_AUFLOESUNG_GELIEFERT: '720x1280' }, …)` mit Slot 1 (`resolution: '1080p'`, `frame: 'fit'`) und Slot 2 (`resolution: '720p'`, `frame: 'native'`), live, bis je ein slotStats: Slot 1 `w 720, h 1280, outW 1920, outH 1080`; Slot 2 ohne `outW`/`outH`. Wächter: `slotStatsMelden` meldet `"outW"`/`"outH"` nur mit `bildDa` und `z.ausgabeW != z.lastW || z.ausgabeH != z.lastH`; `memKb` enthält `s.liveRahmenBytes.load()`, `einpass::speicherBytes(s.ersatzRahmen)`, `s.ersatzQuelle.capacity()`.
  - `zoom-slots.test.ts`: `baueKern({ slots: [slotEinst(1, { person: 'Anna', an: true, aufloesung: '1080p', bildformat: 'einpassen' })], stell: () => ({ FAKE_AUFLOESUNG_GELIEFERT: '720x1280' }) })`, `insMeeting` → `bis(() => lage(p, 1)?.messText === '1080p gewünscht · Zoom liefert 720×1280 · 30 Bilder/s · NDI 1920×1080 eingepasst', 6000)`; nach `slotAendern(1, { bildformat: 'original' })` → `bis(() => lage(p, 1)?.messText === '1080p gewünscht · Zoom liefert 720×1280 · 30 Bilder/s', 6000)`.

- [ ] **Step 2: Rot bestätigen**

Run: `npm run selftest -w @jm/zoom-bridge` und `npm run selftest -w @jm/connect`
Expected: die neuen Prüfungen `FEHLGESCHLAGEN` bzw. `FAIL`.

- [ ] **Step 3: Umsetzen**
  - Bridge: in `slotStatsMelden` nach `w`/`h`: `const bool eingepasst = bildDa && z.ausgabeW > 0 && (z.ausgabeW != z.lastW || z.ausgabeH != z.lastH);` → `wenn(eingepasst, "outW", …)`, `wenn(eingepasst, "outH", …)`; `memKb` um die drei Größen. `protocol.ts` Felder + Kommentar („nur, wenn das letzte Bild des Fensters eingepasst ging“).
  - Attrappe: `ist16zu9` wie in C++ (eine Funktion); in `statsSenden` bei `live`, `sent none`, `frame === 'fit'`, `mode !== 'share'` und `!ist16zu9(...s.zuletzt)` → `outW/outH = NENNGROESSE[s.resolution]`.
  - Connect `kern.ts`: `mess`-Typ + `eingepasst`; `slotStatsEreignis`: `eingepasst = geliefert !== null && e.outW !== undefined && e.outH !== undefined ? { b: e.outW, h: e.outH } : null`; Zeile 2272 setzt `eingepasst: null`; `slotLage` gibt `eingepasst: x.mess?.eingepasst ?? null` an `slotMessZeile`. `zoom-text.ts`: Feld, Text, Anhang nur im Zweig `g !== null`.
  - README P: `outW`/`outH` bei slotStats, Speicherabsatz (Live-, Ersatz-, Ausgaberahmen, einfarbige Quelle), kurzer Absatz „Bildformat (#310)“ bei den Ersatzbildern.

- [ ] **Step 4: Grün bestätigen und bauen**

Run: `npm run selftest -w @jm/zoom-bridge`, `npm run selftest -w @jm/connect`, `npm run typecheck -w @jm/connect`, Bridge bauen
Expected: `Alle Selbsttests bestanden.`; jede Connect-Datei `… ok, 0 fehlgeschlagen.`; Bau fehlerfrei.

- [ ] **Step 5: Commit** – Nachricht `feat(connect,zoom-bridge): Messzeile nennt die eingepasste NDI-Größe (#310)`.

---

### Task 8: Oberfläche – Auswahlfeld „Bildformat“

**Files:**
- Modify: C `src/shared/zoom-text.ts` (nach `ERSATZBILD_FELD` ~652), `src/renderer/src/zoom/SlotEinstellungen.tsx:10,155-185`
- Test: C `test/zoom-text.test.ts`, `test/zoom-teile.test.ts:543-573`

**Interfaces:**
- Consumes: Task 6 (`ZoomSlotBildformat`, `bildformat`, `aendere({ bildformat })` über `zoomSlotAendern`).
- Produces (zoom-text.ts, #310): `BILDFORMAT_FELD = 'Bildformat'`; `BILDFORMAT_NAME: Record<ZoomSlotBildformat, string> = { original: 'Original', einpassen: '16:9 einpassen' }`; `BILDFORMAT_REIHE: readonly ZoomSlotBildformat[] = ['original', 'einpassen']`; `BILDFORMAT_HINWEIS = { einpassen: 'Hochkant-Bilder mittig in 16:9, Seiten durchsichtig', freigabe: 'Freigaben bleiben in ihrer eigenen Größe' }`; `bildformatHinweis(modus: ZoomSlotModus): string` (Freigabe → `freigabe`, sonst `einpassen`).

- [ ] **Step 1: Failing tests schreiben**
  - zoom-text.test: die vier Texte wörtlich; `bildformatHinweis('freigabe') === 'Freigaben bleiben in ihrer eigenen Größe'`, `bildformatHinweis('teilnehmer') === bildformatHinweis('sprecher') === 'Hochkant-Bilder mittig in 16:9, Seiten durchsichtig'`; `BILDFORMAT_REIHE` deckt jeden Wert von `BILDFORMAT_NAME`; keine ASCII-Anführungszeichen.
  - zoom-teile (B21): `texte` + `zt.BILDFORMAT_FELD`, `...Object.values(zt.BILDFORMAT_NAME)`, `...Object.values(zt.BILDFORMAT_HINWEIS)`; Quelltext-Prüfung: `einst` enthält `aendere({ bildformat: ev.target.value as ZoomSlotBildformat })`, `disabled={beschaeftigt || e.modus === 'freigabe'}` und `bildformatHinweis(e.modus)`.

- [ ] **Step 2: Rot bestätigen**

Run: `npm run selftest -w @jm/connect`
Expected: `FAIL` in zoom-text und zoom-teile.

- [ ] **Step 3: Umsetzen** – Texte; in `SlotEinstellungen.tsx` drittes Feld in der Zeile mit Auflösung und Ersatzbild: `<label … title={bildformatHinweis(e.modus)}>` mit `{BILDFORMAT_FELD}` und `<select value={e.bildformat} disabled={beschaeftigt || e.modus === 'freigabe'} onChange={(ev) => void aendere({ bildformat: ev.target.value as ZoomSlotBildformat })} className={STIL.inp}>` über `BILDFORMAT_REIHE`/`BILDFORMAT_NAME`; im Modus Freigabe daneben `<span>` mit `{BILDFORMAT_HINWEIS.freigabe}` (Tooltip auf dem Label, weil ein gesperrtes `select` keinen zeigt). Kein Nutzertext als Literal.

- [ ] **Step 4: Grün bestätigen**

Run: `npm run typecheck -w @jm/connect` und `npm run selftest -w @jm/connect`
Expected: ohne Ausgabe bzw. jede Datei `… ok, 0 fehlgeschlagen.`

- [ ] **Step 5: Commit** – Nachricht `feat(connect): Auswahl Bildformat in den Slot-Einstellungen, bei Freigabe gesperrt (#310)`.

---

### Task 9: NDI Ende zu Ende ohne Zoom und voller nativer Lauf

**Files:**
- Modify: P `native/main.cpp:422-490` (`--ndi-selftest`), `test/ndi-probe.mjs`

**Interfaces:**
- Consumes: Task 1 (`einfarbigI420`, `rahmenVorbereiten`, `bildFlaeche`, `einpassen`), Task 3 (`sendI420Einpassen`, `pump`, `sendUYVA`, `ndiSetVideoDelayMs`).
- Produces: `ndi-probe` Rückgabe 7 = „Quelle und Ton da, eingepasstes Bild fehlt oder falsch“ (0–6 unverändert).

- [ ] **Step 1: Failing test schreiben** – `ndi-probe.mjs`: die Empfangsschleife läuft bis zu 40 × 250 ms, bis Ton UND je ein Bild 1920×1080 und 1280×720 geprüft sind. Ein solches Bild gilt, wenn `fourCC === 0x41524742` (BGRA) und bei Zeile `height/2` Alpha (Byte 3, Index über `lineStride`) an `x = 8` und `x = width − 9` ≤ 8, an `x = width/2` ≥ 247 ist (NDI komprimiert Alpha; Toleranz angenommen, Messwerte ausgeben). Auswertung nach 5/6: fehlt eins oder ist es falsch → `TEILWEISE — … eingepasstes Bild <Größe> fehlt oder stimmt nicht (<Messwerte>)`, `process.exit(7)`; Kopfkommentar um Code 7.

- [ ] **Step 2: Rot bestätigen** – Bridge bauen (noch ohne Änderung an main.cpp), `ZOOM_SDK_DIR='…' npm run ndi-probe -w @jm/zoom-bridge`
Expected: Rückgabe 7, Zeile `TEILWEISE — … eingepasstes Bild 1920x1080 fehlt …`.

- [ ] **Step 3: `--ndi-selftest` erweitern** – vor der Schleife `ndiSetVideoDelayMs(100)`; Rahmen `direkt` einmal: `einfarbigI420(q1, 720, 1280, 128, 128, 128)`, `rahmenVorbereiten(direkt, 1920, 1080, bildFlaeche(720, 1280, 1920, 1080))`, `einpassen(q1.data(), 720, 1280, direkt)`; Quelle `q2 = einfarbigI420(…, 360, 640, 200, 128, 128)`. Je Durchlauf (150 × 33 ms, unverändert): `s.sendBlack(640, 360)` (läuft jetzt durch die Schlange), `s.sendUYVA(direkt.daten.data(), 1920, 1080)` (Direktweg), `s.sendI420Einpassen(q2.data(), 360, 640, 1280, 720)` (Versatzweg mit Staffel), `s.sendSilence(480, 48000, 1)`, `s.pump()`. Ausstiege und `TerminateProcess` wie bisher.

- [ ] **Step 4: Grün bestätigen – voller nativer Lauf**

Run (je mit `ZOOM_SDK_DIR='…'`): Bridge bauen; `npm run slot-test -w @jm/zoom-bridge`; `npm run ndi-probe -w @jm/zoom-bridge`; `npm run command-probe -w @jm/zoom-bridge`; `npm run bool-probe -w @jm/zoom-bridge`; `npm run delay-probe -w @jm/zoom-bridge`; `npm run kachel-probe -w @jm/zoom-bridge`; `npm run einpassen-messung -w @jm/zoom-bridge`
Expected: slot-test: jede `*-test.exe` (auch `bild-einpassen-test.exe`) `0 gefallen.`; ndi-probe `OK — …` mit Rückgabe 0 und den Alpha-Messwerten beider Bilder; command-probe `OK — alle … wie erwartet`; die übrigen grün wie auf main; Messung weiter unter der Grenze.

- [ ] **Step 5: Commit** – Nachricht `test(zoom-bridge): NDI-Selbsttest sendet eingepasste Bilder direkt und mit Versatz (#310)`; die Alpha-Messwerte der ndi-probe in den Commit-Text.

---

### Task 10: Handbuch, Version 0.4.5, Changelog-Entwurf und Testmeeting-Liste für den Owner

**Files:**
- Modify: `packages/cookbook/content/tool-manuals/tool-jm-connect.md:59`, `packages/cookbook/cookbook.json` (gebaut), C `package.json`, `package-lock.json`

**Interfaces:**
- Consumes: alles Vorherige.
- Produces: Version 0.4.5 auf dem Branch; Changelog-Entwurf und Testmeeting-Liste beim Owner (nicht in `packages/suite-manifest/changelog.json` – das schreibt erst die Auslieferung nach Freigabe).

- [ ] **Step 1: Handbuch** – in `tool-jm-connect.md:59` nach dem Ersatzbild-Teil: „Bildformat („Original“ oder „16:9 einpassen“ – nur Teilnehmer und Aktiver Sprecher: Hochkant-Bilder, etwa ein Handy im Hochformat, stehen mittig in einem 16:9-Bild in der Auflösung des Slots, die Seiten sind durchsichtig; dreht die Person das Handy, wechselt die Quelle zwischen diesem Rahmen und Zooms Querformat; Bildschirmfreigaben bleiben in ihrer eigenen Größe)“. `npm run cookbook:check` → Expected: „cookbook.json ist veraltet“. Dann aus LF bauen (Falle CRLF): `git config --local core.autocrlf false`, CR aus der `.md` entfernen und prüfen (`node -e` wie Plan 2026-11-14 Task 8 Step 3), `npm run cookbook:build`, `npm run cookbook:check` → grün. Nur `.md` und `cookbook.json` stagen, danach `git config --local --unset core.autocrlf`. Commit `docs(connect): Handbuch – Bildformat 16:9 einpassen (#310)`.

- [ ] **Step 2: Version** – `npm version 0.4.5 -w @jm/connect --no-git-tag-version`; `git status --short` zeigt genau `apps/connect/package.json` und `package-lock.json`. Commit `chore(connect): Version 0.4.5`.

- [ ] **Step 3: Schlusslauf, auch mit Node 22**

Run: `npm run selftest -w @jm/zoom-bridge`, `npm run logik-test -w @jm/zoom-bridge`, `npm run selftest -w @jm/connect`, `npm run typecheck --workspaces --if-present`; dann dieselben drei Selbsttests mit `PATH="/c/Users/alexk/AppData/Local/npm-cache/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH"` (vorher `node --version` → `v22.…`)
Expected: überall grün, unter Node 22 ebenso.

- [ ] **Step 4: Changelog-Entwurf dem Owner vorlegen** (wörtlich, keine ASCII-Anführungszeichen; erst nach seiner Freigabe in `changelog.json`):
  1. „Zoom-Slots: Neue Einstellung „Bildformat“ je Slot. „16:9 einpassen“ setzt Hochkant-Bilder – etwa ein Handy im Hochformat – mittig in ein 16:9-Bild in der Auflösung des Slots; die Seiten sind durchsichtig. Der Bildmischer muss nichts mehr zuschneiden, auch wenn die Person das Handy dreht. Bilder, die schon 16:9 sind, gehen unverändert hinaus. (#310)“
  2. „Im Modus „16:9 einpassen“ nehmen auch die Ersatzbilder (eingefroren, schwarz, weiß, Zoom-Kachel) die Fläche des Livebilds ein; „transparent“ bleibt ganz durchsichtig. Die Messzeile der Kachel nennt zusätzlich, was ins NDI geht, z. B. „NDI 1920×1080 eingepasst“.“
  3. „Vorgabe bleibt „Original“: bestehende Slots verhalten sich unverändert. Gilt für Teilnehmer- und Sprecher-Slots; Bildschirmfreigaben bleiben in ihrer eigenen Größe. Dreht die Person das Handy, wechselt die Quelle zwischen dem 16:9-Rahmen und Zooms Querformat; TriCaster und vMix passen beides formatfüllend ein.“
  4. „Nur Windows (Zoom-Slots gibt es nur dort); das Mac-Paket ist inhaltlich unverändert.“

- [ ] **Step 5: Testmeeting-Liste dem Owner übergeben** (Spec „Messen“ Stufe 2; vor jedem Release):
  1. Vorbereitung: Bridge gebaut (Task 9), `node apps/connect/tools/bundle-zoom-bridge.mjs`, `npm run dev -w @jm/connect` (Connect übernimmt die neue `zoom-bridge.exe` beim Start in den Laufzeit-Ordner).
  2. Owner-Handy hochkant im Meeting; Slot A Teilnehmer 1080p „16:9 einpassen“, Slot B dieselbe Person 1080p „Original“. Messzeile A „… · NDI 1920×1080 eingepasst“, B ohne NDI-Teil.
  3. TriCaster: A füllt den 16:9-Eingang, Seiten durchsichtig (Hintergrund sichtbar), kein Zuschnitt; B wie bisher mit Rändern.
  4. Drehen hoch → quer → hoch (je 10 s): A wechselt 1920×1080 (UYVA) ↔ 1280×720 (I420); TriCaster-Bild nach jedem Wechsel richtig, kein Standbild, kein Quellverlust – beobachten und notieren (Formatwechsel mit Größenwechsel ist neu, Annahme AN5).
  5. Aussetzer (Kamera 5 s aus) in A mit Ersatzbild transparent (ganz durchsichtig), Zoom-Kachel (hochkant mittig, Seiten durchsichtig), schwarz (schwarze Bildfläche, Seiten durchsichtig), eingefroren (letztes Bild eingepasst).
  6. A bei laufendem Bild „einpassen“ → „Original“ → „einpassen“: Quelle bleibt im TriCaster, Kachel bleibt „Zeigt …“, kein Neustart.
  7. Bild-Versatz 300 ms: Schritt 4 wiederholen; Bild in Ordnung, Lippensynchronität unverändert.
  8. Je 1 min „Messwerte kopieren“: `workUs` A gegen B und `cpuPct` der Bridge notieren; Erwartung: Mehrlast A ≤ 2 ms je Bild (bei 25 Bildern/s ≤ 50 ms je Sekunde).
  9. Ein Freigabe-Slot: Feld „Bildformat“ gesperrt, Hinweis „Freigaben bleiben in ihrer eigenen Größe“.
  Danach entscheidet der Owner über Release (Connect 0.4.5, Fenster 18–06 Uhr) und Changelog; PR, Merge und Release sind nicht Teil dieses Plans.

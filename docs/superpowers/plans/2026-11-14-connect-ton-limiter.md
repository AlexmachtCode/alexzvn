# Connect: Ton-Limiter und Pegelmessung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jeder Zoom-Slot begrenzt seinen Ton vor dem NDI-Versand auf eine feste Obergrenze und schreibt alle 10 s eine Pegelzeile ins Log.

**Architecture:** Reine Kopfdatei `native/audio_limiter.h` (Limiter + Pegelfenster + Zeilentext, ohne Zoom/NDI prüfbar). `NdiSender::sendAudio` schickt jeden Ton durch einen eigenen `TonLimiter` je Sender (= je Slot). `video.cpp` holt das Pegelfenster im Takt der bestehenden Ton-Messung (Direktweg) bzw. eines eigenen 10-s-Takts (Mischer-Weg) ab und loggt es.

**Tech Stack:** C++17, NDI 6 SDK, Zoom Meeting SDK (Windows), Node-Skripte für Tests/Build.

**Spec:** `docs/superpowers/specs/2026-11-14-connect-ton-limiter-design.md`

## Global Constraints

- Geändert werden nur `packages/zoom-bridge/**` und (Task 5) die Connect-Version. Kein TypeScript in Connect, keine Oberfläche, kein Schalter, keine neue Einstellung.
- `reference_level` bleibt `0`.
- Unterhalb der Grenze gehen Abtastwerte **bitgenau** durch (Verstärkung exakt 1).
- Keine zusätzliche Latenz: keine Vorausschau, kein Puffern über Pakete hinweg.
- Log-Texte nur ASCII (wie die bestehenden Bridge-Zeilen: „staerkste“, „Paketen“).
- Logik-Tests kompilieren mit g++/clang++ `-std=c++17 -Wall -Werror` und mit MSVC `/utf-8`.
- Jede `native/*_test.cpp` steht in `scripts/logik-test.mjs` (TESTDATEIEN), hat das CMake-Ziel `add_executable(<name>-test native/<name>_test.cpp)` und läuft in `npm run slot-test` (Selbsttest A4 prüft das).
- Branch `feat/connect-ton-limiter` von `origin/main`, nie auf `main` committen. Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Release nur nach Owner-OK, während der COP nur 18–06 Uhr Berlin; Patch-Notes zur Owner-Freigabe.

## Review Focus

1. **Ton aus → wieder an im selben Slot:** die erste Pegelzeile danach ist `[ANLAUF]` und enthält keine Werte von vor der Pause. Code: Task 3 (Fenster verwerfen bei Neubeginn); Prüfung: Task 4, Schritt 3.
2. **Freigabe-Slot mit Mischton + Computerton (Mischer-Weg):** wird genauso begrenzt und bekommt Pegelzeilen. Code: Task 3; Prüfung: Task 4, Schritt 3.
3. **Mehrere Slots gleichzeitig:** eine Spitze auf einem Slot senkt keinen anderen ab. Test `l9_slots_unabhaengig` in Task 1.
4. **Last und Latenz:** `cpuPct` der Bridge-Zeile und `Ton-Wartezeit mittel` (12.11.: ~6 ms) bleiben wie vorher. Prüfung: Task 4, Schritt 3.
5. **Slot ohne Ton:** keine Pegelzeilen; der Stille-Herzschlag (`sendSilence`) läuft nicht durch den Limiter. Code: Task 3; Prüfung: Task 4, Schritt 3.

---

### Task 1: Limiter-Logik mit Pegelfenster

**Files:**
- Create: `packages/zoom-bridge/native/audio_limiter.h`
- Create: `packages/zoom-bridge/native/audio_limiter_test.cpp`
- Modify: `packages/zoom-bridge/scripts/logik-test.mjs:29` (TESTDATEIEN)
- Modify: `packages/zoom-bridge/CMakeLists.txt` (nach `audio-mix-test`, Zeile ~82)
- Modify: `packages/zoom-bridge/package.json` (Skript `slot-test`)
- Add (Ablage): `docs/superpowers/specs/2026-11-14-connect-ton-limiter-design.md`, `docs/superpowers/plans/2026-11-14-connect-ton-limiter.md` (aus dem Sitzungs-Scratchpad)

**Interfaces:**
- Produces (Namensraum `slotlogic`, wie `audio_mix.h`):
  - `constexpr double kTonGrenzeDbfs = -6.0;` (Platzhalter bis Task 4)
  - `constexpr double kRueckkehrDbJeSekunde = 40.0;` (6 dB in 150 ms)
  - `struct PegelFenster { int32_t spitze = 0; double summeQuadrate = 0.0; int64_t werte = 0; int64_t vollausschlag = 0; int pakete = 0; int paketeMitEingriff = 0; double staerksteAbsenkungDb = 0.0; };` — alles VOR dem Limiter gemessen; `spitze` ist der größte Betrag (0…32768), `werte`/`summeQuadrate` über alle Kanäle, `vollausschlag` zählt Werte `== 32767` oder `== -32768`, `staerksteAbsenkungDb >= 0`.
  - `class TonLimiter { public: explicit TonLimiter(double grenzeDbfs = kTonGrenzeDbfs); int32_t grenze() const; double absenkungDb() const; void verarbeite(int16_t* werte, int abtastwerteJeKanal, int rate, int kanaele); PegelFenster abholen(); };`

- [ ] **Step 1: Worktree anlegen und Entwurf + Plan ablegen**

Worktree per superpowers:using-git-worktrees, Branch `feat/connect-ton-limiter` von `origin/main`. Beide Dateien aus dem Scratchpad an die Pfade oben kopieren.

```bash
git add docs/superpowers/specs/2026-11-14-connect-ton-limiter-design.md docs/superpowers/plans/2026-11-14-connect-ton-limiter.md
git status --short
git commit -m "docs(connect): Entwurf und Plan Ton-Limiter + Pegelmessung"
```

- [ ] **Step 2: Failing Tests schreiben** (`audio_limiter_test.cpp`, Aufbau wie `audio_mix_test.cpp`: Makro CHECK, je Fall eine Funktion mit gedrucktem Titel, Rückgabe 0/1). Alle Tests konstruieren mit `TonLimiter lim(-6.0)`, nie mit dem Vorgabewert — so bricht Task 4 keinen Test.

```cpp
void l1_grenze()              { CHECK(TonLimiter(-6.0).grenze() == 16422); }
void l2_bitgenau_unter_grenze() {
  // 320 Werte abwechselnd +16000/-16000, 32 kHz mono
  // CHECK(ausgabe == eingabe) fuer jeden Wert; CHECK(lim.absenkungDb() == 0.0)
}
void l3_nie_ueber_grenze() {
  // 320 Werte, zyklisch {32767, -32768, 20000, -20000, 16423}
  // CHECK(std::abs(w) <= 16422) fuer jeden Ausgabewert; CHECK(ausgabe[0] >= 16000)
}
void l4_rueckkehr_150ms() {
  // ein Paket 320 x 32767 (32 kHz mono), danach 20 Pakete 320 x 1000
  // leise Ausgabe Index 1599 (50 ms): CHECK(w > 0 && w < 1000)
  // leise Ausgabe ab Index 4900:      CHECK(w == 1000)
  // nach allen Paketen:               CHECK(lim.absenkungDb() == 0.0)
}
void l5_stereo_gemeinsam() {
  // kanaele 2, 160 Frames {L=32767, R=100}
  // CHECK(std::abs(L) <= 16422); CHECK(R == 50) fuer jeden Frame
}
void l6_formatwechsel() {
  // Paket 320 x 32767 bei 32000, dann 480 x 1000 bei 48000 -> CHECK(jeder Wert == 1000)
}
void l7_messung() {
  // 320 Werte: [0]=32767, [1]=-32768, Rest 0; verarbeite, dann f = abholen()
  // CHECK(f.spitze == 32768); CHECK(f.vollausschlag == 2); CHECK(f.werte == 320)
  // CHECK(f.pakete == 1); CHECK(f.paketeMitEingriff == 1)
  // CHECK(f.summeQuadrate == 32767.0*32767.0 + 32768.0*32768.0)
  // CHECK(f.staerksteAbsenkungDb > 5.9 && f.staerksteAbsenkungDb < 6.1)
  // zweites abholen(): CHECK(g.pakete == 0 && g.spitze == 0 && g.werte == 0)
}
void l8_messung_vor_dem_limiter() {
  // 320 x 32767 -> CHECK(abholen().spitze == 32767)  (nicht <= 16422)
}
void l9_slots_unabhaengig() {
  // lim1: 320 x 32767; lim2: danach 320 x 1000 -> CHECK(jeder lim2-Wert == 1000)
}
```

- [ ] **Step 3: Test in alle drei Wege eintragen**

`'native/audio_limiter_test.cpp'` an TESTDATEIEN anhängen; in CMake `add_executable(audio-limiter-test native/audio_limiter_test.cpp)` + `target_compile_options(audio-limiter-test PRIVATE /utf-8)`; in `slot-test` ` audio-limiter-test` an die `--target`-Liste und `&& build\\Release\\audio-limiter-test.exe` anhängen.

- [ ] **Step 4: Rot sehen**

Run: `npm run logik-test -w @jm/zoom-bridge`
Expected: Kompilierfehler `audio_limiter.h` fehlt.

- [ ] **Step 5: `audio_limiter.h` umsetzen**

Grenze: `static_cast<int32_t>(32768.0 * std::pow(10.0, grenzeDbfs / 20.0))`. Zustand: `absenkungDb_` (0 = exakt 1), `rate_`, `kanaele_`, `fenster_`. Ablauf in `verarbeite`, je Frame (ein Wert je Kanal):

```text
0. (einmal je Aufruf) rate/kanaele != rate_/kanaele_  ->  absenkungDb_ = 0, Format merken  (Fenster bleibt)
1. absenkungDb_ > 0  ->  absenkungDb_ -= kRueckkehrDbJeSekunde / rate;  <= 0 -> genau 0
2. spitze = max |x_c| ueber die Kanaele (int32, -32768 -> 32768); messen: spitze, x^2, vollausschlag, werte
3. g = (absenkungDb_ == 0) ? 1 : 10^(-absenkungDb_/20)
4. spitze * g > grenze_  ->  g = grenze_ / spitze;  absenkungDb_ = -20*log10(g)
5. absenkungDb_ == 0 -> Werte UNVERAENDERT lassen; sonst x_c = clamp(trunc(x_c * g), -grenze_, grenze_)
   staerksteAbsenkungDb = max(.., absenkungDb_); Eingriff im Paket merken
```

Am Ende des Aufrufs `pakete++`, bei Eingriff `paketeMitEingriff++`. `abholen()` gibt `fenster_` zurück und setzt es auf `{}`.

- [ ] **Step 6: Grün sehen**

Run: `npm run logik-test -w @jm/zoom-bridge` und `npm run selftest -w @jm/zoom-bridge`
Expected: alle Fälle grün, Rückgabe 0; Selbsttest A4 grün.

- [ ] **Step 7: Commit**

```bash
git add packages/zoom-bridge/native/audio_limiter.h packages/zoom-bridge/native/audio_limiter_test.cpp packages/zoom-bridge/scripts/logik-test.mjs packages/zoom-bridge/CMakeLists.txt packages/zoom-bridge/package.json
git status --short
git commit -m "feat(zoom-bridge): Ton-Limiter je Slot mit Pegelfenster – Logik und Tests"
```

---

### Task 2: Pegelzeile

**Files:**
- Modify: `packages/zoom-bridge/native/audio_limiter.h`
- Test: `packages/zoom-bridge/native/audio_limiter_test.cpp`

**Interfaces:**
- Consumes: `PegelFenster` (Task 1)
- Produces: `std::wstring pegelZeile(int slot, bool anlauf, const PegelFenster& f);` — leer bei `f.pakete == 0`.

- [ ] **Step 1: Failing Tests schreiben**

```cpp
void p1_normal() {   // spitze 8192, werte 32000, summeQuadrate 8192.0*8192.0*32000, pakete 100
  CHECK(pegelZeile(4, false, f) == L"Ton-Pegel Slot 4 [Dauerbetrieb]: Spitze -12,0 dBFS, Mittel -12,0 dBFS, "
                                   L"Vollausschlag 0 Abtastwerte, Limiter griff in 0 von 100 Paketen ein, staerkste Absenkung 0,0 dB.");
}
void p2_anlauf() {   // wie p1, anlauf = true
  // CHECK(Zeile beginnt mit L"Ton-Pegel Slot 4 [ANLAUF]: Spitze -12,0 dBFS")
}
void p3_eingriff() { // spitze 32768, werte 1000, summeQuadrate 1000*3276.8*3276.8, vollausschlag 2,
                     // pakete 1000, paketeMitEingriff 1, staerksteAbsenkungDb 6.0012
  CHECK(pegelZeile(1, false, f) == L"Ton-Pegel Slot 1 [Dauerbetrieb]: Spitze 0,0 dBFS, Mittel -20,0 dBFS, "
                                   L"Vollausschlag 2 Abtastwerte, Limiter griff in 1 von 1000 Paketen ein, staerkste Absenkung 6,0 dB.");
}
void p4_keine_minus_null() { // spitze 32767 (= -0,0003 dBFS) -> CHECK(Zeile enthaelt L"Spitze 0,0 dBFS")
}
void p5_stille() {   // spitze 0, pakete 50
  CHECK(pegelZeile(2, false, f) == L"Ton-Pegel Slot 2 [Dauerbetrieb]: Stille (alle Abtastwerte 0) in 50 Paketen.");
}
void p6_leer()       { CHECK(pegelZeile(3, false, PegelFenster{}).empty()); }
```

- [ ] **Step 2: Rot sehen** — Run: `npm run logik-test -w @jm/zoom-bridge`; Expected: `pegelZeile` nicht deklariert.

- [ ] **Step 3: `pegelZeile` umsetzen**

Spitze `20*log10(spitze/32768)`, Mittel `10*log10(summeQuadrate/werte/32768^2)`. Zahlen ohne Locale: `std::lround(x * 10)` ganzzahlig, dann Vorzeichen, `/10`, `,`, `%10` — dadurch wird `-0,0` automatisch `0,0`.

- [ ] **Step 4: Grün sehen** — Run: `npm run logik-test -w @jm/zoom-bridge`; Expected: Rückgabe 0.

- [ ] **Step 5: Commit**

```bash
git add packages/zoom-bridge/native/audio_limiter.h packages/zoom-bridge/native/audio_limiter_test.cpp
git commit -m "feat(zoom-bridge): Pegelzeile fuer das Log"
```

---

### Task 3: Einbau in Sender und Slot-Takt

**Files:**
- Modify: `packages/zoom-bridge/native/ndi_sender.h:188-198` (Doku `sendAudio`, neue Mitglieder)
- Modify: `packages/zoom-bridge/native/ndi_sender.cpp:338-342` (`sendAudio`), neue Methode `takePegel`
- Modify: `packages/zoom-bridge/native/video.cpp` (`struct Slot` ~124, `paketSenden` ~1225, `mischerAusgeben` ~1208, neue Funktion `tonPegelMelden`)

**Interfaces:**
- Consumes: `TonLimiter`, `PegelFenster`, `pegelZeile` (Task 1–2)
- Produces: `slotlogic::PegelFenster NdiSender::takePegel();` (unter `mutex_`); `void tonPegelMelden(const Slot& s, const slotlogic::PegelFenster& f, bool anlauf);` (ruft `emitLog(pegelZeile(...))`, nichts bei leerer Zeile)

- [ ] **Step 1: `NdiSender`** — Mitglieder `slotlogic::TonLimiter limiter_;` und `std::vector<int16_t> limitPuffer_;` (beide unter `mutex_`). `sendAudio` kopiert in `limitPuffer_`, ruft `limiter_.verarbeite(...)`, sendet `limitPuffer_` über `sendAudioLocked` — alles in der bestehenden Sperre. `sendSilence` bleibt unverändert. Doku-Satz „Keine Umrechnung, kein Umpacken“ ersetzen durch: begrenzt auf `kTonGrenzeDbfs`, darunter bitgenau.

- [ ] **Step 2: Direktweg (`paketSenden`)** — beginnt ein neues Messfenster (`s.ton.audioMessBeginnMs == 0`, unter `fieldMutex` gelesen), VOR `sendAudio` einmal `s.sender.takePegel()` verwerfen. Bei `messungFertig` nach `tonMessungMelden(...)` aufrufen: `tonPegelMelden(s, s.sender.takePegel(), erstes)`.

- [ ] **Step 3: Mischer-Weg (`mischerAusgeben`)** — `Slot` bekommt `int64_t pegelMischBeginnMs = 0; int pegelMischFenster = 0;`. Ist der Weg nicht `MixShare`: beide auf 0, return. Bei `n > 0`: ist `pegelMischBeginnMs == 0`, VOR `sendAudio` `takePegel()` verwerfen und `pegelMischBeginnMs = jetzt`. Nach `sendAudio`: ist `jetzt - pegelMischBeginnMs >= (pegelMischFenster == 0 ? 1000 : 10000)` → `tonPegelMelden(s, s.sender.takePegel(), pegelMischFenster == 0)`, `++pegelMischFenster`, `pegelMischBeginnMs = jetzt`.

- [ ] **Step 4: Bauen und prüfen**

Run: `npm run rebuild -w @jm/zoom-bridge`, danach `npm run slot-test -w @jm/zoom-bridge`, `npm run logik-test -w @jm/zoom-bridge`, `npm run selftest -w @jm/zoom-bridge`
Expected: Build ohne Warnung-als-Fehler, alle Tests grün, `build\Release\zoom-bridge.exe` neu.

- [ ] **Step 5: Commit**

```bash
git add packages/zoom-bridge/native/ndi_sender.h packages/zoom-bridge/native/ndi_sender.cpp packages/zoom-bridge/native/video.cpp
git status --short
git commit -m "feat(zoom-bridge): Limiter vor dem NDI-Versand, Pegelzeile alle 10 s je Slot"
```

---

### Task 4: Testmeeting und gemessene Grenze (mit Owner)

**Files:**
- Modify: `packages/zoom-bridge/native/audio_limiter.h` (`kTonGrenzeDbfs`)
- Modify: `packages/zoom-bridge/native/ndi_sender.cpp:319-333` (Kommentar)
- Modify: `packages/zoom-bridge/ABNAHME-STAGE3.md:301` (Nebenpunkt Pegel)

- [ ] **Step 1: Connect mit neuer Bridge bauen** — Run: `npm run dist:dir -w @jm/connect`; die entpackte App starten. Expected: Log zeigt `Eigene Dateien ersetzt: zoom-bridge.exe`.

- [ ] **Step 2: Messen** — Owner im Testmeeting; ein Teilnehmer-Slot mit Mischton. Je 1 Minute: normal sprechen, laut sprechen, klatschen/Mikro antippen. `Ton-Pegel`-Zeilen aus dem Log den drei Abschnitten zuordnen.

- [ ] **Step 3: Review-Focus prüfen** — (1) Ton aus und wieder an → nächste Zeile `[ANLAUF]` mit ca. 100 Paketen; (2) Freigabe-Slot mit Mischton + Computerton → Pegelzeilen kommen; (4) `cpuPct` und `Ton-Wartezeit mittel` vergleichbar mit dem 12.11. (~6 ms); (5) Slot mit Ton aus → keine Pegelzeile.

- [ ] **Step 4: Grenze festlegen** — Regel: höchste Spitze bei **normaler** Sprache + 3 dB, auf ganze dB aufgerundet, höchstens −1 dBFS. **Liegt normale Sprache schon bei −1 dBFS oder höher: STOPP, zurück zum Owner** (dann kann ein Limiter nicht wirken, ohne Sprache anzufassen). Wert in `kTonGrenzeDbfs` eintragen; Run `npm run logik-test -w @jm/zoom-bridge` (bleibt grün, Tests nutzen −6.0 fest).

- [ ] **Step 5: Messung festhalten** — im Kommentar `ndi_sender.cpp` und im Nebenpunkt `ABNAHME-STAGE3.md` die alte Annahme STEHEN LASSEN und darunter `GEMESSEN <Datum>:` mit den drei Spitzen, dem Mittel bei normaler Sprache und der gewählten Grenze ergänzen.

- [ ] **Step 6: Commit**

```bash
git add packages/zoom-bridge/native/audio_limiter.h packages/zoom-bridge/native/ndi_sender.cpp packages/zoom-bridge/ABNAHME-STAGE3.md
git commit -m "feat(zoom-bridge): Limiter-Grenze aus dem Testmeeting, Pegel gemessen"
```

---

### Task 5: Release-Vorbereitung Connect 0.4.3

**Files:**
- Modify: `apps/connect/package.json` (`version`), `package-lock.json`

- [ ] **Step 1: Version** — Run: `npm version 0.4.3 -w @jm/connect --no-git-tag-version`; Expected: beide Dateien zeigen 0.4.3.

- [ ] **Step 2: Installer bauen** — Run: `npm run dist:win -w @jm/connect`; Expected: `apps/connect/release/JM Connect-0.4.3-win-x64.exe` vorhanden, Größe und SHA-256 notieren.

- [ ] **Step 3: Commit und Notes-Entwurf**

```bash
git add apps/connect/package.json package-lock.json
git status --short
git commit -m "chore(connect): Version 0.4.3 (Ton-Limiter)"
```

Notes-Entwurf (2 Zeilen, Owner-Freigabe) im Scratchpad ablegen. Release-Weg danach wie Connect 0.4.2 (Tag einzeln, Pre-Release mit EXE, Mac-CI, dann Changelog + `node scripts/bump-manifest.mjs connect 0.4.3` auf main) — **nur nach Owner-OK und im Fenster 18–06 Uhr.**

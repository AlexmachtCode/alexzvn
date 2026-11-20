# Connect 0.4.4: Ersatzbild „Zoom-Kachel“ (#306) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teilnehmer- und Sprecher-Slots bekommen das Ersatzbild „Zoom-Kachel“ (dunkle Kachel mit Profilbild oder Initialen und Anzeigename, bei unterbrochenem Bild mit „Bild unterbrochen“, nach dem Verlassen sofort transparent), ausgeliefert als JM Connect 0.4.4 für Windows.

**Architecture:** `slot_logic.h` entscheidet je Grund, ob ein Slot die Kachel sendet (neuer Fallback und neuer gesendeter Zustand `tile`; die vier alten Ersatzbilder bleiben bitgleich). Die Bridge zeichnet die Kachel mit WIC + Direct2D + DirectWrite auf einem kurzlebigen Hilfsthread, merkt sie sich je Slot in `kachel::KachelStand` (reine Logik) und schickt sie als `Bildart::Kachel` mit Verweis auf den unveränderlichen Puffer durch die Verzögerungsleitung. Connect bekommt den Wert `'kachel'`, Auswahl, Texte und Vorschau; „Bild unterbrochen“ leitet Connect aus dem gemeldeten Grund ab (eine Liste `TILE_NOTICE_REASONS` in `protocol.ts`, gespiegelt in `slotlogic::kachelHinweis`).

**Tech Stack:** C++17 (MSVC; Zoom Meeting SDK 7.1.5.43953, NDI 6, WIC, Direct2D, DirectWrite), TypeScript, Electron, React, tsx-Tests, CMake.

**Spec:** `docs/superpowers/specs/2026-11-14-connect-zoom-kachel-design.md`

**Zeichner-Wahl:** WIC + Direct2D + DirectWrite statt GDI+ — nur DirectWrite weicht für chinesische, arabische und andere Namen von selbst auf passende Schriften aus und formt Rechts-nach-links-Text (GDI+ zeigt dort Kästchen); WIC ist schon gelinkt, und COM bleibt vom Hauptthread fern, weil auf einem eigenen Thread mit eigenem MTA gezeichnet wird.

## Global Constraints

- Arbeitsordner JEDES Befehls: `C:\Users\alexk\alexzvn\.claude\worktrees\connect-kachel-306` (Branch `feat/connect-kachel-306`); Pfade unten relativ dazu. Nie npm aus einem Elternordner (verändert still `C:\Users\alexk\alexzvn`). Befehlsketten mit `&&` sind Bash (`cd /c/Users/alexk/alexzvn/.claude/worktrees/connect-kachel-306 && …` in derselben Zeile); in PowerShell 5.1 je Befehl eine Zeile.
- Werte: Connect `'kachel'` (UI „Zoom-Kachel“) → Bridge-Fallback `'tile'` → gesendeter Zustand `'tile'`; neue Werte stehen HINTEN in jedem Katalog und jeder Aufzählung.
- Nur Teilnehmer- und Sprecher-Slots; im Modus Freigabe verhält sich `tile` wie `transparent`.
- Die vier bisherigen Ersatzbilder (`transparent`, `freeze`, `black`, `white`) verhalten sich für JEDEN Grund bitgleich wie auf origin/main `e5fd1c8343` (Test über alle Kombinationen, Task 1).
- Kachel deckend I420 (BT.601, begrenzter Wertebereich wie `preview.cpp:236`), Größe = letztes Livebild, sonst Nennauflösung des Slots (wie die bisherigen Ersatzbilder); je Zustandswechsel einmal gezeichnet, nie je Bild.
- Kaputtes, fehlendes, riesiges oder hängendes Profilbild → Initialen + eine Logzeile je Profilstand, nie Absturz; die Hauptschleife wartet höchstens 50 ms.
- Unbekannter Ersatzbild-Wert in alten oder fremden Einstellungen → `transparent` (bisheriges Verhalten). `.jmshow` trägt keine Slot-Felder (gemessen: `show-open.ts` liest nur die Sprecher-Liste, `VERBUND_EINSTELLUNGEN['jm-connect'] = ['room']`).
- Keine Logzeile nennt Teilnehmername oder Dateipfad; in einer `emitLog(…)`-Anweisung steht kein Bezeichner `name`, `userName`, `ndi`, `source` (Wächter PT6 d, `test/selftest.ts:2542`).
- `slot_logic.h`, `delay_line.h`, `kachel_logik.h`: nur Standardbibliothek, keine Uhr (G-A2).
- Logik-Tests sauber unter MSVC `cl /W4 /WX` (lokal) und `g++ -Wall -Werror` (CI): keine unbenutzten Hilfsfunktionen (C4505), keine Verengung ohne `static_cast` (C4244/C4267), kein signed/unsigned-Vergleich (C4389), keine verdeckten Namen (C4456).
- Neue `native/*_test.cpp`: drei Einträge — `TESTDATEIEN` in `scripts/logik-test.mjs`, CMake `add_executable(<name>-test native/<name>_test.cpp)` + `target_compile_options(<name>-test PRIVATE /utf-8)`, Ziel und Programm im Skript `slot-test` (Selbsttest A4).
- Deutsch in Kommentaren und Texten, Umlaute wörtlich.
- Nach jedem `git add` `git status --short` lesen; nur explizite Pfade; jede Commit-Nachricht endet mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (zweites `-m`).
- Bridge bauen: PowerShell `$env:ZOOM_SDK_DIR='C:\Users\alexk\Documents\Jakobs Medien\Production Suite\SDKs\zoom-c-sharp-wrapper-7.1.5.43953'` und dann `npm run rebuild -w @jm/zoom-bridge` (Bash: `ZOOM_SDK_DIR='…' npm run rebuild -w @jm/zoom-bridge`); `NDI_SDK_DIR` ist gesetzt. Dieselbe Variable für `slot-test`, `command-probe`, `kachel-probe`.
- CI läuft Node 22: Connect-Tests zusätzlich mit Node 22 vorn im PATH (`C:\Users\alexk\AppData\Local\npm-cache\_npx\52027bd8fc0022aa\node_modules\node\bin`, gemessen 22.23.5; fehlt er, `_npx/*/node_modules/node/bin/node.exe` suchen).
- `cookbook.json` aus LF-Blobs bauen (Ablauf Task 8).
- Release Connect 0.4.4 ohne Testmeeting; nur im Fenster 18–06 Uhr Berlin, nur nach Owner-Freigabe der Notes und Musterkacheln; PR `Closes #306`, Merge erst nach dem Release.

## Review Focus

1. Das Profil ändert sich, während die Kachel läuft (Umbenennung im Meeting, Profilbild kommt erst nach dem Beitritt, Host blendet Profilbilder aus) → die Kachel wird ohne Neustart neu gezeichnet; ausgeblendet → Initialen. Tests: Task 5 `t_stand_profil`, Task 7 Wächter „Profil-Merker“.
2. Profilbild kaputt, zu groß, gelöscht, von Zoom gesperrt oder Laden hängt → Initialen, genau eine Logzeile je Profilstand (nicht alle 100 ms), Hauptschleife höchstens 50 ms aufgehalten. Tests: Task 5 `t_stand_frist`, `t_stand_fehler_einmal`; Task 6 `kachel-probe` (bytegleich mit den Initialen, eine Zeile je Fall).
3. Ungewöhnliche Namen (sehr lang, nur Emoji, Kombinationszeichen, Kyrillisch/Chinesisch/Arabisch, leer, nur Leerraum) → sinnvolle Initialen und Kürzung mit „…“, nie Absturz. Tests: Task 4 `t_initialen`, `t_kuerzen`; Task 6 Muster `720p-chinesisch`, `720p-arabisch`, `720p-nur-emoji`.
4. Livebild nicht 16:9 oder klein (Hochkant 360×640, 4:3, 320×180) → Kachel in genau dieser Größe, alles im Bild, kein Größenwechsel im Mischer. Tests: Task 4 `t_masse_invarianten`; Task 6 Muster `360x640`, `640x480`, `320x180`.
5. Lippensync-Versatz an (z. B. 480 ms) → Livebild, Kachel und transparent bleiben in Ankunftsreihenfolge, kein Kopieren je Bild, kein Puffer bleibt hängen. Test: Task 3 `test_kachel_verweis_306`.

## Präzisierungen gegenüber dem Entwurf (vom Plan entschieden)

1. `starting` mit Ziel ≠ 0, Kamera laut Zoom an: Kachel ohne Hinweis; erst nach `TEILNEHMER_SCHONFRIST_MS` (2 s) ohne erstes Bild → `fallback/noFrames` (nur bei `tile`) und damit Hinweis. So blitzt „Bild unterbrochen“ nicht bei jeder Zuweisung auf, und der Hinweis hängt allein am Grund.
2. Hinweis-Gründe genau `noFrames`, `bufferMismatch`, `subscribeFailed`.
3. Blendet der Host die Profilbilder aus (`IsParticipantProfilePicturesHidden`), zeigt die Kachel Initialen.
4. Leerer Profilbild-Pfad = kein Profilbild (Initialen, keine Logzeile); gesetzter Pfad mit Fehler = eine Logzeile.
5. UI-Name „Zoom-Kachel“ (Connect nennt seine Slot-Karte schon „Kachel“); Statuszeile „Ersatzbild Zoom-Kachel“ bzw. „Ersatzbild Zoom-Kachel (Bild unterbrochen)“ (T61).
6. Freigabe-Slot mit gespeicherter Kachel: Wert bleibt gespeichert; die Auswahl zeigt ihn gesperrt als „Zoom-Kachel (bei Bildschirmfreigabe transparent)“.
7. Gezeichnet wird asynchron; bis das Ergebnis da ist, sendet der Slot die letzte Kachel derselben Person und Größe, sonst die dunkle Grundfläche (#232323) — nie transparent.

## Dateien

| Datei | Aufgabe |
|---|---|
| `packages/zoom-bridge/native/slot_logic.h` | `Fallback::Tile`, `Sent::Tile`, `ersatzArt` mit Grund, `kachelHinweis`, 2-s-Regel |
| `packages/zoom-bridge/src/protocol.ts` | Kataloge, `TILE_NOTICE_REASONS`, `tileNotice` |
| `apps/connect/src/…` | Wert, Abbildung, Texte, Auswahl, Vorschau |
| `packages/zoom-bridge/native/delay_line.h`, `ndi_sender.{h,cpp}` | `Bildart::Kachel`, `pushKachel`, `sendKachel` |
| `packages/zoom-bridge/native/kachel_logik.h` (neu) | rein: UTF-16, Initialen, Farbe, Kürzung, Maße, Profilbild-Grenzen, I420, `KachelStand` |
| `packages/zoom-bridge/native/kachel.{h,cpp}` (neu) | Windows: Profilbild laden, zeichnen, Hilfsthread, Musterkacheln |
| `packages/zoom-bridge/native/{video.cpp,video.h,callbacks.h,callbacks.cpp,main.cpp}` | Anbindung an den Slot, Profil, Merker, `--kachel-muster` |
| `packages/zoom-bridge/test/{selftest.ts,fake-bridge.mjs,slot-pruefung-faelle.json,kachel-probe.mjs}` | Wächter, Attrappe, Fälle, Musterprobe |
| `packages/cookbook/…` | Handbuch, Panic-SOP, `cookbook.json` |

---

### Task 1: Arbeitsplatz, Kataloge und Entscheidungsregel

**Files:**
- Create: `docs/superpowers/specs/2026-11-14-connect-zoom-kachel-design.md`, `docs/superpowers/plans/2026-11-14-connect-zoom-kachel.md` (Kopien aus `C:\Users\alexk\AppData\Local\Temp\claude\5dcb13dfa9326af2\e776f323-90b6-41ce-8459-49af4e6ed967\scratchpad\`)
- Modify: `packages/zoom-bridge/native/slot_logic.h:24,26,42,44,61,63,570-662`, `packages/zoom-bridge/src/protocol.ts:67-74`, `packages/zoom-bridge/test/fake-bridge.mjs:19,446`, `packages/zoom-bridge/test/slot-pruefung-faelle.json`, `packages/zoom-bridge/test/selftest.ts:2601,2626,2628` (+ Block nach `:3222`), `packages/zoom-bridge/README.md` (Befehlstabelle `:306`, Abschnitt „Ersatzbild und Halten“ `:501`)
- Test: `packages/zoom-bridge/native/slot_logic_test.cpp`

**Interfaces:**
- Consumes: —
- Produces (C++, `namespace slotlogic`):
  - `enum class Fallback : uint8_t { Transparent, Freeze, Black, White, Tile };` mit `FALLBACK_NAMEN[5]` (… `"tile"`)
  - `enum class Sent : uint8_t { None, Transparent, Freeze, Black, White, Held, Tile };` mit `SENT_NAMEN[7]` (… `"tile"`)
  - `inline bool istZiel0Grund(Grund g);` — `participantLeft`, `noTarget`, `speakerNone`, `shareNone`
  - `inline Sent ersatzArt(Fallback f, bool kopieDiesesZiels, SlotMode modus, unsigned ziel, Grund grund);`
  - `inline bool kachelHinweis(Grund g);`
- Produces (TS, `@jm/zoom-bridge/protocol`): `SLOT_FALLBACKS = [..., 'tile']`, `SLOT_SENT = [..., 'held', 'tile']`, `TILE_NOTICE_REASONS = ['noFrames', 'bufferMismatch', 'subscribeFailed'] as const`, `function tileNotice(reason: SlotReason | null): boolean`

- [ ] **Step 1: Arbeitsplatz einrichten und Grundlinie messen**

Beide Dateien in die `docs/`-Pfade kopieren, dann (jede Zeile einzeln):
```
npm ci
node node_modules/electron/install.js
node -p "require.resolve('@jm/zoom-bridge/package.json', { paths: ['apps/connect'] })"
npm run logik-test -w @jm/zoom-bridge
npm run selftest -w @jm/zoom-bridge
```
(`install.js` nur, wenn `node_modules/electron/dist` fehlt.) Expected: der aufgelöste Pfad liegt unter `…\worktrees\connect-kachel-306\`; `logik-test` meldet drei Programme mit „0 gefallen“; `selftest` Exit 0. Sonst anhalten und melden.

- [ ] **Step 2: Docs committen**
```
git add docs/superpowers/specs/2026-11-14-connect-zoom-kachel-design.md docs/superpowers/plans/2026-11-14-connect-zoom-kachel.md
git status --short
git commit -m "docs(connect): Entwurf und Plan Zoom-Kachel (#306)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Die fehlenden Logik-Tests schreiben** (`slot_logic_test.cpp`, Aufrufe über der Marke `// ── ENDE DER FÄLLE`)

`namespace alt` nach den Hilfen `zielMitBild`/`lage`: `ersatzArt` und `bildEntscheidung` WÖRTLICH aus `git show e5fd1c8343:packages/zoom-bridge/native/slot_logic.h`, Zeilen 570–662, nur in diesen Namensraum gesetzt (Referenz für „bitgleich“).

```cpp
void s306_alte_ersatzbilder_bitgleich() {
  std::printf("#306 Die vier bisherigen Ersatzbilder entscheiden fuer jede Kombination wie origin/main\n");
  // Raster bei jetzt = 10000: Modus 3 × Fallback {Transparent, Freeze, Black, White} × Zustand 5 × Grund 20
  // × Ziel {0, lage()-Ziel} × Bild {keins, vor 0/150/199/200/1999/2000/2500 ms} × kopieGueltig × kameraAusLautZoom
  // × bufferMismatch × freigabeBesteht × freigabePausiert × kameraGefragt × letztesErsatzMs {0, jetzt-50, jetzt-150}
  // × Umhaengen {jetzt-100, jetzt-2500}. Verglichen: sent, jetztSenden, zustandAendern, zustand, grund, kameraFragen.
  // Je Abweichung ++abweichungen; die ERSTE druckt ihre Kombination.
  CHECK(faelle == 7372800);
  CHECK(abweichungen == 0);
  // ersatzArt einzeln: 4 Fallbacks × Kopie × Modus × Ziel {0, A} × 20 Gruende: ersatzArt(f, k, m, z, g) == alt::ersatzArt(f, k)
  CHECK(artAbweichungen == 0);
}

void s306_kachel_tabelle() {
  std::printf("#306 Zoom-Kachel: Zustandstabelle des Entwurfs, Hinweis aus dem Grund nach der Entscheidung\n");
  const Fallback K = Fallback::Tile;
  const ZielStand neu = zielMitBild(5000, -1, false);   // umgehaengt bei 5000, noch kein Bild
  const ZielStand bild = zielMitBild(0, 1000, false);   // letztes Bild bei 1000
  BildLage l = lage(SlotMode::Participant, K, SlotState::Live, Grund::frames, 1100);
  CHECK(bildEntscheidung(l, bild).sent == Sent::None);                         // Livebild
  l.jetzt = at(2999);
  CHECK(bildEntscheidung(l, bild).sent == Sent::None);                         // Schonfrist wie bisher
  l.jetzt = at(3000);
  BildEntscheidung e = bildEntscheidung(l, bild);
  CHECK(e.sent == Sent::Tile && e.zustandAendern && e.grund == Grund::noFrames && kachelHinweis(e.grund));
  l = lage(SlotMode::Participant, K, SlotState::Live, Grund::frames, 1200);
  l.kameraAusLautZoom = true;
  e = bildEntscheidung(l, bild);
  CHECK(e.sent == Sent::Tile && e.grund == Grund::cameraOff && !kachelHinweis(e.grund));
  l = lage(SlotMode::Participant, K, SlotState::Starting, Grund::targetChanged, 5100);
  e = bildEntscheidung(l, neu);
  CHECK(e.sent == Sent::Tile && e.jetztSenden && !e.zustandAendern && !kachelHinweis(e.grund));
  l.jetzt = at(6999);
  CHECK(!bildEntscheidung(l, neu).zustandAendern);
  l.jetzt = at(7000);
  e = bildEntscheidung(l, neu);
  CHECK(e.sent == Sent::Tile && e.zustandAendern && e.zustand == SlotState::Fallback && e.grund == Grund::noFrames);
  l.bufferMismatch = true;
  CHECK(bildEntscheidung(l, neu).grund == Grund::bufferMismatch);
  l = lage(SlotMode::Participant, K, SlotState::Starting, Grund::targetChanged, 5100);
  l.kameraAusLautZoom = true;
  e = bildEntscheidung(l, neu);
  CHECK(e.sent == Sent::Tile && e.grund == Grund::cameraOff && !kachelHinweis(e.grund));   // F6 wie bisher
  l = lage(SlotMode::Participant, K, SlotState::Fallback, Grund::subscribeFailed, 5100);
  e = bildEntscheidung(l, neu);
  CHECK(e.sent == Sent::Tile && !e.zustandAendern && kachelHinweis(e.grund));
  for (const Grund g : {Grund::participantLeft, Grund::noTarget}) {
    l = lage(SlotMode::Participant, K, SlotState::Fallback, g, 5100);
    l.ziel = 0;
    CHECK(bildEntscheidung(l, neu).sent == Sent::Transparent);
  }
  l = lage(SlotMode::Speaker, K, SlotState::Fallback, Grund::speakerNoVideo, 5100);
  e = bildEntscheidung(l, neu);
  CHECK(e.sent == Sent::Tile && !kachelHinweis(e.grund));
  l = lage(SlotMode::Speaker, K, SlotState::Fallback, Grund::speakerNone, 5100);
  l.ziel = 0;
  CHECK(bildEntscheidung(l, neu).sent == Sent::Transparent);
  l = lage(SlotMode::Share, K, SlotState::Starting, Grund::shareChanged, 7500);   // Freigabe: nie Kachel, keine 2-s-Regel
  e = bildEntscheidung(l, neu);
  CHECK(e.sent == Sent::Transparent && !e.zustandAendern);
  l = lage(SlotMode::Share, K, SlotState::Live, Grund::frames, 1300);
  CHECK(bildEntscheidung(l, zielMitBild(0, 1000, true)).sent == Sent::Held);
  l = lage(SlotMode::Participant, K, SlotState::Off, Grund::command, 5100);
  e = bildEntscheidung(l, neu);
  CHECK(e.sent == Sent::None && !e.zustandAendern);
  for (int gi = 0; gi < 20; ++gi) {   // Kachel genau mit Ziel, ausserhalb der Freigabe, ohne Ziel-0-Grund
    const Grund g = static_cast<Grund>(gi);
    CHECK(ersatzArt(K, true, SlotMode::Participant, A, g) == (istZiel0Grund(g) ? Sent::Transparent : Sent::Tile));
    CHECK(ersatzArt(K, true, SlotMode::Speaker, 0, g) == Sent::Transparent);
    CHECK(ersatzArt(K, true, SlotMode::Share, F1, g) == Sent::Transparent);
  }
}

void s306_hinweis_gruende() {
  std::printf("#306 kachelHinweis: genau noFrames, bufferMismatch, subscribeFailed\n");
  for (int gi = 0; gi < 20; ++gi) {
    const Grund g = static_cast<Grund>(gi);
    CHECK(kachelHinweis(g) == (g == Grund::noFrames || g == Grund::bufferMismatch || g == Grund::subscribeFailed));
  }
}
```

- [ ] **Step 4: Die fehlenden TS-Prüfungen schreiben**

`selftest.ts`: Import (`:2601`) um `TILE_NOTICE_REASONS, tileNotice`; `:2626` → `'transparent,freeze,black,white,tile'` (Name „A1 6.2 + #306: SLOT_FALLBACKS …“), `:2628` → `SLOT_SENT.length === 7 && liste(SLOT_SENT) === 'none,transparent,freeze,black,white,held,tile'`. Neuer Block nach `:3222`:
```ts
console.log('\nZoom-Kachel (#306): Hinweis-Gründe in slot_logic.h gegen protocol.ts');
{
  const koerper = rumpf(cppOhneKommentare(paketDateiOderLeer('native', 'slot_logic.h')), 'inline bool kachelHinweis(');
  const gruende = [...koerper.matchAll(/Grund::(\w+)/g)].map((m) => m[1]).join(',');
  assert(gruende === TILE_NOTICE_REASONS.join(',') && gruende === 'noFrames,bufferMismatch,subscribeFailed',
    '#306 kachelHinweis nennt genau TILE_NOTICE_REASONS, in derselben Reihenfolge');
  assert(tileNotice('noFrames') && tileNotice('subscribeFailed') && !tileNotice('cameraOff') && !tileNotice(null), '#306 tileNotice');
}
```
`slot-pruefung-faelle.json`: zwei Zeilen mit dem `slotOn` aus Zeile 2 — `"fallback":"tile"` → `slotNoPrivilege`, `mitSlot:true`, `stderr:true`, Name „fallback tile (Zoom-Kachel, #306) ist gültig“; `"fallback":"kachel"` → `slotBadFallback`, `mitSlot:true`, `stderr:false`, Name „fallback kachel (Connect-Wert) ist der Bridge unbekannt“.

- [ ] **Step 5: Rot bestätigen**

Run: `npm run logik-test -w @jm/zoom-bridge` → Expected: `slot_logic_test.cpp: Übersetzen gescheitert` (`Tile` ist kein Mitglied von `Fallback`). Run: `npm run selftest -w @jm/zoom-bridge` → Expected: FAIL bei „A1 6.2 + #306“, „#306 kachelHinweis …“ und dem Fall „fallback tile … ist gültig“ (die Attrappe antwortet `slotBadFallback`).

- [ ] **Step 6: Umsetzen**

`slot_logic.h`: Aufzählungen, Tabellen, `static_assert` (5 bzw. 7). `istZiel0Grund` und `kachelHinweis` vor `ersatzArt`. `ersatzArt` für `Tile`: `modus != SlotMode::Share && ziel != 0 && !istZiel0Grund(grund) ? Sent::Tile : Sent::Transparent`; die vier anderen Zweige unverändert (die drei neuen Parameter wirken nur bei `Tile`). Aufruf in `bildEntscheidung`: `ersatzArt(l.fallback, z.kopieGueltig, l.modus, l.ziel, l.grund)`. Die 2-s-Regel im Zweig `!freigabe && !hatBild`, VOR der bestehenden F6-Abfrage:
```cpp
if (l.fallback == Fallback::Tile && l.zustand == SlotState::Starting && !l.kameraAusLautZoom &&
    l.jetzt - z.retargetMs >= TEILNEHMER_SCHONFRIST_MS) {
  soll = SlotState::Fallback;
  sollGrund = l.bufferMismatch ? Grund::bufferMismatch : Grund::noFrames;
} else {
  // bisheriger Rumpf (F6) unverändert
}
```
Kopfkommentar von `bildEntscheidung` um eine Zeile „#306 Zoom-Kachel …“ ergänzen.
`protocol.ts`: Kataloge; `TILE_NOTICE_REASONS` (`as const satisfies readonly SlotReason[]`, Kommentar „Gegenstück: slotlogic::kachelHinweis“); `tileNotice(reason)` = `reason !== null && (TILE_NOTICE_REASONS as readonly string[]).includes(reason)`; Kommentar an `SLOT_FALLBACKS`/`SLOT_SENT`: `'tile'` = Zoom-Kachel (#306), nur Teilnehmer/Sprecher.
`fake-bridge.mjs`: `SLOT_FALLBACKS` + `'tile'`; `ersatzArt` = `s.fallback === 'tile' ? (s.mode !== 'share' && s.target !== 0 ? 'tile' : 'transparent') : <bisheriger Ausdruck von :446>` (die 2-s-Regel bildet die Attrappe nicht nach, wie schon die Schonfrist).
README: `fallback` in der Befehlstabelle um `` `tile` `` (Zoom-Kachel, nur Teilnehmer/Sprecher); im Abschnitt „Ersatzbild und Halten“ ein Absatz mit der Zustandstabelle des Entwurfs, der 2-s-Regel und den Hinweis-Gründen.

- [ ] **Step 7: Grün bestätigen**

Run: `npm run logik-test -w @jm/zoom-bridge` → `slot_logic_test.cpp: … 0 gefallen`, die anderen zwei unverändert. Run: `npm run selftest -w @jm/zoom-bridge` → Exit 0. (Die Connect-Typprüfung ist bis Task 2 rot: `SlotSent` hat einen Wert mehr — erwartet.)

- [ ] **Step 8: Commit**
```
git add packages/zoom-bridge/native/slot_logic.h packages/zoom-bridge/native/slot_logic_test.cpp packages/zoom-bridge/src/protocol.ts packages/zoom-bridge/test/fake-bridge.mjs packages/zoom-bridge/test/slot-pruefung-faelle.json packages/zoom-bridge/test/selftest.ts packages/zoom-bridge/README.md
git status --short
git commit -m "feat(zoom-bridge): Ersatzbild tile – Entscheidung je Grund, alte vier bitgleich (#306)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Connect – Wert, Auswahl, Texte, Vorschau

**Files:**
- Modify: `apps/connect/src/shared/types.ts:221,225`, `apps/connect/src/main/zoom/einstellungen.ts:89`, `apps/connect/src/main/zoom/slots.ts:130-132`, `apps/connect/src/shared/zoom-text.ts:621-632,638-689,768-778` (+ `SLOT_TEXT`), `apps/connect/src/renderer/src/zoom/slot-vorschau.ts:7-60`, `apps/connect/src/renderer/src/zoom/SlotEinstellungen.tsx:52-53,173-187`, `apps/connect/src/renderer/src/zoom/SlotKachel.tsx:48-56`
- Test: `apps/connect/test/zoom-text.test.ts`, `apps/connect/test/zoom-slots-abgleich.test.ts:183`, `apps/connect/test/zoom-teile.test.ts:327`, `apps/connect/test/zoom-slots.test.ts`

**Interfaces:**
- Consumes: Task 1 `tileNotice`, `SlotSent`/`SlotFallback` mit `'tile'`
- Produces:
  - `type ZoomSlotErsatzbild = 'transparent' | 'eingefroren' | 'schwarz' | 'weiss' | 'kachel';`
  - `ERSATZBILD_ZU_BRIDGE.kachel = 'tile'`; `ERSATZBILD_NAME` in dieser Schlüsselfolge: `transparent, freeze, black, white, tile, eingefroren, schwarz, weiss, kachel` (`tile` und `kachel` = `'Zoom-Kachel'`)
  - `KACHEL_TEXT.T61 = 'Ersatzbild Zoom-Kachel (Bild unterbrochen)'`; `SLOT_TEXT.kachelFreigabe = 'Zoom-Kachel (bei Bildschirmfreigabe transparent)'`
  - `function ersatzbildAuswahl(modus: ZoomSlotModus, aktuell: ZoomSlotErsatzbild): { wert: ZoomSlotErsatzbild; text: string; waehlbar: boolean }[]`
  - `VORSCHAU_TEXT.T53b = 'Zoom-Kachel'`; `VorschauFlaeche.art` + `'kachel'`

- [ ] **Step 1: Tests schreiben**

`zoom-text.test.ts`, Tabelle `SOLL` (`:1038`):
```ts
['T19 Zoom-Kachel', k({ grund: 'cameraOff', gesendet: 'tile', ersatzbild: 'kachel' }), 'Anna: Kamera aus · Ersatzbild Zoom-Kachel'],
['T19b Zoom-Kachel', k({ grund: 'noFrames', gesendet: 'tile', ersatzbild: 'kachel' }), 'Anna: Zoom liefert gerade kein Bild · Ersatzbild Zoom-Kachel (Bild unterbrochen)'],
['T20 Zoom-Kachel', k({ grund: 'targetChanged', gesendet: 'tile', ersatzbild: 'kachel' }), 'Anna: erstes Bild steht noch aus · Ersatzbild Zoom-Kachel'],
['T20b Zoom-Kachel', k({ grund: 'bufferMismatch', gesendet: 'tile', ersatzbild: 'kachel' }), 'Anna: fehlerhafte Bilder verworfen · Ersatzbild Zoom-Kachel (Bild unterbrochen)'],
['T20c Zoom-Kachel', k({ grund: 'subscribeFailed', aboFehlerName: 'SDKERR_INTERNAL_ERROR', gesendet: 'tile', ersatzbild: 'kachel' }),
  'Anna: Zoom hat das Abo abgelehnt (SDKERR_INTERNAL_ERROR) · Ersatzbild Zoom-Kachel (Bild unterbrochen). Für einen neuen Versuch „Stopp“ und wieder „Start“.'],
['T16 Zoom-Kachel, Person weg', k({ grund: 'participantLeft', gesendet: 'transparent', ersatzbild: 'kachel' }), 'Wartet auf Anna · Ersatzbild transparent'],
['T27 Zoom-Kachel', k({ ...sprecher, grund: 'speakerNoVideo', gesendet: 'tile', ersatzbild: 'kachel' }), 'Ben (Sprecher): Kamera aus · Ersatzbild Zoom-Kachel'],
['T29c Zoom-Kachel in der Freigabe', k({ ...freigabe, zielName: null, grund: 'shareNone', gesendet: 'transparent', ersatzbild: 'kachel' }), 'Wartet auf eine Bildschirmfreigabe · Ersatzbild transparent'],
```
ST4 (`:1105`): Erwartung `{ transparent: 'transparent', freeze: 'eingefroren', black: 'schwarz', white: 'weiß', tile: 'Zoom-Kachel', eingefroren: 'eingefroren', schwarz: 'schwarz', weiss: 'weiß', kachel: 'Zoom-Kachel' }`.
Kreuzprodukt (`:1177-1191`): `ERSATZBILDER` + `'kachel'`, `ERSATZ_SENT` + `'tile'`, `S.ART.tile = 'Zoom-Kachel'`; in `soll()` ist `art` bei `gesendet === 'tile'` und Grund ∈ {noFrames, bufferMismatch, subscribeFailed} `'Ersatzbild Zoom-Kachel (Bild unterbrochen)'`; neues Prädikat „„(Bild unterbrochen)“ nur mit sent tile und Grund noFrames, bufferMismatch oder subscribeFailed“.
Neuer Block:
```ts
const { ersatzbildAuswahl } = await import('../src/shared/zoom-text');
const paare = (l: { text: string; waehlbar: boolean }[]) => JSON.stringify(l.map((o) => [o.text, o.waehlbar]));
const letzte = <T>(l: T[]): T => l[l.length - 1];
ck('#306 Auswahl Teilnehmer: fünf, alle wählbar', paare(ersatzbildAuswahl('teilnehmer', 'transparent'))
  === JSON.stringify([['transparent', true], ['eingefroren', true], ['schwarz', true], ['weiß', true], ['Zoom-Kachel', true]]));
ck('#306 Auswahl Sprecher: Zoom-Kachel wählbar', letzte(ersatzbildAuswahl('sprecher', 'schwarz')).wert === 'kachel');
ck('#306 Auswahl Freigabe: ohne Zoom-Kachel', ersatzbildAuswahl('freigabe', 'schwarz').length === 4);
ck('#306 Auswahl Freigabe mit gespeicherter Kachel: gesperrt und ehrlich benannt',
  JSON.stringify(letzte(ersatzbildAuswahl('freigabe', 'kachel'))) === JSON.stringify({ wert: 'kachel', text: 'Zoom-Kachel (bei Bildschirmfreigabe transparent)', waehlbar: false }));
```
Vorschau (Block ab `:1387`): `vorschauFlaeche({ …, zustand: 'ersatz', gesendet: 'tile' })` → `{ art: 'kachel', kennzeichen: 'Zoom-Kachel', text: null }`.
`zoom-slots-abgleich.test.ts:183`: Erwartung um `kachel: 'tile'`; neu: `slotOnBefehl(einstellung({ ersatzbild: 'kachel' }), ANNA, 'Zoom 1').fallback === 'tile'`.
`zoom-teile.test.ts` (bei `:327`): für jeden Wert aus `['transparent', 'eingefroren', 'schwarz', 'weiss', 'kachel']` gilt `normiereSlot({ nr: 2, ndiName: 'Zoom 2', ersatzbild: w })?.ersatzbild === w`; `'tile'` (Bridge-Wort, von Hand eingetragen) → `'transparent'`.
`zoom-slots.test.ts` (Muster `:2103`): Slot 1 mit `ersatzbild: 'kachel'`, `insMeeting` → das erste `slotOn` (`slotGesendet(p, 1, 1)[0]`) trägt `fallback: 'tile'`, kein `error` mit `code: 'slotBadFallback'` in `p.ereignisse`, und das erste `slot`-Ereignis von Slot 1 meldet `sent: 'tile'`.

- [ ] **Step 2: Rot bestätigen** — `npm run selftest -w @jm/connect` → Expected: FAIL bzw. Typfehler (`'kachel'` kein `ZoomSlotErsatzbild`).

- [ ] **Step 3: Umsetzen** — Typ (Kommentar `types.ts:225` um `'tile'`), `ERSATZBILDER` in `einstellungen.ts`, Abbildung, Namen, Texte. `ersatzTeil(gesendet, ersatzbild, grund)`: zuerst `gesendet === 'tile' && tileNotice(grund)` → `KACHEL_TEXT.T61`, sonst bisher; `ersatzZeile` reicht `e.grund` durch. `ersatzbildAuswahl`: Reihenfolge transparent, eingefroren, schwarz, weiss, kachel, Texte aus `ERSATZBILD_NAME`; im Modus Freigabe fehlt `kachel`, außer `aktuell === 'kachel'` (dann `text: SLOT_TEXT.kachelFreigabe`, `waehlbar: false`). `SlotEinstellungen.tsx`: Konstante `ERSATZBILDER` weg; Optionen `<option key={o.wert} value={o.wert} disabled={!o.waehlbar}>{o.text}</option>` aus `ersatzbildAuswahl(e.modus, e.ersatzbild)` (keine Text-Literale, Wächter B-EP4). `slot-vorschau.ts`: `case 'tile': return flaeche('kachel', VORSCHAU_TEXT.T53b);`. `SlotKachel.tsx` (`Flaeche`): `if (art === 'kachel') return <div className="h-full w-full bg-[#232323]" />;`.

- [ ] **Step 4: Grün bestätigen** — `npm run selftest -w @jm/connect` und `npm run typecheck -w @jm/connect` (Node 24), danach beide mit Node 22 vorn im PATH → grün; `npm run selftest -w @jm/zoom-bridge` → Exit 0.

- [ ] **Step 5: Commit** — die sieben Quelldateien und vier Tests explizit; `feat(connect): Ersatzbild „Zoom-Kachel“ – Auswahl, Texte, Vorschau (#306)`.

---

### Task 3: Bildart Kachel in der Verzögerungsleitung und im Sender

**Files:**
- Modify: `packages/zoom-bridge/native/delay_line.h:13,76-82,110-124`, `packages/zoom-bridge/native/ndi_sender.h:101-140,232`, `packages/zoom-bridge/native/ndi_sender.cpp:205-227,274-301`, `packages/zoom-bridge/test/selftest.ts:3330-3338` (A9)
- Test: `packages/zoom-bridge/native/delay_line_test.cpp`

**Interfaces:**
- Consumes: —
- Produces:
  - `enum class Bildart : uint8_t { I420, Schwarz, Weiss, Transparent, Kachel };`
  - `DelayLine::Frame::kachel` — `std::shared_ptr<const std::vector<uint8_t>>`, nur bei `Bildart::Kachel` gesetzt
  - `int DelayLine::pushKachel(std::shared_ptr<const std::vector<uint8_t>> puffer, int w, int h, TimePoint arrival);` — legt nichts ab (Rückgabe 0), wenn `puffer` leer ist oder seine Größe ≠ `w*h + 2*(w/2)*(h/2)`
  - `void NdiSender::sendKachel(std::shared_ptr<const std::vector<uint8_t>> i420, int width, int height);`

- [ ] **Step 1: Test schreiben** (`delay_line_test.cpp`, Aufruf in `main()` nach `test_bildarten_pb18()`; `Ausgang::operator()` (`:47`) liefert bei `Bildart::Kachel` `0xEE` statt `f.data.at(0)`)
```cpp
void test_kachel_verweis_306() {
  std::printf("#306 Bildart Kachel: Verweis statt Kopie, Reihenfolge bleibt, kein Puffer bleibt haengen\n");
  DelayLine d;
  const auto p = std::make_shared<const std::vector<uint8_t>>(kLen, uint8_t{46});
  pushBild(d, 1, 0);
  CHECK(d.pushKachel(p, kW, kH, at(10)) == 0);
  pushBild(d, 2, 20);
  CHECK(d.pushKachel(nullptr, kW, kH, at(30)) == 0);
  CHECK(d.pushKachel(std::make_shared<const std::vector<uint8_t>>(kLen - 1), kW, kH, at(31)) == 0);
  CHECK(d.size() == 3);
  CHECK(p.use_count() == 2);                      // genau ein Verweis in der Warteschlange
  std::vector<Bildart> arten;
  bool verweis = false;
  const auto senke = [&](const DelayLine::Frame& f) {
    arten.push_back(f.art);
    if (f.art == Bildart::Kachel) verweis = f.kachel.get() == p.get() && f.data.empty();
  };
  d.release(at(510), milliseconds(500), senke);
  d.release(at(520), milliseconds(500), senke);
  d.release(at(530), milliseconds(500), senke);
  CHECK((arten == std::vector<Bildart>{Bildart::I420, Bildart::Kachel, Bildart::I420}));
  CHECK(verweis);
  CHECK(p.use_count() == 1);                      // weder Warteschlange noch Vorrat halten ihn
  for (int i = 0; i < 5; ++i) d.pushKachel(p, kW, kH, at(600 + i));
  Ausgang a;
  CHECK(d.release(at(1200), milliseconds(500), a).dropped == 4);   // Schwall-Regel wie bei Bildern
  CHECK(p.use_count() == 1);
  d.pushKachel(p, kW, kH, at(1300));
  d.clear();
  CHECK(p.use_count() == 1 && d.size() == 0);
}
```
`selftest.ts` A9: `Bildart::Kachel` in die Liste von `:3337`; neue Prüfung „#306 sendKachel sendet mit ohneVersatz_ direkt, vor jedem pushKachel; releaseDueLocked gibt Bildart::Kachel aus b.kachel aus“ (Muster `:3330-3333`).

- [ ] **Step 2: Rot bestätigen** — `npm run logik-test -w @jm/zoom-bridge` → `delay_line_test.cpp: Übersetzen gescheitert` (`pushKachel` fehlt); `npm run selftest -w @jm/zoom-bridge` → FAIL in A9.

- [ ] **Step 3: Umsetzen** — `delay_line.h` (`#include <memory>`; `recycle` lässt den Verweis mit dem `Frame` fallen). `NdiSender::sendKachel` wie `sendErsatz`: direkt (`ohneVersatz_ || (versatzMsLocked() == 0 && delay_.size() == 0)`) über `fillFrame(f, i420->data(), w, h)`, sonst `pushKachel` + `releaseDueLocked(false)` + `meldeVerworfen`. Senke in `releaseDueLocked`: Zweig `Bildart::Kachel` → `fillFrame(f, b.kachel->data(), b.w, b.h)`. `speicherBytes()` bleibt (den Kachel-Puffer zählt der Slot, Task 7). Kommentar an `sendUYVA` („die vier Bildarten“ → fünf).

- [ ] **Step 4: Grün bestätigen** — `npm run logik-test -w @jm/zoom-bridge` (drei Programme, 0 gefallen), `npm run selftest -w @jm/zoom-bridge` (Exit 0), Bridge bauen → `build\Release\zoom-bridge.exe` neu, Bau ohne Fehler.

- [ ] **Step 5: Commit** — `delay_line.h`, `delay_line_test.cpp`, `ndi_sender.h`, `ndi_sender.cpp`, `test/selftest.ts`; `feat(zoom-bridge): Bildart Kachel – Verweis durch die Verzögerungsleitung (#306)`.

---

### Task 4: Reine Kachel-Inhalte (`kachel_logik.h`, Teil 1)

**Files:**
- Create: `packages/zoom-bridge/native/kachel_logik.h`, `packages/zoom-bridge/native/kachel_logik_test.cpp`
- Modify: `packages/zoom-bridge/scripts/logik-test.mjs:29`, `packages/zoom-bridge/CMakeLists.txt` (nach `:82`), `packages/zoom-bridge/package.json` (`slot-test`), `packages/zoom-bridge/test/selftest.ts:3228` (G-A2-Liste), `packages/zoom-bridge/README.md` (Abschnitt 3, Liste `:96`)

**Interfaces:**
- Consumes: —
- Produces (`namespace kachel`; Einbindungen nur `<algorithm> <cmath> <cstddef> <cstdint> <functional> <memory> <string> <vector>`):
  - `std::vector<uint32_t> utf16Dekodieren(const std::u16string& s);` (einsames Surrogat → U+FFFD) · `std::u16string utf16Kodieren(const std::vector<uint32_t>& cps);`
  - `std::vector<uint32_t> initialen(const std::vector<uint32_t>& name);`
  - `uint32_t fnv1a32(const std::vector<uint32_t>& cps);` · `int farbIndex(const std::vector<uint32_t>& name);`
  - `inline constexpr uint32_t PALETTE[8] = {0x0E72ED, 0xC2410C, 0x15803D, 0x7C3AED, 0xBE123C, 0x0F766E, 0xA16207, 0xDB2777};` · `HINTERGRUND = 0x232323` · `HINWEIS_FARBE = 0xBDBDBD` · `SCHILD_DECKKRAFT = 0.55f`
  - `using Breite = std::function<int(const std::vector<uint32_t>&)>;` · `std::vector<uint32_t> kuerzen(const std::vector<uint32_t>& text, int maxBreite, const Breite& breite);`
  - `struct KachelMasse { int durchmesser, mitteX, mitteY, initialenPx, hinweisPx, hinweisOben, rand, namePx, schildHoehe, schildY, textAbstand, maxTextBreite; };` · `KachelMasse masse(int w, int h);`
  - `enum class ProfilbildFehler : uint8_t { Keiner, KeinPfad, Fehlt, ZuGross, Unlesbar, Frist };` · `const char* fehlerName(ProfilbildFehler f);` (`"keiner","keinPfad","fehlt","zuGross","unlesbar","frist"`)
  - `inline constexpr uint64_t PROFILBILD_MAX_BYTES = 10ull * 1024 * 1024;` · `inline constexpr uint32_t PROFILBILD_MAX_SEITE = 4096;` · `ProfilbildFehler profilbildPruefen(uint64_t bytes, uint32_t w, uint32_t h);`
  - `struct Ausschnitt { uint32_t x, y, seite; };` · `Ausschnitt quadratAusschnitt(uint32_t w, uint32_t h);`
  - `size_t i420Bytes(int w, int h);` · `std::vector<uint8_t> bgraZuI420(const uint8_t* bgra, int w, int h, int stride);` · `std::vector<uint8_t> grundkachelI420(int w, int h);` · `void i420ZuBgr(const uint8_t* i420, int w, int h, std::vector<uint8_t>* bgr);`

- [ ] **Step 1: Tests schreiben** (`kachel_logik_test.cpp`, Gerüst wie `delay_line_test.cpp`: `CHECK`, je Fall eine Funktion mit Titelzeile, Summenzeile „N Pruefungen, M gefallen.“)
```cpp
std::vector<uint32_t> cp(const std::u16string& s) { return utf16Dekodieren(s); }
std::u16string ini(const std::u16string& s) { return utf16Kodieren(initialen(cp(s))); }
std::vector<uint8_t> einfarbig(uint32_t rgb, int w, int h) {   // BGRA, deckend, stride 4*w
  std::vector<uint8_t> b(static_cast<size_t>(w) * h * 4);
  for (size_t i = 0; i < b.size(); i += 4) {
    b[i] = static_cast<uint8_t>(rgb & 0xFF); b[i + 1] = static_cast<uint8_t>((rgb >> 8) & 0xFF);
    b[i + 2] = static_cast<uint8_t>(rgb >> 16); b[i + 3] = 255;
  }
  return b;
}
// Hilfen im Test: kontrast(a, b) nach WCAG 2.x ((L_hell + 0.05) / (L_dunkel + 0.05), sRGB-Leuchtdichte);
// abweichung(bgr, rgb) = groesste Differenz eines Kanals zu rgb ueber alle Bildpunkte eines BGR-Puffers.
double kontrast(uint32_t a, uint32_t b);
int abweichung(const std::vector<uint8_t>& bgr, uint32_t rgb);

void t_utf16() {
  CHECK(cp(u"Anna") == (std::vector<uint32_t>{'A', 'n', 'n', 'a'}));
  CHECK(cp(u"\U0001F3A4") == std::vector<uint32_t>{0x1F3A4});
  CHECK(cp(std::u16string{char16_t(0xD800), u'A'}) == (std::vector<uint32_t>{0xFFFD, 'A'}));
  CHECK(utf16Kodieren({0x1F3A4, 'A'}) == u"\U0001F3A4A");
}
void t_initialen() {
  CHECK(ini(u"Anna Müller") == u"AM");               CHECK(ini(u"anna") == u"A");
  CHECK(ini(u"  Anna   Maria   Müller  ") == u"AM"); CHECK(ini(u"ömer öztürk") == u"ÖÖ");
  CHECK(ini(u"(Gast) Ben") == u"GB");                CHECK(ini(u"\U0001F3A4 Anna") == u"A");
  CHECK(ini(u"Анна Петрова") == u"АП");              CHECK(ini(u"张伟") == u"张");
  CHECK(ini(u"jean-luc picard") == u"JP");           CHECK(ini(u"O\u0308mer") == u"O\u0308");
  CHECK(ini(u"łukasz ćwik") == u"ŁĆ");               CHECK(ini(u"ÿves") == u"\u0178");
  CHECK(ini(u"ς") == u"Σ");                          CHECK(ini(u"ά") == u"\u0386");
  CHECK(ini(u"") == u"");  CHECK(ini(u" \u00A0\u3000") == u"");  CHECK(ini(u"\U0001F3A4\U0001F3AC") == u"");
}
void t_farbe() {
  CHECK(fnv1a32(cp(u"Ben")) == 4128311196u);   CHECK(fnv1a32(cp(u"")) == 2166136261u);
  CHECK(farbIndex(cp(u"Anna Müller")) == 3);   CHECK(farbIndex(cp(u"  Anna Müller ")) == 3);
  CHECK(farbIndex(cp(u"Carla")) == 0);
  for (const uint32_t f : PALETTE) CHECK(kontrast(f, 0xFFFFFF) >= 4.5 && kontrast(f, HINTERGRUND) >= 2.0);
}
void t_kuerzen() {
  const Breite b10 = [](const std::vector<uint32_t>& t) {   // 10 px je Code-Punkt, Kombinationszeichen 0 px
    int n = 0;
    for (const uint32_t c : t) n += (c >= 0x0300 && c <= 0x036F) ? 0 : 10;
    return n;
  };
  const Breite alle10 = [](const std::vector<uint32_t>& t) { return static_cast<int>(t.size()) * 10; };
  CHECK(kuerzen(cp(u"Anna"), 100, b10) == cp(u"Anna"));
  CHECK(kuerzen(cp(u"Abcdefghij"), 100, b10) == cp(u"Abcdefghij"));      // genau 100 passt
  CHECK(kuerzen(cp(u"Abcdefghijk"), 100, b10) == cp(u"Abcdefghi…"));
  CHECK(kuerzen(cp(u"Abcdefgh jk"), 100, b10) == cp(u"Abcdefgh…"));      // Leerraum vor „…“ faellt weg
  CHECK(kuerzen(cp(u"Abcdefghe\u0301zz"), 100, b10) == cp(u"Abcdefghe\u0301…"));
  CHECK(kuerzen(cp(u"Abcdefghe\u0301z"), 100, alle10) == cp(u"Abcdefgh…"));   // nie vor einem Kombinationszeichen
  CHECK(kuerzen(cp(u"Abcdefgh\U0001F469\u200D\U0001F4BB"), 100, alle10) == cp(u"Abcdefgh…"));   // ZWJ-Folge ganz
  CHECK(kuerzen(cp(u"Anna"), 5, b10) == cp(u"…"));
  CHECK(kuerzen(cp(u""), 100, b10).empty());
}
void t_masse() {
  const KachelMasse m = masse(1280, 720);
  CHECK(m.durchmesser == 288 && m.mitteX == 640 && m.mitteY == 324 && m.initialenPx == 115 && m.hinweisPx == 32);
  CHECK(m.hinweisOben == 497 && m.rand == 18 && m.namePx == 36 && m.schildHoehe == 58 && m.schildY == 644);
  CHECK(m.textAbstand == 14 && m.maxTextBreite == 1216);
  const KachelMasse g = masse(1920, 1080);
  CHECK(g.durchmesser == 432 && g.mitteY == 486 && g.initialenPx == 173 && g.hinweisOben == 745 && g.schildY == 967 && g.maxTextBreite == 1822);
  const KachelMasse k = masse(640, 360);
  CHECK(k.durchmesser == 144 && k.mitteY == 162 && k.initialenPx == 58 && k.hinweisOben == 248 && k.schildY == 322 && k.maxTextBreite == 608);
}
void t_masse_invarianten() {
  const int groessen[6][2] = {{640, 360}, {1280, 720}, {1920, 1080}, {360, 640}, {640, 480}, {320, 180}};
  for (const auto& g : groessen) {
    const KachelMasse m = masse(g[0], g[1]);
    CHECK(m.mitteX - m.durchmesser / 2 >= 0 && m.mitteX + m.durchmesser / 2 <= g[0]);
    CHECK(m.mitteY - m.durchmesser / 2 >= 0 && m.hinweisOben + m.hinweisPx * 3 / 2 <= m.schildY);
    CHECK(m.schildY >= m.rand && m.maxTextBreite > 0);
  }
}
void t_profilbild() {
  CHECK(profilbildPruefen(PROFILBILD_MAX_BYTES, 100, 100) == ProfilbildFehler::Keiner);
  CHECK(profilbildPruefen(PROFILBILD_MAX_BYTES + 1, 100, 100) == ProfilbildFehler::ZuGross);
  CHECK(profilbildPruefen(1000, 0, 10) == ProfilbildFehler::Unlesbar);
  CHECK(profilbildPruefen(1000, 4096, 4096) == ProfilbildFehler::Keiner);
  CHECK(profilbildPruefen(1000, 4097, 10) == ProfilbildFehler::ZuGross);
  const Ausschnitt a = quadratAusschnitt(640, 480), b = quadratAusschnitt(300, 500), c = quadratAusschnitt(7, 4);
  CHECK(a.x == 80 && a.y == 0 && a.seite == 480);
  CHECK(b.x == 0 && b.y == 100 && b.seite == 300);
  CHECK(c.x == 1 && c.y == 0 && c.seite == 4);
}
void t_i420() {
  CHECK(i420Bytes(1280, 720) == 1382400u && i420Bytes(4, 2) == 12u);
  const auto yuv = [](uint32_t rgb) { const auto b = einfarbig(rgb, 4, 2); return bgraZuI420(b.data(), 4, 2, 16); };
  CHECK(yuv(0x232323) == (std::vector<uint8_t>{46, 46, 46, 46, 46, 46, 46, 46, 128, 128, 128, 128}));
  CHECK(yuv(0xFF0000)[0] == 82 && yuv(0xFF0000)[8] == 90 && yuv(0xFF0000)[10] == 240);
  CHECK(yuv(0xFFFFFF)[0] == 235 && yuv(0x000000)[0] == 16 && yuv(0x000000)[8] == 128);
  const uint8_t misch[16] = {0, 0, 255, 255, 255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255};   // BGRA: Rot, Blau / Blau, Rot
  const auto m = bgraZuI420(misch, 2, 2, 8);
  CHECK(m.size() == 6 && m[4] == 165 && m[5] == 175);     // U/V aus dem gerundeten Mittel (R 128, G 0, B 128)
  CHECK(grundkachelI420(4, 2) == yuv(HINTERGRUND));
  std::vector<uint32_t> farben(std::begin(PALETTE), std::end(PALETTE));
  farben.push_back(HINTERGRUND);
  farben.push_back(0xFFFFFF);
  for (const uint32_t f : farben) {                         // Rundreise, gemessen: hoechstens 1 je Kanal
    std::vector<uint8_t> bgr;
    const auto y = yuv(f);
    i420ZuBgr(y.data(), 4, 2, &bgr);
    CHECK(bgr.size() == 24 && abweichung(bgr, f) <= 2);   // abweichung: groesste Kanaldifferenz ueber alle Bildpunkte
  }
}
```

- [ ] **Step 2: Die drei Einträge und den G-A2-Wächter ergänzen** — `TESTDATEIEN` + `'native/kachel_logik_test.cpp'`; CMake `add_executable(kachel-logik-test native/kachel_logik_test.cpp)` + `target_compile_options(kachel-logik-test PRIVATE /utf-8)`; `slot-test`: Ziel ` kachel-logik-test` und `&& build\\Release\\kachel-logik-test.exe`; `selftest.ts:3228`: `['slot_logic.h', 'audio_mix.h', 'kachel_logik.h']`; README §3 nennt die vierte Datei.

- [ ] **Step 3: Rot bestätigen** — `npm run logik-test -w @jm/zoom-bridge` → `kachel_logik_test.cpp: Übersetzen gescheitert` (`kachel_logik.h` fehlt); `npm run selftest -w @jm/zoom-bridge` → FAIL „A4 kachel_logik.h bindet nur Standard-Header ein“.

- [ ] **Step 4: `kachel_logik.h` umsetzen** — verbindliche Regeln:
```
Leerraum: U+0009–000D, U+0020, U+00A0, U+1680, U+2000–200A, U+2028, U+2029, U+202F, U+205F, U+3000.
istZeichen (Buchstabe/Ziffer): ASCII 0–9 A–Z a–z; U+00C0–024F ohne U+00D7, U+00F7; U+0370–03FF; U+0400–052F; U+0531–058F;
  U+05D0–05EA; U+0620–064A; U+0900–0DFF; U+0E00–0E7F; U+1100–11FF; U+1E00–1EFF; U+3040–30FF; U+3400–4DBF; U+4E00–9FFF; U+AC00–D7A3.
haengt (gehört zum Zeichen davor): U+0300–036F, U+1AB0–1AFF, U+20D0–20FF, U+FE20–FE2F, U+FE00–FE0F, U+E0100–E01EF,
  U+1F3FB–1F3FF, U+200D.
gross(c): a–z −0x20; U+00E0–00FE ohne U+00F7 −0x20; U+00FF → U+0178; U+0100–0137 und U+014A–0177: ungerade −1;
  U+0139–0148 und U+0179–017E: gerade −1; U+0131 → U+0049; U+03B1–03C9 −0x20, aber U+03C2 → U+03A3; U+03AC → U+0386;
  U+03AD–03AF → U+0388–038A; U+03CC → U+038C; U+03CD–03CE → U+038E–038F; U+0430–044F −0x20; U+0450–045F −0x50; sonst c.
initialen(name): Wörter = Folgen ohne Leerraum. Je Wort der erste istZeichen-Code-Punkt samt der direkt folgenden
  haengt-Code-Punkte („Anfang“); ein Wort ohne istZeichen zählt nicht. Ergebnis = Anfang des ersten Worts, bei mindestens
  zwei zählenden Wörtern dahinter der Anfang des letzten; vom Anfang wird nur der erste Code-Punkt mit gross() umgesetzt.
fnv1a32: h = 2166136261; je Code-Punkt seine vier Bytes, niedrigstes zuerst: h ^= byte; h *= 16777619 (uint32_t).
farbIndex(name) = fnv1a32(name ohne Leerraum an beiden Rändern) % 8.
kuerzen: breite(text) <= max → text. Sonst größtes n mit breite(text[0..n) + U+2026) <= max (binäre Suche, 0 erlaubt);
  solange 0 < n < size und (haengt(text[n]) oder text[n-1] == U+200D): --n; Leerraum am Ende von text[0..n) weg;
  Ergebnis text[0..n) + U+2026.
masse(w, h), s = min(w, h), r(x) = static_cast<int>(std::lround(x)):
  durchmesser r(0.40 s); mitteX w/2; mitteY r(0.45 h); initialenPx r(0.40 durchmesser); hinweisPx r(0.045 s);
  hinweisOben mitteY + durchmesser/2 + r(0.04 s); rand r(0.025 s); namePx r(0.05 s); schildHoehe r(1.6 namePx);
  schildY h − rand − schildHoehe; textAbstand r(0.4 namePx); maxTextBreite w − 2·rand − 2·textAbstand.
profilbildPruefen: bytes > MAX → ZuGross; w == 0 oder h == 0 → Unlesbar; w oder h > 4096 → ZuGross; sonst Keiner.
quadratAusschnitt: seite = min(w, h), x = (w − seite)/2, y = (h − seite)/2.
bgraZuI420 (BT.601, begrenzt, ohne Verschiebung negativer Zahlen):
  Y = ((66R + 129G + 25B + 128) >> 8) + 16;  U = (112B − 38R − 74G + 32896) >> 8;  V = (112R − 94G − 18B + 32896) >> 8;
  U/V aus dem Mittel des 2×2-Blocks ((Summe + 2) / 4 je Kanal); Ebenen Y (w·h), U, V je (w/2)·(h/2) wie fillBlackI420.
grundkachelI420: Y 46, U 128, V 128.  i420ZuBgr: die Formel aus preview.cpp:236-243, ohne Verkleinern.
```

- [ ] **Step 5: Grün bestätigen** — `npm run logik-test -w @jm/zoom-bridge` → vier Programme, 0 gefallen; `npm run selftest -w @jm/zoom-bridge` → Exit 0.

- [ ] **Step 6: Commit** — `kachel_logik.h`, `kachel_logik_test.cpp`, `scripts/logik-test.mjs`, `CMakeLists.txt`, `package.json`, `test/selftest.ts`, `README.md`; `feat(zoom-bridge): Kachel-Inhalte als reine Logik – Initialen, Farbe, Kürzung, Maße, I420 (#306)`.

---

### Task 5: Zeichen-Ablauf je Slot (`KachelStand`, `kachel_logik.h` Teil 2)

**Files:**
- Modify: `packages/zoom-bridge/native/kachel_logik.h`
- Test: `packages/zoom-bridge/native/kachel_logik_test.cpp`

**Interfaces:**
- Consumes: Task 4 `grundkachelI420`, `i420Bytes`
- Produces (`namespace kachel`):
  - `struct Profil { std::u16string name; std::u16string profilbild; };`
  - `struct KachelSchluessel { unsigned ziel = 0; uint64_t profilStand = 0; bool hinweis = false; int w = 0, h = 0; bool mitProfilbild = false; };` + `operator==`
  - `inline constexpr int64_t KACHEL_WARTEN_MS = 50;` · `inline constexpr int64_t KACHEL_FRIST_MS = 2000;`
  - `class KachelStand`, `using Puffer = std::shared_ptr<const std::vector<uint8_t>>;`
    `bool profilLesenNoetig(unsigned ziel) const;` · `void profilGelesen(unsigned ziel, Profil p);` (zählt `profilStand` hoch) · `void profilVeraltet(unsigned id);` (0 = alle) · `const Profil& profil() const;`
    `KachelSchluessel soll(unsigned ziel, bool hinweis, int w, int h) const;` (`mitProfilbild` = Pfad nicht leer und dieser Profilstand nicht aufgegeben) · `bool hat(const KachelSchluessel&) const;` · `bool laeuft(const KachelSchluessel&) const;`
    `void gestartet(const KachelSchluessel&, int64_t jetzt);` · `void fertig(const KachelSchluessel&, Puffer i420);` · `bool fristAbgelaufen(int64_t jetzt) const;` · `void fristAblauf(int w, int h);`
    `bool fehlerMelden();` (höchstens einmal je Profilstand) · `Puffer puffer() const;` · `Puffer ueberbrueckung(unsigned ziel, int w, int h) const;` · `const Puffer& grundflaeche(int w, int h);` · `size_t speicherBytes() const;` · `void leeren();`

- [ ] **Step 1: Tests schreiben**
```cpp
constexpr unsigned A = 16778240, B = 16778241;
const Profil MIT{u"Anna Müller", u"C:\\p.png"};
int64_t at(int ms) { return static_cast<int64_t>(ms); }

void t_stand_profil() {
  KachelStand s;
  CHECK(s.profilLesenNoetig(A));
  s.profilGelesen(A, MIT);
  CHECK(!s.profilLesenNoetig(A) && s.profilLesenNoetig(B));
  s.profilVeraltet(B);
  CHECK(!s.profilLesenNoetig(A));
  s.profilVeraltet(A);
  CHECK(s.profilLesenNoetig(A));
  s.profilGelesen(A, MIT);
  s.profilVeraltet(0);
  CHECK(s.profilLesenNoetig(A));
  s.profilGelesen(A, MIT);
  const KachelSchluessel k = s.soll(A, false, 1280, 720);
  CHECK(k.mitProfilbild && !(k == s.soll(A, true, 1280, 720)) && !(k == s.soll(A, false, 640, 360)) && !(k == s.soll(B, false, 1280, 720)));
  s.profilGelesen(A, MIT);
  CHECK(!(k == s.soll(A, false, 1280, 720)));                    // neuer Profilstand zeichnet neu
  s.profilGelesen(A, {u"Anna", u""});
  CHECK(!s.soll(A, false, 1280, 720).mitProfilbild);
}
void t_stand_ablauf() {
  KachelStand t;
  t.profilGelesen(A, MIT);
  const KachelSchluessel k = t.soll(A, false, 4, 2);
  CHECK(!t.hat(k) && !t.laeuft(k));
  t.gestartet(k, at(1000));
  CHECK(t.laeuft(k) && !t.hat(k) && !t.fristAbgelaufen(at(2999)) && t.fristAbgelaufen(at(3000)));
  const auto p = std::make_shared<const std::vector<uint8_t>>(i420Bytes(4, 2), uint8_t{1});
  t.fertig(k, p);
  CHECK(t.hat(k) && !t.laeuft(k) && t.puffer() == p && !t.fristAbgelaufen(at(9000)));
  CHECK(t.ueberbrueckung(A, 4, 2) == p && t.ueberbrueckung(B, 4, 2) == nullptr && t.ueberbrueckung(A, 8, 2) == nullptr);
  const KachelSchluessel kh = t.soll(A, true, 4, 2);
  t.gestartet(kh, at(4000));
  t.fertig(k, p);                                                // spaetes Ergebnis eines alten Auftrags
  CHECK(t.laeuft(kh) && !t.hat(kh));
}
void t_stand_frist() {
  KachelStand f;
  f.profilGelesen(A, MIT);
  const KachelSchluessel kf = f.soll(A, false, 4, 2);
  f.gestartet(kf, at(0));
  f.fristAblauf(4, 2);
  const KachelSchluessel ko = f.soll(A, false, 4, 2);
  CHECK(!ko.mitProfilbild && !f.laeuft(kf) && !f.hat(ko));      // neuer Auftrag ohne Profilbild
  f.gestartet(ko, at(2000));
  f.fristAblauf(4, 2);
  CHECK(f.hat(ko) && f.puffer() == f.grundflaeche(4, 2));        // aufgegeben: dunkle Flaeche, kein weiterer Auftrag
  CHECK(*f.grundflaeche(4, 2) == grundkachelI420(4, 2) && f.grundflaeche(4, 2) == f.grundflaeche(4, 2));
  f.profilGelesen(A, MIT);
  CHECK(f.soll(A, false, 4, 2).mitProfilbild);                   // neuer Profilstand versucht das Bild wieder
}
void t_stand_fehler_einmal() {
  KachelStand f;
  f.profilGelesen(A, MIT);
  CHECK(f.fehlerMelden() && !f.fehlerMelden());
  f.profilGelesen(A, MIT);
  CHECK(f.fehlerMelden());
  f.fertig(f.soll(A, false, 4, 2), f.grundflaeche(4, 2));
  CHECK(f.speicherBytes() == i420Bytes(4, 2));                   // Puffer und Grundflaeche sind hier derselbe
  f.leeren();
  CHECK(f.puffer() == nullptr && f.speicherBytes() == 0 && f.profilLesenNoetig(A));
}
```

- [ ] **Step 2: Rot bestätigen** — `npm run logik-test -w @jm/zoom-bridge` → `kachel_logik_test.cpp: Übersetzen gescheitert` (`KachelStand` fehlt).

- [ ] **Step 3: Umsetzen** — Zustand: `profilZiel_`, `profil_`, `profilStand_` (beginnt 0; bei 0 ist `profilLesenNoetig` immer wahr), `veraltet_`, `aufgegebenStand_`, `gemeldetStand_`, laufender Auftrag (Merker + Schlüssel + `start_`), `puffer_` + `pufferSchluessel_`, `grund_` + seine Größe. `fertig` speichert immer als `puffer_` und beendet den laufenden Auftrag nur bei gleichem Schlüssel. `fristAblauf`: ohne laufenden Auftrag nichts; mit `mitProfilbild` → `aufgegebenStand_ = profilStand_` und Auftrag weg; sonst `fertig(laufend, grundflaeche(w, h))`. `speicherBytes` zählt jeden verschiedenen Puffer einmal. `leeren` = Grundzustand.

- [ ] **Step 4: Grün bestätigen** — `npm run logik-test -w @jm/zoom-bridge` → vier Programme, 0 gefallen.

- [ ] **Step 5: Commit** — `kachel_logik.h`, `kachel_logik_test.cpp`; `feat(zoom-bridge): KachelStand – Profil, Auftrag, Frist und Speicher je Slot (#306)`.

---

### Task 6: Zeichner, Musterkacheln und Musterprobe

**Files:**
- Create: `packages/zoom-bridge/native/kachel.h`, `packages/zoom-bridge/native/kachel.cpp`, `packages/zoom-bridge/test/kachel-probe.mjs`
- Modify: `packages/zoom-bridge/CMakeLists.txt:45-60` (`native/kachel.cpp`; Link `d2d1 dwrite` hinter `ole32`), `packages/zoom-bridge/native/main.cpp:399-484` (Sonderweg), `packages/zoom-bridge/package.json` (`"kachel-probe": "node test/kachel-probe.mjs"`), `packages/zoom-bridge/test/selftest.ts`, `packages/zoom-bridge/README.md` (Prüfstände)

**Interfaces:**
- Consumes: Task 4 (`initialen`, `farbIndex`, `PALETTE`, `HINTERGRUND`, `HINWEIS_FARBE`, `SCHILD_DECKKRAFT`, `kuerzen`, `masse`, `profilbildPruefen`, `quadratAusschnitt`, `bgraZuI420`, `i420ZuBgr`, `fehlerName`), Task 5 (`KachelSchluessel`)
- Produces (`kachel.h`):
  - `struct KachelAuftrag { std::u16string name; std::u16string profilbild; bool hinweis = false; int w = 0, h = 0; };`
  - `struct KachelErgebnis { std::shared_ptr<const std::vector<uint8_t>> i420; kachel::ProfilbildFehler fehler = kachel::ProfilbildFehler::Keiner; long hresult = 0; int64_t dauerUs = 0; };` (`i420 == nullptr` = Zeichnen gescheitert)
  - `KachelErgebnis kachelZeichnen(const KachelAuftrag& a);` — blockierend; initialisiert COM (MTA) auf dem eigenen Thread; NIE auf dem Hauptthread der Bridge im Meeting
  - `struct KachelJob { kachel::KachelSchluessel schluessel; std::mutex m; std::condition_variable cv; bool fertig = false; KachelErgebnis ergebnis; };`
  - `std::shared_ptr<KachelJob> kachelStarten(KachelAuftrag a, const kachel::KachelSchluessel& k);` (losgelöster `std::thread`) · `bool kachelWarten(KachelJob& j, int64_t ms);` · `bool kachelFertig(KachelJob& j);`
  - `int kachelMuster(const std::wstring& ordner);` — Rückgabe = Exitcode; Befehlszeile `zoom-bridge.exe --kachel-muster <ordner>`

- [ ] **Step 1: Probe und Wächter schreiben**

`test/kachel-probe.mjs [--exe <pfad>] [<ordner>]` (Vorgaben: `binPath()` aus `../src/bridge.ts`, `os.tmpdir()/jm-kachel-muster-<pid>`). Startet die Bridge mit `--kachel-muster <ordner>`, PATH vorn um `%ZOOM_SDK_DIR%\x64\bin` (Muster `test/ndi-probe.mjs:45-49`), stdin sofort zu, Zeitgrenze 60 s. Prüft (je Befund eine FAIL-Zeile, dann Rückgabe 1):
1. Exitcode 0; letzte stdout-Zeile `{"ev":"kachelMuster","fertig":true,"dateien":21,"gleichInitialen":true}`.
2. Diese 21 PNG mit Breite × Höhe aus dem IHDR (Bytes 16–23): `{360p 640×360, 720p 1280×720, 1080p 1920×1080}-{mit-profilbild, initialen, langer-name, bild-unterbrochen}.png`, `720p-kaputtes-profilbild.png`, `720p-riesiges-profilbild.png`, `720p-fehlendes-profilbild.png`, `360x640-initialen.png`, `640x480-mit-profilbild.png`, `320x180-initialen.png`, `720p-chinesisch.png`, `720p-arabisch.png`, `720p-nur-emoji.png`.
3. stderr: genau drei Zeilen mit `Profilbild nicht verwendet`, je eine mit `(unlesbar`, `(zuGross`, `(fehlt`; keine stderr-Zeile enthält `Anna`, `Müller` oder `.png`.
Bei Grün: `kachel-probe: 21 Musterkacheln in <ordner> – alle Prüfungen grün`.

`selftest.ts`, Block „Zoom-Kachel (#306): Zeichner“: `rumpf(kachel.cpp, 'KachelErgebnis kachelZeichnen(')` enthält `CoInitializeEx(nullptr, COINIT_MULTITHREADED)`; `kachelStarten` enthält `.detach()`; CMake baut `native/kachel.cpp` und linkt `d2d1` und `dwrite`; `main.cpp` hat den Zweig `"--kachel-muster"` mit `TerminateProcess(`.

- [ ] **Step 2: Rot bestätigen** — Bridge bauen, `npm run kachel-probe -w @jm/zoom-bridge` → Expected: FAIL (keine Zeile `kachelMuster fertig`; ohne Sonderweg endet die Bridge bei stdin-EOF); `npm run selftest -w @jm/zoom-bridge` → FAIL im neuen Block.

- [ ] **Step 3: `kachel.cpp` umsetzen** (Einbindungen `windows.h`, `wincodec.h`, `d2d1.h`, `dwrite.h`, dann `kachel_logik.h` zwischen `push_macro`/`pop_macro` von `min`/`max` wie `video.h:20-26`)

Verbindliche Gestaltung (alle Maße aus `masse(w, h)`):
- Ziel: `IWICBitmap` w × h `GUID_WICPixelFormat32bppPBGRA`, `CreateWicBitmapRenderTarget` mit `D2D1_RENDER_TARGET_TYPE_SOFTWARE`; Text in Graustufen (`D2D1_TEXT_ANTIALIAS_MODE_GRAYSCALE` — ClearType-Säume überleben I420 nicht), `D2D1_DRAW_TEXT_OPTIONS_ENABLE_COLOR_FONT`.
- Fläche `HINTERGRUND` ganz. Kreis um (`mitteX`, `mitteY`), Durchmesser `durchmesser`: mit Profilbild als `ID2D1BitmapBrush` in `FillEllipse` (glatte Kante), sonst `PALETTE[farbIndex(name)]` und darauf die Initialen weiß, „Segoe UI“ Semibold, `initialenPx`, waagerecht und senkrecht zentriert.
- Hinweis (nur bei `hinweis`): „Bild unterbrochen“, „Segoe UI“, `hinweisPx`, `HINWEIS_FARBE`, waagerecht zentriert, Oberkante `hinweisOben`.
- Namensschild (nur bei nicht leerem Namen): Text = `kuerzen(name, maxTextBreite, b)`, `b` misst mit `IDWriteTextLayout` (ohne Umbruch, `widthIncludingTrailingWhitespace`); Rechteck x = `rand`, y = `schildY`, Höhe `schildHoehe`, Breite Textbreite + 2·`textAbstand`, Eckenradius `schildHoehe/4`, Schwarz mit `SCHILD_DECKKRAFT`; Text weiß, „Segoe UI“, `namePx`, ab x = `rand + textAbstand`, senkrecht zentriert.
- Danach `IWICBitmap::Lock` → `bgraZuI420`.
- Profilbild: leerer Pfad → `KeinPfad`; `GetFileAttributesExW` scheitert → `Fehlt`; `CreateDecoderFromFilename` (`GENERIC_READ`, `WICDecodeMetadataCacheOnDemand`), `GetFrame(0)`, `GetSize` → `profilbildPruefen(bytes, w, h)`; dann `IWICBitmapClipper` (`quadratAusschnitt`) → `IWICBitmapScaler` auf `durchmesser` (`WICBitmapInterpolationModeHighQualityCubic`) → `IWICFormatConverter` 32bppPBGRA → `CreateBitmapFromWicBitmap`; jedes HRESULT-Scheitern von Decoder bis Bitmap → `Unlesbar` mit `hresult`. Jeder Fehler zeichnet weiter mit Initialen.
- `kachelStarten`: Auftrag und `shared_ptr<KachelJob>` in den Thread kopieren, `kachelZeichnen`, dann unter `m` `fertig = true`, `cv.notify_all()`.
- `kachelMuster(ordner)`: Ordner anlegen; mit WIC `_profilbild.png` schreiben (512 × 512, deckend, waagerechter Verlauf 0x0E72ED → 0xDB2777, darüber diagonales Schachbrett 32 px mit 25 % Weiß) und `_riesig.png` (gültiges PNG 5000 × 8, einfarbig — Seite über `PROFILBILD_MAX_SEITE`); `_kaputt.jpg` = 4096 Bytes ohne gültige Bildsignatur (beginnt mit `JMKAPUTT`); `_fehlt.png` gibt es nicht. Namen: normal „Anna Müller“, lang „Prof. Dr. Maximilian Österreicher-Schönberg von Würzburg-Großenhain“, „张伟“, „محمد عبد الله“, „🎤🎬“; `bild-unterbrochen` = normaler Name mit Profilbild und Hinweis. Je Fall das I420-Ergebnis über `i420ZuBgr` als 24-bit-PNG (WIC) — genau das, was der Mischer sieht — und eine stdout-Zeile `{"ev":"kachelMuster","datei":…,"w":…,"h":…,"profilbild":"<fehlerName>","ms":…}`. Die drei kaputten Fälle schreiben je eine stderr-Zeile `Kachel-Muster: Profilbild nicht verwendet (<fehlerName>, HRESULT 0x…) - Initialen`; `gleichInitialen` = ihre I420-Puffer sind bytegleich mit dem von `720p-initialen`. Rückgabe 0 nur bei 21 geschriebenen Dateien und `gleichInitialen`.
- `main.cpp`: Zweig direkt nach `--ndi-selftest`: Ordner aus `CommandLineToArgvW(GetCommandLineW(), …)[2]`, `kachelMuster`, `std::fflush(stdout)`, `TerminateProcess(GetCurrentProcess(), rc)` (Begründung wie `main.cpp:417-434`: ohne InitSDK stürzt ein normales `return` mit 0xC0000409 ab).

- [ ] **Step 4: Grün bestätigen** — Bridge bauen; `npm run kachel-probe -w @jm/zoom-bridge` → Grün-Zeile; `npm run slot-test -w @jm/zoom-bridge` (vier Programme grün); `npm run selftest -w @jm/zoom-bridge` → Exit 0. Die 21 PNG ansehen (Read-Werkzeug): Kreis rund, Name lesbar, gekürzt nur mit „…“, Chinesisch und Arabisch ohne Kästchen, Hinweis nicht über dem Schild. Befund als eine Zeile in den Commit-Text.

- [ ] **Step 5: Commit** — `native/kachel.h`, `native/kachel.cpp`, `native/main.cpp`, `CMakeLists.txt`, `package.json`, `test/kachel-probe.mjs`, `test/selftest.ts`, `README.md`; `feat(zoom-bridge): Kachel zeichnen mit Direct2D/DirectWrite, Musterkacheln (#306)`.

---

### Task 7: Kachel im Slot – Profil, Merker, Senden

**Files:**
- Modify: `packages/zoom-bridge/native/video.cpp` (`struct Slot` `:124-213`, `ersatzbildTick` `:1310-1407`, `slotStatsMelden` `:1476`, neue Funktionen nach `slotsKamera` `:1736`), `packages/zoom-bridge/native/video.h` (nach `:133`), `packages/zoom-bridge/native/callbacks.h:59-84,138,151-152`, `packages/zoom-bridge/native/callbacks.cpp:35-38,78-82,316-325`, `packages/zoom-bridge/native/main.cpp:112-132`, `packages/zoom-bridge/test/selftest.ts`, `packages/zoom-bridge/README.md` (Abschnitt Ersatzbild: Profil, Merker)

**Interfaces:**
- Consumes: Task 1 (`Sent::Tile`, `Fallback::Tile`, `kachelHinweis`), Task 3 (`NdiSender::sendKachel`), Task 5 (`KachelStand`, `KACHEL_WARTEN_MS`), Task 6 (`KachelAuftrag`, `kachelStarten`, `kachelWarten`, `kachelFertig`)
- Produces:
  - `struct MerkerProfil { unsigned id = 0; };` (0 = alle) · `bool callbacksTakeProfil(MerkerProfil* out);`
  - `void slotsProfil(unsigned id);` (video.h)
  - in video.cpp: `kachel::Profil profilLesen(unsigned id);` · `kachel::KachelStand::Puffer kachelFuer(Slot& s, unsigned ziel, bool hinweis, int w, int h, int64_t jetzt);`

- [ ] **Step 1: Wächter schreiben** (`selftest.ts`, Block „Zoom-Kachel (#306): Anbindung“)
  - `video.cpp` enthält `kachelStarten(` und NIE `kachelZeichnen(` („gezeichnet wird nie auf dem Hauptthread“).
  - `rumpf(video, 'kachel::Profil profilLesen(')` enthält `GetAvatarPath(`, `GetUserName(` und `IsParticipantProfilePicturesHidden(`; in `rumpf(video, 'kachel::KachelStand::Puffer kachelFuer(')` steht `rendererSperre()` vor `profilLesen(`.
  - In `ersatzbildTick` ruft `case Sent::Tile:` `sendKachel(` und `kachelHinweis(e.grund)`.
  - `callbacks.cpp`: `onUserNamesChanged`, `onInMeetingUserAvatarPathUpdated`, `onParticipantProfilePictureStatusChange` reihen `g_merkerProfil` ein (letzterer mit `MerkerProfil{0}`); `callbacks.h` hat für die beiden letzten keinen leeren Rumpf mehr.
  - `merkerNehmen` (`main.cpp`): `callbacksTakeProfil(` nach `callbacksTakeSprecher(`, ruft `slotsProfil(`.

- [ ] **Step 2: Rot bestätigen** — `npm run selftest -w @jm/zoom-bridge` → FAIL in allen neuen Prüfungen.

- [ ] **Step 3: Umsetzen**
- `Slot` (nur Hauptthread): `kachel::KachelStand kachel; std::shared_ptr<KachelJob> kachelJob;`
- `profilLesen(id)`: `participantsCtrl()->GetUserByUserID(id)`; Name `GetUserName()`, Pfad `GetAvatarPath()`, beide als `std::u16string` kopiert (`static_assert(sizeof(wchar_t) == 2)`); Pfad leer, wenn `IsParticipantProfilePicturesHidden()`; ohne Regler oder Nutzer leeres Profil.
- `kachelFuer`, in dieser Reihenfolge:
  1. `!rendererSperre() && s.kachel.profilLesenNoetig(ziel)` → `s.kachel.profilGelesen(ziel, profilLesen(ziel))`.
  2. `k = s.kachel.soll(ziel, hinweis, w, h)`.
  3. `s.kachelJob && kachelFertig(*s.kachelJob)` → übernehmen: `s.kachel.fertig(job.schluessel, …)` mit `job.ergebnis.i420`, ist er `nullptr`, mit `s.kachel.grundflaeche(job.schluessel.w, job.schluessel.h)`; Logzeilen (unten); `s.kachelJob.reset()`.
  4. `!s.kachel.hat(k) && !s.kachel.laeuft(k)` → Auftrag (Name, Pfad nur bei `k.mitProfilbild`, `hinweis`, `w`, `h`), `s.kachelJob = kachelStarten(…, k)`, `s.kachel.gestartet(k, jetzt)`; `kachelWarten(*s.kachelJob, KACHEL_WARTEN_MS)` wahr → sofort übernehmen wie in 3.
  5. sonst `s.kachel.laeuft(k) && s.kachel.fristAbgelaufen(jetzt)` → Logzeile, `s.kachel.fristAblauf(w, h)`, `s.kachelJob.reset()`.
  6. Rückgabe: `hat(k)` → `puffer()`; sonst `ueberbrueckung(ziel, w, h)`, wenn nicht `nullptr`; sonst `grundflaeche(w, h)`.
- Logzeilen (stderr, ohne Name und Pfad; den Fehlernamen vorher in eine Variable `art`): `Slot <n>: Zoom-Kachel <w>x<h> in <ms> ms gezeichnet (mit Profilbild|Initialen)`; bei Profilbild-Fehler ∉ {`Keiner`, `KeinPfad`} und `fehlerMelden()`: `Slot <n>: Profilbild nicht verwendet (<art>, HRESULT 0x…) - Initialen`; Frist: `Slot <n>: Zoom-Kachel nach 2000 ms nicht fertig - neu ohne Profilbild`; `i420 == nullptr`: `Slot <n>: Zoom-Kachel nicht gezeichnet (HRESULT 0x…) - dunkle Fläche`.
- `ersatzbildTick`: `case Sent::Tile: s.sender.sendKachel(kachelFuer(s, lage.ziel, kachelHinweis(e.grund), w, h, jetzt), w, h); break;` (`e.grund` = Grund NACH der Entscheidung). Nach der Entscheidung: `lage.fallback != Fallback::Tile || lage.modus == SlotMode::Share` → `s.kachel.leeren(); s.kachelJob.reset();`.
- `slotStatsMelden`: `memKb` zählt `s.kachel.speicherBytes()` dazu.
- `slotsProfil(id)`: für jeden Slot außer Freigabe `s->kachel.profilVeraltet(id)`.
- `callbacks`: Warteschlange `g_merkerProfil` (Muster `g_merkerKamera`, `merkerEinreihen`), Einreihen in den drei Rückrufen, `callbacksTakeProfil`.

- [ ] **Step 4: Grün bestätigen** — `npm run selftest -w @jm/zoom-bridge` → Exit 0; Bridge bauen; `npm run slot-test -w @jm/zoom-bridge` grün; `npm run command-probe -w @jm/zoom-bridge` → die beiden Fälle aus Task 1 an der echten EXE grün; `npm run kachel-probe -w @jm/zoom-bridge` grün.

- [ ] **Step 5: Commit** — `native/video.cpp`, `native/video.h`, `native/callbacks.h`, `native/callbacks.cpp`, `native/main.cpp`, `test/selftest.ts`, `README.md`; `feat(zoom-bridge): Zoom-Kachel im Slot – Profil, Merker, Senden (#306)`.

---

### Task 8: Kochbuch – Handbuch und Panic-SOP

**Files:**
- Modify: `packages/cookbook/content/tool-manuals/tool-jm-connect.md:21,59,131` (+ Bedienliste ab `:115`, Tabelle ab `:209`), `packages/cookbook/content/best-practices/panic-sop.md` (Kopf, neuer Abschnitt nach 2.7), `packages/cookbook/cookbook.json` (gebaut)

**Interfaces:** Consumes: Texte aus Task 2 („Zoom-Kachel“, T61). Produces: —

- [ ] **Step 1: Texte einsetzen** (`lastReviewed: 2026-11-14` in beiden Köpfen)
  - `:59`, Liste der Ersatzbilder: „… („transparent“, „eingefroren“, „schwarz“, „weiß“, „Zoom-Kachel“ – nur Teilnehmer und Aktiver Sprecher: dunkle Kachel wie in Zoom mit Profilbild oder Initialen und Anzeigename; liefert Zoom trotz Kamera an kein Bild, steht „Bild unterbrochen“ darauf; verlässt die Person das Meeting, ist der Slot sofort transparent) …“
  - Bedienliste (nach `:128`): „Für den Downstage-Monitor „Zoom-Kachel“ wählen: Die Redner sehen, ob ein Remote-Gast da ist – Kachel = im Meeting (Kamera aus bzw. Bild unterbrochen), leer = nicht im Meeting.“
  - `:131`: „… zeigt der Slot sein Ersatzbild (bei „Zoom-Kachel“ sofort transparent) …“
  - Tabelle, neue Zeile: „„… · Ersatzbild Zoom-Kachel (Bild unterbrochen)““ | „Die Person ist im Meeting, Zoom meldet die Kamera als an, liefert aber seit über 2 Sekunden kein oder nur fehlerhaftes Bild. Abwarten; bleibt es, die Person bitten, die Kamera aus- und wieder einzuschalten.“
  - `panic-sop.md`, neu „### 2.8 Remote-Gast (Zoom) fehlt am Downstage-Monitor“ — **0–5 Sekunden:** „- [ ] Kachel am DSM? Dann ist der Gast im Meeting (Kamera aus oder „Bild unterbrochen“).“, „- [ ] Leer/transparent? Der Gast ist nicht (mehr) im Meeting – Regie informieren.“ **5–30 Sekunden:** „- [ ] In JM Connect die Zeile des Slots lesen („Wartet auf …“, „Kamera aus“, „Zoom liefert gerade kein Bild“).“, „- [ ] Host im Zoom-Client: Gast aus dem Warteraum zulassen.“, „- [ ] Gast bitten, die Kamera aus- und wieder einzuschalten.“

- [ ] **Step 2: Rot bestätigen** — `npm run cookbook:check` → Expected: „cookbook.json ist veraltet“.

- [ ] **Step 3: Aus LF bauen** (Falle `cookbook-crlf-build-trap`; jede Zeile einzeln)
```
git config --local core.autocrlf false
node -e "const fs=require('fs'); for (const p of ['packages/cookbook/content/tool-manuals/tool-jm-connect.md','packages/cookbook/content/best-practices/panic-sop.md']) fs.writeFileSync(p, fs.readFileSync(p,'utf8').replace(/\r/g,''))"
node -e "const fs=require('fs'); for (const p of ['packages/cookbook/content/tool-manuals/tool-jm-connect.md','packages/cookbook/content/best-practices/panic-sop.md']) if (fs.readFileSync(p,'utf8').includes('\r')) process.exit(1)"
npm run cookbook:build
npm run cookbook:check
```
Expected: die Prüfzeile Exit 0 (keine CR), `cookbook:check` grün.

- [ ] **Step 4: Commit, dann autocrlf zurück** — nur die zwei `.md` und `cookbook.json` stagen (mit `autocrlf=false` zeigt `git status` Phantom-Änderungen: nicht stagen), Nachricht `docs(connect): Handbuch und Panic-SOP – Zoom-Kachel am DSM (#306)`, danach `git config --local --unset core.autocrlf`.

---

### Task 9: Version 0.4.4, Bau, Musterkacheln, Rauchtest, PR

**Files:**
- Modify: `apps/connect/package.json`, `package-lock.json` (über `npm version`)
- Create (außerhalb des Repos): `C:\Users\alexk\AppData\Local\JM-Release\connect-0.4.4\musterkacheln\`, `<scratchpad>/rauchtest-connect-044.mjs`, `<scratchpad>/pr-connect-306.md`

**Interfaces:** Consumes: Tasks 1–8. Produces: Bau-Commit `<bau-sha>`, `apps/connect/release/JM Connect-0.4.4-win-x64.exe` (Größe, SHA-256), PR-Nummer.

- [ ] **Step 1: Stand von Connect 0.4.3 prüfen** — `git fetch origin`, dann `git merge-base --is-ancestor da50a036d9 HEAD`. Exit ≠ 0 heißt: der Stand von 0.4.3 (mDNS-Absturz-Fix, #301; Branch `fix/connect-043-mdns-kontextmenue`) fehlt. Ist er inzwischen auf origin/main: `git merge origin/main` (Konflikte nur in `apps/connect/package.json`/`package-lock.json` erwartet — dort main übernehmen) und Step 3 vollständig. Sonst anhalten und dem Auftraggeber melden. Ohne diesen Stand wird nicht gebaut.

- [ ] **Step 2: Version setzen** — `npm version 0.4.4 -w @jm/connect --no-git-tag-version` → `git status --short` zeigt genau `apps/connect/package.json` und `package-lock.json`.

- [ ] **Step 3: Alles prüfen** — Bridge bauen; `npm run logik-test -w @jm/zoom-bridge`, `npm run slot-test -w @jm/zoom-bridge`, `npm run selftest -w @jm/zoom-bridge`, `npm run command-probe -w @jm/zoom-bridge`, `npm run kachel-probe -w @jm/zoom-bridge`, `npm run selftest -w @jm/connect`, `npm run typecheck -w @jm/connect`, `npm run cookbook:check`; Connect-Selbsttest und Typprüfung zusätzlich mit Node 22. Expected: alles grün.

- [ ] **Step 4: Paket bauen** — fehlt `packages/ndi/build/Release/jm_ndi.node`, zuerst `npm run rebuild:native -w @jm/connect`. Dann `npm run dist:win -w @jm/connect` → `apps/connect/release/JM Connect-0.4.4-win-x64.exe`; Größe und SHA-256 notieren; `bundle-zoom-bridge` meldet die frische EXE, Wächter 1 und 2 ok.

- [ ] **Step 5: Musterkacheln aus der gepackten Bridge** — mit `ZOOM_SDK_DIR`: `node packages/zoom-bridge/test/kachel-probe.mjs --exe "apps/connect/release/win-unpacked/resources/zoom-bridge/zoom-bridge.exe" "C:\Users\alexk\AppData\Local\JM-Release\connect-0.4.4\musterkacheln"` → Grün-Zeile, 21 PNG. Belegt zugleich: die ausgelieferte Bridge lädt und zeichnet.

- [ ] **Step 6: Rauchtest der gepackten App** — `rauchtest-connect-044.mjs` nach Vorlage `C:\Users\alexk\AppData\Local\Temp\claude\5dcb13dfa9326af2\bd35928b-8dd8-42a1-8cc7-6a0db8b37204\scratchpad\szenario-connect.mjs` (CDP über `ws` aus `node_modules` DIESES Worktrees, `apps/connect/release/win-unpacked/JM Connect.exe`, `%APPDATA%\@jm\connect\connect-settings.json` vorher sichern und am Ende IMMER zurückschreiben). Vor dem Start `zoomSlotsFassung: 1` und `zoomSlots` = Slot 1 „Rauch 1“ teilnehmer/`kachel`, Slot 2 „Rauch 2“ freigabe/`kachel`, Slot 3 „Rauch 3“ sprecher/`schwarz` (übrige Felder wie `neuerSlot`). Prüft: (1) `app.getVersion() === '0.4.4'`; (2) nach „Einstellungen“ an Slot 1 ist im Feld „Ersatzbild“ „Zoom-Kachel“ gewählt; (3) an Slot 2 ist „Zoom-Kachel (bei Bildschirmfreigabe transparent)“ gewählt und gesperrt; (4) an Slot 3 „schwarz“; (5) nach dem Beenden stehen in der Datei weiter `kachel`, `kachel`, `schwarz`. Expected: `Rauchtest 0.4.4: 5/5 ok`.

- [ ] **Step 7: Commit, Push, PR**
```
git add apps/connect/package.json package-lock.json
git status --short
git commit -m "chore(connect): Version 0.4.4" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin feat/connect-kachel-306
gh pr create --title "Connect 0.4.4: Ersatzbild „Zoom-Kachel“ für DSM-Slots (#306)" --body-file <scratchpad>/pr-connect-306.md
```
PR-Text: Zusammenfassung, Abnahme ohne Testmeeting (Logik-Tests, Musterkacheln, Rauchtest), `Closes #306`, letzte Zeile `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Expected: CI grün (Node 22, `logik-test` mit g++, Kochbuch-Prüfung). `<bau-sha>` = dieser Commit.

---

### Task 10: Owner-Freigabe, Release-Entwurf, Freigabe-Aufgabe, Abschluss (mit Owner)

**Files:**
- Create (außerhalb des Repos): `<scratchpad>/release-notes-connect-044.md`, `C:\Users\alexk\AppData\Local\JM-Release\connect-0.4.4\freigabe.ps1`
- Modify (eigener Worktree `<scratchpad>/manifest-044`, Branch `release/connect-0.4.4-manifest` von frischem origin/main): `packages/suite-manifest/changelog.json`, `packages/suite-manifest/suite.json`

**Interfaces:** Consumes: Task 9 (`<bau-sha>`, EXE, Größe, PR). Produces: Release `connect-v0.4.4`.

- [ ] **Step 1: Notes und Musterkacheln vorlegen** — `release-notes-connect-044.md` (Form wie Release `connect-v0.4.3`, Punkte mit Leerzeile dazwischen):
  - „Neues Ersatzbild „Zoom-Kachel“ für Zoom-Slots im Modus Teilnehmer und Aktiver Sprecher: Solange kein Kamerabild kommt, zeigt der Slot eine Kachel wie in Zoom – Profilbild oder Initialen und den Anzeigenamen. Liefert Zoom trotz Kamera an kein Bild, steht „Bild unterbrochen“ darauf. Verlässt die Person das Meeting, ist der Slot sofort transparent. Gedacht für den Downstage-Monitor: Redner sehen, ob ein Remote-Gast da ist. (#306)“
  - „Die bisherigen Ersatzbilder (transparent, eingefroren, schwarz, weiß) verhalten sich unverändert.“
  - „Nur Windows (Zoom-Slots gibt es nur dort); das Mac-Paket ist inhaltlich unverändert.“
  - „Companion-Modul unverändert 0.3.0 (jm-suite-companion-0.3.0.tgz am Release connect-v0.4.0).“ und die NDI-Zeile mit der gebündelten Laufzeit-Fassung (wie 0.4.3).
  Dem Owner Notes und den Ordner `C:\Users\alexk\AppData\Local\JM-Release\connect-0.4.4\musterkacheln\` vorlegen. Ohne seine ausdrückliche Freigabe beider: anhalten.

- [ ] **Step 2: Release-Entwurf und lokaler Tag** — `gh release create connect-v0.4.4 --repo AlexmachtCode/alexzvn --draft --prerelease --target <bau-sha> --title "JM Connect 0.4.4 (Zoom-Kachel)" --notes-file <scratchpad>/release-notes-connect-044.md "apps/connect/release/JM Connect-0.4.4-win-x64.exe"`; `gh release view connect-v0.4.4 --repo AlexmachtCode/alexzvn --json isDraft,assets` → Entwurf mit `JM.Connect-0.4.4-win-x64.exe` in der Größe aus Task 9. `git tag connect-v0.4.4 <bau-sha>` — NICHT pushen (ein Tag-Push startet `connect-mac.yml`).

- [ ] **Step 3: Katalog-Commit** — `git fetch origin`; `git worktree add <scratchpad>/manifest-044 -b release/connect-0.4.4-manifest origin/main` (nie `git checkout` im geteilten Hauptordner). Darin: oben in die `connect`-Einträge von `changelog.json` `{ "version": "0.4.4", "date": "<Release-Datum>", "notes": [die ersten drei freigegebenen Zeilen] }` (keine ASCII-Anführungszeichen in den Notes); `node scripts/bump-manifest.mjs connect 0.4.4`; beide Dateien mit `JSON.parse` prüfen; Commit `chore(manifest): connect latestVersion → 0.4.4 + Changelog (Zoom-Kachel #306) [skip ci]` mit Trailer; nicht pushen. `<manifest-sha>` und `<basis-sha>` (origin/main dabei) notieren.

- [ ] **Step 4: Freigabe-Skript und Aufgabe** — `freigabe.ps1` aus `C:\Users\alexk\AppData\Local\JM-Release\connect-0.4.3\freigabe.ps1` kopieren; ersetzen: Kopfkommentar (0.4.4, Zoom-Kachel #306, Zeitpunkt der Notes-Freigabe), `$tag = 'connect-v0.4.4'`, `$tagSha`, `$basisSha`, `$manifestSha`, `$exeName = 'JM.Connect-0.4.4-win-x64.exe'`, `$exeSize`, DMG-Muster `'*0.4.4-mac-*.dmg'`, Logtext „latestVersion 0.4.4“. Probe: `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\alexk\AppData\Local\JM-Release\connect-0.4.4\freigabe.ps1" -Probe` → `freigabe.log` mit den PROBE-Zeilen zu Tag, Entwurf, DMGs, Manifest und „--- Ende“. Aufgabe frühestens nach dem Lauf von 0.4.3 (dessen `freigabe.log` zeigt „Manifest auf main“), im nächsten Fenster:
```
Register-ScheduledTask -TaskName 'JM Connect 0.4.4 Freigabe' `
  -Action (New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\Users\alexk\AppData\Local\JM-Release\connect-0.4.4\freigabe.ps1"') `
  -Trigger (New-ScheduledTaskTrigger -Once -At '<JJJJ-MM-TT> 18:00') `
  -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2))
```

- [ ] **Step 5: Nach dem Lauf prüfen und abschließen** — `freigabe.log` („Tag … gepusht“, „… veröffentlicht“, „Beide DMGs“, „Manifest auf main“); `gh release view connect-v0.4.4 --repo AlexmachtCode/alexzvn` (kein Entwurf, EXE + zwei DMG); `git log origin/main -1 -- packages/suite-manifest/suite.json` zeigt den Manifest-Commit. Dem Owner berichten; erst auf sein „merge“: `gh pr merge <nr> --merge`, dann `Unregister-ScheduledTask -TaskName 'JM Connect 0.4.4 Freigabe' -Confirm:$false`, Worktree `manifest-044` und Branch `release/connect-0.4.4-manifest` entfernen.

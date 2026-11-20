# Auffrisch-Runde (Block 2 nach der COP31) — Entwurf

Stand 2026-11-20 · vom Owner freigegeben am 20.11.2026 („vorschlag passt“) · Grundlage: Roadmap Abschnitt 3, Block 2, und
die Bestandsaufnahme vom 20.11. (unten „B1“–„B6“).

## Warum

Während der COP31 kamen Connect, Presenter, Launcher und Q&A mit dem mDNS-Absturz-Fix aus `packages/discovery`
(364d4af5f8, 00652e7582, 73db781682, 7089e1c389) heraus. Fünf Live-Tools tragen ihn noch nicht und können bei einem kurzen
Netzausfall oder blockiertem mDNS (Port 5353) abstürzen: Timer 0.14.0, Rundown 0.8.0, Battle 0.3.0, Prompter 0.6.0,
Stage Display 0.5.0. Dazu kommen drei kleine Altlasten aus Lane F und eine CI-Bremse.

## Ziele

1. Die fünf Tools mit dem mDNS-Fix ausliefern.
2. Stage Display zeigt die Ad-hoc-Nachricht auch in den beiden Presenter-Ansichten.
3. Jede App mit NDI-Laufzeit legt den Lizenztext der Laufzeit bei (Pflicht aus der NDI-SDK-Lizenz, Abschnitt 3).
4. Der Presenter-Prüfstand misst wieder richtig (Gruppe `ndi`, Fälle 4, 13, 14, 15).
5. Der Presenter-Selbsttest „Standbild“ ist auf langsamen CI-Rechnern verlässlich, ohne seine Aussage zu verwässern.

## Nicht-Ziele

- Kein UX-Umbau (das ist Welle 1 in Block 4). Battle, Timer und Rundown bekommen hier nur einen Neubau.
- Kein `onError`-Durchreichen der mDNS-Fehler ins Log der Tools. Das gehört zur Live-Sicherheit (Block 4, „stille Fehler“).
- Keine NDI-Quelle im Stage Display (eigene Spec `docs/stage-display-ndi`, Block 5). Hier nur die Nachricht.

## Befunde (Bestandsaufnahme 20.11., Stichproben am Code bestätigt)

- **B1 mDNS:** Alle fünf Tools kommen nur über `@jm/discovery` an mDNS (Timer `src/main/index.ts:438`, Prompter `:169`,
  Rundown `src/main/conductor.ts:71`, Battle `src/main/coupling.ts:57`, Stage Display `src/main/index.ts:309`, dazu
  `SuiteControlServer`). `@jm/discovery` wird in den Main-Prozess gebündelt. Ein Neubau nimmt den Fix also mit.
- **B2 Paketsprung:** In `apps/<tool>` gab es seit dem jeweils letzten Tag keine Commits.
  - Timer und Rundown nehmen 33 Paket-Commits mit, geringes Risiko.
  - Battle, Prompter und Stage Display nehmen seit dem 05.07. rund 130 mit, darunter:
    - den Master-Link-Client, der standardmäßig an ist (65adc88aad). Auf einem gekoppelten Rechner melden sich die drei
      Tools erstmals beim Master an.
    - den Verbund-Zwischenspeicher (8c584ce711).
    - die Log-Aufbewahrung von 14 Tagen (b5b52d6e76).
    - %XX-kodierte STATE-Texte (ab1af2b80d, Companion-Modul 0.3.0 dekodiert sie).

  Die Typprüfung aller Workspaces war auf `main` grün.
- **B3 Stage-Display-Nachricht:** `StageScreen.tsx:25-31` kehrt bei laufendem Presenter-Feed früh zurück.
  `PresenterRefScreen`, `PresenterMainScreen` und `PresenterHeader` zeigen `state.config.message` nicht. Stage Display hat
  keinen Selbsttest.
- **B4 NDI-Lizenztext:** Die Mechanik ist `tools/bundle-ndi.mjs` → `resources/bin/<plat>` → electron-builder
  `extraResources`. Presenter (Zeile 41, 68a6031d06) und Connect legen `Processing.NDI.Lib.Licenses.txt` bei. Es fehlt bei
  Titler und Caption (Windows und Mac) sowie bei Switcher und NDI Screen Capture (Windows, kein Mac-NDI). Player hat kein NDI.
- **B5 Prüfstand:** `domVollbild` (`apps/presenter/test/pruefstand.mjs:1500`) sucht den Knopftext „Vollbild“. Seit #309
  heißt die Publikums-Funktion „Publikum Vollbild“ (`PresenterView.tsx:118-124`). Fall 4 und 13 sind damit Messfehler, 14 und
  15 kippen hinterher, weil 13 vor `setzeAn(true)` abbricht.
- **B6 Wackeltest:** `apps/presenter/test/ndi-sender-kern.test.ts:57-69` zählt mit der echten Uhr. Eine 8,3-MB-`every()`-Prüfung
  davor blockiert auf langsamen Runnern 110–120 ms, der Kern holt bis zu zwei Takte nach, und die Zählung landet bei 52–53.

## Wege (erwogen)

- **A · Ein Sammel-Release aller Punkte:** wenige Freigaben, aber Stage Display und die NDI-Lizenz-Patches halten die
  einfachen Neubauten auf, und ein Fehler in einem Teil hält alle an.
- **B · Vier Schritte nach Risiko (gewählt):** Tests zuerst (entsperrt die CI), dann die reinen Neubauten, dann die drei
  Tools mit großem Paketsprung samt Stage-Display-Fix und Rauchtest, zuletzt die Lizenz-Patches.
- **C · Je Tool ein eigener Durchlauf:** maximale Trennung, aber neun Durchläufe mit je eigener Freigabe für Arbeit, die zu
  großen Teilen nur aus Neubauten besteht.

## Entscheidungen (Owner 20.11.)

1. **Schritt 1, nur Tests, kein Release:**
   - Presenter-Prüfstand: `domVollbild` auf „Publikum Vollbild“ umstellen. Fall 14 stellt seine Voraussetzung selbst her
     (NDI an, bis „sendet“), damit ein roter Fall 13 nicht weiterkippt.
   - Wackeltest: `starteNdiSenderKern` bekommt eine Uhr als Parameter (Standard: echte Uhr), der Test läuft mit einer
     simulierten. Er prüft dann genau 50 Sendungen in 2 s, das Nachholen nach einem kurzen Stau und keinen Stoß nach einem
     langen (Zeile 63, bisher ungetestet).
2. **Schritt 2:** Timer 0.14.1 und Rundown 0.8.1, nur Neubau mit Changelog-Zeile zur Stabilität.
3. **Schritt 3:** Battle 0.4.0, Prompter 0.7.0, Stage Display 0.6.0.
   - Stage Display zeigt die Nachricht in der Kopfzeile der Presenter-Ansichten, wie in der freigegebenen Spec
     `2026-11-06-stage-display-ndi-design.md` (Zeilen 48, 88–90). Dazu kommt sein erster Selbsttest (Markup aller drei
     Ansichten enthält die Nachricht), aufgenommen in `ci-checks.yml`.
   - Rauchtest durch den Controller vor dem Release: Start, Suche im Netz, Master-Link.
   - Der Owner wirft nur einen kurzen Blick auf die Nachricht.
4. **Schritt 4:** NDI-Lizenztext in Titler, Caption (Windows und Mac), Switcher und NDI Screen Capture (Windows), je als
   Patch-Release. Der Bau bricht ab, wenn die Datei im SDK fehlt, wie beim Presenter.
5. Tags immer einzeln pushen. Jedes Release, jeder Merge und jeder Push nur mit Owner-OK. Das Release-Fenster der COP31 ist
   vorbei.

## Dem Umsetzer überlassen

- Der genaue Wortlaut der Changelog-Zeilen (der Owner gibt sie frei).
- Wo der Selbsttest des Stage Display liegt und wie er heißt.
- Wie die simulierte Uhr im Einzelnen aussieht, solange der Standard die echte Uhr bleibt und der Release-Code sich nicht
  anders verhält.
- Der Release-Weg je Tool, wie bisher gelebt: CI-Tag für die Suite-Tools; der Presenter-Weg „Windows lokal / Mac per CI“ gilt
  nur für den Presenter.

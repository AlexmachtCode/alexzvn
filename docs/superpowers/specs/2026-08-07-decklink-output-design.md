# `@jm/decklink` — natives DeckLink-Addon (Lane D2a) — Design

**Stand:** 2026-08-07 · Branch `feat/decklink-output` (von `main`) · liefert das Paket, **nicht** die Switcher-Anbindung

Erstes von zwei Vorhaben der Roadmap-Spur **Lane D2** (physischer SDI-Ausgang). Das zweite — die
Anbindung an den JM Switcher (Main-Brücke, Renderer-Pump, Oberfläche, Release) — bekommt eine eigene
Spec, sobald dieses Paket an echter Hardware getragen hat.

## Warum getrennt

D2 als Ganzes ist zu groß für eine Spec, und das Risiko sitzt ausschließlich im nativen Teil: COM,
Taktung, Formataushandlung. Die Switcher-Anbindung ist danach Verdrahtung nach einem Muster, das mit
`@jm/ndi` bereits zweimal gebaut wurde. Dieses Paket liefert **für sich allein prüfbare Software**:
`npm run spike -w @jm/decklink` gibt Farbbalken auf SDI aus, ganz ohne Switcher.

## Was bereits gemessen ist (nicht erneut prüfen)

Alles Folgende wurde am 2026-08-07 auf diesem Rechner belegt, nicht angenommen:

- **SDK:** Blackmagic DeckLink SDK **16.0**, `DECKLINK_SDK_DIR` zeigt auf
  `C:\Users\alexk\Documents\Jakobs Medien\Production Suite\SDKs\Blackmagic_DeckLink_SDK_16.0\Blackmagic DeckLink SDK 16.0`.
  ⚑ **Der Pfad enthält drei Leerzeichen.** Jede Werkzeugzeile, die ihn benutzt, muß zitieren.
- **Das SDK liefert nur IDL, keine fertigen Header.** In `Win/include/` liegen 21 `.idl` und genau eine
  `.h` (`DeckLinkAPIVersion.h`). `DeckLinkAPI.h` und die GUID-Datei `DeckLinkAPI_i.c` **müssen bei
  jedem Bau von MIDL erzeugt werden**. Blackmagics eigene Beispiele tun das über einen
  MSBuild-`<Midl>`-Schritt. Das ist der einzige echte Unterschied zum `@jm/ndi`-Bauweg — dort gibt es
  eine `.lib`, hier nicht.
- **MIDL läuft hier**, aus Visual Studio 18 BuildTools + Windows Kit 10.0.26100, auch vom Pfad mit
  Leerzeichen (Exit-Code 0). Erzeugt `DeckLinkAPI.h` (~758 KB), `DeckLinkAPI_i.c` (~19 KB), `.tlb`.
- **Alle benötigten Schnittstellen existieren in 16.0:** `IDeckLinkOutput`, `GetDisplayModeIterator`,
  `DoesSupportVideoMode`, `CreateVideoFrame`, `EnableVideoOutput`, `ScheduleVideoFrame`,
  `StartScheduledPlayback`, `GetBufferedVideoFrameCount`, `IDeckLinkVideoOutputCallback`,
  `ScheduledFrameCompleted`, `bmdOutputFrameDisplayedLate`, `bmdOutputFrameDropped`,
  `bmdFormat8BitBGRA`, `bmdFormat8BitYUV`.
- **Keine Bibliothek zum Mitliefern.** Anwendungen binden gegen die SDK-Schnittstellen und linken zur
  Laufzeit dynamisch gegen das, was der **Desktop-Video-Treiber** auf dem Zielrechner installiert hat
  (Blackmagic SDK-Doku). Unser Installer bleibt sauber — kein Lizenz- und Bündelungsproblem wie bei NDI.
  Der Preis: ohne installiertes Desktop Video findet die App nichts, und das muß sie sagen können.

## Owner-Entscheidungen, die den Zuschnitt prägen

- Karte ist eine **DeckLink mit SDI-Ausgang**, steckt aber in einem **anderen** Rechner. Hier wird
  gebaut und übersetzt, dort geprüft.
- Der Ausgang bedient **alle vier** Zwecke: Saalbild, externer Rekorder, Regiemonitor und Übergabe an
  fremde Regie. Daraus folgt: **Vorlauf so klein wie möglich und einstellbar**, Format **exakt**.
- **Die Karte gibt das Format vor**, der Switcher folgt (gilt für D2b).
- **Scheibe 1 nur Vollbild**, keine Halbbild-Normen.
- **Scheibe 1 nur Bild**, kein Ton.

## Ziel

Ein natives Addon, das eine DeckLink-Karte findet, ihre Ausgabe-Normen wahrheitsgemäß beschreibt, eine
davon öffnet und BGRA-Vollbilder taktfest ausgibt — und dabei jeden Bildverlust meldet.

## Nicht-Ziele (YAGNI)

- **Keine Switcher-Anbindung.** Kein Main-Prozess, kein Renderer, keine Oberfläche, kein Release.
- Kein Ton, keine Halbbilder, kein Multiview, kein Genlock/Referenz-Eingang, keine Karten-**Eingänge**.
- Kein 4K/UHD, kein Mac, kein Linux. Der Bauriegel überspringt beide stillschweigend.
- **Keine Skalierung im Addon.** Paßt ein Bild nicht zur geöffneten Norm, wird es abgewiesen, nicht
  zurechtgebogen.

## Aufbau

```
packages/decklink/
  binding.gyp                 Addon-Ziel, MIDL-Ausgabe als Quelle + Include
  scripts/generate-idl.mjs    MIDL-Lauf → generated/ (idempotent)
  scripts/maybe-build.mjs     Riegel: ohne DECKLINK_SDK_DIR passiert nichts
  src/addon.cc                die COM-Anbindung
  src/modes.ts                REINE Logik: Normen filtern und abbilden
  index.js / index.d.ts       Addon-Ladepfad + Typen
  test/selftest.ts            Selbsttest der reinen Logik, ohne Hardware
  test/spike.mjs              Sondierlauf an echter Karte
  generated/                  MIDL-Erzeugnisse, gitignored
```

### Der Bauweg

`scripts/maybe-build.mjs` folgt dem `@jm/ndi`-Muster: ohne `DECKLINK_SDK_DIR` wird der native Bau
**übersprungen statt zu scheitern**, damit `npm install` in CI und im Linux-Codespace durchläuft.
Neu davor: `generate-idl.mjs` sucht per `vswhere` die Visual-Studio-Installation, betritt über
`VsDevCmd.bat` deren Umgebung und ruft `midl` mit `/h DeckLinkAPI.h /iid DeckLinkAPI_i.c /out generated`.
Alle Pfade zitiert. Der Lauf ist idempotent: existiert `generated/DeckLinkAPI.h` und ist neuer als die
`.idl`, passiert nichts.

`binding.gyp` nimmt `generated/DeckLinkAPI_i.c` als **zweite Quelldatei** auf (dort stehen die GUIDs)
und `generated/` als Include-Verzeichnis. Es gibt keine Import-Bibliothek — `CLSID_CDeckLinkIterator`
wird zur Laufzeit über `CoCreateInstance` aufgelöst.

### COM-Modell

`init()` ruft `CoInitializeEx(nullptr, COINIT_MULTITHREADED)`. **MTA, nicht STA:** der spätere
`utilityProcess` hat keine Windows-Nachrichtenschleife, ein Wohnungsmodell mit Nachrichtenpumpe würde
dort verklemmen. Die DeckLink-Schnittstellen sind frei threadfähig und brauchen keine Pumpe.

## Die Schnittstelle

```ts
export interface DeckLinkDevice {
  index: number;
  /** Anzeigename der Karte, wie Desktop Video ihn nennt. */
  name: string;
  /** Hat die Karte überhaupt einen Ausgang? Reine Eingangskarten melden false. */
  hasOutput: boolean;
}
export function listDevices(): DeckLinkDevice[];

export interface DisplayMode {
  /** BMD-Kennung als Vierzeichenkürzel, z. B. 'Hp25'. Damit wird geöffnet. */
  mode: string;
  /** Name, wie die Karte ihn liefert, z. B. '1080p25'. */
  name: string;
  width: number;
  height: number;
  /** Bildrate als Bruch, wie die Karte sie führt: 30000/1001 ist NICHT 30. */
  fpsN: number;
  fpsD: number;
  interlaced: boolean;
  /** Kann diese Karte diese Norm mit BGRA ausgeben? Wenn nicht, weist `openOutput()` die
   *  Norm ab — es findet KEINE Wandlung nach UYVY statt (ausdrückliches Nicht-Ziel dieser
   *  Scheibe, siehe „Nicht-Ziele“ oben und `src/addon.cc`). */
  supportsBGRA: boolean;
}
export function listOutputModes(deviceIndex: number): DisplayMode[];

/** Ausgang öffnen. prerollFrames: 2–6, Vorgabe 2. */
export function openOutput(deviceIndex: number, mode: string, prerollFrames?: number): boolean;

/** Ein BGRA-Vollbild einreihen (tight packed, stride = width*4). */
export function scheduleFrameBGRA(buf: Uint8Array, width: number, height: number): boolean;

export interface OutputStats {
  /** Bilder, die die Karte noch vor sich hat. */
  queued: number;
  /** Seit dem Öffnen: von der Karte als zu spät gemeldet. */
  late: number;
  /** Von der Karte verworfen. */
  dropped: number;
  /** Leerlauf-Ereignisse: die Warteschlange lief leer. Wir schicken dabei KEIN Bild
   *  erneut — das zählt nur den Leerlauf. Die KARTE hält währenddessen von sich aus
   *  ihr zuletzt angezeigtes Bild (Hardware-Verhalten, keine Zusage des Addons). */
  repeated: number;
  /** Von UNS abgewiesen, weil die Warteschlange volllief. */
  rejected: number;
  /** Jedes andere Scheitern beim Einreihen — etwa eine im Betrieb gezogene Karte. Ohne
   *  diesen Zähler stünden bei so einem Ausfall ALLE übrigen Zähler still und `stats()`
   *  meldete eine makellose Bilanz, während nichts mehr hinausgeht. */
  failed: number;
  /** Der wirksame Vorlauf (2–6). `0` heißt: kein Ausgang offen. */
  preroll: number;
  scheduled: number;
}
export function stats(): OutputStats;

export function closeOutput(): void;
export function destroy(): void;
```

**`listOutputModes` beschreibt, es urteilt nicht.** Es liefert jede Norm, die die Karte kennt, samt
`interlaced` und `supportsBGRA`. Welche davon benutzbar ist, entscheidet reine TypeScript-Logik in
`src/modes.ts` — dadurch ist die Entscheidung ohne Hardware prüfbar.

`DisplayMode` wird **in `src/modes.ts` definiert**, nicht in `index.d.ts`; die Typdatei re-exportiert von
dort. Sonst müßte die reine Logik aus einer `.d.ts` importieren, und der Selbsttest bekäme den Typ nicht
zu fassen. Dieselbe Trennung wie `@shared/output-quality` im Switcher.

```ts
/** Auflösungen, die der Switcher komponieren kann. */
export const COMPOSABLE = [
  { w: 1280, h: 720 },
  { w: 1920, h: 1080 },
];

export type Unusable = 'interlaced' | 'resolution' | 'framerate';

export interface JudgedMode extends DisplayMode {
  usable: boolean;
  /** Warum nicht — für die ausgegraute Zeile in der Oberfläche. Nie stillschweigend weglassen. */
  reason?: Unusable;
}

export function judgeModes(modes: DisplayMode[]): JudgedMode[];

/** Norm → Switcher-Einstellungen. Bruchraten werden auf die nächste ganze Zahl gerundet. */
export function modeToProgramSettings(m: DisplayMode): { resolution: '720p' | '1080p'; fps: number };
```

Eine Norm ist unbenutzbar, wenn sie **halbbildbasiert** ist, ihre **Auflösung** nicht in `COMPOSABLE`
steht, oder ihre **gerundete Bildrate** keine der vom Switcher angebotenen ist (25/30/50/60 — 23,98p und
24p fallen hier heraus). Der Grund wird mitgeliefert, damit die Oberfläche die Zeile ausgegraut **mit
Begründung** zeigen kann. Eine Liste, aus der etwas kommentarlos fehlt, ist eine Anzeige, die lügt —
das ist die Lehre aus `switcher-v0.10.0`.

**Bruchraten werden bewußt zugelassen und driften bewußt.** 29,97p (30000/1001) und 59,94p sind im
Broadcast verbreitet; sie auszuschließen hieße, die halbe Normenwelt zu verweigern. `modeToProgramSettings`
rundet sie auf 30 bzw. 60, der Switcher taktet also 0,1 % schneller als die Karte — rund ein Bild je
tausend. Das ist keine Nachlässigkeit, sondern die Folge davon, daß unser Bild nicht auf die Karte
synchronisiert ist; es fiele bei exakt 30p genauso an, nur langsamer. Sichtbar wird es in `repeated`
bzw. `rejected`, und genau dafür gibt es diese Zähler. Echte Synchronität bräuchte Genlock — ausdrückliches
Nicht-Ziel.

## Taktung und Vorlauf

Die Karte hat ihren eigenen Quarz, unser Bild kommt später aus einem freilaufenden JS-Timer. Deshalb
**geplante Wiedergabe**, nicht sofortiges Hinausschieben: `openOutput` reiht `prerollFrames` schwarze
Bilder ein und startet dann `StartScheduledPlayback`. Jedes `scheduleFrameBGRA` hängt ein Bild an.

**Vorgabe ist 2 Bilder** — bei 25p also 80 ms bis zum Bild. Owner-Entscheid: der Ausgang bedient auch das
Saalbild, und dort ist Versatz gegen einen live sprechenden Menschen das teurere Übel. Der kleine Vorlauf
ist bewußt die riskantere Einstellung: stockt der Rechner, läuft die Warteschlange eher leer und
`repeated` steigt. Genau dafür ist der Wert einstellbar (2–6) und der Zähler sichtbar — wer im Betrieb
Ruckler sieht, dreht hoch, statt zu raten. Der Laufzeittest an der Karte entscheidet, ob 2 im Alltag trägt.

Die beiden Takte driften über Stunden gegeneinander, die Warteschlange läuft also langsam voll oder
leer. Das Addon fängt beides ab und **zählt es getrennt**:

- Warteschlange über `prerollFrames + 2` → das eingehende Bild wird abgewiesen (`rejected++`).
- Warteschlange auf 0 → wir zählen den Leerlauf (`repeated++`) und setzen die Zeitachse neu,
  schicken aber **kein** Bild erneut. Was währenddessen auf dem SDI-Kabel liegt, entscheidet
  die Karte selbst: sie hält von sich aus ihr zuletzt angezeigtes Bild — das ist
  Hardware-Verhalten, keine Zusage dieses Addons.
- Die Karte meldet über `ScheduledFrameCompleted` selbst `late` und `dropped`.

Ein SDI-Ausgang, der still Bilder frißt, während die Regie ihn für sauber hält, ist der schlimmere
Fehler. Die vier Verlustzähler (`late`, `dropped`, `repeated`, `rejected`) und der Warteschlangenstand
sind über `stats()` abfragbar und gehen in D2b in die Oberfläche. Sie werden **getrennt** geführt, weil
sie verschiedene Ursachen haben: `late`/`dropped` kommen von der Karte und deuten auf einen zu kleinen
Vorlauf, `repeated`/`rejected` kommen von uns und deuten auf Drift oder einen stockenden Zulieferer.
Ein gemeinsamer Zähler „Bildfehler" würde die Diagnose zerstören.

**Threading:** `ScheduledFrameCompleted` ruft der Treiber auf **seinem eigenen Thread**. Der Rückruf
faßt deshalb **kein JavaScript an** — er aktualisiert nur atomare Zähler und gibt Bildpuffer zur
Wiederverwendung frei. `stats()` liest die Zähler. Damit entfällt jede `ThreadSafeFunction`.

## Fehlerbehandlung

Jeder Fehlerpfad liefert eine eigene, unterscheidbare Meldung — nicht ein gemeinsames „ging nicht":

| Lage | Erkennung | Meldung |
|---|---|---|
| Desktop Video nicht installiert | `CoCreateInstance` scheitert (`REGDB_E_CLASSNOTREG`) | „Blackmagic Desktop Video ist nicht installiert." + Download-Verweis (Muster aus `interpreter-v0.2.0`) |
| Keine Karte gefunden | Iterator liefert nichts | „Keine Blackmagic-Karte gefunden." |
| Karte ohne Ausgang | `QueryInterface(IDeckLinkOutput)` scheitert | „Diese Karte hat keinen Ausgang." |
| Karte belegt | `EnableVideoOutput` liefert `E_ACCESSDENIED` | „Die Karte wird von einem anderen Programm benutzt." |
| Norm nicht unterstützt | `DoesSupportVideoMode` sagt nein | „Diese Karte kann diese Norm nicht ausgeben." |
| Bildmaß paßt nicht zur Norm | Vergleich in `scheduleFrameBGRA` | abgewiesen, `false` — **nicht** skaliert |
| Karte im Betrieb gezogen | `ScheduleVideoFrame` scheitert dauerhaft | Ausgabe stoppt sauber, `stats()` bleibt lesbar, kein Absturz |

## Tests

1. **Selbsttest ohne Hardware** (`npm run selftest -w @jm/decklink`, `node --experimental-strip-types`):
   `judgeModes` stuft eine handgeschriebene Normenliste richtig ein — 1080i50 als `interlaced`,
   2160p25 als `resolution`, 1080p2398 als `framerate`, 1080p25 und 720p50 als benutzbar; jede
   unbenutzbare Norm trägt einen Grund. `modeToProgramSettings` bildet 1920×1080 auf `'1080p'` ab und
   rundet 30000/1001 auf 30.
2. **Der Bau selbst** ist die erste echte Prüfung des C++: `npm run rebuild -w @jm/decklink` übersetzt
   gegen das SDK. Ohne Karte, aber mit Compiler.
3. **Ohne Karte lauffähig:**
   `node -e "const d=require('@jm/decklink'); d.init(); console.log(d.listDevices());"` muß auf diesem
   Rechner **eine leere Liste** liefern — nicht abstürzen. Das ist ein gültiges Ergebnis und wird geprüft.

   > **Berichtigt am 2026-08-10.** Ursprünglich stand hier der Aufruf **ohne** `init()`. Das war
   > sachlich falsch: `CoCreateInstance` liefert ohne initialisiertes COM `CO_E_NOTINITIALIZED`, eine
   > leere Liste ist dort unmöglich. Das Addon könnte zwar selbst nachinitialisieren — genau das wäre
   > aber der Fehler, den `init()` verhindern soll: es würde still das MTA-Wohnungsmodell wählen und im
   > Electron-Hauptprozess (STA) mit `RPC_E_CHANGED_MODE` kollidieren. Wer COM hochfährt, entscheidet
   > über das Wohnungsmodell, und diese Entscheidung gehört dem Aufrufer. `init()` bleibt Pflicht;
   > ein Aufruf ohne `init()` bekommt seinen eigenen, unterscheidbaren Satz.
4. **Sondierlauf am Kartenrechner** (`npm run spike -w @jm/decklink`): Karten auflisten, Normen mit
   Urteil und Grund ausgeben, eine Norm öffnen, ein **bewegtes** Testbild senden, danach `stats()`
   ausgeben. Das Programm bleibt Teil der Lieferung — es ist das Werkzeug, mit dem man künftig eine
   fremde Karte prüft, bevor man den Switcher anfaßt.

   **Das Testbild muß bewegt sein, sonst mißt es nichts.** Ein Standbild sieht auf dem Monitor gleich
   aus, ob 25 Bilder je Sekunde ankommen oder eines — es beweist nur, daß irgendwann irgendein Bild
   durchging. Deshalb drei Ebenen in einem Bild, alle mit schlichtem `Uint8Array`-Füllen erzeugt, ohne
   Canvas:
   - **Hintergrund:** acht Farbbalken (Weiß, Gelb, Cyan, Grün, Magenta, Rot, Blau, Schwarz) — die
     Signal- und Farbprüfung.
   - **Laufbalken:** ein weißer, 8 px breiter senkrechter Balken wandert von links nach rechts, **genau
     einen Schritt je Bild**, eine volle Bahn je Sekunde. Fällt ein Bild aus, springt er sichtbar. Das
     ist die eigentliche Messung.
   - **Pulsstreifen:** die oberen 5 % wechseln im Sekundentakt zwischen Schwarz und Weiß. Gegen eine
     Stoppuhr gehalten zeigt er, ob die Karte im richtigen Tempo läuft.

   Schalter, damit das Programm ein Werkzeug bleibt und kein Einmalskript:
   `--device <n>` · `--mode <FourCC>` · `--seconds <n>` (Vorgabe 15) · `--preroll <2..6>`.
   Ohne `--mode` nimmt es die erste benutzbare Norm. Am Ende steht `stats()` — und wenn `repeated`
   oder `rejected` über null steht, sagt das Programm ausdrücklich, was das bedeutet.

### Prüfliste für den Kartenrechner — in dieser Reihenfolge

Aus dem Abschluß-Review. Die Reihenfolge ist nicht beliebig: Punkt 1 entscheidet, ob die übrigen
Messungen überhaupt etwas wert sind.

1. **Kommt der Rückruf überhaupt an?** `npm run spike -w @jm/decklink -- --seconds 20`, dabei den
   Rechner absichtlich belasten. Bleiben `zu-spaet` und `verworfen` hartnäckig **0**, während der
   Laufbalken sichtbar springt, ist der Rückruf nicht installiert — dann ist die ganze Karten-Seite
   von `stats()` blind und **alle** folgenden Messungen sind wertlos.
2. **Gelingt `QueryInterface(IID_IDeckLinkVideoBuffer)`** auf einem per `CreateVideoFrame` erzeugten
   Bild? Scheitert es, kommt kein einziges Bild heraus: schwarzer Ausgang, `eingereiht=0`.
3. **Bild am Monitor:** Farbbalken in der richtigen Reihenfolge (das beweist die BGRA-Byteordnung),
   Laufbalken ohne Sprünge, Pulsstreifen gegen eine Stoppuhr.
4. **Trägt Vorlauf 2 im Alltag?** Zweimal 60 s: `--preroll 2` gegen `--preroll 6`, `repeated` und
   `late` vergleichen. Die Vorgabe 2 ist bewußt die riskantere Einstellung — erst danach entscheiden,
   ob sie bleibt.
5. **Baut sich das Polster nach einem Leerlauf wieder auf?** Leerlauf provozieren (schwere Last
   starten), dann beobachten, ob `warteschlange` dauerhaft bei 1 klebt statt auf `preroll`
   zurückzukommen. Das entscheidet, ob die fehlende Bildwiederholung ein echtes Problem ist.
6. **Feldkennung echter Normen:** meldet die Karte für 1080i50 wirklich `bmdUpperFieldFirst` und
   nicht `bmdUnknownFieldDominance`? Bei „unknown" würde `judgeModes` ein Halbbild als benutzbar
   durchwinken. Der Sondierlauf druckt die Liste — einmal ansehen genügt.
7. **`supportsBGRA` an echter Hardware** für 1080p25 und 720p50. Sagt die Karte nein, ist diese
   Scheibe an ihr nicht benutzbar — bewußt, denn es wird nicht gewandelt.
8. **Karte belegt und Karte gezogen:** zweiten Sondierlauf parallel starten (erwartet „Die Karte wird
   von einem anderen Programm benutzt."), danach die Karte im Betrieb ziehen und prüfen, ob `failed`
   steigt statt daß alles still weiterläuft.

## Was D2b von hier erbt

Die Anbindung braucht genau drei Dinge aus diesem Paket: `listDevices` + `listOutputModes` + `judgeModes`
für die Auswahl, `openOutput`/`scheduleFrameBGRA`/`closeOutput` für den Betrieb, `stats()` für die
Ehrlichkeit. Der Frameweg dorthin ist bereits gebaut: der Renderer wandelt sein Programmbild heute schon
RGBA→BGRA für NDI. Kann die Karte BGRA, geht **derselbe Puffer ohne jede Farbwandlung** hinaus.

## Kein Release

Dieses Paket ist privat (`"private": true`) und wird nicht getaggt. Ausgeliefert wird es erst mit D2b
als Teil des Switchers.

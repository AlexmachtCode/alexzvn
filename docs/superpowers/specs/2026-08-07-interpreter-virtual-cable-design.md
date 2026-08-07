# JM Interpreter — virtuelles Kabel erkennen und benennen (#208) — Design

**Stand:** 2026-08-07 · Branch `feat/interpreter-virtual-cable` (von `main`) · Ziel-Release `interpreter-v0.2.0`

## Ausgangsbefund (am Code und am Rechner verifiziert)

Gemeldet in #208: „Virtuelles Kabel lässt nur Lautsprecherauswahl zu, keine Möglichkeit es als
Input/Mikrofon in Zoom zu setzen."

Die Architektur ist richtig und bleibt: der Interpreter mischt Floor + Dolmetscher und **spielt**
den Mix per `setSinkId` in ein virtuelles Kabel; Zoom greift das **andere Ende** desselben Kabels
als Mikrofon ab. Dass die Auswahl nur Wiedergabegeräte zeigt, ist folglich korrekt.

Drei Befunde erklären die Meldung vollständig:

1. **Kein Kabel installiert.** Auf dem Melder-Rechner existiert kein VB-Audio-Gerät. Vorhanden
   sind Dante Virtual Soundcard (`DVS Transmit/Receive`), NDI Webcam Audio und ein
   NVIDIA-Gerät. In Zoom konnte deshalb nichts auftauchen. Dantes Sende- und Empfangsseite sind
   **nicht** intern verbunden (das setzt Routing im Dante Controller voraus) — Dante ersetzt ein
   Loopback-Kabel also nicht von selbst.
2. **Die Anleitung verschwindet im entscheidenden Moment.** Der erklärende Hinweis steht in
   `App.tsx` unter `{!s.outputId && …}`. Sobald ein Ausgabegerät gewählt ist, ist er weg — genau
   dann, wenn der Operator wissen muss, was in Zoom zu wählen ist.
3. **Die Benennung ist von Natur aus verwirrend.** Bei VB-CABLE heißt das *Wiedergabe*-Gerät
   „CABLE **Input**" und das *Aufnahme*-Gerät „CABLE **Output**" — benannt aus Sicht des Kabels,
   nicht aus Sicht des Nutzers. Wer „Input" für „Eingang in Zoom" hält, sucht vergeblich.

## Ziel

Der Interpreter erkennt bekannte virtuelle Kabel, nennt dauerhaft das in Zoom zu wählende
Gegenstück beim exakten Namen, und verweist bei Fehlanzeige auf VB-CABLE — ohne den Livebetrieb je
zu blockieren.

## Nicht-Ziele (YAGNI)

- **Kein Bundling, kein Treiber-Installer.** VB-CABLE ist ein signierter Kernel-Treiber; für
  gewerbliche Nutzung ist er lizenzpflichtig, für Weitergabe ab 10 Einheiten verlangt VB-Audio ein
  individuelles Vertriebsabkommen. Ein Treiber im Installer brächte Adminrechte, Neustart,
  Deinstallations- und Virenscanner-Themen — und Haftung für fremden Kernel-Code.
- **Keine generische Paar-Heuristik.** „Ausgabe X hat ein ähnlich benanntes Eingabegerät" würde
  Dante `DVS Transmit 1-2` fälschlich als Kabel ausweisen und den Operator in die Irre führen.
- **Kein Blockieren.** Der Media Converter darf eine Umwandlung verweigern; ein Live-Tool darf
  sich nicht selbst aussperren — Sonderwege (Dante, NDI, unbekannte Treiber) bleiben nutzbar.
- **Kein Rückweg** (Zoom-Ton als Floor einspeisen) — eigenes Thema, nicht Teil von #208.
- Keine Änderung an Ducking, Pegelanzeige, Einstellungen oder der Start-Logik.

## Modell — `apps/interpreter/src/shared/virtual-cable.ts`

Reine Funktionen, keine Web-Audio- und keine Electron-Abhängigkeit, damit sie im Selbsttest
laufen — dasselbe Muster wie das bestehende `@shared/ducking`.

```ts
export interface CableKind {
  /** Stabile Kennung, z. B. 'vb-cable'. */
  id: string;
  /** Anzeigename, z. B. 'VB-CABLE'. */
  name: string;
  /** Wiedergabe-Geraet: hier spielt der Interpreter hinein. */
  outputMatch: RegExp;
  /** Exakt das, was der Operator in Zoom als Mikrofon waehlt. */
  zoomInputLabel: string;
  /** Prueft, ob die Aufnahme-Gegenseite wirklich existiert. */
  inputMatch: RegExp;
}

/** Erkennt das Kabel hinter einem Wiedergabe-Geraetenamen. null = unbekannt. */
export function detectCable(outputLabel: string): CableKind | null;

/** Ist die Aufnahme-Gegenseite in der Geraeteliste vorhanden? */
export function counterpartPresent(kind: CableKind, inputLabels: string[]): boolean;
```

**Erkannte Kabel:** VB-CABLE, VB-CABLE A und B, VB-CABLE C und D, VoiceMeeter (VAIO, AUX, VAIO3).
Erkennen kostet nichts; empfohlen wird trotzdem nur VB-CABLE.

**Toleranter Abgleich, nicht Gleichheit.** Gematcht wird per Regex auf Kennsubstrings. Chromium
stellt Labels je nach Standardgerät und Sprache ein „Standard - " / „Default - " voran, und die
Klammerzusätze schwanken zwischen Treiberversionen.

## Oberfläche

Der heutige Hinweis unter `{!s.outputId && …}` weicht einem **dauerhaft sichtbaren** Statusblock
direkt unter dem Ausgabe-Picker. Vier Zustände:

| Zustand | Anzeige |
|---|---|
| Kabel erkannt, Gegenstück vorhanden | „In Zoom als Mikrofon wählen: **CABLE Output (VB-Audio Virtual Cable)**" |
| Kabel erkannt, Gegenstück fehlt | Warnung: Treiber unvollständig oder Gerät deaktiviert |
| Unbekanntes Gerät / nichts gewählt | Karte nach LibreOffice-Vorbild: Erklärung, Download-Knopf, Lizenzsatz |
| Gerätenamen leer | „Geräte nicht lesbar — Mikrofonfreigabe erteilen" (statt falsch „kein Kabel gefunden") |

Die Karte nennt VB-CABLE mit Download-Knopf und dem Satz, dass die gewerbliche Nutzung
lizenzpflichtig ist — damit Operator nicht unwissentlich unlizenziert fahren.

`Starten` bleibt unverändert; es hängt weiterhin nur an den beiden Eingängen.

## Verdrahtung

- **`devicechange` abonnieren.** Heute liest `App.tsx` die Geräte einmal beim Aufbau. Ein
  nachinstalliertes Kabel erschiene erst nach Neustart — die Hinweiskarte bliebe stehen, obwohl
  das Problem behoben ist. Beim Ereignis wird `listDevices()` erneut gelesen.
- **Download-Knopf ohne URL-Parameter.** Neue Brücke `cable:openDownload`, die Adresse liegt als
  Konstante im Hauptprozess. Der Media Converter reicht in `main/ipc.ts` beliebige URLs aus dem
  Renderer an `shell.openExternal` durch; dieser offene Kanal wird hier bewusst nicht übernommen.
  Das Preload des Interpreters trägt bisher nur `platform` und bekommt genau diese eine Funktion.

## Fehlerbehandlung

Alle Zustände sind rein anzeigend. Eine fehlende Freigabe, ein unbekanntes Gerät oder ein halb
installierter Treiber führen nur zu einer anderen Meldung — nie zu einem Abbruch und nie zu einer
Sperre des Startknopfs.

## Tests

- **Selbsttest** `apps/interpreter/test/selftest.ts` — existiert bereits (deckt heute `ducking`
  ab) und wird um einen Abschnitt erweitert; das Skript `npm run selftest -w @jm/interpreter`
  bleibt der Einstieg:
  - `detectCable` erkennt VB-CABLE, VB-CABLE A/B, VoiceMeeter — auch mit vorangestelltem
    „Standard - ".
  - **Negativfälle:** Dante `DVS Transmit 1-2` und `Realtek Lautsprecher` ergeben `null`. Dante
    darf nicht als Kabel durchgehen.
  - `counterpartPresent` findet die Aufnahmeseite und meldet sie korrekt als fehlend, wenn nur
    das Wiedergabegerät existiert.
  - Der bestehende Ducking-Selbsttest bleibt unberührt und läuft mit.
- Typecheck und Build für `@jm/interpreter`.
- **Manuell (Owner/Windows):** ohne Kabel → Karte mit Download-Knopf; VB-CABLE installieren →
  Karte verschwindet **ohne Neustart**; „CABLE Input" wählen → exakter Zoom-Hinweis erscheint; in
  Zoom „CABLE Output" als Mikrofon → Ton kommt an.

## Release

`interpreter-v0.2.0` (Minor, CI-gebaut) samt Katalogeintrag. Schließt #208.

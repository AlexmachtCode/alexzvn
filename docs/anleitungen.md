# Geführte Anleitungen: Grundgerüst und Einrichtung im Launcher

Eine geführte Anleitung zeigt im Tool selbst, wie ein Spiele-Tutorial, was zu tun ist: Sie hebt ein Bedienelement hervor,
erklärt es in einer Sprechblase, spricht den Text mit einer beim Bau erzeugten Stimme, erkennt selbst, wann ein Schritt
erledigt ist, und merkt sich den Fortschritt über einen Neustart. Die erste Anleitung ist die **Einrichtung im Launcher**
(sechs Kapitel, ab Launcher 0.17.0). Das Grundgerüst liegt in `@jm/ui` und steht jedem Tool offen.

**Launcher 0.17.0 erscheint ohne Stimme** (Owner-Entscheidung OFP1 vom 20.10.2026, „ohne Ton“, vermerkt in
`HERKUNFT.md`): `manifest.json` hat `stimme: null`, es gibt keine Ansagen, und Sprechblase und Kapitelübersicht sagen „In
dieser Fassung gibt es keine Stimme.“ Alles andere läuft gleich; die Stimme kommt mit einem späteren Update (Abschnitt 7).

Spec: `docs/superpowers/specs/2026-10-17-gefuehrte-anleitungen-design.md`. Plan: `docs/superpowers/plans/2026-10-19-gefuehrte-anleitungen.md`.
Für Bediener: Kochbuch-Rezept „JM Launcher — geführte Einrichtung (Erste Schritte)“
(`packages/cookbook/content/tool-manuals/launcher-gefuehrte-einrichtung.md`).

## 1 · Bausteine

| Datei | Aufgabe |
| --- | --- |
| `packages/ui/src/lib/anleitung.ts` (Export `@jm/ui/anleitung`) | Format, Bedingungen, `pruefeAnleitung`, `sprechTexte`, Ablauf `anleitungSchritt`, Ansicht `anleitungAnsicht`, Start `beimStart`, Speicher `leseFortschritt`/`schreibeFortschritt`. Reiner Kern ohne DOM und ohne Laufzeit-Importe: lädt auch unter `node --experimental-strip-types` (Launcher-Selbsttest, Skripte). |
| `packages/ui/src/lib/anleitung-dom.ts` | `findeZiel`, `zielStand`, `neueMessung`, `blasenPlatz`, `blasenLage`, `anleitungTaste`, `fokusInBlase`, `blasenTaste`, `blasenFokus` (reine Helfer, mit Attrappen getestet; `zielStand` und `neueMessung` sind der Körper von `useAnleitungsZiel`, die zwei letzten die Körper von Tasten-Handler und Fokus-Effekt der Sprechblase) |
| `packages/ui/src/lib/useAnleitungsZiel.ts`, `packages/ui/src/lib/useAnsage.ts` | Ziel vor dem Malen, alle 250 ms und bei `resize` messen (bis zur ersten Messung einer Kennung „ungemessen“); Ansage abspielen, stoppen, Fehler melden |
| `packages/ui/src/components/AnleitungsSchicht.tsx` | Abdunkeln, Hervorhebung, Sprechblase (`AnleitungsBlase`), Bedienleiste, Zähler; nicht modal |
| `packages/ui/src/components/AnleitungsUebersicht.tsx` | Kapitelübersicht mit Zeichen, „Zeig mir“, „Brauche ich nicht“, Stimmen-Schalter |
| `apps/launcher/src/renderer/src/anleitung/einrichtung.ts` | die Anleitung „Einrichtung“, Launcher-Texte, Speicher-Schlüssel, `ZIEL_KENNUNGEN` |
| `apps/launcher/src/renderer/src/lib/anleitung-zustand.ts` | Adapter: Eingang aus den Zuständen von Launcher und Verbund (`anleitungsEingang`, der einzige Konstruktor), Store-Zustände → benannte Bedingungen, Produktion, Detailzeilen, Startentscheidung, Knopf „Erste Schritte“; dazu der Treiber `erzeugeAnleitungsTreiber` (Start, Ereignisse, Merken, Produktion und „unklar“), den der Launcher-Selbsttest mit dem echten Ablaufkern und Attrappen prüft |
| `apps/launcher/src/renderer/src/store/anleitung.ts` | Store: reicht dem Treiber Ablaufkern, Speicher, Uhr, Wecker und den Eingang aus `anleitungsEingang`, Abos auf `useTools` und `useVerbund`, Steuerebene lesen, Stimme je Rechner |
| `apps/launcher/src/renderer/src/components/Anleitung.tsx` | Overlay im Launcher (Ebene `z-[65]`), Stimme, Produktionsmodus |
| `apps/launcher/src/renderer/src/components/OnboardingModal.tsx` | Kapitelübersicht an der Stelle der alten Checkliste (Ebene `z-40`) |
| `apps/launcher/src/renderer/src/anleitung/stimme.ts`, `apps/launcher/src/renderer/src/anleitung/stimme/` | Ansagen (`*.ogg`; in Launcher 0.17.0 keine), `manifest.json`, `HERKUNFT.md` |
| `apps/launcher/scripts/stimme-manifest.mjs`, `anleitung-stimme.mjs`, `pruefe-bau-stimme.mjs` | Prüfsummen und Prüfung, Erzeuger, Bau-Prüfung |

## 2 · Format einer Anleitung

Jede Anleitung ist **eine TypeScript-Datei** mit `export const ‹NAME›: Anleitung` und nur `import type`; so lesen sie der
Compiler, Vite, der Selbsttest und das Erzeuger-Skript gleichermaßen. Aufbau:

- `einleitung`, `rueckfrage`, `abschluss`: Sprechblasen mit den festen IDs `einleitung`, `rueckfrage`, `abschluss`.
- `wiederfinden`: angezeigter Hinweis an Schritten mit `ueberspringenHinweis` (geht ohne Internet, zweiten Rechner oder
  Master nicht).
- `kapitel[]`: `id`, `titel`, `kurz` (Übersicht), `erledigt` (gesprochener Text der Blase „Schon erledigt“), `erledigtWenn`,
  `brauchtNicht`, `schritte[]`.
- Schritt: `id` (Kapitel-ID, Punkt, Name, z. B. `k2.katalog`), `art` (`erklaeren`, `handeln`, `entscheiden`, `neustart`),
  `text` (ein bis drei kurze Sätze), optional `sprechtext`, `ziel` (Kennung, Abschnitt 5), `zielFehlt` (was zu tun ist, wenn
  das Ziel fehlt), `ueberspringenHinweis`, `giltWenn`, `eingriff`; `erledigtWenn` ist bei `handeln` Pflicht und sonst
  verboten, `optionen` bei `entscheiden` Pflicht und sonst verboten.

Bedingungen sind **Daten, nie Funktionen**: `{ zustand }` (live vom Tool), `{ ereignis }` (einmal vom Tool gemeldet und im
Fortschritt gemerkt), `{ entscheidung }` (ausdrückliche Wahl des Bedieners in der Sprechblase), `{ alle }`, `{ eineVon }`,
`{ nicht }`. Ein unbekannter oder fehlender Name ist falsch. Eine Voreinstellung zählt nie als erledigt: Rolle „Aus“ nach
der Installation ist keine Entscheidung, darum braucht Kapitel 3 dort die Wahl „Ich arbeite allein an diesem Rechner“.

```ts
{
  id: 'k2', titel: 'Tools installieren', kurz: '…', erledigt: 'Auf diesem Rechner ist schon mindestens ein Tool installiert.',
  erledigtWenn: { zustand: 'toolInstalliert' }, brauchtNicht: true,
  schritte: [
    { id: 'k2.reiter', art: 'handeln', ziel: 'reiter.werkzeugkasten', erledigtWenn: { zustand: 'reiterWerkzeugkasten' }, text: '…' },
    { id: 'k2.katalog', art: 'erklaeren', ziel: 'werkzeugkasten.kategorien', zielFehlt: 'Öffne zuerst den Reiter „Werkzeugkasten“.', text: '…' },
  ],
}
```

`pruefeAnleitung(anleitung, namen)` meldet jeden Verstoß: doppelte oder ungültige IDs, Schritt-ID ohne Kapitel-Präfix,
falsche Pflichtfelder je Art, unbekannte Zustands-, Ereignis- und Entscheidungsnamen, ungültige Kennung, leerer Text,
ASCII-Anführungszeichen, mehr als drei Sätze, Kapitel ohne Schritt. Der Launcher-Selbsttest prüft die Einrichtung damit;
für jedes Kapitel muss es in jeder Rolle mindestens einen geltenden Schritt geben.

## 3 · Ablauf, Anzeige, Speicher

- **Zustände eines Kapitels:** erledigt (Haken ✓), nicht gebraucht (Zeichen –), übersprungen (bleibt offen, ohne Haken),
  offen. Erfüllt das Kapitel seine Bedingung, ist es erledigt, auch wenn es vorher übersprungen oder als nicht gebraucht
  markiert war. Nur „erledigt“ bekommt einen Haken; jedes Zeichen hat sein Wort für Screenreader.
- **Bedienleiste:** „Zurück“, „Weiter“, „Überspringen“ (das Kapitel), „Später weiter“ (pausieren) und je Kapitel „Brauche ich
  nicht“. „Weiter“ gibt es bei Erklär-Schritten, bei „Schon erledigt“, im Modus „Nur zeigen“ und bei Handlungs-Schritten,
  die beim Betreten schon erfüllt waren. Ein Handlungs-Schritt geht von selbst weiter, sobald seine Bedingung von „nicht
  erfüllt“ zu „erfüllt“ wechselt; im Modus „Nur zeigen“ (nach „Zurück“, bei „Zeig mir“ auf einem erledigten Kapitel)
  geht nichts von selbst weiter.
- **Zähler:** „Schritt ‹n› von ‹m›“ zählt die Kapitel (sechs in der Einrichtung), nicht die Sprechblasen.
- **Fortsetzen:** Nach „Später weiter“ oder einem Beenden mitten im Ablauf startet die Anleitung beim nächsten Start nicht
  von selbst; der Knopf „Erste Schritte“ zeigt „Einrichtung fortsetzen · Schritt ‹n› von ‹m›“. Von selbst weiter geht es
  nur nach einem Neustart, den ein Schritt der Art `neustart` verlangt hat (Kapitel 5, sichere Steuerebene). Eine
  Tool-Installation startet den Launcher nicht neu; ein Launcher-Update zählt nicht als verlangter Neustart. Der Knopf
  „Erste Schritte“ pausiert eine laufende Anleitung und öffnet die Übersicht; an der Rückfrage geht sie dabei zurück zur
  Begrüßung, am Abschluss wirkt er wie „Weiter“ (dann ist nichts fortzusetzen).
- **Erster Start und bestehende Rechner:** Von selbst startet die Anleitung nur, wenn ihr Speicher lesbar und leer ist und
  `jmps:onboardedV1` fehlt. Ein Rechner, der die alte Checkliste schon kannte, bekommt eine Sitzung lang den Hinweis „Neu:
  geführte Einrichtung“ am Knopf. Startet die Anleitung von selbst, erscheint „Was ist neu?“ erst, wenn sie pausiert oder
  endet; beim ersten Start gilt die installierte Fassung als gesehen.
- **Abgeschlossen:** jedes Kapitel erledigt oder nicht gebraucht, oder der Bediener hat „Anleitung beenden“ bzw. „Ja,
  überspringen“ gewählt; dann startet sie nicht mehr von selbst. Die Übersicht sagt „Einrichtung abgeschlossen“ nur, wenn
  jedes Kapitel erledigt oder nicht gebraucht ist; nach dem Beenden mit offenen Kapiteln sagt sie „Anleitung beendet. Offene
  Schritte kannst du hier einzeln mit „Zeig mir“ ansehen.“
- **Speicher:** `localStorage` des Launchers, Schlüssel `jmps:anleitung:einrichtung` (JSON mit `format: 1`) und
  `jmps:anleitungStimme` (`aus`, `an` oder fehlt; nur `aus` schaltet ab). Der Kern bekommt den Speicher eingespeist (Quellregel von `@jm/ui`). Nicht
  lesbar: kein automatischer Start, Ablauf nur im Speicher, Diagnose „Der Fortschritt kann auf diesem Rechner nicht gelesen
  werden. Die Anleitung startet deshalb nicht von selbst.“ Nicht schreibbar: „Der Fortschritt kann auf diesem Rechner nicht
  gemerkt werden.“ Kaputt: „Der gemerkte Fortschritt war unlesbar; die Anleitung beginnt neu.“ Von einer neueren Fassung:
  „Der Fortschritt stammt von einer neueren Fassung und bleibt unverändert.“ (wird nie überschrieben). Die Diagnosen stehen
  in der Übersicht; solange nichts gemerkt wird (nicht lesbar, nicht schreibbar, neuere Fassung), steht „Der Fortschritt kann
  auf diesem Rechner nicht gemerkt werden.“ auch unter jeder Sprechblase, und bei nicht lesbarem Speicher zeigt der Knopf
  „Neu: geführte Einrichtung“ in jeder Sitzung, bis die Übersicht offen war.
- **Darstellung:** Die Schicht liegt im Launcher auf `z-[65]`: über den Dialogen (`z-40`, `z-50`) und dem Show-Lade-Overlay
  (`z-[60]`), unter der Meldung (`z-[70]`). Sie fängt keine Klicks außer in der Sprechblase; die Sprechblase trägt
  `noDragRegion`. Schritte ohne Ziel (Begrüßung, Entscheidungen) dunkeln ganz ab; fehlt ein Ziel zur Laufzeit, wird
  nicht abgedunkelt und nichts hervorgehoben. Bis das Ziel eines Schritts gemessen ist, zeigt die Sprechblase weder eine
  Hervorhebung noch „Ziel fehlt“ (gemessen wird vor dem Malen). Sie hängt an der Kante zum Ziel, auch wenn sie kürzer ist
  als geplant; passt sie neben ein großes Ziel an keine Seite, steht sie in der Fensterecke, in der sie am wenigsten davon
  abdeckt, nie mittig darüber.
- **Tastatur und Screenreader:** Tab und Enter bleiben nativ. Escape heißt „Später weiter“, aber nur mit dem Fokus in der
  Sprechblase. Die Sprechblase ist ein nicht modaler Dialog (`role="dialog"`, `aria-modal="false"`) mit Namen aus Kapitel
  und Zähler; neue Texte kommen über `aria-live="polite"`, ohne den Fokus zu verschieben.

## 4 · Regeln für jede Anleitung

- **Sie bedient nichts.** Kern, Komponenten, Adapter, Store und Overlay rufen keine handelnde Aktion: nicht `openShow`,
  `openShowPath`, `install`, `update`, `updateAll`, `uninstall`, `updateLauncher`, `saveShow`, `saveSettings`,
  `provisionControl`, `disableControl`, `checkUpdates`, keine Aktion von `useVerbund` außer Lesen, keine Mastersuche, kein
  `window.jmps.*` außer der Lese-IPC `getControlStatus`. Sie öffnet auch keine Dialoge von selbst. Ein Quelltext-Wächter
  im Launcher-Selbsttest hält das fest. Direkte Aktionen der Kapitelübersicht sind Klicks des Bedieners.
- **Sie bringt nie etwas auf Sendung.** Auch „Tools aus der Show starten“ klickt der Bediener selbst.
- **Produktion:** Läuft auf diesem Rechner ein Tool, startet gerade eine Show, ist eine iveo-Show aktiv (sie bleibt es bis zur
  nächsten Show ohne iveo, auch nach dem Beenden der Tools) oder folgen am Master Tools anderer Rechner der verteilten Show,
  ist die Stimme von selbst aus; die Sprechblase sagt „Die Stimme ist aus, weil gerade eine Produktion läuft.“ und bietet „Stimme trotzdem
  an“ (gilt nur bis zum Ende dieser Produktion; die nächste beginnt wieder still). Schritte mit `eingriff: true` laufen dann nur im Modus „Nur zeigen“, vor ihrem Text
  steht „Gerade läuft eine Produktion. Ich zeige dir nur, wo es ist; mach es, wenn die Produktion vorbei ist.“, und sie
  werden nie gesprochen, auch nicht mit „Stimme trotzdem an“ (Spec 7: nur zeigen, nicht auffordern).
- **Kurz nach dem Start:** Die Tools melden sich erst mit ihrem nächsten Herzschlag (bis zu 10 s). Sind Tools installiert und
  ist keins als laufend bekannt, gilt die Lage 12 s lang als unklar: Stimme aus, Eingriffe nur zeigen, aber ohne Warnung; die
  Sprechblase sagt „Die Stimme wartet noch kurz: Ob gerade eine Produktion läuft, sehe ich erst ein paar Sekunden nach dem
  Start des Launchers.“ Danach spricht die Stimme, sofern keine Produktion läuft (Owner-Frage OFP5).
- **Ohne Stimme (Launcher 0.17.0):** Die Stimmen-Sätze der zwei Punkte davor („Die Stimme ist aus, weil …“, „Stimme trotzdem
  an“, „Die Stimme wartet noch kurz …“) erscheinen nie; an ihrer Stelle steht „In dieser Fassung gibt es keine Stimme.“
  „Nur zeigen“ und die Warnung vor dem Text gelten auch ohne Stimme. In den 12 s nach dem Start zeigt ein Schritt mit
  `eingriff` dann „Nur zeigen“ ohne Begründung (Folgepunkt für das Stimm-Update, Ruling K12 der Umsetzung).
- **Ehrlich:** Kein Haken ohne erfüllte Bedingung, kein Zeiger ins Leere. Fehlt ein Ziel zur Laufzeit, steht unter dem Text
  der Sprechblase, was zu tun ist: der `zielFehlt`-Text des Schritts, und nur, wo ein Schritt keinen hat, „Das Bedienelement
  ist gerade nicht zu sehen.“ In der Einrichtung hat jeder Schritt mit Ziel einen eigenen `zielFehlt`-Text.
- **Texte:** kurz, in Bedienersprache, mit „ “ (nie ASCII-Anführungszeichen), echte Umlaute. Neue oder geänderte Texte gehen
  vor dem Release zur Owner-Freigabe; ändert sich ein gesprochener Text, entsteht seine Ansage neu (Abschnitt 7).

## 5 · Kennungs-Register (Einrichtung im Launcher)

Ziele tragen eine feste Kennung im Attribut `data-anleitung="‹bereich›.‹name›"`, im Quelltext immer als Literal; in Tabellen,
die ein `.map` rendert, als Feld `anleitung: '…'`. Eine Kennung wird nie zusammengesetzt. Tragen mehrere Elemente dieselbe
Kennung (z. B. „Installieren“ je Tool), wird das erste sichtbare hervorgehoben. Der Launcher-Selbsttest prüft beide
Richtungen (jede Kennung der Anleitung steht genau einmal im Renderer, jede Kennung im Renderer gehört zu einer Anleitung) und
hält diese Tabelle wahr: eine Zeile je Kennung, ein Ort, an dem die Kennung steht, und genau die Schritte, die auf sie zeigen.
Orte liegen unter `apps/launcher/src/renderer/src/components/`; „sichtbar, wenn“ sagt, wann `zielFehlt` greift.

| Kennung | Ort | Bedienelement | sichtbar, wenn | Schritte |
| --- | --- | --- | --- | --- |
| `kopf.erste-schritte` | `Header.tsx` | Knopf „Erste Schritte“ | immer | `rueckfrage`, `abschluss` |
| `kopf.einstellungen` | `Header.tsx` | Knopf „Einstellungen“ | immer | `k1.einstellungen` |
| `einstellungen.zugang` | `SettingsModal.tsx` | Bereich „GitHub-Token“ und „Interner Proxy“ | Einstellungen offen | `k1.zugang` |
| `reiter.werkzeugkasten` | `TabBar.tsx` (Feld `anleitung` in `TABS`) | Reiter „Werkzeugkasten“ | immer | `k2.reiter` |
| `werkzeugkasten.kategorien` | `ToolboxView.tsx` | Filterbereich: Suche, Kategorien, Status | Reiter „Werkzeugkasten“ offen | `k2.katalog` |
| `werkzeugkasten.installieren` | `ToolCard.tsx` | Knopf „Installieren“ je Tool, hervorgehoben das erste sichtbare | ein nicht installiertes Tool ist sichtbar | `k2.installieren` |
| `kopf.verbund` | `VerbundBadge.tsx` (eingebunden in `Header.tsx`) | Verbund-Anzeige in der Kopfzeile | Verbund-Stand geladen | `k3.verbund`, `k3.oeffnen` |
| `verbund.rollen` | `VerbundModal.tsx` | Rollen „Aus“, „Master“, „Mit Master verbinden“ | Verbund offen, Rolle bekannt | `k3.rolle` |
| `verbund.koppeln-master` | `VerbundMaster.tsx` | Abschnitt „Rechner koppeln“ (Knopf oder Code) | Rolle „Master“, Master läuft | `k3.master` |
| `verbund.code` | `VerbundSlave.tsx` | Abschnitt „Mit Master verbinden“: Master-Liste, Adresse von Hand, Code, „Koppeln“ | Rolle „Mit Master verbinden“, nicht gekoppelt | `k3.slave` |
| `reiter.show` | `TabBar.tsx` (Feld `anleitung` in `TABS`) | Reiter „JM Show“ | immer | `k4.reiter` |
| `show.vorlage` | `ShowView.tsx` (Feld `anleitung` in `ShowAction`) | Karte „Aus Vorlage starten“ | Reiter „JM Show“ offen | `k4.vorlage` |
| `szenario.auswahl` | `ScenarioPicker.tsx` | vier Vorlagen mit „Los“ | „Was willst du produzieren?“ offen | `k4.szenario` |
| `editor.name` | `ShowEditorModal.tsx` | Feld „Name der Show“ | Show-Editor offen | `k4.name` |
| `editor.iveo` | `ShowEditorModal.tsx` | Block „iveo-Event (optional)“ | Show-Editor offen | `k4.iveo` |
| `editor.speichern` | `ShowEditorModal.tsx` | Knopf „Speichern“ bzw. „Aktualisieren“ | Show-Editor offen | `k4.speichern` |
| `kopf.system` | `Header.tsx` | Knopf „System-Zustand“ | immer | `k5.system` |
| `system.sicher` | `SystemStatusModal.tsx` | Knopf „Sichere Steuerebene aktivieren“ bzw. „Erneuern“ | System-Zustand offen | `k5.sicher` |
| `system.steuerebene` | `SystemStatusModal.tsx` | Karte „Netzwerk & Steuerebene“ | System-Zustand offen | `k5.companion` |
| `kopf.show-oeffnen` | `Header.tsx` | Knopf „Show öffnen“ | immer | `k6.oeffnen` |

## 6 · Bedingungsnamen

Die Namen stellt der Adapter `lib/anleitung-zustand.ts` bereit (`ZUSTANDS_NAMEN`, `EREIGNIS_NAMEN`, `ENTSCHEIDUNGS_NAMEN`);
`pruefeAnleitung` lehnt jeden anderen Namen ab. Der Adapter liest nur, er löst nichts aus. Dazu merkt der Kern selbst das
Ereignis `neustart:‹Schritt-ID›`, wenn der verlangte Neustart stattgefunden hat.

| Name | Art | erfüllt, wenn | gelesen aus |
| --- | --- | --- | --- |
| `quelleVerbunden` | Zustand | Release-Quelle ist Proxy oder GitHub (im Release-Bau immer) | `useTools.settings.source` |
| `toolInstalliert` | Zustand | mindestens ein Tool nicht im Zustand „nicht installiert“ (wie die alte Checkliste) | `useTools.states` |
| `reiterWerkzeugkasten` | Zustand | Reiter „Werkzeugkasten“ offen | `useTools.view` |
| `reiterShow` | Zustand | Reiter „JM Show“ offen | `useTools.view` |
| `einstellungenOffen` | Zustand | Einstellungen offen | `useTools.settingsOpen` |
| `systemOffen` | Zustand | System-Zustand offen | `useTools.systemOpen` |
| `verbundOffen` | Zustand | Verbund-Dialog offen | `useVerbund.offen` |
| `szenarienOffen` | Zustand | Auswahl „Was willst du produzieren?“ offen | `useTools.scenariosOpen` |
| `editorOffen` | Zustand | Show-Editor offen | `useTools.showEditorOpen` |
| `rolleAus` | Zustand | Rolle „Aus“ gelesen (nicht bei unbekanntem Stand oder Dateifehler) | `useVerbund.stand` |
| `rolleMaster` | Zustand | Rolle „Master“ | `useVerbund.stand` |
| `rolleSlave` | Zustand | Rolle „Mit Master verbinden“ | `useVerbund.stand` |
| `slaveGekoppelt` | Zustand | Rolle „Mit Master verbinden“ und gekoppelt | `useVerbund.stand.slave` |
| `slaveVerbunden` | Zustand | gekoppelt und mit dem Master verbunden | `useVerbund.stand.slave.client` |
| `steuerebeneSicher` | Zustand | sichere Steuerebene eingerichtet (wirkt nach dem Neustart; hakt Kapitel 5 nie ab) | Lese-IPC `getControlStatus` |
| `steuerebeneOffen` | Zustand | offene Steuerebene gelesen (nicht, solange nichts gelesen ist) | Lese-IPC `getControlStatus` |
| `showGestartet` | Zustand | mindestens eine Show unter „Zuletzt geöffnet“ (nur Shows mit gestartetem Tool) | `useTools.recentShows` |
| `showGespeichert` | Ereignis | der Show-Editor hat eine Show gespeichert | `saveShow` meldet nach Erfolg |
| `slaveWarVerbunden` | Ereignis | Übergang zu gekoppelt und verbunden; bleibt gemerkt, wenn der Master später aus ist | Adapter beim Zustandswechsel |
| `steuerebeneAktiviert` | Ereignis | Übergang offen → sicher in einer Sitzung; erst dann verlangt Kapitel 5 den Neustart | Adapter beim Zustandswechsel |
| `allein` | Entscheidung | „Ich arbeite allein an diesem Rechner“ | Sprechblase Kapitel 3 |
| `companionVerbunden` | Entscheidung | „Companion ist verbunden“ (hakt Kapitel 5 an jeder Rolle ab) | Sprechblase Kapitel 5 |
| `showVomMaster` | Entscheidung | „Die Show ist da“ | Sprechblase Kapitel 4 am Rechner mit „Mit Master verbinden“ |

## 7 · Ansagen erzeugen (Stimme)

- **Werkzeug:** Piper 1.8.0 (Python-venv) und ffmpeg 8.1.2 mit libopus, **nur am Rechner des Controllers**. Piper, die
  Stimme (`.onnx`), espeak-ng, onnxruntime und WAV-Zwischendateien kommen nie ins Repo, in den Installer oder in die CI.
  Lizenz, Herkunft und Namensnennung der Stimme stehen in `apps/launcher/src/renderer/src/anleitung/stimme/HERKUNFT.md`.
- **Umgebung:** `JM_PIPER_PYTHON` (Python des venv), `JM_PIPER_STIMME` (Pfad zur `.onnx`, die `.onnx.json` liegt daneben),
  `JM_FFMPEG` (Pfad zu ffmpeg 8.1.2 mit libopus). Alle drei sind Pflicht; fehlt eine, bricht das Skript mit „Fehler: Es
  fehlen Umgebungsvariablen: …“ ab. Sie stehen nur als Präfix der einen Befehlszeile des Controllers, nie in einem Profil,
  einer `.env`-Datei oder der Systemumgebung; Python läuft nur isoliert (`-I`).
- **Befehl:** `npm run stimme:erzeugen -w @jm/launcher -- --stimme ‹Name› --sprecher ‹n›`. Das Skript prüft die SHA-256 der
  Stimme gegen ihren Pin, erzeugt je gesprochenem Text eine Opus-Datei (`.ogg`, 24 kbit/s, mono, bitgleich durch
  `-fflags +bitexact`) und schreibt `manifest.json` mit Text-, Stimmen- und Datei-Prüfsumme. Neu erzeugt wird ein Text nur,
  wenn sich sein Text, die Stimme oder die Parameter geändert haben; Piper ist zufallsbehaftet, darum wird nie Audio mit
  Audio verglichen. Verwaiste Dateien entfernt und meldet es.
- **Prüfung:** Der Launcher-Selbsttest prüft ohne Piper, dass zu jedem gesprochenen Text genau die passende Datei gehört
  (SHA-256 über den Text in NFC). Ändert jemand einen Text ohne neue Ansage, wird er rot. Nach dem Bau prüft
  `npm run stimme:bau-pruefen -w @jm/launcher`, dass Vite keine Ansage als `data:` eingebettet hat (die Sicherheitsregel des
  Fensters erlaubt Medien nur als Datei, `media-src 'self' blob:`) und dass die Zahl der Ansagen zum Manifest passt.
- **Ohne Stimme:** Ein Manifest mit `stimme: null` und ohne Einträge ist gültig; Übersicht und Sprechblase sagen dann „In
  dieser Fassung gibt es keine Stimme.“ Der Text steht immer da. So erscheint Launcher 0.17.0 (OFP1 „ohne Ton“); die Stimme
  kommt mit einem späteren Update über den Befehl oben.

## 8 · Was UX-Welle 3 erhalten muss

- **Jede Kennung zieht mit ihrem Bedienelement um.** Der Selbsttest wird rot, wenn eine Kennung fehlt, übrig ist oder dieses
  Register einen falschen Ort nennt. Fällt ein Bedienelement weg, ändert sich die Anleitung (Schritt, Text, Kennung), die
  Texte gehen zur Owner-Freigabe, die Ansagen entstehen neu.
- **Texte nennen Beschriftungen** („Werkzeugkasten“, „JM Show“, „Aus Vorlage starten“, „Vorlage wählen“, „Los“, „Speichern“,
  „Rechner koppeln“, „Mit Master verbinden“, „Koppeln“, „Master“, „Sichere Steuerebene aktivieren“, „Erneuern“, „Show öffnen“,
  „Verbund öffnen“, „Erste Schritte“). Wer eine Beschriftung
  ändert, ändert den Text der Anleitung mit.
- **Knopf „Erste Schritte“:** Er zeigt bei pausierter Anleitung „Einrichtung fortsetzen · Schritt ‹n› von ‹m›“ und auf
  bestehenden Rechnern eine Sitzung lang „Neu: geführte Einrichtung“; der neue Kopf braucht dafür Platz (Owner-Frage OFP3).
- **Ebenen:** Kein Dialog über `z-[60]`; die Meldung bleibt über der Schicht (`z-[70]`). Der Wächter M1 im Selbsttest sieht
  nur Overlays unter `components/` des Launchers.
- **Escape und Tab:** `Modal` aus `@jm/ui` fängt Escape in der Capture-Phase und hält Tab im Dialog. Bekommen Launcher-Dialoge
  in Welle 3 `Modal`, erreicht Escape die Sprechblase nicht mehr und Tab nicht mehr die Bedienleiste; das muss Welle 3 lösen
  und in der Abnahme prüfen.
- **Kapitelübersicht und Checkliste:** Die Übersicht ersetzt die Checkliste ohne Funktionsverlust (je Kapitel Detailzeile
  und direkte Aktion, Tipp zum Kochbuch, „Fertig“, Einstieg „Aus Vorlage starten“ im Reiter „JM Show“). Der Selbsttest hält
  diese Liste fest.
- **Zustände:** Ändert Welle 3 Felder in `useTools` oder `useVerbund`, ändert sich der Adapter `lib/anleitung-zustand.ts`,
  nie die Anleitung; seine Kreuzprodukte im Selbsttest zeigen, ob jeder Name noch stimmt. Den Eingang der Bedingungen baut
  nur `anleitungsEingang` (Typen `LauncherLage` und `VerbundLage`). Direkt aus `useTools` lesen außerdem `OnboardingModal.tsx`
  (`settings`, `states` für die Detailzeilen, damit sie live mitgehen), `components/Anleitung.tsx` (`onboardingOpen`) und
  `abonniere` in `store/anleitung.ts` (`systemOpen`, `settingsOpen`). Ein umbenanntes Feld meldet an allen Stellen die Typprüfung.
- **Start einmal je Fenster:** Im Dev-Lauf (`<StrictMode>`) ruft React `load()` zweimal; der Treiber startet die Anleitung je
  Fenster nur einmal (Launcher-Selbsttest, Prüfungen „P12 4, D15“ und „P13 4, D15“). Wer den Start umbaut, prüft das auch
  im Dev-Lauf.

## 9 · Eine Anleitung für ein weiteres Tool

1. Ziel-Kennungen an die Bedienelemente des Tools (`data-anleitung`), dazu ein Test wie der des Launchers (beide Richtungen).
2. Ein Adapter, der die vorhandenen Zustände des Tools auf Namen abbildet; nur Lesen, keine neuen Seiteneffekte.
3. Die Anleitungs-Datei mit `import type { Anleitung } from '@jm/ui/anleitung'`, geprüft mit `pruefeAnleitung`.
4. `AnleitungsSchicht` und `AnleitungsUebersicht` einbinden, Speicher einspeisen, eigener Schlüssel je Anleitung. Die Texte des
   Gerüsts nennen keine bestimmte Anleitung: Hauptknopf, Fortsetzen und „abgeschlossen“ bilden ihren Text aus
   `Anleitung.titel` (`ANLEITUNG_TEXTE.starten(titel)`, `.fortsetzen(titel, n, m)`, `.abgeschlossen(titel)`); an `@jm/ui` ist
   nichts zu ändern.
5. Texttabelle zur Owner-Freigabe, dann Ansagen erzeugen und Prüfung grün.

## 10 · Live-Tools (später)

Eine Anleitung bringt nie etwas auf Sendung. In Tools, die auf Sendung gehen (Titler, Switcher, Player), laufen Schritte,
die sonst eine Sendung auslösen würden, nur mit einem Übungsweg (zum Beispiel Ausgabe aus) oder werden nur erklärt. Die
Regel gilt ab jetzt; ausgearbeitet wird sie mit der ersten Anleitung eines Live-Tools.

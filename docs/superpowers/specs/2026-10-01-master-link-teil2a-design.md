# Master-Link, Teil 2a: Feste Kennungen und Abgleich ohne Verlust (#235)

**Anlass:** #235 „Rundown mit iveo“. Wechselt in iveo der Programmpunkt, passen sich Timer und Titler an, der Rundown nicht. Gemeldet aus dem Einsatz COP31 (Launcher 0.11.0, 29.09.2026).
**Vorgänger:** Teil 1 „Master-Link-Fundament“ (PR #239, released 01.10.2026: Launcher 0.12.0, Timer 0.12.0, Titler 0.9.0)
**Behebt:** #235, und zwar am Einzelplatz. Über das Netz trägt es erst 2b.
**Gesamtplan:** Ansatz A „Stern zum Master“, Teile 0 → 1 → 2 → 3 → 4. Teil 2 ist in drei Zyklen geteilt (Owner-Entscheidung 01.10.2026): **2a** feste Kennungen + Abgleich → **2b** Show-Daten über den Master-Link → **2c** iveo-Live je Bühne (Prod). Präsentationen, Materialien und Fotos folgen in einem eigenen Zyklus.
**Ziel in einem Satz:** Jeder Ablaufpunkt hat eine feste Kennung von iveo bis ins Tool. Der Rundown folgt jeder iveo-Änderung, ohne Position oder Aktionen zu verlieren.

2a fasst keinen Code in `packages/master-link` an. Deshalb stört es die laufende Zwei-PC-Abnahme von Teil 1 nicht und gilt unabhängig von deren Ergebnis.

**Besprochen und freigegeben (01.10.2026):**
- Zuschnitt A: drei Zyklen
- Frage 2 A: Side-Event-Wechsel wie bei Timer und Titler, Gedächtnis je Side Event
- Frage 3 A: Die iveo-Reihenfolge gilt, Entfallenes mit Aktionen bleibt markiert
- Frage 4 A: Abgleich auch für eigene `.jmrundown`-Dateien
- Frage 5 A: Timer und Sprung-Aktionen arbeiten über die Kennung
- Ansatz 1: RELOAD wie bei Timer und Titler, Gedächtnis im Rundown
- Entwurfsabschnitte 1 bis 6

**Geprüft:** Diese Fassung hat vier Prüfer mit je einem Gegenprüfer durchlaufen. Von 54 Befunden haben 49 die Gegenprüfung überstanden und sind eingearbeitet. Was dabei über die Besprechung hinausgeht, steht in Abschnitt 0.

---

## 0 · Ergänzungen gegenüber der Besprechung (bitte bewusst prüfen)

Beim Ausarbeiten und in der Prüfung kamen Stellen heraus, die die Besprechung nicht abdeckte oder an denen der Code etwas anderes verlangt. Nur dort weicht diese Spec ab oder ergänzt:

| # | Besprochen | Jetzt | Warum |
| --- | --- | --- | --- |
| 1 | „Abfragefehler sichtbar“ (Abschnitt 5, Punkt 7) | Scheitert die Agenda-Abfrage oder das Nachladen des Side-Event-Kontexts, macht der Launcher daraus **nicht** mehr „Programm als 1 Punkt“. Die Abfrage wird übersprungen. Beim Umschalten scheitert das Umschalten sichtbar. Nur eine **erfolgreich leere** Agenda wird zum 1-Punkt-Ablauf (7.6). | Heute verschluckt `pollSideEvent` den Fehler und schreibt den 1-Punkt-Ablauf (`apps/launcher/src/main/iveo-sync.ts:576-582`, `:631-637`). Beim nächsten Erfolg sind alle Punkte wieder da. Mit dem Abgleich würden deine Zeilen dabei kurz als „entfallen“ markiert. |
| 2 | Ablaufzeilen sind gesperrt „in einer iveo-Show“ | Gesperrt sind Ablaufzeilen **jeder** Show. Der Hinweis lautet „kommt aus iveo“ bzw. „kommt aus der Show, im Show-Editor ändern“ (4.5). Speichert der Show-Editor die gerade offene Show, bekommen Timer, Titler und Rundown sofort ein RELOAD (7.5). | Auch ohne iveo gleicht der Rundown beim erneuten Öffnen ab (5.2). Eine im Rundown geänderte Überschrift würde sonst still überschrieben. Damit der Hinweis „im Show-Editor ändern“ live wirkt, muss das Speichern im Editor die Tools erreichen. Heute ginge das nur über erneutes Öffnen der Show, und das setzt den laufenden Timer zurück. |
| 3 | Entfallene Zeile „bleibt markiert stehen, bis du sie löschst“ | Weiterschalten überspringt entfallene Zeilen, sie feuern nie. Der Knopf „Als eigene Zeile behalten“ macht aus ihr eine normale eigene Zeile (4.3). | Der Punkt ist in iveo gelöscht, etwa ein abgesagter Speaker. Seine Bauchbinde live zu feuern wäre falsch. Die Aktionen sollen nur nicht verloren gehen. |
| 4 | Gedächtnis „je Show, bei iveo-Shows über das Event gekennzeichnet“ | Das Gedächtnis gehört immer zur **Show-Datei** (ihr Pfad). Im Listen-Modus zählt der Filter (Tag, Typ, Format) zum Kontext (4.4, 4.7). | Ein Schlüssel über Event und Basis-URL ist nicht stabil: Der Launcher trägt die Basis-URL beim ersten Zurückschreiben nach (`iveo-sync.ts:677`). Außerdem teilten sich „Tag 1.jmshow“ und „Tag 2.jmshow“ desselben Events ein Gedächtnis und markierten sich gegenseitig als „entfallen“. Dasselbe passierte, wenn im Panel die Tagesübersicht eines anderen Tages gewählt wird. |
| 5 | Neustart erhält den Stand | Der Rundown merkt sich die zuletzt geöffnete Show über einen Neustart hinweg. Ein Start über die Launcher-Kachel oder nach einem Absturz kehrt zu ihr zurück (5.2). | Sonst zeigte ein Neustart über die Kachel den Stand einer Show nicht mehr, und jedes RELOAD warnte nur. Der andere Weg, die Show neu zu öffnen, setzt den laufenden Timer zurück (`apps/timer/src/main/index.ts:353`, `timer-state.ts:259-268`). |
| 6 | – | **Titel-Brücke:** Fehlt die Kennung einer alten Ablaufzeile im neuen Ablauf, und es gibt genau einen neuen Punkt ohne Gegenstück mit demselben Titel, übernimmt die Zeile dessen Kennung samt ihren Aktionen (R0 in 4.3). | Jede Bestands-Show (etwa COP31) bekommt nach dem Update erstmals echte Kennungen. Ohne Brücke würden dabei alle Zeilen mit Aktionen „entfallen“, also genau das Symptom von #235. Die Brücke hilft auch, wenn iveo einen Punkt löscht und gleichnamig neu anlegt. |
| 7 | – | **Alter Autosave:** Beim ersten Öffnen einer Show nach dem Update wird der Autosave aus Rundown 0.5 einmalig übernommen, wenn er zu dieser Show gehört (gleicher Name). Vorher wird er gesichert (5.2). | Heute liegen die Aktionen an Ablaufzeilen nur im Autosave (`apps/rundown/src/main/store.ts:11-13`). Ohne Übernahme wären sie beim ersten Start mit 0.6.0 weg. |
| 8 | – | **Duplizieren** einer Ablaufzeile ergibt immer eine eigene Zeile. **Regieplan-Import „Ersetzen“** ersetzt nur die eigenen Zeilen (4.5). | Sonst wäre die Kopie eine Schein-Ablaufzeile ohne Gegenstück in iveo, die beim nächsten Abgleich still verschwindet oder als „entfallen“ übersprungen wird. Der Import ersetzte sonst auch die Zeilen aus iveo. |
| 9 | Gleichzeitiges Tippen: Änderung wird abgewiesen | Abgewiesen wird nur, wenn **seit dem Stand, auf dem die Änderung beruht, ein Abgleich lief**. Die eigenen schnellen Eingaben werden nie abgewiesen. Bei einer Abweisung werden die Felder neu aufgebaut, und die Meldung bleibt stehen (5.5). | Der Editor nutzt ungesteuerte Felder. Nach einer Abweisung zeigte das Feld sonst weiter den getippten Wert, der aber nicht gespeichert ist. |
| 10 | – | Für die Tests wird `iveo-sync.ts` in einen Electron-freien Kern und eine dünne Hülle geteilt, nach dem Muster von `verbund/kern.ts` aus Teil 1. Die Ablauf-Umwandlung des Timers zieht in ein reines Modul (8, 9). | Die geplanten Tests lassen sich gegen den heutigen Code nicht ohne Electron schreiben. `iveo-sync.ts` importiert `electron`, die Einstellungen und `health` und baut den iveo-Client selbst. |
| 11 | – | `.jmrundown` bekommt `schemaVersion: 2` mit neuen optionalen Feldern. Ein alter Rundown liest neue Dateien weiter, verliert beim Speichern aber Archiv und Markierungen (4.1). | Der alte Leser (`store.ts:68-75`) übernimmt nur bekannte Felder. Das lässt sich rückwirkend nicht ändern. |

---

## 1 · Ausgangslage (nachgemessen, nicht angenommen)

Grundlage ist die Ist-Karte vom 01.10.2026: sieben Agenten, Widersprüche am Code entschieden. Alle Pfade sind relativ zum Repo, Stand `origin/main` `dc8190cb93`.

**Die Ursachenkette von #235:**

| # | Tatsache | Fundstelle |
| --- | --- | --- |
| 1 | Der Launcher schickt RELOAD nur an Timer und Titler, an allen drei Stellen. | `apps/launcher/src/main/iveo-sync.ts:553-554` (Listen-Abfrage), `:654-655` (Agenda-Abfrage), `:859-860` (Umschalten) |
| 2 | Der Rundown versteht kein RELOAD. `handleSuiteCommand` kennt nur `go/next/prev/goto` und hat keinen `default`. Unbekanntes verfällt still. | `apps/rundown/src/main/index.ts:62-79` |
| 3 | Der Rundown merkt sich den Show-Pfad nicht, Timer und Titler schon. | `apps/rundown/src/main/index.ts:271-292`; `apps/timer/src/main/index.ts:364` |
| 4 | Der einzige Ladeweg setzt `index = 0` und `lastFired = null`, ersetzt das Dokument und bricht laufende GO-Folgen ab. | `apps/rundown/src/main/index.ts:280-287`, `:92-102` |
| 5 | Ablaufzeilen entstehen ohne Aktionen und mit frischer Zufallskennung. Ihre Aktionen leben nur im Autosave, und der wird sofort überschrieben. | `apps/rundown/src/main/store.ts:84-86`, `:58`, `:104-110` |
| 6 | `ShowAblaufItem` hat kein `id`, und der Normalisierer würde eines verwerfen. Die iveo-Umwandler werfen die vorhandenen iveo-IDs weg. | `packages/show/src/index.ts:40-53`, `:145-157`; `packages/iveo/src/mapper.ts:132-147`, `:177-194` |
| 7 | Ein in der Show referenziertes `.jmrundown` hat Vorrang vor `show.ablauf`. iveo erreicht solche Shows nie. | `apps/rundown/src/main/index.ts:279-283` |

**Timer und Titler heute:** Beim RELOAD halten beide nur die **Nummer** des aktiven Punkts.
- Der Timer vergibt allen Punkten neue Kennungen (`apps/timer/src/shared/timer-state.ts:271-281`).
- Der Titler hält den DataLink-Index (`apps/titler/src/main/datalink.ts:185-192`).
- Wiederverwendbare Abgleich-Logik gibt es im Repo nicht.

**Launcher-Hygiene, die #235 berührt:**
- **Schein-RELOAD nach dem Öffnen:** Die Signatur gegen unnötige RELOADs wird beim Öffnen nicht gesetzt. Deshalb kommt 45 s nach jedem Öffnen ein RELOAD ohne echte Änderung (`iveo-sync.ts:469-504`, `:639-641`; im Log von #235 sichtbar).
- **Keine Signatur im Listen-Modus:** Jede Änderung irgendwo im Event schreibt und benachrichtigt (`iveo-sync.ts:530-557`).
- **Abfrage und Umschalten nicht gesperrt:** Beide können sich gegenseitig überholen. Die Abfrage liest nach jedem `await` das globale `active` (`iveo-sync.ts:499-501`, `:514-557`, `:835`).
- **Merker vor dem Schreiben:** `lastSig` rückt vor dem Schreiben vor, und `rewriteShowAblauf` verschluckt Fehler (`iveo-sync.ts:641`, `:856`, `:685-687`).
- **Nicht atomar:** Die Show wird nicht atomar geschrieben (`iveo-sync.ts:684`).
- **Datenverlust im Show-Editor:** Beim Speichern verwirft er Tool-Einstellungen, `network.port` und `iveo.syncedAt` und rundet Dauern auf ganze Minuten (`apps/launcher/src/renderer/src/components/ShowEditorModal.tsx:235`, `:290-291`, `:305-325`, `:373`, `:403-429`).

**„ShowAblaufItem erweitern“ = neun Stellen**, nicht vier, wie die Memory-Lehre sagte:

| # | Stelle | Art |
| --- | --- | --- |
| S1 | `normalizeAblaufItem` und `migrateShow`, `packages/show/src/index.ts:145-157`, `:239-243` | Normalisierer bei jedem Lesen und Schreiben, Whitelist |
| S2 | Show-Editor `buildAblauf`, `ShowEditorModal.tsx:286-303` | Neubau beim Speichern |
| S3 | Show-Editor-Zulieferer: Bind-Ergebnis `:233-242`, `loadForEdit` `:370-380`, Szenario-Vorlage `:116-122` (`apps/launcher/src/renderer/src/lib/scenarios.ts:18`) | Bau der Editor-Zeilen |
| S4 | iveo-Umwandler `programToAblaufItem` `packages/iveo/src/mapper.ts:132-147`, `programsToAblauf` `:150-155`, `agendaToAblauf` `:177-194`, `snapshotToAblauf` `:295-298` | Erzeuger |
| S5 | `pollSideEvent`, `apps/launcher/src/main/iveo-sync.ts:570-657` | Neubau im Agenda-Modus |
| S6 | `rewriteShowAblauf`, `iveo-sync.ts:660-688` | ersetzt `show.ablauf`, baut `show.iveo` als Literal neu |
| S7 | Timer `ablaufToTimetable`, `apps/timer/src/main/index.ts:311-323` | Empfänger |
| S8 | Timer `parseTimetable`, `apps/timer/src/main/index.ts:297-308` | Empfänger der eigenen Timer-Liste (Vorrang vor `show.ablauf`) |
| S9 | Rundown `docFromAblauf`/`normRow`, `apps/rundown/src/main/store.ts:54-65`, `:84-86` | Empfänger |

Dazu kommt der Schreiber im Show-Editor, `onSave` (`ShowEditorModal.tsx:403-440`).

---

## 2 · Begriffe

| Begriff | Bedeutung |
| --- | --- |
| **Kennung** | Feste Kennung eines Ablaufpunkts, Feld `ShowAblaufItem.id` (3). |
| **Ersatz-Kennung** | Kennung, die der Rundown für Ablaufpunkte ohne `id` bildet (3.4). |
| **Schlüssel eines Punkts** | seine Kennung, sonst seine Ersatz-Kennung |
| **Ablaufzeile** | Rundown-Zeile, die aus dem Show-Ablauf stammt. Feld `quelle: 'ablauf'`, ihre `id` ist der Schlüssel des Punkts. |
| **Eigene Zeile** | Rundown-Zeile, die der Bediener angelegt hat. Sie hat keine `quelle`. |
| **Entfallene Zeile** | Ablaufzeile, deren Schlüssel im neuen Ablauf fehlt und die mindestens eine Aktion hat. Feld `entfallen: true`. |
| **Lebende Ablaufzeile** | Ablaufzeile, die nicht entfallen ist. |
| **Kontext** | Wofür die aktuellen Zeilen gelten (4.4): ein Side Event, eine gefilterte Programmliste oder eine Show ohne iveo. |
| **Archiv** | Die Zeilen anderer Kontexte derselben Show. |
| **Gedächtnis** | Zwischenspeicher je Show-Datei im Rundown: aktuelle Zeilen, Archiv, scharfe Zeile (4.7). |
| **Gemerkte Show** | Die Show, mit der der Rundown gerade verbunden ist. Sie übersteht einen Neustart (5.2). |
| **Scharfe Zeile** | Die Zeile, die das nächste GO feuert. Intern über ihre `id` geführt (`scharfId`, 5.3). |

---

## 3 · Kennungen von iveo bis ins Tool

### 3.1 Das Feld

- `ShowAblaufItem` bekommt das optionale Feld `id?: string`. Optional, damit alte Shows weiter laden.
- `normalizeAblaufItem` (S1) übernimmt `id`, wenn es ein String ist, der nach `trim()` 1 bis 200 Zeichen lang ist. Sonst entfällt das Feld, der Punkt selbst bleibt.
- `@jm/show` exportiert neu `normalizeAblauf(liste)`: Normalisierung je Punkt plus das Auflösen doppelter Kennungen (3.5). `migrateShow` nutzt sie, und der Launcher nutzt sie für die Signatur (7.2).

### 3.2 Woher die Kennung kommt

| Quelle | Kennung | Stelle |
| --- | --- | --- |
| iveo, Programmliste | iveo-Programm-ID `p.id` | `programToAblaufItem` (S4) |
| iveo, Side Event mit Agenda | iveo-Agenda-Punkt-ID `it.id` | `agendaToAblauf` (S4) |
| iveo, Side Event ohne Agenda (1 Punkt) | iveo-Programm-ID | `programToAblaufItem`, aufgerufen aus Binden, `pollSideEvent` (S5) und `resolveSideEventLight` (`iveo-sync.ts:795-797`) |
| von Hand im Show-Editor | `crypto.randomUUID()` beim Anlegen der Zeile, wird mitgespeichert | `addAblaufRow` (`ShowEditorModal.tsx:162-163`) |
| Szenario-Vorlage | `crypto.randomUUID()` je Zeile beim Übernehmen | S3 (`ShowEditorModal.tsx:116-122`) |

Die iveo-IDs sind UUIDs und damit eventweit eindeutig (`packages/iveo/src/types.ts:43`, `:132`).

### 3.3 Durchlauf durch alle Stellen

| # | Was sich ändert |
| --- | --- |
| S1 | `normalizeAblaufItem` übernimmt `id` (3.1). `migrateShow` löst danach über die ganze Liste doppelte Kennungen auf (3.5). |
| S2 | `id` der Editor-Zeile mitschreiben. |
| S3 | `AblaufRow` bekommt `id?: string`. Bind-Ergebnis und `loadForEdit` übernehmen `a.id`. Neue Zeilen und Szenario-Zeilen bekommen eine neue Kennung. |
| S4 | Die Umwandler setzen `id` wie in 3.2. |
| S5 | Nichts Eigenes, es nutzt S4. Die Signatur (7.2) enthält `id`. |
| S6 | `show.ablauf` wird unverändert übernommen. Das Literal für `show.iveo` betrifft keine Ablaufpunkte und bleibt. |
| S7 | `ablaufToTimetable` gibt `id` an den Timer weiter (6.1). Die Funktion zieht nach `apps/timer/src/shared/show-ablauf.ts` (8). |
| S8 | `parseTimetable` bleibt ohne Kennung, denn eine eigene Timer-Liste hat keine (Grenze, 12). Die Funktion zieht ebenfalls nach `show-ablauf.ts`. |
| S9 | Der Abgleich ersetzt `docFromAblauf` (4.2). Er setzt `quelle: 'ablauf'` und den Schlüssel als `id`. |

### 3.4 Ersatz-Kennungen

Hat ein Ablaufpunkt keine `id`, bildet der Rundown beim Abgleich eine:
- `ersatz:` + Titel, wie er in der Show steht.
- Beim zweiten Vorkommen desselben Titels im selben Ablauf `ersatz:<Titel>#2`, beim dritten `#3` und so weiter.

Ersatz-Kennungen entstehen nur im Rundown und werden nie in die Show zurückgeschrieben.

Bekommt die Show später echte Kennungen, etwa nach dem ersten Schreiben durch Launcher 0.13 oder dem ersten Speichern im neuen Show-Editor, geht der Wechsel über die Titel-Brücke R0 (4.3) ohne Verlust. Dasselbe gilt in die Gegenrichtung, wenn ein alter Launcher die Kennungen wieder entfernt.

### 3.5 Doppelte Kennungen

- **In der Show:** Doppelte echte Kennungen sollte es nicht geben. `normalizeAblauf` fängt sie trotzdem auf Listenebene ab, nach der Normalisierung je Punkt. Die erste behält ihre Kennung, jede weitere bekommt `#2`, `#3` und so weiter. Weil `parseShow` und `serializeShow` über `migrateShow` laufen, gilt das bei jedem Lesen und Schreiben.
- **Im Rundown:** `gleicheAb` bildet die Ersatz-Kennungen und löst danach über die ganze Liste noch einmal Doppelte nach derselben Regel auf (R9), etwa bei den Titeln „X“, „X“ und „X#2“.

### 3.6 Verträglichkeit

| Kombination | Verhalten |
| --- | --- |
| Show mit Kennungen, altes Tool (Timer ≤ 0.12, Rundown ≤ 0.5) | Der alte Normalisierer verwirft `id`, das Tool verhält sich wie heute. |
| Show mit Kennungen, alter Launcher speichert sie im Show-Editor | Die Kennungen gehen verloren. Der Rundown bildet Ersatz-Kennungen und wechselt über R0 ohne Verlust. |
| Show ohne Kennungen, neuer Rundown | Ersatz-Kennungen (3.4). |
| Show bekommt später Kennungen | R0, nichts entfällt. |
| Show ohne Kennungen, neuer Timer | Wie heute: neue Zufallskennungen, halten über die Nummer (6.1). |

---

## 4 · Abgleich

### 4.1 Datenmodell des Rundowns

`apps/rundown/src/shared/types.ts`:

```ts
export interface RundownAction {
  // … wie heute …
  /** Schlüssel des Ablaufpunkts, auf den ein `timer goto` zielt (6.2). */
  zielId?: string;
}

export interface RundownRow {
  // … wie heute: id, label, note?, actions, durationMs? …
  /** 'ablauf' = stammt aus dem Show-Ablauf; fehlt = eigene Zeile. */
  quelle?: 'ablauf';
  /** Nur bei quelle 'ablauf': im aktuellen Ablauf nicht mehr vorhanden, Aktionen erhalten. */
  entfallen?: true;
}

export interface RundownDoc {
  schemaVersion: 2;
  name: string;
  rows: RundownRow[];
  /** Kontext der aktuellen rows (4.4). Fehlt bei Dokumenten, die nie mit einer Show abgeglichen wurden. */
  kontext?: string;
  /** Zeilen anderer Kontexte derselben Show. */
  archiv?: Record<string, RundownRow[]>;
  /** true = Version-1-Dokument, dessen einmalige Titel-Zuordnung (4.9) noch aussteht. */
  zuordnungOffen?: true;
}
```

- `migrate` liest Version 1 und 2.
- Ein Version-1-Dokument bekommt `zuordnungOffen: true`, keine Zeile hat `quelle`, alle gelten zunächst als eigene Zeilen.
- Geschrieben wird immer Version 2. `zuordnungOffen` bleibt dabei erhalten, bis zum ersten Abgleich mit einer Show. Damit greift 4.9 auch dann, wenn eine alte Datei zwischendurch ohne Show gespeichert wurde.

### 4.2 Die reinen Funktionen

In `apps/rundown/src/shared/`. Alle Funktionen kommen ohne Electron, Uhr und Zufall aus. Neue Zeilen-IDs kommen über einen übergebenen `neueId()`.

```ts
// abgleich.ts
export interface AbgleichBericht {
  geaendert: number;   // lebende Ablaufzeilen mit neuem Titel, Notiz oder Dauer
  neu: number;         // neu hinzugekommene Ablaufzeilen
  entfallen: number;   // neu als entfallen markiert
  entfernt: number;    // ohne Aktionen weggefallen
  zurueck: number;     // vorher entfallen, jetzt wieder lebend
  verschoben: number;  // lebende Ablaufzeilen, deren Vorgänger unter den lebenden Ablaufzeilen gewechselt hat
  scharfVerrueckt: { von: string; nach: string | null } | null; // Titel vorher/nachher
}

/** Abgleich im selben Kontext (4.3). */
export function gleicheAb(e: {
  alt: RundownRow[];
  ablauf: ShowAblaufItem[];      // normalisiert (normalizeAblauf), mit oder ohne id
  scharfId: string | null;
  altformat: boolean;            // = doc.zuordnungOffen (4.9)
}): { rows: RundownRow[]; scharfId: string | null; bericht: AbgleichBericht; umbenannt: Record<string, string> };

/** Kontext der Show (4.4). */
export function kontextVon(show: Show): string;

/** Show auf ein Dokument anwenden: Kontextwechsel (4.4) oder Abgleich (4.3), Titel-Zuordnung (4.9). */
export function wendeShowAn(e: {
  doc: RundownDoc;
  scharfId: string | null;
  show: Show;
}): { doc: RundownDoc; scharfId: string | null; bericht: AbgleichBericht | null; kontextGewechselt: boolean };

// sprung.ts (6.2)
export function loeseSprungZiel(
  aktion: RundownAction,
  ablaufSchluessel: string[],    // Schlüssel des normalisierten show.ablauf, in Reihenfolge
  eigeneTimerListe: boolean,
): { n: number; gebunden: boolean } | { entfallen: true };

// scharf.ts (5.3)
export function scharfNachBearbeitung(alt: RundownRow[], neu: RundownRow[], scharfId: string | null): string | null;
```

`umbenannt` listet die Kennungswechsel aus R0 (alt → neu). `wendeShowAn` schreibt damit `zielId` in allen Aktionen des Dokuments und im Archiv um und ebenso `scharfId`.

### 4.3 Regeln im selben Kontext

| # | Regel |
| --- | --- |
| R9 | **Schlüssel:** Für jeden Punkt des neuen Ablaufs gilt als Schlüssel seine `id`, sonst seine Ersatz-Kennung (3.4). Doppelte Schlüssel werden nach 3.5 aufgelöst. Danach greifen R0 bis R8. |
| R0 | **Titel-Brücke:** Verwaist heißt eine alte Ablaufzeile, deren `id` unter den neuen Schlüsseln fehlt. Ohne Gegenstück heißt ein neuer Punkt, dessen Schlüssel unter den alten Ablaufzeilen fehlt. Haben eine verwaiste Zeile und ein Punkt ohne Gegenstück **genau denselben Titel**, und kommt dieser Titel unter den verwaisten Zeilen **und** unter den Punkten ohne Gegenstück je genau einmal vor, übernimmt die Zeile den Schlüssel des Punkts. Ihre Aktionen bleiben. Das Paar zählt weder als `neu` noch als `entfallen`. Der Wechsel landet in `umbenannt`. |
| R1 | **Reihenfolge:** Die lebenden Ablaufzeilen stehen in der Reihenfolge des neuen Ablaufs. |
| R2 | **Gleicher Schlüssel:** Zugeordnet werden nur alte Zeilen mit `quelle: 'ablauf'`. Die alte Zeile bleibt mit `id` und `actions`, samt `delayMs`, `enabled` und `zielId`. `label`, `note` und `durationMs` kommen aus dem neuen Ablauf. War sie entfallen, verliert sie die Markierung und zählt als `zurueck`. |
| R3 | **Neuer Schlüssel:** Neue Zeile `{ id: Schlüssel, quelle: 'ablauf', label, note?, durationMs?, actions: [] }`, zählt als `neu`. |
| R4 | **Weggefallen ohne Aktionen:** Eine verwaiste Zeile ohne Aktionen verschwindet und zählt als `entfernt`. Das gilt auch für schon entfallene Zeilen, deren letzte Aktion inzwischen gelöscht wurde. |
| R5 | **Weggefallen mit mindestens einer Aktion** (auch einer ausgeschalteten): Die Zeile bleibt mit `entfallen: true`, Text und Aktionen unverändert. War sie vorher lebend, zählt sie als `entfallen`. |
| R6 | **Anhänger:** Eigene Zeilen und entfallene Zeilen heißen Anhänger. Ein Anhänger hängt an seinem **Anker**. Das ist die nächste Zeile über ihm in der alten Reihenfolge, die **nach** dem Abgleich eine lebende Ablaufzeile ist, auch eine, die nach R2 zurückgekommen ist. Zeilen, die in diesem Abgleich entfallen, sind selbst Anhänger und kein Anker. Die Anhänger eines Ankers stehen direkt hinter ihm, in ihrer alten Reihenfolge. Anhänger ohne Anker stehen ganz oben, in alter Reihenfolge. Wandert ein Anker (R1), wandern seine Anhänger mit. |
| R7 | **Scharfe Zeile:** (a) Ist `scharfId` null oder steht sie nicht unter den alten Zeilen, wird die erste nicht entfallene Zeile des Ergebnisses scharf, ohne `scharfVerrueckt`. (b) Bleibt die scharfe Zeile als lebende Ablaufzeile oder als eigene Zeile erhalten, auch über R0, bleibt sie scharf, auch an neuer Stelle. (c) Ist sie entfallen (R5) oder verschwunden (R4), wird die erste Zeile scharf, die in der **alten** Reihenfolge hinter ihr stand und im Ergebnis eine nicht entfallene Zeile ist (Suche über die `id`). Gibt es keine, wird die letzte nicht entfallene Zeile des Ergebnisses scharf. Gibt es gar keine, ist sie `null`. Nur in (c) setzt der Bericht `scharfVerrueckt`. |
| R8 | **Gleicher Stand:** Ändert ein Abgleich nichts an den Zeilen (Tiefenvergleich) und an `scharfId`, sind alle Zähler 0 und `scharfVerrueckt` ist null. Zweimal hintereinander mit demselben Ablauf ergibt beim zweiten Mal genau das Ergebnis des ersten und einen leeren Bericht. Umgekehrt ist ein Bericht nicht leer, sobald sich irgendetwas an den Zeilen geändert hat. Dafür gibt es `verschoben` und `zurueck`. |

**Entfallene Zeilen im Betrieb:**
- GO, Weiter und Zurück überspringen entfallene Zeilen, sie feuern nie. `RUNDOWN GOTO n` zählt alle sichtbaren Zeilen. Landet es auf einer entfallenen, wird die nächste nicht entfallene scharf, gibt es keine, die vorige.
- Der Knopf „Als eigene Zeile behalten“ entfernt `quelle` und `entfallen` und vergibt eine neue `id` über `newId('r')`. Ab dann ist es eine normale eigene Zeile. Kommt der Punkt später in iveo zurück, erscheint er als neue Ablaufzeile (R3) neben der eigenen.
- Löschen geht wie bei eigenen Zeilen.

### 4.4 Kontext und Kontextwechsel

`kontextVon(show)`:

| Show | Kontext |
| --- | --- |
| `show.iveo` mit `filter.programId` | `se:<programId>` |
| `show.iveo` ohne `filter.programId` | `liste:<day>\|<typeSlug>\|<formatSlug>\|<excludeBlockers ? 1 : 0>`, fehlende Teile leer |
| ohne `show.iveo` | `show` |

`wendeShowAn` vergleicht den Kontext der Show mit `doc.kontext`.

**Gleicher Kontext:** `gleicheAb` nach 4.3.

**Anderer Kontext:**
1. Die aktuellen `rows` wandern als `archiv[doc.kontext]` ins Archiv, ein vorhandener Eintrag wird ersetzt. Ohne `doc.kontext` (4.9, neues Dokument) wird nichts archiviert.
2. `alt` = `archiv[neuerKontext]`, falls vorhanden, sonst leer. Der Eintrag wird aus dem Archiv genommen.
3. `gleicheAb` mit diesem `alt`, dem neuen Ablauf und `scharfId: null`.
4. Die scharfe Zeile ist die **erste nicht entfallene Zeile**, wie besprochen: „steht danach auf der ersten Zeile“.
5. `doc.kontext` ist jetzt der neue Kontext. `lastFired` bleibt als Anzeige stehen.
6. Der Bericht dieses Laufs wird nicht angezeigt. Angezeigt wird nur die Wechselmeldung (4.6).

### 4.5 Was im Rundown bearbeitbar bleibt

| Zeilenart | Titel, Notiz, Dauer | Aktionen | Verschieben | Löschen | Duplizieren | Hinweis |
| --- | --- | --- | --- | --- | --- | --- |
| lebende Ablaufzeile, Show mit iveo | gesperrt | frei | gesperrt | gesperrt | ja | „kommt aus iveo“ |
| lebende Ablaufzeile, Show ohne iveo | gesperrt | frei | gesperrt | gesperrt | ja | „kommt aus der Show, im Show-Editor ändern“ |
| entfallene Zeile | gesperrt | frei | gesperrt | ja | ja | „in iveo entfallen“ bzw. „in der Show entfallen“, Knopf „Als eigene Zeile behalten“ |
| eigene Zeile | frei | frei | frei | ja | ja | – |
| jede Zeile, **keine Show gemerkt** | frei | frei | frei | ja | ja | entfallene Zeilen behalten Markierung und Hinweis und feuern weiter nicht |

**Feldanzeige:** Gesperrte Felder erscheinen als Text oder als gesteuertes Feld (`value` mit `readOnly`), nicht als `defaultValue`-Eingabe. So zeigt der Editor nach einem Abgleich sofort den neuen Titel und die neue Dauer.

**Duplizieren:** Die Kopie ist immer eine eigene Zeile, mit neuer `id`, ohne `quelle` und `entfallen`. Titel, Notiz, Dauer und Aktionen werden kopiert, der Titel mit „(Kopie)“ wie heute (`apps/rundown/src/renderer/src/lib/doc.ts`, `duplicateRow`). Die Kopie steht direkt hinter dem Original und hängt nach R6 an dessen Anker.

**Verschieben einer eigenen Zeile:** Sie hängt danach an der nächsten lebenden Ablaufzeile über ihr (R6). Das ergibt sich aus der Reihenfolge, ein eigenes Feld ist nicht nötig.

**Regieplan-Import** (`apps/rundown/src/renderer/src/App.tsx:60-82`), solange eine Show gemerkt ist:
- Er legt eigene Zeilen an.
- „Anhängen“ setzt sie ans Ende.
- „Ersetzen“ löscht alle eigenen Zeilen und setzt die importierten ans Ende. Ablaufzeilen und entfallene Zeilen bleiben.

**Absicherung im Main:** Der Main nimmt in `rundown:setDoc` eine Zeile mit `quelle: 'ablauf'` nur an, wenn ihre `id` ein Schlüssel des aktuellen Ablaufs ist (lebend) oder schon vorher eine entfallene Zeile mit dieser `id` existierte (entfallen). Andere Zeilen mit `quelle` macht er zu eigenen Zeilen, ohne `quelle` und `entfallen`.

### 4.6 Hinweise in der Oberfläche

**Kanal:** `RundownState` bekommt `hinweise: { id: number; text: string; art: 'kurz' | 'stehend' }[]`.
- Der Main hängt Hinweise an.
- Kurze verschwinden nach 6 s.
- Stehende entfernt die neue IPC `rundown:hinweisWeg(id)`, wenn der Bediener sie wegklickt.

**Texte:**

| Anlass | Art | Text |
| --- | --- | --- |
| Abgleich mit nicht leerem Bericht (Show mit iveo) | kurz | „iveo: 2 geändert · 1 neu · 1 entfallen · 1 wieder da · neu sortiert“. Nur Teile mit Zähler > 0. `entfallen` und `entfernt` werden zusammen als „entfallen“ gezählt, „neu sortiert“ erscheint bei `verschoben > 0`. |
| dasselbe, Show ohne iveo | kurz | wie oben, mit „Show:“ statt „iveo:“ |
| `scharfVerrueckt` | stehend | „Deine scharfe Zeile „<von>“ ist entfallen. Scharf ist jetzt „<nach>“.“ bzw. „… Es gibt keine Zeile mehr.“ |
| Kontextwechsel zu `se:` | kurz | „Side Event gewechselt: <Titel>“. Der Titel kommt aus `show.iveo.sideEvents`, fehlt er dort, steht die `programId` da. |
| Kontextwechsel zu `liste:` | kurz | „iveo: Programmliste <Tag bzw. ‚alle Tage‘>“ |
| Kontextwechsel zu `show` | kurz | „Show-Ablauf (ohne iveo)“ |
| RELOAD ohne gemerkte Show | kurz | wie die Log-Warnung (5.1) |
| Show nicht lesbar | kurz | „Show nicht lesbar: <Grund>“ |
| Änderung abgewiesen (5.5) | stehend | „Gleichzeitig kam ein iveo-Abgleich. Deine letzte Änderung wurde nicht übernommen, bitte wiederholen.“ Ohne iveo heißt es „ein Abgleich mit der Show“. |
| Rundown-Datei außerhalb geändert (4.8) | kurz | „Rundown-Datei wurde außerhalb geändert, Datei geladen.“ |
| Sprung-Ziel entfallen beim GO (6.2) | kurz | „Sprung nicht gesendet: Ziel „<Titel>“ ist entfallen.“ |

### 4.7 Gedächtnis

- **Ort:** `<userData des Rundowns>/regie/<schlüssel>.json`, atomar geschrieben (Zwischendatei, dann umbenennen).
- **Schlüssel:** die ersten 16 Hex-Zeichen von SHA-256 über den absoluten, mit `path.resolve` normalisierten und kleingeschriebenen Pfad der Show-Datei. Er gilt für Shows mit und ohne iveo gleich. In 2b wird die Show-Datei des Masters zum Bezug (ihr Pfad als Kennung), nicht der lokale Pfad.
- **Inhalt:**
  ```
  { schemaVersion: 2, showPfad, showName, doc, scharfId, gespeichertAm,
    datei?: { pfad, mtimeMs, groesse, sha256 } }
  ```
  `doc` enthält das Archiv. `datei` ist der Stand einer eigenen Rundown-Datei, wie das Gedächtnis sie beim letzten Laden oder Speichern gesehen hat (4.8).
- **Wann geschrieben:** bei jeder Änderung des Dokuments oder der scharfen Zeile, wie heute der Autosave.
- **Autosave:** Der bisherige `rundown.autosave.jmrundown` wird **nur** noch für Dokumente ohne gemerkte Show geschrieben.
- **Zeiger auf die gemerkte Show:** `<userData>/regie/zuletzt.json` mit `{ showPfad, schluessel }`. Er wird beim Merken einer Show atomar geschrieben und bei „Öffnen…“ und „Neu“ gelöscht.

### 4.8 Eigene Rundown-Datei in der Show

Referenziert die Show für `jm-rundown` eine `.jmrundown`:
- Ein relativer Pfad wird relativ zur Show-Datei aufgelöst. Heute fehlt das (`apps/rundown/src/main/index.ts:283`).
- **Ausgangsstand beim Öffnen:**
  - Gibt es kein Gedächtnis, gilt die Datei.
  - Gibt es ein Gedächtnis, wird die Datei mit `gedaechtnis.datei` verglichen: Pfad, Größe, Änderungszeit, SHA-256.
    - Weicht etwas ab, wurde sie außerhalb geändert oder ersetzt. Dann gilt die Datei, mit dem Hinweis aus 4.6.
    - Sonst gilt das Gedächtnis. Weicht es inhaltlich vom Dateistand ab, steht „ungespeicherte Änderungen“ an.
  - Eine hineinkopierte Datei behält unter Windows ihre alte Änderungszeit. Der Vergleich über den SHA-256 erkennt sie trotzdem.
- Danach wird mit `show.ablauf` abgeglichen, wie ohne Datei.
- „Speichern“ schreibt die Datei samt Archiv und aktualisiert `gedaechtnis.datei`. In die Datei geschrieben wird **nur** bei „Speichern“.

### 4.9 Einmalige Titel-Zuordnung für Altdokumente

Gilt, wenn `doc.zuordnungOffen` gesetzt ist. Das sind Version-1-Dokumente: alte `.jmrundown`-Dateien und der alte Autosave (5.2). Vor R0–R9:
- Je Ablaufpunkt wird die alte Zeile mit **genau gleichem Titel** gesucht.
- Zugeordnet wird nur, wenn der Titel im neuen Ablauf **und** unter den alten Zeilen je genau einmal vorkommt.
- Die zugeordnete alte Zeile wird zur Ablaufzeile: `id` = Schlüssel, `quelle: 'ablauf'`. Ihre Aktionen bleiben.
- Alles andere bleibt eigene Zeile mit seinen Aktionen. Die passende Ablaufzeile erscheint zusätzlich (R3), und der Bediener löscht die überzählige.
- Danach wird `zuordnungOffen` gelöscht und das Dokument bekommt `kontext`.

---

## 5 · Neu laden im Rundown

### 5.1 Befehl

- `RUNDOWN RELOAD` kommt über den Steuerserver (Port 8731): neuer Zweig `case 'reload'` in `handleSuiteCommand` (`apps/rundown/src/main/index.ts:62-79`).
- Der Befehl ist intern wie `TIMER RELOAD` und kommt **nicht** in den Companion-Katalog (`packages/suite-control-protocol/src/capabilities.ts:370-386` bleibt).
- Ohne gemerkte Show: Warnung im Log, wortgleich zum Timer (`apps/timer/src/main/index.ts:375-383`), dazu ein kurzer Hinweis (4.6).
- Neuer `default`-Zweig: Unbekannte Verben kommen als Warnung ins Log, statt still zu verfallen.
- Mehrere RELOADs binnen 300 ms werden zu einem Abgleich zusammengefasst, über eine kleine reine Hilfsfunktion mit übergebener Uhr, damit sie testbar ist.

### 5.2 Ladewege

| Weg | Heute | Neu |
| --- | --- | --- |
| **Show-Deep-Link, andere Show als die gemerkte** | ersetzt, Zeile 1, Aktionen weg | Show merken (Zeiger 4.7). **Ausgangsstand**, in dieser Reihenfolge: Gedächtnis bzw. eigene Rundown-Datei nach 4.8 → alter Autosave nach Übergangsregel (unten) → leeres Dokument. Dann `wendeShowAn`. Scharfe Zeile: aus dem Gedächtnis, wenn der Kontext gleich geblieben ist, sonst die erste nicht entfallene (4.4). |
| **Show-Deep-Link, dieselbe Show** | wie oben | Abgleich wie RELOAD, Position bleibt (R7) |
| **Start ohne Deep-Link** (Launcher-Kachel, Neustart nach Absturz) | Autosave | Gibt es den Zeiger `regie/zuletzt.json` und ist die Show lesbar: wie „Show-Deep-Link, andere Show“, also mit Gedächtnis und gemerkter scharfer Zeile, und danach Abgleich. Ist die Show nicht lesbar: Der Gedächtnisstand wird geladen, die Show bleibt gemerkt, Hinweis „Show nicht lesbar“, und ein späteres RELOAD versucht es erneut. Ohne Zeiger: Autosave wie heute. |
| **`RUNDOWN RELOAD`** | – | Show neu lesen, `wendeShowAn`, Position nach R7 bzw. 4.4 |
| **„Öffnen…“ einer `.jmrundown`** | ersetzt | wie heute: ersetzt. Die gemerkte Show und der Zeiger werden vergessen, ein späteres RELOAD warnt. |
| **„Neu“** | Beispiel-Dokument | wie heute. Die gemerkte Show und der Zeiger werden vergessen. |

**Übergangsregel für den alten Autosave** (Ergänzung 0.7):
- Gilt beim ersten Öffnen einer Show, für die es weder Gedächtnis noch eigene Rundown-Datei gibt.
- Voraussetzung: Der beim Start geladene Autosave ist ein Version-1-Dokument mit `name === show.name`. Dann wird er Ausgangsstand mit `zuordnungOffen` (4.9).
- Vorher wird er einmal als `rundown.autosave.v1.jmrundown` gesichert und ist über „Öffnen…“ erreichbar.
- Das Beispiel-Dokument (`defaultDoc`) ist nie Ausgangsstand. Ein Autosave mit anderem Namen auch nicht.

**Show ohne Ablauf und ohne eigene Rundown-Datei:** Die Show wird gemerkt, das aktuelle Dokument bleibt unangetastet, wie heute. Bekommt die Show später einen Ablauf (RELOAD), gilt die Zeile „andere Show“.

**Bei jedem Lesen der Show:**
- `iveoSpeakers` und `iveoSideEvents` werden aufgefrischt, wie heute beim Öffnen (`index.ts:277-278`).
- Der Main hält fest:
  - die Schlüssel des normalisierten `show.ablauf` in Reihenfolge, für 6.2,
  - ob die Show eine eigene Timer-Liste hat (6.2).

**Show beim RELOAD nicht lesbar:** Der Stand bleibt stehen, der Fehler geht ins Log, dazu der Hinweis aus 4.6. Nichts wird verworfen.

### 5.3 Scharfe Zeile über die Kennung

- Der Main führt `scharfId` statt `index`. `index` wird bei Bedarf daraus errechnet, für die Navigation und für STATE `cue=` an Companion.
- Jede Änderung am Dokument hält die scharfe Zeile über `scharfId`, ob Abgleich oder Bearbeitung. Bei Bearbeitungen bestimmt `scharfNachBearbeitung` sie:
  - Löschen oder Verschieben einer Zeile darüber verschiebt die Markierung nicht mehr. Heute passiert das, weil `setDoc` nur begrenzt (`apps/rundown/src/main/index.ts:97`).
  - Wird die scharfe Zeile selbst gelöscht, gilt R7 (c) sinngemäß: die nächste nicht entfallene Zeile, die vorher hinter ihr stand, sonst die letzte nicht entfallene, sonst `null`.
- `scharfId` kommt ins Gedächtnis (4.7) und übersteht einen Neustart (5.2).
- `RundownState` trägt `scharfId` zusätzlich zu `index`.

### 5.4 Laufende GO-Folgen

| Ereignis | Heute | Neu |
| --- | --- | --- |
| neues GO, Weiter, Zurück, Springen | bricht ausstehende Aktionen ab | wie heute |
| andere Show oder Datei laden, „Neu“ | bricht ab | wie heute |
| Abgleich (RELOAD, dieselbe Show erneut) | – (gab es nicht) | bricht **nicht** ab |
| Bearbeiten im Editor | bricht ab (`index.ts:92-95`) | bricht **nicht** ab |

Welche Aktionen ausstehen, steht beim GO fest. Festgehalten werden die Aktionsobjekte, die Protokollzeile baut `fireOne` erst beim Senden (`index.ts:116-121`, `:137-139`). Ausstehende Aktionen laufen zu Ende, auch wenn ihre Zeile inzwischen geändert, entfallen oder gelöscht ist. Ein `timer goto` mit `zielId` wird erst beim Senden in eine Nummer umgerechnet (6.2).

### 5.5 Gleichzeitig bearbeiten und abgleichen

- Der Main führt zwei Zähler:
  - `rev` steigt bei jeder Änderung am Dokument.
  - `abgleichRev` hält fest, bei welchem `rev` der letzte Abgleich lief.
- `rundown:setDoc(doc, basisRev)`:
  - Ist `basisRev < abgleichRev`, lief seit dem Stand des Renderers ein Abgleich. Die Änderung wird abgewiesen.
  - Sonst wird sie angenommen, auch wenn `basisRev < rev` wegen eigener schneller Eingaben. Das heutige Verhalten bei schnellem Tippen bleibt so erhalten.
- **Bei einer Abweisung:**
  - Der Renderer bekommt den aktuellen Stand.
  - Ein Abweisungszähler im `RundownState` geht in die React-Schlüssel der Editor-Felder ein, damit die Felder neu aufgebaut werden und den gespeicherten Stand zeigen.
  - Die Meldung ist stehend (4.6).
- `RundownState` trägt `rev`. `useRundown` schickt ihn als `basisRev` mit (`apps/rundown/src/renderer/src/store/useRundown.ts:34`), über die Preload-Brücke (`apps/rundown/src/preload/index.ts`).
- Für eigene Zeilen und Aktionsfelder gilt: Ablaufzeilen haben jetzt feste Kennungen, die Schlüssel `key=row.id` bleiben also gleich und offene Eingabefelder werden beim Abgleich nicht neu aufgebaut. Gesperrte Felder sind ohnehin gesteuert (4.5).

---

## 6 · Timer und Sprung-Aktionen über die Kennung

### 6.1 Timer

- `ablaufToTimetable` und `parseTimetable` ziehen nach `apps/timer/src/shared/show-ablauf.ts`, ohne Electron.
- `ablaufToTimetable` gibt `id` mit, wenn vorhanden.
- In `timer-state.ts` gilt bei `tt:setAll` und `tt:replaceItems` (`:259-281`) für jeden Punkt: `id` ist die mitgegebene Kennung, wenn sie ein nicht leerer String ist und in dieser Liste noch nicht vorkommt. Sonst `makeId()`.
  - Das gilt auch für Aufrufe über den Socket `:7777`. Kennungen von dort werden ebenso geprüft.
- `tt:replaceItems`:
  - Vor dem Tausch merkt sich der Timer die `id` des aktiven Punkts.
  - Kommt sie in der neuen Liste vor, wird `activeIndex` ihre neue Stelle.
  - Sonst gilt das heutige Verhalten: Die Nummer bleibt, begrenzt auf das Ende. Dazu die Logzeile „Aktiver Punkt im neuen Ablauf nicht mehr vorhanden, Nummer gehalten“.
  - Der Countdown bleibt unangetastet wie heute.
- Ohne Kennungen verhält sich alles wie heute. Das betrifft die eigene Timer-Liste in den Show-Einstellungen und alte Shows.
- **Eigene Timer-Liste** heißt: `settings.timetable` ist ein Array mit mindestens einem Objekt, also genau die Bedingung, unter der `parseTimetable` eine Liste liefert. Die Prüfung wird als `hatEigeneTimerListe(settings)` nach `@jm/show` gezogen. Timer und Rundown nutzen dieselbe Funktion.

### 6.2 Sprung-Aktionen im Rundown

**Auswahl im Zeilen-Editor:** Für `timer goto` gibt es statt eines Zahlenfelds eine Auswahl der Ablaufpunkte in Ablaufreihenfolge, angezeigt als „<n> · <Titel>“.
- Eine Auswahl schreibt sofort `zielId` und die Nummer in `args[0]`.
- Die Option „Nummer von Hand“ bleibt, für Shows mit eigener Timer-Liste und für Rundowns ohne Show.

**Alte Aktionen ohne `zielId`** werden nicht stillschweigend gebunden. Sie erscheinen als „Nummer von Hand: <n> (<Titel an Stelle n>)“ mit dem Knopf „an diesen Punkt binden“. Gebunden sind sie erst nach diesem Knopf oder nach einer Auswahl in der Liste.

**Auflösen:** `loeseSprungZiel(aktion, ablaufSchluessel, eigeneTimerListe)`:

| Lage | Ergebnis |
| --- | --- |
| keine `zielId`, oder eigene Timer-Liste | `{ n: args[0], gebunden: false }` |
| `zielId` steht in `ablaufSchluessel` | `{ n: Stelle + 1, gebunden: true }`. `ablaufSchluessel` ist die Liste des normalisierten `show.ablauf`, also genau die Liste, die der Timer hat. |
| `zielId` fehlt | `{ entfallen: true }` |

**Wer auflöst:** Dieselbe Funktion nutzen:
- **GO:** in `fireOne` beim Senden, also bei verzögerten Aktionen erst nach Ablauf von `delayMs`, gegen den dann aktuellen Stand.
- **Test-Knopf:** `rundown:fireAction` bekommt `rowId` und `actionId` statt roher Argumente. Der Main löst auf wie beim GO.
- **Aktions-Chip in der Liste und Vorschau im Editor:** Sie zeigen die aufgelöste Nummer. Der Renderer bekommt `ablaufSchluessel` und `eigeneTimerListe` über `RundownState`.

**Ziel entfallen:** Es wird nicht gesendet. Die Quittung trägt `{ role: 'timer', line: 'TIMER GOTO (Ziel entfallen)', delivered: false }`, dazu eine Logzeile und der Hinweis aus 4.6. Chip und Vorschau zeigen „Ziel entfallen“, und der Test-Knopf sendet nicht.

**R0-Umbenennungen** schreiben `zielId` um (4.2), damit Sprünge den Wechsel von Ersatz- zu echten Kennungen überstehen.

### 6.3 Bleibt nummernbasiert

- `RUNDOWN GOTO n` und `TIMER GOTO n` direkt aus Companion
- `TITLER RECALL <nr>`
- `PRESENTER GOTO n` (Foliennummern)

### 6.4 Titler: nur nachmessen

In 2a wird geprüft, ob eine Bauchbinde auf Sendung den Namen wechselt, wenn sich die Speaker-Liste verschiebt. Das ist bisher eine Vermutung aus `apps/titler/src/main/datalink.ts:185-192` und `apps/titler/src/renderer/src/views/OutputView.tsx:25-29`.
- **Prüfung im Durchgang 9.8:** Bauchbinde mit Eintrag 3 auf Sendung, dann im nachgebauten iveo einen Speaker davor einfügen, RELOAD, Ausgabe ablesen.
- **Ergebnis:** Es kommt in den PR-Text und in die 2b-Spec. Behoben wird es in 2b.

---

## 7 · Launcher

### 7.0 Kern und Hülle

`apps/launcher/src/main/iveo-sync.ts` wird geteilt, nach dem Muster von `apps/launcher/src/main/verbund/kern.ts` aus Teil 1:

- **Neu: `src/main/iveo-abgleich-kern.ts`**, ohne Electron-Import. Er enthält:
  - Abfrage (Listen- und Agenda-Modus) und Umschalten
  - Signatur (7.2), Generation und Reihenfolge (7.3)
  - Schreiben über 7.4
  - Statuswechsel (7.6)
  - die Reaktion auf das Speichern der offenen Show (7.5)

  Seine Abhängigkeiten bekommt er von außen: `clientFabrik(token, baseUrl)`, `token(event)`, `leseShow(pfad)`, `schreibeShow(pfad, inhalt)` (7.4), `benachrichtige(appId, zeile) → Anzahl`, `cacheSchreiben`, `log`, `jetzt()`, `meldeStatus(status)`, `meldeAktiv()`. Den Takt treibt die Hülle.
- **Neu: `src/main/show-schreiben.ts`**, das atomare Schreiben mit übergebenen fs-Funktionen.
- **`iveo-sync.ts`** wird zur dünnen Electron-Hülle: Einstellungen, Token, Health, Renderer-Ereignisse, `setInterval`.
  - Der Abfragetakt ist 45 s und lässt sich nur für Tests über die Umgebungsvariable `JMPS_IVEO_POLL_MS` verkürzen.
  - Jeder Abruf bekommt eine Zeitgrenze von 15 s. Die Hülle setzt dazu in den `fetchImpl` des Clients `AbortSignal.timeout(15000)` ein (`packages/iveo/src/client.ts:60-75`, `:128`).

### 7.1 Rundown benachrichtigen

An allen drei Stellen (heute `iveo-sync.ts:553-554`, `:654-655`, `:859-860`) geht zusätzlich `RUNDOWN RELOAD` an `jm-rundown` raus.

Logzeile: „iveo: RELOAD → <n> Timer, <n> Titler, <n> Rundown benachrichtigt.“

### 7.2 Signatur

- **Neu: `ablaufSignatur(ablauf, speakers)`** = `JSON.stringify` aus zwei Teilen:
  - die Punkte nach `normalizeAblauf` aus `@jm/show` (3.1), in fester Feldreihenfolge `id, label, durationMs, note, plannedStartMs, owner, category`
  - die Speaker (`name, title`)
- **Beim Öffnen** (`onShowOpened`) wird `lastSig` aus der Show-Datei gesetzt.
- **1-Punkt-Ablauf an allen drei Stellen gleich:** Binden, Abfrage und Umschalten bilden ihn ohne `stagesById`, damit die Notiz überall gleich ist. Heute nutzt nur das Binden `stagesById`, und danach kommt bei jedem Side Event ohne Agenda ein Schein-„1 geändert“.
- **Alle drei Wege vergleichen gegen `lastSig`:**
  - **Agenda-Abfrage:** wie heute, nur mit der neuen Funktion.
  - **Listen-Abfrage:** neu. Ist nichts geändert, wird weder geschrieben noch benachrichtigt, `lastSyncIso` rückt trotzdem vor.
  - **Umschalten:** setzt `lastSig`.
- **Bestands-Shows ohne Kennungen:** Im Agenda-Modus unterscheidet sich die Signatur der ersten Abfrage nach dem Update im Feld `id` von der Datei. Diese Abfrage schreibt die Kennungen deshalb einmal nach und schickt RELOAD. Im Listen-Modus passiert das bei der ersten echten Änderung. Das ist gewollt: Der Rundown überbrückt den Wechsel mit R0, und der Bericht bleibt leer.
- **Merker erst nach erfolgreichem Schreiben:** `lastSig`, `lastSyncIso`, `filter` und `sideCtx` rücken erst nach erfolgreichem Schreiben (7.4) vor. Scheitert das Schreiben:
  - Abfrage: kein RELOAD. Die nächste Abfrage mit demselben iveo-Stand schreibt erneut.
  - Umschalten: Antwort `ok: false` mit „Show konnte nicht geschrieben werden“.

### 7.3 Abfrage und Umschalten nacheinander

**Generationsnummer:** Sie steigt bei jedem Umschalten, bei `onShowOpened` und bei `stopIveoPolling`.

**Ablauf einer Abfrage:**
- Sie hält beim Start fest, mit welcher Show (`a = active`) und welcher Generation sie läuft, und arbeitet nur mit `a`.
- Vor dem Schreiben prüft sie `active === a && generation === gen`. Sonst verwirft sie ihr Ergebnis, ohne zu schreiben.
- Prüfen und Schreiben stehen ohne `await` dazwischen hintereinander. Weil `schreibeShow` synchron ist, kann sich dazwischen nichts schieben.

**Reihenfolge:**
- Abfragen laufen nacheinander. Läuft noch eine, startet der Takt keine zweite.
- Umschaltungen laufen nacheinander.
- Ein Umschalten wartet **nicht** auf eine laufende Abfrage. Deren Ergebnis verfällt über die Generation. So bleibt auch `LAUNCHER SIDEEVENT` per Rundown-GO schnell, wenn iveo gerade hängt.

### 7.4 Show sicher schreiben

`schreibeShow` schreibt in eine Zwischendatei im selben Ordner und benennt sie dann um. Rückgabe ist `true` oder `false`.

Unter Windows kann das Umbenennen scheitern, wenn ein Tool die Show gerade liest (`EPERM`, `EBUSY`, `EACCES`). Dann gibt es bis zu 5 Versuche im Abstand von 50 ms, synchron. Scheitert alles: Warnung ins Log, Zwischendatei löschen, `false`.

### 7.5 Show-Editor verliert nichts mehr

**Laden:** `loadForEdit` hält die geladene Show unverändert als `geladen` fest.

**Speichern einer bearbeiteten Show** (`editPath` gesetzt): Die neue reine Funktion `baueGespeicherteShow(geladen, formular, aktuelleDatei?)` geht von `geladen` aus und überschreibt **nur**:
- `name`
- die Liste der Tools: entfernte fallen weg, neue kommen dazu
- je Tool `document` und `network.host`. Alle anderen Felder des Tools bleiben, auch `network.port` und `settings`.
- bei Battle `nameA/nameB/rounds` und bei Q&A `speakSeconds`. Alle anderen Einstellungsschlüssel dieser Tools bleiben.
- `ablauf` (siehe unten)
- `iveo` nur bei einer neuen Bindung. Sonst bleibt `geladen.iveo` samt `syncedAt`.

**Dauern:** `AblaufRow` merkt sich die geladene `durationMs` und den daraus erzeugten Minuten-Text. Ist der Minuten-Text beim Speichern unverändert, wird die geladene `durationMs` geschrieben, sekundengenau. Sonst gilt die Eingabe wie heute.

**Kennungen:** wie in 3.3 (S2, S3).

**Neue Shows** (ohne `editPath`): `onSave` bleibt wie heute, mit Kennungen.

**Speichern der gerade offenen Show** (Ergänzung 0.2): Der Launcher merkt sich den Pfad der offenen Show, auch ohne iveo. Speichert der Editor genau diese Datei, gilt:
1. **Gleiche Bindung, Ablauf unverändert:** Ist die Show an iveo gebunden, wurde nicht neu gebunden, und ist der Ablauf im Formular gegenüber `geladen.ablauf` unverändert, kommen `ablauf` und `iveo` aus der **aktuell gelesenen Datei**, nicht aus `geladen`. So überschreibt das Speichern keine iveo-Änderungen, die nach dem Öffnen des Editors abgefragt wurden.
2. **Danach im Kern:**
   - Das Schreiben läuft über den Kern (Generation + 1).
   - `active` wird aus der geschriebenen Datei neu aufgesetzt: Filter, `lastSig`, Kontext.
   - RELOAD geht an Timer, Titler und Rundown, mit der Logzeile aus 7.1.

### 7.6 Abfragefehler sichtbar

**Agenda-Abfrage** (`pollSideEvent`):
- Scheitert `listAgendaItems`, bricht die Abfrage ab: nichts geschrieben, kein RELOAD (Ergänzung 0.1).
- Ebenso, wenn der fehlende Side-Event-Kontext (`sideCtx`) nicht nachgeladen werden kann, weil `getProgram` scheitert. Sonst baut die Abfrage den Ablauf ohne Startzeit, Kategorie und Verantwortlich.
- Nur eine erfolgreich **leere** Agenda wird zum 1-Punkt-Ablauf, wie heute.

**Umschalten** (`resolveSideEventLight`, `iveo-sync.ts:764-769`): Scheitert `listAgendaItems`, scheitert das Umschalten mit der Meldung „Agenda von iveo nicht abrufbar, bitte erneut versuchen“. Nichts wird geschrieben.

**Sichtbarkeit:**
- Jeder Fehlschlag einer Abfrage setzt einen Zustand `gestört` mit Text. Der Renderer erfährt ihn über das neue Ereignis `iveo-sync-status` `{ ok: boolean, text?: string, seit?: string }`.
- Die erste erfolgreiche Abfrage danach setzt `ok: true`.
- Das iveo-Panel des Launchers zeigt bei `ok: false` die Zeile „iveo-Abgleich gestört: <Text> (seit <Uhrzeit>)“.
- **Texte:**
  - HTTP 401: „Token ungültig oder widerrufen“
  - Show gebunden, aber auf diesem Rechner kein Token (beim Öffnen und bei jeder Abfrage, heute still: `iveo-sync.ts:484-491`, `:516-519`): „kein iveo-Token auf diesem Rechner, nur Offline-Ablauf“
  - sonst: die bestehende Abbildung `toClientError` (`iveo-sync.ts`)
- **Log:** Der erste Fehlschlag und jeder Wechsel des Fehlertexts kommen als Warnung ins Log. Gleichbleibende Wiederholungen nicht, damit das Log nicht alle 45 s wächst.

---

## 8 · Aufbau und Einbau

| Paket/App | Dateien | Inhalt |
| --- | --- | --- |
| `@jm/show` | `src/index.ts` | `id` am Ablaufpunkt, `normalizeAblauf` exportiert, Doppelte (3.1, 3.5), `hatEigeneTimerListe` (6.1) |
| `@jm/iveo` | `src/mapper.ts`, `test/selftest.ts` | Kennungen in den Umwandlern (3.2). Der Selbsttest importiert `@jm/show` schon (`packages/iveo/test/selftest.ts:30`) und bekommt auch die `@jm/show`-Fälle. |
| Launcher Main | **neu** `src/main/iveo-abgleich-kern.ts`, **neu** `src/main/show-schreiben.ts`, `src/main/iveo-sync.ts` (Hülle), **neu** `test/iveo-abgleich.test.ts` | 7.0 bis 7.6 |
| Launcher Renderer | `ShowEditorModal.tsx`, **neu** `lib/show-speichern.ts` (`baueGespeicherteShow`), `lib/scenarios.ts`, iveo-Panel-Komponente, Store für `iveo-sync-status` | 7.5, Kennungen, Anzeige 7.6 |
| Launcher Shared/Preload | Ereignistyp `iveo-sync-status`; IPC für „Show gespeichert“ an den Main | 7.5, 7.6 |
| Timer | **neu** `src/shared/show-ablauf.ts`, `src/main/index.ts`, `src/shared/timer-state.ts`, `test/selftest.ts` | 6.1 |
| Rundown Shared | `src/shared/types.ts` (inkl. `RundownState`, `JmRundownApi`), **neu** `abgleich.ts`, **neu** `sprung.ts`, **neu** `scharf.ts`, `conductor.ts` (Navigation überspringt entfallene), `test/selftest.ts` | 4.1 bis 4.4, 4.9, 5.3, 6.2 |
| Rundown Main | `src/main/index.ts`, `src/main/store.ts`, **neu** `src/main/gedaechtnis.ts` | 4.6 bis 4.8, 5.1 bis 5.5, 6.2 |
| Rundown Preload | `src/preload/index.ts` | `setDoc(doc, basisRev)`, `fireAction(rowId, actionId)`, `hinweisWeg(id)`, „Als eigene Zeile behalten“ |
| Rundown Renderer | `RowEditor.tsx`, `RundownList.tsx`, `App.tsx`, `store/useRundown.ts`, `lib/doc.ts` (`duplicateRow` entfernt `quelle`/`entfallen`; Import „Ersetzen“ nur eigene Zeilen) | 4.5, 4.6, 5.5, 6.2 |
| CI | `.github/workflows/ci-checks.yml` | Job `selftests` (9.7) |

**Nicht angefasst:**
- `packages/master-link`
- `packages/app-runtime`
- `packages/suite-control-protocol` (kein neuer Katalog-Eintrag)
- Titler-Code (nur Messung, 6.4)
- Companion-Module

---

## 9 · Tests

Alle Tests laufen ohne Netz und ohne Fenster, außer 9.8.

### 9.1 Rundown (`apps/rundown/test/selftest.ts`, `npm run selftest -w @jm/rundown`)

Je Fall Eingabe → erwartete Zeilen, `scharfId` und Bericht. Ein Zähler, der nicht genannt ist, muss 0 sein.

**`gleicheAb`:**
1. Gleiche Schlüssel, neuer Titel → Titel neu, Aktionen gleich; `geaendert: 1`.
2. Neuer Punkt in der Mitte → neue Zeile ohne Aktionen an iveo-Stelle; `neu: 1`, `verschoben` je nach Vorgängerwechsel.
3. Punkt ohne Aktionen weg → Zeile weg; `entfernt: 1`.
4. Punkt mit einer **ausgeschalteten** Aktion weg → Zeile bleibt mit `entfallen`; `entfallen: 1`.
5. Entfallener Punkt kommt zurück → Markierung weg, Aktionen da; `zurueck: 1`.
5b. alt A, B (entfallen, 1 Aktion), X (eigen), neu A, B → A, B, X; `zurueck: 1`.
6. Umsortieren C, A statt A, C → iveo-Reihenfolge, Aktionen wandern mit; `verschoben ≥ 1`.
7. Eigene Zeile hinter B, B wandert nach vorne → die eigene Zeile wandert mit.
8. Eigene Zeile hinter B, B weg ohne Aktionen → eigene Zeile hängt an A.
9. Eigene Zeilen ganz oben bleiben ganz oben.
10. Zwei eigene Zeilen hinter B behalten ihre Reihenfolge.
11. Scharfe Zeile wandert → bleibt scharf, `scharfVerrueckt: null`.
12. Scharfe Zeile entfällt mit Aktionen → nächste nicht entfallene dahinter (alte Reihenfolge) scharf; `scharfVerrueckt` gesetzt.
12b. alt A, B* (1 Aktion), C, neu C, A → B entfällt, scharf ist C.
12c. Scharfe Zeile ohne Aktionen verschwindet (R4) → Nachfolger nach R7 (c).
12d. Eine eigene Zeile ist scharf, ihr Anker wandert → bleibt scharf.
13. Scharfe Zeile ist die letzte und entfällt → letzte nicht entfallene scharf.
14. Alle Zeilen entfallen → `scharfId: null`.
14b. `scharfId` null, der Ablauf bringt wieder Punkte → erste Zeile scharf, `scharfVerrueckt: null`.
15. Zweimal derselbe Ablauf → gleiches Ergebnis, zweiter Bericht leer (R8).
16. Ablauf ohne Kennungen → Ersatz-Kennungen, zweimal hintereinander stabil.
17. Gleiche Titel ohne Kennungen → `ersatz:X`, `ersatz:X#2`.
18. Doppelte Kennungen im Ablauf → `#2`.
19. **R0:** Zeile `ersatz:X` mit Aktionen, neuer Ablauf `{ id: 'u1', label: 'X' }` → Zeile `u1` mit denselben Aktionen; `neu: 0`, `entfallen: 0`; `umbenannt` enthält `ersatz:X → u1`.
19b. R0 mit doppeltem Titel → keine Brücke, alte Zeile entfällt bzw. verschwindet.
19c. R0 rückwärts: echte Kennung → nur Ersatz-Kennung → Aktionen bleiben.
20. „Als eigene Zeile behalten“, danach kommt der Punkt zurück → eigene Zeile und neue Ablaufzeile, keine doppelte `id`.
21. Ablaufzeile mit Aktionen duplizieren, dann mit demselben Ablauf abgleichen → die Kopie bleibt eigene Zeile direkt hinter dem Original, Bericht leer.

**`wendeShowAn`:**

22. Altformat, Titel eindeutig → Zuordnung, Aktionen an der Ablaufzeile, `zuordnungOffen` gelöscht.
23. Altformat, Titel doppelt → keine Zuordnung, alte Zeilen bleiben eigene Zeilen, die Ablaufzeilen kommen zusätzlich.
24. Version-1-Datei ohne Show gespeichert (bleibt `zuordnungOffen`), danach in eine Show eingetragen → die Titel-Zuordnung läuft.
25. Kontextwechsel A → B → A: Zeilen, Aktionen und eigene Zeilen von A wieder da, scharf jeweils die erste; beim Wechsel kein Bericht.
26. Liste Tag 1 → Side Event → Liste Tag 2 → Liste Tag 1: keine Zeile von Tag 1 entfallen, alle Aktionen wieder da.
27. R0-Umbenennung schreibt `zielId` in Zeilen und Archiv und `scharfId` um.

**Weitere Funktionen:**

28. Navigation überspringt entfallene Zeilen bei GO, Weiter und Zurück. `GOTO n` auf eine entfallene → nächste.
29. `scharfNachBearbeitung`: Zeile darüber löschen, Zeile darüber verschieben → scharfe Zeile gleich; scharfe Zeile löschen → Nachfolger.
30. `loeseSprungZiel`: Ziel nach Umsortieren an neuer Stelle; Ziel entfallen → `{ entfallen: true }`; eigene Timer-Liste → `args[0]`; ohne `zielId` → `args[0]`, nicht gebunden.
31. Verzögertes `timer goto`: GO, danach ein Abgleich mit eingefügtem Punkt vor dem Ziel, dann Senden → gesendet wird die **neue** Nummer. Getestet über die Auflösung zum Sendezeitpunkt.
32. Absicherung in `setDoc` (4.5): Eine Zeile mit `quelle: 'ablauf'` und unbekannter `id` wird zur eigenen Zeile.
33. Annehmen oder Abweisen (5.5): zwei schnelle eigene Änderungen ohne Abgleich → beide angenommen; Änderung auf einem Stand vor einem Abgleich → abgewiesen.
34. RELOAD-Zusammenfassung: drei RELOADs binnen 300 ms → ein Abgleich.
35. Ausgangsstand (5.2): Gedächtnis vorhanden → Gedächtnis; Datei außerhalb geändert, auch mit alter Änderungszeit → Datei; alter Autosave mit gleichem Namen → übernommen mit `zuordnungOffen`; Autosave mit anderem Namen bzw. Beispiel-Dokument → leer.
36. Regieplan-Import „Ersetzen“ → eigene Zeilen ersetzt, Ablaufzeilen bleiben.

### 9.2 Gegenprobe

Für die reinen Funktionen werden absichtlich Fehler eingebaut. Jede dieser Abweichungen muss mindestens einen Fall aus 9.1 rot machen:
- R0 fehlt
- R2 übernimmt die Aktionen nicht
- R5 ohne Unterschied zwischen mit und ohne Aktionen
- R6: Anhänger am alten statt am überlebenden Anker
- R7 über die Nummer statt über die Kennung
- R8 ohne Idempotenz, etwa ein Bericht, der immer zählt
- 4.4 ohne Archivierung
- Kontext `liste` ohne Filter
- 4.9 ohne Eindeutigkeitsprüfung
- Navigation, die entfallene Zeilen nicht überspringt
- 6.2 sendet `args[0]` statt der Stelle der `zielId`
- 6.2 löst beim GO statt beim Senden auf
- 5.3 hält die Nummer statt `scharfId`

Das Ergebnis (Fehler → roter Fall) kommt in den Bericht der Aufgabe.

### 9.3 Kennungs-Durchlauf (`npm run selftest -w @jm/iveo`)

Aus einer nachgebauten iveo-Antwort wird ein Ablauf gebaut (S4) und normalisiert (S1). Die Show wird geschrieben und gelesen (`serializeShow`/`parseShow`). Dann wird geprüft:
- Die Timer-Punkte aus `apps/timer/src/shared/show-ablauf.ts` (S7) tragen die iveo-ID. Dieser Teil steht im Timer-Selbsttest.
- Die Abgleich-Zeilen (S9) tragen die iveo-ID. Dieser Teil steht im Rundown-Selbsttest.
- Doppelte Kennungen in einer Show werden beim Lesen aufgelöst (3.5).

### 9.4 Timer (`npm run selftest -w @jm/timer`)

- `replaceItems` mit eingefügtem Punkt vor dem aktiven → `activeIndex` folgt der Kennung, der Countdown bleibt gleich.
- Aktiver Punkt weg → Nummer gehalten (heutiges Verhalten).
- Doppelte und leere Kennungen → `makeId()`.
- Ohne Kennungen → wie heute.
- `hatEigeneTimerListe`: leeres Array → nein; Array mit einem Objekt → ja.

### 9.5 Show-Editor (`baueGespeicherteShow`, im Launcher-Test)

- Laden und Speichern ohne Änderung → `deepEqual(geladen, ergebnis)`, bis auf `updatedAt`.
- Fälle mit eigener Timer-Liste, Presenter-PIN, `network.port`, `iveo.syncedAt` und 90-s-Dauer.
- Abfrage zwischen Laden und Speichern: Der Ablauf im Formular ist unverändert → das Ergebnis trägt den Ablauf der aktuellen Datei.

### 9.6 Launcher-Kern (`test/iveo-abgleich.test.ts`, mit nachgebautem Client)

1. Öffnen + erste Abfrage mit gleichem Stand → kein Schreiben, kein RELOAD.
2. Listen-Modus, `updated_since` trifft, Ablauf gleich → kein Schreiben.
3. Agenda-Abruf scheitert → kein Schreiben, Zustand `gestört`; danach Erfolg → `ok`.
4. `getProgram` scheitert bei fehlendem `sideCtx` → kein Schreiben, `gestört`.
5. Leere Agenda → 1-Punkt-Ablauf; gleich gebunden und abgefragt → kein Schein-„geändert“.
6. HTTP 401 → Text „Token ungültig oder widerrufen“.
7. Kein Token → Text „kein iveo-Token auf diesem Rechner, nur Offline-Ablauf“.
8. Umschalten während laufender Abfrage → die Abfrage verwirft, das Umschalten wartet nicht.
9. Show-Wechsel während einer Abfrage → nichts geschrieben.
10. Schreiben scheitert → kein RELOAD, `lastSig` unverändert; die nächste Abfrage mit gleichem Stand schreibt erneut.
11. Umbenennen scheitert zweimal mit `EBUSY` → der dritte Versuch gelingt. Scheitert es immer → Zwischendatei gelöscht, Original unverändert.
12. RELOAD-Zählung enthält den Rundown.
13. Speichern der offenen Show im Editor → `active` neu aufgesetzt, RELOAD gesendet. Bei neuer Bindung nutzt die nächste Abfrage den neuen Filter.

### 9.7 CI

Der Job `selftests` (`.github/workflows/ci-checks.yml`) bekommt namentlich:
- `npm run selftest -w @jm/rundown`
- `npm run selftest -w @jm/iveo`
- `npm run selftest -w @jm/timer`
- das neue Launcher-Skript `selftest:iveo` (tsx `test/iveo-abgleich.test.ts`), neben dem bestehenden `selftest:verbund`

Keiner dieser Tests darf Electron laden. Die Zeitgrenze bleibt 15 min.

### 9.8 Durchgang mit gebauten Programmen

**Aufbau:**
- Gebaut werden Launcher, Timer, Rundown und Titler.
- Ein nachgebauter iveo-Server läuft auf `127.0.0.1`, ein eigener HTTP-Server im Test-Skript mit den Endpunkten, die `IveoClient` nutzt.
- Die Show-Datei wird direkt mit Bindung an diesen Server geschrieben. Das Token kommt über `JMPS_IVEO_TOKEN`, der Takt über `JMPS_IVEO_POLL_MS=2000`.

**Messpunkte:**
- Gedächtnis-Datei `regie/<schlüssel>.json`
- STATE des Rundowns auf 8731
- Timer-Socket 7777
- Logzeilen der drei Programme

**Ablauf:**
1. Show öffnen. Der Rundown zeigt drei Agenda-Punkte.
2. Aktionen an Punkt 2 anlegen, darunter ein **verzögertes** `timer goto` mit Ziel Punkt 2. Eine eigene Zeile hinter Punkt 1.
3. GO auf Punkt 2. Während das verzögerte `timer goto` aussteht, im Server einen Punkt vor Punkt 2 einfügen und Punkt 3 umbenennen. Auf die Abfrage warten.
4. Prüfen:
   - Das `timer goto` geht mit der **neuen** Nummer raus, und der Timer steht auf Punkt 2.
   - Der Rundown steht in iveo-Reihenfolge, die Aktionen an Punkt 2, die eigene Zeile hinter Punkt 1, die scharfe Zeile über die Kennung.
5. Einen Punkt mit Aktionen im Server löschen → er ist markiert, die Navigation überspringt ihn.
6. Side Event wechseln und zurück → alles wieder da.
7. Neustart:
   - **7a:** Rundown beenden und **ohne Deep-Link** starten (wie die Kachel). Stand und scharfe Zeile sind da, ein folgendes RELOAD gleicht ohne Warnung ab, der Timer-Countdown bleibt unverändert.
   - **7b:** Rundown beenden und per Show-Deep-Link starten. Stand und scharfe Zeile sind da.
8. Eine Bestands-Show ohne Kennungen öffnen, Aktionen anlegen, dann Kennungen in die Datei schreiben lassen (eine Abfrage mit Änderung) → keine Zeile entfällt (R0).
9. Titler-Messung aus 6.4.

---

## 10 · Abnahme (durch den Owner, ein Rechner, echtes iveo-Event auf Prod)

`apps/rundown/ABNAHME-2a.md`, je Schritt mit Ergebnisspalte.

**Voraussetzungen:**
- Ein eigenes, **unveröffentlichtes Test-Side-Event** im Prod-Event mit mindestens drei Agenda-Punkten. Die Schritte 4, 5 und 7 ändern dessen Agenda. Am Ende wird der Ausgangszustand wiederhergestellt.
- Das echte iveo-Token wird **nie** in iveo widerrufen. Es gilt org-weit, ein Widerruf legt alle Events und Rechner der Org lahm.

| # | Schritt | Erwartung |
| --- | --- | --- |
| 1 | Launcher 0.13.0, Timer 0.13.0 und Rundown 0.6.0 installieren | Versionen im Launcher sichtbar |
| 2 | Bestands-Show (von vor dem Update, mit Aktionen im Rundown) öffnen und die erste Abfrage abwarten | alle Aktionen da, kein Hinweis „entfallen“ (Übergang 0.6/0.7) |
| 3 | Show an das Test-Side-Event binden und öffnen | Rundown zeigt die Punkte, gesperrte Felder mit „kommt aus iveo“ |
| 4 | An Punkt 2 eine Bauchbinde und „Timer springe zu Punkt 2“ anlegen; eine eigene Zeile hinter Punkt 1; eine Zeile duplizieren | gespeichert; die Kopie ist frei bearbeitbar |
| 5 | In iveo vor Punkt 2 einen Punkt einfügen und Punkt 3 umbenennen; bis zu 45 s warten | Hinweis „iveo: 1 geändert · 1 neu …“; Aktionen weiter an „Punkt 2“; eigene Zeile und Kopie an ihrem Platz; scharfe Zeile unverändert |
| 6 | Timer auf Punkt 2 laufen lassen, Schritt 5 sinngemäß wiederholen (noch ein Punkt davor) | Timer bleibt auf demselben Punkt, Countdown läuft weiter |
| 7 | GO mit der Sprung-Aktion | Timer springt auf den richtigen Punkt, nicht auf die alte Nummer; Chip zeigt die neue Nummer |
| 8 | In iveo den Punkt mit Aktionen löschen | Zeile „in iveo entfallen“, Weiterschalten überspringt sie |
| 9 | Aus dem Rundown per GO auf ein anderes Side Event umschalten, dann zurück; im Panel die Tagesübersicht eines anderen Tages wählen und zurück | neue Agenda ohne Aktionen; nach dem Zurückschalten alle Aktionen wieder da; kein „entfallen“ durch den Tageswechsel |
| 10a | Rundown schließen und **über die Launcher-Kachel** neu starten | Stand und scharfe Zeile wie vorher; die nächste iveo-Änderung kommt an; Timer-Countdown unverändert |
| 10b | Rundown schließen und über „Show öffnen“ neu starten | Stand und scharfe Zeile wie vorher. Hinweis: Der Timer wird dabei wie heute zurückgesetzt. |
| 11 | Show im Show-Editor öffnen und ohne Änderung speichern | Timer-Liste, Einstellungen, Dauern sekundengenau und Kennungen unverändert (Datei vorher/nachher vergleichen); die Tools bekommen RELOAD, nichts springt |
| 12 | Launcher beenden und mit `JMPS_IVEO_TOKEN=ungueltig` starten, Show öffnen, eine Abfrage abwarten; danach ohne die Variable neu starten | Zeile „iveo-Abgleich gestört: Token ungültig oder widerrufen“, Rundown behält seinen Stand; nach dem Neustart verschwindet die Zeile mit der ersten Abfrage |
| 13 | Agenda des Test-Side-Events auf den Ausgangszustand zurücksetzen | – |

---

## 11 · Release

- Launcher **0.13.0**, Timer **0.13.0**, Rundown **0.6.0**.
- Changelog-Einträge in `packages/suite-manifest/changelog.json` unter `launcher`, `timer` und `rundown`, ohne ASCII-Anführungszeichen in Texten. Vor dem Commit prüfen: `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8'))"`.
- In die Release-Notes kommen:
  - Rundown 0.6.0 bringt zum ersten Mal den Master-Link-Client aus Teil 1 mit (`packages/app-runtime`). Er wird erst aktiv, wenn der Rechner gekoppelt ist.
  - Der alte Autosave wird beim ersten Öffnen einer passenden Show übernommen und vorher als `rundown.autosave.v1.jmrundown` gesichert.
- Tags einzeln pushen, denn mehr als drei Tags in einem Push lösen keine Workflows aus.
- Push, PR, Merge, Tags und Release erst nach Freigabe durch den Owner.

---

## 12 · Grenzen von 2a (bewusst)

- **Andere Rechner:** Ein Rundown, Timer oder Titler auf einem anderen Rechner liest weiter seine eigene Datei. Im open-Modus erreicht ihn das RELOAD, er gleicht dann mit seinem eigenen Stand ab. → 2b
- **Zwei Launcher im Netz:** Der Rundown nimmt den zuletzt gefundenen (`apps/rundown/src/main/conductor.ts:84-88`). → 2b
- **Side-Event-Liste:** Die Liste in der Show wird von Abfragen nicht aufgefrischt (`iveo-sync.ts:672`). → 2b
- **Nummernbasiert:** Sprünge aus Companion und `TITLER RECALL <nr>` bleiben nummernbasiert.
- **Handänderungen im Timer** gehen beim RELOAD weiter verloren, wie heute (`timer-state.ts:275`).
- **Eigene Timer-Liste:** Eine eigene Timer-Liste in den Show-Einstellungen hat keine Kennungen und hält über die Nummer.
- **Show öffnen mit laufenden Tools** setzt den Timer per `tt:setAll` zurück, wie heute (`apps/timer/src/main/index.ts:353`, `timer-state.ts:259-268`). Als Neustart-Weg für den Rundown dient deshalb die Kachel (5.2).
- **Verschobene Show-Datei:** Wird eine Show-Datei umbenannt oder verschoben, beginnt ein neues Gedächtnis. Das alte bleibt auf der Platte liegen.
- **Titler:** Er wird nur nachgemessen (6.4).
- **Alter Rundown:** Ein alter Rundown, der eine neue `.jmrundown` speichert, verliert Archiv und Markierungen (Ergänzung 0.11).

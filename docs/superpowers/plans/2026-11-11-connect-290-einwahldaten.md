# Connect 0.4.2 — Zoom-Einwahldaten merken (#290) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Meeting-Nummer und Kenncode des letzten Beitritts bleiben über „Schließen“ und Neustart erhalten, bis neue eingetragen werden — der Kenncode verschlüsselt und nie im Fenster.

**Architecture:** Der Arbeitsspeicher des Zoom-Kerns (`nummer`/`kenncode` in `apps/connect/src/main/zoom/kern.ts`, Grundlage für „Erneut beitreten“ und den automatischen Wiederbeitritt) bleibt **unverändert**. Daneben kommt ein **gemerktes letztes Meeting** in `connect-settings.json` (Nummer im Klartext, Kenncode mit `safeStorage` wie `zoomZugangEnc`). Der Renderer bekommt es über einen **eigenen** Kanal (nicht über das `ZoomAbbild`, das in STATE/Log/kurz landet) — und zwar nur die Nummer und ob ein Kenncode gespeichert ist.

**Tech Stack:** Electron 33, React 18, TypeScript; Selbsttests mit `tsx` im `ck()`-Muster (`apps/connect/test/*.test.ts`), Kern-Test gegen `packages/zoom-bridge/test/fake-bridge.mjs`.

**Spec:** Owner-Freigabe im Chat 11.11.2026 21:52/21:53 (Issue #290), hebt Connect-Spec `docs/superpowers/specs/2026-10-02-zoom-stage4-connect-design.md` F1 („nie speichern“) für Nummer und Kenncode bewusst auf:
- Nur das LETZTE Meeting; gespeichert beim Klick auf „Beitreten“ (gültige Eingaben), nicht beim Tippen.
- Nach „Schließen“ am Meeting-Ende und nach Neustart wieder eingetragen.
- Nummer sichtbar; Kenncode bleibt im Main — Feld zeigt „Kenncode gespeichert“; „Beitreten“ nutzt ihn, solange kein neuer getippt ist.
- Kenncode verschlüsselt (Windows-Verschlüsselung), nie in `.jmshow`, Log, Companion-STATE. Ohne Verschlüsselung nur die Nummer + Hinweis.
- Knopf „Vergessen“.
- Release Connect 0.4.2 im COP-Fenster 18:00–06:00 Berlin.

## Global Constraints

- Version `0.4.2` in `apps/connect/package.json` + `package-lock.json`.
- Texte Deutsch mit „…“; `\uXXXX` nie über Edit/Write (wird dekodiert).
- Bestehende Connect-Selbsttests bleiben grün — insbesondere `test/zoom-kern.test.ts` Fall 3 (keine Nummer/kein Kenncode in Abbild, STATE, kurz, Log) und die `erneutMoeglich`-Prüfungen (Arbeitsspeicher-Semantik unverändert).
- Der Kenncode verlässt den Main nie Richtung Renderer; Klartext-Kenncode nie auf der Platte.

## Review Focus

1. Beitreten mit leerem Kenncode und **derselben** Nummer → gespeicherter Kenncode geht in den `join`-Befehl; mit **anderer** Nummer → leerer Kenncode, das Gemerkte wird durch (neue Nummer, kein Kenncode) ersetzt.
2. Keine Windows-Verschlüsselung → kein Kenncode auf der Platte, Nummer schon, Hinweis.
3. Bridge-stderr mit dem gemerkten Kenncode wird maskiert (auch wenn der Arbeitsspeicher leer ist).
4. Unlesbare `connect-settings.json` → Gemerktes gilt als leer, Sicherungskopie-Verhalten (T90) unverändert.
5. „Vergessen“ während eines laufenden Meetings → nur das Gemerkte weg, Meeting läuft weiter.

---

### Task 1: Ablage (settings.ts) + reine Regeln

**Files:** `apps/connect/src/main/settings.ts`, `apps/connect/src/main/zoom/einstellungen.ts`; Test `apps/connect/test/zoom-settings.test.ts`

- `Stored` bekommt `zoomLetzteNummer?: string` und `zoomLetzterKenncodeEnc?: string`.
- Rein (einstellungen.ts): `gueltigeLetzteNummer(v: unknown): string | null` (String, getrimmt 1–64 Zeichen).
- settings.ts (Muster `zoomZugangSpeichern`/`zoomZugangLoeschen`):
  - `zoomLetztesMeeting(): { nummer: string; kenncode: string | null } | null` — Nummer aus der Datei (null, wenn keine); Kenncode entschlüsselt (`decryptKey`), sonst `null`.
  - `zoomMeetingMerken(nummer: string, kenncode: string): { kenncodeGespeichert: boolean }` — schreibt Nummer; Kenncode nur, wenn nicht leer UND `safeStorage.isEncryptionAvailable()` → `zoomLetzterKenncodeEnc`; sonst Feld löschen. `kenncodeGespeichert` = verschlüsselt geschrieben.
  - `zoomMeetingVergessen(): void` — beide Felder löschen.
  - Schreibfehler: still (`getLog().warn`), nie werfen.
- Tests (Muster: `registerHooks`-Attrappe für `electron.safeStorage`, temp `userData`): merken+lesen; Datei enthält KEINEN Klartext-Kenncode; ohne Verschlüsselung → kein `zoomLetzterKenncodeEnc`, Nummer da, `kenncodeGespeichert:false`; leerer Kenncode → Feld gelöscht; vergessen → beide weg; unlesbare Datei → `null`.
- Commit `feat(connect): letztes Zoom-Meeting merken – Ablage (#290)`

### Task 2: Kern — merken, gemerkten Kenncode nutzen, maskieren, Vergessen

**Files:** `apps/connect/src/main/zoom/kern.ts`, `apps/connect/src/main/zoom.ts`, `apps/connect/src/shared/types.ts`, `apps/connect/src/shared/ipc.ts`, `apps/connect/src/preload/index.ts`; Test `apps/connect/test/zoom-kern.test.ts`

- `ZoomKernAbhaengigkeiten.einstellungen` += `letztesMeeting(): { nummer: string; kenncode: string | null } | null; meetingMerken(nummer: string, kenncode: string): { kenncodeGespeichert: boolean }; meetingVergessen(): void;` (in `zoom.ts` an die Task-1-Funktionen verdrahten).
- `beitreten(e)`: nach erfolgreicher Prüfung (Nummer normiert, Name gültig): wirksamer Kenncode = `e.kenncode` wenn nicht leer; sonst, wenn ein gemerktes Meeting existiert und `normalizeMeetingId(gemerkt.nummer) === normiert`, dessen Kenncode (`?? ''`); sonst `''`. Dann `meetingMerken(e.nummer, wirksamerKenncode)` und weiter wie bisher mit `kenncode = wirksamerKenncode`.
- Neu `letztesMeeting(): { nummer: string | null; kenncodeGespeichert: boolean; kenncodeNichtGespeichert: boolean }` am Kern — `kenncodeNichtGespeichert` = der letzte `meetingMerken`-Aufruf (dieser Sitzung) mit nicht leerem Kenncode lieferte `kenncodeGespeichert:false`.
- Neu `vergessen(): void` → `meetingVergessen()`; Arbeitsspeicher (`nummer`/`kenncode`) unberührt.
- `geheimnisse()` nimmt zusätzlich Nummer und Kenncode des gemerkten Meetings auf.
- IPC: `zoomLetztesMeeting: 'jmc:zoom-letztes-meeting'` (invoke → obiges Objekt), `zoomVergessen: 'jmc:zoom-vergessen'` (invoke → void); Preload + `JmConnectApi` entsprechend. Das `ZoomAbbild` bekommt KEIN neues Feld.
- Tests (Fake-`einstellungen` um die drei Funktionen erweitern, Ablage im Objekt): Beitreten merkt (Nummer, Kenncode); nach `schliessen()` ist `letztesMeeting().nummer` gesetzt, `kenncodeGespeichert` true, `erneutMoeglich` wie bisher false; Beitreten mit leerem Kenncode + gleicher Nummer (andere Schreibweise, z. B. mit Leerzeichen) → `join.passcode` = gemerkter Kenncode (Review Focus 1); andere Nummer + leer → `passcode ''` und Gemerktes ersetzt; ungültige Nummer → nichts gemerkt; `vergessen()` im Meeting → Meeting läuft, Gemerktes leer (Review Focus 5); Fake-Bridge schreibt den gemerkten Kenncode auf stderr → im Log maskiert (Review Focus 3); Fall 3 erweitert: gemerkte Nummer/Kenncode nicht in Abbild/STATE/kurz.
- Commit `feat(connect): Kern nutzt das gemerkte Meeting, Vergessen (#290)`

### Task 3: Zoom-Karte

**Files:** `apps/connect/src/renderer/src/zoom/ZoomCard.tsx`, `apps/connect/src/shared/zoom-text.ts` (nur neue Texte); Test `apps/connect/test/zoom-text.test.ts` (Texte)

- Beim Laden der Karte und nach jedem Wechsel nach `bereit`/`fehler` (z. B. nach „Schließen“): `zoomLetztesMeeting()` holen; ist das Nummernfeld leer, mit der gemerkten Nummer füllen.
- Kenncode-Feld: leer und `kenncodeGespeichert` und Nummernfeld = gemerkte Nummer (nach Entfernen von Leerzeichen) → `placeholder` „Kenncode gespeichert“.
- „Schließen“ leert das Nummernfeld nicht mehr bedingungslos, sondern setzt es auf die gemerkte Nummer (N4b.3 Nr. 5 wird damit abgelöst).
- Knopf „Vergessen“ (klein, neben den Feldern, nur sichtbar, wenn etwas gemerkt ist) → `zoomVergessen()`, dann Nummernfeld leeren und neu holen.
- `kenncodeNichtGespeichert` → kleine Zeile unter dem Feld: „Kenncode wird auf diesem PC nicht gespeichert (keine Windows-Verschlüsselung).“
- Texte als Konstanten in `zoom-text.ts`, je eine Prüfung in `zoom-text.test.ts`.
- Commit `feat(connect): Zoom-Karte füllt das letzte Meeting vor, Vergessen (#290)`

### Task 4: Version, Prüfung, Release (Controller)

- [ ] Version 0.4.2; Connect-Selbsttest Node 22 + 24, typecheck; Abschluss-Review
- [ ] Windows-Paket lokal bauen (mit zoom-bridge + NDI, Ablauf wie 0.4.1); Rauchtest der Karte (Vorbelegung nach Neustart, „Vergessen“), soweit ohne echtes Meeting möglich
- [ ] Notes zur Owner-Freigabe; Release im Fenster 18:00–06:00 (Mac baut CI per Tag, sobald GitHub Actions wieder läuft)

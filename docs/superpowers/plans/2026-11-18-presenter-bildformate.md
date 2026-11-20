# Presenter Bildformate AVIF + SVG (#313) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** JM Presenter 0.13.2 öffnet und zeigt AVIF und SVG auf allen Wegen; eine einzige Endungsliste; WebP in der echten App nachgewiesen.

**Architecture:** Eine Endungsliste in `src/shared/dateien.ts`, aus der Haupt-Prozess und Dialogfilter lesen. Reine SVG-Hilfen (Erkennung, Seitenverhältnis, Rastergröße) in `src/shared/bildformat.ts`, unter Node testbar. Ein Dekodier-Helfer im Renderer (`lib/bild-dekodieren.ts`) für Folien (`pdf.ts`) und Overlays (`paint.ts`): SVG über `<img>` + `createImageBitmap(img, { resizeWidth, resizeHeight })`, alles andere wie bisher.

**Tech Stack:** Electron 33 / Chromium, TypeScript, tsx-Selbsttests, Prüfstand per CDP (`test/pruefstand.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-18-presenter-bildformate-design.md`

## Global Constraints

- Rastergröße SVG: in **3840×2160** eingepasst, Seitenverhältnis bleibt; Seitenverhältnis aus `width`/`height` (Zahl oder `px`) des Wurzelelements, sonst `viewBox`, sonst 16:9.
- SVG-Erkennung am Inhalt (erste 4 KiB): nach BOM/Leerraum, `<?xml …?>`, Kommentaren und `<!DOCTYPE …>` muss `<svg` stehen. Keine `.svgz`.
- Endungen danach genau: `.png .jpg .jpeg .webp .gif .bmp .avif .svg`.
- Kein neues npm-Paket. Shared-Code ohne Node-/Electron-Importe (wird im Renderer gebündelt).
- Selbsttests auch unter Node 22 grün (`tsx`-Dateien wie die bestehenden).
- Version 0.13.2; Changelog-Text erst nach Owner-Freigabe in `packages/suite-manifest/changelog.json`.
- Kein Kundenmaterial ins Repo (die echte WebP-Datei nur lokal per Umgebungsvariable im Prüfstand).

## Review Focus

- SVG mit `width="100%"`/`em`/ohne Einheit + `viewBox` → Seitenverhältnis aus `viewBox`, nicht 100:… (Test in Task 2).
- SVG mit UTF-8-BOM, XML-Kopf und Kommentar vor `<svg` → wird erkannt; HTML-Datei mit `<svg` im Body → wird NICHT als SVG erkannt (Task 2).
- Sehr schmale/hohe SVG (z. B. 1×1000) → Rastergröße ≥ 1 px je Seite, höchstens 2160 hoch (Task 2).
- `.jmpres` mit SVG-Quelle (nur Bytes, kein Name nötig) → wird über die Inhaltserkennung gezeigt (Task 4, Projektfall).
- SVG mit externem Bild/Script → zeigt den Rest, lädt nichts nach, kein Absturz (Task 4, Fall „extern“).

---

### Task 1: Eine Endungsliste mit AVIF und SVG

**Files:**
- Modify: `apps/presenter/src/shared/dateien.ts:14` (IMAGE_EXT), neue Funktion daneben
- Modify: `apps/presenter/src/main/ipc.ts:50,72,88` (eigene Liste weg, Filter aus der gemeinsamen)
- Modify: `apps/presenter/src/main/control-open.ts:21` (eigene Liste weg)
- Test: `apps/presenter/test/dateien.test.ts`

**Interfaces:**
- Produces: `IMAGE_EXT` (Set mit den 8 Endungen), `bildFilterEndungen(): string[]` (ohne Punkt, Reihenfolge wie IMAGE_EXT).

- [ ] **Step 1: Failing test** – in `dateien.test.ts`:
```ts
ck('avif + svg sind Bilder', d.dateiArt('C:\\x\\Foto.AVIF') === 'image' && d.dateiArt('/x/Logo.svg') === 'image');
ck('endungsliste genau', [...d.IMAGE_EXT].join(' ') === '.png .jpg .jpeg .webp .gif .bmp .avif .svg');
ck('filterendungen ohne punkt', d.bildFilterEndungen().join(',') === 'png,jpg,jpeg,webp,gif,bmp,avif,svg');
ck('svgz bleibt fremd', d.dateiArt('a.svgz') === null);
```
- [ ] **Step 2:** `npx tsx test/dateien.test.ts` → FAIL (avif/svg, bildFilterEndungen fehlt).
- [ ] **Step 3:** Liste erweitern, `bildFilterEndungen` exportieren; `ipc.ts` und `control-open.ts` importieren `IMAGE_EXT` aus `../shared/dateien`; Dialogfilter `['pdf', ...bildFilterEndungen()]` bzw. `bildFilterEndungen()`.
- [ ] **Step 4:** `npx tsx test/dateien.test.ts` → alles ok; `npm run typecheck -w @jm/presenter` grün.
- [ ] **Step 5: Commit** `feat(presenter): eine Endungsliste für Bilder, dazu AVIF und SVG (#313)`.

### Task 2: Reine SVG-Hilfen

**Files:**
- Create: `apps/presenter/src/shared/bildformat.ts`
- Create: `apps/presenter/test/bildformat.test.ts`; Modify: `apps/presenter/package.json` (selftest-Kette um `tsx test/bildformat.test.ts`)

**Interfaces:**
- Produces: `istSvg(bytes: Uint8Array): boolean`, `svgSeitenverhaeltnis(text: string): number | null` (Breite/Höhe), `svgRasterGroesse(bytes: Uint8Array): { breite: number; hoehe: number }`, Konstanten `SVG_RASTER_MAX_BREITE = 3840`, `SVG_RASTER_MAX_HOEHE = 2160`.

- [ ] **Step 1: Failing tests** – Fälle (Bytes per `new TextEncoder().encode(...)`):
  - `istSvg`: `<svg …>` → true; `\uFEFF  <?xml version="1.0"?>\n<!-- x --><!DOCTYPE svg PUBLIC "…" "…">\n<svg …>` → true; PNG-Magic → false; `<html><body><svg/></body></html>` → false; leer → false.
  - `svgSeitenverhaeltnis`: `width="200" height="100"` → 2; `width="200px" height="50px"` → 4; `width="100%" height="100%" viewBox="0 0 300 600"` → 0.5; nur `viewBox="0,0,1920,1080"` → 16/9; nichts → null; `width="0"` + keine viewBox → null.
  - `svgRasterGroesse`: 2:1 → `{3840,1920}`; 0.5 → `{1080,2160}`; ohne Angabe → `{3840,2160}`; `width="1" height="1000"` → hoehe 2160, breite ≥ 1.
- [ ] **Step 2:** `npx tsx test/bildformat.test.ts` → FAIL (Modul fehlt).
- [ ] **Step 3:** Implementieren. Wurzelelement: erstes `<svg` nach dem Vorspann; Attribute per Regex aus dem öffnenden Tag; Längen nur als reine Zahl oder `px` gültig (> 0); `viewBox` mit Leer- oder Kommatrennung, Breite/Höhe > 0. Rastergröße = Einpassen, `Math.max(1, Math.round(...))`.
- [ ] **Step 4:** Test grün; `npm run selftest -w @jm/presenter` grün.
- [ ] **Step 5: Commit** `feat(presenter): SVG am Inhalt erkennen und Rastergröße bestimmen (#313)`.

### Task 3: Dekodier-Helfer im Renderer

**Files:**
- Create: `apps/presenter/src/renderer/src/lib/bild-dekodieren.ts`
- Modify: `apps/presenter/src/renderer/src/lib/pdf.ts:38-46` (loadImage), `apps/presenter/src/renderer/src/lib/paint.ts:23`

**Interfaces:**
- Consumes: `istSvg`, `svgRasterGroesse` (Task 2), `bytesToBlob(bytes, type?)`.
- Produces: `bildDekodieren(bytes: Uint8Array): Promise<ImageBitmap>`.

- [ ] **Step 1:** Implementieren: Nicht-SVG → `createImageBitmap(bytesToBlob(bytes))`. SVG → `URL.createObjectURL(bytesToBlob(bytes, 'image/svg+xml'))`, `img.decode()`, `createImageBitmap(img, { resizeWidth, resizeHeight, resizeQuality: 'high' })`, Objekt-URL im `finally` freigeben; Dekodierfehler als `Error('SVG konnte nicht gelesen werden.')`.
- [ ] **Step 2:** `loadImage` und `ensureOverlayBitmaps` rufen `bildDekodieren`.
- [ ] **Step 3:** `npm run typecheck -w @jm/presenter` grün, Selbsttest grün (Verhalten im Browser prüft Task 4).
- [ ] **Step 4: Commit** `feat(presenter): SVG-Folien und -Overlays über das Bild-Element rastern (#313)`.

### Task 4: Prüfstand-Gruppe `bildformate` (echte App)

**Files:**
- Modify: `apps/presenter/test/pruefstand.mjs` (Testdateien + `gruppeBildformate` + Eintrag in `GRUPPEN`)

**Interfaces:**
- Consumes: gebaute App (`npm run dist:dir -w @jm/presenter`), vorhandene Helfer `mitApp`, `ablegen`, `folienZahl`, `fehlerZeile`, `bisWert`.

- [ ] **Step 1:** Testdateien in `baueTestdateien`: `zwei-zu-eins.svg` (width 200/height 100, links rot, rechts blau), `hoch.svg` (nur `viewBox="0 0 100 200"`, grün), `extern.svg` (blaues Rechteck + `<image href="https://example.invalid/x.png">` + `<script>`), `gruen.avif` und `gruen.webp` (64×32 grün, als Base64-Konstanten, einmalig mit ffmpeg erzeugt, Erzeugungsbefehl im Kommentar), `svg.jmpres` (Projekt mit SVG-Quelle `kind: 'image'`, Name `quelle.bin`).
- [ ] **Step 2:** `gruppeBildformate`: je Datei ablegen → Folienzahl +1, Fehlerzeile leer; dann die Folie auswählen und im Bühnen-Canvas (`EditorStage`, `canvas` mit `bg-white`) prüfen: Seitenverhältnis des gezeichneten Bildes ±3 % zum Soll, Mittelfarbe der linken/rechten Hälfte (rot/blau bzw. grün). `extern.svg`: Folie da, blau, kein Absturz. `svg.jmpres` öffnen: Folie zeigt rot/blau. Optional `JMPR_ECHTE_BILDER` (Pfade, `;`-getrennt): je Datei ablegen, Folie nicht leer, sonst `skip`.
- [ ] **Step 3:** Vor Task 1–3 (Stand origin/main gebaut) zeigt `--nur bildformate` FAIL für AVIF/SVG und ok für WebP; nach Task 1–3 alles ok.
- [ ] **Step 4: Commit** `test(presenter): Prüfstand-Gruppe bildformate (#313)`.

### Task 5: Handbuch, Version, Changelog-Entwurf

**Files:**
- Modify: `packages/cookbook/content/tool-manuals/tool-jm-presenter.md:28` (Formate nennen), `packages/cookbook/cookbook.json` (gebaut, CRLF-Falle: aus LF bauen), `apps/presenter/package.json` + `package-lock.json` (`npm version 0.13.2 -w @jm/presenter --no-git-tag-version`)

- [ ] **Step 1:** Handbuchzeile: „**Bilder** (PNG, JPEG, WebP, GIF, BMP, AVIF, SVG)“; `npm run cookbook:build` aus LF, `npm run cookbook:check` grün. Commit `docs(presenter): Handbuch nennt die Bildformate (#313)`.
- [ ] **Step 2:** Version 0.13.2; Commit `chore(presenter): Version 0.13.2`.
- [ ] **Step 3:** Schlusslauf: `npm run selftest -w @jm/presenter`, `npm run typecheck -w @jm/presenter`, beide Selbsttests auch mit Node 22; Prüfstand komplett gegen `dist:dir`.
- [ ] **Step 4:** Changelog-Entwurf dem Owner vorlegen (keine ASCII-Anführungszeichen).

# JM Switcher — Streaming sagt die Wahrheit (Lane D1) — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Switcher-Einstellungen zeigen die tatsächlichen Ausgabewerte, und die Bildratenwahl wirkt bis in Stream und Aufnahme.

**Architecture:** Die Qualitätswerte (Auflösung + empfohlene Bitraten) wandern in ein reines, testbares Modul unter `src/shared/`; der Einstellungs-Store re-exportiert sie, damit bestehende Importe unverändert bleiben. Der `OutputController` bekommt eine Bildrate wie sie NDI-Ausgabe und Zweitbildschirm schon führen. Die Oberfläche liest die Werte statt sie zu behaupten.

**Tech Stack:** TypeScript, Electron 33, React, zustand, `node --experimental-strip-types` für Selbsttests.

**Spec:** `docs/superpowers/specs/2026-08-07-switcher-stream-truth-design.md`

## Global Constraints

- **Keine Skalierung in ffmpeg.** Die Auflösung kommt aus dem Canvas — niemals hochskalieren.
- **Eine laufende Aufnahme oder Sendung wird nie neu gestartet**, um eine Einstellung anzuwenden. MediaRecorder-Spuren sind nach dem Start unveränderlich; die neue Bildrate greift beim nächsten Start.
- **Die Bitrate wird beim Auflösungswechsel NICHT automatisch geändert** — das überschriebe einen vom Operator gesetzten Wert. Nur der Hinweistext folgt der Auflösung.
- Keine Änderung an NDI-Ausgabe, Zweitbildschirm, Multiview (bleibt bewusst 720p), Audio-Mix oder Codec.
- Ungültige Bildrate fällt auf den bisherigen Wert zurück (`fps > 0 ? fps : DEFAULT`), wie `NdiOutputController` es handhabt.
- Umlaute in Commit-Botschaften vermeiden (ue/oe/ae).
- Beim Stagen ausschließlich eigene Pfade nennen; im Arbeitsverzeichnis liegt eine fremde Änderung an `apps/ndi-screen-capture/resources/bin/win/jm_ndi.node`, die nicht angefasst wird.

## Dateien

| Datei | Verantwortung |
|---|---|
| `apps/switcher/src/shared/output-quality.ts` (neu) | `ProgramResolution`, `RESOLUTIONS`, `recommendedBitrate` — rein, ohne zustand und ohne Workspace-Pakete. |
| `apps/switcher/test/selftest.ts` (neu) | Selbsttest für `recommendedBitrate`. |
| `apps/switcher/package.json` | `selftest`-Skript; später Version 0.10.0. |
| `apps/switcher/tsconfig.node.json` | `test/**/*.ts` in `include`, damit der Selbsttest typgeprüft wird. |
| `apps/switcher/src/renderer/src/store/settings.ts` | Re-Export der Qualitätswerte statt eigener Definition. |
| `apps/switcher/src/renderer/src/core/output.ts` | `setFps` + Bildrate im Canvas-Abgriff. |
| `apps/switcher/src/renderer/src/views/SwitcherView.tsx` | `outputFps` auch an `output` reichen. |
| `apps/switcher/src/renderer/src/views/SettingsView.tsx` | Ehrliche Anzeige statt fester Texte. |
| `packages/suite-manifest/changelog.json` | Katalogeintrag 0.10.0. |

---

### Task 1: Qualitätswerte als reines Modul + Selbsttest

**Files:**
- Create: `apps/switcher/src/shared/output-quality.ts`
- Create: `apps/switcher/test/selftest.ts`
- Modify: `apps/switcher/package.json` (Skript `selftest`)
- Modify: `apps/switcher/tsconfig.node.json` (`include`)
- Modify: `apps/switcher/src/renderer/src/store/settings.ts`

**Interfaces:**
- Consumes: nichts.
- Produces: `type ProgramResolution = '720p' | '1080p'`, `const RESOLUTIONS: Record<ProgramResolution, { w: number; h: number }>`, `function recommendedBitrate(resolution: ProgramResolution, kind: 'stream' | 'record'): { min: number; max: number }` — alle aus `@shared/output-quality`, zusätzlich re-exportiert aus `@/store/settings`.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`apps/switcher/test/selftest.ts` neu anlegen:

```ts
// Selbsttest der reinen Ausgabe-Qualitaetswerte (Lane D1).
//   npm run selftest -w @jm/switcher
import { RESOLUTIONS, recommendedBitrate } from '../src/shared/output-quality.ts';

let failures = 0;
function assert(cond: boolean, name: string): void {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`);
  }
}

console.log('output-quality — Aufloesungen:');
assert(RESOLUTIONS['720p'].w === 1280 && RESOLUTIONS['720p'].h === 720, '720p ist 1280x720');
assert(RESOLUTIONS['1080p'].w === 1920 && RESOLUTIONS['1080p'].h === 1080, '1080p ist 1920x1080');

console.log('output-quality — empfohlene Bitraten:');
for (const kind of ['stream', 'record'] as const) {
  for (const res of ['720p', '1080p'] as const) {
    const r = recommendedBitrate(res, kind);
    assert(r.min > 0 && r.min < r.max, `${kind}/${res}: min > 0 und min < max`);
  }
}

// Full-HD hat rund die 2,25-fache Pixelzahl — die Empfehlung MUSS darueber liegen,
// sonst sieht 1080p bei unveraenderter Bitrate schlechter aus als 720p. Genau das
// war der Ausgangspunkt von Lane D1.
for (const kind of ['stream', 'record'] as const) {
  const hd = recommendedBitrate('720p', kind);
  const fhd = recommendedBitrate('1080p', kind);
  assert(fhd.min > hd.min, `${kind}: 1080p-Untergrenze liegt ueber 720p`);
  assert(fhd.max > hd.max, `${kind}: 1080p-Obergrenze liegt ueber 720p`);
}

// Aufnahme ist unkomprimierter gedacht als der Stream und liegt darum hoeher.
for (const res of ['720p', '1080p'] as const) {
  assert(
    recommendedBitrate(res, 'record').min > recommendedBitrate(res, 'stream').min,
    `${res}: Aufnahme empfiehlt mehr als der Stream`,
  );
}

if (failures) {
  console.error(`\n${failures} Selbsttest(s) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle @jm/switcher-Selbsttests gruen.');
```

- [ ] **Step 2: Das Skript eintragen**

In `apps/switcher/package.json` im `scripts`-Block ergänzen (neben `build` und `typecheck`):

```json
    "selftest": "node --experimental-strip-types test/selftest.ts",
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm run selftest -w @jm/switcher`
Expected: FAIL mit `ERR_MODULE_NOT_FOUND` für `src/shared/output-quality.ts`.

- [ ] **Step 4: Das reine Modul schreiben**

`apps/switcher/src/shared/output-quality.ts` neu anlegen:

```ts
// Ausgabe-Qualitaet: Aufloesung und empfohlene Bitraten. Bewusst OHNE zustand und ohne
// Workspace-Pakete, damit der Selbsttest das Modul ohne Browser und ohne Bundler laden kann.
// `store/settings.ts` re-exportiert von hier, damit bestehende Importe unveraendert bleiben.

/** Programm-Ausgabeaufloesung. Bestimmt die Groesse, in der das Programm KOMPONIERT wird
 *  (engine-Canvas) — NDI, Aufnahme und RTMP folgen daraus. 720p kostet ~2,25x weniger
 *  Rechenlast pro Frame; 1080p ist echtes Full-HD (kein Hochskalieren). */
export type ProgramResolution = '720p' | '1080p';

export const RESOLUTIONS: Record<ProgramResolution, { w: number; h: number }> = {
  '720p': { w: 1280, h: 720 },
  '1080p': { w: 1920, h: 1080 },
};

/**
 * Empfohlene Videobitrate in kbit/s. Reine Zahlenlieferung — sie schreibt NICHTS in die
 * Einstellungen: die Bitrate ist ein vom Operator gesetzter Wert und wird beim Wechsel der
 * Aufloesung nicht ueberschrieben. Full-HD hat rund die 2,25-fache Pixelzahl, deshalb liegen
 * die 1080p-Werte deutlich hoeher; wer sie stehen laesst, bekommt Full-HD, das schlechter
 * aussieht als 720p.
 */
export function recommendedBitrate(
  resolution: ProgramResolution,
  kind: 'stream' | 'record',
): { min: number; max: number } {
  if (kind === 'record') {
    return resolution === '1080p' ? { min: 16000, max: 32000 } : { min: 8000, max: 16000 };
  }
  return resolution === '1080p' ? { min: 6000, max: 12000 } : { min: 3000, max: 6000 };
}
```

- [ ] **Step 5: Den Store auf das Modul umstellen**

In `apps/switcher/src/renderer/src/store/settings.ts` den bisherigen Block

```ts
/** Programm-Ausgabeauflösung. Bestimmt die Größe, in der das Programm KOMPONIERT wird
 *  (engine-Canvas) — NDI, Aufnahme und RTMP folgen daraus. 720p kostet ~2,25× weniger
 *  Rechenlast pro Frame; 1080p ist echtes Full-HD (kein Hochskalieren). */
export type ProgramResolution = '720p' | '1080p';
export const RESOLUTIONS: Record<ProgramResolution, { w: number; h: number }> = {
  '720p': { w: 1280, h: 720 },
  '1080p': { w: 1920, h: 1080 },
};
```

ersetzen durch:

```ts
// Aufloesung und Bitraten-Empfehlungen leben als reines Modul in @shared/output-quality
// (ohne zustand, damit der Selbsttest sie laden kann) und werden hier nur weitergereicht.
export { RESOLUTIONS, recommendedBitrate, type ProgramResolution } from '@shared/output-quality';
import type { ProgramResolution } from '@shared/output-quality';
```

Der bestehende `OUTPUT_FPS_OPTIONS`-Export und alles Übrige bleiben unverändert. Der zusätzliche
`import type` ist nötig, weil `SettingsState` den Typ weiter im selben Modul verwendet.

- [ ] **Step 6: Den Selbsttest typprüfen lassen**

In `apps/switcher/tsconfig.node.json` das `include`-Array um den Testordner ergänzen:

```json
  "include": [
    "electron.vite.config.ts",
    "src/main/**/*.ts",
    "src/preload/**/*.ts",
    "src/utility/**/*.ts",
    "src/shared/**/*.ts",
    "test/**/*.ts"
  ]
```

- [ ] **Step 7: Test laufen lassen, grün bestätigen**

Run: `npm run selftest -w @jm/switcher`
Expected: PASS, Abschlusszeile `Alle @jm/switcher-Selbsttests gruen.`

- [ ] **Step 8: Typecheck und Build**

Run: `npm run typecheck -w @jm/switcher && npm run build -w @jm/switcher`
Expected: beides ohne Fehler. Der Build beweist, dass der Re-Export alle bestehenden Importe von
`RESOLUTIONS`/`ProgramResolution` weiter bedient.

- [ ] **Step 9: Commit**

```bash
git add apps/switcher/src/shared/output-quality.ts apps/switcher/test/selftest.ts apps/switcher/package.json apps/switcher/tsconfig.node.json apps/switcher/src/renderer/src/store/settings.ts
git status --short
git commit -m "feat(switcher): Ausgabe-Qualitaetswerte als reines Modul + Selbsttest (Lane D1)"
```

---

### Task 2: Bildrate wirkt in Aufnahme und Stream

**Files:**
- Modify: `apps/switcher/src/renderer/src/core/output.ts`
- Modify: `apps/switcher/src/renderer/src/views/SwitcherView.tsx`

**Interfaces:**
- Consumes: nichts aus Task 1.
- Produces: `OutputController.setFps(fps: number): void`.

- [ ] **Step 1: Die Bildrate in den OutputController einziehen**

In `apps/switcher/src/renderer/src/core/output.ts` oberhalb der Klasse eine Vorgabe ergänzen:

```ts
/** Bildrate des Canvas-Abgriffs, bis der Store seine Einstellung durchreicht. */
const DEFAULT_FPS = 30;
```

Im Feldblock der Klasse `OutputController` neben `private canvasStream: MediaStream | null = null;` ergänzen:

```ts
  /** Bildrate fuer captureStream. Live umstellbar; wirkt beim naechsten Start eines Recorders. */
  private fps = DEFAULT_FPS;
```

- [ ] **Step 2: Den Abgriff die Bildrate benutzen lassen**

In derselben Datei `ensureCanvasStream()` ersetzen:

```ts
  private ensureCanvasStream(): MediaStream | null {
    if (this.canvasStream) return this.canvasStream;
    const c = this.getCanvas();
    if (!c) return null;
    this.canvasStream = c.captureStream(this.fps);
    return this.canvasStream;
  }
```

- [ ] **Step 3: `setFps` ergänzen**

In `OutputController` als öffentliche Methode einfügen (z. B. direkt nach `getState()`):

```ts
  /**
   * Bildrate des Canvas-Abgriffs setzen. Laeuft gerade nichts, wird der zwischengespeicherte
   * Stream verworfen, damit der naechste Start mit der neuen Rate greift.
   *
   * Laeuft eine Aufnahme oder Sendung, bleibt der Stream stehen: MediaRecorder-Spuren sind nach
   * dem Start unveraenderlich (dasselbe gilt fuer den Ton, siehe core/audio.ts). Eine laufende
   * Sendung dafuer neu zu starten waere schlimmer als die verspaetete Wirkung — die neue Rate
   * greift beim naechsten Start.
   */
  setFps(fps: number): void {
    const next = fps > 0 ? fps : DEFAULT_FPS;
    if (next === this.fps) return;
    this.fps = next;
    if (this.state.recording || this.state.streaming) return;
    this.canvasStream?.getTracks().forEach((t) => t.stop());
    this.canvasStream = null;
  }
```

- [ ] **Step 4: In der Oberfläche verdrahten**

In `apps/switcher/src/renderer/src/views/SwitcherView.tsx` den bestehenden Effekt

```tsx
  // Ausgabe-Bildrate live an NDI- UND Zweitbildschirm-Pump (taktet laufende Timer neu).
  useEffect(() => {
    ndiOut.setFps(outputFps);
    screenOut.setFps(outputFps);
  }, [ndiOut, screenOut, outputFps]);
```

ersetzen durch:

```tsx
  // Ausgabe-Bildrate live an NDI-, Zweitbildschirm- und Aufnahme-/Stream-Pfad. Bei NDI und
  // Zweitbildschirm taktet das laufende Timer neu; im Aufnahme-/Stream-Pfad greift die neue Rate
  // erst beim naechsten Start, weil MediaRecorder-Spuren fix sind.
  useEffect(() => {
    ndiOut.setFps(outputFps);
    screenOut.setFps(outputFps);
    output.setFps(outputFps);
  }, [ndiOut, screenOut, output, outputFps]);
```

- [ ] **Step 5: Typecheck und Build**

Run: `npm run typecheck -w @jm/switcher && npm run build -w @jm/switcher`
Expected: beides ohne Fehler.

- [ ] **Step 6: Selbsttest erneut laufen lassen**

Run: `npm run selftest -w @jm/switcher`
Expected: unverändert grün — Task 2 berührt die reine Logik nicht.

- [ ] **Step 7: Commit**

```bash
git add apps/switcher/src/renderer/src/core/output.ts apps/switcher/src/renderer/src/views/SwitcherView.tsx
git status --short
git commit -m "feat(switcher): Bildratenwahl wirkt auch in Aufnahme und Stream (Lane D1)"
```

---

### Task 3: Die Anzeige wird ehrlich

**Files:**
- Modify: `apps/switcher/src/renderer/src/views/SettingsView.tsx`

**Interfaces:**
- Consumes: `recommendedBitrate(resolution, kind)`, `RESOLUTIONS`, `ProgramResolution` aus `@/store/settings` (Task 1).
- Produces: nichts.

**Bewusste Abweichung von der Spec:** Die Spec formuliert den Hinweis auf den nächsten Start als
Zustand („solange gerade aufgenommen oder gesendet wird"). Der `OutputController` lebt aber in
`SwitcherView`, und `SettingsView` kennt seinen Zustand nicht. Den Aufnahme-/Sendestatus quer durch
zwei Ansichten zu reichen, nur um einen Satz ein- und auszublenden, wäre teurer als der Nutzen —
deshalb steht der Satz **dauerhaft**. Er ist in jedem Zustand wahr.

- [ ] **Step 1: Den Import erweitern**

In `apps/switcher/src/renderer/src/views/SettingsView.tsx` die bestehende Zeile

```tsx
import { useSettings, RESOLUTIONS, OUTPUT_FPS_OPTIONS, type ProgramResolution } from '@/store/settings';
```

ersetzen durch:

```tsx
import {
  useSettings,
  RESOLUTIONS,
  OUTPUT_FPS_OPTIONS,
  recommendedBitrate,
  type ProgramResolution,
} from '@/store/settings';
```

- [ ] **Step 2: Den Hinweis zur Stream-Bitrate an die Auflösung binden**

Den bestehenden Text

```tsx
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Video-Bitrate des H.264-Streams (x264). 720p: ~3000–6000 kbit/s.
            </span>
```

ersetzen durch:

```tsx
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Video-Bitrate des H.264-Streams (x264). Empfohlen für{' '}
              {programResolution === '1080p' ? 'Full-HD 1080p' : 'HD 720p'}:{' '}
              {recommendedBitrate(programResolution, 'stream').min.toLocaleString('de-DE')}–
              {recommendedBitrate(programResolution, 'stream').max.toLocaleString('de-DE')} kbit/s.
            </span>
```

- [ ] **Step 3: Den falschen Auflösungs-Satz durch die Wahrheit ersetzen**

Den bestehenden Absatz

```tsx
          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed border-t border-[var(--border)]/60 pt-4">
            Auflösung: <span className="font-semibold text-[var(--foreground)]">1280×720 @ 30 fps</span> ·
            Ton: stille AAC-Spur (Audio-Mix kommt in v0.2). Der Stream wird aus dem Program-Bild
            kodiert (libx264, zerolatency).
          </p>
```

ersetzen durch:

```tsx
          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed border-t border-[var(--border)]/60 pt-4">
            Auflösung:{' '}
            <span className="font-semibold text-[var(--foreground)]">
              {RESOLUTIONS[programResolution].w}×{RESOLUTIONS[programResolution].h} @ {outputFps} fps
            </span>{' '}
            · Ton:{' '}
            {audioInputId
              ? 'Programm-Ton der gewählten Audioquelle'
              : 'stille AAC-Spur (keine Audioquelle gewählt)'}
            . Der Stream wird aus dem Program-Bild kodiert (libx264, zerolatency) — die Auflösung
            folgt der Programm-Auflösung, es wird nie hochskaliert. Eine geänderte Bildrate wirkt
            bei laufender Aufnahme oder Sendung erst beim nächsten Start.
          </p>
```

- [ ] **Step 4: Den Hinweis zur Aufnahme-Bitrate an die Auflösung binden**

Den bestehenden Text

```tsx
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Video-Bitrate der WebM-Aufnahme. 720p: ~8000–16000 kbit/s.
            </span>
```

ersetzen durch:

```tsx
            <span className="text-[11px] text-[var(--muted-foreground)]">
              Video-Bitrate der WebM-Aufnahme. Empfohlen für{' '}
              {programResolution === '1080p' ? 'Full-HD 1080p' : 'HD 720p'}:{' '}
              {recommendedBitrate(programResolution, 'record').min.toLocaleString('de-DE')}–
              {recommendedBitrate(programResolution, 'record').max.toLocaleString('de-DE')} kbit/s.
            </span>
```

- [ ] **Step 5: Typecheck und Build**

Run: `npm run typecheck -w @jm/switcher && npm run build -w @jm/switcher`
Expected: beides ohne Fehler. `programResolution`, `outputFps` und `audioInputId` werden in dieser
Datei bereits aus `useSettings()` bezogen — keine weitere Verdrahtung nötig.

- [ ] **Step 6: Gegenprobe im Quelltext**

Run: `grep -n "1280×720 @ 30 fps\|Audio-Mix kommt in v0.2\|720p: ~" apps/switcher/src/renderer/src/views/SettingsView.tsx`
Expected: keine Treffer — alle vier festen Behauptungen sind verschwunden.

- [ ] **Step 7: Commit**

```bash
git add apps/switcher/src/renderer/src/views/SettingsView.tsx
git status --short
git commit -m "fix(switcher): Einstellungen zeigen die tatsaechliche Aufloesung, Bildrate und Tonquelle (Lane D1)"
```

---

### Task 4: Release vorbereiten

**Files:**
- Modify: `apps/switcher/package.json`
- Modify: `packages/suite-manifest/changelog.json`

**Interfaces:**
- Consumes: die fertigen Tasks 1–3.
- Produces: nichts im Code.

- [ ] **Step 1: Version anheben**

```bash
cd apps/switcher && npm version 0.10.0 --no-git-tag-version && cd ../..
git restore package-lock.json
```

`git restore package-lock.json` ist Pflicht: `npm version` zieht im Monorepo fremde Versionsdrift in die
Sperrdatei, die nicht in diesen Commit gehört.

- [ ] **Step 2: Katalogeintrag ergänzen**

In `packages/suite-manifest/changelog.json` beim Objekt mit `"app": "switcher"` **vorne** in `entries` einfügen:

```json
{
  "version": "0.10.0",
  "date": "2026-08-07",
  "notes": [
    "Die Einstellungen zeigen jetzt die tatsaechliche Ausgabe-Aufloesung, Bildrate und Tonquelle statt eines festen Textes. Bisher stand dort immer 1280x720 bei 30 Bildern, unabhaengig davon, was eingestellt war — Full-HD war laengst moeglich.",
    "Die gewaehlte Bildrate wirkt jetzt auch auf Aufnahme und Stream, nicht mehr nur auf NDI und den zweiten Bildschirm. Bei laufender Aufnahme oder Sendung greift eine Aenderung beim naechsten Start.",
    "Die empfohlenen Bitraten richten sich nach der gewaehlten Aufloesung — Full-HD braucht deutlich mehr als 720p."
  ]
}
```

Keine geraden ASCII-Anführungszeichen (`"`) innerhalb der Texte — sie würden das JSON brechen.

- [ ] **Step 3: JSON prüfen**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8')); console.log('JSON gueltig')"`
Expected: `JSON gueltig`

- [ ] **Step 4: Volle Gates**

Run: `npm run selftest -w @jm/switcher && npm run typecheck -w @jm/switcher && npm run build -w @jm/switcher`
Expected: alles grün.

- [ ] **Step 5: Commit**

```bash
git add apps/switcher/package.json packages/suite-manifest/changelog.json
git status --short
git commit -m "release(switcher): 0.10.0 — ehrliche Ausgabe-Anzeige + Bildrate wirkt (Lane D1)"
```

`git status --short` nach dem `add` lesen: ein fehlgeschlagener Pfad kippt sonst still den ganzen Commit.

---

## Verifikation durch den Owner (Windows, GUI)

Nach dem Release aus dem Installer heraus:

1. Einstellungen öffnen → Programm-Auflösung auf **1080p**, Bildrate auf **50** stellen. Der Absatz unter
   „Streaming" muss jetzt „1920×1080 @ 50 fps" zeigen, nicht mehr „1280×720 @ 30 fps".
2. Die Bitraten-Empfehlungen müssen auf die Full-HD-Werte springen (Stream 6.000–12.000, Aufnahme
   16.000–32.000 kbit/s).
3. Stream starten und am Ziel (YouTube/Twitch-Statistik oder ein zweiter Player) prüfen, dass wirklich
   1920×1080 mit 50 fps ankommt.
4. Ist eine Audioquelle gewählt, muss der Absatz „Programm-Ton der gewählten Audioquelle" nennen, sonst
   „stille AAC-Spur".
5. Gegenprobe: **während laufender Sendung** die Bildrate ändern → die Sendung läuft unverändert weiter,
   der Hinweis auf den nächsten Start steht im Text.

# JM Interpreter — virtuelles Kabel erkennen und benennen (#208) — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Interpreter erkennt bekannte virtuelle Audio-Kabel, nennt dauerhaft das in Zoom zu wählende Gegenstück beim exakten Namen und verweist bei Fehlanzeige auf VB-CABLE — ohne den Livebetrieb je zu blockieren.

**Architecture:** Eine reine, testbare Erkennungsfunktion in `src/shared/` (Muster wie das bestehende `@shared/ducking`), eine schmale IPC-Brücke ohne URL-Parameter für den Download-Knopf, und ein dauerhaft sichtbarer Statusblock in `App.tsx`, der den heutigen — beim Auswählen verschwindenden — Hinweis ersetzt.

**Tech Stack:** TypeScript, Electron 33, React, Tailwind, `node --experimental-strip-types` für Selbsttests.

**Spec:** `docs/superpowers/specs/2026-08-07-interpreter-virtual-cable-design.md`

## Global Constraints

- Der Startknopf wird **nie** blockiert. Alle neuen Zustände sind rein anzeigend. Ein Live-Tool darf sich nicht selbst aussperren.
- **Keine generische Paar-Heuristik.** Erkennung ausschließlich über die feste Liste in `CABLE_KINDS`. Dante (`DVS Transmit 1-2` / `DVS Receive 1-2`) darf **nicht** als Kabel gelten — die beiden Seiten sind nicht intern verbunden.
- Die IPC-Brücke nimmt **keine URL** entgegen. Die Adresse liegt als Konstante im Hauptprozess.
- Empfohlen wird **VB-CABLE**, mit dem Hinweis, dass die gewerbliche Nutzung lizenzpflichtig ist.
- Regex-Abgleich auf Kennsubstrings, **nicht** auf Gleichheit und **ohne** `^`-Anker — Chromium stellt Labels je nach Standardgerät ein „Standard - " / „Default - " voran.
- Keine Änderung an Ducking, Pegelanzeige, Einstellungen oder Engine-Audio-Logik.
- Alle Selbsttests laufen über `npm run selftest -w @jm/interpreter`.
- Umlaute in Commit-Botschaften vermeiden (ue/oe/ae), wie im Repo üblich.

## Dateien

| Datei | Verantwortung |
|---|---|
| `apps/interpreter/src/shared/virtual-cable.ts` (neu) | Kabel-Liste + `detectCable` + `counterpartPresent`. Rein, ohne Web-Audio und ohne Electron. |
| `apps/interpreter/src/shared/api.ts` (neu) | Typ der Preload-Brücke, von Preload und Renderer geteilt. |
| `apps/interpreter/test/selftest.ts` | Bestehender Ducking-Selbsttest, erweitert um den Kabel-Abschnitt. |
| `apps/interpreter/src/main/index.ts` | Registriert `cable:openDownload` mit fester URL. |
| `apps/interpreter/src/preload/index.ts` | Reicht `openCableDownload()` durch. |
| `apps/interpreter/src/renderer/src/jminterpreter.d.ts` (neu) | `window.jminterpreter`-Typ. |
| `apps/interpreter/src/renderer/src/core/engine.ts` | `listDevices` meldet zusätzlich, ob Gerätenamen lesbar sind. |
| `apps/interpreter/src/renderer/src/App.tsx` | Statusblock statt verschwindendem Hinweis; `devicechange`-Abo. |

---

### Task 1: Kabel-Erkennung (reine Logik)

**Files:**
- Create: `apps/interpreter/src/shared/virtual-cable.ts`
- Test: `apps/interpreter/test/selftest.ts` (erweitern, bestehenden Ducking-Teil unberührt lassen)

**Interfaces:**
- Consumes: nichts.
- Produces: `interface CableKind { id: string; name: string; outputMatch: RegExp; zoomInputLabel: string; inputMatch: RegExp }`, `const CABLE_KINDS: CableKind[]`, `detectCable(outputLabel: string): CableKind | null`, `counterpartPresent(kind: CableKind, inputLabels: string[]): boolean`.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

An `apps/interpreter/test/selftest.ts` anhängen — **vor** dem abschließenden `if (failures)`-Block am Dateiende. Die vorhandene Hilfsfunktion heißt `assert(cond, name)` (Bedingung zuerst):

```ts
console.log('\nvirtual-cable — Erkennung:');
{
  const vb = detectCable('CABLE Input (VB-Audio Virtual Cable)');
  assert(vb?.id === 'vb-cable', 'VB-CABLE erkannt');
  assert(
    vb?.zoomInputLabel === 'CABLE Output (VB-Audio Virtual Cable)',
    'VB-CABLE nennt das Zoom-Gegenstueck exakt',
  );

  assert(
    detectCable('Standard - CABLE Input (VB-Audio Virtual Cable)')?.id === 'vb-cable',
    'Praefix "Standard - " stoert die Erkennung nicht',
  );
  assert(
    detectCable('cable input (vb-audio virtual cable)')?.id === 'vb-cable',
    'Gross-/Kleinschreibung egal',
  );
  assert(detectCable('CABLE-A Input (VB-Audio Cable A)')?.id === 'vb-cable-a', 'VB-CABLE A erkannt');
  assert(detectCable('CABLE-B Input (VB-Audio Cable B)')?.id === 'vb-cable-b', 'VB-CABLE B erkannt');
  assert(
    detectCable('VoiceMeeter Input (VB-Audio VoiceMeeter VAIO)')?.id === 'voicemeeter',
    'VoiceMeeter erkannt',
  );
  assert(
    detectCable('VoiceMeeter Aux Input (VB-Audio VoiceMeeter AUX VAIO)')?.id === 'voicemeeter-aux',
    'VoiceMeeter AUX nicht mit dem Haupt-VAIO verwechselt',
  );
}

console.log('virtual-cable — Negativfaelle (duerfen NICHT als Kabel gelten):');
{
  // Dante meldet Sende- und Empfangsseite getrennt, sie sind aber nicht intern verbunden.
  assert(detectCable('DVS Transmit 1-2') === null, 'Dante DVS Transmit ist kein Kabel');
  assert(detectCable('DVS Receive 1-2') === null, 'Dante DVS Receive ist kein Kabel');
  assert(detectCable('Lautsprecher (Realtek Audio)') === null, 'Realtek-Lautsprecher ist kein Kabel');
  assert(detectCable('NDI Webcam Audio') === null, 'NDI Webcam Audio ist kein Kabel');
  assert(detectCable('') === null, 'leerer Name ergibt null');
}

console.log('virtual-cable — Gegenseite:');
{
  const vb = detectCable('CABLE Input (VB-Audio Virtual Cable)');
  if (!vb) throw new Error('Vorbedingung: VB-CABLE muss erkannt werden');
  assert(
    counterpartPresent(vb, ['Mikrofon (Realtek)', 'CABLE Output (VB-Audio Virtual Cable)']),
    'Aufnahmeseite wird gefunden',
  );
  assert(
    !counterpartPresent(vb, ['Mikrofon (Realtek)', 'DVS Receive 1-2']),
    'fehlende Aufnahmeseite wird gemeldet',
  );
  assert(!counterpartPresent(vb, []), 'leere Geraeteliste ergibt false');
}
```

Und den Import am Dateikopf ergänzen, direkt unter dem bestehenden `ducking`-Import:

```ts
import { counterpartPresent, detectCable } from '../src/shared/virtual-cable.ts';
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm run selftest -w @jm/interpreter`
Expected: FAIL mit `ERR_MODULE_NOT_FOUND` für `src/shared/virtual-cable.ts`.

- [ ] **Step 3: Das Modul schreiben**

`apps/interpreter/src/shared/virtual-cable.ts`:

```ts
// Erkennung virtueller Audio-Kabel (#208).
//
// Der Interpreter SPIELT seinen Mix in ein virtuelles Kabel hinein; Zoom greift das ANDERE Ende
// desselben Kabels als Mikrofon ab. Die Geraete sind dabei aus Sicht des KABELS benannt, nicht aus
// Sicht des Nutzers: bei VB-CABLE heisst das Wiedergabe-Geraet "CABLE Input" und das Aufnahme-
// Geraet "CABLE Output". Wer "Input" fuer "Eingang in Zoom" haelt, sucht vergeblich — genau daran
// scheiterte #208. Deshalb nennt die Oberflaeche das Gegenstueck beim exakten Namen.
//
// Bewusst eine FESTE LISTE statt der Heuristik "Ausgabe X hat ein aehnlich benanntes Eingabegeraet":
// Dante meldet "DVS Transmit 1-2" und "DVS Receive 1-2", die aber NICHT intern verbunden sind (das
// setzt Routing im Dante Controller voraus). Eine Heuristik wuerde den Operator dort in die Irre
// fuehren — im Livebetrieb der teuerste denkbare Fehler.
//
// Alle Muster sind Substring-Regexe ohne ^-Anker: Chromium stellt Geraetenamen je nach
// Standardgeraet und Sprache ein "Standard - " bzw. "Default - " voran, und die Klammerzusaetze
// schwanken zwischen Treiberversionen.

export interface CableKind {
  /** Stabile Kennung, z. B. 'vb-cable'. */
  id: string;
  /** Anzeigename fuer die Oberflaeche, z. B. 'VB-CABLE'. */
  name: string;
  /** Wiedergabe-Geraet: hier spielt der Interpreter hinein. */
  outputMatch: RegExp;
  /** Exakt das, was der Operator in Zoom als Mikrofon waehlt. */
  zoomInputLabel: string;
  /** Aufnahme-Geraet: damit wird geprueft, ob die Gegenseite existiert. */
  inputMatch: RegExp;
}

export const CABLE_KINDS: CableKind[] = [
  {
    id: 'vb-cable',
    name: 'VB-CABLE',
    outputMatch: /cable input \(vb-audio (?:virtual )?cable\)/i,
    zoomInputLabel: 'CABLE Output (VB-Audio Virtual Cable)',
    inputMatch: /cable output \(vb-audio (?:virtual )?cable\)/i,
  },
  {
    id: 'vb-cable-a',
    name: 'VB-CABLE A',
    outputMatch: /cable-a input \(vb-audio cable a\)/i,
    zoomInputLabel: 'CABLE-A Output (VB-Audio Cable A)',
    inputMatch: /cable-a output \(vb-audio cable a\)/i,
  },
  {
    id: 'vb-cable-b',
    name: 'VB-CABLE B',
    outputMatch: /cable-b input \(vb-audio cable b\)/i,
    zoomInputLabel: 'CABLE-B Output (VB-Audio Cable B)',
    inputMatch: /cable-b output \(vb-audio cable b\)/i,
  },
  {
    id: 'vb-cable-c',
    name: 'VB-CABLE C',
    outputMatch: /cable-c input \(vb-audio cable c\)/i,
    zoomInputLabel: 'CABLE-C Output (VB-Audio Cable C)',
    inputMatch: /cable-c output \(vb-audio cable c\)/i,
  },
  {
    id: 'vb-cable-d',
    name: 'VB-CABLE D',
    outputMatch: /cable-d input \(vb-audio cable d\)/i,
    zoomInputLabel: 'CABLE-D Output (VB-Audio Cable D)',
    inputMatch: /cable-d output \(vb-audio cable d\)/i,
  },
  {
    id: 'voicemeeter-aux',
    name: 'VoiceMeeter AUX',
    outputMatch: /voicemeeter aux input/i,
    zoomInputLabel: 'VoiceMeeter Aux Output (VB-Audio VoiceMeeter AUX VAIO)',
    inputMatch: /voicemeeter aux output/i,
  },
  {
    id: 'voicemeeter-vaio3',
    name: 'VoiceMeeter VAIO3',
    outputMatch: /voicemeeter vaio3 input/i,
    zoomInputLabel: 'VoiceMeeter VAIO3 Output (VB-Audio VoiceMeeter VAIO3)',
    inputMatch: /voicemeeter vaio3 output/i,
  },
  {
    id: 'voicemeeter',
    name: 'VoiceMeeter',
    outputMatch: /voicemeeter input \(vb-audio voicemeeter vaio\)/i,
    zoomInputLabel: 'VoiceMeeter Output (VB-Audio VoiceMeeter VAIO)',
    inputMatch: /voicemeeter output \(vb-audio voicemeeter vaio\)/i,
  },
];

/**
 * Erkennt das Kabel hinter einem Wiedergabe-Geraetenamen.
 * null = unbekanntes Geraet (kein Fehler — der Operator darf es trotzdem waehlen).
 */
export function detectCable(outputLabel: string): CableKind | null {
  if (!outputLabel) return null;
  return CABLE_KINDS.find((k) => k.outputMatch.test(outputLabel)) ?? null;
}

/** Existiert die Aufnahme-Gegenseite des Kabels in der Geraeteliste? */
export function counterpartPresent(kind: CableKind, inputLabels: string[]): boolean {
  return inputLabels.some((label) => kind.inputMatch.test(label));
}
```

Hinweis zur Reihenfolge in `CABLE_KINDS`: Die spezielleren VoiceMeeter-Varianten (AUX, VAIO3) stehen **vor** dem Haupt-VAIO. Das Haupt-Muster verlangt zwar den vollen Klammerzusatz und träfe „VoiceMeeter Aux Input" ohnehin nicht, aber die Reihenfolge macht die Absicht sichtbar und hält den Test auch dann grün, wenn ein Treiber den Zusatz weglässt.

- [ ] **Step 4: Test laufen lassen, grün bestätigen**

Run: `npm run selftest -w @jm/interpreter`
Expected: PASS — der bestehende Ducking-Abschnitt und alle neuen Kabel-Prüfungen grün, Abschluss `Alle @jm/interpreter-Selbsttests grün.`

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck -w @jm/interpreter`
Expected: keine Fehler.

- [ ] **Step 6: Commit**

```bash
git add apps/interpreter/src/shared/virtual-cable.ts apps/interpreter/test/selftest.ts
git commit -m "feat(interpreter): bekannte virtuelle Kabel erkennen (#208)"
```

---

### Task 2: Brücke zum Download-Verweis

**Files:**
- Create: `apps/interpreter/src/shared/api.ts`
- Create: `apps/interpreter/src/renderer/src/jminterpreter.d.ts`
- Modify: `apps/interpreter/src/main/index.ts`
- Modify: `apps/interpreter/src/preload/index.ts`

**Interfaces:**
- Consumes: nichts aus Task 1.
- Produces: `window.jminterpreter.openCableDownload(): Promise<void>` für Task 3; Typ `JmInterpreterApi` aus `@shared/api`.

- [ ] **Step 1: Den geteilten Typ anlegen**

`apps/interpreter/src/shared/api.ts`:

```ts
// Vertrag der Preload-Bruecke. Liegt in shared, damit Preload und Renderer denselben Typ
// benutzen — das Muster des Media Converters (@shared/types).
export interface JmInterpreterApi {
  platform: string;
  /**
   * Oeffnet die Bezugsquelle des empfohlenen virtuellen Kabels im Standardbrowser.
   * Nimmt bewusst KEINE URL entgegen: ein Kanal, der beliebige Adressen an
   * shell.openExternal durchreicht, waere eine offene Tuer aus dem Renderer heraus.
   */
  openCableDownload: () => Promise<void>;
}
```

- [ ] **Step 2: Den Renderer-Typ deklarieren**

`apps/interpreter/src/renderer/src/jminterpreter.d.ts`:

```ts
import type { JmInterpreterApi } from '@shared/api';

declare global {
  interface Window {
    jminterpreter: JmInterpreterApi;
  }
}

export {};
```

- [ ] **Step 3: Das Preload erweitern**

`apps/interpreter/src/preload/index.ts` vollständig ersetzen:

```ts
import { contextBridge, ipcRenderer } from 'electron';
import type { JmInterpreterApi } from '@shared/api';

// Die Audio-Kette lebt vollstaendig im Renderer; vom Main braucht der Interpreter nur den
// Download-Verweis auf das virtuelle Kabel (#208).
const api: JmInterpreterApi = {
  platform: process.platform,
  openCableDownload: () => ipcRenderer.invoke('cable:openDownload') as Promise<void>,
};

export type { JmInterpreterApi };

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('jminterpreter', api);
} else {
  // @ts-expect-error Fallback, wenn contextIsolation aus ist
  window.jminterpreter = api;
}
```

- [ ] **Step 4: Den Hauptprozess erweitern**

In `apps/interpreter/src/main/index.ts` die Electron-Import-Zeile ersetzen:

```ts
import { app, ipcMain, session, shell } from 'electron';
```

Direkt unter `const preloadPath = …` einfügen:

```ts
/**
 * Bezugsquelle des empfohlenen virtuellen Kabels (#208). Die Adresse steht hier und NICHT im
 * Renderer: der IPC-Kanal nimmt keine URL entgegen, damit kein offener openExternal-Kanal entsteht.
 */
const CABLE_DOWNLOAD_URL = 'https://vb-audio.com/Cable/';
```

Und in `app.whenReady().then(…)` direkt vor `createWindow();` einfügen:

```ts
    ipcMain.handle('cable:openDownload', () => shell.openExternal(CABLE_DOWNLOAD_URL));
```

- [ ] **Step 5: Typecheck und Build**

Run: `npm run typecheck -w @jm/interpreter && npm run build -w @jm/interpreter`
Expected: beides ohne Fehler.

- [ ] **Step 6: Im gebauten Bundle gegenprüfen**

Run: `grep -o "cable:openDownload" apps/interpreter/out/preload/index.cjs apps/interpreter/out/main/index.cjs`
Expected: je ein Treffer pro Datei — die Brücke ist auf beiden Seiten im Bundle.

Run: `grep -c "vb-audio.com" apps/interpreter/out/preload/index.cjs || true`
Expected: `0` — die Adresse darf **nicht** im Preload landen, sie gehört in den Hauptprozess.

- [ ] **Step 7: Commit**

```bash
git add apps/interpreter/src/shared/api.ts apps/interpreter/src/renderer/src/jminterpreter.d.ts apps/interpreter/src/preload/index.ts apps/interpreter/src/main/index.ts
git commit -m "feat(interpreter): Bruecke fuer den Kabel-Download ohne URL-Parameter (#208)"
```

---

### Task 3: Statusblock und Geräteüberwachung

**Files:**
- Modify: `apps/interpreter/src/renderer/src/core/engine.ts:52-65`
- Modify: `apps/interpreter/src/renderer/src/App.tsx`

**Interfaces:**
- Consumes: `detectCable`, `counterpartPresent`, `CableKind` aus `@shared/virtual-cable` (Task 1); `window.jminterpreter.openCableDownload()` (Task 2).
- Produces: `listDevices(): Promise<{ inputs: DeviceInfo[]; outputs: DeviceInfo[]; labelsAvailable: boolean }>`.

- [ ] **Step 1: `listDevices` meldet, ob Namen lesbar sind**

In `apps/interpreter/src/renderer/src/core/engine.ts` die Funktion `listDevices` ersetzen (der Rest der Datei bleibt unberührt):

```ts
/**
 * Geräte auflisten. Ohne einmal erteilte Mikrofon-Freigabe liefert der Browser leere Labels —
 * deshalb vorher einen Stream anfordern und sofort wieder schließen. `labelsAvailable` meldet,
 * ob echte Namen herausgegeben wurden: ohne sie ist keine Kabel-Erkennung möglich, und die
 * Oberfläche darf das nicht mit „kein Kabel gefunden" verwechseln.
 */
export async function listDevices(): Promise<{
  inputs: DeviceInfo[];
  outputs: DeviceInfo[];
  labelsAvailable: boolean;
}> {
  try {
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
    probe.getTracks().forEach((t) => t.stop());
  } catch {
    // Verweigert: wir listen trotzdem, die Labels bleiben dann leer.
  }
  const all = await navigator.mediaDevices.enumerateDevices();
  const pick = (kind: MediaDeviceKind): DeviceInfo[] =>
    all
      .filter((d) => d.kind === kind)
      .map((d) => ({ deviceId: d.deviceId, label: d.label || `${kind} ${d.deviceId.slice(0, 6)}` }));
  return {
    inputs: pick('audioinput'),
    outputs: pick('audiooutput'),
    labelsAvailable: all.some((d) => d.label.trim().length > 0),
  };
}
```

- [ ] **Step 2: Geräte bei Änderung neu einlesen**

In `apps/interpreter/src/renderer/src/App.tsx` den `useState`-Block um das neue Flag ergänzen — direkt unter `const [outputs, setOutputs] = useState<DeviceInfo[]>([]);`:

```tsx
  const [labelsAvailable, setLabelsAvailable] = useState(true);
```

Und den Geräte-Effekt (heute `useEffect(() => { void listDevices().then(…) }, [])`) vollständig ersetzen:

```tsx
  // Geräte auch nachziehen, wenn sich die Liste ändert: wer VB-CABLE erst nachinstalliert, soll
  // die Hinweiskarte ohne Neustart verschwinden sehen.
  useEffect(() => {
    const load = (): void => {
      void listDevices().then(({ inputs, outputs, labelsAvailable }) => {
        setInputs(inputs);
        setOutputs(outputs);
        setLabelsAvailable(labelsAvailable);
      });
    };
    load();
    navigator.mediaDevices.addEventListener('devicechange', load);
    return () => navigator.mediaDevices.removeEventListener('devicechange', load);
  }, []);
```

- [ ] **Step 3: Den verschwindenden Hinweis durch den Statusblock ersetzen**

In `App.tsx` den gesamten Block ersetzen:

```tsx
      {!s.outputId && (
        <div className="rounded-lg border border-yellow-800 bg-yellow-950/30 p-3 text-sm text-yellow-200">
          Kein Ausgabegerät gewählt — der Mix geht auf den Systemstandard. Für die Einspeisung in Zoom/Webex ein
          virtuelles Kabel (z. B. VB-Cable) wählen und dort als <em>Mikrofon</em> auswählen.
        </div>
      )}
```

durch:

```tsx
      <CableStatus
        outputId={s.outputId}
        outputs={outputs}
        inputs={inputs}
        labelsAvailable={labelsAvailable}
      />
```

- [ ] **Step 4: Die Komponenten anlegen**

Zwei Importe am Kopf von `App.tsx` ergänzen. `ReactNode` ist nötig, weil die Datei bisher nur einzelne Hooks importiert — ein `React.`-Namensraum steht hier **nicht** zur Verfügung:

```tsx
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { counterpartPresent, detectCable } from '@shared/virtual-cable';
```

(die erste Zeile ersetzt den bestehenden React-Import)

Und ans Dateiende anfügen (neben `Picker` und `Meter`):

```tsx
/** Einheitlicher Rahmen fuer die Statuszeilen unter dem Ausgabe-Picker. */
function Notice({ tone, children }: { tone: 'ok' | 'warn'; children: ReactNode }): JSX.Element {
  const cls =
    tone === 'ok'
      ? 'border-neutral-700 bg-neutral-900 text-neutral-200'
      : 'border-yellow-800 bg-yellow-950/30 text-yellow-200';
  return <div className={`rounded-lg border p-3 text-sm ${cls}`}>{children}</div>;
}

/**
 * Sagt dauerhaft, was in Zoom zu waehlen ist (#208). Der frueherere Hinweis verschwand, sobald ein
 * Geraet gewaehlt war — also genau dann, wenn der Operator die Anweisung braucht.
 */
function CableStatus({
  outputId,
  outputs,
  inputs,
  labelsAvailable,
}: {
  outputId: string;
  outputs: DeviceInfo[];
  inputs: DeviceInfo[];
  labelsAvailable: boolean;
}): JSX.Element {
  if (!labelsAvailable) {
    return (
      <Notice tone="warn">
        Gerätenamen nicht lesbar — bitte die Mikrofonfreigabe erteilen. Ohne sie kann der Interpreter das
        virtuelle Kabel nicht erkennen.
      </Notice>
    );
  }

  const selected = outputs.find((d) => d.deviceId === outputId);
  const kind = selected ? detectCable(selected.label) : null;

  if (kind && counterpartPresent(kind, inputs.map((d) => d.label))) {
    return (
      <Notice tone="ok">
        {kind.name} erkannt. In Zoom als <em>Mikrofon</em> wählen: <strong>{kind.zoomInputLabel}</strong>
      </Notice>
    );
  }

  if (kind) {
    return (
      <Notice tone="warn">
        {kind.name} erkannt, aber die Aufnahmeseite <strong>{kind.zoomInputLabel}</strong> fehlt. Der Treiber
        ist unvollständig installiert oder das Gerät ist in den Windows-Sound-Einstellungen deaktiviert.
      </Notice>
    );
  }

  return (
    <div className="rounded-lg border border-yellow-800 bg-yellow-950/30 p-4 text-sm text-yellow-200">
      <p className="font-bold">Kein virtuelles Kabel gewählt</p>
      <p className="mt-1 text-yellow-200/80">
        Zoom und Webex können nur ein <em>Mikrofon</em> abgreifen. Der Interpreter spielt seinen Mix deshalb
        in ein virtuelles Kabel hinein; in Zoom wird dann das andere Ende desselben Kabels als Mikrofon
        gewählt. Ohne Kabel geht der Mix auf den Systemstandard und erreicht die Konferenz nicht.
      </p>
      <p className="mt-2 text-xs text-yellow-200/60">
        VB-CABLE ist für private Nutzung Donationware; der gewerbliche Einsatz ist lizenzpflichtig.
      </p>
      <button
        onClick={() => void window.jminterpreter.openCableDownload()}
        className="mt-3 rounded-lg border border-yellow-700 px-3 py-1.5 text-xs font-semibold hover:bg-yellow-900/40"
      >
        VB-CABLE herunterladen
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck und Build**

Run: `npm run typecheck -w @jm/interpreter && npm run build -w @jm/interpreter`
Expected: beides ohne Fehler.

- [ ] **Step 6: Selbsttest erneut laufen lassen**

Run: `npm run selftest -w @jm/interpreter`
Expected: unverändert grün — die Engine-Änderung darf die reine Logik nicht berühren.

- [ ] **Step 7: Commit**

```bash
git add apps/interpreter/src/renderer/src/core/engine.ts apps/interpreter/src/renderer/src/App.tsx
git commit -m "feat(interpreter): Zoom-Gegenstueck dauerhaft nennen + Geraete nachziehen (#208)"
```

---

### Task 4: Release vorbereiten

**Files:**
- Modify: `apps/interpreter/package.json`
- Modify: `packages/suite-manifest/changelog.json`

**Interfaces:**
- Consumes: die fertigen Tasks 1–3.
- Produces: nichts im Code.

- [ ] **Step 1: Version anheben**

```bash
cd apps/interpreter && npm version 0.2.0 --no-git-tag-version && cd ../..
git restore package-lock.json
```

`git restore package-lock.json` ist Pflicht: `npm version` zieht im Monorepo fremde Versionsdrift in die Sperrdatei, die nicht in diesen Commit gehört.

- [ ] **Step 2: Katalogeintrag ergänzen**

In `packages/suite-manifest/changelog.json` beim Eintrag mit `"app": "interpreter"` vorne in `entries` einfügen:

```json
{
  "version": "0.2.0",
  "date": "2026-08-07",
  "notes": [
    "Der Interpreter erkennt jetzt bekannte virtuelle Kabel (VB-CABLE, VoiceMeeter) und nennt dauerhaft das Geraet, das in Zoom als Mikrofon zu waehlen ist — der Hinweis verschwindet nicht mehr, sobald ein Ausgabegeraet gewaehlt wurde.",
    "Ist kein Kabel vorhanden, erklaert eine Karte den Zusammenhang und verweist auf den Download. Ein nachtraeglich installiertes Kabel wird ohne Neustart erkannt."
  ]
}
```

Keine typografischen Anführungszeichen im ASCII-Sinn (`"`) innerhalb der Texte verwenden — sie würden das JSON brechen.

- [ ] **Step 3: JSON prüfen**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8')); console.log('JSON gueltig')"`
Expected: `JSON gueltig`

- [ ] **Step 4: Volle Gates**

Run: `npm run selftest -w @jm/interpreter && npm run typecheck -w @jm/interpreter && npm run build -w @jm/interpreter`
Expected: alles grün.

- [ ] **Step 5: Commit**

```bash
git add apps/interpreter/package.json packages/suite-manifest/changelog.json
git status --short
git commit -m "release(interpreter): 0.2.0 — virtuelles Kabel erkennen und benennen (#208)"
```

`git status --short` nach dem `add` lesen: ein fehlgeschlagener Pfad kippt sonst still den ganzen Commit.

---

## Verifikation durch den Owner (Windows, GUI)

Nach dem Release aus dem Installer heraus:

1. Ohne installiertes Kabel → Karte „Kein virtuelles Kabel gewählt" samt Download-Knopf; der Knopf öffnet vb-audio.com im Browser.
2. VB-CABLE installieren, **ohne** den Interpreter neu zu starten → die Karte weicht dem Hinweis, sobald das Gerät gewählt ist.
3. „CABLE Input (VB-Audio Virtual Cable)" wählen → Zeile „In Zoom als Mikrofon wählen: CABLE Output (VB-Audio Virtual Cable)".
4. In Zoom „CABLE Output" als Mikrofon setzen → Ton kommt an, Ducking arbeitet wie zuvor.
5. Gegenprobe: ein gewöhnliches Ausgabegerät (Realtek-Lautsprecher) wählen → Karte erscheint wieder, „Starten" bleibt trotzdem möglich.

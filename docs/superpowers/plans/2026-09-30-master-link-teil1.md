# Master-Link Teil 1 · Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Launcher kann Master sein. Andere Rechner koppeln sich einmal per Code und finden ihn danach selbst wieder, der Master sieht je Rechner, welche Tools laufen.

**Architecture:**
- **Neues Paket `@jm/master-link`:** reines Node ohne Electron. Es enthält Code, Beweise, Rahmen, Adresswahl, Fehler, Dateien, mDNS, Server, Koppeln und Client.
- **Tools:** Sie bekommen den Client über `@jm/app-runtime`. Er startet erst nach der Einzelinstanz-Sperre.
- **Launcher:** Er führt die Rolle (Master/Slave) in `src/main/verbund/` und zeigt sie im Modal „Verbund“ und in einer Kopfanzeige.
- **Kommunikation:** Alles läuft über TLS mit einem Pin im Handshake, Zeilen-JSON und Port 8738.

**Tech Stack:** TypeScript (ESM, Importe ohne Endung), Node `tls`/`crypto`/`fs`, `bonjour-service` 1.4 (mDNS), `@jm/auth-core`, Electron 33, React 18, Zustand 4, Tailwind 4, `tsx` für die Selbsttests.

**Spec:** `docs/superpowers/specs/2026-09-30-master-link-teil1-design.md` (vom Owner freigegeben). Der Plan leitet sich aus der Spec ab, deshalb gehören beide zusammen.

## Global Constraints

**Werte aus der Spec:**
- **Port und Protokoll:** Port **8738**, `PROTOKOLL = 1`, Diensttyp `jmps-master` (→ `_jmps-master._tcp`), Instanzname `jm-master-<erste 8 Zeichen der masterId ohne Bindestriche>`.
- **Code:** 10 Zeichen aus `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (31), `crypto.randomInt`. Gültig 120 s, höchstens 5 Fehlversuche. Anzeige `XXXXX-XXXXX`.
- **Fristen (Vorgabe):**
  - Verbindungsaufbau und Anmeldung: TCP 3000 ms · TLS+`hallo` 5000 ms · `angemeldet` 10 000 ms · `koppeln` (Slave, hart) 10 000 ms
  - Laufende Verbindung: Puls 10 000 ms · Stille 25 000 ms
  - Master-Seite: Handshake 10 000 ms · Anmeldefrist ab TCP 10 000 ms
  - Suche und Rückzug: Suchrunde 1500 ms · Rückzug 1 → 2 → 4 → 8 → max. 10 s mit ±25 %
  - Feste Wiederholungen: `zertifikat`/`uhr` 30 s · `protokoll` 60 s · `ersetzt` 60 s · `last` ≥ 5 s
  - Ratenfenster 60 s
  - Prüftakte: Datei 5 s · Karten 10 s · „zuletzt gesehen“ höchstens alle 60 s schreiben
- **Grenzen:** 4 KiB vor, 1 MiB nach der Anmeldung. 64 unangemeldete Verbindungen, 20 fehlgeschlagene Signaturen pro Minute und Quell-IP (Loopback ausgenommen). Namen höchstens 60 Zeichen.
- **Zertifikat:** `selfsigned.generate([{ name: 'commonName', value: 'jm-master-link' }], { days: 3650, keySize: 2048, algorithm: 'sha256', notBeforeDate: new Date(Date.now() - 365 * 24 * 3600 * 1000) })`
  - Danach prüfen, bei Ablehnung neu erzeugen (höchstens 5 Versuche, dann werfen). selfsigned 2.4.1 mit node-forge 1.4.0 kodiert eine Seriennummer `00 00 xx` (≈1/65536 je Zertifikat) nicht minimal, OpenSSL lehnt das Zertifikat dann mit `ERR_OSSL_ASN1_ILLEGAL_PADDING` ab (gemessen).
- **Schlüssel:** Ed25519, öffentlich als SPKI-DER base64, privat als PKCS8-DER base64. Beim Prüfen **muss** `asymmetricKeyType === 'ed25519'` erzwungen werden, denn `createPublicKey` nimmt sonst auch RSA an (gemessen).
- **Pfade:**
  - `<appData>/JM Production Suite/master-link.json` (gemeinsam)
  - `<userData des Launchers>/master-link/identitaet.json` und `verbund.json` (je mit `.bak`)
  - `userData` des Launchers ist `%APPDATA%\@jm\launcher\`

**Codekonventionen:**
- **Importe:** innerhalb der Pakete **ohne** Dateiendung. Die Paket-Selbsttests laufen per `tsx`.
- **Launcher-Selbsttest** (`node --experimental-strip-types`): Er darf nur Dateien ohne Laufzeit-Importe bzw. nur mit `import type` laden, also nur Relativimporte mit `.ts`-Endung aus `test/`.
- **Keine DOM-Typen** in `@jm/master-link`, weil Timer, Prompter, Rundown, Stage Display und Studio Control nur `lib: ["ES2022"]` haben.
- **Timer-Typen:** Timer-Felder als `ReturnType<typeof setTimeout>` bzw. `ReturnType<typeof setInterval>`.
- **`isolatedModules`:** Typ-Re-Exporte als `export type { … }`.
- **`bonjour-service`:** nur per Default-Import `import BonjourPaket from 'bonjour-service'` und `new BonjourPaket.Bonjour(…)`. Der benannte Import scheitert unter ESM (gemessen).
- **Nie im Log:** Code, private Schlüssel, Beweise, Signaturen. Fingerprints erscheinen nur gekürzt (16 Zeichen). `JSON.parse`-Fehlertexte nicht loggen.
- **Keine neuen Laufzeitabhängigkeiten** außer `@jm/master-link` selbst. Keine Krypto-Bibliothek, kein PAKE.
- **`package-lock.json`** wird per `npm install` im selben Commit mitgezogen, sobald sich eine `package.json` ändert. Die CI nutzt `npm ci`.
- **Commits:** mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git add` mit expliziten Pfaden, danach `git status --short` lesen.

## Review Focus

Diese Eingaben und Zustände deckt die Spec nicht als eigene Anforderung ab. Sie treffen Bediener aber am wahrscheinlichsten. Zu jeder Zeile gibt es einen Test in der genannten Aufgabe.

1. **Lange Namen oder Namen mit Umlauten/Emoji** für Master oder Rechner. Erwartet: wird auf 60 Zeichen gekürzt, der mDNS-TXT-Eintrag `name=…` bleibt ≤ 255 Byte, nichts stürzt ab und die Annonce bleibt gültig. Tests in **Aufgabe 1** (`kuerzeName`) und **Aufgabe 8** (TXT-Bytes).
2. **Master-Modus schnell aus und wieder an.** Erwartet: Port 8738 ist sofort wieder frei, alte Sitzungen sind zu, es gibt kein `EADDRINUSE`. Tests in **Aufgabe 9** (Server stoppen/starten auf demselben Port) und **Aufgabe 15** (Rolle zweimal umschalten; „Aus“ während eines laufenden Starts, sofort danach eine neue `MasterRolle`). `verbund/index.ts` führt zustandsändernde Aufrufe nacheinander aus, damit verschachtelte IPC-Aufrufe („Master → Aus → Master“) sich nicht überholen.
3. **`master-link.json` wird im Betrieb gelöscht oder von Hand verändert.** Erwartet: Die Tools gehen auf `aus` bzw. nach zwei Fehllesungen auf `fehler:datei`. Nichts stürzt ab, eine reparierte Datei verbindet wieder. Test in **Aufgabe 11**.
4. **Zwei Master mit gleichem Anzeigenamen im selben Netz** (zwei Säle). Erwartet: Instanznamen unterscheiden sich, ein gekoppelter Slave verbindet nur seine `masterId`. Tests in **Aufgabe 8** und **Aufgabe 11**.
5. **Slave-Laptop im Standby oder halboffene TCP-Verbindung.** Erwartet: Nach `stilleMs` ohne Zeile baut der Client selbst neu auf und hängt nicht dauerhaft in „verbunden“. Test in **Aufgabe 11**.

---

## Dateistruktur

**Neu: `packages/master-link/`**

| Datei | Verantwortung |
| --- | --- |
| `package.json`, `tsconfig.json` | Paket (ESM, `exports` → `src/index.ts`), Skripte `selftest` (tsx), `selftest:mdns`, `typecheck` |
| `src/fristen.ts` | alle Fristen, Grenzen, Port, Suite-Ordner, `kuerzeName` |
| `src/code.ts` | Kopplungscode erzeugen, prüfen, anzeigen |
| `src/beweis.ts` | Kopplungsbeweise (HMAC), Ed25519, PEM/Fingerprint |
| `src/rahmen.ts` | Nachrichtentypen, strikte Prüfung, Zeilenrahmen mit Grenze |
| `src/verbindung.ts` | TLS-Socket + Zeilenrahmen → Ereignisse `nachricht`/`unbekannt`/`ende` |
| `src/adresswahl.ts` | Netzwerkkarten, Subnetze, Kandidatenreihenfolge (#234) |
| `src/fehler.ts` | Einordnung von Fehlern → Code, Rangfolge, Wiederholung, Texte |
| `src/datei.ts` | `master-link.json` lesen, prüfen, atomar schreiben, beobachten |
| `src/speicher.ts` | `identitaet.json`/`verbund.json` mit `.bak`, Verbundspeicher |
| `src/mdns.ts` | Instanzen je Karte, Annonce, Suchrunde mit neuem Browser |
| `src/server.ts` | `MasterLinkServer` (Lauscher, Anmeldung, Teilnehmer, Kopplung, Grenzen) |
| `src/koppeln.ts` | Slave-Seite der Kopplung mit harter Frist |
| `src/client.ts` | `MasterLinkClient` (Zustandsautomat, Suche, Fristen, Wiederholung) |
| `src/index.ts` | öffentliche API |
| `test/helfer.ts`, `test/zertifikate.ts`, `test/tlspaar.ts`, `test/muster.ts`, `test/rohclient.ts`, `test/aufbau.ts` | Testhilfen |
| `test/*.test.ts`, `test/selftest.ts`, `test/mdns-echt.ts` | Selbsttests |
| `ABNAHME.md` | Abnahme-Checkliste für den Owner |

**Geändert: `packages/app-runtime/`**
- `package.json`: Abhängigkeit `@jm/master-link`
- `src/index.ts`: Option `masterLink`, Client-Start nach der Sperre, Feld `verbund` im Heartbeat, `getMasterLinkStatus`

**Launcher**

| Datei | Änderung |
| --- | --- |
| `src/main/presence-store.ts` (neu) | reine Presence-Logik inkl. `verbund` |
| `src/main/presence.ts` | nutzt den Store |
| `src/main/verbund/zertifikat.ts`, `master.ts`, `slave.ts`, `wache.ts`, `index.ts` (neu) | Rollen, Datei, Stand, IPC-Funktionen; `wache.ts`: Karten- und Datei-Wächter ohne Electron |
| `src/main/env.d.ts` | `selfsigned`-Shim um `notBeforeDate` |
| `src/main/ipc.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/shared/types.ts` | Andockstellen |
| `src/renderer/src/lib/kopfanzeige.ts`, `lib/verbund-texte.ts` (neu) | reine Anzeige-Funktionen |
| `src/renderer/src/store/verbund.ts` (neu), `store/tools.ts` | Store und Ereignis |
| `src/renderer/src/components/VerbundBadge.tsx`, `VerbundModal.tsx`, `VerbundMaster.tsx`, `VerbundSlave.tsx`, `VerbundTeile.tsx` (neu) | Oberfläche |
| `electron.vite.config.ts` | `@jm/master-link` in `internalPackages` |
| `Header.tsx`, `SettingsModal.tsx`, `App.tsx` | Einbindung |
| `test/selftest.ts`, `test/verbund.test.ts` (neu) | Tests |
| `package.json` | devDeps `@jm/master-link`, `tsx`; Skript `selftest:verbund` |

**Sonstiges**
- `.github/workflows/ci-checks.yml`: Job „Selbsttests“ (Node 22)
- `docs/suite-verbund.md` (neu): Handbuch für Bediener
- `docs/README.md`: Link auf das Handbuch im Doku-Index
- Spec: zwei Zeilennummern berichtigen

---

## Aufgabe 1: Paket-Gerüst, Fristen, Kopplungscode

**Files:**
- Create: `packages/master-link/package.json`, `packages/master-link/tsconfig.json`
- Create: `packages/master-link/src/fristen.ts`, `packages/master-link/src/code.ts`, `packages/master-link/src/index.ts`
- Create: `packages/master-link/test/helfer.ts`, `packages/master-link/test/code.test.ts`, `packages/master-link/test/selftest.ts`
- Modify: `package-lock.json` (per `npm install`)

**Interfaces:**
- Produces:
  - `Fristen`, `STANDARD_FRISTEN`, `fristen(teil?: Partial<Fristen>): Fristen`
  - `GRENZEN` (`vorAnmeldung`, `nachAnmeldung`, `maxUnangemeldet`, `ratenLimit`, `maxFehlversuche`, `maxNamenLaenge`)
  - `MASTER_PORT`, `SUITE_ORDNER`, `kuerzeName(name: string): string`
  - `CODE_ALPHABET`, `CODE_LAENGE`, `erzeugeCode(zufall?)`, `zeigeCode(code)`, `normalisiereCode(eingabe): CodePruefung`
  - Testhilfen `pruefe`, `gleich`, `abschnitt`, `bilanz`, `tempOrdner`, `warte`, `bis`

- [ ] **Schritt 1: Paketdateien anlegen**

`packages/master-link/package.json`:
```json
{
  "name": "@jm/master-link",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Master-Link der JM Production Suite: Rechner koppeln (Code + Ed25519), Master finden (mDNS je Netzwerkkarte), Status über das Netz. Reines Node, ohne Electron.",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "selftest": "tsx test/selftest.ts",
    "selftest:mdns": "tsx test/mdns-echt.ts",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@jm/auth-core": "*",
    "bonjour-service": "^1.2.1"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "selfsigned": "^2.4.1",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

`packages/master-link/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Schritt 2: Testhilfen und Testläufer schreiben**

`packages/master-link/test/helfer.ts`:
```ts
// Testhilfen der Selbsttests (kein Framework, wie in @jm/auth-core).
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let bestanden = 0;
let fehlgeschlagen = 0;

export function pruefe(bedingung: boolean, text: string): void {
  if (bedingung) {
    bestanden++;
    console.log(`  ok  ${text}`);
  } else {
    fehlgeschlagen++;
    console.error(`FAIL  ${text}`);
  }
}

// FAIL-Zeilen landen auch in CI-Logs: private Schlüssel nur geschwärzt ausgeben. Verglichen wird ungeschwärzt.
const schwaerze = (feld: string, wert: unknown): unknown =>
  feld === 'privat' || (typeof wert === 'string' && wert.includes('PRIVATE KEY')) ? '«geschwärzt»' : wert;

export function gleich(ist: unknown, soll: unknown, text: string): void {
  const a = JSON.stringify(ist);
  const b = JSON.stringify(soll);
  pruefe(a === b, a === b ? text : `${text} (ist ${JSON.stringify(ist, schwaerze)}, soll ${JSON.stringify(soll, schwaerze)})`);
}

export function abschnitt(titel: string): void {
  console.log(`\n── ${titel}`);
}

export function bilanz(): never {
  console.log(`\n${bestanden} ok, ${fehlgeschlagen} fehlgeschlagen.`);
  process.exit(fehlgeschlagen === 0 ? 0 : 1);
}

export function tempOrdner(praefix = 'jmml-'): string {
  return mkdtempSync(join(tmpdir(), praefix));
}

export const warte = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Wartet, bis `bedingung()` wahr ist (true) oder `maxMs` verstrichen sind (false). */
export async function bis(bedingung: () => boolean, maxMs = 3000, schrittMs = 10): Promise<boolean> {
  const ende = Date.now() + maxMs;
  while (Date.now() < ende) {
    if (bedingung()) return true;
    await warte(schrittMs);
  }
  return bedingung();
}
```

`packages/master-link/test/selftest.ts`:
```ts
// Selbsttests @jm/master-link — npm run selftest -w @jm/master-link
// Jede Testdatei exportiert laufe(); die Reihenfolge ist fest, damit Ausgaben lesbar bleiben.
import { bilanz } from './helfer';
import { laufe as code } from './code.test';

for (const laufe of [code]) {
  await laufe();
}
bilanz();
```

- [ ] **Schritt 3: Den fehlschlagenden Test schreiben**

`packages/master-link/test/code.test.ts`:
```ts
import { randomBytes } from 'node:crypto';
import { abschnitt, gleich, pruefe } from './helfer';
import { CODE_ALPHABET, CODE_LAENGE, erzeugeCode, normalisiereCode, zeigeCode } from '../src/code';
import { GRENZEN, kuerzeName } from '../src/fristen';

/** Chi-Quadrat über die Zeichen von `anzahlCodes` Codes (31 Eimer). */
function chiQuadrat(erzeuge: () => string, anzahlCodes: number): number {
  const zaehler = new Array<number>(CODE_ALPHABET.length).fill(0);
  let n = 0;
  for (let i = 0; i < anzahlCodes; i++) {
    for (const z of erzeuge()) {
      zaehler[CODE_ALPHABET.indexOf(z)]++;
      n++;
    }
  }
  const erwartet = n / CODE_ALPHABET.length;
  return zaehler.reduce((s, x) => s + (x - erwartet) ** 2 / erwartet, 0);
}

export async function laufe(): Promise<void> {
  abschnitt('Code');
  gleich(CODE_ALPHABET.length, 31, 'Alphabet hat 31 Zeichen');
  pruefe(!/[01ILO]/.test(CODE_ALPHABET), 'Alphabet ohne Verwechsler 0 1 I L O');

  const c = erzeugeCode();
  gleich(c.length, CODE_LAENGE, 'Code hat 10 Zeichen');
  pruefe([...c].every((z) => CODE_ALPHABET.includes(z)), 'Code nur aus dem Alphabet');
  gleich(zeigeCode('K7QXM3PRTH'), 'K7QXM-3PRTH', 'Anzeige mit Bindestrich in der Mitte');

  gleich(normalisiereCode('k7qxm-3prth'), { ok: true, code: 'K7QXM3PRTH' }, 'klein + Bindestrich wird normalisiert');
  gleich(normalisiereCode(' K7QXM 3PRTH '), { ok: true, code: 'K7QXM3PRTH' }, 'Leerzeichen fallen weg');
  gleich(normalisiereCode('K7QXO3PRTH'), { ok: false, grund: 'zeichen', zeichen: 'O' }, 'O wird lokal als fremdes Zeichen gemeldet');
  gleich(normalisiereCode('k7qxm3prtl'), { ok: false, grund: 'zeichen', zeichen: 'l' }, 'Originalschreibweise wird gemeldet');
  gleich(normalisiereCode('K7QXM'), { ok: false, grund: 'laenge', laenge: 5 }, 'zu kurz → Länge');
  gleich(normalisiereCode('K7QXM3PRTHA'), { ok: false, grund: 'laenge', laenge: 11 }, 'zu lang → Länge');
  gleich(normalisiereCode('K7QXM3PRTß'), { ok: false, grund: 'zeichen', zeichen: 'ß' }, 'ß (Großschreibung „SS“) ist kein Codezeichen');
  gleich(normalisiereCode('K7QXM3PRTﬆ'), { ok: false, grund: 'zeichen', zeichen: 'ﬆ' }, 'Ligatur ﬆ (groß „ST“) ist kein Codezeichen');

  // Verteilung: fair (randomInt) besteht χ² < 80 (df = 30, p ≈ 1e-6), die typische
  // Verzerrung randomBytes % 31 fällt durch (gemessen: min. χ² 242 in 50 Läufen).
  const fair = chiQuadrat(() => erzeugeCode(), 10_000);
  pruefe(fair < 80, `Verteilung fair: χ² = ${fair.toFixed(1)} < 80`);
  const verzerrt = chiQuadrat(() => erzeugeCode((max) => randomBytes(1)[0] % max), 10_000);
  pruefe(verzerrt > 80, `Gegenprobe randomBytes % 31 fällt durch: χ² = ${verzerrt.toFixed(1)} > 80`);

  abschnitt('Namen');
  gleich(kuerzeName('  Regie-PC  '), 'Regie-PC', 'Name wird getrimmt');
  gleich(kuerzeName(''), 'Unbenannt', 'leerer Name → „Unbenannt“');
  const lang = 'Ü'.repeat(80);
  gleich([...kuerzeName(lang)].length, GRENZEN.maxNamenLaenge, 'langer Name auf 60 Zeichen gekürzt');
  const emoji = '🎬'.repeat(70);
  gleich([...kuerzeName(emoji)].length, 60, 'Emoji werden als ganze Zeichen gezählt');
}
```

- [ ] **Schritt 4: Test laufen lassen und Fehlschlag sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts`
Expected: FAIL mit `Cannot find module '../src/code'`

- [ ] **Schritt 5: `fristen.ts` und `code.ts` schreiben**

`packages/master-link/src/fristen.ts`:
```ts
// Alle Zeiten und Grenzen des Master-Links an EINER Stelle (Spec 3.2, 4.5, 5.1, 6.3, 7.1).
// Jede Frist ist einstellbar, damit die Selbsttests mit echten, kurzen Zeiten
// laufen statt mit einer vorgetäuschten Uhr.

export interface Fristen {
  /** TCP-Aufbau je Kandidat. */
  tcpMs: number;
  /** Ab TCP 'connect' bis 'hallo' empfangen (TLS inklusive). */
  tlsHalloMs: number;
  /** Ab Senden von 'anmelden'/'teilnehmer' bis 'angemeldet'. */
  angemeldetMs: number;
  /** Slave: ab Senden von 'koppeln' bis 'gekoppelt'/'abgelehnt' — hart (Spec 3.3). */
  koppelnMs: number;
  pulsMs: number;
  /** Ohne jede Zeile so lange → getrennt. */
  stilleMs: number;
  /** tls.createServer handshakeTimeout. */
  handshakeMs: number;
  /** Master: ab TCP-Annahme bis anmelden/koppeln. */
  anmeldefristMs: number;
  codeGueltigMs: number;
  suchrundeMs: number;
  rueckzugBasisMs: number;
  rueckzugMaxMs: number;
  zertifikatWiederholMs: number;
  protokollWiederholMs: number;
  ersetztWiederholMs: number;
  lastMinMs: number;
  ratenFensterMs: number;
  dateiPruefMs: number;
  kartenPruefMs: number;
  gesehenSchreibMs: number;
}

export const STANDARD_FRISTEN: Fristen = {
  tcpMs: 3000,
  tlsHalloMs: 5000,
  angemeldetMs: 10_000,
  koppelnMs: 10_000,
  pulsMs: 10_000,
  stilleMs: 25_000,
  handshakeMs: 10_000,
  anmeldefristMs: 10_000,
  codeGueltigMs: 120_000,
  suchrundeMs: 1500,
  rueckzugBasisMs: 1000,
  rueckzugMaxMs: 10_000,
  zertifikatWiederholMs: 30_000,
  protokollWiederholMs: 60_000,
  ersetztWiederholMs: 60_000,
  lastMinMs: 5000,
  ratenFensterMs: 60_000,
  dateiPruefMs: 5000,
  kartenPruefMs: 10_000,
  gesehenSchreibMs: 60_000,
};

export function fristen(teil: Partial<Fristen> = {}): Fristen {
  return { ...STANDARD_FRISTEN, ...teil };
}

export const GRENZEN = {
  vorAnmeldung: 4 * 1024,
  nachAnmeldung: 1024 * 1024,
  maxUnangemeldet: 64,
  ratenLimit: 20,
  maxFehlversuche: 5,
  /** mDNS-TXT ≤ 255 Byte je Eintrag: 60 Zeichen à ≤ 4 Byte + "name=" passen. */
  maxNamenLaenge: 60,
} as const;

export const MASTER_PORT = 8738;
export const SUITE_ORDNER = 'JM Production Suite';

/** Anzeigename säubern: trimmen, auf 60 ganze Zeichen kürzen, nie leer. */
export function kuerzeName(name: string): string {
  const zeichen = [...name.trim()].slice(0, GRENZEN.maxNamenLaenge);
  return zeichen.length > 0 ? zeichen.join('') : 'Unbenannt';
}
```

`packages/master-link/src/code.ts`:
```ts
import { randomInt } from 'node:crypto';

// Kopplungscode (Spec 3.2): 10 Zeichen aus 31 ohne Verwechsler (≈ 2^49,5).
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LAENGE = 10;
const ZEICHEN = new Set(CODE_ALPHABET);

/** `zufall(max)` liefert eine ganze Zahl in [0, max) — Vorgabe crypto.randomInt (ohne Modulo-Verzerrung). */
export function erzeugeCode(zufall: (max: number) => number = randomInt): string {
  let code = '';
  for (let i = 0; i < CODE_LAENGE; i++) code += CODE_ALPHABET[zufall(CODE_ALPHABET.length)];
  return code;
}

export function zeigeCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

export type CodePruefung =
  | { ok: true; code: string }
  | { ok: false; grund: 'zeichen'; zeichen: string }
  | { ok: false; grund: 'laenge'; laenge: number };

/** Verzeihende Eingabe: Groß/klein egal, Leerzeichen und Bindestriche fallen weg. */
export function normalisiereCode(eingabe: string): CodePruefung {
  let code = '';
  for (const zeichen of eingabe.replace(/[\s-]/g, '')) {
    const gross = zeichen.toUpperCase();
    // gross.length === 1: „ß“ → „SS“ oder „ﬆ“ → „ST“ dürfen nicht als zwei Codezeichen durchgehen.
    if (gross.length !== 1 || !ZEICHEN.has(gross)) return { ok: false, grund: 'zeichen', zeichen };
    code += gross;
  }
  if (code.length !== CODE_LAENGE) return { ok: false, grund: 'laenge', laenge: code.length };
  return { ok: true, code };
}
```

`packages/master-link/src/index.ts`:
```ts
// @jm/master-link — öffentliche API (Spec docs/superpowers/specs/2026-09-30-master-link-teil1-design.md).
export * from './fristen';
export * from './code';
```

- [ ] **Schritt 6: Installieren und Test grün sehen**

Run:
```bash
npm install
cd packages/master-link && npx tsx test/selftest.ts && npx tsc --noEmit -p tsconfig.json
```
Expected: `N ok, 0 fehlgeschlagen.`, tsc ohne Ausgabe. `git status --short` zeigt `package-lock.json` geändert (neuer Workspace `packages/master-link`).

- [ ] **Schritt 7: Commit**

```bash
git add packages/master-link/package.json packages/master-link/tsconfig.json packages/master-link/src/fristen.ts packages/master-link/src/code.ts packages/master-link/src/index.ts packages/master-link/test/helfer.ts packages/master-link/test/selftest.ts packages/master-link/test/code.test.ts package-lock.json
git status --short
git commit -m "feat(master-link): Paketgerüst, Fristen und Kopplungscode" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aufgabe 2: Beweise und Schlüssel (`beweis.ts`)

**Files:**
- Create: `packages/master-link/src/beweis.ts`, `packages/master-link/test/zertifikate.ts`, `packages/master-link/test/beweis.test.ts`
- Modify: `packages/master-link/src/index.ts`, `packages/master-link/test/selftest.ts`

**Interfaces:**
- Consumes: `certFingerprint` aus `@jm/auth-core`
- Produces:
  - `KoppelDaten { fp; ns; nc; rechnerId; schluessel }`
  - `slaveBeweis(code, d)`, `masterBeweis(code, d, masterId)`, `gleicherBeweis(erwartet, erhalten: unknown)`
  - `Schluesselpaar { privat; oeffentlich }`, `erzeugeSchluesselpaar()`, `istEd25519Oeffentlich(v: unknown)`, `istEd25519Privat(v: unknown)`
  - `signiereAnmeldung(privat, fp, ns, rechnerId)`, `pruefeAnmeldung(oeffentlich, fp, ns, rechnerId, signatur: unknown)`
  - `derZuPem(der: Buffer)`, `fingerprintVonPem(pem)`, `kurzFingerprint(fp)`
  - Testhilfen: `erzeugeTestZertifikat(): { cert; key }` (nur Zertifikate, die `X509Certificate` und `createSecureContext` annehmen), `zertifikatMitGueltigkeit(von: Date, bis: Date): { cert; key }`

- [ ] **Schritt 1: Testzertifikate-Helfer schreiben**

`packages/master-link/test/zertifikate.ts`:
```ts
// Testzertifikate — KEIN Secret, nur für die Selbsttests.
import { generateKeyPairSync, X509Certificate } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { createSecureContext } from 'node:tls';
import selfsigned from 'selfsigned';

export interface TestZertifikat {
  cert: string;
  key: string;
}

/** Wie die Master-Identität (Spec 3.5): 2048/sha256, 10 Jahre, zurückdatiert. */
export function erzeugeTestZertifikat(): TestZertifikat {
  // GEMESSEN: selfsigned 2.4.1/node-forge 1.4.0 kodiert eine Seriennummer 00 00 xx (≈1/65536) nicht minimal;
  // X509Certificate und createSecureContext werfen dann ERR_OSSL_ASN1_ILLEGAL_PADDING → neu erzeugen.
  for (let versuch = 1; ; versuch++) {
    const p = selfsigned.generate([{ name: 'commonName', value: 'jm-master-link' }], {
      days: 3650,
      keySize: 2048,
      algorithm: 'sha256',
      notBeforeDate: new Date(Date.now() - 365 * 24 * 3600 * 1000),
    });
    try {
      new X509Certificate(p.cert);
      createSecureContext({ key: p.private, cert: p.cert });
      return { cert: p.cert, key: p.private };
    } catch (e) {
      if (versuch >= 5) throw e;
    }
  }
}

// selfsigned verweigert notBefore in der Zukunft (gemessen) → für 'uhr'-Tests direkt
// node-forge, das als Abhängigkeit von selfsigned ohnehin installiert ist.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const forge: any = require(require.resolve('node-forge', { paths: [dirname(require.resolve('selfsigned'))] }));

export function zertifikatMitGueltigkeit(von: Date, bis: Date): TestZertifikat {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
  const c = forge.pki.createCertificate();
  c.publicKey = forge.pki.publicKeyFromPem(publicKey);
  c.serialNumber = '01';
  c.validity.notBefore = von;
  c.validity.notAfter = bis;
  const attrs = [{ name: 'commonName', value: 'jm-master-link' }];
  c.setSubject(attrs);
  c.setIssuer(attrs);
  c.sign(forge.pki.privateKeyFromPem(privateKey), forge.md.sha256.create());
  return { cert: forge.pki.certificateToPem(c), key: privateKey };
}
```

- [ ] **Schritt 2: Den fehlschlagenden Test schreiben**

`packages/master-link/test/beweis.test.ts`:
```ts
import { createHmac, generateKeyPairSync, sign, X509Certificate } from 'node:crypto';
import { certFingerprint } from '@jm/auth-core';
import { abschnitt, gleich, pruefe } from './helfer';
import { erzeugeTestZertifikat } from './zertifikate';
import {
  derZuPem, erzeugeSchluesselpaar, fingerprintVonPem, gleicherBeweis, istEd25519Oeffentlich, istEd25519Privat,
  kurzFingerprint, masterBeweis, pruefeAnmeldung, signiereAnmeldung, slaveBeweis, type KoppelDaten,
} from '../src/beweis';

export async function laufe(): Promise<void> {
  abschnitt('Beweise (HMAC)');
  const d: KoppelDaten = { fp: 'ab'.repeat(32), ns: '11'.repeat(16), nc: '22'.repeat(16), rechnerId: 'r-1', schluessel: 'P' };
  const code = 'K7QXM3PRTH';
  const erwartetSlave = createHmac('sha256', code)
    .update(`jm-master-link/1/koppeln/slave|${d.fp}|${d.ns}|${d.nc}|${d.rechnerId}|${d.schluessel}`)
    .digest('hex');
  gleich(slaveBeweis(code, d), erwartetSlave, 'Slave-Beweis = HMAC über die Felder in Spec-Reihenfolge');
  const erwartetMaster = createHmac('sha256', code)
    .update(`jm-master-link/1/koppeln/master|${d.fp}|${d.ns}|${d.nc}|${d.rechnerId}|${d.schluessel}|M-1`)
    .digest('hex');
  gleich(masterBeweis(code, d, 'M-1'), erwartetMaster, 'Master-Beweis enthält masterId');
  pruefe(slaveBeweis(code, d) !== masterBeweis(code, d, 'M-1'), 'Slave- und Master-Beweis unterscheiden sich');
  pruefe(slaveBeweis(code, { ...d, fp: 'cd'.repeat(32) }) !== erwartetSlave, 'anderer Fingerprint → anderer Beweis (Mittelsmann)');
  pruefe(slaveBeweis(code, { ...d, schluessel: 'Q' }) !== erwartetSlave, 'anderer Schlüssel → anderer Beweis');
  pruefe(gleicherBeweis(erwartetSlave, erwartetSlave), 'gleicherBeweis: gleicher Wert → true');
  pruefe(!gleicherBeweis(erwartetSlave, erwartetSlave.slice(0, 10)), 'gleicherBeweis: falsche Länge → false');
  pruefe(!gleicherBeweis(erwartetSlave, 'zz'.repeat(32)), 'gleicherBeweis: kein Hex → false');
  pruefe(!gleicherBeweis(erwartetSlave, 42), 'gleicherBeweis: kein String → false');

  abschnitt('Ed25519');
  const paar = erzeugeSchluesselpaar();
  gleich(paar.oeffentlich.length, 60, 'öffentlicher Schlüssel SPKI-DER base64 = 60 Zeichen');
  gleich(paar.privat.length, 64, 'privater Schlüssel PKCS8-DER base64 = 64 Zeichen');
  pruefe(istEd25519Oeffentlich(paar.oeffentlich), 'eigener öffentlicher Schlüssel ist Ed25519');
  const sig = signiereAnmeldung(paar.privat, d.fp, d.ns, 'r-1');
  pruefe(pruefeAnmeldung(paar.oeffentlich, d.fp, d.ns, 'r-1', sig), 'Signatur prüft');
  pruefe(!pruefeAnmeldung(paar.oeffentlich, d.fp, '33'.repeat(16), 'r-1', sig), 'alte Signatur mit neuer Nonce → false (keine Wiederholung)');
  pruefe(!pruefeAnmeldung(paar.oeffentlich, 'cd'.repeat(32), d.ns, 'r-1', sig), 'Signatur gilt nicht bei anderem Master (fp)');
  pruefe(!pruefeAnmeldung(paar.oeffentlich, d.fp, d.ns, 'r-2', sig), 'Signatur gilt nicht für andere rechnerId');
  pruefe(!pruefeAnmeldung(erzeugeSchluesselpaar().oeffentlich, d.fp, d.ns, 'r-1', sig), 'fremder Schlüssel → false');
  pruefe(!pruefeAnmeldung(paar.oeffentlich, d.fp, d.ns, 'r-1', 'kurz'), 'kaputte Signatur → false, kein Wurf');
  pruefe(!pruefeAnmeldung('AAAA', d.fp, d.ns, 'r-1', sig), 'Müll-Schlüssel → false, kein Wurf');
  pruefe(!pruefeAnmeldung(paar.oeffentlich, d.fp, d.ns, 'r-1', undefined), 'fehlende Signatur → false');
  const rsaPaar = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rsa = rsaPaar.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  pruefe(!istEd25519Oeffentlich(rsa), 'RSA-SPKI wird nicht als Ed25519 angenommen');
  // Mit einer ECHTEN RSA-Signatur über denselben Text — ohne Typzwang ginge verify(null) durch (gemessen).
  const rsaSig = sign(null, Buffer.from(`jm-master-link/1/anmelden|${d.fp}|${d.ns}|r-1`, 'utf8'), rsaPaar.privateKey).toString('base64');
  pruefe(!pruefeAnmeldung(rsa, d.fp, d.ns, 'r-1', rsaSig), 'RSA-Schlüssel mit gültiger RSA-Signatur → false (Typ erzwungen)');
  pruefe(!istEd25519Oeffentlich('QUJD|RA=='), 'Nicht-base64-Zeichen → false');
  // Node überliest „|“ beim Dekodieren (gemessen): nur die base64-Prüfung weist das ab.
  pruefe(!istEd25519Oeffentlich(`${paar.oeffentlich.slice(0, 20)}|${paar.oeffentlich.slice(20)}`), 'gültiger Schlüssel mit eingeschobenem „|“ → false');
  pruefe(istEd25519Privat(paar.privat), 'eigener privater Schlüssel ist Ed25519');
  // GEMESSEN: 'AAAA' und abgeschnittene Schlüssel lassen signiereAnmeldung werfen; RSA-PKCS8 signiert, aber nicht Ed25519.
  const rsaPrivat = rsaPaar.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  gleich([istEd25519Privat('AAAA'), istEd25519Privat(paar.privat.slice(0, 40)), istEd25519Privat(rsaPrivat), istEd25519Privat(undefined)],
    [false, false, false, false], 'privat: Müll, abgeschnitten, RSA-PKCS8, kein Text → kein Ed25519');

  abschnitt('Zertifikat und Fingerprint');
  const z = erzeugeTestZertifikat();
  const x = new X509Certificate(z.cert);
  const pem = derZuPem(x.raw);
  gleich(fingerprintVonPem(pem), certFingerprint(z.cert), 'PEM aus DER hat denselben Fingerprint');
  pruefe(pem.startsWith('-----BEGIN CERTIFICATE-----\n') && !pem.includes('\r'), 'PEM aus DER mit LF');
  gleich(kurzFingerprint(fingerprintVonPem(pem)).length, 16, 'Kurz-Fingerprint = 16 Zeichen');
  pruefe(new Date(x.validFrom).getTime() < Date.now() - 300 * 24 * 3600 * 1000, 'Testzertifikat ist zurückdatiert');
  gleich(x.publicKey.asymmetricKeyDetails?.modulusLength, 2048, 'Testzertifikat RSA-2048');
}
```

In `test/selftest.ts` die Liste erweitern:
```ts
import { laufe as code } from './code.test';
import { laufe as beweis } from './beweis.test';

for (const laufe of [code, beweis]) {
```

- [ ] **Schritt 3: Test laufen lassen und Fehlschlag sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts`
Expected: FAIL mit `Cannot find module '../src/beweis'`

- [ ] **Schritt 4: `beweis.ts` schreiben**

`packages/master-link/src/beweis.ts`:
```ts
import {
  createHmac, createPrivateKey, createPublicKey, generateKeyPairSync, sign, timingSafeEqual, verify,
  X509Certificate,
} from 'node:crypto';
import { certFingerprint } from '@jm/auth-core';

// Kopplungsbeweise (Spec 3.3) und Anmeldung per Ed25519 (Spec 3.4).
// Die Trennzeichen „|“ sind eindeutig: kein Feld enthält „|“ (hex, base64, UUID).

const PRAEFIX = 'jm-master-link/1';

export interface KoppelDaten {
  /** SHA-256-Fingerprint: beim Slave der GESEHENE, beim Master der eigene. */
  fp: string;
  ns: string;
  nc: string;
  rechnerId: string;
  /** Öffentlicher Schlüssel des Slaves (SPKI-DER base64). */
  schluessel: string;
}

function hmac(code: string, teile: string[]): string {
  return createHmac('sha256', code).update(teile.join('|')).digest('hex');
}

export function slaveBeweis(code: string, d: KoppelDaten): string {
  return hmac(code, [`${PRAEFIX}/koppeln/slave`, d.fp, d.ns, d.nc, d.rechnerId, d.schluessel]);
}

export function masterBeweis(code: string, d: KoppelDaten, masterId: string): string {
  return hmac(code, [`${PRAEFIX}/koppeln/master`, d.fp, d.ns, d.nc, d.rechnerId, d.schluessel, masterId]);
}

/** Vergleich in konstanter Zeit; alles außer gleich langem Hex ist falsch. */
export function gleicherBeweis(erwartet: string, erhalten: unknown): boolean {
  if (typeof erhalten !== 'string' || erhalten.length !== erwartet.length || !/^[0-9a-f]+$/.test(erhalten)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(erwartet, 'hex'), Buffer.from(erhalten, 'hex'));
}

export interface Schluesselpaar {
  /** PKCS8-DER base64. */
  privat: string;
  /** SPKI-DER base64. */
  oeffentlich: string;
}

export function erzeugeSchluesselpaar(): Schluesselpaar {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    privat: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    oeffentlich: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
  };
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function oeffentlicherSchluessel(oeffentlich: unknown) {
  if (typeof oeffentlich !== 'string' || !BASE64.test(oeffentlich)) return null;
  try {
    const k = createPublicKey({ key: Buffer.from(oeffentlich, 'base64'), format: 'der', type: 'spki' });
    // GEMESSEN: createPublicKey nimmt auch RSA-SPKI an, und verify(null) klappt dann auch mit RSA.
    return k.asymmetricKeyType === 'ed25519' ? k : null;
  } catch {
    return null;
  }
}

export function istEd25519Oeffentlich(oeffentlich: unknown): boolean {
  return oeffentlicherSchluessel(oeffentlich) !== null;
}

function anmeldeText(fp: string, ns: string, rechnerId: string): Buffer {
  return Buffer.from([`${PRAEFIX}/anmelden`, fp, ns, rechnerId].join('|'), 'utf8');
}

function privaterSchluessel(privat: string) {
  return createPrivateKey({ key: Buffer.from(privat, 'base64'), format: 'der', type: 'pkcs8' });
}

/** Dieselbe Dekodierung wie signiereAnmeldung: was hier besteht, lässt das Signieren nicht werfen. */
export function istEd25519Privat(privat: unknown): boolean {
  if (typeof privat !== 'string') return false;
  try {
    // GEMESSEN: 'AAAA'/abgeschnitten → createPrivateKey wirft; RSA-/EC-PKCS8 lädt und signiert, aber nicht Ed25519.
    return privaterSchluessel(privat).asymmetricKeyType === 'ed25519';
  } catch {
    return false;
  }
}

export function signiereAnmeldung(privat: string, fp: string, ns: string, rechnerId: string): string {
  return sign(null, anmeldeText(fp, ns, rechnerId), privaterSchluessel(privat)).toString('base64');
}

/** Wirft nie: jeder Fehler (Müll-Schlüssel, falscher Typ, kaputte Signatur) → false. */
export function pruefeAnmeldung(
  oeffentlich: string,
  fp: string,
  ns: string,
  rechnerId: string,
  signatur: unknown,
): boolean {
  if (typeof signatur !== 'string' || !BASE64.test(signatur)) return false;
  const schluessel = oeffentlicherSchluessel(oeffentlich);
  if (!schluessel) return false;
  try {
    return verify(null, anmeldeText(fp, ns, rechnerId), schluessel, Buffer.from(signatur, 'base64'));
  } catch {
    return false;
  }
}

/** DER (getPeerCertificate().raw) → PEM mit LF. */
export function derZuPem(der: Buffer): string {
  return new X509Certificate(der).toString();
}

export function fingerprintVonPem(pem: string): string {
  return certFingerprint(pem);
}

export function kurzFingerprint(fp: string): string {
  return fp.slice(0, 16);
}
```

`src/index.ts` ergänzen:
```ts
export * from './beweis';
```

- [ ] **Schritt 5: Test grün sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts && npx tsc --noEmit -p tsconfig.json`
Expected: `… 0 fehlgeschlagen.`, tsc ohne Ausgabe.

- [ ] **Schritt 6: Commit**

```bash
git add packages/master-link/src/beweis.ts packages/master-link/src/index.ts packages/master-link/test/zertifikate.ts packages/master-link/test/beweis.test.ts packages/master-link/test/selftest.ts
git status --short
git commit -m "feat(master-link): Kopplungsbeweise und Ed25519-Anmeldung" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aufgabe 3: Rahmen und Verbindung

**Files:**
- Create: `packages/master-link/src/rahmen.ts`, `packages/master-link/src/verbindung.ts`
- Create: `packages/master-link/test/tlspaar.ts`, `packages/master-link/test/rahmen.test.ts`
- Modify: `packages/master-link/src/index.ts`, `packages/master-link/test/selftest.ts`

**Interfaces:**
- Produces:
  - `PROTOKOLL = 1`, `Grund`, `TeilnehmerInfo`, `Nachricht`, `Dekodiert`
  - `kodiere(n)`, `dekodiere(zeile)`, `ZeileZuLang`, `ZeilenLeser`
  - `Verbindung`: `socket`, `adresse`, `offen`, `sende`, `setzeGrenze`, `schliesse`, Ereignisse `nachricht`, `unbekannt`, `ende`
  - `ohneV6Praefix`
  - Testhilfe `tlsPaar(z)` → `{ server: TLSSocket; client: TLSSocket; schliesse(): void }`

- [ ] **Schritt 1: TLS-Paar-Helfer schreiben**

`packages/master-link/test/tlspaar.ts`:
```ts
import { connect, createServer, type TLSSocket } from 'node:tls';
import type { AddressInfo } from 'node:net';
import type { TestZertifikat } from './zertifikate';

/** Ein verbundenes TLS-Paar auf 127.0.0.1 (Client ohne Pin — nur für Rahmen-Tests). */
export async function tlsPaar(z: TestZertifikat): Promise<{ server: TLSSocket; client: TLSSocket; schliesse(): void }> {
  const srv = createServer({ key: z.key, cert: z.cert });
  const serverSeite = new Promise<TLSSocket>((r) => srv.once('secureConnection', r));
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as AddressInfo).port;
  const client = connect({ host: '127.0.0.1', port, rejectUnauthorized: false });
  await new Promise<void>((r) => client.once('secureConnect', () => r()));
  const server = await serverSeite;
  return {
    server,
    client,
    schliesse: () => {
      client.destroy();
      server.destroy();
      srv.close();
    },
  };
}
```

- [ ] **Schritt 2: Den fehlschlagenden Test schreiben**

`packages/master-link/test/rahmen.test.ts`:
```ts
import { abschnitt, bis, gleich, pruefe } from './helfer';
import { erzeugeTestZertifikat } from './zertifikate';
import { tlsPaar } from './tlspaar';
import { dekodiere, kodiere, PROTOKOLL, ZeileZuLang, ZeilenLeser, type Nachricht } from '../src/rahmen';
import { ohneV6Praefix, Verbindung } from '../src/verbindung';

export async function laufe(): Promise<void> {
  abschnitt('Rahmen: Nachrichten');
  gleich(PROTOKOLL, 1, 'Protokoll 1');
  const teilnehmer = { art: 'tool' as const, appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 42 };
  const alle: Nachricht[] = [
    { t: 'hallo', protokoll: 1, masterId: 'm', name: 'Regie-PC', nonce: 'n' },
    { t: 'koppeln', protokoll: 1, rechnerId: 'r', rechnerName: 'B', nonce: 'n', schluessel: 'P', beweis: 'b' },
    { t: 'gekoppelt', masterId: 'm', name: 'Regie-PC', beweis: 'b', adressen: ['10.0.0.1'] },
    { t: 'anmelden', protokoll: 1, rechnerId: 'r', rechnerName: 'B', signatur: 's', teilnehmer },
    { t: 'teilnehmer', teilnehmer },
    { t: 'angemeldet', adressen: [], suite: '0.12.0' },
    { t: 'abgelehnt', grund: 'code-falsch', rest: 3 },
    { t: 'abgelehnt', grund: 'protokoll', master: 1, suite: '0.12.0' },
    { t: 'puls' },
  ];
  for (const n of alle) {
    const z = kodiere(n);
    pruefe(z.endsWith('\n') && !z.slice(0, -1).includes('\n'), `${n.t}: genau eine Zeile`);
    gleich(dekodiere(z.slice(0, -1)), { art: 'nachricht', n }, `${n.t}: hin und zurück`);
  }
  gleich(dekodiere('{"t":"neu-in-teil-2","x":1}'), { art: 'unbekannt', t: 'neu-in-teil-2' }, 'unbekannter Typ → unbekannt (wird ignoriert)');
  gleich(dekodiere('{"t":"constructor"}'), { art: 'unbekannt', t: 'constructor' }, 't = "constructor" ist kein Prüfer (Map statt Objekt)');
  gleich(dekodiere('{"t":"__proto__"}'), { art: 'unbekannt', t: '__proto__' }, 't = "__proto__" ist kein Prüfer');
  gleich(dekodiere('nicht json'), { art: 'kaputt' }, 'kein JSON → kaputt');
  gleich(dekodiere('[1,2]'), { art: 'kaputt' }, 'Array → kaputt');
  gleich(dekodiere('{"x":1}'), { art: 'kaputt' }, 'ohne t → kaputt');
  gleich(dekodiere('{"t":"hallo","protokoll":"1","masterId":"m","name":"n","nonce":"x"}'), { art: 'kaputt' }, 'falscher Feldtyp → kaputt');
  gleich(dekodiere('{"t":"abgelehnt","grund":"erfunden"}'), { art: 'kaputt' }, 'unbekannter Grund → kaputt');
  gleich(dekodiere('{"t":"anmelden","protokoll":1,"rechnerId":"r","rechnerName":"B","signatur":"s","teilnehmer":{"art":"x","appId":"a","name":"n","version":"v","pid":1}}'), { art: 'kaputt' }, 'Teilnehmer mit falscher Art → kaputt');

  abschnitt('Rahmen: Zeilenleser');
  const l = new ZeilenLeser(16);
  gleich(l.fuettere(Buffer.from('{"a"')), [], 'unvollständige Zeile → nichts');
  gleich(l.fuettere(Buffer.from(':1}\n{"b":2}\n')), ['{"a":1}', '{"b":2}'], 'zwei Zeilen über zwei Stücke');
  const e = Buffer.from('é\n', 'utf8');
  gleich([...l.fuettere(e.subarray(0, 1)), ...l.fuettere(e.subarray(1))], ['é'], 'UTF-8-Zeichen über Stückgrenze');
  let geworfen = false;
  try { l.fuettere(Buffer.from('x'.repeat(17))); } catch (f) { geworfen = f instanceof ZeileZuLang; }
  pruefe(geworfen, 'unvollständige Zeile über der Grenze → ZeileZuLang');
  const l2 = new ZeilenLeser(4);
  gleich(l2.fuettere(Buffer.from('abcd\n')), ['abcd'], 'Zeile genau an der Grenze ist erlaubt');
  l2.setzeGrenze(100);
  gleich(l2.fuettere(Buffer.from('x'.repeat(50) + '\n')), ['x'.repeat(50)], 'setzeGrenze hebt die Grenze an');

  abschnitt('Verbindung über echtes TLS');
  const z = erzeugeTestZertifikat();
  {
    const p = await tlsPaar(z);
    const v = new Verbindung(p.server, 4096);
    const empfangen: Nachricht[] = [];
    const unbekannt: string[] = [];
    v.on('nachricht', (n: Nachricht) => empfangen.push(n));
    v.on('unbekannt', (t: string) => unbekannt.push(t));
    p.client.write(kodiere({ t: 'puls' }) + '{"t":"zukunft"}\n');
    await bis(() => empfangen.length === 1 && unbekannt.length === 1);
    gleich(empfangen, [{ t: 'puls' }], 'Nachricht kommt an');
    gleich(unbekannt, ['zukunft'], 'unbekannter Typ als Ereignis');
    gleich(v.adresse, '127.0.0.1', 'Adresse ohne ::ffff:');
    // Über 127.0.0.1 kommt nie ein ::ffff:-Präfix an — deshalb die Funktion hier direkt.
    gleich([ohneV6Praefix('::ffff:10.0.0.5'), ohneV6Praefix('10.0.0.5'), ohneV6Praefix(undefined)], ['10.0.0.5', '10.0.0.5', ''],
      'ohneV6Praefix: IPv4-gemappte IPv6-Adresse → IPv4');
    let ende: Error | undefined | null = null;
    v.on('ende', (f?: Error) => { ende = f; });
    p.client.write('kaputt\n');
    await bis(() => ende !== null);
    pruefe(ende !== null && (ende as Error).message === 'rahmen', 'kaputte Zeile → ende("rahmen")');
    pruefe(p.server.destroyed, 'Socket nach kaputter Zeile zerstört');
    p.schliesse();
  }
  {
    const p = await tlsPaar(z);
    const v = new Verbindung(p.server, 4096);
    let ende: Error | undefined | null = null;
    v.on('ende', (f?: Error) => { ende = f; });
    p.client.write('x'.repeat(5000));
    await bis(() => ende !== null);
    pruefe(ende !== null && (ende as Error).message === 'rahmen', '4-KiB-Grenze überschritten → ende("rahmen")');
    p.schliesse();
  }
  {
    const p = await tlsPaar(z);
    const v = new Verbindung(p.server, 4096);
    v.setzeGrenze(1024 * 1024);
    const unbekannt: string[] = [];
    v.on('unbekannt', (t: string) => unbekannt.push(t));
    p.client.write(`{"t":"gross","x":"${'y'.repeat(100_000)}"}\n`);
    await bis(() => unbekannt.length === 1);
    gleich(unbekannt, ['gross'], 'nach setzeGrenze(1 MiB) kommen 100-KB-Zeilen durch');
    let geschlossen = false;
    v.on('ende', () => { geschlossen = true; });
    v.sende({ t: 'abgelehnt', grund: 'unbekannt' });
    v.schliesse();
    await bis(() => geschlossen);
    pruefe(geschlossen, 'schliesse() beendet die Verbindung');
    p.schliesse();
  }
}
```

In `test/selftest.ts` `rahmen` ergänzen (Import `import { laufe as rahmen } from './rahmen.test';`, Liste `[code, beweis, rahmen]`).

- [ ] **Schritt 3: Test laufen lassen und Fehlschlag sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts`
Expected: FAIL mit `Cannot find module '../src/rahmen'`

- [ ] **Schritt 4: `rahmen.ts` und `verbindung.ts` schreiben**

`packages/master-link/src/rahmen.ts`:
```ts
// Protokoll (Spec 6): eine Zeile = ein JSON-Objekt mit Pflichtfeld t.
// Unbekannte t werden ignoriert (Teil 2–4 ergänzen Nachrichten ohne Protokollwechsel);
// bekannte t mit falschen Feldern gelten als kaputt → Verbindung zu.

export const PROTOKOLL = 1;

export type Grund =
  | 'code-falsch' | 'code-ungueltig' | 'keine-kopplung-offen' | 'rechner-id'
  | 'unbekannt' | 'signatur' | 'protokoll' | 'ersetzt' | 'anmeldefrist' | 'last';

export interface TeilnehmerInfo {
  art: 'tool' | 'launcher';
  appId: string;
  name: string;
  version: string;
  pid: number;
}

export type Nachricht =
  | { t: 'hallo'; protokoll: number; masterId: string; name: string; nonce: string }
  | { t: 'koppeln'; protokoll: number; rechnerId: string; rechnerName: string; nonce: string; schluessel: string; beweis: string }
  | { t: 'gekoppelt'; masterId: string; name: string; beweis: string; adressen: string[] }
  | { t: 'anmelden'; protokoll: number; rechnerId: string; rechnerName: string; signatur: string; teilnehmer: TeilnehmerInfo }
  | { t: 'teilnehmer'; teilnehmer: TeilnehmerInfo }
  | { t: 'angemeldet'; adressen: string[]; suite: string }
  | { t: 'abgelehnt'; grund: Grund; rest?: number; master?: number; suite?: string }
  | { t: 'puls' };

export type Dekodiert = { art: 'nachricht'; n: Nachricht } | { art: 'unbekannt'; t: string } | { art: 'kaputt' };

export function kodiere(n: Nachricht): string {
  return `${JSON.stringify(n)}\n`;
}

const GRUENDE: ReadonlySet<string> = new Set<Grund>([
  'code-falsch', 'code-ungueltig', 'keine-kopplung-offen', 'rechner-id',
  'unbekannt', 'signatur', 'protokoll', 'ersetzt', 'anmeldefrist', 'last',
]);

type Objekt = Record<string, unknown>;
const istText = (v: unknown): v is string => typeof v === 'string';
const istZahl = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const istTextListe = (v: unknown): v is string[] => Array.isArray(v) && v.every(istText);
const optional = (v: unknown, p: (x: unknown) => boolean): boolean => v === undefined || p(v);

function istTeilnehmer(v: unknown): v is TeilnehmerInfo {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Objekt;
  return (o.art === 'tool' || o.art === 'launcher') && istText(o.appId) && o.appId.length > 0
    && istText(o.name) && istText(o.version) && istZahl(o.pid);
}

// Map statt Objekt-Literal: t = "constructor"/"__proto__" darf keinen Prüfer finden.
const PRUEFER = new Map<string, (o: Objekt) => boolean>([
  ['hallo', (o) => istZahl(o.protokoll) && istText(o.masterId) && istText(o.name) && istText(o.nonce)],
  ['koppeln', (o) => istZahl(o.protokoll) && istText(o.rechnerId) && istText(o.rechnerName)
    && istText(o.nonce) && istText(o.schluessel) && istText(o.beweis)],
  ['gekoppelt', (o) => istText(o.masterId) && istText(o.name) && istText(o.beweis) && istTextListe(o.adressen)],
  ['anmelden', (o) => istZahl(o.protokoll) && istText(o.rechnerId) && istText(o.rechnerName)
    && istText(o.signatur) && istTeilnehmer(o.teilnehmer)],
  ['teilnehmer', (o) => istTeilnehmer(o.teilnehmer)],
  ['angemeldet', (o) => istTextListe(o.adressen) && istText(o.suite)],
  ['abgelehnt', (o) => istText(o.grund) && GRUENDE.has(o.grund)
    && optional(o.rest, istZahl) && optional(o.master, istZahl) && optional(o.suite, istText)],
  ['puls', () => true],
]);

export function dekodiere(zeile: string): Dekodiert {
  let roh: unknown;
  try {
    roh = JSON.parse(zeile);
  } catch {
    return { art: 'kaputt' };
  }
  if (typeof roh !== 'object' || roh === null || Array.isArray(roh)) return { art: 'kaputt' };
  const o = roh as Objekt;
  if (!istText(o.t)) return { art: 'kaputt' };
  const pruefer = PRUEFER.get(o.t);
  if (!pruefer) return { art: 'unbekannt', t: o.t };
  return pruefer(o) ? { art: 'nachricht', n: o as unknown as Nachricht } : { art: 'kaputt' };
}

export class ZeileZuLang extends Error {
  constructor() {
    super('Zeile zu lang');
  }
}

/** Zerlegt einen Bytestrom in Zeilen; eine Zeile (auch eine unvollständige) über `grenze` Bytes wirft. */
export class ZeilenLeser {
  private grenze: number;
  private puffer: Buffer = Buffer.alloc(0);

  constructor(grenze: number) {
    this.grenze = grenze;
  }

  setzeGrenze(grenze: number): void {
    this.grenze = grenze;
  }

  fuettere(stueck: Buffer): string[] {
    this.puffer = this.puffer.length > 0 ? Buffer.concat([this.puffer, stueck]) : stueck;
    const zeilen: string[] = [];
    let start = 0;
    for (;;) {
      const nl = this.puffer.indexOf(0x0a, start);
      if (nl === -1) break;
      if (nl - start > this.grenze) throw new ZeileZuLang();
      zeilen.push(this.puffer.subarray(start, nl).toString('utf8'));
      start = nl + 1;
    }
    this.puffer = Buffer.from(this.puffer.subarray(start));
    if (this.puffer.length > this.grenze) throw new ZeileZuLang();
    return zeilen;
  }
}
```

`packages/master-link/src/verbindung.ts`:
```ts
import { EventEmitter } from 'node:events';
import type { TLSSocket } from 'node:tls';
import { dekodiere, kodiere, ZeilenLeser, type Nachricht } from './rahmen';

export function ohneV6Praefix(adresse: string | undefined): string {
  return (adresse ?? '').replace(/^::ffff:/, '');
}

/**
 * Ein TLS-Socket mit Zeilenrahmen. Ereignisse:
 *  - 'nachricht' (n: Nachricht)
 *  - 'unbekannt' (t: string)      — unbekannter Typ, wird ignoriert
 *  - 'ende' (fehler?: Error)       — genau einmal; Error('rahmen') bei kaputter/zu langer Zeile
 */
export class Verbindung extends EventEmitter {
  readonly socket: TLSSocket;
  readonly adresse: string;
  private readonly leser: ZeilenLeser;
  private beendet = false;

  constructor(socket: TLSSocket, grenze: number) {
    super();
    this.socket = socket;
    this.adresse = ohneV6Praefix(socket.remoteAddress);
    this.leser = new ZeilenLeser(grenze);
    socket.on('data', (d: Buffer) => this.aufDaten(d));
    socket.on('error', (e: Error) => this.beende(e));
    socket.on('close', () => this.beende());
  }

  get offen(): boolean {
    return !this.beendet;
  }

  private aufDaten(d: Buffer): void {
    if (this.beendet) return;
    let zeilen: string[];
    try {
      zeilen = this.leser.fuettere(d);
    } catch {
      this.brich();
      return;
    }
    for (const zeile of zeilen) {
      if (this.beendet) return;
      const r = dekodiere(zeile);
      if (r.art === 'kaputt') {
        this.brich();
        return;
      }
      if (r.art === 'unbekannt') this.emit('unbekannt', r.t);
      else this.emit('nachricht', r.n);
    }
  }

  private brich(): void {
    this.socket.destroy();
    this.beende(new Error('rahmen'));
  }

  private beende(fehler?: Error): void {
    if (this.beendet) return;
    this.beendet = true;
    this.emit('ende', fehler);
  }

  sende(n: Nachricht): void {
    if (!this.beendet && !this.socket.destroyed) this.socket.write(kodiere(n));
  }

  setzeGrenze(grenze: number): void {
    this.leser.setzeGrenze(grenze);
  }

  /** Gepufferte Zeilen (z. B. 'abgelehnt') gehen noch raus; spätestens nach 200 ms ist zu. */
  schliesse(): void {
    if (this.socket.destroyed) return;
    this.socket.end();
    const t = setTimeout(() => this.socket.destroy(), 200);
    t.unref?.();
  }
}
```

`src/index.ts` ergänzen:
```ts
export * from './rahmen';
export * from './verbindung';
```

- [ ] **Schritt 5: Test grün sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts && npx tsc --noEmit -p tsconfig.json`
Expected: `… 0 fehlgeschlagen.`, tsc ohne Ausgabe.

- [ ] **Schritt 6: Commit**

```bash
git add packages/master-link/src/rahmen.ts packages/master-link/src/verbindung.ts packages/master-link/src/index.ts packages/master-link/test/tlspaar.ts packages/master-link/test/rahmen.test.ts packages/master-link/test/selftest.ts
git status --short
git commit -m "feat(master-link): Zeilenrahmen, strikte Nachrichtenprüfung, Verbindung" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aufgabe 4: Adresswahl (#234)

**Files:**
- Create: `packages/master-link/src/adresswahl.ts`, `packages/master-link/test/adresswahl.test.ts`
- Modify: `packages/master-link/src/index.ts`, `packages/master-link/test/selftest.ts`

**Interfaces:**
- Produces:
  - Typen: `NetzwerkInterfaces`, `KartenAdresse`, `Karte`, `KandidatenQuelle`
  - Prüfungen: `istVirtuell(name)`, `istLinkLocal(adresse)`, `istIPv4Adresse(a)`, `imSubnetz(adresse, netz)`
  - Karten: `listeKarten(ni)`, `wirksameKarten(karten, gewaehlt)`
  - Kandidaten: `ordneKandidaten(masterAdressen, eigeneKarten, gewaehlteKarte)`, `kandidatenliste(q)`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`packages/master-link/test/adresswahl.test.ts`:
```ts
import type { NetworkInterfaceInfo } from 'node:os';
import { abschnitt, gleich, pruefe } from './helfer';
import {
  imSubnetz, istVirtuell, kandidatenliste, listeKarten, ordneKandidaten, wirksameKarten, type NetzwerkInterfaces,
} from '../src/adresswahl';

const v4 = (address: string, cidr: string, internal = false): NetworkInterfaceInfo => ({
  address, netmask: '255.255.255.0', family: 'IPv4', mac: '00:11:22:33:44:55', internal, cidr,
});
const v6 = (address: string): NetworkInterfaceInfo => ({
  address, netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:11:22:33:44:55', internal: false, cidr: `${address}/64`, scopeid: 0,
});

// Realistischer Regie-Laptop: LAN, Hyper-V, VPN, WLAN ohne DHCP, Loopback.
const regie: NetzwerkInterfaces = {
  'Ethernet 2': [v4('10.0.0.110', '10.0.0.110/24'), v6('fe80::1')],
  'vEthernet (Default Switch)': [v4('172.20.64.1', '172.20.64.1/20')],
  'Tailscale': [v4('100.64.0.5', '100.64.0.5/10')],
  'WLAN': [v4('169.254.10.20', '169.254.10.20/16')],
  'Loopback Pseudo-Interface 1': [v4('127.0.0.1', '127.0.0.1/8', true)],
  'Ethernet 3': [v6('fe80::2')],
};

export async function laufe(): Promise<void> {
  abschnitt('Adresswahl: Karten');
  const karten = listeKarten(regie);
  gleich(karten.map((k) => k.name), ['Ethernet 2', 'Tailscale', 'vEthernet (Default Switch)', 'WLAN'], 'nur nicht-interne Karten mit IPv4, nach Name');
  gleich(karten.find((k) => k.name === 'Ethernet 2')?.adressen, [{ adresse: '10.0.0.110', praefix: 24 }], 'Präfix aus cidr');
  pruefe(karten.find((k) => k.name === 'vEthernet (Default Switch)')!.virtuell, 'Hyper-V als virtuell markiert');
  pruefe(karten.find((k) => k.name === 'Tailscale')!.virtuell, 'Tailscale als virtuell markiert');
  pruefe(!karten.find((k) => k.name === 'Ethernet 2')!.virtuell, 'Ethernet 2 nicht virtuell');
  pruefe(karten.find((k) => k.name === 'WLAN')!.nurLinkLocal, 'WLAN nur 169.254 → nurLinkLocal');
  pruefe(istVirtuell('utun3') && istVirtuell('bridge100') && !istVirtuell('en0'), 'macOS-Namen utun/bridge virtuell, en0 nicht');
  const zweiIPs = listeKarten({ 'Ethernet': [v4('10.0.0.5', '10.0.0.5/24'), v4('192.168.10.5', '192.168.10.5/24')] });
  gleich(zweiIPs[0].adressen.length, 2, 'Karte mit zwei IPv4 behält beide');
  const ohneCidr = listeKarten({ 'X': [{ ...v4('10.1.2.3', ''), cidr: null, netmask: '255.255.0.0' }] });
  gleich(ohneCidr[0].adressen[0].praefix, 16, 'Präfix aus Netzmaske, wenn cidr fehlt');

  abschnitt('Adresswahl: Subnetz');
  pruefe(imSubnetz('10.0.0.7', { adresse: '10.0.0.110', praefix: 24 }), '10.0.0.7 in 10.0.0.110/24');
  pruefe(!imSubnetz('10.0.1.7', { adresse: '10.0.0.110', praefix: 24 }), '10.0.1.7 nicht in /24');
  pruefe(imSubnetz('172.20.70.9', { adresse: '172.20.64.1', praefix: 20 }), '/20 über Oktettgrenze');
  pruefe(!imSubnetz('kein.ip', { adresse: '10.0.0.1', praefix: 24 }), 'keine IP → false');

  abschnitt('Adresswahl: wirksame Karten');
  gleich(wirksameKarten(karten, null).karteFehlt, false, 'Automatisch → alle, nichts fehlt');
  gleich(wirksameKarten(karten, 'Ethernet 2').karten.map((k) => k.name), ['Ethernet 2'], 'gewählte Karte allein');
  const fehlt = wirksameKarten(karten, 'USB-LAN');
  pruefe(fehlt.karteFehlt && fehlt.karten.length === karten.length, 'gewählte Karte fehlt → alle + karteFehlt (Automatisch)');

  abschnitt('Adresswahl: Kandidaten (#234)');
  // Master annonciert (Reihenfolge wie aus mDNS): Hyper-V zuerst — genau der #234-Fall.
  const master = ['172.20.64.9', '100.64.0.9', '10.0.0.50', '169.254.3.3', '10.0.0.50', '::1', '127.0.0.1'];
  gleich(ordneKandidaten(master, karten, null), ['10.0.0.50', '172.20.64.9', '100.64.0.9', '169.254.3.3'],
    'LAN vor virtuellen Netzen (dort Fund-Reihenfolge), 169.254 zuletzt, entdoppelt, ohne IPv6/Loopback');
  gleich(ordneKandidaten(master, karten, 'vEthernet (Default Switch)')[0], '172.20.64.9', 'gewählte Karte zieht ihr Subnetz nach vorn');
  gleich(ordneKandidaten(['169.254.9.9'], listeKarten({ 'WLAN': [v4('169.254.1.1', '169.254.1.1/16')] }), null), ['169.254.9.9'],
    'nur 169.254 auf beiden Seiten → wird trotzdem versucht (kein DHCP)');
  gleich(ordneKandidaten(['192.168.10.9', '10.0.0.9'], zweiIPs, 'Ethernet'), ['192.168.10.9', '10.0.0.9'],
    'Karte mit zwei IPv4: beide Präfixe zählen, Fund-Reihenfolge bleibt');
  // Spec 11.1 Nr. 6 „zwei echte Karten“: LAN + WLAN, beide nicht virtuell, beide mit DHCP-Adresse (Rangfolge 4.4).
  const zweiKarten = listeKarten({ 'Ethernet 2': [v4('10.0.0.110', '10.0.0.110/24')], 'WLAN': [v4('192.168.1.20', '192.168.1.20/24')] });
  pruefe(zweiKarten.every((k) => !k.virtuell && !k.nurLinkLocal), 'zwei echte Karten: keine virtuell, keine nur Link-Local');
  const zweiNetze = ['172.16.0.9', '192.168.1.9', '10.0.0.9'];
  gleich(ordneKandidaten(zweiNetze, zweiKarten, null), ['192.168.1.9', '10.0.0.9', '172.16.0.9'],
    'zwei echte Karten, Automatisch: beide eigenen Subnetze (Rang 2, untereinander Fund-Reihenfolge) vor dem Rest');
  gleich(ordneKandidaten(zweiNetze, zweiKarten, 'Ethernet 2'), ['10.0.0.9', '192.168.1.9', '172.16.0.9'],
    'zwei echte Karten, LAN gewählt: LAN (Rang 1), dann die zweite echte Karte (Rang 2), dann der Rest');

  const quelle = {
    rolle: 'slave' as const, mdns: ['10.0.0.50'], letzteAdresse: '10.0.0.51', adressen: ['10.0.0.50', '10.0.0.52'],
    festeAdresse: '192.168.99.1', karten, gewaehlteKarte: null,
  };
  gleich(kandidatenliste(quelle), ['10.0.0.50', '10.0.0.51', '10.0.0.52', '192.168.99.1'],
    'Reihenfolge mDNS → zuletzt → Datei → feste Adresse, entdoppelt');
  gleich(kandidatenliste({ ...quelle, rolle: 'master' }), ['127.0.0.1'], 'Master-Rechner: nur 127.0.0.1');
  gleich(kandidatenliste({ ...quelle, mdns: [], letzteAdresse: null, adressen: ['127.0.0.1'], festeAdresse: null }), ['127.0.0.1'],
    'Adresse aus der Datei darf Loopback sein (Tests, Selbstkopplung)');
}
```

In `test/selftest.ts` `adresswahl` ergänzen.

- [ ] **Schritt 2: Test laufen lassen und Fehlschlag sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts`
Expected: FAIL mit `Cannot find module '../src/adresswahl'`

- [ ] **Schritt 3: `adresswahl.ts` schreiben**

`packages/master-link/src/adresswahl.ts`:
```ts
import type { NetworkInterfaceInfo } from 'node:os';

// Netzwerkwahl und Adressreihenfolge (Spec 4.1, 4.4) — reine Funktionen.

export type NetzwerkInterfaces = NodeJS.Dict<NetworkInterfaceInfo[]>;

export interface KartenAdresse {
  adresse: string;
  praefix: number;
}

export interface Karte {
  name: string;
  adressen: KartenAdresse[];
  virtuell: boolean;
  nurLinkLocal: boolean;
}

const VIRTUELL = [
  /vethernet/i, /hyper-v/i, /virtualbox/i, /vmware/i, /wsl/i, /tailscale/i, /zerotier/i,
  /\btap\b/i, /vpn/i, /loopback pseudo/i, /^utun/i, /^bridge/i,
];

export function istVirtuell(name: string): boolean {
  return VIRTUELL.some((m) => m.test(name));
}

export function istLinkLocal(adresse: string): boolean {
  return adresse.startsWith('169.254.');
}

function zuZahl(adresse: string): number | null {
  const teile = adresse.split('.');
  if (teile.length !== 4) return null;
  let z = 0;
  for (const t of teile) {
    if (!/^\d{1,3}$/.test(t)) return null;
    const n = Number(t);
    if (n > 255) return null;
    z = z * 256 + n;
  }
  return z;
}

export function istIPv4Adresse(a: string): boolean {
  return zuZahl(a) !== null;
}

function istIPv4(i: NetworkInterfaceInfo): boolean {
  return i.family === 'IPv4' || (i.family as unknown) === 4;
}

function praefixAus(i: NetworkInterfaceInfo): number {
  if (i.cidr) {
    const p = Number(i.cidr.split('/')[1]);
    if (Number.isInteger(p) && p >= 0 && p <= 32) return p;
  }
  const m = zuZahl(i.netmask) ?? 0;
  return m.toString(2).split('').filter((b) => b === '1').length;
}

export function listeKarten(ni: NetzwerkInterfaces): Karte[] {
  const karten: Karte[] = [];
  for (const [name, eintraege] of Object.entries(ni)) {
    const v4 = (eintraege ?? []).filter((i) => !i.internal && istIPv4(i));
    if (v4.length === 0) continue;
    const adressen = v4.map((i) => ({ adresse: i.address, praefix: praefixAus(i) }));
    karten.push({
      name,
      adressen,
      virtuell: istVirtuell(name),
      nurLinkLocal: adressen.every((a) => istLinkLocal(a.adresse)),
    });
  }
  return karten.sort((a, b) => a.name.localeCompare(b.name));
}

export function imSubnetz(adresse: string, netz: KartenAdresse): boolean {
  const a = zuZahl(adresse);
  const n = zuZahl(netz.adresse);
  if (a === null || n === null) return false;
  const block = 2 ** (32 - netz.praefix);
  return Math.floor(a / block) === Math.floor(n / block);
}

/** Gewählte Karte vorhanden → nur sie; fehlt sie → alle Karten und karteFehlt (Spec 4.1: weiter mit Automatisch). */
export function wirksameKarten(karten: Karte[], gewaehlt: string | null): { karten: Karte[]; karteFehlt: boolean } {
  if (gewaehlt === null) return { karten, karteFehlt: false };
  const k = karten.find((x) => x.name === gewaehlt);
  return k ? { karten: [k], karteFehlt: false } : { karten, karteFehlt: true };
}

/**
 * Ordnet Master-Adressen aus mDNS (Spec 4.4): entdoppeln, IPv6/Loopback raus,
 * dann gewählte Karte → nicht virtuelle Karte → virtuelle Karte → Rest → 169.254.
 */
export function ordneKandidaten(masterAdressen: string[], eigeneKarten: Karte[], gewaehlteKarte: string | null): string[] {
  const gewaehlt = gewaehlteKarte ? eigeneKarten.find((k) => k.name === gewaehlteKarte) : undefined;
  const liste = [...new Set(masterAdressen)].filter((a) => istIPv4Adresse(a) && !a.startsWith('127.'));
  const imNetzVon = (a: string, karten: Karte[]): boolean =>
    karten.some((k) => k.adressen.some((n) => !istLinkLocal(n.adresse) && imSubnetz(a, n)));
  const rang = (a: string): number => {
    if (istLinkLocal(a)) return 5;
    if (gewaehlt && imNetzVon(a, [gewaehlt])) return 1;
    if (imNetzVon(a, eigeneKarten.filter((k) => !k.virtuell))) return 2;
    if (imNetzVon(a, eigeneKarten.filter((k) => k.virtuell))) return 3;
    return 4;
  };
  return liste
    .map((a, i) => ({ a, r: rang(a), i }))
    .sort((x, y) => x.r - y.r || x.i - y.i)
    .map((x) => x.a);
}

export interface KandidatenQuelle {
  rolle: 'master' | 'slave';
  mdns: string[];
  letzteAdresse: string | null;
  adressen: string[];
  festeAdresse: string | null;
  karten: Karte[];
  gewaehlteKarte: string | null;
}

/** Spec 4.5: Master-Rechner nur 127.0.0.1; sonst mDNS → zuletzt → Datei → feste Adresse, entdoppelt. */
export function kandidatenliste(q: KandidatenQuelle): string[] {
  if (q.rolle === 'master') return ['127.0.0.1'];
  const alle = [
    ...ordneKandidaten(q.mdns, q.karten, q.gewaehlteKarte),
    ...(q.letzteAdresse ? [q.letzteAdresse] : []),
    ...q.adressen,
    ...(q.festeAdresse ? [q.festeAdresse] : []),
  ];
  return [...new Set(alle)];
}
```

`src/index.ts` ergänzen: `export * from './adresswahl';`

- [ ] **Schritt 4: Test grün sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts && npx tsc --noEmit -p tsconfig.json`
Expected: `… 0 fehlgeschlagen.`

- [ ] **Schritt 5: Commit**

```bash
git add packages/master-link/src/adresswahl.ts packages/master-link/src/index.ts packages/master-link/test/adresswahl.test.ts packages/master-link/test/selftest.ts
git status --short
git commit -m "feat(master-link): Netzwerkkarten und Adressreihenfolge (#234)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Aufgabe 5: Fehlerdeutung (`fehler.ts`)

**Files:**
- Create: `packages/master-link/src/fehler.ts`, `packages/master-link/test/fehler.test.ts`
- Modify: `packages/master-link/src/index.ts`, `packages/master-link/test/selftest.ts`

**Interfaces:**
- Consumes: `Fristen` (Aufgabe 1), `Grund`, `PROTOKOLL` (Aufgabe 3)
- Produces:
  - Typen: `FehlerCode`, `VersuchsErgebnis`, `Einordnung`, `Wiederholung`, `TextKontext`
  - Konstanten: `PIN_FALSCH = 'PIN_FALSCH'`, `RAHMEN = 'RAHMEN'`, `RANGFOLGE`
  - Funktionen:
    - `ordneEin(e, mdnsGesehen): Einordnung`
    - `staerkster(codes): FehlerCode | null`
    - `wiederholung(code | 'last' | 'anmeldefrist', f): Wiederholung`
    - `rueckzugMs(versuch, f, zufall?)`
    - `fehlerText(code, k)`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`packages/master-link/test/fehler.test.ts`:
```ts
import { abschnitt, gleich, pruefe } from './helfer';
import { fristen } from '../src/fristen';
import { fehlerText, ordneEin, PIN_FALSCH, RAHMEN, rueckzugMs, staerkster, wiederholung } from '../src/fehler';

export async function laufe(): Promise<void> {
  abschnitt('Fehler: Einordnung (Spec 6.1, 9.1)');
  gleich(ordneEin({ art: 'tcp-timeout' }, true), { art: 'code', code: 'zeit' }, 'TCP-Timeout + mDNS gesehen → zeit (Firewall?)');
  gleich(ordneEin({ art: 'tcp-timeout' }, false), { art: 'code', code: 'nicht-gefunden' }, 'TCP-Timeout ohne mDNS → nicht-gefunden (Windows-Stealth)');
  const tabelle: Array<[string, string]> = [
    ['DEPTH_ZERO_SELF_SIGNED_CERT', 'zertifikat'], ['SELF_SIGNED_CERT_IN_CHAIN', 'zertifikat'],
    ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'zertifikat'], ['CERT_SIGNATURE_FAILURE', 'zertifikat'], [PIN_FALSCH, 'zertifikat'],
    ['CERT_NOT_YET_VALID', 'uhr'], ['CERT_HAS_EXPIRED', 'uhr'],
    ['ECONNREFUSED', 'verweigert'], ['EHOSTUNREACH', 'netz'], ['ENETUNREACH', 'netz'],
    ['ERR_SSL_WRONG_VERSION_NUMBER', 'kein-master'], [RAHMEN, 'kein-master'],
    ['ECONNRESET', 'sonstig'], ['EPIPE', 'sonstig'],
  ];
  for (const [errCode, code] of tabelle) {
    gleich(ordneEin({ art: 'fehler', code: errCode }, false), { art: 'code', code }, `${errCode} → ${code}`);
  }
  gleich(ordneEin({ art: 'fehler', code: 'ETIMEDOUT' }, true), { art: 'code', code: 'zeit' }, 'ETIMEDOUT + mDNS → zeit');
  gleich(ordneEin({ art: 'frist' }, true), { art: 'code', code: 'kein-master' }, 'Frist nach TCP → kein-master');
  for (const grund of ['unbekannt', 'signatur', 'protokoll', 'ersetzt'] as const) {
    gleich(ordneEin({ art: 'abgelehnt', grund }, true), { art: 'code', code: grund }, `abgelehnt ${grund} → Code ${grund}`);
  }
  gleich(ordneEin({ art: 'abgelehnt', grund: 'anmeldefrist' }, true), { art: 'intern', grund: 'anmeldefrist' }, 'anmeldefrist ist intern (kein „Firewall“-Text)');
  gleich(ordneEin({ art: 'abgelehnt', grund: 'last' }, true), { art: 'intern', grund: 'last' }, 'last ist intern');

  abschnitt('Fehler: Rangfolge');
  gleich(staerkster(['nicht-gefunden', 'zeit', 'verweigert']), 'verweigert', 'verweigert vor zeit vor nicht-gefunden');
  gleich(staerkster(['netz', 'sonstig']), 'sonstig', 'sonstig vor netz');
  gleich(staerkster(['zeit', 'unbekannt', 'zertifikat']), 'unbekannt', 'unbekannt schlägt alles');
  gleich(staerkster([]), null, 'nichts → null');

  abschnitt('Fehler: Wiederholung');
  const f = fristen();
  gleich(wiederholung('zertifikat', f), { art: 'fest', ms: 30_000 }, 'zertifikat alle 30 s');
  gleich(wiederholung('uhr', f), { art: 'fest', ms: 30_000 }, 'uhr alle 30 s');
  gleich(wiederholung('protokoll', f), { art: 'fest', ms: 60_000 }, 'protokoll alle 60 s');
  gleich(wiederholung('ersetzt', f), { art: 'fest', ms: 60_000 }, 'ersetzt alle 60 s');
  gleich(wiederholung('last', f), { art: 'fest', ms: 5000 }, 'last frühestens nach 5 s');
  for (const c of ['unbekannt', 'signatur', 'datei'] as const) gleich(wiederholung(c, f), { art: 'keine' }, `${c}: keine Wiederholung bis Dateiänderung`);
  for (const c of ['zeit', 'nicht-gefunden', 'verweigert', 'netz', 'kein-master', 'sonstig', 'anmeldefrist'] as const) {
    gleich(wiederholung(c, f), { art: 'rueckzug' }, `${c}: normaler Rückzug`);
  }
  gleich(rueckzugMs(0, f, () => 0.5), 1000, 'Rückzug 1 s');
  gleich(rueckzugMs(3, f, () => 0.5), 8000, 'Rückzug 8 s');
  gleich(rueckzugMs(9, f, () => 0.5), 10_000, 'Rückzug gedeckelt bei 10 s');
  gleich(rueckzugMs(0, f, () => 0), 750, '−25 %');
  gleich(rueckzugMs(0, f, () => 1), 1250, '+25 %');

  abschnitt('Fehler: Texte (Spec 9.1 wörtlich)');
  gleich(fehlerText('zeit', { masterName: 'Regie-PC' }),
    'Regie-PC ist im Netz sichtbar, aber Port 8738 antwortet nicht. Wahrscheinlich sperrt die Firewall am Master (Regel und Netzprofil prüfen).', 'zeit');
  gleich(fehlerText('nicht-gefunden', { masterName: 'Regie-PC' }),
    'Regie-PC nicht erreichbar: ausgeschaltet, Launcher oder Master-Modus aus, anderes Netz oder Firewall. Gleiches Netz? Sonst feste Adresse eintragen.', 'nicht-gefunden');
  gleich(fehlerText('kein-master', { masterName: 'X', adresse: '10.0.0.9' }), 'Unter 10.0.0.9 antwortet ein Dienst, aber nicht als Master.', 'kein-master nennt die Adresse');
  pruefe(fehlerText('protokoll', { masterName: 'X', suite: '0.13.0', masterProtokoll: 2 }).includes('Launcher 0.13.0 (Protokoll 2)'), 'protokoll nennt Stand des Masters');
  gleich(fehlerText('sonstig', { masterName: 'X', errCode: 'ECONNRESET' }), 'Verbindungsfehler ECONNRESET.', 'sonstig nennt err.code');
}
```

In `test/selftest.ts` `fehler` ergänzen.

- [ ] **Schritt 2: Test laufen lassen und Fehlschlag sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts`
Expected: FAIL mit `Cannot find module '../src/fehler'`

- [ ] **Schritt 3: `fehler.ts` schreiben**

`packages/master-link/src/fehler.ts`:
```ts
import type { Fristen } from './fristen';
import { PROTOKOLL, type Grund } from './rahmen';

// Fehlerbilder am Slave (Spec 9). Einordnung AUSSCHLIESSLICH nach err.code, nie nach Meldungstext
// (OpenSSL und BoringSSL/Electron formulieren verschieden, die Codes sind gleich — gemessen).

export type FehlerCode =
  | 'zeit' | 'nicht-gefunden' | 'verweigert' | 'netz' | 'kein-master' | 'zertifikat' | 'uhr'
  | 'protokoll' | 'unbekannt' | 'signatur' | 'ersetzt' | 'datei' | 'sonstig';

export type VersuchsErgebnis =
  | { art: 'tcp-timeout' }
  | { art: 'fehler'; code: string }
  | { art: 'frist' }
  | { art: 'abgelehnt'; grund: Grund; master?: number; suite?: string };

export type Einordnung = { art: 'code'; code: FehlerCode } | { art: 'intern'; grund: 'anmeldefrist' | 'last' };

/** Eigener Code des Pin-Vergleichs in checkServerIdentity. */
export const PIN_FALSCH = 'PIN_FALSCH';
/** Kaputte oder zu lange Zeile vom Gegenüber. */
export const RAHMEN = 'RAHMEN';

const ZERTIFIKAT = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_SIGNATURE_FAILURE', PIN_FALSCH,
]);
const UHR = new Set(['CERT_NOT_YET_VALID', 'CERT_HAS_EXPIRED']);
const NETZ = new Set(['EHOSTUNREACH', 'ENETUNREACH']);

export function ordneEin(e: VersuchsErgebnis, mdnsGesehen: boolean): Einordnung {
  const code = (c: FehlerCode): Einordnung => ({ art: 'code', code: c });
  switch (e.art) {
    case 'tcp-timeout':
      // Windows-Stealth: auch „niemand lauscht“ endet im Timeout — „Firewall?“ nur mit mDNS-Sichtung.
      return code(mdnsGesehen ? 'zeit' : 'nicht-gefunden');
    case 'frist':
      return code('kein-master');
    case 'abgelehnt':
      switch (e.grund) {
        case 'anmeldefrist':
        case 'last':
          return { art: 'intern', grund: e.grund };
        case 'unbekannt':
        case 'signatur':
        case 'protokoll':
        case 'ersetzt':
          return code(e.grund);
        default:
          return code('sonstig');
      }
    case 'fehler':
      if (ZERTIFIKAT.has(e.code)) return code('zertifikat');
      if (UHR.has(e.code)) return code('uhr');
      if (e.code === 'ECONNREFUSED') return code('verweigert');
      if (NETZ.has(e.code)) return code('netz');
      if (e.code === 'ETIMEDOUT') return code(mdnsGesehen ? 'zeit' : 'nicht-gefunden');
      if (e.code === RAHMEN || e.code.startsWith('ERR_SSL_')) return code('kein-master');
      return code('sonstig');
  }
}

export const RANGFOLGE: readonly FehlerCode[] = [
  'unbekannt', 'signatur', 'zertifikat', 'uhr', 'protokoll', 'kein-master', 'verweigert', 'zeit', 'sonstig', 'netz', 'nicht-gefunden',
];

export function staerkster(codes: FehlerCode[]): FehlerCode | null {
  for (const c of RANGFOLGE) if (codes.includes(c)) return c;
  return codes[0] ?? null;
}

export type Wiederholung = { art: 'rueckzug' } | { art: 'fest'; ms: number } | { art: 'keine' };

export function wiederholung(code: FehlerCode | 'last' | 'anmeldefrist', f: Fristen): Wiederholung {
  switch (code) {
    case 'zertifikat':
    case 'uhr':
      return { art: 'fest', ms: f.zertifikatWiederholMs };
    case 'protokoll':
      return { art: 'fest', ms: f.protokollWiederholMs };
    case 'ersetzt':
      return { art: 'fest', ms: f.ersetztWiederholMs };
    case 'last':
      return { art: 'fest', ms: f.lastMinMs };
    case 'unbekannt':
    case 'signatur':
    case 'datei':
      return { art: 'keine' };
    default:
      return { art: 'rueckzug' };
  }
}

/** 1 → 2 → 4 → 8 → 10 s (gedeckelt), jeweils ±25 % Zufall gegen Gleichschritt nach Master-Ausfall. */
export function rueckzugMs(versuch: number, f: Fristen, zufall: () => number = Math.random): number {
  const basis = Math.min(f.rueckzugBasisMs * 2 ** Math.max(0, versuch), f.rueckzugMaxMs);
  return Math.round(basis * (0.75 + 0.5 * zufall()));
}

export interface TextKontext {
  masterName: string;
  adresse?: string;
  errCode?: string;
  suite?: string;
  masterProtokoll?: number;
}

export function fehlerText(code: FehlerCode, k: TextKontext): string {
  const name = k.masterName || 'Der Master';
  switch (code) {
    case 'zeit':
      return `${name} ist im Netz sichtbar, aber Port 8738 antwortet nicht. Wahrscheinlich sperrt die Firewall am Master (Regel und Netzprofil prüfen).`;
    case 'nicht-gefunden':
      return `${name} nicht erreichbar: ausgeschaltet, Launcher oder Master-Modus aus, anderes Netz oder Firewall. Gleiches Netz? Sonst feste Adresse eintragen.`;
    case 'verweigert':
      return 'Master antwortet nicht auf 8738. Ist der Master-Modus dort eingeschaltet?';
    case 'netz':
      return 'Netz zum Master nicht erreichbar. Richtiges Netz/Kabel? Netzwerkwahl prüfen.';
    case 'kein-master':
      return `Unter ${k.adresse ?? 'dieser Adresse'} antwortet ein Dienst, aber nicht als Master.`;
    case 'zertifikat':
      return 'Unter dieser Adresse antwortet ein anderer Master, oder der Master wurde neu aufgesetzt. Neu koppeln.';
    case 'uhr':
      return 'Die Uhrzeit dieses Rechners oder des Masters stimmt nicht. Uhrzeit prüfen.';
    case 'protokoll':
      return `Versionen passen nicht: Master hat Launcher ${k.suite ?? '?'} (Protokoll ${k.masterProtokoll ?? '?'}), dieses Programm Protokoll ${PROTOKOLL}. Bitte angleichen.`;
    case 'unbekannt':
      return 'Dieser Rechner wurde am Master entfernt. Neu koppeln.';
    case 'signatur':
      return 'Anmeldung abgelehnt: Der Schlüssel passt nicht zur Kopplung. Neu koppeln.';
    case 'ersetzt':
      return 'Diese Rechnerkennung meldet sich ein zweites Mal beim Master an (Ordner kopiert oder Rechner geklont?). Neu koppeln.';
    case 'datei':
      return 'Kopplungsdatei beschädigt. Neu koppeln.';
    case 'sonstig':
      return `Verbindungsfehler ${k.errCode ?? 'unbekannt'}.`;
  }
}
```

`src/index.ts` ergänzen: `export * from './fehler';`

- [ ] **Schritt 4: Test grün sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts && npx tsc --noEmit -p tsconfig.json`
Expected: `… 0 fehlgeschlagen.`

- [ ] **Schritt 5: Commit**

```bash
git add packages/master-link/src/fehler.ts packages/master-link/src/index.ts packages/master-link/test/fehler.test.ts packages/master-link/test/selftest.ts
git status --short
git commit -m "feat(master-link): Fehlerdeutung ohne Firewall-Fehlschluss, Rangfolge, Wiederholung" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aufgabe 6: `master-link.json` (`datei.ts`)

**Files:**
- Create: `packages/master-link/src/datei.ts`, `packages/master-link/test/datei.test.ts`, `packages/master-link/test/muster.ts`
- Modify: `packages/master-link/src/index.ts`, `packages/master-link/test/selftest.ts`

**Interfaces:**
- Consumes: `Schluesselpaar`, `fingerprintVonPem`, `erzeugeSchluesselpaar`, `istEd25519Oeffentlich`, `istEd25519Privat` (Aufgabe 2); `MASTER_PORT`, `SUITE_ORDNER` (Aufgabe 1)
- Produces:
  - Typen: `Kopplung`, `Rolle`, `MasterLinkDatei`, `DateiPruefung`, `Lesen<T>`, `Beobachtung`
  - Funktionen:
    - `masterLinkPfad(appDataDir)`, `pruefeMasterLinkDatei(raw)` — defekt auch, wenn `schluessel.privat` bzw. `schluessel.oeffentlich` nicht als Ed25519 ladbar ist (sonst würfe das Signieren im Handler)
    - `leseMasterLinkDatei(pfad)`, `schreibeAtomar(pfad, inhalt, umbenennen?)`, `schreibeMasterLinkDatei(pfad, d)`
    - `verbindungsrelevantGeaendert(a, b)`
  - Klasse `DateiBeobachter`: `pruefe()`, `aktuell()` — nur Parse-Fehler/Defekt zählen als Fehllesung, andere I/O-Fehler sind vorübergehend (Spec 7.3)
  - Testhilfe `musterDatei(zert, teil?)`

- [ ] **Schritt 1: Musterdatei-Helfer schreiben**

`packages/master-link/test/muster.ts`:
```ts
import { erzeugeSchluesselpaar, fingerprintVonPem } from '../src/beweis';
import type { Kopplung, MasterLinkDatei } from '../src/datei';

/** Eine gültige master-link.json (Rolle slave) für das Zertifikat `zertPem`. */
export function musterDatei(zertPem: string, teil: Partial<Kopplung> = {}, rolle: MasterLinkDatei['rolle'] = 'slave'): MasterLinkDatei {
  return {
    version: 1,
    rolle,
    rechner: { id: 'rechner-b', name: 'Regie-Laptop 2' },
    netzwerk: { karte: null },
    kopplung: {
      masterId: 'master-a',
      masterName: 'Regie-PC',
      fingerprint: fingerprintVonPem(zertPem),
      zertifikat: zertPem,
      port: 8738,
      adressen: ['127.0.0.1'],
      letzteAdresse: null,
      festeAdresse: null,
      schluessel: erzeugeSchluesselpaar(),
      ...teil,
    },
  };
}
```

- [ ] **Schritt 2: Den fehlschlagenden Test schreiben**

`packages/master-link/test/datei.test.ts`:
```ts
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { abschnitt, gleich, pruefe, tempOrdner, warte } from './helfer';
import { erzeugeTestZertifikat } from './zertifikate';
import { musterDatei } from './muster';
import {
  DateiBeobachter, leseMasterLinkDatei, masterLinkPfad, pruefeMasterLinkDatei, schreibeAtomar,
  schreibeMasterLinkDatei, verbindungsrelevantGeaendert,
} from '../src/datei';

export async function laufe(): Promise<void> {
  const z = erzeugeTestZertifikat();
  const gut = musterDatei(z.cert);

  abschnitt('Datei: Pfad und Prüfung (Spec 7.1)');
  gleich(masterLinkPfad('C:/AppData'), join('C:/AppData', 'JM Production Suite', 'master-link.json'), 'Pfad unter dem Suite-Ordner');
  gleich(pruefeMasterLinkDatei(JSON.parse(JSON.stringify(gut))), { ok: true, datei: gut }, 'gültige Datei → ok');
  gleich(pruefeMasterLinkDatei({ ...gut, version: 2 }).ok, false, 'falsche Version → defekt');
  gleich(pruefeMasterLinkDatei({ ...gut, rolle: 'chef' }).ok, false, 'unbekannte Rolle → defekt');
  const ohneZert = JSON.parse(JSON.stringify(gut));
  delete ohneZert.kopplung.zertifikat;
  gleich(pruefeMasterLinkDatei(ohneZert).ok, false, 'Kopplung ohne Zertifikat → defekt');
  gleich(pruefeMasterLinkDatei({ ...gut, kopplung: { ...gut.kopplung!, fingerprint: '00'.repeat(32) } }).ok, false, 'Fingerprint ≠ Zertifikat → defekt');
  // GEMESSEN: bestand „nicht leer“, dann warf signiereAnmeldung im Handler — jedes Tool stürzte ab (Spec 7.3).
  // Nur den Grund vergleichen: die FAIL-Zeile nennt dann den Grund statt der ganzen Datei.
  const grund = (p: ReturnType<typeof pruefeMasterLinkDatei>): string => (p.ok ? 'ok' : p.grund);
  const paar = gut.kopplung!.schluessel;
  gleich(grund(pruefeMasterLinkDatei({ ...gut, kopplung: { ...gut.kopplung!, schluessel: { ...paar, privat: 'AAAA' } } })),
    'schluessel unbrauchbar', 'privater Schlüssel nicht als Ed25519 ladbar → defekt');
  gleich(grund(pruefeMasterLinkDatei({ ...gut, kopplung: { ...gut.kopplung!, schluessel: { ...paar, oeffentlich: 'P' } } })),
    'schluessel unbrauchbar', 'öffentlicher Schlüssel kein Ed25519 → defekt');
  const mitExtra = pruefeMasterLinkDatei({ ...gut, zukunft: 1, kopplung: { ...gut.kopplung!, festeAdresse: '  ', port: 99999 } });
  pruefe(mitExtra.ok && !('zukunft' in mitExtra.datei), 'unbekannte Felder werden verworfen, kein Defekt');
  pruefe(mitExtra.ok && mitExtra.datei.kopplung!.festeAdresse === null, 'leere feste Adresse → null');
  pruefe(mitExtra.ok && mitExtra.datei.kopplung!.port === 8738, 'ungültiger Port → 8738');
  gleich(pruefeMasterLinkDatei({ ...gut, rolle: 'aus', kopplung: null }).ok, true, 'Rolle aus ohne Kopplung ist gültig');

  abschnitt('Datei: Lesen und atomar Schreiben');
  const ordner = tempOrdner();
  const pfad = masterLinkPfad(ordner);
  gleich(leseMasterLinkDatei(pfad), { art: 'fehlt' }, 'fehlende Datei → fehlt');
  schreibeMasterLinkDatei(pfad, gut);
  gleich(leseMasterLinkDatei(pfad), { art: 'ok', wert: gut }, 'geschrieben und gelesen');
  gleich(readdirSync(join(ordner, 'JM Production Suite')), ['master-link.json'], 'keine .tmp-Reste');
  pruefe(readFileSync(pfad, 'utf8').endsWith('\n'), 'Datei endet mit Zeilenumbruch');
  writeFileSync(pfad, '{"version":1,');
  gleich(leseMasterLinkDatei(pfad).art, 'defekt', 'abgeschnittenes JSON → defekt');
  schreibeAtomar(pfad, 'hallo');
  gleich(readFileSync(pfad, 'utf8'), 'hallo', 'schreibeAtomar ersetzt vorhandene Datei');
  let versuche = 0;
  schreibeAtomar(pfad, 'nach EBUSY', (von, nach) => {
    versuche++;
    if (versuche < 3) throw Object.assign(new Error('belegt'), { code: 'EBUSY' });
    renameSync(von, nach);
  });
  pruefe(versuche === 3 && readFileSync(pfad, 'utf8') === 'nach EBUSY', 'rename bei EBUSY wiederholt (Virenscanner), dann geschrieben');
  let geworfen = '';
  try {
    schreibeAtomar(pfad, 'nie', () => { throw Object.assign(new Error('gesperrt'), { code: 'EACCES' }); });
  } catch (e) { geworfen = (e as NodeJS.ErrnoException).code ?? ''; }
  gleich(geworfen, 'EACCES', 'nach 2 s ohne Erfolg: Fehler weitergeben');
  gleich(readdirSync(join(ordner, 'JM Production Suite')), ['master-link.json'], 'auch dann keine .tmp-Reste');
  let fremd = '';
  let fremdVersuche = 0;
  try {
    schreibeAtomar(pfad, 'nie', () => { fremdVersuche++; throw Object.assign(new Error('weg'), { code: 'ENOSPC' }); });
  } catch (e) { fremd = (e as NodeJS.ErrnoException).code ?? ''; }
  gleich([fremd, fremdVersuche], ['ENOSPC', 1], 'andere Fehler sofort weitergeben (genau ein Versuch, keine Wiederholung)');

  abschnitt('Datei: verbindungsrelevante Felder');
  const k = gut.kopplung!;
  pruefe(!verbindungsrelevantGeaendert(gut, { ...gut, kopplung: { ...k, adressen: ['10.0.0.9'] } }), 'Adressen → keine Trennung');
  pruefe(!verbindungsrelevantGeaendert(gut, { ...gut, kopplung: { ...k, letzteAdresse: '10.0.0.9' } }), 'letzte Adresse → keine Trennung');
  pruefe(!verbindungsrelevantGeaendert(gut, { ...gut, kopplung: { ...k, masterName: 'Neu' } }), 'Master-Name → keine Trennung');
  pruefe(verbindungsrelevantGeaendert(gut, { ...gut, kopplung: { ...k, schluessel: { ...k.schluessel, privat: 'x' } } }), 'Schlüssel → Neuaufbau');
  pruefe(verbindungsrelevantGeaendert(gut, { ...gut, rolle: 'aus' }), 'Rolle → Neuaufbau');
  pruefe(verbindungsrelevantGeaendert(gut, { ...gut, netzwerk: { karte: 'Ethernet 2' } }), 'Karte → Neuaufbau');
  pruefe(verbindungsrelevantGeaendert(gut, { ...gut, kopplung: { ...k, festeAdresse: '10.1.1.1' } }), 'feste Adresse → Neuaufbau');
  pruefe(verbindungsrelevantGeaendert(gut, null), 'Datei weg → Neuaufbau');

  abschnitt('Datei: Beobachter (zwei Fehllesungen, Spec 7.3)');
  const o2 = tempOrdner();
  const p2 = masterLinkPfad(o2);
  const b = new DateiBeobachter(p2);
  gleich(b.pruefe(), { art: 'geaendert', datei: null, relevant: true }, 'erster Blick ohne Datei → geändert (null)');
  gleich(b.pruefe(), { art: 'unveraendert' }, 'nichts passiert → unverändert');
  schreibeMasterLinkDatei(p2, gut);
  gleich(b.pruefe(), { art: 'geaendert', datei: gut, relevant: true }, 'Datei erscheint → relevant');
  await warte(20);
  const nurAdressen = { ...gut, kopplung: { ...k, adressen: ['10.0.0.9'] } };
  schreibeMasterLinkDatei(p2, nurAdressen);
  gleich(b.pruefe(), { art: 'geaendert', datei: nurAdressen, relevant: false }, 'nur Adressen → geändert, nicht relevant');
  await warte(20);
  writeFileSync(p2, 'Müll');
  gleich(b.pruefe(), { art: 'unveraendert' }, '1. Fehllesung → alter Stand bleibt');
  gleich(b.aktuell(), nurAdressen, 'aktuell() liefert den letzten gültigen Stand');
  gleich(b.pruefe(), { art: 'defekt' }, '2. Fehllesung in Folge → defekt');
  await warte(20);
  schreibeMasterLinkDatei(p2, nurAdressen);
  gleich(b.pruefe(), { art: 'geaendert', datei: nurAdressen, relevant: true }, 'reparierte Datei (gleicher Inhalt) → relevant, Neuaufbau');
  rmSync(p2);
  gleich(b.pruefe(), { art: 'geaendert', datei: null, relevant: true }, 'Datei im Betrieb gelöscht → null, relevant (Review Focus 3)');

  abschnitt('Datei: I/O-Fehler sind vorübergehend (Spec 7.3)');
  // Ordner statt Datei: statSync klappt, Lesen wirft EISDIR — ein I/O-Fehler wie EBUSY/EPERM vom Virenscanner,
  // KEIN Defekt. Feste mtime in ganzen Sekunden, damit „gleiche mtime“ prüfbar ist.
  const p3 = masterLinkPfad(tempOrdner());
  mkdirSync(p3, { recursive: true });
  utimesSync(p3, 1_700_000_000, 1_700_000_000);
  gleich(leseMasterLinkDatei(p3).art, 'io', 'Ordner statt Datei → io (Vorbedingung)');
  const b3 = new DateiBeobachter(p3);
  gleich([b3.pruefe(), b3.pruefe(), b3.pruefe()].map((x) => x.art), ['unveraendert', 'unveraendert', 'unveraendert'],
    'I/O-Fehler schon beim ersten Lesen → nie „defekt“ (kein fehler:datei)');
  rmSync(p3, { recursive: true });
  schreibeMasterLinkDatei(p3, gut);
  utimesSync(p3, 1_700_000_000, 1_700_000_000);
  gleich(b3.pruefe(), { art: 'geaendert', datei: gut, relevant: true },
    'wieder lesbar bei gleicher mtime → gelesen (mtime erst nach erfolgreichem Lesen gemerkt)');
  rmSync(p3);
  mkdirSync(p3);
  gleich([b3.pruefe(), b3.pruefe(), b3.pruefe()].map((x) => x.art), ['unveraendert', 'unveraendert', 'unveraendert'],
    'I/O-Fehler im Betrieb → nie „defekt“');
  gleich(b3.aktuell(), gut, '… aktuell() liefert weiter den letzten gültigen Stand');
  // EBUSY/EPERM von statSync lassen sich im Test nicht erzeugen; ein NUL-Byte im Pfad liefert plattformunabhängig
  // einen statSync-Fehler außer ENOENT (ERR_INVALID_ARG_VALUE).
  const b4 = new DateiBeobachter(`${p3}\u0000`);
  gleich([b4.pruefe(), b4.pruefe(), b4.pruefe()].map((x) => x.art), ['unveraendert', 'unveraendert', 'unveraendert'],
    'statSync-Fehler außer ENOENT → vorübergehend, nie „defekt“');
}
```

In `test/selftest.ts` `datei` ergänzen.

- [ ] **Schritt 3: Test laufen lassen und Fehlschlag sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts`
Expected: FAIL mit `Cannot find module '../src/datei'`

- [ ] **Schritt 4: `datei.ts` schreiben**

`packages/master-link/src/datei.ts`:
```ts
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fingerprintVonPem, istEd25519Oeffentlich, istEd25519Privat, type Schluesselpaar } from './beweis';
import { MASTER_PORT, SUITE_ORDNER } from './fristen';

// master-link.json (Spec 7.1, 7.3): gemeinsam je Rechner, nur der Launcher schreibt.
// Anders als control-config: atomar schreiben, und „defekt“ ist NICHT „leer“.

export interface Kopplung {
  masterId: string;
  masterName: string;
  fingerprint: string;
  zertifikat: string;
  port: number;
  adressen: string[];
  letzteAdresse: string | null;
  festeAdresse: string | null;
  schluessel: Schluesselpaar;
}

export type Rolle = 'aus' | 'master' | 'slave';

export interface MasterLinkDatei {
  version: 1;
  rolle: Rolle;
  rechner: { id: string; name: string };
  netzwerk: { karte: string | null };
  kopplung: Kopplung | null;
}

export function masterLinkPfad(appDataDir: string): string {
  return join(appDataDir, SUITE_ORDNER, 'master-link.json');
}

export type DateiPruefung = { ok: true; datei: MasterLinkDatei } | { ok: false; grund: string };

type Objekt = Record<string, unknown>;
const istObj = (v: unknown): v is Objekt => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function pruefeMasterLinkDatei(raw: unknown): DateiPruefung {
  if (!istObj(raw)) return { ok: false, grund: 'kein Objekt' };
  if (raw.version !== 1) return { ok: false, grund: 'version' };
  const rolle = raw.rolle;
  if (rolle !== 'aus' && rolle !== 'master' && rolle !== 'slave') return { ok: false, grund: 'rolle' };
  if (!istObj(raw.rechner) || !text(raw.rechner.id) || typeof raw.rechner.name !== 'string') return { ok: false, grund: 'rechner' };
  const karteRoh = istObj(raw.netzwerk) ? raw.netzwerk.karte : null;
  if (karteRoh !== null && karteRoh !== undefined && typeof karteRoh !== 'string') return { ok: false, grund: 'netzwerk' };
  const karte = typeof karteRoh === 'string' && karteRoh.length > 0 ? karteRoh : null;

  let kopplung: Kopplung | null = null;
  if (raw.kopplung !== null && raw.kopplung !== undefined) {
    const k = raw.kopplung;
    if (!istObj(k) || !text(k.masterId) || !text(k.fingerprint) || !text(k.zertifikat)
      || !istObj(k.schluessel) || !text(k.schluessel.privat) || !text(k.schluessel.oeffentlich)) {
      return { ok: false, grund: 'kopplung unvollständig' };
    }
    let fp: string;
    try {
      fp = fingerprintVonPem(k.zertifikat);
    } catch {
      return { ok: false, grund: 'zertifikat unlesbar' };
    }
    if (fp !== k.fingerprint) return { ok: false, grund: 'fingerprint passt nicht zum zertifikat' };
    // GEMESSEN: privat 'AAAA' bestand „nicht leer“, signiereAnmeldung warf dann im Handler — jedes Tool stürzte ab.
    if (!istEd25519Privat(k.schluessel.privat) || !istEd25519Oeffentlich(k.schluessel.oeffentlich)) {
      return { ok: false, grund: 'schluessel unbrauchbar' };
    }
    const port = typeof k.port === 'number' && Number.isInteger(k.port) && k.port > 0 && k.port < 65536 ? k.port : MASTER_PORT;
    kopplung = {
      masterId: k.masterId,
      masterName: typeof k.masterName === 'string' ? k.masterName : '',
      fingerprint: k.fingerprint,
      zertifikat: k.zertifikat,
      port,
      adressen: Array.isArray(k.adressen) ? k.adressen.filter((a): a is string => typeof a === 'string') : [],
      letzteAdresse: typeof k.letzteAdresse === 'string' && k.letzteAdresse ? k.letzteAdresse : null,
      festeAdresse: typeof k.festeAdresse === 'string' && k.festeAdresse.trim() ? k.festeAdresse.trim() : null,
      schluessel: { privat: k.schluessel.privat, oeffentlich: k.schluessel.oeffentlich },
    };
  }
  return {
    ok: true,
    datei: { version: 1, rolle, rechner: { id: raw.rechner.id, name: raw.rechner.name }, netzwerk: { karte }, kopplung },
  };
}

export type Lesen<T> = { art: 'fehlt' } | { art: 'ok'; wert: T } | { art: 'defekt'; grund: string } | { art: 'io'; code: string };

export function leseMasterLinkDatei(pfad: string): Lesen<MasterLinkDatei> {
  let inhalt: string;
  try {
    inhalt = readFileSync(pfad, 'utf8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code ?? 'EIO';
    return code === 'ENOENT' ? { art: 'fehlt' } : { art: 'io', code };
  }
  let roh: unknown;
  try {
    roh = JSON.parse(inhalt);
  } catch {
    // Die JSON.parse-Meldung NICHT weitergeben: sie zitiert bis zu 10 Zeichen der Datei.
    return { art: 'defekt', grund: 'json' };
  }
  const p = pruefeMasterLinkDatei(roh);
  return p.ok ? { art: 'ok', wert: p.datei } : { art: 'defekt', grund: p.grund };
}

const WIEDERHOLBAR = new Set(['EPERM', 'EBUSY', 'EACCES']);

function schlafeSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Temp-Datei im selben Ordner, fsync, rename. Windows: rename bei EPERM/EBUSY/EACCES bis 2 s wiederholen
 * (Virenscanner/Indexer halten die Datei kurz offen). `umbenennen` ist nur für den Test injizierbar.
 */
export function schreibeAtomar(
  pfad: string,
  inhalt: string,
  umbenennen: (von: string, nach: string) => void = renameSync,
): void {
  mkdirSync(dirname(pfad), { recursive: true });
  const temp = `${pfad}.${process.pid}.${Date.now()}.tmp`;
  const fd = openSync(temp, 'w', 0o600);
  try {
    writeSync(fd, inhalt);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  const bis = Date.now() + 2000;
  for (;;) {
    try {
      umbenennen(temp, pfad);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? '';
      if (!WIEDERHOLBAR.has(code) || Date.now() >= bis) {
        try {
          unlinkSync(temp);
        } catch {
          /* Temp-Datei ist schon weg */
        }
        throw e;
      }
      schlafeSync(50);
    }
  }
}

export function schreibeMasterLinkDatei(pfad: string, d: MasterLinkDatei): void {
  schreibeAtomar(pfad, `${JSON.stringify(d, null, 2)}\n`);
}

function relevanteFelder(d: MasterLinkDatei | null): string {
  if (!d) return 'null';
  const k = d.kopplung;
  return JSON.stringify([
    d.rolle, d.rechner.id, d.netzwerk.karte,
    k ? [k.masterId, k.fingerprint, k.zertifikat, k.schluessel.privat, k.schluessel.oeffentlich, k.festeAdresse, k.port] : null,
  ]);
}

/** Spec 7.1: nur diese Felder bauen die Verbindung neu auf; Adressen/Namen fließen ohne Trennung ein. */
export function verbindungsrelevantGeaendert(a: MasterLinkDatei | null, b: MasterLinkDatei | null): boolean {
  return relevanteFelder(a) !== relevanteFelder(b);
}

export type Beobachtung =
  | { art: 'unveraendert' }
  | { art: 'geaendert'; datei: MasterLinkDatei | null; relevant: boolean }
  | { art: 'defekt' };

/**
 * Prüft die Datei per mtime. Erst ZWEI Fehllesungen in Folge (Parse-Fehler/Defekt) gelten als defekt (Spec 7.3).
 * Jeder andere I/O-Fehler ist vorübergehend: letzter gültiger Stand bleibt, der nächste Takt liest erneut.
 */
export class DateiBeobachter {
  private readonly pfad: string;
  private mtime: number | null = null;
  private stand: MasterLinkDatei | null = null;
  private fehlversuche = 0;
  private erstmals = true;
  private warDefekt = false;

  constructor(pfad: string) {
    this.pfad = pfad;
  }

  aktuell(): MasterLinkDatei | null {
    return this.stand;
  }

  pruefe(): Beobachtung {
    let mtime: number | null;
    try {
      mtime = statSync(this.pfad).mtimeMs;
    } catch (e) {
      // EBUSY/EPERM (Virenscanner, Indexer) sind vorübergehend — kein Fehlversuch, nichts gemerkt.
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') return { art: 'unveraendert' };
      mtime = null;
    }
    if (!this.erstmals && this.fehlversuche === 0 && mtime === this.mtime) return { art: 'unveraendert' };
    if (mtime === null) return this.uebernimm(null, null);
    const r = leseMasterLinkDatei(this.pfad);
    if (r.art === 'ok') return this.uebernimm(r.wert, mtime);
    if (r.art === 'fehlt') return this.uebernimm(null, null);
    // mtime erst nach erfolgreichem Lesen merken: so liest der nächste Takt erneut, auch beim ersten Lesen.
    if (r.art === 'io') return { art: 'unveraendert' };
    return this.fehlschlag();
  }

  private uebernimm(datei: MasterLinkDatei | null, mtime: number | null): Beobachtung {
    const relevant = this.erstmals || this.warDefekt || verbindungsrelevantGeaendert(this.stand, datei);
    const geaendert = relevant || JSON.stringify(this.stand) !== JSON.stringify(datei);
    this.erstmals = false;
    this.warDefekt = false;
    this.fehlversuche = 0;
    this.mtime = mtime;
    this.stand = datei;
    return geaendert ? { art: 'geaendert', datei, relevant } : { art: 'unveraendert' };
  }

  private fehlschlag(): Beobachtung {
    this.fehlversuche++;
    if (this.fehlversuche < 2) return { art: 'unveraendert' };
    this.warDefekt = true;
    return { art: 'defekt' };
  }
}
```

`src/index.ts` ergänzen: `export * from './datei';`

- [ ] **Schritt 5: Test grün sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts && npx tsc --noEmit -p tsconfig.json`
Expected: `… 0 fehlgeschlagen.`

- [ ] **Schritt 6: Commit**

```bash
git add packages/master-link/src/datei.ts packages/master-link/src/index.ts packages/master-link/test/datei.test.ts packages/master-link/test/muster.ts packages/master-link/test/selftest.ts
git status --short
git commit -m "feat(master-link): master-link.json prüfen, atomar schreiben, beobachten" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aufgabe 7: Master-Speicher (`speicher.ts`)

**Files:**
- Create: `packages/master-link/src/speicher.ts`, `packages/master-link/test/speicher.test.ts`
- Modify: `packages/master-link/src/index.ts`, `packages/master-link/test/selftest.ts`

**Interfaces:**
- Consumes: `schreibeAtomar` (Aufgabe 6), `fingerprintVonPem` (Aufgabe 2)
- Produces:
  - Typen: `Identitaet { masterId; name; zertifikat; schluessel }`, `VerbundEintrag`, `VerbundDaten`, `SpeicherLesen<T>`
  - Funktionen:
    - `pruefeIdentitaet(raw)` — null auch, wenn Schlüssel und Zertifikat nicht ladbar sind oder nicht zusammenpassen (Spec 7.2); `pruefeVerbund(raw)`
    - `leseMitBak(pfad, pruefe)`, `schreibeMitBak(pfad, inhalt, pruefe)`, `loescheMitBak(pfad)`
  - Schnittstelle `VerbundSpeicher`: `liste`, `finde`, `setze`, `setzeDiesenRechner`, `entferne`, `entferneFremde`, `gesehen`
  - Klassen:
    - `SpeicherVerbund` (im Speicher)
    - `DateiVerbund(pfad, anfangs, opts?)` mit `schliesse()`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`packages/master-link/test/speicher.test.ts`:
```ts
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { abschnitt, gleich, pruefe, tempOrdner, warte } from './helfer';
import { erzeugeTestZertifikat } from './zertifikate';
import {
  DateiVerbund, leseMitBak, loescheMitBak, pruefeIdentitaet, pruefeVerbund, schreibeMitBak, SpeicherVerbund,
  type VerbundEintrag,
} from '../src/speicher';

const eintrag = (rechnerId: string, dieserRechner = false): VerbundEintrag => ({
  rechnerId, name: rechnerId, schluessel: 'P', gekoppeltAm: 1, zuletztGesehen: null, letzteAdresse: null, dieserRechner,
});

export async function laufe(): Promise<void> {
  const z = erzeugeTestZertifikat();
  const id = { masterId: 'm-1', name: 'Regie-PC', zertifikat: z.cert, schluessel: z.key };

  abschnitt('Speicher: Prüfen');
  gleich(pruefeIdentitaet(id), id, 'gültige Identität');
  gleich(pruefeIdentitaet({ ...id, zertifikat: 'kein PEM' }), null, 'unlesbares Zertifikat → null');
  // GEMESSEN (Spec 7.2): sonst blieb der Master in „lausch-fehler“ (alle 10 s neu, .bak nie versucht) oder zeigte
  // „läuft“, obwohl jeder Handshake scheiterte (Ed25519-Schlüssel zum RSA-Zertifikat).
  const abgelehnt = (raw: unknown): boolean => pruefeIdentitaet(raw) === null;
  const ed25519Pem = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  gleich([
    abgelehnt({ ...id, schluessel: 'kein PEM' }),
    abgelehnt({ ...id, schluessel: erzeugeTestZertifikat().key }),
    abgelehnt({ ...id, schluessel: ed25519Pem }),
    abgelehnt({ ...id, zertifikat: `${z.cert}-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n` }),
  ], [true, true, true, true], 'Schlüssel unlesbar, fremd, Ed25519 zum RSA-Zertifikat; kaputter 2. Zertifikatsblock → null');
  gleich(pruefeVerbund({ version: 1, rechner: [eintrag('a')] }), { version: 1, rechner: [eintrag('a')] }, 'gültiger Verbund');
  gleich(pruefeVerbund({ version: 1, rechner: [{ rechnerId: 'a' }] }), null, 'kaputter Eintrag → ganzer Verbund null');

  abschnitt('Speicher: .bak (Spec 7.3)');
  const o = tempOrdner();
  const pfad = join(o, 'verbund.json');
  gleich(leseMitBak(pfad, pruefeVerbund), { art: 'fehlt' }, 'nichts da → fehlt');
  schreibeMitBak(pfad, JSON.stringify({ version: 1, rechner: [eintrag('a')] }), pruefeVerbund);
  pruefe(!existsSync(`${pfad}.bak`), 'erste Schreibung ohne .bak');
  schreibeMitBak(pfad, JSON.stringify({ version: 1, rechner: [eintrag('a'), eintrag('b')] }), pruefeVerbund);
  gleich(JSON.parse(readFileSync(`${pfad}.bak`, 'utf8')).rechner.length, 1, '.bak hält die vorige gültige Fassung');
  writeFileSync(pfad, '\u0000\u0000\u0000');
  const r = leseMitBak(pfad, pruefeVerbund);
  pruefe(r.art === 'ok' && r.ausBak && r.wert.rechner.length === 1, 'Hauptdatei genullt (Stromausfall) → aus .bak');
  writeFileSync(`${pfad}.bak`, 'Müll');
  gleich(leseMitBak(pfad, pruefeVerbund), { art: 'beschaedigt' }, 'beides kaputt → beschädigt (NIE „leer“)');
  loescheMitBak(pfad);
  gleich(leseMitBak(pfad, pruefeVerbund), { art: 'fehlt' }, 'loescheMitBak entfernt beide');

  abschnitt('Speicher: Verbund im Speicher');
  const v = new SpeicherVerbund([eintrag('selbst', true), eintrag('a')]);
  v.setze({ ...eintrag('a'), name: 'neu' });
  gleich(v.liste().map((e) => e.name), ['selbst', 'neu'], 'setze ersetzt gleiche rechnerId (genau ein Eintrag)');
  v.entferne('selbst');
  gleich(v.liste().length, 2, '„dieser Rechner“ ist nicht entfernbar');
  v.setzeDiesenRechner(eintrag('selbst-neu', true));
  gleich(v.liste().filter((e) => e.dieserRechner).map((e) => e.rechnerId), ['selbst-neu'], 'setzeDiesenRechner ersetzt den eigenen Eintrag');
  v.gesehen('a', 5000, '10.0.0.9', false);
  gleich([v.finde('a')?.zuletztGesehen, v.finde('a')?.letzteAdresse], [5000, '10.0.0.9'], 'gesehen merkt Zeit und Adresse');
  v.entferneFremde();
  gleich(v.liste().map((e) => e.rechnerId), ['selbst-neu'], 'entferneFremde lässt nur „dieser Rechner“');

  abschnitt('Speicher: Datei-Verbund');
  const o2 = tempOrdner();
  const p2 = join(o2, 'verbund.json');
  const dv = new DateiVerbund(p2, { version: 1, rechner: [] }, { schreibIntervallMs: 200 });
  dv.setze(eintrag('a'));
  gleich(JSON.parse(readFileSync(p2, 'utf8')).rechner.length, 1, 'setze schreibt sofort');
  const vorher = statSync(p2).mtimeMs;
  dv.gesehen('a', 1, null, false);
  dv.gesehen('a', 2, null, false);
  await warte(30);
  pruefe(statSync(p2).mtimeMs === vorher || JSON.parse(readFileSync(p2, 'utf8')).rechner[0].zuletztGesehen !== 2,
    'gesehen innerhalb des Intervalls schreibt nicht sofort');
  await warte(250);
  gleich(JSON.parse(readFileSync(p2, 'utf8')).rechner[0].zuletztGesehen, 2, 'nach dem Intervall nachgeschrieben');
  dv.gesehen('a', 3, null, true);
  gleich(JSON.parse(readFileSync(p2, 'utf8')).rechner[0].zuletztGesehen, 3, 'sofort = true (Trennen) schreibt sofort');
  dv.gesehen('a', 4, null, false);
  dv.schliesse();
  gleich(JSON.parse(readFileSync(p2, 'utf8')).rechner[0].zuletztGesehen, 4, 'schliesse holt offene Schreibung nach');
}
```

In `test/selftest.ts` `speicher` ergänzen.

- [ ] **Schritt 2: Test laufen lassen und Fehlschlag sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts`
Expected: FAIL mit `Cannot find module '../src/speicher'`

- [ ] **Schritt 3: `speicher.ts` schreiben**

`packages/master-link/src/speicher.ts`:
```ts
import { createPrivateKey, X509Certificate } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { createSecureContext } from 'node:tls';
import { fingerprintVonPem } from './beweis';
import { schreibeAtomar } from './datei';

// Speicher des Masters (Spec 7.2, 7.3): identitaet.json + verbund.json, je mit .bak.
// „Fehlt“ und „beschädigt“ werden unterschieden — eine gestörte Datei entkoppelt nie still.

export interface Identitaet {
  masterId: string;
  name: string;
  /** PEM-Zertifikat. */
  zertifikat: string;
  /** PEM-Privatschlüssel des Zertifikats. */
  schluessel: string;
}

export interface VerbundEintrag {
  rechnerId: string;
  name: string;
  /** Öffentlicher Ed25519-Schlüssel (SPKI-DER base64) — der Master hält kein Geheimnis der Slaves. */
  schluessel: string;
  gekoppeltAm: number;
  zuletztGesehen: number | null;
  letzteAdresse: string | null;
  dieserRechner: boolean;
}

export interface VerbundDaten {
  version: 1;
  rechner: VerbundEintrag[];
}

type Objekt = Record<string, unknown>;
const istObj = (v: unknown): v is Objekt => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function pruefeIdentitaet(raw: unknown): Identitaet | null {
  if (!istObj(raw)) return null;
  const { masterId, name, zertifikat, schluessel } = raw;
  if (!text(masterId) || typeof name !== 'string' || !text(zertifikat) || !text(schluessel)) return null;
  try {
    fingerprintVonPem(zertifikat);
    // GEMESSEN (Spec 7.2): ein unlesbarer oder fremder Schlüssel oder ein kaputter 2. Zertifikatsblock ließ server.starte()
    // scheitern (ewig „lausch-fehler“, .bak nie versucht). Ein Ed25519-Schlüssel zum RSA-Zertifikat besteht
    // createSecureContext: der Master „läuft“, aber jeder Handshake scheitert. Beides heißt hier „beschädigt“.
    if (!new X509Certificate(zertifikat).checkPrivateKey(createPrivateKey(schluessel))) return null;
    createSecureContext({ key: schluessel, cert: zertifikat });
  } catch {
    return null;
  }
  return { masterId, name, zertifikat, schluessel };
}

export function pruefeVerbund(raw: unknown): VerbundDaten | null {
  if (!istObj(raw) || raw.version !== 1 || !Array.isArray(raw.rechner)) return null;
  const rechner: VerbundEintrag[] = [];
  for (const e of raw.rechner) {
    if (!istObj(e) || !text(e.rechnerId) || typeof e.name !== 'string' || !text(e.schluessel) || typeof e.gekoppeltAm !== 'number') {
      return null;
    }
    rechner.push({
      rechnerId: e.rechnerId,
      name: e.name,
      schluessel: e.schluessel,
      gekoppeltAm: e.gekoppeltAm,
      zuletztGesehen: typeof e.zuletztGesehen === 'number' ? e.zuletztGesehen : null,
      letzteAdresse: typeof e.letzteAdresse === 'string' ? e.letzteAdresse : null,
      dieserRechner: e.dieserRechner === true,
    });
  }
  return { version: 1, rechner };
}

export type SpeicherLesen<T> =
  | { art: 'fehlt' }
  | { art: 'ok'; wert: T; ausBak: boolean }
  | { art: 'beschaedigt' }
  | { art: 'io'; code: string };

type Einzeln<T> = { art: 'fehlt' } | { art: 'ok'; wert: T } | { art: 'beschaedigt' } | { art: 'io'; code: string };

function leseEine<T>(pfad: string, pruefe: (raw: unknown) => T | null): Einzeln<T> {
  let inhalt: string;
  try {
    inhalt = readFileSync(pfad, 'utf8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code ?? 'EIO';
    return code === 'ENOENT' ? { art: 'fehlt' } : { art: 'io', code };
  }
  try {
    const wert = pruefe(JSON.parse(inhalt));
    return wert ? { art: 'ok', wert } : { art: 'beschaedigt' };
  } catch {
    return { art: 'beschaedigt' };
  }
}

export function leseMitBak<T>(pfad: string, pruefe: (raw: unknown) => T | null): SpeicherLesen<T> {
  const haupt = leseEine(pfad, pruefe);
  if (haupt.art === 'ok') return { art: 'ok', wert: haupt.wert, ausBak: false };
  if (haupt.art === 'io') return haupt;
  const bak = leseEine(`${pfad}.bak`, pruefe);
  if (bak.art === 'ok') return { art: 'ok', wert: bak.wert, ausBak: true };
  return haupt.art === 'fehlt' ? { art: 'fehlt' } : { art: 'beschaedigt' };
}

/** Vorhandene GÜLTIGE Fassung wird zuerst zur .bak, dann wird atomar ersetzt. */
export function schreibeMitBak<T>(pfad: string, inhalt: string, pruefe: (raw: unknown) => T | null): void {
  if (leseEine(pfad, pruefe).art === 'ok') schreibeAtomar(`${pfad}.bak`, readFileSync(pfad, 'utf8'));
  schreibeAtomar(pfad, inhalt);
}

export function loescheMitBak(pfad: string): void {
  rmSync(pfad, { force: true });
  rmSync(`${pfad}.bak`, { force: true });
}

export interface VerbundSpeicher {
  liste(): VerbundEintrag[];
  finde(rechnerId: string): VerbundEintrag | undefined;
  /** Ersetzt den Eintrag gleicher rechnerId oder hängt an. */
  setze(e: VerbundEintrag): void;
  /** Ersetzt den Eintrag „dieser Rechner“ (auch bei neuer rechnerId). */
  setzeDiesenRechner(e: VerbundEintrag): void;
  /** „dieser Rechner“ ist nicht entfernbar (no-op). */
  entferne(rechnerId: string): void;
  entferneFremde(): void;
  gesehen(rechnerId: string, zeit: number, adresse: string | null, sofort: boolean): void;
}

export class SpeicherVerbund implements VerbundSpeicher {
  protected eintraege: VerbundEintrag[];

  constructor(anfangs: VerbundEintrag[] = []) {
    this.eintraege = anfangs.map((e) => ({ ...e }));
  }

  liste(): VerbundEintrag[] {
    return this.eintraege.map((e) => ({ ...e }));
  }

  finde(rechnerId: string): VerbundEintrag | undefined {
    const e = this.eintraege.find((x) => x.rechnerId === rechnerId);
    return e ? { ...e } : undefined;
  }

  setze(e: VerbundEintrag): void {
    const i = this.eintraege.findIndex((x) => x.rechnerId === e.rechnerId);
    if (i >= 0) this.eintraege[i] = { ...e };
    else this.eintraege.push({ ...e });
    this.gespeichert();
  }

  setzeDiesenRechner(e: VerbundEintrag): void {
    this.eintraege = [{ ...e, dieserRechner: true }, ...this.eintraege.filter((x) => !x.dieserRechner && x.rechnerId !== e.rechnerId)];
    this.gespeichert();
  }

  entferne(rechnerId: string): void {
    const vorher = this.eintraege.length;
    this.eintraege = this.eintraege.filter((x) => x.rechnerId !== rechnerId || x.dieserRechner);
    if (this.eintraege.length !== vorher) this.gespeichert();
  }

  entferneFremde(): void {
    this.eintraege = this.eintraege.filter((x) => x.dieserRechner);
    this.gespeichert();
  }

  gesehen(rechnerId: string, zeit: number, adresse: string | null, sofort: boolean): void {
    const e = this.eintraege.find((x) => x.rechnerId === rechnerId);
    if (!e) return;
    e.zuletztGesehen = zeit;
    if (adresse) e.letzteAdresse = adresse;
    this.gesehenGeaendert(sofort);
  }

  protected gespeichert(): void {
    /* im Speicher: nichts zu tun */
  }

  protected gesehenGeaendert(_sofort: boolean): void {
    /* im Speicher: nichts zu tun */
  }
}

export class DateiVerbund extends SpeicherVerbund {
  private readonly pfad: string;
  private readonly jetzt: () => number;
  private readonly intervall: number;
  private readonly onFehler: (e: Error) => void;
  private letzteSchreibung = 0;
  private offen = false;
  private zeitgeber: ReturnType<typeof setTimeout> | null = null;

  constructor(
    pfad: string,
    anfangs: VerbundDaten,
    opts: { jetzt?: () => number; schreibIntervallMs?: number; onFehler?: (e: Error) => void } = {},
  ) {
    super(anfangs.rechner);
    this.pfad = pfad;
    this.jetzt = opts.jetzt ?? Date.now;
    this.intervall = opts.schreibIntervallMs ?? 60_000;
    this.onFehler = opts.onFehler ?? (() => {});
  }

  protected override gespeichert(): void {
    this.schreibe();
  }

  protected override gesehenGeaendert(sofort: boolean): void {
    const seit = this.jetzt() - this.letzteSchreibung;
    if (sofort || seit >= this.intervall) {
      this.schreibe();
      return;
    }
    this.offen = true;
    if (!this.zeitgeber) {
      this.zeitgeber = setTimeout(() => {
        this.zeitgeber = null;
        if (this.offen) this.schreibe();
      }, this.intervall - seit);
      this.zeitgeber.unref?.();
    }
  }

  private schreibe(): void {
    this.offen = false;
    this.letzteSchreibung = this.jetzt();
    try {
      schreibeMitBak(this.pfad, `${JSON.stringify({ version: 1, rechner: this.eintraege }, null, 2)}\n`, pruefeVerbund);
    } catch (e) {
      this.onFehler(e as Error);
    }
  }

  schliesse(): void {
    if (this.zeitgeber) {
      clearTimeout(this.zeitgeber);
      this.zeitgeber = null;
    }
    if (this.offen) this.schreibe();
  }
}
```

`src/index.ts` ergänzen: `export * from './speicher';`

- [ ] **Schritt 4: Test grün sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts && npx tsc --noEmit -p tsconfig.json`
Expected: `… 0 fehlgeschlagen.`

- [ ] **Schritt 5: Commit**

```bash
git add packages/master-link/src/speicher.ts packages/master-link/src/index.ts packages/master-link/test/speicher.test.ts packages/master-link/test/selftest.ts
git status --short
git commit -m "feat(master-link): Master-Speicher mit .bak, fehlt ≠ beschädigt" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aufgabe 8: mDNS je Netzwerkkarte (`mdns.ts`)

**Files:**
- Create: `packages/master-link/src/mdns.ts`, `packages/master-link/test/mdns.test.ts`, `packages/master-link/test/mdns-echt.ts`
- Modify: `packages/master-link/src/index.ts`, `packages/master-link/test/selftest.ts`

**Interfaces:**
- Consumes: `Karte`, `listeKarten` (Aufgabe 4); `PROTOKOLL` (Aufgabe 3); `kurzFingerprint` (Aufgabe 2)
- Produces:
  - Typen: `MdnsDienst`, `BonjourLike`, `BonjourFabrik`, `MasterSichtung`, `SucheLike`
  - Konstante: `DIENST_TYP = 'jmps-master'`
  - Funktionen:
    - `standardFabrik(log?)`, `instanzOptionen(karten)`, `instanzName(masterId)`
    - `leseSichtung(s)`, `kuerzeFuerTxt(text, maxBytes?)`
  - Klassen:
    - `MasterAnnonce(fabrik, daten)` mit `starte`, `aktualisiere`, `stoppe`
    - `MdnsSuche(fabrik)` mit `setzeKarten`, `runde`, `stoppe`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`packages/master-link/test/mdns.test.ts`:
```ts
import { abschnitt, gleich, pruefe } from './helfer';
import type { Karte } from '../src/adresswahl';
import {
  DIENST_TYP, instanzName, instanzOptionen, kuerzeFuerTxt, leseSichtung, MasterAnnonce, MdnsSuche,
  type BonjourLike, type MdnsDienst,
} from '../src/mdns';

class FakeBonjour implements BonjourLike {
  readonly opts: { interface: string; bind: string };
  readonly veroeffentlicht: Array<Record<string, unknown>> = [];
  readonly protokoll: string[];
  finds = 0;
  /** Antworten je find()-Aufruf; der letzte Eintrag gilt für alle weiteren Runden. */
  antworten: MdnsDienst[][] = [];

  constructor(opts: { interface: string; bind: string }, protokoll: string[]) {
    this.opts = opts;
    this.protokoll = protokoll;
  }
  publish(o: Record<string, unknown>): unknown {
    this.veroeffentlicht.push(o);
    this.protokoll.push(`publish ${this.opts.interface}`);
    return {};
  }
  find(_o: { type: string }, onUp?: (s: MdnsDienst) => void): { stop(): void } {
    const runde = this.antworten[this.finds] ?? this.antworten[this.antworten.length - 1] ?? [];
    this.finds++;
    let gestoppt = false;
    setTimeout(() => {
      if (!gestoppt) for (const s of runde) onUp?.(s);
    }, 5);
    return { stop: () => { gestoppt = true; } };
  }
  unpublishAll(cb?: () => void): void {
    this.protokoll.push(`unpublishAll ${this.opts.interface}`);
    setTimeout(() => cb?.(), 1);
  }
  destroy(cb?: () => void): void {
    this.protokoll.push(`destroy ${this.opts.interface}`);
    cb?.();
  }
}

const karten: Karte[] = [
  { name: 'Ethernet 2', adressen: [{ adresse: '10.0.0.110', praefix: 24 }, { adresse: '10.0.1.110', praefix: 24 }], virtuell: false, nurLinkLocal: false },
  { name: 'WLAN', adressen: [{ adresse: '192.168.1.20', praefix: 24 }], virtuell: false, nurLinkLocal: false },
];

export async function laufe(): Promise<void> {
  abschnitt('mDNS: Instanzen (Spec 4.2)');
  gleich(instanzOptionen(karten), [
    { interface: '10.0.0.110', bind: '0.0.0.0' },
    { interface: '192.168.1.20', bind: '0.0.0.0' },
  ], 'je Karte eine Instanz, erste IPv4, bind 0.0.0.0 (macOS)');
  gleich(instanzName('abcdef12-3456-7890-abcd-ef1234567890'), 'jm-master-abcdef12', 'Instanzname aus masterId');
  pruefe(instanzName('11111111-aaaa') !== instanzName('22222222-aaaa'), 'zwei Master → zwei Instanznamen (Review Focus 4)');
  gleich(DIENST_TYP, 'jmps-master', 'Diensttyp ohne Unterstrich (bonjour-service ergänzt ihn)');

  abschnitt('mDNS: Sichtung lesen');
  gleich(leseSichtung({ name: 'x', port: 8738, addresses: ['10.0.0.1', 'fe80::1'], txt: { id: 'm-1', name: 'Regie-PC', fp: 'ab', p: '1' } }),
    { masterId: 'm-1', name: 'Regie-PC', fpKurz: 'ab', protokoll: 1, adressen: ['10.0.0.1'] }, 'String-TXT, nur IPv4');
  gleich(leseSichtung({ name: 'x', port: 1, txt: { id: Buffer.from('m-2'), name: Buffer.from('Säle'), p: Buffer.from('1') } })?.name, 'Säle', 'Buffer-TXT wird UTF-8');
  gleich(leseSichtung({ name: 'x', port: 1, txt: { name: 'ohne id' } }), null, 'ohne id → keine Sichtung');

  abschnitt('mDNS: Annonce');
  const protokoll: string[] = [];
  const instanzen: FakeBonjour[] = [];
  const fabrik = (o: { interface: string; bind: string }) => {
    const b = new FakeBonjour(o, protokoll);
    instanzen.push(b);
    return b;
  };
  const langName = '🎬'.repeat(70); // 280 Byte: ohne kuerzeFuerTxt wäre „name=…“ über 255 Byte
  const a = new MasterAnnonce(fabrik, { masterId: 'abcdef12-0000', name: langName, fp: 'f'.repeat(64), port: 8738 });
  a.starte(karten);
  gleich(instanzen.length, 2, 'Annonce auf zwei Karten');
  const pub = instanzen[0].veroeffentlicht[0] as { name: string; type: string; port: number; probe: boolean; disableIPv6: boolean; txt: Record<string, string> };
  gleich([pub.name, pub.type, pub.port, pub.probe, pub.disableIPv6], ['jm-master-abcdef12', 'jmps-master', 8738, false, true], 'publish-Optionen');
  gleich([pub.txt.id, pub.txt.fp, pub.txt.p], ['abcdef12-0000', 'f'.repeat(16), '1'], 'TXT id, Kurz-Fingerprint, Protokoll');
  pruefe(Buffer.byteLength(`name=${pub.txt.name}`) <= 255, `TXT name ≤ 255 Byte (${Buffer.byteLength(`name=${pub.txt.name}`)}) (Review Focus 1)`);
  pruefe(Buffer.byteLength(kuerzeFuerTxt('ü'.repeat(300))) <= 250, 'kuerzeFuerTxt kürzt nach Bytes');
  pruefe(!kuerzeFuerTxt('🎬'.repeat(100)).includes('\uFFFD'), 'kuerzeFuerTxt schneidet kein Zeichen entzwei');
  await a.stoppe();
  const i0 = protokoll.indexOf('unpublishAll 10.0.0.110');
  const d0 = protokoll.indexOf('destroy 10.0.0.110');
  pruefe(i0 >= 0 && d0 > i0, 'stoppe: erst unpublishAll (Goodbye), dann destroy');

  abschnitt('mDNS: Suche mit neuem Browser je Runde');
  instanzen.length = 0;
  const s = new MdnsSuche(fabrik);
  s.setzeKarten(karten);
  gleich(instanzen.length, 2, 'Suche: eine Instanz je Karte');
  instanzen[0].antworten = [
    [{ name: 'a', port: 8738, addresses: ['10.0.0.50'], txt: { id: 'm-1', name: 'Regie-PC', fp: 'aa', p: '1' } }],
    [{ name: 'a', port: 8738, addresses: ['10.0.0.77'], txt: { id: 'm-1', name: 'Regie-PC', fp: 'aa', p: '1' } }],
  ];
  instanzen[1].antworten = [[
    { name: 'a', port: 8738, addresses: ['192.168.1.50'], txt: { id: 'm-1', name: 'Regie-PC', fp: 'aa', p: '1' } },
    { name: 'b', port: 8738, addresses: ['192.168.1.60'], txt: { id: 'm-2', name: 'Regie-PC', fp: 'bb', p: '1' } },
  ]];
  const r1 = await s.runde(50);
  gleich(r1.find((x) => x.masterId === 'm-1')?.adressen, ['10.0.0.50', '192.168.1.50'], 'Adressen derselben masterId zusammengeführt');
  gleich(r1.length, 2, 'zwei Master mit gleichem Namen bleiben unterscheidbar (Review Focus 4)');
  const r2 = await s.runde(50);
  gleich(r2.find((x) => x.masterId === 'm-1')?.adressen, ['10.0.0.77', '192.168.1.50'], 'neue Runde liefert die NEUE Adresse (kein alter Browser-Stand)');
  gleich(instanzen.map((i) => i.finds), [2, 2], 'je Runde ein neuer find()');
  s.setzeKarten(karten);
  gleich(instanzen.length, 2, 'gleiche Karten → keine neuen Instanzen');
  const zerstoertVorher = protokoll.filter((p) => p.startsWith('destroy')).length;
  s.setzeKarten([karten[1]]);
  gleich(instanzen.length, 3, 'andere Karten → Instanzen neu angelegt');
  gleich(protokoll.filter((p) => p.startsWith('destroy')).length - zerstoertVorher, 2, 'beide alten Instanzen zerstört');
  s.stoppe();
}
```

`packages/master-link/test/mdns-echt.ts` (echtes Multicast, nur lokal: `npm run selftest:mdns -w @jm/master-link`):
```ts
// Echter mDNS-Durchlauf auf den Karten DIESES Rechners (nicht in der CI: dort gibt es kein Multicast).
import { networkInterfaces } from 'node:os';
import { randomUUID } from 'node:crypto';
import { listeKarten } from '../src/adresswahl';
import { MasterAnnonce, MdnsSuche, standardFabrik } from '../src/mdns';

const karten = listeKarten(networkInterfaces());
console.log('Karten:', karten.map((k) => `${k.name} ${k.adressen.map((a) => `${a.adresse}/${a.praefix}`).join(',')}`).join(' | '));
const log = (t: string): void => console.log(`  (mDNS) ${t}`);
const masterId = randomUUID();
const annonce = new MasterAnnonce(standardFabrik(log), { masterId, name: 'Selbsttest-Master', fp: 'ab'.repeat(32), port: 18738 });
annonce.starte(karten);
const suche = new MdnsSuche(standardFabrik(log));
suche.setzeKarten(karten);
await new Promise((r) => setTimeout(r, 500));
const sichtungen = await suche.runde(2000);
const meine = sichtungen.find((s) => s.masterId === masterId);
console.log(meine ? `gefunden: ${meine.name} ${meine.adressen.join(', ')}` : 'NICHT gefunden');
await annonce.stoppe();
suche.stoppe();
process.exit(meine ? 0 : 1);
```

In `test/selftest.ts` `mdns` ergänzen.

- [ ] **Schritt 2: Test laufen lassen und Fehlschlag sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts`
Expected: FAIL mit `Cannot find module '../src/mdns'`

- [ ] **Schritt 3: `mdns.ts` schreiben**

`packages/master-link/src/mdns.ts`:
```ts
import type { EventEmitter } from 'node:events';
import BonjourPaket from 'bonjour-service';
import type { Karte } from './adresswahl';
import { kurzFingerprint } from './beweis';
import { PROTOKOLL } from './rahmen';

// mDNS des Master-Links (Spec 4.2, 4.5). GEMESSEN (bonjour-service 1.4.0 / multicast-dns 7.2.5):
//  - benannter Import { Bonjour } scheitert unter ESM → Default-Import, dann .Bonjour
//  - ohne `interface` wird nur über EINE Karte gesendet → eine Instanz je Karte
//  - `interface` ohne `bind` bindet an die Karten-IP → unter macOS kommt kein Multicast an
//  - ein langlebiger Browser übernimmt neue Adressen eines bekannten Dienstes NIE → je Runde neuer find()
//  - probe verwirft still eine zweite Veröffentlichung gleichen Namens → probe:false + Name aus masterId
//  - multicast-dns meldet Bind-Fehler als 'error', bonjour-service hört das nicht ab → sonst Absturz

export const DIENST_TYP = 'jmps-master';

export interface MdnsDienst {
  name: string;
  port: number;
  addresses?: string[];
  txt?: Record<string, unknown> | null;
}

export interface BonjourLike {
  publish(o: { name: string; type: string; port: number; txt: Record<string, string>; probe: boolean; disableIPv6: boolean }): unknown;
  find(o: { type: string }, onUp?: (s: MdnsDienst) => void): { stop(): void };
  unpublishAll(cb?: () => void): void;
  destroy(cb?: () => void): void;
}

export type BonjourFabrik = (o: { interface: string; bind: string }) => BonjourLike;

export function standardFabrik(log: (text: string) => void = () => {}): BonjourFabrik {
  return (o) => {
    // interface/bind gehen 1:1 an multicast-dns, stehen aber nicht im Typ ServiceConfig.
    const b = new BonjourPaket.Bonjour(
      o as unknown as Partial<BonjourPaket.ServiceConfig>,
      (e: Error) => log(`mDNS-Antwort fehlgeschlagen: ${e.message}`), // Vorgabe wirft sonst im dgram-Callback
    );
    const mdns = (b as unknown as { server: { mdns: EventEmitter } }).server.mdns;
    mdns.on('error', (e: Error) => log(`mDNS-Fehler auf ${o.interface}: ${e.message}`));
    mdns.on('warning', (e: Error) => log(`mDNS-Warnung auf ${o.interface}: ${e.message}`));
    return b as unknown as BonjourLike;
  };
}

export function instanzOptionen(karten: Karte[]): { interface: string; bind: '0.0.0.0' }[] {
  return karten
    .filter((k) => k.adressen.length > 0)
    .map((k) => ({ interface: k.adressen[0].adresse, bind: '0.0.0.0' as const }));
}

export function instanzName(masterId: string): string {
  return `jm-master-${masterId.replace(/-/g, '').slice(0, 8)}`;
}

/** Ein TXT-Eintrag darf 255 Byte haben (sonst läuft dns-packet still über) — nach ganzen Zeichen kürzen. */
export function kuerzeFuerTxt(text: string, maxBytes = 250): string {
  let aus = '';
  for (const z of text) {
    if (Buffer.byteLength(aus + z) > maxBytes) break;
    aus += z;
  }
  return aus;
}

export interface MasterSichtung {
  masterId: string;
  name: string;
  fpKurz: string;
  protokoll: number;
  adressen: string[];
}

function txtWert(txt: Record<string, unknown> | null | undefined, key: string): string {
  const v = txt?.[key];
  if (typeof v === 'string') return v;
  if (Buffer.isBuffer(v)) return v.toString('utf8');
  return '';
}

export function leseSichtung(s: MdnsDienst): MasterSichtung | null {
  const masterId = txtWert(s.txt, 'id');
  if (!masterId) return null;
  const p = Number(txtWert(s.txt, 'p'));
  return {
    masterId,
    name: txtWert(s.txt, 'name') || s.name,
    fpKurz: txtWert(s.txt, 'fp'),
    protokoll: Number.isInteger(p) ? p : 0,
    adressen: (s.addresses ?? []).filter((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a)),
  };
}

export class MasterAnnonce {
  private readonly fabrik: BonjourFabrik;
  private readonly daten: { masterId: string; name: string; fp: string; port: number };
  private instanzen: BonjourLike[] = [];

  constructor(fabrik: BonjourFabrik, daten: { masterId: string; name: string; fp: string; port: number }) {
    this.fabrik = fabrik;
    this.daten = { ...daten };
  }

  starte(karten: Karte[]): void {
    for (const o of instanzOptionen(karten)) {
      const b = this.fabrik(o);
      b.publish({
        name: instanzName(this.daten.masterId),
        type: DIENST_TYP,
        port: this.daten.port,
        txt: {
          id: this.daten.masterId,
          name: kuerzeFuerTxt(this.daten.name),
          fp: kurzFingerprint(this.daten.fp),
          p: String(PROTOKOLL),
        },
        probe: false,
        disableIPv6: true,
      });
      this.instanzen.push(b);
    }
  }

  /** Neuer Name bzw. andere Karten: erst sauber abmelden (Goodbye), dann neu annoncieren. */
  async aktualisiere(karten: Karte[], name?: string): Promise<void> {
    await this.stoppe();
    if (name !== undefined) this.daten.name = name;
    this.starte(karten);
  }

  async stoppe(): Promise<void> {
    const alte = this.instanzen;
    this.instanzen = [];
    await Promise.all(
      alte.map(
        (b) =>
          new Promise<void>((fertig) => {
            let erledigt = false;
            const ende = (): void => {
              if (erledigt) return;
              erledigt = true;
              try {
                b.destroy();
              } catch {
                /* schon zu */
              }
              fertig();
            };
            const notfall = setTimeout(ende, 1000);
            try {
              b.unpublishAll(() => {
                clearTimeout(notfall);
                ende();
              });
            } catch {
              clearTimeout(notfall);
              ende();
            }
          }),
      ),
    );
  }
}

export interface SucheLike {
  runde(dauerMs: number): Promise<MasterSichtung[]>;
  setzeKarten(k: Karte[]): void;
  stoppe(): void;
}

export class MdnsSuche implements SucheLike {
  private readonly fabrik: BonjourFabrik;
  private instanzen: BonjourLike[] = [];
  private schluessel = '';

  constructor(fabrik: BonjourFabrik) {
    this.fabrik = fabrik;
  }

  setzeKarten(karten: Karte[]): void {
    const opts = instanzOptionen(karten);
    const s = JSON.stringify(opts);
    if (s === this.schluessel) return;
    this.stoppe();
    this.schluessel = s;
    this.instanzen = opts.map((o) => this.fabrik(o));
  }

  runde(dauerMs: number): Promise<MasterSichtung[]> {
    const gefunden = new Map<string, MasterSichtung>();
    const browser = this.instanzen.map((b) =>
      b.find({ type: DIENST_TYP }, (s) => {
        const z = leseSichtung(s);
        if (!z) return;
        const alt = gefunden.get(z.masterId);
        gefunden.set(z.masterId, alt ? { ...alt, adressen: [...new Set([...alt.adressen, ...z.adressen])] } : z);
      }),
    );
    return new Promise((fertig) => {
      setTimeout(() => {
        for (const br of browser) {
          try {
            br.stop();
          } catch {
            /* egal */
          }
        }
        fertig([...gefunden.values()]);
      }, dauerMs);
    });
  }

  stoppe(): void {
    for (const b of this.instanzen) {
      try {
        b.destroy();
      } catch {
        /* egal */
      }
    }
    this.instanzen = [];
    this.schluessel = '';
  }
}
```

`src/index.ts` ergänzen: `export * from './mdns';`

- [ ] **Schritt 4: Tests grün sehen, echtes mDNS lokal prüfen**

Run:
```bash
cd packages/master-link && npx tsx test/selftest.ts && npx tsc --noEmit -p tsconfig.json
npm run selftest:mdns
```
Expected:
- Selbsttests `… 0 fehlgeschlagen.`, tsc ohne Ausgabe.
- `selftest:mdns` meldet `gefunden: Selbsttest-Master 10.0.0.110` (die eigene LAN-IP) und Exit 0.
- Scheitert nur `selftest:mdns`, die Ausgabe (Warnungen, Karten) im Commit-Text festhalten. Es ist kein CI-Test.

- [ ] **Schritt 5: Commit**

```bash
git add packages/master-link/src/mdns.ts packages/master-link/src/index.ts packages/master-link/test/mdns.test.ts packages/master-link/test/mdns-echt.ts packages/master-link/test/selftest.ts
git status --short
git commit -m "feat(master-link): mDNS je Netzwerkkarte, frischer Browser je Suchrunde" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Aufgabe 9: Master-Server: Anmeldung, Teilnehmer, Grenzen (`server.ts`)

**Files:**
- Create: `packages/master-link/src/server.ts`
- Create: `packages/master-link/test/rohclient.ts`, `packages/master-link/test/aufbau.ts`, `packages/master-link/test/server.test.ts`
- Modify: `packages/master-link/src/index.ts`, `packages/master-link/test/selftest.ts`

**Interfaces:**
- Consumes:
  - aus Aufgabe 1: `Fristen`, `GRENZEN`, `kuerzeName`, `MASTER_PORT`
  - aus Aufgabe 2: `fingerprintVonPem`, `pruefeAnmeldung`
  - aus Aufgabe 3: `Verbindung`, `PROTOKOLL`, `Nachricht`, `TeilnehmerInfo`, `Grund`
  - aus Aufgabe 4: `listeKarten`, `NetzwerkInterfaces`
  - aus Aufgabe 7: `Identitaet`, `VerbundSpeicher`
- Produces:
  - `TeilnehmerStand`, `KopplungsStand`, `ServerOptionen` (inkl. `ratenAusnahme?: (ip) => boolean`)
  - `MasterLinkServer`:
    - Eigenschaften: `fingerprint`, `gestartet`
    - Methoden: `port()`, `starte()`, `setzeLauschAdressen(a)`, `adressenFuerSlaves()`, `setzeName(n)`, `teilnehmer()`, `rechnerOnline(id)`, `entferne(id)`, `stoppe()`
    - Ereignisse: `aenderung`, `warnung`
    - Kopplung folgt in Aufgabe 10.
  - Testhilfen: `verbindeRoh(port)`, `baueServer(teil?, fristen?)`, `meldeAn(aufbau, rechner?, appId?)`

- [ ] **Schritt 1: Testhilfen schreiben**

`packages/master-link/test/rohclient.ts`:
```ts
// Ein Protokoll-Client „von Hand“ (ohne Pin) — für Server-Tests vor dem echten Client.
import { connect, type TLSSocket } from 'node:tls';
import { certFingerprint } from '@jm/auth-core';
import { GRENZEN } from '../src/fristen';
import type { Nachricht } from '../src/rahmen';
import { Verbindung } from '../src/verbindung';
import { warte } from './helfer';

export interface RohClient {
  v: Verbindung;
  socket: TLSSocket;
  fp: string;
  hallo: Extract<Nachricht, { t: 'hallo' }>;
  nachrichten: Nachricht[];
  naechste(t: Nachricht['t'], maxMs?: number): Promise<Nachricht | null>;
  beendet(): boolean;
  zu(): void;
}

export async function verbindeRoh(port: number, host = '127.0.0.1'): Promise<RohClient> {
  const socket = connect({ host, port, rejectUnauthorized: false });
  await new Promise<void>((ok, fehler) => {
    socket.once('secureConnect', () => ok());
    socket.once('error', fehler);
  });
  const fp = certFingerprint(socket.getPeerCertificate().raw);
  const v = new Verbindung(socket, GRENZEN.nachAnmeldung);
  const nachrichten: Nachricht[] = [];
  let ende = false;
  v.on('nachricht', (n: Nachricht) => nachrichten.push(n));
  v.on('ende', () => {
    ende = true;
  });
  const naechste = async (t: Nachricht['t'], maxMs = 2000): Promise<Nachricht | null> => {
    const ablauf = Date.now() + maxMs;
    while (Date.now() < ablauf) {
      const i = nachrichten.findIndex((n) => n.t === t);
      if (i >= 0) return nachrichten.splice(i, 1)[0];
      await warte(5);
    }
    return null;
  };
  const hallo = await naechste('hallo');
  if (!hallo || hallo.t !== 'hallo') throw new Error('kein hallo');
  return { v, socket, fp, hallo, nachrichten, naechste, beendet: () => ende, zu: () => socket.destroy() };
}
```

`packages/master-link/test/aufbau.ts`:
```ts
import { randomUUID } from 'node:crypto';
import { erzeugeSchluesselpaar, signiereAnmeldung, type Schluesselpaar } from '../src/beweis';
import type { Fristen } from '../src/fristen';
import { PROTOKOLL } from '../src/rahmen';
import { MasterLinkServer, type ServerOptionen } from '../src/server';
import { SpeicherVerbund, type Identitaet } from '../src/speicher';
import { verbindeRoh, type RohClient } from './rohclient';
import { erzeugeTestZertifikat } from './zertifikate';

export interface TestRechner {
  rechnerId: string;
  paar: Schluesselpaar;
}

export interface Aufbau {
  server: MasterLinkServer;
  port: number;
  identitaet: Identitaet;
  verbund: SpeicherVerbund;
  /** Gekoppelter fremder Rechner „Regie-Laptop 2“. */
  slave: TestRechner;
  /** Selbstkopplung des Master-Rechners. */
  eigen: TestRechner;
}

export function neueIdentitaet(name = 'Regie-PC'): Identitaet {
  const z = erzeugeTestZertifikat();
  return { masterId: randomUUID(), name, zertifikat: z.cert, schluessel: z.key };
}

/** Master auf 127.0.0.1, freier Port (0), ein fremder und der eigene Rechner gekoppelt. */
export async function baueServer(teil: Partial<ServerOptionen> = {}, fristen: Partial<Fristen> = {}): Promise<Aufbau> {
  const identitaet = teil.identitaet ?? neueIdentitaet();
  const slave: TestRechner = { rechnerId: 'rechner-b', paar: erzeugeSchluesselpaar() };
  const eigen: TestRechner = { rechnerId: 'rechner-a', paar: erzeugeSchluesselpaar() };
  const verbund = new SpeicherVerbund([
    { rechnerId: eigen.rechnerId, name: 'Regie-PC', schluessel: eigen.paar.oeffentlich, gekoppeltAm: 1, zuletztGesehen: null, letzteAdresse: null, dieserRechner: true },
    { rechnerId: slave.rechnerId, name: 'Regie-Laptop 2', schluessel: slave.paar.oeffentlich, gekoppeltAm: 1, zuletztGesehen: null, letzteAdresse: null, dieserRechner: false },
  ]);
  const server = new MasterLinkServer({
    identitaet,
    verbund,
    eigeneRechnerId: eigen.rechnerId,
    suiteVersion: '0.12.0',
    lauschAdressen: ['127.0.0.1'],
    port: 0,
    fristen,
    ...teil,
  });
  await server.starte();
  return { server, port: server.port(), identitaet, verbund, slave, eigen };
}

export async function meldeAn(a: Aufbau, rechner: TestRechner = a.slave, appId = 'jm-timer'): Promise<RohClient> {
  const c = await verbindeRoh(a.port);
  c.v.sende({
    t: 'anmelden',
    protokoll: PROTOKOLL,
    rechnerId: rechner.rechnerId,
    rechnerName: 'Regie-Laptop 2',
    signatur: signiereAnmeldung(rechner.paar.privat, c.fp, c.hallo.nonce, rechner.rechnerId),
    teilnehmer: { art: 'tool', appId, name: appId, version: '0.12.0', pid: 1 },
  });
  return c;
}
```

- [ ] **Schritt 2: Den fehlschlagenden Test schreiben**

`packages/master-link/test/server.test.ts`:
```ts
import { existsSync, readFileSync } from 'node:fs';
import { connect as netConnect, type Socket } from 'node:net';
import type { NetworkInterfaceInfo } from 'node:os';
import { join } from 'node:path';
import { erzeugeSchluesselpaar, signiereAnmeldung } from '../src/beweis';
import { GRENZEN } from '../src/fristen';
import { PROTOKOLL } from '../src/rahmen';
import { MasterLinkServer } from '../src/server';
import { DateiVerbund, SpeicherVerbund, type VerbundEintrag } from '../src/speicher';
import { baueServer, meldeAn, neueIdentitaet } from './aufbau';
import { abschnitt, bis, gleich, pruefe, tempOrdner, warte } from './helfer';
import { verbindeRoh } from './rohclient';

export async function laufe(): Promise<void> {
  abschnitt('Server: Anmeldung (Spec 3.4, 5.1)');
  {
    const a = await baueServer();
    const c = await meldeAn(a);
    const ang = await c.naechste('angemeldet');
    pruefe(ang?.t === 'angemeldet' && ang.suite === '0.12.0', 'richtige Signatur → angemeldet mit Suite-Version');
    gleich(a.server.teilnehmer().map((t) => [t.rechnerId, t.appId, t.art]), [['rechner-b', 'jm-timer', 'tool']], 'Teilnehmer unter rechnerId + appId');
    pruefe(a.server.rechnerOnline('rechner-b'), 'Rechner online, solange ein Teilnehmer verbunden ist');
    pruefe(a.server.rechnerOnline('rechner-a'), '„dieser Rechner“ online, solange der Server läuft');
    pruefe(a.verbund.finde('rechner-b')?.letzteAdresse === '127.0.0.1', 'letzte Adresse gemerkt');
    c.zu();
    await bis(() => a.server.teilnehmer().length === 0);
    gleich(a.server.teilnehmer().length, 0, 'Verbindung weg → sofort getrennt');
    pruefe(!a.server.rechnerOnline('rechner-b'), 'Rechner offline');
    await a.server.stoppe();
  }
  {
    const a = await baueServer();
    const c = await verbindeRoh(a.port);
    c.v.sende({ t: 'anmelden', protokoll: 2, rechnerId: 'rechner-b', rechnerName: 'B', signatur: 'x', teilnehmer: { art: 'tool', appId: 'a', name: 'a', version: '1', pid: 1 } });
    const ab = await c.naechste('abgelehnt');
    gleich(ab, { t: 'abgelehnt', grund: 'protokoll', master: PROTOKOLL, suite: '0.12.0' }, 'anderes Protokoll → abgelehnt mit Stand des Masters');
    await bis(() => c.beendet());
    pruefe(c.beendet(), 'danach Verbindung zu');

    const u = await meldeAn(a, { rechnerId: 'rechner-x', paar: erzeugeSchluesselpaar() });
    gleich(await u.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'unbekannt' }, 'unbekannter Rechner → unbekannt');

    const f = await meldeAn(a, { rechnerId: 'rechner-b', paar: erzeugeSchluesselpaar() });
    gleich(await f.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'signatur' }, 'falscher Schlüssel → signatur');

    const w = await verbindeRoh(a.port);
    const alt = signiereAnmeldung(a.slave.paar.privat, w.fp, '00'.repeat(16), 'rechner-b');
    w.v.sende({ t: 'anmelden', protokoll: 1, rechnerId: 'rechner-b', rechnerName: 'B', signatur: alt, teilnehmer: { art: 'tool', appId: 'a', name: 'a', version: '1', pid: 1 } });
    gleich(await w.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'signatur' }, 'Signatur zu fremder Nonce → signatur (keine Wiederholung)');

    const e = await verbindeRoh(a.port);
    e.v.sende({ t: 'puls' });
    await bis(() => e.beendet());
    pruefe(e.beendet(), 'erste Nachricht weder anmelden noch koppeln → Verbindung zu');

    const k = await verbindeRoh(a.port);
    k.v.sende({ t: 'koppeln', protokoll: 1, rechnerId: 'r', rechnerName: 'n', nonce: 'n', schluessel: 'P', beweis: 'b' });
    gleich(await k.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'keine-kopplung-offen' }, 'koppeln ohne offenes Fenster → keine-kopplung-offen');
    await a.server.stoppe();
  }

  abschnitt('Server: ersetzt, entfernen');
  {
    const warnungen: string[] = [];
    const a = await baueServer();
    a.server.on('warnung', (t: string) => warnungen.push(t));
    const erst = await meldeAn(a);
    await erst.naechste('angemeldet');
    const zweit = await meldeAn(a);
    await zweit.naechste('angemeldet');
    gleich(await erst.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'ersetzt' }, 'gleicher Schlüssel → alte Verbindung ersetzt');
    gleich(a.server.teilnehmer().length, 1, 'genau ein Teilnehmer bleibt');
    pruefe(warnungen.some((t) => t.includes('doppelt aktiv')), 'Warnung „doppelt aktiv“, weil die alte Verbindung lebte');

    const eigenTool = await meldeAn(a, a.eigen, 'jm-titler');
    await eigenTool.naechste('angemeldet');
    a.server.entferne('rechner-b');
    gleich(await zweit.naechste('abgelehnt', 1000), { t: 'abgelehnt', grund: 'unbekannt' }, 'entfernen während verbunden → sofort unbekannt');
    await bis(() => zweit.beendet(), 1000);
    pruefe(zweit.beendet(), 'Verbindung des entfernten Rechners binnen 1 s zu');
    pruefe(!eigenTool.beendet(), 'andere Rechner bleiben verbunden');
    gleich(a.verbund.finde('rechner-b'), undefined, 'Eintrag gelöscht');
    a.server.entferne('rechner-a');
    pruefe(a.verbund.finde('rechner-a') !== undefined, '„dieser Rechner“ ist nicht entfernbar');
    await a.server.stoppe();
  }

  abschnitt('Server: Puls und Stille');
  {
    const a = await baueServer({}, { pulsMs: 100, stilleMs: 300 });
    const still = await meldeAn(a);
    await still.naechste('angemeldet');
    const lebt = await meldeAn(a, a.eigen, 'jm-titler');
    await lebt.naechste('angemeldet');
    const puls = setInterval(() => lebt.v.sende({ t: 'puls' }), 100);
    pruefe((await lebt.naechste('puls', 500)) !== null, 'Master sendet Puls');
    await bis(() => still.beendet(), 1500);
    pruefe(still.beendet(), 'ohne Zeile vom Client → nach stilleMs getrennt');
    await warte(400);
    pruefe(!lebt.beendet(), 'Client mit Puls bleibt verbunden');
    clearInterval(puls);
    await a.server.stoppe();
  }

  abschnitt('Server: Grenzen vor der Anmeldung (Spec 6.3)');
  {
    const a = await baueServer({}, { anmeldefristMs: 200, handshakeMs: 200 });
    const c = await verbindeRoh(a.port);
    gleich(await c.naechste('abgelehnt', 1000), { t: 'abgelehnt', grund: 'anmeldefrist' }, 'nichts gesendet → anmeldefrist');
    // Eigener Server mit langer Anmeldefrist — sonst schlösse die Anmeldefrist (200 ms) den Socket, nicht der Handshake.
    const h = await baueServer({}, { anmeldefristMs: 5000, handshakeMs: 200 });
    const roh = netConnect(h.port, '127.0.0.1');
    roh.on('error', () => {});
    let zu = false;
    roh.on('close', () => { zu = true; });
    await bis(() => zu, 1500);
    pruefe(zu, 'TCP ohne TLS-Handshake → nach handshakeMs zu (tlsClientError → destroy)');
    await h.server.stoppe();
    await a.server.stoppe();
    // Eigener Server mit langer Anmeldefrist — sonst könnte bei langsamem Handshake die Anmeldefrist schließen, nicht die Zeilengrenze.
    const g = await baueServer({}, { anmeldefristMs: 5000 });
    const lang = await verbindeRoh(g.port);
    lang.socket.write('x'.repeat(GRENZEN.vorAnmeldung + 100));
    await bis(() => lang.beendet(), 1000);
    pruefe(lang.beendet() && lang.nachrichten.length === 0, 'Zeile > 4 KiB vor der Anmeldung → sofort zu (ohne „abgelehnt“: Zeilengrenze, nicht Anmeldefrist)');
    await g.server.stoppe();
  }
  {
    const a = await baueServer();
    const sockets: Socket[] = [];
    let ersterZu = false;
    for (let i = 0; i <= GRENZEN.maxUnangemeldet; i++) {
      if (i === GRENZEN.maxUnangemeldet) {
        await warte(100);
        pruefe(!ersterZu, `${GRENZEN.maxUnangemeldet} unangemeldete Verbindungen sind erlaubt`);
      }
      const s = netConnect(a.port, '127.0.0.1');
      s.on('error', () => {});
      if (i === 0) s.on('close', () => { ersterZu = true; });
      sockets.push(s);
      await new Promise<void>((r) => s.once('connect', () => r()));
    }
    await bis(() => ersterZu, 1000);
    pruefe(ersterZu, `${GRENZEN.maxUnangemeldet + 1}. unangemeldete Verbindung → älteste fliegt`);
    sockets.forEach((s) => s.destroy());
    await a.server.stoppe();
  }
  {
    const a = await baueServer();
    const c = await meldeAn(a);
    await c.naechste('angemeldet');
    c.socket.write(`{"t":"gross","x":"${'y'.repeat(100_000)}"}\n`);
    await warte(200);
    pruefe(!c.beendet(), 'nach der Anmeldung sind 100-KB-Zeilen erlaubt (1 MiB)');
    await a.server.stoppe();
  }

  abschnitt('Server: Ratenlimit (nur Fehlschläge)');
  {
    const a = await baueServer({ ratenAusnahme: () => false });
    const fremd = { rechnerId: 'rechner-b', paar: erzeugeSchluesselpaar() };
    let zuFrueh = 0;
    for (let i = 0; i < GRENZEN.ratenLimit; i++) {
      const c = await meldeAn(a, fremd);
      const ab = await c.naechste('abgelehnt');
      if (ab?.t === 'abgelehnt' && ab.grund === 'last') zuFrueh++;
    }
    gleich(zuFrueh, 0, `die ersten ${GRENZEN.ratenLimit} Fehlschläge → signatur, noch nicht last`);
    const richtig = await meldeAn(a);
    gleich(await richtig.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'last' }, '21. Versuch → last');
    await a.server.stoppe();
  }
  {
    const a = await baueServer();
    const fremd = { rechnerId: 'rechner-b', paar: erzeugeSchluesselpaar() };
    let last = 0;
    for (let i = 0; i < GRENZEN.ratenLimit + 3; i++) {
      const c = await meldeAn(a, fremd);
      const ab = await c.naechste('abgelehnt');
      if (ab?.t === 'abgelehnt' && ab.grund === 'last') last++;
    }
    gleich(last, 0, 'Loopback ist vom Ratenlimit ausgenommen (Tools am Master)');
    await a.server.stoppe();
  }
  {
    // Gegenprobe (Spec 6.3, 11.1 Nr. 9): viele ERFOLGREICHE Anmeldungen einer nicht ausgenommenen IP → nie „last“.
    const a = await baueServer({ ratenAusnahme: () => false });
    let abgewiesen = 0;
    for (let i = 0; i < GRENZEN.ratenLimit + 5; i++) {
      const c = await meldeAn(a, a.slave, `jm-app-${i}`);
      if ((await c.naechste('angemeldet', 1000)) === null) abgewiesen++;
    }
    gleich(abgewiesen, 0, `${GRENZEN.ratenLimit + 5} erfolgreiche Anmeldungen einer IP → kein „last“ (nur Fehlschläge zählen)`);
    await a.server.stoppe();
  }

  abschnitt('Server: „zuletzt gesehen“ (Spec 5.1)');
  {
    // Injizierte Uhr für Server UND Verbundspeicher; der Speicher schreibt höchstens alle 60 s, beim Trennen sofort.
    let uhr = 1_000_000;
    const a = await baueServer();
    await a.server.stoppe();
    const pfad = join(tempOrdner(), 'verbund.json');
    const verbund = new DateiVerbund(pfad, { version: 1, rechner: a.verbund.liste() }, { jetzt: () => uhr, schreibIntervallMs: 60_000 });
    const inDatei = (): unknown => !existsSync(pfad) ? 'nie geschrieben'
      : (JSON.parse(readFileSync(pfad, 'utf8')) as { rechner: VerbundEintrag[] }).rechner.find((e) => e.rechnerId === 'rechner-b')?.zuletztGesehen;
    const m = new MasterLinkServer({
      identitaet: a.identitaet, verbund, eigeneRechnerId: 'rechner-a', suiteVersion: '0.12.0',
      lauschAdressen: ['127.0.0.1'], port: 0, jetzt: () => uhr,
    });
    await m.starte();
    const c = await meldeAn({ ...a, server: m, port: m.port() });
    await c.naechste('angemeldet');
    gleich(inDatei(), 1_000_000, 'Anmeldung → „zuletzt gesehen“ geschrieben');
    uhr += 10_000;
    c.v.sende({ t: 'puls' });
    await bis(() => verbund.finde('rechner-b')?.zuletztGesehen === uhr, 1000);
    gleich(verbund.finde('rechner-b')?.zuletztGesehen, 1_010_000, 'während der Verbindung frischt jede Zeile „zuletzt gesehen“ auf');
    gleich(inDatei(), 1_000_000, '… geschrieben wird aber nicht bei jeder Zeile (höchstens alle 60 s)');
    uhr += 60_000;
    c.v.sende({ t: 'puls' });
    await bis(() => inDatei() === uhr, 1000);
    gleich(inDatei(), 1_070_000, 'nach 60 s ohne Trennung geschrieben');
    uhr += 5000;
    await m.stoppe();
    gleich(inDatei(), 1_075_000, 'Master trennt (stoppe: Aus, Neustart, Erneuern) → beim Trennen sofort geschrieben');
    verbund.schliesse();
  }

  abschnitt('Server: Lauscher (Review Focus 2)');
  {
    const a = await baueServer();
    const c = await meldeAn(a);
    await c.naechste('angemeldet');
    await a.server.stoppe();
    await bis(() => c.beendet(), 1000);
    pruefe(c.beendet(), 'stoppe(): offene Verbindung binnen 1 s zu (nicht nur server.close)');
    const b = new MasterLinkServer({
      identitaet: a.identitaet, verbund: a.verbund, eigeneRechnerId: 'rechner-a', suiteVersion: '0.12.0',
      lauschAdressen: ['127.0.0.1'], port: a.port,
    });
    await b.starte();
    pruefe(b.gestartet, 'sofort wieder auf demselben Port gestartet (kein EADDRINUSE)');
    const doppelt = new MasterLinkServer({
      identitaet: a.identitaet, verbund: a.verbund, eigeneRechnerId: 'rechner-a', suiteVersion: '0.12.0',
      lauschAdressen: ['127.0.0.1'], port: a.port,
    });
    let code = '';
    try { await doppelt.starte(); } catch (e) { code = (e as NodeJS.ErrnoException).code ?? ''; }
    gleich(code, 'EADDRINUSE', 'belegter Port → starte() wirft EADDRINUSE');
    const d = await meldeAn({ ...a, server: b, port: a.port });
    await d.naechste('angemeldet');
    await b.setzeLauschAdressen([]);
    await bis(() => d.beendet(), 1000);
    pruefe(d.beendet(), 'weggefallener Lauscher schließt seine Sitzungen');
    await b.stoppe();
  }
  {
    const karten: NodeJS.Dict<NetworkInterfaceInfo[]> = {
      'Ethernet 2': [{ address: '10.0.0.110', netmask: '255.255.255.0', family: 'IPv4', mac: '00:11:22:33:44:55', internal: false, cidr: '10.0.0.110/24' }],
      'Loopback': [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: true, cidr: '127.0.0.1/8' }],
    };
    const basis = { identitaet: neueIdentitaet(), verbund: new SpeicherVerbund(), eigeneRechnerId: 'a', suiteVersion: '0.12.0', netzwerkKarten: () => karten };
    gleich(new MasterLinkServer({ ...basis, lauschAdressen: ['0.0.0.0'] }).adressenFuerSlaves(), ['10.0.0.110'], 'Automatisch → alle nicht-internen IPv4');
    gleich(new MasterLinkServer({ ...basis, lauschAdressen: ['10.0.0.110', '192.168.1.5', '127.0.0.1'] }).adressenFuerSlaves(),
      ['10.0.0.110', '192.168.1.5'], 'gewählte Karte → ihre IPv4, nie 127.0.0.1');
  }
}
```

In `test/selftest.ts` `server` ergänzen.

- [ ] **Schritt 3: Test laufen lassen und Fehlschlag sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts`
Expected: FAIL mit `Cannot find module '../src/server'`

- [ ] **Schritt 4: `server.ts` schreiben**

`packages/master-link/src/server.ts`:
```ts
import { EventEmitter } from 'node:events';
import type { Socket } from 'node:net';
import { networkInterfaces } from 'node:os';
import { createServer, type Server as TlsServer, type TLSSocket } from 'node:tls';
import { randomNonce } from '@jm/auth-core';
import { listeKarten, type NetzwerkInterfaces } from './adresswahl';
import { fingerprintVonPem, pruefeAnmeldung } from './beweis';
import { fristen as mitFristen, GRENZEN, kuerzeName, MASTER_PORT, type Fristen } from './fristen';
import { PROTOKOLL, type Grund, type Nachricht, type TeilnehmerInfo } from './rahmen';
import type { Identitaet, VerbundSpeicher } from './speicher';
import { Verbindung } from './verbindung';

// Master-Link-Server (Spec 3, 5, 6). Jeder Teilnehmer (Tool/Slave-Launcher) hat eine eigene
// Verbindung; Schlüssel am Master ist rechnerId + appId, die neuere Verbindung gewinnt.

export interface TeilnehmerStand extends TeilnehmerInfo {
  rechnerId: string;
  adresse: string;
  seit: number;
  letzteZeile: number;
}

export interface KopplungsStand {
  offen: boolean;
  code: string | null;
  gueltigBis: number | null;
  rest: number;
  ungueltig: boolean;
}

export interface ServerOptionen {
  identitaet: Identitaet;
  verbund: VerbundSpeicher;
  /** rechner.id des Master-Rechners (Selbstkopplung) — koppeln damit wird abgelehnt. */
  eigeneRechnerId: string;
  suiteVersion: string;
  /** ['0.0.0.0'] (Automatisch) oder [...Karten-IPs, '127.0.0.1'] (gewählte Karte). */
  lauschAdressen: string[];
  /** Vorgabe 8738; 0 = freier Port (Tests). */
  port?: number;
  fristen?: Partial<Fristen>;
  jetzt?: () => number;
  netzwerkKarten?: () => NetzwerkInterfaces;
  /** Vom Signatur-Ratenlimit ausgenommene Quellen. Vorgabe: Loopback (Tools am Master). */
  ratenAusnahme?: (ip: string) => boolean;
  log?: (stufe: 'info' | 'warn', text: string) => void;
}

interface Sitzung {
  v: Verbindung;
  roh: Socket;
  nonce: string;
  angemeldet: boolean;
  wartetAufTeilnehmer: boolean;
  ersteNachricht: boolean;
  rechnerId: string | null;
  info: TeilnehmerInfo | null;
  schluessel: string | null;
  seit: number;
  letzteZeile: number;
  stille: ReturnType<typeof setTimeout> | null;
}

interface RohEintrag {
  lauscher: string;
  angemeldet: boolean;
  sitzung: Sitzung | null;
  frist: ReturnType<typeof setTimeout>;
}

const istLoopback = (ip: string): boolean => ip.startsWith('127.') || ip === '::1';

export class MasterLinkServer extends EventEmitter {
  readonly fingerprint: string;
  private readonly o: ServerOptionen;
  private readonly f: Fristen;
  private readonly jetzt: () => number;
  private lauschAdressen: string[];
  private name: string;
  private laeuft = false;
  private readonly lauscher = new Map<string, TlsServer>();
  /** Alle TCP-Verbindungen in Annahme-Reihenfolge (Map behält sie) — auch vor dem TLS-Handshake. */
  private readonly roh = new Map<Socket, RohEintrag>();
  private readonly sitzungen = new Set<Sitzung>();
  private readonly teilnehmerMap = new Map<string, Sitzung>();
  private readonly fehlschlaege = new Map<string, number[]>();
  private pulsZeitgeber: ReturnType<typeof setInterval> | null = null;

  constructor(o: ServerOptionen) {
    super();
    this.o = o;
    this.f = mitFristen(o.fristen);
    this.jetzt = o.jetzt ?? Date.now;
    this.lauschAdressen = [...o.lauschAdressen];
    this.name = o.identitaet.name;
    this.fingerprint = fingerprintVonPem(o.identitaet.zertifikat);
  }

  get gestartet(): boolean {
    return this.laeuft;
  }

  port(): number {
    for (const srv of this.lauscher.values()) {
      const a = srv.address();
      if (a && typeof a === 'object') return a.port;
    }
    return this.o.port ?? MASTER_PORT;
  }

  private zielPort(): number {
    const wunsch = this.o.port ?? MASTER_PORT;
    // Port 0 (Tests): alle Lauscher teilen den zuerst vergebenen Port.
    return wunsch === 0 && this.lauscher.size > 0 ? this.port() : wunsch;
  }

  async starte(): Promise<void> {
    if (this.laeuft) return;
    this.laeuft = true;
    try {
      for (const a of this.lauschAdressen) await this.oeffne(a);
    } catch (e) {
      await this.stoppe();
      throw e;
    }
    this.pulsZeitgeber = setInterval(() => this.pulse(), this.f.pulsMs);
    this.pulsZeitgeber.unref?.();
    this.emit('aenderung');
  }

  private oeffne(adresse: string): Promise<void> {
    const srv = createServer({
      key: this.o.identitaet.schluessel,
      cert: this.o.identitaet.zertifikat,
      handshakeTimeout: this.f.handshakeMs,
      minVersion: 'TLSv1.2',
    });
    srv.on('connection', (roh: Socket) => this.aufTcp(roh, adresse));
    srv.on('secureConnection', (ts: TLSSocket) => this.aufTls(ts));
    // GEMESSEN: handshakeTimeout meldet nur 'tlsClientError' — ohne destroy bliebe der Socket offen.
    srv.on('tlsClientError', (_e: Error, sock: TLSSocket) => sock.destroy());
    const port = this.zielPort();
    return new Promise<void>((fertig, fehler) => {
      srv.once('error', fehler);
      srv.listen(port, adresse, () => {
        srv.off('error', fehler);
        srv.on('error', (e: Error) => this.log('warn', `Lauscher ${adresse}: ${e.message}`));
        this.lauscher.set(adresse, srv);
        fertig();
      });
    });
  }

  private aufTcp(roh: Socket, lauscher: string): void {
    const eintrag: RohEintrag = {
      lauscher,
      angemeldet: false,
      sitzung: null,
      frist: setTimeout(() => this.anmeldefristAbgelaufen(roh), this.f.anmeldefristMs),
    };
    this.roh.set(roh, eintrag);
    roh.on('error', () => {
      /* Fehler landen auch am TLS-Socket; hier nur „unhandled error“ verhindern */
    });
    roh.on('close', () => {
      clearTimeout(eintrag.frist);
      this.roh.delete(roh);
    });
    const unangemeldet = [...this.roh.entries()].filter(([, e]) => !e.angemeldet);
    if (unangemeldet.length > GRENZEN.maxUnangemeldet) unangemeldet[0][0].destroy();
  }

  private aufTls(ts: TLSSocket): void {
    const roh = [...this.roh.keys()].find((r) => r.remotePort === ts.remotePort && r.remoteAddress === ts.remoteAddress);
    const eintrag = roh ? this.roh.get(roh) : undefined;
    if (!roh || !eintrag) {
      ts.destroy();
      return;
    }
    const s: Sitzung = {
      v: new Verbindung(ts, GRENZEN.vorAnmeldung),
      roh,
      nonce: randomNonce(),
      angemeldet: false,
      wartetAufTeilnehmer: false,
      ersteNachricht: true,
      rechnerId: null,
      info: null,
      schluessel: null,
      seit: this.jetzt(),
      letzteZeile: this.jetzt(),
      stille: null,
    };
    eintrag.sitzung = s;
    this.sitzungen.add(s);
    s.v.on('nachricht', (n: Nachricht) => this.aufNachricht(s, n));
    s.v.on('unbekannt', () => this.zeileGesehen(s));
    s.v.on('ende', () => this.sitzungEnde(s));
    s.v.sende({ t: 'hallo', protokoll: PROTOKOLL, masterId: this.o.identitaet.masterId, name: this.name, nonce: s.nonce });
  }

  private anmeldefristAbgelaufen(roh: Socket): void {
    const e = this.roh.get(roh);
    if (!e || e.angemeldet) return;
    if (e.sitzung) this.lehneAb(e.sitzung, 'anmeldefrist');
    else roh.destroy();
  }

  private aufNachricht(s: Sitzung, n: Nachricht): void {
    this.zeileGesehen(s);
    if (s.angemeldet) {
      if (n.t === 'teilnehmer' && s.info && n.teilnehmer.appId === s.info.appId) {
        s.info = n.teilnehmer;
        this.emit('aenderung');
      }
      return;
    }
    if (s.wartetAufTeilnehmer) {
      if (n.t === 'teilnehmer' && s.rechnerId) {
        s.wartetAufTeilnehmer = false;
        this.meldeAn(s, s.rechnerId, n.teilnehmer);
      }
      return;
    }
    if (!s.ersteNachricht) return;
    s.ersteNachricht = false;
    if (n.t === 'anmelden') this.behandleAnmelden(s, n);
    else if (n.t === 'koppeln') this.behandleKoppeln(s, n);
    else s.v.schliesse();
  }

  private zeileGesehen(s: Sitzung): void {
    s.letzteZeile = this.jetzt();
    if (!s.angemeldet) return;
    if (s.stille) clearTimeout(s.stille);
    s.stille = setTimeout(() => s.v.socket.destroy(), this.f.stilleMs);
    this.merkeGesehen(s, false);
  }

  /** Spec 5.1: „zuletzt gesehen“ — beim Trennen sofort, sonst schreibt der Verbundspeicher höchstens alle 60 s. */
  private merkeGesehen(s: Sitzung, sofort: boolean): void {
    if (!s.rechnerId) return;
    const e = this.o.verbund.finde(s.rechnerId);
    this.o.verbund.gesehen(s.rechnerId, this.jetzt(), e?.dieserRechner ? null : s.v.adresse, sofort);
  }

  private behandleAnmelden(s: Sitzung, n: Extract<Nachricht, { t: 'anmelden' }>): void {
    if (n.protokoll !== PROTOKOLL) {
      this.lehneAb(s, 'protokoll', { master: PROTOKOLL, suite: this.o.suiteVersion });
      return;
    }
    const ip = s.v.adresse;
    const ausgenommen = (this.o.ratenAusnahme ?? istLoopback)(ip);
    if (!ausgenommen && this.zuVieleFehlschlaege(ip)) {
      this.lehneAb(s, 'last');
      return;
    }
    const e = this.o.verbund.finde(n.rechnerId);
    if (!e) {
      this.lehneAb(s, 'unbekannt');
      return;
    }
    if (!pruefeAnmeldung(e.schluessel, this.fingerprint, s.nonce, n.rechnerId, n.signatur)) {
      if (!ausgenommen) this.merkeFehlschlag(ip);
      this.lehneAb(s, 'signatur');
      return;
    }
    const name = kuerzeName(n.rechnerName);
    if (!e.dieserRechner && name !== e.name) this.o.verbund.setze({ ...e, name });
    this.meldeAn(s, n.rechnerId, n.teilnehmer);
  }

  /** Aufgabe 10 ersetzt diese Methode durch die echte Kopplung. */
  private behandleKoppeln(s: Sitzung, _n: Extract<Nachricht, { t: 'koppeln' }>): void {
    this.lehneAb(s, 'keine-kopplung-offen');
  }

  private meldeAn(s: Sitzung, rechnerId: string, info: TeilnehmerInfo): void {
    const schluessel = `${rechnerId}\u0000${info.appId}`;
    const alt = this.teilnehmerMap.get(schluessel);
    if (alt && alt !== s) {
      if (this.jetzt() - alt.letzteZeile < this.f.pulsMs) {
        this.warne(`Kennung ${rechnerId.slice(0, 8)}…/${info.appId} doppelt aktiv (${alt.v.adresse}, ${s.v.adresse})`);
      }
      this.teilnehmerMap.delete(schluessel);
      alt.v.sende({ t: 'abgelehnt', grund: 'ersetzt' });
      alt.v.schliesse();
    }
    s.angemeldet = true;
    s.rechnerId = rechnerId;
    s.info = info;
    s.schluessel = schluessel;
    s.seit = this.jetzt();
    const eintrag = this.roh.get(s.roh);
    if (eintrag) {
      eintrag.angemeldet = true;
      clearTimeout(eintrag.frist);
    }
    s.v.setzeGrenze(GRENZEN.nachAnmeldung);
    this.teilnehmerMap.set(schluessel, s);
    this.zeileGesehen(s);
    s.v.sende({ t: 'angemeldet', adressen: this.adressenFuerSlaves(), suite: this.o.suiteVersion });
    this.emit('aenderung');
  }

  private lehneAb(s: Sitzung, grund: Grund, extra: { rest?: number; master?: number; suite?: string } = {}): void {
    s.v.sende({ t: 'abgelehnt', grund, ...extra });
    s.v.schliesse();
  }

  private sitzungEnde(s: Sitzung): void {
    if (s.stille) clearTimeout(s.stille);
    this.sitzungen.delete(s);
    if (s.schluessel && this.teilnehmerMap.get(s.schluessel) === s) {
      this.teilnehmerMap.delete(s.schluessel);
      this.merkeGesehen(s, true);
      this.emit('aenderung');
    }
  }

  private zuVieleFehlschlaege(ip: string): boolean {
    const grenze = this.jetzt() - this.f.ratenFensterMs;
    const liste = (this.fehlschlaege.get(ip) ?? []).filter((t) => t > grenze);
    this.fehlschlaege.set(ip, liste);
    return liste.length >= GRENZEN.ratenLimit;
  }

  private merkeFehlschlag(ip: string): void {
    const liste = this.fehlschlaege.get(ip) ?? [];
    liste.push(this.jetzt());
    this.fehlschlaege.set(ip, liste);
  }

  private pulse(): void {
    for (const s of this.teilnehmerMap.values()) s.v.sende({ t: 'puls' });
  }

  adressenFuerSlaves(): string[] {
    if (this.lauschAdressen.includes('0.0.0.0')) {
      return listeKarten((this.o.netzwerkKarten ?? networkInterfaces)()).flatMap((k) => k.adressen.map((a) => a.adresse));
    }
    return this.lauschAdressen.filter((a) => !istLoopback(a));
  }

  async setzeLauschAdressen(neu: string[]): Promise<void> {
    for (const a of [...this.lauscher.keys()]) {
      if (!neu.includes(a)) await this.schliesseLauscher(a);
    }
    this.lauschAdressen = [...neu];
    if (!this.laeuft) return;
    for (const a of neu) {
      if (!this.lauscher.has(a)) await this.oeffne(a);
    }
    this.emit('aenderung');
  }

  private async schliesseLauscher(adresse: string): Promise<void> {
    const srv = this.lauscher.get(adresse);
    if (!srv) return;
    this.lauscher.delete(adresse);
    for (const [roh, e] of this.roh) if (e.lauscher === adresse) roh.destroy();
    await new Promise<void>((r) => srv.close(() => r()));
  }

  setzeName(name: string): void {
    this.name = name;
    this.emit('aenderung');
  }

  teilnehmer(): TeilnehmerStand[] {
    const aus: TeilnehmerStand[] = [];
    for (const s of this.teilnehmerMap.values()) {
      if (!s.info || !s.rechnerId) continue;
      aus.push({ ...s.info, rechnerId: s.rechnerId, adresse: s.v.adresse, seit: s.seit, letzteZeile: s.letzteZeile });
    }
    return aus;
  }

  rechnerOnline(rechnerId: string): boolean {
    if (this.o.verbund.finde(rechnerId)?.dieserRechner) return this.laeuft;
    for (const s of this.teilnehmerMap.values()) if (s.rechnerId === rechnerId) return true;
    return false;
  }

  /** Spec 3.4: Schlüssel löschen UND offene Verbindungen sofort mit „unbekannt“ schließen. */
  entferne(rechnerId: string): void {
    const e = this.o.verbund.finde(rechnerId);
    if (!e || e.dieserRechner) return;
    this.o.verbund.entferne(rechnerId);
    for (const s of this.sitzungen) {
      if (s.rechnerId === rechnerId) this.lehneAb(s, 'unbekannt');
    }
    this.emit('aenderung');
  }

  /** Lauscher zu UND alle Sockets aktiv zerstören — server.close() allein ließe sie offen. */
  async stoppe(): Promise<void> {
    this.laeuft = false;
    if (this.pulsZeitgeber) {
      clearInterval(this.pulsZeitgeber);
      this.pulsZeitgeber = null;
    }
    for (const [roh, e] of this.roh) {
      clearTimeout(e.frist);
      roh.destroy();
    }
    for (const s of this.sitzungen) if (s.stille) clearTimeout(s.stille);
    // Spec 5.1: auch wenn der MASTER trennt (Aus, Neustart, Erneuern) — die close-Ereignisse kämen erst nach clear().
    // Ein Schreibvorgang für alle: nur der letzte Aufruf schreibt sofort, die übrigen stehen dann schon im Speicher.
    const getrennt = [...this.teilnehmerMap.values()];
    getrennt.forEach((s, i) => this.merkeGesehen(s, i === getrennt.length - 1));
    this.teilnehmerMap.clear();
    const alle = [...this.lauscher.values()];
    this.lauscher.clear();
    await Promise.all(alle.map((srv) => new Promise<void>((r) => srv.close(() => r()))));
    this.emit('aenderung');
  }

  private warne(text: string): void {
    this.log('warn', text);
    this.emit('warnung', text);
  }

  private log(stufe: 'info' | 'warn', text: string): void {
    this.o.log?.(stufe, text);
  }
}
```

`src/index.ts` ergänzen: `export * from './server';`

- [ ] **Schritt 5: Test grün sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts && npx tsc --noEmit -p tsconfig.json`
Expected: `… 0 fehlgeschlagen.`

- [ ] **Schritt 6: Commit**

```bash
git add packages/master-link/src/server.ts packages/master-link/src/index.ts packages/master-link/test/rohclient.ts packages/master-link/test/aufbau.ts packages/master-link/test/server.test.ts packages/master-link/test/selftest.ts
git status --short
git commit -m "feat(master-link): Master-Server mit Anmeldung, Puls, Grenzen, Entfernen" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aufgabe 10: Koppeln (Master-Fenster + Slave-Seite `koppeln.ts`)

**Files:**
- Modify: `packages/master-link/src/server.ts` (Kopplungsfenster, `behandleKoppeln`)
- Create: `packages/master-link/src/koppeln.ts`, `packages/master-link/test/koppeln.test.ts`
- Modify: `packages/master-link/src/index.ts`, `packages/master-link/test/selftest.ts`

**Interfaces:**
- Consumes:
  - aus Aufgabe 1: `erzeugeCode`, `normalisiereCode`
  - aus Aufgabe 2: `slaveBeweis`, `masterBeweis`, `gleicherBeweis`, `istEd25519Oeffentlich`, `erzeugeSchluesselpaar`, `derZuPem`, `fingerprintVonPem`
  - aus Aufgabe 5: `ordneEin`
  - aus Aufgabe 6: `Kopplung`
  - aus Aufgabe 9: `MasterLinkServer`
- Produces:
  - `MasterLinkServer`: `oeffneKopplung()`, `neuerCode()`, `schliesseKopplung()`, `kopplungsStand(): KopplungsStand`
  - `KoppelAnfrage { adresse; port?; code; rechner; fristen?; signal?; mdnsGesehen?; festeAdresse? }` — `code` wie eingegeben: `koppele()` normalisiert und prüft selbst, ohne gültigen Code kein Socket
  - `KoppelErgebnis`, `koppele(a): Promise<KoppelErgebnis>` — ungültiger Code → `{ art: 'verbindung', code: 'sonstig', errCode: 'CODE_UNGUELTIG' }`, eine Ausnahme in einem Socket-Handler → `errCode` der Ausnahme (nie ein Absturz); bis zum geprüften `gekoppelt` 4 KiB je Zeile, die Verbindung eines Erfolgs liest mit 1 MiB

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`packages/master-link/test/koppeln.test.ts`:
```ts
import { createServer, connect } from 'node:tls';
import { createServer as netServer, type AddressInfo } from 'node:net';
import { certFingerprint, randomNonce } from '@jm/auth-core';
import { masterBeweis } from '../src/beweis';
import { zeigeCode } from '../src/code';
import { GRENZEN } from '../src/fristen';
import { koppele } from '../src/koppeln';
import type { Nachricht } from '../src/rahmen';
import { Verbindung } from '../src/verbindung';
import { baueServer, meldeAn } from './aufbau';
import { abschnitt, bis, gleich, pruefe } from './helfer';
import { erzeugeTestZertifikat } from './zertifikate';

const rechnerC = { id: 'rechner-c', name: 'Neuer PC' };

/** Ein fremdes Gerät, das sich als Master ausgibt (eigenes Zertifikat, masterId „falsch“). */
async function falscherMaster(
  aufKoppeln: (v: Verbindung, n: Extract<Nachricht, { t: 'koppeln' }>, fp: string, ns: string) => void,
): Promise<{ port: number; schliesse(): void }> {
  const z = erzeugeTestZertifikat();
  const fp = certFingerprint(z.cert);
  const srv = createServer({ key: z.key, cert: z.cert }, (ts) => {
    const v = new Verbindung(ts, 1 << 20);
    const ns = randomNonce();
    v.on('nachricht', (n: Nachricht) => {
      if (n.t === 'koppeln') aufKoppeln(v, n, fp, ns);
    });
    v.sende({ t: 'hallo', protokoll: 1, masterId: 'falsch', name: 'Regie-PC', nonce: ns });
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  return { port: (srv.address() as AddressInfo).port, schliesse: () => srv.close() };
}

export async function laufe(): Promise<void> {
  abschnitt('Koppeln: Erfolg (Spec 3.3)');
  {
    const a = await baueServer();
    const { code } = a.server.oeffneKopplung();
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: code!, rechner: rechnerC });
    pruefe(r.ok, 'richtiger Code → gekoppelt');
    if (r.ok) {
      gleich(r.kopplung.fingerprint, a.server.fingerprint, 'gepinnter Fingerprint = Master');
      gleich(certFingerprint(r.kopplung.zertifikat), a.server.fingerprint, 'gespeichertes Zertifikat passt zum Pin');
      gleich(r.kopplung.masterId, a.identitaet.masterId, 'masterId übernommen');
      gleich(r.masterName, 'Regie-PC', 'Master-Name übernommen');
      gleich(a.verbund.finde('rechner-c')?.schluessel, r.kopplung.schluessel.oeffentlich, 'Master speichert NUR den öffentlichen Schlüssel');
      pruefe(!JSON.stringify(a.verbund.liste()).includes(r.kopplung.schluessel.privat), 'privater Schlüssel nie beim Master');
      const angekommen: Nachricht[] = [];
      r.verbindung.on('nachricht', (n: Nachricht) => angekommen.push(n));
      r.verbindung.sende({ t: 'teilnehmer', teilnehmer: { art: 'launcher', appId: 'jm-launcher', name: 'JM Production Suite', version: '0.12.0', pid: 2 } });
      await bis(() => angekommen.some((n) => n.t === 'angemeldet'));
      pruefe(angekommen.some((n) => n.t === 'angemeldet'), 'dieselbe Verbindung geht direkt in „angemeldet“ über');
      pruefe(a.server.teilnehmer().some((t) => t.rechnerId === 'rechner-c' && t.art === 'launcher'), 'Launcher als Teilnehmer am Master');
      r.verbindung.schliesse();
    }
    const nochmal = await koppele({ adresse: '127.0.0.1', port: a.port, code: code!, rechner: { id: 'rechner-d', name: 'D' } });
    gleich(nochmal.ok ? 'ok' : nochmal.art === 'abgelehnt' ? nochmal.grund : nochmal.art, 'code-ungueltig', 'Code ist nach Erfolg verbraucht');
    await a.server.stoppe();
  }

  abschnitt('Koppeln: Fenster, Fehlversuche, Ablauf');
  {
    let uhr = 1_000_000;
    const a = await baueServer({ jetzt: () => uhr });
    const keinFenster = await koppele({ adresse: '127.0.0.1', port: a.port, code: 'AAAAAAAAAA', rechner: rechnerC });
    gleich(keinFenster.ok ? '' : keinFenster.art === 'abgelehnt' ? keinFenster.grund : '', 'keine-kopplung-offen', 'ohne Fenster → keine-kopplung-offen');
    const { code } = a.server.oeffneKopplung();
    const falsch = code === '2222222222' ? '3333333333' : '2222222222';
    const r1 = await koppele({ adresse: '127.0.0.1', port: a.port, code: falsch, rechner: rechnerC });
    gleich(r1.ok ? null : r1, { ok: false, art: 'abgelehnt', grund: 'code-falsch', rest: 4 }, 'falscher Code → code-falsch, noch 4');
    for (let i = 0; i < 4; i++) await koppele({ adresse: '127.0.0.1', port: a.port, code: falsch, rechner: rechnerC });
    gleich(a.server.kopplungsStand().rest, 0, 'nach 5 Fehlversuchen rest 0');
    const r6 = await koppele({ adresse: '127.0.0.1', port: a.port, code: code!, rechner: rechnerC });
    gleich(r6.ok ? '' : r6.art === 'abgelehnt' ? r6.grund : '', 'code-ungueltig', 'nach 5 Fehlversuchen ist auch der richtige Code ungültig');
    pruefe(a.server.kopplungsStand().ungueltig && a.server.kopplungsStand().code === null, 'Stand: ungültig, Code nicht mehr angezeigt');

    const neu = a.server.neuerCode();
    uhr += 121_000;
    const alt = await koppele({ adresse: '127.0.0.1', port: a.port, code: neu.code!, rechner: rechnerC });
    gleich(alt.ok ? '' : alt.art === 'abgelehnt' ? alt.grund : '', 'code-ungueltig', 'nach 2 min abgelaufen');

    const c1 = a.server.neuerCode().code!;
    const c2 = a.server.neuerCode().code!;
    if (c1 !== c2) {
      const mitAlt = await koppele({ adresse: '127.0.0.1', port: a.port, code: c1, rechner: rechnerC });
      gleich(mitAlt.ok ? '' : mitAlt.art === 'abgelehnt' ? mitAlt.grund : '', 'code-falsch', 'neuer Code ersetzt den alten');
    }
    const mitNeu = await koppele({ adresse: '127.0.0.1', port: a.port, code: c2, rechner: { id: a.eigen.rechnerId, name: 'Klon' } });
    gleich(mitNeu.ok ? '' : mitNeu.art === 'abgelehnt' ? mitNeu.grund : '', 'rechner-id', 'Kennung des Masters selbst → rechner-id');
    a.server.schliesseKopplung();
    const zu = await koppele({ adresse: '127.0.0.1', port: a.port, code: c2, rechner: rechnerC });
    gleich(zu.ok ? '' : zu.art === 'abgelehnt' ? zu.grund : '', 'keine-kopplung-offen', 'Fenster geschlossen → keine-kopplung-offen');
    await a.server.stoppe();
  }

  abschnitt('Koppeln: erneut koppeln mit bekannter rechnerId');
  {
    const a = await baueServer();
    const alt = await meldeAn(a);
    await alt.naechste('angemeldet');
    const { code } = a.server.oeffneKopplung();
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: code!, rechner: { id: 'rechner-b', name: 'Regie-Laptop 2' } });
    pruefe(r.ok, 'bekannte rechnerId koppelt neu');
    gleich(await alt.naechste('abgelehnt', 1000), { t: 'abgelehnt', grund: 'signatur' }, 'alte Verbindungen des Rechners mit „signatur“ geschlossen');
    gleich(a.verbund.liste().filter((e) => e.rechnerId === 'rechner-b').length, 1, 'genau ein Eintrag');
    const mitAltemSchluessel = await meldeAn(a);
    gleich(await mitAltemSchluessel.naechste('abgelehnt'), { t: 'abgelehnt', grund: 'signatur' }, 'alter Schlüssel gilt nicht mehr');
    if (r.ok) r.verbindung.schliesse();
    await a.server.stoppe();
  }

  abschnitt('Koppeln: Mittelsmann (wichtigster Test)');
  {
    const a = await baueServer();
    const { code } = a.server.oeffneKopplung();
    const z2 = erzeugeTestZertifikat();
    const relais = createServer({ key: z2.key, cert: z2.cert }, (vomSlave) => {
      const zumMaster = connect({ host: '127.0.0.1', port: a.port, rejectUnauthorized: false });
      vomSlave.on('error', () => {});
      zumMaster.on('error', () => {});
      vomSlave.pipe(zumMaster);
      zumMaster.pipe(vomSlave);
    });
    await new Promise<void>((r) => relais.listen(0, '127.0.0.1', r));
    const r = await koppele({ adresse: '127.0.0.1', port: (relais.address() as AddressInfo).port, code: code!, rechner: rechnerC });
    gleich(r.ok ? null : r, { ok: false, art: 'abgelehnt', grund: 'code-falsch', rest: 4 },
      'Relais mit eigenem Zertifikat: Master lehnt ab (anderer fp im Beweis), Fehlversuch gezählt');
    gleich(a.verbund.finde('rechner-c'), undefined, 'nichts gekoppelt');
    relais.close();
    await a.server.stoppe();
  }
  {
    const f = await falscherMaster((v) => v.sende({ t: 'gekoppelt', masterId: 'falsch', name: 'Regie-PC', beweis: 'ab'.repeat(32), adressen: [] }));
    const r = await koppele({ adresse: '127.0.0.1', port: f.port, code: 'K7QXM3PRTH', rechner: rechnerC });
    gleich(r.ok ? null : r, { ok: false, art: 'master-beweis' }, 'falscher Master mit beliebigem Beweis → abgelehnt, nichts gepinnt');
    f.schliesse();
  }
  {
    // Beweis korrekt gebildet, aber für eine andere masterId als im 'hallo' angekündigt.
    const K = 'K7QXM3PRTH';
    const f = await falscherMaster((v, n, fp, ns) => {
      const d = { fp, ns, nc: n.nonce, rechnerId: n.rechnerId, schluessel: n.schluessel };
      v.sende({ t: 'gekoppelt', masterId: 'anders', name: 'Regie-PC', beweis: masterBeweis(K, d, 'anders'), adressen: [] });
    });
    const r = await koppele({ adresse: '127.0.0.1', port: f.port, code: K, rechner: rechnerC });
    gleich(r.ok ? null : r, { ok: false, art: 'master-beweis' }, 'gekoppelt mit anderer masterId als im hallo → master-beweis');
    if (r.ok) r.verbindung.schliesse();
    f.schliesse();
  }
  {
    // Der Angreifer KENNT K (Offline-Raten gelungen), braucht aber länger als die Frist des Slaves.
    const K = 'K7QXM3PRTH';
    const f = await falscherMaster((v, n, fp, ns) => {
      const puls = setInterval(() => v.sende({ t: 'puls' }), 50);
      setTimeout(() => {
        clearInterval(puls);
        const d = { fp, ns, nc: n.nonce, rechnerId: n.rechnerId, schluessel: n.schluessel };
        v.sende({ t: 'gekoppelt', masterId: 'falsch', name: 'Regie-PC', beweis: masterBeweis(K, d, 'falsch'), adressen: [] });
      }, 450);
    });
    const r = await koppele({ adresse: '127.0.0.1', port: f.port, code: K, rechner: rechnerC, fristen: { koppelnMs: 300 } });
    gleich(r.ok ? null : r, { ok: false, art: 'frist' }, 'harte 10-s-Frist (hier 300 ms): Puls verlängert nicht, später Beweis wird nie angenommen');
    f.schliesse();
  }

  abschnitt('Koppeln: Zeilengrenze (Spec 6.1)');
  {
    // Vor dem geprüften „gekoppelt“ spricht ein UNGEPRÜFTES Gegenüber: höchstens 4 KiB je Zeile.
    const f = await falscherMaster((v) => v.socket.write(`{"t":"gross","x":"${'y'.repeat(GRENZEN.vorAnmeldung)}"}\n`));
    const r = await koppele({ adresse: '127.0.0.1', port: f.port, code: 'K7QXM3PRTH', rechner: rechnerC, fristen: { koppelnMs: 1000 } });
    gleich(r.ok ? null : r, { ok: false, art: 'verbindung', code: 'kein-master' }, 'Zeile > 4 KiB vor „gekoppelt“ → sofort zu (kein-master), nicht erst nach der Frist');
    f.schliesse();
  }
  {
    // Nach dem geprüften „gekoppelt“ ist die Verbindung angemeldet (Spec 3.3): 1 MiB je Zeile.
    const K = 'K7QXM3PRTH';
    const f = await falscherMaster((v, n, fp, ns) => {
      const d = { fp, ns, nc: n.nonce, rechnerId: n.rechnerId, schluessel: n.schluessel };
      v.sende({ t: 'gekoppelt', masterId: 'falsch', name: 'Regie-PC', beweis: masterBeweis(K, d, 'falsch'), adressen: [] });
      setTimeout(() => v.socket.write(`{"t":"gross","x":"${'y'.repeat(100_000)}"}\n`), 100);
    });
    const r = await koppele({ adresse: '127.0.0.1', port: f.port, code: K, rechner: rechnerC });
    pruefe(r.ok, 'Gegenüber mit gültigem Beweis → gekoppelt');
    if (r.ok) {
      const unbekannt: string[] = [];
      r.verbindung.on('unbekannt', (t: string) => unbekannt.push(t));
      await bis(() => unbekannt.length > 0, 1000);
      pruefe(unbekannt.includes('gross') && r.verbindung.offen, 'nach dem geprüften „gekoppelt“ sind 100-KB-Zeilen erlaubt (1 MiB)');
      r.verbindung.schliesse();
    }
    f.schliesse();
  }

  abschnitt('Koppeln: Code und Ausnahmen (Spec 3.1, 3.2)');
  {
    const a = await baueServer();
    const { code } = a.server.oeffneKopplung();
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: zeigeCode(code!).toLowerCase(), rechner: rechnerC });
    pruefe(r.ok, 'Code wie eingegeben (klein, mit Bindestrich) → koppele() normalisiert selbst');
    if (r.ok) r.verbindung.schliesse();
    await a.server.stoppe();
  }
  {
    // Ohne lokal gültigen Code KEIN Socket (Spec 3.1) — auch wenn der Aufrufer nicht vorher prüft.
    let verbindungen = 0;
    const zaehler = netServer((s) => { verbindungen++; s.destroy(); });
    await new Promise<void>((r) => zaehler.listen(0, '127.0.0.1', r));
    const port = (zaehler.address() as AddressInfo).port;
    const arten: string[] = [];
    for (const code of ['K7QXO3PRTH', 'K7QXM', undefined as unknown as string]) {
      const r = await koppele({ adresse: '127.0.0.1', port, code, rechner: rechnerC });
      arten.push(r.ok ? 'ok' : r.art === 'verbindung' ? `${r.code}/${r.errCode}` : r.art);
    }
    gleich(arten, ['sonstig/CODE_UNGUELTIG', 'sonstig/CODE_UNGUELTIG', 'sonstig/CODE_UNGUELTIG'], 'fremdes Zeichen, zu kurz, kein Text → Fehlerergebnis');
    gleich(verbindungen, 0, '… ohne Verbindung zum Master (Spec 3.1)');
    zaehler.close();
  }
  {
    // Eine Ausnahme in einem Socket-Handler wäre ungefangen und beendete den ganzen Prozess (den Launcher).
    const a = await baueServer();
    a.server.oeffneKopplung();
    const wirft = { get id(): string { throw Object.assign(new Error('Testwurf'), { code: 'TESTWURF' }); }, name: 'Neuer PC' };
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: 'K7QXM3PRTH', rechner: wirft });
    gleich(r.ok ? null : r, { ok: false, art: 'verbindung', code: 'sonstig', errCode: 'TESTWURF' }, 'Ausnahme im Handler → Fehlerergebnis statt Absturz');
    await a.server.stoppe();
  }

  abschnitt('Koppeln: Abbruch und Verbindungsfehler');
  {
    const f = await falscherMaster(() => { /* schweigt */ });
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 100);
    const r = await koppele({ adresse: '127.0.0.1', port: f.port, code: 'K7QXM3PRTH', rechner: rechnerC, signal: ctrl.signal });
    gleich(r.ok ? null : r, { ok: false, art: 'abgebrochen' }, 'Dialog geschlossen → abgebrochen, nichts gespeichert');
    f.schliesse();
  }
  {
    const r = await koppele({ adresse: '127.0.0.1', port: 1, code: 'K7QXM3PRTH', rechner: rechnerC });
    pruefe(!r.ok && r.art === 'verbindung' && r.code === 'verweigert', 'niemand lauscht → verbindung/verweigert');
  }
}
```

In `test/selftest.ts` `koppeln` ergänzen.

- [ ] **Schritt 2: Test laufen lassen und Fehlschlag sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts`
Expected: FAIL mit `Cannot find module '../src/koppeln'`

- [ ] **Schritt 3: Kopplungsfenster im Server ergänzen**

In `packages/master-link/src/server.ts` die Importe erweitern:
```ts
import { fingerprintVonPem, gleicherBeweis, istEd25519Oeffentlich, masterBeweis, pruefeAnmeldung, slaveBeweis } from './beweis';
import { erzeugeCode } from './code';
```

Als Feld der Klasse (unter `pulsZeitgeber`) ergänzen:
```ts
  private fenster: { code: string; erzeugt: number; fehlversuche: number; verbraucht: boolean } | null = null;
```

Die Methode `behandleKoppeln` (der Platzhalter aus Aufgabe 9) **ganz ersetzen** durch:
```ts
  private behandleKoppeln(s: Sitzung, n: Extract<Nachricht, { t: 'koppeln' }>): void {
    if (n.protokoll !== PROTOKOLL) {
      this.lehneAb(s, 'protokoll', { master: PROTOKOLL, suite: this.o.suiteVersion });
      return;
    }
    const f = this.fenster;
    if (!f) {
      this.lehneAb(s, 'keine-kopplung-offen');
      return;
    }
    if (!this.codeGueltig()) {
      this.lehneAb(s, 'code-ungueltig');
      return;
    }
    if (n.rechnerId === this.o.eigeneRechnerId) {
      this.lehneAb(s, 'rechner-id');
      return;
    }
    const d = { fp: this.fingerprint, ns: s.nonce, nc: n.nonce, rechnerId: n.rechnerId, schluessel: n.schluessel };
    if (!istEd25519Oeffentlich(n.schluessel) || !gleicherBeweis(slaveBeweis(f.code, d), n.beweis)) {
      f.fehlversuche++;
      this.emit('aenderung');
      this.lehneAb(s, 'code-falsch', { rest: Math.max(0, GRENZEN.maxFehlversuche - f.fehlversuche) });
      return;
    }
    f.verbraucht = true;
    // Neuer Schlüssel für diesen Rechner: bestehende Verbindungen mit dem alten sind ungültig.
    for (const alt of this.sitzungen) {
      if (alt !== s && alt.rechnerId === n.rechnerId) this.lehneAb(alt, 'signatur');
    }
    const jetzt = this.jetzt();
    this.o.verbund.setze({
      rechnerId: n.rechnerId,
      name: kuerzeName(n.rechnerName),
      schluessel: n.schluessel,
      gekoppeltAm: jetzt,
      zuletztGesehen: jetzt,
      letzteAdresse: s.v.adresse,
      dieserRechner: false,
    });
    s.rechnerId = n.rechnerId;
    s.wartetAufTeilnehmer = true;
    // Frist für 'teilnehmer' neu ansetzen: das Koppeln selbst hat schon Zeit verbraucht.
    const eintrag = this.roh.get(s.roh);
    if (eintrag) {
      clearTimeout(eintrag.frist);
      eintrag.frist = setTimeout(() => this.anmeldefristAbgelaufen(s.roh), this.f.anmeldefristMs);
    }
    s.v.sende({
      t: 'gekoppelt',
      masterId: this.o.identitaet.masterId,
      name: this.name,
      beweis: masterBeweis(f.code, d, this.o.identitaet.masterId),
      adressen: this.adressenFuerSlaves(),
    });
    this.emit('aenderung');
  }

  private codeGueltig(): boolean {
    const f = this.fenster;
    return !!f && !f.verbraucht && f.fehlversuche < GRENZEN.maxFehlversuche && this.jetzt() - f.erzeugt < this.f.codeGueltigMs;
  }

  /** Öffnet das Kopplungsfenster mit einem frischen Code (ein neuer Code ersetzt den alten). */
  oeffneKopplung(): KopplungsStand {
    this.fenster = { code: erzeugeCode(), erzeugt: this.jetzt(), fehlversuche: 0, verbraucht: false };
    this.emit('aenderung');
    return this.kopplungsStand();
  }

  neuerCode(): KopplungsStand {
    return this.oeffneKopplung();
  }

  schliesseKopplung(): void {
    this.fenster = null;
    this.emit('aenderung');
  }

  kopplungsStand(): KopplungsStand {
    const f = this.fenster;
    if (!f) return { offen: false, code: null, gueltigBis: null, rest: 0, ungueltig: false };
    const gueltig = this.codeGueltig();
    return {
      offen: true,
      code: gueltig ? f.code : null,
      gueltigBis: f.erzeugt + this.f.codeGueltigMs,
      rest: Math.max(0, GRENZEN.maxFehlversuche - f.fehlversuche),
      ungueltig: !gueltig,
    };
  }
```

- [ ] **Schritt 4: `koppeln.ts` schreiben**

`packages/master-link/src/koppeln.ts`:
```ts
import { connect } from 'node:tls';
import { randomNonce } from '@jm/auth-core';
import { derZuPem, erzeugeSchluesselpaar, fingerprintVonPem, gleicherBeweis, masterBeweis, slaveBeweis } from './beweis';
import { normalisiereCode } from './code';
import type { Kopplung } from './datei';
import { ordneEin, type FehlerCode } from './fehler';
import { fristen as mitFristen, GRENZEN, kuerzeName, MASTER_PORT, type Fristen } from './fristen';
import { PROTOKOLL, type Grund, type Nachricht } from './rahmen';
import { Verbindung } from './verbindung';

// Slave-Seite der Kopplung (Spec 3.3). Hier und NUR hier: TLS ohne Pin (rejectUnauthorized:false) —
// es gibt noch keinen. Den Schutz liefert der an den GESEHENEN Fingerprint gebundene Beweis
// und die HARTE Frist nach 'koppeln' (Offline-Raten braucht länger als 10 s).

export interface KoppelAnfrage {
  adresse: string;
  port?: number;
  /** Code wie eingegeben — koppele() normalisiert und prüft selbst (Spec 3.1, 3.2). */
  code: string;
  rechner: { id: string; name: string };
  fristen?: Partial<Fristen>;
  signal?: AbortSignal;
  /** Wurde der Master per mDNS gesehen? (nur für die Einordnung eines TCP-Timeouts) */
  mdnsGesehen?: boolean;
  festeAdresse?: string | null;
}

export type KoppelErgebnis =
  | { ok: true; kopplung: Kopplung; verbindung: Verbindung; masterName: string }
  | { ok: false; art: 'abgelehnt'; grund: Grund; rest?: number }
  | { ok: false; art: 'master-beweis' }
  | { ok: false; art: 'frist' }
  | { ok: false; art: 'verbindung'; code: FehlerCode; errCode?: string }
  | { ok: false; art: 'abgebrochen' };

/** errCode, wenn der Code schon lokal ungültig ist — dann gibt es keinen Socket (Spec 3.1). */
const CODE_UNGUELTIG = 'CODE_UNGUELTIG';

export function koppele(a: KoppelAnfrage): Promise<KoppelErgebnis> {
  const f: Fristen = mitFristen(a.fristen);
  const port = a.port ?? MASTER_PORT;
  if (a.signal?.aborted) return Promise.resolve({ ok: false, art: 'abgebrochen' });
  // Spec 3.1: erst mit lokal gültigem Code verbinden — auch wenn der Aufrufer nicht vorher geprüft hat.
  const pruefung = typeof a.code === 'string' ? normalisiereCode(a.code) : null;
  if (!pruefung?.ok) return Promise.resolve({ ok: false, art: 'verbindung', code: 'sonstig', errCode: CODE_UNGUELTIG });
  const code = pruefung.code;
  const paar = erzeugeSchluesselpaar();
  const nc = randomNonce();
  const rechnerName = kuerzeName(a.rechner.name);

  return new Promise<KoppelErgebnis>((fertig) => {
    let erledigt = false;
    let frist: ReturnType<typeof setTimeout> | null = null;
    let v: Verbindung | null = null;
    let fp = '';
    let zertifikat = '';
    let ns = '';
    let halloMasterId = '';

    const socket = connect({ host: a.adresse, port, rejectUnauthorized: false });

    const ende = (r: KoppelErgebnis): void => {
      if (erledigt) return;
      erledigt = true;
      if (frist) clearTimeout(frist);
      a.signal?.removeEventListener('abort', abbruch);
      if (!r.ok) {
        v?.removeAllListeners();
        socket.destroy();
      }
      fertig(r);
    };
    const abbruch = (): void => ende({ ok: false, art: 'abgebrochen' });
    const setzeFrist = (ms: number, r: KoppelErgebnis): void => {
      if (frist) clearTimeout(frist);
      frist = setTimeout(() => ende(r), ms);
    };
    // Eine Ausnahme in einem Socket-Handler wäre ungefangen und beendete den ganzen Prozess (den Launcher).
    const sicher = <T extends unknown[]>(h: (...x: T) => void) => (...x: T): void => {
      try {
        h(...x);
      } catch (e) {
        ende({ ok: false, art: 'verbindung', code: 'sonstig', errCode: (e as NodeJS.ErrnoException).code ?? 'UNBEKANNT' });
      }
    };
    a.signal?.addEventListener('abort', abbruch, { once: true });

    const tcpCode = ordneEin({ art: 'tcp-timeout' }, a.mdnsGesehen ?? false);
    setzeFrist(f.tcpMs, { ok: false, art: 'verbindung', code: tcpCode.art === 'code' ? tcpCode.code : 'nicht-gefunden' });
    socket.once('connect', () => setzeFrist(f.tlsHalloMs, { ok: false, art: 'verbindung', code: 'kein-master' }));
    socket.on('error', (e: NodeJS.ErrnoException) => {
      const o = ordneEin({ art: 'fehler', code: e.code ?? 'UNBEKANNT' }, a.mdnsGesehen ?? false);
      ende({ ok: false, art: 'verbindung', code: o.art === 'code' ? o.code : 'sonstig', errCode: e.code });
    });

    socket.once('secureConnect', sicher(() => {
      const raw = socket.getPeerCertificate(true)?.raw;
      if (!raw) {
        ende({ ok: false, art: 'verbindung', code: 'kein-master' });
        return;
      }
      zertifikat = derZuPem(raw);
      fp = fingerprintVonPem(zertifikat); // der Fingerprint, den dieser Slave TATSÄCHLICH sieht
      // Spec 6.1: vor der Anmeldung 4 KiB je Zeile — hier spricht ein noch UNGEPRÜFTES Gegenüber.
      const verbindung = new Verbindung(socket, GRENZEN.vorAnmeldung);
      v = verbindung;
      verbindung.on('ende', () => ende({ ok: false, art: 'verbindung', code: 'kein-master' }));
      verbindung.on('nachricht', sicher((n: Nachricht) => {
        if (n.t === 'hallo' && !ns) {
          ns = n.nonce;
          halloMasterId = n.masterId;
          const d = { fp, ns, nc, rechnerId: a.rechner.id, schluessel: paar.oeffentlich };
          verbindung.sende({
            t: 'koppeln',
            protokoll: PROTOKOLL,
            rechnerId: a.rechner.id,
            rechnerName,
            nonce: nc,
            schluessel: paar.oeffentlich,
            beweis: slaveBeweis(code, d),
          });
          // HART: keine eingehende Zeile verlängert diese Frist (auch nicht 'puls').
          setzeFrist(f.koppelnMs, { ok: false, art: 'frist' });
          return;
        }
        if (!ns) return;
        // Vor dem geprüften 'gekoppelt' zählt nur 'abgelehnt' — und das nur zur Anzeige.
        if (n.t === 'abgelehnt') {
          ende({ ok: false, art: 'abgelehnt', grund: n.grund, rest: n.rest });
          return;
        }
        if (n.t !== 'gekoppelt') return;
        const d = { fp, ns, nc, rechnerId: a.rechner.id, schluessel: paar.oeffentlich };
        if (n.masterId !== halloMasterId || !gleicherBeweis(masterBeweis(code, d, n.masterId), n.beweis)) {
          ende({ ok: false, art: 'master-beweis' });
          return;
        }
        verbindung.removeAllListeners();
        // Spec 3.3: nach dem geprüften 'gekoppelt' ist die Verbindung angemeldet → 1 MiB je Zeile (Spec 6.1).
        verbindung.setzeGrenze(GRENZEN.nachAnmeldung);
        ende({
          ok: true,
          masterName: n.name,
          verbindung,
          kopplung: {
            masterId: n.masterId,
            masterName: n.name,
            fingerprint: fp,
            zertifikat,
            port,
            adressen: n.adressen,
            letzteAdresse: a.adresse,
            festeAdresse: a.festeAdresse ?? null,
            schluessel: paar,
          },
        });
      }));
    }));
  });
}
```

`src/index.ts` ergänzen: `export * from './koppeln';`

- [ ] **Schritt 5: Test grün sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts && npx tsc --noEmit -p tsconfig.json`
Expected: `… 0 fehlgeschlagen.`

- [ ] **Schritt 6: Commit**

```bash
git add packages/master-link/src/server.ts packages/master-link/src/koppeln.ts packages/master-link/src/index.ts packages/master-link/test/koppeln.test.ts packages/master-link/test/selftest.ts
git status --short
git commit -m "feat(master-link): Kopplung mit Beweis an den gesehenen Fingerprint und harter Slave-Frist" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aufgabe 11: Client (`client.ts`)

**Files:**
- Create: `packages/master-link/src/client.ts`, `packages/master-link/test/client.test.ts`
- Modify: `packages/master-link/src/index.ts`, `packages/master-link/test/selftest.ts`

**Interfaces:**
- Consumes: alles aus den Aufgaben 1–10
- Produces:
  - Zustand: `ClientZustand`, `VerbundWert`, `verbundWert(z)`
  - Anmeldung: `Angemeldet`, `Versuch`, `AnmeldeParameter`, `versucheAnmeldung(p)`
  - `ClientOptionen`: inklusive Test-Naht `anmelden?: (p: AnmeldeParameter) => Promise<Versuch>`
  - `MasterLinkClient`:
    - Methoden: `starte()`, `stoppe()`, `zustand()`, `uebernehme(v, kopplung, masterName)`
    - Ereignisse: `zustand`, `angemeldet`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

`packages/master-link/test/client.test.ts`:
```ts
import { createServer as netServer, type Socket } from 'node:net';
import { createServer as tlsServer } from 'node:tls';
import type { AddressInfo } from 'node:net';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { randomNonce } from '@jm/auth-core';
import { MasterLinkClient, verbundWert, versucheAnmeldung, type AnmeldeParameter, type ClientZustand, type Versuch } from '../src/client';
import { masterLinkPfad, schreibeMasterLinkDatei, type MasterLinkDatei } from '../src/datei';
import { fingerprintVonPem } from '../src/beweis';
import { PIN_FALSCH } from '../src/fehler';
import { fristen, GRENZEN, type Fristen } from '../src/fristen';
import { koppele } from '../src/koppeln';
import type { MasterSichtung, SucheLike } from '../src/mdns';
import type { Nachricht } from '../src/rahmen';
import { MasterLinkServer } from '../src/server';
import { Verbindung } from '../src/verbindung';
import { baueServer, neueIdentitaet, type Aufbau } from './aufbau';
import { abschnitt, bis, gleich, pruefe, tempOrdner, warte } from './helfer';
import { zertifikatMitGueltigkeit } from './zertifikate';

const KURZ: Partial<Fristen> = {
  dateiPruefMs: 50, rueckzugBasisMs: 50, rueckzugMaxMs: 200, tcpMs: 300, tlsHalloMs: 400, angemeldetMs: 400,
  stilleMs: 600, pulsMs: 150, zertifikatWiederholMs: 300, protokollWiederholMs: 300, ersetztWiederholMs: 400,
  lastMinMs: 100, suchrundeMs: 30,
};
const teilnehmer = { art: 'tool' as const, appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 7 };

function dateiFuer(a: Aufbau, teil: Partial<MasterLinkDatei> = {}): MasterLinkDatei {
  return {
    version: 1,
    rolle: 'slave',
    rechner: { id: a.slave.rechnerId, name: 'Regie-Laptop 2' },
    netzwerk: { karte: null },
    kopplung: {
      masterId: a.identitaet.masterId, masterName: 'Regie-PC', fingerprint: a.server.fingerprint,
      zertifikat: a.identitaet.zertifikat, port: a.port, adressen: ['127.0.0.1'], letzteAdresse: null,
      festeAdresse: null, schluessel: a.slave.paar,
    },
    ...teil,
  };
}

function neuerClient(pfad: string, extra: Partial<ConstructorParameters<typeof MasterLinkClient>[0]> = {}): MasterLinkClient {
  return new MasterLinkClient({ dateiPfad: pfad, teilnehmer, fristen: KURZ, suche: null, ...extra });
}

const art = (c: MasterLinkClient): string => verbundWert(c.zustand());

class FakeSuche implements SucheLike {
  sichtungen: MasterSichtung[] = [];
  runden = 0;
  setzeKarten(): void { /* egal */ }
  stoppe(): void { /* egal */ }
  async runde(): Promise<MasterSichtung[]> {
    this.runden++;
    return this.sichtungen;
  }
}

export async function laufe(): Promise<void> {
  abschnitt('Client: verbinden, Master weg und zurück');
  {
    const a = await baueServer({}, { pulsMs: 150, stilleMs: 600 });
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    const angemeldet: string[] = [];
    c.on('angemeldet', (x: { adresse: string }) => angemeldet.push(x.adresse));
    c.starte();
    await bis(() => art(c) === 'verbunden');
    gleich(art(c), 'verbunden', 'Client verbindet sich selbst');
    gleich(a.server.teilnehmer().map((t) => t.appId), ['jm-timer'], 'Master sieht das Tool');
    gleich(angemeldet, ['127.0.0.1'], 'Ereignis „angemeldet“ mit Adresse');
    await a.server.stoppe();
    await bis(() => art(c) !== 'verbunden');
    pruefe(art(c) !== 'verbunden', 'Master weg → nicht mehr verbunden');
    // Gleicher Puls wie a: sonst trennt die Stille-Frist des Clients (600 ms) mitten in den Prüffenstern unten.
    const b = new MasterLinkServer({ identitaet: a.identitaet, verbund: a.verbund, eigeneRechnerId: 'rechner-a', suiteVersion: '0.12.0', lauschAdressen: ['127.0.0.1'], port: a.port, fristen: { pulsMs: 150, stilleMs: 600 } });
    await b.starte();
    await bis(() => art(c) === 'verbunden', 3000);
    gleich(art(c), 'verbunden', 'Master zurück → ohne Zutun wieder verbunden');

    abschnitt('Client: entfernt, Datei-Änderungen');
    b.entferne('rechner-b');
    await bis(() => art(c) === 'fehler:unbekannt', 1000);
    gleich(art(c), 'fehler:unbekannt', 'entfernt während verbunden → fehler:unbekannt binnen 1 s');
    let versucheDanach = 0;
    const zaehle = (z: ClientZustand): void => {
      if (z.art === 'verbindet') versucheDanach++;
    };
    c.on('zustand', zaehle);
    await warte(500);
    c.off('zustand', zaehle);
    gleich(versucheDanach, 0, 'keine neuen Versuche nach „unbekannt“');
    const neu = dateiFuer(a);
    b.oeffneKopplung();
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: b.kopplungsStand().code!, rechner: { id: a.slave.rechnerId, name: 'Regie-Laptop 2' } });
    pruefe(r.ok, 'neu gekoppelt (Launcher-Weg)');
    if (r.ok) {
      r.verbindung.schliesse();
      schreibeMasterLinkDatei(pfad, { ...neu, kopplung: r.kopplung });
    }
    await bis(() => art(c) === 'verbunden', 3000);
    gleich(art(c), 'verbunden', 'Dateiänderung (neuer Schlüssel) → Neuaufbau, verbunden');
    const seit = (c.zustand() as Extract<ClientZustand, { art: 'verbunden' }>).seit;
    const d = { ...neu, kopplung: { ...(r.ok ? r.kopplung : neu.kopplung!), adressen: ['127.0.0.1', '10.9.9.9'] } };
    schreibeMasterLinkDatei(pfad, d);
    await warte(300);
    pruefe(art(c) === 'verbunden' && (c.zustand() as Extract<ClientZustand, { art: 'verbunden' }>).seit === seit, 'nur Adressen geändert → keine Trennung');
    rmSync(pfad);
    mkdirSync(pfad); // Ordner statt Datei: Lesen wirft EISDIR — ein I/O-Fehler wie EBUSY vom Virenscanner
    await warte(300);
    pruefe(art(c) === 'verbunden' && (c.zustand() as Extract<ClientZustand, { art: 'verbunden' }>).seit === seit,
      'Datei nicht lesbar (I/O-Fehler) → letzter gültiger Stand bleibt, keine Trennung (Spec 7.3)');
    rmSync(pfad, { recursive: true });
    writeFileSync(pfad, 'Müll');
    await bis(() => art(c) === 'fehler:datei', 1000);
    gleich(art(c), 'fehler:datei', 'Datei zweimal unlesbar → fehler:datei (Review Focus 3)');
    schreibeMasterLinkDatei(pfad, d);
    await bis(() => art(c) === 'verbunden', 3000);
    gleich(art(c), 'verbunden', 'Datei repariert → wieder verbunden');
    rmSync(pfad);
    await bis(() => art(c) === 'aus', 1000);
    gleich(art(c), 'aus', 'Datei im Betrieb gelöscht → aus, kein Absturz (Review Focus 3)');
    await c.stoppe();
    await b.stoppe();
  }

  abschnitt('Client: Zertifikat, Uhr, Protokoll, kein Master, verweigert');
  {
    const a = await baueServer();
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    await a.server.stoppe();
    const erneuert = new MasterLinkServer({ identitaet: neueIdentitaet(), verbund: a.verbund, eigeneRechnerId: 'rechner-a', suiteVersion: '0.12.0', lauschAdressen: ['127.0.0.1'], port: a.port });
    await erneuert.starte();
    const c = neuerClient(pfad);
    c.starte();
    await bis(() => art(c) === 'fehler:zertifikat', 2000);
    gleich(art(c), 'fehler:zertifikat', 'Master-Identität erneuert → fehler:zertifikat (CA-Prüfung im Handshake)');
    await c.stoppe();
    await erneuert.stoppe();
  }
  {
    // Pin im Handshake: das Zertifikat besteht die CA-Prüfung, nur der Fingerprint-Vergleich bzw. die masterId fällt.
    const a = await baueServer();
    const k = dateiFuer(a).kopplung!;
    const basis = { adresse: '127.0.0.1', rechner: { id: a.slave.rechnerId, name: 'Regie-Laptop 2' }, teilnehmer, f: fristen(KURZ) };
    const pin = await versucheAnmeldung({ ...basis, kopplung: { ...k, fingerprint: '00'.repeat(32) } });
    gleich(pin.ok ? null : pin.ergebnis, { art: 'fehler', code: PIN_FALSCH }, 'Zertifikat gültig, Fingerprint ≠ Pin → PIN_FALSCH');
    if (pin.ok) pin.a.v.schliesse();
    const fremdeId = await versucheAnmeldung({ ...basis, kopplung: { ...k, masterId: 'anderer-master' } });
    gleich(fremdeId.ok ? null : fremdeId.ergebnis, { art: 'fehler', code: PIN_FALSCH }, 'hallo mit fremder masterId → PIN_FALSCH');
    if (fremdeId.ok) fremdeId.a.v.schliesse();
    await a.server.stoppe();
  }
  {
    const z = zertifikatMitGueltigkeit(new Date(Date.now() + 3600e3), new Date(Date.now() + 3650 * 864e5));
    const srv = tlsServer({ key: z.key, cert: z.cert }, () => { /* nie erreicht */ });
    srv.on('tlsClientError', (_e, s) => s.destroy());
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    const a = await baueServer();
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, { ...d, kopplung: { ...d.kopplung!, zertifikat: z.cert, fingerprint: fingerprintVonPem(z.cert), port: (srv.address() as AddressInfo).port } });
    const c = neuerClient(pfad);
    c.starte();
    await bis(() => art(c) === 'fehler:uhr', 2000);
    gleich(art(c), 'fehler:uhr', 'Zertifikat noch nicht gültig → fehler:uhr (nicht „anderer Master“)');
    await c.stoppe();
    srv.close();
    await a.server.stoppe();
  }
  {
    const a = await baueServer();
    await a.server.stoppe();
    const srv = tlsServer({ key: a.identitaet.schluessel, cert: a.identitaet.zertifikat }, (ts) => {
      const v = new Verbindung(ts, 1 << 20);
      v.on('nachricht', (n: Nachricht) => {
        if (n.t === 'anmelden') { v.sende({ t: 'abgelehnt', grund: 'protokoll', master: 2, suite: '0.13.0' }); v.schliesse(); }
      });
      v.sende({ t: 'hallo', protokoll: 2, masterId: a.identitaet.masterId, name: 'Regie-PC', nonce: randomNonce() });
    });
    await new Promise<void>((r) => srv.listen(a.port, '127.0.0.1', r));
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    c.starte();
    await bis(() => art(c) === 'fehler:protokoll', 2000);
    const z = c.zustand();
    pruefe(z.art === 'fehler' && z.text.includes('Launcher 0.13.0 (Protokoll 2)'), 'fehler:protokoll nennt den Stand des Masters');
    await c.stoppe();
    srv.close();
  }
  {
    const a = await baueServer();
    await a.server.stoppe();
    const sockets: Socket[] = [];
    const stumm = netServer((s) => { sockets.push(s); s.on('error', () => {}); });
    await new Promise<void>((r) => stumm.listen(a.port, '127.0.0.1', r));
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    c.starte();
    await bis(() => art(c) === 'fehler:kein-master', 2000);
    gleich(art(c), 'fehler:kein-master', 'TCP steht, aber kein TLS/hallo → kein-master');
    await c.stoppe();
    sockets.forEach((s) => s.destroy());
    stumm.close();
    const c2 = neuerClient(pfad);
    c2.starte();
    await bis(() => art(c2) === 'fehler:verweigert', 2000);
    gleich(art(c2), 'fehler:verweigert', 'niemand lauscht → verweigert');
    await c2.stoppe();
    // Spec 11.1 Nr. 5 „zusätzlich ein Nicht-TLS-Dienst“: Klartext statt ServerHello → ERR_SSL_* → kein-master
    const klartext = netServer((s) => { s.on('error', () => {}); s.write('HTTP/1.1 400 Bad Request\r\n\r\n'); });
    await new Promise<void>((r) => klartext.listen(0, '127.0.0.1', r));
    const d3 = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, { ...d3, kopplung: { ...d3.kopplung!, port: (klartext.address() as AddressInfo).port } });
    const c3 = neuerClient(pfad);
    c3.starte();
    await bis(() => art(c3) === 'fehler:kein-master', 2000);
    gleich(art(c3), 'fehler:kein-master', 'Nicht-TLS-Dienst auf dem Port → kein-master (nicht sonstig)');
    await c3.stoppe();
    klartext.close();
  }

  abschnitt('Client: Zeilengrenze 4 KiB vor, 1 MiB nach der Anmeldung (Spec 6.1)');
  {
    const a = await baueServer();
    await a.server.stoppe();
    let grossVorAngemeldet = true;
    let verbindungen = 0;
    const srv = tlsServer({ key: a.identitaet.schluessel, cert: a.identitaet.zertifikat }, (ts) => {
      verbindungen++;
      const v = new Verbindung(ts, 1 << 20);
      v.on('nachricht', (n: Nachricht) => {
        if (n.t === 'puls') v.sende({ t: 'puls' }); // hält die Stille-Frist des Clients fern
        if (n.t !== 'anmelden') return;
        if (grossVorAngemeldet) ts.write(`{"t":"gross","x":"${'y'.repeat(GRENZEN.vorAnmeldung)}"}\n`);
        v.sende({ t: 'angemeldet', adressen: [], suite: '0.12.0' });
        if (!grossVorAngemeldet) setTimeout(() => ts.write(`{"t":"gross","x":"${'y'.repeat(100_000)}"}\n`), 100);
      });
      v.sende({ t: 'hallo', protokoll: 1, masterId: a.identitaet.masterId, name: 'Regie-PC', nonce: randomNonce() });
    });
    await new Promise<void>((r) => srv.listen(a.port, '127.0.0.1', r));
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    const gesehen = new Set<string>();
    c.on('zustand', () => gesehen.add(art(c)));
    c.starte();
    await bis(() => art(c) === 'fehler:kein-master', 2000);
    pruefe(art(c) === 'fehler:kein-master' && !gesehen.has('verbunden'), 'Zeile > 4 KiB vor „angemeldet“ → Verbindung zu (kein-master), nie verbunden');
    await c.stoppe();
    grossVorAngemeldet = false;
    verbindungen = 0;
    const c2 = neuerClient(pfad);
    c2.starte();
    await bis(() => art(c2) === 'verbunden', 2000);
    await warte(400);
    pruefe(art(c2) === 'verbunden' && verbindungen === 1, `nach „angemeldet“ sind 100-KB-Zeilen erlaubt (1 MiB), ${verbindungen} Verbindung(en)`);
    await c2.stoppe();
    srv.close();
  }

  abschnitt('Client: Stille (Review Focus 5) und ersetzt');
  {
    const a = await baueServer();
    await a.server.stoppe();
    let verbindungen = 0;
    const srv = tlsServer({ key: a.identitaet.schluessel, cert: a.identitaet.zertifikat }, (ts) => {
      verbindungen++;
      const v = new Verbindung(ts, 1 << 20);
      v.on('nachricht', (n: Nachricht) => {
        if (n.t === 'anmelden') v.sende({ t: 'angemeldet', adressen: [], suite: '0.12.0' }); // danach: Schweigen
      });
      v.sende({ t: 'hallo', protokoll: 1, masterId: a.identitaet.masterId, name: 'Regie-PC', nonce: randomNonce() });
    });
    await new Promise<void>((r) => srv.listen(a.port, '127.0.0.1', r));
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c = neuerClient(pfad);
    c.starte();
    await bis(() => verbindungen >= 2, 3000);
    pruefe(verbindungen >= 2, 'halboffene Verbindung (keine Zeile) → nach stilleMs selbst neu aufgebaut');
    await c.stoppe();
    srv.close();
  }
  {
    const a = await baueServer({}, { pulsMs: 150, stilleMs: 600 });
    const pfad = masterLinkPfad(tempOrdner());
    schreibeMasterLinkDatei(pfad, dateiFuer(a));
    const c1 = neuerClient(pfad);
    const c2 = neuerClient(pfad);
    const gesehen = new Set<string>();
    const luecken: number[] = [];
    for (const c of [c1, c2]) {
      let ersetztSeit: number | null = null;
      c.on('zustand', () => {
        const w = art(c);
        gesehen.add(w);
        if (w === 'fehler:ersetzt') ersetztSeit = Date.now();
        else if (w === 'verbindet' && ersetztSeit !== null) {
          luecken.push(Date.now() - ersetztSeit);
          ersetztSeit = null;
        }
      });
    }
    c1.starte();
    await bis(() => art(c1) === 'verbunden');
    c2.starte();
    await bis(() => gesehen.has('fehler:ersetzt'), 2000);
    pruefe(gesehen.has('fehler:ersetzt'), 'zweite Instanz mit gleicher Kennung → fehler:ersetzt');
    await bis(() => luecken.length > 0, 2000);
    pruefe(luecken.length > 0 && Math.min(...luecken) >= 300,
      `nach „ersetzt“ erst nach ersetztWiederholMs (400) neu versucht: ${luecken.join(', ')} ms (kein Sekundentakt-Pingpong)`);
    await c1.stoppe();
    await c2.stoppe();
    await a.server.stoppe();
  }

  abschnitt('Client: Kandidaten, mDNS, Rolle master (Test-Naht anmelden)');
  {
    const a = await baueServer();
    await a.server.stoppe();
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, { ...d, kopplung: { ...d.kopplung!, adressen: ['10.0.0.9'] } });
    const versucht: string[] = [];
    const anmelden = async (p: AnmeldeParameter): Promise<Versuch> => {
      versucht.push(p.adresse);
      return { ok: false, ergebnis: { art: 'tcp-timeout' } };
    };
    const suche = new FakeSuche();
    suche.sichtungen = [
      { masterId: 'anderer-saal', name: 'Regie-PC', fpKurz: 'bb', protokoll: 1, adressen: ['10.0.0.60'] },
      { masterId: a.identitaet.masterId, name: 'Regie-PC', fpKurz: 'aa', protokoll: 1, adressen: ['10.0.0.50'] },
    ];
    const c = neuerClient(pfad, { suche, anmelden });
    c.starte();
    await bis(() => art(c) === 'fehler:zeit', 1000);
    gleich(art(c), 'fehler:zeit', 'Timeout + eigener Master per mDNS gesehen → zeit (Firewall?)');
    gleich(versucht.slice(0, 2), ['10.0.0.50', '10.0.0.9'], 'nur die eigene masterId (nicht der zweite „Regie-PC“), dann Datei');
    pruefe(!versucht.includes('10.0.0.60'), 'fremder Master gleichen Namens wird nie versucht (Review Focus 4)');
    await c.stoppe();

    suche.sichtungen = [];
    const c2 = neuerClient(pfad, { suche, anmelden });
    c2.starte();
    await bis(() => art(c2) === 'fehler:nicht-gefunden', 1000);
    gleich(art(c2), 'fehler:nicht-gefunden', 'Timeout ohne mDNS-Sichtung → nicht-gefunden (Windows-Stealth)');
    await c2.stoppe();

    versucht.length = 0;
    const rundenVorher = suche.runden;
    schreibeMasterLinkDatei(pfad, { ...d, rolle: 'master', kopplung: { ...d.kopplung!, adressen: ['10.0.0.9'] } });
    const c3 = neuerClient(pfad, { suche, anmelden });
    c3.starte();
    await bis(() => versucht.length > 0, 1000);
    gleich([...new Set(versucht)], ['127.0.0.1'], 'Rolle master → nur 127.0.0.1');
    gleich(suche.runden, rundenVorher, 'Rolle master → keine mDNS-Suchrunde');
    await c3.stoppe();
  }

  abschnitt('Client: Verbindung nach dem Koppeln übernehmen');
  {
    const a = await baueServer({}, { pulsMs: 150, stilleMs: 600 });
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, { ...d, rechner: { id: 'rechner-c', name: 'Neuer PC' }, kopplung: null });
    const c = new MasterLinkClient({ dateiPfad: pfad, teilnehmer: { ...teilnehmer, art: 'launcher', appId: 'jm-launcher' }, fristen: KURZ, suche: null });
    c.starte();
    await bis(() => art(c) === 'aus');
    gleich(art(c), 'aus', 'Slave ohne Kopplung → aus (untätig)');
    a.server.oeffneKopplung();
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: a.server.kopplungsStand().code!, rechner: { id: 'rechner-c', name: 'Neuer PC' } });
    pruefe(r.ok, 'gekoppelt');
    if (r.ok) {
      schreibeMasterLinkDatei(pfad, { ...d, rechner: { id: 'rechner-c', name: 'Neuer PC' }, kopplung: r.kopplung });
      c.uebernehme(r.verbindung, r.kopplung, r.masterName);
      await bis(() => art(c) === 'verbunden');
      gleich(art(c), 'verbunden', 'übernommene Verbindung ist angemeldet');
      const seit = (c.zustand() as Extract<ClientZustand, { art: 'verbunden' }>).seit;
      await warte(300);
      pruefe(art(c) === 'verbunden' && (c.zustand() as Extract<ClientZustand, { art: 'verbunden' }>).seit === seit,
        'Dateibeobachter baut die übernommene Verbindung nicht neu auf');
    }
    await c.stoppe();
    gleich(art(c), 'aus', 'stoppe → aus');
    c.starte();
    await bis(() => art(c) === 'verbunden', 2000);
    gleich(art(c), 'verbunden', 'starte() nach stoppe(), Datei unverändert → verbindet wieder');
    await c.stoppe();
    await a.server.stoppe();
  }

  abschnitt('Client: unbrauchbarer Schlüssel, Ausnahmen in Handlern (Spec 7.3: stürzt nie ab)');
  {
    // GEMESSEN: privat 'AAAA' bestand die Dateiprüfung, signiereAnmeldung warf im Handler → Exit 1 in jedem Tool.
    const a = await baueServer();
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    schreibeMasterLinkDatei(pfad, { ...d, kopplung: { ...d.kopplung!, schluessel: { ...a.slave.paar, privat: 'AAAA' } } });
    const c = neuerClient(pfad);
    const gesehen = new Set<string>();
    c.on('zustand', () => gesehen.add(art(c)));
    c.starte();
    await bis(() => art(c) === 'fehler:datei', 1000);
    gleich(art(c), 'fehler:datei', 'privater Schlüssel unbrauchbar → fehler:datei, Prozess lebt');
    pruefe(!gesehen.has('verbindet'), '… ohne Verbindungsversuch');
    await c.stoppe();
    await a.server.stoppe();
  }
  {
    // Eine Ausnahme in einem Socket-Handler wäre ungefangen und beendete den ganzen Prozess (jedes Tool).
    const a = await baueServer();
    const wirft = { get id(): string { throw Object.assign(new Error('Testwurf'), { code: 'TESTWURF' }); }, name: 'Regie-Laptop 2' };
    const r = await versucheAnmeldung({ adresse: '127.0.0.1', kopplung: dateiFuer(a).kopplung!, rechner: wirft, teilnehmer, f: fristen(KURZ) });
    gleich(r.ok ? null : r.ergebnis, { art: 'fehler', code: 'TESTWURF' }, 'Ausnahme im Handler von versucheAnmeldung → Fehlerergebnis statt Absturz');
    await a.server.stoppe();
  }
  {
    const a = await baueServer({}, { pulsMs: 150, stilleMs: 600 });
    const pfad = masterLinkPfad(tempOrdner());
    const d = dateiFuer(a);
    const rechner = { id: 'rechner-c', name: 'Neuer PC' };
    schreibeMasterLinkDatei(pfad, { ...d, rechner, kopplung: null });
    const c = new MasterLinkClient({ dateiPfad: pfad, teilnehmer: { ...teilnehmer, art: 'launcher', appId: 'jm-launcher' }, fristen: KURZ, suche: null });
    const fehler: string[] = [];
    c.on('zustand', (z: ClientZustand) => { if (z.art === 'fehler') fehler.push(`${z.code}/${z.errCode ?? ''}`); });
    c.starte();
    a.server.oeffneKopplung();
    const r = await koppele({ adresse: '127.0.0.1', port: a.port, code: a.server.kopplungsStand().code!, rechner });
    pruefe(r.ok, 'gekoppelt');
    if (r.ok) {
      schreibeMasterLinkDatei(pfad, { ...d, rechner, kopplung: r.kopplung });
      c.uebernehme(r.verbindung, r.kopplung, r.masterName);
      // Gleich nach uebernehme() wartet der Handler; die echte Antwort des Masters ist noch nicht gelesen.
      const wurf = { t: 'angemeldet', suite: '0.12.0', get adressen(): string[] { throw Object.assign(new Error('Testwurf'), { code: 'TESTWURF' }); } };
      let durch = false;
      try {
        r.verbindung.emit('nachricht', wurf);
      } catch {
        durch = true;
      }
      pruefe(!durch, 'Ausnahme im Handler von warteAufAngemeldet dringt nicht bis zum Socket durch (dort: Absturz)');
      await bis(() => fehler.length > 0, 1000);
      gleich(fehler[0], 'sonstig/TESTWURF', '… sondern wird Fehlerergebnis: fehler:sonstig mit errCode');
      await bis(() => art(c) === 'verbunden', 3000);
      gleich(art(c), 'verbunden', '… danach normal neu verbunden');
    }
    await c.stoppe();
    await a.server.stoppe();
  }
}
```

In `test/selftest.ts` `client` ergänzen.

- [ ] **Schritt 2: Test laufen lassen und Fehlschlag sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts`
Expected: FAIL mit `Cannot find module '../src/client'`

- [ ] **Schritt 3: `client.ts` schreiben**

`packages/master-link/src/client.ts`:
```ts
import { EventEmitter } from 'node:events';
import { networkInterfaces } from 'node:os';
import { connect } from 'node:tls';
import { normalizeFingerprint } from '@jm/auth-core';
import { kandidatenliste, listeKarten, wirksameKarten, type NetzwerkInterfaces } from './adresswahl';
import { signiereAnmeldung } from './beweis';
import { DateiBeobachter, type Kopplung, type MasterLinkDatei } from './datei';
import {
  fehlerText, ordneEin, PIN_FALSCH, RAHMEN, rueckzugMs, staerkster, wiederholung,
  type FehlerCode, type VersuchsErgebnis,
} from './fehler';
import { fristen as mitFristen, GRENZEN, type Fristen } from './fristen';
import { MdnsSuche, standardFabrik, type SucheLike } from './mdns';
import { PROTOKOLL, type Grund, type Nachricht, type TeilnehmerInfo } from './rahmen';
import { Verbindung } from './verbindung';

// Client eines Tools bzw. Slave-Launchers (Spec 4.4, 4.5, 5.1, 9). Liest master-link.json,
// sucht den Master (mDNS je Runde frisch → Datei → feste Adresse), meldet sich per Ed25519 an
// und hält die Verbindung mit Puls/Stille. Ohne Kopplung völlig untätig.

export type ClientZustand =
  | { art: 'aus' }
  | { art: 'sucht' }
  | { art: 'verbindet'; adresse: string }
  | { art: 'verbunden'; adresse: string; seit: number; masterName: string; suite: string }
  | { art: 'fehler'; code: FehlerCode; text: string; errCode?: string };

export type VerbundWert = 'aus' | 'sucht' | 'verbindet' | 'verbunden' | `fehler:${FehlerCode}`;

export function verbundWert(z: ClientZustand): VerbundWert {
  return z.art === 'fehler' ? `fehler:${z.code}` : z.art;
}

export interface Angemeldet {
  v: Verbindung;
  adresse: string;
  masterName: string;
  suite: string;
  adressen: string[];
}

export type Versuch = { ok: true; a: Angemeldet } | { ok: false; ergebnis: VersuchsErgebnis };

export interface AnmeldeParameter {
  adresse: string;
  kopplung: Kopplung;
  rechner: { id: string; name: string };
  teilnehmer: TeilnehmerInfo;
  f: Fristen;
}

/**
 * Eine Ausnahme in einem Socket-Handler wäre ungefangen und beendete den ganzen Prozess (jedes Tool).
 * Sie wird zum Fehlerergebnis mit err.code, eingeordnet wie ein Socket-Fehler (Spec 9.1, meist „sonstig“).
 */
function sicherIn<T extends unknown[]>(ende: (r: Versuch) => void, h: (...x: T) => void): (...x: T) => void {
  return (...x: T): void => {
    try {
      h(...x);
    } catch (e) {
      ende({ ok: false, ergebnis: { art: 'fehler', code: (e as NodeJS.ErrnoException).code ?? 'UNBEKANNT' } });
    }
  };
}

/** Ein Anmeldeversuch an EINER Adresse: TCP-Frist → TLS mit Pin im Handshake → hallo → anmelden → angemeldet. */
export function versucheAnmeldung(p: AnmeldeParameter): Promise<Versuch> {
  return new Promise<Versuch>((fertig) => {
    let erledigt = false;
    let frist: ReturnType<typeof setTimeout> | null = null;
    let v: Verbindung | null = null;
    let masterName = p.kopplung.masterName;

    const socket = connect({
      host: p.adresse,
      port: p.kopplung.port,
      ca: [p.kopplung.zertifikat],
      rejectUnauthorized: true,
      // Pin IM Handshake (Spec 6.1): nur der Fingerprint zählt; das Zertifikat trägt keine IP.
      checkServerIdentity: (_host, cert) =>
        normalizeFingerprint(cert.fingerprint256 ?? '') === p.kopplung.fingerprint
          ? undefined
          : Object.assign(new Error('Zertifikat passt nicht zum Pin'), { code: PIN_FALSCH }),
    });

    const ende = (r: Versuch): void => {
      if (erledigt) return;
      erledigt = true;
      if (frist) clearTimeout(frist);
      if (!r.ok) {
        v?.removeAllListeners();
        socket.destroy();
      }
      fertig(r);
    };
    const setzeFrist = (ms: number, e: VersuchsErgebnis): void => {
      if (frist) clearTimeout(frist);
      frist = setTimeout(() => ende({ ok: false, ergebnis: e }), ms);
    };

    setzeFrist(p.f.tcpMs, { art: 'tcp-timeout' });
    socket.once('connect', () => setzeFrist(p.f.tlsHalloMs, { art: 'frist' }));
    socket.on('error', (e: NodeJS.ErrnoException) => ende({ ok: false, ergebnis: { art: 'fehler', code: e.code ?? 'UNBEKANNT' } }));
    socket.once('secureConnect', sicherIn(ende, () => {
      // Spec 6.1: 4 KiB je Zeile bis 'angemeldet', danach 1 MiB.
      const verbindung = new Verbindung(socket, GRENZEN.vorAnmeldung);
      v = verbindung;
      verbindung.on('ende', (f?: Error) =>
        ende({ ok: false, ergebnis: f?.message === 'rahmen' ? { art: 'fehler', code: RAHMEN } : { art: 'frist' } }),
      );
      verbindung.on('nachricht', sicherIn(ende, (n: Nachricht) => {
        if (n.t === 'hallo') {
          if (n.masterId !== p.kopplung.masterId) {
            ende({ ok: false, ergebnis: { art: 'fehler', code: PIN_FALSCH } });
            return;
          }
          masterName = n.name;
          verbindung.sende({
            t: 'anmelden',
            protokoll: PROTOKOLL,
            rechnerId: p.rechner.id,
            rechnerName: p.rechner.name,
            signatur: signiereAnmeldung(p.kopplung.schluessel.privat, p.kopplung.fingerprint, n.nonce, p.rechner.id),
            teilnehmer: p.teilnehmer,
          });
          setzeFrist(p.f.angemeldetMs, { art: 'frist' });
          return;
        }
        if (n.t === 'abgelehnt') {
          ende({ ok: false, ergebnis: { art: 'abgelehnt', grund: n.grund, master: n.master, suite: n.suite } });
          return;
        }
        if (n.t === 'angemeldet') {
          verbindung.removeAllListeners();
          verbindung.setzeGrenze(GRENZEN.nachAnmeldung);
          ende({ ok: true, a: { v: verbindung, adresse: p.adresse, masterName, suite: n.suite, adressen: n.adressen } });
        }
      }));
    }));
  });
}

/** Nach koppele(): 'teilnehmer' auf derselben Verbindung senden und auf 'angemeldet' warten. */
function warteAufAngemeldet(v: Verbindung, teilnehmer: TeilnehmerInfo, masterName: string, f: Fristen): Promise<Versuch> {
  return new Promise<Versuch>((fertig) => {
    let erledigt = false;
    const ende = (r: Versuch): void => {
      if (erledigt) return;
      erledigt = true;
      clearTimeout(t);
      if (!r.ok) {
        v.removeAllListeners();
        v.socket.destroy();
      }
      fertig(r);
    };
    const t = setTimeout(() => ende({ ok: false, ergebnis: { art: 'frist' } }), f.angemeldetMs);
    v.on('ende', () => ende({ ok: false, ergebnis: { art: 'frist' } }));
    v.on('nachricht', sicherIn(ende, (n: Nachricht) => {
      if (n.t === 'abgelehnt') {
        ende({ ok: false, ergebnis: { art: 'abgelehnt', grund: n.grund, master: n.master, suite: n.suite } });
        return;
      }
      if (n.t === 'angemeldet') {
        v.removeAllListeners();
        ende({ ok: true, a: { v, adresse: v.adresse, masterName, suite: n.suite, adressen: n.adressen } });
      }
    }));
    v.sende({ t: 'teilnehmer', teilnehmer });
  });
}

export interface ClientOptionen {
  dateiPfad: string;
  teilnehmer: TeilnehmerInfo;
  fristen?: Partial<Fristen>;
  netzwerkKarten?: () => NetzwerkInterfaces;
  /** Vorgabe: echtes mDNS; null = keine Suche (Tests, Rolle master braucht keine). */
  suche?: SucheLike | null;
  jetzt?: () => number;
  zufall?: () => number;
  log?: (stufe: 'info' | 'warn', text: string) => void;
  /** Test-Naht: ersetzt den echten Anmeldeversuch. */
  anmelden?: (p: AnmeldeParameter) => Promise<Versuch>;
}

type BetriebsEnde = { art: 'ende' } | { art: 'abgelehnt'; grund: Grund; master?: number; suite?: string };

export class MasterLinkClient extends EventEmitter {
  private readonly o: ClientOptionen;
  private readonly f: Fristen;
  private readonly beobachter: DateiBeobachter;
  private readonly suche: SucheLike | null;
  private readonly netz: () => NetzwerkInterfaces;
  private readonly jetzt: () => number;
  private readonly anmelden: (p: AnmeldeParameter) => Promise<Versuch>;
  private z: ClientZustand = { art: 'aus' };
  private datei: MasterLinkDatei | null = null;
  private laeuft = false;
  /** Jede relevante Änderung erhöht die Generation; alte Schleifen beenden sich daran. */
  private generation = 0;
  private verbindung: Verbindung | null = null;
  private dateiZeitgeber: ReturnType<typeof setInterval> | null = null;
  private weckeAuf: (() => void) | null = null;
  private letzteAdresse: string | null = null;
  private gelernteAdressen: string[] = [];

  constructor(o: ClientOptionen) {
    super();
    this.o = o;
    this.f = mitFristen(o.fristen);
    this.beobachter = new DateiBeobachter(o.dateiPfad);
    this.netz = o.netzwerkKarten ?? networkInterfaces;
    this.jetzt = o.jetzt ?? Date.now;
    this.anmelden = o.anmelden ?? versucheAnmeldung;
    this.suche = o.suche === undefined ? new MdnsSuche(standardFabrik((t) => this.log('warn', t))) : o.suche;
  }

  zustand(): ClientZustand {
    return this.z;
  }

  starte(): void {
    if (this.laeuft) return;
    this.laeuft = true;
    this.pruefeDatei(true);
    this.dateiZeitgeber = setInterval(() => this.pruefeDatei(), this.f.dateiPruefMs);
    this.dateiZeitgeber.unref?.();
  }

  async stoppe(): Promise<void> {
    this.laeuft = false;
    this.generation++;
    if (this.dateiZeitgeber) {
      clearInterval(this.dateiZeitgeber);
      this.dateiZeitgeber = null;
    }
    this.weckeAuf?.();
    this.trenne();
    this.suche?.stoppe();
    this.setze({ art: 'aus' });
  }

  /** Nach koppele(): Launcher hat master-link.json schon geschrieben → einlesen, Verbindung weiterführen. */
  uebernehme(v: Verbindung, kopplung: Kopplung, masterName: string): void {
    const b = this.beobachter.pruefe();
    if (b.art === 'geaendert') this.datei = b.datei;
    this.generation++;
    this.weckeAuf?.();
    this.trenne();
    const gen = this.generation;
    const d = this.datei;
    if (!this.laeuft || !d || !d.kopplung || d.kopplung.fingerprint !== kopplung.fingerprint) {
      v.schliesse();
      if (this.laeuft) this.neustart();
      return;
    }
    this.setze({ art: 'verbindet', adresse: v.adresse });
    void this.schleife(gen, warteAufAngemeldet(v, this.o.teilnehmer, masterName, this.f));
  }

  /** `beimStart`: nach stoppe() → starte() auch bei unveränderter Datei mit dem letzten gültigen Stand neu aufbauen. */
  private pruefeDatei(beimStart = false): void {
    const b = this.beobachter.pruefe();
    if (b.art === 'unveraendert') {
      if (beimStart) this.neustart();
      return;
    }
    if (b.art === 'defekt') {
      if (this.z.art === 'fehler' && this.z.code === 'datei') return;
      this.generation++;
      this.weckeAuf?.();
      this.trenne();
      this.setze({ art: 'fehler', code: 'datei', text: fehlerText('datei', { masterName: this.datei?.kopplung?.masterName ?? '' }) });
      return;
    }
    this.datei = b.datei;
    if (b.relevant) this.neustart();
  }

  private neustart(): void {
    this.generation++;
    this.weckeAuf?.();
    this.trenne();
    this.letzteAdresse = null;
    this.gelernteAdressen = [];
    const d = this.datei;
    if (!this.laeuft || !d || d.rolle === 'aus' || !d.kopplung) {
      this.suche?.stoppe();
      this.setze({ art: 'aus' });
      return;
    }
    void this.schleife(this.generation);
  }

  private async schleife(gen: number, erster?: Promise<Versuch>): Promise<void> {
    let versuch = 0;
    if (erster) {
      const r = await erster;
      if (gen !== this.generation || !this.laeuft) {
        if (r.ok) r.a.v.schliesse();
        return;
      }
      if (r.ok) {
        if (!(await this.verbunden(r.a, gen))) return;
      } else {
        const w = this.werteAus([r.ergebnis], false, versuch++);
        if (w === null) return;
        await this.warte(w, gen);
      }
    }
    runde: while (this.laeuft && gen === this.generation) {
      const d = this.datei;
      if (!d || !d.kopplung || d.rolle === 'aus') return;
      const kopplung = d.kopplung;
      this.setze({ art: 'sucht' });
      const alleKarten = listeKarten(this.netz());
      let mdns: string[] = [];
      let mdnsGesehen = false;
      if (d.rolle === 'slave' && this.suche) {
        this.suche.setzeKarten(wirksameKarten(alleKarten, d.netzwerk.karte).karten);
        const sichtungen = await this.suche.runde(this.f.suchrundeMs);
        if (gen !== this.generation) return;
        const meine = sichtungen.filter((s) => s.masterId === kopplung.masterId);
        mdnsGesehen = meine.length > 0;
        mdns = meine.flatMap((s) => s.adressen);
      }
      const kandidaten = kandidatenliste({
        rolle: d.rolle === 'master' ? 'master' : 'slave',
        mdns,
        letzteAdresse: this.letzteAdresse ?? kopplung.letzteAdresse,
        adressen: [...this.gelernteAdressen, ...kopplung.adressen],
        festeAdresse: kopplung.festeAdresse,
        karten: alleKarten,
        gewaehlteKarte: d.netzwerk.karte,
      });
      const ergebnisse: VersuchsErgebnis[] = [];
      let fehlerAdresse: string | undefined;
      for (const adresse of kandidaten) {
        if (gen !== this.generation || !this.laeuft) return;
        this.setze({ art: 'verbindet', adresse });
        const r = await this.anmelden({ adresse, kopplung, rechner: d.rechner, teilnehmer: this.o.teilnehmer, f: this.f });
        if (gen !== this.generation || !this.laeuft) {
          if (r.ok) r.a.v.schliesse();
          return;
        }
        if (r.ok) {
          versuch = 0;
          if (!(await this.verbunden(r.a, gen))) return;
          continue runde;
        }
        ergebnisse.push(r.ergebnis);
        fehlerAdresse = adresse;
        const e = ordneEin(r.ergebnis, mdnsGesehen);
        // Unser Master hat geantwortet (Pin passte) — andere Adressen ändern daran nichts.
        if (e.art === 'code' && ['unbekannt', 'signatur', 'protokoll', 'uhr'].includes(e.code)) break;
      }
      const w = this.werteAus(ergebnisse, mdnsGesehen, versuch++, fehlerAdresse);
      if (w === null) return;
      await this.warte(w, gen);
    }
  }

  /** Setzt den Zustand aus den Ergebnissen einer Runde; liefert die Wartezeit oder null (keine Wiederholung). */
  private werteAus(ergebnisse: VersuchsErgebnis[], mdnsGesehen: boolean, versuch: number, adresse?: string): number | null {
    const codes: FehlerCode[] = [];
    let intern: 'anmeldefrist' | 'last' | null = null;
    let errCode: string | undefined;
    let ablehnung: { master?: number; suite?: string } = {};
    for (const e of ergebnisse) {
      const o = ordneEin(e, mdnsGesehen);
      if (o.art === 'intern') intern = intern === 'last' ? 'last' : o.grund;
      else codes.push(o.code);
      if (e.art === 'fehler') errCode = e.code;
      if (e.art === 'abgelehnt') ablehnung = { master: e.master, suite: e.suite };
    }
    if (ergebnisse.length === 0) codes.push('nicht-gefunden');
    const code = staerkster(codes);
    if (code) {
      const masterName = this.datei?.kopplung?.masterName ?? '';
      this.setze({
        art: 'fehler',
        code,
        text: fehlerText(code, { masterName, adresse, errCode, suite: ablehnung.suite, masterProtokoll: ablehnung.master }),
        ...(code === 'sonstig' && errCode ? { errCode } : {}),
      });
      const w = wiederholung(code, this.f);
      if (w.art === 'keine') return null;
      return w.art === 'fest' ? w.ms : rueckzugMs(versuch, this.f, this.o.zufall);
    }
    this.setze({ art: 'sucht' });
    const r = rueckzugMs(versuch, this.f, this.o.zufall);
    return intern === 'last' ? Math.max(this.f.lastMinMs, r) : r;
  }

  /** Verbunden-Phase; true = Schleife geht weiter, false = aufhören (keine Wiederholung/Generation vorbei). */
  private async verbunden(a: Angemeldet, gen: number): Promise<boolean> {
    const aus = await this.betreibe(a);
    if (gen !== this.generation || !this.laeuft) return false;
    if (aus.art === 'abgelehnt') {
      const w = this.werteAus([{ art: 'abgelehnt', grund: aus.grund, master: aus.master, suite: aus.suite }], true, 0);
      if (w === null) return false;
      await this.warte(w, gen);
      return gen === this.generation && this.laeuft;
    }
    this.setze({ art: 'sucht' });
    await this.warte(rueckzugMs(0, this.f, this.o.zufall), gen);
    return gen === this.generation && this.laeuft;
  }

  private betreibe(a: Angemeldet): Promise<BetriebsEnde> {
    return new Promise<BetriebsEnde>((fertig) => {
      this.verbindung = a.v;
      this.letzteAdresse = a.adresse;
      this.gelernteAdressen = a.adressen;
      this.setze({ art: 'verbunden', adresse: a.adresse, seit: this.jetzt(), masterName: a.masterName, suite: a.suite });
      this.emit('angemeldet', { adresse: a.adresse, adressen: a.adressen, suite: a.suite });
      let ergebnis: BetriebsEnde = { art: 'ende' };
      let stille: ReturnType<typeof setTimeout> | null = null;
      const setzeStille = (): void => {
        if (stille) clearTimeout(stille);
        stille = setTimeout(() => a.v.socket.destroy(), this.f.stilleMs);
      };
      setzeStille();
      const puls = setInterval(() => a.v.sende({ t: 'puls' }), this.f.pulsMs);
      a.v.on('nachricht', (n: Nachricht) => {
        setzeStille();
        if (n.t === 'abgelehnt') ergebnis = { art: 'abgelehnt', grund: n.grund, master: n.master, suite: n.suite };
      });
      a.v.on('unbekannt', setzeStille);
      a.v.on('ende', () => {
        if (stille) clearTimeout(stille);
        clearInterval(puls);
        if (this.verbindung === a.v) this.verbindung = null;
        fertig(ergebnis);
      });
    });
  }

  private trenne(): void {
    const v = this.verbindung;
    this.verbindung = null;
    v?.schliesse();
  }

  private warte(ms: number, gen: number): Promise<void> {
    if (gen !== this.generation) return Promise.resolve();
    return new Promise<void>((fertig) => {
      const aufwachen = (): void => {
        clearTimeout(t);
        if (this.weckeAuf === aufwachen) this.weckeAuf = null;
        fertig();
      };
      const t = setTimeout(aufwachen, ms);
      this.weckeAuf = aufwachen;
    });
  }

  private setze(z: ClientZustand): void {
    const alt = this.z;
    if (JSON.stringify(alt) === JSON.stringify(z)) return;
    this.z = z;
    const neuerFehler = z.art === 'fehler' && (alt.art !== 'fehler' || alt.code !== z.code);
    if (alt.art !== z.art || neuerFehler) {
      const zusatz = z.art === 'verbunden' ? ` (${z.adresse})` : z.art === 'fehler' ? ` — ${z.text}` : '';
      this.log(z.art === 'fehler' ? 'warn' : 'info', `Master-Link: ${verbundWert(z)}${zusatz}`);
    }
    this.emit('zustand', z);
  }

  private log(stufe: 'info' | 'warn', text: string): void {
    this.o.log?.(stufe, text);
  }
}
```

`src/index.ts` ergänzen: `export * from './client';`

- [ ] **Schritt 4: Test grün sehen**

Run: `cd packages/master-link && npx tsx test/selftest.ts && npx tsc --noEmit -p tsconfig.json`
Expected: `… 0 fehlgeschlagen.`. Ein Lauf des gesamten Selbsttests dauert wenige zehn Sekunden.

- [ ] **Schritt 5: Commit**

```bash
git add packages/master-link/src/client.ts packages/master-link/src/index.ts packages/master-link/test/client.test.ts packages/master-link/test/selftest.ts
git status --short
git commit -m "feat(master-link): Client mit frischer Suche, Pin im Handshake, Puls/Stille, Dateibeobachter" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Aufgabe 12: `@jm/app-runtime` startet den Client in jedem Tool

**Files:**
- Modify: `packages/app-runtime/package.json` (Abhängigkeit `@jm/master-link`)
- Modify: `packages/app-runtime/src/index.ts` (Kopfkommentar, Option, `startPresence`, `startMasterLink`, `getMasterLinkStatus`)
- Modify: `apps/launcher/src/main/index.ts` (`masterLink: false`, Schritt 7)
- Modify: `package-lock.json` (per `npm install`)

**Interfaces:**
- Consumes: `MasterLinkClient`, `masterLinkPfad`, `verbundWert`, `ClientZustand` (Aufgaben 6, 11)
- Produces:
  - `AppRuntimeOptions.masterLink?: boolean`, Vorgabe `true`
  - `getMasterLinkStatus(): ClientZustand`, `export type { ClientZustand }`
  - Heartbeat-Feld `verbund` (Werte: `aus`, `sucht`, `verbindet`, `verbunden`, `fehler:<code>`), sofort neu gesendet bei jedem Wechsel

Diese Schicht hängt an Electron (`app.whenReady`, `hasSingleInstanceLock`) und ist deshalb nicht per Selbsttest prüfbar. Belegt wird sie durch die Typprüfung aller Apps und den End-zu-End-Lauf mit dem gebauten Timer (Aufgabe 16, Schritt 7).

**Voraussetzung, geprüft beim Schreiben des Plans (Spec 8.2):** Alle 25 Electron-Apps fordern die Einzelinstanz-Sperre synchron auf Modulebene an, 18 direkt per `app.requestSingleInstanceLock()` und 7 über `setupSingleInstance` aus `@jm/electron-kit`. Sie tun das jeweils **nach** `initAppRuntime` und **vor** ihrem eigenen `whenReady`.

Damit ist `app.hasSingleInstanceLock()` im `whenReady`-Callback von app-runtime verlässlich gesetzt. Ein neues Tool ohne Sperre bekäme keinen Master-Link. Das ist gewollt: Ohne Sperre ist „eine Instanz je Rechner“ nicht gesichert.

- [ ] **Schritt 1: Abhängigkeit eintragen und installieren**

In `packages/app-runtime/package.json` nach `"scripts"` ergänzen:
```json
  "dependencies": {
    "@jm/master-link": "*"
  },
```
Run: `npm install`
Expected: `package-lock.json` bekommt bei `packages/app-runtime` ein `dependencies`-Feld. `git status --short` zeigt beide Dateien.

- [ ] **Schritt 2: Kopfkommentar berichtigen**

In `packages/app-runtime/src/index.ts` den Satz „Bewusst OHNE externe Abhängigkeiten (nur node:* + electron), weil das Paket von electron-vite in den App-Main gebündelt wird … und gepackte Apps kein node_modules mitliefern.“ ersetzen durch:
```ts
// Abhängigkeiten: node:*, electron und @jm/master-link (+ dessen bonjour-service). Alles wird
// von electron-vite in den App-Main GEBÜNDELT (@jm/app-runtime steht in jeder exclude-Liste von
// externalizeDepsPlugin) — zur Laufzeit wird nichts davon aus node_modules geladen.
```

- [ ] **Schritt 3: Import, Option und Modulzustand ergänzen**

Unter den bestehenden Importen:
```ts
import { MasterLinkClient, masterLinkPfad, verbundWert, type ClientZustand } from '@jm/master-link';
```

In `AppRuntimeOptions` nach `csp?: …` einfügen:
```ts
  /**
   * Master-Link-Client starten (Master-Link Teil 1, Default true): verbindet das Tool mit dem
   * gekoppelten Master. Startet erst in app.whenReady() und NUR mit Single-Instance-Lock — eine
   * kurz gestartete Zweitinstanz meldet sich so nie an. Ohne Kopplung (master-link.json fehlt,
   * Rolle „aus“) völlig untätig. Der Launcher setzt false: er führt seinen eigenen Client.
   */
  masterLink?: boolean;
```

Unter `let defaultLogger: Logger | null = null;`:
```ts
let masterLinkClient: MasterLinkClient | null = null;
```

- [ ] **Schritt 4: `startPresence` liest `verbund` bei jedem Senden frisch**

Die Funktion `startPresence` ganz ersetzen:
```ts
function startPresence(info: {
  appId: string;
  name: string;
  version: string;
  servicePort?: number;
  logDir: string;
  lastCrash: { kind: string; at: string } | null;
  /** Zustand des Master-Links — bei JEDEM Senden frisch gelesen (Spec 5.2). */
  verbund?: () => string | undefined;
}): { sofort(): void } {
  const hub = process.env['JMPS_HUB_URL'] || DEFAULT_HUB;
  let target: URL;
  try {
    target = new URL('/presence', hub);
  } catch {
    return { sofort: () => {} };
  }
  const { verbund, ...stamm } = info;

  const send = (event: 'hello' | 'beat' | 'bye'): void => {
    try {
      const body = JSON.stringify({ ...stamm, verbund: verbund?.(), pid: process.pid, event });
      const req = http.request({
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
        timeout: 1500,
      });
      // Hub läuft evtl. nicht — Fehler bewusst verschlucken (best-effort).
      req.on('error', () => {});
      req.on('timeout', () => req.destroy());
      req.end(body);
    } catch {
      /* best-effort */
    }
  };

  send('hello');
  const timer = setInterval(() => send('beat'), HEARTBEAT_MS);
  timer.unref?.();
  let beendet = false;
  app.on('before-quit', () => {
    // Nach „bye“ kein Beat mehr: client.stoppe() meldet beim Beenden noch „aus“ — ein Beat nach „bye“
    // zeigte das Tool im Launcher bis zu 25 s weiter als laufend (gemessen).
    beendet = true;
    clearInterval(timer);
    send('bye');
  });
  // Zustandswechsel des Master-Links sofort melden, nicht erst im 10-s-Takt.
  return { sofort: () => { if (!beendet) send('beat'); } };
}
```

- [ ] **Schritt 5: `startMasterLink` und `getMasterLinkStatus` ergänzen**

Direkt unter `startPresence` einfügen:
```ts
// ── Master-Link (Teil 1) ─────────────────────────────────────────────────────

function startMasterLink(info: {
  appId: string;
  name: string;
  version: string;
  log: Logger;
  beiWechsel: () => void;
}): void {
  const los = (): void => {
    try {
      if (masterLinkClient) return;
      // Erst NACH der Sperre der App: whenReady läuft nach dem synchronen requestSingleInstanceLock
      // aller Tools. Zweitinstanz (lock=false) → kein Client (gemessen: sonst Anmeldung in 4–9 ms).
      if (!app.hasSingleInstanceLock()) return;
      const client = new MasterLinkClient({
        dateiPfad: masterLinkPfad(app.getPath('appData')),
        teilnehmer: { art: 'tool', appId: info.appId, name: info.name, version: info.version, pid: process.pid },
        log: (stufe, text) => info.log[stufe](text),
      });
      client.on('zustand', () => info.beiWechsel());
      masterLinkClient = client;
      client.starte();
      app.on('before-quit', () => {
        void client.stoppe();
      });
    } catch (err) {
      info.log.warn(`Master-Link nicht gestartet: ${(err as Error).message}`);
    }
  };
  void app.whenReady().then(los);
}

/** Zustand des Master-Links in diesem Tool (Basis für Teil 2). */
export function getMasterLinkStatus(): ClientZustand {
  return masterLinkClient?.zustand() ?? { art: 'aus' };
}

export type { ClientZustand } from '@jm/master-link';
```

- [ ] **Schritt 6: In `initAppRuntime` einhängen**

Den Block `if (opts.presence !== false) { startPresence({ … }); }` ersetzen durch:
```ts
  const masterLinkAn = opts.masterLink !== false;
  let presence: { sofort(): void } | null = null;
  if (opts.presence !== false) {
    presence = startPresence({
      appId: opts.appId,
      name: opts.appName ?? opts.appId,
      version,
      servicePort: opts.servicePort,
      logDir,
      lastCrash: readLastCrash(logDir),
      // Ohne Master-Link-Option kein Feld → der Launcher zeigt „noch ohne Verbund“.
      verbund: masterLinkAn
        ? () => (masterLinkClient ? verbundWert(masterLinkClient.zustand()) : 'aus')
        : undefined,
    });
  }
  if (masterLinkAn) {
    startMasterLink({
      appId: opts.appId,
      name: opts.appName ?? opts.appId,
      version,
      log,
      beiWechsel: () => presence?.sofort(),
    });
  }
```

- [ ] **Schritt 7: Launcher schaltet den Tool-Client ab**

In `apps/launcher/src/main/index.ts` im Aufruf `initAppRuntime({ csp: true, … presence: false, … })` nach `presence: false,` ergänzen:
```ts
  masterLink: false, // der Launcher führt seinen Client selbst (src/main/verbund)
```

- [ ] **Schritt 8: Typprüfung und Bestand prüfen**

Run:
```bash
npm run selftest -w @jm/app-runtime
npm run typecheck -w @jm/timer
npm run typecheck -w @jm/titler
npm run typecheck -w @jm/launcher
npm run typecheck -w @jm/prompter
```
Expected:
- `15 passed, 0 failed` (bestehender CSP-Test).
- Alle vier Typprüfungen ohne Fehler, auch Timer und Prompter mit `lib: ["ES2022"]`: Die Quellen von master-link werden dort mitgeprüft.

- [ ] **Schritt 9: Bündelung prüfen (Timer, Titler)**

Run:
```bash
npm run build -w @jm/timer
npm run build -w @jm/titler
```
Danach in beiden `out/main/index.cjs` prüfen:
```bash
grep -c "jmps-master" apps/timer/out/main/index.cjs apps/titler/out/main/index.cjs
grep -c 'require("bonjour-service")\|require("@jm/master-link")' apps/timer/out/main/index.cjs apps/titler/out/main/index.cjs
```
Expected:
- Erster `grep`: je ≥ 1 (Master-Link gebündelt).
- Zweiter `grep`: je `0` (nichts wird zur Laufzeit aus node_modules geladen).

- [ ] **Schritt 10: Commit**

```bash
git add packages/app-runtime/package.json packages/app-runtime/src/index.ts apps/launcher/src/main/index.ts package-lock.json
git status --short
git commit -m "feat(app-runtime): Master-Link-Client nach Single-Instance-Lock, verbund im Heartbeat" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aufgabe 13: Presence-Hub meldet den Verbund-Zustand der Tools

**Files:**
- Create: `apps/launcher/src/main/presence-store.ts`
- Modify: `apps/launcher/src/main/presence.ts`, `apps/launcher/src/shared/types.ts` (`PresenceRecord.verbund`), `apps/launcher/test/selftest.ts`

**Interfaces:**
- Produces:
  - `PresenceStore(melde, jetzt?, staleMs?)` mit `verarbeite(beat)`, `pruefe()`, `snapshot()`, `logQuellen()`
  - `gueltigerVerbund(v: unknown): string | undefined`
  - `PresenceRecord.verbund?: string`
- Die Signatur von `maybeNotify` bezieht jetzt `verbund` ein. Das ist eine bewusste Änderung der Presence-Logik (Spec 5.2, 8.3).

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

In `apps/launcher/test/selftest.ts` unter dem bestehenden Import ergänzen:
```ts
import { PresenceStore, gueltigerVerbund } from '../src/main/presence-store.ts';
```

Vor der Schlussausgabe (`console.log(\`\n${pass} ok …\`)`) einfügen:
```ts
// --- Presence: Verbund-Zustand der Tools (Master-Link Teil 1, Spec 5.2) -----
// Vorher meldete der Hub nur Start/Stopp (Signatur appId@version): ein Wechsel
// "verbunden" -> "fehler:zeit" kam bei offenem Launcher nie in der Anzeige an.
{
  let meldungen = 0;
  const s = new PresenceStore(() => { meldungen++; });
  s.verarbeite({ appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 1, event: 'hello', verbund: 'verbunden' });
  ck('hello meldet einmal', meldungen === 1);
  s.verarbeite({ appId: 'jm-timer', event: 'beat', verbund: 'verbunden' });
  ck('gleicher Zustand meldet nicht erneut', meldungen === 1);
  s.verarbeite({ appId: 'jm-timer', event: 'beat', verbund: 'fehler:zeit' });
  ck('Wechsel des Verbund-Zustands meldet genau einmal', meldungen === 2);
  ck('Snapshot traegt den Zustand', s.snapshot()[0].verbund === 'fehler:zeit');
  s.verarbeite({ appId: 'jm-timer', event: 'beat' });
  ck('Beat ohne Feld (alter Tool-Stand) -> verbund undefined', s.snapshot()[0].verbund === undefined);
  ck('gueltigerVerbund lehnt Muell ab', gueltigerVerbund('rm -rf') === undefined && gueltigerVerbund(42) === undefined);
  ck('gueltigerVerbund nimmt fehler:<code>', gueltigerVerbund('fehler:nicht-gefunden') === 'fehler:nicht-gefunden');
  s.verarbeite({ appId: 'jm-timer', event: 'bye' });
  ck('bye meldet', meldungen === 4 && !s.snapshot()[0].running);
  s.verarbeite({ appId: 'jm-qa', name: 'JM Q&A', version: '0.3.0', pid: 2, event: 'hello', logDir: 'C:/logs/qa' });
  ck('logQuellen: nur Tools mit logDir (Log-Anhang im Feedback)',
    JSON.stringify(s.logQuellen()) === JSON.stringify([{ appId: 'jm-qa', name: 'JM Q&A', logDir: 'C:/logs/qa' }]));
}
{
  let jetzt = 1000;
  let meldungen = 0;
  const s = new PresenceStore(() => { meldungen++; }, () => jetzt, 25_000);
  s.verarbeite({ appId: 'jm-qa', event: 'hello' });
  jetzt += 26_000;
  s.pruefe();
  ck('ohne Lebenszeichen nach 25 s gestoppt (Sweep meldet)', meldungen === 2 && !s.snapshot()[0].running);
}
```

- [ ] **Schritt 2: Test laufen lassen und Fehlschlag sehen**

Run: `npm run selftest -w @jm/launcher`
Expected: FAIL mit `Cannot find module '…/src/main/presence-store.ts'`

- [ ] **Schritt 3: `presence-store.ts` schreiben**

`apps/launcher/src/main/presence-store.ts`:
```ts
// Presence-Logik OHNE Netz und OHNE Electron — damit test/selftest.ts sie per
// node --experimental-strip-types pruefen kann (keine Laufzeit-Importe hier!).
// Master-Link Teil 1 (Spec 5.2): Feld `verbund` = Zustand des Master-Links im Tool;
// es gehoert zur Signatur, damit jeder Zustandswechsel die Anzeige erreicht.

export interface Beat {
  appId?: string;
  name?: string;
  version?: string;
  pid?: number;
  servicePort?: number;
  logDir?: string;
  event?: 'hello' | 'beat' | 'bye';
  lastCrash?: { kind: string; at: string } | null;
  verbund?: unknown;
}

export interface PresenceZeile {
  appId: string;
  name: string;
  version: string;
  pid: number;
  servicePort?: number;
  running: boolean;
  lastSeen: number;
  lastCrash: { kind: string; at: string } | null;
  verbund?: string;
}

interface Eintrag {
  appId: string;
  name: string;
  version: string;
  pid: number;
  servicePort?: number;
  logDir?: string;
  lastSeen: number;
  stopped: boolean;
  lastCrash: { kind: string; at: string } | null;
  verbund?: string;
}

const VERBUND = /^(aus|sucht|verbindet|verbunden|fehler:[a-z-]+)$/;

export function gueltigerVerbund(v: unknown): string | undefined {
  return typeof v === 'string' && VERBUND.test(v) ? v : undefined;
}

export class PresenceStore {
  private readonly eintraege = new Map<string, Eintrag>();
  private signatur = '';
  private readonly melde: () => void;
  private readonly jetzt: () => number;
  private readonly staleMs: number;

  constructor(melde: () => void, jetzt: () => number = Date.now, staleMs = 25_000) {
    this.melde = melde;
    this.jetzt = jetzt;
    this.staleMs = staleMs;
  }

  private laeuft(e: Eintrag): boolean {
    return !e.stopped && this.jetzt() - e.lastSeen < this.staleMs;
  }

  snapshot(): PresenceZeile[] {
    return [...this.eintraege.values()]
      .map((e) => ({
        appId: e.appId,
        name: e.name,
        version: e.version,
        pid: e.pid,
        servicePort: e.servicePort,
        running: this.laeuft(e),
        lastSeen: e.lastSeen,
        lastCrash: e.lastCrash,
        verbund: e.verbund,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Meldet nur, wenn sich laufende Tools, ihre Version ODER ihr Verbund-Zustand geaendert haben. */
  pruefe(): void {
    const sig = this.snapshot()
      .filter((r) => r.running)
      .map((r) => `${r.appId}@${r.version}#${r.verbund ?? '-'}`)
      .join(',');
    if (sig !== this.signatur) {
      this.signatur = sig;
      this.melde();
    }
  }

  verarbeite(beat: Beat): void {
    if (!beat.appId) return;
    const prev = this.eintraege.get(beat.appId);
    if (beat.event === 'bye') {
      if (prev) {
        prev.stopped = true;
        prev.lastSeen = this.jetzt();
      }
      this.pruefe();
      return;
    }
    this.eintraege.set(beat.appId, {
      appId: beat.appId,
      name: beat.name ?? prev?.name ?? beat.appId,
      version: beat.version ?? prev?.version ?? '?',
      pid: beat.pid ?? prev?.pid ?? 0,
      servicePort: beat.servicePort ?? prev?.servicePort,
      logDir: beat.logDir ?? prev?.logDir,
      lastSeen: this.jetzt(),
      stopped: false,
      lastCrash: beat.lastCrash ?? prev?.lastCrash ?? null,
      // Bewusst NICHT aus prev: ein Beat ohne Feld stammt von einem Tool ohne Master-Link.
      verbund: gueltigerVerbund(beat.verbund),
    });
    this.pruefe();
  }

  logQuellen(): { appId: string; name: string; logDir: string }[] {
    return [...this.eintraege.values()]
      .filter((e): e is Eintrag & { logDir: string } => Boolean(e.logDir))
      .map((e) => ({ appId: e.appId, name: e.name, logDir: e.logDir }));
  }
}
```

- [ ] **Schritt 4: `presence.ts` auf den Store umstellen**

`apps/launcher/src/main/presence.ts` ganz ersetzen:
```ts
import http from 'node:http';
import type { PresenceRecord } from '@shared/types';
import { PresenceStore, type Beat } from './presence-store';

// ─────────────────────────────────────────────────────────────────────────────
// Presence-Hub — der Launcher ist der zentrale Empfänger der Tool-Heartbeats.
//
// Jedes Tool meldet über @jm/app-runtime per POST /presence (hello/beat/bye).
// Die Logik (inkl. Master-Link-Feld `verbund`) steckt in presence-store.ts; hier
// nur der HTTP-Hub auf Loopback. Gepusht wird, wenn sich laufende Tools, ihre
// Version oder ihr Verbund-Zustand ändern — „vor X s“ tickt die UI aus `lastSeen`.
// ─────────────────────────────────────────────────────────────────────────────

const HUB_HOST = '127.0.0.1';
const HUB_PORT = 7799;
const SWEEP_MS = 5_000; // wie oft auf stale gewordene Tools geprüft wird
const MAX_BODY = 64 * 1024;

let server: http.Server | null = null;
let notify: (() => void) | null = null;
const store = new PresenceStore(() => notify?.());

/**
 * Startet den lokalen Presence-Hub. `onChange` wird gerufen, sobald sich laufende
 * Tools oder ihr Verbund-Zustand ändern (Empfehlung: emitAppEvent presence-changed).
 */
export function startPresenceHub(onChange: () => void): void {
  if (server) return;
  notify = onChange;

  server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/presence') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > MAX_BODY) req.destroy();
      });
      req.on('end', () => {
        try {
          store.verarbeite(JSON.parse(body) as Beat);
        } catch {
          /* fehlerhafte Beats ignorieren */
        }
        res.writeHead(204);
        res.end();
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  // Port belegt o. Ä. → Hub bleibt einfach aus, der Launcher läuft normal weiter.
  server.on('error', () => {
    server = null;
  });
  server.listen(HUB_PORT, HUB_HOST);

  // Stale gewordene Tools erkennen (Crash ohne "bye" sendet kein Lebenszeichen).
  const sweep = setInterval(() => store.pruefe(), SWEEP_MS);
  sweep.unref?.();
}

/** Aktueller Laufzeit-Zustand aller bekannten Tools (für die UI). */
export function getPresence(): PresenceRecord[] {
  return store.snapshot();
}

/**
 * Log-Verzeichnisse aller Tools, die sich in dieser Sitzung gemeldet haben —
 * Grundlage für den Log-Anhang im Feedback (Fehlerberichte).
 */
export function getLogSources(): { appId: string; name: string; logDir: string }[] {
  return store.logQuellen();
}
```

In `apps/launcher/src/shared/types.ts` in `PresenceRecord` nach `lastCrash?: …` ergänzen:
```ts
  /**
   * Zustand des Master-Links im Tool (Master-Link Teil 1): aus · sucht · verbindet · verbunden ·
   * fehler:<code>. Fehlt das Feld, hat das Tool noch keinen Master-Link (älterer Stand).
   */
  verbund?: string;
```

- [ ] **Schritt 5: Test grün sehen**

Run:
```bash
npm run selftest -w @jm/launcher
npm run typecheck -w @jm/launcher
```
Expected: `… ok, 0 fehlgeschlagen.`, Typprüfung ohne Fehler.

- [ ] **Schritt 6: Commit**

```bash
git add apps/launcher/src/main/presence-store.ts apps/launcher/src/main/presence.ts apps/launcher/src/shared/types.ts apps/launcher/test/selftest.ts
git status --short
git commit -m "feat(launcher): Presence meldet Verbund-Zustand der Tools sofort" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aufgabe 14: Verbund-Typen, Kopfanzeige, Anzeigetexte

**Files:**
- Modify: `apps/launcher/src/shared/types.ts` (Verbund-Typen, `AppEvent` `verbund-changed`)
- Create: `apps/launcher/src/renderer/src/lib/kopfanzeige.ts`, `apps/launcher/src/renderer/src/lib/verbund-texte.ts`
- Modify: `apps/launcher/test/selftest.ts`

**Interfaces:**
- Produces:
  - **Verbund-Typen** (in `shared/types.ts`):
    - Rollen und Zustände: `VerbundRolle`, `VerbundFehlerCode`, `MasterZustand`
    - Einträge: `VerbundKarte`, `VerbundTool`, `VerbundRechner`, `GefundenerMaster`, `VerbundKopplungsfenster`
    - Stände: `VerbundMasterStand`, `VerbundClientStand`, `VerbundSlaveStand`, `VerbundStand`
    - Antwort: `KoppelAntwort`
  - `AppEvent` bekommt `{ type: 'verbund-changed' }`
  - `kopfanzeige.ts`: `Farbe`, `KopfEingang`, `Kopf`, `kopfanzeige(e)`, `kopfEingang(s)`
  - `verbund-texte.ts`: `toolVerbundText(verbund, rolleAus)`, `zeigeCode(code)`, `relativ(ms)`, `uhrzeit(ts)`

Beide Renderer-Dateien importieren **nur** `import type`. So lädt sie der Launcher-Selbsttest (strip-types) ohne Alias.

- [ ] **Schritt 1: Typen ergänzen**

In `apps/launcher/src/shared/types.ts` die bisher letzte Variante von `AppEvent` ersetzen: Das Semikolon wandert hinter die neue Variante.
```ts
  | { type: 'iveo-active-changed'; event: string; day?: string; activeProgramId?: string; canSwitch: boolean }
  // Master-Link Teil 1: Rolle, Kopplung, Teilnehmer oder Client-Zustand haben sich geändert.
  | { type: 'verbund-changed' };
```

Am Dateiende anfügen:
```ts
// ── Master-Link / Verbund (Spec docs/superpowers/specs/2026-09-30-master-link-teil1-design.md) ──

export type VerbundRolle = 'aus' | 'master' | 'slave';

/** Spiegel von FehlerCode aus @jm/master-link — der Renderer importiert das Paket nicht (Node-Typen). */
export type VerbundFehlerCode =
  | 'zeit' | 'nicht-gefunden' | 'verweigert' | 'netz' | 'kein-master' | 'zertifikat' | 'uhr'
  | 'protokoll' | 'unbekannt' | 'signatur' | 'ersetzt' | 'datei' | 'sonstig';

export interface VerbundKarte {
  name: string;
  /** „10.0.0.110/24“ */
  adressen: string[];
  virtuell: boolean;
  nurLinkLocal: boolean;
}

export interface VerbundTool {
  appId: string;
  name: string;
  version: string;
  art: 'tool' | 'launcher';
  verbundenSeit: number;
}

export interface VerbundRechner {
  rechnerId: string;
  name: string;
  dieserRechner: boolean;
  online: boolean;
  zuletztGesehen: number | null;
  adresse: string | null;
  tools: VerbundTool[];
}

export interface GefundenerMaster {
  masterId: string;
  name: string;
  fpKurz: string;
  /** Beste zuerst (#234-Reihenfolge). */
  adressen: string[];
}

export type MasterZustand = 'startet' | 'laeuft' | 'port-belegt' | 'daten-beschaedigt' | 'lausch-fehler';

export interface VerbundKopplungsfenster {
  offen: boolean;
  code: string | null;
  gueltigBis: number | null;
  rest: number;
  ungueltig: boolean;
}

export interface VerbundMasterStand {
  zustand: MasterZustand;
  fehlerCode: string | null;
  name: string;
  fpKurz: string;
  /** Eine Datei wurde aus .bak wiederhergestellt. */
  ausBak: boolean;
  rechner: VerbundRechner[];
  kopplung: VerbundKopplungsfenster;
}

export interface VerbundClientStand {
  art: 'aus' | 'sucht' | 'verbindet' | 'verbunden' | 'fehler';
  adresse?: string;
  seit?: number;
  code?: VerbundFehlerCode;
  text?: string;
  errCode?: string;
}

export interface VerbundSlaveStand {
  gekoppelt: boolean;
  koppeltGerade: boolean;
  masterName: string | null;
  festeAdresse: string | null;
  client: VerbundClientStand;
  gefundeneMaster: GefundenerMaster[];
}

export interface VerbundStand {
  rolle: VerbundRolle;
  rechnerName: string;
  karten: VerbundKarte[];
  gewaehlteKarte: string | null;
  karteFehlt: boolean;
  /** master-link.json beim Start nicht lesbar (I/O-Code, Spec 7.3): Rolle unbekannt, es wird nichts geschrieben. */
  dateiFehler: string | null;
  master: VerbundMasterStand | null;
  slave: VerbundSlaveStand | null;
}

export type KoppelAntwort = { ok: true } | { ok: false; text: string };
```

- [ ] **Schritt 2: Den fehlschlagenden Test schreiben**

In `apps/launcher/test/selftest.ts` unter den Importen:
```ts
import { kopfanzeige, kopfEingang, type KopfEingang } from '../src/renderer/src/lib/kopfanzeige.ts';
import { toolVerbundText, zeigeCode } from '../src/renderer/src/lib/verbund-texte.ts';
import type { VerbundStand } from '../src/shared/types.ts';
```

Vor der Schlussausgabe einfügen:
```ts
// --- Kopfanzeige: JEDE Zeile der Tabelle Spec 5.4 ---------------------------
// Dauerhafte Anzeigen luegen, wenn ein Zustand fehlt (#208: sechs Faelle).
{
  const k = false;
  const n = 'Regie-PC';
  const faelle: Array<[KopfEingang, string, string]> = [
    [{ rolle: 'aus' }, 'Verbund aus', 'gedaempft'],
    [{ rolle: 'master', zustand: 'startet', karteFehlt: k }, 'Master startet…', 'gedaempft'],
    [{ rolle: 'master', zustand: 'laeuft', n: 0, m: 0, karteFehlt: k }, 'Master · noch keine Rechner', 'neutral'],
    [{ rolle: 'master', zustand: 'laeuft', n: 2, m: 2, karteFehlt: k }, 'Master · 2/2 Rechner online', 'gruen'],
    [{ rolle: 'master', zustand: 'laeuft', n: 1, m: 2, karteFehlt: k }, 'Master · 1/2 Rechner online', 'gelb'],
    [{ rolle: 'master', zustand: 'port-belegt', karteFehlt: k }, 'Master: Port 8738 belegt', 'rot'],
    [{ rolle: 'master', zustand: 'daten-beschaedigt', karteFehlt: k }, 'Master: Verbunddaten beschädigt', 'rot'],
    [{ rolle: 'master', zustand: 'lausch-fehler', errCode: 'EACCES', karteFehlt: k }, 'Master-Fehler: EACCES', 'rot'],
    [{ rolle: 'slave', zustand: 'nicht-gekoppelt', karteFehlt: k }, 'Nicht gekoppelt: Master wählen', 'gedaempft'],
    [{ rolle: 'slave', zustand: 'koppelt', name: n, karteFehlt: k }, 'Koppeln mit Regie-PC…', 'gelb'],
    [{ rolle: 'slave', zustand: 'sucht', name: n, karteFehlt: k }, 'Suche Regie-PC…', 'gelb'],
    [{ rolle: 'slave', zustand: 'verbindet', name: n, karteFehlt: k }, 'Verbinde mit Regie-PC…', 'gelb'],
    [{ rolle: 'slave', zustand: 'verbunden', name: n, karteFehlt: k }, 'Regie-PC ●', 'gruen'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'zeit', name: n, karteFehlt: k }, 'Regie-PC sichtbar, Port gesperrt: Firewall?', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'nicht-gefunden', name: n, karteFehlt: k }, 'Regie-PC nicht erreichbar', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'verweigert', name: n, karteFehlt: k }, 'Regie-PC: Master-Modus aus?', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'netz', name: n, karteFehlt: k }, 'Regie-PC: Netz nicht erreichbar', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'kein-master', name: n, karteFehlt: k }, 'Adresse antwortet nicht als Master', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'zertifikat', name: n, karteFehlt: k }, 'Anderer Master unter dieser Adresse', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'uhr', name: n, karteFehlt: k }, 'Uhrzeit prüfen', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'protokoll', name: n, karteFehlt: k }, 'Versionen angleichen', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'unbekannt', name: n, karteFehlt: k }, 'Vom Master entfernt: neu koppeln', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'signatur', name: n, karteFehlt: k }, 'Anmeldung abgelehnt: neu koppeln', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'ersetzt', name: n, karteFehlt: k }, 'Kennung doppelt: neu koppeln', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'datei', name: n, karteFehlt: k }, 'Kopplung beschädigt: neu koppeln', 'rot'],
    [{ rolle: 'slave', zustand: 'fehler', code: 'sonstig', errCode: 'ECONNRESET', name: n, karteFehlt: k }, 'Verbindungsfehler ECONNRESET', 'rot'],
  ];
  let alle = true;
  for (const [ein, text, farbe] of faelle) {
    const aus = kopfanzeige(ein);
    if (aus.text !== text || aus.farbe !== farbe) {
      alle = false;
      console.log(`      erwartet "${text}"/${farbe}, ist "${aus.text}"/${aus.farbe}`);
    }
  }
  ck(`Kopfanzeige: alle ${faelle.length} Zeilen der Tabelle 5.4`, alle);

  // Vorrang „Karte fehlt“: gruen/neutral -> gelb + Hinweis; gelb/gedaempft -> Hinweis; rot -> unveraendert
  const kf = (e: KopfEingang) => kopfanzeige(e);
  ck('Karte fehlt: gruen -> gelb + Hinweis',
    JSON.stringify(kf({ rolle: 'slave', zustand: 'verbunden', name: n, karteFehlt: true })) === JSON.stringify({ text: 'Regie-PC ● · Karte fehlt', farbe: 'gelb' }));
  ck('Karte fehlt: neutral -> gelb',
    JSON.stringify(kf({ rolle: 'master', zustand: 'laeuft', n: 0, m: 0, karteFehlt: true })) === JSON.stringify({ text: 'Master · noch keine Rechner · Karte fehlt', farbe: 'gelb' }));
  ck('Karte fehlt: gelb bleibt gelb, Hinweis angehaengt',
    JSON.stringify(kf({ rolle: 'slave', zustand: 'sucht', name: n, karteFehlt: true })) === JSON.stringify({ text: 'Suche Regie-PC… · Karte fehlt', farbe: 'gelb' }));
  ck('Karte fehlt: rot bleibt unveraendert (Text UND Farbe)',
    JSON.stringify(kf({ rolle: 'slave', zustand: 'fehler', code: 'zeit', name: n, karteFehlt: true })) === JSON.stringify({ text: 'Regie-PC sichtbar, Port gesperrt: Firewall?', farbe: 'rot' }));

  // Abbildung Stand -> Eingang: n/m zaehlen nur FREMDE Rechner
  const basis: VerbundStand = { rolle: 'master', rechnerName: 'A', karten: [], gewaehlteKarte: null, karteFehlt: false, dateiFehler: null, master: null, slave: null };
  const rechner = (id: string, dieser: boolean, online: boolean) =>
    ({ rechnerId: id, name: id, dieserRechner: dieser, online, zuletztGesehen: null, adresse: null, tools: [] });
  const m = {
    zustand: 'laeuft' as const, fehlerCode: null, name: 'Regie-PC', fpKurz: 'ab', ausBak: false,
    rechner: [rechner('a', true, true), rechner('b', false, true), rechner('c', false, false)],
    kopplung: { offen: false, code: null, gueltigBis: null, rest: 0, ungueltig: false },
  };
  ck('kopfEingang: n/m ohne „dieser Rechner“',
    JSON.stringify(kopfEingang({ ...basis, master: m })) === JSON.stringify({ rolle: 'master', zustand: 'laeuft', n: 1, m: 2, karteFehlt: false }));
  const sl = { gekoppelt: true, koppeltGerade: false, masterName: 'Regie-PC', festeAdresse: null, gefundeneMaster: [], client: { art: 'aus' as const } };
  ck('kopfEingang: gekoppelt, Client noch aus -> sucht',
    kopfEingang({ ...basis, rolle: 'slave', slave: sl }).rolle === 'slave' && (kopfEingang({ ...basis, rolle: 'slave', slave: sl }) as { zustand: string }).zustand === 'sucht');
  ck('kopfEingang: nicht gekoppelt',
    (kopfEingang({ ...basis, rolle: 'slave', slave: { ...sl, gekoppelt: false } }) as { zustand: string }).zustand === 'nicht-gekoppelt');

  // kopfEingang: die übrigen Zweige Stand -> Eingang (die Kopfanzeige ist dauerhaft sichtbar)
  const ke = (s: VerbundStand) => JSON.stringify(kopfEingang(s));
  ck('kopfEingang: Master ohne Stand -> startet',
    ke({ ...basis, master: null }) === JSON.stringify({ rolle: 'master', zustand: 'startet', karteFehlt: false }));
  ck('kopfEingang: lausch-fehler traegt den errCode',
    ke({ ...basis, master: { ...m, zustand: 'lausch-fehler', fehlerCode: 'EACCES' } }) === JSON.stringify({ rolle: 'master', zustand: 'lausch-fehler', errCode: 'EACCES', karteFehlt: false }));
  ck('kopfEingang: port-belegt durchgereicht',
    ke({ ...basis, master: { ...m, zustand: 'port-belegt' } }) === JSON.stringify({ rolle: 'master', zustand: 'port-belegt', karteFehlt: false }));
  ck('kopfEingang: koppelt gerade geht vor „nicht gekoppelt“',
    (kopfEingang({ ...basis, rolle: 'slave', slave: { ...sl, gekoppelt: false, koppeltGerade: true } }) as { zustand: string }).zustand === 'koppelt');
  ck('kopfEingang: beim Start beschädigte Datei (keine Kopplung, Client „datei“) -> rot „Kopplung beschädigt“',
    JSON.stringify(kopfanzeige(kopfEingang({ ...basis, rolle: 'slave', slave: { ...sl, gekoppelt: false, client: { art: 'fehler', code: 'datei' } } })))
      === JSON.stringify({ text: 'Kopplung beschädigt: neu koppeln', farbe: 'rot' }));
  ck('kopfEingang: master-link.json nicht lesbar -> rot, weder „Verbund aus“ noch „neu koppeln“ (Spec 7.3)',
    JSON.stringify(kopfanzeige(kopfEingang({ ...basis, rolle: 'aus', dateiFehler: 'EBUSY' })))
      === JSON.stringify({ text: 'Kopplungsdatei gesperrt: EBUSY', farbe: 'rot' }));
  ck('kopfEingang: verbunden',
    ke({ ...basis, rolle: 'slave', slave: { ...sl, client: { art: 'verbunden', adresse: '10.0.0.1', seit: 1 } } }) === JSON.stringify({ rolle: 'slave', zustand: 'verbunden', name: 'Regie-PC', karteFehlt: false }));
  ck('kopfEingang: fehler mit code und errCode',
    ke({ ...basis, rolle: 'slave', slave: { ...sl, client: { art: 'fehler', code: 'sonstig', errCode: 'ECONNRESET' } } }) === JSON.stringify({ rolle: 'slave', zustand: 'fehler', code: 'sonstig', name: 'Regie-PC', errCode: 'ECONNRESET', karteFehlt: false }));
  ck('kopfEingang: Karte fehlt wird durchgereicht',
    (kopfEingang({ ...basis, karteFehlt: true, master: m }) as { karteFehlt: boolean }).karteFehlt === true);

  // Tool-Zeilen am Slave (Spec 5.2)
  ck('Tool ohne Feld: „noch ohne Verbund (Update nötig)“', toolVerbundText(undefined, false)?.text === 'läuft, noch ohne Verbund (Update nötig)');
  ck('Rolle aus: keine Verbund-Zeile', toolVerbundText('verbunden', true) === null);
  ck('fehler:zeit wird kurz benannt', toolVerbundText('fehler:zeit', false)?.text === 'Master sichtbar, Port gesperrt');
  ck('Code-Anzeige XXXXX-XXXXX', zeigeCode('K7QXM3PRTH') === 'K7QXM-3PRTH');
}
```

- [ ] **Schritt 3: Test laufen lassen und Fehlschlag sehen**

Run: `npm run selftest -w @jm/launcher`
Expected: FAIL mit `Cannot find module '…/lib/kopfanzeige.ts'`

- [ ] **Schritt 4: `kopfanzeige.ts` schreiben**

`apps/launcher/src/renderer/src/lib/kopfanzeige.ts`:
```ts
import type { VerbundFehlerCode, VerbundStand } from '@shared/types';

// Kopfanzeige des Verbunds (Spec 5.4) als REINE Funktion — getestet gegen jede Tabellenzeile.
// Nur `import type`: test/selftest.ts laedt diese Datei per strip-types ohne Alias.

export type Farbe = 'gedaempft' | 'neutral' | 'gruen' | 'gelb' | 'rot';

export type KopfEingang =
  | { rolle: 'aus' }
  // Nicht in Tabelle 5.4: master-link.json beim Start nicht lesbar (Spec 7.3) — Rolle unbekannt.
  | { rolle: 'gesperrt'; errCode: string }
  | { rolle: 'master'; zustand: 'startet' | 'port-belegt' | 'daten-beschaedigt'; karteFehlt: boolean }
  | { rolle: 'master'; zustand: 'lausch-fehler'; errCode: string; karteFehlt: boolean }
  | { rolle: 'master'; zustand: 'laeuft'; n: number; m: number; karteFehlt: boolean }
  | { rolle: 'slave'; zustand: 'nicht-gekoppelt'; karteFehlt: boolean }
  | { rolle: 'slave'; zustand: 'koppelt' | 'sucht' | 'verbindet' | 'verbunden'; name: string; karteFehlt: boolean }
  | { rolle: 'slave'; zustand: 'fehler'; code: VerbundFehlerCode; name: string; errCode?: string; karteFehlt: boolean };

export interface Kopf {
  text: string;
  farbe: Farbe;
}

function fehlerKopf(code: VerbundFehlerCode, name: string, errCode?: string): string {
  switch (code) {
    case 'zeit': return `${name} sichtbar, Port gesperrt: Firewall?`;
    case 'nicht-gefunden': return `${name} nicht erreichbar`;
    case 'verweigert': return `${name}: Master-Modus aus?`;
    case 'netz': return `${name}: Netz nicht erreichbar`;
    case 'kein-master': return 'Adresse antwortet nicht als Master';
    case 'zertifikat': return 'Anderer Master unter dieser Adresse';
    case 'uhr': return 'Uhrzeit prüfen';
    case 'protokoll': return 'Versionen angleichen';
    case 'unbekannt': return 'Vom Master entfernt: neu koppeln';
    case 'signatur': return 'Anmeldung abgelehnt: neu koppeln';
    case 'ersetzt': return 'Kennung doppelt: neu koppeln';
    case 'datei': return 'Kopplung beschädigt: neu koppeln';
    case 'sonstig': return `Verbindungsfehler ${errCode ?? 'unbekannt'}`;
  }
}

function grund(e: KopfEingang): Kopf {
  if (e.rolle === 'aus') return { text: 'Verbund aus', farbe: 'gedaempft' };
  if (e.rolle === 'gesperrt') return { text: `Kopplungsdatei gesperrt: ${e.errCode}`, farbe: 'rot' };
  if (e.rolle === 'master') {
    if (e.zustand === 'laeuft') {
      if (e.m === 0) return { text: 'Master · noch keine Rechner', farbe: 'neutral' };
      return { text: `Master · ${e.n}/${e.m} Rechner online`, farbe: e.n === e.m ? 'gruen' : 'gelb' };
    }
    if (e.zustand === 'lausch-fehler') return { text: `Master-Fehler: ${e.errCode}`, farbe: 'rot' };
    if (e.zustand === 'startet') return { text: 'Master startet…', farbe: 'gedaempft' };
    if (e.zustand === 'port-belegt') return { text: 'Master: Port 8738 belegt', farbe: 'rot' };
    if (e.zustand === 'daten-beschaedigt') return { text: 'Master: Verbunddaten beschädigt', farbe: 'rot' };
    const fehlt: never = e.zustand; // Spec 5.4: Vollständigkeitsprüfung — ein neuer MasterZustand bricht tsc
    return fehlt;
  }
  // Rolle slave — der switch ist erschöpfend (tsc prüft das über den Rückgabetyp).
  switch (e.zustand) {
    case 'nicht-gekoppelt': return { text: 'Nicht gekoppelt: Master wählen', farbe: 'gedaempft' };
    case 'koppelt': return { text: `Koppeln mit ${e.name}…`, farbe: 'gelb' };
    case 'sucht': return { text: `Suche ${e.name}…`, farbe: 'gelb' };
    case 'verbindet': return { text: `Verbinde mit ${e.name}…`, farbe: 'gelb' };
    case 'verbunden': return { text: `${e.name} ●`, farbe: 'gruen' };
    case 'fehler': return { text: fehlerKopf(e.code, e.name, e.errCode), farbe: 'rot' };
  }
}

/** Spec 5.4 „Karte fehlt“: grün/neutral → gelb + Hinweis; gelb/gedämpft → Hinweis; rot → unverändert. */
export function kopfanzeige(e: KopfEingang): Kopf {
  const k = grund(e);
  if (e.rolle === 'aus' || e.rolle === 'gesperrt' || !e.karteFehlt || k.farbe === 'rot') return k;
  const farbe: Farbe = k.farbe === 'gruen' || k.farbe === 'neutral' ? 'gelb' : k.farbe;
  return { text: `${k.text} · Karte fehlt`, farbe };
}

export function kopfEingang(s: VerbundStand): KopfEingang {
  // Weder „Verbund aus“ (die Rolle ist unbekannt) noch „neu koppeln“ (das überschriebe eine intakte Kopplung).
  if (s.dateiFehler) return { rolle: 'gesperrt', errCode: s.dateiFehler };
  const karteFehlt = s.karteFehlt;
  if (s.rolle === 'aus') return { rolle: 'aus' };
  if (s.rolle === 'master') {
    const m = s.master;
    if (!m) return { rolle: 'master', zustand: 'startet', karteFehlt };
    if (m.zustand === 'laeuft') {
      const fremde = m.rechner.filter((r) => !r.dieserRechner);
      return { rolle: 'master', zustand: 'laeuft', n: fremde.filter((r) => r.online).length, m: fremde.length, karteFehlt };
    }
    if (m.zustand === 'lausch-fehler') return { rolle: 'master', zustand: 'lausch-fehler', errCode: m.fehlerCode ?? '?', karteFehlt };
    return { rolle: 'master', zustand: m.zustand, karteFehlt };
  }
  const sl = s.slave;
  const name = sl?.masterName ?? 'Master';
  if (sl?.koppeltGerade) return { rolle: 'slave', zustand: 'koppelt', name, karteFehlt };
  // master-link.json beim Start beschädigt: der Launcher hält keine Kopplung, sein Client meldet `datei` →
  // rot „Kopplung beschädigt: neu koppeln“ statt gedämpft „Nicht gekoppelt“ (Spec 5.4, 7.3).
  if (sl?.client.art === 'fehler' && sl.client.code === 'datei') {
    return { rolle: 'slave', zustand: 'fehler', code: 'datei', name, karteFehlt };
  }
  if (!sl || !sl.gekoppelt) return { rolle: 'slave', zustand: 'nicht-gekoppelt', karteFehlt };
  const c = sl.client;
  if (c.art === 'fehler' && c.code) return { rolle: 'slave', zustand: 'fehler', code: c.code, name, errCode: c.errCode, karteFehlt };
  if (c.art === 'verbunden' || c.art === 'verbindet') return { rolle: 'slave', zustand: c.art, name, karteFehlt };
  return { rolle: 'slave', zustand: 'sucht', name, karteFehlt };
}
```

- [ ] **Schritt 5: `verbund-texte.ts` schreiben**

`apps/launcher/src/renderer/src/lib/verbund-texte.ts`:
```ts
import type { VerbundFehlerCode } from '@shared/types';

// Anzeigetexte des Verbund-Modals (reine Funktionen, nur `import type` → strip-types-testbar).

const KURZ: Record<VerbundFehlerCode, string> = {
  zeit: 'Master sichtbar, Port gesperrt',
  'nicht-gefunden': 'Master nicht erreichbar',
  verweigert: 'Master-Modus aus?',
  netz: 'Netz nicht erreichbar',
  'kein-master': 'Adresse ist kein Master',
  zertifikat: 'anderer Master',
  uhr: 'Uhrzeit prüfen',
  protokoll: 'Versionen angleichen',
  unbekannt: 'vom Master entfernt',
  signatur: 'Anmeldung abgelehnt',
  ersetzt: 'Kennung doppelt',
  datei: 'Kopplung beschädigt',
  sonstig: 'Verbindungsfehler',
};

export type Ton = 'gruen' | 'gelb' | 'rot' | 'gedaempft';

/** Heartbeat-Feld `verbund` eines Tools auf diesem Rechner (Spec 5.2). Rolle „aus“ → keine Zeile. */
export function toolVerbundText(verbund: string | undefined, rolleAus: boolean): { text: string; ton: Ton } | null {
  if (rolleAus) return null;
  if (verbund === undefined) return { text: 'läuft, noch ohne Verbund (Update nötig)', ton: 'gedaempft' };
  if (verbund === 'verbunden') return { text: 'mit Master verbunden', ton: 'gruen' };
  if (verbund === 'sucht' || verbund === 'verbindet') return { text: 'sucht den Master…', ton: 'gelb' };
  if (verbund === 'aus') return { text: 'Verbund aus', ton: 'gedaempft' };
  const code = verbund.startsWith('fehler:') ? verbund.slice('fehler:'.length) : '';
  const text = (KURZ as Record<string, string | undefined>)[code] ?? `Fehler (${code || verbund})`;
  return { text, ton: 'rot' };
}

export function zeigeCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

export function relativ(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `vor ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} min`;
  return `vor ${Math.round(m / 60)} h`;
}

export function uhrzeit(ts: number): string {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
```

- [ ] **Schritt 6: Test grün sehen**

Run:
```bash
npm run selftest -w @jm/launcher
npm run typecheck -w @jm/launcher
```
Expected: `… ok, 0 fehlgeschlagen.`, Typprüfung ohne Fehler.

- [ ] **Schritt 7: Commit**

```bash
git add apps/launcher/src/shared/types.ts apps/launcher/src/renderer/src/lib/kopfanzeige.ts apps/launcher/src/renderer/src/lib/verbund-texte.ts apps/launcher/test/selftest.ts
git status --short
git commit -m "feat(launcher): Verbund-Typen und vollständige Kopfanzeige (Tabelle 5.4)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aufgabe 15: Verbund-Rollen im Launcher (Main, IPC, Preload)

**Files:**
- Modify: `apps/launcher/package.json` (devDeps `@jm/master-link`, `tsx`; Skript `selftest:verbund`), `apps/launcher/electron.vite.config.ts` (`internalPackages`)
- Modify: `apps/launcher/src/main/env.d.ts` (`notBeforeDate`)
- Create: `apps/launcher/src/main/verbund/zertifikat.ts`, `master.ts`, `slave.ts`, `wache.ts`, `index.ts`
- Modify: `apps/launcher/src/main/ipc.ts`, `apps/launcher/src/main/index.ts`, `apps/launcher/src/preload/index.ts`, `apps/launcher/src/shared/types.ts` (`JmpsApi`)
- Create: `apps/launcher/test/verbund.test.ts`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `@jm/master-link` (alles), `VerbundStand` und Co. (Aufgabe 14)
- Produces:
  - **Klassen:**
    - `MasterRolle(d)`: `starte`, `stoppe`, `stand`, `oeffneKopplung`, `neuerCode`, `schliesseKopplung`, `entferne`, `setzeName`, `rechnerNameGeaendert`, `pruefeKarten`, `erneuereIdentitaet`, `neuAufsetzen`
    - `SlaveRolle(d)`: `starte`, `stoppe`, `stand`, `starteSuche`, `stoppeSuche`, `koppele`, `brecheKoppelnAb`
  - **Hilfsfunktionen:** `koppelText`, `teileAdresse`, `erzeugeMasterIdentitaet(name)` (liefert nur eine Identität, die `pruefeIdentitaet` besteht; nach 5 unbrauchbaren Zertifikaten Wurf)
  - **Wächter ohne Electron** (`wache.ts`): `kartenLage(ni, karte)`, `beobachte(lage, beiAenderung, taktMs)`, `leseBisLesbar(lies, gesperrt, o?)`
  - **Einstieg** `verbund/index.ts`:
    - Start und Stand: `starteVerbund(emit)`, `verbundStand()`
    - Rolle und Namen: `setzeRolle`, `setzeRechnerName`, `setzeMasterName`, `setzeKarte`
    - Kopplung am Master: `oeffneKopplung`, `neuerKoppelCode`, `schliesseKopplung`, `entferneRechner`, `erneuereIdentitaet`, `setzeNeuAuf`
    - Slave: `starteMasterSuche`, `stoppeMasterSuche`, `koppeleMitMaster`, `brecheKoppelnAb`, `trenneVerbund`, `setzeFesteAdresse`
  - **IPC-Kanäle** `verbund:*` und `JmpsApi`-Methoden (siehe Schritt 7)

- [ ] **Schritt 1: Paketeinträge**

In `apps/launcher/package.json` in `devDependencies` ergänzen: `"@jm/master-link": "*",` und `"tsx": "^4.19.2",`. In `scripts` ergänzen:
```json
    "selftest:verbund": "tsx test/verbund.test.ts",
```
In `apps/launcher/electron.vite.config.ts` in `internalPackages` nach `'@jm/iveo',` ergänzen: `'@jm/master-link',`.

In `apps/launcher/src/main/env.d.ts` im `selfsigned`-Shim `interface Options` erweitern:
```ts
  interface Options { days?: number; keySize?: number; algorithm?: string; notBeforeDate?: Date; }
```
Run: `npm install`

- [ ] **Schritt 2: Den fehlschlagenden Test schreiben**

`apps/launcher/test/verbund.test.ts`:
```ts
// Verbund-Rollen des Launchers OHNE Electron (tsx): npm run selftest:verbund -w @jm/launcher
// Master und Slaves laufen in EINEM Prozess mit getrennten appData-/userData-Ordnern auf 127.0.0.1.
import { X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { connect, createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  fingerprintVonPem, masterLinkPfad, MasterLinkClient, pruefeIdentitaet, schreibeMasterLinkDatei,
  type Lesen, type MasterLinkDatei, type NetzwerkInterfaces,
} from '@jm/master-link';
import { MasterRolle } from '../src/main/verbund/master';
import { koppelText, SlaveRolle, teileAdresse } from '../src/main/verbund/slave';
import { beobachte, kartenLage, leseBisLesbar } from '../src/main/verbund/wache';
import { erzeugeMasterIdentitaet } from '../src/main/verbund/zertifikat';
import { kopfanzeige, kopfEingang } from '../src/renderer/src/lib/kopfanzeige';
import type { VerbundStand } from '../src/shared/types';

let pass = 0, fail = 0;
function ck(name: string, cond: boolean): void {
  if (cond) { pass++; console.log(`  ok  ${name}`); } else { fail++; console.log(`FAIL  ${name}`); }
}
const warte = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function bis(f: () => boolean, maxMs = 3000): Promise<boolean> {
  const ende = Date.now() + maxMs;
  while (Date.now() < ende) { if (f()) return true; await warte(20); }
  return f();
}
async function freierPort(): Promise<number> {
  const s = createServer();
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  const p = (s.address() as AddressInfo).port;
  await new Promise<void>((r) => s.close(() => r()));
  return p;
}
const verweigert = (port: number, host = '127.0.0.1') => new Promise<boolean>((r) => {
  const s = connect(port, host);
  s.on('connect', () => { s.destroy(); r(false); });
  s.on('error', () => r(true));
});

const KURZ = {
  dateiPruefMs: 50, rueckzugBasisMs: 50, rueckzugMaxMs: 200, tcpMs: 300, tlsHalloMs: 500, angemeldetMs: 500,
  stilleMs: 800, pulsMs: 200, zertifikatWiederholMs: 300, kartenPruefMs: 200, gesehenSchreibMs: 100,
};
const log = () => {};

function rechner(rolle: MasterLinkDatei['rolle'], name: string) {
  const appData = mkdtempSync(join(tmpdir(), 'jmvb-app-'));
  const speicherDir = join(mkdtempSync(join(tmpdir(), 'jmvb-user-')), 'master-link');
  const pfad = masterLinkPfad(appData);
  let datei: MasterLinkDatei = { version: 1, rolle, rechner: { id: `${name}-id`, name }, netzwerk: { karte: null }, kopplung: null };
  return {
    pfad, speicherDir,
    lies: () => datei,
    schreibe: (d: MasterLinkDatei) => { datei = d; schreibeMasterLinkDatei(pfad, d); },
  };
}

function neuerMaster(A: ReturnType<typeof rechner>, port: number) {
  return new MasterRolle({
    speicherDir: A.speicherDir, suiteVersion: '0.12.0', datei: A.lies, schreibeDatei: A.schreibe,
    beiAenderung: () => {}, log, port, fristen: KURZ, netzwerkKarten: () => ({}), mdnsFabrik: null,
    lauschAdressen: ['127.0.0.1'],
  });
}
function neuerSlave(B: ReturnType<typeof rechner>) {
  return new SlaveRolle({
    dateiPfad: B.pfad, suiteVersion: '0.12.0', datei: B.lies, schreibeDatei: B.schreibe,
    beiAenderung: () => {}, log, fristen: KURZ, netzwerkKarten: () => ({}), suche: null, listenSuche: null,
  });
}

// --- Hilfen -------------------------------------------------------------------
ck('teileAdresse: IP ohne Port -> 8738', JSON.stringify(teileAdresse('10.0.0.110')) === JSON.stringify({ host: '10.0.0.110', port: 8738 }));
ck('teileAdresse: mit Port', teileAdresse('127.0.0.1:18738')?.port === 18738);
ck('teileAdresse: leer -> null', teileAdresse('  ') === null);
ck('koppelText code-falsch nennt Restversuche', koppelText({ ok: false, art: 'abgelehnt', grund: 'code-falsch', rest: 3 }, 'Regie-PC', '10.0.0.1') === 'Code stimmt nicht, noch 3 Versuche.');
ck('koppelText Frist', koppelText({ ok: false, art: 'frist' }, 'Regie-PC', '10.0.0.1') === 'Der Master hat nicht rechtzeitig bestätigt. Nichts gespeichert.');

// --- Identität: ein Zertifikat, das OpenSSL ablehnt, wird nie geschrieben (Spec 3.5, 7.2) -----
{
  // GEMESSEN: selfsigned 2.4.1/node-forge 1.4.0 macht aus den Zufallsbytes 80 00 12 … die Seriennummer 00 00 12 …
  // (nicht minimal kodiert, ≈1/65536) → ERR_OSSL_ASN1_ILLEGAL_PADDING. Der Master startete nie, schrieb aber identitaet.json.
  const req = createRequire(import.meta.url);
  const forge = req(req.resolve('node-forge', { paths: [dirname(req.resolve('selfsigned'))] }));
  const echt = forge.random.getBytesSync;
  let wuerfe = 0;
  let unbrauchbar = 1; // so viele Seriennummern (9 Zufallsbytes) werden erzwungen
  forge.random.getBytesSync = (n: number): string =>
    (n === 9 && wuerfe++ < unbrauchbar ? '\x80\x00\x12\x34\x56\x78\x9a\xbc\xde' : echt(n));
  try {
    const neu = erzeugeMasterIdentitaet('Regie-PC');
    ck('Seriennummer 00 00 xx: neu erzeugt, die Identität besteht pruefeIdentitaet', wuerfe === 2 && pruefeIdentitaet(neu) !== null);
    wuerfe = 0;
    unbrauchbar = Infinity;
    let geworfen = false;
    try { erzeugeMasterIdentitaet('Regie-PC'); } catch { geworfen = true; }
    ck('nie brauchbar: Wurf nach 5 Versuchen statt einer unbrauchbaren Identität', geworfen && wuerfe === 5);
  } finally {
    forge.random.getBytesSync = echt;
  }
}

// --- Master: Start, Selbstkopplung, eigenes Tool ------------------------------
const port = await freierPort();
const A = rechner('master', 'Regie-PC');
const master = neuerMaster(A, port);
await master.starte();
ck('Master läuft', master.stand().zustand === 'laeuft');
const zweiter = neuerMaster(rechner('master', 'Zweit-PC'), port);
await zweiter.starte();
ck('zweiter Master auf belegtem Port → „port-belegt“', zweiter.stand().zustand === 'port-belegt' && zweiter.stand().fehlerCode === 'EADDRINUSE');
await zweiter.stoppe();
const id = pruefeIdentitaet(JSON.parse(readFileSync(join(A.speicherDir, 'identitaet.json'), 'utf8')));
ck('Identität erzeugt und gespeichert', id !== null);
const zert = new X509Certificate(id!.zertifikat);
ck('Zertifikat RSA-2048, SHA-256, ein Jahr zurückdatiert (Spec 3.5)',
  zert.publicKey.asymmetricKeyDetails?.modulusLength === 2048
  && zert.raw.includes(Buffer.from('2a864886f70d01010b', 'hex'))
  && Date.now() - Date.parse(zert.validFrom) > 360 * 24 * 3600 * 1000);
const kA = A.lies().kopplung;
ck('Selbstkopplung in master-link.json (Port, Fingerprint)', kA !== null && kA.port === port && kA.fingerprint === fingerprintVonPem(id!.zertifikat));
ck('„dieser Rechner“ im Verbund', master.stand().rechner.some((r) => r.dieserRechner && r.rechnerId === 'Regie-PC-id'));

const timerA = new MasterLinkClient({ dateiPfad: A.pfad, teilnehmer: { art: 'tool', appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 1 }, fristen: KURZ, suche: null });
timerA.starte();
await bis(() => timerA.zustand().art === 'verbunden');
ck('Tool am Master-Rechner verbindet über 127.0.0.1', timerA.zustand().art === 'verbunden');
await bis(() => master.stand().rechner.find((r) => r.dieserRechner)?.tools.some((t) => t.appId === 'jm-timer') === true);
ck('Master zeigt das eigene Tool unter „dieser Rechner“', master.stand().rechner.find((r) => r.dieserRechner)!.tools.some((t) => t.appId === 'jm-timer'));

// --- Slave B koppelt ------------------------------------------------------------
const B = rechner('slave', 'Regie-Laptop 2');
const slaveB = neuerSlave(B);
slaveB.starte();
master.oeffneKopplung();
const code = master.stand().kopplung.code!;
const falsch = await slaveB.koppele(`127.0.0.1:${port}`, code === '2222222222' ? '3333333333' : '2222222222');
ck('falscher Code: Text mit Restversuchen', !falsch.ok && falsch.text === 'Code stimmt nicht, noch 4 Versuche.');
const restVorher = master.stand().kopplung.rest;
const oZeichen = await slaveB.koppele(`127.0.0.1:${port}`, 'K7QXO3PRTH');
ck('fremdes Zeichen wird lokal gemeldet', !oZeichen.ok && oZeichen.text === 'Das Zeichen O kommt im Code nicht vor.');
ck('… ohne Verbindung, kein Fehlversuch am Master (Spec 3.2, 11.1 Nr. 1)', master.stand().kopplung.rest === restVorher);
const gutLaeuft = slaveB.koppele(`127.0.0.1:${port}`, code);
const beimKoppeln: VerbundStand = {
  rolle: 'slave', rechnerName: 'Regie-Laptop 2', karten: [], gewaehlteKarte: null, karteFehlt: false, dateiFehler: null,
  master: null, slave: slaveB.stand(),
};
ck('erstes Koppeln: Kopf „Koppeln mit ⟨Name⟩…“ nennt das Ziel (Spec 5.4)', kopfanzeige(kopfEingang(beimKoppeln)).text === 'Koppeln mit 127.0.0.1…');
const gut = await gutLaeuft;
ck('richtiger Code: gekoppelt', gut.ok);
ck('Kopplungsverbindung sofort übernommen (nicht erst über die Dateiprüfung)', ['verbindet', 'verbunden'].includes(slaveB.stand().client.art));
ck('„koppelt gerade“ danach wieder aus', !slaveB.stand().koppeltGerade);
ck('Slave-Datei hat die Kopplung', B.lies().kopplung?.fingerprint === kA!.fingerprint);
ck('von Hand eingetragene Adresse wird feste Adresse (Spec 4.5)', B.lies().kopplung?.festeAdresse === '127.0.0.1');
const vbText = readFileSync(join(A.speicherDir, 'verbund.json'), 'utf8');
ck('verbund.json: B mit öffentlichem Schlüssel, KEIN privater Schlüssel in der Datei (Spec 11.1 Nr. 4)',
  vbText.includes(B.lies().kopplung!.schluessel.oeffentlich)
  && !vbText.includes(B.lies().kopplung!.schluessel.privat) && !vbText.includes(A.lies().kopplung!.schluessel.privat));
await bis(() => slaveB.stand().client.art === 'verbunden');
ck('Slave-Launcher verbunden (übernommene Verbindung)', slaveB.stand().client.art === 'verbunden');
await bis(() => master.stand().rechner.some((r) => r.rechnerId === 'Regie-Laptop 2-id' && r.online));
ck('Master: fremder Rechner online mit Launcher', master.stand().rechner.find((r) => r.rechnerId === 'Regie-Laptop 2-id')?.tools.some((t) => t.art === 'launcher') === true);

// --- Slave C koppelt, B wird entfernt -------------------------------------------
const C = rechner('slave', 'Aufnahme-PC');
const slaveC = neuerSlave(C);
slaveC.starte();
master.oeffneKopplung();
ck('zweiter Rechner koppelt', (await slaveC.koppele(`127.0.0.1:${port}`, master.stand().kopplung.code!)).ok);
await bis(() => slaveC.stand().client.art === 'verbunden');
ck('Reihenfolge: „dieser Rechner“ zuerst, dann nach Name', master.stand().rechner.map((r) => r.name).join('|') === 'Regie-PC|Aufnahme-PC|Regie-Laptop 2');
master.entferne('Regie-Laptop 2-id');
await bis(() => slaveB.stand().client.code === 'unbekannt', 1000);
ck('B entfernt während verbunden → „unbekannt“ binnen 1 s', slaveB.stand().client.code === 'unbekannt');
ck('C bleibt verbunden', slaveC.stand().client.art === 'verbunden');
const D = rechner('slave', 'Studio-PC');
const slaveD = neuerSlave(D);
slaveD.starte();
master.oeffneKopplung();
ck('dritter Rechner koppelt', (await slaveD.koppele(`127.0.0.1:${port}`, master.stand().kopplung.code!)).ok);
await bis(() => master.stand().rechner.some((r) => r.rechnerId === 'Studio-PC-id' && r.online));
await slaveD.stoppe();
await bis(() => master.stand().rechner.find((r) => r.rechnerId === 'Studio-PC-id')?.online === false);
ck('Rechner aus → bleibt im Verbund, aber offline', master.stand().rechner.find((r) => r.rechnerId === 'Studio-PC-id')?.online === false);

// --- Identität erneuern ---------------------------------------------------------
await master.erneuereIdentitaet();
const idNeu = pruefeIdentitaet(JSON.parse(readFileSync(join(A.speicherDir, 'identitaet.json'), 'utf8')))!;
ck('neue Identität, Selbstkopplung im selben Schritt neu geschrieben', A.lies().kopplung?.fingerprint === fingerprintVonPem(idNeu.zertifikat));
ck('fremde Rechner aus dem Verbund entfernt', master.stand().rechner.every((r) => r.dieserRechner));
await bis(() => slaveC.stand().client.code === 'zertifikat', 3000);
ck('fremder Rechner meldet „zertifikat“', slaveC.stand().client.code === 'zertifikat');
await bis(() => timerA.zustand().art === 'verbunden', 3000);
ck('eigenes Tool verbindet ohne Zutun wieder', timerA.zustand().art === 'verbunden');

// --- Schnell umschalten (Review Focus 2) ----------------------------------------
const selbstVorher = A.lies().kopplung!.schluessel.oeffentlich;
await master.stoppe();
await master.starte();
await master.stoppe();
await master.starte();
ck('Aus/An zweimal schnell: läuft, Port wieder frei', master.stand().zustand === 'laeuft');
ck('Neustart behält den Selbst-Schlüssel (eigene Tools bleiben gültig)', A.lies().kopplung?.schluessel.oeffentlich === selbstVorher);
await master.stoppe();
const startLaeuft = master.starte();
await master.stoppe();
await startLaeuft;
ck('Aus während des Starts → Port bleibt zu', await verweigert(port));
// Wie setzeRolle „Master → Aus → Master“: eine NEUE MasterRolle, während die alte noch startet.
const vorige = neuerMaster(A, port);
const voriger = vorige.starte();
await vorige.stoppe(); // wartet den laufenden Start ab — danach ist der Port frei
const folgende = neuerMaster(A, port);
await folgende.starte();
ck('Aus während des Starts, sofort neue MasterRolle → läuft (kein EADDRINUSE)', folgende.stand().zustand === 'laeuft');
await voriger;
await folgende.stoppe();

// --- Gewählte Karte fällt weg (Kabel gezogen): nur ihr Lauscher schließt (Spec 2, 4.3) ---
{
  const pK = await freierPort();
  const K = rechner('master', 'Kabel-PC');
  K.schreibe({ ...K.lies(), netzwerk: { karte: 'Ethernet 2' } });
  // 127.0.0.2 steht für die Karten-IP: ohne Einrichtung bindbar (Windows, Linux); listeKarten nimmt sie (internal: false).
  const ethernet2: NetzwerkInterfaces = {
    'Ethernet 2': [{ address: '127.0.0.2', netmask: '255.0.0.0', family: 'IPv4', mac: '00:11:22:33:44:55', internal: false, cidr: '127.0.0.2/8' }],
  };
  let karten: NetzwerkInterfaces = ethernet2;
  const mK = new MasterRolle({
    speicherDir: K.speicherDir, suiteVersion: '0.12.0', datei: K.lies, schreibeDatei: K.schreibe,
    beiAenderung: () => {}, log, port: pK, fristen: KURZ, netzwerkKarten: () => karten, mdnsFabrik: null,
  });
  await mK.starte();
  const tK = new MasterLinkClient({ dateiPfad: K.pfad, teilnehmer: { art: 'tool', appId: 'jm-timer', name: 'JM Timer', version: '0.12.0', pid: 3 }, fristen: KURZ, suche: null });
  tK.starte();
  await bis(() => tK.zustand().art === 'verbunden');
  const seit = (tK.zustand() as { seit?: number }).seit;
  ck('Karte gewählt: lauscht auf ihrer IP und auf 127.0.0.1', !(await verweigert(pK, '127.0.0.2')) && tK.zustand().art === 'verbunden');
  karten = {}; // wie os.networkInterfaces() nach dem Kabelziehen (Windows meldet nur Karten mit Status „Up“)
  await mK.pruefeKarten();
  await warte(300);
  ck('Karte weg: eigenes Tool bleibt über 127.0.0.1 verbunden (dieselbe Sitzung)',
    tK.zustand().art === 'verbunden' && (tK.zustand() as { seit?: number }).seit === seit);
  ck('… nur der Lauscher der Karte ist zu', await verweigert(pK, '127.0.0.2'));
  karten = ethernet2;
  await mK.pruefeKarten();
  await warte(300);
  ck('Karte wieder da: ihr Lauscher ist offen, das Tool blieb in derselben Sitzung',
    !(await verweigert(pK, '127.0.0.2')) && (tK.zustand() as { seit?: number }).seit === seit);
  await tK.stoppe();
  await mK.stoppe();
}

// --- Wächter ohne Electron (verbund/wache.ts) -------------------------------------
{
  // Spec 4.1: Karten alle 10 s — ändert sich „Karte fehlt“, meldet der Launcher in JEDER Rolle.
  let ni: NetzwerkInterfaces = {
    'Ethernet 2': [{ address: '10.0.0.110', netmask: '255.255.255.0', family: 'IPv4', mac: '00:11:22:33:44:55', internal: false, cidr: '10.0.0.110/24' }],
  };
  let meldungen = 0;
  const stopp = beobachte(() => JSON.stringify(kartenLage(ni, 'Ethernet 2')), () => { meldungen++; }, 20);
  await warte(80);
  ck('Karten unverändert → keine Meldung', meldungen === 0 && !kartenLage(ni, 'Ethernet 2').karteFehlt);
  ni = {};
  await bis(() => meldungen > 0, 500);
  await warte(80);
  ck('gewählte Karte weg → genau eine Meldung, „Karte fehlt“', meldungen === 1 && kartenLage(ni, 'Ethernet 2').karteFehlt);
  stopp();

  // Spec 7.3/10: master-link.json beim Start nicht lesbar → gesperrt melden, erneut lesen, bis es gelingt.
  const io: Lesen<MasterLinkDatei> = { art: 'io', code: 'EBUSY' };
  const folge: Lesen<MasterLinkDatei>[] = [io, io, io, { art: 'ok', wert: B.lies() }];
  const gesperrt: string[] = [];
  const r = await leseBisLesbar(() => folge.shift() ?? io, (c) => gesperrt.push(c), { versuche: 2, pauseMs: 5, taktMs: 20 });
  ck('io beim Start: jeder Fehlversuch gesperrt gemeldet, gelesen, sobald es gelingt', r.art === 'ok' && gesperrt.join() === 'EBUSY,EBUSY,EBUSY');
}

// --- Beschädigte Daten ----------------------------------------------------------
await master.stoppe();
const vb = join(A.speicherDir, 'verbund.json');
writeFileSync(vb, 'Müll');
const ausBak = neuerMaster(A, port);
await ausBak.starte();
ck('nur verbund.json kaputt → läuft aus .bak', ausBak.stand().zustand === 'laeuft' && ausBak.stand().ausBak);
await ausBak.stoppe();
writeFileSync(vb, 'Müll');
writeFileSync(`${vb}.bak`, 'Müll');
const kaputt = neuerMaster(A, port);
await kaputt.starte();
ck('verbund.json + .bak kaputt → „daten-beschaedigt“', kaputt.stand().zustand === 'daten-beschaedigt');
ck('… und der Master lauscht NICHT (kein „unbekannt“ an Slaves)', await verweigert(port));
ck('… und überschreibt nichts', readFileSync(vb, 'utf8') === 'Müll');
const fpAlt = A.lies().kopplung!.fingerprint;
await kaputt.neuAufsetzen();
ck('„Verbund neu aufsetzen“ → läuft wieder', kaputt.stand().zustand === 'laeuft');
ck('… mit neuer Identität', A.lies().kopplung?.fingerprint !== fpAlt);
await kaputt.stoppe();
const idp = join(A.speicherDir, 'identitaet.json');
writeFileSync(idp, 'Müll');
writeFileSync(`${idp}.bak`, 'Müll');
const ohneId = neuerMaster(A, port);
await ohneId.starte();
ck('identitaet.json + .bak kaputt → „daten-beschaedigt“, keine still neue Identität', ohneId.stand().zustand === 'daten-beschaedigt' && readFileSync(idp, 'utf8') === 'Müll');
await ohneId.neuAufsetzen();

await timerA.stoppe();
await slaveB.stoppe();
await slaveC.stoppe();
await ohneId.stoppe();
console.log(`\n${pass} ok, ${fail} fehlgeschlagen.`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Schritt 3: Test laufen lassen und Fehlschlag sehen**

Run: `npm run selftest:verbund -w @jm/launcher`
Expected: FAIL mit `Cannot find module '../src/main/verbund/master'`

- [ ] **Schritt 4: `zertifikat.ts` und `master.ts` schreiben**

`apps/launcher/src/main/verbund/zertifikat.ts`:
```ts
import { randomUUID } from 'node:crypto';
import selfsigned from 'selfsigned';
import { kuerzeName, pruefeIdentitaet, type Identitaet } from '@jm/master-link';

/**
 * Master-Identität (Spec 3.5): RSA-2048/SHA-256 (selfsigned nähme sonst RSA-1024/SHA-1),
 * 10 Jahre, um 1 Jahr zurückdatiert — eine nachgehende Slave-Uhr meldete sonst CERT_NOT_YET_VALID.
 * GEMESSEN: selfsigned 2.4.1/node-forge 1.4.0 kodiert eine Seriennummer 00 00 xx (≈1/65536) nicht minimal;
 * OpenSSL lehnt so ein Zertifikat ab (ERR_OSSL_ASN1_ILLEGAL_PADDING), der Master startete nie. Deshalb verlässt
 * nur eine Identität diese Funktion, die pruefeIdentitaet besteht — nur sie wird je geschrieben.
 */
export function erzeugeMasterIdentitaet(name: string): Identitaet {
  for (let versuch = 1; versuch <= 5; versuch++) {
    const p = selfsigned.generate([{ name: 'commonName', value: 'jm-master-link' }], {
      days: 3650,
      keySize: 2048,
      algorithm: 'sha256',
      notBeforeDate: new Date(Date.now() - 365 * 24 * 3600 * 1000),
    });
    const id = pruefeIdentitaet({ masterId: randomUUID(), name: kuerzeName(name), zertifikat: p.cert, schluessel: p.private });
    if (id) return id;
  }
  throw new Error('Master-Identität: kein brauchbares Zertifikat erzeugt');
}
```

`apps/launcher/src/main/verbund/master.ts`:
```ts
import { hostname, networkInterfaces } from 'node:os';
import { join } from 'node:path';
import {
  DateiVerbund, erzeugeSchluesselpaar, fingerprintVonPem, kuerzeName, kurzFingerprint, leseMitBak, listeKarten,
  loescheMitBak, MasterAnnonce, MasterLinkServer, pruefeIdentitaet, pruefeVerbund, schreibeMitBak, standardFabrik,
  wirksameKarten,
  type BonjourFabrik, type Fristen, type Identitaet, type Karte, type Kopplung, type MasterLinkDatei,
  type NetzwerkInterfaces, type Schluesselpaar,
} from '@jm/master-link';
import type { MasterZustand, VerbundMasterStand, VerbundRechner } from '@shared/types';
import { erzeugeMasterIdentitaet } from './zertifikat';

// Master-Rolle des Launchers (Spec 2, 3.5, 4.2, 4.3, 7.2, 7.3). Kein Electron hier — der
// Aufrufer reicht Pfade und die gemeinsame master-link.json (lesen/schreiben) herein.

export interface MasterAbhaengigkeiten {
  /** <userData>/master-link */
  speicherDir: string;
  suiteVersion: string;
  datei: () => MasterLinkDatei;
  schreibeDatei: (d: MasterLinkDatei) => void;
  beiAenderung: () => void;
  log: (stufe: 'info' | 'warn', text: string) => void;
  /** Vorgabe 8738. */
  port?: number;
  fristen?: Partial<Fristen>;
  netzwerkKarten?: () => NetzwerkInterfaces;
  /** null = keine mDNS-Annonce (Tests). */
  mdnsFabrik?: BonjourFabrik | null;
  /** Nur Tests: feste Lauschadressen statt Netzwerkwahl. */
  lauschAdressen?: string[];
}

const LEER_FENSTER = { offen: false, code: null, gueltigBis: null, rest: 0, ungueltig: false };

export class MasterRolle {
  private readonly d: MasterAbhaengigkeiten;
  private server: MasterLinkServer | null = null;
  private annonce: MasterAnnonce | null = null;
  private verbund: DateiVerbund | null = null;
  private identitaet: Identitaet | null = null;
  private zustand: MasterZustand = 'startet';
  private fehlerCode: string | null = null;
  private ausBak = false;
  private kartenZeitgeber: ReturnType<typeof setInterval> | null = null;
  private wiederholung: ReturnType<typeof setTimeout> | null = null;
  private lauschSchluessel = '';
  private kartenSchluessel = '';
  private gestoppt = false;
  private laufenderStart: Promise<void> | null = null;

  constructor(d: MasterAbhaengigkeiten) {
    this.d = d;
  }

  private get idPfad(): string {
    return join(this.d.speicherDir, 'identitaet.json');
  }

  private get vbPfad(): string {
    return join(this.d.speicherDir, 'verbund.json');
  }

  private karten(): { wirksam: Karte[]; karteFehlt: boolean } {
    const alle = listeKarten((this.d.netzwerkKarten ?? networkInterfaces)());
    const w = wirksameKarten(alle, this.d.datei().netzwerk.karte);
    return { wirksam: w.karten, karteFehlt: w.karteFehlt };
  }

  /**
   * Spec 4.3: Automatisch → 0.0.0.0; gewählte Karte → alle ihre IPv4 + 127.0.0.1 (eigene Tools).
   * Fehlt die gewählte Karte (Kabel gezogen), gilt Automatisch (4.1) als EINZELNE Lauscher aller Karten
   * + 127.0.0.1: ein Wechsel auf 0.0.0.0 schlösse den Loopback-Lauscher samt den Sitzungen der eigenen
   * Tools (Spec 2, 4.3: „Der Loopback-Lauscher bleibt“).
   */
  private lauschAdressen(): string[] {
    if (this.d.lauschAdressen) return this.d.lauschAdressen;
    if (this.d.datei().netzwerk.karte === null) return ['0.0.0.0'];
    const { wirksam } = this.karten();
    return [...wirksam.flatMap((k) => k.adressen.map((a) => a.adresse)), '127.0.0.1'];
  }

  private intervall(): number {
    return this.d.fristen?.kartenPruefMs ?? 10_000;
  }

  private setzeZustand(z: MasterZustand, code: string | null): void {
    this.zustand = z;
    this.fehlerCode = code;
    this.d.beiAenderung();
  }

  async starte(): Promise<void> {
    const lauf = this.starteJetzt();
    this.laufenderStart = lauf;
    try {
      await lauf;
    } finally {
      if (this.laufenderStart === lauf) this.laufenderStart = null;
    }
  }

  private async starteJetzt(): Promise<void> {
    this.gestoppt = false;
    this.setzeZustand('startet', null);
    const id = leseMitBak(this.idPfad, pruefeIdentitaet);
    const vb = leseMitBak(this.vbPfad, pruefeVerbund);
    if (id.art === 'io' || vb.art === 'io') {
      this.setzeZustand('lausch-fehler', id.art === 'io' ? id.code : vb.art === 'io' ? vb.code : 'EIO');
      this.planeWiederholung();
      return;
    }
    if (id.art === 'beschaedigt' || vb.art === 'beschaedigt') {
      // NIE still neu erzeugen und NIE „unbekannt“ an Slaves: gar nicht erst lauschen.
      this.setzeZustand('daten-beschaedigt', null);
      this.d.log('warn', 'Master: identitaet.json/verbund.json beschädigt (auch .bak) — Master-Link startet nicht, nichts wird überschrieben.');
      return;
    }
    let identitaet: Identitaet;
    if (id.art === 'ok') {
      identitaet = id.wert;
    } else {
      identitaet = erzeugeMasterIdentitaet(hostname());
      schreibeMitBak(this.idPfad, `${JSON.stringify(identitaet, null, 2)}\n`, pruefeIdentitaet);
      this.d.log('info', `Master-Identität erzeugt (${kurzFingerprint(fingerprintVonPem(identitaet.zertifikat))}).`);
    }
    this.identitaet = identitaet;
    this.ausBak = (id.art === 'ok' && id.ausBak) || (vb.art === 'ok' && vb.ausBak);
    if (this.ausBak) this.d.log('warn', 'Master: Verbunddaten aus .bak wiederhergestellt.');
    const verbund = new DateiVerbund(this.vbPfad, vb.art === 'ok' ? vb.wert : { version: 1, rechner: [] }, {
      schreibIntervallMs: this.d.fristen?.gesehenSchreibMs,
      onFehler: (e) => this.d.log('warn', `verbund.json nicht geschrieben: ${e.message}`),
    });
    this.verbund = verbund;
    // Eintrag „dieser Rechner“ VOR dem Lauschen, damit die eigenen Tools sofort angenommen werden.
    const paar = this.selbstSchluessel(identitaet, verbund);
    const lausch = this.lauschAdressen();
    this.lauschSchluessel = JSON.stringify(lausch);
    const server = new MasterLinkServer({
      identitaet,
      verbund,
      eigeneRechnerId: this.d.datei().rechner.id,
      suiteVersion: this.d.suiteVersion,
      lauschAdressen: lausch,
      port: this.d.port,
      fristen: this.d.fristen,
      netzwerkKarten: this.d.netzwerkKarten,
      log: this.d.log,
    });
    server.on('aenderung', () => this.d.beiAenderung());
    try {
      await server.starte();
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? 'UNBEKANNT';
      this.d.log('warn', `Master-Link lauscht nicht: ${code}`);
      verbund.schliesse();
      this.verbund = null;
      this.setzeZustand(code === 'EADDRINUSE' ? 'port-belegt' : 'lausch-fehler', code);
      this.planeWiederholung();
      return;
    }
    if (this.gestoppt) {
      await server.stoppe();
      return;
    }
    this.server = server;
    this.schreibeSelbstkopplung(identitaet, paar, server.port());
    this.setzeZustand('laeuft', null);
    this.starteAnnonce();
    this.kartenZeitgeber = setInterval(() => void this.pruefeKarten(), this.intervall());
    this.kartenZeitgeber.unref?.();
  }

  private selbstSchluessel(identitaet: Identitaet, verbund: DateiVerbund): Schluesselpaar {
    const d = this.d.datei();
    const fp = fingerprintVonPem(identitaet.zertifikat);
    const eigen = verbund.liste().find((e) => e.dieserRechner);
    const k = d.kopplung;
    const passt = d.rolle === 'master' && k !== null && k.fingerprint === fp && eigen !== undefined
      && eigen.rechnerId === d.rechner.id && eigen.schluessel === k.schluessel.oeffentlich;
    if (passt && k) return k.schluessel;
    const paar = erzeugeSchluesselpaar();
    verbund.setzeDiesenRechner({
      rechnerId: d.rechner.id,
      name: d.rechner.name,
      schluessel: paar.oeffentlich,
      gekoppeltAm: Date.now(),
      zuletztGesehen: null,
      letzteAdresse: null,
      dieserRechner: true,
    });
    return paar;
  }

  private schreibeSelbstkopplung(identitaet: Identitaet, paar: Schluesselpaar, port: number): void {
    const d = this.d.datei();
    const kopplung: Kopplung = {
      masterId: identitaet.masterId,
      masterName: identitaet.name,
      fingerprint: fingerprintVonPem(identitaet.zertifikat),
      zertifikat: identitaet.zertifikat,
      port,
      adressen: [],
      letzteAdresse: null,
      festeAdresse: null,
      schluessel: paar,
    };
    if (d.rolle !== 'master' || JSON.stringify(d.kopplung) !== JSON.stringify(kopplung)) {
      this.d.schreibeDatei({ ...d, rolle: 'master', kopplung });
    }
  }

  private starteAnnonce(): void {
    if (this.d.mdnsFabrik === null || !this.server || !this.identitaet) return;
    const fabrik = this.d.mdnsFabrik ?? standardFabrik((t) => this.d.log('warn', t));
    this.annonce = new MasterAnnonce(fabrik, {
      masterId: this.identitaet.masterId,
      name: this.identitaet.name,
      fp: this.server.fingerprint,
      port: this.server.port(),
    });
    const { wirksam } = this.karten();
    this.kartenSchluessel = JSON.stringify(wirksam);
    this.annonce.starte(wirksam);
  }

  private planeWiederholung(): void {
    if (this.wiederholung) clearTimeout(this.wiederholung);
    this.wiederholung = setTimeout(() => {
      this.wiederholung = null;
      if (!this.gestoppt && !this.server) void this.starte();
    }, this.intervall());
    this.wiederholung.unref?.();
  }

  /** Alle 10 s und nach einer Kartenwahl: Lauscher und Annonce an die Karten anpassen (Spec 4.1). */
  async pruefeKarten(): Promise<void> {
    if (!this.server) return;
    let geaendert = false;
    const lausch = this.lauschAdressen();
    const s = JSON.stringify(lausch);
    if (s !== this.lauschSchluessel) {
      this.lauschSchluessel = s;
      geaendert = true;
      try {
        await this.server.setzeLauschAdressen(lausch);
      } catch (e) {
        this.d.log('warn', `Master-Link: Neubinden fehlgeschlagen (${(e as NodeJS.ErrnoException).code ?? (e as Error).message}).`);
      }
    }
    const { wirksam } = this.karten();
    const k = JSON.stringify(wirksam);
    if (k !== this.kartenSchluessel) {
      this.kartenSchluessel = k;
      geaendert = true;
      await this.annonce?.aktualisiere(wirksam);
    }
    if (geaendert) this.d.beiAenderung();
  }

  async stoppe(): Promise<void> {
    this.gestoppt = true;
    // Review Focus 2: ein laufender Start hält den Port, bis sein server.starte() zurückkehrt (danach
    // schließt er selbst). Abwarten — sonst meldet die nächste MasterRolle EADDRINUSE („Port belegt“).
    await this.laufenderStart?.catch(() => {});
    if (this.kartenZeitgeber) {
      clearInterval(this.kartenZeitgeber);
      this.kartenZeitgeber = null;
    }
    if (this.wiederholung) {
      clearTimeout(this.wiederholung);
      this.wiederholung = null;
    }
    await this.annonce?.stoppe();
    this.annonce = null;
    await this.server?.stoppe();
    this.server = null;
    this.verbund?.schliesse();
    this.verbund = null;
  }

  oeffneKopplung(): void {
    this.server?.oeffneKopplung();
  }

  neuerCode(): void {
    this.server?.neuerCode();
  }

  schliesseKopplung(): void {
    this.server?.schliesseKopplung();
  }

  entferne(rechnerId: string): void {
    this.server?.entferne(rechnerId);
  }

  async setzeName(name: string): Promise<void> {
    if (!this.identitaet) return;
    const neu: Identitaet = { ...this.identitaet, name: kuerzeName(name) };
    schreibeMitBak(this.idPfad, `${JSON.stringify(neu, null, 2)}\n`, pruefeIdentitaet);
    this.identitaet = neu;
    this.server?.setzeName(neu.name);
    const d = this.d.datei();
    if (d.kopplung) this.d.schreibeDatei({ ...d, kopplung: { ...d.kopplung, masterName: neu.name } });
    await this.annonce?.aktualisiere(this.karten().wirksam, neu.name);
    this.d.beiAenderung();
  }

  rechnerNameGeaendert(name: string): void {
    const eigen = this.verbund?.liste().find((e) => e.dieserRechner);
    if (eigen) this.verbund?.setzeDiesenRechner({ ...eigen, name });
  }

  /** Spec 3.5: stoppen (alle Sockets zu) → neue Identität → nur fremde Rechner raus → Start (Selbstkopplung neu). */
  async erneuereIdentitaet(): Promise<void> {
    const name = this.identitaet?.name ?? hostname();
    await this.stoppe();
    const neu = erzeugeMasterIdentitaet(name);
    schreibeMitBak(this.idPfad, `${JSON.stringify(neu, null, 2)}\n`, pruefeIdentitaet);
    const vb = leseMitBak(this.vbPfad, pruefeVerbund);
    const nurSelbst = vb.art === 'ok' ? vb.wert.rechner.filter((e) => e.dieserRechner) : [];
    schreibeMitBak(this.vbPfad, `${JSON.stringify({ version: 1, rechner: nurSelbst }, null, 2)}\n`, pruefeVerbund);
    this.d.log('info', 'Master-Identität erneuert — alle anderen Rechner müssen neu gekoppelt werden.');
    await this.starte();
  }

  /** Nur bei „Verbunddaten beschädigt“ angeboten: alles verwerfen, neu beginnen. */
  async neuAufsetzen(): Promise<void> {
    await this.stoppe();
    loescheMitBak(this.idPfad);
    loescheMitBak(this.vbPfad);
    await this.starte();
  }

  stand(): VerbundMasterStand {
    const server = this.server;
    const teilnehmer = server?.teilnehmer() ?? [];
    const rechner: VerbundRechner[] = (this.verbund?.liste() ?? [])
      .map((e) => ({
        rechnerId: e.rechnerId,
        name: e.name,
        dieserRechner: e.dieserRechner,
        online: server?.rechnerOnline(e.rechnerId) ?? false,
        zuletztGesehen: e.zuletztGesehen,
        adresse: e.letzteAdresse,
        tools: teilnehmer
          .filter((t) => t.rechnerId === e.rechnerId)
          .map((t) => ({ appId: t.appId, name: t.name, version: t.version, art: t.art, verbundenSeit: t.seit })),
      }))
      .sort((a, b) => Number(b.dieserRechner) - Number(a.dieserRechner) || a.name.localeCompare(b.name));
    return {
      zustand: this.zustand,
      fehlerCode: this.fehlerCode,
      name: this.identitaet?.name ?? '',
      fpKurz: this.identitaet ? kurzFingerprint(fingerprintVonPem(this.identitaet.zertifikat)) : '',
      ausBak: this.ausBak,
      rechner,
      kopplung: server?.kopplungsStand() ?? LEER_FENSTER,
    };
  }
}
```

- [ ] **Schritt 5: `slave.ts` und `wache.ts` schreiben**

`apps/launcher/src/main/verbund/slave.ts`:
```ts
import { networkInterfaces } from 'node:os';
import {
  fehlerText, koppele, listeKarten, MASTER_PORT, MasterLinkClient, MdnsSuche, normalisiereCode, ordneKandidaten,
  standardFabrik, wirksameKarten,
  type ClientZustand, type Fristen, type KoppelErgebnis, type MasterLinkDatei, type MasterSichtung,
  type NetzwerkInterfaces, type SucheLike,
} from '@jm/master-link';
import type { GefundenerMaster, KoppelAntwort, VerbundClientStand, VerbundSlaveStand } from '@shared/types';

// Slave-Rolle des Launchers (Spec 3.1, 5.3): eigener Client als Teilnehmer „launcher“,
// Koppeln per Code, Liste gefundener Master. Schreibt die gemeinsame master-link.json.

export interface SlaveAbhaengigkeiten {
  dateiPfad: string;
  suiteVersion: string;
  datei: () => MasterLinkDatei;
  schreibeDatei: (d: MasterLinkDatei) => void;
  beiAenderung: () => void;
  log: (stufe: 'info' | 'warn', text: string) => void;
  fristen?: Partial<Fristen>;
  netzwerkKarten?: () => NetzwerkInterfaces;
  /** Suche des Clients (Vorgabe echtes mDNS; null = keine). */
  suche?: SucheLike | null;
  /** Suche für die Liste „gefundene Master“ (Vorgabe echtes mDNS; null = keine). */
  listenSuche?: SucheLike | null;
}

export function teileAdresse(eingabe: string): { host: string; port: number } | null {
  const t = eingabe.trim();
  if (!t) return null;
  const m = /^([^:\s]+)(?::(\d{1,5}))?$/.exec(t);
  if (!m) return null;
  const port = m[2] ? Number(m[2]) : MASTER_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host: m[1], port };
}

/** Texte beim Koppeln (Spec 9.2). */
export function koppelText(r: Exclude<KoppelErgebnis, { ok: true }>, masterName: string, adresse: string): string {
  switch (r.art) {
    case 'abgelehnt':
      switch (r.grund) {
        case 'code-falsch': return `Code stimmt nicht, noch ${r.rest ?? 0} Versuche.`;
        case 'code-ungueltig': return 'Code abgelaufen oder verbraucht. Am Master einen neuen Code holen.';
        case 'keine-kopplung-offen': return 'Am Master zuerst „Rechner koppeln“ öffnen.';
        case 'rechner-id': return 'Dieser Rechner hat dieselbe Kennung wie der Master (Ordner kopiert?). Kopplungsdatei zurücksetzen.';
        case 'protokoll': return fehlerText('protokoll', { masterName });
        default: return `Der Master hat abgelehnt (${r.grund}).`;
      }
    case 'master-beweis':
      return 'Der Master konnte den Code nicht bestätigen, möglicherweise ein fremdes Gerät. Nichts gespeichert.';
    case 'frist':
      return 'Der Master hat nicht rechtzeitig bestätigt. Nichts gespeichert.';
    case 'verbindung':
      return fehlerText(r.code, { masterName, adresse, errCode: r.errCode });
    case 'abgebrochen':
      return 'Koppeln abgebrochen. Nichts gespeichert.';
  }
}

function clientStand(z: ClientZustand): VerbundClientStand {
  switch (z.art) {
    case 'verbunden': return { art: 'verbunden', adresse: z.adresse, seit: z.seit };
    case 'verbindet': return { art: 'verbindet', adresse: z.adresse };
    case 'fehler': return { art: 'fehler', code: z.code, text: z.text, errCode: z.errCode };
    default: return { art: z.art };
  }
}

export class SlaveRolle {
  private readonly d: SlaveAbhaengigkeiten;
  private readonly client: MasterLinkClient;
  private readonly listenSuche: SucheLike | null;
  private gefunden: GefundenerMaster[] = [];
  private vorige: MasterSichtung[] = [];
  private suchZeitgeber: ReturnType<typeof setInterval> | null = null;
  private sucheLaeuft = false;
  private koppelAbbruch: AbortController | null = null;
  private koppeltGerade = false;
  private koppelZiel: string | null = null;

  constructor(d: SlaveAbhaengigkeiten) {
    this.d = d;
    this.client = new MasterLinkClient({
      dateiPfad: d.dateiPfad,
      teilnehmer: { art: 'launcher', appId: 'jm-launcher', name: 'JM Production Suite', version: d.suiteVersion, pid: process.pid },
      fristen: d.fristen,
      netzwerkKarten: d.netzwerkKarten,
      suche: d.suche,
      log: d.log,
    });
    this.client.on('zustand', () => d.beiAenderung());
    this.client.on('angemeldet', (a: { adresse: string; adressen: string[] }) => this.merkeAdressen(a));
    this.listenSuche = d.listenSuche === undefined ? new MdnsSuche(standardFabrik((t) => d.log('warn', t))) : d.listenSuche;
  }

  starte(): void {
    this.client.starte();
  }

  async stoppe(): Promise<void> {
    this.stoppeSuche();
    this.koppelAbbruch?.abort();
    await this.client.stoppe();
    this.listenSuche?.stoppe();
  }

  /** Liste „gefundene Master“ — nur solange das Modal offen ist. */
  starteSuche(): void {
    if (this.suchZeitgeber || !this.listenSuche) return;
    const runde = async (): Promise<void> => {
      if (this.sucheLaeuft || !this.listenSuche) return;
      this.sucheLaeuft = true;
      try {
        const alle = listeKarten((this.d.netzwerkKarten ?? networkInterfaces)());
        const gewaehlt = this.d.datei().netzwerk.karte;
        this.listenSuche.setzeKarten(wirksameKarten(alle, gewaehlt).karten);
        const jetzt = await this.listenSuche.runde(1500);
        // Sichtbar bleibt, wer in einer der letzten zwei Runden geantwortet hat.
        const zusammen = new Map<string, MasterSichtung>();
        for (const s of [...this.vorige, ...jetzt]) zusammen.set(s.masterId, s);
        this.vorige = jetzt;
        const neu = [...zusammen.values()].map((s) => ({
          masterId: s.masterId,
          name: s.name,
          fpKurz: s.fpKurz,
          adressen: ordneKandidaten(s.adressen, alle, gewaehlt),
        }));
        if (JSON.stringify(neu) !== JSON.stringify(this.gefunden)) {
          this.gefunden = neu;
          this.d.beiAenderung();
        }
      } finally {
        this.sucheLaeuft = false;
      }
    };
    void runde();
    this.suchZeitgeber = setInterval(() => void runde(), 5000);
  }

  stoppeSuche(): void {
    if (this.suchZeitgeber) clearInterval(this.suchZeitgeber);
    this.suchZeitgeber = null;
  }

  /** Spec 3.1: Verbindung erst, wenn der Code lokal gültig ist; Ergebnis nur bei Erfolg speichern. */
  async koppele(adresseEingabe: string, codeEingabe: string): Promise<KoppelAntwort> {
    const c = normalisiereCode(codeEingabe);
    if (!c.ok) {
      return {
        ok: false,
        text: c.grund === 'zeichen'
          ? `Das Zeichen ${c.zeichen} kommt im Code nicht vor.`
          : `Der Code hat 10 Zeichen, eingegeben: ${c.laenge}.`,
      };
    }
    const ziel = teileAdresse(adresseEingabe);
    if (!ziel) return { ok: false, text: 'Bitte einen gefundenen Master wählen oder eine Adresse eintragen.' };
    this.koppelAbbruch?.abort();
    const ctrl = new AbortController();
    this.koppelAbbruch = ctrl;
    const gesehen = this.gefunden.find((g) => g.adressen.includes(ziel.host));
    // Kopf „Koppeln mit ⟨Name⟩…“ (Spec 5.4) schon beim ERSTEN Koppeln: Name aus mDNS, sonst die Adresse.
    this.koppelZiel = gesehen?.name ?? ziel.host;
    this.koppeltGerade = true;
    this.d.beiAenderung();
    try {
      const d = this.d.datei();
      const r = await koppele({
        adresse: ziel.host,
        port: ziel.port,
        code: c.code,
        rechner: d.rechner,
        fristen: this.d.fristen,
        signal: ctrl.signal,
        mdnsGesehen: gesehen !== undefined,
        // Spec 4.5: eine von Hand eingetragene Adresse (nicht aus mDNS) wird beim Koppeln die feste Adresse.
        festeAdresse: gesehen ? (d.kopplung?.festeAdresse ?? null) : ziel.host,
      });
      if (!r.ok) return { ok: false, text: koppelText(r, gesehen?.name ?? ziel.host, ziel.host) };
      this.d.schreibeDatei({ ...this.d.datei(), rolle: 'slave', kopplung: r.kopplung });
      this.client.uebernehme(r.verbindung, r.kopplung, r.masterName);
      this.d.log('info', `Mit Master „${r.masterName}“ gekoppelt.`);
      return { ok: true };
    } finally {
      if (this.koppelAbbruch === ctrl) this.koppelAbbruch = null;
      this.koppeltGerade = false;
      this.d.beiAenderung();
    }
  }

  brecheKoppelnAb(): void {
    this.koppelAbbruch?.abort();
  }

  /** Nur bei Änderung schreiben — reine Adressnachträge trennen die Tools nicht (Spec 7.1). */
  private merkeAdressen(a: { adresse: string; adressen: string[] }): void {
    const d = this.d.datei();
    const k = d.kopplung;
    if (!k) return;
    if (k.letzteAdresse === a.adresse && JSON.stringify(k.adressen) === JSON.stringify(a.adressen)) return;
    this.d.schreibeDatei({ ...d, kopplung: { ...k, letzteAdresse: a.adresse, adressen: a.adressen } });
  }

  stand(): VerbundSlaveStand {
    const d = this.d.datei();
    return {
      gekoppelt: d.kopplung !== null,
      koppeltGerade: this.koppeltGerade,
      masterName: this.koppeltGerade ? this.koppelZiel : (d.kopplung?.masterName ?? null),
      festeAdresse: d.kopplung?.festeAdresse ?? null,
      client: clientStand(this.client.zustand()),
      gefundeneMaster: this.gefunden,
    };
  }
}
```

`apps/launcher/src/main/verbund/wache.ts`:
```ts
import {
  listeKarten, wirksameKarten,
  type Lesen, type MasterLinkDatei, type NetzwerkInterfaces,
} from '@jm/master-link';
import type { VerbundKarte } from '@shared/types';

// Wächter des Verbunds OHNE Electron (per tsx getestet): Netzwerkkarten und Lesbarkeit der master-link.json.

/** Karten für Modal und Kopf (Spec 4.1): alle nicht-internen IPv4-Karten und ob die gewählte fehlt. */
export function kartenLage(ni: NetzwerkInterfaces, gewaehlt: string | null): { karten: VerbundKarte[]; karteFehlt: boolean } {
  const karten = listeKarten(ni);
  return {
    karten: karten.map((k) => ({
      name: k.name,
      adressen: k.adressen.map((a) => `${a.adresse}/${a.praefix}`),
      virtuell: k.virtuell,
      nurLinkLocal: k.nurLinkLocal,
    })),
    karteFehlt: wirksameKarten(karten, gewaehlt).karteFehlt,
  };
}

/** Spec 4.1 „alle 10 s“: `lage()` im Takt neu bilden; ändert sie sich, `beiAenderung()` — unabhängig von der Rolle. */
export function beobachte(lage: () => string, beiAenderung: () => void, taktMs: number): () => void {
  let vorher = lage();
  const zeitgeber = setInterval(() => {
    const jetzt = lage();
    if (jetzt === vorher) return;
    vorher = jetzt;
    beiAenderung();
  }, taktMs);
  zeitgeber.unref?.();
  return () => clearInterval(zeitgeber);
}

/**
 * Spec 7.3 beim Start des Launchers: ein I/O-Fehler (EBUSY/EPERM, z. B. Virenscanner) ist VORÜBERGEHEND.
 * Erneut lesen — erst `versuche`-mal alle `pauseMs`, danach alle `taktMs` —, bis ein Lesen gelingt.
 * `gesperrt(code)` meldet jeden Fehlversuch: solange darf der Launcher nichts schreiben (Spec 10).
 */
export async function leseBisLesbar(
  lies: () => Lesen<MasterLinkDatei>,
  gesperrt: (code: string) => void,
  o: { versuche?: number; pauseMs?: number; taktMs?: number } = {},
): Promise<Exclude<Lesen<MasterLinkDatei>, { art: 'io' }>> {
  for (let i = 0; ; i++) {
    const r = lies();
    if (r.art !== 'io') return r;
    gesperrt(r.code);
    const ms = i < (o.versuche ?? 10) ? (o.pauseMs ?? 500) : (o.taktMs ?? 5000);
    await new Promise<void>((weiter) => setTimeout(weiter, ms));
  }
}
```

- [ ] **Schritt 6: Test grün sehen**

Run: `npm run selftest:verbund -w @jm/launcher`
Expected: `… ok, 0 fehlgeschlagen.`

- [ ] **Schritt 7: Electron-Anbindung (`verbund/index.ts`), IPC, Preload, API-Typ**

`apps/launcher/src/main/verbund/index.ts`:
```ts
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { hostname, networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { getLog } from '@jm/app-runtime';
import {
  kuerzeName, leseMasterLinkDatei, masterLinkPfad, schreibeMasterLinkDatei,
  type Lesen, type MasterLinkDatei,
} from '@jm/master-link';
import type { AppEvent, KoppelAntwort, VerbundRolle, VerbundStand } from '@shared/types';
import { MasterRolle } from './master';
import { SlaveRolle } from './slave';
import { beobachte, kartenLage, leseBisLesbar } from './wache';

// Verbund des Launchers (Master-Link Teil 1): hält master-link.json im Speicher, führt die
// Rolle und liefert den Stand an den Renderer. Alles Netz läuft hier im Main (CSP bleibt unberührt).

function neueDatei(): MasterLinkDatei {
  return {
    version: 1,
    rolle: 'aus',
    rechner: { id: randomUUID(), name: kuerzeName(hostname()) },
    netzwerk: { karte: null },
    kopplung: null,
  };
}

let datei: MasterLinkDatei = neueDatei();
/** I/O-Code, solange master-link.json beim Start nicht lesbar ist (Spec 7.3) — dann wird NICHTS geschrieben. */
let dateiFehler: string | null = null;
let master: MasterRolle | null = null;
let slave: SlaveRolle | null = null;
let melde: () => void = () => {};
let meldeZeitgeber: ReturnType<typeof setTimeout> | null = null;
let kette: Promise<unknown> = Promise.resolve();

function pfad(): string {
  return masterLinkPfad(app.getPath('appData'));
}

function log(stufe: 'info' | 'warn', text: string): void {
  getLog()[stufe](text);
}

/** Nur der Launcher schreibt die gemeinsame Datei (Spec 7.1). */
function schreibe(d: MasterLinkDatei): void {
  if (dateiFehler) {
    // Spec 7.3/10: im Speicher steht nur eine Ersatzdatei (neue rechner.id) — nie über die echte Kopplung schreiben.
    log('warn', `master-link.json nicht lesbar (${dateiFehler}) — nicht überschrieben.`);
    return;
  }
  datei = d;
  try {
    schreibeMasterLinkDatei(pfad(), d);
  } catch (e) {
    log('warn', `master-link.json nicht geschrieben: ${(e as Error).message}`);
  }
}

/** Zustandsändernde Aufrufe nacheinander (Review Focus 2): „Master → Aus → Master“ überholt sich sonst. */
function nacheinander<T>(schritt: () => Promise<T>): Promise<T> {
  const lauf = kette.then(schritt);
  kette = lauf.catch(() => {});
  return lauf;
}

/** Ereignisse bündeln (Puls, Teilnehmer, Client-Zustand können in Schüben kommen). */
function aenderung(): void {
  if (meldeZeitgeber) return;
  meldeZeitgeber = setTimeout(() => {
    meldeZeitgeber = null;
    melde();
  }, 100);
}

function neuerMaster(): MasterRolle {
  return new MasterRolle({
    speicherDir: join(app.getPath('userData'), 'master-link'),
    suiteVersion: app.getVersion(),
    datei: () => datei,
    schreibeDatei: schreibe,
    beiAenderung: aenderung,
    log,
  });
}

function neuerSlave(): SlaveRolle {
  return new SlaveRolle({
    dateiPfad: pfad(),
    suiteVersion: app.getVersion(),
    datei: () => datei,
    schreibeDatei: schreibe,
    beiAenderung: aenderung,
    log,
  });
}

async function starteRolle(r: Exclude<Lesen<MasterLinkDatei>, { art: 'io' }>): Promise<void> {
  if (r.art === 'ok') {
    datei = r.wert;
  } else if (r.art === 'defekt') {
    // Nicht überschreiben: der Client meldet „Kopplung beschädigt: neu koppeln“, erst Koppeln schreibt neu.
    log('warn', 'master-link.json beschädigt — bitte neu koppeln.');
    datei = { ...neueDatei(), rolle: 'slave' };
  }
  if (datei.rolle === 'master') {
    master = neuerMaster();
    await master.starte();
  } else if (datei.rolle === 'slave') {
    slave = neuerSlave();
    slave.starte();
  }
}

export async function starteVerbund(emit: (e: AppEvent) => void): Promise<void> {
  melde = () => emit({ type: 'verbund-changed' });
  app.on('before-quit', () => {
    void master?.stoppe();
    void slave?.stoppe();
  });
  // Spec 4.1: Karten alle 10 s neu lesen — in JEDER Rolle, damit „· Karte fehlt“ den Kopf sofort erreicht.
  beobachte(() => JSON.stringify(kartenLage(networkInterfaces(), datei.netzwerk.karte)), aenderung, 10_000);
  // Spec 7.3: I/O-Fehler (EBUSY/EPERM, Virenscanner) sind vorübergehend → erneut lesen, bis es gelingt.
  // Bis dahin startet keine Rolle und nichts wird geschrieben (Spec 10: nie still entkoppeln).
  const r = await leseBisLesbar(() => leseMasterLinkDatei(pfad()), (code) => {
    if (dateiFehler === null) log('warn', `master-link.json nicht lesbar (${code}) — Verbund wartet, nichts wird überschrieben.`);
    if (dateiFehler !== code) {
      dateiFehler = code;
      aenderung();
    }
  });
  await nacheinander(async () => {
    const warGesperrt = dateiFehler !== null;
    dateiFehler = null;
    await starteRolle(r);
    if (warGesperrt) aenderung();
  });
}

export function verbundStand(): VerbundStand {
  const { karten, karteFehlt } = kartenLage(networkInterfaces(), datei.netzwerk.karte);
  return {
    rolle: datei.rolle,
    rechnerName: datei.rechner.name,
    karten,
    gewaehlteKarte: datei.netzwerk.karte,
    karteFehlt,
    dateiFehler,
    master: master?.stand() ?? null,
    slave: slave?.stand() ?? null,
  };
}

/** Spec 5.3: Aus ← Slave löscht die Kopplung; Aus ← Master setzt die Selbstkopplung außer Kraft. */
export function setzeRolle(rolle: VerbundRolle): Promise<VerbundStand> {
  return nacheinander(async () => {
    // Datei nicht lesbar: keine Rolle auf der Ersatzdatei starten (Spec 7.3).
    if (dateiFehler || rolle === datei.rolle) return verbundStand();
    const m = master;
    const s = slave;
    master = null;
    slave = null;
    await m?.stoppe();
    await s?.stoppe();
    schreibe({ ...datei, rolle, kopplung: null });
    if (rolle === 'slave') {
      slave = neuerSlave();
      slave.starte();
    } else if (rolle === 'master') {
      master = neuerMaster();
      await master.starte();
    }
    aenderung();
    return verbundStand();
  });
}

export function setzeRechnerName(name: string): VerbundStand {
  schreibe({ ...datei, rechner: { ...datei.rechner, name: kuerzeName(name) } });
  master?.rechnerNameGeaendert(datei.rechner.name);
  aenderung();
  return verbundStand();
}

export function setzeMasterName(name: string): Promise<VerbundStand> {
  return nacheinander(async () => {
    await master?.setzeName(name);
    return verbundStand();
  });
}

export function setzeKarte(karte: string | null): Promise<VerbundStand> {
  return nacheinander(async () => {
    schreibe({ ...datei, netzwerk: { karte } });
    await master?.pruefeKarten();
    aenderung();
    return verbundStand();
  });
}

export function oeffneKopplung(): VerbundStand {
  master?.oeffneKopplung();
  return verbundStand();
}

export function neuerKoppelCode(): VerbundStand {
  master?.neuerCode();
  return verbundStand();
}

export function schliesseKopplung(): VerbundStand {
  master?.schliesseKopplung();
  return verbundStand();
}

export function entferneRechner(rechnerId: string): VerbundStand {
  master?.entferne(rechnerId);
  return verbundStand();
}

export function erneuereIdentitaet(): Promise<VerbundStand> {
  return nacheinander(async () => {
    await master?.erneuereIdentitaet();
    return verbundStand();
  });
}

export function setzeNeuAuf(): Promise<VerbundStand> {
  return nacheinander(async () => {
    await master?.neuAufsetzen();
    return verbundStand();
  });
}

export function starteMasterSuche(): void {
  slave?.starteSuche();
}

export function stoppeMasterSuche(): void {
  slave?.stoppeSuche();
}

export async function koppeleMitMaster(adresse: string, code: string): Promise<KoppelAntwort> {
  if (!slave) return { ok: false, text: 'Zuerst die Rolle „Mit Master verbinden“ wählen.' };
  return slave.koppele(adresse, code);
}

export function brecheKoppelnAb(): void {
  slave?.brecheKoppelnAb();
}

/** Spec 5.3 „Trennen“: Kopplung löschen, Rolle bleibt; alle Tools trennen sich über die Datei. */
export function trenneVerbund(): VerbundStand {
  if (datei.rolle === 'slave') schreibe({ ...datei, kopplung: null });
  aenderung();
  return verbundStand();
}

export function setzeFesteAdresse(adresse: string | null): VerbundStand {
  if (datei.kopplung) {
    const a = adresse?.trim() ? adresse.trim() : null;
    schreibe({ ...datei, kopplung: { ...datei.kopplung, festeAdresse: a } });
  }
  aenderung();
  return verbundStand();
}
```

In `apps/launcher/src/main/ipc.ts` die Importe ergänzen:
```ts
import type { VerbundRolle } from '@shared/types';
import {
  brecheKoppelnAb, entferneRechner, erneuereIdentitaet, koppeleMitMaster, neuerKoppelCode, oeffneKopplung,
  schliesseKopplung, setzeFesteAdresse, setzeKarte, setzeMasterName, setzeNeuAuf, setzeRechnerName, setzeRolle,
  starteMasterSuche, stoppeMasterSuche, trenneVerbund, verbundStand,
} from './verbund';
```
und in `registerIpc()` nach dem Block `control:*` einfügen:
```ts
  // Verbund (Master-Link Teil 1): Rolle, Kopplung, Netzwerkwahl — alles im Main.
  ipcMain.handle('verbund:get', () => verbundStand());
  ipcMain.handle('verbund:rolle', (_e, rolle: VerbundRolle) => setzeRolle(rolle));
  ipcMain.handle('verbund:rechnerName', (_e, name: string) => setzeRechnerName(name));
  ipcMain.handle('verbund:masterName', (_e, name: string) => setzeMasterName(name));
  ipcMain.handle('verbund:karte', (_e, karte: string | null) => setzeKarte(karte));
  ipcMain.handle('verbund:kopplungOeffnen', () => oeffneKopplung());
  ipcMain.handle('verbund:neuerCode', () => neuerKoppelCode());
  ipcMain.handle('verbund:kopplungSchliessen', () => schliesseKopplung());
  ipcMain.handle('verbund:entfernen', (_e, rechnerId: string) => entferneRechner(rechnerId));
  ipcMain.handle('verbund:identitaetErneuern', () => erneuereIdentitaet());
  ipcMain.handle('verbund:neuAufsetzen', () => setzeNeuAuf());
  ipcMain.handle('verbund:sucheStarten', () => starteMasterSuche());
  ipcMain.handle('verbund:sucheStoppen', () => stoppeMasterSuche());
  ipcMain.handle('verbund:koppeln', (_e, adresse: string, code: string) => koppeleMitMaster(adresse, code));
  ipcMain.handle('verbund:koppelnAbbrechen', () => brecheKoppelnAb());
  ipcMain.handle('verbund:trennen', () => trenneVerbund());
  ipcMain.handle('verbund:festeAdresse', (_e, adresse: string | null) => setzeFesteAdresse(adresse));
```

In `apps/launcher/src/main/index.ts`:
- Import `import { starteVerbund } from './verbund';`
- Im `whenReady`-Block direkt nach `setManualEndpoints(getManualEndpoints());`:
```ts
    // Master-Link Teil 1: Rolle aus master-link.json (Master/Slave/aus) starten.
    void starteVerbund((e) => emitAppEvent(e)).catch((err) => runtime.log.warn(`Verbund nicht gestartet: ${(err as Error).message}`));
```

In `apps/launcher/src/shared/types.ts` in `interface JmpsApi` vor `onProgress` einfügen:
```ts
  /** Verbund (Master-Link Teil 1). */
  getVerbund: () => Promise<VerbundStand>;
  setzeVerbundRolle: (rolle: VerbundRolle) => Promise<VerbundStand>;
  setzeRechnerName: (name: string) => Promise<VerbundStand>;
  setzeMasterName: (name: string) => Promise<VerbundStand>;
  setzeVerbundKarte: (karte: string | null) => Promise<VerbundStand>;
  oeffneKopplung: () => Promise<VerbundStand>;
  neuerKoppelCode: () => Promise<VerbundStand>;
  schliesseKopplung: () => Promise<VerbundStand>;
  entferneRechner: (rechnerId: string) => Promise<VerbundStand>;
  erneuereMasterIdentitaet: () => Promise<VerbundStand>;
  setzeVerbundNeuAuf: () => Promise<VerbundStand>;
  starteMasterSuche: () => Promise<void>;
  stoppeMasterSuche: () => Promise<void>;
  koppeleMitMaster: (adresse: string, code: string) => Promise<KoppelAntwort>;
  brecheKoppelnAb: () => Promise<void>;
  trenneVerbund: () => Promise<VerbundStand>;
  setzeFesteMasterAdresse: (adresse: string | null) => Promise<VerbundStand>;
```

In `apps/launcher/src/preload/index.ts` die Typ-Importe um `KoppelAntwort, VerbundRolle, VerbundStand` ergänzen und im `api`-Objekt vor `onProgress` einfügen:
```ts
  getVerbund: () => invoke<VerbundStand>('verbund:get'),
  setzeVerbundRolle: (rolle: VerbundRolle) => invoke<VerbundStand>('verbund:rolle', rolle),
  setzeRechnerName: (name: string) => invoke<VerbundStand>('verbund:rechnerName', name),
  setzeMasterName: (name: string) => invoke<VerbundStand>('verbund:masterName', name),
  setzeVerbundKarte: (karte: string | null) => invoke<VerbundStand>('verbund:karte', karte),
  oeffneKopplung: () => invoke<VerbundStand>('verbund:kopplungOeffnen'),
  neuerKoppelCode: () => invoke<VerbundStand>('verbund:neuerCode'),
  schliesseKopplung: () => invoke<VerbundStand>('verbund:kopplungSchliessen'),
  entferneRechner: (rechnerId: string) => invoke<VerbundStand>('verbund:entfernen', rechnerId),
  erneuereMasterIdentitaet: () => invoke<VerbundStand>('verbund:identitaetErneuern'),
  setzeVerbundNeuAuf: () => invoke<VerbundStand>('verbund:neuAufsetzen'),
  starteMasterSuche: () => invoke<void>('verbund:sucheStarten'),
  stoppeMasterSuche: () => invoke<void>('verbund:sucheStoppen'),
  koppeleMitMaster: (adresse: string, code: string) => invoke<KoppelAntwort>('verbund:koppeln', adresse, code),
  brecheKoppelnAb: () => invoke<void>('verbund:koppelnAbbrechen'),
  trenneVerbund: () => invoke<VerbundStand>('verbund:trennen'),
  setzeFesteMasterAdresse: (adresse: string | null) => invoke<VerbundStand>('verbund:festeAdresse', adresse),
```

- [ ] **Schritt 8: Alles prüfen**

Run:
```bash
npm run selftest:verbund -w @jm/launcher
npm run selftest -w @jm/launcher
npm run typecheck -w @jm/launcher
npm run build -w @jm/launcher
```
Expected: beide Selbsttests `… 0 fehlgeschlagen.`, Typprüfung ohne Fehler, Build erfolgreich.

- [ ] **Schritt 9: Commit**

```bash
git add apps/launcher/package.json apps/launcher/electron.vite.config.ts apps/launcher/src/main/env.d.ts apps/launcher/src/main/verbund/zertifikat.ts apps/launcher/src/main/verbund/master.ts apps/launcher/src/main/verbund/slave.ts apps/launcher/src/main/verbund/wache.ts apps/launcher/src/main/verbund/index.ts apps/launcher/src/main/ipc.ts apps/launcher/src/main/index.ts apps/launcher/src/preload/index.ts apps/launcher/src/shared/types.ts apps/launcher/test/verbund.test.ts package-lock.json
git status --short
git commit -m "feat(launcher): Verbund-Rollen Master/Slave mit Selbstkopplung, Koppeln, IPC" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
## Aufgabe 16: Oberfläche (Kopfanzeige, Modal „Verbund“, Einstellungen) und End-zu-End-Lauf

**Files:**
- Create:
  - `apps/launcher/src/renderer/src/store/verbund.ts`
  - `apps/launcher/src/renderer/src/components/VerbundTeile.tsx`
  - `apps/launcher/src/renderer/src/components/VerbundBadge.tsx`
  - `apps/launcher/src/renderer/src/components/VerbundModal.tsx`
  - `apps/launcher/src/renderer/src/components/VerbundMaster.tsx`
  - `apps/launcher/src/renderer/src/components/VerbundSlave.tsx`
- Modify:
  - `apps/launcher/src/renderer/src/store/tools.ts` (Ereignis `verbund-changed`, erstes Laden)
  - `apps/launcher/src/renderer/src/components/Header.tsx`, `SettingsModal.tsx`
  - `apps/launcher/src/renderer/src/App.tsx`
- Wegwerf-Prüfstand (nicht ins Repo): `<Scratchpad>/drive-verbund.mjs`, `<Scratchpad>/pruef-gegenstelle.mts`

**Interfaces:**
- Consumes:
  - `window.jmps.*` Verbund-Methoden (Aufgabe 15)
  - `kopfanzeige`, `kopfEingang`, `toolVerbundText`, `zeigeCode`, `relativ`, `uhrzeit` (Aufgabe 14)
  - `PresenceRecord.verbund` (Aufgabe 13)
- Produces:
  - `useVerbund`: `offen`, `stand`, `beschaeftigt`, `meldung`, `oeffne`, `schliesse`, `lade`, `fuehreAus`, `koppele`
  - `<VerbundBadge/>`, `<VerbundModal/>`

Oberflächen-Code ist hier nicht unit-getestet. Die Logik steckt in den getesteten reinen Funktionen (Aufgabe 14). Geprüft wird die Oberfläche per ferngesteuertem Launcher und Screenshots (Schritt 7).

- [ ] **Schritt 1: Store**

`apps/launcher/src/renderer/src/store/verbund.ts`:
```ts
import { create } from 'zustand';
import type { KoppelAntwort, VerbundStand } from '@shared/types';

// Zustand des Modals „Verbund“ (Master-Link Teil 1). Alles Netz läuft im Main; hier nur IPC.
interface VerbundStore {
  offen: boolean;
  stand: VerbundStand | null;
  beschaeftigt: boolean;
  meldung: string | null;
  oeffne: () => void;
  schliesse: () => void;
  lade: () => Promise<void>;
  fuehreAus: (aktion: () => Promise<VerbundStand | void>) => Promise<void>;
  koppele: (adresse: string, code: string) => Promise<KoppelAntwort>;
}

export const useVerbund = create<VerbundStore>((set) => ({
  offen: false,
  stand: null,
  beschaeftigt: false,
  meldung: null,
  oeffne: () => {
    set({ offen: true, meldung: null });
    void useVerbund.getState().lade();
    void window.jmps.starteMasterSuche();
  },
  schliesse: () => {
    // Spec 3.2/3.3: Dialog zu → Kopplungsfenster am Master zu, laufendes Koppeln am Slave abbrechen.
    if (useVerbund.getState().stand?.master?.kopplung.offen) void window.jmps.schliesseKopplung();
    void window.jmps.brecheKoppelnAb();
    void window.jmps.stoppeMasterSuche();
    set({ offen: false, meldung: null });
  },
  lade: async () => {
    try {
      set({ stand: await window.jmps.getVerbund() });
    } catch {
      // Main nicht erreichbar → bestehenden Stand behalten
    }
  },
  fuehreAus: async (aktion) => {
    set({ beschaeftigt: true });
    try {
      const s = await aktion();
      if (s) set({ stand: s });
    } finally {
      set({ beschaeftigt: false });
    }
  },
  koppele: async (adresse, code) => {
    set({ beschaeftigt: true, meldung: null });
    try {
      const r = await window.jmps.koppeleMitMaster(adresse, code);
      if (!r.ok) set({ meldung: r.text });
      await useVerbund.getState().lade();
      return r;
    } finally {
      set({ beschaeftigt: false });
    }
  },
}));
```

In `apps/launcher/src/renderer/src/store/tools.ts`:
- Import ergänzen: `import { useVerbund } from './verbund';`
- In der `onAppEvent`-Kette nach dem Zweig `health-changed` ergänzen:
```ts
          } else if (e.type === 'verbund-changed') {
            // Master-Link: Rolle/Kopplung/Teilnehmer/Client-Zustand geändert → Kopfanzeige + Modal.
            await useVerbund.getState().lade();
```
- In `load()` neben `void useTools.getState().loadHealth();` (am Ende) ergänzen: `void useVerbund.getState().lade();`

- [ ] **Schritt 2: Bausteine**

`apps/launcher/src/renderer/src/components/VerbundTeile.tsx`:
```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { Button, cn } from '@jm/ui';
import type { Farbe } from '@/lib/kopfanzeige';
import type { Ton } from '@/lib/verbund-texte';

export const FARBE_KLASSE: Record<Farbe, string> = {
  gedaempft: 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]',
  neutral: 'border-[var(--primary)]/40 bg-[var(--highlight)] text-[var(--foreground)]',
  gruen: 'border-[var(--success)]/40 bg-[var(--success)]/12 text-[var(--success)]',
  gelb: 'border-[var(--warning)]/50 bg-[var(--warning)]/15 text-[var(--warning)]',
  rot: 'border-[var(--destructive)]/40 bg-[var(--destructive)]/15 text-[var(--destructive)]',
};

export const TON_KLASSE: Record<Ton, string> = {
  gruen: 'text-[var(--success)]',
  gelb: 'text-[var(--warning)]',
  rot: 'text-[var(--destructive)]',
  gedaempft: 'text-[var(--muted-foreground)]',
};

export const eingabeKlasse = cn(
  'h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-xs text-[var(--foreground)]',
  'placeholder:text-[var(--muted-foreground)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
);

export const beschriftung = 'text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]';

export function Pille({ farbe, children }: { farbe: Farbe; children: ReactNode }) {
  return (
    <span className={cn('inline-flex max-w-full shrink-0 items-center truncate rounded-[var(--radius-full)] border px-2.5 py-0.5 text-[11px] font-bold', FARBE_KLASSE[farbe])}>
      {children}
    </span>
  );
}

export function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="mt-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
      <p className={beschriftung}>{titel}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Eingabe, die erst beim Verlassen oder mit Enter speichert. */
export function TextFeld({ label, wert, platzhalter, onSpeichern }: {
  label: string;
  wert: string;
  platzhalter?: string;
  onSpeichern: (v: string) => void;
}) {
  const [text, setText] = useState(wert);
  useEffect(() => setText(wert), [wert]);
  const speichern = (): void => {
    if (text.trim() !== wert) onSpeichern(text.trim());
  };
  return (
    <label className="flex flex-col gap-1.5">
      <span className={beschriftung}>{label}</span>
      <input
        className={eingabeKlasse}
        value={text}
        placeholder={platzhalter}
        maxLength={60}
        onChange={(e) => setText(e.target.value)}
        onBlur={speichern}
        onKeyDown={(e) => e.key === 'Enter' && speichern()}
      />
    </label>
  );
}

/** Bestätigung direkt an der Aktion (kein confirm()-Dialog). */
export function Bestaetigung({ frage, jaText, onJa, onNein }: {
  frage: string;
  jaText: string;
  onJa: () => void;
  onNein: () => void;
}) {
  return (
    <div role="alertdialog" className="mt-3 rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 p-3">
      <p className="text-xs">{frage}</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="destructive" uppercase={false} onClick={onJa}>{jaText}</Button>
        <Button size="sm" variant="ghost" uppercase={false} onClick={onNein}>Abbrechen</Button>
      </div>
    </div>
  );
}
```

`apps/launcher/src/renderer/src/components/VerbundBadge.tsx`:
```tsx
import { cn } from '@jm/ui';
import { kopfanzeige, kopfEingang } from '@/lib/kopfanzeige';
import { useVerbund } from '@/store/verbund';
import { FARBE_KLASSE } from './VerbundTeile';

/** Immer sichtbare Kopfanzeige des Verbunds (Spec 5.4). Klick öffnet das Modal. */
export function VerbundBadge() {
  const stand = useVerbund((s) => s.stand);
  const oeffne = useVerbund((s) => s.oeffne);
  if (!stand) return null;
  const k = kopfanzeige(kopfEingang(stand));
  return (
    <button
      type="button"
      onClick={oeffne}
      aria-label="Verbund"
      title={`Verbund · ${k.text}`}
      className={cn(
        'h-8 max-w-[12rem] truncate rounded-[var(--radius-full)] border px-3 text-[11px] font-bold transition-colors hover:brightness-110',
        FARBE_KLASSE[k.farbe],
      )}
    >
      {k.text}
    </button>
  );
}
```

- [ ] **Schritt 3: Modal-Gerüst mit Rolle und Netzwerkwahl**

`apps/launcher/src/renderer/src/components/VerbundModal.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Button, Card, noDragRegion } from '@jm/ui';
import type { VerbundKarte, VerbundRolle, VerbundStand } from '@shared/types';
import { kopfanzeige, kopfEingang } from '@/lib/kopfanzeige';
import { useVerbund } from '@/store/verbund';
import { VerbundMaster } from './VerbundMaster';
import { VerbundSlave } from './VerbundSlave';
import { Abschnitt, Bestaetigung, beschriftung, eingabeKlasse, Pille, TextFeld } from './VerbundTeile';

const ROLLEN: Array<{ rolle: VerbundRolle; text: string; erklaerung: string }> = [
  { rolle: 'aus', text: 'Aus', erklaerung: 'Einzelplatz: kein Netzverkehr des Verbunds, alles wie bisher.' },
  { rolle: 'master', text: 'Master', erklaerung: 'Dieser Launcher ist Master. Andere Rechner koppeln sich einmal per Code.' },
  { rolle: 'slave', text: 'Mit Master verbinden', erklaerung: 'Dieser Rechner koppelt sich mit einem Master. Alle Tools hier verbinden sich dann selbst.' },
];

function kartenText(k: VerbundKarte): string {
  return `${k.name} · ${k.adressen.join(', ')}${k.virtuell ? ' · virtuell' : ''}${k.nurLinkLocal ? ' · Link-Local (kein DHCP)' : ''}`;
}

export function VerbundModal() {
  const offen = useVerbund((s) => s.offen);
  const stand = useVerbund((s) => s.stand);
  const schliesse = useVerbund((s) => s.schliesse);

  // Sekündlich neu rendern: Countdown des Codes, „zuletzt gesehen“.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!offen) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [offen]);

  useEffect(() => {
    if (!offen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') schliesse();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [offen, schliesse]);

  if (!offen) return null;
  const kopf = stand ? kopfanzeige(kopfEingang(stand)) : null;

  // Aufbau wie System-Zustand (#233): Overlay hebt die Zieh-Fläche des Headers auf;
  // Flex-Layout auf EIGENEM Container (Card packt Kinder in ein <div class="relative">).
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-6"
      style={noDragRegion}
      onClick={(e) => {
        if (e.target === e.currentTarget) schliesse();
      }}
    >
      <Card className="w-full max-w-xl p-6 jm-fade-in">
        <div className="flex max-h-[calc(100vh-6rem)] flex-col">
          <div className="flex shrink-0 items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Verbund</h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Mehrere Rechner: ein Launcher ist Master, die anderen koppeln sich einmal.
              </p>
            </div>
            {kopf && <Pille farbe={kopf.farbe}>{kopf.text}</Pille>}
          </div>
          <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
            {!stand ? (
              <p className="mt-5 text-sm text-[var(--muted-foreground)]">Lade…</p>
            ) : stand.dateiFehler ? (
              <p className="mt-5 text-xs text-[var(--destructive)]">
                Die Kopplungsdatei (master-link.json) ist gerade nicht lesbar ({stand.dateiFehler}), z. B. weil ein
                Virenscanner sie prüft. Der Launcher liest sie laufend neu und startet den Verbund, sobald das gelingt.
                Bis dahin ändert er nichts an ihr.
              </p>
            ) : (
              <>
                <RolleWahl stand={stand} />
                <DieserRechner stand={stand} />
                {stand.rolle === 'master' && stand.master && <VerbundMaster stand={stand} />}
                {stand.rolle === 'slave' && stand.slave && <VerbundSlave stand={stand} />}
              </>
            )}
          </div>
          <div className="mt-6 flex shrink-0 items-center justify-end gap-3">
            <Button variant="primary" onClick={schliesse}>Schließen</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function RolleWahl({ stand }: { stand: VerbundStand }) {
  const fuehreAus = useVerbund((s) => s.fuehreAus);
  const beschaeftigt = useVerbund((s) => s.beschaeftigt);
  const [frage, setFrage] = useState<VerbundRolle | null>(null);
  const wechsle = (r: VerbundRolle): void => {
    void fuehreAus(async () => {
      const s = await window.jmps.setzeVerbundRolle(r);
      // Die Liste „gefundene Master“ sucht nur, solange das Modal offen ist — gestartet in oeffne().
      // Nach dem Wechsel auf „slave“ gibt es eine NEUE SlaveRolle ohne laufende Suche: hier nachstarten.
      if (r === 'slave') void window.jmps.starteMasterSuche();
      return s;
    });
  };
  const waehle = (r: VerbundRolle): void => {
    if (r === stand.rolle) return;
    // Spec 5.3: Slave verlassen löscht die Kopplung — vorher fragen.
    if (stand.rolle === 'slave' && stand.slave?.gekoppelt) {
      setFrage(r);
      return;
    }
    wechsle(r);
  };
  return (
    <Abschnitt titel="Rolle dieses Rechners">
      <div className="flex flex-wrap gap-2">
        {ROLLEN.map((x) => (
          <Button
            key={x.rolle}
            size="sm"
            uppercase={false}
            variant={stand.rolle === x.rolle ? 'primary' : 'outline'}
            disabled={beschaeftigt}
            onClick={() => waehle(x.rolle)}
          >
            {x.text}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">{ROLLEN.find((x) => x.rolle === stand.rolle)?.erklaerung}</p>
      {frage && (
        <Bestaetigung
          frage="Die Kopplung dieses Rechners wird gelöscht. Danach muss neu gekoppelt werden."
          jaText="Rolle wechseln"
          onJa={() => {
            const r = frage;
            setFrage(null);
            wechsle(r);
          }}
          onNein={() => setFrage(null)}
        />
      )}
    </Abschnitt>
  );
}

function DieserRechner({ stand }: { stand: VerbundStand }) {
  const fuehreAus = useVerbund((s) => s.fuehreAus);
  if (stand.rolle === 'aus') return null;
  return (
    <Abschnitt titel="Dieser Rechner">
      <TextFeld
        label="Name dieses Rechners"
        wert={stand.rechnerName}
        onSpeichern={(v) => void fuehreAus(() => window.jmps.setzeRechnerName(v))}
      />
      <label className="mt-3 flex flex-col gap-1.5">
        <span className={beschriftung}>Netzwerk der Suite</span>
        <select
          className={eingabeKlasse}
          value={stand.gewaehlteKarte ?? ''}
          onChange={(e) => void fuehreAus(() => window.jmps.setzeVerbundKarte(e.target.value || null))}
        >
          <option value="">Automatisch (alle Netzwerkkarten)</option>
          {stand.gewaehlteKarte && stand.karteFehlt && (
            <option value={stand.gewaehlteKarte}>{stand.gewaehlteKarte} (nicht vorhanden)</option>
          )}
          {stand.karten.map((k) => (
            <option key={k.name} value={k.name}>{kartenText(k)}</option>
          ))}
        </select>
      </label>
      {stand.karteFehlt && (
        <p className="mt-2 text-[11px] text-[var(--warning)]">
          Gewählte Karte „{stand.gewaehlteKarte}“ nicht vorhanden, nutze Automatisch.
        </p>
      )}
    </Abschnitt>
  );
}
```

- [ ] **Schritt 4: Master-Ansicht**

`apps/launcher/src/renderer/src/components/VerbundMaster.tsx`:
```tsx
import { useState } from 'react';
import { Button, cn } from '@jm/ui';
import type { VerbundStand } from '@shared/types';
import { relativ, uhrzeit, zeigeCode } from '@/lib/verbund-texte';
import { useVerbund } from '@/store/verbund';
import { Abschnitt, Bestaetigung, TextFeld } from './VerbundTeile';

export function VerbundMaster({ stand }: { stand: VerbundStand }) {
  const m = stand.master!;
  const fuehreAus = useVerbund((s) => s.fuehreAus);
  const beschaeftigt = useVerbund((s) => s.beschaeftigt);
  const [entfernen, setEntfernen] = useState<{ id: string; name: string } | null>(null);
  const [erneuern, setErneuern] = useState(false);
  const [neu, setNeu] = useState(false);
  const jetzt = Date.now();

  return (
    <>
      <Abschnitt titel="Master">
        <TextFeld label="Name des Masters" wert={m.name} onSpeichern={(v) => void fuehreAus(() => window.jmps.setzeMasterName(v))} />
        <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">Fingerprint {m.fpKurz || '—'} · Port 8738</p>
        {m.zustand === 'port-belegt' && (
          <p className="mt-2 text-xs text-[var(--destructive)]">Port 8738 ist belegt (anderes Programm?). Der Master versucht es alle 10 s erneut.</p>
        )}
        {m.zustand === 'lausch-fehler' && (
          <p className="mt-2 text-xs text-[var(--destructive)]">Master-Link lauscht nicht ({m.fehlerCode}). Neuer Versuch alle 10 s.</p>
        )}
        {m.ausBak && (
          <p className="mt-2 text-xs text-[var(--warning)]">Verbunddaten wurden aus der Sicherung (.bak) wiederhergestellt.</p>
        )}
        {m.zustand === 'daten-beschaedigt' && (
          <div className="mt-3 rounded-[var(--radius)] border border-[var(--destructive)]/40 p-3">
            <p className="text-xs text-[var(--destructive)]">
              Die Verbunddaten dieses Masters sind beschädigt (auch die Sicherung). Der Master lauscht nicht und überschreibt nichts.
            </p>
            <Button size="sm" variant="destructive" uppercase={false} className="mt-2" onClick={() => setNeu(true)}>
              Verbund neu aufsetzen
            </Button>
            {neu && (
              <Bestaetigung
                frage="Alle gekoppelten Rechner gehen verloren und müssen neu gekoppelt werden."
                jaText="Neu aufsetzen"
                onJa={() => {
                  setNeu(false);
                  void fuehreAus(() => window.jmps.setzeVerbundNeuAuf());
                }}
                onNein={() => setNeu(false)}
              />
            )}
          </div>
        )}
      </Abschnitt>

      {m.zustand === 'laeuft' && <KoppelFenster stand={stand} />}

      <Abschnitt titel="Gekoppelte Rechner">
        {m.rechner.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">Noch keine.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {m.rechner.map((r) => (
              <li key={r.rechnerId} className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span aria-hidden className={cn('size-2 shrink-0 rounded-full', r.online ? 'bg-[var(--success)]' : 'bg-[var(--muted-foreground)]/40')} />
                  <span className="truncate text-sm font-bold">{r.name}</span>
                  {r.dieserRechner && <span className="text-[10px] text-[var(--muted-foreground)]">dieser Rechner</span>}
                  <span className="ml-auto shrink-0 text-[11px] text-[var(--muted-foreground)]">
                    {r.online
                      ? (r.dieserRechner ? 'online' : r.adresse ?? 'online')
                      : r.zuletztGesehen
                        ? `offline · zuletzt ${relativ(jetzt - r.zuletztGesehen)}`
                        : 'offline'}
                  </span>
                  {!r.dieserRechner && (
                    <button
                      type="button"
                      className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--highlight)]"
                      onClick={() => setEntfernen({ id: r.rechnerId, name: r.name })}
                    >
                      Entfernen
                    </button>
                  )}
                </div>
                {r.tools.length > 0 && (
                  <ul className="mt-1.5 flex flex-col gap-0.5 pl-4">
                    {r.tools.map((t) => (
                      <li key={t.appId} className="text-[11px] text-[var(--muted-foreground)]">
                        {t.name} {t.version} · verbunden seit {uhrzeit(t.verbundenSeit)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        {entfernen && (
          <Bestaetigung
            frage={`„${entfernen.name}“ entfernen? Der Rechner wird sofort getrennt und muss neu gekoppelt werden.`}
            jaText="Entfernen"
            onJa={() => {
              const id = entfernen.id;
              setEntfernen(null);
              void fuehreAus(() => window.jmps.entferneRechner(id));
            }}
            onNein={() => setEntfernen(null)}
          />
        )}
      </Abschnitt>

      <Abschnitt titel="Master-Identität">
        <p className="text-xs text-[var(--muted-foreground)]">
          Nur bei Verdacht auf Missbrauch oder beim Tausch des Master-Rechners. Danach müssen alle anderen Rechner neu gekoppelt werden.
        </p>
        <Button size="sm" variant="outline" uppercase={false} className="mt-2" disabled={beschaeftigt || m.zustand !== 'laeuft'} onClick={() => setErneuern(true)}>
          Master-Identität erneuern
        </Button>
        {erneuern && (
          <Bestaetigung
            frage="Alle anderen Rechner müssen danach neu gekoppelt werden. Die Tools dieses Rechners verbinden sich von selbst wieder."
            jaText="Erneuern"
            onJa={() => {
              setErneuern(false);
              void fuehreAus(() => window.jmps.erneuereMasterIdentitaet());
            }}
            onNein={() => setErneuern(false)}
          />
        )}
      </Abschnitt>
    </>
  );
}

function KoppelFenster({ stand }: { stand: VerbundStand }) {
  const k = stand.master!.kopplung;
  const fuehreAus = useVerbund((s) => s.fuehreAus);
  const restSek = k.gueltigBis ? Math.max(0, Math.ceil((k.gueltigBis - Date.now()) / 1000)) : 0;
  const zeigbar = k.code !== null && !k.ungueltig && restSek > 0;
  return (
    <Abschnitt titel="Rechner koppeln">
      {!k.offen ? (
        <>
          <p className="text-xs text-[var(--muted-foreground)]">
            Zeigt einen Code für 2 Minuten. Am anderen Rechner im Launcher „Mit Master verbinden“ wählen und den Code eintippen.
          </p>
          <Button size="sm" uppercase={false} className="mt-2" onClick={() => void fuehreAus(() => window.jmps.oeffneKopplung())}>
            Rechner koppeln
          </Button>
        </>
      ) : (
        <>
          {zeigbar ? (
            <>
              <p className="font-mono text-3xl font-extrabold tracking-[0.2em] tabular-nums" aria-live="polite">{zeigeCode(k.code!)}</p>
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                noch {Math.floor(restSek / 60)}:{String(restSek % 60).padStart(2, '0')} · {k.rest} Versuche übrig
              </p>
            </>
          ) : (
            <p className="text-xs text-[var(--destructive)]">Code abgelaufen oder verbraucht. Für den nächsten Rechner einen neuen Code holen.</p>
          )}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" uppercase={false} onClick={() => void fuehreAus(() => window.jmps.neuerKoppelCode())}>Neuer Code</Button>
            <Button size="sm" variant="ghost" uppercase={false} onClick={() => void fuehreAus(() => window.jmps.schliesseKopplung())}>Fertig</Button>
          </div>
        </>
      )}
    </Abschnitt>
  );
}
```

- [ ] **Schritt 5: Slave-Ansicht**

`apps/launcher/src/renderer/src/components/VerbundSlave.tsx`:
```tsx
import { useState } from 'react';
import { Button, cn } from '@jm/ui';
import type { VerbundStand } from '@shared/types';
import { toolVerbundText, uhrzeit, type Ton } from '@/lib/verbund-texte';
import { useTools } from '@/store/tools';
import { useVerbund } from '@/store/verbund';
import { Abschnitt, Bestaetigung, beschriftung, eingabeKlasse, TextFeld, TON_KLASSE } from './VerbundTeile';

export function VerbundSlave({ stand }: { stand: VerbundStand }) {
  return (
    <>
      {stand.slave!.gekoppelt ? <Gekoppelt stand={stand} /> : <Koppeln stand={stand} />}
      <ToolsDiesesRechners />
    </>
  );
}

function Koppeln({ stand }: { stand: VerbundStand }) {
  const s = stand.slave!;
  const koppele = useVerbund((x) => x.koppele);
  const meldung = useVerbund((x) => x.meldung);
  const beschaeftigt = useVerbund((x) => x.beschaeftigt);
  const [auswahl, setAuswahl] = useState('');
  const [hand, setHand] = useState('');
  const [code, setCode] = useState('');
  const adresse = hand.trim() || auswahl;
  const los = (): void => {
    if (adresse && code.trim()) void koppele(adresse, code);
  };
  return (
    <Abschnitt titel="Mit Master verbinden">
      {s.gefundeneMaster.length === 0 ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          Suche Master im Netz… Nichts gefunden? Gleiches Netz prüfen, sonst die Adresse von Hand eintragen.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {s.gefundeneMaster.map((g) => {
            const a = g.adressen[0] ?? '';
            return (
              <li key={g.masterId}>
                <label className="flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-xs">
                  <input type="radio" name="master" checked={auswahl === a && !hand.trim()} onChange={() => { setAuswahl(a); setHand(''); }} />
                  <span className="font-bold">{g.name}</span>
                  <span className="text-[var(--muted-foreground)]">{a} · {g.fpKurz}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <label className="mt-3 flex flex-col gap-1.5">
        <span className={beschriftung}>Adresse von Hand (z. B. über VLAN-Grenzen)</span>
        <input className={eingabeKlasse} value={hand} placeholder="10.0.0.110" onChange={(e) => setHand(e.target.value)} />
      </label>
      <label className="mt-3 flex flex-col gap-1.5">
        <span className={beschriftung}>Code vom Master</span>
        <input
          className={cn(eingabeKlasse, 'font-mono uppercase tracking-[0.2em]')}
          value={code}
          maxLength={13}
          placeholder="XXXXX-XXXXX"
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && los()}
        />
      </label>
      {meldung && <p className="mt-2 text-xs text-[var(--destructive)]" aria-live="polite">{meldung}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" uppercase={false} disabled={beschaeftigt || !adresse || !code.trim()} onClick={los}>
          {s.koppeltGerade ? 'Koppeln…' : 'Koppeln'}
        </Button>
        {s.koppeltGerade && (
          <Button size="sm" variant="ghost" uppercase={false} onClick={() => void window.jmps.brecheKoppelnAb()}>Abbrechen</Button>
        )}
      </div>
    </Abschnitt>
  );
}

function Gekoppelt({ stand }: { stand: VerbundStand }) {
  const s = stand.slave!;
  const fuehreAus = useVerbund((x) => x.fuehreAus);
  const [frage, setFrage] = useState(false);
  const c = s.client;
  const name = s.masterName ?? 'Master';
  const zeile = c.art === 'verbunden'
    ? `Verbunden mit ${name} · ${c.adresse ?? ''} · seit ${c.seit ? uhrzeit(c.seit) : '—'}`
    : c.art === 'fehler'
      ? c.text ?? 'Fehler'
      : c.art === 'verbindet'
        ? `Verbinde mit ${name} (${c.adresse ?? ''})…`
        : `Suche ${name}…`;
  const ton: Ton = c.art === 'verbunden' ? 'gruen' : c.art === 'fehler' ? 'rot' : 'gelb';
  return (
    <Abschnitt titel="Master">
      <p className={cn('text-xs', TON_KLASSE[ton])} aria-live="polite">{zeile}</p>
      <div className="mt-3">
        <TextFeld
          label="Feste Master-Adresse (optional, z. B. über VLAN)"
          wert={s.festeAdresse ?? ''}
          platzhalter="10.0.0.110"
          onSpeichern={(v) => void fuehreAus(() => window.jmps.setzeFesteMasterAdresse(v || null))}
        />
      </div>
      <Button size="sm" variant="outline" uppercase={false} className="mt-3" onClick={() => setFrage(true)}>Trennen</Button>
      {frage && (
        <Bestaetigung
          frage="Die Kopplung wird gelöscht; alle Tools dieses Rechners trennen sich vom Master. Danach muss neu gekoppelt werden."
          jaText="Trennen"
          onJa={() => {
            setFrage(false);
            void fuehreAus(() => window.jmps.trenneVerbund());
          }}
          onNein={() => setFrage(false)}
        />
      )}
    </Abschnitt>
  );
}

/** Spec 5.2: welches Tool hängt? Aus dem lokalen Heartbeat-Feld `verbund`. */
function ToolsDiesesRechners() {
  const presence = useTools((s) => s.presence);
  const laufende = presence.filter((p) => p.running);
  return (
    <Abschnitt titel="Tools dieses Rechners">
      {laufende.length === 0 ? (
        <p className="text-xs text-[var(--muted-foreground)]">Gerade läuft kein Tool.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {laufende.map((p) => {
            const t = toolVerbundText(p.verbund, false)!;
            return (
              <li key={p.appId} className="flex items-center justify-between gap-3 text-xs">
                <span>{p.name}</span>
                <span className={TON_KLASSE[t.ton]}>{t.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Abschnitt>
  );
}
```

- [ ] **Schritt 6: Einbinden (Header, Einstellungen, App)**

In `apps/launcher/src/renderer/src/components/Header.tsx`:
- Import: `import { VerbundBadge } from './VerbundBadge';`
- In der rechten Knopfgruppe (`<div className="flex items-center gap-2" style={noDragRegion}>`) als **erstes** Kind: `<VerbundBadge />`

In `apps/launcher/src/renderer/src/components/SettingsModal.tsx`:
- Import: `import { useVerbund } from '@/store/verbund';`
- Direkt nach `<ControlPlaneSection />`: `<VerbundSection />`
- Am Dateiende:
```tsx
function VerbundSection() {
  const closeSettings = useTools((s) => s.closeSettings);
  const oeffne = useVerbund((s) => s.oeffne);
  return (
    <div className="mt-5 border-t border-[var(--border)] pt-5">
      <p className="text-[10px] uppercase tracking-[0.12em] font-extrabold text-[var(--muted-foreground)]">
        Verbund (mehrere Rechner)
      </p>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        Master-Modus, Rechner koppeln, Netzwerk der Suite. Ersetzt das Kopieren der control.json zwischen Rechnern.
      </p>
      <div className="mt-3">
        <Button
          variant="outline"
          onClick={() => {
            closeSettings();
            oeffne();
          }}
        >
          Verbund öffnen
        </Button>
      </div>
    </div>
  );
}
```

In `apps/launcher/src/renderer/src/App.tsx`:
- Import: `import { VerbundModal } from './components/VerbundModal';`
- Direkt nach `<SystemStatusModal />`: `<VerbundModal />`

Run:
```bash
npm run typecheck -w @jm/launcher
npm run selftest -w @jm/launcher
npm run build -w @jm/launcher
```
Expected: Typprüfung ohne Fehler, Selbsttest `… 0 fehlgeschlagen.`, Build erfolgreich.

- [ ] **Schritt 7: Ferngesteuert prüfen, mit End-zu-End-Lauf des gebauten Timers**

**Vorbedingungen:**
- Den **installierten** Launcher und die installierten Tools beenden. Die Einzelinstanz-Sperre und die Ports 7799/8738 sind sonst belegt. Port 18738 (Test-Master) muss frei sein.
- Timer und Launcher müssen gebaut sein (Aufgabe 12 Schritt 9, Schritt 6 oben).

Wegwerf-Prüfstand `<Scratchpad>/drive-verbund.mjs` (nicht ins Repo, Vorbild `drive-launcher.mjs` aus #233). Er legt `master-link.json` und den master-link-Ordner des Launchers vor dem Lauf beiseite, sonst gilt „Verbund aus“ nur auf einem Rechner ohne Kopplung, und stellt beide in jedem Ausgang wieder her. Teil 2 fotografiert jeden Zustand von Kopf und Modal, den ein Rechner allein herstellen kann (Spec 11.2). Die erwarteten Texte stehen wörtlich so in `kopfanzeige()` (Aufgabe 14):
```js
// WEGWERF-Prüfstand Master-Link Teil 1: gebauten Launcher per CDP steuern, JEDEN erreichbaren Zustand von
// Kopf und Modal bei 980×640 fotografieren (Spec 11.2), End-zu-End mit dem gebauten Timer.
// Legt master-link.json und den master-link-Ordner des Launchers VOR dem Lauf beiseite (umbenennen, keine
// Kopie mit Schlüsseln im Bildordner) und stellt beide in JEDEM Ausgang wieder her (auch Abbruch, Strg+C).
// Aufruf: node drive-verbund.mjs <worktree> <bildordner>   — pruef-gegenstelle.mts liegt daneben.
import { spawn } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const [REPO, OUT] = process.argv.slice(2);
const ELECTRON = process.env.ELECTRON_EXE ?? 'C:/Users/alexk/alexzvn/node_modules/electron/dist/electron.exe';
const APPDATA = process.env.APPDATA;
const ML = join(APPDATA, 'JM Production Suite', 'master-link.json');
const SPEICHER = join(APPDATA, '@jm', 'launcher', 'master-link');
const GEGENSTELLE = join(dirname(fileURLToPath(import.meta.url)), 'pruef-gegenstelle.mts');
const VORHER = '.pruefstand-vorher';
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

for (const p of [ML, SPEICHER]) {
  if (existsSync(p + VORHER)) {
    console.log(`ABBRUCH vor dem Start: ${p + VORHER} liegt noch da (voriger Lauf?) — erst von Hand zurückbenennen.`);
    process.exit(3);
  }
}
// „Verbund aus“ (1) und „noch keine Rechner“ (2) gelten nur ohne vorhandene Kopplung/Verbunddaten.
const hatteDatei = existsSync(ML);
const hatteSpeicher = existsSync(SPEICHER);
if (hatteDatei) renameSync(ML, ML + VORHER);
if (hatteSpeicher) renameSync(SPEICHER, SPEICHER + VORHER);

let launcher = null;
let timer = null;
let ws = null;
const gegenstellen = [];
const hilfsServer = [];
let aufgeraeumt = false;
async function raeumeAuf() {
  if (aufgeraeumt) return;
  aufgeraeumt = true;
  try { ws?.close(); } catch { /* schon zu */ }
  for (const p of [timer, launcher, ...gegenstellen]) try { p?.kill(); } catch { /* schon beendet */ }
  for (const s of hilfsServer) s.close();
  await sleep(1500);
  rmSync(ML, { recursive: true, force: true }); // Datei — oder Ordner aus der Szene „gesperrt“
  rmSync(SPEICHER, { recursive: true, force: true });
  if (hatteDatei) renameSync(ML + VORHER, ML);
  if (hatteSpeicher) renameSync(SPEICHER + VORHER, SPEICHER);
  console.log('aufgeräumt: master-link.json', hatteDatei ? 'wiederhergestellt' : 'entfernt', '· master-link-Ordner', hatteSpeicher ? 'wiederhergestellt' : 'entfernt');
}
process.on('SIGINT', () => { void raeumeAuf().then(() => process.exit(130)); });

// ── CDP ───────────────────────────────────────────────────────────────────────
let nextId = 1;
const pending = new Map();
const cdp = (method, params = {}) => new Promise((res) => { const id = nextId++; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const shot = async (name) => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, name), Buffer.from(r.result.data, 'base64')); console.log('Bild:', name); };
const badge = () => ev(`document.querySelector('[aria-label="Verbund"]')?.textContent ?? null`);
const klickText = (t) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(t)}); if (b) b.click(); return !!b; })()`);
const escape = async () => {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(300);
};
// React-Eingabefeld füllen (value-Setter + input-Ereignis), gefunden über den Platzhalter.
const tippe = (platzhalter, wert) => ev(`(() => { const el = document.querySelector('input[placeholder=${JSON.stringify(platzhalter)}]'); if (!el) return false;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(wert)});
  el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const kopfPlatz = () => ev(`(() => {
  const bs = [...document.querySelectorAll('header button')].map((b) => b.getBoundingClientRect());
  let ueber = false;
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const a = bs[i], b = bs[j];
    if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) ueber = true;
  }
  return { ueberlappt: ueber, rechtsAussen: Math.max(...bs.map((b) => b.right)), breite: innerWidth };
})()`);
const modalPlatz = () => ev(`(() => {
  const h2 = [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === 'Verbund');
  const zu = h2 && [...h2.closest('.flex.flex-col').querySelectorAll('button')].find((b) => b.textContent.trim() === 'Schließen');
  return { schliessenUnten: zu ? zu.getBoundingClientRect().bottom : null, fenster: innerHeight };
})()`);

async function starteLauncher() {
  launcher = spawn(ELECTRON, [`--remote-debugging-port=${PORT}`, join(REPO, 'apps/launcher')], { env, stdio: 'ignore' });
  let page = null;
  for (let i = 0; i < 60 && !page; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      page = list.find((t) => t.type === 'page' && t.url.includes('index.html'));
    } catch { /* noch nicht da */ }
  }
  if (!page) throw new Error('KEIN FENSTER (installierter Launcher noch offen?)');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 980, height: 640, deviceScaleFactor: 1, mobile: false });
  for (let i = 0; i < 40 && !(await badge()); i++) await sleep(250);
}
async function beendeLauncher() {
  try { ws?.close(); } catch { /* schon zu */ }
  ws = null;
  const l = launcher;
  launcher = null;
  if (l && l.exitCode === null) {
    const weg = new Promise((r) => l.once('exit', r));
    l.kill();
    await weg;
  }
  await sleep(800); // Port 8738 und Dateien frei
}

/** Test-Master/-Slave aus dem Plan-Code (pruef-gegenstelle.mts), Antworten zeilenweise über stdout. */
function gegenstelle(...args) {
  const p = spawn(process.execPath, [join(REPO, 'node_modules/tsx/dist/cli.mjs'), GEGENSTELLE, REPO, ...args], { stdio: ['pipe', 'pipe', 'inherit'] });
  gegenstellen.push(p);
  const vorrat = [];
  const wartende = [];
  createInterface({ input: p.stdout }).on('line', (z) => { const d = JSON.parse(z); const w = wartende.shift(); if (w) w(d); else vorrat.push(d); });
  const antwort = (ms = 20_000) => new Promise((r, f) => {
    if (vorrat.length) { r(vorrat.shift()); return; }
    const t = setTimeout(() => f(new Error(`Gegenstelle ${args[0]} antwortet nicht`)), ms);
    wartende.push((d) => { clearTimeout(t); r(d); });
  });
  return { antwort, frage: (b, ms) => { p.stdin.write(`${JSON.stringify(b)}\n`); return antwort(ms); } };
}

// Farbe der Kopfanzeige an der Klasse aus FARBE_KLASSE (VerbundTeile.tsx) erkennen.
const FARBE = {
  gedaempft: 'bg-[var(--muted)]', neutral: 'bg-[var(--highlight)]', gruen: 'text-[var(--success)]',
  gelb: 'text-[var(--warning)]', rot: 'text-[var(--destructive)]',
};
const ergebnisse = [];
/** Wartet auf den erwarteten Kopf (Text UND Farbe, exakt aus kopfanzeige()), fotografiert Kopf und Modal. */
async function szene(name, text, farbe, maxMs = 15_000) {
  const ende = Date.now() + maxMs;
  let ist = await badge();
  while (ist !== text && Date.now() < ende) { await sleep(100); ist = await badge(); }
  const klasse = await ev(`document.querySelector('[aria-label="Verbund"]')?.className ?? ''`);
  const platz = await kopfPlatz();
  await shot(`kopf-${name}.png`);
  await ev(`document.querySelector('[aria-label="Verbund"]').click()`);
  await sleep(600);
  await shot(`modal-${name}.png`);
  const modal = await modalPlatz();
  await escape();
  const zu = !(await ev(`[...document.querySelectorAll('h2')].some((h) => h.textContent.trim() === 'Verbund')`));
  const ok = ist === text && klasse.includes(FARBE[farbe]) && !platz.ueberlappt && platz.rechtsAussen <= 980
    && modal.schliessenUnten !== null && modal.schliessenUnten <= 640 && zu;
  ergebnisse.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}: „${ist}“ ${ok ? '' : `(soll „${text}“/${farbe}; Klasse ${klasse}; Kopf ${JSON.stringify(platz)}; Modal ${JSON.stringify(modal)}; Escape schließt ${zu})`}`);
}
const schreibeML = (inhalt) => { mkdirSync(dirname(ML), { recursive: true }); writeFileSync(ML, inhalt); };
const ohneLauscher = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

let exitCode = 0;
try {
  // ── Teil 1: aus, Master, Code, Timer End-zu-End ───────────────────────────────
  await starteLauncher();
  await szene('aus', 'Verbund aus', 'gedaempft');
  await ev(`window.jmps.setzeVerbundRolle('master').then(() => true)`);
  await szene('master-leer', 'Master · noch keine Rechner', 'neutral');

  await ev(`document.querySelector('[aria-label="Verbund"]').click()`);
  await sleep(600);
  await klickText('Rechner koppeln');
  await sleep(600);
  // Den Code NIE ausgeben — nur sein Format prüfen.
  console.log('Code im Format XXXXX-XXXXX:', await ev(`/^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/.test(document.querySelector('p.font-mono')?.textContent ?? '')`));
  console.log('  Modal passt ins Fenster:', JSON.stringify(await modalPlatz()));
  await shot('modal-code.png');

  timer = spawn(ELECTRON, [join(REPO, 'apps/timer')], { env, stdio: 'ignore' });
  let gesehen = false;
  for (let i = 0; i < 60 && !gesehen; i++) {
    await sleep(500);
    // Nur die Zeile „dieser Rechner“ im Modal zählt — „JM Timer“ steht sonst schon in der Tool-Liste (immer true).
    gesehen = await ev(`[...document.querySelectorAll('li')].some((li) => li.textContent.includes('dieser Rechner') && li.textContent.includes('JM Timer') && li.textContent.includes('verbunden seit'))`);
  }
  console.log('End-zu-End: Timer erscheint unter „dieser Rechner“:', gesehen);
  await shot('modal-timer.png');
  timer.kill();
  timer = null;
  await escape();

  // ── Teil 2: jeder erreichbare Zustand (Texte exakt aus kopfanzeige(), Aufgabe 14) ──
  // Master mit einem gekoppelten Test-Slave: grün, dann gelb (offline), dann „Karte fehlt“.
  const pruefSlave = gegenstelle('slave');
  await pruefSlave.antwort();
  await ev(`document.querySelector('[aria-label="Verbund"]').click()`);
  await sleep(600);
  if (!(await ev(`!!document.querySelector('p.font-mono')`))) await klickText('Rechner koppeln');
  await sleep(600);
  const code = await ev(`document.querySelector('p.font-mono')?.textContent ?? ''`);
  const koppelnA = await pruefSlave.frage({ koppele: { adresse: '127.0.0.1:8738', code } });
  console.log('  Test-Slave gekoppelt:', koppelnA.ok === true);
  await escape();
  await szene('master-gruen', 'Master · 1/1 Rechner online', 'gruen');
  await pruefSlave.frage({ stopp: true });
  await szene('master-gelb-offline', 'Master · 0/1 Rechner online', 'gelb');
  await ev(`window.jmps.setzeVerbundKarte('Gibt-es-nicht').then(() => true)`);
  await szene('master-karte-fehlt', 'Master · 0/1 Rechner online · Karte fehlt', 'gelb');
  await ev(`window.jmps.setzeVerbundKarte(null).then(() => true)`);

  // Master-Fehler: jeweils Dateien/Port VOR dem Start vorbereiten.
  await beendeLauncher();
  const blocker = createServer();
  await new Promise((r) => blocker.listen(8738, '0.0.0.0', r));
  hilfsServer.push(blocker);
  await starteLauncher();
  await szene('master-port-belegt', 'Master: Port 8738 belegt', 'rot');
  await beendeLauncher();
  await new Promise((r) => blocker.close(r));

  const vb = join(SPEICHER, 'verbund.json');
  writeFileSync(vb, 'Müll');
  writeFileSync(`${vb}.bak`, 'Müll');
  await starteLauncher();
  await szene('master-daten-beschaedigt', 'Master: Verbunddaten beschädigt', 'rot');
  console.log('  Knopf „Verbund neu aufsetzen“ im Modal:', await (async () => {
    await ev(`document.querySelector('[aria-label="Verbund"]').click()`);
    await sleep(500);
    const da = await ev(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Verbund neu aufsetzen')`);
    await escape();
    return da;
  })());
  await beendeLauncher();
  rmSync(vb, { force: true });
  rmSync(`${vb}.bak`, { force: true });

  const idp = join(SPEICHER, 'identitaet.json');
  renameSync(idp, `${idp}.pruef`);
  mkdirSync(idp); // Ordner statt Datei → I/O-Fehler EISDIR beim Lesen
  await starteLauncher();
  await szene('master-lausch-fehler', 'Master-Fehler: EISDIR', 'rot');
  await beendeLauncher();
  rmSync(idp, { recursive: true, force: true });
  renameSync(`${idp}.pruef`, idp);

  const mlMaster = readFileSync(ML, 'utf8');
  rmSync(ML, { force: true });
  mkdirSync(ML); // master-link.json als Ordner → beim Start nicht lesbar (Spec 7.3)
  await starteLauncher();
  await szene('gesperrt', 'Kopplungsdatei gesperrt: EISDIR', 'rot');
  await beendeLauncher();
  rmSync(ML, { recursive: true, force: true });
  schreibeML(mlMaster);

  // Slave: Koppeln (läuft), gekoppelt mit einem Test-Master, dann Fehlerbilder über die Kopplungsdatei.
  await starteLauncher();
  await ev(`window.jmps.setzeVerbundRolle('slave').then(() => true)`);
  await szene('slave-nicht-gekoppelt', 'Nicht gekoppelt: Master wählen', 'gedaempft');
  await ev(`void window.jmps.koppeleMitMaster('192.0.2.1', 'K7QXM3PRTH'); true`); // TEST-NET-1: TCP läuft 3 s ins Leere
  await szene('slave-koppelt', 'Koppeln mit 192.0.2.1…', 'gelb', 2500);
  await sleep(4000);

  const pruefMaster = gegenstelle('master', '18738');
  const bereit = await pruefMaster.antwort();
  await ev(`document.querySelector('[aria-label="Verbund"]').click()`);
  await sleep(600);
  await tippe('10.0.0.110', '127.0.0.1:18738'); // Adresse von Hand → wird feste Adresse (Spec 4.5)
  await tippe('XXXXX-XXXXX', bereit.code);
  await sleep(200);
  await klickText('Koppeln');
  for (let i = 0; i < 60 && (await badge()) !== 'Regie-PC ●'; i++) await sleep(250);
  await shot('modal-slave-gekoppelt.png');
  console.log('  feste Adresse nach Koppeln von Hand:', await ev(`[...document.querySelectorAll('input')].some((i) => i.value === '127.0.0.1')`));
  await escape();
  await szene('slave-verbunden', 'Regie-PC ●', 'gruen');
  await ev(`window.jmps.setzeVerbundKarte('Gibt-es-nicht').then(() => true)`);
  await szene('slave-karte-fehlt', 'Regie-PC ● · Karte fehlt', 'gelb');
  await ev(`window.jmps.setzeVerbundKarte(null).then(() => true)`);
  await szene('slave-verbunden-wieder', 'Regie-PC ●', 'gruen');
  await pruefMaster.frage({ doppel: ML });
  await szene('slave-ersetzt', 'Kennung doppelt: neu koppeln', 'rot');
  await pruefMaster.frage({ doppelStopp: true });
  await beendeLauncher();

  const gekoppelt = JSON.parse(readFileSync(ML, 'utf8')); // nur im Speicher, nie ausgeben
  const mitKopplung = async (name, text, farbe, aendere, maxMs) => {
    schreibeML(`${JSON.stringify({ ...gekoppelt, kopplung: { ...gekoppelt.kopplung, ...aendere } }, null, 2)}\n`);
    await starteLauncher();
    await szene(name, text, farbe, maxMs);
    await beendeLauncher();
  };
  await mitKopplung('slave-verweigert', 'Regie-PC: Master-Modus aus?', 'rot', { port: await ohneLauscher() });
  const stumm = createServer((s) => s.on('error', () => {}));
  await new Promise((r) => stumm.listen(0, '127.0.0.1', r));
  hilfsServer.push(stumm);
  await mitKopplung('slave-kein-master', 'Adresse antwortet nicht als Master', 'rot', { port: stumm.address().port }, 20_000);
  const reset = createServer((s) => { s.on('error', () => {}); s.resetAndDestroy(); });
  await new Promise((r) => reset.listen(0, '127.0.0.1', r));
  hilfsServer.push(reset);
  await mitKopplung('slave-sonstig', 'Verbindungsfehler ECONNRESET', 'rot', { port: reset.address().port });
  // Keine erreichbare Adresse: erst „Suche“, dann „Verbinde“, dann „nicht erreichbar“ (ohne mDNS-Sichtung).
  schreibeML(`${JSON.stringify({ ...gekoppelt, kopplung: { ...gekoppelt.kopplung, letzteAdresse: '192.0.2.1', festeAdresse: '192.0.2.1', adressen: [] } }, null, 2)}\n`);
  await starteLauncher();
  await szene('slave-sucht', 'Suche Regie-PC…', 'gelb', 5000);
  await szene('slave-verbindet', 'Verbinde mit Regie-PC…', 'gelb', 8000);
  await szene('slave-nicht-gefunden', 'Regie-PC nicht erreichbar', 'rot', 15_000);
  await beendeLauncher();
  // Fremdes Schlüsselpaar in der Kopplung → der Master lehnt die Signatur ab.
  const paar = generateKeyPairSync('ed25519');
  await mitKopplung('slave-signatur', 'Anmeldung abgelehnt: neu koppeln', 'rot', {
    schluessel: {
      privat: paar.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
      oeffentlich: paar.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    },
  });
  schreibeML('{ kaputt');
  await starteLauncher();
  await szene('slave-datei', 'Kopplung beschädigt: neu koppeln', 'rot', 15_000);
  await beendeLauncher();
  // Entfernen während verbunden, dann Identität erneuern (Reihenfolge: danach passt der Pin nicht mehr).
  schreibeML(`${JSON.stringify(gekoppelt, null, 2)}\n`);
  await starteLauncher();
  for (let i = 0; i < 60 && (await badge()) !== 'Regie-PC ●'; i++) await sleep(250);
  await pruefMaster.frage({ entferne: gekoppelt.rechner.id });
  await szene('slave-unbekannt', 'Vom Master entfernt: neu koppeln', 'rot');
  await beendeLauncher();
  await pruefMaster.frage({ erneuere: true });
  await mitKopplung('slave-zertifikat', 'Anderer Master unter dieser Adresse', 'rot', {});
  await pruefMaster.frage({ stopp: true });

  const fehlend = ergebnisse.filter((e) => !e.ok).map((e) => e.name);
  console.log(`\nZustände: ${ergebnisse.length - fehlend.length}/${ergebnisse.length} ok${fehlend.length ? ` — FEHL: ${fehlend.join(', ')}` : ''}`);
  console.log('Nur im Selbsttest (Aufgabe 14) belegt, hier nicht herstellbar: „Master startet…“ (Bruchteil einer Sekunde),'
    + ' zeit (mDNS-Sichtung + gesperrter Port), netz (EHOSTUNREACH), uhr (Zertifikat aus der Zukunft), protokoll (anderes PROTOKOLL).');
  if (fehlend.length) exitCode = 1;
} catch (e) {
  console.log(`ABBRUCH: ${e.message}`);
  exitCode = 2;
} finally {
  await raeumeAuf();
}
process.exit(exitCode);
```

Gegenstelle `<Scratchpad>/pruef-gegenstelle.mts` (Test-Master und Test-Slave aus dem Plan-Code, vom Prüfstand gestartet):
```ts
// WEGWERF-Gegenstelle für drive-verbund.mjs (nicht ins Repo): Test-Master oder Test-Slave aus dem Plan-Code
// (MasterRolle/SlaveRolle mit Temp-Ordnern), gesteuert über stdin/stdout — je Befehl und Antwort eine JSON-Zeile.
// Aufruf: node <repo>/node_modules/tsx/dist/cli.mjs pruef-gegenstelle.mts <repo> master <port> | slave
// Den Kopplungscode bekommt NUR der Prüfstand über stdout; er schreibt ihn nirgends hin.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

type Befehl = {
  neuerCode?: boolean; entferne?: string; erneuere?: boolean; doppel?: string; doppelStopp?: boolean; stopp?: boolean;
  koppele?: { adresse: string; code: string };
};

const [repo, art, portText] = process.argv.slice(2);
const lade = (p: string) => import(pathToFileURL(join(repo, p)).href);
const ml = await lade('packages/master-link/src/index.ts');
const pfad: string = ml.masterLinkPfad(mkdtempSync(join(tmpdir(), 'jmpruef-app-')));
let datei = {
  version: 1, rolle: art, rechner: { id: `pruef-${art}-${process.pid}`, name: art === 'master' ? 'Regie-PC' : 'Prüf-Slave' },
  netzwerk: { karte: null }, kopplung: null,
};
const zugriff = {
  datei: () => datei,
  schreibeDatei: (d: typeof datei) => { datei = d; ml.schreibeMasterLinkDatei(pfad, d); },
};
const log = (): void => {};
const antworte = (d: unknown): void => { process.stdout.write(`${JSON.stringify(d)}\n`); };

function befehle(f: (b: Befehl) => Promise<unknown>): void {
  const rl = createInterface({ input: process.stdin });
  rl.on('line', async (z) => {
    const b = JSON.parse(z) as Befehl;
    antworte(await f(b));
    if (b.stopp) process.exit(0);
  });
  rl.on('close', () => process.exit(0));
}

if (art === 'master') {
  const { MasterRolle } = await lade('apps/launcher/src/main/verbund/master.ts');
  const m = new MasterRolle({
    speicherDir: join(mkdtempSync(join(tmpdir(), 'jmpruef-user-')), 'master-link'), suiteVersion: '0.12.0', ...zugriff,
    beiAenderung: () => {}, log, port: Number(portText), mdnsFabrik: null, lauschAdressen: ['127.0.0.1'],
  });
  await m.starte();
  await m.setzeName('Regie-PC');
  m.oeffneKopplung();
  antworte({ bereit: m.stand().zustand === 'laeuft', code: m.stand().kopplung.code });
  let doppel: { starte(): void; stoppe(): Promise<void> } | null = null;
  befehle(async (b) => {
    if (b.neuerCode) { m.neuerCode(); return { code: m.stand().kopplung.code }; }
    if (b.entferne) { m.entferne(b.entferne); return { ok: true }; }
    if (b.erneuere) { await m.erneuereIdentitaet(); return { ok: m.stand().zustand === 'laeuft' }; }
    if (b.doppel) {
      // Zweiter Teilnehmer mit derselben Kennung wie der Launcher (liest dessen master-link.json nur).
      doppel = new ml.MasterLinkClient({
        dateiPfad: b.doppel, teilnehmer: { art: 'launcher', appId: 'jm-launcher', name: 'Doppel', version: '0.12.0', pid: process.pid },
        suche: null, log,
      });
      doppel!.starte();
      return { ok: true };
    }
    if (b.doppelStopp) { await doppel?.stoppe(); doppel = null; return { ok: true }; }
    if (b.stopp) { await doppel?.stoppe(); await m.stoppe(); return { ok: true }; }
    return { ok: false };
  });
} else {
  const { SlaveRolle } = await lade('apps/launcher/src/main/verbund/slave.ts');
  const s = new SlaveRolle({ dateiPfad: pfad, suiteVersion: '0.12.0', ...zugriff, beiAenderung: () => {}, log, suche: null, listenSuche: null });
  s.starte();
  antworte({ bereit: true });
  befehle(async (b) => {
    if (b.koppele) return s.koppele(b.koppele.adresse, b.koppele.code);
    if (b.stopp) { await s.stoppe(); return { ok: true }; }
    return { ok: false };
  });
}
```

Run: `node <Scratchpad>/drive-verbund.mjs C:/Users/alexk/alexzvn/.claude/worktrees/suite-sofort-fixes <Scratchpad>`

Expected (und Screenshots **ansehen**, nicht nur die Ausgabe lesen):
1. Jede Szene `ok`, am Ende `Zustände: 25/25 ok`. „ok“ heißt: Text UND Farbe exakt wie `kopfanzeige()`, Kopf ohne Überlappung und `rechtsAussen ≤ 980`, „Schließen“ im Modal bei `≤ 640`, Escape schließt.
2. `Code im Format XXXXX-XXXXX: true`, `schliessenUnten ≤ 640`
3. `End-zu-End: Timer erscheint unter „dieser Rechner“: true`: Der gebaute Timer verbindet sich über 127.0.0.1 und erscheint im Modal.
4. `Test-Slave gekoppelt: true`, `Knopf „Verbund neu aufsetzen“ im Modal: true`, `feste Adresse nach Koppeln von Hand: true`
5. `aufgeräumt: …`: `master-link.json` und der master-link-Ordner sind wieder die von vorher.

Nur im Selbsttest (Aufgabe 14) belegt, weil ein Rechner allein sie nicht herstellt: „Master startet…“ (Bruchteil einer Sekunde), `zeit` (braucht mDNS-Sichtung und gesperrten Port), `netz` (`EHOSTUNREACH`), `uhr` (Zertifikat aus der Zukunft), `protokoll` (anderes `PROTOKOLL`).

Überlappt der Kopf bei 980 px, `max-w-[12rem]` der Kopfanzeige auf `max-w-[9rem]` senken und Schritt 7 wiederholen.

- [ ] **Schritt 8: Commit**

```bash
git add apps/launcher/src/renderer/src/store/verbund.ts apps/launcher/src/renderer/src/store/tools.ts apps/launcher/src/renderer/src/components/VerbundTeile.tsx apps/launcher/src/renderer/src/components/VerbundBadge.tsx apps/launcher/src/renderer/src/components/VerbundModal.tsx apps/launcher/src/renderer/src/components/VerbundMaster.tsx apps/launcher/src/renderer/src/components/VerbundSlave.tsx apps/launcher/src/renderer/src/components/Header.tsx apps/launcher/src/renderer/src/components/SettingsModal.tsx apps/launcher/src/renderer/src/App.tsx
git status --short
git commit -m "feat(launcher): Kopfanzeige und Modal Verbund (Master, Koppeln, Slave, Netzwerkwahl)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aufgabe 17: CI führt die Selbsttests aus

**Files:**
- Modify: `.github/workflows/ci-checks.yml`

**Interfaces:**
- Consumes: Skripte `selftest` (`@jm/master-link`, `@jm/launcher`) und `selftest:verbund` (`@jm/launcher`)
- Produces: CI-Job `selftests`

- [ ] **Schritt 1: Job ergänzen**

In `.github/workflows/ci-checks.yml` nach dem Job `typecheck` einfügen:
```yaml
  selftests:
    name: Selbsttests (Master-Link + Launcher)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          # Node 22: der Launcher-Selbsttest läuft mit --experimental-strip-types (≥ 22.6).
          node-version: 22
      - name: Install (ohne native Postinstalls)
        run: npm ci --ignore-scripts
      - name: Master-Link (TLS, Kopplung, Client — echte Sockets auf 127.0.0.1)
        run: npm run selftest -w @jm/master-link
      - name: Launcher (reine Helfer, Kopfanzeige, Presence)
        run: npm run selftest -w @jm/launcher
      - name: Launcher (Verbund-Rollen Master/Slave)
        run: npm run selftest:verbund -w @jm/launcher
```

- [ ] **Schritt 2: Lokal wie die CI prüfen**

Run:
```bash
npm run selftest -w @jm/master-link
npm run selftest -w @jm/launcher
npm run selftest:verbund -w @jm/launcher
npm run typecheck --workspaces --if-present
```
Expected:
- Alle drei Selbsttests `… 0 fehlgeschlagen.`
- `typecheck` über alle Workspaces ohne Fehler. `@jm/master-link` ist jetzt mit eigenem `typecheck` dabei, und alle Apps prüfen die Master-Link-Quellen über `@jm/app-runtime` mit.

- [ ] **Schritt 3: Commit**

```bash
git add .github/workflows/ci-checks.yml
git status --short
git commit -m "ci: Selbsttests Master-Link und Launcher (Node 22)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aufgabe 18: Handbuch, Abnahme-Checkliste, Spec-Zeilennummern

**Files:**
- Create: `docs/suite-verbund.md`, `packages/master-link/ABNAHME.md`
- Modify: `docs/README.md` (Link auf das Handbuch im Doku-Index)
- Modify: `docs/superpowers/specs/2026-09-30-master-link-teil1-design.md` (Zeilennummern der Einzelinstanz-Sperre)

**Interfaces:**
- Consumes: Texte und Abläufe aus der Spec (Abschnitte 4.6, 9, 12)
- Produces: Handbuch für Bediener, Abnahme-Checkliste

- [ ] **Schritt 1: Handbuch schreiben und im Doku-Index verlinken**

`docs/suite-verbund.md`:
````markdown
# Verbund: die Suite auf mehreren Rechnern

Ein Launcher ist **Master**, die anderen Rechner koppeln sich **einmal** mit ihm. Danach verbinden sich Launcher und Tools jedes gekoppelten Rechners bei jedem Start selbst, auch wenn sich die IP-Adressen ändern.

Stand Teil 1: Der Master sieht je Rechner, welche Tools laufen. Show-Daten über das Netz, Fernstart und die Show-Zentrale folgen in den nächsten Teilen.

## Master einschalten

1. Launcher → Kopfanzeige **Verbund** (oder Einstellungen → Verbund öffnen).
2. Rolle **Master** wählen. Die Kopfanzeige zeigt „Master · noch keine Rechner“.
3. Optional einen Namen vergeben (z. B. „Regie-PC“) und das **Netzwerk der Suite** wählen (siehe unten).

## Rechner koppeln

1. **Am Master:** **Rechner koppeln**. Es erscheint ein Code wie `K7QXM-3PRTH`. Er gilt 2 Minuten und für höchstens 5 Fehlversuche.
2. **Am anderen Rechner:** Rolle **Mit Master verbinden**, den Master in der Liste wählen (oder seine Adresse von Hand eintragen), den Code eintippen, **Koppeln**.
3. Fertig. Alle Tools dieses Rechners verbinden sich jetzt selbst mit dem Master, auch ohne laufenden Launcher.

Groß-/Kleinschreibung, Leerzeichen und der Bindestrich im Code sind egal. Die Zeichen 0, 1, I, L, O kommen nie vor.

## Netzwerk der Suite

- **Automatisch** (Vorgabe) nutzt alle Netzwerkkarten.
- Eine **bestimmte Karte** wählen, wenn der Rechner mehrere Netze hat (Hyper-V, VPN, zweite Karte). Dann bevorzugt der Verbund Adressen in diesem Netz.
- Fehlt die gewählte Karte bei einem späteren Einsatz, arbeitet der Rechner mit Automatisch weiter und zeigt „Karte fehlt“.

## Über VLAN-Grenzen: feste Master-Adresse

Die automatische Suche (mDNS) endet an der Grenze des eigenen Netzes. Liegen Master und Rechner in verschiedenen VLANs:
- Beim Koppeln die Master-Adresse **von Hand** eintragen. Sie wird dabei zur **festen Master-Adresse**.
- Später lässt sie sich unter **Feste Master-Adresse** ändern oder nachtragen.

Das ist gefahrlos: Jede Verbindung prüft das Zertifikat des Masters, eine falsche Adresse kann sich nicht als Master ausgeben.

## Was die Kopfanzeige sagt

| Anzeige | Bedeutung | Was tun |
| --- | --- | --- |
| Regie-PC ● | verbunden | — |
| Suche Regie-PC… | Master wird gesucht | kurz warten |
| Regie-PC nicht erreichbar | Master aus, Launcher/Master-Modus aus, anderes Netz oder Firewall | Master prüfen; gleiches Netz? sonst feste Adresse |
| Regie-PC sichtbar, Port gesperrt: Firewall? | Master antwortet im Netz, Port 8738 kommt nicht durch | Firewall am Master (siehe unten) |
| Anderer Master unter dieser Adresse | Master neu aufgesetzt oder falsches Gerät | neu koppeln |
| Uhrzeit prüfen | Uhrzeit dieses Rechners oder des Masters falsch | Uhrzeit stellen |
| Versionen angleichen | Launcher/Tools unterschiedlich alt | alle Rechner aktualisieren |
| Vom Master entfernt: neu koppeln | am Master entfernt | neu koppeln |
| Kennung doppelt: neu koppeln | Kopplungsdatei kopiert oder Rechner geklont | auf diesem Rechner Trennen, neu koppeln |
| Kopplung beschädigt: neu koppeln | Inhalt der Kopplungsdatei ungültig | neu koppeln |
| Kopplungsdatei gesperrt: EBUSY | Kopplungsdatei gerade nicht lesbar (Virenscanner, Sicherung); der Launcher ändert nichts daran | kurz warten, der Verbund startet von selbst; bleibt es, Virenscanner prüfen |

In der Liste „Tools dieses Rechners“ steht bei älteren Tools „läuft, noch ohne Verbund (Update nötig)“. Diese Tools arbeiten normal weiter und kommen mit ihrem nächsten Update in den Verbund.

## Firewall (Windows)

- **Beim Einschalten des Master-Modus kommt meist keine Abfrage.** Der Launcher hat seine Freigabe schon beim ersten Start bekommen.
- **Entscheidend sind die Regel für „JM Production Suite“ und das Netzwerkprofil.** Windows stuft ein Netz ohne Internet-Gateway, also viele Veranstaltungsnetze, als **Öffentlich** ein. Eine Regel, die nur für „Privat“ gilt, sperrt den Master dort still.

Abhilfe (am Master, mit Adminrechten):
1. `wf.msc` öffnen → **Eingehende Regeln** → nach „JM Production Suite“ filtern.
2. Die Regeln müssen **Zulassen** sein und für die Profile **Privat und Öffentlich** gelten. Gibt es eine **Blockieren**-Regel, diese löschen oder auf Zulassen stellen.
3. Alternativ das Netz auf „Privat“ stellen (PowerShell als Administrator): `Set-NetConnectionProfile -InterfaceAlias "Ethernet 2" -NetworkCategory Private`

Tools, die bisher nichts im Netz angeboten haben, können beim ersten Start mit aktivem Verbund **eine eigene** Abfrage zeigen: zulassen. Wer ablehnt, sperrt nur deren automatische Suche. Die Verbindung über bekannte und feste Adressen bleibt.

## Wichtig

- **`master-link.json` nie kopieren und nicht in Rechner-Images übernehmen.** Die Datei liegt unter `%APPDATA%\JM Production Suite\`. Ein Klon meldet sonst „Kennung doppelt“.
- **Die `control.json` muss für den Verbund nicht mehr zwischen Rechnern kopiert werden.** Die sichere Steuerebene (Companion) bleibt davon unberührt.
- **Master-Identität erneuern** nur bei Verdacht auf Missbrauch oder beim Tausch des Master-Rechners. Danach müssen alle anderen Rechner neu gekoppelt werden.
- **Grenzen:** nur IPv4, kein Betrieb über das Internet, ein Master je Rechnerverbund.
````

In `docs/README.md` am Ende der Liste ergänzen:
```markdown
- **[Verbund: die Suite auf mehreren Rechnern](suite-verbund.md)** — ein
  Launcher ist Master, die anderen Rechner koppeln sich einmal per Code.
  *Für Bediener.* Master einschalten, Rechner koppeln, Netzwerk der Suite,
  feste Adresse über VLAN-Grenzen, Kopfanzeige, Firewall.
```

- [ ] **Schritt 2: Abnahme-Checkliste schreiben**

`packages/master-link/ABNAHME.md`:
```markdown
# Abnahme Master-Link Teil 1 (Owner, zwei echte Windows-Rechner)

Spec: `docs/superpowers/specs/2026-09-30-master-link-teil1-design.md`, Abschnitt 12.
Rechner A = Master („Regie-PC“), Rechner B = zweiter Rechner. Beide mit Launcher 0.12.0 und Timer 0.12.0.

| # | Vorbedingung | Schritt | Erwartung | Ergebnis / Datum |
| --- | --- | --- | --- | --- |
| 1 | Regel „JM Production Suite“ erlaubt eingehend im aktuellen Netzprofil (`docs/suite-verbund.md`) | An A Verbund → Rolle Master | A zeigt „Master · noch keine Rechner“, **keine** Firewall-Abfrage | |
| 2 | 1 erledigt | An B Rolle „Mit Master verbinden“, A in der Liste wählen, An A „Rechner koppeln“, Code an B tippen | B zeigt „Regie-PC ●“, A zeigt „Master · 1/1 Rechner online“ (grün) | |
| 3 | 2 erledigt | Launcher auf B beenden, **Timer auf B allein starten** | Timer erscheint an A unter B | |
| 4 | 2 erledigt | Timer auf A starten | erscheint unter „dieser Rechner“ | |
| 5a | 3 erledigt | Netzkabel an B ziehen | A zeigt B nach höchstens 25 s offline | |
| 5b | 5a | Kabel wieder einstecken | B kommt ohne Zutun zurück | |
| 5c | 4 erledigt | Netzkabel an A ziehen, einmal mit „Automatisch“, einmal mit gewählter Karte | Timer auf A bleibt verbunden (Loopback) | |
| 6 | 3 und 4 | A neu starten | alle kommen ohne Zutun zurück | |
| 7 | B verbunden | B an A **entfernen**, während B verbunden ist | B zeigt sofort „Vom Master entfernt: neu koppeln“ und versucht es nicht weiter | |
| 8a | B neu gekoppelt | An A Master-Modus **aus** (Launcher läuft) | B zeigt „Regie-PC nicht erreichbar“ — **nicht** „Firewall?“ | |
| 8b | Master-Modus an | An A eingehende **Blockregel nur für TCP 8738** anlegen (Portregel) | B zeigt „Regie-PC sichtbar, Port gesperrt: Firewall?“; Regel danach löschen | |
| 9 | Kopplungsfenster an A offen | An B fünfmal einen falschen Code | „noch n Versuche“ zählt herunter, danach ist der Code ungültig | |
| 10 | Netz ohne Internet-Gateway (Profil „Öffentlich“) | Koppeln und verbinden | klappt, sobald die Regel „Öffentlich“ erlaubt; ohne diese zeigt B den Firewall-Hinweis | |
| 11 | falls vorhanden: Rechner mit Hyper-V- oder zweiter Karte | koppeln; feste Adresse über eine VLAN-Grenze | richtige Adresse wird gewählt; feste Adresse funktioniert | |
| 12 | alles erledigt | An A Master-Modus aus, **ein Rechner allein** | Show-Start, RELOAD und Anzeigen wie vorher | |

**macOS:** Die Regel `bind: '0.0.0.0'` für mDNS stammt aus dem Code von multicast-dns und ist nicht abgenommen. Ein Mac-Test folgt, sobald ein Mac im Aufbau steht.
```

- [ ] **Schritt 3: Zeilennummern in der Spec berichtigen**

In `docs/superpowers/specs/2026-09-30-master-link-teil1-design.md`:
- Abschnitt 1, Zeile „`initAppRuntime` läuft vor der Einzelinstanz-Sperre“:
  - `Timer `:390` vor `:397`, Titler `:460` vor `:462`` ersetzen durch `Timer `:390` vor `:405`, Titler `:460` vor `:468``
  - in der Fundstellen-Spalte `` `apps/timer/src/main/index.ts:390`, `:397`; `` ersetzen durch `` `apps/timer/src/main/index.ts:390`, `:405`; ``
- Abschnitt 8.2: `` (`apps/timer/src/main/index.ts:397`, `apps/titler/src/main/index.ts:462`) `` ersetzen durch `` (`apps/timer/src/main/index.ts:405`, `apps/titler/src/main/index.ts:468`) ``

Run: `grep -n ":397\|:462" docs/superpowers/specs/2026-09-30-master-link-teil1-design.md`
Expected: keine Treffer.

- [ ] **Schritt 4: Commit**

```bash
git add docs/suite-verbund.md docs/README.md packages/master-link/ABNAHME.md docs/superpowers/specs/2026-09-30-master-link-teil1-design.md
git status --short
git commit -m "docs: Handbuch Verbund, Abnahme-Checkliste Master-Link Teil 1" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aufgabe 19: Gesamtprüfung und Release-Vorbereitung

**Files:**
- Modify: `apps/launcher/package.json` (0.12.0), `apps/timer/package.json` (0.12.0), `apps/titler/package.json` (0.9.0)
- Modify: `packages/suite-manifest/changelog.json`

**Interfaces:**
- Consumes: alles
- Produces: Release-Commit; danach PR (superpowers:finishing-a-development-branch)

- [ ] **Schritt 1: Gesamtprüfung mit frischer Ausgabe**

Run:
```bash
npm run selftest -w @jm/master-link
npm run selftest:mdns -w @jm/master-link
npm run selftest -w @jm/app-runtime
npm run selftest -w @jm/launcher
npm run selftest:verbund -w @jm/launcher
npm run typecheck --workspaces --if-present
```
Expected: alles grün. Die Ausgaben der Zählzeilen (`… ok, 0 fehlgeschlagen.`) für den PR-Text festhalten.

- [ ] **Schritt 2: Versionen anheben**

- `apps/launcher/package.json`: `"version": "0.11.1"` → `"version": "0.12.0"`
- `apps/timer/package.json`: `"version": "0.11.2"` → `"version": "0.12.0"`
- `apps/titler/package.json`: `"version": "0.8.2"` → `"version": "0.9.0"`

- [ ] **Schritt 3: Patch-Notes eintragen**

In `packages/suite-manifest/changelog.json` je App **vorne** in `entries` einfügen. `date` ist das heutige Datum aus `date +%F`. **Keine ASCII-Anführungszeichen in den Texten** (Lehre changelog-json-quote-trap).

Launcher (`"app": "launcher"`):
```json
      {
        "version": "0.12.0",
        "date": "JJJJ-MM-TT",
        "notes": [
          "Neu: Verbund für mehrere Rechner. Ein Launcher wird Master, andere Rechner koppeln sich einmal mit einem 10-stelligen Code und finden ihn danach selbst wieder, auch wenn sich das Netz ändert.",
          "Der Master zeigt je Rechner, welche Tools laufen, mit online, offline und zuletzt gesehen. Rechner lassen sich entfernen, das wirkt sofort.",
          "Netzwerk der Suite wählbar: Automatisch oder eine bestimmte Netzwerkkarte. Behebt #234: Bei mehreren Netzwerkkarten wird die Adresse im eigenen Netz bevorzugt.",
          "Die Verbindung ist immer verschlüsselt, das Zertifikat des Masters wird bei jedem Aufbau geprüft. Fehlermeldungen nennen die Ursache: Firewall, Master aus, anderer Master, Uhrzeit oder Versionen.",
          "Die Kopfanzeige Verbund zeigt jederzeit den Zustand, ein Klick öffnet das Fenster Verbund. Anleitung und Firewall-Hilfe im Handbuch Verbund."
        ]
      },
```
Timer (`"app": "timer"`):
```json
      {
        "version": "0.12.0",
        "date": "JJJJ-MM-TT",
        "notes": [
          "Verbindet sich von selbst mit dem Master, sobald dieser Rechner im Verbund gekoppelt ist, auch ohne laufenden Launcher. Ohne Kopplung ändert sich nichts.",
          "Der Launcher zeigt auf jedem Rechner, ob der Timer mit dem Master verbunden ist."
        ]
      },
```
Titler (`"app": "titler"`):
```json
      {
        "version": "0.9.0",
        "date": "JJJJ-MM-TT",
        "notes": [
          "Verbindet sich von selbst mit dem Master, sobald dieser Rechner im Verbund gekoppelt ist, auch ohne laufenden Launcher. Ohne Kopplung ändert sich nichts.",
          "Der Launcher zeigt auf jedem Rechner, ob der Titler mit dem Master verbunden ist."
        ]
      },
```
`JJJJ-MM-TT` durch die Ausgabe von `date +%F` ersetzen.

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/suite-manifest/changelog.json','utf8')); console.log('changelog.json gültig')"`
Expected: `changelog.json gültig`

- [ ] **Schritt 4: Release-Commit**

```bash
git add apps/launcher/package.json apps/timer/package.json apps/titler/package.json packages/suite-manifest/changelog.json
git status --short
git commit -m "release(suite): launcher 0.12.0, timer 0.12.0, titler 0.9.0 — Master-Link Teil 1" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Schritt 5: Branch abschließen**

REQUIRED SUB-SKILL: superpowers:finishing-a-development-branch. Zuerst Push, dann PR gegen `main`.

**PR-Text:**
- Spec-Link
- Abschnitt 0 (Abweichungen)
- Testzahlen aus Schritt 1
- Screenshots aus Aufgabe 16 Schritt 7
- Hinweis auf `packages/master-link/ABNAHME.md`
- Schlusszeile `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

**Das Release** (Merge mit Merge-Commit, Tags `launcher-v0.12.0` und `timer-v0.12.0` **einzeln** pushen, Titler lokal nach `docs/release-titler.md` bauen und als Pre-Release veröffentlichen, danach PR `bump-manifest` für den Titler) ist nach außen gerichtet. **Vorher den Owner fragen.** Die Abnahme (`ABNAHME.md`) läuft danach auf den installierten Ständen.

// Klartexte der Zoom-Anbindung (Spec 8.1–8.5) und ihre Zuordnung zu Codes und Ereignissen.
// Ohne Electron (G8): nur relative Importe und @jm/zoom-bridge. Die Texte stehen WÖRTLICH wie in
// der Spec; Platzhalter {…} sind Funktionsparameter. Die Fernsteuer-Hinweise F1–F8 (8.6) und die
// Wiederbeitritts-Texte R2, R4, R5, R7 kommen mit Plan 4b.
import type { AudioReason, AudioState } from '@jm/zoom-bridge/protocol';
import { authResultName, endReason, failCodeName, failReason } from '@jm/zoom-bridge/protocol';
import type { ZoomMangel } from '../../shared/types';
import { Q9_ANFANG, TEXT_A4, TEXT_A6 } from '../../shared/zoom-text';

/** Text groß in der Karte, Detail klein darunter (technischer Name und Code), Spec 8. */
export interface Meldungstext {
  text: string;
  detail: string | null;
}

/** Vorsätze vor den Texten aus 8.3 (nie zusätzlich der eigene Vorsatz von explainStatus). */
export const VORSATZ = {
  beitritt: 'Beitritt gescheitert: ',
  wiederbeitritt: 'Wiederbeitritt abgebrochen: ',
  verbindung: 'Verbindung verloren: ',
} as const;
export type Vorsatz = (typeof VORSATZ)[keyof typeof VORSATZ];

/** Alle Texte aus 8.1, 8.2, 8.4, 8.5 sowie N0/N0b/CT/CE/CJ/CB aus 8.3. Schlüssel = Spec-ID. */
export const KT = {
  // 8.1 Einrichtung
  S1: 'In diesem Ordner liegt kein Zoom-SDK. Bitte den entpackten SDK-Ordner wählen (der mit dem Unterordner x64\\bin) oder direkt den Ordner x64\\bin.',
  S2: 'Das ist die 32-Bit-Fassung des Zoom-SDK. Bitte den Ordner x64\\bin wählen oder den SDK-Ordner darüber.',
  S3: (gefunden: string): string =>
    `Dieses Zoom-SDK hat die Fassung ${gefunden}. Diese Connect-Fassung braucht genau 7.1.5.43953. Für eine andere SDK-Fassung braucht es einen neuen Connect-Release.`,
  S3b: 'Die Fassung des Zoom-SDK lässt sich nicht lesen. Bitte das unveränderte SDK aus der JM-Ablage wählen.',
  S4: (name: string): string =>
    `Im SDK-Ordner liegt eine Datei, die wie eine Connect-Datei heißt (${name}). Das ist kein unverändertes Zoom-SDK.`,
  S5: (gebrauchtMb: number, freiMb: number): string =>
    `Für die Kopie des Zoom-SDK fehlt Platz: gebraucht ${gebrauchtMb} MB, frei ${freiMb} MB.`,
  S6: (grund: string): string =>
    `Das Zoom-SDK ließ sich nicht kopieren (${grund}). Die bisherige Einrichtung bleibt unverändert.`,
  S7: (x: number, y: number): string =>
    `Die Kopie des Zoom-SDK ist unvollständig (${x} von ${y} Dateien). Bitte den Ordner erneut wählen.`,
  S8: 'Dieser Connect-Installation fehlt die Zoom-Bridge. Bitte JM Connect neu installieren.',
  S9: (datei: string): string =>
    `Die Zoom-Laufzeit auf diesem PC ist unvollständig (${datei}). Bitte den SDK-Ordner erneut wählen.`,
  S10: 'Während Zoom läuft oder das Zoom-SDK geladen oder kopiert wird, lässt sich die Einrichtung nicht ändern.',
  A1: 'Die Datei ist kein gültiges JSON (Inhalt wird absichtlich nicht angezeigt).',
  A2: 'In der Datei fehlen Client-ID oder Client-Secret (erwartet: clientId und clientSecret).',
  A3: (code: string): string => `Die Datei lässt sich nicht lesen (${code}).`,
  A4: TEXT_A4,
  A5: 'Die hinterlegten Zugangsdaten lassen sich unter diesem Windows-Konto nicht entschlüsseln. Bitte die Zugangsdaten erneut eintragen oder die Datei erneut wählen.',
  A6: TEXT_A6,
  A7: 'Bitte Client-ID und Client-Secret eintragen, ohne Leerzeichen.',

  // 8.2 Start und Anmeldung
  B1: 'zoom-bridge.exe fehlt im Laufzeit-Ordner. Bitte den SDK-Ordner erneut wählen.',
  B2: (code: string): string =>
    `Windows hat den Start der Zoom-Bridge verhindert (Virenschutz oder Smart App Control). Detail: ${code}.`,
  B3: 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL fehlt (0xC0000135). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.',
  B4: 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL ist zu alt oder passt nicht (0xC0000139). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.',
  B5: 'Die Zoom-Bridge ist beim Start gestorben: Eine DLL ist kein 64-Bit-Programm oder beschädigt (0xC000007B). Mit den Zugangsdaten hat das nichts zu tun. Bitte den SDK-Ordner erneut wählen.',
  B6: (detail: string): string =>
    `Die Zoom-Bridge hat sich beendet, bevor Zoom die Anmeldung beantwortet hat (${detail}). Details im Log.`,
  B7: (x: string): string =>
    `Die Zoom-Laufzeit meldet die Fassung ${x}, erwartet ist 7.1.5 (43953). Bitte den SDK-Ordner erneut wählen.`,
  B8: (name: string): string => `Das Zoom-SDK ließ sich nicht starten (${name}). Details im Log.`,
  B8_14: 'Auf diesem PC läuft schon ein anderes Programm mit dem Zoom-Meeting-SDK (zum Beispiel das Einsatzpaket „zoom-join“). Bitte es zuerst beenden.',
  B9: (result: string): string =>
    `Zoom hat die Anmeldung abgelehnt: Client-ID oder Client-Secret stimmen nicht (${result}). Bitte die Zugangsdaten prüfen.`,
  B10: 'Zoom hat die Anmeldung abgelehnt: Das Anmelde-Token passt nicht (AUTHRET_JWTTOKENWRONG). Meist stimmen die Zugangsdaten nicht, oder die Uhr dieses PCs geht falsch.',
  B11: (result: string): string =>
    `Das Zoom-Konto der App darf das Meeting-SDK nicht nutzen (${result}). Das klärt der Inhaber des Zoom-Kontos.`,
  B12: (result: string): string => `Zoom ist gerade nicht erreichbar (${result}). Netzwerk prüfen und erneut versuchen.`,
  B13: 'Zoom lässt diese SDK-Fassung nicht mehr zu (AUTHRET_CLIENT_INCOMPATIBLE). Nötig ist ein neuer Connect-Release mit neuer SDK-Fassung.',
  B14: 'Zu viele Anmeldungen in kurzer Zeit (AUTHRET_LIMIT_EXCEEDED_EXCEPTION). Einige Minuten warten.',
  B15: (result: string): string => `Zoom hat die Anmeldung abgelehnt (${result}).`,
  B16: 'Zoom hat auf die Anmeldung nicht geantwortet (30 s). Netzwerk prüfen und erneut versuchen.',
  B17: 'Zugangsdaten fehlen — bitte eintragen oder die Datei wählen.',
  B18: (name: string): string =>
    `Das Zoom-SDK hat die Anmeldung sofort abgewiesen (${name}). Mit dem Netzwerk hat das nichts zu tun. Details im Log.`,

  // 8.3 Beitritt (ohne die C-Texte, die liefert failText)
  N0: 'Die Meeting-Nummer darf nur Ziffern enthalten (Leerzeichen und Bindestriche werden entfernt).',
  N0b: 'Der Anzeigename muss 1 bis 64 Zeichen lang sein.',
  CT: 'Zoom hat den Beitritt in 30 s weder bestätigt noch abgelehnt. Netzwerk prüfen und erneut versuchen.',
  CE: 'Der Host hat zugelassen, aber Zoom hat den Einlass in 30 s nicht abgeschlossen. Netzwerk prüfen und erneut beitreten.',
  CJ: (name: string): string => `Zoom hat den Beitritt nicht angenommen (${name}).`,
  CB: (detail: string): string => `Die Zoom-Bridge hat sich während des Beitritts beendet (${detail}). Details im Log.`,

  // 8.4 Im Meeting und an Quellen (Q3 hat keinen Text)
  Q1: 'Keine Aufnahme-Erlaubnis — der Host muss sie im Zoom-Client erteilen.',
  Q2: 'Diese Person ist nicht mehr im Meeting.',
  Q4: (name: string): string => `Die Quelle ließ sich nicht aufbauen (${name}). Details im Log.`,
  Q5: (name: string): string =>
    `Ton nicht verfügbar (${name}) — das Bild läuft ohne Ton. Für einen neuen Versuch entladen und neu laden.`,
  Q6: (dropped: number): string => `Ton: ${dropped} Pakete verworfen — dieser PC kommt nicht hinterher.`,
  Q7: 'NDI ließ sich in der Zoom-Bridge nicht starten. Details im Log.',
  Q8: 'Keine Antwort der Zoom-Bridge auf „Als Quelle laden“.',
  Q9: (n: number): string =>
    `${Q9_ANFANG} Noch einmal klicken, um die ${n}. Quelle trotzdem zu laden.`,
  Q10: (ndiName: string): string =>
    `NDI-Name doppelt: Ein Browser-Gast und diese Zoom-Person senden beide als „${ndiName}“. Im Switcher ist nicht sicher, welche Quelle ankommt. Einen der beiden umbenennen.`,
  Q11: 'Name doppelt im Meeting — nach einem Wiederbeitritt kann Connect diese Quelle nicht von selbst zuordnen.',
  Q12: (name: string): string =>
    `Zoom hat die Anfrage nach der Aufnahme-Erlaubnis nicht angenommen (${name}). Der Host kann sie im Zoom-Client trotzdem erteilen.`,
  Q13: 'Bild-Versatz: erlaubt sind ganze Zahlen von 0 bis 1000 ms.',
  Q14: 'Zum Umschalten erst entladen.',
  Q15: 'Erst im Zoom-Client zulassen.',
  Q16: (person: string): string =>
    `Bild: fehlerhafte Bilder von „${person}“ verworfen (videoBufferMismatch). Die Quelle bleibt bestehen; ob wieder Bild kommt, zeigt ihr Bild-Zustand.`,
  Q17: (person: string): string =>
    `Ton: ein fehlerhaftes Paket von „${person}“ verworfen (audioBufferMismatch). Der Ton läuft mit dem nächsten gültigen Paket weiter.`,

  // 8.5 Abriss (R6; R2, R4, R5, R7 mit Plan 4b)
  R6: (grund: string): string => `Meeting beendet: ${grund}.`,

  // 6.1 Schritt 5: Ergebnis von „Einrichtung prüfen“
  PRUEFUNG_OK: 'Einrichtung in Ordnung: Zoom-SDK 7.1.5 (43953), Anmeldung bei Zoom erfolgreich.',

  // Nur 4a, in 4b durch den Wiederbeitritt ersetzt: Abriss ohne Wiederbeitritt führt sofort zu
  // `fehler` (Plan-Kopf „Nicht in 4a“). Vorsatz davor ist VORSATZ.verbindung.
  UE_RECONNECT: 'Zoom hat die Verbindung in 30 s nicht wiederhergestellt.',
  UE_ABSTURZ: (detail: string): string => `Die Zoom-Bridge ist abgestürzt (${detail}). Details im Log.`,
};

// ── 8.3: Texte nach dem Vorsatz, je Fehlercode von `status failed` ──
const C13 = 'Das Meeting ist durch eine Kontoeinstellung eingeschränkt.';
const C88 = 'Zoom kann die Meeting-Nummer keinem Meeting eindeutig zuordnen. Bitte die Nummer prüfen.';
const C500 =
  'Zoom verlangt für dieses Meeting einen Beitritt im Namen eines angemeldeten Nutzers (OBF-Token). Das kann JM Connect nicht — nur Meetings im eigenen Zoom-Konto.';
const C_TEXTE: Record<number, string> = {
  4: 'falscher Kenncode.',
  6: 'Das Meeting ist vorbei.',
  7: 'Das Meeting hat noch nicht begonnen, und Warten auf den Host ist nicht erlaubt.',
  8: 'Dieses Meeting gibt es nicht. Bitte die Nummer prüfen.',
  9: 'Das Meeting ist voll.',
  10: 'Zoom lässt diese SDK-Fassung nicht mehr zu (Client zu alt). Nötig ist ein neuer Connect-Release mit neuer SDK-Fassung.',
  12: 'Das Meeting ist gesperrt.',
  13: C13,
  14: C13,
  16: 'Zoom hat das Anmelde-Token als abgelaufen abgewiesen. Meist geht die Uhr dieses PCs falsch.',
  23: 'Das Meeting verlangt eine Anmeldung mit einem Zoom-Konto. JM Connect tritt ohne Anmeldung bei.',
  60: 'Das Meeting ist nur für Mitglieder des Gastgeber-Kontos freigegeben.',
  62: 'Der Host lässt niemanden von außerhalb seines Zoom-Kontos zu.',
  63: 'Das Meeting gehört nicht zum Zoom-Konto dieser App. JM Connect kann nur Meetings im eigenen Zoom-Konto betreten. Bitte das Meeting im eigenen Konto anlegen.',
  64: 'Der Administrator des Gastgeber-Kontos hat diese App gesperrt.',
  82: 'Das Meeting verlangt eine Anmeldung mit dem Konto des Veranstalters. JM Connect tritt ohne Anmeldung bei und kann nur Meetings im eigenen Zoom-Konto betreten.',
  88: C88,
  89: C88,
  500: C500,
  501: C500,
  502: C500,
  503: C500,
  504: C500,
  505: C500,
  506: C500,
};

/** Text nach dem Vorsatz (8.3): eigener Text, C61 mit Anzeigename, sonst Csonst. */
export function failText(code: number, anzeigename: string): string {
  if (code === 61) return `Der Host hat „${anzeigename}“ aus dem Meeting entfernt.`;
  return C_TEXTE[code] ?? `${failReason(code)} (Code ${code}).`;
}

/** `status failed` → Meldung. Nie explainStatus (sonst „Beitritt gescheitert: gescheitert: …“). */
export function failMeldung(vorsatz: Vorsatz, code: number, anzeigename: string): Meldungstext {
  return { text: vorsatz + failText(code, anzeigename), detail: `${failCodeName(code)} (${code})` };
}

/** `status ended` durch den Host (6.5): R6 mit endReason ohne Vorsatz; Grund 1 = C61. */
export function endeMeldung(code: number, anzeigename: string): Meldungstext {
  if (code === 1) return { text: failText(61, anzeigename), detail: null };
  return { text: KT.R6(endReason(code)), detail: null };
}

/** `auth` mit Code ≠ 0 → B9–B15 (8.2). */
export function authMeldung(code: number): Meldungstext {
  const result = authResultName(code);
  const detail = `${result} (${code})`;
  if (code === 1 || code === 2) return { text: KT.B9(result), detail };
  if (code === 11) return { text: KT.B10, detail };
  if (code === 3 || code === 4) return { text: KT.B11(result), detail };
  if (code === 6 || code === 8 || code === 9) return { text: KT.B12(result), detail };
  if (code === 10) return { text: KT.B13, detail };
  if (code === 12) return { text: KT.B14, detail };
  return { text: KT.B15(result), detail };
}

/** Rückgabewert aus der detail-Zeile von bridge.ts („… exitCode=<n>“), wie cli/steuerung.mjs. */
export function exitCodeAus(detail: string | undefined): number | null {
  const m = /exitCode=(\d+)/.exec(detail ?? '');
  return m ? Number(m[1]) : null;
}

/** DLL-Tod beim Start (B3–B5); andere Rückgabewerte → null. Namen wie cli/steuerung.mjs DLL_FEHLER. */
export function dllMeldung(exitCode: number | null): Meldungstext | null {
  if (exitCode === 0xc0000135) return { text: KT.B3, detail: 'STATUS_DLL_NOT_FOUND (0xC0000135)' };
  if (exitCode === 0xc0000139) return { text: KT.B4, detail: 'STATUS_ENTRYPOINT_NOT_FOUND (0xC0000139)' };
  if (exitCode === 0xc000007b) return { text: KT.B5, detail: 'STATUS_INVALID_IMAGE_FORMAT (0xC000007B)' };
  return null;
}

/** Spawn-Fehler von start(): ENOENT → B1, sonst B2 mit dem Code. */
export function spawnMeldung(code: string | undefined): Meldungstext {
  const c = code ?? 'unbekannt';
  if (c === 'ENOENT') return { text: KT.B1, detail: c };
  return { text: KT.B2(c), detail: c };
}

/** „NAME (code)“ für meldung.detail und das Log. */
export function fehlerDetail(e: { name?: string; code: number | string }): string {
  return `${e.name ?? 'unbekannt'} (${e.code})`;
}

/** Text eines Einrichtungsmangels (6.2 Beitritt Schritt 1, 5.3). */
export function mangelText(m: ZoomMangel, datei: string | null): string {
  switch (m) {
    case 'zugang_fehlt':
      return KT.B17;
    case 'sdk_fehlt':
    case 'sdk_defekt':
      return KT.S9(datei ?? 'jm-zoom-laufzeit.json');
    case 'bridge_fehlt':
      return KT.S8;
    case 'zugang_unlesbar':
      return KT.A5;
  }
}

/** Wohin ein Fehler gehört: an die Zeile/Quelle, unter „Hinweise“ oder nirgends (8.4). */
export type Einordnung = { art: 'zeile'; text: string } | { art: 'hinweis'; text: string } | { art: 'keine' };

/** `error where:'video'|'audio'` → Einordnung (8.4). `name` = Fehlername aus enrich(), `person` = Anzeigename. */
export function quellenFehler(code: string, name: string, person: string | null, dropped?: number): Einordnung {
  const wer = person ?? 'unbekannt';
  switch (code) {
    case 'videoNoPrivilege':
      return { art: 'zeile', text: KT.Q1 };
    case 'videoUnknownParticipant':
      return { art: 'zeile', text: KT.Q2 };
    case 'videoAlreadySubscribed':
      return { art: 'keine' }; // Q3: kein Text, das Abbild gleicht sich an
    case 'videoRendererFailed':
    case 'videoRawRecordingFailed':
    case 'videoSenderFailed':
      return { art: 'zeile', text: KT.Q4(name) };
    case 'audioVoipJoinFailed':
    case 'audioHelperMissing':
    case 'audioSubscribeFailed':
      return { art: 'zeile', text: KT.Q5(name) };
    case 'videoBadDelay':
      return { art: 'zeile', text: KT.Q13 };
    case 'audioQueueOverflow':
      return { art: 'hinweis', text: KT.Q6(dropped ?? 0) };
    case 'videoBufferMismatch':
      return { art: 'hinweis', text: KT.Q16(wer) };
    case 'audioBufferMismatch':
      return { art: 'hinweis', text: KT.Q17(wer) };
    default:
      return { art: 'zeile', text: KT.Q4(name) };
  }
}

/** Ton-Zustand einer Quelle: nur `off`/`audioUnavailable` ist ein Fehler (Q5); `off`/`command` ist „ohne Ton geladen“. */
export function tonZustand(state: AudioState, reason: AudioReason): Einordnung {
  if (state === 'off' && reason === 'audioUnavailable') return { art: 'zeile', text: KT.Q5('audioUnavailable') };
  return { art: 'keine' };
}

/**
 * Maskierung für Logzeilen (8.7): jeden NICHT-LEEREN Wert durch „•••“ ersetzen, längste zuerst
 * (sonst bliebe vom normierten Teil einer längeren eingegebenen Nummer ein Rest stehen).
 */
export function maskiere(zeile: string, werte: ReadonlyArray<string>): string {
  const liste = werte.filter((w) => w.length > 0).sort((a, b) => b.length - a.length);
  let aus = zeile;
  for (const w of liste) aus = aus.replaceAll(w, '•••');
  return aus;
}

import type { AnmeldeSchritt, EntzugGrund, KontoAnsicht, KontoFehlerCode } from '@shared/konto';
import { STUFE_TEXT } from '../../../shared/konto';
import { datumText, KOPF_TEXTE, sitzungGueltig } from './konto-anzeige';

// Anmeldung im Launcher (Plan P25; Spec 4.1, 4.2, 6.1, 8; EP5, EP18, EP26; G7): was Konto-Dialog, Zoom-Anfrage und
// Anmelde-Dialog zeigen — als REINE Funktionen, getestet in test/konto-anzeige.test.ts. Importe wie lib/konto-anzeige.ts.

/** Texte K20–K31 (Texttabelle 9.1, wörtlich). */
export const KONTO_TEXTE = {
  /** K20 */ titel: 'Konto',
  /** K21 */ name: 'Name', email: 'E-Mail', anmeldeart: 'Anmeldeart', stufe: 'Stufe', seit: 'Angemeldet seit', bis: 'Zugang bis',
  rechner: 'Dieser Rechner', zoom: 'Zoom',
  /** K22 */ artGoogle: 'Google-Firmenkonto', artPasswort: 'E-Mail und Passwort',
  /** K23 */ rechnerJm: (r: string): string => `${r} · JM-Rechner`, rechnerKeinJm: (r: string): string => `${r} · kein JM-Rechner`,
  /** K24 */ zoomErlaubt: 'auf diesem Rechner erlaubt', zoomMac: 'auf dem Mac nicht verfügbar',
  zoomBis: (d: string): string => `freigegeben bis ${d}`,
  zoomBisKeinJm: (d: string): string => `freigegeben bis ${d}, wirkt hier nicht (kein JM-Rechner)`,
  zoomNicht: 'nicht freigegeben',
  /** K25a */ offline: (d: string): string =>
    `Offline. Die Anmeldung gilt auf diesem Rechner bis ${d}. Was den Server braucht (Installieren, Updates, iveo, Q&A extern), geht erst wieder mit Internet.`,
  /** K25b (Nachfix 1: nicht nur beim Start) */ server: (d: string): string =>
    `Der Server ist gerade nicht erreichbar. Die Anmeldung gilt weiter bis ${d}; ich versuche es im Hintergrund erneut.`,
  /** K25m (EP31) */ serverNichtEingerichtet: (d: string): string =>
    `Der Server antwortet, aber die Anmeldung ist dort noch nicht eingerichtet. Die Anmeldung gilt weiter bis ${d}; ich versuche es im Hintergrund erneut. Sag einem Admin Bescheid.`,
  /** K25n (EP30) */ serverUhr: (d: string): string =>
    `Die Uhr dieses Rechners geht mehr als 5 Minuten falsch, darum lehnt der Server die Prüfung ab. Stelle Datum und Uhrzeit richtig. Die Anmeldung gilt weiter bis ${d}; ich versuche es im Hintergrund erneut.`,
  /** K25c (EP29: beim Start und im Betrieb) */ abgelaufenDreissig:
    'Deine Anmeldung ist abgelaufen: Sie wurde seit mindestens 30 Tagen nicht mehr beim Server erneuert. Melde dich neu an.',
  /** K25d */ abgelaufenBis: (d: string): string => `Dein Zugang galt bis ${d}. Frag einen Admin nach einer Verlängerung.`,
  /** K25k */ abgelaufenGoogle: 'Kollegen melden sich spätestens alle 90 Tage neu mit Google an. Melde dich neu an.',
  /** K25o (OFP8 im Betrieb; Nachfix 1) */ googleNeuLaeuft: (d: string, z: string): string =>
    `Kollegen melden sich spätestens alle 90 Tage neu mit Google an. Diese Anmeldung gilt noch bis ${d} ${z}; danach meldest du dich neu an.`,
  /** K25e */ entzogen: (grund: string): string =>
    `Dein Zugang wurde beim letzten Start nicht mehr bestätigt: ${grund}. Frag einen Admin nach einem Zugang.`,
  /** K25f */ grund: {
    gesperrt: 'Zugang gesperrt', geloescht: 'Zugang gelöscht', 'zugang-abgelaufen': 'Zugang abgelaufen',
    'geraet-unbekannt': 'dieser Rechner ist dem Server unbekannt',
  } as Readonly<Record<EntzugGrund, string>>,
  /** K25g (mit Grund aus K25f; Nachfix 1) */ entzogenLaeuft: (grund: string): string =>
    `Dein Zugang gilt nicht mehr: ${grund}. Was schon läuft, läuft weiter; beim nächsten Start des Launchers bist du abgemeldet.`,
  /** K25h */ keinSchluesselspeicher: 'Auf diesem Rechner gibt es keinen sicheren Schlüsselspeicher. Eine Anmeldung ist hier deshalb nicht möglich.',
  /** K25i */ sitzungUnlesbar: 'Die gespeicherte Anmeldung war auf diesem Rechner nicht lesbar. Melde dich neu an.',
  /** K25j */ geraetNeu: 'Der Schlüssel dieses Rechners war nicht lesbar; der Rechner meldet sich als neues Gerät an. Ein Admin markiert ihn bei Bedarf neu als JM-Rechner.',
  /** K26 */ abmelden: 'Abmelden', neuAnmelden: 'Neu anmelden', anmelden: 'Anmelden', schliessen: 'Schließen',
  /** K27a */ frageAbmelden: 'Abmelden? Laufende Tools arbeiten weiter; neue Freigaben gibt es erst nach einer neuen Anmeldung.',
  /** K27b */ frageAbmeldenIveo: 'Abmelden? Der iveo-Abgleich der offenen Show stoppt; laufende Tools arbeiten weiter.',
  /** K27c */ jaAbmelden: 'Abmelden', abbrechen: 'Abbrechen',
  /** K29a */ ausgaben: 'An Tools ausgegeben',
  /** K29b */ ausgabe: (tool: string, zweck: string, d: string, zeit: string): string => `${tool} · ${zweck} · bis ${d} ${zeit}`,
  /** K29c */ keineAusgaben: 'Noch nichts an Tools ausgegeben.',
  /** K29d */ zweck: { 'qa-relay': 'Q&A extern' } as Readonly<Record<string, string>>,
  /** K31 */ entwicklung: (namen: string): string => `Entwicklungsmodus: ${namen} gesetzt.`,
  /** K32 (Hinweis der Ansicht nach P32) */ githubGeloescht: 'Der gespeicherte GitHub-Zugang wurde gelöscht; Downloads laufen jetzt über deine Anmeldung.',
} as const;

/** Texte Z1–Z10c (Texttabelle 9.3, wörtlich). */
export const ZOOM_TEXTE = {
  /** Z1 */ knopf: 'Zoom anfragen',
  /** Z2 */ titel: 'Zoom anfragen',
  /** Z3 */ zweck: 'Zweck oder Event',
  /** Z4 */ von: 'Von', bis: 'Bis',
  // Z5, Z6, Z9b in der Fassung für Teil 1 (EP34): Connect nutzt die Freigabe erst mit Teil 2; dann kommen die Fassungen mit
  // Wirkung „nach dem nächsten Start des Launchers“ zurück, und Z11 entfällt.
  /** Z5 */ hinweisJm: 'Dieser Rechner ist ein JM-Rechner.',
  /** Z6 */ hinweisKeinJm: 'Dieser Rechner ist kein JM-Rechner. Eine Freigabe gilt für Externe nur auf JM-Rechnern.',
  /** Z7 (Nachfix 1: „gilt“ wie Z6) */ hinweisMac: 'Auf dem Mac gibt es Zoom in Connect nicht. Eine Freigabe gilt nur für JM-Rechner unter Windows.',
  /** Z8 */ senden: 'Anfrage senden',
  /** Z9a */ offen: (d: string): string => `Zoom-Anfrage offen seit ${d}.`,
  /** Z9b */ freigegeben: (d: string): string => `Zoom freigegeben bis ${d}.`,
  /** Z9c */ abgelehnt: (d: string): string => `Zoom-Anfrage abgelehnt am ${d}.`,
  /** Z10a */ zweckFehlt: 'Nenne Zweck oder Event.',
  /** Z10b */ bisVorVon: '„Bis“ muss nach „Von“ liegen.',
  /** Z10c */ schonOffen: 'Es gibt schon eine offene Zoom-Anfrage.',
  /** Z10d (Z1, AR77) */ vergangenheit: 'Der Zeitraum liegt in der Vergangenheit.',
  /** Z10e (Z1, AR80) */ datumUngueltig: 'Bitte ein gültiges Datum eingeben.',
  /** Z11 (nur Teil 1, EP34) */ connect: 'Connect nutzt Zoom-Freigaben erst mit einem kommenden Update; bis dahin gilt Zoom in Connect wie bisher.',
} as const;

/** Texte K40–K54 (Texttabelle 9.2, wörtlich; K41 = Spec 4.1). */
export const ANMELDE_TEXTE = {
  /** K40 */ titel: 'Im Browser anmelden',
  /** K41 */ vergleichen: 'Der Browser zeigt gleich denselben Code. Bestätige dort nur, wenn er übereinstimmt.',
  /** K42 */ code: 'Code',
  /** K43 */ frist: (mss: string): string => `Gültig noch ${mss}`,
  /** K44 */ kopieren: 'Adresse kopieren', kopiert: 'Adresse kopiert',
  /** K45 */ selbstOeffnen: 'Geht der Browser nicht auf, kopiere die Adresse und öffne sie selbst.',
  /** K46 */ abbrechen: 'Abbrechen',
  /** K47 */ wartet: 'Warte auf die Bestätigung im Browser …',
  /** K48 */ abgelaufen: 'Der Code ist abgelaufen. Starte die Anmeldung neu.', neuStarten: 'Neu starten',
  /** K49 */ abgelehnt: 'Im Browser wurde „Nein, abbrechen“ gewählt. Es wurde nichts angemeldet.',
  /** K50 */ netz: 'Der Server ist nicht erreichbar. Prüfe die Internetverbindung und versuche es erneut.', erneut: 'Erneut versuchen',
  /** K51 */ nichtEingerichtet: 'Die Anmeldung ist auf dem Server noch nicht eingerichtet.',
  /** K52 */ browser: 'Der Browser ließ sich nicht öffnen. Kopiere die Adresse und öffne sie selbst.',
  /** K53 */ server: 'Beim Server ist etwas schiefgegangen. Versuche es in ein paar Minuten erneut.',
  /** K54 */ zuViele: 'Zu viele Anmeldeversuche von diesem Anschluss. Versuche es in ein paar Minuten erneut.',
  /** K56 (Z1, AR80) */ kopierenFehlt: 'Kopieren hat nicht geklappt. Markiere die Adresse und kopiere sie von Hand.',
  /** K55 (EP30) */ uhr: 'Die Uhr dieses Rechners geht falsch, darum lehnt der Server die Anmeldung ab. Stelle Datum und Uhrzeit richtig und versuche es erneut.',
  /** K58 (Z2 Fixrunde 1, AR91 Nr. 3) */ rueckkanal: 'Der Launcher konnte die Anmeldung auf diesem Rechner nicht vorbereiten. Starte den Launcher neu und versuche es noch einmal.',
} as const;

/** Uhrzeit HH:MM in Ortszeit (G2). */
export function zeitText(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Spec 4.2: Zeilen des Konto-Dialogs (nur mit Stand; ohne Stand sagt die Zustandszeile, was ist). */
export function kontoZeilen(a: KontoAnsicht | null, jetzt: number): Array<{ bezeichner: string; wert: string }> {
  const s = a?.stand;
  if (!a || !s) return [];
  const T = KONTO_TEXTE;
  const zeilen: Array<{ bezeichner: string; wert: string }> = [
    { bezeichner: T.name, wert: s.name },
    { bezeichner: T.email, wert: s.email },
    { bezeichner: T.anmeldeart, wert: s.art === 'google' ? T.artGoogle : T.artPasswort },
    { bezeichner: T.stufe, wert: STUFE_TEXT[s.stufe] },
    { bezeichner: T.seit, wert: datumText(s.angemeldetSeit) },
  ];
  if (s.kontoBis !== null) zeilen.push({ bezeichner: T.bis, wert: datumText(s.kontoBis) });
  zeilen.push({ bezeichner: T.rechner, wert: s.jm ? T.rechnerJm(a.rechnerName) : T.rechnerKeinJm(a.rechnerName) });
  zeilen.push({ bezeichner: T.zoom, wert: zoomWert(a, jetzt) });
  return zeilen;
}

/** K24 (EP18, OF1, OF4): Zoom auf diesem Rechner — Mac nie; Admin und Kollege immer; Externe nur mit Freigabe und JM-Rechner. */
function zoomWert(a: KontoAnsicht, jetzt: number): string {
  const s = a.stand;
  const T = KONTO_TEXTE;
  if (!s) return T.zoomNicht;
  if (a.plattform === 'mac') return T.zoomMac;
  if (s.stufe !== 'externer') return T.zoomErlaubt;
  if (s.zoomBis !== null && s.zoomBis > jetzt) return s.jm ? T.zoomBis(datumText(s.zoomBis)) : T.zoomBisKeinJm(datumText(s.zoomBis));
  return T.zoomNicht;
}

/** K25a–K25o: die Zeile zum Zustand (oben im Dialog); null in „pruefe“, „nicht-angemeldet“ und in „angemeldet“ ohne Grund. */
export function zustandsZeile(a: KontoAnsicht | null): string | null {
  if (!a) return null;
  const T = KONTO_TEXTE;
  const datum = a.gueltigBis ?? a.stand?.exp ?? null;
  switch (a.zustand) {
    case 'offline': return datum === null ? null : T.offline(datumText(datum));
    case 'server-nicht-erreichbar': {
      if (datum === null) return null;
      // EP30, EP31: der Server antwortet, die Prüfung scheitert an seiner Einrichtung (K25m) bzw. an der Uhr (K25n).
      if (a.grund === 'nicht-eingerichtet') return T.serverNichtEingerichtet(datumText(datum));
      if (a.grund === 'uhr') return T.serverUhr(datumText(datum));
      return T.server(datumText(datum));
    }
    case 'abgelaufen':
      if (a.grund === 'zugang-bis') {
        const bis = a.stand?.kontoBis ?? a.gueltigBis;
        // Ohne Datum (Ansicht ohne Stand) nur K6 — wahr, aber ohne Grund; P10 hält in abgelaufen den Stand (R4).
        return bis === null || bis === undefined ? KOPF_TEXTE.abgelaufen : T.abgelaufenBis(datumText(bis));
      }
      // K25k (OFP8): die letzte Anmeldung mit Google ist 90 Tage oder länger her (Grund aus Task 10).
      if (a.grund === 'google-neu') return T.abgelaufenGoogle;
      return T.abgelaufenDreissig;
    case 'entzogen': {
      const g = a.grund;
      return g === 'gesperrt' || g === 'geloescht' || g === 'zugang-abgelaufen' || g === 'geraet-unbekannt' ? T.entzogen(T.grund[g]) : T.entzogen(T.grund.gesperrt);
    }
    case 'entzogen-laeuft': {
      // K25g mit Grund (Nachfix 1): auch „Zugang bis“ erreicht, während die Sitzung weiterläuft (Spec 6.3), heißt hier so.
      const g = a.grund;
      return T.entzogenLaeuft(g === 'gesperrt' || g === 'geloescht' || g === 'zugang-abgelaufen' || g === 'geraet-unbekannt' ? T.grund[g] : T.grund.gesperrt);
    }
    case 'angemeldet':
      // K25o (OFP8 im Betrieb, Nachfix 1): Der Server verlängert die Sitzung nicht mehr, sie gilt bis zu ihrem Ende (Task 10).
      return a.grund === 'google-neu' && datum !== null ? T.googleNeuLaeuft(datumText(datum), zeitText(datum)) : null;
    case 'kein-schluesselspeicher': return T.keinSchluesselspeicher;
    default: return null;
  }
}

/** G7: jede Diagnose wird angezeigt — Hinweise der Ansicht (K25i, K25j, K32) und gesetzte Entwicklungsvariablen (K31). */
export function hinweisZeilen(a: KontoAnsicht | null): string[] {
  if (!a) return [];
  const T = KONTO_TEXTE;
  const zeilen: string[] = [];
  if (a.hinweise.includes('sitzung-unlesbar')) zeilen.push(T.sitzungUnlesbar);
  if (a.hinweise.includes('geraet-neu')) zeilen.push(T.geraetNeu);
  if (a.hinweise.includes('github-geloescht')) zeilen.push(T.githubGeloescht);
  if (a.devVariablen.length > 0) zeilen.push(T.entwicklung(a.devVariablen.join(', ')));
  return zeilen;
}

/** K26 (EP26): Knöpfe des Konto-Dialogs — Abmelden nur mit Sitzung, „Anmelden“ nur ohne, Schließen immer. */
export function kontoKnoepfe(a: KontoAnsicht | null): Array<'abmelden' | 'neu-anmelden' | 'anmelden' | 'schliessen'> {
  if (!a) return ['schliessen'];
  if (sitzungGueltig(a)) return ['abmelden', 'schliessen'];
  if (a.zustand === 'abgelaufen' || a.zustand === 'entzogen') return ['neu-anmelden', 'schliessen'];
  if (a.zustand === 'nicht-angemeldet') return ['anmelden', 'schliessen'];
  return ['schliessen'];
}

/** K27a/K27b: Rückfrage vor dem Abmelden; mit offener iveo-Show sagt sie, dass deren Abgleich stoppt (EP26). */
export function abmeldeFrage(iveoShowOffen: boolean): string {
  return iveoShowOffen ? KONTO_TEXTE.frageAbmeldenIveo : KONTO_TEXTE.frageAbmelden;
}

/** K29: was dieser Lauf an Tools ausgegeben hat (ohne Token); leer → K29c. */
export function ausgabeZeilen(a: KontoAnsicht | null, toolName: (appId: string) => string): string[] {
  if (!a || a.ausgaben.length === 0) return [KONTO_TEXTE.keineAusgaben];
  return a.ausgaben.map((g) => KONTO_TEXTE.ausgabe(toolName(g.appId), KONTO_TEXTE.zweck[g.zweck] ?? g.zweck, datumText(g.bis), zeitText(g.bis)));
}

/** Spec 8 (EP16): „Zoom anfragen“ nur für Externe mit Sitzung, ohne gültige Freigabe und ohne offene Anfrage. */
export function zoomKnopfSichtbar(a: KontoAnsicht | null, jetzt: number): boolean {
  if (!a || !sitzungGueltig(a) || a.stand?.stufe !== 'externer') return false;
  if (a.stand.zoomBis !== null && a.stand.zoomBis > jetzt) return false;
  return a.zoomAnfrage?.zustand !== 'offen';
}

/** Z9a–Z9c: Stand der letzten Zoom-Anfrage; null ohne Anfrage. */
export function zoomStand(a: KontoAnsicht | null): string | null {
  const z = a?.zoomAnfrage;
  if (!z) return null;
  if (z.zustand === 'offen') return ZOOM_TEXTE.offen(datumText(z.am));
  if (z.zustand === 'freigegeben') return ZOOM_TEXTE.freigegeben(datumText(z.bis));
  return ZOOM_TEXTE.abgelehnt(datumText(z.am));
}

/** Z5–Z7 (EP18): Hinweis im Formular — Mac, JM-Rechner unter Windows, sonst kein JM-Rechner. */
export function zoomHinweis(a: KontoAnsicht | null): string {
  if (a?.plattform === 'mac') return ZOOM_TEXTE.hinweisMac;
  return a?.stand?.jm ? ZOOM_TEXTE.hinweisJm : ZOOM_TEXTE.hinweisKeinJm;
}

/**
 * Z11 (nur Teil 1, EP34; Nachbesserung Block D, spec:4): unter der Zeile „Zoom“ — überall dort, wo sie unter Windows steht (mit
 * Stand, K24). Connect 0.3.0/0.4.0 nutzt die Freigabe noch nicht; die Zeile beschreibt das Konto, Z11 die Wirkung.
 */
export function zoomConnectHinweis(a: KontoAnsicht | null): string | null {
  if (!a?.stand || a.plattform === 'mac') return null;
  return ZOOM_TEXTE.connect;
}

/** Datum aus einem Feld type=date (JJJJ-MM-TT) in Ortszeit: Tagesbeginn bzw. Tagesende (23:59:59,999, EP15). */
export function tagesGrenze(feld: string, ende: boolean): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(feld.trim());
  if (!m) return null;
  // Z1: `new Date(y, …)` macht aus den Jahren 0 bis 99 still 1900 bis 1999; solche Jahre sind hier ungültig (Tippfehler wie 0026).
  if (Number(m[1]) < 100) return null;
  const d = ende ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999) : new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d.getTime() : null;
}

/** Spec 8 (1): Zoom-Formular prüfen — Zweck nötig (Z10a), „Bis“ nach „Von“ (Z10b); Von ab Tagesbeginn, Bis bis Tagesende. */
export function zoomFormular(e: { zweck: string; von: string; bis: string }, jetzt: number): { ok: true; zweck: string; von: number; bis: number } | { ok: false; text: string } {
  const zweck = e.zweck.trim();
  if (!zweck) return { ok: false, text: ZOOM_TEXTE.zweckFehlt };
  const von = tagesGrenze(e.von, false);
  const bis = tagesGrenze(e.bis, true);
  // Z1 (AR80): ein Datum, das es nicht gibt (leer, 30. Februar, Jahr 0026), bekommt Z10e; Z10b bleibt für Bis ≤ Von.
  if (von === null || bis === null) return { ok: false, text: ZOOM_TEXTE.datumUngueltig };
  if (bis <= von) return { ok: false, text: ZOOM_TEXTE.bisVorVon };
  // Z1 (AR77): ein Zeitraum, der schon zu Ende ist, bekommt Z10d (der Worker verlangt „bis“ nach jetzt); Z10b bleibt für Bis ≤ Von.
  if (bis <= jetzt) return { ok: false, text: ZOOM_TEXTE.vergangenheit };
  return { ok: true, zweck, von, bis };
}

/**
 * Fehler der Zoom-Anfrage: Z10c bei offener Anfrage, sonst die Texte des Anmelde-Dialogs (K50, K51, K53, K54, K55); eine
 * abgelaufene oder fehlende Sitzung wie in der Admin-Maske K14. Alles andere bleibt K53.
 */
export function zoomFehlerText(code: KontoFehlerCode): string {
  if (code === 'konflikt') return ZOOM_TEXTE.schonOffen;
  if (code === 'netz') return ANMELDE_TEXTE.netz;
  if (code === 'zu-viele') return ANMELDE_TEXTE.zuViele;
  if (code === 'uhr') return ANMELDE_TEXTE.uhr;
  if (code === 'nicht-eingerichtet') return ANMELDE_TEXTE.nichtEingerichtet;
  if (code === 'sitzung-abgelaufen' || code === 'nicht-angemeldet') return KOPF_TEXTE.titelAbgelaufen;
  return ANMELDE_TEXTE.server;
}

/** Z1: Ergebnis von „Adresse kopieren“ (K44): bei Erfolg „Adresse kopiert“, sonst K56 (AR80, vorher K53) statt Schweigen. */
export function kopierErgebnis(ok: boolean): { kopiert: boolean; fehler: string | null } {
  return ok ? { kopiert: true, fehler: null } : { kopiert: false, fehler: ANMELDE_TEXTE.kopierenFehlt };
}

/** K43: verbleibende Zeit m:ss (abgerundet auf ganze Sekunden, nie negativ). */
export function fristText(bis: number, jetzt: number): string {
  const s = Math.max(0, Math.floor((bis - jetzt) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export type AnmeldeKnopf = 'kopieren' | 'abbrechen' | 'neu-starten' | 'erneut' | 'schliessen';
export interface AnmeldeAnzeige {
  /** Haupttext (Warten, Ergebnis, Fehler); null = keiner. */
  text: string | null;
  /** Der Code (nur im Schritt „wartet“, AA6); null sonst. */
  code: string | null;
  /** K43 mit m:ss; null außer in „wartet“. */
  frist: string | null;
  /** K45 bzw. K52 unter dem Code; null außer in „wartet“. */
  hinweis: string | null;
  knoepfe: AnmeldeKnopf[];
}

/** Spec 4.1, 11.2: was der Anmelde-Dialog je Schritt zeigt. Der Code steht nur in „wartet“ (AA6). */
export function anmeldeAnzeige(s: AnmeldeSchritt, jetzt: number): AnmeldeAnzeige {
  const T = ANMELDE_TEXTE;
  const leer: AnmeldeAnzeige = { text: null, code: null, frist: null, hinweis: null, knoepfe: ['schliessen'] };
  switch (s.art) {
    case 'ruhe':
    case 'startet':
      return { ...leer, knoepfe: ['abbrechen'] };
    case 'wartet':
      return {
        text: T.wartet, code: s.code, frist: T.frist(fristText(s.bis, jetzt)),
        hinweis: s.browserOffen ? T.selbstOeffnen : T.browser, knoepfe: ['kopieren', 'abbrechen'],
      };
    case 'abgelaufen':
      return { ...leer, text: T.abgelaufen, knoepfe: ['neu-starten', 'schliessen'] };
    case 'abgelehnt':
      return { ...leer, text: T.abgelehnt, knoepfe: ['neu-starten', 'schliessen'] };
    case 'fertig':
    case 'abgebrochen':
      return leer;
    case 'fehler': {
      const c = s.code;
      if (c === 'netz') return { ...leer, text: T.netz, knoepfe: ['erneut', 'schliessen'] };
      if (c === 'nicht-eingerichtet') return { ...leer, text: T.nichtEingerichtet };
      if (c === 'zu-viele') return { ...leer, text: T.zuViele, knoepfe: ['erneut', 'schliessen'] };
      // EP30: die Uhr des Rechners geht falsch (K55); nach dem Stellen der Uhr hilft „Erneut versuchen“.
      if (c === 'uhr') return { ...leer, text: T.uhr, knoepfe: ['erneut', 'schliessen'] };
      if (c === 'browser') return { ...leer, text: T.browser };
      // Z2 Fixrunde 1: der Rückkanal ließ sich nicht öffnen (K58, nicht K53); ein neuer Versuch kann helfen.
      if (c === 'rueckkanal') return { ...leer, text: T.rueckkanal, knoepfe: ['erneut', 'schliessen'] };
      if (c === 'kein-schluesselspeicher') return { ...leer, text: KONTO_TEXTE.keinSchluesselspeicher };
      return { ...leer, text: T.server, knoepfe: ['erneut', 'schliessen'] };
    }
    default:
      return leer;
  }
}

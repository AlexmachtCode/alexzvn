import type {
  AdminAktion, AdminAktionErgebnis, AdminUebersicht, AdminZugang, KontoAnsicht, KontoFehlerCode, Stufe, Werkzeug,
} from '@shared/konto';
import { STUFE_TEXT } from '../../../shared/konto';
import { datumText, KOPF_TEXTE, sitzungGueltig } from './konto-anzeige';
import { ANMELDE_TEXTE, KONTO_TEXTE, tagesGrenze, zeitText } from './konto-dialog';

// Anmeldung im Launcher (Plan P26, P27; Spec 7, 4, 5, 8; EP15, EP16, OFP4): Zeilen, Formulare und Texte der Admin-Maske als
// REINE Funktionen, getestet in test/konto-admin.test.ts. Datumsfelder gelten bis Tagesende der Ortszeit (EP15).
// Importe wie lib/konto-anzeige.ts: aus Aliasen nur Typen, zur Laufzeit src/shared/konto.ts und die Nachbar-Bibliotheken.

/** Texte M1–M29 (Texttabelle 9.4, wörtlich). */
export const ADMIN_TEXTE = {
  /** M1 */ titel: 'Admin-Maske', oeffnen: 'Admin-Maske öffnen',
  /** M2 */ reiter: { zugaenge: 'Zugänge', iveo: 'iveo-Events', anfragen: 'Anfragen', geraete: 'Geräte' },
  /** M4 */ laedt: 'Lade …', ladeFehler: (grund: string): string => `Die Admin-Maske konnte nicht geladen werden: ${grund}.`, neuLaden: 'Erneut laden',
  /** M5 */ keinAdmin: 'Du bist kein Admin mehr. Die Admin-Maske ist geschlossen.',
  /** M10 */ spalteName: 'Name', spalteStufe: 'Stufe', spalteBis: 'bis',
  /** M11 */ gesperrt: 'gesperrt', abgelaufen: 'abgelaufen', einladungOffen: 'Einladung offen', ersterAdmin: 'erster Admin',
  /** M12 */ anmeldeart: 'Anmeldeart', stufe: 'Stufe', tools: 'Tools', events: 'iveo-Events', zugangBis: 'Zugang bis', zoomBis: 'Zoom-Freigabe bis',
  /** M13 */ werkzeug: { 'connect-raum': 'Connect (Cloud-Raum)', qa: 'Q&A (Cloud-Relay)', iveo: 'iveo im Launcher' } as Readonly<Record<Werkzeug, string>>,
  /** M14 */ zoomFrei: (d: string): string => `Connect (Zoom, nur über Anfrage): freigegeben bis ${d}`,
  zoomNicht: 'Connect (Zoom, nur über Anfrage): nicht freigegeben',
  /** M15 */ speichern: 'Speichern', loeschen: 'Zugang löschen', entsperren: 'Sperre aufheben', neuerCode: 'Neuen Code erzeugen', verlaengern: 'Verlängern',
  /** M16 */ gespeichert: (name: string): string => `Gespeichert. Wirkt beim nächsten Start des Launchers von ${name}.`,
  /** M17 */ frageLoeschenGoogle: 'Das Google-Konto wird gesperrt und kann sich nicht mehr anmelden. Die Sperre lässt sich aufheben. Laufende Sitzungen enden erst beim nächsten Start des Launchers.',
  /** M18 */ frageLoeschenExtern: 'Der Zugang wird gelöscht. Laufende Sitzungen enden erst beim nächsten Start des Launchers.',
  /** M19 */ frageNeuerCode: 'Das bisherige Passwort gilt danach nicht mehr.',
  /** M20 */ jaSperren: 'Ja, sperren', jaLoeschen: 'Ja, löschen', jaNeuerCode: 'Ja, neuen Code erzeugen', abbrechen: 'Abbrechen',
  /** M21 */ einladen: '+ Externen einladen', feldEmail: 'E-Mail', feldName: 'Name', einladenKnopf: 'Einladen',
  /** M22 */ code: (name: string, code: string): string => `Einladungscode für ${name}: ${code}`,
  /** M23 */ codeHinweis: (name: string, d: string): string =>
    `Der Code wird nur jetzt angezeigt. Gib ihn ${name} auf eigenem Weg (z. B. Chat). Er gilt bis ${d} und nur einmal.`,
  /** M24 */ minEinAdmin: 'Es muss immer mindestens einen Admin geben.',
  /** M25 */ ersterAdminFest: 'Der erste Admin (Eintrag beim Worker) lässt sich hier nicht ändern.',
  /** M26 */ emailVergeben: 'Diese E-Mail hat schon einen Zugang.',
  /** M27 */ bisFehlt: 'Externe brauchen ein Datum für „Zugang bis“.',
  /** M28 */ domain: 'Kollegen von jakobsmedien.com melden sich mit Google an; für sie braucht es keine Einladung.',
  /** M29 */ keineZugaenge: 'Noch keine Zugänge. Kollegen erscheinen nach ihrer ersten Anmeldung.',
  /** M48 (nur Teil 1, EP34; Reiter Zugänge bei Externen und Reiter Anfragen) */
  connectTeil1: 'Connect nutzt Cloud-Raum und Zoom-Freigabe erst mit einem kommenden Update; bis dahin gilt in Connect alles wie bisher.',
  /** M49 (Z1, OE2): Hinterlegen mit einer iveo-Adresse außerhalb der festen Liste */
  iveoBasisUnbekannt: 'Diese iveo-Adresse ist nicht freigegeben. Erlaubt sind Production (app.my-iveo.de) und Staging (staging-dev.my-iveo.de).',
  /** M50 (Z1): Einladen mit einer E-Mail-Adresse ohne gültiges Format */
  emailUngueltig: 'Bitte eine gültige E-Mail-Adresse eingeben.',
  /** S11 (9.6) für ungültige Anfragen */ ungueltig: 'ungültige Anfrage',
  /** S13, S14 (9.6) */ nichtNoetig: 'Zoom ist für deine Stufe schon erlaubt', unbekannterZweck: 'unbekannter Zweck',
} as const;

/** Spec 7, EP15: „Admin-Maske öffnen“ nur für Admins mit gültiger Sitzung (der Worker prüft zusätzlich den aktuellen Stand, OFP4). */
export function adminKnopfSichtbar(a: KontoAnsicht | null): boolean {
  return a !== null && sitzungGueltig(a) && a.stand?.stufe === 'admin';
}

/** Ein Feld type=date (JJJJ-MM-TT) aus einem Zeitpunkt in Ortszeit; leer ohne Zeitpunkt. */
export function feldDatum(ms: number | null): string {
  if (ms === null) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** M10, M11: eine Zeile der Liste „Zugänge“. */
export interface ZugangZeile { kid: string; name: string; stufe: string; bis: string; merkmale: string[] }

/** Spec 7: Zugänge nach Name, abgelaufene und gesperrte sichtbar (M11). */
export function zugangZeilen(u: AdminUebersicht, jetzt: number): ZugangZeile[] {
  return [...u.zugaenge]
    .sort((x, y) => x.name.localeCompare(y.name, 'de') || x.email.localeCompare(y.email))
    .map((z) => {
      const merkmale: string[] = [];
      if (z.zustand === 'gesperrt') merkmale.push(ADMIN_TEXTE.gesperrt);
      if (z.bis !== null && z.bis <= jetzt) merkmale.push(ADMIN_TEXTE.abgelaufen);
      if (z.einladungBis !== null && z.einladungBis > jetzt) merkmale.push(ADMIN_TEXTE.einladungOffen);
      if (z.ersterAdmin) merkmale.push(ADMIN_TEXTE.ersterAdmin);
      return { kid: z.kid, name: z.name || z.email, stufe: STUFE_TEXT[z.stufe], bis: z.bis === null ? '' : datumText(z.bis), merkmale };
    });
}

/** M12–M14: Details eines Zugangs (Tools, Events und Zoom nur bei Externen). */
export function zugangDetails(z: AdminZugang, eventName: (key: string) => string, jetzt: number): Array<{ bezeichner: string; wert: string }> {
  const T = ADMIN_TEXTE;
  const zeilen: Array<{ bezeichner: string; wert: string }> = [
    { bezeichner: T.anmeldeart, wert: z.art === 'google' ? KONTO_TEXTE.artGoogle : KONTO_TEXTE.artPasswort },
    { bezeichner: T.stufe, wert: STUFE_TEXT[z.stufe] },
  ];
  if (z.stufe === 'externer') {
    zeilen.push({ bezeichner: T.tools, wert: z.tools.map((w) => T.werkzeug[w]).join(', ') });
    zeilen.push({ bezeichner: T.events, wert: z.events.map(eventName).join(', ') });
  }
  zeilen.push({ bezeichner: T.zugangBis, wert: z.bis === null ? '' : datumText(z.bis) });
  if (z.stufe === 'externer') {
    zeilen.push({ bezeichner: T.zoomBis, wert: z.zoomBis !== null && z.zoomBis > jetzt ? T.zoomFrei(datumText(z.zoomBis)) : T.zoomNicht });
  }
  return zeilen;
}

/** Formularstand eines Zugangs (Datumsfelder als JJJJ-MM-TT in Ortszeit). */
export interface ZugangsFormular { stufe: Stufe; tools: Werkzeug[]; events: string[]; bis: string; zoomBis: string }

export function formularAusZugang(z: AdminZugang): ZugangsFormular {
  return { stufe: z.stufe, tools: [...z.tools], events: [...z.events], bis: feldDatum(z.bis), zoomBis: feldDatum(z.zoomBis) };
}

/**
 * Spec 7, 5 (EP16): Formular → Aktion „zugang-speichern“. Externe brauchen „Zugang bis“ (M27); Tools, Events und
 * Zoom-Freigabe gibt es nur für Externe; Datumsfelder gelten bis Tagesende der Ortszeit (EP15).
 */
export function zugangFormular(kid: string, f: ZugangsFormular): AdminAktion | { fehler: string } {
  const extern = f.stufe === 'externer';
  const bis = f.bis.trim() ? tagesGrenze(f.bis, true) : null;
  if (f.bis.trim() && bis === null) return { fehler: ADMIN_TEXTE.ungueltig };
  if (extern && bis === null) return { fehler: ADMIN_TEXTE.bisFehlt };
  const zoomBis = extern && f.zoomBis.trim() ? tagesGrenze(f.zoomBis, true) : null;
  if (extern && f.zoomBis.trim() && zoomBis === null) return { fehler: ADMIN_TEXTE.ungueltig };
  return {
    aktion: 'zugang-speichern', kid, stufe: f.stufe, tools: extern ? [...f.tools] : [], events: extern ? [...f.events] : [], bis, zoomBis,
  };
}

/** Spec 4: Einladen eines Externen — nicht für jakobsmedien.com (M28), „Zugang bis“ Pflicht (M27), bis Tagesende. */
export function einladeFormular(f: { email: string; name: string; tools: Werkzeug[]; events: string[]; bis: string }): AdminAktion | { fehler: string } {
  const email = f.email.trim().toLowerCase();
  // M50 (Z1): erst das Format, dann die Domain; ein leeres oder offensichtlich falsches Feld erreicht den Worker nie.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) return { fehler: ADMIN_TEXTE.emailUngueltig };
  if (/@jakobsmedien\.com$/.test(email)) return { fehler: ADMIN_TEXTE.domain };
  const bis = tagesGrenze(f.bis, true);
  // Ein leeres Feld heißt M27, ein Datum, das keines ist (30. Februar, Jahr 0050), „ungültig“ (Z1).
  if (bis === null) return { fehler: f.bis.trim() ? ADMIN_TEXTE.ungueltig : ADMIN_TEXTE.bisFehlt };
  return { aktion: 'einladen', email, name: f.name.trim(), tools: [...f.tools], events: [...f.events], bis };
}

/** M17/M18 mit M20: Rückfrage vor dem Löschen — Google-Konten werden gesperrt, Externe gelöscht (Spec 4). */
export function loeschFrage(z: AdminZugang): { text: string; ja: string } {
  return z.art === 'google'
    ? { text: ADMIN_TEXTE.frageLoeschenGoogle, ja: ADMIN_TEXTE.jaSperren }
    : { text: ADMIN_TEXTE.frageLoeschenExtern, ja: ADMIN_TEXTE.jaLoeschen };
}

/** M22, M23: der Einladungscode genau einmal — nur aus dem Ergebnis der Aktion, nie gespeichert. */
export function einladungsAnzeige(name: string, e: AdminAktionErgebnis | null): { code: string; hinweis: string } | null {
  if (!e?.einladungscode) return null;
  return {
    code: ADMIN_TEXTE.code(name, e.einladungscode),
    hinweis: ADMIN_TEXTE.codeHinweis(name, e.codeBis === undefined ? '' : datumText(e.codeBis)),
  };
}

/** M15 „Verlängern“: füllt „Zugang bis“ mit heute + 30 Tage (gespeichert wird erst mit „Speichern“). */
export function verlaengertBis(jetzt: number): string {
  return feldDatum(jetzt + 30 * 24 * 3_600_000);
}

/**
 * Fehlercode → Text (EP17): eigene Texte des Launchers; `konflikt` je Aktion (M26 beim Einladen, sonst M24), erster Admin M25,
 * Domain M28, kein Recht M5; Netz und Server wie im Anmelde-Dialog; Gründe wie im Konto-Dialog (K25f).
 */
export function fehlerText(code: KontoFehlerCode, aktion?: AdminAktion['aktion']): string {
  const T = ADMIN_TEXTE;
  switch (code) {
    case 'konflikt': return aktion === 'einladen' ? T.emailVergeben : T.minEinAdmin;
    case 'erster-admin': return T.ersterAdminFest;
    case 'domain': return T.domain;
    case 'iveo-basis-unbekannt': return T.iveoBasisUnbekannt;
    case 'kein-recht': return T.keinAdmin;
    case 'netz': return ANMELDE_TEXTE.netz;
    case 'zu-viele': return ANMELDE_TEXTE.zuViele;
    case 'nicht-eingerichtet': return ANMELDE_TEXTE.nichtEingerichtet;
    case 'nicht-angemeldet':
    case 'sitzung-abgelaufen': return KOPF_TEXTE.titelAbgelaufen;
    case 'gesperrt':
    case 'geloescht':
    case 'zugang-abgelaufen':
    case 'geraet-unbekannt': return KONTO_TEXTE.grund[code];
    case 'nicht-noetig': return T.nichtNoetig;
    case 'unbekannter-zweck': return T.unbekannterZweck;
    case 'ungueltig':
    case 'vorgang-unbekannt': return T.ungueltig;
    default: return ANMELDE_TEXTE.server;
  }
}

/** Stand der Admin-Maske im Store: Übersicht, Ladevorgang und Fehler der letzten Abfrage. */
export interface AdminStand { daten: AdminUebersicht | null; laedt: boolean; fehler: KontoFehlerCode | null }

/**
 * Z1 (AR75): Stand der Maske nach einer erfolgreichen Aktion. Kam die neue Übersicht mit (`daten`), ersetzt sie die alte. Scheiterte
 * nur die Folge-Abfrage (`daten` null), bleiben die bisherigen Daten stehen und der Fehler der Übersicht erscheint mit dem
 * Ladefehler-Text samt „Erneut laden“ (M4); die Maske wird nie leer, nur weil die Übersicht fehlt.
 */
export function adminNachAktion(vorher: AdminStand, daten: AdminUebersicht | null, uebersichtFehler?: KontoFehlerCode): AdminStand {
  if (daten !== null) return { daten, laedt: false, fehler: null };
  return { daten: vorher.daten, laedt: false, fehler: uebersichtFehler ?? 'server' };
}

/** Z1: Nach „Zugang löschen“ bleibt das Detail eines Google-Kontos offen (es ist nur gesperrt, „Sperre aufheben“ steht dort); ein Externer verschwindet. */
export function loeschenSchliesstDetail(z: AdminZugang): boolean {
  return z.art !== 'google';
}

/**
 * Z1 (Gesamtprüfung Minor 3): „Ersetzen“ merkt sich das Event (Basis und Slug). Nach „Events laden“ ist es wieder gewählt, wenn die
 * geladene Liste es noch enthält und dieselbe Basis geladen wurde (AR63: eine andere Basis oder ein anderes Token setzt zurück).
 */
export function vorauswahlNachLaden(
  events: ReadonlyArray<{ slug: string }>,
  vorauswahl: { basis: string; slug: string } | null,
  geladeneBasis: string,
): string[] {
  if (vorauswahl === null || vorauswahl.basis !== geladeneBasis) return [];
  return events.some((e) => e.slug === vorauswahl.slug) ? [vorauswahl.slug] : [];
}

/** M4: Ladefehler der Maske mit Grund (ohne Schlusspunkt des Grundes doppelt). */
export function ladeFehlerText(code: KontoFehlerCode): string {
  return ADMIN_TEXTE.ladeFehler(fehlerText(code).replace(/\.$/, ''));
}

// ── P27: Reiter „iveo-Events“, „Anfragen“, „Geräte“ (Spec 7, 6.4, 8; OF2, OFP2; EP9, EP13) ─────────────────────────────

/** Texte M30–M47 (Texttabelle 9.4, wörtlich). */
export const REITER_TEXTE = {
  /** M30 */ spalteEvent: 'Event', spalteBasis: 'Basis', spalteAm: 'hinterlegt am', spalteVon: 'von',
  /** M31 */ feldBasis: 'Basis-URL', feldToken: 'Token', eventsLaden: 'Events laden', hinterlegen: 'Hinterlegen',
  /** M32 */ tokenHinweis: 'Das Token wird nach dem Hinterlegen nie wieder angezeigt, nur ersetzt oder entfernt.',
  /** M33 */ ersetzen: 'Ersetzen', entfernen: 'Entfernen',
  /** M34 */ frageEntfernen: 'Launcher, die das Token schon haben, behalten es bis zu ihrem nächsten Start.',
  /** M35 */ keineEvents: 'Noch kein Event hinterlegt.', eventWaehlen: 'Wähle mindestens ein Event.', tokenFehlt: 'Füge das Token ein.',
  /** M40 */ anfrage: (name: string, zweck: string, von: string, bis: string, rechner: string, jm: boolean): string =>
    `${name} · ${zweck} · ${von} bis ${bis} · ${rechner} (${jm ? 'JM-Rechner' : 'kein JM-Rechner'})`,
  /** M41 */ warnungKeinJm: 'Achtung: kein JM-Rechner. Die Freigabe wirkt dort nicht.',
  /** M42 */ freigeben: 'Freigeben bis …', ablehnen: 'Ablehnen', keineAnfragen: 'Keine offenen Anfragen.',
  /** M43 */ spalteRechner: 'Rechner', spalteKonto: 'zuletzt angemeldet', spalteKontakt: 'letzter Kontakt', spalteVersion: 'Version',
  spaltePlattform: 'Plattform', spalteJm: 'JM-Rechner',
  /** M44 */ altKeyBis: (d: string): string => `Alter Schlüssel angenommen bis ${d}.`, altKeyOhneEnde: 'Alter Schlüssel ohne Enddatum angenommen.',
  /** M45 */ alteLauncher: 'Alte Launcher (ohne Anmeldung)',
  alteZeile: (tag: string, gruppe: string, plattform: string, n: number, zeit: string): string => `${tag} · ${gruppe} · ${plattform}: ${n} Anfragen, zuletzt ${zeit}`,
  keineAlten: 'Keine Anfragen mit dem alten Schlüssel.',
  /** M46 */ gruppe: { katalog: 'Katalog und Updates', qa: 'Q&A extern' } as Readonly<Record<'katalog' | 'qa', string>>,
  /** M47 */ connect: 'Für Connect gilt der alte Schlüssel weiter, bis Connect die Anmeldung nutzt.',
} as const;

/** M30: hinterlegte iveo-Events nach Name — ohne Token (das gibt die Übersicht ohnehin nie heraus, 6.4). */
export function iveoZeilen(u: AdminUebersicht): Array<{ key: string; event: string; slug: string; basis: string; am: string; von: string }> {
  return [...u.iveo]
    .sort((x, y) => x.name.localeCompare(y.name, 'de') || x.key.localeCompare(y.key))
    .map((e) => ({ key: e.key, event: e.name || e.slug, slug: e.slug, basis: e.basis, am: datumText(e.am), von: e.von }));
}

/**
 * Spec 6.4 (EP13): Formular „Hinterlegen“ → Aktion. Token nötig (M35), mindestens ein Event (M35); leere Basis = Standard
 * dieses Rechners. Das Token geht nur in die Aktion, nie in eine Anzeige.
 */
export function iveoHinterlegen(e: { basis: string; token: string; gewaehlt: string[]; events: Array<{ slug: string; name: string }> }, standard: string): AdminAktion | { fehler: string } {
  const token = e.token.trim();
  if (!token) return { fehler: REITER_TEXTE.tokenFehlt };
  const events = e.events.filter((x) => e.gewaehlt.includes(x.slug)).map((x) => ({ slug: x.slug, name: x.name }));
  if (events.length === 0) return { fehler: REITER_TEXTE.eventWaehlen };
  return { aktion: 'iveo-hinterlegen', basis: e.basis.trim() || standard, events, token };
}

/** Spec 8 (2–4): offene Zoom-Anfragen, älteste zuerst, mit M40 und der Warnung M41 für Nicht-JM-Rechner. */
export function anfrageZeilen(u: AdminUebersicht): Array<{ id: string; text: string; warnung: string | null; bisFeld: string }> {
  return u.anfragen
    .filter((a) => a.zustand === 'offen')
    .sort((x, y) => x.am - y.am)
    .map((a) => ({
      id: a.id,
      text: REITER_TEXTE.anfrage(a.name || a.email, a.zweck, datumText(a.von), datumText(a.bis), a.rechnerName, a.jm),
      warnung: a.jm ? null : REITER_TEXTE.warnungKeinJm,
      bisFeld: feldDatum(a.bis),
    }));
}

/** M42 „Freigeben bis …“: Datumsfeld → Aktion, bis Tagesende der Ortszeit (EP15). */
export function anfrageFreigabe(id: string, feld: string): AdminAktion | { fehler: string } {
  const bis = tagesGrenze(feld, true);
  return bis === null ? { fehler: ADMIN_TEXTE.ungueltig } : { aktion: 'anfrage-freigeben', id, bis };
}

/** M43 (Spec 7): Geräte, zuletzt im Kontakt zuerst; „zuletzt angemeldet“ als Name des Kontos, sonst die Kennung. */
export function geraeteZeilen(u: AdminUebersicht): Array<{ gid: string; rechner: string; konto: string; kontakt: string; version: string; plattform: string; jm: boolean }> {
  const konto = (k: string | null): string => {
    if (k === null) return '';
    const z = u.zugaenge.find((x) => x.kid === k);
    return z ? z.name || z.email : k;
  };
  return [...u.geraete]
    .sort((x, y) => y.letzterKontakt - x.letzterKontakt)
    .map((g) => ({
      gid: g.gid, rechner: g.name, konto: konto(g.letztesKonto), kontakt: `${datumText(g.letzterKontakt)} ${zeitText(g.letzterKontakt)}`,
      version: g.version, plattform: `${g.plattform} · ${g.arch}`, jm: g.jm,
    }));
}

/** M44 (EP9): Frist des alten Schlüssels; ohne oder mit unlesbarem Enddatum die Diagnose „ohne Enddatum“. */
export function altKeyText(u: AdminUebersicht): string {
  const m = u.altKey.bis === null ? null : /^(\d{4})-(\d{2})-(\d{2})/.exec(u.altKey.bis);
  if (u.altKey.diagnose !== null || !m) return REITER_TEXTE.altKeyOhneEnde;
  return REITER_TEXTE.altKeyBis(`${m[3]}.${m[2]}.${m[1]}`);
}

/** M45, M46 (OF2, OFP2): Anfragen alter Launcher je Tag, Gruppe und Plattform, neueste zuerst; ohne IP. */
export function alteLauncherZeilen(u: AdminUebersicht): string[] {
  const zeilen = [...u.altKey.zeilen].sort((x, y) => y.tag.localeCompare(x.tag) || y.zuletzt - x.zuletzt);
  if (zeilen.length === 0) return [REITER_TEXTE.keineAlten];
  return zeilen.map((z) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(z.tag);
    const tag = m ? `${m[3]}.${m[2]}.${m[1]}` : z.tag;
    // Z1: eine Gruppe, die dieser Launcher nicht kennt (neuerer Worker), erscheint mit ihrer Kennung statt als „undefined“.
    const gruppe = Object.hasOwn(REITER_TEXTE.gruppe, z.gruppe) ? REITER_TEXTE.gruppe[z.gruppe] : String(z.gruppe);
    return REITER_TEXTE.alteZeile(tag, gruppe, z.plattform, z.anzahl, zeitText(z.zuletzt));
  });
}

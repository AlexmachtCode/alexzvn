// Anmeldeseite im Browser (Anmeldung im Launcher, Plan Teil 1, P17; Spec 4.1 Schritte 2–4, 4; EP5). Texte B1–B23 wörtlich aus
// der Texttabelle 9.5 (Platzhalter ‹…› füllt `fuelle`, jeder Wert escaped).
//
// Die Seiten haben KEIN Skript und setzen KEIN Cookie: Anmelden und Bestätigen laufen über Formulare (POST an denselben
// Worker), der Vorgang steht als verstecktes Feld im Formular, das Seitentoken nur im Bestätigungsformular, nie im Link
// (EP5). Jeder Wert aus Anfrage oder Speicher (E-Mail, Name, Rechnername, Code, Vorgang) geht durch `esc`. Kopfzeilen nach
// Vertrag 10.1: CSP ohne Skript, no-store, no-referrer, nosniff. Rein: kein Import, keine Konsole.
// Z2 (Fixrunde 1, OE6): Nach „Ja“ zeigt die Seite einen Knopf; sein Formular schickt Vorgang und Einmalwert per POST an den Rückkanal
// des Launchers auf demselben Rechner (rueckZiel, RFC 8252 loopback). Kein automatischer Sprung.

/** Texttabelle 9.5 (B1–B23) und Z2 (B24–B26), wörtlich; ‹E-Mail›, ‹Code›, ‹Name›, ‹n›, ‹Datum› sind Platzhalter. */
export const SEITEN_TEXT = Object.freeze({
  B1: 'Anmeldung · JM Production Suite',
  B2: 'Anmelden',
  B3_knopf: 'Mit Google anmelden',
  B3_zeile: 'Für Kollegen mit Konto bei jakobsmedien.com.',
  B4_titel: 'Externe Techniker',
  B4_email: 'E-Mail',
  B4_passwort: 'Passwort',
  B4_knopf: 'Anmelden',
  B5_auf: 'Erstes Mal hier oder neuen Code bekommen?',
  B5_code: 'Einladungscode',
  B5_neu: 'Neues Passwort',
  B5_neu2: 'Neues Passwort wiederholen',
  B5_knopf: 'Passwort setzen und anmelden',
  B6: 'Die Google-Anmeldung ist auf dem Server noch nicht eingerichtet.',
  B7_als: 'Angemeldet als ‹E-Mail›',
  B7_frage: 'Zeigt dein Launcher diesen Code?',
  B7_code: '‹Code›',
  B7_ja: 'Ja, das ist mein Rechner',
  B7_nein: 'Nein, abbrechen',
  B8: 'Fertig. Dein Launcher ist angemeldet. Du kannst dieses Fenster schließen.',
  B9: 'Abgebrochen. Es wurde nichts angemeldet. Du kannst dieses Fenster schließen.',
  B10: 'Dieser Anmeldelink ist abgelaufen oder ungültig. Starte die Anmeldung im Launcher neu.',
  B11: 'Diese Anmeldung gehört schon zu einem anderen Konto. Starte die Anmeldung im Launcher neu.',
  B12: 'E-Mail oder Passwort stimmt nicht.',
  B13: 'Zu viele Fehlversuche. Versuche es in ‹n› Minuten erneut.',
  B14: 'Der Einladungscode stimmt nicht oder ist abgelaufen. Frag einen Admin nach einem neuen Code.',
  B15_ungleich: 'Die beiden Passwörter sind nicht gleich.',
  B15_kurz: 'Das Passwort braucht mindestens 10 Zeichen.',
  B16: 'Dieser Zugang ist gesperrt. Frag einen Admin.',
  B17: 'Dein Zugang ist am ‹Datum› abgelaufen. Frag einen Admin nach einer Verlängerung.',
  B18: 'Nur Google-Konten von jakobsmedien.com können sich hier anmelden.',
  B19: 'Die E-Mail-Adresse dieses Google-Kontos ist nicht bestätigt.',
  B20: 'Die Anmeldung bei Google hat nicht geklappt. Versuche es erneut.',
  B21: 'Zu viele Anfragen. Versuche es in ein paar Minuten erneut.',
  B22: 'Starte die Anmeldung im Launcher. Diese Seite öffnet sich dann von selbst.',
  B23: 'Kollegen von jakobsmedien.com melden sich mit Google an.',
  // Z2 (Rückkanal, zur Owner-Freigabe): B24 Warnsatz direkt über „Ja“, B25 ersetzt B7 „Rechner: ‹Rechnername›“, B26 nach „Ja“.
  B24: 'Bestätige nur, wenn du selbst gerade auf diesem Rechner im Launcher auf „Anmelden“ geklickt hast. Hat dir jemand diesen Link geschickt, klicke auf „Nein, abbrechen“.',
  B25: 'Rechner: ‹Name› (vom Rechner gemeldet)',
  B26: 'Weiter zum Launcher auf diesem Rechner. Öffnet sich nichts, wurde die Anmeldung auf einem anderen Rechner gestartet; starte sie dort im Launcher neu.',
  // Z2 Fixrunde 1 (AR93, OE6; zur Owner-Freigabe): B27 Name leer, B28 bestätigt und noch nicht abgeholt, B29 Knopf nach „Ja“.
  B27: 'Rechner: (kein Name gemeldet)',
  B28: 'Die Anmeldung ist bestätigt, der Launcher hat sie aber noch nicht übernommen. Wurde sie auf einem anderen Rechner gestartet, starte sie dort im Launcher neu.',
  B29: 'Weiter zum Launcher',
});

/**
 * Kopfzeilen jeder HTML-Seite (Vertrag 10.1). Z2: `form-action` erlaubt zusätzlich `http://127.0.0.1:*` für das Formular der Seite nach
 * „Ja“ (Knopf B29, POST an den Rückkanal des Launchers, Fixrunde 1 OE6); sonst unverändert.
 */
export const SEITEN_KOPF = Object.freeze({
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' http://127.0.0.1:*; base-uri 'none'; frame-ancestors 'none'",
});

/** Z2: Pfad des Rückkanals im Launcher (apps/launcher/src/main/konto/rueckkanal.ts, RUECK_PFAD; der Kettentest prüft beide). */
export const RUECK_PFAD = '/anmeldung/zurueck';

/**
 * Z2 (RFC 8252 7.3): Ziel des Formulars nach „Ja“: der Launcher auf demselben Rechner, `http://127.0.0.1:<port>/anmeldung/zurueck`.
 * Immer das IP-Literal 127.0.0.1, nie `localhost` (RFC 8252 8.3). Fixrunde 1 (OE6): ohne Query; Vorgang und Einmalwert gehen als
 * versteckte Felder im POST. Der Port ist streng eine ganze Zahl 1024–65535, sonst null.
 */
export function rueckZiel(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return null;
  return `http://127.0.0.1:${port}${RUECK_PFAD}`;
}

/** HTML-Escape für Text und Attributwerte (&, <, >, ", '). */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Text aus der Tabelle mit escapten Platzhaltern, z. B. fuelle('B13', { n: 15 }). */
export function fuelle(nr, werte = {}) {
  return esc(SEITEN_TEXT[nr]).replace(/‹([^›]+)›/g, (_, name) => esc(werte[name] ?? ''));
}

/** Datum TT.MM.JJJJ in deutscher Zeit (B17; „Zugang bis“ gilt bis Tagesende der Ortszeit des Admins, EP15). */
export function datumText(ms) {
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ms));
}

/** HTML-Antwort mit den Kopfzeilen aus SEITEN_KOPF (und optional weiteren, etwa Retry-After). */
export function htmlAntwort(html, status = 200, extra = {}) {
  return new Response(html, { status, headers: { ...SEITEN_KOPF, ...extra } });
}

const STIL = [
  ':root{color-scheme:light dark;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}',
  'body{margin:0;background:#f4f5f7;color:#1c1e21}',
  'main{max-width:26rem;margin:3rem auto;padding:1.5rem;background:#fff;border-radius:.75rem;box-shadow:0 1px 4px rgba(0,0,0,.12)}',
  'h1{font-size:1.4rem;margin:0 0 1rem}h2{font-size:1.05rem;margin:1.5rem 0 .5rem}',
  'label{display:block;margin:.6rem 0 .2rem;font-size:.9rem}',
  'input{box-sizing:border-box;width:100%;padding:.5rem;font-size:1rem;border:1px solid #b8bcc4;border-radius:.4rem}',
  'button,.knopf{display:inline-block;margin-top:.8rem;padding:.55rem 1rem;font-size:1rem;border:0;border-radius:.4rem;background:#1f5fbf;color:#fff;text-decoration:none;cursor:pointer}',
  '.zweit{background:#e4e6eb;color:#1c1e21}.hinweis{font-size:.9rem;color:#555}',
  '.fehler{padding:.6rem .8rem;border-radius:.4rem;background:#fde8e8;color:#8a1c1c}',
  '.warnung{padding:.6rem .8rem;border-radius:.4rem;background:#fff4e0;color:#6b4200}',
  '.code{font:600 2rem ui-monospace,Consolas,monospace;letter-spacing:.15em;margin:.5rem 0}',
  'details{margin-top:1rem}summary{cursor:pointer}',
  '@media (prefers-color-scheme:dark){body{background:#18191a;color:#e4e6eb}main{background:#242526}input{background:#18191a;color:#e4e6eb;border-color:#555}.zweit{background:#3a3b3c;color:#e4e6eb}.hinweis{color:#b0b3b8}.warnung{background:#3d2e14;color:#ffd99a}a{color:#8ab4f8}}',
].join('');

function rahmen(inhalt) {
  return (
    '<!doctype html>\n<html lang="de"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer">' +
    `<title>${fuelle('B1')}</title><style>${STIL}</style></head>\n<body><main>\n<h1>${fuelle('B2')}</h1>\n${inhalt}\n</main></body></html>\n`
  );
}

/** Beschriftetes Pflichtfeld; `id` ist je Seite eindeutig, `name` ist der Formularname. */
function feld(id, name, beschriftung, art, mehr = '') {
  return `<label for="${id}">${fuelle(beschriftung)}</label><input id="${id}" name="${name}" type="${art}" required${mehr}>`;
}

/**
 * Anmeldeseite (Spec 4.1 Schritt 2): Google (oder B6), Externe mit E-Mail und Passwort, Aufklapper für Einladungscode und
 * neues Passwort. `fehler` ist ein fertig gefüllter Text (fuelle), `email` die zuletzt eingegebene E-Mail (nie ein Passwort).
 */
export function seiteAnmelden({ vorgang, google, fehler = '', email = '', einladungOffen = false }) {
  const v = `<input type="hidden" name="v" value="${esc(vorgang)}">`;
  const emailFeld = (id) => feld(id, 'email', 'B4_email', 'email', ` autocomplete="username" value="${esc(email)}"`);
  const teile = [];
  if (fehler) teile.push(`<p class="fehler" role="alert">${fehler}</p>`);
  if (google) {
    teile.push(`<p><a class="knopf" href="/konto/google?v=${esc(encodeURIComponent(vorgang))}">${fuelle('B3_knopf')}</a></p>`);
    teile.push(`<p class="hinweis">${fuelle('B3_zeile')}</p>`);
  } else {
    teile.push(`<p class="hinweis">${fuelle('B6')}</p>`);
  }
  teile.push(`<h2>${fuelle('B4_titel')}</h2>`);
  teile.push(
    `<form method="post" action="/konto/passwort">${v}${emailFeld('email')}` +
      `${feld('passwort', 'passwort', 'B4_passwort', 'password', ' autocomplete="current-password"')}` +
      `<button type="submit">${fuelle('B4_knopf')}</button></form>`,
  );
  teile.push(
    `<details${einladungOffen ? ' open' : ''}><summary>${fuelle('B5_auf')}</summary>` +
      `<form method="post" action="/konto/passwort">${v}${emailFeld('email2')}` +
      `${feld('einladungscode', 'einladungscode', 'B5_code', 'text', ' autocomplete="one-time-code"')}` +
      `${feld('neu', 'neu', 'B5_neu', 'password', ' minlength="10" autocomplete="new-password"')}` +
      `${feld('neu2', 'neu2', 'B5_neu2', 'password', ' minlength="10" autocomplete="new-password"')}` +
      `<button type="submit">${fuelle('B5_knopf')}</button></form></details>`,
  );
  return rahmen(teile.join('\n'));
}

/**
 * Bestätigungsseite (Spec 4.1 Schritte 3–4): E-Mail, Code, Rechnername, Ja/Nein mit Seitentoken im Formular. Z2: der Rechnername nur
 * als B25 („vom Rechner gemeldet“), der Warnsatz B24 direkt über „Ja, das ist mein Rechner“.
 */
export function seiteBestaetigen({ vorgang, seitenToken, email, code, rechnerName }) {
  return rahmen(
    [
      `<p>${fuelle('B7_als', { 'E-Mail': email })}</p>`,
      `<p>${fuelle('B7_frage')}</p>`,
      `<p class="code">${fuelle('B7_code', { Code: code })}</p>`,
      // Z2 Fixrunde 1 (AR91 Nr. 4): ein nach der Erlaubnisliste leerer Name erscheint als B27.
      `<p>${rechnerName ? fuelle('B25', { Name: rechnerName }) : fuelle('B27')}</p>`,
      `<p class="warnung" role="note">${fuelle('B24')}</p>`,
      '<form method="post" action="/konto/bestaetigen">' +
        `<input type="hidden" name="v" value="${esc(vorgang)}"><input type="hidden" name="t" value="${esc(seitenToken)}">` +
        `<button type="submit" name="antwort" value="ja">${fuelle('B7_ja')}</button> ` +
        `<button type="submit" name="antwort" value="nein" class="zweit">${fuelle('B7_nein')}</button></form>`,
    ].join('\n'),
  );
}

/**
 * Z2 Fixrunde 1 (OE6): Seite nach „Ja“: B26 und darunter ein Formular `method="post"` an den Rückkanal (rueckZiel) mit den versteckten
 * Feldern `v` und `e` und dem Knopf B29. Kein Skript, kein meta refresh, kein automatischer Sprung: der Einmalwert steht nie in einer
 * Adresszeile, im Verlauf oder in einem Location-Kopf. v und e werden für HTML maskiert; ein Port außerhalb 1024–65535 (oder keine
 * ganze Zahl) ergibt keine Seite (Fehler, die Route zeigt dann „interner Fehler“).
 */
export function seiteWeiter({ port, vorgang, e }) {
  const ziel = rueckZiel(port);
  if (ziel === null) throw new Error('Port des Rückkanals ungültig');
  return rahmen(
    [
      `<p>${fuelle('B26')}</p>`,
      `<form method="post" action="${esc(ziel)}"><input type="hidden" name="v" value="${esc(vorgang)}"><input type="hidden" name="e" value="${esc(e)}">` +
        `<button type="submit">${fuelle('B29')}</button></form>`,
    ].join('\n'),
  );
}

/** Seite mit einer Meldung (B8–B11, B22, S5, „interner Fehler“). `text` ist fertig gefüllt (fuelle oder esc). */
export function seiteMeldung({ text, fehler = false }) {
  return rahmen(`<p${fehler ? ' class="fehler" role="alert"' : ''}>${text}</p>`);
}

// Anmeldeseite im Browser (Anmeldung im Launcher, Plan Teil 1, P17; Spec 4.1 Schritte 2–4, 4; EP5). Texte B1–B23 wörtlich aus
// der Texttabelle 9.5 (Platzhalter ‹…› füllt `fuelle`, jeder Wert escaped).
//
// Die Seiten haben KEIN Skript und setzen KEIN Cookie: Anmelden und Bestätigen laufen über Formulare (POST an denselben
// Worker), der Vorgang steht als verstecktes Feld im Formular, das Seitentoken nur im Bestätigungsformular, nie im Link
// (EP5). Jeder Wert aus Anfrage oder Speicher (E-Mail, Name, Rechnername, Code, Vorgang) geht durch `esc`. Kopfzeilen nach
// Vertrag 10.1: CSP ohne Skript, no-store, no-referrer, nosniff. Rein: kein Import, keine Konsole.

/** Texttabelle 9.5 (B1–B23), wörtlich; ‹E-Mail›, ‹Code›, ‹Rechnername›, ‹n›, ‹Datum› sind Platzhalter. */
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
  B7_rechner: 'Rechner: ‹Rechnername›',
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
});

/** Kopfzeilen jeder HTML-Seite (Vertrag 10.1). */
export const SEITEN_KOPF = Object.freeze({
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
});

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
  '.code{font:600 2rem ui-monospace,Consolas,monospace;letter-spacing:.15em;margin:.5rem 0}',
  'details{margin-top:1rem}summary{cursor:pointer}',
  '@media (prefers-color-scheme:dark){body{background:#18191a;color:#e4e6eb}main{background:#242526}input{background:#18191a;color:#e4e6eb;border-color:#555}.zweit{background:#3a3b3c;color:#e4e6eb}.hinweis{color:#b0b3b8}}',
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

/** Bestätigungsseite (Spec 4.1 Schritte 3–4): E-Mail, Code, Rechnername, Ja/Nein mit Seitentoken im Formular. */
export function seiteBestaetigen({ vorgang, seitenToken, email, code, rechnerName }) {
  return rahmen(
    [
      `<p>${fuelle('B7_als', { 'E-Mail': email })}</p>`,
      `<p>${fuelle('B7_frage')}</p>`,
      `<p class="code">${fuelle('B7_code', { Code: code })}</p>`,
      `<p>${fuelle('B7_rechner', { Rechnername: rechnerName })}</p>`,
      '<form method="post" action="/konto/bestaetigen">' +
        `<input type="hidden" name="v" value="${esc(vorgang)}"><input type="hidden" name="t" value="${esc(seitenToken)}">` +
        `<button type="submit" name="antwort" value="ja">${fuelle('B7_ja')}</button> ` +
        `<button type="submit" name="antwort" value="nein" class="zweit">${fuelle('B7_nein')}</button></form>`,
    ].join('\n'),
  );
}

/** Seite mit einer Meldung (B8–B11, B22, S5, „interner Fehler“). `text` ist fertig gefüllt (fuelle oder esc). */
export function seiteMeldung({ text, fehler = false }) {
  return rahmen(`<p${fehler ? ' class="fehler" role="alert"' : ''}>${text}</p>`);
}

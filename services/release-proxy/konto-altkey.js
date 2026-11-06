// Anmeldung im Launcher (Teil 1) · Merker für die Alt-Key-Zählung (Z1-W1, Gesamtprüfung Minor 4).
// Ein alter Launcher schickt mit dem alten PROXY_KEY viele Anfragen am Tag. Der Konten-DO ist EINE Instanz und zählt je Tag,
// Gruppe und Plattform; ohne Bremse ginge jede Anfrage als DO-Aufruf dorthin. Darum merkt sich dieses Isolat, für welchen
// IP-Hash es Tag und Gruppe schon gemeldet hat, und ruft den DO höchstens einmal je IP-Hash, Tag und Gruppe.
// Der Merker lebt nur im Speicher des Isolats (modulweit, wie der 60-s-Speicher des Selbst-Updates): ein neues Isolat meldet
// einmal mehr, das ist gewollt und genau genug für eine Zählung alter Launcher. Obergrenze 1000 Einträge, der älteste fliegt.
// Nur benannte Exporte, keine Konsole, kein Import.

export const ALTKEY_MERKER_MAX = 1000;

const gemeldet = new Set();

/** `true`, wenn dieser Schlüssel (Tag, Gruppe, IP-Hash) neu ist und jetzt gemeldet werden soll; merkt ihn sich. */
export function altKeyNeu(schluessel) {
  if (gemeldet.has(schluessel)) return false;
  gemeldet.add(schluessel);
  // Ein Set behält die Einfügereihenfolge: der erste Eintrag ist der älteste.
  if (gemeldet.size > ALTKEY_MERKER_MAX) gemeldet.delete(gemeldet.values().next().value);
  return true;
}

/** Scheitert die Meldung an den DO, wird der Schlüssel wieder freigegeben: die nächste Anfrage versucht es noch einmal. */
export function altKeyVergessen(schluessel) {
  gemeldet.delete(schluessel);
}

/** Nur für Tests: den Merker des Isolats leeren (er ist modulweit und überlebt sonst jeden Testblock). */
export function altKeyMerkerLeeren() {
  gemeldet.clear();
}

/** Nur für Tests: wie viele Schlüssel gerade gemerkt sind. */
export function altKeyMerkerGroesse() {
  return gemeldet.size;
}

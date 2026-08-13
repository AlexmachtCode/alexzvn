// Ausgabe der Bridge. ZWEI Kanaele, streng getrennt:
//   stdout - ausschliesslich JSON-Zeilen, eine Zeile ein Objekt. Maschinenkanal.
//   stderr - Klartext fuer Menschen. Landet spaeter in der Logdatei der App.
// Wer Menschentext nach stdout schreibt, zerstoert das Protokoll.
#pragma once
#include <string>

/** Schreibt genau eine Zeile JSON nach stdout und leert den Puffer sofort. */
void emitRaw(const std::string& json);

/** Klartext nach stderr. Niemals Geheimnisse hier hineingeben. */
void emitLog(const std::wstring& text);

// Herausgeloest aus jsonEscape() (Task 3, Video-Abos): video.cpp braucht UTF-8
// UND Maskierung GETRENNT - NDIlib_send_create() will einen reinen UTF-8-
// `const char*` als Quellnamen, ohne jede JSON-Maskierung, waehrend die
// video-Ereigniszeile denselben Namen MASKIERT braucht. jsonEscape() bleibt
// unten bestehen und ruft ab jetzt nur noch die beiden hier auf - das
// Verhalten bleibt dadurch Byte fuer Byte gleich zu vorher.

/** UTF-16 nach UTF-8, OHNE jede JSON-Maskierung. */
std::string toUtf8(const std::wstring& s);

/** JSON-Maskierung eines bereits UTF-8-kodierten Textes. Ohne Anfuehrungszeichen aussen herum. */
std::string jsonEscapeUtf8(const std::string& utf8);

/** UTF-16 nach UTF-8, mit JSON-Maskierung. Ohne Anfuehrungszeichen aussen herum. */
std::string jsonEscape(const std::wstring& s);

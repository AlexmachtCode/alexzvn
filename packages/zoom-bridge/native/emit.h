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

/** UTF-16 nach UTF-8, mit JSON-Maskierung. Ohne Anfuehrungszeichen aussen herum. */
std::string jsonEscape(const std::wstring& s);

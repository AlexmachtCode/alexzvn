#pragma once
#include <cstdint>
#include <vector>

/**
 * Die SDK-Seite des Tons: EIN globaler Lauscher, EINE Warteschlange.
 *
 * WARUM DIESE DATEI Sub UND g_subs NICHT KENNT: Zooms Ton-Rueckruf laeuft auf
 * einem SDK-Thread und liefert nur eine user_id. Wuerde er die Abo-Karte
 * nachschlagen, griffe er auf eine Struktur zu, die der Hauptthread laufend
 * aendert - und schlimmer: ein videoUnsubscribe baut zwar den Renderer ab und
 * stoppt damit die BILD-Rueckrufe, den TON-Rueckruf stoppt es NICHT (das
 * Ton-Abo ist global). Ein Paket fuer ein soeben abgebautes Abo ist also zu
 * erwarten, nicht die Ausnahme.
 *
 * Deshalb: der Rueckruf kopiert und kehrt zurueck. Nachschlagen und Senden
 * macht der Hauptthread (video.cpp, videoTick). g_subs bleibt damit in genau
 * einer Hand, und die Lebensdauerfrage entfaellt, statt bewacht zu werden.
 */
struct AudioPacket {
  unsigned int userId = 0;
  int sampleRate = 0;
  int channels = 0;
  int sampleCount = 0;          // Abtastwerte JE KANAL
  std::vector<int16_t> samples; // interleaved
};

/**
 * Legt das EINE globale Ton-Abo an, falls es noch nicht steht.
 *
 * Idempotent je Meeting - dasselbe Muster wie sessionStartRawRecording().
 * bWithInterpreters ist FEST false: ein true macht laut SDK-Kopfsatz die
 * lokalen Dolmetscher-Funktionen unbrauchbar und beschaedigt damit die
 * Dolmetscher-App (#208).
 *
 * Meldet audioHelperMissing bzw. audioSubscribeFailed selbst auf stdout.
 *
 * @returns false, wenn kein Ton kommen wird.
 */
bool audioEnsureSubscribed();

/** Setzt das Merkzeichen zurueck - das Ton-Abo gilt je MEETING. */
void audioClearSubscribed();

/** unSubscribe() beim Prozessende. Danach kommen keine Rueckrufe mehr. */
void audioShutdown();

/** Holt ein Paket ab. false = Warteschlange leer. */
bool audioPop(AudioPacket* out);

/**
 * Wie viele Pakete seit dem letzten Abruf verworfen wurden, und setzt den
 * Zaehler zurueck. Ein Ueberlauf ist eine Aussage ueber die MASCHINE, nicht
 * ueber einen Gast - der Rueckruf, der verwirft, weiss gar nicht, zu welchem
 * Abo das Paket gehoert haette.
 */
unsigned int audioTakeOverflowCount();

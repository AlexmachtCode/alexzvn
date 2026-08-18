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
  // Rohlaenge in BYTES, wie GetBufferLen() sie lieferte - VOR jeder Teilung.
  // Nur DIESER Wert kann beantworten, ob der Puffer ein ganzzahliges
  // Vielfaches von channels*2 war: sampleCount und samples.size() entstehen
  // beide durch DIESELBE Ganzzahl-Division von len (sampleCount = len /
  // (2*channels), samples.size() = len / 2) - ein Rest verschwindet in
  // beiden Rechnungen gleichermassen und ist aus dem Ergebnis NICHT mehr
  // rekonstruierbar. bufferLen ist die einzige Spur, die den Rest noch
  // traegt, und wird darum unveraendert mitgefuehrt, obwohl der Hauptthread
  // ihn erst beim Leeren braucht (video.cpp).
  unsigned int bufferLen = 0;
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

/**
 * Beendet den Ton fuer das laufende Meeting: MELDET AB (unSubscribe(), falls
 * die Anmeldung steht), setzt das Meeting-Merkzeichen zurueck und wirft die
 * Warteschlange weg.
 *
 * Der Name sagt "Subscribed", und genau das raeumt sie ab - BEIDE Tatsachen,
 * die frueher unter einem Merkzeichen liefen (siehe die beiden Kommentare an
 * g_abonniert/g_registriert in audio.cpp). Vorher loeschte sie nur das
 * Merkzeichen, und der Delegate blieb eingetragen.
 *
 * Scheitert die Abmeldung (kein Helfer mehr, oder das SDK meldet einen
 * Fehler), steht das auf stderr und die Anmeldung gilt weiter als stehend -
 * der naechste Weg versucht es erneut.
 */
void audioClearSubscribed();

/**
 * Prozessende. Meldet ab, wenn die Anmeldung steht - unabhaengig davon, ob
 * der Ton fuer ein Meeting noch scharf ist. Danach kommen keine Rueckrufe
 * mehr, SOFERN unSubscribe() durchgelaufen ist (schlaegt es fehl, steht das
 * auf stderr, siehe audioClearSubscribed()).
 */
void audioShutdown();

// --- BEWUSSTE ABWEICHUNG VON SPEC ABSCHNITT 4 ------------------------------
/*
 * Hier BENANNT statt still gelassen (Schlusspruefung Stage 3, Critical 2,
 * Ausfall C).
 *
 * In Spec Abschnitt 4 steht: "unSubscribe() beim Abbau des LETZTEN Abos bzw. beim
 * Prozessende." Umgesetzt ist nur die zweite Haelfte: die Anmeldung faellt
 * beim MEETING-ENDE (audioClearSubscribed(), auch aus callbacks.cpp) und beim
 * Prozessende - nicht schon, wenn der Bediener mitten im Meeting das letzte
 * Zoom-Abo herausnimmt.
 *
 * WAS DAS KOSTET, unbeschoenigt: nimmt der Bediener alle Zoom-Gaeste heraus
 * und laeuft das Meeting weiter, kopiert der SDK-Thread bis zum Meeting-Ende
 * weiter je sprechendem Teilnehmer etwa alle 10-20 ms ein Paket in die
 * Warteschlange. Der Tick leert sie weiter, findet kein Abo und wirft alles
 * weg (Spec Abschnitt 5 nennt genau das "die richtige Antwort"). Es ist also
 * verschenkte Kopierarbeit auf zwei Threads - kein Wachsen, kein Ueberlauf,
 * kein falsches Ereignis.
 *
 * WARUM SO ENTSCHIEDEN: die Freigabe beim letzten Abo braucht den Rueckweg
 * subscribe() -> unSubscribe() -> subscribe() INNERHALB desselben Meetings,
 * und dass Zoom den mitmacht, ist nirgends gemessen. Macht er ihn nicht, ist
 * der Preis ungleich hoeher als die Kopierarbeit: das naechste videoSubscribe
 * bekaeme audioSubscribeFailed, jedes Abo meldete off/audioUnavailable, und
 * das bleibt fuer dieses Abo ENDGUELTIG (nichts versucht es erneut) - eine
 * stumme Sendung als Preis fuer eingespartes Kopieren. Sobald der Rueckweg am
 * echten Meeting gemessen ist, gehoert die Freigabe beim letzten Abo
 * nachgezogen; bis dahin steht sie hier als Abweichung, nicht als Luecke.
 */

/** Holt ein Paket ab. false = Warteschlange leer. */
bool audioPop(AudioPacket* out);

/**
 * Nimmt den Ueberlauf-Bericht ab - HOECHSTENS EINMAL je Meeting.
 *
 * Ein Ueberlauf ist eine Aussage ueber die MASCHINE, nicht ueber einen Gast:
 * der Rueckruf, der verwirft, weiss gar nicht, zu welchem Abo das Paket
 * gehoert haette. Darum traegt die Meldung keine id.
 *
 * EINMAL JE MEETING, nicht je Tick (Spec Abschnitt 5: "im Tick einmal ...,
 * danach erst wieder nach dem Zuruecksetzen beim Meeting-Ende"). Bei einem
 * anhaltenden Ueberlauf schrieb die fruehere Fassung bis zu 100 Zeilen je
 * Sekunde auf stdout und ertraenkte damit jede andere Ausgabe - genau der
 * Effekt, den dasselbe Merkmal bei videoBufferMismatch je Abo vermeidet. Das
 * Merkzeichen setzt audioClearSubscribed() zurueck, wie das Ton-Abo selbst.
 *
 * Der Zaehler wird NUR genommen (und zurueckgesetzt), wenn auch gemeldet
 * wird - eine Messung abzuholen und wegzuwerfen waere schlimmer als sie
 * stehen zu lassen. Nach der einen Meldung laeuft er darum unbeachtet weiter
 * bis zum Meeting-Ende.
 *
 * @param dropped traegt bei true, WIE VIELE Pakete bis zu dieser Meldung
 *                verworfen wurden. Was danach noch verlorengeht, steht in
 *                keiner Zahl - und diese behauptet es auch nicht.
 * @returns true = jetzt melden.
 */
bool audioTakeOverflowReport(unsigned int* dropped);

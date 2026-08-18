#include "audio.h"
#include <atomic>
#include <cstring>
#include <deque>
#include <mutex>
#include "emit.h"
// DIESELBE UEBERSETZUNGSFALLE wie in video.h/session.h, hier GEMESSEN statt
// vermutet (`npm run rebuild -w @jm/zoom-bridge` brach ohne diese Zeile mit
// derselben C3646/C4430/C2872-Kaskade in zoom_sdk_def.h ab): unter WIN32
// setzt dieser Header HWND als bereits bekannt voraus und typedef't es selbst
// nur im Nicht-WIN32-Zweig. audio.h bleibt bewusst frei von jedem
// Zoom-Include (siehe dort) - windows.h muss darum HIER stehen, vor dem
// ersten Zoom-Header dieser Datei.
#include <windows.h>
#include "rawdata/zoom_rawdata_api.h"
#include "rawdata/rawdata_audio_helper_interface.h"
#include "zoom_sdk_raw_data_def.h"

USING_ZOOM_SDK_NAMESPACE

namespace {

// 256 Plaetze zu je 4 KB (1 MB). Die Auslegungsrechnung aus Spec Abschnitt 5:
// bei 5 Sprechern, 32 kHz Mono und 10-ms-Paketen rund 500 Pakete je Sekunde,
// der Vorrat reicht also gut eine halbe Sekunde, waehrend alle 10 ms geleert
// wird.
//
// WORAUF DIESE RECHNUNG BERUHT, ehrlich benannt (Schlusspruefung Stage 3,
// Important 5): die 5 der Betriebsgroesse sind 5 ABOS, nicht 5 Anwesende.
// onOneWayAudioRawDataReceived haengt an einem GLOBALEN Abo und feuert fuer
// JEDEN sprechenden Teilnehmer im Meeting - auch fuer die, die niemand
// abonniert hat. Die halbe Sekunde gilt darum nur, solange hoechstens fuenf
// Teilnehmer GLEICHZEITIG SPRECHEN. In einem Meeting mit dreissig Personen
// und mehreren offenen Mikrofonen ist die Ankunftsrate ein Vielfaches, und
// aus der halben Sekunde wird ein Bruchteil.
//
// UNGEMESSEN: Zooms tatsaechliche Paketrate (Groesse UND Takt) ist auf diesem
// Zweig nirgends gemessen - weder je Sprecher noch in Summe. Die 10 ms und
// die 32 kHz Mono stammen aus der Spec-Auslegung, nicht aus einer Messung an
// einem echten Meeting; sie gehoeren auf die Owner-Abnahmeliste (README,
// docs/roadmap.md). Wer diese Zahl anfasst, aendert Betriebswirtschaft: zu
// klein heisst audioQueueOverflow bei jedem Hakler, zu gross heisst, dass ein
// echter Haenger Sekunden alten Ton aufhebt, den niemand mehr hoeren will.
constexpr size_t kMaxPakete = 256;

std::mutex g_queueMutex;
std::deque<AudioPacket> g_queue;
std::atomic<unsigned int> g_verworfen{0};

// ZWEI TATSACHEN, ZWEI MERKZEICHEN (Schlusspruefung Stage 3, Critical 2).
// Vorher liefen sie unter EINEM Namen - und gingen auf dem HAEUFIGSTEN Weg
// auseinander:
//
//   g_abonniert   - "der Ton ist fuer DIESES Meeting scharf". Gilt je
//                   Meeting, genau wie sessionStartRawRecording(). Nur
//                   audioEnsureSubscribed() fragt es, um nicht zweimal zu
//                   abonnieren.
//   g_registriert - "das SDK haelt unseren Delegate". Eine Tatsache ueber das
//                   SDK, nicht ueber das Meeting: sie wird erst falsch, wenn
//                   unSubscribe() TATSAECHLICH durchgelaufen ist.
//
// Der Unterschied ist nicht theoretisch. Der Gastgeber beendet das Meeting ->
// MEETING_STATUS_ENDED -> audioClearSubscribed(): "nicht mehr scharf" stimmt
// dann, "das SDK haelt unseren Delegate nicht mehr" stimmte NICHT. Haenge man
// die Abmeldung beim Prozessende an g_abonniert, wird sie genau dann
// uebersprungen, wenn sie noetig ist - CleanUPSDK() liefe, waehrend
// &g_delegate noch eingetragen ist. Das ist dieselbe Reihenfolge, die beim
// Bild als 0xC0000005 GEMESSEN wurde (siehe den Kommentar an
// videoShutdownAll() in main.cpp).
std::atomic<bool> g_abonniert{false};
std::atomic<bool> g_registriert{false};

// "Der Ueberlauf ist fuer dieses Meeting gemeldet." Gilt je Meeting, genau
// wie g_abonniert, und wird an derselben Stelle zurueckgesetzt - siehe
// audioTakeOverflowReport() in audio.h fuer die Begruendung.
std::atomic<bool> g_ueberlaufGemeldet{false};

class AudioDelegate : public IZoomSDKAudioRawDataDelegate {
 public:
  // NICHT GENUTZT, aber Pflicht: die Schnittstelle ist rein virtuell. Der
  // Mischton, der Bildschirmton und der Dolmetscherton stehen ausdruecklich
  // NICHT im Umfang (Spec Abschnitt 10) - leere Rumpfe sind hier die
  // ehrliche Umsetzung, kein Versehen.
  void onMixedAudioRawDataReceived(AudioRawData* /*data*/) override {}
  void onShareAudioRawDataReceived(AudioRawData* /*data*/, uint32_t /*userId*/) override {}
  void onOneWayInterpreterAudioRawDataReceived(AudioRawData* /*data*/, const zchar_t* /*lang*/) override {}

  void onOneWayAudioRawDataReceived(AudioRawData* data, uint32_t userId) override {
    if (data == nullptr) return;
    const char* buf = data->GetBuffer();
    const unsigned int len = data->GetBufferLen();
    const int rate = static_cast<int>(data->GetSampleRate());
    const int ch = static_cast<int>(data->GetChannelNum());
    if (buf == nullptr || len == 0 || rate <= 0 || ch <= 0) return;

    AudioPacket p;
    p.userId = userId;
    p.sampleRate = rate;
    p.channels = ch;
    // Die Pufferpruefung (Vielfaches von channels*2) macht der HAUPTTHREAD
    // beim Leeren, nicht hier: "einmal je Abo" braucht ein Merkzeichen am
    // Sub, und genau das darf dieser Rueckruf nicht anfassen. Hier wird nur
    // so gerechnet, dass nichts ueberlaeuft.
    //
    // bufferLen VOR den beiden Teilungen sichern (Nachbesserung): sowohl
    // sampleCount als auch samples.size() unten entstehen durch dieselbe
    // Ganzzahl-Division von len und verlieren dabei einen etwaigen Rest
    // GLEICHERMASSEN - aus den beiden Ergebnissen laesst sich danach nicht
    // mehr rekonstruieren, ob len ein ganzzahliges Vielfaches von channels*2
    // war. Nur len selbst traegt diese Information noch.
    p.bufferLen = len;
    p.sampleCount = static_cast<int>(len / (sizeof(int16_t) * static_cast<unsigned int>(ch)));
    p.samples.resize(len / sizeof(int16_t));
    std::memcpy(p.samples.data(), buf, p.samples.size() * sizeof(int16_t));

    std::lock_guard<std::mutex> lock(g_queueMutex);
    // DAS AELTESTE fliegt raus, nicht das neue: verspaeteter Ton ist wertlos.
    while (g_queue.size() >= kMaxPakete) {
      g_queue.pop_front();
      g_verworfen.fetch_add(1);
    }
    g_queue.push_back(std::move(p));
  }
};

// Prozesslang. Damit hat der Lauscher SELBST keine Lebensdauerfrage - nur die
// Abos haben eine, und die loest der Weg ueber die Warteschlange.
AudioDelegate g_delegate;

// DIE EINZIGE STELLE, DIE unSubscribe() RUFT - und darum die einzige, die
// g_registriert loeschen darf. Alles andere fragt nur.
//
// Idempotent: steht keine Anmeldung, kehrt sie sofort zurueck. Deshalb kann
// jeder Abbauweg sie bedenkenlos rufen.
void audioAbmelden() {
  if (!g_registriert.load()) return;
  IZoomSDKAudioRawDataHelper* helper = GetAudioRawdataHelper();
  if (helper == nullptr) {
    // NICHTS VERSCHWINDET STILL - aber auf stderr, nicht auf stdout: ein
    // Aufrufer kann daran nichts aendern (das Meeting ist weg oder das SDK
    // nicht mehr bereit), und einen Fehlerschluessel dafuer gibt es
    // ausdruecklich nicht. g_registriert bleibt STEHEN, damit der naechste
    // Weg (Prozessende) es erneut versucht - ein geloeschtes Merkzeichen
    // waere hier die Luege, die Critical 2 ueberhaupt erst erzeugt hat.
    emitLog(L"Ton-Abmeldung nicht moeglich: GetAudioRawdataHelper() gab nichts heraus. Der Delegate bleibt eingetragen.");
    return;
  }
  const SDKError err = helper->unSubscribe();
  if (err != SDKERR_SUCCESS) {
    emitLog(std::wstring(L"Zoom-SDK meldet einen Fehler bei unSubscribe() fuer den Ton: SDKError=") +
            std::to_wstring(static_cast<int>(err)));
    // Wieder: Merkzeichen STEHEN LASSEN. Die Abmeldung hat nicht
    // stattgefunden, also darf nichts behaupten, sie haette.
    return;
  }
  g_registriert = false;
}

}  // namespace

bool audioEnsureSubscribed() {
  if (g_abonniert.load()) return true;
  // Eine noch STEHENDE Anmeldung zuerst freigeben. Im Normalfall ist das ein
  // Rueckkehrbefehl (das Meeting-Ende hat sie bereits geloest), scharf wird
  // die Zeile nur, wenn die Freigabe dort fehlgeschlagen ist: dann waere ein
  // zweites subscribe() ueber eine bestehende Anmeldung der Weg, auf dem ein
  // zweites Meeting im selben Prozess allen Ton verlieren kann (Schluss-
  // pruefung, Critical 2, Ausfall B).
  audioAbmelden();
  IZoomSDKAudioRawDataHelper* helper = GetAudioRawdataHelper();
  if (helper == nullptr) {
    emitRaw("{\"ev\":\"error\",\"where\":\"audio\",\"code\":\"audioHelperMissing\"}");
    return false;
  }
  // false: siehe audio.h - schuetzt die Dolmetscher-App (#208).
  const SDKError err = helper->subscribe(&g_delegate, false);
  if (err != SDKERR_SUCCESS) {
    emitLog(std::wstring(L"Zoom-SDK meldet einen Fehler bei subscribe() fuer den Ton: SDKError=") +
            std::to_wstring(static_cast<int>(err)));
    emitRaw("{\"ev\":\"error\",\"where\":\"audio\",\"code\":\"audioSubscribeFailed\"}");
    return false;
  }
  // ERST die Tatsache ueber das SDK, dann die ueber das Meeting - in dieser
  // Reihenfolge, weil ab dem geglueckten subscribe() der Delegate eingetragen
  // IST, ganz gleich, was danach noch passiert.
  g_registriert = true;
  g_abonniert = true;
  return true;
}

void audioClearSubscribed() {
  // MELDET AB, statt nur ein Merkzeichen zu loeschen (Schlusspruefung,
  // Critical 2). Von den beiden vertretbaren Formen - hier abmelden, oder
  // callbacks.cpp eine zweite Funktion rufen lassen - ist DIESE gewaehlt,
  // damit es genau EINE Stelle gibt, an der die Anmeldung faellt: jeder Weg,
  // der ein Meeting beendet, laeuft ohnehin hier durch (callbacks.cpp beim
  // MEETING_STATUS_ENDED/FAILED, audioShutdown() beim leave/quit/EOF). Eine
  // zweite Funktion daneben waere eine zweite Buchfuehrung derselben
  // Tatsache, und die zweite geht irgendwann nicht mit.
  //
  // UNGEMESSEN und darum benannt: dass unSubscribe() INNERHALB des
  // Status-Rueckrufs (also im pumpOnce()-Aufruf des Hauptthreads) sicher ist,
  // ist fuer den TON nirgends gemessen. Fuer das BILD ist derselbe Schritt an
  // derselben Stelle am 2026-08-13 ohne Absturz durchgelaufen (siehe
  // videoMeetingEnded() in video.cpp) - das ist ein Vorbild, kein Beleg.
  audioAbmelden();
  g_abonniert = false;
  // Das naechste Meeting darf seinen eigenen Ueberlauf wieder melden.
  g_ueberlaufGemeldet = false;
  std::lock_guard<std::mutex> lock(g_queueMutex);
  // Pakete aus einem beendeten Meeting gehoeren niemandem mehr.
  g_queue.clear();
  g_verworfen = 0;
}

void audioShutdown() {
  // Derselbe Abbau wie beim Meeting-Ende, und ABSICHTLICH ohne eigene
  // Bedingung: die Abmeldung haengt in audioAbmelden() an g_registriert
  // ("haelt das SDK unseren Delegate?") und NICHT an g_abonniert ("ist der
  // Ton fuer dieses Meeting scharf?"). Genau darum greift sie auch auf dem
  // haeufigsten Weg - Gastgeber beendet das Meeting, danach quit -, auf dem
  // g_abonniert laengst false ist und die Abmeldung frueher ausfiel.
  audioClearSubscribed();
}

bool audioPop(AudioPacket* out) {
  if (out == nullptr) return false;
  std::lock_guard<std::mutex> lock(g_queueMutex);
  if (g_queue.empty()) return false;
  *out = std::move(g_queue.front());
  g_queue.pop_front();
  return true;
}

bool audioTakeOverflowReport(unsigned int* dropped) {
  if (dropped == nullptr) return false;
  // ERST das Merkzeichen fragen, DANN den Zaehler nehmen (siehe audio.h):
  // audioTakeOverflowCount() setzte frueher bei jedem Tick zurueck, auch wenn
  // niemand meldete - eine Messung, die genommen und weggeworfen wird.
  if (g_ueberlaufGemeldet.load()) return false;
  const unsigned int n = g_verworfen.exchange(0);
  if (n == 0) return false;
  g_ueberlaufGemeldet = true;
  *dropped = n;
  return true;
}

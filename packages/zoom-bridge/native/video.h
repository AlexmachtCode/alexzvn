#pragma once
#include <string>
// ABWEICHUNG VOM BRIEF-WORTLAUT, GEMESSEN: dieselbe Uebersetzungsfalle wie in
// session.h/callbacks.h - zoom_sdk_def.h setzt HWND unter WIN32 als bereits
// bekannt voraus und typedef't es selbst nur im Nicht-WIN32-Zweig. video.cpp
// bindet video.h als ERSTEN Header ein (siehe dort), dieser Header muss darum
// selbst dafuer sorgen, dass windows.h VOR jedem Zoom-Header steht - ohne
// diese Zeile bricht der Bau mit derselben C3646/C4430/C2872-Kaskade ab, die
// dort bereits dokumentiert ist (hier tatsaechlich reproduziert: `npm run
// rebuild -w @jm/zoom-bridge` scheiterte ohne diese Zeile an genau dieser
// Kaskade in video.cpp).
#include <windows.h>
#include "zoom_sdk.h"
#include "rawdata/rawdata_renderer_interface.h"
// Die Entscheidungslogik der Slots (reine Logik ohne SDK, Plan A Block a2):
// Modus, Ersatzbild, Ton, Gruende und Plaene. Die Enums dort sind die
// Arbeitsnamen aus Spec 6.1 (A-EP10). GEMESSEN: windows.h (oben, ohne NOMINMAX)
// definiert die Makros min und max - ein std::min/std::max in der reinen Logik bricht
// dann mit C2589 ab. Die Makros gelten darum fuer diesen einen Include nicht.
#pragma push_macro("min")
#pragma push_macro("max")
#undef min
#undef max
#include "slot_logic.h"
#pragma pop_macro("max")
#pragma pop_macro("min")

USING_ZOOM_SDK_NAMESPACE

// --- Slots (Spec 6.1-6.3, E1) ------------------------------------------------------
// Ein Slot ist ein fester NDI-Sender mit einer Nummer 1..16. Er zeigt im Modus
// Teilnehmer eine Person, im Modus Aktiver Sprecher den Sprecher, im Modus
// Bildschirmfreigabe die gezeigte Freigabe. g_slots (video.cpp) schreibt NUR der
// Hauptthread; Rueckrufe fassen nur Atome, fieldMutex-Felder und die Kopie an.

/** slotOn, Felder fertig geprueft (Pruefung 1-7, main.cpp). */
struct SlotBefehl {
  int nr = 0;
  std::string ndi;                 // UTF-8, nach pruefeNdiName gueltig
  slotlogic::SlotMode mode = slotlogic::SlotMode::Participant;
  unsigned id = 0;                 // 0 = kein Ziel (nur Modus Teilnehmer); keine Kennung ist 0: ANNAHME AN10, teils belegt
  ZoomSDKResolution res = ZoomSDKResolution_720P;
  slotlogic::SlotAudio audio = slotlogic::SlotAudio::Off;
  bool shareAudio = false;
  slotlogic::Fallback fallback = slotlogic::Fallback::Transparent;
  bool showNoVideo = true;
};

/** slotSet: nur die Felder mit ...Gesetzt = true stehen in der Zeile (alle geprueft). */
struct SlotAenderung {
  int nr = 0;
  bool modeGesetzt = false;        slotlogic::SlotMode mode = slotlogic::SlotMode::Participant;
  bool idGesetzt = false;          unsigned id = 0;
  bool resGesetzt = false;         ZoomSDKResolution res = ZoomSDKResolution_720P;
  bool audioGesetzt = false;       slotlogic::SlotAudio audio = slotlogic::SlotAudio::Off;
  bool shareAudioGesetzt = false;  bool shareAudio = false;
  bool fallbackGesetzt = false;    slotlogic::Fallback fallback = slotlogic::Fallback::Transparent;
  bool showNoVideoGesetzt = false; bool showNoVideo = true;
};

/** "360p" -> ZoomSDKResolution_360P usw.; nur die drei Stufen der Slots (6.11). false = unbekannt. */
bool slotParseResolution(const std::string& key, ZoomSDKResolution* out);

/** Gegenstueck: ZoomSDKResolution_360P -> "360p" usw. (stderr-Zeile „Felder gelesen“, Nachbesserung a3). */
const char* slotAufloesungName(ZoomSDKResolution res);

/**
 * Ein Fehler mit where:"slot" (Spec 6.4). nr = 0: ohne Feld "slot" (slotBadNumber,
 * speakerBadSignal, speakerBadHold, slotBadTarget ohne lesbare Nummer).
 */
void emitSlotFehler(const char* code, int nr);

/** Laeuft Slot nr? (Pruefung 7 slotAlreadyOn, slotSet/slotOff slotNotOn) */
bool slotLaeuft(int nr);

/**
 * Traegt ein ANDERER laufender Slot als `ausser` GENAU diesen NDI-Namen (Bytevergleich, Pruefung 3)? Der eigene
 * Slot zaehlt nicht: ein zweites slotOn mit seinem Namen ist slotAlreadyOn (Nachbesserung a1).
 */
bool slotNameBelegt(const std::string& ndi, int ausser);

/**
 * slotOn ab Pruefung 8 (Spec 6.2, Gliederung 3.2): Renderer-Sperre -> slotReconnecting,
 * Erlaubnis -> slotNoPrivilege, NDI -> ndiInitFailed, dann Aufbau
 * (slotRawRecordingFailed, slotSenderFailed, slotRendererFailed). Meldet selbst.
 */
void slotOn(const SlotBefehl& b);

/** slotSet (Spec 6.2): slotNotOn, sonst fallback, showNoVideo, Ton, hoechstens ein Umhaengen. */
void slotSet(const SlotAenderung& a);

/** slotOff (Spec 6.2): Abbau eines Slots, meldet slotAudio off und slot off mit `grund`. */
void slotOff(int nr, slotlogic::Grund grund);

/** Weggang (Merker, Hauptschleife): jeder Slot, dessen Ziel geht, haengt auf Ziel 0 um (6.7). */
void slotsParticipantLeft(unsigned id);

/**
 * Herzschlag (Spec 6.6 Nr. 6): Ton-Zuordnung, Stille, Ersatzbild und Halten,
 * Gruende nach 200 ms ohne Bild. Von der Hauptschleife je Durchlauf.
 */
void slotsTick();

/** Alle Slots ab, Meeting lebt (leave/quit/EOF). VOR sessionLeave()/sessionShutdown(). */
void slotsShutdownAll();

/** Alle Slots ab, weil das Meeting zu Ende ist (ENDED/FAILED): ohne Renderer-Aufruf. */
void slotsMeetingEnded();

/** Alle Slots ab, weil die Aufnahme-Erlaubnis entzogen ist (Stage 4b, N4b.1). Nie aus einem Rueckruf. */
void slotsPrivilegeRevoked();

// --- Sprecher und Freigaben (Spec 6.8, 6.9; Merker aus callbacks.h) ------------------
struct MerkerFreigabe;
struct MerkerSprecher;

/** Obergrenze der Haltezeit (speakerConfig holdMs, SPEAKER_HOLD_MAX_MS in src/protocol.ts). */
constexpr long long kSpeakerHoldMaxMs = 5000;

/** Kamera-Merker: meldet videoStatus (0.18) und merkt "Kamera aus laut Zoom" am Ziel (6.7). */
void slotsKamera(unsigned id, int videoStatus);

/** Freigabe-Merker: Liste fuettern (6.9), Rueckruf in recent, shares melden. */
void slotsFreigabe(const MerkerFreigabe& f);

/** Sprecher-Merker: speakerSignal melden, Erinnerung und jede SprecherWahl fuettern (6.8). */
void slotsSprecher(const MerkerSprecher& m);

/** INMEETING-Merker: Erinnerung leeren, Freigaben leeren und befuellen, jeden Slot neu zuordnen (6.15). */
void slotsInMeeting();

/** speakerConfig (6.2): gilt sofort fuer alle Sprecher-Slots; meldet die Bestaetigung. */
void slotsSprecherEinstellung(slotlogic::Signal signal, int64_t holdMs);

/**
 * Schritt 5 der Hauptschleife (6.6): Haltezeiten, Wechsel der gezeigten Freigabe,
 * Wiederholungen nach 18/29, vorgemerkte Umhaengungen.
 */
void slotLogicTick(int64_t jetzt);

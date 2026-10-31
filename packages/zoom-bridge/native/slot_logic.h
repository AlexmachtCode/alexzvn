#pragma once
// Entscheidungslogik der Zoom-Slots (Connect 0.4.0, Spec 6.1 und 6.8-6.15).
//
// REINE LOGIK: nur die C++-Standardbibliothek, kein Zoom-, NDI- oder Windows-Header (G-A2; ein
// Quelltext-Waechter in test/selftest.ts prueft die Einbindungen). Jede Zeit kommt als int64_t in
// Millisekunden von aussen (Muster delay_line.h:19-27). Darum laeuft native/slot_logic_test.cpp ohne
// Meeting, ohne SDK und auch unter Linux (npm run logik-test, CI-Job selftests).
//
// Die Aufzaehlungen folgen in Reihenfolge und Schreibweise den Katalogen in src/protocol.ts; jede hat eine
// Namens-Tabelle gleicher Laenge. test/selftest.ts gleicht Aufzaehlung, Tabelle und Katalog ab (A-EP10).
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <string>
#include <vector>

namespace slotlogic {

// ---- Aufzaehlungen und Namen (Gliederung 3.1; Task A4) ----------------------------------------------------

enum class SlotMode : uint8_t { Participant, Speaker, Share };                     // SLOT_MODES
enum class Fallback : uint8_t { Transparent, Freeze, Black, White };               // SLOT_FALLBACKS
enum class SlotAudio : uint8_t { Off, Mix, Person };                               // SLOT_AUDIO_SETTINGS
enum class Sent : uint8_t { None, Transparent, Freeze, Black, White, Held };       // SLOT_SENT
enum class SlotState : uint8_t { Starting, Live, Fallback, Held, Off };            // SLOT_STATES
enum class Grund : uint8_t {                                                       // SLOT_REASONS (20)
  command, frames, noTarget, participantLeft, cameraOff, noFrames, speakerNone, speakerNoVideo,
  speakerChanged, shareNone, sharePaused, shareStill, shareChanged, targetChanged, modeChanged,
  resolutionChanged, bufferMismatch, subscribeFailed, meetingEnded, privilegeRevoked
};
enum class TonGrund : uint8_t {                                                    // SLOT_AUDIO_REASONS (12)
  command, packets, gap, audioUnavailable, participantLeft, personNotInMode, noShare, rateMismatch,
  targetChanged, modeChanged, meetingEnded, privilegeRevoked
};
enum class TonQuelle : uint8_t { Mix, Person, Share, MixShare, None };             // SLOT_AUDIO_SOURCES
enum class TonZustand : uint8_t { Waiting, Live, Silent, Off };                    // AUDIO_STATES
enum class Signal : uint8_t { SpeakerVideo, ActiveVideo, ActiveAudio };            // SPEAKER_SIGNALS

inline constexpr const char* MODUS_NAMEN[3] = {"participant", "speaker", "share"};
inline constexpr const char* FALLBACK_NAMEN[4] = {"transparent", "freeze", "black", "white"};
inline constexpr const char* AUDIO_NAMEN[3] = {"off", "mix", "person"};
inline constexpr const char* SENT_NAMEN[6] = {"none", "transparent", "freeze", "black", "white", "held"};
inline constexpr const char* ZUSTAND_NAMEN[5] = {"starting", "live", "fallback", "held", "off"};
inline constexpr const char* GRUND_NAMEN[20] = {
  "command", "frames", "noTarget", "participantLeft", "cameraOff", "noFrames", "speakerNone", "speakerNoVideo",
  "speakerChanged", "shareNone", "sharePaused", "shareStill", "shareChanged", "targetChanged", "modeChanged",
  "resolutionChanged", "bufferMismatch", "subscribeFailed", "meetingEnded", "privilegeRevoked"
};
inline constexpr const char* TONGRUND_NAMEN[12] = {
  "command", "packets", "gap", "audioUnavailable", "participantLeft", "personNotInMode", "noShare", "rateMismatch",
  "targetChanged", "modeChanged", "meetingEnded", "privilegeRevoked"
};
inline constexpr const char* TONQUELLE_NAMEN[5] = {"mix", "person", "share", "mixShare", "none"};
inline constexpr const char* TONZUSTAND_NAMEN[4] = {"waiting", "live", "silent", "off"};
inline constexpr const char* SIGNAL_NAMEN[3] = {"speakerVideo", "activeVideo", "activeAudio"};

// Jede Tabelle hat genau so viele Eintraege, wie ihre Aufzaehlung Werte hat (der letzte Wert + 1).
static_assert(static_cast<int>(SlotMode::Share) + 1 == 3, "MODUS_NAMEN");
static_assert(static_cast<int>(Fallback::White) + 1 == 4, "FALLBACK_NAMEN");
static_assert(static_cast<int>(SlotAudio::Person) + 1 == 3, "AUDIO_NAMEN");
static_assert(static_cast<int>(Sent::Held) + 1 == 6, "SENT_NAMEN");
static_assert(static_cast<int>(SlotState::Off) + 1 == 5, "ZUSTAND_NAMEN");
static_assert(static_cast<int>(Grund::privilegeRevoked) + 1 == 20, "GRUND_NAMEN");
static_assert(static_cast<int>(TonGrund::privilegeRevoked) + 1 == 12, "TONGRUND_NAMEN");
static_assert(static_cast<int>(TonQuelle::None) + 1 == 5, "TONQUELLE_NAMEN");
static_assert(static_cast<int>(TonZustand::Off) + 1 == 4, "TONZUSTAND_NAMEN");
static_assert(static_cast<int>(Signal::ActiveAudio) + 1 == 3, "SIGNAL_NAMEN");

inline const char* name(SlotMode v) { return MODUS_NAMEN[static_cast<int>(v)]; }
inline const char* name(Fallback v) { return FALLBACK_NAMEN[static_cast<int>(v)]; }
inline const char* name(SlotAudio v) { return AUDIO_NAMEN[static_cast<int>(v)]; }
inline const char* name(Sent v) { return SENT_NAMEN[static_cast<int>(v)]; }
inline const char* name(SlotState v) { return ZUSTAND_NAMEN[static_cast<int>(v)]; }
inline const char* name(Grund v) { return GRUND_NAMEN[static_cast<int>(v)]; }
inline const char* name(TonGrund v) { return TONGRUND_NAMEN[static_cast<int>(v)]; }
inline const char* name(TonQuelle v) { return TONQUELLE_NAMEN[static_cast<int>(v)]; }
inline const char* name(TonZustand v) { return TONZUSTAND_NAMEN[static_cast<int>(v)]; }
inline const char* name(Signal v) { return SIGNAL_NAMEN[static_cast<int>(v)]; }

// ---- Aktiver Sprecher (Spec 6.8, E19; Task A4) -----------------------------------------------------------

/** „Hat Kamera an“ fuer eine Kennung; die Hauptschleife fragt IUserInfo::IsVideoOn() (6.8 Regel 3). */
using KameraAn = std::function<bool(unsigned id)>;

/**
 * Eine je Bridge. Haelt je Signal das zuletzt gemeldete Ergebnis mit Zeit (speakerVideo/activeVideo: die
 * Kennung, activeAudio: die Liste). Gefuettert von JEDEM Signal, auch ohne Sprecher-Slot: die Rueckrufe melden
 * nur Wechsel, und einen Getter fuer den aktuellen Sprecher gibt es nicht (6.8).
 * Leeren bei INMEETING, Meeting-Ende, leave, quit und EOF, NICHT beim Entzug (Kennungen gelten weiter).
 */
class SprecherErinnerung {
 public:
  /** Eine leere Liste aendert nichts (6.8 Regel 2; Entscheidung E-a2-1): sie traegt keinen Sprecher. */
  void melde(Signal s, const std::vector<unsigned>& ids, int64_t ms) {
    if (ids.empty()) return;
    Eintrag& e = eintraege_[static_cast<size_t>(s)];
    e.da = true;
    e.ids = ids;
    e.ms = ms;
  }

  /** Weggang: die Erinnerung verliert die Kennung; ein Eintrag ohne Kennung faellt weg. */
  void entferne(unsigned id) {
    for (Eintrag& e : eintraege_) {
      if (!e.da) continue;
      e.ids.erase(std::remove(e.ids.begin(), e.ids.end(), id), e.ids.end());
      if (e.ids.empty()) e = Eintrag{};
    }
  }

  void leeren() {
    for (Eintrag& e : eintraege_) e = Eintrag{};
  }

  /** nullptr = kein Eintrag fuer dieses Signal. */
  const std::vector<unsigned>* letzte(Signal s) const {
    const Eintrag& e = eintraege_[static_cast<size_t>(s)];
    return e.da ? &e.ids : nullptr;
  }

  /** Zeit des letzten Eintrags (Bridge-Uhr, ms); 0 ohne Eintrag. */
  int64_t letzteMs(Signal s) const {
    const Eintrag& e = eintraege_[static_cast<size_t>(s)];
    return e.da ? e.ms : 0;
  }

 private:
  struct Eintrag {
    bool da = false;
    std::vector<unsigned> ids;
    int64_t ms = 0;
  };
  Eintrag eintraege_[3];
};

/** Einstellung aus speakerConfig und dem Slot (E19: Vorgabe speakerVideo, 1000 ms; showNoVideo je Slot). */
struct SprecherEinstellung {
  Signal signal = Signal::SpeakerVideo;
  int64_t haltezeitMs = 1000;
  bool showNoVideo = true;
};

/**
 * Ergebnis eines Schritts. wechsel = der Slot haengt um (slotRetarget(VIDEO, ziel, grund), 6.8 Regel 5/6).
 * ziel ist das gezeigte Ziel nach dem Schritt (0 = keins). grund gilt nur bei wechsel: speakerChanged bzw.
 * speakerNone (Ziel 0). Ohne wechsel steht grund auf command und bedeutet nichts.
 */
struct SprecherSchritt {
  bool wechsel = false;
  unsigned ziel = 0;
  Grund grund = Grund::command;
};

/**
 * Eine je Sprecher-Slot (6.8 Regeln 1-8). Jede neue SprecherWahl (Einschalten, Moduswechsel auf Sprecher,
 * Wechsel des Signals) wird mit vorbelegen() aus der Erinnerung des gewaehlten Signals vorbelegt.
 */
class SprecherWahl {
 public:
  SprecherWahl(SprecherEinstellung e, unsigned eigeneId) : e_(e), eigene_(eigeneId) {}

  /**
   * Regel 4 und 8: Ziel sofort aus der Erinnerung (dieselben Kandidaten-Regeln 2 und 3), ohne Haltezeit; ohne
   * Eintrag Ziel 0 mit speakerNone. jetzt bleibt im Vertrag (Gliederung), die Vorbelegung braucht keine Zeit.
   */
  SprecherSchritt vorbelegen(const SprecherErinnerung& er, const KameraAn& kamera, int64_t /*jetzt*/) {
    const std::vector<unsigned>* ids = er.letzte(e_.signal);
    const unsigned k = ids != nullptr ? kandidat(*ids, kamera) : 0;
    haengend_ = false;
    ziel_ = k;
    if (k == 0) return {false, 0, Grund::speakerNone};
    return {true, k, Grund::speakerChanged};
  }

  /** Ein Rueckruf eines der drei Signale; nur das gewaehlte steuert (Regel 1). */
  SprecherSchritt signal(Signal s, const std::vector<unsigned>& ids, const KameraAn& kamera, int64_t jetzt) {
    if (s != e_.signal) return keinWechsel();
    const unsigned k = kandidat(ids, kamera);
    if (k == 0) return keinWechsel();                    // leere Liste, 0, eigene Kennung, uebersprungen
    if (ziel_ == 0) return wechselAuf(k);                // Regel 4: ohne Ziel sofort
    if (k == ziel_) {                                    // der Gezeigte ist wieder Kandidat: Wechsel verfaellt
      haengend_ = false;
      return keinWechsel();
    }
    if (!haengend_ || kandidat_ != k) {                  // jeder andere Kandidat startet die Zeit neu
      haengend_ = true;
      kandidat_ = k;
      seit_ = jetzt;
    }
    return haltezeitPruefen(jetzt);
  }

  /** Aus slotLogicTick (6.6 Nr. 5): abgelaufene Haltezeit; Regel 3 gilt auch waehrend der Haltezeit. */
  SprecherSchritt tick(const KameraAn& kamera, int64_t jetzt) {
    if (!haengend_) return keinWechsel();
    if (!e_.showNoVideo && !kamera(kandidat_)) {
      haengend_ = false;
      return keinWechsel();
    }
    return haltezeitPruefen(jetzt);
  }

  /** Regel 6: geht der gezeigte Sprecher, Ziel 0 mit speakerNone; der naechste Kandidat kommt dann sofort. */
  SprecherSchritt weggang(unsigned id, int64_t /*jetzt*/) {
    if (haengend_ && kandidat_ == id) haengend_ = false;
    if (id == 0 || id != ziel_) return keinWechsel();
    ziel_ = 0;
    haengend_ = false;
    return {true, 0, Grund::speakerNone};
  }

  unsigned ziel() const { return ziel_; }

 private:
  /** Regel 2 und 3. activeAudio: die erste Kennung der Liste, die Kandidat sein darf (Entscheidung E-a2-2). */
  unsigned kandidat(const std::vector<unsigned>& ids, const KameraAn& kamera) const {
    if (e_.signal == Signal::ActiveAudio) {
      for (unsigned id : ids) {
        if (darfKandidatSein(id, kamera)) return id;
      }
      return 0;
    }
    return !ids.empty() && darfKandidatSein(ids.front(), kamera) ? ids.front() : 0;
  }

  bool darfKandidatSein(unsigned id, const KameraAn& kamera) const {
    if (id == 0 || id == eigene_) return false;          // Kennung 0 und die eigene Kennung nie (Regel 2)
    return e_.showNoVideo || kamera(id);                 // Regel 3
  }

  SprecherSchritt haltezeitPruefen(int64_t jetzt) {
    if (jetzt - seit_ >= e_.haltezeitMs) return wechselAuf(kandidat_);   // Regel 4: die Haltezeit lang, >=
    return keinWechsel();
  }

  SprecherSchritt wechselAuf(unsigned k) {
    ziel_ = k;
    haengend_ = false;
    return {true, k, Grund::speakerChanged};
  }

  SprecherSchritt keinWechsel() const { return {false, ziel_, Grund::command}; }

  SprecherEinstellung e_;
  unsigned eigene_ = 0;
  unsigned ziel_ = 0;
  bool haengend_ = false;
  unsigned kandidat_ = 0;
  int64_t seit_ = 0;
};

// ---- Bildschirmfreigabe (Spec 6.9, E20; Task A5) --------------------------------------------------------

// Werte der Aufzaehlungen im Zoom-Header 7.1.5.43953, Index = Wert (zoom_sdk_def.h:561-585 SharingStatus,
// :420-444 ShareType; A-EP4). Eigene Namen, damit sie in video.cpp neben den SDK-Namen nicht kollidieren.
inline constexpr int STATUS_EIGEN_BEGINN = 0;         // Sharing_Self_Send_Begin
inline constexpr int STATUS_EIGEN_ENDE = 1;           // Sharing_Self_Send_End
inline constexpr int STATUS_EIGEN_TON_BEGINN = 2;     // Sharing_Self_Send_Pure_Audio_Begin
inline constexpr int STATUS_EIGEN_TON_ENDE = 3;       // Sharing_Self_Send_Pure_Audio_End
inline constexpr int STATUS_FREMD_BEGINN = 4;         // Sharing_Other_Share_Begin
inline constexpr int STATUS_FREMD_ENDE = 5;           // Sharing_Other_Share_End
inline constexpr int STATUS_FREMD_TON_BEGINN = 6;     // Sharing_Other_Share_Pure_Audio_Begin
inline constexpr int STATUS_FREMD_TON_ENDE = 7;       // Sharing_Other_Share_Pure_Audio_End
inline constexpr int STATUS_ANSICHT_FREMD = 8;        // Sharing_View_Other_Sharing
inline constexpr int STATUS_PAUSE = 9;                // Sharing_Pause
inline constexpr int STATUS_WEITER = 10;              // Sharing_Resume
inline constexpr int TYP_UNBEKANNT = 0;               // SHARE_TYPE_UNKNOWN (bei Begin oft vorlaeufig)
inline constexpr int TYP_COMPUTERTON = 10;            // SHARE_TYPE_COMPUTER_AUDIO

inline constexpr const char* SHARE_TYP_NAMEN[11] = {
  "unknown", "as", "ds", "wb", "airhost", "camera", "data", "videoFile", "frame", "document", "computerAudio"
};
inline constexpr const char* SHARING_STATUS_NAMEN[11] = {
  "selfSendBegin", "selfSendEnd", "selfSendPureAudioBegin", "selfSendPureAudioEnd", "otherShareBegin",
  "otherShareEnd", "otherSharePureAudioBegin", "otherSharePureAudioEnd", "viewOtherSharing", "pause", "resume"
};

/** Typ als Name fuer shares/recent; ein Wert ausserhalb des Headers heisst „unknown“. */
inline const char* shareTypName(int typ) { return typ >= 0 && typ <= TYP_COMPUTERTON ? SHARE_TYP_NAMEN[typ] : "unknown"; }
/** Status als Name fuer recent; nullptr fuer einen Wert ausserhalb des Headers (dann meldet die Bridge ihn nicht). */
inline const char* sharingStatusName(int s) { return s >= 0 && s <= STATUS_WEITER ? SHARING_STATUS_NAMEN[s] : nullptr; }

/** Ein Eintrag der Liste (6.9): {share, user, status, type, audioOnly, seq, pauses}; status = paused/running. */
struct FreigabeEintrag {
  unsigned share = 0;
  unsigned user = 0;
  bool paused = false;
  uint8_t type = 0;
  bool audioOnly = false;
  uint64_t seq = 0;
  int pauses = 0;
};

/** Ergebnis eines Befuellens, als shares.seeded: „ok“, „empty“, „unavailable“ (6.3). */
enum class Befuellt : uint8_t { Ok, Leer, NichtVerfuegbar };
inline constexpr const char* BEFUELLT_NAMEN[3] = {"ok", "empty", "unavailable"};
inline const char* name(Befuellt v) { return BEFUELLT_NAMEN[static_cast<int>(v)]; }

/**
 * Die Liste der Freigaben, eine je Bridge; alle Freigabe-Slots zeigen dieselbe gezeigte Freigabe (E20, O3).
 * Gefuettert aus den Merkern des ShareListener (6.5) in der Hauptschleife. Gezeigt wird der Eintrag mit dem
 * hoechsten seq, der nicht audioOnly ist (laufend oder pausiert). Pause aendert nichts am Abo.
 */
class FreigabeListe {
 public:
  /** Ein onSharingStatus (Tabelle 6.9). true = die Liste hat sich geaendert. */
  bool status(int sharingStatus, unsigned user, unsigned share, int contentType) {
    switch (sharingStatus) {
      case STATUS_FREMD_BEGINN: return beginn(user, share, contentType, false);
      case STATUS_FREMD_TON_BEGINN: return beginn(user, share, contentType, true);
      case STATUS_FREMD_ENDE: return ende(user, share, false);
      case STATUS_FREMD_TON_ENDE: return ende(user, share, true);
      case STATUS_PAUSE: return pause(user, share, true);
      case STATUS_WEITER: return pause(user, share, false);
      default: return false;   // Sharing_Self_*, Sharing_View_Other_Sharing: wir teilen nie (nur stderr)
    }
  }

  /**
   * Typ-Nachtrag (onShareContentNotification, B37): Typ des passenden Eintrags (gleiche Person und Kennung, sonst
   * der Eintrag dieser Person mit Kennung 0, dessen Kennung nachgezogen wird) OHNE neues seq; COMPUTER_AUDIO
   * setzt audioOnly. Ohne passenden Eintrag nichts.
   */
  bool typNachtrag(unsigned user, unsigned share, int contentType) {
    FreigabeEintrag* e = finde(user, share);
    bool geaendert = false;
    if (e == nullptr && share != 0) {
      e = finde(user, 0);
      if (e != nullptr) {
        e->share = share;   // Kennung nachgezogen (AN19)
        geaendert = true;
      }
    }
    if (e == nullptr) return false;
    const uint8_t t = typ(contentType);
    if (e->type != t) {
      e->type = t;
      geaendert = true;
    }
    if (contentType == TYP_COMPUTERTON && !e->audioOnly) {
      e->audioOnly = true;
      geaendert = true;
    }
    return geaendert;
  }

  /** Weggang einer Person (Merker): ihre Eintraege fallen weg, auch ohne Share_End (Annahme AN9). */
  bool weggang(unsigned user) {
    const size_t vorher = eintraege_.size();
    eintraege_.erase(std::remove_if(eintraege_.begin(), eintraege_.end(),
                                    [user](const FreigabeEintrag& e) { return e.user == user; }),
                     eintraege_.end());
    return eintraege_.size() != vorher;
  }

  void leeren() { eintraege_.clear(); }

  /**
   * Befuellen aus GetViewableSharingUserList/GetSharingSourceInfoList (6.9, B38). nurErgaenzen = false heisst
   * INMEETING: zuerst leeren (Kennungen wechseln), auch wenn Zoom nichts liefert. nurErgaenzen = true heisst
   * erstes Einschalten eines Freigabe-Slots: Bekanntes bleibt mit seinem seq. Fehlende Eintraege bekommen ein seq
   * UNTER allen per Rueckruf bekannten, untereinander in Listenreihenfolge (Annahme AN20). nullptr = nicht
   * verfuegbar, leere Liste = leer; beides loescht nie einen bekannten Eintrag.
   */
  Befuellt befuellen(const std::vector<FreigabeEintrag>* zoomListe, bool nurErgaenzen) {
    if (!nurErgaenzen) leeren();
    if (zoomListe == nullptr) return Befuellt::NichtVerfuegbar;
    if (zoomListe->empty()) return Befuellt::Leer;
    for (const FreigabeEintrag& z : *zoomListe) {
      if (finde(z.user, z.share) != nullptr) continue;
      FreigabeEintrag* nullEintrag = z.share != 0 ? finde(z.user, 0) : nullptr;
      if (nullEintrag != nullptr) {        // per Rueckruf mit Kennung 0 bekannt: Kennung nachziehen, seq bleibt
        nullEintrag->share = z.share;
        continue;
      }
      FreigabeEintrag e = z;
      e.seq = ++befuelltSeq_;
      if (e.type == TYP_COMPUTERTON) e.audioOnly = true;
      eintraege_.push_back(e);
    }
    return Befuellt::Ok;
  }

  /** Die gezeigte Freigabe: hoechstes seq ohne audioOnly; nullptr = keine. */
  const FreigabeEintrag* gezeigt() const {
    const FreigabeEintrag* beste = nullptr;
    for (const FreigabeEintrag& e : eintraege_) {
      if (e.audioOnly) continue;
      if (beste == nullptr || e.seq > beste->seq) beste = &e;
    }
    return beste;
  }

  const std::vector<FreigabeEintrag>& eintraege() const { return eintraege_; }

  /** Zahl der Bild-Freigaben (ohne reine Ton-Freigaben). */
  int bildFreigaben() const {
    int n = 0;
    for (const FreigabeEintrag& e : eintraege_) {
      if (!e.audioOnly) ++n;
    }
    return n;
  }

 private:
  /** Rueckruf-seq beginnt ueber allen Befuell-seq: Befuellte begannen vor dem Ankommen (AN20). */
  static constexpr uint64_t kRueckrufBasis = uint64_t{1} << 32;

  static uint8_t typ(int contentType) {
    return static_cast<uint8_t>(contentType >= 0 && contentType <= TYP_COMPUTERTON ? contentType : TYP_UNBEKANNT);
  }

  FreigabeEintrag* finde(unsigned user, unsigned share) {
    for (FreigabeEintrag& e : eintraege_) {
      if (e.user == user && e.share == share) return &e;
    }
    return nullptr;
  }

  /** Begin: Eintrag mit neuem seq; ein erneuter Begin derselben Freigabe ersetzt den alten (Entscheidung E-a2-3). */
  bool beginn(unsigned user, unsigned share, int contentType, bool tonAllein) {
    eintraege_.erase(std::remove_if(eintraege_.begin(), eintraege_.end(),
                                    [user, share](const FreigabeEintrag& e) { return e.user == user && e.share == share; }),
                     eintraege_.end());
    FreigabeEintrag e;
    e.user = user;
    e.share = share;
    e.type = typ(contentType);
    e.audioOnly = tonAllein || contentType == TYP_COMPUTERTON;
    e.seq = ++rueckrufSeq_;
    eintraege_.push_back(e);
    return true;
  }

  /** End: Eintrag entfernen; Kennung 0 gilt fuer alle Eintraege der Person (Entscheidung E-a2-3, wie AN8). */
  bool ende(unsigned user, unsigned share, bool nurTon) {
    const size_t vorher = eintraege_.size();
    eintraege_.erase(std::remove_if(eintraege_.begin(), eintraege_.end(),
                                    [user, share, nurTon](const FreigabeEintrag& e) {
                                      return e.user == user && (share == 0 || e.share == share) && (!nurTon || e.audioOnly);
                                    }),
                     eintraege_.end());
    return eintraege_.size() != vorher;
  }

  /** Pause/Resume: paused bzw. running, pauses zaehlt; Kennung 0 gilt fuer alle Eintraege der Person (AN8). */
  bool pause(unsigned user, unsigned share, bool an) {
    bool geaendert = false;
    for (FreigabeEintrag& e : eintraege_) {
      if (e.user != user || (share != 0 && e.share != share) || e.paused == an) continue;
      e.paused = an;
      if (an) ++e.pauses;
      geaendert = true;
    }
    return geaendert;
  }

  std::vector<FreigabeEintrag> eintraege_;
  uint64_t rueckrufSeq_ = kRueckrufBasis;
  uint64_t befuelltSeq_ = 0;
};

// ---- Bild: Ziel-Stand, Ersatzbild, Zustand nach 200 ms und 2 s, Riegel (Spec 6.1, 6.7, 6.9, 6.10, 6.12; A6) ----

/**
 * Alles, was fuer GENAU EIN Ziel EINES Abos gilt (6.1, wörtlich). Das Umhaengen ersetzt den Stand als Ganzes
 * (zielStandNeu, 6.10 Schritt 6); kein Feld kann beim Zuruecksetzen vergessen werden (B9). Ohne Ton-Felder: der
 * Ton haengt am Sender (TonStand, RR8).
 */
struct ZielStand {
  int64_t lastFrameMs = 0; int lastW = 0, lastH = 0; bool gemessen = false;   // rotation/limitedRange gemessen
  bool mismatchGemeldet = false;
  bool bildSeitUmhaengen = false;  // erstes Bild dieses Ziels kam (6.7, 6.10)
  bool rawOffGesehen = false;      // RawData_Off nach dem ersten Bild dieses Ziels (6.7)
  bool kopieGueltig = false;       // Kopie stammt von diesem Ziel (6.12)
  int64_t retargetMs = 0;          // Beginn der Luecke (6.10)
};

inline bool operator==(const ZielStand& a, const ZielStand& b) {
  return a.lastFrameMs == b.lastFrameMs && a.lastW == b.lastW && a.lastH == b.lastH && a.gemessen == b.gemessen &&
         a.mismatchGemeldet == b.mismatchGemeldet && a.bildSeitUmhaengen == b.bildSeitUmhaengen &&
         a.rawOffGesehen == b.rawOffGesehen && a.kopieGueltig == b.kopieGueltig && a.retargetMs == b.retargetMs;
}
inline bool operator!=(const ZielStand& a, const ZielStand& b) { return !(a == b); }

/** 6.10 Schritt 6 (Plan-Schritt ZielStandNeu): neuer Stand fuer das neue Ziel, Beginn der Luecke = jetzt. */
inline void zielStandNeu(ZielStand& z, int64_t jetzt) {
  z = ZielStand{};
  z.retargetMs = jetzt;
}

/** Riegel (6.10, I3): Bild und RawData_On/Off werden verworfen, solange nicht abonniert oder beim Umhaengen. */
inline bool riegelVerwirft(bool subscribed, bool umhaengen) { return !subscribed || umhaengen; }

/**
 * Ein Bild hat den Riegel passiert: Messwerte des Ziels nachfuehren. true = erstes Bild seit dem Umhaengen
 * (dann live/frames und Ende der Luecke, 6.10 „Erstes Bild danach“).
 */
inline bool bildAnnehmen(ZielStand& z, int w, int h, int64_t jetzt) {
  const bool erstes = !z.bildSeitUmhaengen;
  z.bildSeitUmhaengen = true;
  z.lastFrameMs = jetzt;
  z.lastW = w;
  z.lastH = h;
  return erstes;
}

/**
 * RawData_Off hat den Riegel passiert (6.7): setzt nie einen Grund. Nur wenn seit dem Umhaengen schon ein Bild
 * dieses Ziels kam, merkt es rawOffGesehen und liefert true (dann fragt die Hauptschleife IsVideoOn()).
 */
inline bool rawOffAnnehmen(ZielStand& z) {
  if (!z.bildSeitUmhaengen) return false;
  z.rawOffGesehen = true;
  return true;
}

inline constexpr int64_t BILD_NACHLAUF_MS = 200;            // Ersatzbild bzw. Halten ab 200 ms ohne Bild (6.12)
inline constexpr int64_t FREIGABE_ZUSTAND_MS = 2000;        // Zustand eines Freigabe-Slots erst nach 2 s (6.9, W1)
inline constexpr int64_t TAKT_ERSATZBILD_MS = 100;          // Ersatzbild hoechstens alle 100 ms
inline constexpr int64_t TAKT_HALTEN_MS = 200;              // Kopie beim Halten hoechstens alle 200 ms

/** Eingang der Bild-Entscheidung, je Slot und Herzschlag (videoTick, 6.6 Nr. 6). */
struct BildLage {
  SlotMode modus = SlotMode::Participant;
  Fallback fallback = Fallback::Transparent;
  unsigned ziel = 0;                  // Kennung bzw. Freigabe-Kennung; 0 = keins
  bool freigabeBesteht = false;       // die gezeigte Freigabe besteht noch (Freigabe-Slot)
  bool freigabePausiert = false;      // die gezeigte Freigabe ist pausiert
  bool kameraAusLautZoom = false;     // videoStatus Video_OFF/Video_Mute_ByHost oder IsVideoOn() = false (6.7)
  bool bufferMismatch = false;        // laufender Puffer-Fehler dieses Ziels (bleibt als Grund stehen)
  SlotState zustand = SlotState::Starting;
  Grund grund = Grund::command;
  int64_t letztesErsatzMs = 0;        // Zeit des letzten Ersatz- bzw. Halte-Bildes; 0 = noch keins
  int64_t jetzt = 0;
};

/**
 * Ausgang: sent = was der Sender gerade zusaetzlich zu Zooms Bildern schickt (6.12); jetztSenden = in diesem
 * Herzschlag ein Bild dieser Art senden (Takt); zustandAendern mit zustand/grund = neuer Zustand (sonst unveraendert).
 */
struct BildEntscheidung {
  Sent sent = Sent::None;
  bool jetztSenden = false;
  bool zustandAendern = false;
  SlotState zustand = SlotState::Starting;
  Grund grund = Grund::command;
};

/** Art des Ersatzbilds (Tabelle 6.12): freeze ohne Kopie dieses Ziels wie transparent (T60). */
inline Sent ersatzArt(Fallback f, bool kopieDiesesZiels) {
  switch (f) {
    case Fallback::Black: return Sent::Black;
    case Fallback::White: return Sent::White;
    case Fallback::Freeze: return kopieDiesesZiels ? Sent::Freeze : Sent::Transparent;
    case Fallback::Transparent: break;
  }
  return Sent::Transparent;
}

/**
 * Tabelle 6.12 und die Zustandsschwellen 6.7/6.9/6.12 (PB16, PB24, PB29):
 * - Bild juenger als 200 ms: nichts zusaetzlich (none). Vor dem ersten Bild dieses Ziels sofort das Ersatzbild.
 * - Freigabe-Slot, gezeigte Freigabe besteht, Kopie DIESES Ziels: Kopie alle 200 ms (held), ab 200 ms ohne Bild,
 *   der Zustand bleibt dabei live; erst nach 2 s held/sharePaused bzw. held/shareStill, ohne Kopie
 *   fallback/sharePaused bzw. fallback/noFrames. Nie cameraOff.
 * - Teilnehmer/Sprecher: nach 200 ms ohne Bild fallback/cameraOff, wenn Zoom die Kamera als aus meldet, sonst
 *   fallback/noFrames; ein laufender bufferMismatch bleibt.
 * - Vor dem ersten Bild bleibt der Zustand (starting, oder cameraOff aus 6.10 Schritt 7); einzige Ausnahme: Freigabe
 *   pausiert und 2 s seit dem Umhaengen -> fallback/sharePaused. Ziel 0: Zustand setzt das Umhaengen.
 */
inline BildEntscheidung bildEntscheidung(const BildLage& l, const ZielStand& z) {
  BildEntscheidung e;
  e.zustand = l.zustand;
  e.grund = l.grund;
  if (l.zustand == SlotState::Off) return e;
  const bool hatBild = z.bildSeitUmhaengen;
  const int64_t seitBild = hatBild && l.jetzt > z.lastFrameMs ? l.jetzt - z.lastFrameMs : 0;
  const bool frisch = hatBild && seitBild < BILD_NACHLAUF_MS;
  const bool freigabe = l.modus == SlotMode::Share;

  if (frisch) e.sent = Sent::None;
  else if (freigabe && l.ziel != 0 && l.freigabeBesteht && z.kopieGueltig) e.sent = Sent::Held;
  else e.sent = ersatzArt(l.fallback, z.kopieGueltig);
  if (e.sent != Sent::None) {
    const int64_t takt = e.sent == Sent::Held ? TAKT_HALTEN_MS : TAKT_ERSATZBILD_MS;
    e.jetztSenden = l.letztesErsatzMs <= 0 || l.jetzt - l.letztesErsatzMs >= takt;
  }

  if (l.ziel == 0 || frisch) return e;
  SlotState soll = l.zustand;
  Grund sollGrund = l.grund;
  if (!freigabe) {
    if (!hatBild) return e;
    soll = SlotState::Fallback;
    sollGrund = l.bufferMismatch ? Grund::bufferMismatch : (l.kameraAusLautZoom ? Grund::cameraOff : Grund::noFrames);
  } else if (!hatBild) {
    if (!l.freigabePausiert || l.jetzt - z.retargetMs < FREIGABE_ZUSTAND_MS) return e;
    soll = SlotState::Fallback;
    sollGrund = Grund::sharePaused;
  } else {
    if (seitBild < FREIGABE_ZUSTAND_MS) return e;
    if (l.bufferMismatch) {
      soll = SlotState::Fallback;
      sollGrund = Grund::bufferMismatch;
    } else if (z.kopieGueltig && l.freigabeBesteht) {
      soll = SlotState::Held;
      sollGrund = l.freigabePausiert ? Grund::sharePaused : Grund::shareStill;
    } else {
      soll = SlotState::Fallback;
      sollGrund = l.freigabePausiert ? Grund::sharePaused : Grund::noFrames;
    }
  }
  if (soll != l.zustand || sollGrund != l.grund) {
    e.zustandAendern = true;
    e.zustand = soll;
    e.grund = sollGrund;
  }
  return e;
}

/** Fehler der NDI-Namensregel (6.2, E26, B26); jeder ergibt slotBadName. */
enum class NamensFehler : uint8_t { Keiner, Leer, ZuLang, Doppelpunkt, Steuerzeichen, UnicodeFolge, KeinUtf8 };
inline constexpr size_t NDI_NAME_MAX_CODEPUNKTE = 60;

/** UTF-8 streng dekodieren: keine Ueberlangen, keine Surrogate, hoechstens U+10FFFF. false = ungueltig. */
inline bool utf8Dekodieren(const std::string& s, std::vector<uint32_t>& aus) {
  aus.clear();
  size_t i = 0;
  while (i < s.size()) {
    const unsigned char b0 = static_cast<unsigned char>(s[i]);
    uint32_t cp = 0;
    size_t laenge = 1;
    uint32_t minimum = 0;
    if (b0 < 0x80) {
      cp = b0;
    } else if ((b0 & 0xE0) == 0xC0) {
      cp = b0 & 0x1Fu; laenge = 2; minimum = 0x80;
    } else if ((b0 & 0xF0) == 0xE0) {
      cp = b0 & 0x0Fu; laenge = 3; minimum = 0x800;
    } else if ((b0 & 0xF8) == 0xF0) {
      cp = b0 & 0x07u; laenge = 4; minimum = 0x10000;
    } else {
      return false;
    }
    if (i + laenge > s.size()) return false;
    for (size_t k = 1; k < laenge; ++k) {
      const unsigned char b = static_cast<unsigned char>(s[i + k]);
      if ((b & 0xC0) != 0x80) return false;
      cp = (cp << 6) | (b & 0x3Fu);
    }
    if (laenge > 1 && cp < minimum) return false;
    if (cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) return false;
    aus.push_back(cp);
    i += laenge;
  }
  return true;
}

/** Code-Punkte eines gueltigen UTF-8-Texts, wie Connect zaehlt (ein Emoji = 1; F3). */
inline size_t codePunkte(const std::string& utf8) {
  size_t n = 0;
  for (const char c : utf8) {
    if ((static_cast<unsigned char>(c) & 0xC0) != 0x80) ++n;   // jedes Nicht-Folgebyte beginnt einen Code-Punkt
  }
  return n;
}

/**
 * NDI-Name eines Slots (6.2, E26): 1-60 Code-Punkte, kein „:“, keine Steuerzeichen (U+0000-U+001F,
 * U+007F-U+009F; Entscheidung E-a2-4), keine \u-Folge im Rohtext (der Feldleser dekodiert \u nicht, A-EP11).
 */
inline NamensFehler pruefeNdiName(const std::string& utf8, bool rohUnicodeFolge) {
  std::vector<uint32_t> cp;
  if (!utf8Dekodieren(utf8, cp)) return NamensFehler::KeinUtf8;
  if (cp.empty()) return NamensFehler::Leer;
  if (codePunkte(utf8) > NDI_NAME_MAX_CODEPUNKTE) return NamensFehler::ZuLang;
  for (const uint32_t c : cp) {
    if (c == ':') return NamensFehler::Doppelpunkt;
  }
  for (const uint32_t c : cp) {
    if (c < 0x20 || (c >= 0x7F && c <= 0x9F)) return NamensFehler::Steuerzeichen;
  }
  if (rohUnicodeFolge) return NamensFehler::UnicodeFolge;
  return NamensFehler::Keiner;
}

// ---- Ton und Umhaengen: TonStand, tonWeg, tonZiele, umhaengPlan, tonUmschaltPlan, stilleBloecke (A7) --------

/**
 * Ton des Slots (6.1, wörtlich): Format, Messfenster und Buchfuehrung des Stille-Herzschlags fuer den Strom, den
 * der Sender traegt. Je Slot, nicht je Ziel; als Ganzes ersetzt (tonStandNeu) nur, wenn der gesendete Ton die Quelle
 * wechselt (6.10 Schritt 8, 6.13), nie beim Umhaengen eines Slots mit reinem Mischton (RR8).
 */
struct TonStand {
  int audioRate = 0, audioChannels = 0; int64_t lastAudioMs = 0, silenceBisMs = 0; bool audioMismatchGemeldet = false;
  int64_t audioMessBeginnMs = 0; int audioMessPakete = 0; int64_t audioMessAbtastwerte = 0;
  int audioMessFenster = 0; int64_t audioWartenSummeUs = 0, audioWartenMaxUs = 0, audioWartenMinUs = 0;
};

inline bool operator==(const TonStand& a, const TonStand& b) {
  return a.audioRate == b.audioRate && a.audioChannels == b.audioChannels && a.lastAudioMs == b.lastAudioMs &&
         a.silenceBisMs == b.silenceBisMs && a.audioMismatchGemeldet == b.audioMismatchGemeldet &&
         a.audioMessBeginnMs == b.audioMessBeginnMs && a.audioMessPakete == b.audioMessPakete &&
         a.audioMessAbtastwerte == b.audioMessAbtastwerte && a.audioMessFenster == b.audioMessFenster &&
         a.audioWartenSummeUs == b.audioWartenSummeUs && a.audioWartenMaxUs == b.audioWartenMaxUs &&
         a.audioWartenMinUs == b.audioWartenMinUs;
}
inline bool operator!=(const TonStand& a, const TonStand& b) { return !(a == b); }

/** Plan-Schritt TonStandNeu: der ganze Ton-Stand beginnt neu, silenceBisMs eingeschlossen (N2). */
inline void tonStandNeu(TonStand& t) { t = TonStand{}; }

/**
 * Tonweg (6.10 Schritt 8, Restnachfix N1): was der Slot im Modus nach der Ton-Abbildung (7.1, Spalte „gesendet“)
 * sendet; zugleich `configured` von slotAudio. person nur im Modus Teilnehmer, share/mixShare nur im Modus Freigabe.
 */
inline TonQuelle tonWeg(SlotMode modus, SlotAudio audio, bool shareAudio) {
  const bool computerton = modus == SlotMode::Share && shareAudio;
  switch (audio) {
    case SlotAudio::Mix: return computerton ? TonQuelle::MixShare : TonQuelle::Mix;
    case SlotAudio::Person:
      if (modus == SlotMode::Participant) return TonQuelle::Person;
      return computerton ? TonQuelle::Share : TonQuelle::None;
    case SlotAudio::Off: break;
  }
  return computerton ? TonQuelle::Share : TonQuelle::None;
}

enum class PaketArt : uint8_t { Person, Mix, Share };   // AudioPacket::kind (6.13)
enum class Weg : uint8_t { Direkt, MischerA, MischerB };

/** Was tonZiele je Slot sieht (Eingang 6.13: laeuft, Modus, Ziel, audio, shareAudio, shareUser). */
struct TonSlotSicht {
  int nr = 0;
  bool laeuft = false;
  SlotMode modus = SlotMode::Participant;
  unsigned ziel = 0;
  SlotAudio audio = SlotAudio::Off;
  bool shareAudio = false;
  unsigned shareUser = 0;
};
struct TonZiel {
  int nr = 0;
  Weg weg = Weg::Direkt;
};
inline bool operator==(const TonZiel& a, const TonZiel& b) { return a.nr == b.nr && a.weg == b.weg; }

/**
 * Zuordnung eines Pakets (6.13, B76): person k -> jeder laufende Teilnehmer-Slot mit Ziel k (k != 0) und audio person;
 * mix -> jeder laufende Slot mit audio mix, im Freigabe-Slot mit shareAudio in den Mischer (A); share k -> jeder
 * laufende Freigabe-Slot mit shareAudio und shareUser k, mit audio mix in den Mischer (B), sonst direkt.
 */
inline std::vector<TonZiel> tonZiele(PaketArt art, unsigned kennung, const std::vector<TonSlotSicht>& slots) {
  std::vector<TonZiel> aus;
  for (const TonSlotSicht& s : slots) {
    if (!s.laeuft) continue;
    switch (art) {
      case PaketArt::Person:
        if (kennung != 0 && s.modus == SlotMode::Participant && s.ziel == kennung && s.audio == SlotAudio::Person) {
          aus.push_back({s.nr, Weg::Direkt});
        }
        break;
      case PaketArt::Mix:
        if (s.audio == SlotAudio::Mix) {
          aus.push_back({s.nr, s.modus == SlotMode::Share && s.shareAudio ? Weg::MischerA : Weg::Direkt});
        }
        break;
      case PaketArt::Share:
        if (kennung != 0 && s.modus == SlotMode::Share && s.shareAudio && s.shareUser == kennung) {
          aus.push_back({s.nr, s.audio == SlotAudio::Mix ? Weg::MischerB : Weg::Direkt});
        }
        break;
    }
  }
  return aus;
}

enum class RendererTyp : uint8_t { Video, Share };
inline RendererTyp rendererTyp(SlotMode modus) { return modus == SlotMode::Share ? RendererTyp::Share : RendererTyp::Video; }

/** Schritte des Umhaengens (6.10) in Ausfuehrungsreihenfolge; Namen der Ton-Schritte wörtlich aus 6.10/6.13. */
enum class UmhaengSchritt : uint8_t {
  Vormerken, Unsubscribe, ZeigerVerwerfen, CreateRendererNeuerDelegate, DestroyRenderer,
  CreateRendererGleicherDelegate, SetResolution, GetResolution, Subscribe, WiederholenIn500ms, ZielStandNeu,
  VorschauPlatzLeeren, IsVideoOnFragen, SlotMelden, FehlerSubscribeMelden, TonStandNeu, MischerEingangBNeu,
  MischerNeu, TonMelden, VersatzLeeren, OhneVersatzSetzen
};

/** Lage beim Umhaengen eines Slots (je Aufruf von slotRetarget). */
struct UmhaengLage {
  bool sperre = false;                      // Renderer-Sperre (6.5): nur vormerken
  bool abonniert = false;                   // subscribed vor dem Umhaengen
  bool rendererTot = false;                 // onRendererBeDestroyed kam (6.10 Schritt 2)
  SlotMode modusVorher = SlotMode::Participant, modusNachher = SlotMode::Participant;
  unsigned neuesZiel = 0;
  Grund aufruf = Grund::command;            // Grund des Aufrufs (targetChanged, modeChanged, speakerChanged, ...)
  RendererTyp letzterTyp = RendererTyp::Video;   // Typ des letzten Abos dieses Renderers
  SlotAudio audio = SlotAudio::Off;
  bool shareAudio = false;
  bool tonAudioUnavailable = false;         // Slot steht auf off/audioUnavailable (6.13)
  bool freigabeNochGezeigt = false;         // fuer 29: diese Freigabe wird noch gezeigt
  // Hilfsfelder (Gliederung erlaubt sie):
  unsigned altesZiel = 0;                   // Ziel vor dem Umhaengen; ohne Zielwechsel bleibt der Ton (Aufloesung)
  bool rendererGescheitert = false;         // createRenderer scheiterte (6.10 Schritt 2 bzw. neuer Renderer)
  bool abschlussGelaufen = false;           // Schritte 6-8 liefen schon (erstes 29); Erfolg danach: kein zweiter
};

/** Eine slotAudio-Meldung (Zustand, Grund, configured). */
struct TonMeldung {
  TonZustand zustand = TonZustand::Off;
  TonGrund grund = TonGrund::command;
  TonQuelle configured = TonQuelle::None;
};

/**
 * Plan eines Umhaengens bzw. Ton-Umschaltens. zustand/grund gelten fuer den Schritt SlotMelden. tonFolge traegt
 * jede Meldung des Schritts TonMelden in Reihenfolge (tonUmschaltPlan meldet bis zu zwei, S2); tonMelden,
 * tonZustand, tonGrund und configured spiegeln die letzte (Vertrag der Gliederung).
 */
struct UmhaengPlan {
  std::vector<UmhaengSchritt> schritte;
  SlotState zustand = SlotState::Starting;
  Grund grund = Grund::command;
  bool tonMelden = false;
  TonZustand tonZustand = TonZustand::Off;
  TonGrund tonGrund = TonGrund::command;
  TonQuelle configured = TonQuelle::None;
  std::vector<TonMeldung> tonFolge;
};

// SDK-Rueckgaben, die den naechsten Schritt bestimmen (zoom_sdk_def.h:80-81, :102-105; Tabelle 6.10).
inline constexpr int FEHLER_KEINER = 0;                // SDKERR_SUCCESS
inline constexpr int FEHLER_ZU_OFT = 18;               // SDKERR_TOO_FREQUENT_CALL
inline constexpr int FEHLER_KEINE_FREIGABEDATEN = 29;  // SDKERR_NO_SHARE_DATA (nur SHARE)
inline constexpr int FEHLER_EIGENE_FREIGABE = 30;      // SDKERR_SHARE_CANNOT_SUBSCRIBE_MYSELF (kommt nicht vor)
inline constexpr int ZU_OFT_WIEDERHOLUNGEN = 3;        // 18: hoechstens dreimal nach 500 ms

/**
 * Ziel-0-Grund (6.10 Schritt 3, Nachfix W7): der Grund des Aufrufs, wenn er schon „kein Ziel“ sagt, sonst nach
 * Modus. modeChanged, targetChanged und resolutionChanged stehen so nie mit Ziel 0.
 */
inline Grund ziel0Grund(Grund aufruf, SlotMode modus) {
  switch (aufruf) {
    case Grund::participantLeft:
    case Grund::noTarget:
    case Grund::speakerNone:
    case Grund::shareNone:
      return aufruf;
    default:
      break;
  }
  switch (modus) {
    case SlotMode::Speaker: return Grund::speakerNone;
    case SlotMode::Share: return Grund::shareNone;
    case SlotMode::Participant: break;
  }
  return Grund::noTarget;
}

/**
 * Neues Ziel beim Moduswechsel (6.10 „Moduswechsel“): Teilnehmer die Kennung aus demselben Befehl (sonst 0),
 * Sprecher das vorbelegte Ziel der SprecherWahl (sonst 0), Freigabe die gezeigte Freigabe (sonst 0).
 */
inline unsigned zielNachModus(SlotMode modus, unsigned idAusBefehl, unsigned sprecherVorbelegt, unsigned gezeigteFreigabe) {
  switch (modus) {
    case SlotMode::Speaker: return sprecherVorbelegt;
    case SlotMode::Share: return gezeigteFreigabe;
    case SlotMode::Participant: break;
  }
  return idAusBefehl;
}

/**
 * Grund, wenn IsVideoOn() nach dem Umhaengen auf VIDEO false liefert (6.10 Schritt 7): Teilnehmer cameraOff (T19),
 * Sprecher speakerNoVideo (6.8 Regel 7: ein Kandidat ohne Kamera wurde Ziel).
 */
inline Grund grundBeiKameraAus(SlotMode modus) {
  return modus == SlotMode::Speaker ? Grund::speakerNoVideo : Grund::cameraOff;
}

inline void meldeTon(UmhaengPlan& p, TonZustand z, TonGrund g, TonQuelle configured) {
  p.schritte.push_back(UmhaengSchritt::TonMelden);
  p.tonFolge.push_back({z, g, configured});
  p.tonMelden = true;
  p.tonZustand = z;
  p.tonGrund = g;
  p.configured = configured;
}

/** 6.10 Schritt 8, Ton-Teil (B25, RR8, N1, RN5, S2, noShare). */
inline void tonBeimUmhaengen(const UmhaengLage& l, UmhaengPlan& p) {
  if (l.tonAudioUnavailable) return;        // bleibt off/audioUnavailable, bis Ton wieder eingeschaltet wird
  const TonQuelle vorher = tonWeg(l.modusVorher, l.audio, l.shareAudio);
  const TonQuelle nachher = tonWeg(l.modusNachher, l.audio, l.shareAudio);
  if (l.modusVorher != l.modusNachher) {    // Moduswechsel: allein der Tonweg zaehlt
    if (vorher == nachher) return;           // mix -> mix, none -> none: Ton-Stand und Mischer bleiben, kein Ereignis
    p.schritte.push_back(UmhaengSchritt::TonStandNeu);
    if (nachher == TonQuelle::MixShare) p.schritte.push_back(UmhaengSchritt::MischerNeu);
    if (l.audio == SlotAudio::Person && l.modusNachher != SlotMode::Participant) {
      meldeTon(p, TonZustand::Off, TonGrund::personNotInMode, nachher);
    } else if (nachher == TonQuelle::Person && l.neuesZiel == 0) {
      meldeTon(p, TonZustand::Off, TonGrund::participantLeft, nachher);
    } else if (nachher == TonQuelle::Share && l.neuesZiel == 0) {
      meldeTon(p, TonZustand::Off, TonGrund::noShare, nachher);
    } else if (nachher == TonQuelle::None) {
      meldeTon(p, TonZustand::Off, TonGrund::modeChanged, nachher);
    } else {
      meldeTon(p, TonZustand::Waiting, TonGrund::modeChanged, nachher);
    }
    return;
  }
  if (l.neuesZiel == l.altesZiel) return;   // dasselbe Ziel (neue Aufloesung): der Ton bleibt
  switch (nachher) {
    case TonQuelle::Person:                  // haengt am Ziel
      p.schritte.push_back(UmhaengSchritt::TonStandNeu);
      if (l.neuesZiel == 0) meldeTon(p, TonZustand::Off, TonGrund::participantLeft, nachher);
      else meldeTon(p, TonZustand::Waiting, TonGrund::targetChanged, nachher);
      break;
    case TonQuelle::Share:                   // Computerton haengt an der gezeigten Freigabe
      p.schritte.push_back(UmhaengSchritt::TonStandNeu);
      if (l.audio == SlotAudio::Person) break;   // mit Person-Ton: bleibt off/personNotInMode, nichts melden (RN5)
      if (l.neuesZiel == 0) meldeTon(p, TonZustand::Off, TonGrund::noShare, nachher);
      else meldeTon(p, TonZustand::Waiting, TonGrund::targetChanged, nachher);
      break;
    case TonQuelle::MixShare:                // Mischer-Slot: nur dessen Eingang B
      p.schritte.push_back(UmhaengSchritt::MischerEingangBNeu);
      break;
    case TonQuelle::Mix:                     // Mischton haengt an keinem Ziel (RR8)
    case TonQuelle::None:                    // Person-Ton ausserhalb von Teilnehmer ohne Computerton (S2)
      break;
  }
}

/** Schritte 6-8 (Abschluss): Ziel-Stand neu, Vorschau-Platz leeren, IsVideoOn (VIDEO), slot melden, Ton. */
inline void umhaengAbschluss(const UmhaengLage& l, UmhaengPlan& p) {
  p.schritte.push_back(UmhaengSchritt::ZielStandNeu);
  p.schritte.push_back(UmhaengSchritt::VorschauPlatzLeeren);
  if (l.neuesZiel == 0) {
    p.zustand = SlotState::Fallback;
    p.grund = ziel0Grund(l.aufruf, l.modusNachher);
  } else {
    if (rendererTyp(l.modusNachher) == RendererTyp::Video) p.schritte.push_back(UmhaengSchritt::IsVideoOnFragen);
    p.zustand = SlotState::Starting;
    p.grund = l.aufruf;
  }
  p.schritte.push_back(UmhaengSchritt::SlotMelden);
  tonBeimUmhaengen(l, p);
}

/**
 * Plan bis einschliesslich Subscribe (6.10 Schritte 0-5). Der Ausfuehrer (slotRetarget, A11/A12) setzt den Riegel
 * (umhaengen = true) vor dem ersten Schritt, subscribed = true nur nach Erfolg, umhaengen = false bei ZielStandNeu.
 * Endet der Plan mit Subscribe, entscheidet umhaengNachSubscribe ueber den Rest; scheitert ein CreateRenderer-
 * Schritt, bricht er ab und ruft umhaengNachSubscribe mit rendererGescheitert = true.
 */
inline UmhaengPlan umhaengPlan(const UmhaengLage& l) {
  UmhaengPlan p;
  if (l.sperre) {                           // Schritt 0: nichts aufrufen, nach INMEETING umhaengen
    p.schritte.push_back(UmhaengSchritt::Vormerken);
    return p;
  }
  if (l.abonniert && !l.rendererTot) p.schritte.push_back(UmhaengSchritt::Unsubscribe);   // Schritt 1
  if (l.rendererTot) {                      // Schritt 2: nie destroyRenderer an einem toten Renderer
    p.schritte.push_back(UmhaengSchritt::ZeigerVerwerfen);
    p.schritte.push_back(UmhaengSchritt::CreateRendererNeuerDelegate);
  }
  if (l.modusVorher != l.modusNachher && (l.modusVorher == SlotMode::Share || l.modusNachher == SlotMode::Share)) {
    p.schritte.push_back(UmhaengSchritt::VersatzLeeren);       // 6.14: clear() vor dem Wechsel von/zur Freigabe
    p.schritte.push_back(UmhaengSchritt::OhneVersatzSetzen);   // Freigabe-Slots ohne Versatz
  }
  if (l.neuesZiel == 0) {                   // Schritt 3: ohne Abo weiter mit Schritt 6
    umhaengAbschluss(l, p);
    return p;
  }
  p.schritte.push_back(UmhaengSchritt::SetResolution);   // Schritt 4 (resSet), danach resGot
  p.schritte.push_back(UmhaengSchritt::GetResolution);
  p.schritte.push_back(UmhaengSchritt::Subscribe);       // Schritt 5
  return p;
}

/**
 * Tabelle 6.10 Schritt 5-8 (B30, B32): Rueckgabe von subscribe(). versuch = Zahl der schon gelaufenen
 * Wiederholungen. Nach einem neuen Renderer (Typwechsel) ruft der Ausfuehrer erneut, mit letzterTyp = neuer Typ.
 */
inline UmhaengPlan umhaengNachSubscribe(const UmhaengLage& l, int sdkFehler, int versuch) {
  UmhaengPlan p;
  const RendererTyp typ = rendererTyp(l.modusNachher);
  if (!l.rendererGescheitert) {
    if (sdkFehler == FEHLER_KEINER) {
      // Nach einem 29 lief der Abschluss schon (starting/<grund>, Ziel-Stand, Ton, Mischer); ein zweiter setzte
      // Ton-Stand und Mischer erneut zurueck (Nachtrag N1.2). Der Zustand bleibt bis zum ersten Bild (6.10).
      if (!l.abschlussGelaufen) umhaengAbschluss(l, p);
      return p;
    }
    if (sdkFehler == FEHLER_ZU_OFT && versuch < ZU_OFT_WIEDERHOLUNGEN) {
      p.schritte.push_back(UmhaengSchritt::WiederholenIn500ms);   // Zaehler tooFrequent
      return p;
    }
    if (sdkFehler == FEHLER_KEINE_FREIGABEDATEN && typ == RendererTyp::Share) {
      if (!l.freigabeNochGezeigt) return p;   // diese Freigabe wird nicht mehr gezeigt: das naechste Umhaengen kommt
      if (versuch == 0) umhaengAbschluss(l, p);   // einmal: starting/<grund> (T20), Ziel-Stand neu
      p.schritte.push_back(UmhaengSchritt::WiederholenIn500ms);   // kein neuer Renderer; Zaehler noShareData
      return p;
    }
    if (typ != l.letzterTyp) {              // anderer Fehler mit Typwechsel: einmal neuer Renderer (AN11)
      p.schritte.push_back(UmhaengSchritt::DestroyRenderer);
      p.schritte.push_back(UmhaengSchritt::CreateRendererGleicherDelegate);
      p.schritte.push_back(UmhaengSchritt::SetResolution);
      p.schritte.push_back(UmhaengSchritt::GetResolution);
      p.schritte.push_back(UmhaengSchritt::Subscribe);
      return p;
    }
  }
  // anderer Fehler (auch 30, 18 nach drei Wiederholungen, nach neuem Renderer) oder createRenderer gescheitert
  p.schritte.push_back(UmhaengSchritt::ZielStandNeu);
  p.schritte.push_back(UmhaengSchritt::VorschauPlatzLeeren);
  p.zustand = SlotState::Fallback;
  p.grund = Grund::subscribeFailed;
  p.schritte.push_back(UmhaengSchritt::SlotMelden);
  p.schritte.push_back(UmhaengSchritt::FehlerSubscribeMelden);   // slotSubscribeFailed mit sdk und type
  tonBeimUmhaengen(l, p);
  return p;
}

/** Ergebnis von audioEnsureSubscribed() vor dem Umschalten (6.13, W6). */
enum class AboErgebnis : uint8_t { Geglueckt, Gescheitert, NichtGerufen };

/** Ton-Felder eines slotSet (oder slotOn: vorher off/false). Fehlt ein Feld, gilt das gespeicherte (N9-1). */
struct TonAenderung {
  bool audioGesetzt = false;
  SlotAudio audio = SlotAudio::Off;
  bool shareAudioGesetzt = false;
  bool shareAudio = false;
};

/**
 * Ob vor tonUmschaltPlan audioEnsureSubscribed() zu rufen ist (6.13, W6, N9-1): bei jedem slotOn/slotSet, das nach
 * dem Einsetzen der gespeicherten Felder audio != off oder shareAudio = true ergibt.
 */
inline bool tonAboNoetig(const UmhaengLage& l, const TonAenderung& a) {
  const SlotAudio audio = a.audioGesetzt ? a.audio : l.audio;
  const bool share = a.shareAudioGesetzt ? a.shareAudio : l.shareAudio;
  return audio != SlotAudio::Off || share;
}

/**
 * Ton am laufenden Slot umschalten (6.13 „Umschalten“, FS4, S2, W6; PB22). l.audio/l.shareAudio = bisher,
 * l.modusNachher = Modus des Slots, l.neuesZiel = sein Ziel. Jede Aenderung ersetzt den Ton-Stand, beim Wechsel in den
 * Mischer auch den Mischer. waiting/command nur nach geglücktem Abo, nach gescheitertem off/audioUnavailable;
 * danach off/personNotInMode (Person-Ton ausserhalb Teilnehmer), off/noShare (direkter Computerton ohne Freigabe)
 * bzw. off/command (Tonweg none).
 */
inline UmhaengPlan tonUmschaltPlan(const UmhaengLage& l, const TonAenderung& a, AboErgebnis abo) {
  UmhaengPlan p;
  const SlotAudio audio = a.audioGesetzt ? a.audio : l.audio;
  const bool share = a.shareAudioGesetzt ? a.shareAudio : l.shareAudio;
  const SlotMode modus = l.modusNachher;
  const TonQuelle weg = tonWeg(modus, audio, share);
  if (audio != l.audio || share != l.shareAudio) {
    p.schritte.push_back(UmhaengSchritt::TonStandNeu);
    if (weg == TonQuelle::MixShare) p.schritte.push_back(UmhaengSchritt::MischerNeu);
  }
  if (abo == AboErgebnis::Gescheitert) {
    meldeTon(p, TonZustand::Off, TonGrund::audioUnavailable, weg);
    return p;
  }
  if (abo == AboErgebnis::Geglueckt) meldeTon(p, TonZustand::Waiting, TonGrund::command, weg);
  if (audio == SlotAudio::Person && modus != SlotMode::Participant) {
    meldeTon(p, TonZustand::Off, TonGrund::personNotInMode, weg);
  } else if (weg == TonQuelle::Share && l.neuesZiel == 0) {
    meldeTon(p, TonZustand::Off, TonGrund::noShare, weg);
  } else if (weg == TonQuelle::None) {
    meldeTon(p, TonZustand::Off, TonGrund::command, weg);
  }
  return p;
}

/**
 * Ob ein Plan einen Renderer-Schritt enthaelt (Unsubscribe, ZeigerVerwerfen, CreateRenderer..., DestroyRenderer,
 * SetResolution, GetResolution, Subscribe). Nur ein solcher Plan wartet waehrend der Renderer-Sperre (6.5, 6.10
 * Schritt 0); reine Ton- und Feld-Plaene (TonStandNeu, MischerNeu, MischerEingangBNeu, TonMelden, Vormerken, ...)
 * laufen auch dann (Nachtrag N1.3, Task-14-Review I1; Einsatz im Ausfuehrer: N2b).
 */
inline bool planBrauchtRenderer(const UmhaengPlan& plan) {
  for (const UmhaengSchritt s : plan.schritte) {
    switch (s) {
      case UmhaengSchritt::Unsubscribe:
      case UmhaengSchritt::ZeigerVerwerfen:
      case UmhaengSchritt::CreateRendererNeuerDelegate:
      case UmhaengSchritt::DestroyRenderer:
      case UmhaengSchritt::CreateRendererGleicherDelegate:
      case UmhaengSchritt::SetResolution:
      case UmhaengSchritt::GetResolution:
      case UmhaengSchritt::Subscribe:
        return true;
      case UmhaengSchritt::Vormerken:
      case UmhaengSchritt::WiederholenIn500ms:
      case UmhaengSchritt::ZielStandNeu:
      case UmhaengSchritt::VorschauPlatzLeeren:
      case UmhaengSchritt::IsVideoOnFragen:
      case UmhaengSchritt::SlotMelden:
      case UmhaengSchritt::FehlerSubscribeMelden:
      case UmhaengSchritt::TonStandNeu:
      case UmhaengSchritt::MischerEingangBNeu:
      case UmhaengSchritt::MischerNeu:
      case UmhaengSchritt::TonMelden:
      case UmhaengSchritt::VersatzLeeren:
      case UmhaengSchritt::OhneVersatzSetzen:
        break;
    }
  }
  return false;
}

/** Ergebnis des Stille-Herzschlags: Abtastwerte je Kanal und der neue silenceBisMs. */
struct StilleErgebnis {
  int abtastwerte = 0;
  int64_t neuerSilenceBisMs = 0;
};
inline constexpr int64_t STILLE_SCHWELLE_MS = 40;
inline constexpr int64_t STILLE_HOECHSTENS_MS = 200;

/**
 * Stille-Herzschlag (6.13, heutige Rechnung video.cpp:1035-1086; PB30): nie fuer none und mixShare (der Mischer
 * liefert seine Stille selbst), person und share nur mit Ziel != 0, mix auch mit Ziel 0 (RN7); erst mit bekanntem
 * Format; ab 40 ms ohne Paket, Beginn bei max(silenceBisMs, lastAudioMs), hoechstens 200 ms je Aufruf, der Rest
 * verfaellt (RN6). Neuer silenceBisMs = gekappter Beginn + tatsaechlich gesendete Zeit.
 */
inline StilleErgebnis stilleBloecke(TonQuelle tonweg, unsigned ziel, const TonStand& ton, int64_t jetzt) {
  StilleErgebnis r;
  r.neuerSilenceBisMs = ton.silenceBisMs;
  if (tonweg == TonQuelle::None || tonweg == TonQuelle::MixShare) return r;
  if ((tonweg == TonQuelle::Person || tonweg == TonQuelle::Share) && ziel == 0) return r;
  if (ton.audioRate <= 0 || ton.audioChannels <= 0) return r;
  const int64_t seitTon = jetzt > ton.lastAudioMs ? jetzt - ton.lastAudioMs : 0;
  if (seitTon < STILLE_SCHWELLE_MS) return r;
  int64_t bis = ton.silenceBisMs > ton.lastAudioMs ? ton.silenceBisMs : ton.lastAudioMs;
  int64_t spanne = jetzt > bis ? jetzt - bis : 0;
  if (spanne > STILLE_HOECHSTENS_MS) {
    spanne = STILLE_HOECHSTENS_MS;
    bis = jetzt - STILLE_HOECHSTENS_MS;
  }
  const int64_t bloecke = spanne * ton.audioRate / 1000;
  if (bloecke <= 0) return r;
  r.abtastwerte = static_cast<int>(bloecke);
  r.neuerSilenceBisMs = bis + bloecke * 1000 / ton.audioRate;
  return r;
}

// ---- Abbau-Ketten (Spec 6.15, Nachfix W2/W3, Fuenfte Runde N8; Task A8) ----------------------------------

/** Die Ketten aus Tabelle 6.15 (Leave in zwei Plaenen: Leave bis SessionLeave, LeaveNachlauf mit dessen Rueckgabe). */
enum class Kette : uint8_t {
  SlotOff, Leave, LeaveNachlauf, QuitEof, MeetingEndetSich, MeetingEnde, Entzug, Weggang, FreigabeEndet, InMeetingErneut
};

/**
 * Schritte der Ketten. Die Schritte mit Slot-Bezug (TonAusMelden bis InHalteliste) bilden in jedem Plan einen
 * zusammenhaengenden Block, den der Ausfuehrer abbauAusfuehren (A14) je betroffenem Slot ausfuehrt, die uebrigen
 * einmal. Ergaenzt gegenueber der Gliederung (Weggang, Freigabe-Ende): FreigabenDerPersonEntfernen,
 * ErinnerungOhneKennung, Umhaengen (= slotRetarget nach 6.10; waehrend der Sperre merkt umhaengPlan nur vor).
 */
enum class AbbauSchritt : uint8_t {
  AudioShutdown, AudioClearSubscribed, TonAusMelden, SlotAusMelden, VorschauPlatzAbmelden, Unsubscribe,
  DestroyRenderer, ZeigerVerwerfen, SenderZu, SlotLoeschen, InHalteliste, HaltelisteAbbauen, HaltelisteVerwerfen,
  FreigabenLeeren, ErinnerungLeeren, VorschauThreadEnde, StopRawRecording, SessionLeave, SperreAn, SperreLoesen,
  EigeneKennungNeu, FreigabenBefuellen, UmhaengenVormerken, FreigabenDerPersonEntfernen, ErinnerungOhneKennung,
  Umhaengen
};

/**
 * Slot-Block einer Kette: slotAudio off vor slot off (wie video.cpp:595-596), Vorschau-Platz ab, dann Renderer und
 * Sender. Waehrend der Renderer-Sperre statt der Renderer-Aufrufe und des Loeschens: Sender zu und der ganze Slot in
 * die Halteliste (Nachfix W2). rendererAnfassen = false (Meeting-Ende): nur Zeiger verwerfen, nie ein SDK-Aufruf.
 */
inline void slotBlock(std::vector<AbbauSchritt>& s, bool sperre, bool rendererAnfassen) {
  s.push_back(AbbauSchritt::TonAusMelden);
  s.push_back(AbbauSchritt::SlotAusMelden);
  s.push_back(AbbauSchritt::VorschauPlatzAbmelden);
  if (sperre && rendererAnfassen) {
    s.push_back(AbbauSchritt::SenderZu);
    s.push_back(AbbauSchritt::InHalteliste);
    return;
  }
  if (rendererAnfassen) {
    s.push_back(AbbauSchritt::Unsubscribe);
    s.push_back(AbbauSchritt::DestroyRenderer);
  } else {
    s.push_back(AbbauSchritt::ZeigerVerwerfen);
  }
  s.push_back(AbbauSchritt::SenderZu);
  s.push_back(AbbauSchritt::SlotLoeschen);
}

/**
 * Tabelle 6.15 als Schrittfolge (PB20). sperre = Renderer-Sperre gilt; verlassen = Rueckgabe von sessionLeave() (nur
 * fuer LeaveNachlauf). Der Ausfuehrer ersetzt bei rendererTot eines Slots Unsubscribe und DestroyRenderer durch
 * ZeigerVerwerfen (fuerSlot). quit/EOF: sessionShutdown() ruft main.cpp danach wie heute (kein Plan-Schritt).
 */
inline std::vector<AbbauSchritt> abbauPlan(Kette kette, bool sperre, bool verlassen = false) {
  std::vector<AbbauSchritt> s;
  switch (kette) {
    case Kette::SlotOff:
      slotBlock(s, sperre, true);
      break;
    case Kette::Leave:
      s.push_back(AbbauSchritt::AudioShutdown);
      s.push_back(AbbauSchritt::FreigabenLeeren);
      s.push_back(AbbauSchritt::ErinnerungLeeren);
      slotBlock(s, sperre, true);
      s.push_back(AbbauSchritt::SessionLeave);
      break;
    case Kette::LeaveNachlauf:
      if (verlassen) s.push_back(AbbauSchritt::HaltelisteVerwerfen);   // false: Halteliste bleibt bis Prozessende
      break;
    case Kette::QuitEof:
      s.push_back(AbbauSchritt::AudioShutdown);
      s.push_back(AbbauSchritt::VorschauThreadEnde);                    // vor dem Loeschen der Slots (B18)
      s.push_back(AbbauSchritt::FreigabenLeeren);
      s.push_back(AbbauSchritt::ErinnerungLeeren);
      slotBlock(s, sperre, true);
      break;
    case Kette::MeetingEndetSich:
      s.push_back(AbbauSchritt::SperreAn);                              // Renderer und Sender bleiben
      break;
    case Kette::MeetingEnde:
      s.push_back(AbbauSchritt::AudioClearSubscribed);
      s.push_back(AbbauSchritt::FreigabenLeeren);
      s.push_back(AbbauSchritt::ErinnerungLeeren);
      slotBlock(s, sperre, false);                                      // ohne SDK-Aufruf am Renderer
      s.push_back(AbbauSchritt::HaltelisteVerwerfen);
      s.push_back(AbbauSchritt::SperreLoesen);
      break;
    case Kette::Entzug:
      s.push_back(AbbauSchritt::AudioClearSubscribed);
      slotBlock(s, sperre, true);
      s.push_back(AbbauSchritt::StopRawRecording);                      // Freigaben und Erinnerung bleiben (W3)
      break;
    case Kette::Weggang:
      s.push_back(AbbauSchritt::FreigabenDerPersonEntfernen);
      s.push_back(AbbauSchritt::ErinnerungOhneKennung);
      s.push_back(AbbauSchritt::Umhaengen);                             // Ziel 0, Sender bleibt
      break;
    case Kette::FreigabeEndet:
      s.push_back(AbbauSchritt::Umhaengen);
      break;
    case Kette::InMeetingErneut:
      s.push_back(AbbauSchritt::SperreLoesen);
      s.push_back(AbbauSchritt::HaltelisteAbbauen);                     // nach dem Loesen, vor jedem Umhaengen
      s.push_back(AbbauSchritt::EigeneKennungNeu);
      s.push_back(AbbauSchritt::ErinnerungLeeren);
      s.push_back(AbbauSchritt::FreigabenLeeren);
      s.push_back(AbbauSchritt::FreigabenBefuellen);
      s.push_back(AbbauSchritt::UmhaengenVormerken);
      break;
  }
  return s;
}

/** Plan fuer einen Slot mit rendererTot: statt Unsubscribe und DestroyRenderer nur ZeigerVerwerfen (6.10, B32). */
inline std::vector<AbbauSchritt> fuerSlot(const std::vector<AbbauSchritt>& plan, bool rendererTot) {
  if (!rendererTot) return plan;
  std::vector<AbbauSchritt> aus;
  for (AbbauSchritt s : plan) {
    if (s == AbbauSchritt::DestroyRenderer) continue;
    aus.push_back(s == AbbauSchritt::Unsubscribe ? AbbauSchritt::ZeigerVerwerfen : s);
  }
  return aus;
}

/** HaltelisteAbbauen je Eintrag: unSubscribe + destroyRenderer, bei rendererTot keins von beiden; dann loeschen. */
inline std::vector<AbbauSchritt> halteEintragAbbauen(bool rendererTot) {
  if (rendererTot) return {AbbauSchritt::SlotLoeschen};
  return {AbbauSchritt::Unsubscribe, AbbauSchritt::DestroyRenderer, AbbauSchritt::SlotLoeschen};
}

/** Ein INMEETING baut nur Eintraege desselben Meetings ab; aeltere fasst es nie an (join zaehlt die Nummer hoch). */
inline bool halteEintragGehoertZu(uint32_t eintragMeeting, uint32_t meeting) { return eintragMeeting == meeting; }

// ---- Base64 fuer die Vorschau (Spec 6.16; genutzt von native/preview.cpp, A13) ----------------------------

inline std::string base64(const uint8_t* daten, size_t n) {
  static constexpr char kZeichen[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string aus;
  aus.reserve((n + 2) / 3 * 4);
  size_t i = 0;
  for (; i + 2 < n; i += 3) {
    const uint32_t v = (uint32_t{daten[i]} << 16) | (uint32_t{daten[i + 1]} << 8) | uint32_t{daten[i + 2]};
    aus += kZeichen[(v >> 18) & 63];
    aus += kZeichen[(v >> 12) & 63];
    aus += kZeichen[(v >> 6) & 63];
    aus += kZeichen[v & 63];
  }
  if (i < n) {
    const bool zwei = i + 1 < n;
    const uint32_t v = (uint32_t{daten[i]} << 16) | (zwei ? uint32_t{daten[i + 1]} << 8 : 0u);
    aus += kZeichen[(v >> 18) & 63];
    aus += kZeichen[(v >> 12) & 63];
    aus += zwei ? kZeichen[(v >> 6) & 63] : '=';
    aus += '=';
  }
  return aus;
}

}  // namespace slotlogic

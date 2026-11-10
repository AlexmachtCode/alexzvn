// Selbsttest der Entscheidungslogik der Zoom-Slots (slot_logic.h, Spec 11.1) - OHNE Zoom, OHNE NDI, OHNE
// Uhr: jede Zeit wird eingespeist. Laeuft darum unter Windows und Linux, auch in der CI.
//
//   npm run logik-test -w @jm/zoom-bridge     (Compiler direkt, auch CI)
//   npm run slot-test -w @jm/zoom-bridge      (lokal ueber CMake, braucht beide SDKs)
//
// Aufbau wie delay_line_test.cpp: Makro CHECK, eingespeiste Zeit at(ms), je Fall eine Funktion mit
// gedrucktem Titel, Aufruf in main(). Rueckgabewert 0 = alles gruen, 1 = mindestens eine Pruefung gefallen.
#include "slot_logic.h"

#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

namespace {

using namespace slotlogic;

int g_run = 0;
int g_fail = 0;

#define CHECK(cond)                                                          \
  do {                                                                       \
    ++g_run;                                                                 \
    if (!(cond)) {                                                           \
      ++g_fail;                                                              \
      std::printf("  FEHLER %s:%d: %s\n", __FILE__, __LINE__, #cond);        \
    }                                                                        \
  } while (0)

/** Eingespeiste Bridge-Uhr in Millisekunden (Muster delay_line_test.cpp:29). */
int64_t at(int ms) { return static_cast<int64_t>(ms); }

bool gleich(const char* a, const char* b) { return std::strcmp(a, b) == 0; }

// Kennungen wie in den Attrappen-Namen (A-EP22); EIGENE ist die Bridge selbst.
constexpr unsigned EIGENE = 16778200;
constexpr unsigned A = 16778240;
constexpr unsigned B = 16778241;
constexpr unsigned C = 16778242;

bool alleKameraAn(unsigned) { return true; }
const KameraAn KAMERA_AN = alleKameraAn;
/** Kamera an fuer alle ausser `aus`. */
KameraAn ohneKamera(unsigned aus) {
  return [aus](unsigned id) { return id != aus; };
}

SprecherEinstellung einstellung(Signal s, int64_t haltezeitMs, bool showNoVideo) {
  SprecherEinstellung e;
  e.signal = s;
  e.haltezeitMs = haltezeitMs;
  e.showNoVideo = showNoVideo;
  return e;
}

void a4_namen() {
  std::printf("A4 Namen: jede Aufzaehlung findet ihren Namen am eigenen Index\n");
  CHECK(gleich(name(SlotMode::Speaker), "speaker"));
  CHECK(gleich(name(Fallback::White), "white"));
  CHECK(gleich(name(SlotAudio::Person), "person"));
  CHECK(gleich(name(Sent::Held), "held"));
  CHECK(gleich(name(SlotState::Fallback), "fallback"));
  CHECK(gleich(name(Grund::noFrames), "noFrames"));
  CHECK(gleich(name(Grund::privilegeRevoked), "privilegeRevoked"));
  CHECK(gleich(name(TonGrund::personNotInMode), "personNotInMode"));
  CHECK(gleich(name(TonQuelle::MixShare), "mixShare"));
  CHECK(gleich(name(TonZustand::Silent), "silent"));
  CHECK(gleich(name(Signal::ActiveAudio), "activeAudio"));
}

void pb1_haltezeit_genau() {
  std::printf("PB1 Sprecher: Kandidat B neben gezeigtem A wechselt bei 999 ms nicht, bei 1000 ms schon\n");
  SprecherWahl w(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  SprecherSchritt s = w.signal(Signal::SpeakerVideo, {A}, KAMERA_AN, at(0));
  CHECK(s.wechsel && s.ziel == A);
  s = w.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(1000));
  CHECK(!s.wechsel && w.ziel() == A);
  s = w.tick(KAMERA_AN, at(1999));
  CHECK(!s.wechsel && w.ziel() == A);
  s = w.tick(KAMERA_AN, at(2000));
  CHECK(s.wechsel && s.ziel == B && s.grund == Grund::speakerChanged);
  CHECK(w.ziel() == B);
}

void pb2_neuer_kandidat_startet_neu() {
  std::printf("PB2 Sprecher: B (0 ms), C (400 ms), B (800 ms) - kein Wechsel vor 1800 ms\n");
  SprecherWahl w(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  w.signal(Signal::SpeakerVideo, {A}, KAMERA_AN, at(0));
  w.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(1000));
  w.signal(Signal::SpeakerVideo, {C}, KAMERA_AN, at(1400));
  SprecherSchritt s = w.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(1800));
  CHECK(!s.wechsel);
  s = w.tick(KAMERA_AN, at(2000));   // 1000 ms nach dem ersten B: die Zeit lief neu
  CHECK(!s.wechsel && w.ziel() == A);
  s = w.tick(KAMERA_AN, at(2400));   // 1000 ms nach C: C ist nicht mehr Kandidat
  CHECK(!s.wechsel && w.ziel() == A);
  s = w.tick(KAMERA_AN, at(2799));
  CHECK(!s.wechsel && w.ziel() == A);
  s = w.tick(KAMERA_AN, at(2800));
  CHECK(s.wechsel && s.ziel == B);
}

void pb3_ohne_ziel_sofort() {
  std::printf("PB3 Sprecher: ohne Ziel wechselt das erste Signal sofort, ohne Haltezeit\n");
  SprecherWahl w(einstellung(Signal::SpeakerVideo, 5000, true), EIGENE);
  CHECK(w.ziel() == 0);
  const SprecherSchritt s = w.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(10));
  CHECK(s.wechsel && s.ziel == B && s.grund == Grund::speakerChanged);
}

void pb4_eigene_und_null_nie() {
  std::printf("PB4 Sprecher: eigene Kennung und Kennung 0 nie Kandidat, je Signal, auch nicht als Vorbelegung\n");
  const Signal alle[3] = {Signal::SpeakerVideo, Signal::ActiveVideo, Signal::ActiveAudio};
  for (Signal sig : alle) {
    SprecherWahl w(einstellung(sig, 0, true), EIGENE);
    SprecherSchritt s = w.signal(sig, {EIGENE}, KAMERA_AN, at(0));
    CHECK(!s.wechsel && w.ziel() == 0);
    s = w.signal(sig, {0}, KAMERA_AN, at(10));
    CHECK(!s.wechsel && w.ziel() == 0);
    SprecherErinnerung er;
    er.melde(sig, {EIGENE}, at(20));
    SprecherWahl v1(einstellung(sig, 0, true), EIGENE);
    s = v1.vorbelegen(er, KAMERA_AN, at(30));
    CHECK(!s.wechsel && s.ziel == 0 && s.grund == Grund::speakerNone);
    er.melde(sig, {0}, at(40));
    SprecherWahl v2(einstellung(sig, 0, true), EIGENE);
    s = v2.vorbelegen(er, KAMERA_AN, at(50));
    CHECK(!s.wechsel && v2.ziel() == 0);
  }
  SprecherWahl audio(einstellung(Signal::ActiveAudio, 0, true), EIGENE);
  const SprecherSchritt s = audio.signal(Signal::ActiveAudio, {EIGENE, 0}, KAMERA_AN, at(60));
  CHECK(!s.wechsel && audio.ziel() == 0);
}

void pb5_aktives_audio_liste() {
  std::printf("PB5 Sprecher: activeAudio [eigene, 7, 9] -> 7; danach [] aendert nichts\n");
  SprecherWahl w(einstellung(Signal::ActiveAudio, 1000, true), EIGENE);
  SprecherSchritt s = w.signal(Signal::ActiveAudio, {EIGENE, 7, 9}, KAMERA_AN, at(0));
  CHECK(s.wechsel && s.ziel == 7);
  s = w.signal(Signal::ActiveAudio, {}, KAMERA_AN, at(100));
  CHECK(!s.wechsel && w.ziel() == 7);
  s = w.tick(KAMERA_AN, at(5000));
  CHECK(!s.wechsel && w.ziel() == 7);
  SprecherErinnerung er;
  er.melde(Signal::ActiveAudio, {EIGENE, 7, 9}, at(0));
  er.melde(Signal::ActiveAudio, {}, at(100));
  CHECK(er.letzte(Signal::ActiveAudio) != nullptr && er.letzte(Signal::ActiveAudio)->size() == 3);
}

void pb6_ohne_kamera() {
  std::printf("PB6 Sprecher: Kandidat ohne Kamera wird bei showNoVideo aus uebersprungen, bei an Ziel\n");
  SprecherWahl aus(einstellung(Signal::SpeakerVideo, 1000, false), EIGENE);
  SprecherSchritt s = aus.signal(Signal::SpeakerVideo, {B}, ohneKamera(B), at(0));
  CHECK(!s.wechsel && aus.ziel() == 0);
  SprecherWahl an(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  s = an.signal(Signal::SpeakerVideo, {B}, ohneKamera(B), at(0));
  CHECK(s.wechsel && s.ziel == B);
  // Waehrend der Haltezeit schaltet der Kandidat die Kamera aus: bei showNoVideo aus kein Wechsel.
  SprecherWahl halt(einstellung(Signal::SpeakerVideo, 1000, false), EIGENE);
  halt.signal(Signal::SpeakerVideo, {A}, KAMERA_AN, at(0));
  halt.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(100));
  s = halt.tick(ohneKamera(B), at(1100));
  CHECK(!s.wechsel && halt.ziel() == A);
  // activeAudio: der erste Kandidat ohne Kamera wird uebersprungen, der naechste gilt (E-a2-2).
  SprecherWahl liste(einstellung(Signal::ActiveAudio, 1000, false), EIGENE);
  s = liste.signal(Signal::ActiveAudio, {B, C}, ohneKamera(B), at(0));
  CHECK(s.wechsel && s.ziel == C);
}

void pb7_nur_gewaehltes_signal() {
  std::printf("PB7 Sprecher: activeVideo gewaehlt, nur speakerVideo kommt -> kein Wechsel\n");
  SprecherWahl w(einstellung(Signal::ActiveVideo, 0, true), EIGENE);
  SprecherSchritt s = w.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(0));
  CHECK(!s.wechsel && w.ziel() == 0);
  s = w.signal(Signal::ActiveAudio, {B}, KAMERA_AN, at(10));
  CHECK(!s.wechsel && w.ziel() == 0);
  s = w.signal(Signal::ActiveVideo, {B}, KAMERA_AN, at(20));
  CHECK(s.wechsel && s.ziel == B);
}

void pb8_gezeigter_geht() {
  std::printf("PB8 Sprecher: gezeigter geht -> Ziel 0 (speakerNone), naechster sofort, Erinnerung ohne ihn\n");
  SprecherWahl w(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  w.signal(Signal::SpeakerVideo, {A}, KAMERA_AN, at(0));
  SprecherSchritt s = w.weggang(B, at(50));
  CHECK(!s.wechsel && w.ziel() == A);
  s = w.weggang(A, at(100));
  CHECK(s.wechsel && s.ziel == 0 && s.grund == Grund::speakerNone);
  s = w.signal(Signal::SpeakerVideo, {C}, KAMERA_AN, at(150));
  CHECK(s.wechsel && s.ziel == C);
  SprecherErinnerung er;
  er.melde(Signal::SpeakerVideo, {A}, at(0));
  er.melde(Signal::ActiveAudio, {A, C}, at(0));
  er.entferne(A);
  CHECK(er.letzte(Signal::SpeakerVideo) == nullptr);
  CHECK(er.letzte(Signal::ActiveAudio) != nullptr && *er.letzte(Signal::ActiveAudio) == std::vector<unsigned>{C});
  // Geht der wartende Kandidat, verfaellt sein Wechsel.
  SprecherWahl k(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  k.signal(Signal::SpeakerVideo, {A}, KAMERA_AN, at(0));
  k.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(100));
  k.weggang(B, at(200));
  s = k.tick(KAMERA_AN, at(1100));
  CHECK(!s.wechsel && k.ziel() == A);
}

void pb9_haltezeit_grenzen() {
  std::printf("PB9 Sprecher: Haltezeit 0 wechselt sofort, 5000 erst nach 5000 ms\n");
  SprecherWahl null(einstellung(Signal::SpeakerVideo, 0, true), EIGENE);
  null.signal(Signal::SpeakerVideo, {A}, KAMERA_AN, at(0));
  SprecherSchritt s = null.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(10));
  CHECK(s.wechsel && s.ziel == B);
  SprecherWahl lang(einstellung(Signal::SpeakerVideo, 5000, true), EIGENE);
  lang.signal(Signal::SpeakerVideo, {A}, KAMERA_AN, at(0));
  lang.signal(Signal::SpeakerVideo, {B}, KAMERA_AN, at(100));
  s = lang.tick(KAMERA_AN, at(5099));
  CHECK(!s.wechsel && lang.ziel() == A);
  s = lang.tick(KAMERA_AN, at(5100));
  CHECK(s.wechsel && s.ziel == B);
}

void pb26_erinnerung_belegt_vor() {
  std::printf("PB26 Sprecher-Erinnerung: neue SprecherWahl vorbelegt; Moduswechsel, Entzug; INMEETING leert\n");
  SprecherErinnerung er;
  er.melde(Signal::SpeakerVideo, {B}, at(100));       // Signal kam, bevor ein Sprecher-Slot lief
  SprecherWahl ein(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  SprecherSchritt s = ein.vorbelegen(er, KAMERA_AN, at(500));
  CHECK(s.wechsel && s.ziel == B && ein.ziel() == B);
  // Moduswechsel auf Sprecher, waehrend derselbe spricht: wieder derselbe.
  SprecherWahl modus(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  s = modus.vorbelegen(er, KAMERA_AN, at(900));
  CHECK(s.ziel == B);
  // Entzug und Wiedererteilung leeren die Erinnerung nicht (6.8): die Vorbelegung bleibt.
  SprecherWahl nachEntzug(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  s = nachEntzug.vorbelegen(er, KAMERA_AN, at(5000));
  CHECK(s.ziel == B);
  CHECK(er.letzteMs(Signal::SpeakerVideo) == 100);
  // Vorbelegung nach Regel 3: ohne Kamera bei showNoVideo aus kein Ziel.
  SprecherWahl ohne(einstellung(Signal::SpeakerVideo, 1000, false), EIGENE);
  s = ohne.vorbelegen(er, ohneKamera(B), at(5000));
  CHECK(!s.wechsel && s.ziel == 0 && s.grund == Grund::speakerNone);
  // INMEETING: Kennungen wechseln, die Erinnerung ist leer.
  er.leeren();
  SprecherWahl neu(einstellung(Signal::SpeakerVideo, 1000, true), EIGENE);
  s = neu.vorbelegen(er, KAMERA_AN, at(6000));
  CHECK(!s.wechsel && s.ziel == 0 && s.grund == Grund::speakerNone);
  CHECK(er.letzte(Signal::SpeakerVideo) == nullptr && er.letzteMs(Signal::SpeakerVideo) == 0);
}

// Freigaben (Task A5). Kennungen der Personen wie oben, Freigabe-Kennungen 101, 102, 103.
constexpr unsigned F1 = 101;
constexpr unsigned F2 = 102;
constexpr unsigned F3 = 103;

unsigned gezeigteFreigabe(const FreigabeListe& l) { return l.gezeigt() != nullptr ? l.gezeigt()->share : 0; }

FreigabeEintrag zoomEintrag(unsigned user, unsigned share, int typ) {
  FreigabeEintrag e;
  e.user = user;
  e.share = share;
  e.type = static_cast<uint8_t>(typ);
  return e;
}

void a5_namen() {
  std::printf("A5 Freigabe-Namen: Status- und Typ-Werte des Headers finden ihren Namen\n");
  CHECK(gleich(SHARING_STATUS_NAMEN[STATUS_FREMD_BEGINN], "otherShareBegin"));
  CHECK(gleich(SHARING_STATUS_NAMEN[STATUS_FREMD_TON_ENDE], "otherSharePureAudioEnd"));
  CHECK(gleich(SHARING_STATUS_NAMEN[STATUS_PAUSE], "pause"));
  CHECK(gleich(sharingStatusName(STATUS_WEITER), "resume"));
  CHECK(sharingStatusName(11) == nullptr && sharingStatusName(-1) == nullptr);
  CHECK(gleich(shareTypName(2), "ds"));
  CHECK(gleich(shareTypName(TYP_COMPUTERTON), "computerAudio"));
  CHECK(gleich(shareTypName(42), "unknown"));
  CHECK(gleich(name(Befuellt::NichtVerfuegbar), "unavailable"));
}

void pb10_ruecksprung() {
  std::printf("PB10 Freigabe: Begin A, Begin B, End B, End A -> gezeigt A, B, A, keine\n");
  FreigabeListe l;
  CHECK(l.status(STATUS_FREMD_BEGINN, A, F1, 2));
  CHECK(gezeigteFreigabe(l) == F1);
  CHECK(l.status(STATUS_FREMD_BEGINN, B, F2, 1));
  CHECK(gezeigteFreigabe(l) == F2);
  CHECK(l.status(STATUS_FREMD_ENDE, B, F2, 1));
  CHECK(gezeigteFreigabe(l) == F1);
  CHECK(l.status(STATUS_FREMD_ENDE, A, F1, 2));
  CHECK(gezeigteFreigabe(l) == 0 && l.gezeigt() == nullptr);
  CHECK(l.bildFreigaben() == 0);
}

void pb11_pause() {
  std::printf("PB11 Freigabe: Pause/Resume der gezeigten; Pause mit Kennung 0 trifft alle Eintraege der Person\n");
  FreigabeListe l;
  l.status(STATUS_FREMD_BEGINN, A, F1, 2);
  CHECK(l.status(STATUS_PAUSE, A, F1, 2));
  CHECK(gezeigteFreigabe(l) == F1 && l.gezeigt()->paused && l.gezeigt()->pauses == 1);
  CHECK(!l.status(STATUS_PAUSE, A, F1, 2));   // schon pausiert: keine Aenderung, kein zweites Zaehlen
  CHECK(l.status(STATUS_WEITER, A, F1, 2));
  CHECK(gezeigteFreigabe(l) == F1 && !l.gezeigt()->paused && l.gezeigt()->pauses == 1);
  l.status(STATUS_PAUSE, A, F1, 2);
  CHECK(l.gezeigt()->pauses == 2);
  FreigabeListe zwei;
  zwei.status(STATUS_FREMD_BEGINN, A, F1, 2);
  zwei.status(STATUS_FREMD_BEGINN, A, F2, 1);
  zwei.status(STATUS_FREMD_BEGINN, B, F3, 2);
  CHECK(zwei.status(STATUS_PAUSE, A, 0, 0));
  int pausiertA = 0;
  for (const FreigabeEintrag& e : zwei.eintraege()) {
    if (e.user == A && e.paused) ++pausiertA;
    if (e.user == B) CHECK(!e.paused);
  }
  CHECK(pausiertA == 2);
  CHECK(gezeigteFreigabe(zwei) == F3);
}

void pb12_tonfreigabe_nie_gezeigt() {
  std::printf("PB12 Freigabe: reine Ton-Freigabe nach einer Bild-Freigabe wird nie gezeigt\n");
  FreigabeListe l;
  l.status(STATUS_FREMD_BEGINN, A, F1, 2);
  CHECK(l.status(STATUS_FREMD_TON_BEGINN, B, F2, TYP_COMPUTERTON));
  CHECK(gezeigteFreigabe(l) == F1);
  CHECK(l.bildFreigaben() == 1 && l.eintraege().size() == 2);
  l.status(STATUS_FREMD_ENDE, A, F1, 2);
  CHECK(gezeigteFreigabe(l) == 0);
  CHECK(l.status(STATUS_FREMD_TON_ENDE, B, F2, TYP_COMPUTERTON));
  CHECK(l.eintraege().empty());
}

void pb13_person_geht() {
  std::printf("PB13 Freigabe: Person mit Freigabe geht -> ihre Eintraege weg, die naechstjuengere wird gezeigt\n");
  FreigabeListe l;
  l.status(STATUS_FREMD_BEGINN, A, F1, 2);
  l.status(STATUS_FREMD_BEGINN, B, F2, 2);
  l.status(STATUS_FREMD_BEGINN, B, F3, 1);
  CHECK(gezeigteFreigabe(l) == F3);
  CHECK(l.weggang(B));
  CHECK(gezeigteFreigabe(l) == F1 && l.eintraege().size() == 1);
  CHECK(!l.weggang(C));
}

void pb14_eigene_freigaben_nichts() {
  std::printf("PB14 Freigabe: Sharing_Self_* und Sharing_View_Other_Sharing aendern nichts\n");
  FreigabeListe l;
  l.status(STATUS_FREMD_BEGINN, A, F1, 2);
  const int nichts[5] = {STATUS_EIGEN_BEGINN, STATUS_EIGEN_ENDE, STATUS_EIGEN_TON_BEGINN, STATUS_EIGEN_TON_ENDE,
                         STATUS_ANSICHT_FREMD};
  for (int s : nichts) {
    CHECK(!l.status(s, B, F2, 2));
    CHECK(!l.status(s, A, F1, 2));
  }
  CHECK(l.eintraege().size() == 1 && gezeigteFreigabe(l) == F1 && !l.gezeigt()->paused);
}

void pb15_befuellen() {
  std::printf("PB15 Freigabe: INMEETING leert und befuellt; Einschalten ergaenzt nur; empty/unavailable loescht nichts\n");
  FreigabeListe l;
  l.status(STATUS_FREMD_BEGINN, A, F1, 2);
  const std::vector<FreigabeEintrag> zoom = {zoomEintrag(B, F2, 2), zoomEintrag(C, F3, 1)};
  CHECK(l.befuellen(&zoom, false) == Befuellt::Ok);   // INMEETING
  CHECK(l.eintraege().size() == 2 && l.eintraege()[0].share == F2 && l.eintraege()[1].share == F3);
  CHECK(l.eintraege()[0].seq < l.eintraege()[1].seq);
  CHECK(gezeigteFreigabe(l) == F3);
  FreigabeListe ein;
  ein.status(STATUS_FREMD_BEGINN, A, F1, 2);
  const uint64_t seqA = ein.gezeigt()->seq;
  const std::vector<FreigabeEintrag> zoom2 = {zoomEintrag(B, F2, 2), zoomEintrag(A, F1, 2), zoomEintrag(C, F3, 1)};
  CHECK(ein.befuellen(&zoom2, true) == Befuellt::Ok);   // erstes Einschalten
  CHECK(ein.eintraege().size() == 3);
  CHECK(gezeigteFreigabe(ein) == F1 && ein.gezeigt()->seq == seqA);
  uint64_t seqB = 0;
  uint64_t seqC = 0;
  for (const FreigabeEintrag& e : ein.eintraege()) {
    if (e.share == F2) seqB = e.seq;
    if (e.share == F3) seqC = e.seq;
  }
  CHECK(seqB < seqC && seqC < seqA);
  ein.status(STATUS_FREMD_BEGINN, B, 104, 2);            // spaeter per Rueckruf: ueber allen befuellten
  CHECK(gezeigteFreigabe(ein) == 104);
  const std::vector<FreigabeEintrag> leer;
  CHECK(ein.befuellen(&leer, true) == Befuellt::Leer && ein.eintraege().size() == 4);
  CHECK(ein.befuellen(nullptr, true) == Befuellt::NichtVerfuegbar && ein.eintraege().size() == 4);
  CHECK(ein.befuellen(nullptr, false) == Befuellt::NichtVerfuegbar && ein.eintraege().empty());   // INMEETING ohne Liste
}

void pb27_typ_nachtrag() {
  std::printf("PB27 Freigabe: Typ-Nachtrag ohne neues seq; COMPUTER_AUDIO -> audioOnly; Kennung 0 nachgezogen\n");
  FreigabeListe l;
  l.status(STATUS_FREMD_BEGINN, A, F1, TYP_UNBEKANNT);
  l.status(STATUS_FREMD_BEGINN, B, F2, TYP_UNBEKANNT);
  const uint64_t seqA = l.eintraege()[0].seq;
  CHECK(l.typNachtrag(A, F1, 2));
  CHECK(l.eintraege()[0].type == 2 && l.eintraege()[0].seq == seqA);
  CHECK(gezeigteFreigabe(l) == F2);
  CHECK(l.typNachtrag(B, F2, TYP_COMPUTERTON));
  CHECK(l.eintraege()[1].audioOnly && gezeigteFreigabe(l) == F1);
  CHECK(!l.typNachtrag(C, F3, 2));                     // ohne passenden Eintrag nichts
  FreigabeListe null;
  null.status(STATUS_FREMD_BEGINN, A, 0, TYP_UNBEKANNT);   // Kennung 0 (Annahme AN19)
  const uint64_t seq0 = null.eintraege()[0].seq;
  CHECK(null.typNachtrag(A, F1, 1));
  CHECK(null.eintraege()[0].share == F1 && null.eintraege()[0].type == 1 && null.eintraege()[0].seq == seq0);
  CHECK(gezeigteFreigabe(null) == F1);
}

// Bild (Task A6). Ein Ziel, das zur Zeit `seit` umgehaengt wurde und optional ein Bild bei `bildMs` hatte.
ZielStand zielMitBild(int seit, int bildMs, bool kopie) {
  ZielStand z;
  zielStandNeu(z, at(seit));
  if (bildMs >= 0) bildAnnehmen(z, 1280, 720, at(bildMs));
  z.kopieGueltig = kopie;
  return z;
}

BildLage lage(SlotMode modus, Fallback fallback, SlotState zustand, Grund grund, int jetzt) {
  BildLage l;
  l.modus = modus;
  l.fallback = fallback;
  l.ziel = modus == SlotMode::Share ? F1 : A;
  l.freigabeBesteht = modus == SlotMode::Share;
  l.zustand = zustand;
  l.grund = grund;
  l.jetzt = at(jetzt);
  return l;
}

void pb16_ersatzbild_tabelle() {
  std::printf("PB16 Ersatzbild: jede Zeile der Tabelle 6.12 mit Art, Takt und sent; vor dem ersten Bild sofort\n");
  const ZielStand bild = zielMitBild(0, 1000, false);
  const ZielStand bildKopie = zielMitBild(0, 1000, true);
  // Bild juenger als 200 ms: nichts zusaetzlich.
  BildLage l = lage(SlotMode::Participant, Fallback::Black, SlotState::Live, Grund::frames, 1199);
  BildEntscheidung e = bildEntscheidung(l, bild);
  CHECK(e.sent == Sent::None && !e.jetztSenden && !e.zustandAendern);
  // Freigabe-Slot, Freigabe besteht, Kopie dieses Ziels: Kopie hoechstens alle 200 ms.
  l = lage(SlotMode::Share, Fallback::Black, SlotState::Live, Grund::frames, 1200);
  l.letztesErsatzMs = at(1001);
  e = bildEntscheidung(l, bildKopie);
  CHECK(e.sent == Sent::Held && !e.jetztSenden);
  l.letztesErsatzMs = at(1000);
  e = bildEntscheidung(l, bildKopie);
  CHECK(e.sent == Sent::Held && e.jetztSenden);
  // Ersatzbilder hoechstens alle 100 ms; Art nach Einstellung (Teilnehmer: nach der Schonfrist, #285/#286).
  const Fallback arten[3] = {Fallback::Transparent, Fallback::Black, Fallback::White};
  const Sent erwartet[3] = {Sent::Transparent, Sent::Black, Sent::White};
  for (int i = 0; i < 3; ++i) {
    l = lage(SlotMode::Participant, arten[i], SlotState::Fallback, Grund::noFrames, 3300);
    l.letztesErsatzMs = at(3201);
    e = bildEntscheidung(l, bild);
    CHECK(e.sent == erwartet[i] && !e.jetztSenden);
    l.letztesErsatzMs = at(3200);
    e = bildEntscheidung(l, bild);
    CHECK(e.sent == erwartet[i] && e.jetztSenden);
  }
  // freeze mit Kopie dieses Ziels: Kopie; ohne: wie transparent (T60).
  l = lage(SlotMode::Participant, Fallback::Freeze, SlotState::Fallback, Grund::noFrames, 3300);
  CHECK(bildEntscheidung(l, bildKopie).sent == Sent::Freeze);
  CHECK(bildEntscheidung(l, bild).sent == Sent::Transparent);
  // Kopie im Teilnehmer-Slot ist nie held; Freigabe ohne bestehende Freigabe auch nicht.
  l = lage(SlotMode::Participant, Fallback::White, SlotState::Fallback, Grund::noFrames, 3300);
  CHECK(bildEntscheidung(l, bildKopie).sent == Sent::White);
  l = lage(SlotMode::Share, Fallback::Black, SlotState::Live, Grund::frames, 1300);
  l.freigabeBesteht = false;
  CHECK(bildEntscheidung(l, bildKopie).sent == Sent::Black);
  // Vor dem ersten Bild dieses Ziels sofort das Ersatzbild (kein Warten auf 200 ms), Zustand bleibt starting.
  const ZielStand neu = zielMitBild(5000, -1, false);
  l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Starting, Grund::targetChanged, 5000);
  e = bildEntscheidung(l, neu);
  CHECK(e.sent == Sent::Transparent && e.jetztSenden && !e.zustandAendern);
  // Ziel 0: Ersatzbild nach Einstellung, Zustand setzt das Umhaengen.
  l = lage(SlotMode::Participant, Fallback::Black, SlotState::Fallback, Grund::noTarget, 9000);
  l.ziel = 0;
  e = bildEntscheidung(l, neu);
  CHECK(e.sent == Sent::Black && !e.zustandAendern);
}

/** Eine Pruefung je Kombination; die FEHLER-Zeile nennt die Kombination (Kreuzprodukt, GG22). */
void pruefeSent(SlotMode m, Fallback f, const char* lageName, bool besteht, Sent ist, Sent soll) {
  ++g_run;
  if (ist != soll) {
    ++g_fail;
    std::printf("  FEHLER PB16 %s/%s/%s/Freigabe %s: sent %s statt %s\n", name(m), name(f), lageName,
                besteht ? "besteht" : "fehlt", name(ist), name(soll));
  }
}

void pb16_kreuzprodukt() {
  std::printf("PB16 Ersatzbild als Kreuzprodukt: Modus x Ersatzbild x Lage x Freigabe besteht, sent nach Tabelle 6.12\n");
  const Sent TR = Sent::Transparent, FZ = Sent::Freeze, SW = Sent::Black, WS = Sent::White, NI = Sent::None;
  struct Zeile {
    const char* lage;
    bool zielNull;      // Ziel 0 (nach Weggang, Ende der Freigabe, ohne Sprecher; der Ziel-Stand ist neu)
    int bildMs;         // erstes Bild dieses Ziels, -1 = noch keins
    bool kopie;         // Kopie DIESES Ziels vorhanden (kopieGueltig)
    int jetzt;
    SlotState zustand;
    Sent soll[4];       // je Ersatzbild in der Reihenfolge der Aufzaehlung: transparent, freeze, black, white
    bool personNichts;  // #285/#286: Teilnehmer/Sprecher (Kamera laut Zoom an) senden in der Schonfrist nichts
  };
  // Tabelle 6.12 ohne die held-Zeile; die steht unten (Freigabe-Slot, Freigabe besteht, Kopie dieses Ziels, Bild alt).
  // „altes Bild“ = aelter als die Schonfrist der Teilnehmer/Sprecher (2 s, #285/#286); 300 ms alt ist nur fuer
  // Freigabe-Slots alt.
  const Zeile zeilen[7] = {
      {"starting ohne Bild", false, -1, false, 5300, SlotState::Starting, {TR, TR, SW, WS}, false},
      {"Ziel 0", true, -1, false, 5300, SlotState::Fallback, {TR, TR, SW, WS}, false},
      {"altes Bild ohne Kopie", false, 1000, false, 3300, SlotState::Fallback, {TR, TR, SW, WS}, false},
      {"altes Bild mit Kopie", false, 1000, true, 3300, SlotState::Fallback, {TR, FZ, SW, WS}, false},
      {"Bild 300 ms alt ohne Kopie", false, 1000, false, 1300, SlotState::Live, {TR, TR, SW, WS}, true},
      {"Bild 300 ms alt mit Kopie", false, 1000, true, 1300, SlotState::Live, {TR, FZ, SW, WS}, true},
      {"Bild juenger als 200 ms", false, 1000, true, 1199, SlotState::Live, {NI, NI, NI, NI}, false},
  };
  const SlotMode modi[3] = {SlotMode::Participant, SlotMode::Speaker, SlotMode::Share};
  for (const Zeile& z : zeilen) {
    const ZielStand stand = zielMitBild(z.bildMs < 0 ? 5000 : 0, z.bildMs, z.kopie);
    for (const SlotMode m : modi) {
      for (int fi = 0; fi < 4; ++fi) {
        const Fallback f = static_cast<Fallback>(fi);
        for (int bi = 0; bi < 2; ++bi) {
          const bool besteht = bi == 1;
          BildLage l = lage(m, f, z.zustand, Grund::frames, z.jetzt);
          if (z.zielNull) l.ziel = 0;
          l.freigabeBesteht = besteht;
          const Sent soll = z.personNichts && m != SlotMode::Share ? NI : z.soll[fi];
          const bool held = m == SlotMode::Share && !z.zielNull && besteht && z.kopie && soll != NI;
          pruefeSent(m, f, z.lage, besteht, bildEntscheidung(l, stand).sent, held ? Sent::Held : soll);
        }
      }
    }
  }
}

void pb23_riegel() {
  std::printf("PB23 Riegel: Bild und RawData_Off waehrend des Umhaengens oder ohne Abo verworfen; erstes Bild zaehlt\n");
  CHECK(riegelVerwirft(false, false));
  CHECK(riegelVerwirft(true, true));
  CHECK(riegelVerwirft(false, true));
  CHECK(!riegelVerwirft(true, false));
  ZielStand z;
  zielStandNeu(z, at(1000));
  CHECK(!z.bildSeitUmhaengen);
  CHECK(bildAnnehmen(z, 640, 360, at(1100)));
  CHECK(z.bildSeitUmhaengen && z.lastFrameMs == 1100 && z.lastW == 640 && z.lastH == 360);
  CHECK(!bildAnnehmen(z, 640, 360, at(1133)));
  CHECK(z.lastFrameMs == 1133);
}

void pb24_grund_nach_200ms() {
  std::printf("PB24 Grund ohne Bild: cameraOff nach 200 ms nur, wenn Zoom es meldet; sonst noFrames nach der Schonfrist "
              "(2 s, #285/#286); nie fuer SHARE\n");
  const ZielStand bild = zielMitBild(0, 1000, false);
  BildLage l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Live, Grund::frames, 1199);
  l.kameraAusLautZoom = true;
  CHECK(!bildEntscheidung(l, bild).zustandAendern);
  l.jetzt = at(1200);
  BildEntscheidung e = bildEntscheidung(l, bild);
  CHECK(e.zustandAendern && e.zustand == SlotState::Fallback && e.grund == Grund::cameraOff);
  l.kameraAusLautZoom = false;
  l.jetzt = at(3000);
  e = bildEntscheidung(l, bild);
  CHECK(e.zustandAendern && e.zustand == SlotState::Fallback && e.grund == Grund::noFrames);
  l = lage(SlotMode::Speaker, Fallback::Transparent, SlotState::Live, Grund::frames, 3000);
  e = bildEntscheidung(l, bild);
  CHECK(e.grund == Grund::noFrames);
  // RawData_Off vor dem ersten Bild dieses Ziels: kein Grund, keine Abfrage.
  ZielStand vorher;
  zielStandNeu(vorher, at(2000));
  CHECK(!rawOffAnnehmen(vorher) && !vorher.rawOffGesehen);
  l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Starting, Grund::targetChanged, 9000);
  CHECK(!bildEntscheidung(l, vorher).zustandAendern);
  ZielStand danach = zielMitBild(2000, 2100, false);
  CHECK(rawOffAnnehmen(danach) && danach.rawOffGesehen);
  // SHARE nie cameraOff, auch wenn die Person die Kamera aus hat.
  l = lage(SlotMode::Share, Fallback::Transparent, SlotState::Live, Grund::frames, 3000);
  l.kameraAusLautZoom = true;
  e = bildEntscheidung(l, bild);
  CHECK(e.zustandAendern && e.grund == Grund::noFrames);
  // Ein laufender bufferMismatch bleibt stehen.
  l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Live, Grund::bufferMismatch, 1300);
  l.bufferMismatch = true;
  l.kameraAusLautZoom = true;
  e = bildEntscheidung(l, bild);
  CHECK(e.zustandAendern && e.zustand == SlotState::Fallback && e.grund == Grund::bufferMismatch);
  // Meldet Zoom die Kamera spaeter als aus, wird aus noFrames cameraOff (E-a2-5).
  l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Fallback, Grund::noFrames, 4000);
  l.kameraAusLautZoom = true;
  e = bildEntscheidung(l, bild);
  CHECK(e.zustandAendern && e.grund == Grund::cameraOff);
}

void pb29_halten() {
  std::printf("PB29 Halten: nur Kopie dieses Ziels; Senden ab 200 ms, Zustand erst nach 2 s; vor dem ersten Bild starting\n");
  // Nach dem Umhaengen ist die Kopie ungueltig: bis zum ersten Bild des neuen Ziels kein held.
  ZielStand z;
  zielStandNeu(z, at(1000));
  BildLage l = lage(SlotMode::Share, Fallback::Transparent, SlotState::Starting, Grund::shareChanged, 1500);
  BildEntscheidung e = bildEntscheidung(l, z);
  CHECK(e.sent == Sent::Transparent && !e.zustandAendern);
  // Erstes Bild bei 2000, Kopie gueltig.
  bildAnnehmen(z, 1920, 1080, at(2000));
  z.kopieGueltig = true;
  l = lage(SlotMode::Share, Fallback::Transparent, SlotState::Live, Grund::frames, 2199);
  CHECK(bildEntscheidung(l, z).sent == Sent::None);
  l.jetzt = at(2200);
  e = bildEntscheidung(l, z);
  CHECK(e.sent == Sent::Held && e.jetztSenden && !e.zustandAendern);   // live mit sent = held
  l.jetzt = at(3999);
  e = bildEntscheidung(l, z);
  CHECK(e.sent == Sent::Held && !e.zustandAendern);
  l.jetzt = at(4000);
  e = bildEntscheidung(l, z);
  CHECK(e.sent == Sent::Held && e.zustandAendern && e.zustand == SlotState::Held && e.grund == Grund::shareStill);
  l.freigabePausiert = true;
  e = bildEntscheidung(l, z);
  CHECK(e.zustand == SlotState::Held && e.grund == Grund::sharePaused);
  // Naechstes Bild: sent wieder none (Ende des Haltens).
  bildAnnehmen(z, 1920, 1080, at(4100));
  l.jetzt = at(4110);
  CHECK(bildEntscheidung(l, z).sent == Sent::None);
  // Ohne Kopie: ab 200 ms Ersatzbild, nach 2 s fallback/noFrames bzw. sharePaused.
  ZielStand ohne = zielMitBild(0, 1000, false);
  l = lage(SlotMode::Share, Fallback::Black, SlotState::Live, Grund::frames, 3000);
  e = bildEntscheidung(l, ohne);
  CHECK(e.sent == Sent::Black && e.zustandAendern && e.zustand == SlotState::Fallback && e.grund == Grund::noFrames);
  l.freigabePausiert = true;
  CHECK(bildEntscheidung(l, ohne).grund == Grund::sharePaused);
  // Vor dem ersten Bild bleibt starting (auch bei noShareData), ausser die Freigabe ist pausiert: dann nach 2 s.
  ZielStand leer;
  zielStandNeu(leer, at(10000));
  l = lage(SlotMode::Share, Fallback::Transparent, SlotState::Starting, Grund::shareChanged, 20000);
  CHECK(!bildEntscheidung(l, leer).zustandAendern);
  l.freigabePausiert = true;
  l.jetzt = at(11999);
  CHECK(!bildEntscheidung(l, leer).zustandAendern);
  l.jetzt = at(12000);
  e = bildEntscheidung(l, leer);
  CHECK(e.zustandAendern && e.zustand == SlotState::Fallback && e.grund == Grund::sharePaused);
}

void a6_namensregel() {
  std::printf("A6 NDI-Namensregel: 1-60 Code-Punkte, kein Doppelpunkt, keine Steuerzeichen, keine \\u-Folge, gueltiges UTF-8\n");
  const std::string emoji = "\xF0\x9F\x98\x80";   // U+1F600, 4 Byte, 1 Code-Punkt
  CHECK(codePunkte(std::string(59, 'a') + emoji) == 60);
  CHECK(codePunkte("\xC3\xA4" + emoji) == 2);
  CHECK(pruefeNdiName("", false) == NamensFehler::Leer);
  CHECK(pruefeNdiName(std::string(59, 'a') + emoji, false) == NamensFehler::Keiner);
  CHECK(pruefeNdiName(std::string(60, 'a') + emoji, false) == NamensFehler::ZuLang);
  CHECK(pruefeNdiName(std::string(60, 'a'), false) == NamensFehler::Keiner);
  CHECK(pruefeNdiName("A:B", false) == NamensFehler::Doppelpunkt);
  CHECK(pruefeNdiName("A\x01" "B", false) == NamensFehler::Steuerzeichen);
  CHECK(pruefeNdiName("A\nB", false) == NamensFehler::Steuerzeichen);
  CHECK(pruefeNdiName("A\x7F", false) == NamensFehler::Steuerzeichen);
  CHECK(pruefeNdiName("A\xC2\x85", false) == NamensFehler::Steuerzeichen);   // U+0085 (C1)
  CHECK(pruefeNdiName("JM u00e4", true) == NamensFehler::UnicodeFolge);
  CHECK(pruefeNdiName("JM Connect \xE2\x80\x93 Zoom \xC3\xA4", false) == NamensFehler::Keiner);
  CHECK(pruefeNdiName("A\xC3\x28", false) == NamensFehler::KeinUtf8);          // Folgebyte fehlt
  CHECK(pruefeNdiName("\xC0\xAF", false) == NamensFehler::KeinUtf8);           // Ueberlange Form
  CHECK(pruefeNdiName("\xED\xA0\x80", false) == NamensFehler::KeinUtf8);       // Surrogat
  CHECK(pruefeNdiName("\xF0\x9F\x98", false) == NamensFehler::KeinUtf8);       // abgeschnitten
}

// Umhaengen und Ton (Task A7).
using S = UmhaengSchritt;

UmhaengLage umh(SlotMode vorher, SlotMode nachher, unsigned altesZiel, unsigned neuesZiel, Grund aufruf,
                SlotAudio audio, bool shareAudio) {
  UmhaengLage l;
  l.abonniert = altesZiel != 0;
  l.modusVorher = vorher;
  l.modusNachher = nachher;
  l.altesZiel = altesZiel;
  l.neuesZiel = neuesZiel;
  l.aufruf = aufruf;
  l.letzterTyp = rendererTyp(vorher);
  l.audio = audio;
  l.shareAudio = shareAudio;
  l.freigabeNochGezeigt = nachher == SlotMode::Share && neuesZiel != 0;
  return l;
}

bool hat(const UmhaengPlan& p, S s) {
  for (S x : p.schritte) {
    if (x == s) return true;
  }
  return false;
}

/** Index des ersten Vorkommens, -1 ohne. */
int stelle(const UmhaengPlan& p, S s) {
  for (size_t i = 0; i < p.schritte.size(); ++i) {
    if (p.schritte[i] == s) return static_cast<int>(i);
  }
  return -1;
}

bool tonIst(const UmhaengPlan& p, TonZustand z, TonGrund g, TonQuelle c) {
  return p.tonMelden && p.tonZustand == z && p.tonGrund == g && p.configured == c && !p.tonFolge.empty() &&
         p.tonFolge.back().zustand == z && p.tonFolge.back().grund == g && p.tonFolge.back().configured == c;
}

/** Plan eines geglueckten Umhaengens: bei Ziel 0 umhaengPlan allein, sonst bis Subscribe und dann Erfolg. */
UmhaengPlan umhaengenOk(const UmhaengLage& l) {
  const UmhaengPlan bis = umhaengPlan(l);
  if (l.neuesZiel == 0) return bis;
  return umhaengNachSubscribe(l, FEHLER_KEINER, 0);
}

bool keinTon(const UmhaengPlan& p) {
  return !hat(p, S::TonStandNeu) && !hat(p, S::TonMelden) && !hat(p, S::MischerNeu) && !hat(p, S::MischerEingangBNeu) &&
         p.tonFolge.empty();
}

void pb19_moduswechsel_und_ziel0() {
  std::printf("PB19 Moduswechsel: neues Ziel nach Modus; Ziel 0 nennt den Grund nach Modus, nie modeChanged\n");
  CHECK(zielNachModus(SlotMode::Participant, A, B, F1) == A);
  CHECK(zielNachModus(SlotMode::Speaker, A, B, F1) == B);
  CHECK(zielNachModus(SlotMode::Share, A, B, F1) == F1);
  CHECK(zielNachModus(SlotMode::Participant, 0, B, F1) == 0);
  CHECK(zielNachModus(SlotMode::Speaker, A, 0, F1) == 0);
  CHECK(zielNachModus(SlotMode::Share, A, B, 0) == 0);
  const SlotMode modi[3] = {SlotMode::Participant, SlotMode::Speaker, SlotMode::Share};
  const Grund erwartet[3] = {Grund::noTarget, Grund::speakerNone, Grund::shareNone};
  const Grund aufrufe[4] = {Grund::modeChanged, Grund::targetChanged, Grund::resolutionChanged, Grund::command};
  for (int m = 0; m < 3; ++m) {
    for (Grund aufruf : aufrufe) {
      const UmhaengPlan p = umhaengPlan(umh(SlotMode::Participant, modi[m], A, 0, aufruf, SlotAudio::Off, false));
      CHECK(p.zustand == SlotState::Fallback && p.grund == erwartet[m] && hat(p, S::SlotMelden));
    }
  }
  UmhaengPlan p = umhaengPlan(umh(SlotMode::Participant, SlotMode::Participant, A, 0, Grund::participantLeft,
                                  SlotAudio::Off, false));
  CHECK(p.grund == Grund::participantLeft);
  p = umhaengPlan(umh(SlotMode::Speaker, SlotMode::Speaker, A, 0, Grund::speakerNone, SlotAudio::Off, false));
  CHECK(p.grund == Grund::speakerNone);
  p = umhaengenOk(umh(SlotMode::Participant, SlotMode::Speaker, A, B, Grund::modeChanged, SlotAudio::Off, false));
  CHECK(p.zustand == SlotState::Starting && p.grund == Grund::modeChanged);
}

void a7_kamera_aus_beim_umhaengen() {
  std::printf("A7 Schritt 7: IsVideoOn false -> Teilnehmer cameraOff, Sprecher speakerNoVideo\n");
  CHECK(grundBeiKameraAus(SlotMode::Participant) == Grund::cameraOff);
  CHECK(grundBeiKameraAus(SlotMode::Speaker) == Grund::speakerNoVideo);
  const UmhaengPlan video = umhaengenOk(umh(SlotMode::Speaker, SlotMode::Speaker, A, B, Grund::speakerChanged, SlotAudio::Off, false));
  CHECK(hat(video, S::IsVideoOnFragen) && stelle(video, S::IsVideoOnFragen) < stelle(video, S::SlotMelden));
  const UmhaengPlan share = umhaengenOk(umh(SlotMode::Share, SlotMode::Share, F1, F2, Grund::shareChanged, SlotAudio::Off, false));
  CHECK(!hat(share, S::IsVideoOnFragen));
}

void pb21_umhaeng_plan() {
  std::printf("PB21 Umhaeng-Plan je Rueckgabe: 0, 18, 29, 30, anderer Fehler mit/ohne Typwechsel, rendererTot, Sperre\n");
  UmhaengLage l = umh(SlotMode::Participant, SlotMode::Participant, A, B, Grund::targetChanged, SlotAudio::Off, false);
  // Sperre: nur vormerken.
  UmhaengLage gesperrt = l;
  gesperrt.sperre = true;
  CHECK(umhaengPlan(gesperrt).schritte == std::vector<S>{S::Vormerken});
  // Normal: Unsubscribe, Aufloesung setzen und lesen, Subscribe.
  CHECK((umhaengPlan(l).schritte == std::vector<S>{S::Unsubscribe, S::SetResolution, S::GetResolution, S::Subscribe}));
  UmhaengLage frei = l;
  frei.abonniert = false;
  CHECK(!hat(umhaengPlan(frei), S::Unsubscribe));
  // rendererTot: kein unSubscribe/destroyRenderer, neuer Delegate.
  UmhaengLage tot = l;
  tot.rendererTot = true;
  CHECK((umhaengPlan(tot).schritte ==
         std::vector<S>{S::ZeigerVerwerfen, S::CreateRendererNeuerDelegate, S::SetResolution, S::GetResolution, S::Subscribe}));
  // 0: Abschluss mit IsVideoOn (VIDEO), starting/<grund>.
  UmhaengPlan p = umhaengNachSubscribe(l, FEHLER_KEINER, 0);
  CHECK((p.schritte == std::vector<S>{S::ZielStandNeu, S::VorschauPlatzLeeren, S::IsVideoOnFragen, S::SlotMelden}));
  CHECK(p.zustand == SlotState::Starting && p.grund == Grund::targetChanged);
  // 18: dreimal nach 500 ms, danach wie anderer Fehler. Seit dem Abschluss-Fix (F2) laeuft der Abschluss beim ersten 18
  // sofort (wie beim 29); mit dem Merker danach nur noch die Wiederholung.
  p = umhaengNachSubscribe(l, FEHLER_ZU_OFT, 0);
  CHECK(hat(p, S::ZielStandNeu) && hat(p, S::SlotMelden) && p.schritte.back() == S::WiederholenIn500ms);
  UmhaengLage gelaufen = l;
  gelaufen.abschlussGelaufen = true;
  for (int v = 0; v < 3; ++v) CHECK(umhaengNachSubscribe(gelaufen, FEHLER_ZU_OFT, v).schritte == std::vector<S>{S::WiederholenIn500ms});
  p = umhaengNachSubscribe(l, FEHLER_ZU_OFT, 3);
  CHECK(p.zustand == SlotState::Fallback && p.grund == Grund::subscribeFailed && hat(p, S::FehlerSubscribeMelden));
  // 29 nur SHARE: kein neuer Renderer (auch bei Typwechsel), Wiederholung, solange die Freigabe gezeigt wird.
  UmhaengLage freigabe = umh(SlotMode::Participant, SlotMode::Share, A, F1, Grund::modeChanged, SlotAudio::Off, false);
  p = umhaengNachSubscribe(freigabe, FEHLER_KEINE_FREIGABEDATEN, 0);
  CHECK(!hat(p, S::DestroyRenderer) && !hat(p, S::CreateRendererTypwechsel) && hat(p, S::WiederholenIn500ms));
  CHECK(hat(p, S::SlotMelden) && p.zustand == SlotState::Starting && p.grund == Grund::modeChanged);
  freigabe.abschlussGelaufen = true;   // seit N2a.2 entscheidet der Merker, nicht versuch: der Abschluss lief schon
  CHECK(umhaengNachSubscribe(freigabe, FEHLER_KEINE_FREIGABEDATEN, 4).schritte == std::vector<S>{S::WiederholenIn500ms});
  freigabe.freigabeNochGezeigt = false;
  CHECK(umhaengNachSubscribe(freigabe, FEHLER_KEINE_FREIGABEDATEN, 4).schritte.empty());
  p = umhaengNachSubscribe(l, FEHLER_KEINE_FREIGABEDATEN, 0);   // 29 bei VIDEO: anderer Fehler
  CHECK(p.grund == Grund::subscribeFailed && hat(p, S::FehlerSubscribeMelden));
  // 30: wie anderer Fehler.
  p = umhaengNachSubscribe(l, FEHLER_EIGENE_FREIGABE, 0);
  CHECK(p.zustand == SlotState::Fallback && p.grund == Grund::subscribeFailed && !hat(p, S::DestroyRenderer));
  // Anderer Fehler mit Typwechsel: einmal neuer Renderer (rendererNew), seit dem Abschluss-Fix F1 mit NEUEM Delegate
  // (Schritt CreateRendererTypwechsel, vorher CreateRendererGleicherDelegate); ohne Typwechsel: subscribeFailed.
  UmhaengLage wechsel = umh(SlotMode::Participant, SlotMode::Share, A, F1, Grund::modeChanged, SlotAudio::Off, false);
  p = umhaengNachSubscribe(wechsel, 7, 0);
  CHECK((p.schritte == std::vector<S>{S::DestroyRenderer, S::CreateRendererTypwechsel, S::SetResolution,
                                      S::GetResolution, S::Subscribe}));
  wechsel.letzterTyp = RendererTyp::Share;   // nach dem neuen Renderer
  p = umhaengNachSubscribe(wechsel, 7, 0);
  CHECK(p.grund == Grund::subscribeFailed && !hat(p, S::CreateRendererTypwechsel));
  p = umhaengNachSubscribe(l, 7, 0);
  CHECK(p.grund == Grund::subscribeFailed && !hat(p, S::DestroyRenderer) && !hat(p, S::CreateRendererTypwechsel));
  // createRenderer gescheitert (rendererTot): subscribeFailed, Slot laeuft mit Ersatzbild.
  UmhaengLage keinRenderer = tot;
  keinRenderer.rendererGescheitert = true;
  p = umhaengNachSubscribe(keinRenderer, 3, 0);
  CHECK(p.zustand == SlotState::Fallback && p.grund == Grund::subscribeFailed && hat(p, S::FehlerSubscribeMelden));
  // Moduswechsel von oder zur Freigabe: Versatz leeren und Schalter setzen, vor dem Subscribe.
  p = umhaengPlan(umh(SlotMode::Speaker, SlotMode::Share, A, F1, Grund::modeChanged, SlotAudio::Off, false));
  CHECK(hat(p, S::VersatzLeeren) && hat(p, S::OhneVersatzSetzen) && stelle(p, S::OhneVersatzSetzen) < stelle(p, S::Subscribe));
  p = umhaengPlan(umh(SlotMode::Participant, SlotMode::Speaker, A, B, Grund::modeChanged, SlotAudio::Off, false));
  CHECK(!hat(p, S::VersatzLeeren) && !hat(p, S::OhneVersatzSetzen));
}

void pb22_ziel_stand() {
  std::printf("PB22 Ziel-Stand: Umhaengen ersetzt jedes Feld (ZielStand{}), retargetMs = jetzt\n");
  ZielStand z;
  z.lastFrameMs = 1; z.lastW = 2; z.lastH = 3; z.gemessen = true; z.mismatchGemeldet = true;
  z.bildSeitUmhaengen = true; z.rawOffGesehen = true; z.kopieGueltig = true; z.retargetMs = 4;
  CHECK(z.lastFrameMs != 0 && z.lastW != 0 && z.lastH != 0 && z.gemessen && z.mismatchGemeldet && z.bildSeitUmhaengen &&
        z.rawOffGesehen && z.kopieGueltig && z.retargetMs != 0);
  zielStandNeu(z, at(7000));
  ZielStand soll;
  soll.retargetMs = 7000;
  CHECK(z == soll);
}

void pb22_ton_stand() {
  std::printf("PB22 Ton-Stand: TonStandNeu ersetzt jedes Feld, auch silenceBisMs; danach keine Stille vor dem ersten Paket\n");
  TonStand t;
  t.audioRate = 32000; t.audioChannels = 1; t.lastAudioMs = 1000; t.silenceBisMs = 1200; t.audioMismatchGemeldet = true;
  t.audioMessBeginnMs = 5; t.audioMessPakete = 6; t.audioMessAbtastwerte = 7; t.audioMessFenster = 8;
  t.audioWartenSummeUs = 9; t.audioWartenMaxUs = 10; t.audioWartenMinUs = 11;
  CHECK(t != TonStand{});
  tonStandNeu(t);
  CHECK(t == TonStand{});
  CHECK(t.lastAudioMs == 0 && t.silenceBisMs == 0 && t.audioRate == 0);
  CHECK(stilleBloecke(TonQuelle::Mix, 0, t, at(5000)).abtastwerte == 0);
}

void pb22_person_ton() {
  std::printf("PB22 Person-Ton im Modus Teilnehmer: Weggang off/participantLeft, Rueckkehr waiting/targetChanged\n");
  UmhaengPlan p = umhaengenOk(umh(SlotMode::Participant, SlotMode::Participant, A, 0, Grund::participantLeft,
                                  SlotAudio::Person, false));
  CHECK(hat(p, S::TonStandNeu) && tonIst(p, TonZustand::Off, TonGrund::participantLeft, TonQuelle::Person));
  CHECK(stelle(p, S::SlotMelden) < stelle(p, S::TonMelden));
  p = umhaengenOk(umh(SlotMode::Participant, SlotMode::Participant, 0, A, Grund::targetChanged, SlotAudio::Person, false));
  CHECK(hat(p, S::TonStandNeu) && tonIst(p, TonZustand::Waiting, TonGrund::targetChanged, TonQuelle::Person));
  // Neue Aufloesung auf dasselbe Ziel: der Ton bleibt.
  p = umhaengenOk(umh(SlotMode::Participant, SlotMode::Participant, A, A, Grund::resolutionChanged, SlotAudio::Person, false));
  CHECK(keinTon(p));
}

void pb22_mischton_bleibt() {
  std::printf("PB22 reiner Mischton (mix -> mix): Ton-Stand bleibt, kein slotAudio, auch beim Moduswechsel\n");
  CHECK(keinTon(umhaengenOk(umh(SlotMode::Speaker, SlotMode::Speaker, A, B, Grund::speakerChanged, SlotAudio::Mix, true))));
  CHECK(keinTon(umhaengenOk(umh(SlotMode::Participant, SlotMode::Speaker, A, B, Grund::modeChanged, SlotAudio::Mix, true))));
  CHECK(keinTon(umhaengenOk(umh(SlotMode::Speaker, SlotMode::Participant, B, A, Grund::modeChanged, SlotAudio::Mix, true))));
  CHECK(keinTon(umhaengenOk(umh(SlotMode::Speaker, SlotMode::Share, B, F1, Grund::modeChanged, SlotAudio::Mix, false))));
  CHECK(keinTon(umhaengenOk(umh(SlotMode::Share, SlotMode::Participant, F1, A, Grund::modeChanged, SlotAudio::Mix, false))));
  CHECK(keinTon(umhaengenOk(umh(SlotMode::Speaker, SlotMode::Speaker, A, 0, Grund::speakerNone, SlotAudio::Mix, true))));
}

void pb22_mischer_beim_moduswechsel() {
  std::printf("PB22 Mischton + Computerton: auf Freigabe TonStandNeu, MischerNeu, waiting/modeChanged mixShare; zurueck mix\n");
  const SlotMode ausgang[2] = {SlotMode::Speaker, SlotMode::Participant};
  for (SlotMode m : ausgang) {
    UmhaengPlan p = umhaengenOk(umh(m, SlotMode::Share, A, F1, Grund::modeChanged, SlotAudio::Mix, true));
    CHECK(hat(p, S::TonStandNeu) && hat(p, S::MischerNeu));
    CHECK(tonIst(p, TonZustand::Waiting, TonGrund::modeChanged, TonQuelle::MixShare));
    p = umhaengenOk(umh(SlotMode::Share, m, F1, A, Grund::modeChanged, SlotAudio::Mix, true));
    CHECK(hat(p, S::TonStandNeu) && !hat(p, S::MischerNeu));
    CHECK(tonIst(p, TonZustand::Waiting, TonGrund::modeChanged, TonQuelle::Mix));
  }
  // Freigabewechsel im Mischer-Slot: nur Eingang B beginnt neu, ohne Meldung.
  const UmhaengPlan p = umhaengenOk(umh(SlotMode::Share, SlotMode::Share, F1, F2, Grund::shareChanged, SlotAudio::Mix, true));
  CHECK(hat(p, S::MischerEingangBNeu) && !hat(p, S::TonStandNeu) && !hat(p, S::TonMelden));
}

void pb22_nur_computerton() {
  std::printf("PB22 nur Computerton: share mit Freigabe waiting, ohne off/noShare; Ende off/noShare; zurueck off/modeChanged\n");
  UmhaengPlan p = umhaengenOk(umh(SlotMode::Speaker, SlotMode::Share, A, F1, Grund::modeChanged, SlotAudio::Off, true));
  CHECK(hat(p, S::TonStandNeu) && tonIst(p, TonZustand::Waiting, TonGrund::modeChanged, TonQuelle::Share));
  p = umhaengenOk(umh(SlotMode::Speaker, SlotMode::Share, A, 0, Grund::modeChanged, SlotAudio::Off, true));
  CHECK(tonIst(p, TonZustand::Off, TonGrund::noShare, TonQuelle::Share));
  p = umhaengenOk(umh(SlotMode::Share, SlotMode::Share, F1, 0, Grund::shareNone, SlotAudio::Off, true));
  CHECK(tonIst(p, TonZustand::Off, TonGrund::noShare, TonQuelle::Share));
  p = umhaengenOk(umh(SlotMode::Share, SlotMode::Share, 0, F2, Grund::shareChanged, SlotAudio::Off, true));
  CHECK(hat(p, S::TonStandNeu) && tonIst(p, TonZustand::Waiting, TonGrund::targetChanged, TonQuelle::Share));
  p = umhaengenOk(umh(SlotMode::Share, SlotMode::Speaker, F2, A, Grund::modeChanged, SlotAudio::Off, true));
  CHECK(hat(p, S::TonStandNeu) && tonIst(p, TonZustand::Off, TonGrund::modeChanged, TonQuelle::None));
}

void pb22_person_mit_computerton() {
  std::printf("PB22 Person-Ton mit Computerton: auf Freigabe off/personNotInMode (share); Freigabewechsel ohne Meldung\n");
  UmhaengPlan p = umhaengenOk(umh(SlotMode::Participant, SlotMode::Share, A, F1, Grund::modeChanged, SlotAudio::Person, true));
  CHECK(hat(p, S::TonStandNeu) && tonIst(p, TonZustand::Off, TonGrund::personNotInMode, TonQuelle::Share));
  p = umhaengenOk(umh(SlotMode::Share, SlotMode::Share, F1, F2, Grund::shareChanged, SlotAudio::Person, true));
  CHECK(hat(p, S::TonStandNeu) && !hat(p, S::TonMelden));
  p = umhaengenOk(umh(SlotMode::Share, SlotMode::Share, F2, 0, Grund::shareNone, SlotAudio::Person, true));
  CHECK(hat(p, S::TonStandNeu) && !hat(p, S::TonMelden));
}

void pb22_person_im_sprecher() {
  std::printf("PB22 Person-Ton im Modus Sprecher (none): Sprecherwechsel ohne TonStandNeu und ohne Meldung\n");
  CHECK(keinTon(umhaengenOk(umh(SlotMode::Speaker, SlotMode::Speaker, A, B, Grund::speakerChanged, SlotAudio::Person, false))));
  CHECK(keinTon(umhaengenOk(umh(SlotMode::Speaker, SlotMode::Speaker, A, B, Grund::speakerChanged, SlotAudio::Person, true))));
  CHECK(keinTon(umhaengenOk(umh(SlotMode::Share, SlotMode::Share, F1, F2, Grund::shareChanged, SlotAudio::Person, false))));
  const UmhaengPlan p = umhaengenOk(umh(SlotMode::Participant, SlotMode::Speaker, A, B, Grund::modeChanged, SlotAudio::Person, false));
  CHECK(hat(p, S::TonStandNeu) && tonIst(p, TonZustand::Off, TonGrund::personNotInMode, TonQuelle::None));
}

void pb22_audio_unavailable_bleibt() {
  std::printf("PB22 off/audioUnavailable bleibt ueber Umhaengen und Moduswechsel\n");
  UmhaengLage l = umh(SlotMode::Participant, SlotMode::Share, A, F1, Grund::modeChanged, SlotAudio::Mix, true);
  l.tonAudioUnavailable = true;
  CHECK(keinTon(umhaengenOk(l)));
  l = umh(SlotMode::Participant, SlotMode::Participant, A, B, Grund::targetChanged, SlotAudio::Person, false);
  l.tonAudioUnavailable = true;
  CHECK(keinTon(umhaengenOk(l)));
}

TonAenderung aenderung(bool audioGesetzt, SlotAudio audio, bool shareGesetzt, bool share) {
  TonAenderung a;
  a.audioGesetzt = audioGesetzt;
  a.audio = audio;
  a.shareAudioGesetzt = shareGesetzt;
  a.shareAudio = share;
  return a;
}

void pb22_umschalten_ton_stand() {
  std::printf("PB22 Umschalten: jede Aenderung TonStandNeu, in den Mischer auch MischerNeu; gleiche Werte nicht\n");
  UmhaengLage l = umh(SlotMode::Share, SlotMode::Share, F1, F1, Grund::command, SlotAudio::Mix, false);
  UmhaengPlan p = tonUmschaltPlan(l, aenderung(false, SlotAudio::Off, true, true), AboErgebnis::Geglueckt);
  CHECK(hat(p, S::TonStandNeu) && hat(p, S::MischerNeu));
  CHECK(tonIst(p, TonZustand::Waiting, TonGrund::command, TonQuelle::MixShare));
  l = umh(SlotMode::Participant, SlotMode::Participant, A, A, Grund::command, SlotAudio::Mix, false);
  p = tonUmschaltPlan(l, aenderung(true, SlotAudio::Person, true, false), AboErgebnis::Geglueckt);
  CHECK(hat(p, S::TonStandNeu) && !hat(p, S::MischerNeu));
  CHECK(tonIst(p, TonZustand::Waiting, TonGrund::command, TonQuelle::Person));
  p = tonUmschaltPlan(l, aenderung(true, SlotAudio::Mix, true, false), AboErgebnis::Geglueckt);   // gleiche Werte
  CHECK(!hat(p, S::TonStandNeu) && tonIst(p, TonZustand::Waiting, TonGrund::command, TonQuelle::Mix));
}

void pb22_umschalten_abo() {
  std::printf("PB22 Umschalten: waiting/command nur nach gegluecktem Abo, sonst off/audioUnavailable; aus -> off/command\n");
  UmhaengLage l = umh(SlotMode::Participant, SlotMode::Participant, A, A, Grund::command, SlotAudio::Off, false);
  const TonAenderung ein = aenderung(true, SlotAudio::Mix, true, false);
  CHECK(tonAboNoetig(l, ein));
  UmhaengPlan p = tonUmschaltPlan(l, ein, AboErgebnis::Geglueckt);
  CHECK(p.tonFolge.size() == 1 && tonIst(p, TonZustand::Waiting, TonGrund::command, TonQuelle::Mix));
  p = tonUmschaltPlan(l, ein, AboErgebnis::Gescheitert);
  CHECK(p.tonFolge.size() == 1 && tonIst(p, TonZustand::Off, TonGrund::audioUnavailable, TonQuelle::Mix));
  l.audio = SlotAudio::Mix;
  const TonAenderung aus = aenderung(true, SlotAudio::Off, true, false);
  CHECK(!tonAboNoetig(l, aus));
  p = tonUmschaltPlan(l, aus, AboErgebnis::NichtGerufen);
  CHECK(hat(p, S::TonStandNeu) && tonIst(p, TonZustand::Off, TonGrund::command, TonQuelle::None));
  // Nur ein Feld (Pruefstand): das gespeicherte andere zaehlt (N9-1).
  l = umh(SlotMode::Share, SlotMode::Share, F1, F1, Grund::command, SlotAudio::Off, true);
  CHECK(tonAboNoetig(l, aenderung(true, SlotAudio::Off, false, false)));
}

void pb22_umschalten_person() {
  std::printf("PB22 Umschalten mit Person-Ton ausserhalb Teilnehmer: nach waiting/command off/personNotInMode, nie off/command\n");
  UmhaengLage l = umh(SlotMode::Share, SlotMode::Share, F1, F1, Grund::command, SlotAudio::Person, false);
  UmhaengPlan p = tonUmschaltPlan(l, aenderung(false, SlotAudio::Off, true, true), AboErgebnis::Geglueckt);
  CHECK(p.tonFolge.size() == 2);
  CHECK(p.tonFolge.size() == 2 && p.tonFolge[0].zustand == TonZustand::Waiting && p.tonFolge[0].grund == TonGrund::command &&
        p.tonFolge[0].configured == TonQuelle::Share);
  CHECK(tonIst(p, TonZustand::Off, TonGrund::personNotInMode, TonQuelle::Share));
  l.shareAudio = true;
  p = tonUmschaltPlan(l, aenderung(false, SlotAudio::Off, true, false), AboErgebnis::Geglueckt);
  CHECK(tonIst(p, TonZustand::Off, TonGrund::personNotInMode, TonQuelle::None));
  for (const TonMeldung& m : p.tonFolge) CHECK(!(m.zustand == TonZustand::Off && m.grund == TonGrund::command));
  l = umh(SlotMode::Speaker, SlotMode::Speaker, A, A, Grund::command, SlotAudio::Off, false);
  p = tonUmschaltPlan(l, aenderung(true, SlotAudio::Person, true, false), AboErgebnis::Geglueckt);
  CHECK(p.tonFolge.size() == 2 && tonIst(p, TonZustand::Off, TonGrund::personNotInMode, TonQuelle::None));
}

void pb22_umschalten_no_share() {
  std::printf("PB22 Umschalten: direkter Computerton ohne gezeigte Freigabe -> nach waiting/command off/noShare\n");
  UmhaengLage l = umh(SlotMode::Share, SlotMode::Share, 0, 0, Grund::command, SlotAudio::Off, false);
  UmhaengPlan p = tonUmschaltPlan(l, aenderung(true, SlotAudio::Off, true, true), AboErgebnis::Geglueckt);
  CHECK(p.tonFolge.size() == 2 && tonIst(p, TonZustand::Off, TonGrund::noShare, TonQuelle::Share));
  l.neuesZiel = F1;
  p = tonUmschaltPlan(l, aenderung(true, SlotAudio::Off, true, true), AboErgebnis::Geglueckt);
  CHECK(p.tonFolge.size() == 1 && tonIst(p, TonZustand::Waiting, TonGrund::command, TonQuelle::Share));
}

bool zieleSind(const std::vector<TonZiel>& ist, const std::vector<TonZiel>& soll) { return ist == soll; }

void pb25_ton_zuordnung() {
  std::printf("PB25 tonZiele je Zeile der Tabelle 6.13 und tonWeg je Modus und Zeile der Ton-Abbildung 7.1\n");
  std::vector<TonSlotSicht> s(9);
  auto setze = [&s](int i, bool laeuft, SlotMode m, unsigned ziel, SlotAudio a, bool share, unsigned shareUser) {
    s[static_cast<size_t>(i)].nr = i + 1;
    s[static_cast<size_t>(i)].laeuft = laeuft;
    s[static_cast<size_t>(i)].modus = m;
    s[static_cast<size_t>(i)].ziel = ziel;
    s[static_cast<size_t>(i)].audio = a;
    s[static_cast<size_t>(i)].shareAudio = share;
    s[static_cast<size_t>(i)].shareUser = shareUser;
  };
  setze(0, true, SlotMode::Participant, A, SlotAudio::Person, false, 0);
  setze(1, true, SlotMode::Participant, A, SlotAudio::Mix, false, 0);
  setze(2, true, SlotMode::Speaker, B, SlotAudio::Person, false, 0);
  setze(3, true, SlotMode::Share, F1, SlotAudio::Mix, true, B);
  setze(4, true, SlotMode::Share, F1, SlotAudio::Off, true, B);
  setze(5, true, SlotMode::Share, F2, SlotAudio::Person, true, C);
  setze(6, true, SlotMode::Share, F1, SlotAudio::Mix, false, B);
  setze(7, false, SlotMode::Participant, A, SlotAudio::Person, false, 0);
  setze(8, true, SlotMode::Participant, 0, SlotAudio::Person, false, 0);
  CHECK(zieleSind(tonZiele(PaketArt::Person, A, s), {{1, Weg::Direkt}}));
  CHECK(tonZiele(PaketArt::Person, 0, s).empty());
  CHECK(tonZiele(PaketArt::Person, B, s).empty());
  CHECK(zieleSind(tonZiele(PaketArt::Mix, 0, s), {{2, Weg::Direkt}, {4, Weg::MischerA}, {7, Weg::Direkt}}));
  CHECK(zieleSind(tonZiele(PaketArt::Share, B, s), {{4, Weg::MischerB}, {5, Weg::Direkt}}));
  CHECK(zieleSind(tonZiele(PaketArt::Share, C, s), {{6, Weg::Direkt}}));
  CHECK(tonZiele(PaketArt::Share, 0, s).empty());
  // tonWeg: Spalte „gesendet“ der Ton-Abbildung, je Modus (Teilnehmer, Sprecher, Freigabe).
  struct Zeile { SlotAudio audio; bool share; TonQuelle t, s, f; };
  const Zeile zeilen[6] = {
    {SlotAudio::Off, false, TonQuelle::None, TonQuelle::None, TonQuelle::None},
    {SlotAudio::Off, true, TonQuelle::None, TonQuelle::None, TonQuelle::Share},
    {SlotAudio::Mix, false, TonQuelle::Mix, TonQuelle::Mix, TonQuelle::Mix},
    {SlotAudio::Mix, true, TonQuelle::Mix, TonQuelle::Mix, TonQuelle::MixShare},
    {SlotAudio::Person, false, TonQuelle::Person, TonQuelle::None, TonQuelle::None},
    {SlotAudio::Person, true, TonQuelle::Person, TonQuelle::None, TonQuelle::Share},
  };
  for (const Zeile& z : zeilen) {
    CHECK(tonWeg(SlotMode::Participant, z.audio, z.share) == z.t);
    CHECK(tonWeg(SlotMode::Speaker, z.audio, z.share) == z.s);
    CHECK(tonWeg(SlotMode::Share, z.audio, z.share) == z.f);
  }
}

TonStand tonMitFormat(int64_t letztesPaket, int64_t stilleBis) {
  TonStand t;
  t.audioRate = 32000;
  t.audioChannels = 1;
  t.lastAudioMs = letztesPaket;
  t.silenceBisMs = stilleBis;
  return t;
}

void pb30_stille_bloecke() {
  std::printf("PB30 Stille-Herzschlag: Format, Tonweg, Ziel 0, 40 ms, Beginn max(), hoechstens 200 ms, Rest verfaellt\n");
  TonStand ohneFormat;
  ohneFormat.lastAudioMs = 1000;
  CHECK(stilleBloecke(TonQuelle::Mix, A, ohneFormat, at(2000)).abtastwerte == 0);
  const TonStand t = tonMitFormat(1000, 0);
  CHECK(stilleBloecke(TonQuelle::None, A, t, at(2000)).abtastwerte == 0);
  CHECK(stilleBloecke(TonQuelle::MixShare, A, t, at(2000)).abtastwerte == 0);
  CHECK(stilleBloecke(TonQuelle::Person, 0, t, at(2000)).abtastwerte == 0);
  CHECK(stilleBloecke(TonQuelle::Share, 0, t, at(2000)).abtastwerte == 0);
  CHECK(stilleBloecke(TonQuelle::Person, A, t, at(1039)).abtastwerte == 0);
  CHECK(stilleBloecke(TonQuelle::Person, A, t, at(1040)).abtastwerte == 1280);
  CHECK(stilleBloecke(TonQuelle::Share, F1, t, at(1040)).abtastwerte == 1280);
  CHECK(stilleBloecke(TonQuelle::Mix, 0, t, at(1040)).abtastwerte == 1280);   // Mischton haengt an keinem Ziel
  CHECK(stilleBloecke(TonQuelle::Mix, A, t, at(1039)).abtastwerte == 0);
  // Beginn bei max(silenceBisMs, lastAudioMs).
  StilleErgebnis r = stilleBloecke(TonQuelle::Mix, A, tonMitFormat(1000, 1100), at(1200));
  CHECK(r.abtastwerte == 3200 && r.neuerSilenceBisMs == 1200);
  // Nach 1 s ohne Paket: 200 ms, silenceBisMs = jetzt - 200 + gesendet; 10 ms spaeter nur rund 10 ms.
  r = stilleBloecke(TonQuelle::Mix, A, tonMitFormat(1000, 0), at(2000));
  CHECK(r.abtastwerte == 6400 && r.neuerSilenceBisMs == 2000);
  r = stilleBloecke(TonQuelle::Mix, A, tonMitFormat(1000, r.neuerSilenceBisMs), at(2010));
  CHECK(r.abtastwerte == 320 && r.neuerSilenceBisMs == 2010);
  // Nach TonStand{} erst wieder nach dem ersten Paket (Format unbekannt).
  TonStand neu = tonMitFormat(1000, 1900);
  tonStandNeu(neu);
  CHECK(stilleBloecke(TonQuelle::Mix, A, neu, at(3000)).abtastwerte == 0);
}

// Abbau-Ketten und Base64 (Task A8).
using AS = AbbauSchritt;

bool enthaelt(const std::vector<AS>& plan, AS s) {
  for (AS x : plan) {
    if (x == s) return true;
  }
  return false;
}
int stelleIn(const std::vector<AS>& plan, AS s) {
  for (size_t i = 0; i < plan.size(); ++i) {
    if (plan[i] == s) return static_cast<int>(i);
  }
  return -1;
}
bool ohneRenderer(const std::vector<AS>& plan) {
  return !enthaelt(plan, AS::Unsubscribe) && !enthaelt(plan, AS::DestroyRenderer);
}

void pb20_abbau_ohne_sperre() {
  std::printf("PB20 Abbau-Plan ohne Renderer-Sperre: jede Zeile der Tabelle 6.15 woertlich\n");
  const std::vector<AS> block = {AS::TonAusMelden, AS::SlotAusMelden, AS::VorschauPlatzAbmelden, AS::Unsubscribe,
                                 AS::DestroyRenderer, AS::SenderZu, AS::SlotLoeschen};
  CHECK(abbauPlan(Kette::SlotOff, false) == block);
  std::vector<AS> soll = {AS::AudioShutdown, AS::FreigabenLeeren, AS::ErinnerungLeeren};
  soll.insert(soll.end(), block.begin(), block.end());
  soll.push_back(AS::SessionLeave);
  CHECK(abbauPlan(Kette::Leave, false) == soll);
  CHECK(!enthaelt(abbauPlan(Kette::Leave, false), AS::HaltelisteVerwerfen));
  CHECK(abbauPlan(Kette::LeaveNachlauf, false, true) == std::vector<AS>{AS::HaltelisteVerwerfen});
  // Seit Nachtrag N2b Fixrunde 1 (G1): false friert die Halteliste ein (frueher: kein Schritt).
  CHECK(abbauPlan(Kette::LeaveNachlauf, false, false) == std::vector<AS>{AS::HaltelisteEinfrieren});
  soll = {AS::AudioShutdown, AS::VorschauThreadEnde, AS::FreigabenLeeren, AS::ErinnerungLeeren};
  soll.insert(soll.end(), block.begin(), block.end());
  CHECK(abbauPlan(Kette::QuitEof, false) == soll);
  CHECK(stelleIn(abbauPlan(Kette::QuitEof, false), AS::VorschauThreadEnde) < stelleIn(abbauPlan(Kette::QuitEof, false), AS::SlotLoeschen));
  CHECK(abbauPlan(Kette::MeetingEndetSich, false) == std::vector<AS>{AS::SperreAn});
  CHECK((abbauPlan(Kette::MeetingEnde, false) ==
         std::vector<AS>{AS::AudioClearSubscribed, AS::FreigabenLeeren, AS::ErinnerungLeeren, AS::TonAusMelden,
                         AS::SlotAusMelden, AS::VorschauPlatzAbmelden, AS::ZeigerVerwerfen, AS::SenderZu,
                         AS::SlotLoeschen, AS::HaltelisteVerwerfen, AS::SperreLoesen}));
  CHECK(ohneRenderer(abbauPlan(Kette::MeetingEnde, false)));
  soll = {AS::AudioClearSubscribed};
  soll.insert(soll.end(), block.begin(), block.end());
  soll.push_back(AS::StopRawRecording);
  CHECK(abbauPlan(Kette::Entzug, false) == soll);
  CHECK(!enthaelt(abbauPlan(Kette::Entzug, false), AS::FreigabenLeeren) &&
        !enthaelt(abbauPlan(Kette::Entzug, false), AS::ErinnerungLeeren));
  CHECK((abbauPlan(Kette::Weggang, false) ==
         std::vector<AS>{AS::FreigabenDerPersonEntfernen, AS::ErinnerungOhneKennung, AS::Umhaengen}));
  CHECK(abbauPlan(Kette::FreigabeEndet, false) == std::vector<AS>{AS::Umhaengen});
  CHECK((abbauPlan(Kette::InMeetingErneut, false) ==
         std::vector<AS>{AS::SperreLoesen, AS::HaltelisteAbbauen, AS::EigeneKennungNeu, AS::ErinnerungLeeren,
                         AS::FreigabenLeeren, AS::FreigabenBefuellen, AS::UmhaengenVormerken}));
}

void pb20_abbau_mit_sperre() {
  std::printf("PB20 Abbau-Plan mit Renderer-Sperre: melden, Vorschau ab, Sender zu, dann Halteliste statt Renderer\n");
  const std::vector<AS> halten = {AS::TonAusMelden, AS::SlotAusMelden, AS::VorschauPlatzAbmelden, AS::SenderZu,
                                  AS::InHalteliste};
  CHECK(abbauPlan(Kette::SlotOff, true) == halten);
  const Kette mitHalteliste[3] = {Kette::Leave, Kette::QuitEof, Kette::Entzug};
  for (Kette k : mitHalteliste) {
    const std::vector<AS> p = abbauPlan(k, true);
    CHECK(enthaelt(p, AS::InHalteliste) && enthaelt(p, AS::SenderZu) && enthaelt(p, AS::TonAusMelden));
    CHECK(ohneRenderer(p) && !enthaelt(p, AS::ZeigerVerwerfen) && !enthaelt(p, AS::SlotLoeschen));
    CHECK(!enthaelt(p, AS::HaltelisteVerwerfen));   // quit/EOF und leave: die Halteliste bleibt hier stehen
  }
  CHECK(abbauPlan(Kette::Leave, true).back() == AS::SessionLeave);
  CHECK(abbauPlan(Kette::MeetingEnde, true) == abbauPlan(Kette::MeetingEnde, false));
  CHECK(abbauPlan(Kette::MeetingEndetSich, true) == std::vector<AS>{AS::SperreAn});
  const std::vector<AS> wieder = abbauPlan(Kette::InMeetingErneut, true);
  CHECK(stelleIn(wieder, AS::SperreLoesen) == 0 && stelleIn(wieder, AS::HaltelisteAbbauen) > stelleIn(wieder, AS::SperreLoesen) &&
        stelleIn(wieder, AS::HaltelisteAbbauen) < stelleIn(wieder, AS::UmhaengenVormerken));
  CHECK(abbauPlan(Kette::Weggang, true) == abbauPlan(Kette::Weggang, false));
  CHECK(!enthaelt(abbauPlan(Kette::Weggang, true), AS::SenderZu) && !enthaelt(abbauPlan(Kette::FreigabeEndet, true), AS::SenderZu));
}

void pb20_renderer_tot_und_halteliste() {
  std::printf("PB20 rendererTot nur Zeiger verwerfen; Halteliste je Eintrag; ein spaeteres Meeting fasst aeltere nicht an\n");
  CHECK((fuerSlot(abbauPlan(Kette::SlotOff, false), true) ==
         std::vector<AS>{AS::TonAusMelden, AS::SlotAusMelden, AS::VorschauPlatzAbmelden, AS::ZeigerVerwerfen,
                         AS::SenderZu, AS::SlotLoeschen}));
  CHECK(fuerSlot(abbauPlan(Kette::SlotOff, false), false) == abbauPlan(Kette::SlotOff, false));
  CHECK((halteEintragAbbauen(false) == std::vector<AS>{AS::Unsubscribe, AS::DestroyRenderer, AS::SlotLoeschen}));
  CHECK(halteEintragAbbauen(true) == std::vector<AS>{AS::SlotLoeschen});
  CHECK(halteEintragGehoertZu(3, 3));
  CHECK(!halteEintragGehoertZu(2, 3));
}

void a8_base64() {
  std::printf("A8 Base64 der Vorschau: Man -> TWFu, Laengen 0-3 mit Padding\n");
  const uint8_t man[3] = {'M', 'a', 'n'};
  CHECK(base64(man, 0).empty());
  CHECK(base64(man, 1) == "TQ==");
  CHECK(base64(man, 2) == "TWE=");
  CHECK(base64(man, 3) == "TWFu");
  const uint8_t hoch[2] = {0xFB, 0xFF};
  CHECK(base64(hoch, 2) == "+/8=");
}

void n1_29_dann_erfolg() {
  std::printf("N1.2 29, dann Erfolg mit abschlussGelaufen: kein ZielStandNeu, kein SlotMelden, keine Tonmeldung\n");
  // Sprecher -> Freigabe mit Mischton und Computerton: der Abschluss setzt Ton-Stand und Mischer neu.
  UmhaengLage l = umh(SlotMode::Speaker, SlotMode::Share, A, F1, Grund::modeChanged, SlotAudio::Mix, true);
  UmhaengPlan p = umhaengNachSubscribe(l, FEHLER_KEINE_FREIGABEDATEN, 0);   // erstes 29: Abschluss laeuft einmal
  CHECK(hat(p, S::ZielStandNeu) && hat(p, S::SlotMelden) && hat(p, S::MischerNeu) && hat(p, S::WiederholenIn500ms));
  CHECK(p.zustand == SlotState::Starting && p.grund == Grund::modeChanged);
  CHECK(tonIst(p, TonZustand::Waiting, TonGrund::modeChanged, TonQuelle::MixShare));
  l.abschlussGelaufen = true;   // der Ausfuehrer merkt sich den Abschluss (N2a)
  CHECK(umhaengNachSubscribe(l, FEHLER_KEINE_FREIGABEDATEN, 1).schritte == std::vector<S>{S::WiederholenIn500ms});
  p = umhaengNachSubscribe(l, FEHLER_KEINER, 0);   // Wiederholung glueckt: starting/<grund> bleibt bis zum ersten Bild
  CHECK(!hat(p, S::ZielStandNeu) && !hat(p, S::VorschauPlatzLeeren) && !hat(p, S::SlotMelden));
  CHECK(keinTon(p) && !p.tonMelden);
  CHECK(p.schritte.empty());
  // Freigabewechsel mit direktem Computerton: auch hier kein zweites waiting/targetChanged.
  UmhaengLage wechsel = umh(SlotMode::Share, SlotMode::Share, F1, F2, Grund::shareChanged, SlotAudio::Off, true);
  wechsel.abschlussGelaufen = true;
  p = umhaengNachSubscribe(wechsel, FEHLER_KEINER, 0);
  CHECK(p.schritte.empty() && p.tonFolge.empty());
  // Ohne Merker (subscribe glueckt beim ersten Mal): der Abschluss wie bisher.
  l.abschlussGelaufen = false;
  p = umhaengNachSubscribe(l, FEHLER_KEINER, 0);
  CHECK(hat(p, S::ZielStandNeu) && hat(p, S::SlotMelden) && hat(p, S::MischerNeu));
  CHECK(tonIst(p, TonZustand::Waiting, TonGrund::modeChanged, TonQuelle::MixShare));
}

void n1_plan_braucht_renderer() {
  std::printf("N1.3 planBrauchtRenderer: wahr nur mit Renderer-Schritt; Ton- und Feld-Plaene laufen auch in der Sperre\n");
  const std::vector<S> renderer = {S::Unsubscribe, S::ZeigerVerwerfen, S::CreateRendererNeuerDelegate,
                                   S::DestroyRenderer, S::CreateRendererTypwechsel, S::SetResolution,
                                   S::GetResolution, S::Subscribe};
  for (int i = 0; i <= static_cast<int>(S::OhneVersatzSetzen); ++i) {   // jeder Schritt allein
    const S s = static_cast<S>(i);
    bool erwartet = false;
    for (S r : renderer) erwartet = erwartet || r == s;
    UmhaengPlan einzeln;
    einzeln.schritte = {s};
    CHECK(planBrauchtRenderer(einzeln) == erwartet);
  }
  CHECK(!planBrauchtRenderer(UmhaengPlan{}));
  // Ohne Renderer-Schritt: Ton umschalten (TonStandNeu, MischerNeu, TonMelden), Vormerken, Erfolg, 18, Eingang B neu.
  const UmhaengLage frei = umh(SlotMode::Share, SlotMode::Share, F1, F1, Grund::command, SlotAudio::Off, false);
  TonAenderung mischer;
  mischer.audioGesetzt = true;
  mischer.audio = SlotAudio::Mix;
  mischer.shareAudioGesetzt = true;
  mischer.shareAudio = true;
  const UmhaengPlan ton = tonUmschaltPlan(frei, mischer, AboErgebnis::Geglueckt);
  CHECK(hat(ton, S::TonStandNeu) && hat(ton, S::MischerNeu) && hat(ton, S::TonMelden) && !planBrauchtRenderer(ton));
  UmhaengLage l = umh(SlotMode::Participant, SlotMode::Participant, A, B, Grund::targetChanged, SlotAudio::Person, false);
  UmhaengLage gesperrt = l;
  gesperrt.sperre = true;
  CHECK(!planBrauchtRenderer(umhaengPlan(gesperrt)));
  CHECK(!planBrauchtRenderer(umhaengNachSubscribe(l, FEHLER_KEINER, 0)));
  CHECK(!planBrauchtRenderer(umhaengNachSubscribe(l, FEHLER_ZU_OFT, 0)));
  const UmhaengLage mischerSlot = umh(SlotMode::Share, SlotMode::Share, F1, F2, Grund::shareChanged, SlotAudio::Mix, true);
  const UmhaengPlan eingangB = umhaengNachSubscribe(mischerSlot, FEHLER_KEINER, 0);
  CHECK(hat(eingangB, S::MischerEingangBNeu) && !planBrauchtRenderer(eingangB));
  const UmhaengLage ohneAbo = umh(SlotMode::Speaker, SlotMode::Share, 0, 0, Grund::modeChanged, SlotAudio::Off, false);
  CHECK(!planBrauchtRenderer(umhaengPlan(ohneAbo)));   // Ziel 0, nicht abonniert: nur Versatz und Abschluss
  // Mit Renderer-Schritt: Umhaengen bis Subscribe, Ziel 0 mit Unsubscribe, rendererTot, Typwechsel.
  CHECK(planBrauchtRenderer(umhaengPlan(l)));
  CHECK(planBrauchtRenderer(umhaengPlan(umh(SlotMode::Participant, SlotMode::Participant, A, 0, Grund::participantLeft,
                                            SlotAudio::Off, false))));
  UmhaengLage tot = l;
  tot.rendererTot = true;
  CHECK(planBrauchtRenderer(umhaengPlan(tot)));
  const UmhaengLage typwechsel = umh(SlotMode::Participant, SlotMode::Share, A, F1, Grund::modeChanged, SlotAudio::Off, false);
  CHECK(planBrauchtRenderer(umhaengNachSubscribe(typwechsel, 7, 0)));
}

void n2a2_18_18_dann_29() {
  std::printf("N2a.2 18, 18, dann 29: Abschluss genau einmal (Merker statt versuch); seit F2 schon beim ersten 18\n");
  // Teilnehmer -> Freigabe mit Mischton und Computerton: der Abschluss setzt Ton-Stand und Mischer neu.
  UmhaengLage l = umh(SlotMode::Participant, SlotMode::Share, A, F1, Grund::modeChanged, SlotAudio::Mix, true);
  // Seit dem Abschluss-Fix F2 laeuft der Abschluss schon beim ersten 18; mit dem Merker danach nur die Wiederholung.
  CHECK(hat(umhaengNachSubscribe(l, FEHLER_ZU_OFT, 0), S::ZielStandNeu));
  UmhaengLage gelaufen = l;
  gelaufen.abschlussGelaufen = true;
  CHECK(umhaengNachSubscribe(gelaufen, FEHLER_ZU_OFT, 1).schritte == std::vector<S>{S::WiederholenIn500ms});
  UmhaengPlan p = umhaengNachSubscribe(l, FEHLER_KEINE_FREIGABEDATEN, 2);   // nach zwei 18 das erste 29
  CHECK(hat(p, S::ZielStandNeu) && hat(p, S::VorschauPlatzLeeren) && hat(p, S::SlotMelden) && hat(p, S::WiederholenIn500ms));
  CHECK(p.zustand == SlotState::Starting && p.grund == Grund::modeChanged);   // T20: starting/<grund>
  CHECK(hat(p, S::MischerNeu) && tonIst(p, TonZustand::Waiting, TonGrund::modeChanged, TonQuelle::MixShare));
  // Die ganze Folge so, wie der Ausfuehrer sie fuehrt (Merker am Abo nach dem Abschluss eines 18 oder 29, N2a.2, F2):
  // 18, 18, 29, 29, Erfolg -> genau ein Abschluss, seit F2 beim ersten Aufruf, eine Tonmeldung.
  UmhaengLage lauf = umh(SlotMode::Participant, SlotMode::Share, A, F1, Grund::modeChanged, SlotAudio::Mix, true);
  const int folge[] = {FEHLER_ZU_OFT, FEHLER_ZU_OFT, FEHLER_KEINE_FREIGABEDATEN, FEHLER_KEINE_FREIGABEDATEN, FEHLER_KEINER};
  int versuch = 0, abschluesse = 0, meldungen = 0, abschlussBei = -1, nr = 0;
  size_t tonMeldungen = 0;
  for (const int fehler : folge) {
    const UmhaengPlan q = umhaengNachSubscribe(lauf, fehler, versuch);
    for (const S x : q.schritte) {
      if (x == S::ZielStandNeu) { ++abschluesse; abschlussBei = nr; }
      if (x == S::SlotMelden) ++meldungen;
    }
    tonMeldungen += q.tonFolge.size();
    if (hat(q, S::ZielStandNeu) && hat(q, S::WiederholenIn500ms)) lauf.abschlussGelaufen = true;   // wie der Ausfuehrer (F2)
    if (hat(q, S::WiederholenIn500ms)) ++versuch;
    ++nr;
  }
  CHECK(abschluesse == 1 && meldungen == 1 && abschlussBei == 0 && tonMeldungen == 1);
  CHECK(versuch == 4);   // 18 und 29 zaehlen weiter gemeinsam (Grenze 3 nur fuer 18)
}

void f1_gewuenschtes_ziel() {
  std::printf("N2a F1: gewuenschtes Ziel - waehrend einer Wiederholung deren Ziel, sonst das Abo-Ziel\n");
  // Slot auf A, slotSet {id:B} bekommt 18: abo.target bleibt A, die Wiederholung gilt B. Befehle, Weggang und
  // Sprecher-Wahl vergleichen mit B.
  CHECK(gewuenschtesZiel(true, B, A) == B);
  CHECK(gewuenschtesZiel(false, B, A) == A);   // keine Wiederholung (mehr): das Abo-Ziel
  CHECK(gewuenschtesZiel(true, B, 0) == B);    // slotOn mit 18: abo.target ist noch 0
  CHECK(gewuenschtesZiel(true, F1, F1) == F1); // 29 nach Abschluss: beide gleich
}

void n2b1_sperre_nur_bei_inmeeting() {
  std::printf("N2b.1 Renderer-Sperre: die INMEETING-Kette loest sie nur bei echtem INMEETING, das Meeting-Ende immer\n");
  // Meeting-Status (MeetingStatus 0..15, meeting_service_interface.h:17-51): im Meeting sind INMEETING und die zwei
  // Schloss-Meldungen eines laufenden Meetings (LOCKED/UNLOCKED); alles andere (trennt, verbindet, Warteraum, Ende,
  // unbekannt, Webinar-/Breakout-Wechsel) nicht.
  for (int st = 0; st <= 15; ++st) {
    const bool erwartet = st == STATUS_INMEETING || st == STATUS_LOCKED || st == STATUS_UNLOCKED;
    CHECK(statusImMeeting(st) == erwartet);
  }
  CHECK(STATUS_INMEETING == 3 && STATUS_LOCKED == 9 && STATUS_UNLOCKED == 10);
  CHECK(sperreLoesenErlaubt(Kette::InMeetingErneut, true));
  CHECK(!sperreLoesenErlaubt(Kette::InMeetingErneut, false));   // veraltetes INMEETING: die Sperre bleibt
  CHECK(sperreLoesenErlaubt(Kette::MeetingEnde, false) && sperreLoesenErlaubt(Kette::MeetingEnde, true));   // 6.5: Ende loest
  // SperreLoesen steht nur in diesen zwei Ketten (mit und ohne Sperre) - keine dritte Kette loest ungeprueft.
  bool nurZwei = true;
  for (int k = 0; k <= static_cast<int>(Kette::InMeetingErneut); ++k) {
    for (int sperre = 0; sperre < 2; ++sperre) {
      const Kette kette = static_cast<Kette>(k);
      if (enthaelt(abbauPlan(kette, sperre == 1, true), AS::SperreLoesen) || enthaelt(abbauPlan(kette, sperre == 1, false), AS::SperreLoesen)) {
        nurZwei = nurZwei && (kette == Kette::InMeetingErneut || kette == Kette::MeetingEnde);
      }
    }
  }
  CHECK(nurZwei);
  // Kein Haengenbleiben: RECONNECTING (Sperre an), INMEETING, dann Warteraum (11) in derselben Pumprunde - die Kette
  // laeuft mit einem Status ausserhalb des Meetings und loest nicht; das naechste echte INMEETING loest.
  bool sperreAn = true;
  if (sperreLoesenErlaubt(Kette::InMeetingErneut, statusImMeeting(11))) sperreAn = false;
  CHECK(sperreAn);
  if (sperreLoesenErlaubt(Kette::InMeetingErneut, statusImMeeting(STATUS_INMEETING))) sperreAn = false;
  CHECK(!sperreAn);
  // RECONNECTING, INMEETING, dann LOCKED (der Gastgeber schliesst ab): das Meeting laeuft, die Sperre faellt - sonst
  // bliebe sie bis zum Ende des Meetings stehen, denn ein weiteres INMEETING kommt nicht.
  sperreAn = true;
  if (sperreLoesenErlaubt(Kette::InMeetingErneut, statusImMeeting(STATUS_LOCKED))) sperreAn = false;
  CHECK(!sperreAn);
}

void g1_halteliste_nach_leave_eingefroren() {
  std::printf("N2b G1 leave-Nachlauf: sessionLeave() false friert die Halteliste ein (bis Prozessende), true verwirft sie\n");
  // 6.15: „leave nach einem sessionLeave(), das false lieferte: nichts; die Eintraege bleiben bis zum Prozessende stehen,
  // kein Aufruf am Renderer“. Ohne Einfrieren erreichte ein spaeteres INMEETING desselben Meetings HaltelisteAbbauen.
  for (int sperre = 0; sperre < 2; ++sperre) {
    CHECK(abbauPlan(Kette::LeaveNachlauf, sperre == 1, false) == std::vector<AS>{AS::HaltelisteEinfrieren});
    CHECK(abbauPlan(Kette::LeaveNachlauf, sperre == 1, true) == std::vector<AS>{AS::HaltelisteVerwerfen});
  }
  // Nur der Nachlauf mit false friert ein - keine andere Kette, kein anderer Fall.
  bool nurDort = true;
  for (int k = 0; k <= static_cast<int>(Kette::InMeetingErneut); ++k) {
    for (int sperre = 0; sperre < 2; ++sperre) {
      for (int verlassen = 0; verlassen < 2; ++verlassen) {
        const Kette kette = static_cast<Kette>(k);
        const bool erwartet = kette == Kette::LeaveNachlauf && verlassen == 0;
        nurDort = nurDort && enthaelt(abbauPlan(kette, sperre == 1, verlassen == 1), AS::HaltelisteEinfrieren) == erwartet;
      }
    }
  }
  CHECK(nurDort);
  CHECK(ohneRenderer(abbauPlan(Kette::LeaveNachlauf, true, false)));
}

void af2_18_abschluss_sofort() {
  std::printf("Abschluss F2 (R1) 18: der Abschluss laeuft sofort wie bei 29 - in der Wartezeit weder Bild noch Ton des alten Ziels\n");
  // Teilnehmer A -> B mit Person-Ton, subscribe(B) antwortet 18. Vorher blieb bis zu 3 x 500 ms der Ziel-Stand von A
  // stehen: seine Kopie (freeze), sein Person-Ton und target A im slot-Ereignis.
  const UmhaengLage l = umh(SlotMode::Participant, SlotMode::Participant, A, B, Grund::targetChanged, SlotAudio::Person, false);
  UmhaengPlan p = umhaengNachSubscribe(l, FEHLER_ZU_OFT, 0);
  CHECK((p.schritte == std::vector<S>{S::ZielStandNeu, S::VorschauPlatzLeeren, S::IsVideoOnFragen, S::SlotMelden, S::TonStandNeu,
                                      S::TonMelden, S::WiederholenIn500ms}));
  CHECK(p.zustand == SlotState::Starting && p.grund == Grund::targetChanged);           // slot starting/targetChanged mit target B
  CHECK(tonIst(p, TonZustand::Waiting, TonGrund::targetChanged, TonQuelle::Person));   // der Person-Ton haengt jetzt an B
  CHECK(!planBrauchtRenderer(p));
  // Danach (Merker am Abo; lageFuer liest altesZiel aus dem Abo, das jetzt B ist): weitere 18 nur die Wiederholung, der
  // Erfolg ohne zweiten Abschluss, das 18 nach drei Wiederholungen subscribeFailed ohne zweite Tonmeldung.
  UmhaengLage danach = l;
  danach.abschlussGelaufen = true;
  danach.altesZiel = B;
  CHECK(umhaengNachSubscribe(danach, FEHLER_ZU_OFT, 1).schritte == std::vector<S>{S::WiederholenIn500ms});
  CHECK(umhaengNachSubscribe(danach, FEHLER_KEINER, 2).schritte.empty());
  p = umhaengNachSubscribe(danach, FEHLER_ZU_OFT, 3);
  CHECK(p.zustand == SlotState::Fallback && p.grund == Grund::subscribeFailed && hat(p, S::FehlerSubscribeMelden) && keinTon(p));
  // Freigabewechsel F1 -> F2 im Mischer-Slot: starting/shareChanged auf F2 sofort (target und share gehoeren dann beide zur
  // neuen Freigabe), nur Eingang B des Mischers neu, kein IsVideoOn.
  p = umhaengNachSubscribe(umh(SlotMode::Share, SlotMode::Share, F1, F2, Grund::shareChanged, SlotAudio::Mix, true), FEHLER_ZU_OFT, 0);
  CHECK(hat(p, S::ZielStandNeu) && !hat(p, S::IsVideoOnFragen) && p.zustand == SlotState::Starting && p.grund == Grund::shareChanged);
  CHECK(hat(p, S::MischerEingangBNeu) && stelle(p, S::ZielStandNeu) < stelle(p, S::WiederholenIn500ms));
  // Die ganze Folge Teilnehmer -> Freigabe mit Mischton und Computerton, wie der Ausfuehrer sie fuehrt: 18, 18, Erfolg ->
  // genau ein Abschluss beim ersten Aufruf, eine Tonmeldung, einmal MischerNeu.
  UmhaengLage lauf = umh(SlotMode::Participant, SlotMode::Share, A, F1, Grund::modeChanged, SlotAudio::Mix, true);
  const int folge[] = {FEHLER_ZU_OFT, FEHLER_ZU_OFT, FEHLER_KEINER};
  int versuch = 0, abschluesse = 0, abschlussBei = -1, mischerNeu = 0, nr = 0;
  size_t tonMeldungen = 0;
  for (const int fehler : folge) {
    const UmhaengPlan q = umhaengNachSubscribe(lauf, fehler, versuch);
    if (hat(q, S::ZielStandNeu)) { ++abschluesse; abschlussBei = nr; }
    if (hat(q, S::MischerNeu)) ++mischerNeu;
    tonMeldungen += q.tonFolge.size();
    if (hat(q, S::ZielStandNeu) && hat(q, S::WiederholenIn500ms)) {
      lauf.abschlussGelaufen = true;           // Merker (Ausfuehrer, WiederholenIn500ms)
      lauf.modusVorher = lauf.modusNachher;    // wiederholModusVorher nach dem Abschluss
      lauf.altesZiel = lauf.neuesZiel;         // lageFuer: abo.target ist jetzt das neue Ziel
    }
    if (hat(q, S::WiederholenIn500ms)) ++versuch;
    ++nr;
  }
  CHECK(abschluesse == 1 && abschlussBei == 0 && tonMeldungen == 1 && mischerNeu == 1 && versuch == 2);
}

void af5_subscribe_failed_bleibt() {
  std::printf("Abschluss F5 (R2): fallback/subscribeFailed bleibt im Freigabe-Slot, auch wenn die gezeigte Freigabe pausiert\n");
  ZielStand ohneBild;
  zielStandNeu(ohneBild, at(1000));   // Ziel-Stand nach dem gescheiterten subscribe (ZielStandNeu im Fehler-Plan)
  BildLage l = lage(SlotMode::Share, Fallback::Black, SlotState::Fallback, Grund::subscribeFailed, 3000);
  l.freigabePausiert = true;
  BildEntscheidung e = bildEntscheidung(l, ohneBild);
  CHECK(!e.zustandAendern && e.sent == Sent::Black && e.jetztSenden);
  l.freigabePausiert = false;   // die Freigabe laeuft weiter: weiter T20c
  CHECK(!bildEntscheidung(l, ohneBild).zustandAendern);
  // Ohne gescheitertes subscribe wie bisher: nach 2 s ohne Bild bei Pause fallback/sharePaused (6.9, W1).
  l = lage(SlotMode::Share, Fallback::Black, SlotState::Starting, Grund::shareChanged, 3000);
  l.freigabePausiert = true;
  e = bildEntscheidung(l, ohneBild);
  CHECK(e.zustandAendern && e.zustand == SlotState::Fallback && e.grund == Grund::sharePaused);
}

void af6_kamera_aus_vor_erstem_bild() {
  std::printf("Abschluss F6 (M1 c): Kamera laut Zoom aus vor dem ersten Bild -> gleich fallback/cameraOff (B31, wie die Attrappe)\n");
  ZielStand neu;
  zielStandNeu(neu, at(1000));
  BildLage l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Starting, Grund::targetChanged, 1010);
  l.kameraAusLautZoom = true;   // videoStatus Video_OFF bzw. Mute_ByHost nach dem Umhaengen, vor dem ersten Bild
  BildEntscheidung e = bildEntscheidung(l, neu);
  CHECK(e.zustandAendern && e.zustand == SlotState::Fallback && e.grund == Grund::cameraOff);
  CHECK(e.sent == Sent::Transparent && e.jetztSenden);   // das Ersatzbild laeuft wie vorher
  l.modus = SlotMode::Speaker;   // wie die Attrappe (kameraSetzen): auch im Sprecher-Slot cameraOff
  e = bildEntscheidung(l, neu);
  CHECK(e.zustandAendern && e.zustand == SlotState::Fallback && e.grund == Grund::cameraOff);
  // Ohne Meldung bleibt starting (6.12); ein Zustand aus Schritt 7 (schon fallback) bleibt, wie er ist.
  l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Starting, Grund::targetChanged, 1010);
  CHECK(!bildEntscheidung(l, neu).zustandAendern);
  l = lage(SlotMode::Speaker, Fallback::Transparent, SlotState::Fallback, Grund::speakerNoVideo, 1010);
  l.kameraAusLautZoom = true;
  CHECK(!bildEntscheidung(l, neu).zustandAendern);
  // Freigabe nie cameraOff; Ziel 0: den Zustand setzt das Umhaengen.
  l = lage(SlotMode::Share, Fallback::Transparent, SlotState::Starting, Grund::shareChanged, 1010);
  l.kameraAusLautZoom = true;
  CHECK(!bildEntscheidung(l, neu).zustandAendern);
  l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Fallback, Grund::noTarget, 1010);
  l.ziel = 0;
  l.kameraAusLautZoom = true;
  CHECK(!bildEntscheidung(l, neu).zustandAendern);
}

void af8_fehler_vor_slot() {
  std::printf("Abschluss F8 b (M1 b): gescheitertes subscribe meldet slotSubscribeFailed vor slot fallback/subscribeFailed\n");
  const UmhaengLage l = umh(SlotMode::Participant, SlotMode::Participant, A, B, Grund::targetChanged, SlotAudio::Off, false);
  const auto vorher = [](const UmhaengPlan& p) {
    return stelle(p, S::FehlerSubscribeMelden) >= 0 && stelle(p, S::FehlerSubscribeMelden) < stelle(p, S::SlotMelden);
  };
  CHECK(vorher(umhaengNachSubscribe(l, 7, 0)));                 // anderer Fehler
  CHECK(vorher(umhaengNachSubscribe(l, FEHLER_ZU_OFT, 3)));     // 18 nach drei Wiederholungen
  UmhaengLage keinRenderer = l;
  keinRenderer.rendererTot = true;
  keinRenderer.rendererGescheitert = true;
  CHECK(vorher(umhaengNachSubscribe(keinRenderer, 3, 0)));      // createRenderer gescheitert (6.10 Schritt 2)
}

void af11_audio_unavailable_ohne_ton() {
  std::printf("Abschluss F11 (M5): ein Slot auf off/audioUnavailable bekommt keinen Ton, bis an ihm Ton wieder eingeschaltet wird\n");
  // Slot 1 Teilnehmer A mit Person-Ton, Slot 2 Sprecher mit Mischton, Slot 3 Freigabe mit Computerton von B, Slot 4 Freigabe
  // mit Mischton und Computerton von B. Das globale Ton-Abo kam ueber einen anderen Slot zustande (6.13).
  std::vector<TonSlotSicht> s(4);
  for (int i = 0; i < 4; ++i) {
    s[static_cast<size_t>(i)].nr = i + 1;
    s[static_cast<size_t>(i)].laeuft = true;
  }
  s[0].modus = SlotMode::Participant; s[0].ziel = A; s[0].audio = SlotAudio::Person;
  s[1].modus = SlotMode::Speaker; s[1].ziel = B; s[1].audio = SlotAudio::Mix;
  s[2].modus = SlotMode::Share; s[2].ziel = F1; s[2].audio = SlotAudio::Off; s[2].shareAudio = true; s[2].shareUser = B;
  s[3].modus = SlotMode::Share; s[3].ziel = F1; s[3].audio = SlotAudio::Mix; s[3].shareAudio = true; s[3].shareUser = B;
  for (TonSlotSicht& x : s) x.tonAudioUnavailable = true;
  CHECK(tonZiele(PaketArt::Person, A, s).empty());
  CHECK(tonZiele(PaketArt::Mix, 0, s).empty());
  CHECK(tonZiele(PaketArt::Share, B, s).empty());
  // Ton am Slot wieder eingeschaltet (audioEnsureSubscribed glueckt): die Zuordnung nach Tabelle 6.13 gilt wieder.
  for (TonSlotSicht& x : s) x.tonAudioUnavailable = false;
  CHECK(zieleSind(tonZiele(PaketArt::Person, A, s), {{1, Weg::Direkt}}));
  CHECK(zieleSind(tonZiele(PaketArt::Mix, 0, s), {{2, Weg::Direkt}, {4, Weg::MischerA}}));
  CHECK(zieleSind(tonZiele(PaketArt::Share, B, s), {{3, Weg::Direkt}, {4, Weg::MischerB}}));
  // Nur der betroffene Slot faellt heraus.
  s[3].tonAudioUnavailable = true;
  CHECK(zieleSind(tonZiele(PaketArt::Mix, 0, s), {{2, Weg::Direkt}}));
  CHECK(zieleSind(tonZiele(PaketArt::Share, B, s), {{3, Weg::Direkt}}));
}

void af15_rueckrufe_im_flug() {
  std::printf("Abschluss F15: Rueckrufe im Flug - erst zaehlen, dann pruefen; vor dem Freigeben abmelden und abwarten, mit Frist\n");
  // Ohne Threads: die Uhr und die Pause speist der Fall ein (eine Pause = 10 ms).
  int64_t uhr = 0;
  int pausen = 0;
  const std::function<int64_t()> jetzt = [&uhr] { return uhr; };
  const std::function<void()> pause = [&uhr, &pausen] { uhr += 10; ++pausen; };
  CHECK(RUECKRUF_FRIST_MS == 500);
  // Betreten vor dem Abmelden: der Rueckruf laeuft weiter, das Abwarten laeuft in die Frist (false).
  RueckrufWache w;
  CHECK(rueckrufBetreten(w) && w.imFlug.load() == 1);
  rueckrufAbmelden(w);
  CHECK(!rueckrufeAbwarten(w, uhr + RUECKRUF_FRIST_MS, jetzt, pause));
  CHECK(uhr == RUECKRUF_FRIST_MS && pausen == static_cast<int>(RUECKRUF_FRIST_MS / 10));
  // Nach dem Verlassen: sofort fertig (true), ohne Pause.
  rueckrufVerlassen(w);
  pausen = 0;
  CHECK(rueckrufeAbwarten(w, uhr + RUECKRUF_FRIST_MS, jetzt, pause) && pausen == 0);
  // Betreten nach dem Abmelden: abgewiesen, der Zaehler steht wieder auf 0.
  CHECK(!rueckrufBetreten(w) && w.imFlug.load() == 0);
  // Der Waechter eines Rueckrufs: zaehlt im Konstruktor, gibt im Destruktor zurueck - abgewiesen zaehlt er nicht doppelt.
  RueckrufWache v;
  {
    const RueckrufImFlug f(v);
    CHECK(f.drin() && v.imFlug.load() == 1);
  }
  CHECK(v.imFlug.load() == 0);
  rueckrufAbmelden(v);
  {
    const RueckrufImFlug f(v);
    CHECK(!f.drin() && v.imFlug.load() == 0);
  }
  CHECK(v.imFlug.load() == 0);
  // Ein Rueckruf, der waehrend des Wartens endet: fertig nach drei Pausen, vor der Frist.
  RueckrufWache u;
  CHECK(rueckrufBetreten(u));
  rueckrufAbmelden(u);
  pausen = 0;
  const int64_t beginn = uhr;
  const std::function<void()> endetNachDrei = [&uhr, &pausen, &u] {
    uhr += 10;
    if (++pausen == 3) rueckrufVerlassen(u);
  };
  CHECK(rueckrufeAbwarten(u, beginn + RUECKRUF_FRIST_MS, jetzt, endetNachDrei) && pausen == 3 && uhr - beginn == 30);
  // Zwei Rueckrufe im Flug: erst nach dem zweiten Verlassen fertig.
  RueckrufWache z;
  CHECK(rueckrufBetreten(z) && rueckrufBetreten(z) && z.imFlug.load() == 2);
  rueckrufAbmelden(z);
  rueckrufVerlassen(z);
  CHECK(!rueckrufeAbwarten(z, uhr + 20, jetzt, pause));
  rueckrufVerlassen(z);
  CHECK(rueckrufeAbwarten(z, uhr, jetzt, pause));   // auch bei abgelaufener Frist true, wenn keiner mehr fliegt
}

void s285_schonfrist_ohne_bild() {
  std::printf("#285/#286 Schonfrist: Kamera laut Zoom an, kein Bild -> 2 s nichts senden (Empfaenger haelt das letzte Bild), "
              "erst dann Ersatzbild und fallback/noFrames; Kamera aus und bufferMismatch wie bisher nach 200 ms\n");
  const ZielStand bild = zielMitBild(0, 1000, false);
  const ZielStand bildKopie = zielMitBild(0, 1000, true);
  // Teilnehmer: 200 ms und 1999 ms nach dem letzten Bild weder Ersatzbild noch Zustandswechsel.
  BildLage l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Live, Grund::frames, 1200);
  BildEntscheidung e = bildEntscheidung(l, bild);
  CHECK(e.sent == Sent::None && !e.jetztSenden && !e.zustandAendern);
  l.jetzt = at(2999);
  e = bildEntscheidung(l, bild);
  CHECK(e.sent == Sent::None && !e.jetztSenden && !e.zustandAendern);
  // Ab 2 s: Ersatzbild nach Einstellung und fallback/noFrames.
  l.jetzt = at(3000);
  e = bildEntscheidung(l, bild);
  CHECK(e.sent == Sent::Transparent && e.jetztSenden);
  CHECK(e.zustandAendern && e.zustand == SlotState::Fallback && e.grund == Grund::noFrames);
  // Sprecher-Slot genauso.
  l = lage(SlotMode::Speaker, Fallback::Black, SlotState::Live, Grund::frames, 1500);
  e = bildEntscheidung(l, bild);
  CHECK(e.sent == Sent::None && !e.zustandAendern);
  l.jetzt = at(3000);
  e = bildEntscheidung(l, bild);
  CHECK(e.sent == Sent::Black && e.zustandAendern && e.grund == Grund::noFrames);
  // „eingefroren“ mit Kopie: in der Schonfrist nichts (der Empfaenger haelt), danach die Kopie.
  l = lage(SlotMode::Participant, Fallback::Freeze, SlotState::Live, Grund::frames, 1500);
  CHECK(bildEntscheidung(l, bildKopie).sent == Sent::None);
  l.jetzt = at(3000);
  CHECK(bildEntscheidung(l, bildKopie).sent == Sent::Freeze);
  // Meldet Zoom die Kamera als aus, gilt die Schonfrist nicht: ab 200 ms Ersatzbild und fallback/cameraOff.
  l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Live, Grund::frames, 1200);
  l.kameraAusLautZoom = true;
  e = bildEntscheidung(l, bild);
  CHECK(e.sent == Sent::Transparent && e.jetztSenden);
  CHECK(e.zustandAendern && e.zustand == SlotState::Fallback && e.grund == Grund::cameraOff);
  // Kommt die Meldung „Kamera aus“ mitten in der Schonfrist, sofort Ersatzbild und cameraOff.
  l.jetzt = at(1700);
  e = bildEntscheidung(l, bild);
  CHECK(e.sent == Sent::Transparent && e.zustandAendern && e.grund == Grund::cameraOff);
  // Ein laufender bufferMismatch bleibt bei 200 ms.
  l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Live, Grund::frames, 1300);
  l.bufferMismatch = true;
  e = bildEntscheidung(l, bild);
  CHECK(e.sent == Sent::Transparent && e.zustandAendern && e.grund == Grund::bufferMismatch);
}

void s285_kamera_fragen_in_der_schonfrist() {
  std::printf("#285/#286 Schonfrist: ab 200 ms ohne Bild einmal je Luecke Zoom fragen (IsVideoOn), damit Kamera aus "
              "wie bisher nach 200 ms greift\n");
  const ZielStand bild = zielMitBild(0, 1000, false);
  BildLage l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Live, Grund::frames, 1199);
  CHECK(!bildEntscheidung(l, bild).kameraFragen);   // juenger als 200 ms
  l.jetzt = at(1200);
  CHECK(bildEntscheidung(l, bild).kameraFragen);    // ab 200 ms
  l.jetzt = at(2999);
  CHECK(bildEntscheidung(l, bild).kameraFragen);    // bis zum Ende der Schonfrist
  l.kameraGefragt = true;
  CHECK(!bildEntscheidung(l, bild).kameraFragen);   // in dieser Luecke schon gefragt
  l = lage(SlotMode::Speaker, Fallback::Transparent, SlotState::Live, Grund::frames, 1500);
  CHECK(bildEntscheidung(l, bild).kameraFragen);
  // Nach der Schonfrist fragt der Zustandswechsel selbst (video.cpp, wie bisher), nicht diese Meldung.
  l.jetzt = at(3000);
  CHECK(!bildEntscheidung(l, bild).kameraFragen);
  // Kamera laut Zoom schon aus, laufender bufferMismatch, Freigabe, Ziel 0, vor dem ersten Bild: nie fragen.
  l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Live, Grund::frames, 1500);
  l.kameraAusLautZoom = true;
  CHECK(!bildEntscheidung(l, bild).kameraFragen);
  l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Live, Grund::frames, 1500);
  l.bufferMismatch = true;
  CHECK(!bildEntscheidung(l, bild).kameraFragen);
  l = lage(SlotMode::Share, Fallback::Transparent, SlotState::Live, Grund::frames, 1500);
  CHECK(!bildEntscheidung(l, bild).kameraFragen);
  l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Fallback, Grund::participantLeft, 1500);
  l.ziel = 0;
  CHECK(!bildEntscheidung(l, bild).kameraFragen);
  const ZielStand neu = zielMitBild(5000, -1, false);
  l = lage(SlotMode::Participant, Fallback::Transparent, SlotState::Starting, Grund::targetChanged, 5300);
  CHECK(!bildEntscheidung(l, neu).kameraFragen);
}

// ── ENDE DER FALLFUNKTIONEN (neue Funktionen direkt darüber einfügen) ──
}  // namespace

int main() {
  a4_namen();
  pb1_haltezeit_genau();
  pb2_neuer_kandidat_startet_neu();
  pb3_ohne_ziel_sofort();
  pb4_eigene_und_null_nie();
  pb5_aktives_audio_liste();
  pb6_ohne_kamera();
  pb7_nur_gewaehltes_signal();
  pb8_gezeigter_geht();
  pb9_haltezeit_grenzen();
  pb26_erinnerung_belegt_vor();
  a5_namen();
  pb10_ruecksprung();
  pb11_pause();
  pb12_tonfreigabe_nie_gezeigt();
  pb13_person_geht();
  pb14_eigene_freigaben_nichts();
  pb15_befuellen();
  pb27_typ_nachtrag();
  pb16_ersatzbild_tabelle();
  pb16_kreuzprodukt();
  pb23_riegel();
  pb24_grund_nach_200ms();
  pb29_halten();
  a6_namensregel();
  pb19_moduswechsel_und_ziel0();
  a7_kamera_aus_beim_umhaengen();
  pb21_umhaeng_plan();
  pb22_ziel_stand();
  pb22_ton_stand();
  pb22_person_ton();
  pb22_mischton_bleibt();
  pb22_mischer_beim_moduswechsel();
  pb22_nur_computerton();
  pb22_person_mit_computerton();
  pb22_person_im_sprecher();
  pb22_audio_unavailable_bleibt();
  pb22_umschalten_ton_stand();
  pb22_umschalten_abo();
  pb22_umschalten_person();
  pb22_umschalten_no_share();
  pb25_ton_zuordnung();
  pb30_stille_bloecke();
  pb20_abbau_ohne_sperre();
  pb20_abbau_mit_sperre();
  pb20_renderer_tot_und_halteliste();
  a8_base64();
  n1_29_dann_erfolg();
  n1_plan_braucht_renderer();
  n2a2_18_18_dann_29();
  f1_gewuenschtes_ziel();
  n2b1_sperre_nur_bei_inmeeting();
  g1_halteliste_nach_leave_eingefroren();
  af2_18_abschluss_sofort();
  af5_subscribe_failed_bleibt();
  af6_kamera_aus_vor_erstem_bild();
  af8_fehler_vor_slot();
  af11_audio_unavailable_ohne_ton();
  af15_rueckrufe_im_flug();
  s285_schonfrist_ohne_bild();
  s285_kamera_fragen_in_der_schonfrist();
// ── ENDE DER FÄLLE (neue Blöcke direkt darüber einfügen) ──
  std::printf("\n%d Pruefungen, %d gefallen.\n", g_run, g_fail);
  return g_fail == 0 ? 0 : 1;
}

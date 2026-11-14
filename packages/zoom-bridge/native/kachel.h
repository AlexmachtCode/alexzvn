// Zeichner der Zoom-Kachel (#306): Direct2D/DirectWrite/WIC, je Zustandswechsel einmal, nie je Bild.
//
// Was auf der Kachel steht und wie groß es ist, entscheidet die reine Logik (kachel_logik.h); hier wird es
// gezeichnet und als deckendes I420 (BT.601, begrenzter Wertebereich) abgegeben. Gezeichnet wird immer auf einem
// eigenen Thread (kachelStarten), nie auf dem Hauptthread der Bridge im Meeting: ein Profilbild auf einem
// hängenden Netzlaufwerk darf die Hauptschleife nicht halten, sie wartet höchstens KACHEL_WARTEN_MS.
//
// Dieser Header bindet kein windows.h ein (HRESULT steht als long darin). Wer ihn nach windows.h einbindet
// (video.cpp), bekommt kachel_logik.h trotzdem ohne die Makros min und max (std::min/std::max darin).
#pragma once

#include <condition_variable>
#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

#pragma push_macro("min")
#pragma push_macro("max")
#undef min
#undef max
#include "kachel_logik.h"
#pragma pop_macro("max")
#pragma pop_macro("min")

/** Was gezeichnet werden soll; Name und Pfad UTF-16 wie von Zoom. Leerer Pfad = ohne Profilbild. */
struct KachelAuftrag {
  std::u16string name;
  std::u16string profilbild;
  bool hinweis = false;
  int w = 0, h = 0;
};

/**
 * Ergebnis eines Zeichenauftrags. i420 == nullptr = Zeichnen gescheitert (hresult sagt warum, der Aufrufer zeigt
 * die dunkle Grundfläche). Sonst ist fehler der Befund des Profilbilds (Keiner = verwendet) und hresult das
 * HRESULT seines Scheiterns (0, wo es keins gibt, etwa bei zuGross).
 */
struct KachelErgebnis {
  std::shared_ptr<const std::vector<uint8_t>> i420;
  kachel::ProfilbildFehler fehler = kachel::ProfilbildFehler::Keiner;
  long hresult = 0;
  int64_t dauerUs = 0;
};

/**
 * Zeichnet die Kachel blockierend und initialisiert COM (MTA) auf dem eigenen Thread. Wirft nie. NIE auf dem
 * Hauptthread der Bridge im Meeting rufen – dafür gibt es kachelStarten.
 */
KachelErgebnis kachelZeichnen(const KachelAuftrag& a);

/**
 * Ein laufender Zeichenauftrag. Der Zeichen-Thread schreibt ergebnis und setzt unter m fertig = true; wer fertig
 * unter m wahr gesehen hat (kachelWarten/kachelFertig), darf ergebnis danach ohne Sperre lesen – der Thread fasst
 * den Job danach nie wieder an.
 */
struct KachelJob {
  kachel::KachelSchluessel schluessel;
  std::mutex m;
  std::condition_variable cv;
  bool fertig = false;
  KachelErgebnis ergebnis;
};

/**
 * Startet kachelZeichnen auf einem losgelösten Thread. Der Thread hält Auftrag und Job selbst; wer den Job
 * loslässt, hält nichts auf. Lässt sich kein Thread starten, ist der Job sofort fertig, ohne Bild.
 */
std::shared_ptr<KachelJob> kachelStarten(KachelAuftrag a, const kachel::KachelSchluessel& k);

/** Wartet höchstens ms Millisekunden auf das Ende des Auftrags; wahr = fertig. */
bool kachelWarten(KachelJob& j, int64_t ms);

/** Ist der Auftrag fertig? Wartet nicht. */
bool kachelFertig(KachelJob& j);

/**
 * Sonderweg `zoom-bridge.exe --kachel-muster <ordner>`: zeichnet die 21 Musterkacheln in den Ordner (PNG, so wie
 * der Mischer sie sieht), je Fall eine stdout-Zeile, am Ende eine Schlusszeile. Rückgabe = Exitcode.
 */
int kachelMuster(const std::wstring& ordner);

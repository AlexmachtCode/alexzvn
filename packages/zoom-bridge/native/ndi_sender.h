#pragma once
#include <cstdint>
#include <mutex>
#include <string>
#include <vector>
#include <Processing.NDI.Lib.h>

/**
 * Einmal je Prozess, VOR dem ersten NdiSender. Liefert false, wenn die
 * NDI-Laufzeit auf diesem Rechner nicht laeuft (fehlende Runtime-DLL).
 */
bool ndiInitialize();

/** Einmal je Prozess, NACH dem letzten NdiSender. */
void ndiShutdown();

/**
 * EIN NDI-Sender. Kennt Zoom nicht.
 *
 * ACHTUNG, WARUM DIE SPERRE: auf denselben Sender schreiben ZWEI Threads -
 * der Bild-Rueckruf des Zoom-SDK und der Schwarzbild-Herzschlag aus der
 * Hauptschleife. Die Sperre gehoert je Sender, NICHT global: zwei Abos
 * duerfen sich nicht gegenseitig ausbremsen.
 */
class NdiSender {
 public:
  NdiSender() = default;
  ~NdiSender();
  NdiSender(const NdiSender&) = delete;
  NdiSender& operator=(const NdiSender&) = delete;

  /** Legt den Sender an. false = NDIlib_send_create ist fehlgeschlagen. */
  bool open(const std::string& nameUtf8);

  /**
   * Sendet ein I420-Vollbild. `buf` zeigt auf den ZUSAMMENHAENGENDEN Puffer
   * (Y, dann U, dann V) - genau die Anordnung, die NDI erwartet.
   */
  void sendI420(const uint8_t* buf, int width, int height);

  /** Sendet ein schwarzes I420-Vollbild dieser Groesse. */
  void sendBlack(int width, int height);

  void close();

 private:
  NDIlib_send_instance_t send_ = nullptr;
  std::mutex mutex_;
  // Wiederverwendeter Schwarzpuffer - je Herzschlag neu zu belegen waere
  // 10-mal je Sekunde je Abo eine Speicheranforderung fuer immer denselben
  // Inhalt.
  std::vector<uint8_t> black_;
  int blackW_ = 0;
  int blackH_ = 0;
};

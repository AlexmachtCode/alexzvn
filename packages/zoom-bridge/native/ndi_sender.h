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

/**
 * Ob ndiInitialize() in diesem Prozess geglueckt ist.
 *
 * Gebraucht von videoSubscribe() (video.cpp): ohne diese Frage meldete der
 * naechste Abo-Versuch nach einem fehlgeschlagenen NDIlib_initialize()
 * "videoSenderFailed" - also einen fehlgeschlagenen EINZELNEN Sender - und
 * schickte die Suche damit zu diesem einen Abo statt zur fehlenden
 * NDI-Laufzeit auf dem Rechner. Genau diese Verwechslung nennt der
 * Katalogkommentar zu ndiInitFailed in src/protocol.ts ausdruecklich als das,
 * was nicht passieren darf: zwei Ursachen, ein Name.
 *
 * "false" heisst hier ausdruecklich "NDI steht in diesem Prozess NICHT zur
 * Verfuegung" und deckt damit auch den Fall "ndiInitialize() wurde nie
 * gerufen" mit ab. Fuer den Abo-Weg sind die beiden nicht unterscheidbar und
 * muessen es auch nicht sein: ndiInitialize() laeuft beim Befehl "init"
 * (main.cpp), und ein Abo kommt ohne "init" gar nicht bis hierher - es
 * scheitert vorher an der fehlenden Rohdaten-Erlaubnis.
 */
bool ndiIsUp();

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

  /**
   * Sendet interleaved PCM16 - genau die Form, die Zoom liefert, und genau
   * die, die NDI nimmt (NDIlib_audio_frame_interleaved_16s_t). Keine
   * Umrechnung, kein Umpacken.
   *
   * @param sampleCount Abtastwerte JE KANAL, nicht insgesamt.
   */
  void sendAudio(const int16_t* samples, int sampleCount, int sampleRate, int channels);

  /** Sendet Nulldaten desselben Formats - der Stille-Herzschlag. */
  void sendSilence(int sampleCount, int sampleRate, int channels);

  void close();

 private:
  /**
   * Baut den Audio-Frame und sendet ihn - OHNE selbst zu sperren. Der
   * Aufrufer MUSS mutex_ bereits halten.
   *
   * WARUM ES DIESEN HELFER BRAUCHT (Nachbesserung): sendSilence() musste den
   * Stillepuffer VOR dem Senden pruefen/vergroessern, und sendAudio() sperrt
   * fuer die Dauer seines eigenen Sendeaufrufs - zwei Sperrungen desselben
   * mutex_ nacheinander waeren kein Problem gewesen, ABER dazwischen laege
   * eine Luecke ohne Sperre, in der ein ZWEITER Aufrufer silence_ vergroessern
   * (also NEU ALLOZIEREN) koennte. Der zuvor gelesene .data()-Zeiger zeigte
   * dann auf freigegebenen Speicher - das Risiko war nicht, dass sich der
   * INHALT des Puffers aendert (er ist immer Null), sondern dass sich seine
   * ADRESSE verschiebt. Dieser Helfer laesst sendSilence() Vergroessern UND
   * Senden in EINER einzigen kritischen Sektion erledigen.
   */
  void sendAudioLocked(const int16_t* samples, int sampleCount, int sampleRate, int channels);

  NDIlib_send_instance_t send_ = nullptr;
  std::mutex mutex_;
  // Wiederverwendeter Schwarzpuffer - je Herzschlag neu zu belegen waere
  // 10-mal je Sekunde je Abo eine Speicheranforderung fuer immer denselben
  // Inhalt.
  std::vector<uint8_t> black_;
  int blackW_ = 0;
  int blackH_ = 0;
  // Wiederverwendeter Stillepuffer - aus demselben Grund wie black_: je
  // Herzschlag neu zu belegen waere 100-mal je Sekunde je Abo eine
  // Speicheranforderung fuer immer denselben Inhalt (Nullen).
  std::vector<int16_t> silence_;
};

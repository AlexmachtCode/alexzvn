#pragma once
#include <cstdint>
#include <mutex>
#include <string>
#include <vector>
#include <Processing.NDI.Lib.h>
#include "delay_line.h"

/**
 * Obergrenze des Bild-Versatzes (Befehl videoDelay), in Millisekunden.
 * DIESELBE Zahl wie VIDEO_DELAY_MAX_MS in src/protocol.ts - die beiden muessen
 * gleich bleiben (test/delay-probe.mjs prueft die Grenze an der echten .exe).
 */
constexpr int kMaxVideoDelayMs = 1000;

/**
 * Setzt den Bild-Versatz fuer ALLE Sender dieses Prozesses (Owner,
 * 30.09.2026: ein Wert fuer alle Zoom-Quellen). Wirkt SOFORT, auch auf Bilder,
 * die schon warten - siehe DelayLine::release(). Der Aufrufer prueft den
 * Bereich (main.cpp); hier wird nur noch gespeichert.
 */
void ndiSetVideoDelayMs(int ms);

/** Der geltende Bild-Versatz. 0 = kein Versatz, der Weg von vor Punkt 5. */
int ndiVideoDelayMs();

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
   *
   * MIT BILD-VERSATZ (ndiVideoDelayMs() > 0): das Bild wird KOPIERT und
   * wartet; gesendet wird, was faellig ist. Der Anstoss kommt vom naechsten
   * eintreffenden Bild - die Quelle behaelt so Zooms eigenen Bildtakt statt
   * des 15-ms-Rasters der Hauptschleife. Bei 0 und leerer Warteschlange ist
   * das GENAU der Weg von vor Punkt 5 (Stage-2-Abnahme bleibt gueltig).
   */
  void sendI420(const uint8_t* buf, int width, int height);

  /**
   * Sendet ein schwarzes I420-Vollbild dieser Groesse. Mit Bild-Versatz
   * laeuft es durch DIESELBE Warteschlange wie echte Bilder - sonst ueberholte
   * das Schwarz die letzten Bilder vor dem Kamera-Aus.
   */
  void sendBlack(int width, int height);

  /**
   * Der NACHLAUF: gibt wartende Bilder aus, die das naechste eintreffende
   * Bild offensichtlich nicht mehr anstoesst - laenger als
   * DelayLine::kNachlaufKarenz ueberfaellig (Kamera aus, Gast weg, Zoom
   * stockt). Von videoTick() je Abo gerufen. Tut nichts ohne Versatz.
   *
   * BERICHTIGT (Review 30.09.2026): die erste Fassung gab hier ALLES Faellige
   * aus. Weil der Tick (~15 ms) fast immer vor dem naechsten Bild (~33 ms)
   * kam, lief die Quelle dann im Raster der Hauptschleife - genau das, was
   * sendI420() oben ausschliessen will.
   */
  void pump();

  /** Was seit dem letzten Abholen mit wartenden Bildern geschah. */
  struct DelayZaehler {
    unsigned int beimEinreihen = 0;   // ausgegeben, angestossen von einem neuen Bild/Schwarzbild
    unsigned int imNachlauf = 0;      // ausgegeben von pump() - im Normalbetrieb nahe 0
    unsigned int verworfen = 0;       // Schwall-Regel oder Obergrenze
  };

  /**
   * Liefert die Zaehler und setzt sie zurueck. Fuer die Diagnosezeile in
   * videoTick(): ob die Quelle Zooms Takt behaelt, ist sonst nur behauptet.
   */
  DelayZaehler takeDelayZaehler();

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

  /** Sendet ein Schwarzbild. Der Aufrufer MUSS mutex_ halten (black_ haengt daran). */
  void sendBlackLocked(int width, int height);

  /**
   * Gibt aus delay_ aus, was jetzt faellig ist - `nachlauf` waehlt die Regel
   * (releaseNachlauf mit Karenz statt release). Der Aufrufer MUSS mutex_
   * halten - Ausgeben UND Senden liegen in EINER kritischen Sektion, sonst
   * koennten Rueckruf-Thread und Hauptschleife zwei Bilder in vertauschter
   * Reihenfolge senden. Schreibt die Zaehler fort.
   * @return wie viele Bilder verworfen wurden.
   */
  int releaseDueLocked(bool nachlauf);

  NDIlib_send_instance_t send_ = nullptr;
  // Die wartenden Bilder bei Bild-Versatz. Leer, solange der Versatz 0 ist.
  DelayLine delay_;
  DelayZaehler zaehler_;   // unter mutex_
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

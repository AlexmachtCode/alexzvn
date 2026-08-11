// zoom-bridge.exe - Stage 1.
//
// EIN Thread pumpt die Win32-Nachrichten (ohne sie kommt kein SDK-Rueckruf an),
// EIN Thread liest stdin. Der Leser legt fertige Zeilen in eine Warteschlange,
// der Hauptthread arbeitet sie zwischen zwei Pumprunden ab. Alle SDK-Aufrufe
// passieren damit auf demselben Thread, der auch pumpt.
#include <atomic>
#include <deque>
#include <mutex>
#include <string>
#include <thread>
#include <cstdio>
#include <windows.h>
#include "emit.h"
#include "session.h"

namespace {

std::mutex g_mutex;
std::deque<std::string> g_lines;
// atomic statt volatile: volatile garantiert KEINE Sichtbarkeit ueber
// Threadgrenzen, es haelt hier nur durch MSVC-x86-Praxis. atomic<bool> kostet
// nichts und ist tatsaechlich das, was zwischen Leser- und Hauptthread gilt.
std::atomic<bool> g_stdinClosed{false};
// Zeitpunkt (GetTickCount64) von g_stdinClosed=true. Gebraucht, um eine noch
// offene Anmeldung nach EOF nicht ewig abzuwarten - siehe die Pruefung in
// main() weiter unten.
std::atomic<ULONGLONG> g_stdinClosedAtMs{0};
std::atomic<bool> g_quit{false};
// Wird erst wahr, wenn InitSDK tatsaechlich geglueckt ist (sessionInit()
// liefert true). Steuert am Ende von main() den Ausstiegsweg - siehe dort.
std::atomic<bool> g_sdkInitialized{false};

void readStdin() {
  std::string line;
  int c;
  while ((c = std::fgetc(stdin)) != EOF) {
    if (c == '\n') {
      if (!line.empty() && line.back() == '\r') line.pop_back();
      if (!line.empty()) {
        std::lock_guard<std::mutex> lock(g_mutex);
        g_lines.push_back(line);
      }
      line.clear();
      continue;
    }
    line += static_cast<char>(c);
  }
  // Ein Aufrufer ist nicht verpflichtet, mit einem Zeilenende abzuschliessen -
  // node's child_process.spawn() haengt keins an (anders als PowerShells `|`,
  // das eins stillschweigend ergaenzt). Ohne diese Behandlung ginge der
  // letzte Befehl bei EOF spurlos verloren: kein Fehler, keine Meldung, der
  // Befehl war einfach nie da. Ein verschluckter Befehl ist schlimmer als ein
  // abgewiesener - darum dieselbe Behandlung wie bei '\n', nur am Prozessende
  // statt am Zeilenende.
  if (!line.empty() && line.back() == '\r') line.pop_back();
  if (!line.empty()) {
    std::lock_guard<std::mutex> lock(g_mutex);
    g_lines.push_back(line);
  }
  // EOF heisst quit. Stirbt die aufrufende Seite, darf keine verwaiste Bridge
  // in einem fremden Meeting sitzen bleiben. ABER: eine noch offene Anmeldung
  // (sessionAuthPending()) bekommt in main() trotzdem eine kurze Frist - siehe
  // dort. Erst den Zeitstempel setzen, dann das Flag, damit ein Leser von
  // g_stdinClosed==true den Zeitstempel bereits gueltig sieht.
  g_stdinClosedAtMs = GetTickCount64();
  g_stdinClosed = true;
}

bool nextLine(std::string& out) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (g_lines.empty()) return false;
  out = g_lines.front();
  g_lines.pop_front();
  return true;
}

void handle(const std::string& line) {
  const std::string cmd = cmdOf(line);
  if (cmd.empty()) {
    emitRaw("{\"ev\":\"error\",\"where\":\"parse\",\"code\":\"badJson\"}");
    return;
  }
  if (cmd == "init") {
    if (sessionInit()) g_sdkInitialized = true;
    return;
  }
  if (cmd == "quit") {
    g_quit = true;
    return;
  }
  if (cmd == "auth") {
    const std::string jwt = fieldFromJson(line, "jwt");
    if (jwt.empty()) {
      emitRaw("{\"ev\":\"error\",\"where\":\"auth\",\"code\":3}");  // SDKERR_INVALID_PARAMETER
      return;
    }
    sessionAuth(jwt);
    return;
  }
  // join/leave kommen in Task 7.
  emitRaw("{\"ev\":\"error\",\"where\":\"" + cmd + "\",\"code\":1}");  // SDKERR_NO_IMPL
}

}  // namespace

int main() {
  std::thread reader(readStdin);
  reader.detach();

  std::string line;
  while (!g_quit) {
    pumpOnce();
    while (!g_quit && nextLine(line)) handle(line);
    if (g_stdinClosed) {
      bool linesEmpty;
      {
        std::lock_guard<std::mutex> lock(g_mutex);
        linesEmpty = g_lines.empty();
      }
      if (linesEmpty) {
        // ACHTUNG, GEMESSEN: eine offene Anmeldung darf EOF nicht sofort
        // beenden lassen. sessionAuth() antwortet ASYNCHRON ueber
        // onAuthenticationReturn - ohne diese Pruefung bricht der Prozess ab,
        // sobald die Zeile "auth" verarbeitet ist und stdin zugeht, lange
        // bevor die Antwort da ist. Ohne diese Zeilen hat GENAU DAS die
        // {"ev":"auth",...}-Meldung deterministisch verschluckt: 3/3 Laeufen
        // ueber PowerShells Pipe und 5/5 Laeufen ueber Node child_process.spawn.
        //
        // Zehn Sekunden Obergrenze, damit eine tote Verbindung keine verwaiste
        // Bridge fuer immer am Leben haelt - dieselbe Sorge, die EOF ueberhaupt
        // erst als "quit" behandelt (siehe readStdin()). Laeuft die Frist ab,
        // OHNE dass die Antwort kam, wird das GEMELDET statt schweigend
        // aufzugeben - ein Warten, das stumm endet, waere genau der Haenger,
        // den dieses Vorhaben im Stage-0-Spike schon einmal 90 Sekunden lang
        // gesucht hat (ENABLE_CUSTOMIZED_UI_FLAG, siehe session.cpp).
        //
        // ACHTUNG FUER SPAETER: diese Frist deckt bisher NUR "auth" ab. Die
        // Aufgaben 7 bis 9 bringen weitere asynchrone Antworten (Beitritt,
        // Teilnehmerliste, Aufnahme-Erlaubnis) - jede davon braucht dieselbe
        // Pruefung fuer ihr eigenes "wartet noch"-Flag, sonst verschluckt EOF
        // dort denselben Fehler erneut. Die zehn Sekunden sind KEINE
        // allgemeine Wahrheit, nur der fuer "auth" gemessene Wert.
        if (!sessionAuthPending()) break;
        if (GetTickCount64() - g_stdinClosedAtMs >= 10000) {
          emitRaw("{\"ev\":\"error\",\"where\":\"auth\",\"code\":\"timeout\"}");
          break;
        }
      }
    }
    // 10 ms: kurz genug, dass ein Befehl nicht spuerbar liegen bleibt, lang
    // genug, dass die Bridge im Leerlauf keinen Kern verheizt.
    Sleep(10);
  }

  sessionShutdown();
  emitRaw("{\"ev\":\"bye\"}");

  if (!g_sdkInitialized) {
    // ACHTUNG: Wenn InitSDK in diesem Lauf NIE geglueckt ist (Bediener bricht
    // vor "init" ab, stdin schliesst ohne Daten, InitSDK schlaegt fehl), endet
    // der REGULAERE Prozessausstieg mit einem Absturz: gemessen 0xC0000409
    // (3221226505), deterministisch - unabhaengig davon, ob ueberhaupt eine
    // SDK-Funktion aufgerufen wurde. Ursache ist ein DLL_PROCESS_DETACH-
    // Handler in der Zoom-SDK-DLL, der Zustand voraussetzt, den nur InitSDK
    // anlegt; beim regulaeren Prozessende (ExitProcess) wird dieser Handler
    // fuer jede angehaengte DLL aufgerufen und stuerzt hier ab.
    // Gemessen wurden zwei Kandidaten, die diesen Handler umgehen sollen (fuenf
    // Faelle je Kandidat, ueber child_process.spawn ohne angehaengtes
    // Zeilenende - siehe task-5-report.md):
    //   - std::quick_exit(0): laeuft am Ende trotzdem durch ExitProcess - im
    //     Fall "stdin sofort zu, keine Daten" weiterhin exit=3221226505
    //     (0xC0000409), der Absturz blieb bestehen.
    //   - TerminateProcess(): ueberspringt DLL_PROCESS_DETACH fuer ALLE
    //     angehaengten DLLs (dokumentiertes Verhalten) - alle fuenf Faelle
    //     exit=0.
    // Dieser Umweg betrifft NUR den Fall "InitSDK nie geglueckt". Ein Lauf MIT
    // geglueckter Initialisierung nimmt weiterhin den regulaeren `return 0`
    // unten - sonst wuerde ein spaeterer ECHTER Absturz kuenftig
    // stillschweigend als Erfolg gemeldet, und das waere schlimmer als der
    // jetzige Zustand. Die Ausgabe steht vorher vollstaendig: emitRaw()
    // spuelt bereits selbst, das fflush() hier ist zusaetzliche Absicherung.
    std::fflush(stdout);
    TerminateProcess(GetCurrentProcess(), 0);
  }

  return 0;
}

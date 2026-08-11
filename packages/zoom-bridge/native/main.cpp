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
  // in einem fremden Meeting sitzen bleiben.
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
  // auth/join/leave kommen in Task 6 und 7.
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
      std::lock_guard<std::mutex> lock(g_mutex);
      if (g_lines.empty()) break;
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

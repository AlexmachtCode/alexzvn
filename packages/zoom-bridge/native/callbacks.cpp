#include "callbacks.h"
#include "emit.h"
#include "session.h"

void AuthListener::onAuthenticationReturn(AuthResult ret) {
  // Nur die Zahl auf die Rohrleitung - den Namen setzt TypeScript dazu.
  emitRaw("{\"ev\":\"auth\",\"code\":" + std::to_string(static_cast<int>(ret)) + "}");
  // Fuer den Menschen, der die Rohausgabe mitliest, zusaetzlich auf stderr.
  emitLog(std::wstring(L"Anmeldung beantwortet, AuthResult=") + std::to_wstring(static_cast<int>(ret)));
  // Meldet session.cpp, dass die Anmeldung nicht mehr offen ist - siehe
  // sessionAuthPending() in session.h.
  sessionAuthAnswered();
}

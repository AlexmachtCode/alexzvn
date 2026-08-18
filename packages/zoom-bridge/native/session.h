#pragma once
#include <string>
// Muss VOR dem Teilnehmer-Header stehen - dieselbe Uebersetzungsfalle wie in
// callbacks.h: zoom_sdk_def.h setzt HWND unter WIN32 als bereits bekannt
// voraus und typedef't es selbst nur im Nicht-WIN32-Zweig. session.cpp
// bindet session.h VOR seinem eigenen windows.h ein (siehe dort) - dieser
// Header muss darum selbst dafuer sorgen, dass windows.h zuerst steht.
#include <windows.h>
// EIGENE, im Brief nicht erwaehnte Uebersetzungsfalle, GEMESSEN (C3646/C2059/
// C2238 in Zeile 139 von meeting_participants_ctrl_interface.h): dieser
// Header benutzt `AudioType` (IUserInfo::GetAudioJoinType()), deklariert es
// aber nicht selbst und inkludiert auch nicht den Header, der es deklariert.
// Ohne meeting_audio_interface.h VOR dem Teilnehmer-Header ist AudioType an
// dieser Stelle unbekannt, und der Parser verliert danach die Deklaration.
#include "meeting_service_components/meeting_audio_interface.h"
#include "meeting_service_components/meeting_participants_ctrl_interface.h"
// GEMESSEN, KEINE eigene Falle: meeting_participants_ctrl_interface.h bindet
// diesen Header bereits selbst ein, diese Zeile ist die explizite,
// unabhaengige Absicherung fuer diese Uebersetzungseinheit - gebraucht, weil
// dieser Header selbst IMeetingRecordingController* als Rueckgabetyp
// deklariert (recordingCtrl() unten).
#include "meeting_service_components/meeting_recording_interface.h"

USING_ZOOM_SDK_NAMESPACE

/**
 * InitSDK mit den Setzungen der Bridge. Meldet {"ev":"ready",...} bei Erfolg und
 * {"ev":"error","where":"init","code":n} sonst.
 */
bool sessionInit();

/**
 * Abbau in der EINZIG zulaessigen Reihenfolge:
 *   Leave -> pumpen bis ENDED/IDLE oder 5 s -> DestroyMeetingService
 *   -> DestroyAuthService -> CleanUPSDK
 * Ein DestroyMeetingService waehrend CONNECTING hat den Stage-0-Spike mit
 * 0xC0000005 beendet: der Abbau raeumt Zustand weg, an dem der SDK-Thread
 * noch arbeitet.
 *
 * STAND TASK 7: der Ablauf oben ist vollstaendig umgesetzt - sessionLeave()
 * (Leave + pumpen) laeuft VOR DestroyMeetingService, das wiederum vor
 * DestroyAuthService und CleanUPSDK steht. Wird ohne laufendes Meeting bzw.
 * ohne Auth-Dienst gerufen, ueberspringt der jeweilige Schritt sich selbst
 * (g_meeting/g_auth bleiben nullptr, siehe session.cpp).
 *
 * ACHTUNG (Owner-Entscheidung, Abschluss-Sichtung Punkt A): liefert
 * sessionLeave() false (die 5-s-Pumpobergrenze ist abgelaufen, WAEHREND der
 * SDK-Thread nachweislich noch arbeitet), ueberspringt dieser Abbau
 * DestroyMeetingService, DestroyAuthService UND CleanUPSDK - in genau diesem
 * Zustand endete der Prozess in Aufgabe 7 GEMESSEN 5/5 mit 0xC0000005.
 * NACHGERECHNET (Schluss-Pruefung dieser Runde): der Absturz kam auf dem
 * REGULAEREN Ausstiegsweg NACH einem bereits gesendeten "bye", NICHT
 * nachweislich in DestroyMeetingService selbst - das Ueberspringen ist darum
 * eine begruendete Vorsichtsmassnahme, kein fuer sich gemessener Befund. Die
 * SetEvent(nullptr)-Abmeldungen laufen TROTZDEM (siehe die Begruendung in
 * session.cpp), sie zerstoeren nichts.
 * Rueckgabewert: true, wenn der Abbau VOLLSTAENDIG durchgelaufen ist
 * (inklusive der Faelle "kein Meeting"/"kein Auth-Dienst" bzw. "SDK gar
 * nicht hoch"); false, wenn er wegen einer abgelaufenen Leave-Frist
 * VORZEITIG endet. main() darf im false-Fall kein "bye" mehr senden - das
 * waere eine Luege ueber einen sauberen Abgang - und muss stattdessen ueber
 * TerminateProcess mit einem eigenen, von 0 verschiedenen Code beenden
 * (siehe main.cpp).
 */
bool sessionShutdown();

/** Eine Runde Win32-Nachrichten abarbeiten. Ohne sie kommt kein Rueckruf an. */
void pumpOnce();

/**
 * Liest ein flaches ZEICHENKETTEN-Feld aus einer JSON-Zeile. BERICHTIGT
 * (Nachbesserungsrunde 1 zu Task 3): deckt NICHT mehr alle Felder aller
 * Befehle ab - "id" bei videoSubscribe/videoUnsubscribe (Aufgabe 2) ist eine
 * ZAHL, kein String. Fuer ein Zahlenfeld liefert dieser Leser IMMER "" (er
 * prueft im Rumpf ausdruecklich auf ein oeffnendes Anfuehrungszeichen nach
 * dem Doppelpunkt) - dafuer numberFromJson() weiter unten benutzen, nicht
 * diese Funktion. Eine JSON-Bibliothek waere fuer die verbleibenden
 * String-Felder trotzdem teurer als die zwei schlichten Leser und muesste in
 * Stage 4 mit ausgeliefert und lizenzgeprueft werden.
 * Gibt "" zurueck, wenn das Feld fehlt.
 */
std::string fieldFromJson(const std::string& line, const char* key);

/**
 * Liest ein flaches ZAHLEN-Feld aus einer JSON-Zeile. Gegenstueck zu
 * fieldFromJson() oben, das ausdruecklich nur Zeichenketten liest (siehe
 * dort) - "id" bei videoSubscribe/videoUnsubscribe ist eine Zahl.
 * false = Feld fehlt, steht an einer Wert- statt Schluessel-Position, oder
 * traegt etwas anderes als eine reine Ziffernfolge (kein Vorzeichen, kein
 * Exponent, keine Nachkommastellen - das Protokoll kennt an dieser Stelle
 * nur Teilnehmerkennungen) - auch ein Ueberlauf von unsigned long long
 * zaehlt als "nicht auswertbar" und liefert false, nicht eine durch den
 * Ueberlauf verstuemmelte Zahl.
 */
bool numberFromJson(const std::string& line, const char* key, unsigned long long* out);

/**
 * Das Ergebnis von boolFromJson() - DREI Faelle, drei Namen.
 *
 * Vorher waren es drei Faelle hinter EINEM false. Der Kopfsatz unten
 * beschrieb sie bereits, unterscheidbar waren sie nicht - und die einzige
 * Aufrufstelle warf den Rueckgabewert weg. Ein {"audio":"false"} oder
 * {"audio":0} bekam damit stillschweigend Ton AN, und stderr meldete
 * zufrieden "Ton-Schalter fuer 42: an". Das verletzt "Nichts verschwindet
 * still" an genau der Stelle, an der das Nachbarfeld zwei Zeilen darueber
 * (resolution -> videoBadResolution) es vormacht (Schlusspruefung Stage 3,
 * Important 6).
 */
enum class JsonBool {
  /** Kein Schluessel an einer Schluesselposition. Der Aufrufer behaelt seine Vorgabe. */
  Fehlt,
  /** true oder false gelesen - *out traegt den Wert. */
  Gelesen,
  /** Der Schluessel ist da, aber es folgt weder true noch false. NICHT raten. */
  Unlesbar,
};

/**
 * Wahrheitswert-Gegenstueck zu fieldFromJson()/numberFromJson().
 *
 * WARUM ES DAS BRAUCHT: fieldFromJson() liest ausdruecklich nur
 * Zeichenketten, numberFromJson() nur Ziffernfolgen. Ein {"audio":true}
 * faellt durch BEIDE durch - der Schalter waere im nativen Teil unsichtbar,
 * und "audio":false wuerde stillschweigend als "Vorgabe an" gelesen. Genau
 * diese Luecke hat in Stage 2 bei "id" das Merkmal gegen den echten Prozess
 * unbenutzbar gemacht.
 *
 * @param out wird NUR bei JsonBool::Gelesen geschrieben. Der Aufrufer setzt
 *            seine Vorgabe also VOR dem Aufruf und laesst sie stehen, wenn
 *            das Feld fehlt.
 * @returns Fehlt, Gelesen oder Unlesbar - drei Ausgaenge, die der Aufrufer
 *          verschieden beantworten MUSS: eine fehlende Angabe ist eine
 *          Vorgabe, eine unlesbare ist ein Fehler.
 */
JsonBool boolFromJson(const std::string& line, const char* key, bool* out);

/** Der Wert von "cmd", oder "" wenn die Zeile keiner ist. */
std::string cmdOf(const std::string& line);

/**
 * UTF-8 nach UTF-16 (die Gegenrichtung zu jsonEscape() in emit.h). Oeffentlich
 * gemacht (Abschluss-Sichtung Punkt F), damit main.cpp einen unbekannten
 * Befehlsnamen VOR der Ausgabe auf stderr (emitLog(), Klartext fuer Menschen)
 * konvertieren kann, statt ihn unmaskiert in eine JSON-Zeile zu spleissen.
 */
std::wstring toWide(const std::string& utf8);

/**
 * Meldet sich mit dem fertigen JWT an. Das Ergebnis kommt ASYNCHRON ueber
 * onAuthenticationReturn - ohne laufende Nachrichtenschleife nie. Deshalb
 * meldet diese Funktion selbst nichts ausser einem Fehler beim Absetzen.
 * Das JWT wird NIRGENDS ausgegeben.
 */
void sessionAuth(const std::string& jwtUtf8);

/**
 * Ob eine mit sessionAuth() abgesetzte Anmeldung noch auf die asynchrone
 * Antwort wartet. Der Hauptthread braucht das: bei geschlossenem stdin darf
 * ein Lauf nicht abbrechen, waehrend eine Anmeldung noch offen ist - sonst
 * wird die Antwort verschluckt. GEMESSEN: EOF direkt nach "auth" liefert ohne
 * diese Pruefung NIE ein {"ev":"auth",...} - weder ueber PowerShells Pipe
 * (3/3 Laeufen) noch ueber Node child_process.spawn (5/5 Laeufen), jeweils
 * deterministisch.
 */
bool sessionAuthPending();

/** Von AuthListener::onAuthenticationReturn gerufen, sobald die Antwort da ist. */
void sessionAuthAnswered();

/**
 * Beitritt zu einem Meeting per Nummer/Kenncode/Anzeigename. Das Ergebnis
 * kommt ASYNCHRON als Statusfolge ueber MeetingListener::onMeetingStatusChanged
 * (siehe callbacks.cpp) - bei Erfolg des Aufrufs selbst wird hier NICHTS
 * gemeldet. Die Bridge tritt STUMM und OHNE BILD bei: sie sendet nichts,
 * sie hoert nur zu.
 */
void sessionJoin(const std::string& meetingIdUtf8, const std::string& passcodeUtf8, const std::string& displayNameUtf8);

/**
 * Verlassen in der EINZIG zulaessigen Reihenfolge: Leave(), dann bis zu 5 s
 * pumpen, bis der Meeting-Status ENDED/IDLE erreicht - erst danach darf
 * DestroyMeetingService laufen (siehe sessionShutdown()). Ein
 * DestroyMeetingService waehrend CONNECTING hat den Stage-0-Spike mit
 * 0xC0000005 beendet: der Abbau raeumt Zustand weg, an dem der SDK-Thread
 * noch arbeitet. sessionLeave() ist ohne laufendes Meeting (g_meeting ==
 * nullptr) ein no-op.
 *
 * Rueckgabewert (Owner-Entscheidung, Abschluss-Sichtung Punkt A): true, wenn
 * beim Rueckkehren ein RUHENDER Zustand (ENDED/IDLE) erreicht ist - egal ob
 * er schon beim Eintritt vorlag oder erst die Pumpschleife ihn erreicht hat.
 * false, wenn die 5-s-Pumpobergrenze abgelaufen ist, WAEHREND der SDK-Thread
 * noch arbeitet (dieselbe Zeile, die "leaveTimeout" auf stdout meldet).
 * sessionShutdown() braucht das: ein DestroyMeetingService-Aufruf waehrend
 * eines NICHT-ruhenden Zustands ist GENAU die Lage, in der der Prozess in
 * Aufgabe 7 GEMESSEN 5/5 mit 0xC0000005 endete - NACHGERECHNET (Schluss-
 * Pruefung dieser Runde) kam der Absturz auf dem REGULAEREN Ausstiegsweg NACH
 * einem bereits gesendeten "bye", NICHT nachweislich in DestroyMeetingService
 * selbst.
 */
bool sessionLeave();

/**
 * Ob ein mit sessionJoin() erfolgreich abgesetzter Beitritt noch auf die
 * ERSTE asynchrone Statusmeldung wartet (analog sessionAuthPending() - siehe
 * dort). Der Hauptthread braucht das aus demselben Grund: bei geschlossenem
 * stdin darf ein Lauf nicht abbrechen, bevor auch nur EINE Pumprunde eine
 * Rueckmeldung ueber onMeetingStatusChanged bringen konnte - sonst verschwindet
 * der Beitritt spurlos, genau wie es fuer "auth" ohne sessionAuthPending()
 * GEMESSEN wurde. NICHT gemessen (kein echtes Meeting verfuegbar): ob die
 * gleiche 10-s-Frist wie bei "auth" fuer den Beitritt reicht - siehe der
 * Code "joinEofTimeout" in main.cpp.
 */
bool sessionJoinPending();

/**
 * Von MeetingListener::onMeetingStatusChanged gerufen, sobald die erste
 * Statusmeldung eines Beitritts da ist. NICHT dasselbe wie "das Meeting ist
 * jetzt in einem Endzustand" - schon "connecting" zaehlt, denn das genuegt,
 * um sessionJoinPending() aufzuloesen: es ist mindestens EINE Rueckmeldung
 * angekommen, EOF wuerde sie also nicht mehr verschlucken.
 */
void sessionJoinAnswered();

/** Der Teilnehmer-Controller, oder nullptr wenn kein Meeting laeuft. */
IMeetingParticipantsController* participantsCtrl();

/**
 * Name und persistentId zu einer Teilnehmerkennung. false = die Kennung
 * steht nicht (mehr) in der Teilnehmerliste.
 *
 * `persistentId` KANN LEER SEIN - Zoom liefert sie fuer nicht angemeldete
 * Gaeste nicht immer. Wer darauf ein Versprechen baut (Umhaengen nach einem
 * Wiederbeitritt), muss den leeren Fall ausdruecklich behandeln.
 */
bool sessionFindParticipant(unsigned int userId, std::wstring* nameOut, std::string* persistentIdOut);

/** Vollbild der Anwesenden als ein roster-Ereignis. */
void emitRoster();

/**
 * Haelt fest, dass der Teilnehmer-Empfaenger (g_participantsListener, siehe
 * callbacks.cpp) JE auf dem Teilnehmer-Regler registriert wurde. Gebraucht von
 * der Messstelle in sessionShutdown(): liefert participantsCtrl() beim Abbau
 * nullptr, obwohl hier schon einmal registriert wurde, wird das SICHTBAR
 * gemeldet statt die Abmeldung still zu uebergehen - die SDK-Kopfdateien
 * klaeren nicht, ob der Regler-Zeiger nach einem durchlaufenen Leave() noch
 * gueltig bleibt.
 */
void markParticipantsListenerRegistered();

/** Der Aufnahme-Regler, oder nullptr wenn kein Meeting laeuft. */
IMeetingRecordingController* recordingCtrl();

/**
 * Fragt die Rohdaten-Aufnahme-Erlaubnis ab und, wenn noetig, beim Gastgeber
 * an (RequestLocalRecordingPrivilege). Meldet {"ev":"privilege",...} bzw.
 * {"ev":"error","where":"privilege",...}. Diese Funktion ruft
 * StartRawRecording() NICHT - das tut sessionStartRawRecording(), und zwar
 * erst beim ersten videoSubscribe(). Erlaubnis holen und Rohdaten einschalten
 * sind zwei verschiedene Schritte; Stage 1 brauchte nur den ersten.
 *
 * Owner-Entscheidung: "automatisch anfragen, einmal freigeben" - die Bruecke
 * fragt die Erlaubnis SELBST an, sie wartet nicht auf einen externen Befehl.
 * Deshalb gibt es dafuer keinen eigenen "cmd" in main.cpp - der Aufruf steht
 * in MeetingListener::onMeetingStatusChanged (callbacks.cpp), ausgeloest vom
 * Status INMEETING, genau wie emitRoster().
 */
void checkPrivilege();

/**
 * Ob eine mit checkPrivilege() abgesetzte RequestLocalRecordingPrivilege()
 * noch auf die asynchrone Antwort wartet (analog sessionAuthPending()/
 * sessionJoinPending() - siehe dort). Der Hauptthread braucht das aus
 * demselben Grund: bei geschlossenem stdin darf ein Lauf nicht abbrechen,
 * bevor die Antwort ueber onLocalRecordingPrivilegeRequestStatus da ist -
 * sonst verschwindet sie spurlos, genau wie es fuer "auth" ohne
 * sessionAuthPending() GEMESSEN wurde. NICHT GEMESSEN (kein echtes Meeting
 * verfuegbar ohne Owner-Freigabe): ob dieselbe Rennbedingung hier tatsaechlich
 * auftritt - die Anfrage ist aber, wie bei "auth"/"join", ein Gesuch mit
 * asynchroner Antwort ueber genau denselben Mechanismus (SDK-Rueckruf nach
 * einer Pumprunde), darum dieselbe Vorsichtsmassnahme.
 */
bool sessionPrivilegePending();

/** Von RecordingListener::onLocalRecordingPrivilegeRequestStatus gerufen, sobald die Antwort da ist. */
void sessionPrivilegeAnswered();

/**
 * Der ZULETZT gemeldete Stand der Rohdaten-Erlaubnis. Ohne dieses Merkzeichen
 * koennte videoSubscribe() (Task 3) die Voraussetzung "canRecordRaw" gar nicht
 * pruefen - der native Teil MELDET die Erlaubnis an FUENF Stellen
 * (callbacks.cpp: onRecordPrivilegeChanged, die DREI
 * onLocalRecordingPrivilegeRequestStatus-Zweige Granted/Denied/Timeout;
 * session.cpp: checkPrivilege()s Sofortpruefung), merkte sie sich bisher aber
 * nirgends. BERICHTIGT (Abschluss-Sichtung, M1): hier stand "vier Stellen" -
 * der Timeout-Zweig wurde uebersehen und rief diese Funktion nicht.
 */
bool sessionCanRecordRaw();

/**
 * Haelt fest, was gerade ueber die Rohdaten-Erlaubnis gemeldet wurde. Von
 * ALLEN FUENF Melde-Stellen oben zu rufen, jeweils mit GENAU dem Wert, der auf
 * derselben Zeile auch als "canRecordRaw" auf die Rohrleitung geht - zwei
 * Wahrheiten, die auseinanderlaufen koennten, waeren schlimmer als eine.
 *
 * KIPPT IN BEIDE RICHTUNGEN: dieselbe Falle wie bei privilegeTimedOut in
 * Stage 1 - entzieht der Gastgeber die Erlaubnis waehrend des Meetings
 * (onRecordPrivilegeChanged(false)), faellt der Stand hier ausdruecklich
 * wieder auf false zurueck. Ein Merkzeichen, das nur in eine Richtung kippt,
 * wuerde eine Erlaubnis behaupten, die es nicht mehr gibt.
 *
 * NUR FUER MELDE-STELLEN. Das Ende eines Meetings ist keine Meldung ueber die
 * Erlaubnis und laeuft darum ueber sessionClearCanRecordRaw() unten - zwei
 * verschiedene Anlaesse, zwei verschiedene Namen.
 */
void sessionSetCanRecordRaw(bool v);

/**
 * Setzt den Stand der Rohdaten-Erlaubnis zurueck, weil das MEETING vorbei ist
 * (verlassen, beendet, gescheitert) - NICHT, weil jemand etwas ueber die
 * Erlaubnis gemeldet haette (Abschluss-Sichtung, M2).
 *
 * Vorher galt der Stand des alten Meetings im naechsten weiter: ein "ja" ohne
 * Deckung. videoSubscribe() haette danach createRenderer()/subscribe() auf
 * einem Meeting versucht, in dem niemand je etwas erlaubt hat - und im
 * Zweifel auf einem Meeting-Dienst, der gerade abgeraeumt wird. Die sichere
 * Richtung ist "nein": ein zu Unrecht abgewiesenes Abo meldet sich BENANNT
 * (videoNoPrivilege), ein zu Unrecht zugelassenes taeuscht eine Erlaubnis vor.
 *
 * ABSICHTLICH OHNE Ereignis auf der Rohrleitung: keiner der drei "source"-
 * Werte (broadcast/requestAnswer/check) waere wahr - niemand hat gerundfunkt,
 * niemand geantwortet, nichts wurde geprueft -, und einen vierten zu
 * erfinden waere eine Protokollerweiterung fuer eine Tatsache, die bereits
 * auf der Leitung steht: das "status"-Ereignis (ended/failed) bzw. der
 * "leave"-Befehl des Aufrufers selbst. Die TypeScript-Seite behaelt ihren
 * zuletzt GEMELDETEN Wert - sie urteilt, der native Teil meldet.
 */
void sessionClearCanRecordRaw();

/**
 * Legt den Rohdaten-Schalter des SDK um (IMeetingRecordingController::
 * StartRawRecording) und meldet den SDKError zurueck.
 *
 * DER NAME LUEGT, UND DAS HAT ECHTE ZEIT GEKOSTET: "StartRawRecording"
 * schreibt KEINE Datei und startet weder Cloud- noch lokale Aufzeichnung. Es
 * ist der Schalter, der die Rohdaten-Rueckrufe ueberhaupt erst freigibt. Stage
 * 1 hat den Aufruf ausdruecklich vermieden, weil der Name nach Mitschnitt
 * klingt - mit der Folge, dass in Stage 2 JEDES videoSubscribe an
 * createRenderer() scheiterte. GEMESSEN am 2026-08-13 gegen ein echtes
 * Meeting; die Schrittfolge (im Meeting -> Erlaubnis -> StartRawRecording ->
 * Rohdaten ueber die Delegates) stammt woertlich von Zoom.
 *
 * Idempotent: der zweite Aufruf in demselben Meeting meldet SDKERR_SUCCESS,
 * ohne das SDK noch einmal zu behelligen. Gilt je Meeting - siehe
 * sessionClearRawRecording().
 */
/**
 * Zaehlt, wie viele Teilnehmer GENAU diesen Anzeigenamen tragen.
 *
 * Gebraucht fuer das Umhaengen ueber den Namen (videoParticipantJoined):
 * Zooms persistentId traegt einen Wiederbeitritt NICHT (gemessen am
 * 14.08.2026, siehe dort), der Anzeigename ist die einzige verbliebene
 * Handhabe - aber nur, wenn er EINDEUTIG ist. Zwei Gaeste mit demselben Namen
 * auf gut Glueck umzuhaengen waere eine Personenverwechslung auf Sendung.
 *
 * @returns 0, wenn kein Meeting laeuft - "keiner heisst so" ist dann die
 *          richtige Antwort, denn ohne Meeting gibt es keine Teilnehmer.
 */
int sessionCountParticipantsByName(const std::wstring& name);

SDKError sessionStartRawRecording();

/**
 * Setzt den Rohdaten-Schalter zurueck, weil er je MEETING gilt. Gleiche
 * Begruendung und gleiche Aufrufstelle wie sessionClearCanRecordRaw(): ein
 * stehengebliebener Schalter liesse das naechste Meeting glauben, die
 * Rohdaten seien schon frei.
 */
void sessionClearRawRecording();

/**
 * Tritt dem TONKANAL des Meetings bei. Idempotent je Meeting.
 *
 * WARUM DAS NOETIG IST — GEMESSEN am 18.08.2026 gegen ein echtes Meeting:
 * ohne diesen Aufruf antwortet subscribe() des Roh-Ton-Helfers mit
 * SDKERR_NOT_JOIN_AUDIO (32). Zoom trennt "im Meeting sein" und "am Ton des
 * Meetings haengen"; wer nicht am Ton haengt, bekommt auch keine Rohdaten
 * davon. Das BILD hat diese Bedingung nicht — deshalb lief Stage 2 durch,
 * waehrend der Ton am ersten echten Meeting scheiterte.
 *
 * Nimmt dabei zwei Schutzmassnahmen mit, die den Regieraum betreffen und
 * NICHT den Tonempfang: keine lokale Wiedergabe (sonst Rueckkopplung ueber
 * die Raummikrofone) und Stummschaltung unserer selbst (JoinVoip macht uns
 * zum Ton-Teilnehmer, und wir wollen ausschliesslich empfangen). Scheitert
 * eine davon, wird sie auf stderr gemeldet und der Beitritt bleibt stehen.
 *
 * @returns SDKERR_SERVICE_FAILED, wenn es keinen Ton-Regler gibt, sonst das,
 *          was JoinVoip() geliefert hat.
 */
SDKError sessionJoinVoip();

/** Verlaesst den Tonkanal wieder. Tut nichts, wenn wir nie beigetreten sind. */
void sessionLeaveVoip();

#pragma once
#include <string>
// ABWEICHUNG VOM BRIEF-WORTLAUT, GEMESSEN: dieselbe Uebersetzungsfalle wie in
// session.h/callbacks.h - zoom_sdk_def.h setzt HWND unter WIN32 als bereits
// bekannt voraus und typedef't es selbst nur im Nicht-WIN32-Zweig. video.cpp
// bindet video.h als ERSTEN Header ein (siehe dort), dieser Header muss darum
// selbst dafuer sorgen, dass windows.h VOR jedem Zoom-Header steht - ohne
// diese Zeile bricht der Bau mit derselben C3646/C4430/C2872-Kaskade ab, die
// dort bereits dokumentiert ist (hier tatsaechlich reproduziert: `npm run
// rebuild -w @jm/zoom-bridge` scheiterte ohne diese Zeile an genau dieser
// Kaskade in video.cpp).
#include <windows.h>
#include "zoom_sdk.h"
#include "rawdata/rawdata_renderer_interface.h"

USING_ZOOM_SDK_NAMESPACE

/** Wandelt "720p" in ZoomSDKResolution_720P. false = unbekannter Schluessel. */
bool videoParseResolution(const std::string& key, ZoomSDKResolution* out);

/**
 * Abonniert das Video eines Teilnehmers und legt dafuer einen NDI-Sender an.
 * Meldet Erfolg und jeden Fehlschlag SELBST auf stdout - der Aufrufer
 * bekommt keinen Rueckgabewert, den er vergessen koennte.
 *
 * audioOn entscheidet, ob dieses Abo AUCH den Ton des Teilnehmers auf die
 * Quelle legt (Stage 3). Der Schalter steht beim Abonnieren fest - siehe
 * Sub::audioOn in video.cpp fuer die Begruendung (Spec Abschnitt 10: kein
 * nachtraegliches Umschalten).
 */
void videoSubscribe(unsigned int userId, ZoomSDKResolution res, bool audioOn);

/** Baut ein Abo ab. Meldet ebenfalls selbst. */
void videoUnsubscribe(unsigned int userId);

/**
 * Baut ALLE Abos ab. MUSS vor sessionLeave() laufen - ein laufender
 * Renderer haelt eine Referenz auf den Meeting-Dienst.
 */
void videoShutdownAll();

/**
 * Baut alle Abos ab, weil das MEETING zu Ende ist (ENDED/FAILED), und meldet
 * jedes einzeln mit reason:"meetingEnded".
 *
 * EIGENE URSACHE, kein geliehener Name: niemand hat etwas befohlen, als der
 * Gastgeber die Sitzung beendete. GEMESSEN am 2026-08-13 ohne diesen Aufruf:
 * das Abo ueberlebte das Meeting, der Herzschlag schickte weiter Schwarzbilder
 * in eine Quelle ohne Sitzung, und der letzte gemeldete Stand war
 * "black"/"cameraOff" - "jemand hat die Kamera aus" fuer ein beendetes
 * Meeting.
 *
 * Tut nichts, wenn es keine Abos gibt - der Normalfall bei jedem Meeting-Ende
 * ohne Video.
 */
void videoMeetingEnded();

/**
 * Schwarzbild-Herzschlag: von der Hauptschleife alle 10 ms gerufen (siehe
 * main.cpp, direkt nach pumpOnce()). Faellt der Bildstrom eines Abos aus
 * (Kamera aus, Teilnehmer weg, Aussetzer), sendet dieses Abo statt eines
 * eingefrorenen letzten Bildes fortlaufend Schwarz - die NDI-Quelle bleibt
 * bestehen, statt zu verschwinden. Ein verschwindender Sender waere im
 * Livebetrieb die gefaehrlichere Wahl: laege er auf Programm, risse er weg.
 * Der Wechsel wird zusaetzlich als Ereignis gemeldet (state "black"), damit
 * die Regie ihn SIEHT statt ihn zu erraten.
 */
void videoTick();

/**
 * Ein abonnierter Gast verlaesst das Meeting. Das Abo bleibt BESTEHEN - die
 * Quelle darf im Livebetrieb nicht wegbrechen (Spec Abschnitt 3). Der
 * Herzschlag (videoTick()) haelt sie ab jetzt schwarz. Von callbacks.cpp aus
 * onUserLeft gerufen, ZUSAETZLICH zum bestehenden "left"-Ereignis.
 */
void videoParticipantLeft(unsigned int userId);

/**
 * Ein Teilnehmer betritt (oder betritt erneut) das Meeting. Traegt dieselbe
 * persistentId bereits ein anderes, noch bestehendes Abo, wird DIESES Abo auf
 * die neue Kennung umgehaengt statt ein zweites anzulegen - derselbe Sender
 * bleibt bestehen, fuer den Switcher ist nichts passiert. Von callbacks.cpp
 * aus onUserJoin gerufen, NACH dem bestehenden "joined"-Ereignis.
 */
void videoParticipantJoined(unsigned int userId);

---
id: tool-jm-qa
title: "JM Q&A — Wortmeldungen & Saal-Fragen"
category: Tool-Manuals
difficulty: mittel
setupTimeMin: 20
teamSize: "1-2"
tags: [qa, wortmeldung, pressekonferenz, townhall, qr, companion, manual]
relatedTools: [jm-qa, jm-timer, jm-titler]
prerequisites:
  - JM Q&A installiert (über den Launcher)
  - Netz/WLAN für die Saal-Einreichung per QR-Code
  - JM Timer und JM Titler im selben LAN (für die Auto-Kopplung)
equipmentOwner: jm
crewRoles:
  - Moderations-Operator
  - Moderation (Freigabe)
lastReviewed: 2026-06-25
owner: tech@jakobsmedien.com
summary: "Wortmeldungs- und Frage-Queue: der Saal reicht per QR vom Handy ein (Port 7782), per Klick kommt jemand ans Wort — koppelt automatisch Redezeit (Timer) und Bauchbinde (Titler), fernsteuerbar per Companion über Port 8733."
---

## Zutaten

### Voraussetzungen
- JM Q&A (über den Launcher)
- Netz/WLAN, über das die Gäste den QR-Code erreichen
- JM Timer und JM Titler im selben LAN

### Netzwerk & Ports
- Port 7782 (@jm/remote, HTTP): Saal-Einreichung. Gäste scannen den QR und landen auf http://<host-ip>:7782/ — Fragen laufen in die Queue.
- Port 8733 (TCP-Zeilenprotokoll): Steuerport für Bitfocus Companion. mDNS-Name jm-qa-ctl (TXT ctl=1, Auto-Discovery).
- Fern-Befehle: QA NEXT | QA END | QA EXTEND <Sekunden> | QA CLEAR | STATE?. Status-Push: STATE active, waiting, total, live, remote.
- Auto-Kopplung im LAN: „ans Wort holen" startet JM Timer (Redezeit) und blendet via JM Titler die Bauchbinde ein (Befehl TITLER TEXT, vorwärtskompatibel zu älteren Titler-Ständen).

## Schritt-für-Schritt

### Einrichtung
- QR-Einreichung aktivieren (Port 7782) — Erreichbarkeit der Einreich-Seite vom Gäste-WLAN testen
- Moderation/Freigabe einstellen (Filter vor Veröffentlichung)
- Kopplung mit JM Timer (Redezeit) und JM Titler (Name/Funktion) prüfen — beide im selben LAN gestartet
- Optional: Companion auf Port 8733 verbinden (NEXT/END/EXTEND/CLEAR)

### Während
- Eingehende Fragen moderieren und freigeben
- Per Klick (oder QA NEXT) jemanden ans Wort holen — Timer startet, Bauchbinde wird eingeblendet
- Redezeit verlängern mit QA EXTEND 60; Wortbeitrag beenden mit QA END
- Queue abarbeiten; QA CLEAR leert sie bei Bedarf

### Nachbereitung
- Queue/Statistik sichern (falls gewünscht)

## Profi-Tipps
- Den Moderationsschritt aktiv nutzen, um Doppelungen und Unangemessenes zu filtern.
- Titler-Text ist vorwärtskompatibel (TITLER TEXT) — die Kopplung funktioniert auch mit älteren Titler-Ständen.
- Companion-Workflow für die Moderation: QA NEXT (nächste Person + Timer + Bauchbinde) und QA END auf zwei Taster legen — flüssiger als Maus.
- QR groß auf eine Folie/Stage-Display legen, damit der ganze Saal scannen kann.

## Pannenhilfe

| Risiko | Gegenmaßnahme |
| --- | --- |
| QR-Einreichung kommt nicht an | Gäste-WLAN erreicht Port 7782 am Host? http://<host-ip>:7782/ im Browser testen |
| Timer/Titler reagieren nicht | Beide im selben LAN gestartet? mDNS/Firewall prüfen |
| Companion steuert nicht | Port 8733 (jm-qa-ctl) erreichbar? Gemeinsames LAN? |
| Bauchbinde bleibt leer | Titler erreichbar? TITLER TEXT-Kopplung in den Q&A-Einstellungen aktiv? |

## Checklisten

### Einrichtung
- [ ] QR-Einreichung aktiv (Port 7782 erreichbar)
- [ ] Moderation/Freigabe gesetzt
- [ ] Timer und Titler gekoppelt (gleiches LAN)
- [ ] Companion an Port 8733 verbunden (optional)

### Vor Live
- [ ] Testfrage eingereicht und sichtbar
- [ ] Ans-Wort-holen getestet (Timer + Bauchbinde)

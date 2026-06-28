---
id: fehlerbehebung-troubleshooting
title: "SOP — Fehlerbehebung (Troubleshooting)"
category: Best Practices
difficulty: anspruchsvoll
setupTimeMin: 0
teamSize: "—"
tags: [troubleshooting, sop, video, audio]
relatedTools: []
prerequisites: []
equipmentOwner: jm
crewRoles: []
lastReviewed: 2026-06-28
owner: tech@jakobsmedien.com
summary: "Systematische Troubleshooting-SOP für Video, Audio, Licht und Netzwerk im Studio."
---

# SOP – Fehlerbehebung (Troubleshooting)

*Jakobs Medien GmbH – Media Operations*

---

## 1. Zweck der SOP

Diese SOP beschreibt alle standardisierten Schritte zur Fehlerbehebung im
Studiobetrieb.

Sie dient als schnelle Referenz für Operator, Bildtechnik, Audiotechnik und
Lichttechnik.

---

## 2. Allgemeine Grundregeln

- **Ruhe bewahren** – Fehler treten häufig auf, sind meist schnell lösbar.

- **Systematisch vorgehen** – niemals mehrere Dinge gleichzeitig ändern.

- **Dokumentieren** – jeder Fehler wird nach der Produktion eingetragen.

- **Rollback‑Plan nutzen** – immer einen funktionierenden Zustand herstellen
können.

---

## 3. Fehlerkategorien

Diese SOP deckt folgende Bereiche ab:

1. **Video / Bildsignal**

2. **Audio / Ton**

3. **Netzwerk / NDI / Dante**

4. **PTZ‑Kameras**

5. **Unreal Engine / Virtual Production**

6. **Licht / DMX**

7. **TriCaster / Routing / Kumo**

8. **Funkstrecken / Mikrofone**

---

## 4. Fehlerbehebung – Video

### 4.1 Kein Bildsignal

- [ ] SDI‑Kabel prüfen (Sitz, Knick, Locking)

- [ ] Kumo Routing prüfen (Quelle → Ziel)

- [ ] TriCaster Input prüfen (richtiger SDI‑Port) - [ ] Kamera eingeschaltet?

- [ ] Kamera‑Output korrekt (1080i25 / 1080p50)? - [ ] Monitor OUT korrekt geroutet?

### 4.2 Falsches Bild / falsche Quelle

- [ ] Kumo Salvo neu laden („Standard“)

- [ ] TriCaster Input‑Label prüfen

- [ ] Unreal Output prüfen (Decklink

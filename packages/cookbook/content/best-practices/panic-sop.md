---
id: panic-sop
title: "Panic SOP"
category: Best Practices
difficulty: profi
setupTimeMin: 0
teamSize: "—"
tags: [notfall, sop, live, emergency]
relatedTools: []
prerequisites: []
equipmentOwner: jm
crewRoles: []
lastReviewed: 2026-06-28
owner: tech@jakobsmedien.com
summary: "Notfall-SOP für kritische Störungen im laufenden Live-Betrieb mit Sofortmaßnahmen in 0–30 Sekunden."
---

# Emergency SOP – Live-Ausfälle

*Jakobs Medien GmbH – Media Operations*

---

## Zweck

Diese SOP beschreibt die **sofortigen Maßnahmen (0–30 Sekunden)** bei kritischen
Fehlern während einer Live‑Produktion.

Sie dient als Notfallreferenz für alle Operator.

---

## 1. Grundprinzipien (0–5 Sekunden)

- **Ruhe bewahren**

- **Nicht mehrere Dinge gleichzeitig ändern**

- **Backup aktivieren, bevor Fehler gesucht wird** - **Regie sofort informieren**

---

## 2. Kritische Fehler & Sofortmaßnahmen

---

### 2.1 Kein Bild (Black Screen) – *höchste Priorität*
**0–5 Sekunden**

- [ ] Auf Backup‑Quelle schalten (TriCaster: „Backup Cam“ oder „Fallback Input“)
- [ ] Regie informieren

**5–30 Sekunden**

- [ ] Kumo Salvo „Standard“ laden

- [ ] SDI‑Kabel prüfen (Sitz / Locking)
- [ ] TriCaster Input neu zuweisen

- [ ] Kamera neu starten (falls PTZ)

---

### 2.2 Kein Ton – *zweithöchste Priorität*
**0–5 Sekunden**

- [ ] Backup‑Audio aktivieren (SQ‑5: „Backup Mix“)
- [ ] Regie informieren

**5–30 Sekunden**
- [ ] Mikrofon prüfen (Batterie / Mute)
- [ ] Dante Receive 15/16 prüfen
- [ ] SQ‑5 Input aktivieren
- [ ] Fader hoch / Mute aus

---

### 2.3 PTZ Kamera eingefroren / offline
**0–5 Sekunden**
- [ ] Auf andere Kamera schalten
- [ ] Regie informieren

**5–30 Sekunden**
- [ ] PoE++ prüfen
- [ ] PTZ Control Center neu starten
- [ ] Preset neu laden
- [ ] Kamera pingen (192.168.10.20–23)

---

### 2.4 Unreal / Virtual Set ausgefallen

**0–5 Sekunden**

- [ ] Auf Standard‑Kamera schalten

- [ ] Regie informieren

**5–30 Sekunden**

- [ ] Decklink Output neu aktivieren
- [ ] Unreal Szene neu laden
- [ ] Routing zur Kumo prüfen

---

### 2.5 NDI komplett instabil / Ausfall
**0–5 Sekunden**
- [ ] Auf SDI‑Backup‑Signal schalten
- [ ] Regie informieren

**5–30 Sekunden**
- [ ] Switch prüfen
- [ ] NDI‑Quellen deaktivieren
- [ ] VLAN prüfen
- [ ] TriCaster Input neu laden

---

### 2.6 Funkstrecke tot / massives Rauschen
**0–5 Sekunden**
- [ ] Backup‑Mikrofon geben (Handsender)
- [ ] Regie informieren

**5–30 Sekunden**
- [ ] Frequenz wechseln
- [ ] Sender neu koppeln
- [ ] Antennen ausrichten

---

### 2.7 Licht komplett ausgefallen
**0–5 Sekunden**
- [ ] ISO / Gain an Kamera erhöhen
- [ ] Regie informieren
**5–30 Sekunden**
- [ ] QLC+ neu starten
- [ ] ArtNet Node prüfen
- [ ] DMX‑Universen neu laden

---

## 3. Systemweite Notfallmaßnahmen
### 3.1 TriCaster hängt / Freeze
**0–5 Sekunden**
- [ ] Auf Backup‑Quelle schalten
- [ ] Regie informieren
**5–30 Sekunden**
- [ ] TriCaster neu starten
- [ ] Session neu laden
- [ ] Control Surface neu verbinden

---

### 3.2 Kreuzschiene (Kumo) reagiert nicht
**0–5 Sekunden**

- [ ] Backup‑Routing im TriCaster nutzen

- [ ] Regie informieren

- **5–30 Sekunden**

- [ ] Kumo Web‑GUI neu laden

- [ ] Salvo „Standard“ erneut ausführen

- [ ] Gerät neu starten (falls möglich)

---

## 4. Kommunikation (immer)

- [ ] Regie sofort informieren

- [ ] Projektleitung informieren

- [ ] Moderation nur informieren, wenn absolut nötig

- [ ] Keine technischen Details an Gäste kommunizieren

---

## 5. Nach dem Notfall (Post‑Emergency)

- [ ] Fehler dokumentieren

- [ ] Ursache

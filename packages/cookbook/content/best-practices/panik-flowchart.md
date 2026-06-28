---
id: panik-flowchart
title: "Panik-Flowchart"
category: Best Practices
difficulty: profi
setupTimeMin: 0
teamSize: "—"
tags: [notfall, panik, flowchart, live]
relatedTools: []
prerequisites: []
equipmentOwner: jm
crewRoles: []
lastReviewed: 2026-06-28
owner: tech@jakobsmedien.com
summary: "Schneller Notfall-Entscheidungsbaum für akute Störungen im laufenden Betrieb."
---

# Panik Flowchart

# Emergency Flowchart – Live-Ausfälle

*Jakobs Medien GmbH – Media Operations*

```
                     ┌──────────────────────────┐
                     │   PROBLEM IM LIVE-BETRIEB │
                     └──────────────┬───────────┘
                                    │
                                    ▼
                     ┌──────────────────────────┐
                     │   0–5 SEKUNDEN REAKTION   │
                     └──────────────┬───────────┘
                                    │
                                    ▼
                     ┌──────────────────────────┐
                     │ 1. Ruhe bewahren          │
                     │ 2. Backup aktivieren      │
                     │ 3. Regie informieren      │
                     └──────────────┬───────────┘
                                    │
                                    ▼
                 ┌────────────────────────────────────┐
                 │ WELCHER FEHLERTYP TRITT AUF?        │
                 └──────────────┬───────────┬─────────┘
                                │           │
                                │           │
                                ▼           ▼
                 ┌─────────────────┐   ┌─────────────────┐
                 │   KEIN BILD     │   │    KEIN TON      │
                 └───────┬─────────┘   └────────┬────────┘
                         │                      │
                         ▼                      ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │ Backup-Kamera aktivieren     │   │ Backup-Mikrofon aktivieren   │
    │ Kumo-Salvo „Standard“ laden  │   │ SQ-5: Backup-Mix aktivieren  │
    │ SDI prüfen                   │   │ Dante 15/16 prüfen           │
    │ TriCaster Input neu zuweisen │   │ Sender/Mute prüfen           │
    └──────────────────────────────┘   └──────────────────────────────┘
                         │                      │
                         ▼                      ▼
                 ┌─────────────────┐   ┌─────────────────┐
                 │   PTZ AUSFALL   │   │   NDI AUSFALL    │
                 └───────┬─────────┘   └────────┬────────┘
                         │                      │
                         ▼                      ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │ Auf andere Kamera schalten   │   │ Auf SDI-Backup schalten      │
    │ PoE++ prüfen                 │   │ Switch prüfen                │
    │ IP (192.168.10.xx) prüfen    │   │ NDI-Quellen reduzieren       │
    │ PTZ Control Center neu laden │   │ VLAN prüfen                  │
    └──────────────────────────────┘   └──────────────────────────────┘
                         │                      │
                         ▼                      ▼
                 ┌─────────────────┐   ┌─────────────────┐
                 │ UNREAL AUSFALL  │   │ FUNK AUSFALL     │
                 └───────┬─────────┘   └────────┬────────┘
                         │                      │
                         ▼                      ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │ Auf Standard-Kamera schalten │   │ Backup-Handsender geben      │
    │ Decklink Output prüfen       │   │ Frequenz wechseln            │
    │ Szene neu laden              │   │ Sender koppeln               │
    │ Routing zur Kumo prüfen      │   │ Antennen ausrichten          │
    └──────────────────────────────┘   └──────────────────────────────┘
                         │                      │
                         ▼                      ▼
                 ┌────────────────────────────────────┐
                 │  FEHLER INNERHALB 30 SEKUNDEN GELÖST? │
                 └──────────────┬───────────┬──────────┘
                                │           │
                                │           │
                                ▼           ▼
                 ┌─────────────────┐   ┌──────────────────────────────┐
                 │     JA          │   │             NEIN              │
                 └───────┬─────────┘   └────────┬────────────────────┘
                         │                      │
                         ▼                      ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │ Produktion normal fortsetzen │   │ 1. Regie informieren         │
    │ Monitoring weiter aktiv      │   │ 2. Projektleitung informieren│
    │                              │   │ 3. Backup-Signal halten      │
    └──────────────────────────────┘   │ 4. Fehler dokumentieren      │
                                       └──────────────────────────────┘
```

# Versionierung

- Version: 1.0
- Verantwortlich: Media Operations
- Studio: Jakobs Medien GmbH

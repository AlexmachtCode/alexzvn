---
id: notfall-flowchart-unreal
title: "Notfall-Flowchart — Unreal Virtual Production"
category: Best Practices
difficulty: profi
setupTimeMin: 0
teamSize: "—"
tags: [notfall, unreal, virtual-production, flowchart]
relatedTools: []
prerequisites: []
equipmentOwner: jm
crewRoles: []
lastReviewed: 2026-06-28
owner: tech@jakobsmedien.com
summary: "Entscheidungsbaum für Störungen in der Unreal-Virtual-Production-Pipeline."
---

# Unreal / Virtual Production – Emergency Flowchart

```
                     ┌──────────────────────────┐
                     │   UNREAL-PROBLEM IM LIVE  │
                     └──────────────┬───────────┘
                                    │
                                    ▼
                     ┌──────────────────────────┐
                     │ 0–5 SEK: AUF KAMERA GEHEN│
                     │ (Fallback Bild)          │
                     └──────────────┬───────────┘
                                    │
                                    ▼
                 ┌────────────────────────────────────┐
                 │ WELCHER FEHLERTYP?                  │
                 └──────────────┬───────────┬─────────┘
                                │           │
                                ▼           ▼
                 ┌─────────────────┐   ┌─────────────────┐
                 │ KEIN SIGNAL     │   │ TRACKING AUSFALL │
                 └───────┬─────────┘   └────────┬────────┘
                         │                      │
                         ▼                      ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │ Decklink Output prüfen       │   │ UDP-Port prüfen              │
    │ Routing zur Kumo prüfen      │   │ Tracking-Software aktiv?     │
    │ Szene neu laden              │   │ Kamera-ID prüfen             │
    │ Unreal neu starten           │   │ Netzwerk prüfen              │
    └──────────────────────────────┘   └──────────────────────────────┘
                         │                      │
                         ▼                      ▼
                 ┌─────────────────┐
                 │ UNREAL CRASH    │
                 └───────┬─────────┘
                         │
                         ▼
    ┌──────────────────────────────┐
    │ Projekt neu laden            │
    │ GPU-Auslastung prüfen        │
    │ Decklink deaktivieren/aktiv. │
    │ Unreal neu starten           │
    └──────────────────────────────┘
```

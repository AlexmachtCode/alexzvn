---
id: notfall-flowchart-licht
title: "Notfall-Flowchart — Licht Operator"
category: Best Practices
difficulty: profi
setupTimeMin: 0
teamSize: "—"
tags: [notfall, licht, flowchart, live]
relatedTools: []
prerequisites: []
equipmentOwner: jm
crewRoles: []
lastReviewed: 2026-06-28
owner: tech@jakobsmedien.com
summary: "Entscheidungsbaum für den Licht-Operator bei Störungen im Live-Betrieb."
---

# Licht Operator – Emergency Flowchart

```
                     ┌──────────────────────────┐
                     │   LICHT-PROBLEM IM LIVE   │
                     └──────────────┬───────────┘
                                    │
                                    ▼
                     ┌──────────────────────────┐
                     │ 0–5 SEK: KAMERA ISO HOCH │
                     │ (Notfall-Licht)          │
                     └──────────────┬───────────┘
                                    │
                                    ▼
                 ┌────────────────────────────────────┐
                 │ WELCHER FEHLERTYP?                  │
                 └──────────────┬───────────┬─────────┘
                                │           │
                                ▼           ▼
                 ┌─────────────────┐   ┌─────────────────┐
                 │ LICHT AUS       │   │ FALSCHE SZENE    │
                 └───────┬─────────┘   └────────┬────────┘
                         │                      │
                         ▼                      ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │ QLC+ neu starten             │   │ Preset neu laden             │
    │ ArtNet Node prüfen           │   │ Farbtemperatur prüfen        │
    │ DMX-Universen prüfen         │   │ Softbox / Diffusion prüfen   │
    │ Netzwerk prüfen              │   │ Keylight / Fill / Backlight  │
    └──────────────────────────────┘   └──────────────────────────────┘
```

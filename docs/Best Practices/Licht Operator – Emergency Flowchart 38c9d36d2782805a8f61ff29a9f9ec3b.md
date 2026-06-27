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
# JM Production Suite — Dokumentation

Einstieg und Hintergründe rund um die Suite-Integration.

- **[JM Show](jm-show.md)** — eine ganze Produktion auf einen Klick öffnen.
  *Für alle, die Shows anlegen und nutzen.* Format, Show-Editor, was jedes Tool
  beim Öffnen lädt, Beispiel-`.jmshow`, Stolpersteine.
- **[Suite-Auto-Discovery (mDNS)](suite-discovery.md)** — wie sich Quellen im
  LAN automatisch finden (kein IP-Eintippen). *Für Entwicklung & Betriebs-
  Diagnose.* Rollen/Ports, Lebenszyklus, Packaging, offene Punkte.
- **[Suite-Steuerebene & Companion](suite-control-plane.md)** — einheitliches
  Fernsteuer-Protokoll für alle Tools + generisches Bitfocus-Companion-Modul.
  *Für Entwicklung & Show-Control.* Protokoll, Server/Client, Tally-Rückkanal,
  Migrationsweg, Stand.
- **[Verbund: die Suite auf mehreren Rechnern](suite-verbund.md)** — ein
  Launcher ist Master, die anderen Rechner koppeln sich einmal per Code.
  *Für Bediener.* Master einschalten, Rechner koppeln, Netzwerk der Suite,
  feste Adresse über VLAN-Grenzen, Kopfanzeige, Firewall.

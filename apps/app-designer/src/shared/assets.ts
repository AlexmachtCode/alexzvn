/**
 * Asset-Dateinamen normalisieren.
 *
 * Der Name landet in drei Kontexten: als Dateiname im Export-Bundle
 * (`join(assetDir, name)`), als URL-Segment (`assets/<name>`) und als Schlüssel
 * im Vorschau-Speicher. Ein Name wie `../../autostart.bat` würde beim Export aus
 * dem Zielordner ausbrechen — Dokumente können von außen kommen (Vorlage,
 * Kundendatei), also wird hier normalisiert und nicht dem Aufrufer vertraut.
 */
export function sanitizeFileName(raw: string): string {
  // Pfadanteile verwerfen: nur das letzte Segment zählt.
  const base = raw.split(/[/\\]/).pop() ?? '';
  const cleaned = base
    // Alles außer Buchstaben/Ziffern/Punkt/Bindestrich/Unterstrich ersetzen.
    .replace(/[^\w.-]+/g, '_')
    // Führende Punkte verhindern versteckte Dateien und '..'.
    .replace(/^\.+/, '');
  return cleaned || 'asset';
}

/** Eindeutigen Dateinamen innerhalb eines Projekts erzeugen (bild.png → bild-2.png). */
export function uniqueFileName(desired: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const name = sanitizeFileName(desired);
  if (!used.has(name)) return name;

  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 2; i < 10_000; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${stem}-${Date.now()}${ext}`;
}

import { useEffect, useState } from 'react';
import { useEditor } from '../store';

/**
 * Blob-URLs der importierten Medien, für die Editor-Vorschau.
 *
 * Nicht pro Render erzeugen: `URL.createObjectURL` hält den Blob am Leben, bis
 * jemand `revokeObjectURL` ruft. Beim Ziehen eines Bild-Nodes entstünden sonst
 * hunderte Kopien im Speicher.
 *
 * Die Sandbox braucht das nicht — dort kommen Assets über `jmapp://preview/assets/`.
 */
export function useAssetUrls(): Map<string, string> {
  const assets = useEditor((s) => s.assets);
  const [urls, setUrls] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    const map = new Map<string, string>();
    for (const a of assets) {
      const blob = new Blob([a.bytes as BlobPart], a.mime ? { type: a.mime } : undefined);
      map.set(a.id, URL.createObjectURL(blob));
    }
    setUrls(map);
    return () => {
      for (const url of map.values()) URL.revokeObjectURL(url);
    };
  }, [assets]);

  return urls;
}

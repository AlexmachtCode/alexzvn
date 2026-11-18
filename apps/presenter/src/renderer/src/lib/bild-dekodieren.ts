import { istSvg, SVG_MIME, svgRasterGroesse } from '@shared/bildformat';
import { bytesToBlob } from './bytes';

/**
 * #313: EIN Weg vom Bild-Byte zum ImageBitmap – für Folien (`pdf.ts`) und Overlays (`paint.ts`).
 *
 * PNG, JPEG, WebP, GIF, BMP und AVIF erkennt Chromium selbst am Inhalt. SVG nicht: es wird über
 * ein `<img>` mit Typ `image/svg+xml` geladen und in fester Größe gerastert (in 3840×2160
 * eingepasst, `svgRasterGroesse`). In `<img>` führt Chromium keine Skripte eines SVG aus und lädt
 * keine externen Ressourcen nach.
 */
export async function bildDekodieren(bytes: Uint8Array): Promise<ImageBitmap> {
  if (!istSvg(bytes)) return createImageBitmap(bytesToBlob(bytes));
  const { breite, hoehe } = svgRasterGroesse(bytes);
  const url = URL.createObjectURL(bytesToBlob(bytes, SVG_MIME));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await createImageBitmap(img, { resizeWidth: breite, resizeHeight: hoehe, resizeQuality: 'high' });
  } catch {
    throw new Error('SVG konnte nicht gelesen werden.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

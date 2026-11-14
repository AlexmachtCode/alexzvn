// #303: Die Ansicht des versteckten NDI-Fensters (`?view=ndi`) – ohne React, ohne DOM-Element im Fenster.
// Sie zeichnet das Publikumsbild ein zweites Mal auf ein FESTES 1920×1080-Canvas (nie in Fenstergröße: das Fenster
// ist samt Rahmen 1920×1080 groß) und schickt es als BGRA über den Bild-Port an den Utility-Prozess. Gezeichnet wird
// nur bei Änderungen und während einer Überblendung im 40-ms-Takt – mit setTimeout, nie requestAnimationFrame
// (verstecktes Fenster). Das Standbild wiederholt der Utility-Prozess selbst.
// Welche Folie, welche Pause, welcher Übergang: dieselben Entscheidungen wie die Publikumsansicht (shared/publikumsbild).
import type { PresentationPayload, PresentationState, Slide, Wiedergabe } from '@shared/types';
import type { AnSender } from '@shared/ndi';
import type { Rechteck } from '@shared/ndi-bild';
import { aktuelleFolie, bildArt, naechsteSchicht, MAX_ALTE_SCHICHTEN } from '../../../shared/publikumsbild';
import { einpassen, ndiFuellung, rgbaZuBgra, zeichenplan } from '../../../shared/ndi-bild';
import { NDI_BREITE, NDI_HOEHE, NDI_TAKT_MS } from '../../../shared/ndi';
import { normiereWiedergabe } from '../../../shared/wiedergabe';
import { clearAssets, putImage, putSource } from '@/lib/assets';
import { clearPdfCaches, renderBase } from '@/lib/pdf';
import { clearOverlayBitmaps, ensureOverlayBitmaps, paintSlide } from '@/lib/paint';

/** Eine gestapelte Folie (unten → oben). Die oberste ist die aktuelle; darunter bleibt die alte, bis sie verdeckt ist. */
interface Schicht {
  key: number;
  slide: Slide;
  /** 0 = Schnitt. */
  blendeMs: number;
  /** Gemalt seit (performance.now); null = wird noch zusammengesetzt. */
  bereitAbMs: number | null;
  /** Fertig gemalte Folie in Rechteckgröße, als reines Speicherbild (siehe zusammensetzen); null = nicht malbar. */
  bild: ImageBitmap | null;
  rechteck: Rechteck | null;
}

const LEER: PresentationState = { active: false, index: 0, total: 0, screen: 'live' };

let slides: Slide[] | null = null;
let wiedergabe: Wiedergabe = normiereWiedergabe(undefined);
let state: PresentationState = LEER;
let schichten: Schicht[] = [];
let port: MessagePort | null = null;
let zaehler = 0;
let takt: ReturnType<typeof setTimeout> | null = null;
let ctx: CanvasRenderingContext2D | null = null;
const gemeldet = new Set<string>();

/** Jede Art Fehler nur einmal ins Log – der Takt läuft weiter. */
function meldeEinmal(was: string, err: unknown): void {
  if (gemeldet.has(was)) return;
  gemeldet.add(was);
  console.error(`[ndi] ${was}:`, err);
}

/** Neuer Schichtenstapel; die Bilder verdrängter Schichten gleich freigeben (je Schicht bis zu 8 MB). */
function setzeSchichten(neu: Schicht[]): void {
  for (const s of schichten) if (!neu.includes(s)) s.bild?.close();
  schichten = neu;
}

/** Neue Präsentation (oder keine): alles Alte verwerfen; die erste Folie kommt dann ohne Übergang. */
function payloadSetzen(p: PresentationPayload | null): void {
  clearPdfCaches();
  clearAssets();
  clearOverlayBitmaps();
  setzeSchichten([]);
  slides = null;
  wiedergabe = normiereWiedergabe(p?.wiedergabe);
  if (!p) return;
  for (const [id, s] of Object.entries(p.sources)) putSource(id, s.kind, s.bytes);
  for (const [id, b] of Object.entries(p.images)) putImage(id, b);
  slides = p.slides;
}

/** Nach jeder Änderung: neue Folie oben auflegen (dieselben drei Fälle wie AudienceView), dann zeichnen. */
function aktualisieren(): void {
  const e = naechsteSchicht(schichten[schichten.length - 1]?.slide.id ?? null, aktuelleFolie(state, slides), wiedergabe);
  if (e.art === 'leeren') {
    setzeSchichten([]);
  } else if (e.art === 'neu') {
    zaehler += 1;
    const s: Schicht = { key: zaehler, slide: e.slide, blendeMs: e.blendeMs, bereitAbMs: null, bild: null, rechteck: null };
    setzeSchichten([...schichten.slice(-MAX_ALTE_SCHICHTEN), s]);
    void zusammensetzen(s);
  }
  zeichnen();
}

const SCHRIFTEN = ['500 48px "Manrope Variable"', '700 48px "Manrope Variable"'];
let grundschrift: Promise<unknown> | null = null;

/**
 * Das versteckte Fenster zeigt keinen Text, der die Schrift sonst lädt: einmal vorab ausdrücklich laden. Braucht eine
 * Folie Teilschnitte jenseits von Latin (etwa ş, ğ, ł), lädt sie die nach – geprüft wird synchron per `check`, denn
 * `load` kostet gemessen je Aufruf 30–50 ms, auch wenn alles schon geladen ist.
 */
async function schriftenLaden(slide: Slide): Promise<void> {
  try {
    grundschrift ??= Promise.all(SCHRIFTEN.map((f) => document.fonts.load(f)));
    await grundschrift;
    const texte = slide.overlays.map((o) => (o.kind === 'text' ? (o.text ?? '') : '')).join('');
    const fehlen = texte ? SCHRIFTEN.filter((f) => !document.fonts.check(f, texte)) : [];
    if (fehlen.length) await Promise.all(fehlen.map((f) => document.fonts.load(f, texte)));
  } catch {
    // Lieber mit Ersatzschrift als gar nicht.
  }
}

/**
 * Folie samt Overlays einmal in Rechteckgröße malen, damit je Takt nur noch 1:1 kopiert wird.
 * Das Ergebnis wird EINMAL ausgelesen und als Bitmap aus ImageData gehalten. Gemessen (Chrome-Trace): Malt man ein
 * Bild von der Grafikkarte (die Seite aus renderBase) in ein Canvas, zieht Chrome auch ein `willReadFrequently`-Canvas
 * auf die Grafikkarte um – und das steckt über Schicht-Canvas und -Bitmap das NDI-Canvas an. Dann ist jedes
 * getImageData ein Rücklesen von der Grafikkarte, das während einer Blende im Publikumsfenster 60–130 ms wartet
 * (Blende kam als 5 Stufen statt 25). Ein Bitmap aus ImageData lässt das NDI-Canvas im Speicher: kein Rücklesen.
 */
async function zusammensetzen(s: Schicht): Promise<void> {
  try {
    await schriftenLaden(s.slide);
    const base = await renderBase(s.slide.sourceId, s.slide.pageIndex, NDI_BREITE);
    await ensureOverlayBitmaps([s.slide]);
    const r = einpassen(base.width, base.height);
    const leinwand = document.createElement('canvas');
    leinwand.width = r.w;
    leinwand.height = r.h;
    const c = leinwand.getContext('2d', { willReadFrequently: true });
    if (!c) throw new Error('kein 2D-Kontext');
    paintSlide(c, base.canvas, s.slide, r.w, r.h);
    s.bild = await createImageBitmap(c.getImageData(0, 0, r.w, r.h));
    s.rechteck = r;
  } catch (err) {
    // Wie SlideCanvas: ein Fehler hält den Wechsel nicht fest – die Schicht gilt als gemalt, nur ohne Bild.
    s.bild = null;
    s.rechteck = null;
    meldeEinmal('Folie nicht gemalt', err);
  }
  if (!schichten.includes(s)) {
    s.bild?.close(); // inzwischen verdrängt (neue Präsentation, schnell weitergeklickt)
    return;
  }
  s.bereitAbMs = performance.now();
  zeichnen();
}

/**
 * Ganzes NDI-Bild neu zeichnen und senden. In dieses Canvas kommen nur Speicherbilder (siehe zusammensetzen).
 * Läuft eine Überblendung, genau ein Folgetakt – gerechnet ab dem Beginn dieses Laufs: ein Lauf kostet während einer
 * Blende gemessen 35–65 ms (Auslesen, BGRA, Kopie in den Port); mit festen 40 ms danach käme nur alle 80–100 ms ein
 * neues Bild, so sind es um 50 ms.
 */
function zeichnen(): void {
  const beginn = performance.now();
  if (takt !== null) {
    clearTimeout(takt);
    takt = null;
  }
  const k = ctx;
  if (!k) return;
  let weiter = false;
  try {
    // Gestoppt bleibt transparent, auch wenn aktuelleFolie noch eine Folie nennt (Bildschirm-Verhalten unverändert).
    const fuellung = ndiFuellung(bildArt(state, aktuelleFolie(state, slides)));
    k.clearRect(0, 0, NDI_BREITE, NDI_HOEHE);
    if (fuellung === 'weiss') {
      k.fillStyle = '#ffffff';
      k.fillRect(0, 0, NDI_BREITE, NDI_HOEHE);
    } else if (fuellung === 'schichten') {
      const plan = zeichenplan(schichten, performance.now());
      weiter = plan.blendeLaeuft;
      // Alles unter der deckenden Schicht ist verdeckt → weg damit (vor dem Malen: ein Wurf dort hält nichts fest).
      const i = schichten.findIndex((s) => s.key === plan.deckendAb);
      if (i > 0) setzeSchichten(schichten.slice(i));
      for (const e of plan.zeichnen) {
        const s = schichten.find((x) => x.key === e.key);
        if (!s?.bild || !s.rechteck) continue;
        k.globalAlpha = e.alpha;
        k.drawImage(s.bild, s.rechteck.x, s.rechteck.y);
      }
      k.globalAlpha = 1;
    }
    senden(k);
  } catch (err) {
    k.globalAlpha = 1;
    meldeEinmal('Zeichnen fehlgeschlagen', err);
  }
  if (weiter) takt = setTimeout(zeichnen, Math.max(0, NDI_TAKT_MS - (performance.now() - beginn)));
}

function senden(k: CanvasRenderingContext2D): void {
  if (!port) return;
  const img = k.getImageData(0, 0, NDI_BREITE, NDI_HOEHE);
  rgbaZuBgra(img.data);
  // Ohne Transferliste: der Buffer wird kopiert (ein transferierter käme hinter dem Main als null an).
  port.postMessage({ type: 'bild', buffer: img.data.buffer as ArrayBuffer } satisfies AnSender);
}

/** Neuer Bild-Port (erster, Sender-Neustart, Ersatzfenster): umstecken und sofort das aktuelle Bild senden. */
function portAnnehmen(e: MessageEvent): void {
  if (e.data !== 'jmpr:ndi-port' || !e.ports?.[0]) return;
  port?.close();
  port = e.ports[0];
  port.start();
  // Ein frisch gestarteter Sender bleibt transparent, bis er ein Bild bekommt – gezeichnet wird sonst nur bei Änderungen.
  zeichnen();
}

export function starteNdiAnsicht(): void {
  const bild = document.createElement('canvas');
  bild.width = NDI_BREITE;
  bild.height = NDI_HOEHE;
  ctx = bild.getContext('2d', { willReadFrequently: true });
  if (!ctx) meldeEinmal('NDI-Bild', new Error('kein 2D-Kontext – es wird nichts gesendet'));
  window.addEventListener('message', portAnnehmen);

  // ERST abonnieren, DANN holen: so geht keine Lieferung dazwischen verloren. Kam eine Lieferung vor der Antwort,
  // ist sie mindestens so neu wie diese – die geholte fällt dann weg.
  let payloadGeliefert = false;
  let stateGeliefert = false;
  window.jmpr.ndi.onPayload((p) => {
    payloadGeliefert = true;
    payloadSetzen(p);
    aktualisieren();
  });
  window.jmpr.present.onState((s) => {
    stateGeliefert = true;
    state = s;
    aktualisieren();
  });
  void (async () => {
    try {
      const [p, s] = await Promise.all([window.jmpr.present.getPayload(), window.jmpr.present.getState()]);
      // Folien und Zustand im selben Schritt (wie usePresentation): sonst käme erst Folie 1 und dann die Startfolie.
      if (!payloadGeliefert) payloadSetzen(p);
      if (!stateGeliefert) state = s;
      aktualisieren();
    } catch (err) {
      meldeEinmal('Präsentation nicht geholt', err);
    }
    // Erst jetzt den Bild-Port anfordern: das erste Bild darauf zeigt schon die laufende Folie.
    window.jmpr.ndi.fensterBereit();
  })();
}

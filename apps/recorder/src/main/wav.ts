import { closeSync, openSync, writeSync } from 'node:fs';
import path from 'node:path';

/**
 * Größte data-Länge je Datei. Der Kopf speichert `36 + data` als vorzeichenlose 32-Bit-Zahl;
 * darüber warf `writeUInt32LE` beim Stopp (#291: bei 8 Kanälen nach ~47 Minuten). 64 KiB Abstand
 * zu 4 GiB halten die Datei (44 Byte Kopf + data) auch unter der FAT32-Grenze (USB-Sticks).
 */
export const MAX_DATA_BYTES = 0xffff0000;

/** `Name.wav` → `Name_002.wav` für n = 2, 3 …; n = 1 ist die Datei selbst. */
export function folgeDatei(filePath: string, n: number): string {
  if (n <= 1) return filePath;
  const ext = path.extname(filePath);
  return `${filePath.slice(0, filePath.length - ext.length)}_${String(n).padStart(3, '0')}${ext}`;
}

/**
 * Schlanker WAV-Writer (32-bit float, IEEE, mehrkanalig, interleaved). Verlustfrei
 * — die Audio-Frames sind bereits float. Öffnet in Reaper/Audacity. fd-basiert,
 * damit der Header am Ende mit den echten Größen gepatcht werden kann.
 *
 * Standard-WAV (32-bit-Größenfelder): Erreicht eine Datei `maxDataBytes`, wird ihr Kopf
 * geschrieben, sie geschlossen und eine Folgedatei begonnen (`folgeDatei`). Jede Datei ist
 * eine vollständige WAV, die jedes Programm liest; geteilt wird nur an Frame-Grenzen.
 */
export class WavWriter {
  private fd: number;
  /** data-Bytes der gerade offenen Datei. */
  private segBytes = 0;
  /** data-Bytes über alle Dateien. */
  private totalBytes = 0;
  private readonly maxSegBytes: number;
  private readonly blockAlign: number;
  private readonly files: string[];
  readonly channels: number;
  readonly sampleRate: number;

  constructor(filePath: string, channels: number, sampleRate: number, maxDataBytes = MAX_DATA_BYTES) {
    this.channels = channels;
    this.sampleRate = sampleRate;
    this.blockAlign = channels * 4;
    this.maxSegBytes = Math.floor(maxDataBytes / this.blockAlign) * this.blockAlign;
    if (this.maxSegBytes <= 0) throw new Error('WAV-Grenze kleiner als ein Frame.');
    this.files = [filePath];
    this.fd = this.oeffne(filePath);
  }

  /** planar [ch0:frames][ch1:frames]… → interleaved float32 LE anhängen. */
  writeBlock(planar: Float32Array, channels: number, frames: number): void {
    const buf = Buffer.allocUnsafe(channels * frames * 4);
    let o = 0;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < channels; c++) {
        buf.writeFloatLE(planar[c * frames + i], o);
        o += 4;
      }
    }
    let off = 0;
    while (off < buf.length) {
      // Erst wechseln, wenn wirklich weitere Daten kommen: genau an der Grenze bleibt keine leere Folgedatei.
      if (this.segBytes >= this.maxSegBytes) this.naechsteDatei();
      const n = Math.min(buf.length - off, this.maxSegBytes - this.segBytes);
      let geschrieben = 0;
      while (geschrieben < n) geschrieben += writeSync(this.fd, buf, off + geschrieben, n - geschrieben);
      off += n;
      this.segBytes += n;
      this.totalBytes += n;
    }
  }

  /** Header mit echten Größen überschreiben + Datei schließen. */
  finalize(): { bytes: number; durationSec: number; files: string[] } {
    this.schliesse();
    const frames = this.totalBytes / this.blockAlign;
    return {
      bytes: this.totalBytes + 44 * this.files.length,
      durationSec: this.sampleRate ? frames / this.sampleRate : 0,
      files: [...this.files],
    };
  }

  private oeffne(p: string): number {
    const fd = openSync(p, 'w');
    writeSync(fd, this.header(0)); // Platzhalter-Header
    return fd;
  }

  private schliesse(): void {
    const header = this.header(this.segBytes);
    writeSync(this.fd, header, 0, header.length, 0); // an Offset 0
    closeSync(this.fd);
  }

  private naechsteDatei(): void {
    this.schliesse();
    const p = folgeDatei(this.files[0], this.files.length + 1);
    this.files.push(p);
    this.fd = this.oeffne(p);
    this.segBytes = 0;
  }

  private header(dataBytes: number): Buffer {
    const ch = this.channels;
    const sr = this.sampleRate;
    const blockAlign = ch * 4;
    const b = Buffer.alloc(44);
    b.write('RIFF', 0, 'ascii');
    b.writeUInt32LE(36 + dataBytes, 4);
    b.write('WAVE', 8, 'ascii');
    b.write('fmt ', 12, 'ascii');
    b.writeUInt32LE(16, 16); // fmt-Chunk-Größe
    b.writeUInt16LE(3, 20); // audioFormat 3 = IEEE float
    b.writeUInt16LE(ch, 22);
    b.writeUInt32LE(sr, 24);
    b.writeUInt32LE(sr * blockAlign, 28); // byteRate
    b.writeUInt16LE(blockAlign, 32);
    b.writeUInt16LE(32, 34); // bits per sample
    b.write('data', 36, 'ascii');
    b.writeUInt32LE(dataBytes, 40);
    return b;
  }
}

/**
 * Schreibt zusätzlich jede Spur als eigene Mono-WAV in einen Ordner (Issue #20).
 * Demultiplext die planaren Frames ([ch0:frames][ch1:frames]…) auf je einen
 * WavWriter pro Kanal — parallel zur kombinierten Mehrkanal-Datei. Jede Spur teilt
 * an derselben Grenze in eigene Folgedateien (`Name-Spur01_002.wav`).
 */
export class MultiWavWriter {
  private readonly writers: WavWriter[];

  constructor(dir: string, baseName: string, channels: number, sampleRate: number, maxDataBytes = MAX_DATA_BYTES) {
    this.writers = Array.from(
      { length: channels },
      (_, c) =>
        new WavWriter(
          path.join(dir, `${baseName}-Spur${String(c + 1).padStart(2, '0')}.wav`),
          1,
          sampleRate,
          maxDataBytes,
        ),
    );
  }

  writeBlock(planar: Float32Array, channels: number, frames: number): void {
    const n = Math.min(channels, this.writers.length);
    for (let c = 0; c < n; c++) {
      // Mono-Slice des Kanals als 1-Kanal-Block schreiben.
      const mono = planar.subarray(c * frames, c * frames + frames);
      this.writers[c].writeBlock(mono, 1, frames);
    }
  }

  /** Alle Spuren best-effort finalisieren (eine kaputte Spur bricht nicht alle ab). */
  finalize(): void {
    for (const w of this.writers) {
      try {
        w.finalize();
      } catch {
        // ignore
      }
    }
  }
}

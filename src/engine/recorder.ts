/** PNG frame export + MediaRecorder WebM capture. */

export function savePNG(canvas: HTMLCanvasElement, name: string): void {
  // must be called synchronously after a render (preserveDrawingBuffer: false)
  canvas.toBlob((blob) => {
    if (!blob) return;
    download(blob, `${name}.png`);
  }, 'image/png');
}

// WebM first (Chrome/Firefox/desktop), then MP4/H.264 (Safari & iOS have no WebM)
const MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4;codecs=h264',
  'video/mp4',
];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

export class WebMRecorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  /** Whether canvas recording works in this browser (used to hide the button). */
  static supported(): boolean {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement !== 'undefined' &&
      'captureStream' in HTMLCanvasElement.prototype &&
      pickMime() !== undefined
    );
  }

  get recording(): boolean {
    return this.rec !== null && this.rec.state === 'recording';
  }

  start(canvas: HTMLCanvasElement, name: string, maxSeconds = 30): void {
    if (this.recording) return;
    const mime = pickMime();
    if (!mime) return;
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    const stream = canvas.captureStream(60);
    this.chunks = [];
    this.rec = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 12_000_000,
    });
    this.rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.rec.onstop = () => {
      download(new Blob(this.chunks, { type: mime }), `${name}.${ext}`);
      this.rec = null;
    };
    this.rec.start(250);
    setTimeout(() => this.stop(), maxSeconds * 1000);
  }

  stop(): void {
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
  }
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

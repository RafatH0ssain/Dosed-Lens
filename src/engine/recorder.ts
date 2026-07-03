/** PNG frame export + MediaRecorder WebM capture. */

export function savePNG(canvas: HTMLCanvasElement, name: string): void {
  // must be called synchronously after a render (preserveDrawingBuffer: false)
  canvas.toBlob((blob) => {
    if (!blob) return;
    download(blob, `${name}.png`);
  }, 'image/png');
}

export class WebMRecorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  get recording(): boolean {
    return this.rec !== null && this.rec.state === 'recording';
  }

  start(canvas: HTMLCanvasElement, name: string, maxSeconds = 30): void {
    if (this.recording) return;
    const stream = canvas.captureStream(60);
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(
      (m) => MediaRecorder.isTypeSupported(m),
    );
    this.chunks = [];
    this.rec = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 12_000_000,
    });
    this.rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.rec.onstop = () => {
      download(new Blob(this.chunks, { type: 'video/webm' }), `${name}.webm`);
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

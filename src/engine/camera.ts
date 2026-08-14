/** Webcam capture — getUserMedia into a hidden <video>, for the live source.
    Frames never leave the device; the same privacy guarantee as file loads. */

export type CameraErrorKind = 'denied' | 'notfound' | 'inuse' | 'insecure' | 'unknown';

export class CameraError extends Error {
  constructor(readonly kind: CameraErrorKind, message: string) {
    super(message);
    this.name = 'CameraError';
  }
}

const MESSAGES: Record<CameraErrorKind, string> = {
  denied: 'Camera access was denied. Allow it in your browser to use the webcam.',
  notfound: 'No camera was found on this device.',
  inuse: 'The camera is in use by another application.',
  insecure: 'The webcam needs a secure context (https or localhost).',
  unknown: 'Could not start the camera.',
};

export type Facing = 'user' | 'environment';

/** Capture ceiling. The pipeline resamples to the canvas anyway, so pixels
    above this buy nothing visible and cost CPU on every live frame. 30 fps is
    the source refresh only — rendering stays at the display's rAF rate, and
    the effects are time-driven in the shader, so motion stays smooth. */
const CAPTURE_W = 1280;
const CAPTURE_H = 720;
const CAPTURE_FPS = 30;

export class Camera {
  private stream: MediaStream | null = null;
  facing: Facing = 'user';
  readonly video: HTMLVideoElement;

  constructor() {
    const v = document.createElement('video');
    v.playsInline = true;
    v.muted = true;
    v.setAttribute('aria-hidden', 'true');
    this.video = v;
  }

  get active(): boolean {
    return this.stream !== null;
  }

  /** True once the video has real dimensions and a decodable frame. */
  get ready(): boolean {
    return this.active && this.video.readyState >= 2 && this.video.videoWidth > 0;
  }

  /** What the camera actually delivered (may differ from the constraints). */
  get settings(): MediaTrackSettings | null {
    const t = this.stream?.getVideoTracks()[0];
    return t ? t.getSettings() : null;
  }

  get width(): number {
    return this.video.videoWidth;
  }
  get height(): number {
    return this.video.videoHeight;
  }

  async start(facing: Facing = this.facing): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CameraError('insecure', MESSAGES.insecure);
    }
    this.stop();
    // `ideal` (not `exact`) on facingMode so a device without a back camera
    // still resolves. width/height/frameRate carry a hard `max` as well: with
    // `ideal` alone a capable camera (any modern Mac) hands back 1080p or
    // more, and every CPU-touching stage downstream — the per-frame texture
    // upload, the conditioning pass, the analyzeImage readback — is sized by
    // those pixels. `crop-and-scale` lets the browser downscale a sensor mode
    // to meet the cap instead of overshooting it.
    // resizeMode is Chrome-only and absent from lib.dom's MediaTrackConstraints;
    // unknown constraint names are ignored, so it is safe to pass everywhere.
    const video: MediaTrackConstraints & { resizeMode?: string } = {
      facingMode: { ideal: facing },
      width: { ideal: CAPTURE_W, max: CAPTURE_W },
      height: { ideal: CAPTURE_H, max: CAPTURE_H },
      frameRate: { ideal: CAPTURE_FPS, max: CAPTURE_FPS },
      resizeMode: 'crop-and-scale',
    };
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (e) {
      throw toCameraError(e);
    }
    this.facing = facing;
    this.stream = stream;
    this.video.srcObject = stream;
    await this.video.play().catch(() => {}); // autoplay policy: muted video is fine
    // resolve only once the first frame is decodable, so callers can size the texture
    await waitReady(this.video);
  }

  /** Switch between the front and back camera (restarts the stream). */
  async flip(): Promise<void> {
    await this.start(this.facing === 'user' ? 'environment' : 'user');
  }

  /** Number of video input devices (used to decide whether flipping is possible). */
  static async count(): Promise<number> {
    if (!navigator.mediaDevices?.enumerateDevices) return 0;
    try {
      const d = await navigator.mediaDevices.enumerateDevices();
      return d.filter((x) => x.kind === 'videoinput').length;
    } catch {
      return 0;
    }
  }

  stop(): void {
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
      this.stream = null;
    }
    this.video.srcObject = null;
  }
}

function waitReady(v: HTMLVideoElement): Promise<void> {
  if (v.readyState >= 2 && v.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      if (v.videoWidth > 0) {
        v.removeEventListener('loadeddata', done);
        resolve();
      }
    };
    v.addEventListener('loadeddata', done);
  });
}

function toCameraError(e: unknown): CameraError {
  const name = e instanceof DOMException ? e.name : '';
  const kind: CameraErrorKind =
    name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
    : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'notfound'
    : name === 'NotReadableError' || name === 'AbortError' ? 'inuse'
    : 'unknown';
  return new CameraError(kind, MESSAGES[kind]);
}

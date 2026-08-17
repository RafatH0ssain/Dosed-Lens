/** Extract 4 dominant colors + brightest-region position from an image
    (dominants seed the DMT breakthrough palette; brightest point anchors
    psilocybin's water ripple).

    On a live source this runs several times a second, so the sampling stage
    is deliberately frugal: one shared canvas, one drawImage, one getImageData
    per call. The drawImage is the expensive half — pulling a webcam frame into
    CPU-readable memory forces a readback and a colour-space conversion of the
    *whole* frame, however small the destination is. */

export interface ImageStats {
  colors: Float32Array; // 4 × RGBA
  bright: Float32Array; // uv of brightest region, y up
  /** 24×24 luminance grid (0..1), row 0 = top — dark-region particle spawns */
  lumGrid: Float32Array;
  lumGridSize: number;
}

const N = 24;

// One canvas for the lifetime of the page. Allocating a fresh one per call
// (and per call *twice*) churned GPU-backed surfaces at the sample rate.
let sampleCtx: CanvasRenderingContext2D | null = null;

function sampleCanvas(): CanvasRenderingContext2D {
  if (!sampleCtx) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    sampleCtx = cv.getContext('2d', { willReadFrequently: true })!;
  }
  return sampleCtx;
}

/** Downscale the source to N×N and read it back. The one costly step. */
function samplePixels(img: CanvasImageSource): Uint8ClampedArray {
  const g = sampleCanvas();
  g.drawImage(img, 0, 0, N, N);
  return g.getImageData(0, 0, N, N).data;
}

export function analyzeImage(img: TexImageSource & CanvasImageSource): ImageStats {
  const px = samplePixels(img);
  let bi = 0;
  let bl = -1;
  const lumGrid = new Float32Array(N * N);
  for (let p = 0; p < N * N; p++) {
    // 3×3 box luminance would be nicer; single texel is fine at 24×24
    const l = px[p * 4] * 0.2126 + px[p * 4 + 1] * 0.7152 + px[p * 4 + 2] * 0.0722;
    lumGrid[p] = l / 255;
    if (l > bl) { bl = l; bi = p; }
  }
  const bright = new Float32Array([
    ((bi % N) + 0.5) / N,
    1 - (Math.floor(bi / N) + 0.5) / N, // GL uv, y up
  ]);
  // same pixels feed the palette — no second draw/readback of the frame
  return { colors: paletteFromPixels(px), bright, lumGrid, lumGridSize: N };
}

/** k-means, k=4, few iterations — plenty for palette seeding. */
function paletteFromPixels(px: Uint8ClampedArray): Float32Array {
  const k = 4;
  const cent: number[][] = [];
  for (let i = 0; i < k; i++) {
    const j = Math.floor(((i + 0.5) / k) * N * N) * 4;
    cent.push([px[j] / 255, px[j + 1] / 255, px[j + 2] / 255]);
  }
  const assign = new Uint8Array(N * N);
  for (let iter = 0; iter < 6; iter++) {
    for (let p = 0; p < N * N; p++) {
      const r = px[p * 4] / 255, gg = px[p * 4 + 1] / 255, b = px[p * 4 + 2] / 255;
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const d = (r - cent[c][0]) ** 2 + (gg - cent[c][1]) ** 2 + (b - cent[c][2]) ** 2;
        if (d < bd) { bd = d; best = c; }
      }
      assign[p] = best;
    }
    const sum = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let p = 0; p < N * N; p++) {
      const s = sum[assign[p]];
      s[0] += px[p * 4] / 255; s[1] += px[p * 4 + 1] / 255; s[2] += px[p * 4 + 2] / 255; s[3]++;
    }
    for (let c = 0; c < k; c++) {
      if (sum[c][3] > 0) cent[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
    }
  }
  // order bright→dark so shaders can rely on slot meaning
  cent.sort((a, b) => (b[0] + b[1] + b[2]) - (a[0] + a[1] + a[2]));
  const out = new Float32Array(16);
  for (let c = 0; c < k; c++) {
    out[c * 4] = cent[c][0]; out[c * 4 + 1] = cent[c][1]; out[c * 4 + 2] = cent[c][2]; out[c * 4 + 3] = 1;
  }
  return out;
}

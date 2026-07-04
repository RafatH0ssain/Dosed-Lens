/** Extract 4 dominant colors + brightest-region position from an image
    (dominants seed the DMT breakthrough palette; brightest point anchors
    psilocybin's water ripple). */

export interface ImageStats {
  colors: Float32Array; // 4 × RGBA
  bright: Float32Array; // uv of brightest region, y up
}

export function analyzeImage(img: TexImageSource & CanvasImageSource): ImageStats {
  const N = 24;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, N, N);
  const px = g.getImageData(0, 0, N, N).data;
  let bi = 0;
  let bl = -1;
  for (let p = 0; p < N * N; p++) {
    // 3×3 box luminance would be nicer; single texel is fine at 24×24
    const l = px[p * 4] * 0.2126 + px[p * 4 + 1] * 0.7152 + px[p * 4 + 2] * 0.0722;
    if (l > bl) { bl = l; bi = p; }
  }
  const bright = new Float32Array([
    ((bi % N) + 0.5) / N,
    1 - (Math.floor(bi / N) + 0.5) / N, // GL uv, y up
  ]);
  return { colors: dominantColors(img), bright };
}

export function dominantColors(img: TexImageSource & CanvasImageSource): Float32Array {
  const N = 24;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, N, N);
  const px = g.getImageData(0, 0, N, N).data;

  // k-means, k=4, few iterations — plenty for palette seeding
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
